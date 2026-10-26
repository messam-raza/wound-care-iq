'use client';

import { formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import { buildFacilityStats, buildQualityReport, isHighRisk, isOverdue } from '@/lib/selectors-d';
import { HeartPulse, AlertTriangle, TrendingUp, Clock, Database } from 'lucide-react';

export function ExecutiveReport() {
  const { patients, summary, hasData } = useCaseload();
  if (!hasData) return <EmptyCaseload title="Executive Report" />;

  const total = patients.length;
  const highRisk = patients.filter(isHighRisk).length;
  const overdue = patients.filter(isOverdue).length;
  const improving = patients.filter((p) => p.healingTrend === 'Improving').length;
  const improvingPct = Math.round((improving / total) * 100);
  const quality = buildQualityReport(patients);
  const facilities = buildFacilityStats(patients);
  const priority = ['SEE TODAY', 'SEE THIS WEEK', 'MONITOR', 'HEALING'] as const;
  const priorityCounts = priority.map((k) => ({ label: k, count: patients.filter((p) => p.tvnPriority === k).length }));
  const issueCount = patients.filter((p) => p.dataQualityIssues.length > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Executive Report</h1>
        <p className="text-sm text-muted-foreground">
          Summary of the uploaded caseload{summary ? ` (${summary.fileName})` : ''}
        </p>
      </div>

      <Card className="border-2 border-border">
        <div className="border-b border-border bg-secondary/30 p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <HeartPulse className="h-5 w-5 text-primary-foreground" />
            </div>
            <p className="text-lg font-bold text-foreground">WoundCareIQ</p>
          </div>
          <h2 className="mt-3 text-xl font-bold text-foreground">Wound Care Caseload Report</h2>
          <p className="text-sm text-muted-foreground">
            {summary && summary.dateRangeStart ? `Assessments from ${formatDate(summary.dateRangeStart)} to ${formatDate(summary.dateRangeEnd)}` : 'Assessment dates not available'}
          </p>
        </div>

        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Summary</h3>
            <p className="text-sm text-foreground leading-relaxed">
              The caseload contains {total} wounds across {facilities.length} facilities.{' '}
              <strong className="text-destructive">{highRisk}</strong> are high risk, {overdue} have a review overdue, and{' '}
              {improving} ({improvingPct}%) show an improving trend in the uploaded assessments.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <HeartPulse className="h-5 w-5 text-primary" />
                <p className="mt-2 text-2xl font-bold">{total}</p>
                <p className="text-xs text-muted-foreground">Total Wounds</p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="mt-2 text-2xl font-bold text-destructive">{highRisk}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                <Clock className="h-5 w-5 text-warning" />
                <p className="mt-2 text-2xl font-bold text-warning">{overdue}</p>
                <p className="text-xs text-muted-foreground">Reviews Overdue</p>
              </div>
              <div className="rounded-lg border border-success/20 bg-success/5 p-4">
                <TrendingUp className="h-5 w-5 text-success" />
                <p className="mt-2 text-2xl font-bold text-success">{improvingPct}%</p>
                <p className="text-xs text-muted-foreground">Improving Trend</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Priority Distribution</h3>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {priorityCounts.map((p) => (
                <div key={p.label} className="rounded-lg border border-border p-4">
                  <p className="text-2xl font-bold">{p.count}</p>
                  <p className="text-xs text-muted-foreground">{p.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Facility Breakdown</h3>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Facility</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Patients</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-destructive">Red</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-warning">Amber</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-success">Green</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Improving</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((f) => (
                    <tr key={f.name} className="border-b border-border/50">
                      <td className="px-3 py-2 font-medium">{f.name}</td>
                      <td className="px-3 py-2 text-center">{f.totalPatients}</td>
                      <td className="px-3 py-2 text-center font-semibold text-destructive">{f.highRisk}</td>
                      <td className="px-3 py-2 text-center font-semibold text-warning">{f.amber}</td>
                      <td className="px-3 py-2 text-center font-semibold text-success">{f.green}</td>
                      <td className="px-3 py-2 text-center">{f.healingRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Data Quality</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-primary" />
              <span>{quality.completeRecords} of {quality.totalRecords} records complete ({quality.completenessPct}%).</span>
              <Badge variant="outline">{issueCount} with data quality issues</Badge>
              <Badge variant="outline">{quality.missingMeasurements} missing measurements</Badge>
              <Badge variant="outline">{quality.expiredAssessments} reviews older than 90 days</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
