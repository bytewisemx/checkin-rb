import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  X,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ShieldCheck,
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [livePreviewVector, setLivePreviewVector] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Iniciar cámara y cargar modelos
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function init() {
      if (!isOpen) return;
      setIsLoadingModels(true);
      setCameraError(null);
      setFaceDetected(false);

      const modelsOk = await loadFaceApiModels();
      if (!modelsOk) {
        setCameraError('No se pudieron inicializar los modelos de IA facial.');
        setIsLoadingModels(false);
        return;
      }
      setIsLoadingModels(false);

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

        // Bucle de detección de rostro en vivo (extrayendo únicamente floats)
        intervalId = setInterval(async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
          try {
            const res = await detectSingleFaceDescriptor(videoRef.current);
            if (res) {
              setFaceDetected(true);
              setLivePreviewVector(
                Array.from(res.descriptor)
                  .slice(0, 4)
                  .map((n) => Number(n.toFixed(3)))
              );
            } else {
              setFaceDetected(false);
            }
          } catch {
            setFaceDetected(false);
          }
        }, 280);
      } catch (err) {
        console.error('Error al acceder a la cámara:', err);
        setCameraError(
          'No se pudo acceder a la cámara. Verifica los permisos de cámara en tu navegador.'
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
          'No se detectó un rostro visible. Centra tu rostro con iluminación moderada e inténtalo de nuevo.',
          'error'
        );
        setIsProcessing(false);
        return;
      }

      // PRIVACIDAD ESTRICTA: Extraemos únicamente el array de 128 floats (faceDescriptor).
      // Prohibido capturar o guardar imágenes base64 o URLs.
      const descriptorArray = Array.from(result.descriptor).map((v) =>
        Number(v.toFixed(6))
      );

      await enrollBiometrics(descriptorArray, endpointTarget, DEFAULT_BIOMETRIC_THRESHOLD);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

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
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[94vh]">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight text-white flex items-center space-x-1.5">
                <span>
                  {mode === 'recalibrate'
                    ? 'Actualizar / Recalibrar Vector Facial'
                    : 'Captura Inicial de Vector Biométrico'}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h3>
              <p className="text-[11px] text-slate-300">
                Modelo <code>face_recognition_v1</code> • Solo parámetros numéricos (0 imágenes)
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

        {/* Contenido Visual */}
        <div className="p-5 overflow-y-auto flex flex-col items-center space-y-4">
          {/* Contenedor de Video con Guía Facial */}
          <div className="relative w-full aspect-4/3 max-w-md bg-slate-900 rounded-2xl overflow-hidden shadow-inner border-2 border-slate-700 flex items-center justify-center">
            {cameraError ? (
              <div className="p-6 text-center text-rose-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto" />
                <p className="text-xs font-semibold">{cameraError}</p>
              </div>
            ) : isLoadingModels ? (
              <div className="flex flex-col items-center text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                <span className="text-xs font-semibold">
                  Inicializando extractor vectorial 128D...
                </span>
              </div>
            ) : (
              <>
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
                    className={`w-44 h-60 rounded-[50%] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center ${
                      faceDetected
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                        : 'border-white/70'
                    }`}
                  >
                    {faceDetected && (
                      <span className="text-[11px] font-black text-emerald-400 bg-slate-950/85 px-2.5 py-1 rounded-full border border-emerald-400/50">
                        Rostro Visible ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* Vista previa en vivo del vector matemático extraído */}
                {faceDetected && livePreviewVector.length > 0 && (
                  <div className="absolute bottom-2.5 inset-x-3 bg-slate-950/85 backdrop-blur-xs border border-emerald-500/30 rounded-lg px-2.5 py-1 text-[10px] font-mono text-emerald-300 flex items-center justify-between pointer-events-none">
                    <span>faceDescriptor[128]:</span>
                    <span>[{livePreviewVector.join(', ')}, ...]</span>
                  </div>
                )}

                {/* Retícula en las esquinas */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-blue-400 pointer-events-none" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-blue-400 pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-blue-400 pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-blue-400 pointer-events-none" />
              </>
            )}
          </div>

          {/* Aviso de Privacidad: Cero Imágenes */}
          <div className="w-full bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start space-x-2 text-[11px] text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <b>Privacidad sin imágenes:</b> No se guarda ninguna fotografía ni cadena base64. Solo se almacena el descriptor numérico <code>faceDescriptor</code> vía <code>PUT /api/users/{endpointTarget === 'me' ? 'me' : ':id'}/biometrics</code>.
            </span>
          </div>

          {/* Botones */}
          <div className="w-full pt-1 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={!faceDetected || isProcessing || Boolean(cameraError)}
              onClick={handleCaptureAndEnroll}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#0D5C75] hover:bg-[#0A485C] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Extrayendo Vector 128D...</span>
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
