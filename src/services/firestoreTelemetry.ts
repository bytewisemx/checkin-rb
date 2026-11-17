import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { create } from 'zustand';
import { db, isFirebaseConfigured } from './firebase';

export interface ActiveListenerInfo {
  id: string;
  collection: string;
  startedAt: number;
}

export interface CollectionDiagnosticMetric {
  name: string;
  docCount: number;
  estimatedBytes: number;
  rhAccessLabel: string;
  rhBlocked: boolean;
  rulesStatus: 'Protegida' | 'Error' | 'Sin acceso';
  extraNote?: string;
}

export interface ClientMemoryMetrics {
  supported: boolean;
  usedMB: number;
  totalMB: number;
  limitMB: number;
}

export interface LatencyResult {
  latencyMs: number | null;
  status: 'online' | 'offline' | 'error';
  checkedAt: number;
  error?: string;
}

export interface IndexedDbStatus {
  supported: boolean;
  firestoreCacheDetected: boolean;
  databaseCount: number;
  statusLabel: string;
}

interface FirestoreTelemetryState {
  reads: number;
  writes: number;
  deletes: number;
  activeListeners: Record<string, ActiveListenerInfo>;
  trackRead: (count?: number) => void;
  trackWrite: (count?: number) => void;
  trackDelete: (count?: number) => void;
  registerListener: (id: string, collectionName: string) => void;
  unregisterListener: (id: string) => void;
  resetSessionCounters: () => void;
}

export const useFirestoreTelemetryStore = create<FirestoreTelemetryState>((set) => ({
  reads: 0,
  writes: 0,
  deletes: 0,
  activeListeners: {},

  trackRead: (count = 1) =>
    set((state) => ({ reads: state.reads + Math.max(0, Math.round(count)) })),

  trackWrite: (count = 1) =>
    set((state) => ({ writes: state.writes + Math.max(0, Math.round(count)) })),

  trackDelete: (count = 1) =>
    set((state) => ({ deletes: state.deletes + Math.max(0, Math.round(count)) })),

  registerListener: (id, collectionName) =>
    set((state) => ({
      activeListeners: {
        ...state.activeListeners,
        [id]: { id, collection: collectionName, startedAt: Date.now() },
      },
    })),

  unregisterListener: (id) =>
    set((state) => {
      const next = { ...state.activeListeners };
      delete next[id];
      return { activeListeners: next };
    }),

  resetSessionCounters: () => set({ reads: 0, writes: 0, deletes: 0 }),
}));

export const trackFirestoreRead = (count = 1) =>
  useFirestoreTelemetryStore.getState().trackRead(count);

export const trackFirestoreWrite = (count = 1) =>
  useFirestoreTelemetryStore.getState().trackWrite(count);

export const trackFirestoreDelete = (count = 1) =>
  useFirestoreTelemetryStore.getState().trackDelete(count);

export const registerActiveListener = (id: string, collectionName: string) =>
  useFirestoreTelemetryStore.getState().registerListener(id, collectionName);

export const unregisterActiveListener = (id: string) =>
  useFirestoreTelemetryStore.getState().unregisterListener(id);

/**
 * Formatea bytes en B, KB o MB de forma legible y precisa
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0.0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Captura métricas reales de JS Heap en el cliente mediante Performance API
 */
export function getClientMemoryMetrics(): ClientMemoryMetrics {
  const perf = typeof performance !== 'undefined' ? (performance as any) : null;
  if (perf && perf.memory) {
    const bytesToMB = (b: number) => Number((b / (1024 * 1024)).toFixed(1));
    return {
      supported: true,
      usedMB: bytesToMB(perf.memory.usedJSHeapSize || 0),
      totalMB: bytesToMB(perf.memory.totalJSHeapSize || 0),
      limitMB: bytesToMB(perf.memory.jsHeapSizeLimit || 0),
    };
  }
  return {
    supported: false,
    usedMB: 0,
    totalMB: 0,
    limitMB: 0,
  };
}

/**
 * Mide la latencia real (Ping en ms) ejecutando una lectura ligera getDoc hacia (default)
 */
export async function measureFirestoreLatency(): Promise<LatencyResult> {
  if (!isFirebaseConfigured() || !db) {
    return {
      latencyMs: null,
      status: 'offline',
      checkedAt: Date.now(),
      error: 'Firebase no está configurado en variables de entorno.',
    };
  }

  const start = performance.now();
  try {
    const pingRef = doc(db, 'teams', 'team-prueba-01');
    await getDoc(pingRef);
    const elapsed = Math.max(1, Math.round(performance.now() - start));
    trackFirestoreRead(1);
    return {
      latencyMs: elapsed,
      status: 'online',
      checkedAt: Date.now(),
    };
  } catch (err: any) {
    const elapsed = Math.max(1, Math.round(performance.now() - start));
    return {
      latencyMs: elapsed,
      status: 'error',
      checkedAt: Date.now(),
      error: err?.message || 'Error al medir latencia con Firestore',
    };
  }
}

/**
 * Verifica el estado de Caché Local (IndexedDB) en el navegador
 */
export async function checkIndexedDbStatus(): Promise<IndexedDbStatus> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return {
      supported: false,
      firestoreCacheDetected: false,
      databaseCount: 0,
      statusLabel: 'No soportado por el navegador',
    };
  }

  try {
    const idb = window.indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string; version?: number }>>;
    };
    if (typeof idb.databases === 'function') {
      const dbs = await idb.databases();
      const hasFirestoreDb = dbs.some((d) =>
        String(d.name || '').toLowerCase().includes('firestore')
      );
      return {
        supported: true,
        firestoreCacheDetected: hasFirestoreDb,
        databaseCount: dbs.length,
        statusLabel: hasFirestoreDb
          ? 'Operativa (Persistencia Firestore activa)'
          : 'Disponible (Caché en memoria / IndexedDB listo)',
      };
    }

    return {
      supported: true,
      firestoreCacheDetected: false,
      databaseCount: 0,
      statusLabel: 'Disponible (Operando sin errores)',
    };
  } catch {
    return {
      supported: true,
      firestoreCacheDetected: false,
      databaseCount: 0,
      statusLabel: 'Disponible (Acceso restringido a listado)',
    };
  }
}

/**
 * Calcula volumen de documentos y peso estimado en bytes serializado en JSON
 * para las colecciones esenciales de Firestore
 */
export async function scanFirestoreCollections(): Promise<{
  collections: CollectionDiagnosticMetric[];
  totalBytes: number;
  totalDocs: number;
  biometricVectorsCount: number;
  biometricBytes: number;
}> {
  const specs: Array<{
    name: string;
    rhAccessLabel: string;
    rhBlocked: boolean;
  }> = [
    { name: 'users', rhAccessLabel: 'Solo lectura básica', rhBlocked: false },
    { name: 'tasks', rhAccessLabel: 'Bloqueado (403)', rhBlocked: true },
    { name: 'companies', rhAccessLabel: 'Bloqueado (403)', rhBlocked: true },
    { name: 'attendance', rhAccessLabel: 'Lectura Global', rhBlocked: false },
    { name: 'teams', rhAccessLabel: 'Lectura de estructura', rhBlocked: false },
    { name: 'active_timers', rhAccessLabel: 'Lectura operativa', rhBlocked: false },
  ];

  if (!isFirebaseConfigured() || !db) {
    return {
      collections: specs.map((s) => ({
        name: s.name,
        docCount: 0,
        estimatedBytes: 0,
        rhAccessLabel: s.rhAccessLabel,
        rhBlocked: s.rhBlocked,
        rulesStatus: 'Sin acceso',
      })),
      totalBytes: 0,
      totalDocs: 0,
      biometricVectorsCount: 0,
      biometricBytes: 0,
    };
  }

  const encoder = new TextEncoder();
  let totalBytes = 0;
  let totalDocs = 0;
  let biometricVectorsCount = 0;
  let biometricBytes = 0;

  const results = await Promise.all(
    specs.map(async (spec): Promise<CollectionDiagnosticMetric> => {
      try {
        const snap = await getDocs(collection(db!, spec.name));
        const count = snap.size;
        trackFirestoreRead(Math.max(1, count));

        let colBytes = 0;
        let colBioCount = 0;

        snap.forEach((d) => {
          const data = d.data();
          const serialized = JSON.stringify({ id: d.id, ...data });
          colBytes += encoder.encode(serialized).length;

          if (spec.name === 'users') {
            const vec = data.faceDescriptor || data.biometrics?.faceDescriptor;
            if (Array.isArray(vec) && vec.length > 0) {
              colBioCount++;
              biometricVectorsCount++;
              biometricBytes += encoder.encode(JSON.stringify(vec)).length;
            }
          }
        });

        totalBytes += colBytes;
        totalDocs += count;

        return {
          name: spec.name,
          docCount: count,
          estimatedBytes: colBytes,
          rhAccessLabel: spec.rhAccessLabel,
          rhBlocked: spec.rhBlocked,
          rulesStatus: 'Protegida',
          extraNote:
            spec.name === 'users' && colBioCount > 0
              ? `${colBioCount} vector(es) 128-D`
              : undefined,
        };
      } catch (err: any) {
        return {
          name: spec.name,
          docCount: 0,
          estimatedBytes: 0,
          rhAccessLabel: spec.rhAccessLabel,
          rhBlocked: spec.rhBlocked,
          rulesStatus: err?.code === 'permission-denied' ? 'Protegida' : 'Error',
          extraNote: err?.code || undefined,
        };
      }
    })
  );

  return {
    collections: results,
    totalBytes,
    totalDocs,
    biometricVectorsCount,
    biometricBytes,
  };
}
