'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import {
  isNotImproving,
  isVLU,
} from '@/lib/selectors-d';
import { PoundSterling, TrendingDown, Activity, Building2 } from 'lucide-react';
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

const tooltipStyle = { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' };

export function NHSCostIntelligence() {
  const { patients, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="NHS Cost Intelligence" />;

  const total = patients.length;
  const notImproving = patients.filter(isNotImproving).length;
  const vlu = patients.filter(isVLU);
  const vluNotImproving = vlu.filter(isNotImproving).length;

  const group = (key: (p: (typeof patients)[number]) => string) => {
    const map = new Map<string, { name: string; improving: number; notImproving: number }>();
    for (const p of patients) {
      const k = key(p) || 'Unknown';
      const e = map.get(k) || { name: k, improving: 0, notImproving: 0 };
      if (isNotImproving(p)) e.notImproving++;
      else e.improving++;
      map.set(k, e);
    }
    return Array.from(map.values()).sort((a, b) => b.improving + b.notImproving - (a.improving + a.notImproving));
  };
  const byFacility = group((p) => p.facility);
  const byWoundType = group((p) => p.woundType);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <PoundSterling className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">NHS Cost Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Wound burden in your uploaded caseload
          </p>
        </div>
      </div>

      {/* Caseload counts */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wounds in Caseload</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground">From your uploaded CSV</p>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5 p-4">
          <TrendingDown className="h-4 w-4 text-destructive" />
          <p className="mt-2 text-2xl font-bold text-destructive">{notImproving}</p>
          <p className="text-xs text-muted-foreground">Not improving (stalled or deteriorating)</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Venous Leg Ulcers</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{vlu.length}</p>
          <p className="text-xs text-muted-foreground">Wound type matches venous leg ulcer</p>
        </Card>
        <Card className="border-warning/20 bg-warning/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">VLU Not Improving</p>
          <p className="mt-2 text-2xl font-bold text-warning">{vluNotImproving}</p>
          <p className="text-xs text-muted-foreground">of {vlu.length} venous leg ulcers</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Wounds by Facility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byFacility} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="notImproving" stackId="a" fill="hsl(var(--destructive))" name="Not improving" />
                <Bar dataKey="improving" stackId="a" fill="hsl(var(--success))" name="Improving" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Wounds by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byWoundType} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={140} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="notImproving" stackId="a" fill="hsl(var(--destructive))" name="Not improving" />
                <Bar dataKey="improving" stackId="a" fill="hsl(var(--success))" name="Improving" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
