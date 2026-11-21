import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RotateCw, Eye, Sparkles, AlertCircle, RefreshCw, ZoomIn, X } from 'lucide-react';
import { ExtendedSockConfig } from '../../utils/pricing';
import { DEFAULT_HEEL_TOE_COLOR } from '../../data/yarnPalette';
import { buildKnitPixelGrid, KnitPixelGrid } from '../../utils/knitPixelEngine';
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
  resetViewSignal?: number;
}

// Target center point of the sock & podium assembly (entero y ~24% más grande con margen libre arriba y abajo en 360-430px y escritorio)
const TARGET = new THREE.Vector3(0, 0.59, 0);
const CAMERA_DISTANCE = 3.02;
const CAMERA_FOV = 23;
const ELEVATION_ANGLE = 0.23; // ~13.2° sobre la horizontal (polar ~76.8°, dentro de 60°-100°)

// View presets (azimuth around target in radians)
// Frente en 3/4 (~13° desde el centro del logo) para que el logo se lea entero ("CHURRERÍA PEPE") y la puntera/talón tengan proporción natural
const PRESETS = {
  frente: 2.42,
  lado: 1.05,
  talon: -0.35,
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
 * Draw horizontal Jacquard stripes with soft anti-aliased edges (avoids zigzag moiré on high-DPI screens)
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

  for (let i = 0; i < safeCount; i++) {
    const centerV = vStart + step * (i + 0.5);
    const yTop = Math.round((centerV - bandH / 2) * 1024);
    const hPx = Math.max(8, Math.round(bandH * 1024));

    ctx.fillStyle = stripeColor;
    ctx.fillRect(0, yTop, 1024, hPx);

    // Borde suavizado de 2 px para que el mipmapping filtre sin dientes de sierra ni moaré
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillRect(0, yTop - 2, 1024, 2);
    ctx.fillRect(0, yTop + hPx, 1024, 2);
    ctx.restore();
  }
}

/**
 * Light studio gradient backdrop texture (contrast for white, black and colored socks, and preserved in PDF/PNG snapshots)
 */
function createStudioBackgroundTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base vertical suave gris-azulado claro a gris medio
  const vGrad = ctx.createLinearGradient(0, 0, 0, 512);
  vGrad.addColorStop(0.0, '#D2DCE6');
  vGrad.addColorStop(0.55, '#DCE5EE');
  vGrad.addColorStop(1.0, '#B9C6D3');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Halo sutil de foco de estudio detrás del calcetín
  const rGrad = ctx.createRadialGradient(256, 224, 28, 256, 232, 260);
  rGrad.addColorStop(0.0, 'rgba(244, 248, 252, 0.72)');
  rGrad.addColorStop(0.6, 'rgba(232, 240, 247, 0.25)');
  rGrad.addColorStop(1.0, 'rgba(185, 198, 211, 0.0)');
  ctx.fillStyle = rGrad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Soft radial contact shadow texture placed on top of the studio podium
 */
function createContactShadowTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
  grad.addColorStop(0, 'rgba(15, 35, 50, 0.30)');
  grad.addColorStop(0.5, 'rgba(15, 35, 50, 0.12)');
  grad.addColorStop(1, 'rgba(15, 35, 50, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Lupa integrada DENTRO del visor 3D: lente circular que sigue al dedo o al
// ratón sobre el calcetín, sin abrir ventana a pantalla completa ni recortar.
// ---------------------------------------------------------------------------
interface InlineKnitLupaProps {
  grid: KnitPixelGrid | null;
  config: ExtendedSockConfig;
  initialAnchor: { x: number; y: number };
  onClose: () => void;
}

const InlineKnitLupa: React.FC<InlineKnitLupaProps> = ({
  grid,
  config,
  initialAnchor,
  onClose,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // Caché del tejido completo en alta resolución (6 px/puntada) para que arrastrar la lupa a x2/x4 sea instantáneo (<1 ms)
  const knitCacheRef = useRef<{ grid: KnitPixelGrid | null; canvas: HTMLCanvasElement | null }>({
    grid: null,
    canvas: null,
  });
  const [zoom, setZoom] = useState<2 | 4 | 6 | 8>(2);
  // Punto de anclaje real del logo sobre el calcetín 3D en coordenadas normalizadas del visor
  const [anchor] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(0.2, Math.min(0.8, initialAnchor.x)),
    y: Math.max(0.24, Math.min(0.72, initialAnchor.y)),
  }));
  // Posición actual del centro de la lente (empieza exactamente centrada sobre el logo)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.max(0.2, Math.min(0.8, initialAnchor.x)),
    y: Math.max(0.24, Math.min(0.72, initialAnchor.y)),
  }));
  const [side, setSide] = useState<'front' | 'back'>('front');

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const lensSize = isMobile ? 156 : 186;

  const drawLens = useCallback(() => {
    const lens = lensRef.current;
    if (!grid || !lens) return;

    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    const backing = Math.round(lensSize * dpr);
    if (lens.width !== backing || lens.height !== backing) {
      lens.width = backing;
      lens.height = backing;
    }
    const ctx = lens.getContext('2d');
    if (!ctx) return;

    const rotOffset = (config.logo.rotation || 0) / 360;
    const baseU = side === 'front' ? 0 : 0.5;
    const u = (((baseU + rotOffset) % 1) + 1) % 1;
    const baseCol = u * grid.width;
    const baseRow = grid.logoRect
      ? grid.logoRect.rowCenter
      : Math.round((grid.safeZone.minRow + grid.safeZone.maxRow) / 2);

    // En x2 mostramos el dibujo ENTERO centrado con margen (sin recortar por los lados).
    // Al subir a x4, x6, x8 ampliamos progresivamente sobre el punto bajo la lente.
    const fullLogoCols = grid.logoRect ? Math.max(52, Math.round(grid.logoRect.cols * 1.32)) : 64;
    const visibleCols = Math.max(10, fullLogoCols / (zoom / 2));

    // Desplazamiento exacto desde el centro real del logo (anchor) hacia la posición actual de la lente
    const panCols = grid.logoRect ? grid.logoRect.cols * 1.2 : grid.width * 0.36;
    const panRows = grid.logoRect ? grid.logoRect.rows * 1.45 : grid.height * 0.45;
    const focusCol = baseCol + (pos.x - anchor.x) * panCols;
    const focusRow = baseRow + (pos.y - anchor.y) * panRows;

    // Para x2 y x4 (muchas puntadas visibles), recortamos desde la textura V-stitch cacheada (<1 ms, 0 bloqueos).
    // Para x6 y x8 (pocas puntadas visibles), renderizamos macro vectorial con torsión de fibras (<10 ms).
    if (zoom <= 4) {
      if (knitCacheRef.current.grid !== grid || !knitCacheRef.current.canvas) {
        const cache = document.createElement('canvas');
        renderGridToKnitCanvas(grid, cache, false);
        knitCacheRef.current = { grid, canvas: cache };
      }
      const src = knitCacheRef.current.canvas;
      if (src) {
        const scaleX = src.width / grid.width;
        const scaleY = src.height / grid.height;
        const visibleRows = visibleCols * 0.92;
        const sw = visibleCols * scaleX;
        const sh = visibleRows * scaleY;
        const sxRaw = (focusCol - visibleCols / 2) * scaleX;
        const sy = Math.max(0, Math.min(src.height - sh, (focusRow - visibleRows / 2) * scaleY));

        // Wrap cilíndrico horizontal (la caña es un tubo continuo)
        const sx = ((sxRaw % src.width) + src.width) % src.width;
        ctx.clearRect(0, 0, backing, backing);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (sx + sw <= src.width) {
          ctx.drawImage(src, sx, sy, sw, sh, 0, 0, backing, backing);
        } else {
          const firstW = src.width - sx;
          const secondW = sw - firstW;
          const firstDestW = (firstW / sw) * backing;
          ctx.drawImage(src, sx, sy, firstW, sh, 0, 0, firstDestW, backing);
          ctx.drawImage(src, 0, sy, secondW, sh, firstDestW, 0, backing - firstDestW, backing);
        }
        return;
      }
    }

    renderKnitMacroRegion(grid, ctx, backing, backing, focusCol, focusRow, visibleCols, false);
  }, [grid, config.logo.rotation, side, zoom, pos, anchor, lensSize, isMobile]);

  // Throttle por requestAnimationFrame para 0 bloqueos al arrastrar la lupa
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawLens();
    });
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [drawLens]);

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const rawX = e.clientX - r.left;
    // En táctil, desplazamos la lente hacia arriba (~radio de la lente) para que el dedo no la tape
    const touchLiftPx = e.pointerType === 'touch' ? Math.round(lensSize * 0.58) : 0;
    const rawY = e.clientY - r.top - touchLiftPx;

    const half = lensSize / 2;
    const minX = half + 10;
    const maxX = Math.max(minX, r.width - half - 10);
    const minY = half + 60;
    const maxY = Math.max(minY, r.height - half - 42);

    const clampedX = Math.max(minX, Math.min(maxX, rawX));
    const clampedY = Math.max(minY, Math.min(maxY, rawY));

    setPos({
      x: clampedX / r.width,
      y: clampedY / r.height,
    });
  };

  const backAvailable = (config.logoPosition || (config.logo.repeatBack ? 'both' : 'front')) !== 'front';

  return (
    <div
      ref={overlayRef}
      data-testid="lupa-inline-overlay"
      className="absolute inset-0 z-30 select-none touch-none cursor-crosshair"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (e.pointerType === 'mouse' || e.buttons > 0) {
          handlePointer(e);
        }
      }}
    >
      {/* Barra superior pegada al visor: aumentos x2/x4/x6/x8 + Cerrar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-1 bg-petrol-dark/90 backdrop-blur-md p-1 rounded-2xl border border-white/20 shadow-lg">
          {([2, 4, 6, 8] as const).map((z) => (
            <button
              key={z}
              type="button"
              data-testid={`lupa-zoom-${z}`}
              onClick={() => setZoom(z)}
              className={`px-3 min-h-[40px] rounded-xl text-xs font-extrabold transition-all ${
                zoom === z
                  ? 'bg-yarn-mustard text-petrol-dark shadow-xs'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              x{z}
            </button>
          ))}
          {backAvailable && (
            <button
              type="button"
              onClick={() => setSide((s) => (s === 'front' ? 'back' : 'front'))}
              className="px-2.5 min-h-[40px] rounded-xl text-[11px] font-bold text-white/90 hover:bg-white/10"
            >
              {side === 'front' ? 'Detrás' : 'Delante'}
            </button>
          )}
        </div>

        <button
          type="button"
          data-testid="btn-close-lupa"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-2xl bg-petrol-dark/90 hover:bg-petrol text-white text-xs font-bold border border-white/25 shadow-lg transition-colors"
          aria-label="Cerrar lupa"
        >
          <X className="w-4 h-4 text-yarn-mustard" />
          <span>Cerrar</span>
        </button>
      </div>

      {/* Lente circular dentro del visor 3D (siempre dentro de los límites del visor) */}
      <canvas
        ref={lensRef}
        data-testid="lupa-lens-canvas"
        className="absolute rounded-full border-[3px] border-yarn-mustard shadow-[0_14px_36px_rgba(15,35,50,0.45)] pointer-events-none"
        style={{
          width: lensSize,
          height: lensSize,
          left: `clamp(10px, calc(${pos.x * 100}% - ${lensSize / 2}px), calc(100% - ${lensSize + 10}px))`,
          top: `clamp(60px, calc(${pos.y * 100}% - ${lensSize / 2}px), calc(100% - ${lensSize + 42}px))`,
        }}
      />

      {/* Indicación corta en la base del visor */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-center pointer-events-none">
        <span className="px-3 py-1 rounded-full bg-petrol-dark/85 backdrop-blur-md border border-white/15 text-[11px] text-white font-medium shadow-md">
          Mueve el dedo o el ratón sobre el calcetín para ver el tejido de cerca
        </span>
      </div>
    </div>
  );
};

export const SockViewer3D: React.FC<SockViewer3DProps> = ({
  config,
  onSnapshotReady,
  captureSnapshotRef,
  onUseSampleLogo: _onUseSampleLogo,
  onGridReady,
  resetViewSignal,
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
  const [logoVersion, setLogoVersion] = useState(0);
  const [currentGrid, setCurrentGrid] = useState<KnitPixelGrid | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey | null>('frente');
  const [lupaOpen, setLupaOpen] = useState(false);
  const [lupaAnchor, setLupaAnchor] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.44 });
  const legBoundsRef = useRef<THREE.Box3 | null>(null);

  // Refs estables para evitar recalcular texturas al girar la cámara o al cambiar callbacks del padre
  const configRef = useRef(config);
  configRef.current = config;
  const onSnapshotReadyRef = useRef(onSnapshotReady);
  onSnapshotReadyRef.current = onSnapshotReady;
  const onGridReadyRef = useRef(onGridReady);
  onGridReadyRef.current = onGridReady;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const isVisibleRef = useRef(true);
  const requestRenderRef = useRef<() => void>(() => {});
  const lastRenderedKeyRef = useRef<string>('');
  const hasInitialTextureRef = useRef(false);

  // Clave visual estable: ignora cantidad y material (no afectan a la textura 3D)
  const designKey = useMemo(
    () =>
      JSON.stringify({
        cuffColor: config.cuffColor,
        legColor: config.legColor,
        footColor: config.footColor,
        heelToeColor: config.heelToeColor,
        needleCount: config.needleCount ?? 168,
        maxColors: config.maxColors ?? 6,
        cleanEdges: config.cleanEdges ?? true,
        logoColorOverrides: config.logoColorOverrides,
        pattern: config.pattern,
        logo: config.logo,
        logoBg: config.logoBg,
        logoPosition: config.logoPosition,
        knittedText: config.knittedText,
      }),
    [
      config.cuffColor,
      config.legColor,
      config.footColor,
      config.heelToeColor,
      config.needleCount,
      config.maxColors,
      config.cleanEdges,
      config.logoColorOverrides,
      config.pattern,
      config.logo,
      config.logoBg,
      config.logoPosition,
      config.knittedText,
    ]
  );

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
    startDistance: number;
    targetDistance: number;
  } | null>(null);

  // Redraw all zone textures ONLY when designKey or logoVersion actually changes
  const updateZoneTextures = useCallback((forceKey?: string) => {
    const cuffCanvas = cuffCanvasRef.current;
    const cuffTex = cuffTextureRef.current;
    const legCanvas = legCanvasRef.current;
    const legTex = legTextureRef.current;
    const footCanvas = footCanvasRef.current;
    const footTex = footTextureRef.current;
    const mats = materialsRef.current;

    if (!cuffCanvas || !cuffTex || !legCanvas || !legTex || !footCanvas || !footTex) return;

    if (forceKey && lastRenderedKeyRef.current === forceKey) {
      return;
    }

    const cfg = configRef.current;
    const cuffCtx = cuffCanvas.getContext('2d');
    const footCtx = footCanvas.getContext('2d');
    if (!cuffCtx || !footCtx) return;

    // 0. Actualizar color de TALÓN Y PUNTERA (solo color; geometría, medida y posición 100% fijas)
    if (mats) {
      const htColor = cfg.heelToeColor || DEFAULT_HEEL_TOE_COLOR;
      mats.heel.color.set(htColor);
      mats.toe.color.set(htColor);
    }

    const pattern = cfg.pattern || {
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
      if (cfg.legColor.trim().toLowerCase() !== zoneBg.trim().toLowerCase()) {
        return cfg.legColor;
      }
      return zoneBg.trim().toLowerCase() === '#ffffff' ? '#1F4D63' : '#FFFFFF';
    };

    const needles = cfg.needleCount === 200 ? 200 : 168;

    // =========================================================================
    // 1. CUFF CANVAS (Puño con acanalado canalé 2x2 visible)
    // =========================================================================
    const hasCuffStripes =
      pattern.type === 'stripes' &&
      (pattern.stripesZone === 'cuff' || pattern.stripesZone === 'all');

    const sameCuffAndStripeColor =
      hasCuffStripes &&
      cfg.cuffColor.trim().toLowerCase() === pattern.color.trim().toLowerCase() &&
      cfg.legColor.trim().toLowerCase() !== cfg.cuffColor.trim().toLowerCase();

    if (sameCuffAndStripeColor) {
      cuffCtx.fillStyle = cfg.legColor;
      cuffCtx.fillRect(0, 0, 1024, 1024);
      cuffCtx.fillStyle = cfg.cuffColor;
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
      cuffCtx.fillStyle = cfg.cuffColor;
      cuffCtx.fillRect(0, 0, 1024, 1024);
      if (hasCuffStripes) {
        const effColor = resolvePatternColor(cfg.cuffColor, pattern.color);
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
    const grid = buildKnitPixelGrid(cfg, logoImageRef.current);
    setCurrentGrid(grid);
    if (onGridReadyRef.current) {
      onGridReadyRef.current(grid);
    }

    // Pintar la cuadrícula como textura de punto tejido (compacta en móvil para menor carga GPU)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    renderGridToKnitCanvas(grid, legCanvas, isMobile);

    // Alinear el normal map de puntadas en V exactamente con el número de agujas
    if (normalMapLegRef.current) {
      normalMapLegRef.current.repeat.set(grid.width / 8, grid.height / 8);
      normalMapLegRef.current.needsUpdate = true;
    }

    legTex.needsUpdate = true;

    // =========================================================================
    // 3. FOOT CANVAS (Base + Lunares/Cuadros opcionales + micro-punto)
    // =========================================================================
    footCtx.fillStyle = cfg.footColor;
    footCtx.fillRect(0, 0, 1024, 1024);

    const footPatColor = resolvePatternColor(cfg.footColor, pattern.color);

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

    if (forceKey) {
      lastRenderedKeyRef.current = forceKey;
    }
    hasInitialTextureRef.current = true;
    requestRenderRef.current();
  }, []);

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
    let cancelled = false;
    if (config.logo.url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        logoImageRef.current = img;
        setLogoVersion((v) => v + 1);
      };
      img.onerror = () => {
        if (cancelled) return;
        logoImageRef.current = null;
        setLogoVersion((v) => v + 1);
      };
      img.src = config.logo.url;
    } else {
      logoImageRef.current = null;
      setLogoVersion((v) => v + 1);
    }
    return () => {
      cancelled = true;
    };
  }, [config.logo.url]);

  // Redibujar texturas SOLO cuando cambia el diseño o el logo, con debounce de 150 ms
  useEffect(() => {
    const effectiveKey = `${designKey}|v=${logoVersion}`;
    if (!hasInitialTextureRef.current) {
      updateZoneTextures(effectiveKey);
      return;
    }
    const timer = window.setTimeout(() => {
      updateZoneTextures(effectiveKey);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [designKey, logoVersion, updateZoneTextures]);

  // Update autoRotate on controls & wake on-demand renderer
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = 2.0;
    }
    if (autoRotate) {
      requestRenderRef.current();
    }
  }, [autoRotate]);

  // Initialize Three.js scene and load GLTF model
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let animationFrameId: number;

    // 1. Scene con fondo degradado claro de estudio (contraste nítido con calcetín blanco, negro y de color)
    const scene = new THREE.Scene();
    const studioBgTex = createStudioBackgroundTexture();
    if (studioBgTex) {
      scene.background = studioBgTex;
    }
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

    // 3. Renderer con antialias activo en móvil y escritorio, pixelRatio min(dpr, 2) para bordes suaves en pantallas 2.6x-3x
    const isMobile = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xd4dee8, 1);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const normalAnisotropy = Math.min(4, maxAnisotropy);

    // 4. OrbitControls: vertical bloqueado entre ~60° y ~100°, giro horizontal libre, zoom acotado, sin paneo
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.target.copy(TARGET);
    controls.enableZoom = true;
    controls.minDistance = 1.95;
    controls.maxDistance = 4.2;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = Math.PI * (60 / 180);
    controls.maxPolarAngle = Math.PI * (100 / 180);

    // 5. Iluminación luminosa de estudio (el calcetín blanco se ve blanco puro y talón/puntera oscuros conservan volumen)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.45);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
    keyLight.position.set(-2.2, 3.6, 2.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf1f5f9, 0.85);
    fillLight.position.set(2.4, 1.8, 2.2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
    rimLight.position.set(1.2, 2.6, -2.6);
    scene.add(rimLight);

    // 6. Peana cilíndrica clara de estudio
    const podiumGeo = new THREE.CylinderGeometry(0.40, 0.42, 0.075, 64);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0xd5dfe8,
      roughness: 0.42,
      metalness: 0.08,
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
    const baseStitchNormal = createKnitStitchNormalTexture(normalAnisotropy);
    const normalMapLeg = baseStitchNormal ? baseStitchNormal.clone() : null;
    if (normalMapLeg) {
      normalMapLeg.repeat.set(21, 26); // se ajusta dinámicamente a grid.width/8 x grid.height/8
      normalMapLeg.anisotropy = normalAnisotropy;
      normalMapLeg.needsUpdate = true;
    }
    normalMapLegRef.current = normalMapLeg;

    const normalMapFootHeelToe = baseStitchNormal ? baseStitchNormal.clone() : null;
    if (normalMapFootHeelToe) {
      normalMapFootHeelToe.repeat.set(24, 22);
      normalMapFootHeelToe.anisotropy = normalAnisotropy;
      normalMapFootHeelToe.needsUpdate = true;
    }

    const normalMapCuffRib = createCuffRibNormalTexture(normalAnisotropy);
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
    const legTexture = makeZoneTexture(
      legCanvasRef,
      legTextureRef,
      config.legColor,
      isMobile ? 672 : 1008,
      isMobile ? 840 : 1260
    );
    const footTexture = makeZoneTexture(footCanvasRef, footTextureRef, config.footColor, 1024, 1024);

    // 9. Materiales textiles mates (algodón / poliamida) con relieve suave
    const cuffMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffffff),
      map: cuffTexture,
      roughness: 0.92,
      metalness: 0,
      normalMap: normalMapCuffRib,
      normalScale: new THREE.Vector2(0.55, 0.25),
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
        gltf.scene.updateMatrixWorld(true);
        // Guardar la caja envolvente real de la caña para centrar la lupa exactamente sobre el logo
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            if (m.material === legMat) {
              legBoundsRef.current = new THREE.Box3().setFromObject(m);
            }
          }
        });
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

        if (onSnapshotReadyRef.current) {
          setTimeout(() => {
            if (isDisposed) return;
            renderer.render(scene, camera);
            try {
              const url = renderer.domElement.toDataURL('image/png');
              onSnapshotReadyRef.current?.(url);
            } catch {
              // ignore snapshot error
            }
          }, 500);
        }

        requestRenderRef.current();
      },
      undefined,
      (error) => {
        if (isDisposed) return;
        console.error('Error loading sock 3D model:', error);
        setIsLoading(false);
        setLoadError('No se pudo cargar el modelo 3D del calcetín.');
      }
    );

    // Renderizado bajo demanda: máximo 1 RAF pendiente a la vez (sin fork bomb con OrbitControls 'change')
    let rafActive = false;
    let isTicking = false;
    let needsFrame = true;
    const prevCamPos = new THREE.Vector3().copy(camera.position);

    const tick = (currentTime: number) => {
      rafActive = false;
      if (isDisposed || !isVisibleRef.current) return;

      isTicking = true;
      let keepLooping = false;

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
        } else {
          keepLooping = true;
        }
      } else if (presetAnimRef.current?.active) {
        const anim = presetAnimRef.current;
        const elapsed = currentTime - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1.0);
        const ease = 1.0 - Math.pow(1.0 - progress, 3);

        const currentTheta = anim.startTheta + (anim.targetTheta - anim.startTheta) * ease;
        const currentPhi = anim.startPhi + (anim.targetPhi - anim.startPhi) * ease;
        const currentDist = anim.startDistance + (anim.targetDistance - anim.startDistance) * ease;

        const curRHoriz = currentDist * Math.cos(currentPhi);
        const curRVert = currentDist * Math.sin(currentPhi);

        camera.position.set(
          TARGET.x + curRHoriz * Math.sin(currentTheta),
          TARGET.y + curRVert,
          TARGET.z + curRHoriz * Math.cos(currentTheta)
        );
        controls.target.copy(TARGET);
        controls.update();

        if (progress >= 1.0) {
          anim.active = false;
        } else {
          keepLooping = true;
        }
      } else {
        controls.update();
      }

      isTicking = false;

      const camDeltaSq = prevCamPos.distanceToSquared(camera.position);
      if (camDeltaSq > 1e-7) {
        prevCamPos.copy(camera.position);
        keepLooping = true;
      }

      if (autoRotateRef.current) {
        keepLooping = true;
      }

      if (needsFrame || keepLooping) {
        needsFrame = false;
        renderer.render(scene, camera);
      }

      if (keepLooping && !rafActive && isVisibleRef.current && !isDisposed) {
        rafActive = true;
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    const requestRender = () => {
      needsFrame = true;
      if (!isTicking && !rafActive && isVisibleRef.current && !isDisposed) {
        rafActive = true;
        animationFrameId = requestAnimationFrame(tick);
      }
    };
    requestRenderRef.current = requestRender;

    const handleUserInteraction = () => {
      if (introAnimRef.current?.active) introAnimRef.current.active = false;
      if (presetAnimRef.current?.active) presetAnimRef.current.active = false;
      requestRender();
    };
    container.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', requestRender);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          requestRender();
        } else if (rafActive) {
          cancelAnimationFrame(animationFrameId);
          rafActive = false;
        }
      },
      { rootMargin: '150px' }
    );
    visibilityObserver.observe(container);

    requestRender();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      requestRender();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('pointerdown', handleUserInteraction);
      controls.removeEventListener('change', requestRender);
      controls.removeEventListener('start', requestRender);
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      podiumGeo.dispose();
      podiumMat.dispose();
      studioBgTex?.dispose();
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
    const currentDist = Math.max(0.5, Math.sqrt(dx * dx + dy * dy + dz * dz));

    const currentTheta = Math.atan2(dx, dz);
    const currentPhi = Math.asin(Math.max(-0.99, Math.min(0.99, dy / currentDist)));

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
      startDistance: currentDist,
      targetDistance: CAMERA_DISTANCE,
    };
    requestRenderRef.current();
  };

  // Proyecta el centro real del logo (o el centro de la caña si no hay logo) a coordenadas [0..1] del visor
  const computeLogoScreenAnchor = useCallback((): { x: number; y: number } => {
    const camera = cameraRef.current;
    const legBox = legBoundsRef.current;
    if (!camera || !legBox) return { x: 0.5, y: 0.44 };

    const center = new THREE.Vector3();
    legBox.getCenter(center);

    // Calcular altura del logo dentro de la caña usando logoRect (v=0 arriba, v=1 abajo)
    let vLogo = 0.5;
    if (currentGrid?.logoRect) {
      vLogo = currentGrid.logoRect.rowCenter / Math.max(1, currentGrid.height);
    } else if (currentGrid) {
      vLogo = ((currentGrid.safeZone.minRow + currentGrid.safeZone.maxRow) * 0.5) / Math.max(1, currentGrid.height);
    }
    const worldY = legBox.max.y - vLogo * (legBox.max.y - legBox.min.y);

    // Usar la cámara en la vista frontal final para que coincida exactamente al abrir la lupa
    const rH = CAMERA_DISTANCE * Math.cos(ELEVATION_ANGLE);
    const rV = CAMERA_DISTANCE * Math.sin(ELEVATION_ANGLE);
    const camClone = camera.clone();
    camClone.position.set(
      TARGET.x + rH * Math.sin(PRESETS.frente),
      TARGET.y + rV,
      TARGET.z + rH * Math.cos(PRESETS.frente)
    );
    camClone.lookAt(TARGET);
    camClone.updateMatrixWorld(true);

    const worldPt = new THREE.Vector3(center.x, worldY, center.z);
    worldPt.project(camClone);

    return {
      x: Math.max(0.22, Math.min(0.78, (worldPt.x + 1) * 0.5)),
      y: Math.max(0.26, Math.min(0.68, (1 - worldPt.y) * 0.5)),
    };
  }, [currentGrid]);

  // Al cambiar de paso (o pulsar Atrás/Siguiente), el calcetín vuelve solo a la vista de frente
  const setCameraPresetRef = useRef(setCameraPreset);
  setCameraPresetRef.current = setCameraPreset;
  useEffect(() => {
    if (resetViewSignal && resetViewSignal > 0) {
      setLupaOpen(false);
      setCameraPresetRef.current('frente');
    }
  }, [resetViewSignal]);

  return (
    <div
      data-testid="sock-viewer-card"
      className="relative w-full h-[380px] sm:h-[450px] md:h-[500px] rounded-3xl overflow-hidden bg-gradient-to-b from-[#D2DCE6] via-[#DCE5EE] to-[#B9C6D3] border border-slate-300/80 shadow-float select-none flex flex-col justify-between"
    >
      {/* Top Overlay: View Presets, Lupa & Auto Rotate (se oculta cuando la lupa integrada está activa) */}
      {!lupaOpen && (
        <div className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 right-2.5 sm:right-4 z-20 flex items-center justify-between pointer-events-none gap-1.5 sm:gap-2">
          {/* Camera Preset Buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-petrol-dark/80 backdrop-blur-md p-1 rounded-2xl shadow-md border border-white/20 pointer-events-auto">
            {(['frente', 'lado', 'talon'] as PresetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                data-testid={`btn-preset-${key}`}
                onClick={() => setCameraPreset(key)}
                className={`px-2.5 sm:px-3 min-h-[38px] sm:min-h-[36px] text-[11px] sm:text-xs font-bold rounded-xl transition-all capitalize ${
                  activePreset === key && !autoRotate
                    ? 'bg-yarn-mustard text-petrol-dark shadow-xs'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                {key === 'talon' ? 'Talón' : key}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
            <button
              type="button"
              data-testid="btn-open-lupa"
              onClick={() => {
                setCameraPreset('frente');
                setLupaAnchor(computeLogoScreenAnchor());
                setLupaOpen(true);
              }}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 min-h-[40px] sm:min-h-[40px] text-[11px] sm:text-xs font-bold rounded-2xl backdrop-blur-md transition-all shadow-md border bg-petrol-dark/80 text-white border-white/20 hover:bg-petrol-dark/95"
              aria-label="Abrir la lupa para ver el tejido de cerca"
            >
              <ZoomIn className="w-4 h-4 text-yarn-mustard" />
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
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[40px] sm:min-h-[40px] text-xs font-bold rounded-2xl backdrop-blur-md transition-all shadow-md border ${
                autoRotate
                  ? 'bg-turquoise text-white border-turquoise shadow-glow'
                  : 'bg-petrol-dark/80 text-white/95 border-white/20 hover:bg-petrol-dark/95'
              }`}
              aria-label={autoRotate ? 'Pausar giro continuo' : 'Activar giro continuo'}
            >
              <RotateCw className={`w-4 h-4 ${autoRotate ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Girar</span>
            </button>
          </div>
        </div>
      )}

      {/* Center 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
        aria-label="Visor 3D interactivo del calcetín sobre peana"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#DCE5EE]/85 backdrop-blur-xs z-10">
            <div className="flex items-center gap-2 text-petrol-dark font-semibold text-sm">
              <Sparkles className="w-5 h-5 text-turquoise animate-pulse" />
              <span>Cargando calcetín 3D...</span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#DCE5EE]/95 backdrop-blur-sm z-30 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-petrol-dark mb-1">Error al cargar el visor 3D</h4>
            <p className="text-xs text-slate-600 mb-4 max-w-xs">{loadError}</p>
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
        <InlineKnitLupa
          grid={currentGrid}
          config={config}
          initialAnchor={lupaAnchor}
          onClose={() => setLupaOpen(false)}
        />
      )}

      {/* Bottom Overlay: Reset Front View Button & Drag hint */}
      {!lupaOpen && (
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex items-center justify-between gap-2 pointer-events-none">
          <button
            type="button"
            data-testid="btn-reset-front"
            onClick={() => setCameraPreset('frente')}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-2xl bg-petrol-dark/80 hover:bg-petrol-dark/95 backdrop-blur-md text-white text-xs font-bold shadow-md border border-white/20 pointer-events-auto transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-yarn-mustard flex-shrink-0" />
            <span>Volver a verlo de frente</span>
          </button>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-petrol-dark/75 backdrop-blur-md text-white text-[11px] font-medium border border-white/15 shadow-sm">
            <Eye className="w-3.5 h-3.5 text-yarn-mustard" />
            <span>Arrastra para girar</span>
          </div>
        </div>
      )}
    </div>
  );
};
