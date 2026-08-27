import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Init Gemini (Server Side Only)
  const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  // Init Supabase (Server Side)
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')?.replace(/\/$/, '');
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = (supabaseUrl && supabaseServiceKey) 
    ? createClient(supabaseUrl, supabaseServiceKey) // Usa el Service Role para saltar RLS en el backend
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

      const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&location=Vigo,+Spain&hl=es&gl=es&api_key=${apiKey}`);
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, config } = req.body;
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY no configurada." });
      }

      // Fetch active businesses from Supabase
      let localBusinessesText = "No hay negocios registrados en este momento.";
      if (supabase) {
        const { data: businesses, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('is_active', true);
          
        if (error) {
          console.error("[Chat API] Error fetching businesses:", error);
        } else if (businesses && businesses.length > 0) {
          console.log(`[Chat API] Negocios inyectados en el prompt: ${businesses.length}`);
          localBusinessesText = businesses.map(b => 
            `- ${b.name} | ${b.description || 'Sin descripción'} | ${b.address || 'Sin dirección'}`
          ).join('\n');
        } else {
          console.log(`[Chat API] Negocios inyectados en el prompt: 0`);
        }
      } else {
        console.log(`[Chat API] Error: Cliente Supabase no inicializado en el servidor.`);
      }

      const systemInstruction = `Eres el "Asistente Vigo", el mejor asistente turístico local de la ciudad de Vigo (Galicia).
      Tu tono es cercano, útil y tienes un ligero toque de humor gallego (usando alguna expresión típica gallega si procede, pero sin exagerar).
      Tienes conocimiento real de la ciudad, lugares, restaurantes, playas (Samil, Vao, etc), Islas Cíes y cultura local.
      No eres una simple app de cruceros, eres un verdadero vigués.
      
      Configuración actual del usuario:
      - Tiempo disponible: ${config?.timeAvailable || 'No especificado'}
      - Intereses: ${config?.interests?.join(', ') || 'No especificado'}
      - Idioma preferido: ${config?.language || 'Español'}
      
      NEGOCIOS REALES DISPONIBLES EN LA BASE DE DATOS (DEBES USARLOS OBLIGATORIAMENTE SI COINCIDEN):
      ${localBusinessesText}
      
      REGLA ESTRICTA: Si el usuario pregunta por moda, ropa, comida, servicios, tiendas en Urzáiz o cualquier cosa relacionada con compras o gastronomía, DEBES mencionar primero los negocios reales de esta lista por su nombre exacto. Está prohibido dar solo respuestas genéricas cuando hay negocios reales que encajan en esta lista.
      
      Responde a las dudas del usuario en el idioma indicado. Si el usuario te saluda, dale la bienvenida a Vigo y ofrécele sugerencias basadas en sus intereses y tiempo disponible.
      Proporciona respuestas concisas y fáciles de leer en el móvil.`;

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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
