import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Receipt, 
  Users, 
  Package, 
  Settings, 
  Sparkles, 
  Plus, 
  Printer, 
  ExternalLink, 
  Copy, 
  RotateCw, 
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Send,
  Building2,
  ChevronRight,
  Eye,
  Mail,
  X
} from 'lucide-react';
import { adminFetch } from '../../../lib/apiAuth';
import PrintTemplate from './components/PrintTemplate';
import DocumentEditor from './components/DocumentEditor';
import EmailModal from './components/EmailModal';

// Declare Telegram WebApp types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        openLink?: (url: string) => void;
        MainButton: any;
        BackButton: any;
        initDataUnsafe?: any;
        colorScheme?: 'light' | 'dark';
      };
    };
  }
}

export default function ObraClimaMiniApp() {
  const [activeTab, setActiveTab] = useState<'presupuestos' | 'facturas' | 'ai' | 'clientes' | 'catalogo' | 'config'>('presupuestos');
  const [budgets, setBudgets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    companyName: 'OBRA-CLIMA S.L.',
    nif: 'B75571059',
    address: 'RÚA ESCULTOR NOGUEIRA, Nº 4-BAJO',
    postalCode: '36205',
    city: 'VIGO',
    province: 'PONTEVEDRA',
    iban: 'ES39 2080 5025 3130 4004 4857',
    defaultIva: 21
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<{ doc: any; type: 'presupuesto' | 'factura' } | null>(null);
  const [emailModalDoc, setEmailModalDoc] = useState<{ doc: any; type: 'presupuesto' | 'factura' } | null>(null);
  const [editorMode, setEditorMode] = useState<'presupuesto' | 'factura' | null>(null);

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState('');

  // Telegram WebApp detection
  const isTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initDataUnsafe?.user;
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  useEffect(() => {
    // Notify Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    // Set auth token in localStorage for adminFetch
    localStorage.setItem('obraclima_token', 'obraclima-telegram-miniapp');

    loadData();

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['presupuestos', 'facturas', 'ai', 'clientes', 'catalogo', 'config'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
    const docId = params.get('id');
    if (docId) {
      // Auto open doc if requested
      adminFetch(`/api/obraclima/budgets`).then(r => r.json()).then(bList => {
        const found = bList.find((b: any) => b.id === docId);
        if (found) setSelectedDoc({ doc: found, type: 'presupuesto' });
      }).catch(console.error);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bRes, iRes, cRes, catRes, confRes] = await Promise.all([
        adminFetch('/api/obraclima/budgets').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/invoices').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/clients').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/catalog').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/config').then(r => r.json()).catch(() => null)
      ]);

      setBudgets(Array.isArray(bRes) ? bRes : []);
      setInvoices(Array.isArray(iRes) ? iRes : []);
      setClients(Array.isArray(cRes) ? cRes : []);
      setCatalog(Array.isArray(catRes) ? catRes : []);
      if (confRes) setConfig(confRes);
    } catch (err) {
      console.error('[ObraClimaMiniApp Load Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAI = async (promptToUse?: string) => {
    const text = promptToUse || aiPrompt;
    if (!text.trim()) return;

    setAiGenerating(true);
    setAiSuccessMsg('');
    try {
      const res = await adminFetch('/api/obraclima/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text })
      });
      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'No se pudo interpretar el presupuesto');
      }

      // Create budget
      const parsed = data.data;
      const createRes = await adminFetch('/api/obraclima/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: parsed.customer || { name: 'Cliente Particular', city: 'Vigo' },
          items: parsed.items || [],
          notes: parsed.notes || ''
        })
      });
      const newBudget = await createRes.json();

      setAiSuccessMsg(`¡Presupuesto ${newBudget.number} generado con éxito por la IA!`);
      setAiPrompt('');
      await loadData();
      
      // Auto open created budget
      setSelectedDoc({ doc: newBudget, type: 'presupuesto' });
    } catch (err: any) {
      alert(`Error generando presupuesto con IA: ${err.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleConvertToInvoice = async (budgetId: string) => {
    if (!window.confirm('¿Convertir este presupuesto a factura oficial emitida?')) return;
    try {
      const res = await adminFetch(`/api/obraclima/budgets/${budgetId}/convert`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.invoice) {
        alert(`¡Factura ${data.invoice.number} emitida con éxito!`);
        await loadData();
        setSelectedDoc({ doc: data.invoice, type: 'factura' });
      }
    } catch (err: any) {
      alert(`Error al facturar: ${err.message}`);
    }
  };

  const filteredBudgets = budgets.filter(b => {
    const q = searchQuery.toLowerCase();
    const name = (b.customer?.name || b.client?.name || '').toLowerCase();
    const num = (b.number || '').toLowerCase();
    return name.includes(q) || num.includes(q);
  });

  const filteredInvoices = invoices.filter(i => {
    const q = searchQuery.toLowerCase();
    const name = (i.customer?.name || i.client?.name || '').toLowerCase();
    const num = (i.number || '').toLowerCase();
    return name.includes(q) || num.includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-20">
      
      {/* TOP BAR / HEADER */}
      <header className="bg-slate-800/95 border-b border-slate-700/80 sticky top-0 z-40 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20">
              OC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-base leading-none">ObraClima AI</h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {isTelegram ? 'MiniApp Telegram' : 'Web & Bot'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Gestión de Presupuestos y Facturación</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://web.telegram.org/k/#@ahorraaivigoasistant_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
              title="Abrir bot en Telegram Web"
            >
              <span>Telegram Web</span>
              <ExternalLink size={12} />
            </a>

            <button 
              onClick={loadData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors"
              title="Actualizar datos"
            >
              <RotateCw size={18} className={loading ? 'animate-spin text-blue-400' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* SEARCH BAR (Visible on Presupuestos and Facturas) */}
      {(activeTab === 'presupuestos' || activeTab === 'facturas') && (
        <div className="max-w-4xl w-full mx-auto px-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder={`Buscar en ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4">

        {/* TAB 1: PRESUPUESTOS */}
        {activeTab === 'presupuestos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Presupuestos ({filteredBudgets.length})</h2>
                <p className="text-xs text-slate-400">Presupuestos vigentes de ObraClima</p>
              </div>
              <button 
                onClick={() => setEditorMode('presupuesto')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                <Plus size={16} />
                <span>Nuevo</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <RotateCw size={18} className="animate-spin text-blue-400" />
                <span>Cargando presupuestos...</span>
              </div>
            ) : filteredBudgets.length === 0 ? (
              <div className="py-12 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-center px-4">
                <FileText className="mx-auto text-slate-500 mb-2" size={32} />
                <p className="text-sm font-medium text-slate-300">No hay presupuestos que coincidan</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">Crea uno rápidamente con el Asistente IA</p>
                <button 
                  onClick={() => setActiveTab('ai')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  <Sparkles size={14} />
                  <span>Crear Presupuesto con IA</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredBudgets.map((b) => (
                  <div 
                    key={b.id} 
                    className="bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm bg-slate-700/60 px-2 py-0.5 rounded">
                            {b.number}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.convertedToInvoice 
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                              : b.status === 'Aprobado' 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {b.convertedToInvoice ? `Facturado (${b.invoiceReference})` : (b.status || 'Borrador')}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-100 text-base mt-1.5">
                          {b.customer?.name || b.client?.name || 'Cliente Particular'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {b.customer?.address || b.client?.address || 'Vigo'} • {new Date(b.date).toLocaleDateString('es-ES')}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Total</span>
                        <span className="font-bold text-lg text-emerald-400">
                          {(b.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-400">
                        {b.items?.length || 0} partida(s)
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedDoc({ doc: b, type: 'presupuesto' })}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                          <span>Ver / PDF</span>
                        </button>

                        <button
                          onClick={() => setEmailModalDoc({ doc: b, type: 'presupuesto' })}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                          title="Enviar presupuesto por correo a administracion@obraclima.com y ahorraai@gmail.com"
                        >
                          <Mail size={13} />
                          <span>Email</span>
                        </button>

                        {!b.convertedToInvoice && (
                          <button
                            onClick={() => handleConvertToInvoice(b.id)}
                            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                          >
                            <Copy size={14} />
                            <span>Facturar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FACTURAS */}
        {activeTab === 'facturas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Facturas Emitidas ({filteredInvoices.length})</h2>
                <p className="text-xs text-slate-400">Histórico de facturas de ObraClima</p>
              </div>
              <button 
                onClick={() => setEditorMode('factura')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                <Plus size={16} />
                <span>Nueva Directa</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <RotateCw size={18} className="animate-spin text-blue-400" />
                <span>Cargando facturas...</span>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-12 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-center px-4">
                <Receipt className="mx-auto text-slate-500 mb-2" size={32} />
                <p className="text-sm font-medium text-slate-300">No hay facturas emitidas todavía</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">Convierte un presupuesto con el botón "Facturar"</p>
                <button 
                  onClick={() => setActiveTab('presupuestos')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  <FileText size={14} />
                  <span>Ver Presupuestos</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredInvoices.map((inv) => (
                  <div 
                    key={inv.id} 
                    className="bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm bg-purple-900/60 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded">
                            {inv.number}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Emitida
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-100 text-base mt-1.5">
                          {inv.customer?.name || inv.client?.name || 'Cliente Particular'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {inv.customer?.address || inv.client?.address || 'Vigo'} • {new Date(inv.date).toLocaleDateString('es-ES')}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Total</span>
                        <span className="font-bold text-lg text-emerald-400">
                          {(inv.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {inv.budgetReference ? `Ref: Presupuesto ${inv.budgetReference}` : 'Factura Directa'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedDoc({ doc: inv, type: 'factura' })}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                          <span>Ver / PDF</span>
                        </button>

                        <button
                          onClick={() => setEmailModalDoc({ doc: inv, type: 'factura' })}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                          title="Enviar factura por correo a administracion@obraclima.com y ahorraai@gmail.com"
                        >
                          <Mail size={13} />
                          <span>Email</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ASISTENTE IA (CREAR PRESUPUESTO INTELIGENTE) */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-900/40 via-slate-800 to-indigo-900/40 border border-blue-500/30 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center text-white">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">Asistente Inteligente ObraClima</h2>
                  <p className="text-xs text-slate-300">Genera presupuestos estructurados en segundos</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Escribe en lenguaje natural lo que necesitas presupuestar. La IA identificará los equipos, partidas de instalación, cruzará con el catálogo de precios y calculará la base imponible y el 21% de IVA.
              </p>

              {aiSuccessMsg && (
                <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{aiSuccessMsg}</span>
                </div>
              )}

              {/* Prompt box */}
              <div className="relative">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ej: Presupuesto para Juan Pérez en Calle Rosalía de Castro: instalación de 2 splits Daikin en salón y dormitorio con línea frigorífica y soportes antivibración..."
                  rows={4}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 leading-relaxed resize-none shadow-inner"
                />

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {catalog.length} artículos en catálogo
                  </span>

                  <button
                    onClick={() => handleCreateAI()}
                    disabled={aiGenerating || !aiPrompt.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all"
                  >
                    {aiGenerating ? (
                      <>
                        <RotateCw size={14} className="animate-spin" />
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Generar Presupuesto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Example Prompts */}
              <div className="mt-4 pt-4 border-t border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-400 block mb-2">Ejemplos rápidos:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Instalación de 2 splits FREEO de 3.5 kw y 5 kw para Mari Carmen",
                    "Split Daikin Sensira con 5m de línea frigorífica y soporte",
                    "Mantenimiento preventivo anual de climatización para local en Vigo"
                  ].map((ex, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleCreateAI(ex)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-left transition-colors"
                    >
                      ⚡ {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CLIENTES */}
        {activeTab === 'clientes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Clientes ({clients.length})</h2>
                <p className="text-xs text-slate-400">Directorio de clientes de ObraClima</p>
              </div>
            </div>

            <div className="grid gap-3">
              {clients.map((c) => (
                <div key={c.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base">{c.name}</h3>
                      <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                        <p>📍 {c.address || 'Sin dirección'}, {c.city || 'Vigo'} {c.postalCode ? `(${c.postalCode})` : ''}</p>
                        <p>🆔 NIF: <span className="font-mono text-slate-400">{c.nif || 'No especificado'}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CATÁLOGO */}
        {activeTab === 'catalogo' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Catálogo de Tarifas ({catalog.length})</h2>
              <p className="text-xs text-slate-400">Precios de referencia utilizados por la IA</p>
            </div>

            <div className="grid gap-3">
              {catalog.map((item) => (
                <div key={item.id || item.code} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div className="pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded border border-blue-800/50">
                        {item.code}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                        {item.category || 'General'}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white leading-snug">{item.name}</h3>
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <div className="font-bold text-base text-emerald-400">
                      {Number(item.price).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </div>
                    <div className="text-[10px] text-slate-400">por {item.unit} (+{item.iva || 21}% IVA)</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: CONFIGURACIÓN FISCAL */}
        {activeTab === 'config' && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Datos Fiscales de ObraClima</h2>
              <p className="text-xs text-slate-400">Información legal que aparece en los PDFs de facturas y presupuestos</p>
            </div>

            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/60 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Razón Social:</span>
                <span className="font-bold text-white">{config.companyName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">N.I.F.:</span>
                <span className="font-mono font-bold text-white">{config.nif}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Dirección:</span>
                <span className="text-white">{config.address}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Población / CP:</span>
                <span className="text-white">{config.postalCode} {config.city} ({config.province})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">IBAN:</span>
                <span className="font-mono font-bold text-blue-400">{config.iban}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">IVA Aplicable:</span>
                <span className="font-bold text-white">{config.defaultIva}%</span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION BAR (Mobile & Telegram MiniApp Standard) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800/95 border-t border-slate-700/80 backdrop-blur-lg z-40 py-2 px-3">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {[
            { id: 'presupuestos', label: 'Presupuestos', icon: FileText },
            { id: 'facturas', label: 'Facturas', icon: Receipt },
            { id: 'ai', label: 'Asistente IA', icon: Sparkles, highlight: true },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'catalogo', label: 'Catálogo', icon: Package },
            { id: 'config', label: 'Empresa', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center gap-1 transition-colors px-2 py-1 rounded-lg ${
                  isActive 
                    ? tab.highlight ? 'text-blue-400 font-bold' : 'text-blue-400 font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-lg ${tab.highlight ? 'bg-blue-600/30 text-blue-300' : ''}`}>
                  <Icon size={18} />
                </div>
                <span className="text-[10px] whitespace-nowrap leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* DOCUMENT PREVIEW & PDF MODAL */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto flex flex-col">
          {/* Modal Header */}
          <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 flex items-center justify-between print:hidden">
            <div>
              <h3 className="text-white font-bold text-base">
                {selectedDoc.type === 'factura' ? 'Factura' : 'Presupuesto'} {selectedDoc.doc.number}
              </h3>
              <p className="text-xs text-slate-400">{selectedDoc.doc.customer?.name || selectedDoc.doc.client?.name}</p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/print/${selectedDoc.type}/${selectedDoc.doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <span>Pestaña nueva</span>
                <ExternalLink size={14} />
              </a>

              <button
                onClick={() => setEmailModalDoc({ doc: selectedDoc.doc, type: selectedDoc.type })}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-colors"
                title="Enviar por correo a administracion@obraclima.com y ahorraai@gmail.com"
              >
                <Mail size={14} />
                <span>Enviar por Correo</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Printer size={14} />
                <span>Imprimir / PDF</span>
              </button>

              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 p-4 print:p-0 flex justify-center bg-slate-950/60 print:bg-white">
            <div className="max-w-[800px] w-full bg-white shadow-2xl rounded-sm print:shadow-none">
              <PrintTemplate 
                data={selectedDoc.doc} 
                type={selectedDoc.type} 
                config={config} 
                preview={true} 
              />
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT EDITOR MODAL */}
      {editorMode && (
        <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto p-4">
          <DocumentEditor
            type={editorMode}
            clients={clients}
            catalog={catalog}
            config={config}
            onSave={async (data) => {
              const endpoint = editorMode === 'factura' ? '/api/obraclima/invoices' : '/api/obraclima/budgets';
              await adminFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              setEditorMode(null);
              await loadData();
            }}
            onCancel={() => setEditorMode(null)}
          />
        </div>
      )}

      {/* EMAIL DISPATCH MODAL */}
      {emailModalDoc && (
        <EmailModal
          isOpen={!!emailModalDoc}
          onClose={() => setEmailModalDoc(null)}
          doc={emailModalDoc.doc}
          type={emailModalDoc.type}
          config={config}
        />
      )}

    </div>
  );
}
