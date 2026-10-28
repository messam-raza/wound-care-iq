'use client';

import { Card, CardContent } from '@/components/ui/card';
import { DatabaseZap } from 'lucide-react';

// Shown by every data-driven module until a CSV has been uploaded in Upload & Map.
export function EmptyCaseload({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <DatabaseZap className="h-10 w-10 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">No caseload loaded</p>
          <p className="max-w-md text-sm text-muted-foreground">
            This view is calculated from your uploaded wound assessment data. Upload a CSV export in
            Upload & Map and it will populate here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
