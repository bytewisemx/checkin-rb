import { formatMinutesSexagesimal } from '../../services/attendanceService';

export interface TimeDistributionSegment {
  id: string;
  label: string;
  minutes: number;
}

interface TimeDistributionBarProps {
  totalShiftMinutes: number;
  segments: TimeDistributionSegment[];
  variant?: 'dark' | 'adaptive';
}

const SEGMENT_COLORS = [
  'bg-blue-600',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-slate-500',
];

export function TimeDistributionBar({
  totalShiftMinutes,
  segments,
  variant = 'adaptive',
}: TimeDistributionBarProps) {
  const safeTotal = Math.max(0, Math.round(totalShiftMinutes || 0));
  const activeSegments = segments
    .map((s) => ({
      ...s,
      minutes: Math.max(0, Math.round(s.minutes || 0)),
    }))
    .filter((s) => s.minutes > 0);

  const assignedMinutes = activeSegments.reduce((acc, s) => acc + s.minutes, 0);
  const remainingMinutes = safeTotal - assignedMinutes;
  const isOverflow = remainingMinutes < 0;
  const safeRemaining = Math.max(0, remainingMinutes);
  const denominator = Math.max(1, isOverflow ? assignedMinutes : safeTotal);

  const isDarkOnly = variant === 'dark';

  const containerCls = isDarkOnly
    ? 'bg-[#090E17] border border-slate-800 p-4 space-y-3'
    : 'bg-slate-50 dark:bg-[#090E17] border border-slate-200 dark:border-slate-800 p-4 space-y-3';

  const labelMutedCls = isDarkOnly
    ? 'text-slate-400'
    : 'text-slate-500 dark:text-slate-400';

  const valueMainCls = isDarkOnly
    ? 'text-slate-100'
    : 'text-slate-900 dark:text-slate-100';

  const barBgCls = isDarkOnly
    ? 'w-full h-2.5 bg-[#101726] border border-slate-800 flex overflow-hidden'
    : 'w-full h-2.5 bg-slate-200 dark:bg-[#101726] border border-slate-300 dark:border-slate-800 flex overflow-hidden';

  const sepBorderCls = isDarkOnly
    ? 'border-r border-[#090E17]'
    : 'border-r border-white dark:border-[#090E17]';

  const remainingPct =
    safeTotal > 0 ? Math.max(0, Math.round((safeRemaining / safeTotal) * 100)) : 0;

  return (
    <div className={containerCls}>
      {/* Contadores superiores */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span className={labelMutedCls}>Distribución de Jornada: </span>
          <span
            className={`font-mono font-semibold ${
              isOverflow ? 'text-rose-500 dark:text-rose-400' : valueMainCls
            }`}
          >
            {formatMinutesSexagesimal(assignedMinutes)}
          </span>
          <span className="text-slate-500 font-mono">
            {' '}
            asignadas de {formatMinutesSexagesimal(safeTotal)}
          </span>
        </div>

        <div>
          <span className={labelMutedCls}>
            {isOverflow ? 'Excedente: ' : 'Sin asignar: '}
          </span>
          <span
            className={`font-mono font-semibold ${
              isOverflow
                ? 'text-rose-500 dark:text-rose-400'
                : safeRemaining > 0
                ? 'text-blue-700 dark:text-sky-400'
                : labelMutedCls
            }`}
          >
            {formatMinutesSexagesimal(Math.abs(remainingMinutes))}
          </span>
        </div>
      </div>

      {/* Línea Segmentada de Distribución */}
      <div className={barBgCls} role="progressbar" aria-valuemin={0} aria-valuemax={safeTotal} aria-valuenow={assignedMinutes}>
        {activeSegments.map((seg, idx) => {
          const widthPct = Math.min(100, (seg.minutes / denominator) * 100);
          const colorCls = isOverflow
            ? 'bg-rose-600/80'
            : SEGMENT_COLORS[Math.min(idx, SEGMENT_COLORS.length - 1)];
          const pctLabel =
            safeTotal > 0 ? Math.round((seg.minutes / safeTotal) * 100) : 0;

          return (
            <div
              key={seg.id}
              style={{ width: `${widthPct}%` }}
              className={`${colorCls} ${sepBorderCls} transition-all duration-300`}
              title={`${seg.label}: ${formatMinutesSexagesimal(seg.minutes)} (${pctLabel}%)`}
            />
          );
        })}
      </div>

      {/* Leyenda Compacta de Segmentos */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] ${labelMutedCls} pt-0.5`}>
        {activeSegments.map((seg, idx) => {
          const colorCls = isOverflow
            ? 'bg-rose-600/80'
            : SEGMENT_COLORS[Math.min(idx, SEGMENT_COLORS.length - 1)];
          const pctLabel =
            safeTotal > 0 ? Math.round((seg.minutes / safeTotal) * 100) : 0;

          return (
            <div key={seg.id} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 ${colorCls} inline-block shrink-0`} />
              <span
                className={`truncate max-w-[160px] ${
                  isDarkOnly ? 'text-slate-300' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {seg.label}
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400">
                ({formatMinutesSexagesimal(seg.minutes)} · {pctLabel}%)
              </span>
            </div>
          );
        })}

        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 inline-block shrink-0 ${
              isDarkOnly
                ? 'bg-slate-800 border border-slate-600'
                : 'bg-slate-200 dark:bg-slate-800 border border-slate-400 dark:border-slate-600'
            }`}
          />
          <span>Sin asignar</span>
          <span className="font-mono">
            ({formatMinutesSexagesimal(safeRemaining)} · {remainingPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
