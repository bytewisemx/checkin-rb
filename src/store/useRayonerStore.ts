import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';
import { useNotificationStore } from './useNotificationStore';
import type {
  ClientGroup,
  Client,
  Project,
  TaskNode,
  TaskAssignment,
  GeofenceConfig,
  ActiveWorker,
  TeamMember,
  TaskStatusType,
} from '../types/rayoner';
import type { UserRole } from '../services/rbac';

// Canal WebSocket / BroadcastChannel local para sincronización en tiempo real entre pestañas (Supervisor <-> Empleado)
const rayonerRealtimeChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('rb_rayoner_realtime_channel')
    : null;

function broadcastRayonerSync(eventType: string, payload?: unknown) {
  try {
    rayonerRealtimeChannel?.postMessage({ type: eventType, payload, timestamp: Date.now() });
  } catch {
    // Ignore broadcast errors
  }
}

interface RayonerState {
  // Datos
  groups: ClientGroup[];
  clients: Client[];
  projects: Project[];
  tasks: TaskNode[];
  assignments: TaskAssignment[];
  geofences: Record<string, GeofenceConfig>;
  taskActualHours: Record<string, number>;
  userTaskActualHours: Record<string, number>;
  activeWorkers: ActiveWorker[];
  clipboardTask: TaskNode | null;
  teamMembers: TeamMember[];
  supervisorInviteCodes: Record<string, string>;
  supervisorsMetadata?: Record<string, { name: string; title: string; created_by_ti_id?: string }>;

  // Acciones Clientes y Grupos
  addGroup: (name: string, isInternal?: boolean) => void;
  addClient: (groupId: string, name: string, taxId?: string) => string;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Acciones Proyectos
  addProject: (project: Omit<Project, 'id'>) => string;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  updateGeofence: (projectId: string, geofence: GeofenceConfig) => void;

  // Acciones Tareas y Subtareas (Ciclo de Vida Sincronizado + Notificaciones Bidireccionales)
  addTask: (task: Omit<TaskNode, 'id'>, notifyAssignee?: boolean) => string;
  addSubtask: (parentTaskId: string, name: string, plannedHours?: number) => string;
  updateTask: (id: string, data: Partial<TaskNode>) => void;
  toggleTaskActive: (id: string) => void;
  deleteTask: (id: string) => void;
  copyTask: (taskId: string) => void;
  pasteTask: (targetProjectId: string, parentTaskId?: string | null) => string | null;

  // Acciones de Asignación y Presupuesto
  setAssignmentsForTask: (taskId: string, assignments: TaskAssignment[], supervisorId?: string, supervisorName?: string) => void;
  getTeamMembersBySupervisor: (supervisorId?: string, role?: string) => TeamMember[];

  // Acciones de Permisos de Colaboradores
  toggleUserClientPermission: (userId: string, clientId: string) => void;
  updateUserClients: (userId: string, clientIds: string[]) => void;

  // Acciones de Cronómetro y Cierre de Jornada del Colaborador
  startWorkerTimer: (workerData: ActiveWorker) => void;
  stopWorkerTimer: (userId: string) => void;
  recordDayAllocations: (userId: string, allocations: Array<{ taskId: string; hours: number }>) => void;
  createAndAssignTask: (projectId: string, taskName: string, plannedHours: number, userId: string, userName: string, supervisorId?: string, supervisorName?: string) => string;
  moveTaskStatus: (taskId: string, newStatus: TaskStatusType, actorUserId?: string, actorName?: string) => void;
  updateTaskActualHours: (taskId: string, userId: string, hours: number) => void;
  finalizeTaskWithHours: (taskId: string, userId: string, finalHours?: number, userName?: string) => void;
  requestTaskRevision: (taskId: string, note?: string, supervisorId?: string, supervisorName?: string) => void;
  approveTaskRevision: (taskId: string, supervisorId?: string, supervisorName?: string) => void;
  addExtraordinaryTask: (taskData: { name: string; description?: string; plannedHours?: number; category?: string; userId: string; userName: string; supervisorId?: string }) => string;

  // Acciones de Invitación y Registro Jerárquico
  corporateMasterKeys: string[];
  validateMasterCorporateKey: (inputKey: string) => boolean;
  addMasterCorporateKey: (newKey: string) => void;
  getSupervisorCode: (supervisorId: string) => string;
  setSupervisorCode: (supervisorId: string, newCode: string) => void;
  validateSupervisorCode: (code: string) => { supervisorId: string; supervisorName: string; supervisorTitle: string } | null;
  registerSupervisorProfile: (supervisor: { id: string; name: string; email?: string; title: string; code: string; created_by_ti_id?: string }) => void;
  registerCollaborator: (member: { id: string; name: string; email: string; team?: string; roleTitle?: string; role?: UserRole; supervisorId?: string; created_by_ti_id?: string }) => void;
}

const initialGroups: ClientGroup[] = [];

const initialClients: Client[] = [];

const initialProjects: Project[] = [];

const initialTasks: TaskNode[] = [];

const initialAssignments: TaskAssignment[] = [];

const initialGeofences: Record<string, GeofenceConfig> = {};

const initialTaskActualHours: Record<string, number> = {};

const initialUserTaskActualHours: Record<string, number> = {};

const initialActiveWorkers: ActiveWorker[] = [];

// Directorio Jerárquico del Equipo Base Limpio (5 Cuentas Oficiales)
const initialTeamMembers: TeamMember[] = [
  {
    id: 'ti-root-01',
    name: 'TI Prueba',
    email: 'ti.root@russellbedford.mx',
    role: 'TI',
    roleTitle: 'Administrador TI (Prueba)',
    team: 'Sin equipo (Acceso Global)',
    status: 'active',
    workedMinutesToday: 0,
    isLate: false,
    minutesLate: 0,
    allowedClientIds: [],
  },
  {
    id: 'gerente-01',
    name: 'Gerente Prueba',
    email: 'gerente.prueba@russellbedford.mx',
    role: 'Gerente',
    roleTitle: 'Gerente de Auditoría (Prueba)',
    team: 'Equipo Prueba',
    teamId: 'team-prueba-01',
    status: 'active',
    workedMinutesToday: 0,
    isLate: false,
    minutesLate: 0,
    allowedClientIds: [],
    created_by_ti_id: 'ti-root-01',
  },
  {
    id: 'admin-99',
    name: 'Supervisor Prueba',
    email: 'supervisor.prueba@russellbedford.mx',
    role: 'Supervisor',
    roleTitle: 'Supervisor Líder (Prueba)',
    team: 'Equipo Prueba',
    teamId: 'team-prueba-01',
    status: 'active',
    workedMinutesToday: 0,
    isLate: false,
    minutesLate: 0,
    allowedClientIds: [],
    created_by_ti_id: 'ti-root-01',
    assigned_team_members: ['usr-ana'],
  },
  {
    id: 'usr-ana',
    name: 'Colaborador Prueba',
    email: 'colaborador.prueba@russellbedford.mx',
    role: 'Empleado',
    roleTitle: 'Colaborador Operativo (Prueba)',
    team: 'Equipo Prueba',
    teamId: 'team-prueba-01',
    status: 'active',
    workedMinutesToday: 0,
    isLate: false,
    minutesLate: 0,
    allowedClientIds: [],
    supervisor_id: 'admin-99',
    supervisorId: 'admin-99',
  },
  {
    id: 'rh-01',
    name: 'RH Prueba',
    email: 'rh.prueba@russellbedford.mx',
    role: 'RH',
    roleTitle: 'Recursos Humanos (Prueba)',
    team: 'Equipo Prueba',
    teamId: 'team-prueba-01',
    status: 'active',
    workedMinutesToday: 0,
    isLate: false,
    minutesLate: 0,
    allowedClientIds: [],
    created_by_ti_id: 'ti-root-01',
  },
];

export const useRayonerStore = create<RayonerState>()(
  persist(
    (set, get) => ({
      groups: initialGroups,
      clients: initialClients,
      projects: initialProjects,
      tasks: initialTasks,
      assignments: initialAssignments,
      geofences: initialGeofences,
      taskActualHours: initialTaskActualHours,
      userTaskActualHours: initialUserTaskActualHours,
      activeWorkers: initialActiveWorkers,
      clipboardTask: null,
      teamMembers: initialTeamMembers,
      supervisorInviteCodes: {
        'admin-99': 'SUP-RB-9901',
      },
      supervisorsMetadata: {
        'admin-99': { name: 'Supervisor Prueba', title: 'Socio / Supervisor Líder (Prueba)', created_by_ti_id: 'ti-root-01' },
      },
      corporateMasterKeys: ['RB-SOCIO-2026', 'SUPERVISOR2026', 'RB2026', 'RB-MASTER-2026'],

      addGroup: (name, isInternal = false) => {
        const id = `grp-${Date.now()}`;
        set((state) => ({ groups: [...state.groups, { id, name, isInternal }] }));
        broadcastRayonerSync('GROUP_ADDED');
      },

      addClient: (groupId, name, taxId = '') => {
        const id = `cli-${Date.now()}`;
        set((state) => ({
          clients: [...state.clients, { id, groupId, name, taxId, isActive: true }],
        }));
        broadcastRayonerSync('CLIENT_ADDED');
        return id;
      },

      updateClient: (id, data) => {
        set((state) => ({
          clients: state.clients.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
        broadcastRayonerSync('CLIENT_UPDATED');
      },

      deleteClient: (id) => {
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
          projects: state.projects.filter((p) => p.clientId !== id),
        }));
        broadcastRayonerSync('CLIENT_DELETED');
      },

      addProject: (projectData) => {
        const id = `prj-${Date.now()}`;
        set((state) => ({
          projects: [...state.projects, { ...projectData, id, isActive: true }],
        }));
        broadcastRayonerSync('PROJECT_ADDED');
        return id;
      },

      updateProject: (id, data) => {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
        }));
        broadcastRayonerSync('PROJECT_UPDATED');
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          tasks: state.tasks.filter((t) => t.projectId !== id),
        }));
        broadcastRayonerSync('PROJECT_DELETED');
      },

      updateGeofence: (projectId, geofence) => {
        set((state) => ({
          geofences: { ...state.geofences, [projectId]: geofence },
        }));
      },

      addTask: (taskData, notifyAssignee = false) => {
        const id = `tsk-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const titleStr = taskData.title || taskData.name || 'Nueva Tarea';

        const newTask: TaskNode = {
          ...taskData,
          id,
          title: titleStr,
          name: titleStr,
          assigned_to: taskData.assigned_to || '',
          created_by: taskData.created_by || '',
          status: taskData.status || 'pending',
          created_at: taskData.created_at || nowIso,
          completed_at: taskData.completed_at ?? null,
          isActive: true,
        };

        set((state) => ({
          tasks: [...state.tasks, newTask],
        }));

        if (notifyAssignee && newTask.assigned_to) {
          const proj = get().projects.find((p) => p.id === newTask.projectId);
          useNotificationStore.getState().addNotification({
            recipient_id: newTask.assigned_to,
            sender_id: newTask.created_by || 'admin-99',
            type: 'task_assigned',
            title: 'Nueva Tarea Asignada',
            message: `Tu supervisor te ha asignado la tarea "${newTask.title}" en ${proj?.name || 'Russell Bedford'}.`,
            taskId: id,
            taskTitle: newTask.title,
            projectName: proj?.name,
            authorName: 'Supervisor',
          });
        }

        broadcastRayonerSync('TASK_ADDED', { taskId: id });
        return id;
      },

      addSubtask: (parentTaskId, name, plannedHours = 4) => {
        const parent = get().tasks.find((t) => t.id === parentTaskId);
        if (!parent) return '';

        const id = `sub-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const newSubtask: TaskNode = {
          id,
          title: name,
          name,
          assigned_to: parent.assigned_to || '',
          created_by: parent.created_by || '',
          status: 'pending',
          created_at: nowIso,
          completed_at: null,
          projectId: parent.projectId,
          parentTaskId,
          plannedHours,
          priority: parent.priority,
          isBillable: parent.isBillable,
          isActive: true,
        };

        set((state) => ({ tasks: [...state.tasks, newSubtask] }));
        broadcastRayonerSync('SUBTASK_ADDED', { taskId: id });
        return id;
      },

      updateTask: (id, data) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const nextTitle = data.title ?? data.name ?? t.title ?? t.name;
            const nextStatus = data.status ?? t.status;
            const nextCompletedAt =
              nextStatus === 'completed'
                ? t.completed_at || new Date().toISOString()
                : nextStatus !== undefined
                ? null
                : t.completed_at;
            return {
              ...t,
              ...data,
              title: nextTitle,
              name: nextTitle,
              completed_at: nextCompletedAt,
            };
          }),
        }));
        broadcastRayonerSync('TASK_UPDATED', { taskId: id });
      },

      toggleTaskActive: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, isActive: !t.isActive } : t)),
        }));
        broadcastRayonerSync('TASK_TOGGLED', { taskId: id });
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id && t.parentTaskId !== id),
          assignments: state.assignments.filter((a) => a.taskId !== id),
        }));
        broadcastRayonerSync('TASK_DELETED', { taskId: id });
      },

      copyTask: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId);
        if (task) {
          set({ clipboardTask: { ...task } });
        }
      },

      pasteTask: (targetProjectId, parentTaskId = null) => {
        const { clipboardTask } = get();
        if (!clipboardTask) return null;

        const id = `tsk-p-${Date.now()}`;
        const copyName = `${clipboardTask.name} (Copia)`;
        const clonedTask: TaskNode = {
          ...clipboardTask,
          id,
          title: copyName,
          name: copyName,
          projectId: targetProjectId,
          parentTaskId,
          created_at: new Date().toISOString(),
          completed_at: null,
          status: 'pending',
        };

        set((state) => ({ tasks: [...state.tasks, clonedTask] }));
        broadcastRayonerSync('TASK_PASTED', { taskId: id });
        return id;
      },

      setAssignmentsForTask: (taskId, newAssignments, supervisorId = 'admin-99', supervisorName = 'Supervisor') => {
        const primaryAssigneeId = newAssignments[0]?.userId;
        const currentTask = get().tasks.find((t) => t.id === taskId);
        const currentProject = get().projects.find((p) => p.id === currentTask?.projectId);

        set((state) => ({
          assignments: [
            ...state.assignments.filter((a) => a.taskId !== taskId),
            ...newAssignments,
          ],
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  assigned_to: primaryAssigneeId || t.assigned_to,
                  created_by: t.created_by || supervisorId,
                }
              : t
          ),
        }));

        // Evento 1: Emitir notificación en tiempo real a cada empleado asignado
        newAssignments.forEach((asg) => {
          if (asg.userId) {
            useNotificationStore.getState().addNotification({
              recipient_id: asg.userId,
              sender_id: supervisorId,
              type: 'task_assigned',
              title: 'Nueva Tarea Asignada',
              message: `${supervisorName} te ha asignado la tarea "${currentTask?.title || currentTask?.name || 'Tarea'}" (${asg.allocatedHours}h) en ${currentProject?.name || 'Russell Bedford'}.`,
              taskId,
              taskTitle: currentTask?.title || currentTask?.name,
              projectName: currentProject?.name,
              authorName: supervisorName,
            });
          }
        });

        broadcastRayonerSync('ASSIGNMENTS_UPDATED', { taskId });
      },

      getTeamMembersBySupervisor: (supervisorId, role) => {
        const all = get().teamMembers;
        const normRole = (role || '').toUpperCase();
        // TI tiene visibilidad global
        if (normRole === 'TI') return all;
        // Gerente: miembros de sus equipos autorizados
        if (normRole === 'GERENTE') {
          return all.filter((m) => m.team === 'Equipo Prueba' || m.teamId === 'team-prueba-01');
        }
        // Supervisor: miembros vinculados a su equipo o a su ID
        if (normRole === 'SUPERVISOR') {
          return all.filter(
            (m) =>
              (m.role === 'Empleado' || m.role === 'Colaborador') &&
              (m.supervisor_id === supervisorId ||
                m.supervisorId === supervisorId ||
                (!m.supervisor_id && (m.teamId === 'team-prueba-01' || m.team === 'Equipo Prueba')))
          );
        }
        // RH: miembros de los equipos de gestión
        if (normRole === 'RH') {
          return all.filter((m) => m.team === 'Equipo Prueba' || m.teamId === 'team-prueba-01');
        }
        return [];
      },

      toggleUserClientPermission: (userId, clientId) => {
        set((state) => ({
          teamMembers: state.teamMembers.map((m) => {
            if (m.id !== userId) return m;
            const hasPermission = m.allowedClientIds.includes(clientId);
            const updatedClients = hasPermission
              ? m.allowedClientIds.filter((id) => id !== clientId)
              : [...m.allowedClientIds, clientId];
            return { ...m, allowedClientIds: updatedClients };
          }),
        }));
        broadcastRayonerSync('PERMISSIONS_UPDATED', { userId });
      },

      updateUserClients: (userId, clientIds) => {
        set((state) => ({
          teamMembers: state.teamMembers.map((m) =>
            m.id === userId ? { ...m, allowedClientIds: clientIds } : m
          ),
        }));
        broadcastRayonerSync('PERMISSIONS_UPDATED', { userId });
      },

      startWorkerTimer: (workerData) => {
        const startedAt = workerData.startedAt || workerData.startedAtMs || Date.now();
        const accumulatedSeconds = workerData.accumulatedSeconds || 0;
        const workerWithDefaults: ActiveWorker = {
          ...workerData,
          startedAt,
          startedAtMs: typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime(),
          accumulatedSeconds,
          isRunning: true,
        };

        set((state) => ({
          activeWorkers: [
            ...state.activeWorkers.filter((w) => w.userId !== workerData.userId),
            workerWithDefaults,
          ],
        }));
        broadcastRayonerSync('TIMER_STARTED', workerWithDefaults);

        // Persistir en Firestore en la colección active_timers/{userId}
        if (isFirebaseConfigured() && db) {
          const timerRef = doc(db, 'active_timers', workerData.userId);
          setDoc(
            timerRef,
            {
              userId: workerData.userId,
              userName: workerData.userName,
              taskId: workerData.taskId,
              taskName: workerData.taskName,
              projectName: workerData.projectName,
              clientName: workerData.clientName,
              startedAt: typeof startedAt === 'number' ? startedAt : new Date(startedAt).toISOString(),
              accumulatedSeconds,
              isRunning: true,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(console.warn);
        }
      },

      stopWorkerTimer: (userId) => {
        set((state) => ({
          activeWorkers: state.activeWorkers.filter((w) => w.userId !== userId),
        }));
        broadcastRayonerSync('TIMER_STOPPED', { userId });

        // Actualizar estado en Firestore en active_timers/{userId}
        if (isFirebaseConfigured() && db) {
          const timerRef = doc(db, 'active_timers', userId);
          setDoc(
            timerRef,
            {
              isRunning: false,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch(console.warn);
        }
      },

      recordDayAllocations: (userId, allocations) => {
        set((state) => {
          const updatedTaskActual = { ...state.taskActualHours };
          const updatedUserTaskActual = { ...state.userTaskActualHours };
          let totalAddedMinutes = 0;

          allocations.forEach(({ taskId, hours }) => {
            if (hours > 0) {
              updatedTaskActual[taskId] = Number(((updatedTaskActual[taskId] || 0) + hours).toFixed(2));
              const userKey = `${taskId}_${userId}`;
              updatedUserTaskActual[userKey] = Number(((updatedUserTaskActual[userKey] || 0) + hours).toFixed(2));
              totalAddedMinutes += Math.round(hours * 60);
            }
          });

          const updatedTeamMembers = state.teamMembers.map((m) => {
            if (m.id === userId) {
              return {
                ...m,
                workedMinutesToday: (m.workedMinutesToday || 0) + totalAddedMinutes,
              };
            }
            return m;
          });

          return {
            taskActualHours: updatedTaskActual,
            userTaskActualHours: updatedUserTaskActual,
            teamMembers: updatedTeamMembers,
            activeWorkers: state.activeWorkers.filter((w) => w.userId !== userId),
          };
        });
        broadcastRayonerSync('DAY_ALLOCATIONS_RECORDED', { userId });
      },

      createAndAssignTask: (
        projectId,
        taskName,
        plannedHours,
        userId,
        userName,
        supervisorId = 'admin-99',
        supervisorName = 'Supervisor Prueba'
      ) => {
        const id = `tsk-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const newTask: TaskNode = {
          id,
          title: taskName,
          name: taskName,
          assigned_to: userId,
          created_by: supervisorId,
          status: 'pending',
          created_at: nowIso,
          completed_at: null,
          projectId,
          parentTaskId: null,
          plannedHours,
          priority: 'medium',
          isBillable: true,
          isActive: true,
        };

        const newAssignment: TaskAssignment = {
          id: `asg-${Date.now()}`,
          taskId: id,
          userId,
          userName,
          userRoleTitle: 'Empleado Operativo',
          allocatedHours: plannedHours,
          blockOnLimit: true,
        };

        set((state) => ({
          tasks: [...state.tasks, newTask],
          assignments: [...state.assignments, newAssignment],
        }));

        // Evento 1: Notificación de Asignación (Supervisor -> Empleado)
        useNotificationStore.getState().addNotification({
          recipient_id: userId,
          sender_id: supervisorId,
          type: 'task_assigned',
          title: 'Nueva Tarea Asignada',
          message: `El supervisor ${supervisorName} te ha asignado la tarea "${taskName}" (${plannedHours}h).`,
          taskId: id,
          taskTitle: taskName,
          authorName: supervisorName,
        });

        broadcastRayonerSync('TASK_CREATED_AND_ASSIGNED', { taskId: id, assigned_to: userId });
        return id;
      },

      moveTaskStatus: (taskId, newStatus, actorUserId, actorName) => {
        const currentTask = get().tasks.find((t) => t.id === taskId);
        const nowIso = new Date().toISOString();
        const normalizedStatus: TaskStatusType =
          newStatus === 'progress' ? 'in_progress' : newStatus;

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: normalizedStatus,
                  completed_at: normalizedStatus === 'completed' ? nowIso : null,
                }
              : t
          ),
        }));

        // Si el cambio es a completed, disparar Evento 2 (Empleado -> Supervisor)
        if (normalizedStatus === 'completed' && currentTask) {
          const currentProject = get().projects.find((p) => p.id === currentTask.projectId);
          useNotificationStore.getState().addNotification({
            recipient_id: currentTask.created_by || 'admin-99',
            sender_id: actorUserId || currentTask.assigned_to || '',
            type: 'task_completed',
            title: 'Tarea Completada por Empleado',
            message: `${actorName || 'El empleado'} ha marcado como completada la tarea "${currentTask.title || currentTask.name}" en ${currentProject?.name || 'Russell Bedford'}.`,
            taskId,
            taskTitle: currentTask.title || currentTask.name,
            projectName: currentProject?.name,
            authorName: actorName || 'Empleado',
          });
        }

        broadcastRayonerSync('TASK_STATUS_CHANGED', { taskId, status: normalizedStatus });
      },

      updateTaskActualHours: (taskId, userId, hours) => {
        set((state) => {
          const userKey = `${taskId}_${userId}`;
          const prevUserHours = state.userTaskActualHours[userKey] || 0;
          const diff = hours - prevUserHours;
          const currentTotalTask = state.taskActualHours[taskId] || 0;

          return {
            taskActualHours: {
              ...state.taskActualHours,
              [taskId]: Math.max(0, Number((currentTotalTask + diff).toFixed(2))),
            },
            userTaskActualHours: {
              ...state.userTaskActualHours,
              [userKey]: Math.max(0, Number(hours.toFixed(2))),
            },
          };
        });
        broadcastRayonerSync('TASK_HOURS_UPDATED', { taskId, userId, hours });
      },

      finalizeTaskWithHours: (taskId, userId, finalHours, userName) => {
        const currentTask = get().tasks.find((t) => t.id === taskId);
        const currentProject = get().projects.find((p) => p.id === currentTask?.projectId);
        const memberName =
          userName ||
          get().teamMembers.find((m) => m.id === userId)?.name ||
          'Empleado Prueba';
        const nowIso = new Date().toISOString();

        set((state) => {
          const updatedTasks = state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'completed' as const,
                  completed_at: nowIso,
                }
              : t
          );

          if (finalHours !== undefined) {
            const userKey = `${taskId}_${userId}`;
            const prevUserHours = state.userTaskActualHours[userKey] || 0;
            const diff = finalHours - prevUserHours;
            const currentTotalTask = state.taskActualHours[taskId] || 0;

            return {
              tasks: updatedTasks,
              taskActualHours: {
                ...state.taskActualHours,
                [taskId]: Math.max(0, Number((currentTotalTask + diff).toFixed(2))),
              },
              userTaskActualHours: {
                ...state.userTaskActualHours,
                [userKey]: Math.max(0, Number(finalHours.toFixed(2))),
              },
              activeWorkers: state.activeWorkers.filter(
                (w) => !(w.userId === userId && w.taskId === taskId)
              ),
            };
          }

          return {
            tasks: updatedTasks,
            activeWorkers: state.activeWorkers.filter(
              (w) => !(w.userId === userId && w.taskId === taskId)
            ),
          };
        });

        // Evento 2: Finalización de tarea (Empleado -> Supervisor created_by)
        useNotificationStore.getState().addNotification({
          recipient_id: currentTask?.created_by || 'admin-99',
          sender_id: userId,
          type: 'task_completed',
          title: 'Tarea Finalizada por Empleado',
          message: `${memberName} finalizó la tarea "${currentTask?.title || currentTask?.name || 'Tarea'}" en ${currentProject?.name || 'Russell Bedford'}${finalHours !== undefined ? ` con ${finalHours}h imputadas` : ''}.`,
          taskId,
          taskTitle: currentTask?.title || currentTask?.name,
          projectName: currentProject?.name,
          authorName: memberName,
        });

        broadcastRayonerSync('TASK_COMPLETED', {
          taskId,
          completedBy: userId,
          createdBy: currentTask?.created_by || 'admin-99',
        });
      },

      requestTaskRevision: (taskId, note, supervisorId = 'admin-99', supervisorName = 'Supervisor Prueba') => {
        const currentTask = get().tasks.find((t) => t.id === taskId);

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'review' as const,
                  completed_at: null,
                  supervisorReviewNote:
                    note || 'Favor de volver a revisar los entregables de esta tarea.',
                }
              : t
          ),
        }));

        useNotificationStore.getState().addNotification({
          recipient_id: currentTask?.assigned_to || '',
          sender_id: supervisorId,
          type: 'task_review',
          title: 'Tarea en Revisión - Observación de Supervisor',
          message: `El Supervisor retornó a revisión la tarea "${currentTask?.title || currentTask?.name || 'Tarea'}": "${note || 'Favor de volver a revisar los cálculos y entregables correspondientes.'}"`,
          taskId,
          taskTitle: currentTask?.title || currentTask?.name,
          authorName: supervisorName,
        });

        broadcastRayonerSync('TASK_REVISION_REQUESTED', { taskId });
      },

      approveTaskRevision: (taskId, supervisorId = 'admin-99', supervisorName = 'Supervisor Prueba') => {
        const currentTask = get().tasks.find((t) => t.id === taskId);
        const nowIso = new Date().toISOString();

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'completed' as const,
                  completed_at: nowIso,
                  supervisorReviewNote: undefined,
                }
              : t
          ),
        }));

        useNotificationStore.getState().addNotification({
          recipient_id: currentTask?.assigned_to || '',
          sender_id: supervisorId,
          type: 'task_completed',
          title: 'Tarea Aprobada por Supervisor',
          message: `El Supervisor aprobó definitivamente la tarea "${currentTask?.title || currentTask?.name || 'Tarea'}". Quedó marcada como Finalizada.`,
          taskId,
          taskTitle: currentTask?.title || currentTask?.name,
          authorName: supervisorName,
        });

        broadcastRayonerSync('TASK_REVISION_APPROVED', { taskId });
      },

      addExtraordinaryTask: (taskData) => {
        const newTaskId = `tsk-extra-${Date.now()}`;
        const nowIso = new Date().toISOString();
        const supervisorId = taskData.supervisorId || 'admin-99';

        const newTask: TaskNode = {
          id: newTaskId,
          title: taskData.name,
          name: taskData.name,
          assigned_to: taskData.userId,
          created_by: supervisorId,
          status: 'pending',
          created_at: nowIso,
          completed_at: null,
          projectId: 'prj-extraordinario',
          parentTaskId: null,
          description:
            taskData.description || 'Tarea extraordinaria no asociada a ninguna empresa asignada.',
          plannedHours: taskData.plannedHours || 5,
          priority: 'medium',
          isBillable: false,
          isActive: true,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          isExtraordinary: true,
          extraordinaryCategory: taskData.category || 'Tarea Extraordinaria',
        };

        const newAssignment: TaskAssignment = {
          id: `asg-extra-${Date.now()}`,
          taskId: newTaskId,
          userId: taskData.userId,
          userName: taskData.userName,
          userRoleTitle: 'Empleado',
          allocatedHours: taskData.plannedHours || 5,
          blockOnLimit: false,
        };

        set((state) => ({
          tasks: [newTask, ...state.tasks],
          assignments: [...state.assignments, newAssignment],
        }));

        useNotificationStore.getState().addNotification({
          recipient_id: supervisorId,
          sender_id: taskData.userId,
          type: 'new_task',
          title: 'Nueva Tarea Extraordinaria Registrada',
          message: `${taskData.userName || 'Colaborador'} registró la tarea extraordinaria "${taskData.name}" (${taskData.plannedHours || 5}h - ${taskData.category || 'General'}).`,
          taskId: newTaskId,
          taskTitle: taskData.name,
          projectName: 'Tareas Extraordinarias',
          authorName: taskData.userName || 'Colaborador',
        });

        broadcastRayonerSync('EXTRAORDINARY_TASK_ADDED', { taskId: newTaskId });
        return newTaskId;
      },

      validateMasterCorporateKey: (inputKey) => {
        const normalized = inputKey.trim().toUpperCase();
        if (!normalized) return false;
        const keys = get().corporateMasterKeys || [
          'RB-SOCIO-2026',
          'SUPERVISOR2026',
          'RB2026',
          'RB-MASTER-2026',
        ];
        return keys.some((k) => k.toUpperCase() === normalized);
      },

      addMasterCorporateKey: (newKey) => {
        const clean = newKey.trim().toUpperCase();
        if (!clean) return;
        set((state) => ({
          corporateMasterKeys: [
            ...(state.corporateMasterKeys || [
              'RB-SOCIO-2026',
              'SUPERVISOR2026',
              'RB2026',
              'RB-MASTER-2026',
            ]),
            clean,
          ],
        }));
      },

      getSupervisorCode: (supervisorId) => {
        const codes = get().supervisorInviteCodes || {};
        if (codes[supervisorId]) return codes[supervisorId];
        return 'SUP-RB-9901';
      },

      setSupervisorCode: (supervisorId, newCode) => {
        set((state) => ({
          supervisorInviteCodes: {
            ...state.supervisorInviteCodes,
            [supervisorId]: newCode.trim().toUpperCase(),
          },
        }));
      },

      validateSupervisorCode: (inputCode) => {
        const normalized = inputCode.trim().toUpperCase();
        if (!normalized) return null;

        const codes = get().supervisorInviteCodes || {};
        const meta = get().supervisorsMetadata || {};

        for (const [supId, code] of Object.entries(codes)) {
          if (code.toUpperCase() === normalized) {
            if (meta[supId]) {
              return {
                supervisorId: supId,
                supervisorName: meta[supId].name,
                supervisorTitle: meta[supId].title,
              };
            }
            return {
              supervisorId: supId,
              supervisorName: 'Supervisor Prueba',
              supervisorTitle: 'Socio / Supervisor Líder (Prueba)',
            };
          }
        }

        if (
          normalized === 'SUP-RB-9901' ||
          normalized === 'RB-SUPERVISOR-2026' ||
          normalized === 'RB2026'
        ) {
          return {
            supervisorId: 'admin-99',
            supervisorName: 'Supervisor Prueba',
            supervisorTitle: 'Socio / Supervisor Líder (Prueba)',
          };
        }

        return null;
      },

      registerSupervisorProfile: (supervisor) => {
        set((state) => {
          const existsInTeam = state.teamMembers.some((m) => m.id === supervisor.id);
          const newSupervisorMember: TeamMember = {
            id: supervisor.id,
            name: supervisor.name,
            email: supervisor.email || `${supervisor.name.toLowerCase().replace(/\s+/g, '.')}@russellbedford.mx`,
            role: 'Supervisor',
            roleTitle: supervisor.title,
            team: 'Dirección y Supervisión',
            status: 'active',
            workedMinutesToday: 0,
            entryTime: '09:00',
            isLate: false,
            minutesLate: 0,
            allowedClientIds: state.clients.map((c) => c.id),
            created_by_ti_id: supervisor.created_by_ti_id || 'ti-root-01',
            assigned_team_members: [],
          };

          return {
            supervisorInviteCodes: {
              ...state.supervisorInviteCodes,
              [supervisor.id]: supervisor.code.trim().toUpperCase(),
            },
            supervisorsMetadata: {
              ...(state.supervisorsMetadata || {}),
              [supervisor.id]: {
                name: supervisor.name,
                title: supervisor.title,
                created_by_ti_id: supervisor.created_by_ti_id || 'ti-root-01',
              },
            },
            teamMembers: existsInTeam
              ? state.teamMembers.map((m) =>
                  m.id === supervisor.id
                    ? {
                        ...m,
                        name: supervisor.name,
                        role: 'Supervisor',
                        roleTitle: supervisor.title,
                        created_by_ti_id: supervisor.created_by_ti_id || 'ti-root-01',
                      }
                    : m
                )
              : [...state.teamMembers, newSupervisorMember],
          };
        });
        broadcastRayonerSync('SUPERVISOR_REGISTERED', { id: supervisor.id });
      },

      registerCollaborator: (member) => {
        set((state) => {
          const supId = member.supervisorId || 'admin-99';
          const exists = state.teamMembers.some(
            (m) => m.id === member.id || m.email.toLowerCase() === member.email.toLowerCase()
          );

          let updatedMembers: TeamMember[];

          if (exists) {
            updatedMembers = state.teamMembers.map((m) =>
              m.id === member.id || m.email.toLowerCase() === member.email.toLowerCase()
                ? {
                    ...m,
                    name: member.name,
                    email: member.email,
                    team: member.team || m.team,
                    role: member.role || 'Empleado',
                    supervisor_id: supId,
                    supervisorId: supId,
                  }
                : m
            );
          } else {
            const newMember: TeamMember = {
              id: member.id,
              name: member.name,
              email: member.email,
              role: member.role || 'Empleado',
              roleTitle: member.roleTitle || 'Empleado Operativo',
              team: member.team || 'Auditoría Fiscal',
              status: 'active',
              workedMinutesToday: 0,
              entryTime: '09:00',
              isLate: false,
              minutesLate: 0,
              allowedClientIds: ['cli-interno'],
              supervisor_id: supId,
              supervisorId: supId,
            };
            updatedMembers = [...state.teamMembers, newMember];
          }

          // Vincular en assigned_team_members del supervisor correspondiente
          updatedMembers = updatedMembers.map((m) => {
            if (m.id === supId && m.role === 'Supervisor') {
              const currentList = m.assigned_team_members || [];
              if (!currentList.includes(member.id)) {
                return {
                  ...m,
                  assigned_team_members: [...currentList, member.id],
                };
              }
            }
            return m;
          });

          return {
            teamMembers: updatedMembers,
          };
        });
        broadcastRayonerSync('COLLABORATOR_REGISTERED', { id: member.id });
      },
    }),
    {
      name: 'rayoner-supervisor-storage-v2',
    }
  )
);

// Suscripción en tiempo real entre pestañas para reflejar cambios en tareas/estados sin recargar la página
if (typeof window !== 'undefined') {
  rayonerRealtimeChannel?.addEventListener('message', () => {
    useRayonerStore.persist.rehydrate();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'rayoner-supervisor-storage-v2') {
      useRayonerStore.persist.rehydrate();
    }
  });
}
