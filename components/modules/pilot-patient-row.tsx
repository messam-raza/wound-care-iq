'use client';

import { PatientRow } from '@/components/pilot-ui';
import type { PilotPatient, PilotRiskLevel } from '@/lib/pilot-types';
import { RISK_TONE } from '@/lib/selectors-groupa';
import { cn } from '@/lib/utils';

const TONE_CLASS = {
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  success: 'bg-success/10 text-success border-success/30',
  primary: 'bg-primary/10 text-primary border-primary/30',
};

const DOT_CLASS = {
  destructive: 'bg-destructive',
  warning: 'bg-warning',
  success: 'bg-success',
  primary: 'bg-primary',
};

export function PilotRiskBadge({ level, className }: { level: PilotRiskLevel; className?: string }) {
  const tone = RISK_TONE[level];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', TONE_CLASS[tone], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASS[tone])} />
      {level}
    </span>
  );
}

export { PriorityBadge } from '@/components/pilot-ui';

interface PilotPatientRowProps {
  patient: PilotPatient;
  onSelect?: (patient: PilotPatient) => void;
  showPriority?: boolean; // kept for callers; the shared row always shows priority
  showDetail?: boolean;
  rank?: number;
}

// Delegates to the shared PatientRow so every module lists patients the same way.
export function PilotPatientRow({ patient, onSelect, showDetail, rank }: PilotPatientRowProps) {
  return (
    <PatientRow
      patient={patient}
      rank={rank !== undefined ? rank + 1 : undefined}
      showReason={showDetail}
      onClick={() => onSelect?.(patient)}
    />
  );
}
