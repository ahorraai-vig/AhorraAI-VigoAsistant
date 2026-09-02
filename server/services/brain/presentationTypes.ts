import { z } from 'zod';

// ============================================================================
// AHORRAAI v4 — MODELOS Y CONTRATOS DE PRESENTACIÓN E INTERACCIÓN
// ============================================================================

/**
 * Códigos de Razón Semántica Tipados
 * El LLM selecciona uno de estos códigos en lugar de redactar prosa libre arbitraria
 */
export type SelectionReasonCode =
  | 'PERFECT_MATCH'          // Coincidencia exacta con lo solicitado
  | 'VIBE_ROMANTIC'          // Ambiente íntimo / pareja
  | 'VIBE_FAMILY'            // Adecuado para niños / familia
  | 'VIBE_RELAX'             // Tranquilo / sin aglomeraciones
  | 'VIBE_CULTURAL'          // Enfoque histórico / patrimonial
  | 'VIBE_GASTRONOMIC'       // Especialidad culinaria o producto de ría
  | 'WEATHER_INDOOR'         // Recomendado por lluvia / mal tiempo / orballo
  | 'WEATHER_OUTDOOR'        // Recomendado por día despejado / sol / terraza
  | 'LOCAL_SPECIALTY'        // Referencia auténtica local de Vigo
  | 'SYNERGY_BENEFIT'        // Oferta cruzada, hora valle o bono disponible
  | 'PROXIMITY_PAIR'         // Combina geográficamente con la actividad previa
  | 'HIGH_TRUST_PARTNER';    // Comercio auditado con acuerdo directo verificado

export const SelectionReasonCodeSchema = z.enum([
  'PERFECT_MATCH',
  'VIBE_ROMANTIC',
  'VIBE_FAMILY',
  'VIBE_RELAX',
  'VIBE_CULTURAL',
  'VIBE_GASTRONOMIC',
  'WEATHER_INDOOR',
  'WEATHER_OUTDOOR',
  'LOCAL_SPECIALTY',
  'SYNERGY_BENEFIT',
  'PROXIMITY_PAIR',
  'HIGH_TRUST_PARTNER'
]);

/**
 * Entidad Candidata Pre-filtrada (Input para la Selección Semántica)
 * Sanitizada para prevenir Prompt Injection y alucinaciones factuales.
 */
export interface CandidateEntity {
  id: string;
  name: string;
  category: string;
  zone: string;
  priceLevel: 'FREE' | 'CHEAP' | 'MODERATE' | 'EXPENSIVE';
  verifiedTags: string[];
  honestyStatus: 'DICHO' | 'OBSERVADO' | 'SIN_CONFIRMAR';
  isPartner: boolean;
  operatesInTimeSlot?: boolean;
}

export const CandidateEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  zone: z.string(),
  priceLevel: z.enum(['FREE', 'CHEAP', 'MODERATE', 'EXPENSIVE']),
  verifiedTags: z.array(z.string()),
  honestyStatus: z.enum(['DICHO', 'OBSERVADO', 'SIN_CONFIRMAR']),
  isPartner: z.boolean(),
  operatesInTimeSlot: z.boolean().optional()
});

/**
 * Contrato de Salida del LLM: LLMSelectionModel
 * Salida estricta de Gemini en modo estructurado (Cero prosa redundante)
 */
export interface LLMSelectionModel {
  headline: string;               // Titular conciso (máx 40 caracteres)
  summary: string;                // Resumen contextual (máx 140 caracteres)
  selectedEntities: Array<{
    entityId: string;             // ID exacto del candidato provisto
    timeSlot: 'MAÑANA' | 'MEDIODIA' | 'TARDE' | 'NOCHE' | 'UNICO';
    reasonCode: SelectionReasonCode;
    appliedTags: string[];        // Tags verificados seleccionados (máx 2)
  }>;
  suggestedActions: Array<{
    label: string;                // Texto visible del chip (máx 24 caracteres)
    intent: 'refine' | 'quick_query' | 'view_details';
    dimensionKey?: 'vibe' | 'budget' | 'zone' | 'indoorOnly' | 'category';
    dimensionValue?: string;
    queryText?: string;
  }>;
}

export const LLMSelectionModelSchema = z.object({
  headline: z.string().max(60),
  summary: z.string().max(200),
  selectedEntities: z.array(
    z.object({
      entityId: z.string(),
      timeSlot: z.enum(['MAÑANA', 'MEDIODIA', 'TARDE', 'NOCHE', 'UNICO']),
      reasonCode: SelectionReasonCodeSchema,
      appliedTags: z.array(z.string()).max(3)
    })
  ).max(4),
  suggestedActions: z.array(
    z.object({
      label: z.string().max(35),
      intent: z.enum(['refine', 'quick_query', 'view_details']),
      dimensionKey: z.enum(['vibe', 'budget', 'zone', 'indoorOnly', 'category']).optional(),
      dimensionValue: z.string().optional(),
      queryText: z.string().optional()
    })
  ).max(4)
});

// ============================================================================
// CONTRATO DEL MODELO DE PRESENTACIÓN (PRESENTATION MODEL V1)
// ============================================================================

export type HonestyStatus = 'DICHO' | 'OBSERVADO' | 'SIN_CONFIRMAR';

export interface DataHonestyMeta {
  status: HonestyStatus;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourcePriority: 1 | 2 | 3 | 4;
  lastVerifiedAt?: string;
  isStale?: boolean;
}

export type ActionIntentType =
  | 'quick_query'       // Envía texto al chat
  | 'refine'            // Altera dimensión en ConversationState
  | 'view_details'      // Expande ficha de Nivel 2
  | 'open_maps'         // Enlace de mapas externo verificado
  | 'call_phone'        // Teléfono verificado
  | 'start_booking'     // Transacción: Inicia reserva (requiere confirmación)
  | 'start_purchase';   // Transacción: Adquisición de bono/sinergia local

export const ActionIntentTypeSchema = z.enum([
  'quick_query',
  'refine',
  'view_details',
  'open_maps',
  'call_phone',
  'start_booking',
  'start_purchase'
]);

export interface PresentationAction {
  id: string;
  label: string;
  intent: ActionIntentType;
  payload: string;
  params?: Record<string, string | number | boolean>;
  requiresConfirmation?: boolean;
}

export const PresentationActionSchema = z.object({
  id: z.string(),
  label: z.string().max(40),
  intent: ActionIntentTypeSchema,
  payload: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  requiresConfirmation: z.boolean().optional()
});

export interface PresentationCard {
  id: string;
  entityId: string;
  type: 'place' | 'business' | 'event' | 'transport' | 'parking';
  title: string;
  subtitle?: string;
  timeSlot?: string;
  badge?: {
    text: string;
    variant: 'neutral' | 'success' | 'warning' | 'partner';
  };
  honestyStatus: HonestyStatus;
  details: {
    description: string;
    address?: string;
    phone?: string;
    mapsUrl?: string;
    websiteUrl?: string;
    verifiedAttributes?: string[];
    priceLevel?: 'FREE' | 'CHEAP' | 'MODERATE' | 'EXPENSIVE';
    parkingHint?: string;
  };
  actions: PresentationAction[];
}

export const PresentationCardSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  type: z.enum(['place', 'business', 'event', 'transport', 'parking']),
  title: z.string().max(60),
  subtitle: z.string().max(90).optional(),
  timeSlot: z.string().optional(),
  badge: z.object({
    text: z.string(),
    variant: z.enum(['neutral', 'success', 'warning', 'partner'])
  }).optional(),
  honestyStatus: z.enum(['DICHO', 'OBSERVADO', 'SIN_CONFIRMAR']),
  details: z.object({
    description: z.string(),
    address: z.string().optional(),
    phone: z.string().optional(),
    mapsUrl: z.string().optional(),
    websiteUrl: z.string().optional(),
    verifiedAttributes: z.array(z.string()).optional(),
    priceLevel: z.enum(['FREE', 'CHEAP', 'MODERATE', 'EXPENSIVE']).optional(),
    parkingHint: z.string().optional()
  }),
  actions: z.array(PresentationActionSchema)
});

// Bloques semánticos estructurados (Discriminated Unions)
export type PresentationBlock =
  | { 
      type: 'header'; 
      headline: string; 
      summary: string; 
      weather?: { tempC: number; condition: string; icon: string };
      temporalContext: string;
    }
  | { 
      type: 'card_list'; 
      cards: PresentationCard[];
    }
  | { 
      type: 'entity_detail'; 
      card: PresentationCard;
    }
  | { 
      type: 'action_group'; 
      actions: PresentationAction[];
    }
  | { 
      type: 'notice'; 
      level: 'info' | 'warning'; 
      message: string; 
    };

export const PresentationBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('header'),
    headline: z.string(),
    summary: z.string(),
    weather: z.object({
      tempC: z.number(),
      condition: z.string(),
      icon: z.string()
    }).optional(),
    temporalContext: z.string()
  }),
  z.object({
    type: z.literal('card_list'),
    cards: z.array(PresentationCardSchema)
  }),
  z.object({
    type: z.literal('entity_detail'),
    card: PresentationCardSchema
  }),
  z.object({
    type: z.literal('action_group'),
    actions: z.array(PresentationActionSchema)
  }),
  z.object({
    type: z.literal('notice'),
    level: z.enum(['info', 'warning']),
    message: z.string()
  })
]);

export interface PresentationModel {
  version: "4.0";
  budgetLevel: 0 | 1 | 2 | 3;
  blocks: PresentationBlock[];
  sourcesUsed: string[];
}

export const PresentationModelSchema = z.object({
  version: z.literal("4.0"),
  budgetLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  blocks: z.array(PresentationBlockSchema),
  sourcesUsed: z.array(z.string())
});

// ============================================================================
// MATRIZ DE CAPACIDADES DE CANAL (CHANNEL CAPABILITIES)
// ============================================================================

export interface ChannelCapabilities {
  channel: 'web' | 'whatsapp' | 'telegram';
  supportsCards: boolean;
  supportsCarousel: boolean;
  supportsInlineImages: boolean;
  supportsInteractiveButtons: boolean;
  maxActionsPerMessage: number;
  maxCharactersPerText: number;
}

export const CHANNEL_PROFILES: Record<string, ChannelCapabilities> = {
  web: {
    channel: 'web',
    supportsCards: true,
    supportsCarousel: true,
    supportsInlineImages: true,
    supportsInteractiveButtons: true,
    maxActionsPerMessage: 5,
    maxCharactersPerText: 2000
  },
  whatsapp: {
    channel: 'whatsapp',
    supportsCards: false,
    supportsCarousel: false,
    supportsInlineImages: true,
    supportsInteractiveButtons: true,
    maxActionsPerMessage: 3,
    maxCharactersPerText: 1024
  },
  telegram: {
    channel: 'telegram',
    supportsCards: true,
    supportsCarousel: false,
    supportsInlineImages: true,
    supportsInteractiveButtons: true,
    maxActionsPerMessage: 4,
    maxCharactersPerText: 4096
  }
};
