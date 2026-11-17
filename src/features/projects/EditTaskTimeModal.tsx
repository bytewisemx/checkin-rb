import { useState, useEffect, useMemo } from 'react';
import type { TaskNode } from '../../types/rayoner';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import {
  formatMinutesSexagesimal,
  computeElapsedShiftMinutes,
  MAX_CONTINUOUS_SHIFT_MINUTES,
} from '../../services/attendanceService';
import { updateTaskProgressInFirestore } from '../../services/taskService';
import { TimeDistributionBar } from '../checkin/TimeDistributionBar';

interface EditTaskTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode | null;
  clientName: string;
  projectName: string;
  currentHours: number;
  allocatedHours: number;
  onSaveHours: (newHours: number) => void;
  onFinalizeTask: (finalHours: number) => void;
}

export function EditTaskTimeModal({
  isOpen,
  onClose,
  task,
  clientName,
  projectName,
  currentHours,
  allocatedHours,
  onSaveHours,
  onFinalizeTask,
}: EditTaskTimeModalProps) {
  const { user, activeCheckin, history } = useCheckinStore();
  const { tasks, userTaskActualHours } = useRayonerStore();

  const [hoursVal, setHoursVal] = useState<number>(0);
  const [minutesVal, setMinutesVal] = useState<number>(0);
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isConfirmingFinalize, setIsConfirmingFinalize] = useState<boolean>(false);

  // Calcular tiempo real de jornada del día actual (en minutos enteros)
  const totalShiftMinutes = useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];

    if (activeCheckin?.checkInTimeMs) {
      const elapsed = computeElapsedShiftMinutes(activeCheckin.checkInTimeMs);
      return Math.min(MAX_CONTINUOUS_SHIFT_MINUTES, Math.max(0, elapsed));
    }

    const todayRecords = (history || []).filter((r) => r.date === todayIso);
    const sumToday = todayRecords.reduce(
      (acc, r) => acc + Math.max(0, Math.round(r.totalDurationMinutes || 0)),
      0
    );
    return Math.min(MAX_CONTINUOUS_SHIFT_MINUTES, sumToday);
  }, [activeCheckin, history]);

  // Calcular minutos ya asignados a otras tareas del mismo colaborador
  const otherTasksSegments = useMemo(() => {
    if (!user?.id || !task) return [];
    const list: Array<{ id: string; label: string; minutes: number }> = [];

    tasks.forEach((t) => {
      if (t.id === task.id) return;
      const key = `${t.id}_${user.id}`;
      const hrs = userTaskActualHours[key] || 0;
      const mins = Math.max(0, Math.round(hrs * 60));
      if (mins > 0) {
        list.push({
          id: t.id,
          label: t.title || t.name,
          minutes: mins,
        });
      }
    });

    return list;
  }, [tasks, user?.id, task, userTaskActualHours]);

  const otherTasksTotalMinutes = useMemo(() => {
    return otherTasksSegments.reduce((acc, s) => acc + s.minutes, 0);
  }, [otherTasksSegments]);

  const hasActiveShiftCap = totalShiftMinutes > 0;
  const maxAllowedForTask = hasActiveShiftCap
    ? Math.max(0, totalShiftMinutes - otherTasksTotalMinutes)
    : MAX_CONTINUOUS_SHIFT_MINUTES;

  useEffect(() => {
    if (isOpen && task) {
      const initialMins = Math.max(0, Math.round((currentHours || 0) * 60));
      const clampedInitial = hasActiveShiftCap
        ? Math.min(initialMins, maxAllowedForTask)
        : initialMins;
      setHoursVal(Math.floor(clampedInitial / 60));
      setMinutesVal(clampedInitial % 60);
      setAdjustmentNote('');
      setErrorMsg('');
      setIsConfirmingFinalize(false);
    }
  }, [isOpen, task, currentHours, hasActiveShiftCap, maxAllowedForTask]);

  if (!isOpen || !task) return null;

  const isAlreadyCompleted = task.status === 'completed';
  const currentTotalMinutes = Math.max(0, hoursVal * 60 + minutesVal);
  const currentHoursDecimal = Number((currentTotalMinutes / 60).toFixed(4));
  const isOverflow = hasActiveShiftCap && currentTotalMinutes > maxAllowedForTask;
  const allocatedMinutes = Math.max(0, Math.round((allocatedHours || 0) * 60));
  const isOverBudget = allocatedMinutes > 0 && currentTotalMinutes > allocatedMinutes;

  const distributionSegments = [
    ...otherTasksSegments,
    ...(currentTotalMinutes > 0
      ? [{ id: task.id, label: task.title || task.name, minutes: currentTotalMinutes }]
      : []),
  ];

  const handleTimeChange = (rawH: number, rawM: number) => {
    const safeH = Math.max(0, Math.floor(rawH || 0));
    const safeM = Math.max(0, Math.min(59, Math.floor(rawM || 0)));
    const requestedMinutes = safeH * 60 + safeM;

    if (hasActiveShiftCap && requestedMinutes > maxAllowedForTask) {
      setHoursVal(Math.floor(maxAllowedForTask / 60));
      setMinutesVal(maxAllowedForTask % 60);
      setErrorMsg(
        `Tope de jornada alcanzado: el máximo disponible para esta tarea es ${formatMinutesSexagesimal(
          maxAllowedForTask
        )} (jornada actual: ${formatMinutesSexagesimal(totalShiftMinutes)}).`
      );
      return;
    }

    setErrorMsg('');
    setHoursVal(safeH);
    setMinutesVal(safeM);
  };

  const handleSaveOnly = () => {
    if (isAlreadyCompleted) return;
    if (isOverflow) {
      setErrorMsg(
        `El tiempo ingresado supera la capacidad disponible de tu jornada (${formatMinutesSexagesimal(
          maxAllowedForTask
        )}).`
      );
      return;
    }
    void updateTaskProgressInFirestore(task.id, {
      loggedMinutes: currentTotalMinutes,
    });
    onSaveHours(currentHoursDecimal);
    onClose();
  };

  const handlePromptFinalize = () => {
    if (isAlreadyCompleted || isOverflow) return;
    setIsConfirmingFinalize(true);
  };

  const handleConfirmFinalize = () => {
    if (isAlreadyCompleted || isOverflow) return;
    void updateTaskProgressInFirestore(task.id, {
      loggedMinutes: currentTotalMinutes,
      status: 'completed',
    });
    onFinalizeTask(currentHoursDecimal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl p-6 space-y-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {isAlreadyCompleted
                ? 'Registro Definitivo'
                : isConfirmingFinalize
                ? 'Confirmación de Cierre'
                : 'Asignación Manual de Tiempo'}
            </div>
            <h3 className="text-lg font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white">
              {isAlreadyCompleted
                ? 'Tarea Finalizada (Bloqueada)'
                : isConfirmingFinalize
                ? 'Confirmar Cierre Definitivo'
                : 'Ajustar Tiempo Invertido'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {clientName} · {projectName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {/* Resumen de la Tarea */}
        <div className="bg-slate-50 dark:bg-[#090E17] border border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {task.name}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Presupuesto asignado:{' '}
              <strong className="font-mono text-slate-700 dark:text-slate-200">
                {allocatedMinutes > 0
                  ? formatMinutesSexagesimal(allocatedMinutes)
                  : 'Sin límite'}
              </strong>
            </span>
            {hasActiveShiftCap && (
              <span>
                Máximo disponible hoy:{' '}
                <strong className="font-mono text-blue-700 dark:text-sky-400">
                  {formatMinutesSexagesimal(maxAllowedForTask)}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Barra Visual Segmentada (si existe jornada activa o del día) */}
        {hasActiveShiftCap && (
          <TimeDistributionBar
            totalShiftMinutes={totalShiftMinutes}
            segments={distributionSegments}
            variant="adaptive"
          />
        )}

        {/* Avisos de estado */}
        {isAlreadyCompleted && (
          <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-3.5">
            Esta tarea ya fue finalizada. Por políticas de auditoría, el tiempo registrado
            ({formatMinutesSexagesimal(currentTotalMinutes)}) no admite modificaciones.
          </div>
        )}

        {isConfirmingFinalize && !isAlreadyCompleted && (
          <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3.5">
            Una vez finalizada la tarea, el registro quedará sellado con{' '}
            <strong className="font-mono">
              {formatMinutesSexagesimal(currentTotalMinutes)}
            </strong>{' '}
            y no podrá editarse. ¿Deseas concluirla ahora?
          </div>
        )}

        {errorMsg && (
          <div className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-3">
            {errorMsg}
          </div>
        )}

        {isOverBudget && !errorMsg && (
          <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3">
            El tiempo registrado supera el presupuesto de esta tarea (
            {formatMinutesSexagesimal(allocatedMinutes)}).
          </div>
        )}

        {/* Controles Sexagesimales (Horas y Minutos 0-59) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tiempo Invertido (Xh Ym)
            </span>
            <span className="text-base font-bold font-['Space_Grotesk'] text-blue-700 dark:text-sky-400">
              {formatMinutesSexagesimal(currentTotalMinutes)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Horas
              </label>
              <input
                type="number"
                min={0}
                max={Math.floor(maxAllowedForTask / 60)}
                disabled={isAlreadyCompleted}
                value={hoursVal}
                onChange={(e) => handleTimeChange(Number(e.target.value), minutesVal)}
                className="w-full bg-slate-50 dark:bg-[#090E17] font-mono text-base font-semibold text-center text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 py-2 focus:outline-none focus:border-blue-600 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Minutos (0–59)
              </label>
              <input
                type="number"
                min={0}
                max={59}
                disabled={isAlreadyCompleted}
                value={minutesVal}
                onChange={(e) => handleTimeChange(hoursVal, Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#090E17] font-mono text-base font-semibold text-center text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 py-2 focus:outline-none focus:border-blue-600 disabled:opacity-50"
              />
            </div>
          </div>

          {!isAlreadyCompleted && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Nota de ajuste (opcional)
              </label>
              <input
                type="text"
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
                placeholder="Ej. Corrección de tiempo invertido en revisión"
                className="w-full bg-slate-50 dark:bg-[#090E17] text-xs text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 px-3 py-2 focus:outline-none focus:border-blue-600"
              />
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          {isConfirmingFinalize ? (
            <>
              <button
                type="button"
                onClick={() => setIsConfirmingFinalize(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isOverflow}
                onClick={handleConfirmFinalize}
                className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition cursor-pointer disabled:opacity-50"
              >
                Confirmar Finalización ({formatMinutesSexagesimal(currentTotalMinutes)})
              </button>
            </>
          ) : (
            <>
              {!isAlreadyCompleted ? (
                <button
                  type="button"
                  disabled={isOverflow}
                  onClick={handlePromptFinalize}
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer disabled:opacity-40"
                >
                  Finalizar y sellar tarea
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  {isAlreadyCompleted ? 'Cerrar' : 'Cancelar'}
                </button>
                {!isAlreadyCompleted && (
                  <button
                    type="button"
                    disabled={isOverflow}
                    onClick={handleSaveOnly}
                    className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Guardar Tiempo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
