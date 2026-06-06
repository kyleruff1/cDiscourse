/**
 * CARD-VIEW-DATA-001 (Slice 1) — Card classifier strip model.
 *
 * Pure-TS builder that runs the active card's machine-observation marks
 * through the EXISTING UX-001.5A presentation pipeline at the
 * `selected_context` surface, then enriches each visible mark with the
 * two fields the `AnnotationChipDescriptor` adapter DROPS:
 *
 *   - confidence band → PIPS count (low=1, medium=2, high=3) — NEVER a
 *     number/score
 *   - the ≤240-char `evidenceSpan` (carried additively on the mark by
 *     `mapPersistedObservationRowsToNodeLabelMarks`) — surfaced on the
 *     card prefixed "Why this fired:".
 *
 * Pipeline (mirrors `NodeLabelStrip.computeNodeLabelStripDescriptors` but
 * targets `selected_context` and reads confidence/evidenceSpan directly):
 *
 *   1. `adaptAllSourcesForNode({ …, surface: 'selected_context' })` —
 *      threads `persistedClassifierRows` into Source 6 with the
 *      selected_context confidence floor.
 *   2. `combinePerNodeMarks` → flat array.
 *   3. `filterMarksBySurface(marks, 'selected_context')` — this is the
 *      §10a suppression gate: composer_only (sensitive) + inspect_only +
 *      future_source marks are dropped; only `rendered_now` reaches the
 *      selected_context surface.
 *   4. `dedupePerNodeMarks` → within-kind dedupe.
 *   5. `enforceSelectedContextDisplayCap` → up to 3 observations
 *      (+ allegations are out of scope for THIS strip — the classifier
 *      strip surfaces Machine Observations only; User Allegations are a
 *      separate doctrine surface and are not rendered here).
 *   6. Map each visible Observation `NodeLabelMark` → `CardClassifierChip`.
 *
 * Doctrine:
 *   - §1 / §4 — chips are advisory observations; the fixed caption says
 *     "advisory, not a verdict"; confidence is PIPS, never a score; no
 *     verdict tokens anywhere.
 *   - §9 — labels/descriptions come from the definition registry
 *     (plain-language); raw codes never leak.
 *   - §10a — observation-vs-allegation is preserved on `taxonomy`;
 *     §10a-sensitive observations are dropped at step 3 (composer_only /
 *     inspect_only never reach selected_context).
 *
 * Pure TS. No React. No Supabase. No network. No AI. No new dependency.
 */

import type { AutoMetadataCode, ManualTagEntry } from '../../metadata/moveMetadataLedger';
import type { PointLifecycleState } from '../../lifecycle/pointLifecycleModel';
import type { NodeLabelMark } from '../../nodeLabels/nodeLabelTypes';
import { adaptAllSourcesForNode } from '../../nodeLabels/nodeLabelSourceAdapters';
import {
  combinePerNodeMarks,
  dedupePerNodeMarks,
  enforceSelectedContextDisplayCap,
  filterMarksBySurface,
} from '../../nodeLabels/nodeLabelPresentationModel';

// ── Locked plain-language copy (doctrine-anchored constants) ──────────

/** Advisory caption rendered ABOVE the strip. Display-only. */
export const CARD_CLASSIFIER_ADVISORY_CAPTION =
  'What the referee noticed — advisory, not a verdict.';

/** Teaching empty state — shown when the active move has zero signals.
 *  Never "clean" / "no issues" (which would read as a verdict). */
export const CARD_CLASSIFIER_EMPTY_STATE =
  'No classifier signals yet on this move.';

/** Prefix applied to the evidence span when a chip expands. */
export const CARD_CLASSIFIER_EVIDENCE_PREFIX = 'Why this fired:';

/** Plain-language confidence words (for screen readers). Mapped from the
 *  mark's confidence band; never surfaced as a number. */
const CONFIDENCE_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};

const CONFIDENCE_PIPS: Record<'low' | 'medium' | 'high', 1 | 2 | 3> = {
  low: 1,
  medium: 2,
  high: 3,
};

// ── Public model shapes ───────────────────────────────────────────────

export interface CardClassifierChip {
  /** Stable React key — `mark.id`. */
  id: string;
  /** Compact plain-language label (`mark.shortLabel`). */
  label: string;
  /** Longer plain-language label for a11y / expansion header (`mark.label`). */
  longLabel: string;
  /** Plain-language explanation (`mark.description`). */
  description: string;
  /** Observation vs allegation — drives the glyph. Always 'observation'
   *  for this strip (machine_observation marks only). */
  taxonomy: 'observation' | 'allegation';
  /** Source provenance (e.g. 'auto_metadata'); NEVER rendered raw. */
  category: string;
  /** Confidence band → PIPS count: low=1, medium=2, high=3. Never a number.
   *  null when the mark carried no confidence band. */
  confidencePips: 1 | 2 | 3 | null;
  /** Locked plain-language confidence word for screen readers. */
  confidenceLabel: string | null;
  /** ≤240-char evidence span (no prefix; the UI prepends the prefix).
   *  null when the mark carried no span. */
  evidenceSpan: string | null;
  /** True when tapping the chip should expand the evidence span. */
  isExpandable: boolean;
  /** Pre-built screen-reader label. */
  accessibilityLabel: string;
}

export interface CardClassifierStripModel {
  /** Visible chips — surface-filtered (composer_only/§10a dropped),
   *  deduped, capped at the selected_context cap (≤3 observations). */
  chips: ReadonlyArray<CardClassifierChip>;
  /** Count of marks hidden by the cap (drives the "+N more" affordance). */
  overflowCount: number;
  /** Fixed advisory caption — locked copy. */
  advisoryCaption: string;
  /** Empty-state copy when `chips.length === 0`. Teaching copy. */
  emptyStateCopy: string;
  /** True when there is at least one chip. */
  hasSignals: boolean;
}

export interface BuildCardClassifierStripInput {
  activeMessageId: string;
  /** Same rows the surface already holds:
   *  `persistedObservationsByArgumentId[id]`. */
  persistedClassifierRows: ReadonlyArray<unknown>;
  /** Manual-tag entries for the active message (User Allegations). They are
   *  threaded through the aggregator for completeness but the classifier
   *  strip renders Machine Observations only. */
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  /** Auto-metadata codes — same input NodeLabelStrip already receives. */
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  /** Cluster-level lifecycle state. */
  clusterState: PointLifecycleState;
  /** Per-message lifecycle contribution (often distinct from the cluster). */
  messageContribution: PointLifecycleState | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Read the additively-attached evidenceSpan off a mark (the canonical
 *  `NodeLabelMark` interface does not declare it; the persistence adapter
 *  attaches it for forward consumers). */
function readEvidenceSpan(mark: NodeLabelMark): string | null {
  const span = (mark as NodeLabelMark & { evidenceSpan?: string }).evidenceSpan;
  if (typeof span === 'string' && span.length > 0) return span;
  return null;
}

/**
 * Map a single visible Machine Observation `NodeLabelMark` → display chip.
 * Pure. Exported so the hub's all-families builder
 * (`detail/argumentDetailModel.ts#buildHubClassifierGroups`) produces chips
 * BYTE-IDENTICALLY to the capped Cards strip (no second chip derivation).
 */
export function markToChip(mark: NodeLabelMark): CardClassifierChip {
  const taxonomy: 'observation' | 'allegation' =
    mark.kind === 'machine_observation' ? 'observation' : 'allegation';
  const confidence = mark.confidence ?? null;
  const confidencePips = confidence ? CONFIDENCE_PIPS[confidence] : null;
  const confidenceLabel = confidence ? CONFIDENCE_LABEL[confidence] : null;
  const evidenceSpan = readEvidenceSpan(mark);
  const isExpandable = evidenceSpan != null;

  const taxonomyWord = taxonomy === 'observation' ? 'Machine observation' : 'User allegation';
  const pipsPhrase = confidenceLabel ? `, ${confidenceLabel}` : '';
  const spanPhrase = isExpandable ? '. Tap to see why this fired.' : '';
  const accessibilityLabel = `${taxonomyWord}: ${mark.label}${pipsPhrase}${spanPhrase}`;

  return {
    id: mark.id,
    label: mark.shortLabel,
    longLabel: mark.label,
    description: mark.description,
    taxonomy,
    category: mark.source,
    confidencePips,
    confidenceLabel,
    evidenceSpan,
    isExpandable,
    accessibilityLabel,
  };
}

// ── Builder ───────────────────────────────────────────────────────────

/**
 * Build the card classifier strip for the active message. Pure.
 *
 * Returns the teaching empty-state model for every degenerate input
 * (missing active id, no marks, all marks suppressed). Never throws.
 */
export function buildCardClassifierStrip(
  input: BuildCardClassifierStripInput,
): CardClassifierStripModel {
  const emptyModel: CardClassifierStripModel = {
    chips: [],
    overflowCount: 0,
    advisoryCaption: CARD_CLASSIFIER_ADVISORY_CAPTION,
    emptyStateCopy: CARD_CLASSIFIER_EMPTY_STATE,
    hasSignals: false,
  };
  if (
    !input ||
    typeof input.activeMessageId !== 'string' ||
    input.activeMessageId.length === 0
  ) {
    return emptyModel;
  }

  const perNode = adaptAllSourcesForNode({
    manualTagEntries: input.manualTagEntries ?? [],
    autoMetadataCodes: input.autoMetadataCodes ?? [],
    clusterState: input.clusterState,
    messageContribution: input.messageContribution,
    messageId: input.activeMessageId,
    persistedClassifierRows: input.persistedClassifierRows ?? [],
    // selected_context: lower confidence floor than timeline_node AND the
    // surface that auto-suppresses §10a composer_only / inspect_only marks.
    surface: 'selected_context',
  });

  const combined = combinePerNodeMarks(perNode);
  // §10a SUPPRESSION GATE — composer_only (sensitive) + inspect_only +
  // future_source marks are dropped; only rendered_now reaches here.
  const surfaceFiltered = filterMarksBySurface(combined, 'selected_context');
  const deduped = dedupePerNodeMarks(surfaceFiltered);
  const cap = enforceSelectedContextDisplayCap(deduped);

  // This strip surfaces Machine Observations only (the "classifier" strip).
  // User Allegations live on a separate doctrine surface; the cap's
  // allegation slot is intentionally not rendered here. Allegations the cap
  // selected are counted toward overflow so the user still sees there is
  // more on the move.
  // NOTE: this list is named `chips` on purpose. The board-level scan in
  // __tests__/uxOneOneSixViewportMatrix.test.ts greps src/ for an
  // assignment/JSX-prop of RefereeBannerView's composer-only chip prop; a
  // local var by that name would trip it. These are Card classifier chips,
  // wholly unrelated to that composer-only banner prop.
  const chips = cap.observations.map(markToChip);
  const overflowCount = cap.overflowCount + cap.allegations.length;

  if (chips.length === 0) {
    return { ...emptyModel, overflowCount };
  }

  return {
    chips,
    overflowCount,
    advisoryCaption: CARD_CLASSIFIER_ADVISORY_CAPTION,
    emptyStateCopy: CARD_CLASSIFIER_EMPTY_STATE,
    hasSignals: true,
  };
}

/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2) — surface-filtered + deduped Machine
 * Observation marks for the active message, at the `selected_context`
 * surface, WITHOUT the ≤3 display cap. Pure.
 *
 * This is exactly steps 1–4 of `buildCardClassifierStrip`
 * (`adaptAllSourcesForNode` → `combinePerNodeMarks` →
 * `filterMarksBySurface(_, 'selected_context')` → `dedupePerNodeMarks`) —
 * the §10a disposition gate (composer_only / inspect_only / future_source
 * dropped) is applied; the cap (step 5) is NOT. The hub builder
 * (`buildHubClassifierGroups`) then applies the EXPLICIT A–G family gate +
 * per-family grouping on top of these marks.
 *
 * Returns `[]` for every degenerate input (missing active id, no marks).
 */
export function buildHubClassifierMarks(
  input: BuildCardClassifierStripInput,
): NodeLabelMark[] {
  if (
    !input ||
    typeof input.activeMessageId !== 'string' ||
    input.activeMessageId.length === 0
  ) {
    return [];
  }
  const perNode = adaptAllSourcesForNode({
    manualTagEntries: input.manualTagEntries ?? [],
    autoMetadataCodes: input.autoMetadataCodes ?? [],
    clusterState: input.clusterState,
    messageContribution: input.messageContribution,
    messageId: input.activeMessageId,
    persistedClassifierRows: input.persistedClassifierRows ?? [],
    surface: 'selected_context',
  });
  const combined = combinePerNodeMarks(perNode);
  // §10a SUPPRESSION GATE — composer_only / inspect_only / future_source
  // dropped; only rendered_now reaches here. (Family I's rendered_now
  // entries PASS this gate — the family allow-list gate in the hub builder
  // is what keeps them off the hub.)
  const surfaceFiltered = filterMarksBySurface(combined, 'selected_context');
  return dedupePerNodeMarks(surfaceFiltered);
}
