'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MIN_PASSWORD_LENGTH, useAuth } from '@/lib/auth-context';
import { AI_CONSENT_TEXT, useAI } from '@/lib/ai/ai-context';
import { AI_CONFIG } from '@/lib/ai/config';
import { useCaseload } from '@/lib/caseload-context';
import { Chip } from '@/components/pilot-ui';
import { Brain } from 'lucide-react';

function AISettings() {
  const { consent, setConsent, hasKey, rememberKey, setApiKey, clearKey, verifyKey } = useAI();
  const { aiMode, setAIMode } = useCaseload();
  const [keyInput, setKeyInput] = useState('');
  const [remember, setRemember] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    const r = setApiKey(keyInput, remember);
    setKeyInput(''); // the key is never kept in the input or echoed back
    setMsg(r.ok ? { ok: true, text: 'Key saved for this session.' } : { ok: false, text: r.error });
  };

  const verify = async () => {
    setBusy(true);
    setMsg(null);
    const r = await verifyKey();
    setMsg({ ok: r.ok, text: r.message });
    setBusy(false);
  };

  const locked: [string, string][] = [
    ['Provider', 'Groq (OpenAI-compatible endpoint)'],
    ['Model', AI_CONFIG.model],
    ['Prompt version', AI_CONFIG.promptVersion],
    ['Temperature / top-p / seed', `${AI_CONFIG.temperature} / ${AI_CONFIG.topP} / ${AI_CONFIG.seed}`],
    ['Retries', `${AI_CONFIG.maxRetries} (up to ${AI_CONFIG.maxRetries + 1} calls per patient)`],
    ['Timeout / concurrency', `${AI_CONFIG.timeoutMs / 1000}s / ${AI_CONFIG.concurrency} at a time`],
  ];

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-primary" />AI review</CardTitle>
        <CardDescription>
          Optional. Rules set every priority; the AI can raise one by a single band with cited evidence and can never lower it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="text-sm leading-relaxed text-foreground">{AI_CONSENT_TEXT}</span>
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="aiKey">Groq API key</Label>
            {hasKey ? <Chip tone="success">Key set{rememberKey ? ' (this tab)' : ''}</Chip> : <Chip>No key</Chip>}
          </div>
          <Input
            id="aiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={hasKey ? 'Enter a new key to replace it' : 'gsk_...'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="h-4 w-4" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember for this browser tab only
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This is a browser-only app, so the key is held in this browser, not on a server. It is never saved in the code, logged or sent anywhere except Groq. Use a key with a spending limit, and rotate it if the device is shared.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={!keyInput}>Save key</Button>
            <Button size="sm" variant="outline" onClick={verify} disabled={!hasKey || busy}>{busy ? 'Checking...' : 'Verify key'}</Button>
            <Button size="sm" variant="ghost" onClick={() => { clearKey(); setMsg(null); }} disabled={!hasKey}>Remove key</Button>
          </div>
          {msg && <p role="alert" className={msg.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{msg.text}</p>}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">When the AI raises a priority</legend>
          {([
            ['apply', 'Apply it (the patient moves up one band and is marked AI-raised)'],
            ['shadow', 'Record it only (shadow mode: shown on the patient page but not applied)'],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
              <input type="radio" name="aiMode" className="mt-1 h-4 w-4" checked={aiMode === value} onChange={() => setAIMode(value)} />
              {label}
            </label>
          ))}
        </fieldset>

        <div>
          <p className="text-sm font-medium text-foreground">Locked settings</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Changing any of these is a code change that needs clinical sign-off, so they are not editable here.</p>
          <dl className="mt-2 divide-y divide-border/60 rounded-lg border border-border text-sm">
            {locked.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

export function Settings() {
  const { username, updateCredentials, signOut } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const changesRequested = newUsername.trim() !== '' || newPassword !== '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ ok: false, text: 'New password and confirmation do not match.' });
      return;
    }
    setBusy(true);
    const result = await updateCredentials({
      currentPassword,
      newUsername: newUsername.trim() || undefined,
      newPassword: newPassword || undefined,
    });
    setBusy(false);
    if (result.ok) {
      setMessage({ ok: true, text: 'Your sign-in details were updated.' });
      setNewUsername('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ ok: false, text: result.error });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Signed in as <span className="font-semibold text-foreground">{username}</span></p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Sign-in details</CardTitle>
          <CardDescription>
            Leave a field blank to keep it unchanged. Details are saved on this device only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newUsername">New username</Label>
              <Input id="newUsername" autoComplete="off" placeholder={username ?? ''} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">Required to save any change.</p>
            </div>
            {message && (
              <p role="alert" className={message.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{message.text}</p>
            )}
            <Button type="submit" disabled={busy || !changesRequested || !currentPassword}>
              {busy ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <AISettings />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
