import { getCompanyInitials } from '../../services/companyService';

export interface CompanyLogoBadgeProps {
  name?: string | null;
  commercialName?: string | null;
  logoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CompanyLogoBadgeProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
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
      className={`${sizeClass} bg-slate-800 dark:bg-[#090E17] border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
      title={commercialName || name || 'Empresa'}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={commercialName || name || 'Logotipo empresa'}
          className="w-full h-full object-contain p-0.5"
        />
      ) : (
        <span className="font-['Space_Grotesk'] font-bold tracking-tight text-sky-400">
          {initials}
        </span>
      )}
    </div>
  );
}
