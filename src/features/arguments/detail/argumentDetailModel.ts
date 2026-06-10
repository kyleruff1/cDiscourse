/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 1) — shared argument-detail derivation.
 *
 * This is the SINGLE SOURCE for the per-node detail derivation that BOTH
 * the Timeline detail (`ArgumentReplySidecar`) and the Cards detail
 * (`CardDetailPanel` / its hub successor) consume. Fork 2 of the ratified
 * design ("share the model, project the view") makes this module the
 * no-fork foundation: the narrative/detail derivation lives in exactly ONE
 * place so the two surfaces can never drift apart.
 *
 * What this module owns (single canonical definition):
 *   - the band formatters `formatStandingLine` / `formatToneLine` /
 *     `formatHeatLine` (+ `PARENT_BODY_PREVIEW_CAP`),
 *   - the semantic-flag chip builder `buildSectionSemanticFlags` and its
 *     chip / section types.
 *
 * What this module re-exports (so both surfaces import from one place):
 *   - `buildStepReferenceLine` (from `../cardView/cardStepReferenceModel`),
 *   - `buildCardClassifierStrip` (from `../cardView/cardClassifierStripModel`),
 *   - `artifactsToEvidenceSources` (from `../cardView/cardDetailModel`).
 *
 * Slice 1 is a PURE REFACTOR. Behavior is byte-equal: the shared builders
 * emit exactly the strings the sidecar emitted before. The plain-language
 * band maps + the new hub asks (parent quote, S/T/H strip, all-families
 * classifiers, full tags) land in Slice 2 — NOT here.
 *
 * Doctrine (cdiscourse-doctrine + design §3):
 *   - Pure TS. No React. No Supabase. No network. No AI. No `Date.now()`,
 *     no `Math.random()`, no input mutation. Deterministic, JSON-serializable.
 *   - Display-only derivation; no callback / action / dispatch field.
 *   - `inactive_reason` / `inactive_by` are NOT fields on any shape here
 *     (the temporal-only `isInactive` is derived elsewhere from `inactiveAt`).
 *   - Semantic-flag chips route every label through RULE-003 helpers; no raw
 *     `snake_case` code is ever placed in a render-bound field.
 */

import type {
  ArgumentBubbleActor,
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../argumentGameSurfaceModel';
import type {
  AutoMetadataCode,
  ClusterMetadataSummary,
  ManualTagCode,
  MoveMetadataLedger,
} from '../../metadata';
import type { EvidenceArtifact } from '../../evidence/evidenceModel';
import type { NodeLabelMark } from '../../nodeLabels/nodeLabelTypes';
import {
  ALL_MACHINE_OBSERVATION_FAMILIES,
  type MachineObservationFamily,
} from '../../nodeLabels/nodeLabelTypes';
import { lookupMachineObservationDefinitionByCompoundKey } from '../../nodeLabels/machineObservationDefinitions';
import {
  getAutoMetadataUx,
  getManualTagUx,
} from '../../rulesUx/lifecycleUxMap';
import { STANDING_BAND_SOFT_LABEL } from '../standingBandCopy';
import {
  buildHubClassifierMarks,
  markToChip,
  type BuildCardClassifierStripInput,
  type CardClassifierChip,
} from '../cardView/cardClassifierStripModel';

// ── Re-exported named pure builders (the ONE import surface) ──────────
//
// These builders physically live in their own modules under `cardView/`.
// Re-exporting them here gives BOTH the Timeline and Cards surfaces a
// single canonical place to import them from, so the shared detail
// derivation can never fork. The function references are identical to the
// source-module exports (verified by `argumentDetailParity.test.ts`).

export {
  buildStepReferenceLine,
  type BuildStepReferenceLineInput,
  type CardStepReferenceLine,
} from '../cardView/cardStepReferenceModel';

export {
  buildCardClassifierStrip,
  type CardClassifierStripModel,
} from '../cardView/cardClassifierStripModel';

// `BuildCardClassifierStripInput` + `CardClassifierChip` are imported above
// for local use (the hub builder) and re-exported here so the shared module
// remains the one canonical import surface.
export type { BuildCardClassifierStripInput, CardClassifierChip };

// ── Evidence sources (shared) ────────────────────────────────────────
//
// The canonical home for the evidence-source display labels and the
// `artifactsToEvidenceSources` builder. `cardView/cardDetailModel.ts`
// imports these back from here so the Cards surface and any other consumer
// share one definition (and there is no `detail → cardDetailModel` cycle).

/** One attached evidence source/quote rendered as a display label. */
export interface CardDetailEvidenceSource {
  /** Stable React key. */
  id: string;
  /** Plain-language label, e.g. "Source · nytimes.com" / "Quote attached". */
  label: string;
}

export interface CardDetailEvidenceZone {
  /** Attached sources/quotes as labels (display-only). */
  sources: ReadonlyArray<CardDetailEvidenceSource>;
  /** Plain-language evidence-debt summary, e.g. "Receipts owed: a source
   *  for this claim." null when no debt is owed. */
  debtSummary: string | null;
  /** Empty-state copy when there is no source AND no debt. */
  emptyStateCopy: string;
  /** True when at least one source is attached. */
  hasSource: boolean;
}

/** Plain-language kind word per evidence-artifact kind. Display-only; never
 *  a verdict, never a raw code. */
const EVIDENCE_KIND_WORD: Record<EvidenceArtifact['kind'], string> = {
  url: 'Source',
  quote: 'Quote',
  source_text: 'Source',
  dataset: 'Dataset',
  screenshot_redacted: 'Screenshot',
  manual_citation: 'Citation',
  payment_screenshot: 'Payment record',
};

/** Trim a single label, returning null for empty/non-string. Pure. */
function cleanEvidenceLabel(label: string | null | undefined): string | null {
  if (typeof label !== 'string') return null;
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Map evidence artifacts → display-only source labels. The kind word is a
 * locked plain-language prefix; the artifact's own `label` is appended.
 * Pure; never throws, never mutates. Unknown kinds fall back to "Source".
 */
export function artifactsToEvidenceSources(
  artifacts: ReadonlyArray<EvidenceArtifact> | undefined,
): CardDetailEvidenceSource[] {
  if (!Array.isArray(artifacts)) return [];
  return artifacts
    .filter((a): a is EvidenceArtifact => Boolean(a && typeof a.id === 'string'))
    .map((a) => {
      const kindWord = EVIDENCE_KIND_WORD[a.kind] ?? 'Source';
      const detail = cleanEvidenceLabel(a.label);
      return {
        id: a.id,
        label: detail ? `${kindWord} · ${detail}` : kindWord,
      };
    });
}

// ── Shared constants ─────────────────────────────────────────────────

/**
 * Parent replied-to excerpt cap. The single canonical value used by both
 * surfaces' parent-quote derivation. (Slice 2 wires the parent quote onto
 * the Cards hub; the sidecar already truncates to this length today.)
 */
export const PARENT_BODY_PREVIEW_CAP = 120;

// ── Shared band formatters (Slice 2 — plain-language) ─────────────────
//
// Design §6.4: the Standing / Tone / Heat strip describes the TEXT, not
// the author. The maps below are the single source of truth used by BOTH
// the Cards hub strip and the Timeline sidecar strip, so the two can
// never diverge. Slice 1 emitted the raw band token (e.g. "Tone: calm");
// Slice 2 routes every band through a plain-language map.
//
// Doctrine (cdiscourse-doctrine §1/§2/§3 + timeline-grammar):
//   - Standing reuses the SW-001 soft labels (`STANDING_BAND_SOFT_LABEL`)
//     — never "Correct"/"True"; the band is a game-standing reading.
//   - Tone describes the message's REGISTER (how it reads), never a
//     judgment of the person. "Heated"/"Hostile" are text-register words.
//   - Heat is an activity/friction descriptor (heat ≠ truth, heat ≠
//     popularity). "Hot" means recent friction, not "correct" or "trending".
//   - The unknown band collapses to the neutral "—" placeholder.
//   - Every label is verdict-token-clean (locked-constant; ban-list test).

/** Plain-language tone-band labels. Describe the TEXT's register, not the
 *  author. Unknown → neutral em-dash placeholder. */
export const TONE_BAND_PLAIN_LABEL: Record<TimelineToneBand, string> = {
  calm: 'Calm',
  measured: 'Measured',
  heated: 'Heated',
  hostile: 'Hostile',
  unknown: '—',
};

/** Plain-language heat/temperature-band labels. Activity/friction
 *  descriptors of the text — never correctness or popularity. Unknown →
 *  neutral em-dash placeholder. */
export const HEAT_BAND_PLAIN_LABEL: Record<TimelineTemperatureBand, string> = {
  cool: 'Cool',
  mild: 'Mild',
  warm: 'Warm',
  hot: 'Hot',
  unknown: '—',
};

/** Plain-language standing-band label (reuses the SW-001 soft labels).
 *  Pure lookup; total over the band union. */
export function standingBandPlainLabel(band: TimelineStandingBand): string {
  return STANDING_BAND_SOFT_LABEL[band];
}

/**
 * Pre-formatted standing band line, e.g. "Standing: Well supported".
 * Plain-language (SW-001 soft label). The `viewModel` arg is retained for
 * signature stability with existing callers.
 */
export function formatStandingLine(
  viewModel: ArgumentBubbleViewModel,
  node: ArgumentTimelineMapNode,
): string {
  void viewModel;
  return `Standing: ${standingBandPlainLabel(node.standingBand)}`;
}

/** Pre-formatted tone band line, e.g. "Tone: Calm". Plain-language. */
export function formatToneLine(node: ArgumentTimelineMapNode): string {
  return `Tone: ${TONE_BAND_PLAIN_LABEL[node.toneBand]}`;
}

/** Pre-formatted heat / temperature band line, e.g. "Heat: Cool".
 *  Plain-language. */
export function formatHeatLine(node: ArgumentTimelineMapNode): string {
  return `Heat: ${HEAT_BAND_PLAIN_LABEL[node.temperatureBand]}`;
}

/**
 * The accessibility / caption framing for the Standing / Tone / Heat strip.
 * Doctrine §6.4: the strip describes how the MESSAGE reads, never how the
 * person is. Display-only locked copy.
 */
export const STANDING_TONE_HEAT_CAPTION = 'How this message reads';

// ── Standing / Tone / Heat strip slice (Slice 2 — ask v) ─────────────

/**
 * The Standing / Tone / Heat strip view-model. Pre-formatted plain-language
 * lines + raw band tokens (the latter for tests / a11y, NEVER rendered).
 * Display-only.
 */
export interface DetailStandingToneHeatStrip {
  /** Pre-formatted plain-language standing line, e.g. "Standing: Well supported". */
  standingLine: string;
  /** Pre-formatted plain-language tone line, e.g. "Tone: Calm". */
  toneLine: string;
  /** Pre-formatted plain-language heat line, e.g. "Heat: Cool". */
  heatLine: string;
  /** Locked caption / a11y framing — describes the TEXT, not the author. */
  caption: string;
  /** Raw band tokens — reserved for tests + a11y. NEVER rendered as text. */
  standingBandCode: TimelineStandingBand;
  toneBandCode: TimelineToneBand;
  heatBandCode: TimelineTemperatureBand;
}

/**
 * Build the Standing / Tone / Heat strip from the active node + view-model.
 * Pure. Uses the shared plain-language formatters so the Cards strip and the
 * Timeline strip can never diverge.
 */
export function buildStandingToneHeatStrip(
  viewModel: ArgumentBubbleViewModel,
  node: ArgumentTimelineMapNode,
): DetailStandingToneHeatStrip {
  return {
    standingLine: formatStandingLine(viewModel, node),
    toneLine: formatToneLine(node),
    heatLine: formatHeatLine(node),
    caption: STANDING_TONE_HEAT_CAPTION,
    standingBandCode: node.standingBand,
    toneBandCode: node.toneBand,
    heatBandCode: node.temperatureBand,
  };
}

// ── Parent-quote zone (Slice 2 — ask i) ──────────────────────────────

/**
 * Plain-language fallback shown when the parent move cannot be resolved
 * (soft-deleted / RLS-hidden / out-of-slice). Doctrine §10a: NEVER an
 * invented quote, NEVER a "hidden because…" reason — the absence of the
 * quote is the entire signal.
 */
export const PARENT_QUOTE_UNAVAILABLE = 'Parent unavailable';

/**
 * The parent-quote slice. `quote` is the italic replied-to excerpt
 * (≤ `PARENT_BODY_PREVIEW_CAP` chars) when resolvable; `null` when the
 * parent is not loaded / not in slice — in which case `isAvailable` is
 * false and the consumer renders the neutral placeholder (or omits the box).
 */
export interface DetailParentQuoteSlice {
  /** Italic replied-to quote, ≤ 120 chars, or null when unresolvable. */
  quote: string | null;
  /** False when the parent could not be resolved (degrade path). */
  isAvailable: boolean;
  /** Neutral placeholder copy for the degrade path. Never a "why hidden". */
  unavailableLabel: string;
}

/** Truncate a parent body to the shared cap. Pure; never throws. */
function truncateParentQuote(s: string | null | undefined): string {
  const input = typeof s === 'string' ? s : '';
  if (input.length <= PARENT_BODY_PREVIEW_CAP) return input;
  return input.slice(0, PARENT_BODY_PREVIEW_CAP);
}

/**
 * Build the parent-quote slice from an already-resolved parent body preview.
 * Pure. The CALLER resolves the parent body off `timelineMap` (no fetch) and
 * passes it in; a `null`/empty preview is the degrade signal.
 */
export function buildParentQuoteSlice(
  parentBodyPreview: string | null | undefined,
): DetailParentQuoteSlice {
  const cleaned =
    typeof parentBodyPreview === 'string' ? parentBodyPreview.trim() : '';
  if (cleaned.length === 0) {
    return {
      quote: null,
      isAvailable: false,
      unavailableLabel: PARENT_QUOTE_UNAVAILABLE,
    };
  }
  return {
    quote: truncateParentQuote(cleaned),
    isAvailable: true,
    unavailableLabel: PARENT_QUOTE_UNAVAILABLE,
  };
}

// ── Actor / side color grammar (Slice 3 — comparison bubble) ──────────
//
// Design §2.A (operator 2026-06-06 refinement): the replied-to PARENT renders
// as a visually-distinct comparison bubble ABOVE + off-center the centerpiece,
// in a DIFFERENT color so the reader can tell it is the OTHER party's move.
//
// timeline-grammar doctrine: the color encodes ACTOR / SIDE (who made the
// move), NEVER a verdict / truth / correctness signal. The values mirror the
// EXISTING Timeline actor grammar (`ArgumentTimelineScrubber.actorTone`) so
// the comparison bubble reads as the same system the Timeline already uses —
// it is NOT a new visual that could drift into a truth claim. Because the
// signal is also carried by SHAPE (the off-center bubble + the italic quote)
// and the explicit `actorLabel`, color is never the only signal (grayscale
// snapshot stays legible).

/** One actor's bubble color pair. `bg`/`border` tint the bubble; `accent`
 *  tints the reference token. Display-only; never a verdict color.
 *
 * CARD-VIEW-COMPARISON-POLISH-001 — additive fields for the parent bubble's
 * BLACK-backdrop + DOUBLE-outline treatment:
 *   - `backdrop` is a TRUE-BLACK fill shared by EVERY actor (it denotes
 *     "the message being replied to", NOT a verdict — a constant across
 *     actors precisely so it can never read as an actor-specific judgment).
 *   - `ring` is the OUTER stroke of the double outline (the actor accent, so
 *     WHO made the parent move stays color-encoded on the outer ring while
 *     the inner `border` is the actor's deeper stroke). The two strokes give
 *     the bubble its distinct double border.
 * `bg` is retained (the pre-polish muted actor fill) so any non-bubble
 * consumer keeps working byte-equivalently. */
export interface ActorBubbleColor {
  bg: string;
  border: string;
  accent: string;
  backdrop: string;
  ring: string;
}

/**
 * The shared TRUE-BLACK parent-bubble backdrop. Constant across actors:
 * "black = the message you are replying to", a MESSAGE-TYPE cue, never a
 * verdict / truth / correctness signal (timeline-grammar / doctrine §1).
 * The actor signal stays color-independent — it is carried by the actor
 * LABEL + the "replying to" framing + the accent-colored double outline,
 * not by the (constant) black fill.
 */
export const PARENT_BUBBLE_BACKDROP = '#000000';

/**
 * Per-actor comparison-bubble color grammar. Hues mirror the Timeline's
 * `actorTone` (`self → cyan`, `other → indigo`, `bot → purple`,
 * `admin → amber`, `unknown → slate`) so the two surfaces read as one
 * system. `backdrop` (true black) is the parent bubble fill; `ring` (the
 * actor accent) is the outer stroke of the double outline; `border` is the
 * inner stroke. `bg` is the legacy muted actor fill (retained).
 */
export const ACTOR_BUBBLE_COLOR: Record<ArgumentBubbleActor, ActorBubbleColor> = {
  self: { bg: '#0e2f33', border: '#22d3ee', accent: '#67e8f9', backdrop: PARENT_BUBBLE_BACKDROP, ring: '#67e8f9' },
  other: { bg: '#1e1b4b', border: '#818cf8', accent: '#a5b4fc', backdrop: PARENT_BUBBLE_BACKDROP, ring: '#a5b4fc' },
  bot: { bg: '#2e1065', border: '#a855f7', accent: '#c4b5fd', backdrop: PARENT_BUBBLE_BACKDROP, ring: '#c4b5fd' },
  admin: { bg: '#3a2e05', border: '#facc15', accent: '#fde68a', backdrop: PARENT_BUBBLE_BACKDROP, ring: '#fde68a' },
  unknown: { bg: '#1e293b', border: '#475569', accent: '#94a3b8', backdrop: PARENT_BUBBLE_BACKDROP, ring: '#94a3b8' },
};

/**
 * Resolve an actor's comparison-bubble color. Total over the actor union;
 * any unexpected value collapses to the neutral `unknown` pair. Pure.
 */
export function actorBubbleColor(
  actor: ArgumentBubbleActor | null | undefined,
): ActorBubbleColor {
  if (actor && ACTOR_BUBBLE_COLOR[actor]) return ACTOR_BUBBLE_COLOR[actor];
  return ACTOR_BUBBLE_COLOR.unknown;
}

// ── Parent comparison bubble (Slice 3 — operator refinement) ─────────
//
// The off-center, above-centerpiece colored bubble that upgrades the Slice-2
// inline parent-quote zone. Carries everything the bubble renders: the italic
// quote, the parent reference (`#N · kind`), the parent's actor color, the
// tappable parent message id, and a `kind` (degrade signal). The CALLER
// resolves the parent off the already-computed `timelineMap` (no fetch).

/** The comparison-bubble render mode. `parent` → a colored bubble renders;
 *  `none` → no bubble (root / unresolvable parent, per §6.7 graceful
 *  degrade — the absence of the bubble is the entire signal). */
export type ParentComparisonKind = 'parent' | 'none';

/** The replied-to parent rendered as an off-center colored comparison bubble.
 *  Display-only EXCEPT the reference, which is a navigation affordance. */
export interface DetailParentComparisonBubble {
  /** `parent` → render the bubble; `none` → render nothing (degrade). */
  kind: ParentComparisonKind;
  /** Italic quote slice (reuses the Slice-2 builder; ≤120 chars). */
  quote: DetailParentQuoteSlice;
  /** Parent reference token, e.g. "#6". null when the ordinal is unknown. */
  referenceToken: string | null;
  /** Plain-language reference line, e.g. "#6 · rebuttal". null on degrade. */
  referenceLabel: string | null;
  /** Parent message id to activate when the reference is tapped. null when
   *  unresolvable (no dangling tappable affordance). */
  parentMessageId: string | null;
  /** Parent actor — drives the bubble color (who made the move). */
  actor: ArgumentBubbleActor;
  /** Actor color pair (different from the current card's color). */
  color: ActorBubbleColor;
  /** Plain-language actor label, e.g. "Other side" (color-independent cue). */
  actorLabel: string;
  /** Screen-reader label for the whole bubble. */
  accessibilityLabel: string;
}

/** Locked neutral fallback actor label when none is supplied. */
const PARENT_BUBBLE_ACTOR_FALLBACK = 'Replying to';

/** Defensive plain-language normalization for the parent kind word. Never
 *  echoes a raw code: an empty label falls back to the neutral "move". */
function sanitizeParentKind(label: unknown): string {
  if (typeof label !== 'string') return 'move';
  const trimmed = label.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : 'move';
}

export interface BuildParentComparisonBubbleInput {
  /** Parent node `bodyPreview`, resolved off `timelineMap` (no fetch). null /
   *  empty → degrade to `kind: 'none'`. */
  parentBodyPreview: string | null | undefined;
  /** Parent 1-based ordinal, or null when unknown / out-of-slice. */
  parentOrdinal: number | null | undefined;
  /** Parent plain-language kind label, e.g. "rebuttal". */
  parentKindLabel: string | null | undefined;
  /** Parent message id (navigation target). null → no tappable reference. */
  parentMessageId: string | null | undefined;
  /** Parent actor (drives the bubble color). */
  parentActor: ArgumentBubbleActor | null | undefined;
  /** Parent plain-language actor label, e.g. "Other side". */
  parentActorLabel: string | null | undefined;
}

/**
 * Build the off-center parent comparison bubble. Pure.
 *
 * Graceful degrade (design §6.7 / §2.A): when the parent body preview is
 * empty (root / soft-deleted / RLS-hidden / out-of-slice) the bubble degrades
 * to `kind: 'none'` and the consumer renders NO bubble. The reference token /
 * tappable id are only emitted when BOTH the ordinal AND the message id
 * resolve (no dangling affordance, never a "hidden because…" reason).
 */
export function buildParentComparisonBubble(
  input: BuildParentComparisonBubbleInput,
): DetailParentComparisonBubble {
  const quote = buildParentQuoteSlice(input?.parentBodyPreview ?? null);
  const actor: ArgumentBubbleActor =
    input?.parentActor && ACTOR_BUBBLE_COLOR[input.parentActor]
      ? input.parentActor
      : 'unknown';
  const color = actorBubbleColor(actor);
  const actorLabel =
    typeof input?.parentActorLabel === 'string' &&
    input.parentActorLabel.trim().length > 0
      ? input.parentActorLabel.trim()
      : PARENT_BUBBLE_ACTOR_FALLBACK;

  // Degrade: no resolvable quote → no bubble.
  if (!quote.isAvailable) {
    return {
      kind: 'none',
      quote,
      referenceToken: null,
      referenceLabel: null,
      parentMessageId: null,
      actor,
      color,
      actorLabel,
      accessibilityLabel: '',
    };
  }

  const ordinal =
    typeof input?.parentOrdinal === 'number' &&
    Number.isFinite(input.parentOrdinal) &&
    input.parentOrdinal > 0
      ? input.parentOrdinal
      : null;
  const kindWord = sanitizeParentKind(input?.parentKindLabel);
  const parentMessageId =
    typeof input?.parentMessageId === 'string' &&
    input.parentMessageId.length > 0
      ? input.parentMessageId
      : null;

  // The reference is only a navigation affordance when BOTH the ordinal and
  // the message id resolve.
  const hasReference = ordinal != null && parentMessageId != null;
  const referenceToken = ordinal != null ? `#${ordinal}` : null;
  const referenceLabel =
    ordinal != null ? `#${ordinal} · ${kindWord}` : null;

  const a11yReference =
    ordinal != null ? `message ${ordinal}, a ${kindWord}` : `a ${kindWord}`;
  const accessibilityLabel =
    `${actorLabel} · replied-to ${a11yReference}. ` +
    `${quote.quote ?? ''}`.trim() +
    (hasReference ? ` Tap to go to message ${ordinal}.` : '');

  return {
    kind: 'parent',
    quote,
    referenceToken,
    referenceLabel,
    parentMessageId: hasReference ? parentMessageId : null,
    actor,
    color,
    actorLabel,
    accessibilityLabel,
  };
}

// ── Responsive multi-column layout (Slice 3 — design §7.2) ───────────
//
// The hub renders THREE columns on a wide viewport (semantic-tags column ·
// centerpiece · classifier column) and a single stacked column on narrow.
// The breakpoint reuses the existing ≥1024 boundary (the iPad-Pro-landscape
// width that `menuKeyBadgeModel` uses) so the hub and the rest of UX-001
// share one boundary.
//
// SR reading order is ALWAYS the same regardless of visual column order:
// centerpiece (parent → current → S/T/H → lifecycle) → classifiers → tags.
// The same sections are present in BOTH layouts — narrow only REFLOWS, it
// never drops a section.

/** The wide-layout breakpoint. Mirrors `menuKeyBadgeModel`'s
 *  `BROWSER_KEYBOARD_WIDTH_THRESHOLD` (1024) so the hub and the rest of the
 *  app share one boundary. */
export const HUB_WIDE_LAYOUT_WIDTH_THRESHOLD = 1024;

/** The hub's column regions, in stable SR reading order. */
export type HubColumnRegion = 'centerpiece' | 'classifier' | 'tags';

/** The stable SR reading order — identical in both layouts. */
export const HUB_READING_ORDER: ReadonlyArray<HubColumnRegion> = Object.freeze([
  'centerpiece',
  'classifier',
  'tags',
]);

/** The resolved hub layout. Pure presentation — a width-driven decision. */
export interface HubColumnLayout {
  /** `three_column` on a wide web viewport; `stacked` otherwise. */
  mode: 'three_column' | 'stacked';
  /** Number of visual columns (3 wide, 1 stacked). */
  columnCount: 1 | 3;
  /** Visual left-to-right column order on wide; the flanking regions sit on
   *  either side of the centerpiece (tags left · centerpiece · classifier
   *  right). On stacked this equals the reading order. */
  visualOrder: ReadonlyArray<HubColumnRegion>;
  /** SR reading order — ALWAYS `HUB_READING_ORDER` regardless of mode. */
  readingOrder: ReadonlyArray<HubColumnRegion>;
}

/** The wide visual order: tags column (left) · centerpiece · classifier
 *  column (right) — the operator's two flanking regions. */
const HUB_WIDE_VISUAL_ORDER: ReadonlyArray<HubColumnRegion> = Object.freeze([
  'tags',
  'centerpiece',
  'classifier',
]);

/**
 * Resolve the hub's column layout from the viewport width + platform. Pure,
 * deterministic.
 *
 * - Three columns ONLY on web at width ≥ 1024 (the wide-layout boundary).
 * - Native (ios / android / windows / macos) and narrow web → stacked
 *   single column (touch-first; the flanking-column layout needs the width
 *   AND a desktop-class surface).
 * - Non-finite / non-positive width → stacked (fail-safe).
 *
 * The reading order is ALWAYS `HUB_READING_ORDER`; only the visual order +
 * column count change. The SAME sections are present in both layouts.
 */
export function hubColumnLayout(
  width: number,
  platformOs: 'web' | 'ios' | 'android' | 'windows' | 'macos',
): HubColumnLayout {
  const stacked: HubColumnLayout = {
    mode: 'stacked',
    columnCount: 1,
    visualOrder: HUB_READING_ORDER,
    readingOrder: HUB_READING_ORDER,
  };
  if (!Number.isFinite(width) || width <= 0) return stacked;
  if (platformOs !== 'web') return stacked;
  if (width < HUB_WIDE_LAYOUT_WIDTH_THRESHOLD) return stacked;
  return {
    mode: 'three_column',
    columnCount: 3,
    visualOrder: HUB_WIDE_VISUAL_ORDER,
    readingOrder: HUB_READING_ORDER,
  };
}

// ── All-families classifier — A–I family gate + grouping (ask iii) ───
//
// Design §6.5: the hub renders the UNCAPPED classifier set, but ONLY for
// families that are `productionEnabled: true`. Family H (`claim_clarity`,
// PR #559) and Family I (`thread_topology`, PR #562) are now production-
// enabled (both Edge windows closed PASS), so they JOIN the hub. Only
// Family J (`sensitive_composer`) is still `productionEnabled: false` and
// is dropped by an EXPLICIT family allow-list gate — NOT by disposition
// alone. The gate remains the authoritative §10a hub gate: it admits the
// production families (now A–I) and excludes the frozen J family regardless
// of per-entry disposition (#392 / #394). J's keys are composer_only and
// never reach `selected_context` anyway; the gate is the belt-and-braces.

/**
 * The FROZEN `productionEnabled: false` family set. After the H (PR #559)
 * and I (PR #562) production enables, only Family J (`sensitive_composer`)
 * remains. Mirrors the Deno `supabase/functions/_shared/booleanObservations/
 * familyRegistry.ts` `productionEnabled: false` entry — the canonical
 * registry lives in the Edge runtime (Deno, `.ts`-extension imports) and
 * cannot be imported into `src/**`, so it is mirrored here as a locked
 * constant, exactly as `adminClassifierHealth/classifierHealthModel.ts`
 * (`FROZEN_NON_PRODUCTION_FAMILIES`) does. A test pins both this set AND
 * its production-enabled complement to `ALL_MACHINE_OBSERVATION_FAMILIES`,
 * so a registry rename / new family forces this constant to be re-verified.
 */
export const HUB_NON_PRODUCTION_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze(['sensitive_composer']);

/**
 * The hub's family ALLOW-LIST: the `productionEnabled: true` families
 * (now A–I, after the H/I enables), DERIVED as the complement of
 * `HUB_NON_PRODUCTION_FAMILIES` over `ALL_MACHINE_OBSERVATION_FAMILIES`
 * (single canonical family enumeration). It is NOT a hard-coded list of
 * family codes — adding a family to the canonical enumeration automatically
 * excludes it from the hub UNTIL it is removed from
 * `HUB_NON_PRODUCTION_FAMILIES`, mirroring the registry's `productionEnabled`
 * flip. This is the §6.5 step-1b explicit family gate.
 */
export const HUB_PRODUCTION_ENABLED_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze(
    ALL_MACHINE_OBSERVATION_FAMILIES.filter(
      (f) => !HUB_NON_PRODUCTION_FAMILIES.includes(f),
    ),
  );

const HUB_PRODUCTION_ENABLED_FAMILY_SET: ReadonlySet<MachineObservationFamily> =
  new Set(HUB_PRODUCTION_ENABLED_FAMILIES);

/**
 * Plain-language family headings (design §6.5 step 3). NEVER a raw family
 * code. The map is total over every family; the A–I production headings are
 * now live on the hub (H/I joined via PR #559 / #562). The J heading
 * (`sensitive_composer`) is present for completeness/tests but Family J never
 * reaches the hub (frozen + composer_only). Verdict-token-clean (locked
 * constant; ban-list test).
 */
export const HUB_CLASSIFIER_FAMILY_HEADING: Record<MachineObservationFamily, string> = {
  parent_relation: 'How it relates to the parent',
  disagreement_axis: 'What the disagreement is about',
  misunderstanding_repair: 'Where it clears up confusion',
  evidence_source_chain: 'Evidence and sources',
  argument_scheme: 'The shape of the argument',
  critical_question: 'Questions worth asking',
  resolution_progress: 'Progress toward resolution',
  claim_clarity: 'How clear the claim is',
  thread_topology: 'How the thread is shaped',
  sensitive_composer: 'Composer-only notes',
};

/** Heading for marks whose rawKey has no registry entry. Never a raw code. */
export const HUB_CLASSIFIER_OTHER_HEADING = 'Other observations';

/** One family-grouped block of classifier chips on the hub. Display-only. */
export interface HubClassifierGroup {
  /** Stable key — the family code (or 'other'). NEVER rendered as text. */
  familyCode: MachineObservationFamily | 'other';
  /** Plain-language family heading. */
  familyLabel: string;
  /** Chips in this family (uncapped). */
  chips: ReadonlyArray<CardClassifierChip>;
}

/** The hub's all-families classifier view-model (uncapped, A–I gated). */
export interface HubClassifierGroupsModel {
  /** Family-grouped chips (production families A–I; frozen J gated out). */
  groups: ReadonlyArray<HubClassifierGroup>;
  /** Fixed advisory caption — locked copy. */
  advisoryCaption: string;
  /** Empty-state copy when no group has a chip. */
  emptyStateCopy: string;
  /** True when at least one chip survives the gate. */
  hasSignals: boolean;
}

/** Locked advisory caption — identical to the capped Cards strip. */
export const HUB_CLASSIFIER_ADVISORY_CAPTION =
  'What the referee noticed — advisory, not a verdict.';

/** Teaching empty state — never "clean" / "no issues" (a verdict). */
export const HUB_CLASSIFIER_EMPTY_STATE =
  'No classifier signals yet on this move.';

/**
 * Resolve a mark's family via the parallel definition registry. Returns
 * `'other'` when the (source, rawKey) pair has no registry entry — never the
 * raw code.
 */
function resolveMarkFamily(
  mark: NodeLabelMark,
): MachineObservationFamily | 'other' {
  const def = lookupMachineObservationDefinitionByCompoundKey(mark.source, mark.rawKey);
  return def ? def.family : 'other';
}

/** True when a mark's family is in the hub's production allow-list (A–I). */
function isHubAllowedFamily(mark: NodeLabelMark): boolean {
  const family = resolveMarkFamily(mark);
  if (family === 'other') return true; // unknown rawKey → kept, grouped under "Other"
  return HUB_PRODUCTION_ENABLED_FAMILY_SET.has(family);
}

export interface BuildHubClassifierGroupsInput {
  /** Surface-filtered + deduped Machine Observation marks (rendered_now at
   *  selected_context). The builder applies the family gate + grouping. */
  marks: ReadonlyArray<NodeLabelMark>;
  /** Maps a surviving mark to its display chip. Injected so the chip
   *  derivation stays identical to the capped strip's `markToChip`. */
  markToChip: (mark: NodeLabelMark) => CardClassifierChip;
}

/**
 * Build the hub's all-families family-grouped classifier view-model. Pure.
 *
 * Pipeline (the caller has ALREADY run disposition filtering + dedupe at
 * `selected_context`):
 *   1. Drop any mark whose family is NOT in the production allow-list (A–I;
 *      the EXPLICIT §6.5 step-1b family gate — the authoritative hub gate).
 *   2. Group surviving marks by family; unknown rawKey → "Other observations".
 *   3. Order groups by the canonical family enumeration; "Other" last.
 *
 * Confidence stays PIPS (via `markToChip`); the advisory caption is locked.
 */
export function buildHubClassifierGroups(
  input: BuildHubClassifierGroupsInput,
): HubClassifierGroupsModel {
  const emptyModel: HubClassifierGroupsModel = {
    groups: [],
    advisoryCaption: HUB_CLASSIFIER_ADVISORY_CAPTION,
    emptyStateCopy: HUB_CLASSIFIER_EMPTY_STATE,
    hasSignals: false,
  };
  if (!input || !Array.isArray(input.marks) || typeof input.markToChip !== 'function') {
    return emptyModel;
  }

  // Machine Observations only (the classifier strip never renders Allegations).
  const observations = input.marks.filter(
    (m): m is NodeLabelMark => Boolean(m) && m.kind === 'machine_observation',
  );

  // Step 1 — explicit production family gate (A–I; drops frozen J regardless of disposition).
  const allowed = observations.filter(isHubAllowedFamily);
  if (allowed.length === 0) return emptyModel;

  // Step 2 — group by family (preserving the caller's mark order within a group).
  const byFamily = new Map<MachineObservationFamily | 'other', CardClassifierChip[]>();
  for (const mark of allowed) {
    const family = resolveMarkFamily(mark);
    const list = byFamily.get(family);
    const chip = input.markToChip(mark);
    if (list) {
      list.push(chip);
    } else {
      byFamily.set(family, [chip]);
    }
  }

  // Step 3 — order groups by the canonical family enumeration; "Other" last.
  const groups: HubClassifierGroup[] = [];
  for (const family of HUB_PRODUCTION_ENABLED_FAMILIES) {
    const chips = byFamily.get(family);
    if (chips && chips.length > 0) {
      groups.push({
        familyCode: family,
        familyLabel: HUB_CLASSIFIER_FAMILY_HEADING[family],
        chips,
      });
    }
  }
  const otherChips = byFamily.get('other');
  if (otherChips && otherChips.length > 0) {
    groups.push({
      familyCode: 'other',
      familyLabel: HUB_CLASSIFIER_OTHER_HEADING,
      chips: otherChips,
    });
  }

  if (groups.length === 0) return emptyModel;

  return {
    groups,
    advisoryCaption: HUB_CLASSIFIER_ADVISORY_CAPTION,
    emptyStateCopy: HUB_CLASSIFIER_EMPTY_STATE,
    hasSignals: true,
  };
}

/**
 * Convenience: build the hub's all-families family-grouped classifier
 * straight from the SAME `BuildCardClassifierStripInput` the capped Cards
 * strip consumes. Pure. Runs the shared pipeline (surface filter + dedupe,
 * NO cap) via `buildHubClassifierMarks`, then applies the production (A–I)
 * family gate + grouping via `buildHubClassifierGroups` with the SAME `markToChip` the
 * capped strip uses (no second chip derivation).
 */
export function buildHubClassifier(
  input: BuildCardClassifierStripInput,
): HubClassifierGroupsModel {
  const marks = buildHubClassifierMarks(input);
  return buildHubClassifierGroups({ marks, markToChip });
}

// ── Semantic-flag chip model (shared) ────────────────────────────────
//
// The canonical home for the semantic-flag chip + section types and the
// `buildSectionSemanticFlags` builder. `argumentReplySidecarModel.ts`
// re-exports these under its existing `SidecarSemanticFlagChip` /
// `SidecarSection_SemanticFlags` names so its public type surface is
// unchanged; the Cards hub (Slice 2) consumes them directly.

export interface DetailSemanticFlagChip {
  /** Stable id for keying. Equal to `${family}:${code}`. */
  id: string;
  family: 'manual_tag' | 'auto_metadata';
  /** Plain-language label, from RULE-003. */
  label: string;
  /** Plain-language helper line, from RULE-003. */
  helperLine: string;
  /** RULE-003 icon hint. */
  iconHint: string;
  /** Internal code. NEVER rendered. */
  sourceCode: ManualTagCode | AutoMetadataCode;
}

export interface DetailSemanticFlagsSection {
  kind: 'semantic_flags';
  /** True in Timeline mode. Consumer renders only a count + "Show details". */
  isCondensed: boolean;
  /** Chip count (same in both modes — only `isCondensed` flips). */
  totalCount: number;
  /** Full chip list. Consumer chooses condensation behavior. */
  chips: ReadonlyArray<DetailSemanticFlagChip>;
}

/** Surface discriminator for the semantic-flag condensation flip. Mirrors
 *  `SidecarViewMode` from `argumentReplySidecarModel.ts` without importing
 *  it (one-way dependency: the sidecar imports this module, not vice-versa). */
export type DetailViewMode = 'timeline' | 'stack';

function getMetadataForCluster(
  ledger: MoveMetadataLedger | null,
  clusterId: string | null,
): ClusterMetadataSummary | null {
  if (!ledger || !clusterId) return null;
  return ledger.byCluster.get(clusterId) ?? null;
}

/**
 * Build the semantic-flag chip strip for a cluster. Pure.
 *
 * COPY-001 R2 dedup applies: when a manual-tag chip and an auto-metadata
 * chip would render the same plain-language label, the manual tag wins
 * (explicit participant annotation beats auto observation). Across-band
 * dedup against the cluster lifecycle label is also applied so the
 * "Why it matters" line is not echoed in the flag strip.
 *
 * Byte-equal with the sidecar's prior private `buildSectionSemanticFlags`.
 */
export function buildSectionSemanticFlags(
  ledger: MoveMetadataLedger | null,
  clusterId: string | null,
  lifecycleLabel: string,
  viewMode: DetailViewMode,
): DetailSemanticFlagsSection {
  if (!ledger || !clusterId) {
    return {
      kind: 'semantic_flags',
      isCondensed: viewMode === 'timeline',
      totalCount: 0,
      chips: [],
    };
  }
  const clusterMeta = getMetadataForCluster(ledger, clusterId);
  if (!clusterMeta) {
    return {
      kind: 'semantic_flags',
      isCondensed: viewMode === 'timeline',
      totalCount: 0,
      chips: [],
    };
  }

  // Manual-tag chips first (explicit participant annotations beat auto).
  const manualChips: DetailSemanticFlagChip[] = [];
  const seenManualCodes = new Set<ManualTagCode>();
  for (const code of clusterMeta.manualTagCodes) {
    if (seenManualCodes.has(code)) continue;
    seenManualCodes.add(code);
    const ux = getManualTagUx(code);
    manualChips.push({
      id: `manual_tag:${code}`,
      family: 'manual_tag',
      label: ux.label,
      helperLine: ux.helperLine,
      iconHint: ux.iconHint,
      sourceCode: code,
    });
  }

  // Auto-metadata chips with COPY-001 R2 dedup against manual tags and
  // the cluster lifecycle label.
  const manualLabels = new Set<string>(manualChips.map((c) => c.label));
  const autoChips: DetailSemanticFlagChip[] = [];
  const seenAutoCodes = new Set<AutoMetadataCode>();
  for (const code of clusterMeta.autoMetadataCodes) {
    if (seenAutoCodes.has(code)) continue;
    seenAutoCodes.add(code);
    const ux = getAutoMetadataUx(code);
    // Dedup: manual tag wins over auto with the same label.
    if (manualLabels.has(ux.label)) continue;
    // Dedup against the cluster lifecycle label — the "Why it matters"
    // section already surfaces it.
    if (ux.label === lifecycleLabel) continue;
    autoChips.push({
      id: `auto_metadata:${code}`,
      family: 'auto_metadata',
      label: ux.label,
      helperLine: ux.helperLine,
      iconHint: ux.iconHint,
      sourceCode: code,
    });
  }

  // Also dedup manual-tag chips against the cluster lifecycle label.
  const dedupedManual = manualChips.filter((c) => c.label !== lifecycleLabel);

  const chips = [...dedupedManual, ...autoChips];
  return {
    kind: 'semantic_flags',
    isCondensed: viewMode === 'timeline',
    totalCount: chips.length,
    chips,
  };
}

// ── Full semantic tags (Slice 2 — ask ii) ────────────────────────────
//
// Design §6.6 / OQ-ii: expand the Cards Zone-8 flag subset to the FULL
// relevant tag set, grouped by the §10a doctrine categories:
//   - Observations (auto-metadata)   — Machine Observations
//   - Allegations (manual tags)      — User Allegations
//   - structural labels              — dropped-tag qualifiers on the node
//   - status chips                   — category + lifecycle status
// Every label is plain-language (via the RULE-003 chip labels / the caller's
// already-resolved labels); unknown internal codes are SUPPRESSED upstream,
// never echoed. Neutral language — never an author judgment.

/** One display-only tag in the full-tags block. */
export interface DetailFullTag {
  /** Stable key. NEVER rendered as text. */
  id: string;
  /** Plain-language label. */
  label: string;
}

/** A doctrine-grouped block of full tags. */
export interface DetailFullTagsGroup {
  /** Stable group key. NEVER rendered as text. */
  groupCode: 'observations' | 'allegations' | 'structural' | 'status';
  /** Plain-language group heading. */
  groupLabel: string;
  /** Tags in this group. */
  tags: ReadonlyArray<DetailFullTag>;
}

/** The full-tags block view-model (display-only, grouped per OQ-ii). */
export interface DetailFullTagsModel {
  groups: ReadonlyArray<DetailFullTagsGroup>;
  /** Empty-state copy when no group has a tag. */
  emptyStateCopy: string;
  /** True when at least one tag is present. */
  hasTags: boolean;
}

/** Plain-language group headings — locked, verdict-clean, never a raw code. */
export const FULL_TAGS_GROUP_HEADING: Record<
  DetailFullTagsGroup['groupCode'],
  string
> = {
  observations: 'Observations',
  allegations: 'Allegations',
  structural: 'Structural labels',
  status: 'Status',
};

/** Empty state — never "no issues" (a verdict). */
export const FULL_TAGS_EMPTY_STATE = 'No tags on this move yet.';

export interface BuildFullTagsInput {
  /** Shared semantic-flag section (Observations + Allegations chips). */
  semanticFlags: DetailSemanticFlagsSection;
  /** Already-plain-language structural labels (dropped-tag qualifiers). */
  structuralLabels: ReadonlyArray<string>;
  /** Already-plain-language status labels (category + lifecycle). */
  statusLabels: ReadonlyArray<string>;
}

/** Trim + drop empties; dedupe preserving order. Pure. */
function cleanDedupeLabels(labels: ReadonlyArray<string> | undefined): string[] {
  if (!Array.isArray(labels)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (t.length === 0 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Build the full-tags block. Pure. Groups the shared semantic-flag chips by
 * the §10a Observation/Allegation boundary, then appends the structural +
 * status groups. The chip labels are ALREADY plain-language; the caller's
 * structural/status labels are ALREADY plain-language (unknown suppressed).
 */
export function buildFullTags(input: BuildFullTagsInput): DetailFullTagsModel {
  const observations: DetailFullTag[] = [];
  const allegations: DetailFullTag[] = [];
  const chips = input?.semanticFlags?.chips ?? [];
  for (const chip of chips) {
    if (chip.family === 'manual_tag') {
      allegations.push({ id: `allegation:${chip.id}`, label: chip.label });
    } else {
      observations.push({ id: `observation:${chip.id}`, label: chip.label });
    }
  }

  const structural = cleanDedupeLabels(input?.structuralLabels).map((label, i) => ({
    id: `structural:${i}:${label}`,
    label,
  }));
  const status = cleanDedupeLabels(input?.statusLabels).map((label, i) => ({
    id: `status:${i}:${label}`,
    label,
  }));

  const groups: DetailFullTagsGroup[] = [];
  if (observations.length > 0) {
    groups.push({
      groupCode: 'observations',
      groupLabel: FULL_TAGS_GROUP_HEADING.observations,
      tags: observations,
    });
  }
  if (allegations.length > 0) {
    groups.push({
      groupCode: 'allegations',
      groupLabel: FULL_TAGS_GROUP_HEADING.allegations,
      tags: allegations,
    });
  }
  if (structural.length > 0) {
    groups.push({
      groupCode: 'structural',
      groupLabel: FULL_TAGS_GROUP_HEADING.structural,
      tags: structural,
    });
  }
  if (status.length > 0) {
    groups.push({
      groupCode: 'status',
      groupLabel: FULL_TAGS_GROUP_HEADING.status,
      tags: status,
    });
  }

  return {
    groups,
    emptyStateCopy: FULL_TAGS_EMPTY_STATE,
    hasTags: groups.length > 0,
  };
}

// ── Superset detail view-model scaffold (Fork 2 / design §6.1) ───────
//
// The superset shape both surfaces will project from. SCAFFOLD ONLY in
// Slice 1 — the optional hub slices (parent quote, S/T/H strip,
// family-grouped classifiers, full tags) are populated in Slice 2. The
// scaffold pins the surface discriminator + the slice slot names now so
// the Slice 2 builder lands without re-shaping the type.

/** Detail surface discriminator (Fork 2). */
export type DetailSurface = 'timeline' | 'cards';

/**
 * Superset detail view-model (Fork 2 shape). Slice 1 declared the surface
 * discriminator + the semantic-flag slot; Slice 2 adds the Cards-hub slices
 * (parent quote, S/T/H strip, family-grouped classifiers, full tags). Each
 * surface selects the slices it renders — the cards projection (rendered via
 * `CardDetailViewModel` on the active card) renders the hub slices; the
 * timeline projection (`SidecarViewModel`) renders its condensed slices.
 */
export interface ArgumentDetailViewModel {
  surface: DetailSurface;
  activeMessageId: string;
  /** Semantic-flag chips (shared derivation). */
  semanticFlags?: DetailSemanticFlagsSection;
  /** Parent replied-to quote (Slice 2 — ask i). */
  parentQuote?: DetailParentQuoteSlice;
  /** Standing / Tone / Heat strip (Slice 2 — ask v). */
  standingToneHeat?: DetailStandingToneHeatStrip;
  /** All-families family-grouped classifiers, A–I gated (Slice 2 — ask iii). */
  hubClassifier?: HubClassifierGroupsModel;
  /** Full semantic tags, doctrine-grouped (Slice 2 — ask ii). */
  fullTags?: DetailFullTagsModel;
}
