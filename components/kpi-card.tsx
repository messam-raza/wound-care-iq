'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: 'primary' | 'destructive' | 'success' | 'warning' | 'accent';
}

const accentClasses: Record<NonNullable<KPICardProps['accent']>, string> = {
  primary: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  accent: 'bg-accent/10 text-accent',
};

export function KPICard({ label, value, sublabel, icon: Icon, trend, accent = 'primary' }: KPICardProps) {
  return (
    <Card className="relative overflow-hidden p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {sublabel && (
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accentClasses[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-semibold',
              trend.positive ? 'text-success' : 'text-destructive',
            )}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-xs text-muted-foreground">vs last month</span>
        </div>
      )}
    </Card>
  );
}
