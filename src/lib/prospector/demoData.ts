import {
  Business,
  DigitalAudit,
  BusinessSignal,
  PainPoint,
  Score,
  LeadStatus,
} from "../../types/prospector";

export interface DemoSeedPackage {
  businesses: Business[];
  audits: Record<string, DigitalAudit>;
  signals: Record<string, BusinessSignal[]>;
  painPoints: Record<string, PainPoint[]>;
  scores: Record<string, Score>;
  leadStatuses: Record<string, { status: LeadStatus; priority: string; notes?: string }>;
}

/**
 * Eliminados todos los datos ficticios/inventados conforme a las instrucciones del usuario.
 * La plataforma opera exclusivamente con datos reales verificados extraídos de Google Maps
 * mediante la API oficial / SerpAPI y sincronizados con la base de datos Supabase.
 */
export function getDemoSeedPackage(): DemoSeedPackage {
  return {
    businesses: [],
    audits: {},
    signals: {},
    painPoints: {},
    scores: {},
    leadStatuses: {},
  };
}
