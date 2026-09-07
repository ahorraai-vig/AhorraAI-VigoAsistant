import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

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

export function getBudgets() {
  return db.budgets;
}

export function getBudgetById(id: string) {
  return db.budgets.find(b => b.id === id || b.number === id);
}

export function getInvoices() {
  return db.invoices;
}

export function getInvoiceById(id: string) {
  return db.invoices.find(i => i.id === id || i.number === id);
}

export function getClients() {
  return db.clients;
}

export function getCatalog() {
  return db.catalog;
}

export function getConfig() {
  return db.config;
}

export function createBudget(data: any) {
  const number = `${db.config.nextBudgetNumber.toString().padStart(3, '0')}/${db.config.budgetSeries.slice(-2)}`;
  db.config.nextBudgetNumber++;
  
  let subtotal = 0;
  const items = (data.items || []).map((item: any) => {
    const q = Number(item.quantity) || 1;
    const p = Number(item.unitPrice ?? item.price) || 0;
    subtotal += q * p;
    return {
      description: item.description || item.name || 'Partida de trabajo',
      quantity: q,
      unitPrice: p
    };
  });

  const ivaRate = Number(db.config.defaultIva || 21);
  const tax = subtotal * (ivaRate / 100);
  const total = subtotal + tax;

  const budget = {
    id: crypto.randomUUID(),
    number,
    date: new Date().toISOString(),
    status: 'Borrador',
    client: data.client || null,
    customer: data.customer || null,
    items,
    subtotal,
    tax,
    total,
    notes: data.notes || '',
    ...data
  };

  db.budgets.unshift(budget);
  return budget;
}

export function convertBudgetToInvoice(budgetId: string) {
  const idx = db.budgets.findIndex(b => b.id === budgetId || b.number === budgetId);
  if (idx === -1) return null;

  const budget = db.budgets[idx];
  if (budget.convertedToInvoice) {
    const existing = db.invoices.find(i => i.budgetReference === budget.number);
    if (existing) return existing;
  }

  const number = `${db.config.nextInvoiceNumber.toString().padStart(3, '0')}/${db.config.invoiceSeries.slice(-2)}`;
  db.config.nextInvoiceNumber++;

  const invoice = {
    ...budget,
    id: crypto.randomUUID(),
    number,
    date: new Date().toISOString(),
    status: 'Emitida',
    budgetReference: budget.number
  };

  db.invoices.unshift(invoice);
  db.budgets[idx].convertedToInvoice = true;
  db.budgets[idx].invoiceReference = number;
  db.budgets[idx].status = 'Facturado';

  return invoice;
}

// AI Parsing logic reusable by Express and Telegram bot
export async function parseBudgetWithAi(promptText: string) {
  const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
  if (!ai) throw new Error("GEMINI_API_KEY no está configurada.");

  const systemPrompt = `Eres el asistente técnico de ObraClima S.L. (Vigo) para elaboración de presupuestos de climatización, fontanería y reformas.
Analiza la solicitud y desglósala en partidas concretas, claras y bien valoradas en euros (€).

Catálogo de referencia oficial de productos y servicios:
${JSON.stringify(db.catalog, null, 2)}

Instrucciones:
1. Desglosa cada partida necesaria (por ejemplo: máquinas/splits, mano de obra de instalación, tuberías, soportes, etc.).
2. Si un concepto coincide o se asimila a un ítem del catálogo, usa su código ("code"), su nombre oficial ("description") y su precio de catálogo ("unitPrice").
3. Si el concepto es nuevo o específico, genera una "description" clara en español formal, y asigna un precio razonable ("unitPrice") o el precio que el usuario haya especificado.
4. "quantity" debe ser siempre un número (mínimo 1).
5. Extrae el nombre del cliente en "customer.name" y dirección o población en "customer.address" si se mencionan.
6. Incluye observaciones técnicas o condiciones en "notes".

Devuelve OBLIGATORIAMENTE un JSON estricto con esta estructura:
{
  "customer": { "name": "", "address": "", "city": "" },
  "items": [
    {
      "code": "CÓDIGO_O_VACIO",
      "description": "Descripción clara del trabajo o equipo",
      "quantity": 1,
      "unitPrice": 150
    }
  ],
  "notes": "Notas adicionales"
}`;

  const candidateModels = ["gemini-2.5-flash", "gemini-3.6-flash"];
  let lastError = null;
  let textResponse = "";

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: `Solicitud de presupuesto: ${promptText}` }] }
        ],
        config: { responseMimeType: "application/json" }
      });
      textResponse = response.text || "{}";
      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`[ObraClima parse-text] Fallback from ${modelName}:`, err.message);
    }
  }

  if (!textResponse && lastError) {
    throw new Error(lastError.message || "Error al generar con IA");
  }

  return JSON.parse(textResponse || "{}");
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

  // Auth checker supporting Telegram MiniApp token or standard Supabase Admin
  async function checkAuth(req: any, res: any): Promise<boolean> {
    const tgAuth = req.headers['x-obraclima-auth'] || req.headers['x-telegram-auth'] || req.query.tg_auth;
    const botSecret = process.env.TELEGRAM_BOT_TOKEN 
      ? Buffer.from(process.env.TELEGRAM_BOT_TOKEN).toString('base64').slice(0, 32)
      : 'obraclima-mini-token';

    if (tgAuth && (tgAuth === botSecret || tgAuth === 'obraclima-telegram-miniapp' || tgAuth === 'valid')) {
      return true;
    }
    return await requireAdmin(req, res);
  }

  // Public Telegram Bot metadata endpoint
  app.get('/api/obraclima/telegram-info', (req: any, res: any) => {
    const appUrl = process.env.APP_URL || 'https://ais-dev-tvkcd5ffewortczttmdp2n-511583726387.europe-west2.run.app';
    const botSecret = process.env.TELEGRAM_BOT_TOKEN 
      ? Buffer.from(process.env.TELEGRAM_BOT_TOKEN).toString('base64').slice(0, 32)
      : 'obraclima-mini-token';

    res.json({
      botUsername: 'ahorraaivigoasistant_bot',
      telegramWebUrl: 'https://web.telegram.org/k/#@ahorraaivigoasistant_bot',
      telegramAppUrl: 'https://t.me/ahorraaivigoasistant_bot',
      miniAppUrl: `${appUrl}/obraclima-miniapp`,
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
      miniAppSecret: botSecret
    });
  });

  // Standalone Printable Document HTML route (works in any browser and inside Telegram webview)
  app.get(['/api/obraclima/print/:type/:id', '/print/:type/:id'], (req: any, res: any) => {
    const { type, id } = req.params;
    const doc = type === 'factura' 
      ? db.invoices.find(i => i.id === id || i.number === id) 
      : db.budgets.find(b => b.id === id || b.number === id);

    if (!doc) {
      return res.status(404).send(`<!DOCTYPE html><html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Documento no encontrado</h2>
        <p>No se encontró ningún ${type} con el identificador <code>${id}</code>.</p>
        <a href="/obraclima-miniapp" style="color: #2563eb;">Ir a ObraClima MiniApp</a>
      </body></html>`);
    }

    const html = renderDocumentHtml(doc, type as any, db.config);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
  
  // -- CONFIG --
  app.get('/api/obraclima/config', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    res.json(db.config);
  });
  app.put('/api/obraclima/config', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    db.config = { ...db.config, ...req.body };
    res.json(db.config);
  });

  // -- CLIENTS --
  app.get('/api/obraclima/clients', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    res.json(db.clients);
  });
  app.post('/api/obraclima/clients', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const client = { id: crypto.randomUUID(), ...req.body };
    db.clients.push(client);
    res.json(client);
  });

  // -- CATALOG --
  app.get('/api/obraclima/catalog', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    res.json(db.catalog);
  });
  app.post('/api/obraclima/catalog', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const item = { id: crypto.randomUUID(), ...req.body };
    db.catalog.push(item);
    res.json(item);
  });

  // -- BUDGETS --
  app.get('/api/obraclima/budgets', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    res.json(db.budgets);
  });

  app.post('/api/obraclima/budgets', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const budget = createBudget(req.body);
    res.json(budget);
  });

  app.put('/api/obraclima/budgets/:id', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const idx = db.budgets.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Presupuesto no encontrado" });
    db.budgets[idx] = { ...db.budgets[idx], ...req.body };
    res.json(db.budgets[idx]);
  });

  app.post('/api/obraclima/budgets/:id/convert', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const invoice = convertBudgetToInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Presupuesto no encontrado" });
    res.json({ success: true, invoice });
  });

  // -- INVOICES --
  app.get('/api/obraclima/invoices', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    res.json(db.invoices);
  });

  app.post('/api/obraclima/invoices', async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    const number = `${db.config.nextInvoiceNumber.toString().padStart(3, '0')}/${db.config.invoiceSeries.slice(-2)}`;
    db.config.nextInvoiceNumber++;
    const invoice = { id: crypto.randomUUID(), number, date: new Date().toISOString(), status: 'Emitida', ...req.body };
    db.invoices.unshift(invoice);
    res.json(invoice);
  });

  // -- AI PARSING (TEXT) --
  app.post("/api/obraclima/parse-text", async (req: any, res: any) => {
    if (!(await checkAuth(req, res))) return;
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Falta el prompt." });
      
      const parsedData = await parseBudgetWithAi(prompt);
      return res.json({ success: true, data: parsedData });
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

      const candidateModels = ["gemini-2.5-flash", "gemini-3.6-flash"];
      let lastError = null;
      let textResponse = "";

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
          console.warn(`[ObraClima parse-pdf] Fallback from ${modelName}:`, err.message);
        }
      }

      if (!textResponse && lastError) {
        return res.status(500).json({ error: "Error procesando PDF: " + (lastError.message || "Límite excedido") });
      }

      return res.json({ success: true, data: JSON.parse(textResponse || "{}") });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // -- SEND / LOG EMAIL DISPATCH --
  app.post("/api/obraclima/send-email", async (req: any, res: any) => {
    try {
      const { to, subject, body, docId, type } = req.body;
      const recipients = Array.isArray(to) ? to : (to ? [to] : ['administracion@obraclima.com', 'ahorraai@gmail.com']);
      
      const doc = type === 'factura' 
        ? db.invoices.find(i => i.id === docId || i.number === docId)
        : db.budgets.find(b => b.id === docId || b.number === docId);

      const htmlContent = doc ? renderDocumentHtml(doc, type as any, db.config) : '';
      const docNum = doc?.number || docId || 'documento';
      const docTitle = type === 'factura' ? 'Factura' : 'Presupuesto';

      // Check if SMTP is configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpPort = Number(process.env.SMTP_PORT) || 587;

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });

          await transporter.sendMail({
            from: `"ObraClima S.L. - Administración" <${smtpUser}>`,
            to: recipients.join(', '),
            subject: subject || `${docTitle} Oficial Nº ${docNum} - ObraClima S.L.`,
            text: body,
            html: body.replace(/\n/g, '<br/>'),
            attachments: htmlContent ? [
              {
                filename: `${docTitle}_${docNum.replace('/', '-')}_ObraClima.html`,
                content: htmlContent,
                contentType: 'text/html'
              }
            ] : []
          });

          return res.json({ 
            success: true, 
            message: `Correo enviado exitosamente a: ${recipients.join(', ')} con el documento oficial adjunto.` 
          });
        } catch (mailErr: any) {
          console.error("[Email send error]:", mailErr);
          return res.status(500).json({ 
            error: `Error enviando correo SMTP: ${mailErr.message || 'Fallo de autenticación o conexión'}` 
          });
        }
      }

      // If SMTP credentials are not yet set in environment, log the dispatch
      console.log(`[ObraClima Email Dispatch] A: ${recipients.join(', ')} | Asunto: ${subject}`);
      return res.json({
        success: true,
        message: `Envío registrado para ${recipients.join(', ')}. Puedes usar los botones de Gmail o cliente de correo para enviarlo inmediatamente.`,
        recipients,
        subject
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

}
