import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Key, 
  Store, 
  Sparkles, 
  Handshake, 
  ArrowRight, 
  Clock, 
  MapPin, 
  Phone, 
  Globe, 
  CheckCircle2, 
  TrendingUp, 
  Layers, 
  MessageSquare, 
  Send, 
  LogOut, 
  Plus, 
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Percent,
  Calendar,
  Building,
  Search,
  Award,
  Gift,
  Share2,
  Edit3,
  Save,
  Check,
  AlertCircle,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Business, SynergyOpportunity, BusinessRewardProfile } from '../types';
import { businessFetch } from '../lib/apiAuth';

export default function BusinessPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accessCode, setAccessCode] = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  const [synergies, setSynergies] = useState<SynergyOpportunity[]>([]);
  const [rewards, setRewards] = useState<BusinessRewardProfile | null>(null);
  const [allNetworkBusinesses, setAllNetworkBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const [activeTab, setActiveTab] = useState<'sinergias' | 'ficha' | 'proponer' | 'recomendar' | 'consultor'>('sinergias');

  // Estado para Edición de Ficha
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Business>>({});
  const [savingFicha, setSavingFicha] = useState(false);

  // Estado para Proponer Sinergia con Negocio Existente
  const [searchPartnerQuery, setSearchPartnerQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Business | null>(null);
  const [propSynergyType, setPropSynergyType] = useState<SynergyOpportunity['synergyType']>('bono_cruzado');
  const [propTitle, setPropTitle] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propBenefitMy, setPropBenefitMy] = useState('');
  const [propBenefitPartner, setPropBenefitPartner] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Estado para Recomendar Nuevo Negocio (Traer nuevo comercio y ganar +250 Pts)
  const [refName, setRefName] = useState('');
  const [refCategory, setRefCategory] = useState('Comercio Local');
  const [refZone, setRefZone] = useState('Casco Vello');
  const [refAddress, setRefAddress] = useState('');
  const [refPhone, setRefPhone] = useState('');
  const [refNotes, setRefNotes] = useState('');
  const [refProposedSynergy, setRefProposedSynergy] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);

  // Estado para chat con consultor IA de cooperación
  const [chatMessages, setChatMessages] = useState<Array<{ text: string; isBot: boolean }>>([
    {
      text: '¡Hola! Soy el Consultor de Cooperación Comercial de Vigo. Conozco los datos de tu negocio y del resto de comercios locales. ¿Quieres explorar alguna alianza específica o planificar un bono cruzado?',
      isBot: true
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Cargar lista completa de comercios de la red para el buscador de aliados
  useEffect(() => {
    fetch('/api/cooperation/all')
      .then(res => res.json())
      .then(data => {
        setAllNetworkBusinesses(data.businesses || []);
      })
      .catch(console.error);
  }, []);

  // Login automático si viene en URL o en sessionStorage
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    const savedCode = sessionStorage.getItem('coop_access_code');
    const codeToUse = codeFromUrl || savedCode;

    if (codeToUse) {
      setAccessCode(codeToUse);
      handleLoginWithCode(codeToUse);
    }
  }, [searchParams]);

  const handleLoginWithCode = async (codeToUse?: string) => {
    const code = (codeToUse || accessCode).trim().toUpperCase();
    if (!code) {
      setError('Por favor introduce tu clave de acceso de comercio.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/cooperation/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_code: code })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Clave de comercio no válida');
      }

      setBusiness(data.business);
      setEditFormData(data.business);
      setSynergies(data.synergies || []);
      sessionStorage.setItem('coop_access_code', code);

      // Cargar recompensas
      fetchRewards(data.business.id);
    } catch (err: any) {
      setError(err.message || 'Error al conectar');
    } finally {
      setLoading(false);
    }
  };

  const getPortalAccessCode = () =>
    sessionStorage.getItem('coop_access_code') || accessCode || '';

  const fetchRewards = async (businessId: string) => {
    try {
      const res = await businessFetch(`/api/cooperation/rewards/${businessId}`, getPortalAccessCode());
      const data = await res.json();
      if (data.rewards) {
        setRewards(data.rewards);
      }
    } catch (err) {
      console.error("Error fetching rewards:", err);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('coop_access_code');
    setBusiness(null);
    setSynergies([]);
    setAccessCode('');
    setRewards(null);
  };

  // Guardar Ficha Editada y Validar como 'DICHO'
  const handleSaveFicha = async () => {
    if (!business) return;
    setSavingFicha(true);

    try {
      const res = await businessFetch('/api/cooperation/update-business', getPortalAccessCode(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: business.id,
          ...editFormData,
          honesty_status: 'DICHO' // Validado expresamente por el comerciante
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      setBusiness(data.business);
      setSynergies(data.synergies || synergies);
      setIsEditing(false);
      fetchRewards(business.id);
      setNotification({
        message: '¡Ficha actualizada y validada con estado "DICHO"! Has sumado puntos de comerciante honesto.',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingFicha(false);
    }
  };

  // Enviar Propuesta de Sinergia a Negocio Existente
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !selectedPartner || !propTitle.trim()) {
      alert('Por favor selecciona un comercio de Vigo y asigna un título a la propuesta.');
      return;
    }

    setSubmittingProposal(true);
    try {
      const res = await businessFetch('/api/cooperation/propose-synergy', getPortalAccessCode(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_business_id: business.id,
          to_business_id: selectedPartner.id,
          synergy_type: propSynergyType,
          title: propTitle,
          description: propDesc,
          proposed_benefit_from: propBenefitMy,
          proposed_benefit_to: propBenefitPartner
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al proponer sinergia');

      setSynergies(prev => [data.synergy, ...prev]);
      if (data.rewards) setRewards(data.rewards);

      setSelectedPartner(null);
      setPropTitle('');
      setPropDesc('');
      setPropBenefitMy('');
      setPropBenefitPartner('');
      setActiveTab('sinergias');

      setNotification({
        message: `¡Propuesta de colaboración enviada a ${selectedPartner.name}! Has ganado +50 Puntos.`,
        type: 'success'
      });
      setTimeout(() => setNotification(null), 6000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingProposal(false);
    }
  };

  // Enviar Recomendación de Nuevo Comercio (Gana +250 Puntos)
  const handleSendReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !refName.trim()) {
      alert('El nombre del comercio es obligatorio.');
      return;
    }

    setSubmittingReferral(true);
    try {
      const res = await businessFetch('/api/cooperation/refer-business', getPortalAccessCode(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer_business_id: business.id,
          name: refName,
          category: refCategory,
          zone: refZone,
          address: refAddress,
          phone: refPhone,
          notes: refNotes,
          proposed_synergy: refProposedSynergy
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al referir comercio');

      if (data.synergy) {
        setSynergies(prev => [data.synergy, ...prev]);
      }
      if (data.rewards) {
        setRewards(data.rewards);
      }

      setRefName('');
      setRefAddress('');
      setRefPhone('');
      setRefNotes('');
      setRefProposedSynergy('');
      setActiveTab('sinergias');

      setNotification({
        message: `¡Comercio "${data.business.name}" incorporado con éxito! Has ganado +250 Puntos de Embajador. Clave generada: ${data.access_code}`,
        type: 'success'
      });
      setTimeout(() => setNotification(null), 8000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingReferral(false);
    }
  };

  const handleAskConsultant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || chatLoading) return;

    const userText = inputQuestion;
    setInputQuestion('');
    setChatMessages(prev => [...prev, { text: userText, isBot: false }]);
    setChatLoading(true);

    try {
      const systemContext = `Eres el Consultor de Estrategia y Cooperación Comercial de Vigo (AhorraAI v4).
Estás asesorando a: ${business?.name} (${business?.category}) situado en ${business?.zone || business?.address || 'Vigo'}.
Datos de este negocio:
- Horas valle: ${business?.cooperation?.valleyHours || '15:30 - 18:00'}
- Qué ofrece: ${business?.cooperation?.offers?.join(', ') || ''}
- Qué busca: ${business?.cooperation?.needs?.join(', ') || ''}

Tu objetivo es proponer acuerdos comerciales ganar-ganar en Vigo (bonos cruzados, paquetes conjuntos, compras agrupadas).`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...chatMessages.map(m => ({ text: m.text, isBot: m.isBot })),
            { text: userText, isBot: false }
          ],
          config: {
            userType: 'business',
            language: 'Español'
          }
        })
      });

      const data = await res.json();
      setChatMessages(prev => [...prev, { text: data.text || 'Sin respuesta del consultor', isBot: true }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { text: 'Hubo un error al procesar tu consulta. Inténtalo de nuevo.', isBot: true }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Filtrado de comercios para el buscador de aliados
  const partnerCandidates = allNetworkBusinesses.filter(b => 
    b.id !== business?.id &&
    (b.name.toLowerCase().includes(searchPartnerQuery.toLowerCase()) ||
     (b.category && b.category.toLowerCase().includes(searchPartnerQuery.toLowerCase())) ||
     (b.zone && b.zone.toLowerCase().includes(searchPartnerQuery.toLowerCase())))
  );

  // ==========================================
  // PANTALLA DE ACCESO POR CLAVE
  // ==========================================
  if (!business) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans">
        <header className="p-4 sm:p-6 border-b border-slate-900 flex items-center justify-between">
          <Link to="/admin/cooperacion" className="text-slate-400 hover:text-white flex items-center gap-2 text-sm transition">
            <ArrowLeft size={16} />
            <span>Volver a la Red de Vigo</span>
          </Link>
          <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
            AhorraAI v4 • Portal de Comercios de Vigo
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 mb-2">
                <Store size={32} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Portal de Comercio Local</h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Introduce tu <strong>Clave de Acceso Única</strong> (ej. <code className="text-blue-400 bg-blue-950 px-1 py-0.5 rounded">VIGO-CASCO-7482</code>) para gestionar tus sinergias y proponer acuerdos.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleLoginWithCode(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Clave de Acceso del Comercio
                </label>
                <div className="relative">
                  <Key size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="VIGO-ZONA-XXXX"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-mono tracking-wider text-white uppercase placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>Conectando con la Red...</span>
                ) : (
                  <>
                    <span>Entrar a mi Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800 text-center">
              <Link 
                to="/admin/cooperacion"
                className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
              >
                <span>Ver todas las claves en el Panel de Administrador</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </motion.div>
        </main>

        <footer className="p-4 text-center text-xs text-slate-600 border-t border-slate-900">
          AhorraAI v4 • Ecosistema de Cooperación Comercial de Vigo
        </footer>
      </div>
    );
  }

  // ==========================================
  // PORTAL PRINCIPAL DEL COMERCIO
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* NOTIFICACIÓN TOAST */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 max-w-md bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 text-xs sm:text-sm"
          >
            <CheckCircle2 size={20} className="shrink-0 text-emerald-200" />
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CABECERA CON NAVEGACIÓN Y RESUMEN DEL COMERCIO */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/cooperacion"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center gap-1.5 text-xs font-medium"
              title="Volver a la Red General de Vigo"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Grafo Red Vigo</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white leading-none">{business.name}</h1>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-semibold">
                  {business.honesty_status || 'DICHO'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {business.category || 'Comercio Local'} • {business.zone || 'Vigo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Puntos y Recompensas */}
            {rewards && (
              <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <Award size={16} className="text-amber-400" />
                <div>
                  <span className="block text-xs font-black text-amber-300 leading-none">
                    {rewards.points} Pts
                  </span>
                  <span className="text-[9px] text-amber-200/70 uppercase font-semibold">
                    Nivel {rewards.tier}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="p-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-xl transition text-xs flex items-center gap-1"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
        <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl scrollbar-none text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('sinergias')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'sinergias'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Handshake size={16} />
            <span>Mis Sinergias ({synergies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ficha')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'ficha'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Store size={16} />
            <span>Mi Ficha & Honestidad</span>
          </button>

          <button
            onClick={() => setActiveTab('proponer')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'proponer'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search size={16} />
            <span>Proponer Alianza (+50 Pts)</span>
          </button>

          <button
            onClick={() => setActiveTab('recomendar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'recomendar'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Gift size={16} />
            <span>Recomendar Negocio (+250 Pts)</span>
          </button>

          <button
            onClick={() => setActiveTab('consultor')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap ${
              activeTab === 'consultor'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sparkles size={16} />
            <span>Consultor IA de Vigo</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
        {/* ========================================== */}
        {/* PESTAÑA 1: SINERGIAS ACTIVAS Y SUGERIDAS  */}
        {/* ========================================== */}
        {activeTab === 'sinergias' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/20 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-semibold mb-1">
                    <Sparkles size={14} />
                    <span>Cerebro de Cooperación Local • Vigo</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Oportunidades de Alianza para {business.name}
                  </h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
                    Sinergias detectadas cruzando tus horas valle ({business.cooperation?.valleyHours || '15:30 - 18:00'}), zona ({business.zone || 'Vigo'}) y capacidad ociosa con los otros 126+ comercios de la ciudad.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('proponer')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-900/30"
                  >
                    <Plus size={14} />
                    <span>Proponer a otro Negocio</span>
                  </button>
                </div>
              </div>
            </div>

            {synergies.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Handshake size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No tienes sinergias calculadas aún</h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Puedes proponer una alianza tú mismo con cualquier negocio de Vigo o recomendar un negocio nuevo.
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('proponer')}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
                  >
                    Proponer Alianza
                  </button>
                  <button
                    onClick={() => setActiveTab('recomendar')}
                    className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl"
                  >
                    Recomendar Comercio Vecino
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {synergies.map((syn) => {
                  const isA = syn.businessA_id === business.id || syn.businessA_name === business.name;
                  const partnerName = isA ? syn.businessB_name : syn.businessA_name;
                  const myBenefit = isA ? syn.benefitA : syn.benefitB;
                  const partnerBenefit = isA ? syn.benefitB : syn.benefitA;

                  return (
                    <motion.div
                      key={syn.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full text-[11px] font-medium uppercase tracking-wide">
                            {syn.synergyType.replace('_', ' ')}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <Percent size={12} />
                            {syn.compatibilityScore}% Afinidad
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white leading-snug">{syn.title}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-1 font-medium">
                            <Building size={14} />
                            <span>Aliado: <strong>{partnerName}</strong></span>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                          {syn.description}
                        </p>

                        {/* Beneficio Ganar-Ganar */}
                        <div className="bg-slate-950/80 rounded-xl p-3 space-y-2 border border-slate-800/80 text-xs">
                          <div>
                            <span className="font-semibold text-emerald-400">Para {business.name}:</span>
                            <p className="text-slate-300 mt-0.5">{myBenefit}</p>
                          </div>
                          <div className="border-t border-slate-800/60 pt-2">
                            <span className="font-semibold text-blue-400">Para {partnerName}:</span>
                            <p className="text-slate-300 mt-0.5">{partnerBenefit}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs">
                        <span className="text-[11px] text-slate-500">
                          {syn.status === 'en_contacto' ? 'Propuesta Directa' : 'Sugerencia IA'}
                        </span>
                        <button
                          onClick={() => {
                            setActiveTab('consultor');
                            setInputQuestion(`¿Cómo podemos poner en marcha la sinergia "${syn.title}" con ${partnerName}?`);
                          }}
                          className="flex items-center gap-1.5 font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition"
                        >
                          <span>Planificar Alianza</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 2: MI FICHA & HONESTIDAD ESTRUCTURAL */}
        {/* ========================================== */}
        {activeTab === 'ficha' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Ficha Estructural de {business.name}</span>
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
                    {business.honesty_status || 'DICHO'}
                  </span>
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Puedes editar y confirmar tus datos en cualquier momento para mantener tus sinergias exactas.
                </p>
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveFicha}
                      disabled={savingFicha}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
                    >
                      <Save size={14} />
                      <span>{savingFicha ? 'Guardando...' : 'Guardar y Validar (DICHO)'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Edit3 size={14} />
                    <span>Editar mi Ficha</span>
                  </button>
                )}
              </div>
            </div>

            {/* FORMULARIO O VISTA DE DETALLES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información Básica */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Datos Principales</h3>
                
                {isEditing ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Nombre Comercial</label>
                      <input
                        type="text"
                        value={editFormData.name || ''}
                        onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Categoría / Sector</label>
                      <input
                        type="text"
                        value={editFormData.category || ''}
                        onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Zona / Barrio en Vigo</label>
                      <input
                        type="text"
                        value={editFormData.zone || ''}
                        onChange={e => setEditFormData({ ...editFormData, zone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Dirección Exacta</label>
                      <input
                        type="text"
                        value={editFormData.address || ''}
                        onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={editFormData.phone || ''}
                        onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-xl p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Sector:</span>
                      <span className="text-white font-medium">{business.category || 'Comercio Local'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Zona / Barrio:</span>
                      <span className="text-white font-medium">{business.zone || 'Vigo'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Dirección:</span>
                      <span className="text-white font-medium">{business.address || 'No indicada'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Teléfono:</span>
                      <span className="text-white font-medium">{business.phone || 'No indicado'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Clave de Acceso:</span>
                      <span className="text-blue-400 font-mono font-bold">{business.access_code}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Horarios en 3 Franjas Operativas */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Horarios & Horas Valle (Vigo)</h3>
                
                {isEditing ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Franja Mañana</label>
                      <input
                        type="text"
                        value={editFormData.time_slots?.morning || ''}
                        onChange={e => setEditFormData({ 
                          ...editFormData, 
                          time_slots: { ...editFormData.time_slots, morning: e.target.value } 
                        })}
                        placeholder="ej. 09:30 - 14:00"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Franja Tarde</label>
                      <input
                        type="text"
                        value={editFormData.time_slots?.afternoon || ''}
                        onChange={e => setEditFormData({ 
                          ...editFormData, 
                          time_slots: { ...editFormData.time_slots, afternoon: e.target.value } 
                        })}
                        placeholder="ej. 16:30 - 20:30"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Horas Valle a Dinamizar (Clave para Sinergias)</label>
                      <input
                        type="text"
                        value={editFormData.cooperation?.valleyHours || ''}
                        onChange={e => setEditFormData({ 
                          ...editFormData, 
                          cooperation: { ...editFormData.cooperation, valleyHours: e.target.value } 
                        })}
                        placeholder="ej. 15:30 - 18:00 o Martes tarde"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 rounded-xl p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Franja Mañana:</span>
                      <span className="text-white font-medium">{business.time_slots?.morning || '09:30 - 14:00'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Franja Tarde:</span>
                      <span className="text-white font-medium">{business.time_slots?.afternoon || '16:30 - 20:30'}</span>
                    </div>
                    <div className="flex justify-between py-1 text-amber-400 font-semibold">
                      <span>Horas Valle Declaradas:</span>
                      <span>{business.cooperation?.valleyHours || '15:30 - 18:00'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Capacidad Ociosa y Recursos */}
              <div className="space-y-4 md:col-span-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Ofertas, Necesidades y Recursos de Cooperación</h3>
                <div className="bg-slate-950 rounded-xl p-4 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block mb-1.5">Qué ofreces a otros comercios de Vigo:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {business.cooperation?.offers?.map((item, i) => (
                        <span key={i} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg">
                          {item}
                        </span>
                      )) || <span className="text-slate-600">Ninguna oferta especificada</span>}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-2">
                    <span className="text-slate-400 font-medium block mb-1.5">Qué buscas o necesitas de aliados:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {business.cooperation?.needs?.map((item, i) => (
                        <span key={i} className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg">
                          {item}
                        </span>
                      )) || <span className="text-slate-600">Ninguna necesidad especificada</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 3: PROPONER SINERGIA (BUSCADOR)    */}
        {/* ========================================== */}
        {activeTab === 'proponer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold mb-1">
                <Search size={14} />
                <span>Buscador de Alianzas en Vigo (+50 Puntos por propuesta)</span>
              </div>
              <h2 className="text-xl font-bold text-white">Proponer una Alianza Directa a otro Comercio</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Busca entre los más de 126 comercios de Vigo de la red y formula un bono cruzado, pack conjunto o acuerdo de recomendación.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Buscador de Negocios */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  1. Seleccionar Comercio Aliado
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchPartnerQuery}
                    onChange={e => setSearchPartnerQuery(e.target.value)}
                    placeholder="Buscar por nombre, sector o zona (ej. Casco Vello, Gran Vía)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {partnerCandidates.slice(0, 15).map(partner => {
                    const isSelected = selectedPartner?.id === partner.id;
                    return (
                      <div
                        key={partner.id}
                        onClick={() => setSelectedPartner(partner)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                        }`}
                      >
                        <div>
                          <span className="font-bold block text-sm">{partner.name}</span>
                          <span className="text-[11px] text-slate-400">
                            {partner.category || 'Comercio'} • {partner.zone || 'Vigo'}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="px-2 py-1 bg-indigo-500 text-white rounded-lg font-semibold text-[10px]">
                            Seleccionado
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Formulario de Propuesta */}
              <form onSubmit={handleSendProposal} className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  2. Configurar la Propuesta
                </label>

                {selectedPartner ? (
                  <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-400">Comercio seleccionado:</span>
                      <strong className="block text-indigo-300 text-sm">{selectedPartner.name} ({selectedPartner.zone || 'Vigo'})</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPartner(null)}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                    Selecciona un comercio en la lista de la izquierda
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo de Cooperación</label>
                  <select
                    value={propSynergyType}
                    onChange={e => setPropSynergyType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="bono_cruzado">Bono Cruzado (Descuento o Vale mutuo)</option>
                    <option value="franja_valle">Aprovechamiento de Horas Valle</option>
                    <option value="pack_experiencia">Pack Experiencia Conjunto</option>
                    <option value="derivacion_clientes">Derivación de Clientes y Recomendación</option>
                    <option value="compra_agrupada">Compra Agrupada / Suministro Local</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Título de la Alianza</label>
                  <input
                    type="text"
                    value={propTitle}
                    onChange={e => setPropTitle(e.target.value)}
                    placeholder="ej. Bono Relax & Café Vigo"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Descripción de cómo funciona</label>
                  <textarea
                    value={propDesc}
                    onChange={e => setPropDesc(e.target.value)}
                    rows={2}
                    placeholder="Detalla cómo interactúan los clientes entre ambos comercios..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-emerald-400 mb-1">Beneficio para ti ({business.name})</label>
                    <input
                      type="text"
                      value={propBenefitMy}
                      onChange={e => setPropBenefitMy(e.target.value)}
                      placeholder="ej. Clientes nuevos por la tarde"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-blue-400 mb-1">Beneficio para el aliado</label>
                    <input
                      type="text"
                      value={propBenefitPartner}
                      onChange={e => setPropBenefitPartner(e.target.value)}
                      placeholder="ej. Comisión o clientela mutua"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedPartner || !propTitle.trim() || submittingProposal}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-900/30"
                >
                  <Send size={15} />
                  <span>{submittingProposal ? 'Registrando propuesta...' : 'Enviar Propuesta (+50 Pts)'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 4: RECOMENDAR NUEVO COMERCIO (+250) */}
        {/* ========================================== */}
        {activeTab === 'recomendar' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-slate-900 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-1">
                <Gift size={16} />
                <span>Programa de Embajadores del Comercio de Vigo</span>
              </div>
              <h2 className="text-xl font-bold text-white">Invita a un Comercio Vecino y Gana +250 Puntos</h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
                ¿Conoces una tienda, peluquería, cafetería o taller en Vigo que aún no esté en la red? Regístrala aquí: crearemos su gemelo digital con su clave de acceso y una propuesta de alianza directa con tu negocio.
              </p>
            </div>

            <form onSubmit={handleSendReferral} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Datos del Nuevo Comercio</h3>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre Comercial *</label>
                  <input
                    type="text"
                    value={refName}
                    onChange={e => setRefName(e.target.value)}
                    placeholder="ej. Floristería Rosalía / Panadería do Casco"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sector / Categoría</label>
                  <select
                    value={refCategory}
                    onChange={e => setRefCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Hostelería / Cafetería">Hostelería / Cafetería / Bar</option>
                    <option value="Moda / Textil / Calzado">Moda / Textil / Calzado</option>
                    <option value="Belleza / Peluquería / Estética">Belleza / Peluquería / Estética</option>
                    <option value="Salud / Farmacia / Óptica">Salud / Farmacia / Óptica</option>
                    <option value="Alimentación / Panadería">Alimentación / Panadería / Gourmet</option>
                    <option value="Cultura / Librería / Ocio">Cultura / Librería / Ocio</option>
                    <option value="Servicios / Cerrajería / Reparación">Servicios / Cerrajería / Reparación</option>
                    <option value="Deporte / Gimnasio">Deporte / Gimnasio / Bienestar</option>
                    <option value="Comercio Local">Otro Comercio Local</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Zona de Vigo</label>
                  <select
                    value={refZone}
                    onChange={e => setRefZone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Casco Vello">Casco Vello</option>
                    <option value="Príncipe / Centro">Príncipe / Centro</option>
                    <option value="O Calvario">O Calvario</option>
                    <option value="Bouzas">Bouzas</option>
                    <option value="Gran Vía / Urzáiz">Gran Vía / Urzáiz</option>
                    <option value="Travesía de Vigo">Travesía de Vigo</option>
                    <option value="Teis">Teis</option>
                    <option value="Coia / As Travesas">Coia / As Travesas</option>
                    <option value="Navia">Navia</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contacto & Idea de Cooperación</h3>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dirección Aproximada o Calle</label>
                  <input
                    type="text"
                    value={refAddress}
                    onChange={e => setRefAddress(e.target.value)}
                    placeholder="ej. Rúa Real, 14, Vigo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono de contacto (opcional)</label>
                  <input
                    type="text"
                    value={refPhone}
                    onChange={e => setRefPhone(e.target.value)}
                    placeholder="ej. 986 00 00 00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Idea de alianza inicial con {business.name}</label>
                  <input
                    type="text"
                    value={refProposedSynergy}
                    onChange={e => setRefProposedSynergy(e.target.value)}
                    placeholder="ej. Bono cruzado fin de semana o pack de bienvenida"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!refName.trim() || submittingReferral}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-900/30 mt-2"
                >
                  <Gift size={16} />
                  <span>{submittingReferral ? 'Incorporando comercio...' : 'Incorporar Comercio y Ganar +250 Puntos'}</span>
                </button>
              </div>
            </form>

            {/* Historial de Puntos del Comerciante */}
            {rewards && (
              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3">
                  Tu Historial de Puntos de Embajador
                </h3>
                <div className="bg-slate-950 rounded-xl p-4 space-y-2">
                  {rewards.history.map((hist) => (
                    <div key={hist.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/60 last:border-none">
                      <span className="text-slate-300">{hist.action}</span>
                      <span className="font-bold text-amber-400">+{hist.points} Pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* PESTAÑA 5: CONSULTOR IA DE ALIANZAS DE VIGO*/}
        {/* ========================================== */}
        {activeTab === 'consultor' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col h-[550px]">
            <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Consultor IA de Alianzas de Vigo</h3>
                  <p className="text-[11px] text-slate-400">Asesoramiento estratégico para {business.name}</p>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                      msg.isBot
                        ? 'bg-slate-950 text-slate-200 border border-slate-800'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-2xl px-4 py-2 flex items-center gap-2">
                    <Sparkles size={14} className="animate-spin text-purple-400" />
                    <span>Analizando oportunidades comerciales en Vigo...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input de consulta */}
            <form onSubmit={handleAskConsultant} className="pt-2 flex gap-2">
              <input
                type="text"
                value={inputQuestion}
                onChange={e => setInputQuestion(e.target.value)}
                placeholder="Pregunta cómo llenar tus horas valle, qué bono cruzado crear..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !inputQuestion.trim()}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition disabled:opacity-50 flex items-center justify-center shadow-lg shadow-purple-900/30"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
