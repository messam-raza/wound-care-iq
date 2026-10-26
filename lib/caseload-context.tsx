'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PilotPatient, PilotUploadSummary } from './pilot-types';
import type { AIReviewRecord } from './ai/types';
import { applyAIReview, type AIMode } from './ai/apply';

// The single source of truth for patient data in the app. Every module reads the
// caseload the user uploaded as CSV; nothing is generated or seeded. State is held in
// memory only, so patient data is never written to browser storage.

interface CaseloadState {
  patients: PilotPatient[]; // final view: rule floor, plus any validated AI escalation (when mode is 'apply')
  basePatients: PilotPatient[]; // rule results only
  aiReviews: Record<string, AIReviewRecord>;
  aiMode: AIMode;
  setAIMode: (m: AIMode) => void;
  putAIReview: (r: AIReviewRecord) => void;
  flagAIReview: (patientId: string) => void;
  clearAIReviews: () => void;
  summary: PilotUploadSummary | null;
  hasData: boolean;
  setCaseload: (patients: PilotPatient[], summary: PilotUploadSummary) => void;
  clearCaseload: () => void;
}

const CaseloadContext = createContext<CaseloadState | null>(null);

export function CaseloadProvider({ children }: { children: React.ReactNode }) {
  const [basePatients, setPatients] = useState<PilotPatient[]>([]);
  const [summary, setSummary] = useState<PilotUploadSummary | null>(null);
  const [aiReviews, setAIReviews] = useState<Record<string, AIReviewRecord>>({});
  const [aiMode, setAIMode] = useState<AIMode>('apply');

  const setCaseload = useCallback((p: PilotPatient[], s: PilotUploadSummary) => {
    setPatients(p);
    setSummary(s);
    setAIReviews({}); // a new upload invalidates earlier reviews
  }, []);

  const clearCaseload = useCallback(() => {
    setPatients([]);
    setSummary(null);
    setAIReviews({});
  }, []);

  const putAIReview = useCallback((r: AIReviewRecord) => setAIReviews((prev) => ({ ...prev, [r.patientId]: r })), []);
  const clearAIReviews = useCallback(() => setAIReviews({}), []);
  const flagAIReview = useCallback(
    (id: string) => setAIReviews((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], flaggedWrong: true } } : prev)),
    [],
  );

  const patients = useMemo(() => basePatients.map((p) => applyAIReview(p, aiReviews[p.id], aiMode)), [basePatients, aiReviews, aiMode]);

  const value = useMemo(
    () => ({ patients, basePatients, aiReviews, aiMode, setAIMode, putAIReview, flagAIReview, clearAIReviews, summary, hasData: basePatients.length > 0, setCaseload, clearCaseload }),
    [patients, basePatients, aiReviews, aiMode, putAIReview, flagAIReview, clearAIReviews, summary, setCaseload, clearCaseload],
  );

  return <CaseloadContext.Provider value={value}>{children}</CaseloadContext.Provider>;
}

export function useCaseload(): CaseloadState {
  const ctx = useContext(CaseloadContext);
  if (!ctx) throw new Error('useCaseload must be used inside CaseloadProvider');
  return ctx;
}
