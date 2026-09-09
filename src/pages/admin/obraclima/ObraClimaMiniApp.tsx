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
  X,
  UserPlus,
  ShieldCheck,
  Phone,
  Link2,
  AlertCircle,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check
} from 'lucide-react';
import { adminFetch } from '../../../lib/apiAuth';
import PrintTemplate from './components/PrintTemplate';
import DocumentEditor from './components/DocumentEditor';
import EmailModal from './components/EmailModal';
import NewClientModal from './components/NewClientModal';
import { ProspectedList } from './components/ProspectedList';

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
  const [selectedClientId, setSelectedClientId] = useState<string>('c1');
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  // Catálogo y Cerebro IA / Prospectados State
  const [catalogSubView, setCatalogSubView] = useState<'oficial' | 'prospectados'>('oficial');
  const [prospectados, setProspectados] = useState<any[]>([]);
  const [loadingProspectados, setLoadingProspectados] = useState(false);
  const [prospectadosSearch, setProspectadosSearch] = useState('');
  const [expandedDescId, setExpandedDescId] = useState<string | null>(null);

  // Modal / Formulario para incorporar producto a tarifas oficiales
  const [showAddOfficialModal, setShowAddOfficialModal] = useState(false);
  const [officialFormData, setOfficialFormData] = useState({
    code: '',
    name: '',
    category: 'Equipos',
    price: 0,
    unit: 'ud'
  });
  const [savingOfficial, setSavingOfficial] = useState(false);
  const [officialSuccessMsg, setOfficialSuccessMsg] = useState<string | null>(null);

  // Estado para Ingresar Producto por URL o HTML (Scraper Universal y Masivo)
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [scrapeMode, setScrapeMode] = useState<'url' | 'html'>('url');
  const [scrapeUrlInput, setScrapeUrlInput] = useState('');
  const [scrapeHtmlInput, setScrapeHtmlInput] = useState('');
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);
  const [lastScrapedProduct, setLastScrapedProduct] = useState<any | null>(null);

  const loadProspectados = async () => {
    setLoadingProspectados(true);
    try {
      const res = await adminFetch('/api/obraclima/prospectados');
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        setProspectados(data.items);
      }
    } catch (err) {
      console.warn('Error cargando prospectados:', err);
    } finally {
      setLoadingProspectados(false);
    }
  };

  const handleMiniScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scrapeMode === 'url' && !scrapeUrlInput.trim()) return;
    if (scrapeMode === 'html' && !scrapeHtmlInput.trim()) return;
    setScrapingUrl(true);
    setScrapeMsg(null);
    setScrapeErr(null);
    setLastScrapedProduct(null);
    try {
      let endpoint = '/api/obraclima/prospectar-url';
      let body: any = { url: scrapeUrlInput.trim() };

      if (scrapeMode === 'html') {
        endpoint = '/api/obraclima/prospectar-html';
        body = { html: scrapeHtmlInput.trim(), url: scrapeUrlInput.trim() || undefined };
      }

      const res = await adminFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar la prospección del producto o dominio.');
      }
      setScrapeMsg(data.message);
      if (data.product || data.sampleProduct) {
        setLastScrapedProduct(data.product || data.sampleProduct);
      }
      if (scrapeMode === 'url') setScrapeUrlInput('');
      if (scrapeMode === 'html') setScrapeHtmlInput('');

      // Recargar lista de prospectados para ver de inmediato el producto ingresado
      await loadProspectados();
    } catch (err: any) {
      setScrapeErr(err.message || 'Error al conectar con el scraper.');
    } finally {
      setScrapingUrl(false);
    }
  };

  const handleAdoptToOfficial = (item: any) => {
    const newCode = item.sku || `PR-${Math.floor(1000 + Math.random() * 9000)}`;
    setOfficialFormData({
      code: newCode,
      name: item.nombre,
      category: item.categoria || 'Equipos',
      price: Number(item.precio) || 0,
      unit: 'ud'
    });
    setOfficialSuccessMsg(null);
    setShowAddOfficialModal(true);
  };

  const handleSaveOfficialItem = async () => {
    if (!officialFormData.name.trim()) return;
    setSavingOfficial(true);
    setOfficialSuccessMsg(null);
    try {
      const res = await adminFetch('/api/obraclima/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(officialFormData)
      });
      const newItem = await res.json();
      setCatalog(prev => [...prev, newItem]);
      setOfficialSuccessMsg(`¡"${officialFormData.name}" incorporado con éxito a las tarifas oficiales!`);
      setTimeout(() => {
        setShowAddOfficialModal(false);
        setOfficialSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      alert(`Error guardando en tarifas oficiales: ${err.message}`);
    } finally {
      setSavingOfficial(false);
    }
  };

  const handleOpenProductUrl = (url: string) => {
    if (!url) return;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Telegram WebApp detection
  const isTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initDataUnsafe?.user;
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  useEffect(() => {
    // Notify Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const rawInitData = (window.Telegram.WebApp as any).initData;
      if (rawInitData) {
        localStorage.setItem('obraclima_telegram_init_data', rawInitData);
      }
    }

    loadData();

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['presupuestos', 'facturas', 'ai', 'clientes', 'catalogo', 'config', 'prospectados', 'cerebroia'].includes(tabParam)) {
      if (tabParam === 'prospectados' || tabParam === 'cerebroia') {
        setActiveTab('catalogo');
        setCatalogSubView('prospectados');
      } else {
        setActiveTab(tabParam as any);
      }
    }
    const subtabParam = params.get('subtab');
    if (subtabParam === 'prospectados' || subtabParam === 'cerebroia') {
      setActiveTab('catalogo');
      setCatalogSubView('prospectados');
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
      const [bRes, iRes, cRes, catRes, confRes, prospRes] = await Promise.all([
        adminFetch('/api/obraclima/budgets').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/invoices').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/clients').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/catalog').then(r => r.json()).catch(() => []),
        adminFetch('/api/obraclima/config').then(r => r.json()).catch(() => null),
        adminFetch('/api/obraclima/prospectados').then(r => r.json()).catch(() => ({ items: [] }))
      ]);

      setBudgets(Array.isArray(bRes) ? bRes : []);
      setInvoices(Array.isArray(iRes) ? iRes : []);
      setClients(Array.isArray(cRes) ? cRes : []);
      setCatalog(Array.isArray(catRes) ? catRes : []);
      if (confRes) setConfig(confRes);
      if (prospRes && Array.isArray(prospRes.items)) {
        setProspectados(prospRes.items);
      }
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
      const clientIdToUse = selectedClientId || clients[0]?.id || 'c1';

      // Llamada al backend seguro con desacoplamiento RGPD:
      // La IA solo recibe datos técnicos seudonimizados; el backend fusiona el cliente localmente.
      const res = await adminFetch('/api/obraclima/generate-budget-rgpd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicalPrompt: text,
          clientId: clientIdToUse
        })
      });
      const data = await res.json();
      if (!data.success || !data.budget) {
        throw new Error(data.error || 'No se pudo generar el presupuesto con IA');
      }

      const newBudget = data.budget;
      setAiSuccessMsg(`¡Presupuesto ${newBudget.number} generado y ensamblado con éxito (Protegido RGPD)!`);
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

  const filteredProspectados = prospectados.filter(p => {
    if (!prospectadosSearch.trim()) return true;
    const term = prospectadosSearch.toLowerCase();
    return (
      (p.nombre || '').toLowerCase().includes(term) ||
      (p.sku || '').toLowerCase().includes(term) ||
      (p.categoria || '').toLowerCase().includes(term) ||
      (p.descripcion || '').toLowerCase().includes(term) ||
      (p.origen_url || '').toLowerCase().includes(term)
    );
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
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-all"
                          title="Enviar presupuesto con PDF oficial adjunto de forma nativa"
                        >
                          <Send size={13} />
                          <span>Enviar Presupuesto</span>
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

              {/* Selector de Cliente para Fusión Backend RGPD */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Asignar Cliente al Presupuesto:</span>
                  <span className="text-[10px] text-emerald-400 font-medium">🛡️ RGPD: Datos no viajan a la IA</span>
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-400"
                >
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.city ? `(${c.city})` : ''} {c.nif ? `- ${c.nif}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prompt box */}
              <div className="relative">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ej: Instalación de 2 splits Daikin en salón y dormitorio con 5m de línea frigorífica de cobre y soportes antivibración (solo datos técnicos de obra)..."
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
              <button
                onClick={() => setShowNewClientModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Nuevo Cliente</span>
              </button>
            </div>

            {/* Aviso informativo de cumplimiento RGPD e IA en Directorio */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Protección RGPD & Aislamiento de IA: </span>
                <span className="text-slate-400 text-[11px] leading-relaxed">
                  Los datos identificativos de los clientes se almacenan cifrados y nunca se comparten con modelos de Inteligencia Artificial.
                </span>
              </div>
            </div>

            <div className="grid gap-3">
              {clients.map((c) => (
                <div key={c.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 transition-all hover:border-slate-600">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-white text-base">{c.name}</h3>
                        <span className="text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> RGPD Seguro
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 space-y-1 mt-1.5">
                        <p className="flex items-center gap-1.5 text-slate-300">
                          <span>📍</span>
                          <span>{c.address || 'Sin dirección postal'}, {c.city || 'Vigo'} {c.postalCode ? `(${c.postalCode})` : ''}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span>🆔</span>
                          <span>NIF: <strong className="font-mono text-slate-200">{c.nif || 'No especificado'}</strong></span>
                        </p>
                        {c.phone && (
                          <p className="flex items-center gap-1.5 text-slate-300">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a href={`tel:${c.phone}`} className="text-blue-400 hover:underline">{c.phone}</a>
                          </p>
                        )}
                        {c.email && (
                          <p className="flex items-center gap-1.5 text-slate-300">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <a href={`mailto:${c.email}`} className="text-blue-400 hover:underline">{c.email}</a>
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setActiveTab('ai');
                      }}
                      className="shrink-0 bg-slate-900/90 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-slate-700 hover:border-blue-500/50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                      title="Generar presupuesto con IA para este cliente"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Presupuesto IA</span>
                    </button>
                  </div>
                </div>
              ))}

              {clients.length === 0 && (
                <div className="p-8 text-center bg-slate-800/40 rounded-xl border border-slate-700 text-slate-400 text-xs">
                  No hay clientes registrados en el directorio.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CATÁLOGO Y CEREBRO IA / PROSPECTADOS */}
        {activeTab === 'catalogo' && (
          <div className="space-y-4">
            {/* Header del apartado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>
                    {catalogSubView === 'oficial' 
                      ? `Tarifas Oficiales ObraClima (${catalog.length})` 
                      : `Cerebro IA / Prospectados (${prospectados.length})`}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {catalogSubView === 'oficial'
                    ? 'Precios y partidas oficiales utilizadas en presupuestos y facturación'
                    : 'Referencias y precios de mercado extraídos automáticamente de proveedores'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUrlModal(!showUrlModal);
                    setScrapeMsg(null);
                    setScrapeErr(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                  title="Extraer productos desde URL o código HTML de proveedores"
                >
                  <Link2 size={14} />
                  <span>Ingresar Producto / Dominio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOfficialFormData({
                      code: `PR-${Math.floor(1000 + Math.random() * 9000)}`,
                      name: '',
                      category: 'Equipos',
                      price: 0,
                      unit: 'ud'
                    });
                    setOfficialSuccessMsg(null);
                    setShowAddOfficialModal(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                  title="Añadir nuevo ítem al catálogo oficial"
                >
                  <Plus size={14} />
                  <span>Nuevo Ítem Oficial</span>
                </button>
              </div>
            </div>

            {/* Selector de Subvistas: Tarifas Oficiales vs Cerebro IA / Prospectados */}
            <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setCatalogSubView('oficial')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  catalogSubView === 'oficial'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Layers size={14} />
                <span>Tarifas Oficiales ({catalog.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCatalogSubView('prospectados')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  catalogSubView === 'prospectados'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800/80'
                }`}
              >
                <Database size={14} />
                <span>Cerebro IA / Prospectados ({prospectados.length})</span>
              </button>
            </div>

            {/* Panel de Prospección Inteligente (URL o HTML) */}
            {showUrlModal && (
              <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Link2 size={15} />
                      <span>Prospección y Captura Inteligente</span>
                    </span>
                    <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/60 font-mono">
                      Cerebro IA ObraClima
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUrlModal(false);
                      setScrapeMsg(null);
                      setScrapeErr(null);
                      setLastScrapedProduct(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Modos de Prospección: URL vs HTML DevTools */}
                <div className="flex gap-2 text-xs border-b border-emerald-800/50 pb-2">
                  <button
                    type="button"
                    onClick={() => setScrapeMode('url')}
                    className={`px-3 py-1 rounded font-semibold transition ${
                      scrapeMode === 'url' ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:bg-emerald-900/40'
                    }`}
                  >
                    Por URL o Dominio
                  </button>
                  <button
                    type="button"
                    onClick={() => setScrapeMode('html')}
                    className={`px-3 py-1 rounded font-semibold transition ${
                      scrapeMode === 'html' ? 'bg-emerald-700 text-white' : 'text-emerald-300 hover:bg-emerald-900/40'
                    }`}
                  >
                    Pegar HTML (Inspector)
                  </button>
                </div>

                <form onSubmit={handleMiniScrape} className="space-y-2.5">
                  {scrapeMode === 'url' ? (
                    <div>
                      <p className="text-[11px] text-slate-300 mb-1.5">
                        Introduce la URL de un producto o el dominio principal de la tienda (ej. <em>https://www.bricocentrovigo.es/...</em>).
                        El sistema extrae precio, referencia, descripción técnica y lo sincroniza con el Cerebro IA.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          required
                          placeholder="https://www.bricocentrovigo.es/ o URL producto..."
                          value={scrapeUrlInput}
                          onChange={(e) => setScrapeUrlInput(e.target.value)}
                          className="flex-1 bg-slate-900 border border-emerald-800/60 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          disabled={scrapingUrl}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shrink-0 disabled:opacity-50 transition flex items-center gap-1.5"
                        >
                          {scrapingUrl ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Extrayendo...</span>
                            </>
                          ) : (
                            <span>Prospectar</span>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] text-slate-300 mb-1.5">
                        Pega el código HTML de la ficha del producto copiado desde las DevTools del navegador.
                        El parser extraerá de inmediato título, precio, referencia y características técnicas.
                      </p>
                      <textarea
                        required
                        rows={4}
                        placeholder="Pega aquí el código HTML (<div class='product-info'>...)"
                        value={scrapeHtmlInput}
                        onChange={(e) => setScrapeHtmlInput(e.target.value)}
                        className="w-full bg-slate-900 border border-emerald-800/60 rounded-lg p-2.5 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <div className="flex gap-2 mt-2">
                        <input
                          type="url"
                          placeholder="URL de origen (opcional, para guardar el enlace directo)"
                          value={scrapeUrlInput}
                          onChange={(e) => setScrapeUrlInput(e.target.value)}
                          className="flex-1 bg-slate-900 border border-emerald-800/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          disabled={scrapingUrl}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shrink-0 disabled:opacity-50 transition flex items-center gap-1.5"
                        >
                          {scrapingUrl ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Procesando...</span>
                            </>
                          ) : (
                            <span>Procesar HTML</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form>

                {scrapeMsg && (
                  <div className="p-2.5 bg-emerald-900/50 border border-emerald-600/60 rounded-lg text-xs text-emerald-200 flex items-start gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{scrapeMsg}</span>
                  </div>
                )}

                {scrapeErr && (
                  <div className="p-2.5 bg-red-900/50 border border-red-600/60 rounded-lg text-xs text-red-200 flex items-start gap-1.5">
                    <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                    <span>{scrapeErr}</span>
                  </div>
                )}

                {lastScrapedProduct && (
                  <div className="p-3 bg-slate-900/90 border border-emerald-500/40 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Ref: {lastScrapedProduct.sku || 'S/R'}
                      </span>
                      <span className="text-emerald-300 font-bold text-sm">
                        {Number(lastScrapedProduct.precio).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </span>
                    </div>
                    <div className="font-semibold text-white">{lastScrapedProduct.nombre}</div>
                    {lastScrapedProduct.descripcion && (
                      <div className="text-[11px] text-slate-300 bg-slate-800/70 p-2 rounded border border-slate-700 max-h-24 overflow-y-auto whitespace-pre-line">
                        {lastScrapedProduct.descripcion}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span>🧠 Sincronizado con el Cerebro de ObraClima</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdoptToOfficial(lastScrapedProduct)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <Plus size={12} />
                        <span>Añadir a Catálogo Oficial</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VISTA 1: CEREBRO IA / PROSPECTADOS */}
            {catalogSubView === 'prospectados' && (
              <ProspectedList
                items={prospectados}
                loading={loadingProspectados}
                onRefresh={loadProspectados}
                onAdoptToOfficial={handleAdoptToOfficial}
                onOpenUrl={handleOpenProductUrl}
              />
            )}

            {/* VISTA 2: TARIFAS OFICIALES */}
            {catalogSubView === 'oficial' && (
              <div className="space-y-3">
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

                  {catalog.length === 0 && (
                    <div className="p-8 text-center bg-slate-800/40 rounded-xl border border-slate-700 text-slate-400 text-xs">
                      No hay tarifas oficiales registradas aún.
                    </div>
                  )}
                </div>
              </div>
            )}
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
                title="Enviar presupuesto con PDF oficial adjunto de forma nativa"
              >
                <Send size={14} />
                <span>{selectedDoc.type === 'presupuesto' ? 'Enviar Presupuesto' : 'Enviar Factura'}</span>
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

      {/* NEW CLIENT MODAL (RGPD & AI ACT COMPLIANT) */}
      <NewClientModal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        onSaved={async (savedClient) => {
          await loadData();
          if (savedClient?.id) {
            setSelectedClientId(savedClient.id);
          }
        }}
      />

      {/* MODAL ADOPTAR A TARIFAS OFICIALES O CREAR NUEVO ÍTEM */}
      {showAddOfficialModal && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="text-blue-400" size={18} />
                <h3 className="text-base font-bold text-white">Incorporar a Tarifas Oficiales</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddOfficialModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {officialSuccessMsg ? (
              <div className="p-4 bg-emerald-950/80 border border-emerald-600 rounded-xl text-center space-y-2">
                <CheckCircle2 size={24} className="text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">{officialSuccessMsg}</p>
                <p className="text-xs text-emerald-300">Ya está disponible para presupuestos y facturación.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveOfficialItem();
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="block text-slate-400 mb-1">Código / Referencia:</label>
                  <input
                    type="text"
                    required
                    value={officialFormData.code}
                    onChange={(e) => setOfficialFormData({ ...officialFormData, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Nombre / Partida Oficial:</label>
                  <input
                    type="text"
                    required
                    value={officialFormData.name}
                    onChange={(e) => setOfficialFormData({ ...officialFormData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Categoría:</label>
                    <select
                      value={officialFormData.category}
                      onChange={(e) => setOfficialFormData({ ...officialFormData, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Equipos">Equipos</option>
                      <option value="Instalación">Instalación</option>
                      <option value="Material">Material</option>
                      <option value="Mano de Obra">Mano de Obra</option>
                      <option value="Servicios">Servicios</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Unidad:</label>
                    <input
                      type="text"
                      required
                      value={officialFormData.unit}
                      onChange={(e) => setOfficialFormData({ ...officialFormData, unit: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Precio (€):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={officialFormData.price}
                    onChange={(e) => setOfficialFormData({ ...officialFormData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddOfficialModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingOfficial}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingOfficial ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Guardar en Tarifas Oficiales</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
