'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RiskScoreBar } from '@/components/risk-badge';
import { EmptyCaseload } from '@/components/empty-caseload';
import { useCaseload } from '@/lib/caseload-context';
import { getRankedCaseload, getTVNPriorityCounts } from '@/lib/pilot-engine';
import type { PilotPatient } from '@/lib/pilot-types';
import { getFacilityPressure, isDelayedOrDeteriorating, primaryReason } from '@/lib/selectors-groupa';
import { PilotPatientRow } from './pilot-patient-row';
import {
  Stethoscope,
  AlertTriangle,
  Building2,
  TrendingDown,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TVNCommandCenterProps {
  onSelectPatient?: (patient: PilotPatient) => void;
}

export function TVNCommandCenter({ onSelectPatient }: TVNCommandCenterProps) {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="TVN Command Center" />;

  const counts = getTVNPriorityCounts(patients);
  const topPriority = getRankedCaseload(patients).slice(0, 10);
  const poorHealing = patients
    .filter(isDelayedOrDeteriorating)
    .sort((a, b) => b.riskScore - a.riskScore);
  const facilitySupport = getFacilityPressure(patients);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Stethoscope className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TVN Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Where is the real risk today? — the {topPriority.length} highest-priority wounds
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="mt-2 text-2xl font-bold text-destructive">{counts['SEE TODAY']}</p>
          <p className="text-xs text-muted-foreground">See Today</p>
        </Card>
        <Card className="border-warning/20 bg-warning/5 p-4">
          <CalendarClock className="h-5 w-5 text-warning" />
          <p className="mt-2 text-2xl font-bold text-warning">{counts['SEE THIS WEEK']}</p>
          <p className="text-xs text-muted-foreground">See This Week</p>
        </Card>
        <Card className="border-primary/20 bg-primary/5 p-4">
          <TrendingDown className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold text-primary">{poorHealing.length}</p>
          <p className="text-xs text-muted-foreground">Poor Healing Trajectories</p>
        </Card>
        <Card className="border-accent/20 bg-accent/5 p-4">
          <Building2 className="h-5 w-5 text-accent" />
          <p className="mt-2 text-2xl font-bold text-accent">{facilitySupport.length}</p>
          <p className="text-xs text-muted-foreground">Facilities With Urgent Wounds</p>
        </Card>
      </div>

      {/* Top priority wounds */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-base">Top Priority Wounds</CardTitle>
              <CardDescription>Ranked by TVN priority, then risk score</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {topPriority.map((p, i) => (
              <PilotPatientRow key={p.id} patient={p} rank={i} onSelect={onSelectPatient} showDetail />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Poor healing */}
      {poorHealing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-primary" />
              Poor Healing Trajectories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {poorHealing.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectPatient?.(p)}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-secondary/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.woundType} · {p.currentStatus}</p>
                  </div>
                  <span className={cn('text-xs font-medium', p.currentStatus === 'Deteriorating' ? 'text-destructive' : 'text-warning')}>
                    {p.areaChangePct > 0 ? '+' : ''}{p.areaChangePct}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Facilities with urgent wounds */}
      {facilitySupport.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-accent" />
              Care Homes & Facilities With Urgent Wounds
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Facility</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-destructive">See Today / This Week</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Delayed / Deteriorating</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {facilitySupport.map((f) => (
                    <tr key={f.name} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium">{f.name}</td>
                      <td className="px-4 py-3 text-center text-destructive font-semibold">{f.urgent}</td>
                      <td className="px-4 py-3 text-center">{f.delayed}</td>
                      <td className="px-4 py-3 text-center">{f.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
