/**
 * UX-COMPOSER-005 (#831) — composer-side callback copy doctrine guard. Scans
 * every string (and the interpolated origin line) for verdict / amplification
 * tokens, with a firing negative control, and bans internal-code leaks.
 */
import {
  CALLBACK_COMPOSER_COPY,
  ALL_CALLBACK_COMPOSER_COPY,
  _forbiddenCallbackComposerTokens,
} from '../src/features/arguments/crossRoom/callbackComposerCopy';

const BANNED = _forbiddenCallbackComposerTokens();

/** Every user-facing string incl. the interpolated origin with a benign title. */
const ALL_STRINGS: string[] = [
  ...ALL_CALLBACK_COMPOSER_COPY,
  CALLBACK_COMPOSER_COPY.echoOrigin('Bike-lane baseline'),
];

describe('callbackComposerCopy — doctrine ban-list', () => {
  it('no user string contains a verdict / amplification token', () => {
    for (const s of ALL_STRINGS) {
      const lower = s.toLowerCase();
      for (const token of BANNED) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });

  it('the ban regex demonstrably fires on a violating string (self-test)', () => {
    const violating = 'This proves the winner of the argument.';
    const lower = violating.toLowerCase();
    const hit = BANNED.some((token) => lower.includes(token));
    expect(hit).toBe(true);
  });

  it('no user string leaks an internal code / snake_case identifier', () => {
    const INTERNAL = ['crossRoomCallback', 'client_validation', 'targetDebateId', 'pendingCallback'];
    for (const s of ALL_STRINGS) {
      for (const code of INTERNAL) {
        expect(s).not.toContain(code);
      }
      expect(s).not.toMatch(/_[a-z]/); // no snake_case leak
    }
  });

  it('exposes the shared woven-callback vocabulary', () => {
    expect(CALLBACK_COMPOSER_COPY.echoHeader).toBe('Woven callback');
    expect(CALLBACK_COMPOSER_COPY.echoOrigin('X')).toBe('Callback to “X”');
  });
});
