import { collection, doc, getDocs, query, setDoc, where, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
} from './firestoreTelemetry';

export interface TaskDocument {
  id: string;
  title: string;
  companyId: string;
  projectId?: string;
  assignedTo: string;
  supervisorId: string;
  status: 'pending' | 'in_progress' | 'progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high';
  plannedMinutes: number; // Entero estricto, sin decimales
  loggedMinutes: number; // Entero estricto, sin decimales
  createdAt: string;
  updatedAt?: string;
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
 * Crea o actualiza una tarea en la colección `tasks` de Firestore
 * Garantiza tiempos almacenados estrictamente en minutos enteros sin decimales.
 */
export async function saveTaskToFirestore(
  task: Omit<TaskDocument, 'plannedMinutes' | 'loggedMinutes' | 'createdAt'> & {
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

  const payload: TaskDocument = {
    id: task.id,
    title: task.title.trim() || 'Tarea sin título',
    companyId: task.companyId || '',
    projectId: task.projectId || '',
    assignedTo: task.assignedTo || '',
    supervisorId: task.supervisorId || '',
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    plannedMinutes: computedPlannedMinutes,
    loggedMinutes: computedLoggedMinutes,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isFirebaseConfigured() || !db) {
    return { success: true, data: payload };
  }

  try {
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

  try {
    await setDoc(doc(db, 'tasks', taskId), cleanPatch, { merge: true });
    trackFirestoreWrite(1);
    return true;
  } catch (err) {
    console.warn('[taskService] Error al actualizar progreso de tarea:', err);
    return false;
  }
}

/**
 * Consulta las tareas asignadas a un colaborador específico en Firestore
 */
export async function fetchTasksByAssignee(userId: string): Promise<TaskDocument[]> {
  if (!isFirebaseConfigured() || !db || !userId) return [];

  try {
    const q = query(collection(db, 'tasks'), where('assignedTo', '==', userId));
    const snap = await getDocs(q);
    trackFirestoreRead(Math.max(1, snap.size));

    const results: TaskDocument[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      results.push({
        id: d.id || docSnap.id,
        title: String(d.title || d.name || 'Sin título'),
        companyId: String(d.companyId || ''),
        projectId: String(d.projectId || ''),
        assignedTo: String(d.assignedTo || d.assigned_to || ''),
        supervisorId: String(d.supervisorId || d.created_by || ''),
        status: d.status || 'pending',
        priority: d.priority || 'medium',
        plannedMinutes: toIntegerMinutes(
          d.plannedMinutes !== undefined ? d.plannedMinutes : (d.plannedHours || 0) * 60
        ),
        loggedMinutes: toIntegerMinutes(d.loggedMinutes || 0),
        createdAt: String(d.createdAt || d.created_at || new Date().toISOString()),
        updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
      });
    });
    return results;
  } catch (err) {
    console.warn('[taskService] Error al consultar tareas por colaborador:', err);
    return [];
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
