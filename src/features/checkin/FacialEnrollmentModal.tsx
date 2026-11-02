import { useState, useEffect, useRef } from 'react';
import {
  ScanFace,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import {
  loadFaceApiModels,
  detectSingleFaceDescriptor,
  DEFAULT_BIOMETRIC_THRESHOLD,
} from '../../services/facialBiometrics';
import { useCheckinStore } from '../../store/useCheckinStore';
import { Facial3DMeshVisualizer } from '../../components/biometrics/Facial3DMeshVisualizer';

interface FacialEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrollmentComplete: (descriptor?: number[]) => void;
  mode?: 'initial' | 'recalibrate';
  endpointTarget?: 'me' | string;
}

export function FacialEnrollmentModal({
  isOpen,
  onClose,
  onEnrollmentComplete,
  mode = 'initial',
  endpointTarget = 'me',
}: FacialEnrollmentModalProps) {
  const { enrollBiometrics, addToast } = useCheckinStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Iniciando cámara y extractor vectorial...');

  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveFramesRef = useRef(0);
  const autoAcceptTriggeredRef = useRef(false);

  // Auto-aceptar y guardar el vector REAL cuando la coincidencia/calidad del rostro real supera 70%
  const triggerAutoAcceptEnrollment = async (descriptorArray: number[], finalScore: number) => {
    if (autoAcceptTriggeredRef.current) return;
    autoAcceptTriggeredRef.current = true;

    if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    setIsProcessing(true);
    setIsEnrolled(true);
    setStatusMessage(`¡Rostro real calibrado (${finalScore}% ≥ 70%)! Guardando automáticamente...`);

    try {
      await enrollBiometrics(descriptorArray, endpointTarget, DEFAULT_BIOMETRIC_THRESHOLD);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setTimeout(() => {
        addToast('Vector biométrico real (128 floats) registrado con éxito.', 'success');
        onEnrollmentComplete(descriptorArray);
      }, 700);
    } catch (err) {
      console.error('Error al guardar vector real:', err);
      addToast('Ocurrió un error al persistir los parámetros biométricos.', 'error');
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    autoAcceptTriggeredRef.current = false;
    consecutiveFramesRef.current = 0;
    setIsEnrolled(false);
    setIsProcessing(false);
    setFaceDetected(false);
    setCameraActive(false);
    setCameraError(null);
    setMatchScore(0);
    setStatusMessage('Iniciando cámara web frontal...');

    async function init() {
      // 1. Cargar modelos de IA facial
      const modelsOk = await loadFaceApiModels();
      if (!modelsOk) {
        setCameraError('No se pudieron inicializar los modelos de IA facial.');
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
          setStatusMessage('Cámara activa. Enfoca tu rostro de frente para calibrar...');
        }
      } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        setCameraActive(false);
        setCameraError(
          'No se detectó cámara web activa o se denegaron los permisos. Conecta tu cámara para calibrar tu vector real.'
        );
        setStatusMessage('Cámara no disponible.');
        return;
      }

      // 3. Bucle de Detección 100% REAL sobre los fotogramas del sensor
      intervalIdRef.current = setInterval(async () => {
        if (autoAcceptTriggeredRef.current) return;
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        try {
          const res = await detectSingleFaceDescriptor(videoRef.current);

          // Si NO hay rostro frente al lente de la cámara
          if (!res) {
            setFaceDetected(false);
            setMatchScore(0);
            consecutiveFramesRef.current = 0;
            setStatusMessage('Buscando rostro en cámara... Por favor mírala de frente');
            return;
          }

          // Si HAY rostro real frente a la cámara
          setFaceDetected(true);
          const descriptorArray = Array.from(res.descriptor).map((v) =>
            Number(v.toFixed(6))
          );

          // Calidad real de detección del rostro (0 - 100)
          const qualityScore = Math.min(100, Math.round(res.detection.score * 100));
          setMatchScore(qualityScore);

          // REGLA: Si la calidad del rostro real supera el 70%, validar 2 frames consecutivos y auto-guardar
          if (qualityScore >= 70) {
            consecutiveFramesRef.current += 1;
            setStatusMessage(`Rostro real detectado (${qualityScore}%). Calibrando vector 128D...`);

            if (consecutiveFramesRef.current >= 2) {
              triggerAutoAcceptEnrollment(descriptorArray, qualityScore);
              return;
            }
          } else {
            consecutiveFramesRef.current = 0;
            setStatusMessage(`Rostro detectado con calidad parcial (${qualityScore}% < 70%). Mantén la mirada fija.`);
          }
        } catch (err) {
          console.error('Error al detectar rostro para enrolamiento:', err);
        }
      }, 200);
    }

    init();

    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, endpointTarget]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#131D31] text-[#F8FAFC] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#233354] flex flex-col max-h-[94vh]">
        {/* Elemento de video real que procesa los frames en background */}
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />

        {/* Cabecera Sobria */}
        <div className="px-6 py-4 bg-[#0F172A] border-b border-[#233354] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#38BDF8] flex items-center justify-center border border-blue-500/20">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm text-white flex items-center space-x-1.5">
                <span>
                  {mode === 'recalibrate'
                    ? 'Actualizar / Calibrar Vector Facial Real'
                    : 'Calibración de Vector Biométrico Real'}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Captura sobre cámara activa • Cero imágenes guardadas (0 fotos)
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

        {/* Contenido Visual: Red 3D con Datos Reales */}
        <div className="p-5 overflow-y-auto flex flex-col items-center space-y-4">
          <Facial3DMeshVisualizer
            matchScore={matchScore}
            isSuccess={isEnrolled}
            faceDetected={faceDetected}
            cameraActive={cameraActive}
            cameraError={cameraError}
            statusText={statusMessage}
          />

          {/* Barra de Progreso y Estatus Real */}
          <div className="w-full max-w-md space-y-2">
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
                    : 'Auto-aceptación al superar el 70% con rostro real'}
                </span>
              </span>

              {isEnrolled && (
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Calibración aceptada</span>
                </span>
              )}
            </div>

            {/* Aviso si no hay rostro */}
            {!cameraError && cameraActive && !faceDetected && (
              <div className="flex items-center space-x-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Rostro no detectado por la cámara. Por favor colócate de frente para calibrar.</span>
              </div>
            )}
          </div>

          {/* Aviso de Privacidad Estricta */}
          <div className="w-full bg-[#0F172A] border border-[#233354] rounded-xl p-3 flex items-start space-x-2 text-[11px] text-[#94A3B8]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Privacidad sin imágenes:</strong> No se guarda ninguna foto ni base64. El sistema solo extrae y almacena el descriptor matemático <code>faceDescriptor</code> (128 floats reales) vía <code>PUT /api/users/{endpointTarget === 'me' ? 'me' : ':id'}/biometrics</code>.
            </span>
          </div>

          {/* Botones de acción */}
          <div className="w-full pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isProcessing || !faceDetected || matchScore < 50}
              onClick={async () => {
                if (!videoRef.current || isProcessing) return;
                try {
                  const res = await detectSingleFaceDescriptor(videoRef.current);
                  if (res) {
                    const desc = Array.from(res.descriptor).map((v) => Number(v.toFixed(6)));
                    triggerAutoAcceptEnrollment(desc, Math.round(res.detection.score * 100));
                  } else {
                    addToast('No se detectó un rostro real frente a la cámara.', 'error');
                  }
                } catch {
                  addToast('Error al extraer el vector biométrico.', 'error');
                }
              }}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#1E40AF] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-heading font-semibold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Guardando Parámetros...'
                  : mode === 'recalibrate'
                  ? 'Guardar Calibración Real'
                  : 'Guardar Vector Real'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
