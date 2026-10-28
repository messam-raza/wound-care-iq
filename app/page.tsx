'use client';

import { useEffect, useState } from 'react';
import { Sidebar, CORE_NAV, BUSINESS_NAV, type TabId } from '@/components/sidebar';
import { AppHeader } from '@/components/app-header';
import { ExecutiveDashboard } from '@/components/modules/executive-dashboard';
import { PatientDetail } from '@/components/modules/patient-detail';
import { CostSavingsCalculator } from '@/components/modules/cost-savings-calculator';
import { ExecutiveReport } from '@/components/modules/executive-report';
import { ImpactROI } from '@/components/modules/impact-roi';
import { UniversalHub } from '@/components/modules/universal-hub';
import { WorkforceReadinessPlatform } from '@/components/modules/workforce-readiness';
import { ExecutiveCommandCenter } from '@/components/modules/executive-command-center';
import { NHSCostIntelligence } from '@/components/modules/nhs-cost-intelligence';
import { Benchmarking } from '@/components/modules/benchmarking';
import { PatientCentredCare } from '@/components/modules/patient-centred-care';
import { Dashboard } from '@/components/modules/dashboard';
import { UploadMap } from '@/components/modules/upload-map';
import { AIReviews } from '@/components/modules/ai-reviews';
import { Worklist } from '@/components/modules/worklist';
import { Facilities } from '@/components/modules/facilities';
import { Reports } from '@/components/modules/reports';
import { Settings } from '@/components/modules/settings';
import { SignIn } from '@/components/sign-in';
import type { PilotPatient } from '@/lib/pilot-types';
import { CaseloadProvider, useCaseload } from '@/lib/caseload-context';
import { ActivityProvider, useActivity } from '@/lib/activity-context';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { AIProvider, useAI } from '@/lib/ai/ai-context';
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace-context';
import { SHOW_BUSINESS_VIEWS } from '@/lib/feature-flags';

const NAV = SHOW_BUSINESS_VIEWS ? [...CORE_NAV, ...BUSINESS_NAV] : CORE_NAV;
const BUSINESS_TABS = BUSINESS_NAV.map((n) => n.id);

export default function Home() {
  return (
    <AuthProvider>
      <CaseloadProvider>
        <ActivityProvider>
          <WorkspaceProvider>
            <AIProvider>
              <AuthGate />
            </AIProvider>
          </WorkspaceProvider>
        </ActivityProvider>
      </CaseloadProvider>
    </AuthProvider>
  );
}

function AuthGate() {
  const { ready, username } = useAuth();
  const { clearCaseload } = useCaseload();
  const { wipeSession } = useAI();
  const { reset } = useWorkspace();
  const { clearActivity } = useActivity();

  // Signing out drops uploaded patient data, the AI key, consent, cached reviews, visited marks and activity.
  useEffect(() => {
    if (ready && !username) {
      clearCaseload();
      wipeSession();
      reset();
      clearActivity();
    }
  }, [ready, username, clearCaseload, wipeSession, reset, clearActivity]);

  if (!ready) return null;
  if (!username) return <SignIn />;
  return <HomeContent />;
}

function HomeContent() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { patients } = useCaseload();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Looked up live so the detail page picks up AI reviews and visited marks as they change.
  const selectedPatient = selectedId ? patients.find((p) => p.id === selectedId) ?? null : null;
  const selectPatient = (p: PilotPatient) => setSelectedId(p.id);

  const navigate = (tab: TabId) => { setActiveTab(tab); setSelectedId(null); };

  const renderContent = () => {
    if (selectedPatient) return <PatientDetail patient={selectedPatient} onBack={() => setSelectedId(null)} />;
    if (BUSINESS_TABS.includes(activeTab) && !SHOW_BUSINESS_VIEWS) return <Dashboard onNavigate={navigate} onSelectPatient={selectPatient} />;
    switch (activeTab) {
      case 'upload': return <UploadMap onNavigate={navigate} />;
      case 'aireviews': return <AIReviews onSelectPatient={selectPatient} />;
      case 'priority': return <Worklist onSelectPatient={selectPatient} />;
      case 'facilities': return <Facilities onNavigate={navigate} />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      case 'execdashboard': return <ExecutiveDashboard />;
      case 'calculator': return <CostSavingsCalculator />;
      case 'report': return <ExecutiveReport />;
      case 'impact': return <ImpactROI />;
      case 'hub': return <UniversalHub />;
      case 'execcommand': return <ExecutiveCommandCenter />;
      case 'costintel': return <NHSCostIntelligence />;
      case 'benchmarking': return <Benchmarking />;
      case 'workforce': return <WorkforceReadinessPlatform />;
      case 'patientcare': return <PatientCentredCare />;
      default: return <Dashboard onNavigate={navigate} onSelectPatient={selectPatient} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeTab={activeTab} onTabChange={navigate} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader onNavigate={navigate} />
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 scrollbar-thin lg:hidden">
          {NAV.map((item) => (
            <button key={item.id} onClick={() => navigate(item.id)}
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
