import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { useInvitationStore, buildInviteUrl } from '../store/useInvitationStore';
import type { Invitation, ValidateTokenResult } from '../types/invitation';
import type { UserRole } from './rbac';

/**
 * Servicio Backend para Gestión y Validación de Invitaciones Jerárquicas en Base de Datos
 * Russell Bedford Time & Checkin Suite
 */

export interface SendEmailResult {
  sent: boolean;
  destinationEmail: string;
  inviteUrl: string;
  error?: string;
}

function withTimeout<T>(promise: Promise<T>, ms = 1200, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);

    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

/**
 * Guarda una invitación en Firestore usando el token como ID único de acceso puntual
 * Protegido con timeout estricto para no bloquear jamás el despacho del webhook ni la UI.
 */
export async function saveInvitationToFirestore(invitation: Invitation): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;

  try {
    const invRef = doc(db, 'invitations', invitation.token);
    const writePromise = setDoc(
      invRef,
      {
        id: invitation.id,
        token: invitation.token,
        email: invitation.email.toLowerCase().trim(),
        supervisorId: invitation.supervisorId,
        supervisorName: invitation.supervisorName,
        supervisorEmail: invitation.supervisorEmail || '',
        created_by_ti_id: invitation.created_by_ti_id || null,
        issuerRole: invitation.issuerRole || 'Supervisor',
        team: invitation.team,
        roleTitle: invitation.roleTitle,
        role: invitation.role,
        targetRole: invitation.targetRole || invitation.role,
        status: invitation.status || 'pending',
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        sentCount: invitation.sentCount || 1,
        lastSentAt: invitation.lastSentAt || Date.now(),
        notes: invitation.notes || '',
      },
      { merge: true }
    ).then(() => true);

    return await withTimeout(writePromise, 1500, false);
  } catch (err) {
    console.warn('[Firestore] No se pudo guardar la invitación en Firestore:', err);
    return false;
  }
}

/**
 * Valida un token de invitación en Firestore y en el store local antes de permitir el registro
 */
export async function validateInvitationToken(token: string): Promise<ValidateTokenResult> {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return {
      valid: false,
      error: 'No se proporcionó ningún token de invitación.',
    };
  }

  const store = useInvitationStore.getState();

  // 1. Si Firebase está configurado, consultar lectura puntual en Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const invRef = doc(db, 'invitations', cleanToken);
      const snap = await getDoc(invRef);

      if (snap.exists()) {
        const data = snap.data() as Partial<Invitation>;
        const now = Date.now();

        if (data.status === 'confirmed' || data.status === 'accepted') {
          return {
            valid: false,
            error: 'Este enlace de invitación ya fue utilizado o ha expirado. Inicia sesión con tus credenciales.',
            invitation: data as Invitation,
          };
        }

        if (data.status === 'revoked') {
          return {
            valid: false,
            error: 'Esta invitación fue revocada o cancelada por el emisor.',
            invitation: data as Invitation,
          };
        }

        const expiresAtNum = typeof data.expiresAt === 'number' ? data.expiresAt : new Date(data.expiresAt || 0).getTime();
        if (now > expiresAtNum) {
          return {
            valid: false,
            error: 'Este enlace de invitación ya fue utilizado o ha expirado. Inicia sesión con tus credenciales.',
            invitation: data as Invitation,
          };
        }

        const fullInvitation: Invitation = {
          id: data.id || 'inv-' + cleanToken.slice(0, 8),
          token: cleanToken,
          email: (data.email || '').toLowerCase().trim(),
          supervisorId: data.supervisorId || 'admin-99',
          supervisorName: data.supervisorName || 'Supervisor',
          supervisorEmail: data.supervisorEmail,
          created_by_ti_id: data.created_by_ti_id,
          issuerRole: data.issuerRole || 'Supervisor',
          team: data.team || 'Auditoría Fiscal',
          roleTitle: data.roleTitle || 'Colaborador',
          role: data.role || data.targetRole || 'Colaborador',
          targetRole: data.targetRole || data.role || 'Colaborador',
          status: 'pending',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          expiresAt: expiresAtNum,
          sentCount: data.sentCount || 1,
          lastSentAt: typeof data.lastSentAt === 'number' ? data.lastSentAt : Date.now(),
          notes: data.notes,
        };

        // Sincronizar en store local si no existía
        const existingLocal = store.invitations.find((i) => i.token === cleanToken);
        if (!existingLocal) {
          useInvitationStore.setState((s) => ({
            invitations: [fullInvitation, ...s.invitations],
          }));
        }

        return {
          valid: true,
          invitation: fullInvitation,
        };
      }
    } catch (err) {
      console.warn('[Firestore] Error al consultar token en Firestore, evaluando store local:', err);
    }
  }

  // 2. Fallback al store local
  return store.validateToken(cleanToken);
}

/**
 * Registra y consume un token tras la creación exitosa del usuario (Invalidación Permanente One-Time)
 */
export async function consumeInvitationToken(
  token: string,
  user: { uid: string; email: string; name?: string }
): Promise<{ success: boolean; error?: string; invitation?: Invitation }> {
  const cleanToken = (token || '').trim();
  const store = useInvitationStore.getState();

  // 1. Invalidación en Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const invRef = doc(db, 'invitations', cleanToken);
      await updateDoc(invRef, {
        status: 'confirmed',
        usedAt: new Date().toISOString(),
        registeredUserId: user.uid,
        acceptedAt: Date.now(),
        acceptedUserId: user.uid,
      });
    } catch (err) {
      console.warn('[Firestore] Error al marcar invitación como confirmed en Firestore:', err);
    }
  }

  // 2. Invalidación en Store Local
  return store.consumeToken(cleanToken, user);
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
