import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { normalizeRole, type LegacyOrCurrentRole } from './rbac';
import {
  registerActiveListener,
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
  unregisterActiveListener,
} from './firestoreTelemetry';
import type { Project, TaskNode } from '../types/rayoner';

export interface CompanyDocument {
  id: string;
  name: string;
  code: string;
  taxId: string;
  contactName: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdByRole: string;
  createdAt?: any;
  updatedAt?: string;
}

/**
 * Validación RBAC estricta para crear / administrar empresas:
 * Exclusivo para Socio, Gerente y TI (RH y Colaborador bloqueados).
 */
export function canCreateOrManageCompanies(role?: LegacyOrCurrentRole | null): boolean {
  const norm = normalizeRole(role ?? undefined);
  return norm === 'Socio' || norm === 'Gerente' || norm === 'TI';
}

/**
 * Validación RBAC para leer empresas:
 * RH tiene bloqueo estricto (403).
 */
export function canReadCompanies(role?: LegacyOrCurrentRole | null): boolean {
  const norm = normalizeRole(role ?? undefined);
  return norm !== 'RH';
}

/**
 * Auto-sugiere una clave interna corporativa limpia a partir de la Razón Social.
 * Ej. "Corporativo Industrial del Centro S.A. de C.V." -> "CIC-2026-01"
 */
export function generateCompanyCodeSuggestion(name: string, sequence = 1): string {
  const stopWords = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'SA', 'CV', 'S', 'A', 'C', 'V', 'SC', 'SRL', 'RL']);
  const words = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toUpperCase()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.has(w));

  let prefix = '';
  if (words.length >= 3) {
    prefix = words.slice(0, 3).map((w) => w[0]).join('');
  } else if (words.length === 2) {
    prefix = (words[0].slice(0, 2) + words[1][0]).slice(0, 3);
  } else if (words.length === 1) {
    prefix = words[0].slice(0, 3);
  } else {
    prefix = 'EMP';
  }

  const year = new Date().getFullYear();
  const seq = String(Math.max(1, sequence)).padStart(2, '0');
  return `${prefix}-${year}-${seq}`;
}

/**
 * Crea o actualiza una empresa/cliente en la colección `companies` de Cloud Firestore.
 * Valida permisos RBAC (solo Socio, Gerente y TI) y usa serverTimestamp() en creación.
 */
export async function saveCompanyToFirestore(company: {
  id: string;
  name: string;
  code: string;
  taxId?: string;
  contactName?: string;
  status?: 'active' | 'inactive';
  createdBy: string;
  createdByRole: string;
  isUpdate?: boolean;
}): Promise<{ success: boolean; data?: CompanyDocument; error?: string }> {
  if (!canCreateOrManageCompanies(company.createdByRole)) {
    return {
      success: false,
      error: 'Acceso denegado (403): Solo Socio, Gerente y TI pueden registrar o modificar empresas.',
    };
  }

  const cleanName = (company.name || '').trim();
  if (!cleanName) {
    return {
      success: false,
      error: 'El nombre o razón social de la empresa es obligatorio.',
    };
  }

  const cleanCode =
    (company.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '') || generateCompanyCodeSuggestion(cleanName);

  const cleanTaxId = (company.taxId || '').trim().toUpperCase();
  const cleanContact = (company.contactName || '').trim();
  const nowIso = new Date().toISOString();

  const localResult: CompanyDocument = {
    id: company.id,
    name: cleanName,
    code: cleanCode,
    taxId: cleanTaxId,
    contactName: cleanContact,
    status: company.status === 'inactive' ? 'inactive' : 'active',
    createdBy: company.createdBy || 'demo_socio',
    createdByRole: normalizeRole(company.createdByRole),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (!isFirebaseConfigured() || !db) {
    return { success: true, data: localResult };
  }

  try {
    const firestorePayload: Record<string, any> = {
      id: localResult.id,
      name: localResult.name,
      code: localResult.code,
      taxId: localResult.taxId,
      contactName: localResult.contactName,
      status: localResult.status,
      createdBy: localResult.createdBy,
      createdByRole: localResult.createdByRole,
      updatedAt: nowIso,
    };

    if (!company.isUpdate) {
      firestorePayload.createdAt = serverTimestamp();
    }

    await setDoc(doc(db, 'companies', localResult.id), firestorePayload, { merge: true });
    trackFirestoreWrite(1);
    return { success: true, data: localResult };
  } catch (err: any) {
    console.warn('[companyService] Error al guardar empresa en Firestore:', err);
    return {
      success: false,
      error: err?.message || 'Error de permisos o red al guardar empresa en Firestore.',
    };
  }
}

/**
 * Obtiene el catálogo de empresas desde la colección `companies` de Firestore
 */
export async function fetchCompaniesFromFirestore(
  role?: LegacyOrCurrentRole | null
): Promise<CompanyDocument[]> {
  if (role && !canReadCompanies(role)) return [];
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const snap = await getDocs(collection(db, 'companies'));
    trackFirestoreRead(Math.max(1, snap.size));
    const list: CompanyDocument[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: d.id || docSnap.id,
        name: String(d.name || 'Sin nombre'),
        code: String(d.code || docSnap.id),
        taxId: String(d.taxId || ''),
        contactName: String(d.contactName || ''),
        status: d.status === 'inactive' ? 'inactive' : 'active',
        createdBy: String(d.createdBy || ''),
        createdByRole: String(d.createdByRole || ''),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
      });
    });
    return list;
  } catch (err) {
    console.warn('[companyService] Error al consultar empresas:', err);
    return [];
  }
}

/**
 * Suscripción en tiempo real (`onSnapshot`) a la colección `companies` en Cloud Firestore.
 * Bloqueado estrictamente para RH.
 */
export function subscribeCompaniesFromFirestore(
  role: LegacyOrCurrentRole | null | undefined,
  onData: (companies: CompanyDocument[]) => void
): () => void {
  if (!canReadCompanies(role) || !isFirebaseConfigured() || !db) {
    return () => {};
  }

  const listenerId = 'realtime-companies-catalog';
  registerActiveListener(listenerId, 'companies');

  const unsubscribe = onSnapshot(
    collection(db, 'companies'),
    (snap) => {
      trackFirestoreRead(Math.max(1, snap.size));
      const list: CompanyDocument[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: d.id || docSnap.id,
          name: String(d.name || 'Sin nombre'),
          code: String(d.code || docSnap.id),
          taxId: String(d.taxId || ''),
          contactName: String(d.contactName || ''),
          status: d.status === 'inactive' ? 'inactive' : 'active',
          createdBy: String(d.createdBy || ''),
          createdByRole: String(d.createdByRole || ''),
          createdAt: d.createdAt,
          updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
        });
      });
      onData(list);
    },
    (err) => {
      console.warn('[companyService] Error en suscripción real-time companies:', err);
    }
  );

  return () => {
    unsubscribe();
    unregisterActiveListener(listenerId);
  };
}

/**
 * Persiste un proyecto en la colección `projects` de Firestore con plannedMinutes en entero estricto.
 */
export async function saveProjectToFirestore(
  project: Project & { createdBy?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseConfigured() || !db) return { success: true };

  const plannedMinutes =
    typeof project.plannedMinutes === 'number'
      ? Math.max(0, Math.round(project.plannedMinutes))
      : Math.max(0, Math.round((project.totalBudgetHours || 0) * 60));

  try {
    await setDoc(
      doc(db, 'projects', project.id),
      {
        id: project.id,
        clientId: project.clientId,
        companyId: project.clientId,
        name: project.name.trim(),
        code: project.code.trim().toUpperCase(),
        leadUserId: project.leadUserId,
        supervisorId: project.leadUserId,
        leadUserName: project.leadUserName,
        deadline: project.deadline,
        budgetType: project.budgetType || 'fixed_project',
        totalBudgetHours: Number((plannedMinutes / 60).toFixed(4)),
        plannedMinutes,
        hourlyRate: Number(project.hourlyRate || 0),
        currency: project.currency || 'MXN',
        notes: project.notes || '',
        isActive: project.isActive !== false,
        assignedUserIds: Array.isArray(project.assignedUserIds) ? project.assignedUserIds : [],
        createdBy: project.createdBy || 'system',
        updatedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return { success: true };
  } catch (err: any) {
    console.warn('[companyService] Error al guardar proyecto en Firestore:', err);
    return { success: false, error: err?.message };
  }
}

export async function deleteProjectFromFirestore(projectId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return true;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
    trackFirestoreDelete(1);
    return true;
  } catch (err) {
    console.warn('[companyService] Error al eliminar proyecto en Firestore:', err);
    return false;
  }
}

/**
 * Suscripción en tiempo real a `projects` en Firestore (bloqueado para RH)
 */
export function subscribeProjectsFromFirestore(
  role: LegacyOrCurrentRole | null | undefined,
  onData: (projects: Project[]) => void
): () => void {
  if (!canReadCompanies(role) || !isFirebaseConfigured() || !db) {
    return () => {};
  }

  const listenerId = 'realtime-projects-catalog';
  registerActiveListener(listenerId, 'projects');

  const unsubscribe = onSnapshot(
    collection(db, 'projects'),
    (snap) => {
      trackFirestoreRead(Math.max(1, snap.size));
      const list: Project[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const plannedMin =
          typeof d.plannedMinutes === 'number'
            ? Math.round(d.plannedMinutes)
            : Math.round((Number(d.totalBudgetHours) || 0) * 60);
        list.push({
          id: d.id || docSnap.id,
          clientId: String(d.clientId || d.companyId || ''),
          name: String(d.name || 'Proyecto'),
          code: String(d.code || docSnap.id),
          leadUserId: String(d.leadUserId || d.supervisorId || 'demo_supervisor'),
          leadUserName: String(d.leadUserName || 'Supervisor Prueba'),
          deadline: String(d.deadline || ''),
          budgetType: d.budgetType || 'fixed_project',
          totalBudgetHours: Number((plannedMin / 60).toFixed(4)),
          plannedMinutes: plannedMin,
          hourlyRate: Number(d.hourlyRate || 0),
          currency: String(d.currency || 'MXN'),
          notes: String(d.notes || ''),
          isActive: d.isActive !== false,
          assignedUserIds: Array.isArray(d.assignedUserIds) ? d.assignedUserIds : [],
        });
      });
      onData(list);
    },
    (err) => {
      console.warn('[companyService] Error en suscripción real-time projects:', err);
    }
  );

  return () => {
    unsubscribe();
    unregisterActiveListener(listenerId);
  };
}

/**
 * Suscripción en tiempo real a `tasks` en Firestore (bloqueado para RH)
 */
export function subscribeTasksFromFirestore(
  role: LegacyOrCurrentRole | null | undefined,
  onData: (tasks: TaskNode[]) => void
): () => void {
  if (!canReadCompanies(role) || !isFirebaseConfigured() || !db) {
    return () => {};
  }

  const listenerId = 'realtime-tasks-catalog';
  registerActiveListener(listenerId, 'tasks');

  const unsubscribe = onSnapshot(
    collection(db, 'tasks'),
    (snap) => {
      trackFirestoreRead(Math.max(1, snap.size));
      const list: TaskNode[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const plannedMin =
          typeof d.plannedMinutes === 'number'
            ? Math.round(d.plannedMinutes)
            : Math.round((Number(d.plannedHours) || 0) * 60);
        const title = String(d.title || d.name || 'Tarea');
        list.push({
          id: d.id || docSnap.id,
          title,
          name: title,
          projectId: String(d.projectId || ''),
          assigned_to: String(d.assignedTo || d.assigned_to || ''),
          created_by: String(d.supervisorId || d.created_by || ''),
          status: d.status || 'pending',
          priority: d.priority || 'medium',
          plannedHours: Number((plannedMin / 60).toFixed(4)),
          isBillable: d.isBillable !== false,
          isActive: d.isActive !== false,
          description: d.description ? String(d.description) : undefined,
          created_at: d.createdAt ? String(d.createdAt) : undefined,
          completed_at: d.completedAt ? String(d.completedAt) : null,
          isExtraordinary: Boolean(d.isExtraordinary),
        });
      });
      onData(list);
    },
    (err) => {
      console.warn('[companyService] Error en suscripción real-time tasks:', err);
    }
  );

  return () => {
    unsubscribe();
    unregisterActiveListener(listenerId);
  };
}

/**
 * Elimina una empresa de la colección `companies`
 */
export async function deleteCompanyFromFirestore(companyId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return true;
  try {
    await deleteDoc(doc(db, 'companies', companyId));
    trackFirestoreDelete(1);
    return true;
  } catch (err) {
    console.warn('[companyService] Error al eliminar empresa:', err);
    return false;
  }
}
