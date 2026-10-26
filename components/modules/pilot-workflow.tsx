'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCaseload } from '@/lib/caseload-context';
import { AIReviewBar, AIReviewPanel } from '@/components/ai-ui';
import {
  PRIORITY, PriorityBadge, AIRaisedChip, Chip, PatientRow, Section, ShowMore, Metric, Notice, Disclosure, PatientPicker,
  statusTone, riskTone, confidenceTone,
} from '@/components/pilot-ui';
import type { PilotPatient, PilotRiskLevel, PilotUploadSummary, PilotView, TVNSortKey, TVNPriority, PilotFacilitySummary, FlaggedReasonItem, ClinicalConfidence } from '@/lib/pilot-types';
import {
  parseUploadedFile,
  runPilotImport,
  generateTemplateCSV,
  getRankedCaseload,
  getCriticalPatients,
  getDeterioratingWounds,
  getPatientsRequiringReview,
  getPotentialInfections,
  getEscalationCandidates,
  getTVNQueue,
  sortTVNQueue,
  getFacilitySummaries,
  getTrajectoryData,
  filterByTVNPriority,
  getTVNPriorityCounts,
  getCareHomeView,
  getCommunityNurseView,
  getMostLikelyToDeteriorate,
  getDelayedHealingCases,
  generateHandoverCSV,
  generateHandoverTextReport,
  generateCaseloadPrioritizationReport,
  generateCaseloadCSV,
  downloadFile,
} from '@/lib/pilot-engine';
import {
  Upload, FileSpreadsheet, FileText, Users, Activity, AlertTriangle,
  TrendingDown, Clock, ArrowUpCircle, Stethoscope, Building2,
  Brain, Download, FileDown, Zap, ChevronRight, History, TrendingUp,
  ClipboardList, CheckCircle2, Search, Eye, Calendar, Heart,
  Home as HomeIcon, HeartPulse, Filter, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts';

// ─── Style Maps ──────────────────────────────────────────────────────────────

const RISK_STYLES: Record<PilotRiskLevel, { badge: string; bg: string; text: string; border: string }> = {
  CRITICAL: { badge: 'border-destructive/40 bg-destructive/10 text-destructive', bg: 'bg-destructive/5', text: 'text-destructive', border: 'border-destructive/30' },
  RED: { badge: 'border-destructive/30 bg-destructive/5 text-destructive', bg: 'bg-destructive/5', text: 'text-destructive', border: 'border-destructive/20' },
  AMBER: { badge: 'border-warning/30 bg-warning/5 text-warning', bg: 'bg-warning/5', text: 'text-warning', border: 'border-warning/30' },
  GREEN: { badge: 'border-success/30 bg-success/5 text-success', bg: 'bg-success/5', text: 'text-success', border: 'border-success/30' },
};

const TVN_PRIORITY_STYLES: Record<TVNPriority, { badge: string; bg: string; text: string; border: string; dot: string }> = {
  'SEE TODAY': { badge: 'border-destructive/40 bg-destructive/10 text-destructive', bg: 'bg-destructive/5', text: 'text-destructive', border: 'border-destructive/40', dot: 'bg-destructive' },
  'SEE THIS WEEK': { badge: 'border-warning/40 bg-warning/10 text-warning', bg: 'bg-warning/5', text: 'text-warning', border: 'border-warning/40', dot: 'bg-warning' },
  'MONITOR': { badge: 'border-primary/30 bg-primary/5 text-primary', bg: 'bg-primary/5', text: 'text-primary', border: 'border-primary/30', dot: 'bg-primary' },
  'HEALING': { badge: 'border-success/30 bg-success/5 text-success', bg: 'bg-success/5', text: 'text-success', border: 'border-success/30', dot: 'bg-success' },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />,
  warning: <Clock className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />,
  info: <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />,
};

const CONFIDENCE_STYLES: Record<ClinicalConfidence, { badge: string; text: string; bg: string; border: string; icon: React.ReactNode }> = {
  HIGH: { badge: 'border-success/30 bg-success/5 text-success', text: 'text-success', bg: 'bg-success/5', border: 'border-success/30', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  MEDIUM: { badge: 'border-warning/30 bg-warning/5 text-warning', text: 'text-warning', bg: 'bg-warning/5', border: 'border-warning/30', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  LOW: { badge: 'border-destructive/30 bg-destructive/5 text-destructive', text: 'text-destructive', bg: 'bg-destructive/5', border: 'border-destructive/30', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function PilotWorkflow() {
  const [view, setView] = useState<PilotView>('upload');
  const { patients, summary, setCaseload } = useCaseload();
  const [selectedPatient, setSelectedPatient] = useState<PilotPatient | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setIsProcessing(true);

    try {
      const text = await file.text();
      const { headers, rows } = parseUploadedFile(file.name, text);

      if (rows.length === 0) {
        setUploadError(
          'No data rows found. If you uploaded an Excel (.xlsx) file, please save it as CSV first — Excel files need to be exported as CSV to process in the browser.',
        );
        setIsProcessing(false);
        return;
      }

      const result = runPilotImport(file.name, headers, rows);
      setCaseload(result.patients, result.summary);
      setView('caseload');
    } catch {
      setUploadError('Failed to parse file. Please ensure it is a valid CSV export from SystmOne, EMIS, or your wound care system.');
    }
    setIsProcessing(false);
  }, [setCaseload]);

  const handleDownloadSample = useCallback(() => {
    downloadFile(generateTemplateCSV(), 'woundcareiq-csv-template.csv', 'text/csv');
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // ─── Navigation Tabs ─────────────────────────────────────────────────────

  const navItems: { id: PilotView; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload className="h-4 w-4" /> },
    { id: 'caseload', label: 'Caseload', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'worklist', label: 'Worklist', icon: <Filter className="h-4 w-4" /> },
    { id: 'tvn', label: 'TVN Queue', icon: <Stethoscope className="h-4 w-4" /> },
    { id: 'trajectory', label: 'Trajectory', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'handover', label: 'Export', icon: <FileDown className="h-4 w-4" /> },
    { id: 'facility', label: 'Facilities', icon: <Building2 className="h-4 w-4" /> },
    { id: 'carehome', label: 'Care Home', icon: <HomeIcon className="h-4 w-4" /> },
    { id: 'community', label: 'Community', icon: <Users className="h-4 w-4" /> },
    { id: 'history', label: 'Patient', icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Activity className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pilot Workflow</h1>
          <p className="text-sm text-muted-foreground">
            Upload wound data to see who cannot wait today
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              view === item.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              !summary && item.id !== 'upload' && 'opacity-40 cursor-not-allowed',
            )}
            disabled={!summary && item.id !== 'upload'}
          >
            <span className="hidden 2xl:block">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {!summary && view === 'upload' && (
        <PilotUploadView
          onFileUpload={handleFileUpload}
          onDownloadSample={handleDownloadSample}
          error={uploadError}
          isProcessing={isProcessing}
          fileInputRef={fileInputRef}
          onFileInput={handleFileInput}
          onDrop={handleDrop}
        />
      )}

      {summary && view === 'upload' && (
        <PilotReuploadView
          summary={summary}
          onFileUpload={handleFileUpload}
          onDownloadSample={handleDownloadSample}
          error={uploadError}
          isProcessing={isProcessing}
          fileInputRef={fileInputRef}
          onFileInput={handleFileInput}
          onDrop={handleDrop}
        />
      )}

      {summary && view === 'caseload' && (
        <CaseloadView patients={patients} onSelectPatient={(p) => { setSelectedPatient(p); setView('history'); }} />
      )}

      {summary && view === 'worklist' && (
        <WorklistView patients={patients} onSelectPatient={(p) => { setSelectedPatient(p); setView('history'); }} />
      )}

      {summary && view === 'tvn' && (
        <TVNQueueView patients={patients} onSelectPatient={(p) => { setSelectedPatient(p); setView('history'); }} />
      )}

      {summary && view === 'history' && (
        <PatientHistoryView patient={selectedPatient} patients={patients} onSelectPatient={setSelectedPatient} onBack={() => setView('caseload')} />
      )}

      {summary && view === 'trajectory' && (
        <TrajectoryView patients={patients} onSelectPatient={(p) => { setSelectedPatient(p); setView('trajectory'); }} selectedPatient={selectedPatient} />
      )}

      {summary && view === 'handover' && (
        <HandoverReportView patients={patients} />
      )}

      {summary && view === 'facility' && (
        <FacilityPriorityView patients={patients} />
      )}

      {summary && view === 'carehome' && (
        <CareHomeView patients={patients} onSelectPatient={(p) => { setSelectedPatient(p); setView('history'); }} />
      )}

      {summary && view === 'community' && (
        <CommunityNurseView patients={patients} onSelectPatient={(p) => { setSelectedPatient(p); setView('history'); }} />
      )}
    </div>
  );
}

// ─── 1. Upload View ──────────────────────────────────────────────────────────

interface PilotUploadViewProps {
  onFileUpload: (file: File) => void;
  onDownloadSample: () => void;
  error: string | null;
  isProcessing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
}

function PilotUploadView({ onFileUpload, onDownloadSample, error, isProcessing, fileInputRef, onFileInput, onDrop }: PilotUploadViewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8">
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 text-center transition-colors hover:border-primary/40"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-4 text-lg font-semibold text-foreground">Upload Wound Data</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              Drag and drop your file here, or click to browse. Supports CSV, Excel, and XLSX files from SystmOne, EMIS, or community wound datasets.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
                <Upload className="mr-2 h-4 w-4" />
                {isProcessing ? 'Processing...' : 'Choose File'}
              </Button>
              <Button variant="ghost" onClick={onDownloadSample}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFileInput}
              className="hidden"
            />

            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> CSV</span>
              <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</span>
              <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> XLSX</span>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">{error}</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'SystmOne Exports', desc: 'CSV export from SystmOne wound records' },
              { label: 'EMIS Exports', desc: 'CSV export from EMIS Web wound data' },
              { label: 'Community Datasets', desc: 'Community nursing wound assessment files' },
              { label: 'Care Home Reports', desc: 'Care home wound monitoring spreadsheets' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs font-semibold text-foreground">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PilotReuploadView(props: PilotUploadViewProps & { summary: PilotUploadSummary }) {
  return (
    <div className="space-y-6">
      <UploadSummaryCard summary={props.summary} />
      <PilotUploadView {...props} />
    </div>
  );
}

function UploadSummaryCard({ summary }: { summary: PilotUploadSummary }) {
  const cards = [
    { label: 'Total Records', value: summary.totalRecords, icon: <FileText className="h-5 w-5 text-primary" /> },
    { label: 'Unique Patients', value: summary.uniquePatients, icon: <Users className="h-5 w-5 text-primary" /> },
    { label: 'Assessments Analysed', value: summary.assessmentsAnalysed, icon: <Activity className="h-5 w-5 text-primary" /> },
    { label: 'Facilities', value: summary.facilitiesImported, icon: <Building2 className="h-5 w-5 text-primary" /> },
  ];

  const consolidated = summary.totalRecords > summary.uniquePatients;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <p className="text-sm font-semibold text-foreground">Upload Successful — {summary.fileName}</p>
          {consolidated ? (
            <p className="text-xs text-muted-foreground">
              {summary.totalRecords} assessment records consolidated into {summary.uniquePatients} unique patients
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {summary.uniquePatients} patients imported
            </p>
          )}
          {summary.dateRangeStart && summary.dateRangeEnd && (
            <p className="text-xs text-muted-foreground">
              Date range: {new Date(summary.dateRangeStart).toLocaleDateString('en-GB')} — {new Date(summary.dateRangeEnd).toLocaleDateString('en-GB')}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-2">
              {c.icon}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{c.value}</p>
          </Card>
        ))}
      </div>
      {consolidated && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Brain className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-foreground">
            Patient Consolidation Engine active — {summary.totalRecords} assessment records across {summary.uniquePatients} patients analysed to produce one clinical recommendation per patient.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── 2. My Priority Caseload View ────────────────────────────────────────────

const PRIORITY_ORDER: TVNPriority[] = ['SEE TODAY', 'SEE THIS WEEK', 'MONITOR', 'HEALING'];

function SummaryTile({ priority, count, total }: { priority: TVNPriority; count: number; total: number }) {
  const s = PRIORITY[priority];
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', s.dot)} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{priority}</p>
      </div>
      <p className={cn('mt-2 text-3xl font-bold tabular-nums', s.text)}>{count}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {total > 0 ? `${Math.round((count / total) * 100)}% of caseload` : '—'}
      </p>
    </div>
  );
}

function CaseloadView({ patients, onSelectPatient }: { patients: PilotPatient[]; onSelectPatient: (p: PilotPatient) => void }) {
  const ranked = getRankedCaseload(patients);
  const counts = getTVNPriorityCounts(patients);
  const seeToday = ranked.filter((p) => p.tvnPriority === 'SEE TODAY');

  return (
    <div className="space-y-6">
      {seeToday.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-destructive">
              {seeToday.length} {seeToday.length === 1 ? 'patient' : 'patients'} cannot wait today
            </p>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">
              {seeToday.slice(0, 4).map((p) => p.name).join(', ')}
              {seeToday.length > 4 && ` and ${seeToday.length - 4} more`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PRIORITY_ORDER.map((priority) => (
          <SummaryTile key={priority} priority={priority} count={counts[priority]} total={patients.length} />
        ))}
      </div>

      <AIReviewBar />

      <FocusLists patients={patients} onSelectPatient={onSelectPatient} />

      <Section title="Priority caseload" description={`All ${ranked.length} patients, ranked by clinical priority`}>
        <ShowMore
          items={ranked}
          limit={15}
          render={(p, i) => <PatientRow key={p.id} patient={p} rank={i + 1} showReason onClick={() => onSelectPatient(p)} />}
        />
      </Section>
    </div>
  );
}

// One tabbed list in place of four near-identical "Top 10" cards.
function FocusLists({ patients, onSelectPatient }: { patients: PilotPatient[]; onSelectPatient: (p: PilotPatient) => void }) {
  const tabs = [
    { key: 'det', label: 'Deteriorating or high risk', icon: <TrendingDown className="h-4 w-4" />, list: getMostLikelyToDeteriorate(patients) },
    { key: 'esc', label: 'Escalation', icon: <ArrowUpCircle className="h-4 w-4" />, list: getEscalationCandidates(patients) },
    { key: 'inf', label: 'Infection', icon: <AlertTriangle className="h-4 w-4" />, list: getPotentialInfections(patients) },
    { key: 'del', label: 'Delayed healing', icon: <Clock className="h-4 w-4" />, list: getDelayedHealingCases(patients) },
  ];
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <Section title="Focus lists" description="The patients behind each concern, highest score first">
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              t.key === active ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {t.icon}
            {t.label}
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', t.key === active ? 'bg-primary-foreground/20' : 'bg-secondary')}>{t.list.length}</span>
          </button>
        ))}
      </div>
      <ShowMore
        key={current.key}
        items={current.list}
        limit={5}
        render={(p) => <PatientRow key={p.id} patient={p} onClick={() => onSelectPatient(p)} />}
      />
    </Section>
  );
}

// ─── 3. My Worklist View ─────────────────────────────────────────────────────

function WorklistView({ patients, onSelectPatient }: { patients: PilotPatient[]; onSelectPatient: (p: PilotPatient) => void }) {
  const [activeFilter, setActiveFilter] = useState<TVNPriority | 'ALL'>('ALL');
  const counts = getTVNPriorityCounts(patients);

  const filters: { key: TVNPriority | 'ALL'; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: patients.length },
    { key: 'SEE TODAY', label: 'See today', count: counts['SEE TODAY'] },
    { key: 'SEE THIS WEEK', label: 'See this week', count: counts['SEE THIS WEEK'] },
    { key: 'MONITOR', label: 'Monitor', count: counts['MONITOR'] },
    { key: 'HEALING', label: 'Healing', count: counts['HEALING'] },
  ];

  const filtered = activeFilter === 'ALL' ? getRankedCaseload(patients) : filterByTVNPriority(patients, activeFilter);

  return (
    <Section
      title="My worklist"
      description="Filter your caseload by priority"
      icon={<ClipboardList className="h-5 w-5 text-primary" />}
      count={filtered.length}
    >
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              activeFilter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {f.key !== 'ALL' && <span className={cn('h-2 w-2 rounded-full', PRIORITY[f.key].dot)} />}
            {f.label}
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', activeFilter === f.key ? 'bg-primary-foreground/20' : 'bg-secondary')}>{f.count}</span>
          </button>
        ))}
      </div>
      <ShowMore
        key={activeFilter}
        items={filtered}
        limit={20}
        empty="No patients in this category"
        render={(p) => <PatientRow key={p.id} patient={p} showReason onClick={() => onSelectPatient(p)} />}
      />
    </Section>
  );
}

// ─── 4. TVN Referral Queue View ──────────────────────────────────────────────

const QUEUE_COLUMNS = 'lg:grid-cols-[3rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_9.5rem_minmax(0,1.6fr)]';

function TVNQueueView({ patients, onSelectPatient }: { patients: PilotPatient[]; onSelectPatient: (p: PilotPatient) => void }) {
  const [sortKey, setSortKey] = useState<TVNSortKey>('risk');
  const queue = sortTVNQueue(getTVNQueue(patients), sortKey);

  const sortOptions: { key: TVNSortKey; label: string }[] = [
    { key: 'risk', label: 'Risk' },
    { key: 'facility', label: 'Facility' },
    { key: 'woundType', label: 'Wound type' },
    { key: 'date', label: 'Date' },
  ];

  const rankedCaseload = getRankedCaseload(patients);
  const getRank = (id: string) => rankedCaseload.findIndex((p) => p.id === id) + 1;

  return (
    <Section
      title="TVN referral worklist"
      description="Patients requiring specialist review, ranked by priority"
      icon={<Stethoscope className="h-5 w-5 text-primary" />}
      count={queue.length}
      action={
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">Sort by</span>
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortKey(opt.key)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-sm font-medium transition-colors',
                sortKey === opt.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <div className={cn('hidden gap-x-4 border-b border-border bg-secondary/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid', QUEUE_COLUMNS)}>
        <span>Rank</span>
        <span>Patient</span>
        <span>Facility</span>
        <span>Reason</span>
        <span>Priority</span>
        <span>Recommended action</span>
      </div>
      {queue.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No patients in TVN queue</p>
      ) : (
        <div className="divide-y divide-border/60">
          {queue.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPatient(p)}
              className={cn('grid w-full gap-x-4 gap-y-1.5 border-l-4 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40', PRIORITY[p.tvnPriority].bar, QUEUE_COLUMNS)}
            >
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">#{getRank(p.id)}</span>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-foreground">{p.name}</p>
                <p className="break-words text-xs text-muted-foreground">{p.woundType}</p>
              </div>
              <p className="break-words text-sm text-foreground">{p.facility}</p>
              <p className="line-clamp-2 text-sm text-foreground/80">{p.flaggedReasons.slice(0, 2).map((r) => r.reason).join('; ')}</p>
              <div className="space-y-1">
                <PriorityBadge priority={p.tvnPriority} />
                <p className="text-xs text-muted-foreground">Review {p.expectedReviewTime.toLowerCase()}</p>
              </div>
              <p className="text-sm text-foreground/80">{p.recommendedAction}</p>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── 5. Patient History Panel ────────────────────────────────────────────────

function PatientHistoryView({ patient, patients, onSelectPatient }: {
  patient: PilotPatient | null;
  patients: PilotPatient[];
  onSelectPatient: (p: PilotPatient) => void;
  onBack: () => void;
}) {
  const current = patient || patients[0] || null;

  if (!current) {
    return <div className="py-12 text-center text-sm text-muted-foreground">No patients available</div>;
  }

  const trajectory = getTrajectoryData(current);
  const r = current.clinicalReasoning;
  const s = PRIORITY[current.tvnPriority];
  const history = [...current.assessments].reverse();
  const location = [current.woundType, current.woundLocation, current.facility].filter((v) => v && v !== 'Unknown').join(' · ');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <PatientPicker patients={getRankedCaseload(patients)} selectedId={current.id} onSelect={onSelectPatient} />

      <div className="min-w-0 space-y-6">
        {/* Summary */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold text-foreground">{current.name}</h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {current.nhsNumber !== 'Not provided' && <span className="tabular-nums">NHS {current.nhsNumber} · </span>}
                {location}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {current.aiRaised && <AIRaisedChip />}
                <PriorityBadge priority={current.tvnPriority} size="lg" />
              </div>
              <p className="text-sm text-muted-foreground">
                Risk score <span className="font-semibold tabular-nums text-foreground">{current.riskScore}</span>/100 · {current.riskLevel}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Days open" value={`${current.daysActive} days`} />
            <Metric
              label="Area change"
              value={`${current.areaChangePct > 0 ? '+' : ''}${current.areaChangePct}%`}
              tone={current.areaChangePct > 0 ? 'destructive' : current.areaChangePct < 0 ? 'success' : 'neutral'}
            />
            <Metric label="Healing trend" value={current.healingTrend} tone={current.healingTrend === 'Deteriorating' ? 'destructive' : current.healingTrend === 'Stalled' ? 'warning' : 'success'} />
            <Metric label="Last review" value={current.reviewDueText} tone={current.reviewDelayDays > 14 ? 'destructive' : current.reviewDelayDays > 7 ? 'warning' : 'neutral'} />
            <Metric label="Current status" value={current.currentStatus} tone={statusTone(current.currentStatus)} />
            <Metric label="Overall clinical risk" value={current.overallClinicalRisk} tone={riskTone(current.overallClinicalRisk)} />
            <Metric label="Confidence" value={current.clinicalConfidence} tone={confidenceTone(current.clinicalConfidence)} />
            <Metric label="Review" value={r.expectedReviewTime} />
          </div>
        </section>

        {/* Alerts */}
        {(r.woundImprovingButHighRisk || (r.contradictionResolved && r.contradictionNote) || current.dataQualityWarning) && (
          <div className="space-y-3">
            {r.woundImprovingButHighRisk && (
              <Notice tone="warning" title="Wound improving, but the patient remains high risk">
                Do not de-prioritise on wound size alone: {r.highRiskReasons.join(', ')}.
              </Notice>
            )}
            {r.contradictionResolved && r.contradictionNote && (
              <Notice tone="warning" title="Conflicting signals resolved">{r.contradictionNote}</Notice>
            )}
            {current.dataQualityWarning && (
              <Notice tone="destructive" title="Confidence reduced by missing data">
                <ul className="space-y-1">
                  {current.dataQualityIssues.map((issue) => (
                    <li key={issue.field}>
                      <span className="font-medium text-foreground">{issue.field}:</span> {issue.issue}. {issue.impact}
                    </li>
                  ))}
                </ul>
              </Notice>
            )}
          </div>
        )}

        {/* Reasoning */}
        <Section title="Clinical reasoning" icon={<Brain className="h-5 w-5 text-primary" />}>
          <div className="space-y-5 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary driver</p>
              <p className="mt-1.5 text-base font-semibold leading-snug text-foreground">{r.primaryDriver}</p>
            </div>
            {r.secondaryDrivers.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Also contributing</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.secondaryDrivers.map((d) => (
                    <Chip key={d}>{d}</Chip>
                  ))}
                </div>
              </div>
            )}
            <div className={cn('rounded-lg border px-4 py-3', s.border, s.tint)}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended action</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{r.recommendedAction}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this patient is prioritised</p>
              <ul className="mt-2 space-y-2">
                {current.flaggedReasons.map((reason) => (
                  <li key={reason.reason} className="flex items-start gap-2.5">
                    {SEVERITY_ICONS[reason.severity]}
                    <span className={cn('text-sm leading-snug', reason.severity === 'info' ? 'text-foreground/80' : 'text-foreground')}>{reason.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <AIReviewPanel patient={current} />

        {/* Supporting detail, collapsed by default */}
        <div className="space-y-3">
          {current.riskDrivers.length > 0 && (
            <Disclosure title="Risk score breakdown" meta={`${current.riskDrivers.length} factors`}>
              <ul className="divide-y divide-border/60">
                {current.riskDrivers.map((d) => (
                  <li key={d.factor} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 py-2.5 first:pt-0 last:pb-0">
                    <span className={cn('text-sm font-semibold tabular-nums', d.isPrimary ? 'text-destructive' : 'text-muted-foreground')}>+{d.points}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {d.factor}
                        {d.isPrimary && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive">Primary</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{d.clinicalNote}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          <Disclosure title="Clinical confidence" meta={current.clinicalConfidence}>
            <ul className="space-y-2">
              {current.confidenceReasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2.5 text-sm text-foreground/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  {reason}
                </li>
              ))}
            </ul>
          </Disclosure>
          <Disclosure title="TVN rationale">
            <p className="text-sm leading-relaxed text-foreground/80">{current.tvnRationale}</p>
          </Disclosure>
        </div>

        {/* Measurements */}
        <Section title="Wound measurements" description={`${history.length} assessment${history.length === 1 ? '' : 's'}`} icon={<History className="h-5 w-5 text-primary" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5 text-right">Area</th>
                  <th className="px-4 py-2.5 text-right">Change</th>
                  <th className="px-4 py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {history.map((a, i) => {
                  const prev = history[i + 1];
                  const change = prev && prev.surfaceArea > 0 ? Math.round(((a.surfaceArea - prev.surfaceArea) / prev.surfaceArea) * 100) : null;
                  const notes = [a.tissueType, a.exudate && `Exudate ${a.exudate}`, a.infectionSigns && 'Infection signs', a.notes].filter(Boolean).join(' · ');
                  return (
                    <tr key={`${a.date}-${i}`}>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{history.length - i}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-foreground">
                        {a.date ? new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums text-foreground">{a.surfaceArea} cm²</td>
                      <td className={cn('whitespace-nowrap px-4 py-2.5 text-right tabular-nums', change === null ? 'text-muted-foreground' : change > 0 ? 'text-destructive' : change < 0 ? 'text-success' : 'text-muted-foreground')}>
                        {change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Chart */}
        <Section title="Healing trajectory" description="Measured wound area over time">
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trajectory.chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" unit=" cm²" width={64} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} />
                <Line type="monotone" dataKey="actual" stroke={trajectory.deviation ? 'hsl(var(--destructive))' : 'hsl(var(--chart-1))'} strokeWidth={2.5} name="Area (cm²)" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── 6. Healing Trajectory Insights View ─────────────────────────────────────

function TrajectoryView({ patients, selectedPatient, onSelectPatient }: {
  patients: PilotPatient[];
  selectedPatient: PilotPatient | null;
  onSelectPatient: (p: PilotPatient) => void;
}) {
  const current = selectedPatient || patients[0] || null;

  if (!current) return <div className="text-center text-sm text-muted-foreground py-12">No patients available</div>;

  const trajectory = getTrajectoryData(current);
  const statusStyles: Record<string, { color: string; bg: string }> = {
    'Improving': { color: 'text-success', bg: 'bg-success/5 border-success/30' },
    'Stable': { color: 'text-success', bg: 'bg-success/5 border-success/20' },
    'Delayed Healing': { color: 'text-warning', bg: 'bg-warning/5 border-warning/30' },
    'Deteriorating': { color: 'text-destructive', bg: 'bg-destructive/5 border-destructive/30' },
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <PatientPicker patients={getRankedCaseload(patients)} selectedId={current.id} onSelect={onSelectPatient} />

      <div className="min-w-0 space-y-4">
        {/* Patient header with status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{current.name}</CardTitle>
                <CardDescription>{current.woundType} · {current.facility}</CardDescription>
              </div>
              <Badge variant="outline" className={cn('text-xs font-bold border-2', statusStyles[trajectory.status].bg, statusStyles[trajectory.status].color)}>
                {trajectory.status}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Expected vs Actual comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={cn('rounded-lg border p-3', statusStyles[trajectory.status].bg)}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Healing Status</p>
                <p className={cn('mt-1 text-lg font-bold', statusStyles[trajectory.status].color)}>{trajectory.status}</p>
              </div>
              <div className={cn('rounded-lg border p-3', trajectory.deviation ? 'border-destructive/30 bg-destructive/5' : 'border-success/20 bg-success/5')}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trajectory</p>
                <p className={cn('mt-1 text-lg font-bold', trajectory.deviation ? 'text-destructive' : 'text-success')}>
                  {trajectory.deviation ? 'Needs review' : 'Improving'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main trajectory chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Healing Trajectory Chart</CardTitle>
            <CardDescription>
              {`Measured wound area across ${trajectory.chartData.length} assessment${trajectory.chartData.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trajectory.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" unit="cm²" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="actual" stroke={trajectory.deviation ? 'hsl(var(--destructive))' : 'hsl(var(--chart-1))'} strokeWidth={2.5} name="Actual Path" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Clinical Interpretation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Clinical Interpretation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('rounded-lg p-4 border', trajectory.deviation ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5')}>
              <p className="text-sm text-foreground leading-relaxed">{trajectory.interpretation}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── 7. TVN Handover / Export View ───────────────────────────────────────────

function HandoverReportView({ patients }: { patients: PilotPatient[] }) {
  const ranked = getRankedCaseload(patients);
  const queue = getTVNQueue(patients);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportAll, setExportAll] = useState(true);

  const togglePatient = (id: string) => {
    setExportAll(false);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectedPatients = exportAll ? ranked : ranked.filter((p) => selected.has(p.id));
  const allSelected = selected.size === ranked.length && ranked.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      setExportAll(true);
    } else {
      setSelected(new Set(ranked.map((p) => p.id)));
      setExportAll(false);
    }
  };

  const handleDownloadCSV = () => {
    downloadFile(
      generateCaseloadCSV(selectedPatients),
      `woundcareiq-caseload-prioritization-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv',
    );
  };

  const handleDownloadText = () => {
    downloadFile(
      generateCaseloadPrioritizationReport(selectedPatients),
      `woundcareiq-caseload-prioritization-${new Date().toISOString().split('T')[0]}.txt`,
      'text/plain',
    );
  };

  const handleDownloadHandoverCSV = () => {
    downloadFile(
      generateHandoverCSV(queue),
      `woundcareiq-tvn-handover-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv',
    );
  };

  const handleDownloadHandoverText = () => {
    downloadFile(
      generateHandoverTextReport(queue),
      `woundcareiq-tvn-handover-${new Date().toISOString().split('T')[0]}.txt`,
      'text/plain',
    );
  };

  return (
    <div className="space-y-4">
      {/* One-Click Caseload Prioritization Report */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">TVN Caseload Prioritization Report</CardTitle>
                <CardDescription>
                  All {ranked.length} patients sorted highest risk to lowest — suitable for MDT meetings, TVN reviews, community handovers, and care home escalation meetings
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
              <Button size="sm" onClick={handleDownloadText}>
                <FileText className="mr-2 h-4 w-4" />
                Download PDF/Text
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2">
            <button onClick={toggleAll} className="text-xs font-medium text-primary hover:underline">
              {allSelected || exportAll ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-muted-foreground">
              {exportAll || selected.size === 0 ? `Will include all ${ranked.length} patients` : `${selected.size} selected`}
            </span>
          </div>
          <div className="divide-y divide-border/50 max-h-[480px] overflow-y-auto scrollbar-thin">
            {ranked.map((p, i) => (
              <div
                key={p.id}
                onClick={() => togglePatient(p.id)}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/30"
              >
                <span className={cn('text-xs font-bold tabular-nums w-8 shrink-0', RISK_STYLES[p.riskLevel].text)}>#{i + 1}</span>
                <div className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                  !exportAll && selected.has(p.id) ? 'border-primary bg-primary' : 'border-border',
                )}>
                  {!exportAll && selected.has(p.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.woundType} · {p.facility}</p>
                </div>
                <PriorityBadge priority={p.tvnPriority} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report columns preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Includes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {['Priority Rank', 'Patient Name', 'NHS Number', 'Facility', 'Wound Type', 'Risk Level', 'Risk Score', 'TVN Priority', 'Primary Driver', 'Secondary Drivers', 'Why Flagged', 'Recommended Action', 'Expected Review Time', 'Clinical Confidence'].map((field) => (
              <div key={field} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-xs text-foreground">{field}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* TVN Handover Report (separate) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">TVN Handover Report</CardTitle>
                <CardDescription>{queue.length} patients requiring specialist TVN review</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadHandoverCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Handover CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadHandoverText}>
                <FileText className="mr-2 h-4 w-4" />
                Handover PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

// ─── 8. Facility Risk View ───────────────────────────────────────────────────

function FacilityPriorityView({ patients }: { patients: PilotPatient[] }) {
  const facilities = getFacilitySummaries(patients);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Facility Risk View
          </CardTitle>
          <CardDescription>Active wounds, high-risk cases, critical patients, and delayed reviews per care home or team</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Facility</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Active Wounds</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-destructive">High-Risk</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-destructive">Critical</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-warning">Delayed Reviews</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-warning">Overdue</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-success">Healing Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Avg Risk</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((f) => (
                  <tr key={f.name} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium text-foreground">{f.name}</td>
                    <td className="px-4 py-3 text-center">{f.activeWounds}</td>
                    <td className="px-4 py-3 text-center text-destructive font-semibold">{f.highRiskWounds}</td>
                    <td className="px-4 py-3 text-center text-destructive font-bold">{f.criticalWounds}</td>
                    <td className="px-4 py-3 text-center text-warning font-semibold">{f.delayedReviews}</td>
                    <td className="px-4 py-3 text-center text-warning font-semibold">{f.overdueAssessments}</td>
                    <td className="px-4 py-3 text-center text-success font-semibold">{f.healingRate}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('font-bold tabular-nums',
                        f.avgRiskScore >= 60 ? 'text-destructive' : f.avgRiskScore >= 40 ? 'text-warning' : 'text-success')}>
                        {f.avgRiskScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facilities.map((f) => (
          <FacilityCard key={f.name} facility={f} />
        ))}
      </div>
    </div>
  );
}

function FacilityCard({ facility }: { facility: PilotFacilitySummary }) {
  const status: 'Stable' | 'Monitor' | 'Intervention Required' =
    facility.criticalWounds > 0 || facility.avgRiskScore >= 60 ? 'Intervention Required'
    : facility.highRiskWounds > 0 || facility.avgRiskScore >= 40 ? 'Monitor'
    : 'Stable';

  const statusStyle = status === 'Intervention Required'
    ? 'border-destructive/30 bg-destructive/5 text-destructive'
    : status === 'Monitor'
    ? 'border-warning/30 bg-warning/5 text-warning'
    : 'border-success/30 bg-success/5 text-success';

  return (
    <Card className={cn('border-2 p-4', statusStyle.split(' ').slice(0, 2).join(' '))}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground truncate">{facility.name}</p>
        <Badge variant="outline" className={cn('text-[11px] font-bold', statusStyle)}>{status}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Active</span>
          <span className="font-semibold text-foreground">{facility.activeWounds}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">High-Risk</span>
          <span className="font-semibold text-destructive">{facility.highRiskWounds}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Critical</span>
          <span className="font-bold text-destructive">{facility.criticalWounds}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Overdue</span>
          <span className="font-semibold text-warning">{facility.overdueAssessments}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
        <span className="text-xs text-muted-foreground">Healing Rate</span>
        <span className="text-sm font-bold text-success">{facility.healingRate}%</span>
      </div>
    </Card>
  );
}

// ─── 9. Care Home View ───────────────────────────────────────────────────────

function GroupedLists({
  intro,
  sections,
  onSelectPatient,
}: {
  intro: { icon: React.ReactNode; title: string; text: string };
  sections: { title: string; description?: string; icon: React.ReactNode; patients: PilotPatient[] }[];
  onSelectPatient: (p: PilotPatient) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
        <span className="mt-0.5 text-primary">{intro.icon}</span>
        <div>
          <p className="text-sm font-semibold text-foreground">{intro.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{intro.text}</p>
        </div>
      </div>

      {sections.map((section) => (
        <Section key={section.title} title={section.title} description={section.description} icon={section.icon} count={section.patients.length}>
          <ShowMore
            items={section.patients}
            limit={6}
            render={(p) => <PatientRow key={p.id} patient={p} onClick={() => onSelectPatient(p)} />}
          />
        </Section>
      ))}
    </div>
  );
}

function CareHomeView({ patients, onSelectPatient }: { patients: PilotPatient[]; onSelectPatient: (p: PilotPatient) => void }) {
  const data = getCareHomeView(patients);
  return (
    <GroupedLists
      onSelectPatient={onSelectPatient}
      intro={{ icon: <HomeIcon className="h-5 w-5" />, title: 'Care home view', text: 'Which residents need attention, grouped by what is needed' }}
      sections={[
        { title: 'Requiring escalation', description: 'High-risk or critical residents', icon: <ArrowUpCircle className="h-5 w-5 text-destructive" />, patients: data.requiringEscalation },
        { title: 'Requiring review', description: 'Missed or overdue reviews', icon: <Clock className="h-5 w-5 text-warning" />, patients: data.requiringReview },
        { title: 'Overdue assessment', description: 'No review in over 14 days', icon: <AlertTriangle className="h-5 w-5 text-destructive" />, patients: data.overdueAssessment },
        { title: 'Healing well', description: 'On track, continue current care', icon: <HeartPulse className="h-5 w-5 text-success" />, patients: data.healingWell },
      ]}
    />
  );
}

// ─── 10. Community Nurse View ────────────────────────────────────────────────

function CommunityNurseView({ patients, onSelectPatient }: { patients: PilotPatient[]; onSelectPatient: (p: PilotPatient) => void }) {
  const data = getCommunityNurseView(patients);
  return (
    <GroupedLists
      onSelectPatient={onSelectPatient}
      intro={{ icon: <Users className="h-5 w-5" />, title: 'Community nurse view', text: 'Your caseload, prioritised for community visits' }}
      sections={[
        { title: "Today's priorities", icon: <Zap className="h-5 w-5 text-destructive" />, patients: data.todayPriorities },
        { title: 'Potential escalations', icon: <ArrowUpCircle className="h-5 w-5 text-destructive" />, patients: data.potentialEscalations },
        { title: 'Potential infections', icon: <AlertTriangle className="h-5 w-5 text-destructive" />, patients: data.potentialInfections },
        { title: 'Delayed healing', icon: <Clock className="h-5 w-5 text-warning" />, patients: data.delayedHealing },
        { title: 'Requiring TVN support', icon: <Stethoscope className="h-5 w-5 text-primary" />, patients: data.requiringTVNSupport },
      ]}
    />
  );
}
