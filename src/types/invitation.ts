import type { UserRole, LegacyOrCurrentRole } from '../services/rbac';

export type InvitationStatus = 'pending' | 'accepted' | 'confirmed' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  token: string;
  email: string;
  supervisorId: string;       // ID del emisor (Gerente, Socio o TI)
  supervisorName: string;     // Nombre del emisor
  supervisorEmail?: string;
  invitedBy?: string;         // Nombre o ID de quien invitó
  created_by_ti_id?: string | null;
  issuerRole?: LegacyOrCurrentRole;
  team: string;
  assignedTeamId?: string;
  roleTitle: string;
  role: UserRole | string;
  targetRole?: UserRole | string;
  assignedRole?: UserRole | string;
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
  issuerRole?: LegacyOrCurrentRole;
  targetRole?: UserRole | string;
  assignedRole?: UserRole | string;
  team: string;
  assignedTeamId?: string;
  roleTitle?: string;
  expiresInHours?: number;
  notes?: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  error?: string;
  invitation?: Invitation;
}
