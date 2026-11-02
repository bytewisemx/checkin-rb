import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CameraOff,
  AlertCircle,
} from 'lucide-react';
import {
  loadFaceApiModels,
  detectSingleFaceDescriptor,
  DEFAULT_BIOMETRIC_THRESHOLD,
} from '../../services/facialBiometrics';
import { useCheckinStore } from '../../store/useCheckinStore';

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

  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [livePreviewVector, setLivePreviewVector] = useState<number[]>([]);
  const [detectionQuality, setDetectionQuality] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Iniciar cámara física y modelos
  useEffect(() => {
    if (!isOpen) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    setIsLoadingModels(true);
    setCameraActive(false);
    setCameraError(null);
    setFaceDetected(false);
    setLivePreviewVector([]);
    setDetectionQuality(0);

    async function init() {
      const modelsOk = await loadFaceApiModels();
      setIsLoadingModels(false);
      if (!modelsOk) {
        setCameraError('No se pudieron inicializar los modelos de IA facial.');
        return;
      }

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
        }

        // Bucle de detección en vivo 100% REAL sobre los frames
        intervalId = setInterval(async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
          try {
            const res = await detectSingleFaceDescriptor(videoRef.current);
            if (res) {
              setFaceDetected(true);
              const quality = Math.min(100, Math.round(res.detection.score * 100));
              setDetectionQuality(quality);
              setLivePreviewVector(
                Array.from(res.descriptor)
                  .slice(0, 4)
                  .map((n) => Number(n.toFixed(3)))
              );
            } else {
              setFaceDetected(false);
              setDetectionQuality(0);
            }
          } catch {
            setFaceDetected(false);
            setDetectionQuality(0);
          }
        }, 200);
      } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        setCameraActive(false);
        setCameraError(
          'No se detectó cámara web activa o se denegaron los permisos. Conecta tu cámara para calibrar tu vector real.'
        );
      }
    }

    init();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const handleCaptureAndEnroll = async () => {
    if (!videoRef.current || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await detectSingleFaceDescriptor(videoRef.current);

      if (!result) {
        addToast(
          'No se detectó un rostro visible. Centra tu rostro frente a la cámara e inténtalo de nuevo.',
          'error'
        );
        setIsProcessing(false);
        return;
      }

      // PRIVACIDAD ESTRICTA: Extraemos únicamente los 128 floats reales (faceDescriptor).
      // Jamás se guardan fotos ni base64.
      const descriptorArray = Array.from(result.descriptor).map((v) =>
        Number(v.toFixed(6))
      );

      await enrollBiometrics(descriptorArray, endpointTarget, DEFAULT_BIOMETRIC_THRESHOLD);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      addToast('Vector facial calibrado con éxito.', 'success');
      onEnrollmentComplete(descriptorArray);
    } catch (err) {
      console.error('Error al enrolar vector facial:', err);
      addToast('Ocurrió un error al extraer el vector biométrico.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#131D31] text-[#F8FAFC] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#233354] flex flex-col max-h-[94vh]">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-[#0F172A] border-b border-[#233354] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#38BDF8] flex items-center justify-center border border-blue-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm text-white flex items-center space-x-1.5">
                <span>
                  {mode === 'recalibrate'
                    ? 'Actualizar / Calibrar Vector Facial'
                    : 'Calibración de Vector Biométrico'}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Modelo <code>face_recognition_v1</code> • Solo parámetros numéricos (0 imágenes)
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

        {/* Contenido Visual: Video en vivo con encuadre de rostro */}
        <div className="p-5 overflow-y-auto flex flex-col items-center space-y-4">
          <div className="relative w-full aspect-4/3 max-w-md bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#233354] flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center text-rose-400 space-y-3">
                <CameraOff className="w-10 h-10 mx-auto text-rose-400" />
                <p className="text-xs font-semibold">{cameraError}</p>
              </div>
            ) : isLoadingModels ? (
              <div className="flex flex-col items-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-[#38BDF8]" />
                <span className="text-xs font-semibold">Inicializando detector facial 128D...</span>
              </div>
            ) : (
              <>
                {/* Video de la cámara en vivo reflejado en espejo */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Óvalo Guía Facial */}
                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${
                    faceDetected ? 'opacity-95' : 'opacity-60'
                  }`}
                >
                  <div
                    className={`w-44 h-60 rounded-[50%] border-2 transition-all duration-300 flex flex-col items-center justify-center ${
                      faceDetected
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                        : 'border-white/70 border-dashed'
                    }`}
                  >
                    {faceDetected && (
                      <span className="text-[11px] font-black text-emerald-400 bg-slate-950/85 px-2.5 py-1 rounded-full border border-emerald-400/50">
                        Rostro Visible ({detectionQuality}%) ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* Vista previa en vivo del vector matemático extraído de 128 floats */}
                {faceDetected && livePreviewVector.length > 0 && (
                  <div className="absolute bottom-2.5 inset-x-3 bg-slate-950/85 backdrop-blur-xs border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[10px] font-mono text-emerald-300 flex items-center justify-between pointer-events-none">
                    <span>faceDescriptor[128]:</span>
                    <span>[{livePreviewVector.join(', ')}, ...]</span>
                  </div>
                )}

                {/* Retícula en las esquinas */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#38BDF8] pointer-events-none" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#38BDF8] pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#38BDF8] pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#38BDF8] pointer-events-none" />
              </>
            )}
          </div>

          {/* Aviso si la cámara no detecta cara */}
          {!cameraError && cameraActive && !faceDetected && (
            <div className="w-full flex items-center space-x-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Colócate de frente para que la cámara pueda capturar tu rostro real.</span>
            </div>
          )}

          {/* Aviso de Privacidad: Cero Imágenes */}
          <div className="w-full bg-[#0F172A] border border-[#233354] rounded-xl p-3 flex items-start space-x-2 text-[11px] text-[#94A3B8]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Privacidad sin imágenes:</strong> No se guarda ninguna foto ni base64. Solo se almacena el descriptor numérico <code>faceDescriptor</code> (128 floats reales) vía <code>PUT /api/users/{endpointTarget === 'me' ? 'me' : ':id'}/biometrics</code>.
            </span>
          </div>

          {/* Botones */}
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
              disabled={!faceDetected || isProcessing || Boolean(cameraError)}
              onClick={handleCaptureAndEnroll}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#1E40AF] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-heading font-semibold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando Vector 128D...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {mode === 'recalibrate'
                      ? 'Sobrescribir Vector Facial'
                      : 'Guardar Vector Facial'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
