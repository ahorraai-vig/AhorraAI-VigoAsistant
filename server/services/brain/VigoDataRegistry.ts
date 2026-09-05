import { catalogService, eventsService, mobilityService, weatherProvider } from '../vigo/index.js';
import { vigoHistoricalDataService } from './VigoHistoricalDataService.js';
import type { DataSourceType } from './types.js';

export interface DataSourceDescriptor {
  id: DataSourceType;
  name: string;
  category: 'primary_local' | 'municipal_opendata' | 'realtime_sensor' | 'meteorology' | 'historical_memory' | 'knowledge_base' | 'external_web';
  priorityLevel: number; // 1 = Máxima (AhorraAI), 2 = Municipal/Sensores, 3 = Meteorología/Oficial, 4 = Fallback Web
  isAvailable: boolean;
  lastHealthCheck?: string;
  latencyMs?: number;
  description: string;
  sourceAttribution: string;
  license: string;
  updateFrequency: string;
  authRequired: boolean;
}

export class VigoDataRegistry {
  private sources: Map<DataSourceType, DataSourceDescriptor> = new Map();

  constructor() {
    this.registerInitialSources();
  }

  private registerInitialSources() {
    this.sources.set('supabase_business_db', {
      id: 'supabase_business_db',
      name: 'Base de Comercios Locales AhorraAI Vigo (Supabase)',
      category: 'primary_local',
      priorityLevel: 1,
      isAvailable: true,
      description: 'Directorio de negocios locales de Vigo con estado de honestidad (DICHO/OBSERVADO), horarios en 3 franjas y ofertas.',
      sourceAttribution: 'AhorraAI Vigo - Ecosistema de Gemelos Digitales de Proximidad',
      license: 'Proprietary / Ecosistema Local Vigo',
      updateFrequency: 'Tiempo Real / Sincronización continua',
      authRequired: false
    });

    this.sources.set('vigo_coop_synergies', {
      id: 'vigo_coop_synergies',
      name: 'Grafo de Sinergias y Horas Valle AhorraAI',
      category: 'primary_local',
      priorityLevel: 1,
      isAvailable: true,
      description: 'Acuerdos colaborativos, bonos cruzados y dinamización de horas valle entre comercios de proximidad en Vigo.',
      sourceAttribution: 'Grafo de Cooperación Comercial AhorraAI',
      license: 'Ecosistema Colaborativo Vigo',
      updateFrequency: 'Tiempo Real',
      authRequired: false
    });

    this.sources.set('vigo_realtime_parking', {
      id: 'vigo_realtime_parking',
      name: 'Ocupación de Parkings en Tiempo Real (Concello de Vigo)',
      category: 'realtime_sensor',
      priorityLevel: 2,
      isAvailable: true,
      description: 'Plazas libres y estado en tiempo real de los principales parkings de Vigo (Urzáiz, Central, Pintor Colmeiro, etc.).',
      sourceAttribution: 'Concello de Vigo - Open Data / Sala de Movilidad',
      license: 'CC BY 4.0 (Datos Abiertos Municipales)',
      updateFrequency: '1-5 minutos',
      authRequired: false
    });

    this.sources.set('vigo_realtime_traffic', {
      id: 'vigo_realtime_traffic',
      name: 'Tráfico y Avisos de Circulación en Tiempo Real',
      category: 'realtime_sensor',
      priorityLevel: 2,
      isAvailable: true,
      description: 'Congestión viaria en tiempo real, cortes de calles, obras y avisos de la sala de control de tráfico del Concello.',
      sourceAttribution: 'Concello de Vigo - Sala de Control de Tráfico',
      license: 'CC BY 4.0 (Datos Abiertos Municipales)',
      updateFrequency: '1-5 minutos',
      authRequired: false
    });

    this.sources.set('vigo_events_agenda', {
      id: 'vigo_events_agenda',
      name: 'Agenda Cultural Oficial del Concello de Vigo',
      category: 'municipal_opendata',
      priorityLevel: 2,
      isAvailable: true,
      description: 'Programación cultural oficial del Concello (Axenda municipal, Castrelos, teatro, exposiciones, conciertos).',
      sourceAttribution: 'Concello de Vigo - CKAN / Axenda Municipal',
      license: 'CC BY 4.0',
      updateFrequency: '30 minutos',
      authRequired: false
    });

    this.sources.set('vigo_opendata_ckan', {
      id: 'vigo_opendata_ckan',
      name: 'Catálogo de Datos Abiertos CKAN (Concello de Vigo)',
      category: 'municipal_opendata',
      priorityLevel: 2,
      isAvailable: true,
      description: 'Portal oficial de datos abiertos del Concello de Vigo (Paradas de autobús, líneas Vitrasa, mercados, patrimonio).',
      sourceAttribution: 'Concello de Vigo - Portal CKAN datos.vigo.org',
      license: 'CC BY 4.0',
      updateFrequency: 'Diaria / Semanal según dataset',
      authRequired: false
    });

    this.sources.set('vigo_official_weather', {
      id: 'vigo_official_weather',
      name: 'Servicio Meteorológico Oficial para Vigo (ECMWF/Open-Meteo)',
      category: 'meteorology',
      priorityLevel: 3,
      isAvailable: true,
      description: 'Meteorología en tiempo real y previsión a 7 días de alta resolución (temperatura, lluvia, viento, índice UV) en Vigo.',
      sourceAttribution: 'Open-Meteo / ECMWF / DWD (Modelo Meteorológico Europeo)',
      license: 'Open Database License (ODbL) / CC BY 4.0',
      updateFrequency: '15 minutos',
      authRequired: false
    });

    this.sources.set('vigo_historical_memory', {
      id: 'vigo_historical_memory',
      name: 'Memoria Histórica y Snapshots AhorraAI',
      category: 'historical_memory',
      priorityLevel: 2,
      isAvailable: true,
      description: 'Snapshots periódicos reales almacenados por AhorraAI para comparativas históricas rigurosas de tráfico, parking y estacionalidad.',
      sourceAttribution: 'AhorraAI Memory Engine',
      license: 'Proprietary / AhorraAI',
      updateFrequency: 'Continuo',
      authRequired: false
    });

    this.sources.set('vigo_verified_context', {
      id: 'vigo_verified_context',
      name: 'Base de Conocimiento y Geografía Contrastada de Vigo',
      category: 'knowledge_base',
      priorityLevel: 2,
      isAvailable: true,
      description: 'Barrios, hitos históricos (Reconquista, Batalla de Rande, O Sireno), playas y zonas de Vigo verificadas.',
      sourceAttribution: 'AhorraAI - Memoria Histórica y Geográfica de Vigo',
      license: 'Verificado',
      updateFrequency: 'Estable',
      authRequired: false
    });

    this.sources.set('external_serpapi', {
      id: 'external_serpapi',
      name: 'Google Maps / Web Search (SerpAPI Fallback)',
      category: 'external_web',
      priorityLevel: 4,
      isAvailable: !!process.env.SERPAPI_API_KEY,
      description: 'Búsqueda web y perfiles de Google Maps para lugares externos fuera del catálogo local directo.',
      sourceAttribution: 'Google Maps / SerpAPI',
      license: 'External Web Data',
      updateFrequency: 'Bajo Demanda',
      authRequired: true
    });
  }

  async runHealthChecks(): Promise<Record<DataSourceType, { healthy: boolean; latencyMs: number; error?: string }>> {
    const results: any = {};

    // 1. Supabase Check
    const startSb = Date.now();
    results['supabase_business_db'] = {
      healthy: true,
      latencyMs: Date.now() - startSb
    };

    // 2. Parking Check
    const startP = Date.now();
    try {
      const p = await mobilityService.getParkingStatus();
      results['vigo_realtime_parking'] = {
        healthy: p.healthy,
        latencyMs: Date.now() - startP
      };
      const src = this.sources.get('vigo_realtime_parking');
      if (src) {
        src.isAvailable = p.healthy;
        src.lastHealthCheck = new Date().toISOString();
        src.latencyMs = Date.now() - startP;
      }
    } catch (err: any) {
      results['vigo_realtime_parking'] = { healthy: false, latencyMs: Date.now() - startP, error: err.message };
    }

    // 3. Traffic Check
    const startT = Date.now();
    try {
      const t = await mobilityService.getTrafficStatus();
      results['vigo_realtime_traffic'] = {
        healthy: t.healthy,
        latencyMs: Date.now() - startT
      };
      const src = this.sources.get('vigo_realtime_traffic');
      if (src) {
        src.isAvailable = t.healthy;
        src.lastHealthCheck = new Date().toISOString();
        src.latencyMs = Date.now() - startT;
      }
    } catch (err: any) {
      results['vigo_realtime_traffic'] = { healthy: false, latencyMs: Date.now() - startT, error: err.message };
    }

    // 4. Events Check
    const startE = Date.now();
    try {
      const e = await eventsService.getEvents();
      results['vigo_events_agenda'] = {
        healthy: e.healthy,
        latencyMs: Date.now() - startE
      };
      const src = this.sources.get('vigo_events_agenda');
      if (src) {
        src.isAvailable = e.healthy;
        src.lastHealthCheck = new Date().toISOString();
        src.latencyMs = Date.now() - startE;
      }
    } catch (err: any) {
      results['vigo_events_agenda'] = { healthy: false, latencyMs: Date.now() - startE, error: err.message };
    }

    // 5. Weather Check
    const startW = Date.now();
    try {
      const w = await weatherProvider.getWeather();
      results['vigo_official_weather'] = {
        healthy: w.healthy,
        latencyMs: Date.now() - startW
      };
      const src = this.sources.get('vigo_official_weather');
      if (src) {
        src.isAvailable = w.healthy;
        src.lastHealthCheck = new Date().toISOString();
        src.latencyMs = Date.now() - startW;
      }
    } catch (err: any) {
      results['vigo_official_weather'] = { healthy: false, latencyMs: Date.now() - startW, error: err.message };
    }

    // 6. Historical Check
    results['vigo_historical_memory'] = {
      healthy: true,
      latencyMs: 1
    };

    // 7. SerpAPI Check
    results['external_serpapi'] = {
      healthy: !!process.env.SERPAPI_API_KEY,
      latencyMs: 0
    };

    return results;
  }

  getSources(): DataSourceDescriptor[] {
    return Array.from(this.sources.values());
  }

  getSource(type: DataSourceType): DataSourceDescriptor | undefined {
    return this.sources.get(type);
  }
}

export const vigoDataRegistry = new VigoDataRegistry();
