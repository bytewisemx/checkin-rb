import React from 'react';

interface TimeInputSexagesimalProps {
  label?: string;
  totalHours: number;
  onChange: (newHours: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Campo de captura manual de tiempo desglosado en:
 * - Horas (entero >= 0)
 * - Minutos (0 a 59). Si el usuario introduce >= 60 se convierte automáticamente a +1h.
 */
export const TimeInputSexagesimal: React.FC<TimeInputSexagesimalProps> = ({
  label,
  totalHours,
  onChange,
  disabled = false,
  className = '',
}) => {
  const totalMinutes = Math.max(0, Math.round((Number(totalHours) || 0) * 60));
  const currentHours = Math.floor(totalMinutes / 60);
  const currentMinutes = totalMinutes % 60;

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const h = Math.max(0, parseInt(rawVal, 10) || 0);
    const updatedTotalMinutes = h * 60 + currentMinutes;
    onChange(Number((updatedTotalMinutes / 60).toFixed(4)));
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const m = Math.max(0, parseInt(rawVal, 10) || 0);
    // Si introduce 60 o más, se suma a las horas automáticamente
    const additionalHours = Math.floor(m / 60);
    const finalMinutes = m % 60;
    const finalHours = currentHours + additionalHours;
    const updatedTotalMinutes = finalHours * 60 + finalMinutes;
    onChange(Number((updatedTotalMinutes / 60).toFixed(4)));
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
          {label}
        </label>
      )}
      <div className="flex items-center space-x-2">
        <div className="flex-1 relative">
          <input
            type="number"
            min={0}
            step={1}
            disabled={disabled}
            value={currentHours}
            onChange={handleHoursChange}
            className="w-full bg-white dark:bg-[#0B111E] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:border-blue-600 dark:focus:border-sky-400"
            placeholder="0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
            h
          </span>
        </div>

        <span className="text-slate-400 font-bold">:</span>

        <div className="flex-1 relative">
          <input
            type="number"
            min={0}
            max={59}
            step={1}
            disabled={disabled}
            value={currentMinutes.toString().padStart(2, '0')}
            onChange={handleMinutesChange}
            className="w-full bg-white dark:bg-[#0B111E] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 text-right focus:outline-none focus:border-blue-600 dark:focus:border-sky-400"
            placeholder="00"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
            m
          </span>
        </div>
      </div>
    </div>
  );
};

