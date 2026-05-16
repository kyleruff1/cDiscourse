/**
 * Claim-standing model — where an argument currently rests in the exchange.
 * Pure TypeScript — no React, no Supabase, no Anthropic, no network.
 *
 * Does not declare objective truth or a winner.
 * Uses "currently more supported," "settled for now," "claim standing."
 *
 * Stage 6.1.0
 */
import type { ConversationMoveKind } from './conversationMoves';

// ── Types ──────────────────────────────────────────────────────

export type ClaimStanding =
  | 'not_started'
  | 'under_challenge'
  | 'needs_receipts'
  | 'receipts_added'
  | 'partially_supported'
  | 'stronger_than_counter'
  | 'counter_currently_stronger'
  | 'both_wrong_possible'
  | 'conceded'
  | 'narrowed'
  | 'unresolved'
  | 'branch_needed'
  | 'settled_for_now';

export interface ClaimStandingResult {
  standing: ClaimStanding;
  label: string;
  description: string;
  allowedNextMoves: ConversationMoveKind[];
  recommendedNextMove: ConversationMoveKind | null;
  canDeclareRestingStatus: boolean;
  canRequestJudgeReview: boolean;
}

export interface ClaimStandingInput {
  hasParent: boolean;
  hasRebuttal: boolean;
  hasEvidence: boolean;
  hasConcession: boolean;
  hasSynthesis: boolean;
  hasClarification: boolean;
  childCount: number;
  hasWeakTopicFlag: boolean;
  hasOffTrackFlag: boolean;
  depth: number;
}

// ── Label maps ─────────────────────────────────────────────────

const STANDING_LABELS: Record<ClaimStanding, string> = {
  not_started: 'Not started',
  under_challenge: 'Under challenge',
  needs_receipts: 'Needs receipts',
  receipts_added: 'Receipts added',
  partially_supported: 'Partially supported',
  stronger_than_counter: 'Currently more supported',
  counter_currently_stronger: 'Counter currently stronger',
  both_wrong_possible: 'Both sides may need revision',
  conceded: 'Conceded',
  narrowed: 'Narrowed',
  unresolved: 'Unresolved',
  branch_needed: 'Branch needed',
  settled_for_now: 'Settled for now',
};

const STANDING_DESCRIPTIONS: Record<ClaimStanding, string> = {
  not_started: 'No arguments have been made yet.',
  under_challenge: 'This claim is being actively contested.',
  needs_receipts: 'Supporting evidence has been requested.',
  receipts_added: 'Evidence has been provided for this claim.',
  partially_supported: 'Some support exists, but not enough to settle the point.',
  stronger_than_counter: 'This claim is currently better supported than its counter.',
  counter_currently_stronger: 'The counter-argument is currently better supported.',
  both_wrong_possible: 'Neither side has strong enough support to be certain.',
  conceded: 'This point has been conceded by the author.',
  narrowed: 'The scope of disagreement has been reduced.',
  unresolved: 'No clear movement; the dispute continues.',
  branch_needed: 'This thread has drifted and may need its own argument room.',
  settled_for_now: 'Both sides appear to have reached a temporary resting point.',
};

// ── Allowed next moves ─────────────────────────────────────────

const ALLOWED_MOVES: Record<ClaimStanding, ConversationMoveKind[]> = {
  not_started: ['start_thesis', 'make_claim'],
  under_challenge: ['challenge_parent', 'add_evidence', 'ask_clarification', 'concede_or_narrow'],
  needs_receipts: ['add_evidence', 'concede_or_narrow', 'ask_clarification'],
  receipts_added: ['challenge_parent', 'concede_or_narrow', 'synthesize_thread'],
  partially_supported: ['add_evidence', 'challenge_parent', 'concede_or_narrow'],
  stronger_than_counter: ['challenge_parent', 'concede_or_narrow', 'synthesize_thread'],
  counter_currently_stronger: ['add_evidence', 'challenge_parent', 'concede_or_narrow'],
  both_wrong_possible: ['ask_clarification', 'concede_or_narrow', 'synthesize_thread'],
  conceded: ['synthesize_thread'],
  narrowed: ['challenge_parent', 'add_evidence', 'synthesize_thread'],
  unresolved: ['challenge_parent', 'add_evidence', 'ask_clarification', 'concede_or_narrow'],
  branch_needed: ['synthesize_thread'],
  settled_for_now: ['synthesize_thread', 'challenge_parent'],
};

const RECOMMENDED_MOVES: Record<ClaimStanding, ConversationMoveKind | null> = {
  not_started: 'make_claim',
  under_challenge: 'add_evidence',
  needs_receipts: 'add_evidence',
  receipts_added: 'challenge_parent',
  partially_supported: 'add_evidence',
  stronger_than_counter: 'synthesize_thread',
  counter_currently_stronger: 'add_evidence',
  both_wrong_possible: 'ask_clarification',
  conceded: 'synthesize_thread',
  narrowed: 'synthesize_thread',
  unresolved: 'ask_clarification',
  branch_needed: 'synthesize_thread',
  settled_for_now: null,
};

// ── Functions ──────────────────────────────────────────────────

export function deriveClaimStanding(input: ClaimStandingInput): ClaimStandingResult {
  const standing = _computeStanding(input);
  return {
    standing,
    label: STANDING_LABELS[standing],
    description: STANDING_DESCRIPTIONS[standing],
    allowedNextMoves: ALLOWED_MOVES[standing],
    recommendedNextMove: RECOMMENDED_MOVES[standing],
    canDeclareRestingStatus:
      standing === 'settled_for_now' ||
      standing === 'conceded' ||
      standing === 'narrowed',
    canRequestJudgeReview:
      standing === 'both_wrong_possible' ||
      standing === 'unresolved' ||
      standing === 'branch_needed',
  };
}

function _computeStanding(input: ClaimStandingInput): ClaimStanding {
  if (input.childCount === 0 && !input.hasParent) return 'not_started';

  if (input.hasOffTrackFlag && input.childCount >= 2) return 'branch_needed';

  if (input.hasConcession && input.hasSynthesis) return 'settled_for_now';
  if (input.hasConcession) return 'conceded';

  if (input.hasSynthesis) return 'narrowed';

  if (input.hasWeakTopicFlag && input.hasRebuttal) return 'both_wrong_possible';

  if (input.hasRebuttal && input.hasEvidence) return 'stronger_than_counter';
  if (input.hasRebuttal && !input.hasEvidence) return 'counter_currently_stronger';

  if (input.hasEvidence && !input.hasRebuttal) return 'receipts_added';

  if (input.hasClarification && !input.hasEvidence) return 'needs_receipts';

  if (input.hasParent && input.childCount === 0) return 'under_challenge';

  if (input.childCount > 0) return 'unresolved';

  return 'not_started';
}

export function getClaimStandingDisplay(standing: ClaimStanding): {
  label: string;
  description: string;
} {
  return {
    label: STANDING_LABELS[standing],
    description: STANDING_DESCRIPTIONS[standing],
  };
}

export function getAllowedNextMovesForStanding(
  standing: ClaimStanding,
): ConversationMoveKind[] {
  return ALLOWED_MOVES[standing];
}

export function getRecommendedMoveForStanding(
  standing: ClaimStanding,
): ConversationMoveKind | null {
  return RECOMMENDED_MOVES[standing];
}

export const ALL_CLAIM_STANDINGS: ClaimStanding[] = [
  'not_started',
  'under_challenge',
  'needs_receipts',
  'receipts_added',
  'partially_supported',
  'stronger_than_counter',
  'counter_currently_stronger',
  'both_wrong_possible',
  'conceded',
  'narrowed',
  'unresolved',
  'branch_needed',
  'settled_for_now',
];
