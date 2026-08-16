import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createRickshawModel, RICKSHAW_TRUE_LENGTH_METERS } from "@/lib/rickshawModel3D";
import { loadVehicleModelInstance, MODEL_LENGTH_METERS, type VehicleModelType } from "@/lib/vehicleModels3D";

interface VehicleState {
  // pivot is the outermost group per vehicle, rotated around world Z (see
  // MODEL_UP_AXIS_FIX_RAD) every draw call to face the current heading, and
  // also holds the visibility flag for the one-draw-call-per-vehicle trick
  // below. axisFix is nested inside it with a fixed rotation.x — converting
  // the model's authored Y-up space into the scene's real Z-up frame —
  // applied once, not per-frame, since it's constant regardless of heading.
  // model is the actual visible content, nested inside axisFix, whose own
  // transform is never touched directly — a loaded GLB already has its
  // orientation/real-world scale baked in by vehicleModels3D's
  // normalizeModel(), so writing to it here would wipe that out.
  pivot: THREE.Group;
  axisFix: THREE.Group;
  model: THREE.Group;
  // Real-world length (meters) `model` currently represents — starts at the
  // procedural fallback's length, updates once a requested GLB model loads and swaps in.
  trueLength: number;
  current: { lat: number; lng: number; heading: number };
  target: { lat: number; lng: number; heading: number };
}

const MIN_ON_SCREEN_LENGTH_PX = 34;
const MAX_SCALE_MULTIPLIER = 400;
const POSITION_EASE = 0.1;
const HEADING_EASE = 0.15;
// transformer.fromLatLngAltitude()'s local frame is NOT the standard
// three.js Y-up convention — it's a right-handed Z-up "ENU" frame (X=East,
// Y=North, Z=Up), confirmed against Google's own threejs-overlay sample
// (which applies this exact same rotation to a loaded GLTF: see
// developers.google.com/maps/documentation/javascript/examples/webgl/threejs-overlay-simple).
// Our models (GLB and the procedural fallback) are authored Y-up like any
// normal three.js/glTF asset. Without this correction the model's "up" axis
// points North instead of Up — i.e. it renders lying on its side, not
// merely mistilted — which is what every previous "upside-down/flipped"
// report was actually seeing (see useRickshawOverlay.ts for the full note).
const MODEL_UP_AXIS_FIX_RAD = Math.PI / 2;

function metersPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

function lerpAngleDeg(from: number, to: number, t: number): number {
  const diff = ((((to - from) % 360) + 540) % 360) - 180;
  return from + diff * t;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Multi-vehicle sibling of useRickshawOverlay — renders any number of 3D
 * rickshaws in one shared WebGLOverlayView/scene (one GL context for the
 * whole fleet instead of one per vehicle). Each vehicle still moves and
 * rotates independently with its own smoothing, driven by `setVehicle`.
 * Since WebGLOverlayView's per-draw transform is anchored to a single
 * lat/lng, each vehicle gets its own render pass within one onDraw call —
 * cheap for the handful of nearby drivers shown on the rider's map.
 */
export function useRickshawFleetOverlay(map: google.maps.Map | null) {
  const overlayRef = useRef<google.maps.WebGLOverlayView | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const vehiclesRef = useRef<Map<string, VehicleState>>(new Map());
  const isAvailableRef = useRef<boolean | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;

    const capabilities = map.getMapCapabilities?.();
    const webglOk = !!capabilities?.isWebGLOverlayViewAvailable;
    isAvailableRef.current = webglOk;
    if (!webglOk) {
      console.warn("[useRickshawFleetOverlay] WebGLOverlayView unavailable on this map — needs a Vector-rendering Map ID.");
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
      // black/unlit far face.
      // Ambient is the dominant term on purpose: it's angle-independent, so
      // each vehicle's white body reads consistently bright regardless of
      // which way it's currently heading.
      scene.add(new THREE.AmbientLight(0xffffff, 4.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(0.6, 1, 0.4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 1.2);
      fill.position.set(-0.6, 0.6, -0.4);
      scene.add(fill);
      cameraRef.current = new THREE.PerspectiveCamera();
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
      if (!scene || !camera || !renderer) return;

      const zoom = map.getZoom() ?? 16;

      vehiclesRef.current.forEach((vehicle) => {
        vehicle.pivot.visible = true;
        vehiclesRef.current.forEach((other) => {
          if (other !== vehicle) other.pivot.visible = false;
        });

        const matrix = transformer.fromLatLngAltitude({ lat: vehicle.current.lat, lng: vehicle.current.lng, altitude: 0 });
        camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
        // Rotate around world Z (the real vertical axis in this Z-up frame —
        // see MODEL_UP_AXIS_FIX_RAD above), not Y.
        vehicle.pivot.rotation.z = THREE.MathUtils.degToRad(90 - vehicle.current.heading);

        const mpp = metersPerPixel(vehicle.current.lat, zoom);
        const scale = Math.max(1, Math.min(MAX_SCALE_MULTIPLIER, (MIN_ON_SCREEN_LENGTH_PX * mpp) / vehicle.trueLength));
        vehicle.pivot.scale.setScalar(scale);

        renderer.render(scene, camera);
        renderer.resetState();
      });
    };

    overlay.onContextLost = () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };

    overlay.onRemove = () => {
      sceneRef.current = null;
      cameraRef.current = null;
      vehiclesRef.current.clear();
    };

    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [map]);

  const tick = () => {
    let stillAnimating = false;
    vehiclesRef.current.forEach((vehicle) => {
      const { current, target } = vehicle;
      current.lat = lerp(current.lat, target.lat, POSITION_EASE);
      current.lng = lerp(current.lng, target.lng, POSITION_EASE);
      current.heading = lerpAngleDeg(current.heading, target.heading, HEADING_EASE);

      const closeEnough =
        Math.abs(current.lat - target.lat) < 1e-7 &&
        Math.abs(current.lng - target.lng) < 1e-7 &&
        Math.abs(((current.heading - target.heading + 540) % 360) - 180) < 0.1;
      if (!closeEnough) stillAnimating = true;
    });

    overlayRef.current?.requestRedraw();

    if (stillAnimating) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  };

  // `instant` skips the lat/lng easing entirely — for a caller already
  // feeding a smooth continuous stream of targets (e.g. animateAlongPath,
  // once per rendered frame), that extra easing only adds a constant lag
  // behind where the target actually is, which visibly pulls the vehicle
  // off the route polyline (drawn from the exact, un-eased point). Coarser
  // callers that jump to infrequent targets (e.g. AdminTracking's ambient
  // drift) still want the eased path, so it stays the default.
  const setVehicle = (
    id: string,
    lat: number,
    lng: number,
    headingDeg: number,
    modelType?: VehicleModelType,
    instant = false
  ) => {
    let vehicle = vehiclesRef.current.get(id);
    if (!vehicle) {
      const pivot = new THREE.Group();
      sceneRef.current?.add(pivot);

      const axisFix = new THREE.Group();
      // Fixed Y-up-model → Z-up-world correction — set once here, not
      // per-frame, since it's constant regardless of heading (see
      // MODEL_UP_AXIS_FIX_RAD above).
      axisFix.rotation.x = MODEL_UP_AXIS_FIX_RAD;
      pivot.add(axisFix);

      // Shows instantly (no network fetch); swapped out for the real GLB
      // once it's loaded, if a specific model type was requested.
      const model = createRickshawModel();
      axisFix.add(model);

      vehicle = {
        pivot,
        axisFix,
        model,
        trueLength: RICKSHAW_TRUE_LENGTH_METERS,
        current: { lat, lng, heading: headingDeg },
        target: { lat, lng, heading: headingDeg },
      };
      vehiclesRef.current.set(id, vehicle);

      if (modelType) {
        const scene = sceneRef.current;
        loadVehicleModelInstance(modelType)
          .then((loaded) => {
            const current = vehiclesRef.current.get(id);
            if (!current || sceneRef.current !== scene) return; // removed or overlay torn down while loading
            current.axisFix.remove(current.model);
            current.axisFix.add(loaded);
            current.model = loaded;
            current.trueLength = MODEL_LENGTH_METERS[modelType];
          })
          .catch((error) => console.error(`Error loading vehicle model "${modelType}":`, error));
      }
    } else {
      vehicle.target = { lat, lng, heading: headingDeg };
      if (instant) vehicle.current = { lat, lng, heading: headingDeg };
    }
    overlayRef.current?.requestRedraw();
    if (!instant && rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const removeVehicle = (id: string) => {
    const vehicle = vehiclesRef.current.get(id);
    if (vehicle) {
      sceneRef.current?.remove(vehicle.pivot);
      vehiclesRef.current.delete(id);
    }
  };

  return { setVehicle, removeVehicle, isAvailableRef };
}
