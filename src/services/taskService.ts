import { collection, doc, getDocs, query, setDoc, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, loginWithEmail, registerWithEmail } from './firebase';
import { validateShiftTimeDistribution } from './attendanceService';
import {
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
} from './firestoreTelemetry';
import type { TaskNode } from '../types/rayoner';

export interface TaskDocument {
  id: string;
  title: string;
  description?: string;
  companyId: string;
  companyName?: string;
  projectId?: string;
  projectName?: string;
  // Identificadores unificados del colaborador asignado
  assignedTo: string;
  assignedToId: string;
  assigned_to: string;
  assignedToEmail: string;
  assignedToName?: string;
  supervisorId: string;
  created_by?: string;
  status: 'pending' | 'in_progress' | 'progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  plannedMinutes: number; // Entero estricto, sin decimales
  loggedMinutes: number; // Entero estricto, sin decimales
  dueDate?: string;
  locationMode?: 'office' | 'client_site';
  locationAddress?: string;
  locationRadiusMeters?: number;
  isBillable?: boolean;
  isActive?: boolean;
  isExtraordinary?: boolean;
  extraordinaryCategory?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserIdentityMatcher {
  id?: string | null;
  uid?: string | null;
  memberId?: string | null;
  email?: string | null;
}

const DEMO_EMAIL_TO_ID: Record<string, string> = {
  'ti.root@russellbedford.mx': 'demo_ti',
  'socio.prueba@russellbedford.mx': 'demo_socio',
  'gerente.prueba@russellbedford.mx': 'demo_gerente',
  'rh.prueba@russellbedford.mx': 'demo_rh',
  'supervisor.prueba@russellbedford.mx': 'demo_supervisor',
  'colaborador.prueba@russellbedford.mx': 'demo_colaborador',
};

const DEMO_ID_TO_EMAIL: Record<string, string> = {
  demo_ti: 'ti.root@russellbedford.mx',
  demo_socio: 'socio.prueba@russellbedford.mx',
  demo_gerente: 'gerente.prueba@russellbedford.mx',
  demo_rh: 'rh.prueba@russellbedford.mx',
  demo_supervisor: 'supervisor.prueba@russellbedford.mx',
  demo_colaborador: 'colaborador.prueba@russellbedford.mx',
};

/**
 * Resuelve todos los identificadores válidos (id de perfil, uid Firebase, id demo y correo en minúsculas)
 * asociados a un usuario para asegurar sincronización exacta entre Firestore y el cliente.
 */
export function resolveUserIdentityKeys(identity: UserIdentityMatcher): {
  ids: string[];
  email: string;
} {
  const email = (identity.email || '').trim().toLowerCase();
  const idSet = new Set<string>();

  if (identity.id && identity.id.trim()) idSet.add(identity.id.trim());
  if (identity.uid && identity.uid.trim()) idSet.add(identity.uid.trim());
  if (identity.memberId && identity.memberId.trim()) idSet.add(identity.memberId.trim());

  if (email && DEMO_EMAIL_TO_ID[email]) {
    idSet.add(DEMO_EMAIL_TO_ID[email]);
  }

  return {
    ids: Array.from(idSet),
    email,
  };
}

/**
 * Determina si una tarea pertenece al usuario dado, comparando de forma unificada
 * `assignedToId`, `assigned_to`, `assignedTo` y `assignedToEmail`.
 */
export function doesTaskBelongToUser(
  task: Pick<TaskNode, 'id' | 'assigned_to' | 'assignedToId' | 'assignedToEmail'> & {
    assignedTo?: string;
  },
  identity: UserIdentityMatcher,
  assignedTaskIds?: Set<string>
): boolean {
  if (assignedTaskIds && assignedTaskIds.has(task.id)) return true;

  const { ids, email } = resolveUserIdentityKeys(identity);
  const taskIds = [task.assignedToId, task.assigned_to, task.assignedTo]
    .map((v) => (v || '').trim())
    .filter(Boolean);

  if (ids.some((candidate) => taskIds.includes(candidate))) {
    return true;
  }

  const taskEmail = (task.assignedToEmail || '').trim().toLowerCase();
  if (email && taskEmail && taskEmail === email) {
    return true;
  }

  // Respaldo para tareas antiguas que solo guardaron ID demo sin assignedToEmail
  if (email && DEMO_EMAIL_TO_ID[email]) {
    const demoId = DEMO_EMAIL_TO_ID[email];
    if (taskIds.includes(demoId)) return true;
  }

  return false;
}

/**
 * Normaliza cualquier valor numérico (horas o minutos) a un entero no negativo
 */
export function toIntegerMinutes(value: number | undefined | null): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

/**
 * Crea o actualiza una tarea en la colección `tasks` de Firestore.
 * Guarda identificadores unificados (`assignedToId`, `assignedTo`, `assigned_to`, `assignedToEmail`),
 * vínculo a empresa/proyecto y tiempos almacenados estrictamente en minutos enteros sin decimales.
 */
export async function saveTaskToFirestore(
  task: Omit<
    TaskDocument,
    'plannedMinutes' | 'loggedMinutes' | 'createdAt' | 'assignedToId' | 'assigned_to' | 'assignedToEmail'
  > & {
    assignedToId?: string;
    assigned_to?: string;
    assignedToEmail?: string;
    plannedMinutes?: number;
    loggedMinutes?: number;
    plannedHours?: number;
    createdAt?: string;
  }
): Promise<{ success: boolean; data?: TaskDocument; error?: string }> {
  const computedPlannedMinutes =
    task.plannedMinutes !== undefined
      ? toIntegerMinutes(task.plannedMinutes)
      : toIntegerMinutes((task.plannedHours || 0) * 60);

  const computedLoggedMinutes = toIntegerMinutes(task.loggedMinutes || 0);

  const unifiedAssignedId = (
    task.assignedToId ||
    task.assignedTo ||
    task.assigned_to ||
    ''
  ).trim();

  const resolvedEmail = (
    task.assignedToEmail ||
    DEMO_ID_TO_EMAIL[unifiedAssignedId] ||
    ''
  )
    .trim()
    .toLowerCase();

  const payload: TaskDocument = {
    id: task.id,
    title: task.title.trim() || 'Tarea sin título',
    description: (task.description || '').trim(),
    companyId: (task.companyId || '').trim(),
    companyName: (task.companyName || '').trim(),
    projectId: (task.projectId || '').trim(),
    projectName: (task.projectName || '').trim(),
    assignedTo: unifiedAssignedId,
    assignedToId: unifiedAssignedId,
    assigned_to: unifiedAssignedId,
    assignedToEmail: resolvedEmail,
    assignedToName: (task.assignedToName || '').trim(),
    supervisorId: (task.supervisorId || task.created_by || '').trim(),
    created_by: (task.created_by || task.supervisorId || '').trim(),
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    plannedMinutes: computedPlannedMinutes,
    loggedMinutes: computedLoggedMinutes,
    dueDate: (task.dueDate || '').trim(),
    locationMode: task.locationMode || 'office',
    locationAddress: (task.locationAddress || '').trim(),
    locationRadiusMeters:
      typeof task.locationRadiusMeters === 'number' && task.locationRadiusMeters > 0
        ? Math.round(task.locationRadiusMeters)
        : 150,
    isBillable: task.isBillable !== false,
    isActive: task.isActive !== false,
    isExtraordinary: Boolean(task.isExtraordinary),
    extraordinaryCategory: (task.extraordinaryCategory || '').trim(),
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isFirebaseConfigured() || !db) {
    return { success: true, data: payload };
  }

  try {
    // Asegurar sesión Firebase Auth sincronizada cuando se opera con una cuenta demo
    const actorId = payload.supervisorId || payload.assignedToId;
    const expectedDemoEmail = DEMO_ID_TO_EMAIL[actorId];
    if (
      expectedDemoEmail &&
      auth &&
      (auth.currentUser?.email || '').toLowerCase() !== expectedDemoEmail
    ) {
      let authRes = await loginWithEmail(expectedDemoEmail, 'admin123');
      if (!authRes.success) {
        authRes = await registerWithEmail(expectedDemoEmail, 'admin123');
      }
    }

    await setDoc(doc(db, 'tasks', payload.id), payload, { merge: true });
    trackFirestoreWrite(1);
    return { success: true, data: payload };
  } catch (err: any) {
    console.warn('[taskService] Error al guardar tarea en Firestore:', err);
    return {
      success: false,
      error: err?.message || 'Error de permisos o red al guardar tarea.',
    };
  }
}

/**
 * Actualiza los minutos registrados (enteros) y/o estado de una tarea en Firestore
 */
export async function updateTaskProgressInFirestore(
  taskId: string,
  patch: {
    loggedMinutes?: number;
    status?: TaskDocument['status'];
    plannedMinutes?: number;
    completedAt?: string | null;
  }
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return true;

  const cleanPatch: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (patch.loggedMinutes !== undefined) {
    cleanPatch.loggedMinutes = toIntegerMinutes(patch.loggedMinutes);
  }
  if (patch.plannedMinutes !== undefined) {
    cleanPatch.plannedMinutes = toIntegerMinutes(patch.plannedMinutes);
  }
  if (patch.status !== undefined) {
    cleanPatch.status = patch.status;
  }
  if (patch.completedAt !== undefined) {
    cleanPatch.completedAt = patch.completedAt;
  }

  try {
    await setDoc(doc(db, 'tasks', taskId), cleanPatch, { merge: true });
    trackFirestoreWrite(1);
    return true;
  } catch (err) {
    console.warn('[taskService] Error al actualizar progreso de tarea:', err);
    return false;
  }
}

function mapRawDocToTaskDocument(docId: string, d: Record<string, any>): TaskDocument {
  const unifiedId = String(d.assignedToId || d.assignedTo || d.assigned_to || '');
  return {
    id: d.id || docId,
    title: String(d.title || d.name || 'Sin título'),
    description: d.description ? String(d.description) : '',
    companyId: String(d.companyId || ''),
    companyName: d.companyName ? String(d.companyName) : '',
    projectId: String(d.projectId || ''),
    projectName: d.projectName ? String(d.projectName) : '',
    assignedTo: unifiedId,
    assignedToId: unifiedId,
    assigned_to: unifiedId,
    assignedToEmail: String(d.assignedToEmail || DEMO_ID_TO_EMAIL[unifiedId] || '').toLowerCase(),
    assignedToName: d.assignedToName ? String(d.assignedToName) : '',
    supervisorId: String(d.supervisorId || d.created_by || ''),
    created_by: String(d.created_by || d.supervisorId || ''),
    status: d.status || 'pending',
    priority: d.priority || 'medium',
    plannedMinutes: toIntegerMinutes(
      d.plannedMinutes !== undefined ? d.plannedMinutes : (d.plannedHours || 0) * 60
    ),
    loggedMinutes: toIntegerMinutes(d.loggedMinutes || 0),
    dueDate: d.dueDate ? String(d.dueDate) : '',
    locationMode: d.locationMode === 'client_site' ? 'client_site' : 'office',
    locationAddress: d.locationAddress ? String(d.locationAddress) : '',
    locationRadiusMeters:
      typeof d.locationRadiusMeters === 'number' ? Math.round(d.locationRadiusMeters) : 150,
    isBillable: d.isBillable !== false,
    isActive: d.isActive !== false,
    isExtraordinary: Boolean(d.isExtraordinary),
    extraordinaryCategory: d.extraordinaryCategory ? String(d.extraordinaryCategory) : '',
    createdAt: String(d.createdAt || d.created_at || new Date().toISOString()),
    updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
  };
}

/**
 * Consulta las tareas asignadas a un colaborador específico en Firestore
 * buscando por ID unificado (`assignedToId` / `assignedTo`) y por correo (`assignedToEmail`).
 */
export async function fetchTasksByAssignee(
  userId: string,
  userEmail?: string
): Promise<TaskDocument[]> {
  if (!isFirebaseConfigured() || !db || (!userId && !userEmail)) return [];

  const { ids, email } = resolveUserIdentityKeys({ id: userId, email: userEmail });
  const merged = new Map<string, TaskDocument>();

  const queries = [
    ...ids.map((idVal) => query(collection(db!, 'tasks'), where('assignedToId', '==', idVal))),
    ...ids.map((idVal) => query(collection(db!, 'tasks'), where('assignedTo', '==', idVal))),
    ...(email ? [query(collection(db!, 'tasks'), where('assignedToEmail', '==', email))] : []),
  ];

  await Promise.all(
    queries.map(async (qRef) => {
      try {
        const snap = await getDocs(qRef);
        trackFirestoreRead(Math.max(1, snap.size));
        snap.forEach((docSnap) => {
          merged.set(docSnap.id, mapRawDocToTaskDocument(docSnap.id, docSnap.data()));
        });
      } catch (err) {
        console.warn('[taskService] Sub-consulta de tareas omitida por permisos/índice:', err);
      }
    })
  );

  return Array.from(merged.values());
}

/**
 * Guarda de forma atómica (writeBatch) los minutos enteros asignados a tareas en una jornada.
 * Rechaza con error controlado antes de batch.commit() si assignedMinutes > totalShiftMinutes.
 */
export async function commitShiftTaskAllocationsToFirestore(
  allocations: Array<{ taskId: string; minutes: number; cumulativeMinutes?: number }>,
  totalShiftMinutes: number
): Promise<{ success: boolean; error?: string }> {
  const check = validateShiftTimeDistribution(allocations, totalShiftMinutes);
  if (!check.valid) {
    return {
      success: false,
      error: check.error || 'La suma de tiempos asignados excede la duración de la jornada.',
    };
  }

  const validEntries = allocations.filter((a) => toIntegerMinutes(a.minutes) > 0);
  if (validEntries.length === 0) {
    return { success: true };
  }

  if (!isFirebaseConfigured() || !db) {
    return { success: true };
  }

  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    validEntries.forEach((entry) => {
      const targetMins =
        entry.cumulativeMinutes !== undefined
          ? toIntegerMinutes(entry.cumulativeMinutes)
          : toIntegerMinutes(entry.minutes);

      batch.set(
        doc(db!, 'tasks', entry.taskId),
        {
          loggedMinutes: targetMins,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    });

    await batch.commit();
    trackFirestoreWrite(validEntries.length);
    return { success: true };
  } catch (err: any) {
    console.warn('[taskService] Error en commitShiftTaskAllocationsToFirestore:', err);
    return {
      success: false,
      error: err?.message || 'Error al guardar tiempos de tareas en Firestore.',
    };
  }
}

/**
 * Elimina una tarea en Firestore
 */
export async function deleteTaskFromFirestore(taskId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return true;
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
    trackFirestoreDelete(1);
    return true;
  } catch (err) {
    console.warn('[taskService] Error al eliminar tarea:', err);
    return false;
  }
}
