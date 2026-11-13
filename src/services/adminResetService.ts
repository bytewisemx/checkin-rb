import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { Team } from '../types/team';
import { useTeamStore } from '../store/useTeamStore';
import { useCheckinStore } from '../store/useCheckinStore';
import { useRayonerStore } from '../store/useRayonerStore';
import { useInvitationStore } from '../store/useInvitationStore';
import { useAuditStore } from '../store/useAuditStore';
import { useNotificationStore } from '../store/useNotificationStore';
import {
  getDefaultPermissionsForRole,
  getDefaultModulesForRole,
  type UserRole,
} from './rbac';

export interface CleanSlateResult {
  collectionsCleared: Record<string, number>;
  teamsPreserved: number;
  teamsDeleted: number;
  usersNormalized: number;
  usersDeleted: number;
  success: boolean;
  error?: string;
}

export const BASE_ACCOUNTS_CONFIG = [
  {
    id: 'ti-root-01',
    email: 'ti.root@russellbedford.mx',
    name: 'TI Prueba',
    firstName: 'TI',
    lastName: 'Prueba',
    role: 'ti' as UserRole,
    roleTitle: 'Administrador TI (Root)',
    teamId: null,
    team: null,
    teamName: null,
    assignedTeams: [] as string[],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    supervisorId: null,
    supervisorName: null,
  },
  {
    id: 'gerente-01',
    email: 'gerente.prueba@russellbedford.mx',
    name: 'Gerente Prueba',
    firstName: 'Gerente',
    lastName: 'Prueba',
    role: 'gerente' as UserRole,
    roleTitle: 'Gerente de Área (Prueba)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    supervisorId: null,
    supervisorName: null,
  },
  {
    id: 'supervisor-01',
    email: 'supervisor.prueba@russellbedford.mx',
    name: 'Supervisor Prueba',
    firstName: 'Supervisor',
    lastName: 'Prueba',
    role: 'supervisor' as UserRole,
    roleTitle: 'Supervisor Líder (Prueba)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    supervisorId: null,
    supervisorName: null,
  },
  {
    id: 'colaborador-01',
    email: 'colaborador.prueba@russellbedford.mx',
    name: 'Colaborador Prueba',
    firstName: 'Colaborador',
    lastName: 'Prueba',
    role: 'colaborador' as UserRole,
    roleTitle: 'Colaborador Operativo (Prueba)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    supervisorId: 'supervisor-01',
    supervisorName: 'Supervisor Prueba',
  },
  {
    id: 'rh-01',
    email: 'rh.prueba@russellbedford.mx',
    name: 'RH Prueba',
    firstName: 'RH',
    lastName: 'Prueba',
    role: 'rh' as UserRole,
    roleTitle: 'Recursos Humanos (Prueba)',
    teamId: null,
    team: null,
    teamName: null,
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    supervisorId: null,
    supervisorName: null,
  },
];

/**
 * Ejecuta el Reinicio Limpio de Base de Datos (Clean Slate)
 * 1. Vacía las colecciones operativas en Firestore:
 *    - clients, projects, tasks, checkins, attendance, time_logs, invitations, audit_logs, active_timers, notifications
 * 2. Colección teams:
 *    - Deja únicamente un único documento activo: 'team-prueba-01' ("Equipo Prueba")
 * 3. Colección users:
 *    - Configura exclusivamente las 5 cuentas oficiales base
 * 4. Limpia el almacenamiento local (Zustand & localStorage)
 */
export async function executeCleanSlateAdministrativeReset(): Promise<CleanSlateResult> {
  const result: CleanSlateResult = {
    collectionsCleared: {},
    teamsPreserved: 0,
    teamsDeleted: 0,
    usersNormalized: 0,
    usersDeleted: 0,
    success: false,
  };

  const isRemote = Boolean(isFirebaseConfigured() && db);
  const firestore = db;

  try {
    let activeSupervisorUid = 'supervisor-01';

    if (isRemote && firestore) {
      // 1. Vaciar colecciones operativas
      const operationalCollections = [
        'clients',
        'projects',
        'tasks',
        'checkins',
        'attendance',
        'time_logs',
        'invitations',
        'audit_logs',
        'active_timers',
        'notifications',
      ];

      for (const colName of operationalCollections) {
        try {
          const snap = await getDocs(collection(firestore, colName));
          result.collectionsCleared[colName] = snap.size;

          if (!snap.empty) {
            const batch = writeBatch(firestore);
            snap.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
          }
        } catch (colErr) {
          console.warn(`[CleanSlate] Error vaciando colección ${colName}:`, colErr);
          result.collectionsCleared[colName] = 0;
        }
      }

      // 2. Normalizar usuarios (users)
      const usersSnap = await getDocs(collection(firestore, 'users'));
      const existingUsersByEmail = new Map<string, string>();
      const existingUsersById = new Set<string>();

      usersSnap.forEach((uDoc) => {
        const u = uDoc.data();
        const email = String(u.email || '').trim().toLowerCase();
        existingUsersById.add(uDoc.id);
        if (email) {
          existingUsersByEmail.set(email, uDoc.id);
        }
      });

      // Mapear UIDs reales si los usuarios ya se registraron
      const baseAccountUids = new Set<string>();

      for (const acc of BASE_ACCOUNTS_CONFIG) {
        const lowerEmail = acc.email.toLowerCase();
        const existingUid = existingUsersByEmail.get(lowerEmail);
        const targetUid = existingUid || acc.id;
        baseAccountUids.add(targetUid);

        if (acc.role === 'supervisor') {
          activeSupervisorUid = targetUid;
        }
      }

      // Actualizar o crear las 5 cuentas oficiales en Firestore
      for (const acc of BASE_ACCOUNTS_CONFIG) {
        const lowerEmail = acc.email.toLowerCase();
        const existingUid = existingUsersByEmail.get(lowerEmail);
        const finalUid = existingUid || acc.id;

        const docRef = doc(firestore, 'users', finalUid);
        const payload = {
          uid: finalUid,
          id: finalUid,
          email: acc.email,
          name: acc.name,
          firstName: acc.firstName,
          lastName: acc.lastName,
          role: acc.role,
          roleTitle: acc.roleTitle,
          teamId: acc.teamId,
          team: acc.team,
          teamName: acc.teamName,
          assignedTeams: acc.assignedTeams,
          status: 'active',
          isActive: true,
          isProfileComplete: true,
          verified: true,
          supervisorId: acc.role === 'colaborador' ? activeSupervisorUid : acc.supervisorId,
          supervisorName: acc.role === 'colaborador' ? 'Supervisor Prueba' : acc.supervisorName,
          permissions: getDefaultPermissionsForRole(acc.role),
          modules: getDefaultModulesForRole(acc.role),
          accessRevoked: false,
          updatedAt: new Date().toISOString(),
          cleanSlateResetAt: new Date().toISOString(),
        };

        await setDoc(docRef, payload, { merge: true });
        result.usersNormalized++;
      }

      // Eliminar usuarios residuales que no pertenezcan a las 5 cuentas base
      const deleteUserBatch = writeBatch(firestore);
      let usersToDeleteCount = 0;

      usersSnap.forEach((uDoc) => {
        if (!baseAccountUids.has(uDoc.id)) {
          deleteUserBatch.delete(uDoc.ref);
          usersToDeleteCount++;
        }
      });

      if (usersToDeleteCount > 0) {
        await deleteUserBatch.commit();
      }
      result.usersDeleted = usersToDeleteCount;

      // 3. Normalizar colección 'teams'
      const teamsSnap = await getDocs(collection(firestore, 'teams'));
      const teamBatch = writeBatch(firestore);

      teamsSnap.forEach((tDoc) => {
        if (tDoc.id !== 'team-prueba-01') {
          teamBatch.delete(tDoc.ref);
          result.teamsDeleted++;
        }
      });

      const singleTeamDoc: Team = {
        id: 'team-prueba-01',
        name: 'Equipo Prueba',
        code: 'EQ-PRU-01',
        leaderId: activeSupervisorUid,
        leaderName: 'Supervisor Prueba',
        leaderRole: 'Supervisor',
        memberIds: [],
        status: 'active',
        description: 'Equipo único de operaciones y pruebas corporativas',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      teamBatch.set(doc(firestore, 'teams', 'team-prueba-01'), singleTeamDoc, { merge: true });
      await teamBatch.commit();
      result.teamsPreserved = 1;
    }

    // 4. Limpiar Stores locales (Zustand) y LocalStorage
    // useRayonerStore
    useRayonerStore.setState({
      tasks: [],
      projects: [],
      clients: [],
      assignments: [],
      activeWorkers: [],
      taskActualHours: {},
      userTaskActualHours: {},
      teamMembers: BASE_ACCOUNTS_CONFIG.map((acc) => ({
        id: acc.id,
        name: acc.name,
        email: acc.email,
        role: acc.role === 'colaborador' ? 'Empleado' : ((acc.role.charAt(0).toUpperCase() + acc.role.slice(1)) as any),
        roleTitle: acc.roleTitle,
        team: acc.team || 'Sin equipo asignado',
        teamId: acc.teamId || undefined,
        status: 'active',
        workedMinutesToday: 0,
        entryTime: '09:00',
        isLate: false,
        minutesLate: 0,
        allowedClientIds: [],
      })),
    });

    // useTeamStore
    const localTeam: Team = {
      id: 'team-prueba-01',
      name: 'Equipo Prueba',
      code: 'EQ-PRU-01',
      leaderId: activeSupervisorUid,
      leaderName: 'Supervisor Prueba',
      leaderRole: 'Supervisor',
      memberIds: [],
      status: 'active',
      description: 'Equipo único de operaciones y pruebas corporativas',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    useTeamStore.setState({
      teams: [localTeam],
      hasLoadedFromRemote: true,
      isLoading: false,
    });

    // useCheckinStore
    const newDirectory: Record<string, any> = {};
    BASE_ACCOUNTS_CONFIG.forEach((acc) => {
      newDirectory[acc.id] = {
        id: acc.id,
        name: acc.name,
        email: acc.email,
        role: acc.role,
        team: acc.team || 'Sin equipo',
        teamName: acc.teamName || 'Sin equipo',
        teamId: acc.teamId || undefined,
        assignedTeams: acc.assignedTeams,
        permissions: getDefaultPermissionsForRole(acc.role),
        modules: getDefaultModulesForRole(acc.role),
        biometrics: null,
        accessRevoked: false,
        supervisor_id: acc.supervisorId || undefined,
      };
    });

    useCheckinStore.setState({
      history: [],
      userHistories: {},
      userActiveCheckins: {},
      activeCheckin: null,
      userPermissionsDirectory: newDirectory,
      mockEmployeesData: BASE_ACCOUNTS_CONFIG.map((acc) => ({
        id: acc.id,
        email: acc.email,
        name: acc.name,
        role: acc.role,
        team: acc.team || 'Sin equipo (Acceso Global)',
        teamId: acc.teamId || undefined,
        assignedTeams: acc.assignedTeams,
        status: 'active' as const,
        isProfileComplete: true,
        workedMinutesToday: 0,
        expectedEntryTime: '09:00',
        supervisor_id: acc.supervisorId || undefined,
        modules: getDefaultModulesForRole(acc.role),
        history: [],
      })),
    });

    // useInvitationStore
    useInvitationStore.setState({ invitations: [] });

    // useAuditStore
    useAuditStore.setState({ logs: [] });

    // useNotificationStore
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });

    // Limpiar claves operativas de localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove = [
        'rb_active_task_id',
        'rb_task_timer_running',
        'rb_active_task_timestamp',
        'rb_time_adjustment_history',
        'checkin-rb-audit-logs-v1',
      ];
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    }

    result.success = true;
    return result;
  } catch (error: any) {
    console.error('[CleanSlate] Error durante el reinicio administrativo:', error);
    result.error = error?.message || 'Error desconocido';
    result.success = false;
    return result;
  }
}
