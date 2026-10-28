'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Brain, CalendarClock, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, Eye, HeartPulse, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyCaseload } from '@/components/empty-caseload';
import { FacilitySelect } from '@/components/facility-select';
import { useCaseload } from '@/lib/caseload-context';
import { useAI } from '@/lib/ai/ai-context';
import { useWorkspace } from '@/lib/workspace-context';
import { getRankedCaseload } from '@/lib/pilot-engine';
import type { PilotPatient, TVNPriority } from '@/lib/pilot-types';
import { PilotPatientRow } from './pilot-patient-row';
import { cn } from '@/lib/utils';

interface WorklistProps {
  onSelectPatient: (patient: PilotPatient) => void;
}

const SECTIONS: { priority: TVNPriority; title: string; hint: string; icon: React.ReactNode; badge: string; card: string }[] = [
  { priority: 'SEE TODAY', title: 'See Today', hint: 'Due today', icon: <AlertTriangle className="h-5 w-5 text-destructive" />, badge: 'border-destructive/30 text-destructive', card: 'border-destructive/20 bg-destructive/5 text-destructive' },
  { priority: 'SEE THIS WEEK', title: 'See This Week', hint: 'Due by the end of the week', icon: <CalendarClock className="h-5 w-5 text-warning" />, badge: 'border-warning/30 text-warning', card: 'border-warning/20 bg-warning/5 text-warning' },
  { priority: 'MONITOR', title: 'Monitor', hint: 'Next scheduled visit', icon: <Eye className="h-5 w-5 text-primary" />, badge: 'border-primary/30 text-primary', card: 'border-primary/20 bg-primary/5 text-primary' },
  { priority: 'HEALING', title: 'Healing', hint: 'Next scheduled visit', icon: <HeartPulse className="h-5 w-5 text-success" />, badge: 'border-success/30 text-success', card: 'border-success/20 bg-success/5 text-success' },
];

function whenLabel(day: string | null): string {
  if (!day) return '';
  const today = format(new Date(), 'yyyy-MM-dd');
  return day === today ? 'today' : format(parseISO(day), 'EEE d MMM');
}

export function Worklist({ onSelectPatient }: WorklistProps) {
  const { hasData } = useCaseload();
  const { facility, scoped, isReviewed, reviewedDay, markReviewed, undoReviewed } = useWorkspace();
  const { running, stats, runReview, usingDemo } = useAI();
  const [showVisited, setShowVisited] = useState(false);

  if (!hasData) return <EmptyCaseload title="Prioritisation" />;

  const ranked = getRankedCaseload(scoped);
  const pending = ranked.filter((p) => !isReviewed(p));
  const visited = ranked.filter((p) => isReviewed(p));
  const countOf = (pr: TVNPriority) => pending.filter((p) => p.tvnPriority === pr).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prioritisation</h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} to see · {visited.length} visited{facility ? ` · ${facility}` : ' · all facilities'}
          </p>
        </div>
        <FacilitySelect className="sm:w-72" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
        <Brain className="h-4 w-4 text-primary" />
        {running && stats ? (
          <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />AI reviewing patients: {stats.done} of {stats.total}</span>
        ) : stats ? (
          <span>AI reviewed <span className="font-medium text-foreground">{stats.accepted}</span> of {stats.total} patients{usingDemo ? ' (demo reviewer)' : ''}</span>
        ) : (
          <span>AI review has not run yet</span>
        )}
        {!running && (
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => runReview({ force: true })}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />Re-run
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SECTIONS.map((s) => (
          <Card key={s.priority} className={cn('border-2 p-4', s.card)}>
            <div className="flex items-center gap-2">
              {s.icon}
              <p className="text-[11px] font-semibold uppercase tracking-wider">{s.title}</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{countOf(s.priority)}</p>
          </Card>
        ))}
      </div>

      {scoped.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No patients in this facility.</CardContent></Card>
      )}

      {scoped.length > 0 && pending.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCheck className="h-8 w-8 text-success" />
            <p className="font-semibold">Everyone on this list has been visited</p>
            <p className="text-sm text-muted-foreground">Patients return here when they are next due.</p>
          </CardContent>
        </Card>
      )}

      {SECTIONS.map((s) => {
        const rows = pending.filter((p) => p.tvnPriority === s.priority);
        if (rows.length === 0) return null;
        return (
          <Card key={s.priority}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.icon}
                  <div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <CardDescription>{s.hint}, highest risk first</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className={cn('text-sm font-bold', s.badge)}>{rows.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {rows.map((p) => (
                  <div key={p.id} className="flex items-stretch">
                    <div className="min-w-0 flex-1">
                      <PilotPatientRow patient={p} onSelect={onSelectPatient} showDetail />
                    </div>
                    <div className="flex items-center pr-3">
                      <Button variant="outline" size="sm" onClick={() => markReviewed(p)} aria-label={`Mark ${p.name} reviewed`}>
                        <CheckCircle2 className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Reviewed</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {visited.length > 0 && (
        <Card>
          <button type="button" onClick={() => setShowVisited((v) => !v)} className="flex w-full items-center justify-between px-6 py-4 text-left">
            <span className="flex items-center gap-2">
              {showVisited ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CheckCheck className="h-5 w-5 text-success" />
              <span className="text-base font-semibold">Visited</span>
            </span>
            <Badge variant="outline" className="text-sm font-bold">{visited.length}</Badge>
          </button>
          {showVisited && (
            <CardContent className="p-0">
              <div className="divide-y divide-border/50 border-t border-border/50">
                {visited.map((p) => (
                  <div key={p.id} className="flex items-stretch">
                    <div className="min-w-0 flex-1 opacity-70">
                      <PilotPatientRow patient={p} onSelect={onSelectPatient} />
                    </div>
                    <div className="flex items-center gap-3 pr-3">
                      <span className="hidden text-xs text-muted-foreground sm:inline">Visited {whenLabel(reviewedDay(p))}</span>
                      <Button variant="ghost" size="sm" onClick={() => undoReviewed(p)} aria-label={`Undo review for ${p.name}`}>
                        <RotateCcw className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Undo</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
