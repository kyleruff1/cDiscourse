/**
 * Typed client wrappers for Supabase Edge Functions.
 *
 * Rules:
 * - The mobile client must NEVER directly insert posted arguments into
 *   public.arguments. Use submitArgumentDraft for all argument submissions.
 * - processLanguageDraft must NOT be called automatically from ArgumentComposer
 *   or the submit flow. It is an explicit user-triggered action only.
 * - ANTHROPIC_API_KEY is never in client code or Expo env — server-only.
 */
import { supabase } from './supabase';
import type { ArgumentType, ArgumentSide, DisagreementAxis } from '../domain/constitution/types';
import type { SemanticRefereePacket } from '../features/semanticReferee';
import type { AcceptanceLevel } from '../features/concessions/acceptanceGradient';
import type { MoveReactionKind } from '../features/concessions/moveReactionModel';

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

/**
 * QOL-041 — one entry of the optional concession_items[] array on a
 * `respond` submission. Mirrors `ConcessionItemPayload` in
 * `src/features/concessions/concessionListModel.ts`.
 */
export interface ConcessionItemSubmitInput {
  ordinal: number;
  item_text: string;
}

/**
 * QOL-041 — one entry of the optional concession_acceptances[] array on
 * a `respond_to_concession` submission. Mirrors
 * `ConcessionAcceptancePayload` in
 * `src/features/concessions/respondToConcessionModel.ts`.
 *
 * Doctrine: `clarification_body` is REQUIRED when `acceptance_level !==
 * 'agree'`. The Edge Function rejects a missing clarification as a
 * `validation_failed` blocking error; the client model's `isPostable()`
 * prevents the submission entirely.
 */
export interface ConcessionAcceptanceSubmitInput {
  concession_item_id: string;
  acceptance_level: AcceptanceLevel;
  clarification_body: string;
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
  /**
   * QOL-041 — optional concession_items array. Present on a `respond`
   * move when the conceding party concedes at least one point. Cap of 8
   * items (mirrors `MAX_CONCESSION_ITEMS`). When absent or empty the
   * response is a pure refutation.
   */
  concession_items?: ConcessionItemSubmitInput[];
  /**
   * QOL-041 — optional concession_acceptances array. Present on a
   * `respond_to_concession` move; one entry per incoming concession
   * item being graded. The Edge Function inserts these rows in the
   * same call as the parent argument.
   */
  concession_acceptances?: ConcessionAcceptanceSubmitInput[];
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

// ─────────────────────────────────────────────────────────────────────────────
// process-language-draft
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessLanguageDraftPayload {
  debateId: string;
  debateResolution: string;
  debateDescription?: string;
  parentArgumentId?: string | null;
  parentArgumentBody?: string | null;
  /** 'transcript' = rough spoken text. 'typed_draft' = typed input. */
  sourceKind: 'typed_draft' | 'transcript';
  /** Raw text to process. Max 8 000 chars. */
  rawText: string;
  userSide?: 'affirmative' | 'negative' | 'neutral';
  currentDraft?: {
    argumentType?: string | null;
    selectedTagCodes?: string[];
    targetExcerpt?: string | null;
    disagreementAxis?: string | null;
  };
  deterministicTopicCheck?: unknown;
  deterministicFlags?: unknown[];
}

export interface ProcessLanguageDraftDisabled {
  enabled: false;
  reason: string;
}

export interface ProcessLanguageDraftResult {
  enabled: true;
  cleanedText: string;
  suggestedArgumentType: string | null;
  suggestedTagCodes: string[];
  suggestedDisagreementAxis: string | null;
  targetExcerptCandidates: string[];
  possibleFlags: string[];
  transcriptIssues: string[];
  topicRelation: {
    respondsToResolution: boolean;
    respondsToParent: boolean | null;
    score: number;
    shortExplanation: string;
  };
  tone: {
    civilityRisk: boolean;
    loadedLanguagePossible: boolean;
    shortExplanation: string;
  };
  uncertaintyLevel: 'low' | 'medium' | 'high';
  /** Always true — the user must review all suggestions before submitting. */
  userReviewRequired: true;
  provider: string;
  model: string;
}

export type ProcessLanguageDraftOutcome =
  | ProcessLanguageDraftDisabled
  | ProcessLanguageDraftResult;

export type ProcessLanguageDraftFunctionResult =
  | { ok: true; data: ProcessLanguageDraftOutcome }
  | { ok: false; error: { error: string }; status: number };

/**
 * Send a rough draft or transcript to the language-processing Edge Function.
 * Returns structured suggestions for user review.
 *
 * IMPORTANT: Do NOT call this automatically. It must only be triggered by an
 * explicit user action (e.g. tapping "Process draft"). The AI is advisory only —
 * the user must review and accept all suggestions before submitting an argument.
 */
export async function processLanguageDraft(
  payload: ProcessLanguageDraftPayload,
): Promise<ProcessLanguageDraftFunctionResult> {
  const { data, error } = await supabase.functions.invoke<ProcessLanguageDraftOutcome>(
    'process-language-draft',
    { body: payload },
  );

  if (error) {
    let errorBody: { error: string } = { error: 'network_error' };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as { error: string };
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

// ─────────────────────────────────────────────────────────────────────────────
// admin-users
//
// Privileged actions for the admin tab. The client never holds service keys —
// the Edge Function verifies the JWT and checks profiles.role = 'admin'
// before performing any action.
// ─────────────────────────────────────────────────────────────────────────────

export type AdminUsersAction =
  | 'list_users'
  | 'get_user_detail'
  | 'create_user'
  | 'create_bot_user'
  | 'update_role'
  | 'invite_user'
  | 'send_password_reset'
  | 'set_temporary_password'
  | 'disable_user'
  | 'enable_user'
  | 'soft_delete_user'
  | 'list_blocks'
  | 'add_block'
  | 'remove_block'
  | 'view_as_snapshot'
  // ADMIN-AI-001 — semantic-referee runtime provider-mode config.
  | 'get_semantic_config'
  | 'set_semantic_config';

/**
 * ADMIN-AI-001 — the semantic-referee runtime provider-mode config, as the
 * `admin-users` `get_semantic_config` action returns it.
 *
 * `anthropicKeyPresent` is a boolean ONLY — the ANTHROPIC_API_KEY value is
 * NEVER carried in this shape (doctrine constraint #2). It tells the admin
 * whether switching to `anthropic` will reach the live provider.
 */
export interface SemanticRefereeConfigView {
  /** The four config slots; `mcp` is reserved (MCP-018) and not settable. */
  providerMode: 'anthropic' | 'mock' | 'fixture' | 'mcp';
  enabled: boolean;
  updatedAt: string | null;
  /** The admin who last changed the config — a display name, never an email. */
  updatedByDisplayName: string | null;
  /** Boolean ONLY — never the key value. */
  anthropicKeyPresent: boolean;
}

/**
 * ADMIN-AI-001 — the `set_semantic_config` action input.
 *
 * `providerMode` excludes `mcp` — the slot is reserved for MCP-018.
 * `confirmAnthropic` must be `true` to switch to `anthropic`; the Edge
 * Function's zod `.refine()` is the server-side wall.
 */
export interface SetSemanticRefereeConfigInput {
  providerMode: 'anthropic' | 'mock' | 'fixture';
  enabled: boolean;
  reason?: string;
  confirmAnthropic?: boolean;
}

export interface AdminUsersRequest {
  action: AdminUsersAction;
  [key: string]: unknown;
}

export interface AdminUsersError {
  error: string;
  reason?: string;
  detail?: string;
  issues?: Array<{ path?: (string | number)[]; message: string }>;
}

export type AdminUsersResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: AdminUsersError; status: number };

export async function adminUsers<T = unknown>(payload: AdminUsersRequest): Promise<AdminUsersResult<T>> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', { body: payload });

  if (error) {
    let errorBody: AdminUsersError = { error: 'network_error' };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as AdminUsersError;
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

// ─────────────────────────────────────────────────────────────────────────────
// request-argument-deletion (Stage 6.1.8)
//
// Users can REQUEST deletion of their own argument. Admins resolve. No row
// in public.arguments is auto-deleted by this function — it only records the
// request and (optionally) sends an admin notification email.
//
// The function never returns admin email addresses. The client never sees
// service-role keys, provider API keys, or full JWTs.
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestArgumentDeletionPayload {
  debateId: string;
  argumentId: string;
  reason?: string | null;
}

export interface RequestArgumentDeletionResult {
  requestId: string;
  status: 'requested' | 'reviewing' | 'approved' | 'rejected' | 'cancelled';
  emailStatus: 'sent' | 'not_configured' | 'failed_sanitized';
  userReviewRequired: true;
}

export type RequestArgumentDeletionOutcome =
  | { ok: true; data: RequestArgumentDeletionResult }
  | { ok: false; error: { error: string; reason?: string; detail?: string }; status: number };

export async function requestArgumentDeletion(
  payload: RequestArgumentDeletionPayload,
): Promise<RequestArgumentDeletionOutcome> {
  const { data, error } = await supabase.functions.invoke<RequestArgumentDeletionResult>(
    'request-argument-deletion',
    { body: payload },
  );
  if (error) {
    let errorBody: { error: string; reason?: string; detail?: string } = { error: 'network_error' };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) errorBody = (await raw.json()) as { error: string; reason?: string; detail?: string };
    } catch { /* ignore */ }
    const status =
      (error as { status?: number }).status ??
      ((error as { name?: string }).name === 'FunctionsFetchError' ? 503 : 500);
    return { ok: false, error: errorBody, status };
  }
  if (!data) return { ok: false, error: { error: 'empty_response' }, status: 500 };
  return { ok: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// semantic-referee (MCP-016)
//
// Sends a redacted move + room context to the semantic-referee Edge Function
// and returns advisory classification metadata. The boundary is MOCK-ONLY in
// MCP-016 — the deterministic `mock` / `fixture` providers; no live AI.
//
// IMPORTANT: `{ enabled: false }` is a NORMAL, EXPECTED outcome — it is the
// default state of the whole feature (disabled-by-default). The caller treats
// `{ enabled: false }` AND any error identically: fall back to the
// deterministic layer-1 result and show NO error to the user.
//
// Boundary-only Node types live HERE (not a new file) per roadmap §6
// reconciliation 1 — the canonical packet type is imported from
// src/features/semanticReferee (MCP-011-owned). The Deno-side mirror is
// supabase/functions/_shared/semanticReferee/types.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Room / context the boundary needs to interpret a move. */
export interface ClassifyMoveRoomContext {
  /** GAME-003 room mode code. */
  debateMode?: string;
  /** Quick-action preset the user picked. */
  selectedAction?: string;
  /** Declared argumentType. */
  selectedMoveType?: string;
  side?: 'affirmative' | 'negative' | 'observer' | 'moderator';
  actorRole?: 'initiator' | 'primary_opponent' | 'chime_in' | 'observer';
}

/**
 * MCP-MOD-008 — one entry of the optional `priorMovesRedacted` thread context.
 *
 * Each entry carries a STABLE, NON-IDENTIFYING author alias (`'A'`, `'B'`,
 * `'C'`, derived deterministically from chronological order of distinct
 * authors in the room) and the prior move's body, ALREADY redacted by the
 * caller. The Edge Function runs a defensive second redaction pass over each
 * `bodyRedacted` before any provider sees it. The alias map is local to the
 * classify call; no user id, no display name, no email crosses the boundary.
 *
 * Bounded: `authorAlias` <= 8 chars; `bodyRedacted` <= MOVE_BODY_MAX (8000).
 * The schema rejects entries that smuggle a verdict / person label.
 */
export interface PriorMoveContext {
  /** Stable, non-identifying alias for the author. NEVER a user id, NEVER a display name. */
  authorAlias: string;
  /** The move body, already client-redacted. <= MOVE_BODY_MAX chars. */
  bodyRedacted: string;
}

/**
 * Inbound request to the semantic-referee Edge Function. Bodies MUST be
 * redacted before calling this wrapper; the function runs a defensive second
 * redaction pass. The request carries no `block` field, no truth field — there
 * is nothing in the shape that can ask the model for a verdict.
 *
 * MCP-MOD-008: `priorMovesRedacted` is OPTIONAL. Existing callers (smoke-test
 * orchestrator, fixtures) that do not send it continue to work unchanged —
 * the function falls back to the pre-MCP-MOD-008 payload shape (just move +
 * parent). When present, every prior move's body is redacted at the boundary
 * too, and the seed prompt emits a thread-context block above the parent + move
 * blocks.
 */
export interface ClassifyMoveRequest {
  /** RLS-checked: the caller must be able to see this room. */
  roomId: string;
  /** Omitted for a pre-send draft. */
  moveId?: string;
  parentId?: string;
  /** 1..8000 chars. */
  moveBodyRedacted: string;
  /** <= 8000 chars. Absent for a root move. */
  parentBodyRedacted?: string;
  /**
   * MCP-MOD-008 — optional full-thread context for the classify call. When
   * present, every entry carries an alias-only author identification and an
   * already-redacted body. The function's defensive redaction pass runs over
   * each entry too. Order is chronological (oldest first); the budget gate
   * drops OLDEST first when over budget. Absent means the pre-MCP-MOD-008
   * payload shape (move + parent only) — the function behaves identically.
   */
  priorMovesRedacted?: ReadonlyArray<PriorMoveContext>;
  roomContext: ClassifyMoveRoomContext;
  /** 1..5 entries, each a SemanticClassifierId. */
  requestedClassifiers: string[];
  promptVersionHint?: string;
  /** Hash of moveBodyRedacted — non-empty. */
  contentHash: string;
}

/**
 * Reason a classify did not produce a packet. The first three are MCP-016's;
 * MCP-017's live `anthropic` provider adds the six live-provider failure
 * reasons (`key_missing` / `api_error` / `rate_limited` / `network_error` /
 * `parse_failure` / `validation_failed`). The caller treats every one of these
 * identically to `disabled`: fall back to the deterministic layer-1 result and
 * show NO error. This is the Node twin of the Deno `ClassifyMoveDisabledReason`
 * in `supabase/functions/_shared/semanticReferee/types.ts` — the two are kept
 * in lockstep.
 */
export type ClassifyMoveDisabledReason =
  | 'disabled'
  | 'not_configured'
  | 'not_implemented'
  | 'key_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

/**
 * Outbound classify outcome. `{ enabled: false }` is the default state of the
 * whole feature, NOT an error.
 */
export type ClassifyMoveOutcome =
  | { enabled: false; reason: ClassifyMoveDisabledReason }
  | { enabled: true; packet: SemanticRefereePacket };

export type ClassifyMoveFunctionResult =
  | { ok: true; data: ClassifyMoveOutcome }
  | { ok: false; error: { error: string }; status: number };

/**
 * Send a redacted move + context to the semantic-referee Edge Function.
 * Returns advisory classification metadata for the caller to reconcile.
 *
 * IMPORTANT: `{ enabled: false }` is a NORMAL, EXPECTED outcome — it is the
 * default state of the whole feature. The caller treats `{ enabled: false }`
 * AND any error identically: fall back to the deterministic layer-1 result,
 * show NO error to the user. Bodies MUST be redacted before calling this.
 *
 * The wrapper never throws.
 */
export async function classifyMove(
  payload: ClassifyMoveRequest,
): Promise<ClassifyMoveFunctionResult> {
  const { data, error } = await supabase.functions.invoke<ClassifyMoveOutcome>(
    'semantic-referee',
    { body: payload },
  );

  if (error) {
    let errorBody: { error: string } = { error: 'network_error' };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as { error: string };
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

// ─────────────────────────────────────────────────────────────────────────────
// react-to-move (QOL-041)
//
// The fist-bump (acknowledge) write path. JWT-verified, caller-scoped to the
// reactor, idempotent. Toggling off soft-deletes the row; toggling back on
// re-activates the soft-deleted row.
//
// Doctrine (QOL-041 §11):
//   - The fist-bump carries NO SCORE, NO STANDING CHANGE.
//   - The function returns a render-only summary
//     `{ fistBumpCount, viewerHasReacted }` — never a score, never a weight.
//   - The function never touches `public.arguments` and never touches any
//     standing path.
// ─────────────────────────────────────────────────────────────────────────────

export type ReactToMoveAction = 'add' | 'remove';

export interface ReactToMovePayload {
  action: ReactToMoveAction;
  debateId: string;
  argumentId: string;
  /**
   * QOL-041 — defaults to `'fist_bump'` (the only allowed kind in v1).
   * Adding any other kind would require a NEW migration AND a doctrine
   * review (v1 scope bans voting); the Edge Function rejects an unknown
   * kind with `invalid_kind`.
   */
  kind?: MoveReactionKind;
}

/**
 * The render-only summary the function returns alongside the active
 * reaction list. Mirrors `MoveReactionSummary` in
 * `src/features/concessions/moveReactionModel.ts`. No score field —
 * the shape itself guarantees the reaction never crosses into scoring.
 */
export interface ReactToMoveSummary {
  fistBumpCount: number;
  viewerHasReacted: boolean;
}

export interface ReactToMoveActiveRow {
  id: string;
  reactorId: string;
  kind: MoveReactionKind;
  createdAt: string;
}

export interface ReactToMoveSuccess {
  argumentId: string;
  summary: ReactToMoveSummary;
  activeReactions: ReactToMoveActiveRow[];
}

export type ReactToMoveOutcome =
  | { ok: true; data: ReactToMoveSuccess }
  | {
      ok: false;
      error: { error: string; reason?: string; detail?: string };
      status: number;
    };

/**
 * Add or remove a reaction (fist-bump) on a posted move. Idempotent —
 * re-adding an already-active row is a no-op success; removing an
 * absent row is a no-op success. Never throws.
 */
export async function reactToMove(
  payload: ReactToMovePayload,
): Promise<ReactToMoveOutcome> {
  const { data, error } = await supabase.functions.invoke<ReactToMoveSuccess>(
    'react-to-move',
    { body: payload },
  );
  if (error) {
    let errorBody: { error: string; reason?: string; detail?: string } = {
      error: 'network_error',
    };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as {
          error: string;
          reason?: string;
          detail?: string;
        };
      }
    } catch {
      /* ignore */
    }
    const status =
      (error as { status?: number }).status
      ?? ((error as { name?: string }).name === 'FunctionsFetchError' ? 503 : 500);
    return { ok: false, error: errorBody, status };
  }
  if (!data) return { ok: false, error: { error: 'empty_response' }, status: 500 };
  return { ok: true, data };
}

export function adminErrorMessage(err: AdminUsersError, status: number): string {
  if (status === 403 || err.error === 'forbidden') {
    return 'Admin access required.';
  }
  if (status === 401 || err.error === 'unauthorized') {
    return 'Sign in required.';
  }
  if (status === 404 || err.error === 'function_not_found') {
    return 'admin-users function is not deployed yet.';
  }
  if (err.detail) return err.detail;
  if (err.reason) return err.reason;
  return err.error;
}
