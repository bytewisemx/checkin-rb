import { useState, useEffect, useMemo } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { getEffectiveModules } from '../../services/rbac';
import {
  MapPin,
  Play,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Lock,
  Clock,
} from 'lucide-react';
import { getAddressFromCoordinates } from '../../services/geocoding';
import { useImmutableTimer } from '../../hooks/useTimer';
import { StripCardCalendar } from '../history/StripCardCalendar';
import { StartTaskModal } from './StartTaskModal';
import { EndDayAllocationModal } from './EndDayAllocationModal';
import { FacialEnrollmentModal } from './FacialEnrollmentModal';
import { FacialCheckinModal } from './FacialCheckinModal';
import { RealCheckoutModal } from './RealCheckoutModal';
import { loadFaceApiModels } from '../../services/facialBiometrics';
import { DailyQuoteCard } from '../../components/common/DailyQuoteCard';

export function CheckinPanel() {
  const {
    activeCheckin,
    startCheckin,
    switchActiveTask,
    endCheckin,
    pauseCheckin,
    resumeCheckin,
    user,
    getEffectiveUserModules,
    addToast,
    triggerDailyCutoff,
    checkOrphanSession,
    regularizeCheckout,
  } = useCheckinStore();

  const {
    tasks,
    projects,
    clients,
    teamMembers,
    activeWorkers,
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
  const [isRegularizationModalOpen, setIsRegularizationModalOpen] = useState(false);

  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [isFacialModalOpen, setIsFacialModalOpen] = useState(false);
  const [verifiedBiometrics, setVerifiedBiometrics] = useState<{
    matchScore?: number;
    distance?: number;
  } | null>(null);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Detección de jornada pendiente de regularización
  const hasPendingRegularization = Boolean(
    activeCheckin?.requiresRealCheckout ||
      activeCheckin?.status === 'pending_checkout_regularization'
  );

  // Fecha legible de la jornada huérfana / pendiente para la alerta
  const formattedPendingDate = useMemo(() => {
    if (!activeCheckin?.checkInTimeMs) return 'día anterior';
    const d = new Date(activeCheckin.checkInTimeMs);
    return d.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [activeCheckin]);

  // Vigía en Tiempo Real (Frontend) y Detección de Sesión Huérfana al Reabrir (Regla 1)
  useEffect(() => {
    // 1. Verificación inmediata de sesión huérfana al montar
    checkOrphanSession();

    // 2. Vigía en tiempo real mientras el cronómetro esté corriendo en el navegador
    const interval = setInterval(() => {
      if (
        activeCheckin &&
        activeCheckin.checkInTimeMs &&
        !hasPendingRegularization &&
        activeCheckin.status !== 'completed'
      ) {
        const startDate = new Date(activeCheckin.checkInTimeMs);
        const cutoffDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          23,
          59,
          0,
          0
        );
        if (Date.now() >= cutoffDate.getTime()) {
          void triggerDailyCutoff(activeCheckin.id);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCheckin, hasPendingRegularization, checkOrphanSession, triggerDailyCutoff]);

  // Sincronizar y restaurar la tarea activa interna de este usuario
  useEffect(() => {
    if (!user) return;
    const myWorker = activeWorkers.find((w) => w.userId === user.id);
    if (myWorker) {
      setActiveTaskId(myWorker.taskId);
      localStorage.setItem(`rb_active_task_id_${user.id}`, myWorker.taskId);
    } else {
      const stored = localStorage.getItem(`rb_active_task_id_${user.id}`);
      setActiveTaskId(stored || null);
    }
  }, [user?.id, activeWorkers]);

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

  // Precarga silenciosa de modelos de visión artificial para verificación express sin esperas
  useEffect(() => {
    if (requiresFacialBiometrics) {
      void loadFaceApiModels();
    }
  }, [requiresFacialBiometrics]);

  // Calcular límite de corte congelado en las 23:59:00 hrs
  const maxEndMs = useMemo(() => {
    if (!activeCheckin?.checkInTimeMs) return null;
    const startDate = new Date(activeCheckin.checkInTimeMs);
    const cutoffDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      23,
      59,
      0,
      0
    );
    if (hasPendingRegularization || Date.now() >= cutoffDate.getTime()) {
      return cutoffDate.getTime();
    }
    return null;
  }, [activeCheckin, hasPendingRegularization]);

  const { durationStr, isOverTime, secondsElapsed } = useImmutableTimer(
    activeCheckin?.checkInTimeMs || null,
    activeCheckin?.pauses || [],
    maxEndMs
  );

  // Escala de jornada laboral: 10 horas (36,000 segundos) • Círculo ampliado de 420px (r = 185, circunferencia = 1162.39)
  const TOTAL_WORK_SECONDS = 10 * 3600;
  const CIRCUMFERENCE = 1162.39;
  const progressRatio = Math.min(secondsElapsed / TOTAL_WORK_SECONDS, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progressRatio);

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

  // 5. Confirmar inicio de jornada (matutino / primer arranque de check-in)
  const handleConfirmStartWithTask = async (
    selectedTaskId: string | null,
    explicitBio?: { matchScore?: number; distance?: number }
  ) => {
    setIsStartTaskModalOpen(false);
    setIsLocating(true);
    const bio = explicitBio || verifiedBiometrics;

    const onLocationSuccess = async (lat: number, lng: number, address: string) => {
      let initialTaskData: { taskId: string; taskName: string; company?: string } | null = null;
      const currentUserId = user?.id || currentMember?.id || 'usr-ana';

      if (selectedTaskId && hasTasksModule) {
        const chosenTask = tasks.find((t) => t.id === selectedTaskId);
        const chosenProject = projects.find((p) => p.id === chosenTask?.projectId);
        const chosenClient = clients.find((c) => c.id === chosenProject?.clientId);
        if (chosenTask) {
          initialTaskData = {
            taskId: chosenTask.id,
            taskName: chosenTask.name,
            company: chosenClient?.name || chosenProject?.name || 'Russell Bedford',
          };
        }
      }

      await startCheckin(lat, lng, address, bio?.matchScore, bio?.distance, initialTaskData);
      setVerifiedBiometrics(null);
      setIsLocating(false);

      if (selectedTaskId && hasTasksModule) {
        setActiveTaskId(selectedTaskId);
        localStorage.setItem(`rb_active_task_id_${currentUserId}`, selectedTaskId);

        const chosenTask = tasks.find((t) => t.id === selectedTaskId);
        const chosenProject = projects.find((p) => p.id === chosenTask?.projectId);
        const chosenClient = clients.find((c) => c.id === chosenProject?.clientId);

        startWorkerTimer({
          userId: currentUserId,
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
        localStorage.removeItem(`rb_active_task_id_${currentUserId}`);
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

  // 6. Cambiar de tarea en jornada activa: Cierra lapso previo y abre nuevo lapso SIN alterar la jornada total
  const handleSwitchTask = (newTaskId: string | null) => {
    setIsStartTaskModalOpen(false);
    const currentUserId = user?.id || currentMember?.id || 'usr-ana';

    if (newTaskId === activeTaskId) return;

    if (newTaskId && hasTasksModule) {
      const chosenTask = tasks.find((t) => t.id === newTaskId);
      const chosenProject = projects.find((p) => p.id === chosenTask?.projectId);
      const chosenClient = clients.find((c) => c.id === chosenProject?.clientId);

      // Cerrar lapso previo y abrir nuevo lapso en el modelo de intervalos de tarea
      switchActiveTask(
        chosenTask
          ? {
              taskId: chosenTask.id,
              taskName: chosenTask.name,
              company: chosenClient?.name || chosenProject?.name || 'Russell Bedford',
            }
          : null
      );

      setActiveTaskId(newTaskId);
      localStorage.setItem(`rb_active_task_id_${currentUserId}`, newTaskId);

      startWorkerTimer({
        userId: currentUserId,
        userName: currentMember?.name || user?.name || 'Colaborador',
        taskId: newTaskId,
        taskName: chosenTask?.name || 'Tarea activa',
        projectName: chosenProject?.name || 'Proyecto',
        clientName: chosenClient?.name || 'Cliente',
        startedAtMs: Date.now(),
        currentDurationStr: '00:00:01',
      });

      addToast(`Tarea actualizada a: "${chosenTask?.name}". La jornada continúa sumando tiempo.`, 'success');
    } else {
      switchActiveTask(null);
      setActiveTaskId(null);
      localStorage.removeItem(`rb_active_task_id_${currentUserId}`);
      stopWorkerTimer(currentUserId);
      addToast('Jornada continuará en modo general (sin tarea asignada)', 'info');
    }
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
    localStorage.removeItem(`rb_active_task_id_${userId}`);
    setIsEndDayModalOpen(false);
    addToast('Jornada finalizada y horas imputadas correctamente al supervisor', 'success');
  };

  const handleCloseAsGeneral = async () => {
    const userId = currentMember?.id || user?.id || 'usr-ana';
    stopWorkerTimer(userId);
    await endCheckin();

    setActiveTaskId(null);
    localStorage.removeItem(`rb_active_task_id_${userId}`);
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
            <div
              title={
                hasEnrolledVector
                  ? 'Reconocimiento facial activo (vector calibrado)'
                  : 'Reconocimiento facial inactivo / no calibrado'
              }
              aria-label={
                hasEnrolledVector
                  ? 'Reconocimiento facial activo'
                  : 'Reconocimiento facial inactivo'
              }
              className={`p-1.5 rounded-md transition-colors ${
                hasEnrolledVector
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-rose-500 dark:text-rose-500'
              }`}
            >
              <ScanFace className="w-5 h-5" />
            </div>
          ) : (
            <span
              title="Exento de verificación facial"
              aria-label="Exento de verificación facial"
              className="p-1.5 text-slate-400 dark:text-slate-500"
            >
              <ScanFace className="w-5 h-5 opacity-60" />
            </span>
          )}

          {/* Indicador discreto de presencia / en línea */}
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

        {/* 1. Alerta Destacada en Tonos Azules Corporativos: Jornada Anterior sin Cierre Detectada (Regla 2.1) */}
        {hasPendingRegularization && (
          <div className="w-full max-w-xl mx-auto mb-6 p-5 sm:p-6 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border-2 border-blue-600/40 dark:border-blue-500/40 shadow-xs space-y-3.5 animate-fade-in">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-blue-950 dark:text-blue-100">
                  Jornada anterior sin cierre detectada ({formattedPendingDate})
                </h3>
              </div>
              <p className="text-xs text-blue-900/85 dark:text-blue-200/85 leading-relaxed pl-4.5">
                Tu cronómetro se detuvo automáticamente a las 23:59 hrs.{' '}
                <strong className="text-blue-950 dark:text-white font-semibold">
                  Define tu hora de salida real
                </strong>{' '}
                para contabilizar correctamente tu jornada y el tiempo de tus tareas antes de iniciar hoy.
              </p>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsRegularizationModalOpen(true)}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Regularizar Hora de Salida</span>
              </button>
            </div>
          </div>
        )}

        {!activeCheckin ? (
          <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in">
            {/* Botón de Inicio Play Minimalista Estilizado */}
            <button
              id="btn-play-checkin"
              data-tour="checkin-biometric-btn"
              onClick={handlePlayButtonClick}
              disabled={isLocating}
              className="group relative flex items-center justify-center p-8 sm:p-10 rounded-full transition-all duration-300 active:scale-95 hover:scale-105 disabled:opacity-75 disabled:hover:scale-100 disabled:active:scale-100 cursor-pointer focus:outline-hidden"
              aria-label="Iniciar Jornada"
              title="Iniciar Jornada"
            >
              {/* Resplandor y halo sutil de fondo al hover */}
              <div className="absolute inset-0 rounded-full bg-slate-200/50 dark:bg-slate-800/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Triángulo equilátero estilizado idéntico a la referencia visual */}
              <svg 
                className="w-32 h-32 sm:w-40 sm:h-40 text-[#0B253A] dark:text-white drop-shadow-[2px_14px_22px_rgba(11,37,58,0.32)] dark:drop-shadow-[2px_14px_22px_rgba(0,0,0,0.7)] transition-all duration-300 select-none" 
                viewBox="0 0 100 100" 
                fill="none"
              >
                <path 
                  d="M 32 30.5
                     A 7 7 0 0 1 42.5 24.5
                     L 75.5 44
                     A 7 7 0 0 1 75.5 56
                     L 42.5 75.5
                     A 7 7 0 0 1 32 69.5
                     Z"
                  stroke="currentColor" 
                  strokeWidth="6.5" 
                  strokeLinejoin="round" 
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>

              {isLocating && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/70 dark:bg-slate-900/70 rounded-full backdrop-blur-xs">
                  <RefreshCw className="w-12 h-12 text-blue-600 dark:text-sky-400 animate-spin" />
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
          <div className="flex flex-col items-center justify-center w-full max-w-2xl animate-fade-in py-2">
            {/* Círculo Ampliado y Dinámico (viewBox 420x420, r=185) */}
            <div className="relative w-84 h-84 sm:w-96 sm:h-96 md:w-[420px] md:h-[420px] flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 420 420">
                {/* Pista base */}
                <circle
                  cx="210"
                  cy="210"
                  r="185"
                  className="text-slate-100 dark:text-slate-800"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="transparent"
                />
                {/* Progreso activo (azul institucional / estado de pausa o exceso) */}
                <circle
                  id="progress-circle"
                  cx="210"
                  cy="210"
                  r="185"
                  className={`transition-all duration-1000 ease-linear ${
                    isCurrentlyPaused
                      ? 'text-amber-500'
                      : isOverTime
                      ? 'text-rose-500'
                      : 'text-blue-600 dark:text-[#38BDF8]'
                  }`}
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray="1162.39"
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>

              {/* Información Central Integrada (Sin recuadros) */}
              <div className="absolute flex flex-col items-center text-center px-6 max-w-full">
                {/* Tiempo Principal con Tipografía Limpia Tabular */}
                <div
                  id="timer-display"
                  data-tour="active-timer-display"
                  className={`text-6xl sm:text-7xl font-extrabold tracking-tight font-sans tabular-nums mb-3 ${
                    isOverTime && !isCurrentlyPaused
                      ? 'text-rose-500'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {durationStr}
                </div>

                {/* Tarea Activa Minimalista e Interactiva (Clic para cambiar de tarea) */}
                {hasTasksModule && (
                  <button
                    id="btn-trigger-task-modal"
                    type="button"
                    onClick={() => setIsStartTaskModalOpen(true)}
                    className="group flex flex-col items-center p-2 rounded-xl hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer max-w-[280px]"
                    title="Clic para cambiar de tarea"
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-[#38BDF8] transition-colors">
                      <span className="truncate">
                        {activeTask ? activeTask.name : 'Vincular tarea a la jornada'}
                      </span>
                      <svg
                        className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-[#38BDF8] shrink-0 transition-transform group-hover:rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                    {activeClient && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-normal truncate mt-0.5">
                        {activeClient.name} {activeProject ? `• ${activeProject.name}` : ''}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Controles Inferiores Minimalistas */}
            {hasPendingRegularization ? (
              <div className="flex flex-col items-center gap-2 mt-8 mb-4">
                <button
                  type="button"
                  onClick={() => setIsRegularizationModalOpen(true)}
                  className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>Regularizar Hora de Salida Real</span>
                </button>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 font-medium">
                  • Jornada congelada a las 23:59 hrs. Define tu hora de salida para habilitar nueva jornada.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-5 mt-8 mb-4">
                {/* Pausa / Reanudar */}
                <button
                  onClick={handlePauseToggle}
                  className={`w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition-all flex items-center justify-center active:scale-95 cursor-pointer ${
                    isCurrentlyPaused ? 'text-amber-500 border-amber-300 dark:border-amber-600/60' : ''
                  }`}
                  title={isCurrentlyPaused ? 'Reanudar jornada' : 'Pausar jornada'}
                  aria-label={isCurrentlyPaused ? 'Reanudar' : 'Pausar'}
                >
                  {isCurrentlyPaused ? (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  )}
                </button>

                {/* Detener / Finalizar */}
                <button
                  onClick={handleEndButtonClick}
                  className="w-12 h-12 rounded-full border border-red-100 dark:border-rose-900/40 bg-red-50/60 dark:bg-rose-950/30 hover:bg-red-100 dark:hover:bg-rose-900/50 text-red-600 dark:text-rose-400 transition-all flex items-center justify-center active:scale-95 cursor-pointer shadow-xs"
                  title="Finalizar jornada"
                  aria-label="Finalizar jornada"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="5" y="5" width="14" height="14" rx="2.5" />
                  </svg>
                </button>
              </div>
            )}

            {/* Ubicación y Validación Vectorial en diseño abierto */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-xs font-medium text-slate-500 dark:text-[#94A3B8] tracking-wide mt-2">
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
      <div data-tour="attendance-history-card" className="mt-10 w-full max-w-5xl mx-auto px-2 sm:px-4">
        <StripCardCalendar />
      </div>

      {hasTasksModule && (
        <>
          <StartTaskModal
            isOpen={isStartTaskModalOpen}
            onClose={() => setIsStartTaskModalOpen(false)}
            onSelectTaskAndStart={(taskId) => {
              if (activeCheckin) {
                handleSwitchTask(taskId);
              } else {
                void handleConfirmStartWithTask(taskId);
              }
            }}
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

      <RealCheckoutModal
        isOpen={isRegularizationModalOpen}
        onClose={() => setIsRegularizationModalOpen(false)}
        pendingCheckin={activeCheckin}
        onConfirm={async (realCheckoutTimeStr, note) => {
          if (activeCheckin) {
            await regularizeCheckout({
              checkinId: activeCheckin.id,
              realCheckoutTimeStr,
              note,
            });
          }
        }}
      />
    </div>
  );
}
