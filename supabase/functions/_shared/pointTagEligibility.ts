/**
 * META-1A — Deno-side mirror of META-001's manual-tag eligibility table.
 *
 * MIRROR of src/features/metadata/manualTagModel.ts — keep byte-identical.
 * Verified by __tests__/pointTagsEligibilityMirror.test.ts.
 *
 * Why this file exists: Edge Functions run on Deno with a separate module
 * graph and cannot import from `src/`. The `apply-manual-tag` Edge Function
 * must enforce the SAME eligibility rule META-001 modeled client-side, so
 * the table + `isApplyAllowed` are mirrored here exactly. This is the same
 * pattern `_shared/adminSchemas.ts` follows for the client zod schemas.
 *
 * Doctrine: manual tags are participant gameplay annotations. Observers may
 * NEVER apply tags in v1. Own-bubble may apply only the three intent-style
 * tags (`concession_offered`, `narrowed_claim`, `ready_for_synthesis`).
 * Admins may apply all 10 for moderation review.
 *
 * Pure TS. No Deno API, no Supabase, no network, no async, no mutation.
 */

// ── Manual tag vocabulary ─────────────────────────────────────

/**
 * META-001 — the locked 10-code manual-tag vocabulary. Each value is a
 * gameplay signal that marks a move's state, never a ruling on a person
 * and never a factual assertion.
 */
export type ManualTagCode =
  | 'needs_source'
  | 'needs_quote'
  | 'definition_issue'
  | 'scope_issue'
  | 'causal_mechanism'
  | 'evidence_debt'
  | 'concession_offered'
  | 'narrowed_claim'
  | 'tangent'
  | 'ready_for_synthesis';

/** Frozen array of every manual tag code. */
export const ALL_MANUAL_TAG_CODES: ReadonlyArray<ManualTagCode> = Object.freeze([
  'needs_source',
  'needs_quote',
  'definition_issue',
  'scope_issue',
  'causal_mechanism',
  'evidence_debt',
  'concession_offered',
  'narrowed_claim',
  'tangent',
  'ready_for_synthesis',
]);

// ── Eligibility matrix ────────────────────────────────────────

export interface ManualTagEligibilityRecord {
  /** True when the applier is the author of the message. */
  allowOnOwnBubble: boolean;
  /** True when the applier is a participant on a non-own bubble. */
  allowOnOtherBubble: boolean;
  /** True when the applier is an observer. v1: always false. */
  allowObserver: boolean;
  /** True when the applier is an admin. */
  allowAdmin: boolean;
}

/**
 * Eligibility matrix for manual-tag application. Byte-mirrored from
 * src/features/metadata/manualTagModel.ts `MANUAL_TAG_ELIGIBILITY_TABLE`.
 * Observers may NEVER apply tags; own-bubble allows only
 * `concession_offered`, `narrowed_claim`, `ready_for_synthesis`; admins may
 * apply all 10.
 */
export const MANUAL_TAG_ELIGIBILITY_TABLE: Readonly<Record<ManualTagCode, ManualTagEligibilityRecord>> =
  Object.freeze({
    needs_source: Object.freeze({
      allowOnOwnBubble: false,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    needs_quote: Object.freeze({
      allowOnOwnBubble: false,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    definition_issue: Object.freeze({
      allowOnOwnBubble: false,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    scope_issue: Object.freeze({
      allowOnOwnBubble: false,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    causal_mechanism: Object.freeze({
      allowOnOwnBubble: false,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    evidence_debt: Object.freeze({
      allowOnOwnBubble: false,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    concession_offered: Object.freeze({
      allowOnOwnBubble: true,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    narrowed_claim: Object.freeze({
      allowOnOwnBubble: true,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    tangent: Object.freeze({
      allowOnOwnBubble: false,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
    ready_for_synthesis: Object.freeze({
      allowOnOwnBubble: true,
      allowOnOtherBubble: true,
      allowObserver: false,
      allowAdmin: true,
    }),
  });

// ── Applier eligibility context ───────────────────────────────

export type ManualTagActorRole =
  | 'participant_affirmative'
  | 'participant_negative'
  | 'observer'
  | 'admin';

export interface EligibilityContext {
  /** The viewer applying the tag. */
  applierUserId: string;
  /** The viewer's role on this room. */
  applierActorRole: ManualTagActorRole;
  /** True when the target argument is the applier's own bubble. */
  isOwnBubble: boolean;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Pure helper. Returns true when an apply attempt would be allowed given
 * the static eligibility table + the runtime context (actor role +
 * own-bubble flag).
 *
 * Rules per design:
 *   - Observer applier → always false.
 *   - Admin applier → always true (admins may apply all 10 codes).
 *   - Participant applier on own bubble → consult `allowOnOwnBubble`.
 *   - Participant applier on other bubble → consult `allowOnOtherBubble`.
 */
export function isApplyAllowed(
  code: ManualTagCode,
  eligibility: EligibilityContext,
): boolean {
  const record = MANUAL_TAG_ELIGIBILITY_TABLE[code];
  if (!record) return false;
  if (eligibility.applierActorRole === 'observer') {
    return record.allowObserver;
  }
  if (eligibility.applierActorRole === 'admin') {
    return record.allowAdmin;
  }
  // Participant — affirmative or negative.
  if (eligibility.isOwnBubble) {
    return record.allowOnOwnBubble;
  }
  return record.allowOnOtherBubble;
}
