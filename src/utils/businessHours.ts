/**
 * Utilitários para cálculo de horário de funcionamento
 * Suporta múltiplos intervalos por dia, cruzamento de meia-noite, e exceções
 */

export interface BusinessInterval {
  open: string; // formato "HH:mm"
  close: string; // formato "HH:mm"
}

export interface WeeklyHours {
  estab_id: string;
  day_of_week: number; // 0=domingo, 6=sábado
  enabled: boolean;
  intervals: BusinessInterval[];
}

export interface HoursOverride {
  estab_id: string;
  date: string; // formato "YYYY-MM-DD" (data local)
  is_closed: boolean;
  intervals: BusinessInterval[] | null;
  note?: string | null;
}

export interface EstablishmentSettings {
  timezone: string;
  allow_orders_when_closed: boolean;
  show_schedule_on_menu: boolean;
}

export interface DayStatus {
  isOpen: boolean;
  nextOpenAt?: Date;
  nextCloseAt?: Date;
  reason?: 'weekly' | 'override';
}

/**
 * Converte intervalos "HH:mm" para objetos Date comparáveis
 * Suporta intervalos que cruzam meia-noite (ex: 18:00-02:00)
 * 
 * Esta função cria Date objects no timezone local que representam
 * os horários do estabelecimento, facilitando comparações.
 */
export function parseIntervals(
  intervals: BusinessInterval[],
  timezone: string,
  forDate: Date
): Array<{ start: Date; end: Date }> {
  const results: Array<{ start: Date; end: Date }> = [];
  
  if (!intervals || intervals.length === 0) {
    return results;
  }

  // Obter a data local no timezone do estabelecimento
  const localParts = forDate.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).split('/');
  const localDateStr = `${localParts[2]}-${localParts[0].padStart(2, '0')}-${localParts[1].padStart(2, '0')}`;

  // Obter offset do timezone em minutos
  const now = new Date();
  const utcTime = now.getTime();
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getTime();
  const offsetMinutes = (utcTime - localTime) / (1000 * 60);

  for (const interval of intervals) {
    const [openHour, openMin] = interval.open.split(':').map(Number);
    const [closeHour, closeMin] = interval.close.split(':').map(Number);

    // Criar Date objects no timezone local representando os horários do estabelecimento
    const startLocal = new Date(`${localDateStr}T${interval.open}:00`);
    const endLocal = new Date(`${localDateStr}T${interval.close}:00`);

    // Ajustar para UTC (para comparação correta)
    const start = new Date(startLocal.getTime() - offsetMinutes * 60 * 1000);
    let end = new Date(endLocal.getTime() - offsetMinutes * 60 * 1000);

    // Se o horário de fechamento é menor que o de abertura, cruza meia-noite
    if (closeHour * 60 + closeMin < openHour * 60 + openMin) {
      // Adicionar 1 dia ao end
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    results.push({ start, end });
  }

  return results;
}

/**
 * Verifica se uma data está fechada por override
 */
export function isClosedByOverride(
  dateLocal: string, // formato "YYYY-MM-DD"
  overrides: HoursOverride[]
): boolean {
  const override = overrides.find(o => o.date === dateLocal);
  return override?.is_closed === true;
}

/**
 * Obtém o status atual do estabelecimento (aberto/fechado)
 * Retorna também próxima abertura e fechamento
 */
export function getTodayStatus(
  now: Date,
  timezone: string,
  weekly: WeeklyHours[],
  overrides: HoursOverride[],
  locale: string = 'pt-BR'
): DayStatus {
  // Converter now para data local do estabelecimento
  const localDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
  const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'long' });
  const dayOfWeekNum = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(dayOfWeek.toLowerCase());

  // Verificar se há override para hoje
  const todayOverride = overrides.find(o => o.date === localDateStr);

  // Se há override e está fechado, retornar fechado
  if (todayOverride?.is_closed) {
    const nextOpen = getNextOpen(now, timezone, weekly, overrides);
    return {
      isOpen: false,
      nextOpenAt: nextOpen || undefined,
      reason: 'override'
    };
  }

  // Se há override com intervalos customizados, usar esses intervalos
  let intervalsToCheck: BusinessInterval[] | null = null;
  if (todayOverride?.intervals && todayOverride.intervals.length > 0) {
    intervalsToCheck = todayOverride.intervals;
  } else {
    // Usar horários semanais
    const weeklyHours = weekly.find(w => w.day_of_week === dayOfWeekNum && w.enabled);
    if (!weeklyHours) {
      // Dia não configurado = fechado
      const nextOpen = getNextOpen(now, timezone, weekly, overrides);
      return {
        isOpen: false,
        nextOpenAt: nextOpen || undefined,
        reason: 'weekly'
      };
    }
    intervalsToCheck = weeklyHours.intervals;
  }

  if (!intervalsToCheck || intervalsToCheck.length === 0) {
    const nextOpen = getNextOpen(now, timezone, weekly, overrides);
    return {
      isOpen: false,
      nextOpenAt: nextOpen || undefined,
      reason: intervalsToCheck === null ? 'override' : 'weekly'
    };
  }

  // Verificar se estamos dentro de algum intervalo
  const parsedIntervals = parseIntervals(intervalsToCheck, timezone, now);
  
  for (const interval of parsedIntervals) {
    if (now >= interval.start && now < interval.end) {
      // Estamos abertos!
      // Encontrar quando será o próximo fechamento
      let nextClose = interval.end;
      
      // Verificar se há mais intervalos hoje após este
      const laterIntervals = parsedIntervals.filter(i => i.start > now && i.start < nextClose);
      if (laterIntervals.length > 0) {
        // O próximo fechamento será do último intervalo antes do próximo intervalo
        nextClose = interval.end;
      }

      return {
        isOpen: true,
        nextCloseAt: nextClose,
        reason: todayOverride ? 'override' : 'weekly'
      };
    }
  }

  // Não estamos em nenhum intervalo = fechado
  const nextOpen = getNextOpen(now, timezone, weekly, overrides);
  return {
    isOpen: false,
    nextOpenAt: nextOpen || undefined,
    reason: todayOverride ? 'override' : 'weekly'
  };
}

/**
 * Calcula a próxima abertura do estabelecimento
 * Varre os próximos 7 dias (ou até encontrar)
 */
export function getNextOpen(
  now: Date,
  timezone: string,
  weekly: WeeklyHours[],
  overrides: HoursOverride[]
): Date | null {
  // Buscar nos próximos 14 dias
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + daysAhead);
    checkDate.setHours(0, 0, 0, 0);

    const localDateStr = checkDate.toLocaleDateString('en-CA', { timeZone: timezone });
    const dayOfWeek = checkDate.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'long' });
    const dayOfWeekNum = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .indexOf(dayOfWeek.toLowerCase());

    // Verificar override
    const dayOverride = overrides.find(o => o.date === localDateStr);

    // Se está fechado por override, pular
    if (dayOverride?.is_closed) {
      continue;
    }

    // Obter intervalos do dia
    let intervals: BusinessInterval[] | null = null;
    if (dayOverride?.intervals && dayOverride.intervals.length > 0) {
      intervals = dayOverride.intervals;
    } else {
      const weeklyHours = weekly.find(w => w.day_of_week === dayOfWeekNum && w.enabled);
      if (weeklyHours && weeklyHours.intervals.length > 0) {
        intervals = weeklyHours.intervals;
      }
    }

    if (!intervals || intervals.length === 0) {
      continue;
    }

    // Encontrar o primeiro intervalo do dia
    const parsedIntervals = parseIntervals(intervals, timezone, checkDate);
    const sortedIntervals = parsedIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    if (sortedIntervals.length > 0) {
      const firstInterval = sortedIntervals[0];
      
      // Se estamos no mesmo dia e o intervalo já passou, usar o próximo intervalo do dia
      if (daysAhead === 0 && firstInterval.start < now) {
        const nextTodayInterval = sortedIntervals.find(i => i.start > now);
        if (nextTodayInterval) {
          return nextTodayInterval.start;
        }
        // Nenhum intervalo restante hoje, continuar para o próximo dia
        continue;
      }

      return firstInterval.start;
    }
  }

  return null;
}

/**
 * Formata data/hora no timezone especificado
 */
export function formatDateTime(
  date: Date,
  timezone: string,
  locale: string = 'pt-BR'
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

/**
 * Formata apenas hora no timezone especificado
 */
export function formatTime(
  date: Date,
  timezone: string,
  locale: string = 'pt-BR'
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * Formata apenas data no timezone especificado
 */
export function formatDate(
  date: Date,
  timezone: string,
  locale: string = 'pt-BR'
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'short'
  }).format(date);
}

/**
 * Obtém o nome do dia da semana em português
 */
export function getDayName(dayOfWeek: number, locale: string = 'pt-BR'): string {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[dayOfWeek] || '';
}

