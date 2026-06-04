/**
 * ADMIN-ARGS-INACTIVE-001 — plain-language mapping coverage.
 *
 * `cdiscourse-doctrine` § 9: every internal code must map to a
 * plain-language string with no snake_case leak, no banned-lifecycle
 * vocabulary, and no verdict tokens.
 */
import { toPlainLanguage } from '../src/features/arguments/gameCopy';

const CODES = ['inactive', 'inactive_at', 'inactive_by', 'inactive_reason'] as const;

const BANNED_LIFECYCLE = ['delete', 'remove', 'archive', 'clean slate'];
const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
];

describe('ADMIN-ARGS-INACTIVE-001 — toPlainLanguage maps every inactive code', () => {
  for (const code of CODES) {
    it(`maps "${code}" to a non-empty plain-language string`, () => {
      const value = toPlainLanguage(code);
      expect(value).not.toBeNull();
      expect((value ?? '').length).toBeGreaterThan(0);
    });

    it(`"${code}" mapping has no snake_case leak`, () => {
      const value = toPlainLanguage(code) ?? '';
      // The plain-language string must not echo the internal code's
      // underscored form. The only allowed snake_case substring is the
      // internal-code key itself, which never appears in the value.
      // We assert no `<word>_<word>` pattern in the rendered string.
      expect(value).not.toMatch(/\b[a-z]+_[a-z]+\b/);
    });

    it(`"${code}" mapping contains no banned lifecycle vocabulary`, () => {
      const value = (toPlainLanguage(code) ?? '').toLowerCase();
      for (const banned of BANNED_LIFECYCLE) {
        expect(value).not.toContain(banned);
      }
    });

    it(`"${code}" mapping contains no verdict tokens`, () => {
      const value = (toPlainLanguage(code) ?? '').toLowerCase();
      for (const t of VERDICT_TOKENS) {
        expect(value).not.toContain(t);
      }
    });
  }
});

describe('ADMIN-ARGS-INACTIVE-001 — inactive_reason mapping is generic (does not echo any free-text)', () => {
  it('the plain-language string identifies the field but does not reveal its content', () => {
    const value = toPlainLanguage('inactive_reason') ?? '';
    // The mapping is a generic label like "Admin note (admin-only)".
    // It must NOT contain anything that looks like a reason-text echo.
    expect(value.length).toBeGreaterThan(0);
    expect(value.toLowerCase()).toContain('admin');
  });
});
