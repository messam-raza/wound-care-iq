'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getFacilityMetrics, statusCounts, STATUS_STYLES, shortName } from '@/lib/selectors-c';
import { Building2, AlertTriangle, TrendingDown } from 'lucide-react';
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

export function FacilityIntelligence() {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Facility Intelligence" />;

  const sorted = getFacilityMetrics(patients);
  const counts = statusCounts(sorted);

  const chartData = sorted.map((f) => ({
    name: shortName(f.name),
    fullName: f.name,
    seeToday: f.seeToday,
    seeThisWeek: f.seeThisWeek,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Building2 className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facility Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Facilities ranked by average risk score, with priority patients, overdue reviews and data quality
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-success/20 bg-success/5 p-4">
          <p className="text-2xl font-bold text-success">{counts.Stable}</p>
          <p className="text-xs text-muted-foreground">Stable</p>
        </Card>
        <Card className="border-warning/20 bg-warning/5 p-4">
          <p className="text-2xl font-bold text-warning">{counts.Monitor}</p>
          <p className="text-xs text-muted-foreground">Monitor (SEE THIS WEEK)</p>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <p className="text-2xl font-bold text-destructive">{counts['Intervention Required']}</p>
          <p className="text-xs text-muted-foreground">Intervention Required (SEE TODAY)</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Priority Patients by Facility</CardTitle>
          <CardDescription>SEE TODAY and SEE THIS WEEK patients per facility</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 48)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={150} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''}
              />
              <Bar dataKey="seeToday" stackId="a" name="SEE TODAY" fill="hsl(var(--destructive))" />
              <Bar dataKey="seeThisWeek" stackId="a" name="SEE THIS WEEK" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Facility</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-muted-foreground sm:table-cell">Wounds</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-destructive">High Risk</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-destructive md:table-cell">Deteriorating</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-warning lg:table-cell">Overdue Reviews</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-warning lg:table-cell">Avg Review Delay (d)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Avg Risk</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f, i) => (
                  <tr key={f.name} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                        i < 2 ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground',
                      )}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{f.name}</td>
                    <td className="hidden px-4 py-3 text-center sm:table-cell">{f.total}</td>
                    <td className="px-4 py-3 text-center text-destructive font-semibold">{f.highRisk}</td>
                    <td className="hidden px-4 py-3 text-center text-destructive md:table-cell">{f.deteriorating}</td>
                    <td className="hidden px-4 py-3 text-center text-warning lg:table-cell">{f.overdueReviews}</td>
                    <td className="hidden px-4 py-3 text-center text-warning lg:table-cell">{f.avgReviewDelay}</td>
                    <td className="px-4 py-3 text-center font-bold tabular-nums">{f.avgRiskScore}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn('text-[11px]', STATUS_STYLES[f.status])}>{f.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Facilities Needing Attention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.filter((f) => f.status !== 'Stable').map((f) => (
            <div key={f.name} className="flex items-start gap-3 border-b border-border/40 pb-2">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                f.status === 'Intervention Required' ? 'bg-destructive/10' : 'bg-warning/10',
              )}>
                {f.status === 'Intervention Required'
                  ? <AlertTriangle className="h-4 w-4 text-destructive" />
                  : <TrendingDown className="h-4 w-4 text-warning" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.seeToday} SEE TODAY, {f.seeThisWeek} SEE THIS WEEK, {f.deteriorating} deteriorating, {f.overdueReviews} overdue reviews
                </p>
              </div>
            </div>
          ))}
          {sorted.every((f) => f.status === 'Stable') && (
            <p className="text-sm text-muted-foreground">No facilities have SEE TODAY or SEE THIS WEEK patients.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
