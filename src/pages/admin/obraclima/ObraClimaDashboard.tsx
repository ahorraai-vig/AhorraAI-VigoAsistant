import React, { useState } from 'react';
import { useObraClima } from './useObraClima';
import ConfigTab from './components/ConfigTab';
import ClientsTab from './components/ClientsTab';
import CatalogTab from './components/CatalogTab';
import BudgetsTab from './components/BudgetsTab';
import InvoicesTab from './components/InvoicesTab';
import { Settings, Users, BookOpen, FileUp, Receipt, Activity } from 'lucide-react';

export default function ObraClimaDashboard() {
  const { config, clients, catalog, budgets, invoices, refresh, loading } = useObraClima();
  const [activeTab, setActiveTab] = useState<'dashboard'|'budgets'|'invoices'|'clients'|'catalog'|'config'>('dashboard');

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando ObraClima AI...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2 font-display">ObraClima AI</h1>
        <p className="text-slate-500">Gestión Inteligente de Presupuestos y Facturas</p>
      </div>

      <div className="flex gap-2 mb-8 border-b border-slate-200 pb-2 overflow-x-auto print:hidden">
        <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
           <Activity size={18} /> Dashboard
        </button>
        <button onClick={() => setActiveTab('budgets')} className={`px-4 py-2 font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'budgets' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
           <FileUp size={18} /> Presupuestos
        </button>
        <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'invoices' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
           <Receipt size={18} /> Facturas
        </button>
        <button onClick={() => setActiveTab('clients')} className={`px-4 py-2 font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'clients' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
           <Users size={18} /> Clientes
        </button>
        <button onClick={() => setActiveTab('catalog')} className={`px-4 py-2 font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'catalog' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
           <BookOpen size={18} /> Catálogo
        </button>
        <button onClick={() => setActiveTab('config')} className={`px-4 py-2 font-bold flex items-center gap-2 rounded-lg transition-colors ${activeTab === 'config' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
           <Settings size={18} /> Configuración
        </button>
      </div>

      <div className="print:m-0 print:p-0">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setActiveTab('budgets')}>
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4"><FileUp size={24}/></div>
               <h3 className="font-bold text-slate-800 text-lg mb-1">Presupuestos</h3>
               <p className="text-slate-500">{budgets.length} documentos</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-green-500 transition-colors" onClick={() => setActiveTab('invoices')}>
               <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4"><Receipt size={24}/></div>
               <h3 className="font-bold text-slate-800 text-lg mb-1">Facturas</h3>
               <p className="text-slate-500">{invoices.length} documentos</p>
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-purple-500 transition-colors" onClick={() => setActiveTab('clients')}>
               <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4"><Users size={24}/></div>
               <h3 className="font-bold text-slate-800 text-lg mb-1">Clientes</h3>
               <p className="text-slate-500">{clients.length} registrados</p>
             </div>
          </div>
        )}
        
        {activeTab === 'config' && <ConfigTab config={config} refresh={refresh} />}
        {activeTab === 'clients' && <ClientsTab clients={clients} refresh={refresh} />}
        {activeTab === 'catalog' && <CatalogTab catalog={catalog} refresh={refresh} />}
        {activeTab === 'budgets' && <BudgetsTab budgets={budgets} clients={clients} catalog={catalog} config={config} refresh={refresh} />}
        {activeTab === 'invoices' && <InvoicesTab invoices={invoices} clients={clients} catalog={catalog} config={config} refresh={refresh} />}
      </div>
    </div>
  );
}
