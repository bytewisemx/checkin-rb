import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Invitation, ValidateTokenResult } from '../types/invitation';
import type { UserRole } from '../services/rbac';
import { useNotificationStore } from './useNotificationStore';

/**
 * Genera un token criptográficamente seguro y de alta entropía
 */
export function generateSecureToken(): string {
  try {
    if (typeof window !== 'undefined' && window.crypto) {
      if (typeof window.crypto.randomUUID === 'function') {
        const u1 = window.crypto.randomUUID().replace(/-/g, '');
        const u2 = window.crypto.randomUUID().replace(/-/g, '');
        return (u1 + u2).slice(0, 48);
      }
      const array = new Uint8Array(24);
      window.crypto.getRandomValues(array);
      return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback de contingencia
  }
  return 'rb_' + Date.now() + '_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

/**
 * Construye la URL completa del enlace de registro por invitación (/activar-cuenta)
 */
export function buildInviteUrl(token: string): string {
  if (typeof window === 'undefined') return '/activar-cuenta?token=' + encodeURIComponent(token);
  const origin = window.location.origin;
  const baseUrl = import.meta.env.BASE_URL || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return origin + cleanBase + 'activar-cuenta?token=' + encodeURIComponent(token);
}

interface InvitationState {
  invitations: Invitation[];

  // Acciones de Emisión (TI -> Supervisor, Supervisor -> Empleado)
  createInvitations: (dto: {
    emails: string[];
    supervisorId: string;
    supervisorName: string;
    supervisorEmail?: string;
    created_by_ti_id?: string | null;
    issuerRole?: 'TI' | 'Supervisor';
    targetRole?: UserRole;
    team: string;
    teamId?: string;
    teamName?: string;
    assignedTeamId?: string;
    roleTitle?: string;
    expiresInHours?: number;
    notes?: string;
  }) => Invitation[];

  revokeInvitation: (id: string) => boolean;
  resendInvitation: (id: string) => { success: boolean; invitation?: Invitation };
  deleteInvitation: (id: string) => void;

  // Acciones Flujo de Registro
  validateToken: (token: string) => ValidateTokenResult;
  consumeToken: (
    token: string,
    user: { uid: string; email: string; name?: string }
  ) => { success: boolean; error?: string; invitation?: Invitation };

  // Utilidades
  getInvitationsBySupervisor: (supervisorId: string) => Invitation[];
  getInvitationsByTI: () => Invitation[];
  isEmailWhitelisted: (email: string) => boolean;
  findInvitationForEmail: (email: string) => Invitation | undefined;
}

const INITIAL_INVITATIONS: Invitation[] = [];

export const useInvitationStore = create<InvitationState>()(
  persist(
    (set, get) => ({
      invitations: INITIAL_INVITATIONS,

      createInvitations: (dto) => {
        const {
          emails,
          supervisorId,
          supervisorName,
          supervisorEmail,
          created_by_ti_id = null,
          issuerRole = 'Supervisor',
          targetRole = issuerRole === 'TI' ? 'Supervisor' : 'Empleado',
          team,
          teamId,
          teamName,
          assignedTeamId,
          roleTitle = targetRole === 'Supervisor' ? 'Supervisor de Equipo' : 'Colaborador Operativo',
          expiresInHours = 48,
          notes = '',
        } = dto;

        const durationMs = expiresInHours * 60 * 60 * 1000;
        const now = Date.now();
        const expiresAt = now + durationMs;

        const finalTeamName = (teamName || team || 'Equipo Corporativo').trim();
        const finalTeamId = (teamId || assignedTeamId || 'team-default').trim();

        const newInvitations: Invitation[] = [];

        emails.forEach((rawEmail) => {
          const email = rawEmail.trim().toLowerCase();
          if (!email || !email.includes('@')) return;

          const token = generateSecureToken();
          const id = 'inv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

          const invitation: Invitation = {
            id,
            token,
            email,
            supervisorId,
            supervisorName,
            supervisorEmail,
            created_by_ti_id: issuerRole === 'TI' ? supervisorId : created_by_ti_id,
            issuerRole,
            team: finalTeamName,
            teamName: finalTeamName,
            teamId: finalTeamId,
            assignedTeamId: finalTeamId,
            roleTitle: roleTitle || (targetRole === 'Supervisor' ? 'Supervisor' : 'Empleado'),
            role: targetRole,
            status: 'pending',
            createdAt: now,
            expiresAt,
            sentCount: 1,
            lastSentAt: now,
            notes,
          };

          newInvitations.push(invitation);
        });

        if (newInvitations.length === 0) return [];

        set((state) => {
          const newEmailsSet = new Set(newInvitations.map((i) => i.email));
          const updatedExisting = state.invitations.map((inv) => {
            if (newEmailsSet.has(inv.email) && inv.status === 'pending') {
              return { ...inv, status: 'revoked' as const };
            }
            return inv;
          });

          return {
            invitations: [...newInvitations, ...updatedExisting],
          };
        });

        useNotificationStore.getState().addNotification({
          recipient_id: supervisorId,
          sender_id: supervisorId,
          type: 'system',
          title: issuerRole === 'TI' ? 'Invitación de Supervisor Emitida por TI' : 'Invitaciones de Equipo Emitidas',
          message:
            'Se generaron ' +
            newInvitations.length +
            ' enlace(s) de invitación para rol ' +
            targetRole +
            ' en el área "' +
            team +
            '" con vigencia de ' +
            expiresInHours +
            'h.',
          authorName: supervisorName,
        });

        return newInvitations;
      },

      revokeInvitation: (id: string) => {
        const inv = get().invitations.find((i) => i.id === id);
        if (!inv || inv.status !== 'pending') return false;

        set((state) => ({
          invitations: state.invitations.map((i) =>
            i.id === id ? { ...i, status: 'revoked' as const } : i
          ),
        }));

        useNotificationStore.getState().addNotification({
          recipient_id: inv.supervisorId,
          sender_id: inv.supervisorId,
          type: 'system',
          title: 'Invitación Revocada',
          message: 'Se canceló el token de acceso para "' + inv.email + '". El enlace ya no podrá ser utilizado.',
          authorName: inv.supervisorName || 'Seguridad',
        });

        return true;
      },

      resendInvitation: (id: string) => {
        const inv = get().invitations.find((i) => i.id === id);
        if (!inv) return { success: false };

        const now = Date.now();
        const newExpiresAt = now + 48 * 60 * 60 * 1000;

        let updated: Invitation | undefined;

        set((state) => ({
          invitations: state.invitations.map((i) => {
            if (i.id === id) {
              updated = {
                ...i,
                status: 'pending',
                sentCount: i.sentCount + 1,
                lastSentAt: now,
                expiresAt: newExpiresAt,
              };
              return updated;
            }
            return i;
          }),
        }));

        useNotificationStore.getState().addNotification({
          recipient_id: inv.supervisorId,
          sender_id: inv.supervisorId,
          type: 'system',
          title: 'Invitación Reenviada',
          message: 'Se renovó y reenvió el enlace para "' + inv.email + '" por 48 horas adicionales.',
          authorName: inv.supervisorName || 'Supervisor',
        });

        return { success: true, invitation: updated };
      },

      deleteInvitation: (id: string) => {
        set((state) => ({
          invitations: state.invitations.filter((i) => i.id !== id),
        }));
      },

      validateToken: (token: string): ValidateTokenResult => {
        const cleanToken = (token || '').trim();
        if (!cleanToken) {
          return {
            valid: false,
            error: 'No se proporcionó ningún token de invitación.',
          };
        }

        const inv = get().invitations.find((i) => i.token === cleanToken);

        if (!inv) {
          return {
            valid: false,
            error: 'El token de invitación no existe o el enlace es inválido.',
          };
        }

        if (inv.status === 'accepted' || inv.status === 'confirmed') {
          return {
            valid: false,
            error:
              'Este enlace de invitación ya fue utilizado o ha expirado. Inicia sesión con tus credenciales.',
            invitation: inv,
          };
        }

        if (inv.status === 'revoked') {
          return {
            valid: false,
            error: 'Esta invitación fue revocada o cancelada por el emisor.',
            invitation: inv,
          };
        }

        if (Date.now() > inv.expiresAt) {
          set((state) => ({
            invitations: state.invitations.map((i) =>
              i.id === inv.id ? { ...i, status: 'expired' as const } : i
            ),
          }));

          return {
            valid: false,
            error: 'Este enlace de invitación ya fue utilizado o ha expirado. Inicia sesión con tus credenciales.',
            invitation: inv,
          };
        }

        return {
          valid: true,
          invitation: inv,
        };
      },

      consumeToken: (token, user) => {
        const validation = get().validateToken(token);
        if (!validation.valid || !validation.invitation) {
          return {
            success: false,
            error: validation.error || 'Token inválido o expirado.',
          };
        }

        const inv = validation.invitation;

        if (user.email.trim().toLowerCase() !== inv.email.trim().toLowerCase()) {
          return {
            success: false,
            error:
              'El correo autenticado (' +
              user.email +
              ') no coincide con el correo autorizado en la invitación (' +
              inv.email +
              ').',
          };
        }

        const now = Date.now();
        let acceptedInv: Invitation | undefined;

        set((state) => ({
          invitations: state.invitations.map((i) => {
            if (i.id === inv.id) {
              acceptedInv = {
                ...i,
                status: 'confirmed',
                usedAt: new Date().toISOString(),
                registeredUserId: user.uid,
                acceptedAt: now,
                acceptedUserId: user.uid,
              };
              return acceptedInv;
            }
            return i;
          }),
        }));

        useNotificationStore.getState().addNotification({
          recipient_id: inv.supervisorId,
          sender_id: user.uid,
          type: 'system',
          title:
            inv.role === 'Supervisor'
              ? 'Nuevo Supervisor Dado de Alta por Invitación TI'
              : 'Nuevo Empleado Registrado por Invitación',
          message:
            (user.name || inv.email) +
            ' completó su registro como ' +
            inv.role +
            ' y quedó vinculado jerárquicamente (' +
            inv.team +
            ').',
          authorName: 'Sistema de Seguridad RBAC',
        });

        return {
          success: true,
          invitation: acceptedInv,
        };
      },

      getInvitationsBySupervisor: (supervisorId: string) => {
        const { invitations } = get();
        return invitations.filter(
          (i) =>
            i.issuerRole !== 'TI' &&
            (!supervisorId || i.supervisorId === supervisorId || supervisorId === 'admin-99')
        );
      },

      getInvitationsByTI: () => {
        const { invitations } = get();
        return invitations.filter((i) => i.issuerRole === 'TI' || i.role === 'Supervisor');
      },

      isEmailWhitelisted: (email: string) => {
        const clean = (email || '').trim().toLowerCase();
        return get().invitations.some(
          (i) => i.email.toLowerCase() === clean && (i.status === 'pending' || i.status === 'accepted')
        );
      },

      findInvitationForEmail: (email: string) => {
        const clean = (email || '').trim().toLowerCase();
        return (
          get().invitations.find(
            (i) => i.email.toLowerCase() === clean && (i.status === 'pending' || i.status === 'accepted')
          ) || get().invitations.find((i) => i.email.toLowerCase() === clean)
        );
      },
    }),
    {
      name: 'rb-invitations-storage-v2',
    }
  )
);
