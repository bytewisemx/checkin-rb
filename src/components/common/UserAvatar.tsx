import React from 'react';

interface UserAvatarProps {
  photoURL?: string | null;
  name?: string;
  lastName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
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
  className = '',
}: UserAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';

  // Si tiene photoURL válido y no falló al cargar
  if (photoURL && !imageError) {
    return (
      <div
        className={`${sizeClass} ${shapeClass} overflow-hidden border border-slate-200/80 dark:border-slate-700/80 shrink-0 bg-slate-100 dark:bg-slate-800 ${className}`}
      >
        <img
          src={photoURL}
          referrerPolicy="no-referrer"
          alt={name || 'Usuario'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Iniciales tipográficas
  const initials = getInitials(name, lastName);

  return (
    <div
      className={`${sizeClass} ${shapeClass} font-bold flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700/60 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 select-none ${className}`}
      title={name ? `${name} ${lastName || ''}`.trim() : 'Usuario'}
    >
      {initials}
    </div>
  );
}

