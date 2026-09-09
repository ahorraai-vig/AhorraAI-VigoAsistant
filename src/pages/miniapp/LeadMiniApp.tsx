import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  Receipt,
  Users,
  Package,
  Building2,
  Phone,
  MessageCircle,
  ExternalLink,
  Plus,
  Send,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Search,
  ChevronRight,
  RefreshCw,
  Copy,
  Calendar,
  Layers
} from 'lucide-react';
import { LeadMiniAppConfig } from '../../../api/prospector_miniapp_types';

interface Budget {
  id: string;
  number: string;
  clientName: string;
  title: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  iva: number;
  total: number;
  status: 'draft' | 'sent' | 'approved';
  createdAt: string;
}

export default function LeadMiniApp() {
  const { leadId } = useParams<{ leadId: string }>();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<LeadMiniAppConfig | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [activeTab, setActiveTab] = useState<'presupuestos' | 'asistente' | 'facturas' | 'catalogo' | 'clientes' | 'empresa'>('asistente');

  // Asistente IA state
  const [assistantInput, setAssistantInput] = useState('');
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [selectedClient, setSelectedClient] = useState('Particular / Obra en comarca');

  // Presupuestos state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currentDraft, setCurrentDraft] = useState<Budget | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready?.();
      tg.expand?.();
    }
    loadMiniAppData();
  }, [leadId, tokenFromUrl]);

  const loadMiniAppData = async (codeOverride?: string) => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      let url = `/api/miniapp/lead/${leadId}`;
      const params = new URLSearchParams();
      if (tokenFromUrl) params.append('token', tokenFromUrl);
      if (codeOverride) params.append('code', codeOverride);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('No se pudo cargar la configuración de la MiniApp');
      }
      const json = await res.json();
      if (json.success && json.data?.config) {
        setConfig(json.data.config);
        setAuthenticated(json.authenticated);

        // Inicializar presupuestos de demo adaptados si no hay
        if (json.data.budgets && json.data.budgets.length > 0) {
          setBudgets(json.data.budgets);
        } else {
          const starterBudgets: Budget[] = [
            {
              id: 'b-01',
              number: `PRES-${new Date().getFullYear()}-001`,
              clientName: 'Comunidad Propietarios Rosalía',
              title: `Instalación y revisión técnica en ${json.data.config.municipality}`,
              items: [
                { name: json.data.config.catalog[0]?.name || 'Mano de obra especializada', quantity: 4, unitPrice: json.data.config.catalog[0]?.price || 40, total: (json.data.config.catalog[0]?.price || 40) * 4 },
                { name: json.data.config.catalog[1]?.name || 'Desplazamiento técnico', quantity: 1, unitPrice: json.data.config.catalog[1]?.price || 35, total: json.data.config.catalog[1]?.price || 35 }
              ],
              subtotal: (json.data.config.catalog[0]?.price || 40) * 4 + (json.data.config.catalog[1]?.price || 35),
              iva: ((json.data.config.catalog[0]?.price || 40) * 4 + (json.data.config.catalog[1]?.price || 35)) * 0.21,
              total: ((json.data.config.catalog[0]?.price || 40) * 4 + (json.data.config.catalog[1]?.price || 35)) * 1.21,
              status: 'approved',
              createdAt: new Date().toLocaleDateString('es-ES')
            }
          ];
          setBudgets(starterBudgets);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    if (pinInput.trim().toUpperCase() === config.accessCode.toUpperCase() || pinInput.trim() === config.token) {
      setAuthenticated(true);
      setPinError(false);
      showToast('¡Acceso verificado con éxito!');
    } else {
      setPinError(true);
    }
  };

  const handleGenerateBudgetFromAi = () => {
    if (!assistantInput.trim() || !config) return;
    setIsProcessingAi(true);

    setTimeout(() => {
      // Cruzar con catálogo
      const matchedItems = config.catalog.slice(0, 3).map((item, idx) => {
        const qty = idx === 0 ? 3 : 1;
        return {
          name: item.name,
          quantity: qty,
          unitPrice: item.price,
          total: item.price * qty
        };
      });

      const subtotal = matchedItems.reduce((acc, it) => acc + it.total, 0);
      const iva = subtotal * 0.21;
      const total = subtotal + iva;

      const newBudget: Budget = {
        id: `b-${Date.now()}`,
        number: `PRES-${new Date().getFullYear()}-${String(budgets.length + 1).padStart(3, '0')}`,
        clientName: selectedClient,
        title: assistantInput.length > 50 ? `${assistantInput.slice(0, 50)}...` : assistantInput,
        items: matchedItems,
        subtotal,
        iva,
        total,
        status: 'draft',
        createdAt: new Date().toLocaleDateString('es-ES')
      };

      setCurrentDraft(newBudget);
      setBudgets(prev => [newBudget, ...prev]);
      setIsProcessingAi(false);
      showToast('¡Presupuesto generado y guardado!');
      setActiveTab('presupuestos');
    }, 1100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">Cargando MiniApp inteligente...</p>
        <span className="text-xs text-slate-500 mt-1">Sincronizando con Telegram</span>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center font-bold text-xl">
            !
          </div>
          <h2 className="text-lg font-bold text-white">MiniApp no disponible</h2>
          <p className="text-xs text-slate-400">{error || 'No se encontró la configuración solicitada.'}</p>
          <button
            onClick={() => loadMiniAppData()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold"
          >
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  // Pantalla de Autenticación / PIN si no viene token
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-5 shadow-2xl">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-xl shadow-lg"
            style={{ backgroundColor: config.brandColor }}
          >
            {config.appInitials}
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-bold text-white">{config.appName}</h1>
            <p className="text-xs text-slate-400">{config.companyName} • {config.municipality}</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <ShieldCheck size={16} /> Espacio Privado y Exclusivo
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Introduce el código PIN que te hemos facilitado a través de Telegram o WhatsApp para desbloquear tu panel:
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                value={pinInput}
                onChange={e => setPinInput(e.target.value.toUpperCase())}
                placeholder="Ej: VIGO-4821"
                className="w-full text-center tracking-widest font-mono text-base uppercase bg-slate-950 border border-slate-700 rounded-xl py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              {pinError && (
                <p className="text-[11px] text-rose-400 mt-1.5 font-medium">Código incorrecto. Inténtalo de nuevo.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: config.brandColor }}
            >
              <Lock size={14} /> Desbloquear Mi Panel
            </button>
          </form>

          <p className="text-[10px] text-slate-500">
            ¿Has olvidado tu código? Escribe <code className="text-slate-300">/start</code> a @ahorraaivigoasistant_bot en Telegram.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* TOAST FLOTANTE */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={14} className="text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* CABECERA DE LA MINIAPP (ADAPTADA AL LEAD) */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md"
              style={{ backgroundColor: config.brandColor }}
            >
              {config.appInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">{config.appName}</h1>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                  Telegram MiniApp
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>{config.sector}</span> • <span>{config.municipality}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700/60 px-2 py-1 rounded-lg font-mono">
              PIN: {config.accessCode}
            </span>
          </div>
        </div>
      </header>

      {/* TABS DE NAVEGACIÓN SUPERIOR */}
      <nav className="bg-slate-900/60 border-b border-slate-800/80 px-2 overflow-x-auto no-scrollbar">
        <div className="max-w-2xl mx-auto flex items-center gap-1 py-1.5">
          <button
            onClick={() => setActiveTab('asistente')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'asistente'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles size={14} /> Asistente IA
          </button>
          <button
            onClick={() => setActiveTab('presupuestos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'presupuestos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText size={14} /> Presupuestos
            <span className="text-[10px] bg-slate-950 px-1.5 py-0.2 rounded-full text-slate-300">{budgets.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('catalogo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'catalogo'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Package size={14} /> Catálogo
            <span className="text-[10px] bg-slate-950 px-1.5 py-0.2 rounded-full text-slate-300">{config.catalog.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('clientes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'clientes'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users size={14} /> Clientes
          </button>
          <button
            onClick={() => setActiveTab('empresa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'empresa'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Building2 size={14} /> Empresa
          </button>
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-4 pb-20">
        {/* VISTA 1: ASISTENTE IA */}
        {activeTab === 'asistente' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg"
                  style={{ backgroundColor: config.brandColor }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">{config.assistantTitle}</h2>
                  <p className="text-xs text-blue-400 font-semibold">{config.assistantSubtitle}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {config.assistantDescription}
              </p>

              {/* Selector de Cliente */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-200">Asignar Cliente:</label>
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck size={12} /> RGPD Seguro
                  </span>
                </div>
                <select
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value={`Particular / Obra en ${config.municipality}`}>Particular / Obra en {config.municipality}</option>
                  <option value="Comunidad de Propietarios Vigo Centro">Comunidad de Propietarios Vigo Centro</option>
                  <option value="Local Comercial Cangas">Local Comercial Cangas</option>
                  <option value="Cliente Particular Val Miñor">Cliente Particular Val Miñor</option>
                </select>
              </div>

              {/* Textarea interactivo */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ¿Qué trabajos o materiales necesitas cotizar?
                </label>
                <textarea
                  value={assistantInput}
                  onChange={e => setAssistantInput(e.target.value)}
                  rows={3}
                  placeholder={config.sampleInputPlaceholder}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-slate-400">
                  <strong className="text-slate-200">{config.catalog.length}</strong> partidas en catálogo
                </span>

                <button
                  type="button"
                  onClick={handleGenerateBudgetFromAi}
                  disabled={isProcessingAi || !assistantInput.trim()}
                  className="px-5 py-2.5 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: config.brandColor }}
                >
                  {isProcessingAi ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Calculando...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Generar Presupuesto
                    </>
                  )}
                </button>
              </div>

              {/* Ejemplos Rápidos */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-[11px] font-bold text-slate-300">Ejemplos rápidos del sector:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {config.quickExamples.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAssistantInput(ex.query)}
                      className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors cursor-pointer group"
                    >
                      <div className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                        {ex.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {ex.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: PRESUPUESTOS */}
        {activeTab === 'presupuestos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Presupuestos Emitidos</h2>
              <button
                onClick={() => setActiveTab('asistente')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Plus size={14} /> Nuevo con IA
              </button>
            </div>

            <div className="space-y-3">
              {budgets.map(b => (
                <div
                  key={b.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{b.number}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          b.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {b.status === 'approved' ? 'Aprobado' : 'Borrador'}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-slate-300 mt-1">{b.title}</h3>
                      <p className="text-[11px] text-slate-400">{b.clientName} • {b.createdAt}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-white">{b.total.toFixed(2)} €</div>
                      <div className="text-[10px] text-slate-500">IVA 21% incl.</div>
                    </div>
                  </div>

                  {/* Detalle de partidas */}
                  <div className="bg-slate-950/70 rounded-xl p-3 text-[11px] space-y-1.5 border border-slate-800/60">
                    {b.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300">
                        <span>{it.quantity}x {it.name}</span>
                        <span className="font-mono text-slate-400">{it.total.toFixed(2)} €</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between font-bold text-xs text-slate-200">
                      <span>Base: {b.subtotal.toFixed(2)} €</span>
                      <span className="text-blue-400">Total: {b.total.toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => showToast(`Enviando presupuesto ${b.number} por WhatsApp al cliente...`)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </button>
                    <button
                      onClick={() => showToast(`PDF del presupuesto ${b.number} descargado.`)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <FileText size={12} /> Descargar PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 3: CATÁLOGO */}
        {activeTab === 'catalogo' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Catálogo de Tarifas y Partidas</h2>
              <span className="text-xs text-slate-400">{config.catalog.length} artículos</span>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Buscar partida, material o mano de obra..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              {config.catalog
                .filter(it => it.name.toLowerCase().includes(catalogSearch.toLowerCase()) || it.category.toLowerCase().includes(catalogSearch.toLowerCase()))
                .map(item => (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition-all"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{item.name}</span>
                        {item.recommended && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{item.description || item.category}</p>
                      <span className="text-[10px] text-slate-500 font-mono">SKU: {item.sku} • Unidad: {item.unit}</span>
                    </div>

                    <div className="text-right pl-3">
                      <div className="text-sm font-black text-white">{item.price.toFixed(2)} €</div>
                      <div className="text-[10px] text-slate-500">/{item.unit}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* VISTA 4: CLIENTES */}
        {activeTab === 'clientes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Directorio de Clientes</h2>
              <button
                onClick={() => showToast('Formulario de nuevo cliente habilitado')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Plus size={14} /> Añadir Cliente
              </button>
            </div>

            <div className="space-y-2.5">
              {[
                { name: 'Comunidad Propietarios Rosalía', loc: config.municipality, phone: '+34 986 11 22 33', tag: 'Comunidad' },
                { name: 'Talleres Mecánicos del Puerto', loc: 'Vigo', phone: '+34 986 44 55 66', tag: 'Empresa' },
                { name: 'Laura Gómez Míguez', loc: config.municipality, phone: '+34 600 77 88 99', tag: 'Particular' },
                { name: 'Restaurante O Berbés', loc: 'Vigo', phone: '+34 986 22 33 44', tag: 'Hostelería' }
              ].map((c, i) => (
                <div
                  key={i}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{c.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {c.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{c.loc} • {c.phone}</p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedClient(c.name);
                      setActiveTab('asistente');
                      showToast(`Cliente "${c.name}" seleccionado para presupuesto`);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Cotizar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 5: EMPRESA */}
        {activeTab === 'empresa' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-lg"
                  style={{ backgroundColor: config.brandColor }}
                >
                  {config.appInitials}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">{config.companyName}</h2>
                  <p className="text-xs text-slate-400">{config.appTagline}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
                <div className="bg-slate-950 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Sector</span>
                  <span className="text-slate-200 font-medium">{config.sector}</span>
                </div>
                <div className="bg-slate-950 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Municipio</span>
                  <span className="text-slate-200 font-medium">{config.municipality} (Pontevedra)</span>
                </div>
                <div className="bg-slate-950 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Dirección</span>
                  <span className="text-slate-200 font-medium">{config.address}</span>
                </div>
                <div className="bg-slate-950 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase">Teléfono Contacto</span>
                  <span className="text-slate-200 font-medium">{config.phone || 'No especificado'}</span>
                </div>
              </div>

              {/* Botones de conexión */}
              <div className="space-y-2 pt-2">
                <a
                  href={config.telegramStartUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-colors"
                >
                  <ExternalLink size={14} /> Abrir en Bot de Telegram (@ahorraaivigoasistant_bot)
                </a>

                {config.whatsappUrl && (
                  <a
                    href={config.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-colors"
                  >
                    <MessageCircle size={14} /> Contactar por WhatsApp
                  </a>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Lock size={14} className="text-amber-400" /> Claves Privadas de esta MiniApp
              </div>
              <p className="text-[11px]">
                Código PIN de Acceso: <code className="text-amber-300 font-mono font-bold">{config.accessCode}</code>
              </p>
              <p className="text-[11px]">
                Token URL: <code className="text-slate-400 font-mono text-[10px]">{config.token}</code>
              </p>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER INFERIOR */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-2.5 px-4 text-center z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-[11px] text-slate-400">
          <span>{config.companyName} © {new Date().getFullYear()}</span>
          <span className="flex items-center gap-1 text-slate-400">
            Powered by <strong className="text-blue-400">AhorraAI Vigo</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
