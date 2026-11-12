import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useCheckinStore } from './store/useCheckinStore';
import { useNotificationStore } from './store/useNotificationStore';
import { useState, useEffect } from 'react';
import { normalizeRole, getEffectiveModules, type UserModules } from './services/rbac';
import { subscribeToAuthState, isFirebaseConfigured } from './services/firebase';
import { handleUserSession } from './services/userService';

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
import { ToastContainer } from './components/common/ToastContainer';
import { GlobalHeader } from './components/common/GlobalHeader';
import { CheckinLoader } from './components/common/CheckinLoader';

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
    <main className="w-full pb-12 px-4 lg:px-8 animate-fade-in bg-[#F8FAFC] dark:bg-[#090E17] text-slate-900 dark:text-slate-200">
      {/* Aviso editorial de notificación de tarea */}
      {canAccessTasks && unreadTaskAlerts.length > 0 && (
        <div className="max-w-7xl mx-auto py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-[#1E40AF] dark:text-[#38BDF8]">
                NOTIFICACIÓN DE TAREA
              </span>
              <span className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                • Supervisor: {user?.supervisorName || 'Líder de Equipo'}
              </span>
            </div>
            <p className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">
              {unreadTaskAlerts[0].message}
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => {
                setActiveTab('projects');
                markAsRead(unreadTaskAlerts[0].id);
              }}
              className="px-3.5 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-heading font-semibold transition-colors cursor-pointer"
            >
              Ver Mis Tareas
            </button>
            <button
              onClick={() => markAsRead(unreadTaskAlerts[0].id)}
              className="text-xs font-heading font-medium text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Navegación de Pestañas Editorial (Sin Recuadros ni Iconos Decorativos) */}
      <div className="max-w-7xl mx-auto flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pt-6 mb-6">
        <div className="flex items-center space-x-8">
          {canAccessCheckIn && (
            <button
              onClick={() => setActiveTab('checkin')}
              className={`pb-3 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                resolvedTab === 'checkin'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Asistencia Global
              {resolvedTab === 'checkin' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>
          )}

          {canAccessTasks && (
            <button
              onClick={() => setActiveTab('projects')}
              className={`pb-3 text-xs font-heading font-semibold uppercase tracking-wider transition-colors relative cursor-pointer ${
                resolvedTab === 'projects'
                  ? 'text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'text-[#475569] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Mis Tareas Asignadas
              {resolvedTab === 'projects' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E40AF] dark:bg-[#38BDF8]" />
              )}
            </button>
          )}
        </div>

        {!canAccessTasks && (
          <span className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] pb-3">
            Modo de Entrada / Salida (Módulo de tareas inactivo)
          </span>
        )}
      </div>

      {resolvedTab === 'checkin' ? (
        <div className="animate-fade-in w-full max-w-7xl mx-auto">
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090E17] text-slate-900 dark:text-slate-200">
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

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCheckinStore((state) => state.isAuthenticated);
  const user = useCheckinStore((state) => state.user);
  const isProfileComplete = Boolean(user?.isProfileComplete || (user?.name && user?.role));

  if (isAuthenticated && isProfileComplete) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCheckinStore((state) => state.isAuthenticated);
  const user = useCheckinStore((state) => state.user);
  const isProfileComplete = Boolean(user?.isProfileComplete || (user?.name && user?.role));

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isProfileComplete) return <Navigate to="/register" replace />;

  return <>{children}</>;
}

function ProfileRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCheckinStore((state) => state.isAuthenticated);
  const user = useCheckinStore((state) => state.user);
  const isProfileComplete = Boolean(user?.isProfileComplete || (user?.name && user?.role));

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isProfileComplete) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function TIAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useCheckinStore();
  const isProfileComplete = Boolean(user?.isProfileComplete || (user?.name && user?.role));

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isProfileComplete) return <Navigate to="/register" replace />;
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
  const isProfileComplete = Boolean(user?.isProfileComplete || (user?.name && user?.role));

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isProfileComplete) return <Navigate to="/register" replace />;

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
  const { globalLoading } = useCheckinStore();

  // Sincronización transparente de sesión con Firebase Auth en segundo plano
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = subscribeToAuthState(async (fbUser) => {
      if (fbUser) {
        try {
          const state = useCheckinStore.getState();
          // Si el usuario ya está autenticado con perfil completo para este UID, no hay nada que bloquear
          if (!state.isAuthenticated || state.user?.id !== fbUser.uid || !state.user?.isProfileComplete) {
            await handleUserSession({
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
            });
          }
        } catch (err) {
          console.error('[App] Error al verificar sesión en Firebase:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <ToastContainer />
      {globalLoading?.active && <CheckinLoader text={globalLoading.message} />}
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <AuthPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />

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

          <Route
            path="/admin/users-permissions"
            element={
              <TIAdminRoute>
                <MainLayout initialTiTab="users_permissions" />
              </TIAdminRoute>
            }
          />

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
