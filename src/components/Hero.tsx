import React from 'react';
import { ArrowRight, ShieldCheck, Sparkles, MapPin, CheckCircle2 } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-6 pb-16 sm:pt-12 sm:pb-24 overflow-hidden">
      {/* Subtle organic light turquoise glow background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-turquoise/15 to-yarn-mustard/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            
            {/* Elegant Sub-badge with Playfair italic */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ice border border-petrol/10 shadow-xs">
              <MapPin className="w-4 h-4 text-turquoise" aria-hidden="true" />
              <span className="font-serif-italic text-sm sm:text-base text-petrol font-medium">
                Fábrica de calcetines en Pradoluengo
              </span>
            </div>

            {/* Unique Single H1 */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-petrol-dark tracking-tight leading-[1.12]">
              Calcetines personalizados para tu marca,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-turquoise via-petrol to-turquoise-dark">
                club o evento
              </span>
            </h1>

            {/* Short Paragraph */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
              Tejemos tu identidad con materiales certificados y confección sin costuras. 
              Tradición textil en Pradoluengo al servicio de tus proyectos, con ajuste perfecto y calidad profesional.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <a
                href="#configurador"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 text-base font-bold text-white bg-petrol hover:bg-turquoise rounded-2xl shadow-float hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Sparkles className="w-5 h-5 text-yarn-mustard" />
                <span>Diseña tu calcetín</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#artesanos"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-semibold text-petrol bg-ice hover:bg-slate-100 rounded-2xl border border-slate-200/80 transition-all duration-200"
              >
                <span>Conócenos</span>
              </a>
            </div>

            {/* Badges / Sellos */}
            <div className="pt-4 border-t border-slate-200/70 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs sm:text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-yarn-green" />
                <span className="font-semibold text-petrol-dark">Fabricados en España</span>
              </div>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-turquoise" />
                <span className="font-semibold text-petrol-dark">Sin costuras</span>
              </div>
              <span className="text-slate-300 hidden sm:inline">·</span>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-yarn-coral" />
                <span className="font-semibold text-petrol-dark">Pedidos desde 50 pares</span>
              </div>
            </div>

          </div>

          {/* Right Column: High Quality Realistic Photo with Floating Badges */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Outer decorative ring */}
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-petrol/20 to-turquoise/30 opacity-70 blur-lg -z-10" />

              <div className="relative rounded-3xl overflow-hidden shadow-float border-4 border-white bg-slate-100">
                <img
                  src="/images/hero-fabrica.webp"
                  alt="Instalaciones de tejeduría circular en Pradoluengo con conos de hilo y luz turquesa"
                  width="800"
                  height="450"
                  loading="eager"
                  className="w-full h-auto object-cover aspect-[4/3] transform hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-petrol-dark/70 via-transparent to-transparent" />
                
                <div className="absolute bottom-4 left-4 right-4 text-white p-3 backdrop-blur-sm bg-petrol/40 rounded-xl border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-semibold text-turquoise-light">
                        Pradoluengo (Burgos)
                      </p>
                      <p className="text-sm font-bold">
                        Fábrica de calcetines personalizados
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Pill Badge */}
              <div className="absolute -top-4 -left-3 sm:-left-6 bg-white rounded-2xl p-3 shadow-float border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ice flex items-center justify-center text-turquoise">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Garantía de confort</p>
                  <p className="text-xs font-bold text-petrol">Puntera plana anti-rozaduras</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
