// Locked AI settings (PRD 11.6.7, AI-07). Model, prompt version and sampling settings are constants on
// purpose: changing any of them is a ruleset-equivalent change that needs clinical sign-off, so it is a
// code change and never a runtime option. The endpoint is fixed too, so a stolen or mistyped setting
// can never redirect the API key to another host.

// Settings can be overridden from .env.local (see .env.example). Defaults are the PRD-locked values.
// NEXT_PUBLIC_* variables are inlined into the browser bundle at build time, so each one is read as a
// literal property access below (a dynamic process.env[name] would not be replaced by Next.js).
const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};
const str = (v: string | undefined, d: string) => (v && v.trim() ? v.trim() : d);

// Optional build-time key. Anyone who can open the site can read it from the JS bundle, so use it for
// local development only; in production leave it empty and have each user enter their own key in Settings.
export const ENV_API_KEY = str(process.env.NEXT_PUBLIC_GROQ_API_KEY, '');

export const AI_CONFIG = {
  provider: 'groq' as const,
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  modelsEndpoint: 'https://api.groq.com/openai/v1/models',
  model: str(process.env.NEXT_PUBLIC_AI_MODEL, 'openai/gpt-oss-120b'),
  promptVersion: str(process.env.NEXT_PUBLIC_AI_PROMPT_VERSION, 'tvn-review-2026.10'),

  // Determinism settings: no sampling randomness, fixed seed.
  temperature: num(process.env.NEXT_PUBLIC_AI_TEMPERATURE, 0),
  topP: 1,
  seed: num(process.env.NEXT_PUBLIC_AI_SEED, 20261022),
  maxTokens: num(process.env.NEXT_PUBLIC_AI_MAX_TOKENS, 1500),

  // Resilience. MAX_RETRIES = 3 means the first call plus up to three retries (four calls at most).
  maxRetries: num(process.env.NEXT_PUBLIC_AI_MAX_RETRIES, 3),
  // Rate limits (HTTP 429) are waited out rather than counted as failures. Small plans allow only a few
  // reviews a minute, so a full caseload takes a while but still completes.
  maxRateLimitWaits: 12,
  rateLimitWaitMs: 8000,
  baseBackoffMs: 1000,
  maxBackoffMs: 8000,
  timeoutMs: num(process.env.NEXT_PUBLIC_AI_TIMEOUT_MS, 30_000),

  // Run controls.
  concurrency: num(process.env.NEXT_PUBLIC_AI_CONCURRENCY, 3),
  maxPatientsPerRun: 500,
  abortAfterConsecutiveFailures: 5,
};

export const BUNDLE_SCHEMA_VERSION = 'wound-journey-bundle/1';
