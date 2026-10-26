import type { PilotPatient } from './pilot-types';
import type { DataQualityReport, FacilityIntelligence, WorkforceIntelligence } from './import-types';

// Selectors for the hub, cost, impact and report modules. Every figure is a count or
// ratio computed from the uploaded caseload; nothing is estimated.

export const isHighRisk = (p: PilotPatient) => p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL';
export const isNotImproving = (p: PilotPatient) => p.healingTrend !== 'Improving';
export const isOverdue = (p: PilotPatient) => p.reviewDelayDays > 0;

export function buildQualityReport(patients: PilotPatient[]): DataQualityReport {
  const count = (fn: (p: PilotPatient) => boolean) => patients.filter(fn).length;
  const total = patients.length;
  const completeRecords = count((p) => p.dataQualityIssues.length === 0 && p.name !== 'Unknown Patient' && p.facility !== 'Unknown Facility' && p.clinician !== 'Unassigned');
  return {
    totalRecords: total,
    completeRecords,
    missingNames: count((p) => p.name === 'Unknown Patient'),
    missingFacilities: count((p) => p.facility === 'Unknown Facility'),
    missingMeasurements: count((p) => p.dataQualityIssues.some((i) => i.field === 'Wound Measurements')),
    expiredAssessments: count((p) => !!p.lastReviewDate && p.daysSinceReview > 90),
    missingClinicans: count((p) => p.clinician === 'Unassigned'),
    completenessPct: total > 0 ? Math.round((completeRecords / total) * 100) : 0,
  };
}

export function buildFacilityStats(patients: PilotPatient[]): FacilityIntelligence[] {
  const byFacility = new Map<string, PilotPatient[]>();
  for (const p of patients) {
    const list = byFacility.get(p.facility) || [];
    list.push(p);
    byFacility.set(p.facility, list);
  }
  return Array.from(byFacility.entries()).map(([name, fps]) => {
    const n = fps.length;
    const pct = (x: number) => (n > 0 ? Math.round((x / n) * 100) : 0);
    const complete = fps.filter((p) => p.dataQualityIssues.length === 0).length;
    return {
      name,
      totalPatients: n,
      highRisk: fps.filter(isHighRisk).length,
      amber: fps.filter((p) => p.riskLevel === 'AMBER').length,
      green: fps.filter((p) => p.riskLevel === 'GREEN').length,
      healingRate: pct(fps.filter((p) => p.healingTrend === 'Improving').length),
      dataQualityScore: pct(complete),
      clinicalRiskScore: n > 0 ? Math.round(fps.reduce((s, p) => s + p.riskScore, 0) / n) : 0,
      clinicians: Array.from(new Set(fps.map((p) => p.clinician).filter(Boolean))),
    };
  });
}

export function buildWorkforceStats(patients: PilotPatient[]): WorkforceIntelligence[] {
  const byClinician = new Map<string, PilotPatient[]>();
  for (const p of patients) {
    const key = p.clinician || 'Unassigned';
    const list = byClinician.get(key) || [];
    list.push(p);
    byClinician.set(key, list);
  }
  return Array.from(byClinician.entries())
    .map(([clinician, cps]) => {
      const highRiskWounds = cps.filter(isHighRisk).length;
      return {
        clinician,
        facility: cps[0]?.facility || '',
        totalWounds: cps.length,
        highRiskWounds,
        reviewBurden: Math.round((highRiskWounds / Math.max(cps.length, 1)) * 100),
      };
    })
    .sort((a, b) => b.highRiskWounds - a.highRiskWounds);
}

export const isVLU = (p: PilotPatient) => /venous|leg ulcer|vlu/i.test(p.woundType);
