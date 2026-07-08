/**
 * START-003 (#875) — PUBLIC_ARGUMENT_TOGGLE_COPY doctrine scan.
 *
 * Mirrors argumentRoomCreateCopyDoctrine. The public-toggle control copy must:
 *   - carry no verdict / person / amplification / invite-framing token (reusing
 *     _forbiddenArgumentRoomCreationTokens);
 *   - leak no snake_case internal code (plain language only);
 *   - enable no account enumeration;
 *   - be all non-empty strings.
 * PUBLIC_ARGUMENT_TOGGLE_COPY is a SEPARATE export from ARGUMENT_ROOM_CREATE_COPY
 * so the create-copy doctrine suite stays byte-identical.
 */
import { PUBLIC_ARGUMENT_TOGGLE_COPY } from '../src/features/arguments/gameCopy';
import { _forbiddenArgumentRoomCreationTokens } from '../src/features/debates/argumentRoomCreationMatrix';

const VALUES: string[] = Object.values(PUBLIC_ARGUMENT_TOGGLE_COPY);

const ENUMERATION_TOKENS = [
  'existing user',
  'new user',
  'already has an account',
  'already have an account',
  'account',
  'registered',
  'sign up',
  'signup',
];

describe('PUBLIC_ARGUMENT_TOGGLE_COPY — banned framing', () => {
  const BANNED = _forbiddenArgumentRoomCreationTokens();

  it('contains no verdict / person / amplification / invite-framing token', () => {
    for (const value of VALUES) {
      const lower = value.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
    }
  });
});

describe('PUBLIC_ARGUMENT_TOGGLE_COPY — plain language, no enumeration', () => {
  it('no value leaks a snake_case internal code', () => {
    for (const value of VALUES) {
      expect(value).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('no value enables account enumeration', () => {
    for (const value of VALUES) {
      const lower = value.toLowerCase();
      for (const token of ENUMERATION_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('every value is a non-empty string', () => {
    expect(VALUES.length).toBeGreaterThan(0);
    for (const value of VALUES) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('contains no urgency / persuasion nudge word', () => {
    // Private-by-default is strengthened; the copy must not push the flip.
    const NUDGE = ['hurry', 'now only', 'act fast', 'limited time', 'don’t miss', 'dont miss'];
    for (const value of VALUES) {
      const lower = value.toLowerCase();
      for (const n of NUDGE) {
        expect(lower).not.toContain(n);
      }
    }
  });
});
