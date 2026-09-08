import React, { useState } from 'react';
import { adminFetch } from '../../../../lib/apiAuth';
import DocumentEditor from './DocumentEditor';
import { Copy, FileText, FileUp, Send, Mail } from 'lucide-react';
import PrintTemplate from './PrintTemplate';
import EmailModal from './EmailModal';

export default function BudgetsTab({ budgets, clients, catalog, config, refresh }: any) {
  const [mode, setMode] = useState<'list' | 'create' | 'view'>('list');
  const [selected, setSelected] = useState<any>(null);
  const [emailModalDoc, setEmailModalDoc] = useState<any>(null);

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
         <div className="bg-slate-800 p-4 sticky top-0 flex flex-wrap justify-between items-center print:hidden shadow-lg z-50 gap-3">
           <h3 className="text-white font-bold text-lg">Presupuesto {selected.number}</h3>
           <div className="flex flex-wrap gap-2.5">
             <button onClick={() => setMode('list')} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">Cerrar</button>
             {!selected.convertedToInvoice && (
                <button onClick={() => { setMode('list'); convertToInvoice(selected); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2 transition-colors">
                   <Copy size={16}/> Facturar
                </button>
             )}
             <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors">
               Imprimir PDF
             </button>
             <button 
               onClick={() => setEmailModalDoc(selected)} 
               className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
               title="Enviar presupuesto con PDF oficial adjunto de forma nativa"
             >
               <Send size={16} /> Enviar Presupuesto
             </button>
           </div>
         </div>
         <div className="mt-8 shadow-2xl mx-auto max-w-[800px] print:shadow-none print:m-0 print:mt-0">
           <PrintTemplate data={selected} type="presupuesto" config={config} preview={true} />
         </div>

         {emailModalDoc && (
           <EmailModal
             isOpen={!!emailModalDoc}
             onClose={() => setEmailModalDoc(null)}
             doc={emailModalDoc}
             type="presupuesto"
             config={config}
           />
         )}
       </div>
     );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Presupuestos</h2>
        <button onClick={() => setMode('create')} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors">
          <FileUp size={16} /> Crear Presupuesto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="p-4 font-semibold w-28">Número</th>
              <th className="p-4 font-semibold w-28">Fecha</th>
              <th className="p-4 font-semibold">Cliente</th>
              <th className="p-4 font-semibold w-32 text-right">Total</th>
              <th className="p-4 font-semibold w-24 text-center">Estado</th>
              <th className="p-4 font-semibold w-48 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {budgets.map((b: any) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-bold text-slate-800">{b.number}</td>
                <td className="p-4 text-slate-600">{new Date(b.date).toLocaleDateString()}</td>
                <td className="p-4 font-medium text-slate-800">{b.client?.name || b.customer?.name || 'Cliente'}</td>
                <td className="p-4 font-bold text-slate-800 text-right">{b.total.toLocaleString('es-ES', {minimumFractionDigits: 2})} €</td>
                <td className="p-4 text-center">
                  {b.convertedToInvoice ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Facturado</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">Pendiente</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => setEmailModalDoc(b)} 
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      title="Enviar Presupuesto con PDF adjunto de forma nativa"
                    >
                      <Send size={13} />
                      <span>Enviar Presupuesto</span>
                    </button>
                    <button 
                      onClick={() => { setSelected(b); setMode('view'); }} 
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Ver Presupuesto"
                    >
                      <FileText size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {budgets.length === 0 && <div className="p-8 text-center text-slate-500">No hay presupuestos.</div>}
      </div>

      {emailModalDoc && (
        <EmailModal
          isOpen={!!emailModalDoc}
          onClose={() => setEmailModalDoc(null)}
          doc={emailModalDoc}
          type="presupuesto"
          config={config}
        />
      )}
    </div>
  );
}
