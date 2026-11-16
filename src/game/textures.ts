import * as THREE from 'three';

export function createAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark tarmac
  ctx.fillStyle = '#252932';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle racing groove wear in lanes
  const groove = ctx.createLinearGradient(0, 0, 512, 0);
  groove.addColorStop(0, 'rgba(18, 20, 26, 0.28)');
  groove.addColorStop(0.22, 'rgba(15, 17, 22, 0.42)');
  groove.addColorStop(0.5, 'rgba(30, 34, 42, 0.08)');
  groove.addColorStop(0.78, 'rgba(15, 17, 22, 0.42)');
  groove.addColorStop(1, 'rgba(18, 20, 26, 0.28)');
  ctx.fillStyle = groove;
  ctx.fillRect(0, 0, 512, 512);

  // Fine mineral asphalt grain
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 26 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 6}, 0.35)`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Crisp white outer track boundary lines
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(18, 0, 10, 512);
  ctx.fillRect(484, 0, 10, 512);

  // Subtle dashed center racing line
  ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
  for (let y = 16; y < 512; y += 64) {
    ctx.fillRect(253, y, 6, 32);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCurbTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const stripes = 8;
  const stripeH = 512 / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f1f5f9';
    ctx.fillRect(0, i * stripeH, 128, stripeH);
  }

  // Subtle tire scuff weathering
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.fillRect(Math.random() * 128, Math.random() * 512, 3, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createCheckeredTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const cols = 16;
  const rows = 4;
  const w = 512 / cols;
  const h = 128 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(c * w, r * h, w, h);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBoostPadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 512);

  // Glowing side rails
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(10, 0, 12, 512);
  ctx.fillRect(234, 0, 12, 512);

  // Forward chevrons
  for (let y = 40; y < 512; y += 110) {
    ctx.fillStyle = y % 220 === 40 ? '#fbbf24' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(128, y);
    ctx.lineTo(212, y + 60);
    ctx.lineTo(186, y + 76);
    ctx.lineTo(128, y + 34);
    ctx.lineTo(70, y + 76);
    ctx.lineTo(44, y + 60);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createTerrainTexture(
  baseColor: string,
  detailColor: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = detailColor;
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const s = 2 + Math.random() * 5;
    ctx.globalAlpha = 0.25 + Math.random() * 0.25;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 14, 64, 64, 62);
  grad.addColorStop(0, 'rgba(5, 8, 14, 0.72)');
  grad.addColorStop(0.65, 'rgba(5, 8, 14, 0.34)');
  grad.addColorStop(1, 'rgba(5, 8, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSmokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(248, 250, 252, 0.85)');
  grad.addColorStop(0.5, 'rgba(226, 232, 240, 0.4)');
  grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSkyDome(
  topHex: number,
  horizonHex: number,
  sunDirection: [number, number, number],
  sunHex: number,
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1100, 32, 24);
  const sunDir = new THREE.Vector3(...sunDirection).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(topHex) },
      horizonColor: { value: new THREE.Color(horizonHex) },
      sunColor: { value: new THREE.Color(sunHex) },
      sunDir: { value: sunDir },
    },
    vertexShader: `
      varying vec3 vWorldDirection;
      void main() {
        vWorldDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDirection;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      void main() {
        float h = clamp(vWorldDirection.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
        float sunAmt = max(dot(normalize(vWorldDirection), sunDir), 0.0);
        col += sunColor * (pow(sunAmt, 14.0) * 0.35 + pow(sunAmt, 220.0) * 0.9);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}
