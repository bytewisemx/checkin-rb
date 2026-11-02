import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSecureServerTime, captureClientIP, calculateLateness } from '../services/security';
import {
  normalizeRole,
  getDefaultModulesForRole,
  getEffectiveModules,
  updateUserModulesApi,
  updateUserBiometricsApi,
  type UserRole,
  type UserModules,
  type BiometricVectorRecord,
} from '../services/rbac';
import {
  buildBiometricVectorRecord,
  DEFAULT_BIOMETRIC_THRESHOLD,
} from '../services/facialBiometrics';
import { useRayonerStore } from './useRayonerStore';

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
  role: UserRole | 'employee' | 'supervisor';
  verified: boolean;
  birthDate?: string;
  team?: string;
  status?: 'active' | 'inactive';
  isProfileComplete: boolean;
  expectedEntryTime: string;
  profileImage?: string; // Avatar SVG o ilustración de perfil (NO imagen de biometría)
  // Biometría vectorial estrictamente SIN imágenes (solo floats, fecha ISO y versión de modelo)
  faceDescriptor?: number[];
  biometrics?: BiometricVectorRecord | null;
  biometricThreshold?: number;
  isBiometricsEnrolled?: boolean;
  // Permisos granulares por usuario gestionados por TI
  modules?: UserModules;
  // Referencias jerárquicas requeridas
  supervisor_id?: string | null;
  supervisorId?: string;
  supervisorName?: string;
  created_by_ti_id?: string | null;
  createdByTiId?: string;
  assigned_team_members?: string[];
}

export interface ManagedUserPermissionEntry {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  team?: string;
  modules: UserModules;
  biometrics?: BiometricVectorRecord | null;
}

export interface PauseBlock {
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
}

export interface MockEmployee {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  team: string;
  status: 'active' | 'inactive';
  workedMinutesToday: number;
  isProfileComplete: boolean;
  history: CheckinRecord[];
  expectedEntryTime: string;
  supervisor_id?: string | null;
  created_by_ti_id?: string | null;
  modules?: UserModules;
  biometrics?: BiometricVectorRecord | null;
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
      supervisorId: string;
      supervisorName: string;
      team: string;
      roleTitle?: string;
      role?: UserRole | 'employee' | 'supervisor';
      created_by_ti_id?: string | null;
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

  // Gestión granular de módulos por usuario (Panel TI)
  updateUserModules: (
    targetUserId: string,
    modules: UserModules,
    meta?: { name?: string; email?: string; role?: UserRole; team?: string }
  ) => Promise<void>;
  getEffectiveUserModules: (userId?: string) => UserModules;

  startCheckin: (
    lat: number,
    lng: number,
    address: string,
    matchScore?: number,
    biometricDistance?: number
  ) => Promise<void>;
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
    name: 'Administrador TI (Root)',
    email: 'ti.root@russellbedford.mx',
    role: 'TI',
    team: 'Infraestructura & Seguridad TI',
    modules: getDefaultModulesForRole('TI'),
    biometrics: null,
  },
  'admin-99': {
    id: 'admin-99',
    name: 'Supervisor Prueba',
    email: 'supervisor.prueba@russellbedford.mx',
    role: 'Supervisor',
    team: 'Administración y Supervisión',
    modules: getDefaultModulesForRole('Supervisor'), // facialCheckIn: false por defecto (Exento)
    biometrics: null,
  },
  'sup-1': {
    id: 'sup-1',
    name: 'Mtro. Roberto Silva',
    email: 'roberto.silva@russellbedford.mx',
    role: 'Supervisor',
    team: 'Supervisión Auditoría Fiscal',
    modules: getDefaultModulesForRole('Supervisor'), // facialCheckIn: false por defecto (Exento)
    biometrics: null,
  },
  'rh-01': {
    id: 'rh-01',
    name: 'Dirección Recursos Humanos (RH)',
    email: 'rh.prueba@russellbedford.mx',
    role: 'RH',
    team: 'Capital Humano y Asistencia',
    modules: getDefaultModulesForRole('RH'),
    biometrics: null,
  },
  'usr-ana': {
    id: 'usr-ana',
    name: 'Colaborador Prueba',
    email: 'colaborador.prueba@russellbedford.mx',
    role: 'Empleado',
    team: 'Auditoría Fiscal',
    modules: getDefaultModulesForRole('Empleado'),
    biometrics: null,
  },
  'usr-carlos': {
    id: 'usr-carlos',
    name: 'Carlos Ruiz',
    email: 'carlos.ruiz@russellbedford.mx',
    role: 'Empleado',
    team: 'Auditoría Fiscal',
    modules: getDefaultModulesForRole('Empleado'),
    biometrics: null,
  },
  'usr-luis': {
    id: 'usr-luis',
    name: 'Luis Mendoza',
    email: 'luis.mendoza@russellbedford.mx',
    role: 'Empleado',
    team: 'Consultoría e Impuestos',
    modules: getDefaultModulesForRole('Empleado'),
    biometrics: null,
  },
  'usr-sofia': {
    id: 'usr-sofia',
    name: 'Sofía Valdés',
    email: 'sofia.valdes@russellbedford.mx',
    role: 'Empleado',
    team: 'Contabilidad Corporativa',
    modules: {
      // Ejemplo práctico inicial o configurable: empleada activa
      checkIn: true,
      facialCheckIn: true,
      tasks: true,
      reports: false,
      clients: false,
    },
    biometrics: null,
  },
  'usr-miguel': {
    id: 'usr-miguel',
    name: 'Miguel Ángel Ramos',
    email: 'miguel.ramos@russellbedford.mx',
    role: 'Empleado',
    team: 'Precios de Transferencia',
    modules: getDefaultModulesForRole('Empleado'),
    biometrics: null,
  },
};

const initialMockEmployees: MockEmployee[] = [
  {
    id: 'usr-ana',
    email: 'colaborador.prueba@russellbedford.mx',
    name: 'Colaborador Prueba',
    role: 'Empleado',
    team: 'Auditoría Fiscal',
    status: 'active',
    isProfileComplete: true,
    workedMinutesToday: 405,
    expectedEntryTime: '09:00',
    supervisor_id: 'admin-99',
    modules: getDefaultModulesForRole('Empleado'),
    history: generateMockHistory(20),
  },
  {
    id: 'usr-carlos',
    email: 'carlos.ruiz@russellbedford.mx',
    name: 'Carlos Ruiz',
    role: 'Empleado',
    team: 'Auditoría Fiscal',
    status: 'active',
    isProfileComplete: true,
    workedMinutesToday: 330,
    expectedEntryTime: '09:00',
    supervisor_id: 'admin-99',
    modules: getDefaultModulesForRole('Empleado'),
    history: generateMockHistory(15),
  },
  {
    id: 'usr-luis',
    email: 'luis.mendoza@russellbedford.mx',
    name: 'Luis Mendoza',
    role: 'Empleado',
    team: 'Consultoría e Impuestos',
    status: 'active',
    isProfileComplete: true,
    workedMinutesToday: 450,
    expectedEntryTime: '09:00',
    supervisor_id: 'admin-99',
    modules: getDefaultModulesForRole('Empleado'),
    history: generateMockHistory(18),
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

      login: (email, password) => {
        const { addToast, mockEmployeesData, userPermissionsDirectory } = get();
        const lowerEmail = email.trim().toLowerCase();

        if (password !== 'admin123') {
          addToast('Contraseña incorrecta. (Usa: admin123)', 'error');
          return false;
        }

        // 1. NIVEL TI (Root / Administrador del Sistema)
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
              name: 'Administrador',
              lastName: 'TI (Root)',
              email: 'ti.root@russellbedford.mx',
              role: 'TI',
              verified: true,
              isProfileComplete: true,
              team: 'Infraestructura & Seguridad TI',
              expectedEntryTime: '09:00',
              status: 'active',
              modules: dir?.modules || getDefaultModulesForRole('TI'),
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

        // 2. NIVEL RH (Recursos Humanos - Perfil Restringido)
        if (
          lowerEmail.includes('rh.') ||
          lowerEmail.startsWith('rh@') ||
          lowerEmail.includes('recursoshumanos') ||
          lowerEmail === 'rh.auditoria@russellbedford.mx' ||
          lowerEmail === 'rh.prueba@russellbedford.mx'
        ) {
          const dir = userPermissionsDirectory['rh-01'];
          const userActive = get().userActiveCheckins?.['rh-01'] || null;
          const userHist = get().userHistories?.['rh-01'] || [];
          set({
            user: {
              id: 'rh-01',
              name: 'Dirección',
              lastName: 'Recursos Humanos (RH)',
              email: 'rh.prueba@russellbedford.mx',
              role: 'RH',
              verified: true,
              isProfileComplete: true,
              team: 'Capital Humano y Asistencia',
              expectedEntryTime: '09:00',
              status: 'active',
              modules: dir?.modules || getDefaultModulesForRole('RH'),
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

        // 3. NIVEL SUPERVISOR (Líder de Equipo - Exento de biometría por defecto salvo flag de TI)
        if (lowerEmail.includes('supervisor') || lowerEmail.includes('silva')) {
          const isSilva = lowerEmail.includes('silva');
          const supId = isSilva ? 'sup-1' : 'admin-99';
          const dir = userPermissionsDirectory[supId];
          const userActive = get().userActiveCheckins?.[supId] || null;
          const userHist = get().userHistories?.[supId] || [];
          set({
            user: {
              id: supId,
              name: isSilva ? 'Mtro. Roberto' : 'Supervisor',
              lastName: isSilva ? 'Silva' : 'Prueba',
              email: isSilva ? 'roberto.silva@russellbedford.mx' : 'supervisor.prueba@russellbedford.mx',
              role: 'Supervisor',
              verified: true,
              isProfileComplete: true,
              team: 'Administración y Supervisión',
              expectedEntryTime: '09:00',
              status: 'active',
              created_by_ti_id: 'ti-root-01',
              createdByTiId: 'ti-root-01',
              assigned_team_members: isSilva
                ? ['usr-miguel']
                : ['usr-ana', 'usr-carlos', 'usr-luis', 'usr-sofia'],
              modules: dir?.modules || getDefaultModulesForRole('Supervisor'),
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

        // 4. NIVEL EMPLEADO / OPERATIVO (Subordinado)
        if (
          lowerEmail.includes('colaborador') ||
          lowerEmail.includes('ana') ||
          lowerEmail === 'ana@russellbedford.mx' ||
          lowerEmail === 'colaborador.prueba@russellbedford.mx' ||
          lowerEmail === 'demo@russellbedford.mx'
        ) {
          const dir = userPermissionsDirectory['usr-ana'];
          const anaActive = get().userActiveCheckins?.['usr-ana'] || null;
          const anaHist = get().userHistories?.['usr-ana'] || generateMockHistory(15);
          set({
            user: {
              id: 'usr-ana',
              name: 'Colaborador',
              lastName: 'Prueba',
              email: 'colaborador.prueba@russellbedford.mx',
              role: 'Empleado',
              verified: true,
              isProfileComplete: true,
              team: 'Auditoría Fiscal',
              expectedEntryTime: '09:00',
              status: 'active',
              supervisor_id: 'admin-99',
              supervisorId: 'admin-99',
              supervisorName: 'Supervisor Prueba',
              modules: dir?.modules || getDefaultModulesForRole('Empleado'),
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
            team: 'Auditoría Fiscal',
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
        const userEmail = (fbUser.email || '').toLowerCase();

        let assignedRole: UserRole = 'Empleado';
        if (invitationData?.role) {
          assignedRole = normalizeRole(invitationData.role);
        } else if (userEmail.includes('ti.') || userEmail.includes('root')) {
          assignedRole = 'TI';
        } else if (userEmail.includes('rh.') || userEmail.startsWith('rh@')) {
          assignedRole = 'RH';
        } else if (userEmail.includes('supervisor')) {
          assignedRole = 'Supervisor';
        }

        const defaultMods = getDefaultModulesForRole(assignedRole);
        const existingDir = userPermissionsDirectory[fbUser.uid];
        const effectiveMods = existingDir?.modules || defaultMods;

        const rawName = fbUser.displayName || (userEmail ? userEmail.split('@')[0] : 'Colaborador');
        const [firstName, ...restName] = rawName.split(' ');

        const newEmp: MockEmployee = {
          id: fbUser.uid,
          email: userEmail,
          name: firstName || 'Usuario',
          role: assignedRole,
          team: invitationData?.team || (assignedRole === 'Supervisor' ? 'Supervisión General' : 'Auditoría Fiscal'),
          status: 'active',
          isProfileComplete: false,
          workedMinutesToday: 0,
          history: [],
          expectedEntryTime: '09:00',
          supervisor_id: assignedRole === 'Empleado' ? invitationData?.supervisorId || 'admin-99' : null,
          created_by_ti_id:
            assignedRole === 'Supervisor'
              ? invitationData?.created_by_ti_id || invitationData?.supervisorId || 'ti-root-01'
              : null,
          modules: effectiveMods,
          biometrics: existingDir?.biometrics || null,
        };

        const fbActive = get().userActiveCheckins?.[fbUser.uid] || null;
        const fbHist = get().userHistories?.[fbUser.uid] || [];

        set({
          mockEmployeesData: [
            ...mockEmployeesData.filter((e) => e.id !== fbUser.uid && e.email !== userEmail),
            newEmp,
          ],
          userPermissionsDirectory: {
            ...userPermissionsDirectory,
            [fbUser.uid]: {
              id: fbUser.uid,
              name: rawName,
              email: userEmail,
              role: assignedRole,
              team: newEmp.team,
              modules: effectiveMods,
              biometrics: existingDir?.biometrics || null,
            },
          },
          user: {
            id: newEmp.id,
            name: newEmp.name,
            lastName: restName.join(' '),
            email: newEmp.email,
            role: assignedRole,
            verified: true,
            isProfileComplete: false,
            team: newEmp.team,
            expectedEntryTime: '09:00',
            supervisor_id: newEmp.supervisor_id,
            supervisorId: newEmp.supervisor_id || undefined,
            supervisorName: invitationData?.supervisorName,
            created_by_ti_id: newEmp.created_by_ti_id,
            createdByTiId: newEmp.created_by_ti_id || undefined,
            assigned_team_members: assignedRole === 'Supervisor' ? [] : undefined,
            modules: effectiveMods,
            biometrics: existingDir?.biometrics || null,
            faceDescriptor: existingDir?.biometrics?.faceDescriptor,
            isBiometricsEnrolled: Boolean(existingDir?.biometrics?.faceDescriptor?.length),
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
          role: normalizedRole,
          modules: nextModules,
          supervisor_id: data.supervisor_id ?? data.supervisorId ?? user.supervisor_id,
          supervisorId: data.supervisorId ?? data.supervisor_id ?? user.supervisorId,
          created_by_ti_id: data.created_by_ti_id ?? data.createdByTiId ?? user.created_by_ti_id,
          isProfileComplete: data.isProfileComplete ?? true,
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

      startCheckin: async (lat, lng, address, matchScore, biometricDistance) => {
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

      pauseCheckin: async () => {
        const { activeCheckin, history, mockEmployeesData, user } = get();
        if (!activeCheckin || !user) return;

        const secureTimeMs = await getSecureServerTime();

        const newPause: PauseBlock = {
          startMs: secureTimeMs,
          endMs: null,
        };

        const updatedRecord = {
          ...activeCheckin,
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

        const updatedRecord = {
          ...activeCheckin,
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

        const updatedRecord: CheckinRecord = {
          ...activeCheckin,
          pauses: updatedPauses,
          checkOutTimeMs: secureTimeMs,
          totalDurationMinutes: durationMinutes,
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
      name: 'checkin-rb-storage',
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
    if (e.key === 'checkin-rb-storage') {
      syncFromStorage();
    }
  });
}
