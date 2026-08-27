import { useState, useEffect } from 'react';
import { Key, Bot, Search, Save, CheckCircle, XCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState<'keys' | 'serpapi'>('keys');
  const [configStatus, setConfigStatus] = useState<any>(null);
  
  // SerpAPI state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

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
    setImportMessage(null);
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

  const handleImportBusinesses = async () => {
    let rawResults = searchResult?.local_results || searchResult?.places_results;
    let results: any[] = [];

    if (Array.isArray(rawResults)) {
      results = rawResults;
    } else if (rawResults && Array.isArray(rawResults.places)) {
      results = rawResults.places;
    } else if (rawResults && typeof rawResults === 'object') {
      results = [rawResults];
    }

    if (results.length === 0) {
      setImportMessage({ type: 'error', text: 'No se encontraron resultados locales (local_results / places_results) válidos para importar en este JSON. Intenta añadir "en Vigo" a tu búsqueda.' });
      return;
    }
    
    setIsImporting(true);
    setImportMessage(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No estás autenticado o la sesión expiró.");
      }

      // Fetch existing businesses to deduplicate
      const { data: existingBusinesses, error: fetchError } = await supabase
        .from('businesses')
        .select('name, address, phone, website');
        
      if (fetchError) {
        console.error("Error fetching existing businesses:", fetchError);
      }
      
      const existing = existingBusinesses || [];
      const normalize = (str: string) => (str || '').toLowerCase().trim();
      
      let dupCount = 0;
      const businessesToInsert = [];

      for (const place of results) {
        const placeName = place.title || 'Negocio Desconocido';
        const placeAddress = place.address || '';
        const placePhone = place.phone || '';
        const placeWebsite = place.links?.website || place.website || '';
        
        // Deduplication rules
        const isDuplicate = existing.some(b => {
          // 1. Same website (if both have one)
          if (b.website && placeWebsite && normalize(b.website) === normalize(placeWebsite)) return true;
          // 2. Same phone (if both have one)
          if (b.phone && placePhone && normalize(b.phone) === normalize(placePhone)) return true;
          // 3. Same name AND same address
          if (normalize(b.name) === normalize(placeName) && normalize(b.address) === normalize(placeAddress)) return true;
          return false;
        });
        
        if (isDuplicate) {
          dupCount++;
          continue;
        }

        // Add to our batch
        businessesToInsert.push({
          name: placeName,
          description: place.type || place.description || '',
          address: placeAddress,
          phone: placePhone,
          website: placeWebsite,
          latitude: place.gps_coordinates?.latitude || null,
          longitude: place.gps_coordinates?.longitude || null,
          opening_hours: place.operating_hours || {},
          is_active: true,
          owner_id: user.id
        });
        
        // Update our 'existing' array to catch duplicates within the same import batch
        existing.push({ name: placeName, address: placeAddress, phone: placePhone, website: placeWebsite });
      }

      if (businessesToInsert.length > 0) {
        const { error } = await supabase
          .from('businesses')
          .insert(businessesToInsert);
          
        if (error) throw error;
      }
      
      setImportMessage({ 
        type: 'success', 
        text: `Importación completada: ${businessesToInsert.length} nuevos insertados, ${dupCount} duplicados omitidos.` 
      });
    } catch (error: any) {
      setImportMessage({ type: 'error', text: `Error al importar: ${error.message}` });
    } finally {
      setIsImporting(false);
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
          
          {importMessage && (
            <div className={`p-4 mb-4 rounded-lg flex items-center space-x-2 ${importMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {importMessage.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <span>{importMessage.text}</span>
            </div>
          )}

          <div className="bg-slate-900 rounded-xl p-4 h-96 overflow-auto relative group">
            {searchResult && !searchResult.error && (
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={handleImportBusinesses}
                  disabled={isImporting}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-lg disabled:opacity-50"
                >
                  <Download size={16} />
                  <span>{isImporting ? 'Importando...' : 'Importar a Supabase'}</span>
                </button>
              </div>
            )}
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
