/**
 * QUOTE-FORGE-002 (#842) — rendered-node echo copy doctrine guard.
 */
import {
  CALLBACK_ECHO_COPY,
  ALL_CALLBACK_ECHO_COPY,
  _forbiddenCallbackEchoTokens,
} from '../src/features/arguments/crossRoom/callbackEchoCopy';

const BANNED = _forbiddenCallbackEchoTokens();

const ALL_STRINGS: string[] = [
  ...ALL_CALLBACK_ECHO_COPY,
  CALLBACK_ECHO_COPY.origin('Bike-lane baseline'),
  CALLBACK_ECHO_COPY.lockedOrigin('Bike-lane baseline'),
];

describe('callbackEchoCopy — doctrine ban-list', () => {
  it('no echo string contains a verdict / amplification token', () => {
    for (const s of ALL_STRINGS) {
      const lower = s.toLowerCase();
      for (const token of BANNED) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });

  it('the ban regex fires on a violating string (self-test)', () => {
    const violating = 'The winner proved the loser wrong.';
    expect(BANNED.some((t) => violating.toLowerCase().includes(t))).toBe(true);
  });

  it('no echo string leaks an internal code / snake_case', () => {
    const INTERNAL = ['crossRoomCallback', 'client_validation', 'targetDebateId'];
    for (const s of ALL_STRINGS) {
      for (const code of INTERNAL) expect(s).not.toContain(code);
      expect(s).not.toMatch(/_[a-z]/);
    }
  });

  it('shares the woven-callback vocabulary with the composer copy', () => {
    expect(CALLBACK_ECHO_COPY.identityLabel).toBe('Woven callback');
    expect(CALLBACK_ECHO_COPY.origin('X')).toBe('Callback to “X”');
  });
});
