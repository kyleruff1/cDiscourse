/**
 * DEMO-001 — Corridor pure state-machine tests.
 *
 * Pure model (no React, no Supabase, no network). Pins step progression,
 * determinism, the one-primary-action invariant, the scripted move → state
 * table, replay idempotence, and the surface-action mapping.
 */
import {
  CORRIDOR_STEPS,
  advanceCorridor,
  initialCorridorState,
  isCorridorComplete,
  isComposerOpen,
  countPrimaryActions,
  resolveCorridorView,
  deriveFixtureStateId,
  mapControlToDemoMove,
  makeDemoBeforeSubmit,
  DEFAULT_DEMO_MOVE,
  DEMO_MOVE_TRANSITIONS,
  type CorridorState,
  type CorridorEvent,
  type DemoMoveCode,
} from '../src/features/demoCorridor/corridorModel';

function run(events: CorridorEvent[], from: CorridorState = initialCorridorState()): CorridorState {
  return events.reduce((s, e) => advanceCorridor(s, e), from);
}

describe('CORRIDOR_STEPS', () => {
  it('is a frozen 7-step script in teaching order', () => {
    expect(CORRIDOR_STEPS).toHaveLength(7);
    expect(CORRIDOR_STEPS.map((s) => s.kind)).toEqual([
      'claim',
      'disputed_point',
      'referee_open_task',
      'choose_move',
      'issue_state_change',
      'progress',
      'closing',
    ]);
    expect(Object.isFrozen(CORRIDOR_STEPS)).toBe(true);
  });

  it('one-primary-action invariant: every step has exactly one primary action', () => {
    for (const step of CORRIDOR_STEPS) {
      expect(countPrimaryActions(step)).toBe(1);
    }
  });

  it('only the choose_move step exposes the four-move menu', () => {
    for (const step of CORRIDOR_STEPS) {
      if (step.kind === 'choose_move') {
        expect(step.moveMenu).toBeDefined();
        expect(step.moveMenu).toHaveLength(4);
        expect(step.moveMenu!.map((m) => m.code)).toEqual([
          'ask_source',
          'add_evidence',
          'narrow',
          'branch',
        ]);
      } else {
        expect(step.moveMenu).toBeUndefined();
      }
    }
  });

  it('every secondary action is subordinate', () => {
    for (const step of CORRIDOR_STEPS) {
      for (const sa of step.secondaryActions) {
        expect(sa.emphasis).toBe('subordinate');
      }
    }
  });
});

describe('initialCorridorState', () => {
  it('starts at the claim beat on the disputed fixture with no move chosen', () => {
    expect(initialCorridorState()).toEqual({
      stepIndex: 0,
      fixtureStateId: 'disputed',
      chosenMove: null,
      complete: false,
    });
  });
});

describe('advanceCorridor — ADVANCE', () => {
  it('walks claim → disputed_point → referee_open_task, then waits on choose_move', () => {
    const s1 = advanceCorridor(initialCorridorState(), { type: 'ADVANCE' });
    expect(CORRIDOR_STEPS[s1.stepIndex].kind).toBe('disputed_point');
    const s2 = advanceCorridor(s1, { type: 'ADVANCE' });
    expect(CORRIDOR_STEPS[s2.stepIndex].kind).toBe('referee_open_task');
    const s3 = advanceCorridor(s2, { type: 'ADVANCE' });
    expect(CORRIDOR_STEPS[s3.stepIndex].kind).toBe('choose_move');
    // ADVANCE on choose_move is a no-op — the viewer must pick a move.
    const s4 = advanceCorridor(s3, { type: 'ADVANCE' });
    expect(s4).toEqual(s3);
  });

  it('ADVANCE on the closing step is a no-op (exit is not an advance)', () => {
    const closing = run([
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'MOVE_PICKED', move: 'ask_source' },
      { type: 'MOVE_CONFIRMED' },
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
    ]);
    expect(CORRIDOR_STEPS[closing.stepIndex].kind).toBe('closing');
    expect(advanceCorridor(closing, { type: 'ADVANCE' })).toEqual(closing);
  });
});

describe('advanceCorridor — MOVE_PICKED / MOVE_CONFIRMED', () => {
  const reachChoose = (): CorridorState =>
    run([{ type: 'ADVANCE' }, { type: 'ADVANCE' }, { type: 'ADVANCE' }]);

  it('MOVE_PICKED is ignored off the choose_move beat', () => {
    const s0 = initialCorridorState();
    expect(advanceCorridor(s0, { type: 'MOVE_PICKED', move: 'narrow' })).toEqual(s0);
  });

  it('MOVE_PICKED opens the composer but does not advance the step', () => {
    const picked = advanceCorridor(reachChoose(), { type: 'MOVE_PICKED', move: 'narrow' });
    expect(CORRIDOR_STEPS[picked.stepIndex].kind).toBe('choose_move');
    expect(picked.chosenMove).toBe('narrow');
    expect(isComposerOpen(picked)).toBe(true);
    // The surface still shows the disputed tableau behind the composer.
    expect(picked.fixtureStateId).toBe('disputed');
  });

  it('MOVE_CONFIRMED advances to issue_state_change on the move\'s scripted fixture state', () => {
    const moves: DemoMoveCode[] = ['ask_source', 'add_evidence', 'narrow', 'branch'];
    for (const move of moves) {
      const confirmed = run(
        [{ type: 'MOVE_PICKED', move }, { type: 'MOVE_CONFIRMED' }],
        reachChoose(),
      );
      expect(CORRIDOR_STEPS[confirmed.stepIndex].kind).toBe('issue_state_change');
      expect(confirmed.chosenMove).toBe(move);
      expect(confirmed.fixtureStateId).toBe(DEMO_MOVE_TRANSITIONS[move]);
    }
  });

  it('MOVE_CONFIRMED with no chosen move is a no-op', () => {
    const choose = reachChoose();
    expect(advanceCorridor(choose, { type: 'MOVE_CONFIRMED' })).toEqual(choose);
  });
});

describe('advanceCorridor — BACK', () => {
  it('cancels the open composer back to the move menu (no fixture mutation)', () => {
    const picked = run(
      [{ type: 'ADVANCE' }, { type: 'ADVANCE' }, { type: 'ADVANCE' }, { type: 'MOVE_PICKED', move: 'narrow' }],
    );
    const back = advanceCorridor(picked, { type: 'BACK' });
    expect(CORRIDOR_STEPS[back.stepIndex].kind).toBe('choose_move');
    expect(back.chosenMove).toBeNull();
    expect(isComposerOpen(back)).toBe(false);
  });

  it('steps back one beat and clears the move when returning to choose_move', () => {
    const onChange = run([
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'MOVE_PICKED', move: 'add_evidence' },
      { type: 'MOVE_CONFIRMED' },
    ]);
    const back = advanceCorridor(onChange, { type: 'BACK' });
    expect(CORRIDOR_STEPS[back.stepIndex].kind).toBe('choose_move');
    expect(back.chosenMove).toBeNull();
  });

  it('does not step before the first beat', () => {
    expect(advanceCorridor(initialCorridorState(), { type: 'BACK' })).toEqual(initialCorridorState());
  });
});

describe('determinism + replay', () => {
  const seq: CorridorEvent[] = [
    { type: 'ADVANCE' },
    { type: 'ADVANCE' },
    { type: 'ADVANCE' },
    { type: 'MOVE_PICKED', move: 'branch' },
    { type: 'MOVE_CONFIRMED' },
    { type: 'ADVANCE' },
  ];

  it('the same events always produce the same state', () => {
    expect(run(seq)).toEqual(run(seq));
  });

  it('REPLAY resets to the initial state and is idempotent', () => {
    const mid = run(seq);
    const once = advanceCorridor(mid, { type: 'REPLAY' });
    expect(once).toEqual(initialCorridorState());
    expect(advanceCorridor(once, { type: 'REPLAY' })).toEqual(once);
  });
});

describe('isCorridorComplete + closing', () => {
  it('is complete only on the closing beat', () => {
    let s = initialCorridorState();
    expect(isCorridorComplete(s)).toBe(false);
    const events: CorridorEvent[] = [
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'MOVE_PICKED', move: 'ask_source' },
      { type: 'MOVE_CONFIRMED' },
      { type: 'ADVANCE' },
    ];
    for (const e of events) {
      s = advanceCorridor(s, e);
      expect(isCorridorComplete(s)).toBe(false);
    }
    s = advanceCorridor(s, { type: 'ADVANCE' });
    expect(CORRIDOR_STEPS[s.stepIndex].kind).toBe('closing');
    expect(isCorridorComplete(s)).toBe(true);
  });
});

describe('resolveCorridorView', () => {
  it('focuses the root claim on the claim beat', () => {
    const v = resolveCorridorView(initialCorridorState());
    expect(v.isClosing).toBe(false);
    expect(v.fixtureStateId).toBe('disputed');
    expect(v.focusMessageId).toBe('demo-arg-root');
  });

  it('focuses the disputed sub-claim through the choose_move beat', () => {
    const refereeBeat = run([{ type: 'ADVANCE' }, { type: 'ADVANCE' }]);
    expect(resolveCorridorView(refereeBeat).focusMessageId).toBe('demo-arg-claim');
  });

  it('focuses the move node on the post-move beats', () => {
    const confirmed = run([
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'MOVE_PICKED', move: 'add_evidence' },
      { type: 'MOVE_CONFIRMED' },
    ]);
    const v = resolveCorridorView(confirmed);
    expect(v.fixtureStateId).toBe('after_add_evidence');
    expect(v.focusMessageId).toBe('demo-arg-evidence');
  });

  it('reports the closing beat with no focus node', () => {
    const closing = run([
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
      { type: 'MOVE_PICKED', move: 'narrow' },
      { type: 'MOVE_CONFIRMED' },
      { type: 'ADVANCE' },
      { type: 'ADVANCE' },
    ]);
    const v = resolveCorridorView(closing);
    expect(v.isClosing).toBe(true);
    expect(v.focusMessageId).toBeNull();
  });
});

describe('deriveFixtureStateId', () => {
  it('returns disputed for every non-post-move beat', () => {
    expect(deriveFixtureStateId(0, null)).toBe('disputed');
    expect(deriveFixtureStateId(3, 'ask_source')).toBe('disputed'); // choose_move
  });
  it('returns the scripted state on post-move beats', () => {
    expect(deriveFixtureStateId(4, 'narrow')).toBe('after_narrow');
    expect(deriveFixtureStateId(5, 'branch')).toBe('after_branch');
  });
});

describe('mapControlToDemoMove', () => {
  it('maps the clear surface controls', () => {
    expect(mapControlToDemoMove('ask_for_source')).toBe('ask_source');
    expect(mapControlToDemoMove('ask_for_quote')).toBe('ask_source');
    expect(mapControlToDemoMove('branch')).toBe('branch');
  });
  it('disambiguates a reply by its preset argument type', () => {
    expect(mapControlToDemoMove('reply', 'evidence')).toBe('add_evidence');
    expect(mapControlToDemoMove('reply', 'concession')).toBe('narrow');
  });
  it('returns null for unmapped controls (caller falls back to the default)', () => {
    expect(mapControlToDemoMove('flag')).toBeNull();
    expect(mapControlToDemoMove('reply')).toBeNull();
    expect(DEFAULT_DEMO_MOVE).toBe('ask_source');
  });
});

describe('makeDemoBeforeSubmit', () => {
  it('records the confirm and always returns false (pre-network suppressor)', () => {
    const onConfirm = jest.fn();
    const before = makeDemoBeforeSubmit(onConfirm);
    expect(before()).toBe(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
