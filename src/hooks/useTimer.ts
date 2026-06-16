import { useState, useEffect } from 'react';
import type { PauseBlock } from '../store/useCheckinStore';

/**
 * Hook de cronómetro inmutable que no se rompe si se cierra la pestaña.
 * Usa los timestamps originales en milisegundos y resta las pausas.
 */
export function useImmutableTimer(startTimeMs: number | null, pauses: PauseBlock[] = []) {
  const [durationStr, setDurationStr] = useState('00:00:00');
  const [isOverTime, setIsOverTime] = useState(false);

  useEffect(() => {
    if (!startTimeMs) {
      setDurationStr('00:00:00');
      setIsOverTime(false);
      return;
    }

    const interval = setInterval(() => {
      const nowMs = Date.now(); // local now para tickeo fluido (la seguridad está en el servidor, aquí es solo visual)
      
      // Calcular cuánto tiempo de pausa acumulado hay
      let totalPauseMs = 0;
      let isCurrentlyPaused = false;

      pauses.forEach(p => {
        if (p.endMs) {
          totalPauseMs += (p.endMs - p.startMs);
        } else {
          // Está en pausa ahorita, sumar el tiempo de pausa hasta AHORA
          totalPauseMs += (nowMs - p.startMs);
          isCurrentlyPaused = true;
        }
      });

      const effectiveElapsedMs = (nowMs - startTimeMs) - totalPauseMs;

      // Si pasaron 10 horas continuas (10 * 60 * 60 * 1000 = 36000000 ms)
      setIsOverTime(effectiveElapsedMs > 36000000);

      const totalSeconds = Math.floor(effectiveElapsedMs / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      setDurationStr(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );

      // Si está pausado actualmente, opcionalmente podríamos hacer parpadear el reloj, 
      // pero con que no sume tiempo es suficiente.
    }, 1000);

    return () => clearInterval(interval);
  }, [startTimeMs, pauses]);

  return { durationStr, isOverTime };
}
