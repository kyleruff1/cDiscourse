/**
 * ROOM-003 (#829) — pure view-model for the one-bar ArgumentEntryComposer.
 *
 * No React, no Supabase, no env, no network, no wall clock. Every function
 * is a pure projection of App-level state so it is unit-testable in
 * isolation. The bar VIEW consumes these helpers; the shipped submit path
 * (buildSubmitArgumentPayload) is reused verbatim so the wire payload stays
 * byte-shape-identical to the dock composer by construction.
 *
 * Comments here are deliberately apostrophe-free: the uxOneOneTwoDoctrine
 * scanner has a naive quote-parity STRING_RE and a single apostrophe in a
 * scanned source comment poisons file-wide parsing. Copy STRINGS may carry
 * apostrophes; comments must not.
 */
import type { ArgumentType, ArgumentSide } from '../types';
import type { ParticipantSide } from '../../debates/types';
import type { ConstitutionRule, EvaluationResult, FlagCode } from '../../../domain/constitution/types';
import { FLAG_CODES } from '../../../domain/constitution/types';
import { getAllowedArgumentTypesForParent } from '../composerHelpers';

// ── Copy (frozen; scanned by argumentEntryComposerCopyBanList.test.ts) ──

/**
 * Every user-facing string the bar authors. Frozen and exported so the
 * doctrine ban-list test can scan it with the shipped _forbiddenBoxTokens
 * helper. Note: the source-attach slot is labeled Source (NOT the word
 * proof) because evidence is not the same as proof — the shipped verdict
 * ban-list treats proof / proven / validated as truth verdicts, and the
 * evidence doctrine keeps engagement credit separate from factual standing.
 */
export const ARGUMENT_ENTRY_COMPOSER_COPY = Object.freeze({
  chipAnsweringPrefix: 'Answering: ',
  chipNewPoint: 'New point',
  inputPlaceholder: 'Write your reply…',
  inputA11yLabel: 'Your reply',
  proofLabel: 'Source',
  proofA11yLabel: 'Add a source',
  proofA11yHint: 'Open the full composer to attach a source.',
  micLabel: 'Voice — coming soon',
  micA11yLabel: 'Voice reply, coming soon',
  moreLabel: 'More',
  moreA11yLabel: 'More options',
  moreA11yHint: 'Open the full composer to change type, side, tags, or add a source.',
  sendLabel: 'Send',
  sendingLabel: 'Sending…',
  sendA11yLabel: 'Send reply',
  chipClearA11yLabel: 'Clear reply target',
  observerPrompt: 'Join to reply',
  observerA11yHint: 'Take a seat from the action rail to add your reply.',
  blockedReasonPrefix: 'Cannot send yet: ',
});

// ── Reply target projection ────────────────────────────────────

/** The bar resolved reply target (a projection of App-level state). */
export interface EntryComposerTarget {
  /** Parent argument id, or null for a root-claim context. */
  parentId: string | null;
  /** Parent argument type (drives type defaulting), or null at root. */
  parentType: ArgumentType | null;
  /** One-line label the context chip renders (plain language). */
  chipLabel: string;
  /** True when the chip clear affordance should be offered (a parent is scoped). */
  clearable: boolean;
}

/** Max characters of parent body shown inside the context chip. */
const CHIP_EXCERPT_MAX = 48;

/** Pure: collapse whitespace and clamp a parent body to a short chip excerpt. */
export function truncateChipExcerpt(body: string | null, max: number = CHIP_EXCERPT_MAX): string {
  if (!body) return '';
  const collapsed = body.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  return collapsed.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

/** Pure: derive the context-chip target from the App-level reply state. */
export function deriveEntryComposerTarget(input: {
  parentId: string | null;
  parentType: ArgumentType | null;
  parentBody: string | null;
}): EntryComposerTarget {
  const hasParent = input.parentId !== null;
  let chipLabel: string;
  if (hasParent) {
    const excerpt = truncateChipExcerpt(input.parentBody);
    chipLabel = excerpt
      ? ARGUMENT_ENTRY_COMPOSER_COPY.chipAnsweringPrefix + excerpt
      : ARGUMENT_ENTRY_COMPOSER_COPY.chipAnsweringPrefix.trim();
  } else {
    chipLabel = ARGUMENT_ENTRY_COMPOSER_COPY.chipNewPoint;
  }
  return {
    parentId: input.parentId,
    parentType: input.parentType,
    chipLabel,
    clearable: hasParent,
  };
}

// ── Type + side defaulting ─────────────────────────────────────

export interface EntryComposerDefaultsInput {
  parentType: ArgumentType | null;
  /** The viewer established seat; drives side defaulting. */
  participantSide: ParticipantSide | null;
  /** Whether the reply target is the viewer OWN move (continuation vs counter). */
  replyingToOwnMove: boolean;
  /** Active constitution rules — the allowed-type source of truth. */
  rules: ReadonlyArray<ConstitutionRule>;
}

export interface EntryComposerDefaults {
  argumentType: ArgumentType; // ALWAYS a member of the engine-allowed set
  side: ArgumentSide;
}

/** Pure: map a participant seat onto an ArgumentSide. */
export function sideForParticipantSeat(side: ParticipantSide | null): ArgumentSide {
  if (side === 'affirmative') return 'affirmative';
  if (side === 'negative') return 'negative';
  return 'neutral';
}

/**
 * Pure: pick the PREFERRED reply type before it is clamped to the allowed
 * set. Root opens with claim (thesis is reserved for the formal Start flow),
 * a continuation on the viewer own move stays least-adversarial, and a reply
 * to an opponent chooses the natural counter (mirrors quickActionPresets
 * challenge). This is only a preference; the caller intersects it with the
 * engine-allowed set.
 */
function preferredReplyType(parentType: ArgumentType | null, replyingToOwnMove: boolean): ArgumentType {
  if (parentType === null) return 'claim';
  if (replyingToOwnMove) return 'claim';
  if (parentType === 'rebuttal') return 'counter_rebuttal';
  if (parentType === 'counter_rebuttal') return 'rebuttal';
  return 'rebuttal';
}

/** Continuation fallback order for a reply to the viewer own move. */
const OWN_CONTINUATION_FALLBACKS: ReadonlyArray<ArgumentType> = ['claim', 'clarification_request'];

/**
 * Pure: choose an engine-VALID default type + a seat-derived side. The type
 * is ALWAYS a member of getAllowedArgumentTypesForParent — a disallowed
 * preference clamps to an allowed continuation (own move) or the first
 * allowed reply type. A disallowed inference is never returned, so the bar
 * never posts an engine-invalid type.
 */
export function deriveEntryComposerDefaults(input: EntryComposerDefaultsInput): EntryComposerDefaults {
  const allowed = getAllowedArgumentTypesForParent(input.parentType, [...input.rules]);
  const side = sideForParticipantSeat(input.participantSide);

  const preferred = preferredReplyType(input.parentType, input.replyingToOwnMove);
  if (allowed.includes(preferred)) {
    return { argumentType: preferred, side };
  }

  if (input.replyingToOwnMove) {
    for (const candidate of OWN_CONTINUATION_FALLBACKS) {
      if (allowed.includes(candidate)) return { argumentType: candidate, side };
    }
  }

  // Final clamp: the first engine-allowed type. If the allowed set is empty
  // (a degenerate constitution) fall back to claim so the shape stays valid;
  // the engine still gates the actual post.
  return { argumentType: allowed[0] ?? 'claim', side };
}

// ── Bar element visibility ─────────────────────────────────────

/** Bar element visibility (which slots render), derived from viewer/flag/target. */
export interface EntryComposerBarLayout {
  showContextChip: boolean;
  showProofSlot: boolean; // always true (routes to More until PROOF-002)
  showMicSlot: boolean; // always true; ALWAYS disabled in this card
  showMoreButton: boolean; // always true
  canSend: boolean; // body non-empty AND evaluation.allowPost
}

/**
 * Pure: which bar slots render + whether Send is enabled. Send lights only
 * when the body is non-empty AND the deterministic engine allows the post —
 * the engine is the sole gate (score never blocks). hasParent is part of the
 * documented contract (it colours the chip target) but every slot is present
 * in this card, so it does not change visibility here.
 */
export function deriveEntryComposerBarLayout(input: {
  bodyLength: number;
  evaluation: EvaluationResult | null;
  hasParent: boolean;
}): EntryComposerBarLayout {
  const canSend = input.bodyLength > 0 && input.evaluation?.allowPost === true;
  return {
    showContextChip: true,
    showProofSlot: true,
    showMicSlot: true,
    showMoreButton: true,
    canSend,
  };
}

// ── Blocked-state reason selection ─────────────────────────────

/**
 * Pure: the first blocking flag code the bar should surface in its blocked
 * state, or null when nothing blocks. The VIEW maps this code through
 * gameCopy.toPlainLanguage so no internal code ever reaches the user; the
 * engine message is the honest fallback. Empty-body is intentionally NOT
 * surfaced here (Send is simply disabled) — the meaningful blocked reasons
 * are over-length and the evidence hard-block.
 */
export function deriveEntryComposerBlockingFlag(
  evaluation: EvaluationResult | null,
): { flagCode: FlagCode; message: string } | null {
  if (!evaluation || evaluation.allowPost) return null;
  const first = evaluation.blockingErrors[0];
  if (!first) return null;
  return { flagCode: first.flagCode, message: first.message };
}

// ── Q10 fast-path civility instrumentation (advisory-only) ─────

/** Civility advisories the pre-send review would have surfaced. */
const CIVILITY_ADVISORY_FLAG_CODES: ReadonlyArray<FlagCode> = [
  FLAG_CODES.AD_HOMINEM,
  FLAG_CODES.CIVILITY_RISK,
];

/**
 * Q10 instrumentation: does this fast-path post carry a civility advisory
 * that the pre-send review would have surfaced? Advisory-only signal —
 * NEVER blocks, NEVER a network call, NEVER an AI call. It only counts, so
 * the team can compare civility-flag rates before/after the fast path lands.
 */
export function deriveFastPathCivilitySignal(
  evaluation: EvaluationResult | null,
): { hadCivilityAdvisory: boolean; flagCodes: ReadonlyArray<string> } {
  if (!evaluation) return { hadCivilityAdvisory: false, flagCodes: [] };
  const flagCodes = evaluation.warnings
    .filter((w) => w.severity === 'review' && CIVILITY_ADVISORY_FLAG_CODES.includes(w.flagCode))
    .map((w) => w.flagCode);
  return { hadCivilityAdvisory: flagCodes.length > 0, flagCodes };
}
