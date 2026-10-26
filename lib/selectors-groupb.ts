import type { PilotPatient, PilotRiskLevel, TVNPriority } from './pilot-types';

// Tailwind class helpers for PilotRiskLevel / TVNPriority (includes CRITICAL, unlike RiskBadge).
export const RISK_LEVEL_STYLES: Record<PilotRiskLevel, { badge: string; dot: string; text: string; soft: string }> = {
  CRITICAL: { badge: 'bg-destructive/10 text-destructive border-destructive/30', dot: 'bg-destructive', text: 'text-destructive', soft: 'border-destructive/30 bg-destructive/5' },
  RED: { badge: 'bg-destructive/10 text-destructive border-destructive/30', dot: 'bg-destructive', text: 'text-destructive', soft: 'border-destructive/30 bg-destructive/5' },
  AMBER: { badge: 'bg-warning/10 text-warning border-warning/30', dot: 'bg-warning', text: 'text-warning', soft: 'border-warning/30 bg-warning/5' },
  GREEN: { badge: 'bg-success/10 text-success border-success/30', dot: 'bg-success', text: 'text-success', soft: 'border-success/30 bg-success/5' },
};

export const TVN_PRIORITY_STYLES: Record<TVNPriority, string> = {
  'SEE TODAY': 'border-destructive/30 text-destructive',
  'SEE THIS WEEK': 'border-warning/30 text-warning',
  'MONITOR': 'border-border text-muted-foreground',
  'HEALING': 'border-success/30 text-success',
};

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 3);
}

export interface FacilityReviewStats {
  name: string;
  total: number;
  overdue: number; // daysSinceReview > 14 (same threshold as engine facility summaries)
  missed: number; // missedReviews > 0
  avgDaysSinceReview: number;
}

export function getReviewStatsByFacility(patients: PilotPatient[]): FacilityReviewStats[] {
  const map = new Map<string, PilotPatient[]>();
  for (const p of patients) map.set(p.facility, [...(map.get(p.facility) || []), p]);
  return Array.from(map.entries())
    .map(([name, ps]) => ({
      name,
      total: ps.length,
      overdue: ps.filter((p) => p.daysSinceReview > 14).length,
      missed: ps.filter((p) => p.missedReviews > 0).length,
      avgDaysSinceReview: Math.round(ps.reduce((s, p) => s + p.daysSinceReview, 0) / ps.length),
    }))
    .sort((a, b) => b.overdue - a.overdue);
}
