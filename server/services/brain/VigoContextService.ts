export interface VigoZoneInfo {
  name: string;
  aliases: string[];
  description: string;
  vibe: string;
  highlights: string[];
  recommendedActivities: string[];
}

export const VIGO_ZONES: Record<string, VigoZoneInfo> = {
  'Casco Vello': {
    name: 'Casco Vello',
    aliases: ['casco viejo', 'zona vieja', 'berbes', 'berbés', 'praza da constitucion', 'colexiata', 'porta do sol'],
    description: 'El corazón histórico y marinero de Vigo. Totalmente peatonalizado y rehabilitado, repleto de tascas tradicionales, vinotecas, restaurantes gourmet y plazas con encanto.',
    vibe: 'Gastronomía tradicional y moderna, tapeo, ambiente marinero histórico.',
    highlights: ['Praza da Constitución', 'Praza da Pedra (ostras)', 'Colexiata de Santa María', 'Praza do Berbés', 'Rúa Real'],
    recommendedActivities: ['Degustar ostras en A Pedra', 'Tapear por Rúa Cánovas del Castillo y Rúa Real', 'Visitar la Praza da Constitución para tomar un vermú o café al aire libre']
  },
  'Príncipe / Centro': {
    name: 'Príncipe / Centro',
    aliases: ['principe', 'príncipe', 'policarpo sanz', 'garcia barbón', 'marqués de valladares', 'urgáiz', 'urzaiz', 'calle del principe'],
    description: 'La arteria comercial y financiera principal de Vigo. Zona peatonal de compras, edificios de arquitectura modernista y ecléctica gallega (siglos XIX y XX).',
    vibe: 'Comercio, moda, ritmo urbano, arquitectura señorial y vida cultural.',
    highlights: ['Rúa do Príncipe', 'Porta do Sol (El Sireno)', 'MARCO (Museo de Arte Contemporánea)', 'Teatro Afundación', 'Rúa Urzáiz'],
    recommendedActivities: ['Compras en comercios locales y grandes firmas en Príncipe', 'Visita al museo MARCO', 'Paseo arquitectónico contemplando los edificios de Manuel Gómez Román y Jenaro de la Fuente']
  },
  'Bouzas': {
    name: 'Bouzas',
    aliases: ['villa de bouzas', 'alameda de bouzas', 'paulino freire', 'paseo maritimo de bouzas'],
    description: 'Antigua villa marinera independiente de Vigo, con una identidad marinera única, calles empedradas, soportales, casas de pescadores y paseo marítimo frente a la ría.',
    vibe: 'Tradición marinera, tapeo relajado, terrazas al atardecer frente al mar.',
    highlights: ['Alameda de Bouzas', 'Paseo Marítimo de Bouzas', 'Igrexa de San Miguel de Bouzas', 'Muelle de pescadores'],
    recommendedActivities: ['Tomar un ribeiro o albariño con empanada de berberechos en las terrazas', 'Pasear por el paseo marítimo viendo las bateas y las Islas Cíes al fondo', 'Disfrutar de las Fiestas de Bouzas (julio) con sus famosos fuegos artificiales']
  },
  'O Castro': {
    name: 'O Castro',
    aliases: ['monte do castro', 'parque do castro', 'castillo del castro', 'poboado castrexo'],
    description: 'El mirador por excelencia en el centro neurálgico de Vigo. Alberga el yacimiento arqueológico castreño de los siglos III al I a.C. y la fortaleza defensiva del siglo XVII.',
    vibe: 'Naturaleza urbana, historia milenaria, vistas panorámicas de 360º de la Ría de Vigo.',
    highlights: ['Fortaleza do Castro', 'Yacimiento castreño musealizado', 'Monumento a los Galeones de Rande', 'Mirador de la Ría'],
    recommendedActivities: ['Subir a pie o en coche para ver el atardecer sobre la ría', 'Conocer las réplicas de viviendas castreñas originales']
  },
  'Samil / Navia': {
    name: 'Samil / Navia',
    aliases: ['playa de samil', 'praia de samil', 'coruxo', 'canido', 'o vao', 'navia'],
    description: 'La gran fachada costera de Vigo. Samil es la playa urbana más extensa y equipada con piscinas, paseo marítimo y pinares, enmarcada con vistas directas a las Islas Cíes.',
    vibe: 'Playa, deporte al aire libre, gastronomía marina y vida familiar.',
    highlights: ['Praia de Samil', 'Praia do Vao', 'Museo do Mar de Galicia (Alcabre)', 'Pinar de Samil'],
    recommendedActivities: ['Pasear junto a la playa con vistas a las Cíes', 'Comer marisco o arroces marineros en Alcabre y Canido', 'Visitar el Museo do Mar']
  },
  'Calvario / Travesía': {
    name: 'Calvario / Travesía',
    aliases: ['o calvario', 'calvario peatonal', 'mercado do calvario', 'travesia de vigo', 'martinez garrido'],
    description: 'Barrio popular, vibrante y con un comercio de proximidad ejemplar. Su calle peatonal (Rúa Urzáiz en el tramo de Calvario) y su Mercado de Abastos son referentes de vida vecinal.',
    vibe: 'Vida de barrio auténtica, mercado de frescos, comercio local de trato directo.',
    highlights: ['Mercado Municipal do Calvario', 'Peatonal do Calvario', 'Comercios de toda la vida'],
    recommendedActivities: ['Comprar pescado y producto de la ría en el Mercado do Calvario', 'Hacer compras en las tiendas de toda la vida']
  },
  'Teis / Guixar': {
    name: 'Teis / Guixar',
    aliases: ['teis', 'sanjurjo badía', 'monte da guía', 'ermida da guía', 'guixar'],
    description: 'Barrio del este vigués con gran tradición obrera y naval, coronado por el Monte da Guía y su ermita, mirador privilegiado hacia el Puente de Rande y la ensenada de San Simón.',
    vibe: 'Vistas panorámicas de la ría, ambiente vecinal, tranquilidad.',
    highlights: ['Monte da Guía y Ermita', 'Parque de la Riouxa', 'Rúa Sanjurjo Badía'],
    recommendedActivities: ['Subir a la Ermita da Guía para contemplar el estrecho de Rande y los astilleros']
  },
  'Castrelos / As Travesas': {
    name: 'Castrelos / As Travesas',
    aliases: ['parque de castrelos', 'pazo de quiñones de león', 'praza de américa', 'balaidos', 'balaídos'],
    description: 'Área urbana y deportiva de Vigo que acoge el pulmón verde del Parque de Castrelos, el Pazo Museo Quiñones de León con jardines históricos, el auditorio al aire libre y el estadio de Balaídos.',
    vibe: 'Deporte, cultura, jardines señoriales, familias.',
    highlights: ['Pazo de Quiñones de León', 'Jardines franceses e ingleses de Castrelos', 'Auditorio de Castrelos', 'Estadio de Balaídos'],
    recommendedActivities: ['Paseo botánico por los jardines del Pazo', 'Correr o caminar por la ribera del río Lagares']
  }
};

export const VIGO_HISTORICAL_FACTS = [
  {
    topic: 'Batalla de Rande (1702)',
    fact: 'El 23 de octubre de 1702, la flota anglo-holandesa atacó a la Flota de Indias española custodiada por navíos franceses en el estrecho de Rande. Los galeones hundidos con tesoros de oro y plata dieron origen a incontables leyendas de tesoros sumergidos recogidas por Julio Verne en "20.000 leguas de viaje submarino".'
  },
  {
    topic: 'A Reconquista de Vigo (1809)',
    fact: 'El 28 de marzo de 1809, el pueblo de Vigo, liderado por héroes populares como Cachamuíña y Carolo, fue la primera plaza de Europa en expulsar a las tropas napoleónicas invasoras. Cada año se celebra como la gran fiesta histórica de la ciudad en el Casco Vello.'
  },
  {
    topic: 'O Sireno y Porta do Sol',
    fact: 'Escultura de bronce y granito creada por el escultor Francisco Leiro en 1991. Representa una figura híbrida de hombre y pez sobre dos columnas de granito negro de 11 metros, vigilando la Ría de Vigo desde el epicentro de Porta do Sol.'
  },
  {
    topic: 'Árbol del Olivo',
    fact: 'Vigo es conocida como "La Ciudad Olívica" debido al histórico olivo plantado por los monjes templarios en el atrio de la Colegiata de Santa María. Hoy en día, un esqueje centenario de aquel árbol preside el Paseo de Alfonso XII con vistas a la ría.'
  },
  {
    topic: 'Islas Cíes (Parque Nacional)',
    fact: 'Archipiélago formado por las islas de Monteagudo, do Faro y San Martiño en la bocana de la Ría de Vigo. La playa de Rodas fue elegida por The Guardian como la mejor playa del mundo. Requiere autorización oficial de la Xunta de Galicia para su acceso en temporada.'
  }
];

export class VigoContextService {
  findZone(query: string): VigoZoneInfo | null {
    const q = query.toLowerCase();
    for (const zone of Object.values(VIGO_ZONES)) {
      if (q.includes(zone.name.toLowerCase())) return zone;
      for (const alias of zone.aliases) {
        if (q.includes(alias)) return zone;
      }
    }
    return null;
  }

  getRelevantHistory(query: string): string[] {
    const q = query.toLowerCase();
    const results: string[] = [];
    for (const h of VIGO_HISTORICAL_FACTS) {
      if (q.includes(h.topic.toLowerCase()) || 
          (h.topic.includes('Rande') && (q.includes('rande') || q.includes('galeon') || q.includes('tesoro') || q.includes('verne'))) ||
          (h.topic.includes('Reconquista') && (q.includes('reconquista') || q.includes('franceses') || q.includes('cachamuíña') || q.includes('historia'))) ||
          (h.topic.includes('Sireno') && (q.includes('sireno') || q.includes('porta do sol') || q.includes('escultura'))) ||
          (h.topic.includes('Olivo') && (q.includes('olivo') || q.includes('olivica') || q.includes('alfonso xii'))) ||
          (h.topic.includes('Cíes') && (q.includes('cies') || q.includes('cíes') || q.includes('islas') || q.includes('rodas')))) {
        results.push(`[Hecho Histórico Verificado]: ${h.topic} - ${h.fact}`);
      }
    }
    return results;
  }

  getAllZonesSummary(): string {
    return Object.values(VIGO_ZONES)
      .map(z => `- **${z.name}**: ${z.vibe} (Destacados: ${z.highlights.slice(0, 3).join(', ')})`)
      .join('\n');
  }
}

export const vigoContextService = new VigoContextService();
