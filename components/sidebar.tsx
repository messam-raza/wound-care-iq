'use client';

import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Brain, Activity, Calculator, FileText, TrendingUp,
  HeartPulse, DatabaseZap, Timer, Stethoscope, ArrowUpCircle,
  GraduationCap, Home, BarChart3, PoundSterling, Trophy, Heart,
  Building2, Users, ClipboardList, Rocket, Settings,
} from 'lucide-react';

export type TabId =
  | 'dashboard' | 'command' | 'monitoring' | 'calculator' | 'report' | 'impact'
  | 'hub' | 'daily' | 'tvn' | 'escalation' | 'workforce' | 'carehome'
  | 'execcommand' | 'costintel' | 'benchmarking' | 'patientcare'
  | 'priority' | 'trajectory' | 'nurse' | 'facilityintel'
  | 'pilot' | 'settings';

interface NavItem { id: TabId; label: string; icon: React.ReactNode; badge?: string }
interface SidebarProps { activeTab: TabId; onTabChange: (tab: TabId) => void }

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const coreItems: NavItem[] = [
    { id: 'priority', label: 'Daily Priority List', icon: <Timer className="h-4 w-4" />, badge: 'CORE' },
    { id: 'daily', label: 'Daily Command Center', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'command', label: 'AI Command Center', icon: <Brain className="h-4 w-4" /> },
    { id: 'tvn', label: 'TVN Command Center', icon: <Stethoscope className="h-4 w-4" /> },
    { id: 'escalation', label: 'Escalation Engine', icon: <ArrowUpCircle className="h-4 w-4" /> },
    { id: 'trajectory', label: 'Healing Trajectory', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'monitoring', label: 'Wound Monitoring', icon: <Activity className="h-4 w-4" /> },
  ];

  const pilotItems: NavItem[] = [
    { id: 'pilot', label: 'Pilot Workflow', icon: <Rocket className="h-4 w-4" />, badge: 'PILOT' },
  ];

  const clinicalItems: NavItem[] = [
    { id: 'nurse', label: 'Community Nurse Dashboard', icon: <Users className="h-4 w-4" /> },
    { id: 'carehome', label: 'Care Home Risk', icon: <Home className="h-4 w-4" /> },
    { id: 'facilityintel', label: 'Facility Intelligence', icon: <Building2 className="h-4 w-4" /> },
  ];

  const intelligenceItems: NavItem[] = [
    { id: 'hub', label: 'Data Intelligence Hub', icon: <DatabaseZap className="h-4 w-4" />, badge: 'NEW' },
    { id: 'benchmarking', label: 'Benchmarking', icon: <Trophy className="h-4 w-4" /> },
  ];

  const operationalItems: NavItem[] = [
    { id: 'workforce', label: 'Workforce Readiness', icon: <GraduationCap className="h-4 w-4" /> },
    { id: 'patientcare', label: 'Patient-Centred Care', icon: <Heart className="h-4 w-4" /> },
  ];

  const executiveItems: NavItem[] = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'execcommand', label: 'Exec Command Center', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'costintel', label: 'NHS Cost Intelligence', icon: <PoundSterling className="h-4 w-4" /> },
    { id: 'calculator', label: 'Cost Savings Calculator', icon: <Calculator className="h-4 w-4" /> },
    { id: 'report', label: 'Executive Report', icon: <FileText className="h-4 w-4" /> },
    { id: 'impact', label: 'Impact & ROI', icon: <TrendingUp className="h-4 w-4" /> },
  ];

  const renderItem = (item: NavItem) => (
    <button key={item.id} onClick={() => onTabChange(item.id)}
      className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        activeTab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
      {item.icon}
      <span className="flex-1 text-left">{item.label}</span>
      {item.badge && (
        <span className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
          activeTab === item.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-accent/20 text-accent')}>
          {item.badge}
        </span>
      )}
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
        {coreItems.map(renderItem)}
        {sectionLabel('Pilot Workflow')}
        {pilotItems.map(renderItem)}
        {sectionLabel('Clinical Tools')}
        {clinicalItems.map(renderItem)}
        {sectionLabel('Intelligence')}
        {intelligenceItems.map(renderItem)}
        {sectionLabel('Operations')}
        {operationalItems.map(renderItem)}
        {sectionLabel('Executive')}
        {executiveItems.map(renderItem)}
        {sectionLabel('Account')}
        {renderItem({ id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> })}
      </nav>
    </aside>
  );
}
