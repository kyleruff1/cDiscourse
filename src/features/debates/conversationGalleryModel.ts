/**
 * Stage 6.3 — Conversation Gallery pure model.
 *
 * Replaces the row-per-debate list with one card per conversation/thread
 * family. The model is pure TS (no React, no Supabase), so it can be unit
 * tested deterministically.
 *
 * NEVER:
 *  - calls xAI / Anthropic / X
 *  - mutates Supabase
 *  - deletes duplicate debates
 *  - exposes raw X identifiers
 *
 * Duplicates are VISUALLY collapsed (`canonicalConversationKey`); the
 * underlying rows are untouched and remain individually accessible via
 * `duplicateDebateIds`.
 */
import type { Debate, ParticipantSide } from './types';

// ── Shared input shapes ────────────────────────────────────────

/**
 * Lightweight argument-row projection from the Stage 6.2 full-room loader.
 * The gallery model deliberately accepts a narrow subset so callers can
 * derive cards from either the existing `useArgumentRoomMessages` hook
 * OR a single batched `in()` query.
 */
export interface GalleryArgumentInput {
  id: string;
  debateId: string;
  parentId: string | null;
  authorId: string | null;
  argumentType: string | null;
  side: string | null;
  body: string;
  status: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface GalleryFlagInput {
  argumentId: string;
  flagCode: string;
}

export interface GalleryTagInput {
  argumentId: string;
  tagCode: string;
}

export interface BuildGalleryInput {
  debates: Debate[];
  /**
   * Arguments fetched in a single `in('debate_id', [...])` call. Order is
   * irrelevant; the model sorts internally.
   */
  argumentsByDebateId?: Record<string, GalleryArgumentInput[]>;
  /** Optional per-argument flag rows (from argument_flags). */
  flagsByArgumentId?: Record<string, GalleryFlagInput[]>;
  /** Optional per-argument tag rows (from argument_tags). */
  tagsByArgumentId?: Record<string, GalleryTagInput[]>;
  /** Optional per-debate participant count (e.g., distinct user_id count). */
  participantCountByDebateId?: Record<string, number>;
  /** Optional set of debate ids the current user has joined. */
  joinedDebateIds?: Set<string> | string[];
  /** Current user id (for `mySide`). */
  currentUserId?: string | null;
  /** Optional injected "now" timestamp for deterministic tests. Defaults to Date.now(). */
  nowMs?: number;
}

// ── Card model ────────────────────────────────────────────────

export type ConversationHeatLevel = 'cold' | 'warming' | 'hot' | 'overheated';

export type ConversationTemperament =
  | 'plain'
  | 'curious'
  | 'sharp'
  | 'pedantic'
  | 'evidence_heavy'
  | 'source_chain_heavy'
  | 'chaotic'
  | 'near_resolution';

export type ConversationBucket =
  | 'needs_rebuttal'
  | 'gaining_heat'
  | 'hot_now'
  | 'source_chain_fight'
  | 'evidence_fight'
  | 'definition_scope_fight'
  | 'pedantic_plain'
  | 'unresolved_deep_chain'
  | 'resolved_or_synthesized'
  | 'my_rooms'
  | 'all_open';

export type ConversationSortMode =
  | 'latest_activity'
  | 'newest_created'
  | 'heat'
  | 'needs_rebuttal_first'
  | 'most_moves'
  | 'oldest_unresolved';

export type ConversationDedupeMode = 'collapse_generated' | 'show_all';

/**
 * Stage 6.4 — Smart entry hint: tells the room shell which message to
 * activate when the user opens a card, plus a short prose hint to show
 * inside the room ("Be the first challenge", "Try narrowing", etc.).
 */
export interface ConversationEntryHint {
  /**
   * Which message to focus on entry.
   *  - `root`   → root message (root claim).
   *  - `latest` → most recent message.
   *  - `first_open_challenge` → the most recent challenge or ask_source move.
   */
  activate: 'root' | 'latest' | 'first_open_challenge';
  /** Short prose hint shown to the user inside the room. */
  microMomentLabel: string;
}

/**
 * Stage 6.4 — Gallery section ids the entry screen groups cards under.
 * The section a card belongs to is derived from `bucket` + `heatLevel`.
 */
export type ConversationGallerySection =
  | 'jump_in'           // hot rooms with active back-and-forth
  | 'needs_rebuttal'    // root posted, 0 rebuttals
  | 'source_trail'      // source_chain_fight bucket
  | 'hot_unresolved'    // hot_now OR overheated OR unresolved_deep_chain
  | 'easy_first_move'   // pedantic_plain / cold / quiet rooms
  | 'my_rooms';         // user is participant

export interface ConversationSignal {
  code: string;
  label: string;
  tone: 'neutral' | 'warning' | 'positive' | 'critical';
}

export interface ConversationTimelinePreviewSegment {
  ordinal: number;
  kindFamily: 'claim' | 'challenge' | 'evidence' | 'clarify' | 'concede' | 'flag' | 'default';
  color: string;
  /** True if the segment falls inside a detected band (first clash / evidence run / hot zone). */
  bandHighlight: 'first_clash' | 'evidence_run' | 'hot_zone' | 'source_chain_run' | null;
  isActive: boolean;
  isLatest: boolean;
}

export interface ConversationGalleryCard {
  debateId: string;
  canonicalConversationKey: string;
  duplicateCount: number;
  duplicateDebateIds: string[];

  title: string;
  fallbackTitle: string;
  starterDisplayName: string;
  starterSide: ParticipantSide | null;
  mySide: ParticipantSide | null;

  firstPostExcerpt: string;
  latestPostExcerpt: string;
  latestPostAuthor: string;

  createdAt: string;
  updatedAt: string;

  moveCount: number;
  rebuttalCount: number;
  participantCount: number;

  hasNoRebuttal: boolean;
  hasUserJoined: boolean;
  openStatus: 'open' | 'draft' | 'locked' | 'archived';

  bucket: ConversationBucket;
  heatLevel: ConversationHeatLevel;
  temperament: ConversationTemperament;

  issueFrame: string;
  dominantAxis: string;
  sourceChainRisk: 'low' | 'medium' | 'high' | 'unknown';
  evidentiaryRisk: 'low' | 'medium' | 'high' | 'unknown';
  amplificationRisk: 'none_observed' | 'low' | 'medium' | 'high';
  platformSupportWarning: boolean;

  unresolvedReason: string | null;
  stopReason: string | null;

  timelinePreviewSegments: ConversationTimelinePreviewSegment[];

  signals: ConversationSignal[];

  searchText: string;

  /** Future-voting placeholders. Reserved fields; never populated yet. */
  voteScorePreview?: null;
  winnerPreview?: null;
  promotedArgumentCount?: 0;

  sortKeys: {
    latestActivityMs: number;
    createdAtMs: number;
    heatScore: number;
    needsRebuttalFlag: number;
    moveCount: number;
    oldestUnresolvedMs: number;
  };
}

export interface ConversationGalleryBucket {
  id: ConversationBucket;
  label: string;
  emptyCopy: string;
}

export const BUCKET_DEFINITIONS: ConversationGalleryBucket[] = [
  { id: 'needs_rebuttal', label: 'Needs rebuttal', emptyCopy: 'No rooms waiting on a first rebuttal right now.' },
  { id: 'gaining_heat', label: 'Heating up', emptyCopy: 'No rooms gaining momentum yet.' },
  { id: 'hot_now', label: 'Hot now', emptyCopy: 'No rooms hot at the moment.' },
  { id: 'source_chain_fight', label: 'Source-chain fights', emptyCopy: 'No active source-chain pressure right now.' },
  { id: 'evidence_fight', label: 'Evidence fights', emptyCopy: 'No active evidence fights right now.' },
  { id: 'definition_scope_fight', label: 'Definition / scope', emptyCopy: 'No active definition or scope disputes.' },
  { id: 'pedantic_plain', label: 'Quiet / pedantic', emptyCopy: 'Nothing quiet — every room has tension.' },
  { id: 'unresolved_deep_chain', label: 'Unresolved deep chain', emptyCopy: 'No deep unresolved chains.' },
  { id: 'resolved_or_synthesized', label: 'Resolved', emptyCopy: 'No rooms have closed yet.' },
  { id: 'my_rooms', label: 'Mine', emptyCopy: "You haven't joined a room yet." },
  { id: 'all_open', label: 'All', emptyCopy: 'No rooms found.' },
];

// ── Helpers ────────────────────────────────────────────────────

function nowMs(input?: BuildGalleryInput): number {
  if (input && typeof input.nowMs === 'number') return input.nowMs;
  return Date.now();
}

function safeMs(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function normaliseWhitespace(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max = 140): string {
  const t = normaliseWhitespace(s);
  if (t.length <= max) return t;
  return t.slice(0, Math.max(1, max - 1)).trim() + '…';
}

const KIND_FAMILY_COLOR: Record<string, string> = {
  claim: '#6366f1',
  challenge: '#f97316',
  evidence: '#06b6d4',
  clarify: '#f59e0b',
  concede: '#a855f7',
  flag: '#ef4444',
  default: '#475569',
};

function kindFamily(argumentType: string | null | undefined): ConversationTimelinePreviewSegment['kindFamily'] {
  const k = String(argumentType || '').toLowerCase();
  switch (k) {
    case 'thesis': case 'claim': return 'claim';
    case 'rebuttal': case 'counter_rebuttal': case 'disagree': return 'challenge';
    case 'evidence': case 'source': return 'evidence';
    case 'clarification_request': case 'question': return 'clarify';
    case 'concession': case 'synthesis': case 'narrow': return 'concede';
    case 'flag': case 'delete': return 'flag';
    default: return 'default';
  }
}

function kindColor(family: ConversationTimelinePreviewSegment['kindFamily']): string {
  return KIND_FAMILY_COLOR[family] || KIND_FAMILY_COLOR.default;
}

// ── Dedupe ────────────────────────────────────────────────────

/**
 * Strip suffix tags the corpus runners add to titles, e.g.:
 *   "Bike lanes are better curb space [xai-adv 9018694f c45188c5]"
 *   "Pitch clock changed baseball pacing [ai-corpus fa172432 ai-seed-pitch-clock]"
 *   "Sports debate [stress-2026-05-17 #scenario-7]"
 * The cleaned title becomes the dedupe key when sourceHash/scenarioId
 * aren't directly available.
 */
const SUFFIX_TAG_PATTERNS = [
  /\s*\[(?:xai-adv|ai-corpus|stress|stage-\d+(?:\.\d+)*|run-\d+|scenario-\d+|seed-\d+)\b[^\]]*\]\s*$/i,
  /\s*\[(?:xai|ai|bot|corpus|stress|scenario|seed)[\w\d\s\-_:.,#]*\]\s*$/i,
  /\s*\([\w\d\s\-_:.,#]*?(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d\s\-_:.,#]*?\)\s*$/i,
  /\s*#(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d_-]+\s*$/i,
];

export function cleanTitleForDedupe(title: string): string {
  let t = normaliseWhitespace(title);
  for (let i = 0; i < 3 && t.length > 0; i++) {
    let changed = false;
    for (const re of SUFFIX_TAG_PATTERNS) {
      const next = t.replace(re, '');
      if (next !== t) { t = next.trim(); changed = true; }
    }
    if (!changed) break;
  }
  return t;
}

function normaliseRootBodyForDedupe(s: string): string {
  return normaliseWhitespace(s)
    .toLowerCase()
    .slice(0, 220);
}

export function deriveCanonicalConversationKey(input: {
  debate: Debate;
  rootArgumentBody?: string | null;
  hintHash?: string | null;
}): string {
  if (input.hintHash && input.hintHash.length >= 6) {
    return `hash:${input.hintHash}`;
  }
  const cleanedTitle = cleanTitleForDedupe(input.debate.title || '');
  if (input.rootArgumentBody && input.rootArgumentBody.length >= 24) {
    return `root:${normaliseRootBodyForDedupe(input.rootArgumentBody)}::title:${normaliseWhitespace(cleanedTitle).toLowerCase()}`;
  }
  if (cleanedTitle.length > 0) {
    return `title:${normaliseWhitespace(cleanedTitle).toLowerCase()}::resolution:${normaliseWhitespace(input.debate.resolution).toLowerCase().slice(0, 220)}`;
  }
  return `resolution:${normaliseWhitespace(input.debate.resolution).toLowerCase().slice(0, 220)}::id:${input.debate.id}`;
}

// ── Heat scoring ──────────────────────────────────────────────

/**
 * Deterministic heat score in [0, 1]. Inputs are all derived from
 * existing message fields — no popularity, no virality, no engagement
 * metrics. Hot = "active friction", not "popular".
 */
export function computeConversationHeat(args: {
  moveCount: number;
  rebuttalCount: number;
  participantCount: number;
  latestActivityAgeMs: number;
  sourceChainHits: number;
  evidenceHits: number;
  challengeRunLength: number;
  hostileToneHits: number;
  platformSupportWarning: boolean;
}): { score: number; level: ConversationHeatLevel } {
  const recency =
    args.latestActivityAgeMs <= 60 * 60 * 1000 ? 0.30 :       // <1h
    args.latestActivityAgeMs <= 6 * 60 * 60 * 1000 ? 0.22 :    // <6h
    args.latestActivityAgeMs <= 24 * 60 * 60 * 1000 ? 0.14 :   // <1d
    args.latestActivityAgeMs <= 3 * 24 * 60 * 60 * 1000 ? 0.07 :
    0.02;
  const move = Math.min(args.moveCount, 30) * 0.012;
  const rebuttal = Math.min(args.rebuttalCount, 12) * 0.015;
  const participants = Math.min(args.participantCount, 8) * 0.020;
  const sourceChain = Math.min(args.sourceChainHits, 8) * 0.020;
  const evidence = Math.min(args.evidenceHits, 8) * 0.012;
  const challengeRun = Math.min(args.challengeRunLength, 6) * 0.020;
  const hostile = Math.min(args.hostileToneHits, 6) * 0.025;
  const platform = args.platformSupportWarning ? 0.05 : 0;

  const raw = recency + move + rebuttal + participants + sourceChain + evidence + challengeRun + hostile + platform;
  const score = Math.max(0, Math.min(1, raw));
  let level: ConversationHeatLevel = 'cold';
  if (score >= 0.78) level = 'overheated';
  else if (score >= 0.50) level = 'hot';
  else if (score >= 0.22) level = 'warming';
  return { score, level };
}

// ── Temperament ──────────────────────────────────────────────

export function computeConversationTemperament(args: {
  moveCount: number;
  challengeRunLength: number;
  evidenceHits: number;
  sourceChainHits: number;
  definitionHits: number;
  scopeHits: number;
  hostileToneHits: number;
  concessionHits: number;
  synthesisHits: number;
}): ConversationTemperament {
  if (args.synthesisHits > 0 || args.concessionHits >= 2) return 'near_resolution';
  if (args.hostileToneHits >= 3 || args.challengeRunLength >= 5) return 'chaotic';
  if (args.sourceChainHits >= 2 && args.sourceChainHits >= args.evidenceHits) return 'source_chain_heavy';
  if (args.evidenceHits >= 2) return 'evidence_heavy';
  if (args.scopeHits + args.definitionHits >= 3 && args.evidenceHits === 0) return 'pedantic';
  if (args.challengeRunLength >= 2) return 'sharp';
  if (args.moveCount >= 3) return 'curious';
  return 'plain';
}

// ── Signals (compact chip strip) ─────────────────────────────

export function getConversationSignals(card: Pick<ConversationGalleryCard,
  | 'sourceChainRisk' | 'evidentiaryRisk' | 'amplificationRisk' | 'platformSupportWarning'
  | 'hasNoRebuttal' | 'unresolvedReason' | 'temperament' | 'rebuttalCount'
>): ConversationSignal[] {
  const out: ConversationSignal[] = [];
  if (card.hasNoRebuttal) out.push({ code: 'no_rebuttal', label: 'No rebuttal yet', tone: 'warning' });
  if (card.platformSupportWarning) out.push({ code: 'platform_warning', label: 'Platform support warning', tone: 'critical' });
  if (card.sourceChainRisk === 'high') out.push({ code: 'source_chain_high', label: 'Source-chain fight', tone: 'critical' });
  else if (card.sourceChainRisk === 'medium') out.push({ code: 'source_chain_medium', label: 'Source-chain pressure', tone: 'warning' });
  if (card.evidentiaryRisk === 'high') out.push({ code: 'evidence_high', label: 'Evidence demanded', tone: 'warning' });
  if (card.amplificationRisk === 'high') out.push({ code: 'amp_high', label: 'Amplification risk', tone: 'critical' });
  if (card.unresolvedReason) out.push({ code: 'unresolved', label: 'Unresolved', tone: 'warning' });
  if (card.temperament === 'near_resolution') out.push({ code: 'near_resolution', label: 'Closing in', tone: 'positive' });
  if (card.temperament === 'pedantic') out.push({ code: 'pedantic', label: 'Pedantic', tone: 'neutral' });
  return out;
}

// ── Search text ──────────────────────────────────────────────

export function getConversationSearchText(card: Pick<ConversationGalleryCard,
  | 'title' | 'fallbackTitle' | 'firstPostExcerpt' | 'latestPostExcerpt'
  | 'starterDisplayName' | 'issueFrame' | 'dominantAxis' | 'temperament' | 'bucket'
>): string {
  return [
    card.title, card.fallbackTitle, card.firstPostExcerpt, card.latestPostExcerpt,
    card.starterDisplayName, card.issueFrame, card.dominantAxis,
    card.temperament, card.bucket,
  ].filter(Boolean).join(' ').toLowerCase();
}

// ── Bucket classification ────────────────────────────────────

export function classifyConversationBucket(args: {
  hasNoRebuttal: boolean;
  heatLevel: ConversationHeatLevel;
  challengeRunLength: number;
  sourceChainHits: number;
  evidenceHits: number;
  definitionHits: number;
  scopeHits: number;
  platformSupportWarning: boolean;
  stopReason: string | null;
  moveCount: number;
  hasUserJoined: boolean;
  sourceChainRisk: ConversationGalleryCard['sourceChainRisk'];
  evidentiaryRisk: ConversationGalleryCard['evidentiaryRisk'];
  isMaxDepth: boolean;
  temperament: ConversationTemperament;
}): ConversationBucket {
  if (args.stopReason && /synthesis|concession|resolved/i.test(args.stopReason)) return 'resolved_or_synthesized';
  if (args.hasNoRebuttal) return 'needs_rebuttal';
  if (args.sourceChainHits >= 1 && (args.sourceChainRisk === 'high' || args.sourceChainRisk === 'medium' || args.platformSupportWarning)) return 'source_chain_fight';
  if (args.evidenceHits >= 2 || args.evidentiaryRisk === 'high') return 'evidence_fight';
  if (args.definitionHits + args.scopeHits >= 3) return 'definition_scope_fight';
  if (args.isMaxDepth || (args.moveCount >= 8 && !args.stopReason)) return 'unresolved_deep_chain';
  if (args.heatLevel === 'hot' || args.heatLevel === 'overheated') return 'hot_now';
  if (args.heatLevel === 'warming' && args.challengeRunLength >= 1) return 'gaining_heat';
  if (args.temperament === 'pedantic' || args.temperament === 'plain') return 'pedantic_plain';
  if (args.hasUserJoined) return 'my_rooms';
  return 'all_open';
}

// ── Card construction ────────────────────────────────────────

interface MessageStats {
  moveCount: number;
  rebuttalCount: number;
  challengeRunLength: number;
  evidenceHits: number;
  sourceChainHits: number;
  definitionHits: number;
  scopeHits: number;
  hostileToneHits: number;
  concessionHits: number;
  synthesisHits: number;
  amplificationHits: number;
  platformSupportWarning: boolean;
  dominantAxis: string;
  issueFrame: string;
  isMaxDepth: boolean;
  stopReason: string | null;
  rootBody: string;
  latestBody: string;
  rootAuthorId: string | null;
  latestAuthorId: string | null;
  rootCreatedAt: string;
  latestCreatedAt: string;
  segments: ConversationTimelinePreviewSegment[];
  // Risk derivations
  sourceChainRisk: ConversationGalleryCard['sourceChainRisk'];
  evidentiaryRisk: ConversationGalleryCard['evidentiaryRisk'];
  amplificationRisk: ConversationGalleryCard['amplificationRisk'];
}

const AXIS_TAG_CODES = new Set([
  'fact_disagreement', 'definition_disagreement', 'causal_disagreement',
  'value_disagreement', 'evidence_challenge', 'logic_challenge', 'scope_challenge',
  'source_request', 'quote_request',
]);

function deriveMessageStats(messages: GalleryArgumentInput[], flagsById: Record<string, GalleryFlagInput[]>, tagsById: Record<string, GalleryTagInput[]>): MessageStats {
  const sorted = messages.slice().sort((a, b) => {
    const ta = safeMs(a.createdAt);
    const tb = safeMs(b.createdAt);
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const stats: MessageStats = {
    moveCount: sorted.length,
    rebuttalCount: 0,
    challengeRunLength: 0,
    evidenceHits: 0,
    sourceChainHits: 0,
    definitionHits: 0,
    scopeHits: 0,
    hostileToneHits: 0,
    concessionHits: 0,
    synthesisHits: 0,
    amplificationHits: 0,
    platformSupportWarning: false,
    dominantAxis: 'none',
    issueFrame: 'unknown',
    isMaxDepth: false,
    stopReason: null,
    rootBody: '',
    latestBody: '',
    rootAuthorId: null,
    latestAuthorId: null,
    rootCreatedAt: '',
    latestCreatedAt: '',
    segments: [],
    sourceChainRisk: 'unknown',
    evidentiaryRisk: 'unknown',
    amplificationRisk: 'none_observed',
  };
  if (sorted.length === 0) return stats;

  const axisCounts: Record<string, number> = {};
  let currentChallengeRun = 0;
  let bestChallengeRun = 0;
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const family = kindFamily(m.argumentType);
    const flagCodes = (flagsById[m.id] || []).map((f) => f.flagCode.toLowerCase());
    const tagCodes = (tagsById[m.id] || []).map((t) => t.tagCode.toLowerCase());

    if (family === 'challenge') {
      stats.rebuttalCount += 1;
      currentChallengeRun += 1;
      if (currentChallengeRun > bestChallengeRun) bestChallengeRun = currentChallengeRun;
    } else {
      currentChallengeRun = 0;
    }
    if (family === 'evidence') stats.evidenceHits += 1;
    if (family === 'concede') stats.concessionHits += 1;
    if (m.argumentType === 'synthesis') stats.synthesisHits += 1;

    for (const t of tagCodes) {
      if (t.includes('source')) stats.sourceChainHits += 1;
      if (t.includes('definition')) stats.definitionHits += 1;
      if (t.includes('scope')) stats.scopeHits += 1;
      if (AXIS_TAG_CODES.has(t)) axisCounts[t] = (axisCounts[t] || 0) + 1;
    }
    if (flagCodes.includes('ad_hominem')) stats.hostileToneHits += 1;
    if (flagCodes.includes('civility_risk')) stats.hostileToneHits += 1;
    if (flagCodes.includes('amplification_risk_high')) stats.amplificationHits += 1;
    if (flagCodes.includes('platform_support_warning')) stats.platformSupportWarning = true;

    stats.segments.push({
      ordinal: i + 1,
      kindFamily: family,
      color: kindColor(family),
      bandHighlight: null,
      isActive: false,
      isLatest: i === sorted.length - 1,
    });
  }
  stats.challengeRunLength = bestChallengeRun;
  stats.rootBody = sorted[0].body || '';
  stats.latestBody = sorted[sorted.length - 1].body || '';
  stats.rootAuthorId = sorted[0].authorId;
  stats.latestAuthorId = sorted[sorted.length - 1].authorId;
  stats.rootCreatedAt = sorted[0].createdAt;
  stats.latestCreatedAt = sorted[sorted.length - 1].createdAt;

  // Pick dominant axis.
  let best = 0;
  for (const [k, v] of Object.entries(axisCounts)) {
    if (v > best) { best = v; stats.dominantAxis = k; }
  }

  // Detect bands across the segment array.
  // 1. First clash: first contiguous challenge starting at ordinal >= 2.
  const challengeStarts: number[] = [];
  for (let i = 0; i < stats.segments.length; i++) {
    if (stats.segments[i].kindFamily === 'challenge') challengeStarts.push(i);
  }
  if (challengeStarts.length > 0) {
    const firstChallenge = challengeStarts[0];
    if (firstChallenge >= 1) stats.segments[firstChallenge].bandHighlight = 'first_clash';
  }
  // 2. Evidence run.
  let runStart = -1;
  for (let i = 0; i < stats.segments.length; i++) {
    if (stats.segments[i].kindFamily === 'evidence') {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      if (i - runStart >= 2) {
        for (let j = runStart; j < i; j++) stats.segments[j].bandHighlight = 'evidence_run';
      }
      runStart = -1;
    }
  }
  if (runStart >= 0 && stats.segments.length - runStart >= 2) {
    for (let j = runStart; j < stats.segments.length; j++) stats.segments[j].bandHighlight = 'evidence_run';
  }
  // 3. Hot zone: 2+ contiguous challenges with hostile flags.
  let hotStart = -1;
  let consecutiveHostile = 0;
  for (let i = 0; i < sorted.length; i++) {
    const fams = stats.segments[i].kindFamily;
    const fc = (flagsById[sorted[i].id] || []).map((f) => f.flagCode.toLowerCase());
    const isHot = fams === 'challenge' && (fc.includes('ad_hominem') || fc.includes('civility_risk'));
    if (isHot) {
      if (hotStart < 0) hotStart = i;
      consecutiveHostile += 1;
    } else {
      if (consecutiveHostile >= 2) {
        for (let j = hotStart; j < i; j++) if (stats.segments[j].bandHighlight == null) stats.segments[j].bandHighlight = 'hot_zone';
      }
      hotStart = -1;
      consecutiveHostile = 0;
    }
  }
  if (consecutiveHostile >= 2 && hotStart >= 0) {
    for (let j = hotStart; j < stats.segments.length; j++) if (stats.segments[j].bandHighlight == null) stats.segments[j].bandHighlight = 'hot_zone';
  }
  // 4. Source-chain run: 2+ source tags.
  if (stats.sourceChainHits >= 2) {
    for (let i = 0; i < sorted.length; i++) {
      const tcs = (tagsById[sorted[i].id] || []).map((t) => t.tagCode.toLowerCase());
      if (tcs.some((t) => t.includes('source'))) {
        if (stats.segments[i].bandHighlight == null) stats.segments[i].bandHighlight = 'source_chain_run';
      }
    }
  }

  // Risk derivations from accumulated counts.
  stats.sourceChainRisk = stats.platformSupportWarning ? 'high'
    : stats.sourceChainHits >= 2 ? 'medium'
    : stats.sourceChainHits === 1 ? 'low'
    : 'unknown';
  stats.evidentiaryRisk = stats.evidenceHits >= 2 ? 'medium' : stats.evidenceHits === 1 ? 'low' : 'unknown';
  stats.amplificationRisk = stats.amplificationHits >= 2 ? 'high'
    : stats.amplificationHits === 1 ? 'medium'
    : 'none_observed';

  // Max depth detection: deepest argument-type chain length >= 9 OR explicit stop reason.
  if (stats.moveCount >= 9 && stats.synthesisHits === 0 && stats.concessionHits === 0) stats.isMaxDepth = true;

  return stats;
}

// ── Build cards ──────────────────────────────────────────────

export function buildConversationGalleryCards(input: BuildGalleryInput): ConversationGalleryCard[] {
  const argsByDebate = input.argumentsByDebateId || {};
  const flagsById = input.flagsByArgumentId || {};
  const tagsById = input.tagsByArgumentId || {};
  const participantCountByDebateId = input.participantCountByDebateId || {};
  const joinedSet = input.joinedDebateIds instanceof Set
    ? input.joinedDebateIds
    : new Set(input.joinedDebateIds || []);
  const now = nowMs(input);
  const cards: ConversationGalleryCard[] = [];

  for (const debate of input.debates) {
    const messages = (argsByDebate[debate.id] || []).filter((m) => m.status !== 'deleted');
    const stats = deriveMessageStats(messages, flagsById, tagsById);

    const cleanedTitle = cleanTitleForDedupe(debate.title || '');
    const canonicalConversationKey = deriveCanonicalConversationKey({
      debate,
      rootArgumentBody: stats.rootBody,
    });

    const hasNoRebuttal = stats.moveCount >= 1 && stats.rebuttalCount === 0;
    const latestActivityMs = safeMs(debate.updatedAt) || safeMs(stats.latestCreatedAt) || safeMs(debate.createdAt);
    const latestActivityAgeMs = Math.max(0, now - latestActivityMs);
    const heat = computeConversationHeat({
      moveCount: stats.moveCount,
      rebuttalCount: stats.rebuttalCount,
      participantCount: participantCountByDebateId[debate.id] || 0,
      latestActivityAgeMs,
      sourceChainHits: stats.sourceChainHits,
      evidenceHits: stats.evidenceHits,
      challengeRunLength: stats.challengeRunLength,
      hostileToneHits: stats.hostileToneHits,
      platformSupportWarning: stats.platformSupportWarning,
    });
    const temperament = computeConversationTemperament({
      moveCount: stats.moveCount,
      challengeRunLength: stats.challengeRunLength,
      evidenceHits: stats.evidenceHits,
      sourceChainHits: stats.sourceChainHits,
      definitionHits: stats.definitionHits,
      scopeHits: stats.scopeHits,
      hostileToneHits: stats.hostileToneHits,
      concessionHits: stats.concessionHits,
      synthesisHits: stats.synthesisHits,
    });
    const bucket = classifyConversationBucket({
      hasNoRebuttal,
      heatLevel: heat.level,
      challengeRunLength: stats.challengeRunLength,
      sourceChainHits: stats.sourceChainHits,
      evidenceHits: stats.evidenceHits,
      definitionHits: stats.definitionHits,
      scopeHits: stats.scopeHits,
      platformSupportWarning: stats.platformSupportWarning,
      stopReason: stats.stopReason,
      moveCount: stats.moveCount,
      hasUserJoined: joinedSet.has(debate.id),
      sourceChainRisk: stats.sourceChainRisk,
      evidentiaryRisk: stats.evidentiaryRisk,
      isMaxDepth: stats.isMaxDepth,
      temperament,
    });

    const fallbackTitle = cleanedTitle.length > 0
      ? cleanedTitle
      : (truncate(stats.rootBody, 100) || truncate(debate.resolution, 100) || 'Untitled');

    const cardCore: ConversationGalleryCard = {
      debateId: debate.id,
      canonicalConversationKey,
      duplicateCount: 1,
      duplicateDebateIds: [debate.id],

      title: cleanedTitle || fallbackTitle,
      fallbackTitle,
      starterDisplayName: deriveStarterDisplay(stats.rootAuthorId, debate.createdBy),
      starterSide: null,
      mySide: debate.myParticipantSide,

      firstPostExcerpt: truncate(stats.rootBody, 200),
      latestPostExcerpt: truncate(stats.latestBody, 200),
      latestPostAuthor: stats.latestAuthorId === input.currentUserId
        ? 'You'
        : stats.latestAuthorId
          ? 'Opponent'
          : 'Unknown',

      createdAt: debate.createdAt,
      updatedAt: debate.updatedAt,

      moveCount: stats.moveCount,
      rebuttalCount: stats.rebuttalCount,
      participantCount: participantCountByDebateId[debate.id] || 0,

      hasNoRebuttal,
      hasUserJoined: joinedSet.has(debate.id) || debate.myParticipantSide != null,
      openStatus: debate.status,

      bucket,
      heatLevel: heat.level,
      temperament,

      issueFrame: stats.issueFrame,
      dominantAxis: stats.dominantAxis,
      sourceChainRisk: stats.sourceChainRisk,
      evidentiaryRisk: stats.evidentiaryRisk,
      amplificationRisk: stats.amplificationRisk,
      platformSupportWarning: stats.platformSupportWarning,

      unresolvedReason: stats.isMaxDepth ? 'max_depth_reached_no_synthesis'
        : (stats.moveCount >= 8 && !stats.stopReason) ? 'long_thread_no_close'
        : null,
      stopReason: stats.stopReason,

      timelinePreviewSegments: stats.segments,

      signals: [],
      searchText: '',

      voteScorePreview: null,
      winnerPreview: null,
      promotedArgumentCount: 0,

      sortKeys: {
        latestActivityMs,
        createdAtMs: safeMs(debate.createdAt),
        heatScore: heat.score,
        needsRebuttalFlag: hasNoRebuttal ? 1 : 0,
        moveCount: stats.moveCount,
        oldestUnresolvedMs: (stats.isMaxDepth || (stats.moveCount >= 8 && !stats.stopReason)) ? safeMs(debate.createdAt) : Number.POSITIVE_INFINITY,
      },
    };
    cardCore.signals = getConversationSignals(cardCore);
    cardCore.searchText = getConversationSearchText(cardCore);
    cards.push(cardCore);
  }
  return cards;
}

function deriveStarterDisplay(rootAuthorId: string | null, fallbackUserId: string): string {
  // The Debates API doesn't surface display names; we keep this defensive
  // so cards don't leak raw UUIDs. Future versions can plumb a display map.
  const id = rootAuthorId || fallbackUserId;
  if (!id) return 'Unknown';
  return `User · ${id.slice(0, 4)}…${id.slice(-4)}`;
}

// ── Dedupe (visual only) ─────────────────────────────────────

export function dedupeConversationCards(
  cards: ConversationGalleryCard[],
  mode: ConversationDedupeMode = 'collapse_generated',
): ConversationGalleryCard[] {
  if (mode === 'show_all') return cards.slice();
  const byKey = new Map<string, ConversationGalleryCard>();
  for (const c of cards) {
    const existing = byKey.get(c.canonicalConversationKey);
    if (!existing) {
      byKey.set(c.canonicalConversationKey, { ...c, duplicateDebateIds: [c.debateId], duplicateCount: 1 });
      continue;
    }
    // Pick the "primary" card by latest activity. Older variants collapse into it.
    const incomingScore = c.sortKeys.latestActivityMs;
    const existingScore = existing.sortKeys.latestActivityMs;
    const primary = incomingScore > existingScore ? c : existing;
    const other = primary === c ? existing : c;
    const merged: ConversationGalleryCard = {
      ...primary,
      duplicateCount: existing.duplicateCount + 1,
      duplicateDebateIds: [...existing.duplicateDebateIds, c.debateId].filter((id) => id !== primary.debateId).concat([primary.debateId]).reverse().slice(0, existing.duplicateCount + 1),
    };
    // Deterministic ordering: primary debateId first, then chronological.
    const ids = new Set<string>([primary.debateId]);
    for (const id of [...existing.duplicateDebateIds, c.debateId]) ids.add(id);
    merged.duplicateDebateIds = Array.from(ids);
    // Preserve "any duplicate has user joined" semantics.
    merged.hasUserJoined = primary.hasUserJoined || other.hasUserJoined;
    byKey.set(c.canonicalConversationKey, merged);
  }
  return Array.from(byKey.values());
}

// ── Sorting ─────────────────────────────────────────────────

export function sortConversationGalleryCards(
  cards: ConversationGalleryCard[],
  mode: ConversationSortMode,
): ConversationGalleryCard[] {
  const arr = cards.slice();
  switch (mode) {
    case 'latest_activity':
      arr.sort((a, b) => b.sortKeys.latestActivityMs - a.sortKeys.latestActivityMs);
      break;
    case 'newest_created':
      arr.sort((a, b) => b.sortKeys.createdAtMs - a.sortKeys.createdAtMs);
      break;
    case 'heat':
      arr.sort((a, b) => b.sortKeys.heatScore - a.sortKeys.heatScore || b.sortKeys.latestActivityMs - a.sortKeys.latestActivityMs);
      break;
    case 'needs_rebuttal_first':
      arr.sort((a, b) => b.sortKeys.needsRebuttalFlag - a.sortKeys.needsRebuttalFlag || b.sortKeys.latestActivityMs - a.sortKeys.latestActivityMs);
      break;
    case 'most_moves':
      arr.sort((a, b) => b.sortKeys.moveCount - a.sortKeys.moveCount || b.sortKeys.latestActivityMs - a.sortKeys.latestActivityMs);
      break;
    case 'oldest_unresolved':
      arr.sort((a, b) => {
        const aFinite = Number.isFinite(a.sortKeys.oldestUnresolvedMs);
        const bFinite = Number.isFinite(b.sortKeys.oldestUnresolvedMs);
        if (aFinite && !bFinite) return -1;
        if (!aFinite && bFinite) return 1;
        return a.sortKeys.oldestUnresolvedMs - b.sortKeys.oldestUnresolvedMs;
      });
      break;
    default:
      // No-op
  }
  return arr;
}

// ── Pagination ──────────────────────────────────────────────

// ── Stage 6.4 — Smart entry hints + section grouping ─────────

/**
 * Decide which message to activate when the user opens a card, plus a
 * short prose hint to show inside the room. Pure / deterministic.
 */
export function deriveConversationEntryHint(card: ConversationGalleryCard): ConversationEntryHint {
  if (card.hasNoRebuttal) return { activate: 'root', microMomentLabel: 'Be the first rebuttal' };
  switch (card.bucket) {
    case 'source_chain_fight':
      return { activate: 'first_open_challenge', microMomentLabel: 'Ask for the source' };
    case 'evidence_fight':
      return { activate: 'first_open_challenge', microMomentLabel: 'Challenge the mechanism' };
    case 'definition_scope_fight':
      return { activate: 'latest', microMomentLabel: 'Narrow the claim' };
    case 'unresolved_deep_chain':
      return { activate: 'latest', microMomentLabel: 'Try narrowing or offer a synthesis' };
    case 'hot_now':
      return { activate: 'latest', microMomentLabel: 'Jump into the live exchange' };
    case 'gaining_heat':
      return { activate: 'latest', microMomentLabel: 'Add the next move' };
    case 'pedantic_plain':
      return { activate: 'root', microMomentLabel: 'Watch first — quiet room' };
    case 'resolved_or_synthesized':
      return { activate: 'latest', microMomentLabel: 'Resolved — read how it closed' };
    case 'my_rooms':
      return { activate: 'latest', microMomentLabel: 'Continue where you left off' };
    case 'needs_rebuttal':
      return { activate: 'root', microMomentLabel: 'Be the first rebuttal' };
    case 'all_open':
    default:
      return { activate: 'latest', microMomentLabel: 'Watch first — join when ready' };
  }
}

/**
 * Group cards into Stage 6.4 entry sections. Returns ordered sections
 * with their cards; each card appears in AT MOST one section so a user
 * scrolling top-to-bottom can scan the whole inventory.
 */
export interface GallerySectionGroup {
  id: ConversationGallerySection;
  label: string;
  cards: ConversationGalleryCard[];
}

const SECTION_ORDER: ConversationGallerySection[] = [
  'jump_in', 'needs_rebuttal', 'source_trail', 'hot_unresolved', 'easy_first_move', 'my_rooms',
];

const SECTION_LABEL: Record<ConversationGallerySection, string> = {
  jump_in: 'Jump into a live dispute',
  needs_rebuttal: 'Needs first rebuttal',
  source_trail: 'Source trail fights',
  hot_unresolved: 'Hot but unresolved',
  easy_first_move: 'Easy first move',
  my_rooms: 'My rooms',
};

function classifyCardToSection(card: ConversationGalleryCard): ConversationGallerySection {
  // Priority order keeps each card in a single section.
  if (card.hasUserJoined) return 'my_rooms';
  if (card.hasNoRebuttal) return 'needs_rebuttal';
  if (card.bucket === 'source_chain_fight') return 'source_trail';
  if (card.bucket === 'hot_now' || card.heatLevel === 'overheated' || card.bucket === 'unresolved_deep_chain') return 'hot_unresolved';
  if (card.heatLevel === 'warming' && card.rebuttalCount >= 1) return 'jump_in';
  if (card.bucket === 'pedantic_plain' || card.heatLevel === 'cold') return 'easy_first_move';
  return 'jump_in';
}

export function groupGalleryCardsBySection(cards: ConversationGalleryCard[]): GallerySectionGroup[] {
  const byId = new Map<ConversationGallerySection, ConversationGalleryCard[]>();
  for (const id of SECTION_ORDER) byId.set(id, []);
  for (const c of cards) {
    const sid = classifyCardToSection(c);
    byId.get(sid)!.push(c);
  }
  const groups: GallerySectionGroup[] = [];
  for (const id of SECTION_ORDER) {
    const list = byId.get(id) || [];
    if (list.length === 0) continue;
    groups.push({ id, label: SECTION_LABEL[id], cards: list });
  }
  return groups;
}

export function paginateConversationGalleryCards(
  cards: ConversationGalleryCard[],
  pageSize: number,
  pageIndex: number,
): { page: ConversationGalleryCard[]; total: number; pageCount: number; pageIndex: number } {
  const safeSize = Math.max(1, Math.min(pageSize, 100));
  const total = cards.length;
  const pageCount = Math.max(1, Math.ceil(total / safeSize));
  const safeIdx = Math.max(0, Math.min(pageIndex, pageCount - 1));
  const start = safeIdx * safeSize;
  return {
    page: cards.slice(start, start + safeSize),
    total,
    pageCount,
    pageIndex: safeIdx,
  };
}
