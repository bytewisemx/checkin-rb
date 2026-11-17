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

export function useLiveTeamTimers() {
  useEffect(() => {
    // 1. Suscripción en tiempo real a BroadcastChannel local (inter-pestañas instantáneo)
    const channel =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('rb_rayoner_realtime_channel')
        : null;

    const handleBroadcastMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'TIMER_STARTED' && data.payload) {
        const worker = data.payload as ActiveWorker;
        useRayonerStore.setState((state) => ({
          activeWorkers: [
            ...state.activeWorkers.filter((w) => w.userId !== worker.userId),
            worker,
          ],
        }));
      } else if (data.type === 'TIMER_STOPPED' && data.payload?.userId) {
        const stoppedUserId = data.payload.userId as string;
        useRayonerStore.setState((state) => ({
          activeWorkers: state.activeWorkers.filter((w) => w.userId !== stoppedUserId),
        }));
      }
    };

    channel?.addEventListener('message', handleBroadcastMessage);

    // 2. Suscripción en tiempo real a Firestore (onSnapshot) para sincronización entre dispositivos/cuentas
    if (!isFirebaseConfigured() || !db) {
      return () => {
        channel?.removeEventListener('message', handleBroadcastMessage);
        channel?.close();
      };
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
          if (data && data.isRunning) {
            const startedAtVal = data.startedAt;
            const startedAtMs =
              typeof startedAtVal === 'number'
                ? startedAtVal
                : (startedAtVal as any)?.toDate
                ? (startedAtVal as any).toDate().getTime()
                : new Date(startedAtVal).getTime();

            const elapsedMinutes = computeElapsedShiftMinutes(startedAtMs);
            const isTruncated12h = elapsedMinutes >= MAX_CONTINUOUS_SHIFT_MINUTES;

            remoteWorkers.push({
              userId: data.userId || docSnap.id,
              userName: data.userName || 'Colaborador',
              taskId: data.taskId || '',
              taskName: isTruncated12h
                ? `${data.taskName || 'Tarea activa'} (Corte 12h)`
                : data.taskName || 'Tarea activa',
              projectName: data.projectName || 'Proyecto',
              clientName: data.clientName || 'Cliente',
              startedAtMs,
              startedAt: startedAtVal,
              accumulatedSeconds: isTruncated12h
                ? MAX_CONTINUOUS_SHIFT_MINUTES * 60
                : data.accumulatedSeconds || 0,
              isRunning: !isTruncated12h,
              currentDurationStr: isTruncated12h ? '12:00:00' : '00:00:00',
            });
          }
        });

        useRayonerStore.setState((state) => {
          // Fusionar con trabajadores locales preservando estado activo
          const nonOverlapped = state.activeWorkers.filter(
            (w) => !remoteWorkers.some((r) => r.userId === w.userId)
          );
          return {
            activeWorkers: [...nonOverlapped, ...remoteWorkers],
          };
        });
      },
      (err) => {
        console.warn('[useLiveTeamTimers] Error en suscripción onSnapshot active_timers:', err);
      }
    );

    return () => {
      unsubscribe();
      unregisterActiveListener(listenerId);
      channel?.removeEventListener('message', handleBroadcastMessage);
      channel?.close();
    };
  }, []);
}

