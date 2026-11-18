import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
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
 * Consulta de equipos del sistema:
 * ÚNICA FUENTE DE VERDAD: Colección 'teams' de Firestore.
 * NO recrea equipos automáticamente a partir de campos en 'users' ni tiendas locales.
 */
export async function fetchTeamsFromFirestore(): Promise<Team[]> {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

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
          gerenteId: data.gerenteId || data.parentLeaderId || '',
          supervisorId: data.supervisorId || data.leaderId || '',
          leaderId: data.leaderId || data.supervisorId || '',
          leaderName: data.leaderName || '',
          leaderRole: data.leaderRole || 'Supervisor',
          memberIds: Array.isArray(data.memberIds) ? Array.from(new Set(data.memberIds)) : [],
          status: data.status === 'inactive' ? 'inactive' : 'active',
          description: data.description || '',
          parentLeaderId: data.parentLeaderId || data.gerenteId || '',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });
      return teams;
    });

    const teamsFromFirestore = await withTimeout(fetchTeamsPromise, 2500, []);
    console.log(
      `[teamService] Colección 'teams' de Firestore devolvió ${teamsFromFirestore.length} equipos como única fuente de verdad:`,
      teamsFromFirestore.map((t) => `${t.name} (${t.code})`)
    );

    // Si la colección está vacía, sembramos limpiamente "Equipo Prueba" como equipo corporativo inicial
    if (teamsFromFirestore.length === 0) {
      const initialTeam: Team = {
        id: 'team-prueba-01',
        name: 'Equipo Prueba',
        code: 'EQ-PRU-01',
        gerenteId: 'demo_gerente',
        supervisorId: 'demo_supervisor',
        leaderId: 'demo_supervisor',
        leaderName: 'Supervisor Prueba',
        leaderRole: 'Supervisor',
        memberIds: ['demo_colaborador', 'demo_supervisor', 'demo_gerente'],
        status: 'active',
        description: 'Equipo de operaciones y entorno de pruebas corporativas',
        parentLeaderId: 'demo_gerente',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveTeamToFirestore(initialTeam).catch(console.warn);
      return [initialTeam];
    }

    return teamsFromFirestore;
  } catch (err) {
    console.warn('[teamService] Error al consultar colección "teams":', err);
    return [];
  }
}

/**
 * Guarda o actualiza un equipo en Firestore con el esquema multi-equipo completo:
 * `name`, `code`, `gerenteId`, `supervisorId`, `memberIds` (array de UIDs) y `status`.
 */
export async function saveTeamToFirestore(team: Team): Promise<boolean> {
  if (!isFirebaseConfigured() || !db) return false;

  const cleanMemberIds = Array.from(
    new Set((team.memberIds || []).map((m) => String(m || '').trim()).filter(Boolean))
  );
  const supervisorId = (team.supervisorId || team.leaderId || '').trim();
  const gerenteId = (team.gerenteId || team.parentLeaderId || '').trim();

  try {
    const teamRef = doc(db, 'teams', team.id);
    const savePromise = setDoc(
      teamRef,
      {
        id: team.id,
        name: team.name,
        code: team.code,
        gerenteId,
        supervisorId,
        leaderId: team.leaderId || supervisorId,
        leaderName: team.leaderName,
        leaderRole: team.leaderRole || 'Supervisor',
        memberIds: cleanMemberIds,
        status: team.status || 'active',
        description: team.description || '',
        parentLeaderId: gerenteId,
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
 * Eliminación en cascada definitiva de un equipo:
 * 1. Borra el documento en la colección 'teams' de Firestore con deleteDoc / writeBatch.
 * 2. Limpia e inhabilita a los usuarios vinculados en 'users' (teamId: null, teamName: 'Sin equipo asignado', status: 'inactive').
 * 3. Si un usuario de RH tiene asignación múltiple, retira únicamente el equipo eliminado; si queda con 0 equipos, se inhabilita.
 * 4. Actualiza inmediatamente el estado en memoria de los stores locales.
 */
export async function cascadeDeleteTeam(
  teamId: string,
  teamName?: string
): Promise<{ success: boolean; affectedUsersCount: number }> {
  let affectedUsersCount = 0;
  const targetName = (teamName || '').trim().toLowerCase();

  // 1. Sincronización en almacén local de Zustand (inmediato)
  try {
    const checkinState = useCheckinStore.getState();
    if (typeof checkinState.disassociateTeamFromUsers === 'function') {
      checkinState.disassociateTeamFromUsers(teamId, teamName);
    }

    const rayonerState = useRayonerStore.getState();
    if (rayonerState.teamMembers) {
      const updatedMembers = rayonerState.teamMembers.map((m) => {
        const mTeam = (m.team || '').trim().toLowerCase();
        if (mTeam === targetName || (m as any).teamId === teamId) {
          return {
            ...m,
            team: 'Sin equipo asignado',
            teamId: undefined,
            status: 'inactive' as const,
          };
        }
        return m;
      });
      useRayonerStore.setState({ teamMembers: updatedMembers });
    }
  } catch (err) {
    console.warn('[teamService] Error al limpiar almacén local en cascada:', err);
  }

  // 2. Transacción por lotes (writeBatch) en Firestore
  const firestore = db;
  if (!isFirebaseConfigured() || !firestore) {
    return { success: true, affectedUsersCount };
  }

  try {
    const batch = writeBatch(firestore);

    // Acción A: Borrado físico del equipo en la colección 'teams'
    const teamDocRef = doc(firestore, 'teams', teamId);
    batch.delete(teamDocRef);

    // Acción B: Buscar y actualizar usuarios vinculados en la colección 'users'
    const usersCollection = collection(firestore, 'users');
    const userSnapshots = await withTimeout(getDocs(usersCollection), 2500, null);

    if (userSnapshots && !userSnapshots.empty) {
      userSnapshots.forEach((uDoc) => {
        const data = uDoc.data();
        if (!data) return;

        // Excluir de inhabilitación al usuario TI Root / administradores maestros
        const userRole = String(data.role || '').toLowerCase();
        const userEmail = String(data.email || '').toLowerCase();
        if (
          userRole === 'ti' ||
          data.isRoot === true ||
          data.canManageSystemRBAC === true ||
          userEmail.includes('ti.') ||
          userEmail === 'admin@bytewise.mx'
        ) {
          return;
        }

        const uTeamId = data.teamId;
        const uTeam = (data.team || '').trim().toLowerCase();
        const uTeamName = (data.teamName || '').trim().toLowerCase();
        const uEquipo = (data.equipo || '').trim().toLowerCase();
        const uTeamIds = Array.isArray(data.teamIds) ? data.teamIds : [];
        const uAssigned = Array.isArray(data.assignedTeams)
          ? Array.from(new Set([...uTeamIds, ...data.assignedTeams]))
          : uTeamIds;

        const isDirectMatch =
          uTeamId === teamId ||
          uTeamIds.includes(teamId) ||
          (targetName && (uTeam === targetName || uTeamName === targetName || uEquipo === targetName));

        const isInAssignedTeams = uAssigned.some(
          (t: string) => t === teamId || (targetName && t.trim().toLowerCase() === targetName)
        );

        if (isDirectMatch || isInAssignedTeams) {
          affectedUsersCount++;
          const userRef = doc(firestore, 'users', uDoc.id);

          // Si el usuario tiene múltiples equipos asignados (multi-equipo)
          if (uAssigned.length > 0) {
            const remainingTeams = uAssigned.filter(
              (t: string) => t !== teamId && (!targetName || t.trim().toLowerCase() !== targetName)
            );

            if (remainingTeams.length > 0) {
              // Sigue activo con los equipos restantes
              const nextTeamId = remainingTeams[0];
              batch.update(userRef, {
                teamIds: remainingTeams,
                assignedTeams: remainingTeams,
                team: isDirectMatch ? nextTeamId : (data.team || nextTeamId),
                teamName: isDirectMatch ? nextTeamId : (data.teamName || nextTeamId),
                teamId: isDirectMatch ? nextTeamId : (data.teamId || nextTeamId),
                updatedAt: new Date().toISOString(),
              });
            } else {
              // Se quedó con 0 equipos -> Inhabilitado
              batch.update(userRef, {
                teamId: null,
                teamIds: [],
                teamName: 'Sin equipo asignado',
                team: 'Sin equipo asignado',
                equipo: 'Sin equipo asignado',
                assignedTeams: [],
                status: 'inactive',
                isActive: false,
                updatedAt: new Date().toISOString(),
              });
            }
          } else {
            // Usuario sin equipos restantes -> Inhabilitado
            batch.update(userRef, {
              teamId: null,
              teamIds: [],
              teamName: 'Sin equipo asignado',
              team: 'Sin equipo asignado',
              equipo: 'Sin equipo asignado',
              assignedTeams: [],
              status: 'inactive',
              isActive: false,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      });
    }

    await batch.commit();
    console.log(
      `[teamService] Eliminación en cascada exitosa de equipo "${teamName || teamId}". Usuarios inhabilitados/actualizados: ${affectedUsersCount}`
    );

    return { success: true, affectedUsersCount };
  } catch (err) {
    console.error('[teamService] Error durante la eliminación en cascada:', err);
    // Fallback de borrado individual si falla el lote
    try {
      await deleteDoc(doc(firestore, 'teams', teamId));
    } catch (singleErr) {
      console.warn('[teamService] Error en deleteDoc fallback:', singleErr);
    }
    return { success: false, affectedUsersCount };
  }
}

/**
 * Elimina un equipo en Firestore (manteniendo retrocompatibilidad)
 */
export async function deleteTeamFromFirestore(teamId: string, teamName?: string): Promise<boolean> {
  const result = await cascadeDeleteTeam(teamId, teamName);
  return result.success;
}

/**
 * Asignación Multi-Equipo Atómica para un Usuario (`users/{uid}` <-> `teams/{teamId}`):
 * Actualiza `teamIds` (array de IDs), `assignedTeams`, `teamId`, `supervisorId`, `gerenteId`
 * y sincroniza el arreglo `memberIds` en todos los equipos afectados dentro de un único `writeBatch`.
 */
export async function syncUserMultiTeamAssignment(
  userId: string,
  selectedTeams: Team[],
  teamsList?: Team[]
): Promise<void> {
  const firestore = db;
  const isOnline = isFirebaseConfigured() && Boolean(firestore);
  const validTeams = (selectedTeams || []).filter(Boolean);
  const primaryTeam = validTeams[0] || null;
  const nextTeamIds = Array.from(new Set(validTeams.map((t) => t.id)));

  // 1. Sincronización en stores locales (useCheckinStore y useRayonerStore)
  try {
    const checkinState = useCheckinStore.getState();
    checkinState.assignUserTeam(
      userId,
      primaryTeam ? primaryTeam.name : 'Sin equipo asignado',
      primaryTeam ? primaryTeam.id : undefined
    );

    const rayonerState = useRayonerStore.getState();
    if (rayonerState.teamMembers) {
      const updatedMembers = rayonerState.teamMembers.map((m) =>
        m.id === userId
          ? {
              ...m,
              team: primaryTeam ? primaryTeam.name : 'Sin equipo asignado',
              teamId: primaryTeam ? primaryTeam.id : undefined,
              assignedTeams: nextTeamIds,
              status: primaryTeam ? ('active' as const) : ('inactive' as const),
            }
          : m
      );
      useRayonerStore.setState({ teamMembers: updatedMembers });
    }
  } catch (err) {
    console.warn('[teamService] Error actualizando stores locales:', err);
  }

  // 2. Actualización atómica en Firestore
  if (isOnline && firestore) {
    const userPatch: Record<string, any> = {
      teamId: primaryTeam ? primaryTeam.id : null,
      teamIds: nextTeamIds,
      teamName: primaryTeam ? primaryTeam.name : 'Sin equipo asignado',
      team: primaryTeam ? primaryTeam.name : 'Sin equipo asignado',
      assignedTeams: nextTeamIds,
      status: nextTeamIds.length > 0 ? 'active' : 'inactive',
      isActive: nextTeamIds.length > 0,
      accessRevoked: nextTeamIds.length === 0,
      updatedAt: new Date().toISOString(),
    };
    if (primaryTeam?.supervisorId || primaryTeam?.leaderId) {
      userPatch.supervisorId = primaryTeam.supervisorId || primaryTeam.leaderId;
    }
    if (primaryTeam?.gerenteId || primaryTeam?.parentLeaderId) {
      userPatch.gerenteId = primaryTeam.gerenteId || primaryTeam.parentLeaderId;
    }

    try {
      const batch = writeBatch(firestore);
      const userRef = doc(firestore, 'users', userId);
      batch.set(userRef, userPatch, { merge: true });

      if (teamsList && teamsList.length > 0) {
        const targetIdSet = new Set(nextTeamIds);
        teamsList.forEach((t) => {
          const isTarget = targetIdSet.has(t.id);
          const currentMembers = Array.isArray(t.memberIds) ? t.memberIds : [];
          const hasUser = currentMembers.includes(userId);

          if (isTarget && !hasUser) {
            batch.update(doc(firestore, 'teams', t.id), {
              memberIds: Array.from(new Set([...currentMembers, userId])),
              updatedAt: new Date().toISOString(),
            });
          } else if (!isTarget && hasUser) {
            batch.update(doc(firestore, 'teams', t.id), {
              memberIds: currentMembers.filter((mId) => mId !== userId),
              updatedAt: new Date().toISOString(),
            });
          }
        });
      }

      await batch.commit();
    } catch (err) {
      console.warn('[teamService] Error en actualización batch de equipos:', err);
      try {
        await setDoc(doc(firestore, 'users', userId), userPatch, { merge: true });
      } catch (fallbackErr) {
        console.warn('[teamService] Error en fallback setDoc user:', fallbackErr);
      }
    }
  }
}

/**
 * Asignación / Desasignación de un equipo principal (retrocompatible sobre el modelo multi-equipo `teamIds`).
 */
export async function syncUserTeamAssignment(
  userId: string,
  selectedTeam: Team | null,
  teamsList?: Team[]
): Promise<void> {
  await syncUserMultiTeamAssignment(userId, selectedTeam ? [selectedTeam] : [], teamsList);
}

