import { useState, useMemo } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { getEffectiveModules, getEffectivePermissions, normalizeRole } from '../../services/rbac';
import { ProjectsSupervisionTable } from './rayoner/ProjectsSupervisionTable';
import { ClientsDirectoryView } from './rayoner/ClientsDirectoryView';
import { RayonerTimeReport } from './rayoner/RayonerTimeReport';
import { RayonerTaskModal } from './rayoner/RayonerTaskModal';
import { TeamMembersView } from './rayoner/TeamMembersView';
import { ExecutiveAuditLogView } from '../audit/ExecutiveAuditLogView';
import { CheckinPanel } from '../checkin/CheckinPanel';
import { KanbanBoard } from '../projects/KanbanBoard';
import { useLiveTeamTimers, useOperationalCatalogSync } from '../../hooks/useLiveTeamTimers';
import { canAccessClientsDirectory } from '../../services/companyService';

export type SupervisorTab = 'tree' | 'clients' | 'report' | 'attendance' | 'my_checkin' | 'audit_logs' | 'my_tasks';

export interface SupervisorDashboardProps {
  initialTab?: SupervisorTab;
}

export function SupervisorDashboard({ initialTab }: SupervisorDashboardProps = {}) {
  useLiveTeamTimers();
  useOperationalCatalogSync();
  const {
    activeWorkers,
    projects,
    tasks,
    taskActualHours,
  } = useRayonerStore();
  const { user, getEffectiveUserModules, addToast } = useCheckinStore();
  const { getNotificationsForRecipient, markAsRead } = useNotificationStore();

  const userPerms = getEffectivePermissions(user);
  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);

  const normRole = normalizeRole(user?.role);
  const isSupervisorRole = normRole === 'Supervisor';
  const canSeeTree = effectiveModules.tasks || effectiveModules.clients || userPerms.canManageClientsAndProjects;
  const canSeeClientsDirectory = canAccessClientsDirectory(user?.role);
  const canSeeMyTasks = normRole !== 'RH' && (userPerms.canAccessMyTasks ?? true);
  const canSeeReports = userPerms.canExportReports || effectiveModules.reports;
  const canSeeAudit = userPerms.canViewExecutiveAuditLogs;
  const forcedFacialByTI = effectiveModules.facialCheckIn;
  const showPersonalCheckInTab = forcedFacialByTI || effectiveModules.checkIn || userPerms.canCheckIn;

  const supervisorNotifications = getNotificationsForRecipient(user?.id, user?.role);
  const unreadCompletedAlerts = supervisorNotifications.filter(
    (n) => !n.read && n.type === 'task_completed'
  );

  // Pestaña inicial: para Supervisor siempre abre por defecto en 'Mi Asistencia'
  const defaultTab: SupervisorTab = initialTab
    ? initialTab
    : isSupervisorRole
      ? 'my_checkin'
      : canSeeTree
        ? 'tree'
        : 'attendance';

  const [activeTab, setActiveTab] = useState<SupervisorTab>(defaultTab);

  const resolvedTab: SupervisorTab = (() => {
    // Si es Supervisor, restringir estrictamente a sus 3 pestañas autorizadas y evitar que cargue attendance
    if (isSupervisorRole) {
      if (activeTab === 'my_checkin') return 'my_checkin';
      if (activeTab === 'my_tasks' && canSeeMyTasks) return 'my_tasks';
      if (activeTab === 'tree' && canSeeTree) return 'tree';
      // Por defecto para Supervisor, siempre abrir en Mi Asistencia
      return 'my_checkin';
    }

    if (activeTab === 'clients' && !canSeeClientsDirectory) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    if (activeTab === 'my_tasks' && !canSeeMyTasks) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    if (activeTab === 'tree' && !canSeeTree) {
      return canSeeReports ? 'report' : 'attendance';
    }
    if (activeTab === 'report' && !canSeeReports) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    if ((activeTab as string) === 'invitations') {
      return 'attendance';
    }
    if (activeTab === 'audit_logs' && !canSeeAudit) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    if (activeTab === 'my_checkin' && !showPersonalCheckInTab) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    return activeTab;
  })();

  const [taskModalState, setTaskModalState] = useState<{
    isOpen: boolean;
    taskId?: string | null;
    projectId?: string | null;
  }>({
    isOpen: false,
    taskId: null,
    projectId: null,
  });

  const [selectedProjectIdForReport, setSelectedProjectIdForReport] = useState<string | null>(null);

  // Proyectos autorizados para métricas (si es Supervisor, se filtran estrictamente a los asignados)
  const visibleProjectsForMetrics = useMemo(() => {
    if (!isSupervisorRole || !user?.id) return projects;
    const currentUid = user.id;
    const currentEmail = (user.email || '').toLowerCase().trim();

    return projects.filter((project) => {
      if (project.leadUserId === currentUid) return true;
      if (project.supervisorId === currentUid) return true;
      if (Array.isArray(project.assignedUserIds) && project.assignedUserIds.includes(currentUid)) return true;
      if (Array.isArray(project.assignedToIds) && project.assignedToIds.includes(currentUid)) return true;
      if (
        Array.isArray(project.assignedUserEmails) &&
        project.assignedUserEmails.some((e) => (e || '').toLowerCase().trim() === currentEmail)
      ) {
        return true;
      }

      const hasAssignedTask = tasks.some((t) => {
        if (t.projectId !== project.id) return false;
        if (t.leadUserId === currentUid) return true;
        if (t.assignedToId === currentUid || t.assigned_to === currentUid) return true;
        if (Array.isArray(t.assignedToIds) && t.assignedToIds.includes(currentUid)) return true;
        if (Array.isArray(t.assignedUserIds) && t.assignedUserIds.includes(currentUid)) return true;
        if (t.assignedToEmail && t.assignedToEmail.toLowerCase().trim() === currentEmail) return true;
        return false;
      });
      if (hasAssignedTask) return true;

      if (Array.isArray(user.allowedClientIds) && user.allowedClientIds.includes(project.clientId)) {
        return true;
      }

      return false;
    });
  }, [projects, tasks, isSupervisorRole, user]);

  const visibleTasksForMetrics = useMemo(() => {
    if (!isSupervisorRole) return tasks;
    const projectIds = new Set(visibleProjectsForMetrics.map((p) => p.id));
    return tasks.filter((t) => projectIds.has(t.projectId));
  }, [tasks, visibleProjectsForMetrics, isSupervisorRole]);

  const projectsInAlert = useMemo(() => {
    return visibleProjectsForMetrics.filter((p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.id);
      const actual = pTasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
      const planned = p.totalBudgetHours || 1;
      return actual / planned >= 0.8;
    });
  }, [visibleProjectsForMetrics, tasks, taskActualHours]);

  // Eficiencia Global (% de horas auditadas vs presupuestadas)
  const totalActualAllTasks = useMemo(() => {
    return visibleTasksForMetrics.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
  }, [visibleTasksForMetrics, taskActualHours]);

  const totalBudgetedAllProjects = useMemo(() => {
    return visibleProjectsForMetrics.reduce((acc, p) => acc + (p.totalBudgetHours || 0), 0);
  }, [visibleProjectsForMetrics]);

  const globalEfficiency =
    totalBudgetedAllProjects > 0
      ? Math.round((totalActualAllTasks / totalBudgetedAllProjects) * 100)
      : 0;

  const handleOpenReportForProject = (projectId: string) => {
    if (!canSeeReports) {
      addToast('El módulo de Reportes fue deshabilitado para tu perfil por TI.', 'error');
      return;
    }
    setSelectedProjectIdForReport(projectId);
    setActiveTab('report');
  };

  return (
    <div className="w-full max-w-[96vw] mx-auto px-4 md:px-8 py-8 space-y-8 animate-fade-in bg-[#F8FAFC] dark:bg-[#090E17] text-slate-900 dark:text-slate-200">
      {/* 1. Cabecera Ejecutiva de Supervisión */}
      <header className="space-y-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {isSupervisorRole ? 'Panel de Supervisión Operativa' : 'Supervisión de Proyectos'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isSupervisorRole
                ? 'Control personal de asistencia, gestión de tareas asignadas y seguimiento de proyectos.'
                : 'Seguimiento de horas, avance presupuestal y asignación de colaboradores.'}
            </p>
          </div>

          {/* Pestañas Superiores Estilizadas como Pills Modernas con scroll horizontal fluido y sin barras toscas */}
          <nav className="inline-flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start lg:self-auto overflow-x-auto no-scrollbar max-w-full">
            {isSupervisorRole ? (
              <>
                {/* 1. Mi Asistencia (Primera pestaña - Vista inicial por defecto para Supervisor) */}
                <button
                  type="button"
                  onClick={() => setActiveTab('my_checkin')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    resolvedTab === 'my_checkin'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {forcedFacialByTI ? 'Mi Check-in Facial' : 'Mi Asistencia'}
                </button>

                {/* 2. Mis Tareas (Segunda pestaña para Supervisor) */}
                {canSeeMyTasks && (
                  <button
                    type="button"
                    data-tour="nav-my-tasks-tab"
                    onClick={() => setActiveTab('my_tasks')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'my_tasks'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Mis Tareas
                  </button>
                )}

                {/* 3. Proyectos y Tiempos (Tercera pestaña para Supervisor - solo proyectos autorizados) */}
                {canSeeTree && (
                  <button
                    type="button"
                    data-tour="nav-projects-tab"
                    onClick={() => setActiveTab('tree')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'tree'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Proyectos y Tiempos
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Pestañas para Gerente y Socio (intactas) */}
                {canSeeTree && (
                  <button
                    type="button"
                    data-tour="nav-projects-tab"
                    onClick={() => setActiveTab('tree')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'tree'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Proyectos y Tiempos
                  </button>
                )}

                {/* Pestaña Mis Tareas: Colaborador, Supervisor y Gerente asignados */}
                {canSeeMyTasks && (
                  <button
                    type="button"
                    data-tour="nav-my-tasks-tab"
                    onClick={() => setActiveTab('my_tasks')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'my_tasks'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Mis Tareas
                  </button>
                )}

                {/* Pestaña Directorio de Clientes y Empresas: Exclusivo Socio, Gerente y TI */}
                {canSeeClientsDirectory && (
                  <button
                    type="button"
                    data-tour="nav-clients-tab"
                    onClick={() => setActiveTab('clients')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'clients'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Clientes y Empresas
                  </button>
                )}

                <button
                  type="button"
                  data-tour="nav-team-tab"
                  onClick={() => setActiveTab('attendance')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    resolvedTab === 'attendance'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Asistencia y Equipos
                </button>

                {/* Pestaña Informes: SOLO roles autorizados (Gerente, Socio, TI) */}
                {canSeeReports && (
                  <button
                    type="button"
                    data-tour="nav-reports-tab"
                    onClick={() => setActiveTab('report')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'report'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Informes
                  </button>
                )}

                {/* Pestaña Bitácora de Auditoría: SOLO Socio y TI */}
                {canSeeAudit && (
                  <button
                    type="button"
                    data-tour="nav-audit-logs"
                    onClick={() => setActiveTab('audit_logs')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'audit_logs'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-bold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Bitácora de Movimientos
                  </button>
                )}

                {showPersonalCheckInTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('my_checkin')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      resolvedTab === 'my_checkin'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {forcedFacialByTI ? 'Mi Check-in Facial' : 'Mi Asistencia'}
                  </button>
                )}
              </>
            )}
          </nav>
        </div>

        {/* 2. Tres Métricas Superiores en Tarjetas Compactas y Limpias (Exclusivas de la pestaña Proyectos y Tiempos) */}
        {resolvedTab === 'tree' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
            {/* Métrica 1: Colaboradores Activos */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Colaboradores Activos
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>{activeWorkers.length} en vivo</span>
                  {activeWorkers.length > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {activeWorkers.length > 0
                    ? `${activeWorkers[0].userName} cronometrando`
                    : 'Sin actividad en vivo'}
                </p>
              </div>
            </div>

            {/* Métrica 2: En Observación */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  En Observación
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {projectsInAlert.length} {projectsInAlert.length === 1 ? 'Proyecto' : 'Proyectos'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {projectsInAlert.length > 0
                    ? '≥80% de horas consumidas'
                    : 'Todos dentro del margen'}
                </p>
              </div>
            </div>

            {/* Métrica 3: Eficiencia Global */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Eficiencia Global
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {globalEfficiency}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {Number(totalActualAllTasks).toFixed(1)}h auditadas vs. {Number(totalBudgetedAllProjects).toFixed(1)}h presupuestadas
                </p>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mt-3">
                  <div
                    className="h-1.5 rounded-full bg-blue-700 dark:bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.min(globalEfficiency, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Aviso cuando TI habilita verificación facial obligatoria */}
      {forcedFacialByTI && resolvedTab !== 'my_checkin' && (
        <div className="py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              Verificación Facial Activada por Administración TI
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-0.5">
              TI ha requerido verificación facial con vector numérico 128D para tu cuenta de supervisión.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('my_checkin')}
            className="px-4 py-2 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold uppercase tracking-wider cursor-pointer shrink-0 transition-colors"
          >
            Ir a Mi Check-in Facial
          </button>
        </div>
      )}

      {/* Notificación en tiempo real cuando un empleado completa una tarea */}
      {effectiveModules.tasks && unreadCompletedAlerts.length > 0 && (
        <div className="py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div>
            <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-[#1E40AF] dark:text-[#38BDF8]">
              AVANCE EN TIEMPO REAL
            </span>
            <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">
              {unreadCompletedAlerts[0].message}
            </p>
          </div>
          <button
            onClick={() => markAsRead(unreadCompletedAlerts[0].id)}
            className="px-4 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold uppercase tracking-wider cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
          >
            Enterado
          </button>
        </div>
      )}

      {/* 3. Renderizado de la Vista Seleccionada */}
      {resolvedTab === 'my_tasks' && canSeeMyTasks && (
        <div className="animate-fade-in">
          <KanbanBoard />
        </div>
      )}

      {resolvedTab === 'tree' && canSeeTree && (
        <ProjectsSupervisionTable
          onOpenTaskModal={(taskId, projectId) =>
            setTaskModalState({ isOpen: true, taskId, projectId })
          }
          onSelectProjectForReport={handleOpenReportForProject}
        />
      )}

      {resolvedTab === 'clients' && canSeeClientsDirectory && (
        <ClientsDirectoryView />
      )}

      {resolvedTab === 'report' && canSeeReports && (
        <RayonerTimeReport initialProjectId={selectedProjectIdForReport} />
      )}

      {resolvedTab === 'attendance' && !isSupervisorRole && (
        <TeamMembersView
          onNavigateToTree={() => {
            if (canSeeTree) setActiveTab('tree');
          }}
        />
      )}

      {resolvedTab === 'audit_logs' && canSeeAudit && <ExecutiveAuditLogView />}

      {resolvedTab === 'my_checkin' && showPersonalCheckInTab && (
        <div className="pt-2">
          <CheckinPanel />
        </div>
      )}

      {effectiveModules.tasks && (
        <RayonerTaskModal
          isOpen={taskModalState.isOpen}
          onClose={() => setTaskModalState({ isOpen: false, taskId: null, projectId: null })}
          taskId={taskModalState.taskId}
          projectId={taskModalState.projectId}
        />
      )}
    </div>
  );
}
