/**
 * ROOM-001 (#876) — verdict-token + internal-code ban over STATE_RAIL_COPY.
 *
 * The ambient state rail copy must carry NO verdict / person-judgment token and
 * NO raw internal code (no snake_case leak such as evidence_debt /
 * resolved_or_settled). Mirrors the copySystemBanList / message-qualifier ban
 * pattern. Word-boundary, case-insensitive matching so legitimate substrings
 * (e.g. "open") never false-positive.
 */
import { STATE_RAIL_COPY } from '../src/features/arguments/gameCopy';

const BANNED_TOKENS = [
  'winner', 'loser', 'correct', 'incorrect', 'liar', 'dishonest', 'bad faith',
  'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot', 'truth',
  'score', 'verdict', 'wrong',
];

/** Raw internal codes that must never leak into a user-facing string. */
const BANNED_INTERNAL_CODES = ['evidence_debt', 'resolved_or_settled'];

function flattenStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) flattenStrings(v, out);
  }
  return out;
}

function matchesToken(text: string, token: string): boolean {
  const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(text);
}

describe('STATE_RAIL_COPY — doctrine ban-list', () => {
  const strings = flattenStrings(STATE_RAIL_COPY);

  it('has copy to scan', () => {
    expect(strings.length).toBeGreaterThan(0);
  });

  it('contains no verdict / person-judgment token', () => {
    for (const text of strings) {
      for (const token of BANNED_TOKENS) {
        expect(matchesToken(text, token)).toBe(false);
      }
    }
  });

  it('contains no raw snake_case internal code', () => {
    for (const text of strings) {
      for (const code of BANNED_INTERNAL_CODES) {
        expect(text.toLowerCase()).not.toContain(code);
      }
      // No generic snake_case leak in any user-facing string.
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('positive control — the guard would catch a verdict token', () => {
    expect(matchesToken('This is the winner.', 'winner')).toBe(true);
  });
});
