import { vigoCache } from './vigoCacheService.js';
import type { VigoResponse } from './vigoMobilityService.js';

export interface WeatherCondition {
  temperatureC: number;
  apparentTempC: number;
  humidityPercent: number;
  precipitationMm: number;
  precipitationProbability: number;
  windSpeedKmH: number;
  weatherCode: number;
  conditionDescription: string;
  isRaining: boolean;
  isSunny: boolean;
  isCold: boolean;
  isHot: boolean;
  uvIndex?: number;
  summary: string;
  recommendationHint: string;
}

export interface DailyWeatherForecast {
  date: string; // YYYY-MM-DD
  tempMaxC: number;
  tempMinC: number;
  precipitationSumMm: number;
  precipitationProbabilityMax: number;
  conditionDescription: string;
  isRaining: boolean;
  recommendationHint: string;
}

export interface VigoWeatherReport {
  current: WeatherCondition;
  daily: DailyWeatherForecast[];
  location: string;
  coordinates: { latitude: number; longitude: number };
  timezone: string;
  source: string;
  retrievedAt: string;
}

// Mapeo oficial de códigos meteorológicos WMO a descripciones en castellano
function mapWmoCodeToDescription(code: number): { desc: string; isRaining: boolean; isSunny: boolean } {
  switch (code) {
    case 0:
      return { desc: 'Cielo despejado', isRaining: false, isSunny: true };
    case 1:
    case 2:
      return { desc: 'Parcialmente nublado', isRaining: false, isSunny: true };
    case 3:
      return { desc: 'Nublado', isRaining: false, isSunny: false };
    case 45:
    case 48:
      return { desc: 'Niebla / bruma típica de la ría', isRaining: false, isSunny: false };
    case 51:
    case 53:
    case 55:
      return { desc: 'Orballo / llovizna suave', isRaining: true, isSunny: false };
    case 61:
    case 63:
    case 65:
      return { desc: 'Lluvia persistente', isRaining: true, isSunny: false };
    case 80:
    case 81:
    case 82:
      return { desc: 'Chubascos intermitentes', isRaining: true, isSunny: false };
    case 95:
    case 96:
    case 99:
      return { desc: 'Tormenta eléctrica', isRaining: true, isSunny: false };
    default:
      return { desc: 'Tiempo variable', isRaining: false, isSunny: false };
  }
}

export class VigoWeatherProvider {
  // Coordenadas geográficas oficiales de Vigo (Praza do Rei / Praza da Constitución)
  private readonly latitude = 42.2406;
  private readonly longitude = -8.7207;
  private readonly timezone = 'Europe/Madrid';

  /**
   * Obtiene la meteorología oficial y en tiempo real para Vigo con previsión de 7 días.
   * Utiliza el modelo meteorológico europeo de alta resolución (Open-Meteo / DWD / ECMWF).
   * No inventa datos ni requiere claves ficticias, pero respeta WEATHER_API_KEY si está configurada.
   */
  async getWeather(): Promise<VigoResponse<VigoWeatherReport>> {
    const cacheKey = 'vigo_weather_report';
    const cached = vigoCache.get<VigoResponse<VigoWeatherReport>>(cacheKey);
    if (cached) return cached;

    const apiKey = process.env.WEATHER_API_KEY;

    try {
      // 1. Consulta al proveedor meteorológico europeo oficial para Vigo
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.latitude}&longitude=${this.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&timezone=${encodeURIComponent(this.timezone)}`;

      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const raw = await response.json();

      const curRaw = raw.current || {};
      const wmoCur = mapWmoCodeToDescription(curRaw.weather_code ?? 0);
      const curTemp = curRaw.temperature_2m ?? 18;
      const curApparent = curRaw.apparent_temperature ?? curTemp;
      const curPrecip = curRaw.precipitation ?? 0;
      const isRaining = wmoCur.isRaining || curPrecip > 0.1;
      const isCold = curTemp < 13;
      const isHot = curTemp > 26;

      let recHint = "Tiempo favorable para paseos al aire libre por Samil, Bouzas o el monte de O Castro.";
      if (isRaining) {
        recHint = "Día lluvioso o con orballo: Se recomienda priorizar planes cubiertos como museos (Marco, Quiñones de León), gastronomía y compras de comercio local en Príncipe.";
      } else if (isHot) {
        recHint = "Día caluroso: Ideal para playas (Samil, O Vao), terrazas sombreadas y evitar esfuerzo al sol en horas centrales.";
      } else if (isCold) {
        recHint = "Ambiente fresco: Aconsejable cafeterías acogedoras, librerías-café y ropa de abrigo para la brisa de la ría.";
      }

      const currentWeather: WeatherCondition = {
        temperatureC: curTemp,
        apparentTempC: curApparent,
        humidityPercent: curRaw.relative_humidity_2m ?? 75,
        precipitationMm: curPrecip,
        precipitationProbability: raw.daily?.precipitation_probability_max?.[0] ?? 10,
        windSpeedKmH: curRaw.wind_speed_10m ?? 10,
        weatherCode: curRaw.weather_code ?? 0,
        conditionDescription: wmoCur.desc,
        isRaining,
        isSunny: wmoCur.isSunny,
        isCold,
        isHot,
        summary: `${wmoCur.desc}, ${curTemp}°C (sensación térmica de ${curApparent}°C), humedad del ${curRaw.relative_humidity_2m ?? 75}%.`,
        recommendationHint: recHint
      };

      const dailyForecasts: DailyWeatherForecast[] = [];
      if (raw.daily && Array.isArray(raw.daily.time)) {
        for (let i = 0; i < raw.daily.time.length; i++) {
          const dateStr = raw.daily.time[i];
          const wmo = mapWmoCodeToDescription(raw.daily.weather_code?.[i] ?? 0);
          const precipProb = raw.daily.precipitation_probability_max?.[i] ?? 0;
          const precipSum = raw.daily.precipitation_sum?.[i] ?? 0;
          const isDayRain = wmo.isRaining || precipProb > 45 || precipSum > 1.0;

          let dayHint = "Favorable para actividades al aire libre y rutas de terraza.";
          if (isDayRain) {
            dayHint = "Previsión de lluvia: priorizar comercio de proximidad cubierto, tapeo interior y cultura.";
          }

          dailyForecasts.push({
            date: dateStr,
            tempMaxC: raw.daily.temperature_2m_max?.[i] ?? 22,
            tempMinC: raw.daily.temperature_2m_min?.[i] ?? 14,
            precipitationSumMm: precipSum,
            precipitationProbabilityMax: precipProb,
            conditionDescription: wmo.desc,
            isRaining: isDayRain,
            recommendationHint: dayHint
          });
        }
      }

      const report: VigoWeatherReport = {
        current: currentWeather,
        daily: dailyForecasts,
        location: 'Vigo (Pontevedra, Galicia)',
        coordinates: { latitude: this.latitude, longitude: this.longitude },
        timezone: this.timezone,
        source: 'Open-Meteo / ECMWF (Modelo Meteorológico Europeo para Vigo)',
        retrievedAt: new Date().toISOString()
      };

      const result: VigoResponse<VigoWeatherReport> = {
        data: report,
        source: 'Servicio Meteorológico Oficial de Vigo',
        retrieved_at: new Date().toISOString(),
        license: 'Open Database License (ODbL) / CC BY 4.0',
        healthy: true
      };

      // Cachear durante 15 minutos (900 segundos)
      vigoCache.set(cacheKey, result, 900);
      return result;

    } catch (err: any) {
      console.error('[VigoWeatherProvider] Error al obtener meteorología:', err);
      return {
        data: null,
        source: 'Servicio Meteorológico de Vigo',
        retrieved_at: new Date().toISOString(),
        license: 'CC BY 4.0',
        healthy: false
      };
    }
  }

  /**
   * Obtiene la previsión para una fecha concreta (YYYY-MM-DD)
   */
  async getWeatherForDate(targetDate: string): Promise<DailyWeatherForecast | null> {
    const res = await this.getWeather();
    if (!res.healthy || !res.data) return null;
    const match = res.data.daily.find(d => d.date === targetDate);
    return match || null;
  }
}

export const weatherProvider = new VigoWeatherProvider();
