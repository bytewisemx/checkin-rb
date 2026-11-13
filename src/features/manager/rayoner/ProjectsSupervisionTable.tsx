import { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  ListTodo, 
  FileText, 
  UserPlus 
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import type { Project, TeamMember } from '../../../types/rayoner';
import { RayonerProjectModal } from './RayonerProjectModal';
import { ProjectTeamAssignmentModal } from './ProjectTeamAssignmentModal';
import { ProjectTasksDrawerModal } from './ProjectTasksDrawerModal';
import { ProjectExecutiveReportModal } from './ProjectExecutiveReportModal';

interface ProjectsSupervisionTableProps {
  onOpenTaskModal: (taskId?: string | null, projectId?: string | null) => void;
  onSelectProjectForReport?: (projectId: string) => void;
}

export function ProjectsSupervisionTable({
  onOpenTaskModal,
  onSelectProjectForReport,
}: ProjectsSupervisionTableProps) {
  const {
    projects,
    clients,
    tasks,
    assignments,
    teamMembers,
    taskActualHours,
    activeWorkers,
  } = useRayonerStore();

  // Estados de filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'overbudget' | 'warning' | 'normal'>('all');

  // Modales
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProjectIdForEdit, setSelectedProjectIdForEdit] = useState<string | null>(null);

  const [teamAssignmentProject, setTeamAssignmentProject] = useState<Project | null>(null);
  const [tasksDrawerProject, setTasksDrawerProject] = useState<Project | null>(null);
  const [reportModalProject, setReportModalProject] = useState<Project | null>(null);

  // Mapeo y cálculo por proyecto
  const enrichedProjects = useMemo(() => {
    return projects.map((project) => {
      const client = clients.find((c) => c.id === project.clientId);
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      
      // Total de horas consumidas
      const consumedHours = projectTasks.reduce(
        (acc, t) => acc + (taskActualHours[t.id] || 0),
        0
      );
      const budgetHours = project.totalBudgetHours || 1;
      const percent = Math.round((consumedHours / budgetHours) * 100);

      // Estado presupuestal
      const isOverBudget = percent >= 100;
      const isWarning = percent >= 80 && percent < 100;

      // Colaboradores asignados al proyecto
      const assignedIds = new Set<string>(project.assignedUserIds || []);
      if (project.leadUserId) assignedIds.add(project.leadUserId);
      projectTasks.forEach((t) => {
        if (t.assigned_to) assignedIds.add(t.assigned_to);
        const taskAssignees = assignments.filter((a) => a.taskId === t.id);
        taskAssignees.forEach((a) => assignedIds.add(a.userId));
      });

      const assignedMembers: TeamMember[] = Array.from(assignedIds)
        .map((id) => teamMembers.find((m) => m.id === id))
        .filter((m): m is TeamMember => Boolean(m));

      // Trabajador activo en vivo en este proyecto
      const activeWorker = activeWorkers.find((w) => {
        if (w.projectName === project.name) return true;
        return projectTasks.some((t) => t.id === w.taskId);
      });

      return {
        project,
        client,
        consumedHours,
        budgetHours,
        percent,
        isOverBudget,
        isWarning,
        assignedMembers,
        activeWorker,
      };
    });
  }, [projects, clients, tasks, assignments, teamMembers, taskActualHours, activeWorkers]);

  // Filtrado de la tabla
  const filteredProjects = useMemo(() => {
    return enrichedProjects.filter(({ project, client, assignedMembers, percent }) => {
      // 1. Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchProject = project.name.toLowerCase().includes(q) || project.code.toLowerCase().includes(q);
        const matchClient = client?.name.toLowerCase().includes(q);
        const matchMember = assignedMembers.some(
          (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        );
        if (!matchProject && !matchClient && !matchMember) return false;
      }

      // 2. Filtro de presupuesto
      if (budgetFilter === 'overbudget' && percent < 100) return false;
      if (budgetFilter === 'warning' && (percent < 80 || percent >= 100)) return false;
      if (budgetFilter === 'normal' && percent >= 80) return false;

      return true;
    });
  }, [enrichedProjects, searchQuery, budgetFilter]);

  const handleOpenReport = (project: Project) => {
    if (onSelectProjectForReport) {
      onSelectProjectForReport(project.id);
    } else {
      setReportModalProject(project);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Barra de Filtros y Acciones Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar proyecto, cliente o colaborador..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
          />
        </div>

        {/* Filtro y Botón Nuevo Proyecto */}
        <div className="flex items-center gap-2">
          <select
            value={budgetFilter}
            onChange={(e) => setBudgetFilter(e.target.value as any)}
            className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:border-blue-600 transition"
          >
            <option value="all">Todos los presupuestos</option>
            <option value="overbudget">Sobregiro (&gt;100%)</option>
            <option value="warning">En observación (≥80%)</option>
            <option value="normal">En margen (&lt;80%)</option>
          </select>

          <button
            type="button"
            data-tour="btn-new-project"
            onClick={() => {
              setSelectedProjectIdForEdit(null);
              setIsProjectModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Proyecto
          </button>
        </div>
      </div>

      {/* Tabla de Supervisión */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-4 min-w-[220px]">Proyecto / Cliente</th>
                <th className="p-4 whitespace-nowrap">Equipo Asignado</th>
                <th className="p-4 min-w-[180px]">Consumo de Horas</th>
                <th className="p-4 whitespace-nowrap">Estado</th>
                <th className="p-4 whitespace-nowrap">Actividad en Vivo</th>
                <th className="p-4 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredProjects.map(
                ({
                  project,
                  client,
                  consumedHours,
                  budgetHours,
                  percent,
                  isOverBudget,
                  isWarning,
                  assignedMembers,
                  activeWorker,
                }) => {
                  const avatarPalette = [
                    'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
                  ];

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Proyecto / Cliente */}
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {project.name}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {client?.name || 'Cliente Particular'} • {project.code}
                          </span>
                        </div>
                      </td>

                      {/* 2. Equipo Asignado */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2 overflow-hidden">
                            {assignedMembers.slice(0, 3).map((m, idx) => {
                              const initials = m.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase();
                              const colorClass = avatarPalette[idx % avatarPalette.length];

                              return (
                                <div
                                  key={m.id}
                                  title={`${m.name} (${m.roleTitle || 'Colaborador'})`}
                                  className={`inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-900 ${colorClass} flex items-center justify-center text-xs font-bold shrink-0 select-none`}
                                >
                                  {initials}
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            data-tour="project-actions-team"
                            onClick={() => setTeamAssignmentProject(project)}
                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline ml-1 cursor-pointer"
                            title="Gestionar asignaciones del equipo"
                          >
                            Gestionar ({assignedMembers.length})
                          </button>
                        </div>
                      </td>

                      {/* 3. Consumo de Horas (Presupuesto vs. Real) */}
                      <td className="p-4" data-tour="project-card-metrics">
                        <div className="w-full max-w-[200px]">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {consumedHours}h / {budgetHours}h
                            </span>
                            <span
                              className={`font-bold ${
                                isOverBudget
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isWarning
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {percent}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                isOverBudget
                                  ? 'bg-rose-500'
                                  : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-blue-600 dark:bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 4. Estado */}
                      <td className="p-4">
                        {isOverBudget ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50">
                            Sobregiro
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                            En observación
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50">
                            En curso
                          </span>
                        )}
                      </td>

                      {/* 5. Actividad en Vivo */}
                      <td className="p-4">
                        {activeWorker ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-100 dark:border-emerald-900/50">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>
                              {activeWorker.userName} ({activeWorker.currentDurationStr})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* 6. Acciones de Supervisión */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botón Asignar / Revocar */}
                          <button
                            type="button"
                            onClick={() => setTeamAssignmentProject(project)}
                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Asignar colaboradores"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>

                          {/* Botón Desglose de Tareas */}
                          <button
                            type="button"
                            onClick={() => setTasksDrawerProject(project)}
                            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Ver tareas del proyecto"
                          >
                            <ListTodo className="w-4 h-4" />
                          </button>

                          {/* Botón Ver Reporte */}
                          <button
                            type="button"
                            onClick={() => handleOpenReport(project)}
                            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Ver reporte ejecutivo de tiempos"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                    No se encontraron proyectos con los criterios de búsqueda o filtro seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Crear o Editar Proyecto */}
      <RayonerProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setSelectedProjectIdForEdit(null);
        }}
        projectId={selectedProjectIdForEdit}
      />

      {/* Modal para Asignar / Gestionar Equipo del Proyecto */}
      <ProjectTeamAssignmentModal
        isOpen={Boolean(teamAssignmentProject)}
        onClose={() => setTeamAssignmentProject(null)}
        project={teamAssignmentProject}
      />

      {/* Drawer para Ver Desglose de Tareas */}
      <ProjectTasksDrawerModal
        isOpen={Boolean(tasksDrawerProject)}
        onClose={() => setTasksDrawerProject(null)}
        project={tasksDrawerProject}
        onOpenTaskModal={onOpenTaskModal}
      />

      {/* Modal de Reporte Ejecutivo */}
      <ProjectExecutiveReportModal
        isOpen={Boolean(reportModalProject)}
        onClose={() => setReportModalProject(null)}
        project={reportModalProject}
      />
    </div>
  );
}
