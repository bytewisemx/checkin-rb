import React from 'react';
import type { RankTier } from '../../services/gamification';

export interface UserAvatarProps {
  photoURL?: string | null;
  name?: string;
  lastName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  rank?: RankTier | null;
  showStar?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
};

const STAR_CONTAINER_SIZES = {
  xs: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
  sm: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
  md: 'w-4 h-4 -bottom-0.5 -right-0.5',
  lg: 'w-5 h-5 -bottom-1 -right-1',
  xl: 'w-6 h-6 -bottom-1 -right-1',
};

const STAR_ICON_SIZES = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

interface RankStyleMeta {
  ringClass: string;
  starBg: string;
  starBorder: string;
  label: string;
}

const RANK_STYLES: Record<RankTier, RankStyleMeta> = {
  bronce: {
    ringClass: 'ring-2 ring-[#CD7F32] border-[#9A5B25]/80 shadow-xs',
    starBg: 'bg-gradient-to-br from-[#CD7F32] to-[#8C4B18]',
    starBorder: 'border-white dark:border-[#101726]',
    label: 'Rango Bronce',
  },
  plata: {
    ringClass: 'ring-2 ring-[#94A3B8] border-[#475569]/80 shadow-xs',
    starBg: 'bg-gradient-to-br from-[#CBD5E1] to-[#475569]',
    starBorder: 'border-white dark:border-[#101726]',
    label: 'Rango Plata',
  },
  oro: {
    ringClass: 'ring-2 ring-[#F59E0B] border-[#92400E]/80 shadow-xs',
    starBg: 'bg-gradient-to-br from-[#FDE68A] via-[#F59E0B] to-[#92400E]',
    starBorder: 'border-white dark:border-[#101726]',
    label: 'Rango Oro',
  },
  diamante: {
    ringClass: 'ring-2 ring-[#2563EB] border-[#1E3A8A]/80 shadow-xs',
    starBg: 'bg-gradient-to-br from-[#60A5FA] via-[#2563EB] to-[#1E3A8A]',
    starBorder: 'border-white dark:border-[#101726]',
    label: 'Rango Diamante',
  },
};

function getInitials(name?: string, lastName?: string): string {
  const first = (name || '').trim();
  const last = (lastName || '').trim();

  if (first && last) {
    return (first[0] + last[0]).toUpperCase();
  }
  if (first.length >= 2) {
    const parts = first.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return first.slice(0, 2).toUpperCase();
  }
  return (first[0] || 'U').toUpperCase();
}

export function UserAvatar({
  photoURL,
  name,
  lastName,
  size = 'sm',
  shape = 'circle',
  rank = null,
  showStar = true,
  className = '',
}: UserAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const starContainerSize = STAR_CONTAINER_SIZES[size] || STAR_CONTAINER_SIZES.sm;
  const starIconSize = STAR_ICON_SIZES[size] || STAR_ICON_SIZES.sm;

  const rankMeta = rank ? RANK_STYLES[rank] : null;
  const borderRingClass = rankMeta
    ? rankMeta.ringClass
    : 'border border-slate-200/80 dark:border-slate-700/80';

  const avatarContent = photoURL && !imageError ? (
    <div
      className={`${sizeClass} ${shapeClass} overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 ${borderRingClass}`}
    >
      <img
        src={photoURL}
        referrerPolicy="no-referrer"
        alt={name || 'Usuario'}
        onError={() => setImageError(true)}
        className="w-full h-full object-cover"
      />
    </div>
  ) : (
    <div
      className={`${sizeClass} ${shapeClass} font-bold flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 select-none ${borderRingClass}`}
      title={name ? `${name} ${lastName || ''}`.trim() : 'Usuario'}
    >
      {getInitials(name, lastName)}
    </div>
  );

  // Si no tiene rango asignado o se desactiva la estrella, retornar el avatar limpio
  if (!rankMeta || !showStar) {
    return <div className={`relative inline-block shrink-0 ${className}`}>{avatarContent}</div>;
  }

  // Avatar con marco metálico y micro-estrella de honor
  return (
    <div
      className={`relative inline-block shrink-0 select-none ${className}`}
      title={`${name || 'Usuario'} — ${rankMeta.label}`}
    >
      {avatarContent}

      {/* Micro-insignia con Estrella de Rango */}
      <span
        aria-hidden="true"
        className={`absolute ${starContainerSize} rounded-full ${rankMeta.starBg} border ${rankMeta.starBorder} flex items-center justify-center shadow-xs z-10`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`${starIconSize} text-white drop-shadow-2xs`}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </span>
    </div>
  );
}
