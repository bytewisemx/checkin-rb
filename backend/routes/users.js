// routes/users.js
import { authorizeRole } from '../middleware/authorizeRole.js';

/**
 * Valida que el payload biométrico contenga ÚNICAMENTE parámetros numéricos (floats)
 * y rechaza estrictamente cualquier intento de enviar imágenes base64 o URLs.
 */
function sanitizeAndValidateBiometricVector(body = {}) {
  const forbiddenImageFields = [
    'photo',
    'image',
    'base64',
    'photoDataUrl',
    'facePhotoUrl',
    'enrolledFacePhoto',
    'avatarUrl',
  ];

  for (const field of forbiddenImageFields) {
    if (body[field] !== undefined && body[field] !== null) {
      return {
        valid: false,
        error: `Violación de privacidad biométrica: Está estrictamente prohibido enviar o almacenar imágenes ('${field}'). Solo se permite faceDescriptor numérico.`,
      };
    }
  }

  const rawDescriptor = body.faceDescriptor;
  if (!Array.isArray(rawDescriptor) || rawDescriptor.length < 16) {
    return {
      valid: false,
      error: 'faceDescriptor inválido: Debe ser un arreglo numérico de floats (ej. 128 dimensiones).',
    };
  }

  const allNumeric = rawDescriptor.every(
    (v) => typeof v === 'number' && Number.isFinite(v)
  );
  if (!allNumeric) {
    return {
      valid: false,
      error: 'faceDescriptor contiene valores no numéricos.',
    };
  }

  const cleanVector = rawDescriptor.map((v) => Number(v.toFixed(6)));
  const biometricRecord = {
    faceDescriptor: cleanVector,
    lastUpdated: new Date().toISOString(),
    model: body.model === 'face_recognition_v1' ? body.model : 'face_recognition_v1',
  };

  return {
    valid: true,
    biometricRecord,
  };
}

/**
 * PUT /api/users/:id/modules
 * Exclusivo para el rol TI: actualiza las casillas/banderas granulares de módulos de un usuario.
 */
export const updateUserModulesController = (req, res) => {
  const targetUserId = req.params?.id;
  const incomingModules = req.body?.modules || req.body || {};

  if (!targetUserId) {
    return res.status(400).json({ error: 'Se requiere el ID del usuario.' });
  }

  const sanitizedModules = {
    checkIn: Boolean(incomingModules.checkIn ?? true),
    facialCheckIn: Boolean(incomingModules.facialCheckIn ?? false),
    tasks: Boolean(incomingModules.tasks ?? false),
    reports: Boolean(incomingModules.reports ?? false),
    clients: Boolean(incomingModules.clients ?? false),
  };

  if (req.db?.users) {
    const idx = req.db.users.findIndex((u) => u.id === targetUserId);
    if (idx !== -1) {
      req.db.users[idx].modules = sanitizedModules;
    }
  }

  return res.status(200).json({
    id: targetUserId,
    modules: sanitizedModules,
    updatedBy: req.user?.id || 'ti-root-01',
    updatedAt: new Date().toISOString(),
    message: 'Permisos granulares de módulos actualizados correctamente.',
  });
};

/**
 * PUT /api/users/:id/biometrics y PUT /api/users/me/biometrics
 * Captura inicial en registro y recalibración desde la pantalla de Ajustes.
 * Almacena únicamente { faceDescriptor, lastUpdated, model: "face_recognition_v1" } sin imágenes.
 */
export const updateUserBiometricsController = (req, res) => {
  const paramId = req.params?.id;
  const currentUserId = req.user?.id;
  const currentUserRole = req.user?.role;
  const targetUserId = !paramId || paramId === 'me' ? currentUserId : paramId;

  if (!targetUserId) {
    return res.status(400).json({ error: 'No se pudo identificar al usuario destino.' });
  }

  // Solo el propio usuario o TI pueden actualizar su vector biométrico
  if (targetUserId !== currentUserId && currentUserRole !== 'TI') {
    return res.status(403).json({
      error: 'Acceso denegado: Solo puedes actualizar tu propio vector biométrico.',
    });
  }

  const validation = sanitizeAndValidateBiometricVector(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  if (req.db?.users) {
    const idx = req.db.users.findIndex((u) => u.id === targetUserId);
    if (idx !== -1) {
      req.db.users[idx].biometrics = validation.biometricRecord;
      delete req.db.users[idx].enrolledFacePhoto;
      delete req.db.users[idx].facePhotoUrl;
    }
  }

  return res.status(200).json({
    userId: targetUserId,
    biometrics: validation.biometricRecord,
    message: 'Vector biométrico actualizado exitosamente (0 imágenes almacenadas).',
  });
};

export function registerUserRoutes(router, authenticateToken) {
  // TI actualiza módulos granulares por usuario
  router.put(
    '/api/users/:id/modules',
    authenticateToken,
    authorizeRole(['TI']),
    updateUserModulesController
  );

  // Recalibración desde Ajustes (/api/users/me/biometrics)
  router.put(
    '/api/users/me/biometrics',
    authenticateToken,
    authorizeRole(['TI', 'Supervisor', 'Empleado', 'RH']),
    updateUserBiometricsController
  );

  // Captura inicial y actualización por ID (/api/users/:id/biometrics)
  router.put(
    '/api/users/:id/biometrics',
    authenticateToken,
    authorizeRole(['TI', 'Supervisor', 'Empleado', 'RH']),
    updateUserBiometricsController
  );
}

