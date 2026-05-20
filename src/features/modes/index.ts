/**
 * GAME-002 — Mode-level turn pacing barrel.
 *
 * Pure-TS pacing model + the presentational `PacingChip`. No Supabase, no
 * network. GAME-003 mode templates and RULE-004's pre-send sheet read from
 * here.
 */

export type {
  PacingRule,
  PacingMoveRecord,
  PacingEvaluationInput,
  PacingEvaluation,
  PacingBlockReason,
  PacingChipViewModel,
} from './pacingModel';

export {
  DEFAULT_CASUAL_PACING_RULE,
  createPacingRule,
  isNoPacingRule,
  evaluatePacing,
  formatCountdown,
  buildPacingChipViewModel,
  describePermanentRecord,
  getDevPacingOverride,
  setDevPacingOverride,
} from './pacingModel';

export { PacingChip } from './PacingChip';
export type { PacingChipProps } from './PacingChip';
