import { useState, useEffect, useMemo } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { getEffectiveModules } from '../../services/rbac';
import {
  MapPin,
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
import { SessionRegularizationModal } from './SessionRegularizationModal';
import { TactileShiftTimer } from './TactileShiftTimer';
import {
  computeElapsedShiftMinutes,
  MAX_CONTINUOUS_SHIFT_MINUTES,
} from '../../services/attendanceService';
import { loadFaceApiModels } from '../../services/facialBiometrics';
import { DailyQuoteCard } from '../../components/common/DailyQuoteCard';
import { useOperationalCatalogSync } from '../../hooks/useLiveTeamTimers';
import { doesTaskBelongToUser } from '../../services/taskService';
import { auth } from '../../services/firebase';

export function CheckinPanel() {
  useOperationalCatalogSync();
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
    assignments,
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

  // Detección de jornada pendiente de regularización (corte 12h o 23:59)
  const hasPendingRegularization = Boolean(
    activeCheckin?.requiresRegularization ||
    activeCheckin?.requiresRealCheckout ||
    activeCheckin?.status === 'truncated_12h' ||
    activeCheckin?.status === 'pending_regularization' ||
    activeCheckin?.status === 'pending_checkout_regularization'
  );

  // Abrir automáticamente el modal obligatorio si existe una jornada truncada/pendiente
  useEffect(() => {
    if (hasPendingRegularization) {
      setIsRegularizationModalOpen(true);
    }
  }, [hasPendingRegularization]);

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

  // Vigía en Tiempo Real (Frontend): Corte automático a las 12h 00m (720 min) y a las 23:59:00
  useEffect(() => {
    // 1. Verificación inmediata de sesión huérfana / truncada al montar
    checkOrphanSession();

    // 2. Vigía en tiempo real mientras el cronómetro esté corriendo en el navegador
    const interval = setInterval(() => {
      if (
        activeCheckin &&
        activeCheckin.checkInTimeMs &&
        !hasPendingRegularization &&
        activeCheckin.status !== 'completed'
      ) {
        const elapsedMinutes = computeElapsedShiftMinutes(activeCheckin.checkInTimeMs);
        if (elapsedMinutes >= MAX_CONTINUOUS_SHIFT_MINUTES) {
          void triggerDailyCutoff(activeCheckin.id, '12h');
          return;
        }

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
          void triggerDailyCutoff(activeCheckin.id, '23:59');
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
    if (!user) return null;
    return (
      teamMembers.find(
        (m) => m.id === user.id || m.email.toLowerCase() === user.email.toLowerCase()
      ) || null
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

  const { durationStr, secondsElapsed } = useImmutableTimer(
    activeCheckin?.checkInTimeMs || null,
    activeCheckin?.pauses || [],
    maxEndMs
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

  // Tareas asignadas estrictamente al usuario actual (unificado por id, uid, memberId y email)
  const userAssignedTasks = useMemo(() => {
    if (!user) return [];
    const identity = {
      id: user.id,
      uid: auth?.currentUser?.uid || null,
      memberId: currentMember?.id || null,
      email: user.email || currentMember?.email || null,
    };
    const assignedIds = new Set(
      assignments
        .filter(
          (a) =>
            a.userId === user.id ||
            (currentMember && a.userId === currentMember.id) ||
            (auth?.currentUser?.uid && a.userId === auth.currentUser.uid)
        )
        .map((a) => a.taskId)
    );
    return tasks.filter(
      (t) => t.status !== 'completed' && doesTaskBelongToUser(t, identity, assignedIds)
    );
  }, [tasks, assignments, user, currentMember]);

  // Paso siguiente tras biometría (o directo si está exento de biometría)
  const proceedAfterBiometrics = (bioData?: { matchScore?: number; distance?: number }) => {
    if (bioData) {
      setVerifiedBiometrics(bioData);
    }
    // Si TI deshabilitó el módulo de tareas o si el usuario no tiene tareas asignadas:
    // Permite iniciar la jornada laboral normalmente en modo Jornada General sin bloquear
    if (!hasTasksModule || userAssignedTasks.length === 0) {
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
      await onLocationSuccess(0, 0, 'Sin ubicación GPS disponible');
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
        await onLocationSuccess(0, 0, 'Sin ubicación GPS disponible');
      }
    );
  };

  // 6. Cambiar de tarea en jornada activa: Cierra lapso previo y abre nuevo lapso SIN alterar la jornada total
  const handleSwitchTask = (newTaskId: string | null) => {
    setIsStartTaskModalOpen(false);
    const currentUserId = user?.id || currentMember?.id || '';

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
    const userId = user?.id || currentMember?.id || '';
    if (userId && allocations.length > 0) {
      recordDayAllocations(userId, allocations);
    }
    if (userId) {
      stopWorkerTimer(userId);
      localStorage.removeItem(`rb_active_task_id_${userId}`);
    }
    await endCheckin();

    setActiveTaskId(null);
    setIsEndDayModalOpen(false);
    addToast('Jornada finalizada y tiempos registrados correctamente.', 'success');
  };

  const handleCloseAsGeneral = async () => {
    const userId = user?.id || currentMember?.id || '';
    if (userId) {
      stopWorkerTimer(userId);
      localStorage.removeItem(`rb_active_task_id_${userId}`);
    }
    await endCheckin();

    setActiveTaskId(null);
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
              className={`p-1.5 rounded-md transition-colors ${hasEnrolledVector
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
              className={`w-2.5 h-2.5 rounded-full ${isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
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

        {/* Control Principal Táctil 3D de Jornada (En reposo: Botón Play Táctil 3D / Activo: Anillo de 12h y cronómetro) */}
        <div className="w-full flex flex-col items-center justify-center animate-fade-in py-2">
          <TactileShiftTimer
            isActive={Boolean(activeCheckin && activeCheckin.status !== 'completed')}
            isPaused={isCurrentlyPaused}
            elapsedMinutes={Math.min(720, Math.floor(secondsElapsed / 60))}
            targetMinutes={720}
            formattedTime={durationStr}
            activeTaskTitle={activeTask?.name}
            activeClientName={activeClient?.name}
            isLocating={isLocating}
            onStartShift={handlePlayButtonClick}
            onEndShift={handleEndButtonClick}
            onTogglePause={handlePauseToggle}
            onOpenTaskSelector={() => setIsStartTaskModalOpen(true)}
          />

          {/* Regularización pendiente si la jornada superó el límite */}
          {hasPendingRegularization && (
            <div className="flex flex-col items-center gap-2 mt-4 mb-2">
              <button
                type="button"
                onClick={() => setIsRegularizationModalOpen(true)}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>Regularizar Hora de Salida Real</span>
              </button>
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 font-medium">
                • Jornada congelada a las 23:59 hrs. Define tu hora de salida para habilitar nueva jornada.
              </p>
            </div>
          )}

          {/* Metadatos de Geolocalización y Validación Facial si la jornada está activa */}
          {Boolean(activeCheckin && activeCheckin.status !== 'completed') && (
            <div className="flex flex-col sm:flex-row items-center gap-4 text-xs font-medium text-slate-500 dark:text-[#94A3B8] tracking-wide mt-3">
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
          )}
        </div>
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

      <SessionRegularizationModal
        isOpen={hasPendingRegularization || isRegularizationModalOpen}
        pendingCheckin={activeCheckin}
        onConfirm={async ({
          realCheckoutTimeStr,
          note,
          allocations,
          exceeded12hAlert,
        }) => {
          if (activeCheckin) {
            await regularizeCheckout({
              checkinId: activeCheckin.id,
              realCheckoutTimeStr,
              note,
              allocations,
              exceeded12hAlert,
            });
            setIsRegularizationModalOpen(false);
          }
        }}
      />
    </div>
  );
}
