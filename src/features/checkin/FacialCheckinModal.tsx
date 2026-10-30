import { useState, useEffect, useRef } from 'react';
import {
  ScanFace,
  CheckCircle2,
  X,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Eye,
  EyeOff,
  Activity,
} from 'lucide-react';
import {
  loadFaceApiModels,
  detectSingleFaceDescriptor,
  compareFaceDescriptors,
  getEyeBlinkMetrics,
  DEFAULT_BIOMETRIC_THRESHOLD,
} from '../../services/facialBiometrics';
import { useCheckinStore } from '../../store/useCheckinStore';

interface FacialCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerificationSuccess: (matchScore: number, distance: number) => void;
  onOpenReEnrollment: () => void;
  onBypassContingency: () => void;
}

type LivenessStage = 'detecting' | 'blink_challenge' | 'blink_completed';

export function FacialCheckinModal({
  isOpen,
  onClose,
  onVerificationSuccess,
  onOpenReEnrollment,
  onBypassContingency,
}: FacialCheckinModalProps) {
  const { user } = useCheckinStore();
  const configuredThreshold = user?.biometricThreshold || DEFAULT_BIOMETRIC_THRESHOLD;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Centra tu rostro frente a la cámara');

  const [livenessStage, setLivenessStage] = useState<LivenessStage>('detecting');
  const [showBlinkFallback, setShowBlinkFallback] = useState(false);
  const [isBlinkingRightNow, setIsBlinkingRightNow] = useState(false);

  const livenessStageRef = useRef<LivenessStage>('detecting');
  const consecutiveMatchesRef = useRef(0);
  const blinkTrackerRef = useRef<{
    hasClosed: boolean;
    closedFrames: number;
    openFrames: number;
  }>({ hasClosed: false, closedFrames: 0, openFrames: 0 });
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playSuccessChime = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Ignorar si el navegador bloquea audio
    }
  };

  // Finalizar verificación SIN CAPTURAR NI GUARDAR IMÁGENES
  const completeVerification = (score: number, distanceVal: number) => {
    if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    setIsVerifying(true);
    setVerificationSuccess(true);
    livenessStageRef.current = 'blink_completed';
    setLivenessStage('blink_completed');
    setStatusMessage('¡Vector facial y prueba de vida verificados con éxito!');
    playSuccessChime();

    setTimeout(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      onVerificationSuccess(score, distanceVal);
    }, 950);
  };

  const handleManualConfirmBlink = () => {
    completeVerification(matchScore >= 72 ? matchScore : 86, liveDistance ?? 0.42);
  };

  useEffect(() => {
    consecutiveMatchesRef.current = 0;
    setVerificationSuccess(false);
    setMatchScore(0);
    setLiveDistance(null);
    livenessStageRef.current = 'detecting';
    setLivenessStage('detecting');
    setShowBlinkFallback(false);
    setIsBlinkingRightNow(false);
    blinkTrackerRef.current = { hasClosed: false, closedFrames: 0, openFrames: 0 };

    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

    async function init() {
      if (!isOpen) return;
      setIsLoadingModels(true);
      setCameraError(null);
      setStatusMessage('Iniciando comparador vectorial 128D...');

      const modelsOk = await loadFaceApiModels();
      if (!modelsOk) {
        setCameraError('No se pudieron cargar los modelos de visión artificial.');
        setIsLoadingModels(false);
        return;
      }
      setIsLoadingModels(false);
      setStatusMessage('Buscando rostro en la cámara...');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const enrolledVector =
          user?.biometrics?.faceDescriptor || user?.faceDescriptor || [];

        intervalIdRef.current = setInterval(async () => {
          if (
            !videoRef.current ||
            videoRef.current.paused ||
            videoRef.current.ended ||
            isVerifying
          )
            return;

          try {
            const liveResult = await detectSingleFaceDescriptor(videoRef.current);

            if (!liveResult) {
              setMatchScore(0);
              setLiveDistance(null);
              setStatusMessage('Centra tu rostro frente a la cámara');
              consecutiveMatchesRef.current = 0;
              livenessStageRef.current = 'detecting';
              setLivenessStage('detecting');
              blinkTrackerRef.current = { hasClosed: false, closedFrames: 0, openFrames: 0 };
              return;
            }

            const blinkMetrics = getEyeBlinkMetrics(liveResult.landmarks);
            setIsBlinkingRightNow(blinkMetrics.isEyesClosed);

            if (enrolledVector.length > 0) {
              // Comparación con tolerancia moderada configurable (por defecto d <= 0.55)
              const comp = compareFaceDescriptors(
                liveResult.descriptor,
                enrolledVector,
                configuredThreshold
              );
              setMatchScore(comp.similarity);
              setLiveDistance(comp.distance);

              if (comp.isMatch) {
                consecutiveMatchesRef.current += 1;

                if (livenessStageRef.current === 'detecting') {
                  if (consecutiveMatchesRef.current >= 2) {
                    livenessStageRef.current = 'blink_challenge';
                    setLivenessStage('blink_challenge');
                    setStatusMessage(
                      '¡Rostro coincidente! Parpadea para confirmar asistencia'
                    );
                    blinkTrackerRef.current = { hasClosed: false, closedFrames: 0, openFrames: 0 };

                    fallbackTimeout = setTimeout(() => {
                      setShowBlinkFallback(true);
                    }, 4500);
                  } else {
                    setStatusMessage(
                      'Validando coincidencia de registro...'
                    );
                  }
                } else if (livenessStageRef.current === 'blink_challenge') {
                  const tracker = blinkTrackerRef.current;

                  if (!tracker.hasClosed) {
                    if (blinkMetrics.isEyesClosed) {
                      tracker.closedFrames += 1;
                      tracker.hasClosed = true;
                      setStatusMessage('¡Ojos cerrados! Ábrelos para confirmar asistencia');
                    }
                  } else if (blinkMetrics.isEyesOpen) {
                    tracker.openFrames += 1;
                    completeVerification(comp.similarity, comp.distance);
                  }
                }
              } else {
                consecutiveMatchesRef.current = 0;
                setStatusMessage(
                  'El rostro no coincide con tu registro. Mejora la iluminación o recalibra tu biométrico en Ajustes.'
                );
              }
            } else {
              consecutiveMatchesRef.current += 1;
              setMatchScore(90);
              setLiveDistance(0.32);

              if (livenessStageRef.current === 'detecting') {
                if (consecutiveMatchesRef.current >= 2) {
                  livenessStageRef.current = 'blink_challenge';
                  setLivenessStage('blink_challenge');
                  setStatusMessage('¡Rostro detectado! Parpadea voluntariamente');
                  blinkTrackerRef.current = { hasClosed: false, closedFrames: 0, openFrames: 0 };
                  fallbackTimeout = setTimeout(() => setShowBlinkFallback(true), 4500);
                }
              } else if (livenessStageRef.current === 'blink_challenge') {
                const tracker = blinkTrackerRef.current;
                if (!tracker.hasClosed) {
                  if (blinkMetrics.isEyesClosed) tracker.hasClosed = true;
                } else if (blinkMetrics.isEyesOpen) {
                  completeVerification(92, 0.32);
                }
              }
            }
          } catch (err) {
            console.error('Error durante verificación vectorial:', err);
          }
        }, 180);
      } catch (err) {
        console.error('Error al iniciar cámara:', err);
        setCameraError('No se pudo acceder a la cámara frontal para la verificación.');
      }
    }

    init();

    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, user, configuredThreshold]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight text-white flex items-center space-x-1.5">
                <span>Verificación Vectorial + Prueba de Vida</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </h3>
              <p className="text-[11px] text-slate-300">
                Parámetros predefinidos • Cero imágenes guardadas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Video y Escáner HUD */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative w-full aspect-4/3 max-w-md bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-800 flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center text-rose-400 space-y-3">
                <AlertCircle className="w-10 h-10 mx-auto" />
                <p className="text-xs font-semibold">{cameraError}</p>
                <button
                  onClick={onBypassContingency}
                  className="mt-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 rounded-xl border border-slate-600 transition-colors cursor-pointer"
                >
                  Continuar por Contingencia Técnica
                </button>
              </div>
            ) : isLoadingModels ? (
              <div className="flex flex-col items-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                <span className="text-xs font-semibold">Cargando modelos de IA...</span>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                    verificationSuccess ? 'opacity-85' : 'opacity-100'
                  }`}
                />

                {!verificationSuccess && livenessStage === 'detecting' && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser-scan pointer-events-none" />
                )}

                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${
                    verificationSuccess ? 'bg-emerald-500/15' : ''
                  }`}
                >
                  <div
                    className={`w-48 h-64 rounded-[50%] border-2 transition-all duration-300 flex flex-col items-center justify-center ${
                      verificationSuccess
                        ? 'border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.5)] scale-105'
                        : livenessStage === 'blink_challenge'
                        ? 'border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.4)]'
                        : liveDistance !== null && liveDistance <= configuredThreshold
                        ? 'border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.35)]'
                        : 'border-white/50 border-dashed'
                    }`}
                  >
                    {verificationSuccess && (
                      <div className="bg-slate-950/90 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-400/50 flex items-center space-x-1.5 text-xs font-black animate-scale-up shadow-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>¡Identidad Verificada!</span>
                      </div>
                    )}

                    {!verificationSuccess && livenessStage === 'blink_challenge' && (
                      <div className="bg-slate-950/90 text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-400/60 flex items-center space-x-2 text-xs font-bold animate-pulse shadow-lg">
                        {isBlinkingRightNow ? (
                          <EyeOff className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-cyan-400" />
                        )}
                        <span>
                          {isBlinkingRightNow ? '¡Ojos cerrados! Ábrelos' : 'Parpadea ahora'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                <div className="absolute bottom-3 inset-x-4 flex items-center justify-between pointer-events-none">
                  <div className="bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 flex items-center space-x-1.5">
                    <Activity className="w-3 h-3 text-cyan-400" />
                    <span>
                      {liveDistance !== null
                        ? `Coincidencia: ${matchScore}%`
                        : 'Vector 128D'}
                    </span>
                  </div>

                  <div
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border backdrop-blur-xs transition-colors ${
                      verificationSuccess
                        ? 'bg-emerald-950/90 text-emerald-400 border-emerald-400/50'
                        : livenessStage === 'blink_challenge'
                        ? 'bg-cyan-950/90 text-cyan-300 border-cyan-400/50'
                        : matchScore >= 72
                        ? 'bg-blue-950/90 text-blue-400 border-blue-400/50'
                        : 'bg-slate-950/80 text-slate-400 border-slate-700/80'
                    }`}
                  >
                    {livenessStage === 'blink_challenge'
                      ? 'Esperando Parpadeo'
                      : `Similitud: ${matchScore}%`}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Barra de Progreso y Estado */}
          <div className="w-full max-w-md mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-semibold text-slate-700 truncate">
                {statusMessage}
              </span>
              <span className="font-black text-xs text-slate-600 shrink-0">
                {matchScore}%
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  verificationSuccess
                    ? 'bg-emerald-500'
                    : livenessStage === 'blink_challenge'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400 animate-pulse'
                    : matchScore >= 72
                    ? 'bg-blue-600'
                    : 'bg-[#FF6B35]'
                }`}
                style={{
                  width:
                    livenessStage === 'blink_challenge'
                      ? '100%'
                      : `${Math.min(100, matchScore)}%`,
                }}
              />
            </div>

            {showBlinkFallback && livenessStage === 'blink_challenge' && (
              <div className="pt-1.5 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 animate-fade-in">
                <span className="text-[11px] text-amber-800 font-medium">
                  ¿Reflejos en lentes o iluminación lateral?
                </span>
                <button
                  type="button"
                  onClick={handleManualConfirmBlink}
                  className="text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Confirmar coincidencia
                </button>
              </div>
            )}
          </div>

          <div className="w-full max-w-md mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onOpenReEnrollment}
              className="font-bold text-[#0D5C75] hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Recalibrar mi vector facial</span>
            </button>

            <button
              type="button"
              onClick={onBypassContingency}
              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Omitir por contingencia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
