import { vigoCache } from './vigoCacheService.js';
import { catalogService } from './vigoCatalogService.js';
import type { VigoResponse } from './vigoMobilityService.js';

export interface VigoEventItem {
  id?: string;
  title: string;
  description?: string;
  startDate?: string; // YYYY-MM-DD o ISO
  endDate?: string;
  location?: string;
  zone?: string;
  price?: string;
  category?: string;
  url?: string;
  source: string;
}

export class VigoEventsService {
  private readonly directAgendaUrl = 'https://datos.vigo.org/data/axenda/agenda-hoy.json';

  /**
   * Obtiene la agenda cultural oficial del Concello de Vigo.
   * Conecta directamente con el feed municipal y busca en el CKAN oficial como respaldo.
   */
  async getEvents(): Promise<VigoResponse<any>> {
    const cacheKey = 'vigo_events_official';
    const cached = vigoCache.get<VigoResponse<any>>(cacheKey);
    if (cached) return cached;

    try {
      // 1. Intentar endpoint directo oficial de la axenda municipal
      try {
        const directRes = await fetch(this.directAgendaUrl, { signal: AbortSignal.timeout(5000) });
        if (directRes.ok) {
          const directData = await directRes.json();
          const items = Array.isArray(directData) ? directData : (directData.items || directData.eventos || directData.data || [directData]);
          const result: VigoResponse<any> = {
            data: items,
            source: 'Concello de Vigo (Axenda Municipal Oficial)',
            retrieved_at: new Date().toISOString(),
            license: 'CC BY 4.0',
            healthy: true
          };
          vigoCache.set(cacheKey, result, 1800); // 30 min cache
          return result;
        }
      } catch (directErr) {
        console.warn('[VigoEventsService] Direct agenda fetch failed, attempting CKAN discovery:', directErr);
      }

      // 2. Intentar buscar en CKAN oficial del Concello (paquete agenda-cultura o axenda)
      const datasets = await catalogService.searchPackages('agenda');
      for (const dataset of datasets) {
        const jsonResource = dataset.resources.find(r => r.format.toLowerCase() === 'json');
        if (jsonResource) {
          try {
            const response = await fetch(jsonResource.url, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
              const eventsData = await response.json();
              const items = Array.isArray(eventsData) ? eventsData : (eventsData.items || eventsData.eventos || [eventsData]);
              const result: VigoResponse<any> = {
                data: items,
                source: 'Concello de Vigo (CKAN Oficial)',
                retrieved_at: new Date().toISOString(),
                license: 'CC BY 4.0',
                healthy: true
              };
              vigoCache.set(cacheKey, result, 1800);
              return result;
            }
          } catch(e) {
            console.warn('[VigoEventsService] Failed to fetch CKAN resource URL', jsonResource.url);
          }
        }
      }

      // 3. Respuesta honesta si el feed oficial está temporalmente sin datos
      const fallbackResult: VigoResponse<any> = {
        data: [],
        source: 'Concello de Vigo (Agenda Oficial)',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: false
      };
      return fallbackResult;
    } catch (error) {
      console.error('[VigoEventsService] Error fetching events:', error);
      return { 
        data: [], 
        source: 'Concello de Vigo (Agenda Oficial)', 
        retrieved_at: new Date().toISOString(), 
        license: 'CC BY 4.0', 
        healthy: false 
      };
    }
  }

  /**
   * Filtra eventos por fecha objetivo (YYYY-MM-DD) respetando la Honestidad Estructural
   */
  filterEventsByDate(events: any, targetDates: string[]): any[] {
    if (!events) return [];
    const list = Array.isArray(events) ? events : (events.items || events.result || events.features || []);
    if (!Array.isArray(list) || list.length === 0) return [];

    return list.filter(item => {
      const itemStr = JSON.stringify(item).toLowerCase();
      // Búsqueda por formato de fecha YYYY-MM-DD o DD/MM
      return targetDates.some(d => {
        if (itemStr.includes(d)) return true;
        const [year, month, day] = d.split('-');
        if (day && month) {
          const slashDate = `${day}/${month}`;
          const hyphenDate = `${day}-${month}`;
          if (itemStr.includes(slashDate) || itemStr.includes(hyphenDate)) return true;
        }
        return false;
      });
    });
  }
}

export const eventsService = new VigoEventsService();
