import { cn } from '@/lib/utils';
import type { RiskCategory } from '@/lib/types';

export function RiskBadge({ category, className }: { category: RiskCategory; className?: string }) {
  const styles: Record<RiskCategory, string> = {
    RED: 'bg-destructive/10 text-destructive border-destructive/30',
    AMBER: 'bg-warning/10 text-warning border-warning/30',
    GREEN: 'bg-success/10 text-success border-success/30',
  };
  const labels: Record<RiskCategory, string> = {
    RED: 'RED',
    AMBER: 'AMBER',
    GREEN: 'GREEN',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles[category],
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          category === 'RED' ? 'bg-destructive' : category === 'AMBER' ? 'bg-warning' : 'bg-success',
        )}
      />
      {labels[category]}
    </span>
  );
}

export function RiskScoreBar({ score }: { score: number }) {
  const color = score >= 71 ? 'bg-destructive' : score >= 41 ? 'bg-warning' : 'bg-success';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums">{score}</span>
    </div>
  );
}
