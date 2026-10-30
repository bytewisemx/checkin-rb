// routes/clients.js
import { authorizeRole, authorizeModule } from '../middleware/authorizeRole.js';

/**
 * Controlador de Clientes / Empresas (Excluyendo estrictamente a RH y validando modules.clients)
 */
export const getClientsController = (req, res) => {
  const { role } = req.user || {};
  const allClients = req.db?.clients || [];

  return res.status(200).json({
    role,
    data: allClients,
    total: allClients.length,
  });
};

export function registerClientRoutes(router, authenticateToken) {
  // RH NO está en allowedRoles + requiere bandera modules.clients activa
  router.get(
    '/api/clients',
    authenticateToken,
    authorizeRole(['TI', 'Supervisor', 'Empleado']),
    authorizeModule('clients'),
    getClientsController
  );
}
