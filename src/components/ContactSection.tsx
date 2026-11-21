import React, { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  Clock,
  ShieldCheck,
  CheckCircle2,
  MessageCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SockConfig } from '../types/sock';
import { MATERIALS, calculatePricing } from '../utils/pricing';
import { getFriendlyColorName } from '../data/yarnPalette';

interface ContactSectionProps {
  selectedConfig?: SockConfig | null;
  snapshotUrl?: string;
  onFormSubmitSuccess: (formData: any) => void;
  hideWhatsAppOnMobile?: boolean;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  selectedConfig,
  snapshotUrl,
  onFormSubmitSuccess,
  hideWhatsAppOnMobile = false
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [pairs, setPairs] = useState('');
  const [deadline, setDeadline] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  // Precargar cantidad cuando viene del configurador
  useEffect(() => {
    if (selectedConfig) {
      setPairs(String(selectedConfig.quantity));
      setSubmittedOk(false);
    }
  }, [selectedConfig]);

  // Validación y saneado OWASP
  const sanitizeText = (text: string) => {
    return text.replace(/[<>]/g, '').trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { [key: string]: string } = {};

    const cleanName = sanitizeText(name);
    if (!cleanName) {
      newErrors.name = 'Escribe tu nombre para saber cómo dirigirnos a ti.';
    } else if (cleanName.length < 2) {
      newErrors.name = 'Tu nombre parece demasiado corto; escribe al menos 2 letras.';
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      newErrors.email = 'Escribe tu correo electrónico para poder enviarte el presupuesto.';
    } else if (!cleanEmail.includes('@')) {
      newErrors.email = 'Al correo le falta la arroba (@). Ejemplo: nombre@correo.com.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      newErrors.email = 'Revisa el dominio del correo (por ejemplo: nombre@correo.com).';
    }

    if (!privacyAgreed) {
      newErrors.privacy = 'Marca esta casilla para autorizarnos a enviarte el presupuesto.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedOk(true);
      onFormSubmitSuccess({
        name: cleanName,
        company: sanitizeText(company),
        email: cleanEmail,
        phone: sanitizeText(phone),
        message: sanitizeText(message),
        pairs: sanitizeText(pairs || (selectedConfig ? String(selectedConfig.quantity) : '')),
        deadline: sanitizeText(deadline),
        logoFileName: sanitizeText(logoFileName || (selectedConfig?.logo.url ? 'Logo adjunto desde el diseñador' : '')),
        config: selectedConfig,
        snapshotUrl: snapshotUrl
      });
    }, 350);
  };

  const pricing = selectedConfig ? calculatePricing(selectedConfig) : null;
  const matName = selectedConfig
    ? MATERIALS.find((m) => m.id === selectedConfig.material)?.name || 'Algodón Peinado'
    : null;

  return (
    <section id="contacto" className="py-20 sm:py-28 bg-ice relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            Hablemos de tu proyecto
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Pide tu presupuesto sin compromiso
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed">
            Solo necesitamos tu nombre y correo. La fábrica te contestará lo antes posible.
          </p>
        </div>

        {/* Contact Form + Factory Info Grid */}
        <div className="grid lg:grid-cols-12 gap-10 items-start">

          {/* Left Column: Single Short Quote Form Card */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl shadow-soft border border-slate-200/90">

            {/* Resumen del diseño si viene del configurador (con miniatura 3D y logo ya adjunto) */}
            {selectedConfig && pricing && (
              <div
                data-testid="contact-design-summary"
                className="mb-6 p-4 rounded-2xl bg-ice border border-slate-200/80 space-y-3"
              >
                <div className="flex items-center gap-3.5">
                  {snapshotUrl && (
                    <img
                      src={snapshotUrl}
                      alt="Tu calcetín diseñado"
                      data-testid="summary-sock-thumb"
                      className="w-20 h-20 rounded-xl object-cover bg-[#0A1A23] border border-slate-300 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 text-xs sm:text-sm space-y-1">
                    <p className="font-extrabold text-petrol-dark">
                      {pricing.quantity} pares · {matName}
                    </p>
                    <p className="text-slate-600 text-xs">
                      Color: <strong>{getFriendlyColorName(selectedConfig.legColor)}</strong> · Talón y puntera:{' '}
                      <strong>{getFriendlyColorName(selectedConfig.heelToeColor)}</strong>
                    </p>
                    <p className="font-extrabold text-turquoise">
                      {pricing.pricePerPair.toFixed(2).replace('.', ',')} €/par · Total{' '}
                      {pricing.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € + IVA
                    </p>
                  </div>
                </div>

                {/* Logo ya adjunto desde el diseñador: no se vuelve a pedir */}
                <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedConfig.logo.url ? (
                      <>
                        <img
                          src={selectedConfig.logo.url}
                          alt="Logo adjunto"
                          data-testid="summary-logo-thumb"
                          className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 p-1 flex-shrink-0"
                        />
                        <span className="truncate text-slate-700 font-semibold">
                          Tu logo ya va adjunto con este diseño
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">Diseño sin logo</span>
                    )}
                  </div>
                  <a
                    href="#configurador"
                    data-testid="btn-change-logo-contact"
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-turquoise text-petrol font-bold text-xs flex-shrink-0 inline-flex items-center"
                  >
                    {selectedConfig.logo.url ? 'Cambiar logo' : 'Añadir logo'}
                  </a>
                </div>
              </div>
            )}

            {submittedOk ? (
              <div
                data-testid="quote-sent-confirmation"
                className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2.5 text-center"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-lg font-extrabold">¡Solicitud enviada!</h3>
                <p className="text-sm text-emerald-900 leading-relaxed">
                  Hemos recibido tu diseño y tus datos. <strong>La fábrica te contestará lo antes posible.</strong>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} data-testid="unified-quote-form" className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-xs font-bold text-slate-700">
                    Tu nombre <span className="text-yarn-coral">*</span>
                  </label>
                  <input
                    id="name"
                    data-testid="input-quote-name"
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Laura García"
                    className={`w-full min-h-[46px] px-4 py-3 text-sm rounded-xl border ${
                      errors.name ? 'border-yarn-coral ring-1 ring-yarn-coral' : 'border-slate-300'
                    } focus:ring-2 focus:ring-turquoise focus:border-transparent transition-all`}
                  />
                  {errors.name && <p className="text-xs text-yarn-coral font-semibold">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-bold text-slate-700">
                    Tu correo electrónico <span className="text-yarn-coral">*</span>
                  </label>
                  <input
                    id="email"
                    data-testid="input-quote-email"
                    type="email"
                    required
                    maxLength={120}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className={`w-full min-h-[46px] px-4 py-3 text-sm rounded-xl border ${
                      errors.email ? 'border-yarn-coral ring-1 ring-yarn-coral' : 'border-slate-300'
                    } focus:ring-2 focus:ring-turquoise focus:border-transparent transition-all`}
                  />
                  {errors.email && <p className="text-xs text-yarn-coral font-semibold">{errors.email}</p>}
                </div>

                {/* Si el cliente viene sin diseñar nada, le ofrecemos cantidad y subir logo aquí */}
                {!selectedConfig && (
                  <div className="grid sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label htmlFor="pairs" className="block text-xs font-bold text-slate-700">
                        Cantidad aproximada (mín. 10)
                      </label>
                      <input
                        id="pairs"
                        type="number"
                        min={10}
                        inputMode="numeric"
                        value={pairs}
                        onChange={(e) => setPairs(e.target.value)}
                        placeholder="Ej. 50"
                        className="w-full min-h-[46px] px-4 py-3 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="logofile" className="block text-xs font-bold text-slate-700">
                        Tu logo (opcional)
                      </label>
                      <input
                        id="logofile"
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,.ai,.svg,.psd,.bmp"
                        onChange={(e) => setLogoFileName(e.target.files?.[0]?.name || '')}
                        className="w-full min-h-[46px] text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-petrol file:text-white file:font-semibold file:cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* Campos opcionales colapsados por defecto */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    data-testid="toggle-optional-fields"
                    onClick={() => setShowOptional((v) => !v)}
                    className="w-full min-h-[46px] px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors"
                  >
                    <span>Más datos (opcional)</span>
                    {showOptional ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showOptional && (
                    <div className="p-4 space-y-3.5 bg-white border-t border-slate-200 text-xs">
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label htmlFor="phone" className="block font-bold text-slate-700">
                            Teléfono
                          </label>
                          <input
                            id="phone"
                            type="tel"
                            maxLength={25}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+34 600 000 000"
                            className="w-full min-h-[44px] px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise"
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="company" className="block font-bold text-slate-700">
                            Empresa, club o peña
                          </label>
                          <input
                            id="company"
                            type="text"
                            maxLength={120}
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            placeholder="Ej. Club Ciclista Sierra"
                            className="w-full min-h-[44px] px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="deadline" className="block font-bold text-slate-700">
                          ¿Para qué fecha los necesitas?
                        </label>
                        <input
                          id="deadline"
                          type="date"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="w-full min-h-[44px] px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="message" className="block font-bold text-slate-700">
                          Comentarios
                        </label>
                        <textarea
                          id="message"
                          rows={3}
                          maxLength={1500}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Tallas aproximadas o cualquier detalle..."
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Privacy Checkbox */}
                <div className="space-y-1 pt-1">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="input-quote-privacy"
                      checked={privacyAgreed}
                      onChange={(e) => setPrivacyAgreed(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded text-turquoise accent-turquoise cursor-pointer flex-shrink-0"
                    />
                    <span className="text-xs text-slate-600 leading-relaxed">
                      Acepto que la fábrica utilice estos datos para enviarme el presupuesto de este diseño.
                    </span>
                  </label>
                  {errors.privacy && <p className="text-xs text-yarn-coral font-semibold pl-8">{errors.privacy}</p>}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  data-testid="btn-submit-quote"
                  disabled={isSubmitting}
                  className="w-full min-h-[52px] py-4 px-6 rounded-2xl bg-petrol hover:bg-turquoise text-white font-extrabold text-base shadow-float hover:shadow-glow transition-all duration-300 flex items-center justify-center gap-2 group active:scale-[0.99] disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span>Enviando solicitud...</span>
                  ) : (
                    <>
                      <Send className="w-5 h-5 text-yarn-mustard group-hover:translate-x-1 transition-transform" />
                      <span>Enviar solicitud de presupuesto</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-1">
                  <ShieldCheck className="w-4 h-4 text-yarn-green" />
                  <span>Datos protegidos · Cero spam · Respuesta directa de taller</span>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: Factory Contact Info & Direct Channels */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Card with official company details */}
            <div className="bg-petrol-dark text-white p-6 sm:p-8 rounded-3xl shadow-float space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-turquoise-light">
                  Atención directa de fábrica
                </span>
                <h3 className="text-2xl font-bold mt-1">
                  MMZ Socks
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Sociedad textil en Pradoluengo (Burgos)
                </p>
              </div>

              <div className="space-y-4 text-sm">
                
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-turquoise-light flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-white text-xs uppercase tracking-wider">Dirección de fábrica</strong>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=C%2F+Sagrada+Familia+2%2C+09260+Pradoluengo%2C+Burgos%2C+Espa%C3%B1a"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-slate-300 mt-0.5 hover:text-white transition-colors"
                      aria-label="Abrir la dirección de la fábrica en Google Maps"
                    >
                      C/ Sagrada Familia 2<br />
                      09260 Pradoluengo (Burgos), España
                      <span className="block mt-1 text-turquoise-light font-semibold underline underline-offset-2">
                        Cómo llegar (abrir en Google Maps) →
                      </span>
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-turquoise-light flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-white text-xs uppercase tracking-wider">Correo oficial</strong>
                    <a
                      href="mailto:info@mmzsocks.com"
                      className="text-slate-200 hover:text-white underline underline-offset-2 mt-0.5 block"
                    >
                      info@mmzsocks.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-turquoise-light flex-shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-white text-xs uppercase tracking-wider">Teléfono & WhatsApp</strong>
                    <a
                      href="tel:+34627588488"
                      className="text-slate-200 hover:text-white font-bold text-base mt-0.5 block"
                    >
                      +34 627 588 488
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-turquoise-light flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-white text-xs uppercase tracking-wider">Horario</strong>
                    <p className="text-slate-300 mt-0.5">
                      Horario: a confirmar por la fábrica
                    </p>
                  </div>
                </div>

              </div>

              {/* Direct WhatsApp Action Button */}
              <div className="pt-4 border-t border-white/15">
                <a
                  href="https://wa.me/34627588488"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-md transition-all duration-200"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Contactar por WhatsApp</span>
                </a>
              </div>

            </div>

            {/* Guarantee badge */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-soft flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-yarn-green/15 text-yarn-green flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-xs sm:text-sm">
                <h4 className="font-bold text-petrol-dark">Muestra física opcional</h4>
                <p className="text-slate-500 mt-0.5">
                  Para pedidos superiores a 500 pares, enviamos muestra física previa a la producción total.
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Floating WhatsApp pill button (oculto en móvil cuando está visible la barra fija del configurador para no tapar "Pedir presupuesto") */}
      <aside
        aria-label="Contacto directo por WhatsApp"
        data-testid="floating-whatsapp"
        className={`fixed bottom-6 right-6 z-50 transition-opacity duration-200 ${
          hideWhatsAppOnMobile ? 'hidden lg:block' : ''
        }`}
      >
        <a
          href="https://wa.me/34627588488"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20ba59] text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-float hover:shadow-glow transition-all duration-300 hover:scale-105 active:scale-95 focus:ring-4 focus:ring-[#25D366]/40"
          aria-label="Abrir chat de WhatsApp con fábrica MMZ Socks"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <span className="hidden sm:inline font-bold text-sm tracking-wide">
            WhatsApp Fábrica
          </span>
        </a>
      </aside>

    </section>
  );
};
