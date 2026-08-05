/**
 * UX-FLAGS-005 (issue 837) — pure-TS lifecycle discriminant tests.
 *
 * Verifies the 3-state discriminant is TOTAL over the 6-value ARCH-001
 * queue enum, order-independent for the fold, precedence-correct, and
 * silent-on-uncertainty when the roll-up is missing / malformed. Firing
 * negative controls pin the doctrinally load-bearing rules (content
 * always beats posture; failed only fires without a succeeded sibling).
 *
 * Pure TS — no React, no Supabase, no network. Tests import the
 * production functions directly (no mocking of the discriminant itself).
 */

import {
  ALL_MACHINE_OBSERVATION_RUN_LIFECYCLE_STATES,
  isMachineObservationRunLifecycleState,
  type MachineObservationRunLifecycleState,
} from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import {
  ALL_POINT_FEEDBACK_FLAGS_LIFECYCLE_STATES,
  derivePointFeedbackFlagsLifecycleState,
  foldRunRowsIntoRollup,
  type ArgumentClassifierLifecycleRollup,
} from '../src/features/feedbackFlags/pointFeedbackFlagsLifecycleModel';

// ─────────────────────────────────────────────────────────────────
// isMachineObservationRunLifecycleState — the type guard.
// ─────────────────────────────────────────────────────────────────

describe('isMachineObservationRunLifecycleState', () => {
  it('accepts every one of the six enum values (matches the migration CHECK)', () => {
    for (const state of ALL_MACHINE_OBSERVATION_RUN_LIFECYCLE_STATES) {
      expect(isMachineObservationRunLifecycleState(state)).toBe(true);
    }
  });

  it('rejects the empty string, null, undefined, non-strings', () => {
    expect(isMachineObservationRunLifecycleState('')).toBe(false);
    expect(isMachineObservationRunLifecycleState(null)).toBe(false);
    expect(isMachineObservationRunLifecycleState(undefined)).toBe(false);
    expect(isMachineObservationRunLifecycleState(0)).toBe(false);
    expect(isMachineObservationRunLifecycleState(1)).toBe(false);
    expect(isMachineObservationRunLifecycleState(true)).toBe(false);
    expect(isMachineObservationRunLifecycleState({})).toBe(false);
    expect(isMachineObservationRunLifecycleState([])).toBe(false);
  });

  it('rejects near-miss tokens (unknown-safe under-classification)', () => {
    for (const nearMiss of [
      'ok',
      'error',
      'unknown',
      'pending_terminal',
      'success',
      'succeeded_terminal',
      'DEAD_LETTER',
      'Pending',
      ' pending',
      'pending ',
    ]) {
      expect(isMachineObservationRunLifecycleState(nearMiss)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// foldRunRowsIntoRollup — the roll-up folder.
// ─────────────────────────────────────────────────────────────────

describe('foldRunRowsIntoRollup', () => {
  it('empty input yields hasAnyRun=false and every other flag=false', () => {
    const rollup = foldRunRowsIntoRollup('arg1', []);
    expect(rollup).toEqual({
      argumentId: 'arg1',
      hasAnyRun: false,
      hasAnyNonTerminal: false,
      hasAnySucceeded: false,
      hasAnyTerminalFailure: false,
    });
  });

  it('folds a single pending row -> non-terminal true, others false', () => {
    const rollup = foldRunRowsIntoRollup('arg1', [{ state: 'pending' }]);
    expect(rollup.hasAnyRun).toBe(true);
    expect(rollup.hasAnyNonTerminal).toBe(true);
    expect(rollup.hasAnySucceeded).toBe(false);
    expect(rollup.hasAnyTerminalFailure).toBe(false);
  });

  it('folds a single leased row -> non-terminal true', () => {
    const rollup = foldRunRowsIntoRollup('a', [{ state: 'leased' }]);
    expect(rollup.hasAnyNonTerminal).toBe(true);
  });

  it('folds a single retry_scheduled row -> non-terminal true', () => {
    const rollup = foldRunRowsIntoRollup('a', [{ state: 'retry_scheduled' }]);
    expect(rollup.hasAnyNonTerminal).toBe(true);
  });

  it('folds a single succeeded row -> hasAnySucceeded true only', () => {
    const rollup = foldRunRowsIntoRollup('a', [{ state: 'succeeded' }]);
    expect(rollup.hasAnyRun).toBe(true);
    expect(rollup.hasAnySucceeded).toBe(true);
    expect(rollup.hasAnyNonTerminal).toBe(false);
    expect(rollup.hasAnyTerminalFailure).toBe(false);
  });

  it('folds a single failed_terminal row -> hasAnyTerminalFailure true', () => {
    const rollup = foldRunRowsIntoRollup('a', [{ state: 'failed_terminal' }]);
    expect(rollup.hasAnyTerminalFailure).toBe(true);
    expect(rollup.hasAnySucceeded).toBe(false);
    expect(rollup.hasAnyNonTerminal).toBe(false);
  });

  it('folds a single dead_letter row -> hasAnyTerminalFailure true', () => {
    const rollup = foldRunRowsIntoRollup('a', [{ state: 'dead_letter' }]);
    expect(rollup.hasAnyTerminalFailure).toBe(true);
  });

  it('folds a mix of succeeded + failed_terminal -> both true', () => {
    const rollup = foldRunRowsIntoRollup('a', [
      { state: 'succeeded' },
      { state: 'failed_terminal' },
    ]);
    expect(rollup.hasAnySucceeded).toBe(true);
    expect(rollup.hasAnyTerminalFailure).toBe(true);
  });

  it('is order-independent (booleans OR)', () => {
    const a = foldRunRowsIntoRollup('a', [
      { state: 'pending' },
      { state: 'succeeded' },
      { state: 'dead_letter' },
    ]);
    const b = foldRunRowsIntoRollup('a', [
      { state: 'dead_letter' },
      { state: 'succeeded' },
      { state: 'pending' },
    ]);
    expect(a).toEqual(b);
  });

  it('drops rows with unknown state (safe under-classification)', () => {
    const rollup = foldRunRowsIntoRollup('a', [
      { state: 'unknown_future_state' as MachineObservationRunLifecycleState },
      { state: '' as MachineObservationRunLifecycleState },
    ]);
    expect(rollup.hasAnyRun).toBe(false);
    expect(rollup.hasAnyNonTerminal).toBe(false);
    expect(rollup.hasAnySucceeded).toBe(false);
    expect(rollup.hasAnyTerminalFailure).toBe(false);
  });

  it('returns a frozen roll-up (defensive against downstream mutation)', () => {
    const rollup = foldRunRowsIntoRollup('a', [{ state: 'pending' }]);
    expect(Object.isFrozen(rollup)).toBe(true);
  });

  it('preserves the argumentId verbatim (no normalization)', () => {
    const rollup = foldRunRowsIntoRollup('  Arg-42_x  ', []);
    expect(rollup.argumentId).toBe('  Arg-42_x  ');
  });

  it('never throws on malformed row objects', () => {
    // Cast to bypass type checks — the fold must be tolerant of runtime data.
    expect(() =>
      foldRunRowsIntoRollup('a', [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { state: 42 } as any,
      ]),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
// derivePointFeedbackFlagsLifecycleState — the discriminant.
// ─────────────────────────────────────────────────────────────────

function rollupFromFlags(
  flags: Partial<Omit<ArgumentClassifierLifecycleRollup, 'argumentId'>>,
): ArgumentClassifierLifecycleRollup {
  return {
    argumentId: 'arg-x',
    hasAnyRun: flags.hasAnyRun ?? false,
    hasAnyNonTerminal: flags.hasAnyNonTerminal ?? false,
    hasAnySucceeded: flags.hasAnySucceeded ?? false,
    hasAnyTerminalFailure: flags.hasAnyTerminalFailure ?? false,
  };
}

describe('derivePointFeedbackFlagsLifecycleState — precedence rules', () => {
  it('rule 1: hasVisibleFlags true -> ready (content wins over posture)', () => {
    // Even with a fully pending roll-up, content wins.
    const rollup = rollupFromFlags({ hasAnyRun: true, hasAnyNonTerminal: true });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: true, rollup })).toBe('ready');
    // Even with a fully failed roll-up, content wins.
    const failed = rollupFromFlags({ hasAnyRun: true, hasAnyTerminalFailure: true });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: true, rollup: failed })).toBe(
      'ready',
    );
  });

  it('rule 2: rollup null / undefined / hasAnyRun false -> ready (silent on absence)', () => {
    expect(
      derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup: null }),
    ).toBe('ready');
    expect(
      derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup: undefined }),
    ).toBe('ready');
    expect(
      derivePointFeedbackFlagsLifecycleState({
        hasVisibleFlags: false,
        rollup: rollupFromFlags({ hasAnyRun: false }),
      }),
    ).toBe('ready');
  });

  it('rule 3: hasAnyNonTerminal true -> pending', () => {
    const rollup = rollupFromFlags({ hasAnyRun: true, hasAnyNonTerminal: true });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup })).toBe(
      'pending',
    );
  });

  it('rule 3 wins over rule 5 (pending sibling shadows a failed sibling)', () => {
    // Doctrine: if partial family failed but another is still working, we
    // stay calm ('pending', not 'failed').
    const rollup = rollupFromFlags({
      hasAnyRun: true,
      hasAnyNonTerminal: true,
      hasAnyTerminalFailure: true,
    });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup })).toBe(
      'pending',
    );
  });

  it('rule 4: hasAnySucceeded true (no non-terminal) -> ready', () => {
    // Genuinely empty room: classifier ran, nothing to say. Silent.
    const rollup = rollupFromFlags({ hasAnyRun: true, hasAnySucceeded: true });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup })).toBe(
      'ready',
    );
  });

  it('rule 4 wins over rule 5 (succeeded shadows a dead-lettered sibling)', () => {
    // Firing negative control: succeeded takes precedence, we NEVER return
    // 'failed' when a run has succeeded.
    const rollup = rollupFromFlags({
      hasAnyRun: true,
      hasAnySucceeded: true,
      hasAnyTerminalFailure: true,
    });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup })).toBe(
      'ready',
    );
  });

  it('rule 5: pure-failure -> failed', () => {
    const rollup = rollupFromFlags({ hasAnyRun: true, hasAnyTerminalFailure: true });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup })).toBe(
      'failed',
    );
  });

  it('rule 6 (defensive fallback): unreachable hasAnyRun+no-flags -> ready', () => {
    // Every flag false but hasAnyRun true is not a legitimate state (the
    // fold would set at least one). Belt-and-suspenders fallback: ready.
    const rollup = rollupFromFlags({ hasAnyRun: true });
    expect(derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup })).toBe(
      'ready',
    );
  });

  it('return type is a member of ALL_POINT_FEEDBACK_FLAGS_LIFECYCLE_STATES for every input', () => {
    // Exhaustive-ish sweep across the flag matrix.
    const flagCombos: ArgumentClassifierLifecycleRollup[] = [];
    for (const hasAnyRun of [false, true]) {
      for (const hasAnyNonTerminal of [false, true]) {
        for (const hasAnySucceeded of [false, true]) {
          for (const hasAnyTerminalFailure of [false, true]) {
            flagCombos.push({
              argumentId: 'a',
              hasAnyRun,
              hasAnyNonTerminal,
              hasAnySucceeded,
              hasAnyTerminalFailure,
            });
          }
        }
      }
    }
    for (const rollup of flagCombos) {
      for (const hasVisibleFlags of [false, true]) {
        const state = derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags, rollup });
        expect(ALL_POINT_FEEDBACK_FLAGS_LIFECYCLE_STATES).toContain(state);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Firing negative controls — the doctrinally load-bearing rules.
// ─────────────────────────────────────────────────────────────────

describe('derivePointFeedbackFlagsLifecycleState — firing negative controls', () => {
  it('NEVER returns pending or failed when hasVisibleFlags is true', () => {
    // Exhaustive sweep with hasVisibleFlags fixed true — always ready.
    for (const hasAnyRun of [false, true]) {
      for (const hasAnyNonTerminal of [false, true]) {
        for (const hasAnySucceeded of [false, true]) {
          for (const hasAnyTerminalFailure of [false, true]) {
            const rollup: ArgumentClassifierLifecycleRollup = {
              argumentId: 'a',
              hasAnyRun,
              hasAnyNonTerminal,
              hasAnySucceeded,
              hasAnyTerminalFailure,
            };
            expect(
              derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: true, rollup }),
            ).toBe('ready');
          }
        }
      }
    }
  });

  it('NEVER returns failed when hasAnySucceeded is true (succeeded shadows)', () => {
    for (const hasAnyNonTerminal of [false, true]) {
      for (const hasAnyTerminalFailure of [false, true]) {
        const rollup = rollupFromFlags({
          hasAnyRun: true,
          hasAnySucceeded: true,
          hasAnyNonTerminal,
          hasAnyTerminalFailure,
        });
        expect(
          derivePointFeedbackFlagsLifecycleState({ hasVisibleFlags: false, rollup }),
        ).not.toBe('failed');
      }
    }
  });

  it('NEVER returns one of the raw queue-only enum values as the discriminant', () => {
    // The UI state `'pending'` deliberately reuses the plain-English word
    // (the queue enum happens to have a `pending` too -- they are the same
    // English word, not the same code). What we DO forbid: the discriminant
    // must never leak the QUEUE-ONLY enum values (`leased`, `retry_scheduled`,
    // `succeeded`, `failed_terminal`, `dead_letter`), which have no
    // corresponding UI state. This test enumerates every rollup and pins that
    // the returned string is one of the three UI states, and specifically NOT
    // one of the queue-only tokens.
    const QUEUE_ONLY_TOKENS = ALL_MACHINE_OBSERVATION_RUN_LIFECYCLE_STATES.filter(
      (t) => t !== 'pending',
    );
    for (const rawQueueState of ALL_MACHINE_OBSERVATION_RUN_LIFECYCLE_STATES) {
      const rollup: ArgumentClassifierLifecycleRollup = {
        argumentId: 'a',
        hasAnyRun: true,
        hasAnyNonTerminal:
          rawQueueState === 'pending' ||
          rawQueueState === 'leased' ||
          rawQueueState === 'retry_scheduled',
        hasAnySucceeded: rawQueueState === 'succeeded',
        hasAnyTerminalFailure:
          rawQueueState === 'failed_terminal' || rawQueueState === 'dead_letter',
      };
      const result = derivePointFeedbackFlagsLifecycleState({
        hasVisibleFlags: false,
        rollup,
      });
      // The returned discriminant must never be one of the 5 queue-only tokens.
      expect(QUEUE_ONLY_TOKENS as ReadonlyArray<string>).not.toContain(result);
      // And it must be one of the 3 UI states.
      expect(ALL_POINT_FEEDBACK_FLAGS_LIFECYCLE_STATES as ReadonlyArray<string>).toContain(result);
    }
  });
});
