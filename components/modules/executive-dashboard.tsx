'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KPICard } from '@/components/kpi-card';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getTVNPriorityCounts, getEscalationCandidates, getFacilitySummaries } from '@/lib/pilot-engine';
import { pct } from '@/lib/selectors-groupb';
import type { CurrentStatus } from '@/lib/pilot-types';
import {
  HeartPulse,
  AlertTriangle,
  TrendingUp,
  Building2,
  Clock,
  Activity,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  fontSize: '12px',
};

const STATUS_COLORS: Record<CurrentStatus, string> = {
  Improving: 'hsl(var(--success))',
  Stable: 'hsl(var(--chart-1))',
  'Delayed Healing': 'hsl(var(--warning))',
  Deteriorating: 'hsl(var(--destructive))',
};

export function ExecutiveDashboard() {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Executive Dashboard" />;

  const total = patients.length;
  const counts = getTVNPriorityCounts(patients);
  const highRisk = getEscalationCandidates(patients).length;
  const improving = patients.filter((p) => p.currentStatus === 'Improving').length;
  const overdue = patients.filter((p) => p.daysSinceReview > 14).length;
  const facilities = getFacilitySummaries(patients);

  const priorityDistribution = [
    { name: 'See Today', value: counts['SEE TODAY'], color: 'hsl(var(--destructive))' },
    { name: 'See This Week', value: counts['SEE THIS WEEK'], color: 'hsl(var(--warning))' },
    { name: 'Monitor', value: counts['MONITOR'], color: 'hsl(var(--chart-1))' },
    { name: 'Healing', value: counts['HEALING'], color: 'hsl(var(--success))' },
  ];

  const statusData = (['Improving', 'Stable', 'Delayed Healing', 'Deteriorating'] as CurrentStatus[]).map((s) => ({
    name: s,
    value: patients.filter((p) => p.currentStatus === s).length,
    color: STATUS_COLORS[s],
  }));

  const facilityData = facilities.map((f) => ({
    name: f.name,
    critical: f.criticalWounds,
    red: f.highRiskWounds,
    other: f.activeWounds - f.criticalWounds - f.highRiskWounds,
    overdue: f.overdueAssessments,
    missed: f.delayedReviews,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {total} wounds across {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'} in the uploaded caseload
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard label="Total Wounds" value={String(total)} sublabel="In caseload" icon={HeartPulse} accent="primary" />
        <KPICard label="See Today" value={String(counts['SEE TODAY'])} sublabel="Immediate TVN review" icon={AlertTriangle} accent="destructive" />
        <KPICard label="High Risk" value={String(highRisk)} sublabel="Red or critical" icon={Activity} accent="warning" />
        <KPICard label="Improving" value={`${pct(improving, total)}%`} sublabel={`${improving} of ${total} wounds`} icon={TrendingUp} accent="success" />
        <KPICard label="Overdue Reviews" value={String(overdue)} sublabel="Over 14 days since review" icon={Clock} accent="primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">TVN Priority Distribution</CardTitle>
            <CardDescription>Wounds by priority tier across all facilities</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={priorityDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              {priorityDistribution.map((r) => (
                <div key={r.name}>
                  <p className="text-lg font-bold" style={{ color: r.color }}>{r.value}</p>
                  <p className="text-[11px] text-muted-foreground">{r.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Healing status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Healing Status</CardTitle>
            <CardDescription>Current status of each wound</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Wounds" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* High Risk Facilities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">High Risk by Facility</CardTitle>
            <CardDescription>Critical and red wounds per facility</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={facilityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="critical" stackId="a" fill="hsl(var(--destructive))" name="Critical" />
                <Bar dataKey="red" stackId="a" fill="hsl(var(--chart-5))" name="Red" />
                <Bar dataKey="other" stackId="a" fill="hsl(var(--muted-foreground))" name="Amber / Green" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Review delays */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Delays by Facility</CardTitle>
            <CardDescription>Overdue reassessments (over 14 days) and wounds with missed reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={facilityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="overdue" fill="hsl(var(--warning))" name="Overdue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" fill="hsl(var(--destructive))" name="Missed reviews" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Priority Alert Banner */}
      {counts['SEE TODAY'] > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <Building2 className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {counts['SEE TODAY']} wound{counts['SEE TODAY'] === 1 ? '' : 's'} flagged SEE TODAY
              </p>
              <p className="text-xs text-muted-foreground">
                {counts['SEE THIS WEEK']} more flagged SEE THIS WEEK. {overdue} wound{overdue === 1 ? ' is' : 's are'} more than 14 days since last review.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
