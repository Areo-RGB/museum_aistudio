import * as THREE from 'three';

export type CanvasDrawCallback = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

export interface CanvasPanelOptions {
  resolution?: number;
  lit?: boolean;
  transparent?: boolean;
}

interface PanelUserData {
  repaint: () => void;
  disposePanel: () => void;
  disposeOwned: () => void;
}

interface PanelDisposer {
  disposePanel: () => void;
}

function hasPanelDisposer(value: unknown): value is PanelDisposer {
  if (typeof value !== 'object' || value === null || !('disposePanel' in value)) return false;
  return typeof value.disposePanel === 'function';
}

function hasFontReady(value: unknown): value is FontFaceSet {
  if (typeof value !== 'object' || value === null || !('ready' in value)) return false;
  return value.ready instanceof Promise;
}

/** A canvas-backed panel with an owned geometry, material, and texture. */
export function canvasPanel(
  width: number,
  height: number,
  draw: CanvasDrawCallback,
  { resolution = 1024, lit = true, transparent = false }: CanvasPanelOptions = {},
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial> {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = Math.round((resolution * height) / width);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  let disposed = false;
  const paint = (): void => {
    if (disposed) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    draw(context, canvas.width, canvas.height);
    texture.needsUpdate = true;
  };
  paint();

  const fontReady = hasFontReady(document.fonts) ? document.fonts.ready : Promise.resolve();
  void fontReady.then(paint);

  const material = lit
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, transparent: true })
    : new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  const disposePanel = (): void => {
    if (disposed) return;
    disposed = true;
    texture.dispose();
    mesh.geometry.dispose();
    material.dispose();
  };
  const userData: PanelUserData = { repaint: paint, disposePanel, disposeOwned: disposePanel };
  Object.assign(mesh.userData, userData);
  return mesh;
}

export interface SignMeshOptions {
  width: number;
  height: number;
  bg: string;
  fg: string;
  font: string;
  spacing?: number;
}

/** Single line of text on a solid background (EXIT, CINEMA, ...). */
export function signMesh(
  text: string,
  { width, height, bg, fg, font, spacing = 0.1 }: SignMeshOptions,
) {
  return canvasPanel(
    width,
    height,
    (context, canvasWidth, canvasHeight) => {
      context.fillStyle = bg;
      context.fillRect(0, 0, canvasWidth, canvasHeight);
      context.fillStyle = fg;
      context.font = font;
      context.letterSpacing = `${String(spacing)}em`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, canvasWidth / 2, canvasHeight / 2 + 6);
    },
    { lit: false },
  );
}

export interface PeriodLabelOptions {
  width?: number;
  height?: number;
  dark?: boolean;
}

/** Wall text introducing a period, painted onto a transparent panel. */
export function periodLabel(
  period: { label: string; range?: string; count?: number },
  { width = 2.6, height = 1.5, dark = false }: PeriodLabelOptions = {},
) {
  const ink = dark ? '#f8fafc' : '#141923';
  const muted = dark ? 'rgba(248,250,252,0.68)' : 'rgba(20,25,35,0.62)';
  const accent = dark ? '#d4af37' : '#1e56a0';
  const gold = '#d4af37';
  const range = period.range ?? '';
  const count = period.count ?? 0;
  return canvasPanel(width, height, (context, canvasWidth, canvasHeight) => {
    context.textAlign = 'left';
    context.fillStyle = accent;
    context.fillRect(0, canvasHeight * 0.06, canvasWidth * 0.1, canvasHeight * 0.022);
    context.fillStyle = gold;
    context.fillRect(
      canvasWidth * 0.11,
      canvasHeight * 0.06,
      canvasWidth * 0.03,
      canvasHeight * 0.022,
    );
    context.fillStyle = muted;
    context.font = `600 ${String(canvasHeight * 0.068)}px "Outfit", sans-serif`;
    context.letterSpacing = '0.22em';
    context.fillText(range.toUpperCase(), 0, canvasHeight * 0.21);
    context.letterSpacing = '0em';
    context.fillStyle = ink;
    context.font = `600 ${String(canvasHeight * 0.29)}px "Cormorant Garamond", Georgia, serif`;
    context.fillText(period.label, -canvasHeight * 0.01, canvasHeight * 0.52);
    context.fillStyle = muted;
    context.font = `500 ${String(canvasHeight * 0.085)}px "Plus Jakarta Sans", sans-serif`;
    context.fillText(
      `${String(count)} ${count === 1 ? 'work' : 'works'} · Hertha 03 Archive`,
      0,
      canvasHeight * 0.73,
    );
  });
}

export function disposeCanvasPanel(panel: THREE.Object3D): void {
  const data: unknown = panel.userData;
  if (hasPanelDisposer(data)) data.disposePanel();
}
