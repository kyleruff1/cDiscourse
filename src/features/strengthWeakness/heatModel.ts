/**
 * SW-002 — Heat, momentum, trend model.
 *
 * The activity-model layer that downstream UI cards (Conversation Gallery
 * cards GAL-001 / GAL-002, Timeline mini-map IX-002, future segment-marker
 * UI) read to color, sort, and signal "what is going on" in a room. This
 * is the doctrine-sensitive replacement for engagement / popularity /
 * heat-as-truth instincts.
 *
 * Doctrine constraints (cdiscourse-doctrine §2 + COPY-001 §5.1 + §8):
 *
 *   - HEAT means ACTIVITY / FRICTION, NEVER correctness or who is right.
 *   - Popularity is NOT evidence; engagement velocity is NOT standing.
 *     The deriver reads zero engagement / view / like / follower fields.
 *   - A "hot" cluster is an ACTIVITY descriptor — never a claim that a
 *     side is right.
 *   - A "quiet" room is an EASY-ENTRY opportunity, never a verdict of
 *     "the conversation is decided".
 *   - No `winning / losing / dominant / losing ground / gaining ground /
 *     proven / disproven / true / false / right / wrong / verdict /
 *     validated / correct / incorrect` token in any literal the module
 *     emits.
 *   - Side-stratified heat is OUT OF SCOPE for v1 — the model is
 *     room-level only. Stratifying by side would invite a leaderboard
 *     reading, which the doctrine refuses.
 *   - No new presets, no new dependencies, no `Date.now()`, no
 *     `Math.random()` inside the deriver. The deriver is pure, total,
 *     deterministic. `clockMs` is injected by the caller.
 *   - The model produces ACTIVITY-DESCRIPTIVE data; UIs decide how to
 *     render it. SW-002 ships no React, no rendering, no animation, no
 *     styling.
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI. The maps
 * are frozen at module-load time.
 *
 * Boundary (enforced by `__tests__/heatModel.test.ts`):
 *   - Cross-module imports of LIFE-001 / META-001 / argumentGameSurface
 *     are `import type` only — no runtime values pulled.
 *   - The single runtime-value import is from RULE-003's
 *     `lifecycleUxMap.ts`, used to read helper-line text at module-load
 *     time. This is documented; the forbidden-imports test allows it
 *     explicitly.
 *   - No imports of `buildPointLifecycleMap`, `buildMoveMetadataLedger`,
 *     `deriveAutoMetadataForMessage`, `gradeChallenge`, `gradeRepair`,
 *     `applyAntiAmplification`, `supabase`, `fetch`, `anthropic`, `xai`,
 *     `Date.now`, `Math.random`, `console.log`.
 *
 * `hot` carve-out (doctrine §2):
 *   The string `hot` IS a valid `HeatLevel` value AND is explicitly NOT
 *   in `_forbiddenActivityTokens()`. COPY-001 §5.1 + §8 documents the
 *   carve-out: "hot = activity, never correctness". The ban-list test
 *   pins this with an inline comment.
 */

import type {
  PointLifecycleClusterSummary,
  PointLifecycleMap,
  PointLifecycleState,
} from '../lifecycle';
import type {
  AutoMetadataCode,
  ClusterMetadataSummary,
  ManualTagCode,
  MoveMetadataLedger,
} from '../metadata';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
} from '../arguments/argumentGameSurfaceModel';
import {
  LIFECYCLE_UX_MAP,
  MANUAL_TAG_UX_MAP,
} from '../rulesUx/lifecycleUxMap';

// ── Public types — coarse 3-valued unions ─────────────────────

/**
 * SW-002 — Heat level. A 3-valued coarse band describing activity density
 * in the room. **NEVER** a number ranking. **NEVER** a percentile.
 * **NEVER** a claim that a side is right.
 *
 * Doctrine carve-out: `hot` is an activity descriptor (lots of recent
 * posts, unresolved debt, repeated axis pressure). It is the COPY-001
 * approved carve-out — the only token in the SW-002 vocabulary that
 * survives the verdict-adjacent scan because doctrine §2 explicitly
 * permits "hot = activity". The ban-list test EXCLUDES `hot` for this
 * exact reason.
 */
export type HeatLevel = 'quiet' | 'active' | 'hot';

export const ALL_HEAT_LEVELS: ReadonlyArray<HeatLevel> = Object.freeze([
  'quiet',
  'active',
  'hot',
]);

/**
 * SW-002 — Momentum state. A 3-valued coarse band describing activity
 * CHANGE between an earlier window and the most recent window. Never
 * "who is winning". `cooling` simply means recent activity is lower
 * than earlier activity; `building` means the inverse. `steady` means
 * no meaningful change.
 */
export type MomentumState = 'cooling' | 'steady' | 'building';

export const ALL_MOMENTUM_STATES: ReadonlyArray<MomentumState> = Object.freeze([
  'cooling',
  'steady',
  'building',
]);

/**
 * SW-002 — Trend direction. A 3-valued coarse band describing the
 * STRUCTURAL pattern the room is taking on. Never a verdict.
 *
 * - `unresolved_open` — at least one cluster has an open source / quote
 *    request or rebut without a closing concession / synthesis / sourced
 *    move. The default for any active room.
 * - `narrowing_toward_synthesis` — at least one cluster sits in
 *    `synthesis_ready` and no later rebut reopened it.
 * - `branch_proliferating` — three or more branches are actively engaged
 *    in the recent window. Reads as "side issues are multiplying", never
 *    as "the conversation is decided".
 */
export type TrendDirection =
  | 'unresolved_open'
  | 'narrowing_toward_synthesis'
  | 'branch_proliferating';

export const ALL_TREND_DIRECTIONS: ReadonlyArray<TrendDirection> = Object.freeze([
  'unresolved_open',
  'narrowing_toward_synthesis',
  'branch_proliferating',
]);

// ── Public types — activity chip vocabulary ───────────────────

/**
 * SW-002 — Activity chip kinds. Discriminated union of the 8 reason
 * codes a segment / room profile can surface. Each kind is an
 * observation about structural / temporal / lifecycle activity. **No
 * truth chips.**
 *
 * Naming rule: snake_case internally; the chip kind itself is never
 * rendered as plain text. Consumers look up the chip's helper-line via
 * `ACTIVITY_HELPER_LINES[chip.kind]`.
 */
export type ActivityChip =
  | { kind: 'recent_post' }
  | { kind: 'open_source_request' }
  | { kind: 'repeated_axis_pressure' }
  | { kind: 'no_rebuttal' }
  | { kind: 'synthesis_ready' }
  | { kind: 'branch_tangent' }
  | { kind: 'evidence_debt_open' }
  | { kind: 'cool_room_easy_entry' };

export type ActivityChipKind = ActivityChip['kind'];

export const ALL_ACTIVITY_CHIP_KINDS: ReadonlyArray<ActivityChipKind> = Object.freeze([
  'recent_post',
  'open_source_request',
  'repeated_axis_pressure',
  'no_rebuttal',
  'synthesis_ready',
  'branch_tangent',
  'evidence_debt_open',
  'cool_room_easy_entry',
]);

// ── Public types — segment / entry / profile ──────────────────

/**
 * SW-002 — One segment of the timeline. A segment is a DEPTH-BAND of
 * the argument tree (e.g. depth 0–2, depth 3–5), NOT a side-band, NOT a
 * winning-band.
 *
 * `heatLevel` is computed per-band from the same coarse mix the room
 * profile uses, restricted to nodes in that band.
 *
 * `helperLine` is composed from the segment's `reasonChips` (longest
 * helper-line wins on tie; never authored fresh).
 */
export interface ActivitySegment {
  depthRange: { from: number; to: number };
  heatLevel: HeatLevel;
  reasonChips: ReadonlyArray<ActivityChip>;
  helperLine: string;
}

/**
 * SW-002 — Where in the room is a new participant most likely to find a
 * useful first move? `null` when no clear opportunity exists (e.g.
 * archived / fully-resolved room).
 *
 * - `easy_first_move` — quiet room, root open, no rebuttal yet. The
 *    first reply will land cleanly.
 * - `mid_thread_join` — active room, multiple open clusters, no single
 *    obvious anchor. A new participant can pick any open cluster.
 * - `deep_existing_clash` — hot room with sustained same-axis pressure
 *    deep in the tree. A new participant can add evidence or narrow
 *    scope on the deepest active node.
 */
export type EntryOpportunity =
  | 'easy_first_move'
  | 'mid_thread_join'
  | 'deep_existing_clash';

export const ALL_ENTRY_OPPORTUNITIES: ReadonlyArray<EntryOpportunity> = Object.freeze([
  'easy_first_move',
  'mid_thread_join',
  'deep_existing_clash',
]);

/**
 * SW-002 — Per-room activity profile. The single thing the deriver
 * returns. Pure data, JSON-serializable.
 */
export interface RoomActivityProfile {
  heatLevel: HeatLevel;
  momentumState: MomentumState;
  trendDirection: TrendDirection;
  segments: ReadonlyArray<ActivitySegment>;
  entryOpportunity: EntryOpportunity | null;
}

// ── Public types — input bundle + thresholds ──────────────────

/**
 * SW-002 — Thresholds. Coarse on purpose. Tuning is a follow-up; v1
 * ships safe defaults that match the doctrine. **These constants are
 * LOCKED for v1** — see card SW-002 + design doc.
 */
export interface ActivityThresholds {
  /** Recent-window moves at-or-below this count → `quiet`. v1 default: 1. */
  recentMovesQuietMax: number;
  /** Recent-window moves at-or-above this count → `hot`. v1 default: 6. */
  recentMovesHotMin: number;
  /** Branches actively engaged in the recent window at-or-above this
   *  count → `branch_proliferating`. v1 default: 3. */
  activeBranchesProliferatingMin: number;
  /** Recent ÷ earlier ratio at-or-above this → `building`. v1 default: 1.5. */
  momentumBuildingRatioMin: number;
  /** Recent ÷ earlier ratio at-or-below this → `cooling`. v1 default: 0.5. */
  momentumCoolingRatioMax: number;
  /** Max number of depth bands the segmenter emits. v1 default: 4. */
  maxSegments: number;
}

/**
 * v1 LOCKED defaults. Documented inline. Changing any value requires a
 * follow-up card; SW-002 freezes the v1 thresholds.
 */
export const DEFAULT_ACTIVITY_THRESHOLDS: Readonly<ActivityThresholds> = Object.freeze({
  recentMovesQuietMax: 1, // v1 LOCKED
  recentMovesHotMin: 6, // v1 LOCKED
  activeBranchesProliferatingMin: 3, // v1 LOCKED
  momentumBuildingRatioMin: 1.5, // v1 LOCKED
  momentumCoolingRatioMax: 0.5, // v1 LOCKED
  maxSegments: 4, // v1 LOCKED
});

/**
 * SW-002 — Input bundle. Optional fields are gracefully handled (null /
 * missing → cool-room default; never thrown). The deriver is total.
 */
export interface HeatInputBundle {
  /** Timeline map for the room. May be empty / null. */
  timelineMap: ArgumentTimelineMapModel | null;
  /** Lifecycle map for the room. May be empty / null. */
  lifecycleMap: PointLifecycleMap | null;
  /** Metadata ledger for the room. May be empty / null. */
  metadataLedger: MoveMetadataLedger | null;
  /** Caller-injected "now". REQUIRED. The deriver NEVER reads
   *  `Date.now()`. Callers pass `Date.now()` (or a test clock)
   *  explicitly. */
  clockMs: number;
  /** Recent-activity window in milliseconds. Default: 24 hours
   *  (86_400_000 ms). Values ≤ 0 or non-finite → default. */
  recentWindowMs?: number;
  /** Pre-recent comparison window in milliseconds. Used to compute
   *  momentum (cooling vs building). Default: 72 hours (259_200_000 ms)
   *  starting at `clockMs - recentWindowMs`. Values ≤ 0 or non-finite
   *  → default. */
  comparisonWindowMs?: number;
  /** Per-field threshold overrides. Non-finite or negative values are
   *  substituted with the v1 default. */
  thresholds?: Partial<ActivityThresholds>;
}

// ── Activity helper-line lookup ───────────────────────────────

/**
 * SW-002 — Activity chip helper-line lookup. Each entry is a single
 * plain-language phrase ≤ 80 chars.
 *
 * Where an entry exists in RULE-003's `LIFECYCLE_UX_MAP` / `MANUAL_TAG_UX_MAP`
 * / `AUTO_METADATA_UX_MAP`, the SW-002 entry reads from RULE-003 verbatim
 * (no parallel copy authored). The two NEW strings (`recent_post`,
 * `cool_room_easy_entry`) are short plain-language lines that pass the
 * ban-list test.
 *
 * Frozen at module-load time. Consumers MUST NOT mutate.
 */
export const ACTIVITY_HELPER_LINES: Readonly<Record<ActivityChipKind, string>> = Object.freeze({
  // NEW text (passes ban-list).
  recent_post: 'Recent activity here.',
  // RULE-003 reads.
  open_source_request: LIFECYCLE_UX_MAP.source_requested.helperLine,
  repeated_axis_pressure: LIFECYCLE_UX_MAP.exhausted.helperLine,
  no_rebuttal: LIFECYCLE_UX_MAP.open.helperLine,
  synthesis_ready: LIFECYCLE_UX_MAP.synthesis_ready.helperLine,
  branch_tangent: LIFECYCLE_UX_MAP.branch_recommended.helperLine,
  evidence_debt_open: MANUAL_TAG_UX_MAP.evidence_debt.helperLine,
  // NEW text (passes ban-list).
  cool_room_easy_entry: 'Quiet room — an easy first move.',
});

// ── Ban-list helper ───────────────────────────────────────────

/**
 * SW-002 — Ban-list scan helper for tests. Returns the concatenated
 * dedup'd token list from:
 *   - The COPY-001 person-attribution tokens (`you`, `your`, `they`,
 *     `their`, `the user`, `the author`, `the poster`, `the participant`).
 *   - The SW-002-specific verdict tokens (`winning`, `losing`,
 *     `dominant`, `losing ground`, `gaining ground`, `proven`,
 *     `disproven`, `verdict`, `validated`, `correct`, `incorrect`,
 *     `right`, `wrong`, `true`, `false`).
 *   - LIFE-001 + META-001 verdict tokens are conceptually included; we
 *     enumerate the full doctrine list explicitly here so the helper
 *     stays self-contained (no value-import from LIFE-001 / META-001).
 *
 * `hot` is DELIBERATELY NOT in the returned list. SW-002 uses `hot` as
 * an activity descriptor per doctrine §2 (cdiscourse-doctrine §2 +
 * COPY-001 §5.1 + §8 carve-out). The ban-list test in
 * `__tests__/heatModel.test.ts` documents this carve-out inline.
 */
export function _forbiddenActivityTokens(): string[] {
  return [
    // Verdict tokens (LIFE-001 / META-001 / COPY-001 baseline).
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'astroturfer',
    'verdict',
    'proof',
    'proven',
    'disproven',
    'lost',
    'defeated',
    'won',
    'right',
    'wrong',
    'validated',
    // SW-002-specific verdict-adjacent tokens.
    'winning',
    'losing',
    'dominant',
    'losing ground',
    'gaining ground',
    // Amplification tokens.
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    'verified',
    'engagement',
    'amplification',
    'trending',
    'virality',
    'popular',
    'viral',
    // Person-attribution tokens (COPY-001).
    'you',
    'your',
    'they',
    'their',
    'the user',
    'the author',
    'the poster',
    'the participant',
    // Block / prevent tokens.
    'block',
    'prevent',
    'reject',
    'forbid',
    'disallow',
    'denied',
    // NOTE: `hot` is INTENTIONALLY ABSENT — doctrine §2 carve-out for
    // "hot = activity, never correctness" per COPY-001 §5.1 + §8. See
    // the ban-list test inline comment for the doctrine pin.
  ];
}

// ── Constants / window defaults ───────────────────────────────

const DEFAULT_RECENT_WINDOW_MS = 86_400_000; // 24 hours.
const DEFAULT_COMPARISON_WINDOW_MS = 259_200_000; // 72 hours.

// ── Internal helpers — threshold normalization ────────────────

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isNonNegativeFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function normalizeThresholds(
  overrides: Partial<ActivityThresholds> | undefined,
): ActivityThresholds {
  const t = DEFAULT_ACTIVITY_THRESHOLDS;
  const pick = (key: keyof ActivityThresholds): number => {
    const o = overrides?.[key];
    return isNonNegativeFinite(o) ? o : t[key];
  };
  let quietMax = pick('recentMovesQuietMax');
  let hotMin = pick('recentMovesHotMin');
  // Defensive swap when operator misconfigures `quietMax >= hotMin`.
  // We need quiet ≤ active ≤ hot to hold; coerce to defaults if swap
  // can't restore ordering (i.e. equal values).
  if (quietMax >= hotMin) {
    if (quietMax === hotMin) {
      quietMax = t.recentMovesQuietMax;
      hotMin = t.recentMovesHotMin;
    } else {
      const tmp = quietMax;
      quietMax = hotMin;
      hotMin = tmp;
    }
  }
  return {
    recentMovesQuietMax: quietMax,
    recentMovesHotMin: hotMin,
    activeBranchesProliferatingMin: pick('activeBranchesProliferatingMin'),
    momentumBuildingRatioMin: pick('momentumBuildingRatioMin'),
    momentumCoolingRatioMax: pick('momentumCoolingRatioMax'),
    maxSegments: Math.max(1, Math.floor(pick('maxSegments'))),
  };
}

function normalizeWindow(
  overrideMs: number | undefined,
  fallback: number,
): number {
  return isPositiveFinite(overrideMs) ? overrideMs : fallback;
}

function normalizeClockMs(clockMs: unknown): number {
  return typeof clockMs === 'number' && Number.isFinite(clockMs) ? clockMs : 0;
}

// ── Internal helpers — count derivation ───────────────────────

interface DerivedCounts {
  totalMoves: number;
  recentMoves: number;
  comparisonMoves: number;
  maxDepth: number;
  activeBranchesInRecentWindow: number;
  recentRootIsUnanswered: boolean;
}

function parseNodeMs(node: ArgumentTimelineMapNode): number {
  const ms = new Date(node.createdAt).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function deriveCounts(
  timelineMap: ArgumentTimelineMapModel | null,
  clockMs: number,
  recentWindowMs: number,
  comparisonWindowMs: number,
): DerivedCounts {
  const nodes = timelineMap?.nodes ?? [];
  if (nodes.length === 0) {
    return {
      totalMoves: 0,
      recentMoves: 0,
      comparisonMoves: 0,
      maxDepth: 0,
      activeBranchesInRecentWindow: 0,
      recentRootIsUnanswered: false,
    };
  }
  const recentLo = clockMs - recentWindowMs;
  const comparisonLo = recentLo - comparisonWindowMs;
  let recentMoves = 0;
  let comparisonMoves = 0;
  let maxDepth = 0;
  const recentBranches = new Set<string>();
  let rootUnanswered = false;
  for (const n of nodes) {
    const ms = parseNodeMs(n);
    if (!Number.isFinite(ms)) {
      // Bad timestamp — contributes to totalMoves only.
      if (n.depth > maxDepth) maxDepth = n.depth;
      continue;
    }
    if (n.depth > maxDepth) maxDepth = n.depth;
    if (ms >= recentLo && ms <= clockMs) {
      recentMoves += 1;
      if (n.kindLabel !== 'root') {
        recentBranches.add(n.branchId);
      }
    } else if (ms >= comparisonLo && ms < recentLo) {
      comparisonMoves += 1;
    }
  }
  // Identify root node + check if anyone has replied to it.
  for (const n of nodes) {
    if (n.isRoot) {
      rootUnanswered = n.replyCount === 0;
      break;
    }
  }
  return {
    totalMoves: nodes.length,
    recentMoves,
    comparisonMoves,
    maxDepth,
    activeBranchesInRecentWindow: recentBranches.size,
    recentRootIsUnanswered: rootUnanswered,
  };
}

// ── Internal helpers — lifecycle / metadata signal scans ──────

interface LifecycleSignals {
  clustersInSynthesisReady: number;
  clustersWithOpenSourceRequest: number;
}

function scanLifecycle(map: PointLifecycleMap | null): LifecycleSignals {
  let synthesis = 0;
  let openSource = 0;
  if (!map) return { clustersInSynthesisReady: synthesis, clustersWithOpenSourceRequest: openSource };
  for (const cluster of map.byCluster.values()) {
    const summary: PointLifecycleClusterSummary = cluster;
    const state: PointLifecycleState = summary.state;
    if (state === 'synthesis_ready') synthesis += 1;
    if (summary.hasOpenSourceOrQuoteRequest) openSource += 1;
  }
  return { clustersInSynthesisReady: synthesis, clustersWithOpenSourceRequest: openSource };
}

interface MetadataSignals {
  clustersWithRepeatedAxisPressure: number;
  clustersWithEvidenceDebt: number;
  clustersWithBranchTangent: number;
}

function scanMetadata(ledger: MoveMetadataLedger | null): MetadataSignals {
  let repeated = 0;
  let evidence = 0;
  let branchy = 0;
  if (!ledger) {
    return {
      clustersWithRepeatedAxisPressure: repeated,
      clustersWithEvidenceDebt: evidence,
      clustersWithBranchTangent: branchy,
    };
  }
  for (const cluster of ledger.byCluster.values()) {
    const summary: ClusterMetadataSummary = cluster;
    const autoCodes: ReadonlyArray<AutoMetadataCode> = summary.autoMetadataCodes;
    const manualCodes: ReadonlyArray<ManualTagCode> = summary.manualTagCodes;
    if (autoCodes.includes('repeated_axis_pressure')) repeated += 1;
    const hasPointStalled = autoCodes.includes('point_stalled');
    const hasManualEvidenceDebt = manualCodes.includes('evidence_debt');
    if (hasPointStalled || hasManualEvidenceDebt) evidence += 1;
    if (autoCodes.includes('branch_suggested') || autoCodes.includes('branch_created')) {
      branchy += 1;
    }
  }
  return {
    clustersWithRepeatedAxisPressure: repeated,
    clustersWithEvidenceDebt: evidence,
    clustersWithBranchTangent: branchy,
  };
}

// ── Internal helpers — band classifiers ───────────────────────

function classifyHeat(
  recentMoves: number,
  thresholds: ActivityThresholds,
): HeatLevel {
  if (recentMoves <= thresholds.recentMovesQuietMax) return 'quiet';
  if (recentMoves >= thresholds.recentMovesHotMin) return 'hot';
  return 'active';
}

function classifyMomentum(
  recentMoves: number,
  comparisonMoves: number,
  thresholds: ActivityThresholds,
): MomentumState {
  if (recentMoves === 0 && comparisonMoves === 0) return 'steady';
  if (comparisonMoves === 0) {
    // No earlier window data but recent moves exist → building.
    return recentMoves > 0 ? 'building' : 'steady';
  }
  const ratio = recentMoves / comparisonMoves;
  if (ratio >= thresholds.momentumBuildingRatioMin) return 'building';
  if (ratio <= thresholds.momentumCoolingRatioMax) return 'cooling';
  return 'steady';
}

function classifyTrend(
  signals: LifecycleSignals,
  counts: DerivedCounts,
  thresholds: ActivityThresholds,
): TrendDirection {
  if (signals.clustersInSynthesisReady >= 1) return 'narrowing_toward_synthesis';
  if (counts.activeBranchesInRecentWindow >= thresholds.activeBranchesProliferatingMin) {
    return 'branch_proliferating';
  }
  return 'unresolved_open';
}

// ── Internal helpers — chip composition ───────────────────────

function buildRoomChips(
  counts: DerivedCounts,
  lifecycle: LifecycleSignals,
  metadata: MetadataSignals,
  heat: HeatLevel,
): ActivityChip[] {
  const chips: ActivityChip[] = [];
  if (counts.recentMoves > 0) chips.push({ kind: 'recent_post' });
  if (lifecycle.clustersWithOpenSourceRequest > 0) {
    chips.push({ kind: 'open_source_request' });
  }
  if (metadata.clustersWithRepeatedAxisPressure > 0) {
    chips.push({ kind: 'repeated_axis_pressure' });
  }
  if (counts.recentRootIsUnanswered) chips.push({ kind: 'no_rebuttal' });
  if (lifecycle.clustersInSynthesisReady > 0) chips.push({ kind: 'synthesis_ready' });
  if (metadata.clustersWithBranchTangent > 0) chips.push({ kind: 'branch_tangent' });
  if (metadata.clustersWithEvidenceDebt > 0) chips.push({ kind: 'evidence_debt_open' });
  if (counts.totalMoves === 0 || (heat === 'quiet' && counts.recentMoves === 0)) {
    chips.push({ kind: 'cool_room_easy_entry' });
  }
  return chips;
}

function pickSegmentHelperLine(chips: ReadonlyArray<ActivityChip>): string {
  if (chips.length === 0) return ACTIVITY_HELPER_LINES.cool_room_easy_entry;
  // Longest helper-line wins; on tie, prefer the chip earliest in
  // `ALL_ACTIVITY_CHIP_KINDS` to stay deterministic.
  let bestLen = -1;
  let best: string = ACTIVITY_HELPER_LINES[chips[0].kind];
  let bestRank = Number.POSITIVE_INFINITY;
  for (const c of chips) {
    const line = ACTIVITY_HELPER_LINES[c.kind];
    const len = line.length;
    const rank = ALL_ACTIVITY_CHIP_KINDS.indexOf(c.kind);
    if (len > bestLen || (len === bestLen && rank < bestRank)) {
      bestLen = len;
      best = line;
      bestRank = rank;
    }
  }
  return best;
}

// ── Internal helpers — segmenter ──────────────────────────────

interface BandSpec {
  from: number;
  to: number;
}

function buildDepthBands(maxDepth: number, maxSegments: number): BandSpec[] {
  if (maxDepth <= 0) return [{ from: 0, to: 0 }];
  // Simple equal-width bands; the segmenter never authors copy.
  const segments = Math.min(maxSegments, maxDepth + 1);
  if (segments <= 1) return [{ from: 0, to: maxDepth }];
  const bands: BandSpec[] = [];
  const stride = Math.ceil((maxDepth + 1) / segments);
  let from = 0;
  while (from <= maxDepth) {
    const to = Math.min(from + stride - 1, maxDepth);
    bands.push({ from, to });
    from = to + 1;
  }
  return bands;
}

function nodesInBand(
  nodes: ReadonlyArray<ArgumentTimelineMapNode>,
  band: BandSpec,
): ArgumentTimelineMapNode[] {
  const out: ArgumentTimelineMapNode[] = [];
  for (const n of nodes) {
    if (n.depth >= band.from && n.depth <= band.to) out.push(n);
  }
  return out;
}

function buildSegments(
  timelineMap: ArgumentTimelineMapModel | null,
  lifecycleMap: PointLifecycleMap | null,
  metadataLedger: MoveMetadataLedger | null,
  counts: DerivedCounts,
  thresholds: ActivityThresholds,
  clockMs: number,
  recentWindowMs: number,
  comparisonWindowMs: number,
): ActivitySegment[] {
  const nodes = timelineMap?.nodes ?? [];
  if (nodes.length === 0) return [];
  const bands = buildDepthBands(counts.maxDepth, thresholds.maxSegments);
  const segments: ActivitySegment[] = [];
  // For per-band heat we only restrict timeline-derived counts. Lifecycle
  // and metadata signals operate on cluster scope, which is not depth-banded
  // at the model layer; we reuse the room-wide signals to keep the deriver
  // simple and deterministic.
  const lifecycleSignals = scanLifecycle(lifecycleMap);
  const metadataSignals = scanMetadata(metadataLedger);
  for (const band of bands) {
    const bandNodes = nodesInBand(nodes, band);
    if (bandNodes.length === 0) continue;
    let bandRecent = 0;
    let bandRootUnanswered = false;
    const recentLo = clockMs - recentWindowMs;
    for (const n of bandNodes) {
      const ms = parseNodeMs(n);
      if (Number.isFinite(ms) && ms >= recentLo && ms <= clockMs) bandRecent += 1;
      if (n.isRoot && n.replyCount === 0) bandRootUnanswered = true;
    }
    const bandCounts: DerivedCounts = {
      totalMoves: bandNodes.length,
      recentMoves: bandRecent,
      comparisonMoves: counts.comparisonMoves,
      maxDepth: band.to,
      activeBranchesInRecentWindow: counts.activeBranchesInRecentWindow,
      recentRootIsUnanswered: bandRootUnanswered,
    };
    const bandHeat = classifyHeat(bandRecent, thresholds);
    const chips = buildRoomChips(bandCounts, lifecycleSignals, metadataSignals, bandHeat);
    segments.push(
      Object.freeze({
        depthRange: Object.freeze({ from: band.from, to: band.to }),
        heatLevel: bandHeat,
        reasonChips: Object.freeze(chips.slice()),
        helperLine: pickSegmentHelperLine(chips),
      }),
    );
    // unused but referenced to satisfy strict noUnusedLocals semantics in
    // some configs; comparisonWindowMs is intentionally read by the room
    // path, not the segmenter.
    void comparisonWindowMs;
  }
  return segments;
}

// ── Internal helpers — entry opportunity ──────────────────────

function classifyEntryOpportunity(
  heat: HeatLevel,
  counts: DerivedCounts,
): EntryOpportunity | null {
  if (counts.totalMoves === 0) return 'easy_first_move';
  if (heat === 'quiet' && counts.recentRootIsUnanswered) return 'easy_first_move';
  if (heat === 'hot' && counts.maxDepth >= 4) return 'deep_existing_clash';
  if (counts.totalMoves > 0) return 'mid_thread_join';
  return 'easy_first_move';
}

// ── Cool-room default ────────────────────────────────────────

function coolRoomDefault(): RoomActivityProfile {
  return Object.freeze({
    heatLevel: 'quiet',
    momentumState: 'steady',
    trendDirection: 'unresolved_open',
    segments: Object.freeze([] as ActivitySegment[]),
    entryOpportunity: 'easy_first_move',
  });
}

// ── Public deriver ───────────────────────────────────────────

/**
 * SW-002 — The deriver. Pure, total, deterministic. Never throws. Never
 * returns `undefined`. Same input twice → deep-equal output.
 *
 * Order of resolution:
 *   1. Validate `clockMs` (finite number; non-finite → 0 fallback).
 *   2. Compute counts: `totalMoves`, `recentMoves`, `comparisonMoves`,
 *      `maxDepth`, `activeBranchesInRecentWindow`,
 *      `recentRootIsUnanswered`.
 *   3. Heat = compare(`recentMoves`, `recentMovesQuietMax`,
 *      `recentMovesHotMin`).
 *   4. Momentum = ratio(`recentMoves`, `comparisonMoves`).
 *   5. Trend = priority resolution: synthesis-ready ▶ branch-proliferating
 *      ▶ unresolved-open.
 *   6. Segments = depth-banded heat + chips per band.
 *   7. EntryOpportunity = quiet + root unanswered → `easy_first_move`;
 *      hot + deep → `deep_existing_clash`; otherwise mid-thread join.
 */
export function deriveRoomActivityProfile(input: HeatInputBundle): RoomActivityProfile {
  const clockMs = normalizeClockMs(input?.clockMs);
  const timelineMap = input?.timelineMap ?? null;
  const lifecycleMap = input?.lifecycleMap ?? null;
  const metadataLedger = input?.metadataLedger ?? null;
  const recentWindowMs = normalizeWindow(input?.recentWindowMs, DEFAULT_RECENT_WINDOW_MS);
  const comparisonWindowMs = normalizeWindow(
    input?.comparisonWindowMs,
    DEFAULT_COMPARISON_WINDOW_MS,
  );
  const thresholds = normalizeThresholds(input?.thresholds);

  if (!timelineMap || timelineMap.nodes.length === 0) {
    return coolRoomDefault();
  }

  const counts = deriveCounts(timelineMap, clockMs, recentWindowMs, comparisonWindowMs);
  const lifecycle = scanLifecycle(lifecycleMap);

  const heatLevel = classifyHeat(counts.recentMoves, thresholds);
  const momentumState = classifyMomentum(counts.recentMoves, counts.comparisonMoves, thresholds);
  const trendDirection = classifyTrend(lifecycle, counts, thresholds);
  const segments = buildSegments(
    timelineMap,
    lifecycleMap,
    metadataLedger,
    counts,
    thresholds,
    clockMs,
    recentWindowMs,
    comparisonWindowMs,
  );
  const entryOpportunity = classifyEntryOpportunity(heatLevel, counts);

  return Object.freeze({
    heatLevel,
    momentumState,
    trendDirection,
    segments: Object.freeze(segments),
    entryOpportunity,
  });
}

/**
 * SW-002 — Pure helper exposed for AN-003 diagnostics + tests. Returns
 * the activity chips that apply to the entire room (the same chips the
 * room-level helper-line composer would draw on).
 */
export function deriveRoomActivityChips(input: HeatInputBundle): ReadonlyArray<ActivityChip> {
  const clockMs = normalizeClockMs(input?.clockMs);
  const timelineMap = input?.timelineMap ?? null;
  const lifecycleMap = input?.lifecycleMap ?? null;
  const metadataLedger = input?.metadataLedger ?? null;
  const recentWindowMs = normalizeWindow(input?.recentWindowMs, DEFAULT_RECENT_WINDOW_MS);
  const comparisonWindowMs = normalizeWindow(
    input?.comparisonWindowMs,
    DEFAULT_COMPARISON_WINDOW_MS,
  );
  const thresholds = normalizeThresholds(input?.thresholds);

  if (!timelineMap || timelineMap.nodes.length === 0) {
    return Object.freeze([{ kind: 'cool_room_easy_entry' } as ActivityChip]);
  }

  const counts = deriveCounts(timelineMap, clockMs, recentWindowMs, comparisonWindowMs);
  const lifecycle = scanLifecycle(lifecycleMap);
  const metadata = scanMetadata(metadataLedger);
  const heat = classifyHeat(counts.recentMoves, thresholds);
  return Object.freeze(buildRoomChips(counts, lifecycle, metadata, heat));
}
