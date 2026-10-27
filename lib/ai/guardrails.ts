import type { TVNPriority } from '../pilot-types';
import { ACTION_BY_CODE, MAX_URGENCY_FOR_PRIORITY, PRIMARY_ACTION_CODES, PRIORITY_RANK, SECONDARY_ACTION_CODES, fromWirePriority, toWirePriority } from './action-library';
import { allowedEvidenceIds, type EvidenceBundle } from './bundle';
import type { AIOutput, GuardrailViolation } from './types';

// The guardrail validator (PRD 11.6.6). Every AI output is checked against the data and the rules; one
// breach rejects it and the rule-based explanation is shown instead. The priority is never held by the AI:
// the result of this function is `final = higher of (rule priority, validated escalation)`.

export interface GuardrailContext {
  bundle: EvidenceBundle;
  rulePriority: TVNPriority;
  rulePrimaryActionCode: string;
}

export interface GuardrailResult {
  ok: boolean;
  violations: GuardrailViolation[];
  warnings: string[];
  finalPriority: TVNPriority;
  escalation: null | { to: TVNPriority; reason: string; evidence: string[] };
}

// ─── scope / language deny-lists ─────────────────────────────────────────────

// No dressing, drug or dose may be named (PRD 11.6.1 #5, 11.6.6 Scope).
const DRUG_OR_DRESSING = /\b(dressings?|hydrocolloid\w*|alginate\w*|hydrogel\w*|hydrofibre|foam|silver|iodine|honey|cadexomer|gauze|bandages?|mg|mcg|ml|doses?|tablets?|capsules?|amoxicillin|flucloxacillin|clarithromycin|doxycycline|co-?amoxiclav|metronidazole|ciprofloxacin|gentamicin|vancomycin|trimethoprim|paracetamol|ibuprofen|morphine|opioids?|enoxaparin|heparin|warfarin|insulin|steroids?|antibiotics?)\b/i;

// No diagnosis that is absent from the data (conditions this data source cannot establish).
const UNSUPPORTED_DIAGNOSIS = /\b(osteomyelitis|gangrene|gangrenous|necrosis|necrotic|cellulitis|malignan\w*|carcinoma|cancer|sepsis|septic|ischaemia|ischemia|thrombosis|dvt|abscess|biofilm)\b/i;

// No outcome prediction (PRD 11.1 #4).
const PREDICTION = /\b(amputat\w*|limb[- ]loss|likely to|will (?:heal|deteriorate|worsen|die|improve)|prognos\w*|predict\w*|expected to (?:heal|deteriorate)|going to)\b/i;

// No reassurance wording on SEE TODAY patients (PRD 11.6.6 Language).
const REASSURANCE = /\b(reassur\w*|stable|no concern\w*|nothing to worry|low risk|safe to wait|can wait|minor)\b/i;

// Markup, links or code in a clinical narrative are never legitimate.
const UNSAFE_MARKUP = /<[^>]*>|\]\(|https?:\/\/|`{1,3}|javascript:/i;

// ─── helpers ─────────────────────────────────────────────────────────────────

const safeId = (s: string) => (/^[A-Za-z0-9_\-]{1,24}$/.test(s) ? s : '[invalid id]');

function allTexts(o: AIOutput): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = [
    { field: 'current_status', text: o.current_status.text },
    { field: 'primary_driver', text: o.primary_driver.text },
    { field: 'clinical_narrative', text: o.clinical_narrative.text },
    { field: 'why_now', text: o.why_now },
    { field: 'summary', text: o.summary.text },
  ];
  o.priority_factors.forEach((f, i) => out.push({ field: `priority_factors[${i}]`, text: `${f.factor}. ${f.text}` }));
  o.what_changed.forEach((w, i) => out.push({ field: `what_changed[${i}]`, text: w.text }));
  if (o.for_tvn_consideration) out.push({ field: 'for_tvn_consideration', text: o.for_tvn_consideration });
  if (o.overall_risk.ai_escalation) out.push({ field: 'ai_escalation.reason', text: o.overall_risk.ai_escalation.reason });
  return out;
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// Strips evidence IDs and red-flag IDs so their digits are not mistaken for clinical numbers.
function stripIds(s: string): string {
  return s.replace(/\basm_\d+\b/gi, ' ').replace(/\brf_RF-\d+\b/gi, ' ').replace(/\bRF-\d+\b/gi, ' ');
}

function numbersIn(s: string): number[] {
  const m = stripIds(s).match(/\d+(?:\.\d+)?/g) ?? [];
  return m.map(Number);
}

// Every figure the bundle supports: recorded values, values derived from them, and the fixed rule constants.
export function groundingNumbers(b: EvidenceBundle): number[] {
  const set: number[] = [];
  const add = (n: number | null | undefined) => {
    if (n === null || n === undefined || !isFinite(n)) return;
    set.push(Math.abs(n));
  };

  const a = b.assessments;
  a.forEach((x) => {
    add(x.area_cm2);
    add(x.length_cm);
    add(x.width_cm);
    add(x.day_offset);
    add(Math.round(Math.abs(x.day_offset) / 7));
  });
  add(a.length);

  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const days = Math.abs(a[j].day_offset - a[i].day_offset);
      add(days);
      add(Math.round(days / 7));
      add(Math.round(days / 7 + 0.0001));
      if (a[i].area_cm2 > 0) {
        const pct = ((a[j].area_cm2 - a[i].area_cm2) / a[i].area_cm2) * 100;
        add(pct);
        add(Math.round(pct));
        add(Math.round(pct * 10) / 10);
      }
      if (a[j].area_cm2 > 0) {
        const pct = ((a[i].area_cm2 - a[j].area_cm2) / a[j].area_cm2) * 100;
        add(pct);
        add(Math.round(pct));
      }
    }
  }

  b.trajectory.windows.forEach((w) => {
    add(w.weeks);
    add(w.par_pct);
    if (w.par_pct !== null) add(Math.round(w.par_pct));
  });
  add(b.chronicity.days);
  add(Math.round(b.chronicity.days / 7));
  add(b.review.missed_reviews);
  add(b.review.days_since_last_review);
  add(b.wound.pressure_category);
  b.patient.age_band.match(/\d+/g)?.forEach((n) => add(Number(n)));

  const r = b.rule_output;
  add(r.score);
  add(r.confidence.score);
  Object.values(r.components).forEach((v) => add(v));
  add(r.red_flags.length);

  // Fixed rule constants from the PRD (thresholds, windows, benchmarks, timeframes).
  [0.5, 1, 2, 3, 4, 6, 7, 8, 10, 12, 14, 20, 24, 25, 28, 30, 40, 50, 60, 65, 72, 75, 80, 90, 180, 365].forEach((n) => add(n));
  return set;
}

function matchesNumber(n: number, allowed: number[]): boolean {
  return allowed.some((x) => Math.abs(x - n) <= 0.051 || (Number.isInteger(n) && Math.abs(Math.round(x) - n) === 0));
}

function dedupe(ids: string[]): string[] {
  return ids.filter((x, i) => ids.indexOf(x) === i);
}

// ─── the validator ───────────────────────────────────────────────────────────

export function validateAIOutput(o: AIOutput, ctx: GuardrailContext): GuardrailResult {
  const v: GuardrailViolation[] = [];
  const warnings: string[] = [];
  const rule = ctx.rulePriority;
  const ruleRank = PRIORITY_RANK[rule];
  const allowedIds = allowedEvidenceIds(ctx.bundle);

  // 1. Priority floor + escalation limit (AI-02, AI-03)
  if (o.overall_risk.rule_priority !== toWirePriority(rule)) {
    v.push({ check: 'priority_floor', detail: 'rule_priority must be copied exactly from rule_output.priority' });
  }
  const claimedFinal = fromWirePriority(o.overall_risk.final_priority);
  if (!claimedFinal) v.push({ check: 'priority_floor', detail: 'final_priority is not a valid band' });

  let finalPriority: TVNPriority = rule;
  let escalation: GuardrailResult['escalation'] = null;
  const esc = o.overall_risk.ai_escalation;

  if (claimedFinal && PRIORITY_RANK[claimedFinal] > ruleRank) {
    v.push({ check: 'priority_floor', detail: 'final_priority is lower than the rule priority; the floor is absolute' });
  }

  if (!esc) {
    if (claimedFinal && claimedFinal !== rule) {
      v.push({ check: 'priority_floor', detail: 'final_priority differs from rule_priority but ai_escalation is null' });
    }
  } else {
    const to = fromWirePriority(esc.to_priority);
    const evidenceOk = dedupe(esc.evidence).filter((id) => allowedIds.includes(id));
    if (!to) {
      v.push({ check: 'escalation_limit', detail: 'ai_escalation.to_priority is not a valid band' });
    } else if (claimedFinal && claimedFinal !== to) {
      v.push({ check: 'priority_floor', detail: 'final_priority must equal ai_escalation.to_priority when escalating' });
    } else if (ruleRank - PRIORITY_RANK[to] !== 1) {
      warnings.push('Escalation removed: it was not exactly one band above the rule priority.');
    } else if (evidenceOk.length < 2) {
      warnings.push('Escalation removed: fewer than two valid evidence items were cited.');
    } else if (esc.reason.trim().length < 15) {
      warnings.push('Escalation removed: no specific reason was given.');
    } else {
      finalPriority = to;
      escalation = { to, reason: esc.reason.trim(), evidence: evidenceOk };
    }
  }

  // 2. Evidence existence + citation coverage
  const cites: { field: string; ids: string[] }[] = [
    { field: 'current_status', ids: o.current_status.evidence },
    { field: 'primary_driver', ids: o.primary_driver.evidence },
    { field: 'clinical_narrative', ids: o.clinical_narrative.evidence },
    ...o.what_changed.map((w, i) => ({ field: `what_changed[${i}]`, ids: w.evidence })),
    { field: 'summary', ids: o.summary.evidence },
    ...o.priority_factors.map((f, i) => ({ field: `priority_factors[${i}]`, ids: f.evidence })),
  ];
  cites.forEach((c) => {
    if (c.ids.length === 0) v.push({ check: 'citation_coverage', detail: `${c.field} cites no evidence` });
    c.ids.forEach((id) => {
      if (!allowedIds.includes(id)) v.push({ check: 'grounding', detail: `${c.field} cites unknown evidence id ${safeId(id)}` });
    });
  });

  // 3. Red-flag consistency
  const fired = ctx.bundle.rule_output.red_flags;
  const haystack = `${o.primary_driver.text} ${o.clinical_narrative.text} ${o.primary_driver.red_flag ?? ''}`.toLowerCase();
  const factorText = o.priority_factors.map((f) => `${f.factor} ${f.text}`).join(' ').toLowerCase();
  fired.forEach((f) => {
    const named = haystack.includes(f.id.toLowerCase()) || haystack.includes(f.name.toLowerCase());
    if (!named) v.push({ check: 'red_flag_consistency', detail: `fired red flag ${f.id} must be named in primary_driver or the narrative` });
  });
  fired.forEach((f) => {
    if (!factorText.includes(f.id.toLowerCase()) && !factorText.includes(f.name.toLowerCase())) {
      v.push({ check: 'red_flag_consistency', detail: `fired red flag ${f.id} must be explained in priority_factors` });
    }
  });
  if (fired.length > 0 && !fired.some((f) => f.id === o.primary_driver.red_flag)) {
    v.push({ check: 'red_flag_consistency', detail: 'primary_driver.red_flag must be one of the fired red flags' });
  }
  if (fired.length === 0 && o.primary_driver.red_flag !== null) {
    v.push({ check: 'red_flag_consistency', detail: 'primary_driver.red_flag must be null because no red flag fired' });
  }

  // 4. Action library + not later than the rule action
  const act = o.recommended_action;
  const def = ACTION_BY_CODE[act.action_code];
  const ruleDef = ACTION_BY_CODE[ctx.rulePrimaryActionCode];
  if (!def || !PRIMARY_ACTION_CODES.includes(act.action_code)) {
    v.push({ check: 'action_library', detail: 'action_code is not a primary action in the library' });
  } else {
    if (act.timeframe !== def.timeframe) v.push({ check: 'action_library', detail: `timeframe must be "${def.timeframe}" for ${act.action_code}` });
    if (ruleDef && def.urgency > ruleDef.urgency) {
      v.push({ check: 'action_library', detail: 'action must be at least as urgent as the rule action' });
    }
    if (def.urgency > MAX_URGENCY_FOR_PRIORITY[finalPriority]) {
      v.push({ check: 'action_library', detail: 'action is too late for the final priority band' });
    }
  }
  const secondary = act.secondary;
  if (secondary.length !== dedupe(secondary).length) v.push({ check: 'action_library', detail: 'secondary actions contain duplicates' });
  secondary.forEach((c) => {
    if (!SECONDARY_ACTION_CODES.includes(c)) v.push({ check: 'action_library', detail: `secondary action ${c.slice(0, 40)} is not in the library` });
  });

  // 5. Scope, markup, reassurance
  const texts = allTexts(o);
  texts.forEach(({ field, text }) => {
    if (DRUG_OR_DRESSING.test(text)) v.push({ check: 'scope', detail: `${field} names a dressing, drug, dose or product` });
    if (UNSUPPORTED_DIAGNOSIS.test(text)) v.push({ check: 'scope', detail: `${field} introduces a diagnosis that is not in the data` });
    if (PREDICTION.test(text)) v.push({ check: 'scope', detail: `${field} predicts an outcome` });
    if (UNSAFE_MARKUP.test(text)) v.push({ check: 'scope', detail: `${field} contains markup, a link or code` });
    if (finalPriority === 'SEE TODAY' && REASSURANCE.test(text)) v.push({ check: 'language', detail: `${field} uses reassurance wording for a SEE TODAY patient` });
  });

  // 6. Language: 80 to 150 words
  const words = wordCount(o.clinical_narrative.text);
  if (words < 80 || words > 150) v.push({ check: 'language', detail: `clinical_narrative has ${words} words; it must be 80 to 150` });

  // 7. Grounding of numbers
  const allowed = groundingNumbers(ctx.bundle);
  const reported = new Set<string>();
  texts.forEach(({ field, text }) => {
    numbersIn(text).forEach((n) => {
      if (!matchesNumber(n, allowed) && !reported.has(String(n))) {
        reported.add(String(n));
        v.push({ check: 'grounding', detail: `${field}: the number ${n} is not supported by the evidence` });
      }
    });
  });

  return { ok: v.length === 0, violations: v, warnings, finalPriority: v.length === 0 ? finalPriority : rule, escalation: v.length === 0 ? escalation : null };
}
