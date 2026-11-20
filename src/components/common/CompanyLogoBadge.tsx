import { getCompanyInitials } from '../../services/companyService';

export interface CompanyLogoBadgeProps {
  name?: string | null;
  commercialName?: string | null;
  logoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CompanyLogoBadgeProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px] rounded-md',
  sm: 'w-9 h-9 text-xs rounded-lg',
  md: 'w-10 h-10 text-sm rounded-lg',
  lg: 'w-14 h-14 text-base rounded-xl',
};

export function CompanyLogoBadge({
  name,
  commercialName,
  logoUrl,
  size = 'sm',
  className = '',
}: CompanyLogoBadgeProps) {
  const initials = getCompanyInitials(name, commercialName);
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className={`${sizeClass} bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 overflow-hidden select-none tracking-tight ${className}`}
      title={commercialName || name || 'Empresa'}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={commercialName || name || 'Logotipo empresa'}
          className="w-full h-full object-contain p-1"
        />
      ) : (
        <span className="font-sans font-bold tracking-tight text-blue-800 dark:text-blue-300">
          {initials}
        </span>
      )}
    </div>
  );
}
