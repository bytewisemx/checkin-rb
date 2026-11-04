import type { RankTier } from '../../services/gamification';

interface RankMedalProps {
  tier: RankTier;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  className?: string;
}

export function RankMedal({ tier, showBadge = false, className = '' }: RankMedalProps) {
  const labels: Record<RankTier, string> = {
    bronce: 'NIVEL I',
    plata: 'NIVEL II',
    oro: 'NIVEL III',
    diamante: 'NIVEL IV',
  };

  return (
    <div className={`inline-flex items-center space-x-1.5 ${className}`}>
      <span className="text-[10px] font-heading font-semibold uppercase tracking-widest text-[#94A3B8] border-b border-slate-700/60 pb-0.5">
        {labels[tier]}
      </span>
      {showBadge && (
        <span className="text-[10px] font-heading font-medium uppercase tracking-wider text-[#94A3B8]">
          {tier.toUpperCase()}
        </span>
      )}
    </div>
  );
}
