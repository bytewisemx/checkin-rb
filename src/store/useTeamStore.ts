import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Team } from '../types/team';
import {
  fetchTeamsFromFirestore,
  saveTeamToFirestore,
  deleteTeamFromFirestore,
} from '../services/teamService';

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

interface TeamState {
  teams: Team[];
  isLoading: boolean;
  hasLoadedFromRemote: boolean;

  fetchTeams: () => Promise<void>;
  createTeam: (
    teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<Team>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  toggleTeamStatus: (id: string) => Promise<void>;
  setTeamMembers: (teamId: string, memberIds: string[]) => Promise<void>;
  getActiveTeams: () => Team[];
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: [],
      isLoading: false,
      hasLoadedFromRemote: false,

      fetchTeams: async () => {
        set({ isLoading: true });
        try {
          const remoteTeams = await fetchTeamsFromFirestore();
          // Colección 'teams' de Firestore como ÚNICA fuente de verdad
          set({
            teams: remoteTeams,
            isLoading: false,
            hasLoadedFromRemote: true,
          });
          console.log('[useTeamStore] Equipos cargados exclusivamente desde la colección "teams":', remoteTeams);
        } catch (error) {
          console.warn('[useTeamStore] Error al cargar equipos remotos:', error);
          set({ isLoading: false });
        }
      },

      createTeam: async (data) => {
        const id = data.id || `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const code = data.code || generateTeamCode(data.name, get().teams.length + 1);
        const now = new Date().toISOString();

        const newTeam: Team = {
          id,
          name: data.name.trim(),
          code,
          leaderId: data.leaderId,
          leaderName: data.leaderName,
          leaderRole: data.leaderRole || 'Supervisor',
          memberIds: data.memberIds || [],
          status: data.status || 'active',
          description: data.description || '',
          parentLeaderId: data.parentLeaderId || '',
          createdAt: now,
          updatedAt: now,
        };

        const updatedTeams = [...get().teams, newTeam];
        set({ teams: updatedTeams });

        // Guardar en Firestore en segundo plano
        saveTeamToFirestore(newTeam).catch(console.warn);

        return newTeam;
      },

      updateTeam: async (id, updates) => {
        const current = get().teams;
        const index = current.findIndex((t) => t.id === id);
        if (index === -1) return;

        const updatedTeam: Team = {
          ...current[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const updatedTeams = [...current];
        updatedTeams[index] = updatedTeam;
        set({ teams: updatedTeams });

        // Guardar en Firestore en segundo plano
        saveTeamToFirestore(updatedTeam).catch(console.warn);
      },

      deleteTeam: async (id) => {
        const current = get().teams;
        const targetTeam = current.find((t) => t.id === id);
        const updatedTeams = current.filter((t) => t.id !== id);
        set({ teams: updatedTeams });

        await deleteTeamFromFirestore(id, targetTeam?.name);
      },

      toggleTeamStatus: async (id) => {
        const current = get().teams;
        const team = current.find((t) => t.id === id);
        if (!team) return;

        const nextStatus = team.status === 'active' ? 'inactive' : 'active';
        await get().updateTeam(id, { status: nextStatus });
      },

      setTeamMembers: async (teamId, memberIds) => {
        await get().updateTeam(teamId, { memberIds });
      },

      getActiveTeams: () => {
        return get().teams.filter((t) => t.status !== 'inactive');
      },
    }),
    {
      name: 'rb_teams_store_v1',
      partialize: (state) => ({
        teams: state.teams,
      }),
    }
  )
);
