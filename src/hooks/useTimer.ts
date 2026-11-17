import { useState, useEffect } from 'react';
import type { PauseBlock } from '../store/useCheckinStore';
import {
  MAX_CONTINUOUS_SHIFT_MINUTES,
  MAX_CONTINUOUS_SHIFT_MS,
  formatMinutesSexagesimal,
} from '../services/attendanceService';

/**
 * Hook de cronómetro inmutable que no se rompe si se cierra la pestaña.
 * Usa los timestamps originales en milisegundos y resta las pausas.
 * Aplica tope máximo obligatorio de 12 horas continuas (720 minutos -> 12h 00m)
 * y soporta congelamiento en maxEndMs (ej. corte a 12h o 23:59:00).
 */
export function useImmutableTimer(
  startTimeMs: number | null,
  pauses: PauseBlock[] = [],
  maxEndMs?: number | null
) {
  const [durationStr, setDurationStr] = useState('00:00:00');
  const [formattedShort, setFormattedShort] = useState('0h 00m');
  const [isOverTime, setIsOverTime] = useState(false);
  const [isTruncated12h, setIsTruncated12h] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    if (!startTimeMs) {
      setDurationStr('00:00:00');
      setFormattedShort('0h 00m');
      setIsOverTime(false);
      setIsTruncated12h(false);
      setSecondsElapsed(0);
      return;
    }

    const updateTick = () => {
      const hardLimit12hMs = startTimeMs + MAX_CONTINUOUS_SHIFT_MS;
      const effectiveCapMs = maxEndMs ? Math.min(maxEndMs, hardLimit12hMs) : hardLimit12hMs;
      const rawNowMs = Date.now();
      const rawElapsedMinutes = Math.floor((rawNowMs - startTimeMs) / 60000);
      const hit12hCap = rawElapsedMinutes >= MAX_CONTINUOUS_SHIFT_MINUTES;

      const nowMs = Math.min(rawNowMs, effectiveCapMs);
      let totalPauseMs = 0;

      pauses.forEach((p) => {
        if (p.endMs) {
          totalPauseMs += Math.max(0, Math.min(p.endMs, nowMs) - p.startMs);
        } else {
          totalPauseMs += Math.max(0, nowMs - p.startMs);
        }
      });

      const effectiveElapsedMs = Math.min(
        MAX_CONTINUOUS_SHIFT_MS,
        Math.max(0, nowMs - startTimeMs - totalPauseMs)
      );

      const isOver = effectiveElapsedMs > 36000000; // 10 horas
      setIsOverTime(isOver);
      setIsTruncated12h(hit12hCap);

      const totalSeconds = hit12hCap
        ? MAX_CONTINUOUS_SHIFT_MINUTES * 60
        : Math.floor(effectiveElapsedMs / 1000);
      setSecondsElapsed(totalSeconds);

      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      setDurationStr(
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      );
      setFormattedShort(formatMinutesSexagesimal(Math.floor(totalSeconds / 60)));
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);

    return () => clearInterval(interval);
  }, [startTimeMs, pauses, maxEndMs]);

  return { durationStr, formattedShort, isOverTime, isTruncated12h, secondsElapsed };
}
