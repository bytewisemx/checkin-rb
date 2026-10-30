// routes/reports.js
import { authorizeRole, authorizeModule } from '../middleware/authorizeRole.js';

/**
 * Controlador de Headcount para RH y TI
 * Devuelve total de usuarios activos y lista básica (ID, nombre, estado) sin proyectos ni tareas
 */
export const getHeadcountController = (req, res) => {
  const rawUsers = req.db?.users || [];

  // Sanitización estricta: solo ID, nombre, estado, rol y departamento
  const sanitizedCollaborators = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    status: u.status || 'active',
    role: u.role || 'Empleado',
    team: u.team || 'General',
  }));

  const activeUsersCount = sanitizedCollaborators.filter((u) => u.status === 'active').length;

  return res.status(200).json({
    total_users: sanitizedCollaborators.length,
    active_users: activeUsersCount,
    inactive_users: sanitizedCollaborators.length - activeUsersCount,
    collaborators: sanitizedCollaborators,
  });
};

/**
 * Controlador de Registros de Tiempo de Trabajo (time_logs) para RH y TI
 * Equivalente a consultar rh_work_time_view (sin JOIN ni referencia a tasks ni clients)
 */
export const getTimeLogsController = (req, res) => {
  const rawTimeLogs = req.db?.time_logs || [];
  const { startDate, endDate } = req.query || {};

  const sanitizedLogs = rawTimeLogs
    .filter((log) => {
      if (startDate && log.date < startDate) return false;
      if (endDate && log.date > endDate) return false;
      return true;
    })
    .map((log) => ({
      user_id: log.user_id,
      user_name: log.user_name,
      status: log.status || 'active',
      date: log.date,
      hours_worked: log.hours_worked,
      check_in: log.check_in,
      check_out: log.check_out,
    }));

  return res.status(200).json({
    period: { startDate: startDate || 'all', endDate: endDate || 'all' },
    total_records: sanitizedLogs.length,
    time_logs: sanitizedLogs,
  });
};

/**
 * Endpoint exclusivo /api/rh/work-summary
 * Devuelve únicamente: total de usuarios, lista de colaboradores y horas laboradas por periodo,
 * omitiendo cualquier referencia a nombres de proyectos, empresas o tareas.
 */
export const getRHWorkSummaryController = (req, res) => {
  const rawUsers = req.db?.users || [];
  const rawTimeLogs = req.db?.time_logs || [];
  const { startDate, endDate } = req.query || {};

  const filteredLogs = rawTimeLogs.filter((log) => {
    if (startDate && log.date < startDate) return false;
    if (endDate && log.date > endDate) return false;
    return true;
  });

  const collaborators = rawUsers.map((u) => {
    const userLogs = filteredLogs.filter((l) => l.user_id === u.id);
    const periodHours = userLogs.reduce((sum, l) => sum + Number(l.hours_worked || 0), 0);

    return {
      user_id: u.id,
      user_name: u.name,
      status: u.status || 'active',
      role: u.role || 'Empleado',
      hours_worked_in_period: Number(periodHours.toFixed(2)),
      days_logged: userLogs.length,
      last_check_in: userLogs[0]?.check_in || u.entryTime || '09:00',
      last_check_out: userLogs[0]?.check_out || u.checkOutTime || '18:00',
    };
  });

  const totalHoursPeriod = collaborators.reduce((acc, c) => acc + c.hours_worked_in_period, 0);

  return res.status(200).json({
    total_users: collaborators.length,
    active_users: collaborators.filter((c) => c.status === 'active').length,
    total_hours_worked: Number(totalHoursPeriod.toFixed(2)),
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    collaborators,
    time_logs: filteredLogs.map((log) => ({
      user_id: log.user_id,
      user_name: log.user_name,
      status: log.status || 'active',
      date: log.date,
      hours_worked: Number(Number(log.hours_worked || 0).toFixed(2)),
      check_in: log.check_in,
      check_out: log.check_out,
    })),
  });
};

export function registerRHReportRoutes(router, authenticateToken) {
  router.get(
    '/api/rh/metrics/headcount',
    authenticateToken,
    authorizeRole(['TI', 'RH']),
    authorizeModule('reports'),
    getHeadcountController
  );

  router.get(
    '/api/rh/metrics/work-time',
    authenticateToken,
    authorizeRole(['TI', 'RH']),
    authorizeModule('reports'),
    getTimeLogsController
  );

  router.get(
    '/api/rh/work-summary',
    authenticateToken,
    authorizeRole(['TI', 'RH']),
    authorizeModule('reports'),
    getRHWorkSummaryController
  );
}
