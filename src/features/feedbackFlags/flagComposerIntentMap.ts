/**
 * UX-FLAGS-004 (#836) — Flag intent to composer preset bridge (pure TypeScript).
 *
 * Layer 2 over the UX-FLAGS-001 (#833) friendlyFlagMap descriptors. Each
 * FriendlyFlag already declares `actionable` + `composerIntent` (Layer 1, the
 * single source of truth for WHICH flags are actionable and WHAT abstract intent
 * they carry). This module maps the abstract `composerIntent` code to the shipped
 * `QuickActionLabel` whose `quickActionToPreset(...)` produces the seeded
 * MoveDraftPatch, and DERIVES actionability straight from the descriptor so the
 * two layers can never drift (asserted by flagComposerIntentMap.test.ts, both
 * directions).
 *
 * Doctrine anchors (cdiscourse-doctrine):
 *  - Section 1  the flag is advisory; the intent it opens is the USER draft,
 *        never a verdict, never a claim that the machine flag is authoritative.
 *  - Section 3  Family D flags map to `ask_for_source` whose body uses source /
 *        receipt language, never a standing claim; `neverGrantsStanding` rides
 *        through untouched (this module reads descriptors, never mutates them).
 *  - Section 9  the intent codes are internal; never user-facing.
 *
 * Pure TS. No React. No Supabase. No network. No side effects. Deterministic,
 * JSON-serializable in and out — same constraints as friendlyFlagMap.ts.
 */

import { FRIENDLY_FLAG_DESCRIPTORS, type FriendlyFlag, type FriendlyFlagKey } from './friendlyFlagMap';
import type { QuickActionLabel } from '../arguments/quickActionPresets';

/**
 * The closed set of abstract composer-intent codes a FriendlyFlag may carry.
 * MUST equal exactly the set of non-null `composerIntent` values present in
 * FRIENDLY_FLAG_DESCRIPTORS (enforced by the cross-coverage manifest test —
 * flagComposerIntentMap.test.ts — so the two never drift). Never user-facing.
 */
export type ComposerIntentCode =
  | 'ask_for_source'
  | 'ask_clarify'
  | 'answer_question'
  | 'propose_synthesis'
  | 'sharpen_claim';

/**
 * Abstract intent to the shipped QuickActionLabel whose quickActionToPreset(...)
 * produces the seeded MoveDraftPatch. `ask_for_source` / `propose_synthesis`
 * REUSE existing labels (source / synthesize) so their preset bodies
 * (ASK_SOURCE_PRESET_BODY / SYNTHESIZE_PRESET_BODY) are not re-authored. The
 * other three point at labels this card adds to quickActionPresets.ts.
 */
export const FLAG_INTENT_TO_QUICK_ACTION: Readonly<Record<ComposerIntentCode, QuickActionLabel>> =
  Object.freeze({
    ask_for_source: 'source',
    ask_clarify: 'ask_clarify',
    answer_question: 'answer_question',
    propose_synthesis: 'synthesize',
    sharpen_claim: 'sharpen_claim',
  });

/** Every ComposerIntentCode, frozen — for the cross-coverage manifest test. */
export const ALL_COMPOSER_INTENT_CODES: ReadonlyArray<ComposerIntentCode> = Object.freeze(
  Object.keys(FLAG_INTENT_TO_QUICK_ACTION) as ComposerIntentCode[],
);

export interface ResolvedFlagIntent {
  intent: ComposerIntentCode;
  quickAction: QuickActionLabel;
}

/** True iff `value` is a known ComposerIntentCode (defensive; never throws). */
export function isComposerIntentCode(value: unknown): value is ComposerIntentCode {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(FLAG_INTENT_TO_QUICK_ACTION, value)
  );
}

/**
 * Resolve a descriptor to its concrete composer dispatch, or null when the flag
 * is not actionable / carries no known intent. DERIVES actionability from the
 * #833 descriptor (`flag.actionable` + `flag.composerIntent`) — this module
 * NEVER re-declares which flags are actionable (single source of truth = #833).
 */
export function resolveFlagComposerIntent(flag: FriendlyFlag): ResolvedFlagIntent | null {
  if (!flag || flag.actionable !== true) return null;
  const intent = flag.composerIntent;
  if (!isComposerIntentCode(intent)) return null;
  return Object.freeze({ intent, quickAction: FLAG_INTENT_TO_QUICK_ACTION[intent] });
}

/** Convenience for the pill, which only holds the VM id (= FriendlyFlagKey). */
export function flagIntentForKey(key: FriendlyFlagKey | string): ResolvedFlagIntent | null {
  const descriptor = (FRIENDLY_FLAG_DESCRIPTORS as Record<string, FriendlyFlag | undefined>)[
    key as string
  ];
  if (!descriptor) return null;
  return resolveFlagComposerIntent(descriptor);
}
