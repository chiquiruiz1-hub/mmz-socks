export type MaterialType = 'cotton' | 'organic' | 'bamboo' | 'merino';

export interface MaterialOption {
  id: MaterialType;
  name: string;
  description: string;
  extraPerPair: number;
  composition: string;
}

export interface SockConfig {
  cuffColor: string;
  legColor: string;
  footColor: string;
  heelToeColor: string; // Fixed slate grey #2B3140
  logo: {
    url: string | null;
    scale: number; // 0.4 to 1.4
    yPos: number; // 0.1 to 0.8
    rotation: number; // -180 to 180 degrees
    repeatBack: boolean;
    allOver?: boolean; // diseño repetido por todo el calcetín
  };
  material: MaterialType;
  quantity: number;
}

export interface PriceBreakdown {
  quantity: number;
  basePricePerPair: number;
  materialExtra: number;
  logoExtra: number;
  extraColorsExtra: number;
  pricePerPair: number;
  subtotalPairs: number;
  setupFee: number;
  subtotal: number;
  vat: number;
  total: number;
  totalColorsCount: number;
}

export interface ColorPreset {
  name: string;
  hex: string;
  category: 'core' | 'accent';
}
