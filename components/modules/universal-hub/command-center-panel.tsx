'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PilotPatient } from '@/lib/pilot-types';
import { isHighRisk, isNotImproving } from '@/lib/selectors-d';
import type { FacilityIntelligence } from '@/lib/import-types';
import {
  HeartPulse,
  AlertTriangle,
  BedDouble,
  Scissors,
  Clock,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
interface CommandCenterPanelProps {
  patients: PilotPatient[];
  facilities: FacilityIntelligence[];
}

export function CommandCenterPanel({ patients, facilities }: CommandCenterPanelProps) {
  const total = patients.length;
  const highRisk = patients.filter(isHighRisk).length;
  const infectedHighRisk = patients.filter((p) => isHighRisk(p) && p.infectionSigns).length;
  const diabeticPadHighRisk = patients.filter((p) => p.diabetes && p.pad && isHighRisk(p)).length;
  const delayedHealing = patients.filter(isNotImproving).length;

  const kpis = [
    { label: 'Total Active Wounds', value: String(total), icon: HeartPulse, accent: 'primary' },
    { label: 'High Risk Wounds', value: String(highRisk), icon: AlertTriangle, accent: 'destructive' },
    { label: 'High Risk with Infection Signs', value: String(infectedHighRisk), icon: BedDouble, accent: 'warning' },
    { label: 'High Risk with Diabetes and PAD', value: String(diabeticPadHighRisk), icon: Scissors, accent: 'destructive' },
    { label: 'Not Improving', value: String(delayedHealing), icon: Clock, accent: 'warning' },
  ] as const;

  const accentMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Executive Wound Command Center</h3>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', accentMap[k.accent])}>
              <k.icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold text-foreground">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </Card>
        ))}
      </div>

      {/* Facility Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Executive Heatmap — Facility Risk Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(facilities.length, 5)}, minmax(0, 1fr))` }}>
            {facilities.map((f) => {
              const intensity = f.clinicalRiskScore;
              return (
                <div
                  key={f.name}
                  className="rounded-lg p-3 text-center"
                  style={{
                    background: `rgba(${intensity >= 70 ? '220,38,38' : intensity >= 40 ? '245,158,11' : '34,197,94'}, ${0.08 + (intensity / 100) * 0.18})`,
                    border: `1px solid rgba(${intensity >= 70 ? '220,38,38' : intensity >= 40 ? '245,158,11' : '34,197,94'}, 0.25)`,
                  }}
                >
                  <p className="break-words text-xs font-medium text-foreground">{f.name}</p>
                  <p className={cn('text-lg font-bold mt-0.5', intensity >= 70 ? 'text-destructive' : intensity >= 40 ? 'text-warning' : 'text-success')}>
                    {intensity}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{f.highRisk} red · {f.totalPatients} total</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Heatmap shows average clinical risk score per facility (0–100)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
