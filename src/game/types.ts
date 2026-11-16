import * as THREE from 'three';

export type TrackId = 'coastal' | 'canyon';

export type GamePhase = 'title' | 'countdown' | 'racing' | 'paused' | 'finished';

export type CameraMode = 'chase' | 'hood' | 'far';

export interface LiveryOption {
  id: string;
  name: string;
  primary: string;
  accent: string;
  hex: number;
  accentHex: number;
}

export const LIVERY_OPTIONS: LiveryOption[] = [
  {
    id: 'rosso',
    name: 'Rosso Corsa',
    primary: '#DC2626',
    accent: '#F8FAFC',
    hex: 0xdc2626,
    accentHex: 0xf8fafc,
  },
  {
    id: 'cobalt',
    name: 'Monaco Cobalt',
    primary: '#0284C7',
    accent: '#F59E0B',
    hex: 0x0284c7,
    accentHex: 0xf59e0b,
  },
  {
    id: 'emerald',
    name: 'British Emerald',
    primary: '#059669',
    accent: '#FDE047',
    hex: 0x059669,
    accentHex: 0xfde047,
  },
  {
    id: 'amber',
    name: 'Solaris Gold',
    primary: '#D97706',
    accent: '#0F172A',
    hex: 0xd97706,
    accentHex: 0x0f172a,
  },
];

export interface TrackSample {
  index: number;
  s: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  normal: THREE.Vector3;
  curvature: number;
  distance: number;
}

export interface BoostPadDef {
  s: number;
  lateral: number; // -1..1 fraction of halfWidth
}

export interface TrackConfig {
  id: TrackId;
  name: string;
  subtitle: string;
  laps: number;
  roadWidth: number;
  controlPoints: [number, number, number][];
  boostPads: BoostPadDef[];
  skyTop: number;
  skyHorizon: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunDirection: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  groundBaseColor: string;
  groundDetailColor: string;
  hasOcean: boolean;
  sceneryStyle: 'coastal' | 'canyon';
}

export interface MiniMapPoint {
  x: number;
  y: number;
}

export interface RacerHudInfo {
  id: string;
  name: string;
  isPlayer: boolean;
  color: string;
  position: number;
  lap: number;
  totalTime: number;
  bestLap: number | null;
  progress: number;
  mapX: number;
  mapY: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  countdownValue: number; // 3, 2, 1, 0 (GO)
  speedKmh: number;
  rpmRatio: number; // 0..1
  gear: number; // 1..6
  nitro: number; // 0..100
  isBoosting: boolean;
  isDrifting: boolean;
  isDrafting: boolean;
  wrongWay: boolean;
  position: number;
  totalCars: number;
  lap: number;
  totalLaps: number;
  raceTime: number;
  currentLapTime: number;
  bestLapTime: number | null;
  topSpeedKmh: number;
  lapBannerText: string | null;
  cameraMode: CameraMode;
  racers: RacerHudInfo[];
  miniMapPath: MiniMapPoint[];
  standings: RacerHudInfo[];
}

export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  nitro: boolean;
}
