'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PilotPatient, TVNPriority } from '@/lib/pilot-types';

// Shared presentation kit for the pilot views. Rules the kit enforces:
//  - one priority label per patient (the TVN priority); risk score is secondary text
//  - nothing smaller than 12px
//  - names and facility text wrap, they are never cut off by a badge cluster
//  - at most three flag chips per row

export const PRIORITY: Record<TVNPriority, { badge: string; bar: string; dot: string; text: string; tint: string; border: string; rank: number }> = {
  'SEE TODAY': { badge: 'border-destructive/30 bg-destructive/10 text-destructive', bar: 'border-l-destructive', dot: 'bg-destructive', text: 'text-destructive', tint: 'bg-destructive/5', border: 'border-destructive/30', rank: 0 },
  'SEE THIS WEEK': { badge: 'border-warning/40 bg-warning/10 text-warning', bar: 'border-l-warning', dot: 'bg-warning', text: 'text-warning', tint: 'bg-warning/5', border: 'border-warning/40', rank: 1 },
  'MONITOR': { badge: 'border-primary/30 bg-primary/10 text-primary', bar: 'border-l-primary', dot: 'bg-primary', text: 'text-primary', tint: 'bg-primary/5', border: 'border-primary/30', rank: 2 },
  'HEALING': { badge: 'border-success/30 bg-success/10 text-success', bar: 'border-l-success', dot: 'bg-success', text: 'text-success', tint: 'bg-success/5', border: 'border-success/30', rank: 3 },
};

export type Tone = 'destructive' | 'warning' | 'success' | 'primary' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  destructive: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
  primary: 'text-primary',
  neutral: 'text-foreground',
};

const TONE_CHIP: Record<Tone, string> = {
  destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
  warning: 'border-warning/40 bg-warning/5 text-warning',
  success: 'border-success/30 bg-success/5 text-success',
  primary: 'border-primary/30 bg-primary/5 text-primary',
  neutral: 'border-border bg-secondary/50 text-muted-foreground',
};

export const statusTone = (s: string): Tone =>
  s === 'Deteriorating' ? 'destructive' : s === 'Delayed Healing' ? 'warning' : s === 'Improving' ? 'success' : 'neutral';

export const riskTone = (r: string): Tone =>
  r === 'Very High' || r === 'High' ? 'destructive' : r === 'Moderate' ? 'warning' : 'success';

export const confidenceTone = (c: string): Tone => (c === 'HIGH' ? 'success' : c === 'MEDIUM' ? 'warning' : 'destructive');

export function AIRaisedChip() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      <Sparkles className="h-3 w-3" />
      AI-raised
    </span>
  );
}

export function PriorityBadge({ priority, size = 'md' }: { priority: TVNPriority; size?: 'md' | 'lg' }) {
  const s = PRIORITY[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold',
        size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs',
        s.badge,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', s.dot)} />
      {priority}
    </span>
  );
}

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium', TONE_CHIP[tone])}>
      {children}
    </span>
  );
}

// The few flags worth surfacing on a list row, most serious first. Everything else lives on the detail page.
export function flagChips(p: PilotPatient): { label: string; tone: Tone }[] {
  const flags: { label: string; tone: Tone }[] = [];
  if (p.infectionSigns) flags.push({ label: 'Infection', tone: 'destructive' });
  if (p.isDiabeticFootUlcer) flags.push({ label: 'DFU', tone: 'destructive' });
  if (p.pad) flags.push({ label: 'PAD', tone: 'warning' });
  if (p.isPressureInjury && p.pressureStage >= 3) flags.push({ label: `Pressure stage ${p.pressureStage}`, tone: 'destructive' });
  if (p.repeatedDeterioration) flags.push({ label: 'Repeated deterioration', tone: 'destructive' });
  if (p.failureToHeal) flags.push({ label: 'Failure to heal', tone: 'warning' });
  if (p.reviewDelayDays > 14) flags.push({ label: `Review overdue ${p.reviewDelayDays}d`, tone: 'warning' });
  return flags.slice(0, 3);
}

export function PatientRow({
  patient,
  rank,
  showReason = false,
  onClick,
}: {
  patient: PilotPatient;
  rank?: number;
  showReason?: boolean;
  onClick: () => void;
}) {
  const s = PRIORITY[patient.tvnPriority];
  const flags = flagChips(patient);
  const reason = patient.flaggedReasons[0]?.reason;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid w-full items-start gap-x-4 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none',
        s.bar,
        rank !== undefined ? 'grid-cols-[2rem_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      {rank !== undefined && (
        <span className="pt-0.5 text-right text-sm font-semibold tabular-nums text-muted-foreground">{rank}</span>
      )}

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="break-words text-sm font-semibold text-foreground">{patient.name}</span>
          {patient.nhsNumber !== 'Not provided' && (
            <span className="text-xs tabular-nums text-muted-foreground">{patient.nhsNumber}</span>
          )}
        </div>
        <p className="break-words text-xs leading-relaxed text-muted-foreground">
          {[patient.woundType, patient.woundLocation, patient.facility].filter((v) => v && v !== 'Unknown').join(' · ')}
        </p>
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {flags.map((f) => (
              <Chip key={f.label} tone={f.tone}>{f.label}</Chip>
            ))}
          </div>
        )}
        {showReason && reason && (
          <p className="line-clamp-2 pt-0.5 text-sm leading-snug text-foreground/80">{reason}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <PriorityBadge priority={patient.tvnPriority} />
        {patient.aiRaised && <AIRaisedChip />}
        <span className="text-xs text-muted-foreground">
          <span className={cn('font-medium', TONE_TEXT[statusTone(patient.currentStatus)])}>{patient.currentStatus}</span>
          <span className="px-1.5">·</span>
          <span className="tabular-nums">Score {patient.riskScore}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      </div>
    </button>
  );
}

export function Section({
  title,
  description,
  icon,
  count,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon}
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight text-foreground">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {count !== undefined && (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-semibold tabular-nums text-foreground">{count}</span>
          )}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}

// A divided list that shows the first `limit` items and offers the rest on request,
// so long caseloads don't need a scroll box inside a card.
export function ShowMore<T>({
  items,
  limit = 8,
  empty = 'None identified',
  render,
}: {
  items: T[];
  limit?: number;
  empty?: string;
  render: (item: T, index: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  const visible = open ? items : items.slice(0, limit);
  return (
    <>
      <div className="divide-y divide-border/60">{visible.map(render)}</div>
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full border-t border-border/60 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-secondary/40"
        >
          {open ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}

export function Metric({ label, value, tone = 'neutral', hint }: { label: string; value: React.ReactNode; tone?: Tone; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/30 px-3.5 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-base font-semibold leading-tight', TONE_TEXT[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Notice({ tone, title, children }: { tone: Tone; title: string; children?: React.ReactNode }) {
  return (
    <div className={cn('flex gap-3 rounded-lg border px-4 py-3', TONE_CHIP[tone])}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && <div className="text-sm leading-relaxed text-foreground/80">{children}</div>}
      </div>
    </div>
  );
}

export function Disclosure({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          {meta}
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

export function PatientPicker({
  patients,
  selectedId,
  onSelect,
}: {
  patients: PilotPatient[];
  selectedId: string;
  onSelect: (p: PilotPatient) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = patients.filter((p) => !q || p.name.toLowerCase().includes(q) || p.facility.toLowerCase().includes(q));

  return (
    <aside className="rounded-xl border border-border bg-card shadow-sm lg:sticky lg:top-4 lg:self-start">
      <div className="space-y-3 border-b border-border p-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Patients</h3>
          <span className="text-xs text-muted-foreground">{filtered.length} of {patients.length}</span>
        </div>
        <input
          type="search"
          placeholder="Search name or facility"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="max-h-[70vh] divide-y divide-border/60 overflow-y-auto scrollbar-thin">
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              'flex w-full items-center gap-3 border-l-4 px-3.5 py-2.5 text-left transition-colors',
              PRIORITY[p.tvnPriority].bar,
              p.id === selectedId ? 'bg-primary/10' : 'hover:bg-secondary/40',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium text-foreground">{p.name}</p>
              <p className="break-words text-xs text-muted-foreground">{p.facility}</p>
            </div>
            <span className={cn('shrink-0 text-xs font-semibold', PRIORITY[p.tvnPriority].text)}>
              {p.tvnPriority === 'SEE TODAY' ? 'Today' : p.tvnPriority === 'SEE THIS WEEK' ? 'Week' : p.tvnPriority === 'MONITOR' ? 'Monitor' : 'Healing'}
            </span>
          </button>
        ))}
        {filtered.length === 0 && <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">No matches</p>}
      </div>
    </aside>
  );
}
