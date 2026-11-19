import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  RotateCcw,
  Check,
  FileCheck,
  ArrowDown,
  Lock,
  Tag,
  Layers,
  Grid,
  Type,
  Download
} from 'lucide-react';
import { SockViewer3D } from './SockViewer3D';
import { SockConfig } from '../../types/sock';
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

// High resolution Sample logo SVG data URI (Integrated Jacquard design)
const SAMPLE_CHURRERIA_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360"><text x="300" y="105" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="58" fill="%23D32F2F" text-anchor="middle" letter-spacing="4">CHURRERÍA</text><text x="300" y="235" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="115" fill="%23D32F2F" text-anchor="middle" letter-spacing="6">PEPE</text><text x="300" y="315" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="32" fill="%23D32F2F" text-anchor="middle" letter-spacing="6">★ DESDE 1982 ★</text></svg>`;

// Preset Color Palettes for Socks
const YARN_PALETTE = [
  { name: 'Blanco Puro', hex: '#FFFFFF' },
  { name: 'Negro Carbón', hex: '#1E232A' },
  { name: 'Azul Petróleo', hex: '#1F4D63' },
  { name: 'Azul Noche', hex: '#173A4B' },
  { name: 'Turquesa', hex: '#1B7A93' },
  { name: 'Turquesa Claro', hex: '#2A9DB8' },
  { name: 'Crudo Natural', hex: '#F4F1EA' },
  { name: 'Mostaza Cálido', hex: '#F2C14E' },
  { name: 'Coral Terracota', hex: '#E36F73' },
  { name: 'Verde Bosque', hex: '#2D6A4F' },
  { name: 'Burdeos Sierra', hex: '#782834' }
];

type DesignPresetId = 'liso' | 'clasico' | 'deportivo' | 'corporativo';

interface ConfiguratorSectionProps {
  onSelectConfigForQuote: (config: SockConfig, snapshotUrl?: string) => void;
}

interface SwatchPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  idPrefix: string;
}

const SwatchPicker: React.FC<SwatchPickerProps> = ({ label, value, onChange, idPrefix }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="font-semibold text-slate-700">{label}</span>
        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500">
          <span>Personalizado:</span>
          <input
            type="color"
            aria-label={label}
            data-testid={`${idPrefix}-custom-color`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
          />
        </label>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
        {YARN_PALETTE.map((c) => {
          const isSelected = value.trim().toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={`${idPrefix}-${c.hex}`}
              type="button"
              data-testid={`${idPrefix}-swatch-${c.hex.replace('#', '')}`}
              onClick={() => onChange(c.hex)}
              className={`group relative flex items-center justify-center p-1 rounded-xl transition-all border ${
                isSelected
                  ? 'ring-2 ring-turquoise border-white scale-105 shadow-xs'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
              title={c.name}
            >
              <span
                className="w-6 h-6 sm:w-6 sm:h-6 rounded-lg shadow-2xs flex items-center justify-center border border-black/10"
                style={{ backgroundColor: c.hex }}
              >
                {isSelected && (
                  <Check
                    className={`w-3.5 h-3.5 ${
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

export const ConfiguratorSection: React.FC<ConfiguratorSectionProps> = ({ onSelectConfigForQuote }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const captureSnapshotRef = useRef<(() => string | null) | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [activePresetId, setActivePresetId] = useState<DesignPresetId | null>('liso');

  // Initial state: LISO blanco (#FFFFFF) en puño, caña y pie; talón y puntera fijos #2B3140; sin logo ni motivo
  const [config, setConfig] = useState<ExtendedSockConfig>({
    cuffColor: '#FFFFFF',
    legColor: '#FFFFFF',
    footColor: '#FFFFFF',
    heelToeColor: '#2B3140',
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
      scale: 1.0,
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

  // Monitor visibility of section to trigger sticky mobile bar
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Pricing calculation
  const pricing = calculatePricing(config);

  // Quick Design Presets
  const applyDesignPreset = (presetId: DesignPresetId) => {
    setActivePresetId(presetId);
    setConfig((prev) => {
      if (presetId === 'liso') {
        return {
          ...prev,
          cuffColor: '#FFFFFF',
          legColor: '#FFFFFF',
          footColor: '#FFFFFF',
          customCuff: false,
          customFoot: false,
          pattern: {
            ...prev.pattern!,
            type: 'none'
          },
          logo: {
            ...prev.logo,
            allOver: false,
            url: null,
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
          }
        };
      }
      if (presetId === 'clasico') {
        return {
          ...prev,
          cuffColor: '#1F4D63',
          legColor: '#FFFFFF',
          footColor: '#FFFFFF',
          customCuff: true,
          customFoot: false,
          pattern: {
            ...prev.pattern!,
            type: 'none'
          },
          logo: {
            ...prev.logo,
            allOver: false,
            url: null,
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
          }
        };
      }
      if (presetId === 'deportivo') {
        return {
          ...prev,
          cuffColor: '#FFFFFF',
          legColor: '#FFFFFF',
          footColor: '#FFFFFF',
          customCuff: false,
          customFoot: false,
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
            scale: 1.0,
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
          }
        };
      }
      // 'corporativo': negro con logo sobre parche blanco
      return {
        ...prev,
        cuffColor: '#1E232A',
        legColor: '#1E232A',
        footColor: '#1E232A',
        customCuff: false,
        customFoot: false,
        pattern: {
          ...prev.pattern!,
          type: 'none'
        },
        logo: {
          ...prev.logo,
          allOver: false,
          url: SAMPLE_CHURRERIA_LOGO,
          scale: 1.0,
          yPos: 0.45,
          rotation: 0,
          repeatBack: false
        },
        logoBg: {
          type: 'roundedRect',
          color: '#FFFFFF'
        },
        logoPosition: 'front',
        knittedText: {
          text: '',
          color: '#FFFFFF'
        }
      };
    });
  };

  // Base color handler: updates leg, and also cuff/foot unless their custom toggle is active
  const handleBaseColorChange = (hex: string) => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      legColor: hex,
      cuffColor: prev.customCuff ? prev.cuffColor : hex,
      footColor: prev.customFoot ? prev.footColor : hex
    }));
  };

  // Toggle "Puño de otro color"
  const handleToggleCustomCuff = (enabled: boolean) => {
    setActivePresetId(null);
    setConfig((prev) => {
      const defaultOther =
        prev.legColor.toLowerCase() === '#1f4d63' ? '#2A9DB8' : '#1F4D63';
      return {
        ...prev,
        customCuff: enabled,
        cuffColor: enabled ? defaultOther : prev.legColor
      };
    });
  };

  // Toggle "Pie de otro color"
  const handleToggleCustomFoot = (enabled: boolean) => {
    setActivePresetId(null);
    setConfig((prev) => {
      const defaultOther =
        prev.legColor.toLowerCase() === '#1b7a93' ? '#1F4D63' : '#1B7A93';
      return {
        ...prev,
        customFoot: enabled,
        footColor: enabled ? defaultOther : prev.legColor
      };
    });
  };

  // Pattern updates
  const updatePattern = (patch: Partial<NonNullable<ExtendedSockConfig['pattern']>>) => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      pattern: {
        ...prev.pattern!,
        ...patch
      }
    }));
  };

  // Logo Upload (Client-side FileReader with strict MIME and size validation)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Por favor selecciona una imagen válida en formato PNG, JPG, SVG o WebP.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('La imagen no debe superar los 8 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (typeof event.target?.result === 'string') {
        const rawDataUrl = event.target.result;
        // Reducir el logo si es muy grande antes de guardarlo en el estado y meterlo en el 3D / PDF
        const reduced =
          file.type === 'image/svg+xml'
            ? null
            : await downscaleImageDataUrl(rawDataUrl, 600, 600);
        const finalUrl = reduced ? reduced.dataUrl : rawDataUrl;

        setActivePresetId(null);
        setConfig((prev) => ({
          ...prev,
          logo: {
            ...prev.logo,
            allOver: false,
            url: finalUrl
          }
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const setSampleLogo = () => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      logo: {
        ...prev.logo,
        allOver: false,
        url: SAMPLE_CHURRERIA_LOGO
      }
    }));
  };

  const setNavidadLogo = () => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      logo: {
        ...prev.logo,
        allOver: true,
        url: '/images/diseno-navidad.jpg'
      }
    }));
  };

  const removeLogo = () => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      logo: {
        ...prev.logo,
        allOver: false,
        url: null
      }
    }));
  };

  const handleLogoPositionChange = (pos: LogoPosition) => {
    setActivePresetId(null);
    setConfig((prev) => ({
      ...prev,
      logoPosition: pos,
      logo: {
        ...prev.logo,
        repeatBack: pos === 'both'
      }
    }));
  };

  const handleQuoteClick = () => {
    const liveSnap = captureSnapshotRef.current?.() || snapshotUrl;
    if (liveSnap) setSnapshotUrl(liveSnap);
    onSelectConfigForQuote(config, liveSnap);
    const contactElem = document.getElementById('contacto');
    if (contactElem) {
      contactElem.scrollIntoView({ behavior: 'smooth' });
    }
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
        snapshotDataUrl: liveSnap
      });
    } catch (err) {
      console.error('Error al generar el presupuesto en PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const pat = config.pattern!;
  const logoBg = config.logoBg!;
  const logoPos = config.logoPosition || 'front';
  const knittedText = config.knittedText!;

  return (
    <section
      id="configurador"
      ref={sectionRef}
      className="py-16 sm:py-24 bg-white relative scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ice text-turquoise text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Configurador 3D en Vivo
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-petrol-dark tracking-tight">
            Diseña tu calcetín y ve el precio al momento
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600">
            Elige un punto de partida o personaliza paso a paso colores, motivos tejidos, logotipo y texto en punto jacquard.
          </p>
        </div>

        {/* Main Grid: 3D Viewer (Left/Top) + Controls Panel (Right/Bottom) */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">

          {/* 3D Visualizer Column (Sticky on desktop, top on mobile) */}
          <div className="lg:col-span-6 xl:col-span-7 lg:sticky lg:top-24 space-y-4">
            <SockViewer3D
              config={config}
              onSnapshotReady={(data) => setSnapshotUrl(data)}
              captureSnapshotRef={captureSnapshotRef}
              onUseSampleLogo={setSampleLogo}
            />

            {/* Quick summary strip below 3D */}
            <div className="p-4 bg-ice rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yarn-green animate-pulse" />
                <span className="font-semibold text-petrol">
                  {MATERIALS.find((m) => m.id === config.material)?.name}
                </span>
                <span className="text-slate-400">·</span>
                <span>{config.quantity} pares</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold" data-testid="colors-count-badge">
                <span>{pricing.totalColorsCount} {pricing.totalColorsCount === 1 ? 'color de hilo' : 'colores de hilo'}</span>
                {pricing.extraColorsExtra > 0 ? (
                  <span className="text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    +{pricing.extraColorsExtra.toFixed(2)} €/par
                  </span>
                ) : (
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    Incluidos
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls Panel Column */}
          <div className="lg:col-span-6 xl:col-span-5 space-y-5">

            {/* PRESETS BAR AT TOP OF PANEL */}
            <div className="bg-ice/90 p-4 sm:p-5 rounded-3xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-petrol-dark">
                  Diseños rápidos de partida
                </span>
                <span className="text-[11px] text-slate-500">100% editables después</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'liso' as const, title: 'Liso', desc: '1 color limpio' },
                  { id: 'clasico' as const, title: 'Clásico', desc: 'Puño contraste' },
                  { id: 'deportivo' as const, title: 'Deportivo', desc: 'Rayas + logo' },
                  { id: 'corporativo' as const, title: 'Corporativo', desc: 'Negro + parche' }
                ].map((p) => {
                  const active = activePresetId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`preset-${p.id}`}
                      onClick={() => applyDesignPreset(p.id)}
                      className={`text-left p-2.5 rounded-2xl border transition-all ${
                        active
                          ? 'bg-petrol text-white border-petrol shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-turquoise'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{p.title}</div>
                      <div className={`text-[10px] mt-0.5 ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                        {p.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PASO 1: COLOR BASE Y ZONAS */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-petrol-dark text-base sm:text-lg flex items-center gap-2">
                  <Layers className="w-4 h-4 text-turquoise" />
                  <span>Paso 1 · Color base</span>
                </h3>
                <span className="text-xs text-slate-500">1, 2 o 3 colores</span>
              </div>

              {/* Main Base Color Selector */}
              <SwatchPicker
                label="Color del calcetín (pinta puño, caña y pie)"
                value={config.legColor}
                onChange={handleBaseColorChange}
                idPrefix="base"
              />

              {/* Optional Toggles for Cuff & Foot */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                {/* Toggle Puño */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
                        style={{ backgroundColor: config.cuffColor }}
                      />
                      <span className="text-xs font-bold text-slate-800">Puño de otro color</span>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="toggle-custom-cuff"
                      checked={Boolean(config.customCuff)}
                      onChange={(e) => handleToggleCustomCuff(e.target.checked)}
                      className="w-4 h-4 rounded text-turquoise accent-turquoise cursor-pointer"
                    />
                  </label>

                  {config.customCuff && (
                    <div className="pt-2 border-t border-slate-200/70">
                      <SwatchPicker
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

                {/* Toggle Pie */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
                        style={{ backgroundColor: config.footColor }}
                      />
                      <span className="text-xs font-bold text-slate-800">Pie de otro color</span>
                    </div>
                    <input
                      type="checkbox"
                      data-testid="toggle-custom-foot"
                      checked={Boolean(config.customFoot)}
                      onChange={(e) => handleToggleCustomFoot(e.target.checked)}
                      className="w-4 h-4 rounded text-turquoise accent-turquoise cursor-pointer"
                    />
                  </label>

                  {config.customFoot && (
                    <div className="pt-2 border-t border-slate-200/70">
                      <SwatchPicker
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

              {/* Locked Zone Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
                <Lock className="w-4 h-4 text-slate-700 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Refuerzo técnico fijo:</strong> talón y puntera siempre en gris pizarra (#2B3140) incluido sin coste extra de color.
                </p>
              </div>
            </div>

            {/* PASO 2: MOTIVO TEJIDO (OPCIONAL) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-petrol-dark text-base sm:text-lg flex items-center gap-2">
                  <Grid className="w-4 h-4 text-turquoise" />
                  <span>Paso 2 · Motivo tejido</span>
                </h3>
                <span className="text-xs text-slate-500">Opcional · Jacquard</span>
              </div>

              {/* Pattern Type Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'none' as PatternType, label: 'Ninguno' },
                  { id: 'stripes' as PatternType, label: 'Rayas' },
                  { id: 'dots' as PatternType, label: 'Lunares' },
                  { id: 'checks' as PatternType, label: 'Cuadros peq.' }
                ].map((item) => {
                  const active = pat.type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`pattern-type-${item.id}`}
                      onClick={() => updatePattern({ type: item.id })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-petrol text-white border-petrol shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub-controls for Stripes */}
              {pat.type === 'stripes' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 text-xs">
                  {/* Zona */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 block">Zona de las rayas:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'cuff' as StripesZone, label: 'Solo puño' },
                        { id: 'leg' as StripesZone, label: 'Solo caña' },
                        { id: 'all' as StripesZone, label: 'Toda (puño y caña)' }
                      ].map((z) => (
                        <button
                          key={z.id}
                          type="button"
                          data-testid={`stripes-zone-${z.id}`}
                          onClick={() => updatePattern({ stripesZone: z.id })}
                          className={`py-2 px-2 rounded-xl font-bold border transition-all ${
                            pat.stripesZone === z.id
                              ? 'bg-turquoise text-white border-turquoise'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {z.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grosor */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 block">Grosor:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'thin' as StripesThickness, label: 'Fina' },
                        { id: 'medium' as StripesThickness, label: 'Media' },
                        { id: 'thick' as StripesThickness, label: 'Ancha' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          data-testid={`stripes-thickness-${t.id}`}
                          onClick={() => updatePattern({ stripesThickness: t.id })}
                          className={`py-2 px-2 rounded-xl font-bold border transition-all ${
                            pat.stripesThickness === t.id
                              ? 'bg-turquoise text-white border-turquoise'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cantidad (2 a 6) */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 block">Cantidad de rayas:</span>
                    <div className="grid grid-cols-5 gap-2">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          type="button"
                          data-testid={`stripes-count-${n}`}
                          onClick={() => updatePattern({ stripesCount: n })}
                          className={`py-2 rounded-xl font-bold border transition-all ${
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

                  {/* Color de las rayas */}
                  <SwatchPicker
                    label="Color de las rayas"
                    value={pat.color}
                    onChange={(hex) => updatePattern({ color: hex })}
                    idPrefix="pattern"
                  />
                </div>
              )}

              {/* Sub-controls for Polka Dots (Lunares) */}
              {pat.type === 'dots' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 text-xs">
                  {/* Tamaño */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 block">Tamaño del lunar:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'small' as DotsSize, label: 'Pequeño' },
                        { id: 'medium' as DotsSize, label: 'Medio' },
                        { id: 'large' as DotsSize, label: 'Grande' }
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          data-testid={`dots-size-${s.id}`}
                          onClick={() => updatePattern({ dotsSize: s.id })}
                          className={`py-2 px-2 rounded-xl font-bold border transition-all ${
                            pat.dotsSize === s.id
                              ? 'bg-turquoise text-white border-turquoise'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Densidad */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 block">Densidad:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'few' as DotsDensity, label: 'Pocos' },
                        { id: 'medium' as DotsDensity, label: 'Medios' },
                        { id: 'many' as DotsDensity, label: 'Muchos' }
                      ].map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          data-testid={`dots-density-${d.id}`}
                          onClick={() => updatePattern({ dotsDensity: d.id })}
                          className={`py-2 px-2 rounded-xl font-bold border transition-all ${
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

                  {/* Color de los lunares */}
                  <SwatchPicker
                    label="Color de los lunares"
                    value={pat.color}
                    onChange={(hex) => updatePattern({ color: hex })}
                    idPrefix="pattern"
                  />

                  <p className="text-[11px] text-slate-500">
                    * Los lunares respetan automáticamente un margen limpio alrededor del logo y del texto tejido.
                  </p>
                </div>
              )}

              {/* Sub-controls for Small Checks (Cuadros pequeños) */}
              {pat.type === 'checks' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold">Tamaño del cuadro:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 font-bold text-petrol">
                      Pequeño (Jacquard fino)
                    </span>
                  </div>
                  <SwatchPicker
                    label="Color de los cuadros"
                    value={pat.color}
                    onChange={(hex) => updatePattern({ color: hex })}
                    idPrefix="pattern"
                  />
                </div>
              )}
            </div>

            {/* PASO 3: LOGOTIPO Y TEXTO TEJIDO */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-petrol-dark text-base sm:text-lg flex items-center gap-2">
                  <Type className="w-4 h-4 text-turquoise" />
                  <span>Paso 3 · Logo y texto tejido</span>
                </h3>
                <span className="text-xs text-turquoise font-semibold">En la caña</span>
              </div>

              {/* Logo Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex-1 min-w-[135px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-turquoise bg-turquoise/5 hover:bg-turquoise/10 text-turquoise text-xs font-bold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Subir tu logo</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  data-testid="btn-sample-logo"
                  onClick={setSampleLogo}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors border ${
                    config.logo.url === SAMPLE_CHURRERIA_LOGO
                      ? 'bg-petrol text-white border-petrol'
                      : 'bg-ice hover:bg-slate-200/70 text-petrol border-slate-200'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-yarn-coral" />
                  <span>Logo ejemplo</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-navidad-logo"
                  onClick={setNavidadLogo}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors border ${
                    config.logo.url === '/images/diseno-navidad.jpg'
                      ? 'bg-petrol text-white border-petrol'
                      : 'bg-ice hover:bg-slate-200/70 text-petrol border-slate-200'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-yarn-coral" />
                  <span>Diseño Navidad</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-remove-logo"
                  onClick={removeLogo}
                  disabled={!config.logo.url}
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sin logo</span>
                </button>
              </div>

              {/* Active Logo Settings */}
              {config.logo.url && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 text-xs">

                  {/* Fondo del logo (parche) */}
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-700 block">
                      Fondo del logo (parche tejido):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'none' as LogoBgType, label: 'Ninguno' },
                        { id: 'circle' as LogoBgType, label: 'Círculo' },
                        { id: 'roundedRect' as LogoBgType, label: 'Rect. redondeado' }
                      ].map((bg) => (
                        <button
                          key={bg.id}
                          type="button"
                          data-testid={`logo-bg-${bg.id}`}
                          onClick={() => {
                            setActivePresetId(null);
                            setConfig((prev) => ({
                              ...prev,
                              logoBg: { ...prev.logoBg!, type: bg.id }
                            }));
                          }}
                          className={`py-2 px-2 rounded-xl font-bold border transition-all ${
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
                        <SwatchPicker
                          label="Color del parche de fondo"
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

                  {/* Posición del logo */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 block">Posición en la caña:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'front' as LogoPosition, label: 'Caña delante' },
                        { id: 'back' as LogoPosition, label: 'Caña detrás' },
                        { id: 'both' as LogoPosition, label: 'Ambos (+0,20 €)' }
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          data-testid={`logo-pos-${pos.id}`}
                          onClick={() => handleLogoPositionChange(pos.id)}
                          className={`py-2 px-2 rounded-xl font-bold border transition-all ${
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

                  {/* Sliders: Tamaño y Altura */}
                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium text-slate-700">
                        <span>Tamaño</span>
                        <span className="font-bold text-petrol">{Math.round(config.logo.scale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.6"
                        max="1.35"
                        step="0.05"
                        value={config.logo.scale}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            logo: { ...prev.logo, scale: parseFloat(e.target.value) }
                          }))
                        }
                        className="w-full accent-turquoise h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-medium text-slate-700">
                        <span>Altura en caña</span>
                        <span className="font-bold text-petrol">
                          {config.logo.yPos < 0.3 ? 'Alta' : config.logo.yPos > 0.6 ? 'Baja' : 'Media'}
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
                        className="w-full accent-turquoise h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Texto tejido (opcional, máx 14 caracteres) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <label htmlFor="knitted-text-input" className="font-bold text-slate-800">
                    Texto tejido (opcional, debajo del logo):
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {knittedText.text.length}/14 caract.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="knitted-text-input"
                    data-testid="knitted-text-input"
                    type="text"
                    maxLength={14}
                    placeholder="Ej: PRADOLUENGO o RUN CLUB"
                    value={knittedText.text}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 14);
                      setActivePresetId(null);
                      setConfig((prev) => ({
                        ...prev,
                        knittedText: { ...prev.knittedText!, text: val }
                      }));
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold uppercase tracking-wider text-xs focus:ring-2 focus:ring-turquoise focus:outline-none"
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
                      className="px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
                    >
                      Borrar
                    </button>
                  )}
                </div>

                {knittedText.text.trim().length > 0 && (
                  <SwatchPicker
                    label="Color del texto tejido"
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
            </div>

            {/* PASO 4: MATERIAL & CANTIDAD */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-soft space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-petrol-dark text-base sm:text-lg">
                  Paso 4 · Material y cantidad
                </h3>
              </div>

              {/* Material selector cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {MATERIALS.map((mat) => {
                  const isSelected = config.material === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, material: mat.id }))}
                      className={`text-left p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-turquoise bg-turquoise/5 ring-1 ring-turquoise shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-petrol-dark">{mat.name}</span>
                        {mat.extraPerPair > 0 ? (
                          <span className="text-[11px] font-semibold text-turquoise">
                            +{mat.extraPerPair.toFixed(2)} €
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-slate-400">Base</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                        {mat.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Quantity quick buttons and numeric input */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                  <span>Cantidad de pares (mín. 10):</span>
                  <span className="text-[11px] text-turquoise font-semibold">Escala con descuento</span>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {[10, 25, 50, 100, 250, 500].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, quantity: qty }))}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        config.quantity === qty
                          ? 'bg-petrol text-white border-petrol shadow-xs'
                          : 'bg-ice text-slate-700 border-slate-200 hover:bg-slate-200/70'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs text-slate-500">Otro volumen:</span>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    value={config.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 10;
                      setConfig((prev) => ({ ...prev, quantity: Math.max(10, val) }));
                    }}
                    className="w-32 px-3 py-1.5 text-sm font-bold text-petrol border border-slate-300 rounded-xl focus:ring-2 focus:ring-turquoise"
                  />
                  <span className="text-xs text-slate-500">pares</span>
                </div>
              </div>
            </div>

            {/* LIVE PRICING BREAKDOWN */}
            <div className="bg-gradient-to-br from-petrol-dark to-petrol text-white p-6 rounded-3xl shadow-float space-y-5">

              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-turquoise-light">
                    Presupuesto orientativo
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight" data-testid="price-per-pair">
                      {pricing.pricePerPair.toFixed(2)} €
                    </span>
                    <span className="text-sm text-slate-300 font-medium">/ par</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-300">Total fabricación</span>
                  <p className="text-xl sm:text-2xl font-bold text-yarn-mustard mt-0.5">
                    {pricing.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                  <p className="text-[11px] text-slate-300">
                    + IVA (21%): {pricing.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </p>
                </div>
              </div>

              {/* Itemized summary bullets */}
              <div className="p-3.5 bg-white/10 rounded-2xl space-y-1.5 text-xs text-slate-200">
                <div className="flex justify-between">
                  <span>Base ({pricing.quantity} pares):</span>
                  <span className="font-semibold text-white">{pricing.basePricePerPair.toFixed(2)} € / par</span>
                </div>
                <div className="flex justify-between">
                  <span>Colores de hilo ({pricing.totalColorsCount} {pricing.totalColorsCount === 1 ? 'color' : 'colores'}):</span>
                  <span className="font-semibold text-white">
                    {pricing.extraColorsExtra > 0
                      ? `+${pricing.extraColorsExtra.toFixed(2)} € / par`
                      : 'Incluidos (hasta 2)'}
                  </span>
                </div>
                {pricing.materialExtra > 0 && (
                  <div className="flex justify-between">
                    <span>Suplemento fibra:</span>
                    <span className="font-semibold text-white">+{pricing.materialExtra.toFixed(2)} € / par</span>
                  </div>
                )}
                {pricing.logoExtra > 0 && (
                  <div className="flex justify-between">
                    <span>Tejido de logotipo {logoPos === 'both' ? '(ambas caras)' : '(1 cara)'}:</span>
                    <span className="font-semibold text-white">+{pricing.logoExtra.toFixed(2)} € / par</span>
                  </div>
                )}
                {pricing.setupFee > 0 && (
                  <div className="flex justify-between pt-1 border-t border-white/20">
                    <span>Puesta a punto de telar (fija 1 sola vez):</span>
                    <span className="font-semibold text-white">{pricing.setupFee.toFixed(2)} €</span>
                  </div>
                )}
                {pricing.quantity > 50 && (
                  <p className="pt-1 text-[11px] text-white/70">
                    Más de 50 pares: el precio final se confirma con la fábrica.
                  </p>
                )}
              </div>

              {/* CTA Buttons: "Descargar presupuesto en PDF" & "Pedir este presupuesto" */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  data-testid="btn-download-pdf"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-white hover:bg-ice text-petrol-dark font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait border border-white/80"
                >
                  <Download className="w-5 h-5 text-turquoise" />
                  <span>
                    {isGeneratingPdf ? 'Generando PDF...' : 'Descargar presupuesto en PDF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleQuoteClick}
                  className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-turquoise hover:bg-turquoise-light text-white font-extrabold text-base shadow-lg hover:shadow-glow transition-all duration-200 active:scale-[0.99]"
                >
                  <FileCheck className="w-5 h-5 text-yarn-mustard" />
                  <span>Pedir este presupuesto</span>
                  <ArrowDown className="w-4 h-4 ml-1" />
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-400">
                * Precios orientativos para demostración técnica. El taller confirma viabilidad y coste final según complejidad del hilado.
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* STICKY BOTTOM BAR FOR MOBILE (visible when section is in view) */}
      {isInViewport && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-petrol-dark/95 backdrop-blur-md text-white p-3 border-t border-white/20 shadow-float animate-slideUp">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-turquoise-light uppercase font-semibold">
                {config.quantity} pares · {pricing.totalColorsCount} {pricing.totalColorsCount === 1 ? 'color' : 'colores'}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black">{pricing.pricePerPair.toFixed(2)} €</span>
                <span className="text-xs text-slate-300">/par</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="btn-download-pdf-mobile"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                aria-label="Descargar presupuesto en PDF"
                title="Descargar presupuesto en PDF"
                className="flex items-center gap-1.5 px-3 py-2.5 bg-white text-petrol-dark text-xs font-extrabold rounded-xl shadow-md hover:bg-ice active:scale-95 transition-transform disabled:opacity-60"
              >
                <Download className="w-4 h-4 text-turquoise flex-shrink-0" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={handleQuoteClick}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-turquoise text-white text-xs sm:text-sm font-bold rounded-xl shadow-md hover:bg-turquoise-light active:scale-95 transition-transform"
              >
                <span>Pedir presupuesto</span>
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
