export type IntentCategory = 
  | 'local_business'      // Búsqueda o consulta de comercios, compras, servicios en Vigo
  | 'gastronomy'          // Restaurantes, tapas, marisquerías, terrazas, cafeterías
  | 'mobility_traffic'    // Tráfico, atascos, cortes, cámaras de tráfico
  | 'mobility_parking'    // Estado de parkings en tiempo real / histórico
  | 'mobility_bus'        // Líneas de Vitrasa, paradas, transporte urbano, rutas
  | 'culture_events'      // Agenda cultural, conciertos, fiestas, eventos del Concello
  | 'weather_forecast'    // Meteorología oficial, lluvia, temperatura, viento en Vigo
  | 'historical_query'    // Consultas de histórico o comparativas temporales ("el año pasado", "en septiembre")
  | 'tourism_heritage'    // Turismo, miradores, playas, Cíes, historia, monumentos de Vigo
  | 'cooperation_synergy' // Sinergias comerciales, red de comercios, horas valle, bonos
  | 'general_vigo';       // Preguntas generales sobre Vigo y servicios ciudadanos

export type DataConfidence = 'VERIFIED' | 'OBSERVED' | 'INFERRED' | 'UNKNOWN' | 'DICHO' | 'OBSERVADO' | 'SIN_CONFIRMAR';

export type BusinessVerificationTier = 
  | 'VERIFIED_PARTNER'  // Comercio partner con acuerdo verificado activo
  | 'CLAIMED_BUSINESS'   // Ficha validada directamente por el comerciante (DICHO)
  | 'DATABASE_BUSINESS'  // Ficha presente en la base de datos de AhorraAI
  | 'EXTERNAL_BUSINESS'; // Comercio encontrado externamente (Google Maps / SerpAPI)

export type DataSourceType = 
  | 'supabase_business_db' // Prioridad #1 (Base de Negocios AhorraAI)
  | 'vigo_coop_synergies'  // Prioridad #1 (Grafo de Sinergias y Horas Valle)
  | 'vigo_opendata_ckan'   // Prioridad #2 (Concello de Vigo CKAN Oficial)
  | 'vigo_realtime_traffic'// Prioridad #2 (Tráfico y avisos en tiempo real)
  | 'vigo_realtime_parking'// Prioridad #2 (Parkings en tiempo real)
  | 'vigo_events_agenda'   // Prioridad #2 (Agenda cultural y eventos del Concello)
  | 'vigo_official_weather'// Prioridad #3 (Meteorología oficial europea para Vigo)
  | 'vigo_historical_memory'// Prioridad #2/3 (Snapshots históricos reales AhorraAI)
  | 'vigo_verified_context'// Prioridad #2.5/5 (Geografía, barrios y memoria histórica)
  | 'external_serpapi'     // Prioridad #4 (Búsqueda web / Google Maps fallback)
  | 'fallback_synthesis';

export interface PlannedAction {
  toolName: string;
  sourceType: DataSourceType;
  params: Record<string, any>;
  rationale: string;
  mandatory: boolean;
}

export interface AgentExecutionPlan {
  originalQuery: string;
  detectedIntents: IntentCategory[];
  zone?: string;
  category?: string;
  temporalScope?: 'today' | 'tonight' | 'tomorrow' | 'day_after_tomorrow' | 'this_weekend' | 'specific_date' | 'date_range' | 'historical' | 'general';
  targetDates?: string[];
  targetDateDescription?: string;
  isHistoricalQuery?: boolean;
  actions: PlannedAction[];
  prioritySource: DataSourceType;
}

export interface RetrievedFact {
  id: string;
  source: DataSourceType;
  confidence: DataConfidence;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  url?: string;
  address?: string;
  phone?: string;
  timestamp?: string;
  verificationTier?: BusinessVerificationTier;
}

export interface BusinessRecommendationItem {
  id: string;
  name: string;
  zone?: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  imageUrl?: string;
  verificationTier: BusinessVerificationTier;
  confidence: DataConfidence;
  reason: string; // Motivo concreto de la recomendación
  activeSynergy?: string;
}

export interface StructuredPlanSegment {
  timeSlot: 'morning' | 'lunch' | 'afternoon' | 'evening' | 'night' | 'general';
  title: string;
  activityDescription: string;
  whyThisChoice: string;
  placeOrBusiness?: BusinessRecommendationItem;
  mobilityGuidance?: string;
}

export interface ToolExecutionTrace {
  toolName: string;
  sourceType: DataSourceType;
  params: Record<string, any>;
  status: 'executed' | 'skipped' | 'fallback_used' | 'error';
  executionTimeMs: number;
  factsCount: number;
  dataRetrievedSummary: string;
  error?: string;
}

export interface AgentDebugTrace {
  query: string;
  intentsDetected: IntentCategory[];
  temporalResolution: {
    expression: string;
    scope: string;
    targetDates: string[];
    description: string;
    isFuture: boolean;
    isImmediate: boolean;
    isHistorical: boolean;
  };
  zoneDetected?: string;
  toolsPlanned: Array<{ tool: string; source: string; rationale: string; mandatory: boolean }>;
  toolsExecuted: ToolExecutionTrace[];
  factsCollectedTotal: number;
  sourcesUsed: DataSourceType[];
  executionTimeTotalMs: number;
}

export interface AgentStructuredResponse {
  rawFacts: RetrievedFact[];
  structuredData: {
    localBusinesses?: any[];
    synergies?: any[];
    parkingStatus?: any[];
    trafficStatus?: any[];
    events?: any[];
    weather?: any;
    historical?: any;
    contextInfo?: string[];
    externalResults?: any[];
  };
  reasoning: string;
  finalMessage: string;
  sourcesUsed: DataSourceType[];
  executionTimeMs: number;
  debugTrace: AgentDebugTrace;
}
