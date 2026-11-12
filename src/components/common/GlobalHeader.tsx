import { useState, useMemo, useEffect } from 'react';
import {
  RefreshCw,
  HelpCircle,
  Settings,
  LogOut,
  Sliders,
  Sun,
  Moon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useGamificationStore } from '../../store/useGamificationStore';
import { useHelpTourStore } from '../../store/useHelpTourStore';
import { calculateGamification } from '../../services/gamification';
import { logoutFirebase } from '../../services/firebase';
import { normalizeRole, getEffectiveModules } from '../../services/rbac';
import { UserProfileModal } from './UserProfileModal';
import { UserAvatar } from './UserAvatar';
import { NotificationBell } from './NotificationBell';
import { GlobalSearchBar } from './GlobalSearchBar';
import { HelpDrawer } from '../help/HelpDrawer';
import { ProductTour } from '../help/ProductTour';

export function GlobalHeader() {
  const navigate = useNavigate();
  const {
    user,
    getEffectiveUserModules,
    addToast,
    history,
    activeCheckin,
    logout,
    theme,
    toggleTheme,
  } = useCheckinStore();
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

  // Nombre de equipo dinámico y etiqueta de rol sobria
  const teamName =
    user?.team ||
    (user as unknown as { teamName?: string })?.teamName ||
    (normalizedRole === 'TI'
      ? 'Equipo TI & Ciberseguridad'
      : normalizedRole === 'RH'
      ? 'Equipo Recursos Humanos'
      : normalizedRole === 'Socio'
      ? 'Jefatura y Dirección'
      : normalizedRole === 'Gerente'
      ? 'Gerencia de Auditoría'
      : 'Equipo General');

  const roleLabel =
    normalizedRole === 'TI'
      ? 'Admin TI Root'
      : normalizedRole === 'Socio'
      ? 'Socio / Jefatura'
      : normalizedRole === 'Gerente'
      ? 'Gerente'
      : normalizedRole === 'Supervisor'
      ? 'Supervisor'
      : normalizedRole === 'RH'
      ? 'Recursos Humanos'
      : 'Colaborador';

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

  return (
    <>
      <header className="bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 h-14 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
        {/* Lado Izquierdo: Botón de Sincronización + Nombre de Equipo Dinámico y Rol */}
        <div className="flex items-center gap-3 min-w-0 max-w-[40%]">
          {/* Botón de Sincronizar / Refrescar */}
          <button
            id="btn-refresh"
            onClick={handleReload}
            title="Sincronizar y actualizar datos"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer group shrink-0"
            aria-label="Actualizar datos"
          >
            <RefreshCw
              className={`w-4 h-4 transition-transform duration-500 ${
                isReloading ? 'animate-spin' : 'group-hover:rotate-180'
              }`}
            />
          </button>

          {/* Nombre del Equipo Dinámico + Rol Opcional */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              onClick={() => navigate('/')}
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight font-['Inter',sans-serif] truncate cursor-pointer hover:text-blue-700 dark:hover:text-[#38BDF8] transition-colors"
              title={teamName}
            >
              {teamName}
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-block">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Centro: Buscador Universal Plano */}
        <div className="flex-1 flex justify-center max-w-xl px-2">
          <GlobalSearchBar
            onOpenProfile={() => setProfileOpen(true)}
            onOpenHelp={toggleHelpDrawer}
          />
        </div>

        {/* Lado Derecho: Selección mínima de iconos monocromáticos formales */}
        <div className="flex items-center justify-end space-x-3 sm:space-x-4 w-1/4">
          {normalizedRole === 'TI' && (
            <button
              onClick={() => navigate('/admin/users-permissions')}
              className="hidden xl:inline-flex items-center space-x-1.5 p-1.5 text-slate-400 hover:text-[#1E40AF] dark:text-[#94A3B8] dark:hover:text-[#38BDF8] text-xs font-heading font-medium cursor-pointer transition-colors"
              title="Matriz de accesos y permisos (/admin/users-permissions)"
            >
              <Sliders className="w-4 h-4" />
              <span>Accesos</span>
            </button>
          )}

          {/* Tonalidad Claro / Oscuro (Monocromático) */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-400 hover:text-[#1E40AF] dark:text-[#94A3B8] dark:hover:text-[#38BDF8] transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Cambiar a Vista Clara' : 'Cambiar a Vista Oscura'}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Asistencia / Guía (HelpCircle) */}
          <button
            id="btn-help"
            onClick={toggleHelpDrawer}
            className="p-1.5 text-slate-400 hover:text-[#1E40AF] dark:text-[#94A3B8] dark:hover:text-[#38BDF8] transition-colors cursor-pointer"
            title="Asistencia y Guías Interactivas"
            aria-label="Abrir centro de ayuda"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Notificaciones: Campana sobria (Bell) */}
          {normalizedRole !== 'RH' && effectiveModules.tasks && <NotificationBell />}

          {/* Configuración / Perfil: Engranaje discreto (Settings) y Usuario (User) */}
          <button
            id="nav-settings"
            onClick={() => setProfileOpen(true)}
            title={`Perfil y Configuración (${normalizedRole})`}
            className="group flex items-center space-x-2 text-slate-400 hover:text-[#1E40AF] dark:text-[#94A3B8] dark:hover:text-[#38BDF8] transition-colors cursor-pointer select-none py-1 px-1"
          >
            <Settings className="w-4 h-4" />
            <span className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#1E40AF] dark:group-hover:text-[#38BDF8] hidden lg:inline-block max-w-[125px] truncate transition-colors">
              {user?.name} {user?.lastName || ''}
            </span>
            <UserAvatar
              photoURL={user?.photoURL || user?.profileImage}
              name={user?.name}
              lastName={user?.lastName}
              size="sm"
            />
          </button>

          {/* Salir */}
          <button
            onClick={handleQuickLogout}
            title="Cerrar sesión"
            className="p-1.5 text-slate-400 hover:text-[#1E40AF] dark:text-[#94A3B8] dark:hover:text-[#38BDF8] transition-colors cursor-pointer"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <HelpDrawer />
      <ProductTour />
    </>
  );
}
