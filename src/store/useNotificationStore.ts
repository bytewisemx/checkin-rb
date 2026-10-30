import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'new_task'
  | 'task_review'
  | 'task_comment'
  | 'system';

/**
 * Entidad notifications requerida:
 * id, recipient_id, sender_id, message, type, read: boolean, created_at
 */
export interface AppNotification {
  id: string;
  recipient_id: string;
  sender_id: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  // Propiedades de UI complementarias
  title: string;
  timeAgo: string;
  createdAt: number;
  taskId?: string;
  taskTitle?: string;
  projectName?: string;
  authorName?: string;
  authorAvatar?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (
    notification: Omit<AppNotification, 'id' | 'createdAt' | 'created_at' | 'read' | 'timeAgo' | 'recipient_id' | 'sender_id'> & {
      recipient_id?: string;
      sender_id?: string;
    }
  ) => AppNotification;
  getNotificationsForUser: (userId?: string, role?: string) => AppNotification[];
  getNotificationsForRecipient: (userId?: string, role?: string) => AppNotification[];
  getUnreadCountForUser: (userId?: string, role?: string) => number;
  markAsRead: (id: string) => void;
  markAllAsRead: (userId?: string) => void;
  clearNotification: (id: string) => void;
  clearAll: (userId?: string) => void;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    recipient_id: 'usr-ana',
    sender_id: 'admin-99',
    type: 'task_assigned',
    title: 'Nueva Tarea Asignada',
    message: 'Tu supervisor te asignó la tarea "1. Planificación Preliminar y Entendimiento del Negocio" en Auditoría Fiscal Anual 2026.',
    timeAgo: 'Hace 15 min',
    createdAt: Date.now() - 15 * 60 * 1000,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    read: false,
    taskId: 'tsk-plan',
    taskTitle: '1. Planificación Preliminar y Entendimiento del Negocio',
    projectName: 'Grupo Baluarte S.A. de C.V. • Auditoría Fiscal Anual 2026',
    authorName: 'Supervisor Prueba',
  },
  {
    id: 'notif-2',
    recipient_id: 'admin-99',
    sender_id: 'usr-ana',
    type: 'task_completed',
    title: 'Tarea Finalizada por Empleado',
    message: 'Colaborador Prueba completó la tarea "Diagnóstico de Activos y Empresas Familiares".',
    timeAgo: 'Hace 40 min',
    createdAt: Date.now() - 40 * 60 * 1000,
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    read: false,
    taskId: 'tsk-patr-1',
    taskTitle: 'Diagnóstico de Activos y Empresas Familiares',
    projectName: 'Dra. Patricia Montes • Planeación Patrimonial y Fiscal',
    authorName: 'Colaborador Prueba',
  },
];

// Canal en tiempo real para sincronizar notificaciones bidireccionales entre pestañas
const notifChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('rb_notifications_realtime_channel')
    : null;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,
      unreadCount: INITIAL_NOTIFICATIONS.filter((n) => !n.read).length,

      addNotification: (data) => {
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const newNotif: AppNotification = {
          id: `notif-${nowMs}-${Math.random().toString(36).substring(2, 6)}`,
          recipient_id: data.recipient_id || 'all',
          sender_id: data.sender_id || 'system',
          createdAt: nowMs,
          created_at: nowIso,
          timeAgo: 'Justo ahora',
          read: false,
          ...data,
        };

        set((state) => {
          const updated = [newNotif, ...state.notifications];
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });

        try {
          notifChannel?.postMessage({ type: 'NEW_NOTIFICATION', notification: newNotif });
        } catch {
          // Ignorar errores de BroadcastChannel
        }

        return newNotif;
      },

      getNotificationsForUser: (userId, role) => {
        const all = get().notifications;
        if (!userId) return all;
        const normRole = (role || '').toUpperCase();
        // RH tiene bloqueado el módulo de tareas/notificaciones de tareas
        if (normRole === 'RH') return [];
        if (normRole === 'TI') return all;

        return all.filter((n) => {
          if (!n.recipient_id || n.recipient_id === 'all') return true;
          if (n.recipient_id === userId) return true;
          // Compatibilidad con cuentas demo de supervisor ('admin-99' / 'sup-1')
          if (normRole === 'SUPERVISOR' && (n.recipient_id === 'admin-99' || n.recipient_id === 'sup-1')) {
            return true;
          }
          // Compatibilidad con cuenta demo de empleado ('usr-ana')
          if ((normRole === 'EMPLEADO' || normRole === 'EMPLOYEE') && n.recipient_id === 'usr-ana' && userId === 'usr-ana') {
            return true;
          }
          return false;
        });
      },

      getUnreadCountForUser: (userId, role) => {
        return get()
          .getNotificationsForUser(userId, role)
          .filter((n) => !n.read).length;
      },

      getNotificationsForRecipient: (userId, role) => {
        return get().getNotificationsForUser(userId, role);
      },

      markAsRead: (id) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
        try {
          notifChannel?.postMessage({ type: 'SYNC_NOTIFICATIONS' });
        } catch {
          // ignore
        }
      },

      markAllAsRead: (userId) => {
        set((state) => {
          const updated = state.notifications.map((n) =>
            !userId || n.recipient_id === userId || n.recipient_id === 'all'
              ? { ...n, read: true }
              : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
        try {
          notifChannel?.postMessage({ type: 'SYNC_NOTIFICATIONS' });
        } catch {
          // ignore
        }
      },

      clearNotification: (id) => {
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id);
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
        try {
          notifChannel?.postMessage({ type: 'SYNC_NOTIFICATIONS' });
        } catch {
          // ignore
        }
      },

      clearAll: (userId) => {
        set((state) => {
          const updated = userId
            ? state.notifications.filter((n) => n.recipient_id !== userId && n.recipient_id !== 'all')
            : [];
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          };
        });
        try {
          notifChannel?.postMessage({ type: 'SYNC_NOTIFICATIONS' });
        } catch {
          // ignore
        }
      },
    }),
    {
      name: 'rb-notifications-storage',
    }
  )
);

// Listener en tiempo real para sincronizar entre pestañas (Supervisor <-> Empleado) sin recargar
if (typeof window !== 'undefined') {
  notifChannel?.addEventListener('message', (event) => {
    if (event.data?.type === 'NEW_NOTIFICATION' || event.data?.type === 'SYNC_NOTIFICATIONS') {
      useNotificationStore.persist.rehydrate();
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'rb-notifications-storage') {
      useNotificationStore.persist.rehydrate();
    }
  });
}
