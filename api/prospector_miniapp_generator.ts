import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { isGeminiAvailable, handleGeminiError } from './geminiBreaker';
import { LeadMiniAppConfig, LeadWebsitePrototype } from './prospector_miniapp_types';

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

function getSectorColorTheme(category: string): { primary: string; secondary: string; accent: string } {
  const cat = (category || '').toLowerCase();
  if (cat.includes('clima') || cat.includes('fontan') || cat.includes('calefac') || cat.includes('gas')) {
    return { primary: '#0284c7', secondary: '#0369a1', accent: '#38bdf8' }; // Sky Blue
  }
  if (cat.includes('electr') || cat.includes('solar') || cat.includes('energ')) {
    return { primary: '#eab308', secondary: '#ca8a04', accent: '#fde047' }; // Amber/Gold
  }
  if (cat.includes('carpint') || cat.includes('mader') || cat.includes('reforma') || cat.includes('construc')) {
    return { primary: '#d97706', secondary: '#b45309', accent: '#f59e0b' }; // Wood/Warm Amber
  }
  if (cat.includes('pintur') || cat.includes('decor')) {
    return { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa' }; // Violet
  }
  if (cat.includes('taller') || cat.includes('mecanic') || cat.includes('auto')) {
    return { primary: '#475569', secondary: '#334155', accent: '#0284c7' }; // Slate / Steel
  }
  if (cat.includes('jardin') || cat.includes('paisaj') || cat.includes('agric')) {
    return { primary: '#16a34a', secondary: '#15803d', accent: '#4ade80' }; // Emerald
  }
  return { primary: '#2563eb', secondary: '#1d4ed8', accent: '#60a5fa' }; // Royal Blue default
}

function runWithTimeout<T>(promise: Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout de IA tras ${ms}ms`)), ms))
  ]);
}

/**
 * Genera la configuración personalizada de la MiniApp para un lead
 */
export async function generateMiniAppForLead(lead: any, baseUrl: string = ''): Promise<LeadMiniAppConfig> {
  const bizName = lead.name || 'Empresa Local';
  const municipality = lead.municipality || 'Vigo';
  const category = lead.primary_category || 'Construcción y Reformas';
  const initials = extractInitials(bizName);
  const colorTheme = getSectorColorTheme(category);

  // Generar token único y PIN seguro para el cliente
  const token = `lead_${crypto.randomBytes(6).toString('hex')}`;
  const accessCode = `VIGO-${Math.floor(1000 + Math.random() * 9000)}`;

  let aiData: any = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && isGeminiAvailable()) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Diseña la arquitectura de una MiniApp de Telegram para el siguiente autónomo o pyme de Galicia:
NEGOCIO: ${bizName}
SECTOR: ${category}
MUNICIPIO: ${municipality} (Pontevedra)
TELÉFONO: ${lead.phone || 'No especificado'}

Tomando como referencia el modelo operativo de "ObraClima" (presupuestador por IA, catálogo de precios, gestión de clientes y generación de facturas):
1. Crea un catálogo inicial realista de 8 a 12 productos o partidas de mano de obra típicas de su sector en Galicia, con precios de mercado en euros, unidades (ud, m2, ml, hora, etc.).
2. Define ejemplos rápidos de cotización por voz/texto adaptados a su oficio.
3. Devuelve estrictamente un JSON válido con la siguiente estructura:

{
  "appName": "${bizName} AI",
  "appTagline": "Gestión Inteligente de Presupuestos y Pedidos",
  "assistantTitle": "Asistente Inteligente ${bizName}",
  "assistantSubtitle": "Cotizaciones y presupuestos en segundos para clientes de ${municipality}",
  "assistantDescription": "Describe en lenguaje natural lo que necesitas presupuestar. La IA cruzará las partidas con tu catálogo oficial y calculará la base imponible y el 21% de IVA.",
  "sampleInputPlaceholder": "Ejemplo realista adaptado...",
  "quickExamples": [
    { "title": "⚡ Ejemplo 1", "description": "Detalle breve...", "query": "Texto completo a procesar..." },
    { "title": "⚡ Ejemplo 2", "description": "Detalle breve...", "query": "Texto completo a procesar..." },
    { "title": "⚡ Ejemplo 3", "description": "Detalle breve...", "query": "Texto completo a procesar..." }
  ],
  "catalog": [
    { "sku": "PART-01", "name": "Nombre partida/material", "category": "Mano de Obra o Material", "description": "Detalle", "unit": "hora", "price": 45.0, "recommended": true },
    { "sku": "PART-02", "name": "Nombre partida/material", "category": "Instalación", "description": "Detalle", "unit": "ud", "price": 120.0, "recommended": false }
  ]
}`;

      for (const modelName of ['gemini-3.8-flash', 'gemini-3.1-flash-lite']) {
        try {
          const res = await runWithTimeout(ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
          }), 6000);
          if (res?.text) {
            const cleaned = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
            aiData = JSON.parse(cleaned);
            break;
          }
        } catch (mErr) {
          const { shouldBreak } = handleGeminiError(mErr, modelName);
          if (shouldBreak) break;
        }
      }
    } catch (err: any) {
      console.warn('[MiniApp Generator Notice]: Usando generador heurístico:', err.message);
    }
  }

  // Fallback con Groq si Gemini no arrojó resultado
  if (!aiData && process.env.GROQ_API_KEY) {
    try {
      const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [{
            role: 'user',
            content: `Genera en JSON catálogo de 8 partidas y textos de asistente para ${bizName} (${category}) en ${municipality}. Formato: {"appName": "...", "appTagline": "...", "assistantTitle": "...", "assistantSubtitle": "...", "assistantDescription": "...", "sampleInputPlaceholder": "...", "quickExamples": [{"title": "...", "description": "...", "query": "..."}], "catalog": [{"sku": "P-01", "name": "...", "category": "...", "description": "...", "unit": "ud", "price": 50, "recommended": true}]}`
          }],
          response_format: { type: 'json_object' }
        })
      });
      if (gRes.ok) {
        const data = await gRes.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          aiData = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
        }
      }
    } catch {
      // Ignorar y seguir a heurístico
    }
  }

  // Fallback heurístico con catálogo sectorial rico
  const defaultCatalog = [
    {
      id: 'cat-1',
      sku: 'MO-OF1',
      name: `Mano de obra oficial ${category.toLowerCase()}`,
      category: 'Mano de Obra',
      description: `Hora de oficial especializado en ${municipality} y alrededores`,
      unit: 'hora',
      price: 36.00,
      recommended: true
    },
    {
      id: 'cat-2',
      sku: 'DESP-VIGO',
      name: 'Desplazamiento y diagnosis técnica',
      category: 'Servicio',
      description: 'Inspección técnica in situ y toma de medidas en área de Pontevedra',
      unit: 'servicio',
      price: 35.00,
      recommended: false
    },
    {
      id: 'cat-3',
      sku: 'MAT-BAS-01',
      name: 'Kit de consumibles y fijaciones homologadas',
      category: 'Materiales',
      description: 'Tornillería, sellantes, tacos y elementos de fijación según normativa',
      unit: 'pack',
      price: 28.50,
      recommended: false
    },
    {
      id: 'cat-4',
      sku: 'REP-URG',
      name: 'Intervención de mantenimiento urgente',
      category: 'Urgencias',
      description: 'Atención prioritaria para reparación o sustitución inmediata',
      unit: 'actuación',
      price: 95.00,
      recommended: true
    },
    {
      id: 'cat-5',
      sku: 'SUM-PART-01',
      name: `Suministro e instalación estándar de equipo/material`,
      category: 'Instalación Completa',
      description: `Montaje con pruebas de estanqueidad y garantía de 2 años`,
      unit: 'ud',
      price: 240.00,
      recommended: true
    },
    {
      id: 'cat-6',
      sku: 'CERT-BOL',
      name: 'Emisión de boletín técnico / memoria valorada',
      category: 'Gestión Técnica',
      description: 'Legalización y registro conforme a industria',
      unit: 'documento',
      price: 110.00,
      recommended: false
    }
  ];

  const processedCatalog = Array.isArray(aiData?.catalog) && aiData.catalog.length >= 4
    ? aiData.catalog.map((item: any, idx: number) => ({
        id: `cat-${idx + 1}`,
        sku: item.sku || `SKU-${idx + 1}`,
        name: item.name || 'Servicio o Producto',
        category: item.category || 'General',
        description: item.description || '',
        unit: item.unit || 'ud',
        price: Number(item.price) || 45.0,
        recommended: !!item.recommended
      }))
    : defaultCatalog;

  const quickExamples = Array.isArray(aiData?.quickExamples) && aiData.quickExamples.length >= 2
    ? aiData.quickExamples
    : [
        {
          title: `⚡ Presupuesto Exprés en ${municipality}`,
          description: 'Suministro estándar con 3 horas de mano de obra y desplazamiento',
          query: `Suministro e instalación estándar para cliente en ${municipality} con 3 horas de mano de obra y desplazamiento.`
        },
        {
          title: '⚡ Mantenimiento e Inspección',
          description: 'Revisión preventiva anual y kit de consumibles',
          query: 'Revisión y puesta a punto completa con kit de fijaciones y 2 horas de oficial.'
        },
        {
          title: '⚡ Reparación con Materiales',
          description: 'Intervención de mantenimiento urgente con certificación',
          query: 'Intervención urgente con sustitución de pieza y emisión de boletín técnico.'
        }
      ];

  const cleanPhone = (lead.phone || '').replace(/[^\d+]/g, '');
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : undefined;

  const config: LeadMiniAppConfig = {
    token,
    accessCode,
    appName: aiData?.appName || `${bizName} AI`,
    appTagline: aiData?.appTagline || `Gestor Inteligente de Presupuestos • ${municipality}`,
    brandColor: colorTheme.primary,
    brandSecondaryColor: colorTheme.secondary,
    appInitials: initials,
    sector: category,
    companyName: bizName,
    cif: lead.cif || undefined,
    address: lead.address || `${municipality}, Pontevedra`,
    municipality,
    phone: lead.phone || undefined,
    email: lead.email || undefined,
    whatsappUrl,
    assistantTitle: aiData?.assistantTitle || `Asistente Inteligente ${bizName}`,
    assistantSubtitle: aiData?.assistantSubtitle || `Cotizaciones en segundos para ${category.toLowerCase()}`,
    assistantDescription: aiData?.assistantDescription || `Escribe o dicta lo que necesitas presupuestar. La IA cruzará las partidas con tu catálogo oficial y calculará la base imponible y el 21% de IVA.`,
    sampleInputPlaceholder: aiData?.sampleInputPlaceholder || `Ej: 2 unidades de instalación con 4 horas de oficial y desplazamiento a ${municipality}...`,
    quickExamples,
    catalog: processedCatalog,
    defaultIva: 21,
    tabs: ['Presupuestos', 'Facturas', 'Asistente IA', 'Clientes', 'Catálogo', 'Empresa'],
    features: [
      'Presupuestador con IA por texto y dictado de voz',
      'Catálogo de tarifas oficial integrado',
      'Generación de presupuestos y facturas en PDF con membrete',
      'Acceso privado para el equipo mediante Telegram o navegador',
      'Envío directo a clientes por WhatsApp y correo electrónico'
    ],
    telegramStartUrl: `https://t.me/ahorraaivigoasistant_bot?start=lead_${lead.id}`,
    directWebUrl: `${baseUrl}/miniapp/${lead.id}?token=${token}`,
    generatedAt: new Date().toISOString()
  };

  return config;
}

/**
 * Genera el prototipo web interactivo completo para leads que no tienen web
 */
export async function generateWebsitePrototypeForLead(
  lead: any,
  miniAppConfig?: LeadMiniAppConfig,
  baseUrl: string = ''
): Promise<LeadWebsitePrototype> {
  const bizName = lead.name || 'Empresa de Confianza';
  const municipality = lead.municipality || 'Vigo';
  const category = lead.primary_category || 'Servicios Profesionales';
  const colorTheme = getSectorColorTheme(category);
  const rating = lead.rating || 4.8;
  const reviewCount = lead.user_ratings_total || 24;

  let aiWeb: any = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && isGeminiAvailable()) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Actúa como diseñador web y copywriter de élite para empresas locales en Galicia.
Tu objetivo es diseñar los contenidos y estructura de una página web moderna, ultra-profesional y persuasiva para este negocio de Pontevedra que NO TIENE PÁGINA WEB:

DATOS DEL NEGOCIO:
- Nombre: ${bizName}
- Municipio: ${municipality} (Pontevedra, Galicia)
- Categoría: ${category}
- Dirección: ${lead.address || municipality}
- Teléfono: ${lead.phone || 'Atención telefónica directa'}
- Valoración Google: ${rating} estrellas (${reviewCount} opiniones)

INSTRUCCIONES:
1. Redacta textos locales y creíbles (menciona Vigo, Pontevedra, comarca, calidad y trato cercano).
2. Estructura 4 servicios destacados con título y descripción comercial.
3. Redacta 4 motivos diferenciadores ("Por qué elegirnos").
4. Genera 3 testimonios verosímiles de clientes locales satisfechos.
5. Genera 4 preguntas frecuentes (FAQ) resueltas de forma clara.
6. Devuelve estrictamente un JSON válido con esta estructura:

{
  "tagline": "Slogan comercial conciso...",
  "headline": "Titular principal de impacto para la cabecera...",
  "subheadline": "Subtítulo explicativo con propuesta de valor...",
  "heroCtaText": "Pedir Presupuesto Sin Compromiso",
  "heroBadge": "Líderes en ${municipality} y comarca",
  "aboutStory": "Historia de 2-3 párrafos destacando compromiso, materiales de primera calidad y equipo técnico local...",
  "yearsInBusiness": "Más de 15 años de experiencia",
  "services": [
    { "id": "s1", "title": "Servicio 1", "description": "Descripción clara...", "badge": "Más solicitado" },
    { "id": "s2", "title": "Servicio 2", "description": "Descripción...", "badge": "Garantizado" },
    { "id": "s3", "title": "Servicio 3", "description": "Descripción...", "badge": "Rápido" },
    { "id": "s4", "title": "Servicio 4", "description": "Descripción...", "badge": "A medida" }
  ],
  "whyChooseUs": [
    { "title": "Presupuesto Claro y Sin Sorpresas", "description": "Detalle..." },
    { "title": "Garantía Oficial por Escrito", "description": "Detalle..." },
    { "title": "Rapidez y Puntualidad", "description": "Detalle..." },
    { "title": "Atención Cercana y Personalizada", "description": "Detalle..." }
  ],
  "testimonials": [
    { "name": "Manuel R.", "location": "${municipality}", "rating": 5, "comment": "Excelente trabajo, puntuales y muy formales...", "service": "Reforma completa" },
    { "name": "Carmen D.", "location": "Redondela", "rating": 5, "comment": "Muy recomendables, me dieron solución en el mismo día...", "service": "Instalación técnica" },
    { "name": "Javier M.", "location": "Cangas", "rating": 5, "comment": "Profesionales de confianza. Presupuesto detallado...", "service": "Mantenimiento" }
  ],
  "faq": [
    { "question": "¿Cuánto tardan en dar presupuesto?", "answer": "En menos de 24 horas laborables..." },
    { "question": "¿Trabajan en toda la provincia de Pontevedra?", "answer": "Sí, cubrimos Vigo, Pontevedra, Val Miñor, O Morrazo..." },
    { "question": "¿Tienen garantía los trabajos?", "answer": "Todos nuestros servicios cuentan con garantía oficial..." },
    { "question": "¿Puedo solicitar presupuesto por WhatsApp o Telegram?", "answer": "Sí, disponemos de asistente inteligente para cotizaciones inmediatas." }
  ]
}`;

      for (const modelName of ['gemini-3.8-flash', 'gemini-3.1-flash-lite']) {
        try {
          const res = await runWithTimeout(ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' }
          }), 6000);
          if (res?.text) {
            const cleaned = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
            aiWeb = JSON.parse(cleaned);
            break;
          }
        } catch (mErr) {
          const { shouldBreak } = handleGeminiError(mErr, modelName);
          if (shouldBreak) break;
        }
      }
    } catch (err: any) {
      console.warn('[Website Prototype Generator Notice]: Usando generador heurístico:', err.message);
    }
  }

  // Fallback heurístico si no hay respuesta de IA
  const headline = aiWeb?.headline || `${category} de Máxima Confianza en ${municipality}`;
  const subheadline = aiWeb?.subheadline || `Especialistas en soluciones integrales para particulares y empresas en Vigo y toda la provincia de Pontevedra. Presupuestos sin compromiso y garantía total.`;
  const aboutStory = aiWeb?.aboutStory || `En ${bizName} llevamos años ofreciendo un servicio profesional, honesto y de alta calidad a los vecinos y empresas de ${municipality} y alrededores. Creemos en el trabajo bien hecho, el cumplimiento estricto de los plazos acordados y la utilización de materiales homologados de primera línea. Nuestro compromiso es tu tranquilidad.`;

  const services = Array.isArray(aiWeb?.services) && aiWeb.services.length >= 3
    ? aiWeb.services
    : [
        {
          id: 's1',
          title: `Instalaciones y Montajes de ${category}`,
          description: `Servicio integral de instalación adaptado a viviendas, locales comerciales y comunidades de vecinos en ${municipality}.`,
          badge: 'Servicio Estrella'
        },
        {
          id: 's2',
          title: 'Reparaciones y Mantenimiento Técnico',
          description: 'Diagnóstico preciso y resolución de averías con repuestos originales y máxima rapidez.',
          badge: 'Urgencias y Cuidado'
        },
        {
          id: 's3',
          title: 'Proyectos a Medida y Reformas',
          description: 'Asesoramiento personalizado desde la planificación hasta los acabados finales con garantía por escrito.',
          badge: 'A Medida'
        },
        {
          id: 's4',
          title: 'Presupuestos Detallados con IA',
          description: 'Cotizaciones instantáneas y transparentes desglosando partidas, materiales y mano de obra sin sorpresas.',
          badge: 'Digital'
        }
      ];

  const whyChooseUs = Array.isArray(aiWeb?.whyChooseUs) && aiWeb.whyChooseUs.length >= 3
    ? aiWeb.whyChooseUs
    : [
        { title: 'Presupuesto en 24h Sin Compromiso', description: 'Evaluamos tu caso y te entregamos un documento transparente con precios cerrados.' },
        { title: 'Garantía Oficial en Cada Trabajo', description: 'Todos nuestros trabajos están respaldados por factura oficial y cobertura total.' },
        { title: 'Profesionales Locales Cualificados', description: `Conocemos de primera mano las necesidades constructivas y climáticas de ${municipality}.` },
        { title: 'Atención Directa por WhatsApp y Telegram', description: 'Comunicación fluida y directa sin intermediarios ni esperas telefónicas.' }
      ];

  const testimonials = Array.isArray(aiWeb?.testimonials) && aiWeb.testimonials.length >= 2
    ? aiWeb.testimonials
    : [
        { name: 'Xurxo Álvarez', location: `${municipality}`, rating: 5, comment: 'Puntualidad absoluta y presupuesto muy detallado. Dejaron todo impecable al terminar.', service: 'Instalación completa' },
        { name: 'María Dolores C.', location: 'Vigo', rating: 5, comment: 'Excelente trato humano y profesional. Es de agradecer encontrar a gente tan cumplidora.', service: 'Reparación y puesta a punto' },
        { name: 'Alberto V.', location: 'Pontevedra', rating: 5, comment: 'Resolvieron la avería en el mismo día. Gran rapidez y transparencia en los costes.', service: 'Mantenimiento' }
      ];

  const faq = Array.isArray(aiWeb?.faq) && aiWeb.faq.length >= 2
    ? aiWeb.faq
    : [
        { question: '¿Cómo solicito un presupuesto?', answer: `Puedes llamarnos directamente, escribirnos por WhatsApp o utilizar nuestro asistente inteligente en Telegram para obtener una valoración en minutos.` },
        { question: `¿En qué zonas de Galicia trabajáis?`, answer: `Trabajamos habitualmente en ${municipality}, Vigo, Redondela, Cangas, Moaña, Pontevedra capital y todo el área metropolitana.` },
        { question: '¿Los presupuestos tienen algún coste?', answer: 'No, la elaboración del presupuesto orientativo inicial es completamente gratuita y sin ningún compromiso.' },
        { question: '¿Ofrecéis facilidades de pago o financiación?', answer: 'Consultamos cada caso particular para ofrecer las condiciones más cómodas en proyectos de envergadura.' }
      ];

  const prototype: LeadWebsitePrototype = {
    leadId: lead.id,
    businessName: bizName,
    municipality,
    primaryCategory: category,
    tagline: aiWeb?.tagline || `Tu profesional de confianza en ${municipality}`,
    headline,
    subheadline,
    heroCtaText: aiWeb?.heroCtaText || 'Solicitar Presupuesto Online',
    heroBadge: aiWeb?.heroBadge || `Profesionales Verificados en ${municipality}`,
    phone: lead.phone || undefined,
    address: lead.address || `${municipality}, Pontevedra`,
    email: lead.email || undefined,
    rating,
    reviewCount,
    aboutStory,
    yearsInBusiness: aiWeb?.yearsInBusiness || 'Más de 10 años de experiencia',
    services,
    whyChooseUs,
    testimonials,
    faq,
    colorTheme,
    telegramMiniAppUrl: miniAppConfig?.directWebUrl || `https://t.me/ahorraaivigoasistant_bot?start=lead_${lead.id}`,
    previewUrl: `${baseUrl}/prototype/${lead.id}`,
    generatedAt: new Date().toISOString()
  };

  return prototype;
}
