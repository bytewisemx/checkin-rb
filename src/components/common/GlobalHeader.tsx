import { useState, useMemo, useEffect } from 'react';
import { RefreshCw, Search, HelpCircle, User, LogOut, ShieldAlert, Sliders, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useGamificationStore } from '../../store/useGamificationStore';
import { useHelpTourStore } from '../../store/useHelpTourStore';
import { calculateGamification } from '../../services/gamification';
import { logoutFirebase } from '../../services/firebase';
import { normalizeRole, getEffectiveModules } from '../../services/rbac';
import { RankMedal } from './RankMedal';
import { UserProfileModal } from './UserProfileModal';
import { NotificationBell } from './NotificationBell';
import { HelpDrawer } from '../help/HelpDrawer';
import { ProductTour } from '../help/ProductTour';

export function GlobalHeader() {
  const navigate = useNavigate();
  const { user, getEffectiveUserModules, addToast, history, activeCheckin, logout, theme, toggleTheme } = useCheckinStore();
  const {
    manualEditsByDate,
    taskSwitchesByDate,
    checkAndResetSeason,
  } = useGamificationStore();

  const [profileOpen, setProfileOpen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const { toggleHelpDrawer } = useHelpTourStore();

  const normalizedRole = normalizeRole(user?.role);
  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);
  const hideTasksAndProjectsUI = normalizedRole === 'RH' || (!effectiveModules.tasks && !effectiveModules.clients);

  const gamification = useMemo(() => {
    return calculateGamification({
      history,
      activeCheckin,
      manualEditsByDate,
      taskSwitchesByDate,
      expectedEntryTime: user?.expectedEntryTime || '09:00',
    });
  }, [history, activeCheckin, manualEditsByDate, taskSwitchesByDate, user]);

  useEffect(() => {
    checkAndResetSeason(gamification.points, gamification.rank.tier);
  }, [gamification.points, gamification.rank.tier, checkAndResetSeason]);

  const handleReload = () => {
    setIsReloading(true);
    addToast('Recargando datos...', 'info');
    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  const handleQuickLogout = async () => {
    await logoutFirebase();
    logout();
    addToast('Sesión cerrada. Regresando a pantalla de inicio.', 'info');
  };

  const getRoleBadgeStyle = () => {
    switch (normalizedRole) {
      case 'TI':
        return 'bg-[#1E40AF]/20 text-[#38BDF8] border-[#1E40AF]/50';
      case 'Supervisor':
        return 'bg-[#0F172A] text-[#38BDF8] border-[#233354]';
      case 'RH':
        return 'bg-[#1A2742] text-[#F59E0B] border-[#F59E0B]/40';
      default:
        return 'bg-[#1A2742] text-[#F8FAFC] border-[#233354]';
    }
  };

  return (
    <>
      <header className="bg-[#131D31] text-[#F8FAFC] border-b border-[#233354] h-14 flex items-center justify-between px-4 sticky top-0 z-40">
        {/* Lado Izquierdo: Botón de Recargar + Indicador de Rol RBAC */}
        <div className="flex items-center space-x-2.5 w-1/4">
          <button
            onClick={handleReload}
            title="Recargar página"
            className="flex items-center justify-center w-8 h-8 rounded-md bg-[#1A2742] hover:bg-[#233354] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer border border-[#233354] group"
            aria-label="Recargar"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 transition-transform duration-500 ${
                isReloading ? 'animate-spin' : 'group-hover:rotate-180'
              }`}
            />
          </button>

          <span
            className={`text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border hidden sm:inline-flex items-center space-x-1 ${getRoleBadgeStyle()}`}
          >
            <span>ROL: {normalizedRole}</span>
          </span>
        </div>

        {/* Centro: Si es RH o tiene módulos tasks/clients deshabilitados, no renderiza buscador de proyectos/tareas */}
        <div className="flex-1 flex justify-center max-w-2xl">
          {hideTasksAndProjectsUI ? (
            <div className="flex items-center space-x-2 bg-[#1A2742] border border-[#233354] text-[#38BDF8] px-3.5 py-1.5 rounded-md text-xs font-medium">
              <ShieldAlert className="w-4 h-4 text-[#38BDF8] shrink-0" />
              <span className="truncate">
                {normalizedRole === 'RH'
                  ? 'PERFIL RH RESTRINGIDO • Solo Lectura de Asistencia y Horas (Sin acceso a Tareas ni Clientes)'
                  : 'MODO ASISTENCIA PURA • Módulo de Tareas deshabilitado para tu cuenta por TI'}
              </span>
            </div>
          ) : (
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Buscar proyectos, tareas o personas..."
                className="w-full bg-[#1A2742] text-[#F8FAFC] placeholder:text-[#64748B] text-xs rounded-md py-1.5 pl-9 pr-3.5 border border-[#233354] focus:border-[#38BDF8] transition-all"
              />
            </div>
          )}
        </div>

        {/* Lado Derecho */}
        <div className="flex items-center justify-end space-x-2 w-1/4">
          {normalizedRole === 'TI' && (
            <button
              onClick={() => navigate('/admin/users-permissions')}
              className="hidden xl:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#1E40AF] hover:bg-[#1D4ED8] text-white border border-[#1E40AF] text-[11px] font-heading font-semibold cursor-pointer transition-colors shadow-xs"
              title="Abrir matriz de módulos por usuario (/admin/users-permissions)"
            >
              <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Permisos</span>
            </button>
          )}

          {/* Botón de Tonalidad Rápido (Claro / Oscuro) */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-md bg-[#1A2742] border border-[#233354] flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#38BDF8] transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Cambiar a Tonalidad Clara' : 'Cambiar a Tonalidad Oscura'}
            aria-label="Cambiar tema claro u oscuro"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 hover:text-blue-600 transition-transform hover:-rotate-12" />
            )}
          </button>

          <button
            id="btn-help"
            onClick={toggleHelpDrawer}
            className="w-8 h-8 rounded-md bg-[#1A2742] border border-[#233354] flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#38BDF8] transition-colors cursor-pointer"
            title="Ayuda y Guías Interactivas"
            aria-label="Abrir centro de ayuda"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Bandeja de Notificaciones de Tareas (oculta para RH o si user.modules.tasks === false) */}
          {normalizedRole !== 'RH' && effectiveModules.tasks && <NotificationBell />}

          {/* Pastilla de Perfil */}
          <button
            id="nav-settings"
            onClick={() => setProfileOpen(true)}
            title={`Rol: ${normalizedRole} • Rango: ${gamification.rank.title}. Haz clic para ver perfil y ajustes.`}
            className="group flex items-center bg-[#1A2742] rounded-md p-1 pl-2 border border-[#233354] hover:border-[#38BDF8] transition-all h-8 cursor-pointer select-none"
          >
            <div className="mr-1.5 flex items-center">
              <RankMedal tier={gamification.rank.tier} size="sm" />
            </div>

            <span className="text-xs font-medium text-[#F8FAFC] hidden lg:inline-block mr-2 max-w-[120px] truncate">
              {user?.name} {user?.lastName || ''}
            </span>

            <div
              className="w-6 h-6 rounded-md overflow-hidden bg-[#0B111E] border border-[#233354] flex items-center justify-center transition-transform group-hover:scale-105"
            >
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#94A3B8]" />
              )}
            </div>
          </button>

          {/* Botón de Salir Rápido */}
          <button
            onClick={handleQuickLogout}
            title="Cerrar sesión e ir a la pantalla de inicio"
            className="flex items-center justify-center w-8 h-8 rounded-md bg-[#1A2742] hover:bg-[#E11D48]/20 text-[#94A3B8] hover:text-[#E11D48] transition-colors cursor-pointer border border-[#233354] hover:border-[#E11D48]/40"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Modal de Perfil y Ajustes */}
      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* Drawer Lateral de Ayuda Contextual por Rol */}
      <HelpDrawer />

      {/* Motor de Recorrido Interactivo Paso a Paso (Product Tour) */}
      <ProductTour />
    </>
  );
}
