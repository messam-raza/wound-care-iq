import type { HealingTrend } from './types';

export interface RawRow {
  [key: string]: string;
}

export interface ColumnMapping {
  csvColumn: string;
  targetField: TargetField | '';
}

export type TargetField =
  | 'patientId'
  | 'nhsNumber'
  | 'patientName'
  | 'facility'
  | 'clinician'
  | 'woundType'
  | 'woundLocation'
  | 'length'
  | 'width'
  | 'depth'
  | 'woundSize'
  | 'assessmentDate'
  | 'lastReviewDate'
  | 'diabetes'
  | 'pad'
  | 'pressureStage'
  | 'infectionSigns'
  | 'age'
  | 'gender'
  | 'missedReviews';

export const TARGET_FIELD_LABELS: Record<TargetField, string> = {
  patientId: 'Patient ID',
  nhsNumber: 'NHS Number',
  patientName: 'Patient Name',
  facility: 'Facility',
  clinician: 'Clinician',
  woundType: 'Wound Type',
  woundLocation: 'Wound Location',
  length: 'Length (cm)',
  width: 'Width (cm)',
  depth: 'Depth (cm)',
  woundSize: 'Wound Size / Area (cm²)',
  assessmentDate: 'Assessment Date',
  lastReviewDate: 'Last Review Date',
  diabetes: 'Diabetes',
  pad: 'Peripheral Arterial Disease (PAD)',
  pressureStage: 'Pressure Injury Stage',
  infectionSigns: 'Infection Signs',
  age: 'Age',
  gender: 'Gender',
  missedReviews: 'Missed Reviews',
};

export interface ImportedPatient {
  id: string;
  nhsNumber: string;
  name: string;
  facility: string;
  clinician: string;
  woundType: string;
  woundLocation: string;
  length: number;
  width: number;
  depth: number;
  surfaceArea: number;
  assessmentDate: string;
  lastReviewDate: string;
  diabetes: boolean;
  pad: boolean;
  pressureStage: number;
  infectionSigns: boolean;
  age: number;
  gender: string;
  missedReviews: number;
  daysActive: number;
  areaChangePct: number;
  healingTrend: HealingTrend;
  dataQualityFlags: DataQualityFlag[];
}

export type DataQualityFlag =
  | 'missing_name'
  | 'missing_facility'
  | 'missing_measurements'
  | 'missing_assessment_date'
  | 'missing_wound_type'
  | 'expired_assessment'
  | 'missing_clinician';

export interface DataQualityReport {
  totalRecords: number;
  completeRecords: number;
  missingNames: number;
  missingFacilities: number;
  missingMeasurements: number;
  expiredAssessments: number;
  missingClinicans: number;
  completenessPct: number;
}

export interface FacilityIntelligence {
  name: string;
  totalPatients: number;
  highRisk: number;
  amber: number;
  green: number;
  healingRate: number;
  dataQualityScore: number;
  clinicalRiskScore: number;
  clinicians: string[];
}

export interface WorkforceIntelligence {
  clinician: string;
  facility: string;
  totalWounds: number;
  highRiskWounds: number;
  reviewBurden: number;
}

export interface ParsedUpload {
  fileName: string;
  rawRows: RawRow[];
  headers: string[];
  suggestedMappings: ColumnMapping[];
}
