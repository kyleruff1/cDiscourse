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

// ── GAME-003 — Argument mode model ───────────────────────────────────────
//
// Pure-TS argument-mode model: the 13-mode enum, the per-mode definition
// type + template wrapper, the 13 template definitions (4 shipped, 9
// design-only), and the accessor / setup-screen-support functions. No
// React, no Supabase, no network. The mode SETUP SCREEN is a named
// follow-up card (GAME-003B) and is NOT exported here.

export type {
  ArgumentMode,
  SemanticClassificationMode,
  ArgumentModeDefinition,
  ArgumentModeStatus,
  ArgumentModeTemplate,
  ModeRuleRow,
} from './argumentModeModel';

export {
  ALL_ARGUMENT_MODES,
  MVP_ARGUMENT_MODES,
  DESIGN_ONLY_ARGUMENT_MODES,
  DEFAULT_ARGUMENT_MODE,
  ARGUMENT_MODE_TEMPLATES,
  argumentModeTemplate,
  argumentModeDefinition,
  isShippedMode,
  isSensitiveMode,
  coerceArgumentMode,
  argumentModeDisplayName,
  argumentModeDescription,
  buildModeRuleRows,
  reviewModeForArgumentMode,
  _forbiddenArgumentModeTokens,
} from './argumentModeModel';
