import { useState, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { MapPin, Play, Square, Pause, Wifi, WifiOff, Clock } from 'lucide-react';
import { getAddressFromCoordinates } from '../../services/geocoding';
import { useImmutableTimer } from '../../hooks/useTimer';
import { StripCardCalendar } from '../history/StripCardCalendar';

export function CheckinPanel() {
  const { activeCheckin, startCheckin, endCheckin, pauseCheckin, resumeCheckin } = useCheckinStore();
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Sincronización de Cronómetro Inmutable
  const { durationStr, isOverTime } = useImmutableTimer(
    activeCheckin?.checkInTimeMs || null,
    activeCheckin?.pauses || []
  );

  const isCurrentlyPaused = Boolean(
    activeCheckin &&
    activeCheckin.pauses &&
    activeCheckin.pauses.length > 0 &&
    activeCheckin.pauses[activeCheckin.pauses.length - 1].endMs === null
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleStart = () => {
    setErrorMsg('');
    setIsLocating(true);
    if (!navigator.geolocation) {
      setErrorMsg('Geolocalización no soportada en este dispositivo.');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const address = await getAddressFromCoordinates(lat, lng);
        await startCheckin(lat, lng, address);
        setIsLocating(false);
      },
      () => {
        setErrorMsg('Por favor, permite el acceso a tu ubicación para registrar tu asistencia.');
        setIsLocating(false);
      }
    );
  };

  const handlePauseToggle = async () => {
    if (isCurrentlyPaused) await resumeCheckin();
    else await pauseCheckin();
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 mt-4">

      {/* Contenedor Clean & Light SaaS */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Cabecera Limpia */}
        <div className="px-6 sm:px-8 py-5 flex items-center justify-between border-b border-slate-100 bg-white">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-slate-800 text-lg">Control de Asistencia</h2>
          </div>

          {/* Badge de Conectividad Moderno */}
          {isOffline ? (
            <div className="flex items-center px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs font-medium text-amber-700">
              <WifiOff className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Esperando conexión...
            </div>
          ) : (
            <div className="flex items-center px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-medium text-emerald-700">
              <Wifi className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
              En línea
            </div>
          )}
        </div>

        <div className="p-6 sm:p-10 bg-slate-50/30">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium flex items-center">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-8">
            {!activeCheckin ? (
              <button
                onClick={handleStart}
                disabled={isLocating}
                className="group relative w-full max-w-sm bg-indigo-600 text-white font-medium py-4 rounded-xl shadow-md shadow-indigo-600/20 hover:bg-indigo-700 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
              >
                <div className="flex items-center justify-center text-lg">
                  <Play className="w-5 h-5 mr-2.5 fill-current" />
                  <span>{isLocating ? 'Obteniendo ubicación...' : 'Iniciar Jornada'}</span>
                </div>
              </button>
            ) : (
              <div className="flex flex-col items-center w-full space-y-8">

                {/* Reloj Clean (Montserrat tabular-nums para estabilidad) */}
                <div className={`w-full max-w-sm flex flex-col items-center justify-center py-10 rounded-2xl transition-colors border shadow-sm ${isCurrentlyPaused
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : isOverTime
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}>
                  <div className="text-sm font-medium mb-3 text-slate-500 uppercase tracking-wider">
                    {isCurrentlyPaused ? 'Descanso Activo' : isOverTime ? 'Alerta: Exceso de Tiempo' : 'Tiempo Transcurrido'}
                  </div>
                  <div className={`text-6xl sm:text-7xl font-montserrat font-bold tabular-nums tracking-tight ${isOverTime && !isCurrentlyPaused ? 'text-red-500' : 'text-slate-800'}`}>
                    {durationStr}
                  </div>
                </div>

                {/* Controles de Botones Redondeados */}
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                  <button
                    onClick={handlePauseToggle}
                    className={`flex-1 flex items-center justify-center py-3.5 px-6 rounded-xl border font-semibold transition-all active:scale-[0.98]
                      ${isCurrentlyPaused
                        ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-700 shadow-md'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm'}
                    `}
                  >
                    {isCurrentlyPaused ? <Play className="w-4 h-4 mr-2 fill-current" /> : <Pause className="w-4 h-4 mr-2 fill-current" />}
                    <span>{isCurrentlyPaused ? 'Reanudar' : 'Tomar Descanso'}</span>
                  </button>

                  <button
                    onClick={endCheckin}
                    className="flex-1 flex items-center justify-center py-3.5 px-6 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all active:scale-[0.98] shadow-md shadow-red-500/20"
                  >
                    <Square className="w-4 h-4 mr-2 fill-current" />
                    <span>Finalizar Día</span>
                  </button>
                </div>
              </div>
            )}

            {/* Indicador de Ubicación Clean */}
            <div className="flex flex-col items-center mt-6">
              <div className="flex items-center text-sm font-medium text-slate-500 px-4 py-2 bg-slate-100/70 rounded-full border border-slate-200">
                <MapPin className="w-4 h-4 mr-2 text-indigo-400" />
                {activeCheckin?.address ? (
                  <span>{activeCheckin.address}</span>
                ) : (
                  <span>Ubicación GPS registrada al iniciar</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* El componente Strip Card Calendar Limpio */}
        <div className="bg-white border-t border-slate-100 py-6 px-4 sm:px-8">
          <StripCardCalendar />
        </div>

      </div>
    </div>
  );
}
