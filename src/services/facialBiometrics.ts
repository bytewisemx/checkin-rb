import * as faceapi from '@vladmandic/face-api';
import type { BiometricVectorRecord } from './rbac';

let modelsLoaded = false;
let modelsLoadingPromise: Promise<boolean> | null = null;

/**
 * Umbral de tolerancia moderada por defecto (distancia euclidiana <= 0.55)
 * Evita falsos negativos por variaciones naturales de iluminación, gafas o ligero ángulo.
 */
export const DEFAULT_BIOMETRIC_THRESHOLD = 0.55;

export const BIOMETRIC_TOLERANCE_PRESETS = [
  {
    label: 'Estricta (≤ 0.48)',
    value: 0.48,
    description: 'Alta exigencia lumínica y posición frontal exacta.',
  },
  {
    label: 'Moderada Recomendada (≤ 0.55)',
    value: 0.55,
    description: 'Balance ideal entre seguridad y tolerancia a cambios de luz o ángulo.',
  },
  {
    label: 'Flexible / Baja Luz (≤ 0.60)',
    value: 0.60,
    description: 'Mayor tolerancia para cámaras con poca iluminación o uso de lentes.',
  },
] as const;

/**
 * Carga los modelos de redes neuronales pre-entrenados alojados localmente en /public/models
 */
export async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const modelsPath = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}models`;

      // Cargar detector ligero (Tiny), landmarks de 68 puntos y red de embeddings
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelsPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelsPath),
      ]);

      modelsLoaded = true;
      return true;
    } catch (err) {
      console.error('Error al cargar modelos de face-api:', err);
      modelsLoadingPromise = null;
      return false;
    }
  })();

  return modelsLoadingPromise;
}

export interface DetectionResult {
  descriptor: Float32Array;
  detection: faceapi.FaceDetection;
  landmarks: faceapi.FaceLandmarks68;
}

/**
 * Detecta un rostro único y extrae su descriptor biométrico de 128 dimensiones (floats)
 */
export async function detectSingleFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<DetectionResult | null> {
  await loadFaceApiModels();

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.42, // Tolerancia flexible de detección frente a variaciones de luz
  });

  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!result) return null;

  return {
    descriptor: result.descriptor,
    detection: result.detection,
    landmarks: result.landmarks,
  };
}

/**
 * Construye el registro vectorial limpio SIN IMÁGENES:
 * {
 *   "faceDescriptor": [-0.041, 0.129, -0.098, ...],
 *   "lastUpdated": "2026-10-29T11:03:00Z",
 *   "model": "face_recognition_v1"
 * }
 */
export function buildBiometricVectorRecord(
  descriptor: Float32Array | number[]
): BiometricVectorRecord {
  const arr = Array.from(descriptor).map((v) => Number(Number(v).toFixed(6)));
  return {
    faceDescriptor: arr,
    lastUpdated: new Date().toISOString(),
    model: 'face_recognition_v1',
  };
}

/**
 * Calcula la similitud de coseno entre dos vectores de 128 floats (rango -1 a 1)
 */
export function calculateCosineSimilarity(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[]
): number {
  const len = Math.min(vecA.length, vecB.length);
  if (len === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface BiometricMatchResult {
  isMatch: boolean;
  distance: number;
  cosineSimilarity: number;
  thresholdUsed: number;
  similarity: number; // Porcentaje amigable de 0 a 100
}

/**
 * Compara dos descriptores biométricos con tolerancia configurable (threshold por defecto <= 0.55)
 * o similitud de coseno equivalente para evitar bloqueos por falsos negativos ante luz o ángulo.
 */
export function compareFaceDescriptors(
  liveDescriptor: Float32Array | number[],
  enrolledDescriptor: Float32Array | number[],
  threshold: number = DEFAULT_BIOMETRIC_THRESHOLD
): BiometricMatchResult {
  const safeThreshold = Math.min(0.65, Math.max(0.42, threshold || DEFAULT_BIOMETRIC_THRESHOLD));

  const live =
    liveDescriptor instanceof Float32Array
      ? liveDescriptor
      : new Float32Array(liveDescriptor);
  const enrolled =
    enrolledDescriptor instanceof Float32Array
      ? enrolledDescriptor
      : new Float32Array(enrolledDescriptor);

  const distance = faceapi.euclideanDistance(live, enrolled);
  const cosineSimilarity = calculateCosineSimilarity(live, enrolled);

  // Equivalencia aproximada de similitud de coseno para vectores L2-normalizados: cos = 1 - d^2 / 2
  const equivalentCosineMin = 1 - (safeThreshold * safeThreshold) / 2;

  // Escala visual amigable: si distance <= safeThreshold, similarity >= 78%
  const maxVisualReference = Math.max(0.72, safeThreshold + 0.17);
  const similarity = Math.max(
    0,
    Math.min(
      100,
      Math.round(((maxVisualReference - distance) / maxVisualReference) * 100)
    )
  );

  const isMatch = distance <= safeThreshold || cosineSimilarity >= equivalentCosineMin;

  return {
    isMatch,
    distance: Number(distance.toFixed(4)),
    cosineSimilarity: Number(cosineSimilarity.toFixed(4)),
    thresholdUsed: safeThreshold,
    similarity,
  };
}

export interface EyeMetrics {
  leftEAR: number;
  rightEAR: number;
  averageEAR: number;
  isEyesClosed: boolean;
  isEyesOpen: boolean;
}

/**
 * Calcula la relación de aspecto del ojo (Eye Aspect Ratio - EAR)
 */
export function calculateEyeAspectRatio(eye: Array<{ x: number; y: number }>): number {
  if (!eye || eye.length < 6) return 0.28;

  const dV1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const dV2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const dH = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);

  if (dH === 0) return 0.28;

  return (dV1 + dV2) / (2.0 * dH);
}

/**
 * Extrae las métricas de parpadeo y apertura ocular a partir de los 68 landmarks faciales
 */
export function getEyeBlinkMetrics(landmarks: faceapi.FaceLandmarks68): EyeMetrics {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  const leftEAR = calculateEyeAspectRatio(leftEye);
  const rightEAR = calculateEyeAspectRatio(rightEye);
  const averageEAR = (leftEAR + rightEAR) / 2;

  const isEyesClosed = averageEAR <= 0.205;
  const isEyesOpen = averageEAR >= 0.235;

  return {
    leftEAR: Number(leftEAR.toFixed(3)),
    rightEAR: Number(rightEAR.toFixed(3)),
    averageEAR: Number(averageEAR.toFixed(3)),
    isEyesClosed,
    isEyesOpen,
  };
}
