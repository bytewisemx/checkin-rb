import { useState, useEffect } from 'react';
import type { PauseBlock } from '../store/useCheckinStore';

/**
 * Hook de cronómetro inmutable que no se rompe si se cierra la pestaña.
 * Usa los timestamps originales en milisegundos y resta las pausas.
 * Soporta congelamiento en maxEndMs (ej. corte automático a las 23:59:00).
 * Retorna la cadena de duración, si sobrepasa la jornada de 10 horas y los segundos netos transcurridos.
 */
export function useImmutableTimer(
  startTimeMs: number | null,
  pauses: PauseBlock[] = [],
  maxEndMs?: number | null
) {
  const [durationStr, setDurationStr] = useState('00:00:00');
  const [isOverTime, setIsOverTime] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    if (!startTimeMs) {
      setDurationStr('00:00:00');
      setIsOverTime(false);
      setSecondsElapsed(0);
      return;
    }

    const updateTick = () => {
      const nowMs = maxEndMs ? Math.min(Date.now(), maxEndMs) : Date.now();
      let totalPauseMs = 0;

      pauses.forEach((p) => {
        if (p.endMs) {
          totalPauseMs += Math.max(0, p.endMs - p.startMs);
        } else {
          totalPauseMs += Math.max(0, nowMs - p.startMs);
        }
      });

      const effectiveElapsedMs = Math.max(0, nowMs - startTimeMs - totalPauseMs);
      const isOver = effectiveElapsedMs > 36000000; // 10 horas = 36,000,000 ms
      setIsOverTime(isOver);

      const totalSeconds = Math.floor(effectiveElapsedMs / 1000);
      setSecondsElapsed(totalSeconds);

      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      setDurationStr(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);

    return () => clearInterval(interval);
  }, [startTimeMs, pauses, maxEndMs]);

  return { durationStr, isOverTime, secondsElapsed };
}
