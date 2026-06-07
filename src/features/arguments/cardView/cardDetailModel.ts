/**
 * CARD-VIEW-DATA-001 — Card detail view-model (pure TS).
 *
 * `buildCardDetailViewModel(input)` composes the data the Inspect popout
 * surfaces (says / why-it-matters / unresolved / where-it-sits /
 * suggested-next / semantic-flags / evidence-detail) onto a single
 * JSON-serializable shape that the ACTIVE card renders inline BY DEFAULT
 * (no tap). The Card page is the "data readily loaded and visible by
 * default" surface; the Timeline page keeps its tap-to-reveal behaviour
 * untouched.
 *
 * Zones (rendered in order on the active card), ALL display-only labels
 * except the step-reference parent token (a real button → jump to parent):
 *
 *   1. Step reference   — position context ("Opening claim (#1)" /
 *                         "Acting on #4 (rebuttal) · Replied to #3 (claim)").
 *                         Reuses `buildStepReferenceLine`.
 *   2. Category + qualifier — plain-language labels.
 *   3. (body — rendered by the card itself, not this model)
 *   4. Classifier strip — machine observations as labels with confidence
 *                         PIPS (never a number). Reuses
 *                         `buildCardClassifierStrip` (§10a surface filter
 *                         drops composer_only / inspect_only marks).
 *   5. Evidence         — attached sources/quotes + plain-language
 *                         evidence-debt summary.
 *   6. Point standing   — the move's advisory standing hint (no verdict).
 *   7. Lifecycle        — current lifecycle state in plain language via
 *                         `toPlainLanguage` (unknown codes suppressed).
 *   8. Semantic flags   — plain-language flag labels (the same data the
 *                         Inspect §semantic-flags section shows). Labels.
 *
 * Doctrine (cdiscourse-doctrine + card §1 / §10a / policy_no_censorship):
 *   - Machine observations / classifiers are ADVISORY, never verdicts and
 *     never an acceptance gate. They carry no truth value.
 *   - NEVER surface `inactive_reason` or any "why hidden" text.
 *   - Plain language only; unknown internal codes are SUPPRESSED, not
 *     echoed raw (§9 / §10a).
 *   - No verdict tokens (winner / loser / true / false / liar / …) appear
 *     in any output field.
 *
 * Pure TS. No React. No Supabase. No network. No AI. No `Date.now()`,
 * no `Math.random()`, no mutation of inputs. Deterministic.
 */

import type { AutoMetadataCode, ManualTagEntry } from '../../metadata/moveMetadataLedger';
import type { PointLifecycleState } from '../../lifecycle/pointLifecycleModel';
import { toPlainLanguageOrSuppress } from '../gameCopy';
// CARD-VIEW-DETAIL-HUB-001 (Slice 1) — the shared detail builders are
// imported from the SINGLE canonical module `detail/argumentDetailModel.ts`
// so the Timeline and Cards surfaces can never fork. `buildStepReferenceLine`
// and `buildCardClassifierStrip` physically live in their own modules and are
// re-exported by the shared module; `artifactsToEvidenceSources` + the
// evidence types physically live in the shared module.
import {
  artifactsToEvidenceSources,
  buildCardClassifierStrip,
  buildFullTags,
  buildHubClassifier,
  buildParentComparisonBubble,
  buildParentQuoteSlice,
  buildStandingToneHeatStrip,
  buildStepReferenceLine,
  type BuildCardClassifierStripInput,
  type BuildStepReferenceLineInput,
  type CardClassifierStripModel,
  type CardDetailEvidenceSource,
  type CardDetailEvidenceZone,
  type CardStepReferenceLine,
  type DetailFullTagsModel,
  type DetailParentComparisonBubble,
  type DetailParentQuoteSlice,
  type DetailSemanticFlagsSection,
  type DetailStandingToneHeatStrip,
  type HubClassifierGroupsModel,
} from '../detail/argumentDetailModel';
import type {
  ArgumentBubbleActor,
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
} from '../argumentGameSurfaceModel';

// Re-exported so existing consumers of `cardDetailModel` (e.g.
// `ArgumentGameSurface`) keep their import path unchanged.
export { artifactsToEvidenceSources };
export type { CardDetailEvidenceSource, CardDetailEvidenceZone };

// ── Locked plain-language copy (doctrine-anchored constants) ──────────

/** Empty state for the evidence zone — never "no issues" (a verdict). */
export const CARD_DETAIL_EVIDENCE_EMPTY = 'No evidence attached yet.';

/** Empty state for the standing zone. */
export const CARD_DETAIL_STANDING_EMPTY = 'No standing change recorded.';

/**
 * Codes that must NEVER be rendered on the card, even though
 * `toPlainLanguage` carries a mapping for them (card §1 /
 * policy_no_censorship). `inactive_reason` / `inactive_by` are the
 * "why hidden" / admin-note codes — surfacing them on a participant card
 * leaks moderation reasoning. They are suppressed to `null` here.
 */
const LIFECYCLE_FORBIDDEN_CODES: ReadonlySet<string> = new Set([
  'inactive_reason',
  'inactive_by',
]);

// ── Public model shapes ───────────────────────────────────────────────
//
// `CardDetailEvidenceSource` / `CardDetailEvidenceZone` are defined in the
// shared `detail/argumentDetailModel.ts` module and re-exported above.

/**
 * The full card-detail view-model. JSON-serializable. Every zone is safe
 * to render directly; absent zones are `null` / empty so the card can omit
 * them without a special case.
 */
export interface CardDetailViewModel {
  /** Zone 1 — step-reference header line (parent token is the only button). */
  stepReference: CardStepReferenceLine;
  /** Zone 2 — plain-language category label, or null when none. */
  categoryLabel: string | null;
  /** Zone 2 — plain-language qualifier labels (display-only). */
  qualifierLabels: ReadonlyArray<string>;
  /** Zone 4 — classifier strip (machine observations, label-style). */
  classifierStrip: CardClassifierStripModel;
  /** Zone 5 — evidence sources + debt summary. */
  evidence: CardDetailEvidenceZone;
  /** Zone 6 — advisory point-standing label, or null when none. */
  standingLabel: string | null;
  /** Zone 7 — lifecycle state in plain language, or null when unknown. */
  lifecycleLabel: string | null;
  /** Zone 8 — plain-language semantic-flag labels (display-only). */
  flagLabels: ReadonlyArray<string>;

  // ── CARD-VIEW-DETAIL-HUB-001 (Slice 2) — Cards hub slices ──────────
  // Always present (never undefined) so the panel renders without special
  // cases; the degrade/empty path is encoded INSIDE each slice.

  /** ask i — italic replied-to parent quote (or neutral degrade). */
  parentQuote: DetailParentQuoteSlice;
  /** Slice 3 — the off-center colored parent COMPARISON bubble (operator
   *  refinement). Upgrades the inline parent quote into a distinct-color
   *  bubble above the centerpiece; `kind: 'none'` → render nothing (degrade). */
  parentComparison: DetailParentComparisonBubble;
  /** ask v — Standing / Tone / Heat strip (plain-language), or null when
   *  no active node is available (degenerate input). */
  standingToneHeat: DetailStandingToneHeatStrip | null;
  /** ask iii — all-families family-grouped classifiers (A–G gated). */
  hubClassifier: HubClassifierGroupsModel;
  /** ask ii — full semantic tags, doctrine-grouped. */
  fullTags: DetailFullTagsModel;
}

/** Inputs to `buildCardDetailViewModel`. Every field already in scope where
 *  `ArgumentGameSurface` mounts the stack — no new fetch, no service-role. */
export interface BuildCardDetailViewModelInput {
  /** The currently-active message id. */
  activeMessageId: string;

  // ── Zone 1 — step-reference lookups (forwarded to buildStepReferenceLine) ──
  chronologicalIds: ReadonlyArray<string>;
  ordinalOf: (id: string) => number | null;
  kindLabelOf: (id: string) => string;
  parentIdOf: (id: string) => string | null;

  // ── Zone 2 — category / qualifier (already-resolved plain labels) ──
  /** Plain-language category label for the active message, or null. */
  categoryLabel: string | null;
  /** Plain-language qualifier labels for the active message. */
  qualifierLabels: ReadonlyArray<string>;

  // ── Zone 4 — classifier strip inputs (forwarded to buildCardClassifierStrip) ──
  persistedClassifierRows: ReadonlyArray<unknown>;
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  clusterState: PointLifecycleState;
  messageContribution: PointLifecycleState | null;

  // ── Zone 5 — evidence ──
  /** Attached evidence sources as display labels. */
  evidenceSources: ReadonlyArray<CardDetailEvidenceSource>;
  /** Plain-language evidence-debt summary, or null when no debt. */
  evidenceDebtSummary: string | null;

  // ── Zone 6 — point standing (already-derived advisory hint) ──
  /** Advisory point-standing hint for the active message, or null. */
  standingHint: string | null;

  // ── Zone 7 — lifecycle (internal code, mapped through toPlainLanguage) ──
  /** Internal lifecycle state code for the active message, or null. */
  lifecycleState: string | null;

  // ── Zone 8 — semantic flags (already-resolved plain labels) ──
  /** Plain-language semantic-flag labels for the active message. */
  flagLabels: ReadonlyArray<string>;

  // ── CARD-VIEW-DETAIL-HUB-001 (Slice 2) — Cards hub inputs ─────────
  // All optional + additive: #516-era callers omit them and the builder
  // produces the safe empty/degrade slice for each.

  /** ask i — parent node `bodyPreview` resolved off `timelineMap` by the
   *  caller (no fetch). null / absent → neutral "Parent unavailable" degrade. */
  parentBodyPreview?: string | null;

  // ── Slice 3 — parent COMPARISON bubble inputs (operator refinement) ──
  // All optional + additive: when omitted the comparison bubble degrades to
  // `kind: 'none'` (no bubble) exactly as a root / unresolvable parent would.

  /** Parent 1-based ordinal, resolved off `timelineMap` by the caller. */
  parentOrdinal?: number | null;
  /** Parent plain-language kind label (e.g. "rebuttal"). */
  parentKindLabel?: string | null;
  /** Parent message id (navigation target for the tappable reference). */
  parentMessageId?: string | null;
  /** Parent actor (drives the comparison-bubble color — who made the move). */
  parentActor?: ArgumentBubbleActor | null;
  /** Parent plain-language actor label (e.g. "Other side"). */
  parentActorLabel?: string | null;

  /** ask v — the active node + view-model, used to format the Standing /
   *  Tone / Heat strip via the shared plain-language formatters. When either
   *  is absent the strip is null (degenerate input). */
  standingToneHeatNode?: ArgumentTimelineMapNode | null;
  standingToneHeatViewModel?: ArgumentBubbleViewModel | null;

  /** ask ii — structural labels (dropped-tag qualifiers, already plain). */
  structuralTagLabels?: ReadonlyArray<string>;

  /** Shared semantic-flag section (Observations + Allegations) for the
   *  full-tags grouping. When absent, the full-tags Observation/Allegation
   *  groups are empty (the Zone-8 `flagLabels` still render as before). */
  semanticFlagsSection?: DetailSemanticFlagsSection | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Trim + drop empties; preserve order. Pure. */
function cleanLabels(labels: ReadonlyArray<string> | undefined): string[] {
  if (!Array.isArray(labels)) return [];
  return labels
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Trim a single label, returning null for empty/non-string. Pure. */
function cleanLabel(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// `artifactsToEvidenceSources` is defined in the shared
// `detail/argumentDetailModel.ts` module and re-exported above.

// ── Builder ───────────────────────────────────────────────────────────

/**
 * Build the card-detail view-model for the active message. Pure.
 *
 * Returns safe empty zones for every degenerate input (missing active id,
 * no marks, no evidence). Never throws. Never surfaces `inactive_reason`
 * or any raw internal code — the lifecycle code routes through
 * `toPlainLanguageOrSuppress` so an unknown code yields `null` (suppressed)
 * rather than leaking.
 */
export function buildCardDetailViewModel(
  input: BuildCardDetailViewModelInput,
): CardDetailViewModel {
  const stepRefInput: BuildStepReferenceLineInput = {
    activeMessageId: input?.activeMessageId ?? '',
    chronologicalIds: input?.chronologicalIds ?? [],
    ordinalOf: input?.ordinalOf ?? (() => null),
    kindLabelOf: input?.kindLabelOf ?? (() => 'move'),
    parentIdOf: input?.parentIdOf ?? (() => null),
  };
  const stepReference = buildStepReferenceLine(stepRefInput);

  const classifierInput: BuildCardClassifierStripInput = {
    activeMessageId: input?.activeMessageId ?? '',
    persistedClassifierRows: input?.persistedClassifierRows ?? [],
    manualTagEntries: input?.manualTagEntries ?? [],
    autoMetadataCodes: input?.autoMetadataCodes ?? [],
    clusterState: input?.clusterState ?? 'open',
    messageContribution: input?.messageContribution ?? null,
  };
  const classifierStrip = buildCardClassifierStrip(classifierInput);

  // Zone 5 — evidence. Sources are already plain-language display labels;
  // the debt summary is already a plain-language sentence (no raw code).
  const sources = (Array.isArray(input?.evidenceSources) ? input.evidenceSources : [])
    .filter((s): s is CardDetailEvidenceSource => Boolean(s && typeof s.id === 'string'))
    .map((s) => ({ id: s.id, label: cleanLabel(s.label) ?? '' }))
    .filter((s) => s.label.length > 0);
  const debtSummary = cleanLabel(input?.evidenceDebtSummary);
  const evidence: CardDetailEvidenceZone = {
    sources,
    debtSummary,
    emptyStateCopy: CARD_DETAIL_EVIDENCE_EMPTY,
    hasSource: sources.length > 0,
  };

  // Zone 7 — lifecycle. Route the internal code through the plain-language
  // mapping; an unknown / unmapped code is SUPPRESSED (null), never echoed.
  // The "why hidden" / admin-note codes are forbidden on the participant
  // card (card §1 / policy_no_censorship) and suppressed even though they
  // carry a mapping.
  const rawLifecycle = input?.lifecycleState ?? null;
  const lifecycleLabel =
    rawLifecycle && LIFECYCLE_FORBIDDEN_CODES.has(rawLifecycle)
      ? null
      : toPlainLanguageOrSuppress(rawLifecycle);

  // ── CARD-VIEW-DETAIL-HUB-001 (Slice 2) — Cards hub slices ──────────

  // ask i — parent quote (neutral degrade encoded inside the slice).
  const parentQuote = buildParentQuoteSlice(input?.parentBodyPreview ?? null);

  // Slice 3 — parent COMPARISON bubble (operator refinement). Reuses the
  // parent quote + the parent's actor color; degrades to `kind: 'none'` for a
  // root / unresolvable parent (no bubble rendered). The reference is the only
  // navigation affordance; it is emitted only when ordinal AND id resolve.
  const parentComparison = buildParentComparisonBubble({
    parentBodyPreview: input?.parentBodyPreview ?? null,
    parentOrdinal: input?.parentOrdinal ?? null,
    parentKindLabel: input?.parentKindLabel ?? null,
    parentMessageId: input?.parentMessageId ?? null,
    parentActor: input?.parentActor ?? null,
    parentActorLabel: input?.parentActorLabel ?? null,
  });

  // ask v — Standing / Tone / Heat strip (shared plain-language formatters).
  const sthNode = input?.standingToneHeatNode ?? null;
  const sthVm = input?.standingToneHeatViewModel ?? null;
  const standingToneHeat =
    sthNode && sthVm ? buildStandingToneHeatStrip(sthVm, sthNode) : null;

  // ask iii — all-families family-grouped classifiers (A–G gated, uncapped).
  // Reuses the SAME classifier input as the capped strip; the family gate +
  // grouping live in the shared `buildHubClassifier`.
  const hubClassifier = buildHubClassifier(classifierInput);

  // ask ii — full semantic tags, grouped by the §10a doctrine categories.
  // The status group folds in the (suppressed) category + lifecycle labels.
  const statusLabels: string[] = [];
  const categoryStatus = cleanLabel(input?.categoryLabel);
  if (categoryStatus) statusLabels.push(categoryStatus);
  if (lifecycleLabel) statusLabels.push(lifecycleLabel);
  const fullTags = buildFullTags({
    semanticFlags:
      input?.semanticFlagsSection ?? {
        kind: 'semantic_flags',
        isCondensed: false,
        totalCount: 0,
        chips: [],
      },
    structuralLabels: cleanLabels(input?.structuralTagLabels),
    statusLabels,
  });

  return {
    stepReference,
    categoryLabel: cleanLabel(input?.categoryLabel),
    qualifierLabels: cleanLabels(input?.qualifierLabels),
    classifierStrip,
    evidence,
    standingLabel: cleanLabel(input?.standingHint),
    lifecycleLabel,
    flagLabels: cleanLabels(input?.flagLabels),
    parentQuote,
    parentComparison,
    standingToneHeat,
    hubClassifier,
    fullTags,
  };
}
