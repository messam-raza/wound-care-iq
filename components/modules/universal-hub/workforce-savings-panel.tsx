'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkforceIntelligence } from '@/lib/import-types';
import { Users, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

interface WorkforceSavingsPanelProps {
  workforce: WorkforceIntelligence[];
}

export function WorkforceSavingsPanel({ workforce }: WorkforceSavingsPanelProps) {
  const workforceChart = workforce.slice(0, 8).map((w) => ({
    name: w.clinician.split(' ').pop() || w.clinician,
    fullName: w.clinician,
    total: w.totalWounds,
    high: w.highRiskWounds,
  }));

  return (
    <div className="space-y-6">
      {/* Workforce Intelligence */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Workforce Intelligence</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Wound Load per Clinician</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={workforceChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Bar dataKey="total" fill="hsl(var(--chart-1))" name="Total Wounds" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="high" fill="hsl(var(--destructive))" name="High Risk" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Clinician Risk Burden</CardTitle>
              <CardDescription>Sorted by high-risk wound count</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Clinician</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Total</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-destructive">High Risk</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Burden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workforce.map((w) => (
                      <tr key={w.clinician} className="border-b border-border/40 hover:bg-secondary/20">
                        <td className="px-3 py-2">
                          <p className="text-xs font-medium text-foreground">{w.clinician}</p>
                          <p className="text-[11px] text-muted-foreground">{w.facility}</p>
                        </td>
                        <td className="px-3 py-2 text-center text-xs">{w.totalWounds}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn('text-xs font-semibold', w.highRiskWounds > 0 ? 'text-destructive' : 'text-success')}>
                            {w.highRiskWounds}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn('h-full rounded-full', w.reviewBurden > 40 ? 'bg-destructive' : w.reviewBurden > 20 ? 'bg-warning' : 'bg-success')}
                                style={{ width: `${w.reviewBurden}%` }}
                              />
                            </div>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{w.reviewBurden}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
