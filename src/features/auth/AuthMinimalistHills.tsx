import React from 'react';

/**
 * Paisaje minimalista profesional enriquecido que llena ampliamente la pantalla.
 * Cuenta con múltiples capas escalonadas de colinas en tonos azul noche, azul Russell Bedford,
 * cian corporativo y blanco puro, complementadas con halos circulares y figuras geométricas sobrias.
 */
export const AuthMinimalistHills: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0">
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 1. Cielo corporativo profundo: azul noche a azul institucional */}
          <linearGradient id="skyGradFull" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#000E17" />
            <stop offset="25%" stopColor="#001B29" />
            <stop offset="55%" stopColor="#032D3F" />
            <stop offset="85%" stopColor="#074457" />
            <stop offset="100%" stopColor="#0D5C75" />
          </linearGradient>

          {/* Resplandor suave en el horizonte */}
          <radialGradient id="horizonGlowFull" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#00B5B8" stopOpacity="0.25" />
            <stop offset="45%" stopColor="#0D5C75" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000E17" stopOpacity="0" />
          </radialGradient>

          {/* Halo geométrico concéntrico */}
          <radialGradient id="geoHaloGrad" cx="75%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#00B5B8" stopOpacity="0.15" />
            <stop offset="60%" stopColor="#0D5C75" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000E17" stopOpacity="0" />
          </radialGradient>

          {/* Colina 1 (Lejana alta - Azul noche profundo) */}
          <linearGradient id="hillFar1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#093142" />
            <stop offset="100%" stopColor="#031822" />
          </linearGradient>

          {/* Colina 2 (Media alta - Azul petróleo) */}
          <linearGradient id="hillMidHigh" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0B4257" />
            <stop offset="100%" stopColor="#04222E" />
          </linearGradient>

          {/* Colina 3 (Institucional - Azul Russell Bedford vibrante) */}
          <linearGradient id="hillRBMain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0D5C75" />
            <stop offset="65%" stopColor="#083E50" />
            <stop offset="100%" stopColor="#002538" />
          </linearGradient>

          {/* Colina 4 (Transición - Azul cian zafiro) */}
          <linearGradient id="hillCyanShade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#15647D" />
            <stop offset="100%" stopColor="#083241" />
          </linearGradient>

          {/* Colina 5 (Frontal - Blanco y azul hielo perla) */}
          <linearGradient id="hillWhiteMain" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Colina 6 (Base frontal pura) */}
          <linearGradient id="hillBaseWhite" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>

          {/* Sombras suaves para dar volumen y profundidad */}
          <filter id="hillShadowFar" x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="0" dy="-8" stdDeviation="16" floodColor="#000E17" floodOpacity="0.4" />
          </filter>

          <filter id="hillShadowMid" x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="0" dy="-10" stdDeviation="18" floodColor="#001622" floodOpacity="0.35" />
          </filter>

          <filter id="whiteHillShadow" x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="0" dy="-12" stdDeviation="22" floodColor="#073344" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* 1. CIELO BASE CORPORATIVO COMPLETO */}
        <rect width="1440" height="900" fill="url(#skyGradFull)" />
        <rect width="1440" height="900" fill="url(#horizonGlowFull)" />
        <rect width="1440" height="900" fill="url(#geoHaloGrad)" />

        {/* 2. FIGURAS GEOMÉTRICAS SOBRIAS (Halos concéntricos y red de conexiones de auditoría) */}
        {/* Halos circulares sutiles minimalistas */}
        <g opacity="0.4">
          <circle cx="1120" cy="240" r="340" fill="none" stroke="rgba(0,181,184,0.12)" strokeWidth="1" strokeDasharray="6 8" />
          <circle cx="1120" cy="240" r="230" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <circle cx="1120" cy="240" r="120" fill="none" stroke="rgba(0,181,184,0.18)" strokeWidth="1.2" strokeDasharray="4 6" />
          
          <circle cx="280" cy="180" r="160" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeDasharray="5 7" />
        </g>

        {/* Red de conexiones vectoriales sobrias */}
        <g opacity="0.5">
          <line x1="140" y1="180" x2="280" y2="240" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" strokeDasharray="4 4" />
          <line x1="280" y1="240" x2="440" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" />
          <line x1="440" y1="190" x2="600" y2="270" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" strokeDasharray="4 4" />
          <line x1="600" y1="270" x2="760" y2="210" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" />

          <line x1="860" y1="160" x2="1020" y2="210" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
          <line x1="1020" y1="210" x2="1180" y2="150" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" strokeDasharray="3 5" />
          <line x1="1180" y1="150" x2="1340" y2="220" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />

          {/* Nodos de luz corporativos */}
          <circle cx="140" cy="180" r="3" fill="#00B5B8" />
          <circle cx="280" cy="240" r="3.5" fill="#FFFFFF" />
          <circle cx="440" cy="190" r="2.5" fill="#00B5B8" />
          <circle cx="600" cy="270" r="3.5" fill="#FFFFFF" />
          <circle cx="760" cy="210" r="2.5" fill="#00B5B8" />
          <circle cx="860" cy="160" r="2.5" fill="#FFFFFF" />
          <circle cx="1020" cy="210" r="4" fill="#00B5B8" />
          <circle cx="1180" cy="150" r="3" fill="#FFFFFF" />
          <circle cx="1340" cy="220" r="3.5" fill="#00B5B8" />

          {/* Pequeños puntos de luz etéreos estables */}
          <circle cx="210" cy="110" r="1.5" fill="#FFFFFF" opacity="0.6" />
          <circle cx="510" cy="120" r="1.6" fill="#FFFFFF" opacity="0.5" />
          <circle cx="680" cy="90" r="1.4" fill="#FFFFFF" opacity="0.7" />
          <circle cx="920" cy="90" r="1.5" fill="#FFFFFF" opacity="0.6" />
          <circle cx="1270" cy="80" r="1.8" fill="#FFFFFF" opacity="0.7" />
        </g>

        {/* 3. CAPA 1: COLINAS LEJANAS ALTAS (Inician en la parte media superior para llenar el fondo) */}
        <g filter="url(#hillShadowFar)">
          <path
            d="M-50,340 C180,260 420,380 720,300 C1020,220 1240,340 1520,280 L1520,930 L-50,930 Z"
            fill="url(#hillFar1)"
            opacity="0.9"
          />
        </g>

        {/* 4. CAPA 2: COLINAS MEDIAS ALTAS (Silueta ondulante suave en azul petróleo) */}
        <g filter="url(#hillShadowFar)">
          <path
            d="M-50,430 C160,360 440,480 760,400 C1040,320 1260,440 1520,380 L1520,930 L-50,930 Z"
            fill="url(#hillMidHigh)"
          />
        </g>

        {/* 5. CAPA 3: COLINAS INSTITUCIONALES (Azul Russell Bedford con cresta de luz cian) */}
        <g filter="url(#hillShadowMid)">
          <path
            d="M-50,520 C220,440 480,580 800,490 C1080,410 1310,530 1520,480 L1520,930 L-50,930 Z"
            fill="url(#hillRBMain)"
          />
          {/* Línea iluminada de cresta en cian corporativo */}
          <path
            d="M-50,520 C220,440 480,580 800,490 C1080,410 1310,530 1520,480"
            fill="none"
            stroke="#00B5B8"
            strokeWidth="2.2"
            opacity="0.6"
          />
        </g>

        {/* 6. CAPA 4: COLINAS DE PROFUNDIDAD (Azul zafiro suave con matices) */}
        <path
          d="M-50,610 C180,540 460,670 780,580 C1060,500 1280,620 1520,570 L1520,930 L-50,930 Z"
          fill="url(#hillCyanShade)"
          opacity="0.95"
        />

        {/* 7. CAPA 5: COLINAS BLANCAS LUMINOSAS (Elegancia minimalista pura) */}
        <g filter="url(#whiteHillShadow)">
          <path
            d="M-50,690 C220,620 520,750 860,660 C1140,580 1340,680 1520,630 L1520,930 L-50,930 Z"
            fill="url(#hillWhiteMain)"
          />
          {/* Borde de luz blanca nítida */}
          <path
            d="M-50,690 C220,620 520,750 860,660 C1140,580 1340,680 1520,630"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            opacity="0.9"
          />
        </g>

        {/* 8. CAPA 6: COLINA BASE BLANCA FRONTAL */}
        <path
          d="M-50,780 C260,720 590,820 950,750 C1220,690 1380,760 1520,730 L1520,930 L-50,930 Z"
          fill="url(#hillBaseWhite)"
        />

        {/* Remate inferior limpio */}
        <rect x="0" y="860" width="1440" height="40" fill="#FFFFFF" />
      </svg>
    </div>
  );
};
