import { collection, doc, getDoc, getDocs, query, setDoc, where, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured, loginWithEmail, registerWithEmail } from './firebase';
import { validateShiftTimeDistribution } from './attendanceService';
import { logSystemMovement } from './auditLogger';
import { useRayonerStore } from '../store/useRayonerStore';
import {
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
} from './firestoreTelemetry';
import type { TaskNode, TaskNote } from '../types/rayoner';

export interface TaskDocument {
  id: string;
  title: string;
  description?: string;
  companyId: string;
  companyName?: string;
  projectId?: string;
  projectName?: string;
  // Aislamiento multi-equipo y cadena de mando
  teamId?: string;
  teamIds?: string[];
  gerenteId?: string;
  // Identificadores unificados del colaborador asignado (multi-usuario `assignedToIds` y `assignedUserIds`)
  assignedTo: string;
  assignedToId: string;
  assignedToIds: string[];
  assignedUserIds?: string[];
  leadUserId?: string;
  leadUserName?: string;
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
  notes?: TaskNote[];
  isBillable?: boolean;
  isActive?: boolean;
  isExtraordinary?: boolean;
  extraordinaryCategory?: string;
  rubro?: string;
  rubroNumber?: number;
  cuentaContable?: string;
  procedimiento?: string;
  papelTrabajo?: string;
  fase?: string;
  perfilSugerido?: string;
  activityNumber?: number;
  budgetedHours?: number;
  unbudgetedHours?: number;
  reviewStatus?: string;
  hoursByUser?: Record<string, number>;
  totalActualHours?: number;
  comments?: string;
  isManuallyModified?: boolean;
  manualAdjustment?: {
    previousSeconds: number;
    adjustedSeconds: number;
    reason: string;
    modifiedByUid: string;
    modifiedByName: string;
    modifiedAt: string;
  };
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

  // Agregar el correo en minúsculas como identificador válido
  if (email) {
    idSet.add(email);
    if (DEMO_EMAIL_TO_ID[email]) {
      idSet.add(DEMO_EMAIL_TO_ID[email]);
    }
  }

  // Si el id es un demo ID, mapear a su correo correspondiente
  if (identity.id && DEMO_ID_TO_EMAIL[identity.id.trim()]) {
    idSet.add(DEMO_ID_TO_EMAIL[identity.id.trim()].toLowerCase());
  }

  return {
    ids: Array.from(idSet),
    email,
  };
}

/**
 * Normaliza y construye el arreglo universal de identificadores asignados (`assignedToIds`)
 * con UID real, ID de perfil, alias demo y correo en minúsculas para match garantizado.
 */
export function buildUniversalAssignedToIds(params: {
  id?: string;
  uid?: string;
  email?: string;
  assignedToId?: string;
  assignedToEmail?: string;
  assignedToIds?: string[];
}): string[] {
  const candidateSet = new Set<string>();
  const add = (v?: string | null) => {
    if (!v) return;
    const clean = String(v).trim();
    if (clean) candidateSet.add(clean);
  };

  add(params.id);
  add(params.uid);
  add(params.assignedToId);

  const cleanEmail = (params.assignedToEmail || params.email || '').trim().toLowerCase();
  if (cleanEmail) {
    add(cleanEmail);
    if (DEMO_EMAIL_TO_ID[cleanEmail]) {
      add(DEMO_EMAIL_TO_ID[cleanEmail]);
    }
  }

  const primeId = (params.assignedToId || params.id || '').trim();
  if (primeId && DEMO_ID_TO_EMAIL[primeId]) {
    add(DEMO_ID_TO_EMAIL[primeId].toLowerCase());
  }

  if (Array.isArray(params.assignedToIds)) {
    params.assignedToIds.forEach((item) => add(item));
  }

  return Array.from(candidateSet);
}

/**
 * Determina si una tarea pertenece al usuario dado, comparando de forma unificada
 * `assignedToIds` (array), `assignedToId`, `assigned_to`, `assignedTo` y `assignedToEmail`.
 */
export function doesTaskBelongToUser(
  task: Pick<TaskNode, 'id' | 'assigned_to' | 'assignedToId' | 'assignedToIds' | 'assignedToEmail'> & {
    assignedTo?: string;
  },
  identity: UserIdentityMatcher,
  assignedTaskIds?: Set<string>
): boolean {
  if (assignedTaskIds && assignedTaskIds.has(task.id)) return true;

  const { ids, email } = resolveUserIdentityKeys(identity);
  const taskIds = [
    ...(Array.isArray(task.assignedToIds) ? task.assignedToIds : []),
    ...(Array.isArray((task as any).assignedUserIds) ? (task as any).assignedUserIds : []),
    (task as any).leadUserId,
    task.assignedToId,
    task.assigned_to,
    task.assignedTo,
  ]
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
 * Agrega una nota o evidencia a la bitácora de una tarea en Firestore y la sincroniza en el estado local.
 */
export async function addTaskNoteInFirestore(
  taskId: string,
  note: Omit<TaskNote, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<TaskNote | null> {
  const noteId = note.id || `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nowIso = note.createdAt || new Date().toISOString();
  const newNote: TaskNote = {
    id: noteId,
    text: note.text.trim(),
    linkUrl: note.linkUrl?.trim() || undefined,
    authorId: note.authorId || '',
    authorName: note.authorName || 'Usuario',
    authorRole: note.authorRole || undefined,
    createdAt: nowIso,
  };

  if (!isFirebaseConfigured() || !db || !taskId) {
    return newNote;
  }

  try {
    const taskRef = doc(db, 'tasks', taskId);
    const snap = await getDoc(taskRef);
    const existingNotes: TaskNote[] =
      snap.exists() && Array.isArray(snap.data()?.notes) ? snap.data().notes : [];

    const updatedNotes = [newNote, ...existingNotes];
    await setDoc(
      taskRef,
      {
        notes: updatedNotes,
        updatedAt: nowIso,
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return newNote;
  } catch (err) {
    console.warn('[taskService] Error al agregar nota en Firestore:', err);
    return newNote;
  }
}
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
    'plannedMinutes' | 'loggedMinutes' | 'createdAt' | 'assignedToId' | 'assignedToIds' | 'assigned_to' | 'assignedToEmail'
  > & {
    assignedToId?: string;
    assignedToIds?: string[];
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
    (Array.isArray(task.assignedToIds) ? task.assignedToIds[0] : '') ||
    ''
  ).trim();

  const resolvedEmail = (
    task.assignedToEmail ||
    DEMO_ID_TO_EMAIL[unifiedAssignedId] ||
    ''
  )
    .trim()
    .toLowerCase();

  // Construcción garantizada de identificadores múltiples del Colaborador asignado
  const unifiedAssignedIds = buildUniversalAssignedToIds({
    id: unifiedAssignedId,
    assignedToId: unifiedAssignedId,
    assignedToEmail: resolvedEmail,
    email: resolvedEmail,
    uid: (task as any).assignedToUid || (task as any).uid,
    assignedToIds: task.assignedToIds,
  });

  const fallbackTeamId = 'team-prueba-01';
  const unifiedTeamIds = Array.from(
    new Set(
      [
        ...(Array.isArray(task.teamIds) ? task.teamIds : []),
        task.teamId || '',
        fallbackTeamId,
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );

  const payload: TaskDocument = {
    id: task.id,
    title: task.title.trim() || 'Tarea sin título',
    description: (task.description || '').trim(),
    companyId: (task.companyId || '').trim(),
    companyName: (task.companyName || '').trim(),
    projectId: (task.projectId || '').trim(),
    projectName: (task.projectName || '').trim(),
    teamId: unifiedTeamIds[0] || fallbackTeamId,
    teamIds: unifiedTeamIds,
    gerenteId: (task.gerenteId || '').trim(),
    supervisorId: (task.supervisorId || task.created_by || '').trim(),
    created_by: (task.created_by || task.supervisorId || '').trim(),
    assignedTo: unifiedAssignedId,
    assignedToId: unifiedAssignedId,
    assignedToIds: unifiedAssignedIds,
    assignedUserIds: Array.isArray(task.assignedUserIds) && task.assignedUserIds.length > 0 ? task.assignedUserIds : [unifiedAssignedId],
    leadUserId: task.leadUserId || unifiedAssignedId,
    leadUserName: (task.leadUserName || task.assignedToName || '').trim(),
    assigned_to: unifiedAssignedId,
    assignedToEmail: resolvedEmail,
    assignedToName: (task.assignedToName || '').trim(),
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
    rubro: (task as any).rubro,
    rubroNumber: (task as any).rubroNumber,
    cuentaContable: (task as any).cuentaContable,
    procedimiento: (task as any).procedimiento,
    papelTrabajo: (task as any).papelTrabajo,
    fase: (task as any).fase,
    perfilSugerido: (task as any).perfilSugerido,
    activityNumber: (task as any).activityNumber,
    budgetedHours: (task as any).budgetedHours,
    unbudgetedHours: (task as any).unbudgetedHours,
    reviewStatus: (task as any).reviewStatus,
    hoursByUser: (task as any).hoursByUser,
    totalActualHours: (task as any).totalActualHours,
    comments: (task as any).comments,
    isManuallyModified: Boolean((task as any).isManuallyModified),
    manualAdjustment: (task as any).manualAdjustment,
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
  const unifiedId = String(
    d.assignedToId ||
      d.assignedTo ||
      d.assigned_to ||
      (Array.isArray(d.assignedToIds) ? d.assignedToIds[0] : '') ||
      ''
  );
  const unifiedIds = Array.from(
    new Set(
      [
        ...(Array.isArray(d.assignedToIds) ? d.assignedToIds : []),
        unifiedId,
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );
  const teamIds = Array.from(
    new Set(
      [
        ...(Array.isArray(d.teamIds) ? d.teamIds : []),
        typeof d.teamId === 'string' ? d.teamId : '',
      ]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    )
  );

  return {
    id: d.id || docId,
    title: String(d.title || d.name || 'Sin título'),
    description: d.description ? String(d.description) : '',
    companyId: String(d.companyId || ''),
    companyName: d.companyName ? String(d.companyName) : '',
    projectId: String(d.projectId || ''),
    projectName: d.projectName ? String(d.projectName) : '',
    teamId: teamIds[0] || '',
    teamIds,
    gerenteId: d.gerenteId ? String(d.gerenteId) : '',
    assignedTo: unifiedId,
    assignedToId: unifiedId,
    assignedToIds: unifiedIds,
    assignedUserIds: Array.isArray(d.assignedUserIds) && d.assignedUserIds.length > 0 ? d.assignedUserIds : unifiedIds,
    leadUserId: d.leadUserId ? String(d.leadUserId) : unifiedId,
    leadUserName: d.leadUserName ? String(d.leadUserName) : String(d.assignedToName || ''),
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
    notes: Array.isArray(d.notes)
      ? d.notes
          .filter((n: any) => n && typeof n.text === 'string' && n.text.trim())
          .map((n: any) => ({
            id: String(n.id || `note-${Date.now()}`),
            text: String(n.text).trim(),
            linkUrl: n.linkUrl ? String(n.linkUrl).trim() : undefined,
            authorId: String(n.authorId || ''),
            authorName: String(n.authorName || 'Usuario'),
            authorRole: n.authorRole ? String(n.authorRole) : undefined,
            createdAt: String(n.createdAt || new Date().toISOString()),
          }))
      : [],
    isBillable: d.isBillable !== false,
    isActive: d.isActive !== false,
    isExtraordinary: Boolean(d.isExtraordinary),
    extraordinaryCategory: d.extraordinaryCategory ? String(d.extraordinaryCategory) : '',
    createdAt: String(d.createdAt || d.created_at || new Date().toISOString()),
    updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
    rubro: d.rubro ? String(d.rubro) : undefined,
    rubroNumber: typeof d.rubroNumber === 'number' ? d.rubroNumber : undefined,
    cuentaContable: d.cuentaContable ? String(d.cuentaContable) : undefined,
    procedimiento: d.procedimiento ? String(d.procedimiento) : undefined,
    papelTrabajo: d.papelTrabajo ? String(d.papelTrabajo) : undefined,
    fase: d.fase ? String(d.fase) : undefined,
    perfilSugerido: d.perfilSugerido ? String(d.perfilSugerido) : undefined,
    activityNumber: typeof d.activityNumber === 'number' ? d.activityNumber : undefined,
    budgetedHours: typeof d.budgetedHours === 'number' ? d.budgetedHours : undefined,
    unbudgetedHours: typeof d.unbudgetedHours === 'number' ? d.unbudgetedHours : undefined,
    reviewStatus: d.reviewStatus ? String(d.reviewStatus) : undefined,
    hoursByUser: typeof d.hoursByUser === 'object' && d.hoursByUser !== null ? d.hoursByUser : undefined,
    totalActualHours: typeof d.totalActualHours === 'number' ? d.totalActualHours : undefined,
    comments: d.comments ? String(d.comments) : undefined,
    isManuallyModified: Boolean(d.isManuallyModified),
    manualAdjustment: typeof d.manualAdjustment === 'object' && d.manualAdjustment !== null ? d.manualAdjustment : undefined,
  };
}

/**
 * Consulta las tareas asignadas a un colaborador específico en Firestore
 * buscando por `assignedToIds` (array-contains), `assignedToId`, `assignedTo` y `assignedToEmail`.
 */
export async function fetchTasksByAssignee(
  userId: string,
  userEmail?: string
): Promise<TaskDocument[]> {
  if (!isFirebaseConfigured() || !db || (!userId && !userEmail)) return [];

  const { ids, email } = resolveUserIdentityKeys({ id: userId, email: userEmail });
  const merged = new Map<string, TaskDocument>();

  const queries = [
    ...ids.map((idVal) => query(collection(db!, 'tasks'), where('assignedToIds', 'array-contains', idVal))),
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
 * Asegura sesión Firebase Auth activa (incluyendo cuentas demo) e incluye metadatos del asignado
 * para evitar rechazos de permisos si una tarea extraordinaria aún se está creando.
 */
export async function commitShiftTaskAllocationsToFirestore(
  allocations: Array<{
    taskId: string;
    minutes: number;
    cumulativeMinutes?: number;
    title?: string;
    isExtraordinary?: boolean;
    companyId?: string;
    companyName?: string;
    projectId?: string;
    projectName?: string;
  }>,
  totalShiftMinutes: number,
  actorIdentity?: { id?: string; email?: string; name?: string }
): Promise<{ success: boolean; error?: string; isNetworkOrPermission?: boolean }> {
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
    // Asegurar sesión Firebase Auth sincronizada cuando se opera con cuenta demo
    const actorId = (actorIdentity?.id || '').trim();
    const expectedDemoEmail =
      (actorIdentity?.email || '').trim().toLowerCase() || DEMO_ID_TO_EMAIL[actorId] || '';
    if (
      expectedDemoEmail &&
      DEMO_EMAIL_TO_ID[expectedDemoEmail] &&
      auth &&
      (auth.currentUser?.email || '').toLowerCase() !== expectedDemoEmail
    ) {
      try {
        let authRes = await loginWithEmail(expectedDemoEmail, 'admin123');
        if (!authRes.success) {
          await registerWithEmail(expectedDemoEmail, 'admin123');
        }
      } catch {
        // Continuar con la sesión de auth actual
      }
    }

    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    validEntries.forEach((entry) => {
      const targetMins =
        entry.cumulativeMinutes !== undefined
          ? toIntegerMinutes(entry.cumulativeMinutes)
          : toIntegerMinutes(entry.minutes);

      const totalHours = Number((targetMins / 60).toFixed(2));
      const patchPayload: Record<string, any> = {
        loggedMinutes: targetMins,
        totalActualHours: totalHours,
        updatedAt: nowIso,
      };
      if (actorId) {
        patchPayload[`hoursByUser.${actorId}`] = totalHours;
      }

      // Si es extraordinaria, incluir metadatos de creación
      if (entry.isExtraordinary) {
        patchPayload.isExtraordinary = true;
        if (entry.title) patchPayload.title = entry.title;
        if (actorId) {
          patchPayload.assignedTo = actorId;
          patchPayload.assignedToId = actorId;
          patchPayload.assignedToIds = [actorId];
          patchPayload.assigned_to = actorId;
        }
        if (expectedDemoEmail) patchPayload.assignedToEmail = expectedDemoEmail;
        if (actorIdentity?.name) patchPayload.assignedToName = actorIdentity.name;
      }

      batch.set(doc(db!, 'tasks', entry.taskId), patchPayload, { merge: true });
    });

    try {
      await batch.commit();
      trackFirestoreWrite(validEntries.length);
      return { success: true };
    } catch (batchErr: any) {
      console.warn('[taskService] Error en batch.commit, intentando escrituras individuales resilientes:', batchErr);
      let anySingleSucceeded = false;
      for (const entry of validEntries) {
        try {
          const targetMins =
            entry.cumulativeMinutes !== undefined
              ? toIntegerMinutes(entry.cumulativeMinutes)
              : toIntegerMinutes(entry.minutes);

          const totalHours = Number((targetMins / 60).toFixed(2));
          const singlePayload: Record<string, any> = {
            loggedMinutes: targetMins,
            totalActualHours: totalHours,
            updatedAt: new Date().toISOString(),
          };
          if (actorId) {
            singlePayload[`hoursByUser.${actorId}`] = totalHours;
          }
          if (entry.title) singlePayload.title = entry.title;
          if (actorId) {
            singlePayload.assignedTo = actorId;
            singlePayload.assignedToId = actorId;
          }
          if (expectedDemoEmail) singlePayload.assignedToEmail = expectedDemoEmail;

          await setDoc(doc(db!, 'tasks', entry.taskId), singlePayload, { merge: true });
          anySingleSucceeded = true;
          trackFirestoreWrite(1);
        } catch (singleErr) {
          console.warn(`[taskService] Tarea ${entry.taskId} no pudo actualizarse en remoto:`, singleErr);
        }
      }

      if (anySingleSucceeded) {
        return { success: true };
      }

      return {
        success: false,
        error: batchErr?.message || 'Error al guardar tiempos de tareas en Firestore.',
        isNetworkOrPermission: true,
      };
    }
  } catch (err: any) {
    console.warn('[taskService] Error en commitShiftTaskAllocationsToFirestore:', err);
    return {
      success: false,
      error: err?.message || 'Error al guardar tiempos de tareas en Firestore.',
      isNetworkOrPermission: true,
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

export interface ManualTimeAdjustmentPayload {
  previousSeconds: number;
  adjustedSeconds: number;
  reason: string;
  modifiedByUid: string;
  modifiedByName: string;
  modifiedAt: string;
}

/**
 * Ajusta manualmente el tiempo invertido en una tarea con trazabilidad obligatoria
 * y registra la auditoría en tasks/{taskId} y en la colección time_adjustments_log.
 */
export async function adjustTaskTimeInFirestore(
  taskId: string,
  taskCurrentMinutes: number,
  adjustedMinutes: number,
  reason: string,
  actor: { id: string; name?: string; email?: string },
  taskMeta?: { title?: string; projectId?: string; projectName?: string; companyId?: string; companyName?: string }
): Promise<{ success: boolean; adjustment?: ManualTimeAdjustmentPayload; error?: string }> {
  const previousSeconds = Math.max(0, Math.round(taskCurrentMinutes * 60));
  const adjustedSeconds = Math.max(0, Math.round(adjustedMinutes * 60));
  const nowIso = new Date().toISOString();
  const modifiedByUid = actor.id || 'desconocido';
  const modifiedByName = actor.name || actor.email || 'Usuario';

  const adjustment: ManualTimeAdjustmentPayload = {
    previousSeconds,
    adjustedSeconds,
    reason: reason.trim(),
    modifiedByUid,
    modifiedByName,
    modifiedAt: nowIso,
  };

  const totalActualHours = Number((adjustedMinutes / 60).toFixed(2));

  const patch: Record<string, any> = {
    loggedMinutes: adjustedMinutes,
    totalActualHours,
    isManuallyModified: true,
    manualAdjustment: adjustment,
    updatedAt: nowIso,
  };

  if (modifiedByUid) {
    patch[`hoursByUser.${modifiedByUid}`] = totalActualHours;
  }

  if (!isFirebaseConfigured() || !db) {
    return { success: true, adjustment };
  }

  try {
    // 1. Actualizar la tarea en Firestore
    await setDoc(doc(db, 'tasks', taskId), patch, { merge: true });
    trackFirestoreWrite(1);

    // 2. Registrar en la bitácora de auditoría histórica de ajustes de tiempo
    const logId = `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const auditRecord = {
      id: logId,
      taskId,
      taskTitle: taskMeta?.title || '',
      projectId: taskMeta?.projectId || '',
      projectName: taskMeta?.projectName || '',
      companyId: taskMeta?.companyId || '',
      companyName: taskMeta?.companyName || '',
      modifiedByUid,
      modifiedByName,
      previousMinutes: taskCurrentMinutes,
      adjustedMinutes,
      differenceMinutes: adjustedMinutes - taskCurrentMinutes,
      reason: reason.trim(),
      timestamp: nowIso,
    };

    void setDoc(doc(db, 'time_adjustments_log', logId), auditRecord).catch((err) => {
      console.warn('[taskService] No se pudo guardar en time_adjustments_log:', err);
    });

    return { success: true, adjustment };
  } catch (err: any) {
    console.warn('[taskService] Error al ajustar tiempo manualmente en Firestore:', err);
    return { success: false, error: err?.message || 'Error de permisos o red al actualizar tiempo.' };
  }
}

export interface FinalizeTaskReviewParams {
  taskId: string;
  projectId?: string;
  taskTitle?: string;
  projectName?: string;
  companyName?: string;
  reviewer: {
    uid: string;
    name: string;
    role: string;
  };
  reviewNotes?: string;
}

/**
 * Finaliza la revisión de una tarea por un Supervisor o Gerente:
 * - Actualiza status = 'completed', reviewStatus = 'lead_reviewed', progress = 100
 * - Detiene cronómetro activo en esa tarea
 * - Registra reviewedBy y reviewNotes
 * - Registra en audit_logs (TASK_REVIEW_FINALIZED)
 */
export async function finalizeTaskReviewInFirestore(
  params: FinalizeTaskReviewParams
): Promise<{ success: boolean; error?: string }> {
  const nowIso = new Date().toISOString();

  // 1. Detener cronómetros activos para esta tarea
  try {
    const rayonerState = useRayonerStore.getState();
    const active = rayonerState.activeWorkers.find((w) => w.taskId === params.taskId);
    if (active && active.userId) {
      rayonerState.stopWorkerTimer(active.userId);
    }
  } catch (timerErr) {
    console.warn('[taskService] Error al detener cronómetro activo:', timerErr);
  }

  const reviewedByObj = {
    uid: params.reviewer.uid,
    name: params.reviewer.name,
    role: params.reviewer.role.toLowerCase(),
  };

  const patch: Record<string, any> = {
    status: 'completed',
    reviewStatus: 'lead_reviewed',
    progress: 100,
    reviewedBy: reviewedByObj,
    reviewedAt: nowIso,
    reviewNotes: params.reviewNotes ? params.reviewNotes.trim() : '',
    updatedAt: nowIso,
  };

  // 2. Actualizar estado local en useRayonerStore
  try {
    useRayonerStore.getState().updateTask(params.taskId, {
      status: 'completed',
      progress: 100,
      reviewStatus: 'lead_reviewed',
      reviewedBy: reviewedByObj,
      reviewedAt: nowIso,
      reviewNotes: params.reviewNotes ? params.reviewNotes.trim() : '',
    } as any);
  } catch (stErr) {
    console.warn('[taskService] Error al actualizar Zustand task:', stErr);
  }

  // 3. Persistir en Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(
        doc(db, 'tasks', params.taskId),
        {
          ...patch,
          reviewedAt: serverTimestamp(),
        },
        { merge: true }
      );
      trackFirestoreWrite(1);

      // Si tiene proyecto padre, recalcular progreso
      if (params.projectId) {
        try {
          const tasksOfProject = useRayonerStore
            .getState()
            .tasks.filter((t) => t.projectId === params.projectId);
          const totalTasks = tasksOfProject.length;
          const completedTasks = tasksOfProject.filter(
            (t) => t.id === params.taskId || t.status === 'completed'
          ).length;
          const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
          await setDoc(
            doc(db, 'projects', params.projectId),
            {
              progress: progressPercent,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          trackFirestoreWrite(1);
        } catch (_) {}
      }
    } catch (dbErr: any) {
      console.error('[taskService] Error al persistir revisión de tarea en Firestore:', dbErr);
      return { success: false, error: dbErr?.message || 'Error al persistir en Firestore' };
    }
  }

  // 4. Registrar en audit_logs
  await logSystemMovement({
    eventType: 'TASK_REVIEW_FINALIZED',
    actorId: params.reviewer.uid,
    actorName: params.reviewer.name,
    actorEmail: '',
    actorRole: params.reviewer.role,
    targetResource: `Tarea: ${params.taskTitle || params.taskId}`,
    details: `Revisión finalizada y aprobada por ${params.reviewer.name} (${params.reviewer.role}). Estado completado al 100%. Observación: ${params.reviewNotes || 'Sin observaciones adicionales'}.`,
    metadata: {
      taskId: params.taskId,
      projectId: params.projectId,
      reviewNotes: params.reviewNotes,
    },
  });

  return { success: true };
}
