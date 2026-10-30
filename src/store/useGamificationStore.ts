import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RankTier } from '../services/gamification';

export interface PreviousSeasonRank {
  month: string;
  monthName: string;
  tier: RankTier;
  points: number;
}

interface GamificationState {
  // Clave del mes actual (YYYY-MM), ej. "2026-10"
  currentSeasonKey: string;
  // Historial del rango alcanzado el mes anterior antes del reinicio
  previousSeason: PreviousSeasonRank | null;
  // Registro de ediciones manuales por fecha: { "2026-10-20": 1 }
  manualEditsByDate: Record<string, number>;
  // Registro de cambios de tareas en vivo por fecha: { "2026-10-20": 3 }
  taskSwitchesByDate: Record<string, number>;

  // Acciones
  recordManualEdit: (dateStr?: string) => void;
  recordTaskSwitch: (dateStr?: string) => void;
  checkAndResetSeason: (currentPoints: number, currentTier: RankTier) => void;
  getManualEditsForDate: (dateStr: string) => number;
  getTaskSwitchesForDate: (dateStr: string) => number;
}

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const getCurrentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthName = (monthKey: string) => {
  const [yearStr, monthStr] = monthKey.split('-');
  const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const name = date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      currentSeasonKey: getCurrentMonthKey(),
      previousSeason: {
        month: '2026-09',
        monthName: 'Septiembre 2026',
        tier: 'oro',
        points: 1450,
      },
      manualEditsByDate: {
        // Datos iniciales de demostración
        [getTodayDateStr()]: 0,
      },
      taskSwitchesByDate: {
        // Tareas conmutadas en vivo hoy
        [getTodayDateStr()]: 3,
      },

      recordManualEdit: (dateStr) => {
        const date = dateStr || getTodayDateStr();
        set(state => ({
          manualEditsByDate: {
            ...state.manualEditsByDate,
            [date]: (state.manualEditsByDate[date] || 0) + 1,
          },
        }));
      },

      recordTaskSwitch: (dateStr) => {
        const date = dateStr || getTodayDateStr();
        set(state => ({
          taskSwitchesByDate: {
            ...state.taskSwitchesByDate,
            [date]: (state.taskSwitchesByDate[date] || 0) + 1,
          },
        }));
      },

      checkAndResetSeason: (currentPoints, currentTier) => {
        const activeKey = getCurrentMonthKey();
        const storedKey = get().currentSeasonKey;

        // Si ya cambió el mes, archivar temporada previa y reiniciar puntajes
        if (storedKey && storedKey !== activeKey) {
          set({
            previousSeason: {
              month: storedKey,
              monthName: getMonthName(storedKey),
              tier: currentTier,
              points: currentPoints,
            },
            currentSeasonKey: activeKey,
            manualEditsByDate: {},
            taskSwitchesByDate: {},
          });
        }
      },

      getManualEditsForDate: (dateStr) => {
        return get().manualEditsByDate[dateStr] || 0;
      },

      getTaskSwitchesForDate: (dateStr) => {
        return get().taskSwitchesByDate[dateStr] || 0;
      },
    }),
    {
      name: 'checkin-gamification-storage',
    }
  )
);
