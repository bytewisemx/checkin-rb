import type { RankTier } from '../../services/gamification';

interface RankMedalProps {
  tier: RankTier;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  className?: string;
}

export function RankMedal({ tier, size = 'sm', showBadge = false, className = '' }: RankMedalProps) {
  // Dimensiones según tamaño
  const sizeMap = {
    xs: { w: 20, h: 20, stroke: 1.5 },
    sm: { w: 26, h: 26, stroke: 1.8 },
    md: { w: 38, h: 38, stroke: 2 },
    lg: { w: 56, h: 56, stroke: 2.2 },
    xl: { w: 84, h: 84, stroke: 2.5 },
  };

  const { w, h } = sizeMap[size];

  // Colores e identidades visuales de cada rango
  const themes = {
    bronce: {
      rimOuter: '#8C4B18',
      rimInner: '#B87333',
      fill: '#CD7F32',
      highlight: '#F4A460',
      ribbonLeft: '#9C5120',
      ribbonRight: '#6E320D',
      shadow: '#5A2508',
      label: 'BRONCE',
      bgTag: 'bg-amber-900/10 text-amber-800 border-amber-800/30',
    },
    plata: {
      rimOuter: '#475569',
      rimInner: '#94A3B8',
      fill: '#CBD5E1',
      highlight: '#FFFFFF',
      ribbonLeft: '#64748B',
      ribbonRight: '#334155',
      shadow: '#1E293B',
      label: 'PLATA',
      bgTag: 'bg-slate-200 text-slate-800 border-slate-300',
    },
    oro: {
      rimOuter: '#B45309',
      rimInner: '#F59E0B',
      fill: '#FBBF24',
      highlight: '#FEF08A',
      ribbonLeft: '#D97706',
      ribbonRight: '#92400E',
      shadow: '#78350F',
      label: 'ORO',
      bgTag: 'bg-amber-100 text-amber-900 border-amber-300',
    },
    diamante: {
      rimOuter: '#0E7490',
      rimInner: '#06B6D4',
      fill: '#22D3EE',
      highlight: '#E0F2FE',
      ribbonLeft: '#0284C7',
      ribbonRight: '#0369A1',
      shadow: '#164E63',
      label: 'DIAMANTE',
      bgTag: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    },
  };

  const t = themes[tier];

  return (
    <div className={`inline-flex items-center space-x-1.5 ${className}`}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform hover:scale-105 select-none"
      >
        <defs>
          {/* Degradado Cintas */}
          <linearGradient id={`ribbon-grad-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.ribbonLeft} />
            <stop offset="100%" stopColor={t.ribbonRight} />
          </linearGradient>

          {/* Degradado Medallón */}
          <radialGradient id={`medal-grad-${tier}`} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor={t.highlight} />
            <stop offset="45%" stopColor={t.fill} />
            <stop offset="85%" stopColor={t.rimInner} />
            <stop offset="100%" stopColor={t.rimOuter} />
          </radialGradient>

          {/* Sombra de caída */}
          <filter id={`medal-shadow-${tier}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={t.shadow} floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Cintas de la medalla */}
        <path
          d="M17 4L11 22L19 25L24 16L17 4Z"
          fill={t.ribbonLeft}
          opacity="0.9"
        />
        <path
          d="M31 4L37 22L29 25L24 16L31 4Z"
          fill={t.ribbonRight}
          opacity="0.9"
        />
        {/* Rayas decorativas en la cinta */}
        <path d="M15 4L13 21L16 22L19 7L15 4Z" fill="#FFFFFF" opacity="0.3" />
        <path d="M33 4L35 21L32 22L29 7L33 4Z" fill="#FFFFFF" opacity="0.3" />

        {/* Disco exterior con bisel */}
        <circle
          cx="24"
          cy="28"
          r="15"
          fill={t.rimOuter}
          filter={`url(#medal-shadow-${tier})`}
        />
        <circle
          cx="24"
          cy="28"
          r="13.5"
          fill={`url(#medal-grad-${tier})`}
        />
        <circle
          cx="24"
          cy="28"
          r="11.5"
          fill="none"
          stroke={t.highlight}
          strokeWidth="0.75"
          strokeDasharray="2 1.5"
          opacity="0.7"
        />

        {/* Emblema central de la medalla según rango */}
        {tier === 'bronce' && (
          // Escudo / Estrella Bronce
          <path
            d="M24 20L26.5 25L32 25.8L28 29.7L29 35L24 32.4L19 35L20 29.7L16 25.8L21.5 25L24 20Z"
            fill={t.rimOuter}
            stroke={t.highlight}
            strokeWidth="0.8"
          />
        )}

        {tier === 'plata' && (
          // Laureles / Estrella Alada Plata
          <g>
            <path
              d="M24 19L26.8 24.8L33 25.6L28.5 29.8L29.6 36L24 33L18.4 36L19.5 29.8L15 25.6L21.2 24.8L24 19Z"
              fill="#F8FAFC"
              stroke="#64748B"
              strokeWidth="0.75"
            />
            <circle cx="24" cy="28" r="2.5" fill="#475569" />
          </g>
        )}

        {tier === 'oro' && (
          // Corona / Estrella Radiante Oro
          <g>
            <path
              d="M17 33L18.5 25L21.5 28L24 21L26.5 28L29.5 25L31 33H17Z"
              fill="#78350F"
            />
            <path
              d="M17.5 32L19 26L21.5 28.5L24 22L26.5 28.5L29 26L30.5 32H17.5Z"
              fill="#FEF08A"
              stroke="#B45309"
              strokeWidth="0.5"
            />
            <circle cx="24" cy="21" r="1.2" fill="#FFFFFF" />
            <circle cx="18.5" cy="25" r="1" fill="#FFFFFF" />
            <circle cx="29.5" cy="25" r="1" fill="#FFFFFF" />
          </g>
        )}

        {tier === 'diamante' && (
          // Gema de Diamante Facetada
          <g>
            <polygon
              points="24,19 30,24 24,35 18,24"
              fill="#ECFEFF"
              stroke="#0891B2"
              strokeWidth="0.8"
            />
            <polygon points="24,19 28,24 24,27 20,24" fill="#A5F3FC" opacity="0.8" />
            <polygon points="24,27 28,24 24,35" fill="#06B6D4" opacity="0.9" />
            <polygon points="24,27 20,24 24,35" fill="#0891B2" opacity="0.9" />
            {/* Destello estelar en la gema */}
            <circle cx="22" cy="22" r="1.2" fill="#FFFFFF" />
          </g>
        )}
      </svg>

      {showBadge && (
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${t.bgTag}`}>
          {t.label}
        </span>
      )}
    </div>
  );
}
