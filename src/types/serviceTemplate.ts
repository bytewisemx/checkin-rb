export type AuditPhase = 'Previa' | 'Final' | 'Especialista';
export type SuggestedRole = 'Staff' | 'Encargado' | 'Gerente' | 'Equipo' | 'Especialista';
export type ActivityReviewStatus =
  | 'pending'
  | 'staff_pt_done'
  | 'lead_reviewed'
  | 'completed';

export interface ServiceTemplateActivity {
  activityNumber: number;
  rubro: string;
  rubroNumber: number; // 0 = Planeación General y Cierre, 1..18 = Rubros de Auditoría
  cuentaContable?: string;
  procedimiento: string;
  papelTrabajo: string;
  fase: AuditPhase;
  perfilSugerido: SuggestedRole;
  budgetedHours: number;
  unbudgetedHours?: number;
  status?: ActivityReviewStatus;
  assignedUserIds?: string[];
  leadUserId?: string | null;
  hoursByUser?: Record<string, number>;
  totalActualHours?: number;
  comments?: string;
}

export interface ServiceTemplateRubro {
  number: number;
  name: string;
  riskLevel?: {
    inherent: 'Bajo' | 'Medio' | 'Alto';
    control: 'Bajo' | 'Medio' | 'Alto';
    audit: 'Bajo' | 'Medio' | 'Alto';
  };
  activities: ServiceTemplateActivity[];
}

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  totalActivities?: number;
  totalBudgetHours: number;
  rubros: ServiceTemplateRubro[];
  createdAt?: string;
  updatedAt?: string;
  isSystemDefault?: boolean;
}
