import { useState, useEffect } from 'react';
import { Key, Bot, Search, Save, CheckCircle, XCircle } from 'lucide-react';

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState<'keys' | 'serpapi'>('keys');
  const [configStatus, setConfigStatus] = useState<any>(null);
  
  // SerpAPI state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetch('/api/config/status')
      .then(res => res.json())
      .then(data => setConfigStatus(data))
      .catch(err => console.error("Error fetching config status", err));
  }, []);

  const handleTestSerpApi = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch('/api/test-serpapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      setSearchResult(data);
    } catch (e: any) {
      setSearchResult({ error: e.message });
    } finally {
      setIsSearching(false);
    }
  };

  const StatusIcon = ({ isSet }: { isSet: boolean }) => 
    isSet ? <CheckCircle size={16} className="text-emerald-500 inline ml-2" /> : <XCircle size={16} className="text-red-500 inline ml-2" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configuración / Developer</h1>
        <p className="text-slate-500 mt-1">Gestiona las variables de entorno, APIs y utilidades de desarrollo.</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('keys')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'keys' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Integraciones & API Keys
        </button>
        <button 
          onClick={() => setActiveTab('serpapi')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'serpapi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Probar SerpAPI
        </button>
      </div>

      {activeTab === 'keys' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 text-slate-900 border-b border-slate-100 pb-4">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><Key size={20} /></div>
              <h2 className="font-semibold text-lg">Supabase (Base de datos & Auth)</h2>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  VITE_SUPABASE_URL
                  {import.meta.env.VITE_SUPABASE_URL ? <StatusIcon isSet={true} /> : <StatusIcon isSet={false} />}
                </label>
                <input type="text" readOnly value={import.meta.env.VITE_SUPABASE_URL || 'No configurada'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  VITE_SUPABASE_ANON_KEY
                  {import.meta.env.VITE_SUPABASE_ANON_KEY ? <StatusIcon isSet={true} /> : <StatusIcon isSet={false} />}
                </label>
                <input type="password" readOnly value={import.meta.env.VITE_SUPABASE_ANON_KEY ? '******************************' : 'No configurada'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  SUPABASE_SERVICE_ROLE_KEY (Servidor)
                  {configStatus && <StatusIcon isSet={configStatus.supabaseServiceRole} />}
                </label>
                <input type="password" readOnly value={configStatus?.supabaseServiceRole ? '******************************' : 'No configurada'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
                <p className="text-xs text-slate-400 mt-2">Se gestiona desde el panel de variables de entorno del servidor.</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 text-slate-900 border-b border-slate-100 pb-4">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Bot size={20} /></div>
              <h2 className="font-semibold text-lg">Telegram Bot API</h2>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  TELEGRAM_BOT_TOKEN
                  {configStatus && <StatusIcon isSet={configStatus.telegramBot} />}
                </label>
                <input type="password" readOnly value={configStatus?.telegramBot ? '******************************' : 'No configurada'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
                <p className="text-xs text-slate-400 mt-2">Para modificarla, actualiza los secrets de tu entorno.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 text-slate-900 border-b border-slate-100 pb-4">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-lg"><Search size={20} /></div>
              <h2 className="font-semibold text-lg">SerpAPI</h2>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  SERPAPI_API_KEY
                  {configStatus && <StatusIcon isSet={configStatus.serpApi} />}
                </label>
                <input type="password" readOnly value={configStatus?.serpApi ? '******************************' : 'No configurada'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
                <p className="text-xs text-slate-400 mt-2">Token para habilitar las búsquedas web en tiempo real en el asistente.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'serpapi' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl">
          <div className="flex items-center space-x-3 text-slate-900 mb-6">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg"><Search size={20} /></div>
            <div>
              <h2 className="font-semibold text-lg">Test de SerpAPI</h2>
              <p className="text-sm text-slate-500">Prueba búsquedas en vivo de Google para nutrir al asistente.</p>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ej: Restaurantes marisco Vigo..." 
              className="flex-1 p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" 
            />
            <button 
              onClick={handleTestSerpApi}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 h-96 overflow-auto">
            {searchResult ? (
              <pre className="text-green-400 font-mono text-xs">
                {JSON.stringify(searchResult, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm text-center">
                Realiza una búsqueda para ver los resultados devueltos por SerpAPI aquí.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
