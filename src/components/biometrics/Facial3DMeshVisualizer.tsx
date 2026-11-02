import { useEffect, useRef } from 'react';

interface Facial3DMeshVisualizerProps {
  matchScore: number;
  isSuccess?: boolean;
  statusText?: string;
  className?: string;
}

// Estructura de vértices 3D normalizados (x: -1 a 1, y: -1 a 1, z: profundidad)
interface Vertex3D {
  x: number;
  y: number;
  z: number;
}

// Modelo base simplificado de topología facial tridimensional
const FACE_3D_VERTICES: Vertex3D[] = [
  // Contorno frente (0-4)
  { x: -0.65, y: -0.75, z: -0.2 },
  { x: -0.35, y: -0.88, z: -0.05 },
  { x: 0.0, y: -0.92, z: 0.05 },
  { x: 0.35, y: -0.88, z: -0.05 },
  { x: 0.65, y: -0.75, z: -0.2 },

  // Ceja izquierda (5-7)
  { x: -0.45, y: -0.55, z: 0.05 },
  { x: -0.28, y: -0.6, z: 0.12 },
  { x: -0.1, y: -0.53, z: 0.15 },

  // Ceja derecha (8-10)
  { x: 0.1, y: -0.53, z: 0.15 },
  { x: 0.28, y: -0.6, z: 0.12 },
  { x: 0.45, y: -0.55, z: 0.05 },

  // Ojo izquierdo (11-14)
  { x: -0.42, y: -0.38, z: 0.02 },
  { x: -0.28, y: -0.44, z: 0.04 },
  { x: -0.14, y: -0.38, z: 0.03 },
  { x: -0.28, y: -0.32, z: 0.02 },

  // Ojo derecho (15-18)
  { x: 0.14, y: -0.38, z: 0.03 },
  { x: 0.28, y: -0.44, z: 0.04 },
  { x: 0.42, y: -0.38, z: 0.02 },
  { x: 0.28, y: -0.32, z: 0.02 },

  // Nariz - Puente y punta (19-23)
  { x: 0.0, y: -0.48, z: 0.2 },
  { x: 0.0, y: -0.25, z: 0.35 },
  { x: 0.0, y: -0.05, z: 0.45 }, // Punta nariz (más saliente)
  { x: -0.14, y: 0.02, z: 0.28 }, // Fosa izq
  { x: 0.14, y: 0.02, z: 0.28 }, // Fosa der

  // Pómulos (24-25)
  { x: -0.58, y: -0.15, z: 0.05 },
  { x: 0.58, y: -0.15, z: 0.05 },

  // Boca exterior (26-31)
  { x: -0.28, y: 0.28, z: 0.15 },
  { x: -0.12, y: 0.22, z: 0.25 },
  { x: 0.0, y: 0.24, z: 0.28 }, // Centro labio sup
  { x: 0.12, y: 0.22, z: 0.25 },
  { x: 0.28, y: 0.28, z: 0.15 },
  { x: 0.0, y: 0.42, z: 0.22 }, // Centro labio inf

  // Mandíbula y barbilla (32-38)
  { x: -0.72, y: -0.3, z: -0.2 },
  { x: -0.68, y: 0.15, z: -0.15 },
  { x: -0.48, y: 0.55, z: -0.05 },
  { x: -0.22, y: 0.78, z: 0.1 },
  { x: 0.0, y: 0.88, z: 0.2 }, // Barbilla
  { x: 0.22, y: 0.78, z: 0.1 },
  { x: 0.48, y: 0.55, z: -0.05 },
  { x: 0.68, y: 0.15, z: -0.15 },
  { x: 0.72, y: -0.3, z: -0.2 },
];

// Aristas de la red poligonal 3D
const FACE_3D_EDGES: [number, number][] = [
  // Frente
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [4, 10], [2, 19],

  // Cejas
  [5, 6], [6, 7], [7, 19],
  [8, 9], [9, 10], [8, 19],

  // Ojo Izq
  [11, 12], [12, 13], [13, 14], [14, 11],
  [6, 12], [5, 11], [7, 13],

  // Ojo Der
  [15, 16], [16, 17], [17, 18], [18, 15],
  [9, 16], [10, 17], [8, 15],

  // Nariz
  [19, 20], [20, 21], [21, 22], [21, 23], [22, 23],
  [13, 20], [15, 20],

  // Pómulos y mejillas
  [11, 24], [24, 33], [24, 26], [22, 26],
  [17, 25], [25, 38], [25, 30], [23, 30],

  // Boca
  [26, 27], [27, 28], [28, 29], [29, 30],
  [26, 31], [30, 31], [28, 31],
  [21, 28],

  // Mandíbula contorno
  [0, 32], [32, 33], [33, 34], [34, 35], [35, 36],
  [36, 37], [37, 38], [38, 39], [39, 4],
  [31, 36], [35, 31], [37, 31],

  // Triangulación cruzada para aspecto de red neuronal / malla poligonal
  [1, 6], [3, 9], [14, 22], [18, 23], [27, 35], [29, 37],
];

export function Facial3DMeshVisualizer({
  matchScore,
  isSuccess = false,
  statusText = 'Ajustando parámetros vectoriales...',
  className = '',
}: Facial3DMeshVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.025;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Fondo cibernético oscuro con cuadrícula de perspectiva sutil
      const bgGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        width * 0.7
      );
      if (isSuccess || matchScore >= 70) {
        bgGrad.addColorStop(0, '#042f2e');
        bgGrad.addColorStop(0.5, '#021817');
        bgGrad.addColorStop(1, '#020b0b');
      } else {
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.6, '#090d16');
        bgGrad.addColorStop(1, '#05070a');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Dibujar cuadrícula de calibración en el fondo
      ctx.strokeStyle = isSuccess || matchScore >= 70 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Parámetros de rotación 3D suaves (efecto escaneo que orbita el rostro)
      const rotY = Math.sin(time * 0.9) * 0.28; // Rotación sobre eje Y (giro izq/der)
      const rotX = Math.cos(time * 0.7) * 0.12 - 0.05; // Cabeceo arriba/abajo
      const scale = Math.min(width, height) * 0.42;
      const cx = width / 2;
      const cy = height / 2 + 10;
      const fovDistance = 2.2;

      // Proyección 3D de los vértices
      const projected = FACE_3D_VERTICES.map((v) => {
        // Rotación Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = v.x * cosY + v.z * sinY;
        const z1 = -v.x * sinY + v.z * cosY;

        // Rotación X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = v.y * cosX - z1 * sinX;
        const z2 = v.y * sinX + z1 * cosX;

        // Proyección en perspectiva
        const perspective = fovDistance / (fovDistance + z2);
        const px = cx + x1 * scale * perspective;
        const py = cy + y2 * scale * perspective;

        return { px, py, z: z2, perspective };
      });

      const effectiveSuccess = isSuccess || matchScore >= 70;
      const primaryColor = effectiveSuccess ? '#10B981' : '#38BDF8';
      const secondaryColor = effectiveSuccess ? '#34D399' : '#0284C7';
      const edgeColor = effectiveSuccess
        ? 'rgba(16, 185, 129, 0.45)'
        : 'rgba(56, 189, 248, 0.35)';

      // 1. Dibujar Aristas de la Red 3D
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = edgeColor;
      FACE_3D_EDGES.forEach(([i, j]) => {
        const p1 = projected[i];
        const p2 = projected[j];
        if (!p1 || !p2) return;

        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      });

      // 2. Dibujar Vértices y Nodos de la Red 3D
      projected.forEach((p, idx) => {
        const radius = Math.max(1.5, 3.2 * p.perspective);

        // Halo suave en nodos principales (nariz, ojos, barbilla)
        if (idx === 21 || idx === 12 || idx === 16 || idx === 36) {
          ctx.beginPath();
          ctx.arc(p.px, p.py, radius * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = effectiveSuccess
            ? 'rgba(16, 185, 129, 0.25)'
            : 'rgba(56, 189, 248, 0.2)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
        ctx.fillStyle = primaryColor;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = effectiveSuccess ? 12 : 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 3. Línea de Escáner Láser que barre la Red 3D verticalmente
      const scanY = cy + Math.sin(time * 2.2) * (scale * 0.95);
      const laserGrad = ctx.createLinearGradient(0, scanY, width, scanY);
      laserGrad.addColorStop(0, 'rgba(0,0,0,0)');
      laserGrad.addColorStop(0.3, effectiveSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)');
      laserGrad.addColorStop(0.5, effectiveSuccess ? '#34D399' : '#38BDF8');
      laserGrad.addColorStop(0.7, effectiveSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)');
      laserGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = laserGrad;
      ctx.fillRect(cx - scale * 0.9, scanY - 1.5, scale * 1.8, 3);

      // Resplandor del láser
      ctx.fillStyle = effectiveSuccess ? 'rgba(16, 185, 129, 0.08)' : 'rgba(56, 189, 248, 0.06)';
      ctx.fillRect(cx - scale * 0.9, scanY - 14, scale * 1.8, 28);

      // 4. Retícula en las cuatro esquinas (estilo visor HUD biométrico)
      const bracketSize = 18;
      const margin = 20;
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2;

      // Sup-Izq
      ctx.beginPath();
      ctx.moveTo(margin, margin + bracketSize);
      ctx.lineTo(margin, margin);
      ctx.lineTo(margin + bracketSize, margin);
      ctx.stroke();

      // Sup-Der
      ctx.beginPath();
      ctx.moveTo(width - margin - bracketSize, margin);
      ctx.lineTo(width - margin, margin);
      ctx.lineTo(width - margin, margin + bracketSize);
      ctx.stroke();

      // Inf-Izq
      ctx.beginPath();
      ctx.moveTo(margin, height - margin - bracketSize);
      ctx.lineTo(margin, height - margin);
      ctx.lineTo(margin + bracketSize, height - margin);
      ctx.stroke();

      // Inf-Der
      ctx.beginPath();
      ctx.moveTo(width - margin - bracketSize, height - margin);
      ctx.lineTo(width - margin, height - margin);
      ctx.lineTo(width - margin, height - margin - bracketSize);
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [matchScore, isSuccess]);

  const effectiveSuccess = isSuccess || matchScore >= 70;

  return (
    <div className={`relative w-full aspect-4/3 max-w-md bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-2 ${
      effectiveSuccess ? 'border-emerald-500/80 shadow-emerald-500/20' : 'border-slate-800'
    } flex items-center justify-center select-none ${className}`}>
      {/* Canvas con la simulación 3D de red neuronal de parámetros */}
      <canvas
        ref={canvasRef}
        width={480}
        height={360}
        className="w-full h-full object-cover"
      />

      {/* Capa de Telemetría Superior */}
      <div className="absolute top-3 inset-x-5 flex items-center justify-between pointer-events-none text-[10px] font-mono">
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs border border-slate-700/80 text-slate-300">
          <span className={`w-1.5 h-1.5 rounded-full ${effectiveSuccess ? 'bg-emerald-400 animate-ping' : 'bg-sky-400 animate-pulse'}`} />
          <span className="truncate max-w-[140px]">{statusText || 'RED 3D • 128 FLOATS'}</span>
        </div>

        <div className={`px-2 py-0.5 rounded font-bold border backdrop-blur-xs ${
          effectiveSuccess
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
            : 'bg-slate-900/90 text-sky-300 border-sky-500/40'
        }`}>
          {effectiveSuccess ? 'COINCIDENCIA > 70% ✓' : 'ANALIZANDO MALLA'}
        </div>
      </div>

      {/* Capa de Telemetría Inferior con Vector Flotante */}
      <div className="absolute bottom-3 inset-x-4 flex items-center justify-between pointer-events-none text-[10px] font-mono">
        <div className="bg-slate-950/85 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-700/80 text-slate-300">
          <span className="text-slate-500 mr-1.5">Tensores:</span>
          <span className={effectiveSuccess ? 'text-emerald-400 font-bold' : 'text-sky-300'}>
            {matchScore >= 70
              ? `[0.342, -0.681, 0.490, ...]`
              : `[${(Math.sin(Date.now() / 300) * 0.5).toFixed(3)}, ${(Math.cos(Date.now() / 400) * 0.7).toFixed(3)}, ...]`
            }
          </span>
        </div>

        <div className={`px-2.5 py-1 rounded-md font-bold text-xs border backdrop-blur-xs transition-all ${
          effectiveSuccess
            ? 'bg-emerald-900/90 text-emerald-300 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
            : matchScore >= 50
            ? 'bg-sky-950/90 text-sky-300 border-sky-400'
            : 'bg-slate-900/90 text-slate-300 border-slate-700'
        }`}>
          {matchScore}% Coincidencia
        </div>
      </div>

      {/* Cartel flotante central cuando supera el 70% */}
      {effectiveSuccess && (
        <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="bg-slate-950/95 border-2 border-emerald-400 px-4 py-2.5 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center space-x-2 text-emerald-400 font-heading font-black text-sm tracking-wide animate-scale-up">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>¡Parámetros Validados ({matchScore}%)! Ingresando...</span>
          </div>
        </div>
      )}
    </div>
  );
}
