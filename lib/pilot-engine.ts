import type {
  PilotPatient,
  PilotRiskLevel,
  PilotUploadSummary,
  PilotFacilitySummary,
  PilotWoundAssessment,
  TVNPriority,
  ClinicalConfidence,
  CurrentStatus,
  OverallClinicalRisk,
  FlaggedReasonItem,
  RiskDriver,
  DataQualityIssue,
  ClinicalReasoning,
} from './pilot-types';
import type { RawRow, ColumnMapping, ImportedPatient } from './import-types';
import { evaluatePrdRules, type PrdRuleResult } from './prd-engine';
import { ACTION_BY_CODE } from './ai/action-library';
import {
  parseCSV,
  suggestMappings,
  transformRows,
  generateTemplateCSV,
} from './import-engine';

// ─── Upload Parsing ──────────────────────────────────────────────────────────

export { parseCSV, suggestMappings, generateTemplateCSV };

export function detectFileType(fileName: string): 'CSV' | 'Excel' | 'XLSX' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx')) return 'XLSX';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsm')) return 'Excel';
  return 'CSV';
}

export function parseUploadedFile(fileName: string, text: string): { headers: string[]; rows: RawRow[] } {
  const fileType = detectFileType(fileName);
  if (fileType === 'CSV') {
    return parseCSV(text);
  }
  try {
    return parseCSV(text);
  } catch {
    return { headers: [], rows: [] };
  }
}

// ─── Patient Consolidation Engine ───────────────────────────────────────────
//
// TVNs manage patients, not assessments. When a CSV contains multiple rows for
// the same patient (longitudinal assessment history), we group them by patient
// ID and build one consolidated record per patient. The full assessment history
// drives healing trajectory, deterioration trend, risk scoring, and clinical
// confidence — but the priority list shows exactly ONE entry per patient.

function groupByPatientId(imported: ImportedPatient[]): Map<string, ImportedPatient[]> {
  const groups = new Map<string, ImportedPatient[]>();
  for (const p of imported) {
    const key = p.id;
    const list = groups.get(key) || [];
    list.push(p);
    groups.set(key, list);
  }
  return groups;
}

function sortByDateAsc(patients: ImportedPatient[]): ImportedPatient[] {
  return [...patients].sort((a, b) => {
    const ta = a.assessmentDate ? new Date(a.assessmentDate).getTime() : 0;
    const tb = b.assessmentDate ? new Date(b.assessmentDate).getTime() : 0;
    return ta - tb;
  });
}

function buildAssessmentHistory(sorted: ImportedPatient[]): PilotWoundAssessment[] {
  return sorted.map((p) => ({
    date: p.assessmentDate,
    surfaceArea: p.surfaceArea,
    length: p.length,
    width: p.width,
    infectionSigns: p.infectionSigns,
    notes: '',
  }));
}

export function runPilotImport(
  fileName: string,
  headers: string[],
  rows: RawRow[],
  customMappings?: ColumnMapping[],
): { patients: PilotPatient[]; summary: PilotUploadSummary } {
  const mappings: ColumnMapping[] = customMappings ?? suggestMappings(headers);
  const imported: ImportedPatient[] = transformRows(rows, mappings);

  // ── Consolidation: group all CSV rows by patient ID ──
  const groups = groupByPatientId(imported);
  const patients: PilotPatient[] = [];
  const asOf = imported.map((x) => x.assessmentDate).filter(Boolean).sort().pop() ?? '';

  for (const [, group] of Array.from(groups.entries())) {
    const sorted = sortByDateAsc(group);
    const assessmentHistory = buildAssessmentHistory(sorted);
    const latest = sorted[sorted.length - 1];
    const consolidated = applyRuleFloor(convertToPilotPatient(latest, assessmentHistory, asOf), asOf);
    patients.push(consolidated);
  }

  const facilities = new Set(patients.map((p) => p.facility));
  const allDates = imported
    .map((p) => p.assessmentDate)
    .filter(Boolean)
    .sort();

  const summary: PilotUploadSummary = {
    fileName,
    fileType: detectFileType(fileName),
    totalRecords: imported.length,
    uniquePatients: patients.length,
    assessmentsAnalysed: imported.length,
    patientsImported: patients.length,
    woundsImported: patients.length,
    facilitiesImported: facilities.size,
    dateRangeStart: allDates[0] || '',
    dateRangeEnd: allDates[allDates.length - 1] || '',
  };

  return { patients, summary };
}

// ─── PRD rule floor ──────────────────────────────────────────────────────────
//
// The deterministic PRD rule engine (lib/prd-engine.ts) decides the priority. This step copies its result
// onto the patient, replacing the earlier heuristic priority fields, so every screen shows rule-based values
// that are reproducible from the data. An AI escalation can later raise tvnPriority by one band; rulePriority
// always keeps the rule result.

const REVIEW_TIME: Record<TVNPriority, string> = {
  'SEE TODAY': 'Same working day',
  'SEE THIS WEEK': 'Within 5 working days',
  'MONITOR': 'Next scheduled visit',
  'HEALING': 'Next scheduled visit',
};

export const RISK_LEVEL_FOR: Record<TVNPriority, PilotRiskLevel> = {
  'SEE TODAY': 'CRITICAL',
  'SEE THIS WEEK': 'RED',
  'MONITOR': 'AMBER',
  'HEALING': 'GREEN',
};

export const CLINICAL_RISK_FOR: Record<TVNPriority, OverallClinicalRisk> = {
  'SEE TODAY': 'Very High',
  'SEE THIS WEEK': 'High',
  'MONITOR': 'Moderate',
  'HEALING': 'Low',
};

function statusFromTrajectory(c: PrdRuleResult['trajectory']): CurrentStatus {
  if (c === 'Repeated Deterioration' || c === 'Deteriorating') return 'Deteriorating';
  if (c === 'Delayed Healing') return 'Delayed Healing';
  if (c === 'Improving') return 'Improving';
  return 'Stable';
}

function actionText(r: PrdRuleResult): string {
  const primary = ACTION_BY_CODE[r.primaryActionCode]?.label ?? r.primaryActionCode;
  const secondary = r.secondaryActionCodes.map((c) => ACTION_BY_CODE[c]?.label ?? c);
  return secondary.length > 0 ? `${primary}. Also: ${secondary.join('; ')}.` : `${primary}.`;
}

export function applyRuleFloor(p: PilotPatient, asOf: string): PilotPatient {
  const r = evaluatePrdRules(p, asOf || undefined);
  const status = statusFromTrajectory(r.trajectory);
  const labels: [string, number, string][] = [
    ['Wound severity', r.components.severity, 'Wound type and category'],
    ['Trajectory', r.components.trajectory, `Healing trajectory: ${r.trajectory}`],
    ['Infection', r.components.infection, `Infection state: ${r.infectionState}`],
    ['Vascular and diabetes', r.components.vascular, `PAD tier: ${r.padTier}`],
    ['Chronicity', r.components.chronicity, `Open about ${r.chronicityDays} days${r.chronicityEstimated ? ' (estimated from the first assessment)' : ''}`],
  ];
  const top = Math.max(...labels.map((l) => l[1]));
  const riskDrivers: RiskDriver[] = labels
    .filter((l) => l[1] > 0)
    .map(([factor, points, clinicalNote]) => ({ factor, points, clinicalNote, isPrimary: points === top && r.redFlags.length === 0 }));

  const flaggedReasons: FlaggedReasonItem[] = [
    { reason: r.primaryDriver, severity: r.priority === 'SEE TODAY' ? 'critical' : r.priority === 'SEE THIS WEEK' ? 'warning' : 'info' },
    ...r.supportingFactors.map((f): FlaggedReasonItem => ({ reason: f, severity: 'warning' })),
  ];

  const recommendedAction = actionText(r);
  const expectedReviewTime = REVIEW_TIME[r.priority];
  const improvingButUrgent = status === 'Improving' && (r.priority === 'SEE TODAY' || r.priority === 'SEE THIS WEEK');

  return {
    ...p,
    tvnPriority: r.priority,
    rulePriority: r.priority,
    ruleResult: r,
    aiRaised: false,
    riskScore: r.score,
    riskLevel: RISK_LEVEL_FOR[r.priority],
    overallClinicalRisk: CLINICAL_RISK_FOR[r.priority],
    currentStatus: status,
    healingTrend: r.trajectory === 'Improving' ? 'Improving' : r.trajectory === 'Deteriorating' || r.trajectory === 'Repeated Deterioration' ? 'Deteriorating' : 'Stalled',
    repeatedDeterioration: r.trajectory === 'Repeated Deterioration',
    failureToHeal: r.trajectory === 'Delayed Healing',
    expectedReviewTime,
    recommendedAction,
    clinicalConfidence: r.confidence.level,
    confidenceReasons: [`Confidence score ${r.confidence.score}/100`, ...r.confidence.limitingFactors],
    riskDrivers,
    flaggedReasons,
    flaggedReason: flaggedReasons.map((f) => f.reason).join('; '),
    tvnRationale: `${r.priority}${r.redFlags.length ? ` (red flag ${r.redFlags.map((f) => f.id).join(', ')})` : ''}, score ${r.score}/100. ${r.primaryDriver}${r.supportingFactors.length ? `. ${r.supportingFactors.join('. ')}` : ''}.${r.floors.length ? ` Floor applied: ${r.floors.join(', ')}.` : ''} Ruleset ${r.rulesetVersion}.`,
    clinicalReasoning: {
      primaryDriver: r.primaryDriver,
      secondaryDrivers: r.supportingFactors,
      recommendedAction,
      expectedReviewTime,
      woundImprovingButHighRisk: improvingButUrgent,
      highRiskReasons: improvingButUrgent ? [r.primaryDriver] : [],
      contradictionResolved: false,
      contradictionNote: null,
      currentStatus: status,
      overallClinicalRisk: CLINICAL_RISK_FOR[r.priority],
    },
  };
}

// ─── Clinical Risk Weighting Engine ──────────────────────────────────────────
//
// Weights are designed to mirror how an experienced TVN thinks:
//   - Chronicity, PAD, DFU, pressure injury severity, and deterioration
//     patterns dominate the score.
//   - Review overdue and simple infection flags are supporting factors
//     only — they never dominate prioritization.
//   - Every point is traceable via the RiskDriver array.

interface ClinicalFactors {
  infectionIndicators: boolean;
  isDiabeticFootUlcer: boolean;
  pad: boolean;
  pressureStage: number;
  isPressureInjury: boolean;
  daysOpen: number;
  woundGrowthPct: number;
  reviewOverdue: boolean;
  repeatedDeterioration: boolean;
  failureToHeal: boolean;
  diabetes: boolean;
}

function calculateClinicalRiskScore(factors: ClinicalFactors): { score: number; drivers: RiskDriver[] } {
  const drivers: RiskDriver[] = [];
  let score = 0;

  // ── Infection + deterioration combo (not simple infection alone) ──
  if (factors.infectionIndicators && (factors.woundGrowthPct > 10 || factors.repeatedDeterioration)) {
    score += 35;
    drivers.push({ factor: 'Infection with Active Deterioration', points: 35, isPrimary: true, clinicalNote: 'Active infection combined with wound deterioration — highest clinical urgency, risk of systemic spread.' });
  } else if (factors.infectionIndicators) {
    score += 12;
    drivers.push({ factor: 'Infection Indicators', points: 12, isPrimary: false, clinicalNote: 'Infection signs documented — contributing factor but not dominant without deterioration.' });
  }

  // ── Diabetic Foot Ulcer ──
  if (factors.isDiabeticFootUlcer) {
    if (factors.pad) {
      score += 35;
      drivers.push({ factor: 'Diabetic Foot Ulcer with PAD', points: 35, isPrimary: true, clinicalNote: 'DFU with compromised blood supply — very high risk of rapid deterioration and amputation.' });
    } else {
      score += 25;
      drivers.push({ factor: 'Diabetic Foot Ulcer', points: 25, isPrimary: true, clinicalNote: 'DFU classification — high risk of rapid deterioration without specialist intervention.' });
    }
  }

  // ── PAD (non-DFU) ──
  if (factors.pad && !factors.isDiabeticFootUlcer) {
    score += 25;
    drivers.push({ factor: 'PAD Present', points: 25, isPrimary: false, clinicalNote: 'Peripheral Arterial Disease — compromised blood supply impairs wound healing capacity.' });
  }

  // ── Pressure Injury Severity (only applies to pressure injuries) ──
  if (factors.isPressureInjury) {
    if (factors.pressureStage >= 4) {
      score += 30;
      drivers.push({ factor: 'Pressure Injury Stage 4', points: 30, isPrimary: true, clinicalNote: 'Full-thickness tissue loss with bone/tendon exposure — severe damage, risk of osteomyelitis.' });
    } else if (factors.pressureStage === 3) {
      score += 20;
      drivers.push({ factor: 'Pressure Injury Stage 3', points: 20, isPrimary: false, clinicalNote: 'Full-thickness tissue loss — significant tissue damage requiring specialist management.' });
    } else if (factors.pressureStage === 2) {
      score += 8;
      drivers.push({ factor: 'Pressure Injury Stage 2', points: 8, isPrimary: false, clinicalNote: 'Partial-thickness tissue loss — monitor for progression.' });
    }
  }

  // ── Days Open / Chronicity (significantly increased weighting) ──
  if (factors.daysOpen > 365) {
    score += 35;
    drivers.push({ factor: 'Days Open > 365 (Critical Chronicity)', points: 35, isPrimary: true, clinicalNote: 'Wound has been open over 1 year — chronic non-healing wound, treatment plan reassessment urgent.' });
  } else if (factors.daysOpen > 180) {
    score += 25;
    drivers.push({ factor: 'Days Open > 180 (Very High Chronicity)', points: 25, isPrimary: false, clinicalNote: 'Wound open over 6 months — significantly impaired healing trajectory, specialist review indicated.' });
  } else if (factors.daysOpen > 90) {
    score += 15;
    drivers.push({ factor: 'Days Open > 90 (High Chronicity)', points: 15, isPrimary: false, clinicalNote: 'Wound open over 3 months — delayed healing pattern, reassess treatment plan.' });
  } else if (factors.daysOpen > 30) {
    score += 5;
    drivers.push({ factor: 'Days Open 31-90 (Moderate Chronicity)', points: 5, isPrimary: false, clinicalNote: 'Wound open over 1 month — monitor healing rate.' });
  }

  // ── Wound Growth / Deterioration ──
  if (factors.woundGrowthPct > 20) {
    score += 30;
    drivers.push({ factor: 'Wound Growth > 20%', points: 30, isPrimary: true, clinicalNote: `Wound area increased by ${factors.woundGrowthPct}% — significant deterioration requiring urgent review.` });
  } else if (factors.woundGrowthPct > 10) {
    score += 20;
    drivers.push({ factor: 'Wound Growth > 10%', points: 20, isPrimary: false, clinicalNote: `Wound area increased by ${factors.woundGrowthPct}% — measurable deterioration since last review.` });
  }

  // ── Repeated Deterioration Pattern ──
  if (factors.repeatedDeterioration) {
    score += 25;
    drivers.push({ factor: 'Repeated Deterioration Pattern', points: 25, isPrimary: true, clinicalNote: 'Multiple deterioration episodes across assessments — treatment plan may require fundamental reassessment.' });
  }

  // ── Failure to Heal ──
  if (factors.failureToHeal) {
    score += 15;
    drivers.push({ factor: 'Failure to Heal', points: 15, isPrimary: false, clinicalNote: 'Wound has not progressed despite treatment — underlying causes need investigation.' });
  }

  // ── Review Overdue (SUPPORTING ONLY — reduced weight) ──
  if (factors.reviewOverdue) {
    score += 5;
    drivers.push({ factor: 'Review Overdue', points: 5, isPrimary: false, clinicalNote: 'Scheduled review missed — monitoring gap, but not the primary clinical concern.' });
  }

  // ── Diabetes (non-DFU) ──
  if (factors.diabetes && !factors.isDiabeticFootUlcer) {
    score += 8;
    drivers.push({ factor: 'Diabetes Present', points: 8, isPrimary: false, clinicalNote: 'Diabetes impairs healing capacity and increases infection risk.' });
  }

  // Sort drivers: primary first, then by points descending
  drivers.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return b.points - a.points;
  });

  return { score: Math.min(score, 100), drivers };
}

function detectDiabeticFootUlcer(woundType: string, diabetes: boolean): boolean {
  const lower = woundType.toLowerCase();
  const isDFU = lower.includes('diabetic foot') || lower.includes('dfu') || lower.includes('foot ulcer');
  return isDFU && diabetes;
}

function detectRepeatedDeterioration(assessments: PilotWoundAssessment[]): boolean {
  if (assessments.length < 3) return false;
  let deteriorationCount = 0;
  for (let i = 1; i < assessments.length; i++) {
    if (assessments[i].surfaceArea > assessments[i - 1].surfaceArea) {
      deteriorationCount++;
    }
  }
  return deteriorationCount >= 2;
}

function detectFailureToHeal(assessments: PilotWoundAssessment[], daysOpen: number, healingTrend: string): boolean {
  if (daysOpen < 60) return false;
  if (healingTrend === 'Stalled') return true;
  if (assessments.length < 3) return false;
  const first = assessments[0].surfaceArea;
  const last = assessments[assessments.length - 1].surfaceArea;
  if (first <= 0) return false;
  const changePct = ((last - first) / first) * 100;
  return changePct > -5;
}

function detectPressureInjury(woundType: string): boolean {
  const lower = woundType.toLowerCase();
  return lower.includes('pressure') || lower.includes('pressure injury') || lower.includes('pressure ulcer') || lower.includes('pressure sore') || lower.includes('pi ') || lower === 'pi';
}

function determineCurrentStatus(
  healingTrend: string,
  areaChangePct: number,
  failureToHeal: boolean,
  hasHistory: boolean,
): CurrentStatus {
  if (!hasHistory) return 'Stable';
  if (healingTrend === 'Deteriorating' || areaChangePct > 10) return 'Deteriorating';
  if (healingTrend === 'Stalled' || failureToHeal) return 'Delayed Healing';
  if (areaChangePct < -5 || healingTrend === 'Improving') return 'Improving';
  return 'Stable';
}

function determineOverallClinicalRisk(
  riskScore: number,
  isDFU: boolean,
  pad: boolean,
  infection: boolean,
  daysOpen: number,
  isPressureInjury: boolean,
  pressureStage: number,
  repeatedDeterioration: boolean,
): OverallClinicalRisk {
  // Very High: critical combinations or very high score
  if (isDFU && pad && infection) return 'Very High';
  if (isDFU && pad) return 'Very High';
  if (infection && repeatedDeterioration) return 'Very High';
  if (isPressureInjury && pressureStage >= 4) return 'Very High';
  if (daysOpen > 365 && infection) return 'Very High';
  if (riskScore >= 70) return 'Very High';

  // High: significant clinical concern
  if (isDFU && infection) return 'High';
  if (isDFU && daysOpen > 180) return 'High';
  if (pad && daysOpen > 90) return 'High';
  if (isPressureInjury && pressureStage >= 3) return 'High';
  if (daysOpen > 365) return 'High';
  if (daysOpen > 180 && infection) return 'High';
  if (repeatedDeterioration) return 'High';
  if (infection && daysOpen > 90) return 'High';
  if (riskScore >= 45) return 'High';

  // Moderate: some concern
  if (isDFU) return 'Moderate';
  if (pad) return 'Moderate';
  if (infection) return 'Moderate';
  if (daysOpen > 90) return 'Moderate';
  if (isPressureInjury && pressureStage >= 2) return 'Moderate';
  if (riskScore >= 25) return 'Moderate';

  return 'Low';
}

function calculateReviewDelay(
  lastReviewDate: string,
  assessmentDate: string,
  missedReviews: number,
  daysActive: number,
  asOf: string,
): { days: number; isOverdue: boolean; dueText: string } {
  // Reference date is the upload's latest assessment date, not the wall clock, so results are reproducible.
  const now = asOf;
  if (lastReviewDate) {
    const days = daysBetween(lastReviewDate, now);
    // Individualized: use actual date difference
    // Overdue threshold scales with wound type — but for consistency use 14 days
    const isOverdue = days > 14 || missedReviews > 0;
    let dueText: string;
    if (days <= 0) {
      dueText = `Review on time (${days}d)`;
    } else if (days <= 7) {
      dueText = `Review recent (${days}d ago)`;
    } else if (days <= 14) {
      dueText = `Review due soon (${days}d ago)`;
    } else if (days <= 21) {
      dueText = `Review overdue ${days}d`;
    } else if (days <= 30) {
      dueText = `Review overdue ${days}d`;
    } else {
      dueText = `Review significantly overdue ${days}d`;
    }
    return { days, isOverdue, dueText };
  }

  // No lastReviewDate — estimate from assessment date or daysActive
  if (assessmentDate) {
    const days = daysBetween(assessmentDate, now);
    const isOverdue = days > 14 || missedReviews > 0;
    return {
      days,
      isOverdue,
      dueText: lastReviewDate ? `Review overdue ${days}d` : `Assessment ${days}d ago`,
    };
  }

  // Fallback
  return {
    days: daysActive,
    isOverdue: missedReviews > 0 || daysActive > 14,
    dueText: missedReviews > 0 ? `Review overdue (${missedReviews} missed)` : `No review date — ${daysActive}d active`,
  };
}

// ─── Wound Change Validation ─────────────────────────────────────────────────
//
// Critical: Never report "wound increased" when wound size has actually decreased.
// We validate by comparing current and previous assessment areas directly.

function validateAreaChange(currentArea: number, previousArea: number, importedChangePct: number): {
  validatedPct: number;
  isValid: boolean;
  healingTrendAdjusted: 'Improving' | 'Deteriorating' | 'Stalled' | null;
} {
  if (previousArea <= 0 || currentArea <= 0) {
    return { validatedPct: importedChangePct, isValid: false, healingTrendAdjusted: null };
  }

  const calculatedPct = Math.round(((currentArea - previousArea) / previousArea) * 100);

  if (importedChangePct > 0 && calculatedPct < 0) {
    return { validatedPct: calculatedPct, isValid: true, healingTrendAdjusted: 'Improving' };
  }

  if (importedChangePct < 0 && calculatedPct > 0) {
    return { validatedPct: calculatedPct, isValid: true, healingTrendAdjusted: 'Deteriorating' };
  }

  if (Math.abs(importedChangePct - calculatedPct) <= 5) {
    return { validatedPct: calculatedPct, isValid: true, healingTrendAdjusted: null };
  }

  return { validatedPct: calculatedPct, isValid: true, healingTrendAdjusted: null };
}

// ─── Clinical Contradiction Resolution ───────────────────────────────────────
//
// A wound must never display "healing well" and "critical deterioration"
// at the same time. If the wound is genuinely reducing in size but the
// patient remains high-risk, we surface "Wound improving but patient
// remains high risk due to…" instead.

function resolveContradictions(
  effectiveHealingTrend: string,
  validatedAreaChangePct: number,
  riskLevel: PilotRiskLevel,
  isDFU: boolean,
  pad: boolean,
  infection: boolean,
  daysOpen: number,
  pressureStage: number,
  isPressureInjury: boolean,
  repeatedDeterioration: boolean,
): {
  woundIsImproving: boolean;
  woundImprovingButHighRisk: boolean;
  highRiskReasons: string[];
  contradictionResolved: boolean;
  contradictionNote: string | null;
  adjustedTrend: string;
} {
  const woundIsImproving = effectiveHealingTrend === 'Improving' || validatedAreaChangePct < -5;
  const isHighRisk = riskLevel === 'RED' || riskLevel === 'CRITICAL';

  const highRiskReasons: string[] = [];
  if (isDFU) highRiskReasons.push('Diabetic Foot Ulcer');
  if (pad) highRiskReasons.push('PAD');
  if (infection) highRiskReasons.push('active infection');
  if (daysOpen > 180) highRiskReasons.push(`wound open ${daysOpen} days`);
  if (isPressureInjury && pressureStage >= 3) highRiskReasons.push(`Pressure Injury Stage ${pressureStage}`);
  if (repeatedDeterioration) highRiskReasons.push('repeated deterioration history');

  const woundImprovingButHighRisk = woundIsImproving && isHighRisk && highRiskReasons.length > 0;

  let contradictionResolved = false;
  let contradictionNote: string | null = null;
  let adjustedTrend = effectiveHealingTrend;

  // If wound is improving but we previously labeled it as deteriorating, fix it
  if (woundIsImproving && effectiveHealingTrend === 'Deteriorating') {
    adjustedTrend = 'Improving';
    contradictionResolved = true;
    contradictionNote = 'Wound area is reducing — healing trajectory corrected from "Deteriorating" to "Improving" based on validated measurements.';
  }

  // If wound is improving but risk is CRITICAL, resolve the contradiction
  if (woundIsImproving && riskLevel === 'CRITICAL' && highRiskReasons.length > 0) {
    contradictionResolved = true;
    contradictionNote = `Wound is improving (reduced ${Math.abs(validatedAreaChangePct)}%) but patient remains high risk due to ${highRiskReasons.join(', ')}.`;
  }

  return {
    woundIsImproving,
    woundImprovingButHighRisk,
    highRiskReasons,
    contradictionResolved,
    contradictionNote,
    adjustedTrend,
  };
}

// ─── Clinical Confidence Assessment ──────────────────────────────────────────

function assessClinicalConfidence(p: ImportedPatient, assessments: PilotWoundAssessment[], dataQualityIssues: DataQualityIssue[]): {
  confidence: ClinicalConfidence;
  reasons: string[];
} {
  const reasons: string[] = [];
  let confidence: ClinicalConfidence = 'HIGH';

  if (assessments.length >= 4) {
    reasons.push(`Complete wound history — ${assessments.length} previous assessments available`);
  } else if (assessments.length >= 2) {
    reasons.push(`Partial wound history — ${assessments.length} previous assessments available`);
    confidence = 'MEDIUM';
  } else if (assessments.length === 1) {
    reasons.push('Limited wound history — only 1 assessment available');
    confidence = 'MEDIUM';
  } else {
    reasons.push('No previous assessment history available');
    confidence = 'LOW';
  }

  if (p.surfaceArea > 0 && p.length > 0 && p.width > 0) {
    reasons.push('Complete wound measurements documented');
  } else if (p.surfaceArea > 0) {
    reasons.push('Partial wound measurements — area documented but dimensions incomplete');
    if (confidence === 'HIGH') confidence = 'MEDIUM';
  } else {
    reasons.push('Missing wound measurements — area not documented');
    confidence = 'LOW';
  }

  if (p.assessmentDate) {
    reasons.push('Assessment date confirmed');
  } else {
    reasons.push('Missing assessment date — cannot verify recency');
    confidence = 'LOW';
  }

  if (p.lastReviewDate) {
    reasons.push('Last review date confirmed');
  } else {
    reasons.push('Missing last review date — review interval cannot be verified');
    if (confidence === 'HIGH') confidence = 'MEDIUM';
  }

  if (dataQualityIssues.length > 0) {
    reasons.push(`${dataQualityIssues.length} data quality issue${dataQualityIssues.length > 1 ? 's' : ''} detected — clinical confidence reduced`);
    if (dataQualityIssues.length >= 2) {
      confidence = 'LOW';
    } else if (confidence === 'HIGH') {
      confidence = 'MEDIUM';
    }
  }

  if (confidence === 'HIGH') {
    reasons.push('Complete clinical data — high confidence in prioritization');
  }

  return { confidence, reasons };
}

function detectDataQualityIssues(p: ImportedPatient, assessments: PilotWoundAssessment[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (p.surfaceArea <= 0) {
    issues.push({ field: 'Wound Measurements', issue: 'Missing measurements', impact: 'Cannot assess wound progression or calculate healing trajectory accurately.' });
  }

  if (!p.assessmentDate) {
    issues.push({ field: 'Assessment Date', issue: 'Missing assessment date', impact: 'Cannot verify when wound was last assessed.' });
  }

  if (!p.lastReviewDate) {
    issues.push({ field: 'Review Date', issue: 'Missing review date', impact: 'Cannot calculate review interval or identify overdue reviews.' });
  }

  if (!p.woundType) {
    issues.push({ field: 'Wound Type', issue: 'Missing wound type', impact: 'Cannot apply wound-specific clinical protocols or risk adjustments.' });
  }

  if (assessments.length < 2) {
    issues.push({ field: 'Wound History', issue: 'Missing wound history', impact: 'Insufficient historical data to determine healing trend or repeated deterioration patterns.' });
  }

  return issues;
}

// ─── Patient Conversion ──────────────────────────────────────────────────────

function convertToPilotPatient(
  latest: ImportedPatient,
  assessments: PilotWoundAssessment[],
  asOf: string,
): PilotPatient {
  const p = latest;
  const isDiabeticFootUlcer = detectDiabeticFootUlcer(p.woundType, p.diabetes);
  const isPressureInjury = detectPressureInjury(p.woundType);

  const previousSurfaceArea = assessments.length > 1 ? assessments[assessments.length - 2].surfaceArea : p.surfaceArea;

  const validated = validateAreaChange(p.surfaceArea, previousSurfaceArea, p.areaChangePct);
  const validatedAreaChangePct = validated.validatedPct;
  const areaChangeValidated = validated.isValid;

  let effectiveHealingTrend = p.healingTrend;
  if (validated.healingTrendAdjusted) {
    effectiveHealingTrend = validated.healingTrendAdjusted;
  }
  if (validatedAreaChangePct < -5 && effectiveHealingTrend === 'Deteriorating') {
    effectiveHealingTrend = 'Improving';
  }
  if (validatedAreaChangePct > 5 && effectiveHealingTrend === 'Improving') {
    effectiveHealingTrend = 'Deteriorating';
  }

  // If we have real assessment history, recalculate areaChangePct from first→last
  // This uses the FULL trajectory across all CSV rows, not just the latest row's
  // imported areaChangePct value.
  const realAreaChangePct = assessments.length >= 2
    ? Math.round(((assessments[assessments.length - 1].surfaceArea - assessments[0].surfaceArea) / Math.max(assessments[0].surfaceArea, 1)) * 100)
    : validatedAreaChangePct;

  let finalAreaChangePct = validatedAreaChangePct;
  let finalHealingTrend = effectiveHealingTrend;
  if (assessments.length >= 2) {
    finalAreaChangePct = realAreaChangePct;
    // With a real history the trend follows the whole span, not just the last visit-to-visit change.
    finalHealingTrend = realAreaChangePct >= 10 ? 'Deteriorating' : realAreaChangePct <= -10 ? 'Improving' : 'Stalled';
  }

  const reviewDelay = calculateReviewDelay(p.lastReviewDate, p.assessmentDate, p.missedReviews, p.daysActive, asOf);
  const daysSinceReview = reviewDelay.days;
  const reviewOverdue = reviewDelay.isOverdue;

  const repeatedDeterioration = detectRepeatedDeterioration(assessments);
  const failureToHeal = detectFailureToHeal(assessments, p.daysActive, finalHealingTrend);

  const factors: ClinicalFactors = {
    infectionIndicators: p.infectionSigns,
    isDiabeticFootUlcer,
    pad: p.pad,
    pressureStage: p.pressureStage,
    isPressureInjury,
    daysOpen: p.daysActive,
    woundGrowthPct: finalAreaChangePct,
    reviewOverdue,
    repeatedDeterioration,
    failureToHeal,
    diabetes: p.diabetes,
  };

  const { score: riskScore, drivers: riskDrivers } = calculateClinicalRiskScore(factors);

  // Determine risk level using clinical triage logic (not just score)
  const riskLevel = determinePilotRiskLevel({
    score: riskScore,
    trend: finalHealingTrend,
    infection: p.infectionSigns,
    areaChangePct: finalAreaChangePct,
    isDFU: isDiabeticFootUlcer,
    pad: p.pad,
    pressureStage: p.pressureStage,
    isPressureInjury,
    daysOpen: p.daysActive,
    repeatedDeterioration,
    failureToHeal,
    reviewOverdue,
  });

  // Resolve contradictions before determining TVN priority
  const contradiction = resolveContradictions(
    finalHealingTrend,
    finalAreaChangePct,
    riskLevel,
    isDiabeticFootUlcer,
    p.pad,
    p.infectionSigns,
    p.daysActive,
    p.pressureStage,
    isPressureInjury,
    repeatedDeterioration,
  );
  finalHealingTrend = contradiction.adjustedTrend as typeof finalHealingTrend;

  const tvnPriority = determineTVNPriority({
    level: riskLevel,
    trend: finalHealingTrend,
    infection: p.infectionSigns,
    areaChangePct: finalAreaChangePct,
    isDFU: isDiabeticFootUlcer,
    pad: p.pad,
    pressureStage: p.pressureStage,
    isPressureInjury,
    daysOpen: p.daysActive,
    repeatedDeterioration,
    failureToHeal,
    reviewOverdue,
    woundIsImproving: contradiction.woundIsImproving,
  });
  const expectedReviewTime = determineExpectedReviewTime(tvnPriority);

  const dataQualityIssues = detectDataQualityIssues(p, assessments);
  const { confidence: clinicalConfidence, reasons: confidenceReasons } = assessClinicalConfidence(p, assessments, dataQualityIssues);
  const dataQualityWarning = dataQualityIssues.length > 0 && clinicalConfidence !== 'HIGH';

  const currentStatus = determineCurrentStatus(finalHealingTrend, finalAreaChangePct, failureToHeal, assessments.length >= 2);
  const overallClinicalRisk = determineOverallClinicalRisk(riskScore, isDiabeticFootUlcer, p.pad, p.infectionSigns, p.daysActive, isPressureInjury, p.pressureStage, repeatedDeterioration);

  const flaggedReasons = generateFlaggedReasons(p, riskLevel, isDiabeticFootUlcer, isPressureInjury, finalAreaChangePct, p.daysActive, p.pressureStage, repeatedDeterioration, daysSinceReview, failureToHeal, contradiction);
  const flaggedReason = flaggedReasons.map((r) => r.reason).join('; ');
  const recommendedAction = generateRecommendedAction(p, riskLevel, tvnPriority, isDiabeticFootUlcer, isPressureInjury, p.pressureStage, clinicalConfidence, contradiction);
  const tvnRationale = generateTVNRationale(p, riskLevel, tvnPriority, riskDrivers, clinicalConfidence, isDiabeticFootUlcer, isPressureInjury, finalAreaChangePct, p.daysActive, contradiction, currentStatus, overallClinicalRisk);

  const clinicalReasoning = generateClinicalReasoning(
    riskDrivers,
    tvnPriority,
    recommendedAction,
    expectedReviewTime,
    contradiction,
    currentStatus,
    overallClinicalRisk,
  );

  const nhsNumber = p.nhsNumber || 'Not provided';

  return {
    id: p.id,
    name: p.name,
    nhsNumber,
    age: p.age,
    gender: p.gender,
    facility: p.facility,
    clinician: p.clinician,
    woundType: p.woundType,
    woundLocation: p.woundLocation,
    surfaceArea: p.surfaceArea,
    previousSurfaceArea,
    length: p.length,
    width: p.width,
    depth: p.depth,
    assessmentDate: p.assessmentDate,
    lastReviewDate: p.lastReviewDate,
    daysActive: p.daysActive,
    daysSinceReview,
    diabetes: p.diabetes,
    pad: p.pad,
    isDiabeticFootUlcer,
    infectionSigns: p.infectionSigns,
    missedReviews: p.missedReviews,
    pressureStage: p.pressureStage,
    areaChangePct: finalAreaChangePct,
    areaChangeValidated,
    healingTrend: finalHealingTrend,
    riskScore,
    riskLevel,
    tvnPriority,
    expectedReviewTime,
    clinicalConfidence,
    confidenceReasons,
    riskDrivers,
    flaggedReasons,
    flaggedReason,
    recommendedAction,
    tvnRationale,
    dataQualityIssues,
    dataQualityWarning,
    assessments,
    clinicalReasoning,
    repeatedDeterioration,
    failureToHeal,
    currentStatus,
    overallClinicalRisk,
    isPressureInjury,
    reviewDelayDays: reviewDelay.days,
    reviewDueText: reviewDelay.dueText,
    rulePriority: tvnPriority,
    ruleResult: null,
    aiRaised: false,
  };
}

function daysBetween(isoA: string, isoB: string): number {
  if (!isoA || !isoB) return 0;
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(Math.round((b - a) / 86400000));
}

// ─── Risk Level Determination (Clinical Triage Model) ────────────────────────

interface RiskDeterminationInput {
  score: number;
  trend: string;
  infection: boolean;
  areaChangePct: number;
  isDFU: boolean;
  pad: boolean;
  pressureStage: number;
  isPressureInjury: boolean;
  daysOpen: number;
  repeatedDeterioration: boolean;
  failureToHeal: boolean;
  reviewOverdue: boolean;
}

function determinePilotRiskLevel(input: RiskDeterminationInput): PilotRiskLevel {
  const { score, infection, areaChangePct, isDFU, pad, pressureStage, isPressureInjury, daysOpen, repeatedDeterioration } = input;

  // ── CRITICAL: genuinely urgent combinations ──
  if (infection && areaChangePct > 20) return 'CRITICAL';
  if (isDFU && pad && infection) return 'CRITICAL';
  if (isDFU && pad && areaChangePct > 10) return 'CRITICAL';
  if (isPressureInjury && pressureStage >= 4 && (infection || areaChangePct > 10)) return 'CRITICAL';
  if (daysOpen > 180 && infection && areaChangePct > 10) return 'CRITICAL';
  if (repeatedDeterioration && infection) return 'CRITICAL';
  if (repeatedDeterioration && areaChangePct > 20) return 'CRITICAL';
  if (areaChangePct > 40) return 'CRITICAL';

  // ── RED: high clinical concern ──
  if (isDFU && pad) return 'RED';
  if (isDFU && infection) return 'RED';
  if (isDFU && areaChangePct > 10) return 'RED';
  if (isPressureInjury && pressureStage >= 4) return 'RED';
  if (daysOpen > 365 && (areaChangePct > 10 || infection)) return 'RED';
  if (daysOpen > 180 && areaChangePct > 10) return 'RED';
  if (repeatedDeterioration && daysOpen > 90) return 'RED';
  if (infection && areaChangePct > 10) return 'RED';
  if (score >= 70) return 'RED';

  // ── AMBER: moderate concern, specialist review indicated ──
  if (isDFU) return 'AMBER';
  if (pad && (daysOpen > 90 || areaChangePct > 5)) return 'AMBER';
  if (isPressureInjury && pressureStage >= 3) return 'AMBER';
  if (daysOpen > 180) return 'AMBER';
  if (infection) return 'AMBER';
  if (areaChangePct > 10) return 'AMBER';
  if (repeatedDeterioration) return 'AMBER';
  if (input.failureToHeal) return 'AMBER';
  if (score >= 40) return 'AMBER';

  return 'GREEN';
}

// ─── TVN Priority Determination (Clinical Triage) ────────────────────────────
//
// SEE TODAY: reserved only for genuinely urgent patients (~5-15% of caseload)
// SEE THIS WEEK: moderate concern requiring specialist review (~20-30%)
// MONITOR: stable but needs watching
// HEALING: improving, no concerns

interface TVNPriorityInput {
  level: PilotRiskLevel;
  trend: string;
  infection: boolean;
  areaChangePct: number;
  isDFU: boolean;
  pad: boolean;
  pressureStage: number;
  isPressureInjury: boolean;
  daysOpen: number;
  repeatedDeterioration: boolean;
  failureToHeal: boolean;
  reviewOverdue: boolean;
  woundIsImproving: boolean;
}

function determineTVNPriority(input: TVNPriorityInput): TVNPriority {
  const { level, infection, areaChangePct, isDFU, pad, pressureStage, isPressureInjury, daysOpen, repeatedDeterioration, trend } = input;

  // ── SEE TODAY: only genuinely urgent ──
  if (level === 'CRITICAL') return 'SEE TODAY';
  if (infection && areaChangePct > 20) return 'SEE TODAY';
  if (isDFU && pad && infection) return 'SEE TODAY';
  if (isDFU && pad && areaChangePct > 10) return 'SEE TODAY';
  if (isDFU && infection && areaChangePct > 10) return 'SEE TODAY';
  if (isPressureInjury && pressureStage >= 4 && (infection || areaChangePct > 10)) return 'SEE TODAY';
  if (daysOpen > 180 && infection && areaChangePct > 10) return 'SEE TODAY';
  if (repeatedDeterioration && infection) return 'SEE TODAY';
  if (repeatedDeterioration && areaChangePct > 20) return 'SEE TODAY';
  if (areaChangePct > 40) return 'SEE TODAY';
  if (trend === 'Deteriorating' && infection) return 'SEE TODAY';
  // Chronic wound with worsening trend
  if (daysOpen > 180 && areaChangePct > 10 && trend !== 'Improving') return 'SEE TODAY';

  // ── SEE THIS WEEK: specialist review needed but not today-urgent ──
  if (level === 'RED') return 'SEE THIS WEEK';
  if (isDFU && pad) return 'SEE THIS WEEK';
  if (isDFU && infection) return 'SEE THIS WEEK';
  if (isDFU && areaChangePct > 5) return 'SEE THIS WEEK';
  if (isPressureInjury && pressureStage >= 4) return 'SEE THIS WEEK';
  if (isPressureInjury && pressureStage >= 3 && daysOpen > 90) return 'SEE THIS WEEK';
  if (daysOpen > 365) return 'SEE THIS WEEK';
  if (daysOpen > 180 && (areaChangePct > 5 || infection)) return 'SEE THIS WEEK';
  if (repeatedDeterioration) return 'SEE THIS WEEK';
  if (input.failureToHeal && daysOpen > 90) return 'SEE THIS WEEK';
  if (trend === 'Deteriorating') return 'SEE THIS WEEK';
  if (level === 'AMBER') return 'SEE THIS WEEK';
  if (areaChangePct > 10) return 'SEE THIS WEEK';

  // ── MONITOR: stable, needs watching ──
  if (level === 'GREEN' && trend === 'Stalled') return 'MONITOR';
  if (level === 'GREEN' && input.reviewOverdue) return 'MONITOR';
  if (level === 'GREEN' && input.failureToHeal) return 'MONITOR';
  if (level === 'GREEN' && daysOpen > 90) return 'MONITOR';
  if (level === 'GREEN' && (isDFU || pad)) return 'MONITOR';

  // ── HEALING: improving, no concerns ──
  return 'HEALING';
}

function determineExpectedReviewTime(priority: TVNPriority): string {
  switch (priority) {
    case 'SEE TODAY': return 'Within 24 hours';
    case 'SEE THIS WEEK': return 'Within 72 hours';
    case 'MONITOR': return 'Routine';
    case 'HEALING': return 'Next scheduled';
  }
}

// ─── Clinical Reasoning Generation ───────────────────────────────────────────

interface ContradictionResult {
  woundIsImproving: boolean;
  woundImprovingButHighRisk: boolean;
  highRiskReasons: string[];
  contradictionResolved: boolean;
  contradictionNote: string | null;
}

function generateClinicalReasoning(
  drivers: RiskDriver[],
  priority: TVNPriority,
  recommendedAction: string,
  expectedReviewTime: string,
  contradiction: ContradictionResult,
  currentStatus: CurrentStatus,
  overallClinicalRisk: OverallClinicalRisk,
): ClinicalReasoning {
  const primaryDriverObj = drivers.find((d) => d.isPrimary);
  const primaryDriver = primaryDriverObj
    ? `${primaryDriverObj.factor} — ${primaryDriverObj.clinicalNote}`
    : drivers.length > 0
    ? `${drivers[0].factor} — ${drivers[0].clinicalNote}`
    : 'No significant clinical risk factors identified';

  const secondaryDriverObjs = drivers.filter((d) => !d.isPrimary || d !== primaryDriverObj).slice(0, 5);
  const secondaryDrivers = secondaryDriverObjs.map((d) => `${d.factor} (+${d.points})`);

  return {
    primaryDriver,
    secondaryDrivers,
    recommendedAction,
    expectedReviewTime,
    woundImprovingButHighRisk: contradiction.woundImprovingButHighRisk,
    highRiskReasons: contradiction.highRiskReasons,
    contradictionResolved: contradiction.contradictionResolved,
    contradictionNote: contradiction.contradictionNote,
    currentStatus,
    overallClinicalRisk,
  };
}

function generateFlaggedReasons(
  p: ImportedPatient,
  level: PilotRiskLevel,
  isDFU: boolean,
  isPressureInjury: boolean,
  areaChangePct: number,
  daysOpen: number,
  pressureStage: number,
  repeatedDeterioration: boolean,
  daysSinceReview: number,
  failureToHeal: boolean,
  contradiction: ContradictionResult,
): FlaggedReasonItem[] {
  const reasons: FlaggedReasonItem[] = [];

  // If wound is improving but patient is high risk, lead with that
  if (contradiction.woundImprovingButHighRisk) {
    reasons.push({
      reason: `Wound improving (reduced ${Math.abs(areaChangePct)}%) but patient remains high risk due to ${contradiction.highRiskReasons.join(', ')}`,
      severity: 'warning',
    });
  } else if (areaChangePct > 20) {
    reasons.push({ reason: `Wound increased by ${areaChangePct}%`, severity: 'critical' });
  } else if (areaChangePct > 10) {
    reasons.push({ reason: `Wound increased by ${areaChangePct}%`, severity: 'warning' });
  } else if (areaChangePct < -10) {
    reasons.push({ reason: `Wound reducing — healing trajectory improving (${Math.abs(areaChangePct)}% reduction)`, severity: 'info' });
  }

  // DFU + PAD combo
  if (isDFU && p.pad) {
    reasons.push({ reason: 'Diabetic Foot Ulcer with PAD — high-risk combination', severity: 'critical' });
  } else if (isDFU) {
    reasons.push({ reason: 'Diabetic Foot Ulcer — high-risk wound classification', severity: 'critical' });
  }

  // Chronicity
  if (daysOpen > 365) {
    reasons.push({ reason: `Wound open ${daysOpen} days — critical chronicity`, severity: 'critical' });
  } else if (daysOpen > 180) {
    reasons.push({ reason: `Wound open ${daysOpen} days — very high chronicity`, severity: 'critical' });
  } else if (daysOpen > 90) {
    reasons.push({ reason: `Wound open ${daysOpen} days — high chronicity`, severity: 'warning' });
  }

  // Pressure injury (only for pressure injury wounds)
  if (isPressureInjury && pressureStage >= 4) {
    reasons.push({ reason: `Pressure injury Stage ${pressureStage}`, severity: 'critical' });
  } else if (isPressureInjury && pressureStage === 3) {
    reasons.push({ reason: `Pressure injury Stage ${pressureStage}`, severity: 'critical' });
  }

  // Infection (only prominent if combined with deterioration)
  if (p.infectionSigns && (areaChangePct > 10 || repeatedDeterioration)) {
    reasons.push({ reason: 'Infection with active deterioration', severity: 'critical' });
  } else if (p.infectionSigns) {
    reasons.push({ reason: 'Infection indicators documented', severity: 'warning' });
  }

  // Repeated deterioration
  if (repeatedDeterioration) {
    reasons.push({ reason: 'Repeated deterioration pattern — multiple growth episodes', severity: 'critical' });
  }

  // Failure to heal
  if (failureToHeal) {
    reasons.push({ reason: 'Failure to heal — wound not progressing despite treatment', severity: 'warning' });
  }

  // PAD (non-DFU)
  if (p.pad && !isDFU) {
    reasons.push({ reason: 'PAD present — compromised blood supply', severity: 'warning' });
  }

  // Diabetes (non-DFU)
  if (p.diabetes && !isDFU) {
    reasons.push({ reason: 'Diabetes present — impaired healing capacity', severity: 'warning' });
  }

  // Review overdue — SUPPORTING only, always last and never critical
  if (p.missedReviews > 0 || daysSinceReview > 14) {
    reasons.push({ reason: `Review overdue ${daysSinceReview} days`, severity: 'warning' });
  }

  if (reasons.length === 0) {
    reasons.push({ reason: 'Healing appropriately — continue current care plan', severity: 'info' });
  }

  return reasons;
}

function generateRecommendedAction(
  p: ImportedPatient,
  level: PilotRiskLevel,
  priority: TVNPriority,
  isDFU: boolean,
  isPressureInjury: boolean,
  pressureStage: number,
  confidence: ClinicalConfidence,
  contradiction: ContradictionResult,
): string {
  const confidencePrefix = confidence === 'LOW'
    ? 'Note: Clinical confidence is LOW due to data quality issues. '
    : '';

  // Contradiction case: wound improving but patient high risk
  if (contradiction.woundImprovingButHighRisk) {
    const reasons = contradiction.highRiskReasons.join(', ');
    if (priority === 'SEE TODAY') {
      return `${confidencePrefix}Wound is improving but patient requires same-day review due to ${reasons}. Do not de-prioritize based on wound size alone.`;
    }
    if (priority === 'SEE THIS WEEK') {
      return `${confidencePrefix}Wound is improving but patient remains high risk due to ${reasons}. TVN review within 72 hours to address underlying risk factors.`;
    }
    return `${confidencePrefix}Wound is improving. Continue current care plan but monitor for ${reasons}.`;
  }

  switch (priority) {
    case 'SEE TODAY':
      if (isDFU && p.pad && p.infectionSigns) return `${confidencePrefix}Urgent same-day TVN review. DFU with PAD and infection — assess for systemic infection, vascular review, consider IV antibiotics and MDT referral. Document wound photographs.`;
      if (isDFU && p.pad) return `${confidencePrefix}Urgent same-day TVN review. DFU with PAD — vascular assessment urgent, ensure offloading, reassess wound bed.`;
      if (isDFU && p.infectionSigns) return `${confidencePrefix}Urgent same-day TVN review. DFU with infection — assess for systemic infection, consider swab, antibiotic review, and possible MDT referral.`;
      if (p.infectionSigns && p.areaChangePct > 20) return `${confidencePrefix}Urgent same-day TVN review. Active infection with significant wound deterioration — assess for systemic infection, consider swab and IV antibiotics. Document wound photographs.`;
      if (isPressureInjury && pressureStage >= 4) return `${confidencePrefix}Urgent same-day TVN review. Stage 4 pressure injury — assess for osteomyelitis, consider surgical review and MDT referral.`;
      if (p.healingTrend === 'Deteriorating' && p.infectionSigns) return `${confidencePrefix}Urgent same-day TVN review. Deteriorating wound with infection — reassess wound bed, exudate, surrounding skin. Consider treatment plan change.`;
      if (p.healingTrend === 'Deteriorating') return `${confidencePrefix}Urgent same-day TVN review. Rapid deterioration trajectory — reassess wound bed, exudate, and surrounding skin. Investigate underlying causes.`;
      return `${confidencePrefix}Immediate same-day clinical review required. Escalate to TVN and consider hospital admission if infection spreading.`;

    case 'SEE THIS WEEK':
      if (isDFU && p.pad) return `${confidencePrefix}TVN review within 72 hours. DFU with PAD — ensure pressure offloading, arrange vascular assessment, reassess wound bed.`;
      if (isDFU) return `${confidencePrefix}TVN review within 72 hours. Diabetic foot ulcer — ensure pressure offloading, consider vascular assessment, reassess wound bed.`;
      if (isDFU && p.infectionSigns) return `${confidencePrefix}TVN review within 72 hours. DFU with infection — assess infection status, consider wound swab.`;
      if (isPressureInjury && pressureStage >= 4) return `${confidencePrefix}TVN review within 72 hours. Stage 4 pressure injury — assess for osteomyelitis, consider surgical review.`;
      if (isPressureInjury && pressureStage >= 3) return `${confidencePrefix}TVN review within 72 hours. Stage 3 pressure injury — reassess wound bed, consider pressure relief review.`;
      if (p.infectionSigns) return `${confidencePrefix}TVN review within 72 hours. Assess infection status. Consider wound swab if not already done.`;
      if (p.healingTrend === 'Stalled') return `${confidencePrefix}TVN review within 72 hours. Healing stalled — reassess treatment plan. Consider alternative dressings, compression therapy, or biofilm assessment.`;
      if (p.daysActive > 365) return `${confidencePrefix}TVN review within 72 hours. Chronic wound over 1 year — fundamental treatment plan reassessment required.`;
      if (p.daysActive > 180) return `${confidencePrefix}TVN review within 72 hours. Chronic wound over 6 months — reassess healing trajectory and treatment plan.`;
      if (p.healingTrend === 'Deteriorating') return `${confidencePrefix}TVN review within 72 hours. Deteriorating wound — reassess treatment plan and investigate underlying causes.`;
      if (p.missedReviews > 0) return `${confidencePrefix}Schedule TVN review this week. Address missed reviews and ensure follow-up plan in place.`;
      return `${confidencePrefix}Review within 72 hours. Monitor healing trajectory and reassess at next scheduled visit.`;

    case 'MONITOR':
      return `${confidencePrefix}Continue monitoring at next scheduled review. Observe for any changes in wound bed or surrounding skin. Ensure reviews are not missed.`;

    case 'HEALING':
      return `${confidencePrefix}Continue current care plan. Wound is progressing appropriately. Next scheduled review on track.`;
  }
}

function generateTVNRationale(
  p: ImportedPatient,
  level: PilotRiskLevel,
  priority: TVNPriority,
  drivers: RiskDriver[],
  confidence: ClinicalConfidence,
  isDFU: boolean,
  isPressureInjury: boolean,
  areaChangePct: number,
  daysOpen: number,
  contradiction: ContradictionResult,
  currentStatus: CurrentStatus,
  overallClinicalRisk: OverallClinicalRisk,
): string {
  const primaryDrivers = drivers.filter((d) => d.isPrimary);
  const secondaryDrivers = drivers.filter((d) => !d.isPrimary);

  let rationale = `Current status: ${currentStatus}. Overall clinical risk: ${overallClinicalRisk}. This patient is categorized as ${priority} based on clinical triage. `

  if (contradiction.woundImprovingButHighRisk) {
    rationale += `Although the wound is reducing in size (${Math.abs(areaChangePct)}% improvement), the patient remains high priority due to ${contradiction.highRiskReasons.join(', ')}. `;
  }

  if (primaryDrivers.length > 0) {
    rationale += `Primary clinical driver: ${primaryDrivers.map((d) => d.factor).join(', ')}. `;
  }

  if (secondaryDrivers.length > 0) {
    rationale += `Secondary factors: ${secondaryDrivers.slice(0, 4).map((d) => `${d.factor} (+${d.points})`).join(', ')}. `;
  }

  if (isDFU && p.pad) {
    rationale += `DFU with PAD is a high-risk combination requiring specialist assessment regardless of wound size. `;
  }

  if (daysOpen > 180) {
    rationale += `Chronicity (${daysOpen} days open) significantly impairs healing capacity. `;
  }

  if (p.infectionSigns && (areaChangePct > 10 || contradiction.woundIsImproving === false)) {
    rationale += `Infection indicators are documented and contribute to clinical urgency. `;
  }

  if (contradiction.contradictionNote) {
    rationale += `${contradiction.contradictionNote} `;
  }

  if (confidence !== 'HIGH') {
    rationale += `Clinical confidence is ${confidence} — recommendations should be verified against available clinical data. `;
  }

  rationale += `Risk level: ${level}. Total clinical risk score: ${drivers.reduce((s, d) => s + d.points, 0)} points.`;

  return rationale;
}

// ─── Ranked Caseload ─────────────────────────────────────────────────────────

export function getRankedCaseload(patients: PilotPatient[]): PilotPatient[] {
  return [...patients].sort((a, b) => {
    const priorityOrder: Record<TVNPriority, number> = { 'SEE TODAY': 0, 'SEE THIS WEEK': 1, 'MONITOR': 2, 'HEALING': 3 };
    const priorityDiff = priorityOrder[a.tvnPriority] - priorityOrder[b.tvnPriority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.riskScore - a.riskScore;
  });
}

// ─── TVN Priority Filtering ──────────────────────────────────────────────────

export function filterByTVNPriority(patients: PilotPatient[], priority: TVNPriority): PilotPatient[] {
  return patients
    .filter((p) => p.tvnPriority === priority)
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function getTVNPriorityCounts(patients: PilotPatient[]): Record<TVNPriority, number> {
  return {
    'SEE TODAY': patients.filter((p) => p.tvnPriority === 'SEE TODAY').length,
    'SEE THIS WEEK': patients.filter((p) => p.tvnPriority === 'SEE THIS WEEK').length,
    'MONITOR': patients.filter((p) => p.tvnPriority === 'MONITOR').length,
    'HEALING': patients.filter((p) => p.tvnPriority === 'HEALING').length,
  };
}

// ─── Top Priority Cases ──────────────────────────────────────────────────────

export function getCriticalPatients(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.riskLevel === 'CRITICAL')
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function getDeterioratingWounds(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.healingTrend === 'Deteriorating')
    .sort((a, b) => b.areaChangePct - a.areaChangePct);
}

export function getPatientsRequiringReview(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.missedReviews > 0 || p.healingTrend === 'Stalled')
    .sort((a, b) => b.missedReviews - a.missedReviews);
}

export function getPotentialInfections(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.infectionSigns)
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function getEscalationCandidates(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL')
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function getMostLikelyToDeteriorate(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL' || p.healingTrend === 'Deteriorating' || p.repeatedDeterioration)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}

export function getDelayedHealingCases(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.healingTrend === 'Stalled' || p.healingTrend === 'Deteriorating' || p.failureToHeal)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}

// ─── Role-Based Views ────────────────────────────────────────────────────────

export function getCareHomeView(patients: PilotPatient[]) {
  return {
    requiringReview: patients.filter((p) => p.missedReviews > 0 || p.daysSinceReview > 14).sort((a, b) => b.riskScore - a.riskScore),
    requiringEscalation: patients.filter((p) => p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL').sort((a, b) => b.riskScore - a.riskScore),
    healingWell: patients.filter((p) => p.tvnPriority === 'HEALING').sort((a, b) => a.riskScore - b.riskScore),
    overdueAssessment: patients.filter((p) => p.daysSinceReview > 14).sort((a, b) => b.daysSinceReview - a.daysSinceReview),
  };
}

export function getCommunityNurseView(patients: PilotPatient[]) {
  return {
    todayPriorities: patients.filter((p) => p.tvnPriority === 'SEE TODAY').sort((a, b) => b.riskScore - a.riskScore),
    potentialEscalations: patients.filter((p) => p.riskLevel === 'RED' && p.tvnPriority !== 'SEE TODAY').sort((a, b) => b.riskScore - a.riskScore),
    potentialInfections: patients.filter((p) => p.infectionSigns).sort((a, b) => b.riskScore - a.riskScore),
    delayedHealing: patients.filter((p) => p.healingTrend === 'Stalled' || p.healingTrend === 'Deteriorating' || p.failureToHeal).sort((a, b) => b.riskScore - a.riskScore),
    requiringTVNSupport: patients.filter((p) => p.tvnPriority === 'SEE THIS WEEK').sort((a, b) => b.riskScore - a.riskScore),
  };
}

// ─── TVN Referral Queue ──────────────────────────────────────────────────────

export function getTVNQueue(patients: PilotPatient[]): PilotPatient[] {
  return patients
    .filter((p) => p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL' || p.riskLevel === 'AMBER')
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function sortTVNQueue(patients: PilotPatient[], key: 'risk' | 'facility' | 'woundType' | 'date'): PilotPatient[] {
  const sorted = [...patients];
  switch (key) {
    case 'risk':
      return sorted.sort((a, b) => b.riskScore - a.riskScore);
    case 'facility':
      return sorted.sort((a, b) => a.facility.localeCompare(b.facility) || b.riskScore - a.riskScore);
    case 'woundType':
      return sorted.sort((a, b) => a.woundType.localeCompare(b.woundType) || b.riskScore - a.riskScore);
    case 'date':
      return sorted.sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
  }
}

// ─── Facility Priority View ──────────────────────────────────────────────────

export function getFacilitySummaries(patients: PilotPatient[]): PilotFacilitySummary[] {
  const byFacility = new Map<string, PilotPatient[]>();
  for (const p of patients) {
    const list = byFacility.get(p.facility) || [];
    list.push(p);
    byFacility.set(p.facility, list);
  }

  return Array.from(byFacility.entries())
    .map(([name, fps]) => {
      const activeWounds = fps.length;
      const highRiskWounds = fps.filter((p) => p.riskLevel === 'RED').length;
      const criticalWounds = fps.filter((p) => p.riskLevel === 'CRITICAL').length;
      const delayedReviews = fps.filter((p) => p.missedReviews > 0).length;
      const overdueAssessments = fps.filter((p) => p.daysSinceReview > 14).length;
      const improving = fps.filter((p) => p.healingTrend === 'Improving');
      const healingRate = fps.length > 0 ? Math.round((improving.length / fps.length) * 100) : 0;
      const avgRiskScore = fps.length > 0 ? Math.round(fps.reduce((s, p) => s + p.riskScore, 0) / fps.length) : 0;

      return { name, activeWounds, highRiskWounds, criticalWounds, delayedReviews, overdueAssessments, healingRate, improvingCount: improving.length, avgRiskScore };
    })
    .sort((a, b) => b.avgRiskScore - a.avgRiskScore);
}

// ─── Healing Trajectory with Clinical Interpretation ─────────────────────────

export function getTrajectoryData(patient: PilotPatient): {
  chartData: { date: string; actual: number }[];
  status: 'Improving' | 'Stable' | 'Delayed Healing' | 'Deteriorating';
  deviation: boolean;
  interpretation: string;
} {
  const assessments = patient.assessments;
  if (assessments.length === 0) return { chartData: [], status: 'Stable', deviation: false, interpretation: 'Insufficient data for assessment.' };

  // Only measured points are charted; no expected path or projection is generated.
  const chartData = assessments.map((a) => ({
    date: formatDateShort(a.date),
    actual: a.surfaceArea,
  }));

  const status =
    patient.healingTrend === 'Deteriorating' ? 'Deteriorating' as const
    : patient.healingTrend === 'Stalled' ? 'Delayed Healing' as const
    : patient.areaChangePct <= -10 ? 'Improving' as const
    : 'Stable' as const;

  const deviation = patient.healingTrend !== 'Improving';

  let interpretation: string;
  if (status === 'Deteriorating') {
    interpretation = `Wound area has increased by ${patient.areaChangePct}% since the last assessment, despite ongoing treatment. `;
    if (patient.isDiabeticFootUlcer) {
      interpretation += `As a Diabetic Foot Ulcer${patient.pad ? ' with PAD' : ''}, rapid deterioration poses significant amputation risk — urgent specialist review recommended. `;
    }
    if (patient.pad) {
      interpretation += `PAD is present — vascular assessment may be required. `;
    }
    if (patient.infectionSigns) {
      interpretation += `Infection indicators documented — assess for systemic infection. `;
    }
    interpretation += `TVN review recommended urgently.`;
  } else if (status === 'Delayed Healing') {
    interpretation = `Healing has stalled — wound area has not changed significantly. `;
    if (patient.daysActive > 90) {
      interpretation += `Wound has been open for ${patient.daysActive} days — classified as chronic. `;
    }
    if (patient.failureToHeal) {
      interpretation += `Wound is not progressing despite treatment — underlying causes need investigation. `;
    }
    interpretation += `Consider reassessing treatment plan, evaluating for biofilm, and reviewing nutritional status. TVN review recommended.`;
  } else if (status === 'Stable') {
    interpretation = `Wound is stable but healing slower than expected. Continue current treatment plan but monitor closely for any signs of deterioration.`;
  } else {
    interpretation = `Wound is healing as expected. The area has reduced by ${Math.abs(patient.areaChangePct)}% since the last assessment.`;
    if (patient.clinicalReasoning.woundImprovingButHighRisk) {
      interpretation += ` However, patient remains high risk due to ${patient.clinicalReasoning.highRiskReasons.join(', ')}. Continue monitoring — do not de-prioritize based on wound size alone.`;
    } else {
      interpretation += ` Continue current care plan and maintain scheduled reviews.`;
    }
  }

  return { chartData, status, deviation, interpretation };
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ─── Handover Report Generation ──────────────────────────────────────────────

export function generateHandoverCSV(patients: PilotPatient[]): string {
  const headers = [
    'Patient Name',
    'NHS Number',
    'Facility',
    'Wound Type',
    'Wound Location',
    'Current Status',
    'Overall Clinical Risk',
    'Current Risk',
    'TVN Priority',
    'Clinical Confidence',
    'Healing Trend',
    'Area Change %',
    'Infection Signs',
    'Days Open',
    'Primary Driver',
    'Secondary Drivers',
    'Risk Drivers',
    'Why Flagged',
    'TVN Rationale',
    'Recommended Action',
  ];

  const rows = patients.map((p) => [
    p.name,
    p.nhsNumber,
    p.facility,
    p.woundType,
    p.woundLocation,
    p.currentStatus,
    p.overallClinicalRisk,
    p.riskLevel,
    p.tvnPriority,
    p.clinicalConfidence,
    p.healingTrend,
    String(p.areaChangePct),
    p.infectionSigns ? 'Yes' : 'No',
    String(p.daysActive),
    `"${p.clinicalReasoning.primaryDriver.replace(/"/g, '""')}"`,
    `"${p.clinicalReasoning.secondaryDrivers.join('; ').replace(/"/g, '""')}"`,
    `"${p.riskDrivers.map((d) => `${d.factor} (+${d.points})`).join('; ').replace(/"/g, '""')}"`,
    `"${p.flaggedReason.replace(/"/g, '""')}"`,
    `"${p.tvnRationale.replace(/"/g, '""')}"`,
    `"${p.recommendedAction.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateCaseloadPrioritizationReport(patients: PilotPatient[]): string {
  const ranked = getRankedCaseload(patients);
  const lines: string[] = [
    'WoundCareIQ - TVN Caseload Prioritization Report',
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    `Total Patients: ${ranked.length}`,
    '='.repeat(70),
    '',
  ];

  ranked.forEach((p, i) => {
    lines.push(`Priority #${i + 1}`);
    lines.push(`Patient: ${p.name}`);
    lines.push(`NHS Number: ${p.nhsNumber}`);
    lines.push(`Facility: ${p.facility}`);
    lines.push(`Wound Type: ${p.woundType} · ${p.woundLocation}`);
    lines.push(`Current Status: ${p.currentStatus}`);
    lines.push(`Overall Clinical Risk: ${p.overallClinicalRisk}`);
    lines.push(`Risk: ${p.riskLevel} (Score: ${p.riskScore})`);
    lines.push(`TVN Priority: ${p.tvnPriority}`);
    lines.push(`Clinical Confidence: ${p.clinicalConfidence}`);
    lines.push(`Primary Clinical Driver: ${p.clinicalReasoning.primaryDriver}`);
    lines.push(`Secondary Drivers: ${p.clinicalReasoning.secondaryDrivers.join('; ')}`);
    if (p.clinicalReasoning.woundImprovingButHighRisk) {
      lines.push(`CLINICAL NOTE: Wound improving but patient remains high risk due to ${p.clinicalReasoning.highRiskReasons.join(', ')}`);
    }
    lines.push(`Risk Drivers:`);
    p.riskDrivers.forEach((d) => {
      lines.push(`  • ${d.factor} (+${d.points})${d.isPrimary ? ' [PRIMARY]' : ''} — ${d.clinicalNote}`);
    });
    lines.push(`Why Flagged: ${p.flaggedReason}`);
    lines.push(`TVN Rationale: ${p.tvnRationale}`);
    lines.push(`Action: ${p.recommendedAction}`);
    lines.push(`Expected Review: ${p.expectedReviewTime}`);
    if (p.dataQualityWarning) {
      lines.push(`DATA QUALITY WARNING: ${p.dataQualityIssues.map((i) => i.issue).join(', ')}`);
    }
    lines.push('-'.repeat(70));
  });

  return lines.join('\n');
}

export function generateCaseloadCSV(patients: PilotPatient[]): string {
  const ranked = getRankedCaseload(patients);
  const headers = [
    'Priority',
    'Patient',
    'NHS Number',
    'Facility',
    'Wound Type',
    'Current Status',
    'Overall Clinical Risk',
    'Risk',
    'Risk Score',
    'TVN Priority',
    'Clinical Confidence',
    'Primary Driver',
    'Secondary Drivers',
    'Why Flagged',
    'Action',
    'Expected Review',
  ];

  const rows = ranked.map((p, i) => [
    String(i + 1),
    p.name,
    p.nhsNumber,
    p.facility,
    p.woundType,
    p.currentStatus,
    p.overallClinicalRisk,
    p.riskLevel,
    String(p.riskScore),
    p.tvnPriority,
    p.clinicalConfidence,
    `"${p.clinicalReasoning.primaryDriver.replace(/"/g, '""')}"`,
    `"${p.clinicalReasoning.secondaryDrivers.join('; ').replace(/"/g, '""')}"`,
    `"${p.flaggedReason.replace(/"/g, '""')}"`,
    `"${p.recommendedAction.replace(/"/g, '""')}"`,
    p.expectedReviewTime,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateHandoverTextReport(patients: PilotPatient[]): string {
  const lines: string[] = [
    'WoundCareIQ - TVN Handover Report',
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    `Patients: ${patients.length}`,
    '='.repeat(60),
    '',
  ];

  for (const p of patients) {
    lines.push(`Patient: ${p.name}`);
    lines.push(`NHS Number: ${p.nhsNumber}`);
    lines.push(`Facility: ${p.facility}`);
    lines.push(`Wound Type: ${p.woundType}`);
    lines.push(`Current Status: ${p.currentStatus}`);
    lines.push(`Overall Clinical Risk: ${p.overallClinicalRisk}`);
    lines.push(`Risk Level: ${p.riskLevel} (Score: ${p.riskScore})`);
    lines.push(`TVN Priority: ${p.tvnPriority}`);
    lines.push(`Clinical Confidence: ${p.clinicalConfidence}`);
    lines.push(`Primary Driver: ${p.clinicalReasoning.primaryDriver}`);
    lines.push(`Secondary Drivers: ${p.clinicalReasoning.secondaryDrivers.join('; ')}`);
    if (p.clinicalReasoning.woundImprovingButHighRisk) {
      lines.push(`CLINICAL NOTE: Wound improving but patient remains high risk due to ${p.clinicalReasoning.highRiskReasons.join(', ')}`);
    }
    lines.push(`Healing Trend: ${p.healingTrend}`);
    lines.push(`Area Change: ${p.areaChangePct}%`);
    lines.push(`Infection Signs: ${p.infectionSigns ? 'Yes' : 'No'}`);
    lines.push(`Days Open: ${p.daysActive}`);
    lines.push(`Risk Drivers: ${p.riskDrivers.map((d) => `${d.factor} (+${d.points})${d.isPrimary ? ' [PRIMARY]' : ''}`).join(', ')}`);
    lines.push(`Reason Flagged: ${p.flaggedReason}`);
    lines.push(`TVN Rationale: ${p.tvnRationale}`);
    lines.push(`Recommended Action: ${p.recommendedAction}`);
    lines.push('-'.repeat(60));
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
