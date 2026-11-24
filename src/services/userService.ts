import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { useCheckinStore } from '../store/useCheckinStore';
import { useRayonerStore } from '../store/useRayonerStore';
import { useInvitationStore, buildInviteUrl } from '../store/useInvitationStore';
import type { Invitation } from '../types/invitation';
import { normalizeRole, getDefaultModulesForRole, getDefaultPermissionsForRole, type UserRole } from './rbac';
import { trackFirestoreRead, trackFirestoreWrite } from './firestoreTelemetry';

/**
 * Mapa determinístico de correos demo a IDs fijos en Firestore
 * Evita duplicados al iniciar sesión desde distintos navegadores o sesiones Auth.
 */
export const DEMO_EMAIL_TO_FIXED_ID: Record<string, string> = {
  'ti.root@russellbedford.mx': 'demo_ti',
  'socio.prueba@russellbedford.mx': 'demo_socio',
  'gerente.prueba@russellbedford.mx': 'demo_gerente',
  'rh.prueba@russellbedford.mx': 'demo_rh',
  'supervisor.prueba@russellbedford.mx': 'demo_supervisor',
  'colaborador.prueba@russellbedford.mx': 'demo_colaborador',
};

export function resolveFixedDemoId(email?: string | null): string | null {
  if (!email) return null;
  return DEMO_EMAIL_TO_FIXED_ID[email.trim().toLowerCase()] || null;
}

/**
 * Construye un nombre completo limpio evitando duplicar apellidos
 * (ej. corrige "Gerente Prueba" + "Prueba" -> "Gerente Prueba").
 */
export function buildCleanDisplayName(name?: string | null, lastName?: string | null): string {
  const cleanName = (name || '').trim();
  const cleanLast = (lastName || '').trim();
  if (!cleanName) return cleanLast;
  if (!cleanLast) return cleanName;
  if (cleanName.toLowerCase().endsWith(cleanLast.toLowerCase())) {
    return cleanName;
  }
  return `${cleanName} ${cleanLast}`.trim();
}

export interface UserProfileDocument {
  uid: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string | null;
  profileImage?: string;
  role: UserRole | 'employee' | 'supervisor';
  hierarchyLevel?: 0 | 1 | 2 | 3 | 4;
  reportsTo?: string | null;
  teamId?: string | null;
  teamIds?: string[]; // Modelo multi-equipo en producción
  team?: string;
  teamName?: string;
  assignedTeams?: string[];
  modules?: Record<string, boolean>;
  faceDescriptor?: number[]; // Vector numérico de 128 floats (nunca imágenes)
  status?: 'active' | 'inactive';
  isActive?: boolean;
  supervisorId?: string | null;
  supervisorName?: string;
  supervisorCode?: string;
  gerenteId?: string | null;
  managerId?: string | null;
  socioId?: string | null;
  partnerId?: string | null;
  currentRank?: 'bronce' | 'plata' | 'oro' | 'diamante';
  monthlyPoints?: number;
  rankSeason?: string;
  mustChangePassword?: boolean;
  createdByItUid?: string;
  isProfileComplete: boolean;
  authUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Actualiza exclusivamente el vector biométrico facial (128 floats) del usuario en Firestore.
 * Rechaza cualquier intento de almacenar imágenes o vectores con longitud inválida.
 */
export async function updateUserFaceDescriptorInFirestore(
  uid: string,
  faceDescriptor: number[]
): Promise<{ success: boolean; error?: string }> {
  if (
    !uid ||
    !Array.isArray(faceDescriptor) ||
    faceDescriptor.length !== 128 ||
    !faceDescriptor.every((v) => typeof v === 'number' && Number.isFinite(v))
  ) {
    return {
      success: false,
      error: 'Vector biométrico inválido: debe ser un arreglo numérico exacto de 128 flotantes.',
    };
  }

  if (!isFirebaseConfigured() || !db) {
    return { success: true };
  }

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        faceDescriptor,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return { success: true };
  } catch (err: any) {
    console.warn('[userService] Error al guardar faceDescriptor:', err);
    return { success: false, error: err?.message || 'Error al guardar vector facial.' };
  }
}

export function normalizeUserTeamIds(input: {
  teamIds?: string[] | null;
  assignedTeams?: string[] | null;
  teamId?: string | null;
}): string[] {
  const combined: string[] = [];
  if (Array.isArray(input.teamIds)) combined.push(...input.teamIds);
  if (Array.isArray(input.assignedTeams)) combined.push(...input.assignedTeams);
  if (typeof input.teamId === 'string' && input.teamId.trim()) {
    combined.push(input.teamId.trim());
  }
  return Array.from(
    new Set(combined.map((v) => String(v || '').trim()).filter(Boolean))
  );
}

/**
 * Actualiza los enlaces de cadena de mando jerárquica y equipos (`teamIds`) de un usuario en Firestore (`users/{userId}`)
 * y sincroniza inmediatamente los almacenes locales.
 */
export async function updateUserHierarchyInFirestore(
  userId: string,
  hierarchy: {
    reportsTo?: string | null;
    supervisorId?: string | null;
    supervisorName?: string;
    gerenteId?: string | null;
    managerId?: string | null;
    socioId?: string | null;
    partnerId?: string | null;
    teamIds?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: 'userId requerido' };

  const patch: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (hierarchy.reportsTo !== undefined) patch.reportsTo = hierarchy.reportsTo;
  if (hierarchy.supervisorId !== undefined) {
    patch.supervisorId = hierarchy.supervisorId;
    patch.supervisor_id = hierarchy.supervisorId;
  }
  if (hierarchy.supervisorName !== undefined) patch.supervisorName = hierarchy.supervisorName;
  if (hierarchy.gerenteId !== undefined || hierarchy.managerId !== undefined) {
    const gId = hierarchy.gerenteId ?? hierarchy.managerId ?? null;
    patch.gerenteId = gId;
    patch.managerId = gId;
  }
  if (hierarchy.socioId !== undefined || hierarchy.partnerId !== undefined) {
    const sId = hierarchy.socioId ?? hierarchy.partnerId ?? null;
    patch.socioId = sId;
    patch.partnerId = sId;
  }
  if (hierarchy.teamIds !== undefined) {
    const cleanTeamIds = normalizeUserTeamIds({ teamIds: hierarchy.teamIds });
    patch.teamIds = cleanTeamIds;
    patch.assignedTeams = cleanTeamIds;
    patch.teamId = cleanTeamIds[0] || null;
  }

  // 1. Actualizar en useCheckinStore local inmediatamente
  useCheckinStore.setState((state) => {
    const nextDir = { ...state.userPermissionsDirectory };
    if (nextDir[userId]) {
      nextDir[userId] = {
        ...nextDir[userId],
        ...patch,
      };
    }
    const nextMock = state.mockEmployeesData.map((emp) =>
      emp.id === userId ? { ...emp, ...patch } : emp
    );
    return {
      userPermissionsDirectory: nextDir,
      mockEmployeesData: nextMock,
      user:
        state.user && state.user.id === userId
          ? { ...state.user, ...patch }
          : state.user,
    };
  });

  // 2. Persistir en Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'users', userId), patch, { merge: true });
      trackFirestoreWrite(1);
    } catch (err: any) {
      console.warn('[userService] Error al actualizar jerarquía en Firestore:', err);
      return { success: false, error: err?.message || 'Error al persistir jerarquía.' };
    }
  }

  return { success: true };
}

let isFirestoreDatabaseAvailable: boolean | null = null;

/**
 * Envoltorio con timeout ultra-rápido para operaciones de red con Firestore
 * Si Firestore no responde en el tiempo límite (ej. 1500ms) o no existe la base de datos, resuelve con fallback inmediato
 */
function withTimeout<T>(promise: Promise<T>, ms = 1500, fallback: T): Promise<T> {
  if (isFirestoreDatabaseAvailable === false) {
    return Promise.resolve(fallback);
  }

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
          isFirestoreDatabaseAvailable = true;
          resolve(val);
        }
      })
      .catch((err: any) => {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('not-found') || msg.includes('not found') || msg.includes('database')) {
          isFirestoreDatabaseAvailable = false;
        }
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
  const fixedDemoId = resolveFixedDemoId(cleanEmail);

  // Mapeo maestro preconfigurado para garantizar roles y equipos oficiales
  const PRECONFIGURED_BASE_ACCOUNTS: Record<string, Partial<UserProfileDocument> & { fixedId: string }> = {
    'socio.prueba@russellbedford.mx': {
      fixedId: 'demo_socio',
      name: 'Socio Prueba',
      firstName: 'Socio',
      lastName: 'Prueba',
      role: 'Socio',
      hierarchyLevel: 1,
      reportsTo: null,
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'gerente.prueba@russellbedford.mx': {
      fixedId: 'demo_gerente',
      name: 'Gerente Prueba',
      firstName: 'Gerente',
      lastName: 'Prueba',
      role: 'Gerente',
      hierarchyLevel: 2,
      reportsTo: 'demo_socio',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'supervisor.prueba@russellbedford.mx': {
      fixedId: 'demo_supervisor',
      name: 'Supervisor Prueba',
      firstName: 'Supervisor',
      lastName: 'Prueba',
      role: 'Supervisor',
      hierarchyLevel: 3,
      reportsTo: 'demo_gerente',
      gerenteId: 'demo_gerente',
      managerId: 'demo_gerente',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'rh.prueba@russellbedford.mx': {
      fixedId: 'demo_rh',
      name: 'RH Prueba',
      firstName: 'RH',
      lastName: 'Prueba',
      role: 'RH',
      hierarchyLevel: 2,
      reportsTo: 'demo_socio',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'ti.root@russellbedford.mx': {
      fixedId: 'demo_ti',
      name: 'TI Prueba',
      firstName: 'TI',
      lastName: 'Prueba',
      role: 'TI',
      hierarchyLevel: 0,
      reportsTo: null,
      team: undefined,
      teamName: undefined,
      teamId: null,
      assignedTeams: [],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'colaborador.prueba@russellbedford.mx': {
      fixedId: 'demo_colaborador',
      name: 'Colaborador Prueba',
      firstName: 'Colaborador',
      lastName: 'Prueba',
      role: 'Colaborador',
      hierarchyLevel: 4,
      reportsTo: 'demo_supervisor',
      supervisorId: 'demo_supervisor',
      supervisorName: 'Supervisor Prueba',
      gerenteId: 'demo_gerente',
      managerId: 'demo_gerente',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
  };

  const baseConfig = PRECONFIGURED_BASE_ACCOUNTS[cleanEmail];

  // =========================================================================
  // PASO 1: Búsqueda Directa por getDoc(doc(db, 'users', cleanUid))
  // =========================================================================
  if (cleanUid && isFirebaseConfigured() && db && isFirestoreDatabaseAvailable !== false) {
    try {
      const snapUid = await withTimeout(getDoc(doc(db, 'users', cleanUid)), 2500, null);
      if (snapUid && snapUid.exists()) {
        trackFirestoreRead(1);
        const d = snapUid.data() as UserProfileDocument;
        const resolvedRole = normalizeRole(d.role || baseConfig?.role || 'Empleado');
        const resolvedTeam = d.team || d.teamName || baseConfig?.team;
        const resolvedTeamId = d.teamId || baseConfig?.teamId;

        return {
          docId: cleanUid,
          data: {
            ...d,
            uid: cleanUid,
            role: resolvedRole,
            team: resolvedTeam,
            teamName: d.teamName || resolvedTeam,
            teamId: resolvedTeamId,
            assignedTeams: d.assignedTeams || (resolvedTeamId ? [resolvedTeamId] : []),
            isProfileComplete: d.isProfileComplete !== undefined ? Boolean(d.isProfileComplete) : true,
          },
        };
      }
    } catch (err) {
      console.warn('[userService] Error al consultar users por UID directo:', err);
    }
  }

  // =========================================================================
  // PASO 2: Respaldo Automático por Email: query(users, where('email', '==', cleanEmail))
  // =========================================================================
  if (cleanEmail && isFirebaseConfigured() && db && isFirestoreDatabaseAvailable !== false) {
    try {
      let foundDoc: { id: string; data: UserProfileDocument } | null = null;

      // 2.1 Query where('email', '==', cleanEmail)
      const qEmail = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const snapEmail = await withTimeout(getDocs(qEmail), 2500, null);
      if (snapEmail && !snapEmail.empty) {
        trackFirestoreRead(snapEmail.size);
        const first = snapEmail.docs[0];
        foundDoc = { id: first.id, data: first.data() as UserProfileDocument };
      }

      // 2.2 Si no encontró por query, buscar en doc fijo demo_* o doc(users, cleanEmail)
      if (!foundDoc && fixedDemoId) {
        const demoSnap = await withTimeout(getDoc(doc(db, 'users', fixedDemoId)), 1500, null);
        if (demoSnap && demoSnap.exists()) {
          trackFirestoreRead(1);
          foundDoc = { id: fixedDemoId, data: demoSnap.data() as UserProfileDocument };
        }
      }

      if (!foundDoc) {
        const emailDocSnap = await withTimeout(getDoc(doc(db, 'users', cleanEmail)), 1200, null);
        if (emailDocSnap && emailDocSnap.exists()) {
          trackFirestoreRead(1);
          foundDoc = { id: emailDocSnap.id, data: emailDocSnap.data() as UserProfileDocument };
        }
      }

      // 2.3 Si se encontró por correo, enriquecer y SINCRONIZAR/COPIAR bajo users/{cleanUid}
      if (foundDoc) {
        const raw = foundDoc.data;
        const resolvedRole = normalizeRole(raw.role || baseConfig?.role || (cleanEmail.includes('socio') ? 'Socio' : 'Empleado'));
        const resolvedTeam = raw.team || raw.teamName || baseConfig?.team || (resolvedRole === 'Socio' ? 'Equipo Prueba' : undefined);
        const resolvedTeamId = raw.teamId || baseConfig?.teamId || (resolvedRole === 'Socio' ? 'team-prueba-01' : undefined);
        const cleanName = buildCleanDisplayName(raw.name || baseConfig?.name, raw.lastName || baseConfig?.lastName);

        const enrichedProfile: UserProfileDocument = {
          ...raw,
          uid: cleanUid || foundDoc.id,
          email: cleanEmail,
          name: cleanName || raw.name,
          role: resolvedRole,
          team: resolvedTeam,
          teamName: raw.teamName || resolvedTeam,
          teamId: resolvedTeamId,
          assignedTeams: raw.assignedTeams || (resolvedTeamId ? [resolvedTeamId] : []),
          status: raw.status || 'active',
          isActive: raw.isActive !== undefined ? raw.isActive : true,
          isProfileComplete: true,
          updatedAt: new Date().toISOString(),
        };

        // VINCULACIÓN Y COPIA EN users/{cleanUid} para recargas instantáneas sin degradación
        if (cleanUid && cleanUid !== foundDoc.id) {
          try {
            await setDoc(doc(db, 'users', cleanUid), enrichedProfile, { merge: true });
            trackFirestoreWrite(1);
          } catch (writeErr) {
            console.warn('[userService] Error al sincronizar perfil bajo users/{uid}:', writeErr);
          }
        }

        return {
          docId: cleanUid || foundDoc.id,
          data: enrichedProfile,
        };
      }
    } catch (err: any) {
      console.warn('[userService] Error al consultar users por Email:', err);
    }
  }

  // =========================================================================
  // PASO 3: Fallback a Cuenta Preconfigurada Oficial (Base de Prueba)
  // =========================================================================
  if (baseConfig) {
    const fixedDocId = cleanUid || baseConfig.fixedId || 'demo_user';
    const finalDoc: UserProfileDocument = {
      uid: fixedDocId,
      email: cleanEmail,
      name: baseConfig.name || 'Usuario',
      firstName: baseConfig.firstName,
      lastName: baseConfig.lastName,
      role: normalizeRole(baseConfig.role),
      hierarchyLevel: baseConfig.hierarchyLevel,
      reportsTo: baseConfig.reportsTo ?? null,
      supervisorId: baseConfig.supervisorId ?? null,
      supervisorName: baseConfig.supervisorName,
      gerenteId: baseConfig.gerenteId ?? null,
      managerId: baseConfig.managerId ?? null,
      socioId: baseConfig.socioId ?? null,
      partnerId: baseConfig.partnerId ?? null,
      team: baseConfig.team,
      teamName: baseConfig.teamName,
      teamId: baseConfig.teamId,
      assignedTeams: baseConfig.assignedTeams || (baseConfig.teamId ? [baseConfig.teamId] : []),
      status: 'active',
      isActive: true,
      isProfileComplete: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured() && db && cleanUid) {
      setDoc(doc(db, 'users', cleanUid), finalDoc, { merge: true }).catch(console.warn);
      if (baseConfig.fixedId && baseConfig.fixedId !== cleanUid) {
        setDoc(doc(db, 'users', baseConfig.fixedId), finalDoc, { merge: true }).catch(console.warn);
      }
    }

    return {
      docId: fixedDocId,
      data: finalDoc,
    };
  }

  // =========================================================================
  // PASO 4: Fallback a Estado Local en Memoria
  // =========================================================================
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
    const fixedDemoId = resolveFixedDemoId(cleanEmail);
    const canonicalDocId = fixedDemoId || docId;
    const cleanFullName = buildCleanDisplayName(existingDoc.name, existingDoc.lastName);

    const updates: Partial<UserProfileDocument> & { authUid?: string } = {
      updatedAt: new Date().toISOString(),
      isProfileComplete: true,
      status: 'active',
      isActive: true,
      name: cleanFullName || existingDoc.name,
    };
    let needsFirestoreUpdate = false;

    // Sincronizar y vincular siempre bajo users/{cleanUid} para que futuras recargas (F5) sean instantáneas
    if (cleanUid) {
      updates.authUid = cleanUid;
      if (isFirebaseConfigured() && db) {
        const docForUid: UserProfileDocument = {
          ...existingDoc,
          ...updates,
          uid: cleanUid,
          authUid: cleanUid,
        };
        setDoc(doc(db, 'users', cleanUid), docForUid, { merge: true }).catch(console.warn);
      }
    }

    // Actualizar photoURL si viene de Google
    if (firebaseUser.photoURL && firebaseUser.photoURL !== existingDoc.photoURL) {
      updates.photoURL = firebaseUser.photoURL;
      updates.profileImage = firebaseUser.photoURL;
      needsFirestoreUpdate = true;
    }

    // Persistir vinculación en el documento canónico
    if (needsFirestoreUpdate && isFirebaseConfigured() && db) {
      try {
        await setDoc(doc(db, 'users', canonicalDocId), updates, { merge: true });
        trackFirestoreWrite(1);
      } catch (err) {
        console.warn('[userService] Error al vincular UID/photoURL en Firestore:', err);
      }
    }

    const resolvedRole = normalizeRole(existingDoc.role || 'Empleado');
    const finalUserDoc: UserProfileDocument = {
      ...existingDoc,
      ...updates,
      uid: cleanUid || canonicalDocId,
      name: cleanFullName || existingDoc.name,
      role: resolvedRole,
      team: existingDoc.team || (resolvedRole === 'Socio' ? 'Equipo Prueba' : 'Sin equipo asignado'),
      teamName: existingDoc.teamName || existingDoc.team || (resolvedRole === 'Socio' ? 'Equipo Prueba' : 'Sin equipo asignado'),
      teamId: existingDoc.teamId || (resolvedRole === 'Socio' ? 'team-prueba-01' : undefined),
      assignedTeams: existingDoc.assignedTeams || (resolvedRole === 'Socio' ? ['team-prueba-01'] : undefined),
      mustChangePassword: Boolean(existingDoc.mustChangePassword),
      createdByItUid: existingDoc.createdByItUid,
      isProfileComplete: true,
    };

    // Actualizar sesión en el store de Zustand usando el UID real
    const sessionUid = cleanUid || canonicalDocId;
    useCheckinStore.getState().loginWithFirebaseUser(
      {
        uid: sessionUid,
        email: finalUserDoc.email,
        displayName:
          cleanFullName ||
          firebaseUser.displayName ||
          finalUserDoc.email,
        photoURL: finalUserDoc.photoURL || firebaseUser.photoURL || null,
      },
      {
        role: finalUserDoc.role,
        team: finalUserDoc.team,
        teamId: finalUserDoc.teamId || undefined,
        assignedTeams: finalUserDoc.assignedTeams,
        status: 'active',
        isActive: true,
        supervisorId: finalUserDoc.supervisorId || '',
        supervisorName: finalUserDoc.supervisorName || '',
        mustChangePassword: Boolean(finalUserDoc.mustChangePassword),
        createdByItUid: finalUserDoc.createdByItUid,
        isProfileComplete: true,
      }
    );

    return {
      allowed: true,
      user: finalUserDoc,
      message: `¡Bienvenido! Sesión iniciada con éxito.`,
    };
  }

  // Si es una cuenta base oficial de prueba y aún no estaba en users, se auto-provisiona con ID determinístico `demo_*`
  const PRECONFIGURED_BASE_ACCOUNTS: Record<string, Partial<UserProfileDocument> & { fixedId: string }> = {
    'ti.root@russellbedford.mx': {
      fixedId: 'demo_ti',
      name: 'TI Prueba',
      firstName: 'TI',
      lastName: 'Prueba',
      role: 'TI',
      hierarchyLevel: 0,
      reportsTo: null,
      team: undefined,
      teamName: undefined,
      teamId: null,
      assignedTeams: [],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'socio.prueba@russellbedford.mx': {
      fixedId: 'demo_socio',
      name: 'Socio Prueba',
      firstName: 'Socio',
      lastName: 'Prueba',
      role: 'socio' as any,
      hierarchyLevel: 1,
      reportsTo: null,
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'gerente.prueba@russellbedford.mx': {
      fixedId: 'demo_gerente',
      name: 'Gerente Prueba',
      firstName: 'Gerente',
      lastName: 'Prueba',
      role: 'gerente' as any,
      hierarchyLevel: 2,
      reportsTo: 'demo_socio',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'rh.prueba@russellbedford.mx': {
      fixedId: 'demo_rh',
      name: 'RH Prueba',
      firstName: 'RH',
      lastName: 'Prueba',
      role: 'RH',
      hierarchyLevel: 2,
      reportsTo: 'demo_socio',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'supervisor.prueba@russellbedford.mx': {
      fixedId: 'demo_supervisor',
      name: 'Supervisor Prueba',
      firstName: 'Supervisor',
      lastName: 'Prueba',
      role: 'Supervisor',
      hierarchyLevel: 3,
      reportsTo: 'demo_gerente',
      gerenteId: 'demo_gerente',
      managerId: 'demo_gerente',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
    'colaborador.prueba@russellbedford.mx': {
      fixedId: 'demo_colaborador',
      name: 'Colaborador Prueba',
      firstName: 'Colaborador',
      lastName: 'Prueba',
      role: 'Empleado',
      hierarchyLevel: 4,
      reportsTo: 'demo_supervisor',
      supervisorId: 'demo_supervisor',
      supervisorName: 'Supervisor Prueba',
      gerenteId: 'demo_gerente',
      managerId: 'demo_gerente',
      socioId: 'demo_socio',
      partnerId: 'demo_socio',
      team: 'Equipo Prueba',
      teamName: 'Equipo Prueba',
      teamId: 'team-prueba-01',
      assignedTeams: ['team-prueba-01'],
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    },
  };

  const demoProfile = PRECONFIGURED_BASE_ACCOUNTS[cleanEmail];
  if (demoProfile || isTiRoot) {
    const fixedDocId = demoProfile?.fixedId || 'demo_ti';
    const roleVal = demoProfile?.role || 'TI';
    const finalDoc: UserProfileDocument & { authUid?: string } = {
      uid: fixedDocId,
      authUid: cleanUid || undefined,
      email: cleanEmail,
      name: demoProfile?.name || firebaseUser.displayName || 'TI Prueba',
      firstName: demoProfile?.firstName,
      lastName: demoProfile?.lastName,
      role: roleVal,
      hierarchyLevel: demoProfile?.hierarchyLevel ?? 0,
      reportsTo: demoProfile?.reportsTo ?? null,
      supervisorId: demoProfile?.supervisorId ?? null,
      supervisorName: demoProfile?.supervisorName,
      gerenteId: demoProfile?.gerenteId ?? null,
      managerId: demoProfile?.managerId ?? null,
      socioId: demoProfile?.socioId ?? null,
      partnerId: demoProfile?.partnerId ?? null,
      team: demoProfile?.team,
      teamName: demoProfile?.teamName,
      teamId: demoProfile?.teamId,
      teamIds: normalizeUserTeamIds({
        assignedTeams: demoProfile?.assignedTeams,
        teamId: demoProfile?.teamId,
      }),
      assignedTeams: demoProfile?.assignedTeams,
      status: 'active',
      isActive: true,
      isProfileComplete: true,
    };
    useCheckinStore.getState().loginWithFirebaseUser(
      {
        uid: fixedDocId,
        email: cleanEmail,
        displayName: finalDoc.name,
        photoURL: firebaseUser.photoURL || null,
      },
      {
        role: finalDoc.role,
        team: finalDoc.team || finalDoc.teamName || 'Sin equipo asignado',
        teamId: finalDoc.teamId || undefined,
        assignedTeams: finalDoc.assignedTeams,
        status: 'active',
        isActive: true,
        supervisorId: finalDoc.supervisorId || '',
        supervisorName: finalDoc.supervisorName || '',
        isProfileComplete: true,
      }
    );
    if (isFirebaseConfigured() && db) {
      setDoc(doc(db, 'users', fixedDocId), finalDoc, { merge: true }).catch(console.warn);
    }
    return {
      allowed: true,
      user: finalDoc,
      message: `¡Bienvenido! Sesión iniciada como ${finalDoc.name}.`,
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

  const resolvedTeamIds = normalizeUserTeamIds({
    teamIds: profileData.teamIds,
    assignedTeams: profileData.assignedTeams ?? existing?.assignedTeams,
    teamId: profileData.teamId !== undefined ? profileData.teamId : existing?.teamId,
  });

  // Para usuarios reales el ID de documento es estrictamente su Firebase Auth UID;
  // solo las 6 cuentas demo mantienen su ID determinístico temporal durante pruebas.
  const targetDocId = resolveFixedDemoId(cleanEmail) || uid;

  const finalDocument: UserProfileDocument = {
    uid: targetDocId,
    email: cleanEmail,
    name: profileData.name || existing?.name || profileData.firstName || 'Usuario',
    firstName: profileData.firstName || existing?.firstName,
    lastName: profileData.lastName || existing?.lastName,
    photoURL: profileData.photoURL !== undefined ? profileData.photoURL : existing?.photoURL || null,
    profileImage: profileData.photoURL || profileData.profileImage || existing?.profileImage,
    role: resolvedRole,
    team: profileData.team !== undefined ? profileData.team : (existing?.team || 'Sin equipo asignado'),
    teamName: profileData.teamName !== undefined ? profileData.teamName : (existing?.teamName || profileData.team || existing?.team || 'Sin equipo asignado'),
    teamId: resolvedTeamIds[0] || null,
    teamIds: resolvedTeamIds,
    assignedTeams: resolvedTeamIds,
    status: profileData.status || existing?.status || 'active',
    isActive: profileData.isActive !== undefined ? profileData.isActive : (existing?.isActive !== undefined ? existing.isActive : true),
    supervisorId: profileData.supervisorId ?? existing?.supervisorId ?? null,
    supervisorName: profileData.supervisorName || existing?.supervisorName,
    supervisorCode: profileData.supervisorCode || existing?.supervisorCode,
    gerenteId: profileData.gerenteId ?? profileData.managerId ?? existing?.gerenteId ?? null,
    managerId: profileData.gerenteId ?? profileData.managerId ?? existing?.managerId ?? null,
    socioId: profileData.socioId ?? profileData.partnerId ?? existing?.socioId ?? null,
    partnerId: profileData.socioId ?? profileData.partnerId ?? existing?.partnerId ?? null,
    currentRank: profileData.currentRank || existing?.currentRank,
    monthlyPoints: profileData.monthlyPoints !== undefined ? profileData.monthlyPoints : existing?.monthlyPoints,
    rankSeason: profileData.rankSeason || existing?.rankSeason,
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
    id: targetDocId,
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

  // 2. Persistir en Firestore en segundo plano usando estrictamente `users/{targetDocId}` (request.auth.uid para usuarios reales)
  if (isFirebaseConfigured() && db) {
    const userRef = doc(db, 'users', targetDocId);
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

/**
 * Sincroniza el directorio local de usuarios con la colección real `users` de Firestore.
 * Deduplica estrictamente por correo electrónico (priorizando los IDs determinísticos `demo_*`)
 * para garantizar que el organigrama y los paneles muestren exactamente los usuarios vigentes.
 */
export async function syncUsersDirectoryFromFirestore(): Promise<UserProfileDocument[]> {
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const snap = await withTimeout(getDocs(collection(db, 'users')), 3000, null);
    if (!snap || snap.empty) return [];
    trackFirestoreRead(snap.size);

    const byEmail = new Map<string, UserProfileDocument>();
    const rawDocs = snap.docs.map((d) => ({
      docId: d.id,
      data: d.data() as Record<string, any>,
    }));

    for (const item of rawDocs) {
      const email = String(item.data.email || '').trim().toLowerCase();
      if (!email) continue;
      const fixedId = resolveFixedDemoId(email);
      const isPreferredDoc = fixedId ? item.docId === fixedId : true;

      const existing = byEmail.get(email);
      // Si ya guardamos el documento determinístico preferido, ignorar duplicados residuales
      if (existing && fixedId && existing.uid === fixedId && !isPreferredDoc) {
        continue;
      }

      const role = normalizeRole(item.data.role || 'colaborador');
      const cleanName = buildCleanDisplayName(item.data.name, item.data.lastName);

      byEmail.set(email, {
        uid: item.docId,
        email,
        name: cleanName || item.data.name || email.split('@')[0],
        firstName: item.data.firstName,
        lastName: item.data.lastName,
        photoURL: item.data.photoURL || null,
        profileImage: item.data.profileImage || item.data.photoURL || undefined,
        role,
        hierarchyLevel: item.data.hierarchyLevel,
        reportsTo: item.data.reportsTo ?? null,
        teamId: item.data.teamId ?? null,
        team: item.data.team ?? item.data.teamName ?? undefined,
        teamName: item.data.teamName ?? item.data.team ?? undefined,
        assignedTeams: Array.isArray(item.data.assignedTeams) ? item.data.assignedTeams : [],
        modules: item.data.modules,
        status: item.data.status || 'active',
        isActive: item.data.isActive !== false,
        supervisorId: item.data.supervisorId ?? item.data.supervisor_id ?? null,
        supervisorName: item.data.supervisorName,
        gerenteId: item.data.gerenteId ?? item.data.managerId ?? null,
        managerId: item.data.managerId ?? item.data.gerenteId ?? null,
        socioId: item.data.socioId ?? item.data.partnerId ?? null,
        partnerId: item.data.partnerId ?? item.data.socioId ?? null,
        currentRank: item.data.currentRank || 'bronce',
        monthlyPoints: typeof item.data.monthlyPoints === 'number' ? item.data.monthlyPoints : 0,
        rankSeason: item.data.rankSeason,
        isProfileComplete: item.data.isProfileComplete !== false,
      });
    }

    const usersList = Array.from(byEmail.values());
    if (usersList.length === 0) return [];

    const nextDirectory: Record<string, any> = {};
    usersList.forEach((u) => {
      nextDirectory[u.uid] = {
        id: u.uid,
        name: u.name,
        email: u.email,
        role: u.role,
        hierarchyLevel: u.hierarchyLevel,
        reportsTo: u.reportsTo ?? null,
        team: u.team,
        teamName: u.teamName,
        teamId: u.teamId || undefined,
        assignedTeams: u.assignedTeams || [],
        supervisorId: u.supervisorId ?? null,
        supervisor_id: u.supervisorId ?? undefined,
        gerenteId: u.gerenteId ?? null,
        managerId: u.managerId ?? null,
        socioId: u.socioId ?? null,
        partnerId: u.partnerId ?? null,
        photoURL: u.photoURL || null,
        permissions: getDefaultPermissionsForRole(u.role),
        modules: (u.modules as any) || getDefaultModulesForRole(u.role),
        currentRank: u.currentRank || 'bronce',
        monthlyPoints: typeof u.monthlyPoints === 'number' ? u.monthlyPoints : 0,
        rankSeason: u.rankSeason,
        accessRevoked: u.isActive === false || u.status === 'inactive',
      };
    });

    useCheckinStore.setState({
      userPermissionsDirectory: nextDirectory,
      mockEmployeesData: usersList.map((u) => ({
        id: u.uid,
        email: u.email,
        name: u.name,
        role: u.role,
        team: u.team || 'Sin equipo asignado',
        teamId: u.teamId || undefined,
        assignedTeams: u.assignedTeams || [],
        status: u.status || 'active',
        isProfileComplete: true,
        workedMinutesToday: 0,
        expectedEntryTime: '09:00',
        supervisor_id: u.supervisorId || undefined,
        modules: (u.modules as any) || getDefaultModulesForRole(u.role),
        photoURL: u.photoURL || null,
        profileImage: u.profileImage,
        currentRank: u.currentRank || 'bronce',
        monthlyPoints: typeof u.monthlyPoints === 'number' ? u.monthlyPoints : 0,
        rankSeason: u.rankSeason,
        history: [],
      })),
    });

    try {
      const rayonerState = useRayonerStore.getState();
      if (rayonerState.teamMembers && rayonerState.teamMembers.length > 0) {
        const updatedMembers = rayonerState.teamMembers.map((m) => {
          const match = usersList.find(
            (u) =>
              u.uid === m.id ||
              (u.email && m.email && u.email.toLowerCase() === m.email.toLowerCase())
          );
          if (match) {
            return {
              ...m,
              currentRank: match.currentRank || m.currentRank || 'bronce',
              monthlyPoints:
                match.monthlyPoints !== undefined ? match.monthlyPoints : m.monthlyPoints,
              rankSeason: match.rankSeason || m.rankSeason,
            };
          }
          return m;
        });
        useRayonerStore.setState({ teamMembers: updatedMembers });
      }
    } catch {
      // Ignore rayoner store sync errors in non-browser context
    }

    return usersList;
  } catch (err) {
    console.warn('[userService] Error al sincronizar usuarios desde Firestore:', err);
    return [];
  }
}
