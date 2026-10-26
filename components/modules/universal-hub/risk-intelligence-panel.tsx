'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RiskBadge, RiskScoreBar } from '@/components/risk-badge';
import type { PilotPatient } from '@/lib/pilot-types';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
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
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { HealingTrend } from '@/lib/types';

interface RiskIntelligencePanelProps {
  patients: PilotPatient[];
}

const TREND_LABELS: Record<HealingTrend, { icon: React.ReactNode; color: string }> = {
  Improving: { icon: <TrendingUp className="h-3.5 w-3.5 text-success" />, color: 'text-success' },
  Stalled: { icon: <Minus className="h-3.5 w-3.5 text-warning" />, color: 'text-warning' },
  Deteriorating: { icon: <TrendingDown className="h-3.5 w-3.5 text-destructive" />, color: 'text-destructive' },
};

export function RiskIntelligencePanel({ patients }: RiskIntelligencePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const red = patients.filter((p) => (p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL')).length;
  const amber = patients.filter((p) => p.riskLevel === 'AMBER').length;
  const green = patients.filter((p) => p.riskLevel === 'GREEN').length;

  const pieData = [
    { name: 'RED — Immediate', value: red, color: 'hsl(var(--destructive))' },
    { name: 'AMBER — Monitor', value: amber, color: 'hsl(var(--warning))' },
    { name: 'GREEN — Healing', value: green, color: 'hsl(var(--success))' },
  ];

  const healingData = [
    { name: 'Improving', value: patients.filter((p) => p.healingTrend === 'Improving').length, color: 'hsl(var(--success))' },
    { name: 'Stalled', value: patients.filter((p) => p.healingTrend === 'Stalled').length, color: 'hsl(var(--warning))' },
    { name: 'Deteriorating', value: patients.filter((p) => p.healingTrend === 'Deteriorating').length, color: 'hsl(var(--destructive))' },
  ];

  const sortedPatients = [...patients].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Risk Intelligence</h3>
      </div>

      {/* Summary Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Healing Trajectories</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={healingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {healingData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Patient Risk Table with AI Explanations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Prioritised Patient Queue</CardTitle>
          <CardDescription>Click any row to see the risk drivers</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Facility</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Wound Type</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">Trend</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedPatients.map((p) => {
                  const isExpanded = expandedId === p.id;
                  return (
                    <>
                      <tr
                        key={p.id}
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className={cn(
                          'cursor-pointer border-b border-border/50 transition-colors hover:bg-secondary/30',
                          isExpanded && 'bg-primary/3',
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                              (p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL') ? 'bg-destructive/10 text-destructive' :
                              p.riskLevel === 'AMBER' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success',
                            )}>
                              {p.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{p.facility}</td>
                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{p.woundType}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <div className="flex items-center justify-center gap-1.5">
                            {TREND_LABELS[p.healingTrend].icon}
                            <span className={cn('text-xs', TREND_LABELS[p.healingTrend].color)}>{p.healingTrend}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <RiskScoreBar score={p.riskScore} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <RiskBadge category={p.riskLevel === 'CRITICAL' ? 'RED' : p.riskLevel} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${p.id}-exp`} className="bg-primary/3 border-b border-border">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              {/* AI Explanation */}
                              <div className="rounded-lg border border-primary/20 bg-card p-4">
                                <div className="mb-3 flex items-center gap-2">
                                  <Brain className="h-4 w-4 text-primary" />
                                  <p className="text-sm font-semibold text-foreground">Risk Drivers</p>
                                </div>
                                <ul className="space-y-1.5">
                                  {p.riskDrivers.map((reason, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                                      {reason.factor}: {reason.clinicalNote}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              {/* Details */}
                              <div className="rounded-lg border border-border bg-card p-4">
                                <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                                  {p.surfaceArea > 0 && (
                                    <>
                                      <div>
                                        <p className="text-muted-foreground">Surface Area</p>
                                        <p className="font-semibold">{p.surfaceArea} cm²</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground">Area Change</p>
                                        <p className={cn('font-semibold', p.areaChangePct > 0 ? 'text-destructive' : 'text-success')}>
                                          {p.areaChangePct > 0 ? '+' : ''}{p.areaChangePct}%
                                        </p>
                                      </div>
                                    </>
                                  )}
                                  <div>
                                    <p className="text-muted-foreground">Wound Location</p>
                                    <p className="font-semibold">{p.woundLocation || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Clinician</p>
                                    <p className="font-semibold">{p.clinician}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Diabetes</p>
                                    <p className="font-semibold">{p.diabetes ? 'Yes' : 'No'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">PAD</p>
                                    <p className="font-semibold">{p.pad ? 'Yes' : 'No'}</p>
                                  </div>
                                </div>
                                <div className={cn(
                                  'mt-2 flex items-start gap-2 rounded-lg p-2',
                                  (p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL') ? 'bg-destructive/5' :
                                  p.riskLevel === 'AMBER' ? 'bg-warning/5' : 'bg-success/5',
                                )}>
                                  <AlertTriangle className={cn('h-4 w-4 shrink-0', (p.riskLevel === 'RED' || p.riskLevel === 'CRITICAL') ? 'text-destructive' : p.riskLevel === 'AMBER' ? 'text-warning' : 'text-success')} />
                                  <p className="text-xs text-foreground">{p.recommendedAction}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
