import type { TVNPriority } from '../pilot-types';

// Output contract for the AI Clinical Reasoning Engine (PRD 11.6.4). The model's JSON must match this
// exactly; anything else is rejected before it can reach the screen.

export interface Cited {
  text: string;
  evidence: string[];
}

export interface AIOutput {
  current_status: Cited;
  overall_risk: {
    final_priority: string; // wire format, e.g. SEE_TODAY
    rule_priority: string;
    ai_escalation: null | { to_priority: string; reason: string; evidence: string[] };
  };
  primary_driver: Cited & { red_flag: string | null };
  what_changed: Cited[];
  recommended_action: { action_code: string; timeframe: string; secondary: string[] };
  clinical_narrative: Cited;
  why_now: string;
  // One plain-English sentence for list rows, and the plain-English factors that produced the priority.
  summary: Cited;
  priority_factors: (Cited & { factor: string })[];
  for_tvn_consideration: string | null;
}

export type ReviewStatus = 'accepted' | 'rejected' | 'unavailable';

export interface GuardrailViolation {
  check: string;
  detail: string;
}

export interface AIReviewRecord {
  status: ReviewStatus;
  patientId: string;
  rulePriority: TVNPriority;
  finalPriority: TVNPriority; // equals rulePriority unless a validated escalation was raised
  escalation: null | { to: TVNPriority; reason: string; evidence: string[] };
  output: AIOutput | null; // present only when every guardrail passed
  violations: GuardrailViolation[];
  errorKind: string | null;
  attempts: number;
  fromCache: boolean;
  inputHash: string;
  promptVersion: string;
  promptHash: string;
  model: string;
  rulesetVersion: string;
  latencyMs: number;
  flaggedWrong: boolean;
  completedAtDay: string; // YYYY-MM-DD only, no clock time
}
