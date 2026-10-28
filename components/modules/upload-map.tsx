'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Brain, Building2, CheckCircle2, Download, FileSpreadsheet, FileText, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useActivity } from '@/lib/activity-context';
import { useCaseload } from '@/lib/caseload-context';
import { suggestMappings } from '@/lib/import-engine';
import { TARGET_FIELD_LABELS, type ColumnMapping, type TargetField } from '@/lib/import-types';
import { downloadFile, generateTemplateCSV, parseUploadedFile, runPilotImport } from '@/lib/pilot-engine';
import type { PilotUploadSummary } from '@/lib/pilot-types';
import type { TabId } from '@/components/sidebar';

// Fields the priority rules cannot work without. A file missing one of these still loads, but is flagged.
const REQUIRED: { label: string; ok: (t: Set<string>) => boolean }[] = [
  { label: 'Patient ID', ok: (t) => t.has('patientId') },
  { label: 'Facility', ok: (t) => t.has('facility') },
  { label: 'Assessment date', ok: (t) => t.has('assessmentDate') },
  { label: 'Wound size, or length and width', ok: (t) => t.has('woundSize') || (t.has('length') && t.has('width')) },
];

export function UploadMap({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { summary, upload, setCaseload } = useCaseload();
  const { log } = useActivity();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback((fileName: string, headers: string[], rows: Record<string, string>[], mappings: ColumnMapping[], remap: boolean) => {
    const result = runPilotImport(fileName, headers, rows, mappings);
    setCaseload(result.patients, result.summary, { headers, rows, mappings });
    const facilities = result.summary.facilitiesImported;
    if (!remap) log('upload', 'CSV uploaded and processed', `${fileName} (${result.summary.totalRecords.toLocaleString()} records)`);
    log('mapping', remap ? 'Mapping updated' : 'Mapping completed', `${facilities} facilit${facilities === 1 ? 'y' : 'ies'} · ${mappings.filter((m) => m.targetField).length} of ${headers.length} columns mapped`);
    log('priority', 'Prioritisation completed', `${result.patients.length.toLocaleString()} patients ranked and categorised`);
  }, [setCaseload, log]);

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setIsProcessing(true);
    try {
      const text = await file.text();
      const { headers, rows } = parseUploadedFile(file.name, text);
      if (rows.length === 0) {
        setUploadError('No data rows found. If you uploaded an Excel (.xlsx) file, please save it as CSV first — Excel files need to be exported as CSV to process in the browser.');
        setIsProcessing(false);
        return;
      }
      load(file.name, headers, rows, suggestMappings(headers), false);
    } catch {
      setUploadError('Failed to parse file. Please ensure it is a valid CSV export from SystmOne, EMIS, or your wound care system.');
    }
    setIsProcessing(false);
  }, [load]);

  const form: UploadFormProps = {
    onFileUpload: handleFileUpload,
    onDownloadSample: () => downloadFile(generateTemplateCSV(), 'woundcareiq-csv-template.csv', 'text/csv'),
    error: uploadError,
    isProcessing,
    fileInputRef,
    onFileInput: (e) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    },
    onDrop: (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload & Map</h1>
        <p className="text-muted-foreground">Load a wound assessment export, then check that each column is mapped to the right field</p>
      </div>
      {summary ? <ReuploadView summary={summary} {...form} /> : <UploadForm {...form} />}
      {upload && summary && (
        <MappingCard
          key={summary.fileName + upload.headers.join('|')}
          headers={upload.headers}
          sample={upload.rows[0] ?? {}}
          initial={upload.mappings}
          onApply={(m) => load(summary.fileName, upload.headers, upload.rows, m, true)}
          onDone={() => onNavigate('priority')}
        />
      )}
    </div>
  );
}

function MappingCard({ headers, sample, initial, onApply, onDone }: {
  headers: string[];
  sample: Record<string, string>;
  initial: ColumnMapping[];
  onApply: (m: ColumnMapping[]) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<ColumnMapping[]>(initial);
  useEffect(() => setDraft(initial), [initial]);
  const targets = new Set(draft.map((d) => d.targetField).filter(Boolean));
  const missing = REQUIRED.filter((r) => !r.ok(targets));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Column mapping</CardTitle>
        <CardDescription>Columns were matched to fields automatically from their names. Change any that are wrong, then apply.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>Not mapped: <b>{missing.map((m) => m.label).join(', ')}</b>. Priorities may be incomplete until these are mapped.</p>
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground">
              <tr><th className="px-4 py-2.5 font-semibold">CSV column</th><th className="px-4 py-2.5 font-semibold">Example</th><th className="px-4 py-2.5 font-semibold">Maps to</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {headers.map((h, i) => (
                <tr key={h}>
                  <td className="px-4 py-2 font-medium">{h}</td>
                  <td className="max-w-[14rem] truncate px-4 py-2 text-muted-foreground">{sample[h] || '—'}</td>
                  <td className="px-4 py-2">
                    <select
                      value={draft[i]?.targetField ?? ''}
                      aria-label={`Field for column ${h}`}
                      onChange={(e) => setDraft((d) => d.map((m, j) => (j === i ? { ...m, targetField: e.target.value as TargetField | '' } : m)))}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Not used</option>
                      {(Object.keys(TARGET_FIELD_LABELS) as TargetField[]).map((f) => <option key={f} value={f}>{TARGET_FIELD_LABELS[f]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onApply(draft)} disabled={!dirty}>Apply mapping</Button>
          <Button variant="outline" onClick={onDone}>Go to Prioritisation</Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface UploadFormProps {
  onFileUpload: (file: File) => void;
  onDownloadSample: () => void;
  error: string | null;
  isProcessing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
}

function UploadForm({ onFileUpload, onDownloadSample, error, isProcessing, fileInputRef, onFileInput, onDrop }: UploadFormProps) {
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

function ReuploadView(props: UploadFormProps & { summary: PilotUploadSummary }) {
  return (
    <div className="space-y-6">
      <UploadSummaryCard summary={props.summary} />
      <UploadForm {...props} />
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
