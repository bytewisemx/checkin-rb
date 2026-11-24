import { useState, useMemo, useEffect, Fragment } from 'react';
import {
  Search,
  Plus,
  ListTodo,
  FileText,
  FileSpreadsheet,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Edit2
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { canCreateOrManageCompanies } from '../../../services/companyService';
import { formatMinutesSexagesimal } from '../../../services/attendanceService';
import { normalizeRole } from '../../../services/rbac';
import type { Project, TeamMember, TaskNode } from '../../../types/rayoner';
import { CreateCompanyModal } from './CreateCompanyModal';
import { RayonerProjectModal } from './RayonerProjectModal';
import { ProjectTeamAssignmentModal } from './ProjectTeamAssignmentModal';
import { ProjectTasksDrawerModal } from './ProjectTasksDrawerModal';
import { ProjectExecutiveReportModal } from './ProjectExecutiveReportModal';
import { AuditServiceAccordionView } from './AuditServiceAccordionView';
import { exportAuditPlanToExcel } from '../../../services/auditPlanExportService';
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
    updateTask,
  } = useRayonerStore();

  const user = useCheckinStore((state) => state.user);
  const canCreateCompany = canCreateOrManageCompanies(user?.role);

  // Estados de filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'overbudget' | 'warning' | 'normal'>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companyFilterText, setCompanyFilterText] = useState<string>('');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());

  // Modales
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProjectIdForEdit, setSelectedProjectIdForEdit] = useState<string | null>(null);
  const [preselectedClientIdForProject, setPreselectedClientIdForProject] = useState<string | null>(null);

  const [teamAssignmentProject, setTeamAssignmentProject] = useState<Project | null>(null);
  const [tasksDrawerProject, setTasksDrawerProject] = useState<Project | null>(null);
  const [reportModalProject, setReportModalProject] = useState<Project | null>(null);

  // Auto-selección por defecto: seleccionar automáticamente la primera empresa registrada al cargar la vista
  useEffect(() => {
    if (!selectedCompanyId && clients.length > 0) {
      setSelectedCompanyId(clients[0].id);
    }
  }, [clients, selectedCompanyId]);

  // Cliente actualmente seleccionado
  const selectedClient = useMemo(() => {
    if (!selectedCompanyId || selectedCompanyId === 'all') return null;
    return clients.find((c) => c.id === selectedCompanyId) || null;
  }, [clients, selectedCompanyId]);

  // Lista de empresas filtradas para el selector si hay más de 8
  const visibleClients = useMemo(() => {
    if (!companyFilterText.trim()) return clients;
    const q = companyFilterText.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.commercialName && c.commercialName.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q))
    );
  }, [clients, companyFilterText]);

  // Conmutador del acordeón de actividades por proyecto
  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

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

      // Colaboradores operativos asignados al proyecto (Socio y Gerente tienen acceso y supervisión por default)
      const eligibleOpIds = new Set(
        teamMembers
          .filter((m) => {
            const r = normalizeRole(m.role);
            const rawRole = (m.role || '').toLowerCase();
            const title = (m.roleTitle || '').toLowerCase();
            const email = (m.email || '').toLowerCase();
            const name = (m.name || '').toLowerCase();

            const isSocio =
              r === 'Socio' ||
              rawRole.includes('socio') ||
              rawRole.includes('partner') ||
              title.includes('socio') ||
              title.includes('partner') ||
              email.includes('socio.') ||
              name.includes('socio');

            const isGerente =
              r === 'Gerente' ||
              rawRole.includes('gerent') ||
              rawRole.includes('manager') ||
              title.includes('gerent') ||
              title.includes('manager') ||
              email.includes('gerente.') ||
              name.includes('gerente');

            const isRH =
              r === 'RH' ||
              rawRole.includes('rh') ||
              rawRole.includes('recursos') ||
              title.includes('rh') ||
              title.includes('recursos') ||
              email.includes('rh.');

            const isTI =
              r === 'TI' ||
              rawRole.includes('ti') ||
              rawRole.includes('tecnolog') ||
              rawRole.includes('sistemas') ||
              rawRole.includes('admin') ||
              title.includes('ti') ||
              title.includes('tecnolog') ||
              title.includes('sistemas') ||
              title.includes('admin') ||
              email.includes('ti.');

            return !isSocio && !isGerente && !isRH && !isTI;
          })
          .map((m) => m.id)
      );

      const assignedIds = new Set<string>();
      (project.assignedUserIds || []).forEach((id) => {
        if (eligibleOpIds.has(id)) assignedIds.add(id);
      });
      if (project.leadUserId && eligibleOpIds.has(project.leadUserId)) {
        assignedIds.add(project.leadUserId);
      }
      projectTasks.forEach((t) => {
        if (t.assigned_to && eligibleOpIds.has(t.assigned_to)) assignedIds.add(t.assigned_to);
        const taskAssignees = assignments.filter((a) => a.taskId === t.id);
        taskAssignees.forEach((a) => {
          if (eligibleOpIds.has(a.userId)) assignedIds.add(a.userId);
        });
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

  // Filtrado estricto de la tabla por empresa seleccionada, búsqueda y presupuesto
  const filteredProjects = useMemo(() => {
    return enrichedProjects.filter(({ project, client, assignedMembers, percent }) => {
      // 1. Filtrado estricto por empresa seleccionada (salvo que sea 'all')
      if (selectedCompanyId && selectedCompanyId !== 'all') {
        if (project.clientId !== selectedCompanyId) return false;
      }

      // 2. Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchProject = project.name.toLowerCase().includes(q) || project.code.toLowerCase().includes(q);
        const matchClient =
          client?.name.toLowerCase().includes(q) ||
          client?.commercialName?.toLowerCase().includes(q);
        const matchMember = assignedMembers.some(
          (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        );
        if (!matchProject && !matchClient && !matchMember) return false;
      }

      // 3. Filtro de presupuesto
      if (budgetFilter === 'overbudget' && percent < 100) return false;
      if (budgetFilter === 'warning' && (percent < 80 || percent >= 100)) return false;
      if (budgetFilter === 'normal' && percent >= 80) return false;

      return true;
    });
  }, [enrichedProjects, selectedCompanyId, searchQuery, budgetFilter]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
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
              setPreselectedClientIdForProject(
                selectedCompanyId && selectedCompanyId !== 'all' ? selectedCompanyId : (clients[0]?.id || null)
              );
              setIsProjectModalOpen(true);
            }}
            className="h-9 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* 1. Selector Compacto y Escalable de Empresas (Solo Nombre Destacado) */}
      {clients.length > 0 && (
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Empresas / Clientes Registrados ({clients.length})
            </h3>
            {clients.length > 8 && (
              <div className="relative w-48">
                <input
                  type="text"
                  value={companyFilterText}
                  onChange={(e) => setCompanyFilterText(e.target.value)}
                  placeholder="Filtrar empresas..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs py-1 px-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-700 transition-colors"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scroll-smooth">
            {/* Píldora Opcional: Todas (N) */}
            <button
              type="button"
              onClick={() => setSelectedCompanyId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                selectedCompanyId === 'all'
                  ? 'bg-blue-800 text-white border-blue-800 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:text-blue-800'
              }`}
            >
              <span>Todas</span>
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  selectedCompanyId === 'all' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                ({projects.length})
              </span>
            </button>

            {/* Píldoras por Empresa */}
            {visibleClients.map((company) => {
              const isSelected = selectedCompanyId === company.id;
              const companyProjectsCount = projects.filter((p) => p.clientId === company.id).length;
              const displayName = company.commercialName || company.name;
              const initials = displayName
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0]?.toUpperCase())
                .join('') || company.code?.slice(0, 2) || 'CL';

              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => setSelectedCompanyId(company.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-800 text-white border-blue-800 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:text-blue-800'
                  }`}
                >
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt=""
                      className="w-6 h-6 rounded object-contain bg-white shrink-0 p-0.5 border border-slate-200"
                    />
                  ) : (
                    <span
                      className={`w-6 h-6 rounded font-bold text-[10px] flex items-center justify-center shrink-0 tracking-tight ${
                        isSelected
                          ? 'bg-blue-900/80 text-white border border-blue-600/50'
                          : 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                      }`}
                    >
                      {initials}
                    </span>
                  )}
                  <span className="text-xs font-bold truncate max-w-[180px]">{displayName}</span>
                  <span
                    className={`text-[11px] font-bold tabular-nums ${
                      isSelected ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    ({companyProjectsCount})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Cabecera Contextual por Empresa Seleccionada */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
            {selectedCompanyId === 'all' ? 'Vista General:' : 'Proyectos y Servicios de:'}
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {selectedCompanyId === 'all'
              ? `Todas las Empresas (${clients.length})`
              : (selectedClient?.commercialName || selectedClient?.name || 'Empresa')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedProjectIdForEdit(null);
            setPreselectedClientIdForProject(
              selectedCompanyId && selectedCompanyId !== 'all' ? selectedCompanyId : (clients[0]?.id || null)
            );
            setIsProjectModalOpen(true);
          }}
          className="h-8 px-3 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>Nuevo Proyecto en esta Empresa</span>
        </button>
      </div>

      {/* 3. Tabla de Supervisión con Acordeón Expandible */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-4 min-w-[240px]">Proyecto / Cliente</th>
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
                  const isExpanded = expandedProjectIds.has(project.id);
                  const projectTasks = tasks.filter((t) => t.projectId === project.id);

                  const bluePalette = [
                    'bg-blue-700 text-white',
                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                    'bg-blue-600 text-white',
                    'bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950 dark:text-blue-200',
                  ];

                  const formattedConsumed = Number(consumedHours).toFixed(1);
                  const formattedBudget = Number(budgetHours).toFixed(1);

                  return (
                    <Fragment key={project.id}>
                      <tr
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                          isExpanded ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''
                        }`}
                      >
                        {/* 1. Proyecto / Cliente con Logotipo (o Monograma) y Toggle de Acordeón */}
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => toggleProjectExpand(project.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                              title={isExpanded ? 'Ocultar actividades' : 'Ver actividades'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <CompanyLogoBadge
                              name={client?.name}
                              commercialName={client?.commercialName}
                              logoUrl={client?.logoUrl}
                              size="sm"
                            />
                            <div
                              className="flex flex-col min-w-0 cursor-pointer"
                              onClick={() => toggleProjectExpand(project.id)}
                            >
                              <span className="font-bold text-slate-900 dark:text-slate-100 truncate hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
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

                            {/* Botón Exportar Plan de Trabajo a Excel para servicios con plantilla */}
                            {Boolean(project.isFromTemplate || project.templateId || projectTasks.some((t: TaskNode) => typeof t.rubroNumber === 'number')) && (
                              <button
                                type="button"
                                onClick={() => exportAuditPlanToExcel(project, client, projectTasks, teamMembers)}
                                className="p-2 text-slate-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Exportar Plan de Trabajo a Excel (.xlsx)"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </button>
                            )}

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

                      {/* 3. Acordeón Expandible de Actividades / Tareas vinculadas */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-200/80 dark:border-slate-800">
                          <td colSpan={6} className="p-4 sm:p-5">
                            {Boolean(project.isFromTemplate || project.templateId || projectTasks.some((t: TaskNode) => typeof t.rubroNumber === 'number')) ? (
                              <AuditServiceAccordionView
                                project={project}
                                onOpenTaskModal={onOpenTaskModal}
                              />
                            ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                                <div className="flex items-center gap-2">
                                  <ListTodo className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                    Actividades y Tareas del Proyecto ({projectTasks.length})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onOpenTaskModal(null, project.id)}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 px-2.5 py-1 rounded-md shadow-2xs hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Agregar Actividad</span>
                                </button>
                              </div>

                              {projectTasks.length === 0 ? (
                                <div className="py-6 text-center space-y-2">
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Este proyecto aún no tiene actividades o tareas registradas.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => onOpenTaskModal(null, project.id)}
                                    className="text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-sky-400 underline cursor-pointer"
                                  >
                                    + Crear primera actividad
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {projectTasks.map((task: TaskNode) => {
                                    const actualMinutes =
                                      task.loggedMinutes !== undefined
                                        ? Math.max(0, Math.round(task.loggedMinutes))
                                        : Math.max(0, Math.round((taskActualHours[task.id] || 0) * 60));
                                    const plannedMinutes =
                                      task.plannedMinutes !== undefined
                                        ? Math.max(0, Math.round(task.plannedMinutes))
                                        : Math.max(0, Math.round((task.plannedHours || 0) * 60));
                                    const taskPercent =
                                      plannedMinutes > 0 ? Math.round((actualMinutes / plannedMinutes) * 100) : 0;
                                    const isTaskOver = taskPercent >= 100;
                                    const isTaskWarning = taskPercent >= 80 && taskPercent < 100;

                                    const rawAssigned =
                                      Array.isArray(task.assignedUserIds) && task.assignedUserIds.length > 0
                                        ? task.assignedUserIds
                                        : Array.isArray(task.assignedToIds) && task.assignedToIds.length > 0
                                        ? task.assignedToIds
                                        : task.assignedToId || task.assigned_to
                                        ? [task.assignedToId || task.assigned_to!]
                                        : [];
                                    const taskMembers = teamMembers.filter((m) => rawAssigned.includes(m.id));

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
                                        className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                                      >
                                        {/* Título de actividad y Badge de Responsable */}
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {task.name || task.title}
                                          </span>
                                          {task.isExtraordinary && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
                                              Extraordinaria
                                            </span>
                                          )}
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-sky-300 dark:border-blue-900 shrink-0">
                                            Responsable: {leadDisplayName}
                                          </span>
                                        </div>

                                        {/* Participantes asignados, Horas y Reasignación rápida */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                          {/* Participantes asignados (avatares alineados) */}
                                          <div className="flex items-center gap-1.5">
                                            <div className="flex -space-x-1.5 items-center shrink-0">
                                              {taskMembers.length > 0 ? (
                                                taskMembers.map((m) => {
                                                  const initials = m.name
                                                    .split(' ')
                                                    .map((n) => n[0])
                                                    .slice(0, 2)
                                                    .join('')
                                                    .toUpperCase();
                                                  const photo = m.photoURL || (m as any).avatarUrl;
                                                  return (
                                                    <div
                                                      key={m.id}
                                                      title={`${m.name} (${m.roleTitle || 'Colaborador'})`}
                                                      className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden select-none"
                                                    >
                                                      {photo ? (
                                                        <img
                                                          src={photo}
                                                          referrerPolicy="no-referrer"
                                                          alt={m.name}
                                                          className="w-full h-full object-cover"
                                                        />
                                                      ) : (
                                                        <span>{initials}</span>
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              ) : (
                                                <span className="text-[11px] text-slate-400 italic">
                                                  Sin participantes
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Horas registradas */}
                                          <div className="flex items-center gap-1.5 tabular-nums flex-wrap">
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                              {formatMinutesSexagesimal(actualMinutes)} / {formatMinutesSexagesimal(plannedMinutes)}
                                            </span>
                                            <span
                                              className={`font-bold text-[11px] ${
                                                isTaskOver
                                                  ? 'text-rose-600 dark:text-rose-400'
                                                  : isTaskWarning
                                                  ? 'text-amber-600 dark:text-amber-400'
                                                  : 'text-blue-700 dark:text-blue-400'
                                              }`}
                                            >
                                              ({taskPercent}%)
                                            </span>
                                            {task.isManuallyModified && (
                                              <span
                                                title={
                                                  task.manualAdjustment?.reason
                                                    ? `Modificado manualmente por ${task.manualAdjustment.modifiedByName || 'Supervisor'}: "${task.manualAdjustment.reason}"`
                                                    : 'Modificado de manera manual'
                                                }
                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 cursor-help"
                                              >
                                                Modificado manual
                                              </span>
                                            )}
                                          </div>

                                          {/* Selector dinámico de Responsable de Actividad */}
                                          {taskMembers.length > 1 && (
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] text-slate-400">Responsable:</span>
                                              <select
                                                value={effectiveLeadId}
                                                onChange={(e) => handleReassignLead(e.target.value)}
                                                className="text-[10px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-700 cursor-pointer"
                                              >
                                                {taskMembers.map((m) => (
                                                  <option key={m.id} value={m.id}>
                                                    {m.name}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          )}

                                          {/* Botón editar actividad */}
                                          <button
                                            type="button"
                                            onClick={() => onOpenTaskModal(task.id, project.id)}
                                            className="p-1 text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 rounded transition cursor-pointer"
                                            title="Editar actividad"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                }
              )}

              {/* Estado vacío adaptativo según contexto */}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 px-4">
                    {selectedCompanyId && selectedCompanyId !== 'all' ? (
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center mx-auto">
                          <ListTodo className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Esta empresa aún no tiene proyectos o servicios registrados
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Crea el primer proyecto para comenzar a registrar actividades, horas y supervisión de equipo.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectIdForEdit(null);
                              setPreselectedClientIdForProject(selectedCompanyId);
                              setIsProjectModalOpen(true);
                            }}
                            className="h-9 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span>Crear Primer Proyecto</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-slate-400 text-xs">
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
