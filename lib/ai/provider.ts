// Provider abstraction. The rest of the AI layer only talks to this interface, so moving from Groq to
// Claude later means adding one class that implements LLMProvider and changing one line in config.

export type AIErrorKind = 'auth' | 'rate_limit' | 'server' | 'network' | 'timeout' | 'bad_request' | 'aborted' | 'no_key' | 'no_consent';

export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(kind: AIErrorKind, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'AIError';
    this.kind = kind;
    // Transient failures are retried; auth, malformed-request and consent failures never are.
    this.retryable = kind === 'rate_limit' || kind === 'server' || kind === 'network' || kind === 'timeout';
    this.retryAfterMs = retryAfterMs;
  }
}

export interface CompletionRequest {
  system: string;
  user: string;
  signal?: AbortSignal;
}

export interface CompletionResult {
  content: string;
  finishReason: string | null;
  requestId: string | null;
}

export interface LLMProvider {
  readonly id: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  verifyKey(signal?: AbortSignal): Promise<void>;
}
