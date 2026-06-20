/**
 * SC-003 — Argument reply sidecar view-model (detail inspector).
 *
 * Pure TypeScript. No React. No Supabase. No network. No AI.
 *
 * Builds a typed view-model that the refactored `ArgumentReplySidecar`
 * component renders. The model is the source of truth for what the
 * sidecar shows; the component is a thin presentation layer.
 *
 * Boundary (test-enforced):
 *
 *   - The sidecar is the DETAIL INSPECTOR. SC-004's `TimelineNodeActionDock`
 *     is the ACTION DOCK. The two surfaces sit side by side in the room;
 *     SC-003 must not import, type-import, or reference SC-004's action
 *     vocabulary in any form.
 *
 *   - Every label and helper string is read through RULE-003 helpers
 *     (`getLifecycleUx`, `getManualTagUx`, `getAutoMetadataUx`). The model
 *     never authors a label.
 *
 *   - No callback / action / dispatch fields. The view-model is pure data.
 *     The component derives no interactivity from the model — it is
 *     read-only by construction.
 *
 *   - No body editing. The body is a text excerpt. There is no edit slot,
 *     no submit slot, no composer hand-off in the model or the component.
 *
 *   - No internal `snake_case` codes are placed in any field whose value
 *     is intended for the rendered DOM. Internal codes (e.g.
 *     `lifecycleStateCode`, `sourceCode`) are explicitly typed and are
 *     reserved for tests + ST-002 + AN-003. The component must never
 *     render them.
 *
 *   - `SuggestedMoveStub = never` in v1 so ST-002 can later widen the slot
 *     to a real `SuggestedNextMove` union without breaking existing
 *     consumers. Tests pin the type to `never`.
 *
 *   - COPY-001 R2 dedup applies inside the semantic-flag strip: when a
 *     manual-tag chip and an auto-metadata chip would render the same
 *     plain-language label, the manual-tag wins (explicit participant
 *     annotation beats auto observation). Across-band dedup against the
 *     cluster lifecycle label is also applied so the "Why it matters"
 *     line is not echoed in the flag strip.
 */

import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
} from './argumentGameSurfaceModel';
import type {
  PointLifecycleMap,
  PointLifecycleState,
} from '../lifecycle';
import type {
  AutoMetadataCode,
  ClusterMetadataSummary,
  MoveLinkageRecord,
  MoveMetadataLedger,
} from '../metadata';
import {
  getAutoMetadataUx,
  getLifecycleUx,
} from '../rulesUx/lifecycleUxMap';
import type { SuggestedMove } from './suggestedMovesModel';
import {
  buildSectionSemanticFlags as buildSharedSectionSemanticFlags,
  formatHeatLine as formatSharedHeatLine,
  formatStandingLine as formatSharedStandingLine,
  formatToneLine as formatSharedToneLine,
  PARENT_BODY_PREVIEW_CAP,
  type DetailSemanticFlagChip,
  type DetailSemanticFlagsSection,
} from './detail/argumentDetailModel';

// ── Shared semantic-flag chip types (re-exported from the shared module) ──
//
// The semantic-flag chip + section types live in `detail/argumentDetailModel.ts`
// (the single source both surfaces consume). The sidecar re-exports them
// under its established names so its public type surface is unchanged.

export type SidecarSemanticFlagChip = DetailSemanticFlagChip;
export type SidecarSection_SemanticFlags = DetailSemanticFlagsSection;

// ── View mode ────────────────────────────────────────────────

/**
 * Mirrors `ArgumentSurfaceMode` from `argumentGameSurfaceModel.ts`. We
 * re-declare here (rather than re-export) so the dependency stays one
 * way: the sidecar reads the surface model, the surface model does not
 * import the sidecar.
 */
export type SidecarViewMode = 'timeline' | 'stack';

// ── Section discriminator ────────────────────────────────────

export type SidecarSectionKind =
  | 'what_this_move_says'
  | 'why_it_matters'
  | 'what_is_unresolved'
  | 'where_it_sits'
  | 'suggested_next_move'
  | 'semantic_flags';

// ── Per-section view models ──────────────────────────────────

export interface SidecarSection_WhatThisMoveSays {
  kind: 'what_this_move_says';
  /** Already-redacted body excerpt. Truncated at word boundary; ≤ cap chars. */
  bodyExcerpt: string;
  /** True when bodyExcerpt was truncated. */
  isTruncated: boolean;
  /** Length of the full body (for an optional "show full body" affordance). */
  fullBodyLength: number;
  /**
   * UX-BOARD-MOBILE-DEPTH-001 (#758) — already-redacted FULL body, render-ready;
   * the source for a read-only "Show full body" disclosure toggle so the
   * selected-node body is reachable at 390px when bodyExcerpt is truncated.
   * Equals bodyExcerpt when not truncated. Empty when the move is hidden.
   */
  bodyFull: string;
  /** Pre-formatted absolute timestamp, render-ready. */
  createdAtLabel: string;
  /** Pre-formatted short relative age. */
  relativeLabel: string;
  /** Pre-formatted "Replied to · #N (Kind)" string. null when root or detached. */
  parentHint: string | null;
  /** Pre-formatted "Replied to" excerpt body (already truncated to 120 chars). */
  parentBodyPreview: string | null;
  /** Actor label, plain-language ("You" / "Other side" / "Bot" / "Admin"). */
  actorLabel: string;
  /** Side label, plain-language ("Aff" / "Neg" / "Obs" / "—"). */
  sideLabel: string;
  /** Argument-type label, plain-language. */
  kindLabel: string;
  /** True when the move is soft-deleted upstream. */
  isHidden: boolean;
  /** Plain-language sentence shown when isHidden is true. */
  hiddenNotice: string | null;
  /** Pre-formatted standing band line (e.g. "Standing: ◐ Well supported"). */
  standingLine: string;
  /** Pre-formatted tone band line. */
  toneLine: string;
  /** Pre-formatted heat / temperature band line. */
  heatLine: string;
}

export interface SidecarSection_WhyItMatters {
  kind: 'why_it_matters';
  /** RULE-003 lifecycle label. Read from getLifecycleUx(state).label. */
  lifecycleLabel: string;
  /** RULE-003 lifecycle helper line. */
  lifecycleHelperLine: string;
  /** RULE-003 icon hint (semantic, NOT rendered as text). */
  lifecycleIconHint: string;
  /**
   * Cluster lifecycle state code. Reserved for tests + a11y + ST-002.
   * NEVER rendered as text.
   */
  lifecycleStateCode: PointLifecycleState | null;
  /** True when no lifecycle decision is available for this cluster. */
  isEmpty: boolean;
}

export interface SidecarUnresolvedItem {
  /** Stable id for keying. */
  id: string;
  /** RULE-003 plain-language label. */
  label: string;
  /** RULE-003 helper line. */
  helperLine: string;
  /** RULE-003 icon hint. */
  iconHint: string;
  /** Internal auto-metadata code. NEVER rendered. */
  sourceCode: AutoMetadataCode;
}

export interface SidecarSection_WhatIsUnresolved {
  kind: 'what_is_unresolved';
  items: ReadonlyArray<SidecarUnresolvedItem>;
  /** True when items.length === 0. */
  isEmpty: boolean;
  /** Plain-language line shown when isEmpty is true. */
  emptyNotice: string;
}

export interface SidecarSection_WhereItSits {
  kind: 'where_it_sits';
  /** Branch label, plain-language ("Mainline" / "Side branch"). */
  branchLabel: string;
  /** Lane index (0-based). For tests + a11y. */
  laneIndex: number;
  /** Depth in the tree (0 = root). */
  depth: number;
  /** Pre-formatted path string ("Root → #2 → #4"). */
  pathLabel: string;
  /** Total messages in the room. */
  totalCount: number;
  /** This move's 1-based ordinal. */
  ordinal: number;
}

/**
 * Typed slot for ST-002 (issue #13). SC-003's builder ALWAYS returns null
 * for this slot in v1; ST-002 widens the slot from `never` to
 * `SuggestedMove` so a downstream caller can populate it with a real
 * suggestion later without breaking existing consumers. The SC-003
 * builder's behaviour is UNCHANGED — `suggestion` is still set to `null`
 * with `reason === 'st_002_not_yet_implemented'`.
 */
export type SuggestedMoveStub = SuggestedMove;

export interface SidecarSection_SuggestedNextMove {
  kind: 'suggested_next_move';
  /** Always null in SC-003. */
  suggestion: SuggestedMoveStub | null;
  /** Stable reason string for tests. */
  reason: 'st_002_not_yet_implemented';
  /** Plain-language placeholder text the component renders. */
  placeholderLine: string;
}

// (SidecarSemanticFlagChip / SidecarSection_SemanticFlags are re-exported
//  from the shared module — see the top of this file.)

// ── Top-level view model ─────────────────────────────────────

export type SidecarSection =
  | SidecarSection_WhatThisMoveSays
  | SidecarSection_WhyItMatters
  | SidecarSection_WhatIsUnresolved
  | SidecarSection_WhereItSits
  | SidecarSection_SuggestedNextMove
  | SidecarSection_SemanticFlags;

export interface SidecarViewModel {
  /** True when no move is selected. */
  isEmpty: boolean;
  /** The selected message id. null when isEmpty. */
  selectedMessageId: string | null;
  /** The view mode that produced this model. */
  viewMode: SidecarViewMode;
  /** Sections in render order. 6 entries when populated; 0 when isEmpty. */
  sections: ReadonlyArray<SidecarSection>;
  /** Accessibility root label (announces the summary on focus). */
  accessibilityRootLabel: string;
  /** Plain-language line the component renders in the empty state. */
  emptyStateMessage: string;
}

// ── Builder input ────────────────────────────────────────────

export interface BuildSidecarViewModelInput {
  /** Currently active timeline node. null when nothing is selected. */
  activeNode: ArgumentTimelineMapNode | null;
  /** Bubble view-model for the active node. null when nothing is selected. */
  activeViewModel: ArgumentBubbleViewModel | null;
  /** Parent node, when available. */
  parentNode: ArgumentTimelineMapNode | null;
  /** Total node count in the room. */
  totalCount: number;
  /** Chronological active-path ids from the surface model. */
  activePathIds: ReadonlyArray<string>;
  /** LIFE-001 lifecycle map. Optional — the sidecar gracefully degrades. */
  lifecycleMap: PointLifecycleMap | null;
  /** META-001 metadata ledger. Optional — the sidecar gracefully degrades. */
  metadataLedger: MoveMetadataLedger | null;
  /** Stack vs Timeline. */
  viewMode: SidecarViewMode;
  /** Optional body excerpt cap. Default 280. Values ≤ 0 fall back to 280. */
  bodyExcerptCap?: number;
}

// ── Constants ────────────────────────────────────────────────

const DEFAULT_BODY_EXCERPT_CAP = 280;
const ELLIPSIS = '…';

const EMPTY_STATE_MESSAGE = 'Pick a message on the timeline to see details.';
const HIDDEN_NOTICE = 'This move is hidden.';
const NOTHING_UNRESOLVED_NOTICE = 'Nothing unresolved here.';
const LIFECYCLE_EMPTY_HELPER = 'This cluster has no lifecycle state yet.';
const LIFECYCLE_EMPTY_LABEL = 'No lifecycle decision yet.';
const ST_002_PLACEHOLDER = 'Suggestions land here once the move has settled.';

const ACTOR_LABEL: Record<ArgumentBubbleViewModel['actor'], string> = {
  self: 'You',
  other: 'Other side',
  bot: 'Bot',
  admin: 'Admin',
  unknown: 'Other side',
};

/**
 * Auto-metadata codes that constitute an "open request" — i.e. someone
 * has asked for something and has not yet received it. The "What is
 * unresolved" section iterates this whitelist.
 */
const OPEN_REQUEST_AUTO_METADATA_CODES: ReadonlyArray<AutoMetadataCode> = [
  'source_requested',
  'quote_requested',
  'no_response_after_n_turns',
  'point_stalled',
];

// ── Helpers ──────────────────────────────────────────────────

function resolveBodyExcerptCap(cap: number | undefined): number {
  if (cap === undefined) return DEFAULT_BODY_EXCERPT_CAP;
  if (!Number.isFinite(cap) || cap <= 0) return DEFAULT_BODY_EXCERPT_CAP;
  return Math.floor(cap);
}

export function truncateAtWordBoundary(
  s: string,
  cap: number,
): { excerpt: string; truncated: boolean } {
  const input = String(s ?? '');
  if (input.length <= cap) return { excerpt: input, truncated: false };
  // Find the last whitespace at or before `cap` (leaving room for the ellipsis).
  const sliceEnd = cap;
  const slice = input.slice(0, sliceEnd);
  const lastWs = Math.max(
    slice.lastIndexOf(' '),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('\t'),
  );
  if (lastWs > 0) {
    return { excerpt: slice.slice(0, lastWs).trimEnd() + ELLIPSIS, truncated: true };
  }
  // No whitespace before the cap — hard truncate.
  return { excerpt: slice + ELLIPSIS, truncated: true };
}

// Band formatters live in the shared `detail/argumentDetailModel.ts` module
// (the single source both the Timeline and the Cards surface consume). They
// are imported as `formatSharedStandingLine` / `formatSharedToneLine` /
// `formatSharedHeatLine` at the top of this file.

function getClusterSummary(
  lifecycleMap: PointLifecycleMap | null,
  clusterId: string | null,
): { state: PointLifecycleState; summary: ClusterMetadataSummary | null } | null {
  if (!lifecycleMap || !clusterId) return null;
  const cluster = lifecycleMap.byCluster.get(clusterId);
  if (!cluster) return null;
  return { state: cluster.state, summary: null };
}

function getMetadataForMove(
  ledger: MoveMetadataLedger | null,
  messageId: string,
): MoveLinkageRecord | null {
  if (!ledger) return null;
  return ledger.byMessage.get(messageId) ?? null;
}

function getMetadataForCluster(
  ledger: MoveMetadataLedger | null,
  clusterId: string | null,
): ClusterMetadataSummary | null {
  if (!ledger || !clusterId) return null;
  return ledger.byCluster.get(clusterId) ?? null;
}

// ── Section builders ─────────────────────────────────────────

function buildSectionWhatThisMoveSays(
  node: ArgumentTimelineMapNode,
  viewModel: ArgumentBubbleViewModel,
  parentNode: ArgumentTimelineMapNode | null,
  cap: number,
): SidecarSection_WhatThisMoveSays {
  const rawBody = viewModel.body ?? '';
  const isHidden = false;
  // The bubble view-model already redacts and respects soft-delete via
  // its `body` field; `isHidden` would be lifted from a future field on
  // the surface model. For v1 we mirror the bubble VM's body verbatim.
  const { excerpt, truncated } = truncateAtWordBoundary(rawBody, cap);

  const parentHint = parentNode
    ? `Replied to · #${parentNode.ordinal} (${parentNode.kindLabel})`
    : null;
  const parentBodyPreview = parentNode
    ? truncateAtWordBoundary(parentNode.bodyPreview ?? '', PARENT_BODY_PREVIEW_CAP).excerpt
    : null;

  return {
    kind: 'what_this_move_says',
    bodyExcerpt: isHidden ? '' : excerpt,
    isTruncated: !isHidden && truncated,
    fullBodyLength: rawBody.length,
    // UX-BOARD-MOBILE-DEPTH-001 (#758) — the redacted FULL body, render-ready.
    // Equals bodyExcerpt when not truncated; empty when hidden.
    bodyFull: isHidden ? '' : rawBody,
    createdAtLabel: viewModel.createdAtLabel,
    relativeLabel: viewModel.relativeLabel,
    parentHint,
    parentBodyPreview,
    actorLabel: ACTOR_LABEL[viewModel.actor],
    sideLabel: viewModel.sideLabel,
    kindLabel: viewModel.kindLabel,
    isHidden,
    hiddenNotice: isHidden ? HIDDEN_NOTICE : null,
    standingLine: formatSharedStandingLine(viewModel, node),
    toneLine: formatSharedToneLine(node),
    heatLine: formatSharedHeatLine(node),
  };
}

function buildSectionWhyItMatters(
  lifecycleMap: PointLifecycleMap | null,
  clusterId: string | null,
): SidecarSection_WhyItMatters {
  const cluster = getClusterSummary(lifecycleMap, clusterId);
  if (!cluster) {
    return {
      kind: 'why_it_matters',
      lifecycleLabel: LIFECYCLE_EMPTY_LABEL,
      lifecycleHelperLine: LIFECYCLE_EMPTY_HELPER,
      lifecycleIconHint: 'open_circle',
      lifecycleStateCode: null,
      isEmpty: true,
    };
  }
  const ux = getLifecycleUx(cluster.state);
  return {
    kind: 'why_it_matters',
    lifecycleLabel: ux.label,
    lifecycleHelperLine: ux.helperLine,
    lifecycleIconHint: ux.iconHint,
    lifecycleStateCode: cluster.state,
    isEmpty: false,
  };
}

function buildSectionWhatIsUnresolved(
  ledger: MoveMetadataLedger | null,
  clusterId: string | null,
  lifecycleMap: PointLifecycleMap | null,
): SidecarSection_WhatIsUnresolved {
  if (!ledger || !clusterId) {
    return {
      kind: 'what_is_unresolved',
      items: [],
      isEmpty: true,
      emptyNotice: NOTHING_UNRESOLVED_NOTICE,
    };
  }
  const clusterMeta = getMetadataForCluster(ledger, clusterId);
  if (!clusterMeta) {
    return {
      kind: 'what_is_unresolved',
      items: [],
      isEmpty: true,
      emptyNotice: NOTHING_UNRESOLVED_NOTICE,
    };
  }

  // Anchor the unresolved set on auto-metadata codes that indicate an
  // open request. We further gate on `hasOpenSourceOrQuoteRequest` from
  // LIFE-001 to avoid surfacing stale source/quote requests when
  // lifecycle already resolved them (e.g. cluster moved to `sourced`).
  const lifecycleCluster = lifecycleMap?.byCluster.get(clusterId) ?? null;
  const hasOpenSourceOrQuote = lifecycleCluster?.hasOpenSourceOrQuoteRequest ?? true;

  const seen = new Set<AutoMetadataCode>();
  const items: SidecarUnresolvedItem[] = [];
  for (const code of clusterMeta.autoMetadataCodes) {
    if (!OPEN_REQUEST_AUTO_METADATA_CODES.includes(code)) continue;
    if ((code === 'source_requested' || code === 'quote_requested') && !hasOpenSourceOrQuote) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    const ux = getAutoMetadataUx(code);
    items.push({
      id: `unresolved:${code}`,
      label: ux.label,
      helperLine: ux.helperLine,
      iconHint: ux.iconHint,
      sourceCode: code,
    });
  }

  return {
    kind: 'what_is_unresolved',
    items,
    isEmpty: items.length === 0,
    emptyNotice: NOTHING_UNRESOLVED_NOTICE,
  };
}

function buildSectionWhereItSits(
  node: ArgumentTimelineMapNode,
  totalCount: number,
  activePathIds: ReadonlyArray<string>,
): SidecarSection_WhereItSits {
  const branchLabel = node.depth === 0 || node.branchRootMessageId === node.messageId
    ? 'Mainline'
    : 'Side branch';

  const pathLabel = activePathIds.length === 0
    ? 'standalone'
    : activePathIds
        .map((_id, i) => (i === 0 ? 'Root' : `#${i + 1}`))
        .join(' → ');

  return {
    kind: 'where_it_sits',
    branchLabel,
    laneIndex: node.lane,
    depth: node.depth,
    pathLabel,
    totalCount,
    ordinal: node.ordinal,
  };
}

function buildSectionSuggestedNextMove(): SidecarSection_SuggestedNextMove {
  return {
    kind: 'suggested_next_move',
    suggestion: null,
    reason: 'st_002_not_yet_implemented',
    placeholderLine: ST_002_PLACEHOLDER,
  };
}

// The semantic-flag chip builder lives in the shared
// `detail/argumentDetailModel.ts` module (the single source both surfaces
// consume). It is imported as `buildSharedSectionSemanticFlags` at the top
// of this file and called from `buildSidecarViewModel` below.

function buildEmptyViewModel(viewMode: SidecarViewMode): SidecarViewModel {
  return {
    isEmpty: true,
    selectedMessageId: null,
    viewMode,
    sections: [],
    accessibilityRootLabel: EMPTY_STATE_MESSAGE,
    emptyStateMessage: EMPTY_STATE_MESSAGE,
  };
}

function buildAccessibilityRootLabel(
  whatSays: SidecarSection_WhatThisMoveSays,
  whyMatters: SidecarSection_WhyItMatters,
  whereItSits: SidecarSection_WhereItSits,
): string {
  return [
    `${whatSays.kindLabel} from ${whatSays.actorLabel}.`,
    `Message ${whereItSits.ordinal} of ${whereItSits.totalCount}.`,
    whyMatters.isEmpty ? '' : whyMatters.lifecycleHelperLine,
  ]
    .filter((s) => s && s.length > 0)
    .join(' ');
}

// ── Public builder ───────────────────────────────────────────

export function buildSidecarViewModel(input: BuildSidecarViewModelInput): SidecarViewModel {
  if (!input.activeNode || !input.activeViewModel) {
    return buildEmptyViewModel(input.viewMode);
  }

  const cap = resolveBodyExcerptCap(input.bodyExcerptCap);
  const node = input.activeNode;
  const vm = input.activeViewModel;
  const clusterId = node.branchRootMessageId || null;

  const whatSays = buildSectionWhatThisMoveSays(node, vm, input.parentNode, cap);
  const whyMatters = buildSectionWhyItMatters(input.lifecycleMap, clusterId);
  const whatIsUnresolved = buildSectionWhatIsUnresolved(
    input.metadataLedger,
    clusterId,
    input.lifecycleMap,
  );
  const whereItSits = buildSectionWhereItSits(node, input.totalCount, input.activePathIds);
  const suggested = buildSectionSuggestedNextMove();
  const semanticFlags = buildSharedSectionSemanticFlags(
    input.metadataLedger,
    clusterId,
    whyMatters.lifecycleLabel,
    input.viewMode,
  );

  const sections: SidecarSection[] = [
    whatSays,
    whyMatters,
    whatIsUnresolved,
    whereItSits,
    suggested,
    semanticFlags,
  ];

  // Touch the metadata-for-move getter so the builder still has a use
  // for the per-move record in v1 (forward-compat: ST-002 / HIST-001 may
  // start reading it). The result is discarded; no behavior change.
  void getMetadataForMove(input.metadataLedger, node.messageId);

  return {
    isEmpty: false,
    selectedMessageId: node.messageId,
    viewMode: input.viewMode,
    sections,
    accessibilityRootLabel: buildAccessibilityRootLabel(whatSays, whyMatters, whereItSits),
    emptyStateMessage: EMPTY_STATE_MESSAGE,
  };
}

// ── Test-visible constants ───────────────────────────────────

/**
 * Re-exported for tests so they don't re-author the same strings.
 */
export const SIDECAR_COPY = Object.freeze({
  EMPTY_STATE_MESSAGE,
  HIDDEN_NOTICE,
  NOTHING_UNRESOLVED_NOTICE,
  LIFECYCLE_EMPTY_HELPER,
  LIFECYCLE_EMPTY_LABEL,
  ST_002_PLACEHOLDER,
});

/**
 * Field paths whose value is permitted to look like an internal code
 * (snake_case). Tests use this whitelist when scanning for code leakage
 * — these fields are explicitly typed as internal identifiers and the
 * component must not render them as text.
 */
export const INTERNAL_CODE_FIELD_PATHS: ReadonlyArray<string> = Object.freeze([
  'sections.[].lifecycleStateCode',
  'sections.[].items.[].sourceCode',
  'sections.[].chips.[].sourceCode',
  'sections.[].chips.[].id',
  'sections.[].items.[].id',
  'sections.[].kind',
  'sections.[].chips.[].family',
  'sections.[].suggestion',
  'sections.[].reason',
  'sections.[].chips.[].iconHint',
  'sections.[].items.[].iconHint',
  'sections.[].lifecycleIconHint',
]);
