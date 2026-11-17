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

/**
 * Mapa determinístico de correos demo a IDs fijos en Firestore
 * Evita duplicados al iniciar sesión desde distintos navegadores o sesiones Auth.
 */
export const DEMO_EMAIL_TO_FIXED_ID: Record<string, string> = {
  'ti.root@russellbedford.mx': 'demo_ti',
  'socio.prueba@russellbedford.mx': 'demo_socio',
  'gerente.prueba@russellbedford.mx': 'demo_gerente',
  'rh.prueba@russellbedford.mx': 'demo_rh',
  'supervisor.prueba@russellbedford.mx': 'demo_supervisor',
  'colaborador.prueba@russellbedford.mx': 'demo_colaborador',
};

export function getFixedDemoDocId(email?: string | null): string | null {
  if (!email) return null;
  const clean = email.trim().toLowerCase();
  return DEMO_EMAIL_TO_FIXED_ID[clean] || null;
}

/**
 * 6 Perfiles Oficiales Únicos con IDs determinísticos en Firestore:
 * - demo_ti: TI (Nivel 0 — fuera de equipos operativos)
 * - demo_socio: Socio (Nivel 1 — Nivel máximo operativo, reportsTo: null)
 * - demo_gerente: Gerente (Nivel 2 — reportsTo: "demo_socio")
 * - demo_rh: RH (Nivel 2 Lateral — reportsTo: "demo_socio")
 * - demo_supervisor: Supervisor (Nivel 3 — reportsTo: "demo_gerente")
 * - demo_colaborador: Colaborador (Nivel 4 — reportsTo: "demo_supervisor")
 */
export const BASE_ACCOUNTS_CONFIG = [
  {
    id: 'demo_ti',
    email: 'ti.root@russellbedford.mx',
    name: 'TI Prueba',
    firstName: 'TI',
    lastName: 'Prueba',
    role: 'ti' as UserRole,
    hierarchyLevel: 0 as const,
    roleTitle: 'Administrador TI',
    teamId: null,
    team: null,
    teamName: null,
    assignedTeams: [] as string[],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: null as string | null,
    supervisorId: null as string | null,
    supervisorName: null as string | null,
    gerenteId: null as string | null,
    socioId: null as string | null,
  },
  {
    id: 'demo_socio',
    email: 'socio.prueba@russellbedford.mx',
    name: 'Socio Prueba',
    firstName: 'Socio',
    lastName: 'Prueba',
    role: 'socio' as UserRole,
    hierarchyLevel: 1 as const,
    roleTitle: 'Socio (Nivel Máximo)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: null as string | null,
    supervisorId: null,
    supervisorName: null,
    gerenteId: null,
    socioId: null,
  },
  {
    id: 'demo_gerente',
    email: 'gerente.prueba@russellbedford.mx',
    name: 'Gerente Prueba',
    firstName: 'Gerente',
    lastName: 'Prueba',
    role: 'gerente' as UserRole,
    hierarchyLevel: 2 as const,
    roleTitle: 'Gerencia',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'demo_socio',
    supervisorId: null,
    supervisorName: null,
    gerenteId: null,
    socioId: 'demo_socio',
  },
  {
    id: 'demo_rh',
    email: 'rh.prueba@russellbedford.mx',
    name: 'RH Prueba',
    firstName: 'RH',
    lastName: 'Prueba',
    role: 'rh' as UserRole,
    hierarchyLevel: 2 as const,
    roleTitle: 'Recursos Humanos (Par de Gerencia)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'demo_socio',
    supervisorId: null,
    supervisorName: null,
    gerenteId: null,
    socioId: 'demo_socio',
  },
  {
    id: 'demo_supervisor',
    email: 'supervisor.prueba@russellbedford.mx',
    name: 'Supervisor Prueba',
    firstName: 'Supervisor',
    lastName: 'Prueba',
    role: 'supervisor' as UserRole,
    hierarchyLevel: 3 as const,
    roleTitle: 'Supervisión',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'demo_gerente',
    supervisorId: null,
    supervisorName: null,
    gerenteId: 'demo_gerente',
    socioId: 'demo_socio',
  },
  {
    id: 'demo_colaborador',
    email: 'colaborador.prueba@russellbedford.mx',
    name: 'Colaborador Prueba',
    firstName: 'Colaborador',
    lastName: 'Prueba',
    role: 'colaborador' as UserRole,
    hierarchyLevel: 4 as const,
    roleTitle: 'Operación',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'demo_supervisor',
    supervisorId: 'demo_supervisor',
    supervisorName: 'Supervisor Prueba',
    gerenteId: 'demo_gerente',
    socioId: 'demo_socio',
  },
];

/**
 * Ejecuta la Purga Total de Usuarios Extra, Duplicados y Datos Residuales (`resetCleanEnvironment`):
 * 1. Vacía por completo todas las colecciones operativas en Firestore:
 *    companies, clients, projects, tasks, attendance, checkins, time_logs, active_timers, invitations, audit_logs, notifications
 * 2. Depura estrictamente `users` dejando únicamente los 6 perfiles con IDs determinísticos (`demo_*`),
 *    eliminando duplicados y cuentas extra.
 * 3. Deja en `teams` únicamente `team-prueba-01` ("Equipo Prueba", código EQ-PRU-01).
 * 4. Purga cachés locales (Zustand, localStorage y sessionStorage).
 */
export async function resetCleanEnvironment(): Promise<CleanSlateResult> {
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
  const nowIso = new Date().toISOString();

  try {
    if (isRemote && firestore) {
      // 1. Vaciar colecciones operativas en Firestore
      const operationalCollections = [
        'companies',
        'clients',
        'projects',
        'tasks',
        'attendance',
        'checkins',
        'time_logs',
        'active_timers',
        'invitations',
        'audit_logs',
        'notifications',
      ];

      for (const colName of operationalCollections) {
        try {
          const snap = await getDocs(collection(firestore, colName));
          result.collectionsCleared[colName] = snap.size;

          if (!snap.empty) {
            const docsList = snap.docs;
            for (let i = 0; i < docsList.length; i += 450) {
              const batch = writeBatch(firestore);
              docsList.slice(i, i + 450).forEach((docSnap) => {
                batch.delete(docSnap.ref);
              });
              await batch.commit();
            }
          }
        } catch (colErr) {
          console.warn(`[resetCleanEnvironment] Error vaciando colección ${colName}:`, colErr);
          result.collectionsCleared[colName] = 0;
        }
      }

      // 2. Depuración estricta de `users`: escribir exactamente los 6 IDs determinísticos `demo_*`
      const fixedIds = new Set(BASE_ACCOUNTS_CONFIG.map((a) => a.id));
      const usersSnap = await getDocs(collection(firestore, 'users'));

      // Primero escribir los 6 documentos oficiales con sus enlaces exactos
      for (const acc of BASE_ACCOUNTS_CONFIG) {
        const docRef = doc(firestore, 'users', acc.id);
        const payload = {
          uid: acc.id,
          id: acc.id,
          email: acc.email,
          name: acc.name,
          firstName: acc.firstName,
          lastName: acc.lastName,
          role: acc.role,
          hierarchyLevel: acc.hierarchyLevel,
          roleTitle: acc.roleTitle,
          teamId: acc.teamId,
          team: acc.team,
          teamName: acc.teamName,
          assignedTeams: acc.assignedTeams,
          reportsTo: acc.reportsTo,
          supervisorId: acc.supervisorId,
          supervisor_id: acc.supervisorId,
          supervisorName: acc.supervisorName,
          gerenteId: acc.gerenteId,
          managerId: acc.gerenteId,
          socioId: acc.socioId,
          partnerId: acc.socioId,
          status: 'active',
          isActive: true,
          isProfileComplete: true,
          verified: true,
          permissions: getDefaultPermissionsForRole(acc.role),
          modules: getDefaultModulesForRole(acc.role),
          accessRevoked: false,
          updatedAt: nowIso,
          cleanSlateResetAt: nowIso,
        };

        await setDoc(docRef, payload, { merge: false });
        result.usersNormalized++;
      }

      // Eliminar TODOS los documentos duplicados y cuentas extra cuyo ID no sea uno de los 6 `demo_*`
      const docsToDelete = usersSnap.docs.filter((uDoc) => !fixedIds.has(uDoc.id));
      for (let i = 0; i < docsToDelete.length; i += 450) {
        const deleteBatch = writeBatch(firestore);
        docsToDelete.slice(i, i + 450).forEach((uDoc) => {
          deleteBatch.delete(uDoc.ref);
        });
        await deleteBatch.commit();
      }
      result.usersDeleted = docsToDelete.length;

      // 3. Normalizar colección `teams`: dejar únicamente `team-prueba-01` ("Equipo Prueba" / EQ-PRU-01)
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
        leaderId: 'demo_supervisor',
        leaderName: 'Supervisor Prueba',
        leaderRole: 'Supervisor',
        parentLeaderId: 'demo_gerente',
        memberIds: ['demo_colaborador'],
        status: 'active',
        description: 'Equipo operativo base vinculado a Gerente Prueba y Socio Prueba',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      teamBatch.set(doc(firestore, 'teams', 'team-prueba-01'), singleTeamDoc, { merge: false });
      await teamBatch.commit();
      result.teamsPreserved = 1;
    }

    // 4. Purga completa de stores locales (Zustand) -> 0 empresas, 0 tareas, 0 checadas, 6 usuarios únicos
    useRayonerStore.setState({
      groups: [],
      tasks: [],
      projects: [],
      clients: [],
      assignments: [],
      activeWorkers: [],
      geofences: {},
      taskActualHours: {},
      userTaskActualHours: {},
      teamMembers: BASE_ACCOUNTS_CONFIG.map((acc) => ({
        id: acc.id,
        name: acc.name,
        email: acc.email,
        role:
          acc.role === 'colaborador'
            ? 'Empleado'
            : ((acc.role.charAt(0).toUpperCase() + acc.role.slice(1)) as any),
        roleTitle: acc.roleTitle,
        team: acc.team || 'Sin equipo asignado',
        teamId: acc.teamId || undefined,
        assignedTeams: acc.assignedTeams,
        supervisorId: acc.supervisorId || undefined,
        supervisor_id: acc.supervisorId || undefined,
        status: 'active' as const,
        workedMinutesToday: 0,
        isLate: false,
        minutesLate: 0,
        allowedClientIds: [],
      })),
    });

    const localTeam: Team = {
      id: 'team-prueba-01',
      name: 'Equipo Prueba',
      code: 'EQ-PRU-01',
      leaderId: 'demo_supervisor',
      leaderName: 'Supervisor Prueba',
      leaderRole: 'Supervisor',
      parentLeaderId: 'demo_gerente',
      memberIds: ['demo_colaborador'],
      status: 'active',
      description: 'Equipo operativo base vinculado a Gerente Prueba y Socio Prueba',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    useTeamStore.setState({
      teams: [localTeam],
      hasLoadedFromRemote: true,
      isLoading: false,
    });

    const newDirectory: Record<string, any> = {};
    BASE_ACCOUNTS_CONFIG.forEach((acc) => {
      newDirectory[acc.id] = {
        id: acc.id,
        name: acc.name,
        email: acc.email,
        role: acc.role,
        hierarchyLevel: acc.hierarchyLevel,
        team: acc.team || undefined,
        teamName: acc.teamName || undefined,
        teamId: acc.teamId || undefined,
        assignedTeams: acc.assignedTeams,
        reportsTo: acc.reportsTo,
        supervisorId: acc.supervisorId,
        supervisor_id: acc.supervisorId || undefined,
        gerenteId: acc.gerenteId,
        managerId: acc.gerenteId,
        socioId: acc.socioId,
        partnerId: acc.socioId,
        permissions: getDefaultPermissionsForRole(acc.role),
        modules: getDefaultModulesForRole(acc.role),
        biometrics: null,
        accessRevoked: false,
      };
    });

    const currentSessionEmail = useCheckinStore.getState().user?.email?.trim().toLowerCase();
    const matchedCurrent = BASE_ACCOUNTS_CONFIG.find((a) => a.email === currentSessionEmail);

    useCheckinStore.setState((prev) => ({
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
      user:
        prev.user && matchedCurrent
          ? {
              ...prev.user,
              id: matchedCurrent.id,
              name: matchedCurrent.firstName,
              lastName: matchedCurrent.lastName,
              role: matchedCurrent.role,
              hierarchyLevel: matchedCurrent.hierarchyLevel,
              reportsTo: matchedCurrent.reportsTo,
              team: matchedCurrent.team || undefined,
              teamName: matchedCurrent.teamName || undefined,
              teamId: matchedCurrent.teamId || undefined,
              assignedTeams: matchedCurrent.assignedTeams,
              supervisorId: matchedCurrent.supervisorId,
              supervisor_id: matchedCurrent.supervisorId,
              gerenteId: matchedCurrent.gerenteId,
              managerId: matchedCurrent.gerenteId,
              socioId: matchedCurrent.socioId,
              partnerId: matchedCurrent.socioId,
            }
          : prev.user,
    }));

    useInvitationStore.setState({ invitations: [] });
    useAuditStore.setState({ logs: [] });
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });

    // 5. Limpiar claves operativas en localStorage y sessionStorage
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        const keysToDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (
            k &&
            (k.startsWith('rb_') ||
              k.includes('audit-logs') ||
              k.includes('rayoner') ||
              k.includes('invitations') ||
              k.includes('notifications') ||
              k.includes('checkin-storage') ||
              k.includes('team-storage'))
          ) {
            keysToDelete.push(k);
          }
        }
        keysToDelete.forEach((k) => window.localStorage.removeItem(k));
      }
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
    }

    result.success = true;
    return result;
  } catch (error: any) {
    console.error('[resetCleanEnvironment] Error durante el reinicio limpio:', error);
    result.error = error?.message || 'Error desconocido';
    result.success = false;
    return result;
  }
}

export const executeCleanSlateAdministrativeReset = resetCleanEnvironment;
