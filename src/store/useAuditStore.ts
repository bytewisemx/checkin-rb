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

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-001',
    eventType: 'REPORT_DOWNLOADED',
    actorId: 'admin-99',
    actorName: 'Carlos Mendoza',
    actorEmail: 'c.mendoza@russellbedford.mx',
    actorRole: 'Gerente',
    targetResource: 'Proyecto: Auditoría Financiera Anual 2026',
    format: 'Excel',
    details: 'Descarga de Kardex y desglose de horas por colaborador',
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
  },
  {
    id: 'log-002',
    eventType: 'PROJECT_BUDGET_EDITED',
    actorId: 'admin-99',
    actorName: 'Carlos Mendoza',
    actorEmail: 'c.mendoza@russellbedford.mx',
    actorRole: 'Gerente',
    targetResource: 'Proyecto: Dictamen Fiscal SAT Q3',
    previousValue: '$120,000 MXN (180 hrs)',
    newValue: '$145,000 MXN (210 hrs)',
    details: 'Ajuste de horas presupuestadas por ampliación de alcance',
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
  },
  {
    id: 'log-003',
    eventType: 'ATTENDANCE_ADJUSTED',
    actorId: 'rh-01',
    actorName: 'Patricia Morales',
    actorEmail: 'rh.auditoria@russellbedford.mx',
    actorRole: 'Recursos Humanos',
    targetResource: 'Jornada: 10 Noviembre 2026',
    targetUserId: 'usr-ana',
    targetUserName: 'Ana Sofía Garza',
    previousValue: 'Falta Injustificada',
    newValue: 'Entrada 09:05 AM (Justificada)',
    details: 'Justificación médica entregada por la colaboradora',
    timestamp: Date.now() - 8 * 60 * 60 * 1000,
  },
  {
    id: 'log-004',
    eventType: 'STATUS_CHANGED',
    actorId: 'admin-99',
    actorName: 'Carlos Mendoza',
    actorEmail: 'c.mendoza@russellbedford.mx',
    actorRole: 'Gerente',
    targetResource: 'Proyecto: Reestructuración Corporativa Beta',
    previousValue: 'En Progreso',
    newValue: 'En Revisión de Socio',
    details: 'Cambio de fase para visto bueno final de la jefatura',
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
  },
  {
    id: 'log-005',
    eventType: 'REPORT_DOWNLOADED',
    actorId: 'admin-99',
    actorName: 'Carlos Mendoza',
    actorEmail: 'c.mendoza@russellbedford.mx',
    actorRole: 'Gerente',
    targetResource: 'Proyecto: Inventarios Físicos Cierre Anual',
    format: 'PDF',
    details: 'Constancia ejecutiva de horas acumuladas para cliente',
    timestamp: Date.now() - 28 * 60 * 60 * 1000,
  },
];

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

