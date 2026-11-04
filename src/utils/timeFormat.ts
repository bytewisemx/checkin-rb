/**
 * Utilidades de Formato Sexagesimal de Tiempo (Horas y Minutos)
 * Estandarización universal de tiempo: Xh Ym (ej. 120h 00m, 195h 15m, 17h 30m).
 * Se eliminan los valores flotantes/decimales ambiguos (ej. 1.7h).
 */

/**
 * Convierte minutos totales enteros a formato Xh Ym.
 * @param totalMinutes Minutos totales (entero o número)
 * @returns Cadena con formato "Xh Ym" (ej. "120h 00m", "1h 30m")
 */
export const formatMinutesToHours = (totalMinutes: number = 0): string => {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

/**
 * Convierte horas (pueden venir con decimales de datos heredados) a formato Xh Ym.
 * Multiplica por 60 y formatea sexagesimalmente.
 * @param hours Cantidad de horas
 * @returns Cadena con formato "Xh Ym"
 */
export const formatHoursToSexagesimal = (hours: number = 0): string => {
  const totalMinutes = Math.round((Number(hours) || 0) * 60);
  return formatMinutesToHours(totalMinutes);
};

/**
 * Desglosa horas totales en objeto { hours, minutes }
 */
export const splitHoursToSexagesimal = (hours: number = 0): { hours: number; minutes: number } => {
  const totalMinutes = Math.max(0, Math.round((Number(hours) || 0) * 60));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
};

/**
 * Une horas y minutos en horas totales sexagesimales exactas (en base 60).
 * Si minutes es >= 60, se acumulan las horas correspondientes y el remanente de minutos.
 */
export const joinHoursAndMinutes = (hours: number = 0, minutes: number = 0): number => {
  const safeH = Math.max(0, Math.floor(Number(hours) || 0));
  const safeM = Math.max(0, Math.floor(Number(minutes) || 0));
  const totalMinutes = safeH * 60 + safeM;
  return Number((totalMinutes / 60).toFixed(4));
};

