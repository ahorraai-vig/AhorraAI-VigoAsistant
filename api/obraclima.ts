import { GoogleGenAI } from "@google/genai";
import { isGeminiAvailable, handleGeminiError } from "./geminiBreaker";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  generateBudgetPdfBuffer,
  uploadPdfToSupabaseStorage,
  generateCourtesyTextWithGemini,
  sendOfficialEmailWithNativePdfAttachment
} from "./obraclima_pdf_mailer";
import { setupObraClimaScraperRoutes, inMemoryProspeccion } from "./obraclima_scraper";
import {
  getConfig as repoGetConfig,
  updateConfig,
  getClients as repoGetClients,
  getClientById as repoGetClientById,
  createClient as repoCreateClient,
  getOfficialCatalog,
  createOfficialCatalogItem,
  getProspectedCatalog,
  getBudgets as repoGetBudgets,
  getBudgetById as repoGetBudgetById,
  createBudget as repoCreateBudget,
  updateBudget as repoUpdateBudget,
  convertBudgetToInvoice as repoConvertBudgetToInvoice,
  getInvoices as repoGetInvoices,
  getInvoiceById as repoGetInvoiceById,
  createInvoice as repoCreateInvoice
} from "../server/services/obraclima/repo";
import { resolveProductCard, cacheProductImageOnDemand } from "../server/services/obraclima/productCardPolicy";

// Helper to initialize Supabase client for secure backend operations
export function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '')?.replace(/\/$/, '') || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    return createClient(supabaseUrl, supabaseKey);
  }
  return null;
}

// Secure client resolver: fetches customer PII from Supabase (or fallback local DB) in backend only
export async function getClientById(clientId: string) {
  return (await repoGetClientById(clientId)) || {
    id: "c-default",
    name: "Cliente Particular",
    address: "Vigo",
    postalCode: "36200",
    city: "Vigo",
    province: "Pontevedra",
    nif: ""
  };
}

// === IN-MEMORY DATABASE ===
export const db = {
  config: {
    companyName: "OBRA-CLIMA S.L.",
    address: "RÚA ESCULTOR NOGUEIRA, Nº 4-BAJO",
    postalCode: "36205",
    city: "VIGO",
    province: "PONTEVEDRA",
    nif: "B75571059",
    phone: "+34 986 000 000",
    email: "info@obraclima.es",
    iban: "ES39 2080 5025 3130 4004 4857",
    paymentMethod: "Transferencia Bancaria.",
    defaultIva: 21,
    invoiceSeries: "2026",
    nextInvoiceNumber: 29,
    budgetSeries: "2026",
    nextBudgetNumber: 49
  },
  clients: [
    { id: "c1", name: "Mari Carmen Alonso Vicente", address: "C/ Julio Xesto nº 2, Segundo C", postalCode: "36770", city: "O Rosal", province: "Pontevedra", nif: "76891822Q" },
    { id: "c2", name: "Iria Dominguez Valladares", address: "Rua Pastoriza 12", postalCode: "36900", city: "Marin", province: "Pontevedra", nif: "77417846F" }
  ],
  catalog: [
    { id: "AC001", code: "AC001", name: "Instalación split básico con canaleta y soportes", category: "Instalación", unit: "ud", price: 180, iva: 21 },
    { id: "EQ001", code: "EQ001", name: "Suministro de 2 maquinas de aire acondicionado marca FREEO de 3,5 kw y 5 kw", category: "Equipos", unit: "ud", price: 1500, iva: 21 },
    { id: "SRV001", code: "SRV001", name: "Mantenimiento preventivo anual de equipos de climatización", category: "Servicios", unit: "ud", price: 120, iva: 21 },
    { id: "EQ002", code: "EQ002", name: "Split Daikin Sensira 3.5 kW frío/calor A++", category: "Equipos", unit: "ud", price: 650, iva: 21 },
    { id: "MAT001", code: "MAT001", name: "Línea frigorífica de cobre aislado y cableado hasta 5m", category: "Material", unit: "ml", price: 45, iva: 21 }
  ],
  budgets: [
    {
      id: "b-demo-1",
      number: "048/26",
      date: new Date(Date.now() - 86400000 * 3).toISOString(),
      status: "Aprobado",
      client: { id: "c1", name: "Mari Carmen Alonso Vicente", address: "C/ Julio Xesto nº 2, Segundo C", postalCode: "36770", city: "O Rosal", province: "Pontevedra", nif: "76891822Q" },
      items: [
        { description: "Suministro de 2 maquinas de aire acondicionado marca FREEO de 3,5 kw y 5 kw", quantity: 1, unitPrice: 1500 },
        { description: "Instalación split básico con canaleta y soportes", quantity: 2, unitPrice: 180 }
      ],
      subtotal: 1860,
      tax: 390.6,
      total: 2250.6,
      notes: "Instalación en salón y dormitorio. Incluye prueba de estanqueidad y vacío."
    }
  ] as any[],
  invoices: [] as any[]
};

// === HELPER FUNCTIONS FOR OBRACLIMA & TELEGRAM ===

export async function getBudgets() {
  return await repoGetBudgets();
}

export async function getBudgetById(id: string) {
  return await repoGetBudgetById(id);
}

export async function getInvoices() {
  return await repoGetInvoices();
}

export async function getInvoiceById(id: string) {
  return await repoGetInvoiceById(id);
}

export async function getClients() {
  return await repoGetClients();
}

export async function getCatalog() {
  return await getOfficialCatalog();
}

export async function getConfig() {
  return await repoGetConfig();
}

export async function createBudget(data: any) {
  return await repoCreateBudget(data);
}

export async function convertBudgetToInvoice(budgetId: string) {
  return await repoConvertBudgetToInvoice(budgetId);
}

// === RGPD / GDPR SANITIZATION & PSEUDONYMIZATION ===
/**
 * Scans and strips any Personally Identifiable Information (PII)
 * (names, DNI/NIE/CIF, phone numbers, emails, postal addresses)
 * before any prompt text is transmitted to an external LLM.
 */
export function sanitizePromptForAi(rawText: string): { sanitizedPrompt: string; hasPiiDetected: boolean } {
  let sanitized = rawText;
  let detected = false;

  // 1. Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
  if (emailRegex.test(sanitized)) {
    detected = true;
    sanitized = sanitized.replace(emailRegex, '[CORREO_SEUDONIMIZADO]');
  }

  // 2. Spanish DNI / NIE / CIF
  const dniNieCifRegex = /\b([XYZxyz]?\d{7,8}[A-Za-z]|[ABCDEFGHJNPQRSUVWabcdefghjnpqrsuvw]\d{7}[0-9A-Ja-j])\b/g;
  if (dniNieCifRegex.test(sanitized)) {
    detected = true;
    sanitized = sanitized.replace(dniNieCifRegex, '[NIF_SEUDONIMIZADO]');
  }

  // 3. Spanish Phone Numbers (mobile & landline)
  const phoneRegex = /\b(?:\+?34\s*)?[6789]\d{2}(?:[\s.-]?\d{3}){2}\b/g;
  if (phoneRegex.test(sanitized)) {
    detected = true;
    sanitized = sanitized.replace(phoneRegex, '[TEL_SEUDONIMIZADO]');
  }

  // 4. Street / Postal Addresses (Calle, Rúa, Avda, etc.)
  const addressRegex = /\b(?:calle|c\/|rúa|rua|avenida|avda|av\.|plaza|pza\.|paseo|camino|carretera|crta\.)\s+[^,;\n]+/gi;
  if (addressRegex.test(sanitized)) {
    detected = true;
    sanitized = sanitized.replace(addressRegex, '[UBICACION_TECNICA]');
  }

  // 5. Client name phrases (e.g. "para Juan Pérez", "cliente: María Gomez")
  const clientPhraseRegex = /\b(?:para|cliente|nombre(?:\s+del?\s+cliente)?|de(?:\s+parte\s+de)?)\s*[:=]?\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){1,3})/gi;
  if (clientPhraseRegex.test(sanitized)) {
    detected = true;
    sanitized = sanitized.replace(clientPhraseRegex, 'para [CLIENTE_SEUDONIMIZADO]');
  }

  return { sanitizedPrompt: sanitized.trim(), hasPiiDetected: detected };
}

// Heuristic fallback parser when AI APIs are unavailable or encounter rate/permission limits
function parseBudgetWithHeuristics(sanitizedPrompt: string, fullBrainCatalog: any[]): { items: any[]; notes: string } {
  const promptLower = sanitizedPrompt.toLowerCase();
  const items: any[] = [];

  // Detect quantity (e.g. "2 splits", "3 unidades", "1 máquina")
  const splitMatch = promptLower.match(/(\d+)\s*(?:splits?|equipos?|m[aá]quinas?|unidades?)/i);
  const splitQty = splitMatch ? Math.max(1, parseInt(splitMatch[1], 10)) : 1;

  // Detect meters of pipe (e.g. "8 metros", "15m")
  const pipeMatch = promptLower.match(/(\d+)\s*(?:metros?|m(?:\s|$|de))/i);
  const pipeMeters = pipeMatch ? Math.max(3, parseInt(pipeMatch[1], 10)) : 5;

  // Match catalog items if brands/keywords match
  let matchedCatalogItem = null;
  if (promptLower.includes('daikin')) {
    matchedCatalogItem = fullBrainCatalog.find(c => (c.name || c.description || '').toLowerCase().includes('daikin'));
  } else if (promptLower.includes('mitsubishi')) {
    matchedCatalogItem = fullBrainCatalog.find(c => (c.name || c.description || '').toLowerCase().includes('mitsubishi'));
  } else if (promptLower.includes('fujitsu')) {
    matchedCatalogItem = fullBrainCatalog.find(c => (c.name || c.description || '').toLowerCase().includes('fujitsu'));
  } else if (promptLower.includes('panasonic')) {
    matchedCatalogItem = fullBrainCatalog.find(c => (c.name || c.description || '').toLowerCase().includes('panasonic'));
  }

  if (matchedCatalogItem) {
    items.push({
      code: matchedCatalogItem.code || matchedCatalogItem.sku || 'EQ-CLIM-01',
      description: matchedCatalogItem.name || matchedCatalogItem.description,
      quantity: splitQty,
      unitPrice: Number(matchedCatalogItem.unitPrice || matchedCatalogItem.precio) || 850
    });
  } else {
    items.push({
      code: 'EQ-SPLIT-INVERTER',
      description: `Equipo Split Climatización Bomba de Calor Inverter A++ (3.000 frig/h)`,
      quantity: splitQty,
      unitPrice: 680
    });
  }

  // Installation labor
  items.push({
    code: 'MO-INSTAL-CLIM',
    description: 'Mano de obra especializada instalación, conexionado frigorífico y puesta en marcha',
    quantity: splitQty,
    unitPrice: 195
  });

  // Copper pipes & electrical wiring
  items.push({
    code: 'MAT-TUB-COBRE',
    description: `Línea frigorífica doble de cobre deshidratado aislado 1/4"-3/8" y cableado (${pipeMeters} m)`,
    quantity: pipeMeters,
    unitPrice: 22
  });

  // Mounts / brackets
  items.push({
    code: 'MAT-SOPORTE-EXT',
    description: 'Juego de escuadras soporte exterior reforzadas con tacos antivibratorios silentblock',
    quantity: splitQty,
    unitPrice: 45
  });

  // Condensate drain
  items.push({
    code: 'MAT-DESAGUE',
    description: 'Línea de desagüe de condensados en PVC flexible con sifón antirretorno',
    quantity: 1,
    unitPrice: 30
  });

  const notes = `Presupuesto técnico estimado conforme a especificaciones: "${sanitizedPrompt}". Incluye vacío con bomba de doble efecto, comprobación de estanqueidad bajo presión de nitrógeno seco, verificación de presiones reglamentarias y garantía oficial ObraClima S.L.`;

  return { items, notes };
}

// Fallback to Groq API when Gemini has quota or permission limits
async function callGroqBudgetParser(systemPrompt: string, sanitizedPrompt: string): Promise<{ items: any[]; notes: string } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const candidateModels = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "groq/compound",
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile"
  ];

  for (const model of candidateModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Especificaciones técnicas de obra: ${sanitizedPrompt}` }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            console.log(`[ObraClima parse-text] Desglose generado con éxito vía Groq (${model}):`, parsed.items.length, "partidas.");
            return {
              items: parsed.items,
              notes: typeof parsed.notes === 'string' ? parsed.notes : ''
            };
          }
        }
      } else {
        console.warn(`[Groq Fallback Warning] Modelo ${model} respondió con código ${res.status}`);
      }
    } catch (e: any) {
      console.warn(`[Groq Fallback Warning] Error con modelo ${model}:`, e.message);
    }
  }

  return null;
}

// AI Technical Parsing logic with strict RGPD decoupling (reusable by Express and Telegram bot)
export async function parseBudgetWithAi(promptText: string) {
  // Pre-filter prompt to eliminate any PII before it leaves the backend
  const { sanitizedPrompt } = sanitizePromptForAi(promptText);

  // Combinar catálogo oficial con productos y referencias recopiladas de prospección (Cerebro ObraClima) desde el repo
  const [officialCatalog, prospectedRaw] = await Promise.all([
    getOfficialCatalog(),
    getProspectedCatalog()
  ]);

  const prospectedItems = prospectedRaw.slice(0, 50).map(p => ({
    code: p.sku || `PROV-${(p.nombre || 'ITEM').slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
    category: p.categoria || 'Suministros y Proveedores',
    name: p.nombre,
    description: p.description_short || (p.descripcion ? `${p.nombre} (${p.descripcion.slice(0, 160)})` : p.nombre),
    unitPrice: p.precio,
    unit: 'ud'
  }));
  const fullBrainCatalog = [...officialCatalog, ...prospectedItems];

  const systemPrompt = `Eres el asistente técnico de estimación de ObraClima S.L. (Vigo) para valoración de obras, reformas, climatización y fontanería.

CUMPLIMIENTO RGPD OBLIGATORIO (PROTECCIÓN DE DATOS PERSONALES):
- NUNCA proceses, almacenes, infieras ni devuelvas ninguna Información Personal Identificable (PII): queda TERMINANTEMENTE PROHIBIDO incluir nombres de clientes, domicilios, DNI/CIF o teléfonos.
- Concéntrate EXCLUSIVAMENTE en las especificaciones técnicas de la obra: metros cuadrados, estancias, número de unidades, modelos de equipos, mano de obra de instalación y materiales.
- Asocia cada concepto a los ítems del catálogo oficial de ObraClima cuando aplique.

Catálogo de referencia oficial y datos prospectados de mercado (Cerebro ObraClima):
${JSON.stringify(fullBrainCatalog, null, 2)}

Instrucciones:
1. Desglosa cada partida técnica necesaria (máquinas/splits, tuberías de cobre, soportes antivibración, canaletas, mano de obra especializada).
2. Si un concepto coincide o se asimila a un ítem del catálogo, usa su código ("code"), su nombre oficial ("description") y su precio de catálogo ("unitPrice").
3. Si el concepto es nuevo o específico, genera una "description" clara en español formal, y asigna un precio unitario razonable de mercado ("unitPrice").
4. "quantity" debe ser siempre un número entero o decimal positivo (mínimo 1).
5. Incluye exclusivamente notas técnicas sobre montaje, materiales o ejecución en "notes".
6. NUNCA generes ni incluyas un objeto "customer".

Devuelve OBLIGATORIAMENTE un JSON estricto con esta estructura:
{
  "items": [
    {
      "code": "CÓDIGO_O_VACIO",
      "description": "Descripción técnica clara del trabajo o equipo",
      "quantity": 1,
      "unitPrice": 150
    }
  ],
  "notes": "Observaciones exclusivamente técnicas de instalación o montaje"
}`;

  // 1. Intentar con Gemini si la clave está disponible y activa
  if (isGeminiAvailable()) {
    const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
    if (ai) {
      const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "user", parts: [{ text: `Especificaciones técnicas de obra: ${sanitizedPrompt}` }] }
            ],
            config: { responseMimeType: "application/json" }
          });
          const textResponse = response.text || "{}";
          const parsed = JSON.parse(textResponse);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            console.log(`[ObraClima parse-text] Éxito con Gemini (${modelName}):`, parsed.items.length, "partidas.");
            return {
              items: parsed.items,
              notes: typeof parsed.notes === 'string' ? parsed.notes : ''
            };
          }
        } catch (err: any) {
          const { shouldBreak } = handleGeminiError(err, modelName);
          if (shouldBreak) break;
        }
      }
    }
  }

  // 2. Fallback transparente a Groq con modelos de alto rendimiento
  if (process.env.GROQ_API_KEY) {
    console.log("[ObraClima parse-text] Activando fallback inteligente con Groq...");
    const groqResult = await callGroqBudgetParser(systemPrompt, sanitizedPrompt);
    if (groqResult) {
      return groqResult;
    }
  }

  // 3. Fallback de seguridad mediante análisis heurístico con catálogo oficial
  console.log("[ObraClima parse-text] Activando estimador heurístico con catálogo ObraClima...");
  return parseBudgetWithHeuristics(sanitizedPrompt, fullBrainCatalog);
}

export function renderDocumentHtml(doc: any, type: 'presupuesto' | 'factura', config: any) {
  const isInvoice = type === 'factura';
  const title = isInvoice ? 'FACTURA' : 'PRESUPUESTO';
  const clientName = doc.client?.name || doc.customer?.name || 'Cliente Particular';
  const clientAddress = doc.client?.address || doc.customer?.address || '—';
  const clientCp = doc.client?.postalCode || doc.customer?.postalCode || '';
  const clientCity = doc.client?.city || doc.customer?.city || 'Vigo';
  const clientProv = doc.client?.province || doc.customer?.province || 'Pontevedra';
  const clientNif = doc.client?.nif || doc.customer?.nif || '—';

  const dateStr = new Date(doc.date || Date.now()).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const rows = (doc.items || []).map((item: any, i: number) => {
    const q = Number(item.quantity) || 1;
    const p = Number(item.unitPrice ?? item.price) || 0;
    const imp = q * p;
    return `
      <tr>
        <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 6px 8px; text-align: center;">${q}</td>
        <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 6px 8px;">${item.description || item.name || 'Partida de trabajo'}</td>
        <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 6px 8px; text-align: right;">${p.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
        <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 6px 8px; text-align: right; font-weight: 600;">${imp.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
      </tr>
    `;
  }).join('');

  // Rellenar filas vacías para estética
  const fillerCount = Math.max(0, 7 - (doc.items?.length || 0));
  const fillerRows = Array.from({ length: fillerCount }).map(() => `
    <tr>
      <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 12px 8px;"></td>
      <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 12px 8px;"></td>
      <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 12px 8px;"></td>
      <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 12px 8px;"></td>
    </tr>
  `).join('');

  const appUrl = process.env.APP_URL || '';
  const mailRecipients = 'administracion@obraclima.com,ahorraai@gmail.com';
  const mailSubject = encodeURIComponent(`${title} Oficial Nº ${doc.number} - ObraClima S.L. (${clientName})`);
  const mailBody = encodeURIComponent(`Estimado/a ${clientName},\n\nLe remitimos el ${title.toLowerCase()} oficial Nº ${doc.number} emitido por ObraClima S.L.\n\n• Documento: ${title} Nº ${doc.number}\n• Total: ${(doc.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} € (IVA incluido)\n\nPuede consultar o descargar el documento oficial en PDF en el siguiente enlace:\n${appUrl}/print/${type}/${doc.id}?autoprint=false\n\nAtentamente,\nDepartamento de Administración\nObraClima S.L.\nadministracion@obraclima.com | ahorraai@gmail.com`);
  const mailtoHref = `mailto:${mailRecipients}?subject=${mailSubject}&body=${mailBody}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mailRecipients)}&su=${mailSubject}&body=${mailBody}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} ${doc.number} - ObraClima S.L.</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f1f5f9; color: #000; padding: 20px; font-size: 12px; }
    .print-actions { max-width: 800px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: white; padding: 12px 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .print-actions button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .print-actions button:hover { background: #1d4ed8; }
    .sheet { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border: 1px solid #cbd5e1; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-radius: 4px; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-start { align-items: flex-start; }
    .header-box { border: 1px solid #000; padding: 10px; width: 55%; font-size: 11px; line-height: 1.5; }
    .header-row { display: flex; margin-bottom: 2px; }
    .header-label { font-weight: bold; width: 100px; }
    .logo-box { width: 40%; text-align: right; }
    .logo-title { font-size: 24px; font-weight: 900; color: #dc2626; letter-spacing: -1px; margin-top: 4px; }
    .logo-subtitle { font-size: 8px; color: #475569; text-transform: uppercase; letter-spacing: 1px; }
    .client-container { display: flex; justify-content: flex-end; margin: 20px 0; }
    .client-box { border: 1px solid #000; width: 60%; font-size: 11px; }
    .client-title { background: #f1f5f9; text-align: center; font-weight: bold; padding: 4px; border-bottom: 1px solid #000; font-size: 10px; letter-spacing: 0.5px; }
    .client-content { padding: 8px; line-height: 1.5; }
    .num-row { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
    .num-col { width: 32%; border: 1px solid #000; text-align: center; }
    .num-col-head { background: #f1f5f9; font-weight: bold; padding: 3px; border-bottom: 1px solid #000; }
    .num-col-val { padding: 4px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #e2e8f0; border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center; }
    .totals-container { display: flex; justify-content: flex-end; margin-bottom: 25px; }
    .totals-box { width: 45%; border: 2px solid #000; }
    .tot-row { display: flex; border-bottom: 1px solid #000; }
    .tot-row:last-child { border-bottom: none; }
    .tot-label { width: 50%; padding: 4px 8px; font-weight: bold; background: #f8fafc; }
    .tot-val { width: 50%; padding: 4px 8px; text-align: right; border-left: 1px solid #000; }
    .tot-final { background: #f1f5f9; font-size: 13px; font-weight: bold; }
    .payment-box { border: 1px solid #000; padding: 8px; font-size: 11px; background: #f8fafc; margin-bottom: 15px; }
    .bank-box { border: 1px solid #000; padding: 8px; width: 45%; font-size: 10px; line-height: 1.4; }
    .bank-title { font-weight: bold; margin-bottom: 2px; }
    .bank-iban { color: #1e40af; font-weight: bold; font-family: monospace; font-size: 11px; }
    @media print {
      body { background: white; padding: 0; }
      .print-actions { display: none !important; }
      .sheet { border: none; box-shadow: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>

  <div class="print-actions">
    <div>
      <strong>ObraClima S.L.</strong> — ${title} Oficial <code>${doc.number}</code>
    </div>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
      <a href="${gmailHref}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
        <button type="button" style="background: #dc2626; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer;">✉️ Gmail</button>
      </a>
      <a href="${mailtoHref}" style="text-decoration: none;">
        <button type="button" style="background: #059669; color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer;">📨 Enviar por Correo</button>
      </a>
      <button onclick="window.close()" style="background: #475569;">Cerrar</button>
    </div>
  </div>

  <div class="sheet">
    <!-- HEADER -->
    <div class="flex justify-between items-start">
      <div class="header-box">
        <div class="header-row"><span class="header-label">NOMBRE:</span> <span>${config.companyName}</span></div>
        <div class="header-row"><span class="header-label">DIRECCIÓN:</span> <span>${config.address}</span></div>
        <div class="header-row"><span class="header-label">CÓDIGO POSTAL:</span> <span>${config.postalCode}</span></div>
        <div class="header-row"><span class="header-label">POBLACIÓN:</span> <span>${config.city}</span></div>
        <div class="header-row"><span class="header-label">PROVINCIA:</span> <span>${config.province}</span></div>
        <div class="header-row"><span class="header-label">N.I.F.:</span> <span>${config.nif}</span></div>
      </div>

      <div class="logo-box">
        <div style="display: inline-block; text-align: center;">
          <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 3px;">
            <div style="width: 24px; height: 6px; background: #334155; transform: skew(-15deg);"></div>
            <div style="width: 24px; height: 6px; background: #dc2626; transform: skew(-15deg);"></div>
          </div>
          <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 4px;">
            <div style="width: 32px; height: 8px; background: #1e293b; transform: skew(-15deg);"></div>
            <div style="width: 32px; height: 8px; background: #dc2626; transform: skew(-15deg);"></div>
          </div>
          <div class="logo-title">ObraClima S.L.</div>
          <div class="logo-subtitle">Obras • Reformas • Climatización</div>
        </div>
        <div style="margin-top: 20px; font-weight: bold; font-size: 11px;">FECHA: ${dateStr}</div>
      </div>
    </div>

    <!-- CLIENT DATA -->
    <div class="client-container">
      <div class="client-box">
        <div class="client-title">DATOS DEL CLIENTE</div>
        <div class="client-content">
          <div class="header-row"><span class="header-label" style="width: 110px;">NOMBRE:</span> <span><strong>${clientName}</strong></span></div>
          <div class="header-row"><span class="header-label" style="width: 110px;">DIRECCIÓN:</span> <span>${clientAddress}</span></div>
          <div class="header-row"><span class="header-label" style="width: 110px;">CÓDIGO POSTAL:</span> <span>${clientCp}</span></div>
          <div class="header-row"><span class="header-label" style="width: 110px;">POBLACIÓN:</span> <span>${clientCity}</span></div>
          <div class="header-row"><span class="header-label" style="width: 110px;">PROVINCIA:</span> <span>${clientProv}</span></div>
          <div class="header-row"><span class="header-label" style="width: 110px;">N.I.F.:</span> <span><strong>${clientNif}</strong></span></div>
        </div>
      </div>
    </div>

    <!-- NUMBERS -->
    <div class="num-row">
      <div class="num-col">
        <div class="num-col-head">SERIE</div>
        <div class="num-col-val">${doc.number?.split('/')[1] || config.invoiceSeries}</div>
      </div>
      <div class="num-col" style="width: 45%;">
        <div class="num-col-head">NÚMERO ${title}</div>
        <div class="num-col-val" style="font-size: 13px; color: #1e3a8a;">${doc.number}</div>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table>
      <thead>
        <tr>
          <th style="width: 10%;">UNIDADES</th>
          <th style="width: 55%;">CONCEPTO</th>
          <th style="width: 17%;">PVP / UN</th>
          <th style="width: 18%;">IMPORTE</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${fillerRows}
        <tr>
          <td colspan="4" style="border-top: 1px solid #000;"></td>
        </tr>
      </tbody>
    </table>

    <!-- TOTALS -->
    <div class="totals-container">
      <div class="totals-box">
        <div class="tot-row">
          <div class="tot-label">BASE IMPONIBLE</div>
          <div class="tot-val">${(doc.subtotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
        </div>
        <div class="tot-row">
          <div class="tot-label">IVA (${config.defaultIva}%)</div>
          <div class="tot-val">${(doc.tax || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
        </div>
        <div class="tot-row tot-final">
          <div class="tot-label" style="background: transparent;">TOTAL ${title}</div>
          <div class="tot-val" style="font-size: 14px; color: #1e40af;">${(doc.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
        </div>
      </div>
    </div>

    <!-- PAYMENT & IBAN -->
    <div class="payment-box">
      <strong>FORMA PAGO:</strong> ${config.paymentMethod || 'Transferencia Bancaria'}
      ${doc.notes ? `<div style="margin-top: 6px; font-weight: normal; font-size: 10.5px; color: #334155;"><strong>Observaciones:</strong> ${doc.notes}</div>` : ''}
    </div>

    <div class="bank-box">
      <div class="bank-title">Datos Bancarios:</div>
      <div class="bank-iban">${config.iban}</div>
    </div>
  </div>

  <script>
    if (new URLSearchParams(window.location.search).get('autoprint') === 'true') {
      window.onload = function() {
        setTimeout(function() { window.print(); }, 500);
      };
    }
  </script>
</body>
</html>`;
}

// === ROUTES SETUP ===

export function setupObraClimaRoutes(app: any, requireAdmin: any) {

  // Auth checker supporting Telegram HMAC validation or Supabase Admin Bearer
  async function checkAuth(req: any, res: any): Promise<boolean> {
    return await requireAdmin(req, res);
  }

  // Public Telegram Bot metadata endpoint (NO tokens fijos ni secretos expuestos)
  app.get('/api/obraclima/telegram-info', (req: any, res: any) => {
    const appUrl = process.env.APP_URL || 'https://ais-dev-tvkcd5ffewortczttmdp2n-511583726387.europe-west2.run.app';

    res.json({
      botUsername: 'ahorraaivigoasistant_bot',
      telegramWebUrl: 'https://web.telegram.org/k/#@ahorraaivigoasistant_bot',
      telegramAppUrl: 'https://t.me/ahorraaivigoasistant_bot',
      miniAppUrl: `${appUrl}/obraclima-miniapp`,
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN
    });
  });

  // Standalone Printable Document HTML route (works in any browser and inside Telegram webview)
  app.get(['/api/obraclima/print/:type/:id', '/print/:type/:id'], async (req: any, res: any) => {
    const { type, id } = req.params;
    const config = await getConfig();
    let doc: any = null;
    if (type === 'factura') {
      const invoices = await getInvoices();
      doc = invoices.find((i: any) => i.id === id || i.number === id);
    } else {
      const budgets = await getBudgets();
      doc = budgets.find((b: any) => b.id === id || b.number === id);
    }

    if (!doc) {
      return res.status(404).send(`<!DOCTYPE html><html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Documento no encontrado</h2>
        <p>No se encontró ningún ${type} con el identificador <code>${id}</code>.</p>
        <a href="/obraclima-miniapp" style="color: #2563eb;">Ir a ObraClima MiniApp</a>
      </body></html>`);
    }

    const html = renderDocumentHtml(doc, type as any, config);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
  
  // -- CONFIG --
  app.get('/api/obraclima/config', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const cfg = await getConfig();
    res.json(cfg);
  });
  app.put('/api/obraclima/config', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const cfg = await updateConfig(req.body);
    res.json(cfg);
  });

  // -- CLIENTS --
  app.get('/api/obraclima/clients', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const clients = await getClients();
    res.json(clients);
  });
  app.post('/api/obraclima/clients', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const client = await repoCreateClient(req.body);
    res.json(client);
  });

  // -- CATALOG (OFICIAL) --
  app.get('/api/obraclima/catalog', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const catalog = await getOfficialCatalog();
    res.json(catalog);
  });
  app.post('/api/obraclima/catalog', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const item = await createOfficialCatalogItem(req.body);
    res.json(item);
  });

  // -- PRODUCT CARDS & ON-DEMAND IMAGE CACHING --
  app.get('/api/obraclima/product-card/:id', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    try {
      const card = await resolveProductCard(req.params.id);
      if (!card) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
      return res.json({ success: true, card });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/obraclima/cache-product-image', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    try {
      const { productId, imageUrl } = req.body;
      if (!productId || !imageUrl) {
        return res.status(400).json({ success: false, error: 'productId e imageUrl son requeridos' });
      }
      const cachedUrl = await cacheProductImageOnDemand(productId, imageUrl);
      return res.json({ success: true, cached_image_url: cachedUrl });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // -- BUDGETS --
  app.get('/api/obraclima/budgets', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const budgets = await getBudgets();
    res.json(budgets);
  });

  app.post('/api/obraclima/budgets', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const budget = await repoCreateBudget(req.body);
    res.json(budget);
  });

  app.put('/api/obraclima/budgets/:id', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const updated = await repoUpdateBudget(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Presupuesto no encontrado" });
    res.json(updated);
  });

  app.post('/api/obraclima/budgets/:id/convert', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const invoice = await repoConvertBudgetToInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Presupuesto no encontrado" });
    res.json({ success: true, invoice });
  });

  // -- INVOICES --
  app.get('/api/obraclima/invoices', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const invoices = await getInvoices();
    res.json(invoices);
  });

  app.post('/api/obraclima/invoices', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const invoice = await repoCreateInvoice(req.body);
    res.json(invoice);
  });

  // -- RGPD SECURE BUDGET GENERATION (BACKEND FUSION) --
  app.post("/api/obraclima/generate-budget-rgpd", async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    try {
      const { technicalPrompt, clientId, prompt } = req.body;
      const rawPrompt = technicalPrompt || prompt;
      if (!rawPrompt) return res.status(400).json({ error: "Falta la descripción técnica de la obra." });

      // 1. Desacoplamiento y Seudonimización estricta (RGPD)
      const { sanitizedPrompt, hasPiiDetected } = sanitizePromptForAi(rawPrompt);

      // 2. Ejecución LLM aislada (el modelo solo recibe datos técnicos de obra)
      const technicalResult = await parseBudgetWithAi(sanitizedPrompt);

      // 3. Consulta de PII en Supabase/BD en entorno seguro de backend
      const clientsList = await getClients();
      const targetClientId = clientId || clientsList[0]?.id || 'c1';
      const client = await getClientById(targetClientId);

      // 4. Fusión local en el servidor (backend assembly)
      const newBudget = await createBudget({
        customer: client,
        client: client,
        clientId: client?.id,
        items: technicalResult.items || [],
        notes: technicalResult.notes || ''
      });

      return res.json({
        success: true,
        budget: newBudget,
        sanitized: hasPiiDetected,
        message: "Presupuesto ensamblado con éxito con seudonimización RGPD."
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // -- AI PARSING (TEXT) --
  app.post("/api/obraclima/parse-text", async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    try {
      const { prompt, clientId } = req.body;
      if (!prompt) return res.status(400).json({ error: "Falta el prompt." });
      
      const { sanitizedPrompt, hasPiiDetected } = sanitizePromptForAi(prompt);
      const parsedData = await parseBudgetWithAi(sanitizedPrompt);

      let customer = undefined;
      if (clientId) {
        customer = await getClientById(clientId);
      }
      
      return res.json({ 
        success: true, 
        data: {
          ...parsedData,
          customer: customer || undefined,
          sanitized: hasPiiDetected
        } 
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // -- AI PARSING (PDF) --
  app.post("/api/obraclima/parse-pdf", async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    try {
      const { base64Pdf } = req.body;
      if (!base64Pdf) return res.status(400).json({ error: "Falta el PDF." });
      
      const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
      if (!ai) return res.status(503).json({ error: "GEMINI_API_KEY no configurada." });

      const systemPrompt = `Eres el asistente de ObraClima. Extrae la información del documento adjunto a JSON estricto.
Devuelve SOLO JSON (sin markdown):
{
  "customer": { "name": "", "address": "", "nif": "", "postalCode": "", "city": "", "province": "" },
  "items": [ { "description": "Descripción", "quantity": 1, "unitPrice": 100 } ],
  "notes": ""
}`;

      let textResponse = "";
      let lastError: any = null;

      if (ai && isGeminiAvailable()) {
        const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "user", parts: [{ inlineData: { data: base64Pdf, mimeType: "application/pdf" } }] }
              ],
              config: { responseMimeType: "application/json" }
            });
            textResponse = response.text || "{}";
            break;
          } catch (err: any) {
            lastError = err;
            const { shouldBreak } = handleGeminiError(err, modelName);
            if (shouldBreak) break;
          }
        }
      }

      if (!textResponse) {
        console.log("[ObraClima parse-pdf] Asistente PDF en modo borrador para revisión manual.");
        return res.json({
          success: true,
          data: {
            customer: { name: "Cliente Particular", address: "Vigo (Pontevedra)", nif: "", postalCode: "36200", city: "Vigo", province: "Pontevedra" },
            items: [
              { code: "PDF-REV-01", description: "Revisión técnica de partidas desde PDF adjunto", quantity: 1, unitPrice: 0 }
            ],
            notes: "Documento PDF recibido. Complete o ajuste las partidas deseadas."
          }
        });
      }

      return res.json({ success: true, data: JSON.parse(textResponse || "{}") });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // -- GENERATE COURTESY TEXT WITH GEMINI --
  app.post("/api/obraclima/generate-courtesy", async (req: any, res: any) => {
    try {
      const { doc, docId, type = 'presupuesto' } = req.body;
      let targetDoc = doc;
      if (!targetDoc && docId) {
        targetDoc = type === 'factura' ? await getInvoiceById(docId) : await getBudgetById(docId);
      }

      if (!targetDoc) {
        return res.status(404).json({ error: "Documento no encontrado para redactar el texto de cortesía." });
      }

      const courtesyText = await generateCourtesyTextWithGemini(targetDoc, type);
      return res.json({ success: true, courtesyText });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // -- GENERATE PDF & UPLOAD TO SUPABASE STORAGE BUCKET --
  app.post("/api/obraclima/generate-pdf", async (req: any, res: any) => {
    try {
      const { doc, docId, type = 'presupuesto' } = req.body;
      let targetDoc = doc;
      if (!targetDoc && docId) {
        targetDoc = type === 'factura' ? await getInvoiceById(docId) : await getBudgetById(docId);
      }

      if (!targetDoc) {
        return res.status(404).json({ error: "Documento no encontrado para generar PDF." });
      }

      const currentConfig = await getConfig();
      const docTitle = type === 'factura' ? 'Factura' : 'Presupuesto';
      const docNum = (targetDoc.number || '000').replace(/[\/\\]/g, '-');
      const filename = `${docTitle}_${docNum}_ObraClima.pdf`;

      // 1. Generar binario PDF oficial A4
      const pdfBuffer = await generateBudgetPdfBuffer(targetDoc, type, currentConfig);

      // 2. Guardar temporalmente en Bucket de Supabase Storage
      const storageResult = await uploadPdfToSupabaseStorage(pdfBuffer, filename);

      return res.json({
        success: true,
        filename,
        sizeBytes: pdfBuffer.length,
        storageUrl: storageResult.publicUrl,
        storagePath: storageResult.storagePath,
        storageError: storageResult.error,
        pdfBase64: pdfBuffer.toString('base64')
      });
    } catch (err: any) {
      console.error("[generate-pdf error]:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // -- SEND BUDGET / INVOICE EMAIL WITH NATIVE PDF ATTACHMENT & RESEND / NODEMAILER --
  app.post(["/api/obraclima/send-email", "/api/obraclima/send-budget"], async (req: any, res: any) => {
    try {
      const { to, subject, body, doc, docId, type = 'presupuesto' } = req.body;
      let targetDoc = doc;
      if (!targetDoc && docId) {
        targetDoc = type === 'factura' ? await getInvoiceById(docId) : await getBudgetById(docId);
      }

      if (!targetDoc) {
        return res.status(404).json({ error: "Documento de presupuesto o factura no encontrado." });
      }

      const currentConfig = await getConfig();
      const docNum = targetDoc.number || docId || 'documento';
      const docTitle = type === 'factura' ? 'Factura' : 'Presupuesto';
      const clientName = targetDoc.customer?.name || targetDoc.client?.name || 'Cliente';
      const filename = `${docTitle}_${docNum.replace(/[\/\\]/g, '-')}_ObraClima.pdf`;

      // 1. Obtener o generar texto de cortesía con Gemini si viene vacío
      let emailBody = body;
      if (!emailBody || typeof emailBody !== 'string' || emailBody.trim().length === 0) {
        emailBody = await generateCourtesyTextWithGemini(targetDoc, type);
      }

      // 2. Generar el archivo PDF binario de forma nativa
      const pdfBuffer = await generateBudgetPdfBuffer(targetDoc, type, currentConfig);

      // 3. Guardar temporalmente en el Bucket de Supabase Storage
      const storageResult = await uploadPdfToSupabaseStorage(pdfBuffer, filename);
      if (storageResult.publicUrl) {
        console.log(`[Supabase Storage] PDF ${filename} guardado temporalmente en: ${storageResult.publicUrl}`);
      }

      // 4. Construir lista de destinatarios
      const clientEmail = targetDoc.customer?.email || targetDoc.client?.email;
      let recipients: string[] = [];
      if (Array.isArray(to) && to.length > 0) {
        recipients = to.filter(Boolean);
      } else if (typeof to === 'string' && to.trim()) {
        recipients = to.split(',').map(e => e.trim()).filter(Boolean);
      } else {
        recipients = ['administracion@obraclima.com', 'ahorraai@gmail.com'];
        if (clientEmail) recipients.unshift(clientEmail);
      }

      // 5. Asunto oficial
      const emailSubject = subject || `${docTitle} Oficial Nº ${docNum} - ObraClima S.L. (${clientName})`;

      // 6. Enviar correo con PDF adjunto de forma nativa utilizando Resend API (o Nodemailer)
      const sendResult = await sendOfficialEmailWithNativePdfAttachment({
        to: recipients,
        subject: emailSubject,
        body: emailBody,
        pdfBuffer,
        pdfFilename: filename,
        docNumber: docNum,
        type
      });

      return res.json({
        success: sendResult.success,
        message: sendResult.message,
        provider: sendResult.provider,
        id: sendResult.id,
        storageUrl: storageResult.publicUrl,
        storagePath: storageResult.storagePath,
        filename,
        recipients,
        courtesyText: emailBody
      });
    } catch (err: any) {
      console.error("[Email send error]:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Integrar rutas de prospección masiva y scraping de catálogos con control de autenticación
  setupObraClimaScraperRoutes(app, checkAuth);
}
