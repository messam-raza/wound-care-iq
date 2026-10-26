'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getRankedCaseload } from '@/lib/pilot-engine';
import type { CurrentStatus } from '@/lib/pilot-types';
import { Heart, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const PROGRESS_STYLES: Record<CurrentStatus, { icon: React.ReactNode; color: string; bg: string }> = {
  'Improving': { icon: <TrendingUp className="h-4 w-4 text-success" />, color: 'text-success', bg: 'bg-success/5 border-success/20' },
  'Stable': { icon: <Minus className="h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground', bg: 'bg-secondary/30 border-border' },
  'Delayed Healing': { icon: <Minus className="h-4 w-4 text-warning" />, color: 'text-warning', bg: 'bg-warning/5 border-warning/20' },
  'Deteriorating': { icon: <TrendingDown className="h-4 w-4 text-destructive" />, color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/20' },
};

export function PatientCentredCare() {
  const { patients, hasData } = useCaseload();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!hasData) return <EmptyCaseload title="Patient-Centred Care" />;

  const ranked = getRankedCaseload(patients);
  const selected = ranked.find((p) => p.id === selectedId) || ranked[0];
  const style = PROGRESS_STYLES[selected.currentStatus];
  const assessments = [...selected.assessments].sort((a, b) => a.date.localeCompare(b.date));
  const first = assessments[0];
  const latest = assessments[assessments.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Heart className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient-Centred Care</h1>
          <p className="text-sm text-muted-foreground">
            Healing progress and next review for each patient, from recorded assessments
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Patients</CardTitle>
            <CardDescription>{ranked.length} in caseload, highest priority first</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[520px] overflow-y-auto p-0 scrollbar-thin">
            {ranked.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn('flex w-full items-center justify-between gap-2 border-b border-border/50 px-4 py-3 text-left hover:bg-secondary/20',
                  p.id === selected.id && 'bg-secondary/40')}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.woundType} · {p.facility}</p>
                </div>
                <span className={cn('shrink-0 text-xs font-medium', PROGRESS_STYLES[p.currentStatus].color)}>{p.currentStatus}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className={cn('border', style.bg)}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{selected.name}</CardTitle>
                  <CardDescription>{selected.woundType} · {selected.woundLocation} · {selected.facility}</CardDescription>
                </div>
                <Badge variant="outline" className={cn('flex items-center gap-1 text-xs', style.color)}>
                  {style.icon}
                  {selected.currentStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Current area</p>
                <p className="font-semibold">{selected.surfaceArea} cm²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previous area</p>
                <p className="font-semibold">{selected.previousSurfaceArea} cm²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Area change</p>
                <p className="font-semibold">{selected.areaChangePct}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Days active</p>
                <p className="font-semibold">{selected.daysActive}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                Next Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Priority:</span> <span className="font-semibold">{selected.tvnPriority}</span></p>
              <p><span className="text-muted-foreground">Expected review:</span> <span className="font-semibold">{selected.expectedReviewTime}</span></p>
              <p><span className="text-muted-foreground">Last review:</span> {selected.lastReviewDate ? `${formatDate(selected.lastReviewDate)} (${selected.daysSinceReview} days ago)` : 'No review date recorded'}</p>
              <p><span className="text-muted-foreground">Recommended action:</span> {selected.recommendedAction}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assessment History</CardTitle>
              {first && latest && assessments.length > 1 && (
                <CardDescription>
                  Area {first.surfaceArea} cm² on {formatDate(first.date)} to {latest.surfaceArea} cm² on {formatDate(latest.date)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {assessments.map((a, i) => (
                  <div key={`${a.date}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="text-muted-foreground">{formatDate(a.date)}</span>
                    <span className="font-medium">{a.surfaceArea} cm²</span>
                    {a.length > 0 && a.width > 0 && <span className="text-xs text-muted-foreground">{a.length} × {a.width} cm</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
