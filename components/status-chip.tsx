import { cn } from '@/lib/utils';
import type { AIStatus, PatientStatus } from '@/lib/worklist-utils';

const STYLE = {
  red: 'border-destructive/30 bg-destructive/10 text-destructive',
  amber: 'border-warning/40 bg-warning/10 text-warning',
  green: 'border-success/30 bg-success/10 text-success',
  grey: 'border-border bg-secondary text-muted-foreground',
};

function Pill({ tone, children }: { tone: keyof typeof STYLE; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold', STYLE[tone])}>{children}</span>;
}

export function StatusChip({ status }: { status: PatientStatus }) {
  return <Pill tone={status === 'Needs Review' ? 'red' : status === 'Pending' ? 'amber' : 'green'}>{status}</Pill>;
}

export function AIStatusChip({ status }: { status: AIStatus }) {
  return <Pill tone={status === 'Accepted' ? 'green' : status === 'Rejected' ? 'red' : status === 'Unavailable' ? 'amber' : 'grey'}>{status}</Pill>;
}
