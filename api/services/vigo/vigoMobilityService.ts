import { vigoCache } from './vigoCacheService';

const DATA_BASE_URL = process.env.VIGO_DATA_BASE_URL || 'https://datos.vigo.org/data';

export type VigoResponse<T> = {
  data: T | null;
  source: string;
  retrieved_at: string;
  data_timestamp?: string;
  license: string;
  healthy: boolean;
};

export class VigoMobilityService {
  async getParkingStatus(): Promise<VigoResponse<any>> {
    const url = `${DATA_BASE_URL}/trafico/parkings-ocupacion.json`;
    const cacheKey = 'vigo_parking';
    const cached = vigoCache.get<VigoResponse<any>>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      const result: VigoResponse<any> = {
        data,
        source: 'Concello de Vigo',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: true
      };
      vigoCache.set(cacheKey, result, 60 * 5); // 5 minutes TTL
      return result;
    } catch (error) {
      console.error('[VigoMobilityService] Error fetching parking:', error);
      return { data: null, source: 'Concello de Vigo', retrieved_at: new Date().toISOString(), license: 'CC BY 4.0', healthy: false };
    }
  }

  async getTrafficStatus(): Promise<VigoResponse<any>> {
    const url = `${DATA_BASE_URL}/trafico/treal_congestion.json`;
    const cacheKey = 'vigo_traffic';
    const cached = vigoCache.get<VigoResponse<any>>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      const result: VigoResponse<any> = {
        data,
        source: 'Concello de Vigo',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: true
      };
      vigoCache.set(cacheKey, result, 60 * 5); // 5 minutes TTL
      return result;
    } catch (error) {
      console.error('[VigoMobilityService] Error fetching traffic:', error);
      return { data: null, source: 'Concello de Vigo', retrieved_at: new Date().toISOString(), license: 'CC BY 4.0', healthy: false };
    }
  }

  async getTrafficAlerts(): Promise<VigoResponse<any>> {
    const url = `${DATA_BASE_URL}/trafico/avisos-trafico-es.json`;
    const cacheKey = 'vigo_traffic_alerts';
    const cached = vigoCache.get<VigoResponse<any>>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      const result: VigoResponse<any> = {
        data,
        source: 'Concello de Vigo',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: true
      };
      vigoCache.set(cacheKey, result, 60 * 15); // 15 minutes TTL
      return result;
    } catch (error) {
      console.error('[VigoMobilityService] Error fetching traffic alerts:', error);
      return { data: null, source: 'Concello de Vigo', retrieved_at: new Date().toISOString(), license: 'CC BY 4.0', healthy: false };
    }
  }

  async getBusStops(): Promise<VigoResponse<any>> {
    const url = `${DATA_BASE_URL}/transporte/paradas.json`;
    const cacheKey = 'vigo_bus_stops';
    const cached = vigoCache.get<VigoResponse<any>>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      const result: VigoResponse<any> = {
        data,
        source: 'Concello de Vigo',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: true
      };
      vigoCache.set(cacheKey, result, 3600 * 24); // 24 hours TTL
      return result;
    } catch (error) {
      console.error('[VigoMobilityService] Error fetching bus stops:', error);
      return { data: null, source: 'Concello de Vigo', retrieved_at: new Date().toISOString(), license: 'CC BY 4.0', healthy: false };
    }
  }
}

export const mobilityService = new VigoMobilityService();
