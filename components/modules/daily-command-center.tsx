'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyCaseload } from '@/components/empty-caseload';
import { useCaseload } from '@/lib/caseload-context';
import { getRankedCaseload, getTVNPriorityCounts } from '@/lib/pilot-engine';
import type { PilotPatient, TVNPriority } from '@/lib/pilot-types';
import { isOverdueReview } from '@/lib/selectors-groupa';
import { PilotPatientRow } from './pilot-patient-row';
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  CalendarClock,
  ArrowUpCircle,
  CheckCircle2,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyCommandCenterProps {
  onSelectPatient?: (patient: PilotPatient) => void;
}

export function DailyCommandCenter({ onSelectPatient }: DailyCommandCenterProps) {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Daily Wound Command Center" />;

  const ranked = getRankedCaseload(patients);
  const counts = getTVNPriorityCounts(patients);
  const deteriorating = patients.filter((p) => p.currentStatus === 'Deteriorating');
  const overdueReviews = patients.filter(isOverdueReview);
  const escalations = patients.filter(
    (p) => p.tvnPriority === 'SEE TODAY' || p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL',
  );

  const sections: {
    priority: TVNPriority;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    accent: 'destructive' | 'warning' | 'primary' | 'success';
  }[] = [
    { priority: 'SEE TODAY', title: 'See Today', subtitle: 'Highest priority — see today', icon: <AlertTriangle className="h-5 w-5 text-destructive" />, accent: 'destructive' },
    { priority: 'SEE THIS WEEK', title: 'See This Week', subtitle: 'Review within the week', icon: <Clock className="h-5 w-5 text-warning" />, accent: 'warning' },
    { priority: 'MONITOR', title: 'Monitor', subtitle: 'Continue monitoring', icon: <Timer className="h-5 w-5 text-primary" />, accent: 'primary' },
    { priority: 'HEALING', title: 'Healing', subtitle: 'Healing as expected', icon: <CheckCircle2 className="h-5 w-5 text-success" />, accent: 'success' },
  ];

  const alertCards = [
    {
      label: 'Deteriorating Wounds',
      value: deteriorating.length,
      icon: <TrendingDown className="h-4 w-4 text-destructive" />,
      color: 'border-destructive/20 bg-destructive/5 text-destructive',
    },
    {
      label: 'Overdue Reviews',
      value: overdueReviews.length,
      icon: <CalendarClock className="h-4 w-4 text-warning" />,
      color: 'border-warning/20 bg-warning/5 text-warning',
    },
    {
      label: 'Escalation Candidates',
      value: escalations.length,
      icon: <ArrowUpCircle className="h-4 w-4 text-destructive" />,
      color: 'border-destructive/20 bg-destructive/5 text-destructive',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Timer className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Wound Command Center</h1>
          <p className="text-sm text-muted-foreground">
            {counts['SEE TODAY']} to see today · {counts['SEE THIS WEEK']} this week · {patients.length} in caseload
          </p>
        </div>
      </div>

      {/* Alert summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {alertCards.map((card) => (
          <Card key={card.label} className={cn('border-2 p-4', card.color)}>
            <div className="flex items-center gap-2">
              {card.icon}
              <p className="text-xs font-semibold uppercase tracking-wider">{card.label}</p>
            </div>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
          </Card>
        ))}
      </div>

      {/* Patient sections */}
      {sections.map((section) => {
        const rows = ranked.filter((p) => p.tvnPriority === section.priority);
        return (
          <Card key={section.priority}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {section.icon}
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.subtitle}</CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-sm font-bold',
                    section.accent === 'destructive' ? 'border-destructive/30 text-destructive' :
                    section.accent === 'warning' ? 'border-warning/30 text-warning' :
                    section.accent === 'primary' ? 'border-primary/30 text-primary' :
                    'border-success/30 text-success',
                  )}
                >
                  {rows.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {rows.slice(0, 6).map((p) => (
                  <PilotPatientRow key={p.id} patient={p} onSelect={onSelectPatient} />
                ))}
                {rows.length > 6 && (
                  <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                    +{rows.length - 6} more — see the Daily Priority List
                  </div>
                )}
                {rows.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No patients in this category
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
