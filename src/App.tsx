import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useCheckinStore } from './store/useCheckinStore';
import { useNotificationStore } from './store/useNotificationStore';
import { useState } from 'react';
import { normalizeRole, getEffectiveModules, type UserModules } from './services/rbac';

// Vistas
import { AuthPage } from './features/auth/AuthPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { CompleteProfilePage } from './features/auth/CompleteProfilePage';
import { CheckinPanel } from './features/checkin/CheckinPanel';
import { SupervisorDashboard, type SupervisorTab } from './features/manager/SupervisorDashboard';
import { TIDashboard, type TIDashboardProps } from './features/ti/TIDashboard';
import { RHDashboard } from './features/rh/RHDashboard';
import { KanbanBoard } from './features/projects/KanbanBoard';

// Componentes UI Globales
import { Clock, LayoutGrid, Bell, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ToastContainer } from './components/common/ToastContainer';
import { GlobalHeader } from './components/common/GlobalHeader';

interface EmployeeDashboardProps {
  initialTab?: 'checkin' | 'projects';
}

function EmployeeDashboard({ initialTab = 'checkin' }: EmployeeDashboardProps) {
  const { user, getEffectiveUserModules } = useCheckinStore();
  const { getNotificationsForRecipient, markAsRead } = useNotificationStore();

  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);
  const canAccessTasks = effectiveModules.tasks;
  const canAccessCheckIn = effectiveModules.checkIn;

  const [activeTab, setActiveTab] = useState<'checkin' | 'projects'>(
    initialTab === 'projects' && canAccessTasks ? 'projects' : 'checkin'
  );

  const resolvedTab: 'checkin' | 'projects' =
    activeTab === 'projects' && canAccessTasks ? 'projects' : 'checkin';

  const myNotifications = getNotificationsForRecipient(user?.id, user?.role);
  const unreadTaskAlerts = canAccessTasks ? myNotifications.filter((n) => !n.read).slice(0, 3) : [];

  return (
    <main className="w-full pb-12 px-4 lg:px-8 animate-fade-in bg-[#0B111E] text-[#F8FAFC]">
      {/* Bandeja en vivo de Notificaciones de Tareas Asignadas */}
      {canAccessTasks && unreadTaskAlerts.length > 0 && (
        <div className="max-w-[1600px] mx-auto mt-4 bg-[#131D31] text-[#F8FAFC] rounded-md p-3.5 border border-[#233354] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-8 h-8 rounded-md bg-[#1E40AF]/20 flex items-center justify-center shrink-0 text-[#38BDF8] border border-[#1E40AF]/40">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider bg-[#1E40AF] text-[#F8FAFC] px-2 py-0.5 rounded-sm">
                  NOTIFICACIÓN
                </span>
                <span className="text-[11px] text-[#94A3B8]">
                  Supervisor: {user?.supervisorName || 'Líder de Equipo'}
                </span>
              </div>
              <p className="text-xs font-medium text-[#F8FAFC] mt-0.5">{unreadTaskAlerts[0].message}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                setActiveTab('projects');
                markAsRead(unreadTaskAlerts[0].id);
              }}
              className="px-3 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold transition-colors cursor-pointer"
            >
              Ver Mis Tareas
            </button>
            <button
              onClick={() => markAsRead(unreadTaskAlerts[0].id)}
              className="p-1.5 bg-[#1A2742] hover:bg-[#233354] text-[#94A3B8] hover:text-[#F8FAFC] rounded-md text-xs font-semibold cursor-pointer border border-[#233354]"
              title="Marcar como leída"
            >
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
            </button>
          </div>
        </div>
      )}

      {/* Barra de Navegación de Pestañas Abierta y Minimalista (Sin Recuadros) */}
      <div className="flex flex-col items-center justify-center mt-6 mb-3 gap-2">
        <div className="flex items-center space-x-6">
          {canAccessCheckIn && (
            <button
              onClick={() => setActiveTab('checkin')}
              className={`flex items-center pb-2 text-xs font-heading font-semibold transition-all relative cursor-pointer ${
                resolvedTab === 'checkin'
                  ? 'text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 mr-1.5 text-current" />
              <span>Asistencia Global</span>
              {resolvedTab === 'checkin' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 dark:bg-[#38BDF8] rounded-t" />
              )}
            </button>
          )}

          {canAccessTasks && (
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center pb-2 text-xs font-heading font-semibold transition-all relative cursor-pointer ${
                resolvedTab === 'projects'
                  ? 'text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5 text-current" />
              <span>Mis Tareas Asignadas</span>
              {resolvedTab === 'projects' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700 dark:bg-[#38BDF8] rounded-t" />
              )}
            </button>
          )}
        </div>

        {!canAccessTasks && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#94A3B8]">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700 dark:text-[#38BDF8]" />
            Perfil configurado en modo de Entrada / Salida (Módulo de tareas inactivo)
          </span>
        )}
      </div>

      {resolvedTab === 'checkin' ? (
        <div className="animate-fade-in w-full max-w-[1600px] mx-auto">
          <CheckinPanel />
        </div>
      ) : canAccessTasks ? (
        <KanbanBoard />
      ) : null}
    </main>
  );
}

interface MainLayoutProps {
  initialTiTab?: TIDashboardProps['initialTab'];
  initialEmployeeTab?: 'checkin' | 'projects';
  initialSupervisorTab?: SupervisorTab;
}

function MainLayout({
  initialTiTab,
  initialEmployeeTab,
  initialSupervisorTab,
}: MainLayoutProps = {}) {
  const { user } = useCheckinStore();
  const normalizedRole = normalizeRole(user?.role);

  return (
    <div className="min-h-screen bg-[#0B111E] text-[#F8FAFC]">
      <GlobalHeader />

      {normalizedRole === 'TI' && <TIDashboard initialTab={initialTiTab} />}
      {normalizedRole === 'Supervisor' && (
        <SupervisorDashboard initialTab={initialSupervisorTab} />
      )}
      {normalizedRole === 'RH' && <RHDashboard />}
      {normalizedRole === 'Empleado' && <EmployeeDashboard initialTab={initialEmployeeTab} />}
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCheckinStore((state) => state.isAuthenticated);
  const isProfileComplete = useCheckinStore((state) => state.user?.isProfileComplete);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isProfileComplete) return <Navigate to="/complete-profile" replace />;

  return <>{children}</>;
}

function ProfileRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCheckinStore((state) => state.isAuthenticated);
  const isProfileComplete = useCheckinStore((state) => state.user?.isProfileComplete);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isProfileComplete) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function TIAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useCheckinStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isProfileComplete) return <Navigate to="/complete-profile" replace />;
  if (normalizeRole(user?.role) !== 'TI') return <Navigate to="/" replace />;

  return <>{children}</>;
}

function ModuleProtectedRoute({
  moduleKey,
  blockRH = false,
  children,
}: {
  moduleKey: keyof UserModules;
  blockRH?: boolean;
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, getEffectiveUserModules } = useCheckinStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isProfileComplete) return <Navigate to="/complete-profile" replace />;

  const role = normalizeRole(user?.role);
  if (blockRH && role === 'RH') {
    return <Navigate to="/" replace />;
  }

  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);
  if (!effectiveModules[moduleKey]) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ToastContainer />
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/complete-profile"
            element={
              <ProfileRoute>
                <CompleteProfilePage />
              </ProfileRoute>
            }
          />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          />

          {/* Panel TI de Permisos Granulares (/admin/users-permissions) */}
          <Route
            path="/admin/users-permissions"
            element={
              <TIAdminRoute>
                <MainLayout initialTiTab="users_permissions" />
              </TIAdminRoute>
            }
          />

          {/* Rutas directas protegidas por RBAC + banderas user.modules */}
          <Route
            path="/tasks"
            element={
              <ModuleProtectedRoute moduleKey="tasks" blockRH>
                <MainLayout
                  initialEmployeeTab="projects"
                  initialSupervisorTab="tree"
                  initialTiTab="supervisor_view"
                />
              </ModuleProtectedRoute>
            }
          />

          <Route
            path="/clients"
            element={
              <ModuleProtectedRoute moduleKey="clients" blockRH>
                <MainLayout
                  initialSupervisorTab="tree"
                  initialTiTab="supervisor_view"
                />
              </ModuleProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ModuleProtectedRoute moduleKey="reports">
                <MainLayout
                  initialSupervisorTab="report"
                  initialTiTab="audit_accounts"
                />
              </ModuleProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </>
  );
}
