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
import type { PointLifecycleState } from '../lifecycle';
import type { TimelineNodeActionDockActionCode } from '../arguments/timelineNodeActionDockModel';
import type { QuickActionLabel } from '../arguments/quickActionPresets';
import type { EntryOpportunity } from '../strengthWeakness/heatModel';
import { getLifecycleUx } from '../rulesUx/lifecycleUxMap';
import { GALLERY_SECTION_DEFINITIONS, type GallerySectionDefinition } from '../arguments/gameCopy';
// UX-PR-G (#920) — the ONE fixture-tag strip. Zero-dependency leaf module, so
// importing it into this broadly-imported model cannot form a require cycle.
import { stripFixtureTag } from './fixtureTagRegistry';
import { buildEvidenceArtifacts } from '../evidence/evidenceModel';
import {
  deriveEvidenceDebts,
  getRoomEvidenceDebtSummary,
  type EvidenceDebtArgumentInput,
  type RoomEvidenceDebtSummary,
} from '../evidence/evidenceDebtModel';
// INTEL-001 (#900) — the engagement-lane dodge-chain deriver. Pure TS; no
// pointStanding, no standing coupling, no person axis.
import { deriveDodgeChains } from '../intel/dodgeChainModel';

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
  /**
   * EV-003 — Optional raw evidence attachments from
   * `arguments.client_validation.attachedEvidence`. The gallery loader
   * threads `row.clientValidation.attachedEvidence` here so `buildGallery`
   * can derive evidence debts via EV-001's `buildEvidenceArtifacts`. Optional;
   * defaults to `[]`. Reused — no new query.
   */
  attachedEvidence?: ReadonlyArray<{
    url?: string | null;
    label?: string | null;
    sourceText?: string | null;
    quote?: string | null;
  }> | null;
  /**
   * ADMIN-ARGS-INACTIVE-001 — lifecycle visibility column. NULL = active,
   * NOT NULL = inactive (hidden from default views). Belt-and-braces:
   * `buildGallery` excludes rows with a non-null value. Optional; absence
   * is treated as `null` (active).
   */
  inactiveAt?: string | null;
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
  /**
   * INTEL-001 (#900) — OPTIONAL per-debate `did_not_address` argument ids (the
   * FEEDBACK-001 MoveMarkAggregate.unaddressedMoveIds). Present ONLY when the
   * gallery load fetched active move_marks (gated on the move_marks flag). When
   * present, the deriver folds dodge-chain hits into the engagement-lane heat
   * term. Absent (flag OFF, no fetch) => heat byte-identical.
   */
  unaddressedMoveIdsByDebateId?: Record<string, readonly string[]>;
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
 * GAL-002 — Gallery entry hint vocabulary. Seven structural verbs that
 * cover every gallery card's "first suggested move":
 *
 *   - `be_first_rebuttal` / `watch_first` / `join_when_ready`  — gallery-only
 *     room-entry meta-actions; no ST-002 equivalent because these are not
 *     argument moves.
 *   - `ask_source` / `challenge_mechanism` / `narrow` / `synthesize` —
 *     overlap with ST-002's `SuggestedMoveCode` and reuse the exact
 *     spelling so the two models stay in lockstep.
 *
 * Codes never reach the rendered UI. They drive `presetKey` / `dockAction`
 * routing and the `code` field on `GalleryEntryHint` for analytics.
 */
export type GalleryEntryHintCode =
  | 'be_first_rebuttal'
  | 'ask_source'
  | 'challenge_mechanism'
  | 'narrow'
  | 'synthesize'
  | 'watch_first'
  | 'join_when_ready';

/** Frozen list of every hint code. Tests iterate this. */
export const ALL_GALLERY_ENTRY_HINT_CODES: ReadonlyArray<GalleryEntryHintCode> = Object.freeze([
  'be_first_rebuttal',
  'ask_source',
  'challenge_mechanism',
  'narrow',
  'synthesize',
  'watch_first',
  'join_when_ready',
]);

/**
 * GAL-002 — Hint shape. Replaces Stage 6.4 `ConversationEntryHint`.
 *
 * - `activate` preserves the Stage 6.4 semantic (which message the room
 *   shell pre-activates on entry).
 * - `code` is the typed union member.
 * - `verbPhrase` ≤ 8 words. The call-to-action the gallery card renders.
 * - `helperLine` is the RULE-003 helper line (lifecycle-derived hints) or
 *   a constant gallery-meta helper (the three room-entry meta-actions).
 *   `verbPhrase + helperLine` stays ≤ 200 chars after the render layer's
 *   `' — '` separator (≤ 197 chars of content + 3 chars of separator).
 * - `presetKey` is an existing `QuickActionLabel` value, or `null` for the
 *   three gallery-only meta-actions that do not open the composer.
 * - `dockAction` is the matching SC-004 dock action code, or `null` when
 *   no dock action lines up.
 */
export interface GalleryEntryHint {
  /**
   * Which message to focus on entry.
   *  - `root`   → root message (root claim).
   *  - `latest` → most recent message.
   *  - `first_open_challenge` → the most recent challenge or ask_source move.
   */
  activate: 'root' | 'latest' | 'first_open_challenge';
  code: GalleryEntryHintCode;
  verbPhrase: string;
  helperLine: string;
  presetKey: QuickActionLabel | null;
  dockAction: TimelineNodeActionDockActionCode | null;
  /**
   * QOL-040.3 — Optional override. When set, the room shell uses this
   * id as the initial active message instead of the deriver's
   * `activate` policy, IF the id is present in the loaded message
   * slice. Falls through to the `activate` policy when absent or
   * inaccessible (soft-deleted, wrong-room, RLS-hidden). Set only by
   * notification deep-link hand-offs (see `buildDeepLinkEntryHint`);
   * the gallery deriver (`deriveGalleryEntryHint`) never sets this
   * field.
   */
  entryHintForArgumentId?: string;
}

/**
 * GAL-001 — Gallery play lanes the entry screen groups cards under.
 *
 * Replaces Stage 6.4's 6-section catalogue with 10 "play lanes" that
 * match the kind of move a user wants to make. The 4 stable codes carry
 * forward (`my_rooms`, `needs_rebuttal`, `jump_in`, `source_trail`);
 * `easy_first_move` was renamed to `quiet_beginner_rooms` for plain-
 * language clarity; `hot_unresolved` was retired (its cards now split
 * between `jump_in` and `logic_traps` per the priority order in
 * `classifyCardToSection`). 6 new lanes carry the move-structure /
 * lifecycle signals downstream of GAL-002 + SW-002 + LIFE-001.
 *
 * Lane derivation is pure-TS, deterministic, side-effect-free. Each card
 * maps to EXACTLY one lane. Inputs are all structural / activity / lifecycle
 * descriptors — none read popularity, engagement, view counts, or
 * follower counts (doctrine §3).
 */
export type ConversationGallerySection =
  | 'my_rooms'                // user is participant
  | 'needs_rebuttal'          // root posted, 0 rebuttals
  | 'jump_in'                 // active back-and-forth
  | 'source_trail'            // source_chain_fight bucket
  | 'evidence_needed'         // evidence_fight bucket
  | 'definition_fights'       // definition_scope_fight bucket
  | 'logic_traps'             // exhausted / repeated-axis pressure
  | 'tangents_branches'       // branch_recommended / off-axis pressure
  | 'almost_synthesis'        // synthesis_ready / narrowed / conceded / confirmed
  | 'quiet_beginner_rooms';   // cold / plain rooms — easy first move

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
  /**
   * QOL-039 — Room visibility. Drives the §6.4 gallery routing rule: a
   * `'private'` card the user is in routes into the `'my_rooms'` lane and
   * is excluded from every public-discovery lane. Defaults to `'public'`
   * for any pre-migration card the loader projects.
   */
  visibility: 'public' | 'private';

  bucket: ConversationBucket;
  heatLevel: ConversationHeatLevel;
  temperament: ConversationTemperament;

  issueFrame: string;
  dominantAxis: string;
  sourceChainRisk: 'low' | 'medium' | 'high' | 'unknown';
  evidentiaryRisk: 'low' | 'medium' | 'high' | 'unknown';
  amplificationRisk: 'none_observed' | 'low' | 'medium' | 'high';
  platformSupportWarning: boolean;

  /**
   * EV-003 — Per-room evidence-debt roll-up. Drives the "Evidence requested"
   * indicator and gives the source-trail lane an HONEST data source: it can
   * tell an open source request from a resolved one (tag counts alone
   * cannot). Render-time-derived from the room's argument rows — no new
   * query, no migration. A debt is advisory; this is an obligation marker,
   * never a truth label.
   */
  evidenceDebtSummary: RoomEvidenceDebtSummary;

  unresolvedReason: string | null;
  stopReason: string | null;

  timelinePreviewSegments: ConversationTimelinePreviewSegment[];

  signals: ConversationSignal[];

  searchText: string;

  /** Future-voting placeholders. Reserved fields; never populated yet. */
  voteScorePreview?: null;
  winnerPreview?: null;
  promotedArgumentCount?: 0;

  /**
   * GAL-002 — Root-cluster lifecycle state (LIFE-001). When present, the
   * primary signal for `deriveGalleryEntryHint`. When null/undefined, the
   * deriver falls back to the bucket-driven parity branch. Loader-populated;
   * the gallery model does not derive it.
   */
  rootClusterLifecycleState?: PointLifecycleState | null;

  /**
   * GAL-002 — Optional SW-002 `entryOpportunity` snapshot. Used by the
   * deriver as a tie-breaker between `watch_first` / `join_when_ready` /
   * `narrow`. Loader-populated.
   */
  entryOpportunity?: EntryOpportunity | null;

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
 *   "Remote work productivity [reseed-baseline-20260708-1a2b3c4d]"
 * The cleaned title becomes the dedupe key when sourceHash / scenarioId
 * are not directly available.
 *
 * UX-PR-G (#920): the pattern family + strip loop were HOISTED into the
 * zero-dependency `fixtureTagRegistry.stripFixtureTag`, consolidating the
 * three former regex mirrors (this file, `botRoomPolicyModel`,
 * `argumentArtifactModel`) into ONE source of truth. Emitted output is
 * byte-identical for the existing corpus (this file already carried the
 * HOME-001 #874 `reseed` alternative); the mirror-parity test proves the
 * three now agree.
 */
export function cleanTitleForDedupe(title: string): string {
  return stripFixtureTag(title);
}

/**
 * HOME-001 (#874) — the three display literals the card latestPostAuthor
 * field can take. Hoisted from the inline ternary in the card builder so a
 * downstream deriver (isWaitingOnViewer) can key off `LATEST_AUTHOR_LABEL.other`
 * instead of a magic string. Emitted output is byte-identical to the prior
 * inline literals ('You' / 'Other voice' / 'Unknown'), so existing snapshot /
 * equality tests stay green.
 *
 * `latestPostAuthor` is a DISPLAY string, never a raw author id — the id is
 * intentionally not exposed on the card. `other` means the latest non-deleted
 * move author is a known account that is not the viewer; `you` means the viewer
 * authored it; `unknown` means there is no attributable latest author.
 */
export const LATEST_AUTHOR_LABEL = Object.freeze({
  you: 'You',
  other: 'Other voice',
  unknown: 'Unknown',
} as const);

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
  /**
   * INTEL-001 (#900) — OPTIONAL engagement-lane friction term: distinct nodes in
   * a dodge-chain (>= 2 consecutive `did_not_address` on one thread). Default 0.
   * Existing callers are unaffected; absent/0 => identical score. Engagement lane
   * only — friction, never correctness, popularity, or standing.
   */
  dodgeChainHits?: number;
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
  // INTEL-001 (#900) — dodge-chain friction (same weight band as challengeRun,
  // capped at 6). Absent/0 => identical score.
  const dodge = Math.min(args.dodgeChainHits ?? 0, 6) * 0.020;

  const raw = recency + move + rebuttal + participants + sourceChain + evidence + challengeRun + hostile + platform + dodge;
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
  | 'evidenceDebtSummary'
>): ConversationSignal[] {
  const out: ConversationSignal[] = [];
  if (card.hasNoRebuttal) out.push({ code: 'no_rebuttal', label: 'No rebuttal yet', tone: 'warning' });
  if (card.platformSupportWarning) out.push({ code: 'platform_warning', label: 'Platform support warning', tone: 'critical' });
  // EV-003 — an open evidence debt is a real, resolution-aware signal. It
  // sits above the tag-count source-chain risk because it can tell an open
  // request from a resolved one. The label is an OBLIGATION observation,
  // never a verdict.
  if (card.evidenceDebtSummary?.hasOpenEvidenceDebt) {
    out.push({ code: 'evidence_debt_open', label: 'Evidence requested', tone: 'warning' });
  }
  if ((card.evidenceDebtSummary?.staleCount ?? 0) > 0) {
    out.push({ code: 'evidence_debt_stale', label: 'Source still owed', tone: 'neutral' });
  }
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
  /**
   * EV-003 — count of OPEN evidence debts in the room (requested /
   * challenged / unresolved / stale). The primary `source_chain_fight`
   * signal: a room with a live source obligation is a genuine source-trail
   * fight. Defaults to 0.
   */
  openEvidenceDebtCount?: number;
  /**
   * EV-003 — total evidence debts in the room (any status). When this is
   * > 0 the debt count is AUTHORITATIVE for the `source_chain_fight` lane:
   * a room whose `source_request` debts all resolved (`totalEvidenceDebtCount
   * > 0`, `openEvidenceDebtCount === 0`) is NOT a live source-trail fight and
   * is kept OUT of the lane — the precision fix the tag-count heuristic could
   * not make. When the room has NO debts at all, the legacy tag-count
   * heuristic still applies (it catches `source`-flavoured tags that are not
   * formal requests). Defaults to 0.
   */
  totalEvidenceDebtCount?: number;
}): ConversationBucket {
  if (args.stopReason && /synthesis|concession|resolved/i.test(args.stopReason)) return 'resolved_or_synthesized';
  if (args.hasNoRebuttal) return 'needs_rebuttal';
  // EV-003 — when the room has evidence debts, the OPEN-debt count is the
  // authoritative source-trail-fight signal: an open debt routes in; an
  // all-resolved room is held out. When the room has NO debts, fall through
  // to the legacy tag-count heuristic below.
  const totalDebts = args.totalEvidenceDebtCount ?? 0;
  const openDebts = args.openEvidenceDebtCount ?? 0;
  if (totalDebts > 0) {
    if (openDebts > 0) return 'source_chain_fight';
    // Debts exist but all resolved — skip the source-trail lane entirely.
  } else if (
    args.sourceChainHits >= 1 &&
    (args.sourceChainRisk === 'high' || args.sourceChainRisk === 'medium' || args.platformSupportWarning)
  ) {
    return 'source_chain_fight';
  }
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

/**
 * UX-PR-G (#920) P1-10 — count DISTINCT non-null authorIds among the already
 * filtered, non-deleted messages. This is the "Voices" display count (distinct
 * posters), never a seat count and never a popularity signal. Null / anonymous
 * authorIds are ignored (a room with only unattributable posts reads 0 Voices,
 * which is honest). O(n) over rows the builder already iterates.
 */
function countDistinctAuthors(messages: GalleryArgumentInput[]): number {
  const authors = new Set<string>();
  for (const m of messages) {
    if (typeof m.authorId === 'string' && m.authorId.length > 0) authors.add(m.authorId);
  }
  return authors.size;
}

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
    // ADMIN-CONV-INACTIVE-VISIBILITY-001 — debate-level (whole-conversation)
    // inactivation guard (#514). The `debates` RLS SELECT policy (migration
    // 20260606000001) already withholds inactive rooms from every non-admin
    // arm, so regular users never receive these rows. The admin RLS arm is
    // unrestricted, so without this guard the admin gallery would still list
    // inactive rooms. SKIP them here — defense-in-depth that also cleans the
    // admin gallery UI. Absence of `inactiveAt` is treated as active. We read
    // the timestamp (the WHAT) ONLY — never any reason (§10a).
    if ((debate.inactiveAt ?? null) !== null) continue;
    // ADMIN-ARGS-INACTIVE-001 — pure-TS belt-and-braces: exclude inactive
    // rows from the gallery. RLS + SQL predicate already exclude them for
    // non-admin viewers; this is defense-in-depth. Absence of inactiveAt
    // is treated as active.
    const messages = (argsByDebate[debate.id] || []).filter(
      (m) => m.status !== 'deleted' && (m.inactiveAt ?? null) === null,
    );
    const stats = deriveMessageStats(messages, flagsById, tagsById);
    // UX-PR-G (#920) P1-10 — distinct-poster count from the SAME already-fetched
    // rows (no new query). This becomes the DISPLAY "Voices" value; the heat
    // input line below intentionally keeps reading the raw
    // participantCountByDebateId map verbatim, so heat / bucket / lane stay
    // byte-identical (the display field and the heat term are decoupled).
    const distinctAuthorCount = countDistinctAuthors(messages);

    // EV-003 — derive the room's evidence debts from the SAME already-fetched
    // rows (the gallery's batched `in()` query; no new fetch). Tag codes come
    // from the per-argument `tagsByArgumentId` map; artifacts are built from
    // each row's `attachedEvidence` via EV-001's `buildEvidenceArtifacts`.
    const evidenceDebts = deriveEvidenceDebts({
      debateId: debate.id,
      arguments: messages.map<EvidenceDebtArgumentInput>((m) => ({
        id: m.id,
        debateId: debate.id,
        parentId: m.parentId,
        authorId: m.authorId,
        argumentType: m.argumentType,
        side: m.side,
        createdAt: m.createdAt,
        tagCodes: (tagsById[m.id] || []).map((t) => t.tagCode),
        artifacts: Array.isArray(m.attachedEvidence)
          ? buildEvidenceArtifacts({
              argumentId: m.id,
              addedByUserId: m.authorId || 'unknown',
              createdAt: m.createdAt,
              attachments: m.attachedEvidence,
            })
          : [],
      })),
      nowMs: now,
    });
    const evidenceDebtSummary = getRoomEvidenceDebtSummary(debate.id, evidenceDebts);

    const cleanedTitle = cleanTitleForDedupe(debate.title || '');
    const canonicalConversationKey = deriveCanonicalConversationKey({
      debate,
      rootArgumentBody: stats.rootBody,
    });

    const hasNoRebuttal = stats.moveCount >= 1 && stats.rebuttalCount === 0;
    const latestActivityMs = safeMs(debate.updatedAt) || safeMs(stats.latestCreatedAt) || safeMs(debate.createdAt);
    const latestActivityAgeMs = Math.max(0, now - latestActivityMs);
    // INTEL-001 (#900) — engagement-lane dodge-chain hits. Present ONLY when the
    // gallery load fetched active move_marks (gated on the move_marks flag);
    // absent => the heat term is 0 => heat byte-identical. Deduped node count
    // (never a sum, never a person) neutralises branch inflation at the feed.
    const unaddressedForDebate = input.unaddressedMoveIdsByDebateId?.[debate.id];
    const dodgeChainHits =
      unaddressedForDebate && unaddressedForDebate.length > 0
        ? deriveDodgeChains({
            unaddressedMoveIds: unaddressedForDebate,
            nodes: messages.map((m) => ({ id: m.id, parentId: m.parentId })),
          }).unaddressedChainNodeCount
        : undefined;
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
      dodgeChainHits,
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
      // EV-003 — resolution-aware source-trail-fight routing.
      openEvidenceDebtCount: evidenceDebtSummary.openCount,
      totalEvidenceDebtCount: evidenceDebtSummary.totalCount,
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
        ? LATEST_AUTHOR_LABEL.you
        : stats.latestAuthorId
          ? LATEST_AUTHOR_LABEL.other
          : LATEST_AUTHOR_LABEL.unknown,

      createdAt: debate.createdAt,
      updatedAt: debate.updatedAt,

      moveCount: stats.moveCount,
      rebuttalCount: stats.rebuttalCount,
      // UX-PR-G (#920) P1-10 — DISPLAY count: a supplied override wins (future
      // caller), else the derived distinct-poster count. NOT the heat term.
      participantCount:
        typeof participantCountByDebateId[debate.id] === 'number'
          ? participantCountByDebateId[debate.id]
          : distinctAuthorCount,

      hasNoRebuttal,
      hasUserJoined: joinedSet.has(debate.id) || debate.myParticipantSide != null,
      openStatus: debate.status,
      // QOL-039 — coerce to the typed union; pre-migration rows default
      // to 'public' (today's behavior). The §6.4 routing rule in
      // `classifyCardToSection` reads this column.
      visibility: debate.visibility === 'private' ? 'private' : 'public',

      bucket,
      heatLevel: heat.level,
      temperament,

      issueFrame: stats.issueFrame,
      dominantAxis: stats.dominantAxis,
      sourceChainRisk: stats.sourceChainRisk,
      evidentiaryRisk: stats.evidentiaryRisk,
      amplificationRisk: stats.amplificationRisk,
      platformSupportWarning: stats.platformSupportWarning,

      evidenceDebtSummary,

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

// ── GAL-002 — Gallery entry-hint deriver ─────────────────────

/**
 * GAL-002 — Verb-phrase table. The 4 lifecycle-overlap hints read their
 * verb from RULE-003 (`getLifecycleUx(state).label`) so RULE-003 is the
 * single source of plain-language truth. The 3 gallery-meta hints use
 * short, plain, ban-list-clean constants — the ONLY new authored strings
 * GAL-002 introduces.
 *
 * Each entry is ≤ 8 words by inspection (RULE-003 labels are ≤ 32 chars
 * and the meta phrases are 2-4 words). A defensive word-cap pass below
 * truncates anything that drifts past 8 words at runtime, so a future
 * RULE-003 label change cannot break the contract silently.
 */
const META_VERB_PHRASES: Readonly<Record<'be_first_rebuttal' | 'watch_first' | 'join_when_ready', string>> = Object.freeze({
  be_first_rebuttal: 'Be the first rebuttal',
  watch_first: 'Watch first',
  join_when_ready: 'Join when ready',
});

/**
 * GAL-002 — Helper-line table for the 3 gallery-meta hints. The remaining
 * 4 hints pull their helper from RULE-003. Plain-language, no verdict /
 * popularity / engagement / person-attribution tokens.
 */
const META_HELPER_LINES: Readonly<Record<'be_first_rebuttal' | 'watch_first' | 'join_when_ready', string>> = Object.freeze({
  be_first_rebuttal: 'No reply yet — your move lands first.',
  watch_first: 'Quiet room — get a feel before posting.',
  join_when_ready: 'Open room — observe or step in.',
});

/**
 * GAL-002 — Preset routing table. Maps each hint to an existing
 * `QuickActionLabel` (COMPOSER-001) or `null` for the gallery-only
 * meta-actions that should NOT open the composer.
 */
const HINT_PRESET: Readonly<Record<GalleryEntryHintCode, QuickActionLabel | null>> = Object.freeze({
  be_first_rebuttal: 'reply',
  ask_source: 'source',
  challenge_mechanism: 'challenge',
  narrow: 'narrow',
  synthesize: 'synthesize',
  watch_first: null,
  join_when_ready: null,
});

/**
 * GAL-002 — Dock-action routing table. Maps each hint to an existing
 * `TimelineNodeActionDockActionCode` (SC-004) or `null` when the
 * meta-action does not have a dock equivalent.
 */
const HINT_DOCK_ACTION: Readonly<Record<GalleryEntryHintCode, TimelineNodeActionDockActionCode | null>> = Object.freeze({
  be_first_rebuttal: 'reply',
  ask_source: 'ask_source',
  challenge_mechanism: 'challenge',
  narrow: 'narrow',
  synthesize: 'synthesize',
  watch_first: null,
  join_when_ready: null,
});

/**
 * GAL-002 — Word cap. Trims a verb phrase to ≤ 8 whitespace-separated
 * tokens. RULE-003 labels do not exceed this today; the cap is a
 * forward-compatibility guard against future copy changes.
 */
function capVerbPhraseToEightWords(phrase: string): string {
  const tokens = phrase.split(/\s+/).filter(Boolean);
  if (tokens.length <= 8) return phrase;
  return tokens.slice(0, 8).join(' ');
}

/**
 * GAL-002 — Builds the verb phrase for a given hint code. Lifecycle-overlap
 * codes read RULE-003's `label`; meta codes read the local constant table.
 */
function verbPhraseForCode(code: GalleryEntryHintCode): string {
  switch (code) {
    case 'be_first_rebuttal':
      return META_VERB_PHRASES.be_first_rebuttal;
    case 'watch_first':
      return META_VERB_PHRASES.watch_first;
    case 'join_when_ready':
      return META_VERB_PHRASES.join_when_ready;
    case 'ask_source':
      return capVerbPhraseToEightWords(getLifecycleUx('source_requested').label);
    case 'challenge_mechanism':
      // Reuse the ST-002 spelling so both models stay in lockstep without
      // inventing a new phrase. ST-002's `challenge_mechanism` label is
      // 'Challenge mechanism' (2 words) — see suggestedMovesModel.ts.
      return 'Challenge mechanism';
    case 'narrow':
      return capVerbPhraseToEightWords(getLifecycleUx('narrowed').label);
    case 'synthesize':
      return capVerbPhraseToEightWords(getLifecycleUx('synthesis_ready').label);
  }
}

/**
 * GAL-002 — Helper line for a given hint code. Meta codes use the local
 * table; lifecycle-overlap codes read the matching RULE-003 helper.
 *
 * For the lifecycle-derived path we also honour the card's actual lifecycle
 * state when the hint code derives from it — e.g. an `ask_source` hint on
 * a card with `quote_requested` lifecycle uses the `quote_requested`
 * helper line so the surface copy stays specific to what the cluster
 * actually shows.
 */
function helperLineForHint(
  code: GalleryEntryHintCode,
  resolvedLifecycle: PointLifecycleState | null,
): string {
  switch (code) {
    case 'be_first_rebuttal':
      return META_HELPER_LINES.be_first_rebuttal;
    case 'watch_first':
      if (resolvedLifecycle === 'archived_or_resolved') {
        return getLifecycleUx('archived_or_resolved').helperLine;
      }
      return META_HELPER_LINES.watch_first;
    case 'join_when_ready':
      return META_HELPER_LINES.join_when_ready;
    case 'ask_source':
      if (resolvedLifecycle === 'quote_requested') {
        return getLifecycleUx('quote_requested').helperLine;
      }
      return getLifecycleUx('source_requested').helperLine;
    case 'challenge_mechanism':
      return getLifecycleUx('sourced').helperLine;
    case 'narrow':
      if (resolvedLifecycle === 'exhausted') {
        return getLifecycleUx('exhausted').helperLine;
      }
      if (resolvedLifecycle === 'branch_recommended') {
        return getLifecycleUx('branch_recommended').helperLine;
      }
      if (resolvedLifecycle === 'rebutted') {
        return getLifecycleUx('rebutted').helperLine;
      }
      return getLifecycleUx('narrowed').helperLine;
    case 'synthesize':
      if (resolvedLifecycle === 'conceded') return getLifecycleUx('conceded').helperLine;
      if (resolvedLifecycle === 'confirmed') return getLifecycleUx('confirmed').helperLine;
      if (resolvedLifecycle === 'narrowed') return getLifecycleUx('narrowed').helperLine;
      if (resolvedLifecycle === 'ignored_by_both') return getLifecycleUx('ignored_by_both').helperLine;
      return getLifecycleUx('synthesis_ready').helperLine;
  }
}

/**
 * GAL-002 — Lifecycle → hint mapping. Returns the code + `activate` value
 * for a given lifecycle state. The same table also pins each row's
 * `activate` choice so the existing Stage 6.4 behaviour is preserved for
 * the bucket-fallback path below.
 */
interface HintChoice {
  code: GalleryEntryHintCode;
  activate: GalleryEntryHint['activate'];
}

function lifecycleToHint(state: PointLifecycleState, hasNoRebuttal: boolean): HintChoice {
  switch (state) {
    case 'open':
      return hasNoRebuttal
        ? { code: 'be_first_rebuttal', activate: 'root' }
        : { code: 'watch_first', activate: 'latest' };
    case 'answered':
      return { code: 'watch_first', activate: 'latest' };
    case 'rebutted':
      return { code: 'narrow', activate: 'latest' };
    case 'clarified':
      return { code: 'watch_first', activate: 'latest' };
    case 'sourced':
      return { code: 'challenge_mechanism', activate: 'latest' };
    case 'quote_requested':
      return { code: 'ask_source', activate: 'first_open_challenge' };
    case 'source_requested':
      return { code: 'ask_source', activate: 'first_open_challenge' };
    case 'narrowed':
      return { code: 'synthesize', activate: 'latest' };
    case 'conceded':
      return { code: 'synthesize', activate: 'latest' };
    case 'confirmed':
      return { code: 'synthesize', activate: 'latest' };
    case 'synthesis_ready':
      return { code: 'synthesize', activate: 'latest' };
    case 'moved_on_by_affirmative':
      return { code: 'join_when_ready', activate: 'latest' };
    case 'moved_on_by_negative':
      return { code: 'join_when_ready', activate: 'latest' };
    case 'ignored_by_affirmative':
      return { code: 'join_when_ready', activate: 'latest' };
    case 'ignored_by_negative':
      return { code: 'join_when_ready', activate: 'latest' };
    case 'ignored_by_both':
      return { code: 'synthesize', activate: 'latest' };
    case 'exhausted':
      return { code: 'narrow', activate: 'latest' };
    case 'branch_recommended':
      return { code: 'narrow', activate: 'latest' };
    case 'archived_or_resolved':
      return { code: 'watch_first', activate: 'latest' };
  }
}

/**
 * GAL-002 — Bucket → hint fallback. Preserves Stage 6.4 `activate` choices
 * verbatim so existing seamless-entry tests pass without per-test rewrites.
 */
function bucketToHint(bucket: ConversationBucket, hasNoRebuttal: boolean): HintChoice {
  if (hasNoRebuttal) return { code: 'be_first_rebuttal', activate: 'root' };
  switch (bucket) {
    case 'needs_rebuttal':
      return { code: 'be_first_rebuttal', activate: 'root' };
    case 'source_chain_fight':
      return { code: 'ask_source', activate: 'first_open_challenge' };
    case 'evidence_fight':
      return { code: 'challenge_mechanism', activate: 'first_open_challenge' };
    case 'definition_scope_fight':
      return { code: 'narrow', activate: 'latest' };
    case 'unresolved_deep_chain':
      return { code: 'narrow', activate: 'latest' };
    case 'hot_now':
      return { code: 'narrow', activate: 'latest' };
    case 'gaining_heat':
      return { code: 'watch_first', activate: 'latest' };
    case 'pedantic_plain':
      return { code: 'watch_first', activate: 'root' };
    case 'resolved_or_synthesized':
      return { code: 'watch_first', activate: 'latest' };
    case 'my_rooms':
      return { code: 'join_when_ready', activate: 'latest' };
    case 'all_open':
    default:
      return { code: 'watch_first', activate: 'latest' };
  }
}

/**
 * GAL-002 — Apply the SW-002 `entryOpportunity` tie-breaker. Only promotes
 * `watch_first` to a more actionable hint when the activity profile
 * supports it. Never overrides a non-`watch_first` decision (lifecycle
 * and bucket dispatches stay primary).
 */
function applyEntryOpportunity(
  choice: HintChoice,
  entryOpportunity: EntryOpportunity | null | undefined,
): HintChoice {
  if (choice.code !== 'watch_first') return choice;
  if (!entryOpportunity) return choice;
  if (entryOpportunity === 'deep_existing_clash') {
    return { code: 'narrow', activate: 'latest' };
  }
  if (entryOpportunity === 'mid_thread_join') {
    return { code: 'join_when_ready', activate: 'latest' };
  }
  // 'easy_first_move' — keep watch_first; the existing default for quiet
  // rooms is the correct first move.
  return choice;
}

/**
 * GAL-002 — Decide which message to activate when the user opens a card,
 * plus a typed verb / helper / preset / dock payload. Pure, deterministic,
 * uncached. Replaces Stage 6.4 `deriveConversationEntryHint`.
 *
 * Priority (first match wins):
 *   1. Empty-thread / no-rebuttal short-circuit → `be_first_rebuttal`.
 *   2. `openStatus !== 'open'` override → `watch_first` (the cluster is
 *      closed/draft/locked; reading is the only safe first move).
 *   3. `rootClusterLifecycleState` present → dispatch via lifecycle table.
 *   4. Bucket fallback (Stage 6.4 parity behaviour).
 *   5. SW-002 `entryOpportunity` tie-breaker applied last to promote
 *      `watch_first` into `narrow` / `join_when_ready` where appropriate.
 *
 * Doctrine guards encoded:
 *   - Never reads `moveCount` / `rebuttalCount` / `participantCount` /
 *     `heatScore` / `heatLevel` as primary signals. `heatLevel` is not
 *     consulted at all by the deriver — heat is descriptive activity, not
 *     a hint signal.
 *   - Never returns a verdict / amplification / person-attribution string.
 *   - Per-call recomputation. No module-level cache, no memoisation.
 */
export function deriveGalleryEntryHint(card: ConversationGalleryCard): GalleryEntryHint {
  const resolvedLifecycle: PointLifecycleState | null =
    card.rootClusterLifecycleState != null ? card.rootClusterLifecycleState : null;

  let choice: HintChoice;

  // 1. Empty-thread / no-rebuttal short-circuit.
  if (card.hasNoRebuttal === true || card.moveCount === 0) {
    choice = { code: 'be_first_rebuttal', activate: 'root' };
  } else if (card.openStatus !== 'open') {
    // 2. Archived / locked / draft override. Reading is the only safe move.
    choice = { code: 'watch_first', activate: 'latest' };
  } else if (resolvedLifecycle != null) {
    // 3. Lifecycle-primary dispatch.
    choice = lifecycleToHint(resolvedLifecycle, card.hasNoRebuttal);
  } else {
    // 4. Bucket-fallback (Stage 6.4 parity).
    choice = bucketToHint(card.bucket, card.hasNoRebuttal);
  }

  // 5. SW-002 tie-breaker.
  choice = applyEntryOpportunity(choice, card.entryOpportunity);

  const verbPhrase = verbPhraseForCode(choice.code);
  const helperLine = helperLineForHint(choice.code, resolvedLifecycle);

  return {
    activate: choice.activate,
    code: choice.code,
    verbPhrase,
    helperLine,
    presetKey: HINT_PRESET[choice.code],
    dockAction: HINT_DOCK_ACTION[choice.code],
  };
}

// ── End GAL-002 region ───────────────────────────────────────

// ── HOME-001 (#874) — your-turn projection ───────────────────
//
// A pure, deterministic projection over the already-built gallery cards that
// answers one question: which joined disputes are waiting on the viewer, and
// in what order should they be surfaced on the "Your table" home strip.
//
// Doctrine guards (cdiscourse-doctrine §1-§3): the projection reads ONLY
// structural turn-state / recency / unread signals. It never reads heat,
// temperament, amplification, engagement, view counts, or follower counts, and
// it never surfaces a standing / band / winner / verdict. Fixture exclusion
// (bot / corpus / reseed rooms) is applied by the home model layer via the
// `fixtureDebateIds` option, keyed by raw title tag — never by popularity.

/**
 * HOME-001 — true when a card is a joined, answerable dispute whose latest
 * non-deleted move was posted by a known OTHER voice (not the viewer, not an
 * unattributable author). This is the "waiting on me" predicate.
 *
 * Requires (all four):
 *  - `hasUserJoined === true`   — the viewer is a participant (mySide seam at
 *    the card builder already folds `myParticipantSide != null` into this).
 *  - `openStatus === 'open'`    — answerable (not draft / locked / archived).
 *  - `moveCount > 0`            — there is at least one move to be waiting on.
 *  - `latestPostAuthor === LATEST_AUTHOR_LABEL.other` — the latest non-deleted
 *    move author is a known account that is not the viewer. `'You'` (viewer
 *    authored latest) and `'Unknown'` (no attributable author) both return
 *    false, so the viewer can never be "waiting on" themselves or a null author.
 */
export function isWaitingOnViewer(card: ConversationGalleryCard): boolean {
  return (
    card.hasUserJoined === true &&
    card.openStatus === 'open' &&
    card.moveCount > 0 &&
    card.latestPostAuthor === LATEST_AUTHOR_LABEL.other
  );
}

/**
 * HOME-001 — deterministic rank for each entry-hint code used as the PRIMARY
 * your-turn sort key. Lower rank = more actionable = surfaced first. The order
 * mirrors "how directly does this awaited move ask the viewer to answer": a
 * first rebuttal or a mechanism/source challenge is the most answerable; a
 * read-only `watch_first` is the least. This is a structural actionability
 * ordering, NOT a heat / popularity ordering (doctrine §2/§3).
 */
export const YOUR_TURN_HINT_RANK: Readonly<Record<GalleryEntryHintCode, number>> =
  Object.freeze({
    be_first_rebuttal: 0,
    challenge_mechanism: 1,
    ask_source: 2,
    narrow: 3,
    synthesize: 4,
    join_when_ready: 5,
    watch_first: 6,
  });

export interface DeriveYourTurnOptions {
  /**
   * Set of debateIds that carry an unread notification for the viewer. Pure
   * input (built by the home model from the loaded notification list). A card
   * whose `debateId` is in this set sorts ahead of an otherwise-equal card.
   */
  unreadDebateIds?: ReadonlySet<string>;
  /**
   * debateIds whose RAW title matches a bot / corpus / reseed fixture tag.
   * Cards in this set are excluded for a non-admin viewer. Built from the raw
   * `debate.title` (NOT the already-cleaned `card.title`) — see the home model
   * `collectFixtureDebateIds`. Ignored when `isAdminViewer` is true.
   */
  fixtureDebateIds?: ReadonlySet<string>;
  /** Admins keep fixture rooms visible (AC5). Non-admins get the filtered set. */
  isAdminViewer?: boolean;
}

export interface YourTurnItem {
  card: ConversationGalleryCard;
  /** The pre-activation hint the room shell consumes on entry (J2 resume). */
  entryHint: GalleryEntryHint;
  hasUnread: boolean;
}

/**
 * HOME-001 — build the ordered your-turn strip.
 *
 * Steps:
 *  1. Filter to `isWaitingOnViewer`.
 *  2. Apply fixture exclusion (unless `isAdminViewer`): drop any card whose
 *     `debateId` is in `fixtureDebateIds`.
 *  3. Rank deterministically by the tuple
 *       [ YOUR_TURN_HINT_RANK[entryHint.code] asc,
 *         hasUnread ? 0 : 1 asc,
 *         -latestActivityMs (recency desc),
 *         debateId asc (total-order tie-break) ].
 *     Same input array => identical output order.
 *
 * Pure and side-effect-free: does not mutate the input array.
 */
export function deriveYourTurn(
  cards: ConversationGalleryCard[],
  opts?: DeriveYourTurnOptions,
): YourTurnItem[] {
  const unread = opts?.unreadDebateIds;
  const fixtures = opts?.fixtureDebateIds;
  const isAdmin = opts?.isAdminViewer === true;

  const items: YourTurnItem[] = [];
  for (const card of cards) {
    if (!isWaitingOnViewer(card)) continue;
    if (!isAdmin && fixtures !== undefined && fixtures.has(card.debateId)) continue;
    items.push({
      card,
      entryHint: deriveGalleryEntryHint(card),
      hasUnread: unread !== undefined && unread.has(card.debateId),
    });
  }

  return items.sort((a, b) => {
    const rankA = YOUR_TURN_HINT_RANK[a.entryHint.code];
    const rankB = YOUR_TURN_HINT_RANK[b.entryHint.code];
    if (rankA !== rankB) return rankA - rankB;

    const unreadA = a.hasUnread ? 0 : 1;
    const unreadB = b.hasUnread ? 0 : 1;
    if (unreadA !== unreadB) return unreadA - unreadB;

    const recencyA = a.card.sortKeys.latestActivityMs;
    const recencyB = b.card.sortKeys.latestActivityMs;
    if (recencyA !== recencyB) return recencyB - recencyA;

    // Total-order tie-break so the ordering is fully deterministic.
    if (a.card.debateId < b.card.debateId) return -1;
    if (a.card.debateId > b.card.debateId) return 1;
    return 0;
  });
}

// ── End HOME-001 region ──────────────────────────────────────

// ── GAL-001 — Play-lane grouping ─────────────────────────────
//
// 10 play lanes describe the kind of move a user wants to make. Lane
// derivation is deterministic — each card maps to exactly one lane via
// the priority chain in `classifyCardToSection`. The priority order is
// documented in `docs/designs/GAL-001.md` §"Deterministic grouping".
//
// All copy (label / helperLine / emptyCopy) lives in
// `src/features/arguments/gameCopy.ts` (`GALLERY_SECTION_DEFINITIONS`) so
// the screen and tests share one source of truth.

/**
 * Frozen scan-flow priority order. A returning user sees their rooms
 * first, then the lowest-friction first-move opportunities, then
 * progressively heavier engagement.
 */
export const SECTION_ORDER: ReadonlyArray<ConversationGallerySection> = Object.freeze([
  'my_rooms',
  'needs_rebuttal',
  'jump_in',
  'source_trail',
  'evidence_needed',
  'definition_fights',
  'logic_traps',
  'tangents_branches',
  'almost_synthesis',
  'quiet_beginner_rooms',
] as const);

/** Re-export the copy catalogue so screens and tests use one symbol. */
export { GALLERY_SECTION_DEFINITIONS } from '../arguments/gameCopy';
export type { GallerySectionDefinition } from '../arguments/gameCopy';

/**
 * Returns the copy definition for a given lane id. Throws on a code
 * that drifts from the union — caught at typecheck time by the
 * exhaustive-switch tests in `__tests__/galleryLaneGrouping.test.ts`.
 */
function getSectionDefinition(id: ConversationGallerySection): GallerySectionDefinition {
  const def = GALLERY_SECTION_DEFINITIONS.find((d) => d.id === id);
  if (!def) {
    // Should be unreachable — every union member has an entry per
    // `gallerySectionCopy.test.ts` totality test.
    throw new Error(`Missing GALLERY_SECTION_DEFINITIONS entry for ${id}`);
  }
  return def;
}

/**
 * Group cards into GAL-001 play lanes. Returns ordered groups (one
 * per non-empty lane) carrying the label, helperLine and card list.
 * Each card appears in AT MOST one group.
 */
export interface GallerySectionGroup {
  id: ConversationGallerySection;
  label: string;
  /** GAL-001 — secondary sub-heading authored alongside the label. */
  helperLine: string;
  cards: ConversationGalleryCard[];
}

/**
 * Deterministic lane derivation. Pure, side-effect-free. Each card maps
 * to exactly one lane via the priority chain below. See
 * `docs/designs/GAL-001.md` §"Deterministic grouping" for the full table
 * and the doctrine guards encoded in each branch.
 *
 * Inputs read from the card (all structural / activity / lifecycle):
 *   - `hasUserJoined`              — joined-room override (priority 1)
 *   - `hasNoRebuttal`              — first-rebuttal short-circuit (priority 2)
 *   - `rootClusterLifecycleState`  — LIFE-001 lifecycle (priorities 3-5)
 *   - `bucket`                     — Stage 6.3 bucket (priorities 6-10)
 *   - `heatLevel`                  — overheated fallback (priority 11)
 *   - `entryOpportunity`           — SW-002 tie-breaker (priorities 12-13)
 *
 * None of these signals reads popularity, engagement, virality, view
 * count, follower count, or vote count (doctrine §3).
 */
export function classifyCardToSection(card: ConversationGalleryCard): ConversationGallerySection {
  // 1. Joined-room override — user's own rooms always come first.
  if (card.hasUserJoined) return 'my_rooms';

  // QOL-039 §6.4 — A private room the caller can read (RLS returned it)
  // is by definition a participant's own room. It must NEVER appear in
  // the public-discovery lanes — only in "My rooms". This is belt-and-
  // suspenders: RLS already withholds private rooms from non-participants,
  // and the `hasUserJoined` check above already covers the most common
  // case; this rule covers the seam (a participant's `hasUserJoined` is
  // sometimes derived from a participant join that has not yet propagated
  // into `joinedDebateIds`). Defaulting private cards to 'my_rooms' is
  // safe — by RLS, only participants and mods can see them.
  if (card.visibility === 'private') return 'my_rooms';

  // 2. No-rebuttal short-circuit — lowest-friction first move.
  if (card.hasNoRebuttal) return 'needs_rebuttal';

  // 3-5. Lifecycle-primary routing (when present).
  const lc: PointLifecycleState | null = card.rootClusterLifecycleState ?? null;
  if (
    lc === 'synthesis_ready'
    || lc === 'narrowed'
    || lc === 'conceded'
    || lc === 'confirmed'
  ) {
    return 'almost_synthesis';
  }
  if (lc === 'exhausted') return 'logic_traps';
  if (lc === 'branch_recommended') return 'tangents_branches';

  // 6-10. Bucket-derived routing (Stage 6.4 parity, expanded).
  if (card.bucket === 'source_chain_fight') return 'source_trail';
  if (card.bucket === 'evidence_fight') return 'evidence_needed';
  if (card.bucket === 'definition_scope_fight') return 'definition_fights';
  if (card.bucket === 'unresolved_deep_chain') return 'logic_traps';
  if (card.bucket === 'hot_now' || card.bucket === 'gaining_heat') return 'jump_in';

  // 11. Heat-overheated fallback — overheated is still active back-and-forth.
  if (card.heatLevel === 'overheated') return 'jump_in';

  // 12-13. SW-002 entryOpportunity tie-breakers for mid-thread cards.
  if (card.entryOpportunity === 'deep_existing_clash') return 'logic_traps';
  if (card.entryOpportunity === 'mid_thread_join') return 'jump_in';

  // 14. Default fallback — quiet / plain rooms.
  return 'quiet_beginner_rooms';
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
    const def = getSectionDefinition(id);
    groups.push({ id, label: def.label, helperLine: def.helperLine, cards: list });
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
