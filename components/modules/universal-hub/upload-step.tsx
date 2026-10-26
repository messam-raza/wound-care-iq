'use client';

import { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { parseCSV, suggestMappings } from '@/lib/import-engine';
import type { ParsedUpload } from '@/lib/import-types';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadStepProps {
  onParsed: (upload: ParsedUpload) => void;
}

const EMR_EXAMPLES = [
  'SystmOne', 'EMIS', 'Rio', 'Epic', 'PointClickCare',
  'MatrixCare', 'Healthy.io', 'Nursing Home Systems', 'Home Health Systems', 'Excel',
];

export function UploadStep({ onParsed }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['csv', 'txt'].includes(ext || '')) {
          setError('Please upload a CSV or plain-text file. XLSX support coming soon.');
          setLoading(false);
          return;
        }
        const text = await file.text();
        const { headers, rows } = parseCSV(text);
        if (rows.length === 0) {
          setError('No data rows found. Please check the file has a header row and at least one data row.');
          setLoading(false);
          return;
        }
        const suggestedMappings = suggestMappings(headers);
        onParsed({ fileName: file.name, rawRows: rows, headers, suggestedMappings });
      } catch {
        setError('Failed to read the file. Please ensure it is a valid CSV.');
      }
      setLoading(false);
    },
    [onParsed],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary">
            <FileSpreadsheet className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Universal Data Intelligence Hub</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn Existing Wound Data into Actionable Intelligence
            </p>
            <p className="mt-2 text-sm text-foreground/80 max-w-2xl">
              Upload a CSV export from any EMR, EPR, wound care platform, nursing home system, or Excel spreadsheet.
              WoundCareIQ will automatically map your columns, calculate AI risk scores, and generate a full clinical intelligence report.
            </p>
          </div>
        </div>
      </div>

      {/* Supported Systems */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Compatible with exports from
        </p>
        <div className="flex flex-wrap gap-2">
          {EMR_EXAMPLES.map((emr) => (
            <Badge key={emr} variant="outline" className="border-primary/20 bg-primary/5 text-primary font-medium">
              {emr}
            </Badge>
          ))}
          <Badge variant="outline" className="border-border bg-secondary/30 text-muted-foreground">
            + any CSV export
          </Badge>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-all',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border bg-secondary/20 hover:border-primary/40 hover:bg-primary/3',
        )}
      >
        <input
          type="file"
          accept=".csv,.txt"
          onChange={onInputChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <div className={cn(
          'flex h-16 w-16 items-center justify-center rounded-xl transition-colors',
          isDragging ? 'bg-primary/20' : 'bg-secondary',
        )}>
          <Upload className={cn('h-8 w-8 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {loading ? 'Processing file...' : isDragging ? 'Drop your file here' : 'Drop your CSV file here'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">or click anywhere in this box to browse</p>
        </div>
        <div className="flex items-center gap-3">
          {['CSV', 'XLSX', 'Excel'].map((fmt) => (
            <span key={fmt} className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">
              {fmt}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Example fields */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Example CSV fields we can recognize automatically
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Patient_ID', 'Patient_Name', 'Home_Name', 'Wound_Type', 'Wound_Location',
              'Wound_Area', 'Length', 'Width', 'Depth', 'Assessment_Date', 'Last_Review_Date',
              'Clinician', 'Diabetes', 'PAD', 'Pressure_Stage', 'Infection_Signs', 'Missed_Reviews',
            ].map((field) => (
              <span key={field} className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {field}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
