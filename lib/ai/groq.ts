import { AI_CONFIG } from './config';
import { AIError, type CompletionRequest, type CompletionResult, type LLMProvider } from './provider';
import { redactSecrets } from './util';

// Groq (OpenAI-compatible) chat completions client. Deterministic request: temperature 0, top_p 1, a fixed
// seed and JSON mode. The API key is read from a getter at call time and is only ever placed in the
// Authorization header: never in a URL, a log line, an error message or storage.

function parseRetryAfter(h: string | null): number | undefined {
  if (!h) return undefined;
  const s = Number(h);
  return isFinite(s) && s >= 0 ? Math.min(s * 1000, 30_000) : undefined;
}

// Combines the caller's abort signal with a hard timeout.
function withTimeout(external?: AbortSignal): { signal: AbortSignal; cancel: () => void; timedOut: () => boolean } {
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, AI_CONFIG.timeoutMs);
  const onAbort = () => ctl.abort();
  external?.addEventListener('abort', onAbort);
  return {
    signal: ctl.signal,
    cancel: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
    timedOut: () => timedOut,
  };
}

function statusToError(status: number, retryAfter: string | null): AIError {
  if (status === 401 || status === 403) return new AIError('auth', 'The API key was rejected. Check the key in Settings.');
  if (status === 429) return new AIError('rate_limit', 'The AI service is rate limiting requests.', parseRetryAfter(retryAfter));
  if (status >= 500) return new AIError('server', `The AI service returned an error (${status}).`, parseRetryAfter(retryAfter));
  return new AIError('bad_request', `The AI service rejected the request (${status}).`);
}

export class GroqProvider implements LLMProvider {
  readonly id = 'groq';
  readonly model = AI_CONFIG.model;

  constructor(private readonly getApiKey: () => string | null) {}

  private headers(): Record<string, string> {
    const key = this.getApiKey();
    if (!key) throw new AIError('no_key', 'No API key has been entered.');
    return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const headers = this.headers();
    const t = withTimeout(req.signal);
    try {
      const res = await fetch(AI_CONFIG.endpoint, {
        method: 'POST',
        headers,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: t.signal,
        body: JSON.stringify({
          model: AI_CONFIG.model,
          temperature: AI_CONFIG.temperature,
          top_p: AI_CONFIG.topP,
          seed: AI_CONFIG.seed,
          max_tokens: AI_CONFIG.maxTokens,
          stream: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
        }),
      });
      if (!res.ok) throw statusToError(res.status, res.headers.get('retry-after'));
      const data = (await res.json()) as {
        id?: string;
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== 'string') throw new AIError('server', 'The AI service returned an empty response.');
      return { content, finishReason: choice?.finish_reason ?? null, requestId: data.id ?? null };
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (req.signal?.aborted) throw new AIError('aborted', 'The request was cancelled.');
      if (t.timedOut()) throw new AIError('timeout', 'The AI service took too long to respond.');
      if (e instanceof DOMException && e.name === 'AbortError') throw new AIError('aborted', 'The request was cancelled.');
      // fetch() throws a bare TypeError for network and CORS failures; never echo raw error text (could contain a URL or key).
      throw new AIError('network', redactSecrets('Could not reach the AI service. Check your connection.'));
    } finally {
      t.cancel();
    }
  }

  // Cheap authenticated call used by the Settings "Verify key" button. Sends no patient data.
  async verifyKey(signal?: AbortSignal): Promise<void> {
    const headers = this.headers();
    const t = withTimeout(signal);
    try {
      const res = await fetch(AI_CONFIG.modelsEndpoint, {
        method: 'GET',
        headers: { Authorization: headers.Authorization },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: t.signal,
      });
      if (!res.ok) throw statusToError(res.status, res.headers.get('retry-after'));
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (t.timedOut()) throw new AIError('timeout', 'The AI service took too long to respond.');
      throw new AIError('network', 'Could not reach the AI service. Check your connection.');
    } finally {
      t.cancel();
    }
  }
}
