import * as THREE from 'three';

export interface WoodFloorTextureOptions {
  size?: number;
  rows?: number;
  anisotropy?: number;
}

/** Procedural oak plank floor, tileable horizontally and vertically. */
export function createWoodFloorTexture({
  size = 1024,
  rows = 8,
  anisotropy = 8,
}: WoodFloorTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  const rowHeight = size / rows;
  const random = mulberry32(7);

  for (let row = 0; row < rows; row += 1) {
    const start = -random() * size * 0.5;
    for (let x = start; x < start + size;) {
      const length = Math.min(size * (0.32 + random() * 0.42), start + size - x);
      const color = `hsl(${String(26 + random() * 6)}, ${String(20 + random() * 8)}%, ${String(30 + random() * 9)}%)`;
      const grainSeed = Math.floor(random() * 2 ** 31);
      for (const offsetX of [x, x + size]) {
        drawPlank(
          context,
          offsetX,
          row * rowHeight,
          length,
          rowHeight,
          color,
          mulberry32(grainSeed),
        );
      }
      x += length;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

function drawPlank(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  random: () => number,
): void {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.fillStyle = color;
  context.fillRect(x, y, width, height);

  const seed = random() * 1000;
  for (let index = 0; index < 22; index += 1) {
    const grainY = y + (index + 0.5) * (height / 22);
    context.strokeStyle = `rgba(${String(50 + random() * 30)}, 30, 12, ${String(0.04 + random() * 0.07)})`;
    context.lineWidth = 0.6 + random() * 1.6;
    context.beginPath();
    for (let grainX = x; grainX <= x + width; grainX += 16) {
      const wobble =
        Math.sin((grainX + seed) * 0.012 + index) * 2.2 +
        Math.sin((grainX + seed * 2) * 0.041) * 0.8;
      if (grainX === x) context.moveTo(grainX, grainY + wobble);
      else context.lineTo(grainX, grainY + wobble);
    }
    context.stroke();
  }
  context.strokeStyle = 'rgba(25, 14, 6, 0.55)';
  context.lineWidth = 2;
  context.strokeRect(x + 1, y + 1, width - 2, height - 2);
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

/** Dark patterned cinema carpet. */
export function createCarpetTexture({
  size = 512,
  anisotropy = 8,
}: CarpetTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.fillStyle = '#2b1117';
  context.fillRect(0, 0, size, size);
  const random = mulberry32(3);
  for (let index = 0; index < 9000; index += 1) {
    context.fillStyle = random() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(120,50,60,0.12)';
    context.fillRect(random() * size, random() * size, 1.5, 1.5);
  }
  const step = size / 4;
  context.strokeStyle = 'rgba(196, 150, 90, 0.28)';
  context.lineWidth = 2;
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      const centerX = (x + 0.5) * step;
      const centerY = (y + 0.5) * step;
      const radius = step * 0.18;
      context.beginPath();
      context.moveTo(centerX, centerY - radius);
      context.lineTo(centerX + radius, centerY);
      context.lineTo(centerX, centerY + radius);
      context.lineTo(centerX - radius, centerY);
      context.closePath();
      context.stroke();
    }
  }
  return finishTiling(canvas, anisotropy);
}

export interface VelvetTextureOptions {
  width?: number;
  height?: number;
  folds?: number;
}

/** Vertical folds for velvet curtains. */
export function createVelvetTexture({
  width = 512,
  height = 64,
  folds = 9,
}: VelvetTextureOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  for (let x = 0; x < width; x += 1) {
    const shade = 0.55 + 0.45 * Math.sin((x / width) * folds * Math.PI * 2) ** 2;
    context.fillStyle = `rgb(${String(Math.round(120 * shade))}, ${String(
      Math.round(16 * shade),
    )}, ${String(Math.round(28 * shade))})`;
    context.fillRect(x, 0, 1, height);
  }
  return finishTiling(canvas, 4);
}

function finishTiling(canvas: HTMLCanvasElement, anisotropy: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}
