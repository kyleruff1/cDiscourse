/**
 * ARG-ROOM-003 — create-room copy doctrine scan.
 *
 * The "Who can join" surface adds one new copy block (`ARGUMENT_ROOM_CREATE_
 * COPY`) plus the validator-driven reason copy it surfaces. This suite pins:
 *   - every new string is free of verdict / person / amplification framing
 *     (incl. the QOL-038 `challenger` / `opponent` invite bans);
 *   - no new string leaks a snake_case internal code (plain language only);
 *   - no new string enables account enumeration (never reveals new-vs-existing
 *     user);
 *   - the validator reason mapper the form uses maps every reason to non-empty
 *     plain language and SUPPRESSES an unknown code (never echoes the raw
 *     token) — so the form's disabled-reason line is doctrine-safe.
 */
import {
  ARGUMENT_ROOM_CREATE_COPY,
  fillArgumentRoomCapacityCopy,
} from '../src/features/arguments/gameCopy';
import {
  plainLanguageForCreationReason,
  ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS,
  _forbiddenArgumentRoomCreationTokens,
} from '../src/features/debates/argumentRoomCreationMatrix';

const NEW_COPY_VALUES: string[] = Object.values(ARGUMENT_ROOM_CREATE_COPY);

/** Every reason string the form can actually surface on the disabled line. */
const SURFACED_REASON_COPY: string[] = [
  ...ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS.map((r) => plainLanguageForCreationReason(r)),
  plainLanguageForCreationReason(null),
  plainLanguageForCreationReason(undefined),
];

/** Account-enumeration phrases — the surface must never reveal whether the
 *  invitee already has an account. */
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

describe('ARGUMENT_ROOM_CREATE_COPY — banned framing', () => {
  const BANNED = _forbiddenArgumentRoomCreationTokens();

  it('contains no verdict / person / amplification / invite-framing token', () => {
    for (const value of NEW_COPY_VALUES) {
      const lower = value.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('surfaces only ban-list-clean reason copy on the disabled line', () => {
    for (const value of SURFACED_REASON_COPY) {
      const lower = value.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
    }
  });
});

describe('ARGUMENT_ROOM_CREATE_COPY — no internal codes, plain language', () => {
  it('no value leaks a snake_case internal code', () => {
    // A `{capacity}` / `{open}` placeholder is a brace token, not snake_case;
    // strip placeholders first, then assert no `word_word` survives.
    for (const value of NEW_COPY_VALUES) {
      const stripped = value.replace(/\{[a-z]+\}/g, '');
      expect(stripped).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('the filled capacity copy still leaks no internal code', () => {
    const filled = fillArgumentRoomCapacityCopy(ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved, {
      capacity: 5,
      open: 3,
    });
    expect(filled).not.toMatch(/[a-z]+_[a-z]+/);
    // The placeholders were replaced — no literal `{` survives.
    expect(filled).not.toContain('{');
  });
});

describe('ARGUMENT_ROOM_CREATE_COPY — no account enumeration', () => {
  it('no new string reveals new-vs-existing invitee status', () => {
    for (const value of [...NEW_COPY_VALUES, ...SURFACED_REASON_COPY]) {
      const lower = value.toLowerCase();
      for (const token of ENUMERATION_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });
});

describe('plainLanguageForCreationReason — used by the form disabled line', () => {
  it('maps every validator reason to non-empty plain language with no raw code', () => {
    for (const reason of ALL_ARGUMENT_ROOM_CREATION_REJECT_REASONS) {
      const copy = plainLanguageForCreationReason(reason);
      expect(copy.length).toBeGreaterThan(0);
      // The raw reason code itself never appears in the user-facing string.
      expect(copy).not.toContain(reason);
      expect(copy).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('suppresses an unknown code to the generic fallback (never echoes the token)', () => {
    const copy = plainLanguageForCreationReason('totally_made_up_code' as never);
    expect(copy.length).toBeGreaterThan(0);
    expect(copy).not.toContain('totally_made_up_code');
    // Falls back to the same generic copy as a missing reason.
    expect(copy).toBe(plainLanguageForCreationReason(null));
  });
});
