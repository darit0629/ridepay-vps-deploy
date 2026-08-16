import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export type VehicleModelType =
  | "e-riksha"
  | "auto-rickshaw"
  | "car"
  | "bike"
  | "e-riksha-woman"
  | "e-riksha-parcel"
  | "bike-parcel"
  | "e-riksha-school";

export const DEFAULT_VEHICLE_MODEL: VehicleModelType = "e-riksha";

const MODEL_URLS: Record<VehicleModelType, string> = {
  "e-riksha": "/models/e-riksha.glb",
  "auto-rickshaw": "/models/auto-rickshaw.glb",
  car: "/models/car.glb",
  bike: "/models/bike.glb",
  "e-riksha-woman": "/models/e-riksha-woman.glb",
  "e-riksha-parcel": "/models/e-riksha-parcel.glb",
  "bike-parcel": "/models/bike-parcel.glb",
  "e-riksha-school": "/models/e-riksha-school.glb",
};

// Real-world nose-to-tail length (meters) each model is normalized to, so it
// renders at true scale under WebGLOverlayView the same way the hand-built
// procedural rickshaw does (1 scene unit == 1 meter at the anchor point).
export const MODEL_LENGTH_METERS: Record<VehicleModelType, number> = {
  "e-riksha": 2.75,
  "auto-rickshaw": 2.75,
  "e-riksha-woman": 2.75,
  "e-riksha-parcel": 2.75,
  "e-riksha-school": 3.2, // longer passenger cabin
  "bike-parcel": 2.1,
  bike: 1.95,
  car: 4.2,
};

// These are raw AI-generated (Tripo) exports with no reliable "forward"
// convention baked in, so normalizeModel() auto-aligns each one's longest
// horizontal axis to +X (the overlay's heading-0 direction). If a specific
// model turns out to visually face sideways/backwards once you actually see
// it on the map, add a correction here (degrees) rather than touching the
// auto-align logic.
const YAW_CORRECTION_DEG: Partial<Record<VehicleModelType, number>> = {};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

function normalizeModel(scene: THREE.Group, type: VehicleModelType): THREE.Group {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Center horizontally and drop to ground level (min-Y at 0) on the loaded
  // content itself, before any rotation/scale is applied by the wrapper.
  scene.position.set(-center.x, -box.min.y, -center.z);

  const wrapper = new THREE.Group();
  wrapper.name = `vehicle-model-${type}`;
  wrapper.add(scene);

  const longestIsZ = size.z > size.x;
  wrapper.rotation.y = longestIsZ ? Math.PI / 2 : 0;
  const correction = YAW_CORRECTION_DEG[type];
  if (correction) wrapper.rotation.y += THREE.MathUtils.degToRad(correction);

  const horizontalLength = longestIsZ ? size.z : size.x;
  const targetLength = MODEL_LENGTH_METERS[type];
  wrapper.scale.setScalar(horizontalLength > 0 ? targetLength / horizontalLength : 1);

  wrapper.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).castShadow = true;
  });

  return wrapper;
}

const modelCache = new Map<VehicleModelType, Promise<THREE.Group>>();

function loadModelOnce(type: VehicleModelType): Promise<THREE.Group> {
  const cached = modelCache.get(type);
  if (cached) return cached;

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      MODEL_URLS[type],
      (gltf) => resolve(normalizeModel(gltf.scene, type)),
      undefined,
      (error) => reject(error instanceof Error ? error : new Error(String(error)))
    );
  });
  modelCache.set(type, promise);
  return promise;
}

// Returns a fresh, independently-positionable instance — geometry/material
// buffers are shared with the cached original (THREE.Object3D#clone doesn't
// deep-copy those), so spawning several vehicles of the same type is cheap
// after the first load.
export async function loadVehicleModelInstance(type: VehicleModelType): Promise<THREE.Group> {
  const base = await loadModelOnce(type);
  return base.clone(true);
}
