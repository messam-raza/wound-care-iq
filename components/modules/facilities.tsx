'use client';

import { Button } from '@/components/ui/button';
import { EmptyCaseload } from '@/components/empty-caseload';
import { useCaseload } from '@/lib/caseload-context';
import { useWorkspace } from '@/lib/workspace-context';
import { needsHumanReview } from '@/lib/worklist-utils';
import type { TabId } from '@/components/sidebar';

// One row per facility found in the uploaded file. Regions are assigned here by the TVN and kept on this
// device; a facility counts as unmatched until the file names it (not "Unknown Facility") and it has a region.
export function Facilities({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { hasData, patients } = useCaseload();
  const { facilities, regions, setRegion, setFacility, isReviewed } = useWorkspace();
  if (!hasData) return <EmptyCaseload title="Facilities & Mapping" />;

  const rows = facilities.map((f) => {
    const list = patients.filter((p) => p.facility === f);
    const pending = list.filter((p) => !isReviewed(p));
    return {
      name: f,
      total: list.length,
      today: pending.filter((p) => p.tvnPriority === 'SEE TODAY').length,
      week: pending.filter((p) => p.tvnPriority === 'SEE THIS WEEK').length,
      visited: list.length - pending.length,
      review: pending.filter(needsHumanReview).length,
      ai: list.filter((p) => p.aiReview?.status === 'accepted').length,
      unmatched: f === 'Unknown Facility' || !regions[f],
    };
  });
  const regionList = Array.from(new Set(Object.values(regions))).sort();
  const unmatched = rows.filter((r) => r.unmatched).length;

  const open = (name: string) => {
    setFacility(name);
    onNavigate('priority');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Facilities & Mapping</h1>
        <p className="text-muted-foreground">{rows.length} facilities · {regionList.length} regions · {unmatched} unmatched. Assign each facility to a region, then open its priority list.</p>
      </div>
      <datalist id="regions">{regionList.map((r) => <option key={r} value={r} />)}</datalist>
      <section className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground">
              <tr>{['Facility', 'Region', 'Patients', 'See Today', 'See This Week', 'Visited', 'Needs review', 'AI reviewed', 'Mapping', ''].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <input
                      list="regions"
                      defaultValue={regions[r.name] ?? ''}
                      onBlur={(e) => setRegion(r.name, e.target.value)}
                      placeholder="Add region"
                      aria-label={`Region for ${r.name}`}
                      className="h-9 w-44 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.total}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-destructive">{r.today}</td>
                  <td className="px-4 py-3 tabular-nums text-warning">{r.week}</td>
                  <td className="px-4 py-3 tabular-nums">{r.visited}</td>
                  <td className="px-4 py-3 tabular-nums">{r.review}</td>
                  <td className="px-4 py-3 tabular-nums">{r.ai}/{r.total}</td>
                  <td className="px-4 py-3">
                    <span className={r.unmatched ? 'rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-xs font-semibold text-warning' : 'rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success'}>
                      {r.unmatched ? 'Unmatched' : 'Mapped'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => open(r.name)}>Open list</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
