'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { getFacilityMetrics, getClinicianMetrics, shortName } from '@/lib/selectors-c';
import { Trophy, Building2, Users, TrendingUp, AlertTriangle } from 'lucide-react';
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

type GroupType = 'Facility' | 'Clinician';

export function Benchmarking() {
  const { patients, hasData } = useCaseload();
  const [type, setType] = useState<GroupType>('Facility');
  if (!hasData) return <EmptyCaseload title="Benchmarking" />;

  const groups = type === 'Facility' ? getFacilityMetrics(patients) : getClinicianMetrics(patients);
  const ranked = [...groups].sort((a, b) => b.improvingPct - a.improvingPct || a.avgRiskScore - b.avgRiskScore);

  const chartData = groups.map((g) => ({
    name: shortName(g.name),
    fullName: g.name,
    seeToday: g.seeToday,
    seeThisWeek: g.seeThisWeek,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Trophy className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benchmarking</h1>
          <p className="text-sm text-muted-foreground">
            Compare facilities and clinicians within the uploaded caseload
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['Facility', 'Clinician'] as GroupType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              type === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-secondary/50')}
          >
            {t === 'Facility' ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {t === 'Facility' ? 'Facilities' : 'Clinicians'}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Priority Patients</CardTitle>
          <CardDescription>SEE TODAY and SEE THIS WEEK patients per {type.toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, groups.length * 44)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={150} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                labelFormatter={(_, p) => p?.[0]?.payload?.fullName || ''}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="seeToday" stackId="a" name="SEE TODAY" fill="hsl(var(--destructive))" />
              <Bar dataKey="seeThisWeek" stackId="a" name="SEE THIS WEEK" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-success" />
            Ranking by Share Improving
          </CardTitle>
          <CardDescription>Ties broken by lower average risk score</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{type}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Wounds</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-success">Improving</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-destructive">SEE TODAY</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-warning md:table-cell">SEE THIS WEEK</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-muted-foreground md:table-cell">Avg Review Delay (d)</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold text-muted-foreground lg:table-cell">Data Quality</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((g, i) => (
                  <tr key={g.name} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{g.name}</td>
                    <td className="px-4 py-3 text-center">{g.total}</td>
                    <td className="px-4 py-3 text-center text-success font-semibold">{g.improvingPct}%</td>
                    <td className="px-4 py-3 text-center text-destructive font-semibold">{g.seeToday}</td>
                    <td className="hidden px-4 py-3 text-center text-warning md:table-cell">{g.seeThisWeek}</td>
                    <td className="hidden px-4 py-3 text-center md:table-cell">{g.avgReviewDelay}</td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {g.dataQualityPct}%
                        {g.dataQualityIssues > 0 && <AlertTriangle className="ml-1 h-3 w-3 text-warning" />}
                      </Badge>
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
