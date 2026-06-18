/**
 * DEMO-001 — Recruitable Debate Demo Corridor: the pure state machine.
 *
 * Pure TypeScript. No React, no Supabase, no network, no provider, no AI,
 * no `Date.now`. The corridor walks a cold viewer through exactly one
 * disagreement using the REAL shipped components fed from the bundled
 * `demoFixtureRoom` fixture. This module owns:
 *   - the frozen 7-step teaching script (`CORRIDOR_STEPS`),
 *   - the one-primary-action invariant helper (`countPrimaryActions`),
 *   - the deterministic reducer (`advanceCorridor`),
 *   - the scripted move → fixture-state resolution (`resolveCorridorView`),
 *   - the frozen, ban-list-clean copy set (`CORRIDOR_COPY`),
 *   - the surface-action → demo-move mapping (`mapControlToDemoMove`),
 *   - the pre-network submit suppressor factory (`makeDemoBeforeSubmit`).
 *
 * Plain moves only — no internal type codes ever reach the viewer
 * (REF-ADR-001 / cdiscourse-doctrine §9). No verdict / person token appears
 * anywhere in the copy (cdiscourse-doctrine §1); the `demoCorridorCopy` test
 * scans every atom.
 */
import type { ArgumentBubbleControl } from '../arguments/argumentGameSurfaceModel';
import type { QuickActionLabel } from '../arguments/quickActionPresets';
import {
  DEMO_FIXTURE_ROOM,
  DEMO_MOVE_TRANSITIONS,
  DEMO_MSG,
  type DemoFixtureStateId,
  type DemoMoveCode,
} from './demoFixtureRoom';

export { DEMO_MOVE_TRANSITIONS } from './demoFixtureRoom';
export type { DemoFixtureStateId, DemoMoveCode } from './demoFixtureRoom';

// ── Public types ───────────────────────────────────────────────

/** The seven teaching beats of the corridor (one disagreement, end to end). */
export type CorridorStepKind =
  | 'claim' // 1. Here is the room's one claim.
  | 'disputed_point' // 2. Here is the one disputed point.
  | 'referee_open_task' // 3. The Referee Card says what remains open (Source owed).
  | 'choose_move' // 4. Pick Ask source / Add evidence / Narrow / Open a side issue.
  | 'issue_state_change' // 5. The referee now reads the point through your move.
  | 'progress' // 6. The open-issues list reflects it.
  | 'closing'; // 7. Recruit-friendly exit.

export interface CorridorPrimaryAction {
  /** Exactly one per step. */
  kind: 'advance' | 'choose_move' | 'exit' | 'replay';
  label: string;
  accessibilityLabel: string;
}

export interface CorridorSecondaryAction {
  kind: 'back' | 'exit' | 'replay';
  label: string;
  accessibilityLabel: string;
  /** Always 'subordinate' — drives the lower-visual-weight render contract. */
  emphasis: 'subordinate';
}

export interface CorridorMoveMenuItem {
  code: DemoMoveCode;
  label: string;
  accessibilityLabel: string;
}

export interface CorridorStep {
  id: string;
  kind: CorridorStepKind;
  /** 1-2 plain teaching lines shown in the guidance panel. */
  teachingLines: ReadonlyArray<string>;
  /** EXACTLY ONE primary action. */
  primaryAction: CorridorPrimaryAction;
  /** 0..n subordinate actions. */
  secondaryActions: ReadonlyArray<CorridorSecondaryAction>;
  /** Present only on the `choose_move` step: the bounded four-move menu. */
  moveMenu?: ReadonlyArray<CorridorMoveMenuItem>;
}

export interface CorridorState {
  stepIndex: number;
  fixtureStateId: DemoFixtureStateId;
  /** Set when a move is picked; drives steps 5-6 fixture + copy. */
  chosenMove: DemoMoveCode | null;
  complete: boolean;
}

export type CorridorEvent =
  | { type: 'ADVANCE' }
  | { type: 'MOVE_PICKED'; move: DemoMoveCode }
  | { type: 'MOVE_CONFIRMED' }
  | { type: 'BACK' }
  | { type: 'REPLAY' };

/** What the screen renders beneath the guidance for a given state. */
export interface CorridorView {
  fixtureStateId: DemoFixtureStateId;
  /** The node whose Referee Card teaches; null on the closing beat. */
  focusMessageId: string | null;
  /** True only on the closing beat — the screen swaps to the closing card. */
  isClosing: boolean;
}

// ════════════════════════════════════════════════════════════════
// Frozen, ban-list-clean copy set (REF-ADR-001 plain moves only)
// ════════════════════════════════════════════════════════════════

export const CORRIDOR_COPY = Object.freeze({
  /** Gallery-toolbar entry affordance. */
  entryLabel: 'See how it works',
  entryAccessibilityLabel: 'See how CivilDiscourse works — a short guided walkthrough',
  /** Stand-in framing shown at the first beat (design open-question resolution). */
  standInFraming: 'Step into one side of a live dispute. You are a stand-in here — nothing you do leaves this walkthrough.',

  /** Per-step teaching lines. */
  claimLines: Object.freeze(['Every room starts with one claim.', "Here is this room's."]),
  disputedPointLines: Object.freeze([
    'One specific point is in dispute —',
    'not the whole topic.',
  ]),
  refereeOpenTaskLines: Object.freeze([
    'The referee notes what is still open here:',
    'a source is owed for this point.',
  ]),
  chooseMoveLines: Object.freeze(['Your turn.', 'Pick one move.']),
  issueStateChangeLines: Object.freeze([
    'Your move is on the record.',
    'See how the referee now reads this point.',
  ]),
  progressLines: Object.freeze([
    'And the open-issues list reflects it.',
    'That is the whole loop.',
  ]),

  /** The four plain move labels (sourced to match the real Act entries). */
  moveAskSource: 'Ask for a source',
  moveAddEvidence: 'Add evidence',
  moveNarrow: 'Narrow the scope',
  moveBranch: 'Open a side issue',

  /** The demo composer intro line. */
  composerIntro: 'This is the real composer. Edit if you like, then post your move.',

  /** Primary-action labels. */
  advanceToDisputed: 'Next: the disputed point',
  advanceToReferee: 'Next: what the referee notes',
  advanceToChooseMove: 'Next: your move',
  advanceToProgress: 'Next: the open-issues list',
  advanceToClosing: 'Finish the walkthrough',
  chooseMovePrompt: 'Pick one move below',
  closingPrimary: 'Jump into a real room',

  /** Subordinate-action labels. */
  back: 'Back',
  closeDemo: 'Close the walkthrough',
  replay: 'Replay the walkthrough',

  /** Closing beat. */
  closingHeadline: 'That is CivilDiscourse',
  closingRecruitLine: 'Every disagreement becomes one clear, movable point.',
});

// ════════════════════════════════════════════════════════════════
// Frozen 7-step script
// ════════════════════════════════════════════════════════════════

const MOVE_MENU: ReadonlyArray<CorridorMoveMenuItem> = Object.freeze<CorridorMoveMenuItem[]>([
  { code: 'ask_source', label: CORRIDOR_COPY.moveAskSource, accessibilityLabel: 'Ask for a source on this point' },
  { code: 'add_evidence', label: CORRIDOR_COPY.moveAddEvidence, accessibilityLabel: 'Add evidence to this point' },
  { code: 'narrow', label: CORRIDOR_COPY.moveNarrow, accessibilityLabel: 'Narrow the scope of this point' },
  { code: 'branch', label: CORRIDOR_COPY.moveBranch, accessibilityLabel: 'Open a side issue from this point' },
]);

function advance(label: string, accessibilityLabel: string): CorridorPrimaryAction {
  return { kind: 'advance', label, accessibilityLabel };
}

const BACK_ACTION: CorridorSecondaryAction = Object.freeze({
  kind: 'back',
  label: CORRIDOR_COPY.back,
  accessibilityLabel: 'Go back one step in the walkthrough',
  emphasis: 'subordinate',
});

export const CORRIDOR_STEPS: ReadonlyArray<CorridorStep> = Object.freeze<CorridorStep[]>([
  {
    id: 'step-claim',
    kind: 'claim',
    teachingLines: CORRIDOR_COPY.claimLines,
    primaryAction: advance(CORRIDOR_COPY.advanceToDisputed, 'Continue to the disputed point'),
    secondaryActions: Object.freeze([]),
  },
  {
    id: 'step-disputed-point',
    kind: 'disputed_point',
    teachingLines: CORRIDOR_COPY.disputedPointLines,
    primaryAction: advance(CORRIDOR_COPY.advanceToReferee, 'Continue to what the referee notes'),
    secondaryActions: Object.freeze([BACK_ACTION]),
  },
  {
    id: 'step-referee-open-task',
    kind: 'referee_open_task',
    teachingLines: CORRIDOR_COPY.refereeOpenTaskLines,
    primaryAction: advance(CORRIDOR_COPY.advanceToChooseMove, 'Continue to your move'),
    secondaryActions: Object.freeze([BACK_ACTION]),
  },
  {
    id: 'step-choose-move',
    kind: 'choose_move',
    teachingLines: CORRIDOR_COPY.chooseMoveLines,
    primaryAction: {
      kind: 'choose_move',
      label: CORRIDOR_COPY.chooseMovePrompt,
      accessibilityLabel: 'Pick one of four moves below',
    },
    secondaryActions: Object.freeze([BACK_ACTION]),
    moveMenu: MOVE_MENU,
  },
  {
    id: 'step-issue-state-change',
    kind: 'issue_state_change',
    teachingLines: CORRIDOR_COPY.issueStateChangeLines,
    primaryAction: advance(CORRIDOR_COPY.advanceToProgress, 'Continue to the open-issues list'),
    secondaryActions: Object.freeze([BACK_ACTION]),
  },
  {
    id: 'step-progress',
    kind: 'progress',
    teachingLines: CORRIDOR_COPY.progressLines,
    primaryAction: advance(CORRIDOR_COPY.advanceToClosing, 'Finish the walkthrough'),
    secondaryActions: Object.freeze([BACK_ACTION]),
  },
  {
    id: 'step-closing',
    kind: 'closing',
    teachingLines: Object.freeze([CORRIDOR_COPY.closingRecruitLine]),
    primaryAction: {
      kind: 'exit',
      label: CORRIDOR_COPY.closingPrimary,
      accessibilityLabel: 'Leave the walkthrough and open a real room',
    },
    secondaryActions: Object.freeze([
      {
        kind: 'replay',
        label: CORRIDOR_COPY.replay,
        accessibilityLabel: 'Replay the walkthrough from the start',
        emphasis: 'subordinate',
      },
    ]),
  },
]);

const LAST_STEP_INDEX = CORRIDOR_STEPS.length - 1;

// ── Step-index helpers ─────────────────────────────────────────

function stepKindAt(index: number): CorridorStepKind | null {
  const step = CORRIDOR_STEPS[index];
  return step ? step.kind : null;
}

function isPostMoveKind(kind: CorridorStepKind | null): boolean {
  return kind === 'issue_state_change' || kind === 'progress';
}

/**
 * Derive which fixture state a (stepIndex, chosenMove) renders. Post-move
 * beats render the chosen move's scripted state; every other beat renders
 * the `disputed` tableau (the composer-open state still shows `disputed`
 * because the move is not "posted" until confirmed).
 */
export function deriveFixtureStateId(
  stepIndex: number,
  chosenMove: DemoMoveCode | null,
): DemoFixtureStateId {
  if (chosenMove !== null && isPostMoveKind(stepKindAt(stepIndex))) {
    return DEMO_MOVE_TRANSITIONS[chosenMove];
  }
  return 'disputed';
}

// ── Public API ─────────────────────────────────────────────────

export function initialCorridorState(): CorridorState {
  return { stepIndex: 0, fixtureStateId: 'disputed', chosenMove: null, complete: false };
}

/** The invariant helper — exactly one primary action per step. */
export function countPrimaryActions(step: CorridorStep): number {
  return step.primaryAction ? 1 : 0;
}

export function isCorridorComplete(state: CorridorState): boolean {
  return state.complete === true;
}

/** True when a move has been picked and the demo composer should be open. */
export function isComposerOpen(state: CorridorState): boolean {
  return state.chosenMove !== null && stepKindAt(state.stepIndex) === 'choose_move';
}

/** Resolve the fixture + focus node the screen renders for a state. */
export function resolveCorridorView(state: CorridorState): CorridorView {
  const kind = stepKindAt(state.stepIndex);
  if (kind === 'closing') {
    return { fixtureStateId: 'disputed', focusMessageId: null, isClosing: true };
  }
  const fixtureStateId = deriveFixtureStateId(state.stepIndex, state.chosenMove);
  let focusMessageId: string;
  if (kind === 'claim') {
    focusMessageId = DEMO_MSG.root;
  } else if (isPostMoveKind(kind) && state.chosenMove !== null) {
    focusMessageId = DEMO_FIXTURE_ROOM[fixtureStateId].activeMessageId;
  } else {
    // disputed_point / referee_open_task / choose_move all teach on the
    // disputed sub-claim (the node that owes a source).
    focusMessageId = DEMO_MSG.claim;
  }
  return { fixtureStateId, focusMessageId, isClosing: false };
}

/** The pure, deterministic reducer. Same events → same state. */
export function advanceCorridor(state: CorridorState, event: CorridorEvent): CorridorState {
  switch (event.type) {
    case 'ADVANCE': {
      const step = CORRIDOR_STEPS[state.stepIndex];
      // Only 'advance'-kind steps move forward on ADVANCE. The choose_move
      // step waits for a MOVE_PICKED → MOVE_CONFIRMED; the closing step exits.
      if (!step || step.primaryAction.kind !== 'advance') return state;
      const nextIndex = Math.min(state.stepIndex + 1, LAST_STEP_INDEX);
      return {
        stepIndex: nextIndex,
        fixtureStateId: deriveFixtureStateId(nextIndex, state.chosenMove),
        chosenMove: state.chosenMove,
        complete: stepKindAt(nextIndex) === 'closing',
      };
    }
    case 'MOVE_PICKED': {
      if (stepKindAt(state.stepIndex) !== 'choose_move') return state;
      return {
        ...state,
        chosenMove: event.move,
        // The surface still shows `disputed` behind the composer until confirm.
        fixtureStateId: deriveFixtureStateId(state.stepIndex, event.move),
        complete: false,
      };
    }
    case 'MOVE_CONFIRMED': {
      if (stepKindAt(state.stepIndex) !== 'choose_move' || state.chosenMove === null) return state;
      const nextIndex = Math.min(state.stepIndex + 1, LAST_STEP_INDEX);
      return {
        stepIndex: nextIndex,
        fixtureStateId: deriveFixtureStateId(nextIndex, state.chosenMove),
        chosenMove: state.chosenMove,
        complete: stepKindAt(nextIndex) === 'closing',
      };
    }
    case 'BACK': {
      // Composer open → cancel back to the move menu (no fixture mutation).
      if (isComposerOpen(state)) {
        return {
          ...state,
          chosenMove: null,
          fixtureStateId: deriveFixtureStateId(state.stepIndex, null),
          complete: false,
        };
      }
      const prevIndex = Math.max(0, state.stepIndex - 1);
      // Keep the chosen move only when stepping back into a post-move beat;
      // stepping back to `choose_move` clears it so the viewer can re-pick.
      const keepMove = isPostMoveKind(stepKindAt(prevIndex)) ? state.chosenMove : null;
      return {
        stepIndex: prevIndex,
        fixtureStateId: deriveFixtureStateId(prevIndex, keepMove),
        chosenMove: keepMove,
        complete: false,
      };
    }
    case 'REPLAY':
      return initialCorridorState();
    default:
      return state;
  }
}

// ── Surface-action → demo-move mapping ─────────────────────────

const CONTROL_TO_MOVE: Readonly<Partial<Record<ArgumentBubbleControl, DemoMoveCode>>> = Object.freeze({
  ask_for_source: 'ask_source',
  ask_for_quote: 'ask_source',
  branch: 'branch',
});

const ARG_TYPE_TO_MOVE: Readonly<Record<string, DemoMoveCode>> = Object.freeze({
  evidence: 'add_evidence',
  concession: 'narrow',
  clarification_request: 'ask_source',
});

/**
 * Map a surface action (an `ArgumentBubbleControl`, optionally disambiguated
 * by the resolved preset's argument type) onto one of the four demo moves.
 * Returns `null` when nothing maps — the caller falls back to the active
 * step's default move so the corridor never dispatches `undefined`.
 */
export function mapControlToDemoMove(
  control: ArgumentBubbleControl,
  presetArgumentType?: string | null,
): DemoMoveCode | null {
  const direct = CONTROL_TO_MOVE[control];
  if (direct) return direct;
  if (presetArgumentType && ARG_TYPE_TO_MOVE[presetArgumentType]) {
    return ARG_TYPE_TO_MOVE[presetArgumentType];
  }
  return null;
}

/** The default move used when a surface action does not map to one. */
export const DEFAULT_DEMO_MOVE: DemoMoveCode = MOVE_MENU[0].code;

/**
 * Each demo move → the SHIPPED `QuickActionLabel` whose `quickActionToPreset`
 * seeds the real composer (the exact production composer entry point). The
 * demo never invents a preset; it reuses the same machinery a real room uses.
 */
export const DEMO_MOVE_TO_QUICK_ACTION: Readonly<Record<DemoMoveCode, QuickActionLabel>> = Object.freeze({
  ask_source: 'source',
  add_evidence: 'evidence',
  narrow: 'narrow',
  branch: 'branch',
});

/**
 * Build the `onBeforeSubmit` the demo composer passes to the REAL OneBox.
 * It records the confirm (advancing the corridor) and ALWAYS returns
 * `false`, so the production post handler short-circuits BEFORE the
 * composer's own submit — the network submit call is never reached, and no
 * write and no submit-chain edit occurs. This is the only seam the corridor
 * uses to intercept the move (design §"Move-interception seam").
 */
export function makeDemoBeforeSubmit(onConfirm: () => void): () => boolean {
  return () => {
    onConfirm();
    return false;
  };
}
