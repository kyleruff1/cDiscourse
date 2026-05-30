/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Structured-log helper for the
 * auto-trigger dispatcher.
 *
 * Isolated for test clarity (the dispatcher's source-scan tests target
 * this helper to verify the log payload contains only safe fields).
 *
 * Doctrine:
 *   - cdiscourse-doctrine §6: NEVER logs Authorization / Bearer / secrets
 *     / service-role / Anthropic / MCP token values. The log builder
 *     accepts only sanitized, structural fields.
 *   - cdiscourse-doctrine §1 + §10a: log fields describe RUN OUTCOMES
 *     (triggered / skipped / already_classified / failed); they NEVER
 *     surface model verdicts, raw rawKeys, model prompts, or response
 *     bodies.
 *
 * The single emit function uses `console.info` (visible in Supabase Edge
 * Function logs). Inside the dispatcher, this is the ONLY console call.
 */

import type {
  BooleanObservationFailureSubreason,
  BooleanObservationFailureDetail,
} from './booleanObservationFailureSubreason.ts';

export type AutoTriggerOutcome =
  | 'triggered'
  | 'skipped'
  | 'already_classified'
  | 'failed';

/**
 * Structured log fields. Every field is sanitized / shape-checked at the
 * call site. Per intent brief Decision 9.
 */
export interface AutoTriggerLogFields {
  /** ISO-8601 timestamp captured at emit time. */
  timestamp: string;
  /** Full argument UUID. Safe — argument IDs are public via Source 6. */
  argument_id: string;
  /**
   * Always the string `'submit_argument_auto_trigger'` for this card.
   * A future Family B-J card MAY add new sources; the rendering layer
   * branches on this token.
   */
  trigger_source: 'submit_argument_auto_trigger';
  /** The outcome enum. */
  outcome: AutoTriggerOutcome;
  /** Set when `outcome === 'skipped'`. */
  skip_reason?: 'config_disabled' | 'family_not_enabled' | 'argument_not_found';
  /** Set when a run row was written (success OR failed). */
  run_id?: string;
  /** Set when `outcome === 'failed'`. Stable failure_reason strings. */
  failure_reason?: string;
  /**
   * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1): the typed
   * adapter-failure sub-reason, supplementary to `failure_reason` (the
   * run row's `failure_reason` is unchanged). ADDITIVE / optional.
   */
  failure_sub_reason?: BooleanObservationFailureSubreason;
  /**
   * The bounded, sanitized adapter-failure detail (allowlisted structural
   * fields only — never a body/prompt/raw response/secret). ADDITIVE /
   * optional.
   */
  failure_detail?: BooleanObservationFailureDetail;
  /** 1-based attempt count, including the first attempt. */
  attempt_number?: number;
  /** Wall time from invocation to outcome, in milliseconds. */
  latency_ms?: number;
}

/**
 * Emit a structured log line. The only console call inside the
 * dispatcher tree. Never re-throws.
 */
export function emitAutoTriggerLog(fields: AutoTriggerLogFields): void {
  try {
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({ event: 'mcp_021c_auto_trigger', ...fields }));
  } catch {
    // Defensive: never let a log-stringify failure propagate.
  }
}
