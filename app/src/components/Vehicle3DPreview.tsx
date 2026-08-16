import { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadVehicleModelInstance, type VehicleModelType } from "@/lib/vehicleModels3D";

interface Vehicle3DPreviewProps {
  vehicleType: VehicleModelType;
  className?: string;
  /** Disables the slow auto-rotate — useful for a static "product shot" look. */
  spin?: boolean;
}

// Small, self-contained Three.js "product shot" of one of the real GLB
// vehicle models — used anywhere the app previously showed a flat 2D PNG
// (ride-type pickers, the "finding a captain/courier" spinner, etc.) so the
// same real 3D assets used on the map also show up off the map.
export default function Vehicle3DPreview({ vehicleType, className, spin = true }: Vehicle3DPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;
    let vehicle: THREE.Group | null = null;

    const width = container.clientWidth || 64;
    const height = container.clientHeight || 64;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Matches the brightness fix already tuned for the map overlay so the
    // model reads the same off the map as it does on it.
    scene.add(new THREE.AmbientLight(0xffffff, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 4, 2);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    const resize = () => {
      const w = container.clientWidth || 64;
      const h = container.clientHeight || 64;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    loadVehicleModelInstance(vehicleType)
      .then((instance) => {
        if (disposed) return;
        vehicle = instance;
        scene.add(instance);

        const box = new THREE.Box3().setFromObject(instance);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const radius = Math.max(size.x, size.y, size.z, 0.5);

        // Pulled back further than the original 0.9/0.75/1.35 multipliers —
        // those left almost zero headroom (visible half-height barely
        // exceeded the object's own half-height), so taller variants like
        // the school/parcel roof accessories clipped at the top of frame.
        camera.position.set(center.x + radius * 1.3, center.y + radius * 1.1, center.z + radius * 1.9);
        camera.lookAt(center.x, center.y + size.y * 0.22, center.z);

        const animate = () => {
          if (disposed) return;
          if (spin && vehicle) vehicle.rotation.y += 0.012;
          renderer.render(scene, camera);
          frameId = requestAnimationFrame(animate);
        };
        animate();
      })
      .catch(() => {
        // No model available for this type — the container just stays empty,
        // same graceful-degradation approach used by the map overlay hooks.
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const material = mesh.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material?.dispose();
        }
      });
    };
  }, [vehicleType, spin]);

  return <div ref={containerRef} className={className} />;
}
