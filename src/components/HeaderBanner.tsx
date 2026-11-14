import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

export const HeaderBanner: React.FC = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <aside aria-label="Aviso de propuesta de rediseño" className="bg-petrol-dark text-slate-200 text-xs sm:text-sm py-2 px-4 transition-all duration-300 border-b border-petrol/40 relative z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 mx-auto text-center">
          <span className="inline-flex items-center justify-center p-1 bg-turquoise/20 text-turquoise-light rounded-full">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <p className="font-medium tracking-wide">
            <span className="font-semibold text-white">Propuesta de rediseño no oficial</span>
            <span className="mx-2 opacity-60">·</span>
            <span className="text-slate-300">Precios orientativos y textos de demostración técnica</span>
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-petrol/60 transition-colors focus:ring-2 focus:ring-turquoise"
          aria-label="Cerrar aviso de propuesta"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
