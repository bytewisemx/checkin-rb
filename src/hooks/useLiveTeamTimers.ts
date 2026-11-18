import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from '../services/firebase';
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
import { useCheckinStore } from '../store/useCheckinStore';
import {
  canReadCompanies,
  subscribeCompaniesFromFirestore,
  subscribeProjectsFromFirestore,
  subscribeTasksFromFirestore,
} from '../services/companyService';
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

/**
 * Suscripción 100% Real-Time a las colecciones `companies`, `projects` y `tasks` de Cloud Firestore.
 * Bloqueado estrictamente para el rol RH (403).
 * Para Colaborador, filtra en tiempo real por `assignedToId`, `assignedTo` y `assignedToEmail`
 * y sincroniza automáticamente minutos trabajados (`loggedMinutes`) y empresas/proyectos vinculados.
 */
export function useOperationalCatalogSync() {
  const user = useCheckinStore((state) => state.user);
  const userRole = user?.role;
  const userId = user?.id;
  const userEmail = user?.email;
  const userTeamIdsKey = [
    ...(user?.assignedTeams || []),
    ...((user as any)?.teamIds || []),
    user?.teamId || '',
  ]
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (!userRole || !canReadCompanies(userRole)) {
      return;
    }

    const userTeamIds = userTeamIdsKey ? userTeamIdsKey.split(',').filter(Boolean) : [];
    const scopeIdentity = {
      id: userId,
      uid: auth?.currentUser?.uid || null,
      email: userEmail,
      teamIds: userTeamIds,
    };

    const unsubCompanies = subscribeCompaniesFromFirestore(userRole, (companies) => {
      useRayonerStore.setState((state) => {
        const defaultGroupId = state.groups[0]?.id || 'grp-corp';
        const nextGroups =
          companies.length > 0 && state.groups.length === 0
            ? [{ id: defaultGroupId, name: 'Cartera Corporativa', isInternal: false }]
            : state.groups;

        return {
          groups: nextGroups,
          clients: companies.map((c) => ({
            id: c.id,
            groupId: defaultGroupId,
            name: c.name,
            commercialName: c.commercialName,
            code: c.code,
            logoUrl: c.logoUrl,
            taxId: c.taxId,
            taxRegime: c.taxRegime,
            industry: c.industry,
            fiscalAddress: c.fiscalAddress,
            contactName: c.contactName,
            contactRole: c.contactRole,
            contactEmail: c.contactEmail,
            contactPhone: c.contactPhone,
            startDate: c.startDate,
            renewalDate: c.renewalDate,
            notes: c.notes,
            createdBy: c.createdBy,
            createdByRole: c.createdByRole,
            isActive: c.status !== 'inactive',
          })),
        };
      });
    });

    const unsubProjects = subscribeProjectsFromFirestore(
      userRole,
      (projects) => {
        useRayonerStore.setState({ projects });
      },
      scopeIdentity
    );

    const unsubTasks = subscribeTasksFromFirestore(
      userRole,
      (tasks) => {
        useRayonerStore.setState((state) => {
          const nextTaskActualHours = { ...state.taskActualHours };
          const nextUserTaskActualHours = { ...state.userTaskActualHours };

          tasks.forEach((t) => {
            if (typeof t.loggedMinutes === 'number' && t.loggedMinutes >= 0) {
              const loggedHours = Number((t.loggedMinutes / 60).toFixed(4));
              nextTaskActualHours[t.id] = loggedHours;
              const assigneeKey = t.assignedToId || t.assigned_to;
              if (assigneeKey) {
                nextUserTaskActualHours[`${t.id}_${assigneeKey}`] = loggedHours;
              }
              if (userId) {
                nextUserTaskActualHours[`${t.id}_${userId}`] = loggedHours;
              }
            }
          });

          return {
            tasks,
            taskActualHours: nextTaskActualHours,
            userTaskActualHours: nextUserTaskActualHours,
          };
        });
      },
      scopeIdentity
    );

    return () => {
      unsubCompanies();
      unsubProjects();
      unsubTasks();
    };
  }, [userRole, userId, userEmail, userTeamIdsKey]);
}
