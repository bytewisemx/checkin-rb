import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  trackFirestoreDelete,
  trackFirestoreRead,
  trackFirestoreWrite,
} from './firestoreTelemetry';

export interface CompanyDocument {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Crea o actualiza una empresa/cliente en la colección `companies` de Firestore
 * Garantiza campos limpios sin basura ni metadatos innecesarios.
 */
export async function saveCompanyToFirestore(
  company: Omit<CompanyDocument, 'createdAt'> & { createdAt?: string }
): Promise<{ success: boolean; data?: CompanyDocument; error?: string }> {
  const cleanCode = (company.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '') || `EMP-${Date.now().toString().slice(-4)}`;

  const payload: CompanyDocument = {
    id: company.id,
    name: company.name.trim(),
    code: cleanCode,
    status: company.status === 'inactive' ? 'inactive' : 'active',
    createdBy: company.createdBy || 'system',
    createdAt: company.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isFirebaseConfigured() || !db) {
    return { success: true, data: payload };
  }

  try {
    await setDoc(doc(db, 'companies', payload.id), payload, { merge: true });
    trackFirestoreWrite(1);
    return { success: true, data: payload };
  } catch (err: any) {
    console.warn('[companyService] Error al guardar empresa en Firestore:', err);
    return {
      success: false,
      error: err?.message || 'Error de permisos o red al guardar empresa.',
    };
  }
}

/**
 * Obtiene el catálogo de empresas desde la colección `companies` de Firestore
 */
export async function fetchCompaniesFromFirestore(): Promise<CompanyDocument[]> {
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
        status: d.status === 'inactive' ? 'inactive' : 'active',
        createdBy: String(d.createdBy || ''),
        createdAt: String(d.createdAt || new Date().toISOString()),
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
