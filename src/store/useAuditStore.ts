import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuditEventType =
  | 'REPORT_DOWNLOADED'
  | 'PROJECT_BUDGET_EDITED'
  | 'STATUS_CHANGED'
  | 'ATTENDANCE_ADJUSTED'
  | 'USER_ROLE_CHANGED'
  | 'INVITATION_CREATED';

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  targetResource: string; // ej. "Proyecto: Auditoría Grupo Bimbo 2026"
  targetUserId?: string;
  targetUserName?: string;
  format?: 'PDF' | 'Excel';
  details: string;
  previousValue?: string | number;
  newValue?: string | number;
  timestamp: number; // Date.now()
  ipAddress?: string;
}

interface AuditStoreState {
  logs: AuditLogEntry[];
  logAuditEvent: (
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: number }
  ) => void;
  clearLogs: () => void;
}

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const useAuditStore = create<AuditStoreState>()(
  persist(
    (set) => ({
      logs: INITIAL_AUDIT_LOGS,

      logAuditEvent: (entry) => {
        const newLog: AuditLogEntry = {
          ...entry,
          id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: entry.timestamp || Date.now(),
        };

        set((state) => ({
          logs: [newLog, ...state.logs],
        }));
      },

      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: 'checkin-rb-audit-logs-v1',
    }
  )
);

