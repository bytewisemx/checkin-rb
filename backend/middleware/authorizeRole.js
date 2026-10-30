// middleware/authorizeRole.js
/**
 * Middleware de Autorización Basada en Roles (RBAC) y Módulos Granulares (modules)
 * Roles válidos: 'TI' | 'Supervisor' | 'Empleado' | 'RH'
 */
const authorizeRole = (allowedRoles = []) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Acceso denegado: Tu rol no tiene permisos para consultar este recurso."
      });
    }

    next();
  };
};

/**
 * Middleware de Permisos Granulares por Módulo (user.modules)
 * Protege los endpoints validando no solo el role, sino también la bandera del módulo
 * Ejemplo: authorizeModule('tasks') -> if (!req.user.modules.tasks) return res.status(403)
 */
const authorizeModule = (moduleKey) => {
  return (req, res, next) => {
    if (req.user?.role === 'TI') {
      return next();
    }

    if (!req.user?.modules || req.user.modules[moduleKey] !== true) {
      return res.status(403).json({
        error: `Acceso denegado: El módulo '${moduleKey}' está deshabilitado para tu cuenta por el administrador TI.`
      });
    }

    next();
  };
};

export default authorizeRole;
export { authorizeRole, authorizeModule };
