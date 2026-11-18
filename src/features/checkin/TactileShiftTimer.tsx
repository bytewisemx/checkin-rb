import { useMemo } from 'react';

interface TactileShiftTimerProps {
  isActive?: boolean;
  isPaused?: boolean;
  elapsedMinutes?: number;
  targetMinutes?: number; // por defecto 720 (12h tope de jornada)
  formattedTime?: string;
  activeTaskTitle?: string;
  activeClientName?: string;
  isLocating?: boolean;
  onStartShift: () => void;
  onEndShift: () => void;
  onTogglePause?: () => void;
  onOpenTaskSelector?: () => void;
}

export function TactileShiftTimer({
  isActive = false,
  isPaused = false,
  elapsedMinutes = 0,
  targetMinutes = 720,
  formattedTime = '00:00:00',
  activeTaskTitle,
  activeClientName,
  isLocating = false,
  onStartShift,
  onEndShift,
  onTogglePause,
  onOpenTaskSelector,
}: TactileShiftTimerProps) {
  // Dimensiones matemáticas del control circular 3D
  const size = 260; // Diámetro contenedor exterior
  const center = size / 2;
  const strokeWidth = 7;
  const radius = 120; // Radio del aro
  const circumference = 2 * Math.PI * radius;

  // Porcentaje de llenado con tope máximo en targetMinutes (12h = 720 min)
  const safeMinutes = Math.max(0, Math.min(targetMinutes, elapsedMinutes));
  const progressPercent = targetMinutes > 0 ? (safeMinutes / targetMinutes) * 100 : 0;
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;

  // Texto legible de horas transcurridas
  const progressLabel = useMemo(() => {
    const h = Math.floor(safeMinutes / 60);
    const m = safeMinutes % 60;
    return `${h}h ${m < 10 ? '0' : ''}${m}m / 12h`;
  }, [safeMinutes]);

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-4">
      {/* Definición de Filtros y Degradados SVG para Textura Mate y Relieve 3D */}
      <svg className="absolute w-0 h-0" aria-hidden="true" focusable="false">
        <defs>
          {/* Microtextura mate de polímero suave */}
          <filter id="tactile-matte-texture" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="3"
              result="noise"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.025 0"
            />
            <feComposite in2="SourceGraphic" in="gl" operator="in" />
          </filter>

          {/* Relieve 3D para el Triángulo de Play */}
          <filter id="triangle-3d" x="-20%" y="-20%" width="140%" height="140%">
            {/* Iluminación superior izquierda */}
            <feDropShadow
              dx="-1"
              dy="-1.5"
              stdDeviation="1"
              floodColor="#FFFFFF"
              floodOpacity="0.9"
            />
            {/* Sombra de contacto inferior derecha */}
            <feDropShadow
              dx="1.5"
              dy="2.5"
              stdDeviation="1.8"
              floodColor="#0F172A"
              floodOpacity="0.18"
            />
          </filter>

          {/* Degradado lineal del botón circular mate */}
          <linearGradient id="button-surface-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#F4F6F9" />
            <stop offset="100%" stopColor="#E6EAF0" />
          </linearGradient>

          {/* Degradado del riel de progreso en Azul Profundo Corporativo */}
          <linearGradient id="ring-progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          {/* Riel base neutro en relieve bajo */}
          <linearGradient id="ring-base-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Sombra de Apoyo Suave Inferior Proyectada sobre la Superficie */}
      <div
        className="absolute w-[220px] h-[36px] bottom-2 rounded-full pointer-events-none opacity-40 blur-md"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.22) 0%, rgba(15, 23, 42, 0) 70%)',
        }}
      />

      {/* Contenedor Circular Principal */}
      <div className="relative w-[260px] h-[260px] flex items-center justify-center">
        {/* SVG del Anillo Tridimensional */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Riel base circular 3D */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#ring-base-grad)"
            strokeWidth={strokeWidth}
            className="opacity-70 dark:opacity-30"
          />

          {/* Arco activo en azul profundo conforme avanzan las horas */}
          {isActive && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="url(#ring-progress-grad)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          )}
        </svg>

        {/* Botón Central Táctil 3D */}
        {!isActive ? (
          // ================= ESTADO REPOSO: BOTÓN TÁCTIL PLAY =================
          <button
            type="button"
            onClick={onStartShift}
            disabled={isLocating}
            aria-label="Iniciar jornada laboral"
            title="Iniciar jornada laboral"
            className="group relative w-[150px] h-[150px] rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-200 active:scale-96 hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            style={{
              background: 'linear-gradient(145deg, #FFFFFF 0%, #F4F6F9 55%, #E6EAF0 100%)',
              boxShadow: `
                inset 0 2px 3px rgba(255, 255, 255, 0.95),
                inset 0 -2px 4px rgba(15, 23, 42, 0.08),
                0 10px 24px -4px rgba(15, 23, 42, 0.16),
                0 4px 10px -2px rgba(15, 23, 42, 0.08)
              `,
            }}
          >
            {/* Ícono de Play Equilátero Redondeado con Sombra Física 3D */}
            <svg
              className="w-12 h-12 ml-1 text-slate-700 transition-transform duration-200 group-hover:scale-105"
              viewBox="0 0 48 48"
              fill="currentColor"
              style={{ filter: 'url(#triangle-3d)' }}
            >
              <path d="M16 11.5C16 9.8 17.9 8.8 19.3 9.7L36.3 22.2C37.5 23 37.5 24.8 36.3 25.6L19.3 38.1C17.9 39 16 38 16 36.3V11.5Z" />
            </svg>

            {/* Micro-etiqueta sutil debajo del ícono */}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-1 font-['Plus_Jakarta_Sans']">
              {isLocating ? 'Ubicando...' : 'Iniciar'}
            </span>
          </button>
        ) : (
          // ================= ESTADO ACTIVO: CRONÓMETRO Y FINALIZAR =================
          <div
            className="relative w-[180px] h-[180px] rounded-full flex flex-col items-center justify-center p-3 text-center transition-all duration-300"
            style={{
              background: 'linear-gradient(145deg, #FFFFFF 0%, #F4F6F9 60%, #E7EBF1 100%)',
              boxShadow: `
                inset 0 2px 3px rgba(255, 255, 255, 0.95),
                inset 0 -2px 4px rgba(15, 23, 42, 0.06),
                0 12px 28px -6px rgba(15, 23, 42, 0.14),
                0 4px 10px -2px rgba(15, 23, 42, 0.06)
              `,
            }}
          >
            {/* Indicador de Estado y Pausa */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPaused
                    ? 'bg-amber-500'
                    : 'bg-emerald-500 animate-pulse'
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 font-['Plus_Jakarta_Sans']">
                {isPaused ? 'Pausado' : 'En Curso'}
              </span>
            </div>

            {/* Cronómetro en Vivo Tabular */}
            <div
              className="text-2xl font-bold font-['Space_Grotesk'] text-slate-900 tracking-tight my-0.5 select-text"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formattedTime}
            </div>

            {/* Progreso relativo de jornada */}
            <div
              className="text-[10px] font-medium text-slate-500 mb-2 font-['Plus_Jakarta_Sans']"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {progressLabel}
            </div>

            {/* Botón Sobrio Finalizar Jornada */}
            <button
              type="button"
              onClick={onEndShift}
              className="px-3.5 py-1 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#1E40AF] active:bg-[#172554] rounded-md transition-colors cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 font-['Plus_Jakarta_Sans']"
            >
              Finalizar
            </button>
          </div>
        )}
      </div>

      {/* Selector de Tarea Activa y Control de Pausa Rápido si la jornada está activa */}
      {isActive && (
        <div className="mt-4 flex flex-col items-center gap-2 max-w-xs text-center">
          {/* Tarea Asignada Actual */}
          <button
            type="button"
            onClick={onOpenTaskSelector}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer text-xs text-slate-700 dark:text-slate-300"
            title="Cambiar o seleccionar actividad de la jornada"
          >
            <span className="text-[11px] text-slate-400 group-hover:text-slate-500 font-medium">
              Actividad:
            </span>
            <span className="font-semibold truncate max-w-[160px] text-slate-800 dark:text-slate-200">
              {activeTaskTitle || 'Jornada general'}
            </span>
            {activeClientName && (
              <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                ({activeClientName})
              </span>
            )}
          </button>

          {/* Botón de Pausa / Reanudar opcional */}
          {onTogglePause && (
            <button
              type="button"
              onClick={onTogglePause}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer underline underline-offset-2"
            >
              {isPaused ? 'Reanudar actividad' : 'Pausar temporalmente'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
