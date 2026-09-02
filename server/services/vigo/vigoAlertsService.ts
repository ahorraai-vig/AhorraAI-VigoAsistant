import { vigoCache } from './vigoCacheService';
import type { VigoResponse } from './vigoMobilityService';
import { mobilityService } from './vigoMobilityService';

export class VigoAlertsService {
  /**
   * Obtiene avisos municipales consolidados (cortes de tráfico, obras, emergencias)
   */
  async getAlerts(type?: string): Promise<VigoResponse<any[]>> {
    const cacheKey = `vigo_alerts_${type || 'all'}`;
    const cached = vigoCache.get<VigoResponse<any[]>>(cacheKey);
    if (cached) return cached;

    try {
      const trafficAlerts = await mobilityService.getTrafficAlerts();
      const alertsList: any[] = [];

      if (trafficAlerts.healthy && trafficAlerts.data) {
        const raw = Array.isArray(trafficAlerts.data) ? trafficAlerts.data : [trafficAlerts.data];
        for (const item of raw) {
          alertsList.push({
            id: `alert-traffic-${Date.now()}`,
            type: 'TRAFFIC_INCIDENT',
            title: item.titulo || item.title || item.descripcion || 'Aviso de Tráfico',
            description: item.descripcion || item.description || item.titulo,
            location: item.localizacion || item.calle || 'Vigo',
            retrieved_at: trafficAlerts.retrieved_at
          });
        }
      }

      const result: VigoResponse<any[]> = {
        data: alertsList,
        source: 'Concello de Vigo - Sala de Control y Avisos',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: trafficAlerts.healthy
      };

      vigoCache.set(cacheKey, result, 300); // 5 min cache
      return result;
    } catch (err: any) {
      console.warn('[VigoAlertsService] Error fetching alerts:', err);
      return {
        data: [],
        source: 'Concello de Vigo - Avisos',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: false
      };
    }
  }
}

export const alertsService = new VigoAlertsService();
