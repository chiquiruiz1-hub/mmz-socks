import React from 'react';
import { ArrowRight, Building2, Trophy, Users, Footprints } from 'lucide-react';

export const ClientsSection: React.FC = () => {
  const cards = [
    {
      title: 'Empresas y marcas',
      subtitle: 'Merchandising corporativo prémium',
      desc: 'Kits de bienvenida para nuevos empleados, regalos para congresos y acciones de fidelización con calidad que refuerza tu imagen de marca.',
      image: '/images/pack-regalo-empresa.webp',
      alt: 'Pack de regalo corporativo con calcetines personalizados en caja de cartón kraft',
      icon: Building2,
      tag: 'Empresas',
      tagColor: 'bg-petrol text-white'
    },
    {
      title: 'Eventos y carreras',
      subtitle: 'Deporte popular y competiciones',
      desc: 'El obsequio favorito de corredores y deportistas. Calcetín técnico transpirable con ajuste ergonómico y gran visibilidad.',
      image: '/images/carrera-popular.webp',
      alt: 'Corredores con calcetines técnicos a juego en una carrera popular',
      icon: Trophy,
      tag: 'Carreras',
      tagColor: 'bg-yarn-coral text-white'
    },
    {
      title: 'Clubes deportivos y peñas',
      subtitle: 'Identidad y colores de equipo',
      desc: 'Para clubes de fútbol, baloncesto, atletismo, senderismo y peñas populares. Teñimos tus colores oficiales con tu escudo o lema nítidamente integrado.',
      image: '/images/calcetin-personalizado.webp',
      alt: 'Calcetines tejidos con diseño jacquard personalizado para equipos',
      icon: Users,
      tag: 'Equipos',
      tagColor: 'bg-turquoise text-white'
    },
    {
      title: 'Calcetines barefoot',
      subtitle: 'Horma ancha y movimiento natural',
      desc: 'Diseñados específicamente para calzado respetuoso: puntera anatómicamente espaciosa para permitir la expansión libre de los dedos sin fricción.',
      image: '/images/detalle-puno.webp',
      alt: 'Detalle de tejido y elasticidad anatómica para calcetines barefoot',
      icon: Footprints,
      tag: 'Barefoot',
      tagColor: 'bg-yarn-green text-white'
    }
  ];

  return (
    <section id="clientes" className="py-20 sm:py-28 bg-ice relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            Soluciones a medida para cada sector
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Para quién tejemos calcetines en MMZ Socks
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Desde tiradas de 10 pares para una peña de amigos hasta grandes producciones anuales para marcas de moda o circuitos deportivos nacionales.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="bg-white rounded-3xl overflow-hidden shadow-soft border border-slate-200/80 hover:shadow-float hover:-translate-y-1.5 transition-all duration-300 flex flex-col group"
              >
                {/* Photo Header */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <img
                    src={c.image}
                    alt={c.alt}
                    width="400"
                    height="300"
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs ${c.tagColor}`}>
                      {c.tag}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-turquoise">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {c.subtitle}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-petrol-dark leading-snug">
                      {c.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {c.desc}
                    </p>
                  </div>

                  {/* Button to Configurator */}
                  <div className="pt-3 border-t border-slate-100">
                    <a
                      href="#configurador"
                      className="inline-flex items-center gap-2 text-xs font-bold text-petrol hover:text-turquoise group-hover:translate-x-1 transition-all"
                    >
                      <span>Personalizar en el 3D</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
