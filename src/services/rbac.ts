/**
 * Arquitectura de Seguridad RBAC - Russell Bedford Time & Checkin Suite
 * 6 Roles Corporativos con Permisos Personalizables por Usuario
 */

export type CanonicalRole =
  | 'TI'
  | 'Socio'
  | 'Gerente'
  | 'Supervisor'
  | 'RH'
  | 'Colaborador';

export type UserRole =
  | CanonicalRole
  | 'Empleado'
  | 'ti'
  | 'socio'
  | 'gerente'
  | 'supervisor'
  | 'rh'
  | 'colaborador'
  | 'employee';

export type LegacyOrCurrentRole = UserRole | string | undefined;

/**
 * Matriz de 11 Permisos Granulares por Usuario
 */
export interface UserGranularPermissions {
  canCheckIn: boolean;                  // Check-in biométrico y cronómetro continuo
  canCreateTasks: boolean;              // Crear tareas nuevas dentro de un proyecto asignado
  canAdjustTeamTimes: boolean;          // Supervisar y ajustar tiempos/registros del equipo
  canManageClientsAndProjects: boolean; // Alta de Clientes y creación de Proyectos
  canAssignProjectMembers: boolean;     // Asignar y revocar personal en proyectos
  canViewFinancials: boolean;           // Ver costos, presupuestos y detalles financieros
  canExportReports: boolean;            // Descarga de Informes ejecutivos (Excel/PDF)
  canInviteUsers: boolean;              // Emitir invitaciones a la plataforma
  canAdjustAttendanceRH: boolean;       // Control y ajuste manual de checadas/incidencias
  canViewExecutiveAuditLogs: boolean;   // Bitácora de Auditoría Ejecutiva (Socio / TI)
  canManageSystemRBAC: boolean;         // Consola Central Maestra RBAC de TI
}

/**
 * Módulos Legacy para compatibilidad
 */
export interface UserModules {
  checkIn: boolean;
  facialCheckIn: boolean;
  tasks: boolean;
  reports: boolean;
  clients: boolean;
}

export interface BiometricVectorRecord {
  faceDescriptor: number[];
  lastUpdated: string;
  model: 'face_recognition_v1';
}

/**
 * Normaliza cualquier variante de texto a uno de los 6 roles oficiales en formato canónico:
 * 'TI' | 'Socio' | 'Gerente' | 'Supervisor' | 'RH' | 'Colaborador'
 */
export function normalizeRole(role?: LegacyOrCurrentRole): CanonicalRole {
  if (!role) return 'Colaborador';
  const r = String(role).trim().toUpperCase();

  if (r === 'TI' || r === 'ROOT' || r === 'ADMIN' || r.includes('TECNOLOG') || r.includes('SISTEMA')) {
    return 'TI';
  }
  if (r === 'SOCIO' || r === 'PARTNER' || r === 'JEFATURA') {
    return 'Socio';
  }
  if (r === 'GERENTE' || r === 'MANAGER') {
    return 'Gerente';
  }
  if (r === 'SUPERVISOR') {
    return 'Supervisor';
  }
  if (r === 'RH' || r === 'HR' || r.includes('HUMANO') || r.includes('PERSONAL')) {
    return 'RH';
  }
  return 'Colaborador';
}

/**
 * Retorna el nombre visible y profesional del rol
 */
export function getRoleDisplayName(role?: LegacyOrCurrentRole): string {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'TI':
      return 'Administrador TI (Root)';
    case 'Socio':
      return 'Socio / Jefatura';
    case 'Gerente':
      return 'Gerente';
    case 'Supervisor':
      return 'Supervisor';
    case 'RH':
      return 'Recursos Humanos (RH)';
    case 'Colaborador':
    default:
      return 'Colaborador';
  }
}

/**
 * Plantilla Base de Permisos (Defaults) para cada uno de los 6 Roles
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<CanonicalRole, UserGranularPermissions> = {
  // 1. Colaborador: Check-in, cronómetro y crear tareas dentro de proyecto asignado
  Colaborador: {
    canCheckIn: true,
    canCreateTasks: true,
    canAdjustTeamTimes: false,
    canManageClientsAndProjects: false,
    canAssignProjectMembers: false,
    canViewFinancials: false,
    canExportReports: false,
    canInviteUsers: false,
    canAdjustAttendanceRH: false,
    canViewExecutiveAuditLogs: false,
    canManageSystemRBAC: false,
  },

  // 2. Supervisor: Todo lo de Colaborador + supervisar avances y ajustar tiempos de su equipo
  Supervisor: {
    canCheckIn: true,
    canCreateTasks: true,
    canAdjustTeamTimes: true,
    canManageClientsAndProjects: false,
    canAssignProjectMembers: false,
    canViewFinancials: false,
    canExportReports: false,
    canInviteUsers: false,
    canAdjustAttendanceRH: false,
    canViewExecutiveAuditLogs: false,
    canManageSystemRBAC: false,
  },

  // 3. Gerente: Clientes/Proyectos, finanzas, asignación de miembros, invitaciones e informes
  Gerente: {
    canCheckIn: true,
    canCreateTasks: true,
    canAdjustTeamTimes: true,
    canManageClientsAndProjects: true,
    canAssignProjectMembers: true,
    canViewFinancials: true,
    canExportReports: true,
    canInviteUsers: true,
    canAdjustAttendanceRH: false,
    canViewExecutiveAuditLogs: false,
    canManageSystemRBAC: false,
  },

  // 4. Socio / Jefatura: Acceso total a Gerencia y RH + Bitácora de Auditoría Ejecutiva
  Socio: {
    canCheckIn: true,
    canCreateTasks: true,
    canAdjustTeamTimes: true,
    canManageClientsAndProjects: true,
    canAssignProjectMembers: true,
    canViewFinancials: true,
    canExportReports: true,
    canInviteUsers: true,
    canAdjustAttendanceRH: true,
    canViewExecutiveAuditLogs: true,
    canManageSystemRBAC: false,
  },

  // 5. Recursos Humanos: Control de asistencias, sábana quincenal, ajuste de checadas y kardex
  RH: {
    canCheckIn: true,
    canCreateTasks: false,
    canAdjustTeamTimes: false,
    canManageClientsAndProjects: false,
    canAssignProjectMembers: false,
    canViewFinancials: false,
    canExportReports: true,
    canInviteUsers: false,
    canAdjustAttendanceRH: true,
    canViewExecutiveAuditLogs: false,
    canManageSystemRBAC: false,
  },

  // 6. Administrador TI (Root): Control maestro total y consola RBAC
  TI: {
    canCheckIn: true,
    canCreateTasks: true,
    canAdjustTeamTimes: true,
    canManageClientsAndProjects: true,
    canAssignProjectMembers: true,
    canViewFinancials: true,
    canExportReports: true,
    canInviteUsers: true,
    canAdjustAttendanceRH: true,
    canViewExecutiveAuditLogs: true,
    canManageSystemRBAC: true,
  },
};

/**
 * Obtiene los permisos por defecto para un rol dado
 */
export function getDefaultPermissionsForRole(role?: LegacyOrCurrentRole): UserGranularPermissions {
  const norm = normalizeRole(role);
  return { ...DEFAULT_PERMISSIONS_BY_ROLE[norm] };
}

/**
 * Resuelve los permisos efectivos de un usuario combinando su plantilla de rol con overrides
 */
export function getEffectivePermissions(user?: {
  role?: LegacyOrCurrentRole;
  permissions?: Partial<UserGranularPermissions> | null;
  customPermissions?: Partial<UserGranularPermissions> | null;
} | null): UserGranularPermissions {
  const defaults = getDefaultPermissionsForRole(user?.role);
  const overrides = user?.permissions || user?.customPermissions || {};
  return {
    ...defaults,
    ...overrides,
  };
}

/**
 * Capacidades Legacy por defecto (adaptadas a los 6 roles)
 */
export function getDefaultModulesForRole(role?: LegacyOrCurrentRole): UserModules {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'TI':
    case 'Socio':
    case 'Gerente':
      return {
        checkIn: true,
        facialCheckIn: false,
        tasks: true,
        reports: true,
        clients: true,
      };
    case 'Supervisor':
      return {
        checkIn: true,
        facialCheckIn: false,
        tasks: true,
        reports: false,
        clients: false,
      };
    case 'RH':
      return {
        checkIn: true,
        facialCheckIn: true,
        tasks: false,
        reports: true,
        clients: false,
      };
    case 'Colaborador':
    default:
      return {
        checkIn: true,
        facialCheckIn: true,
        tasks: true,
        reports: false,
        clients: false,
      };
  }
}

/**
 * Módulos efectivos para compatibilidad con código existente
 */
export function getEffectiveModules(user?: {
  role?: LegacyOrCurrentRole;
  modules?: Partial<UserModules> | null;
  permissions?: Partial<UserGranularPermissions> | null;
} | null): UserModules {
  const perms = getEffectivePermissions(user);
  const legacyDefaults = getDefaultModulesForRole(user?.role);

  return {
    checkIn: perms.canCheckIn,
    facialCheckIn: user?.modules?.facialCheckIn ?? legacyDefaults.facialCheckIn,
    tasks: perms.canCreateTasks || perms.canAdjustTeamTimes || legacyDefaults.tasks,
    reports: perms.canExportReports || legacyDefaults.reports,
    clients: perms.canManageClientsAndProjects || legacyDefaults.clients,
  };
}

/**
 * Roles que tienen autorizado emitir invitaciones en el sistema
 */
export function canRoleInvite(role?: LegacyOrCurrentRole): boolean {
  const norm = normalizeRole(role);
  return norm === 'Gerente' || norm === 'Socio' || norm === 'TI';
}

/**
 * Lista de roles que un emisor está autorizado a invitar
 */
export function getAllowedRolesToInvite(issuerRole?: LegacyOrCurrentRole): Array<{
  value: CanonicalRole;
  label: string;
}> {
  const norm = normalizeRole(issuerRole);

  if (norm === 'Gerente') {
    return [
      { value: 'Supervisor', label: 'Supervisor' },
      { value: 'Colaborador', label: 'Colaborador' },
    ];
  }

  if (norm === 'Socio' || norm === 'TI') {
    return [
      { value: 'Socio', label: 'Socio / Jefatura' },
      { value: 'Gerente', label: 'Gerente' },
      { value: 'RH', label: 'Recursos Humanos (RH)' },
      { value: 'Supervisor', label: 'Supervisor' },
      { value: 'Colaborador', label: 'Colaborador' },
    ];
  }

  return [];
}

/**
 * Determina si el usuario requiere verificación facial obligatoria
 */
export function isBiometricsRequiredForUser(user?: {
  role?: LegacyOrCurrentRole;
  modules?: Partial<UserModules> | null;
} | null): boolean {
  if (!user) return false;
  const effective = getEffectiveModules(user);
  return Boolean(effective.facialCheckIn);
}

export type RBACResource = 'users' | 'time_logs' | 'tasks' | 'clients' | 'audit_logs';

export interface RBACPermissionRule {
  read: 'TOTAL' | 'TEAM' | 'ASSIGNED' | 'OWN' | 'BASIC_LIST' | 'DENIED_403';
  write: 'TOTAL' | 'TEAM' | 'ASSIGNED' | 'OWN' | 'DENIED_403';
  description: string;
}

export const RBAC_MATRIX: Record<RBACResource, Record<CanonicalRole, RBACPermissionRule>> = {
  users: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Control total de roles y switches de permisos' },
    Socio: { read: 'TOTAL', write: 'TEAM', description: 'Visualización ejecutiva de todo el personal' },
    Gerente: { read: 'TEAM', write: 'TEAM', description: 'Asignación de personal en proyectos y equipos' },
    Supervisor: { read: 'TEAM', write: 'TEAM', description: 'Supervisión de su propio equipo asignado' },
    RH: { read: 'TEAM', write: 'DENIED_403', description: 'Visualización aislada por equipos asignados por TI' },
    Colaborador: { read: 'OWN', write: 'OWN', description: 'Solo su propio perfil' },
  },
  time_logs: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Acceso total y ajuste de tiempos' },
    Socio: { read: 'TOTAL', write: 'TOTAL', description: 'Ajuste de incidencias y visualización completa' },
    Gerente: { read: 'TEAM', write: 'TEAM', description: 'Revisión y ajuste de tiempos en proyectos' },
    Supervisor: { read: 'TEAM', write: 'TEAM', description: 'Supervisión y ajuste de tiempos de su equipo' },
    RH: { read: 'TEAM', write: 'TEAM', description: 'Ajuste de checadas en equipos autorizados por TI' },
    Colaborador: { read: 'OWN', write: 'OWN', description: 'Check-in y distribución de tiempo propio' },
  },
  tasks: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Acceso y administración total de tareas' },
    Socio: { read: 'TOTAL', write: 'TOTAL', description: 'Visualización y gestión global de proyectos' },
    Gerente: { read: 'TEAM', write: 'TOTAL', description: 'Creación y asignación de tareas en proyectos' },
    Supervisor: { read: 'TEAM', write: 'TEAM', description: 'Seguimiento de tareas de su equipo' },
    RH: { read: 'DENIED_403', write: 'DENIED_403', description: 'Módulo no disponible para RH' },
    Colaborador: { read: 'ASSIGNED', write: 'ASSIGNED', description: 'Creación y ejecución dentro de proyecto' },
  },
  clients: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Alta y administración de clientes' },
    Socio: { read: 'TOTAL', write: 'TOTAL', description: 'Visualización de cartera y presupuestos' },
    Gerente: { read: 'TOTAL', write: 'TOTAL', description: 'Alta de clientes y gestión de proyectos' },
    Supervisor: { read: 'TEAM', write: 'DENIED_403', description: 'Visualización de clientes de su equipo' },
    RH: { read: 'DENIED_403', write: 'DENIED_403', description: 'Módulo no disponible para RH' },
    Colaborador: { read: 'ASSIGNED', write: 'DENIED_403', description: 'Solo lectura de cliente asignado' },
  },
  audit_logs: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Auditoría completa del sistema' },
    Socio: { read: 'TOTAL', write: 'DENIED_403', description: 'Bitácora ejecutiva de movimientos y reportes' },
    Gerente: { read: 'DENIED_403', write: 'DENIED_403', description: 'Sin acceso a auditoría ejecutiva' },
    Supervisor: { read: 'DENIED_403', write: 'DENIED_403', description: 'Sin acceso a auditoría ejecutiva' },
    RH: { read: 'DENIED_403', write: 'DENIED_403', description: 'Sin acceso a auditoría ejecutiva' },
    Colaborador: { read: 'DENIED_403', write: 'DENIED_403', description: 'Sin acceso a auditoría ejecutiva' },
  },
};

/**
 * Endpoint de sincronización con API / Backend para módulos
 */
export async function updateUserModulesApi(
  _targetUserId: string,
  modules: UserModules,
  _actorUser?: { id?: string; role?: LegacyOrCurrentRole; name?: string; email?: string }
): Promise<{ status: number; modules: UserModules; message: string }> {
  return {
    status: 200,
    modules,
    message: 'Permisos actualizados con éxito.',
  };
}

/**
 * Vector Biométrico Facial (Estrictamente numérico sin imágenes)
 */
export async function updateUserBiometricsApi(
  _targetIdOrMe: 'me' | string,
  descriptor: number[],
  _actorUser?: { id?: string; role?: LegacyOrCurrentRole }
): Promise<{ status: number; biometrics: BiometricVectorRecord }> {
  const cleanDescriptor = descriptor.map((v) => Number(Number(v).toFixed(6)));
  const payload: BiometricVectorRecord = {
    faceDescriptor: cleanDescriptor,
    lastUpdated: new Date().toISOString(),
    model: 'face_recognition_v1',
  };
  return {
    status: 200,
    biometrics: payload,
  };
}

export interface RHAttendanceLocation {
  label: string;
  latitude: number;
  longitude: number;
}

export interface RHAttendanceCheckEvent {
  timestamp: string;
  facialMatch: boolean;
  confidenceScore?: number;
  location: RHAttendanceLocation;
}

export interface RHAttendanceRecord {
  id: string;
  userName: string;
  userEmail: string;
  teamName: string;
  supervisorName: string;
  supervisorId?: string;
  checkIn: RHAttendanceCheckEvent;
  checkOut: RHAttendanceCheckEvent | null;
  totalHours: number;
}

/**
 * Consulta de registros de asistencia para Recursos Humanos
 */
export async function fetchRHAttendanceRecords(
  actorUser?: { id?: string; role?: LegacyOrCurrentRole; assignedTeams?: string[] }
): Promise<RHAttendanceRecord[]> {
  const actorRole = normalizeRole(actorUser?.role || 'RH');
  void actorRole;

  return [
    {
      id: 'att_98765',
      userName: 'Empleado Prueba',
      userEmail: 'colaborador.prueba@russellbedford.mx',
      teamName: 'Equipo Prueba',
      supervisorName: 'Supervisor Prueba',
      supervisorId: 'admin-99',
      checkIn: {
        timestamp: '2026-10-29T08:55:12Z',
        facialMatch: true,
        confidenceScore: 0.96,
        location: {
          label: 'Oficina Central',
          latitude: 21.8853,
          longitude: -102.2915,
        },
      },
      checkOut: {
        timestamp: '2026-10-29T18:05:40Z',
        facialMatch: true,
        location: {
          label: 'Oficina Central',
          latitude: 21.8853,
          longitude: -102.2915,
        },
      },
      totalHours: 9.1,
    },
    {
      id: 'att_98766',
      userName: 'Carlos Méndez',
      userEmail: 'carlos.mendez@russellbedford.mx',
      teamName: 'Auditoría Fiscal',
      supervisorName: 'Supervisor Prueba',
      supervisorId: 'admin-99',
      checkIn: {
        timestamp: '2026-10-30T09:02:10Z',
        facialMatch: true,
        confidenceScore: 0.94,
        location: {
          label: 'Cliente - Corporativo Norte',
          latitude: 21.8900,
          longitude: -102.2950,
        },
      },
      checkOut: {
        timestamp: '2026-10-30T17:30:00Z',
        facialMatch: true,
        location: {
          label: 'Cliente - Corporativo Norte',
          latitude: 21.8900,
          longitude: -102.2950,
        },
      },
      totalHours: 8.5,
    },
    {
      id: 'att_98767',
      userName: 'Sofía Valenzuela',
      userEmail: 'sofia.valenzuela@russellbedford.mx',
      teamName: 'Consultoría e Impuestos',
      supervisorName: 'Supervisor Prueba',
      supervisorId: 'admin-99',
      checkIn: {
        timestamp: '2026-10-30T09:15:00Z',
        facialMatch: true,
        confidenceScore: 0.91,
        location: {
          label: 'Oficina Central',
          latitude: 21.8853,
          longitude: -102.2915,
        },
      },
      checkOut: null,
      totalHours: 4.2,
    },
  ];
}
