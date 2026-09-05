import { vigoToolExecutor } from './VigoToolExecutor.js';
import { vigoContextService } from './VigoContextService.js';
import { vigoTimeResolver } from './VigoTimeResolver.js';
import type { 
  AgentExecutionPlan, 
  AgentStructuredResponse, 
  IntentCategory, 
  PlannedAction, 
  RetrievedFact, 
  DataSourceType,
  ToolExecutionTrace,
  AgentDebugTrace
} from './types.js';

export interface UserSessionConfig {
  language?: string;
  userType?: 'tourist' | 'local' | 'business';
  companion?: 'alone' | 'couple' | 'family' | 'friends';
  interests?: string[];
  timeAvailable?: string;
  origin?: string;
  destination?: string;
  selectedZone?: string;
}

export class VigoAgentPlanner {
  private generateAIFn: ((messages: any[], systemInstruction: string) => Promise<string>) | null = null;

  setAIGenerator(fn: (messages: any[], systemInstruction: string) => Promise<string>) {
    this.generateAIFn = fn;
  }

  /**
   * 1. COMPRENSIÓN DE INTENCIÓN Y PLANIFICACIÓN DETERMINISTA
   */
  analyzeIntent(query: string, config?: UserSessionConfig): AgentExecutionPlan {
    const q = query.toLowerCase().trim();
    const intents: IntentCategory[] = [];
    const actions: PlannedAction[] = [];

    // Resolución temporal estricta con TimeResolver (Europe/Madrid)
    const temporalRes = vigoTimeResolver.resolveTemporal(query);

    // Detección de zonas geográficas de Vigo
    const detectedZone = vigoContextService.findZone(q)?.name || config?.selectedZone;

    // Patrones de detección de intención
    const isParking = q.includes('parking') || q.includes('aparcar') || q.includes('aparca') || q.includes('garaje') || q.includes('plazas');
    const isTraffic = q.includes('tráfico') || q.includes('trafico') || q.includes('atasco') || q.includes('corte') || q.includes('obras') || q.includes('circulación') || q.includes('circulacion');
    const isBus = q.includes('bus') || q.includes('vitrasa') || q.includes('parada') || q.includes('autobús') || q.includes('autobus') || q.includes('línea') || q.includes('linea') || q.includes('cómo llegar') || q.includes('desplazar');
    const isGastro = q.includes('comer') || q.includes('cenar') || q.includes('restaurante') || q.includes('tapas') || q.includes('marisco') || q.includes('ostras') || q.includes('cafetería') || q.includes('cafeteria') || q.includes('desayunar') || q.includes('merendar') || q.includes('pulpo') || q.includes('almuerzo');
    const isShopping = q.includes('comprar') || q.includes('tienda') || q.includes('ropa') || q.includes('zapatería') || q.includes('librería') || q.includes('farmacia') || q.includes('regalo') || q.includes('peluquería') || q.includes('comercio');
    const isEvents = q.includes('evento') || q.includes('concierto') || q.includes('música') || q.includes('musica') || q.includes('agenda') || q.includes('fiesta') || q.includes('hacer') || q.includes('plan') || q.includes('planes') || q.includes('que ver') || q.includes('qué ver') || q.includes('visitar') || q.includes('teatro') || q.includes('exposición') || q.includes('exposicion');
    const isTourism = q.includes('turismo') || q.includes('monumento') || q.includes('historia') || q.includes('mirador') || q.includes('cíes') || q.includes('cies') || q.includes('castro') || q.includes('playa') || q.includes('samil') || q.includes('bouzas') || q.includes('rande') || q.includes('sireno');
    const isWeather = q.includes('tiempo') || q.includes('clima') || q.includes('llover') || q.includes('lluvia') || q.includes('temperatura') || q.includes('frío') || q.includes('calor') || q.includes('sol');
    const isSynergy = q.includes('sinergia') || q.includes('colaboración') || q.includes('colaboracion') || q.includes('oferta cruzada') || q.includes('bono') || q.includes('hora valle');
    const isHistorical = temporalRes.isHistorical || q.includes('el año pasado') || q.includes('cómo suele') || q.includes('como suele') || q.includes('histórico') || q.includes('en septiembre');

    // Asignación de intenciones detectadas
    if (isParking) intents.push('mobility_parking');
    if (isTraffic) intents.push('mobility_traffic');
    if (isBus) intents.push('mobility_bus');
    if (isGastro) intents.push('gastronomy');
    if (isShopping) intents.push('local_business');
    if (isEvents) intents.push('culture_events');
    if (isTourism) intents.push('tourism_heritage');
    if (isWeather) intents.push('weather_forecast');
    if (isHistorical) intents.push('historical_query');
    if (isSynergy) intents.push('cooperation_synergy');

    if (intents.length === 0) {
      intents.push('general_vigo');
    }

    // Determinación de Fuente Prioritaria
    let prioritySource: DataSourceType = 'supabase_business_db';
    if (isParking) prioritySource = 'vigo_realtime_parking';
    else if (isTraffic) prioritySource = 'vigo_realtime_traffic';
    else if (isWeather) prioritySource = 'vigo_official_weather';
    else if (isHistorical) prioritySource = 'vigo_historical_memory';
    else if (isEvents && !isGastro && !isShopping) prioritySource = 'vigo_events_agenda';
    else if (isTourism && !isGastro && !isShopping) prioritySource = 'vigo_verified_context';

    // Generar Plan de Acciones (Tools)
    // 1. Siempre buscar comercios locales relevantes de AhorraAI
    actions.push({
      toolName: 'search_local_businesses',
      sourceType: 'supabase_business_db',
      params: { 
        query, 
        zone: detectedZone, 
        category: isGastro ? 'Hostelería y Restauración' : (isShopping ? 'Comercio y Moda' : undefined),
        maxResults: 6 
      },
      rationale: 'Consultar comercios locales disponibles en la base de AhorraAI para Vigo.',
      mandatory: true
    });

    // 2. Meteorología oficial en Vigo (siempre que se pidan planes, turismo o clima)
    if (isWeather || isEvents || isTourism || temporalRes.hasTemporalIntent) {
      actions.push({
        toolName: 'get_vigo_weather',
        sourceType: 'vigo_official_weather',
        params: { targetDates: temporalRes.targetDates },
        rationale: 'Consultar previsión meteorológica oficial para adecuar las recomendaciones al clima.',
        mandatory: isWeather
      });
    }

    // 3. Si la consulta tiene contexto de movilidad / parking
    if (isParking || ((isGastro || isEvents || isTourism) && temporalRes.isImmediate)) {
      actions.push({
        toolName: 'get_vigo_parking',
        sourceType: 'vigo_realtime_parking',
        params: { near: detectedZone },
        rationale: 'Consultar estado de plazas en los parkings en tiempo real del Concello de Vigo.',
        mandatory: isParking
      });
    }

    // 4. Si la consulta involucra tráfico o cortes viales
    if (isTraffic || (isHistorical && q.includes('tráfico'))) {
      actions.push({
        toolName: 'get_vigo_traffic',
        sourceType: 'vigo_realtime_traffic',
        params: { area: detectedZone },
        rationale: 'Consultar congestión y avisos de circulación en la sala de tráfico del Concello.',
        mandatory: true
      });
    }

    // 5. Si la consulta involucra eventos, planes, ocio o agenda
    if (isEvents || isTourism || temporalRes.hasTemporalIntent) {
      actions.push({
        toolName: 'get_vigo_events',
        sourceType: 'vigo_events_agenda',
        params: { 
          targetDates: temporalRes.targetDates,
          zone: detectedZone 
        },
        rationale: `Consultar agenda cultural oficial del Concello para ${temporalRes.targetDateDescription}.`,
        mandatory: false
      });
    }

    // 6. Consultas históricas o de comparación temporal
    if (isHistorical) {
      const historicalDataset = isTraffic ? 'traffic' : (isParking ? 'parking' : (isWeather ? 'weather' : 'general'));
      actions.push({
        toolName: 'get_vigo_historical',
        sourceType: 'vigo_historical_memory',
        params: { 
          dataset: historicalDataset,
          month: temporalRes.targetMonth,
          dayOfWeek: temporalRes.dayOfWeekIndex,
          temporalExpression: temporalRes.rawExpression,
          location: detectedZone
        },
        rationale: `Recuperar snapshots históricos o declarar honestamente insuficiencia de datos sobre ${historicalDataset}.`,
        mandatory: true
      });
    }

    // 7. Contexto histórico y patrimonial
    if (detectedZone || isTourism || q.includes('historia') || q.includes('origen') || q.includes('rande') || q.includes('sireno')) {
      actions.push({
        toolName: 'get_vigo_context',
        sourceType: 'vigo_verified_context',
        params: { query: detectedZone || query },
        rationale: 'Recuperar memoria histórica contrastada y detalles de la zona de Vigo.',
        mandatory: true
      });
    }

    // 8. Si se solicita específicamente transporte urbano / Vitrasa
    if (isBus) {
      actions.push({
        toolName: 'get_vigo_bus_stops',
        sourceType: 'vigo_opendata_ckan',
        params: { near: detectedZone },
        rationale: 'Obtener paradas y rutas de transporte urbano del Concello.',
        mandatory: true
      });
    }

    return {
      originalQuery: query,
      detectedIntents: intents,
      zone: detectedZone,
      category: isGastro ? 'Hostelería y Restauración' : (isShopping ? 'Comercio y Moda' : undefined),
      temporalScope: temporalRes.temporalScope,
      targetDates: temporalRes.targetDates,
      targetDateDescription: temporalRes.targetDateDescription,
      isHistoricalQuery: isHistorical,
      actions,
      prioritySource
    };
  }

  /**
   * 2. EJECUCIÓN DEL PLAN CON TRAZABILIDAD (DEBUG MODE) Y SÍNTESIS
   */
  async executePlan(
    plan: AgentExecutionPlan, 
    messages: Array<{ role: string; content: string; image?: string }>,
    config?: UserSessionConfig
  ): Promise<AgentStructuredResponse> {
    const startTime = Date.now();
    const rawFacts: RetrievedFact[] = [];
    const toolsExecutedTraces: ToolExecutionTrace[] = [];
    const sourcesUsed: DataSourceType[] = [];

    const structuredData: AgentStructuredResponse['structuredData'] = {
      localBusinesses: [],
      synergies: [],
      parkingStatus: [],
      trafficStatus: [],
      events: [],
      weather: null,
      historical: null,
      contextInfo: [],
      externalResults: []
    };

    const temporalRes = vigoTimeResolver.resolveTemporal(plan.originalQuery);

    console.log(`\n============================================================`);
    console.log(`[VIGO BRAIN EXECUTION] Query: "${plan.originalQuery}"`);
    console.log(`- Intenciones: [${plan.detectedIntents.join(', ')}]`);
    console.log(`- Temporal: ${temporalRes.targetDateDescription} (Scope: ${temporalRes.temporalScope})`);
    console.log(`- Zona detectada: ${plan.zone || 'Global Vigo'}`);
    console.log(`- Tools planificadas: ${plan.actions.map(a => a.toolName).join(', ')}`);
    console.log(`============================================================\n`);

    // Ejecutar cada acción del plan
    for (const action of plan.actions) {
      const toolStart = Date.now();
      try {
        const result = await vigoToolExecutor.executeTool(action.toolName, action.params);
        const toolDuration = Date.now() - toolStart;
        
        if (result.facts.length > 0) {
          rawFacts.push(...result.facts);
          sourcesUsed.push(result.sourceType);
        }

        // Poblar structuredData según la fuente
        if (action.toolName === 'search_local_businesses') {
          structuredData.localBusinesses = result.data?.businesses || [];
          structuredData.synergies = result.data?.synergies || [];
        } else if (action.toolName === 'get_vigo_parking') {
          structuredData.parkingStatus = result.data || [];
        } else if (action.toolName === 'get_vigo_traffic') {
          structuredData.trafficStatus = result.data || [];
        } else if (action.toolName === 'get_vigo_events') {
          structuredData.events = result.data || [];
        } else if (action.toolName === 'get_vigo_weather') {
          structuredData.weather = result.data;
        } else if (action.toolName === 'get_vigo_historical') {
          structuredData.historical = result.data;
        } else if (action.toolName === 'get_vigo_context') {
          structuredData.contextInfo = result.facts.map(f => f.content);
        }

        toolsExecutedTraces.push({
          toolName: action.toolName,
          sourceType: action.sourceType,
          params: action.params,
          status: result.error ? 'error' : 'executed',
          executionTimeMs: toolDuration,
          factsCount: result.facts.length,
          dataRetrievedSummary: `${result.facts.length} hechos (${action.sourceType})`,
          error: result.error
        });

      } catch (toolError: any) {
        console.error(`[VigoAgentPlanner] Error al ejecutar tool ${action.toolName}:`, toolError);
        toolsExecutedTraces.push({
          toolName: action.toolName,
          sourceType: action.sourceType,
          params: action.params,
          status: 'error',
          executionTimeMs: Date.now() - toolStart,
          factsCount: 0,
          dataRetrievedSummary: 'Fallo al ejecutar herramienta',
          error: toolError?.message || String(toolError)
        });
      }
    }

    // Fallback con SerpAPI si no se encontraron comercios locales suficientes
    const hasLocalBusinesses = (structuredData.localBusinesses?.length || 0) > 0;
    if (!hasLocalBusinesses && (plan.detectedIntents.includes('local_business') || plan.detectedIntents.includes('gastronomy'))) {
      console.log("[VigoAgentPlanner] Sin comercios locales suficientes. Activando fallback SerpAPI...");
      const toolStart = Date.now();
      try {
        const serpResult = await vigoToolExecutor.executeTool('serpapi_search_local', { query: plan.originalQuery });
        if (serpResult.facts.length > 0) {
          rawFacts.push(...serpResult.facts);
          sourcesUsed.push('external_serpapi');
          structuredData.externalResults = serpResult.data || [];
        }
        toolsExecutedTraces.push({
          toolName: 'serpapi_search_local',
          sourceType: 'external_serpapi',
          params: { query: plan.originalQuery },
          status: 'fallback_used',
          executionTimeMs: Date.now() - toolStart,
          factsCount: serpResult.facts.length,
          dataRetrievedSummary: `${serpResult.facts.length} resultados externos Google Maps`
        });
      } catch (serpErr: any) {
        console.warn("[VigoAgentPlanner] Error en SerpAPI fallback:", serpErr);
      }
    }

    // 5. ENSAMBLAJE DE CONTEXTO ESTRUCTURADO CON REGLAS DE SÍNTESIS Y TEMPORALIDAD
    const contextPrompt = this.buildContextPrompt(rawFacts, structuredData, temporalRes, plan, config);

    // 6. GENERACIÓN DE RESPUESTA FINAL CON PERSONALIDAD Y HONESTIDAD ESTRUCTURAL
    let finalMessage = "";
    if (this.generateAIFn) {
      try {
        finalMessage = await this.generateAIFn(messages, contextPrompt);
      } catch (genErr: any) {
        console.error("[VigoAgentPlanner] Error al invocar motor IA:", genErr);
        finalMessage = "Desculpa, polo de agora o servizo de intelixencia está cunha alta demanda. Por favor, realiza de novo a túa consulta nuns intres.";
      }
    } else {
      finalMessage = "Motor de IA no configurado en el agente.";
    }

    const totalTimeMs = Date.now() - startTime;

    const debugTrace: AgentDebugTrace = {
      query: plan.originalQuery,
      intentsDetected: plan.detectedIntents,
      temporalResolution: {
        expression: temporalRes.rawExpression,
        scope: temporalRes.temporalScope,
        targetDates: temporalRes.targetDates,
        description: temporalRes.targetDateDescription,
        isFuture: temporalRes.isFuture,
        isImmediate: temporalRes.isImmediate,
        isHistorical: temporalRes.isHistorical
      },
      zoneDetected: plan.zone,
      toolsPlanned: plan.actions.map(a => ({
        tool: a.toolName,
        source: a.sourceType,
        rationale: a.rationale,
        mandatory: a.mandatory
      })),
      toolsExecuted: toolsExecutedTraces,
      factsCollectedTotal: rawFacts.length,
      sourcesUsed: Array.from(new Set(sourcesUsed)),
      executionTimeTotalMs: totalTimeMs
    };

    return {
      rawFacts,
      structuredData,
      reasoning: `Intenciones: [${plan.detectedIntents.join(', ')}]. Contexto Temporal: ${temporalRes.targetDateDescription}. Fuentes consultadas: ${Array.from(new Set(sourcesUsed)).join(', ')}.`,
      finalMessage,
      sourcesUsed: Array.from(new Set(sourcesUsed)),
      executionTimeMs: totalTimeMs,
      debugTrace
    };
  }

  private buildContextPrompt(
    facts: RetrievedFact[], 
    structured: AgentStructuredResponse['structuredData'],
    temporalRes: any,
    plan: AgentExecutionPlan,
    config?: UserSessionConfig
  ): string {
    const lang = config?.language || 'Español';
    const userRole = config?.userType === 'local' ? 'Vecino / Local de Vigo' : (config?.userType === 'business' ? 'Comercio Local de Vigo' : 'Turista / Visitante en Vigo');
    const companionDesc = config?.companion === 'couple' ? 'en pareja (romántico / relax)' : (config?.companion === 'family' ? 'en familia con niños' : (config?.companion === 'friends' ? 'con amigos' : 'en solitario'));

    // Categorizar hechos según su nivel de honestidad y fuente
    const localDbFacts = facts.filter(f => f.source === 'supabase_business_db');
    const weatherFacts = facts.filter(f => f.source === 'vigo_official_weather');
    const realTimeFacts = facts.filter(f => f.source === 'vigo_realtime_parking' || f.source === 'vigo_realtime_traffic');
    const eventFacts = facts.filter(f => f.source === 'vigo_events_agenda');
    const historicalFacts = facts.filter(f => f.source === 'vigo_historical_memory');
    const contextFacts = facts.filter(f => f.source === 'vigo_verified_context');
    const externalFacts = facts.filter(f => f.source === 'external_serpapi');

    let localDbText = localDbFacts.length > 0 
      ? localDbFacts.map(f => `- **${f.title}** [${f.verificationTier || 'DATABASE_BUSINESS'} / ${f.confidence}]: ${f.content}\n  Dirección: ${f.address || 'N/A'}\n  Teléfono: ${f.phone || 'N/A'}\n  Web: ${f.url || 'N/A'}\n  Imagen: ${f.metadata?.image_url || 'N/A'}`).join('\n\n')
      : "No hay comercios coincidentes directamente en la base de datos de AhorraAI.";

    let weatherText = weatherFacts.length > 0
      ? weatherFacts.map(f => `- ${f.title}: ${f.content}`).join('\n')
      : "Sin datos meteorológicos consultados.";

    let synergiesText = "Sin sinergias específicas para esta consulta.";
    if (structured.synergies && structured.synergies.length > 0) {
      synergiesText = structured.synergies.map((s: any) => 
        `- 🎁 **${s.title}** (${s.synergyType}): Entre ${s.businessA_name} y ${s.businessB_name}. ${s.description}`
      ).join('\n');
    }

    let realTimeText = realTimeFacts.length > 0
      ? realTimeFacts.map(f => `- [${f.source.toUpperCase()} - ${f.timestamp || 'Actual'}]: ${f.title} -> ${f.content}`).join('\n')
      : "No hay datos dinámicos requeridos o disponibles en este instante.";

    let eventsText = eventFacts.length > 0
      ? eventFacts.map(f => `- ${f.title}: ${f.content}`).join('\n')
      : "AVISO: No se han encontrado eventos confirmados para esa fecha en la agenda oficial municipal. NUNCA inventes conciertos, música en directo ni horarios de actuaciones.";

    let historicalText = historicalFacts.length > 0
      ? historicalFacts.map(f => `- ${f.title}: ${f.content}`).join('\n')
      : "Sin consulta histórica específica.";

    let contextText = contextFacts.length > 0
      ? contextFacts.map(f => `- ${f.title}: ${f.content}`).join('\n')
      : "Contexto general de la ciudad de Vigo.";

    let externalText = externalFacts.length > 0
      ? externalFacts.map(f => `- **${f.title}** (Fuente Externa Google Maps): ${f.content}\n  Dirección: ${f.address || 'N/A'}\n  Tel: ${f.phone || 'N/A'}\n  Web: ${f.url || 'N/A'}`).join('\n')
      : "No se requirieron resultados web externos.";

    const isSimpleQuery = plan.detectedIntents.length === 1 && 
      (plan.detectedIntents.includes('weather_forecast') || plan.detectedIntents.includes('mobility_parking') || plan.detectedIntents.includes('mobility_traffic') || plan.detectedIntents.includes('mobility_bus'));

    return `Eres el "Asistente Inteligente de Vigo" (AhorraAI v4), el cerebro de inteligencia local y comercial de la ciudad de Vigo (Galicia).
Tu misión es orientar con maestría a ciudadanos, turistas y comerciantes, combinando datos en tiempo real de la ciudad con los negocios disponibles en la base de AhorraAI y el patrimonio histórico de Vigo.

DATOS DEL USUARIO:
- Perfil: ${userRole} (${companionDesc})
- Idioma solicitado: ${lang}
- Intereses: ${config?.interests?.join(', ') || 'General'}
- Tiempo disponible: ${config?.timeAvailable || 'Libre'}

============================================================
MARCO TEMPORAL ESTRICTO (Europe/Madrid):
============================================================
- Fecha actual del sistema: ${temporalRes.nowInMadrid}
- Contexto temporal detectado: ${temporalRes.targetDateDescription}
- Ámbito temporal: ${temporalRes.temporalScope} (¿Es futuro?: ${temporalRes.isFuture ? 'SÍ' : 'NO'} | ¿Es histórico?: ${temporalRes.isHistorical ? 'SÍ' : 'NO'})
- Fechas objetivo (ISO): ${temporalRes.targetDates.join(', ')}

============================================================
DATOS EXTRAÍDOS POR EL AGENTE (SEPARACIÓN ESTRICTA DE HECHOS):
============================================================

1. METEOROLOGÍA OFICIAL DE VIGO (Open-Meteo / ECMWF):
${weatherText}

2. NEGOCIOS DISPONIBLES EN LA BASE DE AHORRAAI (Prioridad #1):
${localDbText}

3. OFERTAS CRUZADAS, HORAS VALLE Y SINERGIAS ACTIVAS (🎁):
${synergiesText}

4. AGENDA CULTURAL OFICIAL (Concello de Vigo):
${eventsText}

5. SENSORES Y MOVILIDAD EN TIEMPO REAL (Concello de Vigo / Tráfico / Parkings):
${realTimeText}

6. MEMORIA HISTÓRICA Y COMPARATIVAS (AhorraAI Memory):
${historicalText}

7. GEOGRAFÍA Y PATRIMONIO DE VIGO (Verificado):
${contextText}

8. RESULTADOS EXTERNOS (Google Maps):
${externalText}

============================================================
PRINCIPIOS Y DIRECTIVAS DE RESPUESTA:
============================================================
1. RIGOR TEMPORAL Y CAUSALIDAD:
   - Si la consulta es para "${temporalRes.targetDateDescription}", formula las recomendaciones EXPLÍCITAMENTE para ese marco temporal.
   - Explica el PORQUÉ de cada recomendación (ej: "Te recomiendo Bouzas por su paseo marítimo y ambiente de tapas", o "Debido a la previsión de lluvia, es ideal visitar el MARCO y hacer compras en el comercio de proximidad cubierto").
   - NUNCA presentes las plazas de parking de hoy como si fueran las plazas que habrá mañana. Si la consulta es futura, indica dónde aparcar habitualmente o las líneas de Vitrasa recomendadas.

2. HONESTIDAD ESTRUCTURAL Y CLASIFICACIÓN DE NEGOCIOS:
   - Utiliza las fórmulas honestas: "está disponible en la base de negocios de AhorraAI", "ficha validada por el comerciante" o "encontrado externamente en Google Maps".
   - NUNCA afirmes que todos los comercios son "nuestra red de comercios asociados".
   - NUNCA inventes horarios, precios, platos, teléfonos ni plazas libres. Si un dato no está en el contexto, indícalo con naturalidad ("No disponemos del horario de tarde confirmado").
   - MÚSICA Y EVENTOS: Si no hay eventos confirmados en la agenda oficial para esa fecha, decláralo explícitamente ("No constan eventos culturales confirmados en la agenda oficial para esa fecha"). NUNCA inventes actuaciones musicales.

3. ADAPTABILIDAD DE LONGITUD DE RESPUESTA:
   ${isSimpleQuery 
     ? '- Esta es una CONSULTA PUNTUAL DIRECTA. Responde de forma CONCISA, PRECISA Y DIRECTA en 1-2 párrafos claros sin crear itinerarios innecesarios.' 
     : '- Si el usuario pide un plan o itinerario, organízalo con claridad cronológica (Mañana, Almuerzo, Tarde, Noche) e incluye pautas de movilidad (a pie, Vitrasa, o parkings recomendados). Cada propuesta debe tener su razón fundamentada.'}

4. PERSONALIDAD AHORRAAI:
   - Tono cálido, servicial, profesional y con un agradable y respetuoso toque de retranca y cercanía viguesa/gallega (sin caer en clichés forzados).
   - Responde SIEMPRE en el idioma del usuario (${lang}).

5. PRESENTACIÓN VISUAL DE NEGOCIOS:
   Cuando recomiendes comercios o lugares de interés concretos, preséntalos con Markdown limpio:

### 🏪 [Nombre del Negocio / Lugar]
*Breve descripción destacando su especialidad y por qué encaja en el plan.*
- 📍 **Dirección:** [[Dirección]](https://www.google.com/maps/search/?api=1&query=DIRECCION_DEL_NEGOCIO+VIGO)
- 🌐 **Web:** [Enlace si existe]
- 🗺️ **Google Maps:** [Cómo llegar](https://www.google.com/maps/search/?api=1&query=NOMBRE+DEL+NEGOCIO+VIGO)
- 📞 **Teléfono:** [Teléfono si está disponible](tel:NUMERO)

*(Si tiene un Pack/Sinergia activo, ponlo aquí con el emoji 🎁)*

---
`;
  }
}

export const vigoAgentPlanner = new VigoAgentPlanner();
