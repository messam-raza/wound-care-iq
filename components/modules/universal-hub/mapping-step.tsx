'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnMapping, ParsedUpload, TargetField } from '@/lib/import-types';
import { TARGET_FIELD_LABELS } from '@/lib/import-types';
import { ArrowRight, CheckCircle2, Table2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MappingStepProps {
  upload: ParsedUpload;
  onConfirm: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
}

const EMPTY_OPTION = '__none__';

export function MappingStep({ upload, onConfirm, onBack }: MappingStepProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(upload.suggestedMappings);

  const autoMapped = mappings.filter((m) => m.targetField !== '').length;
  const totalCols = mappings.length;

  const updateMapping = (csvColumn: string, targetField: TargetField | '') => {
    setMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, targetField } : m)),
    );
  };

  const previewRows = upload.rawRows.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Column Mapping Engine</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          AI has auto-detected <strong className="text-foreground">{autoMapped} of {totalCols} columns</strong>.
          Review the suggested mappings and adjust where needed.
        </p>
      </div>

      {/* File summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
        <Table2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{upload.fileName}</span>
        <Badge variant="outline">{upload.rawRows.length} rows</Badge>
        <Badge variant="outline">{totalCols} columns</Badge>
        <Badge className="bg-success/10 text-success border-success/30 ml-auto">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {autoMapped} auto-mapped
        </Badge>
      </div>

      {/* Mapping table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Column Assignments</CardTitle>
          <CardDescription>Map each CSV column to a WoundCareIQ data field</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    CSV Column
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                    Sample Values
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Maps To
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => {
                  const samples = previewRows
                    .map((r) => r[m.csvColumn])
                    .filter(Boolean)
                    .slice(0, 2);
                  const isMapped = !!m.targetField;
                  return (
                    <tr
                      key={m.csvColumn}
                      className={cn(
                        'border-b border-border/50',
                        isMapped ? 'bg-card' : 'bg-warning/3',
                      )}
                    >
                      <td className="px-4 py-3">
                        <code className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 font-mono text-xs text-foreground">
                          {m.csvColumn}
                        </code>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {samples.map((s, i) => (
                            <span key={i} className="max-w-[120px] truncate rounded bg-secondary/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {s}
                            </span>
                          ))}
                          {samples.length === 0 && (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={m.targetField || EMPTY_OPTION}
                          onValueChange={(v) => updateMapping(m.csvColumn, v === EMPTY_OPTION ? '' : v as TargetField)}
                        >
                          <SelectTrigger className="h-8 w-full min-w-[180px] text-xs">
                            <SelectValue placeholder="— Skip this column —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_OPTION}>
                              <span className="text-muted-foreground">— Skip this column —</span>
                            </SelectItem>
                            {(Object.entries(TARGET_FIELD_LABELS) as [TargetField, string][]).map(([field, label]) => (
                              <SelectItem key={field} value={field}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isMapped ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-success" />
                        ) : (
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-warning/50" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Data preview */}
      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Preview</CardTitle>
            <CardDescription>First 3 rows from your file</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {upload.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-mono text-[11px] text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {upload.headers.map((h) => (
                        <td key={h} className="max-w-[120px] truncate whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {row[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back to Upload
        </Button>
        <Button onClick={() => onConfirm(mappings)} className="gap-2">
          Run AI Intelligence Engine
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
