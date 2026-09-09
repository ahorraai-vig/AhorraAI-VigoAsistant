import {
  Business,
  DigitalAudit,
  BusinessSignal,
  ScoreExplanation,
  ScoreContribution,
} from "../../types/prospector";

export const ALGORITHM_VERSION = "1.0";

export const clamp = (
  value: number,
  min = 0,
  max = 100
): number => {
  return Math.max(min, Math.min(max, value));
};

export function contribution(
  code: string,
  points: number,
  reason: string
): ScoreContribution {
  return {
    code,
    points,
    reason,
  };
}

/**
 * DIGITAL WEAKNESS
 *
 * Higher = more digital opportunity.
 */
export function calculateDigitalWeakness(
  business: Business,
  audit?: DigitalAudit | null
) {
  const contributions: ScoreContribution[] = [];

  if (!audit) {
    return {
      score: 50,
      contributions: [
        contribution(
          "NO_AUDIT",
          0,
          "Sin auditoría digital disponible; se utiliza valor de referencia neutral (50)."
        ),
      ],
    };
  }

  if (audit.website_exists === false) {
    contributions.push(
      contribution(
        "NO_WEBSITE",
        25,
        "No se detectó sitio web oficial."
      )
    );
  }

  if (
    audit.website_exists === true &&
    audit.website_quality !== null &&
    audit.website_quality !== undefined
  ) {
    if (audit.website_quality < 40) {
      contributions.push(
        contribution(
          "WEBSITE_VERY_WEAK",
          15,
          "La calidad del sitio web es deficiente (<40)."
        )
      );
    } else if (audit.website_quality < 65) {
      contributions.push(
        contribution(
          "WEBSITE_MEDIOCRE",
          7,
          "La calidad del sitio web es mediocre (<65)."
        )
      );
    }
  }

  if (audit.cta_present === false) {
    contributions.push(
      contribution(
        "NO_CTA",
        5,
        "Sin llamada a la acción (CTA) clara detectada."
      )
    );
  }

  if (audit.quote_form === false) {
    contributions.push(
      contribution(
        "NO_QUOTE_FORM",
        7,
        "Sin formulario de solicitud de presupuesto online."
      )
    );
  }

  if (audit.whatsapp_visible === false) {
    contributions.push(
      contribution(
        "NO_WHATSAPP",
        5,
        "Sin botón o enlace de WhatsApp visible."
      )
    );
  }

  if (audit.portfolio_present === false) {
    contributions.push(
      contribution(
        "NO_PORTFOLIO",
        5,
        "Sin catálogo de trabajos o portfolio de proyectos."
      )
    );
  }

  if (audit.services_present === false) {
    contributions.push(
      contribution(
        "NO_SERVICES",
        4,
        "Servicios no detallados con claridad."
      )
    );
  }

  if (audit.mobile_friendly === false) {
    contributions.push(
      contribution(
        "NOT_MOBILE_FRIENDLY",
        5,
        "La web no está optimizada para dispositivos móviles."
      )
    );
  }

  if (audit.email_visible === false) {
    contributions.push(
      contribution(
        "NO_EMAIL",
        2,
        "Sin correo electrónico corporativo o visible."
      )
    );
  }

  if (
    audit.last_content_date &&
    monthsSince(audit.last_content_date) > 24
  ) {
    contributions.push(
      contribution(
        "STALE_CONTENT",
        5,
        "Contenido web desactualizado (>24 meses sin cambios)."
      )
    );
  }

  const score = clamp(
    contributions.reduce((sum, item) => sum + item.points, 0)
  );

  return {
    score,
    contributions,
  };
}

/**
 * COMMERCIAL POTENTIAL
 *
 * Higher = more commercially attractive.
 */
export function calculateCommercialPotential(
  business: Business,
  signals: BusinessSignal[] = []
) {
  const contributions: ScoreContribution[] = [];

  if (business.rating !== null && business.rating !== undefined) {
    if (business.rating >= 4.5) {
      contributions.push(
        contribution(
          "HIGH_RATING",
          15,
          "Valoración pública sobresaliente (>= 4.5 ⭐)."
        )
      );
    } else if (business.rating >= 4.0) {
      contributions.push(
        contribution(
          "GOOD_RATING",
          8,
          "Buena reputación pública (>= 4.0 ⭐)."
        )
      );
    }
  }

  if (
    business.review_count !== null &&
    business.review_count !== undefined
  ) {
    if (business.review_count >= 50) {
      contributions.push(
        contribution(
          "MANY_REVIEWS",
          15,
          "Volumen elevado de reseñas (>= 50 reseñas)."
        )
      );
    } else if (business.review_count >= 20) {
      contributions.push(
        contribution(
          "GOOD_REVIEW_VOLUME",
          10,
          "Buen volumen de opiniones (>= 20 reseñas)."
        )
      );
    } else if (business.review_count >= 5) {
      contributions.push(
        contribution(
          "SOME_REVIEWS",
          5,
          "Presencia inicial de reseñas públicas (>= 5 reseñas)."
        )
      );
    }
  }

  const recentReviews = signals.find(
    s => s.signal_code === "RECENT_REVIEWS"
  );

  if (recentReviews) {
    contributions.push(
      contribution(
        "RECENT_REVIEWS",
        10,
        "Actividad reciente de clientes (reseñas en los últimos 90 días)."
      )
    );
  }

  if (business.phone_normalized) {
    contributions.push(
      contribution(
        "PHONE_AVAILABLE",
        5,
        "Teléfono directo de contacto verificado."
      )
    );
  }

  if (
    business.estimated_size === "SOLO" ||
    business.estimated_size === "MICRO_2_3"
  ) {
    contributions.push(
      contribution(
        "MICRO_BUSINESS",
        10,
        "Estructura óptima para ICP (autónomo o microempresa 1-3)."
      )
    );
  }

  const category = (
    business.primary_category || ""
  ).toLowerCase();

  if (
    category.includes("reforma") ||
    category.includes("rehabilitación") ||
    category.includes("rehabilitacion")
  ) {
    contributions.push(
      contribution(
        "HIGH_VALUE_REFORM_CATEGORY",
        10,
        "Sector de alto ticket medio (reformas o rehabilitación)."
      )
    );
  }

  const recentActivity = signals.find(
    s => s.signal_code === "RECENT_ACTIVITY"
  );

  if (recentActivity) {
    contributions.push(
      contribution(
        "RECENT_ACTIVITY",
        5,
        "Señales verificadas de actividad comercial reciente."
      )
    );
  }

  const score = clamp(
    contributions.reduce((sum, item) => sum + item.points, 0)
  );

  return {
    score,
    contributions,
  };
}

/**
 * PRIORITY SCORE
 */
export function calculatePriority(
  digitalWeakness: number,
  commercialPotential: number,
  business: Business
) {
  let priority =
    digitalWeakness * 0.45 +
    commercialPotential * 0.55;

  const adjustments: ScoreContribution[] = [];

  if (business.estimated_size === "MICRO_2_3") {
    priority += 5;

    adjustments.push(
      contribution(
        "MICRO_2_3_BONUS",
        5,
        "Bonificación: tamaño microempresa 2-3 encaja con target ICP."
      )
    );
  }

  if (business.estimated_size === "SOLO") {
    priority += 4;

    adjustments.push(
      contribution(
        "SOLO_BONUS",
        4,
        "Bonificación: profesional autónomo individual encaja con target ICP."
      )
    );
  }

  if (digitalWeakness >= 85) {
    priority += 5;

    adjustments.push(
      contribution(
        "HIGH_DIGITAL_OPPORTUNITY",
        5,
        "Gran margen de mejora digital (Debilidad digital >= 85)."
      )
    );
  }

  if (digitalWeakness <= 25) {
    priority -= 20;

    adjustments.push(
      contribution(
        "DIGITAL_MATURITY_PENALTY",
        -20,
        "Penalización: negocio ya altamente maduro digitalmente (Debilidad <= 25)."
      )
    );
  }

  return {
    score: clamp(priority),
    adjustments,
  };
}

/**
 * CONFIDENCE SCORE
 */
export function calculateConfidence(
  business: Business,
  audit?: DigitalAudit | null,
  signals: BusinessSignal[] = []
) {
  const factors: number[] = [];

  if (business.name && business.name.trim()) factors.push(100);
  if (business.phone_normalized) factors.push(100);
  if (business.municipality && business.municipality.trim()) factors.push(100);
  if (business.rating !== null && business.rating !== undefined) factors.push(90);
  if (business.review_count !== null && business.review_count !== undefined) factors.push(90);

  if (audit) factors.push(90);

  if (signals.length > 0) {
    const avgSignalConfidence =
      signals.reduce(
        (sum, s) => sum + (s.confidence ?? 50),
        0
      ) / signals.length;

    factors.push(avgSignalConfidence);
  }

  if (factors.length === 0) return 0;

  return clamp(
    factors.reduce((a, b) => a + b, 0) / factors.length
  );
}

/**
 * COMPLETE SCORE
 */
export function calculateLeadScore(
  business: Business,
  audit?: DigitalAudit | null,
  signals: BusinessSignal[] = []
) {
  const digital = calculateDigitalWeakness(business, audit);
  const commercial = calculateCommercialPotential(business, signals);
  const priority = calculatePriority(digital.score, commercial.score, business);
  const confidence = calculateConfidence(business, audit, signals);
  const tier = getTier(priority.score);

  const explanation: ScoreExplanation = {
    digital: {
      raw: digital.score,
      contributions: digital.contributions,
    },
    commercial: {
      raw: commercial.score,
      contributions: commercial.contributions,
    },
    adjustments: priority.adjustments,
    final: priority.score,
  };

  return {
    digitalWeaknessScore: round(digital.score),
    commercialPotentialScore: round(commercial.score),
    priorityScore: round(priority.score),
    confidenceScore: round(confidence),
    tier,
    explanation,
    algorithmVersion: ALGORITHM_VERSION,
  };
}

export function getTier(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

export function monthsSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  if (isNaN(date.getTime())) return 0;

  return (
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth())
  );
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}
