import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRickshawModel, RICKSHAW_TRUE_LENGTH_METERS } from "@/lib/rickshawModel3D";
import { loadVehicleModelInstance, MODEL_LENGTH_METERS, type VehicleModelType } from "@/lib/vehicleModels3D";

interface LatLng {
  lat: number;
  lng: number;
}

const TRAIL_LENGTH = 6;
const MIN_ON_SCREEN_LENGTH_PX = 42;
const MAX_SCALE_MULTIPLIER = 400;

// Web Mercator ground resolution formula — meters represented by one screen
// pixel at a given zoom level and latitude.
function metersPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}
const TRAIL_COLOR = "#FF6B00";
const POSITION_EASE = 0.12; // per animation tick, fraction of remaining distance closed
const HEADING_EASE = 0.18;
// transformer.fromLatLngAltitude()'s local frame is NOT the standard
// three.js Y-up convention — it's a right-handed Z-up "ENU" frame (X=East,
// Y=North, Z=Up), confirmed against Google's own threejs-overlay sample
// (which applies this exact same rotation to a loaded GLTF: see
// developers.google.com/maps/documentation/javascript/examples/webgl/threejs-overlay-simple).
// Our models (GLB and the procedural fallback) are authored Y-up like any
// normal three.js/glTF asset. Without this correction the model's "up" axis
// points North instead of Up — i.e. it renders lying on its side, not
// merely mistilted — which is what every previous "upside-down/flipped"
// report was actually seeing. This was misdiagnosed for a while as a tilt
// problem (see git history for the abandoned TOP_DOWN_TILT_DEG lean, and a
// heading-dependent "rolling" bug from an earlier nesting-order fix) because
// rotating the wrong axis (Y instead of Z) for heading also produces
// tumbling motion, which looked consistent with a tilt/pivot bug.
const MODEL_UP_AXIS_FIX_RAD = Math.PI / 2;

// Shortest-path angle interpolation so a heading crossing 359→1 turns
// through 2°, not the long way around through 180°.
function lerpAngleDeg(from: number, to: number, t: number): number {
  const diff = ((((to - from) % 360) + 540) % 360) - 180;
  return from + diff * t;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Renders a branded 3D e-rickshaw on a Google Map via WebGLOverlayView +
 * three.js, smoothly interpolating between GPS updates (no teleporting) and
 * leaving a short fading trail. Returns an imperative `setPosition` — feed
 * it live GPS coordinates as they arrive and the visual motion is handled
 * internally at animation-frame rate, independent of how often updates come in.
 */
export function useRickshawOverlay(map: google.maps.Map | null, modelType?: VehicleModelType) {
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // pivot is the outermost group, rotated around world Z (see
  // MODEL_UP_AXIS_FIX_RAD) every draw call to face the current heading.
  // axisFix is nested inside it with a fixed rotation.x — converting the
  // model's authored Y-up space into the scene's real Z-up frame — applied
  // once here, never per-frame, since it doesn't depend on heading. model is
  // the actual visible content (procedural or a loaded/normalized GLB)
  // nested inside axisFix, whose own transform is never touched here — a
  // loaded model already has its orientation/real-world-scale baked in by
  // vehicleModels3D's normalizeModel(), so writing to it directly would wipe
  // that out every frame.
  const pivotRef = useRef<THREE.Group | null>(null);
  const axisFixRef = useRef<THREE.Group | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  // The real-world length (meters) the current modelRef content represents —
  // starts at the procedural model's length and updates once a requested
  // real GLB model finishes loading and swaps in.
  const trueLengthRef = useRef(RICKSHAW_TRUE_LENGTH_METERS);
  // Ref (not state) so callers can read the current value synchronously from
  // inside animation-interval callbacks without stale-closure issues.
  // WebGLOverlayView needs a vector-rendering map (a real Map ID configured
  // for Vector in Cloud Console) — on a plain raster map this stays false and
  // callers should fall back to a 2D marker instead of silently rendering nothing.
  const isAvailableRef = useRef<boolean | null>(null);

  const currentRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const targetRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const trailPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const trailHistoryRef = useRef<LatLng[]>([]);
  const lastTrailPushRef = useRef(0);

  useEffect(() => {
    if (!map) return;

    const capabilities = map.getMapCapabilities?.();
    const webglOk = !!capabilities?.isWebGLOverlayViewAvailable;
    isAvailableRef.current = webglOk;
    if (!webglOk) {
      console.warn(
        "[useRickshawOverlay] WebGLOverlayView unavailable on this map — it needs a Map ID configured for Vector rendering in Google Cloud Console. Falling back to 2D marker."
      );
      return;
    }

    const overlay = new google.maps.WebGLOverlayView();
    overlayRef.current = overlay;

    overlay.onAdd = () => {
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Tuned bright enough for real GLB models (PBR materials read much
      // darker than the hand-authored procedural rickshaw under the same
      // light) — two directional lights from opposite sides avoid a
      // black/unlit far face. Ambient is the dominant term on purpose: it's
      // angle-independent, so the vehicle's white body reads consistently
      // bright regardless of which way it's currently heading, instead of
      // one side reading dull/gray whenever it's not facing the key light.
      const ambient = new THREE.AmbientLight(0xffffff, 4.2);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(0.6, 1, 0.4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 1.2);
      fill.position.set(-0.6, 0.6, -0.4);
      scene.add(fill);

      const camera = new THREE.PerspectiveCamera();
      cameraRef.current = camera;

      const pivot = new THREE.Group();
      pivotRef.current = pivot;
      scene.add(pivot);

      const axisFix = new THREE.Group();
      axisFixRef.current = axisFix;
      // Fixed Y-up-model → Z-up-world correction — set once here, not
      // per-frame, since it's constant regardless of heading (see
      // MODEL_UP_AXIS_FIX_RAD above).
      axisFix.rotation.x = MODEL_UP_AXIS_FIX_RAD;
      pivot.add(axisFix);

      // Shows instantly (no network fetch); swapped out for the real GLB
      // once it's loaded, if a specific model type was requested.
      const model = createRickshawModel();
      modelRef.current = model;
      trueLengthRef.current = RICKSHAW_TRUE_LENGTH_METERS;
      axisFix.add(model);

      if (modelType) {
        loadVehicleModelInstance(modelType)
          .then((loaded) => {
            if (sceneRef.current !== scene) return; // overlay was torn down while loading
            const previous = modelRef.current;
            if (previous) axisFix.remove(previous);
            axisFix.add(loaded);
            modelRef.current = loaded;
            trueLengthRef.current = MODEL_LENGTH_METERS[modelType];
          })
          .catch((error) => console.error(`Error loading vehicle model "${modelType}":`, error));
      }
    };

    overlay.onContextRestored = ({ gl }) => {
      const renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl,
        ...gl.getContextAttributes(),
      });
      renderer.autoClear = false;
      // Loaded GLB textures are authored in sRGB — without this they decode
      // as linear and render dull/dark regardless of light intensity.
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;
    };

    overlay.onDraw = ({ transformer }) => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const pivot = pivotRef.current;
      const current = currentRef.current;
      if (!scene || !camera || !renderer || !pivot || !current) return;

      const matrix = transformer.fromLatLngAltitude({ lat: current.lat, lng: current.lng, altitude: 0 });
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

      // Compass heading (0° = North, clockwise) → rotation around world Z,
      // the real vertical axis in this Z-up frame (see MODEL_UP_AXIS_FIX_RAD
      // above). Applied to the pivot, not the model itself — the model's own
      // rotation is whatever normalizeModel() baked in for its
      // forward-facing correction, and axisFix's rotation is the constant
      // up-axis conversion, neither of which should be touched per frame.
      pivot.rotation.z = THREE.MathUtils.degToRad(90 - current.heading);

      // At true 1:1 scale (1 scene unit = 1 meter) the model is sub-pixel at
      // any zoomed-out view — scale it up to guarantee a minimum on-screen
      // size, converging to true scale once you're zoomed in close enough.
      const zoom = map.getZoom() ?? 16;
      const mpp = metersPerPixel(current.lat, zoom);
      const scale = Math.max(1, Math.min(MAX_SCALE_MULTIPLIER, (MIN_ON_SCREEN_LENGTH_PX * mpp) / trueLengthRef.current));
      pivot.scale.setScalar(scale);

      renderer.render(scene, camera);
      renderer.resetState();
    };

    overlay.onContextLost = () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };

    overlay.onRemove = () => {
      sceneRef.current = null;
      cameraRef.current = null;
      pivotRef.current = null;
      axisFixRef.current = null;
      modelRef.current = null;
    };

    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      trailPolylinesRef.current.forEach((p) => p.setMap(null));
      trailPolylinesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const redrawTrail = () => {
    if (!map) return;
    trailPolylinesRef.current.forEach((p) => p.setMap(null));
    const history = trailHistoryRef.current;
    const segments: google.maps.Polyline[] = [];
    for (let i = 0; i < history.length - 1; i++) {
      const opacity = 0.05 + (0.35 * i) / Math.max(1, history.length - 1);
      const seg = new google.maps.Polyline({
        path: [history[i], history[i + 1]],
        strokeColor: TRAIL_COLOR,
        strokeOpacity: opacity,
        strokeWeight: 4,
        map,
      });
      segments.push(seg);
    }
    trailPolylinesRef.current = segments;
  };

  const tick = () => {
    const current = currentRef.current;
    const target = targetRef.current;
    if (current && target) {
      current.lat = lerp(current.lat, target.lat, POSITION_EASE);
      current.lng = lerp(current.lng, target.lng, POSITION_EASE);
      current.heading = lerpAngleDeg(current.heading, target.heading, HEADING_EASE);

      const now = performance.now();
      if (now - lastTrailPushRef.current > 350) {
        lastTrailPushRef.current = now;
        trailHistoryRef.current.push({ lat: current.lat, lng: current.lng });
        if (trailHistoryRef.current.length > TRAIL_LENGTH) trailHistoryRef.current.shift();
        redrawTrail();
      }

      const closeEnough =
        Math.abs(current.lat - target.lat) < 1e-7 &&
        Math.abs(current.lng - target.lng) < 1e-7 &&
        Math.abs(((current.heading - target.heading + 540) % 360) - 180) < 0.1;

      overlayRef.current?.requestRedraw();

      if (!closeEnough) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
    }
    rafRef.current = null;
  };

  // `instant` skips the lat/lng easing entirely — for a caller already
  // feeding a smooth continuous stream of targets (e.g. animateAlongPath,
  // once per rendered frame), that extra easing only adds a constant lag
  // behind where the target actually is, which visibly pulls the vehicle
  // off the route polyline (drawn from the exact, un-eased point).
  const setPosition = (lat: number, lng: number, headingDeg: number, instant = false) => {
    if (!currentRef.current) {
      currentRef.current = { lat, lng, heading: headingDeg };
    } else if (instant) {
      currentRef.current = { lat, lng, heading: headingDeg };
    }
    targetRef.current = { lat, lng, heading: headingDeg };
    overlayRef.current?.requestRedraw();
    if (!instant && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  return { setPosition, isAvailableRef };
}
