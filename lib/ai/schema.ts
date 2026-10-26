import { z } from 'zod';
import type { AIOutput } from './types';

// Strict structural validation of the model's JSON. Unknown keys are rejected, every string is
// length-capped, and evidence IDs must be short identifiers, so a malformed or padded response
// cannot pass. Semantic checks (floor, grounding, scope...) live in guardrails.ts.

const evidenceId = z.string().regex(/^[A-Za-z0-9_\-]{1,24}$/);
const evidence = z.array(evidenceId).max(12);
const text = (max: number) => z.string().min(1).max(max);

const cited = (max: number) => z.object({ text: text(max), evidence }).strict();

export const AIOutputSchema = z
  .object({
    current_status: cited(300),
    overall_risk: z
      .object({
        final_priority: z.enum(['SEE_TODAY', 'SEE_THIS_WEEK', 'MONITOR', 'HEALING']),
        rule_priority: z.enum(['SEE_TODAY', 'SEE_THIS_WEEK', 'MONITOR', 'HEALING']),
        ai_escalation: z
          .object({
            to_priority: z.enum(['SEE_TODAY', 'SEE_THIS_WEEK', 'MONITOR', 'HEALING']),
            reason: text(400),
            evidence,
          })
          .strict()
          .nullable(),
      })
      .strict(),
    primary_driver: z.object({ text: text(300), red_flag: z.string().regex(/^RF-0[1-8]$/).nullable(), evidence }).strict(),
    what_changed: z.array(cited(300)).min(1).max(4),
    recommended_action: z
      .object({
        action_code: z.string().regex(/^[A-Z0-9_]{3,64}$/),
        timeframe: z.string().max(32),
        secondary: z.array(z.string().regex(/^[A-Z0-9_]{3,64}$/)).max(2),
      })
      .strict(),
    clinical_narrative: cited(1500),
    why_now: text(300),
    summary: cited(260),
    priority_factors: z.array(z.object({ factor: text(60), text: text(300), evidence }).strict()).min(1).max(6),
    for_tvn_consideration: z.string().min(1).max(300).nullable(),
  })
  .strict();

export type ParseResult = { ok: true; value: AIOutput } | { ok: false; detail: string };

// Extracts the JSON object from the model text and validates its structure.
export function parseModelOutput(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 12_000) return { ok: false, detail: 'empty or oversized response' };
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return { ok: false, detail: 'response was not valid JSON' };
  }
  const result = AIOutputSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, detail: `schema: ${issue.path.join('.') || 'root'} ${issue.message}`.slice(0, 160) };
  }
  return { ok: true, value: result.data as AIOutput };
}
