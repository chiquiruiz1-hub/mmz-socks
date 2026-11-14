import React from 'react';
import { MapPin, Award, Leaf, HeartHandshake, Check } from 'lucide-react';

export const FactorySection: React.FC = () => {
  const pillars = [
    {
      icon: MapPin,
      title: 'Ubicación tradicional',
      subtitle: 'Pradoluengo, Burgos',
      desc: 'Enclavados en la histórica villa textil de Pradoluengo, referente del calcetín en la provincia de Burgos, aunando conocimiento artesanal y medios modernos.',
      color: 'text-turquoise',
      bgColor: 'bg-turquoise/10',
      tag: 'Tradición local'
    },
    {
      icon: Award,
      title: 'Materiales certificados',
      subtitle: 'Calidad y confort',
      desc: 'Trabajamos con materiales certificados cuidadosamente seleccionados: algodón peinado, algodón orgánico, fibra de bambú y lana merino para un tacto suave y duradero.',
      color: 'text-yarn-mustard',
      bgColor: 'bg-yarn-mustard/15',
      tag: 'Materiales certificados'
    },
    {
      icon: Leaf,
      title: 'Producción sostenible',
      subtitle: 'Compromiso y proximidad',
      desc: 'Fabricación local a demanda en Pradoluengo para optimizar el consumo de materia prima, minimizando traslados innecesarios y apoyando la economía de proximidad.',
      color: 'text-yarn-green',
      bgColor: 'bg-yarn-green/15',
      tag: 'Sostenibilidad'
    },
    {
      icon: HeartHandshake,
      title: 'Pasión por lo artesanal',
      subtitle: 'Cuidado del detalle',
      desc: 'Cada modelo se configura y teje con atención en cada detalle, logrando un acabado sin costuras que se adapta de manera idónea al pie.',
      color: 'text-yarn-coral',
      bgColor: 'bg-yarn-coral/15',
      tag: 'Ajuste perfecto'
    }
  ];

  return (
    <section id="fabrica" className="py-20 sm:py-28 bg-ice relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            Nuestra fábrica en Pradoluengo, Burgos
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Tradición textil y producción personalizada
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Fabricamos calcetines a medida directamente en Pradoluengo (Burgos), combinando calidad, innovación y cercanía en cada proyecto.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white rounded-3xl p-6 sm:p-7 shadow-soft border border-slate-200/90 hover:shadow-float hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl ${item.bgColor} flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-petrol-dark mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs font-semibold text-turquoise mb-3">
                    {item.subtitle}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-petrol">
                  <Check className="w-4 h-4 text-turquoise" />
                  <span>Hechos en Pradoluengo</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Storytelling Banner */}
        <div className="mt-14 rounded-3xl bg-white overflow-hidden shadow-soft border border-slate-200/80 grid md:grid-cols-12 items-center">
          <div className="md:col-span-5 aspect-[4/3] md:aspect-auto h-full">
            <img
              src="/images/conos-hilo.webp"
              alt="Bobinas de hilatura en la fábrica de MMZ Socks en Pradoluengo"
              width="600"
              height="450"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:col-span-7 p-6 sm:p-10 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-turquoise bg-turquoise/10 px-3 py-1 rounded-full">
              Tradición de Pradoluengo
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-petrol-dark">
              Compromiso con el trabajo textil local
            </h3>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Pradoluengo es una localidad con un arraigo singular en la elaboración de calcetines. En MMZ Socks desarrollamos cada encargo con materiales de calidad, confección sin costuras y atención personalizada para marcas, empresas, clubes y colectivos.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};
