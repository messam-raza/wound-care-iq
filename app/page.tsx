'use client';

import { useEffect, useState } from 'react';
import { Sidebar, type TabId } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { ExecutiveDashboard } from '@/components/modules/executive-dashboard';
import { AICommandCenter } from '@/components/modules/ai-command-center';
import { PatientDetail } from '@/components/modules/patient-detail';
import { DigitalWoundMonitoring } from '@/components/modules/digital-wound-monitoring';
import { CostSavingsCalculator } from '@/components/modules/cost-savings-calculator';
import { ExecutiveReport } from '@/components/modules/executive-report';
import { ImpactROI } from '@/components/modules/impact-roi';
import { UniversalHub } from '@/components/modules/universal-hub';
import { DailyCommandCenter } from '@/components/modules/daily-command-center';
import { TVNCommandCenter } from '@/components/modules/tvn-command-center';
import { EscalationEngine } from '@/components/modules/escalation-engine';
import { WorkforceReadinessPlatform } from '@/components/modules/workforce-readiness';
import { CareHomeDashboard } from '@/components/modules/care-home-dashboard';
import { ExecutiveCommandCenter } from '@/components/modules/executive-command-center';
import { NHSCostIntelligence } from '@/components/modules/nhs-cost-intelligence';
import { Benchmarking } from '@/components/modules/benchmarking';
import { PatientCentredCare } from '@/components/modules/patient-centred-care';
import { DailyPriorityList } from '@/components/modules/daily-priority-list';
import { HealingTrajectory } from '@/components/modules/healing-trajectory';
import { CommunityNurseDashboard } from '@/components/modules/community-nurse-dashboard';
import { FacilityIntelligence } from '@/components/modules/facility-intelligence';
import { PilotWorkflow } from '@/components/modules/pilot-workflow';
import type { PilotPatient } from '@/lib/pilot-types';
import { CaseloadProvider, useCaseload } from '@/lib/caseload-context';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { AIProvider, useAI } from '@/lib/ai/ai-context';
import { SignIn } from '@/components/sign-in';
import { Settings } from '@/components/modules/settings';
import {
  LayoutDashboard, Brain, Activity, Calculator, FileText, TrendingUp, DatabaseZap,
  Timer, Stethoscope, ArrowUpCircle, GraduationCap, Home as HomeIcon, BarChart3, PoundSterling,
  Trophy, Heart, Users, Building2, Rocket, Settings as SettingsIcon,
} from 'lucide-react';

const mobileNavItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'priority', label: 'Priority', icon: <Timer className="h-4 w-4" /> },
  { id: 'daily', label: 'Daily', icon: <Activity className="h-4 w-4" /> },
  { id: 'command', label: 'Command', icon: <Brain className="h-4 w-4" /> },
  { id: 'tvn', label: 'TVN', icon: <Stethoscope className="h-4 w-4" /> },
  { id: 'escalation', label: 'Escalation', icon: <ArrowUpCircle className="h-4 w-4" /> },
  { id: 'trajectory', label: 'Trajectory', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'monitoring', label: 'Monitoring', icon: <Activity className="h-4 w-4" /> },
  { id: 'nurse', label: 'Nurse', icon: <Users className="h-4 w-4" /> },
  { id: 'carehome', label: 'Care Homes', icon: <HomeIcon className="h-4 w-4" /> },
  { id: 'facilityintel', label: 'Facilities', icon: <Building2 className="h-4 w-4" /> },
  { id: 'pilot', label: 'Pilot', icon: <Rocket className="h-4 w-4" /> },
  { id: 'hub', label: 'Data Hub', icon: <DatabaseZap className="h-4 w-4" /> },
  { id: 'benchmarking', label: 'Benchmarks', icon: <Trophy className="h-4 w-4" /> },
  { id: 'workforce', label: 'Workforce', icon: <GraduationCap className="h-4 w-4" /> },
  { id: 'patientcare', label: 'Patient Care', icon: <Heart className="h-4 w-4" /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'execcommand', label: 'Exec Center', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'costintel', label: 'Cost Intel', icon: <PoundSterling className="h-4 w-4" /> },
  { id: 'calculator', label: 'Savings', icon: <Calculator className="h-4 w-4" /> },
  { id: 'report', label: 'Report', icon: <FileText className="h-4 w-4" /> },
  { id: 'impact', label: 'ROI', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon className="h-4 w-4" /> },
];

export default function Home() {
  return (
    <AuthProvider>
      <CaseloadProvider>
        <AIProvider>
          <AuthGate />
        </AIProvider>
      </CaseloadProvider>
    </AuthProvider>
  );
}

function AuthGate() {
  const { ready, username } = useAuth();
  const { clearCaseload } = useCaseload();
  const { wipeSession } = useAI();

  // Signing out drops uploaded patient data, the AI key, consent and cached reviews from memory.
  useEffect(() => {
    if (ready && !username) {
      clearCaseload();
      wipeSession();
    }
  }, [ready, username, clearCaseload, wipeSession]);

  if (!ready) return null;
  if (!username) return <SignIn />;
  return <HomeContent />;
}

function HomeContent() {
  const [activeTab, setActiveTab] = useState<TabId>('priority');
  const [selectedPatient, setSelectedPatient] = useState<PilotPatient | null>(null);

  const handleTabChange = (tab: TabId) => { setActiveTab(tab); setSelectedPatient(null); };

  const renderContent = () => {
    if (selectedPatient) return <PatientDetail patient={selectedPatient} onBack={() => setSelectedPatient(null)} />;
    switch (activeTab) {
      case 'priority': return <DailyPriorityList onSelectPatient={setSelectedPatient} />;
      case 'trajectory': return <HealingTrajectory />;
      case 'nurse': return <CommunityNurseDashboard onSelectPatient={setSelectedPatient} />;
      case 'facilityintel': return <FacilityIntelligence />;
      case 'pilot': return <PilotWorkflow />;
      case 'dashboard': return <ExecutiveDashboard />;
      case 'command': return <AICommandCenter onSelectPatient={setSelectedPatient} />;
      case 'monitoring': return <DigitalWoundMonitoring />;
      case 'calculator': return <CostSavingsCalculator />;
      case 'report': return <ExecutiveReport />;
      case 'impact': return <ImpactROI />;
      case 'settings': return <Settings />;
      case 'hub': return <UniversalHub />;
      case 'daily': return <DailyCommandCenter onSelectPatient={setSelectedPatient} />;
      case 'tvn': return <TVNCommandCenter onSelectPatient={setSelectedPatient} />;
      case 'escalation': return <EscalationEngine />;
      case 'workforce': return <WorkforceReadinessPlatform />;
      case 'carehome': return <CareHomeDashboard />;
      case 'execcommand': return <ExecutiveCommandCenter />;
      case 'costintel': return <NHSCostIntelligence />;
      case 'benchmarking': return <Benchmarking />;
      case 'patientcare': return <PatientCentredCare />;
      default: return <DailyPriorityList onSelectPatient={setSelectedPatient} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 scrollbar-thin lg:hidden">
          {mobileNavItems.map((item) => (
            <button key={item.id} onClick={() => handleTabChange(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
              }`}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <div key={selectedPatient ? `patient-${selectedPatient.id}` : activeTab} className="animate-fade-in-up">
              {renderContent()}
            </div>
          </div>
        </main>
        <footer className="border-t border-border bg-card px-6 py-3">
          <div className="flex flex-col items-center justify-between gap-1 text-xs text-muted-foreground sm:flex-row">
            <p className="font-medium">WoundCareIQ&trade; | Confidential &amp; Proprietary</p>
            <p>&copy; 2026 WoundCareIQ. All Rights Reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
