import React, { useRef, useState } from 'react';
import { Play, MapPin, Sparkles } from 'lucide-react';

export const VideoSection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const start = () => {
    setStarted(true);
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      void v.play();
    }
  };

  return (
    <section id="video" className="py-16 sm:py-24 bg-petrol-dark text-white relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-turquoise/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-yarn-mustard/10 blur-3xl pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-10 items-center relative">
        <div className="text-center md:text-left space-y-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20">
            <MapPin className="w-4 h-4 text-turquoise-light" aria-hidden="true" />
            <span className="font-serif-italic text-sm sm:text-base">Hechos a mano en Pradoluengo</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Escudo. Camiseta. Bufanda…
            <span className="block text-yarn-mustard">¿Y los calcetines?</span>
          </h2>
          <p className="text-slate-200 text-base sm:text-lg max-w-md mx-auto md:mx-0 leading-relaxed">
            Tu club, tu peña o tu empresa merecen un calcetín propio. Míralo nacer en nuestro telar
            y diséñalo tú en el configurador 3D.
          </p>
          <a
            href="#configurador"
            className="inline-flex items-center gap-2.5 px-7 py-4 text-base font-bold text-petrol-dark bg-yarn-mustard hover:bg-white rounded-2xl shadow-float transition-all duration-300 hover:-translate-y-0.5"
          >
            <Sparkles className="w-5 h-5" />
            <span>Diseña tu calcetín</span>
          </a>
        </div>

        <div className="mx-auto w-full max-w-[300px] sm:max-w-[340px]">
          <div className="relative rounded-[2rem] overflow-hidden border-4 border-white/20 shadow-glow bg-black aspect-[9/16]">
            <video
              ref={videoRef}
              src="/anuncio-mmz.mp4"
              poster="/images/anuncio-poster.webp"
              preload="none"
              playsInline
              controls={started}
              loop
              className="w-full h-full object-cover"
              aria-label="Anuncio de MMZ Socks: calcetines personalizados hechos a mano en Pradoluengo"
            />
            {!started && (
              <button
                type="button"
                onClick={start}
                className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/10 transition-colors"
                aria-label="Reproducir anuncio de MMZ Socks"
              >
                <span className="w-20 h-20 rounded-full bg-white/90 text-petrol-dark flex items-center justify-center shadow-float animate-pulse">
                  <Play className="w-9 h-9 ml-1" fill="currentColor" />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
