import { SockConfig, PriceBreakdown, MaterialOption } from '../types/sock';

export type PatternType = 'none' | 'stripes' | 'dots' | 'checks';
export type StripesZone = 'cuff' | 'leg' | 'all';
export type StripesThickness = 'thin' | 'medium' | 'thick';
export type DotsSize = 'small' | 'medium' | 'large';
export type DotsDensity = 'few' | 'medium' | 'many';
export type LogoBgType = 'none' | 'circle' | 'roundedRect';
export type LogoPosition = 'front' | 'back' | 'both';

export interface SockPatternConfig {
  type: PatternType;
  color: string;
  stripesZone: StripesZone;
  stripesThickness: StripesThickness;
  stripesCount: number;
  dotsSize: DotsSize;
  dotsDensity: DotsDensity;
}

export interface SockLogoBgConfig {
  type: LogoBgType;
  color: string;
}

export interface SockKnittedTextConfig {
  text: string;
  color: string;
}

export interface ExtendedSockConfig extends SockConfig {
  customCuff?: boolean;
  customFoot?: boolean;
  pattern?: SockPatternConfig;
  logoBg?: SockLogoBgConfig;
  logoPosition?: LogoPosition;
  knittedText?: SockKnittedTextConfig;
}

export const MATERIALS: MaterialOption[] = [
  {
    id: 'cotton',
    name: 'Algodón Peinado',
    description: 'Suave, transpirable y resistente para uso diario y deportivo.',
    extraPerPair: 0.0,
    composition: 'Materiales certificados con base de algodón peinado'
  },
  {
    id: 'organic',
    name: 'Algodón Orgánico',
    description: 'Tacto natural hipoalergénico con materiales certificados.',
    extraPerPair: 0.40,
    composition: 'Algodón orgánico y fibras elásticas'
  },
  {
    id: 'bamboo',
    name: 'Fibra de Bambú',
    description: 'Tacto extra sedoso, transpirable y confortable.',
    extraPerPair: 0.55,
    composition: 'Fibra de bambú y poliamida elástica'
  },
  {
    id: 'merino',
    name: 'Lana Merino',
    description: 'Aislamiento térmico y calidez para temporada fría y montaña.',
    extraPerPair: 1.30,
    composition: 'Lana merino y elastano'
  }
];

// Precios base SIN IVA, calculados a partir de la tarifa publicada en la web
// antigua de la fábrica (IVA incluido): 10-15 pares 6,00 €; 16-24 pares 5,25 €;
// 25-50 pares 4,25 €; más de 50 "consultar". Por encima de 50 se mantiene el
// último tramo como referencia (a confirmar con la fábrica).
export function getBasePricePerPair(qty: number): number {
  if (qty >= 25) return 3.51; // 4,25 € con IVA
  if (qty >= 16) return 4.34; // 5,25 € con IVA
  return 4.96; // 6,00 € con IVA (de 10 a 15 pares)
}

export function calculateColorsCount(config: ExtendedSockConfig): number {
  const set = new Set<string>();

  // 1. Base color (caña) + puño + pie (talón y puntera #2B3140 no cuentan)
  if (config.legColor) {
    set.add(config.legColor.trim().toLowerCase());
  }
  if (config.customCuff !== false && config.cuffColor) {
    set.add(config.cuffColor.trim().toLowerCase());
  }
  if (config.customFoot !== false && config.footColor) {
    set.add(config.footColor.trim().toLowerCase());
  }

  // 2. Motivo (rayas, lunares o cuadros pequeños)
  if (config.pattern && config.pattern.type !== 'none' && config.pattern.color) {
    set.add(config.pattern.color.trim().toLowerCase());
  }

  // 3. Logo y su parche de fondo
  if (config.logo?.url) {
    if (config.logoBg && config.logoBg.type !== 'none' && config.logoBg.color) {
      set.add(config.logoBg.color.trim().toLowerCase());
    }
    set.add('logo-color-primary');
  }

  // 4. Texto tejido
  if (config.knittedText && config.knittedText.text.trim().length > 0 && config.knittedText.color) {
    set.add(config.knittedText.color.trim().toLowerCase());
  }

  return Math.max(1, set.size);
}

export function calculatePricing(config: ExtendedSockConfig, overrideColorsCount?: number): PriceBreakdown {
  const quantity = Math.max(10, Math.round(config.quantity || 10));
  const basePricePerPair = getBasePricePerPair(quantity);

  const mat = MATERIALS.find((m) => m.id === config.material) || MATERIALS[0];
  const materialExtra = mat.extraPerPair;

  let logoExtra = 0;
  if (config.logo?.url) {
    logoExtra = 0.35;
    const isBothFaces = config.logoPosition
      ? config.logoPosition === 'both'
      : Boolean(config.logo.repeatBack);
    if (isBothFaces) {
      logoExtra += 0.20; // 0.55 total
    }
  }

  const totalColorsCount = overrideColorsCount ?? calculateColorsCount(config);
  const extraColorsCount = Math.max(0, totalColorsCount - 2);
  const extraColorsExtra = Number((extraColorsCount * 0.12).toFixed(2));

  const pricePerPair = Number((basePricePerPair + materialExtra + logoExtra + extraColorsExtra).toFixed(2));
  const subtotalPairs = Number((pricePerPair * quantity).toFixed(2));
  const setupFee = 0; // la tarifa real de la fábrica no incluye cuota de puesta a punto
  const subtotal = Number((subtotalPairs + setupFee).toFixed(2));
  const vat = Number((subtotal * 0.21).toFixed(2));
  const total = Number((subtotal + vat).toFixed(2));

  return {
    quantity,
    basePricePerPair,
    materialExtra,
    logoExtra,
    extraColorsExtra,
    pricePerPair,
    subtotalPairs,
    setupFee,
    subtotal,
    vat,
    total,
    totalColorsCount
  };
}
