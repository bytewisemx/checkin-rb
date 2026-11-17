import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';
import {
  registerActiveListener,
  unregisterActiveListener,
  trackFirestoreRead,
} from '../services/firestoreTelemetry';
import {
  computeElapsedShiftMinutes,
  MAX_CONTINUOUS_SHIFT_MINUTES,
} from '../services/attendanceService';
import { useRayonerStore } from '../store/useRayonerStore';
import type { ActiveWorker } from '../types/rayoner';

/**
 * Suscripción 100% Real-Time a la colección `active_timers` en Cloud Firestore.
 * Cero mocks y cero fusión con relojes locales caducos:
 * si Firestore no tiene documentos corriendo, `activeWorkers` es `[]` (muestra "—").
 */
export function useLiveTeamTimers() {
  useEffect(() => {
    if (!isFirebaseConfigured() || !db) {
      useRayonerStore.setState({ activeWorkers: [] });
      return;
    }

    const listenerId = 'live-team-timers-active-timers';
    registerActiveListener(listenerId, 'active_timers');
    const timersCol = collection(db, 'active_timers');

    const unsubscribe = onSnapshot(
      timersCol,
      (snapshot) => {
        trackFirestoreRead(Math.max(1, snapshot.size));
        const remoteWorkers: ActiveWorker[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.isRunning === true && data.startedAt) {
            const startedAtVal = data.startedAt;
            const startedAtMs =
              typeof startedAtVal === 'number'
                ? startedAtVal
                : (startedAtVal as any)?.toDate
                ? (startedAtVal as any).toDate().getTime()
                : new Date(startedAtVal).getTime();

            if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return;

            const elapsedMinutes = computeElapsedShiftMinutes(startedAtMs);
            const isTruncated12h = elapsedMinutes >= MAX_CONTINUOUS_SHIFT_MINUTES;

            // Si el timer excedió las 12 horas continuas sin cierre, ya no cuenta como activo en vivo
            if (isTruncated12h) return;

            remoteWorkers.push({
              userId: data.userId || docSnap.id,
              userName: data.userName || 'Colaborador',
              taskId: data.taskId || '',
              taskName: data.taskName || 'Tarea activa',
              projectName: data.projectName || 'Proyecto',
              clientName: data.clientName || 'Empresa',
              startedAtMs,
              startedAt: startedAtVal,
              accumulatedSeconds: typeof data.accumulatedSeconds === 'number' ? data.accumulatedSeconds : 0,
              isRunning: true,
              currentDurationStr: '00:00:00',
            });
          }
        });

        // Reemplazo estricto por la verdad en tiempo real de Firestore (cero residuos locales)
        useRayonerStore.setState({
          activeWorkers: remoteWorkers,
        });
      },
      (err) => {
        console.warn('[useLiveTeamTimers] Error en suscripción onSnapshot active_timers:', err);
        useRayonerStore.setState({ activeWorkers: [] });
      }
    );

    return () => {
      unsubscribe();
      unregisterActiveListener(listenerId);
    };
  }, []);
}
