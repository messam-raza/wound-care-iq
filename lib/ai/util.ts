// Small deterministic helpers shared by the AI modules.

// JSON with recursively sorted keys, so equal data always serialises to identical text.
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    Object.keys(v as Record<string, unknown>)
      .sort()
      .forEach((k) => {
        out[k] = sortDeep((v as Record<string, unknown>)[k]);
      });
    return out;
  }
  return v;
}

export async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure hashing is unavailable. Open the app over HTTPS or localhost.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort); // no listener left behind on the shared signal
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

// Removes anything that looks like an API key from text before it is shown or stored.
export function redactSecrets(text: string): string {
  return text.replace(/gsk_[A-Za-z0-9]{10,}/g, 'gsk_[redacted]').replace(/Bearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer [redacted]');
}
