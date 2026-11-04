import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

const initialGroups: ClientGroup[] = [
  { id: 'grp-corp', name: 'Clientes Corporativos', isInternal: false },
  { id: 'grp-part', name: 'Clientes Particulares', isInternal: false },
  { id: 'grp-int', name: 'Tareas Internas', isInternal: true },
];

const initialClients: Client[] = [
  { id: 'cli-baluarte', groupId: 'grp-corp', name: 'Grupo Baluarte S.A. de C.V.', taxId: 'GBA-980421-K32', isActive: true },
  { id: 'cli-alsea', groupId: 'grp-corp', name: 'Corporativo Alsea', taxId: 'ALS-020514-9X1', isActive: true },
  { id: 'cli-montes', groupId: 'grp-part', name: 'Dra. Patricia Montes', taxId: 'MOP-850912-AB4', isActive: true },
  { id: 'cli-interno', groupId: 'grp-int', name: 'Rayoner / Russell Bedford (Despacho)', taxId: 'RBF-100101-000', isActive: true },
  { id: 'cli-extraordinario', groupId: 'grp-int', name: 'Actividades Extraordinarias (Sin Empresa)', taxId: 'EXT-000000-000', isActive: true },
];

const initialProjects: Project[] = [
  {
    id: 'prj-aud-2026',
    clientId: 'cli-baluarte',
    name: 'Auditoría Fiscal Anual 2026',
    code: 'AUD-2026-BAL-01',
    leadUserId: 'admin-99',
    leadUserName: 'Supervisor Prueba (Líder)',
    deadline: '2026-10-31',
    budgetType: 'fixed_project',
    totalBudgetHours: 120,
    hourlyRate: 1500,
    currency: 'MXN',
    notes: 'El cliente entregó la balanza con retraso; se autorizó holgura de 10 hrs para muestreo de inventarios. No exceder 125 hrs totales.',
    isActive: true,
  },
  {
    id: 'prj-patr-montes',
    clientId: 'cli-montes',
    name: 'Planeación Patrimonial y Fiscal',
    code: 'PLN-2026-MON',
    leadUserId: 'admin-99',
    leadUserName: 'Supervisor Prueba (Líder)',
    deadline: '2026-11-15',
    budgetType: 'by_tasks',
    totalBudgetHours: 45,
    hourlyRate: 1800,
    currency: 'MXN',
    notes: 'Estructuración testamentaria y regularización de fideicomisos familiares.',
    isActive: true,
  },
  {
    id: 'prj-int-admin',
    clientId: 'cli-interno',
    name: 'Capacitación y Administración Interna',
    code: 'INT-ADM-2026',
    leadUserId: 'admin-99',
    leadUserName: 'Dirección General',
    deadline: '2026-12-31',
    budgetType: 'by_person',
    totalBudgetHours: 80,
    hourlyRate: 0,
    currency: 'MXN',
    notes: 'Actividades no facturables: cursos de actualización tributaria y reuniones de comités.',
    isActive: true,
  },
  {
    id: 'prj-extraordinario',
    clientId: 'cli-extraordinario',
    name: 'Tareas Extraordinarias e Imprevistas',
    code: 'EXT-2026',
    leadUserId: 'admin-99',
    leadUserName: 'Supervisión General',
    deadline: '2026-12-31',
    budgetType: 'by_tasks',
    totalBudgetHours: 100,
    hourlyRate: 0,
    currency: 'MXN',
    notes: 'Actividades y tareas extraordinarias que no pertenecen a ninguna empresa asignada.',
    isActive: true,
  },
];

const initialTasks: TaskNode[] = [
  {
    id: 'tsk-plan',
    title: '1. Planificación Preliminar y Entendimiento del Negocio',
    name: '1. Planificación Preliminar y Entendimiento del Negocio',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'in_progress',
    created_at: '2026-10-15T09:00:00.000Z',
    completed_at: null,
    projectId: 'prj-aud-2026',
    parentTaskId: null,
    description: 'Levantamiento de procesos clave, evaluación de control interno y matriz de riesgos.',
    plannedHours: 20,
    priority: 'high',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-25',
  },
  {
    id: 'sub-plan-1',
    title: 'Cotejo y conciliación de Balanza de Comprobación',
    name: 'Cotejo y conciliación de Balanza de Comprobación',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'in_progress',
    created_at: '2026-10-16T10:00:00.000Z',
    completed_at: null,
    projectId: 'prj-aud-2026',
    parentTaskId: 'tsk-plan',
    description: 'Verificación de saldos iniciales vs. declaraciones fiscales anteriores.',
    plannedHours: 12,
    priority: 'high',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-20',
  },
  {
    id: 'sub-plan-2',
    title: 'Muestreo de Actas y Contratos Corporativos',
    name: 'Muestreo de Actas y Contratos Corporativos',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'pending',
    created_at: '2026-10-17T11:00:00.000Z',
    completed_at: null,
    projectId: 'prj-aud-2026',
    parentTaskId: 'tsk-plan',
    description: 'Revisión legal corporativa de asambleas ordinarias y extraordinarias.',
    plannedHours: 8,
    priority: 'medium',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-22',
  },
  {
    id: 'tsk-sust',
    title: '2. Pruebas Sustantivas y Fiscales',
    name: '2. Pruebas Sustantivas y Fiscales',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'in_progress',
    created_at: '2026-10-18T09:00:00.000Z',
    completed_at: null,
    projectId: 'prj-aud-2026',
    parentTaskId: null,
    description: 'Auditoría detallada de cuentas de resultados, ingresos nominales y deducciones autorizadas.',
    plannedHours: 70,
    priority: 'urgent',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-28',
  },
  {
    id: 'sub-sust-1',
    title: 'Cruce de CFDI de Ingresos vs. Depósitos Bancarios',
    name: 'Cruce de CFDI de Ingresos vs. Depósitos Bancarios',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'review',
    created_at: '2026-10-18T12:00:00.000Z',
    completed_at: null,
    projectId: 'prj-aud-2026',
    parentTaskId: 'tsk-sust',
    description: 'Validación automatizada de comprobantes fiscales digitales.',
    plannedHours: 40,
    priority: 'urgent',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-18',
  },
  {
    id: 'sub-sust-2',
    title: 'Circularización y confirmación de saldos con Proveedores',
    name: 'Circularización y confirmación de saldos con Proveedores',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'pending',
    created_at: '2026-10-19T09:30:00.000Z',
    completed_at: null,
    projectId: 'prj-aud-2026',
    parentTaskId: 'tsk-sust',
    description: 'Envío de confirmaciones externas y seguimiento de respuestas.',
    plannedHours: 30,
    priority: 'high',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-30',
  },
  {
    id: 'tsk-cierr',
    title: '3. Cierre y Emisión del Dictamen Fiscal',
    name: '3. Cierre y Emisión del Dictamen Fiscal',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'pending',
    created_at: '2026-10-20T09:00:00.000Z',
    completed_at: null,
    projectId: 'prj-aud-2026',
    parentTaskId: null,
    description: 'Elaboración del informe para el SAT, anexos fiscales y carta de sugerencias.',
    plannedHours: 30,
    priority: 'high',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-31',
  },
  {
    id: 'tsk-patr-1',
    title: 'Diagnóstico de Activos y Empresas Familiares',
    name: 'Diagnóstico de Activos y Empresas Familiares',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'completed',
    created_at: '2026-10-05T09:00:00.000Z',
    completed_at: '2026-10-10T17:45:00.000Z',
    projectId: 'prj-patr-montes',
    parentTaskId: null,
    description: 'Mapeo integral de cuentas bancarias e inmuebles.',
    plannedHours: 25,
    priority: 'medium',
    isBillable: true,
    isActive: true,
    dueDate: '2026-10-10',
  },
  {
    id: 'tsk-patr-2',
    title: 'Diseño del Protocolo Sucesorio',
    name: 'Diseño del Protocolo Sucesorio',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'in_progress',
    created_at: '2026-10-12T09:00:00.000Z',
    completed_at: null,
    projectId: 'prj-patr-montes',
    parentTaskId: null,
    description: 'Redacción de estatutos y fideicomiso de control.',
    plannedHours: 20,
    priority: 'high',
    isBillable: true,
    isActive: true,
    dueDate: '2026-11-05',
  },
  {
    id: 'tsk-int-cap',
    title: 'Actualización en Reformas Fiscales y Laborales',
    name: 'Actualización en Reformas Fiscales y Laborales',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'completed',
    created_at: '2026-10-02T09:00:00.000Z',
    completed_at: '2026-10-12T16:30:00.000Z',
    projectId: 'prj-int-admin',
    parentTaskId: null,
    description: 'Seminarios de actualización continua para el equipo de auditoría.',
    plannedHours: 50,
    priority: 'low',
    isBillable: false,
    isActive: true,
    dueDate: '2026-10-12',
  },
  {
    id: 'tsk-int-reu',
    title: 'Reunión Semanal de Supervisión y Asignaciones',
    name: 'Reunión Semanal de Supervisión y Asignaciones',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'in_progress',
    created_at: '2026-10-14T09:00:00.000Z',
    completed_at: null,
    projectId: 'prj-int-admin',
    parentTaskId: null,
    description: 'Comité de seguimiento operativo entre socios y seniors.',
    plannedHours: 30,
    priority: 'medium',
    isBillable: false,
    isActive: true,
    dueDate: '2026-10-16',
  },
  {
    id: 'tsk-extra-1',
    title: 'Soporte Urgente y Reorganización Operativa',
    name: 'Soporte Urgente y Reorganización Operativa',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'pending',
    created_at: '2026-10-22T09:00:00.000Z',
    completed_at: null,
    projectId: 'prj-extraordinario',
    parentTaskId: null,
    description: 'Actividad extraordinaria independiente no asociada a ninguna empresa en particular.',
    plannedHours: 12,
    priority: 'urgent',
    isBillable: false,
    isActive: true,
    dueDate: '2026-10-24',
    isExtraordinary: true,
    extraordinaryCategory: 'Soporte Extraordinario',
  },
  {
    id: 'tsk-extra-2',
    title: 'Capacitación Técnica en Normas de Auditoría',
    name: 'Capacitación Técnica en Normas de Auditoría',
    assigned_to: 'usr-ana',
    created_by: 'admin-99',
    status: 'in_progress',
    created_at: '2026-10-23T09:00:00.000Z',
    completed_at: null,
    projectId: 'prj-extraordinario',
    parentTaskId: null,
    description: 'Formación profesional y actualización técnica extraordinaria de la firma.',
    plannedHours: 8,
    priority: 'medium',
    isBillable: false,
    isActive: true,
    dueDate: '2026-10-28',
    isExtraordinary: true,
    extraordinaryCategory: 'Capacitación y Desarrollo',
  },
];

const initialAssignments: TaskAssignment[] = [
  { id: 'asg-1', taskId: 'tsk-plan', userId: 'usr-ana', userName: 'Empleado Prueba', userRoleTitle: 'Auditor Senior (Prueba)', allocatedHours: 20, hourlyRateOverride: 1800, blockOnLimit: true },
  { id: 'asg-3', taskId: 'tsk-sust', userId: 'usr-ana', userName: 'Empleado Prueba', userRoleTitle: 'Auditor Senior (Prueba)', allocatedHours: 70, hourlyRateOverride: 1800, blockOnLimit: true },
  { id: 'asg-5', taskId: 'tsk-cierr', userId: 'usr-ana', userName: 'Empleado Prueba', userRoleTitle: 'Auditor Senior (Prueba)', allocatedHours: 30, hourlyRateOverride: 1800, blockOnLimit: false },
  { id: 'asg-6', taskId: 'tsk-patr-1', userId: 'usr-ana', userName: 'Empleado Prueba', userRoleTitle: 'Auditor Senior (Prueba)', allocatedHours: 25, hourlyRateOverride: 1800, blockOnLimit: false },
  { id: 'asg-7', taskId: 'tsk-patr-2', userId: 'usr-ana', userName: 'Empleado Prueba', userRoleTitle: 'Auditor Senior (Prueba)', allocatedHours: 20, hourlyRateOverride: 1800, blockOnLimit: false },
  { id: 'asg-ext-1', taskId: 'tsk-extra-1', userId: 'usr-ana', userName: 'Empleado Prueba', userRoleTitle: 'Auditor Senior (Prueba)', allocatedHours: 12, blockOnLimit: false },
  { id: 'asg-ext-2', taskId: 'tsk-extra-2', userId: 'usr-ana', userName: 'Empleado Prueba', userRoleTitle: 'Auditor Senior (Prueba)', allocatedHours: 8, blockOnLimit: false },
];

const initialGeofences: Record<string, GeofenceConfig> = {
  'prj-aud-2026': {
    id: 'geo-aud',
    projectId: 'prj-aud-2026',
    locationMode: 'client_site',
    address: 'Av. Paseo de la Reforma 483, Cuauhtémoc, CDMX',
    lat: 19.427,
    lng: -99.1677,
    radiusMeters: 250,
    enforcementMode: 'warning',
  },
  'prj-patr-montes': {
    id: 'geo-patr',
    projectId: 'prj-patr-montes',
    locationMode: 'office',
    address: 'Insurgentes Sur 1602, Crédito Constructor, Benito Juárez, CDMX',
    lat: 19.3644,
    lng: -99.1812,
    radiusMeters: 100,
    enforcementMode: 'strict_block',
  },
};

const initialTaskActualHours: Record<string, number> = {
  'tsk-plan': 17.5,
  'sub-plan-1': 12.0,
  'sub-plan-2': 5.5,
  'tsk-sust': 74.0,
  'sub-sust-1': 42.0,
  'sub-sust-2': 32.0,
  'tsk-cierr': 12.0,
  'tsk-patr-1': 18.0,
  'tsk-patr-2': 6.0,
  'tsk-int-cap': 32.0,
  'tsk-int-reu': 18.0,
};

const initialUserTaskActualHours: Record<string, number> = {
  'tsk-plan_usr-ana': 17.5,
  'tsk-sust_usr-ana': 74.0,
  'tsk-cierr_usr-ana': 12.0,
  'tsk-patr-1_usr-ana': 18.0,
  'tsk-patr-2_usr-ana': 6.0,
};

const initialActiveWorkers: ActiveWorker[] = [
  {
    userId: 'usr-ana',
    userName: 'Empleado Prueba',
    taskId: 'sub-plan-1',
    taskName: 'Cotejo y conciliación de Balanza de Comprobación',
    projectName: 'Auditoría Fiscal Anual 2026',
    clientName: 'Grupo Baluarte S.A. de C.V.',
    startedAtMs: Date.now() - 102 * 60 * 1000,
    currentDurationStr: '01:42:15',
  },
];

// Directorio Jerárquico del Equipo de Prueba (TI Prueba -> Supervisor Prueba -> Empleado Prueba y RH Prueba)
const initialTeamMembers: TeamMember[] = [
  {
    id: 'usr-ana',
    name: 'Empleado Prueba',
    email: 'colaborador.prueba@russellbedford.mx',
    role: 'Empleado',
    roleTitle: 'Colaborador Operativo (Prueba)',
    team: 'Equipo Prueba',
    status: 'active',
    workedMinutesToday: 405,
    entryTime: '09:02',
    checkOutTime: '18:05',
    isLate: false,
    minutesLate: 0,
    allowedClientIds: ['cli-baluarte', 'cli-alsea', 'cli-interno'],
    supervisor_id: 'admin-99',
    supervisorId: 'admin-99',
  },
  {
    id: 'admin-99',
    name: 'Supervisor Prueba',
    email: 'supervisor.prueba@russellbedford.mx',
    role: 'Supervisor',
    roleTitle: 'Socio / Supervisor Líder (Prueba)',
    team: 'Equipo Prueba',
    status: 'active',
    workedMinutesToday: 460,
    entryTime: '08:45',
    checkOutTime: '18:30',
    isLate: false,
    minutesLate: 0,
    allowedClientIds: ['cli-baluarte', 'cli-alsea', 'cli-montes', 'cli-interno'],
    created_by_ti_id: 'ti-root-01',
    assigned_team_members: ['usr-ana'],
  },
  {
    id: 'rh-01',
    name: 'RH Prueba',
    email: 'rh.prueba@russellbedford.mx',
    role: 'RH',
    roleTitle: 'Recursos Humanos (Prueba)',
    team: 'Equipo Prueba',
    status: 'active',
    workedMinutesToday: 420,
    entryTime: '09:00',
    checkOutTime: '18:00',
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
          assigned_to: taskData.assigned_to || 'usr-ana',
          created_by: taskData.created_by || 'admin-99',
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
          assigned_to: parent.assigned_to || 'usr-ana',
          created_by: parent.created_by || 'admin-99',
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
        // TI puede ver todos los usuarios
        if (normRole === 'TI') return all;
        // Para Supervisor, filtrar usuarios operativos cuyo supervisor_id coincida con el supervisor actual
        if (!supervisorId || supervisorId === 'admin-99') {
          return all.filter(
            (m) =>
              (m.role === 'Empleado' || !m.role) &&
              (m.supervisor_id === 'admin-99' || m.supervisorId === 'admin-99' || !m.supervisor_id)
          );
        }
        const filtered = all.filter(
          (m) => m.supervisor_id === supervisorId || m.supervisorId === supervisorId
        );
        return filtered.length > 0 ? filtered : all.filter((m) => m.role === 'Empleado' || !m.role);
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
        set((state) => ({
          activeWorkers: [
            ...state.activeWorkers.filter((w) => w.userId !== workerData.userId),
            workerData,
          ],
        }));
        broadcastRayonerSync('TIMER_STARTED', workerData);
      },

      stopWorkerTimer: (userId) => {
        set((state) => ({
          activeWorkers: state.activeWorkers.filter((w) => w.userId !== userId),
        }));
        broadcastRayonerSync('TIMER_STOPPED', { userId });
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
            sender_id: actorUserId || currentTask.assigned_to || 'usr-ana',
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
          recipient_id: currentTask?.assigned_to || 'usr-ana',
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
          recipient_id: currentTask?.assigned_to || 'usr-ana',
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
