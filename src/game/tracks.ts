import * as THREE from 'three';
import { MiniMapPoint, TrackConfig, TrackId, TrackSample } from './types';

export const TRACK_CONFIGS: Record<TrackId, TrackConfig> = {
  coastal: {
    id: 'coastal',
    name: 'Costa Del Sol GP',
    subtitle: 'Sunlit Mediterranean Harbor Circuit',
    laps: 3,
    roadWidth: 18,
    controlPoints: [
      [0, 4, 240],
      [155, 4, 240],
      [255, 8, 170],
      [268, 14, 45],
      [175, 16, -45],
      [228, 12, -165],
      [115, 8, -245],
      [-45, 5, -220],
      [-190, 4, -240],
      [-275, 7, -135],
      [-185, 9, -15],
      [-248, 6, 110],
      [-155, 4, 228],
    ],
    boostPads: [
      { s: 0.08, lateral: -0.3 },
      { s: 0.48, lateral: 0.25 },
      { s: 0.78, lateral: -0.2 },
    ],
    skyTop: 0x2563eb,
    skyHorizon: 0xf4cfa4,
    fogColor: 0xebd3b8,
    fogDensity: 0.00145,
    sunColor: 0xfff1d6,
    sunDirection: [120, 85, -90],
    hemiSky: 0x9bd0ff,
    hemiGround: 0x4b5c43,
    groundBaseColor: '#486b42',
    groundDetailColor: '#668754',
    hasOcean: true,
    sceneryStyle: 'coastal',
  },
  canyon: {
    id: 'canyon',
    name: 'Redrock Canyon',
    subtitle: 'High-Speed Desert Mesa Circuit',
    laps: 3,
    roadWidth: 18,
    controlPoints: [
      [0, 6, 255],
      [185, 6, 255],
      [295, 10, 155],
      [270, 17, -10],
      [140, 14, -75],
      [198, 10, -205],
      [58, 8, -262],
      [-110, 12, -235],
      [-262, 16, -152],
      [-285, 9, 10],
      [-192, 6, 125],
      [-158, 6, 240],
    ],
    boostPads: [
      { s: 0.09, lateral: 0.3 },
      { s: 0.43, lateral: -0.25 },
      { s: 0.85, lateral: 0.0 },
    ],
    skyTop: 0x1d4ed8,
    skyHorizon: 0xf2b580,
    fogColor: 0xe6b88e,
    fogDensity: 0.00155,
    sunColor: 0xffe4bd,
    sunDirection: [-140, 75, -100],
    hemiSky: 0x9ec5f8,
    hemiGround: 0x8f4e32,
    groundBaseColor: '#9c5638',
    groundDetailColor: '#b9714b',
    hasOcean: false,
    sceneryStyle: 'canyon',
  },
};

export interface BuiltTrackData {
  config: TrackConfig;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  totalLength: number;
  miniMapPath: MiniMapPoint[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const SAMPLE_COUNT = 720;

export function buildTrackData(trackId: TrackId): BuiltTrackData {
  const config = TRACK_CONFIGS[trackId];
  const vectors = config.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vectors, true, 'catmullrom', 0.45);
  const totalLength = curve.getLength();

  const samples: TrackSample[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const s = i / SAMPLE_COUNT;
    const point = curve.getPointAt(s);
    const tangent = curve.getTangentAt(s).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();

    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);

    samples.push({
      index: i,
      s,
      point,
      tangent,
      right,
      normal,
      curvature: 0,
      distance: s * totalLength,
    });
  }

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const prev = samples[(i - 4 + SAMPLE_COUNT) % SAMPLE_COUNT];
    const next = samples[(i + 4) % SAMPLE_COUNT];
    const angle = prev.tangent.angleTo(next.tangent);
    const crossY = prev.tangent.x * next.tangent.z - prev.tangent.z * next.tangent.x;
    samples[i].curvature = (crossY >= 0 ? 1 : -1) * angle;
  }

  // Normalized 0..100 minimap path
  const pad = 35;
  const spanX = maxX - minX + pad * 2;
  const spanZ = maxZ - minZ + pad * 2;
  const scale = Math.max(spanX, spanZ);
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  const miniMapPath: MiniMapPoint[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i += 6) {
    const p = samples[i].point;
    miniMapPath.push({
      x: ((p.x - cx) / scale) * 86 + 50,
      y: ((p.z - cz) / scale) * 86 + 50,
    });
  }

  return {
    config,
    curve,
    samples,
    totalLength,
    miniMapPath,
    bounds: { minX, maxX, minZ, maxZ },
  };
}

export function worldToMiniMap(
  x: number,
  z: number,
  bounds: BuiltTrackData['bounds'],
): MiniMapPoint {
  const pad = 35;
  const spanX = bounds.maxX - bounds.minX + pad * 2;
  const spanZ = bounds.maxZ - bounds.minZ + pad * 2;
  const scale = Math.max(spanX, spanZ);
  const cx = (bounds.minX + bounds.maxX) * 0.5;
  const cz = (bounds.minZ + bounds.maxZ) * 0.5;
  return {
    x: ((x - cx) / scale) * 86 + 50,
    y: ((z - cz) / scale) * 86 + 50,
  };
}

export interface TrackProjection {
  sampleIndex: number;
  s: number;
  trackY: number;
  lateralOffset: number; // positive = right side
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  curvature: number;
  centerPoint: THREE.Vector3;
}

const _tmpDiff = new THREE.Vector3();

export function projectOntoTrack(
  x: number,
  z: number,
  track: BuiltTrackData,
  hintIndex?: number,
): TrackProjection {
  const samples = track.samples;
  const n = samples.length;
  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintIndex !== undefined && hintIndex >= 0 && hintIndex < n) {
    const window = 36;
    for (let offset = -window; offset <= window; offset++) {
      const idx = (hintIndex + offset + n) % n;
      const p = samples[idx].point;
      const dx = x - p.x;
      const dz = z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
    // Fallback global search if car jumped far away
    if (bestDistSq > 1600) {
      for (let i = 0; i < n; i++) {
        const p = samples[i].point;
        const dx = x - p.x;
        const dz = z - p.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const p = samples[i].point;
      const dx = x - p.x;
      const dz = z - p.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
  }

  const s0 = samples[bestIdx];
  _tmpDiff.set(x - s0.point.x, 0, z - s0.point.z);
  const along = _tmpDiff.dot(s0.tangent);
  const stepLen = track.totalLength / n;
  const frac = THREE.MathUtils.clamp(along / stepLen, -0.5, 0.5);

  let s = (bestIdx + frac) / n;
  if (s < 0) s += 1;
  if (s >= 1) s -= 1;

  const neighborIdx = frac >= 0 ? (bestIdx + 1) % n : (bestIdx - 1 + n) % n;
  const alpha = Math.abs(frac);
  const s1 = samples[neighborIdx];

  const trackY = THREE.MathUtils.lerp(s0.point.y, s1.point.y, alpha);
  const lateralOffset = _tmpDiff.dot(s0.right);

  return {
    sampleIndex: bestIdx,
    s,
    trackY,
    lateralOffset,
    tangent: s0.tangent,
    right: s0.right,
    curvature: s0.curvature,
    centerPoint: s0.point,
  };
}

export function getTerrainHeight(x: number, z: number, track: BuiltTrackData): number {
  const samples = track.samples;
  let minDistSq = Infinity;
  let nearestY = 4;

  // Coarse step 4 then refine for fast terrain mesh sculpting
  let coarseBest = 0;
  for (let i = 0; i < samples.length; i += 4) {
    const p = samples[i].point;
    const dx = x - p.x;
    const dz = z - p.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      coarseBest = i;
      nearestY = p.y;
    }
  }
  for (let offset = -3; offset <= 3; offset++) {
    const idx = (coarseBest + offset + samples.length) % samples.length;
    const p = samples[idx].point;
    const dx = x - p.x;
    const dz = z - p.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      nearestY = p.y;
    }
  }

  const dist = Math.sqrt(minDistSq);
  const roadBedY = nearestY - 0.32;
  const shoulder = track.config.roadWidth * 0.5 + 5.5;

  if (dist <= shoulder) {
    return roadBedY;
  }

  const blend = THREE.MathUtils.smoothstep(dist, shoulder, shoulder + 34);

  let naturalY = 0;
  if (track.config.sceneryStyle === 'coastal') {
    const hill =
      Math.sin(x * 0.014) * Math.cos(z * 0.015) * 14 +
      Math.sin(x * 0.032 + 1.2) * Math.sin(z * 0.028) * 6 +
      10;
    // Lower toward ocean bay in southern/eastern distance
    const seaFactor = THREE.MathUtils.smoothstep(z, 290, 440);
    naturalY = THREE.MathUtils.lerp(hill, -3.5, seaFactor);
  } else {
    // Redrock canyon plateaus & mesas
    const wave =
      Math.sin(x * 0.013 + 0.7) * Math.cos(z * 0.012) * 18 +
      Math.sin(x * 0.029) * Math.sin(z * 0.031 + 0.5) * 7 +
      13;
    const mesa = wave > 17 ? wave + (wave - 17) * 1.6 : wave;
    naturalY = mesa;
  }

  return THREE.MathUtils.lerp(roadBedY, naturalY, blend);
}
