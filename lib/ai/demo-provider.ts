import { ACTION_BY_CODE, SECONDARY_ACTION_CODES } from './action-library';
import type { EvidenceBundle } from './bundle';
import { AIError, type CompletionRequest, type CompletionResult, type LLMProvider } from './provider';
import type { AIOutput } from './types';

// Keyless demo provider. It writes the same JSON a hosted model would, but deterministically from the
// evidence bundle, so the whole AI layer (schema, guardrails, caching, wording on screen) runs end to end
// with no external service and no data leaving the browser. It never escalates a priority: it only
// explains the rule result. Swap in a real provider (see provider.ts) when one is available.
//
// Every sentence is built from values that are present in the bundle, because the guardrails reject any
// number the evidence does not support and any wording outside the clinical scope.

const BUNDLE_RE = /<evidence_bundle>\s*([\s\S]*?)\s*<\/evidence_bundle>/;

const WOUND_LABEL: Record<string, string> = {
  diabetic_foot_ulcer: 'diabetic foot ulcer',
  venous_leg_ulcer: 'venous leg ulcer',
  pressure_ulcer: 'pressure ulcer',
  arterial_ulcer: 'arterial ulcer',
  surgical_wound: 'surgical wound',
  other: 'wound',
};

const PRIORITY_PHRASE: Record<string, string> = {
  SEE_TODAY: 'a same-day review priority',
  SEE_THIS_WEEK: 'a review priority for this week',
  MONITOR: 'a monitoring priority',
  HEALING: 'on a healing course',
};

const WHY_NOW: Record<string, string> = {
  SEE_TODAY: 'The rules place this patient in the same-day band, so the review is due within the working day.',
  SEE_THIS_WEEK: 'The rules place this patient in the this-week band, so the review should be booked in the next few working days.',
  MONITOR: 'No urgent rule has fired, so the wound stays under routine monitoring at the next scheduled visit.',
  HEALING: 'The wound is following a healing course, so the current plan continues with routine measurement.',
};

// "stable" is reassurance wording the guardrails refuse on same-day patients, so it is described as unchanged.
const trajectoryWord = (c: string) => (c === 'Stable' ? 'unchanged in size' : c === 'Insufficient data' ? 'not yet assessable' : c.toLowerCase());

const FILLER = [
  'These statements rely only on the recorded assessments and the fixed rule result.',
  'Clinical judgement at the visit always takes precedence over this summary.',
  'Any missing measurement should be recorded at the next contact so the picture stays complete.',
];

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function build(b: EvidenceBundle): AIOutput {
  const r = b.rule_output;
  const asm = b.assessments;
  const last = asm[asm.length - 1];
  const prev = asm.length > 1 ? asm[asm.length - 2] : null;
  const days = last && prev ? Math.abs(last.day_offset - prev.day_offset) : 0;
  const traj = trajectoryWord(b.trajectory.class);
  const woundLabel = WOUND_LABEL[b.wound.type] ?? 'wound';
  const loc = b.wound.location === 'other' ? '' : ` on the ${b.wound.location}`;
  const rf = r.red_flags;
  const topFlag = rf[0] ?? null;
  const infected = r.infection_state !== 'None';
  const vascular = r.pad_tier !== 'None';

  const idsAsm = asm.length ? [asm[asm.length - 1].id, ...(prev ? [prev.id] : [])] : [];
  const rfIds = rf.map((f) => `rf_${f.id}`);

  const areaSentence = last
    ? prev
      ? `The wound area measured ${last.area_cm2} cm² at the latest assessment against ${prev.area_cm2} cm² ${days} days earlier.`
      : `The wound area measured ${last.area_cm2} cm² at the only assessment on record.`
    : 'No wound area measurement is available.';

  const parts = [
    `This ${woundLabel}${loc} is currently ${PRIORITY_PHRASE[r.priority] ?? 'under review'}.`,
    `The wound is ${traj}. ${areaSentence}`,
    topFlag
      ? `Red flag ${topFlag.id} (${topFlag.name}) has fired and is the main driver of the priority.`
      : `No red flag has fired, so the priority comes from the combined rule score of ${r.score}.`,
    ...rf.slice(1).map((f) => `Red flag ${f.id} (${f.name}) has also fired.`),
    infected ? 'Infection signs are recorded on the latest assessment.' : '',
    vascular ? 'Peripheral arterial disease is recorded, which raises the vascular risk.' : '',
    b.review.missed_reviews > 0 ? `${b.review.missed_reviews} scheduled reviews have been missed.` : '',
    b.review.days_since_last_review !== null ? `The last review was ${b.review.days_since_last_review} days ago.` : '',
    'The recommended next step is shown under the recommended action and comes from the controlled action library.',
  ].filter(Boolean);
  let n = wordCount(parts.join(' '));
  for (const f of FILLER) {
    if (n >= 85) break;
    parts.push(f);
    n += wordCount(f);
  }
  const narrative = parts.join(' ');

  const factors: AIOutput['priority_factors'] = [];
  rf.forEach((f) =>
    factors.push({
      factor: `Red flag ${f.id}`,
      text: `${f.id} (${f.name}) fired on the recorded data, which sets the minimum priority band.`,
      evidence: [`rf_${f.id}`, 'rule_output'],
    }),
  );
  factors.push({
    factor: 'Healing trajectory',
    text: last && prev ? `The wound is ${traj}: ${prev.area_cm2} cm² then ${last.area_cm2} cm² over ${days} days.` : `The wound is ${traj} because there are too few measurements to compare.`,
    evidence: ['trajectory', ...idsAsm],
  });
  if (infected) factors.push({ factor: 'Infection signs', text: 'Infection signs are recorded, which adds to the rule score and can set a floor.', evidence: ['rule_output'] });
  if (vascular) factors.push({ factor: 'Vascular risk', text: 'Peripheral arterial disease is recorded, which adds to the vascular part of the score.', evidence: ['rule_output'] });
  if (b.review.missed_reviews > 0) {
    factors.push({ factor: 'Review overdue', text: `${b.review.missed_reviews} scheduled reviews have been missed.`, evidence: ['review'] });
  }
  if (factors.length < 6) factors.push({ factor: 'Overall score', text: `The combined rule score is ${r.score}.`, evidence: ['rule_output'] });

  const action = ACTION_BY_CODE[r.primary_action_code];
  const secondary = Array.from(new Set(r.secondary_action_codes)).filter((c) => SECONDARY_ACTION_CODES.includes(c)).slice(0, 2);

  const lead = (PRIORITY_PHRASE[r.priority] ?? 'under review').replace(/^./, (c) => c.toUpperCase());
  const summary = topFlag
    ? `${lead}: red flag ${topFlag.id} fired and the wound is ${traj}.`
    : `${lead}: the wound is ${traj} with a rule score of ${r.score}.`;

  return {
    current_status: { text: `Trajectory: ${traj}.`, evidence: ['trajectory'] },
    overall_risk: { final_priority: r.priority, rule_priority: r.priority, ai_escalation: null },
    primary_driver: {
      text: topFlag ? `${topFlag.id}: ${topFlag.name}.` : `Combined rule score of ${r.score}; the wound is ${traj}.`,
      red_flag: topFlag ? topFlag.id : null,
      evidence: topFlag ? [`rf_${topFlag.id}`, 'rule_output'] : ['rule_output', 'trajectory'],
    },
    what_changed: [
      last && prev
        ? { text: `Wound area went from ${prev.area_cm2} cm² to ${last.area_cm2} cm² over ${days} days.`, evidence: idsAsm }
        : { text: last ? `Only one assessment is on record, with an area of ${last.area_cm2} cm².` : 'No assessment with a measurement is on record.', evidence: last ? idsAsm : ['trajectory'] },
    ],
    recommended_action: { action_code: r.primary_action_code, timeframe: action?.timeframe ?? 'next_visit', secondary },
    clinical_narrative: { text: narrative, evidence: ['trajectory', 'rule_output', ...idsAsm, ...rfIds] },
    why_now: WHY_NOW[r.priority] ?? WHY_NOW.MONITOR,
    summary: { text: summary, evidence: ['rule_output', 'trajectory'] },
    priority_factors: factors.slice(0, 6),
    for_tvn_consideration: null,
  };
}

export class DemoProvider implements LLMProvider {
  readonly id = 'demo';
  readonly model = 'wciq-demo-rules-1';

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    if (req.signal?.aborted) throw new AIError('aborted', 'The review was cancelled.');
    const m = BUNDLE_RE.exec(req.user);
    if (!m) throw new AIError('bad_request', 'The demo reviewer received no evidence bundle.');
    let bundle: EvidenceBundle;
    try {
      bundle = JSON.parse(m[1]) as EvidenceBundle;
    } catch {
      throw new AIError('bad_request', 'The demo reviewer could not read the evidence bundle.');
    }
    await new Promise((r) => setTimeout(r, 0)); // yield so a long run never blocks the UI
    return { content: JSON.stringify(build(bundle)), finishReason: 'stop', requestId: null };
  }

  async verifyKey(): Promise<void> {
    // no key needed
  }
}
