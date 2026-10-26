'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyCaseload } from '@/components/empty-caseload';
import { useCaseload } from '@/lib/caseload-context';
import type { TVNPriority } from '@/lib/pilot-types';
import { getEscalationList, primaryReason } from '@/lib/selectors-groupa';
import { PilotRiskBadge, PriorityBadge } from './pilot-patient-row';
import {
  Brain,
  ArrowUpCircle,
  AlertCircle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Filter = 'all' | TVNPriority;

export function EscalationEngine() {
  const { patients, hasData } = useCaseload();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  if (!hasData) return <EmptyCaseload title="Intelligent Escalation Engine" />;

  const all = getEscalationList(patients);
  const filtered = filter === 'all' ? all : all.filter((p) => p.tvnPriority === filter);
  const today = all.filter((p) => p.tvnPriority === 'SEE TODAY').length;
  const week = all.filter((p) => p.tvnPriority === 'SEE THIS WEEK').length;
  const redCritical = all.filter((p) => p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL').length;

  const filters: Filter[] = ['all', 'SEE TODAY', 'SEE THIS WEEK', 'MONITOR', 'HEALING'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <ArrowUpCircle className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intelligent Escalation Engine</h1>
          <p className="text-sm text-muted-foreground">
            Every recommendation shows WHY, Evidence Trigger, Clinical Reasoning, and Required Action
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="mt-2 text-2xl font-bold text-destructive">{today}</p>
          <p className="text-xs text-muted-foreground">See Today</p>
        </Card>
        <Card className="border-warning/20 bg-warning/5 p-4">
          <CalendarClock className="h-5 w-5 text-warning" />
          <p className="mt-2 text-2xl font-bold text-warning">{week}</p>
          <p className="text-xs text-muted-foreground">See This Week</p>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <ArrowUpCircle className="h-5 w-5 text-destructive" />
          <p className="mt-2 text-2xl font-bold text-destructive">{redCritical}</p>
          <p className="text-xs text-muted-foreground">RED / CRITICAL Risk</p>
        </Card>
      </div>

      {/* Priority filter */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter === t
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {/* Escalation cards */}
      <div className="space-y-3">
        {filtered.map((p) => {
          const isExpanded = expandedId === p.id;
          const urgent = p.tvnPriority === 'SEE TODAY' || p.riskLevel === 'CRITICAL';
          const reason = primaryReason(p);
          const evidence = p.riskDrivers.length > 0
            ? p.riskDrivers.map((d) => `${d.factor}: ${d.clinicalNote}`)
            : p.flaggedReasons.map((r) => r.reason);
          return (
            <Card key={p.id} className={cn('transition-shadow', isExpanded && 'shadow-md')}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                className="cursor-pointer p-4"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    urgent ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning',
                  )}>
                    <ArrowUpCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{p.name}</p>
                      <PriorityBadge priority={p.tvnPriority} />
                      <PilotRiskBadge level={p.riskLevel} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.facility} · {p.woundType} · {p.woundLocation}</p>
                    {reason && <p className="mt-1 text-xs text-foreground/80">{reason}</p>}
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              </div>

              {isExpanded && (
                <CardContent className="border-t border-border p-4 space-y-3 bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Escalation Reasoning</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-1">WHY</p>
                      <p className="text-xs text-foreground">{reason || p.flaggedReason}</p>
                      {p.flaggedReasons.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {p.flaggedReasons.map((r, i) => (
                            <li key={i} className="text-xs text-muted-foreground">• {r.reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Evidence Trigger</p>
                      {evidence.length > 0 ? (
                        <ul className="space-y-0.5">
                          {evidence.map((e, i) => (
                            <li key={i} className="text-xs text-foreground">• {e}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">No individual drivers recorded</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Clinical Reasoning</p>
                      <p className="text-xs text-foreground">{p.tvnRationale}</p>
                      <Badge variant="outline" className="mt-2 text-[11px]">Confidence: {p.clinicalConfidence}</Badge>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-warning mb-1">Required Action</p>
                      <p className="text-xs text-foreground">{p.recommendedAction}</p>
                      {p.expectedReviewTime && (
                        <p className="mt-1 text-xs font-semibold text-warning">Review: {p.expectedReviewTime}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No escalation candidates in this category
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
