import { useState } from 'react';
import { ShieldAlert, RefreshCw, LogOut, Users } from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { logoutFirebase } from '../../services/firebase';
import { handleUserSession } from '../../services/userService';
import { normalizeRole, getRoleDisplayName } from '../../services/rbac';

export function PendingTeamAssignmentNotice() {
  const { user, logout, addToast } = useCheckinStore();
  const [isChecking, setIsChecking] = useState(false);

  const normRole = normalizeRole(user?.role);

  const handleRefreshStatus = async () => {
    if (!user) return;
    setIsChecking(true);
    try {
      const res = await handleUserSession({
        uid: user.id,
        email: user.email,
        displayName: user.name,
        photoURL: user.photoURL,
      });

      if (
        res.user &&
        res.user.team &&
        res.user.team !== 'Sin equipo asignado' &&
        res.user.team !== 'Sin equipo' &&
        res.user.status !== 'inactive'
      ) {
        addToast('¡Equipo asignado! Acceso operativo concedido.', 'success');
        window.location.reload();
      } else {
        addToast('Aún no tienes un equipo activo asignado.', 'info');
      }
    } catch (err) {
      console.warn('[PendingTeamAssignmentNotice] Error al verificar estatus:', err);
      addToast('Error al comprobar asignación con el servidor.', 'error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutFirebase();
    } catch (err) {
      console.warn('[PendingTeamAssignmentNotice] Error al cerrar sesión en Firebase:', err);
    }
    logout();
    window.location.href = '#/login';
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-16 animate-fade-in">
      <div className="bg-white dark:bg-[#101726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Barra superior de acento */}
        <div className="h-1.5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600" />

        <div className="p-8 sm:p-10 space-y-6">
          {/* Encabezado y Estado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Asignación de Equipo Pendiente
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Control de Acceso y Operaciones Corporativas
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 self-start sm:self-center">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              • Inhabilitado / Sin Equipo
            </span>
          </div>

          {/* Mensaje Informativo Estricto */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                Tu cuenta se encuentra pendiente de asignación a un equipo de trabajo. Contacta al Administrador TI o a tu Gerente.
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 pl-6.5">
              Por políticas de seguridad y gobernanza RBAC, el registro de checadas biométricas, la visualización de proyectos y la distribución de tareas requieren pertenecer formalmente a una práctica o equipo corporativo activo.
            </p>
          </div>

          {/* Tarjeta de Datos del Usuario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Colaborador
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {user?.name} {user?.lastName || ''}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {user?.email}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Rol Solicitado / Asignado
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {getRoleDisplayName(normRole)}
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mt-0.5">
                Estado: Requiere vinculación de equipo
              </p>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleRefreshStatus}
              disabled={isChecking}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Comprobando...' : 'Comprobar Asignación'}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

