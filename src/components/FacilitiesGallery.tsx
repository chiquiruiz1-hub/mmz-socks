import React from 'react';

export const FacilitiesGallery: React.FC = () => {
  const images = [
    {
      src: '/images/hero-fabrica.webp',
      alt: 'Nave de tejeduría circular en Pradoluengo (Burgos)',
      title: 'Planta de tejeduría circular',
      desc: 'Maquinaria textil para la confección personalizada de calcetines.'
    },
    {
      src: '/images/conos-hilo.webp',
      alt: 'Estanterías con bobinas de hilo de colores en el taller de Pradoluengo',
      title: 'Materiales e hilaturas',
      desc: 'Amplia gama de colores de hilatura para adaptarse a tu imagen de marca.'
    },
    {
      src: '/images/control-calidad.webp',
      alt: 'Control de calidad y revisión de calcetines en Pradoluengo',
      title: 'Revisión y control de calidad',
      desc: 'Comprobación de medidas, elasticidad y acabados en cada partida.'
    },
    {
      src: '/images/detalle-puno.webp',
      alt: 'Detalle de tejido y puño elástico sin costuras',
      title: 'Acabados y tejido sin costuras',
      desc: 'Punto acanalado y puntera suave para un ajuste anatómico sin presión.'
    },
    {
      src: '/images/calcetines-flatlay.webp',
      alt: 'Calcetines personalizados fabricados en Pradoluengo',
      title: 'Variedad de modelos',
      desc: 'Opciones de color y diseño para empresas, carreras populares y clubes.'
    },
    {
      src: '/images/pack-regalo-empresa.webp',
      alt: 'Presentación y empaquetado de calcetines en caja',
      title: 'Empaquetado y presentación',
      desc: 'Cuidado en la preparación final para entrega a clientes o eventos.'
    }
  ];

  return (
    <section id="instalaciones" className="py-20 sm:py-28 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            Nuestras instalaciones
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Instalaciones en Pradoluengo (Burgos)
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Un vistazo a nuestro entorno de trabajo en Pradoluengo, donde la experiencia textil se une a la confección a medida.
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {images.map((img) => (
            <div
              key={img.title}
              className="group relative rounded-3xl overflow-hidden bg-slate-100 shadow-soft border border-slate-200/80 hover:shadow-float transition-all duration-300"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={img.src}
                  alt={img.alt}
                  width="400"
                  height="300"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
                />
              </div>

              {/* Gradient Overlay & Text */}
              <div className="absolute inset-0 bg-gradient-to-t from-petrol-dark/90 via-petrol-dark/30 to-transparent opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6 text-white">
                <div className="transform sm:translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-turquoise-light mb-1 block">
                    MMZ Socks
                  </span>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {img.title}
                  </h3>
                  <p className="text-xs text-slate-200 line-clamp-2">
                    {img.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
