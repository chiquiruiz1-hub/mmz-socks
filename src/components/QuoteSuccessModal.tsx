import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle, X, Sparkles, AlertCircle } from 'lucide-react';
import { MATERIALS, calculatePricing } from '../utils/pricing';
import { SockConfig } from '../types/sock';

interface QuoteSuccessModalProps {
  data: {
    name: string;
    company: string;
    email: string;
    phone: string;
    message: string;
    config?: SockConfig | null;
    snapshotUrl?: string;
  };
  onClose: () => void;
}

export const QuoteSuccessModal: React.FC<QuoteSuccessModalProps> = ({ data, onClose }) => {
  useEffect(() => {
    // Joyful celebration confetti with brand colors!
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1B7A93', '#1F4D63', '#F2C14E', '#E36F73', '#4CAF7A']
      });
    } catch {
      // safe fallback
    }
  }, []);

  const config = data.config;
  const pricing = config ? calculatePricing(config) : null;
  const materialName = config
    ? MATERIALS.find((m) => m.id === config.material)?.name || 'Algodón Peinado'
    : 'Algodón Peinado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-float border border-slate-200 relative my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Cerrar confirmación"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-16 h-16 rounded-full bg-yarn-green/15 text-yarn-green flex items-center justify-center mx-auto mb-3 shadow-xs">
            <CheckCircle className="w-8 h-8" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-turquoise bg-turquoise/10 px-3 py-1 rounded-full">
            Simulación de presupuesto completada
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-petrol-dark tracking-tight">
            ¡Presupuesto simulado con éxito!
          </h3>
          <p className="text-sm text-slate-600">
            Gracias por interactuar con el configurador, <strong>{data.name}</strong>.
          </p>
        </div>

        {/* Demo Notice Banner (Explicit requirement: state that it's a demo, do NOT say an email was sent) */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs sm:text-sm flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold">Aclaración de demostración técnica:</strong>
            <p className="text-amber-800 leading-relaxed">
              Esta pantalla es una simulación visual creada para la propuesta de rediseño de MMZ Socks. 
              <strong> No se ha enviado ningún correo electrónico real a la fábrica</strong> ni se ha formalizado ningún pedido.
            </p>
          </div>
        </div>

        {/* Summary Card with Sock Snapshot & Specs */}
        <div className="bg-ice rounded-2xl p-4 sm:p-5 border border-slate-200/90 space-y-4 mb-6">
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
            <span className="text-xs font-bold text-petrol uppercase tracking-wider">
              Resumen de la configuración 3D
            </span>
            {pricing && (
              <span className="text-sm font-extrabold text-turquoise">
                {pricing.pricePerPair.toFixed(2)} € / par
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-12 gap-4 items-center">
            
            {/* Sock Preview Image */}
            <div className="sm:col-span-5 bg-white rounded-xl p-2 border border-slate-200 flex items-center justify-center aspect-square overflow-hidden">
              {data.snapshotUrl ? (
                <img
                  src={data.snapshotUrl}
                  alt="Vista previa del calcetín configurado en 3D"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-4 text-xs text-slate-400">
                  <Sparkles className="w-8 h-8 mx-auto text-turquoise mb-1" />
                  <span>Calcetín 3D teñido</span>
                </div>
              )}
            </div>

            {/* Spec Details */}
            <div className="sm:col-span-7 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Material:</span>
                <span className="font-bold text-petrol">{materialName}</span>
              </div>
              {config && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Volumen:</span>
                  <span className="font-bold text-petrol">{config.quantity} pares</span>
                </div>
              )}
              {config && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Hilaturas:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: config.cuffColor }}
                      title="Puño"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: config.legColor }}
                      title="Caña"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300"
                      style={{ backgroundColor: config.footColor }}
                      title="Pie"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-400"
                      style={{ backgroundColor: data.config?.heelToeColor || '#151522' }}
                      title="Refuerzo Talón/Puntera fijo"
                    />
                  </div>
                </div>
              )}
              {config && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Logotipo:</span>
                  <span className="font-semibold text-petrol">
                    {config.logo.url ? (config.logo.repeatBack ? 'Ambas caras' : 'Frontal') : 'Sin logo'}
                  </span>
                </div>
              )}
              {pricing && (
                <div className="pt-2 border-t border-slate-200/80 flex justify-between font-bold text-petrol">
                  <span>Total estimado (+ IVA):</span>
                  <span className="text-turquoise text-sm">
                    {pricing.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-6 rounded-2xl bg-petrol hover:bg-turquoise text-white font-bold text-sm shadow-md transition-all duration-200"
        >
          Cerrar demostración
        </button>

      </div>
    </div>
  );
};
