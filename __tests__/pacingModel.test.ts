/**
 * GAME-002 — pacingModel pure-TS tests.
 *
 * Covers every public function and every `PacingBlockReason` path:
 *   - evaluatePacing: ok / cooldown_active / daily_limit_hit /
 *     response_window_expired, plus the documented precedence order.
 *   - createPacingRule: merge over the casual default + negative clamping.
 *   - isNoPacingRule, formatCountdown, buildPacingChipViewModel,
 *     describePermanentRecord.
 *   - Edge cases: empty recentMoves, maxMovesPerDay: 0, cooldown exactly
 *     elapsed, future-dated move (clock skew), NaN `now`.
 *
 * Pure-TS — no React, no Supabase, no render harness.
 */
import {
  DEFAULT_CASUAL_PACING_RULE,
  createPacingRule,
  isNoPacingRule,
  evaluatePacing,
  formatCountdown,
  buildPacingChipViewModel,
  describePermanentRecord,
  type PacingRule,
  type PacingMoveRecord,
} from '../src/features/modes/pacingModel';

const DAY_MS = 86_400_000;
const NOW = 1_700_000_000_000;

function moves(...offsetsMsBeforeNow: number[]): readonly PacingMoveRecord[] {
  return offsetsMsBeforeNow.map((off) => ({ sentAtMs: NOW - off }));
}

describe('DEFAULT_CASUAL_PACING_RULE', () => {
  it('is the no-pacing baseline', () => {
    expect(DEFAULT_CASUAL_PACING_RULE).toEqual({
      maxMovesPerDay: null,
      cooldownAfterSendSec: 0,
      responseWindowSec: null,
      weightedByCooldown: false,
      permanentRecordWarning: 'off',
    });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_CASUAL_PACING_RULE)).toBe(true);
  });
});

describe('isNoPacingRule', () => {
  it('is true for the casual default', () => {
    expect(isNoPacingRule(DEFAULT_CASUAL_PACING_RULE)).toBe(true);
  });

  it('is false when there is a daily cap', () => {
    expect(isNoPacingRule(createPacingRule({ maxMovesPerDay: 5 }))).toBe(false);
  });

  it('is false when there is a cooldown', () => {
    expect(isNoPacingRule(createPacingRule({ cooldownAfterSendSec: 30 }))).toBe(
      false,
    );
  });

  it('is false when there is a response window', () => {
    expect(isNoPacingRule(createPacingRule({ responseWindowSec: 600 }))).toBe(
      false,
    );
  });

  it('is true for a rule with only cosmetic flags set', () => {
    expect(
      isNoPacingRule(
        createPacingRule({
          weightedByCooldown: true,
          permanentRecordWarning: 'on',
        }),
      ),
    ).toBe(true);
  });
});

describe('createPacingRule', () => {
  it('returns the casual default when no partial is given', () => {
    expect(createPacingRule()).toEqual(DEFAULT_CASUAL_PACING_RULE);
  });

  it('merges a partial over the casual default', () => {
    const rule = createPacingRule({ maxMovesPerDay: 10, cooldownAfterSendSec: 30 });
    expect(rule.maxMovesPerDay).toBe(10);
    expect(rule.cooldownAfterSendSec).toBe(30);
    expect(rule.responseWindowSec).toBeNull();
    expect(rule.weightedByCooldown).toBe(false);
  });

  it('clamps a negative cooldown to 0', () => {
    expect(createPacingRule({ cooldownAfterSendSec: -50 }).cooldownAfterSendSec).toBe(
      0,
    );
  });

  it('clamps a negative daily cap to 0', () => {
    expect(createPacingRule({ maxMovesPerDay: -3 }).maxMovesPerDay).toBe(0);
  });

  it('clamps a negative response window to 0', () => {
    expect(createPacingRule({ responseWindowSec: -10 }).responseWindowSec).toBe(0);
  });

  it('clamps a non-finite cap to null', () => {
    expect(createPacingRule({ maxMovesPerDay: NaN }).maxMovesPerDay).toBeNull();
    expect(
      createPacingRule({ maxMovesPerDay: Infinity }).maxMovesPerDay,
    ).toBeNull();
  });

  it('floors a fractional cap and cooldown', () => {
    const rule = createPacingRule({ maxMovesPerDay: 5.9, cooldownAfterSendSec: 30.7 });
    expect(rule.maxMovesPerDay).toBe(5);
    expect(rule.cooldownAfterSendSec).toBe(30);
  });

  it('coerces an invalid permanentRecordWarning to off', () => {
    expect(
      createPacingRule({ permanentRecordWarning: 'maybe' as unknown as 'on' })
        .permanentRecordWarning,
    ).toBe('off');
  });

  it('freezes the returned rule', () => {
    expect(Object.isFrozen(createPacingRule({ maxMovesPerDay: 3 }))).toBe(true);
  });
});

describe('formatCountdown', () => {
  it('renders 0 as 0:00', () => {
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('renders sub-minute values', () => {
    expect(formatCountdown(42)).toBe('0:42');
    expect(formatCountdown(5)).toBe('0:05');
  });

  it('renders minutes:seconds', () => {
    expect(formatCountdown(185)).toBe('3:05');
  });

  it('renders hours:minutes:seconds', () => {
    expect(formatCountdown(3750)).toBe('1:02:30');
  });

  it('handles multi-hour values without overflow', () => {
    expect(formatCountdown(90_000)).toBe('25:00:00');
  });

  it('guards NaN to 0:00', () => {
    expect(formatCountdown(NaN)).toBe('0:00');
  });

  it('guards Infinity to 0:00', () => {
    expect(formatCountdown(Infinity)).toBe('0:00');
  });

  it('guards negatives to 0:00', () => {
    expect(formatCountdown(-30)).toBe('0:00');
  });

  it('floors fractional seconds', () => {
    expect(formatCountdown(42.9)).toBe('0:42');
  });
});

describe('evaluatePacing — casual / no-pacing rule', () => {
  it('returns ok with all-null limits for the casual default', () => {
    expect(
      evaluatePacing({
        rule: DEFAULT_CASUAL_PACING_RULE,
        recentMoves: [],
        now: NOW,
      }),
    ).toEqual({
      canSendNow: true,
      nextAvailable: null,
      remainingToday: null,
      reason: 'ok',
    });
  });

  it('returns ok even with many recent moves under the casual rule', () => {
    const result = evaluatePacing({
      rule: DEFAULT_CASUAL_PACING_RULE,
      recentMoves: moves(1000, 2000, 3000, 4000),
      now: NOW,
    });
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });
});

describe('evaluatePacing — cooldown_active', () => {
  const rule = createPacingRule({ cooldownAfterSendSec: 60 });

  it('blocks while now < cooldownEnd', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: moves(30_000), // sent 30s ago, 60s cooldown
      now: NOW,
    });
    expect(result.canSendNow).toBe(false);
    expect(result.reason).toBe('cooldown_active');
    expect(result.nextAvailable).toBe(NOW - 30_000 + 60_000);
  });

  it('is sendable exactly at cooldownEnd (equality is not a block)', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: moves(60_000), // sent exactly 60s ago
      now: NOW,
    });
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('is sendable after cooldownEnd', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: moves(120_000),
      now: NOW,
    });
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('uses the most-recent move for the cooldown anchor', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: moves(500_000, 10_000, 200_000), // most recent is 10s ago
      now: NOW,
    });
    expect(result.reason).toBe('cooldown_active');
    expect(result.nextAvailable).toBe(NOW - 10_000 + 60_000);
  });

  it('does not block when there are no moves to anchor a cooldown', () => {
    const result = evaluatePacing({ rule, recentMoves: [], now: NOW });
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });
});

describe('evaluatePacing — daily_limit_hit', () => {
  const rule = createPacingRule({ maxMovesPerDay: 3 });

  it('counts moves in the rolling 24h window and decrements remaining', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: moves(1000, 2000), // 2 in window
      now: NOW,
    });
    expect(result.remainingToday).toBe(1);
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('blocks when the rolling-24h count reaches the cap', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: moves(1000, 2000, 3000),
      now: NOW,
    });
    expect(result.remainingToday).toBe(0);
    expect(result.canSendNow).toBe(false);
    expect(result.reason).toBe('daily_limit_hit');
  });

  it('points nextAvailable at when the oldest counted move ages out', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: moves(10_000, 5_000, 1_000), // oldest counted is 10s ago
      now: NOW,
    });
    expect(result.nextAvailable).toBe(NOW - 10_000 + DAY_MS);
  });

  it('frees a slot once a move ages past 24h', () => {
    // One move is just over 24h old → not counted.
    const result = evaluatePacing({
      rule,
      recentMoves: moves(DAY_MS + 1000, 2000, 3000),
      now: NOW,
    });
    expect(result.remainingToday).toBe(1);
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('does not count a move exactly at the window edge as out', () => {
    // A move exactly 24h old (sentAt === now - DAY_MS) is still in window.
    const result = evaluatePacing({
      rule,
      recentMoves: moves(DAY_MS, 2000, 3000),
      now: NOW,
    });
    expect(result.remainingToday).toBe(0);
    expect(result.reason).toBe('daily_limit_hit');
  });
});

describe('evaluatePacing — response_window_expired', () => {
  const rule = createPacingRule({ responseWindowSec: 600 }); // 10 min

  it('blocks when now is past the opponent window end', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: [],
      now: NOW,
      opponentLastMoveAtMs: NOW - 700_000, // 700s ago, window 600s
    });
    expect(result.canSendNow).toBe(false);
    expect(result.reason).toBe('response_window_expired');
    expect(result.nextAvailable).toBeNull();
  });

  it('does not block while inside the window', () => {
    const result = evaluatePacing({
      rule,
      recentMoves: [],
      now: NOW,
      opponentLastMoveAtMs: NOW - 300_000, // 300s ago, window 600s
    });
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('treats a missing opponentLastMoveAtMs as not-applicable', () => {
    const result = evaluatePacing({ rule, recentMoves: [], now: NOW });
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });
});

describe('evaluatePacing — precedence', () => {
  it('daily_limit_hit beats expired-window and cooldown when all fire', () => {
    const rule = createPacingRule({
      maxMovesPerDay: 2,
      cooldownAfterSendSec: 60,
      responseWindowSec: 60,
    });
    const result = evaluatePacing({
      rule,
      recentMoves: moves(1000, 2000), // hits the cap, also recent → cooldown
      now: NOW,
      opponentLastMoveAtMs: NOW - 120_000, // window expired
    });
    expect(result.reason).toBe('daily_limit_hit');
  });

  it('response_window_expired beats cooldown when both fire', () => {
    const rule = createPacingRule({
      cooldownAfterSendSec: 60,
      responseWindowSec: 60,
    });
    const result = evaluatePacing({
      rule,
      recentMoves: moves(1000), // recent → cooldown active
      now: NOW,
      opponentLastMoveAtMs: NOW - 120_000, // window expired
    });
    expect(result.reason).toBe('response_window_expired');
  });
});

describe('evaluatePacing — edge cases', () => {
  it('handles empty recentMoves as the first move of the room', () => {
    const rule = createPacingRule({ maxMovesPerDay: 5, cooldownAfterSendSec: 30 });
    const result = evaluatePacing({ rule, recentMoves: [], now: NOW });
    expect(result.remainingToday).toBe(5);
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('handles maxMovesPerDay: 0 as a degenerate but valid config', () => {
    const rule = createPacingRule({ maxMovesPerDay: 0 });
    const result = evaluatePacing({ rule, recentMoves: [], now: NOW });
    expect(result.remainingToday).toBe(0);
    expect(result.reason).toBe('daily_limit_hit');
    expect(result.nextAvailable).toBeNull(); // no move to age out
  });

  it('does not count a future-dated move (clock skew) toward the cap', () => {
    const rule = createPacingRule({ maxMovesPerDay: 2 });
    const result = evaluatePacing({
      rule,
      // one move dated in the future
      recentMoves: [{ sentAtMs: NOW + 60_000 }, { sentAtMs: NOW - 1000 }],
      now: NOW,
    });
    expect(result.remainingToday).toBe(1); // only the past move counts
  });

  it('degrades to ok when now is NaN', () => {
    const rule = createPacingRule({ maxMovesPerDay: 1, cooldownAfterSendSec: 60 });
    const result = evaluatePacing({
      rule,
      recentMoves: moves(1000),
      now: NaN,
    });
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('renders an hours-scale countdown for a very large cooldown', () => {
    const rule = createPacingRule({ cooldownAfterSendSec: 90_000 }); // 25h
    const vm = buildPacingChipViewModel({
      rule,
      recentMoves: moves(0),
      now: NOW,
    });
    expect(vm.countdownLabel).toContain(':');
    // 25h cooldown → countdown well over an hour.
    expect(vm.countdownLabel).toMatch(/\d+:\d{2}:\d{2}/);
  });

  it('never returns a negative countdown for a future-dated move', () => {
    const rule = createPacingRule({ cooldownAfterSendSec: 60 });
    const vm = buildPacingChipViewModel({
      rule,
      recentMoves: [{ sentAtMs: NOW + 1_000_000 }],
      now: NOW,
    });
    if (vm.countdownLabel !== null) {
      expect(vm.countdownLabel).not.toContain('-');
    }
  });

  it('degrades to a safe ok result for a malformed input', () => {
    const result = evaluatePacing(null as unknown as never);
    expect(result.canSendNow).toBe(true);
    expect(result.reason).toBe('ok');
  });
});

describe('buildPacingChipViewModel', () => {
  it('returns visible:false for the casual default', () => {
    const vm = buildPacingChipViewModel({
      rule: DEFAULT_CASUAL_PACING_RULE,
      recentMoves: [],
      now: NOW,
    });
    expect(vm.visible).toBe(false);
    expect(vm.remainingLabel).toBeNull();
    expect(vm.countdownLabel).toBeNull();
  });

  it('populates remainingLabel for an active daily cap', () => {
    const vm = buildPacingChipViewModel({
      rule: createPacingRule({ maxMovesPerDay: 10 }),
      recentMoves: moves(1000, 2000, 3000),
      now: NOW,
    });
    expect(vm.visible).toBe(true);
    expect(vm.remainingLabel).toBe('Moves left today: 7 of 10');
  });

  it('populates countdownLabel during a cooldown', () => {
    const vm = buildPacingChipViewModel({
      rule: createPacingRule({ cooldownAfterSendSec: 60 }),
      recentMoves: moves(18_000), // 18s ago → 42s left
      now: NOW,
    });
    expect(vm.visible).toBe(true);
    expect(vm.countdownLabel).toBe('You can send again in 0:42');
  });

  it('has no countdownLabel for an expired response window', () => {
    const vm = buildPacingChipViewModel({
      rule: createPacingRule({ responseWindowSec: 60 }),
      recentMoves: [],
      now: NOW,
      opponentLastMoveAtMs: NOW - 120_000,
    });
    expect(vm.visible).toBe(true);
    expect(vm.countdownLabel).toBeNull();
    expect(vm.canSendNow).toBe(false);
  });

  it('mirrors canSendNow from the evaluation', () => {
    const blocked = buildPacingChipViewModel({
      rule: createPacingRule({ maxMovesPerDay: 1 }),
      recentMoves: moves(1000),
      now: NOW,
    });
    expect(blocked.canSendNow).toBe(false);

    const open = buildPacingChipViewModel({
      rule: createPacingRule({ maxMovesPerDay: 5 }),
      recentMoves: moves(1000),
      now: NOW,
    });
    expect(open.canSendNow).toBe(true);
  });

  it('always has a non-empty accessibilityLabel when visible', () => {
    const vm = buildPacingChipViewModel({
      rule: createPacingRule({ maxMovesPerDay: 5, cooldownAfterSendSec: 30 }),
      recentMoves: moves(5000),
      now: NOW,
    });
    expect(vm.accessibilityLabel.length).toBeGreaterThan(0);
  });
});

describe('describePermanentRecord', () => {
  it('returns null when the warning is off', () => {
    expect(describePermanentRecord(DEFAULT_CASUAL_PACING_RULE)).toBeNull();
    expect(
      describePermanentRecord(createPacingRule({ permanentRecordWarning: 'off' })),
    ).toBeNull();
  });

  it('returns a non-empty plain string when the warning is on', () => {
    const text = describePermanentRecord(
      createPacingRule({ permanentRecordWarning: 'on' }),
    );
    expect(text).not.toBeNull();
    expect((text as string).length).toBeGreaterThan(0);
  });

  it('returns null for a malformed rule', () => {
    expect(describePermanentRecord(null as unknown as PacingRule)).toBeNull();
  });
});
