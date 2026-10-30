import type { CheckinRecord } from '../store/useCheckinStore';

export type RankTier = 'bronce' | 'plata' | 'oro' | 'diamante';

export interface RankConfig {
  tier: RankTier;
  title: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  gradient: string;
  glowColor: string;
  description: string;
  weekTarget: string;
}

// Escala mensual calibrada: Se requieren 20 días hábiles (~1 mes) para alcanzar Diamante (2,000 pts máx)
export const RANK_TIERS: Record<RankTier, RankConfig> = {
  bronce: {
    tier: 'bronce',
    title: 'Bronce',
    minPoints: 0,
    maxPoints: 499,
    color: '#CD7F32',
    badgeBg: 'bg-amber-900/15',
    badgeBorder: 'border-amber-700/30',
    textColor: 'text-amber-700',
    gradient: 'from-[#CD7F32] via-[#B87333] to-[#8C4B18]',
    glowColor: 'rgba(205, 127, 50, 0.35)',
    description: 'Semana 1: Arranque de temporada mensual y aclimatación de registros.',
    weekTarget: 'Semana 1 (Días 1 a 5)',
  },
  plata: {
    tier: 'plata',
    title: 'Plata',
    minPoints: 500,
    maxPoints: 999,
    color: '#94A3B8',
    badgeBg: 'bg-slate-200/50',
    badgeBorder: 'border-slate-300',
    textColor: 'text-slate-600',
    gradient: 'from-slate-200 via-slate-400 to-slate-600',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    description: 'Semana 2: Constancia demostrada con jornadas de 8h cumplidas.',
    weekTarget: 'Semana 2 (Días 6 a 10)',
  },
  oro: {
    tier: 'oro',
    title: 'Oro',
    minPoints: 1000,
    maxPoints: 1599,
    color: '#F59E0B',
    badgeBg: 'bg-amber-100',
    badgeBorder: 'border-amber-300',
    textColor: 'text-amber-800',
    gradient: 'from-amber-300 via-amber-500 to-yellow-600',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    description: 'Semana 3: Alta fidelidad de tiempo en vivo sin ediciones manuales excesivas.',
    weekTarget: 'Semana 3 (Días 11 a 15)',
  },
  diamante: {
    tier: 'diamante',
    title: 'Diamante',
    minPoints: 1600,
    maxPoints: 2000,
    color: '#06B6D4',
    badgeBg: 'bg-cyan-100',
    badgeBorder: 'border-cyan-300',
    textColor: 'text-cyan-800',
    gradient: 'from-cyan-300 via-teal-400 to-blue-600',
    glowColor: 'rgba(6, 182, 212, 0.5)',
    description: 'Semana 4 / Fin de mes: Máximo nivel de excelencia Russell Bedford.',
    weekTarget: 'Semana 4 (Días 16 a 20)',
  },
};

// Criterios oficiales para ganar puntos
export interface GamificationRule {
  id: string;
  title: string;
  subtitle: string;
  points: number;
  isDaily: boolean;
  type: 'positive' | 'restriction';
  tag: string;
  tagColor: string;
  description: string;
}

export const MONTHLY_GAMIFICATION_RULES: GamificationRule[] = [
  {
    id: 'punctuality',
    title: 'Puntualidad en Inicio de Jornada',
    subtitle: 'Tolerancia de 10 minutos',
    points: 30,
    isDaily: true,
    type: 'positive',
    tag: '+30 pts / día',
    tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Inicia tu jornada a tiempo en tu hora de entrada (09:00). Cuentas con 10 minutos de tolerancia (hasta las 09:10) para acreditar 30 puntos diarios.',
  },
  {
    id: 'full_shift',
    title: 'Jornada Completa Terminada',
    subtitle: 'Mínimo 8 horas de trabajo',
    points: 30,
    isDaily: true,
    type: 'positive',
    tag: '+30 pts / día',
    tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Concluye tu jornada cumpliendo tus 8 horas completas de trabajo (480 minutos). Salir antes o dejar la jornada abierta no otorga estos puntos.',
  },
  {
    id: 'live_tracking',
    title: 'Tiempo de Trabajo en Vivo',
    subtitle: 'Cronómetro en tiempo real y conmutación de tareas',
    points: 40,
    isDaily: true,
    type: 'positive',
    tag: '+40 pts / día',
    tagColor: 'bg-[#1E40AF]/20 text-[#38BDF8] border-[#1E40AF]/40',
    description: 'Registra tus actividades en tiempo real: al iniciar pones a correr la tarea 1, al avanzar cambias a la tarea 4 y finalizas en la 5.',
  },
  {
    id: 'manual_edits_penalty',
    title: 'Restricción por Edición Manual Excesiva',
    subtitle: 'No suman puntos en vivo si se edita en exceso',
    points: 0,
    isDaily: false,
    type: 'restriction',
    tag: 'Anula bono +40 pts',
    tagColor: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Si editas manualmente tus horas más de 2 veces en el día, se anula el bono de tiempo en vivo (+40 pts). Las horas deben ganarse con cronómetro real.',
  },
];

export interface DayGamificationAudit {
  date: string;
  dateFormatted: string;
  isPunctual: boolean;
  minutesLate: number;
  punctualityPoints: number;
  isFullShift: boolean;
  workedMinutes: number;
  fullShiftPoints: number;
  isLiveTracking: boolean;
  manualEditsCount: number;
  isPenalizedForManualEdits: boolean;
  liveTrackingPoints: number;
  totalDayPoints: number;
}

export interface UserGamificationStats {
  points: number;
  maxMonthlyPoints: number;
  rank: RankConfig;
  nextRank: RankConfig | null;
  pointsForNext: number;
  progressPercent: number;
  seasonKey: string;
  seasonName: string;
  daysRemainingInMonth: number;
  daysWorkedInMonth: number;
  todayAudit: DayGamificationAudit;
  monthlyAuditHistory: DayGamificationAudit[];
}

/**
 * Calcula los puntos del colaborador correspondientes a la temporada mensual en curso
 */
export function calculateGamification(params: {
  history: CheckinRecord[];
  activeCheckin: CheckinRecord | null;
  manualEditsByDate: Record<string, number>;
  taskSwitchesByDate: Record<string, number>;
  expectedEntryTime?: string; // ej "09:00"
}): UserGamificationStats {
  const {
    history = [],
    activeCheckin = null,
    manualEditsByDate = {},
    taskSwitchesByDate = {},
  } = params;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 a 11
  const currentSeasonKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  
  // Nombre del mes actual
  const monthDate = new Date(currentYear, currentMonth, 1);
  const rawMonthName = monthDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const seasonName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

  // Días restantes en el mes para el reinicio
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysRemainingInMonth = Math.max(0, lastDayOfMonth - now.getDate());

  const todayStr = now.toISOString().split('T')[0];

  // Agrupar registros que pertenezcan al mes actual
  const currentMonthRecords = history.filter(r => r.date.startsWith(currentSeasonKey));

  // Mapa de auditoría por día
  const dailyAudits: Record<string, DayGamificationAudit> = {};

  // Procesar registros históricos del mes
  currentMonthRecords.forEach(rec => {
    const isPunctual = !rec.isLate || (rec.minutesLate !== undefined && rec.minutesLate <= 10);
    const punctualityPoints = isPunctual ? 30 : 0;

    const durationMins = rec.totalDurationMinutes || 0;
    const isFullShift = durationMins >= 480; // 8 horas
    const fullShiftPoints = isFullShift ? 30 : 0;

    const manualEdits = manualEditsByDate[rec.date] || 0;
    const isPenalizedForManualEdits = manualEdits > 2;

    // Se considera trabajo en vivo si tiene duración y no fue penalizado por ediciones excesivas
    const isLiveTracking = durationMins > 0 && !isPenalizedForManualEdits;
    const liveTrackingPoints = isLiveTracking ? 40 : 0;

    const totalDayPoints = punctualityPoints + fullShiftPoints + liveTrackingPoints;

    const dParts = rec.date.split('-');
    const dateObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
    const dateFormatted = dateObj.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

    dailyAudits[rec.date] = {
      date: rec.date,
      dateFormatted,
      isPunctual,
      minutesLate: rec.minutesLate || 0,
      punctualityPoints,
      isFullShift,
      workedMinutes: durationMins,
      fullShiftPoints,
      isLiveTracking,
      manualEditsCount: manualEdits,
      isPenalizedForManualEdits,
      liveTrackingPoints,
      totalDayPoints,
    };
  });

  // Procesar el día de hoy (con activeCheckin si existe)
  const todayManualEdits = manualEditsByDate[todayStr] || 0;
  const todaySwitches = taskSwitchesByDate[todayStr] || 0;
  const isTodayPenalized = todayManualEdits > 2;

  let todayPunctual = false;
  let todayMinutesLate = 0;
  let todayDurationMins = 0;

  if (activeCheckin) {
    todayPunctual = !activeCheckin.isLate || (activeCheckin.minutesLate !== undefined && activeCheckin.minutesLate <= 10);
    todayMinutesLate = activeCheckin.minutesLate || 0;
    if (activeCheckin.checkInTimeMs) {
      todayDurationMins = Math.floor((Date.now() - activeCheckin.checkInTimeMs) / 60000);
    }
  } else if (dailyAudits[todayStr]) {
    todayPunctual = dailyAudits[todayStr].isPunctual;
    todayMinutesLate = dailyAudits[todayStr].minutesLate;
    todayDurationMins = dailyAudits[todayStr].workedMinutes;
  } else {
    // Si no ha iniciado hoy, consideramos estado neutro/a tiempo por defecto hasta que inicie
    todayPunctual = true;
    todayMinutesLate = 0;
  }

  const todayPunctualityPoints = (activeCheckin || dailyAudits[todayStr]) ? (todayPunctual ? 30 : 0) : 0;
  const todayFullShift = todayDurationMins >= 480;
  const todayFullShiftPoints = todayFullShift ? 30 : 0;
  const todayLiveTracking = (todayDurationMins > 0 || todaySwitches > 0) && !isTodayPenalized;
  const todayLivePoints = todayLiveTracking ? 40 : 0;
  const todayTotalPoints = todayPunctualityPoints + todayFullShiftPoints + todayLivePoints;

  const todayFormatted = now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

  const todayAudit: DayGamificationAudit = {
    date: todayStr,
    dateFormatted: `Hoy (${todayFormatted})`,
    isPunctual: todayPunctual,
    minutesLate: todayMinutesLate,
    punctualityPoints: todayPunctualityPoints,
    isFullShift: todayFullShift,
    workedMinutes: todayDurationMins,
    fullShiftPoints: todayFullShiftPoints,
    isLiveTracking: todayLiveTracking,
    manualEditsCount: todayManualEdits,
    isPenalizedForManualEdits: isTodayPenalized,
    liveTrackingPoints: todayLivePoints,
    totalDayPoints: todayTotalPoints,
  };

  // Asignar en mapa
  dailyAudits[todayStr] = todayAudit;

  // Calcular suma total de puntos del mes
  let totalMonthlyPoints = 0;
  const monthlyAuditHistory = Object.values(dailyAudits).sort((a, b) => b.date.localeCompare(a.date));

  monthlyAuditHistory.forEach(d => {
    totalMonthlyPoints += d.totalDayPoints;
  });

  // Base mínima de cortesía por iniciar el mes con entusiasmo: 50 pts si aún no acumula registros
  if (totalMonthlyPoints === 0 && currentMonthRecords.length === 0) {
    totalMonthlyPoints = 80; // Puntos base para no empezar en blanco absoluto
  }

  // Determinar Rango Actual según escala de 1 mes (0 a 2,000 pts)
  let currentTier: RankTier = 'bronce';
  if (totalMonthlyPoints >= 1600) {
    currentTier = 'diamante';
  } else if (totalMonthlyPoints >= 1000) {
    currentTier = 'oro';
  } else if (totalMonthlyPoints >= 500) {
    currentTier = 'plata';
  } else {
    currentTier = 'bronce';
  }

  const rank = RANK_TIERS[currentTier];

  // Calcular siguiente rango y progreso porcentual hacia él
  let nextRank: RankConfig | null = null;
  let pointsForNext = 0;
  let progressPercent = 100;

  if (currentTier === 'bronce') {
    nextRank = RANK_TIERS.plata;
    pointsForNext = nextRank.minPoints - totalMonthlyPoints;
    progressPercent = Math.min(100, Math.round((totalMonthlyPoints / nextRank.minPoints) * 100));
  } else if (currentTier === 'plata') {
    nextRank = RANK_TIERS.oro;
    const span = nextRank.minPoints - rank.minPoints;
    const gainedInTier = totalMonthlyPoints - rank.minPoints;
    pointsForNext = nextRank.minPoints - totalMonthlyPoints;
    progressPercent = Math.min(100, Math.round((gainedInTier / span) * 100));
  } else if (currentTier === 'oro') {
    nextRank = RANK_TIERS.diamante;
    const span = nextRank.minPoints - rank.minPoints;
    const gainedInTier = totalMonthlyPoints - rank.minPoints;
    pointsForNext = nextRank.minPoints - totalMonthlyPoints;
    progressPercent = Math.min(100, Math.round((gainedInTier / span) * 100));
  } else {
    // Diamante alcanzado (máximo mensual)
    nextRank = null;
    pointsForNext = 0;
    progressPercent = 100;
  }

  return {
    points: totalMonthlyPoints,
    maxMonthlyPoints: 2000,
    rank,
    nextRank,
    pointsForNext: Math.max(0, pointsForNext),
    progressPercent: Math.max(0, Math.min(100, progressPercent)),
    seasonKey: currentSeasonKey,
    seasonName,
    daysRemainingInMonth,
    daysWorkedInMonth: monthlyAuditHistory.length,
    todayAudit,
    monthlyAuditHistory,
  };
}
