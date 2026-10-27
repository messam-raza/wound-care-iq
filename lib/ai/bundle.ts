import type { PilotPatient, TVNPriority } from '../pilot-types';
import { BUNDLE_SCHEMA_VERSION } from './config';
import { toWirePriority } from './action-library';

// The deterministic wound-journey bundle builder (PRD 11.6.2).
//
// This is the privacy boundary. The model is only ever shown what this file builds, and it builds from an
// allow-list: no name, NHS number, patient or clinician identifier, facility name, absolute date or free
// text leaves the browser. Free-text CSV fields (wound type, location) are reduced to fixed categories, so
// a malicious cell can never smuggle instructions into the prompt.

// Structural snapshot of the rule engine's output. PrdRuleResult from lib/prd-engine.ts satisfies it.
export interface RuleSnapshot {
  rulesetVersion: string;
  asOf: string;
  priority: TVNPriority;
  score: number;
  components: { severity: number; trajectory: number; infection: number; vascular: number; chronicity: number; risk: number };
  trajectory: string;
  windows: { weeks: number; parPct: number | null; valid: boolean; interpolated: boolean }[];
  redFlags: { id: string; name: string; trigger: string; actionCode: string }[];
  floors: string[];
  notEvaluable: { id: string; reason: string }[];
  infectionState: string;
  padTier: string;
  chronicityDays: number;
  chronicityEstimated: boolean;
  primaryDriver: string;
  supportingFactors: string[];
  primaryActionCode: string;
  secondaryActionCodes: string[];
  confidence: { level: string; score: number; limitingFactors: string[] };
  dataGaps: string[];
}

export type WoundTypeCategory = 'diabetic_foot_ulcer' | 'venous_leg_ulcer' | 'pressure_ulcer' | 'arterial_ulcer' | 'surgical_wound' | 'other';

export interface EvidenceBundle {
  schema: string;
  patient: { age_band: string; sex: 'F' | 'M' | 'unknown'; care_setting: 'care_home' | 'community' | 'unknown' };
  wound: {
    type: WoundTypeCategory;
    location: string;
    pressure_category: number | null;
    diabetes_recorded: boolean;
    pad_recorded: boolean;
    infection_signs_recorded: boolean;
  };
  assessments: { id: string; day_offset: number; area_cm2: number; length_cm: number | null; width_cm: number | null; depth_cm: number | null }[];
  review: { id: string; missed_reviews: number; days_since_last_review: number | null };
  chronicity: { id: string; days: number; estimated: boolean };
  trajectory: { id: string; class: string; windows: { weeks: number; par_pct: number | null; valid: boolean; interpolated: boolean }[] };
  rule_output: {
    id: string;
    fixed: true;
    priority: string;
    score: number;
    components: RuleSnapshot['components'];
    red_flags: { id: string; name: string; trigger: string }[];
    floors: string[];
    not_evaluable: { id: string; reason: string }[];
    infection_state: string;
    pad_tier: string;
    primary_driver: string;
    supporting_factors: string[];
    primary_action_code: string;
    secondary_action_codes: string[];
    confidence: { level: string; score: number; limiting_factors: string[] };
    data_gaps: string[];
  };
}

const DAY_MS = 86_400_000;

function utcDay(iso: string): number | null {
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.floor(t / DAY_MS);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ageBand(age: number): string {
  if (!age || age < 0) return 'unknown';
  if (age < 18) return 'under_18';
  if (age < 40) return '18-39';
  if (age < 60) return '40-59';
  if (age < 70) return '60-69';
  if (age < 80) return '70-79';
  if (age < 90) return '80-89';
  return '90_plus';
}

export function woundTypeCategory(text: string): WoundTypeCategory {
  const t = (text || '').toLowerCase();
  if (/diabetic|\bdfu\b|foot ulcer/.test(t)) return 'diabetic_foot_ulcer';
  if (/pressure|\bpi\b|decubitus|bed ?sore/.test(t)) return 'pressure_ulcer';
  if (/venous|\bvlu\b|leg ulcer/.test(t)) return 'venous_leg_ulcer';
  if (/arterial|ischaemic|ischemic|mixed/.test(t)) return 'arterial_ulcer';
  if (/surgical|dehisc|post-?op/.test(t)) return 'surgical_wound';
  return 'other';
}

// Fixed location vocabulary. Anything outside it becomes 'other', so free text is never forwarded.
const LOCATIONS = ['sacrum', 'heel', 'toe', 'foot', 'ankle', 'leg', 'hip', 'trochanter', 'buttock', 'abdomen', 'malleolus', 'dorsum'];
export function locationCategory(text: string): string {
  const t = (text || '').toLowerCase();
  return LOCATIONS.find((l) => t.includes(l)) ?? 'other';
}

function careSetting(facility: string): 'care_home' | 'community' | 'unknown' {
  const t = (facility || '').toLowerCase();
  if (!t || t === 'unknown facility') return 'unknown';
  return /care home|nursing|residential/.test(t) ? 'care_home' : 'community';
}

export function buildEvidenceBundle(p: PilotPatient, rule: RuleSnapshot): EvidenceBundle {
  const asOfDay = utcDay(rule.asOf);

  const dated = p.assessments
    .map((a) => ({ a, day: utcDay(a.date) }))
    .filter((x): x is { a: (typeof p.assessments)[number]; day: number } => x.day !== null && asOfDay !== null)
    .sort((x, y) => x.day - y.day || x.a.surfaceArea - y.a.surfaceArea)
    .filter((x) => x.day - (asOfDay as number) >= -365);

  const assessments = dated.map((x, i) => ({
    id: `asm_${i + 1}`,
    day_offset: x.day - (asOfDay as number),
    area_cm2: round2(x.a.surfaceArea),
    length_cm: x.a.length > 0 ? round2(x.a.length) : null,
    width_cm: x.a.width > 0 ? round2(x.a.width) : null,
    depth_cm: null as number | null,
  }));

  return {
    schema: BUNDLE_SCHEMA_VERSION,
    patient: {
      age_band: ageBand(p.age),
      sex: p.gender === 'F' || p.gender === 'M' ? p.gender : 'unknown',
      care_setting: careSetting(p.facility),
    },
    wound: {
      type: woundTypeCategory(p.woundType),
      location: locationCategory(p.woundLocation),
      pressure_category: p.isPressureInjury && p.pressureStage > 0 ? p.pressureStage : null,
      diabetes_recorded: p.diabetes,
      pad_recorded: p.pad,
      infection_signs_recorded: p.infectionSigns,
    },
    assessments,
    review: {
      id: 'review',
      missed_reviews: p.missedReviews,
      days_since_last_review: p.lastReviewDate && asOfDay !== null ? Math.max(0, asOfDay - (utcDay(p.lastReviewDate) ?? asOfDay)) : null,
    },
    chronicity: { id: 'chronicity', days: rule.chronicityDays, estimated: rule.chronicityEstimated },
    trajectory: {
      id: 'trajectory',
      class: rule.trajectory,
      windows: rule.windows.map((w) => ({ weeks: w.weeks, par_pct: w.parPct === null ? null : round2(w.parPct), valid: w.valid, interpolated: w.interpolated })),
    },
    rule_output: {
      id: 'rule_output',
      fixed: true,
      priority: toWirePriority(rule.priority),
      score: rule.score,
      components: rule.components,
      red_flags: rule.redFlags.map((f) => ({ id: f.id, name: f.name, trigger: f.trigger })),
      floors: rule.floors,
      not_evaluable: rule.notEvaluable,
      infection_state: rule.infectionState,
      pad_tier: rule.padTier,
      primary_driver: rule.primaryDriver,
      supporting_factors: rule.supportingFactors,
      primary_action_code: rule.primaryActionCode,
      secondary_action_codes: rule.secondaryActionCodes,
      confidence: { level: rule.confidence.level, score: rule.confidence.score, limiting_factors: rule.confidence.limitingFactors },
      data_gaps: rule.dataGaps,
    },
  };
}

// Every evidence ID the model is allowed to cite for this bundle.
export function allowedEvidenceIds(b: EvidenceBundle): string[] {
  return [
    ...b.assessments.map((a) => a.id),
    'review',
    'chronicity',
    'trajectory',
    'rule_output',
    ...b.rule_output.red_flags.map((f) => `rf_${f.id}`),
  ];
}
