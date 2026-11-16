import * as THREE from 'three';
import { BuiltTrackData, getTerrainHeight } from './tracks';
import {
  createAsphaltTexture,
  createBoostPadTexture,
  createCheckeredTexture,
  createCurbTexture,
  createTerrainTexture,
} from './textures';

export interface BuiltTrackVisuals {
  group: THREE.Group;
  gantryLights: THREE.MeshStandardMaterial[];
  boostPadWorldPositions: { x: number; y: number; z: number; s: number; lateral: number }[];
  dispose: () => void;
}

export function buildTrackVisuals(
  track: BuiltTrackData,
  maxAnisotropy: number,
): BuiltTrackVisuals {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const samples = track.samples;
  const n = samples.length;
  const halfW = track.config.roadWidth * 0.5;
  const curbW = 1.15;
  const barrierOffset = halfW + curbW + 1.1;

  // 1. Continuous Closed-Loop Asphalt Ribbon
  const roadPos = new Float32Array((n + 1) * 2 * 3);
  const roadUv = new Float32Array((n + 1) * 2 * 2);
  const roadIndices: number[] = [];

  const curbPosL = new Float32Array((n + 1) * 2 * 3);
  const curbPosR = new Float32Array((n + 1) * 2 * 3);
  const curbUv = new Float32Array((n + 1) * 2 * 2);

  const railPosL = new Float32Array((n + 1) * 2 * 3);
  const railPosR = new Float32Array((n + 1) * 2 * 3);
  const railUv = new Float32Array((n + 1) * 2 * 2);

  const uvRepeat = track.totalLength / 18;

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const p = s.point;
    const r = s.right;
    const vCoord = (i / n) * uvRepeat;

    // Road left & right vertices
    const lx = p.x - r.x * halfW;
    const ly = p.y;
    const lz = p.z - r.z * halfW;
    const rx = p.x + r.x * halfW;
    const ry = p.y;
    const rz = p.z + r.z * halfW;

    const baseIdx = i * 6;
    roadPos[baseIdx] = lx;
    roadPos[baseIdx + 1] = ly;
    roadPos[baseIdx + 2] = lz;
    roadPos[baseIdx + 3] = rx;
    roadPos[baseIdx + 4] = ry;
    roadPos[baseIdx + 5] = rz;

    const uvIdx = i * 4;
    roadUv[uvIdx] = 0;
    roadUv[uvIdx + 1] = vCoord;
    roadUv[uvIdx + 2] = 1;
    roadUv[uvIdx + 3] = vCoord;

    // Left curb (slightly raised +0.025 on outer lip)
    curbPosL[baseIdx] = p.x - r.x * (halfW + curbW);
    curbPosL[baseIdx + 1] = p.y + 0.04;
    curbPosL[baseIdx + 2] = p.z - r.z * (halfW + curbW);
    curbPosL[baseIdx + 3] = lx;
    curbPosL[baseIdx + 4] = ly + 0.015;
    curbPosL[baseIdx + 5] = lz;

    // Right curb
    curbPosR[baseIdx] = rx;
    curbPosR[baseIdx + 1] = ry + 0.015;
    curbPosR[baseIdx + 2] = rz;
    curbPosR[baseIdx + 3] = p.x + r.x * (halfW + curbW);
    curbPosR[baseIdx + 4] = p.y + 0.04;
    curbPosR[baseIdx + 5] = p.z + r.z * (halfW + curbW);

    curbUv[uvIdx] = 0;
    curbUv[uvIdx + 1] = vCoord * 1.4;
    curbUv[uvIdx + 2] = 1;
    curbUv[uvIdx + 3] = vCoord * 1.4;

    // Armco Barriers (vertical ribbon wall on both sides)
    railPosL[baseIdx] = p.x - r.x * barrierOffset;
    railPosL[baseIdx + 1] = p.y + 0.15;
    railPosL[baseIdx + 2] = p.z - r.z * barrierOffset;
    railPosL[baseIdx + 3] = p.x - r.x * barrierOffset;
    railPosL[baseIdx + 4] = p.y + 1.05;
    railPosL[baseIdx + 5] = p.z - r.z * barrierOffset;

    railPosR[baseIdx] = p.x + r.x * barrierOffset;
    railPosR[baseIdx + 1] = p.y + 1.05;
    railPosR[baseIdx + 2] = p.z + r.z * barrierOffset;
    railPosR[baseIdx + 3] = p.x + r.x * barrierOffset;
    railPosR[baseIdx + 4] = p.y + 0.15;
    railPosR[baseIdx + 5] = p.z + r.z * barrierOffset;

    railUv[uvIdx] = 0;
    railUv[uvIdx + 1] = vCoord;
    railUv[uvIdx + 2] = 1;
    railUv[uvIdx + 3] = vCoord;

    if (i < n) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      roadIndices.push(a, c, b, b, c, d);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(roadUv, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const asphaltTex = createAsphaltTexture(maxAnisotropy);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.78,
    metalness: 0.05,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  disposables.push(roadGeo, asphaltTex, roadMat);

  // Curbs
  const curbTex = createCurbTexture(maxAnisotropy);
  const curbMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    roughness: 0.65,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const buildStrip = (posAttr: Float32Array, uvAttr: Float32Array, doubleSide = false) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posAttr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvAttr, 2));
    geo.setIndex(roadIndices);
    geo.computeVertexNormals();
    const mat = doubleSide
      ? new THREE.MeshStandardMaterial({
          color: 0xcbd5e1,
          metalness: 0.65,
          roughness: 0.35,
          side: THREE.DoubleSide,
        })
      : curbMat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    if (doubleSide) mesh.castShadow = true;
    group.add(mesh);
    disposables.push(geo);
    if (doubleSide) disposables.push(mat);
  };

  buildStrip(curbPosL, curbUv);
  buildStrip(curbPosR, curbUv);
  buildStrip(railPosL, railUv, true);
  buildStrip(railPosR, railUv, true);
  disposables.push(curbTex, curbMat);

  // Guardrail support posts (InstancedMesh)
  const postStep = 6;
  const postCount = Math.floor(n / postStep) * 2;
  const postGeo = new THREE.BoxGeometry(0.22, 1.1, 0.22);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.5,
    roughness: 0.45,
  });
  const postInstances = new THREE.InstancedMesh(postGeo, postMat, postCount);
  const dummy = new THREE.Object3D();
  let pIdx = 0;
  for (let i = 0; i < n; i += postStep) {
    const s = samples[i];
    for (const side of [-1, 1]) {
      if (pIdx >= postCount) break;
      dummy.position.set(
        s.point.x + s.right.x * (barrierOffset * side + side * 0.12),
        s.point.y + 0.55,
        s.point.z + s.right.z * (barrierOffset * side + side * 0.12),
      );
      dummy.rotation.set(0, Math.atan2(s.tangent.x, s.tangent.z), 0);
      dummy.updateMatrix();
      postInstances.setMatrixAt(pIdx++, dummy.matrix);
    }
  }
  postInstances.instanceMatrix.needsUpdate = true;
  postInstances.computeBoundingSphere();
  group.add(postInstances);
  disposables.push(postGeo, postMat);

  // 2. Start/Finish Checkered Line & Overhead Gantry Arch with 5 Countdown Lights
  const startSample = samples[0];
  const startYaw = Math.atan2(-startSample.tangent.x, -startSample.tangent.z);

  const checkTex = createCheckeredTexture(maxAnisotropy);
  const checkMat = new THREE.MeshStandardMaterial({
    map: checkTex,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const checkGeo = new THREE.PlaneGeometry(track.config.roadWidth - 0.6, 3.8);
  checkGeo.rotateX(-Math.PI / 2);
  const checkMesh = new THREE.Mesh(checkGeo, checkMat);
  checkMesh.position.copy(startSample.point);
  checkMesh.position.y += 0.03;
  checkMesh.rotation.y = startYaw;
  checkMesh.receiveShadow = true;
  group.add(checkMesh);
  disposables.push(checkGeo, checkTex, checkMat);

  // Gantry arch
  const gantry = new THREE.Group();
  gantry.position.copy(startSample.point);
  gantry.rotation.y = startYaw;

  const gantryFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.32,
  });
  const gantryAccentMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.4,
    metalness: 0.3,
  });
  const spanW = track.config.roadWidth + 4.4;
  const pillarGeo = new THREE.BoxGeometry(0.9, 8.2, 0.9);
  const pillarL = new THREE.Mesh(pillarGeo, gantryFrameMat);
  pillarL.position.set(-spanW * 0.5, 4.1, 0);
  pillarL.castShadow = true;
  const pillarR = new THREE.Mesh(pillarGeo, gantryFrameMat);
  pillarR.position.set(spanW * 0.5, 4.1, 0);
  pillarR.castShadow = true;

  const bridgeGeo = new THREE.BoxGeometry(spanW + 1.0, 1.4, 1.2);
  const bridge = new THREE.Mesh(bridgeGeo, gantryFrameMat);
  bridge.position.set(0, 7.8, 0);
  bridge.castShadow = true;

  const stripeGeo = new THREE.BoxGeometry(spanW - 1.5, 0.25, 1.24);
  const gantryStripe = new THREE.Mesh(stripeGeo, gantryAccentMat);
  gantryStripe.position.set(0, 8.35, 0);

  gantry.add(pillarL, pillarR, bridge, gantryStripe);

  // 5 Countdown Light Pods on the gantry
  const gantryLights: THREE.MeshStandardMaterial[] = [];
  const podGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 16);
  podGeo.rotateX(Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    const pod = new THREE.Mesh(podGeo, lightMat);
    pod.position.set((i - 2) * 1.45, 7.65, 0.58);
    gantry.add(pod);
    gantryLights.push(lightMat);
    disposables.push(lightMat);
  }
  group.add(gantry);
  disposables.push(pillarGeo, bridgeGeo, stripeGeo, podGeo, gantryFrameMat, gantryAccentMat);

  // 3. Trackside Grandstands near Start/Finish straight
  const standGroup = new THREE.Group();
  const standBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const standSeatMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
  const standRoofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.4 });
  const tierGeo = new THREE.BoxGeometry(28, 1.2, 3.2);
  for (let tier = 0; tier < 4; tier++) {
    const step = new THREE.Mesh(tierGeo, tier % 2 === 0 ? standBaseMat : standSeatMat);
    step.position.set(0, 0.6 + tier * 1.1, -tier * 2.2);
    step.castShadow = true;
    step.receiveShadow = true;
    standGroup.add(step);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(29, 0.4, 10), standRoofMat);
  roof.position.set(0, 7.2, -3.5);
  roof.rotation.x = 0.12;
  standGroup.add(roof);

  const standSample = samples[16];
  standGroup.position.set(
    standSample.point.x - standSample.right.x * (halfW + 10.5),
    standSample.point.y,
    standSample.point.z - standSample.right.z * (halfW + 10.5),
  );
  standGroup.rotation.y = Math.atan2(-standSample.tangent.x, -standSample.tangent.z) + Math.PI;
  group.add(standGroup);
  disposables.push(tierGeo, standBaseMat, standSeatMat, standRoofMat);

  // 4. Boost Pads on Track
  const boostTex = createBoostPadTexture(maxAnisotropy);
  const boostMat = new THREE.MeshStandardMaterial({
    map: boostTex,
    emissive: 0xf59e0b,
    emissiveMap: boostTex,
    emissiveIntensity: 0.65,
    roughness: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const boostGeo = new THREE.PlaneGeometry(3.8, 9.5);
  boostGeo.rotateX(-Math.PI / 2);

  const boostPadWorldPositions: { x: number; y: number; z: number; s: number; lateral: number }[] = [];
  track.config.boostPads.forEach((pad) => {
    const idx = Math.floor(pad.s * n) % n;
    const smp = samples[idx];
    const latDist = pad.lateral * halfW;
    const bx = smp.point.x + smp.right.x * latDist;
    const by = smp.point.y + 0.035;
    const bz = smp.point.z + smp.right.z * latDist;
    const mesh = new THREE.Mesh(boostGeo, boostMat);
    mesh.position.set(bx, by, bz);
    mesh.rotation.y = Math.atan2(-smp.tangent.x, -smp.tangent.z);
    group.add(mesh);
    boostPadWorldPositions.push({ x: bx, y: by, z: bz, s: pad.s, lateral: latDist });
  });
  disposables.push(boostGeo, boostTex, boostMat);

  // 5. Extended Sculpted Terrain Mesh (1300m x 1300m)
  const terrainGeo = new THREE.PlaneGeometry(1300, 1300, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    posAttr.setY(i, getTerrainHeight(x, z, track));
  }
  posAttr.needsUpdate = true;
  terrainGeo.computeVertexNormals();

  const terrainTex = createTerrainTexture(
    track.config.groundBaseColor,
    track.config.groundDetailColor,
    maxAnisotropy,
  );
  const terrainMat = new THREE.MeshStandardMaterial({
    map: terrainTex,
    roughness: 0.94,
    metalness: 0.0,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
  disposables.push(terrainGeo, terrainTex, terrainMat);

  // Optional Coastal Ocean Plane
  if (track.config.hasOcean) {
    const oceanGeo = new THREE.PlaneGeometry(2400, 2400);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.14,
      metalness: 0.42,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.y = -0.5;
    group.add(ocean);
    disposables.push(oceanGeo, oceanMat);
  }

  // 6. Instanced Scenery Props (Trees for Coastal, Sandstone Boulders/Saguaro for Canyon)
  const propCount = 260;
  const trunkGeo =
    track.config.sceneryStyle === 'coastal'
      ? new THREE.CylinderGeometry(0.28, 0.42, 3.2, 7)
      : new THREE.DodecahedronGeometry(2.6, 0);
  const canopyGeo =
    track.config.sceneryStyle === 'coastal'
      ? new THREE.ConeGeometry(2.3, 6.8, 7)
      : new THREE.CylinderGeometry(0.32, 0.36, 4.8, 7);

  trunkGeo.translate(0, track.config.sceneryStyle === 'coastal' ? 1.6 : 1.3, 0);
  canopyGeo.translate(0, track.config.sceneryStyle === 'coastal' ? 5.6 : 2.4, 0);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: track.config.sceneryStyle === 'coastal' ? 0x5c4033 : 0xa15538,
    roughness: 0.9,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: track.config.sceneryStyle === 'coastal' ? 0x2f6b3c : 0x4d7c46,
    roughness: 0.82,
  });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, propCount);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, propCount);
  trunkInst.castShadow = true;
  canopyInst.castShadow = true;

  let placed = 0;
  let attempts = 0;
  const color = new THREE.Color();

  // Deterministic pseudo-random helper so tracks look curated & consistent
  let seed = track.config.id === 'coastal' ? 1337 : 4242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  while (placed < propCount && attempts < 2200) {
    attempts++;
    const x = (rand() - 0.5) * 900;
    const z = (rand() - 0.5) * 900;

    // Ensure safe distance from every track sample
    let minTrackDistSq = Infinity;
    for (let i = 0; i < n; i += 4) {
      const p = samples[i].point;
      const dx = x - p.x;
      const dz = z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minTrackDistSq) minTrackDistSq = dSq;
    }
    if (minTrackDistSq < 34 * 34) continue;

    const y = getTerrainHeight(x, z, track);
    if (track.config.hasOcean && y < 0.2) continue;

    const scale = 0.85 + rand() * 0.45;
    dummy.position.set(x, y - 0.15, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale * (0.9 + rand() * 0.3), scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(placed, dummy.matrix);

    if (track.config.sceneryStyle === 'canyon') {
      // Offset cactus slightly from boulder
      dummy.position.set(x + 2.8, y - 0.1, z - 1.8);
      dummy.scale.setScalar(0.85 + rand() * 0.35);
      dummy.updateMatrix();
    }
    canopyInst.setMatrixAt(placed, dummy.matrix);

    if (track.config.sceneryStyle === 'coastal') {
      color.setHSL(0.32 + (rand() - 0.5) * 0.05, 0.42, 0.26 + rand() * 0.1);
    } else {
      color.setHSL(0.30 + (rand() - 0.5) * 0.04, 0.35, 0.34 + rand() * 0.08);
    }
    canopyInst.setColorAt(placed, color);
    placed++;
  }

  trunkInst.count = placed;
  canopyInst.count = placed;
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();

  group.add(trunkInst, canopyInst);
  disposables.push(trunkGeo, canopyGeo, trunkMat, canopyMat);

  return {
    group,
    gantryLights,
    boostPadWorldPositions,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
