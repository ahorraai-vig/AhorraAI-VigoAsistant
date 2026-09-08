import React, { useState } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';
import { Link2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function CatalogTab({ catalog, refresh }: { catalog: any[], refresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', category: '', price: 0, unit: 'ud', iva: 21 });
  const [saving, setSaving] = useState(false);

  // Estado aislado para Ingresar Producto por URL (Scraper WooCommerce)
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scraperMessage, setScraperMessage] = useState<string | null>(null);
  const [scraperError, setScraperError] = useState<string | null>(null);

  const handleSave = async () => {
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
    if (!urlInput.trim()) return;

    setScraping(true);
    setScraperMessage(null);
    setScraperError(null);

    try {
      const res = await adminFetch('/api/obraclima/prospectar-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar la URL del producto.');
      }
      // Respuesta exacta estipulada
      setScraperMessage(data.message);
      setUrlInput('');
    } catch (err: any) {
      setScraperError(err.message || 'Error al conectar con el scraper.');
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Catálogo de Productos y Servicios</h2>
          <p className="text-xs text-slate-500">Tarifas base y productos registrados en el sistema</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón aislado requerido por la especificación */}
          <button
            onClick={() => {
              setShowUrlModal(!showUrlModal);
              setScraperMessage(null);
              setScraperError(null);
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1.5 text-sm transition shadow-sm"
          >
            <Link2 size={16} />
            <span>Ingresar Producto por URL</span>
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm">
            + Nuevo Ítem
          </button>
        </div>
      </div>

      {/* Módulo aislado para Ingresar Producto por URL */}
      {showUrlModal && (
        <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-xl mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Link2 size={18} className="text-emerald-700" />
              <h3 className="font-bold text-emerald-900 text-sm">Ingresar Producto por URL (WooCommerce)</h3>
            </div>
            <button
              onClick={() => setShowUrlModal(false)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-medium"
            >
              Cerrar
            </button>
          </div>

          <p className="text-xs text-emerald-800 mb-3">
            Introduce la URL del producto de un proveedor. El scraper extraerá el título, precio y SKU bajo normativa de minimización de datos (sin cookies ni PII) y registrará la trazabilidad en Supabase.
          </p>

          <form onSubmit={handleScrapeSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              required
              placeholder="https://tienda-proveedor.com/producto/split-daikin-35kw"
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
                  <span>Extrayendo...</span>
                </>
              ) : (
                <span>Ingresar Producto por URL</span>
              )}
            </button>
          </form>

          {scraperMessage && (
            <div className="mt-3 p-3 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{scraperMessage}</span>
            </div>
          )}

          {scraperError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{scraperError}</span>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Añadir al Catálogo</h3>
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
                <input type="number" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 font-semibold" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
             </div>
             
             <div>
                <label className="block text-xs text-slate-500 mb-1">Unidad</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
             </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Guardar</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="p-4 font-semibold w-24">Código</th>
              <th className="p-4 font-semibold">Nombre</th>
              <th className="p-4 font-semibold w-32">Categoría</th>
              <th className="p-4 font-semibold w-24 text-right">Precio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {catalog.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-800">{c.code}</td>
                <td className="p-4 text-slate-600">{c.name}</td>
                <td className="p-4 text-slate-500">{c.category}</td>
                <td className="p-4 font-medium text-slate-800 text-right">{c.price.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</td>
              </tr>
            ))}
          </tbody>
        </table>
        {catalog.length === 0 && <div className="p-8 text-center text-slate-500">No hay productos en el catálogo.</div>}
      </div>
    </div>
  );
}
