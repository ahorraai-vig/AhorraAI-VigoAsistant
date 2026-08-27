import express from "express";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// Init Gemini (Server Side Only)
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Init Supabase (Server Side)
const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')?.replace(/\/$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Rutas de administración y configuración
app.get("/api/config/status", (req, res) => {
  res.json({
    supabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
    serpApi: !!process.env.SERPAPI_API_KEY
  });
});

app.post("/api/test-serpapi", async (req, res) => {
  try {
    const { query } = req.body;
    const apiKey = process.env.SERPAPI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "SERPAPI_API_KEY no está configurada en el servidor." });
    }

    // Usar engine=google_local para obtener local_results para el importador
    const response = await fetch(`https://serpapi.com/search.json?engine=google_local&q=${encodeURIComponent(query)}&location=Vigo,+Spain&hl=es&gl=es&google_domain=google.es&api_key=${apiKey}`);
    const data = await response.json();
    res.json(data);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Heurística de relevancia de negocios locales
const scoreBusiness = (business: any, query: string): number => {
  let score = 0;
  const q = query.toLowerCase();
  const name = (business.name || '').toLowerCase();
  const desc = (business.description || '').toLowerCase();
  const addr = (business.address || '').toLowerCase();

  // Coincidencia exacta o fuerte en nombre
  if (name === q || name.includes(q) || q.includes(name)) score += 100;
  
  // Términos de la consulta (dividiendo por palabras)
  const words = q.split(/\s+/).filter((w: string) => w.length > 2);
  let wordMatches = 0;
  
  for (const w of words) {
    if (name.includes(w)) {
      score += 30;
      wordMatches++;
    } else if (desc.includes(w)) {
      score += 20;
      wordMatches++;
    } else if (addr.includes(w)) {
      score += 15;
      wordMatches++;
    }
  }

  // Sinónimos / Mapeo de intención básica
  const isFood = q.includes('comer') || q.includes('cenar') || q.includes('restaurante') || q.includes('marisco') || q.includes('tapas');
  const isShop = q.includes('comprar') || q.includes('tienda') || q.includes('ropa') || q.includes('zapatillas');
  
  const descIsFood = desc.includes('restaurante') || desc.includes('comida') || desc.includes('bar');
  const descIsShop = desc.includes('tienda') || desc.includes('ropa') || desc.includes('comercio');

  if (isFood && descIsFood) score += 40;
  if (isShop && descIsShop) score += 40;

  // Bonus básico si está activo
  if (business.is_active) score += 10;
  
  return score;
};

// --- Servicios ---

const serpapiService = {
  searchLocal: async (query: string) => {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return null;
    try {
      const url = `https://serpapi.com/search.json?engine=google_local&q=${encodeURIComponent(query)}&location=Vigo,+Spain&hl=es&gl=es&google_domain=google.es&api_key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.local_results || data.places_results || null;
    } catch (error) {
      console.error("[SerpAPI Local Error]:", error);
      return null;
    }
  },
  searchWeb: async (query: string) => {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) return null;
    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&location=Vigo,+Spain&hl=es&gl=es&google_domain=google.es&api_key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.organic_results || data;
    } catch (error) {
      console.error("[SerpAPI Web Error]:", error);
      return null;
    }
  }
};

const getRelevantLocalBusinesses = async (query: string, maxResults = 5) => {
  if (!supabase) return [];
  
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('is_active', true);
    
  if (error || !businesses) return [];
  
  const scoredBusinesses = businesses.map(b => ({
    ...b,
    relevanceScore: scoreBusiness(b, query)
  }));
  
  const LOCAL_MATCH_THRESHOLD = 30;
  return scoredBusinesses
    .filter(b => b.relevanceScore >= LOCAL_MATCH_THRESHOLD)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
};

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, config } = req.body;
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY no configurada." });
    }

    const lastMessage = messages[messages.length - 1].text;
    
    let localDatabaseResultsText = "No relevant local database results.";
    let externalSerpapiResultsText = "No external results fetched.";
    
    // 1. Buscar en Supabase
    const localCandidates = await getRelevantLocalBusinesses(lastMessage);

    if (localCandidates.length > 0) {
      localDatabaseResultsText = localCandidates.map(b => 
        `- Nombre: ${b.name}\n  Descripción/Categoría: ${b.description || 'N/A'}\n  Dirección: ${b.address || 'N/A'}\n  Teléfono: ${b.phone || 'N/A'}\n  Web: ${b.website || 'N/A'}\n  Source: local_database`
      ).join('\n\n');
    } else {
      // 2. Fallback a SerpAPI si no hay suficientes candidatos locales
      const isGeneral = lastMessage.toLowerCase().includes('historia') || lastMessage.toLowerCase().includes('quién');
      
      const searchTerms = lastMessage + (isGeneral ? "" : " en Vigo");
      console.log(`[Chat API] Sin resultados locales. Buscando en SerpAPI: ${searchTerms} (general: ${isGeneral})`);
      
      const externalResults = isGeneral 
        ? await serpapiService.searchWeb(searchTerms) 
        : await serpapiService.searchLocal(searchTerms);
        
      if (externalResults && Array.isArray(externalResults) && externalResults.length > 0) {
        externalSerpapiResultsText = externalResults.slice(0, 5).map((r: any) => 
          `- Nombre/Título: ${r.title || r.name}\n  Descripción/Tipo: ${r.type || r.snippet || 'N/A'}\n  Dirección: ${r.address || 'N/A'}\n  Teléfono: ${r.phone || 'N/A'}\n  Web: ${r.links?.website || r.link || 'N/A'}\n  Source: serpapi_${isGeneral ? 'web' : 'local'}`
        ).join('\n\n');
      } else {
        externalSerpapiResultsText = "Búsqueda externa realizada pero sin resultados relevantes.";
      }
    }

    const systemInstruction = `Eres el "Asistente Vigo", el mejor asistente turístico y local de Vigo (Galicia).
Tu tono es cercano, útil y tienes un ligero toque de humor gallego (usando alguna expresión típica si procede, pero sin exagerar).
Responde en el idioma indicado por el usuario.

Configuración del usuario:
- Tipo de usuario: ${config?.userType === 'local' ? 'Residente / Local' : 'Turista / Visita'}\n- Tiempo disponible: ${config?.timeAvailable || 'No especificado'}
- Intereses: ${config?.interests?.join(', ') || 'No especificado'}
- Idioma preferido: ${config?.language || 'Español'}

CONTEXTO ESTRUCTURADO DE NEGOCIOS Y SERVICIOS:

LOCAL_DATABASE_RESULTS (Prioridad #1 - Red Local Cooperativa):
${localDatabaseResultsText}

EXTERNAL_SERPAPI_RESULTS (Prioridad #2 - Resultados Externos):
${externalSerpapiResultsText}

SOURCE_POLICY (REGLAS ESTRICTAS):
1. La base de datos local (LOCAL_DATABASE_RESULTS) tiene PRIORIDAD ABSOLUTA. Si hay negocios aquí, recomiéndalos primero.
2. No inventes negocios, horarios, precios, teléfonos, webs ni reseñas.
3. Si un negocio procede de LOCAL_DATABASE_RESULTS, preséntalo como parte de nuestra red local de negocios.
4. Si un negocio procede de EXTERNAL_SERPAPI_RESULTS, indícalo de forma natural como información encontrada externamente en Internet, aclarando que aún no forman parte de nuestra red local.
5. Si hay mezcla de ambos: menciona primero los de la red local, y luego opciones externas útiles.
6. Nunca afirmes que un negocio está abierto si no tienes el dato real.
7. Nunca rellenes huecos con tu imaginación (cero alucinaciones).
8. Si no hay información suficiente en ninguna de las dos fuentes, dilo claramente. No inventes alternativas falsas.
9. Respeta el idioma seleccionado por el usuario en toda tu respuesta.

Para recomendaciones locales, usa una estructura clara, limpia y adaptada a móviles (listas cortas, datos clave).
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: messages.map((m: any) => ({
        role: m.isBot ? 'model' : 'user',
        parts: [{ text: m.text }]
      })),
      config: {
        systemInstruction,
      }
    });

    res.json({ text: response.text });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Error de comunicación con el asistente." });
  }
});

export default app;
