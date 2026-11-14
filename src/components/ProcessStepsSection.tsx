import React from 'react';
import { MonitorPlay, ClipboardCheck, Factory, ArrowRight } from 'lucide-react';

export const ProcessStepsSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Diseñas en la web',
      desc: 'Selecciona materiales certificados, configura los colores de puño, caña y pie, y añade tu logotipo en el simulador 3D para ver el presupuesto orientativo al momento.',
      icon: MonitorPlay,
      color: 'text-turquoise',
      bgIcon: 'bg-turquoise/10'
    },
    {
      num: '02',
      title: 'La fábrica lo revisa',
      desc: 'Revisamos en Pradoluengo la viabilidad técnica del diseño y del hilado para que el logotipo mantenga nitidez y proporciones en el tejido real.',
      icon: ClipboardCheck,
      color: 'text-yarn-mustard',
      bgIcon: 'bg-yarn-mustard/15'
    },
    {
      num: '03',
      title: 'Aprobamos y fabricamos',
      desc: 'Confirmado el diseño y las cantidades, programamos la fabricación en Pradoluengo, verificamos la calidad del pedido y gestionamos la entrega.',
      icon: Factory,
      color: 'text-yarn-green',
      bgIcon: 'bg-yarn-green/15'
    }
  ];

  return (
    <section id="pasos" className="py-20 sm:py-28 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            Paso a paso sin sorpresas
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Diseño y fabricación: así convertimos tu idea en calcetines reales
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Un proceso ágil, transparente y con asesoramiento directo desde nuestras instalaciones en Pradoluengo (Burgos).
          </p>
        </div>

        {/* 3 Step Cards with Connectors */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          
          {steps.map((st, i) => {
            const Icon = st.icon;
            return (
              <div
                key={st.num}
                className="relative bg-ice rounded-3xl p-8 border border-slate-200/90 shadow-soft hover:shadow-float hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-14 h-14 rounded-2xl ${st.bgIcon} flex items-center justify-center ${st.color} shadow-xs group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="text-4xl font-black text-slate-200 group-hover:text-petrol/20 transition-colors">
                      {st.num}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-petrol-dark mb-3">
                    {st.title}
                  </h3>
                  
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {st.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center gap-1.5 text-xs font-bold text-petrol">
                  <span>Proceso de taller</span>
                  <span className="text-turquoise">✓</span>
                </div>

                {i < 2 && (
                  <div className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-300 items-center justify-center text-slate-600 z-10 shadow-xs">
                    <ArrowRight className="w-4 h-4 text-petrol" />
                  </div>
                )}
              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
};
