/**
 * EV-002 — Source-chain popover dispatch model.
 *
 * Pure-TS view-model that turns EV-001's `TimelineEvidenceContract` (or a
 * bare `ReceiptChipContract`) into the popover's headline + helper + the
 * one primary CTA mapped from `SourceChainStatus`.
 *
 * Doctrine anchors:
 *   - "Status describes the trail, not the truth." The popover never tells
 *     the user a claim is "right" or "wrong"; it tells the user the trail's
 *     shape and offers a non-accusatory action.
 *   - "Popularity is not evidence." The model consumes only the chip's
 *     status + count — never engagement metrics.
 *
 * No React. No Supabase. No network.
 */

import {
  summarizeArtifactsForReceiptChip,
  type EvidenceAnnotationSummary,
  type EvidenceArtifact,
  type ReceiptChipContract,
  type SourceChainStatus,
  type TimelineEvidenceContract,
} from './evidenceModel';

// ── Action ────────────────────────────────────────────────────

/**
 * The action a popover renders for a given SourceChainStatus. Pure data —
 * never references React, Supabase, or network.
 */
export interface SourceChainPopoverAction {
  /** Plain-English primary CTA label. Never a snake_case code. */
  label: string;
  /**
   * The QuickActionLabel passed to `quickActionToPreset(...)`. `null` for
   * read-only states (`source_and_quote`, `primary_present`).
   */
  presetKey: 'source' | 'quote' | 'weak_source' | null;
  /**
   * The ArgumentBubbleControl dispatched to the existing onAction callback
   * when the user confirms the action. `null` for read-only states.
   */
  bubbleControl: 'ask_for_source' | 'ask_for_quote' | null;
  /** Display tone for the CTA. Mirrors EV-001's chip tone for consistency. */
  tone: 'neutral' | 'info' | 'attention';
  /** True when this popover state opens a composer flow. */
  invitesFollowup: boolean;
  /** Screen-reader hint appended to the popover root accessibilityLabel. */
  accessibilityHint: string;
}

// ── Popover model ─────────────────────────────────────────────

/**
 * The full popover view-model. Built once per artifact list. Pure.
 */
export interface SourceChainPopoverModel {
  /** Plain-English headline. Reuses EV-001's locked chip label verbatim. */
  headline: string;
  /** Plain-English helper. Reuses EV-001's locked chip helper verbatim. */
  helper: string;
  /** Underlying status. EV-003 may read this to drive its own branching. */
  status: SourceChainStatus;
  /** Total artifact count. 0 in the `no_source` aggregate state. */
  artifactCount: number;
  /**
   * True when the dotted-teal source-chain ring should render on the node
   * or chip. Mirrors `ReceiptChipContract.showsSourceChainPressure` so the
   * popover and ring never drift.
   */
  showsSourceChainPressure: boolean;
  /** True for `source_and_quote` and `primary_present` — popover is inspection-only. */
  isReadOnly: boolean;
  /** The one primary CTA for this state. `null` only when `isReadOnly` is true. */
  primaryAction: SourceChainPopoverAction | null;
  /** Accessibility label for the popover root. Built deterministically. */
  accessibilityLabel: string;
  /**
   * EV-005 — Optional derived annotation summary for the first artifact in
   * this popover. `undefined` when no annotation data has been attached
   * (every EV-002 builder leaves it undefined — fully backward compatible).
   * `attachAnnotationSummary` sets it.
   */
  annotationSummary?: EvidenceAnnotationSummary;
}

// ── Internal dispatch table ───────────────────────────────────

interface DispatchEntry {
  action: SourceChainPopoverAction | null;
}

/**
 * State-to-action dispatch. Locked at design time (see
 * docs/designs/EV-002.md §"State-to-action dispatch table"). Six rows, one
 * per `SourceChainStatus`. Read-only states return `action: null`.
 *
 * `unverified` resolution: always picks "Ask for source" (NOT "Ask for
 * quote"), because the only EV-001 path to `unverified` is "quote present,
 * no URL, no sourceText" — i.e. there is no source pointer at all.
 */
const DISPATCH: Readonly<Record<SourceChainStatus, DispatchEntry>> = Object.freeze({
  no_source: {
    action: {
      label: 'Ask for source',
      presetKey: 'source',
      bubbleControl: 'ask_for_source',
      tone: 'info',
      invitesFollowup: true,
      accessibilityHint: 'Opens the composer with a prompt asking for a source.',
    },
  },
  unverified: {
    action: {
      label: 'Ask for source',
      presetKey: 'source',
      bubbleControl: 'ask_for_source',
      tone: 'info',
      invitesFollowup: true,
      accessibilityHint: 'Opens the composer with a prompt asking for a source.',
    },
  },
  source_no_quote: {
    action: {
      label: 'Ask for quote',
      presetKey: 'quote',
      bubbleControl: 'ask_for_quote',
      tone: 'info',
      invitesFollowup: true,
      accessibilityHint: 'Opens the composer with a prompt asking for an exact quote.',
    },
  },
  source_and_quote: {
    action: null,
  },
  broken: {
    action: {
      label: 'Ask for stronger source',
      presetKey: 'weak_source',
      bubbleControl: 'ask_for_source',
      tone: 'attention',
      invitesFollowup: true,
      accessibilityHint: 'Opens the composer with a prompt asking for a more primary source.',
    },
  },
  primary_present: {
    action: null,
  },
});

/**
 * Frozen exhaustive list — one entry per `SourceChainStatus`. Tests rely on
 * this to assert dispatch-table completeness.
 */
export const ALL_SOURCE_CHAIN_POPOVER_ACTIONS: ReadonlyArray<{
  status: SourceChainStatus;
  action: SourceChainPopoverAction | null;
}> = Object.freeze([
  { status: 'no_source', action: DISPATCH.no_source.action },
  { status: 'unverified', action: DISPATCH.unverified.action },
  { status: 'source_no_quote', action: DISPATCH.source_no_quote.action },
  { status: 'source_and_quote', action: DISPATCH.source_and_quote.action },
  { status: 'broken', action: DISPATCH.broken.action },
  { status: 'primary_present', action: DISPATCH.primary_present.action },
]);

// ── Builders ─────────────────────────────────────────────────

function buildAccessibilityLabel(
  status: SourceChainStatus,
  headline: string,
  helper: string,
  action: SourceChainPopoverAction | null,
): string {
  // Headline + helper come from EV-001's locked chip copy. Suffix names
  // either the primary CTA label or the read-only inspection state — never
  // a verdict.
  const trailing = action ? action.label : 'Inspect receipt only.';
  // Trim trailing punctuation from helper so the assembled label reads
  // cleanly across screen readers.
  const helperClean = helper.replace(/[\s.]+$/, '');
  void status;
  return `Source-chain inspection. ${headline}. ${helperClean}. ${trailing}`;
}

/** Build the popover model from a `ReceiptChipContract` directly. Pure. */
export function buildSourceChainPopoverModelFromChip(
  chip: ReceiptChipContract,
): SourceChainPopoverModel {
  const entry = DISPATCH[chip.status];
  const action = entry.action;
  const isReadOnly = action === null;
  return {
    headline: chip.label,
    helper: chip.helper,
    status: chip.status,
    artifactCount: chip.count,
    showsSourceChainPressure: chip.showsSourceChainPressure,
    isReadOnly,
    primaryAction: action,
    accessibilityLabel: buildAccessibilityLabel(chip.status, chip.label, chip.helper, action),
  };
}

/** Build the popover model from EV-001's `TimelineEvidenceContract`. Pure. */
export function buildSourceChainPopoverModel(
  contract: TimelineEvidenceContract,
): SourceChainPopoverModel {
  return buildSourceChainPopoverModelFromChip(contract.receiptChip);
}

/**
 * Convenience: build the popover model directly from an artifact list,
 * matching EV-001's adapter shape. Used by the timeline-popover wiring
 * when the caller only has the artifact array on hand.
 */
export function buildSourceChainPopoverModelFromArtifacts(
  artifacts: ReadonlyArray<EvidenceArtifact>,
): SourceChainPopoverModel {
  return buildSourceChainPopoverModelFromChip(summarizeArtifactsForReceiptChip(artifacts));
}

/**
 * EV-005 — Attach a derived annotation summary to an existing popover model.
 * Pure — returns a new model object; the input is not mutated. EV-002
 * builders never call this, so the field defaults to `undefined` and the
 * EV-002 behaviour is unchanged.
 */
export function attachAnnotationSummary(
  model: SourceChainPopoverModel,
  summary: EvidenceAnnotationSummary,
): SourceChainPopoverModel {
  return { ...model, annotationSummary: summary };
}
