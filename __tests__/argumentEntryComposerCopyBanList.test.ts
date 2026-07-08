/**
 * ROOM-003 (#829) — bar copy doctrine ban-list scan.
 *
 * Scans every string in ARGUMENT_ENTRY_COMPOSER_COPY with the shipped
 * _forbiddenBoxTokens helper (verdict + amplification tokens), using the
 * same word-boundary matcher as oneBoxCopyBanList.test.ts. Zero matches
 * allowed. Also confirms no bar string looks like an internal code.
 */
import { _forbiddenBoxTokens } from '../src/features/arguments/oneBox/boxModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import { ARGUMENT_ENTRY_COMPOSER_COPY } from '../src/features/arguments/composer/argumentEntryComposerModel';

const BANNED = _forbiddenBoxTokens();

// Short everyday-English verdict words scanned with word boundaries (mirrors
// oneBoxCopyBanList.test.ts) to avoid false hits inside ordinary prose.
const WORD_BOUNDARY_TOKENS = new Set([
  'true',
  'false',
  'won',
  'lost',
  'right',
  'wrong',
  'correct',
  'incorrect',
  'proof',
  'proven',
  'shares',
  'likes',
]);

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  const t = token.toLowerCase();
  if (WORD_BOUNDARY_TOKENS.has(t)) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(lower);
  }
  return lower.includes(t);
}

const PRODUCED: { where: string; value: string }[] = Object.entries(ARGUMENT_ENTRY_COMPOSER_COPY).map(
  ([key, value]) => ({ where: `ARGUMENT_ENTRY_COMPOSER_COPY.${key}`, value }),
);

describe('ROOM-003 bar copy — doctrine ban-list scan', () => {
  it('the copy const has strings to scan', () => {
    expect(PRODUCED.length).toBeGreaterThan(0);
    for (const { value } of PRODUCED) expect(value.length).toBeGreaterThan(0);
  });

  it('no bar string contains a forbidden verdict / amplification token', () => {
    for (const { where, value } of PRODUCED) {
      for (const token of BANNED) {
        expect({ where, value, hit: hitsBanned(value, token) ? token : null }).toEqual({
          where,
          value,
          hit: null,
        });
      }
    }
  });

  it('the source-attach slot label is NOT the word proof (evidence is not proof)', () => {
    expect(hitsBanned(ARGUMENT_ENTRY_COMPOSER_COPY.proofLabel, 'proof')).toBe(false);
  });

  it('no bar string looks like an internal code', () => {
    for (const { value } of PRODUCED) {
      expect(looksLikeInternalCode(value)).toBe(false);
    }
  });

  it('no bar string leaks a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const { where, value } of PRODUCED) {
      expect({ where, snake: snake.test(value) }).toEqual({ where, snake: false });
    }
  });
});
