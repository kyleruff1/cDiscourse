/**
 * RULE-005 — Structured argument channels (move-type field model).
 *
 * A "channel" is a thin, plain-language layer ABOVE the 8 Constitution
 * argument types and the 7 `ConversationMoveKind` navigator options. It
 * describes the STRUCTURAL PURPOSE of a composed move — "you are
 * challenging", "you are asking for a source", "you are conceding a
 * narrow point" — so the composer can (a) suggest the channel that fits
 * the draft + parent and (b) optionally reveal helper fields.
 *
 * Doctrine (cdiscourse-doctrine — see RULE-005 design §12):
 *  - §1 — a channel is NEVER a verdict. It labels what a move DOES, never
 *    whether it is right, popular, or strong. A channel suggestion is
 *    advisory; `ChannelSuggestion` has no blocking field — it cannot
 *    prevent a post. Only the Constitution engine blocks.
 *  - §2/§3 — `suggestChannelFromDraft` reads typed structural fields
 *    only (argument type, qualifier codes, the parent's lifecycle state).
 *    It never reads heat, strength bands, reply counts, or engagement.
 *  - §4/§7 — deterministic. No Anthropic / xAI / Edge Function call.
 *    RULE-006 owns AI channel detection.
 *  - §5 — pure TypeScript. This file imports TYPES only (plus the frozen
 *    copy tables from `gameCopy.ts`). No React, no Supabase, no network,
 *    no mutation, no async.
 *  - §9 — every user-facing string is read from `gameCopy.ts`; no label
 *    is authored here, no snake_case leaks to the user.
 *
 * Carry mechanism (design §3.2): the channel is a DRAFT-TIME ADVISORY
 * field. It does NOT persist in v1 — META-001's `ManualTagCode` vocabulary
 * is locked and `public.arguments` has no `channel` column. A posted
 * move's channel is re-derived at render time via
 * `deriveChannelForPostedMove`.
 */
import type { ArgumentType, ConstitutionRule } from '../../domain/constitution/types';
import type { PointLifecycleState } from '../lifecycle';
import type {
  PointLifecycleSnapshot,
  PointLifecycleClusterSummary,
} from '../lifecycle';
import type { MoveLinkageRecord } from '../metadata';
import type { DisagreementAxis } from '../../domain/constitution/types';
import type { MoveDraftPatch } from './conversationMoves';
import { resolveChallengeType } from './conversationMoves';
import {
  CHANNEL_LABEL_COPY,
  CHANNEL_PURPOSE_COPY,
  CHANNEL_RATIONALE_COPY,
} from './gameCopy';

// ── Types ──────────────────────────────────────────────────────

/** RULE-005 — the structural-purpose vocabulary for a composed move. */
export type MoveChannel =
  | 'reply'
  | 'challenge'
  | 'clarify'
  | 'ask_source'
  | 'ask_quote'
  | 'add_evidence'
  | 'narrow'
  | 'concede'
  | 'confirm'
  | 'synthesize'
  | 'branch_tangent'
  | 'meta_process'
  // Reserved — NOT emitted by suggestChannelFromDraft in v1. See design §0 D4.
  | 'evidence_interaction' // EV-005
  | 'mode_specific'; // GAME-003

/** Frozen list of every channel (12 active + 2 reserved). */
export const ALL_MOVE_CHANNELS: ReadonlyArray<MoveChannel> = Object.freeze([
  'reply',
  'challenge',
  'clarify',
  'ask_source',
  'ask_quote',
  'add_evidence',
  'narrow',
  'concede',
  'confirm',
  'synthesize',
  'branch_tangent',
  'meta_process',
  'evidence_interaction',
  'mode_specific',
]);

/** The 12 channels surfaced as pickable chips in v1 (reserved 2 excluded). */
export const ACTIVE_MOVE_CHANNELS: ReadonlyArray<MoveChannel> = Object.freeze([
  'reply',
  'challenge',
  'clarify',
  'ask_source',
  'ask_quote',
  'add_evidence',
  'narrow',
  'concede',
  'confirm',
  'synthesize',
  'branch_tangent',
  'meta_process',
]);

/** The 2 reserved channels — stub definitions only; never suggested in v1. */
export const RESERVED_MOVE_CHANNELS: ReadonlyArray<MoveChannel> = Object.freeze([
  'evidence_interaction',
  'mode_specific',
]);

/** Optional helper-field identifiers a channel may reveal. */
export type ChannelOptionalField =
  | 'source_url'
  | 'quote_text'
  | 'scope_example'
  | 'definition'
  | 'mechanism'
  | 'counterexample'
  | 'primary_source';

/** Static, frozen definition for one channel. */
export interface ChannelDefinition {
  channel: MoveChannel;
  /** Plain-language purpose sentence. READ from gameCopy — never authored here. */
  purpose: string;
  /** Optional structured field helpers this channel may reveal (collapsed). */
  optionalFields: ReadonlyArray<ChannelOptionalField>;
  /** Channels a user commonly moves to next. Advisory ordering only. */
  suggestedFollowups: ReadonlyArray<MoveChannel>;
  /**
   * Constitution argument type this channel produces, when there is a
   * 1:1 mapping. `null` for `meta_process` (no Constitution type) and
   * for the two reserved channels.
   */
  resultingArgumentType: ArgumentType | null;
}

/** Why suggestChannelFromDraft picked the channel it did. */
export type ChannelSuggestionReason =
  | 'deterministic_match' // draft's own typed fields name the channel
  | 'lifecycle_state' // parent's LIFE-001 state implies the next move
  | 'parent_demands_evidence' // parent has an open source/quote request
  | 'no_signal'; // nothing deterministic — defaults to `reply`

export type ChannelSuggestionConfidence = 'low' | 'medium' | 'high';

/** v1: always 'casual'. Stable for GAME-003. See design §0 D5. */
export type ChannelSuggestionMode = 'casual' | 'strict';

/** Output of suggestChannelFromDraft. */
export interface ChannelSuggestion {
  suggested: MoveChannel;
  reason: ChannelSuggestionReason;
  confidence: ChannelSuggestionConfidence;
  /**
   * Plain-language one-liner explaining the suggestion to the user.
   * READ from a frozen copy table — never authored at call time.
   */
  rationale: string;
  /**
   * True when the draft's *current* channel (the user's pick, if any)
   * differs from `suggested`. The composer shows the re-route advisory
   * only when this is true. NEVER a block.
   */
  isMismatch: boolean;
}

/** Draft-side inputs for `suggestChannelFromDraft`. */
export interface SuggestChannelDraftInput {
  /** The draft's currently-selected argument type, if any. */
  argumentType: ArgumentType | null;
  /** The draft's disagreement axis, if any (from MoveDraftPatch). */
  disagreementAxis: DisagreementAxis | null;
  /** Qualifier / tag codes already on the draft (MoveDraftPatch.suggestedTagCodes). */
  draftTagCodes: ReadonlyArray<string>;
  /** The channel the user has already picked, if any. Drives `isMismatch`. */
  currentChannel: MoveChannel | null;
}

/** Parent-side inputs for `suggestChannelFromDraft`. */
export interface SuggestChannelParentInput {
  /** The parent move's LIFE-001 per-message snapshot. null for a root draft. */
  parentSnapshot: PointLifecycleSnapshot | null;
  /** The parent's LIFE-001 cluster summary. null for a root draft. */
  parentClusterSummary: PointLifecycleClusterSummary | null;
  /** The parent's META-001 linkage record. null for a root draft. */
  parentLinkage: MoveLinkageRecord | null;
}

// ── Plain-language copy lookups ────────────────────────────────

/**
 * Returns the short plain-language label for a channel. READ from
 * `gameCopy.CHANNEL_LABEL_COPY`. The 2 reserved channels fall back to a
 * neutral "Reserved" — they are never surfaced as pickable chips in v1.
 */
export function getChannelLabel(channel: MoveChannel): string {
  const copy = CHANNEL_LABEL_COPY as unknown as Record<string, string>;
  const value = copy[channel];
  return typeof value === 'string' ? value : 'Reserved';
}

/** Returns the plain-language purpose sentence for a channel. */
function getChannelPurpose(channel: MoveChannel): string {
  const copy = CHANNEL_PURPOSE_COPY as unknown as Record<string, string>;
  const value = copy[channel];
  return typeof value === 'string' ? value : 'Reserved for a future card.';
}

/**
 * Returns the plain-language rationale line for a suggestion. The
 * `branch_tangent` channel gets its own non-punitive line; every other
 * channel is keyed purely by the suggestion `reason`.
 */
function getChannelRationale(
  reason: ChannelSuggestionReason,
  suggested: MoveChannel,
): string {
  const copy = CHANNEL_RATIONALE_COPY as unknown as Record<string, string>;
  if (suggested === 'branch_tangent') return copy.branch_tangent;
  return copy[reason] ?? copy.no_signal;
}

// ── Channel definitions ────────────────────────────────────────

/** Frozen, type-narrowed optional-field array helper. */
function fields(...f: ChannelOptionalField[]): ReadonlyArray<ChannelOptionalField> {
  return Object.freeze(f);
}

/** Frozen, type-narrowed followup-channel array helper. */
function followups(...c: MoveChannel[]): ReadonlyArray<MoveChannel> {
  return Object.freeze(c);
}

/**
 * Frozen static definition table. `purpose` is read from gameCopy at
 * module load. `evidence_interaction` / `mode_specific` are stubs — see
 * design §0 D4: their real behaviour is EV-005 / GAME-003 work.
 */
export const CHANNEL_DEFINITIONS: Readonly<Record<MoveChannel, ChannelDefinition>> =
  Object.freeze({
    reply: Object.freeze({
      channel: 'reply',
      purpose: getChannelPurpose('reply'),
      optionalFields: fields(),
      suggestedFollowups: followups('challenge', 'clarify', 'add_evidence'),
      resultingArgumentType: 'claim',
    }),
    challenge: Object.freeze({
      channel: 'challenge',
      purpose: getChannelPurpose('challenge'),
      optionalFields: fields('scope_example', 'counterexample'),
      suggestedFollowups: followups('add_evidence', 'clarify', 'branch_tangent'),
      // Base type. rebuttal-vs-counter_rebuttal is resolved by the caller
      // (channelToDraftPatch reuses conversationMoves.resolveChallengeType).
      resultingArgumentType: 'rebuttal',
    }),
    clarify: Object.freeze({
      channel: 'clarify',
      purpose: getChannelPurpose('clarify'),
      optionalFields: fields('definition'),
      suggestedFollowups: followups('reply', 'challenge'),
      resultingArgumentType: 'clarification_request',
    }),
    ask_source: Object.freeze({
      channel: 'ask_source',
      purpose: getChannelPurpose('ask_source'),
      optionalFields: fields('primary_source'),
      suggestedFollowups: followups('add_evidence', 'challenge'),
      resultingArgumentType: 'clarification_request',
    }),
    ask_quote: Object.freeze({
      channel: 'ask_quote',
      purpose: getChannelPurpose('ask_quote'),
      optionalFields: fields('quote_text'),
      suggestedFollowups: followups('add_evidence', 'clarify'),
      resultingArgumentType: 'clarification_request',
    }),
    add_evidence: Object.freeze({
      channel: 'add_evidence',
      purpose: getChannelPurpose('add_evidence'),
      optionalFields: fields('source_url', 'quote_text', 'primary_source'),
      suggestedFollowups: followups('challenge', 'confirm'),
      resultingArgumentType: 'evidence',
    }),
    narrow: Object.freeze({
      channel: 'narrow',
      purpose: getChannelPurpose('narrow'),
      optionalFields: fields('scope_example'),
      suggestedFollowups: followups('synthesize', 'confirm'),
      resultingArgumentType: 'concession',
    }),
    concede: Object.freeze({
      channel: 'concede',
      purpose: getChannelPurpose('concede'),
      optionalFields: fields(),
      suggestedFollowups: followups('synthesize'),
      resultingArgumentType: 'concession',
    }),
    confirm: Object.freeze({
      channel: 'confirm',
      purpose: getChannelPurpose('confirm'),
      optionalFields: fields(),
      suggestedFollowups: followups('synthesize'),
      // `confirmation` is not one of the 8 Constitution argument types;
      // a confirm move keeps the user's current type (often `concession`
      // or a generic reply). Base mapping is null — the caller decides.
      resultingArgumentType: null,
    }),
    synthesize: Object.freeze({
      channel: 'synthesize',
      purpose: getChannelPurpose('synthesize'),
      optionalFields: fields(),
      suggestedFollowups: followups(),
      resultingArgumentType: 'synthesis',
    }),
    branch_tangent: Object.freeze({
      channel: 'branch_tangent',
      purpose: getChannelPurpose('branch_tangent'),
      optionalFields: fields(),
      suggestedFollowups: followups('reply'),
      // A branch is a topology operation, not a Constitution argument type.
      resultingArgumentType: null,
    }),
    meta_process: Object.freeze({
      channel: 'meta_process',
      purpose: getChannelPurpose('meta_process'),
      optionalFields: fields(),
      suggestedFollowups: followups('reply'),
      // A process note is not a debate move — no Constitution type.
      resultingArgumentType: null,
    }),
    // ── Reserved stubs (design §0 D4) ──
    evidence_interaction: Object.freeze({
      channel: 'evidence_interaction',
      purpose: getChannelPurpose('evidence_interaction'),
      optionalFields: fields(),
      suggestedFollowups: followups(),
      resultingArgumentType: null,
    }),
    mode_specific: Object.freeze({
      channel: 'mode_specific',
      purpose: getChannelPurpose('mode_specific'),
      optionalFields: fields(),
      suggestedFollowups: followups(),
      resultingArgumentType: null,
    }),
  });

/**
 * Returns the frozen static definition for a channel. Pure O(1) lookup.
 * Throws on an unknown channel value — the union makes that unreachable
 * from typed callers; the throw guards untyped boundaries.
 */
export function channelDefinition(channel: MoveChannel): ChannelDefinition {
  const def = CHANNEL_DEFINITIONS[channel];
  if (!def) {
    throw new Error(`channelDefinition: unknown channel "${String(channel)}"`);
  }
  return def;
}

// ── Shared type → channel classifier ──────────────────────────

/**
 * Qualifier-code groups that disambiguate a `clarification_request` or a
 * `concession` into a more specific channel. Reading typed codes only —
 * never the draft body text (design §5.2 "no-keyword-block guarantee").
 */
const SOURCE_REQUEST_CODES: ReadonlySet<string> = new Set([
  'ask_receipts',
  'source_request',
  'needs_source',
]);
const QUOTE_REQUEST_CODES: ReadonlySet<string> = new Set([
  'quote_exact_bit',
  'quote_request',
  'needs_quote',
]);
const BROAD_CONCEDE_CODES: ReadonlySet<string> = new Set([
  'concede_broad_point',
  'concession_offered',
]);
const NARROW_CODES: ReadonlySet<string> = new Set([
  'narrow_scope',
  'concede_small_point',
  'narrowed_claim',
]);
const TANGENT_CODES: ReadonlySet<string> = new Set([
  'branch_this_off',
  'tangent_or_joke',
  'tangent',
]);
const CONFIRM_CODES: ReadonlySet<string> = new Set(['pure_accept', 'confirmed']);

function tagsHaveAny(tags: ReadonlyArray<string>, set: ReadonlySet<string>): boolean {
  for (const t of tags) {
    if (set.has(String(t).trim().toLowerCase())) return true;
  }
  return false;
}

/**
 * The single forward/reverse map from an argument type + qualifier codes
 * to a `MoveChannel`. Used by BOTH `suggestChannelFromDraft` rule 1 and
 * `deriveChannelForPostedMove`, so the two cannot drift (design §R2).
 *
 * Returns `null` when the type alone names no channel (e.g. `thesis` /
 * `claim` without qualifiers map to `reply` only as a fallback — the
 * caller decides whether to use `reply` or fall through).
 */
function classifyByTypeAndTags(
  argumentType: ArgumentType | null,
  tagCodes: ReadonlyArray<string>,
): MoveChannel | null {
  switch (argumentType) {
    case 'evidence':
      return 'add_evidence';
    case 'synthesis':
      return 'synthesize';
    case 'concession':
      if (tagsHaveAny(tagCodes, BROAD_CONCEDE_CODES)) return 'concede';
      if (tagsHaveAny(tagCodes, NARROW_CODES)) return 'narrow';
      // A bare concession with no qualifier defaults to `concede`.
      return 'concede';
    case 'rebuttal':
    case 'counter_rebuttal':
      return 'challenge';
    case 'clarification_request':
      if (tagsHaveAny(tagCodes, SOURCE_REQUEST_CODES)) return 'ask_source';
      if (tagsHaveAny(tagCodes, QUOTE_REQUEST_CODES)) return 'ask_quote';
      return 'clarify';
    case 'thesis':
    case 'claim':
      if (tagsHaveAny(tagCodes, CONFIRM_CODES)) return 'confirm';
      return 'reply';
    default:
      // No type. A confirm qualifier on an untyped draft still resolves.
      if (tagsHaveAny(tagCodes, CONFIRM_CODES)) return 'confirm';
      return null;
  }
}

// ── suggestChannelFromDraft ────────────────────────────────────

/**
 * The lifecycle-state → channel map for rule 4. A small frozen table —
 * the single highest-priority mapping wins. Reads only the parent's
 * STRUCTURAL lifecycle state; never heat / popularity / strength.
 */
const LIFECYCLE_STATE_CHANNEL: Readonly<Partial<Record<PointLifecycleState, MoveChannel>>> =
  Object.freeze({
    branch_recommended: 'branch_tangent',
    synthesis_ready: 'synthesize',
    rebutted: 'challenge',
    narrowed: 'synthesize',
    conceded: 'confirm',
    confirmed: 'synthesize',
    quote_requested: 'add_evidence',
    source_requested: 'add_evidence',
  });

/**
 * Deterministically suggests the channel that fits the draft + parent.
 *
 * Reads ONLY the typed inputs — already-derived META-001 / LIFE-001
 * surface plus the draft's own typed fields. NO AI. NO network. NO
 * re-derivation of axis / category / lifecycle. NO body-text inspection.
 * Pure. Deterministic. Idempotent.
 *
 * `mode` is accepted for GAME-003 forward-compat; in v1 it is always
 * 'casual' and does NOT change the suggested channel (design §0 D5).
 *
 * Derivation order (first match wins):
 *  1. deterministic_match / high   — the draft's own type names a channel.
 *  2. deterministic_match / medium — draft tag codes carry a tangent code.
 *  3. parent_demands_evidence / high — parent has an open source/quote req.
 *  4. lifecycle_state / medium     — the parent's cluster state implies a move.
 *  5. lifecycle_state / low        — parent exists but state is open/answered.
 *  6. no_signal / low              — no parent and no draft type → reply.
 */
export function suggestChannelFromDraft(
  draft: SuggestChannelDraftInput,
  parent: SuggestChannelParentInput,
  // `mode` is part of the stable GAME-003 signature; v1 ignores its value.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mode: ChannelSuggestionMode,
): ChannelSuggestion {
  const tagCodes = draft.draftTagCodes ?? [];

  // Rule 1 — the draft's own argument type names the channel.
  const byType = classifyByTypeAndTags(draft.argumentType, tagCodes);
  if (draft.argumentType !== null && byType !== null) {
    return finish(byType, 'deterministic_match', 'high', draft.currentChannel);
  }

  // Rule 2 — draft tag codes carry a tangent qualifier (no type needed).
  if (tagsHaveAny(tagCodes, TANGENT_CODES)) {
    return finish('branch_tangent', 'deterministic_match', 'medium', draft.currentChannel);
  }

  // Rule 3 — the parent literally asked for a source or a quote.
  const parentDemandsEvidence =
    (parent.parentSnapshot !== null &&
      (parent.parentSnapshot.messageContribution === 'source_requested' ||
        parent.parentSnapshot.messageContribution === 'quote_requested')) ||
    (parent.parentClusterSummary !== null &&
      parent.parentClusterSummary.hasOpenSourceOrQuoteRequest === true);
  if (parentDemandsEvidence) {
    return finish('add_evidence', 'parent_demands_evidence', 'high', draft.currentChannel);
  }

  // Rule 4 — the parent's cluster state implies the useful next move.
  const clusterState = parent.parentClusterSummary?.state ?? null;
  if (clusterState !== null) {
    const mapped = LIFECYCLE_STATE_CHANNEL[clusterState];
    if (mapped) {
      return finish(mapped, 'lifecycle_state', 'medium', draft.currentChannel);
    }
    // Rule 5 — parent exists but state is open / answered / something
    // without a directed next move → a plain reply.
    return finish('reply', 'lifecycle_state', 'low', draft.currentChannel);
  }

  // Rule 6 — no parent (root draft) and no draft type → reply.
  return finish('reply', 'no_signal', 'low', draft.currentChannel);
}

/** Builds the `ChannelSuggestion` — sets rationale + isMismatch. */
function finish(
  suggested: MoveChannel,
  reason: ChannelSuggestionReason,
  confidence: ChannelSuggestionConfidence,
  currentChannel: MoveChannel | null,
): ChannelSuggestion {
  return {
    suggested,
    reason,
    confidence,
    rationale: getChannelRationale(reason, suggested),
    isMismatch: currentChannel !== null && currentChannel !== suggested,
  };
}

// ── channelToDraftPatch ────────────────────────────────────────

/**
 * Maps a user-picked channel to a `MoveDraftPatch` the composer applies.
 * Mirrors `conversationMoves.mapMoveToDraftPatch` — never sets a field the
 * channel does not imply. Pure.
 *
 *  - `challenge` resolves rebuttal-vs-counter_rebuttal via the shared
 *    `resolveChallengeType` (no duplicated transition logic).
 *  - `meta_process`, `branch_tangent`, and `confirm` return an empty
 *    patch — they do not change `argumentType` (design §2 / §5.3 / §7).
 *  - The patch is returned even for a transition the Constitution engine
 *    will later reject — RULE-005 never re-validates transitions
 *    (design §7 edge case 6).
 */
export function channelToDraftPatch(
  channel: MoveChannel,
  parentType: ArgumentType | null,
  rules: ConstitutionRule[],
): MoveDraftPatch {
  const def = channelDefinition(channel);

  // Channels with no Constitution type (meta_process / branch_tangent /
  // confirm / the reserved stubs) leave the draft type untouched.
  if (def.resultingArgumentType === null) {
    return {};
  }

  if (channel === 'challenge') {
    const resolved = parentType ? resolveChallengeType(parentType, rules) : 'rebuttal';
    return {
      argumentType: resolved ?? 'rebuttal',
      disagreementAxis: null,
    };
  }

  switch (channel) {
    case 'add_evidence':
      return { argumentType: 'evidence', disagreementAxis: null, suggestedTagCodes: ['evidence'] };
    case 'synthesize':
      return { argumentType: 'synthesis', disagreementAxis: null, suggestedTagCodes: ['synthesis'] };
    case 'narrow':
    case 'concede':
      return {
        argumentType: 'concession',
        disagreementAxis: null,
        suggestedTagCodes: ['concession'],
      };
    case 'clarify':
    case 'ask_source':
    case 'ask_quote':
      return {
        argumentType: 'clarification_request',
        disagreementAxis: null,
        suggestedTagCodes: ['clarification'],
      };
    case 'reply':
      return { argumentType: 'claim', disagreementAxis: null };
    default:
      // Unreachable for the typed union; defensive empty patch.
      return {};
  }
}

// ── deriveChannelForPostedMove ─────────────────────────────────

/** Maps a Constitution argument-type display label back to a type code. */
const TYPE_LABEL_TO_CODE: Readonly<Record<string, ArgumentType>> = Object.freeze({
  thesis: 'thesis',
  claim: 'claim',
  rebuttal: 'rebuttal',
  counter_rebuttal: 'counter_rebuttal',
  'counter rebuttal': 'counter_rebuttal',
  evidence: 'evidence',
  clarification_request: 'clarification_request',
  'clarification request': 'clarification_request',
  concession: 'concession',
  synthesis: 'synthesis',
});

/**
 * Render-time reverse map: given an already-posted move's existing derived
 * fields — its LIFE-001 `messageContribution` plus its META-001 qualifier
 * codes — returns the `MoveChannel` for label display in the Timeline /
 * Cards. NO new storage. Pure. Deterministic.
 *
 * Reuses the same `classifyByTypeAndTags` helper as `suggestChannelFromDraft`
 * rule 1 so the forward and reverse maps cannot drift (design §R2).
 * Falls back to `reply` for an unknown / unmappable input (design §7
 * edge case 7).
 */
export function deriveChannelForPostedMove(input: {
  messageContribution: PointLifecycleState;
  qualifierCodes: ReadonlyArray<string>;
  argumentTypeLabel: string;
}): MoveChannel {
  const codes = input.qualifierCodes ?? [];

  // First — the argument type, when it maps to a Constitution type.
  const typeKey = String(input.argumentTypeLabel ?? '').trim().toLowerCase();
  const typeCode = TYPE_LABEL_TO_CODE[typeKey] ?? null;
  const byType = classifyByTypeAndTags(typeCode, codes);
  if (byType !== null) return byType;

  // Then — the message's lifecycle contribution carries structural intent.
  switch (input.messageContribution) {
    case 'source_requested':
      return 'ask_source';
    case 'quote_requested':
      return 'ask_quote';
    case 'sourced':
      return 'add_evidence';
    case 'conceded':
      return 'concede';
    case 'narrowed':
      return 'narrow';
    case 'confirmed':
      return 'confirm';
    case 'synthesis_ready':
      return 'synthesize';
    case 'rebutted':
      return 'challenge';
    case 'clarified':
      return 'clarify';
    case 'branch_recommended':
      return 'branch_tangent';
    default:
      // Unknown / structurally-neutral → a plain reply.
      return 'reply';
  }
}

// ── Ban-list support ───────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/channelCopyBanList.test.ts`.
 * NOT a content filter. Mirrors `_forbiddenMetadataTokens` /
 * `_forbiddenLifecycleTokens` so RULE-005 copy is held to the same bar.
 *
 * `branch_tangent`-specific punitive tokens (dodge / evade / avoid) are
 * included so the non-punitive requirement is enforced (design §7
 * edge case 11 / acceptance criterion).
 */
export function _forbiddenChannelTokens(): string[] {
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
    // Block / prevent tokens (a suggestion must never block)
    'block',
    'prevent',
    'reject',
    'forbid',
    'disallow',
    'denied',
    // branch_tangent non-punitive guard
    'dodge',
    'dodging',
    'evade',
    'evading',
    'evasion',
    'avoiding',
  ];
}
