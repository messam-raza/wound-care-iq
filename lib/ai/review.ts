import type { PilotPatient } from '../pilot-types';
import { buildEvidenceBundle, type RuleSnapshot } from './bundle';
import { AI_CONFIG } from './config';
import { validateAIOutput } from './guardrails';
import { buildUserMessage, SYSTEM_PROMPT } from './prompt';
import { AIError, type LLMProvider } from './provider';
import { parseModelOutput } from './schema';
import type { AIReviewRecord, GuardrailViolation } from './types';
import { canonicalJson, sha256Hex, sleep } from './util';

// One patient's AI review: build the pseudonymised bundle, call the model (retrying transient failures and
// invalid outputs up to AI_CONFIG.maxRetries times), validate every output against the guardrails, and
// return a record. The AI never holds the priority: a failed or rejected review leaves the rule priority
// untouched and the rule-based explanation is shown ("AI review unavailable").

let promptHashPromise: Promise<string> | null = null;
export const getPromptHash = () => (promptHashPromise ??= sha256Hex(SYSTEM_PROMPT));

export type ReviewCache = Map<string, AIReviewRecord>;

export interface ReviewDeps {
  provider: LLMProvider;
  cache: ReviewCache;
  signal?: AbortSignal;
  force?: boolean; // bypass the cache and call the model again
}

export async function computeInputHash(bundleJson: string, rulesetVersion: string): Promise<string> {
  const promptHash = await getPromptHash();
  return sha256Hex([bundleJson, promptHash, AI_CONFIG.model, AI_CONFIG.promptVersion, AI_CONFIG.seed, AI_CONFIG.temperature, rulesetVersion].join('|'));
}

// Deterministic exponential backoff (no jitter, so identical failures wait identically).
export function backoffMs(attempt: number, retryAfterMs?: number): number {
  const exp = Math.min(AI_CONFIG.maxBackoffMs, AI_CONFIG.baseBackoffMs * 2 ** attempt);
  return Math.max(exp, retryAfterMs ?? 0);
}

export async function reviewPatient(patient: PilotPatient, rule: RuleSnapshot, deps: ReviewDeps): Promise<AIReviewRecord> {
  const started = performance.now();
  const bundle = buildEvidenceBundle(patient, rule);
  const bundleJson = canonicalJson(bundle);
  const [inputHash, promptHash] = await Promise.all([computeInputHash(bundleJson, rule.rulesetVersion), getPromptHash()]);

  const base = {
    patientId: patient.id,
    rulePriority: rule.priority,
    inputHash,
    promptVersion: AI_CONFIG.promptVersion,
    promptHash,
    model: deps.provider.model,
    rulesetVersion: rule.rulesetVersion,
    flaggedWrong: false,
    completedAtDay: new Date().toISOString().slice(0, 10),
  };

  // Outputs are cached per input hash and regenerated only when the bundle changes (PRD 11.6.7).
  const cached = deps.cache.get(inputHash);
  if (cached && !deps.force) return { ...cached, patientId: patient.id, fromCache: true };

  let violations: GuardrailViolation[] = [];
  let lastError: AIError | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= AI_CONFIG.maxRetries; attempt++) {
    if (deps.signal?.aborted) throw new AIError('aborted', 'The review was cancelled.');
    attempts++;

    try {
      const res = await deps.provider.complete({
        system: SYSTEM_PROMPT,
        user: buildUserMessage(bundle, violations),
        signal: deps.signal,
      });
      lastError = null;

      const parsed = parseModelOutput(res.content);
      if (!parsed.ok) {
        violations = [{ check: 'schema', detail: parsed.detail }];
        continue; // invalid output: regenerate with the failure reason
      }

      const verdict = validateAIOutput(parsed.value, {
        bundle,
        rulePriority: rule.priority,
        rulePrimaryActionCode: rule.primaryActionCode,
      });
      if (!verdict.ok) {
        violations = verdict.violations;
        continue; // guardrail failure: regenerate with the failure reasons
      }

      const record: AIReviewRecord = {
        ...base,
        status: 'accepted',
        finalPriority: verdict.finalPriority,
        escalation: verdict.escalation,
        output: parsed.value,
        violations: [],
        errorKind: null,
        attempts,
        fromCache: false,
        latencyMs: Math.round(performance.now() - started),
      };
      deps.cache.set(inputHash, record);
      return record;
    } catch (e) {
      if (!(e instanceof AIError)) throw e;
      if (e.kind === 'aborted') throw e;
      lastError = e;
      if (!e.retryable) break; // auth, bad request, missing key: retrying cannot help
      if (attempt < AI_CONFIG.maxRetries) {
        try {
          await sleep(backoffMs(attempt, e.retryAfterMs), deps.signal);
        } catch {
          throw new AIError('aborted', 'The review was cancelled.'); // cancelled while waiting to retry
        }
      }
    }
  }

  // Out of attempts. A transport failure is "unavailable" (not cached, may succeed later); repeated invalid
  // output is "rejected" (cached, because the same input would fail the same way).
  const rejected = lastError === null;
  const record: AIReviewRecord = {
    ...base,
    status: rejected ? 'rejected' : 'unavailable',
    finalPriority: rule.priority,
    escalation: null,
    output: null,
    violations: rejected ? violations : [],
    errorKind: lastError?.kind ?? null,
    attempts,
    fromCache: false,
    latencyMs: Math.round(performance.now() - started),
  };
  if (rejected) deps.cache.set(inputHash, record);
  return record;
}
