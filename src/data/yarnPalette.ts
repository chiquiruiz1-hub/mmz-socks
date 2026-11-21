/**
 * PALETA PROVISIONAL DE HILOS (DEMO)
 * ---------------------------------------------------------------------------
 * Pendiente de sustituir por la carta real de colores de TecnoYarn cuando la
 * fábrica envíe las referencias oficiales.
 *
 * Para actualizar la carta real en el futuro, basta con editar este archivo:
 * cada entrada lleva su nombre comercial y código hexadecimal (#RRGGBB).
 */
export interface YarnColor {
  id: string;
  name: string;
  hex: string;
}

export const YARN_PALETTE_IS_PROVISIONAL = true;

export const YARN_PALETTE: YarnColor[] = [
  { id: 'blanco-puro', name: 'Blanco Puro', hex: '#FFFFFF' },
  { id: 'negro-carbon', name: 'Negro Carbón', hex: '#1E232A' },
  { id: 'gris-pizarra', name: 'Gris Pizarra', hex: '#2B3140' },
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

export const DEFAULT_HEEL_TOE_COLOR = '#2B3140';

export const YARN_COLOR_NAMES_MAP: Record<string, string> = Object.fromEntries(
  YARN_PALETTE.map((c) => [c.hex.toLowerCase(), c.name])
);

export function getYarnColorName(hex: string): string {
  const normalized = (hex || '').trim().toLowerCase();
  return YARN_COLOR_NAMES_MAP[normalized] || normalized.toUpperCase();
}
