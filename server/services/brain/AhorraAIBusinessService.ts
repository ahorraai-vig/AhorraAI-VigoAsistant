import type { RetrievedFact, BusinessVerificationTier, DataConfidence } from './types.js';

export interface BusinessSearchFilter {
  query?: string;
  zone?: string;
  category?: string;
  honestyStatus?: 'DICHO' | 'OBSERVADO' | 'SIN_CONFIRMAR';
  onlyWithSynergies?: boolean;
  maxResults?: number;
}

export class AhorraAIBusinessService {
  private getUnifiedBusinessesFn: (() => Promise<any[]>) | null = null;
  private getSynergiesFn: (() => any[]) | null = null;

  setProviders(getUnifiedBusinesses: () => Promise<any[]>, getSynergies: () => any[]) {
    this.getUnifiedBusinessesFn = getUnifiedBusinesses;
    this.getSynergiesFn = getSynergies;
  }

  async searchBusinesses(filter: BusinessSearchFilter): Promise<{ businesses: any[]; synergies: any[]; facts: RetrievedFact[] }> {
    if (!this.getUnifiedBusinessesFn) {
      return { businesses: [], synergies: [], facts: [] };
    }

    const all = await this.getUnifiedBusinessesFn();
    const query = (filter.query || '').toLowerCase().trim();
    const zoneFilter = filter.zone?.toLowerCase().trim();
    const catFilter = filter.category?.toLowerCase().trim();
    const maxResults = filter.maxResults || 6;

    // Puntuación heurística de relevancia local en Vigo
    const scored = all.map(b => {
      let score = 0;
      const name = (b.name || '').toLowerCase();
      const desc = (b.description || '').toLowerCase();
      const addr = (b.address || '').toLowerCase();
      const cat = (b.category || '').toLowerCase();
      const zone = (b.zone || '').toLowerCase();

      // Coincidencia de zona exacta
      if (zoneFilter && (zone.includes(zoneFilter) || addr.includes(zoneFilter))) {
        score += 50;
      }

      // Coincidencia de categoría
      if (catFilter && cat.includes(catFilter)) {
        score += 40;
      }

      // Coincidencia en nombre o descripción con la query
      if (query) {
        if (name === query) score += 120;
        else if (name.includes(query) || query.includes(name)) score += 90;
        
        const tokens = query.split(/\s+/).filter(t => t.length > 2);
        for (const t of tokens) {
          if (name.includes(t)) score += 30;
          if (desc.includes(t)) score += 20;
          if (cat.includes(t)) score += 25;
          if (zone.includes(t)) score += 15;
          if (addr.includes(t)) score += 15;
        }

        // Detección semántica de intención en Vigo
        const foodTerms = ['comer', 'cenar', 'tapas', 'marisco', 'pulpo', 'restaurante', 'bar', 'café', 'vinos', 'almuerzo', 'desayuno', 'merienda'];
        if (foodTerms.some(t => query.includes(t)) && (cat.includes('hostelería') || cat.includes('restaur') || desc.includes('restaurante') || desc.includes('tapas') || desc.includes('comida') || desc.includes('marisco'))) {
          score += 45;
        }

        const shopTerms = ['comprar', 'tienda', 'ropa', 'calzado', 'zapatería', 'farmacia', 'regalo', 'moda', 'joyería', 'librería'];
        if (shopTerms.some(t => query.includes(t)) && (cat.includes('moda') || cat.includes('comercio') || cat.includes('salud') || cat.includes('joyería') || cat.includes('librería'))) {
          score += 45;
        }
      }

      // Priorización de comercios con datos validados (Honestidad Estructural: 'DICHO')
      if (b.honesty_status === 'DICHO') {
        score += 15;
      }

      if (b.is_active) score += 5;

      return { business: b, score };
    });

    const filtered = scored
      .filter(item => (query ? item.score >= 25 : true))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.business);

    // Obtener sinergias vinculadas a los comercios seleccionados
    const allSynergies = this.getSynergiesFn ? this.getSynergiesFn() : [];
    const matchedIds = new Set(filtered.map(b => b.id));
    const matchedSynergies = allSynergies.filter(s => matchedIds.has(s.businessA_id) || matchedIds.has(s.businessB_id));

    // Convertir a RetrievedFacts estandarizados con asignación rigurosa de Tier
    const facts: RetrievedFact[] = filtered.map(b => {
      let verificationTier: BusinessVerificationTier = 'DATABASE_BUSINESS';
      let confidence: DataConfidence = 'OBSERVADO';

      if (b.honesty_status === 'DICHO') {
        verificationTier = 'CLAIMED_BUSINESS';
        confidence = 'VERIFIED';
      } else if (b.cooperation?.isPartner) {
        verificationTier = 'VERIFIED_PARTNER';
        confidence = 'VERIFIED';
      } else {
        verificationTier = 'DATABASE_BUSINESS';
        confidence = 'OBSERVADO';
      }

      return {
        id: b.id,
        source: 'supabase_business_db',
        confidence,
        verificationTier,
        title: b.name,
        content: `${b.description || ''} | Sector: ${b.category} | Zona: ${b.zone || 'Vigo'} | Dirección: ${b.address || 'N/A'} | Tel: ${b.phone || 'N/A'} | Horario Valle: ${b.cooperation?.valleyHours || 'N/A'} | Propuesta Especial: ${b.cooperation?.specialProposal || 'N/A'}`,
        address: b.address,
        phone: b.phone,
        url: b.website,
        metadata: {
          category: b.category,
          zone: b.zone,
          time_slots: b.time_slots,
          cooperation: b.cooperation,
          image_url: b.cooperation?.image_url,
          verificationTier
        }
      };
    });

    return {
      businesses: filtered,
      synergies: matchedSynergies,
      facts
    };
  }
}

export const ahorraAIBusinessService = new AhorraAIBusinessService();
