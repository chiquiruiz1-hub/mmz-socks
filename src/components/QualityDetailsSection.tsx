import React from 'react';
import { 
  Feather, 
  Smile, 
  Palette, 
  Gem, 
  ShieldCheck, 
  Leaf, 
  Heart, 
  Clock 
} from 'lucide-react';

export const QualityDetailsSection: React.FC = () => {
  const pointsLeft = [
    {
      icon: Feather,
      title: 'Sin costuras',
      desc: 'Acabado plano en la puntera para evitar molestias y rozaduras en cada paso.'
    },
    {
      icon: Smile,
      title: 'Ajuste perfecto',
      desc: 'Estructura elástica equilibrada que se mantiene en su sitio durante toda la jornada.'
    },
    {
      icon: Palette,
      title: 'Diseño exclusivo',
      desc: 'Tejido jacquard donde tus colores y logotipo se integran en la propia trama del calcetín.'
    },
    {
      icon: Gem,
      title: 'Materiales premium',
      desc: 'Materiales certificados de tacto suave, pensados para un uso duradero y confortable.'
    }
  ];

  const pointsRight = [
    {
      icon: ShieldCheck,
      title: 'Fabricados en España',
      desc: 'Fabricados en Pradoluengo (Burgos), cuna histórica del calcetín en la península.'
    },
    {
      icon: Leaf,
      title: 'Sostenibilidad',
      desc: 'Producción personalizada a demanda para un uso consciente de los recursos textiles.'
    },
    {
      icon: Heart,
      title: 'Sin presión',
      desc: 'Puño diseñado para una sujeción cómoda que no oprime ni deja marcas en la pierna.'
    },
    {
      icon: Clock,
      title: 'Servicio rápido',
      desc: 'Atención ágil y seguimiento directo desde el taller durante todo el proceso de pedido.'
    }
  ];

  return (
    <section id="calidad" className="py-20 sm:py-28 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            La anatomía del calcetín bien hecho
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            La calidad en cada detalle
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Cuidamos cada aspecto de la prenda para que tus pies disfruten de confort, ligereza y durabilidad en cualquier actividad.
          </p>
        </div>

        {/* 8 Points around Tilted Photo */}
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Left 4 Points */}
          <div className="lg:col-span-4 space-y-6 sm:space-y-8">
            {pointsLeft.map((pt) => {
              const Icon = pt.icon;
              return (
                <div key={pt.title} className="flex items-start gap-4 text-left group">
                  <div className="w-12 h-12 rounded-2xl bg-ice flex items-center justify-center text-turquoise group-hover:bg-turquoise group-hover:text-white transition-colors flex-shrink-0 shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-petrol-dark mb-1">
                      {pt.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {pt.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center: Tilted Photo with Badge */}
          <div className="lg:col-span-4 flex justify-center py-4 my-2 lg:my-0">
            <div className="relative max-w-xs sm:max-w-sm w-full">
              
              <div className="absolute inset-0 bg-petrol/10 rounded-3xl transform rotate-3 scale-102 -z-10" />

              <div className="relative rounded-3xl overflow-hidden shadow-float border-4 border-white bg-slate-100 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                <img
                  src="/images/control-calidad.webp"
                  alt="Inspección y control de calidad de calcetín en MMZ Socks"
                  width="400"
                  height="500"
                  loading="lazy"
                  className="w-full h-auto object-cover aspect-[4/5]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-petrol-dark/80 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-turquoise-light bg-petrol-dark/80 px-2.5 py-1 rounded-full backdrop-blur-sm">
                    Revisión de calidad
                  </span>
                  <p className="text-sm font-bold mt-1.5 leading-snug">
                    Comprobación de acabados y dimensiones antes de la entrega
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* Right 4 Points */}
          <div className="lg:col-span-4 space-y-6 sm:space-y-8">
            {pointsRight.map((pt) => {
              const Icon = pt.icon;
              return (
                <div key={pt.title} className="flex items-start gap-4 text-left group">
                  <div className="w-12 h-12 rounded-2xl bg-ice flex items-center justify-center text-petrol group-hover:bg-petrol group-hover:text-white transition-colors flex-shrink-0 shadow-xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-petrol-dark mb-1">
                      {pt.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {pt.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
};
