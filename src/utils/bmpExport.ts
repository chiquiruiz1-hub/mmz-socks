import { KnitPixelGrid, MAX_MACHINE_INKS } from './knitPixelEngine';
import { renderGridToKnitCanvas } from './knitTextureRenderer';
import { getTecnoYarnLabel } from '../data/yarnPalette';

/**
 * Codifica una cuadrícula KnitPixelGrid en un archivo BMP estándar de 8 bits
 * con tabla de colores indexada (1 píxel = 1 aguja, sin escalar, máximo 6 tintas).
 *
 * Estructura estándar Windows BITMAPFILEHEADER (14 B) + BITMAPINFOHEADER (40 B)
 * + tabla de paleta de 256 entradas BGRA (1024 B) + datos de píxeles bottom-up.
 */
export function encodeKnitGridToBmp8Bit(grid: KnitPixelGrid): Uint8Array {
  const width = grid.width;
  const height = grid.height;
  const paletteCount = Math.max(1, Math.min(MAX_MACHINE_INKS, grid.palette.length));

  // Cada fila en BMP debe alinearse a múltiplos de 4 bytes
  const rowStride = Math.ceil(width / 4) * 4;
  const pixelArraySize = rowStride * height;

  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const colorTableEntries = 256;
  const colorTableSize = colorTableEntries * 4;
  const pixelDataOffset = fileHeaderSize + infoHeaderSize + colorTableSize;
  const fileSize = pixelDataOffset + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, pixelDataOffset, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, infoHeaderSize, true); // biSize
  view.setInt32(18, width, true); // biWidth (168 o 200)
  view.setInt32(22, height, true); // biHeight (positivo = bottom-up)
  view.setUint16(26, 1, true); // biPlanes
  view.setUint16(28, 8, true); // biBitCount = 8 bits indexado
  view.setUint32(30, 0, true); // biCompression = BI_RGB (sin compresión)
  view.setUint32(34, pixelArraySize, true); // biSizeImage
  view.setInt32(38, 2835, true); // biXPelsPerMeter (72 DPI)
  view.setInt32(42, 2835, true); // biYPelsPerMeter (72 DPI)
  view.setUint32(46, paletteCount, true); // biClrUsed (máx. 6 tintas)
  view.setUint32(50, paletteCount, true); // biClrImportant

  // Tabla de colores BGRA (256 entradas; solo las `paletteCount` primeras están activas)
  const tableOffset = fileHeaderSize + infoHeaderSize;
  for (let i = 0; i < paletteCount; i++) {
    const entry = grid.palette[i];
    const off = tableOffset + i * 4;
    bytes[off] = entry.b & 0xff;
    bytes[off + 1] = entry.g & 0xff;
    bytes[off + 2] = entry.r & 0xff;
    bytes[off + 3] = 0;
  }

  // Datos de píxeles en orden bottom-up (fila inferior primero)
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    const srcOffset = srcRow * width;
    const dstOffset = pixelDataOffset + y * rowStride;
    for (let x = 0; x < width; x++) {
      const idx = grid.indices[srcOffset + x];
      bytes[dstOffset + x] = idx < paletteCount ? idx : 0;
    }
  }

  return bytes;
}

/**
 * Genera una imagen PNG de vista previa con el patrón tejido de la caña,
 * la vista 3D del calcetín (si está disponible) y el resumen de tintas y agujas.
 */
export async function generateFactoryPreviewPng(
  grid: KnitPixelGrid,
  heelToeColor: string,
  snapshotDataUrl?: string | null
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fondo oscuro estilo estudio MMZ
  ctx.fillStyle = '#0A1A23';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cabecera
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
  ctx.fillText('MMZ Socks · Vista previa para máquina de tejer', 40, 52);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '15px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Cuadrícula real: ${grid.width} × ${grid.height} px (1 píxel = 1 aguja) · ${grid.totalInks} de ${MAX_MACHINE_INKS} tintas máx.`,
    40,
    80
  );

  // Panel izquierdo: render 3D si existe
  ctx.fillStyle = '#112531';
  ctx.beginPath();
  ctx.roundRect(40, 108, 480, 480, 20);
  ctx.fill();

  if (snapshotDataUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth / (img.naturalHeight || 1);
        let dw = 460;
        let dh = 460;
        if (aspect > 1) {
          dh = dw / aspect;
        } else {
          dw = dh * aspect;
        }
        ctx.drawImage(img, 40 + (480 - dw) / 2, 108 + (480 - dh) / 2, dw, dh);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = snapshotDataUrl;
    });
  }

  // Panel derecho: textura de punto tejido de la caña (centrada en la cara delantera)
  const knitCanvas = document.createElement('canvas');
  renderGridToKnitCanvas(grid, knitCanvas);

  ctx.fillStyle = '#112531';
  ctx.beginPath();
  ctx.roundRect(550, 108, 610, 480, 20);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(566, 124, 578, 448, 14);
  ctx.clip();

  // Mostrar la caña desenrollada centrada en u=0 (delantera en el centro)
  const halfW = knitCanvas.width / 2;
  const shifted = document.createElement('canvas');
  shifted.width = knitCanvas.width;
  shifted.height = knitCanvas.height;
  const sctx = shifted.getContext('2d');
  if (sctx) {
    sctx.drawImage(knitCanvas, halfW, 0, halfW, knitCanvas.height, 0, 0, halfW, knitCanvas.height);
    sctx.drawImage(knitCanvas, 0, 0, halfW, knitCanvas.height, halfW, 0, halfW, knitCanvas.height);
    ctx.drawImage(shifted, 566, 124, 578, 448);
  }
  ctx.restore();

  // Pie con paleta de tintas activas TecnoYarn + color talón/puntera + aviso obligatorio
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('Tintas TecnoYarn de la cuadrícula (BMP 8 bits):', 40, 628);

  let sx = 40;
  for (const entry of grid.palette) {
    ctx.fillStyle = entry.hex;
    ctx.fillRect(sx, 642, 22, 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, 642, 22, 22);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${entry.code} ${entry.name}`, sx + 28, 653);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(entry.hex, sx + 28, 666);
    sx += 182;
  }

  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Talón y puntera (forma y posición fijas): ${getTecnoYarnLabel(heelToeColor)} (${heelToeColor.toUpperCase()})`,
    40,
    696
  );

  ctx.fillStyle = '#F2C14E';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('AVISO: La fábrica revisa el diseño antes de tejerlo.', 40, 728);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Descarga el BMP de 8 bits (1 píxel = 1 aguja, sin escalar) y la imagen PNG
 * de vista previa directamente desde el navegador.
 */
export async function downloadMachineDesignFiles(
  grid: KnitPixelGrid,
  heelToeColor: string,
  snapshotDataUrl?: string | null
): Promise<{ bmpFilename: string; previewFilename: string; colorCodes: string[]; heelToeLabel: string }> {
  const bmpBytes = encodeKnitGridToBmp8Bit(grid);
  const bmpBlob = new Blob([bmpBytes.buffer as ArrayBuffer], { type: 'image/bmp' });
  const stamp = new Date().toISOString().slice(0, 10);
  const bmpFilename = `mmz-diseno-${grid.width}agujas-${grid.totalInks}colores-${stamp}.bmp`;
  const previewFilename = `mmz-vista-previa-${grid.width}agujas-${stamp}.png`;

  triggerBlobDownload(bmpBlob, bmpFilename);

  const previewBlob = await generateFactoryPreviewPng(grid, heelToeColor, snapshotDataUrl);
  if (previewBlob) {
    window.setTimeout(() => {
      triggerBlobDownload(previewBlob, previewFilename);
    }, 280);
  }

  return {
    bmpFilename,
    previewFilename,
    colorCodes: grid.palette.map((p) => `${p.code} ${p.name}`),
    heelToeLabel: getTecnoYarnLabel(heelToeColor),
  };
}
