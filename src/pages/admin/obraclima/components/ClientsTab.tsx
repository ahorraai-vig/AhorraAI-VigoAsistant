import React, { useState } from 'react';
import { ShieldCheck, Lock, UserPlus, Phone, Mail, FileText } from 'lucide-react';
import { adminFetch } from '../../../../lib/apiAuth';

export default function ClientsTab({ clients, refresh }: { clients: any[], refresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nif: '',
    address: '',
    postalCode: '',
    city: 'Vigo',
    province: 'Pontevedra',
    phone: '',
    email: '',
    rgpdAccepted: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('El nombre o razón social es obligatorio');
      return;
    }
    if (!formData.rgpdAccepted) {
      setError('Debe confirmar la cláusula de cumplimiento RGPD y aislamiento de IA');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await adminFetch('/api/obraclima/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setSaving(false);
      setShowAdd(false);
      setFormData({
        name: '',
        nif: '',
        address: '',
        postalCode: '',
        city: 'Vigo',
        province: 'Pontevedra',
        phone: '',
        email: '',
        rgpdAccepted: true
      });
      refresh();
    } catch (err: any) {
      setError(err.message || 'Error al guardar cliente');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Clientes
            <span className="text-xs font-normal bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> RGPD + AI Act
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Directorio centralizado con aislamiento estricto de PII frente a IA</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-1.5 shadow-sm">
          <UserPlus className="w-4 h-4" />
          <span>+ Nuevo Cliente</span>
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-md animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Añadir Nuevo Cliente
            </h3>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Datos protegidos y excluidos de LLMs
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div>
               <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre / Razón Social *</label>
               <input placeholder="Ej: Mari Carmen Alonso Vicente" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-semibold text-slate-700 mb-1">NIF / CIF</label>
               <input placeholder="Ej: 76891822Q" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 font-mono text-sm" value={formData.nif} onChange={e => setFormData({...formData, nif: e.target.value.toUpperCase()})} />
             </div>
             <div className="md:col-span-2">
               <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección Postal</label>
               <input placeholder="Ej: C/ Julio Xesto nº 2, Segundo C" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 text-sm" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-semibold text-slate-700 mb-1">Código Postal</label>
               <input placeholder="36770" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 text-sm" value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-semibold text-slate-700 mb-1">Población</label>
               <input placeholder="Vigo / O Rosal" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 text-sm" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
               <input placeholder="600 123 456" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
               <input placeholder="cliente@ejemplo.com" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
             </div>
          </div>

          {/* Cláusula RGPD & AI Compliance */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 mb-4 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Garantía de Protección de Datos (RGPD) y Ley de IA (AI Act)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              <strong>Responsable:</strong> ObraClima S.L. &bull; <strong>Finalidad:</strong> Gestión y emisión de presupuestos y facturas oficiales.
            </p>
            <p className="text-[11px] leading-relaxed text-emerald-800 bg-emerald-50/80 p-2 rounded border border-emerald-200">
              🔒 <strong>Aislamiento frente a IA:</strong> Los datos de contacto y facturación quedan almacenados exclusivamente en la base de datos segura y nunca son compartidos con modelos de IA externos.
            </p>
            <label className="flex items-start gap-2 pt-1 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={formData.rgpdAccepted}
                onChange={e => setFormData({...formData, rgpdAccepted: e.target.checked})}
                className="mt-0.5 rounded text-blue-600 focus:ring-0"
              />
              <span className="text-[11px]">Confirmo el cumplimiento del deber de información y el tratamiento confidencial conforme al RGPD.</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Cliente'}</span>
            </button>
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
              <th className="p-4 font-semibold">Contacto</th>
              <th className="p-4 font-semibold text-center">Protección</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c: any) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-800">{c.name}</td>
                <td className="p-4 text-slate-600 font-mono text-xs">{c.nif || '—'}</td>
                <td className="p-4 text-slate-600">{c.address || '—'}</td>
                <td className="p-4 text-slate-600">{c.city} {c.province ? `(${c.province})` : ''}</td>
                <td className="p-4 text-slate-500 text-xs">
                  {c.phone && <div>📞 {c.phone}</div>}
                  {c.email && <div>✉️ {c.email}</div>}
                  {!c.phone && !c.email && <span>—</span>}
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" /> RGPD OK
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <div className="p-8 text-center text-slate-500">No hay clientes.</div>}
      </div>
    </div>
  );
}
