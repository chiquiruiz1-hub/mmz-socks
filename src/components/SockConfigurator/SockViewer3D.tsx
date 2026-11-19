import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createPortal } from 'react-dom';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Lock, RotateCw, Eye, Sparkles, AlertCircle, RefreshCw, ZoomIn, X } from 'lucide-react';
import { ExtendedSockConfig } from '../../utils/pricing';

interface SockViewer3DProps {
  config: ExtendedSockConfig;
  onSnapshotReady?: (dataUrl: string) => void;
  captureSnapshotRef?: React.MutableRefObject<(() => string | null) | null>;
}

// Target center point of the sock & podium assembly
const TARGET = new THREE.Vector3(0, 0.48, 0);
const CAMERA_DISTANCE = 2.6;
const CAMERA_FOV = 30;
const ELEVATION_ANGLE = 0.20; // ~11.5° elevation for comfortable perspective

// View presets (azimuth around target in radians)
const PRESETS = {
  frente: 2.2,
  lado: 1.2,
  talon: -0.3,
} as const;

type PresetKey = keyof typeof PRESETS;

interface UVBox {
  uCenter: number; // in [0, 1], wraps around 0/1
  vMin: number;
  vMax: number;
  uHalfWidth: number;
}

/**
 * Circular distance in [0, 1] UV wrap space
 */
function uvDistU(u1: number, u2: number): number {
  const diff = Math.abs(((u1 - u2) % 1 + 1) % 1);
  return Math.min(diff, 1 - diff);
}

/**
 * Check if a point (u, v) falls inside any exclusion UVBox (with extra padding)
 */
function isInsideBoxes(u: number, v: number, boxes: UVBox[], padU = 0, padV = 0): boolean {
  for (const b of boxes) {
    if (v >= b.vMin - padV && v <= b.vMax + padV) {
      if (uvDistU(u, b.uCenter) <= b.uHalfWidth + padU) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Draw an element centered at uCenter (wrapping seamlessly across x=0 and x=1024)
 */
function drawWrappedHorizontal(
  uCenter: number,
  drawAtX: (centerX: number) => void
) {
  const normU = ((uCenter % 1) + 1) % 1;
  const mainX = normU * 1024;
  drawAtX(mainX);
  if (mainX < 420) {
    drawAtX(mainX + 1024);
  }
  if (mainX > 1024 - 420) {
    drawAtX(mainX - 1024);
  }
}

/**
 * Draw a pixelated Jacquard circle on a 2D context
 */
function drawPixelatedCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  pixelSize = 6
) {
  ctx.fillStyle = color;
  const rSq = radius * radius;
  const startX = Math.floor((cx - radius) / pixelSize) * pixelSize;
  const endX = Math.ceil((cx + radius) / pixelSize) * pixelSize;
  const startY = Math.floor((cy - radius) / pixelSize) * pixelSize;
  const endY = Math.ceil((cy + radius) / pixelSize) * pixelSize;

  for (let y = startY; y <= endY; y += pixelSize) {
    for (let x = startX; x <= endX; x += pixelSize) {
      const dx = x + pixelSize / 2 - cx;
      const dy = y + pixelSize / 2 - cy;
      if (dx * dx + dy * dy <= rSq) {
        ctx.fillRect(x, y, pixelSize, pixelSize);
      }
    }
  }
}

/**
 * Draw a pixelated Jacquard rounded rectangle on a 2D context
 */
function drawPixelatedRoundedRect(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  cornerRadius: number,
  color: string,
  pixelSize = 6
) {
  ctx.fillStyle = color;
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(cornerRadius, hw, hh);
  const startX = Math.floor((cx - hw) / pixelSize) * pixelSize;
  const endX = Math.ceil((cx + hw) / pixelSize) * pixelSize;
  const startY = Math.floor((cy - hh) / pixelSize) * pixelSize;
  const endY = Math.ceil((cy + hh) / pixelSize) * pixelSize;

  for (let y = startY; y <= endY; y += pixelSize) {
    for (let x = startX; x <= endX; x += pixelSize) {
      const px = Math.abs(x + pixelSize / 2 - cx);
      const py = Math.abs(y + pixelSize / 2 - cy);
      if (px <= hw && py <= hh) {
        if (px <= hw - r || py <= hh - r) {
          ctx.fillRect(x, y, pixelSize, pixelSize);
        } else {
          const dx = px - (hw - r);
          const dy = py - (hh - r);
          if (dx * dx + dy * dy <= r * r) {
            ctx.fillRect(x, y, pixelSize, pixelSize);
          }
        }
      }
    }
  }
}

/**
 * Draw crisp bitmap/pixelated Jacquard text centered at (cx, cy)
 */
function drawPixelatedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  color: string
) {
  const clean = text.trim().slice(0, 14).toUpperCase();
  if (!clean) return;

  // Render on a low-res bitmap grid so each pixel becomes a visible knitted stitch
  const charGridW = 10;
  const gridW = Math.max(44, clean.length * charGridW + 8);
  const gridH = 18;

  const off = document.createElement('canvas');
  off.width = gridW;
  off.height = gridH;
  const offCtx = off.getContext('2d');
  if (!offCtx) return;

  offCtx.clearRect(0, 0, gridW, gridH);
  offCtx.fillStyle = '#ffffff';
  offCtx.font = '900 13px "Courier New", monospace, sans-serif';
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.fillText(clean, gridW / 2, gridH / 2 + 1);

  const imgData = offCtx.getImageData(0, 0, gridW, gridH).data;
  const stitchW = 4; // 4px wide per stitch on 1024 canvas
  const stitchH = 6; // 6px tall per stitch on 1024 canvas
  const totalW = gridW * stitchW;
  const totalH = gridH * stitchH;
  const startX = Math.round(cx - totalW / 2);
  const startY = Math.round(cy - totalH / 2);

  ctx.fillStyle = color;
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const alpha = imgData[(gy * gridW + gx) * 4 + 3];
      if (alpha > 95) {
        ctx.fillRect(
          startX + gx * stitchW,
          startY + gy * stitchH,
          stitchW,
          stitchH
        );
      }
    }
  }
}


// ---------------------------------------------------------------------------
// Logo tejido: 1 aguja = 1 píxel, con un máximo de hilos de color (como en máquina)
// ---------------------------------------------------------------------------
const MACHINE_NEEDLES = 200; // agujas alrededor del calcetín (a confirmar con la fábrica)
const PX_PER_NEEDLE = 1024 / MACHINE_NEEDLES;
const MAX_LOGO_INKS = 5; // máx. 6 tintas por diseño, una la usa el fondo

const knitLogoCache = new Map<string, HTMLCanvasElement>();

function pixelateLogoToInks(
  img: HTMLImageElement,
  cols: number,
  rows: number,
  maxInks: number
): HTMLCanvasElement | null {
  const key = `${img.src.length}:${img.src.slice(-48)}:${cols}x${rows}:${maxInks}`;
  const cached = knitLogoCache.get(key);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = cols;
  c.height = rows;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return null;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, cols, rows);
  const imgData = x.getImageData(0, 0, cols, rows);
  const px = imgData.data;

  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) {
      px[i + 3] = 0;
      continue;
    }
    px[i + 3] = 255;
    const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const b = buckets.get(k);
    if (b) {
      b.n++;
      b.r += px[i];
      b.g += px[i + 1];
      b.b += px[i + 2];
    } else {
      buckets.set(k, { n: 1, r: px[i], g: px[i + 1], b: px[i + 2] });
    }
  }

  const palette: [number, number, number][] = [];
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  for (const b of sorted) {
    const cr = b.r / b.n;
    const cg = b.g / b.n;
    const cb = b.b / b.n;
    const far = palette.every(
      (p) => (p[0] - cr) ** 2 + (p[1] - cg) ** 2 + (p[2] - cb) ** 2 > 55 * 55
    );
    if (far) palette.push([cr, cg, cb]);
    if (palette.length >= maxInks) break;
  }
  if (palette.length === 0) {
    knitLogoCache.set(key, c);
    return c;
  }

  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    let best = 0;
    let bd = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const d =
        (palette[j][0] - px[i]) ** 2 +
        (palette[j][1] - px[i + 1]) ** 2 +
        (palette[j][2] - px[i + 2]) ** 2;
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    px[i] = Math.round(palette[best][0]);
    px[i + 1] = Math.round(palette[best][1]);
    px[i + 2] = Math.round(palette[best][2]);
  }
  x.putImageData(imgData, 0, 0);

  if (knitLogoCache.size > 24) knitLogoCache.clear();
  knitLogoCache.set(key, c);
  return c;
}

/** Dibuja el logo ya pixelado: cada punto es una malla con relieve de tejido. */
function drawKnittedLogo(
  ctx: CanvasRenderingContext2D,
  small: HTMLCanvasElement,
  cx: number,
  cy: number,
  dw: number,
  dh: number
) {
  const cols = small.width;
  const rows = small.height;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  if (!sctx) return;
  const data = sctx.getImageData(0, 0, cols, rows).data;
  const cw = dw / cols;
  const ch = dh / rows;
  const x0 = cx - dw / 2;
  const y0 = cy - dh / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      if (data[i + 3] === 0) continue;
      const x = x0 + c * cw;
      const y = y0 + r * ch;
      ctx.fillStyle = `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
      ctx.fillRect(x, y, cw + 0.6, ch + 0.6);
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(x, y + ch * 0.74, cw + 0.6, ch * 0.26 + 0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, cw * 0.38, ch * 0.42);
    }
  }
}

/**
 * Draw horizontal Jacquard stripes with subtle stitch teeth along edges
 */
function drawJacquardStripes(
  ctx: CanvasRenderingContext2D,
  count: number,
  thickness: 'thin' | 'medium' | 'thick',
  stripeColor: string,
  vStart = 0.10,
  vEnd = 0.90
) {
  const safeCount = Math.max(2, Math.min(6, count));
  const span = vEnd - vStart;
  const step = span / safeCount;
  const ratio = thickness === 'thin' ? 0.28 : thickness === 'medium' ? 0.46 : 0.64;
  const bandH = step * ratio;

  ctx.fillStyle = stripeColor;
  const stitchW = 8;
  const toothH = 3;

  for (let i = 0; i < safeCount; i++) {
    const centerV = vStart + step * (i + 0.5);
    const yTop = Math.round((centerV - bandH / 2) * 1024);
    const hPx = Math.max(8, Math.round(bandH * 1024));

    ctx.fillRect(0, yTop, 1024, hPx);

    // Subtle Jacquard knit teeth on top and bottom edges of the stripe
    for (let x = 0; x < 1024; x += stitchW) {
      ctx.fillRect(x, yTop - toothH, stitchW / 2, toothH);
      ctx.fillRect(x + stitchW / 2, yTop + hPx, stitchW / 2, toothH);
    }
  }
}

/**
 * Procedural knit normal map: 256x256 canvas with small "V" chevrons in rows
 */
function createKnitNormalTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#8080FF';
  ctx.fillRect(0, 0, 256, 256);

  const stitchW = 8;
  const stitchH = 6;
  for (let y = 0; y < 256; y += stitchH) {
    const row = Math.floor(y / stitchH);
    const xOffset = (row % 2) * (stitchW / 2);
    for (let x = -stitchW; x < 256 + stitchW; x += stitchW) {
      const cx = x + xOffset;

      ctx.strokeStyle = 'rgb(90, 140, 240)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - 3, y + 1);
      ctx.lineTo(cx, y + stitchH - 1);
      ctx.stroke();

      ctx.strokeStyle = 'rgb(165, 140, 240)';
      ctx.beginPath();
      ctx.moveTo(cx, y + stitchH - 1);
      ctx.lineTo(cx + 3, y + 1);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = false;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Soft radial contact shadow texture placed only on top of the podium
 */
function createContactShadowTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 120);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.09)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}


// ---------------------------------------------------------------------------
// Lupa: vista plana del tejido con una lente que amplía hasta ver cada aguja
// ---------------------------------------------------------------------------
interface KnitLupaProps {
  legCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  config: ExtendedSockConfig;
  onClose: () => void;
}

const LUPA_VIEW = 480; // píxeles de textura que se muestran
const LENS_SIZE = 168;

const KnitLupa: React.FC<KnitLupaProps> = ({ legCanvasRef, config, onClose }) => {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const lensRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(4);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [side, setSide] = useState<'front' | 'back'>('front');

  const draw = useCallback(() => {
    const leg = legCanvasRef.current;
    const view = viewRef.current;
    if (!leg || !view) return;
    const v = view.getContext('2d');
    if (!v) return;
    const rotOffset = (config.logo.rotation || 0) / 360;
    const baseU = side === 'front' ? 0 : 0.5;
    const u = (((baseU + rotOffset) % 1) + 1) % 1;
    const cx = u * 1024;
    const vC = 0.18 + (config.logo.yPos ?? 0.45) * 0.46;
    const cy = Math.max(LUPA_VIEW / 2, Math.min(1024 - LUPA_VIEW / 2, vC * 1024));
    v.imageSmoothingEnabled = false;
    v.clearRect(0, 0, LUPA_VIEW, LUPA_VIEW);
    for (const off of [-1024, 0, 1024]) {
      v.drawImage(leg, off - (cx - LUPA_VIEW / 2), -(cy - LUPA_VIEW / 2));
    }
    if (showGrid) {
      v.strokeStyle = 'rgba(255,255,255,0.10)';
      v.lineWidth = 1;
      v.beginPath();
      for (let g = 0; g <= LUPA_VIEW; g += PX_PER_NEEDLE) {
        v.moveTo(Math.round(g) + 0.5, 0);
        v.lineTo(Math.round(g) + 0.5, LUPA_VIEW);
        v.moveTo(0, Math.round(g) + 0.5);
        v.lineTo(LUPA_VIEW, Math.round(g) + 0.5);
      }
      v.stroke();
    }
  }, [legCanvasRef, config.logo.rotation, config.logo.yPos, showGrid, side]);

  useEffect(() => {
    draw();
    const id = window.setInterval(draw, 350);
    return () => window.clearInterval(id);
  }, [draw]);

  useEffect(() => {
    const view = viewRef.current;
    const lens = lensRef.current;
    if (!view || !lens || !pos) return;
    const l = lens.getContext('2d');
    if (!l) return;
    const src = LENS_SIZE / zoom;
    const sx = Math.max(0, Math.min(LUPA_VIEW - src, pos.x * LUPA_VIEW - src / 2));
    const sy = Math.max(0, Math.min(LUPA_VIEW - src, pos.y * LUPA_VIEW - src / 2));
    l.imageSmoothingEnabled = false;
    l.clearRect(0, 0, LENS_SIZE, LENS_SIZE);
    l.drawImage(view, sx, sy, src, src, 0, 0, LENS_SIZE, LENS_SIZE);
  }, [pos, zoom]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    });
  };

  const hasLogo = Boolean(config.logo.url);
  const backAvailable = (config.logoPosition || (config.logo.repeatBack ? 'both' : 'front')) !== 'front';

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-white flex flex-col p-3 sm:p-6 gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">Lupa del tejido</p>
          <p className="text-[11px] text-slate-500">
            Cada cuadradito es una aguja. Pasa el dedo o el ratón por encima para ampliar.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-petrol text-white"
          aria-label="Cerrar la lupa"
        >
          <X className="w-3.5 h-3.5" />
          Cerrar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-600">Ampliación</span>
        {[2, 4, 6, 8].map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            className={`px-2.5 py-1 rounded-lg font-bold border ${
              zoom === z ? 'bg-petrol text-white border-petrol' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            x{z}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowGrid((g) => !g)}
          className={`px-2.5 py-1 rounded-lg font-bold border ${
            showGrid ? 'bg-turquoise text-white border-turquoise' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          Agujas
        </button>
        {backAvailable && (
          <button
            type="button"
            onClick={() => setSide((sd) => (sd === 'front' ? 'back' : 'front'))}
            className="px-2.5 py-1 rounded-lg font-bold border bg-white text-slate-700 border-slate-200"
          >
            {side === 'front' ? 'Ver detrás' : 'Ver delante'}
          </button>
        )}
      </div>

      <div
        className="relative mx-auto w-full max-w-[480px] aspect-square rounded-2xl overflow-hidden border border-slate-200 touch-none select-none bg-slate-100"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setPos(null)}
      >
        <canvas
          ref={viewRef}
          width={LUPA_VIEW}
          height={LUPA_VIEW}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {pos && (
          <span
            className="absolute w-2 h-2 rounded-full bg-turquoise ring-2 ring-white pointer-events-none"
            style={{ left: `calc(${pos.x * 100}% - 4px)`, top: `calc(${pos.y * 100}% - 4px)` }}
          />
        )}
        {pos && (
          <canvas
            ref={lensRef}
            width={LENS_SIZE}
            height={LENS_SIZE}
            className="absolute rounded-full border-4 border-white shadow-xl pointer-events-none"
            style={{
              width: LENS_SIZE,
              height: LENS_SIZE,
              imageRendering: 'pixelated',
              left: `calc(${pos.x * 100}% - ${LENS_SIZE / 2}px)`,
              top: `calc(${pos.y * 100}% - ${LENS_SIZE + 24}px)`,
            }}
          />
        )}
        {!hasLogo && (
          <div className="absolute inset-x-0 bottom-2 text-center text-[11px] text-slate-600">
            Sube un logo o pulsa «Logo ejemplo» para verlo tejido.
          </div>
        )}
      </div>
      <p className="mx-auto max-w-[480px] text-[11px] leading-snug text-slate-500">
        Así lo tejerá la máquina: cada cuadrado es una aguja y el logo se reduce a un máximo de {MAX_LOGO_INKS} hilos de color.
        Los detalles más finos que una aguja se pierden: el texto pequeño necesita al menos 7 agujas de alto para leerse bien.
      </p>
    </div>,
    document.body
  );
};

export const SockViewer3D: React.FC<SockViewer3DProps> = ({
  config,
  onSnapshotReady,
  captureSnapshotRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Material references
  const materialsRef = useRef<{
    cuff: THREE.MeshStandardMaterial;
    leg: THREE.MeshStandardMaterial;
    heel: THREE.MeshStandardMaterial;
    foot: THREE.MeshStandardMaterial;
    toe: THREE.MeshStandardMaterial;
  } | null>(null);

  // Dynamic canvases & textures for cuff, leg, and foot
  const cuffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cuffTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const legCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const legTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const footCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const footTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const logoImageRef = useRef<HTMLImageElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey | null>('frente');
  const [lupaOpen, setLupaOpen] = useState(false);

  // Animation refs
  const introAnimRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startAngle: number;
    finalAngle: number;
  } | null>(null);

  const presetAnimRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startTheta: number;
    targetTheta: number;
    startPhi: number;
    targetPhi: number;
  } | null>(null);

  // Redraw all 3 editable zone textures (cuff, leg, foot)
  const updateZoneTextures = useCallback(() => {
    const cuffCanvas = cuffCanvasRef.current;
    const cuffTex = cuffTextureRef.current;
    const legCanvas = legCanvasRef.current;
    const legTex = legTextureRef.current;
    const footCanvas = footCanvasRef.current;
    const footTex = footTextureRef.current;

    if (!cuffCanvas || !cuffTex || !legCanvas || !legTex || !footCanvas || !footTex) return;

    const cuffCtx = cuffCanvas.getContext('2d');
    const legCtx = legCanvas.getContext('2d');
    const footCtx = footCanvas.getContext('2d');
    if (!cuffCtx || !legCtx || !footCtx) return;

    const pattern = config.pattern || {
      type: 'none',
      color: '#1F4D63',
      stripesZone: 'cuff',
      stripesThickness: 'medium',
      stripesCount: 3,
      dotsSize: 'medium',
      dotsDensity: 'medium',
    };
    const logoBg = config.logoBg || { type: 'none', color: '#FFFFFF' };
    const logoPos = config.logoPosition || (config.logo.repeatBack ? 'both' : 'front');
    const knittedText = config.knittedText || { text: '', color: '#1E232A' };

    const resolvePatternColor = (zoneBg: string, patColor: string): string => {
      if (zoneBg.trim().toLowerCase() !== patColor.trim().toLowerCase()) {
        return patColor;
      }
      if (config.legColor.trim().toLowerCase() !== zoneBg.trim().toLowerCase()) {
        return config.legColor;
      }
      return zoneBg.trim().toLowerCase() === '#ffffff' ? '#1F4D63' : '#FFFFFF';
    };

    // Diseño repetido por todo el calcetín (estampado completo)
    const allOverImg = config.logo.allOver ? logoImageRef.current : null;
    const allOverReady = Boolean(allOverImg && allOverImg.complete && allOverImg.naturalWidth > 0);
    const tileAllOver = (ctx: CanvasRenderingContext2D) => {
      if (!allOverReady || !allOverImg) return;
      const repeatsX = 4; // 4 repeticiones alrededor: encaja justo y no se corta al dar la vuelta
      const tileW = 1024 / repeatsX;
      const tileH = tileW * (allOverImg.naturalHeight / allOverImg.naturalWidth);
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < 1024; y += tileH) {
        for (let x = 0; x < 1024; x += tileW) {
          ctx.drawImage(allOverImg, x, y, tileW + 1, tileH + 1);
        }
      }
    };

    // =========================================================================
    // 1. CUFF CANVAS
    // =========================================================================
    const hasCuffStripes =
      pattern.type === 'stripes' &&
      (pattern.stripesZone === 'cuff' || pattern.stripesZone === 'all');

    const sameCuffAndStripeColor =
      hasCuffStripes &&
      config.cuffColor.trim().toLowerCase() === pattern.color.trim().toLowerCase() &&
      config.legColor.trim().toLowerCase() !== config.cuffColor.trim().toLowerCase();

    if (sameCuffAndStripeColor) {
      cuffCtx.fillStyle = config.legColor;
      cuffCtx.fillRect(0, 0, 1024, 1024);
      cuffCtx.fillStyle = config.cuffColor;
      cuffCtx.fillRect(0, 0, 1024, Math.round(1024 * 0.16));
      drawJacquardStripes(
        cuffCtx,
        pattern.stripesCount,
        pattern.stripesThickness,
        pattern.color,
        0.22,
        0.92
      );
    } else {
      cuffCtx.fillStyle = config.cuffColor;
      cuffCtx.fillRect(0, 0, 1024, 1024);
      if (hasCuffStripes) {
        const effColor = resolvePatternColor(config.cuffColor, pattern.color);
        drawJacquardStripes(
          cuffCtx,
          pattern.stripesCount,
          pattern.stripesThickness,
          effColor,
          0.14,
          0.88
        );
      }
    }

    tileAllOver(cuffCtx);

    // Subtle vertical ribbing lines on cuff
    cuffCtx.fillStyle = 'rgba(0, 0, 0, 0.045)';
    for (let x = 0; x < 1024; x += 16) {
      cuffCtx.fillRect(x, 0, 6, 1024);
    }

    cuffTex.needsUpdate = true;

    // =========================================================================
    // 2. LEG CANVAS (Base + Pattern + Logo Bg Patch + Logo + Knitted Text)
    // =========================================================================
    legCtx.fillStyle = config.legColor;
    legCtx.fillRect(0, 0, 1024, 1024);

    const rotOffset = (config.logo.rotation || 0) / 360;
    const activeCentersU: number[] = [];
    if (logoPos === 'front' || logoPos === 'both') {
      activeCentersU.push(((0.0 + rotOffset) % 1 + 1) % 1);
    }
    if (logoPos === 'back' || logoPos === 'both') {
      activeCentersU.push(((0.5 + rotOffset) % 1 + 1) % 1);
    }

    const scale = config.logo.scale || 1.0;
    const vLogoCenter = 0.18 + (config.logo.yPos ?? 0.45) * 0.46;
    const hasLogo = Boolean(config.logo.url);
    const hasText = Boolean(knittedText.text && knittedText.text.trim().length > 0);

    const logoUHalf = 0.19 * scale + (logoBg.type !== 'none' ? 0.035 : 0);
    const logoVHalf = 0.18 * scale + (logoBg.type !== 'none' ? 0.035 : 0);

    const vTextCenter = hasLogo
      ? Math.min(0.84, vLogoCenter + logoVHalf + 0.08)
      : 0.46;
    const cleanText = knittedText.text ? knittedText.text.trim().slice(0, 14) : '';
    const textUHalf = Math.max(0.12, cleanText.length * 0.016 + 0.035);
    const textVHalf = 0.065;

    // Exclusion boxes on leg so dots & checks don't collide with logo or text
    const exclusionBoxes: UVBox[] = [];
    for (const uc of activeCentersU) {
      if (hasLogo) {
        exclusionBoxes.push({
          uCenter: uc,
          vMin: vLogoCenter - logoVHalf,
          vMax: vLogoCenter + logoVHalf,
          uHalfWidth: logoUHalf,
        });
      }
      if (hasText) {
        exclusionBoxes.push({
          uCenter: uc,
          vMin: vTextCenter - textVHalf,
          vMax: vTextCenter + textVHalf,
          uHalfWidth: textUHalf,
        });
      }
    }

    // Draw Pattern on Leg
    const legPatColor = resolvePatternColor(config.legColor, pattern.color);

    if (
      pattern.type === 'stripes' &&
      (pattern.stripesZone === 'leg' || pattern.stripesZone === 'all')
    ) {
      drawJacquardStripes(
        legCtx,
        pattern.stripesCount,
        pattern.stripesThickness,
        legPatColor,
        0.10,
        0.88
      );
    } else if (pattern.type === 'dots') {
      const cols =
        pattern.dotsDensity === 'few' ? 8 : pattern.dotsDensity === 'medium' ? 12 : 16;
      const rows =
        pattern.dotsDensity === 'few' ? 5 : pattern.dotsDensity === 'medium' ? 7 : 10;
      const radiusPx =
        pattern.dotsSize === 'small' ? 14 : pattern.dotsSize === 'medium' ? 22 : 30;
      const padU = radiusPx / 1024 + 0.025;
      const padV = radiusPx / 1024 + 0.025;

      for (let r = 0; r < rows; r++) {
        const v = 0.08 + ((r + 0.5) / rows) * 0.84;
        const uShift = (r % 2) * (0.5 / cols);
        for (let c = 0; c < cols; c++) {
          const u = ((c / cols + uShift) % 1 + 1) % 1;
          if (isInsideBoxes(u, v, exclusionBoxes, padU, padV)) continue;

          const cy = v * 1024;
          drawWrappedHorizontal(u, (cx) => {
            drawPixelatedCircle(legCtx, cx, cy, radiusPx, legPatColor, 6);
          });
        }
      }
    } else if (pattern.type === 'checks') {
      const cols = 32;
      const rows = 24;
      const cellW = 1024 / cols;
      const cellH = 1024 / rows;
      legCtx.fillStyle = legPatColor;

      for (let r = 0; r < rows; r++) {
        const v = (r + 0.5) / rows;
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 !== 0) continue;
          const u = (c + 0.5) / cols;
          if (isInsideBoxes(u, v, exclusionBoxes, 0.02, 0.02)) continue;

          const x = Math.round(c * cellW);
          const y = Math.round(r * cellH);
          const w = Math.round(cellW * 0.78);
          const h = Math.round(cellH * 0.78);
          legCtx.fillRect(x, y, w, h);
        }
      }
    }

    tileAllOver(legCtx);

    // Draw Logo Background Patch & Logo Image on Leg
    const img = logoImageRef.current;
    if (hasLogo && !config.logo.allOver && img && img.complete && img.naturalWidth > 0) {
      const maxBoxW = 1024 * 0.34 * scale;
      const maxBoxH = 1024 * 0.34 * scale;
      const cy = vLogoCenter * 1024;

      const imgAspect = img.naturalWidth / (img.naturalHeight || 1);
      let dw = maxBoxW;
      let dh = maxBoxH;
      if (imgAspect > 1) {
        dw = maxBoxW;
        dh = maxBoxW / imgAspect;
      } else {
        dh = maxBoxH;
        dw = maxBoxH * imgAspect;
      }

      for (const uc of activeCentersU) {
        drawWrappedHorizontal(uc, (cx) => {
          if (logoBg.type === 'circle') {
            const patchRadius = Math.max(dw, dh) * 0.64;
            drawPixelatedCircle(legCtx, cx, cy, patchRadius, logoBg.color, 6);
          } else if (logoBg.type === 'roundedRect') {
            const patchW = dw * 1.26;
            const patchH = dh * 1.30;
            drawPixelatedRoundedRect(legCtx, cx, cy, patchW, patchH, 28, logoBg.color, 6);
          }

          legCtx.imageSmoothingEnabled = false;
          const knitCols = Math.max(8, Math.round(dw / PX_PER_NEEDLE));
          const knitRows = Math.max(8, Math.round(dh / PX_PER_NEEDLE));
          const knitted = pixelateLogoToInks(img, knitCols, knitRows, MAX_LOGO_INKS);
          if (knitted) {
            drawKnittedLogo(legCtx, knitted, cx, cy, dw, dh);
          } else {
            legCtx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
          }
        });
      }
    }

    // Draw Knitted Text below logo (or centered on leg if no logo)
    if (hasText) {
      const cyText = vTextCenter * 1024;
      const textCenters = activeCentersU.length > 0 ? activeCentersU : [0.0];
      for (const uc of textCenters) {
        drawWrappedHorizontal(uc, (cx) => {
          drawPixelatedText(legCtx, cleanText, cx, cyText, knittedText.color);
        });
      }
    }

    legTex.needsUpdate = true;

    // =========================================================================
    // 3. FOOT CANVAS (Base + Dots or Checks if active)
    // =========================================================================
    footCtx.fillStyle = config.footColor;
    footCtx.fillRect(0, 0, 1024, 1024);

    const footPatColor = resolvePatternColor(config.footColor, pattern.color);

    if (pattern.type === 'dots') {
      const cols =
        pattern.dotsDensity === 'few' ? 4 : pattern.dotsDensity === 'medium' ? 6 : 8;
      const rows =
        pattern.dotsDensity === 'few' ? 4 : pattern.dotsDensity === 'medium' ? 5 : 7;
      const radiusPx =
        pattern.dotsSize === 'small' ? 16 : pattern.dotsSize === 'medium' ? 24 : 32;

      for (let r = 0; r < rows; r++) {
        const v = 0.14 + ((r + 0.5) / rows) * 0.74;
        const uShift = (r % 2) * (0.5 / cols);
        for (let c = 0; c < cols; c++) {
          const u = 0.08 + ((c + 0.3 + (r % 2) * 0.4) / cols) * 0.84;
          void uShift;
          const cx = u * 1024;
          const cy = v * 1024;
          drawPixelatedCircle(footCtx, cx, cy, radiusPx, footPatColor, 6);
        }
      }
    } else if (pattern.type === 'checks') {
      const cols = 16;
      const rows = 18;
      const cellW = 1024 / cols;
      const cellH = 1024 / rows;
      footCtx.fillStyle = footPatColor;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 !== 0) continue;
          const x = Math.round(c * cellW);
          const y = Math.round(r * cellH);
          footCtx.fillRect(x, y, Math.round(cellW * 0.78), Math.round(cellH * 0.78));
        }
      }
    }

    tileAllOver(footCtx);

    footTex.needsUpdate = true;

    if (rendererRef.current && sceneRef.current && cameraRef.current && onSnapshotReady) {
      requestAnimationFrame(() => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        try {
          onSnapshotReady(rendererRef.current.domElement.toDataURL('image/png'));
        } catch {
          // ignore snapshot error
        }
      });
    }
  }, [
    config.cuffColor,
    config.legColor,
    config.footColor,
    config.pattern,
    config.logo,
    config.logoBg,
    config.logoPosition,
    config.knittedText,
    onSnapshotReady,
  ]);

  // Expose live snapshot capture helper for PDF and Quote actions
  useEffect(() => {
    if (!captureSnapshotRef) return;
    captureSnapshotRef.current = () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!renderer || !scene || !camera) return null;

      if (introAnimRef.current?.active && controls) {
        introAnimRef.current.active = false;
        const rHoriz = CAMERA_DISTANCE * Math.cos(ELEVATION_ANGLE);
        const rVert = CAMERA_DISTANCE * Math.sin(ELEVATION_ANGLE);
        camera.position.set(
          TARGET.x + rHoriz * Math.sin(PRESETS.frente),
          TARGET.y + rVert,
          TARGET.z + rHoriz * Math.cos(PRESETS.frente)
        );
        controls.target.copy(TARGET);
        controls.update();
      }

      renderer.render(scene, camera);
      try {
        return renderer.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    };
    return () => {
      if (captureSnapshotRef) {
        captureSnapshotRef.current = null;
      }
    };
  }, [captureSnapshotRef]);

  // Preload logo image
  useEffect(() => {
    if (config.logo.url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        logoImageRef.current = img;
        updateZoneTextures();
      };
      img.onerror = () => {
        logoImageRef.current = null;
        updateZoneTextures();
      };
      img.src = config.logo.url;
    } else {
      logoImageRef.current = null;
      updateZoneTextures();
    }
  }, [config.logo.url, updateZoneTextures]);

  // Redraw textures whenever any design property changes
  useEffect(() => {
    updateZoneTextures();
  }, [updateZoneTextures]);

  // Update autoRotate on controls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
  }, [autoRotate]);

  // Initialize Three.js scene and load GLTF model
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let animationFrameId: number;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera: FOV 30, distance 2.6 looking at TARGET (0, 0.48, 0)
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 50);
    cameraRef.current = camera;

    const rHoriz = CAMERA_DISTANCE * Math.cos(ELEVATION_ANGLE);
    const rVert = CAMERA_DISTANCE * Math.sin(ELEVATION_ANGLE);
    const initialAzimuth = PRESETS.frente;

    camera.position.set(
      TARGET.x + rHoriz * Math.sin(initialAzimuth),
      TARGET.y + rVert,
      TARGET.z + rHoriz * Math.cos(initialAzimuth)
    );
    camera.lookAt(TARGET);

    // 3. Renderer with clear almost-white background #F5F8FA
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xF5F8FA, 1);
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.target.copy(TARGET);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = Math.PI * 0.10;
    controls.maxPolarAngle = Math.PI * 0.48;

    // 5. Lighting: Hemispheric 0.9, Key light 1.2, Fill light 0.5
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xf8fafc, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(-2.0, 3.6, 2.4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(2.5, 2.0, 1.5);
    scene.add(fillLight);

    // 6. Cylindrical White Podium (radius: 0.38, height: 0.07, pure white #FFFFFF)
    const podiumGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.07, 64);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.01,
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.set(0, -0.035, 0);
    scene.add(podium);

    // Soft contact shadow ONLY on top of the podium
    const contactShadowTex = createContactShadowTexture();
    const contactShadowGeo = new THREE.PlaneGeometry(0.62, 0.62);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(-0.08, 0.001, 0.04);
    scene.add(contactShadow);

    // 7. Normal Maps for knit texture
    const baseNormal = createKnitNormalTexture();
    const normalMapLegCuff = baseNormal ? baseNormal.clone() : null;
    if (normalMapLegCuff) {
      normalMapLegCuff.repeat.set(30, 46);
      normalMapLegCuff.needsUpdate = true;
    }

    const normalMapFootHeelToe = baseNormal ? baseNormal.clone() : null;
    if (normalMapFootHeelToe) {
      normalMapFootHeelToe.repeat.set(26, 22);
      normalMapFootHeelToe.needsUpdate = true;
    }

    // 8. Create 1024x1024 Canvases & Textures for Cuff, Leg, and Foot
    const makeZoneTexture = (
      canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
      texRef: React.MutableRefObject<THREE.CanvasTexture | null>,
      initialColor: string
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = initialColor;
        ctx.fillRect(0, 0, 1024, 1024);
      }
      canvasRef.current = canvas;

      const tex = new THREE.CanvasTexture(canvas);
      tex.flipY = false;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      texRef.current = tex;
      return tex;
    };

    const cuffTexture = makeZoneTexture(cuffCanvasRef, cuffTextureRef, config.cuffColor);
    const legTexture = makeZoneTexture(legCanvasRef, legTextureRef, config.legColor);
    const footTexture = makeZoneTexture(footCanvasRef, footTextureRef, config.footColor);

    // 9. Materials for each of the 5 primitives
    const cuffMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map: cuffTexture,
      roughness: 0.95,
      metalness: 0,
      normalMap: normalMapLegCuff,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });

    const legMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map: legTexture,
      roughness: 0.95,
      metalness: 0,
      normalMap: normalMapLegCuff,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });

    const heelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2B3140'),
      roughness: 0.95,
      metalness: 0,
      normalMap: normalMapFootHeelToe,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });

    const footMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map: footTexture,
      roughness: 0.95,
      metalness: 0,
      normalMap: normalMapFootHeelToe,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });

    const toeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2B3140'),
      roughness: 0.95,
      metalness: 0,
      normalMap: normalMapFootHeelToe,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });

    materialsRef.current = {
      cuff: cuffMat,
      leg: legMat,
      heel: heelMat,
      foot: footMat,
      toe: toeMat,
    };

    // 10. Load GLTF Model (/calcetin-mmz.glb)
    const loader = new GLTFLoader();
    loader.load(
      '/calcetin-mmz.glb',
      (gltf) => {
        if (isDisposed) return;

        gltf.scene.position.set(-0.16, 0, 0.03);

        // Normalize U and V coordinates on cuff, leg, and foot for seamless, unstretched patterns
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;

            const name = (Array.isArray(mesh.material)
              ? mesh.material[0]?.name
              : mesh.material?.name) || '';

            const posAttr = mesh.geometry.attributes.position;
            const uvAttr = mesh.geometry.attributes.uv;

            if (posAttr && uvAttr && (name === 'cuff' || name === 'leg')) {
              let minY = Infinity;
              let maxY = -Infinity;
              for (let i = 0; i < posAttr.count; i++) {
                const y = posAttr.getY(i);
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
              const spanY = Math.max(0.001, maxY - minY);
              for (let i = 0; i < uvAttr.count; i++) {
                const y = posAttr.getY(i);
                const u = Math.max(0.0, Math.min(1.0, uvAttr.getX(i)));
                const vNorm = Math.max(0.002, Math.min(0.998, (maxY - y) / spanY));
                uvAttr.setXY(i, u, vNorm);
              }
              uvAttr.needsUpdate = true;
            } else if (posAttr && uvAttr && name === 'foot') {
              // Orthogonal 3D projection on foot so dots and checks never stretch or overlap
              let minU3d = Infinity;
              let maxU3d = -Infinity;
              let minV3d = Infinity;
              let maxV3d = -Infinity;
              for (let i = 0; i < posAttr.count; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                const z = posAttr.getZ(i);
                const u3d = 0.48 * x - 0.74 * y - 0.47 * z;
                const v3d = -0.68 * x - 0.66 * y + 0.32 * z;
                if (u3d < minU3d) minU3d = u3d;
                if (u3d > maxU3d) maxU3d = u3d;
                if (v3d < minV3d) minV3d = v3d;
                if (v3d > maxV3d) maxV3d = v3d;
              }
              const spanU3d = Math.max(0.001, maxU3d - minU3d);
              const spanV3d = Math.max(0.001, maxV3d - minV3d);
              for (let i = 0; i < uvAttr.count; i++) {
                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                const z = posAttr.getZ(i);
                const u3d = 0.48 * x - 0.74 * y - 0.47 * z;
                const v3d = -0.68 * x - 0.66 * y + 0.32 * z;
                const uNorm = Math.max(0.002, Math.min(0.998, (u3d - minU3d) / spanU3d));
                const vNorm = Math.max(0.002, Math.min(0.998, (v3d - minV3d) / spanV3d));
                uvAttr.setXY(i, uNorm, vNorm);
              }
              uvAttr.needsUpdate = true;
            }

            if (name === 'cuff') {
              mesh.material = cuffMat;
            } else if (name === 'leg') {
              mesh.material = legMat;
            } else if (name === 'heel') {
              mesh.material = heelMat;
            } else if (name === 'foot') {
              mesh.material = footMat;
            } else if (name === 'toe') {
              mesh.material = toeMat;
            }
          }
        });

        scene.add(gltf.scene);
        setIsLoading(false);
        setLoadError(null);

        updateZoneTextures();

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReduced) {
          introAnimRef.current = {
            active: true,
            startTime: performance.now(),
            duration: 3000,
            startAngle: PRESETS.frente - Math.PI * 2,
            finalAngle: PRESETS.frente,
          };
        }

        if (onSnapshotReady) {
          setTimeout(() => {
            if (isDisposed) return;
            renderer.render(scene, camera);
            const url = renderer.domElement.toDataURL('image/png');
            onSnapshotReady(url);
          }, 500);
        }
      },
      undefined,
      (error) => {
        if (isDisposed) return;
        console.error('Error loading sock 3D model:', error);
        setIsLoading(false);
        setLoadError('No se pudo cargar el modelo 3D del calcetín.');
      }
    );

    const handleUserInteraction = () => {
      if (introAnimRef.current?.active) {
        introAnimRef.current.active = false;
      }
      if (presetAnimRef.current?.active) {
        presetAnimRef.current.active = false;
      }
    };
    container.addEventListener('pointerdown', handleUserInteraction, { passive: true });

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (introAnimRef.current?.active) {
        const anim = introAnimRef.current;
        const elapsed = currentTime - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1.0);
        const ease = 1.0 - Math.pow(1.0 - progress, 3);
        const currentAngle = anim.startAngle + (anim.finalAngle - anim.startAngle) * ease;

        camera.position.set(
          TARGET.x + rHoriz * Math.sin(currentAngle),
          TARGET.y + rVert,
          TARGET.z + rHoriz * Math.cos(currentAngle)
        );
        controls.target.copy(TARGET);
        controls.update();

        if (progress >= 1.0) {
          anim.active = false;
        }
      }

      if (presetAnimRef.current?.active) {
        const anim = presetAnimRef.current;
        const elapsed = currentTime - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1.0);
        const ease = 1.0 - Math.pow(1.0 - progress, 3);

        const currentTheta = anim.startTheta + (anim.targetTheta - anim.startTheta) * ease;
        const currentPhi = anim.startPhi + (anim.targetPhi - anim.startPhi) * ease;

        const curRHoriz = CAMERA_DISTANCE * Math.cos(currentPhi);
        const curRVert = CAMERA_DISTANCE * Math.sin(currentPhi);

        camera.position.set(
          TARGET.x + curRHoriz * Math.sin(currentTheta),
          TARGET.y + curRVert,
          TARGET.z + curRHoriz * Math.cos(currentTheta)
        );
        controls.target.copy(TARGET);
        controls.update();

        if (progress >= 1.0) {
          anim.active = false;
        }
      }

      if (!introAnimRef.current?.active && !presetAnimRef.current?.active) {
        controls.update();
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('pointerdown', handleUserInteraction);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      podiumGeo.dispose();
      podiumMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      contactShadowTex?.dispose();
      baseNormal?.dispose();
      normalMapLegCuff?.dispose();
      normalMapFootHeelToe?.dispose();
      cuffTexture.dispose();
      legTexture.dispose();
      footTexture.dispose();
      cuffMat.dispose();
      legMat.dispose();
      heelMat.dispose();
      footMat.dispose();
      toeMat.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCameraPreset = (preset: PresetKey) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const camera = cameraRef.current;

    if (introAnimRef.current?.active) {
      introAnimRef.current.active = false;
    }

    setActivePreset(preset);
    setAutoRotate(false);

    const dx = camera.position.x - TARGET.x;
    const dy = camera.position.y - TARGET.y;
    const dz = camera.position.z - TARGET.z;

    const currentTheta = Math.atan2(dx, dz);
    const currentPhi = Math.asin(Math.max(-0.99, Math.min(0.99, dy / CAMERA_DISTANCE)));

    const targetThetaValue = PRESETS[preset];
    const targetPhi = ELEVATION_ANGLE;

    let deltaTheta = targetThetaValue - currentTheta;
    while (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
    while (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;

    presetAnimRef.current = {
      active: true,
      startTime: performance.now(),
      duration: 550,
      startTheta: currentTheta,
      targetTheta: currentTheta + deltaTheta,
      startPhi: currentPhi,
      targetPhi,
    };
  };

  return (
    <div className="relative w-full h-[300px] sm:h-[400px] md:h-[460px] rounded-3xl overflow-hidden bg-[#F5F8FA] border border-slate-200/90 shadow-soft select-none flex flex-col justify-between">

      {/* Top Overlay: View Presets & Auto Rotate */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex items-center justify-between pointer-events-none">

        {/* Camera Preset Buttons */}
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-slate-200 pointer-events-auto">
          <button
            type="button"
            onClick={() => setCameraPreset('frente')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-xl transition-all ${
              activePreset === 'frente' && !autoRotate
                ? 'bg-petrol text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Frente
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('lado')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-xl transition-all ${
              activePreset === 'lado' && !autoRotate
                ? 'bg-petrol text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Lado
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('talon')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-xl transition-all ${
              activePreset === 'talon' && !autoRotate
                ? 'bg-petrol text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Talón
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setLupaOpen(true)}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-2xl backdrop-blur-md transition-all shadow-sm border bg-white/90 text-slate-700 border-slate-200 hover:bg-white"
          aria-label="Abrir la lupa para ver el tejido de cerca"
        >
          <ZoomIn className="w-3.5 h-3.5 text-turquoise" />
          <span>Lupa</span>
        </button>
        {/* Auto Rotate Toggle */}
        <button
          type="button"
          onClick={() => {
            if (introAnimRef.current?.active) introAnimRef.current.active = false;
            if (presetAnimRef.current?.active) presetAnimRef.current.active = false;
            setAutoRotate(!autoRotate);
            if (!autoRotate) setActivePreset(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-2xl backdrop-blur-md transition-all shadow-sm pointer-events-auto border ${
            autoRotate
              ? 'bg-turquoise text-white border-turquoise shadow-glow'
              : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
          }`}
          aria-label={autoRotate ? 'Pausar giro continuo' : 'Activar giro continuo'}
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          <span className="hidden xs:inline">Girar solo</span>
        </button>
        </div>
      </div>

      {/* Center 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
        aria-label="Visor 3D interactivo del calcetín sobre peana"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs z-10">
            <div className="flex items-center gap-2 text-petrol font-semibold text-sm">
              <Sparkles className="w-5 h-5 text-turquoise animate-pulse" />
              <span>Cargando calcetín 3D...</span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-30 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">Error al cargar el visor 3D</h4>
            <p className="text-xs text-slate-500 mb-4 max-w-xs">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-petrol text-white text-xs font-semibold rounded-xl hover:bg-petrol-dark transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        )}
      </div>

      {lupaOpen && (
        <KnitLupa legCanvasRef={legCanvasRef} config={config} onClose={() => setLupaOpen(false)} />
      )}

      {/* Bottom Overlay: Locked Zone Notice & Drag hint */}
      <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-2 pointer-events-none">

        {/* Padlock notice */}
        <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-petrol-dark/90 backdrop-blur-md text-white text-[11px] sm:text-xs font-medium shadow-md border border-white/10 pointer-events-auto">
          <Lock className="w-3.5 h-3.5 text-yarn-mustard flex-shrink-0" />
          <span>
            <strong className="text-white">Zona fija:</strong> talón y puntera, siempre iguales
          </span>
        </div>

        {/* Drag Hint */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md text-slate-500 text-[11px] font-medium border border-slate-200/80">
          <Eye className="w-3.5 h-3.5 text-turquoise" />
          <span>Arrastra para rotar</span>
        </div>

      </div>

    </div>
  );
};
