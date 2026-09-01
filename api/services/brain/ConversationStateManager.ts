/**
 * AHORRAAI v4 — GESTOR DETERMINISTA DE ESTADO CONVERSACIONAL
 * Gestiona el contexto espaciotemporal, dimensiones acumuladas, decaimiento de entidades
 * y resolución de contradicciones sin degradación por longitud de chat.
 */

export interface EntityHistoryRecord {
  entityId: string;
  suggestedAtTurn: number;
  status: 'suggested' | 'dismissed' | 'selected' | 'pinned';
}

export interface ConversationContextState {
  sessionId: string;
  turnIndex: number;
  createdAt: number;
  updatedAt: number;

  // 1. Coordenadas Espaciotemporales Deterministas
  temporal: {
    targetDate: string;              // ISO YYYY-MM-DD
    scope: string;                   // 'today' | 'tomorrow' | 'this_weekend' | 'historical' etc.
    description: string;             // Texto descriptivo (ej: "Lunes, 31 de agosto de 2026")
    isFuture: boolean;
    isHistorical: boolean;
  };

  // 2. Coordenadas Geográficas
  geo: {
    location: string;                // Por defecto: "Vigo"
    activeZone?: string;             // ej: "Casco Vello", "Bouzas", "Centro", "Samil", "Calvario"
  };

  // 3. Composición del Grupo / Acompañantes
  party: {
    type: 'alone' | 'couple' | 'family' | 'friends';
    size: number;
  };

  // 4. Dimensiones de Preferencia Acumuladas
  preferences: {
    vibe?: 'romantic' | 'cultural' | 'gastronomic' | 'relax' | 'nightlife' | string;
    budget?: 'free' | 'cheap' | 'moderate' | 'expensive';
    indoorRequired?: boolean;
    categoryConstraint?: string;
  };

  // 5. Historial de Entidades para Decaimiento y Control de Repetición
  entityHistory: EntityHistoryRecord[];

  // 6. Resumen del Último Plan Activo
  activePlanSummary?: string;

  // 7. Estado Transaccional para Reservas / Compras Seguras
  activeTransaction?: {
    type: 'booking' | 'purchase';
    entityId: string;
    status: 'pending_confirmation' | 'confirmed' | 'cancelled';
    details?: Record<string, any>;
    idempotencyKey: string;
  };
}

export class ConversationStateManager {
  private sessions: Map<string, ConversationContextState> = new Map();
  private readonly DEFAULT_COOLDOWN_TURNS = 2;
  private readonly DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 Horas

  constructor() {
    // Tarea periódica para limpiar sesiones expiradas
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.cleanStaleSessions(), 1000 * 60 * 30);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
    }
  }

  /**
   * Obtiene o crea el estado de una sesión con valores por defecto seguros
   */
  public getOrCreateState(
    sessionId: string, 
    initialParams?: Partial<ConversationContextState>
  ): ConversationContextState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.updatedAt = Date.now();
      return existing;
    }

    const now = new Date();
    const defaultDate = now.toISOString().split('T')[0];

    const newState: ConversationContextState = {
      sessionId,
      turnIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      temporal: {
        targetDate: defaultDate,
        scope: 'today',
        description: 'Hoy en Vigo',
        isFuture: false,
        isHistorical: false,
        ...initialParams?.temporal
      },
      geo: {
        location: 'Vigo',
        activeZone: initialParams?.geo?.activeZone,
        ...initialParams?.geo
      },
      party: {
        type: 'couple',
        size: 2,
        ...initialParams?.party
      },
      preferences: {
        ...initialParams?.preferences
      },
      entityHistory: [],
      activePlanSummary: initialParams?.activePlanSummary
    };

    this.sessions.set(sessionId, newState);
    return newState;
  }

  /**
   * Obtiene el estado actual si existe
   */
  public getState(sessionId: string): ConversationContextState | undefined {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.updatedAt = Date.now();
    }
    return state;
  }

  /**
   * Avanza el contador de turnos de la conversación
   */
  public advanceTurn(sessionId: string): number {
    const state = this.getOrCreateState(sessionId);
    state.turnIndex += 1;
    state.updatedAt = Date.now();
    return state.turnIndex;
  }

  /**
   * Actualiza las coordenadas temporales
   */
  public updateTemporal(
    sessionId: string,
    temporalInfo: {
      targetDate: string;
      scope: string;
      description: string;
      isFuture: boolean;
      isHistorical: boolean;
    }
  ): void {
    const state = this.getOrCreateState(sessionId);
    state.temporal = { ...temporalInfo };
    state.updatedAt = Date.now();
  }

  /**
   * Actualiza el grupo / acompañantes
   */
  public updateParty(
    sessionId: string,
    partyType: 'alone' | 'couple' | 'family' | 'friends',
    size?: number
  ): void {
    const state = this.getOrCreateState(sessionId);
    state.party.type = partyType;
    state.party.size = size || (partyType === 'alone' ? 1 : partyType === 'couple' ? 2 : 4);
    state.updatedAt = Date.now();
  }

  /**
   * Actualiza la zona geográfica activa de Vigo
   */
  public updateZone(sessionId: string, zone?: string): void {
    const state = this.getOrCreateState(sessionId);
    state.geo.activeZone = zone;
    state.updatedAt = Date.now();
  }

  /**
   * Aplica refinamientos dimensionales (vibe, presupuesto, indoor, categoría)
   */
  public applyRefinements(
    sessionId: string,
    refinements: {
      vibe?: string;
      budget?: 'free' | 'cheap' | 'moderate' | 'expensive';
      indoorRequired?: boolean;
      categoryConstraint?: string;
    }
  ): void {
    const state = this.getOrCreateState(sessionId);
    if (refinements.vibe !== undefined) state.preferences.vibe = refinements.vibe;
    if (refinements.budget !== undefined) state.preferences.budget = refinements.budget;
    if (refinements.indoorRequired !== undefined) state.preferences.indoorRequired = refinements.indoorRequired;
    if (refinements.categoryConstraint !== undefined) state.preferences.categoryConstraint = refinements.categoryConstraint;
    state.updatedAt = Date.now();
  }

  /**
   * Registra entidades sugeridas en el turno actual para el cálculo de decaimiento
   */
  public recordSuggestedEntities(sessionId: string, entityIds: string[]): void {
    const state = this.getOrCreateState(sessionId);
    const currentTurn = state.turnIndex;

    for (const id of entityIds) {
      const existing = state.entityHistory.find(e => e.entityId === id);
      if (existing) {
        existing.suggestedAtTurn = currentTurn;
        if (existing.status !== 'pinned') {
          existing.status = 'suggested';
        }
      } else {
        state.entityHistory.push({
          entityId: id,
          suggestedAtTurn: currentTurn,
          status: 'suggested'
        });
      }
    }
    state.updatedAt = Date.now();
  }

  /**
   * Registra retroalimentación del usuario sobre una entidad
   */
  public recordUserFeedback(
    sessionId: string, 
    entityId: string, 
    status: 'selected' | 'dismissed' | 'pinned'
  ): void {
    const state = this.getOrCreateState(sessionId);
    const existing = state.entityHistory.find(e => e.entityId === entityId);
    if (existing) {
      existing.status = status;
    } else {
      state.entityHistory.push({
        entityId,
        suggestedAtTurn: state.turnIndex,
        status
      });
    }
    state.updatedAt = Date.now();
  }

  /**
   * Retorna los IDs de entidades que están en enfriamiento (cooldown) y no deben repetirse
   */
  public getCooldownEntityIds(sessionId: string, cooldownTurns?: number): string[] {
    const state = this.getState(sessionId);
    if (!state) return [];

    const cooldown = cooldownTurns ?? this.DEFAULT_COOLDOWN_TURNS;
    const currentTurn = state.turnIndex;

    return state.entityHistory
      .filter(record => {
        // Entidades explícitamente descartadas se bloquean siempre
        if (record.status === 'dismissed') return true;
        // Entidades ancladas o seleccionadas pueden reaparecer
        if (record.status === 'pinned' || record.status === 'selected') return false;
        // Entidades sugeridas recientemente están en cooldown
        return (currentTurn - record.suggestedAtTurn) < cooldown;
      })
      .map(r => r.entityId);
  }

  /**
   * Resetea las preferencias efímeras ante giros radicales de intención ("olvida lo anterior", "cambio de plan")
   */
  public resetPreferences(sessionId: string, keepPartyAndDate: boolean = true): void {
    const state = this.getOrCreateState(sessionId);
    state.preferences = {};
    if (!keepPartyAndDate) {
      state.party = { type: 'couple', size: 2 };
      state.geo.activeZone = undefined;
    }
    state.updatedAt = Date.now();
  }

  /**
   * Inicia o actualiza una transacción pendiente (Reserva o Compra segura)
   */
  public setPendingTransaction(
    sessionId: string,
    transaction: {
      type: 'booking' | 'purchase';
      entityId: string;
      details?: Record<string, any>;
      idempotencyKey: string;
    }
  ): void {
    const state = this.getOrCreateState(sessionId);
    state.activeTransaction = {
      ...transaction,
      status: 'pending_confirmation'
    };
    state.updatedAt = Date.now();
  }

  /**
   * Limpia sesiones inactivas para optimizar memoria
   */
  public cleanStaleSessions(maxAgeMs?: number): number {
    const ttl = maxAgeMs ?? this.DEFAULT_SESSION_TTL_MS;
    const now = Date.now();
    let cleaned = 0;

    for (const [id, state] of this.sessions.entries()) {
      if (now - state.updatedAt > ttl) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// Instancia singleton para el runtime del servidor
export const conversationStateManager = new ConversationStateManager();
