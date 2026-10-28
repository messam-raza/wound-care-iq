import type { PilotPatient } from './pilot-types';

// Shared rules for the dashboard, AI Reviews and Prioritisation tables.

export type PatientStatus = 'Visited' | 'Needs Review' | 'Pending';

// A patient needs a human look when the data behind the priority is incomplete or low confidence, or when
// the AI raised the priority above what the rules gave (a clinician should confirm it).
export function needsHumanReview(p: PilotPatient): boolean {
  return p.dataQualityWarning || p.clinicalConfidence === 'LOW' || p.aiRaised;
}

export function patientStatus(p: PilotPatient, visited: boolean): PatientStatus {
  if (visited) return 'Visited';
  return needsHumanReview(p) ? 'Needs Review' : 'Pending';
}

export type AIStatus = 'Accepted' | 'Rejected' | 'Unavailable' | 'Pending';

export function aiStatus(p: PilotPatient): AIStatus {
  const r = p.aiReview;
  if (!r) return 'Pending';
  return r.status === 'accepted' ? 'Accepted' : r.status === 'rejected' ? 'Rejected' : 'Unavailable';
}
