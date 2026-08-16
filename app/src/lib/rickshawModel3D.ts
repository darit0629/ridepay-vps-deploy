import * as THREE from "three";

// Real-world scale in meters so the model reads at true size as the map
// zooms — Google's WebGLOverlayView projects 1 scene unit == 1 meter at the
// anchor point, so a toy-scale model would either vanish or dwarf the map.
// Silhouette spans roughly rear (-1.35) to front tip (+1.4) along X.
const BODY_LENGTH = 2.75;
const BODY_WIDTH = 1.3;
const WHEEL_RADIUS = 0.32;

// Exported so the overlay hooks can compute a zoom-aware scale multiplier —
// at true 1x scale this model is sub-pixel at any zoomed-out / route-overview
// map level, so it needs to stay artificially bigger until you're zoomed in
// close enough for true scale to exceed a minimum on-screen size.
export const RICKSHAW_TRUE_LENGTH_METERS = BODY_LENGTH;

const SAFFRON = 0xff6b00;
const GREEN = 0x138808;
const BODY_WHITE = 0xf4f4f6;
const ROOF_BLACK = 0x1a1a2e;
const CHROME = 0xe8eef2;

// Side-profile silhouette of the lower body "tub" — drawn in the X (length,
// rear→front) / Y (height) plane, later extruded along Z (width). A modern
// wedge shape: shoulder line rises toward the cabin, nose tapers down and
// forward, echoing the sculpted concept-vehicle proportions this is styled after.
function buildLowerBodyShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1.32, 0.04);
  s.lineTo(-1.32, 0.52);
  s.quadraticCurveTo(-1.32, 0.62, -1.18, 0.63);
  s.lineTo(0.85, 0.63);
  s.quadraticCurveTo(1.05, 0.63, 1.14, 0.5);
  s.lineTo(1.4, 0.22);
  s.quadraticCurveTo(1.44, 0.14, 1.32, 0.08);
  s.lineTo(1.1, 0.02);
  s.lineTo(-1.32, 0.02);
  s.closePath();
  return s;
}

// Side-profile silhouette of the glass canopy/greenhouse that sits on top of
// the lower body — a short, near-vertical rear pane, a roof peak set back
// toward the rear (not centered), then a long raked windshield sweeping
// forward and down. This is the dominant visual element, matching the
// wraparound-glass look of the reference concept.
function buildCanopyShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1.14, 0.61);
  s.lineTo(-1.06, 1.42);
  s.quadraticCurveTo(-1.02, 1.56, -0.86, 1.58);
  s.lineTo(-0.42, 1.6);
  s.quadraticCurveTo(-0.2, 1.6, -0.1, 1.5);
  s.lineTo(0.62, 1.28);
  s.quadraticCurveTo(0.78, 1.22, 0.86, 1.08);
  s.lineTo(1.05, 0.72);
  s.quadraticCurveTo(1.1, 0.63, 1.0, 0.6);
  s.lineTo(0.84, 0.6);
  s.lineTo(-1.14, 0.6);
  s.closePath();
  return s;
}

function extrude(shape: THREE.Shape, material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: BODY_WIDTH, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2, steps: 1 });
  geometry.translate(0, 0, -BODY_WIDTH / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Builds a branded, low-poly electric-rickshaw as a THREE.Group, assembled
 * from primitives and extruded profile shapes (no external GLB asset).
 * Sized in meters so it renders at true scale under Google Maps'
 * WebGLOverlayView. Faces +X (heading 0 = East in the local ENU frame
 * WebGLOverlayView uses); the overlay rotates the whole group around Y to
 * match compass heading.
 */
export function createRickshawModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = "flying-ride-rickshaw";

  // --- Contact shadow: a soft, semi-transparent dark ellipse "grounding"
  // the vehicle — cheap and reliable vs. real shadow-mapping onto map tiles.
  const shadowGeo = new THREE.CircleGeometry(1.55, 24);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  shadow.scale.set(1, 0.75, 1);
  group.add(shadow);

  // --- Lower body (white, glossy) — wedge-shaped tub
  const bodyMat = new THREE.MeshStandardMaterial({ color: BODY_WHITE, metalness: 0.3, roughness: 0.3 });
  group.add(extrude(buildLowerBodyShape(), bodyMat));

  // --- Glass canopy / greenhouse — the dominant wraparound-glass element
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa9d8ff,
    transparent: true,
    opacity: 0.32,
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide,
  });
  group.add(extrude(buildCanopyShape(), glassMat));

  // --- Roof cap — thin black rail tracing the canopy ridge
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_BLACK, metalness: 0.35, roughness: 0.4 });
  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, BODY_WIDTH * 1.02), roofMat);
  roofCap.position.set(-0.64, 1.61, 0);
  roofCap.rotation.z = THREE.MathUtils.degToRad(-4);
  group.add(roofCap);

  // --- A-pillar and C-pillar (thin dark structural frames at the canopy's
  // front and rear edges, echoing the visible glass-house framing)
  [
    { x: -1.1, y: 1.0, len: 0.85, angle: -12 },
    { x: 0.95, y: 0.9, len: 0.75, angle: 32 },
  ].forEach(({ x, y, len, angle }) => {
    [-1, 1].forEach((side) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.05), roofMat);
      pillar.position.set(x, y, (side * BODY_WIDTH) / 2 - side * 0.02);
      pillar.rotation.z = THREE.MathUtils.degToRad(angle);
      group.add(pillar);
    });
  });

  // --- Mid door pillar / window divider (thin dark strip splitting the
  // glass into a front windshield area and a rear cabin window, matching
  // the reference's visible B-pillar between front and rear glass)
  [-1, 1].forEach((side) => {
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.95, 0.045), roofMat);
    divider.position.set(-0.05, 1.05, (side * BODY_WIDTH) / 2 - side * 0.02);
    divider.rotation.z = THREE.MathUtils.degToRad(8);
    group.add(divider);
  });

  // --- Saffron brand accent stripe along the lower body shoulder line
  const stripeMat = new THREE.MeshStandardMaterial({ color: SAFFRON, metalness: 0.15, roughness: 0.45 });
  [-1, 1].forEach((side) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.02), stripeMat);
    stripe.position.set(-0.25, 0.42, (side * BODY_WIDTH) / 2 + 0.011 * side);
    stripe.rotation.z = THREE.MathUtils.degToRad(4);
    group.add(stripe);
  });

  // --- Green eco accent, lower rocker panel
  const ecoMat = new THREE.MeshStandardMaterial({ color: GREEN, metalness: 0.1, roughness: 0.6 });
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, BODY_WIDTH + 0.03), ecoMat);
  rocker.position.set(-0.15, 0.14, 0);
  group.add(rocker);

  // --- Slim front light bar (modern LED strip instead of round headlamps)
  const lightMat = new THREE.MeshStandardMaterial({ color: CHROME, emissive: 0xfff6d5, emissiveIntensity: 0.7, metalness: 0.85, roughness: 0.15 });
  const frontLight = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, BODY_WIDTH * 0.78, 4, 8), lightMat);
  frontLight.rotation.z = Math.PI / 2;
  frontLight.position.set(1.32, 0.3, 0);
  group.add(frontLight);

  // --- Slim rear light bar (emissive red, spanning most of the tail)
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 0.6 });
  const rearLight = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, BODY_WIDTH * 0.72, 4, 8), tailMat);
  rearLight.rotation.z = Math.PI / 2;
  rearLight.position.set(-1.29, 0.34, 0);
  group.add(rearLight);

  // --- Side mirrors
  const mirrorMat = roofMat;
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), mirrorMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(0.95, 0.95, side * (BODY_WIDTH / 2 + 0.1));
    group.add(arm);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.14), mirrorMat);
    mirror.position.set(0.95, 0.95, side * (BODY_WIDTH / 2 + 0.18));
    group.add(mirror);
  });

  // --- Wheels: 3-wheeler (one front, two rear), dark rubber with a modern
  // minimalist hub cap
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9, metalness: 0.05 });
  const hubMat = new THREE.MeshStandardMaterial({ color: CHROME, metalness: 0.85, roughness: 0.2 });
  const makeWheel = (x: number, z: number) => {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.2, 20), tireMat);
    tire.rotation.x = Math.PI / 2;
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 16), hubMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.23, 10), roofMat);
    cap.rotation.x = Math.PI / 2;
    wheel.add(cap);
    wheel.position.set(x, WHEEL_RADIUS, z);
    wheel.castShadow = true;
    return wheel;
  };
  group.add(makeWheel(1.05, 0));
  group.add(makeWheel(-0.85, BODY_WIDTH / 2 - 0.08));
  group.add(makeWheel(-0.85, -(BODY_WIDTH / 2 - 0.08)));

  // --- "Ridepay" logo decal on both side panels + rear, via a canvas texture
  const logoTexture = createLogoTexture();
  const logoMat = new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, depthWrite: false });
  [-1, 1].forEach((side) => {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.33), logoMat);
    decal.position.set(-0.35, 0.42, (side * BODY_WIDTH) / 2 + 0.012 * side);
    decal.rotation.y = side > 0 ? 0 : Math.PI;
    group.add(decal);
  });
  const rearDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.24), logoMat);
  rearDecal.position.set(-1.33, 0.48, 0);
  rearDecal.rotation.y = -Math.PI / 2;
  group.add(rearDecal);

  return group;
}

// Renders "FLYING RIDE" as a small canvas texture for the body decals —
// avoids needing an external logo image file.
function createLogoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FF6B00";
  ctx.font = "bold 40px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FLYING", canvas.width / 2, 34);
  ctx.fillStyle = "#1A1A2E";
  ctx.fillText("RIDE", canvas.width / 2, 74);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
