'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// A short in-memory log of what has happened this session (upload, mapping, AI run, prioritisation), shown
// as Recent Activity on the dashboard. It holds counts and file names only, never patient details, and is
// cleared on sign-out.

export type ActivityKind = 'upload' | 'mapping' | 'ai' | 'priority';

export interface ActivityItem {
  id: number;
  at: number; // epoch ms
  kind: ActivityKind;
  title: string;
  detail: string;
}

interface ActivityState {
  activity: ActivityItem[]; // newest first
  log: (kind: ActivityKind, title: string, detail: string) => void;
  clearActivity: () => void;
}

const ActivityContext = createContext<ActivityState | null>(null);
let nextId = 1;

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const log = useCallback(
    (kind: ActivityKind, title: string, detail: string) =>
      setActivity((prev) => [{ id: nextId++, at: Date.now(), kind, title, detail }, ...prev].slice(0, 50)),
    [],
  );
  const clearActivity = useCallback(() => setActivity([]), []);
  const value = useMemo(() => ({ activity, log, clearActivity }), [activity, log, clearActivity]);
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityState {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used inside ActivityProvider');
  return ctx;
}

export function timeAgo(at: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
