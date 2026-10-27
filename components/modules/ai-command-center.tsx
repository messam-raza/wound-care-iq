'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RiskScoreBar } from '@/components/risk-badge';
import { useCaseload } from '@/lib/caseload-context';
import { EmptyCaseload } from '@/components/empty-caseload';
import type { PilotPatient } from '@/lib/pilot-types';
import { RISK_LEVEL_STYLES, TVN_PRIORITY_STYLES, initials } from '@/lib/selectors-groupb';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Brain,
  ArrowUpDown,
  AlertTriangle,
  Activity,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  Search,
  ChevronRight,
} from 'lucide-react';

type SortKey = 'risk' | 'facility' | 'woundAge' | 'woundType';

interface CommandCenterProps {
  onSelectPatient?: (patient: PilotPatient) => void;
}

function LevelBadge({ level }: { level: PilotPatient['riskLevel'] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${RISK_LEVEL_STYLES[level].badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${RISK_LEVEL_STYLES[level].dot}`} />
      {level}
    </span>
  );
}

export function AICommandCenter({ onSelectPatient }: CommandCenterProps) {
  const { patients, hasData } = useCaseload();
  const [sortBy, setSortBy] = useState<SortKey>('risk');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [selectedPatient, setSelectedPatient] = useState<PilotPatient | null>(null);

  const sorted = useMemo(() => {
    let result = [...patients];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.facility.toLowerCase().includes(q) ||
          p.woundType.toLowerCase().includes(q),
      );
    }

    if (riskFilter !== 'all') {
      result = result.filter((p) => p.riskLevel === riskFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'risk':
          return b.riskScore - a.riskScore;
        case 'facility':
          return a.facility.localeCompare(b.facility);
        case 'woundAge':
          return b.daysActive - a.daysActive;
        case 'woundType':
          return a.woundType.localeCompare(b.woundType);
        default:
          return 0;
      }
    });

    return result;
  }, [patients, sortBy, search, riskFilter]);

  const criticalCount = patients.filter((p) => p.riskLevel === 'CRITICAL').length;
  const redCount = patients.filter((p) => p.riskLevel === 'RED').length;
  const amberCount = patients.filter((p) => p.riskLevel === 'AMBER').length;
  const greenCount = patients.filter((p) => p.riskLevel === 'GREEN').length;
  const seeTodayCount = patients.filter((p) => p.tvnPriority === 'SEE TODAY').length;

  const trendIcon = (trend: string) => {
    if (trend === 'Improving') return <TrendingUp className="h-3.5 w-3.5 text-success" />;
    if (trend === 'Deteriorating') return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  if (!hasData) return <EmptyCaseload title="AI Wound Command Center" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Wound Command Center</h1>
          <p className="text-sm text-muted-foreground">
            AI-prioritized patient queue — {seeTodayCount} wounds to see today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-sm font-semibold text-destructive">{criticalCount} Critical</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span className="text-sm font-semibold text-destructive">{redCount} Red</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-sm font-semibold text-warning">{amberCount} Amber</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm font-semibold text-success">{greenCount} Green</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients, facilities, wound types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Risk filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="CRITICAL">Critical Only</SelectItem>
            <SelectItem value="RED">Red Only</SelectItem>
            <SelectItem value="AMBER">Amber Only</SelectItem>
            <SelectItem value="GREEN">Green Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-44">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="risk">Risk Score (High→Low)</SelectItem>
            <SelectItem value="facility">Facility (A→Z)</SelectItem>
            <SelectItem value="woundAge">Wound Age (Oldest)</SelectItem>
            <SelectItem value="woundType">Wound Type (A→Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Patient Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Patient</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Facility</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Wound Type</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">Days</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Size (cm²)</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">Trend</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk</th>
                  <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Priority</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 50).map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="cursor-pointer border-b border-border/50 transition-colors hover:bg-secondary/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${RISK_LEVEL_STYLES[patient.riskLevel].badge}`}>
                          {initials(patient.name)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.id} · {patient.age}{patient.gender ? ` ${patient.gender}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{patient.facility}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="text-muted-foreground">{patient.woundType}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-center sm:table-cell">
                      <span className={`font-medium ${patient.daysActive > 60 ? 'text-destructive' : patient.daysActive > 30 ? 'text-warning' : 'text-foreground'}`}>
                        {patient.daysActive}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-center tabular-nums text-muted-foreground md:table-cell">
                      {patient.surfaceArea.toFixed(1)}
                    </td>
                    <td className="hidden px-4 py-3 text-center lg:table-cell">
                      <div className="flex items-center justify-center gap-1.5">
                        {trendIcon(patient.healingTrend)}
                        <span className="text-xs text-muted-foreground">{patient.healingTrend}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <RiskScoreBar score={patient.riskScore} />
                        <LevelBadge level={patient.riskLevel} />
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-center md:table-cell">
                      <Badge variant="outline" className={`text-[11px] ${TVN_PRIORITY_STYLES[patient.tvnPriority]}`}>{patient.tvnPriority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
            <span>Showing {Math.min(sorted.length, 50)} of {sorted.length} patients</span>
            <span>Sorted by {sortBy === 'risk' ? 'risk score' : sortBy}</span>
          </div>
        </CardContent>
      </Card>

      {/* AI Explanation Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          {selectedPatient && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedPatient.name}</DialogTitle>
                    <DialogDescription>
                      {selectedPatient.id} · {selectedPatient.facility} · {selectedPatient.woundType}
                    </DialogDescription>
                  </div>
                  <LevelBadge level={selectedPatient.riskLevel} />
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Risk Score */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Risk Score</p>
                    <p className={`text-2xl font-bold ${RISK_LEVEL_STYLES[selectedPatient.riskLevel].text}`}>{selectedPatient.riskScore}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Days Active</p>
                    <p className="text-2xl font-bold text-foreground">{selectedPatient.daysActive}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Area Change</p>
                    <p className={`text-2xl font-bold ${
                      selectedPatient.areaChangePct > 0 ? 'text-destructive' : 'text-success'
                    }`}>
                      {selectedPatient.areaChangePct > 0 ? '+' : ''}{selectedPatient.areaChangePct}%
                    </p>
                  </div>
                </div>

                {/* Clinical Reasoning */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Brain className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Clinical Reasoning</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPatient.tvnPriority} · {selectedPatient.currentStatus} · {selectedPatient.clinicalConfidence} confidence
                      </p>
                    </div>
                  </div>
                  {selectedPatient.riskDrivers.length > 0 && (
                    <ul className="space-y-2">
                      {selectedPatient.riskDrivers.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                          <span>
                            {d.factor} (+{d.points}){d.clinicalNote ? ` — ${d.clinicalNote}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedPatient.flaggedReasons.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {selectedPatient.flaggedReasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${r.severity === 'critical' ? 'text-destructive' : r.severity === 'warning' ? 'text-warning' : 'text-muted-foreground'}`} />
                          {r.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedPatient.tvnRationale && (
                    <p className="mt-3 text-sm text-muted-foreground">{selectedPatient.tvnRationale}</p>
                  )}
                </div>

                {/* Recommended Action */}
                <div className={`rounded-lg border p-4 ${RISK_LEVEL_STYLES[selectedPatient.riskLevel].soft}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-5 w-5 shrink-0 ${RISK_LEVEL_STYLES[selectedPatient.riskLevel].text}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Recommended Action</p>
                      <p className="text-sm text-muted-foreground">{selectedPatient.recommendedAction}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Review: {selectedPatient.expectedReviewTime}</p>
                    </div>
                  </div>
                </div>

                {/* Comorbidities */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comorbidities</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.diabetes && <Badge variant="outline">Diabetes</Badge>}
                    {selectedPatient.pad && <Badge variant="outline">Peripheral Arterial Disease</Badge>}
                    {!selectedPatient.diabetes && !selectedPatient.pad && (
                      <span className="text-sm text-muted-foreground">None recorded</span>
                    )}
                  </div>
                </div>

                {onSelectPatient && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      onSelectPatient(selectedPatient);
                      setSelectedPatient(null);
                    }}
                  >
                    View Full Patient Record
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
