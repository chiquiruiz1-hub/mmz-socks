import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  MessageCircle
} from 'lucide-react';
import { SockConfig } from '../types/sock';
import { MATERIALS, calculatePricing } from '../utils/pricing';

interface ContactSectionProps {
  selectedConfig?: SockConfig | null;
  snapshotUrl?: string;
  onFormSubmitSuccess: (formData: any) => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  selectedConfig,
  snapshotUrl,
  onFormSubmitSuccess
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate message note if config was sent from configurator
  useEffect(() => {
    if (selectedConfig) {
      const pricing = calculatePricing(selectedConfig);
      const matName = MATERIALS.find((m) => m.id === selectedConfig.material)?.name || 'Algodón';
      const summary = `Hola, he configurado un pedido en el simulador 3D con las siguientes opciones:
- Material: ${matName}
- Cantidad: ${selectedConfig.quantity} pares
- Colores: Puño (${selectedConfig.cuffColor}), Caña (${selectedConfig.legColor}), Pie (${selectedConfig.footColor})
- Logotipo: ${selectedConfig.logo.url ? (selectedConfig.logo.repeatBack ? 'Sí (delante y detrás)' : 'Sí (delante)') : 'Sin logotipo'}
- Precio orientativo estimado: ${pricing.pricePerPair.toFixed(2)} €/par (${pricing.subtotal.toFixed(2)} € + IVA)`;
      
      setMessage(summary);
    }
  }, [selectedConfig]);

  // OWASP Top 10 input validation & sanitization
  const sanitizeText = (text: string) => {
    return text.replace(/[<>]/g, '').trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { [key: string]: string } = {};

    const cleanName = sanitizeText(name);
    if (!cleanName || cleanName.length < 2) {
      newErrors.name = 'Por favor introduce tu nombre completo.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      newErrors.email = 'Introduce una dirección de correo electrónico válida.';
    }

    if (!privacyAgreed) {
      newErrors.privacy = 'Debes aceptar la política de privacidad para solicitar presupuesto.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      onFormSubmitSuccess({
        name: cleanName,
        company: sanitizeText(company),
        email: email.trim(),
        phone: sanitizeText(phone),
        message: sanitizeText(message),
        config: selectedConfig,
        snapshotUrl: snapshotUrl
      });
    }, 600);
  };

  return (
    <section id="contacto" className="py-20 sm:py-28 bg-ice relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <p className="font-serif-italic text-turquoise text-lg sm:text-xl font-medium mb-2">
            Hablemos de tu proyecto
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-petrol-dark tracking-tight">
            Pide tu presupuesto sin compromiso
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Atención directa desde el taller de Pradoluengo para valorar las opciones de tu calcetín personalizado.
          </p>
        </div>

        {/* Contact Form + Factory Info Grid */}
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Form Card */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 rounded-3xl shadow-soft border border-slate-200/90">
            
            {selectedConfig && (
              <div className="mb-6 p-4 rounded-2xl bg-turquoise/10 border border-turquoise/20 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-petrol">
                  <Sparkles className="w-4 h-4 text-turquoise flex-shrink-0" />
                  <span>
                    Diseño 3D adjuntado: <strong>{selectedConfig.quantity} pares</strong> en{' '}
                    <strong>{MATERIALS.find((m) => m.id === selectedConfig.material)?.name}</strong>
                  </span>
                </div>
                <span className="text-turquoise font-bold uppercase tracking-wider text-[11px] bg-white px-2.5 py-1 rounded-full shadow-xs">
                  Cargado
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              
              {/* Name & Company */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nombre y apellidos <span className="text-yarn-coral">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Carmen Gómez"
                    className={`w-full px-4 py-3 text-sm rounded-xl border ${
                      errors.name ? 'border-yarn-coral ring-1 ring-yarn-coral' : 'border-slate-300'
                    } focus:ring-2 focus:ring-turquoise focus:border-transparent transition-all`}
                  />
                  {errors.name && <p className="text-xs text-yarn-coral font-medium">{errors.name}</p>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="company" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Empresa, club o peña
                  </label>
                  <input
                    id="company"
                    type="text"
                    maxLength={120}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ej. Club Ciclista Sierra"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Correo electrónico <span className="text-yarn-coral">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    maxLength={120}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className={`w-full px-4 py-3 text-sm rounded-xl border ${
                      errors.email ? 'border-yarn-coral ring-1 ring-yarn-coral' : 'border-slate-300'
                    } focus:ring-2 focus:ring-turquoise focus:border-transparent transition-all`}
                  />
                  {errors.email && <p className="text-xs text-yarn-coral font-medium">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="phone" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Teléfono <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    maxLength={25}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label htmlFor="message" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Detalles del pedido o comentarios
                </label>
                <textarea
                  id="message"
                  rows={4}
                  maxLength={1500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Cuéntanos si tienes fecha límite, tallas específicas o dudas sobre el bordado..."
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-turquoise focus:border-transparent transition-all"
                />
              </div>

              {/* Privacy Checkbox */}
              <div className="space-y-1 pt-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAgreed}
                    onChange={(e) => setPrivacyAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-turquoise accent-turquoise cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    He leído y acepto la política de privacidad. Consiento el tratamiento de mis datos con el único fin de recibir el presupuesto solicitado de MMZ Socks.
                  </span>
                </label>
                {errors.privacy && <p className="text-xs text-yarn-coral font-medium pl-7">{errors.privacy}</p>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 rounded-2xl bg-petrol hover:bg-turquoise text-white font-bold text-base shadow-float hover:shadow-glow transition-all duration-300 flex items-center justify-center gap-2 group active:scale-[0.99] disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span>Procesando solicitud...</span>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-yarn-mustard group-hover:translate-x-1 transition-transform" />
                    <span>Enviar solicitud de presupuesto</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2">
                <ShieldCheck className="w-4 h-4 text-yarn-green" />
                <span>Datos protegidos · Cero spam · Respuesta directa de taller</span>
              </div>

            </form>
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
                    <p className="text-slate-300 mt-0.5">
                      C/ Sagrada Familia 2<br />
                      09260 Pradoluengo (Burgos), España
                    </p>
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

      {/* Floating WhatsApp pill button (Sticky bottom right) */}
      <aside aria-label="Contacto directo por WhatsApp" className="fixed bottom-6 right-6 z-50">
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
