'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Client-side sign-in gate. This keeps casual visitors out of the UI but is NOT a security
// boundary: all code and data run in the browser. Real access control needs server-side
// authentication (e.g. NHS CIS2) before any patient data is handled.
//
// Only salted SHA-256 hashes are stored, never the plaintext password. The default account
// ships as a precomputed hash; edited credentials are kept in localStorage on this device.

const STORAGE_KEY = 'wciq_credentials';
const SESSION_KEY = 'wciq_session';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
export const MIN_PASSWORD_LENGTH = 8;

interface StoredCredentials {
  username: string;
  salt: string;
  hash: string;
}

const DEFAULT_CREDENTIALS: StoredCredentials = {
  username: 'shokaib',
  salt: 'wciq-default',
  hash: '2bb3a413f3fba59f90d74827a790ac694584057a867ac2982392078cfa2c8ab9',
};

async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure hashing is unavailable. Open the app over HTTPS or localhost.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const hashPassword = (salt: string, password: string) => sha256(`${salt}:${password}`);

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadCredentials(): StoredCredentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.username && parsed?.salt && parsed?.hash) return parsed as StoredCredentials;
    }
  } catch {
    // storage unavailable or corrupt: fall back to the default account
  }
  return DEFAULT_CREDENTIALS;
}

function saveCredentials(c: StoredCredentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

type Result = { ok: true } | { ok: false; error: string };

interface AuthState {
  ready: boolean;
  username: string | null;
  signIn: (username: string, password: string) => Promise<Result>;
  signOut: () => void;
  updateCredentials: (input: {
    currentPassword: string;
    newUsername?: string;
    newPassword?: string;
  }) => Promise<Result>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const failures = useRef({ count: 0, lockedUntil: 0 });

  useEffect(() => {
    try {
      const session = sessionStorage.getItem(SESSION_KEY);
      if (session && session === loadCredentials().username) setUsername(session);
    } catch {
      // no session storage: user simply signs in again
    }
    setReady(true);
  }, []);

  const signIn = useCallback(async (user: string, password: string): Promise<Result> => {
    const now = Date.now();
    if (failures.current.lockedUntil > now) {
      const secs = Math.ceil((failures.current.lockedUntil - now) / 1000);
      return { ok: false, error: `Too many failed attempts. Try again in ${secs}s.` };
    }
    try {
      const creds = loadCredentials();
      const hash = await hashPassword(creds.salt, password);
      if (user.trim() === creds.username && hash === creds.hash) {
        failures.current = { count: 0, lockedUntil: 0 };
        try { sessionStorage.setItem(SESSION_KEY, creds.username); } catch { /* ignore */ }
        setUsername(creds.username);
        return { ok: true };
      }
      failures.current.count += 1;
      if (failures.current.count >= MAX_ATTEMPTS) {
        failures.current = { count: 0, lockedUntil: Date.now() + LOCKOUT_MS };
        return { ok: false, error: 'Too many failed attempts. Try again in 30s.' };
      }
      return { ok: false, error: 'Incorrect username or password.' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Sign-in failed.' };
    }
  }, []);

  const signOut = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setUsername(null);
  }, []);

  const updateCredentials = useCallback<AuthState['updateCredentials']>(async ({ currentPassword, newUsername, newPassword }) => {
    try {
      const creds = loadCredentials();
      if ((await hashPassword(creds.salt, currentPassword)) !== creds.hash) {
        return { ok: false, error: 'Current password is incorrect.' };
      }
      const nextUsername = newUsername?.trim() || creds.username;
      if (nextUsername.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
      let next: StoredCredentials = { ...creds, username: nextUsername };
      if (newPassword) {
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
          return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
        }
        const salt = randomSalt();
        next = { username: nextUsername, salt, hash: await hashPassword(salt, newPassword) };
      }
      saveCredentials(next);
      try { sessionStorage.setItem(SESSION_KEY, next.username); } catch { /* ignore */ }
      setUsername(next.username);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Could not save changes.' };
    }
  }, []);

  const value = useMemo(
    () => ({ ready, username, signIn, signOut, updateCredentials }),
    [ready, username, signIn, signOut, updateCredentials],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
