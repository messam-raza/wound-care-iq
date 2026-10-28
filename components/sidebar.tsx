'use client';

import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Calculator, FileText, TrendingUp, DatabaseZap, Rocket, Brain, Timer, Building2,
  GraduationCap, BarChart3, PoundSterling, Trophy, Heart, HeartPulse,
} from 'lucide-react';
import { SHOW_BUSINESS_VIEWS } from '@/lib/feature-flags';

// The six TVN tabs, then settings (opened from the user menu). The business ids are hidden unless
// SHOW_BUSINESS_VIEWS is on (see lib/feature-flags.ts).
export type TabId =
  | 'dashboard' | 'upload' | 'aireviews' | 'priority' | 'facilities' | 'reports' | 'settings'
  | 'execdashboard' | 'hub' | 'execcommand' | 'costintel' | 'calculator' | 'report' | 'impact'
  | 'benchmarking' | 'workforce' | 'patientcare';

interface NavItem { id: TabId; label: string; icon: React.ReactNode }
interface SidebarProps { activeTab: TabId; onTabChange: (tab: TabId) => void }

export const CORE_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'upload', label: 'Upload & Map', icon: <Rocket className="h-4 w-4" /> },
  { id: 'aireviews', label: 'AI Reviews', icon: <Brain className="h-4 w-4" /> },
  { id: 'priority', label: 'Prioritisation', icon: <Timer className="h-4 w-4" /> },
  { id: 'facilities', label: 'Facilities & Mapping', icon: <Building2 className="h-4 w-4" /> },
  { id: 'reports', label: 'Reports & Export', icon: <FileText className="h-4 w-4" /> },
];

export const BUSINESS_NAV: NavItem[] = [
  { id: 'hub', label: 'Data Intelligence Hub', icon: <DatabaseZap className="h-4 w-4" /> },
  { id: 'benchmarking', label: 'Benchmarking', icon: <Trophy className="h-4 w-4" /> },
  { id: 'workforce', label: 'Workforce Readiness', icon: <GraduationCap className="h-4 w-4" /> },
  { id: 'patientcare', label: 'Patient-Centred Care', icon: <Heart className="h-4 w-4" /> },
  { id: 'execdashboard', label: 'Executive Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'execcommand', label: 'Exec Command Center', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'costintel', label: 'NHS Cost Intelligence', icon: <PoundSterling className="h-4 w-4" /> },
  { id: 'calculator', label: 'Cost Savings Calculator', icon: <Calculator className="h-4 w-4" /> },
  { id: 'report', label: 'Executive Report', icon: <FileText className="h-4 w-4" /> },
  { id: 'impact', label: 'Impact & ROI', icon: <TrendingUp className="h-4 w-4" /> },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const renderItem = (item: NavItem) => (
    <button key={item.id} onClick={() => onTabChange(item.id)}
      className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        activeTab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
      {item.icon}
      <span className="flex-1 text-left">{item.label}</span>
    </button>
  );

  const sectionLabel = (label: string) => (
    <p className="px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
  );

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <HeartPulse className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-foreground">WoundCareIQ</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Deterioration Detection
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {sectionLabel('Deterioration Detection')}
        {CORE_NAV.map(renderItem)}
        {SHOW_BUSINESS_VIEWS && (
          <>
            {sectionLabel('Business')}
            {BUSINESS_NAV.map(renderItem)}
          </>
        )}
      </nav>
    </aside>
  );
}
