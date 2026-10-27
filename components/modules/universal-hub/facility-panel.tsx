'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FacilityIntelligence } from '@/lib/import-types';
import {
  Building2,
  TrendingUp,
  AlertTriangle,
  Star,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

interface FacilityPanelProps {
  facilities: FacilityIntelligence[];
}

export function FacilityPanel({ facilities }: FacilityPanelProps) {
  const sorted = [...facilities].sort((a, b) => b.clinicalRiskScore - a.clinicalRiskScore);
  const topPerforming = [...facilities].sort((a, b) => b.healingRate - a.healingRate).slice(0, 2);
  const highestRisk = [...facilities].sort((a, b) => b.highRisk - a.highRisk).slice(0, 2);

  const chartData = facilities.map((f) => ({
    name: f.name.split(' ')[0],
    fullName: f.name,
    red: f.highRisk,
    amber: f.amber,
    green: f.green,
    healingRate: f.healingRate,
  }));

  const radarData = facilities.map((f) => ({
    facility: f.name.split(' ')[0],
    healing: f.healingRate,
    quality: f.dataQualityScore,
    risk: 100 - f.clinicalRiskScore,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Facility Intelligence Panel</h3>
      </div>

      {/* Callout cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-success" />
              <p className="text-xs font-semibold uppercase tracking-wider text-success">Top Performing</p>
            </div>
            {topPerforming.map((f) => (
              <div key={f.name} className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">{f.name}</span>
                <span className="text-sm font-bold text-success">{f.healingRate}% healing</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Highest Risk</p>
            </div>
            {highestRisk.map((f) => (
              <div key={f.name} className="flex items-center justify-between py-1">
                <span className="text-sm text-foreground">{f.name}</span>
                <span className="text-sm font-bold text-destructive">{f.highRisk} red-risk wounds</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risk by Facility</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                />
                <Bar dataKey="red" stackId="a" fill="hsl(var(--destructive))" name="Red" />
                <Bar dataKey="amber" stackId="a" fill="hsl(var(--warning))" name="Amber" />
                <Bar dataKey="green" stackId="a" fill="hsl(var(--success))" name="Green" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {radarData.length >= 3 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Performance Radar</CardTitle>
              <CardDescription>Healing · Data Quality · Risk Score</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="facility" tick={{ fontSize: 11 }} />
                  <Radar name="Healing" dataKey="healing" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.2} />
                  <Radar name="Quality" dataKey="quality" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Healing Rate by Facility</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="%" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} />
                  <Bar dataKey="healingRate" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} name="Healing Rate" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Facility Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facility</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patients</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-destructive">High Risk</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">Healing Rate</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Data Quality</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Avg Risk</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">Clinicians</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f) => (
                  <tr key={f.name} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium text-foreground">{f.name}</td>
                    <td className="px-4 py-3 text-center">{f.totalPatients}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-semibold', f.highRisk > 0 ? 'text-destructive' : 'text-success')}>
                        {f.highRisk}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-center sm:table-cell">
                      <span className={cn('font-medium', f.healingRate >= 50 ? 'text-success' : f.healingRate >= 30 ? 'text-warning' : 'text-destructive')}>
                        {f.healingRate}%
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-center md:table-cell">
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        f.dataQualityScore >= 75 ? 'border-success/30 text-success' :
                        f.dataQualityScore >= 50 ? 'border-warning/30 text-warning' :
                        'border-destructive/30 text-destructive',
                      )}>
                        {f.dataQualityScore}%
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <span className={cn('font-medium tabular-nums', f.clinicalRiskScore >= 70 ? 'text-destructive' : f.clinicalRiskScore >= 40 ? 'text-warning' : 'text-success')}>
                        {f.clinicalRiskScore}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {f.clinicians.slice(0, 2).map((c) => (
                          <span key={c} className="rounded-md bg-secondary/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">{c}</span>
                        ))}
                        {f.clinicians.length > 2 && <span className="text-[11px] text-muted-foreground">+{f.clinicians.length - 2}</span>}
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
  );
}
