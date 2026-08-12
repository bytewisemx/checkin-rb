import { useState, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { MapPin, Play, Square, Pause } from 'lucide-react';
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
    <div className="w-full mt-4 flex flex-col min-h-[70vh] bg-transparent pb-10">

      {/* Header Minimalista con Logo */}
      <div className="w-full px-8 py-6 flex items-center justify-between">
        {/* Logo Minimalista */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center">
            <span className="text-white font-bold tracking-widest text-sm">RB</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 tracking-tight leading-none">CHECK-IN</span>
            <span className="text-[10px] text-slate-400 font-medium tracking-[0.2em] mt-0.5">PORTAL</span>
          </div>
        </div>

        {/* Indicador de Red Ultra Minimalista (Solo un punto) */}
        <div className="flex items-center" title={isOffline ? 'Sin conexión' : 'En línea'}>
          <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        {errorMsg && (
          <div className="absolute top-0 text-red-500 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {!activeCheckin ? (
          <div className="flex flex-col items-center justify-center space-y-12">
            <button
              onClick={handleStart}
              disabled={isLocating}
              className="group relative flex items-center justify-center transition-transform active:scale-95 hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 disabled:active:scale-100"
              aria-label="Iniciar Jornada"
            >
              <svg 
                viewBox="0 0 120 120" 
                className="w-32 h-32 sm:w-48 sm:h-48 drop-shadow-2xl" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="frontGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1E3A8A" />
                  </linearGradient>
                  <linearGradient id="sideGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1E40AF" />
                    <stop offset="100%" stopColor="#0F172A" />
                  </linearGradient>
                  <linearGradient id="highlightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.5"/>
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M 30 35 L 30 100 L 100 65 Z" fill="url(#sideGrad)" />
                <path d="M 25 25 L 25 90 L 95 55 Z" fill="url(#frontGrad)" />
                <path d="M 25 25 L 28 28 L 28 85 L 25 90 Z" fill="url(#highlightGrad)" />
                <path d="M 25 25 L 95 55 L 85 55 L 28 28 Z" fill="url(#highlightGrad)" />
              </svg>
            </button>
            <div className="text-center opacity-40">
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-800">
                {isLocating ? 'Procesando...' : 'Press to Start'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full space-y-16">

            {/* Reloj Ultra Minimalista (Sin ningún contenedor visual) */}
            <div className="flex flex-col items-center">
              <div className={`text-xs font-bold mb-6 uppercase tracking-[0.3em] ${
                isCurrentlyPaused ? 'text-amber-500' : isOverTime ? 'text-red-500 animate-pulse' : 'text-slate-400'
              }`}>
                {isCurrentlyPaused ? 'Pausa' : isOverTime ? 'Exceso' : 'Transcurrido'}
              </div>
              <div className={`text-8xl sm:text-[140px] leading-none font-montserrat font-bold tabular-nums tracking-tighter ${
                isOverTime && !isCurrentlyPaused ? 'text-red-500' : 'text-slate-900'
              }`}>
                {durationStr}
              </div>
            </div>

            {/* Controles Fantasma (Ghost) */}
            <div className="flex gap-12 sm:gap-24">
              <button
                onClick={handlePauseToggle}
                className="flex flex-col items-center justify-center text-slate-400 hover:text-slate-900 transition-colors active:scale-95"
              >
                <div className={`p-4 rounded-full mb-3 ${isCurrentlyPaused ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-900'}`}>
                  {isCurrentlyPaused ? <Play className="w-8 h-8 fill-current" /> : <Pause className="w-8 h-8 fill-current" />}
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em]">{isCurrentlyPaused ? 'Reanudar' : 'Pausa'}</span>
              </button>

              <button
                onClick={endCheckin}
                className="flex flex-col items-center justify-center text-red-300 hover:text-red-600 transition-colors active:scale-95"
              >
                <div className="p-4 bg-transparent text-red-500 mb-3">
                  <Square className="w-8 h-8 fill-current" />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Fin</span>
              </button>
            </div>
            
            {/* Ubicación (Solo texto flotante) */}
            <div className="flex items-center text-xs font-medium text-slate-400 tracking-wider">
              <MapPin className="w-3 h-3 mr-2 opacity-50" />
              {activeCheckin?.address ? activeCheckin.address : 'Ubicación Registrada'}
            </div>
          </div>
        )}
      </div>

      {/* Calendario Minimalista sin bordes fuertes */}
      <div className="mt-16 w-full max-w-4xl mx-auto px-4 opacity-50 hover:opacity-100 transition-opacity duration-500">
        <StripCardCalendar />
      </div>
    </div>
  );
}
