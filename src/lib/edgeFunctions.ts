/**
 * Typed client wrappers for Supabase Edge Functions.
 *
 * The mobile client must NEVER directly insert posted arguments into
 * public.arguments. Use submitArgumentDraft for all argument submissions.
 */
import { supabase } from './supabase';
import type { ArgumentType, ArgumentSide, DisagreementAxis } from '../domain/constitution/types';

// ── Request / response types ──────────────────────────────────

export interface EvidenceAttachmentInput {
  url?: string;
  label?: string;
  source_text?: string;
}

export interface ArgumentTargetInput {
  target_excerpt?: string;
  disagreement_axis?: DisagreementAxis;
  concession_scope?: string;
  user_stated_uncertainty?: boolean;
}

export interface SubmitArgumentInput {
  debate_id: string;
  parent_id?: string | null;
  argument_type: ArgumentType;
  side: ArgumentSide;
  body: string;
  selected_tag_codes: string[];
  attached_evidence?: EvidenceAttachmentInput[];
  target?: ArgumentTargetInput;
  client_validation?: Record<string, unknown>;
  /** Client-generated UUID (from PendingSubmission.clientSubmissionId). Same UUID on retry returns existing argument without re-inserting. */
  client_submission_id?: string;
}

export interface SubmitArgumentValidation {
  allowPost: boolean;
  blockingErrors: Array<{
    ruleCode: string;
    flagCode: string;
    severity: string;
    message: string;
    payload: Record<string, unknown>;
  }>;
  warnings: Array<{
    ruleCode: string;
    flagCode: string;
    severity: string;
    message: string;
    payload: Record<string, unknown>;
  }>;
  normalizedTags: string[];
  serverValidationPayload?: Record<string, unknown>;
}

export interface SubmitArgumentSuccess {
  argument: Record<string, unknown>;
  tags: unknown[];
  topic_satisfaction_check: unknown;
  flags: unknown[];
  validation: SubmitArgumentValidation;
}

export interface SubmitArgumentError {
  error: string;
  blockingErrors?: SubmitArgumentValidation['blockingErrors'];
  warnings?: SubmitArgumentValidation['warnings'];
  topicSatisfactionCheck?: unknown;
  normalizedTags?: string[];
  reason?: string;
}

export type SubmitArgumentResult =
  | { ok: true; data: SubmitArgumentSuccess }
  | { ok: false; error: SubmitArgumentError; status: number };

// ── Function wrapper ──────────────────────────────────────────

/**
 * Submit an argument draft through the authoritative Edge Function.
 *
 * The Edge Function validates, runs the rules engine, and — if allowed —
 * inserts the argument as status='posted'. Do not insert posted arguments
 * directly via supabase.from('arguments').
 */
export async function submitArgumentDraft(
  payload: SubmitArgumentInput,
): Promise<SubmitArgumentResult> {
  const { data, error } = await supabase.functions.invoke<SubmitArgumentSuccess>('submit-argument', {
    body: payload,
  });

  if (error) {
    // FunctionsHttpError carries a .context with the response body
    let errorBody: SubmitArgumentError = { error: 'network_error' };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as SubmitArgumentError;
      }
    } catch {
      // ignore parse failures
    }
    const status =
      (error as { status?: number }).status ??
      ((error as { name?: string }).name === 'FunctionsFetchError' ? 503 : 500);
    return { ok: false, error: errorBody, status };
  }

  if (!data) {
    return { ok: false, error: { error: 'empty_response' }, status: 500 };
  }

  return { ok: true, data };
}
