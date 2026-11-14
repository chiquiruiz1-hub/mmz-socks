import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowRight, Sparkles } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Artesanía', href: '#artesanos' },
    { name: 'Diseñador 3D', href: '#configurador', highlight: true },
    { name: 'Nuestra Fábrica', href: '#fabrica' },
    { name: 'Calidad', href: '#calidad' },
    { name: 'Sectores', href: '#clientes' },
    { name: 'Proceso', href: '#pasos' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Contacto', href: '#contacto' }
  ];

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-6 w-full max-w-7xl mx-auto transition-all duration-300">
      <nav
        aria-label="Navegación principal"
        className={`w-full rounded-2xl transition-all duration-300 border ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-float border-slate-200/80 py-2.5 px-4 sm:px-6'
            : 'bg-white/80 backdrop-blur-sm shadow-soft border-slate-100 py-3.5 px-4 sm:px-6'
        } flex items-center justify-between`}
      >
        {/* Brand Text Only (No real logo) */}
        <a
          href="#"
          className="flex items-center gap-2.5 group focus:ring-2 focus:ring-turquoise rounded-lg p-1"
          aria-label="MMZ Socks - Inicio"
        >
          <div className="w-9 h-9 rounded-xl bg-petrol flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-turquoise transition-colors">
            M
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-petrol leading-none group-hover:text-turquoise transition-colors">
              MMZ <span className="font-semibold text-turquoise">SOCKS</span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 font-sans">
              Pradoluengo · Burgos
            </span>
          </div>
        </a>

        {/* Desktop Links */}
        <ul className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navLinks.map((link) => (
            <li key={link.name}>
              <a
                href={link.href}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  link.highlight
                    ? 'text-turquoise bg-turquoise/10 hover:bg-turquoise/20 font-semibold'
                    : 'text-slate-600 hover:text-petrol hover:bg-slate-100/70'
                }`}
              >
                {link.name}
              </a>
            </li>
          ))}
        </ul>

        {/* Right CTA */}
        <div className="hidden sm:flex items-center gap-3">
          <a
            href="#configurador"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-petrol hover:bg-turquoise rounded-full transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <Sparkles className="w-4 h-4 text-yarn-mustard" />
            <span>Diseña tu calcetín</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex lg:hidden items-center gap-2">
          <a
            href="#configurador"
            className="sm:hidden px-3 py-1.5 text-xs font-semibold text-white bg-petrol rounded-full"
          >
            Diseñar
          </a>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-turquoise"
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isOpen && (
        <div
          id="mobile-nav"
          className="lg:hidden mt-2 p-5 bg-white/95 backdrop-blur-md rounded-2xl shadow-float border border-slate-200/90 animate-fadeIn"
        >
          <ul className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-base font-medium transition-colors ${
                    link.highlight
                      ? 'bg-turquoise/10 text-turquoise font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {link.name}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <a
                href="#configurador"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white bg-petrol rounded-xl shadow-md"
              >
                <span>Diseña tu calcetín en 3D</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};
