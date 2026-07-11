/**
 * UX-COMPOSER-005 (#831) / QUOTE-FORGE-002 (#842) — the shared cross-room
 * callback persisted-ref contract (pure TS).
 *
 * This module is the SINGLE SOURCE OF TRUTH for what a "woven callback" lands
 * in the persisted argument row. #831 (composer side) WRITES it; #842 (render
 * side) READS it via this same module, so the write/read shape cannot drift.
 *
 * Orchestrator ruling R1: the ref lives at
 * `arguments.client_validation.crossRoomCallback` — a namespaced key on the
 * existing permissive `z.record(z.unknown())` passthrough that
 * submit-argument stores verbatim (index.ts:368) and argumentsApi reads back
 * as `clientValidation`. This is the ONLY client-writable channel that lands
 * verbatim in the persisted row with NO Edge change and keeps the excerpt a
 * SEPARATE field from `body`. The engine never reads `client_validation`, so
 * the ref is advisory metadata only: it is not `target_excerpt`, not a rule
 * input, and can neither earn nor suppress factual standing (doctrine 1-3).
 *
 * Ruling R2: the join key is `targetDebateId` (NOT a link id) — the link is
 * created AFTER the move posts, so its id is unknown at ref-write time, while
 * `targetDebateId` is known at capture time and uniquely identifies the one
 * QOL-042 link per target room.
 *
 * Ruling R3: the excerpt is author-republished speech in a broadly-readable
 * JSONB column. Any render-time suppression of it (see callbackEchoModel) is a
 * UX-consistency treatment, NOT an RLS / privacy boundary — this module makes
 * no access decision and stores no access state.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

/** Max length of the echoed excerpt — clamped on write and on read. */
export const MAX_CALLBACK_EXCERPT_CHARS = 240;
/** Max length of the prior-room title snapshot — clamped on write and on read. */
export const MAX_CALLBACK_TITLE_SNAPSHOT_CHARS = 200;

/** The reserved key inside `client_validation`. */
export const CROSS_ROOM_CALLBACK_KEY = 'crossRoomCallback' as const;

/**
 * The value held on the composer draft while composing (before send). It is
 * captured from a prior room the weaver legitimately read; it becomes a
 * `CrossRoomCallbackRef` at submit time.
 */
export interface CrossRoomCallback {
  /** The PRIOR settled room this callback echoes. The #842 join key. */
  targetDebateId: string;
  /** The prior room title, snapshotted at capture time. */
  targetTitleSnapshot: string;
  /** The EXACT prior line, verbatim from a move the weaver read. */
  excerpt: string;
  /** The prior-room argument id the excerpt came from (future deep-link). */
  capturedFromArgumentId: string | null;
}

/**
 * The exact object stored at `arguments.client_validation.crossRoomCallback`.
 * Advisory, non-blocking. Versioned with a literal `v: 1` schema tag so the
 * read adapter can validate and forward-compat.
 */
export interface CrossRoomCallbackRef {
  /** The prior room echoed — #842 resolves its QOL-042 link by this id. */
  targetDebateId: string;
  /** The exact echoed prior line, snapshotted at weave time. */
  excerpt: string;
  /** Prior-room title snapshot — a title-only fallback + origin label seed. */
  targetTitleSnapshot: string;
  /** Prior-room argument id of the echoed move (future move-level deep-link). */
  capturedFromArgumentId?: string | null;
  /** Schema tag for forward-compat / adapter validation. Literal 1. */
  v: 1;
}

/** Trim + clamp an excerpt to the persisted ceiling. Pure. */
function clampExcerpt(raw: unknown): string {
  return String(raw ?? '').trim().slice(0, MAX_CALLBACK_EXCERPT_CHARS);
}

/** Trim + clamp a title snapshot to the persisted ceiling. Pure. */
function clampTitle(raw: unknown): string {
  return String(raw ?? '').trim().slice(0, MAX_CALLBACK_TITLE_SNAPSHOT_CHARS);
}

/**
 * Returns a NEW `client_validation` object with the callback ref merged in
 * under `crossRoomCallback`. Never mutates the input object. Existing keys
 * (e.g. QOL-037 `evidenceResponse`, EV-002 `attachedEvidence`) are preserved.
 * Pure.
 */
export function writeCrossRoomCallback(
  clientValidation: Record<string, unknown> | undefined,
  callback: CrossRoomCallback,
): Record<string, unknown> {
  return {
    ...(clientValidation ?? {}),
    [CROSS_ROOM_CALLBACK_KEY]: {
      targetDebateId: String(callback.targetDebateId ?? ''),
      excerpt: clampExcerpt(callback.excerpt),
      targetTitleSnapshot: clampTitle(callback.targetTitleSnapshot),
      capturedFromArgumentId: callback.capturedFromArgumentId ?? null,
      v: 1 as const,
    },
  };
}

/**
 * Extracts + validates a `CrossRoomCallbackRef` from a `client_validation`
 * blob, or returns `null`. Never throws. Returns the ref only when the blob is
 * an object, carries a `crossRoomCallback` object with `v === 1`, a non-empty
 * string `targetDebateId`, and a string `excerpt`. Clamps excerpt / title on
 * read too (defensive). Pure.
 */
export function readCrossRoomCallback(clientValidation: unknown): CrossRoomCallbackRef | null {
  if (!clientValidation || typeof clientValidation !== 'object') return null;
  const raw = (clientValidation as Record<string, unknown>)[CROSS_ROOM_CALLBACK_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 1) return null;
  const targetDebateId = typeof rec.targetDebateId === 'string' ? rec.targetDebateId.trim() : '';
  if (targetDebateId.length === 0) return null;
  if (typeof rec.excerpt !== 'string') return null;
  const capturedFromArgumentId =
    typeof rec.capturedFromArgumentId === 'string' ? rec.capturedFromArgumentId : null;
  return {
    targetDebateId,
    excerpt: clampExcerpt(rec.excerpt),
    targetTitleSnapshot: clampTitle(rec.targetTitleSnapshot),
    capturedFromArgumentId,
    v: 1,
  };
}
