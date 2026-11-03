import { useState } from 'react';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { getEffectiveModules } from '../../services/rbac';
import {
  Users,
  GitFork,
  BarChart3,
  AlertTriangle,
  Play,
  DollarSign,
  MailCheck,
  Bell,
  CheckCircle2,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
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

  // Estados de Navegación del Panel de Supervisión
  const [activeTab, setActiveTab] = useState<SupervisorTab>(defaultTab);

  // Resolver pestaña efectiva respetando los módulos activos configurados por TI
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

  // Estado para el modal de tareas de Rayoner
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

  // Métricas de Alerta en Vivo
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
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8 space-y-6 animate-fade-in bg-[#0B111E] text-[#F8FAFC]">
      {/* 1. Header Ejecutivo de Rayoner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#233354] gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-heading font-bold tracking-widest text-[#38BDF8] uppercase bg-[#1E40AF]/20 border border-[#1E40AF]/40 px-2 py-0.5 rounded-sm">
              RAYONER TIME SUITE
            </span>
            <span className="text-xs text-[#64748B]">•</span>
            <span className="text-xs font-medium text-[#94A3B8]">
              Panel de Supervisión y Control de Horas
            </span>
            {!forcedFacialByTI ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-heading font-semibold bg-[#0F172A] text-[#38BDF8] border border-[#233354] px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3 h-3 text-[#38BDF8]" />
                Exento de Biometría por Defecto
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-heading font-semibold bg-[#1A2742] text-[#F59E0B] border border-[#F59E0B]/30 px-2 py-0.5 rounded-md">
                <ScanFace className="w-3 h-3 text-[#F59E0B]" />
                Biometría Forzada por TI Activa
              </span>
            )}
          </div>
          <h1 className="text-2xl font-heading font-bold text-[#F8FAFC] tracking-tight mt-1">
            Gestión de Clientes, Proyectos y Rentabilidad
          </h1>
        </div>

        {/* Pestañas de Navegación del Panel del Supervisor */}
        <div className="flex flex-wrap bg-[#131D31] p-1 rounded-md border border-[#233354] self-start md:self-auto gap-1">
          {canSeeTree && (
            <button
              onClick={() => setActiveTab('tree')}
              className={`flex items-center px-4 py-2 rounded-md text-xs font-heading font-semibold transition-colors cursor-pointer ${
                resolvedTab === 'tree'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742]'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 mr-1.5 text-current" />
              Árbol C/P/T
            </button>
          )}

          {canSeeReports && (
            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center px-4 py-2 rounded-md text-xs font-heading font-semibold transition-colors cursor-pointer ${
                resolvedTab === 'report'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-current" />
              Informe de Tiempos
            </button>
          )}

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center px-4 py-2 rounded-md text-xs font-heading font-semibold transition-colors cursor-pointer ${
              resolvedTab === 'attendance'
                ? 'bg-[#1E40AF] text-white shadow-xs'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742]'
            }`}
          >
            <Users className="w-3.5 h-3.5 mr-1.5 text-current" />
            Asistencia y Equipos
          </button>

          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex items-center px-4 py-2 rounded-md text-xs font-heading font-semibold transition-colors cursor-pointer ${
              resolvedTab === 'invitations'
                ? 'bg-[#1E40AF] text-white shadow-xs'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1A2742]'
            }`}
          >
            <MailCheck className="w-3.5 h-3.5 mr-1.5 text-current" />
            Invitaciones & Whitelist
          </button>

          {showPersonalCheckInTab && (
            <button
              onClick={() => setActiveTab('my_checkin')}
              className={`flex items-center px-4 py-2 rounded-md text-xs font-heading font-semibold transition-colors cursor-pointer ${
                resolvedTab === 'my_checkin'
                  ? 'bg-[#1E40AF] text-white shadow-xs'
                  : 'text-[#38BDF8] hover:text-white hover:bg-[#1A2742]'
              }`}
            >
              <ScanFace className="w-3.5 h-3.5 mr-1.5 text-current" />
              {forcedFacialByTI ? 'Mi Check-in Facial (TI)' : 'Mi Asistencia'}
            </button>
          )}
        </div>
      </div>

      {/* Aviso cuando TI habilita verificación facial obligatoria a un Supervisor específico */}
      {forcedFacialByTI && resolvedTab !== 'my_checkin' && (
        <div className="bg-[#131D31] border border-[#233354] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-md bg-[#1A2742] text-[#F59E0B] border border-[#F59E0B]/30 flex items-center justify-center shrink-0">
              <ScanFace className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[#F8FAFC]">
                Verificación Facial Activada por Administración TI
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                TI ha requerido verificación facial con vector numérico 128D para tu cuenta de supervisión.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('my_checkin')}
            className="px-3.5 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold cursor-pointer shrink-0 transition-colors"
          >
            Ir a Mi Check-in Facial
          </button>
        </div>
      )}

      {/* Notificación en tiempo real cuando un empleado completa una tarea */}
      {effectiveModules.tasks && unreadCompletedAlerts.length > 0 && (
        <div className="bg-[#131D31] text-[#F8FAFC] rounded-md p-3.5 border border-[#233354] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#1E40AF]/20 border border-[#1E40AF]/40 flex items-center justify-center text-[#38BDF8] shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider bg-[#1E40AF] text-[#F8FAFC] px-2 py-0.5 rounded-sm">
                AVANCE EN TIEMPO REAL
              </span>
              <p className="text-xs font-semibold text-[#F8FAFC] mt-0.5">{unreadCompletedAlerts[0].message}</p>
            </div>
          </div>
          <button
            onClick={() => markAsRead(unreadCompletedAlerts[0].id)}
            className="px-3 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto shrink-0 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Enterado</span>
          </button>
        </div>
      )}

      {/* 2. Barra de Pulso Operativo (Scorecards en Vivo) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Colaboradores en Vivo */}
        <div className="bg-[#131D31] border border-[#233354] rounded-md p-4 shadow-xs flex items-center justify-between text-[#F8FAFC]">
          <div>
            <span className="text-xs font-heading font-bold text-[#94A3B8] uppercase tracking-wider block">
              En Vivo: ¿Quién trabaja en qué?
            </span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-2xl font-heading font-bold text-[#F8FAFC] metric-value">
                {activeWorkers.length} Activos
              </span>
              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
              {activeWorkers.length > 0
                ? `${activeWorkers[0].userName} en ${activeWorkers[0].taskName.substring(0, 20)}...`
                : 'Ningún cronómetro activo'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#1A2742] text-[#38BDF8] border border-[#233354] flex items-center justify-center shrink-0">
            <Play className="w-4 h-4 fill-current" />
          </div>
        </div>

        {/* KPI 2: Proyectos en Alerta (>= 80%) */}
        <div className="bg-[#131D31] border border-[#233354] rounded-md p-4 shadow-xs flex items-center justify-between text-[#F8FAFC]">
          <div>
            <span className="text-xs font-heading font-bold text-[#94A3B8] uppercase tracking-wider block">
              Proyectos al ≥80% Consumo
            </span>
            <div className="flex items-center space-x-2 mt-1">
              <span
                className={`text-2xl font-heading font-bold metric-value ${
                  projectsInAlert.length > 0 ? 'text-[#F59E0B]' : 'text-[#F8FAFC]'
                }`}
              >
                {projectsInAlert.length} En Riesgo
              </span>
              {projectsInAlert.length > 0 && (
                <span className="text-[10px] font-heading font-bold bg-[#1A2742] text-[#F59E0B] border border-[#F59E0B]/30 px-2 py-0.5 rounded-sm">
                  ALERTA
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
              {projectsInAlert.length > 0
                ? projectsInAlert.map((p) => p.name).join(', ')
                : 'Todos en rango óptimo'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#1A2742] text-[#F59E0B] border border-[#233354] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 3: Control Presupuestario */}
        <div className="bg-[#131D31] border border-[#233354] rounded-md p-4 shadow-xs flex items-center justify-between text-[#F8FAFC]">
          <div>
            <span className="text-xs font-heading font-bold text-[#94A3B8] uppercase tracking-wider block">
              Proyección Financiera
            </span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-2xl font-heading font-bold text-[#F8FAFC] metric-value">100% Auditado</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Hard-stops de cronómetro activos por colaborador
            </p>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#1A2742] text-[#38BDF8] border border-[#233354] flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

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

      {/* Modal Multitarea de Rayoner */}
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
