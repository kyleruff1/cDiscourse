/**
 * META-001 — Manual tag model internals (pure TypeScript).
 *
 * Owns:
 *   - The static `MANUAL_TAG_ELIGIBILITY_TABLE` — who can apply which tag.
 *   - `isApplyAllowed(code, eligibility)` — pure boolean check.
 *   - `getManualTagEligibility(code)` — typed lookup.
 *   - `makeManualTagDedupeKey(code, userId)` — stable dedupe key.
 *
 * Doctrine: manual tags are participant gameplay annotations. Observers
 * may NEVER apply tags in v1. Own-bubble may apply only the three
 * intent-style tags (`concession_offered`, `narrowed_claim`,
 * `ready_for_synthesis`). Admins may apply all 10 for moderation review.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation.
 */

import type {
  EligibilityContext,
  ManualTagCode,
  ManualTagEligibilityRecord,
} from './moveMetadataLedger';

// ── Eligibility matrix ────────────────────────────────────────

/**
 * Per design §"Manual tag vocabulary" — the static table. Observers may
 * NEVER apply tags; own-bubble allows only `concession_offered`,
 * `narrowed_claim`, `ready_for_synthesis`; admins may apply all 10.
 *
 * This is the single source of truth for tag-application eligibility; the
 * `moveMetadataLedger.ts` re-export `MANUAL_TAG_ELIGIBILITY` aliases
 * this constant.
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

// ── Helpers ───────────────────────────────────────────────────

/**
 * Typed lookup for the eligibility record of a manual tag code. Pure.
 */
export function getManualTagEligibility(code: ManualTagCode): ManualTagEligibilityRecord {
  return MANUAL_TAG_ELIGIBILITY_TABLE[code];
}

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

/**
 * Stable dedupe key for a manual tag application. `${code}:${applierUserId}`.
 * The same applier cannot apply the same code twice (idempotent); different
 * appliers produce different keys.
 */
export function makeManualTagDedupeKey(
  code: ManualTagCode,
  applierUserId: string,
): string {
  return `${code}:${applierUserId}`;
}
