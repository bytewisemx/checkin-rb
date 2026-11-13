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

export interface NormalizationSummary {
  teamsDeleted: number;
  teamsCreated: number;
  usersUpdated: number;
  supervisorUid: string;
}

/**
 * Normalización Única de Datos en Firestore:
 * 1. Asegura que en 'teams' exista únicamente 'team-prueba-01' ("Equipo Prueba").
 * 2. Elimina cualquier otro equipo residual.
 * 3. Normaliza 'users':
 *    - TI: teamId: null, teamName: null, assignedTeams: []
 *    - Supervisor Prueba, Empleado Prueba, Oscar Arath Thomason Blanco: teamId: "team-prueba-01", teamName: "Equipo Prueba", status: "active"
 *    - RH: assignedTeams: ["team-prueba-01"], teamNames: ["Equipo Prueba"], status: "active"
 */
export async function normalizeCorporateDatabase(): Promise<NormalizationSummary> {
  const summary: NormalizationSummary = {
    teamsDeleted: 0,
    teamsCreated: 0,
    usersUpdated: 0,
    supervisorUid: '',
  };

  const firestore = db;
  const isRemoteAvailable = Boolean(isFirebaseConfigured() && firestore);

  // 1. Escanear 'users' en Firestore si está disponible, o en almacén local
  let foundSupervisorUid = 'admin-99';
  const usersToUpdate: Array<{
    id: string;
    patch: Record<string, any>;
  }> = [];

  if (isRemoteAvailable && firestore) {
    try {
      const usersSnap = await getDocs(collection(firestore, 'users'));
      usersSnap.forEach((uDoc) => {
        const u = uDoc.data();
        const role = String(u.role || '').toLowerCase();
        const name = String(u.name || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();

        // Supervisor Prueba
        if (role === 'supervisor' || name.includes('supervisor') || email.includes('supervisor')) {
          foundSupervisorUid = uDoc.id;
          usersToUpdate.push({
            id: uDoc.id,
            patch: {
              teamId: 'team-prueba-01',
              teamName: 'Equipo Prueba',
              team: 'Equipo Prueba',
              status: 'active',
              isActive: true,
              role: 'Supervisor',
              updatedAt: new Date().toISOString(),
            },
          });
        }
        // TI Prueba
        else if (role === 'ti' || name.includes('ti root') || email.includes('ti.') || email === 'admin@bytewise.mx') {
          usersToUpdate.push({
            id: uDoc.id,
            patch: {
              teamId: null,
              teamName: null,
              team: null,
              assignedTeams: [],
              status: 'active',
              isActive: true,
              role: 'TI',
              updatedAt: new Date().toISOString(),
            },
          });
        }
        // Socio Prueba
        else if (role === 'socio' || name.includes('socio') || email.includes('socio')) {
          usersToUpdate.push({
            id: uDoc.id,
            patch: {
              teamId: 'team-prueba-01',
              teamName: 'Equipo Prueba',
              team: 'Equipo Prueba',
              assignedTeams: ['team-prueba-01'],
              status: 'active',
              isActive: true,
              role: 'socio',
              updatedAt: new Date().toISOString(),
            },
          });
        }
        // Gerente Prueba
        else if (role === 'gerente' || name.includes('gerente') || email.includes('gerente')) {
          usersToUpdate.push({
            id: uDoc.id,
            patch: {
              teamId: 'team-prueba-01',
              teamName: 'Equipo Prueba',
              team: 'Equipo Prueba',
              assignedTeams: ['team-prueba-01'],
              status: 'active',
              isActive: true,
              role: 'gerente',
              updatedAt: new Date().toISOString(),
            },
          });
        }
        // RH Prueba
        else if (role === 'rh' || name.includes('rh') || email.includes('rh.')) {
          usersToUpdate.push({
            id: uDoc.id,
            patch: {
              teamId: null,
              teamName: 'Equipo Prueba',
              team: 'Equipo Prueba',
              assignedTeams: ['team-prueba-01'],
              teamNames: ['Equipo Prueba'],
              status: 'active',
              isActive: true,
              role: 'RH',
              updatedAt: new Date().toISOString(),
            },
          });
        }
        // Oscar Arath Thomason Blanco o Empleado Prueba
        else if (
          name.includes('oscar') ||
          email.includes('oscar') ||
          name.includes('empleado') ||
          email.includes('empleado') ||
          email.includes('ana') ||
          role === 'colaborador' ||
          role === 'empleado'
        ) {
          usersToUpdate.push({
            id: uDoc.id,
            patch: {
              teamId: 'team-prueba-01',
              teamName: 'Equipo Prueba',
              team: 'Equipo Prueba',
              status: 'active',
              isActive: true,
              role: 'Colaborador',
              updatedAt: new Date().toISOString(),
            },
          });
        }
      });
    } catch (err) {
      console.warn('[dataNormalizationService] Error al consultar usuarios en Firestore:', err);
    }
  }

  summary.supervisorUid = foundSupervisorUid;

  // 2. Normalizar colección 'teams' en Firestore
  const equipoPruebaDoc: Team = {
    id: 'team-prueba-01',
    name: 'Equipo Prueba',
    code: 'EQ-PRU-01',
    leaderId: foundSupervisorUid,
    leaderName: 'Supervisor Prueba',
    leaderRole: 'Supervisor',
    memberIds: [],
    status: 'active',
    description: 'Equipo único de operaciones y pruebas corporativas',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isRemoteAvailable && firestore) {
    try {
      const teamsSnap = await getDocs(collection(firestore, 'teams'));
      const batch = writeBatch(firestore);

      // Eliminar equipos residuales
      teamsSnap.forEach((tDoc) => {
        if (tDoc.id !== 'team-prueba-01') {
          batch.delete(doc(firestore, 'teams', tDoc.id));
          summary.teamsDeleted++;
        }
      });

      // Guardar o sobreescribir 'team-prueba-01'
      const equipoPruebaRef = doc(firestore, 'teams', 'team-prueba-01');
      batch.set(equipoPruebaRef, equipoPruebaDoc, { merge: true });
      summary.teamsCreated = 1;

      // Aplicar patches de usuarios
      usersToUpdate.forEach((item) => {
        const uRef = doc(firestore, 'users', item.id);
        batch.set(uRef, item.patch, { merge: true });
        summary.usersUpdated++;
      });

      await batch.commit();
      console.log('[dataNormalizationService] Transacción de normalización en Firestore completada exitosamente:', summary);
    } catch (err) {
      console.error('[dataNormalizationService] Error en transacción de Firestore:', err);
      // Fallback setDoc puntual
      try {
        await setDoc(doc(firestore, 'teams', 'team-prueba-01'), equipoPruebaDoc, { merge: true });
      } catch (e) {
        console.warn('[dataNormalizationService] Error en setDoc fallback:', e);
      }
    }
  }

  // 3. Normalizar almacenes locales (Zustand)
  try {
    // useTeamStore
    useTeamStore.setState({
      teams: [equipoPruebaDoc],
      hasLoadedFromRemote: true,
      isLoading: false,
    });

    // useCheckinStore
    const checkinState = useCheckinStore.getState();
    const nextDir = { ...checkinState.userPermissionsDirectory };

    Object.keys(nextDir).forEach((uid) => {
      const entry = nextDir[uid];
      const r = String(entry.role || '').toLowerCase();
      const n = String(entry.name || '').toLowerCase();
      const em = String(entry.email || '').toLowerCase();

      if (r === 'ti' || n.includes('ti') || em.includes('ti.')) {
        nextDir[uid] = {
          ...entry,
          team: undefined,
          teamId: undefined,
          assignedTeams: [],
          accessRevoked: false,
        };
      } else if (r === 'rh' || n.includes('rh') || em.includes('rh.')) {
        nextDir[uid] = {
          ...entry,
          team: 'Equipo Prueba',
          teamId: undefined,
          assignedTeams: ['team-prueba-01'],
          accessRevoked: false,
        };
      } else {
        nextDir[uid] = {
          ...entry,
          team: 'Equipo Prueba',
          teamId: 'team-prueba-01',
          accessRevoked: false,
        };
      }
    });

    const nextMock = checkinState.mockEmployeesData.map((emp) => {
      const r = String(emp.role || '').toLowerCase();
      const n = String(emp.name || '').toLowerCase();
      const em = String(emp.email || '').toLowerCase();

      if (r === 'ti' || n.includes('ti') || em.includes('ti.')) {
        return {
          ...emp,
          team: 'Sin equipo (Acceso Global)',
          status: 'active' as const,
          assignedTeams: [],
        };
      } else if (r === 'rh' || n.includes('rh') || em.includes('rh.')) {
        return {
          ...emp,
          team: 'Equipo Prueba',
          status: 'active' as const,
          assignedTeams: ['team-prueba-01'],
        };
      } else {
        return {
          ...emp,
          team: 'Equipo Prueba',
          teamId: 'team-prueba-01',
          status: 'active' as const,
        };
      }
    });

    let nextUser = checkinState.user;
    if (nextUser) {
      const r = String(nextUser.role || '').toLowerCase();
      if (r === 'ti') {
        nextUser = {
          ...nextUser,
          team: undefined,
          teamId: undefined,
          assignedTeams: [],
          status: 'active',
          isActive: true,
          accessRevoked: false,
        };
      } else if (r === 'rh') {
        nextUser = {
          ...nextUser,
          team: 'Equipo Prueba',
          teamId: undefined,
          assignedTeams: ['team-prueba-01'],
          status: 'active',
          isActive: true,
          accessRevoked: false,
        };
      } else {
        nextUser = {
          ...nextUser,
          team: 'Equipo Prueba',
          teamId: 'team-prueba-01',
          status: 'active',
          isActive: true,
          accessRevoked: false,
        };
      }
    }

    useCheckinStore.setState({
      userPermissionsDirectory: nextDir,
      mockEmployeesData: nextMock,
      user: nextUser,
    });

    // useRayonerStore
    const rayonerState = useRayonerStore.getState();
    if (rayonerState.teamMembers) {
      const updatedMembers = rayonerState.teamMembers.map((m) => {
        const r = String(m.role || '').toLowerCase();
        if (r === 'ti') {
          return { ...m, team: 'Sin equipo (Acceso Global)', status: 'active' as const };
        }
        return {
          ...m,
          team: 'Equipo Prueba',
          teamId: 'team-prueba-01',
          status: 'active' as const,
        };
      });
      useRayonerStore.setState({ teamMembers: updatedMembers });
    }
  } catch (err) {
    console.warn('[dataNormalizationService] Error al actualizar almacenes locales:', err);
  }

  return summary;
}

