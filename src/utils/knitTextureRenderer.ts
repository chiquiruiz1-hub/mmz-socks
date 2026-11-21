import * as THREE from 'three';
import { KnitPixelGrid } from './knitPixelEngine';

/**
 * Calcula la distancia de un punto (px, py) a un segmento (x1, y1)-(x2, y2)
 * y el parámetro t en [0, 1] a lo largo del segmento.
 */
function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; t: number } {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  const dx = px - (x1 + t * vx);
  const dy = py - (y1 + t * vy);
  return { dist: Math.sqrt(dx * dx + dy * dy), t };
}

/**
 * Evalúa el sombreado de una puntada de punto tejido en forma de V (\/)
 * en coordenadas normalizadas u, v ∈ [0, 1].
 * Devuelve un factor multiplicador de luminosidad (0.55 .. 1.18) y un pequeño
 * brillo especular aditivo para simular la curvatura de la fibra textil.
 */
function sampleVStitchShading(u: number, v: number): { mult: number; spec: number } {
  // Dos patas diagonales de la puntada en V (\/) con solape suave arriba/abajo
  const left = distToSegment(u, v, 0.16, 0.04, 0.45, 0.96);
  const right = distToSegment(u, v, 0.84, 0.04, 0.55, 0.96);

  const tubeR = 0.235;
  const best = left.dist < right.dist ? left : right;
  const isLeft = left.dist < right.dist;

  if (best.dist < tubeR) {
    // Perfil cilíndrico de la hebra de hilo
    const normR = best.dist / tubeR;
    const crown = Math.sqrt(Math.max(0, 1 - normR * normR));

    // Ligera sombra donde la puntada se mete por debajo de la superior e inferior
    const verticalArch = 0.86 + 0.18 * Math.sin(best.t * Math.PI);

    // Micro-torsión de las fibras del hilo a lo largo de la pata
    const twistPhase = (isLeft ? u * 10 - v * 14 : -u * 10 - v * 14) * Math.PI;
    const twist = 0.965 + 0.035 * Math.sin(twistPhase);

    // Iluminación lateral suave de estudio (luz principal desde arriba-izquierda)
    const sideLight = isLeft ? 1.04 : 0.95;

    const mult = (0.76 + 0.34 * crown) * verticalArch * twist * sideLight;
    const spec = Math.pow(crown, 3) * (isLeft ? 14 : 7) * verticalArch;
    return { mult, spec };
  }

  // Valle entre patas de la V y entre puntadas adyacentes (oclusión ambiental)
  const gapDist = Math.min(1, (best.dist - tubeR) / 0.18);
  const mult = 0.72 - 0.16 * gapDist;
  return { mult, spec: 0 };
}

/**
 * Empaqueta RGBA en un entero Uint32 (little-endian ABGR para ImageData).
 */
function packRGBA(r: number, g: number, b: number, a = 255): number {
  const cr = r < 0 ? 0 : r > 255 ? 255 : r | 0;
  const cg = g < 0 ? 0 : g > 255 ? 255 : g | 0;
  const cb = b < 0 ? 0 : b > 255 ? 255 : b | 0;
  return ((a & 0xff) << 24) | (cb << 16) | (cg << 8) | cr;
}

const stitchMaskCache = new Map<string, { multMask: Float32Array; specMask: Float32Array }>();

function getVStitchMasks(cellW: number, cellH: number): { multMask: Float32Array; specMask: Float32Array } {
  const key = `${cellW}x${cellH}`;
  const cached = stitchMaskCache.get(key);
  if (cached) return cached;

  const multMask = new Float32Array(cellW * cellH);
  const specMask = new Float32Array(cellW * cellH);
  for (let py = 0; py < cellH; py++) {
    const v = (py + 0.5) / cellH;
    for (let px = 0; px < cellW; px++) {
      const u = (px + 0.5) / cellW;
      const { mult, spec } = sampleVStitchShading(u, v);
      const k = py * cellW + px;
      multMask[k] = mult;
      specMask[k] = spec;
    }
  }
  const entry = { multMask, specMask };
  stitchMaskCache.set(key, entry);
  return entry;
}

/**
 * Renderiza toda la cuadrícula KnitPixelGrid en un canvas de alta resolución
 * (múltiples píxeles por aguja) dibujando cada píxel como una puntada en V
 * real con relieve suave, sin cuadraditos planos.
 */
export function renderGridToKnitCanvas(
  grid: KnitPixelGrid,
  targetCanvas: HTMLCanvasElement,
  compact = false
): void {
  // Desktop: 6x6 px por puntada (~1008x1260 en 168 agujas); Móvil: 4x4 px (~672x840)
  // Suficiente para ver el punto V nítido en el 3D; la Lupa renderiza aparte en vectorial puro.
  const cellW = compact ? 4 : 6;
  const cellH = compact ? 4 : 6;
  const outW = grid.width * cellW;
  const outH = grid.height * cellH;

  if (targetCanvas.width !== outW || targetCanvas.height !== outH) {
    targetCanvas.width = outW;
    targetCanvas.height = outH;
  }

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  // Reutilizar máscara cacheada de sombreado V-stitch para esta celda
  const { multMask, specMask } = getVStitchMasks(cellW, cellH);

  // Pre-hornear 2 variantes sutiles de puntada por cada color de la paleta (máx. 6 colores)
  const paletteLen = Math.max(1, grid.palette.length);
  const tilesA: Uint32Array[] = new Array(paletteLen);
  const tilesB: Uint32Array[] = new Array(paletteLen);

  for (let ci = 0; ci < paletteLen; ci++) {
    const p = grid.palette[ci];
    const tA = new Uint32Array(cellW * cellH);
    const tB = new Uint32Array(cellW * cellH);

    // En colores muy oscuros levantamos ligeramente el contraste del relieve
    // para que las puntadas se aprecien incluso sobre negro carbón.
    const luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
    const darkLift = luma < 55 ? 0.55 : 0.28;

    for (let k = 0; k < cellW * cellH; k++) {
      const m = multMask[k];
      const sp = specMask[k] * darkLift;

      tA[k] = packRGBA(p.r * m + sp, p.g * m + sp, p.b * m + sp);
      const mB = m * 0.975;
      tB[k] = packRGBA(p.r * mB + sp * 0.85, p.g * mB + sp * 0.85, p.b * mB + sp * 0.85);
    }
    tilesA[ci] = tA;
    tilesB[ci] = tB;
  }

  const imgData = ctx.createImageData(outW, outH);
  const dst32 = new Uint32Array(imgData.data.buffer);
  const indices = grid.indices;
  const gW = grid.width;
  const gH = grid.height;

  for (let r = 0; r < gH; r++) {
    const rowBaseY = r * cellH;
    const gridRowOffset = r * gW;

    for (let c = 0; c < gW; c++) {
      const rawIdx = indices[gridRowOffset + c];
      const ci = rawIdx < paletteLen ? rawIdx : 0;
      const tile = ((r + c) & 1) === 0 ? tilesA[ci] : tilesB[ci];
      const dstX = c * cellW;

      for (let py = 0; py < cellH; py++) {
        const srcOff = py * cellW;
        const dstOff = (rowBaseY + py) * outW + dstX;
        dst32.set(tile.subarray(srcOff, srcOff + cellW), dstOff);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Renderiza una región de la cuadrícula a resolución macro (para la Lupa)
 * dibujando cada aguja como una puntada V de punto tejido nítida y suave,
 * incluso a ampliación máxima (x8), sin ningún cuadradito pixelado ni desenfoque.
 */
export function renderKnitMacroRegion(
  grid: KnitPixelGrid,
  ctx: CanvasRenderingContext2D,
  outW: number,
  outH: number,
  centerCol: number,
  centerRow: number,
  visibleCols: number,
  showNeedleGrid: boolean
): void {
  const pxPerCol = outW / visibleCols;
  const pxPerRow = pxPerCol * 0.84; // proporción real ancho/alto de una puntada de calcetín
  const visibleRows = outH / pxPerRow;

  const startCol = centerCol - visibleCols / 2;
  const startRow = centerRow - visibleRows / 2;

  const firstCol = Math.floor(startCol) - 1;
  const lastCol = Math.ceil(startCol + visibleCols) + 1;
  const firstRow = Math.floor(startRow) - 1;
  const lastRow = Math.ceil(startRow + visibleRows) + 1;

  // Fondo oscuro de valle textil
  ctx.fillStyle = '#0D171F';
  ctx.fillRect(0, 0, outW, outH);

  const gW = grid.width;
  const gH = grid.height;
  const palette = grid.palette;

  // Precomputar colores derivados (base, claro, sombra) por cada tinta de la paleta (<=6)
  const paletteStyles = palette.map((p) => {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
    const boost = luma < 55 ? 24 : 18;
    return {
      valley: `rgb(${clamp(p.r * 0.56)},${clamp(p.g * 0.56)},${clamp(p.b * 0.56)})`,
      leftMain: `rgb(${clamp(p.r * 1.02 + boost * 0.35)},${clamp(p.g * 1.02 + boost * 0.35)},${clamp(p.b * 1.02 + boost * 0.35)})`,
      rightMain: `rgb(${clamp(p.r * 0.90 + boost * 0.15)},${clamp(p.g * 0.90 + boost * 0.15)},${clamp(p.b * 0.90 + boost * 0.15)})`,
      highlight: `rgba(${clamp(p.r + 65)},${clamp(p.g + 65)},${clamp(p.b + 65)},${luma > 220 ? 0.55 : 0.38})`,
      groove: `rgba(8, 16, 24, ${luma < 55 ? 0.55 : 0.32})`,
    };
  });

  const lineW = Math.max(1.4, pxPerCol * 0.36);
  const hiLineW = Math.max(0.8, lineW * 0.34);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let r = firstRow; r <= lastRow; r++) {
    if (r < 0 || r >= gH) continue;
    const y = (r - startRow) * pxPerRow;
    const rowOff = r * gW;

    for (let c = firstCol; c <= lastCol; c++) {
      const wrappedC = ((c % gW) + gW) % gW;
      const idx = grid.indices[rowOff + wrappedC];
      const st = paletteStyles[idx < paletteStyles.length ? idx : 0];
      const x = (c - startCol) * pxPerCol;

      // Fondo de celda (valle del tejido)
      ctx.fillStyle = st.valley;
      ctx.fillRect(x - 0.5, y - 0.5, pxPerCol + 1, pxPerRow + 1);

      // Pata izquierda de la V (con ligera curva orgánica de la lazada)
      const lx1 = x + pxPerCol * 0.18;
      const ly1 = y + pxPerRow * 0.08;
      const lx2 = x + pxPerCol * 0.44;
      const ly2 = y + pxPerRow * 0.96;

      // Pata derecha de la V
      const rx1 = x + pxPerCol * 0.82;
      const ry1 = y + pxPerRow * 0.08;
      const rx2 = x + pxPerCol * 0.56;
      const ry2 = y + pxPerRow * 0.96;

      // Sombra interior de cada pata
      ctx.strokeStyle = st.groove;
      ctx.lineWidth = lineW * 1.18;
      ctx.beginPath();
      ctx.moveTo(lx1, ly1 + pxPerRow * 0.06);
      ctx.lineTo(lx2, ly2 + pxPerRow * 0.06);
      ctx.moveTo(rx1, ry1 + pxPerRow * 0.06);
      ctx.lineTo(rx2, ry2 + pxPerRow * 0.06);
      ctx.stroke();

      // Pata izquierda principal
      ctx.strokeStyle = st.leftMain;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.quadraticCurveTo(x + pxPerCol * 0.24, y + pxPerRow * 0.55, lx2, ly2);
      ctx.stroke();

      // Pata derecha principal
      ctx.strokeStyle = st.rightMain;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(rx1, ry1);
      ctx.quadraticCurveTo(x + pxPerCol * 0.76, y + pxPerRow * 0.55, rx2, ry2);
      ctx.stroke();

      // Brillo de cresta de la fibra en ambas patas (cuando hay suficiente detalle)
      if (pxPerCol >= 6) {
        ctx.strokeStyle = st.highlight;
        ctx.lineWidth = hiLineW;
        ctx.beginPath();
        ctx.moveTo(lx1 + pxPerCol * 0.03, ly1 + pxPerRow * 0.08);
        ctx.quadraticCurveTo(x + pxPerCol * 0.26, y + pxPerRow * 0.52, lx2 - pxPerCol * 0.02, ly2 - pxPerRow * 0.14);
        ctx.moveTo(rx1 - pxPerCol * 0.03, ry1 + pxPerRow * 0.08);
        ctx.quadraticCurveTo(x + pxPerCol * 0.74, y + pxPerRow * 0.52, rx2 + pxPerCol * 0.02, ry2 - pxPerRow * 0.14);
        ctx.stroke();
      }
    }
  }

  // Guías sutiles de agujas si el usuario activa "Agujas"
  if (showNeedleGrid && pxPerCol >= 4) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = firstCol; c <= lastCol; c++) {
      const gx = Math.round((c - startCol) * pxPerCol) + 0.5;
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, outH);
    }
    for (let r = firstRow; r <= lastRow; r++) {
      const gy = Math.round((r - startRow) * pxPerRow) + 0.5;
      ctx.moveTo(0, gy);
      ctx.lineTo(outW, gy);
    }
    ctx.stroke();
  }
}

/**
 * Pinta un acanalado (canalé 2x2) realista y visible en la textura del puño.
 */
export function renderCuffRibbingOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  needles: number
): void {
  // Canalé 2x2: cada columna de acanalado agrupa ~2 agujas en relieve y 2 hundidas
  const ribCount = Math.round(needles / 4);
  const ribW = width / ribCount;

  for (let i = 0; i < ribCount; i++) {
    const x = i * ribW;
    const grad = ctx.createLinearGradient(x, 0, x + ribW, 0);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.24)');
    grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.10)');
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(0.68, 'rgba(0, 0, 0, 0.08)');
    grad.addColorStop(0.86, 'rgba(0, 0, 0, 0.26)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.24)');

    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, ribW + 0.5, height);
  }

  // Puntadas horizontales sutiles de las pasadas del puño
  const rowStep = Math.max(6, Math.round(height / 90));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  for (let y = 0; y < height; y += rowStep) {
    ctx.fillRect(0, y, width, 1.5);
  }

  // Borde superior ligeramente rematado (elástico del puño)
  const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.08);
  topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, height * 0.08);
}

/**
 * Normal map procedural de puntadas en V (para relieve realista bajo luz de estudio).
 */
export function createKnitStitchNormalTexture(anisotropy = 8): THREE.CanvasTexture | null {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // 8x8 puntadas V por tile
  const cols = 8;
  const rows = 8;
  const cellW = size / cols;
  const cellH = size / rows;

  const heightField = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y % cellH) / cellH;
    for (let x = 0; x < size; x++) {
      const u = (x % cellW) / cellW;
      const { mult } = sampleVStitchShading(u, v);
      heightField[y * size + x] = mult;
    }
  }

  // Convertir mapa de alturas a mapa de normales tangentes
  const strength = 2.6;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dx = (heightField[y * size + xp] - heightField[y * size + xm]) * strength;
      const dy = (heightField[yp * size + x] - heightField[ym * size + x]) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = false;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Normal map dedicado para el acanalado (canalé) vertical del puño.
 */
export function createCuffRibNormalTexture(anisotropy = 8): THREE.CanvasTexture | null {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // 8 columnas de canalé vertical + micro-textura de puntadas horizontales
  for (let y = 0; y < size; y++) {
    const stitchWave = Math.sin((y / size) * Math.PI * 2 * 24) * 0.15;
    for (let x = 0; x < size; x++) {
      const ribPhase = (x / size) * Math.PI * 2 * 8;
      const dx = Math.cos(ribPhase) * 1.45;
      const dy = stitchWave;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = false;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}
