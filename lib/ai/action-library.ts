import type { TVNPriority } from '../pilot-types';

// The controlled action library from PRD section 9.8. Recommendations state what and when,
// never which dressing or drug. Both the rule engine and the AI guardrail validator use this
// single table, so an action code the AI invents can never reach the screen.
//
// urgency: lower is more urgent. A validated AI action must be at least as urgent as the rule action.

export interface ActionDef {
  code: string;
  label: string;
  timeframe: 'today' | 'within_1_working_day' | 'this_week' | 'next_visit' | 'ongoing';
  urgency: number;
  kind: 'primary' | 'secondary';
}

const A = (code: string, label: string, timeframe: ActionDef['timeframe'], urgency: number, kind: ActionDef['kind']): ActionDef => ({
  code,
  label,
  timeframe,
  urgency,
  kind,
});

export const ACTION_LIBRARY: ActionDef[] = [
  // Primary actions (PRD 9.8)
  A('URGENT_REFERRAL_DIABETIC_FOOT_MDT', 'Same-day referral to the diabetic foot MDT and vascular service', 'today', 0, 'primary'),
  A('URGENT_VASCULAR_REFERRAL', 'Urgent same-day vascular referral', 'today', 0, 'primary'),
  A('SAME_DAY_MEDICAL_REVIEW', 'Same-day medical review; follow the local sepsis pathway if systemic', 'today', 0, 'primary'),
  A('TVN_REVIEW_TODAY', 'TVN review today', 'today', 1, 'primary'),
  A('CLINICAL_REVIEW_TODAY', 'Clinical review today', 'today', 1, 'primary'),
  A('REFERRAL_DIABETIC_FOOT_MDT_1_WORKING_DAY', 'Refer to the diabetic foot MDT within 1 working day', 'within_1_working_day', 2, 'primary'),
  A('TVN_REVIEW_THIS_WEEK', 'TVN review this week; review the treatment plan', 'this_week', 3, 'primary'),
  A('TVN_CASE_REVIEW_THIS_WEEK', 'TVN case review this week', 'this_week', 3, 'primary'),
  A('REVIEW_FOR_INFECTION_THIS_WEEK', 'Review for infection this week', 'this_week', 3, 'primary'),
  A('CONTINUE_PLAN_MEASURE_NEXT_VISIT', 'Continue the plan; measure at the next visit', 'next_visit', 4, 'primary'),
  A('CONTINUE_PLAN_CONSIDER_REDUCED_VISITS', 'Continue the plan; consider reduced visit frequency', 'ongoing', 5, 'primary'),

  // Secondary actions, typically data capture (PRD 9.5, 9.6, 9.7, 9.8, 10)
  A('RECORD_VASCULAR_ASSESSMENT', 'Record a vascular assessment (foot pulses and toe pressure or ABPI)', 'next_visit', 6, 'secondary'),
  A('RECORD_TOE_PRESSURE', 'Obtain a toe pressure', 'next_visit', 6, 'secondary'),
  A('RECORD_ABPI', 'Record an ABPI', 'next_visit', 6, 'secondary'),
  A('WOUND_SWAB_PER_LOCAL_POLICY', 'Wound swab per local policy', 'next_visit', 6, 'secondary'),
  A('CHECK_PRESSURE_RELIEVING_EQUIPMENT', 'Check pressure-relieving equipment and the repositioning plan', 'next_visit', 6, 'secondary'),
  A('REASSESS_AETIOLOGY', 'Reassess aetiology', 'next_visit', 6, 'secondary'),
  A('CONFIRM_AETIOLOGY_AND_ABPI', 'Confirm aetiology and ABPI', 'next_visit', 6, 'secondary'),
  A('REVIEW_ANTIMICROBIALS', 'Review antimicrobials', 'next_visit', 6, 'secondary'),
  A('INCREASE_ASSESSMENT_FREQUENCY', 'Increase assessment frequency', 'next_visit', 6, 'secondary'),
  A('CARE_GOAL_REVIEW', 'Review the care goal (healing or maintenance)', 'next_visit', 6, 'secondary'),
  A('AVOID_COMPRESSION_UNTIL_VASCULAR_REVIEW', 'Avoid compression until vascular review', 'next_visit', 6, 'secondary'),
  A('COMPLETE_LOWER_LIMB_ASSESSMENT', 'Complete a full lower-limb assessment', 'next_visit', 6, 'secondary'),
  A('CONSIDER_BIOPSY_OR_SPECIALIST_OPINION', 'Consider referral for biopsy or specialist opinion if not done', 'next_visit', 6, 'secondary'),
  A('RECORD_MISSING_DATA', 'Record the missing assessment data', 'next_visit', 6, 'secondary'),
  A('MEASURE_AT_NEXT_VISIT', 'Measure at the next visit', 'next_visit', 6, 'secondary'),
];

export const ACTION_BY_CODE: Record<string, ActionDef> = Object.fromEntries(ACTION_LIBRARY.map((a) => [a.code, a]));

export const PRIMARY_ACTION_CODES = ACTION_LIBRARY.filter((a) => a.kind === 'primary').map((a) => a.code);
export const SECONDARY_ACTION_CODES = ACTION_LIBRARY.filter((a) => a.kind === 'secondary').map((a) => a.code);

export const isPrimaryAction = (code: string) => ACTION_BY_CODE[code]?.kind === 'primary';
export const isSecondaryAction = (code: string) => ACTION_BY_CODE[code]?.kind === 'secondary';

// Timeframe a priority band implies, used to check an AI action is not later than the band allows.
export const MAX_URGENCY_FOR_PRIORITY: Record<TVNPriority, number> = {
  'SEE TODAY': 2, // today, or within 1 working day (RF-07)
  'SEE THIS WEEK': 3,
  'MONITOR': 4,
  'HEALING': 5,
};

export const PRIORITY_RANK: Record<TVNPriority, number> = {
  'SEE TODAY': 0,
  'SEE THIS WEEK': 1,
  'MONITOR': 2,
  'HEALING': 3,
};

export const PRIORITY_BY_RANK: TVNPriority[] = ['SEE TODAY', 'SEE THIS WEEK', 'MONITOR', 'HEALING'];

// Wire format used inside the AI prompt and output schema (no spaces).
export const toWirePriority = (p: TVNPriority) => p.replace(/ /g, '_') as 'SEE_TODAY' | 'SEE_THIS_WEEK' | 'MONITOR' | 'HEALING';
export const fromWirePriority = (w: string): TVNPriority | null => {
  const p = w.replace(/_/g, ' ') as TVNPriority;
  return p in PRIORITY_RANK ? p : null;
};
