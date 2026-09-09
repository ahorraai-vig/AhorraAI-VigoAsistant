import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Phone,
  MessageCircle,
  Star,
  ShieldCheck,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  ArrowRight,
  Send,
  Copy,
  Award,
  ThumbsUp,
  Layers,
  Wrench,
  Bot
} from 'lucide-react';
import { LeadWebsitePrototype } from '../../../api/prospector_miniapp_types';

export default function BusinessPrototypeWeb() {
  const { leadId } = useParams<{ leadId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prototype, setPrototype] = useState<LeadWebsitePrototype | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [formSent, setFormSent] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    municipality: '',
    message: ''
  });

  useEffect(() => {
    loadPrototype();
  }, [leadId]);

  const loadPrototype = async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prototype/lead/${leadId}`);
      if (!res.ok) {
        throw new Error('No se pudo cargar el prototipo web');
      }
      const json = await res.json();
      if (json.success && json.data) {
        setPrototype(json.data);
      }
    } catch (err: any) {
      setError(err.message || 'Error cargando prototipo');
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">Diseñando prototipo web con IA...</p>
        <span className="text-xs text-slate-500 mt-1">Extrayendo datos de Google y configurando diseño</span>
      </div>
    );
  }

  if (error || !prototype) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-lg font-bold text-white">Prototipo no disponible</h2>
          <p className="text-xs text-slate-300">{error || 'No se encontró la página web solicitada.'}</p>
          <button
            onClick={() => loadPrototype()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const cleanPhone = (prototype.phone || '').replace(/[^\d+]/g, '');

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* BARRA SUPERIOR DE CONTROL DE DEMOSTRACIÓN (ADMIN) */}
      <div className="bg-slate-950 text-slate-200 text-xs py-2 px-4 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
              <Sparkles size={12} /> PROTOTIPO GENERADO CON IA
            </span>
            <span className="text-slate-400 text-[11px] hidden md:inline">
              Maqueta interactiva exclusiva para <strong className="text-white">{prototype.businessName}</strong> ({prototype.municipality})
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={copyShareLink}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy size={12} /> {copied ? '¡Enlace Copiado!' : 'Copiar Enlace para Cliente'}
            </button>
            <Link
              to={`/miniapp/${prototype.leadId}`}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink size={12} /> Ver MiniApp Telegram
            </Link>
          </div>
        </div>
      </div>

      {/* HEADER / NAVEGACIÓN PRINCIPAL */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-8 z-40 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md"
              style={{ backgroundColor: prototype.colorTheme.primary }}
            >
              {prototype.businessName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                {prototype.businessName}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {prototype.primaryCategory} • {prototype.municipality}
              </span>
            </div>
          </div>

          {/* Contacto directo en cabecera */}
          <div className="flex items-center gap-3">
            {prototype.phone && (
              <a
                href={`tel:${cleanPhone}`}
                className="hidden md:inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <Phone size={14} />
                </div>
                <span>{prototype.phone}</span>
              </a>
            )}

            <a
              href="#presupuesto"
              className="px-4 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              style={{ backgroundColor: prototype.colorTheme.primary }}
            >
              <span>{prototype.heroCtaText}</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* SECCIÓN HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white py-16 sm:py-24 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl space-y-6">
            {/* Badge de confianza */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-800 text-xs font-bold shadow-xs">
              <ShieldCheck size={14} className="text-blue-600" />
              <span>{prototype.heroBadge}</span>
              <span className="text-blue-300">•</span>
              <div className="flex items-center gap-1 text-amber-500 font-bold">
                <Star size={12} fill="currentColor" />
                <span>{prototype.rating}</span>
                <span className="text-slate-500 text-[10px]">({prototype.reviewCount} opiniones)</span>
              </div>
            </div>

            {/* Titular */}
            <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight leading-[1.15]">
              {prototype.headline}
            </h1>

            {/* Subtítulo */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl font-normal">
              {prototype.subheadline}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#presupuesto"
                className="px-6 py-3.5 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2"
                style={{ backgroundColor: prototype.colorTheme.primary }}
              >
                <span>{prototype.heroCtaText}</span>
                <ArrowRight size={16} />
              </a>

              {prototype.phone && (
                <a
                  href={`tel:${cleanPhone}`}
                  className="px-5 py-3.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-sm rounded-xl transition-colors flex items-center gap-2 shadow-xs"
                >
                  <Phone size={16} className="text-slate-600" />
                  <span>Llamar {prototype.phone}</span>
                </a>
              )}
            </div>

            {/* Métricas o sellos de garantía */}
            <div className="pt-6 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-700">Presupuesto en 24h</span>
              </div>
              <div className="flex items-center gap-2">
                <Award size={16} className="text-blue-600 shrink-0" />
                <span className="font-semibold text-slate-700">Garantía Oficial por Escrito</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-amber-600 shrink-0" />
                <span className="font-semibold text-slate-700">{prototype.municipality} y comarca</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BANNER DESTACADO: ASISTENTE INTELIGENTE EN TELEGRAM */}
      <section className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-white/5 border border-white/10 shadow-2xl">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
              <Sparkles size={14} /> {prototype.isDeployedToTelegram ? "MiniApp Oficial Activa en Telegram" : "Nueva Tecnología Disponible"}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              ¿Quieres un presupuesto orientativo en menos de 1 minuto?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Prueba nuestro asistente inteligente en Telegram: escribe lo que necesitas y obtén un desglose orientativo con partidas y precios oficiales.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            {prototype.isDeployedToTelegram && (
              <a
                href={`https://t.me/ahorraaivigoasistant_bot?start=lead_${prototype.leadId}`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Bot size={16} /> Abrir en Telegram (@ahorraaivigoasistant_bot)
              </a>
            )}
            <Link
              to={`/miniapp/${prototype.leadId}`}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Sparkles size={16} /> {prototype.isDeployedToTelegram ? "Ver MiniApp en Web" : "Abrir Asistente Telegram"}
            </Link>
          </div>
        </div>
      </section>

      {/* SECCIÓN DE SERVICIOS */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">Nuestros Servicios</h2>
            <p className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Soluciones integrales de {prototype.primaryCategory.toLowerCase()} en {prototype.municipality}
            </p>
            <p className="text-xs sm:text-sm text-slate-500">
              Cuidamos cada detalle desde la primera visita técnica hasta la entrega final del trabajo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prototype.services.map((svc, idx) => (
              <div
                key={svc.id || idx}
                className="bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-blue-300 rounded-2xl p-6 transition-all shadow-xs hover:shadow-md space-y-3 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Wrench size={18} />
                  </div>
                  {svc.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {svc.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {svc.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {svc.description}
                </p>

                <div className="pt-2">
                  <a
                    href="#presupuesto"
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 transition-colors"
                  >
                    Pedir cotización de este servicio <ArrowRight size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN SOBRE NOSOTROS / TRAYECTORIA */}
      <section className="py-16 bg-slate-50 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 text-slate-700 text-xs font-semibold">
            <ThumbsUp size={14} /> Compromiso y Profesionalidad
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-950">
            Sobre {prototype.businessName}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
            {prototype.aboutStory}
          </p>
        </div>
      </section>

      {/* POR QUÉ ELEGIRNOS */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">Ventajas Competitivas</h2>
            <p className="text-2xl sm:text-3xl font-black text-slate-950">
              ¿Por qué confiar en nosotros?
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {prototype.whyChooseUs.map((w, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  0{idx + 1}
                </div>
                <h3 className="text-sm font-bold text-slate-900">{w.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{w.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIOS DE CLIENTES LOCALES */}
      <section className="py-16 sm:py-24 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs">
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
              <Star size={14} fill="currentColor" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Opiniones de Clientes Satisfechos
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Nuestra mejor carta de presentación es la satisfacción de quienes ya han confiado en nosotros.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {prototype.testimonials.map((t, idx) => (
              <div
                key={idx}
                className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-md"
              >
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={12} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "{t.comment}"
                </p>
                <div className="pt-2 border-t border-slate-700 text-xs">
                  <div className="font-bold text-white">{t.name}</div>
                  <div className="text-[11px] text-slate-400">{t.location} • {t.service}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES (FAQ) */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">Dudas Habituales</h2>
            <p className="text-2xl font-black text-slate-950">Preguntas Frecuentes</p>
          </div>

          <div className="space-y-3">
            {prototype.faq.map((item, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between font-bold text-xs sm:text-sm text-slate-900 bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
                >
                  <span>{item.question}</span>
                  {openFaq === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {openFaq === idx && (
                  <div className="px-5 py-4 text-xs text-slate-600 leading-relaxed bg-white border-t border-slate-100">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN FORMULARIO DE PRESUPUESTO & CONTACTO */}
      <section id="presupuesto" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Información de Contacto */}
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Contacto Directo</span>
                <h2 className="text-3xl font-black text-slate-950">
                  Solicita tu Presupuesto sin Compromiso
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Rellena el formulario o contáctanos directamente. Te responderemos en menos de 24 horas con una valoración técnica adaptada.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {prototype.phone && (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Phone size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Teléfono de atención</span>
                      <a href={`tel:${cleanPhone}`} className="font-bold text-slate-800 hover:text-blue-600">
                        {prototype.phone}
                      </a>
                    </div>
                  </div>
                )}

                {prototype.address && (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Zona de cobertura</span>
                      <span className="font-bold text-slate-800">
                        {prototype.address}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Formulario Interactivo */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
              {formSent ? (
                <div className="text-center py-8 space-y-3 animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">¡Solicitud recibida correctamente!</h3>
                  <p className="text-xs text-slate-600">
                    Nos pondremos en contacto contigo en las próximas horas para ofrecerte el mejor presupuesto.
                  </p>
                  <button
                    onClick={() => setFormSent(false)}
                    className="text-xs font-bold text-blue-600 underline cursor-pointer"
                  >
                    Enviar otra consulta
                  </button>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">Pide tu Presupuesto</h3>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nombre y Apellidos</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: David Pérez"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Teléfono Móvil</label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej: 600 12 34 56"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Municipio / Ubicación del trabajo</label>
                    <input
                      type="text"
                      placeholder={`Ej: ${prototype.municipality}, Vigo...`}
                      value={formData.municipality}
                      onChange={e => setFormData({ ...formData, municipality: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Descripción del trabajo</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Describe lo que necesitas presupuestar..."
                      value={formData.message}
                      onChange={e => setFormData({ ...formData, message: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    style={{ backgroundColor: prototype.colorTheme.primary }}
                  >
                    <Send size={14} /> Enviar Solicitud de Presupuesto
                  </button>

                  <p className="text-[10px] text-slate-400 text-center">
                    Tus datos se tratarán conforme a la RGPD exclusivamente para la elaboración del presupuesto.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-white block">{prototype.businessName}</span>
            <span className="text-[11px] text-slate-500">
              {prototype.primaryCategory} en {prototype.municipality} • Pontevedra
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Aviso Legal</span>
            <span>Política de Privacidad</span>
            <span>RGPD Galicia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
