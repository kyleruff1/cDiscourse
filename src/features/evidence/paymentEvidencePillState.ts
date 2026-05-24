/**
 * QOL-036.1 — Payment-evidence pill state derivation, consumer of COMP-001
 * mutations + QOL-037 applicability + EV-003 obligation derivations.
 *
 * Pure TypeScript. No React. No Supabase. No network. No async.
 *
 * Doctrine:
 *   - Adds NO new chip, NO new enum value, NO new component, NO new verdict.
 *   - Reads composition mutations as ADDITIVE signals on top of layer-1
 *     derivations; never replaces layer-1.
 *   - Mutations are structural enum values; this module never authors copy.
 *     All user-facing strings come from QOL-037 / EV-003's already-locked copy.
 *   - Imports nothing from `pointStanding/` — a pill flip is a structural
 *     indicator, never a standing reward (anti-amplification).
 *   - No AI SDK import. No production-app network. No service-role.
 *
 * See `docs/designs/QOL-036.1.md` for the full design + mapping table.
 */

import type { NodeVisualMutation } from '../semanticReferee/compositionTypes';
import type { EvidenceArtifact } from './evidenceModel';
import type {
  ApplicabilityChipContract,
  ApplicabilityStatus,
  EvidenceResponseRecord,
  DeriveApplicabilityStatusOptions,
} from './evidenceApplicabilityModel';
import {
  deriveApplicabilityStatus,
  summarizeApplicabilityChip,
} from './evidenceApplicabilityModel';
import type {
  EvidenceDebt,
  EvidenceDebtStatus,
} from './evidenceDebtModel';

// ── Provenance ───────────────────────────────────────────────────────

/**
 * Where each axis status was last produced from. Tracked so the test suite +
 * a future Inspect-§E read-view can show provenance, and so a debugger can
 * tell whether the chip flipped via layer-1 (user action) or layer-2
 * (classifier signal).
 *
 * `layer1` — derived from EvidenceResponseRecord[] or EV-003 debt walk only.
 * `layer2` — derived from a composition-layer mutation only.
 * `layer1_with_layer2_corroboration` — both signals agree on the same value.
 * `layer2_overrides_layer1` — chronological conflict; see PILL_STATE_CONFLICT_RULE.
 */
export type PaymentEvidencePillProvenance =
  | 'layer1'
  | 'layer2'
  | 'layer1_with_layer2_corroboration'
  | 'layer2_overrides_layer1';

// ── Composed pill state ──────────────────────────────────────────────

/**
 * The composed pill state for one payment evidence artifact. Carries the two
 * axis statuses + provenance + the existing chip contracts. The renderer
 * reads `applicabilityChip` and `debtChipStatus` directly — the contracts are
 * QOL-037's and EV-003's already-locked output shapes.
 *
 * Existence axis (ReceiptChip) is NOT touched by this card — none of the four
 * mutations describe the source-chain. The receipt chip continues to derive
 * from `summarizeArtifactsForReceiptChip` over the artifact's url/quote/
 * sourceText fields.
 */
export interface PaymentEvidencePillState {
  /** The payment artifact this pill state is for. */
  readonly artifactId: string;
  /** The parent argument id (the move the payment is attached to). */
  readonly parentMoveId: string;
  /** The composed applicability status (after merging mutations + responses). */
  readonly applicabilityStatus: ApplicabilityStatus;
  /** The QOL-037 chip contract for the composed applicability status.
   *  When status is `applicability_undisputed`, `isVisible: false`. */
  readonly applicabilityChip: ApplicabilityChipContract;
  /** The composed obligation status, or null when no debt is open or
   *  resolved on this node. */
  readonly debtChipStatus: EvidenceDebtStatus | null;
  /** Provenance for the applicability axis. */
  readonly applicabilityProvenance: PaymentEvidencePillProvenance;
  /** Provenance for the obligation axis. null when debtChipStatus is null. */
  readonly debtProvenance: PaymentEvidencePillProvenance | null;
}

// ── The frozen four-row mutation → state mapping ─────────────────────

/**
 * The frozen four-row mapping table the card body specifies. Implementer
 * MUST reference this constant; tests assert its shape. Each entry names the
 * source mutation type, the target axis, the target enum value, and the
 * `targetMoveId` the mutation must address for the mapping to fire.
 *
 * Note on `targetMoveId`: the composition layer emits mutations targeting
 * specific moves (COMP-001 §6.3). For pill-state consumption the mutation
 * must target the move the payment artifact is attached TO (i.e. the
 * artifact's `argumentId`). A mutation targeting some OTHER move does not
 * flip THIS payment's chip — that mutation is for a different node's chips.
 */
export const MUTATION_TO_PILL_STATE: readonly {
  readonly mutation:
    | 'evidence_applicability_disputed'
    | 'corroborating_document_attached'
    | 'evidence_debt_opened'
    | 'evidence_debt_resolved';
  readonly axis: 'applicability' | 'obligation';
  readonly enumValue: ApplicabilityStatus | EvidenceDebtStatus;
  readonly targetSelector: 'parent_of_corroborating_move' | 'artifact_parent';
}[] = Object.freeze([
  Object.freeze({
    mutation: 'evidence_applicability_disputed',
    axis: 'applicability',
    enumValue: 'applicability_disputed',
    targetSelector: 'artifact_parent',
  }),
  Object.freeze({
    mutation: 'corroborating_document_attached',
    axis: 'applicability',
    enumValue: 'applicability_supported',
    // `corroborating_document_attached` fires on the CORROBORATING move, not on
    // the move that holds the payment artifact. The deriver walks the
    // corroborator's parent chain to find which payment artifact it
    // corroborates (the ancestor whose artifact the corroborator references)
    // OR consumes a caller-supplied corroboratedByArgumentIds[] (the same
    // mechanism QOL-037's deriveApplicabilityStatus already accepts).
    targetSelector: 'parent_of_corroborating_move',
  }),
  Object.freeze({
    mutation: 'evidence_debt_opened',
    axis: 'obligation',
    enumValue: 'requested',
    targetSelector: 'artifact_parent',
  }),
  Object.freeze({
    mutation: 'evidence_debt_resolved',
    axis: 'obligation',
    enumValue: 'supplied',
    targetSelector: 'artifact_parent',
  }),
]);

// ── The frozen conflict-resolution rule ──────────────────────────────

/**
 * The frozen conflict-resolution rule. See QOL-036.1 §5.3.
 */
export const PILL_STATE_CONFLICT_RULE = Object.freeze({
  /** Within an axis, the later signal wins (by `sourceMoveId` createdAt). */
  withinAxis: 'last_wins_by_source_move_created_at' as const,
  /** Cross-axis mutations do not conflict (applicability + obligation are
   *  orthogonal axes; both stack on the same artifact). */
  crossAxis: 'orthogonal_stack' as const,
  /** When a mutation and a layer-1 record disagree on the same axis, the more
   *  recent signal wins by `createdAt`. Ties prefer layer-1 (user action). */
  layerConflict: 'last_wins_layer1_wins_ties' as const,
});

// ── Input bundle ─────────────────────────────────────────────────────

/**
 * Input bundle for `derivePaymentEvidencePillState`.
 */
export interface DerivePaymentEvidencePillStateInput {
  /** The payment evidence artifact whose pill state we are composing. */
  readonly artifact: EvidenceArtifact;
  /**
   * Composition-layer mutations whose `targetMoveId === artifact.argumentId`.
   * Caller obtains via `useSemanticReferee.getMutationsForMove(artifact.argumentId)`.
   * May be empty (observer mode, no classifier run, etc.). The deriver assumes
   * the caller has pre-filtered by target; mutations whose `targetMoveId` does
   * NOT match the artifact's parent simply produce no effect (defensive).
   */
  readonly mutationsTargetingArtifactParent: readonly NodeVisualMutation[];
  /**
   * Composition-layer mutations whose `sourceMoveId` corroborates this
   * artifact (mutations of type `corroborating_document_attached` whose
   * ancestor chain includes the artifact's parent). Caller pre-filters
   * these — the deriver does not walk ancestor chains itself (pure
   * data-in, data-out).
   */
  readonly corroboratingMutations: readonly NodeVisualMutation[];
  /** QOL-037 evidence-response records targeting this artifact. May be empty. */
  readonly responses: readonly EvidenceResponseRecord[];
  /** EV-003 evidence debts attached to the artifact's parent node. May be empty. */
  readonly debts: readonly EvidenceDebt[];
  /**
   * Optional argument-id → ISO-8601 createdAt map for chronological merge.
   * Required only when the caller wants accurate layer-conflict resolution;
   * when absent, the deriver falls back to layer-1-wins (safe default).
   */
  readonly moveCreatedAtById?: ReadonlyMap<string, string>;
  /**
   * Optional pass-through for QOL-037's existing corroboration mechanism.
   * When supplied, augments the layer-1 derivation (a corroborating move
   * already on file can resolve a dispute regardless of layer-2 mutations).
   */
  readonly layer1CorroboratedByArgumentIds?: ReadonlyArray<string>;
}

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Canonical deterministic ordering for within-axis tie-breaking when two
 * mutations carry identical `createdAt` timestamps. Earlier in the list →
 * wins. Documented in QOL-036.1 §5.3. The order matches the canonical
 * within-axis pairs that COMP-001 emits: a `provides_evidence` resolution
 * dominates an `asks_for_evidence` open (the resolved state is "later" in
 * the classifier's per-move emit order); a `supplies_corroborating_document`
 * dominates a `disputes_evidence_applicability` (a corroborating answer is
 * "later" than an opening dispute).
 */
const CLASSIFIER_TIE_BREAK_ORDER: readonly string[] = [
  'provides_evidence',
  'evidence_supports_claim',
  'supplies_corroborating_document',
  'asks_for_evidence',
  'disputes_evidence_applicability',
];

/**
 * Stable tie-break index. Unknown classifier strings sort LAST (largest
 * index) so a known classifier always wins over an unknown one.
 */
function tieBreakIndex(sourceClassifier: string): number {
  const idx = CLASSIFIER_TIE_BREAK_ORDER.indexOf(sourceClassifier);
  return idx === -1 ? CLASSIFIER_TIE_BREAK_ORDER.length : idx;
}

/**
 * Look up the createdAt for a move id. Missing entries return '' (empty
 * string sorts earlier than any non-empty ISO string, so an unknown
 * timestamp loses last-wins by default).
 */
function lookupCreatedAt(
  moveCreatedAtById: ReadonlyMap<string, string> | undefined,
  moveId: string,
): string {
  if (!moveCreatedAtById) return '';
  return moveCreatedAtById.get(moveId) ?? '';
}

/**
 * Pick the latest of two mutation/createdAt entries. Stable tie-break by
 * classifier order, then by array index (the caller passes the index).
 *
 * Returns true when `candidate` should win over `incumbent`.
 */
function candidateWinsByLastWins(
  candidateCreatedAt: string,
  candidateClassifier: string,
  candidateIndex: number,
  incumbentCreatedAt: string,
  incumbentClassifier: string,
  incumbentIndex: number,
): boolean {
  if (candidateCreatedAt > incumbentCreatedAt) return true;
  if (candidateCreatedAt < incumbentCreatedAt) return false;
  // Equal timestamps — break by canonical classifier order.
  const ci = tieBreakIndex(candidateClassifier);
  const ii = tieBreakIndex(incumbentClassifier);
  if (ci < ii) return true;
  if (ci > ii) return false;
  // Final stable tie-break — later array index wins.
  return candidateIndex > incumbentIndex;
}

/**
 * Find the within-axis last-winning mutation among a list of mutations for
 * one axis. Returns null when the list is empty.
 *
 * `axisFilter` keeps only mutations whose value we know how to map onto the
 * axis (the four named in MUTATION_TO_PILL_STATE).
 */
function selectLastWinsForAxis<TStatus>(
  mutations: ReadonlyArray<NodeVisualMutation>,
  axisFilter: (m: NodeVisualMutation) => TStatus | null,
  moveCreatedAtById: ReadonlyMap<string, string> | undefined,
): { mutation: NodeVisualMutation; status: TStatus } | null {
  let bestMutation: NodeVisualMutation | null = null;
  let bestStatus: TStatus | null = null;
  let bestCreatedAt = '';
  let bestClassifier = '';
  let bestIndex = -1;

  for (let i = 0; i < mutations.length; i += 1) {
    const mutation = mutations[i];
    const status = axisFilter(mutation);
    if (status === null) continue;

    const createdAt = lookupCreatedAt(moveCreatedAtById, mutation.sourceMoveId);
    const classifier = String(mutation.sourceClassifier);

    if (bestMutation === null) {
      bestMutation = mutation;
      bestStatus = status;
      bestCreatedAt = createdAt;
      bestClassifier = classifier;
      bestIndex = i;
      continue;
    }

    if (
      candidateWinsByLastWins(
        createdAt,
        classifier,
        i,
        bestCreatedAt,
        bestClassifier,
        bestIndex,
      )
    ) {
      bestMutation = mutation;
      bestStatus = status;
      bestCreatedAt = createdAt;
      bestClassifier = classifier;
      bestIndex = i;
    }
  }

  if (bestMutation === null || bestStatus === null) return null;
  return { mutation: bestMutation, status: bestStatus };
}

// ── Applicability axis ───────────────────────────────────────────────

/**
 * Map a mutation to an `ApplicabilityStatus`, or null if it's not an
 * applicability-axis mutation. Only the two named mutations contribute.
 *
 * IMPORTANT — target filter. Only `evidence_applicability_disputed` whose
 * `targetMoveId` matches the artifact's parent contributes from the
 * applicability-axis target bucket. `corroborating_document_attached`
 * arrives via the separate `corroboratingMutations` bucket (caller-filtered)
 * and is handled by `applyCorroborationFromLayer2`.
 */
function applicabilityFromMutation(
  mutation: NodeVisualMutation,
  artifactParentId: string,
): ApplicabilityStatus | null {
  if (mutation.mutation === 'evidence_applicability_disputed') {
    if (mutation.targetMoveId !== artifactParentId) return null;
    return 'applicability_disputed';
  }
  // corroborating_document_attached is routed via `corroboratingMutations`.
  // A copy of it that accidentally appears in the artifact-target bucket is
  // ignored here (the corroborator targets ITSELF, not the artifact's parent).
  return null;
}

/**
 * Compose the applicability axis. Returns the final status + chip + provenance.
 */
function composeApplicabilityAxis(input: {
  artifactParentId: string;
  mutationsTargetingArtifactParent: readonly NodeVisualMutation[];
  corroboratingMutations: readonly NodeVisualMutation[];
  responses: readonly EvidenceResponseRecord[];
  moveCreatedAtById: ReadonlyMap<string, string> | undefined;
  layer1CorroboratedByArgumentIds: ReadonlyArray<string> | undefined;
}): {
  status: ApplicabilityStatus;
  chip: ApplicabilityChipContract;
  provenance: PaymentEvidencePillProvenance;
} {
  // Layer-1 derivation (QOL-037).
  const layer1Options: DeriveApplicabilityStatusOptions | undefined =
    input.layer1CorroboratedByArgumentIds !== undefined
      ? { corroboratedByArgumentIds: input.layer1CorroboratedByArgumentIds }
      : undefined;
  const layer1Status = deriveApplicabilityStatus(input.responses, layer1Options);
  const hasLayer1Signal = input.responses.length > 0;

  // Within-axis pass over the artifact-target mutations bucket (only
  // `evidence_applicability_disputed` contributes here).
  const layer2Dispute = selectLastWinsForAxis<ApplicabilityStatus>(
    input.mutationsTargetingArtifactParent,
    (m) => applicabilityFromMutation(m, input.artifactParentId),
    input.moveCreatedAtById,
  );

  // Within-axis pass over the corroborating bucket (only
  // `corroborating_document_attached` contributes).
  const layer2Corroboration = selectLastWinsForAxis<ApplicabilityStatus>(
    input.corroboratingMutations,
    (m) =>
      m.mutation === 'corroborating_document_attached'
        ? 'applicability_supported'
        : null,
    input.moveCreatedAtById,
  );

  // Pick the within-axis layer-2 winner by last-wins across the two buckets.
  let layer2Status: ApplicabilityStatus | null = null;
  let layer2SourceMoveId: string | null = null;
  let layer2Classifier: string | null = null;

  if (layer2Dispute && layer2Corroboration) {
    // Two layer-2 candidates on the same axis from different buckets.
    const dCreatedAt = lookupCreatedAt(
      input.moveCreatedAtById,
      layer2Dispute.mutation.sourceMoveId,
    );
    const cCreatedAt = lookupCreatedAt(
      input.moveCreatedAtById,
      layer2Corroboration.mutation.sourceMoveId,
    );
    if (
      candidateWinsByLastWins(
        cCreatedAt,
        String(layer2Corroboration.mutation.sourceClassifier),
        1,
        dCreatedAt,
        String(layer2Dispute.mutation.sourceClassifier),
        0,
      )
    ) {
      layer2Status = layer2Corroboration.status;
      layer2SourceMoveId = layer2Corroboration.mutation.sourceMoveId;
      layer2Classifier = String(layer2Corroboration.mutation.sourceClassifier);
    } else {
      layer2Status = layer2Dispute.status;
      layer2SourceMoveId = layer2Dispute.mutation.sourceMoveId;
      layer2Classifier = String(layer2Dispute.mutation.sourceClassifier);
    }
  } else if (layer2Dispute) {
    layer2Status = layer2Dispute.status;
    layer2SourceMoveId = layer2Dispute.mutation.sourceMoveId;
    layer2Classifier = String(layer2Dispute.mutation.sourceClassifier);
  } else if (layer2Corroboration) {
    layer2Status = layer2Corroboration.status;
    layer2SourceMoveId = layer2Corroboration.mutation.sourceMoveId;
    layer2Classifier = String(layer2Corroboration.mutation.sourceClassifier);
  }

  const hasLayer2Signal = layer2Status !== null;

  // Compose layer-1 + layer-2.
  let status: ApplicabilityStatus;
  let provenance: PaymentEvidencePillProvenance;

  if (!hasLayer2Signal && !hasLayer1Signal) {
    status = 'applicability_undisputed';
    provenance = 'layer1';
  } else if (!hasLayer2Signal) {
    status = layer1Status;
    provenance = 'layer1';
  } else if (!hasLayer1Signal) {
    // layer-2 is the sole signal; layer1Status is `applicability_undisputed`.
    status = layer2Status as ApplicabilityStatus;
    provenance = 'layer2';
  } else if (layer1Status === layer2Status) {
    // Both layers agree.
    status = layer1Status;
    provenance = 'layer1_with_layer2_corroboration';
  } else {
    // Layer-1 and layer-2 disagree. Apply layer-conflict rule.
    const layer1CreatedAt = findLatestLayer1ApplicabilityCreatedAt(
      input.responses,
      input.moveCreatedAtById,
    );
    const layer2CreatedAt =
      layer2SourceMoveId !== null
        ? lookupCreatedAt(input.moveCreatedAtById, layer2SourceMoveId)
        : '';

    // When chronology is unknown (both empty or moveCreatedAtById absent),
    // layer-1 wins by safe-default. Otherwise last-wins by createdAt.
    const haveChronology =
      input.moveCreatedAtById !== undefined &&
      (layer1CreatedAt !== '' || layer2CreatedAt !== '');

    if (!haveChronology) {
      status = layer1Status;
      provenance = 'layer1';
    } else if (layer2CreatedAt > layer1CreatedAt) {
      status = layer2Status as ApplicabilityStatus;
      provenance = 'layer2_overrides_layer1';
    } else if (layer2CreatedAt < layer1CreatedAt) {
      status = layer1Status;
      provenance = 'layer1';
    } else {
      // Exact tie → layer-1 wins (the more deliberate user-action signal).
      status = layer1Status;
      provenance = 'layer1';
    }
    // Note `layer2Classifier` is captured above but unused on this branch;
    // referenced here so a strict-no-unused-vars rule sees the local.
    void layer2Classifier;
  }

  return {
    status,
    chip: summarizeApplicabilityChip(status),
    provenance,
  };
}

/**
 * The latest layer-1 applicability-axis signal's createdAt — the most-recent
 * `dispute_applicability` or `accept` (the two responses that change the
 * applicability axis per QOL-037 §7.2). Returns '' when neither is present.
 */
function findLatestLayer1ApplicabilityCreatedAt(
  responses: readonly EvidenceResponseRecord[],
  moveCreatedAtById: ReadonlyMap<string, string> | undefined,
): string {
  let latest = '';
  for (const r of responses) {
    if (r.choice !== 'dispute_applicability' && r.choice !== 'accept') continue;
    // Prefer the response's own `respondedAt` (QOL-037's authoritative
    // chronology), falling back to the map if respondedAt is missing.
    const t =
      typeof r.respondedAt === 'string' && r.respondedAt.length > 0
        ? r.respondedAt
        : lookupCreatedAt(moveCreatedAtById, r.argumentId);
    if (t > latest) latest = t;
  }
  return latest;
}

// ── Obligation axis ──────────────────────────────────────────────────

/**
 * Lifecycle advancement order for the obligation axis. Later entries are
 * MORE advanced (more resolved). When a composition mutation would regress
 * the state (e.g. `evidence_debt_resolved` → `supplied` while layer-1
 * already has `accepted_by_both`), the more-advanced layer-1 state wins —
 * see QOL-036.1 §8 case 14.
 *
 * Note this is DIFFERENT from EV-003's `STATUS_SEVERITY_ORDER` (which orders
 * by chip-attention priority for the "multiple debts on one node" pick).
 * Lifecycle advancement is monotonic: a debt that has been `accepted_by_both`
 * does not regress to `supplied`.
 */
const OBLIGATION_LIFECYCLE_ADVANCEMENT: ReadonlyArray<EvidenceDebtStatus> =
  Object.freeze([
    'requested',
    'unresolved',
    'stale',
    'branched',
    'challenged',
    'supplied',
    'accepted_by_participant',
    'accepted_by_both',
  ]);

/** Index in the lifecycle order; unknown → -1 (treated as least-advanced). */
function lifecycleIndex(status: EvidenceDebtStatus): number {
  return OBLIGATION_LIFECYCLE_ADVANCEMENT.indexOf(status);
}

/**
 * Map a mutation to an `EvidenceDebtStatus`, or null if it's not an
 * obligation-axis mutation. Only the two named mutations contribute.
 */
function obligationFromMutation(
  mutation: NodeVisualMutation,
  artifactParentId: string,
): EvidenceDebtStatus | null {
  if (mutation.targetMoveId !== artifactParentId) return null;
  if (mutation.mutation === 'evidence_debt_opened') return 'requested';
  if (mutation.mutation === 'evidence_debt_resolved') return 'supplied';
  return null;
}

/**
 * Worst-status pick over a list of layer-1 debts, mirroring EV-003's
 * `worstStatus` semantics. Returns null when the list is empty. We only
 * consider debts attached to the artifact's parent node.
 */
function worstLayer1DebtStatus(
  debts: readonly EvidenceDebt[],
  artifactParentId: string,
): EvidenceDebtStatus | null {
  // EV-003 attention-priority order (worse = wins, lower index).
  const ATTENTION_ORDER: ReadonlyArray<EvidenceDebtStatus> = [
    'challenged',
    'unresolved',
    'stale',
    'requested',
    'branched',
    'supplied',
    'accepted_by_participant',
    'accepted_by_both',
  ];
  let best: EvidenceDebtStatus | null = null;
  let bestIndex = ATTENTION_ORDER.length;
  for (const d of debts) {
    if (d.nodeId !== artifactParentId) continue;
    const idx = ATTENTION_ORDER.indexOf(d.status);
    const safeIdx = idx < 0 ? ATTENTION_ORDER.length - 1 : idx;
    if (safeIdx < bestIndex) {
      bestIndex = safeIdx;
      best = d.status;
    }
  }
  return best;
}

/**
 * The most-recent createdAt across layer-1 debts on the artifact's parent
 * (used for layer-conflict resolution). Prefers `resolvedAt` when present
 * (more recent of the two), else `requestedAt`.
 */
function latestLayer1DebtCreatedAt(
  debts: readonly EvidenceDebt[],
  artifactParentId: string,
): string {
  let latest = '';
  for (const d of debts) {
    if (d.nodeId !== artifactParentId) continue;
    const t = d.resolvedAt && d.resolvedAt > d.requestedAt ? d.resolvedAt : d.requestedAt;
    if (typeof t === 'string' && t > latest) latest = t;
  }
  return latest;
}

/**
 * Compose the obligation axis. Returns the composed status (or null) +
 * provenance.
 */
function composeObligationAxis(input: {
  artifactParentId: string;
  mutationsTargetingArtifactParent: readonly NodeVisualMutation[];
  debts: readonly EvidenceDebt[];
  moveCreatedAtById: ReadonlyMap<string, string> | undefined;
}): {
  status: EvidenceDebtStatus | null;
  provenance: PaymentEvidencePillProvenance | null;
} {
  // Layer-1: worst-status pick over debts attached to this node.
  const layer1Status = worstLayer1DebtStatus(input.debts, input.artifactParentId);
  const hasLayer1Signal = layer1Status !== null;

  // Layer-2: within-axis last-wins over obligation-axis mutations.
  const layer2 = selectLastWinsForAxis<EvidenceDebtStatus>(
    input.mutationsTargetingArtifactParent,
    (m) => obligationFromMutation(m, input.artifactParentId),
    input.moveCreatedAtById,
  );
  const hasLayer2Signal = layer2 !== null;

  if (!hasLayer1Signal && !hasLayer2Signal) {
    return { status: null, provenance: null };
  }

  if (!hasLayer2Signal && hasLayer1Signal) {
    return { status: layer1Status, provenance: 'layer1' };
  }

  if (!hasLayer1Signal && hasLayer2Signal) {
    return { status: layer2!.status, provenance: 'layer2' };
  }

  // Both layers present.
  if (layer1Status === layer2!.status) {
    return {
      status: layer1Status,
      provenance: 'layer1_with_layer2_corroboration',
    };
  }

  // Disagreement — apply the lifecycle-advancement guard FIRST (per §8.14):
  // do not regress a more-advanced layer-1 lifecycle state via a layer-2
  // mutation that would downgrade it.
  const layer1Adv = lifecycleIndex(layer1Status as EvidenceDebtStatus);
  const layer2Adv = lifecycleIndex(layer2!.status);
  if (layer1Adv >= 0 && layer2Adv >= 0 && layer1Adv > layer2Adv) {
    // Layer-1 is strictly more advanced; do not downgrade.
    return { status: layer1Status, provenance: 'layer1' };
  }

  // Otherwise apply last-wins by chronology.
  const layer1CreatedAt = latestLayer1DebtCreatedAt(
    input.debts,
    input.artifactParentId,
  );
  const layer2CreatedAt = lookupCreatedAt(
    input.moveCreatedAtById,
    layer2!.mutation.sourceMoveId,
  );
  const haveChronology =
    input.moveCreatedAtById !== undefined &&
    (layer1CreatedAt !== '' || layer2CreatedAt !== '');

  if (!haveChronology) {
    return { status: layer1Status, provenance: 'layer1' };
  }
  if (layer2CreatedAt > layer1CreatedAt) {
    return { status: layer2!.status, provenance: 'layer2_overrides_layer1' };
  }
  if (layer2CreatedAt < layer1CreatedAt) {
    return { status: layer1Status, provenance: 'layer1' };
  }
  // Exact tie → layer-1 wins.
  return { status: layer1Status, provenance: 'layer1' };
}

// ── Public deriver ───────────────────────────────────────────────────

/**
 * Derive the composed pill state for one payment evidence artifact. Pure.
 * Deterministic. Same input → deeply-equal output across consecutive calls.
 *
 * Composition is per-axis-independent (applicability + obligation are
 * orthogonal — `PILL_STATE_CONFLICT_RULE.crossAxis === 'orthogonal_stack'`).
 * Both chips can render together on a single artifact at the same time.
 */
export function derivePaymentEvidencePillState(
  input: DerivePaymentEvidencePillStateInput,
): PaymentEvidencePillState {
  const artifact = input.artifact;
  const artifactParentId = artifact.argumentId;

  const applicabilityResult = composeApplicabilityAxis({
    artifactParentId,
    mutationsTargetingArtifactParent: input.mutationsTargetingArtifactParent,
    corroboratingMutations: input.corroboratingMutations,
    responses: input.responses,
    moveCreatedAtById: input.moveCreatedAtById,
    layer1CorroboratedByArgumentIds: input.layer1CorroboratedByArgumentIds,
  });

  const obligationResult = composeObligationAxis({
    artifactParentId,
    mutationsTargetingArtifactParent: input.mutationsTargetingArtifactParent,
    debts: input.debts,
    moveCreatedAtById: input.moveCreatedAtById,
  });

  return {
    artifactId: artifact.id,
    parentMoveId: artifactParentId,
    applicabilityStatus: applicabilityResult.status,
    applicabilityChip: applicabilityResult.chip,
    debtChipStatus: obligationResult.status,
    applicabilityProvenance: applicabilityResult.provenance,
    debtProvenance: obligationResult.provenance,
  };
}
