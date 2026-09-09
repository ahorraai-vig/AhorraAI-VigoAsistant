import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { GoogleGenAI } from '@google/genai';
import { sendOfficialEmailWithNativePdfAttachment } from './obraclima_pdf_mailer';

export interface TelegramMiniAppProposal {
  leadId: string;
  businessName: string;
  municipality: string;
  primaryCategory: string;
  appInitials: string;
  appName: string;
  appTagline: string;
  assistantTitle: string;
  assistantSubtitle: string;
  assistantDescription: string;
  sampleInputPlaceholder: string;
  catalogItemsCount: number;
  quickExamples: Array<{
    title: string;
    description: string;
  }>;
  tabs: string[];
  keyBenefits: string[];
  emailSubject: string;
  emailBody: string;
  generatedAt: string;
}

/**
 * Sanitiza texto para fuentes estándar de pdf-lib (WinAnsi / ASCII)
 */
function safePdf(input: any): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/€/g, 'EUR')
    .replace(/[•●]/g, '-')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[^\x00-\xFF]/g, '')
    .trim();
}

/**
 * Obtiene iniciales para el logo de la MiniApp (ej: Suministros Monte Alba -> SMA o MA)
 */
function extractInitials(name: string): string {
  if (!name) return 'AI';
  const clean = name.replace(/^(S\.?L\.?U?|S\.?A\.?|C\.?B\.?)\s+/i, '')
    .replace(/\s+(S\.?L\.?U?|S\.?A\.?|C\.?B\.?)$/i, '')
    .trim();
  const words = clean.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Genera el plan adaptado y los textos persuasivos usando Gemini (o fallback heurístico)
 */
export async function generateProposalContent(
  business: any,
  audit: any,
  painPoints: any[],
  score: any
): Promise<TelegramMiniAppProposal> {
  const bizName = business?.name || 'Comercio Local';
  const municipality = business?.municipality || 'Vigo';
  const category = business?.primary_category || 'Construcción y Reformas';
  const initials = extractInitials(bizName);

  const apiKey = process.env.GEMINI_API_KEY;
  let aiProposal: any = null;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Actúa como Consultor Senior de Transformación Digital B2B para pymes y autónomos en Galicia (provincia de Pontevedra).
Tu misión es diseñar una propuesta comercial irresistible y la especificación de una MiniApp en Telegram a medida para el siguiente negocio, basándote en el modelo de éxito de "ObraClima AI" (captura de referencia con generador de presupuestos por IA, asignación de cliente, catálogo y pestañas de Presupuestos, Facturas, Asistente IA, Clientes, Catálogo, Empresa).

DATOS DEL NEGOCIO PROSPECTADO:
- Nombre: ${bizName}
- Municipio: ${municipality} (Pontevedra)
- Sector / Categoría: ${category}
- Puntuación Debilidad Digital (DWS): ${score?.digital_weakness_score ?? 35}/100
- Potencial Comercial (CPS): ${score?.commercial_potential_score ?? 45}/100
- ¿Tiene web?: ${audit?.website_exists ? 'Sí' : 'No'}
- ¿Tiene formulario de presupuestos online?: ${audit?.quote_form ? 'Sí' : 'No (Punto de dolor clave)'}
- ¿Tiene WhatsApp directo para clientes?: ${audit?.whatsapp_visible ? 'Sí' : 'No'}
- ¿Muestra catálogo o portfolio de trabajos?: ${audit?.portfolio_present ? 'Sí' : 'No'}
- Oportunidades detectadas: ${JSON.stringify(painPoints?.map((p: any) => p.pain_type) || [])}

INSTRUCCIONES:
1. Adapta la MiniApp al oficio exacto de este negocio (ej. si es fontanería/suministros: pedidos rápidos de calderas y tubos; si es reformas: cotizador de baños/cocinas; si es carpintería/aluminio: ventanas y cerramientos; si es electricidad: cuadros y boletines).
2. Genera un email B2B respetuoso, profesional, altamente personalizado y persuasivo (conforme a LOPDGDD/RGPD B2B). Menciona que en el PDF adjunto le dejamos una maqueta visual preliminar de cómo luciría su app exclusiva en Telegram sin que sus clientes tengan que instalar nada nuevo.
3. Devuelve estrictamente un JSON válido con esta estructura:

{
  "appName": "${bizName} AI",
  "appTagline": "Gestión de Presupuestos y Pedidos en Segundos",
  "assistantTitle": "Asistente Inteligente ${bizName}",
  "assistantSubtitle": "Genera presupuestos estructurados y cotizaciones en segundos",
  "assistantDescription": "Escribe en lenguaje natural lo que necesitas presupuestar. La IA identificará los materiales, partidas de mano de obra, cruzará con tu catálogo de precios y calculará la base imponible y el 21% de IVA.",
  "sampleInputPlaceholder": "Ejemplo realista adaptado al sector...",
  "catalogItemsCount": 75,
  "quickExamples": [
    { "title": "⚡ Ejemplo 1 corto", "description": "Detalle técnico breve..." },
    { "title": "⚡ Ejemplo 2 corto", "description": "Detalle técnico breve..." },
    { "title": "⚡ Ejemplo 3 corto", "description": "Detalle técnico breve..." }
  ],
  "keyBenefits": [
    "Beneficio 1 adaptado...",
    "Beneficio 2 adaptado...",
    "Beneficio 3 adaptado...",
    "Beneficio 4 adaptado..."
  ],
  "emailSubject": "Asunto personalizado y sugerente para ${bizName}...",
  "emailBody": "Cuerpo del correo completo y profesional..."
}`;

      for (const modelName of ['gemini-3.8-flash', 'gemini-3.6-flash']) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
          });
          if (response?.text) {
            const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            aiProposal = JSON.parse(cleaned);
            break;
          }
        } catch {
          // probar siguiente modelo
        }
      }
    } catch (err: any) {
      console.warn('[Proposal AI Generation Notice]: Usando generador heurístico:', err.message);
    }
  }

  // Fallback heurístico adaptado si la IA no está disponible o falla el parseo
  const defaultPlaceholder = category.toLowerCase().includes('fontan') || category.toLowerCase().includes('suministr')
    ? 'Ej: Suministro de caldera de condensación 24kW con kit de salida de humos, 2 válvulas termostáticas y 4 metros de tubería multicapa 20mm...'
    : category.toLowerCase().includes('reform') || category.toLowerCase().includes('construc')
    ? 'Ej: Reforma integral de baño de 5m2 con cambio de bañera a plato de ducha de resina, alicatado cerámico y fontanería nueva...'
    : category.toLowerCase().includes('electr')
    ? 'Ej: Instalación de cuadro eléctrico de vivienda con IGA 25A, 5 diferenciales y 12 circuitos según REBT...'
    : 'Ej: Presupuesto completo con suministro de materiales homologados y mano de obra especializada en obra...';

  const proposal: TelegramMiniAppProposal = {
    leadId: business?.id || 'lead-001',
    businessName: bizName,
    municipality,
    primaryCategory: category,
    appInitials: initials,
    appName: aiProposal?.appName || `${bizName} AI`,
    appTagline: aiProposal?.appTagline || `Gestión Inteligente de Presupuestos y Pedidos`,
    assistantTitle: aiProposal?.assistantTitle || `Asistente Inteligente ${bizName}`,
    assistantSubtitle: aiProposal?.assistantSubtitle || `Genera presupuestos estructurados en segundos`,
    assistantDescription: aiProposal?.assistantDescription || `Escribe en lenguaje natural lo que necesitas presupuestar. La IA identificará los equipos, partidas de instalación, cruzará con el catálogo de precios y calculará la base imponible y el 21% de IVA.`,
    sampleInputPlaceholder: aiProposal?.sampleInputPlaceholder || defaultPlaceholder,
    catalogItemsCount: aiProposal?.catalogItemsCount || 64,
    quickExamples: Array.isArray(aiProposal?.quickExamples) && aiProposal.quickExamples.length === 3
      ? aiProposal.quickExamples
      : [
          { title: '⚡ Presupuesto Exprés en Obra', description: 'Cotización rápida de materiales y mano de obra' },
          { title: '⚡ Suministro habitual para cliente', description: 'Cálculo instantáneo con precios oficiales e IVA' },
          { title: '⚡ Mantenimiento / Reparación rápida', description: 'Desglose inmediato de horas de trabajo y repuestos' }
        ],
    tabs: ['Presupuestos', 'Facturas', 'Asistente IA', 'Clientes', 'Catálogo', 'Empresa'],
    keyBenefits: Array.isArray(aiProposal?.keyBenefits) && aiProposal.keyBenefits.length >= 3
      ? aiProposal.keyBenefits
      : [
          'Ahorro de hasta 6 horas semanales en redacción manual de cotizaciones',
          'Atención ágil desde Telegram sin que tus clientes tengan que descargar apps pesadas',
          'Generación de presupuestos en PDF con tu membrete oficial en 1 clic',
          'Cumplimiento RGPD y base de datos propia de clientes e historial'
        ],
    emailSubject: aiProposal?.emailSubject || `Propuesta de digitalización y MiniApp Telegram para ${bizName} (${municipality})`,
    emailBody: aiProposal?.emailBody || `Estimado equipo de ${bizName},

Nos ponemos en contacto con ustedes desde AhorraAI en Vigo tras analizar la presencia digital del sector de ${category.toLowerCase()} en ${municipality}.

Hemos comprobado que muchos profesionales y comercios de la comarca invierten entre 1 y 2 horas diarias respondiendo peticiones de presupuesto a mano por WhatsApp o teléfono, perdiendo clientes por falta de respuesta inmediata o por no disponer de un cotizador ágil.

Para solucionar esto, hemos desarrollado una tecnología de Asistente IA en Telegram (con el mismo modelo de éxito que ya utiliza ObraClima AI), que permite a su equipo o a sus propios clientes generar presupuestos y pedidos técnicos detallados en cuestión de segundos, simplemente escribiendo lo que necesitan.

📎 Les adjuntamos a este correo un breve documento PDF confidencial donde pueden ver:
1. El diagnóstico de digitalización preliminar de su negocio.
2. La maqueta visual exclusiva de cómo quedaría su propia MiniApp en Telegram personalizada con sus tarifas y servicios.

¿Dispondrían de 5 minutos esta semana para una breve demostración interactiva en el móvil sin ningún tipo de compromiso?

Quedamos a su disposición.

Atentamente,

Equipo de Consultoría y Digitalización B2B
AhorraAI Vigo - Soluciones de Inteligencia Artificial para Pymes
Email: ahorraai@gmail.com | Tel: 986 000 000
Vigo (Pontevedra)`
  ,
    generatedAt: new Date().toISOString()
  };

  return proposal;
}

/**
 * Genera el documento PDF A4 (2 páginas) con la propuesta comercial y la maqueta visual de la MiniApp
 */
export async function generateProposalPdfBuffer(proposal: TelegramMiniAppProposal): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Paleta moderna Telegram / Tech B2B
  const cDarkNavy = rgb(0.06, 0.09, 0.16); // #0f172a
  const cNavyCard = rgb(0.12, 0.16, 0.24); // #1e293b
  const cTelegramBlue = rgb(0.14, 0.54, 0.85); // #2481cc
  const cBlueAccent = rgb(0.23, 0.51, 0.96); // #3b82f6
  const cCyanGlow = rgb(0.22, 0.74, 0.97); // #38bdf8
  const cWhite = rgb(1, 1, 1);
  const cSlateLight = rgb(0.95, 0.96, 0.98); // #f1f5f9
  const cMuted = rgb(0.55, 0.62, 0.72); // #8c9eb8
  const cBorder = rgb(0.82, 0.86, 0.92);
  const cTextDark = rgb(0.12, 0.16, 0.22);
  const cGreenSuccess = rgb(0.09, 0.63, 0.43);

  // ==========================================
  // PÁGINA 1: PROPUESTA EJECUTIVA & DIAGNÓSTICO
  // ==========================================
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Barra superior decorativa
  page1.drawRectangle({
    x: 0,
    y: height - 8,
    width,
    height: 8,
    color: cTelegramBlue
  });

  // Cabecera Corporativa
  page1.drawText('AHORRA-AI  |  SOLUCIONES B2B GALICIA', {
    x: 40,
    y: height - 40,
    size: 9,
    font: fontBold,
    color: cTelegramBlue
  });

  page1.drawText('PROPUESTA DE DIGITALIZACION & MINIAPP TELEGRAM', {
    x: 40,
    y: height - 62,
    size: 16,
    font: fontBold,
    color: cDarkNavy
  });

  page1.drawText('Asistente Inteligente de Presupuestos & Gestion Comercial Modelo ObraClima AI', {
    x: 40,
    y: height - 76,
    size: 10,
    font: fontRegular,
    color: cMuted
  });

  // Tarjeta de datos del cliente
  const clientCardY = height - 155;
  page1.drawRectangle({
    x: 40,
    y: clientCardY,
    width: width - 80,
    height: 65,
    color: cSlateLight,
    borderColor: cBorder,
    borderWidth: 1
  });

  page1.drawText('DESTINATARIO:', {
    x: 55,
    y: clientCardY + 48,
    size: 8,
    font: fontBold,
    color: cMuted
  });

  page1.drawText(safePdf(proposal.businessName), {
    x: 55,
    y: clientCardY + 32,
    size: 13,
    font: fontBold,
    color: cDarkNavy
  });

  page1.drawText(`Sector: ${safePdf(proposal.primaryCategory)}  |  Ubicacion: ${safePdf(proposal.municipality)} (Pontevedra)`, {
    x: 55,
    y: clientCardY + 16,
    size: 9,
    font: fontRegular,
    color: cTextDark
  });

  page1.drawText(`Fecha: ${new Date().toLocaleDateString('es-ES')}  |  Modelo: Telegram MiniApp v4`, {
    x: width - 260,
    y: clientCardY + 48,
    size: 8,
    font: fontRegular,
    color: cMuted
  });

  // SECCIÓN 1: DIAGNÓSTICO DEL NEGOCIO
  let curY = clientCardY - 25;
  page1.drawText('1. DIAGNOSTICO DE OPORTUNIDAD COMERCIAL', {
    x: 40,
    y: curY,
    size: 12,
    font: fontBold,
    color: cDarkNavy
  });

  curY -= 15;
  page1.drawText(
    safePdf(`Tras auditar la presencia digital de ${proposal.businessName} en ${proposal.municipality}, hemos identificado un alto potencial`),
    { x: 40, y: curY, size: 9.5, font: fontRegular, color: cTextDark }
  );
  curY -= 14;
  page1.drawText(
    'para agilizar la captacion de presupuestos y la atencion a clientes mediante automatizacion conversacional:',
    { x: 40, y: curY, size: 9.5, font: fontRegular, color: cTextDark }
  );

  // 3 Cajas de Diagnóstico
  curY -= 65;
  const colW = (width - 80 - 20) / 3;

  // Caja 1
  page1.drawRectangle({
    x: 40,
    y: curY,
    width: colW,
    height: 55,
    color: rgb(0.98, 0.98, 1),
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1
  });
  page1.drawText('Presupuestos Lentos', { x: 50, y: curY + 38, size: 9, font: fontBold, color: cDarkNavy });
  page1.drawText('Hacer calculos a mano', { x: 50, y: curY + 24, size: 8, font: fontRegular, color: cMuted });
  page1.drawText('consume hasta 1-2h/dia', { x: 50, y: curY + 12, size: 8, font: fontRegular, color: cMuted });

  // Caja 2
  page1.drawRectangle({
    x: 40 + colW + 10,
    y: curY,
    width: colW,
    height: 55,
    color: rgb(0.98, 0.98, 1),
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1
  });
  page1.drawText('Sin Friccion de Descarga', { x: 50 + colW + 10, y: curY + 38, size: 9, font: fontBold, color: cDarkNavy });
  page1.drawText('En Telegram el cliente', { x: 50 + colW + 10, y: curY + 24, size: 8, font: fontRegular, color: cMuted });
  page1.drawText('no tiene que instalar nada', { x: 50 + colW + 10, y: curY + 12, size: 8, font: fontRegular, color: cMuted });

  // Caja 3
  page1.drawRectangle({
    x: 40 + (colW + 10) * 2,
    y: curY,
    width: colW,
    height: 55,
    color: rgb(0.98, 0.98, 1),
    borderColor: rgb(0.85, 0.88, 0.95),
    borderWidth: 1
  });
  page1.drawText('Catálogo & Precios al Dia', { x: 50 + (colW + 10) * 2, y: curY + 38, size: 9, font: fontBold, color: cDarkNavy });
  page1.drawText('Tarifas actualizadas y', { x: 50 + (colW + 10) * 2, y: curY + 24, size: 8, font: fontRegular, color: cMuted });
  page1.drawText('calculo de IVA automatico', { x: 50 + (colW + 10) * 2, y: curY + 12, size: 8, font: fontRegular, color: cMuted });

  // SECCIÓN 2: LA SOLUCIÓN TECNOLÓGICA (MINIAPP TELEGRAM)
  curY -= 35;
  page1.drawText('2. LA SOLUCION: MINIAPP TELEGRAM CON INTELIGENCIA ARTIFICIAL', {
    x: 40,
    y: curY,
    size: 12,
    font: fontBold,
    color: cDarkNavy
  });

  curY -= 15;
  page1.drawText(
    safePdf(`Basada en la arquitectura probada de "ObraClima AI", implementamos para ${proposal.businessName} una MiniApp`),
    { x: 40, y: curY, size: 9.5, font: fontRegular, color: cTextDark }
  );
  curY -= 14;
  page1.drawText(
    'dentro del propio Telegram de su empresa, accesible desde movil (iOS y Android) y ordenador sin coste de infraestructura:',
    { x: 40, y: curY, size: 9.5, font: fontRegular, color: cTextDark }
  );

  // Lista de Beneficios
  curY -= 20;
  for (let i = 0; i < proposal.keyBenefits.length; i++) {
    const b = proposal.keyBenefits[i];
    page1.drawRectangle({
      x: 42,
      y: curY - 2,
      width: 14,
      height: 14,
      color: rgb(0.9, 0.95, 1)
    });
    page1.drawText('V', { x: 46, y: curY + 1, size: 9, font: fontBold, color: cTelegramBlue });
    page1.drawText(safePdf(b), { x: 65, y: curY + 1, size: 9, font: fontRegular, color: cTextDark });
    curY -= 20;
  }

  // SECCIÓN 3: MODULOS OPERATIVOS INCLUIDOS
  curY -= 15;
  page1.drawText('3. MODULOS OPERATIVOS INCLUIDOS EN LA APLICACION', {
    x: 40,
    y: curY,
    size: 12,
    font: fontBold,
    color: cDarkNavy
  });

  curY -= 20;
  const modW = (width - 80 - 15) / 2;
  const modules = [
    { name: '1. Asistente IA en Lenguaje Natural', desc: 'Dicta o escribe lo que necesitas y la IA redacta el presupuesto con partidas e IVA.' },
    { name: '2. Catalogo de Articulos & Servicios', desc: `${proposal.catalogItemsCount} articulos/partidas configurables con margen de beneficio y precios actualizados.` },
    { name: '3. Gestion de Clientes & RGPD', desc: 'Historial por cliente y cumplimiento legal de proteccion de datos integrado.' },
    { name: '4. Generacion de PDF & Facturacion', desc: 'Descarga y envio de presupuestos y facturas oficiales con membrete en 1 clic.' }
  ];

  for (let m = 0; m < modules.length; m++) {
    const isRight = m % 2 === 1;
    const row = Math.floor(m / 2);
    const mx = isRight ? 40 + modW + 15 : 40;
    const my = curY - row * 45;

    page1.drawRectangle({
      x: mx,
      y: my - 30,
      width: modW,
      height: 40,
      color: cSlateLight,
      borderColor: cBorder,
      borderWidth: 1
    });

    page1.drawText(safePdf(modules[m].name), { x: mx + 10, y: my - 6, size: 8.5, font: fontBold, color: cDarkNavy });
    page1.drawText(safePdf(modules[m].desc), { x: mx + 10, y: my - 20, size: 7.5, font: fontRegular, color: cMuted });
  }

  // Pie de página 1
  page1.drawRectangle({
    x: 40,
    y: 35,
    width: width - 80,
    height: 40,
    color: rgb(0.95, 0.98, 1),
    borderColor: cTelegramBlue,
    borderWidth: 0.8
  });
  page1.drawText('VER PAGINA SIGUIENTE: MAQUETA VISUAL PRELIMINAR DE SU MINIAPP TELEGRAM', {
    x: 75,
    y: 52,
    size: 9,
    font: fontBold,
    color: cTelegramBlue
  });
  page1.drawText('Propuesta tecnica y confidencial elaborada por AhorraAI para ' + safePdf(proposal.businessName), {
    x: 105,
    y: 40,
    size: 7.5,
    font: fontRegular,
    color: cMuted
  });

  // =========================================================================
  // PÁGINA 2: MAQUETA GRÁFICA VECTORIAL FIEL A LA MINIAPP TELEGRAM (OBRACLIMA)
  // =========================================================================
  const page2 = pdfDoc.addPage([595.28, 841.89]);

  // Barra superior decorativa
  page2.drawRectangle({
    x: 0,
    y: height - 8,
    width,
    height: 8,
    color: cTelegramBlue
  });

  page2.drawText('SIMULACION GRAFICA: MINIAPP TELEGRAM EXCLUSIVA', {
    x: 40,
    y: height - 38,
    size: 13,
    font: fontBold,
    color: cDarkNavy
  });

  page2.drawText(`Diseno y arquitectura adaptada para ${safePdf(proposal.businessName)} (Modelo ObraClima AI)`, {
    x: 40,
    y: height - 52,
    size: 9.5,
    font: fontRegular,
    color: cMuted
  });

  // MARCO DE LA MINIAPP EN TELEGRAM (Simulación de ventana Web / MiniApp oscura)
  const appX = 55;
  const appY = 70;
  const appW = width - 110; // ~485 pts
  const appH = height - 145; // ~625 pts

  // 1. Sombra / Borde exterior de la ventana
  page2.drawRectangle({
    x: appX - 2,
    y: appY - 2,
    width: appW + 4,
    height: appH + 4,
    color: rgb(0.04, 0.07, 0.12)
  });

  // 2. Fondo general oscuro de la app de Telegram (Slate 950 / 900)
  page2.drawRectangle({
    x: appX,
    y: appY,
    width: appW,
    height: appH,
    color: cDarkNavy
  });

  // 3. BARRA SUPERIOR DE LA MINIAPP (Header con Avatar y botones Telegram)
  const headerH = 50;
  const headerY = appY + appH - headerH;

  page2.drawRectangle({
    x: appX,
    y: headerY,
    width: appW,
    height: headerH,
    color: rgb(0.09, 0.13, 0.22)
  });

  // Avatar / Logo en azul con iniciales (como el "OC" de ObraClima)
  const avatarSize = 34;
  page2.drawRectangle({
    x: appX + 14,
    y: headerY + (headerH - avatarSize) / 2,
    width: avatarSize,
    height: avatarSize,
    color: cBlueAccent
  });

  page2.drawText(safePdf(proposal.appInitials), {
    x: appX + 22,
    y: headerY + 18,
    size: 13,
    font: fontBold,
    color: cWhite
  });

  // Nombre de la App y Badge "MiniApp Telegram"
  page2.drawText(safePdf(proposal.appName), {
    x: appX + 56,
    y: headerY + 28,
    size: 12,
    font: fontBold,
    color: cWhite
  });

  // Badge MiniApp Telegram
  page2.drawRectangle({
    x: appX + 56 + (proposal.appName.length * 7),
    y: headerY + 27,
    width: 82,
    height: 12,
    color: rgb(0.12, 0.35, 0.65)
  });
  page2.drawText('MiniApp Telegram', {
    x: appX + 60 + (proposal.appName.length * 7),
    y: headerY + 29.5,
    size: 7,
    font: fontBold,
    color: rgb(0.7, 0.88, 1)
  });

  page2.drawText(safePdf(proposal.appTagline), {
    x: appX + 56,
    y: headerY + 12,
    size: 8,
    font: fontRegular,
    color: cMuted
  });

  // Botón simulado "Telegram Web"
  page2.drawRectangle({
    x: appX + appW - 100,
    y: headerY + 14,
    width: 85,
    height: 22,
    color: cTelegramBlue
  });
  page2.drawText('Telegram Web', {
    x: appX + appW - 88,
    y: headerY + 20,
    size: 8,
    font: fontBold,
    color: cWhite
  });

  // 4. CARD PRINCIPAL DEL ASISTENTE INTELIGENTE (Caja oscura con borde azul)
  const cardMargin = 16;
  const cardW = appW - (cardMargin * 2);
  const cardH = appH - headerH - 85;
  const cardX = appX + cardMargin;
  const cardY = appY + 60;

  page2.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: cNavyCard,
    borderColor: rgb(0.18, 0.28, 0.44),
    borderWidth: 1.2
  });

  // Icono Sparkles / Asistente IA
  page2.drawRectangle({
    x: cardX + 16,
    y: cardY + cardH - 38,
    width: 26,
    height: 26,
    color: cBlueAccent
  });
  page2.drawText('*', {
    x: cardX + 24,
    y: cardY + cardH - 33,
    size: 18,
    font: fontBold,
    color: cWhite
  });

  // Título Asistente Inteligente
  page2.drawText(safePdf(proposal.assistantTitle), {
    x: cardX + 50,
    y: cardY + cardH - 26,
    size: 13,
    font: fontBold,
    color: cWhite
  });

  page2.drawText(safePdf(proposal.assistantSubtitle), {
    x: cardX + 50,
    y: cardY + cardH - 38,
    size: 8.5,
    font: fontRegular,
    color: cCyanGlow
  });

  // Explicación de cómo la IA procesa
  const descY = cardY + cardH - 58;
  page2.drawText(
    safePdf('Escribe en lenguaje natural lo que necesitas presupuestar. La IA identificara los articulos,'),
    { x: cardX + 16, y: descY, size: 8, font: fontRegular, color: cMuted }
  );
  page2.drawText(
    safePdf('partidas tecnicas, cruzara con el catalogo de precios y calculara la base imponible y el 21% de IVA.'),
    { x: cardX + 16, y: descY - 11, size: 8, font: fontRegular, color: cMuted }
  );

  // Campo Selector "Asignar Cliente al Presupuesto"
  const clientSelY = descY - 44;
  page2.drawText('Asignar Cliente al Presupuesto:', {
    x: cardX + 16,
    y: clientSelY + 8,
    size: 8,
    font: fontBold,
    color: rgb(0.8, 0.85, 0.95)
  });

  // Badge RGPD
  page2.drawText('RGPD: Datos locales protegidos', {
    x: cardX + cardW - 145,
    y: clientSelY + 8,
    size: 7,
    font: fontBold,
    color: cGreenSuccess
  });

  // Selector desplegable simulado
  page2.drawRectangle({
    x: cardX + 16,
    y: clientSelY - 18,
    width: cardW - 32,
    height: 22,
    color: rgb(0.08, 0.12, 0.18),
    borderColor: rgb(0.25, 0.35, 0.5),
    borderWidth: 1
  });
  page2.drawText(`Cliente Seleccionado: Particular / Obra ${safePdf(proposal.municipality)}`, {
    x: cardX + 24,
    y: clientSelY - 11,
    size: 8,
    font: fontRegular,
    color: cWhite
  });

  // TEXTAREA / CAJA DE ENTRADA CON EL EJEMPLO DEL SECTOR
  const inputY = clientSelY - 105;
  const inputH = 75;

  page2.drawRectangle({
    x: cardX + 16,
    y: inputY,
    width: cardW - 32,
    height: inputH,
    color: rgb(0.07, 0.1, 0.16),
    borderColor: rgb(0.2, 0.35, 0.6),
    borderWidth: 1.2
  });

  page2.drawText(safePdf(proposal.sampleInputPlaceholder.slice(0, 75)), {
    x: cardX + 24,
    y: inputY + inputH - 18,
    size: 8,
    font: fontRegular,
    color: rgb(0.65, 0.75, 0.88)
  });
  if (proposal.sampleInputPlaceholder.length > 75) {
    page2.drawText(safePdf(proposal.sampleInputPlaceholder.slice(75, 150)), {
      x: cardX + 24,
      y: inputY + inputH - 30,
      size: 8,
      font: fontRegular,
      color: rgb(0.65, 0.75, 0.88)
    });
  }

  // Fila de catálogo + Botón azul grande "Generar Presupuesto"
  const btnRowY = inputY - 32;
  page2.drawText(`${proposal.catalogItemsCount} articulos en catalogo activo`, {
    x: cardX + 18,
    y: btnRowY + 8,
    size: 8,
    font: fontRegular,
    color: cMuted
  });

  // Botón Generar Presupuesto
  const genBtnW = 145;
  page2.drawRectangle({
    x: cardX + cardW - 16 - genBtnW,
    y: btnRowY - 4,
    width: genBtnW,
    height: 26,
    color: cBlueAccent
  });
  page2.drawText('> Generar Presupuesto', {
    x: cardX + cardW - 16 - genBtnW + 16,
    y: btnRowY + 4,
    size: 9,
    font: fontBold,
    color: cWhite
  });

  // Sección "Ejemplos rápidos:"
  const quickY = btnRowY - 22;
  page2.drawText('Ejemplos rapidos:', {
    x: cardX + 16,
    y: quickY,
    size: 8,
    font: fontBold,
    color: rgb(0.8, 0.85, 0.92)
  });

  // 3 botones / píldoras rápidas
  const qBtnH = 22;
  const qBtnW = (cardW - 32 - 16) / 2;
  for (let q = 0; q < Math.min(2, proposal.quickExamples.length); q++) {
    const qx = cardX + 16 + q * (qBtnW + 16);
    const qy = quickY - 30;

    page2.drawRectangle({
      x: qx,
      y: qy,
      width: qBtnW,
      height: qBtnH,
      color: rgb(0.08, 0.13, 0.22),
      borderColor: rgb(0.25, 0.38, 0.58),
      borderWidth: 0.8
    });

    page2.drawText(safePdf(proposal.quickExamples[q].title.slice(0, 32)), {
      x: qx + 8,
      y: qy + 7,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.9, 0.8, 0.4) // Dorado suave / llamativo
    });
  }

  // 5. BARRA DE NAVEGACIÓN INFERIOR (Bottom Bar - Tabs como en ObraClima)
  const bBarH = 45;
  const bBarY = appY + 5;
  page2.drawRectangle({
    x: appX,
    y: bBarY,
    width: appW,
    height: bBarH,
    color: rgb(0.06, 0.08, 0.14),
    borderColor: rgb(0.15, 0.2, 0.3),
    borderWidth: 0.8
  });

  const tabWidth = appW / 6;
  const tabNames = ['Presup.', 'Facturas', 'Asistente IA', 'Clientes', 'Catalogo', 'Empresa'];
  for (let t = 0; t < tabNames.length; t++) {
    const tx = appX + t * tabWidth;
    const isAssistant = t === 2; // Asistente IA activo

    if (isAssistant) {
      // Indicador de pestaña activa en azul
      page2.drawRectangle({
        x: tx + 6,
        y: bBarY + 4,
        width: tabWidth - 12,
        height: bBarH - 8,
        color: rgb(0.12, 0.25, 0.45)
      });
    }

    page2.drawText(tabNames[t], {
      x: tx + (isAssistant ? 10 : 12),
      y: bBarY + 16,
      size: isAssistant ? 8 : 7.5,
      font: isAssistant ? fontBold : fontRegular,
      color: isAssistant ? cCyanGlow : cMuted
    });
  }

  // Identificador del Bot de Telegram en el pie
  page2.drawText(`@ahorraaivigoasistant_bot  |  Ecosistema Inteligente de Galicia`, {
    x: appX + (appW / 2) - 120,
    y: appY - 14,
    size: 8,
    font: fontRegular,
    color: cMuted
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Envía el email con la propuesta y el PDF adjunto de forma nativa
 */
export async function sendProposalEmailNative({
  recipientEmail,
  proposal,
  pdfBuffer
}: {
  recipientEmail: string;
  proposal: TelegramMiniAppProposal;
  pdfBuffer: Buffer;
}) {
  const filename = `Propuesta_${proposal.businessName.replace(/[^a-zA-Z0-9]/g, '_')}_MiniApp.pdf`;

  return await sendOfficialEmailWithNativePdfAttachment({
    to: [recipientEmail],
    subject: proposal.emailSubject,
    body: proposal.emailBody,
    pdfBuffer,
    pdfFilename: filename,
    docNumber: 'PROP-2026',
    type: 'presupuesto'
  });
}
