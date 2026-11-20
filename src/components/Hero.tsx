import React from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { FabricBg } from './FabricBg';

const TICKER = ['Pradoluengo · Burgos', '100% fabricado en España', 'Sin costuras', 'Tu logo, tejido', 'Calcetines a medida', 'Tejeduría circular'];

/** Ovillo: de aquí sale el hilo que recorre toda la página. */
const Ovillo: React.FC = () => (
  <svg id="ovillo" viewBox="0 0 200 200" className="w-full h-full overflow-visible" aria-hidden="true">
    <defs>
      <radialGradient id="ov-g" cx=".35" cy=".3" r=".9">
        <stop offset="0" stopColor="#F7D57E" /><stop offset=".55" stopColor="#E3A83A" /><stop offset="1" stopColor="#B9761F" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="88" fill="url(#ov-g)" />
    <g fill="none" stroke="#8A5513" strokeOpacity=".45" strokeWidth="2.2" strokeLinecap="round">
      <path d="M22 80 C70 120, 130 40, 180 90" /><path d="M18 108 C70 150, 130 70, 184 118" />
      <path d="M30 140 C80 170, 120 100, 170 146" /><path d="M40 52 C90 90, 120 30, 160 60" />
      <path d="M60 24 C70 90, 110 130, 90 184" /><path d="M120 22 C140 80, 150 120, 128 182" />
    </g>
    <ellipse cx="72" cy="62" rx="30" ry="16" fill="#fff" opacity=".28" transform="rotate(-25 72 62)" />
  </svg>
);

export const Hero: React.FC = () => (
  <section className="relative isolate overflow-hidden bg-petrol-900 text-white mmz-grain -mt-px">
    <FabricBg className="absolute inset-0 -z-10 w-full h-full" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0A1A23]/90 via-[#0A1A23]/55 to-transparent lg:to-transparent" />
    <div className="absolute inset-x-0 bottom-0 h-32 -z-10 bg-gradient-to-t from-[#0A1A23] to-transparent" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-16 sm:pt-24 sm:pb-24">
      <div className="grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 text-center lg:text-left">
          <div className="mmz-rise inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15" style={{ animationDelay: '.05s' }}>
            <MapPin className="w-4 h-4 text-yarn-mustard" aria-hidden="true" />
            <span className="text-sm text-white/85">Fábrica de calcetines en Pradoluengo</span>
          </div>
          <h1 className="mmz-rise font-display font-bold tracking-tight leading-[1.02] mt-6 text-[2.6rem] sm:text-6xl lg:text-7xl" style={{ animationDelay: '.15s' }}>
            Calcetines personalizados para tu marca,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yarn-mustard via-yarn-coral to-yarn-mustard">club o evento</span>
          </h1>
          <p className="mmz-rise mt-6 text-base sm:text-lg text-white/70 max-w-xl mx-auto lg:mx-0 leading-relaxed" style={{ animationDelay: '.3s' }}>
            Esto es tela de verdad, tejida punto a punto. Pasa el ratón o el dedo por encima y mira cómo se estira y reacciona.
          </p>
          <div className="mmz-rise flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 mt-8" style={{ animationDelay: '.45s' }}>
            <a href="#configurador" className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 text-base font-bold text-petrol-900 bg-yarn-mustard hover:bg-white rounded-2xl shadow-[0_0_40px_rgba(242,193,78,.35)] transition-all duration-300 hover:-translate-y-0.5">
              <span>Diseña tu calcetín</span><ArrowRight className="w-4 h-4" />
            </a>
            <a href="#artesanos" className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-4 text-base font-semibold text-white border border-white/25 hover:bg-white/10 rounded-2xl transition">Conócenos</a>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center mmz-rise" style={{ animationDelay: '.35s' }}>
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 animate-[spin_40s_linear_infinite] motion-reduce:animate-none drop-shadow-[0_30px_50px_rgba(0,0,0,.5)]">
            <Ovillo />
          </div>
        </div>
      </div>
      <p className="mt-10 text-center text-xs tracking-[.3em] uppercase text-white/40 animate-pulse" aria-hidden="true">Toca la tela · baja y entra en la fábrica ↓</p>
    </div>

    <div className="border-y border-white/10 bg-black/20 overflow-hidden" aria-hidden="true">
      <div className="mmz-marquee flex w-max whitespace-nowrap py-3 font-display text-sm tracking-[.25em] uppercase text-white/60">
        {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((t, i) => (
          <span key={i} className="px-8">{t} <span className="text-yarn-mustard">✦</span></span>
        ))}
      </div>
    </div>
  </section>
);
