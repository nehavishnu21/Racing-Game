import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RacingAudio } from './audio';
import { CarRig, createRaceCar } from './carModel';
import { createContactShadowTexture, createSkyDome, createSmokeTexture } from './textures';
import { BuiltTrackVisuals, buildTrackVisuals } from './trackBuilder';
import {
  buildTrackData,
  BuiltTrackData,
  projectOntoTrack,
  worldToMiniMap,
} from './tracks';
import {
  CameraMode,
  GamePhase,
  HudSnapshot,
  InputState,
  LIVERY_OPTIONS,
  RacerHudInfo,
  TrackId,
} from './types';

const AI_PROFILES = [
  { name: 'L. Rossi', color: '#E11D48', hex: 0xe11d48, accentHex: 0xfef08a, baseSkill: 0.96, lane: -2.4 },
  { name: 'K. Takahashi', color: '#0EA5E9', hex: 0x0ea5e9, accentHex: 0xffffff, baseSkill: 0.94, lane: 2.2 },
  { name: 'M. Vance', color: '#8B5CF6', hex: 0x8b5cf6, accentHex: 0x38bdf8, baseSkill: 0.91, lane: -1.1 },
  { name: 'E. Lindqvist', color: '#10B981', hex: 0x10b981, accentHex: 0xfde047, baseSkill: 0.89, lane: 2.8 },
  { name: 'S. Moreau', color: '#F97316', hex: 0xf97316, accentHex: 0x0f172a, baseSkill: 0.86, lane: 0.4 },
];

interface CarEntity {
  id: string;
  name: string;
  isPlayer: boolean;
  color: string;
  rig: CarRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  steerAngle: number;
  rollAngle: number;
  pitchAngle: number;
  wheelSpin: number;
  nitro: number;
  boostTimer: number;
  padCooldown: number;
  hitFlashTimer: number;
  sampleIndex: number;
  s: number;
  lateralOffset: number;
  lap: number;
  checkpoint1: boolean;
  checkpoint2: boolean;
  totalProgress: number;
  lapStartTime: number;
  bestLapTime: number | null;
  finished: boolean;
  finishTime: number;
  skill: number;
  preferredLane: number;
  laneOffset: number;
  positionRank: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

// Reusable scratch vectors (zero GC allocations inside render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

export class RacingEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private audio = new RacingAudio();

  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private skyDome: THREE.Mesh | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private trackId: TrackId = 'coastal';
  private liveryId: string = LIVERY_OPTIONS[0].id;
  private trackData: BuiltTrackData;
  private trackVisuals: BuiltTrackVisuals;

  private contactShadowTex: THREE.Texture;
  private smokeTex: THREE.Texture;
  private particles: Particle[] = [];
  private particleGeo: THREE.PlaneGeometry;

  private cars: CarEntity[] = [];
  private playerCar!: CarEntity;

  private phase: GamePhase = 'title';
  private cameraMode: CameraMode = 'chase';
  private countdownTimer = 0;
  private lastCountdownBeep = 4;
  private raceTime = 0;
  private topSpeedKmh = 0;
  private lapBannerText: string | null = null;
  private lapBannerTimer = 0;

  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private smokeEmitAccum = 0;
  private titlePanAngle = 0;

  private input: InputState = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    nitro: false,
  };

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private hudEmitAccum = 0;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private camInitialized = false;
  private currentFov = 64;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snapshot: HudSnapshot) => void,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    // Detect software WebGL via GPU renderer string (never User-Agent)
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(64, aspect, 0.25, 1600);

    // Mandatory Studio Environment Reflection via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // 3-Point Warm/Cool Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0x9bd0ff, 0x4b5c43, 0.72);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 5;
    this.keyLight.shadow.camera.far = 260;
    const d = 75;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.03;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0xbae6fd, 0.65);
    this.rimLight.position.set(-80, 45, 90);
    this.scene.add(this.rimLight);

    this.contactShadowTex = createContactShadowTexture();
    this.smokeTex = createSmokeTexture();
    this.particleGeo = new THREE.PlaneGeometry(1, 1);
    this.initParticlePool();

    this.trackData = buildTrackData(this.trackId);
    this.trackVisuals = buildTrackVisuals(
      this.trackData,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.applyTrackEnvironment();
    this.scene.add(this.trackVisuals.group);

    this.spawnGridCars();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHudSnapshot();
    this.lastTime = performance.now();
    this.startLoop();
  }

  private initParticlePool(): void {
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.smokeTex,
        color: 0xf8fafc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 0.6,
        startScale: 0.6,
        endScale: 2.2,
        mesh,
        mat,
      });
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    startScale: number,
    endScale: number,
    maxAge: number,
  ): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.age = 0;
        p.maxAge = maxAge;
        p.startScale = startScale;
        p.endScale = endScale;
        p.mat.color.setHex(colorHex);
        p.mat.opacity = 0.75;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(startScale);
        p.mesh.visible = true;
        return;
      }
    }
  }

  private applyTrackEnvironment(): void {
    const cfg = this.trackData.config;
    if (this.skyDome) {
      this.scene.remove(this.skyDome);
      this.skyDome.geometry.dispose();
      (this.skyDome.material as THREE.Material).dispose();
    }
    this.skyDome = createSkyDome(cfg.skyTop, cfg.skyHorizon, cfg.sunDirection, cfg.sunColor);
    this.scene.add(this.skyDome);

    this.scene.background = new THREE.Color(cfg.fogColor);
    this.scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);
    this.hemiLight.color.setHex(cfg.hemiSky);
    this.hemiLight.groundColor.setHex(cfg.hemiGround);
    this.keyLight.color.setHex(cfg.sunColor);
  }

  private spawnGridCars(): void {
    // Clear existing car meshes
    for (const c of this.cars) {
      this.scene.remove(c.rig.root);
    }
    this.cars = [];

    const playerLivery =
      LIVERY_OPTIONS.find((l) => l.id === this.liveryId) || LIVERY_OPTIONS[0];

    // 6-car staggered starting grid just behind Start/Finish line
    // Player starts at P5 (index 4) for exciting overtaking right off the line
    const gridSlots = [
      { s: 0.990, lateral: -3.2 },
      { s: 0.984, lateral: 3.2 },
      { s: 0.978, lateral: -3.2 },
      { s: 0.972, lateral: 3.2 },
      { s: 0.966, lateral: -3.2 }, // Player slot P5
      { s: 0.960, lateral: 3.2 },
    ];

    const samples = this.trackData.samples;
    const n = samples.length;

    let aiIdx = 0;
    for (let slot = 0; slot < 6; slot++) {
      const isPlayer = slot === 4;
      const g = gridSlots[slot];
      const idx = Math.floor(g.s * n) % n;
      const smp = samples[idx];
      const yaw = Math.atan2(-smp.tangent.x, -smp.tangent.z);

      const wx = smp.point.x + smp.right.x * g.lateral;
      const wy = smp.point.y;
      const wz = smp.point.z + smp.right.z * g.lateral;

      let rig: CarRig;
      let id: string;
      let name: string;
      let color: string;
      let skill = 1.0;
      let preferredLane = 0;

      if (isPlayer) {
        rig = createRaceCar(playerLivery.hex, playerLivery.accentHex, this.contactShadowTex);
        id = 'player';
        name = 'You';
        color = playerLivery.primary;
      } else {
        const ai = AI_PROFILES[aiIdx++];
        rig = createRaceCar(ai.hex, ai.accentHex, this.contactShadowTex);
        id = `ai-${aiIdx}`;
        name = ai.name;
        color = ai.color;
        skill = ai.baseSkill;
        preferredLane = ai.lane;
      }

      rig.root.position.set(wx, wy, wz);
      rig.root.rotation.set(0, yaw, 0);
      this.scene.add(rig.root);

      const entity: CarEntity = {
        id,
        name,
        isPlayer,
        color,
        rig,
        x: wx,
        y: wy,
        z: wz,
        vx: 0,
        vz: 0,
        yaw,
        steerAngle: 0,
        rollAngle: 0,
        pitchAngle: 0,
        wheelSpin: 0,
        nitro: 65,
        boostTimer: 0,
        padCooldown: 0,
        hitFlashTimer: 0,
        sampleIndex: idx,
        s: g.s,
        lateralOffset: g.lateral,
        lap: 1,
        checkpoint1: false,
        checkpoint2: false,
        totalProgress: g.s - 1, // Behind start line
        lapStartTime: 0,
        bestLapTime: null,
        finished: false,
        finishTime: 0,
        skill,
        preferredLane,
        laneOffset: g.lateral,
        positionRank: slot + 1,
      };

      this.cars.push(entity);
      if (isPlayer) this.playerCar = entity;
    }
    this.camInitialized = false;
  }

  public setTrack(trackId: TrackId): void {
    if (this.trackId === trackId) return;
    this.trackId = trackId;
    this.scene.remove(this.trackVisuals.group);
    this.trackVisuals.dispose();

    this.trackData = buildTrackData(trackId);
    this.trackVisuals = buildTrackVisuals(
      this.trackData,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.applyTrackEnvironment();
    this.scene.add(this.trackVisuals.group);
    this.spawnGridCars();
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.emitHudSnapshot();
  }

  public setLivery(liveryId: string): void {
    if (this.liveryId === liveryId) return;
    this.liveryId = liveryId;
    if (this.phase === 'title') {
      this.spawnGridCars();
      this.emitHudSnapshot();
    }
  }

  public startRace(): void {
    this.audio.unlock();
    this.spawnGridCars();
    this.phase = 'countdown';
    this.countdownTimer = 3.4;
    this.lastCountdownBeep = 4;
    this.raceTime = 0;
    this.topSpeedKmh = 0;
    this.lapBannerText = null;
    this.lapBannerTimer = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.updateGantryLights(3);
    this.emitHudSnapshot();
  }

  public togglePause(): void {
    if (this.phase === 'racing' || this.phase === 'countdown') {
      this.phase = 'paused';
      this.audio.updateTelemetry(false, 0, false, 0, false);
      this.emitHudSnapshot();
    } else if (this.phase === 'paused') {
      this.phase = this.countdownTimer > 0 ? 'countdown' : 'racing';
      this.lastTime = performance.now();
      this.emitHudSnapshot();
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.audio.updateTelemetry(false, 0, false, 0, false);
    this.spawnGridCars();
    this.updateGantryLights(-1);
    this.emitHudSnapshot();
  }

  public cycleCamera(): CameraMode {
    const order: CameraMode[] = ['chase', 'far', 'hood'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    this.emitHudSnapshot();
    return next;
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public setTouchInput(key: keyof InputState, pressed: boolean): void {
    this.audio.unlock();
    this.input[key] = pressed;
  }

  private updateGantryLights(stage: number): void {
    // stage 3 -> 3 red, 2 -> 4 red, 1 -> 5 red, 0 -> all green, -1 -> off
    const lights = this.trackVisuals.gantryLights;
    for (let i = 0; i < lights.length; i++) {
      const m = lights[i];
      if (stage < 0) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      } else if (stage === 0) {
        m.emissive.setHex(0x22c55e);
        m.emissiveIntensity = 2.6;
      } else {
        const litCount = 6 - stage; // 3->3, 2->4, 1->5
        if (i < litCount) {
          m.emissive.setHex(0xef4444);
          m.emissiveIntensity = 2.4;
        } else {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        }
      }
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private handleContextRestored = (): void => {
    this.renderer.compile(this.scene, this.camera);
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleWindowBlur = (): void => {
    this.input.throttle = false;
    this.input.brake = false;
    this.input.left = false;
    this.input.right = false;
    this.input.drift = false;
    this.input.nitro = false;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW') this.input.throttle = true;
    if (code === 'ArrowDown' || code === 'KeyS') this.input.brake = true;
    if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') this.input.right = true;
    if (code === 'Space') {
      if (this.phase === 'racing' || this.phase === 'countdown') {
        e.preventDefault();
      }
      this.input.drift = true;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.nitro = true;

    if (!e.repeat) {
      if (code === 'KeyC' && (this.phase === 'racing' || this.phase === 'countdown')) {
        this.cycleCamera();
      }
      if (code === 'Escape') {
        if (this.phase === 'racing' || this.phase === 'countdown' || this.phase === 'paused') {
          this.togglePause();
        }
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW') this.input.throttle = false;
    if (code === 'ArrowDown' || code === 'KeyS') this.input.brake = false;
    if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') this.input.right = false;
    if (code === 'Space') this.input.drift = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.nitro = false;
  };

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.step(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private step(dt: number): void {
    if (this.phase === 'paused') {
      return;
    }

    if (this.lapBannerTimer > 0) {
      this.lapBannerTimer -= dt;
      if (this.lapBannerTimer <= 0) this.lapBannerText = null;
    }

    // Hitstop freeze on heavy collisions (30-60ms)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.35);
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'title') {
      this.titlePanAngle += dt * 0.22;
      // Let AI cars run a smooth demo lap behind the title screen
      for (const car of this.cars) {
        this.stepAiCar(car, dt, true);
      }
      this.resolveCarCollisions();
      this.updateParticles(dt);
      this.updateCamera(dt);
      this.updateShadowFollow(this.cars[0]);
      return;
    }

    if (this.phase === 'countdown') {
      this.countdownTimer -= dt;
      const countInt = Math.ceil(this.countdownTimer);
      if (countInt < this.lastCountdownBeep && countInt >= 1 && countInt <= 3) {
        this.lastCountdownBeep = countInt;
        this.updateGantryLights(countInt);
        this.audio.playCountdownBeep(false);
      }
      if (this.countdownTimer <= 0) {
        this.phase = 'racing';
        this.updateGantryLights(0);
        this.audio.playCountdownBeep(true);
        this.lapBannerText = 'GO!';
        this.lapBannerTimer = 1.1;
      } else {
        // Allow revving engine during countdown
        const revRatio = this.input.throttle ? 0.68 : 0.15;
        this.audio.updateTelemetry(true, revRatio, this.input.throttle, 0, false);
        this.updateCamera(dt);
        this.updateShadowFollow(this.playerCar);
        this.hudEmitAccum += dt;
        if (this.hudEmitAccum >= 0.05) {
          this.hudEmitAccum = 0;
          this.emitHudSnapshot();
        }
        return;
      }
    }

    if (this.phase === 'racing' || this.phase === 'finished') {
      if (this.phase === 'racing') {
        this.raceTime += dt;
      }

      const drafting = this.checkPlayerDrafting();

      for (const car of this.cars) {
        if (car.isPlayer && this.phase === 'racing' && !car.finished) {
          this.stepPlayerCar(car, dt, drafting);
        } else {
          this.stepAiCar(car, dt, false);
        }
        this.updateCarProgressAndLaps(car);
      }

      this.resolveCarCollisions();
      this.rankPositions();
      this.updateParticles(dt);
      this.updateCamera(dt);
      this.updateShadowFollow(this.playerCar);

      // Update Web Audio engine & tire screech
      if (this.phase === 'racing') {
        const speed = Math.hypot(this.playerCar.vx, this.playerCar.vz);
        const kmh = speed * 3.6;
        if (kmh > this.topSpeedKmh) this.topSpeedKmh = kmh;
        const gear = Math.min(6, Math.max(1, Math.floor(kmh / 46) + 1));
        const gearLow = (gear - 1) * 46;
        const rpmRatio = THREE.MathUtils.clamp((kmh - gearLow) / 52 + 0.25, 0.18, 1.0);
        const fwdX = -Math.sin(this.playerCar.yaw);
        const fwdZ = -Math.cos(this.playerCar.yaw);
        const latSpeed = Math.abs(this.playerCar.vx * (-fwdZ) + this.playerCar.vz * fwdX);
        const driftInt = speed > 8 ? THREE.MathUtils.clamp((latSpeed - 2.5) / 14, 0, 1) : 0;
        const isBoosting = this.playerCar.boostTimer > 0 || (this.input.nitro && this.playerCar.nitro > 1);
        this.audio.updateTelemetry(true, rpmRatio, this.input.throttle, driftInt, isBoosting);
      } else {
        this.audio.updateTelemetry(false, 0, false, 0, false);
      }
    }

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.045) {
      this.hudEmitAccum = 0;
      this.emitHudSnapshot();
    }
  }

  private checkPlayerDrafting(): boolean {
    if (!this.playerCar) return false;
    const pFwdX = -Math.sin(this.playerCar.yaw);
    const pFwdZ = -Math.cos(this.playerCar.yaw);
    for (const other of this.cars) {
      if (other.isPlayer) continue;
      const dx = other.x - this.playerCar.x;
      const dz = other.z - this.playerCar.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 9 && distSq < 580) {
        const dist = Math.sqrt(distSq);
        const dot = (dx * pFwdX + dz * pFwdZ) / dist;
        if (dot > 0.94) return true;
      }
    }
    return false;
  }

  private stepPlayerCar(car: CarEntity, dt: number, isDrafting: boolean): void {
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const rightX = Math.cos(car.yaw);
    const rightZ = -Math.sin(car.yaw);

    const forwardSpeed = car.vx * fwdX + car.vz * fwdZ;
    const lateralSpeed = car.vx * rightX + car.vz * rightZ;

    const usingNitro = this.input.nitro && car.nitro > 1 && this.input.throttle;
    if (usingNitro) {
      car.nitro = Math.max(0, car.nitro - dt * 32);
    } else {
      car.nitro = Math.min(100, car.nitro + dt * (isDrafting ? 7.5 : 2.5));
    }

    if (car.boostTimer > 0) car.boostTimer -= dt;
    if (car.padCooldown > 0) car.padCooldown -= dt;

    const isBoosting = usingNitro || car.boostTimer > 0;
    const maxSpeed = isBoosting ? 85 : isDrafting ? 76 : 70; // m/s (~252 km/h normal, ~306 km/h boost)
    const accelForce = isBoosting ? 46 : 31;

    let newForward = forwardSpeed;
    if (this.input.throttle) {
      newForward += accelForce * dt;
    } else if (this.input.brake) {
      if (forwardSpeed > 2) {
        newForward -= 48 * dt;
      } else {
        newForward -= 18 * dt; // Reverse
      }
    } else {
      // Engine braking
      newForward *= Math.exp(-0.9 * dt);
    }

    // Off-track shoulder drag
    const halfW = this.trackData.config.roadWidth * 0.5;
    const offRoad = Math.abs(car.lateralOffset) > halfW + 0.55;
    if (offRoad) {
      newForward *= Math.exp(-1.7 * dt);
    }

    newForward = THREE.MathUtils.clamp(newForward, -18, maxSpeed);

    // Steering
    const steerInput = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
    const speedFactor = THREE.MathUtils.clamp(Math.abs(newForward) / 14, 0, 1);
    const highSpeedDamp = THREE.MathUtils.lerp(1.0, 0.56, THREE.MathUtils.clamp(Math.abs(newForward) / 72, 0, 1));
    const dirSign = newForward >= -0.5 ? 1 : -1;

    const isDrifting = this.input.drift && Math.abs(newForward) > 18 && Math.abs(steerInput) > 0;
    const turnRate = (isDrifting ? 2.45 : 1.92) * speedFactor * highSpeedDamp;
    car.yaw += steerInput * turnRate * dirSign * dt;

    // Lateral grip (lower when drifting so tail swings out smoothly)
    const lateralGrip = isDrifting ? 4.2 : 10.5;
    const newLateral = lateralSpeed * Math.exp(-lateralGrip * dt);

    if (isDrifting) {
      car.nitro = Math.min(100, car.nitro + dt * 20);
    }

    // Recompute world velocity from new heading
    const nFwdX = -Math.sin(car.yaw);
    const nFwdZ = -Math.cos(car.yaw);
    const nRightX = Math.cos(car.yaw);
    const nRightZ = -Math.sin(car.yaw);

    car.vx = nFwdX * newForward + nRightX * newLateral;
    car.vz = nFwdZ * newForward + nRightZ * newLateral;

    car.x += car.vx * dt;
    car.z += car.vz * dt;

    // Project onto track spline for elevation & barrier constraints
    this.constrainToTrackAndUpdateRig(
      car,
      dt,
      steerInput,
      newForward,
      newLateral,
      this.input.brake,
      isBoosting,
      isDrifting || offRoad,
    );
  }

  private stepAiCar(car: CarEntity, dt: number, isDemoMode: boolean): void {
    const samples = this.trackData.samples;
    const n = samples.length;

    // Look ahead 14 samples along track
    const lookIdx = (car.sampleIndex + 15) % n;
    const lookSample = samples[lookIdx];

    // Smooth lane shifting to avoid cars directly ahead
    let targetLane = car.preferredLane;
    for (const other of this.cars) {
      if (other === car) continue;
      const ds = (other.s - car.s + 1) % 1;
      if (ds > 0 && ds < 0.035 && Math.abs(other.lateralOffset - car.lateralOffset) < 2.8) {
        targetLane = other.lateralOffset > 0 ? -3.4 : 3.4;
        break;
      }
    }
    car.laneOffset = THREE.MathUtils.damp(car.laneOffset, targetLane, 2.5, dt);

    const targetX = lookSample.point.x + lookSample.right.x * car.laneOffset;
    const targetZ = lookSample.point.z + lookSample.right.z * car.laneOffset;

    const toX = targetX - car.x;
    const toZ = targetZ - car.z;
    const desiredYaw = Math.atan2(-toX, -toZ);

    let yawDiff = desiredYaw - car.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    const steerInput = THREE.MathUtils.clamp(yawDiff * 2.1, -1, 1);
    car.yaw += steerInput * 2.25 * dt;

    // Corner speed modulation from upcoming track curvature
    const aheadCurvature = Math.max(
      Math.abs(samples[(car.sampleIndex + 10) % n].curvature),
      Math.abs(samples[(car.sampleIndex + 22) % n].curvature),
    );
    const cornerFactor = THREE.MathUtils.clamp(1.0 - aheadCurvature * 1.4, 0.62, 1.0);

    // Subtle competitive rubber-banding when racing player
    let paceAdjust = 1.0;
    if (!isDemoMode && this.playerCar) {
      const gap = car.totalProgress - this.playerCar.totalProgress;
      if (gap > 0.14) paceAdjust = 0.91;
      else if (gap < -0.14) paceAdjust = 1.06;
    }

    if (car.boostTimer > 0) car.boostTimer -= dt;
    if (car.padCooldown > 0) car.padCooldown -= dt;

    const targetSpeed = (isDemoMode ? 52 : 66 * car.skill * paceAdjust) * cornerFactor + (car.boostTimer > 0 ? 12 : 0);
    const currentSpeed = Math.hypot(car.vx, car.vz);
    const newSpeed = THREE.MathUtils.damp(currentSpeed, targetSpeed, 2.2, dt);

    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    car.vx = fwdX * newSpeed;
    car.vz = fwdZ * newSpeed;

    car.x += car.vx * dt;
    car.z += car.vz * dt;

    this.constrainToTrackAndUpdateRig(
      car,
      dt,
      steerInput,
      newSpeed,
      0,
      newSpeed > targetSpeed + 4,
      car.boostTimer > 0,
      false,
    );
  }

  private constrainToTrackAndUpdateRig(
    car: CarEntity,
    dt: number,
    steerInput: number,
    forwardSpeed: number,
    lateralSpeed: number,
    isBraking: boolean,
    isBoosting: boolean,
    emitSmoke: boolean,
  ): void {
    const proj = projectOntoTrack(car.x, car.z, this.trackData, car.sampleIndex);
    car.sampleIndex = proj.sampleIndex;
    car.s = proj.s;
    car.lateralOffset = proj.lateralOffset;
    car.y = proj.trackY;

    // Barrier collision clamp
    const halfW = this.trackData.config.roadWidth * 0.5;
    const maxLat = halfW + 1.25;
    if (Math.abs(proj.lateralOffset) > maxLat) {
      const sign = Math.sign(proj.lateralOffset);
      const excess = Math.abs(proj.lateralOffset) - maxLat;
      car.x -= proj.right.x * sign * excess;
      car.z -= proj.right.z * sign * excess;
      car.lateralOffset = sign * maxLat;

      // Reflect outward velocity
      const vDotRight = car.vx * proj.right.x + car.vz * proj.right.z;
      if (vDotRight * sign > 0) {
        const impactStrength = Math.abs(vDotRight);
        car.vx -= proj.right.x * vDotRight * 1.45;
        car.vz -= proj.right.z * vDotRight * 1.45;
        car.vx *= 0.86;
        car.vz *= 0.86;

        if (car.isPlayer && impactStrength > 5) {
          this.triggerImpactFeedback(impactStrength / 25, car.x, car.y + 0.5, car.z);
          car.hitFlashTimer = 0.12;
        }
      }
    }

    // Check boost pads
    if (car.padCooldown <= 0) {
      for (const pad of this.trackVisuals.boostPadWorldPositions) {
        const dx = car.x - pad.x;
        const dz = car.z - pad.z;
        if (dx * dx + dz * dz < 16) {
          car.boostTimer = 1.25;
          car.padCooldown = 2.0;
          car.nitro = Math.min(100, car.nitro + 18);
          if (car.isPlayer) {
            this.audio.playBoostPad();
            this.shakeIntensity = Math.max(this.shakeIntensity, 0.18);
          }
          break;
        }
      }
    }

    // Update suspension roll/pitch, front wheel steer & spin
    car.steerAngle = THREE.MathUtils.damp(car.steerAngle, steerInput * 0.36, 14, dt);
    car.rollAngle = THREE.MathUtils.damp(
      car.rollAngle,
      THREE.MathUtils.clamp(-steerInput * (Math.abs(forwardSpeed) / 70) * 0.075, -0.09, 0.09),
      10,
      dt,
    );
    const targetPitch = isBraking ? 0.045 : isBoosting ? -0.042 : 0;
    car.pitchAngle = THREE.MathUtils.damp(car.pitchAngle, targetPitch, 9, dt);
    car.wheelSpin += (forwardSpeed / 0.38) * dt;

    car.rig.root.position.set(car.x, car.y, car.z);
    car.rig.root.rotation.set(0, car.yaw, 0);
    car.rig.bodyPivot.rotation.set(car.pitchAngle, 0, car.rollAngle);

    for (const pivot of car.rig.frontSteerPivots) {
      pivot.rotation.y = car.steerAngle;
    }
    for (const wheel of car.rig.wheels) {
      wheel.rotation.x = -car.wheelSpin;
    }

    // Brake light intensity
    car.rig.brakeMaterial.emissiveIntensity = isBraking ? 3.2 : 0.75;

    // Nitro exhaust flame cones
    car.rig.flameLeft.visible = isBoosting;
    car.rig.flameRight.visible = isBoosting;
    if (isBoosting) {
      const flicker = 0.85 + Math.random() * 0.45;
      car.rig.flameLeft.scale.set(1, 1, flicker);
      car.rig.flameRight.scale.set(1, 1, flicker);
    }

    // Hit flash
    if (car.hitFlashTimer > 0) {
      car.hitFlashTimer -= dt;
      car.rig.bodyMaterial.emissive.setHex(0xffffff);
      car.rig.bodyMaterial.emissiveIntensity = 0.55;
    } else {
      car.rig.bodyMaterial.emissiveIntensity = 0;
    }

    // Emit tire smoke / boost sparks
    if (car.isPlayer && (emitSmoke || Math.abs(lateralSpeed) > 6.5)) {
      this.smokeEmitAccum += dt;
      if (this.smokeEmitAccum >= 0.03) {
        this.smokeEmitAccum = 0;
        const rX = Math.cos(car.yaw);
        const rZ = -Math.sin(car.yaw);
        const bX = Math.sin(car.yaw) * 1.5;
        const bZ = Math.cos(car.yaw) * 1.5;
        this.spawnParticle(
          car.x + bX - rX * 0.9,
          car.y + 0.28,
          car.z + bZ - rZ * 0.9,
          (Math.random() - 0.5) * 1.5,
          1.2 + Math.random(),
          (Math.random() - 0.5) * 1.5,
          0xe2e8f0,
          0.55,
          2.2,
          0.55,
        );
        this.spawnParticle(
          car.x + bX + rX * 0.9,
          car.y + 0.28,
          car.z + bZ + rZ * 0.9,
          (Math.random() - 0.5) * 1.5,
          1.2 + Math.random(),
          (Math.random() - 0.5) * 1.5,
          0xe2e8f0,
          0.55,
          2.2,
          0.55,
        );
      }
    }
  }

  private resolveCarCollisions(): void {
    const minDist = 2.65;
    const minDistSq = minDist * minDist;

    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.0001 && dSq < minDistSq) {
          const dist = Math.sqrt(dSq);
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = (minDist - dist) * 0.5;

          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;

          const relVx = b.vx - a.vx;
          const relVz = b.vz - a.vz;
          const sepVel = relVx * nx + relVz * nz;
          if (sepVel < 0) {
            const impulse = -sepVel * 0.72;
            a.vx -= nx * impulse;
            a.vz -= nz * impulse;
            b.vx += nx * impulse;
            b.vz += nz * impulse;

            if ((a.isPlayer || b.isPlayer) && this.phase === 'racing' && Math.abs(sepVel) > 4.5) {
              this.triggerImpactFeedback(
                Math.abs(sepVel) / 22,
                (a.x + b.x) * 0.5,
                (a.y + b.y) * 0.5 + 0.6,
                (a.z + b.z) * 0.5,
              );
              if (a.isPlayer) a.hitFlashTimer = 0.1;
              if (b.isPlayer) b.hitFlashTimer = 0.1;
            }
          }
        }
      }
    }
  }

  private triggerImpactFeedback(strength: number, wx: number, wy: number, wz: number): void {
    const clamped = THREE.MathUtils.clamp(strength, 0.2, 1.4);
    this.shakeIntensity = Math.max(this.shakeIntensity, clamped * 0.45);
    if (clamped > 0.55) {
      this.hitstopTimer = 0.04; // 40ms simulation hitstop on heavy collision
    }
    this.audio.playImpact(clamped);

    // Burst golden sparks
    for (let i = 0; i < 8; i++) {
      this.spawnParticle(
        wx,
        wy,
        wz,
        (Math.random() - 0.5) * 14,
        2 + Math.random() * 6,
        (Math.random() - 0.5) * 14,
        0xfbbf24,
        0.38,
        0.05,
        0.32,
      );
    }
  }

  private updateCarProgressAndLaps(car: CarEntity): void {
    // Track checkpoints to ensure valid full laps
    if (car.s > 0.28 && car.s < 0.45) car.checkpoint1 = true;
    if (car.s > 0.65 && car.s < 0.82 && car.checkpoint1) car.checkpoint2 = true;

    // Crossed Start/Finish line forward
    if (car.checkpoint1 && car.checkpoint2 && car.s < 0.14) {
      car.checkpoint1 = false;
      car.checkpoint2 = false;

      if (this.phase === 'racing' && !car.finished) {
        const lapDuration = this.raceTime - car.lapStartTime;
        if (car.lapStartTime > 0 || this.raceTime > 5) {
          if (car.bestLapTime === null || lapDuration < car.bestLapTime) {
            car.bestLapTime = lapDuration;
          }
        }
        car.lapStartTime = this.raceTime;

        if (car.lap >= this.trackData.config.laps) {
          car.finished = true;
          car.finishTime = this.raceTime;
          if (car.isPlayer) {
            this.phase = 'finished';
            this.audio.playLapChime(true);
            this.emitHudSnapshot();
          }
        } else {
          car.lap += 1;
          if (car.isPlayer) {
            this.audio.playLapChime(false);
            this.lapBannerText =
              car.lap === this.trackData.config.laps ? 'FINAL LAP' : `LAP ${car.lap}`;
            this.lapBannerTimer = 2.0;
          }
        }
      } else if (this.phase === 'title') {
        car.lap += 1;
      }
    }

    // Handle starting grid behind start line (s ~ 0.96 -> 1.0 before lap 1 starts)
    let effectiveS = car.s;
    if (car.lap === 1 && !car.checkpoint1 && car.s > 0.85) {
      effectiveS = car.s - 1;
    }
    car.totalProgress = car.finished
      ? this.trackData.config.laps + 1000 - car.finishTime * 0.01
      : car.lap - 1 + effectiveS;
  }

  private rankPositions(): void {
    const sorted = [...this.cars].sort((a, b) => b.totalProgress - a.totalProgress);
    sorted.forEach((car, idx) => {
      car.positionRank = idx + 1;
    });
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const t = p.age / p.maxAge;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.quaternion.copy(this.camera.quaternion);
      p.mesh.scale.setScalar(THREE.MathUtils.lerp(p.startScale, p.endScale, t));
      p.mat.opacity = (1 - t) * 0.65;
    }
  }

  private updateShadowFollow(targetCar: CarEntity): void {
    const cfg = this.trackData.config;
    const [sx, sy, sz] = cfg.sunDirection;
    _v1.set(sx, sy, sz).normalize().multiplyScalar(95);
    this.keyLight.position.set(targetCar.x + _v1.x, targetCar.y + _v1.y, targetCar.z + _v1.z);
    this.keyLight.target.position.set(targetCar.x, targetCar.y, targetCar.z);
    this.keyLight.target.updateMatrixWorld();
  }

  private updateCamera(dt: number): void {
    if (this.phase === 'title') {
      const lead = this.cars[0];
      const radius = 14.5;
      const cx = lead.x + Math.cos(this.titlePanAngle) * radius;
      const cz = lead.z + Math.sin(this.titlePanAngle) * radius;
      const cy = lead.y + 4.4;
      _camPos.set(cx, cy, cz);
      _camLook.set(lead.x, lead.y + 1.0, lead.z);
      if (!this.camInitialized) {
        this.camera.position.copy(_camPos);
        this.camInitialized = true;
      } else {
        this.camera.position.lerp(_camPos, 1 - Math.exp(-3.5 * dt));
      }
      this.camera.lookAt(_camLook);
      return;
    }

    const car = this.playerCar;
    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const speed = Math.hypot(car.vx, car.vz);
    const isBoosting = car.boostTimer > 0 || (this.input.nitro && car.nitro > 1 && this.input.throttle);

    // Speed-reactive FOV widening
    const targetFov =
      this.cameraMode === 'hood'
        ? 72 + (speed / 85) * 14 + (isBoosting ? 7 : 0)
        : 62 + (speed / 85) * 12 + (isBoosting ? 8 : 0);
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 7, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    if (this.cameraMode === 'hood') {
      _camPos.set(car.x + fwdX * 0.75, car.y + 1.38, car.z + fwdZ * 0.75);
      _camLook.set(car.x + fwdX * 26, car.y + 1.25, car.z + fwdZ * 26);
      this.camera.position.copy(_camPos);
      this.camera.lookAt(_camLook);
    } else {
      const backDist = this.cameraMode === 'far' ? 10.6 : 7.5;
      const upHeight = this.cameraMode === 'far' ? 4.4 : 2.95;

      _camPos.set(
        car.x - fwdX * backDist,
        car.y + upHeight,
        car.z - fwdZ * backDist,
      );
      _camLook.set(
        car.x + fwdX * 9.5,
        car.y + 1.25,
        car.z + fwdZ * 9.5,
      );

      if (!this.camInitialized) {
        this.camera.position.copy(_camPos);
        this.camInitialized = true;
      } else {
        const dampLambda = 10.5;
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camPos.x, dampLambda, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camPos.y, dampLambda, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camPos.z, dampLambda, dt);
      }

      if (this.shakeIntensity > 0.005) {
        this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.7;
        this.shakeIntensity *= Math.exp(-10 * dt);
      } else {
        this.shakeIntensity = 0;
      }

      this.camera.lookAt(_camLook);
    }
  }

  private emitHudSnapshot(): void {
    const car = this.playerCar;
    const speed = Math.hypot(car.vx, car.vz);
    const speedKmh = Math.round(speed * 3.6);
    const gear = speedKmh < 3 ? 1 : Math.min(6, Math.floor(speedKmh / 46) + 1);
    const gearLow = (gear - 1) * 46;
    const rpmRatio = THREE.MathUtils.clamp((speedKmh - gearLow) / 52 + 0.22, 0.14, 1.0);

    const fwdX = -Math.sin(car.yaw);
    const fwdZ = -Math.cos(car.yaw);
    const smp = this.trackData.samples[car.sampleIndex];
    const dotDir = fwdX * smp.tangent.x + fwdZ * smp.tangent.z;
    const wrongWay = this.phase === 'racing' && speed > 6 && dotDir < -0.35;

    const racers: RacerHudInfo[] = this.cars.map((c) => {
      const mp = worldToMiniMap(c.x, c.z, this.trackData.bounds);
      return {
        id: c.id,
        name: c.name,
        isPlayer: c.isPlayer,
        color: c.color,
        position: c.positionRank,
        lap: c.lap,
        totalTime: c.finished ? c.finishTime : this.raceTime,
        bestLap: c.bestLapTime,
        progress: c.totalProgress,
        mapX: mp.x,
        mapY: mp.y,
      };
    });

    const standings = [...racers].sort((a, b) => a.position - b.position);
    const isBoosting = car.boostTimer > 0 || (this.input.nitro && car.nitro > 1 && this.input.throttle);
    const isDrifting = this.input.drift && speed > 18 && (this.input.left || this.input.right);

    this.onHudUpdate({
      phase: this.phase,
      countdownValue: Math.max(0, Math.ceil(this.countdownTimer)),
      speedKmh,
      rpmRatio,
      gear,
      nitro: Math.round(car.nitro),
      isBoosting,
      isDrifting,
      isDrafting: this.phase === 'racing' && this.checkPlayerDrafting(),
      wrongWay,
      position: car.positionRank,
      totalCars: this.cars.length,
      lap: Math.min(car.lap, this.trackData.config.laps),
      totalLaps: this.trackData.config.laps,
      raceTime: this.raceTime,
      currentLapTime: Math.max(0, this.raceTime - car.lapStartTime),
      bestLapTime: car.bestLapTime,
      topSpeedKmh: Math.round(this.topSpeedKmh),
      lapBannerText: this.lapBannerText,
      cameraMode: this.cameraMode,
      racers,
      miniMapPath: this.trackData.miniMapPath,
      standings,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.audio.dispose();
    this.trackVisuals.dispose();
    this.contactShadowTex.dispose();
    this.smokeTex.dispose();
    this.particleGeo.dispose();
    this.particles.forEach((p) => p.mat.dispose());
    if (this.skyDome) {
      this.skyDome.geometry.dispose();
      (this.skyDome.material as THREE.Material).dispose();
    }
    this.envRT?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
