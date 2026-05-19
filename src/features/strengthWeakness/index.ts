/**
 * SW-002 — Strength / weakness public-surface barrel.
 *
 * Re-exports the SW-002 heat / momentum / trend deriver + its typed
 * unions + the helper-line lookup. Single import surface for consumers
 * (GAL-001 / GAL-002 / IX-002 in future cards). Pure-TS, no React, no
 * Supabase, no network.
 */

export type {
  ActivityChip,
  ActivityChipKind,
  ActivitySegment,
  ActivityThresholds,
  EntryOpportunity,
  HeatInputBundle,
  HeatLevel,
  MomentumState,
  RoomActivityProfile,
  TrendDirection,
} from './heatModel';

export {
  ACTIVITY_HELPER_LINES,
  ALL_ACTIVITY_CHIP_KINDS,
  ALL_ENTRY_OPPORTUNITIES,
  ALL_HEAT_LEVELS,
  ALL_MOMENTUM_STATES,
  ALL_TREND_DIRECTIONS,
  DEFAULT_ACTIVITY_THRESHOLDS,
  _forbiddenActivityTokens,
  deriveRoomActivityChips,
  deriveRoomActivityProfile,
} from './heatModel';
