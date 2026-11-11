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
  taxId?: string;
  isActive: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  code: string;
  leadUserId: string;
  leadUserName: string;
  deadline: string; // ISO date YYYY-MM-DD
  budgetType: BudgetType;
  totalBudgetHours: number;
  hourlyRate: number;
  currency: string;
  notes?: string;
  isActive: boolean;
  assignedUserIds?: string[];
}

export interface TaskNode {
  id: string;
  title?: string;            // Esquema DB: título de la tarea
  name: string;              // Sincronizado con title
  assigned_to?: string;      // Esquema DB: user_id_del_empleado
  created_by?: string;       // Esquema DB: supervisor_id
  status?: TaskStatusType;   // 'pending' | 'in_progress' | 'completed' | 'progress' | 'review'
  created_at?: string;       // TIMESTAMP ISO
  completed_at?: string | null; // TIMESTAMP ISO o null
  projectId: string;
  parentTaskId?: string | null;
  description?: string;
  plannedHours: number;
  priority: TaskPriority;
  isBillable: boolean;
  isActive: boolean;
  dueDate?: string;
  supervisorReviewNote?: string;
  isExtraordinary?: boolean;
  extraordinaryCategory?: string;
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
  projectName: string;
  clientName: string;
  startedAtMs: number;
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
  role?: UserRole;
  roleTitle: string;
  team: string;
  status: 'active' | 'inactive';
  workedMinutesToday: number;
  entryTime: string;
  checkOutTime?: string | null;
  isLate: boolean;
  minutesLate: number;
  allowedClientIds: string[];
  // Referencias jerárquicas
  supervisor_id?: string | null;
  supervisorId?: string | null;
  created_by_ti_id?: string | null;
  assigned_team_members?: string[];
}
