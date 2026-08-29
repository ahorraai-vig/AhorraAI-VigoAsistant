import { eventsService, mobilityService, catalogService, alertsService, geoService, tourismService } from './services/vigo';

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
    serpApi: !!process.env.SERPAPI_API_KEY,
    groq: !!process.env.GROQ_API_KEY
  });
});

// Endpoint para obtener información y enlace del Bot de Telegram
app.get("/api/telegram/info", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.json({ configured: false, username: null, url: null });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const tgData = await tgRes.json();
    if (tgData.ok && tgData.result?.username) {
      return res.json({
        configured: true,
        username: tgData.result.username,
        first_name: tgData.result.first_name,
        url: `https://t.me/${tgData.result.username}`
      });
    }
    return res.json({ configured: true, username: null, url: null });
  } catch (error) {
    console.error("[Telegram getMe Error]:", error);
    return res.json({ configured: true, username: null, url: null });
  }
});

// --- Servicios de IA (Gemini con Fallback a Groq) ---

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

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Sin respuesta";
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

async function generateAIResponse(formattedMessages: Array<{ role: string; content: string }>, systemInstruction: string): Promise<string> {
  // 1. Intentar primero con Gemini
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: formattedMessages.map(m => ({
          role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction,
          tools: vigoTools,
        }
      });
      if (response.text) {
        return response.text;
      }
    } catch (geminiError: any) {
      console.warn("[Gemini API Warning]: Falló Gemini (posible límite de cuota o error). Intentando fallback a Groq...", geminiError?.message || geminiError);
    }
  }

  // 2. Intentar fallback con Groq
  if (process.env.GROQ_API_KEY) {
    try {
      console.log("[AI Service]: Ejecutando consulta con Groq como fallback...");
      return await callGroqChat(formattedMessages, systemInstruction);
    } catch (groqError: any) {
      console.error("[Groq API Error]:", groqError);
      throw groqError;
    }
  }

  throw new Error("No hay proveedores de IA disponibles o las claves han alcanzado sus límites.");
}

// --- Telegram Bot Engine (Long Polling + Webhook) ---

const telegramChatMemory = new Map<number, Array<{ role: string; content: string }>>();

async function sendTelegramMessage(token: string, chatId: number | string, text: string) {
  try {
    // Si el texto es muy largo, cortarlo en trozos de 4000 caracteres
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

    for (const chunk of chunks) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          disable_web_page_preview: false
        })
      });
    }
  } catch (err) {
    console.error("[Telegram SendMessage Error]:", err);
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

async function handleTelegramIncomingMessage(token: string, message: any) {
  if (!message || !message.chat || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text.trim();
  const userName = message.from?.first_name || 'Amigo/a';

  console.log(`[Telegram Bot] Mensaje recibido de ${userName} (${chatId}): ${userText}`);

  if (userText === '/start' || userText === '/reiniciar' || userText.toLowerCase() === 'hola') {
    // Reset memory for this chat
    telegramChatMemory.set(chatId, []);
    
    const welcomeMsg = `¡Boas, ${userName}! 🌊⚓

Soy el **Asistente Inteligente de Vigo** (AhorraAI). Estoy aquí para ayudarte a descubrir lo mejor de la ciudad:

🍽️ **Dónde comer o tomar algo**: Tapas, marisquerías, terrazas, vinos y cafeterías.
🏬 **Comercio Local**: Farmacias, zapaterías, tiendas y servicios de la red local.
🌅 **Miradores y Naturaleza**: O Castro, Samil, Guixar, Cangas o las Islas Cíes.
🏛️ **Historia y Cultura**: Casco Vello, Porta do Sol, sirenos y tradiciones viguesas.

¿Qué te gustaría buscar o conocer hoy en Vigo?`;

    await sendTelegramMessage(token, chatId, welcomeMsg);
    return;
  }

  // Notificar al usuario que el bot está pensando
  await sendTelegramTyping(token, chatId);

  try {
    // 1. Buscar en la base de datos de comercios locales
    const localCandidates = await getRelevantLocalBusinesses(userText);
    let localDatabaseResultsText = "No relevant local database results.";
    let externalSerpapiResultsText = "No external results fetched.";

    if (localCandidates.length > 0) {
      localDatabaseResultsText = localCandidates.map(b => 
        `- Nombre: ${b.name}\n  Descripción/Categoría: ${b.description || 'N/A'}\n  Dirección: ${b.address || 'N/A'}\n  Teléfono: ${b.phone || 'N/A'}\n  Web: ${b.website || 'N/A'}\n  Imagen: ${b.cooperation?.image_url || 'N/A'}\n  Source: local_database`
      ).join('\n\n');
    } else {
      // 2. Si no hay candidatos locales, consultar SerpAPI
      const isGeneral = userText.toLowerCase().includes('historia') || userText.toLowerCase().includes('quién');
      const searchTerms = userText + (isGeneral ? "" : " en Vigo");
      
      const externalResults = isGeneral 
        ? await serpapiService.searchWeb(searchTerms) 
        : await serpapiService.searchLocal(searchTerms);
        
      if (externalResults && Array.isArray(externalResults) && externalResults.length > 0) {
        externalSerpapiResultsText = externalResults.slice(0, 5).map((r: any) => 
          `- Nombre/Título: ${r.title || r.name}\n  Descripción/Tipo: ${r.type || r.snippet || 'N/A'}\n  Dirección: ${r.address || 'N/A'}\n  Teléfono: ${r.phone || 'N/A'}\n  Web: ${r.links?.website || r.link || 'N/A'}\n  Source: serpapi_${isGeneral ? 'web' : 'local'}`
        ).join('\n\n');
      }
    }

    const systemInstruction = `Eres el "Asistente Vigo", el asistente inteligente oficial, turístico y comercial de la ciudad de Vigo (Galicia).
Tu tono es cálido, cercano, profesional y con un agradable toque vigués/gallego (sin exagerar).

CONTEXTO DE VIGO Y DATOS EN TIEMPO REAL:
LOCAL_DATABASE_RESULTS (Prioridad #1 - Red de Comercios Locales de Vigo):
${localDatabaseResultsText}

EXTERNAL_SERPAPI_RESULTS (Prioridad #2 - Resultados en la ciudad):
${externalSerpapiResultsText}

REGLAS OBLIGATORIAS:
1. Recomienda con máxima prioridad los comercios y locales de la red cooperativa local si coinciden con la consulta.
2. Si recomiendas un lugar, incluye su nombre en negrita, dirección, teléfono o enlace si están disponibles.
3. Sé conciso y claro, con formato adecuado para Telegram (emojis, listas y negritas).
4. No inventes datos que no estén confirmados.`;

    // Obtener historial previo de la conversación en Telegram
    let chatHistory = telegramChatMemory.get(chatId) || [];
    chatHistory.push({ role: 'user', content: userText });
    
    // Mantener sólo los últimos 10 mensajes
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
    }

    const aiReply = await generateAIResponse(chatHistory, systemInstruction);

    // Guardar respuesta en memoria
    chatHistory.push({ role: 'model', content: aiReply });
    telegramChatMemory.set(chatId, chatHistory);

    // Enviar respuesta al chat de Telegram
    await sendTelegramMessage(token, chatId, aiReply);
  } catch (err: any) {
    console.error("[Telegram Processing Error]:", err);
    await sendTelegramMessage(token, chatId, "Disculpa, ha ocurrido un pequeño error al consultar el asistente. Por favor vuelve a preguntarme en un instante.");
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
  } catch (e) {
    console.warn("[Telegram] Error al limpiar webhook inicial:", e);
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
              // Manejar mensaje sin bloquear el bucle de polling
              handleTelegramIncomingMessage(token, update.message).catch(e => 
                console.error("[Telegram Error handling message]:", e)
              );
            }
          }
        }
      } catch (err: any) {
        // En caso de timeout normal o corte temporal de conexión
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
    if (update && update.message) {
      handleTelegramIncomingMessage(token, update.message).catch(console.error);
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
        if (ai) {
          const resp = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { temperature: 0.3 }
          });
          aiText = resp.text || "";
        } else if (process.env.GROQ_API_KEY) {
          aiText = await callGroqChat([{ role: 'user', content: prompt }], "Eres un analista comercial de Vigo.");
        }

        const cleanedJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
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

// --- Endpoint Chat Web ---

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, config } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensajes inválidos." });
    }

    const lastMessage = messages[messages.length - 1].text;
    
    // --- VIGO INTELLIGENCE LAYER ---
    const lowerMessage = lastMessage.toLowerCase();
    let vigoContextText = "Sin datos de contexto adicionales del Concello de Vigo.";
    const isEvents = lowerMessage.match(/hoy|evento|concierto|hacer|agenda|cultura/);
    const isParking = lowerMessage.match(/aparc|parking|coche/);
    const isTraffic = lowerMessage.match(/tráfico|trafico|atasco|coche/);
    const isBus = lowerMessage.match(/bus|vitrasa|parada|transporte/);
    
    const vigoContextParts = [];
    
    if (isParking) {
       const pData = await mobilityService.getParkingStatus();
       if (pData.healthy && pData.data) {
          vigoContextParts.push(`[PARKING EN TIEMPO REAL - Actualizado: ${pData.retrieved_at} | Fuente: ${pData.source}]:\n` + JSON.stringify(Array.isArray(pData.data) ? pData.data.slice(0, 10) : pData.data).substring(0, 500));
       } else {
          vigoContextParts.push(`[PARKING EN TIEMPO REAL]: No tengo datos actualizados de parking en este momento.`);
       }
    }
    
    if (isTraffic) {
       const tData = await mobilityService.getTrafficStatus();
       if (tData.healthy && tData.data) {
          vigoContextParts.push(`[TRÁFICO EN TIEMPO REAL - Actualizado: ${tData.retrieved_at} | Fuente: ${tData.source}]:\n` + JSON.stringify(Array.isArray(tData.data) ? tData.data.slice(0, 5) : tData.data).substring(0, 500));
       }
       const alertsData = await mobilityService.getTrafficAlerts();
       if (alertsData.healthy && alertsData.data) {
          vigoContextParts.push(`[AVISOS DE TRÁFICO - Actualizado: ${alertsData.retrieved_at} | Fuente: ${alertsData.source}]:\n` + JSON.stringify(Array.isArray(alertsData.data) ? alertsData.data.slice(0, 5) : alertsData.data).substring(0, 500));
       }
    }
    
    if (isEvents) {
       const eData = await eventsService.getEvents();
       if (eData.healthy && eData.data) {
          vigoContextParts.push(`[AGENDA CULTURAL - Actualizado: ${eData.retrieved_at} | Fuente: ${eData.source}]:\n` + JSON.stringify(Array.isArray(eData.data) ? eData.data.slice(0, 5) : eData.data).substring(0, 500));
       } else {
          vigoContextParts.push(`[AGENDA CULTURAL]: No tengo datos actualizados de la agenda en este momento.`);
       }
    }
    
    if (vigoContextParts.length > 0) {
        vigoContextText = vigoContextParts.join('\n\n');
    }
    // -------------------------------

    
    let localDatabaseResultsText = "No relevant local database results.";
    let externalSerpapiResultsText = "No external results fetched.";
    
    // 1. Buscar en Supabase
    const localCandidates = await getRelevantLocalBusinesses(lastMessage);

    let synergiesText = "No hay sinergias ni packs activos en este momento.";
    if (inMemorySynergies.length > 0) {
      const candidateIds = new Set(localCandidates.map(b => b.id));
      const relevantSynergies = inMemorySynergies.filter(s => candidateIds.has(s.businessA_id) || candidateIds.has(s.businessB_id));
      
      const synergiesToUse = relevantSynergies.length > 0 ? relevantSynergies : inMemorySynergies.slice(0, 5);
      
      if (synergiesToUse.length > 0) {
        synergiesText = synergiesToUse.map(s => 
          `- [Pack / Sinergia]: ${s.title}\n  Participantes: ${s.businessA_name} y ${s.businessB_name}\n  Descripción: ${s.description}`
        ).join('\n\n');
      }
    }

    if (localCandidates.length > 0) {
      localDatabaseResultsText = localCandidates.map(b => 
        `- Nombre: ${b.name}\n  Descripción/Categoría: ${b.description || 'N/A'}\n  Dirección: ${b.address || 'N/A'}\n  Teléfono: ${b.phone || 'N/A'}\n  Web: ${b.website || 'N/A'}\n  Imagen: ${b.cooperation?.image_url || 'N/A'}\n  Source: local_database`
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
- Tipo de usuario: ${config?.userType === 'local' ? 'Residente / Local' : (config?.userType === 'business' ? 'Comercio Local' : 'Turista / Visita')}
- Tiempo disponible: ${config?.timeAvailable || 'No especificado'}
- Intereses: ${config?.interests?.join(', ') || 'No especificado'}
- Idioma preferido: ${config?.language || 'Español'}

CONTEXTO ESTRUCTURADO DE NEGOCIOS Y SERVICIOS:

LOCAL_DATABASE_RESULTS (Prioridad #1 - Red Local Cooperativa):
${localDatabaseResultsText}

EXTERNAL_SERPAPI_RESULTS (Prioridad #2 - Resultados Externos):
${externalSerpapiResultsText}

OFERTAS CRUZADAS Y PACKS ACTIVOS EN VIGO (Sinergias):
${synergiesText}

VIGO_CONTEXT (Datos oficiales del Concello de Vigo – Prioridad #1.5):
${vigoContextText}

REGLAS ADICIONALES PARA VIGO_CONTEXT:
- Usa estos datos cuando aporten valor real (eventos, parking libre, tráfico, avisos, transporte).
- Cruza siempre con LOCAL_DATABASE_RESULTS y sinergias cuando sea posible.
- Ejemplo de respuesta potente: "Hoy hay concierto en X a las 21:00. Parking Urzáiz tiene 42 plazas libres (actualizado hace 2 min). Tráfico moderado. Te recomiendo [negocio de la red] a 5 min andando + pack con Y."
- Nunca inventes datos que no vengan en VIGO_CONTEXT.
- Indica siempre la fuente y la hora de actualización cuando uses datos dinámicos.
- Si un feed está unhealthy, dilo ("No tengo datos actualizados de parking en este momento").

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
10. ¡MUY IMPORTANTE! Tienes a tu disposición la sección "OFERTAS CRUZADAS Y PACKS ACTIVOS". Si el usuario pregunta por algo relacionado con esos negocios o perfiles (ej. si es turista, o si busca gimnasios, farmacias, restaurantes...), DEBES proponerle proactivamente ese "pack" o "bono cruzado". Ej: "Por cierto, si vas a X, tienen un pack especial con Y que incluye...". Esto da visibilidad a la red cooperativa de la ciudad.

REGLAS DE FORMATO Y PRESENTACIÓN VISUAL (ESTRICTAS):
Cuando recomiendes uno o más negocios, DEBES presentarlos de manera muy atractiva y estructurada, usando Markdown, emojis y separadores.
Para CADA negocio que recomiendes, aplica exactamente esta estructura (y evita siempre usar tablas):

### 🏪 [Nombre del Negocio]
*Una frase corta y atractiva describiendo por qué lo recomiendas.*
- 📍 **Dirección:** [[Dirección]](https://www.google.com/maps/search/?api=1&query=DIRECCION_DEL_NEGOCIO+VIGO)
- 🌐 **Web:** [Enlace a la web si existe, ej: [Visitar Web](URL)]
- 🗺️ **Google Maps:** [Cómo llegar](https://www.google.com/maps/search/?api=1&query=NOMBRE+DEL+NEGOCIO+VIGO)
- 📞 **Teléfono:** [[Teléfono si está disponible]](tel:NUMERO_AQUI)

*(Si el negocio tiene una URL de Imagen válida en los datos que te paso, muéstrala aquí usando markdown: ![Foto](URL))*

*(Añade un breve párrafo extra aquí si este negocio tiene un Pack/Sinergia activo, destacándolo con un emoji 🎁)*

--- 

Asegúrate de que los enlaces sean clickeables en Markdown. NUNCA uses tablas para listar negocios, usa siempre esta estructura visual vertical y clara.
`;

    const formattedMessages = messages.map((m: any) => ({
      role: m.isBot ? 'model' : 'user',
      content: m.text
    }));

    const text = await generateAIResponse(formattedMessages, systemInstruction);
    res.json({ text });
  } catch (e: any) {
    console.error("[Chat API Error]:", e);
    res.status(500).json({ error: "Error de comunicación con el asistente. " + (e?.message || "") });
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

// Función para generar código de acceso único
function generateBusinessAccessCode(name: string, zone?: string): string {
  const prefix = "VIGO";
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const cleanZone = (zone || name).replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase() || "COMM";
  return `${prefix}-${randomNum}-${cleanZone}`;
}

// Normalizador y enriquecedor para cualquier registro de negocio (Supabase o memoria)
function normalizeAndEnrichDbBusiness(row: any): MemoryCoopBusiness {
  const name = (row.name || 'Comercio Local').trim();
  const address = row.address || '';
  const description = row.description || '';
  const category = row.category || normalizeVigoCategory(row.type, name, description);
  const zone = row.zone || detectVigoZone(address, name);
  const access_code = row.access_code || generateBusinessAccessCode(name, zone || address);
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
        for (const row of data) {
          const enriched = normalizeAndEnrichDbBusiness(row);
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
    // Tomamos una muestra balanceada de 20 negocios de diferentes sectores
    const sampleBusinesses = businesses.slice(0, 25).map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      zone: b.zone,
      idleCapacity: b.cooperation?.idleCapacity || [],
      offers: b.cooperation?.offers || [],
      needs: b.cooperation?.needs || [],
      valleyHours: b.cooperation?.valleyHours || ''
    }));

    const prompt = `Eres el cerebro de Inteligencia Artificial del ecosistema "AhorraAI v4" en Vigo.
Genera entre 6 y 12 sinergias comerciales INNOVADORAS Y RENTABLES cruzando los siguientes comercios de Vigo:
${JSON.stringify(sampleBusinesses, null, 2)}

Devuelve EXCLUSIVAMENTE un JSON array con esta estructura:
[
  {
    "businessA_id": "id",
    "businessA_name": "nombre",
    "businessB_id": "id",
    "businessB_name": "nombre",
    "synergyType": "bono_cruzado",
    "title": "Título",
    "description": "Detalle",
    "benefitA": "Beneficio A",
    "benefitB": "Beneficio B",
    "compatibilityScore": 92
  }
]`;

    let generatedText = "";
    if (ai) {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.2 }
      });
      generatedText = resp.text || "";
    } else if (process.env.GROQ_API_KEY) {
      generatedText = await callGroqChat([{ role: 'user', content: prompt }], "Eres un consultor experto en alianzas comerciales locales.");
    }

    const cleanedJson = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
    if (cleanedJson.startsWith('[')) {
      const parsed = JSON.parse(cleanedJson);
      if (Array.isArray(parsed)) {
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
    console.warn("[AI Enhanced Synergy Generation Notice]:", err);
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

    const businessId = body.id || `biz-${Date.now()}`;
    const accessCode = body.access_code || generateBusinessAccessCode(body.name, body.zone || body.address);

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

    // Actualizar o insertar en memoria
    const existingIndex = inMemoryCoopBusinesses.findIndex(b => b.id === businessId || b.access_code === accessCode);
    if (existingIndex >= 0) {
      inMemoryCoopBusinesses[existingIndex] = { ...inMemoryCoopBusinesses[existingIndex], ...newBusiness, updated_at: new Date().toISOString() };
    } else {
      inMemoryCoopBusinesses.unshift(newBusiness);
    }

    // Guardar en Supabase con todos los campos estructurados
    if (supabase) {
      try {
        await supabase.from('businesses').upsert({
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
    const allBusinesses = await getAllUnifiedBusinesses();
    const business = allBusinesses.find(b => b.access_code.toUpperCase() === cleanCode);

    if (!business) {
      return res.status(404).json({ error: "No se encontró ningún negocio con esa clave de acceso. Verifica el código o regístrate." });
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
    business,
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

    res.json({
      businesses: allBusinesses,
      synergies: inMemorySynergies
    });
  } catch (err: any) {
    console.error("[Cooperation All Error]:", err);
    res.json({
      businesses: inMemoryCoopBusinesses,
      synergies: inMemorySynergies
    });
  }
});

// 5. Endpoint de Auto-Enriquecimiento masivo de todos los negocios en Supabase
app.post("/api/cooperation/enrich-database", async (req, res) => {
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

export default app;

