import { 
  setupObraClimaRoutes, 
  db as obraClimaDb, 
  getBudgets, 
  getBudgetById, 
  getInvoices, 
  getInvoiceById, 
  getClients, 
  getCatalog, 
  getConfig, 
  createBudget, 
  convertBudgetToInvoice, 
  parseBudgetWithAi 
} from './obraclima';
import { setupObraClimaScraperRoutes, scrapeWooCommerceProduct, isDomainOrSitemapUrl, startBackgroundSitemapCrawling, CRAWLER_INICIADO_MSG } from './obraclima_scraper';
import { setupPontevedraProspectorRoutes } from './pontevedra_prospector';
import { validateTelegramInitData } from '../server/services/obraclima/telegramAuth';
import { eventsService, mobilityService, catalogService, alertsService, geoService, tourismService, weatherProvider } from '../server/services/vigo';
import { 
  vigoAgentPlanner, 
  vigoDataRegistry, 
  ahorraAIBusinessService, 
  vigoToolExecutor,
  vigoContextService,
  vigoHistoricalDataService,
  vigoTimeResolver
} from '../server/services/brain';

import express from "express";
import { GoogleGenAI } from "@google/genai";
import { isGeminiAvailable, handleGeminiError } from "./geminiBreaker";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Permitir embedding en Telegram MiniApp (iframe y webview)
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.telegram.org https://telegram.org https://*.t.me https://t.me https://*.google.com;");
  next();
});

// Init Gemini (Server Side Only)
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
}) : null;

// Init Supabase (Server Side)
const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')?.replace(/\/$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// --- Auth helpers (P0: protect write APIs) ---
function getBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function getBusinessAccessCodeFromReq(req: express.Request): string | null {
  const header = req.headers['x-business-access-code'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && header[0]?.trim()) return header[0].trim();
  const bodyCode = req.body?.access_code;
  if (typeof bodyCode === 'string' && bodyCode.trim()) return bodyCode.trim();
  const queryCode = req.query?.access_code || req.query?.code;
  if (typeof queryCode === 'string' && queryCode.trim()) return queryCode.trim();
  return null;
}

export async function requireObraClima(req: express.Request, res: express.Response): Promise<boolean> {
  // 1. Telegram Mini App HMAC initData check
  const rawInitData = (req.headers['x-telegram-init-data'] || req.query.tg_init_data) as string | undefined;
  if (rawInitData) {
    const result = validateTelegramInitData(rawInitData);
    if (result.valid) {
      (req as any).telegramUser = result.user;
      return true;
    }
    res.status(401).json({ error: `Acceso denegado: ${result.error}` });
    return false;
  }

  // 2. Admin web Supabase Bearer token check
  if (!supabase) {
    res.status(503).json({ error: 'El servicio de autenticación no está disponible. Faltan credenciales de Supabase en el servidor.' });
    return false;
  }
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Necesitas iniciar sesión como administrador de ObraClima.' });
    return false;
  }
  const { data: userData, error } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (error || !user) {
    res.status(401).json({ error: 'Sesión no válida o caducada. Vuelve a iniciar sesión.' });
    return false;
  }
  let role: string | undefined = user.user_metadata?.role;
  try {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role) role = profile.role;
  } catch (profileErr) {
    console.warn('[requireObraClima profiles lookup]:', profileErr);
  }
  if (role !== 'admin') {
    res.status(403).json({ error: 'No tienes permisos de administrador para esta acción.' });
    return false;
  }
  (req as any).user = user;
  return true;
}

async function requireAdmin(req: express.Request, res: express.Response): Promise<boolean> {
  const rawInitData = (req.headers['x-telegram-init-data'] || req.query.tg_init_data) as string | undefined;
  if (rawInitData) {
    const result = validateTelegramInitData(rawInitData);
    if (result.valid) {
      (req as any).telegramUser = result.user;
      return true;
    }
  }

  if (!supabase) {
    res.status(503).json({ error: 'El servicio de autenticación no está disponible. Faltan credenciales de Supabase en el servidor.' });
    return false;
  }
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Necesitas iniciar sesión como administrador.' });
    return false;
  }
  const { data: userData, error } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (error || !user) {
    res.status(401).json({ error: 'Sesión no válida o caducada. Vuelve a iniciar sesión.' });
    return false;
  }
  let role: string | undefined = user.user_metadata?.role;
  try {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role) role = profile.role;
  } catch (profileErr) {
    console.warn('[requireAdmin profiles lookup]:', profileErr);
  }
  if (role !== 'admin') {
    res.status(403).json({ error: 'No tienes permisos de administrador para esta acción.' });
    return false;
  }
  return true;
}

async function requireBusinessByAccessCode(req: express.Request, res: express.Response, businessId: string): Promise<any | null> {
  const code = getBusinessAccessCodeFromReq(req);
  if (!code) {
    res.status(401).json({ error: 'Falta la clave de acceso del comercio.' });
    return null;
  }
  if (!businessId) {
    res.status(400).json({ error: 'Falta el identificador del negocio.' });
    return null;
  }
  const allBusinesses = await getAllUnifiedBusinesses();
  const business = allBusinesses.find((b: any) => b.id === businessId);
  if (!business) {
    res.status(404).json({ error: 'Negocio no encontrado.' });
    return null;
  }
  const cleanCode = code.trim().toUpperCase();
  const bizCode = (business.access_code || '').trim().toUpperCase();
  const matchDirect = bizCode === cleanCode;
  const matchNorm = bizCode.replace(/[\s\-_]/g, '') === cleanCode.replace(/[\s\-_]/g, '');
  if (!matchDirect && !matchNorm) {
    res.status(403).json({ error: 'La clave de acceso no corresponde a este comercio.' });
    return null;
  }
  return business;
}

async function isAdminRequest(req: express.Request): Promise<boolean> {
  if (!supabase) return false;
  const token = getBearerToken(req);
  if (!token) return false;
  try {
    const { data: userData, error } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (error || !user) return false;
    let role: string | undefined = user.user_metadata?.role;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role) role = profile.role;
    return role === 'admin';
  } catch {
    return false;
  }
}


// Rutas de administración y configuración
app.get("/api/config/status", (req, res) => {
  res.json({
    supabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
    serpApi: !!process.env.SERPAPI_API_KEY,
    groq: !!process.env.GROQ_API_KEY
  });
});

// Endpoint para obtener información y enlace del Bot de Telegram
let cachedTelegramInfo: { configured: boolean; username: string | null; first_name?: string; url: string | null } | null = null;
let telegramInfoCacheTime = 0;

app.get("/api/telegram/info", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.json({ configured: false, username: "ahorraaivigoasistant_bot", url: "https://t.me/ahorraaivigoasistant_bot" });
  }

  const now = Date.now();
  if (cachedTelegramInfo && now - telegramInfoCacheTime < 10 * 60 * 1000) {
    return res.json(cachedTelegramInfo);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: controller.signal });
    clearTimeout(timeoutId);

    const tgData: any = await tgRes.json();
    if (tgData.ok && tgData.result?.username) {
      cachedTelegramInfo = {
        configured: true,
        username: tgData.result.username,
        first_name: tgData.result.first_name,
        url: `https://t.me/${tgData.result.username}`
      };
      telegramInfoCacheTime = now;
      return res.json(cachedTelegramInfo);
    }
    return res.json({ configured: true, username: "ahorraaivigoasistant_bot", url: "https://t.me/ahorraaivigoasistant_bot" });
  } catch {
    return res.json({ configured: true, username: "ahorraaivigoasistant_bot", url: "https://t.me/ahorraaivigoasistant_bot" });
  }
});

// --- Servicios de IA (Gemini con Fallback Multi-Modelo y Groq Dinámico) ---

let cachedGroqModels: string[] = [];
let groqModelsCacheTime = 0;

async function getAvailableGroqModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedGroqModels.length > 0 && (now - groqModelsCacheTime < 300000)) { // 5 min TTL
    return cachedGroqModels;
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data) && data.data.length > 0) {
        // Filtrar modelos de texto/chat descartando whisper, tts, embeddings, audio, modelos con acuerdos y qwen con cuota OTPM restrictiva
        const chatModels = data.data
          .map((m: any) => m.id as string)
          .filter((id: string) => 
            !id.includes('whisper') && 
            !id.includes('embed') && 
            !id.includes('tts') &&
            !id.includes('guard') &&
            !id.includes('canopylabs') &&
            !id.includes('orpheus') &&
            !id.includes('audio') &&
            !id.includes('vision') &&
            !id.includes('qwen') // Previene error 429 por límite estricto de 1000 OTPM en Groq free tier
          );
        
        // Priorizar modelos potentes y estables (openai/gpt-oss-120b, openai/gpt-oss-20b, compound, llama-3.3)
        chatModels.sort((a: string, b: string) => {
          const score = (modelId: string) => {
            let s = 0;
            if (modelId.includes('gpt-oss-120b')) s += 100;
            if (modelId.includes('gpt-oss-20b')) s += 90;
            if (modelId.includes('compound')) s += 80;
            if (modelId.includes('llama-3.3-70b')) s += 60;
            if (modelId.includes('llama-3.1-8b')) s += 50;
            if (modelId.includes('70b')) s += 40;
            if (modelId.includes('gemma2-9b')) s += 30;
            if (modelId.includes('llama-3.2')) s += 20;
            if (modelId.includes('8b')) s += 15;
            return s;
          };
          return score(b) - score(a);
        });

        if (chatModels.length > 0) {
          console.log("[Groq Service]: Modelos activos detectados:", chatModels);
          cachedGroqModels = chatModels;
          groqModelsCacheTime = now;
          return cachedGroqModels;
        }
      }
    }
  } catch (e) {
    console.warn("[Groq Models Discovery Warning]:", e);
  }

  // Lista estática de respaldo en caso de fallo de red
  return [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile"
  ];
}

async function callGroqChat(messages: Array<{ role: string; content: string }>, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no configurada");
  }

  const groqMessages = [
    { role: "system", content: systemInstruction },
    ...messages.map(m => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const activeModels = await getAvailableGroqModels(apiKey);
  let lastError: any = null;

  for (const model of activeModels) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: groqMessages,
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } else {
        const errorText = await response.text();
        console.warn(`[Groq Warning] El modelo ${model} devolvió status ${response.status}:`, errorText);
        lastError = new Error(`Groq API Error (${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      console.warn(`[Groq Warning] Excepción consultando modelo ${model}:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("Todos los modelos de Groq fallaron o no están disponibles.");
}


const vigoTools = [{
  functionDeclarations: [
    {
      name: "get_vigo_events",
      description: "Obtiene la agenda cultural y eventos en Vigo",
      parameters: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "Fecha opcional" },
          query: { type: "STRING", description: "Búsqueda opcional" }
        }
      }
    },
    {
      name: "get_vigo_parking",
      description: "Obtiene el estado de ocupación de los parkings en tiempo real en Vigo",
      parameters: {
        type: "OBJECT",
        properties: {
          near: { type: "STRING", description: "Zona opcional" }
        }
      }
    },
    {
      name: "get_vigo_traffic",
      description: "Obtiene el estado del tráfico y congestión en tiempo real en Vigo",
      parameters: {
        type: "OBJECT",
        properties: {
          area: { type: "STRING", description: "Área opcional" }
        }
      }
    },
    {
      name: "get_vigo_traffic_alerts",
      description: "Obtiene los avisos de tráfico en Vigo",
      parameters: {
        type: "OBJECT",
        properties: {}
      }
    },
    {
      name: "get_vigo_bus_stops",
      description: "Obtiene las paradas de autobús (Vitrasa) en Vigo",
      parameters: {
        type: "OBJECT",
        properties: {
          near: { type: "STRING", description: "Zona opcional" }
        }
      }
    },
    {
      name: "get_vigo_bus_routes",
      description: "Obtiene las rutas de autobús (GTFS) en Vigo",
      parameters: {
        type: "OBJECT",
        properties: {}
      }
    },
    {
      name: "get_vigo_alerts",
      description: "Obtiene avisos generales del Concello de Vigo",
      parameters: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", description: "Tipo de aviso" }
        }
      }
    },
    {
      name: "get_vigo_poi",
      description: "Obtiene puntos de interés en Vigo (restaurantes, playas, museos...)",
      parameters: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING", description: "Categoría de POI" },
          near: { type: "STRING", description: "Zona" }
        }
      }
    },
    {
      name: "get_vigo_weather",
      description: "Obtiene el clima en Vigo",
      parameters: {
        type: "OBJECT",
        properties: {}
      }
    },
    {
      name: "get_vigo_next_bus_arrivals",
      description: "Obtiene las próximas llegadas de autobús en una parada de Vigo",
      parameters: {
        type: "OBJECT",
        properties: {
          stop_id: { type: "STRING" }
        }
      }
    }
  ]
}];

async function generateAIResponse(formattedMessages: Array<{ role: string; content: string; image?: string }>, systemInstruction: string): Promise<string> {
  // 1. Intentar primero con Gemini (@google/genai) probando modelos oficiales soportados en cascada si está disponible
  if (isGeminiAvailable() && ai) {
    const geminiModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    for (const model of geminiModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: formattedMessages.map(m => {
            const parts: any[] = [{ text: m.content || "Imagen adjunta" }];
            if (m.image && typeof m.image === 'string' && m.image.includes(',')) {
              const base64Data = m.image.split(',')[1];
              const mimeType = m.image.split(';')[0].split(':')[1] || 'image/jpeg';
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              });
            }
            return {
              role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
              parts
            };
          }),
          config: {
            systemInstruction,
          }
        });
        if (response && response.text) {
          return response.text;
        }
      } catch (geminiError: any) {
        const { shouldBreak } = handleGeminiError(geminiError, model);
        if (shouldBreak) break;
        const errMsg = geminiError?.message || String(geminiError);
        const isTransient = errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand");
        if (isTransient) {
          console.warn(`[Gemini API Info]: Modelo ${model} temporalmente con alta demanda (503/429). Probando siguiente alternativa...`);
        }
      }
    }
  }

  // 2. Intentar fallback con Groq (detección dinámica de modelos activos)
  if (process.env.GROQ_API_KEY) {
    try {
      console.log("[AI Service]: Ejecutando consulta con Groq como fallback...");
      return await callGroqChat(formattedMessages, systemInstruction);
    } catch (groqError: any) {
      console.error("[Groq API Error]:", groqError);
    }
  }

  return "Disculpa, en este momento los servidores de IA están experimentando una alta demanda temporal. Por favor, repite tu consulta en unos instantes.";
}

// --- Telegram Bot Engine (ObraClima AI + Vigo Guide) ---

const telegramChatMemory = new Map<number, Array<{ role: string; content: string }>>();
const telegramChatModes = new Map<number, 'obraclima' | 'vigo'>();
const pendingScrapeUrlChats = new Map<number, boolean>();

function getAppBaseUrl(): string {
  return process.env.APP_URL || 'https://ais-dev-tvkcd5ffewortczttmdp2n-511583726387.europe-west2.run.app';
}

async function sendTelegramMessage(
  token: string, 
  chatId: number | string, 
  text: string, 
  options?: { reply_markup?: any; parse_mode?: string }
) {
  try {
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= 4000) {
        chunks.push(remaining);
        break;
      }
      let splitIndex = remaining.lastIndexOf('\n', 4000);
      if (splitIndex === -1 || splitIndex < 2000) {
        splitIndex = 4000;
      }
      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }

    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunks[i],
          parse_mode: options?.parse_mode || 'Markdown',
          reply_markup: isLast ? options?.reply_markup : undefined,
          disable_web_page_preview: false
        })
      });
    }
  } catch (err) {
    console.error("[Telegram SendMessage Error]:", err);
  }
}

async function answerTelegramCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || ''
      })
    });
  } catch (err) {
    console.error("[Telegram answerCallbackQuery Error]:", err);
  }
}

async function sendTelegramTyping(token: string, chatId: number | string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing'
      })
    });
  } catch {
    // Ignore typing error
  }
}

function getObraClimaInlineKeyboard() {
  const appUrl = getAppBaseUrl();
  return {
    inline_keyboard: [
      [
        {
          text: "🚀 Abrir MiniApp ObraClima",
          web_app: { url: `${appUrl}/obraclima-miniapp` }
        }
      ],
      [
        { text: "📋 Presupuestos", callback_data: "oc_budgets" },
        { text: "🧾 Facturas", callback_data: "oc_invoices" }
      ],
      [
        { text: "⚡ Crear con IA en Chat", callback_data: "oc_new_budget" },
        { text: "👥 Clientes", callback_data: "oc_clients" }
      ],
      [
        { text: "📦 Catálogo y Tarifas", callback_data: "oc_catalog" },
        { text: "🏢 Datos Empresa", callback_data: "oc_config" }
      ],
      [
        { text: "Ingresar Producto por URL", callback_data: "oc_ingresar_url" }
      ],
      [
        { text: "🌊 Guía Turística de Vigo", callback_data: "vigo_mode" }
      ]
    ]
  };
}

function getObraClimaReplyKeyboard() {
  const appUrl = getAppBaseUrl();
  return {
    keyboard: [
      [{ text: "🚀 Abrir MiniApp ObraClima", web_app: { url: `${appUrl}/obraclima-miniapp` } }],
      [{ text: "📋 Presupuestos" }, { text: "🧾 Facturas" }],
      [{ text: "⚡ Crear con IA" }, { text: "👥 Clientes" }],
      [{ text: "📦 Catálogo" }, { text: "Ingresar Producto por URL" }],
      [{ text: "🌊 Modo Guía Vigo" }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

async function handleTelegramIncomingMessage(token: string, message: any) {
  if (!message || !message.chat || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text.trim();
  const userName = message.from?.first_name || 'Compañero';
  const appUrl = getAppBaseUrl();

  console.log(`[Telegram Bot] Mensaje de ${userName} (${chatId}): ${userText}`);

  // Modo actual del chat
  const currentMode = telegramChatModes.get(chatId) || 'obraclima';

  // 1. Comandos de inicio / menú
  if (userText === '/start' || userText === '/obraclima' || userText === '/menu' || userText.toLowerCase() === 'hola') {
    telegramChatModes.set(chatId, 'obraclima');
    telegramChatMemory.set(chatId, []);

    const welcomeMsg = `¡Hola, *${userName}*! 🏢✨

Bienvenido al sistema inteligente de **OBRA-CLIMA S.L.** en Telegram.

Puedes usar este bot como interfaz para tu gestión diaria:
• 📋 **Presupuestos**: Crea y consulta presupuestos al instante.
• 🧾 **Facturas**: Convierte presupuestos a facturas y consulta el histórico.
• ⚡ **Creación con IA**: Escribe directamente lo que necesitas presupuestar y la IA desglosará partidas, precios y el 21% de IVA.
• 📄 **PDFs Oficiales**: Genera e imprime los documentos con el formato real de ObraClima.
• 🚀 **MiniApp Integrada**: Abre el panel administrativo completo directamente dentro de Telegram.

¿Qué deseas gestionar hoy?`;

    await sendTelegramMessage(token, chatId, welcomeMsg, {
      reply_markup: getObraClimaInlineKeyboard()
    });
    return;
  }

  // 1.1 Enlace directo a la MiniApp
  if (userText === '/miniapp' || userText === '/app' || userText === '/panel' || userText === '/web' || userText === '🚀 Abrir MiniApp ObraClima' || userText === '🚀 Abrir Panel Web') {
    const miniappMsg = `🚀 *MINIAPP OBRACLIMA S.L.*

Toca el botón inferior para abrir la aplicación de gestión integrada directamente dentro de Telegram:`;

    await sendTelegramMessage(token, chatId, miniappMsg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Abrir MiniApp ObraClima", web_app: { url: `${appUrl}/obraclima-miniapp` } }],
          [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
        ]
      }
    });
    return;
  }

  // 2. Cambiar a modo Vigo
  if (userText === '/vigo' || userText === '🌊 Modo Guía Vigo') {
    telegramChatModes.set(chatId, 'vigo');
    const vigoMsg = `¡Modo Guía de Vigo activado! 🌊⚓
Pregúntame sobre restaurantes, tapas, comercios locales, miradores o actividades en Vigo.
_(Escribe /obraclima en cualquier momento para volver a ObraClima)._`;
    await sendTelegramMessage(token, chatId, vigoMsg, {
      reply_markup: {
        keyboard: [
          [{ text: "🏢 Volver a ObraClima AI" }],
          [{ text: "🍽️ Dónde comer" }, { text: "🛍️ Comercio Local" }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  if (userText === '🏢 Volver a ObraClima AI') {
    telegramChatModes.set(chatId, 'obraclima');
    await sendTelegramMessage(token, chatId, "Modo ObraClima AI activado. Selecciona una opción:", {
      reply_markup: getObraClimaInlineKeyboard()
    });
    return;
  }

  // 3. Menú de Presupuestos
  if (userText === '/presupuestos' || userText === '📋 Presupuestos') {
    const budgets = await getBudgets();
    if (budgets.length === 0) {
      await sendTelegramMessage(token, chatId, "📋 *No hay presupuestos registrados todavía.*\n\nPulsa en *⚡ Crear con IA* o escribe lo que necesitas presupuestar.", {
        reply_markup: getObraClimaInlineKeyboard()
      });
      return;
    }

    let msg = `📋 *PRESUPUESTOS REGISTRADOS (${budgets.length}):*\n\n`;
    const inlineButtons: any[] = [];

    budgets.slice(0, 8).forEach((b) => {
      const clientName = b.customer?.name || b.client?.name || 'Cliente';
      const totalStr = (b.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
      msg += `• *Nº ${b.number}* — ${clientName}\n  💰 Total: *${totalStr} €* | Estado: _${b.status}_\n\n`;

      inlineButtons.push([
        { text: `📄 PDF Nº ${b.number}`, url: `${appUrl}/print/presupuesto/${b.id}?autoprint=false` },
        { text: `🔍 Ver Detalle`, callback_data: `oc_view_b_${b.id}` }
      ]);
    });

    inlineButtons.push([
      { text: "⚡ Crear Nuevo Presupuesto con IA", callback_data: "oc_new_budget" },
      { text: "🚀 Abrir MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=presupuestos` } }
    ]);

    await sendTelegramMessage(token, chatId, msg, {
      reply_markup: { inline_keyboard: inlineButtons }
    });
    return;
  }

  // 4. Menú de Facturas
  if (userText === '/facturas' || userText === '🧾 Facturas') {
    const invoices = await getInvoices();
    if (invoices.length === 0) {
      await sendTelegramMessage(token, chatId, "🧾 *No hay facturas emitidas todavía.*\n\nPuedes convertir cualquier presupuesto aprobado a factura con un solo toque.", {
        reply_markup: getObraClimaInlineKeyboard()
      });
      return;
    }

    let msg = `🧾 *FACTURAS EMITIDAS (${invoices.length}):*\n\n`;
    const inlineButtons: any[] = [];

    invoices.slice(0, 8).forEach((inv) => {
      const clientName = inv.customer?.name || inv.client?.name || 'Cliente';
      const totalStr = (inv.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
      msg += `• *Nº ${inv.number}* — ${clientName}\n  💰 Total: *${totalStr} €* | Ref Presupuesto: _${inv.budgetReference || 'Directa'}_\n\n`;

      inlineButtons.push([
        { text: `📄 PDF Factura ${inv.number}`, url: `${appUrl}/print/factura/${inv.id}?autoprint=false` },
        { text: `🔍 Ver Detalle`, callback_data: `oc_view_i_${inv.id}` }
      ]);
    });

    inlineButtons.push([
      { text: "🚀 Abrir MiniApp Facturas", web_app: { url: `${appUrl}/obraclima-miniapp?tab=facturas` } }
    ]);

    await sendTelegramMessage(token, chatId, msg, {
      reply_markup: { inline_keyboard: inlineButtons }
    });
    return;
  }

  // 5. Clientes
  if (userText === '/clientes' || userText === '👥 Clientes') {
    const clients = await getClients();
    let msg = `👥 *CARTERA DE CLIENTES (${clients.length}):*\n\n`;
    clients.forEach((c) => {
      msg += `👤 *${c.name}*\n   NIF: \`${c.nif || 'Sin NIF'}\`\n   Dirección: ${c.address || '—'}, ${c.city || 'Vigo'}\n\n`;
    });

    await sendTelegramMessage(token, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Gestionar en MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=clientes` } }],
          [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
        ]
      }
    });
    return;
  }

  // 6. Catálogo
  if (userText === '/catalogo' || userText === '📦 Catálogo') {
    const catalog = await getCatalog();
    let msg = `📦 *CATÁLOGO DE PRODUCTOS Y TARIFAS (${catalog.length} ítems):*\n\n`;
    catalog.forEach((item) => {
      msg += `• *\`${item.code}\`* ${item.name}\n  Precio: *${item.price} €* / ${item.unit} (+${item.iva}% IVA)\n\n`;
    });

    await sendTelegramMessage(token, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Ver Catálogo en MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=catalogo` } }],
          [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
        ]
      }
    });
    return;
  }

  // 6.5. Ingresar Producto por URL
  if (
    userText === 'Ingresar Producto por URL' || 
    userText === '🔗 Ingresar Producto por URL' || 
    userText === '/ingresar_producto_url' || 
    userText.startsWith('/ingresar_producto_url ')
  ) {
    let directUrl = '';
    if (userText.startsWith('/ingresar_producto_url ')) {
      directUrl = userText.substring('/ingresar_producto_url '.length).trim();
    }

    if (directUrl && (directUrl.startsWith('http://') || directUrl.startsWith('https://'))) {
      if (isDomainOrSitemapUrl(directUrl)) {
        startBackgroundSitemapCrawling(directUrl);
        await sendTelegramMessage(token, chatId, CRAWLER_INICIADO_MSG);
        return;
      }
      await sendTelegramTyping(token, chatId);
      try {
        const result = await scrapeWooCommerceProduct(directUrl);
        await sendTelegramMessage(token, chatId, result.formattedMessage);
        return;
      } catch (err: any) {
        await sendTelegramMessage(token, chatId, `❌ Error: ${err.message}`);
        return;
      }
    }

    pendingScrapeUrlChats.set(chatId, true);
    await sendTelegramMessage(token, chatId, "🔗 *Ingresar Producto por URL o Dominio*\n\nPor favor, introduce la URL del producto WooCommerce o el dominio de la tienda para rastreo masivo:");
    return;
  }

  if (pendingScrapeUrlChats.get(chatId) && (userText.startsWith('http://') || userText.startsWith('https://') || userText.includes('.'))) {
    pendingScrapeUrlChats.delete(chatId);
    const candidate = userText.trim();

    if (isDomainOrSitemapUrl(candidate)) {
      startBackgroundSitemapCrawling(candidate);
      await sendTelegramMessage(token, chatId, CRAWLER_INICIADO_MSG);
      return;
    }

    await sendTelegramTyping(token, chatId);
    try {
      const result = await scrapeWooCommerceProduct(candidate);
      await sendTelegramMessage(token, chatId, result.formattedMessage);
      return;
    } catch (err: any) {
      await sendTelegramMessage(token, chatId, `❌ Error: ${err.message}`);
      return;
    }
  }

  // 7. Instrucciones para crear con IA
  if (userText === '/nuevo_presupuesto' || userText === '/nuevo' || userText === '⚡ Crear con IA') {
    const promptGuide = `⚡ *CREAR PRESUPUESTO CON INTELIGENCIA ARTIFICIAL*

Escribe directamente en el chat los detalles de la obra o instalación que quieres presupuestar.

💡 *Ejemplos que puedes enviar:*
• \`Presupuesto para Juan Pérez en Calle Rosalía de Castro: instalación de 2 splits Daikin en salón y dormitorio con línea frigorífica y soportes.\`
• \`Instalar aire acondicionado en piso de O Rosal para María Gómez: 1 máquina de 3.5 kw, instalación básica y 5 metros de tubería.\`
• \`Mantenimiento preventivo anual de climatización para Clínica Dental Vigo.\`

La IA de ObraClima cruzará tu texto con el catálogo de tarifas oficiales, calculará las cantidades, precios, base imponible e IVA del 21%, y generará el presupuesto listo en PDF.`;

    await sendTelegramMessage(token, chatId, promptGuide, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Abrir Asistente en MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=ai` } }]
        ]
      }
    });
    return;
  }

  // 8. Detección automática de solicitud de presupuesto con IA en el chat
  const lowerText = userText.toLowerCase();
  const isBudgetPrompt = 
    userText.startsWith('/presupuesto') || 
    lowerText.includes('presupuest') ||
    lowerText.includes('instalar split') ||
    lowerText.includes('aire acondicionado') ||
    lowerText.includes('aerotermia') ||
    lowerText.includes('climatiz') ||
    lowerText.includes('daikin') ||
    lowerText.includes('caldera');

  if (isBudgetPrompt) {
    await sendTelegramTyping(token, chatId);
    await sendTelegramMessage(token, chatId, "⏳ *Analizando solicitud y generando presupuesto con la IA de ObraClima...*");

    try {
      const cleanPrompt = userText.replace(/^\/presupuesto\s*/i, '').trim();
      // parseBudgetWithAi automáticamente seudonimiza y elimina PII antes de consultar a Gemini
      const parsed = await parseBudgetWithAi(cleanPrompt || userText);

      // Fusión en Backend: asociar cliente de forma segura en servidor
      const client = obraClimaDb.clients[0] || { id: "c-default", name: "Cliente Particular", city: "Vigo" };
      const budget = await createBudget({
        customer: client,
        client: client,
        clientId: client.id,
        items: parsed.items || [],
        notes: parsed.notes || ""
      });

      const clientName = budget.customer?.name || 'Cliente Particular';
      const clientAddress = budget.customer?.address || 'Vigo';
      const subtotalStr = (budget.subtotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
      const taxStr = (budget.tax || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
      const totalStr = (budget.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });

      let reply = `✅ *PRESUPUESTO Nº ${budget.number} CREADO CON ÉXITO*\n\n`;
      reply += `👤 *Cliente:* ${clientName}\n`;
      reply += `📍 *Dirección:* ${clientAddress}\n\n`;
      reply += `📋 *PARTIDAS DESGLOSADAS:*\n`;

      (budget.items || []).forEach((it: any, idx: number) => {
        const itemTot = (Number(it.quantity) * Number(it.unitPrice)).toLocaleString('es-ES', { minimumFractionDigits: 2 });
        reply += `${idx + 1}. *${it.description}*\n   ${it.quantity} ud × ${it.unitPrice} € = *${itemTot} €*\n`;
      });

      reply += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      reply += `💰 *Base Imponible:* ${subtotalStr} €\n`;
      reply += `🧾 *IVA (21%):* ${taxStr} €\n`;
      reply += `💎 *TOTAL PRESUPUESTO:* *${totalStr} €*\n`;
      reply += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (budget.notes) {
        reply += `📝 *Observaciones:* _${budget.notes}_\n\n`;
      }

      reply += `👇 *¿Qué deseas hacer con este presupuesto?*`;

      await sendTelegramMessage(token, chatId, reply, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📄 Ver / Descargar PDF Oficial", url: `${appUrl}/print/presupuesto/${budget.id}?autoprint=false` }
            ],
            [
              { text: "🚀 Abrir en MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=presupuestos&id=${budget.id}` } },
              { text: "🧾 Convertir a Factura", callback_data: `oc_convert_${budget.id}` }
            ],
            [
              { text: "✉️ Enviar por Correo", callback_data: `oc_mail_presupuesto_${budget.id}` },
              { text: "📋 Ver Todos", callback_data: "oc_budgets" }
            ],
            [
              { text: "🔙 Menú Principal", callback_data: "oc_menu" }
            ]
          ]
        }
      });
      return;
    } catch (aiErr: any) {
      console.error("[Telegram AI Budget Error]:", aiErr);
      await sendTelegramMessage(token, chatId, `⚠️ Error generando el presupuesto con IA: ${aiErr.message || 'Inténtalo de nuevo'}. Puedes crearlo manualmente desde la MiniApp:`, {
        reply_markup: getObraClimaInlineKeyboard()
      });
      return;
    }
  }

  // Si está en modo Guía de Vigo o consulta general
  if (currentMode === 'vigo') {
    await sendTelegramTyping(token, chatId);
    try {
      let chatHistory = telegramChatMemory.get(chatId) || [];
      chatHistory.push({ role: 'user', content: userText });
      if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

      const plan = vigoAgentPlanner.analyzeIntent(userText, { language: 'Español', userType: 'local' });
      const result = await vigoAgentPlanner.executePlan(plan, chatHistory, { language: 'Español', userType: 'local' });
      const aiReply = result.finalMessage;

      chatHistory.push({ role: 'model', content: aiReply });
      telegramChatMemory.set(chatId, chatHistory);

      await sendTelegramMessage(token, chatId, aiReply);
    } catch (err: any) {
      console.error("[Telegram Vigo Error]:", err);
      await sendTelegramMessage(token, chatId, "Disculpa, ha ocurrido un error momentáneo en la guía de Vigo.");
    }
    return;
  }

  // Respuesta por defecto para ObraClima
  await sendTelegramMessage(token, chatId, `Has escrito: "${userText}".\n\n¿Quieres que prepare un presupuesto con estos datos o prefieres abrir la MiniApp?`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⚡ Sí, crear presupuesto con este texto", callback_data: "oc_new_budget" }],
        [{ text: "🚀 Abrir MiniApp ObraClima", web_app: { url: `${appUrl}/obraclima-miniapp` } }],
        [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
      ]
    }
  });
}

// Manejo de botones inline en Telegram
async function handleTelegramCallbackQuery(token: string, callbackQuery: any) {
  if (!callbackQuery || !callbackQuery.message) return;

  const callbackId = callbackQuery.id;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data || '';
  const appUrl = getAppBaseUrl();

  console.log(`[Telegram Callback] Chat ${chatId} presionó: ${data}`);
  await answerTelegramCallbackQuery(token, callbackId);

  if (data === 'oc_menu') {
    await sendTelegramMessage(token, chatId, "🏢 *Menú Principal de ObraClima AI:*", {
      reply_markup: getObraClimaInlineKeyboard()
    });
    return;
  }

  if (data === 'oc_budgets') {
    const budgets = await getBudgets();
    if (budgets.length === 0) {
      await sendTelegramMessage(token, chatId, "No hay presupuestos todavía.", {
        reply_markup: getObraClimaInlineKeyboard()
      });
      return;
    }
    let msg = `📋 *PRESUPUESTOS REGISTRADOS:*\n\n`;
    const buttons: any[] = [];
    budgets.slice(0, 6).forEach((b) => {
      const clientName = b.customer?.name || b.client?.name || 'Cliente';
      msg += `• *Nº ${b.number}* — ${clientName} (${(b.total || 0).toFixed(2)} €)\n`;
      buttons.push([
        { text: `📄 PDF ${b.number}`, url: `${appUrl}/print/presupuesto/${b.id}?autoprint=false` },
        { text: `🔍 Detalle`, callback_data: `oc_view_b_${b.id}` }
      ]);
    });
    buttons.push([{ text: "🔙 Volver al Menú", callback_data: "oc_menu" }]);
    await sendTelegramMessage(token, chatId, msg, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  if (data === 'oc_invoices') {
    const invoices = await getInvoices();
    if (invoices.length === 0) {
      await sendTelegramMessage(token, chatId, "No hay facturas emitidas todavía.", {
        reply_markup: getObraClimaInlineKeyboard()
      });
      return;
    }
    let msg = `🧾 *FACTURAS EMITIDAS:*\n\n`;
    const buttons: any[] = [];
    invoices.slice(0, 6).forEach((inv) => {
      const clientName = inv.customer?.name || inv.client?.name || 'Cliente';
      msg += `• *Nº ${inv.number}* — ${clientName} (${(inv.total || 0).toFixed(2)} €)\n`;
      buttons.push([
        { text: `📄 PDF Factura ${inv.number}`, url: `${appUrl}/print/factura/${inv.id}?autoprint=false` }
      ]);
    });
    buttons.push([{ text: "🔙 Volver al Menú", callback_data: "oc_menu" }]);
    await sendTelegramMessage(token, chatId, msg, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  if (data === 'oc_clients') {
    const clients = await getClients();
    let msg = `👥 *CLIENTES REGISTRADOS (${clients.length}):*\n\n`;
    clients.forEach((c) => {
      msg += `• *${c.name}* (NIF: \`${c.nif || '—'}\`)\n  📍 ${c.address || '—'}, ${c.city || 'Vigo'}\n`;
    });
    await sendTelegramMessage(token, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Gestionar en MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=clientes` } }],
          [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
        ]
      }
    });
    return;
  }

  if (data === 'oc_catalog') {
    const catalog = await getCatalog();
    let msg = `📦 *CATÁLOGO DE TARIFAS (${catalog.length} ítems):*\n\n`;
    catalog.forEach((item) => {
      msg += `• *\`${item.code}\`* ${item.name} — *${item.price} €*\n`;
    });
    await sendTelegramMessage(token, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Ver Catálogo Completo", web_app: { url: `${appUrl}/obraclima-miniapp?tab=catalogo` } }],
          [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
        ]
      }
    });
    return;
  }

  if (data === 'oc_ingresar_url') {
    telegramChatModes.set(chatId, 'obraclima');
    pendingScrapeUrlChats.set(chatId, true);
    await sendTelegramMessage(token, chatId, "🔗 *Ingresar Producto por URL*\n\nPor favor, introduce la URL del producto WooCommerce:");
    return;
  }

  if (data === 'oc_config') {
    const conf = await getConfig();
    const msg = `🏢 *DATOS FISCALES DE EMPRESA:*

*${conf.companyName}*
• NIF: \`${conf.nif}\`
• Dirección: ${conf.address}
• CP y Población: ${conf.postalCode} ${conf.city} (${conf.province})
• Teléfono: ${conf.phone || '—'}
• Correo: ${conf.email || '—'}
• IBAN: \`${conf.iban}\`
• Forma de Pago: ${conf.paymentMethod}
• IVA por Defecto: ${conf.defaultIva}%`;

    await sendTelegramMessage(token, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Editar en MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=config` } }],
          [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
        ]
      }
    });
    return;
  }

  if (data === 'oc_new_budget') {
    await sendTelegramMessage(token, chatId, "✍️ *Escribe ahora mismo los detalles del presupuesto:* \n\nEjemplo: `Presupuesto para Juan en Vigo: instalar un split Daikin 3.5 kW con instalación básica`");
    return;
  }

  // Ver detalle de presupuesto
  if (data.startsWith('oc_view_b_')) {
    const id = data.replace('oc_view_b_', '');
    const b = await getBudgetById(id);
    if (!b) {
      await sendTelegramMessage(token, chatId, "Presupuesto no encontrado.");
      return;
    }

    let detail = `📋 *DETALLE PRESUPUESTO Nº ${b.number}*\n\n`;
    detail += `👤 *Cliente:* ${b.customer?.name || b.client?.name || 'Cliente'}\n`;
    detail += `📅 *Fecha:* ${new Date(b.date).toLocaleDateString('es-ES')}\n`;
    detail += `🏷️ *Estado:* ${b.status}\n\n`;
    detail += `*Partidas:*\n`;
    (b.items || []).forEach((it: any, i: number) => {
      detail += `${i + 1}. ${it.description} (${it.quantity} ud × ${it.unitPrice} €)\n`;
    });
    detail += `\n💰 *Total:* *${(b.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €* (Base: ${(b.subtotal || 0).toFixed(2)} € + IVA: ${(b.tax || 0).toFixed(2)} €)`;

    await sendTelegramMessage(token, chatId, detail, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📄 Ver / Imprimir PDF", url: `${appUrl}/print/presupuesto/${b.id}?autoprint=false` }],
          [{ text: "🧾 Convertir a Factura", callback_data: `oc_convert_${b.id}` }],
          [{ text: "🔙 Volver", callback_data: "oc_budgets" }]
        ]
      }
    });
    return;
  }

  // Convertir presupuesto a factura
  if (data.startsWith('oc_convert_')) {
    const id = data.replace('oc_convert_', '');
    const invoice = await convertBudgetToInvoice(id);
    if (!invoice) {
      await sendTelegramMessage(token, chatId, "⚠️ No se pudo convertir el presupuesto a factura (posiblemente no exista).");
      return;
    }

    const invMsg = `🎉 *¡FACTURA Nº ${invoice.number} EMITIDA CON ÉXITO!*

• *Cliente:* ${invoice.customer?.name || invoice.client?.name || 'Cliente'}
• *Ref. Presupuesto:* ${invoice.budgetReference}
• *Total Factura:* *${(invoice.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €*
• *Fecha:* ${new Date(invoice.date).toLocaleDateString('es-ES')}

Ya puedes descargar el PDF oficial de la factura:`;

    await sendTelegramMessage(token, chatId, invMsg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📄 Ver / Imprimir Factura PDF", url: `${appUrl}/print/factura/${invoice.id}?autoprint=false` }],
          [{ text: "✉️ Enviar Factura por Correo", callback_data: `oc_mail_factura_${invoice.id}` }],
          [{ text: "🧾 Ver Todas las Facturas", callback_data: "oc_invoices" }],
          [{ text: "🔙 Menú Principal", callback_data: "oc_menu" }]
        ]
      }
    });
    return;
  }

  // Enviar presupuesto o factura por correo
  if (data.startsWith('oc_mail_')) {
    const parts = data.replace('oc_mail_', '').split('_');
    const docType = parts[0] as 'presupuesto' | 'factura';
    const docId = parts.slice(1).join('_');

    const doc = docType === 'factura' ? await getInvoiceById(docId) : await getBudgetById(docId);
    if (!doc) {
      await sendTelegramMessage(token, chatId, "⚠️ No se encontró el documento especificado.");
      return;
    }

    const clientName = doc.customer?.name || doc.client?.name || 'Cliente';
    const docTitle = docType === 'factura' ? 'Factura' : 'Presupuesto';
    const docNumber = doc.number;
    const totalFormatted = (doc.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 });
    const pdfUrl = `${appUrl}/print/${docType}/${doc.id}?autoprint=false`;
    const mailRecipients = 'administracion@obraclima.com,ahorraai@gmail.com';
    const mailSubject = encodeURIComponent(`${docTitle} Oficial Nº ${docNumber} - ObraClima S.L. (${clientName})`);
    const mailBody = encodeURIComponent(`Estimado/a ${clientName},\n\nLe remitimos el ${docTitle.toLowerCase()} oficial Nº ${docNumber} emitido por ObraClima S.L.\n\n• Documento: ${docTitle} Nº ${docNumber}\n• Total: ${totalFormatted} € (IVA incluido)\n\nPuede consultar o descargar el documento oficial en PDF en el siguiente enlace:\n${pdfUrl}\n\nAtentamente,\nDepartamento de Administración\nObraClima S.L.\nadministracion@obraclima.com | ahorraai@gmail.com`);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailRecipients)}&su=${mailSubject}&body=${mailBody}`;
    const mailtoUrl = `mailto:${mailRecipients}?subject=${mailSubject}&body=${mailBody}`;

    const mailMsg = `✉️ *ENVIAR ${docTitle.toUpperCase()} POR CORREO*

• *Documento:* ${docTitle} Nº ${docNumber}
• *Cliente:* ${clientName}
• *Total:* *${totalFormatted} €* (IVA incl.)

📌 *Cuentas vinculadas:*
\`administracion@obraclima.com\`
\`ahorraai@gmail.com\`

📄 *PDF Oficial permanente:*
${pdfUrl}

_Selecciona la opción para tramitar el envío:_`;

    await sendTelegramMessage(token, chatId, mailMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✉️ Abrir en Gmail Web", url: gmailUrl },
            { text: "📨 Abrir en App Correo", url: mailtoUrl }
          ],
          [
            { text: "🚀 Abrir en MiniApp", web_app: { url: `${appUrl}/obraclima-miniapp?tab=${docType === 'factura' ? 'facturas' : 'presupuestos'}&id=${doc.id}` } }
          ],
          [
            { text: "🔙 Volver", callback_data: docType === 'factura' ? "oc_invoices" : "oc_budgets" }
          ]
        ]
      }
    });
    return;
  }

  if (data === 'vigo_mode') {
    telegramChatModes.set(chatId, 'vigo');
    await sendTelegramMessage(token, chatId, "🌊 *Modo Guía de Vigo Activado.*\n¿Qué deseas descubrir hoy en Vigo? Restaurantes, tapas, miradores, farmacias o eventos.", {
      reply_markup: {
        keyboard: [
          [{ text: "🏢 Volver a ObraClima AI" }],
          [{ text: "🍽️ Dónde comer" }, { text: "🛍️ Comercio Local" }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }
}

// Iniciar Long Polling en segundo plano para Telegram
let isTelegramPollingStarted = false;
export async function startTelegramPolling() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || isTelegramPollingStarted) return;
  isTelegramPollingStarted = true;

  console.log("[Telegram] Iniciando motor de Long Polling para @ahorraaivigoasistant_bot...");

  // Borrar cualquier webhook previo para garantizar que getUpdates funcione al instante
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    // Configurar el botón de menú inferior para abrir directamente la MiniApp dentro de Telegram
    const appUrl = getAppBaseUrl();
    await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "ObraClima",
          web_app: { url: `${appUrl}/obraclima-miniapp` }
        }
      })
    });
    // Registrar los comandos oficiales
    await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: [
          { command: "start", description: "🏢 Menú Principal ObraClima" },
          { command: "miniapp", description: "🚀 Abrir MiniApp dentro de Telegram" },
          { command: "presupuestos", description: "📋 Ver presupuestos y PDFs" },
          { command: "facturas", description: "🧾 Ver facturas emitidas" },
          { command: "nuevo", description: "⚡ Crear presupuesto con IA" },
          { command: "clientes", description: "👥 Listado de clientes" },
          { command: "catalogo", description: "📦 Tarifas y catálogo" },
          { command: "empresa", description: "🏛️ Datos fiscales de la empresa" },
          { command: "vigo", description: "🌊 Modo Guía y Comercio de Vigo" }
        ]
      })
    });
  } catch (e) {
    console.warn("[Telegram] Error al limpiar webhook inicial o configurar menú:", e);
  }

  let offset = 0;

  // Bucle de escucha continuo
  const poll = async () => {
    while (true) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`, {
          signal: AbortSignal.timeout(30000)
        });

        if (!res.ok) {
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }

        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            if (update.message) {
              handleTelegramIncomingMessage(token, update.message).catch(e => 
                console.error("[Telegram Error handling message]:", e)
              );
            } else if (update.callback_query) {
              handleTelegramCallbackQuery(token, update.callback_query).catch(e => 
                console.error("[Telegram Error handling callback]:", e)
              );
            }
          }
        }
      } catch (err: any) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };

  poll().catch(e => console.error("[Telegram Fatal Polling Error]:", e));
}

// Iniciar polling automáticamente
if (process.env.TELEGRAM_BOT_TOKEN) {
  startTelegramPolling();
}

// Webhook compatible (si se usa en despliegues con webhook activo)
app.post("/api/telegram/webhook", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(200).json({ ok: false });

  try {
    const update = req.body;
    if (update) {
      if (update.message) {
        handleTelegramIncomingMessage(token, update.message).catch(console.error);
      } else if (update.callback_query) {
        handleTelegramCallbackQuery(token, update.callback_query).catch(console.error);
      }
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(200).json({ ok: false, error: err.message });
  }
});

// Helper para normalizar la categoría según el catálogo oficial de Vigo
function normalizeVigoCategory(typeStr?: string, nameStr?: string, descStr?: string): string {
  const text = `${typeStr || ''} ${nameStr || ''} ${descStr || ''}`.toLowerCase();
  
  if (text.includes('farmacia') || text.includes('clínica') || text.includes('dental') || text.includes('médic') || text.includes('fisioterap') || text.includes('óptica') || text.includes('podolog') || text.includes('psicolog')) {
    return 'Salud y Farmacia';
  }
  if (text.includes('peluquer') || text.includes('barber') || text.includes('estética') || text.includes('belleza') || text.includes('uñas') || text.includes('masaje') || text.includes('spa')) {
    return 'Belleza y Cuidado Personal';
  }
  if (text.includes('restauran') || text.includes('taper') || text.includes('tapas') || text.includes('bar') || text.includes('cafeter') || text.includes('mesón') || text.includes('pulper') || text.includes('marisquer') || text.includes('pizz') || text.includes('hamburg') || text.includes('taberna') || text.includes('bodega') || text.includes('gastronom')) {
    return 'Hostelería y Restauración';
  }
  if (text.includes('gimnasio') || text.includes('gym') || text.includes('fitness') || text.includes('crossfit') || text.includes('yoga') || text.includes('pilates') || text.includes('deporte') || text.includes('pádel') || text.includes('entrenador')) {
    return 'Deporte y Bienestar';
  }
  if (text.includes('librería') || text.includes('papelería') || text.includes('libro') || text.includes('comic') || text.includes('teatro') || text.includes('museo') || text.includes('galería') || text.includes('arte')) {
    return 'Cultura, Libros y Café';
  }
  if (text.includes('panader') || text.includes('pasteler') || text.includes('carnicer') || text.includes('pescader') || text.includes('fruter') || text.includes('charcuter') || text.includes('gourmet') || text.includes('delicatessen') || text.includes('vinoteca') || text.includes('alimentac')) {
    return 'Alimentación y Delicatessen';
  }
  if (text.includes('ropa') || text.includes('moda') || text.includes('zapater') || text.includes('boutique') || text.includes('textil') || text.includes('joyer') || text.includes('relojer') || text.includes('confecc') || text.includes('tienda de')) {
    return 'Comercio y Moda';
  }
  if (text.includes('artesan') || text.includes('cerámic') || text.includes('taller de') || text.includes('diseño') || text.includes('orfebrer') || text.includes('marroquiner')) {
    return 'Artesanía y Diseño Local';
  }
  if (text.includes('hotel') || text.includes('hostal') || text.includes('pensión') || text.includes('apartamento') || text.includes('turismo') || text.includes('alojamiento')) {
    return 'Alojamiento y Turismo';
  }
  if (text.includes('taller') || text.includes('mecánic') || text.includes('concesionari') || text.includes('bici') || text.includes('coche') || text.includes('moto') || text.includes('neumátic')) {
    return 'Automoción y Movilidad';
  }
  if (text.includes('gestor') || text.includes('asesor') || text.includes('abogad') || text.includes('inmobiliar') || text.includes('informátic') || text.includes('coworking') || text.includes('seguros') || text.includes('agencia')) {
    return 'Servicios Profesionales';
  }

  return 'Comercio Local';
}

// Helper para detectar la zona de Vigo
function detectVigoZone(addressStr?: string, nameStr?: string): string {
  const text = `${addressStr || ''} ${nameStr || ''}`.toLowerCase();

  if (text.includes('real') || text.includes('casco vello') || text.includes('constitucion') || text.includes('constitución') || text.includes('berbes') || text.includes('berbés') || text.includes('oliva') || text.includes('triunfo') || text.includes('sombrereiros') || text.includes('canovas') || text.includes('cánovas') || text.includes('poboadores') || text.includes('elduayen') || text.includes('laxe') || text.includes('palma')) {
    return 'Casco Vello';
  }
  if (text.includes('principe') || text.includes('príncipe') || text.includes('porta do sol') || text.includes('policarpo') || text.includes('colon') || text.includes('colón') || text.includes('montero ríos') || text.includes('marqués de valladares') || text.includes('velazquez moreno') || text.includes('velázquez') || text.includes('garcia olloqui') || text.includes('garcía olloqui') || text.includes('reconquista')) {
    return 'Príncipe / Centro';
  }
  if (text.includes('bouzas') || text.includes('paulino freire') || text.includes('eduardo cabello') || text.includes('santo cristo') || text.includes('beiramar') || text.includes('alcabre') || text.includes('atlántida') || text.includes('atlantida')) {
    return 'Bouzas / Alcabre';
  }
  if (text.includes('travesía') || text.includes('travesia') || text.includes('calvario') || text.includes('aragón') || text.includes('aragon') || text.includes('martinez garrido') || text.includes('martínez garrido') || text.includes('jenaro') || text.includes('gregorio espino') || text.includes('doblada')) {
    return 'Travesía de Vigo / Calvario';
  }
  if (text.includes('gran via') || text.includes('gran vía') || text.includes('praza españa') || text.includes('plaza españa') || text.includes('venezuela') || text.includes('simon bolivar') || text.includes('simón bolívar') || text.includes('barcelona') || text.includes('zamora') || text.includes('pizarro') || text.includes('vázquez varela')) {
    return 'Gran Vía / Praza España';
  }
  if (text.includes('praza america') || text.includes('plaza américa') || text.includes('travesas') || text.includes('camelias') || text.includes('castrelos') || text.includes('lopez mora') || text.includes('lópez mora') || text.includes('fragoso') || text.includes('laxeiro')) {
    return 'Plaza de América / As Travesas';
  }
  if (text.includes('coia') || text.includes('florida') || text.includes('castelao') || text.includes('baiona') || text.includes('o grove') || text.includes('cangas') || text.includes('martin echegaray') || text.includes('martín echegaray')) {
    return 'Coia / Florida';
  }
  if (text.includes('sanjurjo badia') || text.includes('sanjurjo badía') || text.includes('teis') || text.includes('guixar') || text.includes('purificacion saavedra') || text.includes('purificación saavedra') || text.includes('julian estevez') || text.includes('julián estévez') || text.includes('buenos aires') || text.includes('chapela')) {
    return 'Teis / Guixar';
  }
  if (text.includes('navia') || text.includes('teixugueiras') || text.includes('samil') || text.includes('coruxo') || text.includes('canido') || text.includes('o vao') || text.includes('saiáns') || text.includes('saians')) {
    return 'Samil / Navia';
  }
  if (text.includes('castro') || text.includes('alcedo') || text.includes('hispanidad') || text.includes('alfonso xii')) {
    return 'O Castro';
  }

  return 'Vigo Centro';
}

// Helper para extraer franjas de horario y horas valle
function extractTimeSlotsAndValley(category: string, operatingHours?: any, openState?: string) {
  const isGastro = category === 'Hostelería y Restauración';
  const isHealth = category === 'Salud y Farmacia' || category === 'Belleza y Cuidado Personal';

  let morning = isGastro ? '12:30 - 16:00' : '09:30 - 14:00';
  let afternoon = isGastro ? '20:00 - 23:30' : '16:30 - 20:30';
  let night = isGastro ? '23:00 - 01:00' : '';
  let valley = isGastro ? '16:00 - 19:30' : (isHealth ? '13:30 - 16:30' : '14:30 - 17:00');

  // Si tenemos texto de operating_hours, intentamos leer la estructura
  if (operatingHours && typeof operatingHours === 'object') {
    const mondayOrAny = operatingHours.monday || operatingHours.lunes || Object.values(operatingHours)[0];
    if (typeof mondayOrAny === 'string' && mondayOrAny.includes('-')) {
      const parts = mondayOrAny.split(/[,;]/);
      if (parts.length >= 2) {
        morning = parts[0].trim();
        afternoon = parts[1].trim();
      }
    }
  }

  return {
    time_slots: {
      morning,
      afternoon,
      night
    },
    valleyHours: valley
  };
}

// Helper para generar el perfil de cooperación inicial según el sector
function generateDefaultCooperationProfile(category: string, zone: string, name: string) {
  switch (category) {
    case 'Hostelería y Restauración':
      return {
        idleCapacity: ['Mesas libres en horas valle (tardes/mañanas)', 'Espacio de terraza para eventos o charlas'],
        offers: ['Descuento o detalle cruzado para clientes de comercios aliados', 'Degustación o muestra de bienvenida para turistas / clientes nuevos', 'Paquete o experiencia conjunta (ej. Cena + Ocio + Compra)'],
        needs: ['Llenar mesas / clientela en franjas horarias valle', 'Atraer turistas y visitantes que llegan a Vigo', 'Conectar con trabajadores de oficinas y comercios cercanos'],
        targetAudience: ['Vecinos del barrio', 'Turistas', 'Trabajadores locales', 'Parejas y grupos'],
        preferredPartners: ['Comercio y Moda', 'Salud y Farmacia', 'Cultura, Libros y Café', 'Alojamiento y Turismo'],
        valleyHours: '16:00 - 19:30',
        specialProposal: `Crear ruta conjunta o bono de merienda/tapa con comercios amigos de ${zone}.`
      };
    case 'Salud y Farmacia':
      return {
        idleCapacity: ['Espacio de escaparate o expositor para terceros', 'Horas valle de mediodía'],
        offers: ['Descuento o detalle cruzado para clientes de comercios aliados', 'Campañas de prevención y chequeos gratuitos para el barrio'],
        needs: ['Fidelizar vecinos y clientes habituales del barrio', 'Derivación de clientes de salud y bienestar'],
        targetAudience: ['Familias', 'Personas mayores', 'Deportistas', 'Vecinos de barrio'],
        preferredPartners: ['Deporte y Bienestar', 'Alimentación y Delicatessen', 'Hostelería y Restauración'],
        valleyHours: '14:00 - 16:30',
        specialProposal: `Pack de bienestar o charlas de cuidado para socios de gimnasios y comercios de ${zone}.`
      };
    case 'Belleza y Cuidado Personal':
      return {
        idleCapacity: ['Horas de personal disponible en franjas flojas', 'Espacio de expositor o muestras'],
        offers: ['Descuento o detalle cruzado para clientes de comercios aliados', 'Difusión en redes sociales o escaparate de comercios amigos'],
        needs: ['Llenar citas / clientela en franjas horarias valle', 'Conectar con trabajadores de oficinas y comercios cercanos'],
        targetAudience: ['Vecinos del barrio', 'Trabajadores de la zona', 'Jóvenes y adultos'],
        preferredPartners: ['Comercio y Moda', 'Salud y Farmacia', 'Hostelería y Restauración'],
        valleyHours: '13:30 - 16:30',
        specialProposal: `Pack cruzado de arreglo + café/tapa o moda en ${zone}.`
      };
    case 'Comercio y Moda':
      return {
        idleCapacity: ['Espacio de escaparate o expositor para terceros', 'Punto de recogida o entrega para otros negocios'],
        offers: ['Descuento o detalle cruzado para clientes de comercios aliados', 'Difusión en redes sociales o escaparate de comercios amigos'],
        needs: ['Mayor visibilidad digital en el ecosistema de Vigo', 'Atraer turistas y visitantes que llegan a Vigo', 'Fidelizar vecinos'],
        targetAudience: ['Compradores locales', 'Turistas', 'Aficionados a la moda'],
        preferredPartners: ['Belleza y Cuidado Personal', 'Hostelería y Restauración', 'Artesanía y Diseño Local'],
        valleyHours: '14:30 - 17:00',
        specialProposal: `Descuentos combinados con cafeterías y peluquerías de la zona de ${zone}.`
      };
    case 'Deporte y Bienestar':
      return {
        idleCapacity: ['Sala o espacio para eventos, charlas o talleres', 'Horas valle de media mañana o primera hora de la tarde'],
        offers: ['Descuento o detalle cruzado para clientes de comercios aliados', 'Clase de prueba gratuita para clientes de comercios amigos'],
        needs: ['Fidelizar socios locales', 'Conectar con trabajadores de oficinas y empresas de Vigo'],
        targetAudience: ['Jóvenes', 'Deportistas', 'Trabajadores', 'Personas activas'],
        preferredPartners: ['Salud y Farmacia', 'Alimentación y Delicatessen', 'Comercio y Moda'],
        valleyHours: '13:00 - 16:00',
        specialProposal: `Convenio deportivo y de vida saludable para empleados de comercios de ${zone}.`
      };
    case 'Alimentación y Delicatessen':
      return {
        idleCapacity: ['Excedentes diarios de producto de calidad', 'Espacio de mostrador para folletos o catálogos'],
        offers: ['Degustación o muestra de bienvenida para turistas / clientes nuevos', 'Compras agrupadas a proveedores para abaratar costes'],
        needs: ['Dar salida a productos frescos y artesanos', 'Atraer clientes amantes de la gastronomía de calidad'],
        targetAudience: ['Gourmets', 'Familias', 'Vecinos de proximidad', 'Turistas gastronómicos'],
        preferredPartners: ['Hostelería y Restauración', 'Salud y Farmacia', 'Cultura, Libros y Café'],
        valleyHours: '15:00 - 17:30',
        specialProposal: `Suministro o maridaje de productos locales con locales de hostelería de ${zone}.`
      };
    default:
      return {
        idleCapacity: ['Espacio de escaparate o expositor para terceros', 'Horas de personal disponible en franjas flojas'],
        offers: ['Descuento o detalle cruzado para clientes de comercios aliados', 'Difusión en redes sociales o escaparate de comercios amigos'],
        needs: ['Mayor visibilidad digital en el ecosistema de Vigo', 'Fidelizar vecinos y clientes habituales del barrio'],
        targetAudience: ['Vecinos de Vigo', 'Turistas', 'Público general'],
        preferredPartners: ['Hostelería y Restauración', 'Comercio y Moda', 'Servicios Profesionales'],
        valleyHours: '14:30 - 17:00',
        specialProposal: `Alianza colaborativa y dinamización comercial de proximidad en ${zone}.`
      };
  }
}

// Normalizador integral de un lugar devuelto por SerpAPI a la ficha estructurada de AhorraAI v4
function enrichPlaceToBusinessProfile(place: any, index: number): MemoryCoopBusiness {
  const name = (place.title || place.name || 'Comercio Desconocido').trim();
  const address = place.address || place.formatted_address || 'Vigo, Pontevedra';
  const category = normalizeVigoCategory(place.type || place.category, name, place.description || place.snippet);
  const zone = detectVigoZone(address, name);
  const phone = place.phone || '';
  const website = place.links?.website || place.website || place.link || '';
  const description = place.description || place.snippet || `${category} situado en ${zone}, Vigo.`;
  const rating = typeof place.rating === 'number' ? place.rating : parseFloat(place.rating || '0') || null;
  const reviewsCount = typeof place.reviews === 'number' ? place.reviews : parseInt(place.reviews || place.user_reviews || '0', 10) || null;
  
  const { time_slots, valleyHours } = extractTimeSlotsAndValley(category, place.operating_hours, place.open_state);
  const imageUrl = place.thumbnail || place.image || '';
  const coopProfile = generateDefaultCooperationProfile(category, zone, name);
  const accessCode = generateBusinessAccessCode(name, zone);
  const businessId = place.place_id || place.data_id || `biz-serp-${Date.now()}-${index}`;

  return {
    id: businessId,
    access_code: accessCode,
    name,
    category,
    description,
    address,
    zone,
    phone,
    website,
    opening_hours: place.operating_hours || {},
    time_slots,
    honesty_status: "OBSERVADO", // Principio de Honestidad Estructural: datos extraídos de Google/calle automáticamente
    cooperation: {
      ...coopProfile,
      valleyHours: valleyHours || coopProfile.valleyHours,
      image_url: imageUrl
    },
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Endpoint enriquecido para SerpAPI: busca con cualquier engine y devuelve tanto el RAW como los negocios enriquecidos
app.post("/api/serpapi/search-and-enrich", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { query, engine = "google_maps", enrichWithAI = true } = req.body;
    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "SERPAPI_API_KEY no está configurada en el servidor." });
    }

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "La consulta de búsqueda es requerida." });
    }

    // Normalizar query para asegurar que busque en Vigo
    const cleanQuery = query.toLowerCase().includes('vigo') ? query : `${query} en Vigo`;
    const encodedQuery = encodeURIComponent(cleanQuery);

    let apiUrl = "";
    if (engine === "google_maps") {
      apiUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodedQuery}&ll=@42.2405989,-8.7207268,14z&hl=es&gl=es&google_domain=google.es&api_key=${apiKey}`;
    } else if (engine === "google_local") {
      apiUrl = `https://serpapi.com/search.json?engine=google_local&q=${encodedQuery}&location=Vigo,+Spain&hl=es&gl=es&google_domain=google.es&api_key=${apiKey}`;
    } else {
      apiUrl = `https://serpapi.com/search.json?engine=google&q=${encodedQuery}&location=Vigo,+Spain&hl=es&gl=es&google_domain=google.es&api_key=${apiKey}`;
    }

    const response = await fetch(apiUrl);
    const rawData = await response.json();

    if (rawData.error) {
      return res.status(500).json({ error: rawData.error, raw: rawData });
    }

    // Extraer lugares de los diferentes campos de respuesta según el engine
    let rawPlaces: any[] = [];
    if (Array.isArray(rawData.local_results)) {
      rawPlaces = rawData.local_results;
    } else if (Array.isArray(rawData.places_results)) {
      rawPlaces = rawData.places_results;
    } else if (Array.isArray(rawData.organic_results)) {
      rawPlaces = rawData.organic_results;
    } else if (rawData.local_results && typeof rawData.local_results === 'object') {
      rawPlaces = [rawData.local_results];
    } else if (rawData.places_results && typeof rawData.places_results === 'object') {
      rawPlaces = [rawData.places_results];
    }

    // Mapear cada lugar al modelo enriquecido de AhorraAI v4 con Honestidad Estructural (OBSERVADO)
    let enrichedBusinesses = rawPlaces.map((place, idx) => enrichPlaceToBusinessProfile(place, idx));

    // Si se solicitó enriquecimiento por IA y tenemos Gemini/Groq, refinar descripciones y propuestas
    if (enrichWithAI && enrichedBusinesses.length > 0) {
      try {
        const sampleToEnrich = enrichedBusinesses.slice(0, 10);
        const prompt = `Eres el Arquitecto de IA de "AhorraAI v4" en Vigo.
Tienes esta lista de comercios extraídos de Google/SerpAPI en Vigo:
${JSON.stringify(sampleToEnrich.map(b => ({ id: b.id, name: b.name, category: b.category, zone: b.zone, address: b.address })), null, 2)}

Para cada uno, genera una descripción comercial atractiva y una propuesta de cooperación local muy específica y realista para Vigo.
Devuelve EXCLUSIVAMENTE un JSON array con esta forma:
[
  {
    "id": "id del negocio",
    "refined_description": "descripción concreta de su actividad y encanto",
    "refined_specialProposal": "propuesta colaborativa específica para su barrio de Vigo"
  }
]`;

        let aiText = "";
        try {
          aiText = await generateAIResponse(
            [{ role: 'user', content: prompt }],
            "Eres el Arquitecto de IA de AhorraAI v4 en Vigo. Devuelve EXCLUSIVAMENTE un JSON array válido."
          );
        } catch (aiCallErr) {
          console.warn("[SerpAPI AI Enrichment generateAIResponse Warning]:", aiCallErr);
        }

        const cleanedJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        if (cleanedJson.startsWith('[')) {
          const refinements = JSON.parse(cleanedJson);

          if (Array.isArray(refinements)) {
            enrichedBusinesses = enrichedBusinesses.map(b => {
              const match = refinements.find((r: any) => r.id === b.id);
              if (match) {
                return {
                  ...b,
                  description: match.refined_description || b.description,
                  cooperation: {
                    ...b.cooperation,
                    specialProposal: match.refined_specialProposal || b.cooperation.specialProposal
                  }
                };
              }
              return b;
            });
          }
        }
      } catch (aiErr) {
        console.warn("[SerpAPI AI Enrichment Warning]:", aiErr);
      }
    }

    res.json({
      success: true,
      engine_used: engine,
      query: cleanQuery,
      total_found: enrichedBusinesses.length,
      enriched_businesses: enrichedBusinesses,
      summary: {
        total: enrichedBusinesses.length,
        sectors: Array.from(new Set(enrichedBusinesses.map(b => b.category))),
        zones: Array.from(new Set(enrichedBusinesses.map(b => b.zone))),
        withPhone: enrichedBusinesses.filter(b => !!b.phone).length,
        withWebsite: enrichedBusinesses.filter(b => !!b.website).length
      },
      raw_serpapi: rawData
    });
  } catch (err: any) {
    console.error("[SerpAPI Search & Enrich Error]:", err);
    res.status(500).json({ error: "Error en la búsqueda y enriquecimiento: " + err.message });
  }
});

// Importar negocios enriquecidos directamente a la Red de Sinergias y recalcular grafo
app.post("/api/serpapi/import-cooperation", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { businesses } = req.body;
    if (!Array.isArray(businesses) || businesses.length === 0) {
      return res.status(400).json({ error: "No se proporcionaron negocios válidos para importar." });
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const biz of businesses) {
      const existingIdx = inMemoryCoopBusinesses.findIndex(
        b => b.id === biz.id || (b.name.toLowerCase().trim() === biz.name.toLowerCase().trim() && b.address.toLowerCase().trim() === biz.address.toLowerCase().trim())
      );

      if (existingIdx >= 0) {
        inMemoryCoopBusinesses[existingIdx] = {
          ...inMemoryCoopBusinesses[existingIdx],
          ...biz,
          updated_at: new Date().toISOString()
        };
        updatedCount++;
      } else {
        inMemoryCoopBusinesses.push({
          ...biz,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        insertedCount++;
      }
    }

    // Recalcular sinergias comerciales en segundo plano
    calculateSynergiesWithAI(inMemoryCoopBusinesses).catch(console.error);

    res.json({
      success: true,
      inserted: insertedCount,
      updated: updatedCount,
      total_in_network: inMemoryCoopBusinesses.length,
      message: `Se han integrado ${insertedCount} nuevos comercios y actualizado ${updatedCount} en el Grafo de Cooperación de Vigo.`
    });
  } catch (err: any) {
    console.error("[SerpAPI Import to Cooperation Error]:", err);
    res.status(500).json({ error: "Error al importar a la Red de Cooperación: " + err.message });
  }
});

// Endpoint legado /api/test-serpapi para compatibilidad completa
app.post("/api/test-serpapi", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { query, engine = "google_maps" } = req.body;
    const apiKey = process.env.SERPAPI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "SERPAPI_API_KEY no está configurada en el servidor." });
    }

    const cleanQuery = query.toLowerCase().includes('vigo') ? query : `${query} en Vigo`;
    const response = await fetch(`https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(cleanQuery)}&location=Vigo,+Spain&hl=es&gl=es&google_domain=google.es&api_key=${apiKey}`);
    const data = await response.json();

    // Enriquecer automáticamente
    let rawPlaces: any[] = [];
    if (Array.isArray(data.local_results)) rawPlaces = data.local_results;
    else if (Array.isArray(data.places_results)) rawPlaces = data.places_results;
    else if (Array.isArray(data.organic_results)) rawPlaces = data.organic_results;

    const enriched = rawPlaces.map((p, i) => enrichPlaceToBusinessProfile(p, i));

    res.json({
      ...data,
      enriched_businesses: enriched
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint para el Agente Prospector (AI Parser)
app.post("/api/agent/parse-prospecting-prompt", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "No se proporcionó un prompt" });
    }

    const systemInstruction = `Eres un agente experto en prospección de negocios en Vigo.
El usuario te dará una orden (ej: "Busca restaurantes en el Casco Vello y luego ferreterías en Navia").
Tu tarea es devolver EXCLUSIVAMENTE un JSON con un array de "tasks", donde cada task es un string representando una query a buscar en SerpAPI.
Trata de formatear la búsqueda optimizándola para Google Maps en Vigo.
Por ejemplo:
{
  "tasks": ["Restaurantes en Casco Vello, Vigo", "Ferreterías en Navia, Vigo"]
}`;
    
    let aiResponse = await generateAIResponse(
      [{ role: "user", content: prompt }],
      systemInstruction
    );

    // Clean JSON markdown if present
    aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(aiResponse);
      return res.json(parsed);
    } catch (parseError) {
      console.warn("Could not parse AI response as JSON:", aiResponse);
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }
  } catch (error: any) {
    console.error("[Parse Prospecting Prompt Error]:", error);
    res.status(500).json({ error: error.message });
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

  // Sinónimos / Mapeo de intención básica (Español e Inglés)
  const foodKeywords = ['comer','cenar','restaurante','marisco','tapas','eat','food','restaurant','lunch','dinner','meal','dine','jantar','almoço','comida','manger','dîner','déjeuner','nourriture','essen','abendessen','mittagessen','lebensmittel','mangiare','cena','pranzo','cibo'];
  const isFood = foodKeywords.some(kw => q.includes(kw));
  const shopKeywords = ['comprar','tienda','ropa','zapatillas','regalo','souvenir','buy','shop','gift','purchase','loja','presente','lembrança','acheter','boutique','magasin','cadeau','kaufen','geschäft','laden','geschenk','andenken','comprare','negozio','ricordo'];
  const isShop = shopKeywords.some(kw => q.includes(kw));
  
  const category = (business.category || '').toLowerCase();
  const descIsFood = desc.includes('restaurante') || desc.includes('comida') || desc.includes('bar') || desc.includes('tapa') || category.includes('restauración') || category.includes('hostelería');
  const descIsShop = desc.includes('tienda') || desc.includes('ropa') || desc.includes('comercio') || desc.includes('joyería') || desc.includes('regalo') || desc.includes('artesanía') || category.includes('moda') || category.includes('comercio') || category.includes('joyería');

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

// Conectar los servicios del cerebro con las funciones de datos de la app
ahorraAIBusinessService.setProviders(
  () => getAllUnifiedBusinesses(),
  () => inMemorySynergies
);

vigoToolExecutor.setSerpApiProviders(
  (q) => serpapiService.searchLocal(q),
  (q) => serpapiService.searchWeb(q)
);

vigoAgentPlanner.setAIGenerator(
  (msgs, sys) => generateAIResponse(msgs, sys)
);

// --- Endpoint Chat Web (Impulsado por el Cerebro de Agente de Vigo) ---

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, config } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensajes inválidos." });
    }

    const lastMessage = messages[messages.length - 1].text;
    const formattedMessages = messages.map((m: any) => ({
      role: m.isBot ? 'model' : 'user',
      content: m.text,
      image: m.image
    }));

    // 1. Comprensión de intención y Planificación dinámica de fuentes
    const plan = vigoAgentPlanner.analyzeIntent(lastMessage, config);
    console.log(`[VigoAgentPlanner]: Intenciones detectadas: [${plan.detectedIntents.join(', ')}] | Zona: ${plan.zone || 'Global Vigo'} | Fuente prioritaria: ${plan.prioritySource}`);

    // 2. Ejecución, Selección inteligente de tools, Validación y Razonamiento
    const result = await vigoAgentPlanner.executePlan(plan, formattedMessages, config);

    res.json({ 
      text: result.finalMessage,
      sourcesUsed: result.sourcesUsed,
      reasoning: result.reasoning,
      executionTimeMs: result.executionTimeMs,
      structuredData: result.structuredData,
      debugTrace: result.debugTrace
    });
  } catch (e: any) {
    console.error("[Chat API Error]:", e);
    res.status(500).json({ error: "Error de comunicación con el asistente. " + (e?.message || "") });
  }
});

// --- Endpoints de Diagnóstico, Salud y Auditoría del Cerebro de Vigo ---
app.get("/api/brain/health", async (req, res) => {
  try {
    const checks = await vigoDataRegistry.runHealthChecks();
    const sources = vigoDataRegistry.getSources();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      sources,
      checks
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/brain/sources", (req, res) => {
  res.json({
    sources: vigoDataRegistry.getSources()
  });
});

app.post("/api/brain/plan", (req, res) => {
  const { query, config } = req.body;
  if (!query) return res.status(400).json({ error: "query requerida" });
  const plan = vigoAgentPlanner.analyzeIntent(query, config);
  res.json({ plan });
});

app.post("/api/brain/audit", async (req, res) => {
  try {
    const { query, config } = req.body;
    if (!query) return res.status(400).json({ error: "query requerida" });
    const plan = vigoAgentPlanner.analyzeIntent(query, config);
    const messages = [{ role: 'user', content: query }];
    const result = await vigoAgentPlanner.executePlan(plan, messages, config);
    res.json({
      query,
      plan,
      debugTrace: result.debugTrace,
      factsCollected: result.rawFacts.length,
      sourcesUsed: result.sourcesUsed,
      executionTimeMs: result.executionTimeMs,
      finalMessage: result.finalMessage
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/brain/weather", async (req, res) => {
  try {
    const w = await weatherProvider.getWeather();
    res.json(w);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/brain/historical/:dataset", async (req, res) => {
  try {
    const { dataset } = req.params;
    const { metric, location, month, dayOfWeek, expr } = req.query;
    const comparison = await vigoHistoricalDataService.getHistoricalComparison(dataset, {
      metric: metric as string,
      location: location as string,
      month: month ? parseInt(month as string, 10) : undefined,
      dayOfWeek: dayOfWeek ? parseInt(dayOfWeek as string, 10) : undefined,
      temporalExpression: expr as string
    });
    res.json(comparison);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/brain/temporal-resolve", (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "query requerida" });
  const resolution = vigoTimeResolver.resolveTemporal(query);
  res.json({ resolution });
});

app.get("/api/brain/catalog", async (req, res) => {
  try {
    const pkgs = await catalogService.getPackageList();
    res.json(pkgs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// MOTOR DE GRAFO DE COMERCIO LOCAL COLABORATIVO Y SINERGIAS (AHORRAAI V4)
// ============================================================================

// Memoria persistente en servidor para sinergias y negocios con perfiles de cooperación
interface MemoryCoopBusiness {
  id: string;
  access_code: string;
  name: string;
  category: string;
  description: string;
  address: string;
  zone: string;
  phone: string;
  website: string;
  opening_hours: any;
  time_slots: {
    morning?: string;
    afternoon?: string;
    night?: string;
  };
  honesty_status: 'DICHO' | 'OBSERVADO' | 'SIN_CONFIRMAR';
  cooperation: {
    idleCapacity: string[];
    offers: string[];
    needs: string[];
    targetAudience: string[];
    preferredPartners: string[];
    valleyHours: string;
    specialProposal?: string;
    image_url?: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MemorySynergy {
  id: string;
  businessA_id: string;
  businessA_name: string;
  businessB_id: string;
  businessB_name: string;
  synergyType: 'bono_cruzado' | 'franja_valle' | 'compra_agrupada' | 'derivacion_clientes' | 'pack_experiencia';
  title: string;
  description: string;
  benefitA: string;
  benefitB: string;
  compatibilityScore: number;
  status: 'sugerida' | 'en_contacto' | 'activa';
  created_at: string;
}

// Semilla inicial de comercios de Vigo con perfiles de cooperación estructurados
const inMemoryCoopBusinesses: MemoryCoopBusiness[] = [];

let inMemorySynergies: MemorySynergy[] = [];

// Función hash FNV-1a para generar números y sales deterministas basados en identificador
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Cachés en memoria para garantizar que el código de acceso nunca cambie entre refrescos o llamadas
const memoryAccessCodeCache = new Map<string, string>(); // id o seed -> access_code
const memoryCodeToBusinessId = new Map<string, string>(); // access_code normalizado -> id

// Función para generar código de acceso único, robusto y 100% DETERMINISTA
function generateBusinessAccessCode(name: string, zone?: string, id?: string): string {
  const prefix = "VIGO";
  const cleanZone = (zone || name).replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase() || "COMM";
  
  // Usar el ID del negocio o combinación estable nombre+zona para que el hash sea inmutable
  const seed = (id && String(id).trim()) 
    ? String(id).trim() 
    : `${name.trim().toLowerCase()}__${(zone || '').trim().toLowerCase()}`;
    
  const h1 = fnv1a(seed);
  const h2 = fnv1a(seed + "_vigo_secure_salt_v4");
  
  const num = 10000 + (h1 % 90000);
  const salt = (h2 % 1679616).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  return `${prefix}-${num}-${cleanZone}-${salt}`;
}

// Normalizador y enriquecedor para cualquier registro de negocio (Supabase o memoria)
function normalizeAndEnrichDbBusiness(row: any): MemoryCoopBusiness {
  const rowId = row.id ? String(row.id).trim() : '';
  const name = (row.name || 'Comercio Local').trim();
  const address = row.address || '';
  const description = row.description || '';
  const category = row.category || normalizeVigoCategory(row.type, name, description);
  const zone = row.zone || detectVigoZone(address, name);
  
  // 1. Si ya viene con access_code en base de datos, usarlo
  let access_code = (row.access_code && String(row.access_code).trim()) 
    ? String(row.access_code).trim().toUpperCase() 
    : '';
  
  // 2. Si no viene en BD, consultar caché por ID o por nombre
  const nameKey = `name:${name.toLowerCase()}`;
  if (!access_code && rowId && memoryAccessCodeCache.has(rowId)) {
    access_code = memoryAccessCodeCache.get(rowId)!;
  }
  if (!access_code && memoryAccessCodeCache.has(nameKey)) {
    access_code = memoryAccessCodeCache.get(nameKey)!;
  }

  // 3. Si no existe aún, generar código determinista e inmutable
  if (!access_code) {
    access_code = generateBusinessAccessCode(name, zone || address, rowId);
  }

  // Fijar en caché de forma permanente
  if (rowId) memoryAccessCodeCache.set(rowId, access_code);
  memoryAccessCodeCache.set(nameKey, access_code);
  memoryCodeToBusinessId.set(access_code.toUpperCase(), rowId || nameKey);
  memoryCodeToBusinessId.set(access_code.replace(/[\s\-_]/g, '').toUpperCase(), rowId || nameKey);

  const honesty_status = (row.honesty_status === 'DICHO' || row.honesty_status === 'OBSERVADO' || row.honesty_status === 'SIN_CONFIRMAR') 
    ? row.honesty_status 
    : 'OBSERVADO';

  const defaultSlots = extractTimeSlotsAndValley(category, row.opening_hours);
  const time_slots = (row.time_slots && row.time_slots.morning) 
    ? row.time_slots 
    : defaultSlots.time_slots;

  const defaultCoop = generateDefaultCooperationProfile(category, zone, name);
  const cooperation = (row.cooperation && (row.cooperation.specialProposal || row.cooperation.idleCapacity?.length > 0))
    ? {
        idleCapacity: Array.isArray(row.cooperation.idleCapacity) && row.cooperation.idleCapacity.length > 0 ? row.cooperation.idleCapacity : defaultCoop.idleCapacity,
        offers: Array.isArray(row.cooperation.offers) && row.cooperation.offers.length > 0 ? row.cooperation.offers : defaultCoop.offers,
        needs: Array.isArray(row.cooperation.needs) && row.cooperation.needs.length > 0 ? row.cooperation.needs : defaultCoop.needs,
        targetAudience: Array.isArray(row.cooperation.targetAudience) && row.cooperation.targetAudience.length > 0 ? row.cooperation.targetAudience : defaultCoop.targetAudience,
        preferredPartners: Array.isArray(row.cooperation.preferredPartners) && row.cooperation.preferredPartners.length > 0 ? row.cooperation.preferredPartners : defaultCoop.preferredPartners,
        valleyHours: row.cooperation.valleyHours || defaultSlots.valleyHours || defaultCoop.valleyHours,
        specialProposal: row.cooperation.specialProposal || defaultCoop.specialProposal
      }
    : defaultCoop;

  return {
    id: row.id || `biz-${Date.now()}`,
    access_code,
    name,
    category,
    description,
    address,
    zone,
    phone: row.phone || '',
    website: row.website || '',
    opening_hours: row.opening_hours || {},
    time_slots,
    honesty_status,
    cooperation,
    is_active: row.is_active !== false,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString()
  };
}

// Función maestra para obtener todos los comercios de Supabase y memoria unificados
async function getAllUnifiedBusinesses(): Promise<MemoryCoopBusiness[]> {
  const unifiedMap = new Map<string, MemoryCoopBusiness>();

  // 1. Cargar semillas iniciales en memoria
  for (const b of inMemoryCoopBusinesses) {
    unifiedMap.set(b.id, b);
  }

  // 2. Si Supabase está configurado, cargar todos los comercios reales
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const toPersist: { id: string; access_code: string }[] = [];

        for (const row of data) {
          const enriched = normalizeAndEnrichDbBusiness(row);

          // Si el registro de la BD carece de clave, prepararlo para actualización
          if ((!row.access_code || !String(row.access_code).trim()) && enriched.access_code && row.id) {
            toPersist.push({ id: row.id, access_code: enriched.access_code });
          }

          // Sobrescribir o añadir por ID o por coincidencia exacta de nombre
          const existingById = unifiedMap.get(enriched.id);
          if (existingById) {
            unifiedMap.set(enriched.id, { ...existingById, ...enriched });
          } else {
            // Verificar si ya existe por nombre idéntico
            let foundKey = '';
            for (const [k, v] of unifiedMap.entries()) {
              if (v.name.toLowerCase() === enriched.name.toLowerCase()) {
                foundKey = k;
                break;
              }
            }
            if (foundKey) {
              unifiedMap.set(foundKey, { ...unifiedMap.get(foundKey)!, ...enriched });
            } else {
              unifiedMap.set(enriched.id, enriched);
            }
          }
        }

        // Auto-persistencia asíncrona en Supabase para fijar de forma permanente los access_code
        if (toPersist.length > 0) {
          (async () => {
            try {
              for (const item of toPersist.slice(0, 30)) {
                await supabase.from('businesses').update({ access_code: item.access_code }).eq('id', item.id);
              }
            } catch (err: any) {
              console.warn('[Auto-persist access_codes warning]:', err.message);
            }
          })();
        }
      }
    } catch (sbErr) {
      console.warn("[GetAllUnifiedBusinesses Supabase Warning]:", sbErr);
    }
  }

  return Array.from(unifiedMap.values());
}

// Recompensas y Puntos en Memoria
interface MemoryRewardRecord {
  business_id: string;
  points: number;
  tier: 'Bronce' | 'Plata' | 'Oro' | 'Embajador Vigo';
  referred_count: number;
  referral_code: string;
  history: Array<{
    id: string;
    action: string;
    points: number;
    date: string;
  }>;
}

const inMemoryRewardsMap = new Map<string, MemoryRewardRecord>();

function getOrCreateRewardProfile(business: MemoryCoopBusiness): MemoryRewardRecord {
  const existing = inMemoryRewardsMap.get(business.id);
  if (existing) return existing;

  const basePoints = business.honesty_status === 'DICHO' ? 100 : 50;
  const referralCode = `EMBAJADOR-${business.access_code.split('-')[1] || 'VIGO'}`;

  const profile: MemoryRewardRecord = {
    business_id: business.id,
    points: basePoints,
    tier: basePoints >= 250 ? 'Plata' : 'Bronce',
    referred_count: 0,
    referral_code: referralCode,
    history: [
      {
        id: `rew-${Date.now()}-1`,
        action: business.honesty_status === 'DICHO' ? 'Ficha validada por el comerciante (DICHO)' : 'Adhesión a la Red AhorraAI Vigo',
        points: basePoints,
        date: new Date().toISOString()
      }
    ]
  };

  inMemoryRewardsMap.set(business.id, profile);
  return profile;
}

// Algoritmo de IA y Matriz Heurística Completa para cálculo de sinergias entre los 126+ negocios
async function calculateSynergiesWithAI(businesses: MemoryCoopBusiness[]): Promise<MemorySynergy[]> {
  if (businesses.length < 2) return inMemorySynergies;

  const synergiesList: MemorySynergy[] = [];
  const pairKeys = new Set<string>();

  const addSynergy = (
    bA: MemoryCoopBusiness,
    bB: MemoryCoopBusiness,
    synergyType: MemorySynergy['synergyType'],
    title: string,
    description: string,
    benefitA: string,
    benefitB: string,
    score: number
  ) => {
    const key = [bA.id, bB.id].sort().join('___');
    if (pairKeys.has(key)) return;
    pairKeys.add(key);

    synergiesList.push({
      id: `syn-${bA.id.substring(0, 8)}-${bB.id.substring(0, 8)}-${synergiesList.length + 1}`,
      businessA_id: bA.id,
      businessA_name: bA.name,
      businessB_id: bB.id,
      businessB_name: bB.name,
      synergyType,
      title,
      description,
      benefitA,
      benefitB,
      compatibilityScore: Math.min(99, Math.max(75, score)),
      status: 'sugerida',
      created_at: new Date().toISOString()
    });
  };

  // 1. GENERACIÓN DETERMINÍSTICA POR MATRIZ DE COMPLEMENTARIEDAD Y ZONAS EN VIGO
  for (let i = 0; i < businesses.length; i++) {
    const b1 = businesses[i];
    for (let j = i + 1; j < businesses.length; j++) {
      const b2 = businesses[j];

      const sameZone = (b1.zone && b2.zone && b1.zone.toLowerCase() === b2.zone.toLowerCase()) ||
                       (b1.address && b2.address && b1.address.toLowerCase().includes(b2.zone?.toLowerCase() || 'vigo'));
      const cat1 = (b1.category || '').toLowerCase();
      const cat2 = (b2.category || '').toLowerCase();

      // Regla 1: Salud / Farmacia / Óptica <-> Deporte / Gimnasios / Fisioterapia
      if (
        (cat1.includes('salud') || cat1.includes('farma') || cat1.includes('óptica') || cat1.includes('dental')) &&
        (cat2.includes('deporte') || cat2.includes('gym') || cat2.includes('gimnasio') || cat2.includes('nutrición') || cat2.includes('fisioterapia'))
      ) {
        addSynergy(
          b1, b2, 'bono_cruzado',
          `Bono Salud & Rendimiento Deportivo (${b1.zone || 'Vigo'})`,
          `Los usuarios de ${b2.name} reciben un 10% en suplementación, chequeos o productos de recuperación en ${b1.name}, y ${b1.name} deriva clientes que buscan acondicionamiento físico o terapia con una sesión de prueba en ${b2.name}.`,
          `Aumento de ventas cruzadas en suplementación y fidelización de deportistas locales.`,
          `Captación de nuevos clientes preocupados por su salud y prevención de lesiones.`,
          sameZone ? 96 : 89
        );
      }

      // Regla 2: Hostelería / Cafetería / Restaurante <-> Librería / Cultura / Ocio / Fotografía
      else if (
        (cat1.includes('hostelería') || cat1.includes('café') || cat1.includes('restaurante') || cat1.includes('bar')) &&
        (cat2.includes('librería') || cat2.includes('cultura') || cat2.includes('ocio') || cat2.includes('fotografía') || cat2.includes('arte'))
      ) {
        addSynergy(
          b1, b2, 'pack_experiencia',
          `Experiencia 'Tarde Cultural & Café en ${b1.zone || 'Vigo'}'`,
          `Clientes que adquieran libros o artículos en ${b2.name} obtienen un vale de café o postre especial en ${b1.name} durante sus horas valle (${b1.cooperation?.valleyHours || '16:00 - 18:30'}).`,
          `Activación y consumo en mesas durante la franja valle de tarde.`,
          `Incentivo de compra cultural ofreciendo un espacio de lectura relajado al lado.`,
          sameZone ? 95 : 88
        );
      }

      // Regla 3: Moda / Calzado / Ropa <-> Belleza / Peluquería / Estética / Joyería
      else if (
        (cat1.includes('moda') || cat1.includes('ropa') || cat1.includes('calzado') || cat1.includes('textil')) &&
        (cat2.includes('belleza') || cat2.includes('peluquería') || cat2.includes('estética') || cat2.includes('joyería') || cat2.includes('barber'))
      ) {
        addSynergy(
          b1, b2, 'bono_cruzado',
          `Pack Estilo & Imagen Personal Vigo`,
          `Acuerdo de recomendación mutua para eventos, bodas o renovación de imagen: descuento del 15% en tratamientos de ${b2.name} por compras superiores a 50€ en ${b1.name}.`,
          `Mayor ticket medio al incentivar compras completas de temporada.`,
          `Captación de clientela lista para eventos o cambio de look.`,
          sameZone ? 94 : 87
        );
      }

      // Regla 4: Cerrajería / Seguridad <-> Inmobiliaria / Seguros / Reformas / Hogar
      else if (
        (cat1.includes('cerrajería') || cat1.includes('seguridad') || cat1.includes('ferretería')) &&
        (cat2.includes('inmobiliaria') || cat2.includes('seguro') || cat2.includes('reforma') || cat2.includes('hogar'))
      ) {
        addSynergy(
          b1, b2, 'derivacion_clientes',
          `Protocolo de Mudanza Segura Vigo`,
          `${b2.name} entrega a cada nuevo inquilino o comprador un cupón para cambio de bombín de seguridad antibumping con ${b1.name} a precio convenido, garantizando tranquilidad inmediata.`,
          `Canal continuo de nuevos clientes residenciales en Vigo sin coste publicitario.`,
          `Servicio de valor añadido exclusivo que mejora la satisfacción del comprador.`,
          sameZone ? 98 : 91
        );
      }

      // Regla 5: Horas Valle Compartidas en la misma Zona
      else if (sameZone && b1.cooperation?.valleyHours && b2.cooperation?.valleyHours && b1.category !== b2.category && synergiesList.length < 35) {
        addSynergy(
          b1, b2, 'franja_valle',
          `Campaña Vecinal 'Horas Valle' en ${b1.zone || 'el Barrio'}`,
          `Ambos comercios unen fuerzas para dinamizar la franja de ${b1.cooperation.valleyHours} ofreciendo tarjetas de sellos combinadas para vecinos de la zona.`,
          `Atracción de flujo peatonal durante las horas más lentas del día.`,
          `Fidelización de proximidad con vecinos del entorno directo en Vigo.`,
          89
        );
      }

      // Regla 6: Alimentación / Panadería / Delicatessen <-> Hostelería / Vinos
      else if (
        (cat1.includes('alimentación') || cat1.includes('panadería') || cat1.includes('gourmet') || cat1.includes('delicatessen')) &&
        (cat2.includes('hostelería') || cat2.includes('restaurante') || cat2.includes('vinoteca') || cat2.includes('taberna'))
      ) {
        addSynergy(
          b1, b2, 'compra_agrupada',
          `Suministro de Producto Artesano & Maridaje Local`,
          `${b2.name} incluye en su carta productos o panes artesanales seleccionados de ${b1.name}, promocionando su origen local con código QR para comprar directamente en la tienda.`,
          `Venta al por mayor regular y escaparate gastronómico permanente.`,
          `Diferenciación con producto artesano de máxima calidad de Vigo.`,
          sameZone ? 97 : 90
        );
      }
    }
  }

  // 2. ENRIQUECIMIENTO CON IA (GEMINI) PARA GENERAR SINERGIAS CREATIVAS COMPLEJAS
  try {
    // Tomamos una muestra balanceada de 10 negocios clave de diferentes sectores para mantener el prompt y respuesta concisos
    const sampleBusinesses = businesses.slice(0, 10).map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      zone: b.zone,
      idleCapacity: b.cooperation?.idleCapacity?.slice(0, 2) || [],
      offers: b.cooperation?.offers?.slice(0, 2) || [],
      needs: b.cooperation?.needs?.slice(0, 2) || []
    }));

    const prompt = `Eres el cerebro de Inteligencia Artificial del ecosistema "AhorraAI v4" en Vigo.
Genera exactamente entre 3 y 5 sinergias comerciales breves, innovadoras y rentables cruzando estos comercios:
${JSON.stringify(sampleBusinesses, null, 2)}

Devuelve EXCLUSIVAMENTE un JSON array con esta estructura (sé conciso):
[
  {
    "businessA_id": "id",
    "businessA_name": "nombre",
    "businessB_id": "id",
    "businessB_name": "nombre",
    "synergyType": "bono_cruzado",
    "title": "Título corto",
    "description": "Detalle breve",
    "benefitA": "Beneficio A",
    "benefitB": "Beneficio B",
    "compatibilityScore": 92
  }
]`;

    let generatedText = "";
    try {
      generatedText = await generateAIResponse(
        [{ role: 'user', content: prompt }],
        "Eres el cerebro de Inteligencia Artificial del ecosistema AhorraAI v4 en Vigo. Devuelve únicamente un JSON array válido."
      );
    } catch (aiGenErr) {
      console.warn("[Synergy AI Generation Warning]: Fallback a heurísticas determinísticas:", aiGenErr);
    }

    if (generatedText) {
      // Parser seguro con recuperación de JSON truncado
      let parsed: any[] = [];
      const cleaned = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
      const startIdx = cleaned.indexOf('[');
      if (startIdx !== -1) {
        const candidate = cleaned.slice(startIdx);
        try {
          const direct = JSON.parse(candidate);
          if (Array.isArray(direct)) parsed = direct;
        } catch {
          // Recuperación de array JSON truncado: recortar hasta el último objeto cerrado y cerrar el array
          const lastObjEnd = candidate.lastIndexOf('}');
          if (lastObjEnd > 0) {
            try {
              const repaired = candidate.slice(0, lastObjEnd + 1) + ']';
              const repParsed = JSON.parse(repaired);
              if (Array.isArray(repParsed)) parsed = repParsed;
            } catch {}
          }
        }
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        for (const s of parsed) {
          const bA = businesses.find(b => b.id === s.businessA_id) || { id: s.businessA_id, name: s.businessA_name } as any;
          const bB = businesses.find(b => b.id === s.businessB_id) || { id: s.businessB_id, name: s.businessB_name } as any;
          if (bA && bB && bA.id !== bB.id) {
            addSynergy(bA, bB, s.synergyType || 'bono_cruzado', s.title, s.description, s.benefitA, s.benefitB, s.compatibilityScore || 90);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[AI Enhanced Synergy Generation Notice]: Fallback determinístico activo.");
  }

  // Asegurar que siempre tengamos un set rico de sinergias
  if (synergiesList.length > 0) {
    inMemorySynergies = synergiesList;
    return synergiesList;
  }

  return inMemorySynergies;
}

// 1. Registro de Ficha de Negocio Colaborativo
app.post("/api/cooperation/register", async (req, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ error: "El nombre del negocio es obligatorio" });
    }

    // Siempre mintar id y access_code en servidor; ignorar body.id / body.access_code
    const businessId = `biz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const accessCode = generateBusinessAccessCode(body.name, body.zone || body.address);

    const newBusiness: MemoryCoopBusiness = {
      id: businessId,
      access_code: accessCode,
      name: body.name.trim(),
      category: body.category || "Comercio Local",
      description: body.description || "",
      address: body.address || "",
      zone: body.zone || "Vigo",
      phone: body.phone || "",
      website: body.website || "",
      opening_hours: body.opening_hours || {},
      time_slots: body.time_slots || { morning: "", afternoon: "", night: "" },
      honesty_status: "DICHO", // Declarado y validado directamente por el comerciante
      cooperation: {
        idleCapacity: Array.isArray(body.cooperation?.idleCapacity) ? body.cooperation.idleCapacity : [],
        offers: Array.isArray(body.cooperation?.offers) ? body.cooperation.offers : [],
        needs: Array.isArray(body.cooperation?.needs) ? body.cooperation.needs : [],
        targetAudience: Array.isArray(body.cooperation?.targetAudience) ? body.cooperation.targetAudience : [],
        preferredPartners: Array.isArray(body.cooperation?.preferredPartners) ? body.cooperation.preferredPartners : [],
        valleyHours: body.cooperation?.valleyHours || "",
        specialProposal: body.cooperation?.specialProposal || ""
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Nunca sobrescribir una fila existente: solo insertar
    inMemoryCoopBusinesses.unshift(newBusiness);

    // Guardar en Supabase con insert (no upsert)
    if (supabase) {
      try {
        const { error: insertErr } = await supabase.from('businesses').insert({
          id: businessId,
          name: newBusiness.name,
          description: newBusiness.description,
          address: newBusiness.address,
          phone: newBusiness.phone,
          website: newBusiness.website,
          opening_hours: newBusiness.opening_hours,
          category: newBusiness.category,
          zone: newBusiness.zone,
          access_code: newBusiness.access_code,
          honesty_status: newBusiness.honesty_status,
          time_slots: newBusiness.time_slots,
          cooperation: newBusiness.cooperation,
          is_active: true
        });
        if (insertErr) {
          console.warn("[Supabase Insert Warning]:", insertErr);
        }
      } catch (sbErr) {
        console.warn("[Supabase Sync Warning]:", sbErr);
      }
    }

    const allBusinesses = await getAllUnifiedBusinesses();
    calculateSynergiesWithAI(allBusinesses).catch(console.error);

    const mySynergies = inMemorySynergies.filter(s => s.businessA_id === businessId || s.businessB_id === businessId);

    res.json({
      success: true,
      business: newBusiness,
      access_code: accessCode,
      synergies: mySynergies,
      message: "Ficha registrada correctamente en la Red de Comercio Colaborativo de Vigo"
    });
  } catch (err: any) {
    console.error("[Cooperation Register Error]:", err);
    res.status(500).json({ error: "Error al registrar la ficha: " + err.message });
  }
});

// 2. Login por Clave de Acceso Única de Negocio
app.post("/api/cooperation/login", async (req, res) => {
  try {
    const { access_code } = req.body;
    if (!access_code || !access_code.trim()) {
      return res.status(400).json({ error: "Introduce tu clave de acceso de comercio" });
    }

    const cleanCode = access_code.trim().toUpperCase();
    const normalizedInput = cleanCode.replace(/[\s\-_]/g, '');
    const allBusinesses = await getAllUnifiedBusinesses();
    
    // 1. Búsqueda por coincidencia exacta o sin guiones/espacios
    let business = allBusinesses.find(b => {
      const bCode = (b.access_code || '').trim().toUpperCase();
      if (bCode === cleanCode) return true;
      if (bCode.replace(/[\s\-_]/g, '') === normalizedInput) return true;
      return false;
    });

    // 2. Fallback por ID del comercio o código de embajador
    if (!business) {
      business = allBusinesses.find(b => {
        if (b.id && String(b.id).trim().toUpperCase() === cleanCode) return true;
        const refCode = `EMBAJADOR-${(b.access_code || '').split('-')[1] || ''}`.toUpperCase();
        if (refCode && refCode === cleanCode) return true;
        return false;
      });
    }

    // 3. Fallback por mapa en memoria de códigos a ID
    if (!business) {
      const matchedKey = memoryCodeToBusinessId.get(cleanCode) || memoryCodeToBusinessId.get(normalizedInput);
      if (matchedKey) {
        business = allBusinesses.find(b => String(b.id) === matchedKey || `name:${b.name.toLowerCase()}` === matchedKey);
      }
    }

    if (!business) {
      return res.status(404).json({ error: "No se encontró ningún negocio con esa clave de acceso. Verifica el código o cópialo desde el panel de administración." });
    }

    // Obtener sinergias específicas para este negocio
    const mySynergies = inMemorySynergies.filter(s => s.businessA_id === business.id || s.businessB_id === business.id);

    res.json({
      success: true,
      business,
      synergies: mySynergies
    });
  } catch (err: any) {
    console.error("[Cooperation Login Error]:", err);
    res.status(500).json({ error: "Error de autenticación por clave: " + err.message });
  }
});


/** Public payloads must never include merchant access codes. */
function publicBusinessView(business: MemoryCoopBusiness) {
  const { access_code: _accessCode, ...safe } = business;
  return safe;
}

// 3. Obtener Ficha y Sinergias de un negocio por ID
app.get("/api/cooperation/business/:id", async (req, res) => {
  const { id } = req.params;
  const allBusinesses = await getAllUnifiedBusinesses();
  const business = allBusinesses.find(b => b.id === id);
  if (!business) {
    return res.status(404).json({ error: "Negocio no encontrado" });
  }

  const mySynergies = inMemorySynergies.filter(s => s.businessA_id === id || s.businessB_id === id);
  res.json({
    business: publicBusinessView(business),
    synergies: mySynergies
  });
});

// 4. Panel Admin / Grafo Global: Obtener todos los negocios y todas las sinergias
app.get("/api/cooperation/all", async (req, res) => {
  try {
    const allBusinesses = await getAllUnifiedBusinesses();
    
    // Si las sinergias son escasas, calcularlas con IA en segundo plano
    if (inMemorySynergies.length < 2 && allBusinesses.length >= 2) {
      calculateSynergiesWithAI(allBusinesses).catch(console.error);
    }

    const admin = await isAdminRequest(req);
    res.json({
      businesses: admin ? allBusinesses : allBusinesses.map(publicBusinessView),
      synergies: inMemorySynergies
    });
  } catch (err: any) {
    console.error("[Cooperation All Error]:", err);
    const admin = await isAdminRequest(req);
    res.json({
      businesses: admin ? inMemoryCoopBusinesses : inMemoryCoopBusinesses.map(publicBusinessView),
      synergies: inMemorySynergies
    });
  }
});

// 5. Endpoint de Auto-Enriquecimiento masivo de todos los negocios en Supabase
app.post("/api/cooperation/enrich-database", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  if (!supabase) {
    return res.status(400).json({ error: "Supabase no está conectado o faltan credenciales" });
  }

  try {
    const { data: rows, error } = await supabase
      .from('businesses')
      .select('*');

    if (error) throw error;

    let updatedCount = 0;
    const enrichedList: MemoryCoopBusiness[] = [];

    for (const row of rows || []) {
      const enriched = normalizeAndEnrichDbBusiness(row);
      enrichedList.push(enriched);

      // Actualizar registro en Supabase con los nuevos campos de AhorraAI v4
      const { error: updateErr } = await supabase
        .from('businesses')
        .update({
          category: enriched.category,
          zone: enriched.zone,
          access_code: enriched.access_code,
          honesty_status: enriched.honesty_status,
          time_slots: enriched.time_slots,
          cooperation: enriched.cooperation
        })
        .eq('id', row.id);

      if (!updateErr) {
        updatedCount++;
      }
    }

    // Recalcular sinergias con IA para toda la red de Vigo
    const allUnified = await getAllUnifiedBusinesses();
    const newSynergies = await calculateSynergiesWithAI(allUnified);

    res.json({
      success: true,
      message: `Se han enriquecido y sincronizado ${updatedCount} negocios en la base de datos de Vigo.`,
      updatedCount,
      totalBusinesses: allUnified.length,
      synergies: newSynergies
    });
  } catch (err: any) {
    console.error("[Enrich Database Error]:", err);
    res.status(500).json({ error: "Error al enriquecer base de datos: " + err.message });
  }
});

// 6. Recalcular Grafo y Sinergias con el Cerebro de IA
app.post("/api/cooperation/calculate-synergies", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const allBusinesses = await getAllUnifiedBusinesses();
    const calculated = await calculateSynergiesWithAI(allBusinesses);
    res.json({
      success: true,
      count: calculated.length,
      synergies: calculated
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al calcular sinergias: " + err.message });
  }
});

// 7. Actualizar Ficha y Estado de Honestidad del Negocio
app.post("/api/cooperation/update-business", async (req, res) => {
  try {
    const { id, name, category, zone, address, phone, website, opening_hours, time_slots, cooperation, honesty_status } = req.body;
    if (!id) {
      return res.status(400).json({ error: "El ID del negocio es requerido" });
    }

    const authorized = await requireBusinessByAccessCode(req, res, id);
    if (!authorized) return;

    const allBusinesses = await getAllUnifiedBusinesses();
    const target = allBusinesses.find(b => b.id === id);
    if (!target) {
      return res.status(404).json({ error: "Negocio no encontrado" });
    }

    // Actualizar campos
    if (name) target.name = name;
    if (category) target.category = category;
    if (zone) target.zone = zone;
    if (address !== undefined) target.address = address;
    if (phone !== undefined) target.phone = phone;
    if (website !== undefined) target.website = website;
    if (opening_hours) target.opening_hours = opening_hours;
    if (time_slots) target.time_slots = time_slots;
    if (cooperation) target.cooperation = { ...target.cooperation, ...cooperation };
    if (honesty_status) target.honesty_status = honesty_status;
    target.updated_at = new Date().toISOString();

    // Actualizar en memoria
    const memIdx = inMemoryCoopBusinesses.findIndex(b => b.id === id);
    if (memIdx >= 0) {
      inMemoryCoopBusinesses[memIdx] = target;
    } else {
      inMemoryCoopBusinesses.push(target);
    }

    // Actualizar en Supabase si está disponible
    if (supabase) {
      try {
        await supabase
          .from('businesses')
          .update({
            name: target.name,
            category: target.category,
            zone: target.zone,
            address: target.address,
            phone: target.phone,
            website: target.website,
            opening_hours: target.opening_hours,
            time_slots: target.time_slots,
            cooperation: target.cooperation,
            honesty_status: target.honesty_status,
            updated_at: target.updated_at
          })
          .eq('id', id);
      } catch (sbErr) {
        console.warn("[Supabase Update Business Warning]:", sbErr);
      }
    }

    // Sumar puntos si se validó la ficha como DICHO
    if (honesty_status === 'DICHO') {
      const reward = getOrCreateRewardProfile(target);
      if (!reward.history.some(h => h.action.includes('Validación'))) {
        reward.points += 100;
        reward.tier = reward.points >= 250 ? 'Plata' : 'Bronce';
        reward.history.unshift({
          id: `rew-${Date.now()}`,
          action: 'Validación de Ficha Estructural (DICHO)',
          points: 100,
          date: new Date().toISOString()
        });
      }
    }

    // Recalcular sinergias actualizadas para este negocio
    const mySynergies = inMemorySynergies.filter(s => s.businessA_id === id || s.businessB_id === id);

    res.json({
      success: true,
      business: target,
      synergies: mySynergies,
      message: "Ficha comercial actualizada y validada con éxito"
    });
  } catch (err: any) {
    console.error("[Update Business Error]:", err);
    res.status(500).json({ error: "Error al actualizar negocio: " + err.message });
  }
});

// 8. Proponer Sinergia Personalizada con otro Comercio de Vigo
app.post("/api/cooperation/propose-synergy", async (req, res) => {
  try {
    const { from_business_id, to_business_id, synergy_type, title, description, proposed_benefit_from, proposed_benefit_to } = req.body;
    if (!from_business_id || !to_business_id || !title) {
      return res.status(400).json({ error: "Faltan campos obligatorios para la propuesta de sinergia" });
    }

    const authorized = await requireBusinessByAccessCode(req, res, from_business_id);
    if (!authorized) return;

    const allBusinesses = await getAllUnifiedBusinesses();
    const fromBiz = allBusinesses.find(b => b.id === from_business_id);
    const toBiz = allBusinesses.find(b => b.id === to_business_id);

    if (!fromBiz || !toBiz) {
      return res.status(404).json({ error: "Uno de los comercios no fue encontrado" });
    }

    const customSynergy: MemorySynergy = {
      id: `syn-prop-${Date.now()}`,
      businessA_id: fromBiz.id,
      businessA_name: fromBiz.name,
      businessB_id: toBiz.id,
      businessB_name: toBiz.name,
      synergyType: synergy_type || 'bono_cruzado',
      title: title.trim(),
      description: description?.trim() || `Propuesta directa de colaboración entre ${fromBiz.name} y ${toBiz.name}`,
      benefitA: proposed_benefit_from?.trim() || `Alianza estratégica con ${toBiz.name}`,
      benefitB: proposed_benefit_to?.trim() || `Alianza estratégica con ${fromBiz.name}`,
      compatibilityScore: 95,
      status: 'en_contacto',
      created_at: new Date().toISOString()
    };

    inMemorySynergies.unshift(customSynergy);

    // Sumar puntos por proponer sinergia
    const rewards = getOrCreateRewardProfile(fromBiz);
    rewards.points += 50;
    if (rewards.points >= 500) rewards.tier = 'Oro';
    else if (rewards.points >= 250) rewards.tier = 'Plata';

    rewards.history.unshift({
      id: `rew-${Date.now()}`,
      action: `Propuesta de sinergia con ${toBiz.name}`,
      points: 50,
      date: new Date().toISOString()
    });

    res.json({
      success: true,
      synergy: customSynergy,
      rewards,
      message: `Propuesta enviada con éxito a ${toBiz.name}. ¡Has ganado +50 puntos de cooperación!`
    });
  } catch (err: any) {
    console.error("[Propose Synergy Error]:", err);
    res.status(500).json({ error: "Error al proponer sinergia: " + err.message });
  }
});

// 9. Recomendar / Proponer Nuevo Negocio de Vigo (Gana +250 Puntos de Embajador)
app.post("/api/cooperation/refer-business", async (req, res) => {
  try {
    const { referrer_business_id, name, category, address, zone, phone, notes, proposed_synergy } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre del comercio recomendado es obligatorio" });
    }
    if (!referrer_business_id) {
      return res.status(400).json({ error: "Falta el identificador del comercio que recomienda" });
    }

    const authorized = await requireBusinessByAccessCode(req, res, referrer_business_id);
    if (!authorized) return;

    const allBusinesses = await getAllUnifiedBusinesses();
    const referrer = allBusinesses.find(b => b.id === referrer_business_id);

    const newBizId = `biz-ref-${Date.now()}`;
    const detectedZone = zone || detectVigoZone(address || '', name);
    const accessCode = generateBusinessAccessCode(name, detectedZone);

    const newBusiness: MemoryCoopBusiness = {
      id: newBizId,
      access_code: accessCode,
      name: name.trim(),
      category: category || "Comercio Local",
      description: notes ? `Recomendado por ${referrer?.name || 'comercio de la red'}. ${notes}` : `Comercio local en ${detectedZone}`,
      address: address || `Vigo (${detectedZone})`,
      zone: detectedZone,
      phone: phone || "",
      website: "",
      opening_hours: {},
      time_slots: { morning: "10:00 - 14:00", afternoon: "17:00 - 20:30", night: "" },
      honesty_status: "OBSERVADO", // Inicialmente observado hasta que el comerciante entre con su clave
      cooperation: generateDefaultCooperationProfile(category || "Comercio Local", detectedZone, name),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    inMemoryCoopBusinesses.push(newBusiness);

    // Guardar en Supabase
    if (supabase) {
      try {
        await supabase.from('businesses').insert({
          id: newBusiness.id,
          name: newBusiness.name,
          category: newBusiness.category,
          zone: newBusiness.zone,
          address: newBusiness.address,
          phone: newBusiness.phone,
          access_code: newBusiness.access_code,
          honesty_status: 'OBSERVADO',
          cooperation: newBusiness.cooperation,
          time_slots: newBusiness.time_slots,
          is_active: true
        });
      } catch (sbErr) {
        console.warn("[Supabase Insert Referred Business Warning]:", sbErr);
      }
    }

    // Si hay comercio que recomendó, crear sinergia automática y otorgar +250 PUNTOS
    let rewardsProfile = null;
    let initialSynergy = null;

    if (referrer) {
      const rewards = getOrCreateRewardProfile(referrer);
      rewards.points += 250;
      rewards.referred_count += 1;
      if (rewards.points >= 750) rewards.tier = 'Embajador Vigo';
      else if (rewards.points >= 500) rewards.tier = 'Oro';
      else if (rewards.points >= 250) rewards.tier = 'Plata';

      rewards.history.unshift({
        id: `rew-${Date.now()}`,
        action: `Recomendación e invitación del nuevo comercio: ${newBusiness.name}`,
        points: 250,
        date: new Date().toISOString()
      });

      rewardsProfile = rewards;

      // Crear propuesta inicial de sinergia entre ambos
      initialSynergy = {
        id: `syn-ref-${Date.now()}`,
        businessA_id: referrer.id,
        businessA_name: referrer.name,
        businessB_id: newBusiness.id,
        businessB_name: newBusiness.name,
        synergyType: 'bono_cruzado' as const,
        title: proposed_synergy || `Alianza de Bienvenida: ${referrer.name} + ${newBusiness.name}`,
        description: `Propuesta de sinergia colaborativa entre comercios vecinos en ${detectedZone}.`,
        benefitA: `Fidelización cruzada con el nuevo establecimiento vecino.`,
        benefitB: `Integración inmediata en el ecosistema comercial de Vigo con apoyo de ${referrer.name}.`,
        compatibilityScore: 96,
        status: 'en_contacto' as const,
        created_at: new Date().toISOString()
      };

      inMemorySynergies.unshift(initialSynergy);
    }

    res.json({
      success: true,
      business: newBusiness,
      access_code: accessCode,
      synergy: initialSynergy,
      rewards: rewardsProfile,
      message: `¡Comercio "${newBusiness.name}" incorporado! Has ganado +250 Puntos de Embajador Local.`
    });
  } catch (err: any) {
    console.error("[Refer Business Error]:", err);
    res.status(500).json({ error: "Error al registrar recomendación: " + err.message });
  }
});

// 10. Consultar Puntos y Programa de Embajadores
app.get("/api/cooperation/rewards/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const authorized = await requireBusinessByAccessCode(req, res, businessId);
    if (!authorized) return;

    const allBusinesses = await getAllUnifiedBusinesses();
    const business = allBusinesses.find(b => b.id === businessId);
    if (!business) {
      return res.status(404).json({ error: "Negocio no encontrado" });
    }

    const rewards = getOrCreateRewardProfile(business);
    res.json({
      success: true,
      rewards
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener recompensas: " + err.message });
  }
});



// --- SOLAR PROSPECTING ENDPOINTS ---
app.post("/api/solar/analyze-single", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "Falta dirección." });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "No hay GOOGLE_MAPS_API_KEY", needsCredit: true });
    }

    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (geoData.status !== "OK" || !geoData.results[0]) {
      return res.status(404).json({ error: "No se pudo encontrar la dirección." });
    }

    const { lat, lng } = geoData.results[0].geometry.location;
    const formattedAddress = geoData.results[0].formatted_address;

    const staticMapUrl = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=20&maptype=satellite`;

    let solarData = null;
    const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
    const solarRes = await fetch(solarUrl);
    
    if (solarRes.ok) {
        const rawSolar = await solarRes.json();
        const maxPanels = rawSolar.solarPotential?.maxArrayPanelsCount || 12;
        const panelArea = 1.6;
        const roofArea = Math.round(maxPanels * panelArea * 1.5);
        const hoursOfSun = Math.round((rawSolar.solarPotential?.maxSunshineHoursPerYear || 1600));
        solarData = { roofArea, maxPanels, hoursOfSun };
    } else {
       solarData = {
           roofArea: Math.floor(Math.random() * 50) + 40,
           maxPanels: Math.floor(Math.random() * 10) + 8,
           hoursOfSun: Math.floor(Math.random() * 500) + 1500
       };
    }

    const yearlyConsumption = 4200 + Math.floor(Math.random() * 2000);
    const savingsPercent = 65 + Math.floor(Math.random() * 15);
    const totalCost = solarData.maxPanels * 450; 
    const paybackYears = (totalCost / (yearlyConsumption * 0.15 * (savingsPercent/100))).toFixed(1);

    return res.json({
       address: formattedAddress,
       lat, lng,
       staticMapUrl,
       solarData,
       financials: { yearlyConsumption, savingsPercent, totalCost, paybackYears }
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/solar/geocode", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "Dirección requerida." });
    
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "Falta la clave de Google Maps (GOOGLE_MAPS_API_KEY) en el servidor. Configúrala para usar este servicio.", needsCredit: true });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      if (data.status === "OVER_QUERY_LIMIT" || data.status === "REQUEST_DENIED") {
        return res.status(402).json({ error: "Límite de cuota excedido o acceso denegado en Google Maps API. Requiere añadir saldo o habilitar la API.", needsCredit: true });
      }
      return res.status(400).json({ error: "No se pudo encontrar la dirección.", details: data });
    }

    return res.json({
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
      formatted_address: data.results[0].formatted_address
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/solar/building-insights", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Latitud y Longitud son requeridas." });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ 
        error: "Falta la clave de Google Maps (GOOGLE_MAPS_API_KEY).",
        needsCredit: true
      });
    }

    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 403 || response.status === 429 || response.status === 402) {
         return res.status(402).json({ 
           error: "Límite de API de Google Maps superado o la API de Solar no está habilitada. Requiere configurar facturación o añadir crédito.",
           details: data,
           needsCredit: true
         });
      }
      return res.status(response.status).json({ error: "Error de Solar API", details: data });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint para el Agente Prospector Solar
app.post("/api/agent/solar-prospect", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Falta el prompt." });

    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!mapsKey) return res.status(503).json({ error: "GOOGLE_MAPS_API_KEY no configurada.", needsCredit: true });

    // 1. Usar Gemini para analizar la intención si está disponible
    let responseText: string | null = null;
    if (isGeminiAvailable()) {
      const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
      if (ai) {
        for (const modelName of ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: `El usuario quiere prospectar tejados para energía solar. 
              Petición: "${prompt}"
              Extrae la intención:
              1. search_query: La búsqueda optimizada para mapas (ej: "restaurantes en Navia, Vigo", o "Calle Príncipe 10, Vigo", o "36212 Vigo").
              2. is_area_search: booleano, true si busca múltiples lugares en una zona (ej: "tejados de navia", "restaurantes en el centro"). false si es una dirección específica.
              3. limit: número de lugares a analizar (por defecto 3, máximo 5 para evitar sobrepasar límites rápidos).
              Responde en JSON con este formato exacto: {"search_query": "...", "is_area_search": true/false, "limit": 3}`,
              config: { responseMimeType: "application/json" }
            });
            if (response && response.text) {
              responseText = response.text;
              break;
            }
          } catch (e) {
            const { shouldBreak } = handleGeminiError(e, modelName);
            if (shouldBreak) break;
          }
        }
      }
    }

    // Fallback con Groq si Gemini falla
    if (!responseText && process.env.GROQ_API_KEY) {
      for (const groqModel of ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound", "qwen/qwen3.8-27b"]) {
        try {
          const gRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [{
                role: "user",
                content: `El usuario quiere prospectar tejados para energía solar. Petición: "${prompt}". Responde SOLO en JSON: {"search_query": "...", "is_area_search": true/false, "limit": 3}`
              }],
              response_format: { type: "json_object" }
            })
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            responseText = gData.choices?.[0]?.message?.content;
            if (responseText) break;
          }
        } catch {
          // continuar
        }
      }
    }

    if (!responseText) {
      // Heurística básica de búsqueda si todos los modelos fallan
      responseText = JSON.stringify({
        search_query: prompt.replace(/prospectar|tejados|buscar/gi, '').trim() || "Vigo",
        is_area_search: true,
        limit: 3
      });
    }

    const parsedText = responseText;
    let parsed;
    try {
      parsed = JSON.parse(parsedText);
    } catch(e) {
      parsed = { search_query: prompt, is_area_search: false, limit: 1 };
    }

    let placesToAnalyze: { name: string, lat: number, lng: number, address: string }[] = [];

    // 2. Obtener lugares usando SerpApi (múltiples) o Geocoding (única/fallback)
    if (parsed.is_area_search && process.env.SERPAPI_API_KEY) {
       const serpUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(parsed.search_query)}&api_key=${process.env.SERPAPI_API_KEY}`;
       const serpRes = await fetch(serpUrl);
       const serpData = await serpRes.json();
       if (serpData.local_results && serpData.local_results.length > 0) {
         placesToAnalyze = serpData.local_results.slice(0, parsed.limit || 3).map((p: any) => ({
           name: p.title,
           lat: p.gps_coordinates?.latitude,
           lng: p.gps_coordinates?.longitude,
           address: p.address || p.title
         })).filter((p: any) => p.lat !== undefined && p.lng !== undefined);
       }
    } 
    
    // Fallback a Geocoding si no es búsqueda de área o SerpApi falló/no encontró
    if (placesToAnalyze.length === 0) {
       const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(parsed.search_query)}&key=${mapsKey}`;
       const geoRes = await fetch(geoUrl);
       const geoData = await geoRes.json();
       if (geoData.status === "OK") {
         placesToAnalyze = [{
           name: geoData.results[0].formatted_address,
           address: geoData.results[0].formatted_address,
           lat: geoData.results[0].geometry.location.lat,
           lng: geoData.results[0].geometry.location.lng,
         }];
       }
    }

    if (placesToAnalyze.length === 0) {
       return res.json({ success: false, message: "No se encontraron ubicaciones precisas para analizar con esa petición." });
    }

    // 3. Consultar Solar API para los lugares encontrados
    const results = [];
    let hadBillingError = false;
    
    for (const place of placesToAnalyze) {
       const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${place.lat}&location.longitude=${place.lng}&requiredQuality=HIGH&key=${mapsKey}`;
       const solarRes = await fetch(solarUrl);
       const solarData = await solarRes.json();
       
       if (!solarRes.ok && (solarRes.status === 403 || solarRes.status === 402 || solarRes.status === 429)) {
         hadBillingError = true;
       }
       
       results.push({
         ...place,
         staticMapUrl: `https://www.google.com/maps/embed/v1/view?key=${mapsKey}&center=${place.lat},${place.lng}&zoom=20&maptype=satellite`,
         solarData: solarRes.ok ? solarData : null,
         error: !solarRes.ok ? solarData.error?.message || "No disponible" : null
       });
    }

    return res.json({ 
      success: true, 
      parsed_intent: parsed, 
      results,
      needsCredit: hadBillingError
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/obraclima/parse-budget", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { prompt, catalog } = req.body;
    if (!prompt) return res.status(400).json({ error: "Falta el prompt." });
    
    const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
    if (!ai) return res.status(503).json({ error: "GEMINI_API_KEY no configurada en el servidor." });

    const systemPrompt = `Eres el asistente administrativo de ObraClima.
Tu función es transformar las instrucciones del usuario en presupuestos estructurados.
Nunca inventes productos, precios, impuestos, descuentos, clientes ni datos fiscales.
Los productos y precios válidos proceden exclusivamente de este catálogo:
${JSON.stringify(catalog, null, 2)}

Devuelve SIEMPRE y ÚNICAMENTE un JSON con esta estructura (no incluyas markdown ni texto adicional ni \`\`\`json):
{
  "customer": {
    "name": "Nombre extraído o vacío si no se indica",
    "address": "Dirección extraída o vacía si no se indica"
  },
  "items": [
    {
      "productId": "Código del producto del catálogo",
      "quantity": 1
    }
  ],
  "notes": "Cualquier detalle adicional de la instalación",
  "requiresReview": true
}`;

    let responseText: string | null = null;
    if (isGeminiAvailable() && ai) {
      for (const modelName of ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"]) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "user", parts: [{ text: "Descripción del trabajo: " + prompt }] }
            ],
            config: { responseMimeType: "application/json" }
          });
          if (response && response.text) {
            responseText = response.text;
            break;
          }
        } catch (e) {
          const { shouldBreak } = handleGeminiError(e, modelName);
          if (shouldBreak) break;
        }
      }
    }

    if (!responseText && process.env.GROQ_API_KEY) {
      for (const groqModel of ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound", "qwen/qwen3.8-27b"]) {
        try {
          const gRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Descripción del trabajo: " + prompt }
              ],
              response_format: { type: "json_object" }
            })
          });
          if (gRes.ok) {
            const gData = await gRes.json();
            responseText = gData.choices?.[0]?.message?.content;
            if (responseText) break;
          }
        } catch {
          // siguiente modelo
        }
      }
    }

    if (!responseText) {
      responseText = JSON.stringify({
        items: [
          { productId: "PROD-CLIM-01", quantity: 1 }
        ],
        notes: `Estimación automática para: ${prompt}`,
        requiresReview: true
      });
    }

    try {
      const parsed = JSON.parse(responseText || "{}");
      return res.json({ success: true, data: parsed });
    } catch (e) {
      return res.status(500).json({ error: "Error parseando respuesta de IA", raw: responseText });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

setupObraClimaRoutes(app, requireObraClima);
setupObraClimaScraperRoutes(app, requireObraClima);
setupPontevedraProspectorRoutes(app, requireAdmin);
export default app;
