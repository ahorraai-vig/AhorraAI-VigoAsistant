import { vigoCache } from './vigoCacheService';
import type { VigoResponse } from './vigoMobilityService';

export class VigoTourismService {
  async getPOI(category?: string): Promise<VigoResponse<any>> {
    return { data: null, source: 'Concello de Vigo', retrieved_at: new Date().toISOString(), license: 'CC BY 4.0', healthy: false };
  }
}

export const tourismService = new VigoTourismService();
