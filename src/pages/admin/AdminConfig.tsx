import { useState, useEffect } from 'react';
import { 
  Key, 
  Bot, 
  Search, 
  Save, 
  CheckCircle, 
  XCircle, 
  Download, 
  Copy, 
  Check, 
  Layers, 
  Sparkles, 
  Handshake, 
  Store, 
  MapPin, 
  Phone, 
  Globe, 
  Clock, 
  ShieldCheck, 
  ExternalLink,
  Code,
  FileJson,
  Info,
  Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminFetch } from '../../lib/apiAuth';

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState<'serpapi' | 'sql' | 'keys'>('serpapi');
  const [configStatus, setConfigStatus] = useState<any>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  
  // SerpAPI state
  const [searchQuery, setSearchQuery] = useState('Peluquerías en el casco viejo de Vigo');
  const [selectedEngine, setSelectedEngine] = useState<'google_maps' | 'google_local' | 'google'>('google_maps');
  const [enrichWithAI, setEnrichWithAI] = useState(true);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [enrichedBusinesses, setEnrichedBusinesses] = useState<any[]>([]);
  const [resultViewMode, setResultViewMode] = useState<'cards' | 'json_enriched' | 'json_raw'>('cards');
  
  const [isSearching, setIsSearching] = useState(false);
  const [isImportingSupabase, setIsImportingSupabase] = useState(false);
  const [isImportingCooperation, setIsImportingCooperation] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [importMessage, setImportMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const SUGGESTED_QUERIES = [
    'Peluquerías en Casco Vello',
    'Taperías en Bouzas',
    'Farmacias en Calvario',
    'Librerías y café en Príncipe',
    'Gimnasios en Gran Vía',
    'Panaderías artesanas en Travesas'
  ];

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
    setEnrichedBusinesses([]);
    setImportMessage(null);
    try {
      const res = await adminFetch('/api/serpapi/search-and-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery,
          engine: selectedEngine,
          enrichWithAI
        })
      });
      const data = await res.json();
      if (data.error) {
        setSearchResult({ error: data.error });
        setImportMessage({ type: 'error', text: `Error de SerpAPI: ${data.error}` });
      } else {
        setSearchResult(data);
        setEnrichedBusinesses(data.enriched_businesses || []);
        setImportMessage({ 
          type: 'success', 
          text: `Se extrajeron y estructuraron ${data.enriched_businesses?.length || 0} negocios en Vigo con el 100% de datos para la ficha de inicio.` 
        });
      }
    } catch (e: any) {
      setSearchResult({ error: e.message });
      setImportMessage({ type: 'error', text: `Error al conectar: ${e.message}` });
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadJSON = () => {
    if (!enrichedBusinesses.length) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(enrichedBusinesses, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ahorraai-vigo-negocios-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJSON = () => {
    if (!enrichedBusinesses.length) return;
    navigator.clipboard.writeText(JSON.stringify(enrichedBusinesses, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleImportToCooperation = async () => {
    if (!enrichedBusinesses.length) return;
    setIsImportingCooperation(true);
    setImportMessage(null);
    try {
      const res = await adminFetch('/api/serpapi/import-cooperation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses: enrichedBusinesses })
      });
      const data = await res.json();
      if (data.success) {
        setImportMessage({
          type: 'success',
          text: data.message || `¡Negocios integrados con éxito en la Red de Cooperación! Se han recalculado las sinergias comerciales.`
        });
      } else {
        setImportMessage({ type: 'error', text: data.error || 'Error al importar al grafo.' });
      }
    } catch (err: any) {
      setImportMessage({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setIsImportingCooperation(false);
    }
  };

  const handleImportToSupabase = async () => {
    if (!enrichedBusinesses.length) {
      setImportMessage({ type: 'error', text: 'No hay negocios enriquecidos para importar.' });
      return;
    }
    
    setIsImportingSupabase(true);
    setImportMessage(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No estás autenticado en Supabase. Inicia sesión en el panel primero.");
      }

      // 1. Obtener todos los comercios existentes con id, access_code y campos clave
      const { data: existingBusinesses, error: fetchError } = await supabase
        .from('businesses')
        .select('id, name, address, phone, website, access_code');
        
      if (fetchError) {
        console.error("Error fetching existing businesses:", fetchError);
      }
      
      const existing = existingBusinesses || [];
      const usedAccessCodes = new Set<string>(
        existing.map(b => (b.access_code || '').trim().toUpperCase()).filter(Boolean)
      );

      const normalize = (str: string) => 
        (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
      
      const generateUniqueCode = (name: string, zone?: string) => {
        const cleanZone = (zone || name).replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase() || "COMM";
        let code = '';
        let attempts = 0;
        do {
          const randNum = Math.floor(10000 + Math.random() * 90000);
          const salt = Math.random().toString(36).substring(2, 6).toUpperCase();
          code = `VIGO-${randNum}-${cleanZone}-${salt}`;
          attempts++;
        } while (usedAccessCodes.has(code) && attempts < 100);
        usedAccessCodes.add(code);
        return code;
      };

      let insertedCount = 0;
      let updatedCount = 0;
      const errorsList: string[] = [];

      for (const biz of enrichedBusinesses) {
        const placeName = biz.name || 'Negocio Desconocido';
        const placeAddress = biz.address || '';
        const placePhone = biz.phone || '';
        const placeWebsite = biz.website || '';
        
        // Comprobar si ya existe en Supabase
        const existingMatch = existing.find(b => {
          if (b.website && placeWebsite && normalize(b.website) === normalize(placeWebsite)) return true;
          if (b.phone && placePhone && normalize(b.phone) === normalize(placePhone)) return true;
          if (normalize(b.name) === normalize(placeName) && (
            !b.address || !placeAddress || normalize(b.address).includes(normalize(placeAddress)) || normalize(placeAddress).includes(normalize(b.address))
          )) return true;
          if (biz.access_code && b.access_code && b.access_code.toUpperCase() === biz.access_code.toUpperCase()) return true;
          return false;
        });

        if (existingMatch) {
          // Actualizar registro existente conservando su ID y su access_code previo
          const updatePayload: any = {
            name: placeName,
            description: biz.description || undefined,
            address: placeAddress || undefined,
            phone: placePhone || undefined,
            website: placeWebsite || undefined,
            opening_hours: biz.opening_hours || {},
            category: biz.category || undefined,
            zone: biz.zone || undefined,
            honesty_status: biz.honesty_status || 'OBSERVADO',
            time_slots: biz.time_slots || undefined,
            cooperation: biz.cooperation || undefined,
            is_active: true,
            updated_at: new Date().toISOString()
          };

          const { error: updateErr } = await supabase
            .from('businesses')
            .update(updatePayload)
            .eq('id', existingMatch.id);

          if (updateErr) {
            console.warn(`[Supabase Update Error for ${placeName}]:`, updateErr);
            errorsList.push(`${placeName}: ${updateErr.message}`);
          } else {
            updatedCount++;
          }
        } else {
          // Crear nuevo registro garantizando access_code único sin colisiones
          let safeAccessCode = (biz.access_code || '').trim().toUpperCase();
          if (!safeAccessCode || usedAccessCodes.has(safeAccessCode)) {
            safeAccessCode = generateUniqueCode(placeName, biz.zone);
          } else {
            usedAccessCodes.add(safeAccessCode);
          }

          const insertPayload: any = {
            name: placeName,
            description: biz.description || '',
            address: placeAddress,
            phone: placePhone,
            website: placeWebsite,
            opening_hours: biz.opening_hours || {},
            category: biz.category || 'Comercio Local',
            zone: biz.zone || 'Vigo Centro',
            access_code: safeAccessCode,
            honesty_status: biz.honesty_status || 'OBSERVADO',
            time_slots: biz.time_slots || { morning: "", afternoon: "", night: "" },
            cooperation: biz.cooperation || {},
            is_active: true,
            owner_id: user.id
          };

          const { error: insertErr } = await supabase
            .from('businesses')
            .insert(insertPayload);

          if (insertErr) {
            console.warn(`[Supabase Insert Error for ${placeName}]:`, insertErr);
            // Reintentar con nuevo código generado por si hubiera colisión remota
            if (insertErr.message?.includes('access_code')) {
              insertPayload.access_code = generateUniqueCode(placeName, biz.zone);
              const { error: retryErr } = await supabase.from('businesses').insert(insertPayload);
              if (!retryErr) {
                insertedCount++;
                continue;
              }
            }
            errorsList.push(`${placeName}: ${insertErr.message}`);
          } else {
            insertedCount++;
          }
        }
      }

      if (errorsList.length > 0 && insertedCount === 0 && updatedCount === 0) {
        setImportMessage({ 
          type: 'error', 
          text: `Error al guardar en Supabase: ${errorsList[0]}` 
        });
      } else {
        setImportMessage({ 
          type: 'success', 
          text: `Supabase sincronizado: ${insertedCount} nuevos comercios insertados, ${updatedCount} actualizados con datos enriquecidos.` 
        });
      }
    } catch (error: any) {
      setImportMessage({ type: 'error', text: `Error al importar a Supabase: ${error.message}` });
    } finally {
      setIsImportingSupabase(false);
    }
  };

  const StatusIcon = ({ isSet }: { isSet: boolean }) => 
    isSet ? <CheckCircle size={16} className="text-emerald-500 inline ml-2" /> : <XCircle size={16} className="text-red-500 inline ml-2" />;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configuración / Developer</h1>
        <p className="text-slate-500 mt-1">Gestiona las variables de entorno, APIs y utilidades de extracción y enriquecimiento de comercios locales.</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('serpapi')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'serpapi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Extracción & JSON Enriquecido (SerpAPI)
        </button>
        <button 
          onClick={() => setActiveTab('sql')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sql' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Esquema SQL & Tablas (Supabase)
        </button>
        <button 
          onClick={() => setActiveTab('keys')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'keys' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Integraciones & API Keys
        </button>
      </div>

      {activeTab === 'sql' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3 text-slate-900">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl"><Layers size={22} /></div>
                <div>
                  <h2 className="font-bold text-lg text-slate-900">Script SQL para Supabase (AhorraAI v4)</h2>
                  <p className="text-sm text-slate-500">Copia y pega este script en el <strong>SQL Editor</strong> de tu proyecto en Supabase para habilitar todas las columnas y políticas.</p>
                </div>
              </div>

              <button
                onClick={() => {
                  const sqlCode = `-- ==============================================================================
-- AhorraAI v4: Script de Creación y Migración de Tablas en Supabase
-- ==============================================================================

-- 1. Asegurar la tabla de perfiles de usuario (Admin / Comercio)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'business' CHECK (role IN ('admin', 'business')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Asegurar y extender la tabla de comercios (businesses)
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_code TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Comercio Local',
  description TEXT,
  address TEXT,
  zone TEXT DEFAULT 'Vigo Centro',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  website TEXT,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  time_slots JSONB DEFAULT '{"morning":"","afternoon":"","night":""}'::jsonb,
  honesty_status TEXT DEFAULT 'OBSERVADO' CHECK (honesty_status IN ('DICHO', 'OBSERVADO', 'SIN_CONFIRMAR')),
  cooperation JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Si la tabla businesses ya existía con columnas antiguas, agregar las nuevas columnas con seguridad:
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Comercio Local';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'Vigo Centro';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS time_slots JSONB DEFAULT '{"morning":"","afternoon":"","night":""}'::jsonb;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS honesty_status TEXT DEFAULT 'OBSERVADO';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS cooperation JSONB DEFAULT '{}'::jsonb;

-- 3. Tabla para Sinergias Comerciales Detectadas por IA (Oportunidades de Cooperación)
CREATE TABLE IF NOT EXISTS public.synergies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_a_id TEXT NOT NULL,
  business_a_name TEXT NOT NULL,
  business_b_id TEXT NOT NULL,
  business_b_name TEXT NOT NULL,
  synergy_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  benefit_a TEXT NOT NULL,
  benefit_b TEXT NOT NULL,
  compatibility_score INTEGER DEFAULT 80,
  status TEXT DEFAULT 'sugerida' CHECK (status IN ('sugerida', 'en_contacto', 'activa')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synergies ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública para el Asistente y el Grafo
CREATE POLICY "Permitir lectura pública de comercios activos" 
  ON public.businesses FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Permitir lectura pública de sinergias sugeridas" 
  ON public.synergies FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Política de inserción y modificación para administradores y dueños
CREATE POLICY "Permitir a usuarios autenticados insertar o actualizar comercios" 
  ON public.businesses FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);`;
                  navigator.clipboard.writeText(sqlCode);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-sm"
              >
                {copiedSql ? <Check size={16} className="text-white" /> : <Copy size={16} />}
                <span>{copiedSql ? '¡Copiado al portapapeles!' : 'Copiar Script SQL'}</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl overflow-x-auto">
              <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
{`-- ==============================================================================
-- AhorraAI v4: Script de Creación y Migración de Tablas en Supabase
-- ==============================================================================

-- 1. Asegurar la tabla de perfiles de usuario (Admin / Comercio)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'business' CHECK (role IN ('admin', 'business')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Asegurar y extender la tabla de comercios (businesses)
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_code TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Comercio Local',
  description TEXT,
  address TEXT,
  zone TEXT DEFAULT 'Vigo Centro',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  website TEXT,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  time_slots JSONB DEFAULT '{"morning":"","afternoon":"","night":""}'::jsonb,
  honesty_status TEXT DEFAULT 'OBSERVADO' CHECK (honesty_status IN ('DICHO', 'OBSERVADO', 'SIN_CONFIRMAR')),
  cooperation JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Si la tabla businesses ya existía con columnas antiguas, agregar las nuevas columnas:
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Comercio Local';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'Vigo Centro';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS time_slots JSONB DEFAULT '{"morning":"","afternoon":"","night":""}'::jsonb;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS honesty_status TEXT DEFAULT 'OBSERVADO';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS cooperation JSONB DEFAULT '{}'::jsonb;

-- 3. Tabla para Sinergias Comerciales Detectadas por IA (Oportunidades de Cooperación)
CREATE TABLE IF NOT EXISTS public.synergies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_a_id TEXT NOT NULL,
  business_a_name TEXT NOT NULL,
  business_b_id TEXT NOT NULL,
  business_b_name TEXT NOT NULL,
  synergy_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  benefit_a TEXT NOT NULL,
  benefit_b TEXT NOT NULL,
  compatibility_score INTEGER DEFAULT 80,
  status TEXT DEFAULT 'sugerida' CHECK (status IN ('sugerida', 'en_contacto', 'activa')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Políticas de Lectura Pública (RLS)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura pública de comercios activos" 
  ON public.businesses FOR SELECT USING (is_active = true);

CREATE POLICY "Permitir lectura pública de sinergias sugeridas" 
  ON public.synergies FOR SELECT TO anon, authenticated USING (true);`}
              </pre>
            </div>
          </div>
        </div>
      )}

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
              <h2 className="font-semibold text-lg">SerpAPI (Multi-Engine)</h2>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  SERPAPI_API_KEY
                  {configStatus && <StatusIcon isSet={configStatus.serpApi} />}
                </label>
                <input type="password" readOnly value={configStatus?.serpApi ? '******************************' : 'No configurada'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
                <p className="text-xs text-slate-400 mt-2">Tu clave única de SerpAPI habilita automáticamente todos los engines (google_maps, google_local, reviews y web).</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 text-slate-900 border-b border-slate-100 pb-4">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg"><Key size={20} /></div>
              <h2 className="font-semibold text-lg">Groq API (Sistema de Respaldo)</h2>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  GROQ_API_KEY (Fallback Llama 3.1)
                  {configStatus && <StatusIcon isSet={configStatus.groq} />}
                </label>
                <input type="password" readOnly value={configStatus?.groq ? '******************************' : 'No configurada'} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm" />
                <p className="text-xs text-slate-400 mt-2">Permite que el asistente y el enriquecedor de negocios respondan al instante si Gemini agota su cuota.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'serpapi' && (
        <div className="space-y-6">
          {/* Card de Configuración de Extracción & SerpAPI Engines */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3 text-slate-900">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl"><Search size={22} /></div>
                <div>
                  <h2 className="font-bold text-xl text-slate-900">Generador de JSON Enriquecido para Fichas de Negocio</h2>
                  <p className="text-sm text-slate-500">Extrae comercios locales de Google con SerpAPI y los estructura con el 100% de los datos del formulario de alta y sinergias (Honestidad: OBSERVADO).</p>
                </div>
              </div>
            </div>

            {/* Selector de Engines y Opciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Filter size={14} className="text-blue-600" />
                  Engine de SerpAPI
                </label>
                <select 
                  value={selectedEngine}
                  onChange={(e: any) => setSelectedEngine(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="google_maps">google_maps (Recomendado: Maps Completo, Coordenadas, Horarios)</option>
                  <option value="google_local">google_local (Local Pack de Google SERP)</option>
                  <option value="google">google (Búsqueda Web Orgánica)</option>
                </select>
              </div>

              <div className="flex flex-col justify-center">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  Enriquecimiento Inteligente (IA)
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input 
                    type="checkbox" 
                    checked={enrichWithAI}
                    onChange={(e) => setEnrichWithAI(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Completar 3 franjas, horas valle y sinergias</span>
                </label>
              </div>

              <div className="flex flex-col justify-center text-xs text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Honestidad Estructural
                </span>
                <span>Los datos generados se etiquetan como <strong className="text-emerald-600">OBSERVADO</strong> para distinguir datos de scraping de los validados por el dueño.</span>
              </div>
            </div>

            {/* Input de Búsqueda */}
            <div className="flex gap-3 mb-3">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej: Peluquerías en Casco Vello, Restaurantes en Bouzas, etc..." 
                className="flex-1 p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-900" 
              />
              <button 
                onClick={handleTestSerpApi}
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {isSearching ? (
                  <>
                    <span className="animate-spin text-lg">⏳</span>
                    <span>Extrayendo...</span>
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    <span>Buscar & Enriquecer</span>
                  </>
                )}
              </button>
            </div>

            {/* Sugerencias Rápidas de Vigo */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 font-medium">Búsquedas rápidas en Vigo:</span>
              {SUGGESTED_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSearchQuery(q); }}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Mensajes de Feedback */}
          {importMessage && (
            <div className={`p-4 rounded-xl flex items-center space-x-3 shadow-sm ${importMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              {importMessage.type === 'success' ? <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" /> : <XCircle size={20} className="text-red-600 flex-shrink-0" />}
              <span className="text-sm font-medium">{importMessage.text}</span>
            </div>
          )}

          {/* Información sobre sub-APIs y engines de SerpAPI */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-blue-900">
            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sm">💡 Nota sobre las sub-APIs y Engines de SerpAPI:</p>
              <p>
                <strong>No necesitas contratar ni pagar APIs adicionales.</strong> Tu misma clave <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800 font-mono">SERPAPI_API_KEY</code> tiene acceso directo a todos los engines: <strong className="underline">google_maps</strong> (el más completo para negocios locales con horarios, teléfonos y coordenadas), <strong className="underline">google_local</strong> (pack de resultados de búsqueda) y <strong className="underline">google_maps_reviews</strong>.
              </p>
              <p className="text-blue-700">
                AhorraAI procesa automáticamente la respuesta de estos engines y genera el 100% de los campos necesarios para la ficha de inicio (3 franjas de horarios, horas valle, zona de Vigo, categoría oficial y perfil para el Grafo de Cooperación).
              </p>
            </div>
          </div>

          {/* Resultados de la Extracción */}
          {searchResult && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Barra de Acciones y Vistas */}
              <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setResultViewMode('cards')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${resultViewMode === 'cards' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Store size={14} />
                      <span>Fichas Enriquecidas ({enrichedBusinesses.length})</span>
                    </button>
                    <button
                      onClick={() => setResultViewMode('json_enriched')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${resultViewMode === 'json_enriched' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      <FileJson size={14} />
                      <span>JSON Ficha Completa</span>
                    </button>
                    <button
                      onClick={() => setResultViewMode('json_raw')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${resultViewMode === 'json_raw' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                      <Code size={14} />
                      <span>JSON Raw SerpAPI</span>
                    </button>
                  </div>
                </div>

                {enrichedBusinesses.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopyJSON}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {copiedJson ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedJson ? 'Copiado' : 'Copiar JSON'}</span>
                    </button>

                    <button
                      onClick={handleDownloadJSON}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Download size={14} />
                      <span>Descargar .json</span>
                    </button>

                    <button
                      onClick={handleImportToSupabase}
                      disabled={isImportingSupabase}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow disabled:opacity-50"
                    >
                      <Download size={14} />
                      <span>{isImportingSupabase ? 'Guardando...' : 'Guardar en Base de Datos (Supabase)'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Contenido según la vista seleccionada */}
              {resultViewMode === 'cards' && (
                <div className="p-6 bg-slate-50/50">
                  {enrichedBusinesses.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      No se encontraron resultados para enriquecer. Prueba con otro término de búsqueda.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {enrichedBusinesses.map((biz: any, idx: number) => (
                        <div key={biz.id || idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 transition-all space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base text-slate-900">{biz.name}</h3>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  {biz.category}
                                </span>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                  <ShieldCheck size={12} />
                                  {biz.honesty_status}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-mono font-bold px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                                {biz.access_code}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">{biz.description}</p>

                          <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-red-500 flex-shrink-0" />
                              <span className="truncate"><strong>{biz.zone}:</strong> {biz.address}</span>
                            </div>
                            {biz.phone && (
                              <div className="flex items-center gap-2">
                                <Phone size={13} className="text-emerald-600 flex-shrink-0" />
                                <span>{biz.phone}</span>
                              </div>
                            )}
                            {biz.website && (
                              <div className="flex items-center gap-2">
                                <Globe size={13} className="text-blue-600 flex-shrink-0" />
                                <a href={biz.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                                  {biz.website}
                                </a>
                              </div>
                            )}
                          </div>

                          {/* 3 Franjas Horarias + Horas Valle */}
                          <div className="pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1.5">
                              <Clock size={13} className="text-indigo-600" />
                              <span>Horarios en 3 Franjas & Horas Valle</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-slate-100 p-1.5 rounded-lg">
                                <span className="block text-[10px] text-slate-500 font-medium">Mañana</span>
                                <span className="font-semibold text-slate-800 text-[11px]">{biz.time_slots?.morning || 'N/A'}</span>
                              </div>
                              <div className="bg-slate-100 p-1.5 rounded-lg">
                                <span className="block text-[10px] text-slate-500 font-medium">Tarde</span>
                                <span className="font-semibold text-slate-800 text-[11px]">{biz.time_slots?.afternoon || 'N/A'}</span>
                              </div>
                              <div className="bg-amber-50 border border-amber-200 p-1.5 rounded-lg">
                                <span className="block text-[10px] text-amber-700 font-bold">Hora Valle</span>
                                <span className="font-semibold text-amber-900 text-[11px]">{biz.cooperation?.valleyHours || biz.valleyHours || '15:00 - 17:30'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Cooperación & Sinergias */}
                          <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                            <div className="text-slate-700">
                              <strong className="text-blue-700">Capacidad Ociosa:</strong> {biz.cooperation?.idleCapacity?.join(', ') || 'Espacio expositor'}
                            </div>
                            <div className="text-slate-700">
                              <strong className="text-emerald-700">Ofertas Cruzadas:</strong> {biz.cooperation?.offers?.join(', ') || 'Descuentos cruzados'}
                            </div>
                            {biz.cooperation?.specialProposal && (
                              <div className="text-indigo-900 bg-indigo-50/70 p-2 rounded-lg border border-indigo-100 italic text-[11px]">
                                "{biz.cooperation.specialProposal}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {resultViewMode === 'json_enriched' && (
                <div className="p-4 bg-slate-950 overflow-auto max-h-[600px]">
                  <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
                    {JSON.stringify(enrichedBusinesses, null, 2)}
                  </pre>
                </div>
              )}

              {resultViewMode === 'json_raw' && (
                <div className="p-4 bg-slate-950 overflow-auto max-h-[600px]">
                  <pre className="text-amber-400 font-mono text-xs leading-relaxed">
                    {JSON.stringify(searchResult.raw_serpapi || searchResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

