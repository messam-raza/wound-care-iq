'use client';

import { useState } from 'react';
import { Brain, Flag, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIRaisedChip, Chip, Notice, PriorityBadge, Section } from '@/components/pilot-ui';
import { ACTION_BY_CODE, fromWirePriority } from '@/lib/ai/action-library';
import { useAI } from '@/lib/ai/ai-context';
import type { AIReviewRecord } from '@/lib/ai/types';
import { useCaseload } from '@/lib/caseload-context';
import type { PilotPatient } from '@/lib/pilot-types';
import { cn } from '@/lib/utils';

const ERROR_TEXT: Record<string, string> = {
  auth: 'The API key was rejected.',
  rate_limit: 'The AI service is rate limiting requests.',
  server: 'The AI service returned an error.',
  network: 'The AI service could not be reached.',
  timeout: 'The AI service took too long to respond.',
  bad_request: 'The AI service rejected the request.',
  no_key: 'No API key has been entered.',
  no_consent: 'AI review has not been enabled.',
};

function evidenceLabel(id: string): string {
  if (/^asm_\d+$/.test(id)) return `Assessment ${id.slice(4)}`;
  if (id.startsWith('rf_')) return id.slice(3);
  if (id === 'rule_output') return 'Rule result';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function Cites({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{evidenceLabel(id)}</span>
      ))}
    </span>
  );
}

// ─── Per-patient panel ───────────────────────────────────────────────────────

export function AIReviewPanel({ patient }: { patient: PilotPatient }) {
  const { ready, reviewOne } = useAI();
  const { aiMode, flagAIReview } = useCaseload();
  const [busy, setBusy] = useState(false);
  const review = patient.aiReview;

  const run = async (force: boolean) => {
    setBusy(true);
    await reviewOne(patient.id, force);
    setBusy(false);
  };

  const runButton = (label: string, force: boolean) => (
    <Button variant="outline" size="sm" onClick={() => run(force)} disabled={!ready || busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );

  return (
    <Section
      title="AI clinical review"
      description="Whole-journey reading by the AI. It never changes the rule priority downwards."
      icon={<Brain className="h-5 w-5 text-primary" />}
      action={review ? runButton('Re-run', true) : runButton('Review this patient', false)}
    >
      <div className="space-y-4 p-5">
        {!review && (
          <p className="text-sm text-muted-foreground">
            {busy ? 'Reviewing this patient…' : 'No AI review has been run for this patient yet.'}
          </p>
        )}

        {review && review.status !== 'accepted' && <Unavailable review={review} />}

        {review && review.status === 'accepted' && review.output && <Accepted review={review} patient={patient} mode={aiMode} onFlag={() => flagAIReview(patient.id)} />}

        {review && (
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            Model {review.model} · prompt {review.promptVersion} · ruleset {review.rulesetVersion} · input {review.inputHash.slice(0, 10)} · {review.attempts} attempt{review.attempts === 1 ? '' : 's'}
            {review.fromCache ? ' · from cache' : ''} · {review.completedAtDay}
          </p>
        )}
      </div>
    </Section>
  );
}

function Unavailable({ review }: { review: AIReviewRecord }) {
  return (
    <Notice tone="warning" title="AI review unavailable">
      <p>The priority is unaffected and the rule-based explanation is shown. {review.status === 'unavailable' && review.errorKind ? ERROR_TEXT[review.errorKind] ?? '' : ''}</p>
      {review.status === 'rejected' && review.violations.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {review.violations.slice(0, 5).map((v) => (
            <li key={`${v.check}-${v.detail}`}><span className="font-medium text-foreground">{v.check}:</span> {v.detail}</li>
          ))}
        </ul>
      )}
    </Notice>
  );
}

function Accepted({ review, patient, mode, onFlag }: { review: AIReviewRecord; patient: PilotPatient; mode: 'apply' | 'shadow'; onFlag: () => void }) {
  const o = review.output!;
  const action = ACTION_BY_CODE[o.recommended_action.action_code];
  const finalWire = fromWirePriority(o.overall_risk.final_priority);
  const esc = review.escalation;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Rule priority</span>
        <PriorityBadge priority={review.rulePriority} />
        {esc ? (
          <>
            <span className="text-sm text-muted-foreground">raised to</span>
            <PriorityBadge priority={esc.to} />
            <AIRaisedChip />
            {mode === 'shadow' && <Chip tone="warning">Shadow mode: not applied</Chip>}
          </>
        ) : (
          finalWire && <span className="text-sm text-muted-foreground">No AI escalation</span>
        )}
      </div>

      {esc && (
        <Notice tone="primary" title="Why the AI raised the priority">
          {esc.reason}
          <Cites ids={esc.evidence} />
        </Notice>
      )}

      <Row label="Current status" text={o.current_status.text} cites={o.current_status.evidence} />
      <Row label="Primary driver" text={`${o.primary_driver.red_flag ? `${o.primary_driver.red_flag}: ` : ''}${o.primary_driver.text}`} cites={o.primary_driver.evidence} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What changed</p>
        <ul className="mt-2 space-y-2">
          {o.what_changed.map((w) => (
            <li key={w.text} className="text-sm leading-snug text-foreground">
              {w.text}
              <Cites ids={w.evidence} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended action</p>
        <p className="mt-1 text-sm font-medium text-foreground">{action?.label ?? o.recommended_action.action_code}</p>
        {o.recommended_action.secondary.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Also: {o.recommended_action.secondary.map((c) => ACTION_BY_CODE[c]?.label ?? c).join('; ')}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical narrative</p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">{o.clinical_narrative.text}</p>
        <Cites ids={o.clinical_narrative.evidence} />
      </div>

      <p className="text-sm text-foreground"><span className="font-medium">Why now: </span>{o.why_now}</p>
      {o.for_tvn_consideration && (
        <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">For TVN consideration: </span>{o.for_tvn_consideration}</p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onFlag} disabled={review.flaggedWrong}>
          <Flag className={cn('mr-2 h-4 w-4', review.flaggedWrong && 'text-destructive')} />
          {review.flaggedWrong ? 'Flagged as factually wrong' : 'Flag as factually wrong'}
        </Button>
        <span className="text-xs text-muted-foreground">Clinician judgement always applies. Patient: {patient.tvnPriority}.</span>
      </div>
    </div>
  );
}

function Row({ label, text, cites }: { label: string; text: string; cites: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-snug text-foreground">{text}</p>
      <Cites ids={cites} />
    </div>
  );
}
