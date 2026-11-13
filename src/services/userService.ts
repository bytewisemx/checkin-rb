import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { useCheckinStore } from '../store/useCheckinStore';
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
function withTimeout<T>(promise: Promise<T>, ms = 1200, fallback: T): Promise<T> {
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
 * Consulta el perfil de usuario en Firestore por UID con timeout y fallback al almacén local
 */
export async function getUserProfileByUid(uid: string): Promise<UserProfileDocument | null> {
  if (!uid) return null;

  // 1. Comprobar caché/almacén local primero
  const local = getLocalUserProfile(uid);
  if (local && local.isProfileComplete) {
    return local;
  }

  // 2. Intentar Firestore con timeout estricto de 1.2s para evitar cuelgues
  if (isFirebaseConfigured() && db) {
    try {
      const userRef = doc(db, 'users', uid);
      const snapshot = await withTimeout(getDoc(userRef), 1200, null);
      if (snapshot && snapshot.exists()) {
        const data = snapshot.data() as UserProfileDocument;
        return {
          ...data,
          uid: snapshot.id,
          role: normalizeRole(data.role),
          isProfileComplete: Boolean(data.isProfileComplete),
        };
      }
    } catch (err) {
      console.warn('[userService] Error al consultar perfil en Firestore por UID:', err);
    }
  }

  return local;
}

/**
 * Consulta el perfil de usuario por correo electrónico con timeout
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfileDocument | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Comprobar local primero
  const local = getLocalUserProfile(cleanEmail);
  if (local && local.isProfileComplete) {
    return local;
  }

  // 2. Intentar Firestore con timeout de 1.2s
  if (isFirebaseConfigured() && db) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnapshot = await withTimeout(getDocs(q), 1200, null);
      if (querySnapshot && !querySnapshot.empty) {
        const firstDoc = querySnapshot.docs[0];
        const data = firstDoc.data() as UserProfileDocument;
        return {
          ...data,
          uid: firstDoc.id,
          role: normalizeRole(data.role),
          isProfileComplete: Boolean(data.isProfileComplete),
        };
      }
    } catch (err) {
      console.warn('[userService] Error al consultar perfil en Firestore por Email:', err);
    }
  }

  return local;
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
    withTimeout(setDoc(userRef, finalDocument, { merge: true }), 2000, null).catch((err) => {
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
 * Optimizado para respuesta instantánea (< 50ms) usando almacenamiento local prioritario
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
      const userEmail = (firebaseUser.email || '').trim().toLowerCase();

      // 1. Verificación instantánea en memoria/local primero
      let userDoc = getLocalUserProfile(firebaseUser.uid) || (userEmail ? getLocalUserProfile(userEmail) : null);

      // 2. Si no está en memoria local, buscar con timeout en Firestore
      if (!userDoc) {
        userDoc = await getUserProfileByUid(firebaseUser.uid);
      }
      if (!userDoc && userEmail) {
        userDoc = await getUserProfileByEmail(userEmail);
      }

      // 3. Si el usuario existe y su perfil ya está completo
      if (userDoc && userDoc.isProfileComplete) {
        // Si hay una nueva photoURL de Google, sincronizarla sin bloquear
        if (firebaseUser.photoURL && firebaseUser.photoURL !== userDoc.photoURL) {
          userDoc.photoURL = firebaseUser.photoURL;
          userDoc.profileImage = firebaseUser.photoURL;
          saveOrUpdateUserProfile(userDoc.uid, {
            photoURL: firebaseUser.photoURL,
            profileImage: firebaseUser.photoURL,
          }, userDoc);
        }

        // Iniciar sesión activa en Zustand Store inmediatamente
        useCheckinStore.getState().loginWithFirebaseUser(
          {
            uid: userDoc.uid,
            email: userDoc.email,
            displayName: `${userDoc.name} ${userDoc.lastName || ''}`.trim(),
            photoURL: userDoc.photoURL || firebaseUser.photoURL,
          },
          {
            role: userDoc.role,
            team: userDoc.team || userDoc.teamName || 'Sin equipo asignado',
            teamId: userDoc.teamId || undefined,
            assignedTeams: userDoc.assignedTeams,
            status: userDoc.status,
            isActive: userDoc.isActive,
            supervisorId: userDoc.supervisorId || '',
            supervisorName: userDoc.supervisorName || '',
            isProfileComplete: true,
          }
        );

        return {
          isAuthenticated: true,
          isProfileComplete: true,
          user: userDoc,
        };
      }

      // 4. Usuario autenticado pero aún sin completar perfil
      return {
        isAuthenticated: true,
        isProfileComplete: false,
        user: userDoc,
      };
    } catch (err) {
      console.error('[userService] Error en handleUserSession:', err);
      return {
        isAuthenticated: true,
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
