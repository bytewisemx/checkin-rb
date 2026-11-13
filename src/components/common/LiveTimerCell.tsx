import { useState, useEffect } from 'react';

export interface LiveTimerCellProps {
  startedAt?: number | string | null;
  accumulatedSeconds?: number;
  isRunning?: boolean;
  className?: string;
  badgeClassName?: string;
}

export function LiveTimerCell({
  startedAt,
  accumulatedSeconds = 0,
  isRunning = true,
  className = '',
  badgeClassName = '',
}: LiveTimerCellProps) {
  const [liveSeconds, setLiveSeconds] = useState<number>(() => {
    if (!isRunning || !startedAt) return accumulatedSeconds;
    const startMs = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
    const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    return accumulatedSeconds + elapsed;
  });

  useEffect(() => {
    const calculateSeconds = () => {
      if (!isRunning || !startedAt) {
        setLiveSeconds(accumulatedSeconds);
        return;
      }
      const startMs = typeof startedAt === 'number' ? startedAt : new Date(startedAt).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setLiveSeconds(accumulatedSeconds + elapsed);
    };

    calculateSeconds();
    if (!isRunning) return;

    const interval = setInterval(calculateSeconds, 1000);
    return () => clearInterval(interval);
  }, [startedAt, accumulatedSeconds, isRunning]);

  const formatHHMMSS = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formattedTime = formatHHMMSS(liveSeconds);

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums select-none ${className}`}
      title={isRunning ? `Cronómetro activo: ${formattedTime}` : `Tiempo acumulado: ${formattedTime}`}
    >
      {isRunning && (
        <span
          className={`w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0 ${badgeClassName}`}
          aria-hidden="true"
        />
      )}
      <span className={isRunning ? 'font-bold text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}>
        {formattedTime}
      </span>
    </div>
  );
}
