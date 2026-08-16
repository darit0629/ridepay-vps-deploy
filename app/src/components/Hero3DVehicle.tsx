import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { loadVehicleModelInstance, type VehicleModelType } from "@/lib/vehicleModels3D";

interface Hero3DVehicleProps {
  modelType?: VehicleModelType;
  className?: string;
}

// A standalone (non-map) rotating 3D vehicle viewer for the marketing hero —
// reuses the same GLB loader/lighting recipe as the in-app fleet overlay
// (useRickshawFleetOverlay), but with its own small scene/camera/renderer
// since there's no Google Map here to anchor a WebGLOverlayView to.
export default function Hero3DVehicle({ modelType = "e-riksha", className }: Hero3DVehicleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let rafId = 0;

    const scene = new THREE.Scene();
    // Pulled back further than the map-overlay recipe this was based on —
    // this viewer cycles through several vehicle variants (school roof,
    // parcel roof-box, etc.) that stand noticeably taller than the base
    // e-riksha, so the frame needs generous headroom or the tallest ones
    // clip at the top even though the default variant looks fine.
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(3.6, 2.2, 4.2);
    camera.lookAt(0, 0.6, 0);

    // Brighter than the map-overlay recipe this was based on — sitting on a
    // dark hero background (not a bright map tile), the model reads dim/gray
    // at the same intensities that look fine over satellite imagery.
    scene.add(new THREE.AmbientLight(0xffffff, 3.6));
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(0.6, 1, 0.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 2.2);
    fill.position.set(-0.6, 0.6, -0.4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(0, 1.2, -1);
    scene.add(rim);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const resize = () => {
      const size = container.clientWidth;
      if (!size) return;
      renderer.setSize(size, size);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let pivot: THREE.Group | null = null;
    loadVehicleModelInstance(modelType)
      .then((model) => {
        if (disposed) return;
        pivot = new THREE.Group();
        pivot.add(model);
        pivot.rotation.y = Math.PI / 5;
        scene.add(pivot);
        setLoaded(true);
      })
      .catch((error) => console.error(`Error loading hero vehicle model "${modelType}":`, error));

    const clock = new THREE.Clock();
    const tick = () => {
      const delta = clock.getDelta();
      if (pivot) pivot.rotation.y += delta * 0.35;
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [modelType]);

  return (
    <div className={className}>
      <div ref={containerRef} className={`w-full aspect-square transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
}
