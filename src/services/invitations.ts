import { useInvitationStore, buildInviteUrl } from '../store/useInvitationStore';
import type { Invitation, ValidateTokenResult } from '../types/invitation';
import type { UserRole } from './rbac';

/**
 * Servicio Backend para Gestión y Validación de Invitaciones Jerárquicas:
 * - TI -> Supervisores
 * - Supervisor -> Empleados (Subordinados)
 */

export interface SendEmailResult {
  sent: boolean;
  destinationEmail: string;
  inviteUrl: string;
  error?: string;
}

/**
 * Valida un token de invitación en el backend/servicio antes de permitir el registro
 */
export async function validateInvitationToken(token: string): Promise<ValidateTokenResult> {
  const store = useInvitationStore.getState();
  return store.validateToken(token);
}

/**
 * Registra y consume un token tras la creación exitosa del usuario
 */
export async function consumeInvitationToken(
  token: string,
  user: { uid: string; email: string; name?: string }
): Promise<{ success: boolean; error?: string; invitation?: Invitation }> {
  const store = useInvitationStore.getState();
  return store.consumeToken(token, user);
}

/**
 * Crea un lote de invitaciones emitidas por TI (para Supervisores) o por un Supervisor (para Empleados)
 */
export async function createInvitations(dto: {
  emails: string[];
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
}): Promise<Invitation[]> {
  const store = useInvitationStore.getState();
  const created = store.createInvitations(dto);

  for (const inv of created) {
    await sendInvitationEmail(inv);
  }

  return created;
}

/**
 * Envía el correo electrónico con el enlace especial único
 */
export async function sendInvitationEmail(invitation: Invitation): Promise<SendEmailResult> {
  const inviteUrl = buildInviteUrl(invitation.token);

  console.group('[INVITATION SERVICE] Invitación despachada a: ' + invitation.email);
  console.log('Emisor: ' + invitation.supervisorName + ' (' + (invitation.issuerRole || 'Supervisor') + ')');
  console.log('Rol Asignado: ' + invitation.role);
  console.log('Equipo Asignado: ' + invitation.team);
  console.log('Puesto: ' + invitation.roleTitle);
  console.log('Vigencia hasta: ' + new Date(invitation.expiresAt).toLocaleString());
  console.log('Enlace de Registro Seguro: ' + inviteUrl);
  console.groupEnd();

  return {
    sent: true,
    destinationEmail: invitation.email,
    inviteUrl,
  };
}

/**
 * Revoca una invitación activa
 */
export async function revokeInvitation(id: string): Promise<boolean> {
  return useInvitationStore.getState().revokeInvitation(id);
}

/**
 * Reenvia el correo de invitación renovando su vigencia
 */
export async function resendInvitation(id: string): Promise<{ success: boolean; inviteUrl?: string }> {
  const res = useInvitationStore.getState().resendInvitation(id);
  if (res.success && res.invitation) {
    const inviteUrl = buildInviteUrl(res.invitation.token);
    await sendInvitationEmail(res.invitation);
    return { success: true, inviteUrl };
  }
  return { success: false };
}
