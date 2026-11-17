import { useState, useMemo, useEffect } from 'react';
import type { CheckinRecord } from '../../store/useCheckinStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import {
  formatMinutesSexagesimal,
  MAX_CONTINUOUS_SHIFT_MINUTES,
} from '../../services/attendanceService';
import { fetchTasksByAssignee, type TaskDocument } from '../../services/taskService';

interface SessionRegularizationModalProps {
  isOpen: boolean;
  pendingCheckin: CheckinRecord | null;
  onConfirm: (params: {
    realCheckoutTimeStr: string;
    note: string;
    allocations: Array<{ taskId: string; minutes: number }>;
    exceeded12hAlert: boolean;
  }) => Promise<void>;
}

interface RegularizationTaskItem {
  id: string;
  title: string;
  subtitle: string;
}

export function SessionRegularizationModal({
  isOpen,
  pendingCheckin,
  onConfirm,
}: SessionRegularizationModalProps) {
  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);
  const { tasks, assignments, projects, clients, addExtraordinaryTask } = useRayonerStore();

  const [realCheckoutTime, setRealCheckoutTime] = useState('18:30');
  const [observationNote, setObservationNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tareas remotas del usuario en Firestore
  const [remoteTasks, setRemoteTasks] = useState<TaskDocument[]>([]);

  // Distribución de minutos enteros por tarea: taskId -> minutos
  const [allocatedMinutes, setAllocatedMinutes] = useState<Record<string, number>>({});

  // Mini-formulario integrado para crear tarea extraordinaria
  const [isAddingExtraordinary, setIsAddingExtraordinary] = useState(false);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraHours, setExtraHours] = useState<number>(1);
  const [extraMinutes, setExtraMinutes] = useState<number>(0);

  // Cargar tareas reales asignadas al usuario desde Firestore al abrir
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let mounted = true;
    void fetchTasksByAssignee(user.id).then((list) => {
      if (mounted) setRemoteTasks(list);
    });
    return () => {
      mounted = false;
    };
  }, [isOpen, user?.id]);

  // Calcular hora inicial sugerida (checkIn + 9h o 18:30, sin pasarse de 23:59)
  useEffect(() => {
    if (isOpen && pendingCheckin?.checkInTimeMs) {
      const start = new Date(pendingCheckin.checkInTimeMs);
      const suggested = new Date(pendingCheckin.checkInTimeMs + 9 * 60 * 60 * 1000);
      const endOfSameDay = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        23,
        59,
        0,
        0
      );
      const finalSuggested =
        suggested.getTime() > endOfSameDay.getTime() ? endOfSameDay : suggested;
      const hh = String(finalSuggested.getHours()).padStart(2, '0');
      const mm = String(finalSuggested.getMinutes()).padStart(2, '0');
      setRealCheckoutTime(`${hh}:${mm}`);
      setAllocatedMinutes({});
      setIsAddingExtraordinary(false);
    }
  }, [isOpen, pendingCheckin?.id, pendingCheckin?.checkInTimeMs]);

  // Fecha y hora de check-in original formateadas
  const startMetadata = useMemo(() => {
    if (!pendingCheckin?.checkInTimeMs) {
      return { dateStr: '—', timeStr: '09:00' };
    }
    const d = new Date(pendingCheckin.checkInTimeMs);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return {
      dateStr: `${day}/${month}/${year}`,
      timeStr: `${hh}:${mm}`,
    };
  }, [pendingCheckin?.checkInTimeMs]);

  // Cálculo en vivo de duración total y validaciones
  const calculation = useMemo(() => {
    if (!pendingCheckin?.checkInTimeMs || !realCheckoutTime) {
      return {
        isValid: false,
        error: 'Selecciona una hora de salida aproximada.',
        totalMinutes: 0,
        exceeded12h: false,
      };
    }

    const startDate = new Date(pendingCheckin.checkInTimeMs);
    const [outHStr, outMStr] = realCheckoutTime.split(':');
    const outH = parseInt(outHStr, 10);
    const outM = parseInt(outMStr, 10);

    if (isNaN(outH) || isNaN(outM)) {
      return {
        isValid: false,
        error: 'Formato de hora inválido.',
        totalMinutes: 0,
        exceeded12h: false,
      };
    }

    const outDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      outH,
      outM,
      0,
      0
    );

    if (outDate.getTime() <= pendingCheckin.checkInTimeMs) {
      return {
        isValid: false,
        error: `La hora de salida debe ser posterior a tu entrada (${startMetadata.timeStr} hrs).`,
        totalMinutes: 0,
        exceeded12h: false,
      };
    }

    let pauseMs = 0;
    (pendingCheckin.pauses || []).forEach((p) => {
      if (p.startMs < outDate.getTime()) {
        const end = p.endMs ? Math.min(p.endMs, outDate.getTime()) : outDate.getTime();
        pauseMs += Math.max(0, end - p.startMs);
      }
    });

    const netMs = Math.max(0, outDate.getTime() - pendingCheckin.checkInTimeMs - pauseMs);
    const totalMinutes = Math.floor(netMs / 60000);
    const exceeded12h = totalMinutes > MAX_CONTINUOUS_SHIFT_MINUTES;

    return {
      isValid: true,
      error: '',
      totalMinutes,
      exceeded12h,
    };
  }, [pendingCheckin, realCheckoutTime, startMetadata.timeStr]);

  // Tareas disponibles estrictamente para este usuario (cero datos mock)
  const userTasks = useMemo<RegularizationTaskItem[]>(() => {
    if (!user?.id) return [];

    const assignedIds = new Set(
      assignments.filter((a) => a.userId === user.id).map((a) => a.taskId)
    );

    const map = new Map<string, RegularizationTaskItem>();

    tasks.forEach((t) => {
      const belongs =
        t.assigned_to === user.id ||
        assignedIds.has(t.id) ||
        (t.isExtraordinary && t.created_by === user.id);

      if (belongs && t.isActive !== false) {
        const proj = projects.find((p) => p.id === t.projectId);
        const cli = clients.find((c) => c.id === proj?.clientId);
        map.set(t.id, {
          id: t.id,
          title: t.title || t.name,
          subtitle: t.isExtraordinary
            ? 'Tarea Extraordinaria'
            : `${cli?.name || 'Empresa'} · ${proj?.name || 'Proyecto'}`,
        });
      }
    });

    remoteTasks.forEach((rt) => {
      if (!map.has(rt.id)) {
        const cli = clients.find((c) => c.id === rt.companyId);
        const proj = projects.find((p) => p.id === rt.projectId);
        map.set(rt.id, {
          id: rt.id,
          title: rt.title,
          subtitle: rt.companyId
            ? `${cli?.name || 'Empresa'} · ${proj?.name || 'Proyecto'}`
            : 'Actividad asignada',
        });
      }
    });

    return Array.from(map.values());
  }, [user?.id, tasks, assignments, remoteTasks, projects, clients]);

  const totalAllocatedMinutes = useMemo(() => {
    return Object.values(allocatedMinutes).reduce(
      (acc, m) => acc + Math.max(0, Math.round(m || 0)),
      0
    );
  }, [allocatedMinutes]);

  const remainingMinutes = calculation.totalMinutes - totalAllocatedMinutes;

  if (!isOpen || !pendingCheckin) return null;

  const handleUpdateTaskTime = (taskId: string, hours: number, minutes: number) => {
    const safeH = Math.max(0, Math.min(12, Math.floor(hours || 0)));
    const safeM = Math.max(0, Math.min(59, Math.floor(minutes || 0)));
    setAllocatedMinutes((prev) => ({
      ...prev,
      [taskId]: safeH * 60 + safeM,
    }));
  };

  const handleCreateExtraordinary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraTitle.trim()) {
      addToast('Escribe el nombre de la tarea extraordinaria.', 'error');
      return;
    }
    if (!user?.id) return;

    const totalExtraMins = Math.max(
      0,
      Math.min(12, extraHours) * 60 + Math.min(59, extraMinutes)
    );
    const plannedHours = Math.max(0.25, Number((totalExtraMins / 60).toFixed(2)));

    const newTaskId = addExtraordinaryTask({
      name: extraTitle.trim(),
      description: `Actividad extraordinaria regularizada de la jornada del ${startMetadata.dateStr}`,
      plannedHours,
      category: 'Extraordinaria',
      userId: user.id,
      userName: `${user.name} ${user.lastName || ''}`.trim() || user.email,
    });

    if (totalExtraMins > 0) {
      setAllocatedMinutes((prev) => ({
        ...prev,
        [newTaskId]: totalExtraMins,
      }));
    }

    addToast(`Tarea extraordinaria "${extraTitle.trim()}" creada.`, 'success');
    setExtraTitle('');
    setExtraHours(0);
    setExtraMinutes(0);
    setIsAddingExtraordinary(false);
  };

  const handleSubmit = async () => {
    if (!calculation.isValid) {
      addToast(calculation.error || 'Verifica la hora de salida.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const allocations = Object.entries(allocatedMinutes)
        .filter(([, mins]) => mins > 0)
        .map(([taskId, minutes]) => ({ taskId, minutes: Math.round(minutes) }));

      await onConfirm({
        realCheckoutTimeStr: realCheckoutTime,
        note: observationNote.trim(),
        allocations,
        exceeded12hAlert: calculation.exceeded12h,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="regularization-modal-title"
    >
      <div className="w-full max-w-2xl bg-[#101726] text-slate-200 border border-slate-800 p-6 shadow-2xl space-y-6">
        {/* Encabezado y Aviso Obligatorio */}
        <div className="border-b border-slate-800 pb-4">
          <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-1">
            Cierre de Sesión Pendiente
          </div>
          <h3
            id="regularization-modal-title"
            className="text-lg font-bold font-['Space_Grotesk'] text-white"
          >
            Aviso: No cerraste tu sesión anterior
          </h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Tu jornada iniciada el{' '}
            <span className="text-slate-200 font-medium">
              {startMetadata.dateStr} a las {startMetadata.timeStr} hrs
            </span>{' '}
            alcanzó el límite máximo de{' '}
            <span className="font-mono text-slate-200">12h 00m</span> y se detuvo
            automáticamente. Indica tu hora de salida aproximada y gestiona el tiempo de
            tus actividades para habilitar tu nuevo turno.
          </p>
        </div>

        {/* Selección de Hora de Salida Aproximada */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#090E17] p-4 border border-slate-800">
          <div>
            <label
              htmlFor="regularization-checkout-time"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1"
            >
              Hora de salida aproximada
            </label>
            <input
              id="regularization-checkout-time"
              type="time"
              value={realCheckoutTime}
              onChange={(e) => setRealCheckoutTime(e.target.value)}
              className="bg-[#101726] text-slate-100 font-mono text-sm border border-slate-700 px-3 py-1.5 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-400 block">
              Tiempo calculado de jornada
            </span>
            <span
              className={`text-xl font-bold font-['Space_Grotesk'] ${
                calculation.exceeded12h ? 'text-amber-400' : 'text-sky-400'
              }`}
            >
              {formatMinutesSexagesimal(calculation.totalMinutes)}
            </span>
          </div>
        </div>

        {/* Validación / Alerta si supera las 12 horas reglamentarias */}
        {!calculation.isValid && calculation.error && (
          <div className="text-xs font-medium text-rose-400 bg-rose-950/30 border border-rose-900/60 px-3.5 py-2.5">
            {calculation.error}
          </div>
        )}

        {calculation.isValid && calculation.exceeded12h && (
          <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-900/60 px-3.5 py-2.5">
            La duración ingresada supera las 12h 00m reglamentarias. Al guardar, se
            registrará una alerta automática para revisión de tu supervisor.
          </div>
        )}

        {/* Gestión de Tareas de la Jornada */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Distribución de tiempo en actividades
              </span>
              {totalAllocatedMinutes > 0 && (
                <span className="text-[11px] font-mono text-slate-400">
                  Asignado: {formatMinutesSexagesimal(totalAllocatedMinutes)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsAddingExtraordinary((v) => !v)}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 cursor-pointer"
            >
              {isAddingExtraordinary ? 'Cancelar' : '+ Crear Tarea Extraordinaria'}
            </button>
          </div>

          {/* Mini-formulario integrado para tarea extraordinaria */}
          {isAddingExtraordinary && (
            <form
              onSubmit={handleCreateExtraordinary}
              className="bg-[#090E17] border border-slate-700 p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
                    Actividad extraordinaria
                  </label>
                  <input
                    type="text"
                    value={extraTitle}
                    onChange={(e) => setExtraTitle(e.target.value)}
                    placeholder="Ej. Revisión de papeles de trabajo o soporte"
                    className="w-full bg-[#101726] text-xs text-slate-100 border border-slate-700 px-3 py-1.5 focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
                    Horas
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={extraHours}
                    onChange={(e) =>
                      setExtraHours(Math.max(0, Math.min(12, Number(e.target.value) || 0)))
                    }
                    className="w-full bg-[#101726] font-mono text-xs text-center text-slate-100 border border-slate-700 px-2 py-1.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">
                    Min (0-59)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={extraMinutes}
                    onChange={(e) =>
                      setExtraMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                    }
                    className="w-full bg-[#101726] font-mono text-xs text-center text-slate-100 border border-slate-700 px-2 py-1.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Tabla de Tareas (O estado vacío si no tiene) */}
          <div className="border border-slate-800 divide-y divide-slate-800/60 max-h-56 overflow-y-auto">
            {userTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No tienes tareas asignadas en este periodo. Utiliza el botón superior para
                registrar una tarea extraordinaria si lo requieres.
              </div>
            ) : (
              userTasks.map((task) => {
                const mins = allocatedMinutes[task.id] || 0;
                const h = Math.floor(mins / 60);
                const m = mins % 60;

                return (
                  <div
                    key={task.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#101726]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-100 truncate">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{task.subtitle}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={12}
                          value={h}
                          onChange={(e) =>
                            handleUpdateTaskTime(task.id, Number(e.target.value), m)
                          }
                          aria-label={`Horas para ${task.title}`}
                          className="w-12 bg-[#090E17] font-mono text-xs text-center text-slate-100 border border-slate-700 py-1 focus:outline-none focus:border-blue-600"
                        />
                        <span className="text-[11px] font-mono text-slate-500">h</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={m}
                          onChange={(e) =>
                            handleUpdateTaskTime(task.id, h, Number(e.target.value))
                          }
                          aria-label={`Minutos para ${task.title}`}
                          className="w-12 bg-[#090E17] font-mono text-xs text-center text-slate-100 border border-slate-700 py-1 focus:outline-none focus:border-blue-600"
                        />
                        <span className="text-[11px] font-mono text-slate-500">m</span>
                      </div>

                      {remainingMinutes > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAllocatedMinutes((prev) => ({
                              ...prev,
                              [task.id]: (prev[task.id] || 0) + remainingMinutes,
                            }))
                          }
                          className="px-2 py-1 text-[11px] font-medium text-sky-400 border border-slate-700 hover:bg-slate-800 cursor-pointer"
                        >
                          + Resto
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Nota opcional de regularización */}
        <div>
          <label
            htmlFor="regularization-note"
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1"
          >
            Observación opcional (para supervisión / RH)
          </label>
          <input
            id="regularization-note"
            type="text"
            value={observationNote}
            onChange={(e) => setObservationNote(e.target.value)}
            placeholder="Ej. Olvidé marcar salida al concluir la revisión en oficina"
            className="w-full bg-[#090E17] text-xs text-slate-100 border border-slate-800 px-3 py-2 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Acción Final */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] font-mono text-slate-500">
            Registro obligatorio antes de iniciar nuevo turno
          </span>
          <button
            type="button"
            disabled={!calculation.isValid || isSubmitting}
            onClick={() => void handleSubmit()}
            className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando cierre...' : 'Confirmar Salida y Regularizar Jornada'}
          </button>
        </div>
      </div>
    </div>
  );
}
