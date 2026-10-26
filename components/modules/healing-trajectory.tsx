'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getRankedCaseload, getTrajectoryData } from '@/lib/pilot-engine';
import type { CurrentStatus } from '@/lib/pilot-types';
import { RISK_LEVEL_STYLES, TVN_PRIORITY_STYLES } from '@/lib/selectors-groupb';
import {
  TrendingUp,
  Minus,
  TrendingDown,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';

const TREND_CONFIG: Record<CurrentStatus, { icon: React.ReactNode; color: string }> = {
  Improving: { icon: <TrendingUp className="h-4 w-4 text-success" />, color: 'text-success' },
  Stable: { icon: <Minus className="h-4 w-4 text-muted-foreground" />, color: 'text-muted-foreground' },
  'Delayed Healing': { icon: <Minus className="h-4 w-4 text-warning" />, color: 'text-warning' },
  Deteriorating: { icon: <TrendingDown className="h-4 w-4 text-destructive" />, color: 'text-destructive' },
};

export function HealingTrajectory() {
  const { patients, hasData } = useCaseload();
  const ranked = useMemo(() => getRankedCaseload(patients), [patients]);
  const [selectedId, setSelectedId] = useState<string>('');
  const patient = ranked.find((p) => p.id === selectedId) || ranked[0];

  if (!hasData || !patient) return <EmptyCaseload title="Healing Trajectory" />;

  const trajectory = getTrajectoryData(patient);
  // Only real measured assessments are plotted.
  const chartData = patient.assessments.map((a) => {
    const d = parseISO(a.date);
    return { date: isValid(d) ? format(d, 'MMM d') : a.date, actual: a.surfaceArea };
  });
  const offTrajectory = patient.currentStatus !== 'Improving';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Activity className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Healing Trajectory</h1>
          <p className="text-sm text-muted-foreground">
            Measured wound area over time from uploaded assessments
          </p>
        </div>
      </div>

      {/* Patient selector */}
      <div className="flex flex-wrap gap-1.5">
        {ranked.slice(0, 15).map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              selectedId === p.id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Patient summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{patient.name}</CardTitle>
            <CardDescription>{patient.id} · {patient.woundType} · {patient.facility}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Status</span>
              <div className="flex items-center gap-1.5">
                {TREND_CONFIG[patient.currentStatus].icon}
                <span className={cn('text-sm font-semibold', TREND_CONFIG[patient.currentStatus].color)}>
                  {patient.currentStatus}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Area Change</span>
              <span className={cn('text-sm font-semibold', patient.areaChangePct > 0 ? 'text-destructive' : 'text-success')}>
                {patient.areaChangePct > 0 ? '+' : ''}{patient.areaChangePct}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Days Active</span>
              <span className="text-sm font-semibold">{patient.daysActive}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Risk ({patient.riskScore})</span>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', RISK_LEVEL_STYLES[patient.riskLevel].badge)}>
                {patient.riskLevel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">TVN Priority</span>
              <Badge variant="outline" className={cn('text-[11px]', TVN_PRIORITY_STYLES[patient.tvnPriority])}>{patient.tvnPriority}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Measured Wound Area</CardTitle>
            <CardDescription>
              {chartData.length} recorded assessment{chartData.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="cm²" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="actual" stroke={offTrajectory ? 'hsl(var(--destructive))' : 'hsl(var(--chart-1))'} strokeWidth={2} name="Area (cm²)" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Interpretation from recorded data */}
      <Card className={cn('border-2', offTrajectory ? 'border-warning/30' : 'border-success/30')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Clinical Interpretation
          </CardTitle>
          <CardDescription>Based on the recorded assessments for this wound</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground">{trajectory.interpretation}</p>
          {patient.riskDrivers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Drivers</p>
              <div className="space-y-2">
                {patient.riskDrivers.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', d.isPrimary ? 'bg-destructive' : 'bg-warning')} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{d.factor} (+{d.points})</p>
                      {d.clinicalNote && <p className="text-xs text-muted-foreground">{d.clinicalNote}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Recommended action:</span> {patient.recommendedAction} ({patient.expectedReviewTime})
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
