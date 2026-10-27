'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getTVNPriorityCounts, getEscalationCandidates, getFacilitySummaries, getDeterioratingWounds } from '@/lib/pilot-engine';
import { pct } from '@/lib/selectors-groupb';
import {
  HeartPulse,
  AlertTriangle,
  Building2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  MapPin,
  Clock,
  Thermometer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

export function ExecutiveCommandCenter() {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Executive Wound Command Center" />;

  const total = patients.length;
  const counts = getTVNPriorityCounts(patients);
  const highRisk = getEscalationCandidates(patients).length;
  const deteriorating = getDeterioratingWounds(patients).length;
  const improving = patients.filter((p) => p.currentStatus === 'Improving').length;
  const overdue = patients.filter((p) => p.daysSinceReview > 14).length;
  const infection = patients.filter((p) => p.infectionSigns).length;
  const facilities = getFacilitySummaries(patients);

  const kpis = [
    { label: 'Total Wounds', value: String(total), icon: HeartPulse, accent: 'primary' },
    { label: 'High Risk Wounds', value: String(highRisk), icon: AlertTriangle, accent: 'destructive' },
    { label: 'See Today', value: String(counts['SEE TODAY']), icon: Zap, accent: 'destructive' },
    { label: 'Deteriorating', value: String(deteriorating), icon: TrendingDown, accent: 'destructive' },
    { label: 'Infection Signs', value: String(infection), icon: Thermometer, accent: 'warning' },
    { label: 'Overdue Reviews', value: String(overdue), icon: Clock, accent: 'warning' },
    { label: 'Improving', value: `${pct(improving, total)}%`, icon: TrendingUp, accent: 'success' },
    { label: 'Facilities', value: String(facilities.length), icon: Building2, accent: 'primary' },
  ] as const;

  const accentMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    destructive: 'bg-destructive/10 text-destructive',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
    accent: 'bg-accent/10 text-accent',
  };

  // Facilities needing attention: those with critical/red wounds or overdue reviews, ranked by average risk score
  const resourceAllocation = facilities
    .filter((f) => f.criticalWounds + f.highRiskWounds + f.overdueAssessments > 0)
    .slice(0, 3);

  const facilityHeat = facilities.map((f) => ({
    name: f.name,
    avgRisk: f.avgRiskScore,
    high: f.highRiskWounds + f.criticalWounds,
    total: f.activeWounds,
  }));

  const wt = new Map<string, number>();
  for (const p of patients) wt.set(p.woundType, (wt.get(p.woundType) || 0) + 1);
  const woundTypeData = Array.from(wt.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <BarChart3 className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Wound Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Wound intelligence across {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'} in the uploaded caseload
          </p>
        </div>
      </div>

      {/* Deterioration banner */}
      {deteriorating > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <Zap className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {deteriorating} wound{deteriorating === 1 ? ' is' : 's are'} deteriorating — {counts['SEE TODAY']} flagged SEE TODAY, {highRisk} red or critical
            </p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Facilities needing attention */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Facilities Needing Attention
          </CardTitle>
          <CardDescription>Ranked by average risk score; includes critical/red wounds and overdue reviews</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {resourceAllocation.map((f) => (
            <div key={f.name} className="flex items-start gap-3 border-b border-border/40 pb-2">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', f.criticalWounds > 0 ? 'bg-destructive/10' : 'bg-warning/10')}>
                <Building2 className={cn('h-4 w-4', f.criticalWounds > 0 ? 'text-destructive' : 'text-warning')} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{f.name}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <span className="text-destructive">{f.criticalWounds} critical</span>
                  <span className="text-destructive">{f.highRiskWounds} red</span>
                  <span className="text-warning">{f.overdueAssessments} overdue reviews</span>
                  <span className="text-muted-foreground">Avg risk score: {f.avgRiskScore}</span>
                </div>
              </div>
            </div>
          ))}
          {resourceAllocation.length === 0 && (
            <p className="text-sm text-muted-foreground">No facility has critical or red wounds or overdue reviews.</p>
          )}
        </CardContent>
      </Card>

      {/* Facility heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facility Risk Heatmap</CardTitle>
          <CardDescription>Average clinical risk score per facility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {facilityHeat.map((f) => {
              const intensity = f.avgRisk;
              return (
                <div
                  key={f.name}
                  className="rounded-lg p-3 text-center"
                  style={{
                    background: `rgba(${intensity >= 70 ? '220,38,38' : intensity >= 40 ? '245,158,11' : '34,197,94'}, ${0.08 + (intensity / 100) * 0.18})`,
                    border: `1px solid rgba(${intensity >= 70 ? '220,38,38' : intensity >= 40 ? '245,158,11' : '34,197,94'}, 0.25)`,
                  }}
                >
                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                  <p className={cn('text-lg font-bold mt-0.5', intensity >= 70 ? 'text-destructive' : intensity >= 40 ? 'text-warning' : 'text-success')}>
                    {intensity}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{f.high} high risk · {f.total} total</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Wound type mix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wounds by Type</CardTitle>
          <CardDescription>Count of wounds per type in the caseload</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={woundTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} />
              <Bar dataKey="count" name="Wounds" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
