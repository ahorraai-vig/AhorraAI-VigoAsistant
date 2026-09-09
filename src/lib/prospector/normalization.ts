import { Business } from "../../types/prospector";

/**
 * Normaliza nombres de empresas para indexación y comparación:
 * - minúsculas
 * - eliminación de tildes/acentos
 * - eliminación de caracteres especiales
 * - eliminación de formas societarias redundantes (S.L., C.B., S.A., S.L.U., etc.)
 * - normalización de espacios múltiples
 */
export function normalizeBusinessName(name: string): string {
  if (!name) return "";

  let cleaned = name.toLowerCase().trim();

  // Eliminar acentos
  cleaned = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Eliminar formas jurídicas comunes
  const legalSuffixes = [
    /\bs\.?l\.?u\.?\b/g,
    /\bs\.?l\.?\b/g,
    /\bc\.?b\.?\b/g,
    /\bs\.?a\.?u\.?\b/g,
    /\bs\.?a\.?\b/g,
    /\bs\.?c\.?p\.?\b/g,
    /\bsociedad limitada\b/g,
    /\bcomunidad de bienes\b/g,
  ];

  for (const regex of legalSuffixes) {
    cleaned = cleaned.replace(regex, " ");
  }

  // Sustituir caracteres no alfanuméricos por espacios
  cleaned = cleaned.replace(/[^a-z0-9]/g, " ");

  // Colapsar espacios múltiples
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

/**
 * Normaliza teléfonos al formato estándar español de 9 dígitos sin espacios ni prefijos
 * e.g., "+34 986 12 34 56" -> "986123456", "34 600-111-222" -> "600111222"
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";

  // Conservar solo dígitos
  let digits = phone.replace(/\D/g, "");

  // Si tiene prefijo internacional de España 34 (11 dígitos comenzando en 34), removerlo
  if (digits.length === 11 && digits.startsWith("34")) {
    digits = digits.substring(2);
  } else if (digits.length === 13 && digits.startsWith("0034")) {
    digits = digits.substring(4);
  }

  // Devolver únicamente si parece un número español válido (9 dígitos)
  return digits;
}

/**
 * Normaliza URLs para comparación:
 * - elimina protocolo http/https
 * - elimina www.
 * - elimina trailing slash y query params
 */
export function normalizeUrl(url: string): string {
  if (!url) return "";

  let cleaned = url.toLowerCase().trim();
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/^www\./, "");
  cleaned = cleaned.split("?")[0].split("#")[0];
  cleaned = cleaned.replace(/\/+$/, "");

  return cleaned;
}

/**
 * Normaliza nombres de municipios de Pontevedra para asegurar concordancia
 */
export function normalizeMunicipality(municipality: string): string {
  if (!municipality) return "Pontevedra";

  const clean = municipality.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const mapping: Record<string, string> = {
    "vigo": "Vigo",
    "pontevedra": "Pontevedra",
    "redondela": "Redondela",
    "mos": "Mos",
    "o porrino": "O Porriño",
    "porrino": "O Porriño",
    "nigran": "Nigrán",
    "gondomar": "Gondomar",
    "baiona": "Baiona",
    "bayona": "Baiona",
    "cangas": "Cangas",
    "cangas do morrazo": "Cangas",
    "moana": "Moaña",
    "vilagarcia de arousa": "Vilagarcía de Arousa",
    "villagarcia de arosa": "Vilagarcía de Arousa",
    "marin": "Marín",
    "sanxenxo": "Sanxenxo",
    "sangenjo": "Sanxenxo",
    "cambados": "Cambados",
    "lalin": "Lalín",
    "a estrada": "A Estrada",
    "estrada": "A Estrada",
    "tui": "Tui",
    "tuy": "Tui",
    "ponteareas": "Ponteareas",
    "puenteareas": "Ponteareas",
    "salvaterra de mino": "Salvaterra de Miño",
    "salvatierra de mino": "Salvaterra de Miño",
    "poio": "Poio",
    "bueu": "Bueu",
    "soutomaior": "Soutomaior"
  };

  return mapping[clean] || municipality.trim();
}

/**
 * Algoritmo de similitud de cadenas (Bigram / Dice's Coefficient)
 */
export function calculateNameSimilarity(a: string, b: string): number {
  const normA = normalizeBusinessName(a);
  const normB = normalizeBusinessName(b);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA.length < 2 || normB.length < 2) return 0.0;

  const getBigrams = (str: string) => {
    const s = str.replace(/\s+/g, "");
    const bigrams = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bigram = s.substr(i, 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);

  let intersectionSize = 0;
  for (const [bigram, countA] of bigramsA.entries()) {
    if (bigramsB.has(bigram)) {
      intersectionSize += Math.min(countA, bigramsB.get(bigram)!);
    }
  }

  const totalLength = (normA.replace(/\s+/g, "").length - 1) + (normB.replace(/\s+/g, "").length - 1);
  if (totalLength === 0) return 0;

  return (2.0 * intersectionSize) / totalLength;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  matchLevel: 1 | 2 | 3 | 4 | null;
  matchedId: string | null;
  possibleDuplicate: boolean;
  reason: string;
}

/**
 * Deduplicación por 4 niveles estandarizados:
 * Nivel 1: google_place_id coincidente
 * Nivel 2: phone_normalized coincidente (siempre que tenga 9 dígitos)
 * Nivel 3: nombre normalizado + municipio idénticos
 * Nivel 4: alta similitud fonética/ortográfica (>= 0.82) en el mismo municipio -> marcado como POSSIBLE_DUPLICATE
 */
export function deduplicateBusiness(
  candidate: {
    google_place_id?: string | null;
    phone_normalized?: string | null;
    name: string;
    municipality?: string | null;
  },
  existingBusinesses: Business[]
): DeduplicationResult {
  const candidateNormName = normalizeBusinessName(candidate.name);
  const candidateNormMun = normalizeMunicipality(candidate.municipality || "");
  const candidatePhone = candidate.phone_normalized || "";

  for (const b of existingBusinesses) {
    // Nivel 1: google_place_id
    if (
      candidate.google_place_id &&
      b.google_place_id &&
      candidate.google_place_id.trim() === b.google_place_id.trim()
    ) {
      return {
        isDuplicate: true,
        matchLevel: 1,
        matchedId: b.id,
        possibleDuplicate: false,
        reason: `Coincidencia exacta por Google Place ID (${candidate.google_place_id}).`
      };
    }

    // Nivel 2: phone_normalized (exact match de 9 dígitos)
    if (
      candidatePhone &&
      candidatePhone.length === 9 &&
      b.phone_normalized &&
      candidatePhone === b.phone_normalized
    ) {
      return {
        isDuplicate: true,
        matchLevel: 2,
        matchedId: b.id,
        possibleDuplicate: false,
        reason: `Coincidencia exacta de teléfono verificado (${candidatePhone}).`
      };
    }

    // Nivel 3: nombre normalizado + municipio
    const bNormName = normalizeBusinessName(b.name);
    const bNormMun = normalizeMunicipality(b.municipality || "");

    if (
      candidateNormName &&
      candidateNormName === bNormName &&
      candidateNormMun === bNormMun
    ) {
      return {
        isDuplicate: true,
        matchLevel: 3,
        matchedId: b.id,
        possibleDuplicate: false,
        reason: `Coincidencia exacta de Nombre Normalizado y Municipio (${candidateNormName} en ${candidateNormMun}).`
      };
    }

    // Nivel 4: alta similitud en el mismo municipio -> Posible duplicado (revisión humana)
    if (candidateNormMun === bNormMun) {
      const similarity = calculateNameSimilarity(candidate.name, b.name);
      if (similarity >= 0.82) {
        return {
          isDuplicate: false,
          matchLevel: 4,
          matchedId: b.id,
          possibleDuplicate: true,
          reason: `Posible duplicado detectado (Similitud ${(similarity * 100).toFixed(0)}% con "${b.name}" en ${candidateNormMun}). Requiere revisión.`
        };
      }
    }
  }

  return {
    isDuplicate: false,
    matchLevel: null,
    matchedId: null,
    possibleDuplicate: false,
    reason: "Negocio nuevo único verificado."
  };
}
