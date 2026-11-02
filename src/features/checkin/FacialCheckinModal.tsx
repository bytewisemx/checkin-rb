import { useState, useEffect, useRef } from 'react';
import {
  ScanFace,
  X,
  ShieldCheck,
  UserCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  loadFaceApiModels,
  detectSingleFaceDescriptor,
  compareFaceDescriptors,
  DEFAULT_BIOMETRIC_THRESHOLD,
} from '../../services/facialBiometrics';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Facial3DMeshVisualizer } from '../../components/biometrics/Facial3DMeshVisualizer';

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
    setStatusMessage(`¡Rostro real verificado con éxito (${score}% ≥ 70%)! Ingresando...`);
    playSuccessChime();

    setTimeout(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      onVerificationSuccess(score, distanceVal);
    }, 700);
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
    setStatusMessage('Iniciando cámara frontal y detector biométrico real...');

    async function init() {
      // 1. Cargar modelos de redes neuronales reales
      const modelsOk = await loadFaceApiModels();
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
          setStatusMessage('Cámara activa. Colócate frente al lente para verificar tu rostro...');
        }
      } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        setCameraActive(false);
        setCameraError(
          'No se detectó cámara web activa o se denegaron los permisos. Conecta tu cámara para realizar la verificación real.'
        );
        setStatusMessage('Cámara no disponible.');
        return;
      }

      const enrolledVector =
        user?.biometrics?.faceDescriptor || user?.faceDescriptor || [];

      if (!enrolledVector || enrolledVector.length === 0) {
        setStatusMessage('Aún no cuentas con un vector facial calibrado. Recalibra primero tu rostro.');
      }

      // 3. Bucle de Detección 100% REAL sobre los frames de la cámara
      intervalIdRef.current = setInterval(async () => {
        if (autoAcceptTriggeredRef.current) return;
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        try {
          const liveResult = await detectSingleFaceDescriptor(videoRef.current);

          // Si NO hay rostro frente a la cámara física
          if (!liveResult) {
            setFaceDetected(false);
            setMatchScore(0);
            setLiveDistance(null);
            consecutiveMatchesRef.current = 0;
            setStatusMessage('Buscando rostro en cámara... Por favor mírala de frente');
            return;
          }

          // Si HAY rostro real frente a la cámara física
          setFaceDetected(true);

          if (enrolledVector.length > 0) {
            // Comparar matemáticamente el vector real de 128 floats con el registrado
            const comp = compareFaceDescriptors(
              liveResult.descriptor,
              enrolledVector,
              configuredThreshold
            );

            setMatchScore(comp.similarity);
            setLiveDistance(comp.distance);

            // REGLA ESTRICTA: El rostro real debe coincidir con el vector registrado y ser >= 70%
            if (comp.similarity >= 70 && comp.isMatch) {
              consecutiveMatchesRef.current += 1;
              setStatusMessage(`Coincidencia real confirmada: ${comp.similarity}%. Validando...`);

              // Exigir al menos 2 frames consecutivos coincidentes para máxima precisión
              if (consecutiveMatchesRef.current >= 2) {
                completeVerification(comp.similarity, comp.distance);
                return;
              }
            } else {
              consecutiveMatchesRef.current = 0;
              setStatusMessage(
                `Rostro detectado pero no coincide lo suficiente (${comp.similarity}% < 70%). Mejora la luz o mira de frente.`
              );
            }
          } else {
            setMatchScore(0);
            setStatusMessage('Rostro detectado, pero falta calibrar tu registro facial en tu cuenta.');
          }
        } catch (err) {
          console.error('Error al evaluar descriptor en vivo:', err);
        }
      }, 200);
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
        {/* Elemento de video real que procesa los frames de la cámara en background */}
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />

        {/* Cabecera Sobria */}
        <div className="px-6 py-4 bg-[#0F172A] border-b border-[#233354] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#38BDF8] flex items-center justify-center border border-blue-500/20">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm text-white flex items-center space-x-1.5">
                <span>Verificación Facial 100% Real • Red 3D</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Procesamiento biométrico sobre cámara activa • Cero imágenes guardadas
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

        {/* Visor Central: Malla 3D de Parámetros Reales */}
        <div className="p-6 flex flex-col items-center">
          <Facial3DMeshVisualizer
            matchScore={matchScore}
            isSuccess={verificationSuccess}
            faceDetected={faceDetected}
            cameraActive={cameraActive}
            cameraError={cameraError}
            statusText={statusMessage}
          />

          {/* Barra de Progreso y Telemetría de Coincidencia Real */}
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
                    ? 'Cámara requerida sin excepción'
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

            {/* Aviso si no hay rostro */}
            {!cameraError && cameraActive && !faceDetected && (
              <div className="flex items-center space-x-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Rostro no detectado por la cámara. Por favor enfócate de frente para verificar.</span>
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
