export interface TemporalResolution {
  rawExpression: string;
  hasTemporalIntent: boolean;
  temporalScope: 'today' | 'tonight' | 'tomorrow' | 'day_after_tomorrow' | 'this_weekend' | 'specific_date' | 'date_range' | 'historical' | 'general';
  isFuture: boolean;
  isPast: boolean;
  isImmediate: boolean; // hoy / ahora
  isHistorical: boolean; // Consultas de histórico o comportamiento habitual
  targetDates: string[]; // Fechas ISO YYYY-MM-DD
  targetDateDescription: string; // "Domingo 30 de agosto de 2026", etc.
  dayOfWeek: string;
  dayOfWeekIndex: number; // 0=Domingo, 1=Lunes, ...
  targetMonth?: number; // 1-12
  targetDay?: number;
  isWeekend: boolean;
  nowInMadrid: string; // ISO String en Europe/Madrid
}

export class VigoTimeResolver {
  private timezone: string = 'Europe/Madrid';

  /**
   * Obtiene la fecha/hora actual en la zona horaria de Vigo (Europe/Madrid).
   */
  getMadridNow(): Date {
    const nowUtc = new Date();
    const madridString = nowUtc.toLocaleString('en-US', { timeZone: this.timezone });
    return new Date(madridString);
  }

  /**
   * Formatea una fecha a YYYY-MM-DD
   */
  formatDateYMD(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Resuelve y extrae el contexto temporal exacto de la consulta del usuario.
   */
  resolveTemporal(query: string): TemporalResolution {
    const q = query.toLowerCase().trim();
    const now = this.getMadridNow();
    const nowYmd = this.formatDateYMD(now);
    const dayOfWeekIdx = now.getDay();
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    // 0. Detección de consultas históricas o retrospectivas (ej: "el año pasado", "en septiembre", "el 15 de septiembre", "cómo suele estar", "cómo estaba")
    const isHistoricalMention = q.includes('el año pasado') || 
                                q.includes('histórico') || 
                                q.includes('historico') || 
                                q.includes('cómo suele') || 
                                q.includes('como suele') || 
                                q.includes('cómo estaba') || 
                                q.includes('como estaba') || 
                                q.includes('habitual') ||
                                q.includes('comportamiento de');

    // 1. Rango de fechas (ej: "del 15 al 21 de septiembre", "15-21 septiembre")
    const rangeMatch = q.match(/del?\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)/i) ||
                       q.match(/(\d{1,2})\s*(?:-|al?)\s*(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
    if (rangeMatch) {
      const startDay = parseInt(rangeMatch[1], 10);
      const endDay = parseInt(rangeMatch[2], 10);
      const monthStr = rangeMatch[3].toLowerCase();
      const monthIdx = monthNames.findIndex(m => m.startsWith(monthStr.substring(0, 3)));

      if (monthIdx >= 0) {
        const year = now.getFullYear();
        const dates: string[] = [];
        for (let day = startDay; day <= endDay; day++) {
          const d = new Date(year, monthIdx, day);
          dates.push(this.formatDateYMD(d));
        }

        return {
          rawExpression: rangeMatch[0],
          hasTemporalIntent: true,
          temporalScope: isHistoricalMention ? 'historical' : 'date_range',
          isFuture: dates[0] > nowYmd && !isHistoricalMention,
          isPast: dates[0] < nowYmd || isHistoricalMention,
          isImmediate: false,
          isHistorical: isHistoricalMention,
          targetDates: dates,
          targetDateDescription: `Del ${startDay} al ${endDay} de ${monthNames[monthIdx]} de ${year}`,
          dayOfWeek: 'Varios días',
          dayOfWeekIndex: -1,
          targetMonth: monthIdx + 1,
          isWeekend: false,
          nowInMadrid: now.toISOString()
        };
      }
    }

    // 1.5. Fecha concreta con mes explícito (ej: "15 de septiembre", "en septiembre", "el 15 de septiembre")
    const singleDateMatch = q.match(/(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
    if (singleDateMatch) {
      const dayNum = parseInt(singleDateMatch[1], 10);
      const monthStr = singleDateMatch[2].toLowerCase();
      const monthIdx = monthNames.findIndex(m => m.startsWith(monthStr.substring(0, 3)));

      if (monthIdx >= 0) {
        const year = now.getFullYear();
        const targetD = new Date(year, monthIdx, dayNum);
        const ymd = this.formatDateYMD(targetD);
        const isPast = ymd < nowYmd || isHistoricalMention;

        return {
          rawExpression: singleDateMatch[0],
          hasTemporalIntent: true,
          temporalScope: isHistoricalMention ? 'historical' : 'specific_date',
          isFuture: ymd > nowYmd && !isHistoricalMention,
          isPast,
          isImmediate: ymd === nowYmd,
          isHistorical: isHistoricalMention,
          targetDates: [ymd],
          targetDateDescription: `${singleDateMatch[0]} (mes de ${monthNames[monthIdx]})`,
          dayOfWeek: dayNames[targetD.getDay()],
          dayOfWeekIndex: targetD.getDay(),
          targetMonth: monthIdx + 1,
          targetDay: dayNum,
          isWeekend: targetD.getDay() === 0 || targetD.getDay() === 6,
          nowInMadrid: now.toISOString()
        };
      }
    }

    // Mención a solo un mes (ej: "en septiembre")
    const monthOnlyMatch = q.match(/\ben\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i);
    if (monthOnlyMatch) {
      const monthIdx = monthNames.indexOf(monthOnlyMatch[1].toLowerCase());
      if (monthIdx >= 0) {
        return {
          rawExpression: monthOnlyMatch[0],
          hasTemporalIntent: true,
          temporalScope: 'historical',
          isFuture: false,
          isPast: true,
          isImmediate: false,
          isHistorical: true,
          targetDates: [],
          targetDateDescription: `Mes de ${monthNames[monthIdx]} (análisis estacional e histórico)`,
          dayOfWeek: 'Mes completo',
          dayOfWeekIndex: -1,
          targetMonth: monthIdx + 1,
          isWeekend: false,
          nowInMadrid: now.toISOString()
        };
      }
    }

    // 2. "mañana"
    if (q.match(/\bmañana\b/i) && !q.match(/\bde la mañana\b/i) && !q.match(/\bpor la mañana\b/i)) {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const ymd = this.formatDateYMD(tomorrow);
      const dowIdx = tomorrow.getDay();

      return {
        rawExpression: 'mañana',
        hasTemporalIntent: true,
        temporalScope: 'tomorrow',
        isFuture: true,
        isPast: false,
        isImmediate: false,
        isHistorical: false,
        targetDates: [ymd],
        targetDateDescription: `${dayNames[dowIdx]}, ${tomorrow.getDate()} de ${monthNames[tomorrow.getMonth()]} de ${tomorrow.getFullYear()}`,
        dayOfWeek: dayNames[dowIdx],
        dayOfWeekIndex: dowIdx,
        targetMonth: tomorrow.getMonth() + 1,
        targetDay: tomorrow.getDate(),
        isWeekend: dowIdx === 0 || dowIdx === 6,
        nowInMadrid: now.toISOString()
      };
    }

    // 3. "pasado mañana"
    if (q.match(/\bpasado\s+mañana\b/i)) {
      const dayAfter = new Date(now);
      dayAfter.setDate(now.getDate() + 2);
      const ymd = this.formatDateYMD(dayAfter);
      const dowIdx = dayAfter.getDay();

      return {
        rawExpression: 'pasado mañana',
        hasTemporalIntent: true,
        temporalScope: 'day_after_tomorrow',
        isFuture: true,
        isPast: false,
        isImmediate: false,
        isHistorical: false,
        targetDates: [ymd],
        targetDateDescription: `${dayNames[dowIdx]}, ${dayAfter.getDate()} de ${monthNames[dayAfter.getMonth()]} de ${dayAfter.getFullYear()}`,
        dayOfWeek: dayNames[dowIdx],
        dayOfWeekIndex: dowIdx,
        targetMonth: dayAfter.getMonth() + 1,
        targetDay: dayAfter.getDate(),
        isWeekend: dowIdx === 0 || dowIdx === 6,
        nowInMadrid: now.toISOString()
      };
    }

    // 4. "este fin de semana" / "el finde"
    if (q.match(/\b(este\s+fin\s+de\s+semana|este\s+finde|el\s+fin\s+de\s+semana)\b/i)) {
      const sat = new Date(now);
      const daysUntilSat = (6 - dayOfWeekIdx + 7) % 7;
      sat.setDate(now.getDate() + daysUntilSat);
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);

      const dates = [this.formatDateYMD(sat), this.formatDateYMD(sun)];
      return {
        rawExpression: 'este fin de semana',
        hasTemporalIntent: true,
        temporalScope: 'this_weekend',
        isFuture: dates[0] > nowYmd || dates[1] > nowYmd,
        isPast: false,
        isImmediate: dayOfWeekIdx === 0 || dayOfWeekIdx === 6,
        isHistorical: false,
        targetDates: dates,
        targetDateDescription: `Sábado ${sat.getDate()} y Domingo ${sun.getDate()} de ${monthNames[sat.getMonth()]} de ${sat.getFullYear()}`,
        dayOfWeek: 'Fin de semana (Sábado/Domingo)',
        dayOfWeekIndex: 6,
        targetMonth: sat.getMonth() + 1,
        isWeekend: true,
        nowInMadrid: now.toISOString()
      };
    }

    // 5. "esta tarde" / "esta noche" / "hoy" / "ahora"
    if (q.match(/\b(esta tarde|hoy por la tarde)\b/i)) {
      return {
        rawExpression: 'esta tarde',
        hasTemporalIntent: true,
        temporalScope: 'today',
        isFuture: false,
        isPast: false,
        isImmediate: true,
        isHistorical: false,
        targetDates: [nowYmd],
        targetDateDescription: `Hoy por la tarde (${dayNames[dayOfWeekIdx]}, ${now.getDate()} de ${monthNames[now.getMonth()]})`,
        dayOfWeek: dayNames[dayOfWeekIdx],
        dayOfWeekIndex: dayOfWeekIdx,
        targetMonth: now.getMonth() + 1,
        targetDay: now.getDate(),
        isWeekend: dayOfWeekIdx === 0 || dayOfWeekIdx === 6,
        nowInMadrid: now.toISOString()
      };
    }

    if (q.match(/\b(esta noche|hoy por la noche)\b/i)) {
      return {
        rawExpression: 'esta noche',
        hasTemporalIntent: true,
        temporalScope: 'tonight',
        isFuture: false,
        isPast: false,
        isImmediate: true,
        isHistorical: false,
        targetDates: [nowYmd],
        targetDateDescription: `Hoy por la noche (${dayNames[dayOfWeekIdx]}, ${now.getDate()} de ${monthNames[now.getMonth()]})`,
        dayOfWeek: dayNames[dayOfWeekIdx],
        dayOfWeekIndex: dayOfWeekIdx,
        targetMonth: now.getMonth() + 1,
        targetDay: now.getDate(),
        isWeekend: dayOfWeekIdx === 0 || dayOfWeekIdx === 6,
        nowInMadrid: now.toISOString()
      };
    }

    if (q.match(/\b(hoy|ahora|en este momento)\b/i)) {
      return {
        rawExpression: 'hoy',
        hasTemporalIntent: true,
        temporalScope: 'today',
        isFuture: false,
        isPast: false,
        isImmediate: true,
        isHistorical: false,
        targetDates: [nowYmd],
        targetDateDescription: `Hoy (${dayNames[dayOfWeekIdx]}, ${now.getDate()} de ${monthNames[now.getMonth()]} de ${now.getFullYear()})`,
        dayOfWeek: dayNames[dayOfWeekIdx],
        dayOfWeekIndex: dayOfWeekIdx,
        targetMonth: now.getMonth() + 1,
        targetDay: now.getDate(),
        isWeekend: dayOfWeekIdx === 0 || dayOfWeekIdx === 6,
        nowInMadrid: now.toISOString()
      };
    }

    // 6. Días de la semana específicos: "el lunes", "el próximo sábado", etc.
    for (let i = 0; i < dayNames.length; i++) {
      const dName = dayNames[i];
      const regex = new RegExp(`\\b(el\\s+|el\\s+próximo\\s+|este\\s+)?${dName}\\b`, 'i');
      if (regex.test(q)) {
        let diff = (i - dayOfWeekIdx + 7) % 7;
        if (diff === 0 && !q.includes('hoy')) diff = 7;
        const targetD = new Date(now);
        targetD.setDate(now.getDate() + diff);
        const ymd = this.formatDateYMD(targetD);

        return {
          rawExpression: dName,
          hasTemporalIntent: true,
          temporalScope: 'specific_date',
          isFuture: diff > 0,
          isPast: false,
          isImmediate: diff === 0,
          isHistorical: false,
          targetDates: [ymd],
          targetDateDescription: `${dayNames[i]}, ${targetD.getDate()} de ${monthNames[targetD.getMonth()]} de ${targetD.getFullYear()}`,
          dayOfWeek: dayNames[i],
          dayOfWeekIndex: i,
          targetMonth: targetD.getMonth() + 1,
          targetDay: targetD.getDate(),
          isWeekend: i === 0 || i === 6,
          nowInMadrid: now.toISOString()
        };
      }
    }

    // Default: Consulta atemporal o general
    return {
      rawExpression: isHistoricalMention ? 'histórico' : 'general',
      hasTemporalIntent: isHistoricalMention,
      temporalScope: isHistoricalMention ? 'historical' : 'general',
      isFuture: false,
      isPast: isHistoricalMention,
      isImmediate: !isHistoricalMention,
      isHistorical: isHistoricalMention,
      targetDates: [nowYmd],
      targetDateDescription: isHistoricalMention 
        ? 'Consulta de histórico y registros previos' 
        : `Actual (${dayNames[dayOfWeekIdx]}, ${now.getDate()} de ${monthNames[now.getMonth()]} de ${now.getFullYear()})`,
      dayOfWeek: dayNames[dayOfWeekIdx],
      dayOfWeekIndex: dayOfWeekIdx,
      targetMonth: now.getMonth() + 1,
      targetDay: now.getDate(),
      isWeekend: dayOfWeekIdx === 0 || dayOfWeekIdx === 6,
      nowInMadrid: now.toISOString()
    };
  }
}

export const vigoTimeResolver = new VigoTimeResolver();
