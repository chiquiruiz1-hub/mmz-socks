/**
 * CARTA REAL DE HILO TECNOYARN
 * "Poliammide Nylon 6 Testurizzato Semiopaco tinto in filo" — 110 colores.
 * ---------------------------------------------------------------------------
 * NOTA IMPORTANTE: Los códigos hexadecimales (#RRGGBB) se han extraído a
 * partir de capturas de pantalla de la carta física, por lo que son
 * APROXIMADOS en pantalla. La referencia oficial para la fábrica es el
 * código de carta (E1 .. E907).
 *
 * Única fuente de verdad para:
 *  - Tintas del dibujo / logo (máx. 6 tintas)
 *  - Color de talón y puntera (forma y posición fijas)
 *  - Paleta exacta del archivo BMP de 8 bits
 */

export interface TecnoYarnColor {
  code: string;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

export interface CottonBaseColor {
  id: string;
  name: string;
  hex: string;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0,
  ];
}

function makeEntry(code: string, name: string, hex: string): TecnoYarnColor {
  const upperHex = hex.toUpperCase();
  const [r, g, b] = parseHexRgb(upperHex);
  return { code, name, hex: upperHex, r, g, b };
}

export const TECNOYARN_PALETTE: TecnoYarnColor[] = [
  makeEntry('E1', 'Candido', '#F4F0FD'),
  makeEntry('E2', 'Ecru', '#F3EAE7'),
  makeEntry('E3', 'Nero', '#040404'),
  makeEntry('E4', 'Antracite', '#151522'),
  makeEntry('E5', 'Ferro', '#281E1A'),
  makeEntry('E6', 'Tubo', '#5B4954'),
  makeEntry('E7', 'Lama', '#6A5554'),
  makeEntry('E8', 'Piombo', '#7E7981'),
  makeEntry('E9', 'Nebbia', '#C4AF96'),
  makeEntry('E10', 'Platano', '#CDA48E'),
  makeEntry('E11', 'Notte', '#090914'),
  makeEntry('E12', 'Navy', '#01091C'),
  makeEntry('E13', 'Indaco', '#052F62'),
  makeEntry('E14', 'Principe', '#033666'),
  makeEntry('E15', 'Aviatore', '#2E4974'),
  makeEntry('E16', 'Azzurro', '#70C1F6'),
  makeEntry('E17', 'Sky', '#B7E4FB'),
  makeEntry('E18', 'Turchese', '#01A4DF'),
  makeEntry('E19', 'Elettrico', '#0453B2'),
  makeEntry('E20', 'Francese', '#042E9A'),
  makeEntry('E21', 'Moro', '#0F0504'),
  makeEntry('E22', 'Castagna', '#481A05'),
  makeEntry('E23', 'Cioccolato', '#471806'),
  makeEntry('E24', 'Corteccia', '#6F380C'),
  makeEntry('E25', 'Caffe', '#A86113'),
  makeEntry('E26', 'Tortora', '#B4A68B'),
  makeEntry('E27', 'Cipolla', '#D37E5E'),
  makeEntry('E28', 'Sabbia', '#FCD1A8'),
  makeEntry('E29', 'Crema', '#F7C978'),
  makeEntry('E30', 'Beige', '#F8DCAB'),
  makeEntry('E31', 'Bordeaux', '#35020C'),
  makeEntry('E32', 'Vino', '#950110'),
  makeEntry('E33', 'Rosso', '#DE0212'),
  makeEntry('E34', 'Fiamma', '#EE0314'),
  makeEntry('E35', 'Arancio', '#F87804'),
  makeEntry('E36', 'Limone', '#FDDF01'),
  makeEntry('E37', 'Paglia', '#FCEA19'),
  makeEntry('E38', 'Canarino', '#FCE8AA'),
  makeEntry('E39', 'Senape', '#E88509'),
  makeEntry('E40', 'Noisette', '#652306'),
  makeEntry('E41', 'Bottiglia', '#051314'),
  makeEntry('E42', 'Pino', '#242520'),
  makeEntry('E43', 'Salvia', '#83947C'),
  makeEntry('E44', 'Prato', '#058059'),
  makeEntry('E45', 'Acqua', '#B0EAD1'),
  makeEntry('E46', 'Anice', '#B1F5FA'),
  makeEntry('E47', 'Rosa', '#FDBEC4'),
  makeEntry('E48', 'Confetto', '#FDDBD5'),
  makeEntry('E49', 'Fuxia', '#FB5488'),
  makeEntry('E50', 'Lilla', '#AD7CF0'),
  makeEntry('E51', 'Viola', '#4B1775'),
  makeEntry('E52', 'Margherita', '#FDD734'),
  makeEntry('E53', 'Ciclamino', '#F61561'),
  makeEntry('E54', 'Smeraldo', '#039594'),
  makeEntry('E55', 'Erba', '#C0E114'),
  makeEntry('E56', 'Marina', '#42E7F9'),
  makeEntry('E57', 'Panse', '#885CE6'),
  makeEntry('E58', 'Cardinale', '#E72497'),
  makeEntry('E59', 'Petrolio', '#03698D'),
  makeEntry('E60', 'Rubino', '#750216'),
  makeEntry('E61', 'Argento', '#CAC0C1'),
  makeEntry('E62', 'Pirite', '#596980'),
  makeEntry('E63', 'Acciaio', '#4D3D43'),
  makeEntry('E64', 'Regata', '#ABCBF2'),
  makeEntry('E65', 'Burrasca', '#1E5CAE'),
  makeEntry('E66', 'Royal', '#02289E'),
  makeEntry('E67', 'Kaki', '#6D7017'),
  makeEntry('E68', 'Kiwi', '#B08443'),
  makeEntry('E69', 'Quadrifoglio', '#365A5A'),
  makeEntry('E70', 'Irlanda', '#046657'),
  makeEntry('E71', 'Gladiolo', '#FAB792'),
  makeEntry('E72', 'Carne', '#FBC38F'),
  makeEntry('E73', 'Rosa antico', '#FB889A'),
  makeEntry('E74', 'Ambra', '#F4590E'),
  makeEntry('E75', 'Ruggine', '#992F0F'),
  makeEntry('E76', 'Corda', '#DE7427'),
  makeEntry('E77', 'Sole', '#FDC034'),
  makeEntry('E78', 'Prugna', '#7C1E53'),
  makeEntry('E79', 'Giada', '#DDF5AC'),
  makeEntry('E80', 'Cherry', '#B60219'),
  makeEntry('E81', 'Clorofilla', '#FAEF77'),
  makeEntry('E82', 'Veronese', '#8AAC31'),
  makeEntry('E83', 'Orchidea', '#F8A591'),
  makeEntry('E84', 'Bulbo', '#C74962'),
  makeEntry('E85', 'Ametista', '#6A59A7'),
  makeEntry('E86', 'Mirtillo', '#210F27'),
  makeEntry('E87', 'Miele', '#FDC532'),
  makeEntry('E88', 'Cipria', '#F5C0D8'),
  makeEntry('E89', 'Siderite', '#C1B3CB'),
  makeEntry('E90', 'Lavanda', '#7D8BBC'),
  makeEntry('E91', 'Marmo', '#D4CDD6'),
  makeEntry('E92', 'Ghiaia', '#C2BDC1'),
  makeEntry('E93', 'Elefante', '#96858D'),
  makeEntry('E94', 'Caramello', '#DB8019'),
  makeEntry('E95', 'Adria', '#0295DB'),
  makeEntry('E96', 'Cremisi', '#F7081B'),
  makeEntry('E97', 'Metallo', '#B8B3B9'),
  makeEntry('E98', 'Verde fluo', '#51FD43'),
  makeEntry('E99', 'Giallo fluo', '#EBFD2D'),
  makeEntry('E100', 'Arancio fluo', '#FC5402'),
  makeEntry('E672', 'Fuxia fluo', '#FC1A85'),
  makeEntry('E831', 'Iris', '#552E61'),
  makeEntry('E900', 'Rosa fluo', '#FCB0D2'),
  makeEntry('E901', 'Cobalto', '#045373'),
  makeEntry('E902', 'Corallo', '#FC775B'),
  makeEntry('E903', 'Militare', '#796436'),
  makeEntry('E904', 'Autostrada', '#04B562'),
  makeEntry('E905', 'Volpe', '#FD7E2E'),
  makeEntry('E906', 'Malachite', '#02C5B4'),
  makeEntry('E907', 'Abisso', '#133F5F'),
];

/**
 * TODO: Falta la carta real de algodón de la fábrica.
 * Se mantiene sin cambios esta paleta base de algodón para el fondo del calcetín
 * (puño, caña y pie) hasta recibir las referencias oficiales de algodón.
 */
export const COTTON_BASE_PALETTE: CottonBaseColor[] = [
  { id: 'blanco-puro', name: 'Blanco Puro', hex: '#FFFFFF' },
  { id: 'negro-carbon', name: 'Negro Carbón', hex: '#1E232A' },
  { id: 'azul-petroleo', name: 'Azul Petróleo', hex: '#1F4D63' },
  { id: 'azul-noche', name: 'Azul Noche', hex: '#173A4B' },
  { id: 'turquesa', name: 'Turquesa', hex: '#1B7A93' },
  { id: 'turquesa-claro', name: 'Turquesa Claro', hex: '#2A9DB8' },
  { id: 'crudo-natural', name: 'Crudo Natural', hex: '#F4F1EA' },
  { id: 'mostaza-calido', name: 'Mostaza Cálido', hex: '#F2C14E' },
  { id: 'coral-terracota', name: 'Coral Terracota', hex: '#E36F73' },
  { id: 'verde-bosque', name: 'Verde Bosque', hex: '#2D6A4F' },
  { id: 'burdeos-sierra', name: 'Burdeos Sierra', hex: '#782834' },
];

// Color inicial de talón y puntera: E4 Antracite (de la carta TecnoYarn)
export const DEFAULT_HEEL_TOE_COLOR = '#151522';

// Alias de compatibilidad
export const YARN_PALETTE = TECNOYARN_PALETTE;

const TECNOYARN_BY_HEX = new Map<string, TecnoYarnColor>(
  TECNOYARN_PALETTE.map((c) => [c.hex.toLowerCase(), c])
);

const COTTON_BY_HEX = new Map<string, CottonBaseColor>(
  COTTON_BASE_PALETTE.map((c) => [c.hex.toLowerCase(), c])
);

/** Distancia perceptual ponderada en RGB para buscar el color TecnoYarn más cercano. */
export function perceptualRgbDistSq(
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
 * Encuentra el color más cercano en la carta real TecnoYarn (110 colores)
 * usando distancia perceptual RGB.
 */
export function findNearestTecnoYarnColor(r: number, g: number, b: number): TecnoYarnColor {
  let best = TECNOYARN_PALETTE[0];
  let bestDist = Infinity;
  for (let i = 0; i < TECNOYARN_PALETTE.length; i++) {
    const c = TECNOYARN_PALETTE[i];
    const d = perceptualRgbDistSq(r, g, b, c.r, c.g, c.b);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function findNearestTecnoYarnByHex(hex: string): TecnoYarnColor {
  const normalized = (hex || '#F4F0FD').trim().toLowerCase();
  const exact = TECNOYARN_BY_HEX.get(normalized);
  if (exact) return exact;
  const [r, g, b] = parseHexRgb(normalized);
  return findNearestTecnoYarnColor(r, g, b);
}

export function findTecnoYarnByHex(hex: string): TecnoYarnColor | undefined {
  return TECNOYARN_BY_HEX.get((hex || '').trim().toLowerCase());
}

/**
 * Devuelve la etiqueta legible con código TecnoYarn (p. ej. "E33 Rosso").
 * Si es un color exacto de algodón base, devuelve su nombre de algodón.
 */
export function getYarnColorName(hex: string): string {
  const normalized = (hex || '').trim().toLowerCase();
  const ty = TECNOYARN_BY_HEX.get(normalized);
  if (ty) return `${ty.code} ${ty.name}`;
  const cotton = COTTON_BY_HEX.get(normalized);
  if (cotton) return cotton.name;
  return normalized.toUpperCase();
}

/**
 * Devuelve siempre la referencia TecnoYarn "E33 Rosso" (exacta o más cercana).
 */
export function getTecnoYarnLabel(hex: string): string {
  const ty = findNearestTecnoYarnByHex(hex);
  return `${ty.code} ${ty.name}`;
}
