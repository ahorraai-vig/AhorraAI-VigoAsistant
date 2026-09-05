import { vigoCache } from './vigoCacheService.js';
import type { VigoResponse } from './vigoMobilityService.js';

export class VigoGeoService {
  async getStreets(): Promise<VigoResponse<any>> {
    return { data: null, source: 'Concello de Vigo', retrieved_at: new Date().toISOString(), license: 'CC BY 4.0', healthy: false };
  }
}

export const geoService = new VigoGeoService();
