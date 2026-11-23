import { useId } from 'react';
import type { RankTier } from '../../services/gamification';

export interface RankMedalProps {
  tier: RankTier;
  variant?: 'emblem' | 'badge';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  points?: number;
  showBadge?: boolean;
  showPoints?: boolean;
  className?: string;
  title?: string;
}

interface TierVisualMeta {
  roman: string;
  title: string;
  levelText: string;
  ribbonGradient: [string, string];
  rimGradient: [string, string, string, string];
  innerGradient: [string, string];
  strokeColor: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  darkBadgeBg: string;
  darkBadgeBorder: string;
  darkBadgeText: string;
  glowColor: string;
}

const TIER_METAS: Record<RankTier, TierVisualMeta> = {
  bronce: {
    roman: 'I',
    title: 'Bronce',
    levelText: 'Nivel I — Bronce (0+ pts)',
    ribbonGradient: ['#78350F', '#9A5B25'],
    rimGradient: ['#CD7F32', '#9A5B25', '#E6C7A8', '#8C4B18'],
    innerGradient: ['#FDF8F3', '#F5E6D8'],
    strokeColor: '#9A5B25',
    textColor: '#9A5B25',
    badgeBg: 'bg-[#FDF8F3]',
    badgeBorder: 'border-[#E6C7A8]',
    badgeText: 'text-[#9A5B25]',
    darkBadgeBg: 'dark:bg-amber-950/25',
    darkBadgeBorder: 'dark:border-amber-800/40',
    darkBadgeText: 'dark:text-amber-300',
    glowColor: 'rgba(205, 127, 50, 0.35)',
  },
  plata: {
    roman: 'II',
    title: 'Plata',
    levelText: 'Nivel II — Plata (500+ pts)',
    ribbonGradient: ['#334155', '#64748B'],
    rimGradient: ['#CBD5E1', '#475569', '#F1F5F9', '#64748B'],
    innerGradient: ['#F8FAFC', '#E2E8F0'],
    strokeColor: '#475569',
    textColor: '#334155',
    badgeBg: 'bg-[#F8FAFC]',
    badgeBorder: 'border-[#CBD5E1]',
    badgeText: 'text-[#475569]',
    darkBadgeBg: 'dark:bg-slate-900/40',
    darkBadgeBorder: 'dark:border-slate-700/60',
    darkBadgeText: 'dark:text-slate-300',
    glowColor: 'rgba(148, 163, 184, 0.4)',
  },
  oro: {
    roman: 'III',
    title: 'Oro',
    levelText: 'Nivel III — Oro (1000+ pts)',
    ribbonGradient: ['#78350F', '#B45309'],
    rimGradient: ['#FDE68A', '#D97706', '#92400E', '#F59E0B'],
    innerGradient: ['#FFFBEB', '#FEF3C7'],
    strokeColor: '#92400E',
    textColor: '#92400E',
    badgeBg: 'bg-[#FFFBEB]',
    badgeBorder: 'border-[#FDE68A]',
    badgeText: 'text-[#92400E]',
    darkBadgeBg: 'dark:bg-amber-950/30',
    darkBadgeBorder: 'dark:border-amber-600/50',
    darkBadgeText: 'dark:text-amber-300',
    glowColor: 'rgba(245, 158, 11, 0.45)',
  },
  diamante: {
    roman: 'IV',
    title: 'Diamante',
    levelText: 'Nivel IV — Diamante (1600+ pts)',
    ribbonGradient: ['#172554', '#1D4ED8'],
    rimGradient: ['#BFDBFE', '#2563EB', '#1E3A8A', '#60A5FA'],
    innerGradient: ['#EFF6FF', '#DBEAFE'],
    strokeColor: '#1E3A8A',
    textColor: '#1E3A8A',
    badgeBg: 'bg-[#EFF6FF]',
    badgeBorder: 'border-[#BFDBFE]',
    badgeText: 'text-[#1E3A8A]',
    darkBadgeBg: 'dark:bg-blue-950/30',
    darkBadgeBorder: 'dark:border-blue-700/50',
    darkBadgeText: 'dark:text-blue-300',
    glowColor: 'rgba(37, 99, 235, 0.45)',
  },
};

const SIZE_MAP = {
  xs: 'w-7 h-8',
  sm: 'w-9 h-11',
  md: 'w-14 h-16',
  lg: 'w-20 h-24',
  xl: 'w-28 h-32',
};

export function RankMedal({
  tier = 'bronce',
  variant = 'emblem',
  size = 'md',
  points,
  showBadge = false,
  showPoints = false,
  className = '',
  title,
}: RankMedalProps) {
  const uniqueId = useId().replace(/[:]/g, '');
  const meta = TIER_METAS[tier] || TIER_METAS.bronce;

  const resolvedTooltip =
    title ||
    (points !== undefined
      ? `Rango Mensual: ${meta.title} (${points} pts)`
      : `Rango Mensual: ${meta.title}`);

  // Variante 1: Badge Píldora Ejecutiva
  if (variant === 'badge') {
    return (
      <span
        title={resolvedTooltip}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all select-none shadow-2xs ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} ${meta.darkBadgeBg} ${meta.darkBadgeBorder} ${meta.darkBadgeText} ${className}`}
      >
        {/* Mini Escudo SVG */}
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L4 5V11C4 16.5 7.4 21.6 12 23C16.6 21.6 20 16.5 20 11V5L12 2Z"
            fill={meta.rimGradient[1]}
            stroke={meta.strokeColor}
            strokeWidth="1.2"
          />
          <path
            d="M12 4L6 6.3V11C6 15.2 8.6 19.1 12 20.3C15.4 19.1 18 15.2 18 11V6.3L12 4Z"
            fill={meta.innerGradient[0]}
          />
          <text
            x="12"
            y="12.5"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fontWeight="bold"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={meta.textColor}
          >
            {meta.roman}
          </text>
        </svg>

        <span className="truncate">{meta.title}</span>

        {showPoints && points !== undefined && (
          <span className="text-[10px] opacity-75 font-normal tabular-nums">
            ({points} pts)
          </span>
        )}
      </span>
    );
  }

  // Variante 2: Emblema Vectorial Escudo Ejecutivo (Modal de Rendimiento y Tarjetas de Nivel)
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  const ribbonGradId = `ribbon-grad-${tier}-${uniqueId}`;
  const rimGradId = `rim-grad-${tier}-${uniqueId}`;
  const innerGradId = `inner-grad-${tier}-${uniqueId}`;
  const bevelGradId = `bevel-grad-${tier}-${uniqueId}`;

  return (
    <div
      title={resolvedTooltip}
      className={`inline-flex flex-col items-center justify-center select-none ${className}`}
    >
      <div className={`relative ${sizeClasses} shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 64 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm filter"
        >
          <defs>
            {/* Gradiente de la Cinta Superior */}
            <linearGradient id={ribbonGradId} x1="16" y1="0" x2="48" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={meta.ribbonGradient[0]} />
              <stop offset="100%" stopColor={meta.ribbonGradient[1]} />
            </linearGradient>

            {/* Gradiente Bisel del Aro Exterior */}
            <linearGradient id={rimGradId} x1="12" y1="18" x2="52" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={meta.rimGradient[0]} />
              <stop offset="35%" stopColor={meta.rimGradient[1]} />
              <stop offset="70%" stopColor={meta.rimGradient[2]} />
              <stop offset="100%" stopColor={meta.rimGradient[3]} />
            </linearGradient>

            {/* Gradiente Fondo del Escudo Central */}
            <linearGradient id={innerGradId} x1="20" y1="24" x2="44" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={meta.innerGradient[0]} />
              <stop offset="100%" stopColor={meta.innerGradient[1]} />
            </linearGradient>

            {/* Sombra de bisel superior */}
            <linearGradient id={bevelGradId} x1="32" y1="22" x2="32" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* CINTA DE HONOR SUPERIOR (Ribbon Izquierdo y Derecho) */}
          <g opacity="0.95">
            {/* Tira izquierda */}
            <path
              d="M20 2L32 18H20L12 2H20Z"
              fill={`url(#${ribbonGradId})`}
            />
            {/* Tira derecha */}
            <path
              d="M44 2L32 18H44L52 2H44Z"
              fill={`url(#${ribbonGradId})`}
            />
            {/* Pliegue de sombra en la cinta */}
            <path
              d="M26 10L32 18H38L32 10H26Z"
              fill="#000000"
              fillOpacity="0.18"
            />
          </g>

          {/* BROCHE DE SUJECIÓN METÁLICO */}
          <rect
            x="20"
            y="15"
            width="24"
            height="5"
            rx="2"
            fill={`url(#${rimGradId})`}
            stroke={meta.strokeColor}
            strokeWidth="0.8"
          />

          {/* ESCUDO EXTERIOR CON BORDE METÁLICO */}
          <path
            d="M14 23H50C51.6569 23 53 24.3431 53 26V43C53 57.5 32 70 32 70C32 70 11 57.5 11 43V26C11 24.3431 12.3431 23 14 23Z"
            fill={`url(#${rimGradId})`}
            stroke={meta.strokeColor}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* BISEL LUZ SUPERIOR DEL ESCUDO */}
          <path
            d="M14 24H50C51.1 24 52 24.9 52 26V34C45 32 37 31 32 31C27 31 19 32 12 34V26C12 24.9 12.9 24 14 24Z"
            fill={`url(#${bevelGradId})`}
          />

          {/* ESCUDO INTERIOR (Zócalo Pulido) */}
          <path
            d="M17 26.5H47C48.1 26.5 49 27.4 49 28.5V42C49 53.5 32 64 32 64C32 64 15 53.5 15 42V28.5C15 27.4 15.9 26.5 17 26.5Z"
            fill={`url(#${innerGradId})`}
            stroke={meta.strokeColor}
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />

          {/* ARO CENTRAL CINCELADO */}
          <circle
            cx="32"
            cy="42"
            r="12"
            fill="none"
            stroke={meta.strokeColor}
            strokeWidth="1"
            strokeDasharray="2.5 1.5"
            strokeOpacity="0.45"
          />

          {/* NÚMERO ROMANO CENTRAL */}
          <text
            x="32"
            y="43.5"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={meta.textColor}
            letterSpacing="0.5"
          >
            {meta.roman}
          </text>
        </svg>
      </div>

      {showBadge && (
        <span
          className={`mt-1 text-[10px] font-heading font-semibold uppercase tracking-wider text-center ${meta.badgeText}`}
        >
          {meta.title}
        </span>
      )}
    </div>
  );
}
