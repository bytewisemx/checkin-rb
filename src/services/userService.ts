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
  teamId?: string;
  team?: string;
  supervisorId?: string | null;
  supervisorName?: string;
  supervisorCode?: string;
  isProfileComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Consulta el perfil de usuario en Firestore por UID, con fallback al almacén local
 */
export async function getUserProfileByUid(uid: string): Promise<UserProfileDocument | null> {
  if (!uid) return null;

  // 1. Intentar Firestore si Firebase está configurado
  if (isFirebaseConfigured() && db) {
    try {
      const userRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
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

  // 2. Fallback: buscar en el almacén local de Zustand (mockEmployeesData y directorio)
  const state = useCheckinStore.getState();
  const localEmp = state.mockEmployeesData.find((e) => e.id === uid);
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

  const dirEntry = state.userPermissionsDirectory[uid];
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
 * Consulta el perfil de usuario por correo electrónico (soporte Google <-> Contraseña)
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfileDocument | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Intentar Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
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

  // 2. Fallback local por email
  const state = useCheckinStore.getState();
  const localEmp = state.mockEmployeesData.find(
    (e) => (e.email || '').trim().toLowerCase() === cleanEmail
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

  const dirEntry = Object.values(state.userPermissionsDirectory).find(
    (u) => (u.email || '').trim().toLowerCase() === cleanEmail
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
 * Guarda o actualiza el documento del perfil de usuario tanto en Firestore como en el store local
 */
export async function saveOrUpdateUserProfile(
  uid: string,
  profileData: Partial<UserProfileDocument>
): Promise<UserProfileDocument> {
  const existing = (await getUserProfileByUid(uid)) || (profileData.email ? await getUserProfileByEmail(profileData.email) : null);

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
    team: profileData.team || existing?.team || 'Auditoría Fiscal',
    teamId: profileData.teamId || existing?.teamId,
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

  // 1. Guardar en Firestore si está disponible
  if (isFirebaseConfigured() && db) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, finalDocument, { merge: true });
    } catch (err) {
      console.warn('[userService] Error al guardar perfil en Firestore:', err);
    }
  }

  // 2. Sincronizar en el store local de Zustand
  const { updateProfile } = useCheckinStore.getState();
  
  // Actualizar usuario activo si es el mismo
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

  return finalDocument;
}

/**
 * Función Maestra de Sesión de Usuario (Google OAuth / Email)
 * Implementa la verificación estricta de perfil existente y sincronización de foto de Google
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

  try {
    const userEmail = (firebaseUser.email || '').trim().toLowerCase();

    // 1. Consultar perfil en Firestore / Almacén por UID
    let userDoc = await getUserProfileByUid(firebaseUser.uid);

    // 2. Fallback: buscar por correo electrónico si se vinculó un nuevo proveedor (Google <-> Email)
    if (!userDoc && userEmail) {
      userDoc = await getUserProfileByEmail(userEmail);
      if (userDoc) {
        // Actualizar UID y photoURL de Google si no tenía foto previamente
        userDoc = await saveOrUpdateUserProfile(firebaseUser.uid, {
          ...userDoc,
          uid: firebaseUser.uid,
          photoURL: userDoc.photoURL || firebaseUser.photoURL || null,
          profileImage: userDoc.photoURL || firebaseUser.photoURL || userDoc.profileImage,
        });
      }
    }

    // 3. Si es usuario de Google y no tiene foto guardada aún, sincronizarla de inmediato
    if (userDoc && !userDoc.photoURL && firebaseUser.photoURL) {
      userDoc = await saveOrUpdateUserProfile(userDoc.uid, {
        photoURL: firebaseUser.photoURL,
        profileImage: firebaseUser.photoURL,
      });
    }

    // 4. Si el documento existe y está completo
    if (userDoc && userDoc.isProfileComplete === true) {
      // Iniciar sesión activa en el store
      useCheckinStore.getState().loginWithFirebaseUser(
        {
          uid: userDoc.uid,
          email: userDoc.email,
          displayName: `${userDoc.name} ${userDoc.lastName || ''}`.trim(),
          photoURL: userDoc.photoURL || firebaseUser.photoURL,
        },
        {
          role: userDoc.role,
          team: userDoc.team || 'Auditoría Fiscal',
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

    // 5. Usuario autenticado pero sin perfil completado
    return {
      isAuthenticated: true,
      isProfileComplete: false,
      user: userDoc,
    };
  } catch (error) {
    console.error('[userService] Error al procesar sesión de usuario:', error);
    return {
      isAuthenticated: false,
      isProfileComplete: false,
      user: null,
    };
  }
}
