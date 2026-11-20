import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  ListTodo,
  FileText,
  UserPlus
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { canCreateOrManageCompanies } from '../../../services/companyService';
import type { Project, TeamMember } from '../../../types/rayoner';
import { CreateCompanyModal } from './CreateCompanyModal';
import { RayonerProjectModal } from './RayonerProjectModal';
import { ProjectTeamAssignmentModal } from './ProjectTeamAssignmentModal';
import { ProjectTasksDrawerModal } from './ProjectTasksDrawerModal';
import { ProjectExecutiveReportModal } from './ProjectExecutiveReportModal';
import { LiveTimerCell } from '../../../components/common/LiveTimerCell';
import { CompanyLogoBadge } from '../../../components/common/CompanyLogoBadge';
import { useLiveTeamTimers } from '../../../hooks/useLiveTeamTimers';

interface ProjectsSupervisionTableProps {
  onOpenTaskModal: (taskId?: string | null, projectId?: string | null) => void;
  onSelectProjectForReport?: (projectId: string) => void;
}

export function ProjectsSupervisionTable({
  onOpenTaskModal,
  onSelectProjectForReport,
}: ProjectsSupervisionTableProps) {
  useLiveTeamTimers();
  const {
    projects,
    clients,
    tasks,
    assignments,
    teamMembers,
    taskActualHours,
    activeWorkers,
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const canCreateCompany = canCreateOrManageCompanies(user?.role);

  // Estados de filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'overbudget' | 'warning' | 'normal'>('all');

  // Modales
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProjectIdForEdit, setSelectedProjectIdForEdit] = useState<string | null>(null);
  const [preselectedClientIdForProject, setPreselectedClientIdForProject] = useState<string | null>(null);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        {/* Buscador */}
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar proyecto, cliente o colaborador..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-2 pl-9 pr-3 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-700 outline-none transition-colors"
          />
        </div>

        {/* Filtro y Botones de Acción Sobrios (+ Nueva Empresa y + Nuevo Proyecto) */}
        <div className="flex items-center gap-2.5">
          <select
            value={budgetFilter}
            onChange={(e) => setBudgetFilter(e.target.value as any)}
            className="h-9 text-xs font-medium border border-slate-200 dark:border-slate-800 rounded-lg px-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:border-blue-700 transition-colors"
          >
            <option value="all">Todos los presupuestos</option>
            <option value="overbudget">Sobregiro (&gt;100%)</option>
            <option value="warning">En observación (≥80%)</option>
            <option value="normal">En margen (&lt;80%)</option>
          </select>

          {canCreateCompany && (
            <button
              type="button"
              data-tour="btn-new-company"
              onClick={() => setIsCompanyModalOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
              <span>Nueva Empresa</span>
            </button>
          )}

          <button
            type="button"
            data-tour="btn-new-project"
            onClick={() => {
              setSelectedProjectIdForEdit(null);
              setPreselectedClientIdForProject(clients[0]?.id || null);
              setIsProjectModalOpen(true);
            }}
            className="h-9 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* Tira de Empresas / Clientes Registrados */}
      {canCreateCompany && clients.length > 0 && (
        <div className="w-full">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
            Empresas / Clientes Registrados ({clients.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {clients.map((company) => (
              <div
                key={company.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 rounded-xl p-3.5 transition-all flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyLogoBadge
                    name={company.name}
                    commercialName={company.commercialName}
                    logoUrl={company.logoUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">
                        {company.commercialName || company.name}
                      </span>
                      {company.code && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                          {company.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {company.startDate && <span>Inicio: {company.startDate}</span>}
                      {company.industry && (
                        <>
                          {company.startDate && <span>•</span>}
                          <span className="truncate max-w-[140px]">{company.industry}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectIdForEdit(null);
                    setPreselectedClientIdForProject(company.id);
                    setIsProjectModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 dark:text-sky-400 dark:hover:text-sky-300 hover:underline cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3 shrink-0" />
                  <span>Proyecto</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  const bluePalette = [
                    'bg-blue-700 text-white',
                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                    'bg-blue-600 text-white',
                    'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950 dark:text-blue-200',
                  ];

                  const formattedConsumed = Number(consumedHours).toFixed(1);
                  const formattedBudget = Number(budgetHours).toFixed(1);

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Proyecto / Cliente con Logotipo (o Monograma) y Fecha de Inicio */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <CompanyLogoBadge
                            name={client?.name}
                            commercialName={client?.commercialName}
                            logoUrl={client?.logoUrl}
                            size="sm"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {project.name}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {client?.commercialName || client?.name || 'Empresa'} • {project.code}
                              {client?.startDate ? ` • Inicio: ${client.startDate}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Equipo Asignado */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2 items-center shrink-0">
                            {assignedMembers.slice(0, 4).map((m, idx) => {
                              const initials = m.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase();
                              const colorClass = bluePalette[idx % bluePalette.length];
                              const photo = m.photoURL || (m as any).avatarUrl;

                              return (
                                <div
                                  key={m.id}
                                  title={`${m.name} (${m.roleTitle || 'Colaborador'})`}
                                  className={`w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden select-none ${!photo ? colorClass : ''}`}
                                >
                                  {photo ? (
                                    <img
                                      src={photo}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full rounded-full object-cover"
                                      alt={m.name}
                                    />
                                  ) : (
                                    <span>{initials}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            data-tour="project-actions-team"
                            onClick={() => setTeamAssignmentProject(project)}
                            className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900 dark:text-sky-400 dark:hover:text-sky-300 hover:underline whitespace-nowrap cursor-pointer"
                            title="Gestionar asignaciones del equipo"
                          >
                            Gestionar ({assignedMembers.length})
                          </button>
                        </div>
                      </td>

                      {/* 3. Consumo de Horas (Presupuesto vs. Real) */}
                      <td className="p-4" data-tour="project-card-metrics">
                        <div className="w-full max-w-[200px]">
                          <div className="flex justify-between items-center text-xs mb-1 tabular-nums">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {formattedConsumed}h / {formattedBudget}h
                            </span>
                            <span
                              className={`font-bold ${isOverBudget
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isWarning
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-blue-700 dark:text-blue-400'
                                }`}
                            >
                              {percent}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${isOverBudget
                                  ? 'bg-rose-600'
                                  : isWarning
                                    ? 'bg-amber-500'
                                    : 'bg-blue-700 dark:bg-blue-600'
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

                      {/* 5. Actividad en Vivo con Cronometraje en Tiempo Real */}
                      <td className="p-4">
                        {activeWorker ? (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-900/60 shadow-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[120px]" title={activeWorker.userName}>
                              {activeWorker.userName}
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <LiveTimerCell
                              startedAt={activeWorker.startedAt || activeWorker.startedAtMs}
                              accumulatedSeconds={activeWorker.accumulatedSeconds || 0}
                              isRunning={activeWorker.isRunning !== false}
                            />
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
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-xs space-y-3">
                    <div>
                      {projects.length === 0
                        ? clients.length === 0
                          ? 'No hay empresas ni proyectos registrados.'
                          : 'No hay proyectos registrados.'
                        : 'No se encontraron proyectos con los criterios de búsqueda o filtro seleccionados.'}
                    </div>
                    {projects.length === 0 && clients.length === 0 && canCreateCompany && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => setIsCompanyModalOpen(true)}
                          className="h-9 px-3.5 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                          <span>Nueva Empresa</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Sobrio para Alta de Empresa / Cliente (Solo Socio, Gerente y TI) */}
      <CreateCompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
      />

      {/* Modal para Crear o Editar Proyecto */}
      <RayonerProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setSelectedProjectIdForEdit(null);
          setPreselectedClientIdForProject(null);
        }}
        projectId={selectedProjectIdForEdit}
        initialClientId={preselectedClientIdForProject}
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
