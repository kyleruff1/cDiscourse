/**
 * Stage 6.1.8 — Argument Stack + Timeline game surface (pure TypeScript).
 *
 * No React. No Supabase. No network. No AI. Pure model for the new
 * argument-room interaction surface:
 *
 *   - Latest message is active by default.
 *   - Stack Mode renders overlapping 3D-ish cards (latest on top).
 *   - Timeline Mode renders a horizontal scrubber with timestamped segments.
 *   - Swipe / arrow / button navigates previous/next in chronological order.
 *   - Bubble controls are actor-aware: own bubbles never expose edit /
 *     disagree / flag / score affordances; only request_deletion + view_qualifiers.
 *   - Display title falls back to root claim excerpt when debate.title is empty.
 *
 * No verdict tokens (winner, loser, truth, liar, dishonest, bad faith,
 * manipulative, extremist, propagandist) ever appear in this module.
 */

import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';
// VG-004 — density-aware inter-node spacing. `timelineNodeVisualModel`
// only imports *types* from this file (erased at compile time), so this
// is a one-directional runtime dependency, not a runtime import cycle.
import {
  resolveNodeGapPx,
  type TimelineDensityMode,
} from './timelineNodeVisualModel';
// IX-003 — shared node accessibility-label builder. `keyboardNavigationModel`
// imports only *types* from this file (erased at compile time), so this is
// a one-directional runtime dependency, not a runtime import cycle. Pass 4
// below calls `buildNodeAccessibilityLabel` so the model's stored label and
// the `NodeDot` rendered label never drift.
import {
  buildNodeAccessibilityLabel,
  deriveBranchLabel,
} from './keyboardNavigationModel';
// COMP-001 — type-only import of the cross-node mutation shape. The model
// stores mutations as opaque objects keyed by targetMoveId; the rendering
// layer is the consumer that maps the enum value to a visual treatment.
import type { NodeVisualMutation } from '../semanticReferee/compositionTypes';
// QOL-040.3 — type-only import of GalleryEntryHint. Required by the
// pure-TS deriver `deriveInitialActiveMessageId` so the React room
// consumer can read the same selection rule that the unit tests do.
// Type-only → erased at compile time → no runtime import cycle.
import type { GalleryEntryHint } from '../debates/conversationGalleryModel';

// ── Public types ───────────────────────────────────────────────

export type ArgumentSurfaceMode = 'stack' | 'timeline';

export type ArgumentBubbleActor = 'self' | 'other' | 'admin' | 'bot' | 'unknown';

export type ArgumentBubbleControl =
  | 'reply'
  | 'disagree'
  | 'flag'
  | 'ask_for_source'
  | 'ask_for_quote'
  | 'branch'
  | 'view_qualifiers'
  | 'request_deletion';

export interface ArgumentMessageInput {
  id: string;
  debateId: string;
  parentId: string | null;
  authorId: string | null;
  argumentType?: string | null;
  side?: string | null;
  body: string;
  status?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  isBot?: boolean | null;
  /**
   * Optional pre-derived qualifier badges (already-redacted plain strings).
   * The deriver (`messageQualifiers.derivePrimaryQualifier` etc.) feeds these
   * in; we just render them.
   */
  qualifierLabels?: string[];
  /** Optional point-standing / resting-status hint label. */
  pointStandingHint?: string | null;
  /**
   * EV-002 — Optional raw evidence attachments from
   * `arguments.client_validation.attachedEvidence`. The caller threads
   * `row.clientValidation.attachedEvidence` here so the room shell can
   * build `artifactsByMessageId` once per render via EV-001's
   * `buildEvidenceArtifacts`. Optional; all consumers default to `[]`.
   */
  attachedEvidence?: ReadonlyArray<{
    url?: string | null;
    label?: string | null;
    sourceText?: string | null;
    quote?: string | null;
  }> | null;
}

export interface ArgumentTimelineSegment {
  /** Stable id matching the underlying message id. */
  messageId: string;
  /** 1-based index in chronological order. */
  ordinal: number;
  /** Absolute ISO timestamp. */
  createdAt: string;
  /** Pre-formatted absolute timestamp. */
  createdAtLabel: string;
  /** Pre-formatted relative age, e.g. `8m ago`. */
  relativeLabel: string;
  /** Human-facing short label like "rebuttal" / "concession". */
  kindLabel: string;
  /** True when this segment is currently active. */
  isActive: boolean;
  /** Author actor relative to current viewer. */
  actor: ArgumentBubbleActor;
  /** Optional category/qualifier short labels rendered next to the marker. */
  badges: string[];
  /** Accessibility label, e.g. "Message 4 of 12, rebuttal, 2h ago". */
  accessibilityLabel: string;
}

export interface ArgumentBubbleViewModel {
  messageId: string;
  /** 1-based chronological index. */
  ordinal: number;
  /** Pre-formatted absolute timestamp. */
  createdAtLabel: string;
  /** Pre-formatted short relative age. */
  relativeLabel: string;
  /** Body text — already redacted upstream. */
  body: string;
  /** Short argument-type label. */
  kindLabel: string;
  /** Author actor relative to current viewer. */
  actor: ArgumentBubbleActor;
  /** Optional side label (Aff / Neg / Obs / Mod / —). */
  sideLabel: string;
  /** True when this is the latest message. */
  isLatest: boolean;
  /** True when this bubble is currently active (foregrounded). */
  isActive: boolean;
  /** Optional parent hint, e.g. "replied to: 'we should narrow scope…'". */
  parentHint: string | null;
  /** Optional qualifier badges (pre-derived). */
  qualifierBadges: string[];
  /** Optional point-standing/resting-status hint. */
  pointStandingHint: string | null;
  /** Controls allowed for the current actor. */
  allowedControls: ArgumentBubbleControl[];
  /** True if the user has already requested deletion of this bubble. */
  deletionRequested: boolean;
}

export interface ArgumentSurfaceState {
  mode: ArgumentSurfaceMode;
  activeMessageId: string | null;
  /** Cached chronological list of message ids. */
  chronologicalIds: string[];
  /**
   * COMP-001 — Cross-node visual mutations keyed by targetMoveId. Optional;
   * absent when no composition has run for the room (e.g., observer / read-
   * only mode). The rendering layer reads via `getCrossNodeMutations` to
   * fetch the per-node mutation list and translate enum values via the
   * existing `gameCopy.toPlainLanguage` pattern.
   */
  crossNodeMutations?: ReadonlyMap<string, readonly NodeVisualMutation[]>;
}

// ── Constants ──────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  thesis: 'thesis',
  claim: 'claim',
  rebuttal: 'rebuttal',
  counter_rebuttal: 'counter-rebuttal',
  evidence: 'evidence',
  clarification_request: 'clarification',
  concession: 'concession',
  synthesis: 'synthesis',
};

const SIDE_LABEL: Record<string, string> = {
  affirmative: 'Aff',
  negative: 'Neg',
  observer: 'Obs',
  moderator: 'Mod',
  neutral: '—',
};

/** Controls available for OTHER-user bubbles (the rich interaction set). */
const OTHER_USER_CONTROLS: ArgumentBubbleControl[] = [
  'reply',
  'disagree',
  'flag',
  'ask_for_source',
  'ask_for_quote',
  'branch',
  'view_qualifiers',
];

/** Controls available for the viewer's OWN bubbles (intentionally minimal). */
const SELF_CONTROLS: ArgumentBubbleControl[] = [
  'view_qualifiers',
  'request_deletion',
];

/** Bot / unknown / admin controls fall back to other-user except own self. */

/** Banned strings — never appear in display titles or hints. */
const FORBIDDEN_VERDICT_TOKENS: string[] = [
  'winner', 'loser', 'truth', 'liar', 'dishonest',
  'bad faith', 'manipulative', 'extremist', 'propagandist',
];

// ── Helpers ────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(1, max - 1)) + '…';
}

export function sortMessagesChronologically<T extends { id: string; createdAt: string }>(messages: T[]): T[] {
  const arr = messages.slice();
  arr.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    const va = Number.isNaN(ta) ? 0 : ta;
    const vb = Number.isNaN(tb) ? 0 : tb;
    if (va !== vb) return va - vb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return arr;
}

export function getLatestMessageId(messages: ArgumentMessageInput[]): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const sorted = sortMessagesChronologically(messages);
  return sorted[sorted.length - 1].id;
}

export function getPreviousMessageId(chronologicalIds: string[], currentId: string | null): string | null {
  if (!Array.isArray(chronologicalIds) || chronologicalIds.length === 0) return null;
  if (currentId === null) return chronologicalIds[chronologicalIds.length - 1] || null;
  const idx = chronologicalIds.indexOf(currentId);
  if (idx <= 0) return null;
  return chronologicalIds[idx - 1];
}

export function getNextMessageId(chronologicalIds: string[], currentId: string | null): string | null {
  if (!Array.isArray(chronologicalIds) || chronologicalIds.length === 0) return null;
  if (currentId === null) return chronologicalIds[0] || null;
  const idx = chronologicalIds.indexOf(currentId);
  if (idx < 0 || idx >= chronologicalIds.length - 1) return null;
  return chronologicalIds[idx + 1];
}

// ── QOL-040.3 — Deep-link node pre-activation deriver ────────

/**
 * QOL-040.3 — Pure-TS deriver for the room shell's `initialActiveId`.
 *
 * Mirrors the rule inside `ArgumentGameSurface.tsx`'s `initialActiveId`
 * useMemo so the rule can be unit-tested without a React-tree render.
 *
 * Priority (first match wins):
 *   1. `sorted.length === 0`                    → null
 *   2. `entryHint == null`                      → latestId
 *   3. `entryHint.entryHintForArgumentId`
 *      present AND in `sorted`                  → that id
 *      (QOL-040.3 — notification deep-link path)
 *   4. `entryHint.entryHintForArgumentId`
 *      present but absent from `sorted`         → fall through to step 5
 *      (soft-deleted / wrong-room / RLS-hidden)
 *   5. `entryHint.activate === 'root'`          → first message id
 *   6. `entryHint.activate === 'first_open_challenge'`
 *      → most recent message whose argumentType is rebuttal /
 *        counter_rebuttal / clarification_request, else latestId
 *   7. otherwise (`activate === 'latest'`)      → latestId
 *
 * Why the QOL-040.3 step honours the id only when it is in `sorted`:
 *   - The room-message loader (`useArgumentRoomMessages`) filters
 *     `status === 'posted'` at the SQL boundary. Soft-deleted rows
 *     never appear in `sorted`.
 *   - The same loader filters on `debate_id`. Wrong-room arguments
 *     never appear in `sorted`.
 *   - RLS at the row level hides arguments the caller cannot read.
 *   - One `sorted.find(...)` covers all three cases naturally; no
 *     duplicate visibility check is required.
 *
 * Pure: no Date, no Math.random, no I/O, no logging side effects. The
 * dev-mode `console.warn` for the fallback case lives in the React
 * consumer (`ArgumentGameSurface.tsx`); this helper is silent.
 */
export function deriveInitialActiveMessageId(
  sorted: ArgumentMessageInput[],
  latestId: string | null,
  entryHint: GalleryEntryHint | null | undefined,
): string | null {
  if (!Array.isArray(sorted) || sorted.length === 0) return null;
  if (!entryHint) return latestId;
  if (entryHint.entryHintForArgumentId) {
    const target = sorted.find((m) => m.id === entryHint.entryHintForArgumentId);
    if (target) return target.id;
    // Fall through to the existing `activate` policy.
  }
  if (entryHint.activate === 'root') return sorted[0].id;
  if (entryHint.activate === 'first_open_challenge') {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const t = String(sorted[i].argumentType || '').toLowerCase();
      if (t === 'rebuttal' || t === 'counter_rebuttal' || t === 'clarification_request') {
        return sorted[i].id;
      }
    }
    return latestId;
  }
  return latestId;
}

// ── End QOL-040.3 region ─────────────────────────────────────

export interface BubbleControlsContext {
  isCurrentUserAdmin?: boolean;
  /** True when this message already has an open deletion request from the viewer. */
  hasOpenDeletionRequest?: boolean;
  /** When true, suppress request_deletion entirely (e.g., feature disabled). */
  suppressDeletion?: boolean;
}

export function getBubbleControlsForActor(
  actor: ArgumentBubbleActor,
  ctx: BubbleControlsContext = {},
): ArgumentBubbleControl[] {
  if (actor === 'self') {
    if (ctx.suppressDeletion || ctx.hasOpenDeletionRequest) {
      return SELF_CONTROLS.filter((c) => c !== 'request_deletion');
    }
    return SELF_CONTROLS.slice();
  }
  return OTHER_USER_CONTROLS.slice();
}

export interface DisplayTitleInput {
  /** Optional debate title. Empty string / null / undefined → fallback. */
  debateTitle?: string | null;
  /** Root claim/thesis body if available. */
  rootBody?: string | null;
  /** Optional cap on the title length. Default 120 chars. */
  maxChars?: number;
}

export function getDisplayTitle(input: DisplayTitleInput = {}): string {
  const cap = typeof input.maxChars === 'number' && input.maxChars > 0 ? input.maxChars : 120;
  const explicit = (input.debateTitle || '').trim();
  if (explicit) {
    const safe = sanitizeForDisplay(explicit);
    return truncate(safe, cap);
  }
  const root = (input.rootBody || '').trim();
  if (root) return truncate(sanitizeForDisplay(root), cap);
  return 'Untitled argument';
}

/**
 * Strips verdict tokens defensively before rendering. We never want any
 * surface to label a person liar / propagandist / etc., even if upstream
 * text contained those words — the UI is not a place for those labels.
 */
function sanitizeForDisplay(s: string): string {
  let out = s;
  for (const token of FORBIDDEN_VERDICT_TOKENS) {
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '[redacted-term]');
  }
  return out;
}

// ── View-model builders ────────────────────────────────────────

export interface BuildBubbleViewModelsInput {
  messages: ArgumentMessageInput[];
  currentUserId: string | null;
  isAdmin?: boolean;
  activeMessageId?: string | null;
  /** Map of messageId → boolean for "deletion already requested by viewer". */
  deletionRequestedMap?: Record<string, boolean>;
  /** Cap on per-bubble parent hint length. Defaults to 100 chars. */
  parentHintMaxChars?: number;
  /** When supplied, used to label parent bubbles by id. */
  parentHintLookup?: (parentId: string) => string | null;
}

function classifyActor(msg: ArgumentMessageInput, currentUserId: string | null): ArgumentBubbleActor {
  if (msg.isBot === true) return 'bot';
  if (!msg.authorId) return 'unknown';
  if (currentUserId && msg.authorId === currentUserId) return 'self';
  return 'other';
}

export function buildArgumentBubbleViewModels(input: BuildBubbleViewModelsInput): ArgumentBubbleViewModel[] {
  const messages = sortMessagesChronologically(input.messages || []);
  const latestId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const activeId = input.activeMessageId || latestId;
  const parentMax = typeof input.parentHintMaxChars === 'number' && input.parentHintMaxChars > 0 ? input.parentHintMaxChars : 100;
  const lookup = input.parentHintLookup;
  const deletionMap = input.deletionRequestedMap || {};

  return messages.map((m, idx) => {
    const actor = classifyActor(m, input.currentUserId);
    const kindLabel = KIND_LABEL[String(m.argumentType || '').toLowerCase()] || 'message';
    const sideKey = String(m.side || '').toLowerCase();
    const sideLabel = SIDE_LABEL[sideKey] || '—';
    const parentBody = m.parentId && lookup ? lookup(m.parentId) : null;
    const parentHint = parentBody ? `replied to: "${truncate(sanitizeForDisplay(parentBody), parentMax)}"` : null;
    const hasOpenDeletionRequest = Boolean(deletionMap[m.id]);
    const allowedControls = getBubbleControlsForActor(actor, {
      isCurrentUserAdmin: Boolean(input.isAdmin),
      hasOpenDeletionRequest,
    });

    return {
      messageId: m.id,
      ordinal: idx + 1,
      createdAtLabel: formatDateTime(m.createdAt),
      relativeLabel: formatRelativeShort(m.createdAt),
      body: sanitizeForDisplay(String(m.body || '')),
      kindLabel,
      actor,
      sideLabel,
      isLatest: m.id === latestId,
      isActive: m.id === activeId,
      parentHint,
      qualifierBadges: Array.isArray(m.qualifierLabels) ? m.qualifierLabels.slice(0, 4) : [],
      pointStandingHint: m.pointStandingHint ? sanitizeForDisplay(String(m.pointStandingHint)) : null,
      allowedControls,
      deletionRequested: hasOpenDeletionRequest,
    };
  });
}

export interface BuildTimelineSegmentsInput {
  messages: ArgumentMessageInput[];
  currentUserId: string | null;
  activeMessageId?: string | null;
  /** Optional map of category labels per message id, e.g. from messageQualifiers. */
  categoryLabelById?: Record<string, string | null>;
  /** Optional map of qualifier badge label per message id. */
  qualifierLabelById?: Record<string, string | null>;
}

export function getTimelineSegments(input: BuildTimelineSegmentsInput): ArgumentTimelineSegment[] {
  const messages = sortMessagesChronologically(input.messages || []);
  const latestId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const activeId = input.activeMessageId || latestId;
  const total = messages.length;
  const catMap = input.categoryLabelById || {};
  const qualMap = input.qualifierLabelById || {};
  return messages.map((m, idx) => {
    const ordinal = idx + 1;
    const actor = classifyActor(m, input.currentUserId);
    const kindLabel = KIND_LABEL[String(m.argumentType || '').toLowerCase()] || 'message';
    const badges: string[] = [];
    if (catMap[m.id]) badges.push(String(catMap[m.id]));
    if (qualMap[m.id]) badges.push(String(qualMap[m.id]));
    const createdAtLabel = formatDateTime(m.createdAt);
    const relativeLabel = formatRelativeShort(m.createdAt);
    const accessibilityLabel = `Message ${ordinal} of ${total}, ${kindLabel}, ${relativeLabel || createdAtLabel}`;
    return {
      messageId: m.id,
      ordinal,
      createdAt: m.createdAt,
      createdAtLabel,
      relativeLabel,
      kindLabel,
      isActive: m.id === activeId,
      actor,
      badges,
      accessibilityLabel,
    };
  });
}

// ── Stack transform ───────────────────────────────────────────

export interface StackTransform {
  zIndex: number;
  scale: number;
  translateX: number;
  translateY: number;
  rotateDeg: number;
  opacity: number;
  /** True when this transform corresponds to the active card. */
  isActive: boolean;
}

/**
 * Compute the visual transform for a bubble at `index` within a chronologically
 * sorted list of `total` bubbles, given the currently active index.
 *
 * The active bubble sits at the front. Bubbles older than active fan out behind
 * (translate up + rotate slightly). Bubbles newer than active (rare — usually
 * latest IS active) drift slightly down. Only ~4 bubbles around the active one
 * stay visible; the rest are pushed back, scaled-down, and faded out.
 */
export function getStackTransformForIndex(index: number, activeIndex: number, total: number): StackTransform {
  const safeActive = Math.max(0, Math.min(activeIndex, Math.max(0, total - 1)));
  const distance = index - safeActive; // negative = older, positive = newer
  const absDist = Math.abs(distance);
  const isActive = distance === 0;

  // Z order: active bubble on top. Older bubbles next. Newer (rare) just behind.
  const zIndex = 1000 - absDist;

  if (isActive) {
    return { zIndex, scale: 1, translateX: 0, translateY: 0, rotateDeg: 0, opacity: 1, isActive: true };
  }

  // Tier 1 — within 3 bubbles → still visible.
  if (absDist <= 3) {
    // Older bubbles fan up and slightly to the left; newer bubbles drift down/right.
    const direction = distance < 0 ? -1 : 1;
    const scale = Math.max(0.78, 1 - absDist * 0.06);
    const translateY = direction * (-1) * Math.min(absDist * 14, 42); // older up, newer down
    const translateX = direction * Math.min(absDist * 6, 18);
    const rotateDeg = direction * Math.min(absDist * 1.5, 4.5);
    const opacity = Math.max(0.25, 1 - absDist * 0.22);
    return { zIndex, scale, translateX, translateY, rotateDeg, opacity, isActive: false };
  }

  // Tier 2 — far away. Heavily compressed but not gone.
  return {
    zIndex,
    scale: 0.62,
    translateX: distance < 0 ? -24 : 24,
    translateY: distance < 0 ? -60 : 60,
    rotateDeg: distance < 0 ? -6 : 6,
    opacity: 0.12,
    isActive: false,
  };
}

// ── Defaults ───────────────────────────────────────────────────

export function defaultSurfaceState(messages: ArgumentMessageInput[]): ArgumentSurfaceState {
  const sorted = sortMessagesChronologically(messages || []);
  const ids = sorted.map((m) => m.id);
  return {
    mode: 'stack',
    activeMessageId: ids.length > 0 ? ids[ids.length - 1] : null,
    chronologicalIds: ids,
  };
}

export function toggleSurfaceMode(mode: ArgumentSurfaceMode): ArgumentSurfaceMode {
  return mode === 'stack' ? 'timeline' : 'stack';
}

/**
 * COMP-001 — Lookup helper for cross-node mutations on a specific moveId.
 * Returns an empty array when the surface state has no `crossNodeMutations`
 * map (the common case in observer / read-only mode) or when the queried
 * moveId has no recorded mutations. The bubble-rendering code calls this
 * helper for each rendered node and renders chips / pills per the mutation's
 * enum value (translated via `gameCopy.toPlainLanguage` downstream).
 */
export function getCrossNodeMutations(
  state: ArgumentSurfaceState,
  moveId: string,
): readonly NodeVisualMutation[] {
  const map = state.crossNodeMutations;
  if (!map) {
    return [];
  }
  const list = map.get(moveId);
  return list ?? [];
}

// ── Exposed constants ─────────────────────────────────────────

export const ALL_BUBBLE_CONTROLS: ArgumentBubbleControl[] = [
  'reply',
  'disagree',
  'flag',
  'ask_for_source',
  'ask_for_quote',
  'branch',
  'view_qualifiers',
  'request_deletion',
];

export const STACK_VISIBLE_RADIUS = 3;

// ════════════════════════════════════════════════════════════════
// Stage 6.2 — Timeline Map Model (UX rescue pass)
// ════════════════════════════════════════════════════════════════
//
// Pure, deterministic shape for the graphical argument map.
//
//   - One node per posted message.
//   - Earliest at the left (x = small), latest at the right (x = large).
//   - Replies move above/below the rail by lane.
//   - Missing-parent children are marked `isDetached`, NEVER dropped.
//   - Junctions (parents with 2+ replies) get a stable junctionGroupId.
//   - The model carries enough fields to support a future branch/split
//     screen WITHOUT implementing it here.
//
// No React, no Supabase, no Date.now() — `nowMs` is injected when the
// caller wants relative-age labels to be deterministic. All visual
// constants (colors, lane spacing, node radius) are exported so the UI
// can reuse them in `<View>` segments.

export type TimelineKindColorFamily =
  | 'claim'
  | 'challenge'
  | 'evidence'
  | 'clarify'
  | 'concede'
  | 'flag'
  | 'default';

export type TimelineStandingBand =
  | 'pretty_wrong'
  | 'slightly_wrong'
  | 'neutral'
  | 'slightly_right'
  | 'maybe_right_misguided'
  | 'pretty_right'
  | 'completely_right'
  | 'unscored'
  | 'not_enough_signal';

export type TimelineToneBand = 'calm' | 'measured' | 'heated' | 'hostile' | 'unknown';
export type TimelineTemperatureBand = 'cool' | 'mild' | 'warm' | 'hot' | 'unknown';

export interface ArgumentTimelineMapNode {
  messageId: string;
  parentId: string | null;
  ordinal: number;
  createdAt: string;
  createdAtLabel: string;
  relativeLabel: string;
  actorLabel: string;
  kindLabel: string;
  sideLabel: string;
  bodyPreview: string;
  badges: string[];
  droppedTags: TimelineDroppedTag[];
  depth: number;
  lane: number;
  siblingIndex: number;
  replyCount: number;
  descendantCount: number;
  branchId: string;
  branchRootMessageId: string;
  junctionGroupId: string | null;
  isJunction: boolean;
  junctionChildCount: number;
  isActive: boolean;
  isLatest: boolean;
  isDetached: boolean;
  isActivePath: boolean;
  /** True for the chronological first message with no parent — the opening claim. */
  isRoot: boolean;
  /** True for the first reply to the root (chronologically). */
  isFirstRebuttal: boolean;
  standingBand: TimelineStandingBand;
  toneBand: TimelineToneBand;
  temperatureBand: TimelineTemperatureBand;
  kindColor: string;
  kindColorFamily: TimelineKindColorFamily;
  x: number;
  y: number;
  accessibilityLabel: string;
}

/**
 * Edge between two timeline nodes. Carries the geometry (`x1,y1,x2,y2`),
 * lane info, and a `gradientStops` array driving the rail's base color
 * blend.
 *
 * VG-002 — Gradient wave rail. The 6-stop blend in `gradientStops` is
 * Layer 0 of the rail's 5-layer visual; the rest of the rail's
 * rendering contract lives in `railSegmentModel.ts` (the
 * `RailSegmentInput` / `RailSegmentStyle` types and the
 * `deriveRailSegmentStyle` mapper). Do NOT remove `gradientStops` —
 * the rail's base layer reads it directly.
 */
export interface ArgumentTimelineMapEdge {
  edgeId: string;
  fromMessageId: string;
  toMessageId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fromLane: number;
  toLane: number;
  isActivePath: boolean;
  isDetached: boolean;
  /** True for the root → first-rebuttal edge. The "first clash". */
  isFirstClash: boolean;
  kindColor: string;
  standingColor: string;
  toneColor: string;
  gradientStops: string[];
}

export type TimelineBandLabel =
  | 'Opening'
  | 'First clash'
  | 'Evidence run'
  | 'Hot zone'
  | 'Current endgame';

export interface ArgumentTimelineMapBand {
  bandId: string;
  label: TimelineBandLabel;
  xStart: number;
  xEnd: number;
  messageCount: number;
}

export interface TimelineDroppedTag {
  code: string;
  label: string;
  color: string;
}

export interface TimelineParticipantTrend {
  participantId: string;
  participantLabel: string;
  messageCount: number;
  currentBand: TimelineStandingBand;
  previousBand: TimelineStandingBand;
  trendDirection: 'up' | 'down' | 'flat' | 'unknown';
  averageScore: number;
  averageTone: number;
  averageTemperature: number;
  sparkline: number[];
  lastMoveLabel: string;
  color: string;
}

export interface TimelineLegendEntry {
  family: TimelineKindColorFamily;
  label: string;
  color: string;
}

export interface ArgumentTimelineMapModel {
  nodes: ArgumentTimelineMapNode[];
  edges: ArgumentTimelineMapEdge[];
  bands: ArgumentTimelineMapBand[];
  activeNode: ArgumentTimelineMapNode | null;
  latestMessageId: string | null;
  activePathIds: string[];
  width: number;
  height: number;
  scrollWidth: number;
  beginningLabel: string;
  middleLabel: string;
  endLabel: string;
  participantTrends: TimelineParticipantTrend[];
  legend: TimelineLegendEntry[];
  /** Chronological first message with no parent. Null only for empty timelines. */
  rootMessageId: string | null;
  /** First reply to the root, if any. */
  firstRebuttalMessageId: string | null;
  /** True when the root has at least one reply. */
  hasRebuttal: boolean;
  /**
   * One-line onboarding hint chosen from the timeline's state. Designed
   * for normal-user surfaces — no internal codes, no verdict tokens.
   *   - Root active + no rebuttal yet → "Be the first rebuttal."
   *   - Root active + at least one rebuttal → "This is the opening claim."
   *   - No rebuttal yet but other messages exist (detached only) → "Be the first rebuttal."
   *   - Otherwise → null.
   */
  rootOnboardingHint: string | null;
  /** When true, the UI should expose a "Back to root" control. */
  showBackToRootControl: boolean;
}

// ── Layout constants (exported so UI can match) ────────────────

export const TIMELINE_NODE_SIZE = 44; // matches a11y min touch target
/**
 * Default inter-node horizontal gap in px.
 *
 * VG-004 (operator Q1, option b): the board's default density was
 * deliberately loosened from the historical 28 to 44. This constant is
 * the `'normal'` density value and is kept consistent with
 * `resolveNodeGapPx(undefined) === 44`. `buildArgumentTimelineMap` no
 * longer reads this constant directly — it calls `resolveNodeGapPx`
 * with the optional `density` input — but the export is preserved for
 * any consumer that wants the default spacing value.
 */
export const TIMELINE_NODE_GAP = 44;
export const TIMELINE_LANE_HEIGHT = 56;
export const TIMELINE_RAIL_Y = 120; // center rail vertical position
export const TIMELINE_MAX_LANES = 6; // root + 3 above + 3 below by depth
export const TIMELINE_LEFT_PAD = 28;
export const TIMELINE_RIGHT_PAD = 28;
export const TIMELINE_TOP_PAD = 14;
export const TIMELINE_BOTTOM_PAD = 60;

// ── Kind → color family + color ────────────────────────────────

const KIND_COLOR_FAMILY: Record<string, TimelineKindColorFamily> = {
  claim: 'claim',
  thesis: 'claim',
  rebuttal: 'challenge',
  counter_rebuttal: 'challenge',
  disagree: 'challenge',
  evidence: 'evidence',
  source: 'evidence',
  clarification_request: 'clarify',
  question: 'clarify',
  concession: 'concede',
  synthesis: 'concede',
  narrow: 'concede',
  flag: 'flag',
  delete: 'flag',
};

export const TIMELINE_KIND_COLORS: Record<TimelineKindColorFamily, string> = {
  claim: '#6366f1',       // indigo
  challenge: '#f97316',   // orange/red
  evidence: '#06b6d4',    // cyan/green
  clarify: '#f59e0b',     // amber
  concede: '#a855f7',     // purple
  flag: '#ef4444',        // red/slate
  default: '#475569',     // slate
};

const STANDING_BAND_COLOR: Record<TimelineStandingBand, string> = {
  pretty_wrong: '#b91c1c',
  slightly_wrong: '#f97316',
  neutral: '#64748b',
  slightly_right: '#22d3ee',
  maybe_right_misguided: '#facc15',
  pretty_right: '#34d399',
  completely_right: '#10b981',
  unscored: '#475569',
  not_enough_signal: '#374151',
};

const TONE_BAND_COLOR: Record<TimelineToneBand, string> = {
  calm: '#22d3ee',
  measured: '#818cf8',
  heated: '#f97316',
  hostile: '#dc2626',
  unknown: '#475569',
};

// ── Helpers ────────────────────────────────────────────────────

function getKindFamily(kind: string | null | undefined): TimelineKindColorFamily {
  const k = String(kind || '').toLowerCase();
  return KIND_COLOR_FAMILY[k] || 'default';
}

function pickKindColor(kind: string | null | undefined): string {
  return TIMELINE_KIND_COLORS[getKindFamily(kind)];
}

function pickSideLabel(side: string | null | undefined): string {
  const key = String(side || '').toLowerCase();
  return SIDE_LABEL[key] || '—';
}

function pickKindLabel(kind: string | null | undefined): string {
  return KIND_LABEL[String(kind || '').toLowerCase()] || 'message';
}

function pickActorLabel(actor: ArgumentBubbleActor): string {
  switch (actor) {
    case 'self': return 'You';
    case 'other': return 'Opponent';
    case 'bot': return 'Bot';
    case 'admin': return 'Admin';
    default: return 'Unknown';
  }
}

function shortBodyPreview(body: string, cap = 96): string {
  return truncate(sanitizeForDisplay(String(body || '')), cap);
}

// ── Lane assignment ────────────────────────────────────────────

/**
 * Deterministic lane assignment.
 *
 * Roots stay on lane 0 (center rail).
 * For each non-root message, lane is derived from its parent's lane +
 * (siblingIndex parity). Even siblings go above (-1), odd go below (+1),
 * then the offset grows by depth so deep chains stay visually distinct.
 * Lanes are clamped to ±TIMELINE_MAX_LANES / 2.
 */
function computeLane(depth: number, siblingIndex: number, parentLane: number): number {
  if (depth <= 0) return 0;
  const maxLane = Math.floor(TIMELINE_MAX_LANES / 2);
  // Stage 6.3: prefer parent-lane continuity to avoid diagonal scatter.
  // - The FIRST child of a parent stays on the parent's lane (continues
  //   the chain on the same horizontal line).
  // - Additional siblings branch off: even index → above, odd → below.
  // - Branch magnitude grows ONLY when an additional sibling lands on
  //   top of an existing chain, keeping the timeline horizontal except
  //   for genuine branching.
  if (siblingIndex === 0) {
    if (parentLane > maxLane) return maxLane;
    if (parentLane < -maxLane) return -maxLane;
    return parentLane;
  }
  const direction = siblingIndex % 2 === 1 ? -1 : 1;
  const offset = Math.ceil(siblingIndex / 2);
  const lane = parentLane + direction * Math.min(offset, maxLane);
  if (lane > maxLane) return maxLane;
  if (lane < -maxLane) return -maxLane;
  return lane;
}

// ── Dropped tags (qualifiers / categories) ─────────────────────

const TAG_LABEL_MAP: Record<string, { label: string; color: string }> = {
  fact_disagreement: { label: 'Fact', color: '#f97316' },
  definition_disagreement: { label: 'Definition', color: '#f59e0b' },
  causal_disagreement: { label: 'Causal', color: '#a855f7' },
  value_disagreement: { label: 'Value', color: '#ec4899' },
  evidence_challenge: { label: 'Evidence', color: '#06b6d4' },
  logic_challenge: { label: 'Logic', color: '#818cf8' },
  scope_challenge: { label: 'Scope', color: '#10b981' },
  source_request: { label: 'Source?', color: '#0ea5e9' },
  quote_request: { label: 'Quote?', color: '#0d9488' },
  concession_marker: { label: 'Concede', color: '#a855f7' },
  evidence: { label: 'Evidence', color: '#06b6d4' },
};

function mapDroppedTags(tagCodes: string[] | undefined | null): TimelineDroppedTag[] {
  if (!Array.isArray(tagCodes)) return [];
  const out: TimelineDroppedTag[] = [];
  for (const code of tagCodes) {
    if (!code) continue;
    const norm = String(code).toLowerCase();
    const known = TAG_LABEL_MAP[norm];
    if (known) {
      out.push({ code: norm, label: known.label, color: known.color });
    } else {
      out.push({ code: norm, label: norm.slice(0, 12), color: '#475569' });
    }
  }
  return out;
}

// ── Standing / tone / temperature inference ───────────────────

/**
 * Deterministic band inference from whatever signals are available.
 * NEVER throws; missing fields → neutral/unknown.
 *
 * Inputs the caller can pass:
 *   - flagCodes: array of strings present on this message
 *   - hasEvidence: whether the message has attached evidence
 *   - bodyLength: raw body length for proxy of effort
 *   - topicScore: 0..1 lexical topic score if known
 *   - tagCodes: qualifier/category codes
 */
export interface StandingInferenceInput {
  flagCodes?: string[];
  hasEvidence?: boolean;
  bodyLength?: number;
  topicScore?: number | null;
  tagCodes?: string[];
  argumentType?: string | null;
}

export function inferStandingBand(input: StandingInferenceInput): TimelineStandingBand {
  const flags = (input.flagCodes || []).map((c) => String(c).toLowerCase());
  const tagCodes = (input.tagCodes || []).map((c) => String(c).toLowerCase());
  const adHominem = flags.includes('ad_hominem');
  const civility = flags.includes('civility_risk');
  const offTopic = flags.includes('off_topic');
  const weakTopic = flags.includes('weak_topic');
  const nonresponsive = flags.includes('parent_nonresponsive') || flags.includes('tangent_shift');
  const concessionEvasion = flags.includes('concession_evasion');
  const loaded = flags.includes('loaded_clarification');
  const duplicate = flags.includes('duplicate');
  const evidenceRequired = flags.includes('evidence_required');

  const argType = String(input.argumentType || '').toLowerCase();
  const isEvidence = argType === 'evidence';
  const hasEvidence = Boolean(input.hasEvidence);
  const concessionType = argType === 'concession' || argType === 'synthesis';
  const positive = (isEvidence && hasEvidence) || concessionType
    || tagCodes.includes('concession_marker') || tagCodes.includes('source_request');
  const negativeHard = adHominem || offTopic || evidenceRequired;
  const negativeSoft = weakTopic || nonresponsive || loaded || duplicate || concessionEvasion;
  const heated = adHominem || civility;

  if (negativeHard && !positive) return 'pretty_wrong';
  // Positive substance + heated tone → "right but misguided" before falling
  // into the broader negativeHard bucket. Ad-hominem alongside good evidence
  // is the canonical example.
  if (heated && positive) return 'maybe_right_misguided';
  if (negativeHard) return 'slightly_wrong';
  if (positive && hasEvidence && !negativeSoft) return 'pretty_right';
  if (positive && !negativeSoft) return 'slightly_right';
  if (positive && negativeSoft) return 'maybe_right_misguided';
  if (negativeSoft) return 'slightly_wrong';
  if (!flags.length && !positive) return 'not_enough_signal';
  return 'neutral';
}

export function inferToneBand(flagCodes: string[] | undefined | null): TimelineToneBand {
  const f = (flagCodes || []).map((c) => String(c).toLowerCase());
  if (f.includes('ad_hominem')) return 'hostile';
  if (f.includes('civility_risk')) return 'heated';
  if (f.includes('loaded_clarification')) return 'heated';
  if (f.length === 0) return 'unknown';
  return 'calm';
}

export function inferTemperatureBand(flagCodes: string[] | undefined | null, bodyLength?: number): TimelineTemperatureBand {
  const f = (flagCodes || []).map((c) => String(c).toLowerCase());
  if (f.includes('ad_hominem')) return 'hot';
  if (f.includes('civility_risk')) return 'warm';
  if (typeof bodyLength === 'number' && bodyLength > 1500) return 'warm';
  if (f.length === 0) return 'unknown';
  return 'mild';
}

// ── Map input ──────────────────────────────────────────────────

export interface ArgumentTimelineMapMessageInput extends ArgumentMessageInput {
  /** Optional per-message flag codes (from argument_flags). */
  flagCodes?: string[];
  /** Optional per-message tag codes (from argument_tags). */
  tagCodes?: string[];
  /** Optional topic_satisfaction_check score in [0..1]. */
  topicScore?: number | null;
  /** Optional flag for "has attached evidence". */
  hasEvidence?: boolean;
  /** Optional pre-computed standing band override. */
  standingBandOverride?: TimelineStandingBand;
}

export interface BuildTimelineMapInput {
  messages: ArgumentMessageInput[] | ArgumentTimelineMapMessageInput[];
  currentUserId: string | null;
  activeMessageId?: string | null;
  /** When omitted, uses internal layout constants. */
  width?: number;
  /** When omitted, the height is computed from lane count. */
  height?: number;
  /** Optional bot-id classification. */
  isAdmin?: boolean;
  /**
   * VG-004 — Optional density preset for inter-node spacing. When
   * omitted, `resolveNodeGapPx` resolves to `'normal'` (44px).
   */
  density?: TimelineDensityMode;
}

// ── Band detection (deterministic) ─────────────────────────────

function detectBands(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapBand[] {
  if (nodes.length === 0) return [];
  const bands: ArgumentTimelineMapBand[] = [];

  // Opening: first 1-3 nodes.
  const openingCount = Math.min(3, nodes.length);
  bands.push({
    bandId: 'band-opening',
    label: 'Opening',
    xStart: nodes[0].x,
    xEnd: nodes[openingCount - 1].x,
    messageCount: openingCount,
  });
  if (nodes.length <= 3) return bands;

  // First clash: first rebuttal/challenge node after opening.
  const firstClashIdx = nodes.findIndex(
    (n, i) => i >= openingCount && n.kindColorFamily === 'challenge',
  );
  if (firstClashIdx >= 0) {
    // Span from first clash up to next 2-4 nodes.
    const end = Math.min(firstClashIdx + 3, nodes.length - 1);
    bands.push({
      bandId: 'band-first-clash',
      label: 'First clash',
      xStart: nodes[firstClashIdx].x,
      xEnd: nodes[end].x,
      messageCount: end - firstClashIdx + 1,
    });
  }

  // Evidence run: any contiguous 2+ evidence-family nodes.
  let runStart = -1;
  let evidenceRunPushed = false;
  for (let i = 0; i < nodes.length && !evidenceRunPushed; i++) {
    if (nodes[i].kindColorFamily === 'evidence') {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      const len = i - runStart;
      if (len >= 2) {
        bands.push({
          bandId: `band-evidence-${runStart}`,
          label: 'Evidence run',
          xStart: nodes[runStart].x,
          xEnd: nodes[i - 1].x,
          messageCount: len,
        });
        evidenceRunPushed = true;
        break;
      }
      runStart = -1;
    }
  }
  // Trailing run that reaches the end of the timeline.
  if (!evidenceRunPushed && runStart >= 0 && nodes.length - runStart >= 2) {
    bands.push({
      bandId: `band-evidence-${runStart}`,
      label: 'Evidence run',
      xStart: nodes[runStart].x,
      xEnd: nodes[nodes.length - 1].x,
      messageCount: nodes.length - runStart,
    });
  }

  // Hot zone: any 2+ contiguous nodes with heated/hostile tone OR pretty_wrong/slightly_wrong standing.
  let heatStart = -1;
  for (let i = 0; i < nodes.length; i++) {
    const heated = nodes[i].toneBand === 'heated' || nodes[i].toneBand === 'hostile';
    const wrong = nodes[i].standingBand === 'pretty_wrong' || nodes[i].standingBand === 'slightly_wrong';
    if (heated || wrong) {
      if (heatStart < 0) heatStart = i;
    } else if (heatStart >= 0) {
      const len = i - heatStart;
      if (len >= 2) {
        bands.push({
          bandId: `band-hot-${heatStart}`,
          label: 'Hot zone',
          xStart: nodes[heatStart].x,
          xEnd: nodes[i - 1].x,
          messageCount: len,
        });
      }
      heatStart = -1;
    }
  }

  // Current endgame: last 1-3 nodes (only if conversation is long enough).
  if (nodes.length >= 6) {
    const endStart = Math.max(0, nodes.length - 3);
    bands.push({
      bandId: 'band-current',
      label: 'Current endgame',
      xStart: nodes[endStart].x,
      xEnd: nodes[nodes.length - 1].x,
      messageCount: nodes.length - endStart,
    });
  }

  return bands;
}

// ── Participant trend (deterministic, no AI) ──────────────────

function bandToScore(band: TimelineStandingBand): number {
  switch (band) {
    case 'pretty_wrong': return -1;
    case 'slightly_wrong': return -0.5;
    case 'maybe_right_misguided': return 0.25;
    case 'slightly_right': return 0.5;
    case 'pretty_right': return 0.85;
    case 'completely_right': return 1;
    case 'neutral': return 0;
    case 'unscored':
    case 'not_enough_signal':
    default: return 0;
  }
}

function scoreToBand(score: number): TimelineStandingBand {
  if (score <= -0.75) return 'pretty_wrong';
  if (score <= -0.25) return 'slightly_wrong';
  if (score < 0.25) return 'neutral';
  if (score < 0.45) return 'slightly_right';
  if (score < 0.7) return 'maybe_right_misguided';
  if (score < 0.92) return 'pretty_right';
  return 'completely_right';
}

function toneNumeric(band: TimelineToneBand): number {
  switch (band) {
    case 'calm': return 0;
    case 'measured': return 0.25;
    case 'heated': return 0.7;
    case 'hostile': return 1;
    default: return 0;
  }
}

function temperatureNumeric(band: TimelineTemperatureBand): number {
  switch (band) {
    case 'cool': return 0;
    case 'mild': return 0.25;
    case 'warm': return 0.7;
    case 'hot': return 1;
    default: return 0;
  }
}

function buildParticipantTrends(nodes: ArgumentTimelineMapNode[], rawById: Map<string, { authorId: string | null; actor: ArgumentBubbleActor }>): TimelineParticipantTrend[] {
  const buckets = new Map<string, {
    label: string;
    color: string;
    scores: number[];
    tones: number[];
    temps: number[];
    lastKind: string;
  }>();
  for (const node of nodes) {
    const raw = rawById.get(node.messageId);
    if (!raw) continue;
    const pid = raw.authorId || `actor-${raw.actor}`;
    const label = node.actorLabel;
    const color = pickKindColor(null);
    if (!buckets.has(pid)) {
      buckets.set(pid, { label, color, scores: [], tones: [], temps: [], lastKind: node.kindLabel });
    }
    const b = buckets.get(pid)!;
    b.scores.push(bandToScore(node.standingBand));
    b.tones.push(toneNumeric(node.toneBand));
    b.temps.push(temperatureNumeric(node.temperatureBand));
    b.lastKind = node.kindLabel;
  }
  const out: TimelineParticipantTrend[] = [];
  for (const [pid, b] of buckets.entries()) {
    const messageCount = b.scores.length;
    const averageScore = messageCount > 0 ? b.scores.reduce((s, v) => s + v, 0) / messageCount : 0;
    const averageTone = messageCount > 0 ? b.tones.reduce((s, v) => s + v, 0) / messageCount : 0;
    const averageTemp = messageCount > 0 ? b.temps.reduce((s, v) => s + v, 0) / messageCount : 0;
    const currentBand = messageCount > 0 ? scoreToBand(b.scores[b.scores.length - 1]) : 'unscored';
    const previousBand = messageCount > 1 ? scoreToBand(b.scores[b.scores.length - 2]) : 'unscored';
    let trendDirection: TimelineParticipantTrend['trendDirection'] = 'unknown';
    if (messageCount >= 2) {
      const cur = b.scores[b.scores.length - 1];
      const prev = b.scores[b.scores.length - 2];
      if (cur > prev + 0.1) trendDirection = 'up';
      else if (cur < prev - 0.1) trendDirection = 'down';
      else trendDirection = 'flat';
    }
    out.push({
      participantId: pid,
      participantLabel: b.label,
      messageCount,
      currentBand,
      previousBand,
      trendDirection,
      averageScore: Math.round(averageScore * 100) / 100,
      averageTone: Math.round(averageTone * 100) / 100,
      averageTemperature: Math.round(averageTemp * 100) / 100,
      sparkline: b.scores.slice(-12),
      lastMoveLabel: b.lastKind,
      color: b.color,
    });
  }
  // Stable ordering by participant id.
  out.sort((a, b) => a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0);
  return out;
}

// ── Active path walker ────────────────────────────────────────

function buildActivePathIds(activeId: string | null, nodeById: Map<string, ArgumentTimelineMapNode>): string[] {
  const out: string[] = [];
  let cur: string | null = activeId;
  const seen = new Set<string>();
  while (cur && nodeById.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    out.unshift(cur);
    const node = nodeById.get(cur)!;
    cur = node.parentId;
  }
  return out;
}

// ── Main builder ──────────────────────────────────────────────

export function buildArgumentTimelineMap(input: BuildTimelineMapInput): ArgumentTimelineMapModel {
  const sorted = sortMessagesChronologically(input.messages || []);
  const total = sorted.length;
  const latestId = total > 0 ? sorted[total - 1].id : null;
  const activeId = input.activeMessageId || latestId;

  if (total === 0) {
    return {
      nodes: [], edges: [], bands: [],
      activeNode: null, latestMessageId: null, activePathIds: [],
      width: 0, height: 0, scrollWidth: 0,
      beginningLabel: '', middleLabel: '', endLabel: '',
      participantTrends: [], legend: buildLegend(),
      rootMessageId: null,
      firstRebuttalMessageId: null,
      hasRebuttal: false,
      rootOnboardingHint: null,
      showBackToRootControl: false,
    };
  }

  // Pass 1 — build base nodes with x positions + actor classification.
  const idIndex = new Map<string, number>();
  sorted.forEach((m, i) => idIndex.set(m.id, i));

  const rawById = new Map<string, { authorId: string | null; actor: ArgumentBubbleActor }>();

  // Child count map for junction detection.
  const childCountById = new Map<string, number>();
  for (const m of sorted) {
    if (m.parentId) childCountById.set(m.parentId, (childCountById.get(m.parentId) || 0) + 1);
  }

  // Sibling-index map: for each child, what was its position among its parent's children in chronological order.
  const siblingIndexById = new Map<string, number>();
  {
    const seenCount = new Map<string, number>();
    for (const m of sorted) {
      if (m.parentId) {
        const cur = seenCount.get(m.parentId) || 0;
        siblingIndexById.set(m.id, cur);
        seenCount.set(m.parentId, cur + 1);
      } else {
        siblingIndexById.set(m.id, 0);
      }
    }
  }

  // First pass: layout + node creation.
  // VG-004 — density-aware horizontal step. `resolveNodeGapPx(undefined)`
  // returns the `'normal'` default (44px). Changing `density` reflows
  // every node's `x` but never changes node ids or ordinal order, so
  // the active node (identified by id) is preserved.
  const xStep = TIMELINE_NODE_SIZE + resolveNodeGapPx(input.density);
  const nodes: ArgumentTimelineMapNode[] = [];
  const nodeById = new Map<string, ArgumentTimelineMapNode>();
  const laneById = new Map<string, number>();
  // Track which lane,xStep cell is used — used to nudge collision.
  const occupied = new Map<string, true>();

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i] as ArgumentTimelineMapMessageInput;
    const actor = classifyActor(m, input.currentUserId);
    rawById.set(m.id, { authorId: m.authorId, actor });

    const parentId = m.parentId || null;
    const isDetached = Boolean(parentId && !idIndex.has(parentId));
    const parentLane = parentId && laneById.has(parentId) ? laneById.get(parentId)! : 0;
    // Depth derived from cumulative reply chain length.
    let depth = 0;
    if (parentId && nodeById.has(parentId)) depth = nodeById.get(parentId)!.depth + 1;
    else if (isDetached) depth = 1;
    const siblingIndex = siblingIndexById.get(m.id) || 0;
    let lane = computeLane(depth, siblingIndex, parentLane);
    if (isDetached) {
      // Detached messages go to a lower detached lane; nudge if collisions.
      lane = Math.max(2, Math.min(3, depth + 1));
    }
    laneById.set(m.id, lane);

    // X position is monotonic by chronological ordinal. Tie-break by id is
    // already handled by sortMessagesChronologically.
    const x = TIMELINE_LEFT_PAD + i * xStep;
    let y = TIMELINE_RAIL_Y + lane * TIMELINE_LANE_HEIGHT;

    // Collision nudge: if the previous node sits at the same (x bucket, y),
    // push this one down a half-lane (deterministic).
    const cell = `${i}::${y}`;
    if (occupied.has(cell)) {
      y += Math.floor(TIMELINE_LANE_HEIGHT / 2);
    }
    occupied.set(cell, true);

    const kindLabel = pickKindLabel(m.argumentType);
    const kindColorFamily = getKindFamily(m.argumentType);
    const kindColor = TIMELINE_KIND_COLORS[kindColorFamily];

    const tagCodes = Array.isArray((m as ArgumentTimelineMapMessageInput).tagCodes)
      ? (m as ArgumentTimelineMapMessageInput).tagCodes
      : (Array.isArray(m.qualifierLabels) ? m.qualifierLabels : []);
    const droppedTags = mapDroppedTags(tagCodes);
    const flagCodes = (m as ArgumentTimelineMapMessageInput).flagCodes || [];
    const standingOverride = (m as ArgumentTimelineMapMessageInput).standingBandOverride;
    const standingBand: TimelineStandingBand = standingOverride || inferStandingBand({
      flagCodes,
      hasEvidence: (m as ArgumentTimelineMapMessageInput).hasEvidence,
      bodyLength: (m.body || '').length,
      topicScore: (m as ArgumentTimelineMapMessageInput).topicScore ?? null,
      tagCodes: tagCodes as string[],
      argumentType: m.argumentType ?? null,
    });
    const toneBand = inferToneBand(flagCodes);
    const temperatureBand = inferTemperatureBand(flagCodes, (m.body || '').length);

    const node: ArgumentTimelineMapNode = {
      messageId: m.id,
      parentId,
      ordinal: i + 1,
      createdAt: m.createdAt,
      createdAtLabel: formatDateTime(m.createdAt),
      relativeLabel: formatRelativeShort(m.createdAt),
      actorLabel: pickActorLabel(actor),
      kindLabel,
      sideLabel: pickSideLabel(m.side),
      bodyPreview: shortBodyPreview(m.body || ''),
      badges: Array.isArray(m.qualifierLabels) ? m.qualifierLabels.slice(0, 3).map(String) : [],
      droppedTags,
      depth,
      lane,
      siblingIndex,
      replyCount: childCountById.get(m.id) || 0,
      descendantCount: 0, // filled in second pass below
      branchId: parentId ? `branch-${m.id}` : `branch-root-${m.id}`,
      branchRootMessageId: m.id, // refined below
      junctionGroupId: null,
      isJunction: false,
      junctionChildCount: 0,
      isActive: m.id === activeId,
      isLatest: m.id === latestId,
      isDetached,
      isActivePath: false,
      // Filled below once root/first-rebuttal are identified.
      isRoot: false,
      isFirstRebuttal: false,
      standingBand,
      toneBand,
      temperatureBand,
      kindColor,
      kindColorFamily,
      x,
      y,
      accessibilityLabel: '', // filled below once we have all flags
    };
    nodes.push(node);
    nodeById.set(m.id, node);
  }

  // Pass 2 — branch roots, descendant counts, junction detection.
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.parentId && nodeById.has(node.parentId)) {
      const parent = nodeById.get(node.parentId)!;
      parent.descendantCount += 1 + node.descendantCount;
      // Branch root: child inherits parent's branch root unless parent has multiple children (then this child starts a new branch).
      if ((childCountById.get(parent.messageId) || 0) > 1) {
        node.branchRootMessageId = node.messageId;
        node.branchId = `branch-${node.messageId}`;
      } else {
        node.branchRootMessageId = parent.branchRootMessageId;
        node.branchId = parent.branchId;
      }
    }
  }
  for (const node of nodes) {
    if (node.replyCount >= 2) {
      node.isJunction = true;
      node.junctionChildCount = node.replyCount;
      node.junctionGroupId = `junction-${node.messageId}`;
    }
  }

  // Pass 3 — active path.
  const activePathIds = buildActivePathIds(activeId, nodeById);
  const activeSet = new Set(activePathIds);
  for (const node of nodes) {
    node.isActivePath = activeSet.has(node.messageId);
  }

  // Pass 4 — identify root and first rebuttal (chronological).
  // Root = first chronological node with no parent (or whose parent is missing).
  // First rebuttal = first chronological child of the root.
  let rootMessageId: string | null = null;
  for (const node of nodes) {
    if (!node.parentId || !nodeById.has(node.parentId)) {
      rootMessageId = node.messageId;
      node.isRoot = true;
      break;
    }
  }
  let firstRebuttalMessageId: string | null = null;
  if (rootMessageId) {
    for (const node of nodes) {
      if (node.parentId === rootMessageId) {
        firstRebuttalMessageId = node.messageId;
        node.isFirstRebuttal = true;
        break;
      }
    }
  }

  // Pass 4c — accessibility labels (now that every flag, including
  // `isRoot`, is stable). IX-003: built via the shared
  // `buildNodeAccessibilityLabel` helper so the model's stored label and
  // the `NodeDot` rendered label never drift. The label exposes type,
  // side, ordinal, STRENGTH band (plain language) and BRANCH
  // (mainline / side / detached) plus active / latest / junction state.
  for (const node of nodes) {
    node.accessibilityLabel = buildNodeAccessibilityLabel({
      ordinal: node.ordinal,
      totalNodes: total,
      kindLabel: node.kindLabel,
      sideLabel: node.sideLabel,
      standingBand: node.standingBand,
      branchLabel: deriveBranchLabel({ lane: node.lane, isDetached: node.isDetached }),
      isActive: node.isActive,
      isLatest: node.isLatest,
      isRoot: node.isRoot,
      isDetached: node.isDetached,
      isJunction: node.isJunction,
      junctionChildCount: node.junctionChildCount,
      relativeOrAbsoluteTime: node.relativeLabel || node.createdAtLabel,
    });
  }

  // Pass 5 — edges.
  const edges: ArgumentTimelineMapEdge[] = [];
  for (const node of nodes) {
    if (!node.parentId) continue;
    if (!nodeById.has(node.parentId)) continue; // detached: no edge
    const parent = nodeById.get(node.parentId)!;
    const isActivePath = activeSet.has(node.messageId) && activeSet.has(parent.messageId);
    const standingColor = STANDING_BAND_COLOR[node.standingBand] || '#475569';
    const toneColor = TONE_BAND_COLOR[node.toneBand] || '#475569';
    const gradientStops = [
      parent.kindColor,
      mixHex(parent.kindColor, node.kindColor, 0.5),
      node.kindColor,
      standingColor,
      toneColor,
    ];
    const isFirstClash =
      rootMessageId !== null &&
      firstRebuttalMessageId !== null &&
      parent.messageId === rootMessageId &&
      node.messageId === firstRebuttalMessageId;
    edges.push({
      edgeId: `edge-${parent.messageId}-${node.messageId}`,
      fromMessageId: parent.messageId,
      toMessageId: node.messageId,
      x1: parent.x,
      y1: parent.y,
      x2: node.x,
      y2: node.y,
      fromLane: parent.lane,
      toLane: node.lane,
      isActivePath,
      isDetached: false,
      isFirstClash,
      kindColor: node.kindColor,
      standingColor,
      toneColor,
      gradientStops,
    });
  }

  // Pass 6 — bands.
  const bands = detectBands(nodes);

  // Layout dimensions.
  const scrollWidth = TIMELINE_LEFT_PAD + total * xStep + TIMELINE_RIGHT_PAD;
  const width = input.width ?? scrollWidth;
  const minLane = nodes.reduce((m, n) => Math.min(m, n.lane), 0);
  const maxLane = nodes.reduce((m, n) => Math.max(m, n.lane), 0);
  const laneSpan = Math.max(1, maxLane - minLane + 1);
  const height = input.height ?? (TIMELINE_TOP_PAD + laneSpan * TIMELINE_LANE_HEIGHT + TIMELINE_BOTTOM_PAD + TIMELINE_NODE_SIZE);

  // Bookend labels.
  const beginningLabel = nodes[0].createdAtLabel;
  const endLabel = nodes[nodes.length - 1].createdAtLabel;
  const middleLabel = nodes[Math.floor(nodes.length / 2)].createdAtLabel;

  // Participant trends.
  const participantTrends = buildParticipantTrends(nodes, rawById);

  // Root onboarding hint + back-to-root control.
  const hasRebuttal = firstRebuttalMessageId !== null;
  const activeIsRoot = activeId !== null && activeId === rootMessageId;
  let rootOnboardingHint: string | null = null;
  if (rootMessageId !== null && !hasRebuttal) {
    // No rebuttal anywhere — surface the prompt to invite the first one.
    rootOnboardingHint = TL_ROOT_HINT_BE_FIRST_REBUTTAL;
  } else if (activeIsRoot) {
    // User is focused on root; tell them what root is.
    rootOnboardingHint = TL_ROOT_HINT_OPENING_CLAIM;
  }
  const showBackToRootControl =
    rootMessageId !== null &&
    activeId !== rootMessageId &&
    total >= BACK_TO_ROOT_MIN_MESSAGES;

  return {
    nodes,
    edges,
    bands,
    activeNode: activeId ? nodeById.get(activeId) || null : null,
    latestMessageId: latestId,
    activePathIds,
    width,
    height,
    scrollWidth,
    beginningLabel,
    middleLabel,
    endLabel,
    participantTrends,
    legend: buildLegend(),
    rootMessageId,
    firstRebuttalMessageId,
    hasRebuttal,
    rootOnboardingHint,
    showBackToRootControl,
  };
}

/** Plain-language onboarding strings for the timeline root. */
export const TL_ROOT_HINT_OPENING_CLAIM = 'This is the opening claim.';
export const TL_ROOT_HINT_BE_FIRST_REBUTTAL = 'Be the first rebuttal.';
/** Threshold above which the UI surfaces a Back-to-root control. */
export const BACK_TO_ROOT_MIN_MESSAGES = 5;

function buildLegend(): TimelineLegendEntry[] {
  return [
    { family: 'claim', label: 'Claim / Reply', color: TIMELINE_KIND_COLORS.claim },
    { family: 'challenge', label: 'Challenge', color: TIMELINE_KIND_COLORS.challenge },
    { family: 'evidence', label: 'Evidence', color: TIMELINE_KIND_COLORS.evidence },
    { family: 'clarify', label: 'Clarify', color: TIMELINE_KIND_COLORS.clarify },
    { family: 'concede', label: 'Concede / Synth', color: TIMELINE_KIND_COLORS.concede },
    { family: 'flag', label: 'Flag', color: TIMELINE_KIND_COLORS.flag },
  ];
}

/** Mix two hex colors at a given t in [0,1]. Returns "#rrggbb". Pure. */
export function mixHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * Math.max(0, Math.min(1, t)));
  const r = lerp(ar, br);
  const g = lerp(ag, bg);
  const bl = lerp(ab, bb);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

// ── Navigation by node id within map (for Prev/Next/Latest) ───

export function timelineMapPrevId(map: ArgumentTimelineMapModel, currentId: string | null): string | null {
  if (!map.nodes.length) return null;
  if (!currentId) return map.nodes[map.nodes.length - 1].messageId;
  const idx = map.nodes.findIndex((n) => n.messageId === currentId);
  if (idx <= 0) return null;
  return map.nodes[idx - 1].messageId;
}

export function timelineMapNextId(map: ArgumentTimelineMapModel, currentId: string | null): string | null {
  if (!map.nodes.length) return null;
  if (!currentId) return map.nodes[0].messageId;
  const idx = map.nodes.findIndex((n) => n.messageId === currentId);
  if (idx < 0 || idx >= map.nodes.length - 1) return null;
  return map.nodes[idx + 1].messageId;
}
