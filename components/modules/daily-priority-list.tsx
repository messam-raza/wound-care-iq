'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyCaseload } from '@/components/empty-caseload';
import { useCaseload } from '@/lib/caseload-context';
import { getRankedCaseload, getTVNPriorityCounts } from '@/lib/pilot-engine';
import type { PilotPatient, TVNPriority } from '@/lib/pilot-types';
import { PilotPatientRow } from './pilot-patient-row';
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  HeartPulse,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyPriorityListProps {
  onSelectPatient?: (patient: PilotPatient) => void;
}

const SECTIONS: {
  priority: TVNPriority;
  title: string;
  icon: React.ReactNode;
  badge: string;
  card: string;
}[] = [
  {
    priority: 'SEE TODAY',
    title: 'See Today',
    icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
    badge: 'border-destructive/30 text-destructive',
    card: 'border-destructive/20 bg-destructive/5 text-destructive',
  },
  {
    priority: 'SEE THIS WEEK',
    title: 'See This Week',
    icon: <CalendarClock className="h-5 w-5 text-warning" />,
    badge: 'border-warning/30 text-warning',
    card: 'border-warning/20 bg-warning/5 text-warning',
  },
  {
    priority: 'MONITOR',
    title: 'Monitor',
    icon: <Eye className="h-5 w-5 text-primary" />,
    badge: 'border-primary/30 text-primary',
    card: 'border-primary/20 bg-primary/5 text-primary',
  },
  {
    priority: 'HEALING',
    title: 'Healing',
    icon: <HeartPulse className="h-5 w-5 text-success" />,
    badge: 'border-success/30 text-success',
    card: 'border-success/20 bg-success/5 text-success',
  },
];

export function DailyPriorityList({ onSelectPatient }: DailyPriorityListProps) {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Daily Priority List" />;

  const ranked = getRankedCaseload(patients);
  const counts = getTVNPriorityCounts(patients);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Activity className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Priority List</h1>
          <p className="text-sm text-muted-foreground">
            {patients.length} patients ranked by TVN priority, then risk score
          </p>
        </div>
      </div>

      {/* Priority summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SECTIONS.map((s) => (
          <Card key={s.priority} className={cn('border-2 p-4', s.card)}>
            <div className="flex items-center gap-2">
              {s.icon}
              <p className="text-[11px] font-semibold uppercase tracking-wider">{s.title}</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{counts[s.priority]}</p>
          </Card>
        ))}
      </div>

      {/* One section per priority, one row per patient */}
      {SECTIONS.map((s) => {
        const rows = ranked.filter((p) => p.tvnPriority === s.priority);
        if (rows.length === 0) return null;
        return (
          <Card key={s.priority}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.icon}
                  <div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <CardDescription>Ordered by risk score</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className={cn('text-sm font-bold', s.badge)}>
                  {rows.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {rows.map((p) => (
                  <PilotPatientRow key={p.id} patient={p} onSelect={onSelectPatient} showDetail />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
