import React from 'react';

/**
 * Panel lateral puramente ilustrativo y artístico para el modal de login.
 * Sin textos ni símbolos, dejando respirar el paisaje vectorial minimalista
 * de colinas en tonos azul corporativo, blanco y cian.
 */
export const AuthModalSideIllustration: React.FC = () => {
  return (
    <div className="relative w-full h-full min-h-[460px] bg-gradient-to-br from-[#00121C] via-[#002538] to-[#0D5C75] overflow-hidden select-none">
      <svg
        className="w-full h-full absolute inset-0 pointer-events-none"
        viewBox="0 0 500 700"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradiente de cielo corporativo */}
          <linearGradient id="modalSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#000E17" />
            <stop offset="30%" stopColor="#002133" />
            <stop offset="70%" stopColor="#063D50" />
            <stop offset="100%" stopColor="#0D5C75" />
          </linearGradient>

          {/* Resplandor sutil de horizonte */}
          <radialGradient id="modalHorizonGlow" cx="60%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#00B5B8" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#0D5C75" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000E17" stopOpacity="0" />
          </radialGradient>

          {/* Colina 1 (Lejana alta - Azul noche) */}
          <linearGradient id="modalHill1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0A3344" />
            <stop offset="100%" stopColor="#031822" />
          </linearGradient>

          {/* Colina 2 (Media - Azul petróleo profundo) */}
          <linearGradient id="modalHill2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0D475C" />
            <stop offset="100%" stopColor="#04222E" />
          </linearGradient>

          {/* Colina 3 (Institucional - Azul Russell Bedford con cresta cian) */}
          <linearGradient id="modalHill3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D5C75" />
            <stop offset="65%" stopColor="#073B4D" />
            <stop offset="100%" stopColor="#002233" />
          </linearGradient>

          {/* Colina 4 (Frontal - Blanco y azul hielo perla) */}
          <linearGradient id="modalHillWhite" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Colina 5 (Base blanca pura) */}
          <linearGradient id="modalHillBase" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>

          {/* Filtros de sombra para volumen armónico */}
          <filter id="modalHillShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="-8" stdDeviation="14" floodColor="#00101A" floodOpacity="0.35" />
          </filter>

          <filter id="modalWhiteShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="-10" stdDeviation="18" floodColor="#062E3D" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* 1. CIELO */}
        <rect width="500" height="700" fill="url(#modalSkyGrad)" />
        <rect width="500" height="700" fill="url(#modalHorizonGlow)" />

        {/* 2. FIGURAS GEOMÉTRICAS SOBRIAS (Halos concéntricos y red sutil de constelaciones) */}
        <g opacity="0.38">
          {/* Halos circulares de luz */}
          <circle cx="360" cy="180" r="220" fill="none" stroke="rgba(0,181,184,0.15)" strokeWidth="1" strokeDasharray="5 7" />
          <circle cx="360" cy="180" r="140" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
          <circle cx="360" cy="180" r="70" fill="none" stroke="rgba(0,181,184,0.2)" strokeWidth="1.2" strokeDasharray="3 5" />

          {/* Líneas geométricas finas */}
          <line x1="40" y1="120" x2="160" y2="170" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeDasharray="3 4" />
          <line x1="160" y1="170" x2="280" y2="130" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
          <line x1="280" y1="130" x2="410" y2="200" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeDasharray="4 4" />

          <line x1="100" y1="260" x2="220" y2="220" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
          <line x1="220" y1="220" x2="350" y2="280" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" strokeDasharray="3 4" />

          {/* Nodos de luz */}
          <circle cx="40" cy="120" r="2.5" fill="#00B5B8" />
          <circle cx="160" cy="170" r="3" fill="#FFFFFF" />
          <circle cx="280" cy="130" r="2.5" fill="#00B5B8" />
          <circle cx="410" cy="200" r="3.5" fill="#FFFFFF" />
          
          <circle cx="100" cy="260" r="2" fill="#FFFFFF" />
          <circle cx="220" cy="220" r="3" fill="#00B5B8" />
          <circle cx="350" cy="280" r="2.5" fill="#FFFFFF" />

          {/* Pequeños puntos de luz sutiles */}
          <circle cx="80" cy="70" r="1.4" fill="#FFFFFF" opacity="0.6" />
          <circle cx="220" cy="80" r="1.6" fill="#FFFFFF" opacity="0.7" />
          <circle cx="440" cy="90" r="1.4" fill="#FFFFFF" opacity="0.6" />
          <circle cx="150" cy="310" r="1.2" fill="#FFFFFF" opacity="0.5" />
        </g>

        {/* 3. CAPA 1: COLINAS LEJANAS (Inician en la parte media para llenar el espacio) */}
        <g filter="url(#modalHillShadow)">
          <path
            d="M-30,280 C120,220 270,320 420,260 C470,240 500,250 540,260 L540,730 L-30,730 Z"
            fill="url(#modalHill1)"
            opacity="0.9"
          />
        </g>

        {/* 4. CAPA 2: COLINAS MEDIAS (Azul petróleo profundo) */}
        <g filter="url(#modalHillShadow)">
          <path
            d="M-30,370 C100,310 280,420 410,350 C460,325 500,340 540,350 L540,730 L-30,730 Z"
            fill="url(#modalHill2)"
          />
        </g>

        {/* 5. CAPA 3: COLINAS INSTITUCIONALES (Azul Russell Bedford con cresta cian) */}
        <g filter="url(#modalHillShadow)">
          <path
            d="M-30,460 C130,390 310,510 440,440 C480,420 510,430 540,440 L540,730 L-30,730 Z"
            fill="url(#modalHill3)"
          />
          {/* Línea iluminada en la cresta */}
          <path
            d="M-30,460 C130,390 310,510 440,440 C480,420 510,430 540,440"
            fill="none"
            stroke="#00B5B8"
            strokeWidth="2"
            opacity="0.65"
          />
        </g>

        {/* 6. CAPA 4: COLINAS BLANCAS PERLA LUMINOSAS */}
        <g filter="url(#modalWhiteShadow)">
          <path
            d="M-30,540 C140,480 320,590 440,530 C480,510 510,520 540,530 L540,730 L-30,730 Z"
            fill="url(#modalHillWhite)"
          />
          {/* Borde sutil blanco */}
          <path
            d="M-30,540 C140,480 320,590 440,530 C480,510 510,520 540,530"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            opacity="0.85"
          />
        </g>

        {/* 7. CAPA 5: COLINA BASE BLANCA FRONTAL */}
        <path
          d="M-30,620 C160,570 340,660 460,610 C490,600 520,605 540,610 L540,730 L-30,730 Z"
          fill="url(#modalHillBase)"
        />

        {/* Remate blanco inferior */}
        <rect x="0" y="670" width="500" height="30" fill="#FFFFFF" />
      </svg>
    </div>
  );
};
