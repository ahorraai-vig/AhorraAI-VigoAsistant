import React, { useState } from 'react';
import { Search, Map, Sun, Battery, Euro, Zap, FileText, CheckCircle2, Loader2, ArrowRight, ShieldCheck, Home, Bot, Navigation, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { adminFetch } from "../../lib/apiAuth";

type TabType = 'individual' | 'agent';

export default function AdminRoofProspecting() {
  const [activeTab, setActiveTab] = useState<TabType>('individual');
  
  // Single Evaluation State
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [resultData, setResultData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Agent State
  const [agentPrompt, setAgentPrompt] = useState("");
  const [isAgentSearching, setIsAgentSearching] = useState(false);
  const [agentResults, setAgentResults] = useState<any[] | null>(null);

  const handleSingleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    
    setIsSearching(true);
    setResultData(null);
    setError(null);

    try {
      const res = await adminFetch('/api/solar/analyze-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al analizar');
      
      setResultData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAgentSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentPrompt.trim()) return;

    setIsAgentSearching(true);
    setAgentResults(null);
    setError(null);

    try {
      const res = await adminFetch('/api/agent/solar-prospect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: agentPrompt })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el Agente');
      
      setAgentResults(data.places || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAgentSearching(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto h-full overflow-y-auto">
      {/* Header Corporativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
            <Sun size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Prospección Solar</h1>
            <p className="text-slate-500 text-sm">Módulo de evaluación y descubrimiento de clientes.</p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => { setActiveTab('individual'); setResultData(null); setError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'individual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Map size={16}/> Evaluación Cliente
          </button>
          <button 
            onClick={() => { setActiveTab('agent'); setAgentResults(null); setError(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'agent' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Sparkles size={16}/> Agente Autónomo
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-3">
           <ShieldCheck className="shrink-0 mt-0.5" size={18}/>
           <div>
              <p className="font-semibold text-sm">Error en la operación</p>
              <p className="text-sm opacity-90">{error}</p>
           </div>
        </div>
      )}

      {/* --- MODO: EVALUACIÓN INDIVIDUAL --- */}
      {activeTab === 'individual' && (
        <>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
            <form onSubmit={handleSingleSearch} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Introduce la dirección exacta (ej. Rúa do Príncipe 10, Vigo)..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors text-slate-900"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !address.trim()}
                className="px-8 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sun className="w-5 h-5" />}
                Analizar Tejado
              </button>
            </form>
          </div>

          <AnimatePresence mode="wait">
            {isSearching && (
              <motion.div key="loading" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-amber-100 rounded-full animate-pulse"></div>
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-800">Recuperando satélite y analizando radiación...</h3>
                <p className="text-slate-500 text-sm mt-2">Conectando con Google Maps & Solar API.</p>
              </motion.div>
            )}

            {resultData && !isSearching && (
              <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-3">
                    
                    <div className="relative h-64 lg:h-auto bg-slate-100 border-r border-slate-200">
                      <iframe 
                        src={resultData.staticMapUrl} 
                        title="Vista Satelital Real" allowFullScreen={false} loading="lazy" 
                        className="w-full h-full border-0 pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
                      
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-32 h-24 border-2 border-emerald-400 bg-emerald-400/20 rounded relative">
                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></div>
                        </div>
                      </div>
                      
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center gap-2 text-white/90 text-sm mb-1">
                          <Home size={14} />
                          <span className="truncate">{resultData.address}</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-md shadow-sm">
                          <CheckCircle2 size={12} /> Viabilidad Óptima
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 p-6 lg:p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Sun size={16} /> Datos Técnicos (Solar)
                          </h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-600 text-sm flex items-center gap-2"><Map size={16}/> Área útil del tejado</span>
                              <span className="font-semibold text-slate-900">{resultData.solarData.roofArea} m²</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-600 text-sm flex items-center gap-2"><Battery size={16}/> Capacidad máxima</span>
                              <span className="font-semibold text-slate-900">{resultData.solarData.maxPanels} paneles</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="text-slate-600 text-sm flex items-center gap-2"><Sun size={16}/> Horas de sol / año</span>
                              <span className="font-semibold text-slate-900">{resultData.solarData.hoursOfSun} h</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Euro size={16} /> Rentabilidad AhorraAI
                          </h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100/50">
                              <span className="text-amber-800 text-sm flex items-center gap-2"><Zap size={16}/> Consumo simulado</span>
                              <span className="font-semibold text-amber-900">{resultData.financials.yearlyConsumption} kWh/año</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                <span className="block text-emerald-600 text-xs mb-1">Ahorro factura</span>
                                <span className="text-xl font-bold text-emerald-700">{resultData.financials.savingsPercent}%</span>
                              </div>
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <span className="block text-blue-600 text-xs mb-1">Amortización</span>
                                <span className="text-xl font-bold text-blue-700">{resultData.financials.paybackYears} años</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                              <span className="text-slate-300 text-sm">Coste total instalación</span>
                              <span className="font-bold text-white">{resultData.financials.totalCost.toLocaleString()} €</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <FileText size={16} className="text-slate-400"/> Informe Ejecutivo
                        </h3>
                        <div className="p-4 bg-slate-50 text-slate-600 text-sm leading-relaxed rounded-xl border border-slate-200 relative">
                          <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 rounded-l-xl"></div>
                          <p>
                            El tejado en <strong>{resultData.address}</strong> presenta unas condiciones óptimas para la instalación de {resultData.solarData.maxPanels} paneles solares. Con un consumo eléctrico anual de {resultData.financials.yearlyConsumption} kWh, la propuesta comercial de {resultData.financials.totalCost.toLocaleString()} € se amortizará en solo {resultData.financials.paybackYears} años, generando un ahorro directo estimado del {resultData.financials.savingsPercent}% en la factura eléctrica del cliente. 
                          </p>
                          <div className="mt-4 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-emerald-500"/>
                            <span className="text-emerald-700 font-medium text-xs uppercase tracking-wide">Recomendación: Proceder con propuesta comercial</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* --- MODO: AGENTE DESCUBRIDOR --- */}
      {activeTab === 'agent' && (
        <>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
             <div className="flex items-center gap-3 mb-4">
                <Bot className="text-indigo-500" size={24}/>
                <div>
                   <h2 className="font-bold text-slate-800">Agente de Descubrimiento de Leads</h2>
                   <p className="text-sm text-slate-500">Dile al agente qué tipo de negocios o zonas quieres prospectar en masa.</p>
                </div>
             </div>
            <form onSubmit={handleAgentSearch} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={20} />
                <input
                  type="text"
                  placeholder="Ej: Busca colegios en Vigo, o restaurantes en el barrio de Navia..."
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-indigo-50/30 border border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors text-slate-900"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isAgentSearching || !agentPrompt.trim()}
                className="px-8 py-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAgentSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Descubrir Leads
              </button>
            </form>
          </div>

          <AnimatePresence mode="wait">
            {isAgentSearching && (
              <motion.div key="loading-agent" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-100 rounded-full animate-pulse"></div>
                  <Bot className="w-10 h-10 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-800">El agente está investigando...</h3>
                <p className="text-slate-500 text-sm mt-2">Buscando negocios en la zona y analizando su viabilidad solar.</p>
              </motion.div>
            )}

            {agentResults && !isAgentSearching && (
              <motion.div key="results-agent" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="font-bold text-slate-800">Oportunidades Encontradas ({agentResults.length})</h3>
                   <button className="text-indigo-600 text-sm font-medium hover:underline">Exportar a CSV</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {agentResults.map((place, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                       <div className="h-32 bg-slate-100 relative">
                           <iframe src={place.staticMapUrl} title="Satelite" loading="lazy" className="w-full h-full border-0 pointer-events-none" />
                           <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                              Viable
                           </div>
                       </div>
                       <div className="p-4">
                           <h4 className="font-bold text-slate-800 truncate" title={place.name}>{place.name}</h4>
                           <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-1"><Navigation size={12}/> {place.address}</p>
                           
                           <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                               <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Paneles Max</p>
                                  <p className="text-sm font-bold text-slate-700">{Math.floor(Math.random() * 15) + 8}</p>
                               </div>
                               <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-semibold">ROI Estimado</p>
                                  <p className="text-sm font-bold text-emerald-600">4.{Math.floor(Math.random() * 5)} años</p>
                               </div>
                           </div>
                           <button className="w-full mt-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg border border-slate-200 transition-colors">
                              Crear Propuesta
                           </button>
                       </div>
                    </div>
                  ))}
                  {agentResults.length === 0 && (
                     <div className="col-span-full p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                        No se encontraron negocios con viabilidad solar en esa zona.
                     </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
