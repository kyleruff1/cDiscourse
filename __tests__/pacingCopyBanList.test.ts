/**
 * GAME-002 — pacing copy ban-list (doctrine safety).
 *
 * Collects every user-facing string the pacing feature can emit across a
 * matrix of rules and states, then asserts:
 *
 *   - No verdict / person token (winner, loser, liar, true, false, etc.).
 *   - No threatening / punitive wording (punish, penalty, banned, blocked,
 *     locked out) — doctrine: pacing copy is "never threatening".
 *   - No internal `PacingBlockReason` code (cooldown_active,
 *     daily_limit_hit, response_window_expired) leaks into any string.
 *   - The `permanentRecordWarning: 'on'` advisory is plain and
 *     non-threatening.
 *
 * Pure-TS — no React, no render harness.
 */
import {
  DEFAULT_CASUAL_PACING_RULE,
  createPacingRule,
  buildPacingChipViewModel,
  describePermanentRecord,
  type PacingEvaluationInput,
} from '../src/features/modes/pacingModel';

const NOW = 1_700_000_000_000;

/**
 * Verdict / person tokens — doctrine forbids labeling a person or claim.
 * Plus punitive-sounding words because pacing copy must never threaten.
 */
const BANNED_TOKENS = [
  'winner',
  'loser',
  'liar',
  'true',
  'false',
  'correct',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'punish',
  'penalty',
  'banned',
  'blocked',
  'locked out',
];

/** Internal machine codes that must never reach a user-facing string. */
const INTERNAL_CODES = [
  'cooldown_active',
  'daily_limit_hit',
  'response_window_expired',
];

/** Collect every user-facing string across a matrix of rules + states. */
function collectAllUserFacingStrings(): string[] {
  const strings: string[] = [];

  const rules = [
    DEFAULT_CASUAL_PACING_RULE,
    createPacingRule({ maxMovesPerDay: 10 }),
    createPacingRule({ maxMovesPerDay: 1 }),
    createPacingRule({ maxMovesPerDay: 0 }),
    createPacingRule({ cooldownAfterSendSec: 60 }),
    createPacingRule({ cooldownAfterSendSec: 90_000 }),
    createPacingRule({ responseWindowSec: 600 }),
    createPacingRule({
      maxMovesPerDay: 3,
      cooldownAfterSendSec: 120,
      responseWindowSec: 300,
    }),
  ];

  // States: fresh, near-cap, at-cap, mid-cooldown, expired-window.
  const moveSets = [
    [],
    [{ sentAtMs: NOW - 1000 }],
    [
      { sentAtMs: NOW - 1000 },
      { sentAtMs: NOW - 2000 },
      { sentAtMs: NOW - 3000 },
    ],
    [{ sentAtMs: NOW - 30_000 }],
  ];
  const opponentOffsets: (number | undefined)[] = [
    undefined,
    NOW - 100_000,
    NOW - 900_000,
  ];

  for (const rule of rules) {
    for (const recentMoves of moveSets) {
      for (const opp of opponentOffsets) {
        const input: PacingEvaluationInput = {
          rule,
          recentMoves,
          now: NOW,
          ...(opp !== undefined ? { opponentLastMoveAtMs: opp } : {}),
        };
        const vm = buildPacingChipViewModel(input);
        if (vm.remainingLabel !== null) strings.push(vm.remainingLabel);
        if (vm.countdownLabel !== null) strings.push(vm.countdownLabel);
        strings.push(vm.accessibilityLabel);
      }
    }
  }

  // describePermanentRecord — both toggle states.
  const permOn = describePermanentRecord(
    createPacingRule({ permanentRecordWarning: 'on' }),
  );
  if (permOn !== null) strings.push(permOn);

  return strings;
}

describe('pacing copy ban-list', () => {
  const allStrings = collectAllUserFacingStrings();

  it('produces a non-empty set of user-facing strings', () => {
    expect(allStrings.length).toBeGreaterThan(0);
  });

  it('contains no verdict / person / punitive token', () => {
    for (const str of allStrings) {
      const lower = str.toLowerCase();
      for (const banned of BANNED_TOKENS) {
        expect(lower).not.toContain(banned);
      }
    }
  });

  it('leaks no internal PacingBlockReason code', () => {
    for (const str of allStrings) {
      for (const code of INTERNAL_CODES) {
        expect(str).not.toContain(code);
      }
    }
  });

  it('emits no snake_case token in any user-facing string', () => {
    for (const str of allStrings) {
      expect(str).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

describe('permanentRecordWarning copy is plain and non-threatening', () => {
  const text = describePermanentRecord(
    createPacingRule({ permanentRecordWarning: 'on' }),
  );

  it('is a non-empty plain-language string', () => {
    expect(text).not.toBeNull();
    expect((text as string).length).toBeGreaterThan(0);
  });

  it('contains no verdict / punitive token', () => {
    const lower = (text as string).toLowerCase();
    for (const banned of BANNED_TOKENS) {
      expect(lower).not.toContain(banned);
    }
  });

  it('does not threaten — no "warning"/"cannot"/"forbidden" framing', () => {
    const lower = (text as string).toLowerCase();
    expect(lower).not.toContain('cannot');
    expect(lower).not.toContain('forbidden');
    expect(lower).not.toContain('not allowed');
  });
});
