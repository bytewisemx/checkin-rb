import { useState, useMemo, useEffect } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import {
  formatMinutesSexagesimal,
  validateShiftTimeDistribution,
} from '../../services/attendanceService';
import {
  fetchTasksByAssignee,
  commitShiftTaskAllocationsToFirestore,
  type TaskDocument,
} from '../../services/taskService';
import { TimeDistributionBar } from './TimeDistributionBar';

interface EndDayAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCloseDay: (allocations: Array<{ taskId: string; hours: number }>) => void;
  onCloseAsGeneral: () => void;
  workedDurationMinutes: number;
  activeTaskId?: string | null;
}

interface DisplayTaskItem {
  id: string;
  title: string;
  companyName: string;
  projectName: string;
  isExtraordinary?: boolean;
}

export function EndDayAllocationModal({
  isOpen,
  onClose,
  onConfirmCloseDay,
  onCloseAsGeneral,
  workedDurationMinutes,
  activeTaskId,
}: EndDayAllocationModalProps) {
  const {
    clients,
    projects,
    tasks,
    assignments,
    taskActualHours,
    addExtraordinaryTask,
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);

  // Tareas consultadas directamente en Firestore para el userId actual
  const [remoteTasks, setRemoteTasks] = useState<TaskDocument[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  // Minutos enteros asignados por tarea: taskId -> minutos enteros
  const [allocatedMinutes, setAllocatedMinutes] = useState<Record<string, number>>({});
  const [capWarning, setCapWarning] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Subformulario compacto para registrar tarea extraordinaria
  const [isAddingExtraordinary, setIsAddingExtraordinary] = useState(false);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraHours, setExtraHours] = useState<number>(0);
  const [extraMinutes, setExtraMinutes] = useState<number>(0);

  const totalShiftMinutes = useMemo(() => {
    return Math.max(0, Math.round(workedDurationMinutes || 0));
  }, [workedDurationMinutes]);

  // Al abrir el modal, consultar tareas vinculadas al userId en Firestore (sin datos mock)
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let mounted = true;
    setIsLoadingRemote(true);

    void fetchTasksByAssignee(user.id)
      .then((list) => {
        if (mounted) {
          setRemoteTasks(list);
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingRemote(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, user?.id]);

  // Tareas estrictamente vinculadas al usuario logueado (sin fallbacks ni datos ficticios)
  const availableTasks = useMemo<DisplayTaskItem[]>(() => {
    if (!user?.id) return [];

    const assignedTaskIds = new Set(
      assignments.filter((a) => a.userId === user.id).map((a) => a.taskId)
    );

    const merged = new Map<string, DisplayTaskItem>();

    // 1. Tareas locales del usuario actual
    tasks.forEach((t) => {
      const belongsToUser =
        t.assigned_to === user.id ||
        assignedTaskIds.has(t.id) ||
        (t.isExtraordinary && t.created_by === user.id);

      if (belongsToUser && t.isActive !== false && t.status !== 'completed') {
        const proj = projects.find((p) => p.id === t.projectId);
        const cli = clients.find((c) => c.id === proj?.clientId);
        merged.set(t.id, {
          id: t.id,
          title: t.title || t.name,
          companyName: t.isExtraordinary ? 'Extraordinaria' : cli?.name || 'Empresa',
          projectName: t.isExtraordinary ? 'Sin proyecto' : proj?.name || 'Proyecto',
          isExtraordinary: Boolean(t.isExtraordinary),
        });
      }
    });

    // 2. Fusionar tareas remotas de Firestore para este userId
    remoteTasks.forEach((rt) => {
      if (rt.status !== 'completed' && !merged.has(rt.id)) {
        const cli = clients.find((c) => c.id === rt.companyId);
        const proj = projects.find((p) => p.id === rt.projectId);
        merged.set(rt.id, {
          id: rt.id,
          title: rt.title,
          companyName: cli?.name || (rt.companyId ? 'Empresa' : 'Extraordinaria'),
          projectName: proj?.name || 'Actividad asignada',
          isExtraordinary: !rt.companyId,
        });
      }
    });

    return Array.from(merged.values());
  }, [user?.id, tasks, assignments, remoteTasks, projects, clients]);

  // Inicializar distribución al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      if (activeTaskId && availableTasks.some((t) => t.id === activeTaskId)) {
        initial[activeTaskId] = totalShiftMinutes;
      }
      setAllocatedMinutes(initial);
      setCapWarning('');
      setIsAddingExtraordinary(false);
      setExtraTitle('');
      const initialRem = activeTaskId && initial[activeTaskId] ? 0 : totalShiftMinutes;
      setExtraHours(Math.floor(initialRem / 60));
      setExtraMinutes(initialRem % 60);
    }
  }, [isOpen, activeTaskId, totalShiftMinutes]);

  const assignedMinutes = useMemo(() => {
    return Object.values(allocatedMinutes).reduce(
      (acc, m) => acc + Math.max(0, Math.round(m || 0)),
      0
    );
  }, [allocatedMinutes]);

  const remainingMinutes = totalShiftMinutes - assignedMinutes;
  const isOverflow = assignedMinutes > totalShiftMinutes;
  const isFullDistributed = remainingMinutes <= 0;

  // Cerrar formulario extraordinario automáticamente si el disponible llega a 0h 00m
  useEffect(() => {
    if (isFullDistributed && isAddingExtraordinary) {
      setIsAddingExtraordinary(false);
    }
  }, [isFullDistributed, isAddingExtraordinary]);

  const distributionSegments = useMemo(() => {
    return availableTasks
      .map((t) => ({
        id: t.id,
        label: t.title,
        minutes: allocatedMinutes[t.id] || 0,
      }))
      .filter((s) => s.minutes > 0);
  }, [availableTasks, allocatedMinutes]);

  if (!isOpen) return null;

  // Hard Cap matemático por tarea: maxAllowedForTask_i = totalShiftMinutes - sum_{j != i} taskMinutes_j
  const handleUpdateTaskTime = (taskId: string, rawHours: number, rawMinutes: number) => {
    const safeH = Math.max(0, Math.floor(rawHours || 0));
    const safeM = Math.max(0, Math.min(59, Math.floor(rawMinutes || 0)));
    const requestedMinutes = safeH * 60 + safeM;

    const otherTasksMinutes = Object.entries(allocatedMinutes).reduce(
      (acc, [id, mins]) => (id === taskId ? acc : acc + Math.max(0, Math.round(mins || 0))),
      0
    );
    const maxAllowedForTask = Math.max(0, totalShiftMinutes - otherTasksMinutes);

    if (requestedMinutes > maxAllowedForTask) {
      setAllocatedMinutes((prev) => ({
        ...prev,
        [taskId]: maxAllowedForTask,
      }));
      setCapWarning(
        `Tope de jornada alcanzado: el máximo disponible para esta actividad es ${formatMinutesSexagesimal(
          maxAllowedForTask
        )} (jornada total: ${formatMinutesSexagesimal(totalShiftMinutes)}).`
      );
      return;
    }

    setCapWarning('');
    setAllocatedMinutes((prev) => ({
      ...prev,
      [taskId]: requestedMinutes,
    }));
  };

  const handleAssignRemaining = (taskId: string) => {
    if (remainingMinutes <= 0) return;
    setCapWarning('');
    const current = allocatedMinutes[taskId] || 0;
    setAllocatedMinutes((prev) => ({
      ...prev,
      [taskId]: current + remainingMinutes,
    }));
  };

  const handleExtraTimeChange = (rawH: number, rawM: number) => {
    const safeH = Math.max(0, Math.floor(rawH || 0));
    const safeM = Math.max(0, Math.min(59, Math.floor(rawM || 0)));
    const req = safeH * 60 + safeM;
    const clamped = Math.min(req, Math.max(0, remainingMinutes));
    if (req > Math.max(0, remainingMinutes)) {
      setCapWarning(
        `No puedes asignar más del tiempo disponible (${formatMinutesSexagesimal(
          Math.max(0, remainingMinutes)
        )}).`
      );
    } else {
      setCapWarning('');
    }
    setExtraHours(Math.floor(clamped / 60));
    setExtraMinutes(clamped % 60);
  };

  const handleCreateExtraordinary = (e: React.FormEvent) => {
    e.preventDefault();
    if (remainingMinutes <= 0) {
      addToast('Has distribuido el 100% de tu jornada.', 'info');
      return;
    }
    if (!extraTitle.trim()) {
      addToast('Ingresa el título de la tarea extraordinaria.', 'error');
      return;
    }
    if (!user?.id) return;

    const requestedExtraMins = Math.max(0, extraHours * 60 + extraMinutes);
    const clampedExtraMins = Math.min(requestedExtraMins, Math.max(0, remainingMinutes));
    const plannedHours = Math.max(0.25, Number((clampedExtraMins / 60).toFixed(2)));

    const newTaskId = addExtraordinaryTask({
      name: extraTitle.trim(),
      description: 'Actividad extraordinaria registrada al cierre de jornada',
      plannedHours,
      category: 'Extraordinaria',
      userId: user.id,
      userName: `${user.name} ${user.lastName || ''}`.trim() || user.email,
    });

    if (clampedExtraMins > 0) {
      setAllocatedMinutes((prev) => ({
        ...prev,
        [newTaskId]: clampedExtraMins,
      }));
    }

    addToast(`Tarea extraordinaria "${extraTitle.trim()}" registrada.`, 'success');
    setExtraTitle('');
    setExtraHours(0);
    setExtraMinutes(0);
    setCapWarning('');
    setIsAddingExtraordinary(false);
  };

  const handleConfirm = async () => {
    const entries = Object.entries(allocatedMinutes)
      .filter(([, mins]) => mins > 0)
      .map(([taskId, minutes]) => ({ taskId, minutes: Math.round(minutes) }));

    // Validación matemática estricta antes de guardar
    const validation = validateShiftTimeDistribution(entries, totalShiftMinutes);
    if (!validation.valid) {
      setCapWarning(validation.error || 'El tiempo distribuido excede tu jornada.');
      addToast(validation.error || 'El tiempo distribuido excede tu jornada.', 'error');
      return;
    }

    if (entries.length === 0) {
      onCloseAsGeneral();
      return;
    }

    setIsSaving(true);
    try {
      const commitRes = await commitShiftTaskAllocationsToFirestore(
        entries.map((e) => ({
          taskId: e.taskId,
          minutes: e.minutes,
          cumulativeMinutes: Math.max(
            0,
            Math.round((taskActualHours[e.taskId] || 0) * 60) + e.minutes
          ),
        })),
        totalShiftMinutes
      );

      if (!commitRes.success) {
        setCapWarning(commitRes.error || 'No se pudo guardar la distribución de tiempo.');
        addToast(commitRes.error || 'Error al guardar tiempos de tareas.', 'error');
        return;
      }

      const allocationsInHours = entries.map((e) => ({
        taskId: e.taskId,
        hours: Number((e.minutes / 60).toFixed(4)),
      }));
      onConfirmCloseDay(allocationsInHours);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Resumen de Cierre de Jornada
            </div>
            <h3 className="text-lg font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white">
              Registro de Salida y Distribución de Tiempo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Distribuye el tiempo laborado entre tus actividades del día sin exceder tu jornada real ({formatMinutesSexagesimal(totalShiftMinutes)}).
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

        {/* Barra Visual Segmentada de Distribución de Jornada */}
        <TimeDistributionBar
          totalShiftMinutes={totalShiftMinutes}
          segments={distributionSegments}
          variant="adaptive"
        />

        {/* Aviso inline cuando se intenta rebasar la capacidad de la jornada */}
        {capWarning && (
          <div className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 px-3.5 py-2">
            {capWarning}
          </div>
        )}

        {/* Encabezado de Actividades + Acción Rápida */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Actividades de la jornada ({availableTasks.length})
            </span>

            {isFullDistributed ? (
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Has distribuido el 100% de tu jornada
              </span>
            ) : (
              <button
                type="button"
                disabled={isFullDistributed}
                onClick={() => {
                  const nextOpen = !isAddingExtraordinary;
                  setIsAddingExtraordinary(nextOpen);
                  if (nextOpen) {
                    const rem = Math.max(0, remainingMinutes);
                    setExtraHours(Math.floor(rem / 60));
                    setExtraMinutes(rem % 60);
                  }
                }}
                className="text-xs font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAddingExtraordinary
                  ? 'Cancelar registro'
                  : '+ Registrar Tarea Extraordinaria'}
              </button>
            )}
          </div>

          {/* Formulario compacto para crear tarea extraordinaria */}
          {isAddingExtraordinary && !isFullDistributed && (
            <form
              onSubmit={handleCreateExtraordinary}
              className="bg-slate-50 dark:bg-[#090E17] border border-slate-200 dark:border-slate-700 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Nueva Actividad Extraordinaria (Sin proyecto asignado)
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Máx. disponible: {formatMinutesSexagesimal(Math.max(0, remainingMinutes))}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Descripción de la actividad
                  </label>
                  <input
                    type="text"
                    value={extraTitle}
                    onChange={(e) => setExtraTitle(e.target.value)}
                    placeholder="Ej. Apoyo administrativo o reunión interna"
                    className="w-full bg-white dark:bg-[#101726] text-xs text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 px-3 py-2 focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Horas
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={Math.floor(Math.max(0, remainingMinutes) / 60)}
                    value={extraHours}
                    onChange={(e) =>
                      handleExtraTimeChange(Number(e.target.value), extraMinutes)
                    }
                    className="w-full bg-white dark:bg-[#101726] font-mono text-xs text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-center focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Min (0-59)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={extraMinutes}
                    onChange={(e) =>
                      handleExtraTimeChange(extraHours, Number(e.target.value))
                    }
                    className="w-full bg-white dark:bg-[#101726] font-mono text-xs text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-center focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Contenedor / Tabla de Tareas (O estado vacío sobrio sin datos ficticios) */}
          <div className="border border-slate-200 dark:border-slate-800 divide-y divide-slate-200/70 dark:divide-slate-800/60 max-h-60 overflow-y-auto">
            {isLoadingRemote && availableTasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Consultando actividades asignadas...
              </div>
            ) : availableTasks.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  No tienes tareas asignadas registradas en esta jornada.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Puedes registrar una actividad extraordinaria con el botón superior o confirmar tu salida como jornada general.
                </p>
              </div>
            ) : (
              availableTasks.map((task) => {
                const mins = allocatedMinutes[task.id] || 0;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const maxForThisTask = Math.max(0, remainingMinutes + mins);

                return (
                  <div
                    key={task.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#101726]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {task.companyName} · {task.projectName}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={Math.floor(maxForThisTask / 60)}
                          value={h}
                          onChange={(e) =>
                            handleUpdateTaskTime(task.id, Number(e.target.value), m)
                          }
                          aria-label={`Horas para ${task.title}`}
                          className="w-12 bg-slate-50 dark:bg-[#090E17] font-mono text-xs text-center text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 py-1 focus:outline-none focus:border-blue-600"
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
                          className="w-12 bg-slate-50 dark:bg-[#090E17] font-mono text-xs text-center text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 py-1 focus:outline-none focus:border-blue-600"
                        />
                        <span className="text-[11px] font-mono text-slate-500">m</span>
                      </div>

                      {remainingMinutes > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAssignRemaining(task.id)}
                          className="px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-sky-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Asignar el tiempo restante de la jornada"
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

        {/* Acciones finales */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCloseAsGeneral}
            disabled={isSaving}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer disabled:opacity-50"
          >
            Confirmar salida con 0 tareas (Jornada General)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              disabled={isOverflow || isSaving}
              onClick={() => void handleConfirm()}
              className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving
                ? 'Guardando...'
                : assignedMinutes > 0
                ? `Confirmar Salida (${formatMinutesSexagesimal(assignedMinutes)})`
                : 'Confirmar Salida'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
