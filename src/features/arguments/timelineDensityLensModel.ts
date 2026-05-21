/**
 * IX-001 — Timeline density + focus-lens model (pure TypeScript).
 *
 * The shared density + lens core consumed by two surfaces:
 *   - the Conversation Gallery (Epic 11, shipped) — lenses dim cards,
 *     density sizes cards;
 *   - the QOL-033 in-room Go popout (in flight) — lenses dim timeline
 *     nodes, density sizes the board.
 *
 * IX-001 ships NO screen. This file plus the thin `useDensityLens` hook
 * are the whole deliverable. The gallery screen and QOL-033 *render* this
 * model.
 *
 * Pure TS. No React. No Supabase. No network. No AI. No `Date.now()`
 * (recency is computed against a caller-supplied `nowMs`, mirroring
 * `conversationGalleryModel`'s own clock injection so every function is
 * deterministic and testable). No mutation of any input.
 *
 * Doctrine (cdiscourse-doctrine §1/§2/§3/§9, timeline-grammar):
 *   - A density mode and a focus lens are VIEW STATE ONLY. Neither is ever
 *     an input to the Constitution engine, `argumentScoreModel`,
 *     `antiAmplification`, or any validation gate.
 *   - A focus lens DIMS, never deletes. `LensEmphasis` has no `hidden`
 *     value — a lens structurally cannot remove an item from the data set.
 *   - "hot" / "heating up" are ACTIVITY and MOMENTUM signals, never
 *     verdicts. They read `ConversationGalleryCard.heatLevel`, whose source
 *     model (`computeConversationHeat`) is already defined as "active
 *     friction, not popular" and excludes view / retweet / follower counts.
 *     The lens copy says so out loud.
 *   - No authored string here implies truth, winning, losing, correctness,
 *     or popularity-as-evidence. No internal snake_case code reaches a
 *     user-facing string. Ban-list tests enforce both.
 *   - Density NEVER hides data — it changes excerpt length and which
 *     OPTIONAL surface regions render; the full record is always one tap
 *     away.
 *
 * Reconciliation note (design §3.1): the codebase ships a 3-mode
 * `TimelineDensityMode` (`compact·normal·expanded`). IX-001's
 * `GalleryDensityMode` is a STRICT SUPERSET — the three shipped values 1:1
 * by the same name, plus a 4th gallery-only `scan` tier that clamps DOWN
 * to `compact` for the in-room timeline (a node must keep its ≥44px hit
 * target). `TimelineDensityMode` is NOT forked and gains no 4th value.
 */

import type { ConversationGalleryCard, ConversationSortMode } from '../debates/conversationGalleryModel';
import type { PointLifecycleState } from '../lifecycle';
import type { ArgumentTimelineMapNode } from './argumentGameSurfaceModel';
import type { TimelineDensityMode } from './timelineNodeVisualModel';

// ════════════════════════════════════════════════════════════════
// 1. Density model
// ════════════════════════════════════════════════════════════════

/**
 * IX-001 — Density modes. A STRICT SUPERSET of VG-004's TimelineDensityMode.
 *
 *   - 'expanded' | 'normal' | 'compact'  → the three shipped TimelineDensityMode
 *                                           values, 1:1, by the same name.
 *   - 'scan'                             → an additional gallery-only ultra-
 *                                           dense tier (one-line rows). It maps
 *                                           DOWN to 'compact' for the in-room
 *                                           timeline (the board never goes
 *                                           tighter than 'compact' — node hit
 *                                           targets must stay ≥ 44px).
 *
 * The stub's literal names (spacious/balanced/compact/scan) are reconciled to
 * the SHIPPED names so VG-004 / PR-001 / QOL-033 are not forked:
 *   stub 'spacious'  ≡  'expanded'
 *   stub 'balanced'  ≡  'normal'     (the default)
 *   stub 'compact'   ≡  'compact'
 *   stub 'scan'      ≡  'scan'       (new, gallery-only effect)
 */
export type GalleryDensityMode = 'expanded' | 'normal' | 'compact' | 'scan';

export const ALL_GALLERY_DENSITY_MODES: ReadonlyArray<GalleryDensityMode> =
  Object.freeze(['expanded', 'normal', 'compact', 'scan']);

/** The default. Mirrors the stub's `balanced default`. */
export const DEFAULT_GALLERY_DENSITY: GalleryDensityMode = 'normal';

/**
 * Project a GalleryDensityMode onto the shipped TimelineDensityMode.
 * 'scan' clamps to 'compact' — the board never renders tighter than
 * 'compact' so every node keeps its ≥44px hit target (accessibility-targets).
 */
export function toTimelineDensityMode(mode: GalleryDensityMode): TimelineDensityMode {
  switch (mode) {
    case 'expanded':
      return 'expanded';
    case 'normal':
      return 'normal';
    case 'compact':
      return 'compact';
    case 'scan':
      return 'compact'; // clamp — see §3.1
  }
}

/** What a gallery card renders at a given density. Descriptive, not pixels. */
export interface GalleryDensitySpec {
  mode: GalleryDensityMode;
  /** Lines of the first-post excerpt to show (0 = excerpt region hidden). */
  firstPostExcerptLines: number;
  /** Lines of the latest-post excerpt to show. */
  latestPostExcerptLines: number;
  /** Render the ConversationMiniTimeline rail on the card? */
  showMiniTimeline: boolean;
  /** Render the full signal chip strip, or only the single highest-tone chip? */
  signalChips: 'all' | 'primary_only';
  /** Render the stats row (moves · replies · participants)? */
  showStatsRow: boolean;
  /** Card vertical rhythm hint for the renderer's style map. */
  rhythm: 'roomy' | 'standard' | 'tight' | 'single_line';
}

export const GALLERY_DENSITY_SPECS: Readonly<Record<GalleryDensityMode, GalleryDensitySpec>> =
  Object.freeze({
    expanded: {
      mode: 'expanded',
      firstPostExcerptLines: 3,
      latestPostExcerptLines: 3,
      showMiniTimeline: true,
      signalChips: 'all',
      showStatsRow: true,
      rhythm: 'roomy',
    },
    normal: {
      mode: 'normal',
      firstPostExcerptLines: 2,
      latestPostExcerptLines: 2,
      showMiniTimeline: true,
      signalChips: 'all',
      showStatsRow: true,
      rhythm: 'standard',
    },
    compact: {
      mode: 'compact',
      firstPostExcerptLines: 1,
      latestPostExcerptLines: 1,
      showMiniTimeline: true,
      signalChips: 'primary_only',
      showStatsRow: true,
      rhythm: 'tight',
    },
    scan: {
      mode: 'scan',
      firstPostExcerptLines: 0,
      latestPostExcerptLines: 1,
      showMiniTimeline: false,
      signalChips: 'primary_only',
      showStatsRow: false,
      rhythm: 'single_line',
    },
  });

export function resolveGalleryDensitySpec(mode: GalleryDensityMode): GalleryDensitySpec {
  return GALLERY_DENSITY_SPECS[mode];
}

/**
 * True when a density change is identity-preserving for `activeId`.
 * Density NEVER changes membership/order, so this is always true when
 * `activeId` is in both lists — the helper exists to lock the invariant.
 */
export function densityChangePreservesActive(
  before: ReadonlyArray<{ id: string }>,
  after: ReadonlyArray<{ id: string }>,
  activeId: string | null,
): boolean {
  if (activeId == null) return true;
  return before.some((x) => x.id === activeId) === after.some((x) => x.id === activeId);
}

// ════════════════════════════════════════════════════════════════
// 2. Focus-lens model
// ════════════════════════════════════════════════════════════════

/** The 11 focus lenses. `none` is the unfiltered baseline (everything bright). */
export type FocusLensId =
  | 'none'
  | 'needs_response'
  | 'no_rebuttal'
  | 'heating_up'
  | 'hot'
  | 'quiet_plain'
  | 'evidence_requested'
  | 'source_chain_pressure'
  | 'private_invites'
  | 'my_active_rooms'
  | 'recently_updated'
  | 'settled_locked';

export const ALL_FOCUS_LENSES: ReadonlyArray<FocusLensId> = Object.freeze([
  'none',
  'needs_response',
  'no_rebuttal',
  'heating_up',
  'hot',
  'quiet_plain',
  'evidence_requested',
  'source_chain_pressure',
  'private_invites',
  'my_active_rooms',
  'recently_updated',
  'settled_locked',
]);

export const DEFAULT_FOCUS_LENS: FocusLensId = 'none';

/**
 * The subset of FocusLensId that is meaningful on the in-room timeline.
 * Gallery-only lenses (`private_invites`, `my_active_rooms`,
 * `recently_updated`, `settled_locked`) describe a whole conversation, not
 * a node — they have no node-level meaning, so they are absent here. The
 * Go popout's Lens control offers only `TIMELINE_LENS_IDS`; the gallery's
 * offers all of `ALL_FOCUS_LENSES`. One union, two scoped views (§4.5).
 */
export const TIMELINE_LENS_IDS: ReadonlyArray<FocusLensId> = Object.freeze([
  'none',
  'needs_response',
  'no_rebuttal',
  'heating_up',
  'hot',
  'evidence_requested',
  'source_chain_pressure',
]);

/** Authored copy for one focus lens. The only authored copy IX-001 introduces. */
export interface FocusLensCopy {
  id: FocusLensId;
  /** Chip label — ≤ 3 words, plain, verdict-free. */
  label: string;
  /** One line shown when the lens is active or in the picker. */
  helper: string;
  /** Shown when the lens matches zero items. */
  emptyNote: string;
}

export const FOCUS_LENS_COPY: Readonly<Record<FocusLensId, FocusLensCopy>> = Object.freeze({
  none: {
    id: 'none',
    label: 'No lens',
    helper: 'Every room shown at full focus.',
    emptyNote: '',
  },
  needs_response: {
    id: 'needs_response',
    label: 'Needs a response',
    helper: 'Rooms where the latest move is waiting on a reply.',
    emptyNote: 'Nothing is waiting on a response.',
  },
  no_rebuttal: {
    id: 'no_rebuttal',
    label: 'No rebuttal yet',
    helper: 'Opening claims that nobody has answered.',
    emptyNote: 'Every opening claim has a reply.',
  },
  heating_up: {
    id: 'heating_up',
    label: 'Heating up',
    helper: 'Picking up moves — momentum, not a result.',
    emptyNote: 'No rooms are picking up pace.',
  },
  hot: {
    id: 'hot',
    label: 'Hot now',
    helper: 'Lots of recent activity — activity, not a result.',
    emptyNote: 'No rooms are busy at the moment.',
  },
  quiet_plain: {
    id: 'quiet_plain',
    label: 'Quiet rooms',
    helper: 'Calm rooms — an easy place to make a first move.',
    emptyNote: 'No quiet rooms at the moment.',
  },
  evidence_requested: {
    id: 'evidence_requested',
    label: 'Evidence asked',
    helper: 'A source has been requested and is still owed.',
    emptyNote: 'No rooms are waiting on evidence.',
  },
  source_chain_pressure: {
    id: 'source_chain_pressure',
    label: 'Source-chain',
    helper: 'Rooms tracing where a claim actually came from.',
    emptyNote: 'No source-chain pressure at the moment.',
  },
  private_invites: {
    id: 'private_invites',
    label: 'Private invites',
    helper: 'Private rooms you have been invited to.',
    emptyNote: 'No private invites at the moment.',
  },
  my_active_rooms: {
    id: 'my_active_rooms',
    label: 'My rooms',
    helper: 'Rooms you have joined that are still going.',
    emptyNote: 'You have no active rooms.',
  },
  recently_updated: {
    id: 'recently_updated',
    label: 'Just updated',
    helper: 'Rooms with a move in the last day.',
    emptyNote: 'Nothing has updated recently.',
  },
  settled_locked: {
    id: 'settled_locked',
    label: 'Settled',
    helper: 'Rooms that have closed — read-only, still referenceable.',
    emptyNote: 'No rooms have settled yet.',
  },
});

// ── Lifecycle-state sets the predicates read ────────────────────

/** Recency window for `recently_updated`. */
export const RECENTLY_UPDATED_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day

/** LIFE-001 states that mean "a source/quote is owed and unanswered". */
const EVIDENCE_DEBT_STATES: ReadonlySet<PointLifecycleState> = new Set<PointLifecycleState>([
  'source_requested',
  'quote_requested',
]);

/** LIFE-001 states that mean "this point still needs a move from someone". */
const NEEDS_RESPONSE_STATES: ReadonlySet<PointLifecycleState> = new Set<PointLifecycleState>([
  'open',
  'rebutted',
  'clarified',
  'source_requested',
  'quote_requested',
  'narrowed',
]);

/** LIFE-001 states that mean "closed". */
const SETTLED_STATES: ReadonlySet<PointLifecycleState> = new Set<PointLifecycleState>([
  'archived_or_resolved',
]);

// ── Gallery-side lens predicates ────────────────────────────────

/** Context a few gallery lenses need beyond the card itself. */
export interface LensContext {
  /** Caller's clock, injected for determinism (never `Date.now()` here). */
  nowMs: number;
  /**
   * Debate ids the viewer has a pending invite to. RLS-bound; loader-
   * supplied (see design §6 — the invite query). Empty/undefined when not
   * loaded — `private_invites` then matches nothing and shows its empty note.
   */
  invitedDebateIds?: ReadonlySet<string>;
}

/** One gallery lens predicate. `card` is already built; `ctx` carries clock + invites. */
export type GalleryLensPredicate = (card: ConversationGalleryCard, ctx: LensContext) => boolean;

export const GALLERY_LENS_PREDICATES: Readonly<Record<FocusLensId, GalleryLensPredicate>> =
  Object.freeze({
    // The baseline — every card matches, so nothing is ever dimmed.
    none: () => true,

    // 1. Latest move is awaiting a reply. Lifecycle-primary; bucket fallback.
    needs_response: (c) =>
      c.rootClusterLifecycleState != null
        ? NEEDS_RESPONSE_STATES.has(c.rootClusterLifecycleState)
        : c.hasNoRebuttal || c.unresolvedReason != null,

    // 2. Opening claim, zero rebuttals. Pure structural card field.
    no_rebuttal: (c) => c.hasNoRebuttal,

    // 3. Momentum — gaining pace. Reads the heat LEVEL, never popularity.
    heating_up: (c) => c.heatLevel === 'warming' || c.bucket === 'gaining_heat',

    // 4. High recent activity. ACTIVITY, never correctness (doctrine §2).
    hot: (c) => c.heatLevel === 'hot' || c.heatLevel === 'overheated',

    // 5. Calm room — easy first move. Plain/pedantic temperament + cold heat.
    quiet_plain: (c) =>
      (c.temperament === 'plain' || c.temperament === 'pedantic') && c.heatLevel === 'cold',

    // 6. A source was asked for and is still owed. EV-003 evidence debt.
    evidence_requested: (c) =>
      (c.rootClusterLifecycleState != null &&
        EVIDENCE_DEBT_STATES.has(c.rootClusterLifecycleState)) ||
      c.evidentiaryRisk === 'high',

    // 7. The room is tracing a claim's source chain. EV-003 source-chain risk.
    source_chain_pressure: (c) =>
      c.sourceChainRisk === 'high' ||
      c.sourceChainRisk === 'medium' ||
      c.platformSupportWarning,

    // 8. A private room the viewer is invited to. Viewer-scoped (ctx).
    private_invites: (c, ctx) =>
      c.openStatus !== 'archived' &&
      (ctx.invitedDebateIds?.has(c.debateId) ?? false) &&
      !c.hasUserJoined,

    // 9. A room the viewer joined that is still going. Viewer-scoped.
    my_active_rooms: (c) =>
      c.hasUserJoined && (c.openStatus === 'open' || c.openStatus === 'draft'),

    // 10. A move landed within the recency window. Clock injected via ctx.
    recently_updated: (c, ctx) =>
      ctx.nowMs - c.sortKeys.latestActivityMs <= RECENTLY_UPDATED_WINDOW_MS &&
      c.sortKeys.latestActivityMs > 0,

    // 11. The room has closed. Lifecycle-primary; openStatus fallback.
    settled_locked: (c) =>
      (c.rootClusterLifecycleState != null && SETTLED_STATES.has(c.rootClusterLifecycleState)) ||
      c.openStatus === 'locked' ||
      c.openStatus === 'archived' ||
      c.bucket === 'resolved_or_synthesized',
  });

// ── Room-side (timeline) lens predicates ────────────────────────

/**
 * `ArgumentTimelineMapNode` augmented with an OPTIONAL per-node lifecycle
 * state. The shipped map node has no `lifecycleState` field today (design
 * §15-Q5). When LIFE-001 wires a per-node state onto the map, the timeline
 * lifecycle lenses use it; until then they fall back to `temperatureBand` /
 * kind / child-edge count exactly as the gallery lenses fall back to
 * `bucket` / risk axes. No node predicate ever throws on the absence.
 */
export type TimelineLensNode = ArgumentTimelineMapNode & {
  /** LIFE-001 per-node state when loader-populated; absent otherwise. */
  lifecycleState?: PointLifecycleState | null;
};

/** Context the timeline lens predicates need beyond the node itself. */
export interface TimelineLensContext {
  /** Message ids on the path from root to the active node (topology). */
  activePathIds: ReadonlySet<string>;
  /**
   * Message ids that have at least one child edge. Supplied by the caller
   * (QOL-033 builds it from the map's edge list). A node absent from this
   * set has no answered child — used by `no_rebuttal`. Empty/undefined is
   * treated as "no node has a child".
   */
  nodeIdsWithChildren?: ReadonlySet<string>;
}

/** One timeline lens predicate. Pure over a built map node. */
export type TimelineLensPredicate = (node: TimelineLensNode, ctx: TimelineLensContext) => boolean;

export const TIMELINE_LENS_PREDICATES: Readonly<Record<FocusLensId, TimelineLensPredicate>> =
  Object.freeze({
    // The baseline — every node matches, so nothing is ever dimmed.
    none: () => true,

    // Needs a move. Lifecycle-primary; falls back to a warm/hot tone band
    // when the per-node lifecycle state is not yet on the map node.
    needs_response: (n) =>
      n.lifecycleState != null
        ? NEEDS_RESPONSE_STATES.has(n.lifecycleState)
        : n.temperatureBand === 'warm' || n.temperatureBand === 'hot',

    // Opening claim with no child edge. Root nodes (or lifecycle `open`)
    // that nobody has answered.
    no_rebuttal: (n, ctx) => {
      const hasChild = ctx.nodeIdsWithChildren?.has(n.messageId) ?? false;
      if (hasChild) return false;
      if (n.lifecycleState != null) return n.lifecycleState === 'open';
      return n.isRoot;
    },

    // Momentum — a node whose activity tone is warming.
    heating_up: (n) => n.temperatureBand === 'warm',

    // High recent activity on this node. ACTIVITY, never correctness.
    hot: (n) => n.temperatureBand === 'hot',

    // A source/quote is owed at this node. Lifecycle-primary; falls back to
    // the source-chain kind family when per-node lifecycle is absent.
    evidence_requested: (n) =>
      n.lifecycleState != null
        ? EVIDENCE_DEBT_STATES.has(n.lifecycleState)
        : n.kindColorFamily === 'evidence',

    // The node is part of a source-chain trace. Reads the node's kind
    // color family — the timeline-grammar source-chain encoding.
    source_chain_pressure: (n) => n.kindColorFamily === 'evidence',

    // Gallery-only lenses are room-level facts with no node meaning. They
    // are absent from TIMELINE_LENS_IDS; their predicates here always
    // return false so an accidental call never dims the whole board.
    quiet_plain: () => false,
    private_invites: () => false,
    my_active_rooms: () => false,
    recently_updated: () => false,
    settled_locked: () => false,
  });

/**
 * The "Active path" lens — a TOPOLOGY filter (root → active node path),
 * not a lifecycle-stage filter. Kept as a separate helper exactly as
 * QOL-033 §3.3 specifies ("topology, not stage"). True for nodes on the
 * active path.
 */
export function activePathLens(node: TimelineLensNode, ctx: TimelineLensContext): boolean {
  return ctx.activePathIds.has(node.messageId);
}

// ════════════════════════════════════════════════════════════════
// 3. Applying a lens — the dim projection
// ════════════════════════════════════════════════════════════════

/**
 * Per-item render emphasis a lens produces. There is deliberately NO
 * `hidden` value — a lens structurally cannot delete an item.
 */
export type LensEmphasis = 'bright' | 'dimmed';

/** An item paired with its lens verdict. The list length never changes. */
export interface LensedItem<T> {
  item: T;
  emphasis: LensEmphasis;
}

/** The shape both `applyGalleryLens` and `applyTimelineLens` return. */
export interface LensApplication<T> {
  items: LensedItem<T>[];
  matchCount: number;
  isEmpty: boolean;
}

/**
 * Apply a gallery lens. Returns EVERY card, each tagged bright|dimmed.
 *
 * Invariants:
 *   1. `items.length === cards.length` — always; a lens never drops a card.
 *   2. When `matchCount === 0` and `lens !== 'none'`, every card is forced
 *      back to `bright` and `isEmpty` is `true` — the surface renders
 *      unfiltered and the caller shows `FOCUS_LENS_COPY[lens].emptyNote`.
 *   3. `emphasis` is only ever `'bright' | 'dimmed'`.
 */
export function applyGalleryLens(
  cards: ReadonlyArray<ConversationGalleryCard>,
  lens: FocusLensId,
  ctx: LensContext,
): LensApplication<ConversationGalleryCard> {
  const predicate = GALLERY_LENS_PREDICATES[lens];
  let matchCount = 0;
  const items: LensedItem<ConversationGalleryCard>[] = cards.map((card) => {
    const match = predicate(card, ctx);
    if (match) matchCount += 1;
    // `none` keeps everything bright; any other lens dims non-matches.
    const emphasis: LensEmphasis = lens === 'none' || match ? 'bright' : 'dimmed';
    return { item: card, emphasis };
  });
  // A lens that matches zero cards "leaves the surface unfiltered" (stub):
  // every card reverts to bright and the caller shows `emptyNote`.
  const isEmpty = lens !== 'none' && matchCount === 0;
  if (isEmpty) {
    return {
      items: items.map((i) => ({ item: i.item, emphasis: 'bright' as const })),
      matchCount: 0,
      isEmpty: true,
    };
  }
  return { items, matchCount, isEmpty: false };
}

/**
 * Apply a timeline lens. The structural twin of `applyGalleryLens` over
 * `TimelineLensNode`. Same three invariants. Gallery-only lenses match no
 * node, so passing one yields `isEmpty: true` with every node bright — the
 * board is never silently emptied.
 */
export function applyTimelineLens(
  nodes: ReadonlyArray<TimelineLensNode>,
  lens: FocusLensId,
  ctx: TimelineLensContext,
): LensApplication<TimelineLensNode> {
  const predicate = TIMELINE_LENS_PREDICATES[lens];
  let matchCount = 0;
  const items: LensedItem<TimelineLensNode>[] = nodes.map((node) => {
    const match = predicate(node, ctx);
    if (match) matchCount += 1;
    const emphasis: LensEmphasis = lens === 'none' || match ? 'bright' : 'dimmed';
    return { item: node, emphasis };
  });
  const isEmpty = lens !== 'none' && matchCount === 0;
  if (isEmpty) {
    return {
      items: items.map((i) => ({ item: i.item, emphasis: 'bright' as const })),
      matchCount: 0,
      isEmpty: true,
    };
  }
  return { items, matchCount, isEmpty: false };
}

// ════════════════════════════════════════════════════════════════
// 4. Sort + view config
// ════════════════════════════════════════════════════════════════

/**
 * The 3-axis coarse sort vocabulary IX-001 exposes for callers (like
 * QOL-033's future gallery-style controls) that want a reduced surface.
 * `toConversationSortMode` maps each axis onto a shipped
 * `ConversationSortMode` — IX-001 re-implements no comparator.
 */
export type GallerySortAxis = 'by_created' | 'by_activity' | 'by_engagement_state';

export const ALL_GALLERY_SORT_AXES: ReadonlyArray<GallerySortAxis> = Object.freeze([
  'by_created',
  'by_activity',
  'by_engagement_state',
]);

/**
 * Map a coarse `GallerySortAxis` onto the shipped `ConversationSortMode`.
 * `by_engagement_state` resolves to `needs_rebuttal_first` — a LIFECYCLE
 * sort (who needs a move first), never a popularity sort.
 */
export function toConversationSortMode(axis: GallerySortAxis): ConversationSortMode {
  switch (axis) {
    case 'by_created':
      return 'newest_created';
    case 'by_activity':
      return 'latest_activity';
    case 'by_engagement_state':
      return 'needs_rebuttal_first';
  }
}

/** The complete IX-001 view configuration. Session state; one per surface. */
export interface DensityLensViewConfig {
  density: GalleryDensityMode; // §3 — default 'normal'
  lens: FocusLensId; // §4 — default 'none'
  sortAxis: GallerySortAxis; // default 'by_activity'
  /** Trimmed lowercase search query; '' = no search. */
  searchQuery: string;
  /** 0-based page index. */
  pageIndex: number;
  /** Page size; clamped 1..100 by paginateConversationGalleryCards. */
  pageSize: number;
}

export const DEFAULT_DENSITY_LENS_VIEW_CONFIG: DensityLensViewConfig = Object.freeze({
  density: DEFAULT_GALLERY_DENSITY,
  lens: DEFAULT_FOCUS_LENS,
  sortAxis: 'by_activity',
  searchQuery: '',
  pageIndex: 0,
  pageSize: 24,
});

/**
 * Given a config change, return the next config with `pageIndex` reset to
 * 0 when the change alters the visible set/order. Density does NOT reset
 * the page (it never changes membership — §3.4). A lens does NOT reset the
 * page (it dims, never removes — §4.6). Search and sort DO reset, because
 * they genuinely reorder the list. `prev` is never mutated.
 */
export function applyViewConfigChange(
  prev: DensityLensViewConfig,
  patch: Partial<DensityLensViewConfig>,
): DensityLensViewConfig {
  const next: DensityLensViewConfig = { ...prev, ...patch };
  const membershipChanged =
    ('searchQuery' in patch && patch.searchQuery !== prev.searchQuery) ||
    ('sortAxis' in patch && patch.sortAxis !== prev.sortAxis);
  if (membershipChanged) {
    next.pageIndex = 0;
  }
  return next;
}
