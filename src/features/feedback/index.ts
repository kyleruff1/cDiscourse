/**
 * FEEDBACK-001 (#898) — feedback feature barrel.
 *
 * The human move-mark layer: a mark is a structural observation about a MOVE,
 * never a verdict on a person and NEVER a score. Nothing here imports
 * pointStanding; the aggregate feeds the mediator projection + heat only.
 */
export {
  ALL_MOVE_MARK_CODES,
  MUTUALLY_EXCLUSIVE_PAIR,
  emptyViewerMoveMarkState,
  isMoveMarkCode,
  oppositeOf,
  summarizeViewerMarks,
  type MoveMarkCode,
  type MoveMarkRow,
  type ViewerMoveMarkState,
} from './moveMarksModel';
export {
  RECEIPTS_PROMPT_THRESHOLD,
  deriveMoveMarkAggregate,
  receiptsPromptMoveIds,
  type MoveMarkAggregate,
} from './moveMarkAggregateModel';
export {
  MOVE_MARK_A11Y_LABEL,
  MOVE_MARK_ERROR_COPY,
  MOVE_MARK_LABEL,
  MOVE_MARK_PAIR_CODES,
  MOVE_MARK_RECEIPTS_CODE,
  MOVE_MARKS_BAR_COPY,
  MOVE_MARKS_LEGEND_LINE,
  allRenderedMoveMarkStrings,
  isUiMoveMarkCode,
  toMoveMarkErrorCode,
  type MoveMarkErrorCode,
  type MoveMarkUiCode,
} from './moveMarksCopy';
export { setMoveMark, retractMoveMark, type MoveMarkApiInput, type MoveMarkApiResult } from './moveMarksApi';
export { BooleanFeedbackBar, type BooleanFeedbackBarProps } from './BooleanFeedbackBar';
export { useMoveMarks, type UseMoveMarksInput, type UseMoveMarksResult } from './useMoveMarks';
