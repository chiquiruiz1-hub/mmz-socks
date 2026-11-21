import { jsPDF } from 'jspdf';
import { PriceBreakdown } from '../types/sock';
import {
  ExtendedSockConfig,
  MATERIALS,
  calculatePricing
} from './pricing';
import {
  findTecnoYarnByHex,
  getTecnoYarnLabel,
  DEFAULT_HEEL_TOE_COLOR
} from '../data/yarnPalette';

export const YARN_COLOR_NAMES: Record<string, string> = {
  '#ffffff': 'Blanco Puro',
  '#1e232a': 'Negro Carbón',
  '#1f4d63': 'Azul Petróleo',
  '#173a4b': 'Azul Noche',
  '#1b7a93': 'Turquesa',
  '#2a9db8': 'Turquesa Claro',
  '#f4f1ea': 'Crudo Natural',
  '#f2c14e': 'Mostaza Cálido',
  '#e36f73': 'Coral Terracota',
  '#2d6a4f': 'Verde Bosque',
  '#782834': 'Burdeos Sierra',
  '#2b3140': 'Gris Pizarra'
};

/**
 * Formatea un importe numérico en formato español: punto de miles, coma decimal y símbolo € al final.
 * Ejemplo: 6720 -> "6.720,00 €", 3.3 -> "3,30 €"
 */
export function formatSpanishEuro(value: number): string {
  const fixed = Math.abs(value).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 ? '-' : '';
  return `${sign}${withThousands},${decPart} €`;
}

/**
 * Obtiene el nombre legible de un color HEX junto con su código (priorizando carta TecnoYarn).
 */
export function getColorLabel(hex: string): string {
  const clean = (hex || '#FFFFFF').trim();
  const ty = findTecnoYarnByHex(clean);
  if (ty) return `${ty.code} ${ty.name} (${ty.hex})`;
  const name = YARN_COLOR_NAMES[clean.toLowerCase()];
  return name ? `${name} (${clean.toUpperCase()})` : `Personalizado (${clean.toUpperCase()})`;
}

/**
 * Nombre corto del color (incluye código TecnoYarn p. ej. "E33 Rosso").
 */
export function getShortColorName(hex: string): string {
  const clean = (hex || '#FFFFFF').trim();
  const ty = findTecnoYarnByHex(clean);
  if (ty) return `${ty.code} ${ty.name}`;
  return YARN_COLOR_NAMES[clean.toLowerCase()] || clean.toUpperCase();
}

/**
 * Convierte un color HEX (#RRGGBB) a [R, G, B]
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b];
}

/**
 * Genera y persiste en localStorage un número correlativo de presupuesto: MMZ-AAAA-NNN
 */
export function getNextQuoteNumber(date: Date = new Date()): string {
  const year = date.getFullYear();
  const storageKey = `mmz_socks_quote_seq_${year}`;
  let nextNum = 1;

  try {
    const currentRaw = window.localStorage.getItem(storageKey);
    if (currentRaw) {
      const parsed = parseInt(currentRaw, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        nextNum = parsed + 1;
      }
    }
    window.localStorage.setItem(storageKey, String(nextNum));
  } catch {
    nextNum = Math.floor((Date.now() % 899) + 1);
  }

  return `MMZ-${year}-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Reduce y normaliza cualquier imagen (dataURL o SVG) a PNG con tamaño máximo acotado
 * para evitar archivos pesados o errores con logos muy grandes subidos por el cliente.
 */
export async function downscaleImageDataUrl(
  dataUrl: string,
  maxWidth = 600,
  maxHeight = 600,
  backgroundColor?: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!dataUrl) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width || 300;
      const origH = img.naturalHeight || img.height || 300;

      let targetW = origW;
      let targetH = origH;

      if (targetW > maxWidth || targetH > maxHeight) {
        const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
        targetW = Math.max(1, Math.round(targetW * ratio));
        targetH = Math.max(1, Math.round(targetH * ratio));
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetW, targetH);
      } else {
        ctx.clearRect(0, 0, targetW, targetH);
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        const outUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl: outUrl, width: targetW, height: targetH });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Recorta el exceso de margen lateral del visor 3D panorámico para centrar y ampliar el calcetín en el PDF.
 */
async function prepareSockSnapshotForPdf(
  dataUrl: string,
  maxWidth = 560,
  maxHeight = 600
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!dataUrl) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width || 400;
      const origH = img.naturalHeight || img.height || 400;

      // Si el lienzo 3D es apaisado, recortamos horizontalmente alrededor del centro (proporción ~0.88:1)
      const desiredAspect = 0.88;
      let sx = 0;
      let sy = 0;
      let sw = origW;
      let sh = origH;

      if (origW / origH > desiredAspect) {
        sw = Math.round(origH * desiredAspect);
        sx = Math.round((origW - sw) / 2);
      }

      const ratio = Math.min(1, maxWidth / sw, maxHeight / sh);
      const targetW = Math.max(1, Math.round(sw * ratio));
      const targetH = Math.max(1, Math.round(sh * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.fillStyle = '#F5F8FA';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

      try {
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: targetW,
          height: targetH
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Describe los motivos tejidos y el logotipo configurados por el cliente.
 */
function describeMotifsAndLogo(config: ExtendedSockConfig): {
  patternText: string;
  logoText: string;
  knittedTextDesc: string;
} {
  const pat = config.pattern;
  let patternText = 'Sin motivo adicional (tejido liso)';

  if (pat && pat.type !== 'none') {
    const patColorName = getColorLabel(pat.color);
    if (pat.type === 'stripes') {
      const zoneLabel =
        pat.stripesZone === 'cuff'
          ? 'solo en puño'
          : pat.stripesZone === 'leg'
          ? 'solo en caña'
          : 'en puño y caña';
      const thickLabel =
        pat.stripesThickness === 'thin'
          ? 'finas'
          : pat.stripesThickness === 'medium'
          ? 'medias'
          : 'anchas';
      patternText = `Rayas (${pat.stripesCount} rayas ${thickLabel}, ${zoneLabel}) · Color: ${patColorName}`;
    } else if (pat.type === 'dots') {
      const sizeLabel =
        pat.dotsSize === 'small'
          ? 'pequeños'
          : pat.dotsSize === 'medium'
          ? 'medios'
          : 'grandes';
      const densLabel =
        pat.dotsDensity === 'few'
          ? 'pocos'
          : pat.dotsDensity === 'medium'
          ? 'densidad media'
          : 'muchos';
      patternText = `Lunares (${sizeLabel}, ${densLabel}) · Color: ${patColorName}`;
    } else if (pat.type === 'checks') {
      patternText = `Cuadros pequeños (Jacquard fino) · Color: ${patColorName}`;
    }
  }

  let logoText = 'Sin logotipo';
  if (config.logo?.url) {
    const pos = config.logoPosition || (config.logo.repeatBack ? 'both' : 'front');
    const posLabel =
      pos === 'both'
        ? 'Ambas caras de la caña (delante y detrás)'
        : pos === 'back'
        ? 'Caña detrás'
        : 'Caña delante';
    const bg = config.logoBg;
    let bgLabel = 'sin parche de fondo';
    if (bg && bg.type !== 'none') {
      const shape = bg.type === 'circle' ? 'parche circular' : 'parche rectangular redondeado';
      bgLabel = `con ${shape} (${getShortColorName(bg.color)})`;
    }
    logoText = `Logotipo en ${posLabel} (escala ${Math.round((config.logo.scale || 1) * 100)}%, ${bgLabel})`;
  }

  let knittedTextDesc = 'Sin texto tejido';
  if (config.knittedText?.text && config.knittedText.text.trim().length > 0) {
    knittedTextDesc = `"${config.knittedText.text.trim().toUpperCase()}" (${getShortColorName(
      config.knittedText.color
    )})`;
  }

  return { patternText, logoText, knittedTextDesc };
}

export interface GenerateQuotePdfOptions {
  config: ExtendedSockConfig;
  pricing?: PriceBreakdown;
  snapshotDataUrl?: string;
  machineInks?: { code: string; name: string; hex: string }[];
}

/**
 * Genera y descarga el presupuesto en PDF de 1 página A4.
 * Reutiliza calculatePricing para garantizar coincidencia exacta con los precios en vivo de la web.
 */
export async function generateAndDownloadQuotePdf({
  config,
  pricing: providedPricing,
  snapshotDataUrl,
  machineInks
}: GenerateQuotePdfOptions): Promise<{ fileName: string; quoteNumber: string }> {
  // Reutiliza la función existente de cálculo de precios sin duplicar lógica
  const pricing = providedPricing ?? calculatePricing(config);
  const materialObj = MATERIALS.find((m) => m.id === config.material) || MATERIALS[0];

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const issueDateStr = `${dd}/${mm}/${yyyy}`;
  const validUntilDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const validUntilStr = `${String(validUntilDate.getDate()).padStart(2, '0')}/${String(
    validUntilDate.getMonth() + 1
  ).padStart(2, '0')}/${validUntilDate.getFullYear()}`;

  const quoteNumber = getNextQuoteNumber(now);
  const fileName = `Presupuesto_MMZ_Socks_${yyyy}-${mm}-${dd}.pdf`;

  // Crear documento A4 vertical en milímetros (210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  // Paleta corporativa MMZ Socks
  const PETROL_DARK: [number, number, number] = [23, 58, 75]; // #173A4B
  const PETROL: [number, number, number] = [31, 77, 99]; // #1F4D63
  const TURQUOISE: [number, number, number] = [27, 122, 147]; // #1B7A93
  const TURQUOISE_LIGHT: [number, number, number] = [42, 157, 184]; // #2A9DB8
  const ICE_BG: [number, number, number] = [242, 248, 250]; // #F2F8FA
  const SLATE_800: [number, number, number] = [30, 41, 59];
  const SLATE_600: [number, number, number] = [71, 85, 105];
  const BORDER_LIGHT: [number, number, number] = [214, 226, 234];
  const MUSTARD: [number, number, number] = [242, 193, 78];

  const pageW = 210;
  const marginX = 14;
  const contentW = pageW - marginX * 2; // 182 mm

  // =========================================================================
  // 1. CABECERA CORPORATIVA (MMZ Socks, Pradoluengo - Burgos)
  // =========================================================================
  doc.setFillColor(...PETROL_DARK);
  doc.rect(0, 0, pageW, 34, 'F');

  // Franja decorativa inferior en turquesa
  doc.setFillColor(...TURQUOISE_LIGHT);
  doc.rect(0, 33, pageW, 1.2, 'F');

  // Icono / Emblema "M" de MMZ Socks
  doc.setFillColor(...TURQUOISE);
  doc.roundedRect(marginX, 7.5, 13, 13, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('M', marginX + 6.5, 16, { align: 'center' });

  // Nombre de la fábrica y localidad
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16.5);
  doc.setTextColor(255, 255, 255);
  doc.text('MMZ SOCKS', marginX + 16, 13.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(182, 214, 225);
  doc.text('Fábrica de calcetines personalizados · Pradoluengo (Burgos)', marginX + 16, 18.5);

  doc.setFontSize(7.8);
  doc.setTextColor(203, 213, 225);
  doc.text('Tejeduría jacquard sin costuras · Materiales certificados desde 10 pares', marginX + 16, 23.2);

  // Bloque derecho en cabecera: Título "Presupuesto", nº correlativo, fecha y validez
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(...MUSTARD);
  doc.text('Presupuesto', pageW - marginX, 12.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Nº ${quoteNumber}`, pageW - marginX, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(226, 232, 240);
  doc.text(`Fecha de emisión: ${issueDateStr}`, pageW - marginX, 23, { align: 'right' });
  doc.text(`Validez: Válido 30 días (hasta ${validUntilStr})`, pageW - marginX, 27.5, { align: 'right' });

  // =========================================================================
  // 2. BLOQUE VISUAL DEL CALCETÍN DISEÑADO + FICHA TÉCNICA
  // =========================================================================
  let cursorY = 39;
  const visualBoxH = 72;
  const leftCardW = 70;
  const rightCardW = contentW - leftCardW - 5; // 107 mm

  // Tarjeta izquierda: Captura del visor 3D del calcetín diseñado
  doc.setFillColor(...ICE_BG);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, cursorY, leftCardW, visualBoxH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...PETROL);
  doc.text('VISTA PREVIA DEL CALCETÍN 3D', marginX + leftCardW / 2, cursorY + 5.5, {
    align: 'center'
  });

  if (snapshotDataUrl) {
    const processedSnap = await prepareSockSnapshotForPdf(snapshotDataUrl, 560, 600);
    if (processedSnap) {
      const maxImgW = leftCardW - 8;
      const maxImgH = visualBoxH - 11;
      const ratio = Math.min(maxImgW / processedSnap.width, maxImgH / processedSnap.height);
      const drawW = processedSnap.width * ratio;
      const drawH = processedSnap.height * ratio;
      const imgX = marginX + (leftCardW - drawW) / 2;
      const imgY = cursorY + 7.5 + (maxImgH - drawH) / 2;

      doc.addImage(processedSnap.dataUrl, 'PNG', imgX, imgY, drawW, drawH, undefined, 'FAST');
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE_600);
    doc.text('Vista previa 3D del calcetín', marginX + leftCardW / 2, cursorY + 36, {
      align: 'center'
    });
  }

  // Si el cliente subió o activó un logo, lo reducimos antes de meterlo en el PDF
  if (config.logo?.url) {
    const smallLogo = await downscaleImageDataUrl(config.logo.url, 180, 180);
    if (smallLogo) {
      const badgeSize = 13;
      const bx = marginX + leftCardW - badgeSize - 3;
      const by = cursorY + visualBoxH - badgeSize - 3;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...BORDER_LIGHT);
      doc.roundedRect(bx - 1, by - 1, badgeSize + 2, badgeSize + 2, 1.5, 1.5, 'FD');

      const lRatio = Math.min(badgeSize / smallLogo.width, badgeSize / smallLogo.height);
      const lw = smallLogo.width * lRatio;
      const lh = smallLogo.height * lRatio;
      doc.addImage(
        smallLogo.dataUrl,
        'PNG',
        bx + (badgeSize - lw) / 2,
        by + (badgeSize - lh) / 2,
        lw,
        lh,
        undefined,
        'FAST'
      );
    }
  }

  // Tarjeta derecha: Resumen técnico del diseño
  const rightX = marginX + leftCardW + 5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.roundedRect(rightX, cursorY, rightCardW, visualBoxH, 3, 3, 'FD');

  doc.setFillColor(...PETROL);
  doc.roundedRect(rightX, cursorY, rightCardW, 7.5, 3, 3, 'F');
  doc.rect(rightX, cursorY + 4, rightCardW, 3.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(255, 255, 255);
  doc.text('FICHA DE PERSONALIZACIÓN DEL CALCETÍN', rightX + 4, cursorY + 5.1);

  const { patternText, logoText, knittedTextDesc } = describeMotifsAndLogo(config);

  let specY = cursorY + 12.5;
  const specLabelX = rightX + 4;
  const specValX = rightX + 30;
  const specMaxW = rightCardW - 34; // 73 mm

  const drawSpecRow = (label: string, val: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...PETROL_DARK);
    doc.text(label, specLabelX, specY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...SLATE_800);
    const wrapped = doc.splitTextToSize(val, specMaxW);
    doc.text(wrapped, specValX, specY);
    specY += Math.max(1, wrapped.length) * 3.7 + 1.5;
  };

  drawSpecRow('Modelo / Fibra:', `${materialObj.name} (${materialObj.composition})`);

  // Dibujar cuadrícula 2x2 de muestras de color para que nunca se corten los nombres
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...PETROL_DARK);
  doc.text('Colores zonas:', specLabelX, specY);

  const heelToeHex = config.heelToeColor || DEFAULT_HEEL_TOE_COLOR;
  const colorZones = [
    { zone: 'Caña', hex: config.legColor, label: getShortColorName(config.legColor) },
    { zone: 'Puño', hex: config.cuffColor, label: getShortColorName(config.cuffColor) },
    { zone: 'Pie', hex: config.footColor, label: getShortColorName(config.footColor) },
    { zone: 'Talón/Punt.', hex: heelToeHex, label: getTecnoYarnLabel(heelToeHex) }
  ];

  colorZones.forEach((sw, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = specValX + col * 36.5;
    const cy = specY + row * 4.4;
    const [r, g, b] = hexToRgb(sw.hex);
    doc.setFillColor(r, g, b);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.circle(cx + 1.6, cy - 1.0, 1.6, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...SLATE_800);
    doc.text(`${sw.zone}: ${sw.label}`, cx + 4.2, cy);
  });

  specY += 9.8;

  const inksSummary =
    machineInks && machineInks.length > 0
      ? ` · Carta TecnoYarn: ${machineInks.map((m) => `${m.code} ${m.name}`).join(', ')}`
      : '';

  drawSpecRow(
    'Hilaturas activas:',
    `${pricing.totalColorsCount} ${
      pricing.totalColorsCount === 1 ? 'color de hilo' : 'colores de hilo'
    } (hasta 2 colores incluidos)${inksSummary}`
  );
  drawSpecRow('Motivo tejido:', patternText);
  drawSpecRow('Logotipo:', logoText);
  drawSpecRow('Texto tejido:', knittedTextDesc);
  drawSpecRow('Cantidad:', `${pricing.quantity.toLocaleString('es-ES')} pares`);

  // =========================================================================
  // 3. TABLA DEL PRESUPUESTO (Modelo, Colores, Motivos/Logo, Cantidad, Precio/par, Subtotal, IVA 21%, Total)
  // =========================================================================
  cursorY += visualBoxH + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PETROL_DARK);
  doc.text('TABLA DE DESGLOSE Y PRECIOS', marginX, cursorY);

  cursorY += 2.5;

  // Columnas de la tabla (ancho total = 182 mm)
  const col1X = marginX + 3; // Concepto (ancho ~42 mm)
  const col2X = marginX + 47; // Descripción (ancho ~67 mm)
  const col3X = marginX + 116; // Cantidad / Precio unitario (ancho ~36 mm)
  const col4RightX = marginX + contentW - 3; // Importe a la derecha

  doc.setFillColor(...PETROL_DARK);
  doc.roundedRect(marginX, cursorY, contentW, 7.5, 2, 2, 'F');
  doc.rect(marginX, cursorY + 4, contentW, 3.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  doc.text('CONCEPTO', col1X, cursorY + 5.0);
  doc.text('DETALLE DE CONFIGURACIÓN', col2X, cursorY + 5.0);
  doc.text('CANTIDAD / PRECIO PAR', col3X, cursorY + 5.0);
  doc.text('IMPORTE', col4RightX, cursorY + 5.0, { align: 'right' });

  cursorY += 7.5;

  interface TableRowData {
    concept: string;
    detail: string;
    unitInfo: string;
    amount: string;
    rowStyle?: 'normal' | 'accent' | 'subtotal' | 'total';
  }

  const colorsSummary = `Caña: ${getColorLabel(config.legColor)} · Puño: ${getColorLabel(
    config.cuffColor
  )} · Pie: ${getColorLabel(config.footColor)} · Talón y puntera: ${getTecnoYarnLabel(
    heelToeHex
  )} (${heelToeHex.toUpperCase()})`;

  const hasPattern = Boolean(config.pattern && config.pattern.type !== 'none');
  const motifsAndLogoSummary = [
    hasPattern ? patternText : 'Motivo: Liso',
    config.logo?.url ? logoText : 'Logo: Sin logotipo',
    config.knittedText?.text?.trim() ? `Texto: ${knittedTextDesc}` : null
  ]
    .filter(Boolean)
    .join(' | ');

  // Suplemento combinado de colores extra + fibra (si aplica) para claridad en la fila de colores/material
  const tableRows: TableRowData[] = [
    {
      concept: 'Modelo',
      detail: `Calcetín personalizado Jacquard — ${materialObj.name} (${materialObj.composition})`,
      unitInfo: `Base: ${formatSpanishEuro(pricing.basePricePerPair)} / par` +
        (pricing.materialExtra > 0 ? ` (+${formatSpanishEuro(pricing.materialExtra)} fibra)` : ''),
      amount: formatSpanishEuro((pricing.basePricePerPair + pricing.materialExtra) * pricing.quantity)
    },
    {
      concept: 'Colores elegidos',
      detail: `${colorsSummary} (${pricing.totalColorsCount} ${
        pricing.totalColorsCount === 1 ? 'color' : 'colores'
      } de hilo)`,
      unitInfo:
        pricing.extraColorsExtra > 0
          ? `Supl. hilos: +${formatSpanishEuro(pricing.extraColorsExtra)} / par`
          : 'Incluidos (hasta 2 colores)',
      amount: formatSpanishEuro(pricing.extraColorsExtra * pricing.quantity)
    },
    {
      concept: 'Motivos o logo',
      detail: motifsAndLogoSummary,
      unitInfo:
        pricing.logoExtra > 0
          ? `Tejido logo: +${formatSpanishEuro(pricing.logoExtra)} / par`
          : 'Sin suplemento de logo',
      amount: formatSpanishEuro(pricing.logoExtra * pricing.quantity)
    },
    {
      concept: 'Cantidad y precio por par',
      detail: `Producción total de calcetines personalizados según diseño configurado`,
      unitInfo: `${pricing.quantity.toLocaleString('es-ES')} pares × ${formatSpanishEuro(
        pricing.pricePerPair
      )} / par`,
      amount: formatSpanishEuro(pricing.subtotalPairs),
      rowStyle: 'accent'
    },
    ...(pricing.setupFee > 0
      ? [
          {
            concept: 'Puesta a punto de telar',
            detail: 'Programación técnica de matriz de agujas Jacquard y preparación de telar (fija 1 sola vez)',
            unitInfo: '1 lote único',
            amount: formatSpanishEuro(pricing.setupFee)
          }
        ]
      : []),
    {
      concept: 'Subtotal',
      detail: `Base imponible (total fabricación ${pricing.quantity.toLocaleString('es-ES')} pares)`,
      unitInfo: 'Base imponible (sin IVA)',
      amount: formatSpanishEuro(pricing.subtotal),
      rowStyle: 'subtotal'
    },
    {
      concept: 'IVA 21%',
      detail: 'Impuesto sobre el Valor Añadido (21% sobre el subtotal)',
      unitInfo: `21% s/ ${formatSpanishEuro(pricing.subtotal)}`,
      amount: formatSpanishEuro(pricing.vat)
    },
    {
      concept: 'TOTAL',
      detail: `Importe total del presupuesto (${pricing.quantity.toLocaleString('es-ES')} pares a ${formatSpanishEuro(
        pricing.pricePerPair
      )}/par + telar + IVA 21%)`,
      unitInfo: 'IVA 21% incluido',
      amount: formatSpanishEuro(pricing.total),
      rowStyle: 'total'
    }
  ];

  tableRows.forEach((row, idx) => {
    const detailLines = doc.splitTextToSize(row.detail, 66);
    const unitLines = doc.splitTextToSize(row.unitInfo, 36);
    const maxLines = Math.max(detailLines.length, unitLines.length, 1);
    const rowH = row.rowStyle === 'total' ? Math.max(10, maxLines * 3.9 + 4.2) : Math.max(7.8, maxLines * 3.8 + 3.4);

    if (row.rowStyle === 'total') {
      doc.setFillColor(...PETROL_DARK);
    } else if (row.rowStyle === 'subtotal') {
      doc.setFillColor(225, 237, 242);
    } else if (row.rowStyle === 'accent') {
      doc.setFillColor(235, 245, 248);
    } else if (idx % 2 === 1) {
      doc.setFillColor(...ICE_BG);
    } else {
      doc.setFillColor(255, 255, 255);
    }

    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.2);
    doc.rect(marginX, cursorY, contentW, rowH, 'FD');

    const textY = cursorY + (row.rowStyle === 'total' ? 5.6 : 4.9);
    const isTotal = row.rowStyle === 'total';
    const isBoldRow = isTotal || row.rowStyle === 'subtotal' || row.rowStyle === 'accent';

    // Columna 1: Concepto
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isTotal ? 9.5 : 8.0);
    if (isTotal) {
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(...PETROL_DARK);
    }
    doc.text(row.concept, col1X, textY);

    // Columna 2: Detalle
    doc.setFont('helvetica', isBoldRow ? 'bold' : 'normal');
    doc.setFontSize(7.6);
    if (isTotal) {
      doc.setTextColor(226, 232, 240);
    } else {
      doc.setTextColor(...SLATE_800);
    }
    doc.text(detailLines, col2X, textY);

    // Columna 3: Cantidad / Precio por par
    doc.setFont('helvetica', isBoldRow ? 'bold' : 'normal');
    doc.setFontSize(7.6);
    if (isTotal) {
      doc.setTextColor(182, 214, 225);
    } else {
      doc.setTextColor(...SLATE_600);
    }
    doc.text(unitLines, col3X, textY);

    // Columna 4: Importe
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isTotal ? 10.5 : 8.4);
    if (isTotal) {
      doc.setTextColor(...MUSTARD);
    } else {
      doc.setTextColor(...PETROL_DARK);
    }
    doc.text(row.amount, col4RightX, textY, { align: 'right' });

    cursorY += rowH;
  });

  // =========================================================================
  // 4. NOTA DE PRESUPUESTO ORIENTATIVO
  // =========================================================================
  cursorY += 4.5;

  doc.setFillColor(254, 249, 235);
  doc.setDrawColor(242, 193, 78);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, cursorY, contentW, 16, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(146, 64, 14);
  doc.text(
    'Nota: Presupuesto orientativo, sujeto a confirmación por MMZ Socks.',
    marginX + 4,
    cursorY + 6
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(...SLATE_600);
  const noteExplanation = doc.splitTextToSize(
    'Presupuesto válido durante 30 días desde su fecha de emisión. El equipo técnico de la fábrica en Pradoluengo revisará los detalles específicos del logotipo, la matriz de agujas y la configuración de hilaturas para confirmar el importe definitivo y los plazos de entrega.',
    contentW - 8
  );
  doc.text(noteExplanation, marginX + 4, cursorY + 10.5);

  // =========================================================================
  // 5. PIE DE PÁGINA CON DATOS DE CONTACTO DE LA FÁBRICA (A4 Bottom)
  // =========================================================================
  const footerY = 266;
  doc.setDrawColor(...TURQUOISE_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(marginX, footerY, pageW - marginX, footerY);

  doc.setFillColor(...ICE_BG);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, footerY + 2, contentW, 18, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PETROL_DARK);
  doc.text(
    'MMZ SOCKS — Sociedad textil y fábrica de calcetines en Pradoluengo (Burgos)',
    marginX + 4,
    footerY + 7.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.0);
  doc.setTextColor(...SLATE_800);
  doc.text(
    'Dirección: C/ Sagrada Familia 2, 09260 Pradoluengo (Burgos), España',
    marginX + 4,
    footerY + 12.5
  );
  doc.text(
    'Teléfono / WhatsApp: +34 627 588 488   ·   Correo oficial: info@mmzsocks.com   ·   Web: www.mmzsocks.com',
    marginX + 4,
    footerY + 17.2
  );

  // Descargar archivo PDF en el navegador (compatible con móvil y ordenador)
  doc.save(fileName);

  return { fileName, quoteNumber };
}
