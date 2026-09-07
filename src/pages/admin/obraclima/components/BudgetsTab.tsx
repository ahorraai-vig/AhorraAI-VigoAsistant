import React, { useState } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';
import DocumentEditor from './DocumentEditor';
import { CheckCircle2, Copy, FileText, FileUp } from 'lucide-react';
import PrintTemplate from './PrintTemplate';

export default function BudgetsTab({ budgets, clients, catalog, config, refresh }: any) {
  const [mode, setMode] = useState<'list' | 'create' | 'view'>('list');
  const [selected, setSelected] = useState<any>(null);

  const handleSave = async (data: any) => {
    await adminFetch('/api/obraclima/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setMode('list');
    refresh();
  };
  
  const convertToInvoice = async (budget: any) => {
    if(!window.confirm(`¿Convertir presupuesto ${budget.number} a factura?`)) return;
    await adminFetch(`/api/obraclima/budgets/${budget.id}/convert`, { method: 'POST' });
    refresh();
  };

  if (mode === 'create') {
    return <DocumentEditor type="presupuesto" clients={clients} catalog={catalog} config={config} onSave={handleSave} onCancel={() => setMode('list')} />;
  }
  
  if (mode === 'view' && selected) {
     return (
       <div className="bg-slate-900 fixed inset-0 z-50 overflow-y-auto pb-20">
         <div className="bg-slate-800 p-4 sticky top-0 flex justify-between items-center print:hidden shadow-lg z-50">
           <h3 className="text-white font-bold text-lg">Presupuesto {selected.number}</h3>
           <div className="flex gap-4">
             <button onClick={() => setMode('list')} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Cerrar</button>
             {!selected.convertedToInvoice && (
                <button onClick={() => { setMode('list'); convertToInvoice(selected); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2">
                   <Copy size={16}/> Facturar
                </button>
             )}
             <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">Imprimir PDF</button>
           </div>
         </div>
         <div className="mt-8 shadow-2xl mx-auto max-w-[800px] print:shadow-none print:m-0 print:mt-0">
           <PrintTemplate data={selected} type="presupuesto" config={config} preview={true} />
         </div>
       </div>
     );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Presupuestos</h2>
        <button onClick={() => setMode('create')} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
          <FileUp size={16} /> Crear Presupuesto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="p-4 font-semibold w-32">Número</th>
              <th className="p-4 font-semibold w-32">Fecha</th>
              <th className="p-4 font-semibold">Cliente</th>
              <th className="p-4 font-semibold w-32 text-right">Total</th>
              <th className="p-4 font-semibold w-24 text-center">Estado</th>
              <th className="p-4 font-semibold w-24 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {budgets.map((b: any) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-800">{b.number}</td>
                <td className="p-4 text-slate-600">{new Date(b.date).toLocaleDateString()}</td>
                <td className="p-4 font-medium text-slate-800">{b.client?.name}</td>
                <td className="p-4 font-bold text-slate-800 text-right">{b.total.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</td>
                <td className="p-4 text-center">
                  {b.convertedToInvoice ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Facturado</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">Pendiente</span>
                  )}
                </td>
                <td className="p-4 text-center">
                   <button onClick={() => { setSelected(b); setMode('view'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <FileText size={18} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {budgets.length === 0 && <div className="p-8 text-center text-slate-500">No hay presupuestos.</div>}
      </div>
    </div>
  );
}
