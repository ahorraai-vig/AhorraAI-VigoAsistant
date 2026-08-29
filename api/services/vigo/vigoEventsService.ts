import { vigoCache } from './vigoCacheService';
import { catalogService } from './vigoCatalogService';
import type { VigoResponse } from './vigoMobilityService';

export class VigoEventsService {
  async getEvents(): Promise<VigoResponse<any>> {
    const cacheKey = 'vigo_events';
    const cached = vigoCache.get<VigoResponse<any>>(cacheKey);
    if (cached) return cached;

    try {
      // First, find the dataset for agenda
      const datasets = await catalogService.searchPackages('agenda');
      
      let eventsData = null;
      let healthy = false;

      // Try to find a JSON resource in the first few datasets
      for (const dataset of datasets) {
        const jsonResource = dataset.resources.find(r => r.format.toLowerCase() === 'json');
        if (jsonResource) {
          try {
             const response = await fetch(jsonResource.url, { signal: AbortSignal.timeout(5000) });
             if (response.ok) {
                 eventsData = await response.json();
                 healthy = true;
                 break;
             }
          } catch(e) {
             console.warn('Failed to fetch event resource URL', jsonResource.url);
          }
        }
      }

      const result: VigoResponse<any> = {
        data: eventsData,
        source: 'Concello de Vigo',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy
      };
      
      if (healthy) {
         vigoCache.set(cacheKey, result, 3600); // 1 hour TTL
      }
      return result;
    } catch (error) {
      console.error('[VigoEventsService] Error fetching events:', error);
      return { data: null, source: 'Concello de Vigo', retrieved_at: new Date().toISOString(), license: 'CC BY 4.0', healthy: false };
    }
  }
}

export const eventsService = new VigoEventsService();
