import React from 'react';
import { Layers, Palette, Cpu, CheckCircle } from 'lucide-react';

export const ArtisansSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Elige tus materiales',
      desc: 'Selecciona entre algodón peinado, algodón orgánico, fibra de bambú o lana merino, con materiales certificados.',
      icon: Layers,
      color: 'text-turquoise',
      bgColor: 'bg-turquoise/10',
      borderAccent: 'border-turquoise/30'
    },
    {
      num: '02',
      title: 'Personaliza a tu gusto',
      desc: 'Combina los colores para el puño, la caña y el pie. Añade el logotipo de tu marca, peña o club y previsualízalo en 3D.',
      icon: Palette,
      color: 'text-yarn-mustard',
      bgColor: 'bg-yarn-mustard/15',
      borderAccent: 'border-yarn-mustard/40'
    },
    {
      num: '03',
      title: 'Fabricación artesanal',
      desc: 'Fabricados en Pradoluengo con puntera sin costuras para garantizar la máxima comodidad y ajuste perfecto.',
      icon: Cpu,
      color: 'text-yarn-coral',
      bgColor: 'bg-yarn-coral/15',
      borderAccent: 'border-yarn-coral/40'
    }
  ];

  return (
    <section id="artesanos" className="py-20 sm:py-28 bg-ice relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            Tradición textil en Pradoluengo
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Artesanos del calcetín
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Pradoluengo cuenta con una arraigada tradición en la confección de calcetines.
            En MMZ Socks unimos experiencia técnica y personalización cuidada en cada par.
          </p>
        </div>

        {/* 3 Steps with dashed connectors */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
          
          {/* Subtle connecting dotted line for desktop */}
          <div className="hidden md:block absolute top-1/2 left-[18%] right-[18%] -translate-y-8 border-t-2 border-dashed border-petrol/20 -z-0 pointer-events-none" />

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="relative bg-white rounded-3xl p-8 shadow-soft border border-slate-200/80 hover:shadow-float hover:-translate-y-1 transition-all duration-300 z-10 flex flex-col items-start group"
              >
                {/* Step badge */}
                <div className="w-full flex items-center justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl ${step.bgColor} flex items-center justify-center ${step.color} shadow-xs group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="text-3xl font-black text-slate-200 group-hover:text-petrol/20 transition-colors">
                    {step.num}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-petrol-dark mb-3">
                  {step.title}
                </h3>
                
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.desc}
                </p>

                {/* Hand-drawn style decorative arrow indicator for steps 1 and 2 */}
                {idx < 2 && (
                  <div className="hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-dashed border-turquoise items-center justify-center text-turquoise z-20 shadow-sm">
                    <span className="text-xs font-bold font-mono">→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mini highlight with flatlay photo */}
        <div className="mt-14 bg-white rounded-3xl p-6 sm:p-8 shadow-soft border border-slate-200/80 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
          <div className="w-full md:w-1/3 rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100 flex-shrink-0">
            <img
              src="/images/calcetines-flatlay.webp"
              alt="Muestrario de calcetines personalizados en Pradoluengo"
              width="400"
              height="300"
              loading="lazy"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-turquoise/10 text-turquoise text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5" /> Materiales certificados
            </div>
            <h3 className="text-xl font-bold text-petrol-dark">
              Sin costuras y con ajuste perfecto
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Calcetines confeccionados sin costuras en la puntera para evitar molestias y rozaduras, ofreciendo confort y durabilidad tanto para uso diario como deportivo.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
