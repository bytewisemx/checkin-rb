import { useState, useMemo } from 'react';
import type { CheckinRecord } from '../../store/useCheckinStore';
import { X, Clock, Calendar, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RealCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingCheckin: CheckinRecord | null;
  onConfirm: (realCheckoutTimeStr: string, note: string) => Promise<void>;
}

export function RealCheckoutModal({
  isOpen,
  onClose,
  pendingCheckin,
  onConfirm,
}: RealCheckoutModalProps) {
  const [realCheckoutTime, setRealCheckoutTime] = useState('18:00');
  const [observationNote, setObservationNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fecha del registro
  const formattedDate = useMemo(() => {
    if (!pendingCheckin || !pendingCheckin.checkInTimeMs) return 'Fecha no disponible';
    const d = new Date(pendingCheckin.checkInTimeMs);
    return d.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [pendingCheckin]);

  // Hora de Check-in en formato HH:MM
  const checkinTimeFormatted = useMemo(() => {
    if (!pendingCheckin || !pendingCheckin.checkInTimeMs) return '09:00';
    const d = new Date(pendingCheckin.checkInTimeMs);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }, [pendingCheckin]);

  // Última tarea activa
  const lastTaskInfo = useMemo(() => {
    if (!pendingCheckin?.taskIntervals || pendingCheckin.taskIntervals.length === 0) {
      return null;
    }
    const intervals = pendingCheckin.taskIntervals;
    return intervals[intervals.length - 1];
  }, [pendingCheckin]);

  // Cálculo en vivo según la hora ingresada
  const calculation = useMemo(() => {
    if (!pendingCheckin?.checkInTimeMs || !realCheckoutTime) {
      return {
        isValid: false,
        error: 'Introduce una hora de salida válida.',
        recalculatedDurationStr: '0h 00m',
        recalculatedMinutes: 0,
        recalculatedSeconds: 0,
        frozenCutoffDurationStr: '14h 54m',
        inflatedHoursSavedStr: '0h 00m',
        lastTaskRecalculatedStr: '—',
        totalTaskHoursStr: '0.00 hrs',
      };
    }

    const startDate = new Date(pendingCheckin.checkInTimeMs);
    const inHours = startDate.getHours();
    const inMinutes = startDate.getMinutes();
    const inTotalMinutes = inHours * 60 + inMinutes;

    const [outHStr, outMStr] = realCheckoutTime.split(':');
    const outHours = parseInt(outHStr, 10);
    const outMinutes = parseInt(outMStr, 10);
    const outTotalMinutes = outHours * 60 + outMinutes;

    // Validación: posterior a la hora de entrada y no mayor a las 23:59
    if (isNaN(outTotalMinutes)) {
      return {
        isValid: false,
        error: 'Formato de hora incorrecto.',
        recalculatedDurationStr: '0h 00m',
        recalculatedMinutes: 0,
        recalculatedSeconds: 0,
        frozenCutoffDurationStr: '0h 00m',
        inflatedHoursSavedStr: '0h 00m',
        lastTaskRecalculatedStr: '—',
        totalTaskHoursStr: '0.00 hrs',
      };
    }

    if (outTotalMinutes <= inTotalMinutes) {
      return {
        isValid: false,
        error: `La hora de salida debe ser posterior a la hora de entrada (${checkinTimeFormatted} hrs).`,
        recalculatedDurationStr: '0h 00m',
        recalculatedMinutes: 0,
        recalculatedSeconds: 0,
        frozenCutoffDurationStr: '0h 00m',
        inflatedHoursSavedStr: '0h 00m',
        lastTaskRecalculatedStr: '—',
        totalTaskHoursStr: '0.00 hrs',
      };
    }

    if (outTotalMinutes > 23 * 60 + 59) {
      return {
        isValid: false,
        error: 'La hora de salida no puede exceder las 23:59 hrs.',
        recalculatedDurationStr: '0h 00m',
        recalculatedMinutes: 0,
        recalculatedSeconds: 0,
        frozenCutoffDurationStr: '0h 00m',
        inflatedHoursSavedStr: '0h 00m',
        lastTaskRecalculatedStr: '—',
        totalTaskHoursStr: '0.00 hrs',
      };
    }

    const realCheckoutDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      outHours,
      outMinutes,
      0,
      0
    );
    const realCheckoutMs = realCheckoutDate.getTime();

    // Pausas dentro del rango
    let totalPauseMs = 0;
    (pendingCheckin.pauses || []).forEach((p) => {
      if (p.startMs < realCheckoutMs) {
        const end = p.endMs ? Math.min(p.endMs, realCheckoutMs) : realCheckoutMs;
        totalPauseMs += Math.max(0, end - p.startMs);
      }
    });

    const effectiveMs = Math.max(0, realCheckoutMs - pendingCheckin.checkInTimeMs - totalPauseMs);
    const recalculatedSeconds = Math.floor(effectiveMs / 1000);
    const recalculatedMinutes = Math.floor(recalculatedSeconds / 60);

    const h = Math.floor(recalculatedMinutes / 60);
    const m = recalculatedMinutes % 60;
    const recalculatedDurationStr = `${h}h ${String(m).padStart(2, '0')}m`;

    // Comparativa con las 23:59
    const cutoffDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      23,
      59,
      0,
      0
    );
    const cutoffMs = cutoffDate.getTime();
    let cutoffPauseMs = 0;
    (pendingCheckin.pauses || []).forEach((p) => {
      if (p.startMs < cutoffMs) {
        const end = p.endMs ? Math.min(p.endMs, cutoffMs) : cutoffMs;
        cutoffPauseMs += Math.max(0, end - p.startMs);
      }
    });
    const frozenCutoffSecs = Math.max(0, Math.floor((cutoffMs - pendingCheckin.checkInTimeMs - cutoffPauseMs) / 1000));
    const frozenCutoffH = Math.floor(frozenCutoffSecs / 3600);
    const frozenCutoffM = Math.floor((frozenCutoffSecs % 3600) / 60);
    const frozenCutoffDurationStr = `${frozenCutoffH}h ${String(frozenCutoffM).padStart(2, '0')}m`;

    const savedSecs = Math.max(0, frozenCutoffSecs - recalculatedSeconds);
    const savedH = Math.floor(savedSecs / 3600);
    const savedM = Math.floor((savedSecs % 3600) / 60);
    const inflatedHoursSavedStr = `${savedH}h ${String(savedM).padStart(2, '0')}m`;

    // Recálculo de la última tarea y suma de tareas
    let lastTaskRecalculatedStr = '—';
    let totalTaskSecs = 0;

    if (pendingCheckin.taskIntervals && pendingCheckin.taskIntervals.length > 0) {
      pendingCheckin.taskIntervals.forEach((interval, idx) => {
        if (interval.startMs < realCheckoutMs) {
          const end = interval.endMs ? Math.min(interval.endMs, realCheckoutMs) : realCheckoutMs;
          const dur = Math.max(0, Math.floor((end - interval.startMs) / 1000));
          totalTaskSecs += dur;

          if (idx === pendingCheckin.taskIntervals!.length - 1) {
            const th = Math.floor(dur / 3600);
            const tm = Math.floor((dur % 3600) / 60);
            lastTaskRecalculatedStr = `${th}h ${String(tm).padStart(2, '0')}m (cierre a las ${realCheckoutTime} hrs)`;
          }
        }
      });
    }

    const totalTaskHoursStr = `${(totalTaskSecs / 3600).toFixed(2)} hrs`;

    return {
      isValid: true,
      error: null,
      recalculatedDurationStr,
      recalculatedMinutes,
      recalculatedSeconds,
      frozenCutoffDurationStr,
      inflatedHoursSavedStr,
      lastTaskRecalculatedStr,
      totalTaskHoursStr,
    };
  }, [pendingCheckin, realCheckoutTime, checkinTimeFormatted]);

  if (!isOpen || !pendingCheckin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculation.isValid) return;

    try {
      setIsSubmitting(true);
      await onConfirm(realCheckoutTime, observationNote);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              Regularización de Salida Real
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Corte automático de jornada a las 23:59 hrs detectado
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 1. Datos Informativos (Solo Lectura) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                Fecha Jornada
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1">
                {formattedDate}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                Check-in Real
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1 font-mono">
                {checkinTimeFormatted} hrs
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                Última Tarea
              </span>
              <span
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mt-1 truncate"
                title={lastTaskInfo ? lastTaskInfo.taskName : 'Sin tarea asignada'}
              >
                {lastTaskInfo ? lastTaskInfo.taskName : 'General / Sin Tarea'}
              </span>
            </div>
          </div>

          {/* 2. Input Principal: Hora de Salida Real */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Hora de Salida Real *</span>
              <span className="text-[11px] font-normal text-slate-400">
                Horario límite: 23:59 hrs
              </span>
            </label>
            <input
              type="time"
              required
              value={realCheckoutTime}
              onChange={(e) => setRealCheckoutTime(e.target.value)}
              className="w-full p-3 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-700 cursor-pointer"
            />
            {calculation.error && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {calculation.error}
              </p>
            )}
          </div>

          {/* 3. Recálculo Automático en Vivo dentro del Modal */}
          {calculation.isValid && (
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800/80 dark:text-blue-300/80 block">
                    Tiempo de Jornada Recalculado
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-extrabold text-blue-900 dark:text-blue-100 font-mono">
                      {calculation.recalculatedDurationStr}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      Normalizado
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block">
                    Horas infladas corregidas
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                    -{calculation.inflatedHoursSavedStr}
                  </span>
                </div>
              </div>

              {/* Ajuste en la Última Tarea Activa */}
              {lastTaskInfo && (
                <div className="pt-2 border-t border-blue-200/70 dark:border-blue-900/50 text-xs space-y-1">
                  <div className="flex items-center justify-between text-blue-900 dark:text-blue-200">
                    <span className="font-semibold truncate max-w-[240px]">
                      Ajuste en tarea: {lastTaskInfo.taskName}
                    </span>
                    <span className="font-mono text-[11px] text-blue-700 dark:text-blue-300">
                      {calculation.lastTaskRecalculatedStr}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Suma total imputada de tareas del día:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                      {calculation.totalTaskHoursStr}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Motivo / Observación */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Motivo u Observación (Opcional)
            </label>
            <input
              type="text"
              value={observationNote}
              onChange={(e) => setObservationNote(e.target.value)}
              placeholder="Ej. Olvidé marcar salida al salir de la oficina"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-700"
            />
          </div>

          {/* 5. Botones de Acción */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!calculation.isValid || isSubmitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Guardando regularización...' : 'Confirmar Salida y Recalcular Tiempos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
