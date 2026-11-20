import React, { useState, useEffect, lazy, Suspense } from 'react';
import Lenis from 'lenis';
import { HeaderBanner } from './components/HeaderBanner';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ArtisansSection } from './components/ArtisansSection';
import { VideoSection } from './components/VideoSection';
import { Reveal } from './components/Reveal';
const FactoryFlight = lazy(() => import('./components/FactoryFlight').then((m) => ({ default: m.FactoryFlight })));
const ConfiguratorSection = lazy(() =>
  import('./components/SockConfigurator/ConfiguratorSection').then((m) => ({ default: m.ConfiguratorSection }))
);
import { FactorySection } from './components/FactorySection';
import { QualityDetailsSection } from './components/QualityDetailsSection';
import { ClientsSection } from './components/ClientsSection';
import { ProcessStepsSection } from './components/ProcessStepsSection';
import { FAQSection } from './components/FAQSection';
import { FacilitiesGallery } from './components/FacilitiesGallery';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { QuoteSuccessModal } from './components/QuoteSuccessModal';
import { SockConfig } from './types/sock';

export const App: React.FC = () => {
  const [selectedConfig, setSelectedConfig] = useState<SockConfig | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | undefined>(undefined);
  const [submittedData, setSubmittedData] = useState<any | null>(null);

  // Scroll suave (Lenis), desactivado si el visitante pide menos movimiento
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.12 });
    let raf = 0;
    const tick = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  const handleSelectConfigForQuote = (config: SockConfig, snapshot?: string) => {
    setSelectedConfig(config);
    if (snapshot) setSnapshotUrl(snapshot);
  };

  const handleFormSubmitSuccess = (formData: any) => {
    setSubmittedData(formData);
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans overflow-x-clip selection:bg-turquoise selection:text-white relative">
      {/* Top Proposal Banner */}
      <HeaderBanner />

      {/* Floating Rounded Navbar */}
      <Navbar />

      {/* Main Single-Page Content in Exact Required Order */}
      <main className="flex-1">
        {/* 1. Portada (Hero) */}
        <Hero />

        <Suspense fallback={<div className="h-screen bg-[#0A1A23]" />}>
          <FactoryFlight />
        </Suspense>

        {/* 2. Artesanos del calcetín */}
        <Reveal><ArtisansSection /></Reveal>

        {/* Anuncio en vídeo */}
        <VideoSection />

        {/* 3. EL DISEÑADOR (Configurador 3D interactivo con precio en vivo) */}
        <Suspense
          fallback={
            <section id="configurador" className="min-h-[70vh] flex items-center justify-center text-petrol">
              <p className="font-semibold animate-pulse">Cargando el diseñador 3D…</p>
            </section>
          }
        >
          <ConfiguratorSection onSelectConfigForQuote={handleSelectConfigForQuote} />
        </Suspense>

        {/* 4. Nuestra fábrica en Pradoluengo, Burgos */}
        <Reveal><FactorySection /></Reveal>

        {/* 5. La calidad en cada detalle (8 puntos alrededor de foto inclinada) */}
        <Reveal><QualityDetailsSection /></Reveal>

        {/* 6. Clientes (Empresas, Carreras, Clubes, Barefoot) */}
        <Reveal><ClientsSection /></Reveal>

        {/* 7. Diseño y fabricación (3 pasos) */}
        <Reveal><ProcessStepsSection /></Reveal>

        {/* 8. Preguntas frecuentes en acordeón (6 preguntas) */}
        <Reveal><FAQSection /></Reveal>

        {/* 9. Nuestras instalaciones (Galería de fotos) */}
        <Reveal><FacilitiesGallery /></Reveal>

        {/* 10. Contacto (Formulario y datos de fábrica) */}
        <ContactSection
          selectedConfig={selectedConfig}
          snapshotUrl={snapshotUrl}
          onFormSubmitSuccess={handleFormSubmitSuccess}
        />
      </main>

      {/* 11. Dark Footer */}
      <Footer />

      {/* Demonstration Quote Success Modal */}
      {submittedData && (
        <QuoteSuccessModal
          data={submittedData}
          onClose={() => setSubmittedData(null)}
        />
      )}
    </div>
  );
};
