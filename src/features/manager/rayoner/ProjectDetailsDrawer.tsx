import { useMemo } from 'react';
import {
  X,
  Building2,
  Calendar,
  Users,
  Clock,
  ListTodo,
  FileEdit,
  ShieldCheck,
} from 'lucide-react';
import type { Project, Client, TaskNode, TeamMember } from '../../../types/rayoner';
import { RankMedal } from '../../../components/common/RankMedal';
import { formatMinutesSexagesimal } from '../../../services/attendanceService';
import type { RankTier } from '../../../services/gamification';

interface ProjectDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  client?: Client | null;
  projectTasks: TaskNode[];
  teamMembers: TeamMember[];
  onOpenTasksDrawer?: () => void;
}

export function ProjectDetailsDrawer({
  isOpen,
  onClose,
  project,
  client,
  projectTasks,
  teamMembers,
  onOpenTasksDrawer,
}: ProjectDetailsDrawerProps) {
  if (!isOpen || !project) return null;

  // Cálculos de horas presupuestadas vs. horas ejercidas (sin costos monetarios)
  const budgetedHours = project.totalBudgetHours || project.plannedHours || (project.plannedMinutes ? project.plannedMinutes / 60 : 0);
  const consumedMinutes = useMemo(() => {
    return projectTasks.reduce((acc, t) => {
      const taskMinutes = t.loggedMinutes || (t.totalActualHours ? t.totalActualHours * 60 : (t.actualHours ? t.actualHours * 60 : 0));
      return acc + taskMinutes;
    }, 0);
  }, [projectTasks]);

  const consumedHours = Number((consumedMinutes / 60).toFixed(1));
  const percent = budgetedHours > 0 ? Math.round((consumedHours / budgetedHours) * 100) : 0;
  const hourDifference = Number((consumedHours - budgetedHours).toFixed(1));
  const isOverBudget = consumedHours > budgetedHours && budgetedHours > 0;
  const isWarning = percent >= 80 && !isOverBudget;

  // Integrantes asignados
  const assignedMemberIds = useMemo(() => {
    const set = new Set<string>();
    if (project.assignedUserIds) {
      project.assignedUserIds.forEach((id) => set.add(id));
    }
    if (project.leadUserId) set.add(project.leadUserId);
    if (project.partnerId) set.add(project.partnerId);

    // Sumar usuarios asignados a tareas del proyecto
    projectTasks.forEach((t) => {
      if (t.assignedToId) set.add(t.assignedToId);
      if (t.assignedToIds) t.assignedToIds.forEach((id) => set.add(id));
      if (t.assignedUserIds) t.assignedUserIds.forEach((id) => set.add(id));
    });
    return Array.from(set);
  }, [project, projectTasks]);

  const assignedMembers = useMemo(() => {
    return assignedMemberIds
      .map((id) => teamMembers.find((m) => m.id === id))
      .filter((m): m is TeamMember => Boolean(m));
  }, [assignedMemberIds, teamMembers]);

  // Responsables oficiales
  const leadMember = teamMembers.find(
    (m) => m.id === project.leadUserId || m.name === project.leadUserName
  );
  const partnerMember = teamMembers.find((m) => m.id === (project as any).partnerId || m.role === 'Socio');

  // Conteo de actividades completadas y modificadas manualmente
  const completedTasksCount = useMemo(
    () => projectTasks.filter((t) => t.status === 'completed').length,
    [projectTasks]
  );
  const manuallyModifiedCount = useMemo(
    () => projectTasks.filter((t) => t.isManuallyModified).length,
    [projectTasks]
  );

  // Desglose resumido por Rubros (si es auditoría) o actividades clave
  const rubrosSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; completed: number; manual: number }>();
    projectTasks.forEach((t) => {
      const rubroName = t.rubro || (typeof t.rubroNumber === 'number' ? `Rubro ${t.rubroNumber}` : 'Actividades Generales');
      const cur = map.get(rubroName) || { name: rubroName, total: 0, completed: 0, manual: 0 };
      cur.total++;
      if (t.status === 'completed') cur.completed++;
      if (t.isManuallyModified) cur.manual++;
      map.set(rubroName, cur);
    });
    return Array.from(map.values());
  }, [projectTasks]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs animate-fade-in flex justify-end">
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col h-full overflow-hidden text-slate-900 dark:text-slate-100">
        {/* 1. Cabecera Fija del Drawer */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-sky-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/80 dark:border-blue-800">
                {project.code || `PRJ-${project.id.substring(0, 6).toUpperCase()}`}
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isOverBudget
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900'
                    : isWarning
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
                    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900'
                }`}
              >
                {isOverBudget ? 'Sobregiro' : isWarning ? 'En Alerta (>80%)' : 'En Curso'}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {project.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {client?.commercialName || client?.name || project.companyName || 'Empresa Cliente'}
              </span>
              {project.startDate && (
                <>
                  <span>•</span>
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Inicio: {project.startDate}</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Cuerpo Deslizable con Scroll Interno Fluido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tarjeta de Resumen Operativo de Horas (Sin Costos Monetarios) */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-700 dark:text-sky-400" />
                <span>Control de Horas Operativas</span>
              </span>
              <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                {percent}% ejercido
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Presupuestadas
                </span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                  {budgetedHours.toFixed(1)}h
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Ejercidas
                </span>
                <span className="text-base font-bold font-mono text-blue-700 dark:text-sky-400">
                  {consumedHours.toFixed(1)}h
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Variación
                </span>
                <span
                  className={`text-base font-bold font-mono ${
                    hourDifference > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {hourDifference > 0 ? `+${hourDifference}` : hourDifference}h
                </span>
              </div>
            </div>

            {/* Barra de Progreso */}
            <div className="space-y-1">
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isOverBudget
                      ? 'bg-rose-600'
                      : isWarning
                      ? 'bg-amber-500'
                      : 'bg-blue-700 dark:bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Tiempo total registrado: {formatMinutesSexagesimal(consumedMinutes)}</span>
                <span>Margen restante: {Math.max(0, Number((budgetedHours - consumedHours).toFixed(1)))}h</span>
              </div>
            </div>
          </div>

          {/* Responsables del Servicio */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Liderazgo y Supervisión
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center space-x-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg">
                  <ShieldCheck className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Encargado del Servicio
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {leadMember?.name || project.leadUserName || 'Por asignar'}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {leadMember?.role || 'Líder Operativo'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center space-x-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg">
                  <Users className="w-4 h-4 stroke-[2]" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Socio de Auditoría
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {partnerMember?.name || 'Socio Responsable'}
                  </p>
                  <span className="text-[10px] text-slate-500">Socio de la Firma</span>
                </div>
              </div>
            </div>
          </div>

          {/* Integrantes Asignados con Medallas de Rendimiento */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Equipo Asignado ({assignedMembers.length})
              </h3>
              <span className="text-[11px] text-slate-400">Medalla mensual</span>
            </div>

            {assignedMembers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Sin colaboradores asignados a este proyecto.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-850 overflow-hidden">
                {assignedMembers.map((m) => {
                  const medalTier = (m.currentRank || 'bronce') as RankTier;
                  return (
                    <div
                      key={m.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {m.photoURL || m.avatar ? (
                          <img
                            src={m.photoURL || m.avatar}
                            alt={m.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {m.name}
                          </p>
                          <span className="text-[10px] text-slate-400 truncate block">
                            {m.role || 'Colaborador'} {m.team ? `• ${m.team}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Medalla Oficial de Rendimiento */}
                      <div className="shrink-0">
                        <RankMedal tier={medalTier} size="xs" variant="badge" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desglose por Rubros / Actividades y Modificaciones Manuales */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Resumen de Avance por Rubros / Actividades
              </h3>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {completedTasksCount} / {projectTasks.length} concluidas
                </span>
                {manuallyModifiedCount > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                    <FileEdit className="w-3 h-3" />
                    <span>{manuallyModifiedCount} manuales</span>
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {rubrosSummary.map((r, idx) => {
                const rPercent = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
                return (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                        {r.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.manual > 0 && (
                          <span className="text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                            <FileEdit className="w-2.5 h-2.5" />
                            <span>Modificado manual</span>
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {r.completed}/{r.total} ({rPercent}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-blue-700 dark:bg-blue-500 transition-all"
                        style={{ width: `${rPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Pie Fijo del Drawer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          {onOpenTasksDrawer && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTasksDrawer();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-lg shadow-xs hover:shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <ListTodo className="w-4 h-4" />
              <span>Ver Desglose Completo de Actividades</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
