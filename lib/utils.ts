import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formats an ISO timestamp as "4 Oct 2026". Returns "Not recorded" for empty or invalid input.
export function formatDate(iso?: string | null): string {
  if (!iso) return 'Not recorded';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 'Not recorded' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
