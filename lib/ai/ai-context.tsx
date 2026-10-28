'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useCaseload } from '../caseload-context';
import { useActivity } from '../activity-context';
import { PRIORITY_RANK } from './action-library';
import { AI_CONFIG, ENV_API_KEY } from './config';
import { DemoProvider } from './demo-provider';
import { GroqProvider } from './groq';
import { AIError } from './provider';
import { reviewPatient, type ReviewCache } from './review';
import { emptyStats, runReviews, type RunStats } from './runner';

// AI state for the whole app: consent, the API key, and review runs.
//
// Key handling (this is a browser-only app, so the key cannot be hidden from the user who holds it):
//  - the user types their own key; it is never in source, env vars or the build output
//  - it lives in a ref (not React state), so it is not rendered or put in any component tree
//  - optional "remember for this tab" uses sessionStorage, which is wiped when the tab closes
//  - sign-out wipes it; it is never logged, put in a URL or included in an error message

const KEY_STORAGE = 'wciq_ai_key';
const CONSENT_STORAGE = 'wciq_ai_consent';
// Groq keys are "gsk_" followed by letters and digits. Anything else (spaces, newlines, header
// injection attempts) is refused before it can reach a request header.
const KEY_PATTERN = /^gsk_[A-Za-z0-9]{20,100}$/;

export const AI_CONSENT_TEXT =
  'I understand that enabling AI review sends de-identified clinical data to Groq, a third-party service, for processing. ' +
  'Names, NHS numbers, identifiers, facility names, calendar dates and free text are removed first. ' +
  'I have confirmed this is permitted under my organisation’s information governance rules.';

// Cache of reviews by input hash. Module-level so it survives re-renders; cleared on sign-out.
const reviewCache: ReviewCache = new Map();

interface AIState {
  consent: boolean;
  setConsent: (v: boolean) => void;
  hasKey: boolean;
  rememberKey: boolean;
  setApiKey: (key: string, remember: boolean) => { ok: true } | { ok: false; error: string };
  clearKey: () => void;
  verifyKey: () => Promise<{ ok: boolean; message: string }>;
  ready: boolean; // always true: with no Groq key the built-in demo reviewer is used
  usingDemo: boolean; // no Groq key set, so reviews come from the keyless demo reviewer
  running: boolean;
  stats: RunStats | null;
  runReview: (opts?: { force?: boolean }) => Promise<void>;
  reviewOne: (patientId: string, force?: boolean) => Promise<void>;
  cancel: () => void;
  wipeSession: () => void; // sign-out: key, consent, cache and reviews
}

const AIContext = createContext<AIState | null>(null);

function describeError(e: unknown): string {
  if (e instanceof AIError) return e.message;
  return 'The AI review could not be completed.';
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const { basePatients, putAIReview, clearAIReviews } = useCaseload();
  const { log } = useActivity();
  const keyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoRunFor = useRef<unknown>(null);
  const [hasKey, setHasKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(false);
  const [consent, setConsentState] = useState(true);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<RunStats | null>(null);

  // With a Groq key and consent, reviews go to Groq. Otherwise the keyless demo reviewer runs locally, so
  // every patient always gets a review and no data leaves the browser.
  const groq = useMemo(() => new GroqProvider(() => keyRef.current), []);
  const demo = useMemo(() => new DemoProvider(), []);
  const useGroq = consent && hasKey;
  const provider = useGroq ? groq : demo;
  // Cached reviews are keyed by input, not by provider, so switching provider must drop them.
  useEffect(() => {
    reviewCache.clear();
    clearAIReviews();
    autoRunFor.current = null;
  }, [useGroq, clearAIReviews]);

  // Restore tab-scoped state. Nothing is restored from persistent storage.
  useEffect(() => {
    try {
      const k = sessionStorage.getItem(KEY_STORAGE);
      if (!k && ENV_API_KEY && KEY_PATTERN.test(ENV_API_KEY)) {
        keyRef.current = ENV_API_KEY; // dev-only key from .env.local
        setHasKey(true);
      } else if (k && KEY_PATTERN.test(k)) {
        keyRef.current = k;
        setHasKey(true);
        setRememberKey(true);
      }
      // AI review is on by default; only an explicit opt-out ('0') turns it off.
      setConsentState(sessionStorage.getItem(CONSENT_STORAGE) !== '0');
    } catch {
      // storage unavailable: the user just re-enters the key
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const setConsent = useCallback((v: boolean) => {
    setConsentState(v);
    try {
      sessionStorage.setItem(CONSENT_STORAGE, v ? '1' : '0');
    } catch {
      // ignore
    }
  }, []);

  const setApiKey = useCallback((key: string, remember: boolean) => {
    const k = key.trim();
    if (!KEY_PATTERN.test(k)) return { ok: false as const, error: 'That does not look like a Groq API key (it starts with "gsk_").' };
    keyRef.current = k;
    setHasKey(true);
    setRememberKey(remember);
    try {
      if (remember) sessionStorage.setItem(KEY_STORAGE, k);
      else sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      // ignore
    }
    return { ok: true as const };
  }, []);

  const clearKey = useCallback(() => {
    keyRef.current = null;
    setHasKey(false);
    setRememberKey(false);
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      // ignore
    }
  }, []);

  const verifyKey = useCallback(async () => {
    try {
      await groq.verifyKey();
      return { ok: true, message: 'The key is valid.' };
    } catch (e) {
      return { ok: false, message: describeError(e) };
    }
  }, [groq]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const runReview = useCallback(
    async (opts?: { force?: boolean }) => {
      if (running) return;
      const items = basePatients
        .filter((p) => p.ruleResult)
        .sort((a, b) => PRIORITY_RANK[a.rulePriority] - PRIORITY_RANK[b.rulePriority] || b.riskScore - a.riskScore)
        .slice(0, AI_CONFIG.maxPatientsPerRun)
        .map((p) => ({ patient: p, rule: p.ruleResult! }));
      if (items.length === 0) return;

      const ctl = new AbortController();
      abortRef.current = ctl;
      setRunning(true);
      setStats(emptyStats(items.length));
      try {
        const result = await runReviews(items, {
          provider,
          cache: reviewCache,
          signal: ctl.signal,
          force: opts?.force,
          onRecord: putAIReview,
          onProgress: setStats,
        });
        log('ai', 'AI reviews generated', `${result.accepted} of ${result.total} patients reviewed${result.stoppedReason ? ` · ${result.stoppedReason}` : ''}`);
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [running, basePatients, provider, putAIReview, log],
  );

  // Reviews start by themselves once a caseload is loaded (and again if the provider switches between the
  // demo reviewer and Groq), so the AI wording is on screen without a button press. Cached results are not
  // re-requested, and failures fall back to the rule-based text.
  useEffect(() => {
    if (basePatients.length === 0 || running) return;
    if (autoRunFor.current === basePatients) return;
    autoRunFor.current = basePatients;
    void runReview();
  }, [useGroq, basePatients, running, runReview]);

  const reviewOne = useCallback(
    async (patientId: string, force?: boolean) => {
      const p = basePatients.find((x) => x.id === patientId);
      if (!p?.ruleResult) return;
      const ctl = new AbortController();
      try {
        putAIReview(await reviewPatient(p, p.ruleResult, { provider, cache: reviewCache, signal: ctl.signal, force }));
      } catch {
        // cancelled or unexpected: the rule-based explanation stays on screen
      }
    },
    [basePatients, provider, putAIReview],
  );

  const wipeSession = useCallback(() => {
    abortRef.current?.abort();
    clearKey();
    setConsent(true); // back to the default (on) for the next sign-in
    reviewCache.clear();
    clearAIReviews();
    setStats(null);
  }, [clearKey, setConsent, clearAIReviews]);

  const value = useMemo<AIState>(
    () => ({ consent, setConsent, hasKey, rememberKey, setApiKey, clearKey, verifyKey, ready: true, usingDemo: !useGroq, running, stats, runReview, reviewOne, cancel, wipeSession }),
    [consent, setConsent, hasKey, rememberKey, setApiKey, clearKey, verifyKey, useGroq, running, stats, runReview, reviewOne, cancel, wipeSession],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI(): AIState {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used inside AIProvider');
  return ctx;
}
