import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createPortal } from 'react-dom';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Lock, RotateCw, Eye, Sparkles, AlertCircle, RefreshCw, ZoomIn, X } from 'lucide-react';
import { ExtendedSockConfig } from '../../utils/pricing';
import { DEFAULT_HEEL_TOE_COLOR } from '../../data/yarnPalette';
import { buildKnitPixelGrid, KnitPixelGrid, MAX_MACHINE_INKS } from '../../utils/knitPixelEngine';
import {
  renderGridToKnitCanvas,
  renderKnitMacroRegion,
  renderCuffRibbingOverlay,
  createKnitStitchNormalTexture,
  createCuffRibNormalTexture,
} from '../../utils/knitTextureRenderer';

interface SockViewer3DProps {
  config: ExtendedSockConfig;
  onSnapshotReady?: (dataUrl: string) => void;
  captureSnapshotRef?: React.MutableRefObject<(() => string | null) | null>;
  onUseSampleLogo?: () => void;
  onGridReady?: (grid: KnitPixelGrid) => void;
}

// Target center point of the sock & podium assembly
const TARGET = new THREE.Vector3(0, 0.50, 0);
const CAMERA_DISTANCE = 2.30;
const CAMERA_FOV = 28;
const ELEVATION_ANGLE = 0.17; // ~9.7° elevation so the sock fills ~88% of viewer height without clipping the cuff

// View presets (azimuth around target in radians)
const PRESETS = {
  frente: 2.2,
  lado: 1.2,
  talon: -0.3,
} as const;

type PresetKey = keyof typeof PRESETS;

/**
 * Draw a pixelated Jacquard circle on a 2D context (for foot zone)
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
 * Draw horizontal Jacquard stripes with subtle stitch teeth along edges (for cuff)
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

    for (let x = 0; x < 1024; x += stitchW) {
      ctx.fillRect(x, yTop - toothH, stitchW / 2, toothH);
      ctx.fillRect(x + stitchW / 2, yTop + hPx, stitchW / 2, toothH);
    }
  }
}

/**
 * Soft radial contact shadow texture placed on top of the dark studio podium
 */
function createContactShadowTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
  grad.addColorStop(0, 'rgba(2, 8, 14, 0.58)');
  grad.addColorStop(0.5, 'rgba(2, 8, 14, 0.26)');
  grad.addColorStop(1, 'rgba(2, 8, 14, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Lupa de alta nitidez: renderiza las puntadas en V directamente desde la
// cuadrícula real (KnitPixelGrid), sin cuadraditos ni desenfoque al ampliar.
// ---------------------------------------------------------------------------
interface KnitLupaProps {
  grid: KnitPixelGrid | null;
  config: ExtendedSockConfig;
  onClose: () => void;
  onUseSampleLogo?: () => void;
}

const LUPA_VIEW_CSS = 480;
const LENS_SIZE_CSS = 180;
const BASE_VISIBLE_COLS = 64; // agujas visibles a zoom x1 en la vista principal

const KnitLupa: React.FC<KnitLupaProps> = ({ grid, config, onClose, onUseSampleLogo }) => {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const lensRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(4);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [showGrid, setShowGrid] = useState(false);
  const [side, setSide] = useState<'front' | 'back'>('front');

  const getWindowCenter = useCallback(
    (g: KnitPixelGrid) => {
      const rotOffset = (config.logo.rotation || 0) / 360;
      const baseU = side === 'front' ? 0 : 0.5;
      const u = (((baseU + rotOffset) % 1) + 1) % 1;
      const centerCol = u * g.width;
      const centerRow = g.logoRect
        ? g.logoRect.rowCenter
        : Math.round((g.safeZone.minRow + g.safeZone.maxRow) / 2);
      return { centerCol, centerRow };
    },
    [config.logo.rotation, side]
  );

  // Render principal de la lupa (solo cuando cambia la cuadrícula, cara o rejilla)
  useEffect(() => {
    const view = viewRef.current;
    if (!grid || !view) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const backing = Math.round(LUPA_VIEW_CSS * dpr);
    if (view.width !== backing || view.height !== backing) {
      view.width = backing;
      view.height = backing;
    }
    const ctx = view.getContext('2d');
    if (!ctx) return;

    const { centerCol, centerRow } = getWindowCenter(grid);
    renderKnitMacroRegion(
      grid,
      ctx,
      backing,
      backing,
      centerCol,
      centerRow,
      BASE_VISIBLE_COLS,
      showGrid
    );
  }, [grid, getWindowCenter, showGrid]);

  // Render de la lente ampliada directamente desde KnitPixelGrid (sin polling)
  useEffect(() => {
    const lens = lensRef.current;
    if (!grid || !lens) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const backing = Math.round(LENS_SIZE_CSS * dpr);
    if (lens.width !== backing || lens.height !== backing) {
      lens.width = backing;
      lens.height = backing;
    }
    const ctx = lens.getContext('2d');
    if (!ctx) return;

    const { centerCol, centerRow } = getWindowCenter(grid);
    const pxPerColMain = LUPA_VIEW_CSS / BASE_VISIBLE_COLS;
    const pxPerRowMain = pxPerColMain * 0.84;
    const visibleRowsMain = LUPA_VIEW_CSS / pxPerRowMain;

    const focusCol = centerCol + (pos.x - 0.5) * BASE_VISIBLE_COLS;
    const focusRow = centerRow + (pos.y - 0.5) * visibleRowsMain;

    const lensVisibleCols = Math.max(5, (BASE_VISIBLE_COLS * (LENS_SIZE_CSS / LUPA_VIEW_CSS)) / (zoom * 0.55));

    renderKnitMacroRegion(
      grid,
      ctx,
      backing,
      backing,
      focusCol,
      focusRow,
      lensVisibleCols,
      showGrid
    );
  }, [grid, getWindowCenter, pos, zoom, showGrid]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({
      x: Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width)),
      y: Math.max(0.05, Math.min(0.95, (e.clientY - r.top) / r.height)),
    });
  };

  const hasLogo = Boolean(config.logo.url);
  const backAvailable = (config.logoPosition || (config.logo.repeatBack ? 'both' : 'front')) !== 'front';

  return createPortal(
    <div
      data-testid="lupa-modal"
      className="fixed inset-0 z-[200] bg-[#07131A]/95 backdrop-blur-md text-white flex flex-col p-3 sm:p-6 gap-3 overflow-auto"
    >
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-2">
        <div>
          <p className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-yarn-mustard" />
            <span>Lupa de punto tejido</span>
          </p>
          <p className="text-[11px] sm:text-xs text-slate-300">
            {grid ? `${grid.width} agujas · ${grid.totalInks} de ${MAX_MACHINE_INKS} tintas · ` : ''}
            Pasa el dedo o el ratón por encima para ver cada puntada en V con nitidez.
          </p>
        </div>
        <button
          type="button"
          data-testid="btn-close-lupa"
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/15 transition-colors"
          aria-label="Cerrar la lupa"
        >
          <X className="w-3.5 h-3.5" />
          Cerrar
        </button>
      </div>

      <div className="max-w-2xl mx-auto w-full flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-300">Ampliación:</span>
        {[2, 4, 6, 8].map((z) => (
          <button
            key={z}
            type="button"
            data-testid={`lupa-zoom-${z}`}
            onClick={() => setZoom(z)}
            className={`px-3 py-1.5 rounded-lg font-bold border transition-all ${
              zoom === z
                ? 'bg-yarn-mustard text-petrol-dark border-yarn-mustard'
                : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
            }`}
          >
            x{z}
          </button>
        ))}
        <button
          type="button"
          data-testid="lupa-toggle-grid"
          onClick={() => setShowGrid((g) => !g)}
          className={`px-3 py-1.5 rounded-lg font-bold border transition-all ${
            showGrid
              ? 'bg-turquoise text-white border-turquoise'
              : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
          }`}
        >
          Guía agujas
        </button>
        {backAvailable && (
          <button
            type="button"
            onClick={() => setSide((sd) => (sd === 'front' ? 'back' : 'front'))}
            className="px-3 py-1.5 rounded-lg font-bold border bg-white/10 text-white border-white/15 hover:bg-white/20"
          >
            {side === 'front' ? 'Ver detrás' : 'Ver delante'}
          </button>
        )}
      </div>

      <div
        className="relative mx-auto w-full max-w-[480px] aspect-square rounded-2xl overflow-hidden border border-white/20 touch-none select-none bg-[#0D171F] shadow-2xl cursor-crosshair"
        onPointerMove={onMove}
        onPointerDown={onMove}
      >
        <canvas
          ref={viewRef}
          className="w-full h-full block"
        />

        {/* Punto de enfoque */}
        <span
          className="absolute w-2.5 h-2.5 rounded-full bg-yarn-mustard ring-2 ring-white/90 pointer-events-none shadow"
          style={{ left: `calc(${pos.x * 100}% - 5px)`, top: `calc(${pos.y * 100}% - 5px)` }}
        />

        {/* Lente macro circular: siempre visible para ver las puntadas V sin cuadrados */}
        <canvas
          ref={lensRef}
          data-testid="lupa-lens-canvas"
          className="absolute rounded-full border-[3px] border-yarn-mustard shadow-[0_12px_40px_rgba(0,0,0,0.75)] pointer-events-none"
          style={{
            width: LENS_SIZE_CSS,
            height: LENS_SIZE_CSS,
            left: `clamp(8px, calc(${pos.x * 100}% - ${LENS_SIZE_CSS / 2}px), calc(100% - ${LENS_SIZE_CSS + 8}px))`,
            top: pos.y > 0.48
              ? `clamp(8px, calc(${pos.y * 100}% - ${LENS_SIZE_CSS + 18}px), calc(100% - ${LENS_SIZE_CSS + 8}px))`
              : `clamp(8px, calc(${pos.y * 100}% + 18px), calc(100% - ${LENS_SIZE_CSS + 8}px))`,
          }}
        />

        {!hasLogo && (
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 bg-[#0A1A23]/90 backdrop-blur-md border border-white/15 rounded-xl p-3">
            <p className="text-xs text-slate-200">
              Sube un logo o prueba uno de ejemplo para ver el dibujo en puntadas.
            </p>
            {onUseSampleLogo && (
              <button
                type="button"
                onClick={onUseSampleLogo}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-yarn-mustard text-petrol-dark hover:bg-white transition-colors"
              >
                Usar logo ejemplo
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mx-auto max-w-[480px] text-[11px] leading-relaxed text-slate-400 text-center">
        Cada píxel de la máquina (1 aguja) se teje como una puntada en forma de V. El diseño nunca supera las {MAX_MACHINE_INKS} tintas y respeta las zonas fijas de puño, talón y puntera.
      </p>
    </div>,
    document.body
  );
};

export const SockViewer3D: React.FC<SockViewer3DProps> = ({
  config,
  onSnapshotReady,
  captureSnapshotRef,
  onUseSampleLogo,
  onGridReady,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  const materialsRef = useRef<{
    cuff: THREE.MeshStandardMaterial;
    leg: THREE.MeshStandardMaterial;
    heel: THREE.MeshStandardMaterial;
    foot: THREE.MeshStandardMaterial;
    toe: THREE.MeshStandardMaterial;
  } | null>(null);

  const normalMapLegRef = useRef<THREE.CanvasTexture | null>(null);

  const cuffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cuffTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const legCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const legTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const footCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const footTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const [currentGrid, setCurrentGrid] = useState<KnitPixelGrid | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey | null>('frente');
  const [lupaOpen, setLupaOpen] = useState(false);

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

  // Redraw all zone textures from the single-source-of-truth KnitPixelGrid
  const updateZoneTextures = useCallback(() => {
    const cuffCanvas = cuffCanvasRef.current;
    const cuffTex = cuffTextureRef.current;
    const legCanvas = legCanvasRef.current;
    const legTex = legTextureRef.current;
    const footCanvas = footCanvasRef.current;
    const footTex = footTextureRef.current;
    const mats = materialsRef.current;

    if (!cuffCanvas || !cuffTex || !legCanvas || !legTex || !footCanvas || !footTex) return;

    const cuffCtx = cuffCanvas.getContext('2d');
    const footCtx = footCanvas.getContext('2d');
    if (!cuffCtx || !footCtx) return;

    // 0. Actualizar color de TALÓN Y PUNTERA (solo color; geometría, medida y posición 100% fijas)
    if (mats) {
      const htColor = config.heelToeColor || DEFAULT_HEEL_TOE_COLOR;
      mats.heel.color.set(htColor);
      mats.toe.color.set(htColor);
    }

    const pattern = config.pattern || {
      type: 'none',
      color: '#1F4D63',
      stripesZone: 'cuff',
      stripesThickness: 'medium',
      stripesCount: 3,
      dotsSize: 'medium',
      dotsDensity: 'medium',
    };

    const resolvePatternColor = (zoneBg: string, patColor: string): string => {
      if (zoneBg.trim().toLowerCase() !== patColor.trim().toLowerCase()) {
        return patColor;
      }
      if (config.legColor.trim().toLowerCase() !== zoneBg.trim().toLowerCase()) {
        return config.legColor;
      }
      return zoneBg.trim().toLowerCase() === '#ffffff' ? '#1F4D63' : '#FFFFFF';
    };

    const needles = config.needleCount === 200 ? 200 : 168;

    // =========================================================================
    // 1. CUFF CANVAS (Puño con acanalado canalé 2x2 visible)
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

    // Acanalado visible en el puño
    renderCuffRibbingOverlay(cuffCtx, 1024, 1024, needles);
    cuffTex.needsUpdate = true;

    // =========================================================================
    // 2. LEG CANVAS — ÚNICA FUENTE DE VERDAD: KnitPixelGrid (168 o 200 agujas)
    // =========================================================================
    const grid = buildKnitPixelGrid(config, logoImageRef.current);
    setCurrentGrid(grid);
    if (onGridReady) {
      onGridReady(grid);
    }

    // Pintar la cuadrícula como textura de punto tejido en alta resolución (puntadas en V)
    renderGridToKnitCanvas(grid, legCanvas);

    // Alinear el normal map de puntadas en V exactamente con el número de agujas
    if (normalMapLegRef.current) {
      normalMapLegRef.current.repeat.set(grid.width / 8, grid.height / 8);
      normalMapLegRef.current.needsUpdate = true;
    }

    legTex.needsUpdate = true;

    // =========================================================================
    // 3. FOOT CANVAS (Base + Lunares/Cuadros opcionales + micro-punto)
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
        for (let c = 0; c < cols; c++) {
          const u = 0.08 + ((c + 0.3 + (r % 2) * 0.4) / cols) * 0.84;
          drawPixelatedCircle(footCtx, u * 1024, v * 1024, radiusPx, footPatColor, 6);
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
          footCtx.fillRect(
            Math.round(c * cellW),
            Math.round(r * cellH),
            Math.round(cellW * 0.78),
            Math.round(cellH * 0.78)
          );
        }
      }
    }

    // Sutil trama de punto en el pie
    footCtx.fillStyle = 'rgba(0, 0, 0, 0.035)';
    for (let y = 0; y < 1024; y += 8) {
      footCtx.fillRect(0, y, 1024, 1.5);
    }

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
    config,
    onSnapshotReady,
    onGridReady,
  ]);

  // Expose live snapshot capture helper for PDF, Preview, and Quote actions
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

  // Preload logo image (100% local in browser)
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

    // 2. Camera
    const aspect = container.clientWidth / (container.clientHeight || 1);
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

    // 3. Renderer con fondo oscuro de estudio (#0A1A23, igual que la portada nueva)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x0a1a23, 1);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());

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

    // 5. Iluminación de estudio de 3 puntos (clave cálida + relleno suave + contraluz de perfil)
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x0f2533, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf2, 1.45);
    keyLight.position.set(-2.2, 3.8, 2.6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.62);
    fillLight.position.set(2.6, 1.9, 1.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.85);
    rimLight.position.set(0.5, 2.6, -2.9);
    scene.add(rimLight);

    // 6. Peana cilíndrica oscura de estudio (integrada con el fondo #0A1A23)
    const podiumGeo = new THREE.CylinderGeometry(0.40, 0.42, 0.075, 64);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x152c39,
      roughness: 0.36,
      metalness: 0.16,
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.set(0, -0.0375, 0);
    scene.add(podium);

    // Sombra de contacto suave sobre la peana
    const contactShadowTex = createContactShadowTexture();
    const contactShadowGeo = new THREE.PlaneGeometry(0.66, 0.66);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(-0.08, 0.001, 0.04);
    scene.add(contactShadow);

    // 7. Normal Maps: puntadas en V para caña/pie/talón/puntera y canalé para el puño
    const baseStitchNormal = createKnitStitchNormalTexture(maxAnisotropy);
    const normalMapLeg = baseStitchNormal ? baseStitchNormal.clone() : null;
    if (normalMapLeg) {
      normalMapLeg.repeat.set(21, 26); // se ajusta dinámicamente a grid.width/8 x grid.height/8
      normalMapLeg.anisotropy = maxAnisotropy;
      normalMapLeg.needsUpdate = true;
    }
    normalMapLegRef.current = normalMapLeg;

    const normalMapFootHeelToe = baseStitchNormal ? baseStitchNormal.clone() : null;
    if (normalMapFootHeelToe) {
      normalMapFootHeelToe.repeat.set(24, 22);
      normalMapFootHeelToe.anisotropy = maxAnisotropy;
      normalMapFootHeelToe.needsUpdate = true;
    }

    const normalMapCuffRib = createCuffRibNormalTexture(maxAnisotropy);
    if (normalMapCuffRib) {
      normalMapCuffRib.repeat.set(5, 2);
      normalMapCuffRib.needsUpdate = true;
    }

    // 8. Texturas de alta resolución con filtrado suave y anisotropía alta
    const makeZoneTexture = (
      canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
      texRef: React.MutableRefObject<THREE.CanvasTexture | null>,
      initialColor: string,
      width = 1024,
      height = 1024
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = initialColor;
        ctx.fillRect(0, 0, width, height);
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
      tex.anisotropy = maxAnisotropy;
      texRef.current = tex;
      return tex;
    };

    const cuffTexture = makeZoneTexture(cuffCanvasRef, cuffTextureRef, config.cuffColor, 1024, 1024);
    const legTexture = makeZoneTexture(legCanvasRef, legTextureRef, config.legColor, 2016, 2100);
    const footTexture = makeZoneTexture(footCanvasRef, footTextureRef, config.footColor, 1024, 1024);

    // 9. Materiales textiles mates (algodón / poliamida) con relieve suave
    const cuffMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map: cuffTexture,
      roughness: 0.92,
      metalness: 0,
      normalMap: normalMapCuffRib,
      normalScale: new THREE.Vector2(0.85, 0.45),
    });

    const legMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map: legTexture,
      roughness: 0.92,
      metalness: 0,
      normalMap: normalMapLeg,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });

    const heelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.heelToeColor || DEFAULT_HEEL_TOE_COLOR),
      roughness: 0.94,
      metalness: 0,
      normalMap: normalMapFootHeelToe,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });

    const footMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map: footTexture,
      roughness: 0.93,
      metalness: 0,
      normalMap: normalMapFootHeelToe,
      normalScale: new THREE.Vector2(0.5, 0.5),
    });

    const toeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.heelToeColor || DEFAULT_HEEL_TOE_COLOR),
      roughness: 0.94,
      metalness: 0,
      normalMap: normalMapFootHeelToe,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });

    materialsRef.current = {
      cuff: cuffMat,
      leg: legMat,
      heel: heelMat,
      foot: footMat,
      toe: toeMat,
    };

    // 10. Cargar modelo 3D (/calcetin-mmz.glb) manteniendo talón y puntera 100% fijos
    const loader = new GLTFLoader();
    loader.load(
      '/calcetin-mmz.glb',
      (gltf) => {
        if (isDisposed) return;

        gltf.scene.position.set(-0.16, 0, 0.03);

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;

            const name =
              (Array.isArray(mesh.material)
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
            duration: 2400,
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
      if (introAnimRef.current?.active) introAnimRef.current.active = false;
      if (presetAnimRef.current?.active) presetAnimRef.current.active = false;
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

        if (progress >= 1.0) anim.active = false;
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

        if (progress >= 1.0) anim.active = false;
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
      const height = container.clientHeight || 1;
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
      baseStitchNormal?.dispose();
      normalMapLeg?.dispose();
      normalMapFootHeelToe?.dispose();
      normalMapCuffRib?.dispose();
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

    if (introAnimRef.current?.active) introAnimRef.current.active = false;

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
    <div className="relative w-full h-[330px] sm:h-[420px] md:h-[480px] rounded-3xl overflow-hidden bg-[#0A1A23] border border-slate-800 shadow-float select-none flex flex-col justify-between">
      {/* Top Overlay: View Presets, Lupa & Auto Rotate */}
      <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex items-center justify-between pointer-events-none gap-2">
        {/* Camera Preset Buttons */}
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-2xl shadow-sm border border-white/15 pointer-events-auto">
          {(['frente', 'lado', 'talon'] as PresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCameraPreset(key)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-xl transition-all capitalize ${
                activePreset === key && !autoRotate
                  ? 'bg-yarn-mustard text-petrol-dark shadow-xs'
                  : 'text-white/85 hover:bg-white/10'
              }`}
            >
              {key === 'talon' ? 'Talón' : key}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            data-testid="btn-open-lupa"
            onClick={() => setLupaOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-2xl backdrop-blur-md transition-all shadow-sm border bg-white/15 text-white border-white/20 hover:bg-white/25"
            aria-label="Abrir la lupa para ver el tejido de cerca"
          >
            <ZoomIn className="w-3.5 h-3.5 text-yarn-mustard" />
            <span>Lupa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (introAnimRef.current?.active) introAnimRef.current.active = false;
              if (presetAnimRef.current?.active) presetAnimRef.current.active = false;
              setAutoRotate(!autoRotate);
              if (!autoRotate) setActivePreset(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-2xl backdrop-blur-md transition-all shadow-sm border ${
              autoRotate
                ? 'bg-turquoise text-white border-turquoise shadow-glow'
                : 'bg-white/10 text-white/90 border-white/15 hover:bg-white/20'
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
          <div className="absolute inset-0 flex items-center justify-center bg-[#0A1A23]/80 backdrop-blur-xs z-10">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Sparkles className="w-5 h-5 text-yarn-mustard animate-pulse" />
              <span>Cargando calcetín 3D...</span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A1A23]/95 backdrop-blur-sm z-30 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-300 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Error al cargar el visor 3D</h4>
            <p className="text-xs text-slate-300 mb-4 max-w-xs">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yarn-mustard text-petrol-dark text-xs font-semibold rounded-xl hover:bg-white transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        )}
      </div>

      {lupaOpen && (
        <KnitLupa
          grid={currentGrid}
          config={config}
          onClose={() => setLupaOpen(false)}
          onUseSampleLogo={onUseSampleLogo}
        />
      )}

      {/* Bottom Overlay: Locked Zone Notice & Drag hint */}
      <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-2 pointer-events-none">
        <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-[11px] sm:text-xs font-medium shadow-md border border-white/15 pointer-events-auto">
          <Lock className="w-3.5 h-3.5 text-yarn-mustard flex-shrink-0" />
          <span>
            <strong className="text-white">Zona fija:</strong> talón y puntera (solo cambia el color)
          </span>
        </div>

        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-slate-200 text-[11px] font-medium border border-white/15">
          <Eye className="w-3.5 h-3.5 text-yarn-mustard" />
          <span>Arrastra para rotar</span>
        </div>
      </div>
    </div>
  );
};
