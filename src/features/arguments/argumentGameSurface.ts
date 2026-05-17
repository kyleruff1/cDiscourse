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
