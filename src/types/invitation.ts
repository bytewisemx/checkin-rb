import type { UserRole } from '../services/rbac';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  token: string;
  email: string;
  supervisorId: string;       // ID del Supervisor (si invita a Empleado) o ID de TI (si invita a Supervisor)
  supervisorName: string;     // Nombre del emisor (TI o Supervisor)
  supervisorEmail?: string;
  created_by_ti_id?: string | null; // Si fue emitida por TI para dar de alta a un Supervisor
  issuerRole?: 'TI' | 'Supervisor';
  team: string;
  roleTitle: string;
  role: UserRole | 'employee' | 'supervisor'; // 'Supervisor' (emitido por TI) o 'Empleado' (emitido por Supervisor)
  targetRole?: UserRole;
  status: InvitationStatus;
  createdAt: number;
  expiresAt: number;
  acceptedAt?: number;
  acceptedUserId?: string;
  usedAt?: string;
  registeredUserId?: string;
  sentCount: number;
  lastSentAt: number;
  notes?: string;
}

export interface CreateInvitationDTO {
  email: string;
  supervisorId: string;
  supervisorName: string;
  supervisorEmail?: string;
  created_by_ti_id?: string | null;
  issuerRole?: 'TI' | 'Supervisor';
  targetRole?: UserRole;
  team: string;
  roleTitle?: string;
  expiresInHours?: number;
  notes?: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  error?: string;
  invitation?: Invitation;
}
