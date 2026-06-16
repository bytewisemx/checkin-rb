import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useCheckinStore } from './store/useCheckinStore';

// Vistas
import { AuthPage } from './features/auth/AuthPage';
import { CompleteProfilePage } from './features/auth/CompleteProfilePage';
import { CalendarView } from './features/history/CalendarView';
import { CheckinPanel } from './features/checkin/CheckinPanel';
import { SupervisorDashboard } from './features/manager/SupervisorDashboard';

// Componentes UI Globales
import { Button } from './components/common/Button';
import { ToastContainer } from './components/common/ToastContainer';
import { MiniPlayerWidget } from './components/common/MiniPlayerWidget';
import { LogOut, User } from 'lucide-react';

function EmployeeDashboard() {
  return (
    <main className="max-w-4xl mx-auto pb-12 animate-fade-in">
      <CheckinPanel />
      <CalendarView />
    </main>
  );
}

function MainLayout() {
  const { user, logout } = useCheckinStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-rb-navy text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center font-bold">
              RB
            </div>
            <span className="font-semibold tracking-wide">
              Checkin <span className="hidden sm:inline font-normal opacity-80 text-sm ml-2">Russell Bedford</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center text-sm bg-white/10 px-3 py-1 rounded-full">
              <User className="w-4 h-4 mr-2" />
              {user?.name} {user?.lastName}
              {user?.role === 'supervisor' && <span className="ml-2 px-1.5 py-0.5 bg-rb-turquoise rounded text-[10px] uppercase font-bold text-rb-navy">Admin</span>}
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="border-white/20 text-white hover:bg-white/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {user?.role === 'supervisor' ? <SupervisorDashboard /> : <EmployeeDashboard />}

    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCheckinStore(state => state.isAuthenticated);
  const isProfileComplete = useCheckinStore(state => state.user?.isProfileComplete);

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!isProfileComplete) return <Navigate to="/complete-profile" />;

  return <>{children}</>;
}

function ProfileRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useCheckinStore(state => state.isAuthenticated);
  const isProfileComplete = useCheckinStore(state => state.user?.isProfileComplete);

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (isProfileComplete) return <Navigate to="/" />;

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ToastContainer />
      <Router>
        <Routes>
          <Route path="/login" element={<AuthPage />} />

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
        </Routes>
      </Router>
    </>
  );
}
