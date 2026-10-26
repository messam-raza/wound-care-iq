'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getClinicianMetrics, STATUS_STYLES, shortName } from '@/lib/selectors-c';
import { Users, AlertTriangle, Clock, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export function WorkforceReadinessPlatform() {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Clinician Workload" />;

  const clinicians = getClinicianMetrics(patients);
  const totalOverdue = clinicians.reduce((s, c) => s + c.overdueReviews, 0);
  const totalPriority = clinicians.reduce((s, c) => s + c.seeToday + c.seeThisWeek, 0);
  const largest = clinicians.reduce((m, c) => (c.total > m.total ? c : m), clinicians[0]);

  const chartData = clinicians.map((c) => ({
    name: shortName(c.name),
    fullName: c.name,
    seeToday: c.seeToday,
    seeThisWeek: c.seeThisWeek,
    other: c.total - c.seeToday - c.seeThisWeek,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Users className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clinician Workload</h1>
          <p className="text-sm text-muted-foreground">
            Caseload size, high-priority patients and overdue reviews per clinician
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <UserCheck className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{clinicians.length}</p>
          <p className="text-xs text-muted-foreground">Clinicians in upload</p>
        </Card>
        <Card className="p-4">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-bold">{largest.total}</p>
          <p className="text-xs text-muted-foreground">Largest caseload ({largest.name})</p>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="mt-2 text-2xl font-bold text-destructive">{totalPriority}</p>
          <p className="text-xs text-muted-foreground">SEE TODAY / THIS WEEK patients</p>
        </Card>
        <Card className="border-warning/20 bg-warning/5 p-4">
          <Clock className="h-5 w-5 text-warning" />
          <p className="mt-2 text-2xl font-bold text-warning">{totalOverdue}</p>
          <p className="text-xs text-muted-foreground">Overdue reviews (over 14 days)</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caseload by Clinician</CardTitle>
          <CardDescription>Patients per clinician split by TVN priority</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, clinicians.length * 44)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={130} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="seeToday" stackId="a" name="SEE TODAY" fill="hsl(var(--destructive))" />
              <Bar dataKey="seeThisWeek" stackId="a" name="SEE THIS WEEK" fill="hsl(var(--warning))" />
              <Bar dataKey="other" stackId="a" name="Monitor / Healing" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Clinician</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Caseload</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-destructive">SEE TODAY</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-warning">SEE THIS WEEK</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-warning md:table-cell">Overdue Reviews</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-muted-foreground md:table-cell">Missed Reviews</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-muted-foreground lg:table-cell">Data Quality Issues</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {clinicians.map((c) => (
                  <tr key={c.name} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-center">{c.total}</td>
                    <td className="px-4 py-3 text-center text-destructive font-semibold">{c.seeToday}</td>
                    <td className="px-4 py-3 text-center text-warning font-semibold">{c.seeThisWeek}</td>
                    <td className="hidden px-4 py-3 text-center md:table-cell">{c.overdueReviews}</td>
                    <td className="hidden px-4 py-3 text-center md:table-cell">{c.missedReviewPatients}</td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">{c.dataQualityIssues}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={cn('text-[11px]', STATUS_STYLES[c.status])}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
