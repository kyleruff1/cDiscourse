/**
 * COMP-001 — Deterministic composition layer.
 *
 * `composeVisualState(input) → CompositionResult`
 *
 * Pure-TS function that maps a binary classifier signal vector + accumulated
 * thread state + structural move metadata to typed `NodeVisualMutation`
 * objects targeting specific connected `moveId`s.
 *
 * 22 composition rules grouped by family (parent-continuity, evidence,
 * constructive movement, debate-mode, branch/friction) + 2 exemption patterns
 * (R-EX-01 root, R-EX-02 first-move-per-author). See COMP-001 §4 for the
 * rule catalog. Rule execution order: parent-continuity → evidence →
 * constructive-movement → debate-mode → branch/friction (COMP-001 §13 Q3
 * recommendation; the order is tested in
 * `__tests__/compositionLayerRules.test.ts`).
 *
 * MCP-CAT-001 catalog v1 additive rules (active post-MCP-CAT-001):
 *   - R-CAT-SubAxis: `introduces_sub_axis=1` → `sub_axis_opened` (+ ledger entry).
 *   - R-EV-APP-01: `disputes_evidence_applicability=1` → `evidence_applicability_disputed`
 *     on parent (+ per-move `prior_agreement_cited` / `temporal_constraint_provided`
 *     chips when their respective signals are present).
 *   - R-CAT-QualifiedConcession: `accepts_partial_with_caveat=1` →
 *     `qualified_concession_with_caveat` on current; with
 *     `provides_alternate_interpretation=1` also emits
 *     `alternate_interpretation_offered`.
 *   - R-CAT-Corroborating: `supplies_corroborating_document=1` →
 *     `corroborating_document_attached` on current.
 *   - R-CAT-Settlement: `proposes_settlement_terms=1` → `settlement_proposed`;
 *     `accepts_settlement_terms=1` → `settlement_accepted`.
 *
 * Pure TS — no Supabase, no React, no network, no async, no AI SDK imports.
 * The purity test in `__tests__/compositionLayerPurity.test.ts` enforces
 * this property by scanning the module source.
 *
 * Doctrine (cdiscourse-doctrine §1 / §2 / §3 / §4):
 *   - No truth claims. Every mutation describes a structural state.
 *   - No verdict tokens, no person labels. The doctrine-scan test enforces this.
 *   - No natural language. Every output is a typed enum value.
 *   - Deterministic. Same inputs → same outputs.
 *   - Binary contract: reads 0/1 values only; never interprets reasonCode.
 */

import { CATALOG_BY_ID } from '../../lib/constitution/semanticClassifierCatalog';
import {
  EMPTY_COMPOSITION_STATE,
  type AncestorMoveSummary,
  type ClarificationDebtState,
  type ClassifierSignalLookup,
  type ComposeVisualStateInput,
  type CompositionResult,
  type CompositionState,
  type ConcessionLinkState,
  type EvidenceDebtState,
  type MoveMetadata,
  type NarrowingLinkState,
  type NodeVisualMutation,
  type NodeVisualMutationType,
  type SourceChainGapState,
  type SubAxisState,
  type SynthesisReadinessState,
} from './compositionTypes';
import {
  findUpstreamByDifferentAuthor,
  findUpstreamMove,
} from './compositionUpstreamSearch';
import type {
  SemanticBinarySample,
  SemanticClassifierId,
  SemanticConfidence,
  SemanticRefereePacket,
} from './semanticRefereeTypes';

// ── Internal helpers ───────────────────────────────────────────────

/** Sentinel used by `signalLookup.get` for ids absent from the packet. */
const ABSENT_SAMPLE: { value: 0; confidence: SemanticConfidence } = Object.freeze({
  value: 0,
  confidence: 'low',
});

/**
 * Build a lookup-by-id over the packet's binary samples. Absent ids default
 * to `value: 0, confidence: 'low'` so rule predicates can index uniformly.
 */
function buildSignalLookup(
  packet: SemanticRefereePacket | undefined,
): ClassifierSignalLookup {
  if (!packet || !Array.isArray(packet.binaries)) {
    return Object.freeze({
      get: () => ABSENT_SAMPLE,
      has: () => false,
    });
  }
  const byId = new Map<SemanticClassifierId, { value: 0 | 1; confidence: SemanticConfidence }>();
  for (const sample of packet.binaries as readonly SemanticBinarySample[]) {
    if (!byId.has(sample.classifierId)) {
      byId.set(sample.classifierId, {
        value: sample.value,
        confidence: sample.confidence,
      });
    }
  }
  return Object.freeze({
    get: (id: SemanticClassifierId) => byId.get(id) ?? ABSENT_SAMPLE,
    has: (id: SemanticClassifierId) => byId.has(id),
  });
}

/**
 * Catalog membership check — returns true when `id` is declared in
 * `SEMANTIC_CLASSIFIER_CATALOG`. Used by the PROPOSED-id runtime guards:
 * rules that reference an id missing from the catalog skip cleanly.
 */
function classifierInCatalog(id: string): boolean {
  return CATALOG_BY_ID.has(id as SemanticClassifierId);
}

/** Construct a fresh mutation with the rule's source classifier attached. */
function buildMutation(args: {
  targetMoveId: string;
  mutation: NodeVisualMutationType;
  sourceClassifier: NodeVisualMutation['sourceClassifier'];
  sourceMoveId: string;
  edgeOtherEndpointMoveId?: string;
}): NodeVisualMutation {
  if (args.edgeOtherEndpointMoveId !== undefined) {
    return Object.freeze({
      targetMoveId: args.targetMoveId,
      mutation: args.mutation,
      sourceClassifier: args.sourceClassifier,
      sourceMoveId: args.sourceMoveId,
      edgeOtherEndpointMoveId: args.edgeOtherEndpointMoveId,
    });
  }
  return Object.freeze({
    targetMoveId: args.targetMoveId,
    mutation: args.mutation,
    sourceClassifier: args.sourceClassifier,
    sourceMoveId: args.sourceMoveId,
  });
}

/** A writeable working copy of `CompositionState` used by the reducer. */
interface MutableCompositionState {
  evidenceDebts: Map<string, EvidenceDebtState>;
  clarificationDebts: Map<string, ClarificationDebtState>;
  activeSubAxes: Map<string, SubAxisState>;
  concessionChains: Map<string, ConcessionLinkState>;
  sourceChainGaps: Map<string, SourceChainGapState>;
  narrowingLinks: Map<string, NarrowingLinkState>;
  personShiftMoves: Set<string>;
  unplayableMoves: Set<string>;
  synthesisReadiness: SynthesisReadinessState;
}

/** Clone the input state into a fresh mutable working copy. */
function cloneState(state: CompositionState): MutableCompositionState {
  return {
    evidenceDebts: new Map(state.evidenceDebts),
    clarificationDebts: new Map(state.clarificationDebts),
    activeSubAxes: new Map(state.activeSubAxes),
    concessionChains: new Map(state.concessionChains),
    sourceChainGaps: new Map(state.sourceChainGaps),
    narrowingLinks: new Map(state.narrowingLinks),
    personShiftMoves: new Set(state.personShiftMoves),
    unplayableMoves: new Set(state.unplayableMoves),
    synthesisReadiness: state.synthesisReadiness,
  };
}

/** Freeze the working copy into the returned immutable state. */
function freezeState(state: MutableCompositionState): CompositionState {
  return Object.freeze({
    evidenceDebts: state.evidenceDebts,
    clarificationDebts: state.clarificationDebts,
    activeSubAxes: state.activeSubAxes,
    concessionChains: state.concessionChains,
    sourceChainGaps: state.sourceChainGaps,
    narrowingLinks: state.narrowingLinks,
    personShiftMoves: state.personShiftMoves,
    unplayableMoves: state.unplayableMoves,
    synthesisReadiness: state.synthesisReadiness,
  }) as CompositionState;
}

// ── Rule helpers ───────────────────────────────────────────────────

/**
 * Find the most-recent open evidence debt whose `targetMoveId` matches the
 * current move's parent, or any ancestor up the chain. Returns the matching
 * entry (and its key) or `null`.
 */
function findOpenEvidenceDebtForResolution(
  state: MutableCompositionState,
  moveMeta: MoveMetadata,
  ancestors: readonly AncestorMoveSummary[] | undefined,
): { key: string; debt: EvidenceDebtState } | null {
  const candidateTargets = new Set<string>();
  if (moveMeta.parentId) {
    candidateTargets.add(moveMeta.parentId);
  }
  if (ancestors) {
    for (const a of ancestors) {
      candidateTargets.add(a.moveId);
    }
  }
  let best: { key: string; debt: EvidenceDebtState } | null = null;
  for (const [key, debt] of state.evidenceDebts) {
    if (debt.status !== 'open') {
      continue;
    }
    if (!candidateTargets.has(debt.targetMoveId)) {
      continue;
    }
    if (best === null) {
      best = { key, debt };
      continue;
    }
    // Most-recent open debt = the one whose openingMoveId appears later in
    // the insertion order (Map preserves insertion order in JS).
    best = { key, debt };
  }
  return best;
}

/**
 * Find the most-recent open clarification debt whose target is an ancestor
 * of the current move (or the immediate parent).
 */
function findOpenClarificationDebtForResolution(
  state: MutableCompositionState,
  moveMeta: MoveMetadata,
  ancestors: readonly AncestorMoveSummary[] | undefined,
): { key: string; debt: ClarificationDebtState } | null {
  const candidateTargets = new Set<string>();
  if (moveMeta.parentId) {
    candidateTargets.add(moveMeta.parentId);
  }
  if (ancestors) {
    for (const a of ancestors) {
      candidateTargets.add(a.moveId);
    }
  }
  let best: { key: string; debt: ClarificationDebtState } | null = null;
  for (const [key, debt] of state.clarificationDebts) {
    if (debt.status !== 'open') {
      continue;
    }
    if (!candidateTargets.has(debt.targetMoveId)) {
      continue;
    }
    best = { key, debt };
  }
  return best;
}

/**
 * Find the most-recent open source-chain gap (any open gap; the resolution
 * helper does not require an ancestor-target match because gaps are
 * resolved by SUPPLYING the missing link anywhere in the thread).
 */
function findOpenSourceChainGap(
  state: MutableCompositionState,
): { key: string; gap: SourceChainGapState } | null {
  let best: { key: string; gap: SourceChainGapState } | null = null;
  for (const [key, gap] of state.sourceChainGaps) {
    if (gap.status !== 'open') {
      continue;
    }
    best = { key, gap };
  }
  return best;
}

/**
 * Find the upstream evidence ancestor — the most-recent ancestor whose
 * packet declares `provides_evidence=1`. Used by R-EV-06 to attach a
 * retraction to the underlying evidence claim.
 */
function findUpstreamEvidenceClaim(
  ancestors: readonly AncestorMoveSummary[] | undefined,
): { moveId: string } | null {
  const match = findUpstreamMove(ancestors, (ancestor) => {
    const sig = buildSignalLookup(ancestor.packet);
    return sig.get('provides_evidence').value === 1;
  });
  return match ? { moveId: match.moveId } : null;
}

/**
 * Find the most-recent open sub-axis whose `openingMoveId` appears in the
 * ancestor chain (or which has no ancestor constraint when the chain is
 * absent). Used by R-CM-03 (synthesis-ready target) and R-BR-02 (tangent
 * abandons the active sub-axis).
 */
function findOpenSubAxisInChain(
  state: MutableCompositionState,
  ancestors: readonly AncestorMoveSummary[] | undefined,
): { key: string; subAxis: SubAxisState } | null {
  const ancestorIds = new Set<string>();
  if (ancestors) {
    for (const a of ancestors) {
      ancestorIds.add(a.moveId);
    }
  }
  let best: { key: string; subAxis: SubAxisState } | null = null;
  for (const [key, subAxis] of state.activeSubAxes) {
    if (subAxis.status !== 'open') {
      continue;
    }
    if (ancestors && ancestorIds.size > 0 && !ancestorIds.has(subAxis.openingMoveId)) {
      continue;
    }
    best = { key, subAxis };
  }
  return best;
}

/** Update the synthesis-readiness derived state from the current ledger. */
function recomputeSynthesisReadiness(
  state: MutableCompositionState,
  current: { ready: boolean; subThreadRootMoveId: string | null; sharedGroundMoveCount: number } | null,
): void {
  let openDebtCount = 0;
  for (const debt of state.evidenceDebts.values()) {
    if (debt.status === 'open') {
      openDebtCount += 1;
    }
  }
  for (const debt of state.clarificationDebts.values()) {
    if (debt.status === 'open') {
      openDebtCount += 1;
    }
  }
  for (const gap of state.sourceChainGaps.values()) {
    if (gap.status === 'open') {
      openDebtCount += 1;
    }
  }
  if (current === null) {
    state.synthesisReadiness = Object.freeze({
      ready: state.synthesisReadiness.ready,
      subThreadRootMoveId: state.synthesisReadiness.subThreadRootMoveId,
      openDebtCount,
      sharedGroundMoveCount: state.synthesisReadiness.sharedGroundMoveCount,
    });
    return;
  }
  state.synthesisReadiness = Object.freeze({
    ready: current.ready,
    subThreadRootMoveId: current.subThreadRootMoveId,
    openDebtCount,
    sharedGroundMoveCount: current.sharedGroundMoveCount,
  });
}

// ── The composition function ───────────────────────────────────────

/**
 * The COMP-001 entry point. Pure, deterministic, snapshot-testable. Same
 * inputs → same outputs. The input `threadState` is NOT mutated; the returned
 * `nextState` is a fresh, frozen object.
 */
export function composeVisualState(
  input: ComposeVisualStateInput,
): CompositionResult {
  const { packet, threadState, moveMeta, ancestors } = input;
  const mutations: NodeVisualMutation[] = [];

  // Clone the thread state for the reducer; the input stays untouched.
  const state = cloneState(threadState);

  // ── R-EX-01 — root proclamation ──
  // Root takes precedence over R-PC-02 (the design's m1 walkthrough makes
  // this explicit: the root exemption preempts even when a packet exists).
  if (moveMeta.parentId === null) {
    mutations.push(
      buildMutation({
        targetMoveId: moveMeta.moveId,
        mutation: 'opening_claim_marker',
        sourceClassifier: 'exemption',
        sourceMoveId: moveMeta.moveId,
      }),
    );
    recomputeSynthesisReadiness(state, null);
    return {
      mutations: Object.freeze(mutations) as readonly NodeVisualMutation[],
      nextState: freezeState(state),
    };
  }

  // ── R-EX-02 — first move by this author ──
  // No composition-layer mutations; layer-1 metadata renders the bubble.
  if (moveMeta.authorMovePosition === 'first') {
    recomputeSynthesisReadiness(state, null);
    return {
      mutations: Object.freeze(mutations) as readonly NodeVisualMutation[],
      nextState: freezeState(state),
    };
  }

  // No packet on a non-root, non-first move → no per-classifier rules can
  // fire. The state passes through unchanged.
  if (!packet) {
    recomputeSynthesisReadiness(state, null);
    return {
      mutations: Object.freeze(mutations) as readonly NodeVisualMutation[],
      nextState: freezeState(state),
    };
  }

  const sig = buildSignalLookup(packet);
  const parentId = moveMeta.parentId;
  const currentMoveId = moveMeta.moveId;

  // ── 4.1 Parent continuity rules ──────────────────────────────────

  // R-PC-01 — Parent engaged with anchored quote
  if (sig.get('responds_to_parent').value === 1 && sig.get('quote_anchors_parent').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: parentId,
        mutation: 'parent_engaged_quoted',
        sourceClassifier: 'quote_anchors_parent',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-PC-02 — Off-parent new issue introduced
  if (sig.get('responds_to_parent').value === 0 && sig.get('introduces_new_issue').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'new_issue_introduced',
        sourceClassifier: 'introduces_new_issue',
        sourceMoveId: currentMoveId,
      }),
    );
    mutations.push(
      buildMutation({
        targetMoveId: parentId,
        mutation: 'branch_suggested',
        sourceClassifier: 'introduces_new_issue',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-PC-03 — Clarification requested
  if (sig.get('requests_clarification').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: parentId,
        mutation: 'clarification_requested',
        sourceClassifier: 'requests_clarification',
        sourceMoveId: currentMoveId,
      }),
    );
    state.clarificationDebts.set(currentMoveId, Object.freeze({
      openingMoveId: currentMoveId,
      targetMoveId: parentId,
      status: 'open',
    }) as ClarificationDebtState);
  }

  // R-PC-04 — Clarification answered
  if (sig.get('answers_clarification').value === 1) {
    const match = findOpenClarificationDebtForResolution(state, moveMeta, ancestors);
    if (match) {
      // Mark the matched debt as resolved.
      state.clarificationDebts.set(match.key, Object.freeze({
        openingMoveId: match.debt.openingMoveId,
        targetMoveId: match.debt.targetMoveId,
        status: 'resolved',
        resolvingMoveId: currentMoveId,
      }) as ClarificationDebtState);
      // Cross-node mutation onto the move that asked for clarification.
      mutations.push(
        buildMutation({
          targetMoveId: match.debt.openingMoveId,
          mutation: 'clarification_resolved',
          sourceClassifier: 'answers_clarification',
          sourceMoveId: currentMoveId,
        }),
      );
    }
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'clarification_answered',
        sourceClassifier: 'answers_clarification',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // ── 4.2 Evidence + source-chain rules ────────────────────────────

  // R-EV-01 — Evidence requested (debt opened)
  // Consumer: QOL-036.1 — `derivePaymentEvidencePillState` maps the
  // resulting `evidence_debt_opened` mutation onto the payment-evidence
  // pill's obligation axis (`EvidenceDebtStatus = 'requested'`). See
  // `docs/designs/QOL-036.1.md` §5.1.
  if (sig.get('asks_for_evidence').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: parentId,
        mutation: 'evidence_debt_opened',
        sourceClassifier: 'asks_for_evidence',
        sourceMoveId: currentMoveId,
      }),
    );
    state.evidenceDebts.set(currentMoveId, Object.freeze({
      openingMoveId: currentMoveId,
      targetMoveId: parentId,
      openingAuthorId: moveMeta.authorId,
      status: 'open',
    }) as EvidenceDebtState);
  }

  // R-EV-02 — Evidence supplied (debt resolved)
  // Consumer: QOL-036.1 — `derivePaymentEvidencePillState` maps the
  // resulting `evidence_debt_resolved` mutation onto the payment-evidence
  // pill's obligation axis (`EvidenceDebtStatus = 'supplied'`). See
  // `docs/designs/QOL-036.1.md` §5.1.
  if (sig.get('provides_evidence').value === 1 && sig.get('evidence_supports_claim').value === 1) {
    const match = findOpenEvidenceDebtForResolution(state, moveMeta, ancestors);
    if (match) {
      state.evidenceDebts.set(match.key, Object.freeze({
        openingMoveId: match.debt.openingMoveId,
        targetMoveId: match.debt.targetMoveId,
        openingAuthorId: match.debt.openingAuthorId,
        status: 'resolved',
        resolvingMoveId: currentMoveId,
      }) as EvidenceDebtState);
      mutations.push(
        buildMutation({
          targetMoveId: match.debt.targetMoveId,
          mutation: 'evidence_debt_resolved',
          sourceClassifier: 'evidence_supports_claim',
          sourceMoveId: currentMoveId,
        }),
      );
      // If the debt was opened against a source-chain gap, also fill it.
      const gapMatch = findOpenSourceChainGap(state);
      if (gapMatch && gapMatch.gap.openingMoveId === match.debt.targetMoveId) {
        state.sourceChainGaps.set(gapMatch.key, Object.freeze({
          openingMoveId: gapMatch.gap.openingMoveId,
          status: 'filled',
          fillingMoveId: currentMoveId,
        }) as SourceChainGapState);
        mutations.push(
          buildMutation({
            targetMoveId: gapMatch.gap.openingMoveId,
            mutation: 'source_chain_gap_filled',
            sourceClassifier: 'derived',
            sourceMoveId: currentMoveId,
          }),
        );
      }
    }
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'evidence_attached_supporting',
        sourceClassifier: 'provides_evidence',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-EV-03 — Evidence attached but unverified
  if (sig.get('provides_evidence').value === 1 && sig.get('evidence_supports_claim').value === 0) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'evidence_attached_unverified',
        sourceClassifier: 'provides_evidence',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-EV-04 — Popularity used as evidence (amplification warning)
  if (sig.get('uses_popularity_as_evidence').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'popularity_amplification_warning',
        sourceClassifier: 'uses_popularity_as_evidence',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-EV-05 — Satire used as evidence
  if (sig.get('uses_satire_as_evidence').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'satire_as_evidence_warning',
        sourceClassifier: 'uses_satire_as_evidence',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-EV-06 — Retraction cited
  if (sig.get('cites_retraction').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'retraction_cited',
        sourceClassifier: 'cites_retraction',
        sourceMoveId: currentMoveId,
      }),
    );
    const upstream = findUpstreamEvidenceClaim(ancestors);
    if (upstream) {
      mutations.push(
        buildMutation({
          targetMoveId: upstream.moveId,
          mutation: 'evidence_retracted',
          sourceClassifier: 'cites_retraction',
          sourceMoveId: currentMoveId,
        }),
      );
      // If a matching evidence debt is open against the retracted ancestor,
      // mark it resolved (the retraction settles the debt by withdrawing
      // the underlying claim).
      for (const [key, debt] of state.evidenceDebts) {
        if (debt.status === 'open' && debt.targetMoveId === upstream.moveId) {
          state.evidenceDebts.set(key, Object.freeze({
            openingMoveId: debt.openingMoveId,
            targetMoveId: debt.targetMoveId,
            openingAuthorId: debt.openingAuthorId,
            status: 'resolved',
            resolvingMoveId: currentMoveId,
          }) as EvidenceDebtState);
          break;
        }
      }
    }
  }

  // R-EV-07 — Source-chain gap flagged
  if (sig.get('creates_source_chain_gap').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'source_chain_gap_flagged',
        sourceClassifier: 'creates_source_chain_gap',
        sourceMoveId: currentMoveId,
      }),
    );
    state.sourceChainGaps.set(currentMoveId, Object.freeze({
      openingMoveId: currentMoveId,
      status: 'open',
    }) as SourceChainGapState);
  }

  // ── 4.3 Constructive movement rules ───────────────────────────────

  // R-CM-01 — Claim narrowed
  if (sig.get('narrows_claim').value === 1) {
    // Walk up the author's own chain to find the broader-scoped ancestor.
    const sameAuthor = findUpstreamMove(ancestors, (ancestor) => {
      return ancestor.authorId === moveMeta.authorId;
    });
    const broaderAncestor = sameAuthor ? sameAuthor.moveId : null;
    const targetForNarrowing = broaderAncestor ?? parentId;
    mutations.push(
      buildMutation({
        targetMoveId: targetForNarrowing,
        mutation: 'point_narrowed',
        sourceClassifier: 'narrows_claim',
        sourceMoveId: currentMoveId,
      }),
    );
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'narrowing_landed',
        sourceClassifier: 'narrows_claim',
        sourceMoveId: currentMoveId,
      }),
    );
    state.narrowingLinks.set(currentMoveId, Object.freeze({
      narrowingMoveId: currentMoveId,
      broaderAncestorMoveId: broaderAncestor,
      atMoveId: currentMoveId,
    }) as NarrowingLinkState);
  }

  // R-CM-02 — Point conceded
  if (sig.get('concedes_narrow_point').value === 1) {
    const axis = moveMeta.disagreementAxis ?? null;
    // Try to find an upstream move authored by a DIFFERENT author whose
    // disagreementAxis matches the current move's axis. Fall back to a
    // different-author ancestor regardless of axis; fall back to parent.
    let originating: { moveId: string } | null = null;
    if (axis) {
      const axisMatch = findUpstreamByDifferentAuthor(ancestors, moveMeta.authorId, axis);
      if (axisMatch) {
        originating = { moveId: axisMatch.moveId };
      }
    }
    if (!originating) {
      const anyDiff = findUpstreamByDifferentAuthor(ancestors, moveMeta.authorId);
      if (anyDiff) {
        originating = { moveId: anyDiff.moveId };
      }
    }
    const target = originating ? originating.moveId : parentId;
    mutations.push(
      buildMutation({
        targetMoveId: target,
        mutation: 'point_conceded',
        sourceClassifier: 'concedes_narrow_point',
        sourceMoveId: currentMoveId,
      }),
    );
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'concession_landed',
        sourceClassifier: 'concedes_narrow_point',
        sourceMoveId: currentMoveId,
      }),
    );
    state.concessionChains.set(currentMoveId, Object.freeze({
      concedingMoveId: currentMoveId,
      conceededOnAxis: axis,
      originatingChallengeMoveId: originating ? originating.moveId : null,
      atMoveId: currentMoveId,
    }) as ConcessionLinkState);
    // If the conceded point was the active sub-axis, mark it resolved.
    if (originating) {
      const subAxisMatch = findOpenSubAxisInChain(state, ancestors);
      if (subAxisMatch) {
        state.activeSubAxes.set(subAxisMatch.key, Object.freeze({
          openingMoveId: subAxisMatch.subAxis.openingMoveId,
          parentAxisRootMoveId: subAxisMatch.subAxis.parentAxisRootMoveId,
          status: 'resolved',
          resolvingMoveId: currentMoveId,
        }) as SubAxisState);
      }
    }
  }

  // R-CM-03 — Synthesis ready
  if (sig.get('ready_for_synthesis').value === 1) {
    const subAxisMatch = findOpenSubAxisInChain(state, ancestors);
    let target: string;
    if (subAxisMatch) {
      target = subAxisMatch.subAxis.openingMoveId;
    } else if (ancestors && ancestors.length > 0) {
      // Fallback: the room root (oldest ancestor).
      target = ancestors[0].moveId;
    } else {
      // No ancestors available — target the parent.
      target = parentId;
    }
    mutations.push(
      buildMutation({
        targetMoveId: target,
        mutation: 'synthesis_ready',
        sourceClassifier: 'ready_for_synthesis',
        sourceMoveId: currentMoveId,
      }),
    );
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'synthesis_offered',
        sourceClassifier: 'ready_for_synthesis',
        sourceMoveId: currentMoveId,
      }),
    );
    recomputeSynthesisReadiness(state, {
      ready: true,
      subThreadRootMoveId: target,
      sharedGroundMoveCount: state.synthesisReadiness.sharedGroundMoveCount,
    });
  }

  // R-CM-04 — Pre-send pause advised
  if (sig.get('needs_pre_send_pause').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'pre_send_pause_advised',
        sourceClassifier: 'needs_pre_send_pause',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // ── 4.4 Debate-mode fit rules ────────────────────────────────────

  // R-DM-01 — Mode mismatch
  if (sig.has('fits_selected_debate_mode') && sig.get('fits_selected_debate_mode').value === 0) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'mode_mismatch_warning',
        sourceClassifier: 'fits_selected_debate_mode',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-DM-02 — Playable hot take
  if (sig.get('contains_playable_hot_take').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'playable_hot_take',
        sourceClassifier: 'contains_playable_hot_take',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-DM-03 — Satire / parody marker
  if (sig.get('is_satire_or_parody').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'satire_marker',
        sourceClassifier: 'is_satire_or_parody',
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // ── 4.5 Branch routing + friction rules ──────────────────────────

  // R-BR-01 — Side branch suggested
  if (sig.get('suggests_side_branch').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'side_branch_suggested',
        sourceClassifier: 'suggests_side_branch',
        sourceMoveId: currentMoveId,
      }),
    );
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'branch_route_hint',
        sourceClassifier: 'suggests_side_branch',
        sourceMoveId: currentMoveId,
        edgeOtherEndpointMoveId: parentId,
      }),
    );
  }

  // R-BR-02 — Diagonal tangent suggested
  if (sig.get('suggests_diagonal_tangent').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'diagonal_tangent_suggested',
        sourceClassifier: 'suggests_diagonal_tangent',
        sourceMoveId: currentMoveId,
      }),
    );
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'tangent_route_hint',
        sourceClassifier: 'suggests_diagonal_tangent',
        sourceMoveId: currentMoveId,
        edgeOtherEndpointMoveId: parentId,
      }),
    );
    // Abandon any open sub-axis in the chain.
    const subAxisMatch = findOpenSubAxisInChain(state, ancestors);
    if (subAxisMatch) {
      state.activeSubAxes.set(subAxisMatch.key, Object.freeze({
        openingMoveId: subAxisMatch.subAxis.openingMoveId,
        parentAxisRootMoveId: subAxisMatch.subAxis.parentAxisRootMoveId,
        status: 'abandoned',
      }) as SubAxisState);
      mutations.push(
        buildMutation({
          targetMoveId: subAxisMatch.subAxis.openingMoveId,
          mutation: 'sub_axis_abandoned',
          sourceClassifier: 'derived',
          sourceMoveId: currentMoveId,
        }),
      );
    }
  }

  // R-BR-03 — Person shift warning
  if (sig.get('shifts_to_person_or_intent').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'person_shift_warning',
        sourceClassifier: 'shifts_to_person_or_intent',
        sourceMoveId: currentMoveId,
      }),
    );
    state.personShiftMoves.add(currentMoveId);
  }

  // R-BR-04 — Unplayable move
  if (sig.get('contains_unplayable_insult_only').value === 1) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'unplayable_move',
        sourceClassifier: 'contains_unplayable_insult_only',
        sourceMoveId: currentMoveId,
      }),
    );
    state.unplayableMoves.add(currentMoveId);
  }

  // ── MCP-CAT-001 (catalog v1) additive rules ──────────────────────
  //
  // Activated by MCP-CAT-001 when the 12 catalog v1 ids landed in the
  // catalog. The runtime catalog guards remain as belt-and-suspenders
  // safety so a future card that removes an id (a hypothetical reversal)
  // degrades cleanly instead of throwing. Doctrine: every emitted
  // mutation is a STRUCTURAL state — no truth claims, no person labels.

  // R-CAT-SubAxis (MCP-CAT-001): introduces_sub_axis=1 →
  // sub_axis_opened on the current move. Records the sub-axis on the
  // accumulator so R-CM-03's helper can later target the sub-thread root.
  // Reference: band-space-rent m7 (35-id mode) — see
  // docs/designs/COMP-001-worked-examples.md §"m7 — A's concession + new sub-axis".
  if (
    classifierInCatalog('introduces_sub_axis') &&
    sig.get('introduces_sub_axis' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'sub_axis_opened',
        sourceClassifier: 'introduces_sub_axis' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
    // Parent-axis-root: the ROOM root when no ancestor chain present.
    const parentAxisRoot = ancestors && ancestors.length > 0
      ? ancestors[0].moveId
      : parentId;
    state.activeSubAxes.set(currentMoveId, Object.freeze({
      openingMoveId: currentMoveId,
      parentAxisRootMoveId: parentAxisRoot,
      status: 'open',
    }) as SubAxisState);
  }

  // R-EV-APP-01 (MCP-CAT-001): disputes_evidence_applicability=1 →
  // evidence_applicability_disputed on the parent (the evidence-attaching
  // move). Per-move chips fire for the supporting context signals.
  // Reference: band-space-rent m3 (35-id mode) — see
  // docs/designs/COMP-001-worked-examples.md §"m3 — A's evidence applicability challenge".
  // Consumer: QOL-036.1 — `derivePaymentEvidencePillState` maps the
  // resulting `evidence_applicability_disputed` mutation onto the payment-
  // evidence pill's applicability axis (`ApplicabilityStatus =
  // 'applicability_disputed'`). See `docs/designs/QOL-036.1.md` §5.1.
  if (
    classifierInCatalog('disputes_evidence_applicability') &&
    sig.get('disputes_evidence_applicability' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: parentId,
        mutation: 'evidence_applicability_disputed',
        sourceClassifier: 'disputes_evidence_applicability' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }
  if (
    classifierInCatalog('references_prior_agreement') &&
    sig.get('references_prior_agreement' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'prior_agreement_cited',
        sourceClassifier: 'references_prior_agreement' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }
  if (
    classifierInCatalog('provides_temporal_constraint') &&
    sig.get('provides_temporal_constraint' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'temporal_constraint_provided',
        sourceClassifier: 'provides_temporal_constraint' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-CAT-QualifiedConcession (MCP-CAT-001): accepts_partial_with_caveat=1
  // → qualified_concession_with_caveat on current move. The alternate-
  // interpretation chip fires independently when its signal is present.
  // Reference: band-space-rent m4 (35-id mode) — see
  // docs/designs/COMP-001-worked-examples.md §"m4 — B's agree with caveat".
  if (
    classifierInCatalog('accepts_partial_with_caveat') &&
    sig.get('accepts_partial_with_caveat' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'qualified_concession_with_caveat',
        sourceClassifier: 'accepts_partial_with_caveat' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }
  if (
    classifierInCatalog('provides_alternate_interpretation') &&
    sig.get('provides_alternate_interpretation' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'alternate_interpretation_offered',
        sourceClassifier: 'provides_alternate_interpretation' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-CAT-Corroborating (MCP-CAT-001): supplies_corroborating_document=1 →
  // corroborating_document_attached on current move.
  // Reference: band-space-rent m6 / m8 (35-id mode) — see
  // docs/designs/COMP-001-worked-examples.md §"m6 — B's group-chat evidence supply"
  // and §"m8 — B's evidence-backed rebuttal on the sub-axis".
  // Consumer: QOL-036.1 — `derivePaymentEvidencePillState` maps the
  // resulting `corroborating_document_attached` mutation (when its source
  // move's ancestor chain reaches the artifact's parent — caller-filtered)
  // onto the payment-evidence pill's applicability axis
  // (`ApplicabilityStatus = 'applicability_supported'`). See
  // `docs/designs/QOL-036.1.md` §5.1.
  if (
    classifierInCatalog('supplies_corroborating_document') &&
    sig.get('supplies_corroborating_document' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'corroborating_document_attached',
        sourceClassifier: 'supplies_corroborating_document' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // R-CAT-Settlement (MCP-CAT-001): proposes_settlement_terms=1 →
  // settlement_proposed; accepts_settlement_terms=1 → settlement_accepted.
  // Both fire on the current move; the operator-derived structural questions
  // (per the MCP-CAT-001 task spec) describe RESOLUTION TERMS — never a
  // verdict on truth. The accompanying banner copy follows the
  // band-space-rent scenario's `permittedSettlementLanguage`.
  // Reference: operator-specified extension (not in worked-examples doc);
  // structural questions derived from band-space-rent fixture's
  // `expectedSettlement` section and `permittedSettlementLanguage` whitelist.
  // Justification: settlement_proposed / settlement_accepted are fully
  // determined by their respective binary signal + existing per-move output
  // shape — no new CompositionState fields, no state-machine transition.
  if (
    classifierInCatalog('proposes_settlement_terms') &&
    sig.get('proposes_settlement_terms' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'settlement_proposed',
        sourceClassifier: 'proposes_settlement_terms' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }
  if (
    classifierInCatalog('accepts_settlement_terms') &&
    sig.get('accepts_settlement_terms' as SemanticClassifierId).value === 1
  ) {
    mutations.push(
      buildMutation({
        targetMoveId: currentMoveId,
        mutation: 'settlement_accepted',
        sourceClassifier: 'accepts_settlement_terms' as SemanticClassifierId,
        sourceMoveId: currentMoveId,
      }),
    );
  }

  // Recompute debt counts every call (cheap; O(small)).
  recomputeSynthesisReadiness(
    state,
    sig.get('ready_for_synthesis').value === 1
      ? {
          ready: state.synthesisReadiness.ready,
          subThreadRootMoveId: state.synthesisReadiness.subThreadRootMoveId,
          sharedGroundMoveCount: state.synthesisReadiness.sharedGroundMoveCount,
        }
      : null,
  );

  return {
    mutations: Object.freeze(mutations) as readonly NodeVisualMutation[],
    nextState: freezeState(state),
  };
}

// ── Re-exports for convenience ─────────────────────────────────────

export { EMPTY_COMPOSITION_STATE };
export type {
  ComposeVisualStateInput,
  CompositionResult,
  CompositionState,
  MoveMetadata,
  NodeVisualMutation,
  NodeVisualMutationType,
};
