/**
 * MCP-015 — Semantic override UX model: the pure trigger model.
 *
 * `evaluateSemanticOverridePrompt` decides whether the reversible override
 * choice surface appears for one move. It returns `shouldOffer: true` ONLY
 * when the referee declared uncertainty — a routing-relevant binary at `low`
 * confidence, or an MCP-013 `conflict_routed` reading on a routing-relevant
 * category. The override surface is the uncertainty path, never always-on.
 *
 * Pure TypeScript. No network, no React, no Supabase, no mutation, no
 * `Date.now()`. The `SemanticRefereePacket` and `LedgerResult` are consumed
 * READ-ONLY — this model never constructs or mutates a packet or a ledger
 * result. Doctrine: the trigger reads ONLY packet confidence + the L1/L2
 * conflict signal + viewer role + the in-memory count. It NEVER reads
 * engagement / view count / heat band, and it triggers NO AI call.
 */

import type {
  SemanticRefereePacket,
  SemanticRouteSuggestion,
} from '../semanticReferee/semanticRefereeTypes';
import type { LedgerResult, RefereePointCategory } from '../refereeLedger/types';
import type {
  RepeatedOverrideSignal,
  SemanticOverrideActorRole,
  SemanticOverrideLane,
  SemanticOverridePrompt,
} from './types';

// ── Routing-relevant classifier set ───────────────────────────────

/**
 * The binaries whose `low` confidence opens an override choice. A `low`
 * confidence on a non-routing classifier (evidence, satire, mode) does NOT
 * trigger the routing override — that is MCP-013's own feedback path.
 */
const ROUTING_RELEVANT_CLASSIFIER_IDS: readonly string[] = Object.freeze([
  'responds_to_parent',
  'introduces_new_issue',
  'suggests_side_branch',
  'suggests_diagonal_tangent',
]);

/**
 * The referee-ledger categories whose `conflict_routed` reading opens an
 * override choice. Only routing-relevant — an evidence-axis conflict is
 * MCP-013's feedback path, not MCP-015's.
 */
const ROUTING_RELEVANT_CATEGORIES: readonly RefereePointCategory[] = Object.freeze([
  'continuity',
  'direct_response',
]);

// ── Route-suggestion → lane mapping ───────────────────────────────

/**
 * Map MCP-011's seven-member `SemanticRouteSuggestion` onto the three-member
 * `SemanticOverrideLane`. Exported for the test suite.
 *
 * MCP-010 §13 flagged that BR-003 / BR-004 may finalize a wider lane
 * vocabulary; this mapping collapses the seven route suggestions into the
 * three lanes BR-003 / BR-004 currently expose. The `SemanticOverrideLane`
 * union is deliberately small so a future card can widen it and the mapping
 * together without a contract break.
 */
export function routeSuggestionToLane(
  suggestion: SemanticRouteSuggestion,
): SemanticOverrideLane {
  switch (suggestion) {
    case 'mainline':
    case 'no_route_change':
    case 'synthesis_lane':
    case 'cards_detail':
      return 'mainline';
    case 'vertical_chime_branch':
      return 'branch';
    case 'diagonal_tangent':
    case 'outer_realm':
      return 'tangent';
    default: {
      // Exhaustiveness guard — a new SemanticRouteSuggestion member that is
      // not mapped is a compile error here. Runtime fallback is 'mainline'.
      const _exhaustive: never = suggestion;
      void _exhaustive;
      return 'mainline';
    }
  }
}

// ── Internal — contested-classifier helpers ───────────────────────

/**
 * Derive the contested classifier id for an L1/L2 routing conflict. Both
 * routing-relevant categories (`continuity`, `direct_response`) contest the
 * `responds_to_parent` classifier — that is the binary the toggle overturns.
 */
function categoryToContestedClassifierId(category: RefereePointCategory): string {
  switch (category) {
    case 'continuity':
    case 'direct_response':
      return 'responds_to_parent';
    default:
      return '';
  }
}

/** The empty / not-offered prompt shape, with `suggestedLane` carried through. */
function notOfferedPrompt(
  suggestedLane: SemanticOverrideLane,
): SemanticOverridePrompt {
  return {
    shouldOffer: false,
    triggerReason: null,
    suggestedLane,
    offersAnswersParentToggle: false,
    contestedClassifierId: null,
    promptCopyCode: '',
  };
}

// ── The pure trigger model ────────────────────────────────────────

/**
 * Pure. No network, no React, no Supabase, no mutation. Decides whether the
 * override choice surface appears for one move.
 *
 * - `packet` may be undefined (feature flag off — no packet fetched).
 * - `ledgerResult` may be undefined (the ledger ran l1_only or not at all).
 * - `viewerActorRole` gates the actor rule — observers always get
 *   `shouldOffer: false`.
 *
 * Algorithm, in order:
 *   1. Actor gate — observers never override.
 *   2. No-input gate — no packet AND no ledger result → nothing to reverse.
 *   3. L1/L2 conflict check (highest priority) — a routing-relevant
 *      `conflict_routed` reading with `needsUserChoice: true`.
 *   4. Low-confidence check — any routing-relevant binary at `low` confidence.
 *   5. Confident path — `shouldOffer: false`.
 */
export function evaluateSemanticOverridePrompt(input: {
  packet?: SemanticRefereePacket;
  ledgerResult?: LedgerResult;
  viewerActorRole: SemanticOverrideActorRole;
  repeatedSignal: RepeatedOverrideSignal;
}): SemanticOverridePrompt {
  const { packet, ledgerResult, viewerActorRole, repeatedSignal } = input;

  // `suggestedLane` is independent of `shouldOffer` — always populated so the
  // choice sheet can pre-select it. Absent packet defaults to 'mainline'.
  const suggestedLane: SemanticOverrideLane = packet
    ? routeSuggestionToLane(packet.routeSuggestion)
    : 'mainline';

  // Step 1 — Actor gate. Observers never override. First, before any packet
  // inspection.
  if (viewerActorRole === 'observer') {
    return notOfferedPrompt(suggestedLane);
  }

  // Step 2 — No-input gate. Nothing was classified; nothing to reverse.
  if (packet === undefined && ledgerResult === undefined) {
    return notOfferedPrompt(suggestedLane);
  }

  // Step 3 — L1/L2 conflict check (highest priority).
  if (ledgerResult && ledgerResult.needsUserChoice) {
    for (const reading of ledgerResult.categoryReadings) {
      if (
        reading.outcome === 'conflict_routed' &&
        ROUTING_RELEVANT_CATEGORIES.includes(reading.category)
      ) {
        const contestedClassifierId = categoryToContestedClassifierId(
          reading.category,
        );
        return {
          shouldOffer: true,
          triggerReason: 'l1_l2_conflict',
          suggestedLane,
          // A continuity / direct_response conflict is exactly the
          // "does this answer the parent?" question — offer the toggle.
          offersAnswersParentToggle: true,
          contestedClassifierId,
          promptCopyCode: pickPromptCopyCode('l1_l2_conflict', repeatedSignal),
        };
      }
    }
  }

  // Step 4 — Low-confidence check.
  if (packet) {
    for (const binary of packet.binaries) {
      if (
        binary.confidence === 'low' &&
        ROUTING_RELEVANT_CLASSIFIER_IDS.includes(binary.classifierId)
      ) {
        return {
          shouldOffer: true,
          triggerReason: 'low_confidence',
          suggestedLane,
          offersAnswersParentToggle:
            binary.classifierId === 'responds_to_parent',
          contestedClassifierId: binary.classifierId,
          promptCopyCode: pickPromptCopyCode('low_confidence', repeatedSignal),
        };
      }
    }
  }

  // Step 5 — Confident path. The referee was confident and L1/L2 agreed.
  return notOfferedPrompt(suggestedLane);
}

// ── Internal — prompt copy code selection ─────────────────────────

/**
 * Pick the plain-language copy code for the prompt headline. A crossed
 * `softenCopy` flag wins regardless of trigger reason — once the room has seen
 * repeated overrides the quieter copy is used. It only swaps copy; it never
 * suppresses the surface.
 */
function pickPromptCopyCode(
  triggerReason: 'low_confidence' | 'l1_l2_conflict',
  repeatedSignal: RepeatedOverrideSignal,
): string {
  if (repeatedSignal.softenCopy) {
    return 'semantic_override_prompt_soft';
  }
  if (triggerReason === 'low_confidence') {
    return 'semantic_override_prompt_low_conf';
  }
  return 'semantic_override_prompt_conflict';
}
