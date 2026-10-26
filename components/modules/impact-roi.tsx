'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import {
  isHighRisk,
  isNotImproving,
  isOverdue,
} from '@/lib/selectors-d';
import { HeartPulse, AlertTriangle, TrendingDown, Clock } from 'lucide-react';

export function ImpactROI() {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Impact & ROI" />;

  const total = patients.length;
  const highRisk = patients.filter(isHighRisk).length;
  const notImproving = patients.filter(isNotImproving).length;
  const overdue = patients.filter(isOverdue).length;

  const toneClass: Record<string, { card: string; box: string; icon: string }> = {
    primary: { card: 'border-primary/20', box: 'bg-primary/10', icon: 'text-primary' },
    destructive: { card: 'border-destructive/20', box: 'bg-destructive/10', icon: 'text-destructive' },
    warning: { card: 'border-warning/20', box: 'bg-warning/10', icon: 'text-warning' },
    accent: { card: 'border-accent/20', box: 'bg-accent/10', icon: 'text-accent' },
  };
  const cards = [
    { label: 'Wounds in caseload', value: total, icon: HeartPulse, tone: 'primary' },
    { label: 'High-risk wounds', value: highRisk, icon: AlertTriangle, tone: 'destructive' },
    { label: 'Not improving', value: notImproving, icon: TrendingDown, tone: 'warning' },
    { label: 'Reviews overdue', value: overdue, icon: Clock, tone: 'accent' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impact & ROI</h1>
        <p className="text-sm text-muted-foreground">
          What your uploaded caseload shows. No savings or outcome projections are made.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className={`border-2 ${toneClass[c.tone].card}`}>
            <CardContent className="p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass[c.tone].box}`}>
                <c.icon className={`h-5 w-5 ${toneClass[c.tone].icon}`} />
              </div>
              <p className="mt-3 text-3xl font-bold text-foreground">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
