'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DataQualityReport } from '@/lib/import-types';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Database,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';

interface QualityPanelProps {
  report: DataQualityReport;
}

export function QualityPanel({ report }: QualityPanelProps) {
  const score = report.completenessPct;
  const color = score >= 75 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';

  const issues = [
    {
      label: 'Missing Patient Names',
      value: report.missingNames,
      icon: <AlertCircle className="h-4 w-4 text-warning" />,
      severity: report.missingNames > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Missing Facility Names',
      value: report.missingFacilities,
      icon: <AlertCircle className="h-4 w-4 text-warning" />,
      severity: report.missingFacilities > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Missing Measurements',
      value: report.missingMeasurements,
      icon: <AlertTriangle className="h-4 w-4 text-warning" />,
      severity: report.missingMeasurements > 0 ? 'warning' : 'ok',
    },
    {
      label: 'Expired Assessments (>90d)',
      value: report.expiredAssessments,
      icon: <XCircle className="h-4 w-4 text-destructive" />,
      severity: report.expiredAssessments > 0 ? 'error' : 'ok',
    },
    {
      label: 'Missing Clinician Names',
      value: report.missingClinicans,
      icon: <AlertCircle className="h-4 w-4 text-warning" />,
      severity: report.missingClinicans > 0 ? 'warning' : 'ok',
    },
  ];

  const radialData = [{ value: score, fill: score >= 75 ? 'hsl(var(--success))' : score >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Data Quality Dashboard</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Score Gauge */}
        <Card className={cn('border-2', score >= 75 ? 'border-success/20' : score >= 50 ? 'border-warning/20' : 'border-destructive/20')}>
          <CardContent className="flex flex-col items-center p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Complete Records</p>
            <ResponsiveContainer width={160} height={160}>
              <RadialBarChart
                cx="50%"
                cy="60%"
                innerRadius="70%"
                outerRadius="100%"
                data={radialData}
                startAngle={180}
                endAngle={0}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'hsl(var(--secondary))' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className={cn('text-4xl font-bold', color)}>{score}%</p>
            <p className="mt-1 text-xs text-muted-foreground">of records have no missing key fields</p>
          </CardContent>
        </Card>

        {/* Record Summary */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Record Summary</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-secondary/40 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{report.totalRecords}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <p className="text-2xl font-bold text-success">{report.completeRecords}</p>
                <p className="text-xs text-muted-foreground">Complete</p>
              </div>
              <div className="rounded-lg bg-warning/10 p-3 text-center">
                <p className="text-2xl font-bold text-warning">{report.totalRecords - report.completeRecords}</p>
                <p className="text-xs text-muted-foreground">Incomplete</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issue Breakdown */}
        <Card>
          <CardContent className="p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue Breakdown</p>
            {issues.map((issue) => (
              <div key={issue.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {issue.severity === 'ok'
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : issue.icon}
                  <span className="text-xs text-foreground">{issue.label}</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs tabular-nums',
                    issue.severity === 'ok'
                      ? 'border-success/30 text-success'
                      : issue.severity === 'error'
                      ? 'border-destructive/30 text-destructive'
                      : 'border-warning/30 text-warning',
                  )}
                >
                  {issue.value}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
