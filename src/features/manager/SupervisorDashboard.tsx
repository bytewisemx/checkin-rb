import { useState, useMemo } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { getEffectiveModules, getEffectivePermissions, normalizeRole } from '../../services/rbac';
import { ProjectsSupervisionTable } from './rayoner/ProjectsSupervisionTable';
import { RayonerTimeReport } from './rayoner/RayonerTimeReport';
import { RayonerTaskModal } from './rayoner/RayonerTaskModal';
import { TeamMembersView } from './rayoner/TeamMembersView';
import { SupervisorInvitationsView } from './invitations/SupervisorInvitationsView';
import { ExecutiveAuditLogView } from '../audit/ExecutiveAuditLogView';
import { AuditHierarchyView } from '../hierarchy/AuditHierarchyView';
import { CheckinPanel } from '../checkin/CheckinPanel';
import { useLiveTeamTimers } from '../../hooks/useLiveTeamTimers';
import { Users, AlertTriangle, TrendingUp } from 'lucide-react';

export type SupervisorTab = 'tree' | 'report' | 'attendance' | 'invitations' | 'audit_accounts' | 'my_checkin' | 'audit_logs';

export interface SupervisorDashboardProps {
  initialTab?: SupervisorTab;
}

export function SupervisorDashboard({ initialTab }: SupervisorDashboardProps = {}) {
  useLiveTeamTimers();
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
  const canSeeTree = effectiveModules.tasks || effectiveModules.clients || userPerms.canManageClientsAndProjects;
  const canSeeReports = userPerms.canExportReports || effectiveModules.reports;
  const canInvite = userPerms.canInviteUsers;
  const canSeeAudit = userPerms.canViewExecutiveAuditLogs;
  const canSeeHierarchy = normRole === 'Socio' || normRole === 'Gerente';
  const forcedFacialByTI = effectiveModules.facialCheckIn;
  const showPersonalCheckInTab = forcedFacialByTI || effectiveModules.checkIn || userPerms.canCheckIn;

  const supervisorNotifications = getNotificationsForRecipient(user?.id, user?.role);
  const unreadCompletedAlerts = supervisorNotifications.filter(
    (n) => !n.read && n.type === 'task_completed'
  );

  const defaultTab: SupervisorTab = initialTab
    ? initialTab
    : canSeeTree
    ? 'tree'
    : 'attendance';

  const [activeTab, setActiveTab] = useState<SupervisorTab>(defaultTab);

  const resolvedTab: SupervisorTab = (() => {
    if (activeTab === 'tree' && !canSeeTree) {
      return canSeeReports ? 'report' : 'attendance';
    }
    if (activeTab === 'report' && !canSeeReports) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    if (activeTab === 'invitations' && !canInvite) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    if (activeTab === 'audit_logs' && !canSeeAudit) {
      return canSeeTree ? 'tree' : 'attendance';
    }
    if (activeTab === 'audit_accounts' && !canSeeHierarchy) {
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

  const projectsInAlert = projects.filter((p) => {
    const pTasks = tasks.filter((t) => t.projectId === p.id);
    const actual = pTasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
    const planned = p.totalBudgetHours || 1;
    return actual / planned >= 0.8;
  });

  // Eficiencia Global (% de horas auditadas vs presupuestadas)
  const totalActualAllTasks = useMemo(() => {
    return tasks.reduce((acc, t) => acc + (taskActualHours[t.id] || 0), 0);
  }, [tasks, taskActualHours]);

  const totalBudgetedAllProjects = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.totalBudgetHours || 0), 0) || 1;
  }, [projects]);

  const globalEfficiency = Math.round((totalActualAllTasks / totalBudgetedAllProjects) * 100);

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
              Supervisión de Proyectos
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Seguimiento de horas, avance presupuestal y asignación de colaboradores.
            </p>
          </div>

          {/* Pestañas Superiores Estilizadas como Pills Modernas */}
          <nav className="inline-flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start lg:self-auto">
            {canSeeTree && (
              <button
                type="button"
                data-tour="nav-projects-tab"
                onClick={() => setActiveTab('tree')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  resolvedTab === 'tree'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Proyectos y Tiempos
              </button>
            )}

            <button
              type="button"
              data-tour="nav-team-tab"
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                resolvedTab === 'attendance'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Asistencia y Equipos
            </button>

            {/* Pestaña Invitaciones: SOLO para Gerente, Socio y TI */}
            {canInvite && (
              <button
                type="button"
                data-tour="nav-invitations-tab"
                onClick={() => setActiveTab('invitations')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  resolvedTab === 'invitations'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Invitaciones
              </button>
            )}

            {/* Pestaña Informes: SOLO roles autorizados (Gerente, Socio, TI) */}
            {canSeeReports && (
              <button
                type="button"
                data-tour="nav-reports-tab"
                onClick={() => setActiveTab('report')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  resolvedTab === 'audit_logs'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Bitácora de Movimientos
              </button>
            )}

            {/* Pestaña Auditar Jerarquía: Socios y Gerentes */}
            {canSeeHierarchy && (
              <button
                type="button"
                data-tour="nav-audit-hierarchy"
                onClick={() => setActiveTab('audit_accounts')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  resolvedTab === 'audit_accounts'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Auditar Jerarquía
              </button>
            )}

            {showPersonalCheckInTab && (
              <button
                type="button"
                onClick={() => setActiveTab('my_checkin')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  resolvedTab === 'my_checkin'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {forcedFacialByTI ? 'Mi Check-in Facial' : 'Mi Asistencia'}
              </button>
            )}
          </nav>
        </div>

        {/* 2. Tres Métricas Superiores en Tarjetas Compactas y Limpias (Exclusivas de la pestaña Proyectos y Tiempos) */}
        {resolvedTab === 'tree' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
            {/* Métrica 1: Colaboradores Activos */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Colaboradores Activos
                </span>
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                    : 'Sin cronómetros activos'}
                </p>
              </div>
            </div>

            {/* Métrica 2: En Observación */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  En Observación
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
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
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Eficiencia Global
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {globalEfficiency}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {totalActualAllTasks}h auditadas vs. {totalBudgetedAllProjects}h presupuestadas
                </p>
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
      {resolvedTab === 'tree' && canSeeTree && (
        <ProjectsSupervisionTable
          onOpenTaskModal={(taskId, projectId) =>
            setTaskModalState({ isOpen: true, taskId, projectId })
          }
          onSelectProjectForReport={handleOpenReportForProject}
        />
      )}

      {resolvedTab === 'report' && canSeeReports && (
        <RayonerTimeReport initialProjectId={selectedProjectIdForReport} />
      )}

      {resolvedTab === 'attendance' && (
        <TeamMembersView
          onNavigateToTree={() => {
            if (canSeeTree) setActiveTab('tree');
          }}
        />
      )}

      {resolvedTab === 'invitations' && canInvite && <SupervisorInvitationsView />}

      {resolvedTab === 'audit_logs' && canSeeAudit && <ExecutiveAuditLogView />}

      {resolvedTab === 'audit_accounts' && canSeeHierarchy && (
        <div className="bg-white dark:bg-[#0B111E] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <AuditHierarchyView onNavigateToInvitations={() => setActiveTab('invitations')} />
        </div>
      )}

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
