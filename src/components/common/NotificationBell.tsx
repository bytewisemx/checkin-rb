import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  CheckSquare,
  Clock,
  MessageSquare,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  useNotificationStore,
  type NotificationType,
} from '../../store/useNotificationStore';
import { useCheckinStore } from '../../store/useCheckinStore';
import { normalizeRole } from '../../services/rbac';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = useCheckinStore((state) => state.user);
  const {
    notifications,
    getNotificationsForUser,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  } = useNotificationStore();

  const userRole = normalizeRole(user?.role);

  // Notificaciones dirigidas al usuario actual (Supervisor o Empleado)
  const userNotifications = useMemo(() => {
    return getNotificationsForUser(user?.id, userRole);
  }, [notifications, user?.id, userRole, getNotificationsForUser]);

  const userUnreadCount = useMemo(() => {
    return userNotifications.filter((n) => !n.read).length;
  }, [userNotifications]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // RH no tiene acceso a notificaciones de tareas ni proyectos
  if (userRole === 'RH') {
    return null;
  }

  const filteredNotifications = userNotifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getIconForType = (type: NotificationType) => {
    switch (type) {
      case 'task_assigned':
      case 'new_task':
        return (
          <div className="w-7 h-7 rounded bg-slate-100 dark:bg-[#1A2742] text-blue-700 dark:text-[#38BDF8] flex items-center justify-center shrink-0">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
        );
      case 'task_review':
        return (
          <div className="w-7 h-7 rounded bg-slate-100 dark:bg-[#1A2742] text-amber-700 dark:text-[#F59E0B] flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
        );
      case 'task_completed':
        return (
          <div className="w-7 h-7 rounded bg-slate-100 dark:bg-[#1A2742] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <CheckCheck className="w-3.5 h-3.5" />
          </div>
        );
      case 'task_comment':
        return (
          <div className="w-7 h-7 rounded bg-slate-100 dark:bg-[#1A2742] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded bg-slate-100 dark:bg-[#1A2742] text-slate-600 dark:text-[#94A3B8] flex items-center justify-center shrink-0">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón Campana en el Header (Monocromático sobrio) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Bandeja de notificaciones en tiempo real"
        className="relative p-1.5 text-slate-400 hover:text-[#1E40AF] dark:text-[#94A3B8] dark:hover:text-[#38BDF8] transition-colors cursor-pointer"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4" />

        {/* Indicador de no leídas */}
        {userUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 bg-[#1E40AF] dark:bg-[#38BDF8] text-white dark:text-[#0F172A] text-[9px] font-bold rounded-full flex items-center justify-center">
            {userUnreadCount > 9 ? '9+' : userUnreadCount}
          </span>
        )}
      </button>

      {/* Popover Desplegable de Notificaciones */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 bg-white dark:bg-[#131D31] rounded-md shadow-xl border border-slate-200 dark:border-[#233354] overflow-hidden z-50 animate-scale-up text-slate-800 dark:text-[#F8FAFC]">
          {/* Cabecera Sobria del Panel (Sin Degradados Azules Rígidos) */}
          <div className="px-4 py-3 bg-white dark:bg-[#131D31] border-b border-slate-200 dark:border-[#233354] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-xs tracking-tight text-slate-900 dark:text-[#F8FAFC]">
                Notificaciones ({userRole})
              </span>
              {userUnreadCount > 0 && (
                <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  ({userUnreadCount} nuevas)
                </span>
              )}
            </div>

            {userUnreadCount > 0 && (
              <button
                onClick={() => markAllAsRead(user?.id, userRole)}
                title="Marcar todas como leídas"
                className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-[#38BDF8] dark:hover:underline flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Marcar leídas</span>
              </button>
            )}
          </div>

          {/* Filtros: Todas vs No Leídas (Diseño Abierto con Subrayado) */}
          <div className="flex items-center space-x-6 px-4 border-b border-slate-100 dark:border-[#233354] text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`py-2.5 font-medium transition-colors relative cursor-pointer ${
                filter === 'all'
                  ? 'text-slate-900 dark:text-[#F8FAFC] font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              <span>Todas ({userNotifications.length})</span>
              {filter === 'all' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-700 dark:bg-[#38BDF8] rounded-t" />
              )}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`py-2.5 font-medium transition-colors relative cursor-pointer ${
                filter === 'unread'
                  ? 'text-slate-900 dark:text-[#F8FAFC] font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              <span>No leídas ({userUnreadCount})</span>
              {filter === 'unread' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-700 dark:bg-[#38BDF8] rounded-t" />
              )}
            </button>
          </div>

          {/* Lista de Notificaciones */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#233354]">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`p-3.5 transition-colors flex items-start space-x-3 cursor-pointer group relative ${
                    !n.read 
                      ? 'bg-slate-50/70 dark:bg-[#1A2742]/40 hover:bg-slate-100/70 dark:hover:bg-[#1A2742]/70' 
                      : 'hover:bg-slate-50 dark:hover:bg-[#1A2742]/30'
                  }`}
                >
                  {getIconForType(n.type)}

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center space-x-2">
                      <h4
                        className={`text-xs font-semibold truncate ${
                          !n.read 
                            ? 'text-slate-900 dark:text-[#F8FAFC]' 
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {n.title}
                      </h4>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-700 dark:bg-[#38BDF8] shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 dark:text-[#94A3B8] mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>

                    {n.projectName && (
                      <span className="block text-[11px] font-medium text-slate-500 dark:text-[#94A3B8] mt-1 truncate">
                        {n.projectName}
                      </span>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-[#64748B] mt-1.5">
                      <span>{n.timeAgo}</span>
                      {n.authorName && (
                        <span>
                          De: <b className="font-semibold text-slate-600 dark:text-[#94A3B8]">{n.authorName}</b>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotification(n.id);
                    }}
                    title="Descartar notificación"
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-opacity p-1 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 rounded bg-slate-100 dark:bg-[#1A2742] text-slate-400 dark:text-[#64748B] mx-auto flex items-center justify-center mb-2">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-[#F8FAFC]">
                  {filter === 'unread'
                    ? 'No tienes notificaciones pendientes'
                    : 'Tu bandeja está vacía'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-[#64748B] mt-0.5 max-w-xs mx-auto">
                  Aquí recibirás notificaciones cuando se asignen o finalicen tareas.
                </p>
              </div>
            )}
          </div>

          {userNotifications.length > 0 && (
            <div className="px-4 py-2.5 bg-slate-50/60 dark:bg-[#0F172A] border-t border-slate-100 dark:border-[#233354] flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400 dark:text-[#64748B] font-medium">
                Sincronización en tiempo real activa
              </span>
              <button
                onClick={() => clearAll(user?.id, userRole, userNotifications.map((n) => n.id))}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-white flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpiar bandeja</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
