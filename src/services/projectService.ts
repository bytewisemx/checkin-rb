import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { normalizeRole, type LegacyOrCurrentRole } from './rbac';
import {
  registerActiveListener,
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
  unregisterActiveListener,
} from './firestoreTelemetry';
import { resolveUserIdentityKeys, type UserIdentityMatcher } from './taskService';
import type { Project } from '../types/rayoner';

export interface ProjectScopeIdentity extends UserIdentityMatcher {
  teamIds?: string[];
}

function normalizeStringArray(values?: Array<string | null | undefined>): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
    )
  );
}

function mapDocToProject(docId: string, d: Record<string, any>): Project {
  const plannedMin =
    typeof d.plannedMinutes === 'number'
      ? Math.round(d.plannedMinutes)
      : Math.round((Number(d.totalBudgetHours) || 0) * 60);

  const assignedToIds = normalizeStringArray([
    ...(Array.isArray(d.assignedToIds) ? d.assignedToIds : []),
    ...(Array.isArray(d.assignedUserIds) ? d.assignedUserIds : []),
  ]);

  const teamIds = normalizeStringArray([
    ...(Array.isArray(d.teamIds) ? d.teamIds : []),
    typeof d.teamId === 'string' ? d.teamId : '',
  ]);

  const supervisorId = String(d.supervisorId || d.leadUserId || '');

  return {
    id: d.id || docId,
    clientId: String(d.clientId || d.companyId || ''),
    name: String(d.name || 'Proyecto'),
    code: String(d.code || docId),
    leadUserId: String(d.leadUserId || supervisorId || 'demo_supervisor'),
    leadUserName: String(d.leadUserName || 'Supervisor'),
    gerenteId: d.gerenteId ? String(d.gerenteId) : undefined,
    supervisorId: supervisorId || undefined,
    teamId: teamIds[0] || undefined,
    teamIds,
    deadline: String(d.deadline || ''),
    budgetType: d.budgetType || 'fixed_project',
    totalBudgetHours: Number((plannedMin / 60).toFixed(4)),
    plannedMinutes: plannedMin,
    hourlyRate: Number(d.hourlyRate || 0),
    currency: String(d.currency || 'MXN'),
    notes: String(d.notes || ''),
    isActive: d.isActive !== false,
    assignedToIds,
    assignedUserIds: assignedToIds,
    assignedUserEmails: normalizeStringArray(
      Array.isArray(d.assignedUserEmails)
        ? d.assignedUserEmails.map((e: string) => String(e || '').toLowerCase())
        : []
    ),
  };
}

/**
 * Persiste un proyecto en la colección `projects` de Firestore
 * con soporte multi-equipo (`teamIds`, `gerenteId`, `supervisorId`)
 * y multi-usuario (`assignedToIds`, `assignedUserIds`, `assignedUserEmails`).
 */
export async function saveProjectToFirestore(
  project: Project & { createdBy?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseConfigured() || !db) return { success: true };

  const plannedMinutes =
    typeof project.plannedMinutes === 'number'
      ? Math.max(0, Math.round(project.plannedMinutes))
      : Math.max(0, Math.round((project.totalBudgetHours || 0) * 60));

  const unifiedAssignedIds = normalizeStringArray([
    ...(project.assignedToIds || []),
    ...(project.assignedUserIds || []),
  ]);

  const unifiedTeamIds = normalizeStringArray([
    ...(project.teamIds || []),
    project.teamId,
  ]);

  const supervisorId = (project.supervisorId || project.leadUserId || '').trim();
  const gerenteId = (project.gerenteId || '').trim();

  try {
    await setDoc(
      doc(db, 'projects', project.id),
      {
        id: project.id,
        clientId: project.clientId,
        companyId: project.clientId,
        name: project.name.trim(),
        code: project.code.trim().toUpperCase(),
        leadUserId: project.leadUserId || supervisorId,
        leadUserName: project.leadUserName,
        managerId: project.managerId || gerenteId || project.leadUserId,
        managerName: project.managerName || project.leadUserName,
        partnerId: project.partnerId || '',
        supervisorId,
        gerenteId: gerenteId || project.managerId || '',
        teamId: unifiedTeamIds[0] || '',
        teamIds: unifiedTeamIds,
        deadline: project.deadline,
        budgetType: project.budgetType || 'fixed_project',
        totalBudgetHours: Number((plannedMinutes / 60).toFixed(4)),
        plannedMinutes,
        hourlyRate: Number(project.hourlyRate || 0),
        currency: project.currency || 'MXN',
        notes: project.notes || '',
        isActive: project.isActive !== false,
        assignedToIds: unifiedAssignedIds,
        assignedUserIds: unifiedAssignedIds,
        assignedUserEmails: normalizeStringArray(
          (project.assignedUserEmails || []).map((e) => e.toLowerCase())
        ),
        createdBy: project.createdBy || 'system',
        updatedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return { success: true };
  } catch (err: any) {
    console.warn('[projectService] Error al guardar proyecto en Firestore:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Actualiza explícitamente el arreglo de colaboradores asignados (`assignedToIds`) a un proyecto.
 */
export async function assignUsersToProjectInFirestore(
  projectId: string,
  assignedToIds: string[],
  assignedUserEmails: string[] = []
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db || !projectId) return true;

  const cleanIds = normalizeStringArray(assignedToIds);
  const cleanEmails = normalizeStringArray(assignedUserEmails.map((e) => e.toLowerCase()));

  try {
    await setDoc(
      doc(db, 'projects', projectId),
      {
        assignedToIds: cleanIds,
        assignedUserIds: cleanIds,
        assignedUserEmails: cleanEmails,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return true;
  } catch (err) {
    console.warn('[projectService] Error al asignar usuarios al proyecto:', err);
    return false;
  }
}

export async function deleteProjectFromFirestore(projectId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return true;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
    trackFirestoreDelete(1);
    return true;
  } catch (err) {
    console.warn('[projectService] Error al eliminar proyecto en Firestore:', err);
    return false;
  }
}

/**
 * Suscripción en tiempo real a `projects` en Firestore respetando el aislamiento multi-equipo RBAC:
 * - RH: Bloqueo estricto (retorna no-op).
 * - TI / Socio: Visibilidad global.
 * - Gerente: Proyectos donde gerenteId coincide o que pertenecen a sus teamIds.
 * - Supervisor: Proyectos donde supervisorId/leadUserId coincide o que pertenecen a sus teamIds.
 * - Colaborador: Proyectos donde su uid/id está en assignedToIds/assignedUserIds o su correo en assignedUserEmails.
 */
export function subscribeProjectsFromFirestore(
  role: LegacyOrCurrentRole | null | undefined,
  onData: (projects: Project[]) => void,
  userIdentity?: ProjectScopeIdentity
): () => void {
  const normRole = normalizeRole(role ?? undefined);
  if (normRole === 'RH' || !isFirebaseConfigured() || !db) {
    return () => {};
  }

  // TI, Socio y Gerente: lectura global de todos los proyectos por defecto
  // Socio y Gerente no requieren asignación manual en ningún equipo para visualizar y supervisar
  if (normRole === 'TI' || normRole === 'Socio' || normRole === 'Gerente' || !userIdentity) {
    const listenerId = 'realtime-projects-global';
    registerActiveListener(listenerId, 'projects');

    const unsubscribe = onSnapshot(
      collection(db, 'projects'),
      (snap) => {
        trackFirestoreRead(Math.max(1, snap.size));
        const list: Project[] = [];
        snap.forEach((docSnap) => {
          list.push(mapDocToProject(docSnap.id, docSnap.data() as Record<string, any>));
        });
        onData(list);
      },
      (err) => {
        console.warn('[projectService] Error en suscripción global projects:', err);
      }
    );

    return () => {
      unsubscribe();
      unregisterActiveListener(listenerId);
    };
  }

  const { ids, email } = resolveUserIdentityKeys({
    ...userIdentity,
    uid: userIdentity.uid || auth?.currentUser?.uid || null,
  });
  const teamIds = normalizeStringArray(
    (userIdentity.teamIds && userIdentity.teamIds.length > 0)
      ? userIdentity.teamIds
      : ['team-prueba-01']
  );

  const candidateKeys = Array.from(
    new Set(
      [
        ...ids,
        email,
        auth?.currentUser?.uid,
        userIdentity.id,
      ]
        .map((v) => (v || '').trim())
        .filter(Boolean)
    )
  );

  const queryDefs: Array<{ key: string; q: ReturnType<typeof query> }> = [];

  if (normRole === 'Supervisor') {
    const supervisorKeys = Array.from(
      new Set([...candidateKeys, 'demo_supervisor'].filter(Boolean))
    );
    queryDefs.push({
      key: `supervisorId`,
      q: query(collection(db!, 'projects'), where('supervisorId', 'in', supervisorKeys.slice(0, 10))),
    });
    queryDefs.push({
      key: `leadUserId`,
      q: query(collection(db!, 'projects'), where('leadUserId', 'in', supervisorKeys.slice(0, 10))),
    });
    if (teamIds.length > 0) {
      queryDefs.push({
        key: `supervisorTeams`,
        q: query(
          collection(db!, 'projects'),
          where('teamIds', 'array-contains-any', teamIds.slice(0, 10))
        ),
      });
    }
  } else {
    // Colaborador: proyectos asignados directamente o por pertenencia a su equipo
    if (candidateKeys.length > 0) {
      queryDefs.push({
        key: `assignedToIds`,
        q: query(
          collection(db!, 'projects'),
          where('assignedToIds', 'array-contains-any', candidateKeys.slice(0, 10))
        ),
      });
      queryDefs.push({
        key: `assignedUserIds`,
        q: query(
          collection(db!, 'projects'),
          where('assignedUserIds', 'array-contains-any', candidateKeys.slice(0, 10))
        ),
      });
    }
    if (email) {
      queryDefs.push({
        key: `assignedUserEmails`,
        q: query(
          collection(db!, 'projects'),
          where('assignedUserEmails', 'array-contains', email.toLowerCase())
        ),
      });
    }
    if (teamIds.length > 0) {
      queryDefs.push({
        key: `colabTeams`,
        q: query(
          collection(db!, 'projects'),
          where('teamIds', 'array-contains-any', teamIds.slice(0, 10))
        ),
      });
    }
  }

  if (queryDefs.length === 0) {
    onData([]);
    return () => {};
  }

  const bucketByQuery = new Map<string, Map<string, Project>>();
  const unsubscribers: Array<() => void> = [];

  const emitMerged = () => {
    const merged = new Map<string, Project>();
    bucketByQuery.forEach((projMap) => {
      projMap.forEach((proj, id) => merged.set(id, proj));
    });
    const list = Array.from(merged.values());
    // Ordenamiento en memoria por nombre / fecha sin depender de índices compuestos de Firestore
    list.sort((a, b) => a.name.localeCompare(b.name));
    onData(list);
  };

  queryDefs.forEach(({ key, q }) => {
    const listenerId = `realtime-projects-${normRole.toLowerCase()}-${key}`;
    registerActiveListener(listenerId, 'projects');
    bucketByQuery.set(key, new Map());

    const unsub = onSnapshot(
      q,
      (snap) => {
        trackFirestoreRead(Math.max(1, snap.size));
        const nextMap = new Map<string, Project>();
        snap.forEach((docSnap) => {
          nextMap.set(
            docSnap.id,
            mapDocToProject(docSnap.id, docSnap.data() as Record<string, any>)
          );
        });
        bucketByQuery.set(key, nextMap);
        emitMerged();
      },
      (err) => {
        console.error(`[projectService] Error en snapshot de proyectos (${key}):`, err);
      }
    );

    unsubscribers.push(() => {
      unsub();
      unregisterActiveListener(listenerId);
    });
  });

  return () => {
    unsubscribers.forEach((fn) => fn());
  };
}
