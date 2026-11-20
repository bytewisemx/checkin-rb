import { useMemo } from 'react';
import { X, Plus, Clock, User, Edit2, ListTodo } from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { CompanyLogoBadge } from '../../../components/common/CompanyLogoBadge';
import { formatMinutesSexagesimal } from '../../../services/attendanceService';
import type { Project, TaskNode } from '../../../types/rayoner';

interface ProjectTasksDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onOpenTaskModal: (taskId?: string | null, projectId?: string | null) => void;
}

export function ProjectTasksDrawerModal({
  isOpen,
  onClose,
  project,
  onOpenTaskModal,
}: ProjectTasksDrawerModalProps) {
  const { tasks, taskActualHours, teamMembers, clients, updateTask } = useRayonerStore();

  const projectTasks = useMemo(() => {
    if (!project) return [];
    return tasks.filter((t) => t.projectId === project.id);
  }, [project, tasks]);

  const client = useMemo(() => {
    if (!project) return null;
    return clients.find((c) => c.id === project.clientId) || null;
  }, [project, clients]);

  if (!isOpen || !project) return null;

  const totalActualHours = projectTasks.reduce(
    (acc, t) => acc + (taskActualHours[t.id] || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-hidden animate-slide-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Drawer */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <CompanyLogoBadge
                name={client?.name}
                commercialName={client?.commercialName}
                logoUrl={client?.logoUrl}
                size="md"
                className="mt-1"
              />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <ListTodo className="w-4 h-4 shrink-0" />
                  <span>Desglose de Tareas</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {project.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {client?.commercialName || client?.name || 'Empresa'} • {project.code}
                  {client?.startDate ? ` • Inicio: ${client.startDate}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Resumen de Presupuesto */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Total Consumido
              </span>
              <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                {totalActualHours}h / {project.totalBudgetHours}h
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onOpenTaskModal(null, project.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva Tarea
            </button>
          </div>
        </div>

        {/* Lista de Tareas */}
        <div className="flex-1 my-4 overflow-y-auto space-y-2.5 pr-1 no-scrollbar">
          {projectTasks.map((task: TaskNode) => {
            const actualMinutes =
              task.loggedMinutes !== undefined
                ? Math.max(0, Math.round(task.loggedMinutes))
                : Math.max(0, Math.round((taskActualHours[task.id] || 0) * 60));
            const plannedMinutes =
              task.plannedMinutes !== undefined
                ? Math.max(0, Math.round(task.plannedMinutes))
                : Math.max(0, Math.round((task.plannedHours || 0) * 60));
            const percent =
              plannedMinutes > 0 ? Math.round((actualMinutes / plannedMinutes) * 100) : 0;
            const isOver = percent >= 100;
            const isAlert = percent >= 80 && percent < 100;

            const rawAssigned = Array.isArray(task.assignedUserIds) && task.assignedUserIds.length > 0
              ? task.assignedUserIds
              : Array.isArray(task.assignedToIds) && task.assignedToIds.length > 0
              ? task.assignedToIds
              : task.assignedToId || task.assigned_to
              ? [task.assignedToId || task.assigned_to!]
              : [];

            const assignedMembers = teamMembers.filter((m) => rawAssigned.includes(m.id));

            const effectiveLeadId =
              task.leadUserId ||
              task.assignedToId ||
              task.assigned_to ||
              rawAssigned[0] ||
              '';

            const leadMember = teamMembers.find((m) => m.id === effectiveLeadId);
            const leadDisplayName =
              task.leadUserName || leadMember?.name || task.assignedToName || 'Sin asignar';

            const handleReassignLead = (newLeadId: string) => {
              const target = teamMembers.find((m) => m.id === newLeadId);
              if (!target) return;
              updateTask(task.id, {
                leadUserId: target.id,
                leadUserName: target.name,
                assigned_to: target.id,
                assignedToId: target.id,
                assignedToName: target.name,
                assignedToEmail: (target.email || '').toLowerCase(),
              });
            };

            return (
              <div
                key={task.id}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {task.name}
                      </span>
                      {task.isExtraordinary && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Extraordinaria
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-sky-300 dark:border-blue-900">
                        Encargado: {leadDisplayName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {assignedMembers.length > 0
                          ? `${assignedMembers.length} participante(s)`
                          : '1 asignado'}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-medium tabular-nums">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatMinutesSexagesimal(actualMinutes)} / {formatMinutesSexagesimal(plannedMinutes)} ({percent}%)
                      </span>
                    </div>

                    {/* Selector rápido para reasignar encargado si hay múltiples participantes */}
                    {assignedMembers.length > 1 && (
                      <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-medium text-slate-400">Reasignar encargado:</span>
                        <select
                          value={effectiveLeadId}
                          onChange={(e) => handleReassignLead(e.target.value)}
                          className="text-[11px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-700"
                        >
                          {assignedMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Barra de progreso de la tarea */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-2 overflow-hidden">
                      <div
                        className={`h-1 rounded-full ${
                          isOver
                            ? 'bg-rose-500'
                            : isAlert
                            ? 'bg-amber-500'
                            : 'bg-blue-600 dark:bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenTaskModal(task.id, project.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Editar tarea"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {projectTasks.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-xs">
              <p>Este proyecto aún no tiene tareas creadas.</p>
              <button
                type="button"
                onClick={() => onOpenTaskModal(null, project.id)}
                className="mt-2 text-blue-600 hover:underline font-semibold"
              >
                + Crear primera tarea
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
