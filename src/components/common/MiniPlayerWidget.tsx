import { useCheckinStore } from '../../store/useCheckinStore';
import { useImmutableTimer } from '../../hooks/useTimer';
import { Play, Pause, Square } from 'lucide-react';

export function MiniPlayerWidget() {
  const { activeCheckin, pauseCheckin, resumeCheckin, endCheckin } = useCheckinStore();

  // Condición Estricta: Solo renderizar si el turno ha iniciado
  if (!activeCheckin) return null;

  // Sincronización del cronómetro global
  const { durationStr, isOverTime } = useImmutableTimer(
    activeCheckin.checkInTimeMs,
    activeCheckin.pauses || []
  );

  const isCurrentlyPaused = Boolean(
    activeCheckin.pauses &&
    activeCheckin.pauses.length > 0 &&
    activeCheckin.pauses[activeCheckin.pauses.length - 1].endMs === null
  );

  const handlePauseToggle = async () => {
    if (isCurrentlyPaused) await resumeCheckin();
    else await pauseCheckin();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in sm:bottom-8 sm:right-8">
      {/* Estilo SaaS Moderno: Clean & Light */}
      <div className={`flex items-center space-x-4 bg-white p-3 pr-4 rounded-2xl shadow-xl shadow-slate-200/50 border transition-colors
        ${isCurrentlyPaused ? 'border-amber-100' : isOverTime ? 'border-red-100' : 'border-slate-100'}
      `}>

        {/* Indicador animado y Tiempo */}
        <div className="flex items-center pl-2">
          {!isCurrentlyPaused && !isOverTime && (
            <div className="w-2 h-2 rounded-full bg-emerald-400 mr-3 animate-pulse shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
          )}
          {isCurrentlyPaused && (
            <div className="w-2 h-2 rounded-full bg-amber-400 mr-3" />
          )}
          {isOverTime && !isCurrentlyPaused && (
            <div className="w-2 h-2 rounded-full bg-red-400 mr-3 animate-pulse" />
          )}

          <div className={`text-xl font-bold font-montserrat tabular-nums tracking-tight
            ${isCurrentlyPaused ? 'text-amber-600' : isOverTime ? 'text-red-500' : 'text-slate-800'}
          `}>
            {durationStr}
          </div>
        </div>

        <div className="w-px h-8 bg-slate-100 mx-2" />

        {/* Controles Minimalistas */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePauseToggle}
            title={isCurrentlyPaused ? 'Reanudar Jornada' : 'Pausar Jornada'}
            className={`p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center
              ${isCurrentlyPaused
                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}
            `}
          >
            {isCurrentlyPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={endCheckin}
            title="Finalizar Jornada"
            className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
