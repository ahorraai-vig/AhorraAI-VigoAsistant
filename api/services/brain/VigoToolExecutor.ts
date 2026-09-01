import { eventsService, mobilityService, catalogService, alertsService, tourismService, weatherProvider } from '../vigo';
import { ahorraAIBusinessService } from './AhorraAIBusinessService';
import { vigoContextService } from './VigoContextService';
import { vigoHistoricalDataService } from './VigoHistoricalDataService';
import type { RetrievedFact, DataSourceType } from './types';

export class VigoToolExecutor {
  private serpapiSearchLocalFn: ((query: string) => Promise<any>) | null = null;
  private serpapiSearchWebFn: ((query: string) => Promise<any>) | null = null;

  setSerpApiProviders(searchLocal: (query: string) => Promise<any>, searchWeb: (query: string) => Promise<any>) {
    this.serpapiSearchLocalFn = searchLocal;
    this.serpapiSearchWebFn = searchWeb;
  }

  async executeTool(toolName: string, args: Record<string, any> = {}): Promise<{
    data: any;
    facts: RetrievedFact[];
    sourceType: DataSourceType;
    error?: string;
  }> {
    const facts: RetrievedFact[] = [];

    switch (toolName) {
      case 'search_local_businesses': {
        const res = await ahorraAIBusinessService.searchBusinesses({
          query: args.query || args.search || '',
          zone: args.zone,
          category: args.category,
          maxResults: args.maxResults || 6
        });

        return {
          data: { businesses: res.businesses, synergies: res.synergies },
          facts: res.facts,
          sourceType: 'supabase_business_db'
        };
      }

      case 'get_vigo_parking': {
        const pRes = await mobilityService.getParkingStatus();
        let parkingList: any[] = [];
        if (pRes.healthy && pRes.data) {
          parkingList = Array.isArray(pRes.data) ? pRes.data : (pRes.data.parkings || [pRes.data]);
          
          let totalFreeSpots = 0;
          for (const park of parkingList.slice(0, 10)) {
            const name = park.nombre || park.name || park.parking || 'Parking Vigo';
            const free = park.libres ?? park.plazas_libres ?? park.free ?? 'Consultar';
            const total = park.total ?? park.plazas_totales ?? '';
            const status = park.estado || (free === 0 ? 'COMPLETO' : 'DISPONIBLE');

            if (typeof free === 'number') totalFreeSpots += free;

            facts.push({
              id: `park-${name}`,
              source: 'vigo_realtime_parking',
              confidence: 'OBSERVADO',
              title: `Parking ${name}`,
              content: `Plazas libres en tiempo real: ${free}${total ? ` de ${total}` : ''} | Estado: ${status} | Fuente Oficial: Concello de Vigo (${pRes.retrieved_at})`,
              timestamp: pRes.retrieved_at
            });
          }

          // Guardar snapshot automático en memoria histórica
          if (totalFreeSpots > 0) {
            vigoHistoricalDataService.recordSnapshot({
              source: 'vigo_realtime_parking',
              dataset: 'parking',
              metric: 'plazas_libres_total',
              value: totalFreeSpots,
              location: 'Vigo Red Municipal de Parkings',
              timestamp: pRes.retrieved_at,
              metadata: { countParkings: parkingList.length }
            }).catch(() => {});
          }
        }
        return {
          data: parkingList,
          facts,
          sourceType: 'vigo_realtime_parking'
        };
      }

      case 'get_vigo_traffic': {
        const tRes = await mobilityService.getTrafficStatus();
        const aRes = await mobilityService.getTrafficAlerts();
        const trafficData = { congestion: tRes.data, alerts: aRes.data };

        if (tRes.healthy && tRes.data) {
          facts.push({
            id: 'traffic-realtime',
            source: 'vigo_realtime_traffic',
            confidence: 'OBSERVADO',
            title: 'Estado del Tráfico en Vigo (Sala de Control Municipal)',
            content: `Datos de congestión en tiempo real de la red viaria de Vigo (${tRes.retrieved_at}).`,
            metadata: { raw: tRes.data },
            timestamp: tRes.retrieved_at
          });
        }

        if (aRes.healthy && aRes.data) {
          const alertsList = Array.isArray(aRes.data) ? aRes.data : [aRes.data];
          for (const alert of alertsList.slice(0, 5)) {
            const title = alert.titulo || alert.title || alert.descripcion || 'Aviso de Tráfico';
            facts.push({
              id: `traffic-alert-${Date.now()}`,
              source: 'vigo_realtime_traffic',
              confidence: 'OBSERVADO',
              title: `Aviso Tráfico Oficial: ${title}`,
              content: alert.descripcion || alert.description || title,
              timestamp: aRes.retrieved_at
            });
          }
        }

        return {
          data: trafficData,
          facts,
          sourceType: 'vigo_realtime_traffic'
        };
      }

      case 'get_vigo_events': {
        const eRes = await eventsService.getEvents();
        let eventsList: any[] = [];
        const targetDates = args.targetDates || [];

        if (eRes.healthy && eRes.data) {
          eventsList = Array.isArray(eRes.data) ? eRes.data : (eRes.data.eventos || [eRes.data]);
          
          if (targetDates.length > 0) {
            const filtered = eventsService.filterEventsByDate(eventsList, targetDates);
            if (filtered.length > 0) {
              eventsList = filtered;
            }
          }

          for (const ev of eventsList.slice(0, 8)) {
            const title = ev.titulo || ev.title || ev.nombre || 'Actividad cultural';
            const date = ev.fecha || ev.date || ev.horario || 'Próximamente';
            const place = ev.lugar || ev.ubicacion || ev.place || 'Vigo';
            const desc = ev.descripcion || ev.description || '';

            facts.push({
              id: `event-${title}`,
              source: 'vigo_events_agenda',
              confidence: 'VERIFIED',
              title: `Evento Confirmado: ${title}`,
              content: `Fecha oficial: ${date} | Lugar: ${place} | Detalle: ${desc}`,
              timestamp: eRes.retrieved_at
            });
          }
        }
        return {
          data: eventsList,
          facts,
          sourceType: 'vigo_events_agenda'
        };
      }

      case 'get_vigo_weather': {
        const wRes = await weatherProvider.getWeather();
        if (wRes.healthy && wRes.data) {
          const report = wRes.data;
          const cur = report.current;
          
          facts.push({
            id: 'weather-current-vigo',
            source: 'vigo_official_weather',
            confidence: 'OBSERVADO',
            title: `Meteorología Oficial en Vigo (${cur.temperatureC}°C, ${cur.conditionDescription})`,
            content: `${cur.summary} Recomendación operativa: ${cur.recommendationHint}`,
            timestamp: wRes.retrieved_at,
            metadata: {
              temperatureC: cur.temperatureC,
              isRaining: cur.isRaining,
              isSunny: cur.isSunny,
              humidity: cur.humidityPercent,
              windSpeed: cur.windSpeedKmH
            }
          });

          // Previsión de los próximos días
          if (args.targetDates && Array.isArray(args.targetDates) && args.targetDates.length > 0) {
            for (const tDate of args.targetDates) {
              const forecast = report.daily.find(d => d.date === tDate);
              if (forecast) {
                facts.push({
                  id: `weather-forecast-${tDate}`,
                  source: 'vigo_official_weather',
                  confidence: 'OBSERVADO',
                  title: `Previsión Meteorológica para el ${tDate} en Vigo`,
                  content: `${forecast.conditionDescription}, Máx: ${forecast.tempMaxC}°C / Mín: ${forecast.tempMinC}°C. Probabilidad de lluvia: ${forecast.precipitationProbabilityMax}%. ${forecast.recommendationHint}`,
                  timestamp: wRes.retrieved_at
                });
              }
            }
          }

          return {
            data: report,
            facts,
            sourceType: 'vigo_official_weather'
          };
        }

        return {
          data: null,
          facts: [],
          sourceType: 'vigo_official_weather',
          error: 'No se pudo obtener la meteorología de Vigo'
        };
      }

      case 'get_vigo_historical': {
        const dataset = args.dataset || 'general';
        const comparison = await vigoHistoricalDataService.getHistoricalComparison(dataset, {
          metric: args.metric,
          location: args.location,
          month: args.month,
          dayOfWeek: args.dayOfWeek,
          temporalExpression: args.temporalExpression
        });

        facts.push({
          id: `historical-${dataset}-${Date.now()}`,
          source: 'vigo_historical_memory',
          confidence: comparison.hasSufficientData ? 'OBSERVADO' : 'UNKNOWN',
          title: `Memoria Histórica de Vigo (${dataset.toUpperCase()})`,
          content: `${comparison.summary} [Tipo: ${comparison.dataType}] (${comparison.confidenceNote})`,
          timestamp: new Date().toISOString(),
          metadata: { comparison }
        });

        return {
          data: comparison,
          facts,
          sourceType: 'vigo_historical_memory'
        };
      }

      case 'get_vigo_bus_stops': {
        const bRes = await mobilityService.getBusStops();
        let stopsList: any[] = [];
        if (bRes.healthy && bRes.data) {
          stopsList = Array.isArray(bRes.data) ? bRes.data : (bRes.data.features || bRes.data.paradas || [bRes.data]);
          for (const stop of stopsList.slice(0, 6)) {
            const name = stop.nombre || stop.properties?.nombre || stop.name || 'Parada Vitrasa';
            const lines = stop.lineas || stop.properties?.lineas || 'Líneas urbanas';
            facts.push({
              id: `bus-stop-${name}`,
              source: 'vigo_opendata_ckan',
              confidence: 'OBSERVADO',
              title: `Parada Vitrasa: ${name}`,
              content: `Líneas disponibles: ${Array.isArray(lines) ? lines.join(', ') : lines}`,
              timestamp: bRes.retrieved_at
            });
          }
        }

        return {
          data: stopsList,
          facts,
          sourceType: 'vigo_opendata_ckan'
        };
      }

      case 'get_vigo_context': {
        const query = args.query || args.topic || '';
        const zone = vigoContextService.findZone(query);
        const history = vigoContextService.getRelevantHistory(query);

        if (zone) {
          facts.push({
            id: `context-zone-${zone.name}`,
            source: 'vigo_verified_context',
            confidence: 'VERIFIED',
            title: `Zona ${zone.name}`,
            content: `${zone.description} Ambiente: ${zone.vibe}. Destacados: ${zone.highlights.join(', ')}.`
          });
        }

        for (const h of history) {
          facts.push({
            id: `context-history-${Date.now()}`,
            source: 'vigo_verified_context',
            confidence: 'VERIFIED',
            title: 'Memoria Histórica y Geográfica de Vigo',
            content: h
          });
        }

        return {
          data: { zone, history },
          facts,
          sourceType: 'vigo_verified_context'
        };
      }

      case 'serpapi_search_local': {
        if (!this.serpapiSearchLocalFn) {
          return { data: null, facts: [], sourceType: 'external_serpapi', error: 'SerpAPI provider not configured' };
        }
        try {
          const raw = await this.serpapiSearchLocalFn(args.query || 'Vigo');
          const places = Array.isArray(raw) ? raw : (raw?.local_results || []);
          for (const p of places.slice(0, 4)) {
            facts.push({
              id: `serp-${p.title || p.name}`,
              source: 'external_serpapi',
              confidence: 'OBSERVADO',
              verificationTier: 'EXTERNAL_BUSINESS',
              title: `${p.title || p.name || 'Lugar en Vigo'} (Fuente Externa Google Maps)`,
              content: `${p.type || p.category || ''} - Dirección: ${p.address || 'Vigo'}. Puntuación: ${p.rating || 'N/A'}.`,
              address: p.address,
              phone: p.phone,
              url: p.links?.website || p.website
            });
          }
          return { data: places, facts, sourceType: 'external_serpapi' };
        } catch (e: any) {
          return { data: null, facts: [], sourceType: 'external_serpapi', error: e.message };
        }
      }

      case 'serpapi_search_web': {
        if (!this.serpapiSearchWebFn) {
          return { data: null, facts: [], sourceType: 'external_serpapi', error: 'SerpAPI web provider not configured' };
        }
        try {
          const raw = await this.serpapiSearchWebFn(args.query || 'Vigo');
          const organic = Array.isArray(raw) ? raw : (raw?.organic_results || []);
          for (const item of organic.slice(0, 3)) {
            facts.push({
              id: `web-${item.title}`,
              source: 'external_serpapi',
              confidence: 'OBSERVADO',
              title: item.title || 'Información Web Vigo',
              content: item.snippet || '',
              url: item.link
            });
          }
          return { data: organic, facts, sourceType: 'external_serpapi' };
        } catch (e: any) {
          return { data: null, facts: [], sourceType: 'external_serpapi', error: e.message };
        }
      }

      default:
        return { data: null, facts: [], sourceType: 'fallback_synthesis', error: `Unknown tool: ${toolName}` };
    }
  }
}

export const vigoToolExecutor = new VigoToolExecutor();
