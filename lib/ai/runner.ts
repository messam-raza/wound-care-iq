import type { PilotPatient } from '../pilot-types';
import type { RuleSnapshot } from './bundle';
import { AI_CONFIG } from './config';
import { AIError, type LLMProvider } from './provider';
import { reviewPatient, type ReviewCache } from './review';
import type { AIReviewRecord } from './types';

// Runs reviews over a caseload with a concurrency cap and a circuit breaker. The worklist never waits for
// this (AI-09): it is started explicitly, reports progress, and can be cancelled at any time.

export interface RunItem {
  patient: PilotPatient;
  rule: RuleSnapshot;
}

export interface RunStats {
  total: number;
  done: number;
  accepted: number;
  rejected: number;
  unavailable: number;
  escalated: number;
  cached: number;
  stoppedReason: string | null;
}

export const emptyStats = (total: number): RunStats => ({ total, done: 0, accepted: 0, rejected: 0, unavailable: 0, escalated: 0, cached: 0, stoppedReason: null });

export interface RunOptions {
  provider: LLMProvider;
  cache: ReviewCache;
  signal: AbortSignal;
  force?: boolean;
  concurrency?: number;
  abortAfterConsecutiveFailures?: number;
  onRecord: (r: AIReviewRecord) => void;
  onProgress: (s: RunStats) => void;
}

export async function runReviews(items: RunItem[], opts: RunOptions): Promise<RunStats> {
  const stats = emptyStats(items.length);
  const limit = opts.concurrency ?? AI_CONFIG.concurrency;
  const maxFailures = opts.abortAfterConsecutiveFailures ?? AI_CONFIG.abortAfterConsecutiveFailures;
  const stop = new AbortController();
  const onOuterAbort = () => stop.abort();
  opts.signal.addEventListener('abort', onOuterAbort);

  let next = 0;
  let consecutiveFailures = 0;

  const halt = (reason: string) => {
    if (!stats.stoppedReason) stats.stoppedReason = reason;
    stop.abort();
  };

  const worker = async () => {
    while (!stop.signal.aborted) {
      const i = next++;
      if (i >= items.length) return;
      const { patient, rule } = items[i];
      try {
        const rec = await reviewPatient(patient, rule, { provider: opts.provider, cache: opts.cache, signal: stop.signal, force: opts.force });
        stats.done++;
        if (rec.fromCache) stats.cached++;
        if (rec.status === 'accepted') {
          stats.accepted++;
          if (rec.escalation) stats.escalated++;
          consecutiveFailures = 0;
        } else if (rec.status === 'rejected') {
          stats.rejected++;
          consecutiveFailures = 0; // the service works; the output failed validation
        } else {
          stats.unavailable++;
          consecutiveFailures++;
          if (rec.errorKind === 'auth') halt('The API key was rejected. Check the key in Settings.');
          else if (rec.errorKind === 'no_key') halt('No API key has been entered.');
          else if (consecutiveFailures >= maxFailures) halt(`Stopped after ${maxFailures} consecutive failures. The AI service may be unavailable.`);
        }
        opts.onRecord(rec);
        opts.onProgress({ ...stats });
      } catch (e) {
        if (e instanceof AIError && e.kind === 'aborted') return;
        throw e;
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
  } finally {
    opts.signal.removeEventListener('abort', onOuterAbort);
  }
  if (opts.signal.aborted && !stats.stoppedReason) stats.stoppedReason = 'Cancelled.';
  opts.onProgress({ ...stats });
  return stats;
}
