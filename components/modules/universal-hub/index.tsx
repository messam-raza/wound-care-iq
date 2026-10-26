'use client';

import { useState } from 'react';
import { UploadStep } from './upload-step';
import { MappingStep } from './mapping-step';
import { QualityPanel } from './quality-panel';
import { RiskIntelligencePanel } from './risk-intelligence-panel';
import { FacilityPanel } from './facility-panel';
import { WorkforceSavingsPanel } from './workforce-savings-panel';
import { CommandCenterPanel } from './command-center-panel';
import type { ParsedUpload, ColumnMapping } from '@/lib/import-types';
import { runPilotImport } from '@/lib/pilot-engine';
import { useCaseload } from '@/lib/caseload-context';
import { buildQualityReport, buildFacilityStats, buildWorkforceStats, isHighRisk } from '@/lib/selectors-d';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  CheckCircle2,
  BarChart3,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Database,
  Brain,
  Building2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Substep = 'command' | 'quality' | 'risk' | 'facility' | 'workforce';

const SUBSTEPS: { id: Substep; label: string; icon: React.ReactNode }[] = [
  { id: 'command', label: 'Command Center', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'quality', label: 'Data Quality', icon: <Database className="h-4 w-4" /> },
  { id: 'risk', label: 'AI Risk Engine', icon: <Brain className="h-4 w-4" /> },
  { id: 'facility', label: 'Facility Intel', icon: <Building2 className="h-4 w-4" /> },
  { id: 'workforce', label: 'Workforce', icon: <Users className="h-4 w-4" /> },
];

export function UniversalHub() {
  const { patients, summary, hasData, setCaseload } = useCaseload();
  const [step, setStep] = useState<'upload' | 'mapping' | 'results'>(hasData ? 'results' : 'upload');
  const [parsedUpload, setParsedUpload] = useState<ParsedUpload | null>(null);
  const [activeSubstep, setActiveSubstep] = useState<Substep>('command');

  const handleParsed = (upload: ParsedUpload) => {
    setParsedUpload(upload);
    setStep('mapping');
  };

  const handleMappingConfirm = (mappings: ColumnMapping[]) => {
    if (!parsedUpload) return;
    const result = runPilotImport(parsedUpload.fileName, parsedUpload.headers, parsedUpload.rawRows, mappings);
    setCaseload(result.patients, result.summary);
    setStep('results');
    setActiveSubstep('command');
  };

  const reset = () => {
    setStep('upload');
    setParsedUpload(null);
  };

  const qualityReport = hasData ? buildQualityReport(patients) : null;
  const facilities = hasData ? buildFacilityStats(patients) : [];
  const workforce = hasData ? buildWorkforceStats(patients) : [];
  const fileName = parsedUpload?.fileName ?? summary?.fileName;

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Universal Data Intelligence Hub</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn Existing Wound Data into Actionable Intelligence
          </p>
        </div>

        {step !== 'upload' && (
          <div className="flex items-center gap-2 shrink-0">
            {fileName && (
              <Badge variant="outline" className="border-success/30 bg-success/5 text-success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {fileName}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={reset}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              New Upload
            </Button>
          </div>
        )}
      </div>

      {/* Step Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button
          onClick={() => step !== 'upload' && reset()}
          className={cn('flex items-center gap-1', step === 'upload' ? 'text-foreground font-semibold' : 'hover:text-foreground cursor-pointer')}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className={cn('flex items-center gap-1', step === 'mapping' ? 'text-foreground font-semibold' : step === 'upload' ? 'opacity-40' : 'hover:text-foreground cursor-pointer')}
          onClick={() => step === 'results' && setStep('mapping')}>
          Column Mapping
        </span>
        <ChevronRight className="h-3 w-3" />
        <span className={cn('flex items-center gap-1', step === 'results' ? 'text-foreground font-semibold' : 'opacity-40')}>
          AI Intelligence Report
        </span>
      </div>

      {/* Step Content */}
      <div className="animate-fade-in-up">
        {step === 'upload' && <UploadStep onParsed={handleParsed} />}

        {step === 'mapping' && parsedUpload && (
          <MappingStep
            upload={parsedUpload}
            onConfirm={handleMappingConfirm}
            onBack={reset}
          />
        )}

        {step === 'results' && hasData && qualityReport && (
          <div className="space-y-6">
            {/* Results summary banner */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Intelligence report generated for {patients.length} wounds
                </p>
                <p className="text-xs text-muted-foreground">
                  Records complete: {qualityReport.completenessPct}% · {patients.filter(isHighRisk).length} high-risk wounds identified
                </p>
              </div>
            </div>

            {/* Sub-navigation */}
            <div className="flex flex-wrap gap-1.5">
              {SUBSTEPS.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubstep(sub.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    activeSubstep === sub.id
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                >
                  {sub.icon}
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Active substep */}
            <div className="animate-fade-in-up" key={activeSubstep}>
              {activeSubstep === 'command' && (
                <CommandCenterPanel patients={patients} facilities={facilities} />
              )}
              {activeSubstep === 'quality' && qualityReport && (
                <QualityPanel report={qualityReport} />
              )}
              {activeSubstep === 'risk' && (
                <RiskIntelligencePanel patients={patients} />
              )}
              {activeSubstep === 'facility' && (
                <FacilityPanel facilities={facilities} />
              )}
              {activeSubstep === 'workforce' && (
                <WorkforceSavingsPanel workforce={workforce} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
