import React, { useState } from 'react';
import { MapPin, Mail, Phone } from 'lucide-react';

export const Footer: React.FC = () => {
  const [legalModalContent, setLegalModalContent] = useState<{ title: string; text: string } | null>(null);

  const openLegalModal = (title: string, text: string) => {
    setLegalModalContent({ title, text });
  };

  return (
    <footer className="bg-petrol-dark text-slate-300 pt-16 pb-12 border-t border-petrol/60 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-700/60">
          
          {/* Brand Info */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-turquoise flex items-center justify-center text-white font-extrabold text-lg">
                M
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-white">
                MMZ <span className="font-medium text-turquoise-light">SOCKS</span>
              </span>
            </div>
            
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Fábrica tradicional y moderna de calcetines personalizados en Pradoluengo (Burgos). 
              Tejeduría jacquard sin costuras para marcas, peñas, empresas y deporte.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-4 h-4 text-turquoise" />
              <span>C/ Sagrada Familia 2, 09260 Pradoluengo (Burgos)</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-white font-bold text-sm uppercase tracking-wider">
              Navegación
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#artesanos" className="hover:text-turquoise-light transition-colors">
                  Artesanía y tradición
                </a>
              </li>
              <li>
                <a href="#configurador" className="text-turquoise-light font-semibold hover:underline">
                  Configurador 3D en vivo
                </a>
              </li>
              <li>
                <a href="#fabrica" className="hover:text-turquoise-light transition-colors">
                  Nuestra fábrica
                </a>
              </li>
              <li>
                <a href="#calidad" className="hover:text-turquoise-light transition-colors">
                  Detalles de calidad
                </a>
              </li>
              <li>
                <a href="#clientes" className="hover:text-turquoise-light transition-colors">
                  Empresas, eventos y barefoot
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-turquoise-light transition-colors">
                  Preguntas frecuentes
                </a>
              </li>
              <li>
                <a href="#contacto" className="hover:text-turquoise-light transition-colors">
                  Presupuestos
                </a>
              </li>
            </ul>
          </div>

          {/* Direct Contacts & Factory Notice */}
          <div className="lg:col-span-4 space-y-3">
            <h4 className="text-white font-bold text-sm uppercase tracking-wider">
              Contacto de Fábrica
            </h4>
            <div className="space-y-2 text-sm text-slate-400">
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-turquoise" />
                <a href="mailto:info@mmzsocks.com" className="hover:text-white transition-colors">
                  info@mmzsocks.com
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-turquoise" />
                <a href="tel:+34627588488" className="hover:text-white font-medium">
                  +34 627 588 488
                </a>
              </p>
              <p className="text-xs text-slate-500 pt-2 leading-relaxed">
                Horario: a confirmar por la fábrica. Atención directa desde Pradoluengo (Burgos).
              </p>
            </div>
          </div>

        </div>

        {/* Legal Disclaimer Box */}
        <div className="my-8 p-4 rounded-2xl bg-petrol/40 border border-slate-700/70 text-xs text-slate-400 text-center leading-relaxed">
          <p>
            <strong className="text-white">Aviso de demostración técnica:</strong> Esta web es una propuesta de rediseño profesional no oficial elaborada con fines conceptuales y de presentación para el titular de la marca MMZ Socks en Pradoluengo (Burgos). Los precios, logotipos de ejemplo y cotizaciones son simulaciones orientativas.
          </p>
        </div>

        {/* Bottom Legal Links & Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-4">
          <p>
            © {new Date().getFullYear()} MMZ Socks. Todos los derechos reservados. Fabricado en Pradoluengo (Burgos).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <button
              onClick={() =>
                openLegalModal(
                  'Aviso Legal',
                  'En cumplimiento con el artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y Comercio Electrónico (LSSI-CE), se hace constar que MMZ Socks opera con sede en C/ Sagrada Familia 2, 09260 Pradoluengo (Burgos). Todos los contenidos mostrados en este prototipo son de carácter demostrativo.'
                )
              }
              className="hover:text-slate-300 transition-colors"
            >
              Aviso legal
            </button>
            <button
              onClick={() =>
                openLegalModal(
                  'Política de Privacidad',
                  'De conformidad con el Reglamento General de Protección de Datos (RGPD) y la LOPD-GDD, los datos de contacto introducidos en el formulario de solicitud se procesan en estricto cumplimiento con la normativa europea, sin cesión a terceros ni finalidades comerciales no autorizadas.'
                )
              }
              className="hover:text-slate-300 transition-colors"
            >
              Política de privacidad
            </button>
            <button
              onClick={() =>
                openLegalModal(
                  'Política de Cookies',
                  'Este sitio web utiliza cookies técnicas indispensables para el funcionamiento del renderizador 3D y el almacenamiento de preferencias de diseño en local. No se emplean cookies de rastreo publicitario intrusivo.'
                )
              }
              className="hover:text-slate-300 transition-colors"
            >
              Política de cookies
            </button>
            <button
              onClick={() =>
                openLegalModal(
                  'Declaración de Accesibilidad',
                  'Nos comprometemos a garantizar la accesibilidad digital para personas con discapacidad, aplicando las directrices WCAG 2.1 nivel AA: navegación por teclado con foco visible, contraste de color verificado, textos alternativos descriptivos y soporte para prefers-reduced-motion.'
                )
              }
              className="hover:text-slate-300 transition-colors"
            >
              Declaración de accesibilidad
            </button>
          </div>
        </div>

      </div>

      {/* Legal Info Modal */}
      {legalModalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white text-slate-800 p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-float border border-slate-200 animate-fadeIn">
            <h3 className="text-xl font-bold text-petrol mb-3">{legalModalContent.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{legalModalContent.text}</p>
            <div className="text-right">
              <button
                onClick={() => setLegalModalContent(null)}
                className="px-5 py-2.5 bg-petrol text-white rounded-xl text-sm font-bold hover:bg-turquoise transition-colors"
              >
                Entendido y cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
