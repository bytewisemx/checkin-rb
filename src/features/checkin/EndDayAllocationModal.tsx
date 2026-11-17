import { useState, useMemo, useEffect } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { formatMinutesSexagesimal } from '../../services/attendanceService';
import { fetchTasksByAssignee, updateTaskProgressInFirestore, type TaskDocument } from '../../services/taskService';

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
    addExtraordinaryTask,
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const addToast = useCheckinStore((state) => state.addToast);

  // Tareas consultadas directamente en Firestore para el userId actual
  const [remoteTasks, setRemoteTasks] = useState<TaskDocument[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  // Minutos enteros asignados por tarea: taskId -> minutos enteros
  const [allocatedMinutes, setAllocatedMinutes] = useState<Record<string, number>>({});

  // Subformulario compacto para registrar tarea extraordinaria
  const [isAddingExtraordinary, setIsAddingExtraordinary] = useState(false);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraHours, setExtraHours] = useState<number>(0);
  const [extraMinutes, setExtraMinutes] = useState<number>(30);

  const totalDayMinutes = useMemo(() => {
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
        initial[activeTaskId] = totalDayMinutes;
      }
      setAllocatedMinutes(initial);
      setIsAddingExtraordinary(false);
      setExtraTitle('');
      setExtraHours(Math.floor(totalDayMinutes / 60));
      setExtraMinutes(totalDayMinutes % 60);
    }
  }, [isOpen, activeTaskId, totalDayMinutes]);

  const sumAllocatedMinutes = useMemo(() => {
    return Object.values(allocatedMinutes).reduce(
      (acc, m) => acc + Math.max(0, Math.round(m || 0)),
      0
    );
  }, [allocatedMinutes]);

  const remainingMinutes = totalDayMinutes - sumAllocatedMinutes;

  if (!isOpen) return null;

  const handleUpdateTaskTime = (taskId: string, hours: number, minutes: number) => {
    const safeH = Math.max(0, Math.min(12, Math.floor(hours || 0)));
    const safeM = Math.max(0, Math.min(59, Math.floor(minutes || 0)));
    setAllocatedMinutes((prev) => ({
      ...prev,
      [taskId]: safeH * 60 + safeM,
    }));
  };

  const handleAssignRemaining = (taskId: string) => {
    if (remainingMinutes <= 0) return;
    const current = allocatedMinutes[taskId] || 0;
    setAllocatedMinutes((prev) => ({
      ...prev,
      [taskId]: current + remainingMinutes,
    }));
  };

  const handleCreateExtraordinary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraTitle.trim()) {
      addToast('Ingresa el título de la tarea extraordinaria.', 'error');
      return;
    }
    if (!user?.id) return;

    const totalExtraMins = Math.max(0, Math.min(12, extraHours) * 60 + Math.min(59, extraMinutes));
    const plannedHours = Math.max(0.25, Number((totalExtraMins / 60).toFixed(2)));

    const newTaskId = addExtraordinaryTask({
      name: extraTitle.trim(),
      description: 'Actividad extraordinaria registrada al cierre de jornada',
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

    addToast(`Tarea extraordinaria "${extraTitle.trim()}" registrada.`, 'success');
    setExtraTitle('');
    setExtraHours(0);
    setExtraMinutes(0);
    setIsAddingExtraordinary(false);
  };

  const handleConfirm = () => {
    const entries = Object.entries(allocatedMinutes).filter(([, mins]) => mins > 0);

    if (entries.length === 0) {
      onCloseAsGeneral();
      return;
    }

    // Actualizar minutos enteros en Firestore para cada tarea imputada
    entries.forEach(([taskId, mins]) => {
      void updateTaskProgressInFirestore(taskId, {
        loggedMinutes: Math.max(0, Math.round(mins)),
      });
    });

    const allocationsInHours = entries.map(([taskId, mins]) => ({
      taskId,
      hours: Number((mins / 60).toFixed(4)),
    }));
    onConfirmCloseDay(allocationsInHours);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-6">
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
              Asigna el tiempo trabajado a tus actividades del día o registra una tarea extraordinaria si lo requieres.
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

        {/* Barra de resumen en formato sexagesimal Xh Ym */}
        <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-[#090E17] p-4 border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Jornada Total
            </span>
            <span className="text-xl font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white">
              {formatMinutesSexagesimal(totalDayMinutes)}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Tiempo Asignado
            </span>
            <span className="text-xl font-bold font-['Space_Grotesk'] text-blue-700 dark:text-sky-400">
              {formatMinutesSexagesimal(sumAllocatedMinutes)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {remainingMinutes >= 0 ? 'Sin Asignar' : 'Excedente'}
            </span>
            <span
              className={`text-xl font-bold font-['Space_Grotesk'] ${
                remainingMinutes < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {formatMinutesSexagesimal(Math.abs(remainingMinutes))}
            </span>
          </div>
        </div>

        {/* Encabezado de Actividades + Acción Rápida */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Actividades de la jornada ({availableTasks.length})
            </span>
            <button
              type="button"
              onClick={() => setIsAddingExtraordinary((v) => !v)}
              className="text-xs font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer"
            >
              {isAddingExtraordinary
                ? 'Cancelar registro'
                : '+ Registrar Tarea Extraordinaria'}
            </button>
          </div>

          {/* Formulario compacto para crear tarea extraordinaria */}
          {isAddingExtraordinary && (
            <form
              onSubmit={handleCreateExtraordinary}
              className="bg-slate-50 dark:bg-[#090E17] border border-slate-200 dark:border-slate-700 p-4 space-y-3"
            >
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Nueva Actividad Extraordinaria (Sin proyecto asignado)
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
                    max={12}
                    value={extraHours}
                    onChange={(e) => setExtraHours(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
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
                    onChange={(e) => setExtraMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
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
                          max={12}
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
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
          >
            Confirmar salida con 0 tareas (Jornada General)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition cursor-pointer"
            >
              {sumAllocatedMinutes > 0
                ? `Confirmar Salida (${formatMinutesSexagesimal(sumAllocatedMinutes)})`
                : 'Confirmar Salida'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
