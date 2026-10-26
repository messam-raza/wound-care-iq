'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { RISK_LEVEL_STYLES } from '@/lib/selectors-groupb';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Clock,
  Ruler,
  ClipboardList,
  Database,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

const OVERDUE_DAYS = 14; // same overdue-reassessment threshold used by the engine's facility summaries

function fmt(date: string, pattern: string) {
  const d = parseISO(date);
  return isValid(d) ? format(d, pattern) : date;
}

export function DigitalWoundMonitoring() {
  const { patients, hasData } = useCaseload();
  const [selectedId, setSelectedId] = useState<string>('');

  const sortedByRecency = useMemo(
    () => [...patients].sort((a, b) => b.daysSinceReview - a.daysSinceReview),
    [patients],
  );
  const patient = patients.find((p) => p.id === selectedId) || sortedByRecency[0];

  if (!hasData || !patient) return <EmptyCaseload title="Digital Wound Monitoring" />;

  const overdue = patients.filter((p) => p.daysSinceReview > OVERDUE_DAYS).length;
  const withIssues = patients.filter((p) => p.dataQualityWarning || p.dataQualityIssues.length > 0).length;
  const singleAssessment = patients.filter((p) => p.assessments.length < 2).length;
  const avgAssessments = (patients.reduce((s, p) => s + p.assessments.length, 0) / patients.length).toFixed(1);

  const assessments = patient.assessments;
  const first = assessments[0];
  const latest = assessments[assessments.length - 1];
  const areaChange =
    first && latest && first.surfaceArea > 0 && assessments.length > 1
      ? ((latest.surfaceArea - first.surfaceArea) / first.surfaceArea) * 100
      : null;

  const chartData = assessments.map((a) => ({
    date: fmt(a.date, 'MMM d'),
    length: a.length,
    width: a.width,
    surfaceArea: a.surfaceArea,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Digital Wound Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Assessment recency and data completeness from the uploaded caseload
          </p>
        </div>
        <Select value={patient.id} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Select patient" />
          </SelectTrigger>
          <SelectContent>
            {sortedByRecency.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {p.woundType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Caseload-level recency / completeness */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: `Reassessment overdue (>${OVERDUE_DAYS}d)`, value: overdue, icon: <Clock className="h-4 w-4 text-warning" /> },
          { label: 'Data quality issues', value: withIssues, icon: <AlertTriangle className="h-4 w-4 text-warning" /> },
          { label: 'Only one assessment', value: singleAssessment, icon: <ClipboardList className="h-4 w-4 text-primary" /> },
          { label: 'Avg assessments per wound', value: avgAssessments, icon: <Database className="h-4 w-4 text-primary" /> },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
              </div>
              {k.icon}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assessment history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Assessment History
          </CardTitle>
          <CardDescription>
            {patient.name} · {patient.woundType} · {patient.woundLocation} · {patient.lastReviewDate ? `last review ${patient.daysSinceReview}d ago (${fmt(patient.lastReviewDate, 'd MMM yyyy')})` : `last assessment ${patient.daysSinceReview}d ago, no review date recorded`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-center font-semibold">Area (cm²)</th>
                  <th className="px-4 py-2 text-center font-semibold">L × W (cm)</th>
                  <th className="px-4 py-2 text-center font-semibold">Exudate</th>
                  <th className="px-4 py-2 text-center font-semibold">Infection signs</th>
                  <th className="px-4 py-2 text-left font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-2">{fmt(a.date, 'd MMM yyyy')}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{a.surfaceArea}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{a.length > 0 && a.width > 0 ? `${a.length} × ${a.width}` : '—'}</td>
                    <td className="px-4 py-2 text-center">{a.exudate ?? '—'}</td>
                    <td className="px-4 py-2 text-center">{a.infectionSigns ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Latest measurements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ruler className="h-4 w-4 text-primary" />
              Current Measurements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Length', value: patient.length, unit: 'cm' },
                { label: 'Width', value: patient.width, unit: 'cm' },
                { label: 'Depth', value: patient.depth, unit: 'cm' },
                { label: 'Surface Area', value: patient.surfaceArea, unit: 'cm²' },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-bold text-foreground">
                    {m.value > 0 ? (
                      <>{m.value}<span className="text-sm font-normal text-muted-foreground"> {m.unit}</span></>
                    ) : (
                      <span className="text-sm font-normal text-muted-foreground">Not recorded</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Area change since first assessment</span>
                <span className={`font-bold ${areaChange === null ? 'text-muted-foreground' : areaChange < 0 ? 'text-success' : areaChange > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {areaChange === null ? '—' : `${areaChange > 0 ? '+' : ''}${areaChange.toFixed(1)}%`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge variant="outline">{patient.currentStatus}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Risk</span>
                <span className={`font-semibold ${RISK_LEVEL_STYLES[patient.riskLevel].text}`}>{patient.riskLevel}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data completeness for selected patient */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Data Completeness
            </CardTitle>
            <CardDescription>
              {assessments.length} assessment{assessments.length === 1 ? '' : 's'} · {patient.daysSinceReview > OVERDUE_DAYS ? `reassessment overdue (${patient.daysSinceReview}d since review)` : `reviewed ${patient.daysSinceReview}d ago`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {patient.dataQualityIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data quality issues detected for this wound.</p>
            ) : (
              patient.dataQualityIssues.map((q, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{q.field}: {q.issue}</p>
                    <p className="text-xs text-muted-foreground">{q.impact}</p>
                  </div>
                </div>
              ))
            )}
            {patient.confidenceReasons.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Clinical confidence: {patient.clinicalConfidence}
                </p>
                <ul className="space-y-1">
                  {patient.confidenceReasons.map((r, i) => (
                    <li key={i} className="text-xs text-foreground">• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Measurement Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Measurement Progression
          </CardTitle>
          <CardDescription>Recorded length, width and surface area over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  fontSize: '12px',
                }}
              />
              {patient.assessments.some((a) => a.length > 0 && a.width > 0) && (
                <Line type="monotone" dataKey="length" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Length (cm)" dot={{ r: 3 }} />
              )}
              {patient.assessments.some((a) => a.length > 0 && a.width > 0) && (
                <Line type="monotone" dataKey="width" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Width (cm)" dot={{ r: 3 }} />
              )}
              <Line type="monotone" dataKey="surfaceArea" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Area (cm²)" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
