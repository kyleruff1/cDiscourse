/**
 * Stage 6.2 — Quick-action → composer preset mapping (Milestone 7).
 *
 * Pure. No React. No Supabase. Takes a sidecar/bubble quick action label
 * and the parent argument type, returns a typed MoveDraftPatch the
 * composer applies on mount. Never sets fields the user didn't ask for.
 *
 * EV-002 extension: source / quote / weak_source presets now also seed a
 * non-accusatory body (`ASK_SOURCE_PRESET_BODY` / `ASK_QUOTE_PRESET_BODY`
 * / `ASK_STRONGER_SOURCE_PRESET_BODY`) which the composer threads through
 * `handleMovePatch.body`. The user can edit the seeded body before
 * submitting. `inspect_receipt` is the popover's read-only affordance —
 * it returns null so no composer flow is opened.
 */
import type { ArgumentType } from '../../domain/constitution/types';
import type { MoveDraftPatch } from './conversationMoves';
import {
  ASK_QUOTE_PRESET_BODY,
  ASK_SOURCE_PRESET_BODY,
  ASK_STRONGER_SOURCE_PRESET_BODY,
} from '../evidence/sourceChainPresetCopy';

export type QuickActionLabel =
  | 'reply'
  | 'challenge'
  | 'source'
  | 'quote'
  | 'clarify'
  | 'evidence'
  | 'concede'
  | 'branch'
  | 'flag'
  | 'weak_source'
  | 'inspect_receipt'
  // SC-004 — three new "answer" presets used by the timeline node action dock.
  // EV-002 set the seed-body precedent for ask actions; SC-004 extends it
  // to the narrow / confirm / synthesize composer flows so the dock's
  // primary recommendation never drops the player into a blank composer.
  | 'narrow'
  | 'confirm'
  | 'synthesize';

/**
 * SC-004 — composer-seeded body for the `narrow` action. Neutral
 * scaffolding the user edits before posting. Non-accusatory; describes
 * the move shape, not the author. First-person + bracketed placeholders.
 */
export const NARROW_PRESET_BODY =
  "I'd narrow this to: [the part I still accept]. Where I'd push back is: [the more limited scope].";

/**
 * SC-004 — composer-seeded body for the `confirm` action. Used when the
 * other side has narrowed / conceded / clarified and this move accepts
 * the repaired claim.
 */
export const CONFIRM_PRESET_BODY =
  "I accept this narrowed point. Moving on with the rest of the claim.";

/**
 * SC-004 — composer-seeded body for the `synthesize` action. Cluster-
 * level move that summarises what both sides have agreed on so far.
 */
export const SYNTHESIZE_PRESET_BODY =
  "Synthesis: where I think we landed is — [shared point]. Open questions still on the table: [list].";

/** Frozen array of every SC-004 preset body. Fed to the ban-list test. */
export const ALL_SC004_PRESET_BODIES: ReadonlyArray<string> = Object.freeze([
  NARROW_PRESET_BODY,
  CONFIRM_PRESET_BODY,
  SYNTHESIZE_PRESET_BODY,
]);

/**
 * Given a quick-action label and the parent argument's type, return a
 * MoveDraftPatch the composer can apply once. Returns null when the
 * action does not have a meaningful preset (e.g., `reply` should leave
 * argumentType free, or `inspect_receipt` which is a read-only popover
 * affordance).
 */
export function quickActionToPreset(action: QuickActionLabel, parentType: ArgumentType | null): MoveDraftPatch | null {
  switch (action) {
    case 'reply':
      // Don't force a type; just open the composer with the parent set.
      return null;

    case 'challenge': {
      // Choose the best allowed rebuttal/counter-rebuttal for the parent.
      const challengeType: ArgumentType =
        parentType === 'rebuttal' ? 'counter_rebuttal' :
        parentType === 'counter_rebuttal' ? 'rebuttal' :
        'rebuttal';
      return {
        argumentType: challengeType,
        // No axis required — leave it null so the user isn't forced to pick.
        disagreementAxis: null,
      };
    }

    case 'source':
      // EV-002: clarification semantics + seed an inspection-language body.
      return {
        argumentType: 'clarification_request',
        suggestedTagCodes: ['source_request'],
        body: ASK_SOURCE_PRESET_BODY,
      };

    case 'quote':
      return {
        argumentType: 'clarification_request',
        suggestedTagCodes: ['quote_request'],
        body: ASK_QUOTE_PRESET_BODY,
      };

    case 'weak_source':
      // EV-002: `broken` state — asks for a stronger / more primary source.
      return {
        argumentType: 'clarification_request',
        suggestedTagCodes: ['source_request', 'source_chain_weak'],
        body: ASK_STRONGER_SOURCE_PRESET_BODY,
      };

    case 'inspect_receipt':
      // EV-002: read-only popover affordance. No composer flow.
      return null;

    case 'clarify':
      return {
        argumentType: 'clarification_request',
      };

    case 'evidence':
      // Evidence type — composer auto-expands evidence fields.
      return {
        argumentType: 'evidence',
      };

    case 'concede':
      // Concession move; the composer no longer requires the exact "I concede" phrase.
      return {
        argumentType: 'concession',
      };

    case 'branch':
      // Branch == open a targeted reply; no forced type, deferred to user.
      return null;

    case 'flag':
      // Flag has its own moderation flow; do not invent destructive composer behaviour here.
      return null;

    case 'narrow':
      // SC-004 — narrow a claim. Use the existing `concession` argument type
      // with a `narrow_scope` suggested tag so the constitution treats it as
      // a structural concession of scope, not a withdrawal of the broad
      // point. Seeded body is scaffolding the user edits.
      return {
        argumentType: 'concession',
        suggestedTagCodes: ['narrow_scope'],
        body: NARROW_PRESET_BODY,
      };

    case 'confirm':
      // SC-004 — confirm a repaired claim. The constitution's ArgumentType
      // union does not have a dedicated `confirmation` value (LIFE-001
      // detects confirmations from `kindLabel` + `pure_accept` qualifier),
      // so we leave argumentType unset and only seed the body. The user
      // picks the move type in the composer; the seeded scaffolding speaks
      // to the accept-the-narrowed-point shape regardless of the type
      // chosen.
      return {
        body: CONFIRM_PRESET_BODY,
      };

    case 'synthesize':
      // SC-004 — synthesize a cluster. Uses the existing `synthesis`
      // argument type. Seeded body is scaffolding the user edits.
      return {
        argumentType: 'synthesis',
        body: SYNTHESIZE_PRESET_BODY,
      };

    default:
      return null;
  }
}
