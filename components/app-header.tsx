'use client';

import { Bell, ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth-context';
import { useCaseload } from '@/lib/caseload-context';
import { useWorkspace } from '@/lib/workspace-context';
import { needsHumanReview } from '@/lib/worklist-utils';
import type { TabId } from '@/components/sidebar';

export function AppHeader({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { username, signOut } = useAuth();
  const { summary, hasData } = useCaseload();
  const { scoped, isReviewed } = useWorkspace();
  const pending = scoped.filter((p) => !isReviewed(p));
  const today = pending.filter((p) => p.tvnPriority === 'SEE TODAY').length;
  const review = pending.filter(needsHumanReview).length;
  const initials = (username ?? '?').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md lg:px-6">
      <p className="truncate text-sm text-muted-foreground">
        {hasData && summary
          ? `${summary.uniquePatients} patients · ${summary.assessmentsAnalysed} assessments · ${summary.fileName}`
          : 'No caseload loaded'}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Notifications">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {today + review > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate('priority')}>{today} to see today</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNavigate('aireviews')}>{review} need human review</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials}</span>
            <span className="hidden text-sm font-medium text-foreground sm:inline">{username}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onNavigate('settings')}><SettingsIcon className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
