// routes/tasks.js
import { authorizeRole, authorizeModule } from '../middleware/authorizeRole.js';

/**
 * Controlador de consulta de tareas filtrado por RBAC:
 * - TI: Acceso total a todas las tareas
 * - Supervisor: Solo tareas creadas por él o de miembros de su equipo (supervisor_id)
 * - Empleado: Solo tareas asignadas a él (assigned_to === req.user.id)
 * - RH: BLOQUEADO por middleware authorizeRole con 403 Forbidden
 */
export const getTasksController = (req, res) => {
  const { id: userId, role } = req.user || {};
  const allTasks = req.db?.tasks || [];

  let filteredTasks = [];
  if (role === 'TI') {
    filteredTasks = allTasks;
  } else if (role === 'Supervisor') {
    filteredTasks = allTasks.filter(
      (t) => t.created_by === userId || req.user?.assigned_team_members?.includes(t.assigned_to)
    );
  } else if (role === 'Empleado') {
    filteredTasks = allTasks.filter((t) => t.assigned_to === userId);
  }

  return res.status(200).json({
    data: filteredTasks,
    total: filteredTasks.length,
  });
};

/**
 * Controlador de creación/asignación de tarea con Trigger de Notificación (Supervisor -> Empleado)
 */
export const createTaskController = (req, res) => {
  const { title, assigned_to, projectId, plannedHours = 8, priority = 'medium', description = '' } = req.body || {};
  const supervisorId = req.user?.id || 'admin-99';

  if (!title || !assigned_to) {
    return res.status(400).json({
      error: 'Los campos title y assigned_to son obligatorios.',
    });
  }

  const nowIso = new Date().toISOString();
  const newTask = {
    id: `tsk-${Date.now()}`,
    title,
    name: title,
    description,
    projectId: projectId || 'prj-aud-2026',
    assigned_to,
    created_by: supervisorId,
    status: 'pending',
    plannedHours,
    priority,
    created_at: nowIso,
    completed_at: null,
  };

  // Trigger Backend Evento 1: Emitir notificación en tiempo real para el empleado asignado
  const notification = {
    id: `notif-${Date.now()}`,
    recipient_id: assigned_to,
    sender_id: supervisorId,
    message: `Se te ha asignado una nueva tarea: "${title}".`,
    type: 'task_assigned',
    read: false,
    created_at: nowIso,
  };

  return res.status(201).json({
    task: newTask,
    notification,
  });
};

/**
 * Controlador de actualización de estado de tarea con Trigger de Finalización (Empleado -> Supervisor)
 */
export const updateTaskStatusController = (req, res) => {
  const { status, task } = req.body || {};
  const userId = req.user?.id;
  const nowIso = new Date().toISOString();

  const updatedTask = {
    ...task,
    status,
    completed_at: status === 'completed' ? nowIso : null,
  };

  let notification = null;
  if (status === 'completed') {
    // Trigger Backend Evento 2: Disparar notificación dirigida al created_by (Supervisor)
    notification = {
      id: `notif-${Date.now()}`,
      recipient_id: task?.created_by || 'admin-99',
      sender_id: userId,
      message: `El empleado ha completado la tarea "${task?.title || 'Asignada'}".`,
      type: 'task_completed',
      read: false,
      created_at: nowIso,
    };
  }

  return res.status(200).json({
    task: updatedTask,
    notification,
  });
};

/**
 * Definición de rutas protegidas de Tareas (RH NO está en allowedRoles -> 403 Forbidden)
 */
export function registerTaskRoutes(router, authenticateToken) {
  router.get(
    '/api/tasks',
    authenticateToken,
    authorizeRole(['TI', 'Supervisor', 'Empleado']),
    authorizeModule('tasks'),
    getTasksController
  );

  router.post(
    '/api/tasks',
    authenticateToken,
    authorizeRole(['TI', 'Supervisor']),
    authorizeModule('tasks'),
    createTaskController
  );

  router.patch(
    '/api/tasks/:id/status',
    authenticateToken,
    authorizeRole(['TI', 'Supervisor', 'Empleado']),
    authorizeModule('tasks'),
    updateTaskStatusController
  );
}
