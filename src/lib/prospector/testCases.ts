import { Business, DigitalAudit, BusinessSignal } from "../../types/prospector";
import {
  calculateDigitalWeakness,
  calculateCommercialPotential,
  calculatePriority,
  calculateConfidence,
  calculateLeadScore,
  getTier,
} from "../scoring/scoringEngine";
import {
  normalizeBusinessName,
  normalizePhone,
  deduplicateBusiness,
} from "./normalization";

export interface TestCaseResult {
  id: number;
  name: string;
  category: string;
  description: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: Record<string, any>;
}

export function runAllProspectorTests(): {
  total: number;
  passed: number;
  failed: number;
  results: TestCaseResult[];
} {
  const results: TestCaseResult[] = [];

  // --- Tests de Normalización y Deduplicación ---
  const normNameTest = normalizeBusinessName("Reformas & Construcciones García, S.L.U.");
  results.push({
    id: 101,
    name: "Normalización de Nombre de Negocio",
    category: "Normalización",
    description: "Debe limpiar caracteres especiales, signos y forma jurídica (S.L.U.)",
    passed: normNameTest === "reformas construcciones garcia",
    expected: "reformas construcciones garcia",
    actual: normNameTest,
  });

  const normPhoneTest = normalizePhone("+34 (986) 22-33-44");
  results.push({
    id: 102,
    name: "Normalización de Teléfono",
    category: "Normalización",
    description: "Debe convertir a formato español limpio de 9 dígitos",
    passed: normPhoneTest === "986223344",
    expected: "986223344",
    actual: normPhoneTest,
  });

  const dedupSample: Business = {
    id: "sample-1",
    name: "Fontanería Rías Baixas S.L.",
    normalized_name: "fontaneria rias baixas",
    phone_normalized: "986554433",
    google_place_id: "ChIJ_SAMPLE_PLACE_1",
    municipality: "Vigo",
    estimated_size: "MICRO_2_3",
    service_area: ["Vigo"],
    is_active: true,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dedupMatch = deduplicateBusiness(
    { google_place_id: "ChIJ_SAMPLE_PLACE_1", name: "Fontanería Rías Baixas", phone_normalized: "986554433", municipality: "Vigo" },
    [dedupSample]
  );
  results.push({
    id: 103,
    name: "Deduplicación Nivel 1 (Google Place ID)",
    category: "Deduplicación",
    description: "Debe identificar duplicado exacto por place id",
    passed: dedupMatch.isDuplicate && dedupMatch.matchLevel === 1,
    expected: "isDuplicate: true, matchLevel: 1",
    actual: `isDuplicate: ${dedupMatch.isDuplicate}, matchLevel: ${dedupMatch.matchLevel}`,
  });

  // Base helper para mockear negocios
  const createMockBusiness = (override: Partial<Business> = {}): Business => ({
    id: "test-" + Math.random().toString(36).substring(2, 7),
    name: "Negocio de Prueba",
    normalized_name: "negocio de prueba",
    municipality: "Vigo",
    primary_category: "Fontanería",
    estimated_size: "MICRO_2_3",
    phone_normalized: "986123456",
    rating: 4.6,
    review_count: 25,
    service_area: ["Vigo"],
    is_active: true,
    first_seen_at: "2026-01-01T00:00:00Z",
    last_seen_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...override,
  });

  // --- 15 CASOS DE SCORING EXIGIDOS EN ESPECIFICACIÓN ---

  // Caso 1: Empresa sin web + buenas reseñas
  {
    const biz = createMockBusiness({
      name: "Reformas Atlántico",
      rating: 4.8,
      review_count: 35,
      estimated_size: "MICRO_2_3",
      primary_category: "reformas integrales"
    });
    const audit: DigitalAudit = {
      id: "a1", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: false, audit_version: "1.0", raw_findings: {}
    };
    const score = calculateLeadScore(biz, audit, []);
    // DWS: NO_WEBSITE(25) = 25
    // CPS: HIGH_RATING(15) + GOOD_REVIEW_VOLUME(10) + PHONE_AVAILABLE(5) + MICRO_BUSINESS(10) + HIGH_VALUE_REFORM_CATEGORY(10) = 50
    // Priority: 25*0.45 + 50*0.55 = 11.25 + 27.5 = 38.75 + MICRO_2_3_BONUS(5) = 43.75 -> round: 43.75 -> Tier D
    results.push({
      id: 1,
      name: "Caso 1: Empresa sin web + buenas reseñas",
      category: "Motor de Scoring",
      description: "DWS debe capturar +25 por no_website y CPS puntuar rating alto y categoría reformas",
      passed: score.digitalWeaknessScore === 25 && score.commercialPotentialScore >= 45,
      expected: "DWS: 25, CPS >= 45",
      actual: `DWS: ${score.digitalWeaknessScore}, CPS: ${score.commercialPotentialScore}, Priority: ${score.priorityScore}`,
      details: score.explanation as any,
    });
  }

  // Caso 2: Empresa con web excelente
  {
    const biz = createMockBusiness({
      name: "ClimaTech Vigo S.L.",
      rating: 4.5,
      review_count: 60,
      estimated_size: "SMALL_4_10",
      primary_category: "climatización"
    });
    const audit: DigitalAudit = {
      id: "a2", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: true, website_quality: 92, mobile_friendly: true,
      https_enabled: true, contact_visible: true, quote_form: true,
      whatsapp_visible: true, portfolio_present: true, services_present: true,
      cta_present: true, audit_version: "1.0", raw_findings: {}
    };
    const score = calculateLeadScore(biz, audit, []);
    // DWS = 0 (porque no tiene ninguna debilidad)
    // Priority debe tener penalización por madurez digital (-20)
    results.push({
      id: 2,
      name: "Caso 2: Empresa con web excelente",
      category: "Motor de Scoring",
      description: "DWS debe ser 0 y recibir penalización por madurez digital (DWS <= 25 => -20 pts en Priority)",
      passed: score.digitalWeaknessScore === 0 && score.priorityScore < score.commercialPotentialScore,
      expected: "DWS: 0 con penalización por madurez digital",
      actual: `DWS: ${score.digitalWeaknessScore}, Priority: ${score.priorityScore} (CPS: ${score.commercialPotentialScore})`,
    });
  }

  // Caso 3: Empresa sin web + mala reputación
  {
    const biz = createMockBusiness({
      rating: 2.5,
      review_count: 8,
      estimated_size: "SMALL_4_10",
      primary_category: "Pintura"
    });
    const audit: DigitalAudit = {
      id: "a3", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: false, audit_version: "1.0", raw_findings: {}
    };
    const score = calculateLeadScore(biz, audit, []);
    // Rating < 4.0 => 0 pts por rating. CPS bajo.
    results.push({
      id: 3,
      name: "Caso 3: Empresa sin web + mala reputación",
      category: "Motor de Scoring",
      description: "DWS es alto (+25) pero CPS permanece muy bajo por falta de reputación comercial",
      passed: score.digitalWeaknessScore === 25 && score.commercialPotentialScore <= 15,
      expected: "DWS: 25, CPS <= 15",
      actual: `DWS: ${score.digitalWeaknessScore}, CPS: ${score.commercialPotentialScore}`,
    });
  }

  // Caso 4: Autónomo con 4.9 y 50 reseñas
  {
    const biz = createMockBusiness({
      name: "Electricidad Brais - Autónomo",
      rating: 4.9,
      review_count: 55,
      estimated_size: "SOLO",
      primary_category: "electricidad",
    });
    const audit: DigitalAudit = {
      id: "a4", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: true, website_quality: 35, mobile_friendly: false,
      quote_form: false, whatsapp_visible: false, portfolio_present: false,
      services_present: false, cta_present: false, audit_version: "1.0", raw_findings: {}
    };
    const signals: BusinessSignal[] = [{
      id: "s1", business_id: biz.id, signal_code: "RECENT_REVIEWS", signal_kind: "FACT",
      score: 10, confidence: 95, signal_value: {}, observed_at: "2026-01-01"
    }];
    const score = calculateLeadScore(biz, audit, signals);
    // SOLO_BONUS (+4), HIGH_RATING(+15), MANY_REVIEWS(+15), RECENT_REVIEWS(+10), PHONE(+5), MICRO_BUSINESS(+10) = 55
    results.push({
      id: 4,
      name: "Caso 4: Autónomo con 4.9 ⭐ y 50 reseñas",
      category: "Motor de Scoring",
      description: "Alta prioridad comercial (CPS >= 50) y bonificación de ICP SOLO (+4)",
      passed: score.commercialPotentialScore >= 50 && score.priorityScore >= 45,
      expected: "CPS >= 50, Priority >= 45 con SOLO_BONUS",
      actual: `CPS: ${score.commercialPotentialScore}, Priority: ${score.priorityScore}, Tier: ${score.tier}`,
    });
  }

  // Caso 5: Empresa mediana con excelente web
  {
    const biz = createMockBusiness({
      estimated_size: "MEDIUM",
      rating: 4.2,
      review_count: 22,
    });
    const audit: DigitalAudit = {
      id: "a5", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: true, website_quality: 85, mobile_friendly: true,
      quote_form: true, whatsapp_visible: true, portfolio_present: true,
      services_present: true, cta_present: true, audit_version: "1.0", raw_findings: {}
    };
    const score = calculateLeadScore(biz, audit, []);
    results.push({
      id: 5,
      name: "Caso 5: Empresa mediana con excelente web",
      category: "Motor de Scoring",
      description: "Sin bonus de micro/solo y penalización por madurez digital",
      passed: score.digitalWeaknessScore === 0 && score.priorityScore <= 20,
      expected: "Priority <= 20 (penalización -20)",
      actual: `DWS: ${score.digitalWeaknessScore}, Priority: ${score.priorityScore}`,
    });
  }

  // Caso 6: Web antigua (>24 meses sin cambios)
  {
    const biz = createMockBusiness();
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 30); // 30 meses atrás
    const audit: DigitalAudit = {
      id: "a6", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: true, website_quality: 60,
      last_content_date: oldDate.toISOString().split("T")[0],
      audit_version: "1.0", raw_findings: {}
    };
    const dws = calculateDigitalWeakness(biz, audit);
    const hasStale = dws.contributions.some(c => c.code === "STALE_CONTENT" && c.points === 5);
    results.push({
      id: 6,
      name: "Caso 6: Web antigua (>24 meses sin actualización)",
      category: "Motor de Scoring",
      description: "Debe sumar +5 puntos a DWS por STALE_CONTENT",
      passed: hasStale,
      expected: "Contiene STALE_CONTENT (+5)",
      actual: hasStale ? "STALE_CONTENT (+5) detectado" : "No detectado",
    });
  }

  // Caso 7: Sin formulario de presupuesto online
  {
    const biz = createMockBusiness();
    const audit: DigitalAudit = {
      id: "a7", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: true, quote_form: false, audit_version: "1.0", raw_findings: {}
    };
    const dws = calculateDigitalWeakness(biz, audit);
    const hasNoQuoteForm = dws.contributions.some(c => c.code === "NO_QUOTE_FORM" && c.points === 7);
    results.push({
      id: 7,
      name: "Caso 7: Sin formulario de presupuestos",
      category: "Motor de Scoring",
      description: "Debe sumar +7 puntos por NO_QUOTE_FORM",
      passed: hasNoQuoteForm,
      expected: "Contiene NO_QUOTE_FORM (+7)",
      actual: hasNoQuoteForm ? "NO_QUOTE_FORM (+7) detectado" : "No detectado",
    });
  }

  // Caso 8: Sin portfolio de trabajos
  {
    const biz = createMockBusiness();
    const audit: DigitalAudit = {
      id: "a8", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: true, portfolio_present: false, audit_version: "1.0", raw_findings: {}
    };
    const dws = calculateDigitalWeakness(biz, audit);
    const hasNoPortfolio = dws.contributions.some(c => c.code === "NO_PORTFOLIO" && c.points === 5);
    results.push({
      id: 8,
      name: "Caso 8: Sin portfolio de proyectos",
      category: "Motor de Scoring",
      description: "Debe sumar +5 puntos por NO_PORTFOLIO",
      passed: hasNoPortfolio,
      expected: "Contiene NO_PORTFOLIO (+5)",
      actual: hasNoPortfolio ? "NO_PORTFOLIO (+5) detectado" : "No detectado",
    });
  }

  // Caso 9: Sin WhatsApp visible
  {
    const biz = createMockBusiness();
    const audit: DigitalAudit = {
      id: "a9", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: true, whatsapp_visible: false, audit_version: "1.0", raw_findings: {}
    };
    const dws = calculateDigitalWeakness(biz, audit);
    const hasNoWhatsapp = dws.contributions.some(c => c.code === "NO_WHATSAPP" && c.points === 5);
    results.push({
      id: 9,
      name: "Caso 9: Sin WhatsApp de contacto visible",
      category: "Motor de Scoring",
      description: "Debe sumar +5 puntos por NO_WHATSAPP",
      passed: hasNoWhatsapp,
      expected: "Contiene NO_WHATSAPP (+5)",
      actual: hasNoWhatsapp ? "NO_WHATSAPP (+5) detectado" : "No detectado",
    });
  }

  // Caso 10: Datos insuficientes
  {
    const biz = createMockBusiness({
      name: "",
      phone_normalized: null,
      municipality: "",
      rating: null,
      review_count: null,
    });
    const conf = calculateConfidence(biz, null, []);
    results.push({
      id: 10,
      name: "Caso 10: Datos insuficientes",
      category: "Motor de Scoring",
      description: "Confidence Score debe ser 0 cuando no hay factores presentes",
      passed: conf === 0,
      expected: "Confidence = 0",
      actual: `Confidence = ${conf}`,
    });
  }

  // Caso 11: Alta oportunidad + baja confianza
  {
    const biz = createMockBusiness({
      rating: null,
      review_count: null,
    });
    const audit: DigitalAudit = {
      id: "a11", business_id: biz.id, audit_date: "2026-01-01",
      website_exists: false, audit_version: "1.0", raw_findings: {}
    };
    const score = calculateLeadScore(biz, audit, []);
    // DWS = 25, pero faltan rating y reviews => confidence menor que 95
    results.push({
      id: 11,
      name: "Caso 11: Alta oportunidad con confianza moderada",
      category: "Motor de Scoring",
      description: "Un lead sin rating/reviews no debe tener 100 de confianza",
      passed: score.confidenceScore < 100 && score.confidenceScore > 0,
      expected: "0 < Confidence < 100",
      actual: `Confidence = ${score.confidenceScore}`,
    });
  }

  // Caso 12: Alta digitalización (Penalización madurez digital)
  {
    const biz = createMockBusiness();
    const priorityResult = calculatePriority(15, 60, biz);
    const hasMaturityPenalty = priorityResult.adjustments.some(
      a => a.code === "DIGITAL_MATURITY_PENALTY" && a.points === -20
    );
    results.push({
      id: 12,
      name: "Caso 12: Alta digitalización (Penalización DWS <= 25)",
      category: "Motor de Scoring",
      description: "Debe aplicar DIGITAL_MATURITY_PENALTY (-20 pts en priority)",
      passed: hasMaturityPenalty,
      expected: "Contiene DIGITAL_MATURITY_PENALTY (-20)",
      actual: hasMaturityPenalty ? "Penalización -20 aplicada" : "No aplicada",
    });
  }

  // Caso 13: Microempresa (1-3 trabajadores)
  {
    const biz = createMockBusiness({ estimated_size: "MICRO_2_3" });
    const cps = calculateCommercialPotential(biz, []);
    const prio = calculatePriority(50, 50, biz);
    const hasMicroCps = cps.contributions.some(c => c.code === "MICRO_BUSINESS" && c.points === 10);
    const hasMicroBonus = prio.adjustments.some(a => a.code === "MICRO_2_3_BONUS" && a.points === 5);
    results.push({
      id: 13,
      name: "Caso 13: Microempresa ICP (2-3 empleados)",
      category: "Motor de Scoring",
      description: "Debe recibir +10 en CPS y bonificación +5 en Priority",
      passed: hasMicroCps && hasMicroBonus,
      expected: "MICRO_BUSINESS (+10 CPS) & MICRO_2_3_BONUS (+5 Priority)",
      actual: `MICRO_BUSINESS: ${hasMicroCps}, MICRO_2_3_BONUS: ${hasMicroBonus}`,
    });
  }

  // Caso 14: Empresa de reformas integrales (Categoría de alto ticket)
  {
    const biz = createMockBusiness({ primary_category: "Empresa de Reformas Integrales y Albañilería" });
    const cps = calculateCommercialPotential(biz, []);
    const hasHighValue = cps.contributions.some(
      c => c.code === "HIGH_VALUE_REFORM_CATEGORY" && c.points === 10
    );
    results.push({
      id: 14,
      name: "Caso 14: Sector de Reformas Integrales",
      category: "Motor de Scoring",
      description: "Debe recibir +10 en CPS por HIGH_VALUE_REFORM_CATEGORY",
      passed: hasHighValue,
      expected: "Contiene HIGH_VALUE_REFORM_CATEGORY (+10)",
      actual: hasHighValue ? "Detectado (+10 CPS)" : "No detectado",
    });
  }

  // Caso 15: Lead DO_NOT_CONTACT o Tiers de Clasificación
  {
    const tierA = getTier(88);
    const tierB = getTier(75);
    const tierC = getTier(60);
    const tierD = getTier(45);
    const tierE = getTier(30);
    const tiersOk = tierA === "A" && tierB === "B" && tierC === "C" && tierD === "D" && tierE === "E";
    results.push({
      id: 15,
      name: "Caso 15: Clasificación Semafórica de Tiers (A, B, C, D, E)",
      category: "Motor de Scoring",
      description: "Verifica los umbrales de tier: >=85: A, >=70: B, >=55: C, >=40: D, <40: E",
      passed: tiersOk,
      expected: "A, B, C, D, E correctos",
      actual: `${tierA}, ${tierB}, ${tierC}, ${tierD}, ${tierE}`,
    });
  }

  const passedCount = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results,
  };
}
