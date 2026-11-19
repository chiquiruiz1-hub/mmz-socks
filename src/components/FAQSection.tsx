import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: '¿El precio mostrado en el configurador 3D es orientativo o definitivo?',
      a: 'Es un precio orientativo de ejemplo basado en tramos de cantidad y materiales. Al solicitar el presupuesto, la fábrica en Pradoluengo revisa los detalles específicos del logotipo y los hilos para confirmar el importe final.'
    },
    {
      q: '¿Por qué el talón y la puntera son siempre de color gris pizarra fijo?',
      a: 'Se trata de un refuerzo técnico para ofrecer mayor resistencia al roce y al uso en las zonas de mayor impacto. Mantenerlos en un tono pizarra homogéneo permite garantizar la durabilidad y estabilidad de la prenda.'
    },
    {
      q: '¿En qué formato debo enviar el logotipo de mi empresa o club?',
      a: 'Aceptamos formatos vectoriales (.SVG, .AI, .PDF) y mapas de bits en buena resolución (.PNG, .JPG o .WebP). El equipo de fábrica adapta las líneas a la matriz de agujas para su correcto tejido.'
    },
    {
      q: '¿Cuántos colores de hilo puede tener un calcetín personalizado?',
      a: 'Nuestros telares admiten varios colores de hilo simultáneos. El simulador incluye una base de color y prevé un suplemento técnico a partir del tercer color para ajustar la configuración de hilaturas.'
    },
    {
      q: '¿Cuáles son los plazos habituales de fabricación y entrega?',
      a: 'Los plazos de producción se acuerdan y confirman con la fábrica al validar el diseño definitivo, en función del volumen solicitado y la planificación del taller.'
    },
    {
      q: '¿Cuál es el pedido mínimo para fabricar calcetines personalizados?',
      a: 'El pedido mínimo en MMZ Socks es de 10 pares por diseño, lo que facilita a marcas, clubes, empresas y colectivos acceder a fabricación personalizada sin requerir grandes tiradas.'
    }
  ];

  return (
    <section id="faq" className="py-20 sm:py-28 bg-ice relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-14 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-turquoise text-xs font-bold uppercase tracking-wider mb-3 shadow-xs">
            <HelpCircle className="w-3.5 h-3.5" /> Respuestas Claras
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Preguntas frecuentes sobre la fabricación
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600">
            Información sobre el proceso de confección y pedidos en Pradoluengo (Burgos).
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.q}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-soft overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:ring-2 focus:ring-turquoise focus:outline-none"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="font-bold text-petrol-dark text-base sm:text-lg">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-ice flex items-center justify-center text-petrol flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 bg-turquoise text-white' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    className="px-5 pb-5 sm:px-6 sm:pb-6 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-3 animate-fadeIn"
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions hint */}
        <div className="mt-10 text-center p-6 bg-white rounded-3xl border border-slate-200/80 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <h3 className="font-bold text-petrol-dark text-base">¿Tienes una consulta técnica sobre tu diseño?</h3>
            <p className="text-xs sm:text-sm text-slate-500">Contacta directamente con la fábrica por teléfono o WhatsApp.</p>
          </div>
          <a
            href="https://wa.me/34627588488"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-petrol hover:bg-turquoise text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-xs flex-shrink-0"
          >
            Consultar a la fábrica
          </a>
        </div>

      </div>
    </section>
  );
};
