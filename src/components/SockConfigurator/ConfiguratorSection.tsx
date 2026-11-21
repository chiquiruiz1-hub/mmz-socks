import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Upload,
  RotateCcw,
  Check,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  Tag,
  Download,
  Wand2,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  Palette,
  Send,
  CheckCircle2
} from 'lucide-react';
import { SockViewer3D } from './SockViewer3D';
import { SockConfig, NeedleCount } from '../../types/sock';
import {
  COTTON_BASE_PALETTE,
  TECNOYARN_PALETTE,
  SIMPLE_YARN_COLORS,
  DEFAULT_HEEL_TOE_COLOR,
  getFriendlyColorName,
  findNearestTecnoYarnByHex
} from '../../data/yarnPalette';
import {
  KnitPixelGrid,
  MAX_MACHINE_INKS
} from '../../utils/knitPixelEngine';
import { downloadMachineDesignFiles } from '../../utils/bmpExport';
import {
  MATERIALS,
  calculatePricing,
  ExtendedSockConfig,
  PatternType,
  StripesZone,
  StripesThickness,
  DotsSize,
  DotsDensity,
  LogoBgType,
  LogoPosition
} from '../../utils/pricing';
import {
  generateAndDownloadQuotePdf,
  downscaleImageDataUrl
} from '../../utils/pdfQuote';

// Logo de ejemplo en 2 líneas gruesas y legibles
const SAMPLE_CHURRERIA_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 240" width="460" height="240"><text x="230" y="92" font-family="Arial Black, Impact, Arial, sans-serif" font-weight="900" font-size="68" fill="%23D32F2F" text-anchor="middle" textLength="436" lengthAdjust="spacingAndGlyphs">CHURRERÍA</text><text x="230" y="216" font-family="Arial Black, Impact, Arial, sans-serif" font-weight="900" font-size="134" fill="%23D32F2F" text-anchor="middle" letter-spacing="6">PEPE</text></svg>`;

function sanitizeSvgMarkup(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function sanitizeText(text: string): string {
  return text.replace(/[<>]/g, '').trim();
}

type DesignPresetId = 'liso' | 'clasico' | 'deportivo' | 'corporativo';
type WizardStep = 1 | 2 | 3 | 4;

const STEPS: Array<{ id: WizardStep; shortTitle: string; title: string }> = [
  { id: 1, shortTitle: 'Color', title: 'Elige el color de tu calcetín' },
  { id: 2, shortTitle: 'Logo', title: 'Pon tu logo o tu nombre' },
  { id: 3, shortTitle: 'Cantidad', title: '¿Cuántos pares y de qué material?' },
  { id: 4, shortTitle: 'Presupuesto', title: 'Pide tu presupuesto' },
];

interface ConfiguratorSectionProps {
  onSelectConfigForQuote: (config: SockConfig, snapshotUrl?: string) => void;
}

/**
 * Selector de color base de algodón (sin cambios en la carta de algodón).
 * Muestra el nombre completo del color seleccionado sin recortarlo.
 */
interface CottonSwatchPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  idPrefix: string;
}

const CottonSwatchPicker: React.FC<CottonSwatchPickerProps> = ({
  label,
  value,
  onChange,
  idPrefix
}) => {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-petrol-dark font-bold">
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/15 flex-shrink-0"
            style={{ backgroundColor: value }}
          />
          <span>{getFriendlyColorName(value)}</span>
        </span>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
        {COTTON_BASE_PALETTE.map((c) => {
          const isSelected = value.trim().toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={`${idPrefix}-${c.hex}`}
              type="button"
              data-testid={`${idPrefix}-swatch-${c.hex.replace('#', '')}`}
              onClick={() => onChange(c.hex)}
              aria-label={c.name}
              title={c.name}
              className={`min-h-[44px] flex items-center justify-center p-1 rounded-xl transition-all border ${
                isSelected
                  ? 'ring-2 ring-turquoise border-white scale-105 shadow-xs bg-white'
                  : 'border-slate-200 hover:border-slate-400 bg-white'
              }`}
            >
              <span
                className="w-7 h-7 rounded-lg shadow-2xs flex items-center justify-center border border-black/10"
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <Check
                    className={`w-4 h-4 ${
                      ['#ffffff', '#f4f1ea', '#f2c14e'].includes(c.hex.toLowerCase())
                        ? 'text-slate-900'
                        : 'text-white'
                    }`}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Selector sencillo de 16 colores comunes en español (mapeados a la carta TecnoYarn).
 * Un enlace "Más colores" despliega los 110 colores con buscador y código TecnoYarn.
 * El nombre completo del color elegido se muestra siempre arriba sin cortarse.
 */
interface SimpleYarnPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  idPrefix: string;
}

const SimpleYarnPicker: React.FC<SimpleYarnPickerProps> = ({
  label,
  value,
  onChange,
  idPrefix
}) => {
  const [showAllColors, setShowAllColors] = useState(false);
  const [query, setQuery] = useState('');

  const selectedTy = findNearestTecnoYarnByHex(value);
  const friendlyName = getFriendlyColorName(selectedTy.hex);
  const cleanQuery = query.trim().toLowerCase();
  const filteredAll = cleanQuery
    ? TECNOYARN_PALETTE.filter(
        (c) =>
          c.code.toLowerCase().includes(cleanQuery) ||
          c.name.toLowerCase().includes(cleanQuery)
      )
    : TECNOYARN_PALETTE;

  return (
    <div className="space-y-3" data-testid={`${idPrefix}-simple-picker`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span
          data-testid={`${idPrefix}-selected-name`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-petrol-dark shadow-2xs"
        >
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/15 flex-shrink-0"
            style={{ backgroundColor: selectedTy.hex }}
          />
          <span>{friendlyName}</span>
        </span>
      </div>

      {/* 16 colores comunes con botones táctiles >= 44px y nombre completo */}
      <div className="grid grid-cols-4 gap-2">
        {SIMPLE_YARN_COLORS.map((c) => {
          const isSelected = selectedTy.code === c.code;
          const isLight = ['#F4F0FD', '#FDDF01', '#F8DCAB', '#FDBEC4', '#70C1F6'].includes(c.hex);
          return (
            <button
              key={`${idPrefix}-simple-${c.code}`}
              type="button"
              data-testid={`${idPrefix}-simple-${c.code}`}
              onClick={() => onChange(c.hex)}
              title={c.name}
              className={`min-h-[44px] px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                isSelected
                  ? 'ring-2 ring-turquoise border-petrol bg-white shadow-xs'
                  : 'border-slate-200 bg-white/90 hover:border-slate-400'
              }`}
            >
              <span
                className="w-6 h-6 rounded-full border border-black/15 flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <Check className={`w-3.5 h-3.5 ${isLight ? 'text-slate-900' : 'text-white'}`} />
                )}
              </span>
              <span className="text-[11px] font-medium text-slate-700 leading-tight text-center break-words">
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Enlace "Más colores" para abrir los 110 colores con buscador y código TecnoYarn */}
      <div className="pt-0.5">
        <button
          type="button"
          data-testid={`${idPrefix}-more-colors-btn`}
          onClick={() => setShowAllColors((prev) => !prev)}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-turquoise hover:bg-turquoise/10 transition-colors"
        >
          <Palette className="w-4 h-4" />
          <span>{showAllColors ? 'Ocultar más colores' : 'Más colores (ver los 110 tonos)'}</span>
          {showAllColors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAllColors && (
          <div
            data-testid={`${idPrefix}-all-colors-panel`}
            className="mt-2 p-3 rounded-2xl bg-white border border-slate-200 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <span className="font-semibold">Carta completa de colores (110 tonos)</span>
              <span className="font-bold text-petrol-dark">
                Elegido: {selectedTy.code} {selectedTy.name}
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o código (ej. E33, Rosso, Navy)..."
                aria-label="Buscar en los 110 colores"
                data-testid={`${idPrefix}-search-input`}
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-turquoise focus:outline-none"
              />
            </div>

            <div className="max-h-52 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {filteredAll.map((c) => {
                const isSelected = selectedTy.code === c.code;
                const luma = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
                return (
                  <button
                    key={`${idPrefix}-all-${c.code}`}
                    type="button"
                    data-testid={`${idPrefix}-code-${c.code}`}
                    onClick={() => onChange(c.hex)}
                    className={`min-h-[44px] flex items-center gap-2 px-2 py-1.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'ring-2 ring-turquoise border-petrol bg-ice'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-md border border-black/15 flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && (
                        <Check className={`w-3 h-3 ${luma > 165 ? 'text-slate-900' : 'text-white'}`} />
                      )}
                    </span>
                    <span className="text-[11px] leading-tight">
                      <strong className="text-petrol-dark">{c.code}</strong>{' '}
                      <span className="text-slate-600">{c.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ConfiguratorSection: React.FC<ConfiguratorSectionProps> = ({ onSelectConfigForQuote }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const stepPanelRef = useRef<HTMLDivElement>(null);
  const captureSnapshotRef = useRef<(() => string | null) | null>(null);

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [snapshotUrl, setSnapshotUrl] = useState<string>('');
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [editingLogoPartCode, setEditingLogoPartCode] = useState<string | null>(null);
  const [showPatternOptions, setShowPatternOptions] = useState(false);
  const [showFactoryOptions, setShowFactoryOptions] = useState(false);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDownloadingBmp, setIsDownloadingBmp] = useState(false);
  const [bmpNotice, setBmpNotice] = useState<string | null>(null);
  const [knitGrid, setKnitGrid] = useState<KnitPixelGrid | null>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [activePresetId, setActivePresetId] = useState<DesignPresetId | null>('liso');

  // Estado del formulario corto del Paso 4
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formComments, setFormComments] = useState('');
  const [formPrivacy, setFormPrivacy] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleGridReady = useCallback((grid: KnitPixelGrid) => {
    setKnitGrid(grid);
  }, []);

  const handleSnapshotReady = useCallback((data: string) => {
    setSnapshotUrl(data);
  }, []);

  // Estado inicial del calcetín
  const [config, setConfig] = useState<ExtendedSockConfig>({
    cuffColor: '#FFFFFF',
    legColor: '#FFFFFF',
    footColor: '#FFFFFF',
    heelToeColor: DEFAULT_HEEL_TOE_COLOR,
    needleCount: 168,
    maxColors: 6,
    cleanEdges: true,
    logoColorOverrides: {},
    customCuff: false,
    customFoot: false,
    pattern: {
      type: 'none',
      color: '#1F4D63',
      stripesZone: 'cuff',
      stripesThickness: 'medium',
      stripesCount: 3,
      dotsSize: 'medium',
      dotsDensity: 'medium'
    },
    logo: {
      url: null,
      scale: 1.15,
      yPos: 0.45,
      rotation: 0,
      repeatBack: false
    },
    logoBg: {
      type: 'none',
      color: '#FFFFFF'
    },
    logoPosition: 'front',
    knittedText: {
      text: '',
      color: '#1E232A'
    },
    material: 'cotton',
    quantity: 50
  });

  // Visibilidad de la sección para la barra fija inferior en móvil
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Cálculo de precios (sin cambios en pricing.ts)
  const pricing = calculatePricing(config);

  const goToStep = (step: WizardStep) => {
    if (step === 4) {
      const liveSnap = captureSnapshotRef.current?.();
      if (liveSnap) setSnapshotUrl(liveSnap);
    }
    setCurrentStep(step);
    setFormSubmitted(false);
    // En móvil, acercamos suavemente al panel de pasos sin sacar el calcetín de contexto
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && stepPanelRef.current) {
      stepPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Estilos rápidos de partida
  const applyDesignPreset = (presetId: DesignPresetId) => {
    setActivePresetId(presetId);
    setEditingLogoPartCode(null);
    setConfig((prev) => {
      if (presetId === 'liso') {
        setLogoFileName('');
        return {
          ...prev,
          cuffColor: '#FFFFFF',
          legColor: '#FFFFFF',
          footColor: '#FFFFFF',
          customCuff: false,
          customFoot: false,
          logoColorOverrides: {},
          pattern: { ...prev.pattern!, type: 'none' },
          logo: { ...prev.logo, allOver: false, url: null, repeatBack: false },
          logoBg: { type: 'none', color: '#FFFFFF' },
          logoPosition: 'front',
          knittedText: { text: '', color: '#1E232A' }
        };
      }
      if (presetId === 'clasico') {
        setLogoFileName('');
        return {
          ...prev,
          cuffColor: '#1F4D63',
          legColor: '#FFFFFF',
          footColor: '#FFFFFF',
          customCuff: true,
          customFoot: false,
          logoColorOverrides: {},
          pattern: { ...prev.pattern!, type: 'none' },
          logo: { ...prev.logo, allOver: false, url: null, repeatBack: false },
          logoBg: { type: 'none', color: '#FFFFFF' },
          logoPosition: 'front',
          knittedText: { text: '', color: '#1E232A' }
        };
      }
      if (presetId === 'deportivo') {
        setLogoFileName('Logo de ejemplo (Churrería Pepe)');
        setShowPatternOptions(true);
        return {
          ...prev,
          cuffColor: '#FFFFFF',
          legColor: '#FFFFFF',
          footColor: '#FFFFFF',
          customCuff: false,
          customFoot: false,
          logoColorOverrides: {},
          pattern: {
            ...prev.pattern!,
            type: 'stripes',
            stripesZone: 'cuff',
            stripesThickness: 'medium',
            stripesCount: 3,
            color: '#1F4D63'
          },
          logo: {
            ...prev.logo,
            allOver: false,
            url: SAMPLE_CHURRERIA_LOGO,
            scale: 1.15,
            yPos: 0.45,
            rotation: 0,
            repeatBack: false
          },
          logoBg: { type: 'none', color: '#FFFFFF' },
          logoPosition: 'front',
          knittedText: { text: '', color: '#1E232A' }
        };
      }
      setLogoFileName('Logo de ejemplo (Churrería Pepe)');
      return {
        ...prev,
        cuffColor: '#1E232A',
        legColor: '#1E232A',
        footColor: '#1E232A',
        customCuff: false,
        customFoot: false,
        logoColorOverrides: {},
        pattern: { ...prev.pattern!, type: 'none' },
        logo: {
          ...prev.logo,
          allOver: false,
          url: SAMPLE_CHURRERIA_LOGO,
          scale: 1.15,
          yPos: 0.45,
          rotation: 0,
          repeatBack: false
        },
        logoBg: { type: 'roundedRect', color: '#FFFFFF' },
        logoPosition: 'front',
        knittedText: { text: '', color: '#FFFFFF' }
      };
    });
  };

  const handleBaseColorChange = (hex: string) => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      legColor: hex,
      cuffColor: prev.customCuff ? prev.cuffColor : hex,
      footColor: prev.customFoot ? prev.footColor : hex
    }));
  };

  const handleToggleCustomCuff = (enabled: boolean) => {
    setActivePresetId(null);
    setConfig((prev) => {
      const defaultOther = prev.legColor.toLowerCase() === '#1f4d63' ? '#2A9DB8' : '#1F4D63';
      return {
        ...prev,
        customCuff: enabled,
        cuffColor: enabled ? defaultOther : prev.legColor
      };
    });
  };

  const handleToggleCustomFoot = (enabled: boolean) => {
    setActivePresetId(null);
    setConfig((prev) => {
      const defaultOther = prev.legColor.toLowerCase() === '#1b7a93' ? '#1F4D63' : '#1B7A93';
      return {
        ...prev,
        customFoot: enabled,
        footColor: enabled ? defaultOther : prev.legColor
      };
    });
  };

  const updatePattern = (patch: Partial<NonNullable<ExtendedSockConfig['pattern']>>) => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      pattern: { ...prev.pattern!, ...patch }
    }));
  };

  // Subida de logo 100% en el navegador (con validación estricta y saneado SVG)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    const lowerName = file.name.toLowerCase();
    const isSvg = file.type === 'image/svg+xml' || lowerName.endsWith('.svg');

    if (!allowedTypes.includes(file.type) && !isSvg) {
      alert('Por favor elige una imagen en formato PNG, JPG o SVG.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen no puede superar los 8 MB.');
      return;
    }

    setLogoFileName(file.name);
    setEditingLogoPartCode(null);

    if (isSvg) {
      const textReader = new FileReader();
      textReader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          const cleanSvg = sanitizeSvgMarkup(event.target.result);
          const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
          setActivePresetId(null);
          setConfig((prev) => ({
            ...prev,
            logoColorOverrides: {},
            logo: { ...prev.logo, allOver: false, url: svgDataUrl }
          }));
        }
      };
      textReader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (typeof event.target?.result === 'string') {
        const rawDataUrl = event.target.result;
        const reduced = await downscaleImageDataUrl(rawDataUrl, 800, 800);
        const finalUrl = reduced ? reduced.dataUrl : rawDataUrl;

        setActivePresetId(null);
        setConfig((prev) => ({
          ...prev,
          logoColorOverrides: {},
          logo: { ...prev.logo, allOver: false, url: finalUrl }
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const setSampleLogo = () => {
    setActivePresetId(null);
    setEditingLogoPartCode(null);
    setLogoFileName('Logo de ejemplo (Churrería Pepe)');
    setConfig((prev) => ({
      ...prev,
      logoColorOverrides: {},
      logo: { ...prev.logo, allOver: false, url: SAMPLE_CHURRERIA_LOGO }
    }));
  };

  const setNavidadLogo = () => {
    setActivePresetId(null);
    setEditingLogoPartCode(null);
    setLogoFileName('Diseño Navidad');
    setConfig((prev) => ({
      ...prev,
      logoColorOverrides: {},
      logo: { ...prev.logo, allOver: true, url: '/images/diseno-navidad.jpg' }
    }));
  };

  const removeLogo = () => {
    setActivePresetId(null);
    setEditingLogoPartCode(null);
    setLogoFileName('');
    setConfig((prev) => ({
      ...prev,
      logoColorOverrides: {},
      logo: { ...prev.logo, allOver: false, url: null }
    }));
  };

  const handleLogoPartColorChange = (sourceCode: string, newHex: string) => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      logoColorOverrides: {
        ...(prev.logoColorOverrides || {}),
        [sourceCode]: newHex
      }
    }));
  };

  const handleLogoPositionChange = (pos: LogoPosition) => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      logoPosition: pos,
      logo: { ...prev.logo, repeatBack: pos === 'both' }
    }));
  };

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const liveSnap = captureSnapshotRef.current?.() || snapshotUrl;
      if (liveSnap) setSnapshotUrl(liveSnap);
      await generateAndDownloadQuotePdf({
        config,
        pricing,
        snapshotDataUrl: liveSnap,
        machineInks: knitGrid?.palette
      });
    } catch (err) {
      console.error('Error al generar el presupuesto en PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadMachineDesign = async () => {
    if (isDownloadingBmp || !knitGrid) return;
    setIsDownloadingBmp(true);
    setBmpNotice(null);
    try {
      const liveSnap = captureSnapshotRef.current?.() || snapshotUrl;
      if (liveSnap) setSnapshotUrl(liveSnap);
      const { bmpFilename, colorCodes, heelToeLabel } = await downloadMachineDesignFiles(
        knitGrid,
        config.heelToeColor,
        liveSnap
      );
      setBmpNotice(
        `Descargado ${bmpFilename} (8 bits, ${knitGrid.width}×${knitGrid.height} px) y vista previa PNG · Tintas TecnoYarn: ${colorCodes.join(', ')} · Talón/puntera: ${heelToeLabel}.`
      );
    } catch (err) {
      console.error('Error al generar el diseño BMP:', err);
      setBmpNotice('No se pudo generar el archivo. Inténtalo de nuevo.');
    } finally {
      setIsDownloadingBmp(false);
    }
  };

  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const cleanName = sanitizeText(formName);
    const cleanEmail = formEmail.trim();
    if (cleanName.length < 2) {
      errs.name = 'Escribe tu nombre para poder dirigirnos a ti.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errs.email = 'Introduce un correo electrónico válido.';
    }
    if (!formPrivacy) {
      errs.privacy = 'Marca la casilla para poder enviarte el presupuesto.';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setFormErrors({});
    const liveSnap = captureSnapshotRef.current?.() || snapshotUrl;
    if (liveSnap) setSnapshotUrl(liveSnap);
    onSelectConfigForQuote(config, liveSnap);
    setFormSubmitted(true);
  };

  const pat = config.pattern!;
  const logoBg = config.logoBg!;
  const logoPos = config.logoPosition || 'front';
  const knittedText = config.knittedText!;
  const activeNeedles: NeedleCount = config.needleCount === 200 ? 200 : 168;
  const maxColorsSetting = Math.max(2, Math.min(MAX_MACHINE_INKS, config.maxColors ?? 6));
  const cleanEdgesEnabled = config.cleanEdges ?? true;
  const activeInksCount = knitGrid ? knitGrid.totalInks : 1;
  const logoParts = knitGrid?.logoParts || [];
  const selectedMaterial = MATERIALS.find((m) => m.id === config.material) || MATERIALS[0];
  const currentStepMeta = STEPS[currentStep - 1];

  return (
    <section
      id="configurador"
      ref={sectionRef}
      className="py-14 sm:py-20 bg-white relative scroll-mt-20 pb-28 lg:pb-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Encabezado de sección */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ice text-turquoise text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Diseñador en vivo
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-petrol-dark tracking-tight">
            Diseña tu calcetín y ve el precio al momento
          </h2>
        </div>

        {/* BARRA DE PROGRESO SUPERIOR (Paso X de 4) */}
        <div className="max-w-4xl mx-auto mb-8 space-y-3" data-testid="wizard-progress-bar">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-extrabold text-petrol-dark" data-testid="wizard-step-indicator">
              Paso {currentStep} de 4 · {currentStepMeta.title}
            </span>
            <span className="text-slate-500 font-semibold hidden sm:inline">
              {Math.round((currentStep / 4) * 100)}% completado
            </span>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-petrol to-turquoise rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
            {STEPS.map((st) => {
              const isActive = currentStep === st.id;
              const isDone = currentStep > st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  data-testid={`wizard-tab-${st.id}`}
                  onClick={() => goToStep(st.id)}
                  className={`min-h-[44px] px-2 py-2 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'bg-petrol text-white border-petrol shadow-xs'
                      : isDone
                      ? 'bg-ice text-petrol border-turquoise/40 hover:border-turquoise'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 ${
                      isActive
                        ? 'bg-yarn-mustard text-petrol-dark'
                        : isDone
                        ? 'bg-turquoise text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : st.id}
                  </span>
                  <span className="truncate">{st.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rejilla principal: Visor 3D arriba en móvil / izquierda sticky en escritorio */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">

          {/* Columna del Visor 3D */}
          <div className="lg:col-span-6 xl:col-span-7 min-w-0 lg:sticky lg:top-24 space-y-3.5">
            <SockViewer3D
              config={config}
              onSnapshotReady={handleSnapshotReady}
              captureSnapshotRef={captureSnapshotRef}
              onUseSampleLogo={setSampleLogo}
              onGridReady={handleGridReady}
            />

            {/* Aviso amarillo claro si alguna parte del dibujo es demasiado pequeña */}
            {config.logo.url && knitGrid?.smallDetailWarning?.hasWarning && (
              <div
                data-testid="small-detail-warning-viewer"
                role="alert"
                className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-2.5 text-xs shadow-xs"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold leading-snug">
                    Esta parte del dibujo es muy pequeña y puede no salir bien. Hazla más grande o más sencilla.
                  </p>
                  {knitGrid.smallDetailWarning.affectedZones.length > 0 && (
                    <p className="text-[11px] text-amber-900">
                      <strong>Zonas afectadas:</strong>{' '}
                      {knitGrid.smallDetailWarning.affectedZones.join(' · ')}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Resumen limpio de precio y selección */}
            <div className="p-4 bg-ice rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yarn-green" />
                <span className="font-semibold text-petrol">{selectedMaterial.name}</span>
                <span className="text-slate-400">·</span>
                <span>{config.quantity} pares</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-petrol-dark" data-testid="price-per-pair">
                <span>{pricing.pricePerPair.toFixed(2).replace('.', ',')} € / par</span>
                <span className="text-slate-400 font-normal">·</span>
                <span className="text-turquoise">
                  Total {pricing.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € + IVA
                </span>
              </div>
            </div>
          </div>

          {/* Columna del Paso Activo */}
          <div ref={stepPanelRef} className="lg:col-span-6 xl:col-span-5 min-w-0 space-y-5">

            {/* =============================================================== */}
            {/* PASO 1: ELIGE EL COLOR DE TU CALCETÍN                           */}
            {/* =============================================================== */}
            {currentStep === 1 && (
              <div data-testid="wizard-step-1" className="space-y-5">
                {/* Ideas rápidas de partida */}
                <div className="bg-ice/90 p-4 rounded-3xl border border-slate-200/90 space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-petrol-dark block">
                    ¿Por dónde empezamos?
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'liso' as const, title: 'Liso', desc: 'Un color' },
                      { id: 'clasico' as const, title: 'Clásico', desc: 'Puño distinto' },
                      { id: 'deportivo' as const, title: 'Deportivo', desc: 'Rayas + logo' },
                      { id: 'corporativo' as const, title: 'Oscuro', desc: 'Negro + logo' }
                    ].map((p) => {
                      const active = activePresetId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          data-testid={`preset-${p.id}`}
                          onClick={() => applyDesignPreset(p.id)}
                          className={`min-h-[48px] text-left p-2.5 rounded-2xl border transition-all ${
                            active
                              ? 'bg-petrol text-white border-petrol shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-turquoise'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{p.title}</div>
                          <div className={`text-[11px] ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                            {p.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Colores principales */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
                  <h3 className="font-extrabold text-petrol-dark text-lg">
                    1. Elige el color de tu calcetín
                  </h3>

                  <CottonSwatchPicker
                    label="Color principal del calcetín"
                    value={config.legColor}
                    onChange={handleBaseColorChange}
                    idPrefix="base"
                  />

                  {/* Puño y pie opcionales */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <label className="flex items-center justify-between cursor-pointer min-h-[32px]">
                        <span className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300"
                            style={{ backgroundColor: config.cuffColor }}
                          />
                          Puño de otro color
                        </span>
                        <input
                          type="checkbox"
                          data-testid="toggle-custom-cuff"
                          checked={Boolean(config.customCuff)}
                          onChange={(e) => handleToggleCustomCuff(e.target.checked)}
                          className="w-5 h-5 rounded accent-turquoise cursor-pointer"
                        />
                      </label>
                      {config.customCuff && (
                        <div className="pt-2 border-t border-slate-200/70">
                          <CottonSwatchPicker
                            label="Color del puño"
                            value={config.cuffColor}
                            onChange={(hex) => {
                              setActivePresetId(null);
                              setConfig((prev) => ({ ...prev, cuffColor: hex }));
                            }}
                            idPrefix="cuff"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <label className="flex items-center justify-between cursor-pointer min-h-[32px]">
                        <span className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300"
                            style={{ backgroundColor: config.footColor }}
                          />
                          Pie de otro color
                        </span>
                        <input
                          type="checkbox"
                          data-testid="toggle-custom-foot"
                          checked={Boolean(config.customFoot)}
                          onChange={(e) => handleToggleCustomFoot(e.target.checked)}
                          className="w-5 h-5 rounded accent-turquoise cursor-pointer"
                        />
                      </label>
                      {config.customFoot && (
                        <div className="pt-2 border-t border-slate-200/70">
                          <CottonSwatchPicker
                            label="Color del pie"
                            value={config.footColor}
                            onChange={(hex) => {
                              setActivePresetId(null);
                              setConfig((prev) => ({ ...prev, footColor: hex }));
                            }}
                            idPrefix="foot"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Talón y puntera: forma fija, 16 colores sencillos + Más colores */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-start gap-2.5 text-xs text-slate-600">
                      <Lock className="w-4 h-4 text-petrol flex-shrink-0 mt-0.5" />
                      <p>
                        El talón y la puntera tienen forma fija; solo puedes elegir su color.
                      </p>
                    </div>
                    <SimpleYarnPicker
                      label="Color de talón y puntera"
                      value={config.heelToeColor}
                      onChange={(hex) => {
                        setActivePresetId(null);
                        setConfig((prev) => ({ ...prev, heelToeColor: hex }));
                      }}
                      idPrefix="heeltoe"
                    />
                  </div>

                  {/* Motivo tejido opcional (plegable dentro del Paso 1) */}
                  <div className="rounded-2xl border border-slate-200/90 overflow-hidden">
                    <button
                      type="button"
                      data-testid="toggle-pattern-section"
                      onClick={() => setShowPatternOptions((v) => !v)}
                      className="w-full min-h-[48px] px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-petrol-dark transition-colors"
                    >
                      <span>
                        Añadir rayas, lunares o cuadros (opcional)
                        {pat.type !== 'none' ? ' · Activo' : ''}
                      </span>
                      {showPatternOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showPatternOptions && (
                      <div className="p-4 bg-white space-y-4 text-xs border-t border-slate-200/80">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { id: 'none' as PatternType, label: 'Ninguno' },
                            { id: 'stripes' as PatternType, label: 'Rayas' },
                            { id: 'dots' as PatternType, label: 'Lunares' },
                            { id: 'checks' as PatternType, label: 'Cuadros' }
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              data-testid={`pattern-type-${item.id}`}
                              onClick={() => updatePattern({ type: item.id })}
                              className={`min-h-[44px] px-3 rounded-xl font-bold border transition-all ${
                                pat.type === item.id
                                  ? 'bg-petrol text-white border-petrol'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        {pat.type === 'stripes' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'cuff' as StripesZone, label: 'Solo puño' },
                                { id: 'leg' as StripesZone, label: 'Solo caña' },
                                { id: 'all' as StripesZone, label: 'Todo' }
                              ].map((z) => (
                                <button
                                  key={z.id}
                                  type="button"
                                  onClick={() => updatePattern({ stripesZone: z.id })}
                                  className={`min-h-[44px] px-2 rounded-xl font-bold border ${
                                    pat.stripesZone === z.id
                                      ? 'bg-turquoise text-white border-turquoise'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {z.label}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'thin' as StripesThickness, label: 'Finas' },
                                { id: 'medium' as StripesThickness, label: 'Medias' },
                                { id: 'thick' as StripesThickness, label: 'Anchas' }
                              ].map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => updatePattern({ stripesThickness: t.id })}
                                  className={`min-h-[44px] px-2 rounded-xl font-bold border ${
                                    pat.stripesThickness === t.id
                                      ? 'bg-turquoise text-white border-turquoise'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[2, 3, 4, 5, 6].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => updatePattern({ stripesCount: n })}
                                  className={`min-h-[44px] rounded-xl font-bold border ${
                                    pat.stripesCount === n
                                      ? 'bg-petrol text-white border-petrol'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {pat.type === 'dots' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'small' as DotsSize, label: 'Pequeños' },
                                { id: 'medium' as DotsSize, label: 'Medios' },
                                { id: 'large' as DotsSize, label: 'Grandes' }
                              ].map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => updatePattern({ dotsSize: s.id })}
                                  className={`min-h-[44px] rounded-xl font-bold border ${
                                    pat.dotsSize === s.id
                                      ? 'bg-turquoise text-white border-turquoise'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'few' as DotsDensity, label: 'Pocos' },
                                { id: 'medium' as DotsDensity, label: 'Medios' },
                                { id: 'many' as DotsDensity, label: 'Muchos' }
                              ].map((d) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => updatePattern({ dotsDensity: d.id })}
                                  className={`min-h-[44px] rounded-xl font-bold border ${
                                    pat.dotsDensity === d.id
                                      ? 'bg-turquoise text-white border-turquoise'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {pat.type !== 'none' && (
                          <SimpleYarnPicker
                            label="Color del motivo"
                            value={pat.color}
                            onChange={(hex) => updatePattern({ color: hex })}
                            idPrefix="pattern"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* PASO 2: PON TU LOGO O TU NOMBRE                                 */}
            {/* =============================================================== */}
            {currentStep === 2 && (
              <div data-testid="wizard-step-2" className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
                <h3 className="font-extrabold text-petrol-dark text-lg">
                  2. Pon tu logo o tu nombre
                </h3>

                {/* Botones de subida (táctiles >= 44px) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-turquoise bg-turquoise/5 hover:bg-turquoise/10 text-turquoise text-sm font-bold cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>{config.logo.url ? 'Cambiar imagen' : 'Subir tu logo'}</span>
                    <input
                      type="file"
                      data-testid="input-logo-upload"
                      accept=".png,.jpg,.jpeg,.svg,.webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    data-testid="btn-sample-logo"
                    onClick={setSampleLogo}
                    className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-colors border ${
                      config.logo.url === SAMPLE_CHURRERIA_LOGO
                        ? 'bg-petrol text-white border-petrol'
                        : 'bg-ice hover:bg-slate-200/70 text-petrol border-slate-200'
                    }`}
                  >
                    <Tag className="w-4 h-4 text-yarn-coral" />
                    <span>Probar con un ejemplo</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="btn-navidad-logo"
                    onClick={setNavidadLogo}
                    className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border ${
                      config.logo.url === '/images/diseno-navidad.jpg'
                        ? 'bg-petrol text-white border-petrol'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 text-yarn-coral" />
                    <span>Diseño Navidad</span>
                  </button>

                  {config.logo.url && (
                    <button
                      type="button"
                      data-testid="btn-remove-logo"
                      onClick={removeLogo}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Quitar logo</span>
                    </button>
                  )}
                </div>

                {/* Aviso amarillo claro si hay partes demasiado pequeñas */}
                {config.logo.url && knitGrid?.smallDetailWarning?.hasWarning && (
                  <div
                    data-testid="small-detail-warning"
                    role="alert"
                    className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-2.5 text-xs"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold leading-snug">
                        Esta parte del dibujo es muy pequeña y puede no salir bien. Hazla más grande o más sencilla.
                      </p>
                      {knitGrid.smallDetailWarning.affectedZones.length > 0 && (
                        <p className="text-[11px] text-amber-900">
                          <strong>Zonas afectadas:</strong>{' '}
                          {knitGrid.smallDetailWarning.affectedZones.join(' · ')}.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Aviso amable si el logo superaba los 6 colores */}
                {config.logo.url && knitGrid?.colorsReducedByLimit && (
                  <div
                    data-testid="color-limit-notice"
                    className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-snug"
                  >
                    Tu dibujo tenía muchos colores; lo hemos adaptado automáticamente al máximo de 6 colores para que quede limpio al tejer.
                  </div>
                )}

                {/* Cambiar el color de cada parte del logo */}
                {config.logo.url && !config.logo.allOver && logoParts.length > 0 && (
                  <div
                    data-testid="logo-color-editor"
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">Colores de tu logo</span>
                      <span className="text-[11px] text-slate-500">Toca uno para cambiarlo</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {logoParts.map((part, idx) => {
                        const isEditing = editingLogoPartCode === part.sourceCode;
                        return (
                          <button
                            key={part.sourceCode}
                            type="button"
                            data-testid={`logo-part-btn-${idx}`}
                            onClick={() =>
                              setEditingLogoPartCode(isEditing ? null : part.sourceCode)
                            }
                            className={`min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                              isEditing
                                ? 'bg-petrol text-white border-petrol shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-turquoise'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-black/20 flex-shrink-0"
                              style={{ backgroundColor: part.hex }}
                            />
                            <span>
                              Color {idx + 1}: {getFriendlyColorName(part.hex)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {editingLogoPartCode && (() => {
                      const activePart = logoParts.find((p) => p.sourceCode === editingLogoPartCode);
                      if (!activePart) return null;
                      return (
                        <div className="pt-2 border-t border-slate-200">
                          <SimpleYarnPicker
                            label="Elige el nuevo color para esta parte del logo"
                            value={activePart.hex}
                            onChange={(hex) => handleLogoPartColorChange(activePart.sourceCode, hex)}
                            idPrefix="logopart"
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Ajustes sencillos del logo (posición, tamaño, altura y fondo) */}
                {config.logo.url && !config.logo.allOver && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <span className="font-semibold text-slate-700 block">¿Dónde quieres el logo?</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'front' as LogoPosition, label: 'Delante' },
                          { id: 'back' as LogoPosition, label: 'Detrás' },
                          { id: 'both' as LogoPosition, label: 'Ambos (+0,20 €)' }
                        ].map((pos) => (
                          <button
                            key={pos.id}
                            type="button"
                            data-testid={`logo-pos-${pos.id}`}
                            onClick={() => handleLogoPositionChange(pos.id)}
                            className={`min-h-[44px] px-2 rounded-xl font-bold border transition-all ${
                              logoPos === pos.id
                                ? 'bg-petrol text-white border-petrol'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Tamaño del logo</span>
                          <span className="text-petrol">{Math.round(config.logo.scale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.6"
                          max="1.45"
                          step="0.05"
                          value={config.logo.scale}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              logo: { ...prev.logo, scale: parseFloat(e.target.value) }
                            }))
                          }
                          className="w-full accent-turquoise h-2 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Altura en el calcetín</span>
                          <span className="text-petrol">
                            {config.logo.yPos < 0.3 ? 'Más arriba' : config.logo.yPos > 0.6 ? 'Más abajo' : 'Centrado'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.15"
                          max="0.75"
                          step="0.05"
                          value={config.logo.yPos}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              logo: { ...prev.logo, yPos: parseFloat(e.target.value) }
                            }))
                          }
                          className="w-full accent-turquoise h-2 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-semibold text-slate-700 block">Fondo detrás del logo (opcional)</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'none' as LogoBgType, label: 'Sin fondo' },
                          { id: 'circle' as LogoBgType, label: 'Círculo' },
                          { id: 'roundedRect' as LogoBgType, label: 'Recuadro' }
                        ].map((bg) => (
                          <button
                            key={bg.id}
                            type="button"
                            onClick={() => {
                              setActivePresetId(null);
                              setConfig((prev) => ({
                                ...prev,
                                logoBg: { ...prev.logoBg!, type: bg.id }
                              }));
                            }}
                            className={`min-h-[44px] px-2 rounded-xl font-bold border transition-all ${
                              logoBg.type === bg.id
                                ? 'bg-turquoise text-white border-turquoise'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {bg.label}
                          </button>
                        ))}
                      </div>
                      {logoBg.type !== 'none' && (
                        <div className="pt-2">
                          <SimpleYarnPicker
                            label="Color del fondo"
                            value={logoBg.color}
                            onChange={(hex) => {
                              setActivePresetId(null);
                              setConfig((prev) => ({
                                ...prev,
                                logoBg: { ...prev.logoBg!, color: hex }
                              }));
                            }}
                            idPrefix="logobg"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Texto corto opcional */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <label htmlFor="knitted-text-input" className="font-bold text-slate-800">
                      Añade tu nombre o una frase corta (opcional)
                    </label>
                    <span className="text-[11px] text-slate-500">{knittedText.text.length}/14</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="knitted-text-input"
                      data-testid="knitted-text-input"
                      type="text"
                      maxLength={14}
                      placeholder="Ej: RUN CLUB o tu nombre"
                      value={knittedText.text}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 14);
                        setActivePresetId(null);
                        setConfig((prev) => ({
                          ...prev,
                          knittedText: { ...prev.knittedText!, text: val }
                        }));
                      }}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold uppercase tracking-wider text-xs focus:ring-2 focus:ring-turquoise focus:outline-none"
                    />
                    {knittedText.text && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            knittedText: { ...prev.knittedText!, text: '' }
                          }))
                        }
                        className="min-h-[44px] px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
                      >
                        Borrar
                      </button>
                    )}
                  </div>

                  {knittedText.text.trim().length > 0 && (
                    <SimpleYarnPicker
                      label="Color de las letras"
                      value={knittedText.color}
                      onChange={(hex) => {
                        setActivePresetId(null);
                        setConfig((prev) => ({
                          ...prev,
                          knittedText: { ...prev.knittedText!, color: hex }
                        }));
                      }}
                      idPrefix="text"
                    />
                  )}
                </div>

                {/* APARTADO CERRADO POR DEFECTO: OPCIONES PARA LA FÁBRICA */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    data-testid="factory-options-toggle"
                    onClick={() => setShowFactoryOptions((v) => !v)}
                    className="w-full min-h-[48px] px-4 py-3 bg-slate-100 hover:bg-slate-200/70 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-petrol" />
                      <span>Opciones para la fábrica</span>
                    </span>
                    {showFactoryOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showFactoryOptions && (
                    <div
                      data-testid="factory-options-panel"
                      className="p-4 bg-[#0A1A23] text-white space-y-4 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-100">
                          Cuadrícula real · {activeNeedles} agujas
                        </span>
                        <span
                          data-testid="machine-inks-badge"
                          className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 font-bold"
                        >
                          <span className="text-yarn-mustard">{activeInksCount}</span> / {MAX_MACHINE_INKS} tintas
                        </span>
                      </div>

                      {/* Selector 168 / 200 agujas */}
                      <div className="space-y-1.5">
                        <span className="text-slate-300 font-semibold block">
                          Ancho en agujas (1 píxel = 1 aguja):
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {([168, 200] as NeedleCount[]).map((needles) => (
                            <button
                              key={needles}
                              type="button"
                              data-testid={`needles-${needles}`}
                              onClick={() => setConfig((prev) => ({ ...prev, needleCount: needles }))}
                              className={`min-h-[44px] px-3 rounded-xl font-bold border transition-all ${
                                activeNeedles === needles
                                  ? 'bg-yarn-mustard text-petrol-dark border-yarn-mustard'
                                  : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
                              }`}
                            >
                              {needles} agujas {needles === 168 ? '(estándar)' : '(provisional)'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Máximo de tintas 2..6 */}
                      <div className="space-y-1.5">
                        <span className="text-slate-300 font-semibold block">
                          Máximo de tintas (2 a 6):
                        </span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[2, 3, 4, 5, 6].map((n) => (
                            <button
                              key={n}
                              type="button"
                              data-testid={`max-colors-${n}`}
                              onClick={() => setConfig((prev) => ({ ...prev, maxColors: n }))}
                              className={`min-h-[44px] rounded-xl font-bold border transition-all ${
                                maxColorsSetting === n
                                  ? 'bg-turquoise text-white border-turquoise'
                                  : 'bg-white/10 text-white border-white/15'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Limpiar bordes */}
                      <button
                        type="button"
                        data-testid="btn-clean-edges"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            cleanEdges: !(prev.cleanEdges ?? true)
                          }))
                        }
                        className={`min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold border transition-all ${
                          cleanEdgesEnabled
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-white/10 text-white border-white/20'
                        }`}
                      >
                        <Wand2 className="w-4 h-4" />
                        <span>{cleanEdgesEnabled ? 'Limpiar bordes: Activado' : 'Limpiar bordes'}</span>
                      </button>

                      {/* Códigos TecnoYarn activos */}
                      {knitGrid && knitGrid.palette.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-slate-300 font-semibold block">
                            Códigos TecnoYarn ({knitGrid.width} × {knitGrid.height} px):
                          </span>
                          <div className="flex flex-wrap gap-1.5" data-testid="machine-inks-swatches">
                            {knitGrid.palette.map((entry) => (
                              <span
                                key={`ink-${entry.index}-${entry.code}`}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-[11px]"
                              >
                                <span
                                  className="w-3 h-3 rounded-sm border border-white/30"
                                  style={{ backgroundColor: entry.hex }}
                                />
                                <strong>{entry.code}</strong>
                                <span className="text-slate-300">{entry.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Descarga BMP 8 bits + vista previa */}
                      <button
                        type="button"
                        data-testid="btn-download-bmp"
                        onClick={handleDownloadMachineDesign}
                        disabled={isDownloadingBmp || !knitGrid}
                        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-yarn-mustard hover:bg-white text-petrol-dark font-extrabold text-xs sm:text-sm transition-colors disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {isDownloadingBmp
                            ? 'Generando BMP 8 bits...'
                            : 'Descargar diseño para la máquina (BMP 8 bits)'}
                        </span>
                      </button>

                      {bmpNotice && (
                        <p className="text-[11px] text-emerald-300 font-medium" data-testid="bmp-download-notice">
                          {bmpNotice}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-yarn-mustard flex-shrink-0" />
                        <span>La fábrica revisa el diseño antes de tejerlo.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* PASO 3: ¿CUÁNTOS PARES Y DE QUÉ MATERIAL?                       */}
            {/* =============================================================== */}
            {currentStep === 3 && (
              <div data-testid="wizard-step-3" className="space-y-5">
                <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
                  <h3 className="font-extrabold text-petrol-dark text-lg">
                    3. ¿Cuántos pares y de qué material?
                  </h3>

                  {/* Materiales */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {MATERIALS.map((mat) => {
                      const isSelected = config.material === mat.id;
                      return (
                        <button
                          key={mat.id}
                          type="button"
                          data-testid={`material-${mat.id}`}
                          onClick={() => setConfig((prev) => ({ ...prev, material: mat.id }))}
                          className={`min-h-[76px] text-left p-3.5 rounded-2xl border transition-all ${
                            isSelected
                              ? 'border-turquoise bg-turquoise/5 ring-2 ring-turquoise shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-petrol-dark">{mat.name}</span>
                            {mat.extraPerPair > 0 ? (
                              <span className="text-xs font-bold text-turquoise">
                                +{mat.extraPerPair.toFixed(2).replace('.', ',')} €
                              </span>
                            ) : (
                              <span className="text-[11px] uppercase font-bold text-slate-400">Base</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 leading-snug">{mat.description}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cantidad */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Cantidad de pares (mínimo 10)</span>
                      <span className="text-turquoise">Cuantos más pares, mejor precio</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {[10, 25, 50, 100, 250, 500].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          data-testid={`qty-${qty}`}
                          onClick={() => setConfig((prev) => ({ ...prev, quantity: qty }))}
                          className={`min-h-[44px] text-sm font-bold rounded-xl border transition-all ${
                            config.quantity === qty
                              ? 'bg-petrol text-white border-petrol shadow-xs'
                              : 'bg-ice text-slate-700 border-slate-200 hover:bg-slate-200/70'
                          }`}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <label htmlFor="custom-qty" className="text-xs font-semibold text-slate-600">
                        Otra cantidad:
                      </label>
                      <input
                        id="custom-qty"
                        type="number"
                        min="10"
                        step="1"
                        value={config.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 10;
                          setConfig((prev) => ({ ...prev, quantity: Math.max(10, val) }));
                        }}
                        className="w-28 min-h-[44px] px-3 py-2 text-sm font-bold text-petrol border border-slate-300 rounded-xl focus:ring-2 focus:ring-turquoise"
                      />
                      <span className="text-xs text-slate-500">pares</span>
                    </div>
                  </div>
                </div>

                {/* Desglose de precio en vivo */}
                <div className="bg-gradient-to-br from-petrol-dark to-petrol text-white p-5 rounded-3xl shadow-float space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-semibold text-turquoise-light">
                        Precio orientativo
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-3xl font-extrabold">
                          {pricing.pricePerPair.toFixed(2).replace('.', ',')} €
                        </span>
                        <span className="text-sm text-slate-300">/ par</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-300">Total ({pricing.quantity} pares)</span>
                      <p className="text-xl font-bold text-yarn-mustard">
                        {pricing.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </p>
                      <p className="text-[11px] text-slate-300">
                        Con IVA (21%): {pricing.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white/10 rounded-2xl space-y-1 text-xs text-slate-200">
                    <div className="flex justify-between">
                      <span>Base ({pricing.quantity} pares):</span>
                      <span className="font-semibold text-white">{pricing.basePricePerPair.toFixed(2).replace('.', ',')} €/par</span>
                    </div>
                    {pricing.materialExtra > 0 && (
                      <div className="flex justify-between">
                        <span>Material ({selectedMaterial.name}):</span>
                        <span className="font-semibold text-white">+{pricing.materialExtra.toFixed(2).replace('.', ',')} €/par</span>
                      </div>
                    )}
                    {pricing.logoExtra > 0 && (
                      <div className="flex justify-between">
                        <span>Logo tejido ({logoPos === 'both' ? 'ambos lados' : '1 lado'}):</span>
                        <span className="font-semibold text-white">+{pricing.logoExtra.toFixed(2).replace('.', ',')} €/par</span>
                      </div>
                    )}
                    {pricing.extraColorsExtra > 0 && (
                      <div className="flex justify-between">
                        <span>Colores extra:</span>
                        <span className="font-semibold text-white">+{pricing.extraColorsExtra.toFixed(2).replace('.', ',')} €/par</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* PASO 4: PIDE TU PRESUPUESTO (FORMULARIO CORTO + RESUMEN)        */}
            {/* =============================================================== */}
            {currentStep === 4 && (
              <div data-testid="wizard-step-4" className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
                <h3 className="font-extrabold text-petrol-dark text-lg">
                  4. Pide tu presupuesto
                </h3>

                {/* Resumen visual del calcetín montado y del logo adjunto */}
                <div className="p-3.5 bg-ice rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-3">
                    {snapshotUrl && (
                      <img
                        src={snapshotUrl}
                        alt="Tu calcetín diseñado"
                        data-testid="summary-sock-thumb"
                        className="w-20 h-20 rounded-xl object-cover bg-[#0A1A23] border border-slate-300 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 text-xs space-y-1">
                      <p className="font-extrabold text-petrol-dark text-sm">
                        {pricing.quantity} pares · {selectedMaterial.name}
                      </p>
                      <p className="text-slate-600">
                        Color: <strong>{getFriendlyColorName(config.legColor)}</strong> · Talón y puntera: <strong>{getFriendlyColorName(config.heelToeColor)}</strong>
                      </p>
                      <p className="font-extrabold text-turquoise text-sm">
                        {pricing.pricePerPair.toFixed(2).replace('.', ',')} €/par · Total {pricing.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € + IVA
                      </p>
                    </div>
                  </div>

                  {/* Miniatura del logo ya adjunto (sin pedirlo otra vez) */}
                  <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {config.logo.url ? (
                        <>
                          <img
                            src={config.logo.url}
                            alt="Logo adjunto"
                            data-testid="summary-logo-thumb"
                            className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 p-1 flex-shrink-0"
                          />
                          <span className="truncate text-slate-700 font-semibold">
                            Logo adjunto: {logoFileName || 'Imagen cargada'}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">Sin logo añadido</span>
                      )}
                    </div>
                    <button
                      type="button"
                      data-testid="btn-change-logo-step4"
                      onClick={() => goToStep(2)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-turquoise text-petrol font-bold text-xs flex-shrink-0"
                    >
                      {config.logo.url ? 'Cambiar logo' : 'Añadir logo'}
                    </button>
                  </div>
                </div>

                {/* Mensaje de confirmación tras enviar */}
                {formSubmitted ? (
                  <div
                    data-testid="quote-sent-confirmation"
                    className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2.5 text-center"
                  >
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                    <h4 className="text-base font-extrabold">¡Solicitud enviada!</h4>
                    <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
                      Hemos recibido tu diseño ({pricing.quantity} pares de {selectedMaterial.name}) junto con tus datos. <strong>La fábrica te contestará lo antes posible.</strong>
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleStep4Submit} className="space-y-3.5" noValidate>
                    <div>
                      <label htmlFor="wizard-name" className="block text-xs font-bold text-slate-700 mb-1">
                        Tu nombre *
                      </label>
                      <input
                        id="wizard-name"
                        data-testid="input-quote-name"
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Ej: Laura García"
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-turquoise focus:outline-none"
                      />
                      {formErrors.name && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="wizard-email" className="block text-xs font-bold text-slate-700 mb-1">
                        Tu correo electrónico *
                      </label>
                      <input
                        id="wizard-email"
                        data-testid="input-quote-email"
                        type="email"
                        required
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="Ej: laura@correo.com"
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:ring-2 focus:ring-turquoise focus:outline-none"
                      />
                      {formErrors.email && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>
                      )}
                    </div>

                    {/* Cantidad ya rellenada automáticamente */}
                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-semibold">Cantidad elegida:</span>
                      <span className="font-extrabold text-petrol-dark">{pricing.quantity} pares</span>
                    </div>

                    {/* Más datos opcionales colapsados */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        data-testid="toggle-optional-fields"
                        onClick={() => setShowOptionalFields((v) => !v)}
                        className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700"
                      >
                        <span>Más datos (opcional)</span>
                        {showOptionalFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showOptionalFields && (
                        <div className="p-3.5 space-y-3 bg-white border-t border-slate-200 text-xs">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="wizard-phone" className="block font-semibold text-slate-700 mb-1">
                                Teléfono
                              </label>
                              <input
                                id="wizard-phone"
                                type="tel"
                                value={formPhone}
                                onChange={(e) => setFormPhone(e.target.value)}
                                placeholder="Ej: 600 123 456"
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                              />
                            </div>
                            <div>
                              <label htmlFor="wizard-company" className="block font-semibold text-slate-700 mb-1">
                                Empresa o club
                              </label>
                              <input
                                id="wizard-company"
                                type="text"
                                value={formCompany}
                                onChange={(e) => setFormCompany(e.target.value)}
                                placeholder="Opcional"
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="wizard-deadline" className="block font-semibold text-slate-700 mb-1">
                              ¿Para qué fecha los necesitas?
                            </label>
                            <input
                              id="wizard-deadline"
                              type="text"
                              value={formDeadline}
                              onChange={(e) => setFormDeadline(e.target.value)}
                              placeholder="Ej: finales de mes"
                              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="wizard-comments" className="block font-semibold text-slate-700 mb-1">
                              Comentarios
                            </label>
                            <textarea
                              id="wizard-comments"
                              rows={2}
                              value={formComments}
                              onChange={(e) => setFormComments(e.target.value)}
                              placeholder="Tallas aproximadas o cualquier detalle..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        data-testid="input-quote-privacy"
                        checked={formPrivacy}
                        onChange={(e) => setFormPrivacy(e.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded accent-turquoise cursor-pointer flex-shrink-0"
                      />
                      <span>
                        Acepto que la fábrica utilice estos datos para enviarme el presupuesto de este diseño.
                      </span>
                    </label>
                    {formErrors.privacy && (
                      <p className="text-xs text-red-600">{formErrors.privacy}</p>
                    )}

                    <button
                      type="submit"
                      data-testid="btn-submit-quote"
                      className="w-full min-h-[52px] flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-turquoise hover:bg-turquoise-light text-white font-extrabold text-base shadow-lg transition-all"
                    >
                      <Send className="w-4 h-4" />
                      <span>Enviar solicitud de presupuesto</span>
                    </button>
                  </form>
                )}

                {/* Botón de descarga de presupuesto en PDF */}
                <button
                  type="button"
                  data-testid="btn-download-pdf"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-ice hover:bg-slate-200/70 text-petrol-dark font-bold text-sm border border-slate-200 transition-colors disabled:opacity-60"
                >
                  <Download className="w-4 h-4 text-turquoise" />
                  <span>
                    {isGeneratingPdf ? 'Generando PDF...' : 'Descargar presupuesto en PDF'}
                  </span>
                </button>
              </div>
            )}

            {/* BOTONES GRANDES DE NAVEGACIÓN ENTRE PASOS (Atrás / Siguiente) */}
            <div className="flex items-center justify-between gap-3 pt-1">
              {currentStep > 1 ? (
                <button
                  type="button"
                  data-testid="btn-step-back"
                  onClick={() => goToStep((currentStep - 1) as WizardStep)}
                  className="min-h-[48px] px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm inline-flex items-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Atrás</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 && (
                <button
                  type="button"
                  data-testid="btn-step-next"
                  onClick={() => goToStep((currentStep + 1) as WizardStep)}
                  className="flex-1 sm:flex-initial min-h-[48px] px-7 py-3 rounded-2xl bg-petrol hover:bg-petrol-dark text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <span>Siguiente</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* BARRA FIJA INFERIOR EN MÓVIL ("xx,xx € por par · total" + "Pedir presupuesto") */}
      {isInViewport && (
        <div
          data-testid="mobile-sticky-bar"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-petrol-dark/95 backdrop-blur-md text-white px-4 py-3 border-t border-white/15 shadow-float"
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-extrabold leading-tight">
                {pricing.pricePerPair.toFixed(2).replace('.', ',')} € por par
              </p>
              <p className="text-xs text-yarn-mustard font-semibold truncate">
                Total {pricing.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ({config.quantity} pares)
              </p>
            </div>

            <button
              type="button"
              data-testid="btn-mobile-request-quote"
              onClick={() => goToStep(4)}
              className="min-h-[44px] px-4 py-2.5 bg-turquoise hover:bg-turquoise-light text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md inline-flex items-center gap-1.5 flex-shrink-0"
            >
              <FileCheck className="w-4 h-4 text-yarn-mustard" />
              <span>Pedir presupuesto</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
