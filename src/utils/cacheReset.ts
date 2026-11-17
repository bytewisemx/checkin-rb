/**
 * Purga automática única de caché local heredado (localStorage / sessionStorage)
 * Se ejecuta ANTES de la hidratación de los stores Zustand para erradicar cualquier
 * dato de pruebas pasadas (proyectos antiguos, cronómetros de 120h o historiales ficticios).
 */
export const CLEAN_SLATE_CACHE_VERSION = '2026-11-17-zero-mocks-v5';
const VERSION_STORAGE_KEY = 'rb_clean_slate_schema_version';

const LEGACY_KEYS_TO_PURGE = [
  'rayoner-supervisor-storage-v2',
  'rayoner-supervisor-storage-v1',
  'checkin-rb-storage-v2',
  'checkin-rb-storage-v1',
  'checkin-rb-audit-logs-v1',
  'rb_teams_store_v1',
  'checkin-gamification-storage',
  'rb_invitations_store_v1',
  'rb_notifications_store_v1',
];

export function runAutomaticLegacyCachePurge(): void {
  if (typeof window === 'undefined') return;

  try {
    const currentVersion = window.localStorage.getItem(VERSION_STORAGE_KEY);
    if (currentVersion === CLEAN_SLATE_CACHE_VERSION) {
      return;
    }

    // Preservar únicamente la preferencia visual de tema (claro/oscuro)
    const savedTheme = window.localStorage.getItem('rb_theme');

    // Eliminar todas las llaves heredadas y claves operativas viejas
    const keysToRemove = new Set<string>(LEGACY_KEYS_TO_PURGE);
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || k === VERSION_STORAGE_KEY || k === 'rb_theme') continue;
      if (
        k.startsWith('rb_') ||
        k.startsWith('rayoner-') ||
        k.startsWith('checkin-') ||
        k.includes('storage') ||
        k.includes('audit') ||
        k.includes('invitations') ||
        k.includes('notifications') ||
        k.includes('gamification')
      ) {
        keysToRemove.add(k);
      }
    }

    keysToRemove.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });

    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }

    if (savedTheme) {
      window.localStorage.setItem('rb_theme', savedTheme);
    }

    window.localStorage.setItem(VERSION_STORAGE_KEY, CLEAN_SLATE_CACHE_VERSION);
  } catch (err) {
    console.warn('[cacheReset] Error purgando caché heredado:', err);
  }
}

// Ejecutar inmediatamente al importar el módulo (antes de que Zustand inicialice stores)
runAutomaticLegacyCachePurge();
