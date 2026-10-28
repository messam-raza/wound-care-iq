'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useCaseload } from './caseload-context';
import { PRIORITY_RANK } from './ai/action-library';
import type { PilotPatient, TVNPriority } from './pilot-types';

// What the TVN is working on right now: which facility's list they are looking at, and which patients they
// have already visited. Both sit on top of the caseload; neither changes a priority.
//
//  - Facility: one TVN covers one or more facilities and picks which one to work through. The choice is
//    remembered on this device (a facility name is not patient data).
//  - Reviewed: marking a patient reviewed moves them from the priority list to the Visited section. A mark
//    lapses on its own so the patient returns to the list when they are due again:
//      SEE TODAY      lapses at midnight (due again the next day)
//      other bands    lapse at the start of the next week (Monday)
//    A mark also lapses straight away if the patient has since been raised to a more urgent band.
//    Marks hold patient IDs, so they live in sessionStorage (this tab only) and are wiped on sign-out.

const REVIEWED_KEY = 'wciq_reviewed';
const FACILITY_KEY = 'wciq_facility';
const REGIONS_KEY = 'wciq_regions';

export interface ReviewMark {
  day: string; // YYYY-MM-DD, local
  priority: TVNPriority; // band when it was marked
}

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Monday of the week containing the given YYYY-MM-DD day.
function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localDay(date);
}

export function isMarkActive(mark: ReviewMark | undefined, patient: PilotPatient, today: string): boolean {
  if (!mark) return false;
  if (PRIORITY_RANK[patient.tvnPriority] < PRIORITY_RANK[mark.priority]) return false; // raised since the visit
  return mark.priority === 'SEE TODAY' ? mark.day === today : weekStart(mark.day) === weekStart(today);
}

interface WorkspaceState {
  facility: string; // '' means every facility
  setFacility: (f: string) => void;
  regions: Record<string, string>; // facility name -> region, set on Facilities & Mapping
  setRegion: (facility: string, region: string) => void;
  facilities: string[];
  scoped: PilotPatient[]; // the caseload for the selected facility
  isReviewed: (p: PilotPatient) => boolean;
  reviewedDay: (p: PilotPatient) => string | null;
  markReviewed: (p: PilotPatient) => void;
  undoReviewed: (p: PilotPatient) => void;
  reset: () => void; // sign-out
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { patients } = useCaseload();
  const [facilityRaw, setFacilityRaw] = useState('');
  const [marks, setMarks] = useState<Record<string, ReviewMark>>({});
  const [regions, setRegions] = useState<Record<string, string>>({});
  const [today, setToday] = useState(() => localDay());

  useEffect(() => {
    try {
      setFacilityRaw(localStorage.getItem(FACILITY_KEY) ?? '');
      const rg = localStorage.getItem(REGIONS_KEY);
      if (rg) setRegions(JSON.parse(rg));
      const raw = sessionStorage.getItem(REVIEWED_KEY);
      if (raw) setMarks(JSON.parse(raw));
    } catch {
      // storage unavailable or corrupt: start empty
    }
  }, []);

  // Keeps "today" current so a tab left open overnight rolls over without a refresh.
  useEffect(() => {
    const t = setInterval(() => setToday(localDay()), 60_000);
    return () => clearInterval(t);
  }, []);

  const facilities = useMemo(
    () => Array.from(new Set(patients.map((p) => p.facility))).sort((a, b) => a.localeCompare(b)),
    [patients],
  );
  // A remembered facility that is not in the loaded file falls back to showing everything.
  const facility = facilities.includes(facilityRaw) ? facilityRaw : '';
  const scoped = useMemo(() => (facility ? patients.filter((p) => p.facility === facility) : patients), [patients, facility]);

  const setFacility = useCallback((f: string) => {
    setFacilityRaw(f);
    try {
      localStorage.setItem(FACILITY_KEY, f);
    } catch {
      // ignore
    }
  }, []);

  const setRegion = useCallback((f: string, region: string) => {
    setRegions((prev) => {
      const next = { ...prev };
      if (region.trim()) next[f] = region.trim();
      else delete next[f];
      try {
        localStorage.setItem(REGIONS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const persist = (next: Record<string, ReviewMark>) => {
    try {
      sessionStorage.setItem(REVIEWED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const markReviewed = useCallback(
    (p: PilotPatient) =>
      setMarks((prev) => {
        const next = { ...prev, [p.id]: { day: localDay(), priority: p.tvnPriority } };
        persist(next);
        return next;
      }),
    [],
  );

  const undoReviewed = useCallback(
    (p: PilotPatient) =>
      setMarks((prev) => {
        const { [p.id]: _removed, ...next } = prev;
        persist(next);
        return next;
      }),
    [],
  );

  const reset = useCallback(() => {
    setMarks({});
    try {
      sessionStorage.removeItem(REVIEWED_KEY);
    } catch {
      // ignore
    }
  }, []);

  const isReviewed = useCallback((p: PilotPatient) => isMarkActive(marks[p.id], p, today), [marks, today]);
  const reviewedDay = useCallback((p: PilotPatient) => (isMarkActive(marks[p.id], p, today) ? marks[p.id].day : null), [marks, today]);

  const value = useMemo(
    () => ({ facility, setFacility, regions, setRegion, facilities, scoped, isReviewed, reviewedDay, markReviewed, undoReviewed, reset }),
    [facility, setFacility, regions, setRegion, facilities, scoped, isReviewed, reviewedDay, markReviewed, undoReviewed, reset],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
