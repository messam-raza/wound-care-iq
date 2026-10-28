'use client';

import { useCaseload } from '@/lib/caseload-context';
import { useWorkspace } from '@/lib/workspace-context';

// The facility filter. One TVN covers one or more facilities and picks which list to work through; the
// choice applies to every tab and is remembered on this device.
export function FacilitySelect({ className = '' }: { className?: string }) {
  const { patients } = useCaseload();
  const { facility, setFacility, facilities } = useWorkspace();
  const count = (name: string) => patients.filter((p) => p.facility === name).length;
  return (
    <div className={className}>
      <label htmlFor="facility" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facility</label>
      <select
        id="facility"
        value={facility}
        onChange={(e) => setFacility(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All facilities ({patients.length})</option>
        {facilities.map((f) => (
          <option key={f} value={f}>{f} ({count(f)})</option>
        ))}
      </select>
    </div>
  );
}
