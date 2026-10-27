import type { PilotPatient } from '../pilot-types';
import { ACTION_BY_CODE } from './action-library';
import type { AIReviewRecord } from './types';
import { CLINICAL_RISK_FOR, RISK_LEVEL_FOR } from '../pilot-engine';

// How an AI result reaches the screen.
//  - Wording: whenever a review passed every guardrail, the AI's summary, factors, driver, narrative and
//    action replace the rule engine's canned text on every screen. Without a validated review the rule-based
//    text stays (PRD AI-05, AI-09), so the worklist is never empty.
//  - Priority: final priority = the higher of the rule priority and a VALIDATED escalation. In 'shadow' mode
//    (PRD pilot weeks 5-12) escalations are recorded but not applied. This function can only keep the rule
//    priority or raise it. Filters read priority, risk level, trend and score, none of which the wording touches.

export type AIMode = 'apply' | 'shadow';

const REVIEW_TIME = {
  'SEE TODAY': 'Same working day',
  'SEE THIS WEEK': 'Within 5 working days',
  MONITOR: 'Next scheduled visit',
  HEALING: 'Next scheduled visit',
} as const;

function withAIWording(p: PilotPatient, review: AIReviewRecord): PilotPatient {
  const o = review.output!;
  const action = ACTION_BY_CODE[o.recommended_action.action_code];
  const extra = o.recommended_action.secondary.map((c) => ACTION_BY_CODE[c]?.label).filter(Boolean);
  const actionText = action ? `${action.label}.${extra.length ? ` Also: ${extra.join('; ')}.` : ''}` : p.recommendedAction;
  const severity = (i: number): 'critical' | 'warning' | 'info' =>
    i === 0 && o.primary_driver.red_flag ? 'critical' : review.finalPriority === 'SEE TODAY' ? 'critical' : review.finalPriority === 'SEE THIS WEEK' ? 'warning' : 'info';
  const driver = `${o.primary_driver.red_flag ? `${o.primary_driver.red_flag}: ` : ''}${o.primary_driver.text}`;

  return {
    ...p,
    tvnRationale: o.clinical_narrative.text,
    flaggedReason: o.summary.text,
    flaggedReasons: o.priority_factors.map((f, i) => ({ reason: `${f.factor}: ${f.text}`, severity: severity(i) })),
    recommendedAction: actionText,
    clinicalReasoning: {
      ...p.clinicalReasoning,
      primaryDriver: driver,
      secondaryDrivers: o.priority_factors.slice(1).map((f) => `${f.factor}: ${f.text}`),
      recommendedAction: actionText,
    },
  };
}

export function applyAIReview(p: PilotPatient, review: AIReviewRecord | undefined, mode: AIMode): PilotPatient {
  if (!review) return p;
  if (review.status !== 'accepted' || !review.output) return { ...p, aiReview: review };
  const worded: PilotPatient = { ...withAIWording(p, review), aiReview: review };
  if (!review.escalation || mode !== 'apply') return worded;

  const to = review.escalation.to;
  return {
    ...worded,
    tvnPriority: to,
    aiRaised: true,
    riskLevel: RISK_LEVEL_FOR[to],
    overallClinicalRisk: CLINICAL_RISK_FOR[to],
    expectedReviewTime: REVIEW_TIME[to],
  };
}
