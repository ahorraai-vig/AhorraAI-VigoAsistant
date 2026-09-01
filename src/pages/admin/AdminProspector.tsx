import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Bot, Search, Save, AlertCircle, CheckCircle2, Target, Loader2 } from 'lucide-react';

type LogEntry = {
  id: string;
  type: 'user' | 'agent' | 'system' | 'success' | 'error';
  text: string;
};

export default function AdminProspector() {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([{
    id: 'welcome',
    type: 'agent',
    text: 'Hola, soy tu agente de prospección. Pídeme que busque negocios (ej: "Busca restaurantes en Navia y luego ferreterías en el Casco Vello") y me encargaré de extraerlos, enriquecerlos y guardarlos automáticamente en la base de datos.'
  }]);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type: LogEntry['type'], text: string) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), type, text }]);
  };

  const handleImportToSupabase = async (enrichedBusinesses: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No estás autenticado en Supabase.");

    const { data: existingBusinesses } = await supabase
      .from('businesses')
      .select('id, name, address, phone, website, access_code');

    const existing = existingBusinesses || [];
    const usedAccessCodes = new Set<string>(existing.map(b => (b.access_code || '').trim().toUpperCase()).filter(Boolean));

    const normalize = (str: string) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');

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

    let inserted = 0;
    let updated = 0;

    for (const biz of enrichedBusinesses) {
      const placeName = biz.name || 'Negocio Desconocido';
      const placeAddress = biz.address || '';
      
      const existingMatch = existing.find(b => {
        if (b.website && biz.website && normalize(b.website) === normalize(biz.website)) return true;
        if (b.phone && biz.phone && normalize(b.phone) === normalize(biz.phone)) return true;
        if (normalize(b.name) === normalize(placeName) && (!b.address || !placeAddress || normalize(b.address).includes(normalize(placeAddress)) || normalize(placeAddress).includes(normalize(b.address)))) return true;
        return false;
      });

      if (existingMatch) {
        const updatePayload: any = {
          name: placeName,
          description: biz.description || undefined,
          address: placeAddress || undefined,
          phone: biz.phone || undefined,
          website: biz.website || undefined,
          opening_hours: biz.opening_hours || {},
          category: biz.category || undefined,
          zone: biz.zone || undefined,
          honesty_status: biz.honesty_status || 'OBSERVADO',
          time_slots: biz.time_slots || undefined,
          cooperation: biz.cooperation || undefined,
          is_active: true,
          updated_at: new Date().toISOString()
        };
        await supabase.from('businesses').update(updatePayload).eq('id', existingMatch.id);
        updated++;
      } else {
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
          phone: biz.phone || '',
          website: biz.website || '',
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
        const { error: insertErr } = await supabase.from('businesses').insert(insertPayload);
        if (insertErr && insertErr.message?.includes('access_code')) {
           insertPayload.access_code = generateUniqueCode(placeName, biz.zone);
           await supabase.from('businesses').insert(insertPayload);
        }
        inserted++;
      }
    }
    
    // Also save to cooperation graph
    try {
      await fetch('/api/serpapi/import-cooperation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businesses: enrichedBusinesses })
      });
    } catch(e) {
      console.warn("Could not import to cooperation graph:", e);
    }

    return { inserted, updated };
  };

  const handleSend = async () => {
    if (!prompt.trim() || isProcessing) return;
    
    const userPrompt = prompt.trim();
    setPrompt("");
    addLog('user', userPrompt);
    setIsProcessing(true);

    try {
      addLog('system', "Analizando la petición...");
      
      const parseRes = await fetch('/api/agent/parse-prospecting-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt })
      });
      
      const parseData = await parseRes.json();
      
      if (!parseData.tasks || !Array.isArray(parseData.tasks) || parseData.tasks.length === 0) {
        addLog('error', "No pude entender las tareas o zonas solicitadas. Por favor, sé más específico.");
        setIsProcessing(false);
        return;
      }

      addLog('agent', `Entendido. He programado ${parseData.tasks.length} tarea(s) de búsqueda:\n${parseData.tasks.map((t: string, i: number) => `${i+1}. ${t}`).join('\n')}`);

      let totalInserted = 0;
      let totalUpdated = 0;

      for (let i = 0; i < parseData.tasks.length; i++) {
        const query = parseData.tasks[i];
        addLog('system', `[${i+1}/${parseData.tasks.length}] Extrayendo y enriqueciendo: "${query}"...`);

        const serpRes = await fetch('/api/serpapi/search-and-enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query,
            engine: "google_maps",
            enrichWithAI: true
          })
        });

        const serpData = await serpRes.json();
        
        if (serpData.error) {
          addLog('error', `Error en SerpAPI buscando "${query}": ${serpData.error}`);
          continue;
        }

        const enriched = serpData.enriched_businesses || [];
        addLog('system', `[${i+1}/${parseData.tasks.length}] Encontrados ${enriched.length} negocios. Guardando en Supabase y grafo...`);

        if (enriched.length > 0) {
          try {
            const result = await handleImportToSupabase(enriched);
            totalInserted += result.inserted;
            totalUpdated += result.updated;
            addLog('success', `[${i+1}/${parseData.tasks.length}] Guardados: ${result.inserted} nuevos, ${result.updated} actualizados.`);
          } catch (dbErr: any) {
            addLog('error', `Error al guardar en BD: ${dbErr.message}`);
          }
        }
      }

      addLog('agent', `¡Prospección completada exitosamente!\nResumen total: ${totalInserted} negocios nuevos registrados y ${totalUpdated} actualizados.`);

    } catch (err: any) {
      addLog('error', `Error del sistema: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl">
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Bot className="text-blue-600" />
          Agente Prospector Autónomo
        </h1>
        <p className="text-slate-500 mt-1">
          Automatiza la recolección, enriquecimiento e inserción de negocios usando IA.
        </p>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        {/* Chat Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {logs.map((log) => (
            <div key={log.id} className={`flex ${log.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                log.type === 'user' ? 'bg-blue-600 text-white shadow-md' :
                log.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
                log.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
                log.type === 'system' ? 'bg-slate-200/50 text-slate-600 font-mono text-xs border border-slate-200' :
                'bg-white border border-slate-200 text-slate-800 shadow-sm'
              }`}>
                {log.type === 'agent' && <div className="flex items-center gap-1.5 font-semibold text-blue-700 mb-1"><Target size={14} /> Agente AI</div>}
                {log.type === 'system' && <div className="flex items-center gap-1.5 mb-1"><Loader2 size={12} className="animate-spin" /> Sistema</div>}
                {log.type === 'success' && <div className="flex items-center gap-1.5 font-semibold text-emerald-700 mb-1"><CheckCircle2 size={14} /> Éxito</div>}
                {log.type === 'error' && <div className="flex items-center gap-1.5 font-semibold text-red-700 mb-1"><AlertCircle size={14} /> Error</div>}
                <div className="whitespace-pre-wrap">{log.text}</div>
              </div>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="flex items-center gap-3">
            <input 
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if(e.key === 'Enter') handleSend(); }}
              placeholder="Ej: Busca 5 fruterías en Teis y luego 3 floristerías en Navia..."
              disabled={isProcessing}
              className="flex-1 p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-900 transition-all disabled:opacity-50 disabled:bg-slate-100"
            />
            <button
              onClick={handleSend}
              disabled={!prompt.trim() || isProcessing}
              className="px-6 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-slate-400 flex items-center gap-2 shadow-sm"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              <span className="hidden sm:inline">{isProcessing ? 'Procesando...' : 'Enviar Orden'}</span>
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="text-xs text-slate-500 font-medium pt-1">Órdenes de ejemplo:</span>
            <button onClick={() => setPrompt("Busca peluquerías en Casco Vello")} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition">Peluquerías Casco Vello</button>
            <button onClick={() => setPrompt("Encuentra clínicas dentales en el centro de Vigo y talleres mecánicos en Bouzas")} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition">Búsqueda múltiple</button>
          </div>
        </div>
      </div>
    </div>
  );
}
