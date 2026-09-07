import React, { useState } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';

export default function CatalogTab({ catalog, refresh }: { catalog: any[], refresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', category: '', price: 0, unit: 'ud', iva: 21 });
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Catálogo de Productos y Servicios</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          + Nuevo Ítem
        </button>
      </div>

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
