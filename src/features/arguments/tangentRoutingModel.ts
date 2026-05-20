/**
 * BR-003 — Tangent / outer-orbit routing (structural redirect, no person
 * labels).
 *
 * A deterministic, pure-TS model that, given a composer draft + its parent
 * + the parent's already-derived LIFE-001 / META-001 structures + the
 * draft's manual tags + (optionally) recent-thread context, returns a
 * `TangentRoutingAssessment` — a `RedirectRisk` (`none | possible |
 * strong`), the dominant structural `RedirectReason`, and a
 * `RedirectSuggestedAction`. The assessment surfaces as ONE advisory
 * inside RULE-004's existing `PreSendReviewSheet`; the user can always
 * continue — BR-003 adds ZERO blocking rules.
 *
 * Doctrine (cdiscourse-doctrine — see BR-003 design §0 / §12):
 *  - §1 — score never blocks posting. `assessTangentRisk` returns NO
 *    block. `tangent_redirect` is a `soft` advisory; "Post anyway" is
 *    always available unless an EXISTING Constitution structural block is
 *    already hit. BR-003 implements no block of its own.
 *  - §1 / Stage 6.2 — no keyword-only gating. `assessTangentRisk` reads
 *    typed structural fields ONLY — argument type, RULE-005 channel,
 *    qualifier tag codes, the parent's already-derived META-001
 *    `AutoMetadataEntry` codes, the parent's LIFE-001 lifecycle axis, and
 *    BR-001's `RailBranchKind` topology. It NEVER inspects raw body text
 *    for keyword matching.
 *  - §2 / §3 — heat / popularity are not signals. The model never reads a
 *    strength band, a heat value, a reply count, or any engagement metric.
 *  - §4 / §7 — no AI call. Deterministic pure TS. No Anthropic / xAI /
 *    client AI / Edge Function. The semantic AI tangent classifier is
 *    explicitly RULE-006.
 *  - §5 — pure models. This file imports TYPES + the frozen copy table
 *    only. No React, no Supabase, no network, no mutation, no async.
 *  - §8 — soft-delete only. Routing a move to a side branch posts it AS A
 *    BRANCH (collapsed-capable, fully accessible). Mainline demotion is
 *    reversible. No `is_deleted` write, no row removal.
 *  - §9 — plain language. Every produced string is read from
 *    `TANGENT_ROUTING_COPY` in `gameCopy.ts`. No snake_case in any
 *    user-facing string; no verdict / person token. Enforced by
 *    `__tests__/tangentRoutingNoPersonLabel.test.ts`.
 *
 * "Structural redirect, no person labels": every `RedirectReason`
 * describes the MOVE's structural relationship to its parent — never the
 * person. The plain-language copy says "this move" / "the thread", never
 * "you are dodging / evading / off-topic-as-a-person".
 */
import type { ComposerDraft } from './composerState';
import type { ArgumentRow } from './types';
import type { RailBranchKind } from './railSegmentModel';
import type { MoveChannel } from './channelModel';
import type { QuickActionLabel } from './quickActionPresets';
import type {
  PointLifecycleSnapshot,
  PointLifecycleClusterSummary,
} from '../lifecycle';
import type { MoveLinkageRecord } from '../metadata';
import { TANGENT_ROUTING_COPY } from './gameCopy';

// ── Types ──────────────────────────────────────────────────────

/** BR-003 — how strongly the draft reads as a redirect away from its parent. */
export type RedirectRisk = 'none' | 'possible' | 'strong';

/** Frozen list of every risk level. Tests iterate this. */
export const ALL_REDIRECT_RISKS: ReadonlyArray<RedirectRisk> = Object.freeze([
  'none',
  'possible',
  'strong',
]);

/**
 * BR-003 — the STRUCTURAL reason a redirect risk was raised. Every value
 * describes the MOVE's relationship to its parent — never the person.
 * The card's §1 verbatim list.
 */
export type RedirectReason =
  | 'introduces_new_axis' // draft acts on a different disagreement axis
  | 'no_signal_about_parent' // draft carries no structural link to the parent
  | 'mode_demands_response' // the channel/lifecycle expects a direct reply, draft is not one
  | 'repeated_off_path' // this side has gone off-path >= threshold times recently
  | 'user_marked_tangent'; // the author themselves tagged the draft a tangent

/** Frozen list of every reason. Tests iterate this. */
export const ALL_REDIRECT_REASONS: ReadonlyArray<RedirectReason> = Object.freeze([
  'introduces_new_axis',
  'no_signal_about_parent',
  'mode_demands_response',
  'repeated_off_path',
  'user_marked_tangent',
]);

/**
 * BR-003 — what BR-003 SUGGESTS the user do. The card's §1 verbatim list.
 * `continue` = no friction; the others surface as a transformation in the
 * RULE-004 advisory card.
 */
export type RedirectSuggestedAction =
  | 'continue' // post on the mainline as-is — no advisory
  | 'send_to_side_branch' // post as a branch root off the parent (carry: §5.4)
  | 'ask_clarifying_question' // re-aim the move as a clarification of the parent
  | 'branch_this'; // explicitly branch — the strongest redirect offer

/** The model's single output. */
export interface TangentRoutingAssessment {
  risk: RedirectRisk;
  /** The dominant reason. `null` only when `risk === 'none'`. */
  reason: RedirectReason | null;
  suggestedAction: RedirectSuggestedAction;
}

/** Parent's already-derived lifecycle + metadata. Reused shape style of
 *  RULE-004's `PreSendLifecycleContext`. */
export interface TangentLifecycleContext {
  parentSnapshot: PointLifecycleSnapshot | null;
  parentClusterSummary: PointLifecycleClusterSummary | null;
  parentLinkage: MoveLinkageRecord | null;
}

export interface TangentThreadMove {
  messageId: string;
  /** The move's author side. */
  side: 'affirmative' | 'negative' | null;
  /**
   * The move's BR-001 topology classification of its INBOUND edge.
   * `kink_start` / `tangent` / `kink_end` count as off-path; `main` /
   * `detached` do not. Computed upstream by `branchTopologyModel`.
   */
  inboundBranchKind: RailBranchKind;
}

/** Thread context for the deterministic repeated-off-path counter (§4). */
export interface TangentThreadContext {
  /**
   * The side the draft's author is on. Used to count THIS SIDE's recent
   * off-path moves — never the other side's, never the person.
   */
  authorSide: 'affirmative' | 'negative' | null;
  /**
   * Chronologically-ordered recent moves on the thread the draft replies
   * into. Each entry is a tiny typed projection — BR-003 reads only these
   * fields, never the body text. The caller bounds this to a recent slice
   * (§7 #8); `countRecentTangentMoves` is pure over its input.
   */
  recentMoves: ReadonlyArray<TangentThreadMove>;
}

export interface AssessTangentRiskInput {
  /** The composer draft being assessed (composerState.ComposerDraft). */
  draft: ComposerDraft;
  /** The parent argument row, or null for a root move. */
  parent: ArgumentRow | null;
  /**
   * The parent's already-derived LIFE-001 + META-001 structures. All null
   * for a root draft. BR-003 NEVER re-derives these — it reads what
   * LIFE-001 / META-001 already computed for the posted parent.
   */
  lifecycle: TangentLifecycleContext;
  /** The manual tags the AUTHOR applied to this draft (META-001 codes). */
  manualTags: ReadonlyArray<string>;
  /**
   * Thread context for the `repeated_off_path` counter. Optional — when
   * omitted (e.g. a root draft, or a caller without the timeline map) the
   * repeated-off-path reason simply never fires. See §4.
   */
  tangentContext?: TangentThreadContext;
  /**
   * The draft's RULE-005 channel suggestion / selected channel, or null.
   * Drives `mode_demands_response`. Read-only.
   */
  selectedChannel?: MoveChannel | null;
}

/**
 * BR-003 — the soft, reversible advisory surfaced on a side's NEXT move
 * when `repeated_off_path` has been hit. NEVER names the participant.
 */
export interface MainlineDemotionAdvisory {
  /** True when this side has gone off-path >= REPEATED_OFF_PATH_THRESHOLD. */
  active: boolean;
  /** Count of recent off-path moves by this side (for the copy). */
  offPathCount: number;
  /** Plain-language one-liner — read from gameCopy, never authored here.
   *  Describes the THREAD ("the main thread has drifted"), never the user. */
  plainLanguage: string;
  /**
   * The action that REVERSES the demotion: a direct confirm / narrow /
   * synthesize move on the mainline point. Surfaced so the user always has
   * an exit. The card's §3 "reversible by a confirm/narrow/synthesize".
   */
  reversalActions: ReadonlyArray<RedirectSuggestedAction>;
}

// ── Frozen tuning constants ────────────────────────────────────

/**
 * The number of recent off-path moves by a side at or above which
 * `repeated_off_path` fires and the mainline-demotion advisory activates.
 * The card's ">= 3 times in a thread". Frozen.
 */
export const REPEATED_OFF_PATH_THRESHOLD = 3;

// ── Internal typed-field vocabularies (no body keyword reads) ───

/**
 * Qualifier / manual-tag codes the AUTHOR applies to mark a draft as a
 * tangent / side-branch move. BR-001's `hasTangentLexicalCode` reads
 * `branch_this_off` / `tangent_or_joke`; META-001's manual-tag table adds
 * `tangent`. Typed codes only — never the body text.
 */
const TANGENT_TAG_CODES: ReadonlySet<string> = new Set([
  'branch_this_off',
  'tangent_or_joke',
  'tangent',
]);

/**
 * RULE-005 channels that mean the draft is a DIRECT engagement with the
 * parent — a reply, a challenge, a clarification, a concession, a
 * confirmation. A draft on one of these channels is the OPPOSITE of a
 * tangent; `mode_demands_response` cannot fire for it (§5.1 step 4).
 */
const DIRECT_REPLY_CHANNELS: ReadonlySet<MoveChannel> = new Set<MoveChannel>([
  'reply',
  'challenge',
  'clarify',
  'concede',
  'confirm',
]);

/**
 * RULE-005 channels that mean the draft is itself a direct, on-path move
 * that resolves or engages the parent's point — a confirm / narrow /
 * synthesize / concede / clarify. A draft on one of these fast-paths to
 * `risk: 'none'` (§5.1 step 1) — it cannot be a tangent.
 */
const DIRECT_RESOLVING_CHANNELS: ReadonlySet<MoveChannel> = new Set<MoveChannel>([
  'confirm',
  'narrow',
  'synthesize',
  'concede',
  'clarify',
]);

/**
 * RULE-005 channels that ENGAGE the parent — adding evidence, asking for a
 * source / quote, or any direct-reply channel. When the draft carries one
 * of these, `no_signal_about_parent` does NOT fire: the draft does connect
 * back to the parent (§5.1 step 5).
 */
const PARENT_ENGAGING_CHANNELS: ReadonlySet<MoveChannel> = new Set<MoveChannel>([
  'reply',
  'challenge',
  'clarify',
  'concede',
  'confirm',
  'narrow',
  'add_evidence',
  'ask_source',
  'ask_quote',
  'synthesize',
]);

// ── Internal derivation helpers ────────────────────────────────

function tagsHaveAny(
  tags: ReadonlyArray<string>,
  set: ReadonlySet<string>,
): boolean {
  for (const t of tags) {
    if (set.has(String(t).trim().toLowerCase())) return true;
  }
  return false;
}

/**
 * Does the draft (its manual tags OR its selected channel) declare it a
 * tangent / side-branch move? Typed read only — never the body text.
 */
function draftIsAuthorMarkedTangent(input: AssessTangentRiskInput): boolean {
  if (tagsHaveAny(input.manualTags, TANGENT_TAG_CODES)) return true;
  if (tagsHaveAny(input.draft.selectedTagCodes, TANGENT_TAG_CODES)) return true;
  if (input.selectedChannel === 'branch_tangent') return true;
  return false;
}

/**
 * META-001 — does the parent's already-derived metadata carry a given
 * auto-metadata code? Reads `MoveLinkageRecord.autoDerivedMetadata` only;
 * never re-derives. Returns false when no linkage is present (root draft,
 * or a parent posted before META-001 ran — §7 #4).
 */
function parentHasAutoMetadata(
  linkage: MoveLinkageRecord | null,
  code: string,
): boolean {
  if (!linkage) return false;
  for (const entry of linkage.autoDerivedMetadata) {
    if (entry.code === code) return true;
  }
  return false;
}

/**
 * Derives the draft's disagreement-axis family from TYPED fields only —
 * its `disagreementAxis` field. NEVER reads body text for keyword
 * matching (Stage 6.2 doctrine — design §10 risk). Returns null when the
 * draft has not declared an axis; a false negative is acceptable, a
 * keyword-based false positive is not.
 */
function draftAxisFamily(draft: ComposerDraft): string | null {
  const axis = draft.disagreementAxis;
  if (axis === null || axis === undefined) return null;
  return String(axis).trim().toLowerCase();
}

// ── assessTangentRisk ──────────────────────────────────────────

/**
 * Assesses how strongly a draft reads as a redirect away from its parent.
 * Pure. Deterministic. Idempotent. NO AI, NO network, NO mutation, NO
 * async.
 *
 * Derivation order (the first reason that fires at each tier wins; the
 * order encodes priority — an explicit user tag is honored first, a hard
 * structural axis mismatch / skipped-node mode demand is `strong`, the
 * softer META-001 / counter signals are `possible`):
 *  1. `risk: 'none'` fast paths — root draft (`parent === null`); or a
 *     direct/resolving move (`clarification_request` type, or a confirm /
 *     narrow / synthesize / concede / clarify channel).
 *  2. `user_marked_tangent` — a tangent tag OR the `branch_tangent`
 *     channel. `risk: 'possible'`, `send_to_side_branch`.
 *  3. `introduces_new_axis` — the parent has a non-null axis AND the draft
 *     declares a different axis. `risk: 'strong'`, `branch_this`.
 *  4. `mode_demands_response` — META-001 `participant_skipped_node` on the
 *     parent AND the draft is NOT a direct-reply channel. `risk: 'strong'`,
 *     `ask_clarifying_question`.
 *  5. `no_signal_about_parent` — META-001 `branch_suggested` on the parent
 *     AND the draft carries no parent-engaging channel. `risk: 'possible'`,
 *     `send_to_side_branch`.
 *  6. `repeated_off_path` — `tangentContext` present AND
 *     `countRecentTangentMoves >= REPEATED_OFF_PATH_THRESHOLD`.
 *     `risk: 'possible'`, `send_to_side_branch`.
 *  7. Default — `risk: 'none'`, `continue`.
 *
 * Reads ONLY typed structural fields: `draft.argumentType`,
 * `draft.disagreementAxis`, `draft.selectedTagCodes`, `manualTags`,
 * `selectedChannel`, `parent` presence, `lifecycle.parentSnapshot.axis`,
 * `lifecycle.parentLinkage.autoDerivedMetadata`,
 * `tangentContext.recentMoves[].inboundBranchKind` /`.side`.
 * NEVER reads: raw body text for keyword matching, strength bands, heat,
 * reply counts, engagement metrics.
 */
export function assessTangentRisk(
  input: AssessTangentRiskInput,
): TangentRoutingAssessment {
  const { draft, parent, lifecycle, selectedChannel } = input;

  // ── 1. risk: 'none' fast paths ────────────────────────────────
  // A root move cannot be a tangent of anything.
  if (parent === null) {
    return { risk: 'none', reason: null, suggestedAction: 'continue' };
  }
  // A clarification request, or a direct/resolving channel move, is the
  // OPPOSITE of a tangent — it engages the parent's point directly.
  if (draft.argumentType === 'clarification_request') {
    return { risk: 'none', reason: null, suggestedAction: 'continue' };
  }
  if (
    selectedChannel !== null &&
    selectedChannel !== undefined &&
    DIRECT_RESOLVING_CHANNELS.has(selectedChannel)
  ) {
    return { risk: 'none', reason: null, suggestedAction: 'continue' };
  }

  // ── 2. user_marked_tangent — the author tagged it a tangent. ──
  if (draftIsAuthorMarkedTangent(input)) {
    return {
      risk: 'possible',
      reason: 'user_marked_tangent',
      suggestedAction: 'send_to_side_branch',
    };
  }

  // ── 3. introduces_new_axis — a hard structural axis mismatch. ─
  const parentAxis = lifecycle.parentSnapshot?.axis ?? null;
  const draftAxis = draftAxisFamily(draft);
  if (
    parentAxis !== null &&
    draftAxis !== null &&
    draftAxis !== String(parentAxis).trim().toLowerCase()
  ) {
    return {
      risk: 'strong',
      reason: 'introduces_new_axis',
      suggestedAction: 'branch_this',
    };
  }

  // ── 4. mode_demands_response — the parent is a skipped node and
  // this draft is not a direct reply to it. ─────────────────────
  const parentSkipped = parentHasAutoMetadata(
    lifecycle.parentLinkage,
    'participant_skipped_node',
  );
  const draftIsDirectReply =
    selectedChannel !== null &&
    selectedChannel !== undefined &&
    DIRECT_REPLY_CHANNELS.has(selectedChannel);
  if (parentSkipped && !draftIsDirectReply) {
    return {
      risk: 'strong',
      reason: 'mode_demands_response',
      suggestedAction: 'ask_clarifying_question',
    };
  }

  // ── 5. no_signal_about_parent — META-001 already observed the
  // parent's cluster recommends a branch and this draft does not
  // engage the parent. ──────────────────────────────────────────
  const parentBranchSuggested = parentHasAutoMetadata(
    lifecycle.parentLinkage,
    'branch_suggested',
  );
  const draftEngagesParent =
    selectedChannel !== null &&
    selectedChannel !== undefined &&
    PARENT_ENGAGING_CHANNELS.has(selectedChannel);
  if (parentBranchSuggested && !draftEngagesParent) {
    return {
      risk: 'possible',
      reason: 'no_signal_about_parent',
      suggestedAction: 'send_to_side_branch',
    };
  }

  // ── 6. repeated_off_path — this side has drifted off-path
  // >= threshold times recently. ────────────────────────────────
  if (
    input.tangentContext !== undefined &&
    countRecentTangentMoves(input.tangentContext) >= REPEATED_OFF_PATH_THRESHOLD
  ) {
    return {
      risk: 'possible',
      reason: 'repeated_off_path',
      suggestedAction: 'send_to_side_branch',
    };
  }

  // ── 7. Default — no reason fired. ─────────────────────────────
  return { risk: 'none', reason: null, suggestedAction: 'continue' };
}

// ── countRecentTangentMoves ────────────────────────────────────

/**
 * Counts the recent off-path moves made by `context.authorSide`. Pure,
 * deterministic (§4):
 *  1. Take `context.recentMoves` — already chronologically ordered, already
 *     bounded to a recent window by the caller (§7 #8).
 *  2. Count moves where `move.side === context.authorSide` AND
 *     `move.inboundBranchKind` is one of `kink_start | tangent | kink_end`.
 *     `main` / `detached` do not count.
 *  3. Return the count.
 *
 * BR-001's `RailBranchKind` is the authoritative topology classification —
 * BR-003 reuses it, never re-derives. The counter never reads
 * who-is-right, never reads heat, never names a participant.
 */
export function countRecentTangentMoves(context: TangentThreadContext): number {
  const side = context.authorSide;
  let count = 0;
  for (const move of context.recentMoves) {
    if (move.side !== side) continue;
    const kind = move.inboundBranchKind;
    if (kind === 'kink_start' || kind === 'tangent' || kind === 'kink_end') {
      count += 1;
    }
  }
  return count;
}

// ── buildMainlineDemotionAdvisory ──────────────────────────────

/**
 * Builds the reversible, person-free mainline-demotion advisory (§4).
 * `active: true` when this side's recent off-path count is at or above
 * `REPEATED_OFF_PATH_THRESHOLD`. The `plainLanguage` describes the THREAD
 * ("The main thread has drifted"), never the participant. The
 * `reversalActions` always include a direct-reply action so the user has
 * an exit — a direct confirm / narrow / synthesize move drops the count
 * below threshold on the next assessment and the advisory clears with no
 * persisted flag (§7 #10).
 */
export function buildMainlineDemotionAdvisory(
  context: TangentThreadContext,
): MainlineDemotionAdvisory {
  const offPathCount = countRecentTangentMoves(context);
  return {
    active: offPathCount >= REPEATED_OFF_PATH_THRESHOLD,
    offPathCount,
    plainLanguage: TANGENT_ROUTING_COPY.demotion_advisory,
    reversalActions: Object.freeze(['ask_clarifying_question', 'continue']),
  };
}

// ── suggestedActionToQuickAction ───────────────────────────────

/**
 * Maps a `RedirectSuggestedAction` to an existing
 * `quickActionPresets.QuickActionLabel`, or null for `continue`. BR-003
 * adds NO new `QuickActionLabel` — it reuses RULE-004 / RULE-005's
 * vocabulary. `'branch'` and `'clarify'` are both already members of the
 * `QuickActionLabel` union.
 */
export function suggestedActionToQuickAction(
  a: RedirectSuggestedAction,
): QuickActionLabel | null {
  switch (a) {
    case 'continue':
      return null;
    case 'send_to_side_branch':
      return 'branch';
    case 'branch_this':
      return 'branch';
    case 'ask_clarifying_question':
      return 'clarify';
    default:
      // Defensive — unreachable for the typed union.
      return null;
  }
}

// ── Copy resolution ────────────────────────────────────────────

/**
 * Resolves the headline plain-language line for an assessment — the line
 * the `tangent_redirect` advisory shows inside the RULE-004 sheet.
 * `advisory_possible` for `risk: 'possible'`, `advisory_strong` for
 * `risk: 'strong'`. Returns the empty string for `risk: 'none'` (no
 * advisory is shown). Read from `TANGENT_ROUTING_COPY`; never authored
 * inline.
 */
export function tangentAdvisoryPlainLanguage(
  assessment: TangentRoutingAssessment,
): string {
  if (assessment.risk === 'strong') return TANGENT_ROUTING_COPY.advisory_strong;
  if (assessment.risk === 'possible') {
    return TANGENT_ROUTING_COPY.advisory_possible;
  }
  return '';
}

/**
 * Resolves the per-reason detail line for an assessment — available for a
 * future two-line advisory card. Returns the empty string when there is
 * no reason. Read from `TANGENT_ROUTING_COPY`; never authored inline.
 */
export function tangentReasonPlainLanguage(reason: RedirectReason | null): string {
  switch (reason) {
    case 'introduces_new_axis':
      return TANGENT_ROUTING_COPY.reason_introduces_new_axis;
    case 'no_signal_about_parent':
      return TANGENT_ROUTING_COPY.reason_no_signal_about_parent;
    case 'mode_demands_response':
      return TANGENT_ROUTING_COPY.reason_mode_demands_response;
    case 'repeated_off_path':
      return TANGENT_ROUTING_COPY.reason_repeated_off_path;
    case 'user_marked_tangent':
      return TANGENT_ROUTING_COPY.reason_user_marked_tangent;
    case null:
    default:
      return '';
  }
}

// ── Ban-list support ───────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/tangentRoutingNoPersonLabel.test.ts`.
 * NOT a content filter. Mirrors `_forbiddenPreSendTokens` /
 * `_forbiddenMetadataTokens` / `_forbiddenLifecycleTokens` so BR-003 copy
 * is held to the same bar: verdict tokens, amplification tokens, block
 * tokens, AND person-attribution tokens. "Structural redirect, no person
 * labels" — every produced string describes the move / the thread, never
 * the person.
 */
export function _forbiddenTangentTokens(): string[] {
  return [
    // Verdict tokens
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
    'bot',
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
    // Amplification tokens
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
    // Block / prevent tokens (an advisory must never block)
    'block',
    'prevent',
    'reject',
    'forbid',
    'disallow',
    'denied',
    // Person-attribution / punitive tokens — copy describes the move /
    // the thread, never the person.
    'dodge',
    'dodging',
    'evade',
    'evading',
    'evasion',
    'avoiding',
  ];
}
