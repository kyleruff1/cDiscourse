/**
 * QOL-041 — concessions feature public surface.
 *
 * Re-exports the pure-TS model layer. UI components (the .tsx files in
 * this directory and under `src/features/arguments/oneBox/schemas/`) are
 * intentionally NOT re-exported here so a pure-TS consumer never pulls
 * a React dependency in through this barrel.
 */

// Acceptance gradient — the 5-level enum + plain-language copy + the
// vocabulary bridge to point-standing's ConcessionEffect families.
export {
  ALL_ACCEPTANCE_LEVELS,
  ACCEPTANCE_LEVEL_COPY,
  ACCEPTANCE_TO_CONCESSION_EFFECT,
  acceptanceRequiresClarification,
  _forbiddenAcceptanceGradientTokens,
  type AcceptanceLevel,
  type AcceptanceLevelCopy,
} from './acceptanceGradient';

// Concession forced-list (the `respond` box's concession section model).
export {
  MAX_CONCESSION_ITEMS,
  MAX_CONCESSION_ITEM_LENGTH,
  EMPTY_CONCESSION_LIST_DRAFT,
  addConcessionItem,
  removeConcessionItem,
  updateConcessionItemText,
  reorderConcessionItem,
  validateConcessionListDraft,
  buildConcessionItemsPayload,
  type ConcessionItemDraft,
  type ConcessionListDraft,
  type ConcessionListIssue,
  type ConcessionListValidation,
  type ConcessionItemPayload,
} from './concessionListModel';

// Respond-to-concession mirrored-list model.
export {
  MAX_CLARIFICATION_LENGTH,
  buildRespondToConcessionDraft,
  setRowLevel,
  setRowClarification,
  isPostable,
  buildConcessionAcceptancesPayload,
  type IncomingConcessionItem,
  type RespondToConcessionRowDraft,
  type RespondToConcessionDraft,
  type RespondToConcessionBlockingReason,
  type RespondToConcessionPostability,
  type ConcessionAcceptancePayload,
} from './respondToConcessionModel';

// Active-disagreement derivation (room status strip).
export {
  ALL_ACTIVE_DISAGREEMENT_KINDS,
  ACTIVE_DISAGREEMENT_LABEL,
  deriveActiveDisagreement,
  activeDisagreementLabel,
  type ActiveDisagreementKind,
  type ConcessionAcceptanceRow,
} from './activeDisagreement';

// Move-reaction (fist-bump) model.
export {
  ALL_MOVE_REACTION_KINDS,
  summarizeReactions,
  type MoveReactionKind,
  type MoveReactionRow,
  type MoveReactionSummary,
} from './moveReactionModel';
