import type { UserRole } from '../services/rbac';

export type BudgetType = 'fixed_project' | 'by_tasks' | 'by_person';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type GeofenceEnforcement = 'strict_block' | 'warning' | 'none';
export type TaskStatusType = 'pending' | 'in_progress' | 'completed' | 'progress' | 'review';

export interface ClientGroup {
  id: string;
  name: string;
  isInternal: boolean;
}

export interface Client {
  id: string;
  groupId: string;
  name: string;
  commercialName?: string;
  code?: string;
  logoUrl?: string;
  taxId?: string;
  taxRegime?: string;
  industry?: string;
  fiscalAddress?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  startDate?: string;
  renewalDate?: string;
  notes?: string;
  createdBy?: string;
  createdByRole?: string;
  isActive: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  code: string;
  leadUserId: string;
  leadUserName: string;
  managerId?: string;
  managerName?: string;
  partnerId?: string;
  gerenteId?: string;
  supervisorId?: string;
  teamId?: string;
  teamIds?: string[];
  deadline: string; // ISO date YYYY-MM-DD
  budgetType?: BudgetType;
  totalBudgetHours: number;
  plannedHours?: number;
  plannedMinutes?: number;
  hourlyRate?: number;
  currency?: string;
  notes?: string;
  isActive: boolean;
  assignedToIds?: string[];
  assignedUserIds?: string[];
  assignedUserEmails?: string[];
  templateId?: string;
  templateName?: string;
  isFromTemplate?: boolean;
  companyName?: string;
  startDate?: string;
}

export interface TaskNote {
  id: string;
  text: string;
  linkUrl?: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  createdAt: string;
}

export interface TaskNode {
  id: string;
  title?: string;            // Esquema DB: título de la tarea
  name: string;              // Sincronizado con title
  assigned_to?: string;      // Compatibilidad: ID del colaborador
  assignedToId?: string;     // ID unificado del colaborador principal (uid / demo_colaborador)
  assignedToIds?: string[];  // Array de UIDs asignados (modelo multi-usuario)
  assignedUserIds?: string[]; // Array de UIDs participantes asignados
  leadUserId?: string;       // Encargado principal de la actividad
  leadUserName?: string;     // Nombre legible del encargado de la actividad
  assignedToEmail?: string;  // Correo del colaborador en minúsculas
  assignedToName?: string;   // Nombre legible del colaborador
  companyId?: string;        // ID de la empresa vinculada
  companyName?: string;      // Nombre de la empresa vinculada
  projectName?: string;      // Nombre del proyecto vinculado
  teamId?: string;           // Equipo principal
  teamIds?: string[];        // Array de equipos vinculados
  gerenteId?: string;        // Gerente responsable de la línea
  supervisorId?: string;     // Supervisor responsable
  created_by?: string;       // ID del emisor / supervisor
  status?: TaskStatusType;   // 'pending' | 'in_progress' | 'completed' | 'progress' | 'review'
  created_at?: string;       // TIMESTAMP ISO
  completed_at?: string | null; // TIMESTAMP ISO o null
  projectId: string;
  parentTaskId?: string | null;
  description?: string;
  plannedHours: number;
  plannedMinutes?: number;
  loggedMinutes?: number;
  priority: TaskPriority;
  isBillable: boolean;
  isActive: boolean;
  dueDate?: string;
  locationMode?: 'office' | 'client_site';
  locationAddress?: string;
  locationRadiusMeters?: number;
  supervisorReviewNote?: string;
  notes?: TaskNote[];
  isExtraordinary?: boolean;
  extraordinaryCategory?: string;
  activityNumber?: number;
  rubro?: string;
  rubroNumber?: number;
  cuentaContable?: string;
  procedimiento?: string;
  papelTrabajo?: string;
  fase?: 'Previa' | 'Final' | 'Especialista';
  perfilSugerido?: 'Staff' | 'Encargado' | 'Gerente' | 'Equipo' | 'Especialista';
  budgetedHours?: number;
  unbudgetedHours?: number;
  reviewStatus?: 'pending' | 'staff_pt_done' | 'lead_reviewed' | 'completed';
  reviewedBy?: {
    uid: string;
    name: string;
    role?: string;
  };
  reviewedAt?: any;
  reviewNotes?: string;
  progress?: number;
  actualHours?: number;
  hoursByUser?: Record<string, number>;
  totalActualHours?: number;
  comments?: string;
  isManuallyModified?: boolean;
  manualAdjustment?: {
    previousSeconds: number;
    adjustedSeconds: number;
    reason: string;
    modifiedByUid: string;
    modifiedByName: string;
    modifiedAt: string;
  };
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRoleTitle: string;
  allocatedHours: number;
  hourlyRateOverride?: number;
  blockOnLimit: boolean;
}

export interface GeofenceConfig {
  id: string;
  projectId: string;
  locationMode: 'remote' | 'office' | 'client_site';
  address: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  enforcementMode: GeofenceEnforcement;
}

export interface ActiveWorker {
  userId: string;
  userName: string;
  userAvatar?: string;
  taskId: string;
  taskName: string;
  projectId?: string;
  projectName: string;
  clientName: string;
  startedAtMs: number;
  startedAt?: number | string;
  accumulatedSeconds?: number;
  isRunning?: boolean;
  currentDurationStr: string;
}

export interface TimeReportRow {
  id: string;
  name: string;
  type: 'project' | 'task' | 'subtask' | 'user';
  assigneeName?: string;
  plannedHours: number;
  actualHours: number;
  remainingHours: number;
  percentConsumed: number;
  statusLabel: 'normal' | 'warning' | 'critical' | 'overflow';
  isOverLimit: boolean;
  subrows?: TimeReportRow[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
  avatar?: string;
  role?: UserRole;
  roleTitle: string;
  team: string;
  teamId?: string | null;
  assignedTeams?: string[];
  status: 'active' | 'inactive';
  workedMinutesToday: number;
  entryTime?: string;
  checkOutTime?: string | null;
  isLate: boolean;
  minutesLate: number;
  allowedClientIds: string[];
  // Rango y gamificación mensual
  currentRank?: 'bronce' | 'plata' | 'oro' | 'diamante';
  monthlyPoints?: number;
  rankSeason?: string;
  // Referencias jerárquicas
  supervisor_id?: string | null;
  supervisorId?: string | null;
  created_by_ti_id?: string | null;
  assigned_team_members?: string[];
}
