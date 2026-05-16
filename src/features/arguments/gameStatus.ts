/**
 * Gamified resting-status model for argument rooms.
 * Pure TypeScript — no React, no Supabase, no Anthropic, no network.
 *
 * These statuses represent game/conversational state derived from
 * child moves, concessions, evidence, flags, and user marks.
 * They are NOT objective truth verdicts.
 *
 * Stage 6.1.0
 */

// ── Types ──────────────────────────────────────────────────────

export type GameRestingStatus =
  | 'open'
  | 'awaiting_reply'
  | 'responded_to'
  | 'receipts_requested'
  | 'receipts_dropped'
  | 'quote_requested'
  | 'off_track'
  | 'branch_recommended'
  | 'point_conceded'
  | 'dispute_narrowed'
  | 'mostly_settled'
  | 'unresolved'
  | 'stalemate'
  | 'both_might_be_wrong'
  | 'one_side_more_supported'
  | 'claim_currently_ahead'
  | 'surrendered'
  | 'peace_treaty_ish'
  | 'needs_judge_human_review';

export type GameStatusSource =
  | 'deterministic'
  | 'user_mark'
  | 'moderator'
  | 'semantic_adapter'
  | 'mixed';

export interface GameStatusEvidence {
  childCount: number;
  hasReceipt: boolean;
  hasConcession: boolean;
  hasSynthesis: boolean;
  hasQuoteAnchor: boolean;
  hasWeakTopicFlag: boolean;
  hasOffTrackFlag: boolean;
  userMarks?: string[];
}

export interface GameStatusResult {
  status: GameRestingStatus;
  label: string;
  playfulLabel?: string;
  description: string;
  source: GameStatusSource;
  confidence: number;
  severity: 'neutral' | 'attention' | 'positive' | 'playful';
  isFinal: boolean;
  requiresHumanReview: boolean;
  evidence: GameStatusEvidence;
}

export interface GameStatusInput {
  childCount: number;
  hasRebuttalChild: boolean;
  hasConcessionChild: boolean;
  hasSynthesisChild: boolean;
  hasEvidenceChild: boolean;
  hasClarificationChild: boolean;
  hasQuoteAnchor: boolean;
  hasWeakTopicFlag: boolean;
  hasOffTrackFlag: boolean;
  userMarks?: string[];
  moderatorStatus?: string | null;
}

// ── Label maps ─────────────────────────────────────────────────

const STATUS_LABELS: Record<GameRestingStatus, string> = {
  open: 'Open',
  awaiting_reply: 'Awaiting reply',
  responded_to: 'Responded to',
  receipts_requested: 'Receipts requested',
  receipts_dropped: 'Receipts dropped',
  quote_requested: 'Quote the exact bit',
  off_track: 'Off track',
  branch_recommended: 'Branch this off',
  point_conceded: 'Point conceded',
  dispute_narrowed: 'Dispute narrowed',
  mostly_settled: 'Mostly settled',
  unresolved: 'Still unresolved',
  stalemate: 'Stalemate',
  both_might_be_wrong: 'You might both be wrong',
  one_side_more_supported: 'One side has more support',
  claim_currently_ahead: 'Currently ahead',
  surrendered: 'Surrendered',
  peace_treaty_ish: 'Peace treaty-ish',
  needs_judge_human_review: 'Needs human review',
};

const PLAYFUL_LABELS: Partial<Record<GameRestingStatus, string>> = {
  surrendered: 'Surrender completely',
  point_conceded: 'Point surrendered',
  dispute_narrowed: 'Argument got smaller',
  receipts_dropped: 'Receipts dropped',
  receipts_requested: 'Receipts, please',
  quote_requested: 'Pin it to the exact words',
  branch_recommended: 'This tangent wants its own room',
  peace_treaty_ish: 'Peace treaty-ish',
  both_might_be_wrong: 'Everybody might be eating gravel here',
};

const STATUS_DESCRIPTIONS: Record<GameRestingStatus, string> = {
  open: 'No response yet. The argument is open.',
  awaiting_reply: 'A response has been requested or expected.',
  responded_to: 'This point has at least one direct response.',
  receipts_requested: 'Someone asked for supporting evidence.',
  receipts_dropped: 'Evidence has been added to support this point.',
  quote_requested: 'A specific quote or excerpt was requested.',
  off_track: 'This point may have drifted from the room topic.',
  branch_recommended: 'This thread may be better as its own argument room.',
  point_conceded: 'The author or a participant has conceded this point.',
  dispute_narrowed: 'The scope of disagreement has been reduced.',
  mostly_settled: 'The core dispute appears mostly resolved.',
  unresolved: 'This point remains open and contested.',
  stalemate: 'Both sides have responded; no clear movement yet.',
  both_might_be_wrong: 'Neither side currently has strong support.',
  one_side_more_supported: 'One side has provided stronger backing.',
  claim_currently_ahead: 'This claim is currently better supported than its counter.',
  surrendered: 'The point has been fully conceded by the author.',
  peace_treaty_ish: 'A partial resolution or narrowing agreement was reached.',
  needs_judge_human_review: 'A human moderator should review this thread.',
};

const STATUS_SEVERITY: Record<GameRestingStatus, GameStatusResult['severity']> = {
  open: 'neutral',
  awaiting_reply: 'attention',
  responded_to: 'neutral',
  receipts_requested: 'attention',
  receipts_dropped: 'positive',
  quote_requested: 'attention',
  off_track: 'attention',
  branch_recommended: 'attention',
  point_conceded: 'playful',
  dispute_narrowed: 'positive',
  mostly_settled: 'positive',
  unresolved: 'neutral',
  stalemate: 'neutral',
  both_might_be_wrong: 'playful',
  one_side_more_supported: 'positive',
  claim_currently_ahead: 'positive',
  surrendered: 'playful',
  peace_treaty_ish: 'playful',
  needs_judge_human_review: 'attention',
};

// ── Functions ──────────────────────────────────────────────────

export function getGameStatusDisplay(status: GameRestingStatus): {
  label: string;
  playfulLabel?: string;
  description: string;
  severity: GameStatusResult['severity'];
} {
  return {
    label: STATUS_LABELS[status],
    playfulLabel: PLAYFUL_LABELS[status],
    description: STATUS_DESCRIPTIONS[status],
    severity: STATUS_SEVERITY[status],
  };
}

export function deriveGameStatus(input: GameStatusInput): GameStatusResult {
  const evidence: GameStatusEvidence = {
    childCount: input.childCount,
    hasReceipt: input.hasEvidenceChild,
    hasConcession: input.hasConcessionChild,
    hasSynthesis: input.hasSynthesisChild,
    hasQuoteAnchor: input.hasQuoteAnchor,
    hasWeakTopicFlag: input.hasWeakTopicFlag,
    hasOffTrackFlag: input.hasOffTrackFlag,
    userMarks: input.userMarks,
  };

  // Human review takes highest priority
  if (input.moderatorStatus === 'needs_review') {
    return buildResult('needs_judge_human_review', 'moderator', 0.95, evidence);
  }

  // Off-track signals
  if (input.hasOffTrackFlag) {
    if (shouldRecommendBranch(input)) {
      return buildResult('branch_recommended', 'deterministic', 0.8, evidence);
    }
    return buildResult('off_track', 'deterministic', 0.75, evidence);
  }

  // Concession / surrender signals
  if (input.hasConcessionChild && input.hasSynthesisChild) {
    return buildResult('peace_treaty_ish', 'deterministic', 0.85, evidence);
  }
  if (input.hasConcessionChild) {
    const marks = input.userMarks ?? [];
    if (marks.includes('conceding_this')) {
      return buildResult('surrendered', 'user_mark', 0.9, evidence);
    }
    return buildResult('point_conceded', 'deterministic', 0.8, evidence);
  }

  // Quote signals (clarification without anchor)
  if (shouldRequestQuote(input)) {
    return buildResult('quote_requested', 'deterministic', 0.7, evidence);
  }

  // Stalemate / settlement signals
  if (input.hasSynthesisChild) {
    return buildResult('mostly_settled', 'deterministic', 0.75, evidence);
  }

  if (input.childCount === 0) {
    return buildResult('open', 'deterministic', 1.0, evidence);
  }

  // Rebuttal path — check evidence state within it
  if (input.hasRebuttalChild && !input.hasConcessionChild) {
    if (!input.hasEvidenceChild) {
      return buildResult('receipts_requested', 'deterministic', 0.75, evidence);
    }
    // Rebuttal with evidence: complex state
    if (input.hasWeakTopicFlag) {
      return buildResult('both_might_be_wrong', 'mixed', 0.6, evidence);
    }
    if (input.childCount >= 3) {
      return buildResult('stalemate', 'deterministic', 0.7, evidence);
    }
    return buildResult('unresolved', 'deterministic', 0.8, evidence);
  }

  // Evidence dropped, no rebuttal
  if (input.hasEvidenceChild) {
    return buildResult('receipts_dropped', 'deterministic', 0.8, evidence);
  }

  return buildResult('responded_to', 'deterministic', 0.9, evidence);
}

function buildResult(
  status: GameRestingStatus,
  source: GameStatusSource,
  confidence: number,
  evidence: GameStatusEvidence,
): GameStatusResult {
  const display = getGameStatusDisplay(status);
  return {
    status,
    label: display.label,
    playfulLabel: display.playfulLabel,
    description: display.description,
    source,
    confidence,
    severity: display.severity,
    isFinal: status === 'surrendered' || status === 'peace_treaty_ish' || status === 'mostly_settled',
    requiresHumanReview: status === 'needs_judge_human_review',
    evidence,
  };
}

export function isRestingStatusPositive(status: GameRestingStatus): boolean {
  return (
    status === 'receipts_dropped' ||
    status === 'dispute_narrowed' ||
    status === 'mostly_settled' ||
    status === 'one_side_more_supported' ||
    status === 'claim_currently_ahead'
  );
}

export function isRestingStatusNeedsAttention(status: GameRestingStatus): boolean {
  return (
    status === 'awaiting_reply' ||
    status === 'receipts_requested' ||
    status === 'quote_requested' ||
    status === 'off_track' ||
    status === 'branch_recommended' ||
    status === 'needs_judge_human_review'
  );
}

export function isRestingStatusPlayful(status: GameRestingStatus): boolean {
  return (
    status === 'point_conceded' ||
    status === 'surrendered' ||
    status === 'peace_treaty_ish' ||
    status === 'both_might_be_wrong'
  );
}

export function shouldRecommendBranch(input: GameStatusInput): boolean {
  return input.hasOffTrackFlag && input.childCount >= 2;
}

export function shouldRequestQuote(input: GameStatusInput): boolean {
  return (
    input.hasClarificationChild &&
    !input.hasQuoteAnchor &&
    input.childCount >= 1
  );
}

export function shouldRequestReceipts(input: GameStatusInput): boolean {
  return (
    input.hasRebuttalChild &&
    !input.hasEvidenceChild &&
    input.childCount >= 1
  );
}

export const ALL_GAME_RESTING_STATUSES: GameRestingStatus[] = [
  'open',
  'awaiting_reply',
  'responded_to',
  'receipts_requested',
  'receipts_dropped',
  'quote_requested',
  'off_track',
  'branch_recommended',
  'point_conceded',
  'dispute_narrowed',
  'mostly_settled',
  'unresolved',
  'stalemate',
  'both_might_be_wrong',
  'one_side_more_supported',
  'claim_currently_ahead',
  'surrendered',
  'peace_treaty_ish',
  'needs_judge_human_review',
];
