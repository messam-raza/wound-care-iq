'use client';

import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useCaseload } from '@/lib/caseload-context';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { summary, hasData } = useCaseload();
  const { username, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur-md lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <p className="ml-auto truncate text-sm text-muted-foreground">
        {hasData && summary
          ? `${summary.uniquePatients} patients · ${summary.assessmentsAnalysed} assessments · ${summary.fileName}`
          : 'No caseload loaded'}
      </p>

      <div className="flex items-center gap-2 border-l border-border pl-3">
        <span className="text-sm font-medium text-foreground">{username}</span>
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
