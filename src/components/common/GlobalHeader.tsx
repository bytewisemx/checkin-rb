import { useState, useMemo, useEffect } from 'react';
import { RefreshCw, HelpCircle, User, LogOut, Sliders, Sun, Moon } from 'lucide-react';
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
import { GlobalSearchBar } from './GlobalSearchBar';
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
      <header className="bg-white dark:bg-[#131D31] text-slate-800 dark:text-[#F8FAFC] border-b border-slate-200 dark:border-[#233354] h-14 flex items-center justify-between px-4 sticky top-0 z-40">
        {/* Lado Izquierdo: Botón de Recargar Limpio (Sin recuadro) */}
        <div className="flex items-center w-1/4">
          <button
            onClick={handleReload}
            title="Recargar página"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] transition-colors cursor-pointer group rounded-md"
            aria-label="Recargar"
          >
            <RefreshCw
              className={`w-4 h-4 transition-transform duration-500 ${
                isReloading ? 'animate-spin' : 'group-hover:rotate-180'
              }`}
            />
          </button>
        </div>

        {/* Centro: Buscador Universal y Accesos Directos (Proyectos, Clientes, Fecha de Asistencia) */}
        <div className="flex-1 flex justify-center max-w-2xl px-2">
          <GlobalSearchBar
            onOpenProfile={() => setProfileOpen(true)}
            onOpenHelp={toggleHelpDrawer}
          />
        </div>

        {/* Lado Derecho (Iconos limpios sin recuadros) */}
        <div className="flex items-center justify-end space-x-3 sm:space-x-3.5 w-1/4">
          {normalizedRole === 'TI' && (
            <button
              onClick={() => navigate('/admin/users-permissions')}
              className="hidden xl:inline-flex items-center space-x-1 px-2 py-1 text-blue-600 hover:text-blue-700 dark:text-sky-400 dark:hover:text-sky-300 text-xs font-heading font-semibold cursor-pointer transition-colors"
              title="Abrir matriz de módulos por usuario (/admin/users-permissions)"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Permisos</span>
            </button>
          )}

          {/* Botón de Tonalidad Rápido (Claro / Oscuro) - Limpio */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer rounded-md"
            title={theme === 'dark' ? 'Cambiar a Tonalidad Clara' : 'Cambiar a Tonalidad Oscura'}
            aria-label="Cambiar tema claro u oscuro"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 hover:text-blue-600 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* Botón de Ayuda - Limpio */}
          <button
            id="btn-help"
            onClick={toggleHelpDrawer}
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer rounded-md"
            title="Ayuda y Guías Interactivas"
            aria-label="Abrir centro de ayuda"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Bandeja de Notificaciones de Tareas (oculta para RH o si user.modules.tasks === false) */}
          {normalizedRole !== 'RH' && effectiveModules.tasks && <NotificationBell />}

          {/* Pastilla de Perfil - Abierta y sin cajita tosca */}
          <button
            id="nav-settings"
            onClick={() => setProfileOpen(true)}
            title={`Rol: ${normalizedRole} • Rango: ${gamification.rank.title}. Haz clic para ver perfil y ajustes.`}
            className="group flex items-center space-x-2 text-slate-700 hover:text-slate-900 dark:text-[#F8FAFC] dark:hover:text-white transition-colors cursor-pointer select-none px-1 py-1"
          >
            <RankMedal tier={gamification.rank.tier} size="sm" />

            <span className="text-xs font-semibold text-slate-900 dark:text-[#F8FAFC] hidden lg:inline-block max-w-[120px] truncate">
              {user?.name} {user?.lastName || ''}
            </span>

            <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-slate-500 dark:text-[#94A3B8]" />
              )}
            </div>
          </button>

          {/* Botón de Salir Rápido - Limpio */}
          <button
            onClick={handleQuickLogout}
            title="Cerrar sesión e ir a la pantalla de inicio"
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer rounded-md"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
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
