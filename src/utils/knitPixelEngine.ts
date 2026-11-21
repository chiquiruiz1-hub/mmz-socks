import { ExtendedSockConfig } from './pricing';
import { NeedleCount } from '../types/sock';
import {
  findNearestTecnoYarnColor,
  findNearestTecnoYarnByHex,
  TecnoYarnColor,
} from '../data/yarnPalette';

export const MAX_MACHINE_INKS = 6;
export const MIN_USER_INKS = 2;

// Márgenes de seguridad en la caña para no invadir puño (arriba) ni talón/puntera (abajo)
export const LEG_TOP_SAFE_MARGIN_RATIO = 0.10;
export const LEG_BOTTOM_SAFE_MARGIN_RATIO = 0.14;

export interface KnitPaletteEntry {
  index: number;
  code: string; // Código oficial TecnoYarn (p. ej. "E33")
  r: number;
  g: number;
  b: number;
  hex: string; // Hex exacto de la carta TecnoYarn (usado en el BMP 8 bits)
  name: string; // Nombre TecnoYarn (p. ej. "Rosso")
  pixelCount: number;
}

export interface SmallDetailWarning {
  hasWarning: boolean;
  needles: NeedleCount;
  affectedZones: string[];
  thinPixelRatio: number;
  tinyComponentCount: number;
}

export interface KnitPixelGrid {
  width: NeedleCount; // 168 o 200 agujas (1 píxel = 1 aguja)
  height: number; // pasadas en la caña
  indices: Uint8Array; // longitud = width * height, valores 0..5
  palette: KnitPaletteEntry[]; // longitud 1..6 (NUNCA > 6)
  totalInks: number; // tintas realmente usadas (1..6)
  maxAllowedInks: number; // límite seleccionado por el usuario (2..6)
  safeZone: {
    minRow: number;
    maxRow: number;
  };
  logoRect: {
    colCenter: number;
    rowCenter: number;
    cols: number;
    rows: number;
  } | null;
  hasLogo: boolean;
  smallDetailWarning: SmallDetailWarning;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#FFFFFF').replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 0,
      parseInt(clean[1] + clean[1], 16) || 0,
      parseInt(clean[2] + clean[2], 16) || 0,
    ];
  }
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0,
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Distancia perceptual ponderada en RGB (rápida y fiel al ojo humano). */
function colorDistSq(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const rMean = (r1 + r2) * 0.5;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return (
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db
  );
}

/**
 * Redimensionado progresivo por pasos (mitad a mitad) para mantener texto y
 * bordes nítidos al reducir logos de alta resolución a 168/200 agujas.
 */
function progressiveResize(
  img: HTMLImageElement,
  targetW: number,
  targetH: number
): ImageData | null {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH || targetW <= 0 || targetH <= 0) return null;

  let curCanvas = document.createElement('canvas');
  let curW = srcW;
  let curH = srcH;

  // Limitar paso inicial si la imagen fuente es enorme
  const maxStart = Math.max(targetW * 4, targetH * 4, 512);
  if (curW > maxStart || curH > maxStart) {
    const ratio = Math.min(maxStart / curW, maxStart / curH);
    curW = Math.max(targetW, Math.round(curW * ratio));
    curH = Math.max(targetH, Math.round(curH * ratio));
  }

  curCanvas.width = curW;
  curCanvas.height = curH;
  const initCtx = curCanvas.getContext('2d', { willReadFrequently: true });
  if (!initCtx) return null;
  initCtx.imageSmoothingEnabled = true;
  initCtx.imageSmoothingQuality = 'high';
  initCtx.drawImage(img, 0, 0, curW, curH);

  while (curW * 0.5 > targetW && curH * 0.5 > targetH) {
    const nextW = Math.max(targetW, Math.round(curW * 0.5));
    const nextH = Math.max(targetH, Math.round(curH * 0.5));
    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = nextW;
    nextCanvas.height = nextH;
    const nextCtx = nextCanvas.getContext('2d');
    if (!nextCtx) break;
    nextCtx.imageSmoothingEnabled = true;
    nextCtx.imageSmoothingQuality = 'high';
    nextCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
    curCanvas = nextCanvas;
    curW = nextW;
    curH = nextH;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return null;
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, targetW, targetH);
  return outCtx.getImageData(0, 0, targetW, targetH);
}

interface ColorBucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

/**
 * Cuantización K-Means++ en espacio RGB perceptual sobre cubetas de 5 bits.
 * Devuelve como máximo `maxK` colores representativos, preservando acentos.
 */
function quantizeLogoColors(
  imgData: ImageData,
  maxK: number,
  alphaThreshold: number
): [number, number, number][] {
  if (maxK <= 0) return [];
  const data = imgData.data;
  const bucketMap = new Map<number, { rSum: number; gSum: number; bSum: number; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < alphaThreshold) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const existing = bucketMap.get(key);
    if (existing) {
      existing.rSum += r;
      existing.gSum += g;
      existing.bSum += b;
      existing.count++;
    } else {
      bucketMap.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
    }
  }

  const buckets: ColorBucket[] = [];
  for (const b of bucketMap.values()) {
    buckets.push({
      r: b.rSum / b.count,
      g: b.gSum / b.count,
      b: b.bSum / b.count,
      count: b.count,
    });
  }

  if (buckets.length === 0) return [];
  if (buckets.length <= maxK) {
    return buckets
      .sort((a, b) => b.count - a.count)
      .map((b) => [Math.round(b.r), Math.round(b.g), Math.round(b.b)]);
  }

  // Inicialización determinista K-Means++ (primer centroide = color más frecuente)
  buckets.sort((a, b) => b.count - a.count);
  const totalOpaque = buckets.reduce((acc, b) => acc + b.count, 0);
  // Ignorar micro-cubetas de anti-aliasing (< 0.8% de píxeles) al elegir nuevos centroides
  const minClusterCount = Math.max(3, Math.floor(totalOpaque * 0.008));

  const centroids: [number, number, number][] = [
    [buckets[0].r, buckets[0].g, buckets[0].b],
  ];

  while (centroids.length < maxK) {
    let bestBucket: ColorBucket | null = null;
    let bestScore = -1;

    for (const bucket of buckets) {
      if (bucket.count < minClusterCount) continue;
      let minD = Infinity;
      for (const c of centroids) {
        const d = colorDistSq(bucket.r, bucket.g, bucket.b, c[0], c[1], c[2]);
        if (d < minD) minD = d;
      }
      // Exigir separación perceptual real para no crear tintas fantasma por anti-aliasing
      if (minD < 3600) continue;
      const score = minD * Math.pow(bucket.count, 0.45);
      if (score > bestScore) {
        bestScore = score;
        bestBucket = bucket;
      }
    }

    if (!bestBucket) break;
    centroids.push([bestBucket.r, bestBucket.g, bestBucket.b]);
  }

  // 12 iteraciones de K-Means ponderado
  const k = centroids.length;
  const assignments = new Int32Array(buckets.length);

  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    for (let bi = 0; bi < buckets.length; bi++) {
      const b = buckets[bi];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let ci = 0; ci < k; ci++) {
        const d = colorDistSq(b.r, b.g, b.b, centroids[ci][0], centroids[ci][1], centroids[ci][2]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = ci;
        }
      }
      if (assignments[bi] !== bestIdx) {
        assignments[bi] = bestIdx;
        changed = true;
      }
    }

    const rSums = new Float64Array(k);
    const gSums = new Float64Array(k);
    const bSums = new Float64Array(k);
    const counts = new Float64Array(k);

    for (let bi = 0; bi < buckets.length; bi++) {
      const ci = assignments[bi];
      const b = buckets[bi];
      rSums[ci] += b.r * b.count;
      gSums[ci] += b.g * b.count;
      bSums[ci] += b.b * b.count;
      counts[ci] += b.count;
    }

    for (let ci = 0; ci < k; ci++) {
      if (counts[ci] > 0) {
        centroids[ci][0] = rSums[ci] / counts[ci];
        centroids[ci][1] = gSums[ci] / counts[ci];
        centroids[ci][2] = bSums[ci] / counts[ci];
      }
    }

    if (!changed) break;
  }

  return centroids.map((c) => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
}

/**
 * Limpieza de píxeles sueltos y bordes sucios (despeckle + eliminación de halos).
 * Preserva trazos finos de texto (líneas de 1px conectadas) mientras elimina
 * píxeles aislados y bordes de anti-aliasing.
 */
function cleanIndexedLogoGrid(
  grid: Int16Array,
  cols: number,
  rows: number,
  aggressive: boolean
): Int16Array {
  let current = new Int16Array(grid);
  const passes = aggressive ? 2 : 1;

  for (let p = 0; p < passes; p++) {
    const next = new Int16Array(current);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const val = current[idx];
        if (val < 0) continue;

        let same8 = 0;
        let opaque4 = 0;
        const neighborCounts = new Map<number, number>();

        for (let dr = -1; dr <= 1; dr++) {
          const nr = r + dr;
          if (nr < 0 || nr >= rows) continue;
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = c + dc;
            if (nc < 0 || nc >= cols) continue;
            const nv = current[nr * cols + nc];
            if (nv >= 0) {
              if (dr === 0 || dc === 0) opaque4++;
              if (nv === val) same8++;
              neighborCounts.set(nv, (neighborCounts.get(nv) || 0) + 1);
            }
          }
        }

        // 1) Eliminar motas completamente aisladas (0 vecinos ortogonales opacos)
        if (opaque4 === 0 && same8 === 0) {
          next[idx] = -1;
          continue;
        }

        if (aggressive) {
          // 2) Eliminar píxel de borde sucio (1 solo vecino opaco y distinto color)
          if (same8 === 0) {
            let bestColor = -1;
            let bestCount = 0;
            for (const [colIdx, cnt] of neighborCounts.entries()) {
              if (cnt > bestCount) {
                bestCount = cnt;
                bestColor = colIdx;
              }
            }
            if (bestCount >= 3 && bestColor >= 0) {
              next[idx] = bestColor;
            } else if (opaque4 <= 1) {
              next[idx] = -1;
            }
          } else if (same8 === 1) {
            // 3) Si está rodeado por otro color dominante (>=5 vecinos), absorberlo
            let bestColor = -1;
            let bestCount = 0;
            for (const [colIdx, cnt] of neighborCounts.entries()) {
              if (colIdx !== val && cnt > bestCount) {
                bestCount = cnt;
                bestColor = colIdx;
              }
            }
            if (bestCount >= 5 && bestColor >= 0) {
              next[idx] = bestColor;
            }
          }
        }
      }
    }

    current = next;
  }

  return current;
}

/**
 * Analiza la cuadrícula pixelada del logo para detectar letras demasiado bajas
 * (< 7 agujas) o trazos de 1 píxel que se rompen/quedan sueltos al tejer.
 * Devuelve las zonas afectadas (superior, central, inferior) sin bloquear nada.
 */
function analyzeSmallLogoDetails(
  resized: ImageData,
  rawGrid: Int16Array,
  cleanedGrid: Int16Array,
  cols: number,
  rows: number,
  needles: NeedleCount
): SmallDetailWarning {
  const empty: SmallDetailWarning = {
    hasWarning: false,
    needles,
    affectedZones: [],
    thinPixelRatio: 0,
    tinyComponentCount: 0,
  };
  if (cols <= 0 || rows <= 0) return empty;

  const zoneNameForRow = (r: number): 'zona superior' | 'zona central' | 'zona inferior' => {
    const frac = (r + 0.5) / rows;
    if (frac < 0.34) return 'zona superior';
    if (frac > 0.66) return 'zona inferior';
    return 'zona central';
  };

  const zoneReasons = new Map<string, Set<string>>();
  const addZoneReason = (zone: string, reason: string) => {
    let s = zoneReasons.get(zone);
    if (!s) {
      s = new Set<string>();
      zoneReasons.set(zone, s);
    }
    s.add(reason);
  };

  // 0) Detectar contenido que existía en el logo (alpha >= 28) pero se perdió o rompió al bajar a agujas
  const srcPx = resized.data;
  const zoneSourcePx = new Map<string, number>();
  const zoneSurvivedPx = new Map<string, number>();
  const rowSourceCounts = new Uint16Array(rows);
  const rowOpaqueCounts = new Uint16Array(rows);
  let totalOpaque = 0;
  let totalRawOpaque = 0;

  for (let r = 0; r < rows; r++) {
    const z = zoneNameForRow(r);
    let cnt = 0;
    let srcCnt = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const alpha = srcPx[idx * 4 + 3];
      if (alpha >= 28) {
        srcCnt++;
        zoneSourcePx.set(z, (zoneSourcePx.get(z) || 0) + 1);
      }
      if (rawGrid[idx] >= 0) totalRawOpaque++;
      if (cleanedGrid[idx] >= 0) {
        cnt++;
        totalOpaque++;
        zoneSurvivedPx.set(z, (zoneSurvivedPx.get(z) || 0) + 1);
      }
    }
    rowSourceCounts[r] = srcCnt;
    rowOpaqueCounts[r] = cnt;
  }

  // Comprobar franjas de texto/detalle que se perdieron al convertir a agujas
  let srcBandStart = -1;
  for (let r = 0; r <= rows; r++) {
    const active = r < rows && rowSourceCounts[r] >= 3;
    if (active && srcBandStart < 0) {
      srcBandStart = r;
    } else if (!active && srcBandStart >= 0) {
      const srcBandEnd = r - 1;
      const bandH = srcBandEnd - srcBandStart + 1;
      let bandSrcPx = 0;
      let bandSurvPx = 0;
      for (let br = srcBandStart; br <= srcBandEnd; br++) {
        bandSrcPx += rowSourceCounts[br];
        bandSurvPx += rowOpaqueCounts[br];
      }
      if (bandSrcPx >= 12) {
        const lossRatio = (bandSrcPx - bandSurvPx) / bandSrcPx;
        if (bandH <= 6 && lossRatio >= 0.35) {
          const z = zoneNameForRow((srcBandStart + srcBandEnd) / 2);
          addZoneReason(z, `texto o detalle muy pequeño (${bandH} agujas de alto)`);
        } else if (lossRatio >= 0.65) {
          const z = zoneNameForRow((srcBandStart + srcBandEnd) / 2);
          addZoneReason(z, 'detalles que se pierden al tejer');
        }
      }
      srcBandStart = -1;
    }
  }

  for (const [z, srcCount] of zoneSourcePx.entries()) {
    const survCount = zoneSurvivedPx.get(z) || 0;
    if (srcCount >= 20 && survCount / srcCount < 0.35) {
      addZoneReason(z, 'letras o trazos demasiado finos');
    }
  }

  if (totalOpaque === 0) {
    return {
      hasWarning: zoneReasons.size > 0,
      needles,
      affectedZones: Array.from(zoneReasons.entries()).map(
        ([z, rs]) => `${z} (${Array.from(rs).join(', ')})`
      ),
      thinPixelRatio: 1,
      tinyComponentCount: 0,
    };
  }

  let bandStart = -1;
  for (let r = 0; r <= rows; r++) {
    const active = r < rows && rowOpaqueCounts[r] >= 2;
    if (active && bandStart < 0) {
      bandStart = r;
    } else if (!active && bandStart >= 0) {
      const bandEnd = r - 1;
      const bandH = bandEnd - bandStart + 1;
      // Contar píxeles de esta franja para ignorar motas residuales
      let bandPx = 0;
      for (let br = bandStart; br <= bandEnd; br++) bandPx += rowOpaqueCounts[br];
      if (bandH <= 6 && bandPx >= 6) {
        const z = zoneNameForRow((bandStart + bandEnd) / 2);
        addZoneReason(z, `texto o franja de solo ${bandH} agujas de alto`);
      }
      bandStart = -1;
    }
  }

  // 2) Contar trazos finos (píxeles con <= 1 vecino ortogonal del mismo color) y componentes rotos (<= 4 px)
  const visited = new Uint8Array(cols * rows);
  const queue = new Int32Array(cols * rows);
  const tinyZoneCounts = new Map<string, number>();
  const thinZoneCounts = new Map<string, number>();
  let thinPixels = 0;
  let tinyComponentCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const val = cleanedGrid[idx];
      if (val < 0) continue;

      let same4 = 0;
      if (r > 0 && cleanedGrid[(r - 1) * cols + c] === val) same4++;
      if (r + 1 < rows && cleanedGrid[(r + 1) * cols + c] === val) same4++;
      if (c > 0 && cleanedGrid[r * cols + (c - 1)] === val) same4++;
      if (c + 1 < cols && cleanedGrid[r * cols + (c + 1)] === val) same4++;

      if (same4 <= 1) {
        thinPixels++;
        const z = zoneNameForRow(r);
        thinZoneCounts.set(z, (thinZoneCounts.get(z) || 0) + 1);
      }

      if (!visited[idx]) {
        let head = 0;
        let tail = 0;
        queue[tail++] = idx;
        visited[idx] = 1;
        let area = 0;
        let rowSum = 0;

        while (head < tail) {
          const cur = queue[head++];
          const cr = Math.floor(cur / cols);
          const cc = cur % cols;
          area++;
          rowSum += cr;

          const neighbors = [
            cr > 0 ? cur - cols : -1,
            cr + 1 < rows ? cur + cols : -1,
            cc > 0 ? cur - 1 : -1,
            cc + 1 < cols ? cur + 1 : -1,
          ];
          for (const nIdx of neighbors) {
            if (nIdx >= 0 && !visited[nIdx] && cleanedGrid[nIdx] === val) {
              visited[nIdx] = 1;
              queue[tail++] = nIdx;
            }
          }
        }

        if (area <= 4) {
          tinyComponentCount++;
          const z = zoneNameForRow(rowSum / area);
          tinyZoneCounts.set(z, (tinyZoneCounts.get(z) || 0) + 1);
        }
      }
    }
  }

  const thinPixelRatio = thinPixels / totalOpaque;
  const droppedRatio = totalRawOpaque > 0 ? (totalRawOpaque - totalOpaque) / totalRawOpaque : 0;

  if (tinyComponentCount >= 6) {
    for (const [z, cnt] of tinyZoneCounts.entries()) {
      if (cnt >= 3) {
        addZoneReason(z, 'trazos sueltos de 1 píxel');
      }
    }
  }

  if (thinPixelRatio >= 0.34 || (droppedRatio >= 0.14 && totalRawOpaque - totalOpaque >= 14)) {
    let topZone = 'zona central';
    let topCnt = -1;
    for (const [z, cnt] of thinZoneCounts.entries()) {
      if (cnt > topCnt) {
        topCnt = cnt;
        topZone = z;
      }
    }
    addZoneReason(topZone, 'trazos demasiado finos');
  }

  const orderedZones: ('zona superior' | 'zona central' | 'zona inferior')[] = [
    'zona superior',
    'zona central',
    'zona inferior',
  ];
  const affectedZones: string[] = [];
  for (const z of orderedZones) {
    const reasons = zoneReasons.get(z);
    if (reasons && reasons.size > 0) {
      affectedZones.push(`${z} (${Array.from(reasons).join(', ')})`);
    }
  }

  return {
    hasWarning: affectedZones.length > 0,
    needles,
    affectedZones,
    thinPixelRatio: Number(thinPixelRatio.toFixed(2)),
    tinyComponentCount,
  };
}

/**
 * Construye la cuadrícula real de píxeles de la caña del calcetín.
 * Única fuente de verdad para:
 *  - Textura 3D de punto tejido
 *  - Lupa de alta nitidez
 *  - Archivo BMP de 8 bits para la máquina (1 píxel = 1 aguja)
 *  - Contador de tintas (máximo 6 colores)
 */
export function buildKnitPixelGrid(
  config: ExtendedSockConfig,
  logoImg: HTMLImageElement | null
): KnitPixelGrid {
  const width: NeedleCount = config.needleCount === 200 ? 200 : 168;
  const height = Math.round(width * 1.25); // 168x210 o 200x250
  const maxAllowedInks = Math.max(
    MIN_USER_INKS,
    Math.min(MAX_MACHINE_INKS, Math.round(config.maxColors ?? MAX_MACHINE_INKS))
  );
  const cleanEdges = config.cleanEdges ?? true;

  const safeMinRow = Math.ceil(height * LEG_TOP_SAFE_MARGIN_RATIO);
  const safeMaxRow = Math.floor(height * (1 - LEG_BOTTOM_SAFE_MARGIN_RATIO));

  const indices = new Uint8Array(width * height); // inicializado a 0 (color base de la caña)

  // Paleta dinámica en construcción: cada tinta se ajusta al color más cercano de la carta TecnoYarn (máx. 6)
  const baseYarn = findNearestTecnoYarnByHex(config.legColor || '#FFFFFF');
  const paletteEntries: TecnoYarnColor[] = [baseYarn];
  const paletteRgb: [number, number, number][] = [[baseYarn.r, baseYarn.g, baseYarn.b]];

  const findOrAddColor = (rgb: [number, number, number], mergeThresholdSq = 900): number => {
    // Ajustar primero al color exacto más cercano de la carta real TecnoYarn
    const snapped = findNearestTecnoYarnColor(rgb[0], rgb[1], rgb[2]);

    // Si ese código TecnoYarn ya está en la paleta activa, reutilizar su índice
    const exactIdx = paletteEntries.findIndex((entry) => entry.code === snapped.code);
    if (exactIdx >= 0) {
      return exactIdx;
    }

    // Buscar si ya existe un color muy cercano en la paleta activa
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < paletteRgb.length; i++) {
      const d = colorDistSq(snapped.r, snapped.g, snapped.b, paletteRgb[i][0], paletteRgb[i][1], paletteRgb[i][2]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    if (nearestDist <= mergeThresholdSq) {
      return nearestIdx;
    }
    if (paletteEntries.length < maxAllowedInks) {
      paletteEntries.push(snapped);
      paletteRgb.push([snapped.r, snapped.g, snapped.b]);
      return paletteEntries.length - 1;
    }
    return nearestIdx;
  };

  const resolvePatternColor = (zoneBg: string, patColor: string): string => {
    if (zoneBg.trim().toLowerCase() !== patColor.trim().toLowerCase()) {
      return patColor;
    }
    return zoneBg.trim().toLowerCase() === '#ffffff' ? '#1F4D63' : '#FFFFFF';
  };

  const wrapCol = (c: number) => ((c % width) + width) % width;

  const setPixel = (col: number, row: number, colorIdx: number) => {
    if (row < 0 || row >= height) return;
    indices[row * width + wrapCol(col)] = colorIdx;
  };

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
  const cleanText = knittedText.text ? knittedText.text.trim().slice(0, 14).toUpperCase() : '';

  const hasLogo = Boolean(
    config.logo.url && logoImg && logoImg.complete && logoImg.naturalWidth > 0
  );
  const hasText = cleanText.length > 0;
  const rotOffset = (config.logo.rotation || 0) / 360;

  const activeCentersU: number[] = [];
  if (logoPos === 'front' || logoPos === 'both') {
    activeCentersU.push(((0.0 + rotOffset) % 1 + 1) % 1);
  }
  if (logoPos === 'back' || logoPos === 'both') {
    activeCentersU.push(((0.5 + rotOffset) % 1 + 1) % 1);
  }

  // Calcular caja del logo respetando SIEMPRE los márgenes de seguridad
  const scale = Math.max(0.5, Math.min(1.45, config.logo.scale || 1.15));
  const safeHeight = safeMaxRow - safeMinRow;
  const maxLogoW = Math.min(Math.round(width * 0.48), Math.round(width * 0.42 * scale));
  const maxLogoH = Math.min(safeHeight - 4, Math.round(height * 0.42 * scale));

  let logoCols = 0;
  let logoRows = 0;
  let logoRowCenter = Math.round(safeMinRow + safeHeight * 0.45);

  if (hasLogo && logoImg && !config.logo.allOver) {
    const aspect = (logoImg.naturalWidth || 1) / (logoImg.naturalHeight || 1);
    if (aspect >= 1) {
      logoCols = Math.max(12, maxLogoW);
      logoRows = Math.max(10, Math.round(logoCols / aspect));
      if (logoRows > maxLogoH) {
        logoRows = maxLogoH;
        logoCols = Math.max(12, Math.round(logoRows * aspect));
      }
    } else {
      logoRows = Math.max(12, maxLogoH);
      logoCols = Math.max(10, Math.round(logoRows * aspect));
      if (logoCols > maxLogoW) {
        logoCols = maxLogoW;
        logoRows = Math.max(12, Math.round(logoCols / aspect));
      }
    }

    const patchExtraRows = logoBg.type !== 'none' ? Math.ceil(logoRows * 0.16) : 0;
    const halfH = Math.ceil(logoRows / 2) + patchExtraRows;
    const rawYPos = Math.max(0, Math.min(1, config.logo.yPos ?? 0.45));
    const minCenter = safeMinRow + halfH;
    const maxCenter = safeMaxRow - halfH;
    if (minCenter >= maxCenter) {
      logoRowCenter = Math.round((safeMinRow + safeMaxRow) / 2);
    } else {
      logoRowCenter = Math.round(minCenter + rawYPos * (maxCenter - minCenter));
    }
  }

  // Posición del texto tejido (también dentro de la zona segura)
  const textGridH = 14;
  const textRowCenter = hasLogo && !config.logo.allOver
    ? Math.min(safeMaxRow - Math.ceil(textGridH / 2) - 2, logoRowCenter + Math.ceil(logoRows / 2) + 12)
    : Math.round((safeMinRow + safeMaxRow) * 0.48);

  // Cajas de exclusión para lunares / cuadros pequeños
  const isInsideExclusion = (col: number, row: number, padCols: number, padRows: number): boolean => {
    for (const uc of activeCentersU) {
      const centerCol = uc * width;
      const distCol = Math.min(
        Math.abs(col - centerCol),
        width - Math.abs(col - centerCol)
      );
      if (hasLogo && !config.logo.allOver) {
        const hw = logoCols * 0.56 + (logoBg.type !== 'none' ? 5 : 0) + padCols;
        const hh = logoRows * 0.56 + (logoBg.type !== 'none' ? 5 : 0) + padRows;
        if (distCol <= hw && Math.abs(row - logoRowCenter) <= hh) return true;
      }
      if (hasText) {
        const hw = Math.max(20, cleanText.length * 4) + padCols;
        const hh = textGridH * 0.65 + padRows;
        if (distCol <= hw && Math.abs(row - textRowCenter) <= hh) return true;
      }
    }
    return false;
  };

  // 1) Dibujar motivo en la caña (rayas, lunares o cuadros)
  if (!config.logo.allOver && pattern.type !== 'none') {
    const legPatHex = resolvePatternColor(config.legColor, pattern.color);
    const patColorIdx = findOrAddColor(hexToRgb(legPatHex), 400);

    if (
      pattern.type === 'stripes' &&
      (pattern.stripesZone === 'leg' || pattern.stripesZone === 'all')
    ) {
      const count = Math.max(2, Math.min(6, pattern.stripesCount || 3));
      const vStart = safeMinRow;
      const vEnd = safeMaxRow;
      const step = (vEnd - vStart) / count;
      const ratio =
        pattern.stripesThickness === 'thin'
          ? 0.28
          : pattern.stripesThickness === 'medium'
          ? 0.45
          : 0.62;
      const bandH = Math.max(2, Math.round(step * ratio));

      for (let i = 0; i < count; i++) {
        const centerR = vStart + step * (i + 0.5);
        const r0 = Math.max(safeMinRow, Math.round(centerR - bandH / 2));
        const r1 = Math.min(safeMaxRow, r0 + bandH);
        for (let r = r0; r < r1; r++) {
          for (let c = 0; c < width; c++) {
            setPixel(c, r, patColorIdx);
          }
        }
      }
    } else if (pattern.type === 'dots') {
      const colsCount =
        pattern.dotsDensity === 'few' ? 8 : pattern.dotsDensity === 'medium' ? 12 : 16;
      const rowsCount =
        pattern.dotsDensity === 'few' ? 5 : pattern.dotsDensity === 'medium' ? 7 : 10;
      const radius =
        pattern.dotsSize === 'small' ? 2.5 : pattern.dotsSize === 'medium' ? 4 : 5.5;
      const rSq = radius * radius;

      for (let r = 0; r < rowsCount; r++) {
        const centerRow = safeMinRow + ((r + 0.5) / rowsCount) * safeHeight;
        const shift = (r % 2) * (0.5 / colsCount);
        for (let c = 0; c < colsCount; c++) {
          const centerCol = (((c / colsCount + shift) % 1) + 1) % 1 * width;
          if (isInsideExclusion(centerCol, centerRow, radius + 3, radius + 3)) continue;
          const rStart = Math.max(safeMinRow, Math.floor(centerRow - radius));
          const rEnd = Math.min(safeMaxRow, Math.ceil(centerRow + radius));
          const cStart = Math.floor(centerCol - radius);
          const cEnd = Math.ceil(centerCol + radius);
          for (let py = rStart; py <= rEnd; py++) {
            for (let px = cStart; px <= cEnd; px++) {
              const dx = px - centerCol;
              const dy = py - centerRow;
              if (dx * dx + dy * dy <= rSq) {
                setPixel(px, py, patColorIdx);
              }
            }
          }
        }
      }
    } else if (pattern.type === 'checks') {
      const cellW = Math.max(4, Math.round(width / 32));
      const cellH = Math.max(4, Math.round(height / 24));
      const numC = Math.ceil(width / cellW);
      const numR = Math.ceil(height / cellH);
      for (let gr = 0; gr < numR; gr++) {
        for (let gc = 0; gc < numC; gc++) {
          if ((gr + gc) % 2 !== 0) continue;
          const centerC = (gc + 0.5) * cellW;
          const centerR = (gr + 0.5) * cellH;
          if (centerR < safeMinRow || centerR > safeMaxRow) continue;
          if (isInsideExclusion(centerC, centerR, 3, 3)) continue;
          const r0 = Math.max(safeMinRow, gr * cellH);
          const r1 = Math.min(safeMaxRow, gr * cellH + Math.max(2, Math.round(cellH * 0.78)));
          const c0 = gc * cellW;
          const c1 = gc * cellW + Math.max(2, Math.round(cellW * 0.78));
          for (let py = r0; py < r1; py++) {
            for (let px = c0; px < c1; px++) {
              setPixel(px, py, patColorIdx);
            }
          }
        }
      }
    }
  }

  // 2) Reservar color del parche del logo y texto si están activos
  let logoBgIdx = -1;
  if (hasLogo && !config.logo.allOver && logoBg.type !== 'none') {
    logoBgIdx = findOrAddColor(hexToRgb(logoBg.color), 400);
  }
  let textColorIdx = -1;
  if (hasText) {
    textColorIdx = findOrAddColor(hexToRgb(knittedText.color), 400);
  }

  // 3) Procesar logo del cliente (cuantización estricta <= maxAllowedInks y limpieza de bordes)
  let logoRect: KnitPixelGrid['logoRect'] = null;
  let smallDetailWarning: SmallDetailWarning = {
    hasWarning: false,
    needles: width,
    affectedZones: [],
    thinPixelRatio: 0,
    tinyComponentCount: 0,
  };

  if (hasLogo && logoImg) {
    if (config.logo.allOver) {
      // Estampado repetido por toda la caña (siempre <= maxAllowedInks <= 6)
      const repeatsX = 4;
      const tileW = Math.round(width / repeatsX);
      const aspect = (logoImg.naturalHeight || 1) / (logoImg.naturalWidth || 1);
      const tileH = Math.max(12, Math.round(tileW * aspect));
      const resized = progressiveResize(logoImg, tileW, tileH);
      if (resized) {
        const logoColors = quantizeLogoColors(resized, maxAllowedInks, 128);
        const mappedIndices = logoColors.map((rgb) => findOrAddColor(rgb, 500));
        const tileGrid = new Uint8Array(tileW * tileH);
        const px = resized.data;
        for (let i = 0; i < tileW * tileH; i++) {
          const r = px[i * 4];
          const g = px[i * 4 + 1];
          const b = px[i * 4 + 2];
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let ci = 0; ci < logoColors.length; ci++) {
            const d = colorDistSq(r, g, b, logoColors[ci][0], logoColors[ci][1], logoColors[ci][2]);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = mappedIndices[ci];
            }
          }
          tileGrid[i] = bestIdx;
        }
        for (let r = 0; r < height; r++) {
          const tr = r % tileH;
          for (let c = 0; c < width; c++) {
            const tc = c % tileW;
            indices[r * width + c] = tileGrid[tr * tileW + tc];
          }
        }
      }
    } else if (logoCols > 0 && logoRows > 0) {
      const resized = progressiveResize(logoImg, logoCols, logoRows);
      if (resized) {
        const alphaThreshold = cleanEdges ? 165 : 115;
        const availableSlots = Math.max(1, maxAllowedInks - paletteRgb.length);
        // Cuantizamos hasta `maxAllowedInks` candidatos (si alguno coincide con la paleta ya existente, se reutiliza)
        const quantizedColors = quantizeLogoColors(resized, Math.min(maxAllowedInks, availableSlots + 1), alphaThreshold);

        // Registrar colores del logo en la paleta sin superar nunca maxAllowedInks (<= 6)
        const paletteIdsForLogo: number[] = [];
        for (const rgb of quantizedColors) {
          const pIdx = findOrAddColor(rgb, 650);
          if (!paletteIdsForLogo.includes(pIdx)) {
            paletteIdsForLogo.push(pIdx);
          }
        }

        // Mapear cada píxel del logo a su índice de paleta (-1 = transparente)
        const rawLogoGrid = new Int16Array(logoCols * logoRows);
        const px = resized.data;
        const candidatePool = paletteIdsForLogo.length > 0 ? paletteIdsForLogo : [0];

        for (let i = 0; i < logoCols * logoRows; i++) {
          const a = px[i * 4 + 3];
          if (a < alphaThreshold) {
            rawLogoGrid[i] = -1;
            continue;
          }
          const r = px[i * 4];
          const g = px[i * 4 + 1];
          const b = px[i * 4 + 2];

          let bestPaletteIdx = candidatePool[0];
          let bestDist = Infinity;
          for (let j = 0; j < paletteRgb.length; j++) {
            const pr = paletteRgb[j];
            const d = colorDistSq(r, g, b, pr[0], pr[1], pr[2]);
            if (d < bestDist) {
              bestDist = d;
              bestPaletteIdx = j;
            }
          }
          rawLogoGrid[i] = bestPaletteIdx;
        }

        // Limpiar píxeles sueltos y bordes sucios
        const cleanedLogoGrid = cleanIndexedLogoGrid(rawLogoGrid, logoCols, logoRows, cleanEdges);

        // Detectar textos o detalles demasiado pequeños para tejerse con el ancho elegido
        smallDetailWarning = analyzeSmallLogoDetails(
          resized,
          rawLogoGrid,
          cleanedLogoGrid,
          logoCols,
          logoRows,
          width
        );

        // Estampar parche + logo en cada cara activa (delante, detrás o ambos)
        const rowStart = Math.max(safeMinRow, Math.round(logoRowCenter - logoRows / 2));

        for (const uc of activeCentersU) {
          const centerCol = Math.round(uc * width);

          // Parche de fondo si está activo
          if (logoBgIdx >= 0) {
            if (logoBg.type === 'circle') {
              const rad = Math.max(logoCols, logoRows) * 0.62;
              const radSq = rad * rad;
              const r0 = Math.max(safeMinRow, Math.floor(logoRowCenter - rad));
              const r1 = Math.min(safeMaxRow, Math.ceil(logoRowCenter + rad));
              for (let py = r0; py <= r1; py++) {
                for (let pxCol = Math.floor(centerCol - rad); pxCol <= Math.ceil(centerCol + rad); pxCol++) {
                  const dx = pxCol - centerCol;
                  const dy = py - logoRowCenter;
                  if (dx * dx + dy * dy <= radSq) {
                    setPixel(pxCol, py, logoBgIdx);
                  }
                }
              }
            } else if (logoBg.type === 'roundedRect') {
              const hw = Math.round(logoCols * 0.62);
              const hh = Math.round(logoRows * 0.64);
              const corner = Math.min(5, Math.floor(Math.min(hw, hh) * 0.35));
              const r0 = Math.max(safeMinRow, logoRowCenter - hh);
              const r1 = Math.min(safeMaxRow, logoRowCenter + hh);
              for (let py = r0; py <= r1; py++) {
                for (let pxCol = centerCol - hw; pxCol <= centerCol + hw; pxCol++) {
                  const ax = Math.abs(pxCol - centerCol);
                  const ay = Math.abs(py - logoRowCenter);
                  if (ax <= hw - corner || ay <= hh - corner) {
                    setPixel(pxCol, py, logoBgIdx);
                  } else {
                    const dx = ax - (hw - corner);
                    const dy = ay - (hh - corner);
                    if (dx * dx + dy * dy <= corner * corner) {
                      setPixel(pxCol, py, logoBgIdx);
                    }
                  }
                }
              }
            }
          }

          // Estampar píxeles del logo dentro de la zona segura
          const colStart = Math.round(centerCol - logoCols / 2);
          for (let lr = 0; lr < logoRows; lr++) {
            const targetRow = rowStart + lr;
            if (targetRow < safeMinRow || targetRow > safeMaxRow) continue;
            for (let lc = 0; lc < logoCols; lc++) {
              const val = cleanedLogoGrid[lr * logoCols + lc];
              if (val >= 0) {
                setPixel(colStart + lc, targetRow, val);
              }
            }
          }
        }

        logoRect = {
          colCenter: Math.round((activeCentersU[0] ?? 0) * width),
          rowCenter: logoRowCenter,
          cols: logoCols,
          rows: logoRows,
        };
      }
    }
  }

  // 4) Estampar texto tejido (si está activo, siempre dentro de zona segura)
  if (hasText && textColorIdx >= 0) {
    const charW = 6;
    const textW = Math.min(Math.round(width * 0.44), Math.max(24, cleanText.length * charW + 4));
    const textH = textGridH;
    const off = document.createElement('canvas');
    off.width = textW;
    off.height = textH;
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (octx) {
      octx.clearRect(0, 0, textW, textH);
      octx.fillStyle = '#FFFFFF';
      octx.font = '900 10px "Courier New", monospace, sans-serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(cleanText, textW / 2, textH / 2 + 0.5, textW - 2);
      const tData = octx.getImageData(0, 0, textW, textH).data;
      const centers = activeCentersU.length > 0 ? activeCentersU : [0.0];
      const rStart = Math.round(textRowCenter - textH / 2);

      for (const uc of centers) {
        const cStart = Math.round(uc * width - textW / 2);
        for (let tr = 0; tr < textH; tr++) {
          const targetRow = rStart + tr;
          if (targetRow < safeMinRow || targetRow > safeMaxRow) continue;
          for (let tc = 0; tc < textW; tc++) {
            if (tData[(tr * textW + tc) * 4 + 3] > 95) {
              setPixel(cStart + tc, targetRow, textColorIdx);
            }
          }
        }
      }
    }
  }

  // 5) Compactar paleta y contar píxeles reales por tinta (garantía estricta <= 6)
  const counts = new Uint32Array(paletteRgb.length);
  for (let i = 0; i < indices.length; i++) {
    counts[indices[i]]++;
  }

  const remap = new Int32Array(paletteRgb.length).fill(-1);
  const compactPalette: KnitPaletteEntry[] = [];

  for (let i = 0; i < paletteEntries.length; i++) {
    if (counts[i] === 0 && i !== 0) continue;
    if (compactPalette.length >= MAX_MACHINE_INKS) break;
    const newIdx = compactPalette.length;
    remap[i] = newIdx;
    const ty = paletteEntries[i];
    compactPalette.push({
      index: newIdx,
      code: ty.code,
      r: ty.r,
      g: ty.g,
      b: ty.b,
      hex: ty.hex,
      name: ty.name,
      pixelCount: counts[i],
    });
  }

  for (let i = 0; i < indices.length; i++) {
    const mapped = remap[indices[i]];
    indices[i] = mapped >= 0 ? mapped : 0;
  }

  const totalInks = Math.max(1, compactPalette.filter((p) => p.pixelCount > 0).length);

  return {
    width,
    height,
    indices,
    palette: compactPalette,
    totalInks: Math.min(MAX_MACHINE_INKS, totalInks),
    maxAllowedInks,
    safeZone: {
      minRow: safeMinRow,
      maxRow: safeMaxRow,
    },
    logoRect,
    hasLogo,
    smallDetailWarning,
  };
}
