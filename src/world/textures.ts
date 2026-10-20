import * as THREE from 'three';

export interface WoodFloorTextureOptions {
  size?: number;
  rows?: number;
  anisotropy?: number;
}

export interface WoodFloorTextureSet {
  color: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

/** Procedural oak plank floor, tileable horizontally and vertically. */
export function createWoodFloorTexture({
  size = 2048,
  rows = 8,
  anisotropy = 16,
}: WoodFloorTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  renderWoodFloor(context, size, rows, false);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

/** Matching bump map for tactile plank grooves and wood grain relief. */
export function createWoodFloorBumpTexture({
  size = 2048,
  rows = 8,
  anisotropy = 16,
}: WoodFloorTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  renderWoodFloor(context, size, rows, true);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function renderWoodFloor(
  context: CanvasRenderingContext2D,
  size: number,
  rows: number,
  isBump: boolean,
): void {
  const rowHeight = size / rows;
  const random = mulberry32(7);

  if (isBump) {
    context.fillStyle = '#808080';
    context.fillRect(0, 0, size, size);
  }

  for (let row = 0; row < rows; row += 1) {
    const start = -random() * size * 0.5;
    for (let x = start; x < start + size;) {
      const length = Math.min(size * (0.32 + random() * 0.42), start + size - x);
      const grainSeed = Math.floor(random() * 2 ** 31);
      const toneHue = 26 + random() * 6;
      const toneSat = 22 + random() * 8;
      const toneLight = 32 + random() * 8;

      for (const offsetX of [x, x + size]) {
        if (isBump) {
          drawPlankBump(
            context,
            offsetX,
            row * rowHeight,
            length,
            rowHeight,
            mulberry32(grainSeed),
          );
        } else {
          drawPlankColor(
            context,
            offsetX,
            row * rowHeight,
            length,
            rowHeight,
            toneHue,
            toneSat,
            toneLight,
            mulberry32(grainSeed),
          );
        }
      }
      x += length;
    }
  }
}

function drawPlankColor(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hue: number,
  sat: number,
  light: number,
  random: () => number,
): void {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  // Subtle plank-wide gradient for natural timber curvature
  const grad = context.createLinearGradient(x, y, x, y + height);
  grad.addColorStop(0, `hsl(${String(hue)}, ${String(sat)}%, ${String(light + 1.8)}%)`);
  grad.addColorStop(0.5, `hsl(${String(hue)}, ${String(sat)}%, ${String(light)}%)`);
  grad.addColorStop(1, `hsl(${String(hue)}, ${String(sat)}%, ${String(light - 1.8)}%)`);
  context.fillStyle = grad;
  context.fillRect(x, y, width, height);

  const seed = random() * 1000;
  // High-density organic wood grain lines (primary and secondary frequencies)
  const lineCount = Math.round((height / 1024) * 120);
  for (let index = 0; index < lineCount; index += 1) {
    const grainY = y + (index + 0.5) * (height / lineCount);
    const alpha = 0.03 + random() * 0.08;
    const toneShift = (random() - 0.5) * 10;
    context.strokeStyle = `hsla(${String(hue + toneShift)}, ${String(sat + 8)}%, 14%, ${String(alpha)})`;
    context.lineWidth = 0.8 + random() * 1.5;
    context.beginPath();
    for (let grainX = x; grainX <= x + width; grainX += 8) {
      const wobble =
        Math.sin((grainX + seed) * 0.012 + index * 0.4) * 2.6 +
        Math.sin((grainX + seed * 2) * 0.038) * 1.1 +
        Math.sin((grainX + seed * 3) * 0.09) * 0.35;
      if (grainX === x) context.moveTo(grainX, grainY + wobble);
      else context.lineTo(grainX, grainY + wobble);
    }
    context.stroke();
  }

  // Medullary ray flecks & micro-pores
  const poreCount = Math.round((width * height) / 360);
  context.fillStyle = `hsla(${String(hue)}, ${String(sat + 15)}%, 10%, 0.12)`;
  for (let i = 0; i < poreCount; i += 1) {
    const px = x + random() * width;
    const py = y + random() * height;
    context.fillRect(px, py, 1.8 + random() * 2.2, 0.7);
  }

  // Subtle bevel highlight on top/left
  context.strokeStyle = `hsla(${String(hue)}, ${String(sat)}%, ${String(light + 16)}%, 0.35)`;
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(x + 1, y + height - 1);
  context.lineTo(x + 1, y + 1);
  context.lineTo(x + width - 1, y + 1);
  context.stroke();

  // Dark plank seam and shadow bevel
  context.strokeStyle = 'rgba(18, 10, 4, 0.75)';
  context.lineWidth = 2.4;
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  context.restore();
}

function drawPlankBump(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  random: () => number,
): void {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  // Neutral mid-grey surface
  context.fillStyle = '#828282';
  context.fillRect(x, y, width, height);

  const seed = random() * 1000;
  const lineCount = Math.round((height / 1024) * 100);
  for (let index = 0; index < lineCount; index += 1) {
    const grainY = y + (index + 0.5) * (height / lineCount);
    const dark = random() > 0.45;
    context.strokeStyle = dark ? 'rgba(70, 70, 70, 0.22)' : 'rgba(165, 165, 165, 0.16)';
    context.lineWidth = 0.8 + random() * 1.6;
    context.beginPath();
    for (let grainX = x; grainX <= x + width; grainX += 8) {
      const wobble =
        Math.sin((grainX + seed) * 0.012 + index * 0.4) * 2.6 +
        Math.sin((grainX + seed * 2) * 0.038) * 1.1;
      if (grainX === x) context.moveTo(grainX, grainY + wobble);
      else context.lineTo(grainX, grainY + wobble);
    }
    context.stroke();
  }

  // Deep recessed seam groove
  context.strokeStyle = '#282828';
  context.lineWidth = 3;
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  context.restore();
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CarpetTextureOptions {
  size?: number;
  anisotropy?: number;
}

/** Dark patterned cinema and Hall of Fame championship runner with woven textile fibers. */
export function createCarpetTexture({
  size = 1024,
  anisotropy = 16,
}: CarpetTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  // Deep royal-burgundy stadium lounge velvet base
  context.fillStyle = '#1b0d18';
  context.fillRect(0, 0, size, size);

  // Subtle longitudinal runner sheen
  const sheen = context.createLinearGradient(0, 0, size, 0);
  sheen.addColorStop(0, '#140912');
  sheen.addColorStop(0.12, '#241120');
  sheen.addColorStop(0.5, '#2d1426');
  sheen.addColorStop(0.88, '#241120');
  sheen.addColorStop(1, '#140912');
  context.fillStyle = sheen;
  context.fillRect(0, 0, size, size);

  // Micro-woven wool pile texture
  const random = mulberry32(3);
  const particleCount = size * 36;
  for (let index = 0; index < particleCount; index += 1) {
    const r = random();
    context.fillStyle =
      r > 0.65
        ? 'rgba(185, 145, 90, 0.12)'
        : r > 0.35
          ? 'rgba(8, 4, 10, 0.24)'
          : 'rgba(130, 42, 62, 0.12)';
    const rx = random() * size;
    const ry = random() * size;
    context.fillRect(rx, ry, 1.3, 1.3);
  }

  // Championship gold double side borders along runner edges
  context.fillStyle = 'rgba(212, 175, 55, 0.55)';
  context.fillRect(size * 0.045, 0, size * 0.012, size);
  context.fillRect(size * 0.943, 0, size * 0.012, size);
  context.fillStyle = 'rgba(212, 175, 55, 0.28)';
  context.fillRect(size * 0.07, 0, size * 0.005, size);
  context.fillRect(size * 0.925, 0, size * 0.005, size);

  // Golden jacquard crest diamond repeat
  const divisions = 4;
  const step = size / divisions;
  context.lineWidth = 2.6;
  for (let y = 0; y < divisions; y += 1) {
    for (let x = 0; x < divisions; x += 1) {
      const centerX = (x + 0.5) * step;
      const centerY = (y + 0.5) * step;
      const radius = step * 0.22;

      // Outer gold diamond
      context.strokeStyle = 'rgba(212, 175, 55, 0.44)';
      context.beginPath();
      context.moveTo(centerX, centerY - radius);
      context.lineTo(centerX + radius, centerY);
      context.lineTo(centerX, centerY + radius);
      context.lineTo(centerX - radius, centerY);
      context.closePath();
      context.stroke();

      // Inner diamond accent
      const innerRadius = radius * 0.55;
      context.strokeStyle = 'rgba(238, 204, 120, 0.3)';
      context.beginPath();
      context.moveTo(centerX, centerY - innerRadius);
      context.lineTo(centerX + innerRadius, centerY);
      context.lineTo(centerX, centerY + innerRadius);
      context.lineTo(centerX - innerRadius, centerY);
      context.closePath();
      context.stroke();

      // Center gold rosette dot
      context.fillStyle = 'rgba(242, 210, 140, 0.62)';
      context.beginPath();
      context.arc(centerX, centerY, 2.8, 0, Math.PI * 2);
      context.fill();
    }
  }

  return finishTiling(canvas, anisotropy);
}

export interface VelvetTextureOptions {
  width?: number;
  height?: number;
  folds?: number;
}

/** Vertical folds for velvet curtains with luminous pile sheen. */
export function createVelvetTexture({
  width = 1024,
  height = 128,
  folds = 9,
}: VelvetTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  for (let x = 0; x < width; x += 1) {
    const wave = Math.sin((x / width) * folds * Math.PI * 2);
    const shade = 0.45 + 0.55 * wave ** 2;
    const highlight = Math.max(0, Math.sin((x / width) * folds * Math.PI * 2 + 0.3)) ** 6 * 40;
    const r = Math.min(255, Math.round(145 * shade + highlight));
    const g = Math.min(255, Math.round(20 * shade + highlight * 0.3));
    const b = Math.min(255, Math.round(36 * shade + highlight * 0.4));
    context.fillStyle = `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
    context.fillRect(x, 0, 1, height);
  }
  return finishTiling(canvas, 16);
}

function finishTiling(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
