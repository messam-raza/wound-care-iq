import type { PilotPatient, PilotRiskLevel, TVNPriority } from './pilot-types';

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function isDeteriorating(p: PilotPatient): boolean {
  return p.currentStatus === 'Deteriorating';
}

export function isDelayedOrDeteriorating(p: PilotPatient): boolean {
  return p.currentStatus === 'Deteriorating' || p.currentStatus === 'Delayed Healing' || p.failureToHeal;
}

export function isOverdueReview(p: PilotPatient): boolean {
  return p.missedReviews > 0 || p.reviewDelayDays > 0;
}

export function isEscalationCandidate(p: PilotPatient): boolean {
  return (
    p.tvnPriority === 'SEE TODAY' ||
    p.tvnPriority === 'SEE THIS WEEK' ||
    p.riskLevel === 'RED' ||
    p.riskLevel === 'CRITICAL'
  );
}

export function getEscalationList(patients: PilotPatient[]): PilotPatient[] {
  const order: Record<TVNPriority, number> = { 'SEE TODAY': 0, 'SEE THIS WEEK': 1, 'MONITOR': 2, 'HEALING': 3 };
  return patients
    .filter(isEscalationCandidate)
    .sort((a, b) => order[a.tvnPriority] - order[b.tvnPriority] || b.riskScore - a.riskScore);
}

export function primaryReason(p: PilotPatient): string {
  return (
    p.clinicalReasoning.primaryDriver ||
    p.flaggedReason ||
    p.riskDrivers.find((d) => d.isPrimary)?.factor ||
    ''
  );
}

export const RISK_TONE: Record<PilotRiskLevel, 'destructive' | 'warning' | 'success'> = {
  CRITICAL: 'destructive',
  RED: 'destructive',
  AMBER: 'warning',
  GREEN: 'success',
};

export const PRIORITY_TONE: Record<TVNPriority, 'destructive' | 'warning' | 'primary' | 'success'> = {
  'SEE TODAY': 'destructive',
  'SEE THIS WEEK': 'warning',
  'MONITOR': 'primary',
  'HEALING': 'success',
};

export interface FacilityPressure {
  name: string;
  total: number;
  urgent: number;
  delayed: number;
}

// Facilities ranked by number of SEE TODAY / SEE THIS WEEK wounds (only those with at least one).
export function getFacilityPressure(patients: PilotPatient[]): FacilityPressure[] {
  const map = new Map<string, FacilityPressure>();
  for (const p of patients) {
    const f = map.get(p.facility) ?? { name: p.facility, total: 0, urgent: 0, delayed: 0 };
    f.total += 1;
    if (p.tvnPriority === 'SEE TODAY' || p.tvnPriority === 'SEE THIS WEEK') f.urgent += 1;
    if (isDelayedOrDeteriorating(p)) f.delayed += 1;
    map.set(p.facility, f);
  }
  return Array.from(map.values())
    .filter((f) => f.urgent > 0)
    .sort((a, b) => b.urgent - a.urgent || b.delayed - a.delayed);
}
