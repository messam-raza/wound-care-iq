'use client';

import { useState } from 'react';
import { Brain, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyCaseload } from '@/components/empty-caseload';
import { FacilitySelect } from '@/components/facility-select';
import { AIStatusChip } from '@/components/status-chip';
import { PriorityBadge, AIRaisedChip } from '@/components/pilot-ui';
import { useAI } from '@/lib/ai/ai-context';
import { AI_CONFIG } from '@/lib/ai/config';
import { useCaseload } from '@/lib/caseload-context';
import { useWorkspace } from '@/lib/workspace-context';
import { getRankedCaseload } from '@/lib/pilot-engine';
import { aiStatus, type AIStatus } from '@/lib/worklist-utils';
import type { PilotPatient } from '@/lib/pilot-types';
import { cn } from '@/lib/utils';

const FILTERS: ('All' | AIStatus)[] = ['All', 'Accepted', 'Pending', 'Rejected', 'Unavailable'];

export function AIReviews({ onSelectPatient }: { onSelectPatient: (p: PilotPatient) => void }) {
  const { hasData, aiMode } = useCaseload();
  const { scoped } = useWorkspace();
  const { running, stats, runReview, cancel, usingDemo } = useAI();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  if (!hasData) return <EmptyCaseload title="AI Reviews" />;

  const ranked = getRankedCaseload(scoped);
  const count = (s: AIStatus) => scoped.filter((p) => aiStatus(p) === s).length;
  const rows = ranked.filter((p) => filter === 'All' || aiStatus(p) === filter);
  const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Reviews</h1>
          <p className="text-muted-foreground">Plain-English review of every patient. The rules set the minimum priority; the AI can raise it by one band, never lower it.</p>
        </div>
        <div className="flex items-end gap-3">
          <FacilitySelect className="w-56" />
          {running ? <Button variant="outline" onClick={cancel}>Cancel</Button> : (
            <Button onClick={() => runReview({ force: true })}><Sparkles className="mr-2 h-4 w-4" />Re-run AI review</Button>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium"><Brain className="h-4 w-4 text-primary" />{usingDemo ? 'Demo reviewer (no provider connected)' : `${AI_CONFIG.model} via Groq`}</span>
          <span className="text-muted-foreground">Mode: {aiMode === 'apply' ? 'escalations applied' : 'shadow (recorded, not applied)'}</span>
          <span className="text-muted-foreground">Reviewed in priority order, See Today first</span>
        </div>
        {stats && (
          <div className="mt-4 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">{running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{stats.done} of {stats.total} processed</span>
              <span><b className="text-foreground">{stats.accepted}</b> accepted</span>
              <span><b className="text-foreground">{stats.escalated}</b> AI-raised</span>
              <span><b className="text-foreground">{stats.rejected}</b> rejected by guardrails</span>
              <span><b className="text-foreground">{stats.unavailable}</b> unavailable</span>
            </p>
            {running && !usingDemo && <p className="text-xs text-muted-foreground">Hosted-model plans limit how many reviews can run each minute, so a large caseload can take a while. You can keep working; reviews fill in as they finish.</p>}
            {stats.stoppedReason && <p className="text-sm text-warning">{stats.stoppedReason}</p>}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
            {f}{f !== 'All' ? ` (${count(f)})` : ` (${scoped.length})`}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground">
              <tr>{['Patient', 'Facility', 'Priority', 'AI Review Summary', 'AI Status', 'Actions'].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.id}</p></td>
                  <td className="px-4 py-3">{p.facility}</td>
                  <td className="space-y-1 px-4 py-3"><PriorityBadge priority={p.tvnPriority} />{p.aiRaised && <div><AIRaisedChip /></div>}</td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground"><span className="line-clamp-3">{p.flaggedReason}</span></td>
                  <td className="px-4 py-3"><AIStatusChip status={aiStatus(p)} /></td>
                  <td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => onSelectPatient(p)}>View</Button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No patients match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
