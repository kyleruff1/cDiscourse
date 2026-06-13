/**
 * DEMO-001 — Recruitable Debate Demo Corridor public surface.
 *
 * Exports the route screen + the pure model symbols (consumed by tests). No
 * Supabase, no network, no provider, no AI anywhere in this feature.
 */
export { DemoCorridorScreen } from './DemoCorridorScreen';
export type { DemoCorridorScreenProps } from './DemoCorridorScreen';

export {
  CORRIDOR_STEPS,
  CORRIDOR_COPY,
  DEMO_MOVE_TRANSITIONS,
  DEMO_MOVE_TO_QUICK_ACTION,
  DEFAULT_DEMO_MOVE,
  advanceCorridor,
  initialCorridorState,
  isCorridorComplete,
  isComposerOpen,
  countPrimaryActions,
  resolveCorridorView,
  deriveFixtureStateId,
  mapControlToDemoMove,
  makeDemoBeforeSubmit,
} from './corridorModel';
export type {
  CorridorStep,
  CorridorStepKind,
  CorridorState,
  CorridorEvent,
  CorridorView,
  CorridorPrimaryAction,
  CorridorSecondaryAction,
  CorridorMoveMenuItem,
  DemoMoveCode,
  DemoFixtureStateId,
} from './corridorModel';

export {
  DEMO_FIXTURE_ROOM,
  DEMO_MOVE_TRANSITIONS as DEMO_FIXTURE_MOVE_TRANSITIONS,
  DEMO_ROOM_ID,
  DEMO_VIEWER_ID,
  DEMO_MSG,
  DEMO_DEBATE,
  DEMO_PARENT_ARGUMENT,
  DEMO_FIXTURE_NOW_MS,
  ALL_DEMO_FIXTURE_STATE_IDS,
  ALL_DEMO_MOVE_CODES,
  ALL_DEMO_FIXTURE_STRINGS,
} from './demoFixtureRoom';
export type { DemoFixtureRoomState } from './demoFixtureRoom';
