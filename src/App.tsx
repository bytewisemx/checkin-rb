import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useCheckinStore } from './store/useCheckinStore';
import { useState } from 'react';

// Vistas
import { AuthPage } from './features/auth/AuthPage';
import { CompleteProfilePage } from './features/auth/CompleteProfilePage';
import { CalendarView } from './features/history/CalendarView';
import { CheckinPanel } from './features/checkin/CheckinPanel';
import { SupervisorDashboard } from './features/manager/SupervisorDashboard';
import { KanbanBoard } from './features/projects/KanbanBoard';

// Componentes UI Globales
import { Clock, LayoutGrid } from 'lucide-react';
import { ToastContainer } from './components/common/ToastContainer';

function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState<'checkin' | 'projects'>('checkin');

  return (
    <main className="w-full pb-12 px-4 lg:px-8 animate-fade-in">
      <div className="flex justify-center mt-6 mb-2">
        <div className="bg-[#f9f7f6] p-1.5 rounded-full border border-slate-200 shadow-sm flex items-center space-x-1">
          <button 
            onClick={() => setActiveTab('checkin')}
            className={`flex items-center px-6 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'checkin' ? 'bg-white text-rb-navy shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <Clock className="w-4 h-4 mr-2" />
            Asistencia Global
          </button>
          <button 
            onClick={() => setActiveTab('projects')}
            className={`flex items-center px-6 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'projects' ? 'bg-white text-rb-navy shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Proyectos y Tareas
          </button>
        </div>
      </div>

      {activeTab === 'checkin' ? (
        <div className="animate-fade-in w-full max-w-[1600px] mx-auto">
          <CheckinPanel />
          <CalendarView />
        </div>
      ) : (
        <KanbanBoard />
      )}
    </main>
  );
}

import { GlobalHeader } from './components/common/GlobalHeader';

function MainLayout() {
  const { user } = useCheckinStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <GlobalHeader />

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
      <Router basename={import.meta.env.BASE_URL}>
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
