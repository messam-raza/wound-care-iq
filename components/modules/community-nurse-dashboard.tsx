'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyCaseload } from '@/components/empty-caseload';
import { useCaseload } from '@/lib/caseload-context';
import { getCommunityNurseView } from '@/lib/pilot-engine';
import type { PilotPatient } from '@/lib/pilot-types';
import { isOverdueReview } from '@/lib/selectors-groupa';
import { PilotPatientRow } from './pilot-patient-row';
import {
  ClipboardList,
  CalendarX,
  AlertTriangle,
  ArrowUpCircle,
  TrendingDown,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommunityNurseDashboardProps {
  onSelectPatient?: (patient: PilotPatient) => void;
}

export function CommunityNurseDashboard({ onSelectPatient }: CommunityNurseDashboardProps) {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Community Nurse Dashboard" />;

  const view = getCommunityNurseView(patients);
  const notReviewedRecently = patients
    .filter(isOverdueReview)
    .sort((a, b) => b.daysSinceReview - a.daysSinceReview);

  const summaryCards = [
    {
      label: 'Total Caseload',
      value: patients.length,
      icon: <ClipboardList className="h-5 w-5 text-primary" />,
      color: 'border-primary/20 bg-primary/5 text-primary',
    },
    {
      label: 'Overdue Reviews',
      value: notReviewedRecently.length,
      icon: <CalendarX className="h-5 w-5 text-warning" />,
      color: 'border-warning/20 bg-warning/5 text-warning',
    },
    {
      label: 'See Today',
      value: view.todayPriorities.length,
      icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      color: 'border-destructive/20 bg-destructive/5 text-destructive',
    },
    {
      label: 'Potential Escalations',
      value: view.potentialEscalations.length,
      icon: <ArrowUpCircle className="h-5 w-5 text-destructive" />,
      color: 'border-destructive/20 bg-destructive/5 text-destructive',
    },
  ];

  const renderList = (rows: PilotPatient[], empty: string, limit = 5) => (
    <div className="divide-y divide-border/50">
      {rows.slice(0, limit).map((p) => (
        <PilotPatientRow key={p.id} patient={p} onSelect={onSelectPatient} showPriority />
      ))}
      {rows.length > limit && (
        <div className="px-4 py-3 text-center text-xs text-muted-foreground">+{rows.length - limit} more</div>
      )}
      {rows.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Users className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Community Nurse Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            What needs your attention in the uploaded caseload
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className={cn('border-2 p-4', card.color)}>
            <div className="flex items-center gap-2">
              {card.icon}
              <p className="text-[11px] font-semibold uppercase tracking-wider">{card.label}</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </Card>
        ))}
      </div>

      {/* Today's priorities */}
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle className="text-base">Today&apos;s Priorities</CardTitle>
                <CardDescription>Patients with a SEE TODAY priority</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-destructive/30 text-destructive text-sm font-bold">
              {view.todayPriorities.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {renderList(view.todayPriorities, 'No patients flagged to see today', 6)}
        </CardContent>
      </Card>

      {/* Delayed healing + Potential infections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-warning" />
                <CardTitle className="text-base">Delayed or Deteriorating Healing</CardTitle>
              </div>
              <Badge variant="outline" className="border-warning/30 text-warning text-sm font-bold">{view.delayedHealing.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {renderList(view.delayedHealing, 'No delayed healing wounds')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">Potential Infections</CardTitle>
              </div>
              <Badge variant="outline" className="border-destructive/30 text-destructive text-sm font-bold">{view.potentialInfections.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {renderList(view.potentialInfections, 'No infection signs recorded')}
          </CardContent>
        </Card>
      </div>

      {/* Overdue reviews + TVN support */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarX className="h-5 w-5 text-warning" />
                <CardTitle className="text-base">Overdue Reviews</CardTitle>
              </div>
              <Badge variant="outline" className="border-warning/30 text-warning text-sm font-bold">{notReviewedRecently.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {renderList(notReviewedRecently, 'All reviews up to date')}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Requiring TVN Support</CardTitle>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary text-sm font-bold">{view.requiringTVNSupport.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {renderList(view.requiringTVNSupport, 'No patients flagged for this week')}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
