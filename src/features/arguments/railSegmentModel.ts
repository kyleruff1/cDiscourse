/**
 * VG-002 — Gradient wave rail segment model.
 *
 * Pure-TS model. No React. No Supabase. No network. No async.
 *
 * The rail surface answers one question: "what shape is this
 * conversation taking?" It NEVER tells the user a claim is correct,
 * true, winning, supported, validated, or anchored-to-truth. Color
 * warmth describes activity, not consensus. Saturated track describes
 * trail quality, not claim quality. These distinctions are doctrine
 * anchors enforced by the test suite (ban-list + doctrine anchors).
 *
 * The module derives `RailSegmentStyle` from a `RailSegmentInput`
 * deterministically. The `branchKind` field is the seam BR-001 will
 * later own; today VG-002 ships `derivePlaceholderBranchKind` and
 * the renderer + dispatch table are frozen so BR-001 only swaps the
 * placeholder helper.
 */

import {
  mixHex,
  TIMELINE_NODE_SIZE,
  type ArgumentTimelineMapEdge,
  type ArgumentTimelineMapNode,
  type TimelineToneBand,
  type TimelineTemperatureBand,
} from './argumentGameSurfaceModel';
import {
  summarizeArtifactsForReceiptChip,
  type EvidenceArtifact,
  type SourceChainStatus,
} from '../evidence/evidenceModel';

// ── Public types ─────────────────────────────────────────────────

/**
 * The kind of segment to render. BR-001 will own deterministic
 * population once branch detection lands. Today VG-002 derives it
 * from a placeholder (see `derivePlaceholderBranchKind`). The enum
 * and the renderer's dispatch table are frozen so BR-001 only swaps
 * the placeholder helper — no renderer changes required.
 */
export type RailBranchKind =
  | 'main'
  | 'tangent'
  | 'kink_start'
  | 'kink_end'
  | 'detached';

/** Frozen array of every branch kind. Exported for tests / docs. */
export const ALL_RAIL_BRANCH_KINDS: ReadonlyArray<RailBranchKind> = Object.freeze([
  'main',
  'tangent',
  'kink_start',
  'kink_end',
  'detached',
]);

export interface RailSegmentInput {
  /** Stable id for memoization. Mirrors `edge.edgeId`. */
  segmentId: string;
  /** Endpoint message ids. */
  fromMessageId: string;
  toMessageId: string;
  /** From-node x/y in scroll-coord pixels. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 6-stop color array passed to the base layer. */
  gradientStops: ReadonlyArray<string>;
  /** Tone band (drives the tone-wash hue). */
  toneBand: TimelineToneBand;
  /** Temperature band (drives the tone-wash alpha). */
  temperatureBand: TimelineTemperatureBand;
  /** Worst-status SourceChainStatus across both endpoints. */
  sourceChainStatus: SourceChainStatus;
  /** Branch kind — placeholder today, BR-001 owns later. */
  branchKind: RailBranchKind;
  /** True when this edge lies on the active path. Drives the glow layer. */
  isActivePath: boolean;
  /** True for the root→first-rebuttal edge. Drives the thicker rail. */
  isFirstClash: boolean;
}

export interface RailSegmentStyleWrapper {
  left: number;
  top: number;
  width: number;
  height: number;
  transformRotateZDeg: number;
  opacity: number;
  /** When true, render an angled-stub at the parent end of the strip. */
  showKinkStartStub: boolean;
  /** When true, render an angled-stub at the child end of the strip. */
  showKinkEndStub: boolean;
}

export type RailEvidenceTrackLayer =
  | null
  | { mode: 'solid'; color: string; alpha: number }
  | { mode: 'dotted_pattern'; color: string; alphaPattern: ReadonlyArray<number> };

export type RailGlowLayer =
  | null
  | {
      color: string;
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };

export interface RailSegmentStyle {
  wrapper: RailSegmentStyleWrapper;
  /** Color hex per sub-strip in the base band (always 6 entries). */
  baseSubStripColors: ReadonlyArray<string>;
  /** Tone wash overlay; alpha 0 means "no overlay". */
  toneWash: { color: string; alpha: number };
  /** Evidence-track overlay — null means "no overlay" (base reads through). */
  evidenceTrack: RailEvidenceTrackLayer;
  /** Glow layer; null means "not glowing". Always null when !isActivePath. */
  glow: RailGlowLayer;
  /** Plain-language a11y description fragment for this segment. Used to
   *  build the rail's whole-rail accessibilityLabel. Never contains
   *  verdict / truth / amplification tokens. */
  accessibilityFragment: string;
  /** True when the segment should NOT render any visual at all
   *  (detached branch). */
  isHidden: boolean;
}

// ── Constants ────────────────────────────────────────────────────

/** The teal hex EV-002's `RECEIPT_CHIP_RING_COLOR` already exports. Kept
 *  here so the pure-TS model never pulls a React component just to read a
 *  hex string. A test asserts the two values stay in sync. */
export const RAIL_SOURCE_CHAIN_TEAL: '#0f766e' = '#0f766e';

/** Active-path glow color. Indigo-300 — matches the existing
 *  `nodeRingActive` color in `ArgumentTimelineMap`. */
export const RAIL_ACTIVE_PATH_GLOW: '#a5b4fc' = '#a5b4fc';

/** Base rail thickness. Mirrors the existing constant in
 *  `ArgumentTimelineMap`. Exported here so the model can compute the
 *  wrapper height without importing the component. */
export const RAIL_THICKNESS_PX = 4;
export const FIRST_CLASH_RAIL_THICKNESS_PX = 6;
export const EDGE_SEGMENTS = 6;

/** Default buffer for `visibleSegmentSlice` — one viewport width on
 *  each side. */
export const VISIBLE_SLICE_DEFAULT_BUFFER_PX = 800;

/** Hostile / heated tones push hue toward warm; calm / measured tones
 *  stay close to the base. Color is *activity*, never *correctness*. */
const TONE_BAND_HEX: Record<TimelineToneBand, string> = {
  calm: '#22c55e',
  measured: '#3b82f6',
  heated: '#f97316',
  hostile: '#ef4444',
  unknown: '#94a3b8',
};

/** Tone-wash alpha lookup. The single continuous overlay axis. */
const TEMPERATURE_ALPHA: Record<TimelineTemperatureBand, number> = {
  cool: 0,
  mild: 0.1,
  warm: 0.25,
  hot: 0.45,
  unknown: 0.05,
};

/** Dotted pattern for the broken-trail track. Six sub-strips along the
 *  length, alternating opacity. Doctrine: non-accusatory. */
const BROKEN_DOTTED_PATTERN: ReadonlyArray<number> = Object.freeze([1, 0.3, 1, 0.3, 1, 0.3]);

/** Extra rotation for the visual kink of a tangent strip. */
const TANGENT_KINK_DEG = 6;
const TANGENT_OPACITY = 0.6;
/** Dim applied to non-active edges. Mirrors today's `EdgeStrip`. */
const NON_ACTIVE_OPACITY = 0.55;

// ── Pure helpers ─────────────────────────────────────────────────

/**
 * Compute the 6 sub-strip colors for the base band layer. Mirrors the
 * existing `EdgeStrip` math so the visual blend is unchanged.
 */
function deriveBaseSubStripColors(stops: ReadonlyArray<string>): ReadonlyArray<string> {
  if (stops.length === 0) {
    return Object.freeze(['#475569', '#475569', '#475569', '#475569', '#475569', '#475569']);
  }
  if (stops.length === 1) {
    return Object.freeze(new Array(EDGE_SEGMENTS).fill(stops[0]));
  }
  const out: string[] = new Array(EDGE_SEGMENTS);
  for (let i = 0; i < EDGE_SEGMENTS; i += 1) {
    const t = i / Math.max(1, EDGE_SEGMENTS - 1);
    const idx = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
    const localT = t * (stops.length - 1) - idx;
    out[i] = mixHex(stops[idx], stops[idx + 1], localT);
  }
  return Object.freeze(out);
}

/**
 * Build the tone-wash overlay. Hue comes from `toneBand`, alpha from
 * `temperatureBand`. Color is *activity*, never *correctness*.
 */
function deriveToneWash(
  toneBand: TimelineToneBand,
  temperatureBand: TimelineTemperatureBand,
): { color: string; alpha: number } {
  const color = TONE_BAND_HEX[toneBand] ?? TONE_BAND_HEX.unknown;
  const alpha = TEMPERATURE_ALPHA[temperatureBand] ?? TEMPERATURE_ALPHA.unknown;
  return { color, alpha };
}

/**
 * Build the evidence-track overlay. Describes the *trail*, never the
 * *truth*.
 *
 *   - `no_source` / `unverified` → no overlay (base reads through)
 *   - `source_no_quote` → half-saturated teal
 *   - `source_and_quote` → full saturated teal
 *   - `primary_present` → full saturated teal (strongest trail)
 *   - `broken` → dotted pattern (weak trail; non-accusatory)
 */
function deriveEvidenceTrack(status: SourceChainStatus): RailEvidenceTrackLayer {
  switch (status) {
    case 'no_source':
    case 'unverified':
      return null;
    case 'source_no_quote':
      return { mode: 'solid', color: RAIL_SOURCE_CHAIN_TEAL, alpha: 0.5 };
    case 'source_and_quote':
    case 'primary_present':
      return { mode: 'solid', color: RAIL_SOURCE_CHAIN_TEAL, alpha: 1.0 };
    case 'broken':
      return {
        mode: 'dotted_pattern',
        color: RAIL_SOURCE_CHAIN_TEAL,
        alphaPattern: BROKEN_DOTTED_PATTERN,
      };
    default:
      return null;
  }
}

/** Build the glow layer. Always null unless the edge is on the active path. */
function deriveGlow(isActivePath: boolean): RailGlowLayer {
  if (!isActivePath) return null;
  return {
    color: RAIL_ACTIVE_PATH_GLOW,
    shadowOpacity: 0.65,
    shadowRadius: 6,
    elevation: 6,
  };
}

/**
 * Plain-English fragment describing this segment. Used to assemble the
 * whole-rail accessibilityLabel. NEVER contains verdict, truth, or
 * amplification tokens. The phrasing mirrors EV-002's chip copy:
 *   - "source attached" — saturated trail
 *   - "primary source attached" — strongest trail
 *   - "weak source trail" — broken/unverified
 *   - "needs a source" — no_source
 *   - "active branch" — when on the active path
 *   - "tangent off mainline" — branchKind tangent
 *   - "detached branch" — branchKind detached (rare; usually hidden)
 */
function deriveAccessibilityFragment(input: RailSegmentInput): string {
  if (input.branchKind === 'detached') return 'detached branch';

  const trail = ((): string => {
    switch (input.sourceChainStatus) {
      case 'primary_present':
        return 'primary source attached';
      case 'source_and_quote':
        return 'source attached';
      case 'source_no_quote':
        return 'partial source trail';
      case 'broken':
        return 'weak source trail';
      case 'unverified':
        return 'source not yet inspected';
      case 'no_source':
      default:
        return 'needs a source';
    }
  })();

  const branchPart = ((): string => {
    switch (input.branchKind) {
      case 'tangent':
        return 'tangent off mainline';
      case 'kink_start':
        return 'branch starts here';
      case 'kink_end':
        return 'branch joins here';
      case 'main':
      default:
        return 'branch';
    }
  })();

  const activity = input.isActivePath ? 'active ' : '';
  return `${activity}${branchPart}, ${trail}`;
}

/**
 * Derive the wrapper geometry: position, rotation, opacity, and the
 * kink-stub flags. Pure.
 */
function deriveWrapper(input: RailSegmentInput): RailSegmentStyleWrapper {
  const dx = input.x2 - input.x1;
  const dy = input.y2 - input.y1;
  const length = Math.max(2, Math.sqrt(dx * dx + dy * dy));
  const baseAngle = Math.atan2(dy, dx) * (180 / Math.PI);

  const thickness = input.isFirstClash ? FIRST_CLASH_RAIL_THICKNESS_PX : RAIL_THICKNESS_PX;

  const tangentExtra = input.branchKind === 'tangent' ? TANGENT_KINK_DEG : 0;
  const opacity = ((): number => {
    if (input.branchKind === 'detached') return 0;
    if (input.branchKind === 'tangent') return TANGENT_OPACITY;
    if (input.isActivePath) return 1.0;
    return NON_ACTIVE_OPACITY;
  })();

  return {
    left: input.x1 + TIMELINE_NODE_SIZE / 2,
    top: input.y1 + TIMELINE_NODE_SIZE / 2 - thickness / 2,
    width: length,
    height: thickness,
    transformRotateZDeg: baseAngle + tangentExtra,
    opacity,
    showKinkStartStub: input.branchKind === 'kink_start',
    showKinkEndStub: input.branchKind === 'kink_end',
  };
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Derive the full `RailSegmentStyle` for one input. Pure. Same input
 * always produces a deep-equal output. The renderer is expected to cache
 * the result keyed by `segmentId` across renders to avoid recompute.
 */
export function deriveRailSegmentStyle(input: RailSegmentInput): RailSegmentStyle {
  const isHidden = input.branchKind === 'detached';
  const wrapper = deriveWrapper(input);
  const baseSubStripColors = deriveBaseSubStripColors(input.gradientStops);
  const toneWash = deriveToneWash(input.toneBand, input.temperatureBand);
  const evidenceTrack = isHidden ? null : deriveEvidenceTrack(input.sourceChainStatus);
  const glow = isHidden ? null : deriveGlow(input.isActivePath);
  const accessibilityFragment = deriveAccessibilityFragment(input);
  return {
    wrapper,
    baseSubStripColors,
    toneWash,
    evidenceTrack,
    glow,
    accessibilityFragment,
    isHidden,
  };
}

/**
 * BR-001 seam. Placeholder kink-derivation BR-001 will replace.
 *
 *   - `isDetached === true` AND (`fromNode.kindColorFamily === 'flag'`
 *      OR the from-node's droppedTags include a tangent code
 *      `branch_this_off` or `tangent_or_joke`)
 *      → `'tangent'` (visually kinked off mainline; non-accusatory)
 *   - `isDetached === true` (and the above tangent rule didn't fire)
 *      → `'detached'` (parent not loaded; strip not rendered)
 *   - Otherwise → `'main'`.
 *
 * The placeholder NEVER emits `'kink_start'` / `'kink_end'`. BR-001
 * introduces those when explicit kink objects are modeled.
 *
 * Pure. No side effects. No I/O.
 */
export function derivePlaceholderBranchKind(args: {
  fromNode: ArgumentTimelineMapNode;
  toNode: ArgumentTimelineMapNode;
  isDetached: boolean;
}): RailBranchKind {
  const { fromNode, toNode, isDetached } = args;

  const tangentCodes = ((): boolean => {
    const fromCodes = fromNode.droppedTags.map((t) => t.code);
    const toCodes = toNode.droppedTags.map((t) => t.code);
    return (
      fromCodes.includes('branch_this_off') ||
      fromCodes.includes('tangent_or_joke') ||
      toCodes.includes('branch_this_off') ||
      toCodes.includes('tangent_or_joke')
    );
  })();

  // Tangent rule: detached + flag/tangent signal. The "detached + flag"
  // half is conservative — both conditions must hold so a tangent on
  // the mainline (e.g. a flagged-but-still-anchored move) is NOT
  // mis-categorized as a tangent kink.
  if (
    isDetached &&
    (fromNode.kindColorFamily === 'flag' || tangentCodes)
  ) {
    return 'tangent';
  }

  if (isDetached) return 'detached';

  return 'main';
}

/**
 * Build a `RailSegmentInput` from an existing edge + node lookup + the
 * EV-001 artifact map. Pure. The worst-status `SourceChainStatus` is
 * computed via EV-001's `summarizeArtifactsForReceiptChip` over the
 * union of both endpoints' artifacts (the worst-case across the edge
 * dictates the rail's evidence-track appearance — never re-derived).
 */
export function buildRailSegmentInput(args: {
  edge: ArgumentTimelineMapEdge;
  fromNode: ArgumentTimelineMapNode;
  toNode: ArgumentTimelineMapNode;
  artifactsByMessageId: Record<string, ReadonlyArray<EvidenceArtifact>>;
}): RailSegmentInput {
  const { edge, fromNode, toNode, artifactsByMessageId } = args;

  const fromArtifacts = artifactsByMessageId[edge.fromMessageId] ?? [];
  const toArtifacts = artifactsByMessageId[edge.toMessageId] ?? [];
  const combined: ReadonlyArray<EvidenceArtifact> = [
    ...fromArtifacts,
    ...toArtifacts,
  ];
  const chip = summarizeArtifactsForReceiptChip(combined);
  const sourceChainStatus = chip.status;

  const branchKind = derivePlaceholderBranchKind({
    fromNode,
    toNode,
    isDetached: edge.isDetached,
  });

  return {
    segmentId: edge.edgeId,
    fromMessageId: edge.fromMessageId,
    toMessageId: edge.toMessageId,
    x1: edge.x1,
    y1: edge.y1,
    x2: edge.x2,
    y2: edge.y2,
    gradientStops: edge.gradientStops,
    toneBand: toNode.toneBand,
    temperatureBand: toNode.temperatureBand,
    sourceChainStatus,
    branchKind,
    isActivePath: edge.isActivePath,
    isFirstClash: edge.isFirstClash,
  };
}

/**
 * Returns the slice of segments whose x-range intersects the visible
 * viewport plus a buffer. Used to virtualize the rail so peak rendered
 * `<View>` count is bounded by viewport width, NOT by message count.
 *
 * `bufferPx` defaults to one viewport width on each side, so a 250-
 * message rail at 800px viewport returns ≤ ~50 segments at any time.
 */
export function visibleSegmentSlice(
  segments: ReadonlyArray<RailSegmentInput>,
  scrollX: number,
  viewportWidth: number,
  bufferPx?: number,
): RailSegmentInput[] {
  const buffer = typeof bufferPx === 'number' && bufferPx >= 0 ? bufferPx : VISIBLE_SLICE_DEFAULT_BUFFER_PX;
  const windowMin = scrollX - buffer;
  const windowMax = scrollX + viewportWidth + buffer;
  const out: RailSegmentInput[] = [];
  for (const s of segments) {
    const segMin = Math.min(s.x1, s.x2);
    const segMax = Math.max(s.x1, s.x2);
    if (segMax >= windowMin && segMin <= windowMax) {
      out.push(s);
    }
  }
  return out;
}

/**
 * Build the rail's whole-rail `accessibilityLabel`. Plain English. No
 * snake_case codes. No verdict / amplification tokens. The label is the
 * primary a11y entry point for the rail surface — per-segment a11y is
 * delegated to the node Pressables + EV-002's chip + popover.
 *
 *   "Trail: {N} messages, {M} active branches, source attached on {K},
 *    {L} branches need a source."
 *
 * Empty rail yields "Trail: 0 messages." Plural / singular boundaries
 * handled per English (0 / 1 / 2+).
 */
export function buildWholeRailAccessibilityLabel(args: {
  nodeCount: number;
  activeBranchCount: number;
  segmentsWithSourceAttached: number;
  segmentsNeedingSource: number;
}): string {
  const { nodeCount, activeBranchCount, segmentsWithSourceAttached, segmentsNeedingSource } = args;
  if (nodeCount <= 0) return 'Trail: 0 messages.';

  const messages = nodeCount === 1 ? '1 message' : `${nodeCount} messages`;
  const branches = activeBranchCount === 1 ? '1 active branch' : `${activeBranchCount} active branches`;

  const parts: string[] = [`Trail: ${messages}`, branches];
  parts.push(`source attached on ${segmentsWithSourceAttached}`);
  if (segmentsNeedingSource > 0) {
    const needs =
      segmentsNeedingSource === 1
        ? '1 branch needs a source'
        : `${segmentsNeedingSource} branches need a source`;
    parts.push(needs);
  }
  return `${parts.join(', ')}.`;
}
