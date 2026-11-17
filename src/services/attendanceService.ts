import { collection, doc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import {
  registerActiveListener,
  trackFirestoreRead,
  trackFirestoreWrite,
  unregisterActiveListener,
} from './firestoreTelemetry';

export const MAX_CONTINUOUS_SHIFT_MINUTES = 720; // 12h 00m exactas
export const MAX_CONTINUOUS_SHIFT_MS = MAX_CONTINUOUS_SHIFT_MINUTES * 60 * 1000;

export interface AttendanceCheckInNode {
  timestamp: string;
  timestampMs: number;
  facialMatch: boolean;
  confidenceScore: number;
  lat: number | null;
  lng: number | null;
  locationLabel: string;
}

export interface AttendanceCheckOutNode {
  timestamp: string;
  timestampMs: number;
  autoStoppedAt?: string;
}

export type AttendanceStatus =
  | 'active'
  | 'completed'
  | 'pending_checkout_regularization'
  | 'pending_regularization'
  | 'truncated_12h'
  | 'justified';

export interface AttendanceDocument {
  id: string;
  userId: string;
  userName: string;
  teamId: string | null;
  date: string;
  checkIn: AttendanceCheckInNode;
  checkOut: AttendanceCheckOutNode | null;
  totalMinutes: number; // Entero estricto, sin decimales
  status: AttendanceStatus;
  autoStoppedAt?: string | null;
  requiresRegularization?: boolean;
  regularized?: boolean;
  regularizationNote?: string;
  exceeded12hAlert?: boolean;
  updatedAt: string;
}

/**
 * Formatea una cantidad de minutos enteros a formato sexagesimal estricto: "Xh Ym"
 */
export function formatMinutesSexagesimal(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Calcula los minutos enteros transcurridos desde checkIn.timestamp:
 * elapsedMinutes = Math.floor((now - checkInTimestamp) / 60000)
 */
export function computeElapsedShiftMinutes(
  checkInTimestampMs: number,
  nowMs: number = Date.now()
): number {
  if (!checkInTimestampMs || nowMs <= checkInTimestampMs) return 0;
  return Math.floor((nowMs - checkInTimestampMs) / 60000);
}

/**
 * Registra o actualiza un Check-In en la colección `attendance` de Firestore
 * Garantiza campos limpios (sin fotos) y minutos enteros.
 */
export async function saveAttendanceCheckInToFirestore(
  record: AttendanceDocument
): Promise<{ success: boolean; error?: string }> {
  const cleanPayload: AttendanceDocument = {
    id: record.id,
    userId: record.userId,
    userName: record.userName || 'Colaborador',
    teamId: record.teamId || null,
    date: record.date,
    checkIn: {
      timestamp: record.checkIn.timestamp,
      timestampMs: Math.round(record.checkIn.timestampMs),
      facialMatch: Boolean(record.checkIn.facialMatch),
      confidenceScore: Number((record.checkIn.confidenceScore || 0).toFixed(4)),
      lat: typeof record.checkIn.lat === 'number' ? record.checkIn.lat : null,
      lng: typeof record.checkIn.lng === 'number' ? record.checkIn.lng : null,
      locationLabel: record.checkIn.locationLabel || 'Ubicación registrada',
    },
    checkOut: record.checkOut
      ? {
          timestamp: record.checkOut.timestamp,
          timestampMs: Math.round(record.checkOut.timestampMs),
          ...(record.checkOut.autoStoppedAt
            ? { autoStoppedAt: record.checkOut.autoStoppedAt }
            : {}),
        }
      : null,
    totalMinutes: Math.max(0, Math.round(record.totalMinutes || 0)),
    status: record.status || 'active',
    requiresRegularization: Boolean(record.requiresRegularization),
    regularized: Boolean(record.regularized),
    updatedAt: new Date().toISOString(),
  };

  if (!isFirebaseConfigured() || !db) {
    return { success: true };
  }

  try {
    await setDoc(doc(db, 'attendance', cleanPayload.id), cleanPayload, { merge: true });
    trackFirestoreWrite(1);
    return { success: true };
  } catch (err: any) {
    console.warn('[attendanceService] Error al persistir check-in en Firestore:', err);
    return {
      success: false,
      error: err?.message || 'Error al guardar registro de asistencia.',
    };
  }
}

/**
 * Actualiza la salida (Check-Out) y total de minutos enteros en `attendance`
 */
export async function saveAttendanceCheckOutToFirestore(
  attendanceId: string,
  checkOut: AttendanceCheckOutNode,
  totalMinutes: number,
  status: AttendanceStatus = 'completed'
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db || !attendanceId) return true;

  try {
    await setDoc(
      doc(db, 'attendance', attendanceId),
      {
        checkOut: {
          timestamp: checkOut.timestamp,
          timestampMs: Math.round(checkOut.timestampMs),
          ...(checkOut.autoStoppedAt ? { autoStoppedAt: checkOut.autoStoppedAt } : {}),
        },
        totalMinutes: Math.max(0, Math.round(totalMinutes || 0)),
        status,
        requiresRegularization: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return true;
  } catch (err) {
    console.warn('[attendanceService] Error al persistir check-out en Firestore:', err);
    return false;
  }
}

/**
 * Ejecuta el corte automático al alcanzar 12 horas continuas (720 minutos)
 * Marca en Firestore: status: "truncated_12h", autoStoppedAt, requiresRegularization: true
 */
export async function truncateAttendanceAt12Hours(
  attendanceId: string,
  checkInTimestampMs: number
): Promise<boolean> {
  if (!isFirebaseConfigured() || !db || !attendanceId) return true;

  const autoStoppedMs = checkInTimestampMs + MAX_CONTINUOUS_SHIFT_MS;
  const autoStoppedIso = new Date(autoStoppedMs).toISOString();

  try {
    await setDoc(
      doc(db, 'attendance', attendanceId),
      {
        status: 'truncated_12h',
        autoStoppedAt: autoStoppedIso,
        requiresRegularization: true,
        regularized: false,
        totalMinutes: MAX_CONTINUOUS_SHIFT_MINUTES,
        checkOut: {
          timestamp: autoStoppedIso,
          timestampMs: Math.round(autoStoppedMs),
          autoStoppedAt: autoStoppedIso,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return true;
  } catch (err) {
    console.warn('[attendanceService] Error al truncar asistencia a 12h:', err);
    return false;
  }
}

/**
 * Validación matemática estricta en minutos enteros (Hard Cap):
 * Verifica que assignedMinutes <= totalShiftMinutes antes de cualquier guardado o commit.
 */
export function validateShiftTimeDistribution(
  allocations: Array<{ taskId: string; minutes: number }>,
  totalShiftMinutes: number
): {
  valid: boolean;
  assignedMinutes: number;
  totalShiftMinutes: number;
  remainingMinutes: number;
  error?: string;
} {
  const safeTotal = Math.max(0, Math.round(totalShiftMinutes || 0));
  const assignedMinutes = (allocations || []).reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.minutes || 0)),
    0
  );
  const remainingMinutes = safeTotal - assignedMinutes;

  if (assignedMinutes > safeTotal) {
    return {
      valid: false,
      assignedMinutes,
      totalShiftMinutes: safeTotal,
      remainingMinutes,
      error: `Exceso de capacidad: Intentaste asignar ${formatMinutesSexagesimal(
        assignedMinutes
      )}, superando el tiempo real laborado de ${formatMinutesSexagesimal(safeTotal)}.`,
    };
  }

  return {
    valid: true,
    assignedMinutes,
    totalShiftMinutes: safeTotal,
    remainingMinutes,
  };
}

/**
 * Guarda la regularización de salida real en Firestore y libera la sesión pendiente.
 * Rechaza la operación si los minutos asignados en tareas superan totalMinutes del turno.
 */
export async function regularizeAttendanceInFirestore(
  attendanceId: string,
  payload: {
    checkOutMs: number;
    totalMinutes: number;
    note?: string;
    exceeded12hAlert?: boolean;
    allocations?: Array<{ taskId: string; minutes: number }>;
  }
): Promise<{ success: boolean; error?: string }> {
  const safeTotalMinutes = Math.max(0, Math.round(payload.totalMinutes || 0));

  if (payload.allocations && payload.allocations.length > 0) {
    const check = validateShiftTimeDistribution(payload.allocations, safeTotalMinutes);
    if (!check.valid) {
      console.error('[attendanceService] Operación rechazada por exceso de capacidad:', check.error);
      return { success: false, error: check.error };
    }
  }

  if (!isFirebaseConfigured() || !db || !attendanceId) {
    return { success: true };
  }

  const checkOutIso = new Date(payload.checkOutMs).toISOString();

  try {
    await setDoc(
      doc(db, 'attendance', attendanceId),
      {
        checkOut: {
          timestamp: checkOutIso,
          timestampMs: Math.round(payload.checkOutMs),
        },
        totalMinutes: safeTotalMinutes,
        regularized: true,
        requiresRegularization: false,
        status: 'completed',
        exceeded12hAlert: Boolean(payload.exceeded12hAlert),
        regularizationNote: payload.note || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    trackFirestoreWrite(1);
    return { success: true };
  } catch (err: any) {
    console.warn('[attendanceService] Error al regularizar asistencia en Firestore:', err);
    return {
      success: false,
      error: err?.message || 'Error al guardar la regularización en Firestore.',
    };
  }
}

/**
 * Consulta si existe un registro en `attendance` con requiresRegularization === true para el usuario
 */
export async function fetchPendingRegularizationAttendance(
  userId: string
): Promise<AttendanceDocument | null> {
  if (!isFirebaseConfigured() || !db || !userId) return null;

  try {
    const q = query(
      collection(db, 'attendance'),
      where('userId', '==', userId),
      where('requiresRegularization', '==', true)
    );
    const snap = await getDocs(q);
    trackFirestoreRead(Math.max(1, snap.size));

    if (snap.empty) return null;

    const first = snap.docs[0];
    const d = first.data() as any;
    return {
      id: d.id || first.id,
      userId: String(d.userId || userId),
      userName: String(d.userName || 'Colaborador'),
      teamId: d.teamId || null,
      date: String(d.date || ''),
      checkIn: d.checkIn || {
        timestamp: '',
        timestampMs: 0,
        facialMatch: false,
        confidenceScore: 0,
        lat: null,
        lng: null,
        locationLabel: '',
      },
      checkOut: d.checkOut || null,
      totalMinutes: Math.max(0, Math.round(d.totalMinutes || 0)),
      status: d.status || 'truncated_12h',
      autoStoppedAt: d.autoStoppedAt || null,
      requiresRegularization: true,
      regularized: Boolean(d.regularized),
      updatedAt: String(d.updatedAt || ''),
    };
  } catch (err) {
    console.warn('[attendanceService] Error al verificar asistencia pendiente de regularización:', err);
    return null;
  }
}

/**
 * Consulta asistencias en Firestore (por equipo para supervisor, o global para RH / TI)
 */
export async function fetchAttendanceRecordsFromFirestore(
  filter?: { userId?: string; teamId?: string }
): Promise<AttendanceDocument[]> {
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const colRef = collection(db, 'attendance');
    let q: any = colRef;

    if (filter?.userId) {
      q = query(colRef, where('userId', '==', filter.userId));
    } else if (filter?.teamId) {
      q = query(colRef, where('teamId', '==', filter.teamId));
    }

    const snap = await getDocs(q);
    trackFirestoreRead(Math.max(1, snap.size));

    const results: AttendanceDocument[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      results.push({
        id: d.id || docSnap.id,
        userId: String(d.userId || ''),
        userName: String(d.userName || 'Colaborador'),
        teamId: d.teamId || null,
        date: String(d.date || ''),
        checkIn: d.checkIn || {
          timestamp: '',
          timestampMs: 0,
          facialMatch: false,
          confidenceScore: 0,
          lat: null,
          lng: null,
          locationLabel: '',
        },
        checkOut: d.checkOut || null,
        totalMinutes: Math.max(0, Math.round(d.totalMinutes || 0)),
        status: d.status || 'completed',
        autoStoppedAt: d.autoStoppedAt || null,
        requiresRegularization: Boolean(d.requiresRegularization),
        regularized: Boolean(d.regularized),
        updatedAt: String(d.updatedAt || ''),
      });
    });

    return results;
  } catch (err) {
    console.warn('[attendanceService] Error al consultar asistencias en Firestore:', err);
    return [];
  }
}

/**
 * Suscripción en tiempo real (`onSnapshot`) a la colección `attendance` en Cloud Firestore.
 * Fuente única de verdad (cero mocks): si Firestore está vacío, emite `[]`.
 */
export function subscribeAttendanceFromFirestore(
  onData: (records: AttendanceDocument[]) => void,
  filter?: { userId?: string; teamId?: string; listenerKey?: string }
): () => void {
  if (!isFirebaseConfigured() || !db) {
    onData([]);
    return () => {};
  }

  const listenerId = filter?.listenerKey || `attendance-realtime-${filter?.userId || filter?.teamId || 'global'}`;
  registerActiveListener(listenerId, 'attendance');

  const colRef = collection(db, 'attendance');
  let q: any = colRef;
  if (filter?.userId) {
    q = query(colRef, where('userId', '==', filter.userId));
  } else if (filter?.teamId) {
    q = query(colRef, where('teamId', '==', filter.teamId));
  }

  const unsubscribe = onSnapshot(
    q,
    (snap: any) => {
      trackFirestoreRead(Math.max(1, snap.size));
      const results: AttendanceDocument[] = [];
      snap.forEach((docSnap: any) => {
        const d = docSnap.data() as any;
        results.push({
          id: d.id || docSnap.id,
          userId: String(d.userId || ''),
          userName: String(d.userName || 'Colaborador'),
          teamId: d.teamId || null,
          date: String(d.date || ''),
          checkIn: d.checkIn || {
            timestamp: '',
            timestampMs: 0,
            facialMatch: false,
            confidenceScore: 0,
            lat: null,
            lng: null,
            locationLabel: '',
          },
          checkOut: d.checkOut || null,
          totalMinutes: Math.max(0, Math.round(d.totalMinutes || 0)),
          status: d.status || 'completed',
          autoStoppedAt: d.autoStoppedAt || null,
          requiresRegularization: Boolean(d.requiresRegularization),
          regularized: Boolean(d.regularized),
          updatedAt: String(d.updatedAt || ''),
        });
      });
      onData(results);
    },
    (err: any) => {
      console.warn('[attendanceService] Error en suscripción real-time attendance:', err);
      onData([]);
    }
  );

  return () => {
    unsubscribe();
    unregisterActiveListener(listenerId);
  };
}
