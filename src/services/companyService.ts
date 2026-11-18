import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  deleteDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, isFirebaseConfigured, loginWithEmail, registerWithEmail } from './firebase';
import { normalizeRole, type LegacyOrCurrentRole } from './rbac';
import { resolveUserIdentityKeys, type UserIdentityMatcher } from './taskService';
export {
  saveProjectToFirestore,
  deleteProjectFromFirestore,
  subscribeProjectsFromFirestore,
  assignUsersToProjectInFirestore,
  type ProjectScopeIdentity,
} from './projectService';
import {
  registerActiveListener,
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
  unregisterActiveListener,
} from './firestoreTelemetry';
import type { TaskNode } from '../types/rayoner';

export interface CompanyDocument {
  id: string;
  // Identidad y Marca
  name: string;
  commercialName: string;
  code: string;
  logoUrl: string;
  // Datos Fiscales y Corporativos
  taxId: string;
  taxRegime: string;
  industry: string;
  fiscalAddress: string;
  // Contacto Principal
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  // Fechas y Vigencia Contractual
  startDate: string;
  renewalDate: string;
  notes: string;
  // Control y Auditoría
  status: 'active' | 'inactive';
  createdBy: string;
  createdByRole: string;
  createdAt?: any;
  updatedAt?: string;
}

export const ALLOWED_LOGO_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Validación RBAC estricta para crear / administrar empresas:
 * Exclusivo para Socio, Gerente y TI (RH y Colaborador bloqueados).
 */
export function canCreateOrManageCompanies(role?: LegacyOrCurrentRole | null): boolean {
  const norm = normalizeRole(role ?? undefined);
  return norm === 'Socio' || norm === 'Gerente' || norm === 'TI';
}

/**
 * Validación RBAC estricta para acceder a la pestaña y ruta del Directorio de Clientes y Empresas:
 * Exclusivo para Socio, Gerente y TI (Supervisor, Colaborador y RH bloqueados).
 */
export function canAccessClientsDirectory(role?: LegacyOrCurrentRole | null): boolean {
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
 * Genera el monograma sobrio de 2 iniciales a partir del nombre comercial o razón social.
 */
export function getCompanyInitials(name?: string | null, commercialName?: string | null): string {
  const source = (commercialName || name || '').trim();
  if (!source) return 'EM';
  const stopWords = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'SA', 'CV', 'S', 'A', 'C', 'V']);
  const words = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toUpperCase()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !stopWords.has(w));

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
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
 * Redimensiona un archivo de imagen raster a máx. 256x256px en DataURL optimizado
 * (o lee directamente DataURL si es SVG).
 */
export async function optimizeCompanyLogoToDataUrl(
  file: File,
  maxDimension = 256
): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    throw new Error('Formato no soportado. Usa PNG, JPG, WEBP o SVG.');
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error('El archivo excede el límite permitido de 2 MB.');
  }

  // Si es SVG, leer directamente como DataURL
  if (file.type === 'image/svg+xml') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo SVG.'));
      reader.readAsDataURL(file);
    });
  }

  // Para PNG/JPG/WEBP, redimensionar en canvas a máx 256x256px preservando relación de aspecto
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const outputMime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        resolve(canvas.toDataURL(outputMime, 0.88));
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Sube el logotipo de la empresa a Firebase Storage (`companies/logos/{companyCode}_{timestamp}`)
 * con fallback automático a DataURL optimizado (máx. 256x256px) si Storage no está habilitado.
 */
export async function uploadCompanyLogo(
  file: File,
  companyCode: string
): Promise<string> {
  const optimizedDataUrl = await optimizeCompanyLogoToDataUrl(file, 256);

  if (!isFirebaseConfigured() || !storage) {
    return optimizedDataUrl;
  }

  try {
    const safeCode = (companyCode || 'EMP').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `companies/logos/${safeCode}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);

    const uploadWithTimeout = Promise.race([
      (async () => {
        const snap = await uploadBytes(storageRef, file, { contentType: file.type });
        return await getDownloadURL(snap.ref);
      })(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('storage-timeout')), 4000)
      ),
    ]);

    const downloadUrl = await uploadWithTimeout;
    return downloadUrl || optimizedDataUrl;
  } catch (err) {
    console.warn('[companyService] Firebase Storage no disponible; usando DataURL optimizado 256x256:', err);
    return optimizedDataUrl;
  }
}

/**
 * Crea o actualiza una empresa/cliente en la colección `companies` de Cloud Firestore.
 * Valida permisos RBAC (solo Socio, Gerente y TI) y usa serverTimestamp() en creación.
 */
export async function saveCompanyToFirestore(company: {
  id: string;
  name: string;
  commercialName?: string;
  code: string;
  logoUrl?: string;
  taxId?: string;
  taxRegime?: string;
  industry?: string;
  fiscalAddress?: string;
  contactName?: string;
  contactRole?: string;
  contactEmail?: string;
  contactPhone?: string;
  startDate?: string;
  renewalDate?: string;
  notes?: string;
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
      error: 'La razón social de la empresa es obligatoria.',
    };
  }

  const cleanCode =
    (company.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '') || generateCompanyCodeSuggestion(cleanName);

  const nowIso = new Date().toISOString();
  const todayIso = nowIso.split('T')[0];

  const localResult: CompanyDocument = {
    id: company.id,
    name: cleanName,
    commercialName: (company.commercialName || '').trim(),
    code: cleanCode,
    logoUrl: (company.logoUrl || '').trim(),
    taxId: (company.taxId || '').trim().toUpperCase(),
    taxRegime: (company.taxRegime || '').trim(),
    industry: (company.industry || '').trim(),
    fiscalAddress: (company.fiscalAddress || '').trim(),
    contactName: (company.contactName || '').trim(),
    contactRole: (company.contactRole || '').trim(),
    contactEmail: (company.contactEmail || '').trim(),
    contactPhone: (company.contactPhone || '').trim(),
    startDate: (company.startDate || todayIso).trim(),
    renewalDate: (company.renewalDate || '').trim(),
    notes: (company.notes || '').trim(),
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
    // Asegurar que la sesión de Firebase Auth coincida con la cuenta demo activa (evita request.auth == null o rol desfasado)
    const demoEmailMap: Record<string, string> = {
      demo_ti: 'ti.root@russellbedford.mx',
      demo_socio: 'socio.prueba@russellbedford.mx',
      demo_gerente: 'gerente.prueba@russellbedford.mx',
    };
    const expectedDemoEmail = demoEmailMap[localResult.createdBy];
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

    const firestorePayload: Record<string, any> = {
      id: localResult.id,
      name: localResult.name,
      commercialName: localResult.commercialName,
      code: localResult.code,
      logoUrl: localResult.logoUrl,
      taxId: localResult.taxId,
      taxRegime: localResult.taxRegime,
      industry: localResult.industry,
      fiscalAddress: localResult.fiscalAddress,
      contactName: localResult.contactName,
      contactRole: localResult.contactRole,
      contactEmail: localResult.contactEmail,
      contactPhone: localResult.contactPhone,
      startDate: localResult.startDate,
      renewalDate: localResult.renewalDate,
      notes: localResult.notes,
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
    const isPermDenied =
      err?.code === 'permission-denied' ||
      String(err?.message || '').toLowerCase().includes('permission');
    return {
      success: false,
      error: isPermDenied
        ? 'Permisos insuficientes en Firestore: publica las reglas actualizadas (firestore.rules) en Firebase Console → Firestore Database → Reglas.'
        : err?.message || 'Error de red al guardar empresa en Firestore.',
    };
  }
}

function mapDocToCompany(docId: string, d: Record<string, any>): CompanyDocument {
  return {
    id: d.id || docId,
    name: String(d.name || 'Sin nombre'),
    commercialName: String(d.commercialName || ''),
    code: String(d.code || docId),
    logoUrl: String(d.logoUrl || ''),
    taxId: String(d.taxId || ''),
    taxRegime: String(d.taxRegime || ''),
    industry: String(d.industry || ''),
    fiscalAddress: String(d.fiscalAddress || ''),
    contactName: String(d.contactName || ''),
    contactRole: String(d.contactRole || ''),
    contactEmail: String(d.contactEmail || ''),
    contactPhone: String(d.contactPhone || ''),
    startDate: String(d.startDate || ''),
    renewalDate: String(d.renewalDate || ''),
    notes: String(d.notes || ''),
    status: d.status === 'inactive' ? 'inactive' : 'active',
    createdBy: String(d.createdBy || ''),
    createdByRole: String(d.createdByRole || ''),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
  };
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
      list.push(mapDocToCompany(docSnap.id, docSnap.data()));
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
    return () => { };
  }

  const listenerId = 'realtime-companies-catalog';
  registerActiveListener(listenerId, 'companies');

  const unsubscribe = onSnapshot(
    collection(db, 'companies'),
    (snap) => {
      trackFirestoreRead(Math.max(1, snap.size));
      const list: CompanyDocument[] = [];
      snap.forEach((docSnap) => {
        list.push(mapDocToCompany(docSnap.id, docSnap.data()));
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

function mapDocToTaskNode(docId: string, d: Record<string, any>): TaskNode {
  const plannedMin =
    typeof d.plannedMinutes === 'number'
      ? Math.round(d.plannedMinutes)
      : Math.round((Number(d.plannedHours) || 0) * 60);
  const loggedMin =
    typeof d.loggedMinutes === 'number'
      ? Math.max(0, Math.round(d.loggedMinutes))
      : 0;
  const title = String(d.title || d.name || 'Tarea');
  const unifiedAssigneeId = String(
    d.assignedToId ||
      d.assignedTo ||
      d.assigned_to ||
      (Array.isArray(d.assignedToIds) ? d.assignedToIds[0] : '') ||
      ''
  );
  const assignedToIds = Array.from(
    new Set(
      [
        ...(Array.isArray(d.assignedToIds) ? d.assignedToIds : []),
        unifiedAssigneeId,
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
    title,
    name: title,
    projectId: String(d.projectId || ''),
    projectName: d.projectName ? String(d.projectName) : undefined,
    companyId: d.companyId ? String(d.companyId) : undefined,
    companyName: d.companyName ? String(d.companyName) : undefined,
    teamId: teamIds[0] || undefined,
    teamIds,
    gerenteId: d.gerenteId ? String(d.gerenteId) : undefined,
    supervisorId: d.supervisorId ? String(d.supervisorId) : undefined,
    assigned_to: unifiedAssigneeId,
    assignedToId: unifiedAssigneeId,
    assignedToIds,
    assignedToEmail: d.assignedToEmail ? String(d.assignedToEmail).toLowerCase() : undefined,
    assignedToName: d.assignedToName ? String(d.assignedToName) : undefined,
    created_by: String(d.supervisorId || d.created_by || ''),
    status: d.status || 'pending',
    priority: d.priority || 'medium',
    plannedHours: Number((plannedMin / 60).toFixed(4)),
    plannedMinutes: plannedMin,
    loggedMinutes: loggedMin,
    dueDate: d.dueDate ? String(d.dueDate) : undefined,
    locationMode: d.locationMode === 'client_site' ? 'client_site' : 'office',
    locationAddress: d.locationAddress ? String(d.locationAddress) : undefined,
    locationRadiusMeters:
      typeof d.locationRadiusMeters === 'number' ? Math.round(d.locationRadiusMeters) : 150,
    isBillable: d.isBillable !== false,
    isActive: d.isActive !== false,
    description: d.description ? String(d.description) : undefined,
    supervisorReviewNote: d.supervisorReviewNote ? String(d.supervisorReviewNote) : undefined,
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
    created_at: d.createdAt ? String(d.createdAt) : undefined,
    completed_at: d.completedAt ? String(d.completedAt) : null,
    isExtraordinary: Boolean(d.isExtraordinary),
    extraordinaryCategory: d.extraordinaryCategory ? String(d.extraordinaryCategory) : undefined,
  };
}

/**
 * Suscripción en tiempo real a `tasks` en Firestore (bloqueado para RH).
 * - TI / Socio: Visibilidad global en todos los equipos.
 * - Gerente: Aislado por `gerenteId` y sus `teamIds`.
 * - Supervisor: Aislado por `supervisorId` / `created_by` y sus `teamIds`.
 * - Colaborador: Aislado por `assignedToIds` (array-contains), `assignedToId`, `assignedTo`,
 *   `assigned_to` y `assignedToEmail`.
 */
export function subscribeTasksFromFirestore(
  role: LegacyOrCurrentRole | null | undefined,
  onData: (tasks: TaskNode[]) => void,
  userIdentity?: UserIdentityMatcher & { teamIds?: string[] }
): () => void {
  if (!canReadCompanies(role) || !isFirebaseConfigured() || !db) {
    return () => { };
  }

  const normRole = normalizeRole(role ?? undefined);

  // TI y Socio: lectura global sin filtro de equipo
  if (normRole === 'TI' || normRole === 'Socio' || !userIdentity) {
    const listenerId = 'realtime-tasks-global';
    registerActiveListener(listenerId, 'tasks');

    const unsubscribe = onSnapshot(
      collection(db, 'tasks'),
      (snap) => {
        trackFirestoreRead(Math.max(1, snap.size));
        const list: TaskNode[] = [];
        snap.forEach((docSnap) => {
          list.push(mapDocToTaskNode(docSnap.id, docSnap.data() as Record<string, any>));
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

  const { ids, email } = resolveUserIdentityKeys({
    ...userIdentity,
    uid: userIdentity.uid || auth?.currentUser?.uid || null,
  });
  const teamIds = Array.from(
    new Set((userIdentity.teamIds || []).map((t) => String(t || '').trim()).filter(Boolean))
  );

  const queryDefs: Array<{ key: string; q: ReturnType<typeof query> }> = [];

  if (normRole === 'Gerente') {
    ids.forEach((idVal) => {
      queryDefs.push({
        key: `gerenteId:${idVal}`,
        q: query(collection(db!, 'tasks'), where('gerenteId', '==', idVal)),
      });
    });
    if (teamIds.length > 0) {
      queryDefs.push({
        key: `gerenteTeams:${teamIds.slice(0, 10).join(',')}`,
        q: query(
          collection(db!, 'tasks'),
          where('teamIds', 'array-contains-any', teamIds.slice(0, 10))
        ),
      });
    }
  } else if (normRole === 'Supervisor') {
    ids.forEach((idVal) => {
      queryDefs.push({
        key: `supervisorId:${idVal}`,
        q: query(collection(db!, 'tasks'), where('supervisorId', '==', idVal)),
      });
      queryDefs.push({
        key: `created_by:${idVal}`,
        q: query(collection(db!, 'tasks'), where('created_by', '==', idVal)),
      });
    });
    if (teamIds.length > 0) {
      queryDefs.push({
        key: `supervisorTeams:${teamIds.slice(0, 10).join(',')}`,
        q: query(
          collection(db!, 'tasks'),
          where('teamIds', 'array-contains-any', teamIds.slice(0, 10))
        ),
      });
    }
  } else {
    // Colaborador: estrictamente tareas asignadas (array `assignedToIds` + campos unificados)
    ids.forEach((idVal) => {
      queryDefs.push({
        key: `assignedToIds:${idVal}`,
        q: query(collection(db!, 'tasks'), where('assignedToIds', 'array-contains', idVal)),
      });
      queryDefs.push({
        key: `assignedToId:${idVal}`,
        q: query(collection(db!, 'tasks'), where('assignedToId', '==', idVal)),
      });
      queryDefs.push({
        key: `assignedTo:${idVal}`,
        q: query(collection(db!, 'tasks'), where('assignedTo', '==', idVal)),
      });
      queryDefs.push({
        key: `assigned_to:${idVal}`,
        q: query(collection(db!, 'tasks'), where('assigned_to', '==', idVal)),
      });
    });

    if (email) {
      queryDefs.push({
        key: `assignedToEmail:${email}`,
        q: query(collection(db!, 'tasks'), where('assignedToEmail', '==', email)),
      });
    }
  }

  if (queryDefs.length === 0) {
    onData([]);
    return () => { };
  }

  const bucketByQuery = new Map<string, Map<string, TaskNode>>();
  const unsubscribers: Array<() => void> = [];

  const emitMerged = () => {
    const merged = new Map<string, TaskNode>();
    bucketByQuery.forEach((taskMap) => {
      taskMap.forEach((task, id) => {
        merged.set(id, task);
      });
    });
    onData(Array.from(merged.values()));
  };

  queryDefs.forEach(({ key, q }) => {
    const listenerId = `realtime-tasks-${normRole.toLowerCase()}-${key}`;
    registerActiveListener(listenerId, 'tasks');
    bucketByQuery.set(key, new Map());

    const unsub = onSnapshot(
      q,
      (snap) => {
        trackFirestoreRead(Math.max(1, snap.size));
        const nextMap = new Map<string, TaskNode>();
        snap.forEach((docSnap) => {
          nextMap.set(
            docSnap.id,
            mapDocToTaskNode(docSnap.id, docSnap.data() as Record<string, any>)
          );
        });
        bucketByQuery.set(key, nextMap);
        emitMerged();
      },
      (err) => {
        console.warn(`[companyService] Sub-suscripción tasks (${key}) omitida:`, err);
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
