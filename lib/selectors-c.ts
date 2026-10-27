import type { PilotPatient } from './pilot-types';

export type GroupStatus = 'Stable' | 'Monitor' | 'Intervention Required';

export interface GroupMetrics {
  name: string;
  total: number;
  highRisk: number; // RED or CRITICAL
  seeToday: number;
  seeThisWeek: number;
  deteriorating: number;
  improving: number;
  improvingPct: number;
  overdueReviews: number; // daysSinceReview > 14 (same rule as getCareHomeView)
  missedReviewPatients: number;
  avgReviewDelay: number;
  dataQualityIssues: number; // patients with data quality warning
  dataQualityPct: number; // share of patients without a data quality warning
  avgRiskScore: number;
  status: GroupStatus;
}

export function computeGroupMetrics(name: string, ps: PilotPatient[]): GroupMetrics {
  const total = ps.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const seeToday = ps.filter((p) => p.tvnPriority === 'SEE TODAY').length;
  const seeThisWeek = ps.filter((p) => p.tvnPriority === 'SEE THIS WEEK').length;
  const improving = ps.filter((p) => p.currentStatus === 'Improving').length;
  const dqIssues = ps.filter((p) => p.dataQualityWarning).length;
  return {
    name,
    total,
    highRisk: ps.filter((p) => p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL').length,
    seeToday,
    seeThisWeek,
    deteriorating: ps.filter((p) => p.currentStatus === 'Deteriorating').length,
    improving,
    improvingPct: pct(improving),
    overdueReviews: ps.filter((p) => p.daysSinceReview > 14).length,
    missedReviewPatients: ps.filter((p) => p.missedReviews > 0).length,
    avgReviewDelay: total > 0 ? Math.round((ps.reduce((s, p) => s + p.reviewDelayDays, 0) / total) * 10) / 10 : 0,
    dataQualityIssues: dqIssues,
    dataQualityPct: pct(total - dqIssues),
    avgRiskScore: total > 0 ? Math.round(ps.reduce((s, p) => s + p.riskScore, 0) / total) : 0,
    status: seeToday > 0 ? 'Intervention Required' : seeThisWeek > 0 ? 'Monitor' : 'Stable',
  };
}

function groupBy(patients: PilotPatient[], key: (p: PilotPatient) => string): GroupMetrics[] {
  const map = new Map<string, PilotPatient[]>();
  for (const p of patients) {
    const k = key(p) || 'Unassigned';
    const list = map.get(k) || [];
    list.push(p);
    map.set(k, list);
  }
  return Array.from(map.entries()).map(([name, ps]) => computeGroupMetrics(name, ps));
}

export function getFacilityMetrics(patients: PilotPatient[]): GroupMetrics[] {
  return groupBy(patients, (p) => p.facility).sort((a, b) => b.avgRiskScore - a.avgRiskScore);
}

export function getClinicianMetrics(patients: PilotPatient[]): GroupMetrics[] {
  return groupBy(patients, (p) => p.clinician).sort(
    (a, b) => b.seeToday - a.seeToday || b.seeThisWeek - a.seeThisWeek || b.total - a.total,
  );
}

export const STATUS_STYLES: Record<GroupStatus, string> = {
  'Stable': 'border-success/30 bg-success/5 text-success',
  'Monitor': 'border-warning/30 bg-warning/5 text-warning',
  'Intervention Required': 'border-destructive/30 bg-destructive/5 text-destructive',
};

export function statusCounts(groups: GroupMetrics[]): Record<GroupStatus, number> {
  return {
    'Stable': groups.filter((g) => g.status === 'Stable').length,
    'Monitor': groups.filter((g) => g.status === 'Monitor').length,
    'Intervention Required': groups.filter((g) => g.status === 'Intervention Required').length,
  };
}

export function shortName(name: string): string {
  // Full name: shortening collides, e.g. 'Care Home A' and 'Care Home B' both became 'Care Home'.
  return name;
}
