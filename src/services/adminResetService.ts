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
 * 6 Cuentas Oficiales de Prueba enlazadas bajo la jerarquía corporativa:
 * TI (Nivel 0) -> Socio (Nivel 1) -> [Gerente (Nivel 2) || RH (Nivel 2 Lateral)] -> Supervisor (Nivel 3) -> Colaborador (Nivel 4)
 */
export const BASE_ACCOUNTS_CONFIG = [
  {
    id: 'ti-root-01',
    email: 'ti.root@russellbedford.mx',
    name: 'TI Prueba',
    firstName: 'TI',
    lastName: 'Prueba',
    role: 'ti' as UserRole,
    hierarchyLevel: 0 as const,
    roleTitle: 'Administrador TI (Root)',
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
    id: 'socio-01',
    email: 'socio.prueba@russellbedford.mx',
    name: 'Socio Prueba',
    firstName: 'Socio',
    lastName: 'Prueba',
    role: 'socio' as UserRole,
    hierarchyLevel: 1 as const,
    roleTitle: 'Socio Director (Nivel 1)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'ti-root-01',
    supervisorId: null,
    supervisorName: null,
    gerenteId: null,
    socioId: null,
  },
  {
    id: 'gerente-01',
    email: 'gerente.prueba@russellbedford.mx',
    name: 'Gerente Prueba',
    firstName: 'Gerente',
    lastName: 'Prueba',
    role: 'gerente' as UserRole,
    hierarchyLevel: 2 as const,
    roleTitle: 'Gerente de Práctica (Nivel 2)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'socio-01',
    supervisorId: null,
    supervisorName: null,
    gerenteId: null,
    socioId: 'socio-01',
  },
  {
    id: 'rh-01',
    email: 'rh.prueba@russellbedford.mx',
    name: 'RH Prueba',
    firstName: 'RH',
    lastName: 'Prueba',
    role: 'rh' as UserRole,
    hierarchyLevel: 2 as const,
    roleTitle: 'Recursos Humanos (Nivel 2 Lateral)',
    teamId: null,
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'socio-01',
    supervisorId: null,
    supervisorName: null,
    gerenteId: null,
    socioId: 'socio-01',
  },
  {
    id: 'supervisor-01',
    email: 'supervisor.prueba@russellbedford.mx',
    name: 'Supervisor Prueba',
    firstName: 'Supervisor',
    lastName: 'Prueba',
    role: 'supervisor' as UserRole,
    hierarchyLevel: 3 as const,
    roleTitle: 'Supervisor Líder (Nivel 3)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'gerente-01',
    supervisorId: null,
    supervisorName: null,
    gerenteId: 'gerente-01',
    socioId: 'socio-01',
  },
  {
    id: 'colaborador-01',
    email: 'colaborador.prueba@russellbedford.mx',
    name: 'Colaborador Prueba',
    firstName: 'Colaborador',
    lastName: 'Prueba',
    role: 'colaborador' as UserRole,
    hierarchyLevel: 4 as const,
    roleTitle: 'Colaborador Operativo (Nivel 4)',
    teamId: 'team-prueba-01',
    team: 'Equipo Prueba',
    teamName: 'Equipo Prueba',
    assignedTeams: ['team-prueba-01'],
    status: 'active' as const,
    isActive: true,
    isProfileComplete: true,
    verified: true,
    reportsTo: 'supervisor-01',
    supervisorId: 'supervisor-01',
    supervisorName: 'Supervisor Prueba',
    gerenteId: 'gerente-01',
    socioId: 'socio-01',
  },
];

/**
 * Ejecuta la Purga Total de Datos y Reinicio en Blanco (Clean Slate)
 * 1. Vacía todas las colecciones operativas en Firestore:
 *    tasks, companies, clients, projects, attendance, checkins, time_logs, active_timers, invitations, audit_logs, notifications
 * 2. Deja en `teams` únicamente `team-prueba-01` ("Equipo Prueba") enlazado a Supervisor Prueba y Gerente Prueba
 * 3. Configura exclusivamente las 6 cuentas base de prueba enlazadas jerárquicamente en `users`:
 *    TI (0) -> Socio (1) -> [Gerente (2) || RH (2 Lateral)] -> Supervisor (3) -> Colaborador (4)
 * 4. Purga cachés locales (Zustand, localStorage y sessionStorage)
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
    let activeTiUid = 'ti-root-01';
    let activeSocioUid = 'socio-01';
    let activeGerenteUid = 'gerente-01';
    let activeSupervisorUid = 'supervisor-01';
    let activeColaboradorUid = 'colaborador-01';

    if (isRemote && firestore) {
      // 1. Vaciar colecciones operativas en Firestore
      const operationalCollections = [
        'tasks',
        'companies',
        'clients',
        'projects',
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
            // Procesar en lotes de hasta 450 docs para respetar el límite de writeBatch (500)
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
          console.warn(`[CleanSlate] Error vaciando colección ${colName}:`, colErr);
          result.collectionsCleared[colName] = 0;
        }
      }

      // 2. Resolver UIDs reales de las 6 cuentas base en `users`
      const usersSnap = await getDocs(collection(firestore, 'users'));
      const existingUsersByEmail = new Map<string, string>();

      usersSnap.forEach((uDoc) => {
        const u = uDoc.data();
        const email = String(u.email || '').trim().toLowerCase();
        if (email) {
          existingUsersByEmail.set(email, uDoc.id);
        }
      });

      const resolvedUidByRole = new Map<string, string>();
      const baseAccountUids = new Set<string>();

      for (const acc of BASE_ACCOUNTS_CONFIG) {
        const lowerEmail = acc.email.toLowerCase();
        const finalUid = existingUsersByEmail.get(lowerEmail) || acc.id;
        resolvedUidByRole.set(acc.role, finalUid);
        baseAccountUids.add(finalUid);
      }

      activeTiUid = resolvedUidByRole.get('ti') || 'ti-root-01';
      activeSocioUid = resolvedUidByRole.get('socio') || 'socio-01';
      activeGerenteUid = resolvedUidByRole.get('gerente') || 'gerente-01';
      activeSupervisorUid = resolvedUidByRole.get('supervisor') || 'supervisor-01';
      activeColaboradorUid = resolvedUidByRole.get('colaborador') || 'colaborador-01';

      // 3. Escribir las 6 cuentas base explícitamente enlazadas en Firestore
      const nowIso = new Date().toISOString();
      for (const acc of BASE_ACCOUNTS_CONFIG) {
        const finalUid = resolvedUidByRole.get(acc.role) || acc.id;

        let reportsTo: string | null = null;
        let supervisorId: string | null = null;
        let supervisorName: string | null = null;
        let gerenteId: string | null = null;
        let socioId: string | null = null;

        if (acc.role === 'ti') {
          reportsTo = null;
        } else if (acc.role === 'socio') {
          reportsTo = activeTiUid;
        } else if (acc.role === 'gerente') {
          reportsTo = activeSocioUid;
          socioId = activeSocioUid;
        } else if (acc.role === 'rh') {
          reportsTo = activeSocioUid;
          socioId = activeSocioUid;
        } else if (acc.role === 'supervisor') {
          reportsTo = activeGerenteUid;
          gerenteId = activeGerenteUid;
          socioId = activeSocioUid;
        } else if (acc.role === 'colaborador') {
          reportsTo = activeSupervisorUid;
          supervisorId = activeSupervisorUid;
          supervisorName = 'Supervisor Prueba';
          gerenteId = activeGerenteUid;
          socioId = activeSocioUid;
        }

        const docRef = doc(firestore, 'users', finalUid);
        const payload = {
          uid: finalUid,
          id: finalUid,
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
          reportsTo,
          supervisorId,
          supervisor_id: supervisorId,
          supervisorName,
          gerenteId,
          managerId: gerenteId,
          socioId,
          partnerId: socioId,
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

      // Eliminar cualquier usuario residual fuera de las 6 cuentas oficiales
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

      // 4. Normalizar colección `teams`
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
        parentLeaderId: activeGerenteUid,
        memberIds: [activeColaboradorUid],
        status: 'active',
        description: 'Equipo operativo base vinculado a Gerente Prueba y Socio Prueba',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      teamBatch.set(doc(firestore, 'teams', 'team-prueba-01'), singleTeamDoc, { merge: false });
      await teamBatch.commit();
      result.teamsPreserved = 1;
    }

    // 5. Purga completa de stores locales (Zustand) -> 0 empresas, 0 tareas, 0 checadas
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
        status: 'active',
        workedMinutesToday: 0,
        entryTime: '09:00',
        isLate: false,
        minutesLate: 0,
        allowedClientIds: [],
      })),
    });

    const localTeam: Team = {
      id: 'team-prueba-01',
      name: 'Equipo Prueba',
      code: 'EQ-PRU-01',
      leaderId: activeSupervisorUid,
      leaderName: 'Supervisor Prueba',
      leaderRole: 'Supervisor',
      parentLeaderId: activeGerenteUid,
      memberIds: [activeColaboradorUid],
      status: 'active',
      description: 'Equipo operativo base vinculado a Gerente Prueba y Socio Prueba',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
        team: acc.team || 'Sin equipo',
        teamName: acc.teamName || 'Sin equipo',
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

    useInvitationStore.setState({ invitations: [] });
    useAuditStore.setState({ logs: [] });
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });

    // 6. Limpiar claves operativas en localStorage y sessionStorage
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
              k.includes('notifications'))
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
    console.error('[CleanSlate] Error durante el reinicio administrativo:', error);
    result.error = error?.message || 'Error desconocido';
    result.success = false;
    return result;
  }
}
