import * as THREE from 'three';

export interface CarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  wheels: THREE.Mesh[];
  frontSteerPivots: THREE.Group[];
  brakeMaterial: THREE.MeshStandardMaterial;
  bodyMaterial: THREE.MeshPhysicalMaterial;
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
  baseColorHex: number;
}

export function createRaceCar(
  primaryHex: number,
  accentHex: number,
  contactShadowTex: THREE.Texture,
): CarRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Car faces -Z in local space (forward = -Z, right = +X, up = +Y)
  // 1. Primary sculpted aerodynamic chassis via ExtrudeGeometry side profile
  const profile = new THREE.Shape();
  profile.moveTo(-2.35, 0.22); // rear bottom
  profile.lineTo(2.35, 0.22);  // front splitter tip
  profile.lineTo(2.42, 0.36);  // nose leading edge
  profile.lineTo(1.75, 0.56);  // sculpted hood slope
  profile.lineTo(0.85, 0.72);  // cowl
  profile.lineTo(0.32, 1.10);  // windshield header
  profile.lineTo(-0.72, 1.12); // roofline
  profile.lineTo(-1.82, 0.80); // fastback engine deck
  profile.lineTo(-2.35, 0.74); // tail deck
  profile.closePath();

  const chassisGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 1.76,
    bevelEnabled: true,
    bevelThickness: 0.11,
    bevelSize: 0.08,
    bevelSegments: 3,
    steps: 1,
  });
  chassisGeo.center();
  // Rotate so X-profile runs along Z (-Z is front)
  chassisGeo.rotateY(Math.PI / 2);
  chassisGeo.computeVertexNormals();

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: primaryHex,
    metalness: 0.58,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const chassisMesh = new THREE.Mesh(chassisGeo, bodyMaterial);
  chassisMesh.position.y = 0.67;
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  bodyPivot.add(chassisMesh);

  // 2. Carbon-fiber lower splitter, side skirts & rear diffuser
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x161920,
    roughness: 0.72,
    metalness: 0.22,
  });

  const undertray = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.12, 4.95), carbonMat);
  undertray.position.set(0, 0.22, 0.02);
  undertray.castShadow = true;
  bodyPivot.add(undertray);

  // 3. Center racing stripe livery accent along hood & roof
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.28,
    metalness: 0.35,
  });
  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 1.55), accentMat);
  hoodStripe.position.set(0, 0.65, -1.35);
  hoodStripe.rotation.x = 0.17;
  bodyPivot.add(hoodStripe);

  // 4. Smoked glass wraparound cockpit canopy
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b101b,
    roughness: 0.06,
    metalness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const canopyGeo = new THREE.BoxGeometry(1.38, 0.42, 1.72);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.96, 0.12);
  bodyPivot.add(canopy);

  // 5. Side air-intake pods
  const intakeGeo = new THREE.BoxGeometry(0.16, 0.32, 1.25);
  const intakeL = new THREE.Mesh(intakeGeo, carbonMat);
  intakeL.position.set(-1.02, 0.52, 0.15);
  const intakeR = new THREE.Mesh(intakeGeo, carbonMat);
  intakeR.position.set(1.02, 0.52, 0.15);
  bodyPivot.add(intakeL, intakeR);

  // 6. Sculpted Rear GT Wing + Endplates + Twin Pylons
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.07, 0.44), carbonMat);
  wingBlade.position.set(0, 1.24, 2.18);
  wingBlade.rotation.x = 0.14;
  wingBlade.castShadow = true;
  bodyPivot.add(wingBlade);

  const pylonGeo = new THREE.BoxGeometry(0.07, 0.44, 0.26);
  const pylonL = new THREE.Mesh(pylonGeo, carbonMat);
  pylonL.position.set(-0.56, 1.02, 2.15);
  const pylonR = new THREE.Mesh(pylonGeo, carbonMat);
  pylonR.position.set(0.56, 1.02, 2.15);
  bodyPivot.add(pylonL, pylonR);

  const endplateGeo = new THREE.BoxGeometry(0.05, 0.28, 0.52);
  const endL = new THREE.Mesh(endplateGeo, bodyMaterial);
  endL.position.set(-1.08, 1.21, 2.18);
  const endR = new THREE.Mesh(endplateGeo, bodyMaterial);
  endR.position.set(1.08, 1.21, 2.18);
  bodyPivot.add(endL, endR);

  // 7. LED Headlights & Full-width Brake Light Bar
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });
  const headGeo = new THREE.BoxGeometry(0.42, 0.08, 0.12);
  const headL = new THREE.Mesh(headGeo, headlightMat);
  headL.position.set(-0.68, 0.50, -2.42);
  const headR = new THREE.Mesh(headGeo, headlightMat);
  headR.position.set(0.68, 0.50, -2.42);
  bodyPivot.add(headL, headR);

  const brakeMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.09, 0.08), brakeMaterial);
  tailBar.position.set(0, 0.68, 2.42);
  bodyPivot.add(tailBar);

  // 8. Twin Chrome Exhaust Pipes & Nitro Flame Cones
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    metalness: 0.95,
    roughness: 0.15,
  });
  const pipeGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.22, 12);
  pipeGeo.rotateX(Math.PI / 2);
  const pipeL = new THREE.Mesh(pipeGeo, chromeMat);
  pipeL.position.set(-0.34, 0.34, 2.44);
  const pipeR = new THREE.Mesh(pipeGeo, chromeMat);
  pipeR.position.set(0.34, 0.34, 2.44);
  bodyPivot.add(pipeL, pipeR);

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
  });
  const flameGeo = new THREE.ConeGeometry(0.11, 0.95, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.48);

  const flameLeft = new THREE.Mesh(flameGeo, flameMat);
  flameLeft.position.set(-0.34, 0.34, 2.48);
  flameLeft.visible = false;

  const flameRight = new THREE.Mesh(flameGeo, flameMat);
  flameRight.position.set(0.34, 0.34, 2.48);
  flameRight.visible = false;
  bodyPivot.add(flameLeft, flameRight);

  // 9. Four Wheel Assemblies (rubber tire + alloy rim + hub)
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x181a1f,
    roughness: 0.86,
    metalness: 0.04,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.18,
  });

  const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.30, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.33, 0.06, 0.42);

  const wheels: THREE.Mesh[] = [];
  const frontSteerPivots: THREE.Group[] = [];

  const wheelPositions: [number, number, number, boolean][] = [
    [-0.98, 0.38, -1.50, true],  // Front Left
    [0.98, 0.38, -1.50, true],   // Front Right
    [-1.00, 0.38, 1.48, false],  // Rear Left
    [1.00, 0.38, 1.48, false],   // Rear Right
  ];

  wheelPositions.forEach(([wx, wy, wz, isFront]) => {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;

    const rim = new THREE.Mesh(rimGeo, rimMat);
    const spoke = new THREE.Mesh(spokeGeo, carbonMat);
    tire.add(rim, spoke);
    wheels.push(tire);

    if (isFront) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wx, wy, wz);
      steerPivot.add(tire);
      root.add(steerPivot);
      frontSteerPivots.push(steerPivot);
    } else {
      tire.position.set(wx, wy, wz);
      root.add(tire);
    }
  });

  // 10. Grounded Radial Contact Shadow Plane
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.6), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  return {
    root,
    bodyPivot,
    wheels,
    frontSteerPivots,
    brakeMaterial,
    bodyMaterial,
    flameLeft,
    flameRight,
    baseColorHex: primaryHex,
  };
}
