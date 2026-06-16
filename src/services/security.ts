// src/services/security.ts
// Este módulo simula la lógica del "Backend" de Prevención de Fraudes

/**
 * Obtiene la hora real del servidor mundial para evitar que los usuarios
 * modifiquen el reloj interno de sus PCs para simular llegar a tiempo.
 */
export async function getSecureServerTime(): Promise<number> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('https://worldtimeapi.org/api/timezone/America/Mexico_City', {
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('API Mundial falló');
    
    const data = await res.json();
    // Devolvemos el timestamp Unix en milisegundos reales de la red
    return new Date(data.datetime).getTime();
  } catch (error) {
    console.warn("Fallo al obtener hora del servidor seguro. Usando fallback de reloj local:", error);
    // Fallback si la API pública de hora se cae
    return Date.now();
  }
}

/**
 * Captura la IP pública del usuario actual a través de ipify
 */
export async function captureClientIP(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('IP Fetch failed');

    const data = await res.json();
    return data.ip;
  } catch (error) {
    console.warn("No se pudo rastrear IP. El usuario podría tener AdBlockers o red inestable.");
    return '0.0.0.0 (Unknown)';
  }
}

/**
 * Calcula si hubo retardo, dada una hora de entrada esperada.
 * expectedEntryTime viene en formato "HH:MM" (ej. "09:00")
 * toleranceMinutes: 10
 */
export function calculateLateness(actualTimeMs: number, expectedEntryTime: string, toleranceMinutes = 10): { late: boolean, minutesLate: number } {
  if (!expectedEntryTime) return { late: false, minutesLate: 0 };

  const checkinDate = new Date(actualTimeMs);
  
  // Construir la fecha "Límite" de hoy
  const [expectedHour, expectedMinute] = expectedEntryTime.split(':').map(Number);
  
  const expectedDate = new Date(actualTimeMs);
  expectedDate.setHours(expectedHour, expectedMinute, 0, 0);

  // Agregar minutos de tolerancia
  expectedDate.setMinutes(expectedDate.getMinutes() + toleranceMinutes);

  if (checkinDate.getTime() > expectedDate.getTime()) {
    // Calcular cuántos minutos pasó de la hora original (NO de la tolerancia)
    const originalExpectedDate = new Date(actualTimeMs);
    originalExpectedDate.setHours(expectedHour, expectedMinute, 0, 0);
    
    const diffMs = checkinDate.getTime() - originalExpectedDate.getTime();
    const minutesLate = Math.floor(diffMs / 60000);
    
    return { late: true, minutesLate };
  }

  return { late: false, minutesLate: 0 };
}
