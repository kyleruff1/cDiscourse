/**
 * FEEDBACK-001 (#898) — move-mark user-facing copy.
 *
 * Every string the ghost bar surfaces lives here, frozen, so the ban-list test
 * can scan it. Marks describe the MOVE, never the person: no verdict or person
 * token appears anywhere (winner / loser / liar / true / false / correct /
 * dishonest / bad faith / manipulative / extremist / propagandist). "Answered my
 * point" / "Didn't answer it" name the relationship between two MOVES (did this
 * reply address the point), never a truth verdict. Internal codes never reach the
 * UI: every reconciled error code maps through MOVE_MARK_ERROR_COPY; an unknown
 * code falls back, never echoed (the gameCopy discipline).
 *
 * Comments here are apostrophe-free (the uxOneOneTwoDoctrine quote-parity gotcha).
 * The copy STRINGS carry typographic quotes but no straight apostrophe.
 */
import type { MoveMarkCode } from './moveMarksModel';

/** The mark codes that have a UI entry point in THIS card (the ghost bar). */
export type MoveMarkUiCode = 'addressed_my_point' | 'did_not_address' | 'receipts_requested';

/** The two ghost-pair codes, in render order. */
export const MOVE_MARK_PAIR_CODES: ReadonlyArray<MoveMarkUiCode> = Object.freeze([
  'addressed_my_point',
  'did_not_address',
]);

/** The optional contextual third code (reuses the ask-for-receipts preset). */
export const MOVE_MARK_RECEIPTS_CODE: MoveMarkUiCode = 'receipts_requested';

/** Plain-language button label per UI code. Ban-list clean. */
export const MOVE_MARK_LABEL: Readonly<Record<MoveMarkUiCode, string>> = Object.freeze({
  addressed_my_point: 'Answered my point',
  did_not_address: 'Didn’t answer it',
  receipts_requested: 'Receipts?',
});

/** Screen-reader label per UI code (the action name only — never color / verdict). */
export const MOVE_MARK_A11Y_LABEL: Readonly<Record<MoveMarkUiCode, string>> = Object.freeze({
  addressed_my_point: 'Mark this move as: answered my point',
  did_not_address: 'Mark this move as: didn’t answer my point',
  receipts_requested: 'Ask this move for receipts',
});

/** Frozen bar chrome copy (overflow collapse, inline failure note, group label). */
export const MOVE_MARKS_BAR_COPY = Object.freeze({
  /** The tiny-width overflow control that opens the two options inline. */
  overflowGlyph: '···',
  overflowA11yLabel: 'More ways to mark this move',
  /** The whole-bar accessibility group name. */
  groupA11yLabel: 'Mark whether this move answered your point',
  /** The quiet inline note when a tap could not be saved (never the raw code). */
  failedInlineFallback: 'That mark could not be saved — nothing else changed.',
});

/**
 * Surface #2 ambient legend line (the Map / DisagreementPointsRail). A room-level
 * reading, never a per-node count and never a per-person tally. Ban-list clean.
 */
export const MOVE_MARKS_LEGEND_LINE =
  'Moments marked unanswered feed what remains unresolved.';

/** The reconciled error codes the seam maps to plain language. */
export type MoveMarkErrorCode =
  | 'unauthorized'
  | 'invalid_mark_code'
  | 'argument_not_found'
  | 'debate_argument_mismatch'
  | 'argument_deleted'
  | 'cannot_mark_own_move'
  | 'not_a_participant'
  | 'validation_failed'
  | 'network_error'
  | 'unknown';

/** Plain-language message per reconciled code. Never the raw code. */
export const MOVE_MARK_ERROR_COPY: Readonly<Record<MoveMarkErrorCode, string>> = Object.freeze({
  unauthorized: 'Please sign in to mark a move.',
  invalid_mark_code: 'That mark is not available.',
  argument_not_found: 'We could not find that move.',
  debate_argument_mismatch: 'That move is not in this room.',
  argument_deleted: 'That move is no longer here.',
  cannot_mark_own_move: 'You cannot mark your own move.',
  not_a_participant: 'Join this room to mark a move.',
  validation_failed: 'That mark could not be saved — nothing else changed.',
  network_error: 'We could not reach the server — nothing else changed.',
  unknown: 'That mark could not be saved — nothing else changed.',
});

/** Map a raw Edge code to the reconciled union; unknown codes fall back. */
export function toMoveMarkErrorCode(rawCode: string | undefined): MoveMarkErrorCode {
  const known: ReadonlyArray<MoveMarkErrorCode> = [
    'unauthorized',
    'invalid_mark_code',
    'argument_not_found',
    'debate_argument_mismatch',
    'argument_deleted',
    'cannot_mark_own_move',
    'not_a_participant',
    'validation_failed',
    'network_error',
  ];
  return (known as ReadonlyArray<string>).includes(rawCode ?? '')
    ? (rawCode as MoveMarkErrorCode)
    : 'unknown';
}

/** All UI-rendered strings, for the ban-list scan (single source of truth). */
export function allRenderedMoveMarkStrings(): string[] {
  return [
    ...Object.values(MOVE_MARK_LABEL),
    ...Object.values(MOVE_MARK_A11Y_LABEL),
    ...Object.values(MOVE_MARKS_BAR_COPY),
    MOVE_MARKS_LEGEND_LINE,
    ...Object.values(MOVE_MARK_ERROR_COPY),
  ];
}

/** A ban-list of codes that never reach the UI as a label (defensive helper). */
export function isUiMoveMarkCode(code: MoveMarkCode): code is MoveMarkUiCode {
  return code === 'addressed_my_point' || code === 'did_not_address' || code === 'receipts_requested';
}
