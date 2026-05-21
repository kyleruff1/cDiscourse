/**
 * Conversation Move Navigator model.
 * Pure TypeScript — no React, no Supabase, no Anthropic, no network calls.
 * Deterministic: derives allowed moves from Constitution transition rules.
 *
 * Stage 6.0.1
 */
import type { ArgumentType, DisagreementAxis, ConstitutionRule } from '../../domain/constitution/types';
import { getAllowedReplies } from '../../domain/constitution/allowedTransitions';

// ── Types ──────────────────────────────────────────────────────

export type ConversationMoveKind =
  | 'start_thesis'
  | 'make_claim'
  | 'challenge_parent'
  | 'ask_clarification'
  | 'add_evidence'
  | 'concede_or_narrow'
  | 'synthesize_thread';

export type ConversationMoveGroup = 'root' | 'reply';

/** One of the seven disagreement axes; mirrors DisagreementAxis. */
export type ChallengeAxis = DisagreementAxis;

/** A single visible move option in the navigator. */
export interface ConversationMoveOption {
  id: ConversationMoveKind;
  group: ConversationMoveGroup;
  label: string;
  shortLabel: string;
  description: string;
  /** Argument type this move produces. null = depends on parent type (challenge_parent). */
  resultingArgumentType: ArgumentType | null;
  requiresParent: boolean;
  requiresTargetExcerpt: boolean;
  requiresChallengeAxis: boolean;
  requiresEvidence: boolean;
  suggestedTagCodes: string[];
}

/** One challenge-axis option shown after 'challenge_parent' is selected. */
export interface ChallengeAxisOption {
  axis: ChallengeAxis;
  label: string;
  shortLabel: string;
  description: string;
  /** Suggested tag code (may not exist in DB; composer filters unavailable ones). */
  suggestedTagCode: string;
  disagreementAxis: DisagreementAxis;
}

/** The user's current move selection. */
export interface ConversationMoveSelection {
  moveKind: ConversationMoveKind;
  challengeAxis: ChallengeAxis | null;
  targetExcerpt: string | null;
}

/**
 * QOL-037 — the structured evidence-response block carried on a
 * `respond_to_evidence` move. Optional and additive: it travels as an advisory
 * field, copied verbatim into the `submit-argument` validation snapshot. The
 * applicability status is render-time-derived from these blocks across the
 * room's argument rows. `choice` is one of QOL-037's seven response choices;
 * it is kept as a plain string here so `conversationMoves` (a Stage-6.0 module)
 * does not take a hard dependency on the QOL-037 model's union.
 */
export interface MoveEvidenceResponse {
  /** The evidence object (EV-001 EvidenceArtifact id) this response targets. */
  evidenceArtifactId: string;
  /** One of QOL-037's `EvidenceResponseChoice` ids. */
  choice: string;
  /** The clarification body. '' only when `choice === 'accept'`. */
  clarificationBody: string;
}

/** Patch returned by mapMoveToDraftPatch — applied via updateField. */
export interface MoveDraftPatch {
  argumentType?: ArgumentType | null;
  disagreementAxis?: DisagreementAxis | null;
  targetExcerpt?: string | null;
  /** Suggested tags. Caller must merge with existing codes without duplicates. */
  suggestedTagCodes?: string[];
  moveKind?: ConversationMoveKind | null;
  /**
   * EV-002 — Optional seeded body text. When provided, the composer writes
   * this into the draft body field. The user can edit before submitting.
   * Optional; existing callers (challenge / reply / etc.) are unaffected.
   */
  body?: string;
  /**
   * QOL-037 — Optional structured evidence-response block. Present only for a
   * `respond_to_evidence` move; the host attaches it to the draft and the
   * `submit-argument` Edge Function copies it verbatim into the validation
   * snapshot (advisory — it never blocks a post). Optional; all existing
   * `MoveDraftPatch` callers are unaffected.
   */
  evidenceResponse?: MoveEvidenceResponse;
}

/** Step IDs for progressive-disclosure ordering. */
export type MoveStep =
  | 'move_selection'
  | 'target_excerpt'
  | 'challenge_axis'
  | 'evidence_fields'
  | 'body'
  | 'validation_preview';

// ── Static option catalogue ────────────────────────────────────

const ROOT_MOVE_OPTIONS: ConversationMoveOption[] = [
  {
    id: 'start_thesis',
    group: 'root',
    label: 'Start a thesis',
    shortLabel: 'Thesis',
    description: 'Open a new line of argument with a thesis statement.',
    resultingArgumentType: 'thesis',
    requiresParent: false,
    requiresTargetExcerpt: false,
    requiresChallengeAxis: false,
    requiresEvidence: false,
    suggestedTagCodes: [],
  },
  {
    id: 'make_claim',
    group: 'root',
    label: 'Make a claim',
    shortLabel: 'Claim',
    description: 'Make a substantive, falsifiable assertion.',
    resultingArgumentType: 'claim',
    requiresParent: false,
    requiresTargetExcerpt: false,
    requiresChallengeAxis: false,
    requiresEvidence: false,
    suggestedTagCodes: ['claim'],
  },
];

const REPLY_MOVE_CATALOGUE: ConversationMoveOption[] = [
  {
    id: 'challenge_parent',
    group: 'reply',
    label: 'Challenge the parent point',
    shortLabel: 'Challenge',
    description: 'Directly challenge the parent argument. Pick an axis to name the disagreement.',
    resultingArgumentType: null, // resolved from parent type
    requiresParent: true,
    requiresTargetExcerpt: true,
    requiresChallengeAxis: true,
    requiresEvidence: false,
    suggestedTagCodes: [],
  },
  {
    id: 'ask_clarification',
    group: 'reply',
    label: 'Ask for clarification',
    shortLabel: 'Clarify',
    description: 'Request that the parent define a term, scope, or premise. Must end with ?.',
    resultingArgumentType: 'clarification_request',
    requiresParent: true,
    requiresTargetExcerpt: false,
    requiresChallengeAxis: false,
    requiresEvidence: false,
    suggestedTagCodes: ['clarification'],
  },
  {
    id: 'add_evidence',
    group: 'reply',
    label: 'Add evidence or source support',
    shortLabel: 'Evidence',
    description: 'Support or question a factual point with a cited source.',
    resultingArgumentType: 'evidence',
    requiresParent: true,
    requiresTargetExcerpt: false,
    requiresChallengeAxis: false,
    requiresEvidence: true,
    suggestedTagCodes: ['evidence'],
  },
  {
    id: 'concede_or_narrow',
    group: 'reply',
    label: 'Concede or narrow the dispute',
    shortLabel: 'Concede',
    description: 'Acknowledge the parent point has merit or narrow the scope of disagreement.',
    resultingArgumentType: 'concession',
    requiresParent: true,
    requiresTargetExcerpt: false,
    requiresChallengeAxis: false,
    requiresEvidence: false,
    suggestedTagCodes: ['concession'],
  },
  {
    id: 'synthesize_thread',
    group: 'reply',
    label: 'Synthesize a resolved thread',
    shortLabel: 'Synthesize',
    description: 'Summarize a completed or narrowed subtree. Terminal — no further replies.',
    resultingArgumentType: 'synthesis',
    requiresParent: true,
    requiresTargetExcerpt: false,
    requiresChallengeAxis: false,
    requiresEvidence: false,
    suggestedTagCodes: ['synthesis'],
  },
];

const CHALLENGE_AXIS_OPTIONS: ChallengeAxisOption[] = [
  {
    axis: 'fact',
    label: 'Fact',
    shortLabel: 'Fact',
    description: 'Dispute a factual claim.',
    suggestedTagCode: 'fact_disagreement',
    disagreementAxis: 'fact',
  },
  {
    axis: 'definition',
    label: 'Definition',
    shortLabel: 'Definition',
    description: 'Challenge how a key term is defined.',
    suggestedTagCode: 'definition_disagreement',
    disagreementAxis: 'definition',
  },
  {
    axis: 'causal',
    label: 'Cause',
    shortLabel: 'Cause',
    description: 'Challenge a cause-and-effect relationship.',
    suggestedTagCode: 'causal_disagreement',
    disagreementAxis: 'causal',
  },
  {
    axis: 'value',
    label: 'Value',
    shortLabel: 'Value',
    description: 'Challenge the underlying values or priorities.',
    suggestedTagCode: 'value_disagreement',
    disagreementAxis: 'value',
  },
  {
    axis: 'evidence',
    label: 'Evidence',
    shortLabel: 'Evidence',
    description: 'Challenge the quality or existence of supporting evidence.',
    suggestedTagCode: 'evidence_challenge',
    disagreementAxis: 'evidence',
  },
  {
    axis: 'logic',
    label: 'Logic',
    shortLabel: 'Logic',
    description: 'Challenge the logical structure or inference.',
    suggestedTagCode: 'logic_challenge',
    disagreementAxis: 'logic',
  },
  {
    axis: 'scope',
    label: 'Scope',
    shortLabel: 'Scope',
    description: 'Challenge the scope or applicability of the argument.',
    suggestedTagCode: 'scope_challenge',
    disagreementAxis: 'scope',
  },
];

// ── Challenge type resolution ──────────────────────────────────

/**
 * Resolves challenge_parent → the best available challenge-compatible
 * argument type.
 *
 * Exported (RULE-005) so `channelModel.channelToDraftPatch` reuses this
 * single source of rebuttal-vs-counter_rebuttal resolution rather than
 * duplicating it. Pure: reads only the Constitution transition rules.
 */
export function resolveChallengeType(
  parentType: ArgumentType,
  rules: ConstitutionRule[],
): ArgumentType | null {
  const allowed = getAllowedReplies(parentType, rules);
  if (parentType === 'rebuttal' && allowed.includes('counter_rebuttal')) return 'counter_rebuttal';
  if (allowed.includes('rebuttal')) return 'rebuttal';
  const challengeCompatible: ArgumentType[] = ['rebuttal', 'counter_rebuttal'];
  return allowed.find((t) => challengeCompatible.includes(t)) ?? null;
}

// ── Public API ─────────────────────────────────────────────────

/** Returns the 2 root move options. Always start_thesis and make_claim. */
export function getRootMoveOptions(): ConversationMoveOption[] {
  return ROOT_MOVE_OPTIONS;
}

/**
 * Returns the reply move options that are valid given parentType and active rules.
 * Filtered by Constitution transitions. At most 5 options.
 */
export function getReplyMoveOptions(
  parentType: ArgumentType,
  rules: ConstitutionRule[],
): ConversationMoveOption[] {
  const allowed = getAllowedReplies(parentType, rules);

  return REPLY_MOVE_CATALOGUE.filter((opt) => {
    switch (opt.id) {
      case 'challenge_parent':
        return allowed.includes('rebuttal') || allowed.includes('counter_rebuttal');
      case 'ask_clarification':
        return allowed.includes('clarification_request');
      case 'add_evidence':
        return allowed.includes('evidence');
      case 'concede_or_narrow':
        return allowed.includes('concession');
      case 'synthesize_thread':
        return allowed.includes('synthesis');
      default:
        return false;
    }
  });
}

/** Returns all 7 challenge axis options (displayed after challenge_parent is selected). */
export function getChallengeAxisOptions(): ChallengeAxisOption[] {
  return CHALLENGE_AXIS_OPTIONS;
}

/** Returns the move option for a given kind, filtered by context. */
export function getMoveOptionByKind(
  kind: ConversationMoveKind,
  parentType: ArgumentType | null,
  rules: ConstitutionRule[],
): ConversationMoveOption | null {
  if (kind === 'start_thesis' || kind === 'make_claim') {
    return ROOT_MOVE_OPTIONS.find((o) => o.id === kind) ?? null;
  }
  if (!parentType) return null;
  return getReplyMoveOptions(parentType, rules).find((o) => o.id === kind) ?? null;
}

/**
 * Produces a draft patch from the current move selection.
 * Does not include author_id, depth, status, or server_validation.
 * Caller is responsible for merging suggestedTagCodes without duplicates.
 */
export function mapMoveToDraftPatch(
  selection: ConversationMoveSelection,
  parentArgument: { argumentType: ArgumentType } | null,
  rules: ConstitutionRule[],
): MoveDraftPatch {
  const { moveKind, challengeAxis, targetExcerpt } = selection;

  switch (moveKind) {
    case 'start_thesis':
      return { argumentType: 'thesis', disagreementAxis: null, moveKind };
    case 'make_claim':
      return { argumentType: 'claim', disagreementAxis: null, moveKind };

    case 'challenge_parent': {
      const argType = parentArgument
        ? resolveChallengeType(parentArgument.argumentType, rules)
        : 'rebuttal';
      const axis = challengeAxis ?? null;
      const axisOption = axis ? CHALLENGE_AXIS_OPTIONS.find((o) => o.axis === axis) : null;
      return {
        argumentType: argType ?? undefined,
        disagreementAxis: axis,
        targetExcerpt: targetExcerpt,
        suggestedTagCodes: axisOption ? [axisOption.suggestedTagCode] : [],
        moveKind,
      };
    }

    case 'ask_clarification':
      return {
        argumentType: 'clarification_request',
        disagreementAxis: null,
        targetExcerpt: targetExcerpt,
        suggestedTagCodes: ['clarification'],
        moveKind,
      };

    case 'add_evidence':
      return {
        argumentType: 'evidence',
        disagreementAxis: null,
        suggestedTagCodes: ['evidence'],
        moveKind,
      };

    case 'concede_or_narrow':
      return {
        argumentType: 'concession',
        disagreementAxis: null,
        suggestedTagCodes: ['concession'],
        moveKind,
      };

    case 'synthesize_thread':
      return {
        argumentType: 'synthesis',
        disagreementAxis: null,
        suggestedTagCodes: ['synthesis'],
        moveKind,
      };
  }
}

/**
 * Returns the visible steps for the composer given current draft and parent context.
 * Used for progressive disclosure ordering.
 */
export function getVisibleMoveSteps(
  draft: { moveKind?: ConversationMoveKind | null; argumentType?: string | null },
  parentArgument: { argumentType: ArgumentType } | null,
): MoveStep[] {
  const steps: MoveStep[] = ['move_selection'];

  if (draft.moveKind && parentArgument) {
    steps.push('target_excerpt');
  }

  if (draft.moveKind === 'challenge_parent') {
    steps.push('challenge_axis');
  }

  if (
    draft.moveKind === 'add_evidence' ||
    draft.argumentType === 'evidence'
  ) {
    steps.push('evidence_fields');
  }

  steps.push('body');
  steps.push('validation_preview');
  return steps;
}

/**
 * Returns warning strings for the current move selection.
 * Informational only — does not block submission (the Constitution engine does that).
 */
export function getMoveWarnings(
  selection: ConversationMoveSelection,
  parentArgument: { argumentType: ArgumentType } | null,
): string[] {
  const warnings: string[] = [];
  const { moveKind } = selection;

  if (
    ['challenge_parent', 'ask_clarification', 'add_evidence', 'concede_or_narrow', 'synthesize_thread'].includes(moveKind) &&
    !parentArgument
  ) {
    warnings.push('Reply moves require a parent argument. Select a parent argument first.');
  }

  if (moveKind === 'challenge_parent' && !selection.challengeAxis) {
    warnings.push('A challenge must name the disagreement layer. Choose an axis.');
  }

  return warnings;
}
