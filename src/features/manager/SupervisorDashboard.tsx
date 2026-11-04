import { useState } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { getEffectiveModules } from '../../services/rbac';
import { RayonerTree } from './rayoner/RayonerTree';
import { RayonerTimeReport } from './rayoner/RayonerTimeReport';
import { RayonerTaskModal } from './rayoner/RayonerTaskModal';
import { TeamMembersView } from './rayoner/TeamMembersView';
import { SupervisorInvitationsView } from './invitations/SupervisorInvitationsView';
import { CheckinPanel } from '../checkin/CheckinPanel';

export type SupervisorTab = 'tree' | 'report' | 'attendance' | 'invitations' | 'my_checkin';

export interface SupervisorDashboardProps {
  initialTab?: SupervisorTab;
}

export function SupervisorDashboard({ initialTab }: SupervisorDashboardProps = {}) {
  const {
    activeWorkers,
    projects,
    tasks,
    taskActualHours,
  } = useRayonerStore();
  const { user, getEffectiveUserModules, addToast } = useCheckinStore();
  const { getNotificationsForRecipient, markAsRead } = useNotificationStore();

  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);
  const canSeeTree = effectiveModules.tasks || effectiveModules.clients;
  const canSeeReports = effectiveModules.reports;
  const forcedFacialByTI = effectiveModules.facialCheckIn;
  const showPersonalCheckInTab = forcedFacialByTI || effectiveModules.checkIn;

  const supervisorNotifications = getNotificationsForRecipient(user?.id, user?.role);
  const unreadCompletedAlerts = supervisorNotifications.filter(
    (n) => !n.read && n.type === 'task_completed'
  );

  const defaultTab: SupervisorTab = initialTab
    ? initialTab
    : canSeeTree
    ? 'tree'
    : canSeeReports
    ? 'report'
    : 'attendance';

  const [activeTab, setActiveTab] = useState<SupervisorTab>(defaultTab);

  const resolvedTab: SupervisorTab = (() => {
    if (activeTab === 'tree' && !canSeeTree) {
      return canSeeReports ? 'report' : 'attendance';
    }
    if (activeTab === 'report' && !canSeeReports) {
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

  const handleOpenReportForProject = (projectId: string) => {
    if (!canSeeReports) {
      addToast('El módulo de Reportes fue deshabilitado para tu perfil por TI.', 'error');
      return;
    }
    setSelectedProjectIdForReport(projectId);
    setActiveTab('report');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-10 animate-fade-in bg-[#F8FAFC] dark:bg-[#090E17] text-slate-900 dark:text-slate-200">
      {/* 1. Cabecera Editorial Abierta de Supervisión */}
      <header className="space-y-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3 text-xs font-heading font-semibold uppercase tracking-widest text-[#475569] dark:text-[#94A3B8]">
              <span className="text-[#1E40AF] dark:text-[#38BDF8]">RAYONER TIME SUITE</span>
              <span>/</span>
              <span>Panel de Supervisión y Control de Horas</span>
              <span>/</span>
              <span>
                {!forcedFacialByTI ? 'Exento de Biometría' : 'Biometría Activa por TI'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
              Gestión de Clientes, Proyectos y Rentabilidad
            </h1>
          </div>

          {/* Pestañas de Navegación Planas sin Cajas ni Iconos Decorativos */}
          <nav className="flex flex-wrap items-center gap-6 border-b border-slate-200 dark:border-slate-800 lg:border-b-0 pb-2 lg:pb-0">
            {canSeeTree && (
              <button
                onClick={() => setActiveTab('tree')}
                className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                  resolvedTab === 'tree'
                    ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                    : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Árbol C/P/T
                {resolvedTab === 'tree' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
                )}
              </button>
            )}

            {canSeeReports && (
              <button
                onClick={() => setActiveTab('report')}
                className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                  resolvedTab === 'report'
                    ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                    : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Informe de Tiempos
                {resolvedTab === 'report' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('attendance')}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                resolvedTab === 'attendance'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Asistencia y Equipos
              {resolvedTab === 'attendance' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('invitations')}
              className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                resolvedTab === 'invitations'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Invitaciones y Whitelist
              {resolvedTab === 'invitations' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>

            {showPersonalCheckInTab && (
              <button
                onClick={() => setActiveTab('my_checkin')}
                className={`pb-2 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                  resolvedTab === 'my_checkin'
                    ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                    : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
                }`}
              >
                {forcedFacialByTI ? 'Mi Check-in Facial (TI)' : 'Mi Asistencia'}
                {resolvedTab === 'my_checkin' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
                )}
              </button>
            )}
          </nav>
        </div>

        {/* 2. Métricas Operativas en Vivo (Sin Recuadros ni Iconos Decorativos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-heading font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider block">
              En Vivo: Actividad del Equipo
            </span>
            <div className="text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] metric-value mt-1">
              {activeWorkers.length} Activos
            </div>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1 truncate">
              {activeWorkers.length > 0
                ? `${activeWorkers[0].userName} en ${activeWorkers[0].taskName.substring(0, 26)}...`
                : 'Ningún cronómetro activo'}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-heading font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider block">
              Proyectos al ≥80% Consumo
            </span>
            <div className="text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] metric-value mt-1">
              {projectsInAlert.length} En Observación
            </div>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1 truncate">
              {projectsInAlert.length > 0
                ? projectsInAlert.map((p) => p.name).join(', ')
                : 'Todos dentro del presupuesto'}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-heading font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider block">
              Proyección Financiera
            </span>
            <div className="text-3xl font-heading font-bold text-[#0F172A] dark:text-[#F8FAFC] metric-value mt-1">
              100% Auditado
            </div>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
              Límites de cronómetro activos por colaborador
            </p>
          </div>
        </div>
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
        <RayonerTree
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

      {resolvedTab === 'invitations' && <SupervisorInvitationsView />}

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
