'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PilotPatient } from '@/lib/pilot-types';
import { RISK_TONE } from '@/lib/selectors-groupa';
import { PilotRiskBadge, PriorityBadge } from './pilot-patient-row';
import { AIReviewPanel } from '@/components/ai-ui';
import { useWorkspace } from '@/lib/workspace-context';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
} from 'recharts';
import {
  ArrowLeft,
  Brain,
  User,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface PatientDetailProps {
  patient: PilotPatient;
  onBack: () => void;
}

function fmt(iso: string, pattern: string): string {
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, pattern) : iso;
  } catch {
    return iso;
  }
}

const BORDER = { destructive: 'border-destructive/30', warning: 'border-warning/30', success: 'border-success/30' };
const BG = { destructive: 'bg-destructive/5', warning: 'bg-warning/5', success: 'bg-success/5' };
const TEXT = { destructive: 'text-destructive', warning: 'text-warning', success: 'text-success' };

export function PatientDetail({ patient, onBack }: PatientDetailProps) {
  const assessments = patient.assessments;
  const tone = RISK_TONE[patient.riskLevel];
  const chartData = assessments.map((a) => ({
    date: fmt(a.date, 'MMM d'),
    surfaceArea: a.surfaceArea,
  }));
  const comorbidities: string[] = [];
  if (patient.diabetes) comorbidities.push('Diabetes');
  if (patient.pad) comorbidities.push('PAD');
  const reasoning = patient.clinicalReasoning;
  const { isReviewed, reviewedDay, markReviewed, undoReviewed } = useWorkspace();
  const reviewed = isReviewed(patient);

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2 text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{patient.name}</h1>
            <p className="text-sm text-muted-foreground">
              {patient.id}{patient.nhsNumber ? ` · NHS ${patient.nhsNumber}` : ''} · {patient.age}y · {patient.gender} · {patient.facility}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reviewed ? (
              <Button variant="outline" onClick={() => undoReviewed(patient)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Visited {reviewedDay(patient)} · Undo
              </Button>
            ) : (
              <Button onClick={() => { markReviewed(patient); onBack(); }}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark reviewed
              </Button>
            )}
            <PriorityBadge priority={patient.tvnPriority} />
            <PilotRiskBadge level={patient.riskLevel} />
            <Badge variant="outline" className="text-xs">
              Risk Score: {patient.riskScore}/100
            </Badge>
          </div>
        </div>
      </div>

      {/* Top section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Patient Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Patient Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Patient ID</p>
                <p className="font-medium">{patient.id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Age / Gender</p>
                <p className="font-medium">{patient.age}y · {patient.gender}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Facility</p>
                <p className="font-medium">{patient.facility}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clinician</p>
                <p className="font-medium">{patient.clinician || 'Not recorded'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Review</p>
                <p className="font-medium">{fmt(patient.lastReviewDate, 'd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Days Since Review</p>
                <p className="font-medium">{patient.daysSinceReview}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comorbidities</p>
              <div className="flex flex-wrap gap-1.5">
                {comorbidities.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                ))}
                {comorbidities.length === 0 && (
                  <span className="text-sm text-muted-foreground">None recorded</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wound Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Wound Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Wound Type</p>
                <p className="font-medium">{patient.woundType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{patient.woundLocation}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">{patient.daysActive} days</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Status</p>
                <p className={`font-medium ${
                  patient.currentStatus === 'Improving' ? 'text-success' :
                  patient.currentStatus === 'Deteriorating' ? 'text-destructive' : 'text-warning'
                }`}>{patient.currentStatus}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Area Change</p>
                <p className="font-medium">{patient.areaChangePct > 0 ? '+' : ''}{patient.areaChangePct}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previous Area</p>
                <p className="font-medium">{patient.previousSurfaceArea}cm²</p>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Measurements</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-secondary/50 p-2">
                  <p className="text-[11px] text-muted-foreground">Length</p>
                  <p className="text-sm font-bold">{patient.length}cm</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <p className="text-[11px] text-muted-foreground">Width</p>
                  <p className="text-sm font-bold">{patient.width}cm</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <p className="text-[11px] text-muted-foreground">Depth</p>
                  <p className="text-sm font-bold">{patient.depth}cm</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <p className="text-[11px] text-muted-foreground">Area</p>
                  <p className="text-sm font-bold">{patient.surfaceArea}cm²</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinical Summary */}
        <Card className={`border-2 ${BORDER[tone]}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Clinical Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`rounded-lg p-3 ${BG[tone]}`}>
              <p className="text-sm text-foreground">{patient.tvnRationale}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[11px]">Confidence: {patient.clinicalConfidence}</Badge>
              {patient.expectedReviewTime && (
                <Badge variant="outline" className="text-[11px]">Review: {patient.expectedReviewTime}</Badge>
              )}
              <Badge variant="outline" className="text-[11px]">Overall risk: {patient.overallClinicalRisk}</Badge>
            </div>
            {patient.confidenceReasons.length > 0 && (
              <ul className="space-y-1">
                {patient.confidenceReasons.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                ))}
              </ul>
            )}
            <div className="border-t border-border pt-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${TEXT[tone]}`} />
                <p className="text-sm font-medium text-foreground">{patient.recommendedAction}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk drivers */}
      {(patient.riskDrivers.length > 0 || patient.flaggedReasons.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Drivers</CardTitle>
            <CardDescription>Why this patient is ranked {patient.tvnPriority}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {patient.riskDrivers.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {d.factor}
                    {d.isPrimary && <Badge variant="outline" className="ml-2 text-[11px]">Primary</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.clinicalNote}</p>
                </div>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">+{d.points}</span>
              </div>
            ))}
            {patient.flaggedReasons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {patient.flaggedReasons.map((r, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={`text-xs ${
                      r.severity === 'critical' ? 'border-destructive/30 text-destructive' :
                      r.severity === 'warning' ? 'border-warning/30 text-warning' : ''
                    }`}
                  >
                    {r.reason}
                  </Badge>
                ))}
              </div>
            )}
            {reasoning.contradictionNote && (
              <p className="text-xs text-muted-foreground">{reasoning.contradictionNote}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data quality */}
      {patient.dataQualityIssues.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader>
            <CardTitle className="text-base">Data Quality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {patient.dataQualityIssues.map((q, i) => (
              <p key={i} className="text-xs text-foreground">
                <span className="font-semibold">{q.field}:</span> {q.issue} — {q.impact}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Healing Graph */}
      {assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Healing Trajectory
            </CardTitle>
            <CardDescription>Wound surface area progression across {assessments.length} assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="cm²" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [`${v} cm²`, 'Surface Area']}
                />
                <Area type="monotone" dataKey="surfaceArea" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#areaGrad)" name="Surface Area" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Assessment Timeline */}
      <AIReviewPanel patient={patient} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Assessment History
          </CardTitle>
          <CardDescription>{assessments.length} assessments recorded</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...assessments].reverse().map((a, idx) => (
              <div key={`${a.date}-${idx}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full border-2 ${
                    a.infectionSigns ? 'border-destructive bg-destructive/20' : 'border-primary bg-primary/20'
                  }`} />
                  {idx < assessments.length - 1 && <div className="h-full w-px bg-border" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{fmt(a.date, 'EEEE, d MMM yyyy')}</p>
                      <p className="text-xs text-muted-foreground">Assessment #{assessments.length - idx}</p>
                    </div>
                    {a.infectionSigns && (
                      <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive text-xs w-fit">
                        Infection Signs
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-secondary/40 px-2 py-1">
                      <p className="text-[11px] text-muted-foreground">L</p>
                      <p className="text-sm font-semibold">{a.length}cm</p>
                    </div>
                    <div className="rounded bg-secondary/40 px-2 py-1">
                      <p className="text-[11px] text-muted-foreground">W</p>
                      <p className="text-sm font-semibold">{a.width}cm</p>
                    </div>
                    <div className="rounded bg-secondary/40 px-2 py-1">
                      <p className="text-[11px] text-muted-foreground">Area</p>
                      <p className="text-sm font-semibold">{a.surfaceArea}cm²</p>
                    </div>
                  </div>
                  {(a.exudate || a.tissueType) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.exudate && <Badge variant="outline" className="text-[11px]">Exudate: {a.exudate}</Badge>}
                      {a.tissueType && <Badge variant="outline" className="text-[11px]">Tissue: {a.tissueType}</Badge>}
                    </div>
                  )}
                  {a.notes && <p className="mt-2 text-xs text-muted-foreground">{a.notes}</p>}
                </div>
              </div>
            ))}
            {assessments.length === 0 && (
              <p className="text-sm text-muted-foreground">No assessment history in the uploaded data</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
