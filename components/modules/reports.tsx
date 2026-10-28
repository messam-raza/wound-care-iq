'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyCaseload } from '@/components/empty-caseload';
import { FacilitySelect } from '@/components/facility-select';
import { useCaseload } from '@/lib/caseload-context';
import { useWorkspace } from '@/lib/workspace-context';
import { downloadFile, generateCaseloadCSV, generateCaseloadPrioritizationReport, generateHandoverCSV, generateHandoverTextReport, getRankedCaseload } from '@/lib/pilot-engine';

export function Reports() {
  const { hasData } = useCaseload();
  const { scoped, facility } = useWorkspace();
  if (!hasData) return <EmptyCaseload title="Reports & Export" />;

  const ranked = getRankedCaseload(scoped);
  const stem = `woundcareiq-${(facility || 'all-facilities').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const items = [
    { title: 'Handover sheet (CSV)', desc: 'Patients in priority order with the action and rationale, for the next shift.', icon: <FileSpreadsheet className="h-6 w-6 text-success" />, run: () => downloadFile(generateHandoverCSV(ranked), `${stem}-handover.csv`, 'text/csv') },
    { title: 'Handover report (text)', desc: 'A readable handover summary you can paste into an email or note.', icon: <FileText className="h-6 w-6 text-primary" />, run: () => downloadFile(generateHandoverTextReport(ranked), `${stem}-handover.txt`, 'text/plain') },
    { title: 'Prioritisation report (text)', desc: 'The ranked caseload with each patient’s priority and reason.', icon: <FileText className="h-6 w-6 text-warning" />, run: () => downloadFile(generateCaseloadPrioritizationReport(ranked), `${stem}-prioritisation.txt`, 'text/plain') },
    { title: 'Full caseload (CSV)', desc: 'Every patient with scores, trend and review fields.', icon: <FileSpreadsheet className="h-6 w-6 text-primary" />, run: () => downloadFile(generateCaseloadCSV(ranked), `${stem}-caseload.csv`, 'text/csv') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Export</h1>
          <p className="text-muted-foreground">{ranked.length} patients in scope{facility ? ` · ${facility}` : ' · all facilities'}. Files contain patient details; handle them under your information governance rules.</p>
        </div>
        <FacilitySelect className="w-56" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.title}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">{i.icon}</div>
              <div className="flex-1">
                <p className="font-semibold">{i.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{i.desc}</p>
                <Button className="mt-3" variant="outline" size="sm" onClick={i.run} disabled={ranked.length === 0}><Download className="mr-2 h-4 w-4" />Download</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
