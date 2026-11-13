import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { Team } from '../types/team';
import { useCheckinStore } from '../store/useCheckinStore';
import { useRayonerStore } from '../store/useRayonerStore';

function withTimeout<T>(promise: Promise<T>, ms = 2500, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(fallback);
      }
    }, ms);

    promise
      .then((val) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

export function generateTeamCode(name: string, count = 1): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  let prefix = 'EQ';
  if (words.length === 1) {
    prefix = `EQ-${words[0].substring(0, 3)}`;
  } else if (words.length === 2) {
    prefix = `EQ-${words[0].substring(0, 2)}${words[1].substring(0, 2)}`;
  } else if (words.length >= 3) {
    prefix = `EQ-${words.slice(0, 3).map((w) => w[0]).join('')}`;
  }

  const paddedNum = String(count).padStart(2, '0');
  return `${prefix}-${paddedNum}`;
}

/**
 * Consulta unificada y resiliente de todos los equipos del sistema:
 * 1. Lee la colección 'teams' en Firestore sin filtros restrictivos.
 * 2. Examina la colección 'users' para descubrir equipos asignados a usuarios (ej. teamName, team, assignedTeams).
 * 3. Incorpora el directorio y almacén local (userPermissionsDirectory, mockEmployeesData, teamMembers).
 * 4. Migra y guarda en Firestore cualquier equipo detectado que falte (como "Equipo Prueba").
 */
export async function fetchTeamsFromFirestore(): Promise<Team[]> {
  const teamsMap = new Map<string, Team>();

  // 1. Equipos directos desde la colección 'teams' de Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const teamsCollection = collection(db, 'teams');
      const fetchTeamsPromise = getDocs(teamsCollection).then((snapshot) => {
        const teams: Team[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data) return;
          const name = (data.name || '').trim();
          if (!name) return;

          teams.push({
            id: docSnap.id,
            name,
            code: data.code || generateTeamCode(name),
            leaderId: data.leaderId || '',
            leaderName: data.leaderName || '',
            leaderRole: data.leaderRole || 'Supervisor',
            memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
            status: data.status === 'inactive' ? 'inactive' : 'active',
            description: data.description || '',
            parentLeaderId: data.parentLeaderId || '',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
        });
        return teams;
      });

      const teamsFromFirestore = await withTimeout(fetchTeamsPromise, 2500, []);
      console.log(`[teamService] Colección 'teams' de Firestore devolvió ${teamsFromFirestore.length} equipos:`, teamsFromFirestore);

      teamsFromFirestore.forEach((t) => {
        teamsMap.set(t.name.toLowerCase().trim(), t);
      });
    } catch (err) {
      console.warn('[teamService] Error al consultar colección "teams":', err);
    }

    // 2. Fallback / Descubrimiento automático desde la colección 'users' en Firestore
    try {
      const usersCollection = collection(db, 'users');
      const fetchUsersPromise = getDocs(usersCollection).then((snapshot) => {
        const userDocs: Array<Record<string, any>> = [];
        snapshot.forEach((docSnap) => {
          userDocs.push({ id: docSnap.id, ...docSnap.data() });
        });
        return userDocs;
      });

      const usersFromFirestore = await withTimeout(fetchUsersPromise, 2500, []);
      console.log(`[teamService] Colección 'users' de Firestore devolvió ${usersFromFirestore.length} documentos para escaneo de equipos.`);

      usersFromFirestore.forEach((u) => {
        const rawTeams: string[] = [];
        if (u.team) rawTeams.push(u.team);
        if (u.teamName) rawTeams.push(u.teamName);
        if (u.equipo) rawTeams.push(u.equipo);
        if (Array.isArray(u.assignedTeams)) {
          u.assignedTeams.forEach((t: string) => {
            if (typeof t === 'string' && t.trim()) rawTeams.push(t.trim());
          });
        }

        rawTeams.forEach((tName) => {
          const cleanName = tName.trim();
          if (!cleanName || cleanName.toLowerCase().includes('ti root')) return;
          const key = cleanName.toLowerCase();

          if (!teamsMap.has(key)) {
            const isLeader = ['supervisor', 'gerente', 'socio'].includes(String(u.role || '').toLowerCase());
            const newTeam: Team = {
              id: u.teamId || `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: cleanName,
              code: generateTeamCode(cleanName, teamsMap.size + 1),
              leaderId: isLeader ? u.id : (u.supervisorId || u.supervisor_id || ''),
              leaderName: isLeader ? (u.name || 'Supervisor Asignado') : (u.supervisorName || 'Supervisor Asignado'),
              leaderRole: isLeader ? (u.role || 'Supervisor') : 'Supervisor',
              memberIds: isLeader ? [] : [u.id],
              status: 'active',
              description: `Equipo extraído automáticamente de perfil de usuario (${cleanName})`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            teamsMap.set(key, newTeam);
            console.log(`[teamService] Equipo descubierto desde 'users' Firestore y migrado: "${cleanName}" (${newTeam.code})`);
            saveTeamToFirestore(newTeam).catch(console.warn);
          } else {
            const existing = teamsMap.get(key)!;
            const isLeader = ['supervisor', 'gerente', 'socio'].includes(String(u.role || '').toLowerCase());
            if (isLeader && !existing.leaderId) {
              existing.leaderId = u.id;
              existing.leaderName = u.name || existing.leaderName;
              existing.leaderRole = u.role || existing.leaderRole;
            }
          }
        });
      });
    } catch (err) {
      console.warn('[teamService] Error al escanear usuarios en Firestore para descubrir equipos:', err);
    }
  }

  // 3. Respaldo de Almacén Local / Memoria (userPermissionsDirectory, mockEmployeesData, teamMembers)
  try {
    const checkinState = useCheckinStore.getState();
    const rayonerState = useRayonerStore.getState();

    const localUsers: Array<{
      id: string;
      name: string;
      role: string;
      team?: string;
      teamName?: string;
      assignedTeams?: string[];
      supervisorId?: string | null;
    }> = [];

    // Directorio de usuarios de TI
    if (checkinState.userPermissionsDirectory) {
      Object.values(checkinState.userPermissionsDirectory).forEach((u) => {
        localUsers.push({
          id: u.id,
          name: u.name,
          role: String(u.role || ''),
          team: u.team,
          assignedTeams: u.assignedTeams,
        });
      });
    }

    // Miembros de Rayoner
    if (rayonerState.teamMembers) {
      rayonerState.teamMembers.forEach((m) => {
        localUsers.push({
          id: m.id,
          name: m.name,
          role: String(m.role || ''),
          team: m.team,
          supervisorId: m.supervisor_id || m.supervisorId || null,
        });
      });
    }

    localUsers.forEach((u) => {
      const rawTeams: string[] = [];
      if (u.team) rawTeams.push(u.team);
      if (u.teamName) rawTeams.push(u.teamName);
      if (Array.isArray(u.assignedTeams)) {
        u.assignedTeams.forEach((t) => rawTeams.push(t));
      }

      rawTeams.forEach((tName) => {
        const cleanName = tName.trim();
        if (!cleanName || cleanName.toLowerCase().includes('ti root')) return;
        const key = cleanName.toLowerCase();

        if (!teamsMap.has(key)) {
          const isLeader = ['supervisor', 'gerente', 'socio'].includes(u.role.toLowerCase());
          const newTeam: Team = {
            id: cleanName === 'Equipo Prueba' ? 'team-prueba-01' : `team_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: cleanName,
            code: cleanName === 'Equipo Prueba' ? 'EQ-PRU-01' : generateTeamCode(cleanName, teamsMap.size + 1),
            leaderId: isLeader ? u.id : 'admin-99',
            leaderName: isLeader ? u.name : 'Supervisor Prueba',
            leaderRole: isLeader ? u.role : 'Supervisor',
            memberIds: isLeader ? [] : [u.id],
            status: 'active',
            description: `Equipo sincronizado desde almacén operativo (${cleanName})`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          teamsMap.set(key, newTeam);
          console.log(`[teamService] Equipo detectado en almacén local y consolidado: "${cleanName}" (${newTeam.code})`);
          saveTeamToFirestore(newTeam).catch(console.warn);
        }
      });
    });
  } catch (err) {
    console.warn('[teamService] Error al incorporar almacén local de equipos:', err);
  }

  // 4. Garantía Absoluta de "Equipo Prueba"
  if (!teamsMap.has('equipo prueba')) {
    const equipoPrueba: Team = {
      id: 'team-prueba-01',
      name: 'Equipo Prueba',
      code: 'EQ-PRU-01',
      leaderId: 'admin-99',
      leaderName: 'Supervisor Prueba',
      leaderRole: 'Supervisor',
      memberIds: ['usr-ana'],
      status: 'active',
      description: 'Equipo de operaciones y entorno de pruebas',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    teamsMap.set('equipo prueba', equipoPrueba);
    saveTeamToFirestore(equipoPrueba).catch(console.warn);
    console.log('[teamService] "Equipo Prueba" inyectado y persistido garantizado.');
  }

  const result = Array.from(teamsMap.values());
  console.log(`[teamService] Total de equipos consolidados: ${result.length}`, result.map((t) => `${t.name} (${t.code})`));
  return result;
}

/**
 * Guarda o actualiza un equipo en Firestore
 */
export async function saveTeamToFirestore(team: Team): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;

  try {
    const teamRef = doc(db, 'teams', team.id);
    const savePromise = setDoc(
      teamRef,
      {
        id: team.id,
        name: team.name,
        code: team.code,
        leaderId: team.leaderId,
        leaderName: team.leaderName,
        leaderRole: team.leaderRole || 'Supervisor',
        memberIds: team.memberIds || [],
        status: team.status || 'active',
        description: team.description || '',
        parentLeaderId: team.parentLeaderId || '',
        createdAt: team.createdAt,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    ).then(() => true);

    return await withTimeout(savePromise, 2000, false);
  } catch (err) {
    console.warn('[teamService] Error al guardar equipo en Firestore:', err);
    return false;
  }
}

/**
 * Elimina un equipo en Firestore
 */
export async function deleteTeamFromFirestore(teamId: string): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;

  try {
    const teamRef = doc(db, 'teams', teamId);
    const deletePromise = deleteDoc(teamRef).then(() => true);
    return await withTimeout(deletePromise, 2000, false);
  } catch (err) {
    console.warn('[teamService] Error al eliminar equipo en Firestore:', err);
    return false;
  }
}
