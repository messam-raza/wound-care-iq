'use client';

import { useState, useMemo } from 'react';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { isNotImproving } from '@/lib/selectors-d';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Calculator,
  PoundSterling,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

export function CostSavingsCalculator() {
  const { patients, hasData } = useCaseload();
  const totalPatients = String(patients.length);
  const unhealed = String(patients.filter(isNotImproving).length);
  const [avgVisits, setAvgVisits] = useState('');
  const [costPerVisit, setCostPerVisit] = useState('');
  const [reductionPct, setReductionPct] = useState('');

  const results = useMemo(() => {
    const total = num(totalPatients);
    const unh = num(unhealed);
    const visits = num(avgVisits);
    const cost = num(costPerVisit);
    const red = num(reductionPct);
    if ([total, unh, visits, cost].some((v) => isNaN(v))) return null;
    const currentAnnualCost = total * visits * cost * 52;
    const costOfUnhealed = unh * visits * cost * 52;
    const hasReduction = !isNaN(red) && red > 0;
    const projectedSavings = hasReduction ? Math.round(costOfUnhealed * (red / 100)) : null;
    return {
      currentAnnualCost,
      costOfUnhealed,
      projectedSavings,
      futureStateCost: projectedSavings === null ? null : currentAnnualCost - projectedSavings,
    };
  }, [totalPatients, unhealed, avgVisits, costPerVisit, reductionPct]);

  const comparisonData = results && results.futureStateCost !== null
    ? [
        { name: 'Current', cost: results.currentAnnualCost, color: 'hsl(var(--destructive))' },
        { name: 'With assumed reduction', cost: results.futureStateCost, color: 'hsl(var(--success))' },
      ]
    : [];

  const fmt = (v: number) => `£${(v / 1000).toLocaleString('en-GB', { maximumFractionDigits: 0 })}k`;
  const fmtFull = (v: number) => `£${v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

  const field = (id: string, label: string, value: string, set: (v: string) => void, extra?: { max?: number; step?: number }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={0} max={extra?.max} step={extra?.step} placeholder="Enter a value" value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  if (!hasData) return <EmptyCaseload title="Cost Savings Calculator" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cost Savings Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Patient counts come from your uploaded CSV. Visit frequency, cost per visit and any reduction are figures you enter; nothing is assumed for you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              Input Parameters
            </CardTitle>
            <CardDescription>Counts from your CSV, other figures entered by you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">From your CSV</p>
              <p className="mt-1 text-foreground"><span className="font-bold">{totalPatients}</span> patients, <span className="font-bold">{unhealed}</span> not improving (stalled or deteriorating)</p>
            </div>
            {field('avgVisits', 'Average Community Visits / Week', avgVisits, setAvgVisits)}
            {field('costPerVisit', 'Cost Per Visit (£)', costPerVisit, setCostPerVisit)}
            {field('reductionPct', 'Assumed reduction in unhealed-patient visit cost (%)', reductionPct, setReductionPct, { max: 100 })}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-muted-foreground">
                The reduction percentage is your own assumption. Savings are shown only once you enter one.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {!results ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Enter visits per week and cost per visit to see results.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <PoundSterling className="h-4 w-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Annual Visit Cost</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-foreground">{fmtFull(results.currentAnnualCost)}</p>
                  </CardContent>
                </Card>
                <Card className="border-destructive/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <TrendingDown className="h-4 w-4" />
                      <p className="text-xs font-medium uppercase tracking-wider">Visit Cost of Unhealed</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-destructive">{fmtFull(results.costOfUnhealed)}</p>
                  </CardContent>
                </Card>
                {results.projectedSavings !== null && (
                  <Card className="border-success/20 bg-success/5 col-span-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-success">
                        <TrendingDown className="h-4 w-4" />
                        <p className="text-xs font-medium uppercase tracking-wider">Savings at your assumed {reductionPct}% reduction</p>
                      </div>
                      <p className="mt-2 text-2xl font-bold text-success">{fmtFull(results.projectedSavings)}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {comparisonData.length > 0 && results.projectedSavings !== null && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Current vs Assumed Annual Cost</CardTitle>
                    <CardDescription>Based entirely on the figures and assumption you entered</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmt(v)} />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                          formatter={(v: number) => fmtFull(v)}
                        />
                        <Bar dataKey="cost" radius={[8, 8, 0, 0]} barSize={80}>
                          {comparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                      <span className="text-muted-foreground">Annual savings:</span>
                      <span className="font-bold text-success">{fmtFull(results.projectedSavings)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-success">
                        {results.currentAnnualCost > 0 ? ((results.projectedSavings / results.currentAnnualCost) * 100).toFixed(1) : '0.0'}% of total
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
