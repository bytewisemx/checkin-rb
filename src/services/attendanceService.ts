import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { trackFirestoreRead, trackFirestoreWrite } from './firestoreTelemetry';

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

export interface AttendanceDocument {
  id: string;
  userId: string;
  userName: string;
  teamId: string | null;
  date: string;
  checkIn: AttendanceCheckInNode;
  checkOut: AttendanceCheckOutNode | null;
  totalMinutes: number; // Entero estricto, sin decimales
  status: 'active' | 'completed' | 'pending_checkout_regularization' | 'justified';
  updatedAt: string;
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
  status: AttendanceDocument['status'] = 'completed'
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
        updatedAt: String(d.updatedAt || ''),
      });
    });

    return results;
  } catch (err) {
    console.warn('[attendanceService] Error al consultar asistencias en Firestore:', err);
    return [];
  }
}
