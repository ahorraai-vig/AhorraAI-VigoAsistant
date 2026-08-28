import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Store, 
  MapPin, 
  Phone, 
  Globe, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Layers, 
  Users, 
  TrendingUp, 
  Copy, 
  Check, 
  ArrowLeft,
  Handshake,
  Key
} from 'lucide-react';
import { motion } from 'motion/react';

const SECTORS = [
  'Hostelería y Restauración',
  'Salud y Farmacia',
  'Comercio y Moda',
  'Cultura, Libros y Café',
  'Deporte y Bienestar',
  'Alimentación y Delicatessen',
  'Servicios Profesionales',
  'Artesanía y Diseño Local'
];

const ZONES_VIGO = [
  'Casco Vello',
  'Príncipe / Centro',
  'Gran Vía / Praza España',
  'Travesía de Vigo / Calvario',
  'Bouzas / Alcabre',
  'Plaza de América / As Travesas',
  'Coia / Florida',
  'Teis / Guixar',
  'Samil / Navia',
  'O Castro'
];

const IDLE_CAPACITY_OPTIONS = [
  'Mesas libres en horas valle (tardes/mañanas)',
  'Espacio de escaparate o expositor para terceros',
  'Excedentes diarios de producto de calidad',
  'Sala o espacio para eventos, charlas o talleres',
  'Reparto a domicilio / Capacidad logística propia',
  'Horas de personal disponible en franjas flojas'
];

const OFFERS_OPTIONS = [
  'Descuento o detalle cruzado para clientes de comercios aliados',
  'Degustación o muestra de bienvenida para turistas / clientes nuevos',
  'Punto de recogida o entrega para otros negocios',
  'Compras agrupadas a proveedores para abaratar costes',
  'Paquete o experiencia conjunta (ej. Cena + Ocio + Compra)',
  'Difusión en redes sociales o escaparate de comercios amigos'
];

const NEEDS_OPTIONS = [
  'Llenar mesas / clientela en franjas horarias valle',
  'Atraer turistas y visitantes que llegan a Vigo',
  'Conectar con trabajadores de oficinas y comercios cercanos',
  'Abaratar costes en suministros / embalaje / materias primas',
  'Fidelizar vecinos y clientes habituales del barrio',
  'Mayor visibilidad digital en el ecosistema de Vigo'
];

export default function BusinessOnboarding() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    category: SECTORS[0],
    description: '',
    address: '',
    zone: ZONES_VIGO[0],
    phone: '',
    website: '',
    morningHours: '09:30 - 14:00',
    afternoonHours: '16:30 - 20:30',
    nightHours: '',
    valleyHours: '15:00 - 17:30',
    idleCapacity: [] as string[],
    offers: [] as string[],
    needs: [] as string[],
    preferredPartners: [] as string[],
    specialProposal: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredResult, setRegisteredResult] = useState<{
    accessCode: string;
    businessId: string;
    businessName: string;
  } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);

  const toggleOption = (field: 'idleCapacity' | 'offers' | 'needs' | 'preferredPartners', value: string) => {
    setFormData(prev => {
      const current = prev[field];
      const next = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [field]: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Por favor, indica el nombre comercial de tu negocio');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        address: formData.address,
        zone: formData.zone,
        phone: formData.phone,
        website: formData.website,
        time_slots: {
          morning: formData.morningHours,
          afternoon: formData.afternoonHours,
          night: formData.nightHours
        },
        opening_hours: {
          mañana: formData.morningHours,
          tarde: formData.afternoonHours,
          valle: formData.valleyHours
        },
        cooperation: {
          idleCapacity: formData.idleCapacity,
          offers: formData.offers,
          needs: formData.needs,
          preferredPartners: formData.preferredPartners,
          valleyHours: formData.valleyHours,
          specialProposal: formData.specialProposal
        }
      };

      const res = await fetch('/api/cooperation/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el negocio');
      }

      setRegisteredResult({
        accessCode: data.access_code,
        businessId: data.business.id,
        businessName: data.business.name
      });
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  if (registeredResult) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6"
        >
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">¡Ficha de Negocio Activada!</h2>
            <p className="text-slate-400 text-sm mt-1">
              <strong className="text-white">{registeredResult.businessName}</strong> ya forma parte de la red de comercio local cooperativo de Vigo.
            </p>
          </div>

          {/* Tarjeta con Clave Única de Acceso */}
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 text-left space-y-3">
            <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Key size={14} />
                Tu Clave de Acceso Única
              </span>
              <span className="bg-amber-500/10 px-2 py-0.5 rounded text-[11px] border border-amber-500/20">
                Guardar con seguridad
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl p-3">
              <span className="font-mono text-lg sm:text-xl font-bold tracking-wider text-amber-300">
                {registeredResult.accessCode}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(registeredResult.accessCode)}
                className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 text-xs"
              >
                {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <p className="text-[12px] text-slate-400 leading-relaxed">
              Utiliza esta clave en el <strong>Portal de Cooperación</strong> para entrar en cualquier momento a consultar tu ficha y las sinergias comerciales generadas por la IA.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                sessionStorage.setItem('coop_access_code', registeredResult.accessCode);
                navigate('/cooperacion');
              }}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={18} />
              <span>Ver mi Panel de Cooperación y Sinergias</span>
              <ArrowRight size={18} />
            </button>

            <Link
              to="/"
              className="inline-flex items-center justify-center w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Volver al Asistente de Vigo
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Cabecera */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Volver</span>
          </Link>
          <div className="text-center">
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2 justify-center">
              <Store size={16} className="text-amber-400" />
              Ficha de Comercio Local & Grafo de Cooperación
            </h1>
          </div>
          <Link
            to="/cooperacion"
            className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
          >
            <Key size={14} />
            <span>Tengo Clave</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 mt-4">
        <div className="mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            <Handshake size={14} />
            <span>Red Cooperativa de Vigo • AhorraAI v4</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Registra tu Comercio en la Red de Sinergias
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Cubre los datos de tu establecimiento. Al cruzarlos con el resto de negocios de Vigo, nuestro cerebro de IA detectará alianzas comerciales ganar-ganar para optimizar tus horas valle y multiplicar tus ventas.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECCIÓN 1: IDENTIFICACIÓN DEL COMERCIO */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Store size={18} className="text-blue-400" />
              <h3 className="font-semibold text-white">1. Datos Fundamentales del Negocio</h3>
              <span className="ml-auto text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                Estado: DICHO (Validado)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Tapería O Folón / FarmaTrave156"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Sector / Categoría</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {SECTORS.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Zona de Vigo</label>
                <select
                  value={formData.zone}
                  onChange={e => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {ZONES_VIGO.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Dirección Completa en Vigo</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ej: Rúa Real, 14 / Travesía de Vigo, 156"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Teléfono o WhatsApp de Contacto</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="986 00 00 00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Web / Instagram / Enlace</label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={formData.website}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Breve Descripción de tu Actividad</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Tapería tradicional especializada en productos de la ría y maridajes gallegos..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: HORARIOS EN 3 FRANJAS OPERATIVAS DE VIGO */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Clock size={18} className="text-amber-400" />
              <h3 className="font-semibold text-white">2. Horarios y Franjas Operativas</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Franja Mañana</label>
                <input
                  type="text"
                  value={formData.morningHours}
                  onChange={e => setFormData({ ...formData, morningHours: e.target.value })}
                  placeholder="09:30 - 14:00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Franja Tarde</label>
                <input
                  type="text"
                  value={formData.afternoonHours}
                  onChange={e => setFormData({ ...formData, afternoonHours: e.target.value })}
                  placeholder="16:30 - 20:30"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Franja Noche / Extra</label>
                <input
                  type="text"
                  value={formData.nightHours}
                  onChange={e => setFormData({ ...formData, nightHours: e.target.value })}
                  placeholder="20:30 - 23:30 (opcional)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-medium text-amber-300">
                Horas Valle declaradas (Momentos con menos afluencia donde te interesa recibir clientes)
              </label>
              <input
                type="text"
                value={formData.valleyHours}
                onChange={e => setFormData({ ...formData, valleyHours: e.target.value })}
                placeholder="Ej: 15:30 - 18:00 / Martes y Miércoles"
                className="w-full mt-1 bg-slate-950 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-sm text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* SECCIÓN 3: PREGUNTAS CLAVE PARA EL CRUCE DE SINERGIAS (GRAFO DE IA) */}
          <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-5 sm:p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <h3 className="font-semibold text-white">3. Parámetros para el Cruce de Cooperación</h3>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                La IA utiliza estas respuestas para conectar tu comercio con otros afines en Vigo.
              </p>
            </div>

            {/* A. Capacidad Ociosa / Recursos disponibles */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} />
                A. ¿Qué recursos o capacidad ociosa tienes disponible?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {IDLE_CAPACITY_OPTIONS.map(opt => {
                  const selected = formData.idleCapacity.includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => toggleOption('idleCapacity', opt)}
                      className={`text-left p-3 rounded-xl text-xs font-medium border transition-all flex items-start gap-2.5 ${
                        selected
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        selected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700'
                      }`}>
                        {selected && <Check size={12} />}
                      </div>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* B. Qué ofreces para colaborar */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Handshake size={14} />
                B. ¿Qué fórmulas de colaboración estás dispuesto a ofrecer?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OFFERS_OPTIONS.map(opt => {
                  const selected = formData.offers.includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => toggleOption('offers', opt)}
                      className={`text-left p-3 rounded-xl text-xs font-medium border transition-all flex items-start gap-2.5 ${
                        selected
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        selected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700'
                      }`}>
                        {selected && <Check size={12} />}
                      </div>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* C. Qué necesitas o buscas */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} />
                C. ¿Cuáles son tus prioridades o necesidades principales?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NEEDS_OPTIONS.map(opt => {
                  const selected = formData.needs.includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => toggleOption('needs', opt)}
                      className={`text-left p-3 rounded-xl text-xs font-medium border transition-all flex items-start gap-2.5 ${
                        selected
                          ? 'bg-amber-600/20 border-amber-500 text-amber-200 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        selected ? 'bg-amber-600 border-amber-500 text-white' : 'border-slate-700'
                      }`}>
                        {selected && <Check size={12} />}
                      </div>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* D. Sectores preferidos */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} />
                D. ¿Con qué tipo de negocios de Vigo te gustaría aliarte preferentemente?
              </label>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map(sec => {
                  const selected = formData.preferredPartners.includes(sec);
                  return (
                    <button
                      type="button"
                      key={sec}
                      onClick={() => toggleOption('preferredPartners', sec)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {sec}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Propuesta especial opcional */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-medium text-slate-300">
                Propuesta de Cooperación Personalizada o Mensaje (Opcional)
              </label>
              <textarea
                rows={2}
                value={formData.specialProposal}
                onChange={e => setFormData({ ...formData, specialProposal: e.target.value })}
                placeholder="Ej: Me gustaría crear un bono de merienda + lectura con cafeterías o una ruta gastronómica con la hostelería de Bouzas..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* BOTÓN DE ENVÍO */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Procesando y generando clave de comercio...</span>
              ) : (
                <>
                  <Sparkles size={20} />
                  <span>Guardar Ficha y Generar Clave de Cooperación</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
            <p className="text-center text-[12px] text-slate-500 mt-2">
              Tus datos se regirán por el principio de <strong>Honestidad Estructural (DICHO)</strong> en el ecosistema AhorraAI v4.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
