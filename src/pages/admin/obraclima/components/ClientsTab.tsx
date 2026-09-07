import React, { useState } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';

export default function ClientsTab({ clients, refresh }: { clients: any[], refresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', nif: '', address: '', postalCode: '', city: '', province: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await adminFetch('/api/obraclima/clients', {
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
        <h2 className="text-xl font-bold text-slate-800">Clientes</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          + Nuevo Cliente
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Añadir Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <input placeholder="Nombre / Razón Social" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
             <input placeholder="NIF/CIF" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400" value={formData.nif} onChange={e => setFormData({...formData, nif: e.target.value})} />
             <input placeholder="Dirección" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 md:col-span-2" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
             <input placeholder="Código Postal" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400" value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} />
             <input placeholder="Población" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
             <input placeholder="Provincia" className="p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
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
              <th className="p-4 font-semibold">Nombre</th>
              <th className="p-4 font-semibold">NIF</th>
              <th className="p-4 font-semibold">Dirección</th>
              <th className="p-4 font-semibold">Población</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-800">{c.name}</td>
                <td className="p-4 text-slate-600">{c.nif}</td>
                <td className="p-4 text-slate-600">{c.address}</td>
                <td className="p-4 text-slate-600">{c.city} ({c.province})</td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <div className="p-8 text-center text-slate-500">No hay clientes.</div>}
      </div>
    </div>
  );
}
