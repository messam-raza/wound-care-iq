import type { HealingTrend } from './types';
import type { PrdRuleResult } from './prd-engine';
import type { AIReviewRecord } from './ai/types';

export type PilotRiskLevel = 'GREEN' | 'AMBER' | 'RED' | 'CRITICAL';

export type TVNPriority = 'SEE TODAY' | 'SEE THIS WEEK' | 'MONITOR' | 'HEALING';

export type ClinicalConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type CurrentStatus = 'Improving' | 'Stable' | 'Delayed Healing' | 'Deteriorating';

export type OverallClinicalRisk = 'Low' | 'Moderate' | 'High' | 'Very High';

export type PilotRole = 'tvn' | 'community' | 'carehome';

export interface PilotWoundAssessment {
  date: string;
  surfaceArea: number;
  length: number;
  width: number;
  exudate?: 'Low' | 'Moderate' | 'High';
  tissueType?: string;
  infectionSigns: boolean;
  notes: string;
}

export interface FlaggedReasonItem {
  reason: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface RiskDriver {
  factor: string;
  points: number;
  clinicalNote: string;
  isPrimary: boolean;
}

export interface DataQualityIssue {
  field: string;
  issue: string;
  impact: string;
}

export interface ClinicalReasoning {
  primaryDriver: string;
  secondaryDrivers: string[];
  recommendedAction: string;
  expectedReviewTime: string;
  woundImprovingButHighRisk: boolean;
  highRiskReasons: string[];
  contradictionResolved: boolean;
  contradictionNote: string | null;
  currentStatus: CurrentStatus;
  overallClinicalRisk: OverallClinicalRisk;
}

export interface PilotPatient {
  id: string;
  name: string;
  nhsNumber: string;
  age: number;
  gender: string;
  facility: string;
  clinician: string;
  woundType: string;
  woundLocation: string;
  surfaceArea: number;
  previousSurfaceArea: number;
  length: number;
  width: number;
  depth: number;
  assessmentDate: string;
  lastReviewDate: string;
  daysActive: number;
  daysSinceReview: number;
  diabetes: boolean;
  pad: boolean;
  isDiabeticFootUlcer: boolean;
  infectionSigns: boolean;
  missedReviews: number;
  pressureStage: number;
  areaChangePct: number;
  areaChangeValidated: boolean;
  healingTrend: HealingTrend;
  riskScore: number;
  riskLevel: PilotRiskLevel;
  tvnPriority: TVNPriority;
  expectedReviewTime: string;
  clinicalConfidence: ClinicalConfidence;
  confidenceReasons: string[];
  riskDrivers: RiskDriver[];
  flaggedReasons: FlaggedReasonItem[];
  flaggedReason: string;
  recommendedAction: string;
  tvnRationale: string;
  dataQualityIssues: DataQualityIssue[];
  dataQualityWarning: boolean;
  assessments: PilotWoundAssessment[];
  clinicalReasoning: ClinicalReasoning;
  repeatedDeterioration: boolean;
  failureToHeal: boolean;
  currentStatus: CurrentStatus;
  overallClinicalRisk: OverallClinicalRisk;
  isPressureInjury: boolean;
  reviewDelayDays: number;
  reviewDueText: string;
  // Rule floor (PRD sections 8-10). tvnPriority is the FINAL priority: the rule priority, or the rule
  // priority raised one band by a validated AI escalation (never lowered).
  rulePriority: TVNPriority;
  ruleResult: PrdRuleResult | null;
  aiReview?: AIReviewRecord;
  aiRaised: boolean;
}

export interface PilotUploadSummary {
  fileName: string;
  fileType: 'CSV' | 'Excel' | 'XLSX';
  totalRecords: number;
  uniquePatients: number;
  assessmentsAnalysed: number;
  patientsImported: number;
  woundsImported: number;
  facilitiesImported: number;
  dateRangeStart: string;
  dateRangeEnd: string;
}

export interface PilotFacilitySummary {
  name: string;
  activeWounds: number;
  highRiskWounds: number;
  criticalWounds: number;
  delayedReviews: number;
  overdueAssessments: number;
  healingRate: number;
  improvingCount: number;
  avgRiskScore: number;
}

export type PilotView =
  | 'upload'
  | 'caseload'
  | 'worklist'
  | 'tvn'
  | 'history'
  | 'trajectory'
  | 'handover'
  | 'facility'
  | 'carehome'
  | 'community';

export type TVNSortKey = 'risk' | 'facility' | 'woundType' | 'date';
