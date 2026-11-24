/**
 * Servicio de Gestión de Solicitudes de Alta y Aprovisionamiento por TI con n8n
 * Russell Bedford Time & Checkin Suite
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig, isFirebaseConfigured } from './firebase';
import { logSystemMovement } from './auditLogger';
import { dispatchAccountReadyWebhook, buildLoginUrl } from './n8nWebhookService';
import { normalizeRole, getDefaultModulesForRole } from './rbac';
import { trackFirestoreRead, trackFirestoreWrite } from './firestoreTelemetry';

export interface AccountRequest {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  requestedRole: 'colaborador' | 'supervisor' | 'gerente' | 'socio' | string;
  teamId: string;
  teamName: string;
  status: 'pending_it' | 'completed' | 'rejected';
  requestedBy: {
    uid: string;
    name: string;
    role: string;
  };
  createdAt?: any;
  completedAt?: any;
  completedByItUid?: string;
  temporaryPassword?: string;
  rejectionReason?: string;
}

export interface CreateAccountRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  requestedRole: 'colaborador' | 'supervisor' | 'gerente' | 'socio';
  teamId: string;
  teamName: string;
  requestedBy: {
    uid: string;
    name: string;
    role: string;
  };
}

export interface ProvisionAccountInput {
  requestId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'colaborador' | 'supervisor' | 'gerente' | 'socio' | string;
  teamId: string;
  teamName: string;
  temporaryPassword: string;
  itUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

/**
 * Generador de contraseñas temporales seguras (ej. RB-2026#X9mK)
 */
export function generateTemporaryPassword(): string {
  const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const charsLower = 'abcdefghijkmnopqrstuvwxyz';
  const charsNums = '23456789';
  const randomChar = (str: string) => str.charAt(Math.floor(Math.random() * str.length));

  const part =
    randomChar(charsUpper) +
    randomChar(charsNums) +
    randomChar(charsLower) +
    randomChar(charsUpper);

  return `RB-2026#${part}`;
}

/**
 * Crea una nueva solicitud de alta en `account_requests` y registra auditoría
 */
export async function createAccountRequest(
  input: CreateAccountRequestInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanFirst = input.firstName.trim();
  const cleanLast = input.lastName.trim();
  const fullName = `${cleanFirst} ${cleanLast}`.trim();

  if (!cleanEmail || !cleanFirst || !cleanLast) {
    return { success: false, error: 'Todos los campos obligatorios deben ser completados.' };
  }

  // 1. Guardar en Firestore
  if (!isFirebaseConfigured() || !db) {
    return {
      success: true,
      id: 'local_req_' + Date.now(),
    };
  }

  try {
    const payload = {
      firstName: cleanFirst,
      lastName: cleanLast,
      fullName,
      email: cleanEmail,
      requestedRole: input.requestedRole,
      teamId: input.teamId,
      teamName: input.teamName,
      status: 'pending_it',
      requestedBy: {
        uid: input.requestedBy.uid,
        name: input.requestedBy.name,
        role: input.requestedBy.role,
      },
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'account_requests'), payload);
    trackFirestoreWrite(1);

    // 2. Registrar evento en audit_logs
    await logSystemMovement({
      eventType: 'ACCOUNT_REQUEST_CREATED',
      actorId: input.requestedBy.uid,
      actorName: input.requestedBy.name,
      actorEmail: cleanEmail,
      actorRole: input.requestedBy.role,
      targetResource: `Solicitud de Alta: ${fullName} (${cleanEmail})`,
      targetUserName: fullName,
      details: `Solicitud de alta enviada a TI para ${fullName} como ${input.requestedRole} en el equipo ${input.teamName}. Estado: Pendiente de Alta por TI.`,
    });

    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error('[accountRequestService] Error al crear solicitud de cuenta:', err);
    return { success: false, error: err?.message || 'Error al guardar la solicitud en Firestore.' };
  }
}

/**
 * Suscribe a las solicitudes de cuenta en tiempo real para la consola de TI
 */
export function subscribePendingAccountRequests(
  callback: (requests: AccountRequest[]) => void
): () => void {
  if (!isFirebaseConfigured() || !db) {
    callback([]);
    return () => {};
  }

  try {
    const collRef = collection(db, 'account_requests');
    const q = query(collRef, orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        trackFirestoreRead(snapshot.size);
        const list: AccountRequest[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            firstName: d.firstName || '',
            lastName: d.lastName || '',
            fullName: d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
            email: d.email || '',
            requestedRole: d.requestedRole || 'colaborador',
            teamId: d.teamId || '',
            teamName: d.teamName || '',
            status: d.status || 'pending_it',
            requestedBy: d.requestedBy || { uid: '', name: '', role: '' },
            createdAt: d.createdAt,
            completedAt: d.completedAt,
            completedByItUid: d.completedByItUid,
            temporaryPassword: d.temporaryPassword,
            rejectionReason: d.rejectionReason,
          };
        });
        callback(list);
      },
      (err) => {
        console.warn('[accountRequestService] Fallback en snapshot ordenado, intentando query sin orderBy:', err);
        // Fallback sin orderBy por si falta índice compuesto en Firestore
        const fbQuery = query(collRef);
        onSnapshot(fbQuery, (fbSnap) => {
          trackFirestoreRead(fbSnap.size);
          const list: AccountRequest[] = fbSnap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              firstName: d.firstName || '',
              lastName: d.lastName || '',
              fullName: d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
              email: d.email || '',
              requestedRole: d.requestedRole || 'colaborador',
              teamId: d.teamId || '',
              teamName: d.teamName || '',
              status: d.status || 'pending_it',
              requestedBy: d.requestedBy || { uid: '', name: '', role: '' },
              createdAt: d.createdAt,
              completedAt: d.completedAt,
              completedByItUid: d.completedByItUid,
              temporaryPassword: d.temporaryPassword,
              rejectionReason: d.rejectionReason,
            };
          });
          callback(list);
        });
      }
    );
  } catch (err) {
    console.error('[accountRequestService] Error en subscribePendingAccountRequests:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Suscribe a las solicitudes creadas por un usuario (Gerente o Socio)
 */
export function subscribeUserAccountRequests(
  userUid: string,
  callback: (requests: AccountRequest[]) => void
): () => void {
  if (!isFirebaseConfigured() || !db || !userUid) {
    callback([]);
    return () => {};
  }

  try {
    const collRef = collection(db, 'account_requests');
    const q = query(collRef, where('requestedBy.uid', '==', userUid));

    return onSnapshot(
      q,
      (snapshot) => {
        trackFirestoreRead(snapshot.size);
        const list: AccountRequest[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            firstName: d.firstName || '',
            lastName: d.lastName || '',
            fullName: d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
            email: d.email || '',
            requestedRole: d.requestedRole || 'colaborador',
            teamId: d.teamId || '',
            teamName: d.teamName || '',
            status: d.status || 'pending_it',
            requestedBy: d.requestedBy || { uid: '', name: '', role: '' },
            createdAt: d.createdAt,
            completedAt: d.completedAt,
            completedByItUid: d.completedByItUid,
            temporaryPassword: d.temporaryPassword,
            rejectionReason: d.rejectionReason,
          };
        });
        callback(list);
      },
      (err) => {
        console.warn('[accountRequestService] Error en subscribeUserAccountRequests:', err);
        callback([]);
      }
    );
  } catch (err) {
    console.error('[accountRequestService] Error al suscribir solicitudes de usuario:', err);
    callback([]);
    return () => {};
  }
}

/**
 * Procesa el aprovisionamiento de cuenta por TI:
 * 1. Crea cuenta en Firebase Authentication sin desconectar a TI (usando SecondaryAuth).
 * 2. Guarda el perfil completo en users/{newUid} con mustChangePassword = true.
 * 3. Dispara el webhook a n8n con las credenciales y enlace de login.
 * 4. Actualiza account_requests/{requestId} a 'completed'.
 * 5. Registra el movimiento en audit_logs (USER_PROVISIONED_BY_IT).
 */
export async function provisionUserByIT(
  input: ProvisionAccountInput
): Promise<{ success: boolean; error?: string; webhookStatus?: boolean }> {
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanFirst = input.firstName.trim();
  const cleanLast = input.lastName.trim();
  const fullName = `${cleanFirst} ${cleanLast}`.trim();
  const normRole = normalizeRole(input.role);

  if (!cleanEmail || !input.temporaryPassword) {
    return { success: false, error: 'Correo y contraseña temporal son obligatorios.' };
  }

  let newUid = '';

  // 1. Crear en Firebase Authentication usando instancia secundaria
  if (isFirebaseConfigured()) {
    const secondaryAppName = `SecondaryAuth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let secondaryApp: any = null;

    try {
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        cleanEmail,
        input.temporaryPassword
      );
      newUid = userCredential.user.uid;

      // Cerrar sesión en el contexto secundario y eliminar app secundaria
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      secondaryApp = null;
    } catch (authErr: any) {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (_) {}
      }
      console.error('[accountRequestService] Error en Firebase Auth Secondary:', authErr);
      const code = authErr?.code || '';
      if (code === 'auth/email-already-in-use') {
        return {
          success: false,
          error: `El correo ${cleanEmail} ya se encuentra registrado en el sistema.`,
        };
      }
      return {
        success: false,
        error: authErr?.message || 'Error al crear credenciales de autenticación.',
      };
    }
  } else {
    newUid = 'simulated_' + Date.now();
  }

  // 2. Guardar perfil completo en users/{newUid}
  if (isFirebaseConfigured() && db && newUid) {
    try {
      const userPayload = {
        uid: newUid,
        authUid: newUid,
        firstName: cleanFirst,
        lastName: cleanLast,
        name: fullName,
        email: cleanEmail,
        role: normRole,
        teamId: input.teamId || null,
        teamName: input.teamName || 'Equipo Prueba',
        team: input.teamName || 'Equipo Prueba',
        assignedTeams: input.teamId ? [input.teamId] : [],
        status: 'active',
        isActive: true,
        mustChangePassword: true,
        createdByItUid: input.itUser.id,
        isProfileComplete: true,
        modules: getDefaultModulesForRole(normRole),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', newUid), userPayload, { merge: true });
      trackFirestoreWrite(1);
    } catch (dbErr: any) {
      console.error('[accountRequestService] Error al crear users doc en Firestore:', dbErr);
      return { success: false, error: 'No se pudo guardar el documento de usuario en la base de datos.' };
    }
  }

  // 3. Invocar Webhook de n8n
  const loginUrl = buildLoginUrl();
  const webhookRes = await dispatchAccountReadyWebhook({
    event: 'account_ready_credentials',
    toEmail: cleanEmail,
    fullName,
    role: normRole,
    teamName: input.teamName,
    temporaryPassword: input.temporaryPassword,
    loginUrl,
    subject: 'Tu cuenta ya está lista — Credenciales de acceso',
  });

  // 4. Actualizar solicitud en account_requests/{requestId}
  if (isFirebaseConfigured() && db && input.requestId) {
    try {
      await updateDoc(doc(db, 'account_requests', input.requestId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedByItUid: input.itUser.id,
        temporaryPassword: input.temporaryPassword, // Preservada para trazabilidad de TI
        assignedUid: newUid,
      });
      trackFirestoreWrite(1);
    } catch (updErr) {
      console.warn('[accountRequestService] Error al marcar solicitud como completada:', updErr);
    }
  }

  // 5. Registrar movimiento en audit_logs
  await logSystemMovement({
    eventType: 'USER_PROVISIONED_BY_IT',
    actorId: input.itUser.id,
    actorName: input.itUser.name,
    actorEmail: input.itUser.email,
    actorRole: input.itUser.role,
    targetResource: `Usuario Aprovisionado: ${fullName} (${cleanEmail})`,
    targetUserId: newUid,
    targetUserName: fullName,
    details: `Usuario ${fullName} (${cleanEmail}) aprovisionado exitosamente en Firebase Auth con rol ${normRole} y equipo ${input.teamName}. Webhook n8n disparado. Contraseña temporal asignada con cambio obligatorio.`,
    metadata: {
      webhookSuccess: webhookRes.success,
      webhookStatusCode: webhookRes.statusCode,
      requestId: input.requestId,
    },
  });

  return {
    success: true,
    webhookStatus: webhookRes.success,
  };
}
