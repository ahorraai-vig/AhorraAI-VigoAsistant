import { vigoCache } from './vigoCacheService';
import type { VigoResponse } from './vigoMobilityService';
import { catalogService } from './vigoCatalogService';

export interface VigoCulturalCenter {
  nombre: string;
  direccion?: string;
  telefono?: string;
  horario?: string;
  categoria?: string;
}

export class VigoTourismService {
  /**
   * Obtiene puntos de interés cultural (museos, centros cívicos, bibliotecas) del Concello de Vigo
   */
  async getCulturalCenters(): Promise<VigoResponse<VigoCulturalCenter[]>> {
    const cacheKey = 'vigo_cultural_centers';
    const cached = vigoCache.get<VigoResponse<VigoCulturalCenter[]>>(cacheKey);
    if (cached) return cached;

    try {
      const directUrl = 'https://datos.vigo.org/data/cultura/centros-culturais.json';
      const response = await fetch(directUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.items || data.centros || [data]);
        const result: VigoResponse<VigoCulturalCenter[]> = {
          data: list,
          source: 'Concello de Vigo - Centros Culturais',
          retrieved_at: new Date().toISOString(),
          license: 'CC BY 4.0',
          healthy: true
        };
        vigoCache.set(cacheKey, result, 86400); // 24h
        return result;
      }
    } catch (err) {
      console.warn('[VigoTourismService] Error fetching cultural centers:', err);
    }

    return {
      data: [],
      source: 'Concello de Vigo - Cultura',
      retrieved_at: new Date().toISOString(),
      license: 'CC BY 4.0',
      healthy: false
    };
  }

  /**
   * Obtiene mercados municipales tradicionales (Progreso, O Berbés, Teis, Bouzas, As Travesas)
   */
  async getMunicipalMarkets(): Promise<VigoResponse<any[]>> {
    const cacheKey = 'vigo_municipal_markets';
    const cached = vigoCache.get<VigoResponse<any[]>>(cacheKey);
    if (cached) return cached;

    try {
      const directUrl = 'https://datos.vigo.org/data/comercio/mercados-municipais.json';
      const response = await fetch(directUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.items || [data]);
        const result: VigoResponse<any[]> = {
          data: list,
          source: 'Concello de Vigo - Mercados Municipais',
          retrieved_at: new Date().toISOString(),
          license: 'CC BY 4.0',
          healthy: true
        };
        vigoCache.set(cacheKey, result, 86400);
        return result;
      }
    } catch (err) {
      console.warn('[VigoTourismService] Error fetching municipal markets:', err);
    }

    return {
      data: [],
      source: 'Concello de Vigo - Mercados',
      retrieved_at: new Date().toISOString(),
      license: 'CC BY 4.0',
      healthy: false
    };
  }
}

export const tourismService = new VigoTourismService();
