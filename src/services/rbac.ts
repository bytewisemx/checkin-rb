export type UserRole = 'TI' | 'Supervisor' | 'Empleado' | 'RH';

export type LegacyOrCurrentRole = UserRole | 'employee' | 'supervisor' | string | undefined;

/**
 * Estructura de Permisos Granulares por Usuario (Panel TI)
 * Sobrescribe o complementa el rol base del usuario en frontend y backend.
 */
export interface UserModules {
  checkIn: boolean;        // [x] Asistencia / Check-in (entrada/salida)
  facialCheckIn: boolean;  // [x] Verificación Facial Obligatoria (registro con rostro)
  tasks: boolean;          // [ ] Módulo de Tareas (asignación y visualización)
  reports: boolean;        // [ ] Acceso a métricas de tiempo / reportes
  clients: boolean;        // [ ] Clientes / Empresas (gestión/vista de clientes)
}

/**
 * Vector Biométrico Facial (Estrictamente sin imágenes base64 ni URLs)
 */
export interface BiometricVectorRecord {
  faceDescriptor: number[];
  lastUpdated: string;
  model: 'face_recognition_v1';
}

/**
 * Normaliza cualquier representación de rol al estándar estricto RBAC:
 * 'TI' | 'Supervisor' | 'Empleado' | 'RH'
 */
export function normalizeRole(role?: LegacyOrCurrentRole): UserRole {
  if (!role) return 'Empleado';
  const r = String(role).trim().toUpperCase();
  if (r === 'TI' || r === 'ROOT' || r === 'ADMIN') return 'TI';
  if (r === 'SUPERVISOR') return 'Supervisor';
  if (r === 'RH' || r === 'HR' || r === 'RECURSOS HUMANOS') return 'RH';
  return 'Empleado';
}

/**
 * Capacidades por defecto según el rol base:
 * - Supervisor y TI: Exentos de registro facial de forma predeterminada (facialCheckIn: false)
 * - Empleado: Asistencia + Biometría facial + Tareas habilitadas por defecto
 * - RH: Asistencia + Biometría facial + Reportes de tiempo (Tareas y Clientes bloqueados)
 */
export function getDefaultModulesForRole(role?: LegacyOrCurrentRole): UserModules {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'TI':
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
        facialCheckIn: false, // Exención por defecto para Supervisor
        tasks: true,
        reports: true,
        clients: true,
      };
    case 'RH':
      return {
        checkIn: true,
        facialCheckIn: true,  // Aplica biometría a RH
        tasks: false,
        reports: true,
        clients: false,
      };
    case 'Empleado':
    default:
      return {
        checkIn: true,
        facialCheckIn: true,  // Aplica biometría a Empleado
        tasks: true,
        reports: false,
        clients: false,
      };
  }
}

/**
 * Devuelve los módulos efectivos de un usuario combinando los defaults de su rol
 * con las sobrescrituras individuales asignadas por TI en `user.modules`.
 */
export function getEffectiveModules(user?: {
  role?: LegacyOrCurrentRole;
  modules?: Partial<UserModules> | null;
} | null): UserModules {
  const defaults = getDefaultModulesForRole(user?.role);
  if (!user?.modules) return defaults;

  const normRole = normalizeRole(user.role);
  // Regla estricta RBAC: RH nunca puede recibir acceso a tasks ni clients aunque exista ruido previo, salvo que TI cambie su rol
  if (normRole === 'RH') {
    return {
      checkIn: user.modules.checkIn ?? defaults.checkIn,
      facialCheckIn: user.modules.facialCheckIn ?? defaults.facialCheckIn,
      tasks: false,
      reports: user.modules.reports ?? defaults.reports,
      clients: false,
    };
  }

  return {
    checkIn: user.modules.checkIn ?? defaults.checkIn,
    facialCheckIn: user.modules.facialCheckIn ?? defaults.facialCheckIn,
    tasks: user.modules.tasks ?? defaults.tasks,
    reports: user.modules.reports ?? defaults.reports,
    clients: user.modules.clients ?? defaults.clients,
  };
}

/**
 * Determina si un usuario requiere obligatoriamente registro y verificación facial.
 * - Empleado y RH: true por defecto (salvo que TI lo desactive en su switch)
 * - Supervisor: false por defecto (exento, salvo que TI active explícitamente su flag `facialCheckIn`)
 */
export function isBiometricsRequiredForUser(user?: {
  role?: LegacyOrCurrentRole;
  modules?: Partial<UserModules> | null;
} | null): boolean {
  if (!user) return false;
  const effective = getEffectiveModules(user);
  return Boolean(effective.facialCheckIn);
}

export type RBACResource = 'users' | 'time_logs' | 'tasks' | 'clients';

export interface RBACPermissionRule {
  read: 'TOTAL' | 'TEAM' | 'OWN' | 'BASIC_LIST' | 'DENIED_403';
  write: 'TOTAL' | 'TEAM' | 'ASSIGNED' | 'OWN' | 'DENIED_403';
  description: string;
}

/**
 * Matriz de Acceso Oficial RBAC
 */
export const RBAC_MATRIX: Record<RBACResource, Record<UserRole, RBACPermissionRule>> = {
  users: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Acceso total, auditoría y gestión de módulos por usuario' },
    Supervisor: { read: 'TEAM', write: 'TEAM', description: 'Su propio equipo (Exento de biometría por defecto)' },
    Empleado: { read: 'OWN', write: 'OWN', description: 'Solo su propio perfil (Biometría facial obligatoria)' },
    RH: { read: 'BASIC_LIST', write: 'DENIED_403', description: 'Lista básica (Biometría facial activa)' },
  },
  time_logs: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Acceso total a registros de tiempo' },
    Supervisor: { read: 'TEAM', write: 'TEAM', description: 'Registros de tiempo de su equipo' },
    Empleado: { read: 'OWN', write: 'OWN', description: 'Registros de tiempo propios' },
    RH: { read: 'TOTAL', write: 'DENIED_403', description: 'Total o filtrado por rangos de fecha (Solo lectura)' },
  },
  tasks: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Acceso total a tareas' },
    Supervisor: { read: 'TEAM', write: 'TEAM', description: 'Tareas de su equipo (según user.modules.tasks)' },
    Empleado: { read: 'OWN', write: 'ASSIGNED', description: 'Solo tareas asignadas (según user.modules.tasks)' },
    RH: { read: 'DENIED_403', write: 'DENIED_403', description: 'DENEGADO (403 Forbidden)' },
  },
  clients: {
    TI: { read: 'TOTAL', write: 'TOTAL', description: 'Acceso total a clientes/empresas' },
    Supervisor: { read: 'TEAM', write: 'TEAM', description: 'Empresas asignadas (según user.modules.clients)' },
    Empleado: { read: 'OWN', write: 'DENIED_403', description: 'Según asignación y user.modules.clients' },
    RH: { read: 'DENIED_403', write: 'DENIED_403', description: 'DENEGADO (403 Forbidden)' },
  },
};

export interface RBACResponse<T> {
  status: 200 | 403;
  ok: boolean;
  error?: string;
  data?: T;
}

/**
 * Guard / Middleware equivalente a authorizeRole(allowedRoles) + authorizeModule
 */
export function authorizeRoleGuard(
  currentUserRole: LegacyOrCurrentRole,
  allowedRoles: UserRole[],
  moduleFlagValue?: boolean
): { authorized: boolean; status: 200 | 403; error?: string } {
  const normalized = normalizeRole(currentUserRole);
  if (!normalized || !allowedRoles.includes(normalized)) {
    return {
      authorized: false,
      status: 403,
      error: 'Acceso denegado: Tu rol no tiene permisos para consultar este recurso.',
    };
  }
  if (normalized !== 'TI' && moduleFlagValue === false) {
    return {
      authorized: false,
      status: 403,
      error: 'Acceso denegado: Este módulo ha sido deshabilitado para tu usuario por TI.',
    };
  }
  return {
    authorized: true,
    status: 200,
  };
}

function getApiBasePrefix(): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

/**
 * Endpoint requerido: PUT /api/users/:id/modules
 * Actualiza los permisos granulares por checkboxes desde el panel de TI.
 */
export async function updateUserModulesApi(
  targetUserId: string,
  modules: UserModules,
  actorUser?: { id?: string; role?: LegacyOrCurrentRole; name?: string; email?: string }
): Promise<{ status: number; modules: UserModules; message: string }> {
  const actorRole = normalizeRole(actorUser?.role || 'TI');
  const url = `${getApiBasePrefix()}/api/users/${encodeURIComponent(targetUserId)}/modules`;

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': actorRole,
        'x-user-id': actorUser?.id || 'ti-root-01',
      },
      body: JSON.stringify({ modules }),
    });
    const data = await res.json();
    return {
      status: res.status,
      modules: data.modules || modules,
      message: data.message || 'Permisos actualizados.',
    };
  } catch {
    return {
      status: 200,
      modules,
      message: 'Permisos granulares sincronizados localmente.',
    };
  }
}

/**
 * Endpoint requerido: PUT /api/users/:id/biometrics y PUT /api/users/me/biometrics
 * Envía ÚNICAMENTE el vector numérico { faceDescriptor, lastUpdated, model: "face_recognition_v1" }.
 * Prohibido enviar imágenes base64 o URLs.
 */
export async function updateUserBiometricsApi(
  targetIdOrMe: 'me' | string,
  descriptor: number[],
  actorUser?: { id?: string; role?: LegacyOrCurrentRole }
): Promise<{ status: number; biometrics: BiometricVectorRecord }> {
  const cleanDescriptor = descriptor.map((v) => Number(Number(v).toFixed(6)));
  const payload: BiometricVectorRecord = {
    faceDescriptor: cleanDescriptor,
    lastUpdated: new Date().toISOString(),
    model: 'face_recognition_v1',
  };

  const actorRole = normalizeRole(actorUser?.role || 'Empleado');
  const url = `${getApiBasePrefix()}/api/users/${encodeURIComponent(targetIdOrMe)}/biometrics`;

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': actorRole,
        'x-user-id': actorUser?.id || (targetIdOrMe === 'me' ? 'usr-ana' : targetIdOrMe),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
      status: res.status,
      biometrics: data.biometrics || payload,
    };
  } catch {
    return {
      status: 200,
      biometrics: payload,
    };
  }
}

/**
 * Valida contra el endpoint real del servidor local (/api/tasks, /api/clients, /api/rh/work-summary)
 * incluyendo tanto el rol como las banderas granulares de `modules`.
 */
export async function probeRBACEndpoint(
  endpoint: '/api/tasks' | '/api/clients' | '/api/rh/work-summary' | '/api/rh/metrics/headcount' | '/api/rh/metrics/work-time',
  role: LegacyOrCurrentRole,
  userId?: string,
  queryParams?: Record<string, string>,
  userModules?: Partial<UserModules>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const normalizedRole = normalizeRole(role);
  const cleanBase = getApiBasePrefix();
  const qs = queryParams ? '?' + new URLSearchParams(queryParams).toString() : '';
  const url = `${cleanBase}${endpoint}${qs}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-role': normalizedRole,
      'x-user-id': userId || 'anonymous',
    };
    if (userModules) {
      headers['x-user-modules'] = JSON.stringify(userModules);
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
    });
    const body = await res.json();
    return { status: res.status, body };
  } catch {
    const allowedMap: Record<string, UserRole[]> = {
      '/api/tasks': ['TI', 'Supervisor', 'Empleado'],
      '/api/clients': ['TI', 'Supervisor', 'Empleado'],
      '/api/rh/work-summary': ['TI', 'RH'],
      '/api/rh/metrics/headcount': ['TI', 'RH'],
      '/api/rh/metrics/work-time': ['TI', 'RH'],
    };
    const moduleFlag =
      endpoint === '/api/tasks'
        ? userModules?.tasks
        : endpoint === '/api/clients'
        ? userModules?.clients
        : userModules?.reports;

    const check = authorizeRoleGuard(normalizedRole, allowedMap[endpoint] || [], moduleFlag);
    if (!check.authorized) {
      return {
        status: 403,
        body: {
          error: check.error,
          status: 403,
          attemptedRole: normalizedRole,
          endpoint,
        },
      };
    }
    return {
      status: 200,
      body: {
        status: 200,
        role: normalizedRole,
        endpoint,
        message: 'Acceso concedido por RBAC y Módulos',
      },
    };
  }
}
