import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSecureServerTime, captureClientIP, calculateLateness } from '../services/security';
import {
  normalizeRole,
  getDefaultModulesForRole,
  getEffectiveModules,
  getDefaultPermissionsForRole,
  getEffectivePermissions,
  updateUserModulesApi,
  updateUserBiometricsApi,
  type UserRole,
  type UserModules,
  type UserGranularPermissions,
  type BiometricVectorRecord,
} from '../services/rbac';
import {
  buildBiometricVectorRecord,
  DEFAULT_BIOMETRIC_THRESHOLD,
} from '../services/facialBiometrics';
import { useRayonerStore } from './useRayonerStore';
import { doc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';

export interface TaskTag {
  text: string;
  colorClass: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'progress' | 'review' | 'completed';
  timeSpent: string;
  estimatedTime: string;
  tags?: TaskTag[];
  assignee?: string;
  dueDate?: string;
  subtasksCount?: number;
}

export interface User {
  id: string;
  name: string;
  lastName?: string;
  email: string;
  role: UserRole | 'employee' | 'supervisor' | string;
  verified: boolean;
  birthDate?: string;
  team?: string;
  teamId?: string;
  teamName?: string | null;
  assignedTeams?: string[];
  status?: 'active' | 'inactive';
  isActive?: boolean;
  accessRevoked?: boolean;
  isProfileComplete: boolean;
  expectedEntryTime: string;
  photoURL?: string | null;
  profileImage?: string; // Avatar SVG o ilustración de perfil (NO imagen de biometría)
  // Biometría vectorial estrictamente SIN imágenes (solo floats, fecha ISO y versión de modelo)
  faceDescriptor?: number[];
  biometrics?: BiometricVectorRecord | null;
  biometricThreshold?: number;
  isBiometricsEnrolled?: boolean;
  // Permisos granulares por usuario gestionados por TI
  permissions?: UserGranularPermissions;
  customPermissions?: Partial<UserGranularPermissions>;
  modules?: UserModules;
  // Referencias jerárquicas requeridas
  supervisor_id?: string | null;
  supervisorId?: string;
  supervisorName?: string;
  supervisorCode?: string;
  invitationToken?: string;
  created_by_ti_id?: string | null;
  createdByTiId?: string;
  assigned_team_members?: string[];
}

export interface ManagedUserPermissionEntry {
  id: string;
  name: string;
  email: string;
  role: UserRole | string;
  team?: string;
  teamId?: string;
  teamName?: string | null;
  assignedTeams?: string[];
  permissions?: UserGranularPermissions;
  customPermissions?: Partial<UserGranularPermissions>;
  modules: UserModules;
  biometrics?: BiometricVectorRecord | null;
  photoURL?: string | null;
  accessRevoked?: boolean;
  allowedSupervisorIds?: string[];
  supervisor_id?: string | null;
  created_by_ti_id?: string | null;
}

export interface AbsenceJustification {
  id: string;
  userId: string;
  userEmail: string;
  dateKey: string; // Formato YYYY-MM-DD
  status: 'justified' | 'unjustified';
  reasonType: 'medical' | 'vacation' | 'paid_leave' | 'commission' | 'unpaid_leave' | 'other';
  reasonLabel: string;
  notes?: string;
  hoursCredit: number; // Horas a computar (ej. 8.0)
  justifiedBy: string;
  justifiedAt: string;
}

export interface PauseBlock {
  startMs: number;
  endMs: number | null;
}

export interface TaskInterval {
  taskId: string;
  taskName: string;
  company?: string;
  startTime: string; // Formato HH:MM:SS
  endTime: string | null; // HH:MM:SS o null si está corriendo activamente
  durationSeconds: number;
  startMs: number;
  endMs: number | null;
}

export interface CheckinRecord {
  id: string;
  date: string;
  checkInTimeMs: number | null;
  checkOutTimeMs: number | null;
  pauses: PauseBlock[];
  location: { lat: number; lng: number } | null;
  address: string | null;
  totalDurationMinutes: number | null;
  clientIp: string | null;
  isLate: boolean;
  minutesLate: number;
  // Estrictamente prohibido guardar facePhotoUrl / base64; solo score y distancia vectorial
  biometricMatchScore?: number | null;
  biometricDistance?: number | null;
  // Modelo de persistencia de jornada y subtramos por tarea
  status?: 'active' | 'paused' | 'completed';
  workdayTotalSeconds?: number;
  taskIntervals?: TaskInterval[];
}

export interface MockEmployee {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  team: string;
  assignedTeams?: string[];
  permissions?: UserGranularPermissions;
  status: 'active' | 'inactive';
  workedMinutesToday: number;
  isProfileComplete: boolean;
  history: CheckinRecord[];
  expectedEntryTime: string;
  supervisor_id?: string | null;
  created_by_ti_id?: string | null;
  modules?: UserModules;
  biometrics?: BiometricVectorRecord | null;
  photoURL?: string | null;
  profileImage?: string;
}

export interface GlobalToast {
  message: string;
  type: 'info' | 'success' | 'error';
  id: number;
}

interface CheckinState {
  user: User | null;
  isAuthenticated: boolean;
  activeCheckin: CheckinRecord | null;
  history: CheckinRecord[];
  userActiveCheckins: Record<string, CheckinRecord>;
  userHistories: Record<string, CheckinRecord[]>;

  mockEmployeesData: MockEmployee[];
  userPermissionsDirectory: Record<string, ManagedUserPermissionEntry>;
  toasts: GlobalToast[];
  tasks: Task[];
  globalLoading: {
    active: boolean;
    message: string;
  };
  showLoader: (message?: string) => void;
  hideLoader: () => void;

  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  removeToast: (id: number) => void;
  moveTask: (taskId: string, newStatus: Task['status']) => void;
  addTask: (task: Omit<Task, 'id'>) => void;
  deleteTask: (taskId: string) => void;

  login: (email: string, password?: string) => boolean;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  loginWithFirebaseUser: (
    fbUser: { uid: string; email: string | null; displayName?: string | null; photoURL?: string | null },
    invitationData?: {
      supervisorId?: string;
      supervisorName?: string;
      supervisorCode?: string;
      team?: string;
      teamId?: string | null;
      assignedTeams?: string[];
      status?: 'active' | 'inactive';
      isActive?: boolean;
      roleTitle?: string;
      role?: UserRole | 'employee' | 'supervisor';
      created_by_ti_id?: string | null;
      token?: string;
      isProfileComplete?: boolean;
    }
  ) => void;

  // Biometría vectorial sin imágenes + Tolerancia configurable
  enrollBiometrics: (
    descriptor: number[],
    endpointTarget?: 'me' | string,
    threshold?: number
  ) => Promise<BiometricVectorRecord>;
  setBiometricThreshold: (threshold: number) => void;

  // Control de Tema Claro / Oscuro (Ajustable en menú de ajustes)
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // Gestión granular de permisos y estructura jerárquica por usuario (Panel TI)
  updateUserPermissions: (userId: string, permissions: Partial<UserGranularPermissions>) => void;
  updateUserAssignedTeams: (userId: string, assignedTeams: string[]) => void;
  assignUserTeam: (userId: string, teamName: string, teamId?: string) => void;
  changeUserRole: (userId: string, newRole: UserRole) => void;
  getEffectiveUserPermissions: (userId?: string) => UserGranularPermissions;
  updateUserModules: (
    targetUserId: string,
    modules: UserModules,
    meta?: { name?: string; email?: string; role?: UserRole; team?: string }
  ) => Promise<void>;
  getEffectiveUserModules: (userId?: string) => UserModules;
  toggleUserAccessRevoked: (targetUserId: string) => void;
  disassociateTeamFromUsers: (teamId: string, teamName?: string) => void;
  updateRHAllowedTeams: (rhUserId: string, supervisorIds: string[]) => void;
  reassignEmployeeSupervisor: (employeeId: string, newSupervisorId: string) => void;

  // Justificaciones de inasistencia para prenómina y auditoría de RH
  absenceJustifications: Record<string, AbsenceJustification>;
  setAbsenceJustification: (
    justification: Omit<AbsenceJustification, 'id' | 'justifiedAt'>
  ) => void;
  removeAbsenceJustification: (userEmail: string, dateKey: string) => void;

  startCheckin: (
    lat: number,
    lng: number,
    address: string,
    matchScore?: number,
    biometricDistance?: number,
    initialTaskData?: { taskId: string; taskName: string; company?: string } | null
  ) => Promise<void>;
  switchActiveTask: (taskData: { taskId: string; taskName: string; company?: string } | null) => void;
  pauseCheckin: () => Promise<void>;
  resumeCheckin: () => Promise<void>;
  endCheckin: () => Promise<void>;

  pendingEmail?: string;
  verificationType?: 'registration' | 'recovery';
  requestPasswordReset: (email: string) => void;
  verifyCode: (code: string) => boolean;
  resetPassword: (_password: string) => void;
  registerUser: (email: string, password?: string) => void;
}

const permissionsRealtimeChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('rb_permissions_realtime_channel')
    : null;

function broadcastPermissionsUpdate(payload?: unknown) {
  try {
    permissionsRealtimeChannel?.postMessage({
      type: 'PERMISSIONS_OR_BIOMETRICS_UPDATED',
      payload,
      timestamp: Date.now(),
    });
  } catch {
    // Ignore broadcast errors
  }
}

const getPastDateStr = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const generateMockHistory = (days: number): CheckinRecord[] => {
  const history: CheckinRecord[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 1; i <= days; i++) {
    const d = new Date(now - i * dayMs);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const isLate = Math.random() > 0.7;
    const minutesLate = isLate ? Math.floor(Math.random() * 45) + 11 : 0;

    const checkinDate = new Date(d);
    checkinDate.setHours(9, isLate ? minutesLate : Math.floor(Math.random() * 9), 0, 0);

    const checkoutDate = new Date(checkinDate);
    const workedHours = 8 + Math.random() * 1.5;
    checkoutDate.setHours(checkoutDate.getHours() + Math.floor(workedHours));
    checkoutDate.setMinutes(Math.floor(Math.random() * 60));

    const durationMins = Math.floor((checkoutDate.getTime() - checkinDate.getTime()) / 60000);

    history.push({
      id: `mock-r-${i}`,
      date: checkinDate.toISOString().split('T')[0],
      checkInTimeMs: checkinDate.getTime(),
      checkOutTimeMs: checkoutDate.getTime(),
      pauses: [],
      location: { lat: 19.4326 + Math.random() * 0.01, lng: -99.1332 + Math.random() * 0.01 },
      address: 'Av. Reforma, CDMX (Simulado)',
      totalDurationMinutes: durationMins,
      clientIp: '189.200.10.15',
      isLate,
      minutesLate,
    });
  }
  return history;
};

const initialPermissionsDirectory: Record<string, ManagedUserPermissionEntry> = {
  'ti-root-01': {
    id: 'ti-root-01',
    name: 'TI Prueba',
    email: 'ti.root@russellbedford.mx',
    role: 'ti',
    team: 'Equipo Prueba (TI Root)',
    permissions: getDefaultPermissionsForRole('ti'),
    modules: getDefaultModulesForRole('ti'),
    biometrics: null,
    accessRevoked: false,
  },
  'socio-01': {
    id: 'socio-01',
    name: 'Socio Director Prueba',
    email: 'socio.prueba@russellbedford.mx',
    role: 'socio',
    team: 'Jefatura y Dirección de Práctica',
    permissions: getDefaultPermissionsForRole('socio'),
    modules: getDefaultModulesForRole('socio'),
    biometrics: null,
    accessRevoked: false,
    created_by_ti_id: 'ti-root-01',
  },
  'gerente-01': {
    id: 'gerente-01',
    name: 'Gerente Prueba',
    email: 'gerente.prueba@russellbedford.mx',
    role: 'gerente',
    team: 'Auditoría Fiscal',
    assignedTeams: ['Auditoría Fiscal', 'Equipo Prueba'],
    permissions: getDefaultPermissionsForRole('gerente'),
    modules: getDefaultModulesForRole('gerente'),
    biometrics: null,
    accessRevoked: false,
    created_by_ti_id: 'ti-root-01',
  },
  'admin-99': {
    id: 'admin-99',
    name: 'Supervisor Prueba',
    email: 'supervisor.prueba@russellbedford.mx',
    role: 'supervisor',
    team: 'Equipo Prueba',
    permissions: getDefaultPermissionsForRole('supervisor'),
    modules: getDefaultModulesForRole('supervisor'),
    biometrics: null,
    accessRevoked: false,
    created_by_ti_id: 'ti-root-01',
  },
  'rh-01': {
    id: 'rh-01',
    name: 'RH Prueba',
    email: 'rh.prueba@russellbedford.mx',
    role: 'rh',
    team: 'Recursos Humanos',
    assignedTeams: ['Equipo Prueba', 'Auditoría Fiscal'],
    permissions: getDefaultPermissionsForRole('rh'),
    modules: getDefaultModulesForRole('rh'),
    biometrics: null,
    accessRevoked: false,
    allowedSupervisorIds: ['admin-99'],
    created_by_ti_id: 'ti-root-01',
  },
  'usr-ana': {
    id: 'usr-ana',
    name: 'Colaborador Prueba',
    email: 'colaborador.prueba@russellbedford.mx',
    role: 'colaborador',
    team: 'Equipo Prueba',
    permissions: getDefaultPermissionsForRole('colaborador'),
    modules: getDefaultModulesForRole('colaborador'),
    biometrics: null,
    accessRevoked: false,
    supervisor_id: 'admin-99',
  },
};

const initialMockEmployees: MockEmployee[] = [
  {
    id: 'usr-ana',
    email: 'colaborador.prueba@russellbedford.mx',
    name: 'Empleado Prueba',
    role: 'Empleado',
    team: 'Equipo Prueba',
    status: 'active',
    isProfileComplete: true,
    workedMinutesToday: 405,
    expectedEntryTime: '09:00',
    supervisor_id: 'admin-99',
    modules: getDefaultModulesForRole('Empleado'),
    history: generateMockHistory(20),
  },
];

export const useCheckinStore = create<CheckinState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      activeCheckin: null,
      history: [],
      userActiveCheckins: {},
      userHistories: {},
      mockEmployeesData: initialMockEmployees,
      userPermissionsDirectory: initialPermissionsDirectory,
      toasts: [],
      tasks: [],
      theme: 'dark',
      globalLoading: {
        active: false,
        message: 'Cargando Checkin...',
      },

      showLoader: (message = 'Cargando Checkin...') => {
        set({ globalLoading: { active: true, message } });
      },

      hideLoader: () => {
        set((state) => ({ globalLoading: { ...state.globalLoading, active: false } }));
      },

      setTheme: (theme: 'dark' | 'light') => {
        set({ theme });
        try {
          if (typeof document !== 'undefined') {
            if (theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
            document.documentElement.setAttribute('data-theme', theme);
          }
          localStorage.setItem('rb_theme', theme);
        } catch {
          // ignore
        }
      },

      toggleTheme: () => {
        const current = get().theme || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },

      moveTask: (taskId, newStatus) => {
        const { user, addToast } = get();
        if (!user) return;
        const normRole = normalizeRole(user.role);
        const effMods = getEffectiveModules(user);
        if (normRole === 'RH' || !effMods.tasks) {
          addToast('Acceso denegado (403): El módulo de tareas no está habilitado para tu cuenta.', 'error');
          return;
        }
        useRayonerStore.getState().moveTaskStatus(taskId, newStatus, user.id, user.name);
      },

      addTask: (taskData) => {
        const { user, addToast } = get();
        const effMods = getEffectiveModules(user);
        if (!effMods.tasks) {
          addToast('Acceso denegado (403): Módulo de tareas deshabilitado.', 'error');
          return;
        }
        useRayonerStore.getState().addTask(
          {
            title: taskData.title,
            name: taskData.title,
            description: taskData.description,
            projectId: 'prj-aud-2026',
            assigned_to: 'usr-ana',
            created_by: user?.id || 'admin-99',
            status: taskData.status === 'progress' ? 'in_progress' : taskData.status,
            plannedHours: 8,
            priority: 'medium',
            isBillable: true,
            isActive: true,
          },
          true
        );
      },

      deleteTask: (taskId) => {
        useRayonerStore.getState().deleteTask(taskId);
      },

      addToast: (msg, type = 'info') => {
        const id = Date.now() + Math.random();
        set((state) => ({ toasts: [...state.toasts, { message: msg, type, id }] }));
        setTimeout(() => get().removeToast(id), 5000);
      },

      removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },

      getEffectiveUserModules: (userId) => {
        const { user, userPermissionsDirectory } = get();
        const targetId = userId || user?.id;
        if (!targetId) return getDefaultModulesForRole('Empleado');
        const dirEntry = userPermissionsDirectory[targetId];
        if (dirEntry) {
          return getEffectiveModules({ role: dirEntry.role, modules: dirEntry.modules });
        }
        return getEffectiveModules(user);
      },

      getEffectiveUserPermissions: (userId) => {
        const { user, userPermissionsDirectory } = get();
        const targetId = userId || user?.id;
        const entry = targetId ? userPermissionsDirectory[targetId] : null;
        if (entry) {
          return getEffectivePermissions(entry);
        }
        return getEffectivePermissions(user);
      },

      updateUserPermissions: (userId, permissions) => {
        const { userPermissionsDirectory, user } = get();
        const existing = userPermissionsDirectory[userId];
        if (!existing) return;

        const currentPerms = existing.permissions || getDefaultPermissionsForRole(existing.role);
        const updatedPerms: UserGranularPermissions = {
          ...currentPerms,
          ...permissions,
        };

        const updatedEntry: ManagedUserPermissionEntry = {
          ...existing,
          permissions: updatedPerms,
          customPermissions: {
            ...(existing.customPermissions || {}),
            ...permissions,
          },
        };

        const nextDirectory = {
          ...userPermissionsDirectory,
          [userId]: updatedEntry,
        };

        const nextCurrentUser =
          user && user.id === userId
            ? {
                ...user,
                permissions: updatedPerms,
                customPermissions: updatedEntry.customPermissions,
              }
            : user;

        set({
          userPermissionsDirectory: nextDirectory,
          user: nextCurrentUser,
        });

        broadcastPermissionsUpdate({ userId, permissions: updatedPerms });
      },

      updateUserAssignedTeams: (userId, assignedTeams) => {
        const { userPermissionsDirectory, user } = get();
        const existing = userPermissionsDirectory[userId];
        if (!existing) return;

        const updatedEntry = {
          ...existing,
          assignedTeams,
        };

        const nextCurrentUser =
          user && user.id === userId
            ? { ...user, assignedTeams }
            : user;

        set({
          userPermissionsDirectory: {
            ...userPermissionsDirectory,
            [userId]: updatedEntry,
          },
          user: nextCurrentUser,
        });

        broadcastPermissionsUpdate({ userId, assignedTeams });
      },

      assignUserTeam: (userId, teamName, teamId) => {
        const { userPermissionsDirectory, mockEmployeesData, user } = get();
        const existing = userPermissionsDirectory[userId];
        const hasTeam = Boolean(teamName && teamName.trim() !== '' && teamName !== 'Sin equipo asignado' && teamName !== 'Sin equipo');

        const resolvedTeamName = hasTeam ? teamName.trim() : 'Sin equipo asignado';
        const resolvedTeamId = hasTeam ? (teamId || undefined) : undefined;

        const updatedEntry = existing
          ? {
              ...existing,
              team: resolvedTeamName,
              teamName: resolvedTeamName,
              teamId: resolvedTeamId,
              assignedTeams: resolvedTeamId ? [resolvedTeamId] : (hasTeam ? [resolvedTeamName] : []),
              accessRevoked: !hasTeam,
            }
          : {
              id: userId,
              name: mockEmployeesData.find((e) => e.id === userId)?.name || userId,
              email: `${userId}@russellbedford.mx`,
              role: normalizeRole(mockEmployeesData.find((e) => e.id === userId)?.role || 'Colaborador'),
              team: resolvedTeamName,
              teamName: resolvedTeamName,
              teamId: resolvedTeamId,
              assignedTeams: resolvedTeamId ? [resolvedTeamId] : (hasTeam ? [resolvedTeamName] : []),
              accessRevoked: !hasTeam,
              permissions: getDefaultPermissionsForRole('Colaborador'),
              modules: getDefaultModulesForRole('Colaborador'),
            };

        const nextDirectory = {
          ...userPermissionsDirectory,
          [userId]: updatedEntry,
        };

        const nextMockEmployees = mockEmployeesData.map((emp) =>
          emp.id === userId
            ? {
                ...emp,
                team: resolvedTeamName,
                teamName: resolvedTeamName,
                teamId: resolvedTeamId,
                status: hasTeam ? ('active' as const) : ('inactive' as const),
              }
            : emp
        );

        let nextUser = user;
        if (user && user.id === userId) {
          nextUser = {
            ...user,
            team: resolvedTeamName,
            teamName: resolvedTeamName,
            teamId: resolvedTeamId,
            assignedTeams: resolvedTeamId ? [resolvedTeamId] : (hasTeam ? [resolvedTeamName] : []),
            status: hasTeam ? 'active' : 'inactive',
            isActive: hasTeam,
            accessRevoked: !hasTeam,
          };
        }

        set({
          userPermissionsDirectory: nextDirectory,
          mockEmployeesData: nextMockEmployees,
          user: nextUser,
        });

        // Actualizar simultáneamente en useRayonerStore teamMembers
        try {
          const rayonerState = useRayonerStore.getState();
          if (rayonerState.teamMembers) {
            const updatedRayonerMembers = rayonerState.teamMembers.map((m) =>
              m.id === userId
                ? {
                    ...m,
                    team: resolvedTeamName,
                    teamId: resolvedTeamId,
                    status: hasTeam ? ('active' as const) : ('inactive' as const),
                  }
                : m
            );
            useRayonerStore.setState({ teamMembers: updatedRayonerMembers });
          }
        } catch (e) {
          console.warn('[useCheckinStore] Error al sincronizar rayoner teamMembers:', e);
        }

        // Persistir sincronizadamente en Firestore de forma dual y atómica
        if (isFirebaseConfigured() && db) {
          const userRef = doc(db, 'users', userId);
          setDoc(
            userRef,
            {
              team: resolvedTeamName,
              teamName: resolvedTeamName,
              teamId: resolvedTeamId || null,
              assignedTeams: resolvedTeamId ? [resolvedTeamId] : [],
              status: hasTeam ? 'active' : 'inactive',
              isActive: hasTeam,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(console.warn);
        }

        broadcastPermissionsUpdate({
          userId,
          team: teamName || 'Sin equipo asignado',
          accessRevoked: !hasTeam,
        });
      },

      changeUserRole: (userId, newRole) => {
        const { userPermissionsDirectory, user, mockEmployeesData } = get();
        const existing = userPermissionsDirectory[userId];
        if (!existing) return;

        const normRole = normalizeRole(newRole);
        const defaultPerms = getDefaultPermissionsForRole(normRole);
        const defaultMods = getDefaultModulesForRole(normRole);

        const updatedEntry: ManagedUserPermissionEntry = {
          ...existing,
          role: normRole,
          permissions: defaultPerms,
          customPermissions: undefined,
          modules: defaultMods,
        };

        const nextDirectory = {
          ...userPermissionsDirectory,
          [userId]: updatedEntry,
        };

        const nextMock = mockEmployeesData.map((emp) =>
          emp.id === userId
            ? {
                ...emp,
                role: normRole,
                modules: defaultMods,
              }
            : emp
        );

        const nextCurrentUser =
          user && user.id === userId
            ? {
                ...user,
                role: normRole,
                permissions: defaultPerms,
                customPermissions: undefined,
                modules: defaultMods,
              }
            : user;

        set({
          userPermissionsDirectory: nextDirectory,
          mockEmployeesData: nextMock,
          user: nextCurrentUser,
        });

        broadcastPermissionsUpdate({ userId, role: normRole, permissions: defaultPerms });
      },

      updateUserModules: async (targetUserId, modules, meta) => {
        const { user, userPermissionsDirectory, mockEmployeesData } = get();
        const existing = userPermissionsDirectory[targetUserId];
        const resolvedRole = normalizeRole(meta?.role || existing?.role || 'Empleado');

        // Aplicar sanitización RBAC (RH nunca tiene tasks ni clients)
        const sanitizedModules: UserModules =
          resolvedRole === 'RH'
            ? {
                checkIn: Boolean(modules.checkIn),
                facialCheckIn: Boolean(modules.facialCheckIn),
                tasks: false,
                reports: Boolean(modules.reports),
                clients: false,
              }
            : {
                checkIn: Boolean(modules.checkIn),
                facialCheckIn: Boolean(modules.facialCheckIn),
                tasks: Boolean(modules.tasks),
                reports: Boolean(modules.reports),
                clients: Boolean(modules.clients),
              };

        await updateUserModulesApi(targetUserId, sanitizedModules, {
          id: user?.id || 'ti-root-01',
          role: user?.role || 'TI',
          name: meta?.name || existing?.name,
          email: meta?.email || existing?.email,
        });

        const updatedEntry: ManagedUserPermissionEntry = {
          id: targetUserId,
          name: meta?.name || existing?.name || targetUserId,
          email: meta?.email || existing?.email || `${targetUserId}@russellbedford.mx`,
          role: resolvedRole,
          team: meta?.team || existing?.team,
          modules: sanitizedModules,
          biometrics: existing?.biometrics || null,
          accessRevoked: existing?.accessRevoked ?? false,
          allowedSupervisorIds: existing?.allowedSupervisorIds,
          supervisor_id: existing?.supervisor_id,
          created_by_ti_id: existing?.created_by_ti_id,
        };

        const nextDirectory = {
          ...userPermissionsDirectory,
          [targetUserId]: updatedEntry,
        };

        const nextMockEmployees = mockEmployeesData.map((emp) =>
          emp.id === targetUserId ? { ...emp, modules: sanitizedModules } : emp
        );

        const nextCurrentUser =
          user && user.id === targetUserId
            ? { ...user, modules: sanitizedModules }
            : user;

        set({
          userPermissionsDirectory: nextDirectory,
          mockEmployeesData: nextMockEmployees,
          user: nextCurrentUser,
        });

        broadcastPermissionsUpdate({ userId: targetUserId, modules: sanitizedModules });
      },

      toggleUserAccessRevoked: (targetUserId) => {
        if (targetUserId === 'ti-root-01') {
          get().addToast('No se puede revocar el acceso de la cuenta suprema de TI.', 'error');
          return;
        }
        const { userPermissionsDirectory, mockEmployeesData } = get();
        const existing = userPermissionsDirectory[targetUserId];
        if (!existing) return;

        const nextRevoked = !existing.accessRevoked;
        const revokedModules: UserModules = {
          checkIn: false,
          facialCheckIn: false,
          tasks: false,
          reports: false,
          clients: false,
        };
        const restoredModules: UserModules = getDefaultModulesForRole(existing.role);

        const nextModules = nextRevoked ? revokedModules : restoredModules;

        const nextDirectory = {
          ...userPermissionsDirectory,
          [targetUserId]: {
            ...existing,
            accessRevoked: nextRevoked,
            modules: nextModules,
          },
        };

        const nextMockEmployees = mockEmployeesData.map((emp) =>
          emp.id === targetUserId
            ? {
                ...emp,
                status: (nextRevoked ? 'inactive' : 'active') as 'active' | 'inactive',
                modules: nextModules,
              }
            : emp
        );

        set({
          userPermissionsDirectory: nextDirectory,
          mockEmployeesData: nextMockEmployees,
        });

        broadcastPermissionsUpdate({
          userId: targetUserId,
          accessRevoked: nextRevoked,
          modules: nextModules,
        });
      },

      disassociateTeamFromUsers: (teamId, teamName) => {
        const { userPermissionsDirectory, mockEmployeesData, user } = get();
        const targetClean = (teamName || '').trim().toLowerCase();

        // 1. Limpiar en userPermissionsDirectory
        const nextDirectory = { ...userPermissionsDirectory };
        let dirChanged = false;

        Object.keys(nextDirectory).forEach((uid) => {
          const entry = nextDirectory[uid];
          const entryRole = normalizeRole(entry.role);
          if (entryRole === 'TI' || uid === 'ti-root-01') return;

          const uTeam = (entry.team || '').trim().toLowerCase();
          const uTeamId = entry.teamId;
          const uAssigned = entry.assignedTeams || [];

          const isDirectMatch = uTeamId === teamId || (targetClean && uTeam === targetClean);
          const isInAssigned = uAssigned.some(
            (t) => t === teamId || (targetClean && t.trim().toLowerCase() === targetClean)
          );

          if (isDirectMatch || isInAssigned) {
            dirChanged = true;
            if (uAssigned.length > 0) {
              const remaining = uAssigned.filter(
                (t) => t !== teamId && (!targetClean || t.trim().toLowerCase() !== targetClean)
              );
              const isNowInactive = remaining.length === 0;
              nextDirectory[uid] = {
                ...entry,
                assignedTeams: remaining,
                team: isNowInactive ? 'Sin equipo asignado' : isDirectMatch ? remaining[0] : entry.team,
                teamId: isNowInactive ? undefined : entry.teamId === teamId ? undefined : entry.teamId,
                accessRevoked: isNowInactive ? true : entry.accessRevoked,
              };
            } else {
              nextDirectory[uid] = {
                ...entry,
                team: 'Sin equipo asignado',
                teamId: undefined,
                assignedTeams: [],
                accessRevoked: true,
              };
            }
          }
        });

        // 2. Limpiar en mockEmployeesData
        const nextMockEmployees = mockEmployeesData.map((emp) => {
          const empTeam = (emp.team || '').trim().toLowerCase();
          if (empTeam === targetClean || (emp as any).teamId === teamId) {
            return {
              ...emp,
              team: 'Sin equipo asignado',
              status: 'inactive' as const,
              assignedTeams: [],
            };
          }
          return emp;
        });

        // 3. Limpiar en sesión activa si coincide
        let nextUser = user;
        if (user) {
          const userRole = normalizeRole(user.role);
          if (userRole !== 'TI') {
            const uTeam = (user.team || '').trim().toLowerCase();
            const uTeamId = user.teamId;
            const uAssigned = user.assignedTeams || [];
            const isDirectMatch = uTeamId === teamId || (targetClean && uTeam === targetClean);
            const isInAssigned = uAssigned.some(
              (t) => t === teamId || (targetClean && t.trim().toLowerCase() === targetClean)
            );

            if (isDirectMatch || isInAssigned) {
              if (uAssigned.length > 0) {
                const remaining = uAssigned.filter(
                  (t) => t !== teamId && (!targetClean || t.trim().toLowerCase() !== targetClean)
                );
                const isNowInactive = remaining.length === 0;
                nextUser = {
                  ...user,
                  assignedTeams: remaining,
                  team: isNowInactive ? 'Sin equipo asignado' : isDirectMatch ? remaining[0] : user.team,
                  teamId: isNowInactive ? undefined : user.teamId,
                  status: isNowInactive ? 'inactive' : user.status,
                  isActive: !isNowInactive,
                };
              } else {
                nextUser = {
                  ...user,
                  team: 'Sin equipo asignado',
                  teamId: undefined,
                  assignedTeams: [],
                  status: 'inactive',
                  isActive: false,
                };
              }
            }
          }
        }

        set({
          userPermissionsDirectory: dirChanged ? nextDirectory : userPermissionsDirectory,
          mockEmployeesData: nextMockEmployees,
          user: nextUser,
        });
      },

      updateRHAllowedTeams: (rhUserId, supervisorIds) => {
        const { userPermissionsDirectory } = get();
        const existing = userPermissionsDirectory[rhUserId] || userPermissionsDirectory['rh-01'];
        if (!existing) return;

        const nextDirectory = {
          ...userPermissionsDirectory,
          [existing.id]: {
            ...existing,
            allowedSupervisorIds: supervisorIds,
          },
        };

        set({ userPermissionsDirectory: nextDirectory });
        broadcastPermissionsUpdate({ userId: existing.id, allowedSupervisorIds: supervisorIds });
      },

      reassignEmployeeSupervisor: (employeeId, newSupervisorId) => {
        const { userPermissionsDirectory, mockEmployeesData } = get();
        const existing = userPermissionsDirectory[employeeId];
        const nextDirectory = existing
          ? {
              ...userPermissionsDirectory,
              [employeeId]: {
                ...existing,
                supervisor_id: newSupervisorId,
              },
            }
          : userPermissionsDirectory;

        const nextMockEmployees = mockEmployeesData.map((emp) =>
          emp.id === employeeId ? { ...emp, supervisor_id: newSupervisorId } : emp
        );

        set({
          userPermissionsDirectory: nextDirectory,
          mockEmployeesData: nextMockEmployees,
        });

        // Actualizar también en useRayonerStore
        const rayonerState = useRayonerStore.getState();
        const member = rayonerState.teamMembers.find((m) => m.id === employeeId);
        if (member) {
          rayonerState.registerCollaborator({
            id: member.id,
            name: member.name,
            email: member.email,
            team: member.team,
            role: 'Empleado',
            supervisorId: newSupervisorId,
          });
        }
        broadcastPermissionsUpdate({ userId: employeeId, supervisor_id: newSupervisorId });
      },

      absenceJustifications: {},

      setAbsenceJustification: (data) => {
        const compositeKey = `${data.userEmail.toLowerCase()}_${data.dateKey}`;
        const id = `just-${compositeKey}`;
        set((state) => ({
          absenceJustifications: {
            ...state.absenceJustifications,
            [compositeKey]: {
              ...data,
              id,
              justifiedAt: new Date().toISOString(),
            },
          },
        }));
      },

      removeAbsenceJustification: (userEmail, dateKey) => {
        const compositeKey = `${userEmail.toLowerCase()}_${dateKey}`;
        set((state) => {
          const next = { ...state.absenceJustifications };
          delete next[compositeKey];
          return { absenceJustifications: next };
        });
      },

      login: (email, password) => {
        const { addToast, mockEmployeesData, userPermissionsDirectory } = get();
        const lowerEmail = email.trim().toLowerCase();

        if (password !== 'admin123') {
          addToast('Contraseña incorrecta. (Usa: admin123)', 'error');
          return false;
        }

        // 1. NIVEL TI (Administrador TI Root)
        if (
          lowerEmail.includes('ti.') ||
          lowerEmail.startsWith('ti@') ||
          lowerEmail.includes('root') ||
          lowerEmail === 'ti.root@russellbedford.mx'
        ) {
          const dir = userPermissionsDirectory['ti-root-01'];
          const userActive = get().userActiveCheckins?.['ti-root-01'] || null;
          const userHist = get().userHistories?.['ti-root-01'] || [];
          set({
            user: {
              id: 'ti-root-01',
              name: 'TI',
              lastName: 'Prueba',
              email: 'ti.root@russellbedford.mx',
              role: 'ti',
              verified: true,
              isProfileComplete: true,
              team: 'Equipo Prueba (TI Root)',
              expectedEntryTime: '09:00',
              status: 'active',
              permissions: dir?.permissions || getDefaultPermissionsForRole('ti'),
              modules: dir?.modules || getDefaultModulesForRole('ti'),
              biometrics: dir?.biometrics || null,
              faceDescriptor: dir?.biometrics?.faceDescriptor,
              isBiometricsEnrolled: Boolean(dir?.biometrics?.faceDescriptor?.length),
              biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
            },
            isAuthenticated: true,
            activeCheckin: userActive,
            history: userHist,
          });
          return true;
        }

        // 2. NIVEL SOCIO / JEFATURA
        if (
          lowerEmail.includes('socio') ||
          lowerEmail.includes('partner') ||
          lowerEmail.includes('jefatura') ||
          lowerEmail === 'socio.prueba@russellbedford.mx'
        ) {
          const dir = userPermissionsDirectory['socio-01'];
          if (dir?.accessRevoked) {
            addToast('Acceso revocado por TI: Tus permisos de Socio han sido suspendidos.', 'error');
            return false;
          }
          const userActive = get().userActiveCheckins?.['socio-01'] || null;
          const userHist = get().userHistories?.['socio-01'] || [];
          set({
            user: {
              id: 'socio-01',
              name: 'Socio Director',
              lastName: 'Prueba',
              email: 'socio.prueba@russellbedford.mx',
              role: 'socio',
              verified: true,
              isProfileComplete: true,
              team: 'Jefatura y Dirección de Práctica',
              expectedEntryTime: '09:00',
              status: 'active',
              created_by_ti_id: 'ti-root-01',
              permissions: dir?.permissions || getDefaultPermissionsForRole('socio'),
              modules: dir?.modules || getDefaultModulesForRole('socio'),
              biometrics: dir?.biometrics || null,
              faceDescriptor: dir?.biometrics?.faceDescriptor,
              isBiometricsEnrolled: Boolean(dir?.biometrics?.faceDescriptor?.length),
              biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
            },
            isAuthenticated: true,
            activeCheckin: userActive,
            history: userHist,
          });
          return true;
        }

        // 3. NIVEL GERENTE
        if (
          lowerEmail.includes('gerente') ||
          lowerEmail.includes('manager') ||
          lowerEmail === 'gerente.prueba@russellbedford.mx'
        ) {
          const dir = userPermissionsDirectory['gerente-01'];
          if (dir?.accessRevoked) {
            addToast('Acceso revocado por TI: Tus permisos de Gerente han sido suspendidos.', 'error');
            return false;
          }
          const userActive = get().userActiveCheckins?.['gerente-01'] || null;
          const userHist = get().userHistories?.['gerente-01'] || [];
          set({
            user: {
              id: 'gerente-01',
              name: 'Gerente',
              lastName: 'Prueba',
              email: 'gerente.prueba@russellbedford.mx',
              role: 'gerente',
              verified: true,
              isProfileComplete: true,
              team: 'Auditoría Fiscal',
              assignedTeams: ['Auditoría Fiscal', 'Equipo Prueba'],
              expectedEntryTime: '09:00',
              status: 'active',
              created_by_ti_id: 'ti-root-01',
              permissions: dir?.permissions || getDefaultPermissionsForRole('gerente'),
              modules: dir?.modules || getDefaultModulesForRole('gerente'),
              biometrics: dir?.biometrics || null,
              faceDescriptor: dir?.biometrics?.faceDescriptor,
              isBiometricsEnrolled: Boolean(dir?.biometrics?.faceDescriptor?.length),
              biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
            },
            isAuthenticated: true,
            activeCheckin: userActive,
            history: userHist,
          });
          return true;
        }

        // 4. NIVEL RH (Recursos Humanos)
        if (
          lowerEmail.includes('rh.') ||
          lowerEmail.startsWith('rh@') ||
          lowerEmail.includes('recursoshumanos') ||
          lowerEmail === 'rh.auditoria@russellbedford.mx' ||
          lowerEmail === 'rh.prueba@russellbedford.mx'
        ) {
          const dir = userPermissionsDirectory['rh-01'];
          if (dir?.accessRevoked) {
            addToast('Acceso revocado por TI: Tus permisos de Recursos Humanos fueron suspendidos.', 'error');
            return false;
          }
          const userActive = get().userActiveCheckins?.['rh-01'] || null;
          const userHist = get().userHistories?.['rh-01'] || [];
          set({
            user: {
              id: 'rh-01',
              name: 'RH',
              lastName: 'Prueba',
              email: 'rh.prueba@russellbedford.mx',
              role: 'rh',
              verified: true,
              isProfileComplete: true,
              team: 'Recursos Humanos',
              assignedTeams: ['Equipo Prueba', 'Auditoría Fiscal'],
              expectedEntryTime: '09:00',
              status: 'active',
              permissions: dir?.permissions || getDefaultPermissionsForRole('rh'),
              modules: dir?.modules || getDefaultModulesForRole('rh'),
              biometrics: dir?.biometrics || null,
              faceDescriptor: dir?.biometrics?.faceDescriptor,
              isBiometricsEnrolled: Boolean(dir?.biometrics?.faceDescriptor?.length),
              biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
            },
            isAuthenticated: true,
            activeCheckin: userActive,
            history: userHist,
          });
          return true;
        }

        // 5. NIVEL SUPERVISOR
        if (lowerEmail.includes('supervisor')) {
          const supId = 'admin-99';
          const dir = userPermissionsDirectory[supId];
          if (dir?.accessRevoked) {
            addToast('Acceso revocado por TI: Tus permisos de Supervisor han sido revocados.', 'error');
            return false;
          }
          const userActive = get().userActiveCheckins?.[supId] || null;
          const userHist = get().userHistories?.[supId] || [];
          set({
            user: {
              id: supId,
              name: 'Supervisor',
              lastName: 'Prueba',
              email: 'supervisor.prueba@russellbedford.mx',
              role: 'supervisor',
              verified: true,
              isProfileComplete: true,
              team: 'Equipo Prueba',
              expectedEntryTime: '09:00',
              status: 'active',
              created_by_ti_id: 'ti-root-01',
              createdByTiId: 'ti-root-01',
              assigned_team_members: ['usr-ana'],
              permissions: dir?.permissions || getDefaultPermissionsForRole('supervisor'),
              modules: dir?.modules || getDefaultModulesForRole('supervisor'),
              biometrics: dir?.biometrics || null,
              faceDescriptor: dir?.biometrics?.faceDescriptor,
              isBiometricsEnrolled: Boolean(dir?.biometrics?.faceDescriptor?.length),
              biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
            },
            isAuthenticated: true,
            activeCheckin: userActive,
            history: userHist,
          });
          return true;
        }

        // 6. NIVEL COLABORADOR (Operativo)
        if (
          lowerEmail.includes('colaborador') ||
          lowerEmail.includes('empleado') ||
          lowerEmail.includes('ana') ||
          lowerEmail === 'ana@russellbedford.mx' ||
          lowerEmail === 'colaborador.prueba@russellbedford.mx' ||
          lowerEmail === 'demo@russellbedford.mx'
        ) {
          const dir = userPermissionsDirectory['usr-ana'];
          if (dir?.accessRevoked) {
            addToast('Acceso revocado por TI: Tu cuenta de Colaborador tiene los permisos revocados.', 'error');
            return false;
          }
          const anaActive = get().userActiveCheckins?.['usr-ana'] || null;
          const anaHist = get().userHistories?.['usr-ana'] || generateMockHistory(15);
          set({
            user: {
              id: 'usr-ana',
              name: 'Colaborador',
              lastName: 'Prueba',
              email: 'colaborador.prueba@russellbedford.mx',
              role: 'colaborador',
              verified: true,
              isProfileComplete: true,
              team: 'Equipo Prueba',
              expectedEntryTime: '09:00',
              status: 'active',
              supervisor_id: 'admin-99',
              supervisorId: 'admin-99',
              supervisorName: 'Supervisor Prueba',
              permissions: dir?.permissions || getDefaultPermissionsForRole('colaborador'),
              modules: dir?.modules || getDefaultModulesForRole('colaborador'),
              biometrics: dir?.biometrics || null,
              faceDescriptor: dir?.biometrics?.faceDescriptor,
              isBiometricsEnrolled: Boolean(dir?.biometrics?.faceDescriptor?.length),
              biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
            },
            isAuthenticated: true,
            history: anaHist,
            activeCheckin: anaActive,
          });
          return true;
        }

        let existingEmp = mockEmployeesData.find((e) => e.email === lowerEmail);

        if (!existingEmp) {
          existingEmp = {
            id: 'user-' + Math.random().toString(36).substring(7),
            email: lowerEmail,
            name: lowerEmail.split('@')[0],
            role: 'Empleado',
            team: 'Equipo Prueba',
            status: 'active',
            isProfileComplete: true,
            workedMinutesToday: 0,
            history: generateMockHistory(5),
            expectedEntryTime: '09:00',
            supervisor_id: 'admin-99',
            modules: getDefaultModulesForRole('Empleado'),
          };
          set({ mockEmployeesData: [...mockEmployeesData, existingEmp] });
        }

        const dir = userPermissionsDirectory[existingEmp.id];
        if (dir?.accessRevoked) {
          addToast('Acceso revocado por Administración de TI.', 'error');
          return false;
        }
        const activeToday = existingEmp.history.find(
          (h) => h.date === getPastDateStr(0) && !h.checkOutTimeMs
        );
        const empActive = get().userActiveCheckins?.[existingEmp.id] || activeToday || null;
        const empHist = get().userHistories?.[existingEmp.id] || [...existingEmp.history];

        set({
          user: {
            id: existingEmp.id,
            name: existingEmp.name,
            email: existingEmp.email,
            role: existingEmp.role || 'Empleado',
            verified: true,
            isProfileComplete: existingEmp.isProfileComplete,
            team: existingEmp.team,
            expectedEntryTime: existingEmp.expectedEntryTime,
            supervisor_id: existingEmp.supervisor_id || 'admin-99',
            supervisorId: existingEmp.supervisor_id || 'admin-99',
            modules: dir?.modules || existingEmp.modules || getDefaultModulesForRole(existingEmp.role || 'Empleado'),
            biometrics: dir?.biometrics || existingEmp.biometrics || null,
            faceDescriptor: dir?.biometrics?.faceDescriptor || existingEmp.biometrics?.faceDescriptor,
            isBiometricsEnrolled: Boolean(
              dir?.biometrics?.faceDescriptor?.length || existingEmp.biometrics?.faceDescriptor?.length
            ),
            biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
          },
          isAuthenticated: true,
          history: empHist,
          activeCheckin: empActive,
        });

        return true;
      },

      logout: () => {
        const currentUser = get().user;
        const currentActive = get().activeCheckin;
        const currentHistory = get().history;

        const nextUserActiveCheckins = { ...get().userActiveCheckins };
        const nextUserHistories = { ...get().userHistories };

        if (currentUser) {
          if (currentActive) {
            nextUserActiveCheckins[currentUser.id] = currentActive;
          }
          if (currentHistory && currentHistory.length > 0) {
            nextUserHistories[currentUser.id] = currentHistory;
          }
        }

        set({
          user: null,
          isAuthenticated: false,
          activeCheckin: null,
          history: [],
          userActiveCheckins: nextUserActiveCheckins,
          userHistories: nextUserHistories,
        });
      },

      loginWithFirebaseUser: (fbUser, invitationData) => {
        const { mockEmployeesData, userPermissionsDirectory } = get();
        const userEmail = (fbUser.email || '').toLowerCase().trim();

        // 1. Buscar si el usuario ya existe por UID o por Email (soporte vinculación Google <-> Contraseña)
        const existingEmp = mockEmployeesData.find(
          (e) => e.id === fbUser.uid || (e.email && e.email.toLowerCase().trim() === userEmail)
        );
        const existingDir =
          userPermissionsDirectory[fbUser.uid] ||
          Object.values(userPermissionsDirectory).find(
            (u) => u.email.toLowerCase().trim() === userEmail
          );

        // 2. Determinar si el perfil ya está completo:
        // PRESERVAR SIEMPRE si el perfil ya estaba completo para evitar el bucle de re-registro
        const isProfileComplete =
          invitationData?.isProfileComplete !== undefined
            ? Boolean(invitationData.isProfileComplete)
            : Boolean(existingEmp?.isProfileComplete || (existingEmp?.name && existingEmp?.role));

        // 3. Determinar rol asignado (priorizando perfil existente, luego invitación, luego heurística)
        let assignedRole: UserRole =
          (existingEmp?.role ? normalizeRole(existingEmp.role) : undefined) ||
          (existingDir?.role ? normalizeRole(existingDir.role) : undefined) ||
          'Colaborador';

        if (invitationData?.role) {
          assignedRole = normalizeRole(invitationData.role);
        } else if (!existingEmp?.role && !existingDir?.role) {
          if (userEmail.includes('ti.') || userEmail.includes('root')) {
            assignedRole = 'TI';
          } else if (userEmail.includes('rh.') || userEmail.startsWith('rh@')) {
            assignedRole = 'RH';
          } else if (userEmail.includes('supervisor')) {
            assignedRole = 'Supervisor';
          }
        }

        const defaultMods = getDefaultModulesForRole(assignedRole);
        const effectiveMods = existingDir?.modules || existingEmp?.modules || defaultMods;

        // 4. Nombre y Apellido
        const rawName =
          existingEmp?.name ||
          existingDir?.name ||
          fbUser.displayName ||
          (userEmail ? userEmail.split('@')[0] : 'Colaborador');
        const [firstName, ...restName] = rawName.split(' ');

        // 5. Captura y persistencia de foto de Google (photoURL)
        const resolvedPhotoURL =
          fbUser.photoURL || existingEmp?.photoURL || existingDir?.photoURL || null;
        const resolvedProfileImage =
          resolvedPhotoURL || existingEmp?.profileImage || undefined;

        const resolvedTeam =
          invitationData?.team ||
          existingEmp?.team ||
          existingDir?.team ||
          (assignedRole === 'TI' ? 'TI Root' : 'Sin equipo asignado');

        const resolvedSupervisorId =
          assignedRole === 'Colaborador'
            ? invitationData?.supervisorId || existingEmp?.supervisor_id || existingDir?.supervisor_id || 'admin-99'
            : null;

        const resolvedCreatedByTiId =
          assignedRole === 'Supervisor'
            ? invitationData?.created_by_ti_id || existingEmp?.created_by_ti_id || existingDir?.created_by_ti_id || 'ti-root-01'
            : null;

        const defaultPerms = getDefaultPermissionsForRole(assignedRole);
        const resolvedPermissions =
          existingDir?.permissions || existingEmp?.permissions || defaultPerms;
        const resolvedAssignedTeams =
          invitationData?.assignedTeams ||
          existingDir?.assignedTeams ||
          existingEmp?.assignedTeams ||
          (assignedRole === 'Gerente' || assignedRole === 'RH' ? (resolvedTeam !== 'Sin equipo asignado' ? [resolvedTeam] : []) : undefined);

        const resolvedStatus: 'active' | 'inactive' =
          invitationData?.status ||
          existingEmp?.status ||
          (existingDir?.accessRevoked ? 'inactive' : 'active');
        const resolvedIsActive =
          invitationData?.isActive !== undefined
            ? invitationData.isActive
            : resolvedStatus !== 'inactive' && !existingDir?.accessRevoked;

        const updatedEmp: MockEmployee = {
          id: fbUser.uid,
          email: userEmail,
          name: rawName,
          role: assignedRole,
          team: resolvedTeam,
          assignedTeams: resolvedAssignedTeams,
          permissions: resolvedPermissions,
          status: resolvedStatus,
          isProfileComplete,
          workedMinutesToday: existingEmp?.workedMinutesToday || 0,
          history: existingEmp?.history || [],
          expectedEntryTime: existingEmp?.expectedEntryTime || '09:00',
          supervisor_id: resolvedSupervisorId,
          created_by_ti_id: resolvedCreatedByTiId,
          modules: effectiveMods,
          biometrics: existingDir?.biometrics || existingEmp?.biometrics || null,
          photoURL: resolvedPhotoURL,
          profileImage: resolvedProfileImage,
        };

        const fbActive = get().userActiveCheckins?.[fbUser.uid] || null;
        const fbHist = existingEmp?.history || get().userHistories?.[fbUser.uid] || [];

        set({
          mockEmployeesData: [
            ...mockEmployeesData.filter(
              (e) => e.id !== fbUser.uid && e.email.toLowerCase().trim() !== userEmail
            ),
            updatedEmp,
          ],
          userPermissionsDirectory: {
            ...userPermissionsDirectory,
            [fbUser.uid]: {
              id: fbUser.uid,
              name: rawName,
              email: userEmail,
              role: assignedRole,
              team: updatedEmp.team,
              assignedTeams: resolvedAssignedTeams,
              permissions: resolvedPermissions,
              modules: effectiveMods,
              biometrics: updatedEmp.biometrics || null,
              photoURL: resolvedPhotoURL,
              supervisor_id: resolvedSupervisorId,
              created_by_ti_id: resolvedCreatedByTiId,
            },
          },
          user: {
            id: updatedEmp.id,
            name: firstName || rawName,
            lastName: restName.join(' '),
            email: updatedEmp.email,
            photoURL: resolvedPhotoURL,
            profileImage: resolvedProfileImage,
            role: assignedRole,
            verified: true,
            isProfileComplete,
            team: updatedEmp.team,
            teamId: (invitationData as any)?.teamId,
            assignedTeams: resolvedAssignedTeams,
            status: resolvedStatus,
            isActive: resolvedIsActive,
            accessRevoked: !resolvedIsActive,
            expectedEntryTime: '09:00',
            supervisor_id: updatedEmp.supervisor_id,
            supervisorId: updatedEmp.supervisor_id || undefined,
            supervisorName: invitationData?.supervisorName,
            supervisorCode: invitationData?.supervisorCode,
            invitationToken: invitationData?.token,
            created_by_ti_id: updatedEmp.created_by_ti_id,
            createdByTiId: updatedEmp.created_by_ti_id || undefined,
            assigned_team_members: assignedRole === 'Supervisor' ? [] : undefined,
            permissions: resolvedPermissions,
            modules: effectiveMods,
            biometrics: updatedEmp.biometrics || null,
            faceDescriptor: updatedEmp.biometrics?.faceDescriptor,
            isBiometricsEnrolled: Boolean(updatedEmp.biometrics?.faceDescriptor?.length),
            biometricThreshold: DEFAULT_BIOMETRIC_THRESHOLD,
          },
          isAuthenticated: true,
          history: fbHist,
          activeCheckin: fbActive,
        });
      },

      updateProfile: (data) => {
        const { user, mockEmployeesData, userPermissionsDirectory } = get();
        if (!user) return;

        const normalizedRole = data.role ? normalizeRole(data.role) : normalizeRole(user.role);
        const dirEntry = userPermissionsDirectory[user.id];
        const nextModules =
          data.modules ||
          dirEntry?.modules ||
          (data.role && normalizeRole(data.role) !== normalizeRole(user.role)
            ? getDefaultModulesForRole(normalizedRole)
            : user.modules || getDefaultModulesForRole(normalizedRole));

        const fullName = `${data.name || user.name} ${data.lastName ?? user.lastName ?? ''}`.trim();

        const updatedUser: User = {
          ...user,
          ...data,
          photoURL: data.photoURL !== undefined ? data.photoURL : user.photoURL,
          profileImage: data.photoURL || data.profileImage || user.profileImage,
          role: normalizedRole,
          modules: nextModules,
          supervisor_id: data.supervisor_id ?? data.supervisorId ?? user.supervisor_id,
          supervisorId: data.supervisorId ?? data.supervisor_id ?? user.supervisorId,
          created_by_ti_id: data.created_by_ti_id ?? data.createdByTiId ?? user.created_by_ti_id,
          isProfileComplete: data.isProfileComplete ?? user.isProfileComplete ?? true,
        };

        const updatedMockData = mockEmployeesData.map((emp) =>
          emp.id === user.id
            ? {
                ...emp,
                name: fullName,
                team: data.team || emp.team,
                role: normalizedRole,
                supervisor_id: updatedUser.supervisor_id,
                created_by_ti_id: updatedUser.created_by_ti_id,
                modules: nextModules,
                isProfileComplete: updatedUser.isProfileComplete,
                photoURL: updatedUser.photoURL,
                profileImage: updatedUser.profileImage,
              }
            : emp
        );

        set({
          user: updatedUser,
          mockEmployeesData: updatedMockData,
          userPermissionsDirectory: {
            ...userPermissionsDirectory,
            [user.id]: {
              id: user.id,
              name: fullName,
              email: updatedUser.email,
              role: normalizedRole,
              team: updatedUser.team,
              modules: nextModules,
              biometrics: updatedUser.biometrics || dirEntry?.biometrics || null,
              photoURL: updatedUser.photoURL,
            },
          },
        });
      },

      setBiometricThreshold: (threshold) => {
        const { user } = get();
        if (!user) return;
        const clamped = Math.min(0.65, Math.max(0.42, Number(threshold.toFixed(2))));
        set({
          user: {
            ...user,
            biometricThreshold: clamped,
          },
        });
      },

      enrollBiometrics: async (descriptor, endpointTarget = 'me', threshold) => {
        const { user, mockEmployeesData, userPermissionsDirectory, addToast } = get();
        const vectorRecord = buildBiometricVectorRecord(descriptor);

        if (!user) return vectorRecord;

        // Enviar al endpoint PUT /api/users/me/biometrics y PUT /api/users/:id/biometrics (sin imágenes)
        const targetParam = endpointTarget === 'me' ? 'me' : user.id;
        const apiRes = await updateUserBiometricsApi(targetParam, vectorRecord.faceDescriptor, {
          id: user.id,
          role: user.role,
        });
        if (targetParam === 'me') {
          await updateUserBiometricsApi(user.id, vectorRecord.faceDescriptor, {
            id: user.id,
            role: user.role,
          });
        }

        const savedBiometrics = apiRes.biometrics || vectorRecord;
        const nextThreshold =
          typeof threshold === 'number'
            ? Math.min(0.65, Math.max(0.42, threshold))
            : user.biometricThreshold || DEFAULT_BIOMETRIC_THRESHOLD;

        const updatedUser: User = {
          ...user,
          faceDescriptor: savedBiometrics.faceDescriptor,
          biometrics: savedBiometrics,
          biometricThreshold: nextThreshold,
          isBiometricsEnrolled: true,
        };

        const updatedMockData = mockEmployeesData.map((emp) =>
          emp.id === user.id
            ? { ...emp, biometrics: savedBiometrics }
            : emp
        );

        const existingDir = userPermissionsDirectory[user.id];
        const nextDirectory = {
          ...userPermissionsDirectory,
          [user.id]: {
            id: user.id,
            name: `${user.name} ${user.lastName || ''}`.trim(),
            email: user.email,
            role: normalizeRole(user.role),
            team: user.team,
            modules: existingDir?.modules || getEffectiveModules(user),
            biometrics: savedBiometrics,
          },
        };

        set({
          user: updatedUser,
          mockEmployeesData: updatedMockData,
          userPermissionsDirectory: nextDirectory,
        });

        broadcastPermissionsUpdate({ userId: user.id, biometricsUpdated: true });
        addToast(
          'Vector biométrico facial guardado (128 floats, 0 imágenes almacenadas).',
          'success'
        );

        return savedBiometrics;
      },

      startCheckin: async (lat, lng, address, matchScore, biometricDistance, initialTaskData) => {
        const { user, history, mockEmployeesData, addToast } = get();
        if (!user) return;

        const [secureTimeMs, clientIp] = await Promise.all([
          getSecureServerTime(),
          captureClientIP(),
        ]);

        const { late, minutesLate } = calculateLateness(secureTimeMs, user.expectedEntryTime);

        if (late) {
          addToast(
            `Registro tardío: Tienes ${minutesLate} minutos de retardo respecto a tu horario (${user.expectedEntryTime} AM).`,
            'error'
          );
        }

        const dateIsoStr = new Date(secureTimeMs).toISOString().split('T')[0];
        const nowTimeStr = new Date(secureTimeMs).toLocaleTimeString('es-MX', { hour12: false });

        const initialIntervals: TaskInterval[] = initialTaskData
          ? [
              {
                taskId: initialTaskData.taskId,
                taskName: initialTaskData.taskName,
                company: initialTaskData.company || 'Russell Bedford',
                startTime: nowTimeStr,
                endTime: null,
                durationSeconds: 0,
                startMs: secureTimeMs,
                endMs: null,
              },
            ]
          : [];

        const newRecord: CheckinRecord = {
          id: Math.random().toString(36).substring(2, 11),
          date: dateIsoStr,
          checkInTimeMs: secureTimeMs,
          checkOutTimeMs: null,
          pauses: [],
          location: { lat, lng },
          address,
          totalDurationMinutes: null,
          clientIp,
          isLate: late,
          minutesLate,
          biometricMatchScore: matchScore ?? null,
          biometricDistance: biometricDistance ?? null,
          status: 'active',
          workdayTotalSeconds: 0,
          taskIntervals: initialIntervals,
        };

        const updatedMockData = mockEmployeesData.map((emp) =>
          emp.id === user.id
            ? {
                ...emp,
                status: 'active' as const,
                history: [newRecord, ...emp.history],
              }
            : emp
        );

        const nextUserActiveCheckins = {
          ...get().userActiveCheckins,
          [user.id]: newRecord,
        };
        const nextUserHistories = {
          ...get().userHistories,
          [user.id]: [newRecord, ...history],
        };

        set({
          activeCheckin: newRecord,
          userActiveCheckins: nextUserActiveCheckins,
          userHistories: nextUserHistories,
          history: [newRecord, ...history],
          mockEmployeesData: updatedMockData,
        });
      },

      switchActiveTask: (taskData) => {
        const { activeCheckin, user, history, mockEmployeesData } = get();
        if (!activeCheckin || !user) return;

        const now = Date.now();
        const nowTimeStr = new Date(now).toLocaleTimeString('es-MX', { hour12: false });
        const currentIntervals = activeCheckin.taskIntervals ? [...activeCheckin.taskIntervals] : [];

        // 1. Cerrar intervalo de la tarea previa si estaba corriendo
        const closedIntervals = currentIntervals.map((interval) => {
          if (!interval.endMs) {
            const durationSecs = Math.max(0, Math.floor((now - interval.startMs) / 1000));
            return {
              ...interval,
              endMs: now,
              endTime: nowTimeStr,
              durationSeconds: durationSecs,
            };
          }
          return interval;
        });

        // 2. Abrir intervalo para la nueva tarea si existe
        if (taskData) {
          const newInterval: TaskInterval = {
            taskId: taskData.taskId,
            taskName: taskData.taskName,
            company: taskData.company || 'Russell Bedford',
            startTime: nowTimeStr,
            endTime: null,
            durationSeconds: 0,
            startMs: now,
            endMs: null,
          };
          closedIntervals.push(newInterval);
        }

        // El checkInTimeMs y pauses de la jornada permanecen INMUTABLES
        const updatedRecord: CheckinRecord = {
          ...activeCheckin,
          taskIntervals: closedIntervals,
        };

        const nextUserActiveCheckins = {
          ...get().userActiveCheckins,
          [user.id]: updatedRecord,
        };

        set({
          activeCheckin: updatedRecord,
          userActiveCheckins: nextUserActiveCheckins,
          history: history.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
          mockEmployeesData: mockEmployeesData.map((emp) =>
            emp.id === user.id
              ? {
                  ...emp,
                  history: emp.history.map((h) => (h.id === updatedRecord.id ? updatedRecord : h)),
                }
              : emp
          ),
        });
      },

      pauseCheckin: async () => {
        const { activeCheckin, history, mockEmployeesData, user } = get();
        if (!activeCheckin || !user) return;

        const secureTimeMs = await getSecureServerTime();

        const newPause: PauseBlock = {
          startMs: secureTimeMs,
          endMs: null,
        };

        const updatedRecord: CheckinRecord = {
          ...activeCheckin,
          status: 'paused',
          pauses: [...activeCheckin.pauses, newPause],
        };

        const updatedMockData = mockEmployeesData.map((emp) =>
          emp.id === user.id
            ? {
                ...emp,
                status: 'inactive' as const,
                history: emp.history.map((h) => (h.id === updatedRecord.id ? updatedRecord : h)),
              }
            : emp
        );

        const nextUserActiveCheckins = {
          ...get().userActiveCheckins,
          [user.id]: updatedRecord,
        };

        set({
          activeCheckin: updatedRecord,
          userActiveCheckins: nextUserActiveCheckins,
          history: history.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
          mockEmployeesData: updatedMockData,
        });
      },

      resumeCheckin: async () => {
        const { activeCheckin, history, mockEmployeesData, user } = get();
        if (!activeCheckin || !user || activeCheckin.pauses.length === 0) return;

        const secureTimeMs = await getSecureServerTime();

        const updatedPauses = [...activeCheckin.pauses];
        updatedPauses[updatedPauses.length - 1].endMs = secureTimeMs;

        const updatedRecord: CheckinRecord = {
          ...activeCheckin,
          status: 'active',
          pauses: updatedPauses,
        };

        const updatedMockData = mockEmployeesData.map((emp) =>
          emp.id === user.id
            ? {
                ...emp,
                status: 'active' as const,
                history: emp.history.map((h) => (h.id === updatedRecord.id ? updatedRecord : h)),
              }
            : emp
        );

        const nextUserActiveCheckins = {
          ...get().userActiveCheckins,
          [user.id]: updatedRecord,
        };

        set({
          activeCheckin: updatedRecord,
          userActiveCheckins: nextUserActiveCheckins,
          history: history.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
          mockEmployeesData: updatedMockData,
        });
      },

      endCheckin: async () => {
        const { activeCheckin, history, mockEmployeesData, user } = get();
        if (!activeCheckin || !activeCheckin.checkInTimeMs || !user) return;

        const secureTimeMs = await getSecureServerTime();

        const updatedPauses = [...activeCheckin.pauses];
        if (updatedPauses.length > 0 && !updatedPauses[updatedPauses.length - 1].endMs) {
          updatedPauses[updatedPauses.length - 1].endMs = secureTimeMs;
        }

        let totalPauseMs = 0;
        updatedPauses.forEach((p) => {
          if (p.endMs) totalPauseMs += p.endMs - p.startMs;
        });

        const effectiveMs = secureTimeMs - activeCheckin.checkInTimeMs - totalPauseMs;
        const durationMinutes = Math.floor(effectiveMs / 60000);
        const workdayTotalSeconds = Math.max(0, Math.floor(effectiveMs / 1000));
        const nowTimeStr = new Date(secureTimeMs).toLocaleTimeString('es-MX', { hour12: false });

        // Cerrar cualquier intervalo pendiente al finalizar jornada
        const closedIntervals = (activeCheckin.taskIntervals || []).map((interval) => {
          if (!interval.endMs) {
            const durationSecs = Math.max(0, Math.floor((secureTimeMs - interval.startMs) / 1000));
            return {
              ...interval,
              endMs: secureTimeMs,
              endTime: nowTimeStr,
              durationSeconds: durationSecs,
            };
          }
          return interval;
        });

        const updatedRecord: CheckinRecord = {
          ...activeCheckin,
          pauses: updatedPauses,
          checkOutTimeMs: secureTimeMs,
          totalDurationMinutes: durationMinutes,
          status: 'completed',
          workdayTotalSeconds,
          taskIntervals: closedIntervals,
        };

        const updatedMockData = mockEmployeesData.map((emp) => {
          if (emp.id === user.id) {
            return {
              ...emp,
              status: 'inactive' as const,
              workedMinutesToday: emp.workedMinutesToday + durationMinutes,
              history: emp.history.map((h) => (h.id === updatedRecord.id ? updatedRecord : h)),
            };
          }
          return emp;
        });

        const nextUserActiveCheckins = { ...get().userActiveCheckins };
        delete nextUserActiveCheckins[user.id];

        const updatedHistory = history.map((r) => (r.id === updatedRecord.id ? updatedRecord : r));
        const nextUserHistories = {
          ...get().userHistories,
          [user.id]: updatedHistory,
        };

        set({
          activeCheckin: null,
          userActiveCheckins: nextUserActiveCheckins,
          userHistories: nextUserHistories,
          history: updatedHistory,
          mockEmployeesData: updatedMockData,
        });
      },

      requestPasswordReset: (email: string) => {
        set({ pendingEmail: email, verificationType: 'recovery' });
      },
      verifyCode: (code: string) => {
        return code === '123456';
      },
      resetPassword: (_password: string) => {
        set({ pendingEmail: undefined, verificationType: undefined });
      },
      registerUser: (email: string, _password?: string) => {
        set({ pendingEmail: email, verificationType: 'registration' });
      },
    }),
    {
      name: 'checkin-rb-storage-v2',
      partialize: (state) => {
        // Garantizar en persistencia que jamás se guarde ninguna imagen biométrica base64 heredada
        const cleanUser = state.user
          ? (() => {
              const copy = { ...state.user } as Record<string, unknown>;
              delete copy.enrolledFacePhoto;
              delete copy.facePhotoUrl;
              return copy as unknown as User;
            })()
          : null;

        return {
          mockEmployeesData: state.mockEmployeesData,
          userPermissionsDirectory: state.userPermissionsDirectory,
          user: cleanUser,
          isAuthenticated: state.isAuthenticated,
          activeCheckin: state.activeCheckin,
          userActiveCheckins: state.userActiveCheckins || {},
          userHistories: state.userHistories || {},
          history: state.history,
          absenceJustifications: state.absenceJustifications || {},
          theme: state.theme || 'dark',
        };
      },
      onRehydrateStorage: () => (state) => {
        const currentTheme = state?.theme || 'dark';
        if (typeof document !== 'undefined') {
          if (currentTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          document.documentElement.setAttribute('data-theme', currentTheme);
        }
      },
    }
  )
);

// Sincronización en caliente entre pestañas cuando TI cambia permisos por checkboxes
if (typeof window !== 'undefined') {
  const syncFromStorage = () => {
    useCheckinStore.persist.rehydrate();
    const state = useCheckinStore.getState();
    if (state.user && state.userPermissionsDirectory[state.user.id]) {
      const latestDir = state.userPermissionsDirectory[state.user.id];
      if (latestDir.accessRevoked) {
        state.addToast('Tus permisos han sido revocados en tiempo real por Administración de TI.', 'error');
        state.logout();
        return;
      }
      useCheckinStore.setState({
        user: {
          ...state.user,
          modules: latestDir.modules,
          biometrics: latestDir.biometrics ?? state.user.biometrics,
          faceDescriptor:
            latestDir.biometrics?.faceDescriptor ?? state.user.faceDescriptor,
          isBiometricsEnrolled: Boolean(
            latestDir.biometrics?.faceDescriptor?.length || state.user.faceDescriptor?.length
          ),
        },
      });
    }
  };

  permissionsRealtimeChannel?.addEventListener('message', (event) => {
    if (event.data?.type === 'PERMISSIONS_OR_BIOMETRICS_UPDATED') {
      syncFromStorage();
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'checkin-rb-storage-v2') {
      syncFromStorage();
    }
  });
}
