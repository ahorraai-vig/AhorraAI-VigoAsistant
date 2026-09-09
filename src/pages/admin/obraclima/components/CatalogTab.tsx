import React, { useState, useEffect } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';
import { 
  Link2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Sparkles, 
  Database, 
  ExternalLink, 
  Code, 
  RefreshCw,
  Plus,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ProspectedList } from './ProspectedList';

export function CatalogTab({ catalog, refresh }: { catalog: any[], refresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [modalMode, setModalMode] = useState<'url' | 'html'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scraperMessage, setScraperMessage] = useState<string | null>(null);
  const [scraperError, setScraperError] = useState<string | null>(null);
  const [lastProduct, setLastProduct] = useState<any | null>(null);

  // Pestañas de visualización: Catálogo Oficial vs Prospectados (Cerebro IA)
  const [activeCatalogView, setActiveCatalogView] = useState<'oficial' | 'prospectados'>('oficial');
  const [prospectados, setProspectados] = useState<any[]>([]);
  const [loadingProspectados, setLoadingProspectados] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    price: 0,
    unit: 'ud'
  });
  const [saving, setSaving] = useState(false);

  // Cargar productos prospectados desde Supabase
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

  useEffect(() => {
    loadProspectados();
  }, []);

  const handleSave = async () => {
    if (!formData.name) return;
    setSaving(true);
    await adminFetch('/api/obraclima/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setSaving(false);
    setShowAdd(false);
    refresh();
  };

  const handleScrapeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'url' && !urlInput.trim()) return;
    if (modalMode === 'html' && !htmlInput.trim()) return;

    setScraping(true);
    setScraperMessage(null);
    setScraperError(null);
    setLastProduct(null);

    try {
      let endpoint = '/api/obraclima/prospectar-url';
      let body: any = { url: urlInput.trim() };

      if (modalMode === 'html') {
        endpoint = '/api/obraclima/prospectar-html';
        body = { html: htmlInput.trim(), url: urlInput.trim() || undefined };
      }

      const res = await adminFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar la prospección del producto o catálogo.');
      }

      setScraperMessage(data.message);
      if (data.product || data.sampleProduct) {
        setLastProduct(data.product || data.sampleProduct);
      }

      if (modalMode === 'url') setUrlInput('');
      if (modalMode === 'html') setHtmlInput('');

      // Recargar catálogo de prospección
      await loadProspectados();
    } catch (err: any) {
      setScraperError(err.message || 'Error al conectar con el scraper.');
    } finally {
      setScraping(false);
    }
  };

  // Traspasar producto prospectado al catálogo oficial
  const handleAdoptToOfficial = async (item: any) => {
    const newCode = item.sku || `PR-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      code: newCode,
      name: item.nombre,
      category: item.categoria || 'Equipos',
      price: item.precio,
      unit: 'ud'
    });
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-5xl">
      {/* Header y Acciones Principales */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Catálogo de Productos y Precios</h2>
          <p className="text-xs text-slate-500">Gestión de tarifas oficiales y prospección automatizada para el Cerebro de ObraClima</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón de Prospección Masiva / URL */}
          <button
            onClick={() => {
              setShowUrlModal(!showUrlModal);
              setScraperMessage(null);
              setScraperError(null);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1.5 text-sm transition shadow-sm"
          >
            <Sparkles size={16} />
            <span>Ingresar Producto / Dominio</span>
          </button>
          <button 
            onClick={() => setShowAdd(!showAdd)} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm flex items-center gap-1.5 transition"
          >
            <Plus size={16} />
            <span>Nuevo Ítem Oficial</span>
          </button>
        </div>
      </div>

      {/* Módulo de Prospección Inteligente (URL o Código HTML de Inspector) */}
      {showUrlModal && (
        <div className="bg-emerald-50/80 border border-emerald-200 p-5 rounded-xl mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-700" />
              <h3 className="font-bold text-emerald-900 text-sm">Prospección y Recolección de Datos de Proveedores</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Selector de Modo: URL o HTML */}
              <div className="flex rounded-lg border border-emerald-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setModalMode('url')}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    modalMode === 'url' ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  Por URL o Dominio
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('html')}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    modalMode === 'html' ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  Pegar HTML (Inspector)
                </button>
              </div>
              <button
                onClick={() => setShowUrlModal(false)}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2 py-1"
              >
                Cerrar
              </button>
            </div>
          </div>

          <p className="text-xs text-emerald-800 mb-3">
            {modalMode === 'url'
              ? 'Introduce la URL de un producto o el dominio principal de la tienda (ej. https://www.bricocentrovigo.es/ o https://tienda.com/producto/...). El sistema extrae precio, referencia, descripción técnica y lo sincroniza directamente en el Cerebro IA de ObraClima y Supabase.'
              : 'Pega el código HTML de la ficha del producto copiado desde las DevTools del navegador. El parser extraerá inmediatamente título, precio, referencia y características técnicas sin restricciones de red.'}
          </p>

          <form onSubmit={handleScrapeSubmit} className="space-y-3">
            {modalMode === 'url' ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  required
                  placeholder="https://www.bricocentrovigo.es/ o https://tienda.com/producto/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 p-2.5 bg-white border border-emerald-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={scraping}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {scraping ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Rastreando...</span>
                    </>
                  ) : (
                    <span>Extraer y Prospectar</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  placeholder="URL opcional de referencia (ej. https://www.bricocentrovigo.es/producto/...)"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400"
                />
                <textarea
                  rows={4}
                  required
                  placeholder="Pega aquí el código HTML (o fragmento con h1, precio y especificaciones)..."
                  value={htmlInput}
                  onChange={(e) => setHtmlInput(e.target.value)}
                  className="w-full p-2.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={scraping}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {scraping ? <Loader2 size={14} className="animate-spin" /> : <Code size={14} />}
                    <span>Procesar HTML con Parser Universal</span>
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Mensaje de Confirmación */}
          {scraperMessage && (
            <div className="mt-3 p-3 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>{scraperMessage}</span>
            </div>
          )}

          {/* Error */}
          {scraperError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <span>{scraperError}</span>
            </div>
          )}

          {/* Ficha Visual del Producto Recién Extraído */}
          {lastProduct && (
            <div className="mt-4 p-4 bg-white border border-emerald-300 rounded-xl shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <Sparkles size={14} />
                  <span>Producto Extraído e Integrado en el Cerebro de ObraClima</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-medium">
                  Ref: {lastProduct.sku || 'S/R'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">{lastProduct.nombre}</h4>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-lg font-extrabold text-emerald-700">
                  {lastProduct.precio.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
                {lastProduct.categoria && (
                  <span className="text-xs text-slate-500">| {lastProduct.categoria}</span>
                )}
              </div>
              {lastProduct.descripcion && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 line-clamp-3 mb-2 whitespace-pre-line">
                  {lastProduct.descripcion}
                </div>
              )}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <a
                  href={lastProduct.origen_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 truncate max-w-md"
                >
                  <ExternalLink size={12} />
                  <span className="truncate">{lastProduct.origen_url}</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleAdoptToOfficial(lastProduct)}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-xs transition"
                >
                  + Copiar a Catálogo Base
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulario Añadir Nuevo Ítem Oficial */}
      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Añadir al Catálogo Oficial</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
             <input placeholder="Código (ej. AC001)" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
             <input placeholder="Nombre / Descripción" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 lg:col-span-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
             
             <div>
                <label className="block text-xs text-slate-500 mb-1">Categoría</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white text-slate-900" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  <option value="Equipos">Equipos</option>
                  <option value="Instalación">Instalación</option>
                  <option value="Material">Material</option>
                  <option value="Mano de obra">Mano de obra</option>
                  <option value="Servicios">Servicios</option>
                </select>
             </div>
             
             <div>
                <label className="block text-xs text-slate-500 mb-1">Precio (€)</label>
                <input type="number" step="any" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 font-semibold" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
             </div>
             
             <div>
                <label className="block text-xs text-slate-500 mb-1">Unidad</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
             </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Guardar</button>
          </div>
        </div>
      )}

      {/* Selector de Vistas de Catálogo */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveCatalogView('oficial')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
              activeCatalogView === 'oficial'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={15} />
            <span>Tarifas Oficiales ({catalog.length})</span>
          </button>
          <button
            onClick={() => setActiveCatalogView('prospectados')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
              activeCatalogView === 'prospectados'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <Database size={15} />
            <span>Cerebro IA / Prospectados ({prospectados.length})</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: Catálogo Oficial */}
      {activeCatalogView === 'oficial' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="p-4 font-semibold w-28">Código</th>
                <th className="p-4 font-semibold">Nombre / Descripción</th>
                <th className="p-4 font-semibold w-32">Categoría</th>
                <th className="p-4 font-semibold w-28 text-right">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catalog.map((c: any) => (
                <tr key={c.id || c.code} className="hover:bg-slate-50">
                  <td className="p-4 font-mono text-xs font-semibold text-slate-800">{c.code}</td>
                  <td className="p-4 text-slate-800 font-medium">{c.name}</td>
                  <td className="p-4 text-slate-500 text-xs">
                    <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-700">
                      {c.category || 'General'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-900 text-right">
                    {Number(c.price).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {catalog.length === 0 && <div className="p-8 text-center text-slate-500">No hay productos en el catálogo oficial.</div>}
        </div>
      )}

      {/* VISTA 2: Catálogo de Prospección (Alimentación del Cerebro de ObraClima) */}
      {activeCatalogView === 'prospectados' && (
        <ProspectedList
          items={prospectados}
          loading={loadingProspectados}
          onRefresh={loadProspectados}
          onAdoptToOfficial={handleAdoptToOfficial}
          onOpenUrl={(url) => window.open(url, '_blank')}
        />
      )}
    </div>
  );
}

export default CatalogTab;
