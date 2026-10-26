'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getCareHomeView } from '@/lib/pilot-engine';
import { getFacilityMetrics, statusCounts, STATUS_STYLES, shortName } from '@/lib/selectors-c';
import {
  Home,
  AlertTriangle,
  Clock,
  TrendingUp,
  Building2,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export function CareHomeDashboard() {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Care Home Risk Dashboard" />;

  const homes = getFacilityMetrics(patients);
  const counts = statusCounts(homes);
  const view = getCareHomeView(patients);
  const attention = view.requiringEscalation.slice(0, 10);

  const chartData = homes.map((h) => ({
    name: shortName(h.name),
    fullName: h.name,
    highRisk: h.highRisk,
    overdue: h.overdueReviews,
    missed: h.missedReviewPatients,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Home className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Care Home Risk Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Care home risk and review compliance calculated from the uploaded caseload
          </p>
        </div>
      </div>

      {view.requiringEscalation.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {view.requiringEscalation.length} residents at RED or CRITICAL risk require escalation
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-success/20 bg-success/5 p-4">
          <TrendingUp className="h-5 w-5 text-success" />
          <p className="mt-2 text-2xl font-bold text-success">{counts.Stable}</p>
          <p className="text-xs text-muted-foreground">Stable</p>
        </Card>
        <Card className="border-warning/20 bg-warning/5 p-4">
          <Clock className="h-5 w-5 text-warning" />
          <p className="mt-2 text-2xl font-bold text-warning">{counts.Monitor}</p>
          <p className="text-xs text-muted-foreground">Monitor (SEE THIS WEEK)</p>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="mt-2 text-2xl font-bold text-destructive">{counts['Intervention Required']}</p>
          <p className="text-xs text-muted-foreground">Intervention Required (SEE TODAY)</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Care Home Risk Comparison</CardTitle>
          <CardDescription>High-risk wounds, overdue reviews (over 14 days), and patients with missed reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, homes.length * 48)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={150} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
              />
              <Bar dataKey="highRisk" fill="hsl(var(--destructive))" name="High Risk" radius={[0, 4, 4, 0]} />
              <Bar dataKey="overdue" fill="hsl(var(--warning))" name="Overdue Reviews" radius={[0, 4, 4, 0]} />
              <Bar dataKey="missed" fill="hsl(var(--chart-5))" name="Missed Reviews" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Care Home</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Wounds</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-destructive">High Risk</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-warning md:table-cell">Overdue</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-muted-foreground lg:table-cell">Improving</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-muted-foreground lg:table-cell">Data Quality</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Avg Risk Score</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {homes.map((h) => (
                  <tr key={h.name} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium text-foreground">{h.name}</td>
                    <td className="px-4 py-3 text-center">{h.total}</td>
                    <td className="px-4 py-3 text-center text-destructive font-semibold">{h.highRisk}</td>
                    <td className="hidden px-4 py-3 text-center text-warning md:table-cell">{h.overdueReviews}</td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">{h.improvingPct}%</td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <Badge variant="outline" className="text-xs">{h.dataQualityPct}%</Badge>
                    </td>
                    <td className="px-4 py-3 text-center font-bold tabular-nums">{h.avgRiskScore}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn('text-[11px]', STATUS_STYLES[h.status])}>{h.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-base">Residents Requiring Escalation</CardTitle>
              <CardDescription>Top {attention.length} RED/CRITICAL residents by risk score</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {attention.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  i < 3 ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground')}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.woundType} · {p.facility}</p>
                </div>
                <div className="hidden md:block shrink-0">
                  <p className="text-xs text-destructive font-medium">{p.tvnPriority}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(100, p.riskScore)}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-destructive">{p.riskScore}</span>
                </div>
              </div>
            ))}
            {attention.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No residents at RED or CRITICAL risk</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Care Homes Needing Attention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {homes.filter((h) => h.status !== 'Stable').map((h) => (
            <div key={h.name} className="flex items-start gap-3 border-b border-border/40 pb-2">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                h.status === 'Intervention Required' ? 'bg-destructive/10' : 'bg-warning/10',
              )}>
                <AlertTriangle className={cn('h-4 w-4', h.status === 'Intervention Required' ? 'text-destructive' : 'text-warning')} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.seeToday} SEE TODAY, {h.seeThisWeek} SEE THIS WEEK, {h.overdueReviews} overdue reviews, {h.dataQualityIssues} with data quality warnings
                </p>
              </div>
            </div>
          ))}
          {homes.every((h) => h.status === 'Stable') && (
            <p className="text-sm text-muted-foreground">No care homes have SEE TODAY or SEE THIS WEEK patients.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
