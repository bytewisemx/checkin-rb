import { useState, useEffect, useRef } from 'react';
import {
  ScanFace,
  X,
  ShieldCheck,
  UserCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CameraOff,
} from 'lucide-react';
import {
  loadFaceApiModels,
  detectSingleFaceDescriptor,
  compareFaceDescriptors,
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
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Iniciando cámara y modelos de visión...');

  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveMatchesRef = useRef(0);
  const autoAcceptTriggeredRef = useRef(false);

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

  // Finalizar verificación REAL sin clics cuando coincidencia real >= 70%
  const completeVerification = (score: number, distanceVal: number) => {
    if (autoAcceptTriggeredRef.current) return;
    autoAcceptTriggeredRef.current = true;

    if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    setIsVerifying(true);
    setVerificationSuccess(true);
    setStatusMessage(`¡Rostro verificado (${score}% ≥ 70%)! Ingresando a jornada...`);
    playSuccessChime();

    setTimeout(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      onVerificationSuccess(score, distanceVal);
    }, 750);
  };

  useEffect(() => {
    if (!isOpen) return;

    autoAcceptTriggeredRef.current = false;
    consecutiveMatchesRef.current = 0;
    setVerificationSuccess(false);
    setIsVerifying(false);
    setFaceDetected(false);
    setCameraActive(false);
    setCameraError(null);
    setMatchScore(0);
    setLiveDistance(null);
    setIsLoadingModels(true);
    setStatusMessage('Cargando modelos de visión artificial y cámara...');

    async function init() {
      // 1. Cargar modelos de face-api
      const modelsOk = await loadFaceApiModels();
      setIsLoadingModels(false);
      if (!modelsOk) {
        setCameraError('No se pudieron inicializar los modelos de IA facial en el navegador.');
        return;
      }

      // 2. Solicitar cámara física real
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
          setCameraActive(true);
          setStatusMessage('Cámara activa. Mírate de frente en el visor...');
        }
      } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        setCameraActive(false);
        setCameraError(
          'No se detectó cámara web activa o se denegaron los permisos. Conecta tu cámara para realizar la verificación.'
        );
        setStatusMessage('Cámara no disponible.');
        return;
      }

      const enrolledVector =
        user?.biometrics?.faceDescriptor || user?.faceDescriptor || [];

      if (!enrolledVector || enrolledVector.length === 0) {
        setStatusMessage('Aún no cuentas con un vector facial calibrado. Recalibra primero tu rostro.');
      }

      // 3. Bucle de Detección y Comparación 100% REAL sobre los frames del video
      intervalIdRef.current = setInterval(async () => {
        if (autoAcceptTriggeredRef.current) return;
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        try {
          const liveResult = await detectSingleFaceDescriptor(videoRef.current);

          // Si NO hay rostro frente al lente de la cámara
          if (!liveResult) {
            setFaceDetected(false);
            setMatchScore(0);
            setLiveDistance(null);
            consecutiveMatchesRef.current = 0;
            setStatusMessage('Centra tu rostro dentro del marco guía...');
            return;
          }

          // Si HAY rostro real frente al lente de la cámara
          setFaceDetected(true);

          if (enrolledVector.length > 0) {
            // Comparar vector real de 128 floats con el registrado
            const comp = compareFaceDescriptors(
              liveResult.descriptor,
              enrolledVector,
              configuredThreshold
            );

            setMatchScore(comp.similarity);
            setLiveDistance(comp.distance);

            // REGLA: En cuanto la coincidencia real supere el 70% (>= 70), dar aceptar automáticamente sin dar clic
            if (comp.similarity >= 70 && comp.isMatch) {
              consecutiveMatchesRef.current += 1;
              setStatusMessage(`Coincidencia confirmada: ${comp.similarity}%. Validando...`);

              // Validar 2 lecturas consecutivas para evitar falsos parpadeos
              if (consecutiveMatchesRef.current >= 2) {
                completeVerification(comp.similarity, comp.distance);
                return;
              }
            } else {
              consecutiveMatchesRef.current = 0;
              setStatusMessage(
                `Rostro detectado. Coincidencia actual: ${comp.similarity}% (requiere ≥ 70%). Mírate de frente.`
              );
            }
          } else {
            setMatchScore(0);
            setStatusMessage('Rostro detectado, pero tu usuario no tiene vector previo. Recalibra abajo.');
          }
        } catch (err) {
          console.error('Error al evaluar descriptor en vivo:', err);
        }
      }, 180);
    }

    init();

    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, user, configuredThreshold]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#131D31] text-[#F8FAFC] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#233354] flex flex-col">
        {/* Cabecera Sobria */}
        <div className="px-6 py-4 bg-[#0F172A] border-b border-[#233354] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#38BDF8] flex items-center justify-center border border-blue-500/20">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm text-white flex items-center space-x-1.5">
                <span>Verificación Facial • Acceso a Jornada</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Detección en tiempo real • 0 fotografías guardadas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1A2742] rounded-lg transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Video en Vivo con Cara Real y HUD */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative w-full aspect-4/3 max-w-md bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#233354] flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center text-rose-400 space-y-3">
                <CameraOff className="w-10 h-10 mx-auto text-rose-400" />
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
                <RefreshCw className="w-8 h-8 animate-spin text-[#38BDF8]" />
                <span className="text-xs font-semibold">Cargando modelos de visión artificial...</span>
              </div>
            ) : (
              <>
                {/* Video en vivo con espejo para verse natural */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                    verificationSuccess ? 'opacity-90' : 'opacity-100'
                  }`}
                />

                {/* Línea de escaneo láser */}
                {!verificationSuccess && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent shadow-[0_0_15px_#38bdf8] animate-laser-scan pointer-events-none" />
                )}

                {/* Marco de Encuadre Ovalado */}
                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${
                    verificationSuccess ? 'bg-emerald-500/20' : ''
                  }`}
                >
                  <div
                    className={`w-48 h-64 rounded-[50%] border-2 transition-all duration-300 flex flex-col items-center justify-center ${
                      verificationSuccess
                        ? 'border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.5)] scale-105'
                        : faceDetected && matchScore >= 70
                        ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                        : faceDetected
                        ? 'border-[#38BDF8] shadow-[0_0_20px_rgba(56,189,248,0.35)]'
                        : 'border-white/50 border-dashed'
                    }`}
                  >
                    {verificationSuccess && (
                      <div className="bg-slate-950/90 text-emerald-400 px-3.5 py-1.5 rounded-full border border-emerald-400/50 flex items-center space-x-1.5 text-xs font-black animate-scale-up shadow-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>¡Identidad Verificada ({matchScore}%)!</span>
                      </div>
                    )}

                    {!verificationSuccess && faceDetected && (
                      <span className="text-[11px] font-bold text-[#38BDF8] bg-slate-950/85 px-2.5 py-1 rounded-full border border-sky-500/40">
                        Rostro en Cuadro ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* Retícula en las esquinas */}
                <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#38BDF8] pointer-events-none" />
                <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#38BDF8] pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#38BDF8] pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#38BDF8] pointer-events-none" />

                {/* Telemetría en el pie del video */}
                <div className="absolute bottom-3 inset-x-4 flex items-center justify-between pointer-events-none">
                  <div className="bg-slate-950/85 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-700/80 text-[10px] text-slate-300 flex items-center space-x-1.5">
                    <Activity className="w-3 h-3 text-[#38BDF8]" />
                    <span>
                      {faceDetected
                        ? `Coincidencia: ${matchScore}%`
                        : 'Buscando rostro...'}
                    </span>
                  </div>

                  <div
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border backdrop-blur-xs transition-colors ${
                      verificationSuccess || matchScore >= 70
                        ? 'bg-emerald-950/90 text-emerald-400 border-emerald-400/50'
                        : faceDetected
                        ? 'bg-sky-950/90 text-[#38BDF8] border-sky-400/50'
                        : 'bg-slate-950/80 text-slate-400 border-slate-700/80'
                    }`}
                  >
                    {faceDetected ? `Similitud: ${matchScore}%` : 'Sin Rostro'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Barra de Progreso y Estado */}
          <div className="w-full max-w-md mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-medium text-slate-300 truncate">
                {statusMessage}
              </span>
              <span
                className={`font-mono font-bold text-xs shrink-0 ${
                  matchScore >= 70 && faceDetected
                    ? 'text-emerald-400 font-extrabold'
                    : 'text-[#38BDF8]'
                }`}
              >
                {faceDetected ? `${matchScore}% / 70%` : '0%'}
              </span>
            </div>

            <div className="w-full bg-[#0F172A] h-2 rounded-full overflow-hidden border border-[#233354]">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  matchScore >= 70 && faceDetected
                    ? 'bg-emerald-500 shadow-[0_0_12px_#10B981]'
                    : faceDetected
                    ? 'bg-gradient-to-r from-blue-600 to-[#38BDF8]'
                    : 'bg-slate-700'
                }`}
                style={{
                  width: `${faceDetected ? Math.min(100, Math.max(matchScore, 5)) : 0}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-1">
              <span className="flex items-center space-x-1">
                <Activity className="w-3 h-3 text-[#38BDF8]" />
                <span>
                  {cameraError
                    ? 'Cámara obligatoria'
                    : isVerifying
                    ? 'Confirmando acceso...'
                    : `Auto-aceptación activa al superar 70% real${
                        liveDistance != null ? ` (d=${liveDistance})` : ''
                      }`}
                </span>
              </span>

              {verificationSuccess && (
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aceptado automáticamente</span>
                </span>
              )}
            </div>

            {/* Aviso si la cámara está activa pero no detecta la cara */}
            {!cameraError && cameraActive && !faceDetected && (
              <div className="flex items-center space-x-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Colócate de frente para que la cámara pueda enfocar tu rostro.</span>
              </div>
            )}
          </div>

          {/* Pie de modal */}
          <div className="w-full max-w-md mt-4 pt-3 border-t border-[#233354] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onOpenReEnrollment}
              className="text-[#38BDF8] hover:underline flex items-center space-x-1 cursor-pointer font-medium"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Calibrar vector facial</span>
            </button>

            <button
              type="button"
              onClick={onBypassContingency}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Omitir por contingencia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
