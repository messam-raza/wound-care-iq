'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, Brain, Building2, Calendar, CheckCircle2, CloudUpload, History, ListChecks, Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FacilitySelect } from '@/components/facility-select';
import { AIStatusChip, StatusChip } from '@/components/status-chip';
import { PriorityBadge, PRIORITY } from '@/components/pilot-ui';
import { useCaseload } from '@/lib/caseload-context';
import { timeAgo, useActivity, type ActivityKind } from '@/lib/activity-context';
import { useWorkspace } from '@/lib/workspace-context';
import { getRankedCaseload } from '@/lib/pilot-engine';
import { aiStatus, needsHumanReview, patientStatus } from '@/lib/worklist-utils';
import type { PilotPatient, TVNPriority } from '@/lib/pilot-types';
import type { TabId } from '@/components/sidebar';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onNavigate: (tab: TabId) => void;
  onSelectPatient: (p: PilotPatient) => void;
}

const BANDS: { priority: TVNPriority; label: string; color: string }[] = [
  { priority: 'SEE TODAY', label: 'See Today', color: 'hsl(var(--destructive))' },
  { priority: 'SEE THIS WEEK', label: 'See This Week', color: 'hsl(var(--warning))' },
  { priority: 'MONITOR', label: 'Monitor', color: 'hsl(var(--primary))' },
  { priority: 'HEALING', label: 'Healing', color: 'hsl(var(--success))' },
];

const ACTIVITY_ICON: Record<ActivityKind, { icon: React.ReactNode; tone: string }> = {
  upload: { icon: <CheckCircle2 className="h-5 w-5" />, tone: 'bg-success/10 text-success' },
  mapping: { icon: <Building2 className="h-5 w-5" />, tone: 'bg-primary/10 text-primary' },
  ai: { icon: <Brain className="h-5 w-5" />, tone: 'bg-primary/10 text-primary' },
  priority: { icon: <ListChecks className="h-5 w-5" />, tone: 'bg-warning/10 text-warning' },
};

function StatCard({ label, value, sub, icon, tone }: { label: string; value: React.ReactNode; sub: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className={cn('flex items-center gap-4 rounded-xl border p-5', tone)}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card/80">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-foreground/80">{label}</p>
        <p className="text-3xl font-bold leading-tight text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

export function Dashboard({ onNavigate, onSelectPatient }: DashboardProps) {
  const { hasData, summary } = useCaseload();
  const { scoped, facilities, regions, isReviewed } = useWorkspace();
  const { activity } = useActivity();
  const [allActivity, setAllActivity] = useState(false);

  const ranked = getRankedCaseload(scoped);
  const reviewed = scoped.filter((p) => p.aiReview);
  const accepted = reviewed.filter((p) => p.aiReview?.status === 'accepted').length;
  const needsReview = scoped.filter(needsHumanReview).length;
  const named = facilities.filter((f) => f !== 'Unknown Facility');
  const regionCount = new Set(named.map((f) => regions[f]).filter(Boolean)).size;
  const counts = BANDS.map((b) => ({ ...b, value: scoped.filter((p) => p.tvnPriority === b.priority).length }));
  const lastUpdated = activity[0]?.at ?? Date.now();
  const shown = allActivity ? activity : activity.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your patient prioritisation workflow</p>
        </div>
        <div className="flex items-end gap-4">
          {hasData && <FacilitySelect className="w-56" />}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div className="leading-tight">
              <p className="text-xs text-muted-foreground">Last updated</p>
              <p className="font-medium">{format(lastUpdated, 'MMM d, yyyy • HH:mm')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CloudUpload className="h-7 w-7" /></div>
        <div className="flex-1">
          <p className="font-semibold">{hasData ? 'Data loaded' : 'Ready to process your data?'}</p>
          <p className="text-sm text-muted-foreground">
            {hasData && summary
              ? `${summary.fileName} · ${summary.totalRecords} records. Upload a newer file at any time to refresh the worklists.`
              : 'Upload your CSV file to get started with AI-powered reviews and patient prioritisation.'}
          </p>
        </div>
        <Button size="lg" onClick={() => onNavigate('upload')}>
          <Upload className="mr-2 h-4 w-4" />
          {hasData ? 'Upload new CSV' : 'Upload CSV'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Patients" value={scoped.length.toLocaleString()} sub="From uploaded data" icon={<Users className="h-6 w-6 text-primary" />} tone="border-primary/20 bg-primary/5" />
        <StatCard label="Facilities Mapped" value={named.length} sub={regionCount > 0 ? `Across ${regionCount} region${regionCount === 1 ? '' : 's'}` : 'No regions assigned yet'} icon={<Building2 className="h-6 w-6 text-success" />} tone="border-success/20 bg-success/5" />
        <StatCard label="AI Reviews Generated" value={accepted.toLocaleString()} sub={reviewed.length > 0 ? `${Math.round((accepted / reviewed.length) * 100)}% success rate` : 'Not run yet'} icon={<Brain className="h-6 w-6 text-primary" />} tone="border-primary/20 bg-primary/5" />
        <StatCard label="Needs Human Review" value={needsReview} sub="Incomplete data / AI-raised" icon={<AlertTriangle className="h-6 w-6 text-warning" />} tone="border-warning/30 bg-warning/5" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Patient Priority Distribution</h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={scoped.length ? counts : [{ label: 'None', value: 1, color: 'hsl(var(--secondary))' }]} dataKey="value" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={1} stroke="none">
                    {(scoped.length ? counts : [{ color: 'hsl(var(--secondary))' }]).map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  {scoped.length > 0 && <Tooltip />}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold">{scoped.length.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Patients</p>
              </div>
            </div>
            <ul className="w-full space-y-2.5 text-sm">
              {counts.map((c) => (
                <li key={c.priority} className="flex items-center gap-3">
                  <span className={cn('h-3 w-3 rounded-full', PRIORITY[c.priority].dot)} />
                  <span className="flex-1">{c.label}</span>
                  <span className="font-semibold tabular-nums">{c.value}</span>
                  <span className="w-12 text-right text-muted-foreground tabular-nums">({scoped.length ? Math.round((c.value / scoped.length) * 100) : 0}%)</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><History className="h-5 w-5" />Recent Activity</h2>
            {activity.length > 4 && <button className="text-sm text-primary hover:underline" onClick={() => setAllActivity((v) => !v)}>{allActivity ? 'Show less' : 'View all'}</button>}
          </div>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing yet. Upload a CSV to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', ACTIVITY_ICON[a.kind].tone)}>{ACTIVITY_ICON[a.kind].icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5" />Top Priority Patients</h2>
          <button className="text-sm text-primary hover:underline" onClick={() => onNavigate('priority')}>View all patients →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground">
              <tr>
                {['#', 'Patient ID', 'Name', 'Facility', 'Priority', 'AI Review Summary', 'Status', 'Actions'].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.filter((p) => !isReviewed(p)).slice(0, 5).map((p, i) => (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-3">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.id}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{p.facility}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={p.tvnPriority} /></td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground"><span className="line-clamp-3">{p.flaggedReason}</span>{aiStatus(p) !== 'Accepted' && <span className="mt-1 block"><AIStatusChip status={aiStatus(p)} /></span>}</td>
                  <td className="px-4 py-3"><StatusChip status={patientStatus(p, false)} /></td>
                  <td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => onSelectPatient(p)}>View</Button></td>
                </tr>
              ))}
              {ranked.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No patients yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
