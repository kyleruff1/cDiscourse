/**
 * MARK-002 (#894) — marker user-facing copy.
 *
 * Every string the marker surfaces authors lives here, frozen, so the ban-list
 * test can scan it. Markers describe the MOMENT, never the person: no verdict or
 * person token appears anywhere (winner / loser / liar / true / false / correct
 * / dishonest / bad faith / manipulative / extremist / propagandist). Internal
 * codes never reach the UI: every reconciled error code maps through
 * MARKER_ERROR_COPY; an unknown code falls back, never echoed (the gameCopy
 * discipline).
 *
 * Comments here are apostrophe-free (the uxOneOneTwoDoctrine quote-parity
 * gotcha). The copy STRINGS carry typographic quotes but no straight apostrophe.
 */

export const MARKER_COPY = Object.freeze({
  /** The flag-gated affordance on a non-own Ringside card. */
  respondToThis: 'Respond to this',
  respondToThisA11yLabel: 'Respond to a phrase of this move',
  /** The phrase-picker sheet. */
  pickerHeader: 'Pick a phrase to respond to',
  pickerCancel: 'Cancel',
  pickerCancelA11yLabel: 'Cancel choosing a phrase',
  /** The whole-move fallback row when the body has no clear phrase boundary. */
  wholeMoveLabel: 'Whole move',
  /** The composer scope chip. */
  composerScopeA11yLabel: 'Quoted phrase for this reply',
  composerScopeClearA11yLabel: 'Clear the quoted phrase',
  composerScopeContextPrefix: 'Quoting: ',
  /** The reply reference chip deep-links to the source span. */
  replyChipChevron: ' ›',
  replyChipA11yLabel: 'Go to the quoted phrase in the move',
  /** The calm orphaned tombstone (states the fact of removal; no verdict). */
  orphanedLabel: 'Quoted move was removed',
});

/** The reconciled error codes the room maps to plain language. */
export type MarkerErrorCode =
  | 'unauthorized'
  | 'not_a_participant'
  | 'target_not_found'
  | 'debate_argument_mismatch'
  | 'span_out_of_bounds'
  | 'span_too_long'
  | 'quote_mismatch'
  | 'validation_failed'
  | 'reply_not_found'
  | 'not_your_reply'
  | 'debate_reply_mismatch'
  | 'marker_cap_reached'
  | 'network_error'
  | 'unknown';

/** Plain-language message per reconciled code. Never the raw code. */
export const MARKER_ERROR_COPY: Readonly<Record<MarkerErrorCode, string>> = Object.freeze({
  unauthorized: 'Please sign in to quote a phrase.',
  not_a_participant: 'Join this room to quote a phrase.',
  target_not_found: 'We could not find that move.',
  debate_argument_mismatch: 'That move is not in this room.',
  span_out_of_bounds: 'That phrase is no longer in the move — pick it again.',
  span_too_long: 'That selection is too long to quote.',
  quote_mismatch: 'That phrase does not match the move any more — pick it again.',
  validation_failed: 'That quote could not be saved — pick the phrase again.',
  reply_not_found: 'We could not find your reply.',
  not_your_reply: 'You can only add a quote to your own reply.',
  debate_reply_mismatch: 'That reply is not in this room.',
  marker_cap_reached: 'You have marked the most phrases you can on this move.',
  network_error: 'We could not reach the server — your reply was still posted.',
  unknown: 'That quote could not be saved — your reply was still posted.',
});

/** Map a raw Edge code to the reconciled union; unknown codes fall back. */
export function toMarkerErrorCode(rawCode: string | undefined): MarkerErrorCode {
  const known: ReadonlyArray<MarkerErrorCode> = [
    'unauthorized',
    'not_a_participant',
    'target_not_found',
    'debate_argument_mismatch',
    'span_out_of_bounds',
    'span_too_long',
    'quote_mismatch',
    'validation_failed',
    'reply_not_found',
    'not_your_reply',
    'debate_reply_mismatch',
    'marker_cap_reached',
    'network_error',
  ];
  return (known as ReadonlyArray<string>).includes(rawCode ?? '')
    ? (rawCode as MarkerErrorCode)
    : 'unknown';
}
