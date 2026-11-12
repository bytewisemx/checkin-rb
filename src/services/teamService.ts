import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { Team } from '../types/team';

function withTimeout<T>(promise: Promise<T>, ms = 2000, fallback: T): Promise<T> {
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

/**
 * Obtiene todos los equipos registrados en la colección `teams` de Firestore
 */
export async function fetchTeamsFromFirestore(): Promise<Team[]> {
  if (!isFirebaseConfigured() || !db) return [];

  try {
    const teamsCollection = collection(db, 'teams');
    const fetchPromise = getDocs(teamsCollection).then((snapshot) => {
      const teams: Team[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        teams.push({
          id: docSnap.id,
          name: data.name || '',
          code: data.code || '',
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

    return await withTimeout(fetchPromise, 2500, []);
  } catch (err) {
    console.warn('[teamService] Error al consultar equipos en Firestore:', err);
    return [];
  }
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
        status: team.status,
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

