import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Handshake, 
  Sparkles, 
  Store, 
  Key, 
  RefreshCw, 
  MapPin, 
  Percent, 
  Building, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Search, 
  Filter,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { Business, SynergyOpportunity } from '../../types';
import { adminFetch } from '../../lib/apiAuth';

export default function AdminCooperationGraph() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [synergies, setSynergies] = useState<SynergyOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSector, setSelectedSector] = useState('todos');
  const [activeTab, setActiveTab] = useState<'grafo' | 'lista_sinergias' | 'claves'>('grafo');

  const [enriching, setEnriching] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/cooperation/all');
      const data = await res.json();
      setBusinesses(data.businesses || []);
      setSynergies(data.synergies || []);
    } catch (err) {
      console.error('Error fetching cooperation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEnrichDatabase = async () => {
    setEnriching(true);
    setNotification(null);
    try {
      const res = await adminFetch('/api/cooperation/enrich-database', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setNotification(data.message);
        await fetchData();
      } else {
        alert(data.error || 'Error al enriquecer');
      }
    } catch (err) {
      console.error('Error enriching:', err);
    } finally {
      setEnriching(false);
    }
  };

  const handleRecalculateAI = async () => {
    setCalculating(true);
    setNotification(null);
    try {
      const res = await adminFetch('/api/cooperation/calculate-synergies', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.synergies) {
        setSynergies(data.synergies);
      }
      await fetchData();
    } catch (err) {
      console.error('Error recalculating:', err);
    } finally {
      setCalculating(false);
    }
  };

  const filteredSynergies = synergies.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.businessA_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.businessB_name.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesSearch;
  });

  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (b.address || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (b.access_code || '').toLowerCase().includes(searchFilter.toLowerCase());
    const matchesSector = selectedSector === 'todos' || b.category === selectedSector;
    return matchesSearch && matchesSector;
  });

  const sectors = ['todos', ...Array.from(new Set(businesses.map(b => b.category).filter(Boolean)))];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 font-medium">
        Cargando Grafo de Comercio Colaborativo...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera del Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Grafo de Comercio Colaborativo
            </h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
              Red Vigo ({businesses.length} Negocios)
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Cruce de datos y mapa de sinergias comerciales con IA para todo el tejido empresarial de Vigo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRecalculateAI}
            disabled={calculating || enriching}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl font-medium shadow-xs transition-all disabled:opacity-50 text-sm"
          >
            <Sparkles size={16} className={calculating ? 'animate-spin' : ''} />
            <span>{calculating ? 'Calculando...' : 'Recalcular con IA'}</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold">
            Cerrar
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">Comercios en Red</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{businesses.length}</span>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <ShieldCheck size={12} />
            {businesses.filter(b => b.honesty_status === 'DICHO').length} Dicho • {businesses.filter(b => b.honesty_status !== 'DICHO').length} Observado
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">Sinergias Generadas</span>
          <span className="text-2xl font-bold text-blue-600 mt-1 block">{synergies.length}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">Oportunidades activas</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">Compatibilidad Media</span>
          <span className="text-2xl font-bold text-indigo-600 mt-1 block">
            {synergies.length > 0 
              ? Math.round(synergies.reduce((acc, s) => acc + s.compatibilityScore, 0) / synergies.length)
              : 0}%
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Afinidad comercial</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">Horas Valle Optimizadas</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {businesses.filter(b => b.cooperation?.valleyHours).length}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Franjas de negocio</span>
        </div>
      </div>

      {/* Pestañas de Vista */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('grafo')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'grafo'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers size={16} />
          <span>Matriz & Nodos de Conexión</span>
        </button>

        <button
          onClick={() => setActiveTab('lista_sinergias')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'lista_sinergias'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Handshake size={16} />
          <span>Todas las Oportunidades ({synergies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('claves')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'claves'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Key size={16} />
          <span>Fichas y Claves de Comercio ({businesses.length})</span>
        </button>
      </div>

      {/* PESTAÑA 1: MATRIZ Y NODOS DE CONEXIÓN */}
      {activeTab === 'grafo' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  Mapa Interactivo de Nodos Comerciales de Vigo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conexiones vivas de cooperación detectadas por el cerebro de IA.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {businesses.length} Nodos • {synergies.length} Enlaces
              </span>
            </div>

            {/* Visualizador de Grafo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {businesses.map((biz) => {
                const bizSynergies = synergies.filter(s => s.businessA_id === biz.id || s.businessB_id === biz.id);
                return (
                  <div 
                    key={biz.id} 
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-white">{biz.name}</h4>
                        <span className="text-[11px] text-blue-400 font-medium">{biz.category}</span>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        {biz.zone || 'Vigo'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Clock size={12} className="text-slate-500" />
                        <span>Valle: {biz.cooperation?.valleyHours || '15:30 - 18:00'}</span>
                      </div>
                    </div>

                    {/* Conexiones directas */}
                    <div className="pt-2 border-t border-slate-900">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">
                        Alianzas Activas ({bizSynergies.length})
                      </span>
                      <div className="space-y-1">
                        {bizSynergies.map((s) => {
                          const partner = s.businessA_name === biz.name ? s.businessB_name : s.businessA_name;
                          return (
                            <div 
                              key={s.id}
                              className="flex items-center justify-between text-[11px] bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800"
                            >
                              <span className="text-slate-200 truncate max-w-[140px] font-medium">↔ {partner}</span>
                              <span className="text-emerald-400 font-bold text-[10px]">{s.compatibilityScore}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: LISTA DE SINERGIAS */}
      {activeTab === 'lista_sinergias' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Buscar por negocio o título de alianza..."
              className="w-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSynergies.map((syn) => (
              <div 
                key={syn.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold uppercase tracking-wider">
                    {syn.synergyType.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    {syn.compatibilityScore}% Afinidad
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base">{syn.title}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Entre: <strong className="text-slate-800">{syn.businessA_name}</strong> y <strong className="text-slate-800">{syn.businessB_name}</strong>
                  </p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {syn.description}
                </p>

                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100">
                  <div>
                    <span className="font-semibold text-slate-800">Beneficio {syn.businessA_name}:</span>
                    <p className="text-slate-600">{syn.benefitA}</p>
                  </div>
                  <div className="border-t border-slate-200/60 pt-1.5">
                    <span className="font-semibold text-slate-800">Beneficio {syn.businessB_name}:</span>
                    <p className="text-slate-600">{syn.benefitB}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: FICHAS Y CLAVES DE COMERCIO */}
      {activeTab === 'claves' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Claves de Acceso y Fichas de Comercios</h3>
              <p className="text-xs text-slate-500">Credenciales únicas para que cada comerciante acceda a su panel individual.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedSector}
                onChange={e => setSelectedSector(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
              >
                {sectors.map(s => (
                  <option key={s} value={s}>{s === 'todos' ? 'Todos los sectores' : s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Comercio</th>
                  <th className="py-3 px-4">Sector / Zona</th>
                  <th className="py-3 px-4">Clave de Acceso Única</th>
                  <th className="py-3 px-4">Horas Valle</th>
                  <th className="py-3 px-4">Estado Honestidad</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBusinesses.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {b.name}
                      <span className="block text-[11px] text-slate-400 font-normal">{b.address || 'Sin dirección'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium">{b.category}</span>
                      <span className="block text-slate-400 text-[11px]">{b.zone || 'Vigo'}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100">
                        {b.access_code || 'SIN_CLAVE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {b.cooperation?.valleyHours || '15:30 - 18:00'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {b.honesty_status || 'DICHO'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/cooperacion?code=${encodeURIComponent(b.access_code || '')}`}
                        className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition text-[11px]"
                        title="Entrar al Portal Individual de este Comercio con su clave"
                      >
                        <span>Ver Portal</span>
                        <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
