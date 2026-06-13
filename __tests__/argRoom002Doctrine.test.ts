/**
 * ARG-ROOM-002 (#613) — doctrine: capacity copy is structural, never a verdict,
 * and the denial codes round-trip through gameCopy.toPlainLanguage with no
 * snake_case leak (doctrine §1, §9).
 */
import {
  toPlainLanguage,
  looksLikeInternalCode,
} from '../src/features/arguments/gameCopy';

/** The two denial codes the create-argument-room path surfaces to the creator. */
const CAPACITY_CODES = ['private_requires_invite', 'room_capacity_reached'] as const;

/**
 * Verdict / removal / amplification / person tokens that must never appear in
 * any user-facing capacity string. Mirrors the shape of the shipped
 * _forbiddenChimeInGovernanceTokens / argumentRoomCreationMatrix ban lists.
 */
const BANNED_TOKENS = [
  // verdict
  'winner', 'loser', 'correct', 'incorrect', 'truth', 'liar', 'dishonest',
  'bad faith', 'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot',
  // amplification
  'popular', 'trending', 'viral',
  // removal / punitive
  'kicked', 'banned', 'booted', 'removed', 'rejected', 'blocked',
  // person attribution
  'troll', 'challenger', 'opponent',
];

describe('ARG-ROOM-002 — gameCopy plain-language coverage', () => {
  it('every capacity denial code maps to plain language (no null, no snake_case leak)', () => {
    for (const code of CAPACITY_CODES) {
      const plain = toPlainLanguage(code);
      expect(plain).not.toBeNull();
      expect(typeof plain).toBe('string');
      expect((plain as string).length).toBeGreaterThan(0);
      // The raw code must NOT survive into the user-facing string.
      expect(plain as string).not.toContain('_');
      expect(looksLikeInternalCode(plain)).toBe(false);
    }
  });

  it('maps private_requires_invite + room_capacity_reached to the expected structural copy', () => {
    expect(toPlainLanguage('private_requires_invite')).toBe(
      'A private argument needs one person invited to start it.',
    );
    expect(toPlainLanguage('room_capacity_reached')).toBe(
      'This argument already has the most people it can hold.',
    );
  });
});

describe('ARG-ROOM-002 — capacity copy ban-list (structural availability, never a verdict)', () => {
  it('no capacity denial copy contains a verdict / removal / amplification / person token', () => {
    for (const code of CAPACITY_CODES) {
      const plain = (toPlainLanguage(code) ?? '').toLowerCase();
      for (const token of BANNED_TOKENS) {
        expect(plain).not.toContain(token);
      }
    }
  });
});
