import React, { useState } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';

export default function ConfigTab({ config, refresh }: { config: any, refresh: () => void }) {
  const [formData, setFormData] = useState(config || {});
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    await adminFetch('/api/obraclima/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setSaving(false);
    refresh();
  };

  if (!config) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl text-slate-900">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Configuración de Empresa</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre / Razón Social</label>
          <input name="companyName" value={formData.companyName} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">NIF/CIF</label>
          <input name="nif" value={formData.nif} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Dirección Completa</label>
          <input name="address" value={formData.address} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Código Postal</label>
          <input name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Población</label>
          <input name="city" value={formData.city} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Provincia</label>
          <input name="province" value={formData.province} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
      </div>

      <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Facturación y Pago</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pago</label>
          <input name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">IBAN</label>
          <input name="iban" value={formData.iban} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">IVA Predeterminado (%)</label>
          <input type="number" name="defaultIva" value={formData.defaultIva} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900" />
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Serie Presupuestos</label>
             <input name="budgetSeries" value={formData.budgetSeries} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" />
           </div>
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Siguiente Nº</label>
             <input type="number" name="nextBudgetNumber" value={formData.nextBudgetNumber} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" />
           </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Serie Facturas</label>
             <input name="invoiceSeries" value={formData.invoiceSeries} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" />
           </div>
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Siguiente Nº</label>
             <input type="number" name="nextInvoiceNumber" value={formData.nextInvoiceNumber} onChange={handleChange} className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900" />
           </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
