import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

interface InMemoryBiometrics {
  faceDescriptor: number[];
  lastUpdated: string;
  model: 'face_recognition_v1';
}

interface InMemoryModules {
  checkIn: boolean;
  facialCheckIn: boolean;
  tasks: boolean;
  reports: boolean;
  clients: boolean;
}

interface InMemoryUserRecord {
  id: string;
  name: string;
  email: string;
  role: 'TI' | 'Supervisor' | 'Empleado' | 'RH';
  modules: InMemoryModules;
  biometrics: InMemoryBiometrics | null;
}

/**
 * Plugin Middleware RBAC + Permisos Granulares + Biometría Vectorial (sin imágenes)
 * Sirve en vivo:
 *  - PUT /api/users/:id/modules
 *  - PUT /api/users/me/biometrics
 *  - PUT /api/users/:id/biometrics
 *  - GET /api/users
 *  - GET /api/tasks, /api/clients, /api/rh/*
 */
function rbacApiPlugin(): Plugin {
  const usersDb: Record<string, InMemoryUserRecord> = {
    'ti-root-01': {
      id: 'ti-root-01',
      name: 'Administrador TI (Root)',
      email: 'ti.root@russellbedford.mx',
      role: 'TI',
      modules: { checkIn: true, facialCheckIn: false, tasks: true, reports: true, clients: true },
      biometrics: null,
    },
    'admin-99': {
      id: 'admin-99',
      name: 'Supervisor Prueba',
      email: 'supervisor.prueba@russellbedford.mx',
      role: 'Supervisor',
      // Exención de rol por defecto para Supervisor: facialCheckIn = false
      modules: { checkIn: true, facialCheckIn: false, tasks: true, reports: true, clients: true },
      biometrics: null,
    },
    'sup-1': {
      id: 'sup-1',
      name: 'Mtro. Roberto Silva',
      email: 'roberto.silva@russellbedford.mx',
      role: 'Supervisor',
      modules: { checkIn: true, facialCheckIn: false, tasks: true, reports: true, clients: true },
      biometrics: null,
    },
    'rh-01': {
      id: 'rh-01',
      name: 'Dirección Recursos Humanos (RH)',
      email: 'rh.prueba@russellbedford.mx',
      role: 'RH',
      modules: { checkIn: true, facialCheckIn: true, tasks: false, reports: true, clients: false },
      biometrics: null,
    },
    'usr-ana': {
      id: 'usr-ana',
      name: 'Colaborador Prueba',
      email: 'colaborador.prueba@russellbedford.mx',
      role: 'Empleado',
      modules: { checkIn: true, facialCheckIn: true, tasks: true, reports: false, clients: false },
      biometrics: null,
    },
    'usr-carlos': {
      id: 'usr-carlos',
      name: 'Carlos Ruiz',
      email: 'carlos.ruiz@russellbedford.mx',
      role: 'Empleado',
      modules: { checkIn: true, facialCheckIn: true, tasks: true, reports: false, clients: false },
      biometrics: null,
    },
    'usr-luis': {
      id: 'usr-luis',
      name: 'Luis Mendoza',
      email: 'luis.mendoza@russellbedford.mx',
      role: 'Empleado',
      modules: { checkIn: true, facialCheckIn: true, tasks: true, reports: false, clients: false },
      biometrics: null,
    },
    'usr-sofia': {
      id: 'usr-sofia',
      name: 'Sofía Valdés',
      email: 'sofia.valdes@russellbedford.mx',
      role: 'Empleado',
      modules: { checkIn: true, facialCheckIn: true, tasks: true, reports: false, clients: false },
      biometrics: null,
    },
    'usr-miguel': {
      id: 'usr-miguel',
      name: 'Miguel Ángel Ramos',
      email: 'miguel.ramos@russellbedford.mx',
      role: 'Empleado',
      modules: { checkIn: true, facialCheckIn: true, tasks: true, reports: false, clients: false },
      biometrics: null,
    },
  };

  const readJsonBody = (req: import('http').IncomingMessage): Promise<Record<string, unknown>> =>
    new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk.toString();
      });
      req.on('end', () => {
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      });
      req.on('error', () => resolve({}));
    });

  return {
    name: 'rbac-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const cleanPath = rawUrl.replace(/^\/checkin-rb/, '').split('?')[0];
        const method = (req.method || 'GET').toUpperCase();

        if (!cleanPath.startsWith('/api/')) {
          return next();
        }

        const urlObj = new URL(rawUrl, 'http://localhost');
        const headerRole = (req.headers['x-user-role'] as string) || urlObj.searchParams.get('role') || '';
        const headerUserId = (req.headers['x-user-id'] as string) || urlObj.searchParams.get('userId') || 'usr-ana';
        const headerModulesRaw = req.headers['x-user-modules'] as string | undefined;

        let parsedHeaderModules: Partial<InMemoryModules> | null = null;
        if (headerModulesRaw) {
          try {
            parsedHeaderModules = JSON.parse(headerModulesRaw);
          } catch {
            parsedHeaderModules = null;
          }
        }

        const sendJson = (statusCode: number, payload: unknown) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
        };

        const checkRole = (allowedRoles: string[]): boolean => {
          if (!headerRole || !allowedRoles.includes(headerRole)) {
            sendJson(403, {
              error: 'Acceso denegado: Tu rol no tiene permisos para consultar este recurso.',
              status: 403,
              attemptedRole: headerRole || 'Sin rol',
              endpoint: cleanPath,
            });
            return false;
          }
          return true;
        };

        const checkModuleFlag = (moduleKey: keyof InMemoryModules): boolean => {
          if (headerRole === 'TI') return true;
          const dbUser = usersDb[headerUserId];
          const effectiveFlag =
            parsedHeaderModules && typeof parsedHeaderModules[moduleKey] === 'boolean'
              ? parsedHeaderModules[moduleKey]
              : dbUser?.modules?.[moduleKey];

          if (effectiveFlag === false) {
            sendJson(403, {
              error: `Acceso denegado: El módulo '${moduleKey}' está deshabilitado para tu usuario.`,
              status: 403,
              module: moduleKey,
              endpoint: cleanPath,
            });
            return false;
          }
          return true;
        };

        // 0. GET /api/users (Catálogo de permisos granulares para TI)
        if (method === 'GET' && cleanPath === '/api/users') {
          if (!checkRole(['TI'])) return;
          return sendJson(200, {
            status: 200,
            users: Object.values(usersDb),
          });
        }

        // 1. PUT /api/users/:id/modules (Exclusivo TI)
        const modulesMatch = cleanPath.match(/^\/api\/users\/([^/]+)\/modules$/);
        if (method === 'PUT' && modulesMatch) {
          if (!checkRole(['TI'])) return;
          const targetId = decodeURIComponent(modulesMatch[1]);
          const body = await readJsonBody(req);
          const rawMods = (body.modules as Record<string, unknown>) || body;

          const updatedModules: InMemoryModules = {
            checkIn: Boolean(rawMods.checkIn ?? true),
            facialCheckIn: Boolean(rawMods.facialCheckIn ?? false),
            tasks: Boolean(rawMods.tasks ?? false),
            reports: Boolean(rawMods.reports ?? false),
            clients: Boolean(rawMods.clients ?? false),
          };

          if (!usersDb[targetId]) {
            usersDb[targetId] = {
              id: targetId,
              name: String(body.name || targetId),
              email: String(body.email || `${targetId}@russellbedford.mx`),
              role: (body.role as InMemoryUserRecord['role']) || 'Empleado',
              modules: updatedModules,
              biometrics: null,
            };
          } else {
            usersDb[targetId].modules = updatedModules;
          }

          return sendJson(200, {
            status: 200,
            id: targetId,
            modules: updatedModules,
            updatedAt: new Date().toISOString(),
            message: 'Permisos granulares actualizados en el servidor.',
          });
        }

        // 2. PUT /api/users/me/biometrics y PUT /api/users/:id/biometrics
        const biometricsMatch = cleanPath.match(/^\/api\/users\/([^/]+)\/biometrics$/);
        if (method === 'PUT' && biometricsMatch) {
          if (!checkRole(['TI', 'Supervisor', 'Empleado', 'RH'])) return;
          const rawTarget = decodeURIComponent(biometricsMatch[1]);
          const targetId = rawTarget === 'me' ? headerUserId : rawTarget;

          if (targetId !== headerUserId && headerRole !== 'TI') {
            return sendJson(403, {
              error: 'Acceso denegado: Solo puedes recalibrar tu propio vector biométrico.',
              status: 403,
            });
          }

          const body = await readJsonBody(req);

          // Bloqueo estricto contra almacenamiento de imágenes en base64 o URLs
          const forbiddenKeys = ['photo', 'image', 'base64', 'photoDataUrl', 'facePhotoUrl', 'enrolledFacePhoto'];
          for (const key of forbiddenKeys) {
            if (body[key] !== undefined && body[key] !== null) {
              return sendJson(400, {
                error: `Prohibido almacenar imágenes biométricas ('${key}'). Solo se acepta el vector numérico faceDescriptor.`,
                status: 400,
              });
            }
          }

          const descriptor = body.faceDescriptor;
          if (!Array.isArray(descriptor) || descriptor.length < 16 || !descriptor.every((n) => typeof n === 'number' && Number.isFinite(n))) {
            return sendJson(400, {
              error: 'faceDescriptor inválido: se requiere un arreglo de floats.',
              status: 400,
            });
          }

          const cleanBiometrics: InMemoryBiometrics = {
            faceDescriptor: descriptor.map((n: number) => Number(n.toFixed(6))),
            lastUpdated: new Date().toISOString(),
            model: 'face_recognition_v1',
          };

          if (!usersDb[targetId]) {
            usersDb[targetId] = {
              id: targetId,
              name: targetId,
              email: `${targetId}@russellbedford.mx`,
              role: (headerRole as InMemoryUserRecord['role']) || 'Empleado',
              modules: { checkIn: true, facialCheckIn: true, tasks: true, reports: false, clients: false },
              biometrics: cleanBiometrics,
            };
          } else {
            usersDb[targetId].biometrics = cleanBiometrics;
          }

          return sendJson(200, {
            status: 200,
            userId: targetId,
            biometrics: cleanBiometrics,
            message: 'Vector facial actualizado sin almacenar imágenes.',
          });
        }

        // 3. Endpoint /api/tasks (RH bloqueado + valida user.modules.tasks)
        if (cleanPath === '/api/tasks') {
          if (!checkRole(['TI', 'Supervisor', 'Empleado'])) return;
          if (!checkModuleFlag('tasks')) return;
          return sendJson(200, {
            status: 200,
            role: headerRole,
            userId: headerUserId,
            message: 'Acceso autorizado al módulo de tareas.',
          });
        }

        // 4. Endpoint /api/clients (RH bloqueado + valida user.modules.clients)
        if (cleanPath === '/api/clients') {
          if (!checkRole(['TI', 'Supervisor', 'Empleado'])) return;
          if (!checkModuleFlag('clients')) return;
          return sendJson(200, {
            status: 200,
            role: headerRole,
            userId: headerUserId,
            message: 'Acceso autorizado al catálogo de clientes y empresas.',
          });
        }

        // 5. Endpoints exclusivos de RH (/api/rh/work-summary, /api/rh/metrics/headcount, /api/rh/metrics/work-time)
        if (
          cleanPath === '/api/rh/work-summary' ||
          cleanPath === '/api/rh/metrics/headcount' ||
          cleanPath === '/api/rh/metrics/work-time'
        ) {
          if (!checkRole(['TI', 'RH'])) return;
          if (!checkModuleFlag('reports')) return;

          const startDate = urlObj.searchParams.get('startDate') || null;
          const endDate = urlObj.searchParams.get('endDate') || null;

          const collaborators = [
            { user_id: 'usr-ana', user_name: 'Colaborador Prueba (Ana García)', status: 'active', role: 'Empleado', hours_worked_in_period: 42.5, days_logged: 5, last_check_in: '09:02', last_check_out: '18:05' },
            { user_id: 'usr-carlos', user_name: 'Carlos Ruiz', status: 'active', role: 'Empleado', hours_worked_in_period: 38.5, days_logged: 5, last_check_in: '09:18', last_check_out: '17:50' },
            { user_id: 'usr-luis', user_name: 'Luis Mendoza', status: 'active', role: 'Empleado', hours_worked_in_period: 44.0, days_logged: 5, last_check_in: '08:52', last_check_out: '18:10' },
            { user_id: 'usr-sofia', user_name: 'Sofía Valdés', status: 'inactive', role: 'Empleado', hours_worked_in_period: 24.0, days_logged: 4, last_check_in: '09:00', last_check_out: '15:00' },
            { user_id: 'usr-miguel', user_name: 'Miguel Ángel Ramos', status: 'active', role: 'Empleado', hours_worked_in_period: 40.0, days_logged: 5, last_check_in: '09:04', last_check_out: '18:00' },
            { user_id: 'admin-99', user_name: 'Supervisor Prueba', status: 'active', role: 'Supervisor', hours_worked_in_period: 45.0, days_logged: 5, last_check_in: '08:45', last_check_out: '18:30' },
            { user_id: 'sup-1', user_name: 'Mtro. Roberto Silva', status: 'active', role: 'Supervisor', hours_worked_in_period: 43.0, days_logged: 5, last_check_in: '08:30', last_check_out: '18:00' },
          ];

          return sendJson(200, {
            status: 200,
            total_users: collaborators.length,
            active_users: collaborators.filter(c => c.status === 'active').length,
            total_hours_worked: collaborators.reduce((acc, c) => acc + c.hours_worked_in_period, 0),
            period: { startDate, endDate },
            collaborators,
          });
        }

        return next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rbacApiPlugin()],
  base: '/checkin-rb/',
})
