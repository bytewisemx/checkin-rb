import { useState, useEffect, useMemo } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { getEffectiveModules } from '../../services/rbac';
import {
  MapPin,
  Play,
  Square,
  Pause,
  Briefcase,
  Building2,
  CheckSquare,
  RefreshCw,
  Sparkles,
  ScanFace,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { getAddressFromCoordinates } from '../../services/geocoding';
import { useImmutableTimer } from '../../hooks/useTimer';
import { StripCardCalendar } from '../history/StripCardCalendar';
import { StartTaskModal } from './StartTaskModal';
import { EndDayAllocationModal } from './EndDayAllocationModal';
import { FacialEnrollmentModal } from './FacialEnrollmentModal';
import { FacialCheckinModal } from './FacialCheckinModal';
import { PLAY_BUTTON_BASE64 } from '../../assets/playButtonBase64';
import { DailyQuoteCard } from '../../components/common/DailyQuoteCard';

export function CheckinPanel() {
  const {
    activeCheckin,
    startCheckin,
    endCheckin,
    pauseCheckin,
    resumeCheckin,
    user,
    getEffectiveUserModules,
    addToast,
  } = useCheckinStore();

  const {
    tasks,
    projects,
    clients,
    teamMembers,
    startWorkerTimer,
    stopWorkerTimer,
    recordDayAllocations,
  } = useRayonerStore();

  // Módulos granulares efectivos configurados por TI
  const effectiveModules = getEffectiveUserModules(user?.id) || getEffectiveModules(user);
  const requiresFacialBiometrics = effectiveModules.facialCheckIn;
  const hasTasksModule = effectiveModules.tasks;
  const hasCheckInModule = effectiveModules.checkIn;

  const hasEnrolledVector = Boolean(
    (user?.biometrics?.faceDescriptor && user.biometrics.faceDescriptor.length > 0) ||
      (user?.faceDescriptor && user.faceDescriptor.length > 0)
  );

  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [isStartTaskModalOpen, setIsStartTaskModalOpen] = useState(false);
  const [isEndDayModalOpen, setIsEndDayModalOpen] = useState(false);

  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isFacialModalOpen, setIsFacialModalOpen] = useState(false);
  const [verifiedBiometrics, setVerifiedBiometrics] = useState<{
    matchScore?: number;
    distance?: number;
  } | null>(null);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    return localStorage.getItem('rb_active_task_id') || null;
  });

  const currentMember = useMemo(() => {
    if (!user) return teamMembers[0] || null;
    return (
      teamMembers.find(
        (m) => m.id === user.id || m.email.toLowerCase() === user.email.toLowerCase()
      ) ||
      teamMembers[0] ||
      null
    );
  }, [user, teamMembers]);

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

  const activeTask = useMemo(() => {
    if (!activeTaskId || !hasTasksModule) return null;
    return tasks.find((t) => t.id === activeTaskId) || null;
  }, [activeTaskId, tasks, hasTasksModule]);

  const activeProject = useMemo(() => {
    if (!activeTask) return null;
    return projects.find((p) => p.id === activeTask.projectId) || null;
  }, [activeTask, projects]);

  const activeClient = useMemo(() => {
    if (!activeProject) return null;
    return clients.find((c) => c.id === activeProject.clientId) || null;
  }, [activeProject, clients]);

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

  const parseDurationToMinutes = (str: string): number => {
    const parts = str.split(':').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1] + Math.round(parts[2] / 60);
    }
    return 480;
  };

  // Paso siguiente tras biometría (o directo si está exento de biometría)
  const proceedAfterBiometrics = (bioData?: { matchScore?: number; distance?: number }) => {
    if (bioData) {
      setVerifiedBiometrics(bioData);
    }
    // Si TI deshabilitó el módulo de tareas para este usuario, inicia entrada/salida directa sin tareas
    if (!hasTasksModule) {
      void handleConfirmStartWithTask(null, bioData);
    } else {
      setIsStartTaskModalOpen(true);
    }
  };

  // 1. Al presionar el botón de Play: validar módulo Check-in y flag facialCheckIn
  const handlePlayButtonClick = () => {
    setErrorMsg('');

    if (!hasCheckInModule) {
      addToast('El módulo de Asistencia / Check-in está deshabilitado para tu usuario por TI.', 'error');
      return;
    }

    if (!requiresFacialBiometrics) {
      // Exento de biometría (ej. Supervisor por defecto, o exención otorgada por TI)
      proceedAfterBiometrics(undefined);
      return;
    }

    if (!hasEnrolledVector) {
      addToast(
        'Captura inicial obligatoria: registra tu vector facial antes de marcar asistencia.',
        'info'
      );
      setIsEnrollmentModalOpen(true);
    } else {
      setIsFacialModalOpen(true);
    }
  };

  // 2. Al completar enrolamiento biométrico vectorial
  const handleEnrollmentComplete = () => {
    setIsEnrollmentModalOpen(false);
    addToast('Vector facial calibrado. Iniciando verificación de asistencia...', 'success');
    setIsFacialModalOpen(true);
  };

  // 3. Al completar verificación facial vectorial en vivo (sin fotos base64)
  const handleFacialVerificationSuccess = (matchScore: number, distance: number) => {
    setIsFacialModalOpen(false);
    proceedAfterBiometrics({ matchScore, distance });
  };

  // 4. Contingencia técnica autorizada
  const handleFacialBypassContingency = () => {
    setIsFacialModalOpen(false);
    addToast('Contingencia técnica registrada para este check-in', 'info');
    proceedAfterBiometrics({ matchScore: 100 });
  };

  // 5. Confirmar inicio de jornada (con o sin tarea según permisos granulares)
  const handleConfirmStartWithTask = async (
    selectedTaskId: string | null,
    explicitBio?: { matchScore?: number; distance?: number }
  ) => {
    setIsStartTaskModalOpen(false);
    setIsLocating(true);
    const bio = explicitBio || verifiedBiometrics;

    const onLocationSuccess = async (lat: number, lng: number, address: string) => {
      await startCheckin(lat, lng, address, bio?.matchScore, bio?.distance);
      setVerifiedBiometrics(null);
      setIsLocating(false);

      if (selectedTaskId && hasTasksModule) {
        setActiveTaskId(selectedTaskId);
        localStorage.setItem('rb_active_task_id', selectedTaskId);

        const chosenTask = tasks.find((t) => t.id === selectedTaskId);
        const chosenProject = projects.find((p) => p.id === chosenTask?.projectId);
        const chosenClient = clients.find((c) => c.id === chosenProject?.clientId);

        startWorkerTimer({
          userId: currentMember?.id || user?.id || 'usr-ana',
          userName: currentMember?.name || user?.name || 'Colaborador',
          taskId: selectedTaskId,
          taskName: chosenTask?.name || 'Tarea activa',
          projectName: chosenProject?.name || 'Proyecto',
          clientName: chosenClient?.name || 'Cliente',
          startedAtMs: Date.now(),
          currentDurationStr: '00:00:01',
        });

        addToast(`Jornada iniciada. Trabajando en: ${chosenTask?.name}`, 'success');
      } else {
        setActiveTaskId(null);
        localStorage.removeItem('rb_active_task_id');
        addToast('Entrada de asistencia registrada correctamente.', 'success');
      }
    };

    if (!navigator.geolocation) {
      await onLocationSuccess(19.4326, -99.1332, 'Oficina Russell Bedford');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const address = await getAddressFromCoordinates(lat, lng);
        await onLocationSuccess(lat, lng, address);
      },
      async () => {
        await onLocationSuccess(19.4326, -99.1332, 'Ubicación de Registro');
      }
    );
  };

  const handlePauseToggle = async () => {
    if (isCurrentlyPaused) await resumeCheckin();
    else await pauseCheckin();
  };

  // 6. Al dar clic en Fin: si no tiene módulo de tareas, registra salida inmediata sin modal de tareas
  const handleEndButtonClick = () => {
    if (!hasTasksModule) {
      void handleCloseAsGeneral();
      return;
    }
    setIsEndDayModalOpen(true);
  };

  const handleConfirmCloseDay = async (allocations: Array<{ taskId: string; hours: number }>) => {
    const userId = currentMember?.id || user?.id || 'usr-ana';
    recordDayAllocations(userId, allocations);
    stopWorkerTimer(userId);
    await endCheckin();

    setActiveTaskId(null);
    localStorage.removeItem('rb_active_task_id');
    setIsEndDayModalOpen(false);
    addToast('Jornada finalizada y horas imputadas correctamente al supervisor', 'success');
  };

  const handleCloseAsGeneral = async () => {
    const userId = currentMember?.id || user?.id || 'usr-ana';
    stopWorkerTimer(userId);
    await endCheckin();

    setActiveTaskId(null);
    localStorage.removeItem('rb_active_task_id');
    setIsEndDayModalOpen(false);
    addToast('Salida de jornada registrada correctamente.', 'info');
  };

  if (!hasCheckInModule) {
    return (
      <div className="w-full max-w-xl mx-auto mt-12 p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-black text-slate-800">
          Módulo de Asistencia / Check-in Deshabilitado
        </h3>
        <p className="text-xs text-slate-500">
          El administrador de TI ha desactivado temporalmente el registro de asistencia para tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full mt-4 flex flex-col min-h-[70vh] bg-transparent pb-10">
      {/* Header Superior con Frase del Día y Estatus Biométrico Vectorial */}
      <div className="w-full px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <DailyQuoteCard />

        <div className="flex items-center space-x-4">
          {requiresFacialBiometrics ? (
            <button
              onClick={() => setIsEnrollmentModalOpen(true)}
              title={
                hasEnrolledVector
                  ? 'Reconocimiento facial activo (vector calibrado). Clic para recalibrar'
                  : 'Reconocimiento facial inactivo / pendiente de calibración. Clic para calibrar'
              }
              aria-label={
                hasEnrolledVector
                  ? 'Reconocimiento facial activo'
                  : 'Reconocimiento facial inactivo'
              }
              className={`p-1.5 transition-colors cursor-pointer rounded-md ${
                hasEnrolledVector
                  ? 'text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300'
                  : 'text-rose-500 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-400'
              }`}
            >
              <ScanFace className="w-5 h-5" />
            </button>
          ) : (
            <span
              title="Exento de verificación facial"
              aria-label="Exento de verificación facial"
              className="p-1.5 text-slate-400 dark:text-slate-500"
            >
              <ScanFace className="w-5 h-5 opacity-60" />
            </span>
          )}

          {activeCheckin && (
            <span className="text-xs font-heading font-semibold text-blue-700 dark:text-[#38BDF8] flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-[#38BDF8] animate-pulse mr-1.5" />
              En Jornada
            </span>
          )}

          <div className="flex items-center" title={isOffline ? 'Sin conexión' : 'En línea'}>
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
        {errorMsg && (
          <div className="absolute top-0 text-red-500 text-sm font-medium">{errorMsg}</div>
        )}

        {!activeCheckin ? (
          <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in">
            <button
              onClick={handlePlayButtonClick}
              disabled={isLocating}
              className="group relative flex items-center justify-center p-4 transition-all duration-300 active:scale-95 hover:scale-105 disabled:opacity-75 disabled:hover:scale-100 disabled:active:scale-100 cursor-pointer focus:outline-hidden"
              aria-label="Iniciar Jornada"
            >
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl group-hover:bg-cyan-400/35 transition-all duration-500 scale-90 group-hover:scale-115 pointer-events-none" />
              <div className="absolute inset-4 rounded-full bg-blue-600/10 blur-xl group-hover:bg-blue-600/25 transition-all duration-500 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-center">
                <img
                  src={PLAY_BUTTON_BASE64}
                  alt="Iniciar Check-in"
                  className="w-40 h-40 sm:w-52 sm:h-52 object-contain drop-shadow-[0_20px_35px_rgba(13,92,117,0.32)] group-hover:drop-shadow-[0_25px_45px_rgba(14,165,233,0.48)] transition-all duration-300 select-none pointer-events-none"
                  draggable={false}
                />
              </div>

              {isLocating && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/40 rounded-full backdrop-blur-2xs">
                  <RefreshCw className="w-12 h-12 text-[#0D5C75] animate-spin" />
                </div>
              )}
            </button>

            <div className="text-center space-y-1.5">
              <p className="text-xs font-heading font-bold uppercase tracking-[0.25em] text-slate-800 dark:text-[#F8FAFC]">
                {isLocating ? 'Obteniendo ubicación...' : 'Presiona para Iniciar'}
              </p>
              {!hasTasksModule && (
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                  Modo exclusivo de Entrada / Salida (Módulo de tareas deshabilitado por TI)
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full space-y-10 max-w-2xl">
            {/* Banner de Tarea Activa (solo si el módulo tasks está habilitado) */}
            {hasTasksModule && (
              <div className="w-full">
                {activeTask ? (
                  <div className="bg-[#131D31] rounded-md p-4 border border-[#233354] shadow-xs flex items-center justify-between gap-3 animate-fade-in text-[#F8FAFC]">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-[#1E40AF]/20 text-[#38BDF8] flex items-center justify-center shrink-0 border border-[#1E40AF]/40">
                        <CheckSquare className="w-4 h-4 text-[#38BDF8]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#38BDF8] flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse mr-1" />
                            Cronometrando Tarea Activa
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-[#F8FAFC] truncate">
                          {activeTask.name}
                        </h4>
                        <div className="flex items-center space-x-2 text-[11px] text-[#94A3B8] mt-0.5">
                          <span className="flex items-center truncate">
                            <Building2 className="w-3 h-3 mr-1 text-[#38BDF8]" />
                            {activeClient?.name || 'Cliente'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center truncate">
                            <Briefcase className="w-3 h-3 mr-1 text-[#94A3B8]" />
                            {activeProject?.name || 'Proyecto'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsStartTaskModalOpen(true)}
                      className="shrink-0 flex items-center space-x-1 text-xs font-heading font-semibold text-white bg-[#1E40AF] hover:bg-[#1D4ED8] border border-[#1E40AF] px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cambiar Tarea</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#131D31] rounded-md p-3.5 border border-[#233354] flex items-center justify-between gap-3 animate-fade-in text-[#F8FAFC]">
                    <div className="flex items-center space-x-2.5 text-xs text-[#94A3B8] min-w-0">
                      <Sparkles className="w-4 h-4 text-[#38BDF8] shrink-0" />
                      <span className="truncate font-medium">
                        Jornada en modo general (distribuirás tus horas al finalizar el día)
                      </span>
                    </div>

                    <button
                      onClick={() => setIsStartTaskModalOpen(true)}
                      className="shrink-0 text-xs font-heading font-semibold text-[#38BDF8] hover:text-[#F8FAFC] cursor-pointer"
                    >
                      + Vincular Tarea Ahora
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reloj Digital Minimalista */}
            <div className="flex flex-col items-center">
              <div
                className={`text-xs font-heading font-bold mb-3 uppercase tracking-[0.25em] ${
                  isCurrentlyPaused
                    ? 'text-[#F59E0B]'
                    : isOverTime
                    ? 'text-[#E11D48] animate-pulse'
                    : 'text-[#94A3B8]'
                }`}
              >
                {isCurrentlyPaused ? 'Pausa' : isOverTime ? 'Exceso' : 'Transcurrido'}
              </div>
              <div
                className={`text-7xl sm:text-[120px] leading-none font-heading font-bold tabular-nums tracking-tighter ${
                  isOverTime && !isCurrentlyPaused ? 'text-[#E11D48]' : 'text-[#F8FAFC]'
                }`}
              >
                {durationStr}
              </div>
            </div>

            {/* Controles de Pausa y Fin */}
            <div className="flex gap-12 sm:gap-24">
              <button
                onClick={handlePauseToggle}
                className="flex flex-col items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] transition-colors active:scale-95 cursor-pointer"
              >
                <div
                  className={`p-3.5 rounded-md mb-2.5 border ${
                    isCurrentlyPaused
                      ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                      : 'bg-[#1A2742] text-[#F8FAFC] border-[#233354] hover:border-[#38BDF8]'
                  }`}
                >
                  {isCurrentlyPaused ? (
                    <Play className="w-7 h-7 fill-current text-white" />
                  ) : (
                    <Pause className="w-7 h-7 fill-current text-current" />
                  )}
                </div>
                <span className="text-xs font-heading font-semibold uppercase tracking-wider">
                  {isCurrentlyPaused ? 'Reanudar' : 'Pausa'}
                </span>
              </button>

              <button
                onClick={handleEndButtonClick}
                className="flex flex-col items-center justify-center text-[#E11D48]/80 hover:text-[#E11D48] transition-colors active:scale-95 cursor-pointer"
              >
                <div className="p-3.5 bg-[#1A2742] text-[#E11D48] border border-[#E11D48]/30 rounded-md mb-2.5 hover:bg-[#E11D48]/10 transition-colors">
                  <Square className="w-7 h-7 fill-current" />
                </div>
                <span className="text-xs font-heading font-semibold uppercase tracking-wider">Fin</span>
              </button>
            </div>

            {/* Ubicación y Validación Vectorial en diseño abierto */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-xs font-medium text-slate-500 dark:text-[#94A3B8] tracking-wide">
              <div className="flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-blue-700 dark:text-[#38BDF8]" />
                <span>{activeCheckin?.address ? activeCheckin.address : 'Ubicación Registrada'}</span>
              </div>

              {activeCheckin?.biometricMatchScore != null && (
                <div className="flex items-center space-x-1.5 text-blue-700 dark:text-[#38BDF8]">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700 dark:text-[#38BDF8]" />
                  <span>
                    Vector Facial Validado ({activeCheckin.biometricMatchScore}%
                    {activeCheckin.biometricDistance != null
                      ? ` • d=${activeCheckin.biometricDistance}`
                      : ''}
                    )
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historial Reciente Deslizable del Mes */}
      <div className="mt-10 w-full max-w-5xl mx-auto px-2 sm:px-4">
        <StripCardCalendar />
      </div>

      {hasTasksModule && (
        <>
          <StartTaskModal
            isOpen={isStartTaskModalOpen}
            onClose={() => setIsStartTaskModalOpen(false)}
            onSelectTaskAndStart={(taskId) => handleConfirmStartWithTask(taskId)}
          />

          <EndDayAllocationModal
            isOpen={isEndDayModalOpen}
            onClose={() => setIsEndDayModalOpen(false)}
            onConfirmCloseDay={handleConfirmCloseDay}
            onCloseAsGeneral={handleCloseAsGeneral}
            workedDurationMinutes={parseDurationToMinutes(durationStr)}
            activeTaskId={activeTaskId}
          />
        </>
      )}

      <FacialEnrollmentModal
        isOpen={isEnrollmentModalOpen}
        onClose={() => setIsEnrollmentModalOpen(false)}
        onEnrollmentComplete={handleEnrollmentComplete}
        mode={hasEnrolledVector ? 'recalibrate' : 'initial'}
        endpointTarget="me"
      />

      <FacialCheckinModal
        isOpen={isFacialModalOpen}
        onClose={() => setIsFacialModalOpen(false)}
        onVerificationSuccess={handleFacialVerificationSuccess}
        onOpenReEnrollment={() => {
          setIsFacialModalOpen(false);
          setIsEnrollmentModalOpen(true);
        }}
        onBypassContingency={handleFacialBypassContingency}
      />
    </div>
  );
}
