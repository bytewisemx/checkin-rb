import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { useCheckinStore } from '../store/useCheckinStore';
import { useInvitationStore, buildInviteUrl } from '../store/useInvitationStore';
import type { Invitation } from '../types/invitation';
import { normalizeRole, type UserRole } from './rbac';

export interface UserProfileDocument {
  uid: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string | null;
  profileImage?: string;
  role: UserRole | 'employee' | 'supervisor';
  teamId?: string | null;
  team?: string;
  teamName?: string;
  assignedTeams?: string[];
  status?: 'active' | 'inactive';
  isActive?: boolean;
  supervisorId?: string | null;
  supervisorName?: string;
  supervisorCode?: string;
  isProfileComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Envoltorio con timeout ultra-rápido para operaciones de red con Firestore
 * Si Firestore no responde en el tiempo límite (ej. 1200ms), resuelve con fallback inmediato
 */
function withTimeout<T>(promise: Promise<T>, ms = 4000, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(fallback);
      }
    }, ms);

    promise
      .then((val) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

/**
 * Consulta el perfil de usuario en el almacén local primero (sincrónico e instantáneo)
 */
export function getLocalUserProfile(uidOrEmail: string): UserProfileDocument | null {
  if (!uidOrEmail) return null;
  const clean = uidOrEmail.trim().toLowerCase();
  const state = useCheckinStore.getState();

  // 1. Si es el usuario actualmente activo en sesión
  if (
    state.user &&
    (state.user.id === uidOrEmail || (state.user.email || '').trim().toLowerCase() === clean)
  ) {
    const [first, ...rest] = (state.user.name || '').split(' ');
    return {
      uid: state.user.id,
      email: state.user.email,
      name: state.user.name,
      firstName: first || state.user.name,
      lastName: state.user.lastName || rest.join(' '),
      photoURL: state.user.photoURL || null,
      profileImage: state.user.profileImage,
      role: normalizeRole(state.user.role),
      team: state.user.team,
      supervisorId: state.user.supervisor_id || state.user.supervisorId || null,
      supervisorName: state.user.supervisorName,
      isProfileComplete: Boolean(state.user.isProfileComplete),
    };
  }

  // 2. Buscar en mockEmployeesData
  const localEmp = state.mockEmployeesData.find(
    (e) => e.id === uidOrEmail || (e.email || '').trim().toLowerCase() === clean
  );
  if (localEmp) {
    const [first, ...rest] = (localEmp.name || '').split(' ');
    return {
      uid: localEmp.id,
      email: localEmp.email,
      name: localEmp.name,
      firstName: first || localEmp.name,
      lastName: rest.join(' '),
      photoURL: localEmp.photoURL || localEmp.profileImage || null,
      profileImage: localEmp.profileImage || localEmp.photoURL || undefined,
      role: normalizeRole(localEmp.role || 'Empleado'),
      team: localEmp.team,
      supervisorId: localEmp.supervisor_id,
      isProfileComplete: Boolean(localEmp.isProfileComplete),
    };
  }

  // 3. Buscar en userPermissionsDirectory
  const dirEntry =
    state.userPermissionsDirectory[uidOrEmail] ||
    Object.values(state.userPermissionsDirectory).find(
      (u) => (u.email || '').trim().toLowerCase() === clean
    );
  if (dirEntry) {
    const [first, ...rest] = (dirEntry.name || '').split(' ');
    return {
      uid: dirEntry.id,
      email: dirEntry.email,
      name: dirEntry.name,
      firstName: first || dirEntry.name,
      lastName: rest.join(' '),
      photoURL: dirEntry.photoURL || null,
      role: normalizeRole(dirEntry.role),
      team: dirEntry.team,
      isProfileComplete: true,
    };
  }

  return null;
}

/**
 * Consulta de usuario en la colección Firestore `users` siguiendo el orden estricto:
 * 1. Por ID directo de documento doc('users', uid)
 * 2. Por campo `uid == cleanUid`
 * 3. Por ID directo de documento doc('users', cleanEmail)
 * 4. Por campo `email == cleanEmail`
 * 5. Búsqueda exhaustiva case-insensitive en la colección `users`
 * 6. Fallback a estado local en memoria
 */
export async function findUserInUsersCollection(
  uid: string,
  email: string
): Promise<{ docId: string; data: UserProfileDocument } | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUid = (uid || '').trim();

  // 1. Si Firebase está activo
  if (isFirebaseConfigured() && db) {
    try {
      // A. Buscar por Document ID == cleanUid
      if (cleanUid) {
        const userRef = doc(db, 'users', cleanUid);
        const snap = await withTimeout(getDoc(userRef), 4000, null);
        if (snap && snap.exists()) {
          const d = snap.data() as UserProfileDocument;
          return {
            docId: snap.id,
            data: {
              ...d,
              uid: d.uid || snap.id,
              role: normalizeRole(d.role || 'Empleado'),
              isProfileComplete: d.isProfileComplete !== undefined ? Boolean(d.isProfileComplete) : true,
            },
          };
        }
      }

      // B. Buscar por query where('uid', '==', cleanUid)
      if (cleanUid) {
        const qUid = query(collection(db, 'users'), where('uid', '==', cleanUid));
        const snapUid = await withTimeout(getDocs(qUid), 4000, null);
        if (snapUid && !snapUid.empty) {
          const first = snapUid.docs[0];
          const d = first.data() as UserProfileDocument;
          return {
            docId: first.id,
            data: {
              ...d,
              uid: d.uid || first.id,
              role: normalizeRole(d.role || 'Empleado'),
              isProfileComplete: d.isProfileComplete !== undefined ? Boolean(d.isProfileComplete) : true,
            },
          };
        }
      }

      // C. Buscar por Document ID == cleanEmail
      if (cleanEmail) {
        const userEmailDocRef = doc(db, 'users', cleanEmail);
        const snapEmailDoc = await withTimeout(getDoc(userEmailDocRef), 3000, null);
        if (snapEmailDoc && snapEmailDoc.exists()) {
          const d = snapEmailDoc.data() as UserProfileDocument;
          return {
            docId: snapEmailDoc.id,
            data: {
              ...d,
              uid: d.uid || snapEmailDoc.id,
              role: normalizeRole(d.role || 'Empleado'),
              isProfileComplete: d.isProfileComplete !== undefined ? Boolean(d.isProfileComplete) : true,
            },
          };
        }
      }

      // D. Buscar por query where('email', '==', cleanEmail)
      if (cleanEmail) {
        const qEmail = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const snapEmail = await withTimeout(getDocs(qEmail), 4000, null);
        if (snapEmail && !snapEmail.empty) {
          const first = snapEmail.docs[0];
          const d = first.data() as UserProfileDocument;
          return {
            docId: first.id,
            data: {
              ...d,
              uid: d.uid || first.id,
              role: normalizeRole(d.role || 'Empleado'),
              isProfileComplete: d.isProfileComplete !== undefined ? Boolean(d.isProfileComplete) : true,
            },
          };
        }
      }

      // E. Búsqueda exhaustiva case-insensitive en la colección users si las anteriores no encontraron
      if (cleanEmail) {
        const allUsersSnap = await withTimeout(getDocs(collection(db, 'users')), 4000, null);
        if (allUsersSnap && !allUsersSnap.empty) {
          const matched = allUsersSnap.docs.find((d) => {
            const data = d.data();
            const dEmail = (data.email || '').trim().toLowerCase();
            const dUid = (data.uid || d.id || '').trim();
            return dEmail === cleanEmail || (cleanUid && dUid === cleanUid);
          });
          if (matched) {
            const d = matched.data() as UserProfileDocument;
            return {
              docId: matched.id,
              data: {
                ...d,
                uid: d.uid || matched.id,
                role: normalizeRole(d.role || 'Empleado'),
                isProfileComplete: d.isProfileComplete !== undefined ? Boolean(d.isProfileComplete) : true,
              },
            };
          }
        }
      }
    } catch (err) {
      console.warn('[userService] Error al consultar colección users en Firestore:', err);
    }
  }

  // 2. Fallback a estado local en memoria
  const local = (cleanUid ? getLocalUserProfile(cleanUid) : null) || (cleanEmail ? getLocalUserProfile(cleanEmail) : null);
  if (local) {
    return {
      docId: local.uid,
      data: {
        ...local,
        isProfileComplete: true,
      },
    };
  }

  return null;
}

/**
 * Consulta la colección `invitations` en Firestore buscando una invitación activa (status === 'pending')
 * para el correo especificado (case-insensitive)
 */
export async function findPendingInvitationInFirestore(
  email: string
): Promise<Invitation | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const invRef = collection(db, 'invitations');
      const q = query(invRef, where('email', '==', cleanEmail));
      const snap = await withTimeout(getDocs(q), 4000, null);

      if (snap && !snap.empty) {
        const pendingDoc = snap.docs.find((d) => {
          const data = d.data();
          const dEmail = (data.email || '').trim().toLowerCase();
          const status = data.status || 'pending';
          return dEmail === cleanEmail && status === 'pending';
        });

        if (pendingDoc) {
          const d = pendingDoc.data();
          return {
            id: pendingDoc.id,
            token: d.token || pendingDoc.id,
            email: cleanEmail,
            supervisorId: d.supervisorId || 'admin-99',
            supervisorName: d.supervisorName || 'Supervisor',
            supervisorEmail: d.supervisorEmail,
            created_by_ti_id: d.created_by_ti_id,
            issuerRole: d.issuerRole || 'Supervisor',
            team: d.team || d.teamName || 'Equipo Corporativo',
            teamName: d.teamName || d.team || 'Equipo Corporativo',
            teamId: d.teamId || d.assignedTeamId || 'team-default',
            assignedTeamId: d.assignedTeamId || d.teamId || 'team-default',
            roleTitle: d.roleTitle || 'Colaborador',
            role: d.role || d.targetRole || 'Colaborador',
            targetRole: d.targetRole || d.role || 'Colaborador',
            status: 'pending',
            createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
            expiresAt: typeof d.expiresAt === 'number' ? d.expiresAt : Date.now() + 48 * 3600 * 1000,
            notes: d.notes,
          } as Invitation;
        }
      }

      // Consulta exhaustiva en toda la colección invitations si no coincidió por query indexada
      const allInv = await withTimeout(getDocs(collection(db, 'invitations')), 4000, null);
      if (allInv && !allInv.empty) {
        const matched = allInv.docs.find((d) => {
          const data = d.data();
          const dEmail = (data.email || '').trim().toLowerCase();
          return dEmail === cleanEmail && data.status === 'pending';
        });
        if (matched) {
          const d = matched.data();
          return {
            id: matched.id,
            token: d.token || matched.id,
            email: cleanEmail,
            supervisorId: d.supervisorId || 'admin-99',
            supervisorName: d.supervisorName || 'Supervisor',
            supervisorEmail: d.supervisorEmail,
            created_by_ti_id: d.created_by_ti_id,
            issuerRole: d.issuerRole || 'Supervisor',
            team: d.team || d.teamName || 'Equipo Corporativo',
            teamName: d.teamName || d.team || 'Equipo Corporativo',
            teamId: d.teamId || d.assignedTeamId || 'team-default',
            roleTitle: d.roleTitle || 'Colaborador',
            role: d.role || d.targetRole || 'Colaborador',
            status: 'pending',
            createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
            expiresAt: typeof d.expiresAt === 'number' ? d.expiresAt : Date.now() + 48 * 3600 * 1000,
            notes: d.notes,
          } as Invitation;
        }
      }
    } catch (err) {
      console.warn('[userService] Error al consultar invitaciones en Firestore:', err);
    }
  }

  // 2. Fallback a Zustand useInvitationStore
  const localInv = useInvitationStore.getState().invitations.find(
    (i) => (i.email || '').trim().toLowerCase() === cleanEmail && i.status === 'pending'
  );

  return localInv || null;
}

export type LoginAccessResult =
  | {
      allowed: true;
      user: UserProfileDocument;
      message?: string;
    }
  | {
      allowed: false;
      action: 'redirect_activate';
      invitation: Invitation;
      inviteUrl: string;
      message: string;
    }
  | {
      allowed: false;
      action: 'blocked_inactive';
      message: string;
    }
  | {
      allowed: false;
      action: 'not_whitelisted';
      message: string;
    };

/**
 * Guardia Maestro de Inicio de Sesión (Orden Estricto de Validación):
 * 1. Buscar Primero en `users`:
 *    - Si existe y está activo: Permite acceso inmediato al dashboard (sin buscar invitación).
 *      Vincula firebaseUser.uid y photoURL si entraba por Google.
 *    - Si existe y está inactivo: Bloquea con mensaje de cuenta inhabilitada.
 * 2. Si NO existe en `users`:
 *    - Buscar invitación válida (status === 'pending') en `invitations`.
 *    - Si existe: Redirige a activación de cuenta.
 *    - Si no existe: Bloquea con "Acceso restringido: solicita previamente..." y cierra sesión.
 */
export async function processLoginAccess(
  firebaseUser: {
    uid: string;
    email: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  }
): Promise<LoginAccessResult> {
  const cleanEmail = (firebaseUser.email || '').trim().toLowerCase();
  const cleanUid = (firebaseUser.uid || '').trim();

  // Cuenta especial TI Root
  const isTiRoot =
    cleanEmail.includes('ti.root') ||
    cleanEmail.startsWith('ti@') ||
    cleanEmail.includes('root');

  // =========================================================================
  // PASO 1: Buscar Primero en la Colección `users` (Usuarios Ya Registrados)
  // =========================================================================
  const foundUser = await findUserInUsersCollection(cleanUid, cleanEmail);

  if (foundUser) {
    const { docId, data: existingDoc } = foundUser;

    // Verificar estatus (no bloqueado / inhabilitado)
    const isInactive =
      !isTiRoot &&
      (existingDoc.status === 'inactive' ||
        existingDoc.isActive === false ||
        (existingDoc as any).accessRevoked === true);

    if (isInactive) {
      return {
        allowed: false,
        action: 'blocked_inactive',
        message:
          `Acceso suspendido: La cuenta "${cleanEmail}" está inhabilitada. Contacta al Administrador de TI o a tu supervisor.`,
      };
    }

    // Usuario activo: Permitir acceso inmediato sin buscar ni exigir invitación
    const updates: Partial<UserProfileDocument> = {
      updatedAt: new Date().toISOString(),
      isProfileComplete: true,
      status: 'active',
      isActive: true,
    };
    let needsFirestoreUpdate = false;

    // Si entró por Google y su documento tenía otro UID, vincular firebaseUser.uid
    if (cleanUid && existingDoc.uid !== cleanUid) {
      updates.uid = cleanUid;
      needsFirestoreUpdate = true;
    }

    // Actualizar photoURL si viene de Google
    if (firebaseUser.photoURL && firebaseUser.photoURL !== existingDoc.photoURL) {
      updates.photoURL = firebaseUser.photoURL;
      updates.profileImage = firebaseUser.photoURL;
      needsFirestoreUpdate = true;
    }

    // Persistir vinculación en Firestore
    if (needsFirestoreUpdate && isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, 'users', docId), updates, { merge: true });
        if (cleanUid && docId !== cleanUid) {
          await setDoc(
            doc(db, 'users', cleanUid),
            { ...existingDoc, ...updates, uid: cleanUid },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn('[userService] Error al vincular UID/photoURL en Firestore:', err);
      }
    }

    const resolvedRole = normalizeRole(existingDoc.role || 'Empleado');
    const finalUserDoc: UserProfileDocument = {
      ...existingDoc,
      ...updates,
      role: resolvedRole,
      isProfileComplete: true,
    };

    // Actualizar sesión en el store de Zustand
    useCheckinStore.getState().loginWithFirebaseUser(
      {
        uid: cleanUid || existingDoc.uid,
        email: finalUserDoc.email,
        displayName:
          `${finalUserDoc.name} ${finalUserDoc.lastName || ''}`.trim() ||
          firebaseUser.displayName ||
          finalUserDoc.email,
        photoURL: finalUserDoc.photoURL || firebaseUser.photoURL || null,
      },
      {
        role: finalUserDoc.role,
        team: finalUserDoc.team || finalUserDoc.teamName || 'Sin equipo asignado',
        teamId: finalUserDoc.teamId || undefined,
        assignedTeams: finalUserDoc.assignedTeams,
        status: 'active',
        isActive: true,
        supervisorId: finalUserDoc.supervisorId || '',
        supervisorName: finalUserDoc.supervisorName || '',
        isProfileComplete: true,
      }
    );

    return {
      allowed: true,
      user: finalUserDoc,
      message: `¡Bienvenido! Sesión iniciada con éxito.`,
    };
  }

  // Si es TI Root y aún no estaba en users, se le autoriza acceso maestro
  if (isTiRoot) {
    const tiDoc: UserProfileDocument = {
      uid: cleanUid,
      email: cleanEmail,
      name: firebaseUser.displayName || 'TI Root',
      role: 'TI',
      team: 'TI Root',
      teamName: 'TI Root',
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    };
    useCheckinStore.getState().loginWithFirebaseUser(
      {
        uid: cleanUid,
        email: cleanEmail,
        displayName: tiDoc.name,
        photoURL: firebaseUser.photoURL || null,
      },
      {
        role: 'TI',
        team: 'TI Root',
        status: 'active',
        isActive: true,
        isProfileComplete: true,
      }
    );
    if (isFirebaseConfigured() && db) {
      setDoc(doc(db, 'users', cleanUid), tiDoc, { merge: true }).catch(console.warn);
    }
    return {
      allowed: true,
      user: tiDoc,
      message: 'Bienvenido: Administrador TI Root',
    };
  }

  // =========================================================================
  // PASO 2: Validar Lista Blanca / Invitaciones (SOLO si el usuario NO existe en `users`)
  // =========================================================================
  const pendingInvitation = await findPendingInvitationInFirestore(cleanEmail);

  if (pendingInvitation && pendingInvitation.status === 'pending') {
    const inviteUrl = buildInviteUrl(pendingInvitation.token);
    return {
      allowed: false,
      action: 'redirect_activate',
      invitation: pendingInvitation,
      inviteUrl,
      message: 'Invitación corporativa encontrada. Por favor completa la activación de tu cuenta.',
    };
  }

  // =========================================================================
  // PASO 3: Denegación de Acceso con Mensaje Estricto
  // =========================================================================
  return {
    allowed: false,
    action: 'not_whitelisted',
    message: `Acceso restringido: La cuenta "${cleanEmail}" no cuenta con una invitación previa en la lista blanca de la firma. Para poder registrarte y crear tu perfil, solicita previamente a tu supervisor o a TI que emita tu invitación.`,
  };
}

/**
 * Consulta el perfil de usuario en Firestore por UID con fallback a users general
 */
export async function getUserProfileByUid(uid: string): Promise<UserProfileDocument | null> {
  if (!uid) return null;
  const res = await findUserInUsersCollection(uid, '');
  return res ? res.data : null;
}

/**
 * Consulta el perfil de usuario por correo electrónico con fallback a users general
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfileDocument | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  const res = await findUserInUsersCollection('', cleanEmail);
  return res ? res.data : null;
}

/**
 * Guarda o actualiza el perfil en el store local de inmediato y en Firestore en background
 */
export async function saveOrUpdateUserProfile(
  uid: string,
  profileData: Partial<UserProfileDocument>,
  existingKnownDoc?: UserProfileDocument | null
): Promise<UserProfileDocument> {
  const existing = existingKnownDoc || getLocalUserProfile(uid) || (profileData.email ? getLocalUserProfile(profileData.email) : null);

  const cleanEmail = (profileData.email || existing?.email || '').trim().toLowerCase();
  const resolvedRole = normalizeRole(profileData.role || existing?.role || 'Empleado');
  const nowIso = new Date().toISOString();

  const finalDocument: UserProfileDocument = {
    uid,
    email: cleanEmail,
    name: profileData.name || existing?.name || profileData.firstName || 'Usuario',
    firstName: profileData.firstName || existing?.firstName,
    lastName: profileData.lastName || existing?.lastName,
    photoURL: profileData.photoURL !== undefined ? profileData.photoURL : existing?.photoURL || null,
    profileImage: profileData.photoURL || profileData.profileImage || existing?.profileImage,
    role: resolvedRole,
    team: profileData.team !== undefined ? profileData.team : (existing?.team || 'Sin equipo asignado'),
    teamName: profileData.teamName !== undefined ? profileData.teamName : (existing?.teamName || profileData.team || existing?.team || 'Sin equipo asignado'),
    teamId: profileData.teamId !== undefined ? profileData.teamId : (existing?.teamId || null),
    assignedTeams: profileData.assignedTeams || existing?.assignedTeams || [],
    status: profileData.status || existing?.status || 'active',
    isActive: profileData.isActive !== undefined ? profileData.isActive : (existing?.isActive !== undefined ? existing.isActive : true),
    supervisorId: profileData.supervisorId ?? existing?.supervisorId ?? null,
    supervisorName: profileData.supervisorName || existing?.supervisorName,
    supervisorCode: profileData.supervisorCode || existing?.supervisorCode,
    isProfileComplete:
      profileData.isProfileComplete !== undefined
        ? profileData.isProfileComplete
        : existing?.isProfileComplete ?? true,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  // 1. Sincronizar en el store local de Zustand de forma inmediata
  const { updateProfile } = useCheckinStore.getState();
  updateProfile({
    id: uid,
    name: finalDocument.name,
    lastName: finalDocument.lastName,
    email: finalDocument.email,
    photoURL: finalDocument.photoURL,
    profileImage: finalDocument.photoURL || finalDocument.profileImage,
    role: finalDocument.role,
    team: finalDocument.team,
    supervisorId: finalDocument.supervisorId || undefined,
    supervisorName: finalDocument.supervisorName,
    isProfileComplete: finalDocument.isProfileComplete,
  });

  // 2. Persistir en Firestore en segundo plano (no bloquea el hilo ni la UI)
  if (isFirebaseConfigured() && db) {
    const userRef = doc(db, 'users', uid);
    withTimeout(setDoc(userRef, finalDocument, { merge: true }), 3000, null).catch((err) => {
      console.warn('[userService] Persistencia de fondo en Firestore diferida:', err);
    });
  }

  return finalDocument;
}

// Mapa para evitar llamadas duplicadas simultáneas por el mismo UID
const inFlightSessionPromises = new Map<string, Promise<{
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  user: UserProfileDocument | null;
}>>();

/**
 * Función Maestra de Sesión de Usuario (Google OAuth / Email)
 * Resuelve y conecta al usuario usando processLoginAccess
 */
export async function handleUserSession(
  firebaseUser: { uid: string; email: string | null; displayName?: string | null; photoURL?: string | null } | null
): Promise<{
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  user: UserProfileDocument | null;
}> {
  if (!firebaseUser || !firebaseUser.uid) {
    return {
      isAuthenticated: false,
      isProfileComplete: false,
      user: null,
    };
  }

  // Si ya hay una resolución en vuelo para este UID, reutilizarla
  const inFlight = inFlightSessionPromises.get(firebaseUser.uid);
  if (inFlight) {
    return inFlight;
  }

  const sessionPromise = (async () => {
    try {
      const access = await processLoginAccess(firebaseUser);
      if (access.allowed) {
        return {
          isAuthenticated: true,
          isProfileComplete: true,
          user: access.user,
        };
      }

      return {
        isAuthenticated: false,
        isProfileComplete: false,
        user: null,
      };
    } catch (err) {
      console.error('[userService] Error en handleUserSession:', err);
      return {
        isAuthenticated: false,
        isProfileComplete: false,
        user: null,
      };
    } finally {
      inFlightSessionPromises.delete(firebaseUser.uid);
    }
  })();

  inFlightSessionPromises.set(firebaseUser.uid, sessionPromise);
  return sessionPromise;
}
