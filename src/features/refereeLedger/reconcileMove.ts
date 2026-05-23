/**
 * MCP-013 — Referee ledger: the single pure entry point.
 *
 * `reconcileMove(input)` orchestrates the five-stage referee-ledger pipeline:
 *   Stage 0 — classify the move and call the point-standing economy.
 *   Stage 1 — anti-amplification on the economy delta.
 *   Stage 2 — anti-exploit gate.
 *   Stage 3 — per-category reconciliation.
 *   Stage 4 — credit-state update + assemble `LedgerResult`.
 *
 * Doctrine (provable by the tests):
 *   - The ledger ADOPTS the economy delta bit-for-bit for economy-owned
 *     categories — `gradeChallenge` / `gradeRepair` are called and their
 *     numbers are never re-derived (`refereeLedgerEconomyParity.test.ts`).
 *   - A layer-1 / layer-2 conflict routes (`conflict_routed`, `delta: 0`) —
 *     never a penalty.
 *   - A low-confidence semantic binary moves no standing on its own.
 *   - `LedgerResult` has no `block` / `winner` / `truthValue` / `score` scalar
 *     / per-side aggregate field.
 *
 * Pure TypeScript. No network. No Supabase. No React. No `async`. No
 * persistence — the caller owns the `IssueDebtLedger` + `creditStates`.
 */

import {
  gradeChallenge,
  gradeRepair,
} from '../pointStanding/scoringEngine';
import {
  applyAntiAmplification,
  amplificationContextFromAnnotationFields,
} from '../pointStanding/antiAmplification';
import type { AntiAmplificationResult } from '../pointStanding/antiAmplification';
import type {
  ChallengeGradingInput,
  PointStandingDelta,
  RepairGradingInput,
} from '../pointStanding/types';
import type {
  Binary01,
  SemanticBinarySample,
  SemanticClassifierId,
  SemanticConfidence,
  SemanticRefereePacket,
} from '../semanticReferee/semanticRefereeTypes';
import {
  applyCreditState,
  evaluateLedgerGate,
  isCreditStateGated,
} from './antiExploit';
import {
  CATEGORY_AUTHORITY,
  isFactualStandingCategory,
  reconcileCategory,
  softFeedbackCode,
} from './reconciliation';
import type { ReconcileSignal } from './reconciliation';
import { hintMagnitudeForCategory } from './scoreHintMapping';
import {
  ALL_REFEREE_POINT_CATEGORIES,
} from './types';
import type {
  CategoryReading,
  DeterministicMoveMetadata,
  LedgerCreditState,
  LedgerMoveInput,
  LedgerResult,
  RefereeFeedbackCode,
  RefereePointCategory,
} from './types';
import { creditAxisForCategory } from './reconciliation';

// ── Packet helpers ────────────────────────────────────────────────

/**
 * A packet is usable only when `authoritative` is the literal `false`. A
 * defensive runtime guard: any non-`false` value is treated as a malformed
 * packet and the ledger falls back to `l1_only` (the packet is dropped).
 */
function usablePacket(packet: SemanticRefereePacket | undefined): SemanticRefereePacket | undefined {
  if (!packet) return undefined;
  if ((packet as { authoritative: unknown }).authoritative !== false) return undefined;
  return packet;
}

/** Find a binary by classifier id, or `undefined`. */
function findBinary(
  packet: SemanticRefereePacket | undefined,
  id: SemanticClassifierId,
): SemanticBinarySample | undefined {
  if (!packet) return undefined;
  return packet.binaries.find((b) => b.classifierId === id);
}

/** A binary's value, or `0` when the packet is absent or the binary missing. */
function binaryValue(packet: SemanticRefereePacket | undefined, id: SemanticClassifierId): Binary01 {
  return findBinary(packet, id)?.value ?? 0;
}

// ── Layer-1 / layer-2 signal derivation per category ──────────────

/** The deterministic layer-1 signal for one category, from the fact bundle. */
function l1SignalForCategory(
  category: RefereePointCategory,
  meta: DeterministicMoveMetadata,
): ReconcileSignal {
  switch (category) {
    case 'continuity':
    case 'direct_response':
      return { present: true, sign: meta.parentArgumentId !== null ? 1 : 0 };
    case 'evidence_provided':
      return { present: true, sign: meta.hasAttachedEvidence ? 1 : 0 };
    case 'evidence_relevance':
      // L1 cannot judge relevance — l2-authority category.
      return { present: false, sign: 0 };
    case 'quote_anchoring':
      return { present: true, sign: meta.hasQuoteAnchor ? 1 : 0 };
    case 'clarification':
      return { present: true, sign: meta.selectedClarify ? 1 : 0 };
    case 'synthesis':
      return { present: true, sign: meta.lifecycleSynthesisReady ? 1 : 0 };
    case 'branch_hygiene':
      return {
        present: true,
        sign:
          meta.branchKind === 'mainline' ||
          meta.branchKind === 'chime_in_branch' ||
          meta.branchKind === 'tangent_branch'
            ? 1
            : 0,
      };
    case 'staying_in_mode':
      return { present: true, sign: meta.moveFitsRoomMode ? 1 : 0 };
    case 'respecting_pacing':
      return { present: true, sign: meta.respectsPacing ? 1 : 0 };
    case 'person_intent_drift':
      // L1 cannot see intent drift on its own — relies on L2 (or both).
      return { present: false, sign: 0 };
    // Economy-owned categories carry no layer-1 reconciliation signal.
    case 'narrowing':
    case 'concession':
    case 'evidence_debt_resolution':
      return { present: false, sign: 0 };
    default:
      return { present: false, sign: 0 };
  }
}

/** Map a binary's 0/1 value to a `-1 | 0 | 1` sign for a given category. */
function semanticSign(
  category: RefereePointCategory,
  value: Binary01,
): -1 | 0 | 1 {
  // `person_intent_drift` is negative-only: a fired binary means "drift" → -1.
  if (category === 'person_intent_drift') return value === 1 ? -1 : 0;
  return value === 1 ? 1 : 0;
}

/** The advisory layer-2 signal for one category, from the packet binaries. */
function l2SignalForCategory(
  category: RefereePointCategory,
  packet: SemanticRefereePacket | undefined,
): (ReconcileSignal & { confidence: SemanticConfidence }) | null {
  if (!packet) return null;

  // MCP-MOD-004 — source-of-truth handshake: this `classifierFor` table is
  // structurally `category → classifier` (the INVERSE direction of the
  // catalog's `id → ledgerFeedbackCode` field), and a single classifier id
  // may appear under multiple categories (e.g. `responds_to_parent` surfaces
  // on both `continuity` and `direct_response`). Inverting the catalog to
  // derive this table is not a behaviour-preserving change, so the table
  // stays here. The catalog's `ledgerFeedbackCode` is the PRIMARY per-id
  // feedback code (parity-checked by
  // `__tests__/semanticClassifierCatalogParity.test.ts`); the per-category
  // feedback wording is owned by `reconcileCategory` / `softFeedbackCode`
  // (see `reconciliation.ts`). This is the documented
  // "smallest behaviour-preserving change" allowed by MCP-MOD-004's task spec.
  const classifierFor: Partial<Record<RefereePointCategory, SemanticClassifierId>> = {
    continuity: 'responds_to_parent',
    direct_response: 'responds_to_parent',
    evidence_provided: 'provides_evidence',
    evidence_relevance: 'evidence_supports_claim',
    quote_anchoring: 'quote_anchors_parent',
    clarification: 'requests_clarification',
    synthesis: 'ready_for_synthesis',
    branch_hygiene: 'suggests_side_branch',
    person_intent_drift: 'shifts_to_person_or_intent',
    staying_in_mode: 'fits_selected_debate_mode',
  };

  const id = classifierFor[category];
  if (!id) return null;
  const binary = findBinary(packet, id);
  if (!binary) return null;
  return {
    present: true,
    sign: semanticSign(category, binary.value),
    confidence: binary.confidence,
  };
}

// ── Result assembly helpers ───────────────────────────────────────

/** Build a fully-zeroed reading for a short-circuit (ineligible / gate trip). */
function zeroedReading(
  category: RefereePointCategory,
  feedbackCode: RefereeFeedbackCode,
): CategoryReading {
  return {
    category,
    delta: 0,
    outcome: 'l1_only',
    confidence: 'high',
    requiresUserChoice: false,
    feedbackCode,
    factualStandingAxis: isFactualStandingCategory(category),
    creditAxis: creditAxisForCategory(category),
  };
}

/**
 * The categories a short-circuit result reports — the move's touched
 * categories, every reading at `delta: 0`, with one constructive nudge.
 */
function shortCircuitReadings(
  touched: RefereePointCategory[],
  nudgeCode: RefereeFeedbackCode,
): CategoryReading[] {
  return touched.map((category, index) => {
    // Surface the constructive nudge on the first touched reading; the rest
    // carry their category's own soft prompt. No penalty anywhere.
    const code = index === 0 ? nudgeCode : softFeedbackCode(category);
    return zeroedReading(category, code);
  });
}

/**
 * Which categories this move touched — a category is touched when it has a
 * layer-1 derivation, a layer-2 binary, or a relevant `scoreHint`.
 */
function touchedCategories(input: LedgerMoveInput, packet: SemanticRefereePacket | undefined): RefereePointCategory[] {
  const out: RefereePointCategory[] = [];
  for (const category of ALL_REFEREE_POINT_CATEGORIES) {
    const l1 = l1SignalForCategory(category, input.deterministicMetadata);
    const l2 = l2SignalForCategory(category, packet);
    const hint = hintMagnitudeForCategory(category, packet?.scoreHints);
    const economyOwned = CATEGORY_AUTHORITY[category] === 'economy';
    if (l1.present || l2 !== null || hint > 0 || economyOwned) {
      out.push(category);
    }
  }
  return out;
}

/** Choose a constructive nudge from a gate's reasons (never a penalty). */
function nudgeForGateReasons(reasons: readonly string[]): RefereeFeedbackCode {
  if (reasons.includes('is_tangent')) return 'belongs_on_a_branch';
  if (reasons.includes('is_near_duplicate')) return 'you_decide_the_lane';
  if (reasons.includes('self_concession_loop')) return 'concession_noted';
  if (reasons.includes('no_axis_identified')) return 'question_still_open';
  return 'you_decide_the_lane';
}

// ── The pure entry point ──────────────────────────────────────────

/**
 * Reconcile one move. Runs the economy, anti-amplification, the anti-exploit
 * gate, and per-category reconciliation, then assembles a `LedgerResult`.
 */
export function reconcileMove(input: LedgerMoveInput): LedgerResult {
  const packet = usablePacket(input.semanticPacket);
  const creditStatesIn: readonly LedgerCreditState[] = input.creditStates ?? [];
  const touched = touchedCategories(input, packet);

  // ── Stage 0 — classify the move and call the economy. ──
  let economyDelta: PointStandingDelta | null = null;
  let ineligibilityReasons: string[] = [];
  // Economy deltas the reconciler adopts bit-for-bit for economy-owned categories.
  let narrowingDelta = 0;
  let concessionDelta = 0;
  let debtResolutionDelta = 0;
  // The debtId an economy-owned credit pays against (one credit per debt).
  let economyDebtId: string | null = null;

  if (input.moveRole === 'challenge') {
    const result = gradeChallenge(input.economyInput as ChallengeGradingInput);
    ineligibilityReasons = [...result.ineligibilityReasons];
    economyDelta = result.delta;
    if (result.newDebt) {
      input.debtLedger.appendDebt(result.newDebt);
      economyDebtId = result.newDebt.debtId;
    }
  } else {
    // moveRole === 'repair'. `repairOptions` is documented required.
    if (!input.repairOptions) {
      // Defensive guard — treat a repair with no options as ineligible rather
      // than throwing. No penalty, a constructive nudge.
      return {
        pointId: input.pointId,
        moveArgumentId: input.moveArgumentId,
        categoryReadings: shortCircuitReadings(touched, 'you_decide_the_lane'),
        economyDelta: null,
        antiAmplification: null,
        ineligibilityReasons: ['repair_options_missing'],
        needsUserChoice: false,
        exploitRiskScore: 0,
        creditStates: creditStatesIn,
        userReviewRequired: true,
      };
    }
    const result = gradeRepair(input.economyInput as RepairGradingInput, input.repairOptions);
    ineligibilityReasons = [...result.ineligibilityReasons];
    economyDelta = result.delta;
    if (result.updatedDebt) {
      input.debtLedger.updateDebt(result.updatedDebt.debtId, () => result.updatedDebt!);
      economyDebtId = result.updatedDebt.debtId;
    }
    if (result.delta) {
      // The repair effect — narrowing / concession use the same
      // broad / narrow standing deltas; the ledger adopts them verbatim.
      narrowingDelta = result.delta.narrowStandingDelta;
      concessionDelta = result.delta.broadStandingDelta;
      // The debt-close path: the economy credits recovery on a closed debt.
      debtResolutionDelta = result.delta.responderRecoveryGain;
    }
  }

  const exploitRiskScore = economyDelta?.exploitRiskScore ?? 0;

  // ── Economy-no-delta path: short-circuit, no penalty. ──
  //
  // The short-circuit is keyed on a NULL economy delta — not on `eligible`
  // alone. A challenge that fails the eligibility gate always returns
  // `delta: null`. A REPAIR can return `eligible: false` with a NON-null
  // penalty delta (the evasion path — `no_concession`): that delta MUST be
  // adopted verbatim (MCP-013 design test plan, "evasion path"), so Stage 3
  // still runs and the economy-owned `concession` reading adopts the
  // economy's negative `broadStandingDelta` bit-for-bit. The ledger itself
  // never adds a penalty — the only negative comes from the economy.
  if (economyDelta === null) {
    return {
      pointId: input.pointId,
      moveArgumentId: input.moveArgumentId,
      categoryReadings: shortCircuitReadings(touched, 'you_decide_the_lane'),
      economyDelta: economyDelta,
      antiAmplification: null,
      ineligibilityReasons,
      needsUserChoice: false,
      exploitRiskScore,
      creditStates: creditStatesIn,
      userReviewRequired: true,
    };
  }

  // ── Stage 1 — anti-amplification on the economy delta. ──
  let antiAmplification: AntiAmplificationResult | null = null;
  const evidenceCategoryInPlay = touched.some(isFactualStandingCategory);
  if (evidenceCategoryInPlay) {
    const usesPopularity = binaryValue(packet, 'uses_popularity_as_evidence') === 1;
    const sourceChainGap = binaryValue(packet, 'creates_source_chain_gap') === 1;
    const ctx = amplificationContextFromAnnotationFields({
      platformSupportWarning: usesPopularity,
      evidentiaryRisk: sourceChainGap ? 'high' : 'low',
      amplificationRisk: usesPopularity ? 'high' : 'none_observed',
      amplificationSignals: {
        appeal_to_virality: usesPopularity,
        appeal_to_crowd_size: usesPopularity,
        high_engagement_low_evidence:
          usesPopularity && !input.deterministicMetadata.hasAttachedEvidence,
        unknown_source_chain: sourceChainGap,
      },
      hasEvidence: input.deterministicMetadata.hasAttachedEvidence,
      hasTargetExcerpt: input.deterministicMetadata.hasQuoteAnchor,
      hasScopeNarrowing: binaryValue(packet, 'narrows_claim') === 1,
    });
    antiAmplification = applyAntiAmplification(economyDelta, ctx);
  }

  // ── Stage 2 — anti-exploit gate. ──
  const gate = evaluateLedgerGate(input);
  if (gate.tripped) {
    return {
      pointId: input.pointId,
      moveArgumentId: input.moveArgumentId,
      categoryReadings: shortCircuitReadings(touched, nudgeForGateReasons(gate.reasons)),
      economyDelta,
      antiAmplification,
      ineligibilityReasons: gate.reasons,
      needsUserChoice: false,
      exploitRiskScore,
      creditStates: creditStatesIn,
      userReviewRequired: true,
    };
  }

  // ── Stage 3 + 4 — per-category reconciliation + credit-state update. ──
  let creditStates: readonly LedgerCreditState[] = creditStatesIn;
  const factualStandingSuppressed = antiAmplification?.factualStandingGainSuppressed ?? false;
  const categoryReadings: CategoryReading[] = [];

  for (const category of touched) {
    const authority = CATEGORY_AUTHORITY[category];
    const l1 = l1SignalForCategory(category, input.deterministicMetadata);
    const l2 = l2SignalForCategory(category, packet);
    let hint = hintMagnitudeForCategory(category, packet?.scoreHints);

    // `synthesis` hint is gated on the lifecycle flag — without it, the hint
    // contributes 0 and the reconciler emits the `almost_a_synthesis` prompt.
    if (category === 'synthesis' && !input.deterministicMetadata.lifecycleSynthesisReady) {
      hint = 0;
    }

    let economyDeltaForCategory: number | undefined;
    if (authority === 'economy') {
      if (category === 'narrowing') economyDeltaForCategory = narrowingDelta;
      else if (category === 'concession') economyDeltaForCategory = concessionDelta;
      else if (category === 'evidence_debt_resolution') economyDeltaForCategory = debtResolutionDelta;
    }

    let reading = reconcileCategory({
      category,
      l1Signal: l1,
      l2Signal: l2,
      hintMagnitude: hint,
      economyDelta: economyDeltaForCategory,
    });

    // ── Anti-amplification on the factual-standing categories. A suppressed
    //    move emits `evidence_debt_open` with `delta: 0` — never a penalty.
    if (isFactualStandingCategory(category) && factualStandingSuppressed && reading.delta > 0) {
      reading = {
        ...reading,
        delta: 0,
        feedbackCode: 'evidence_debt_open',
      };
    }

    // ── Credit-state gate — one credit per debt. ──
    if (isCreditStateGated(category) && economyDebtId && reading.delta !== 0) {
      const gateResult = applyCreditState(category, economyDebtId, creditStates);
      if (!gateResult.allowed) {
        reading = { ...reading, delta: 0 };
      } else {
        creditStates = gateResult.nextStates;
      }
    }

    categoryReadings.push(reading);
  }

  const needsUserChoice = categoryReadings.some((r) => r.outcome === 'conflict_routed');

  return {
    pointId: input.pointId,
    moveArgumentId: input.moveArgumentId,
    categoryReadings,
    economyDelta,
    antiAmplification,
    ineligibilityReasons,
    needsUserChoice,
    exploitRiskScore,
    creditStates,
    userReviewRequired: true,
  };
}
