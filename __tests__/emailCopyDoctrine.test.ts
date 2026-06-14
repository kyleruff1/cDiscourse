/**
 * EMAIL-TRANSPORT-001 — test class 5 + 9: ban-list scan of the invite email copy.
 *
 * `emailTemplates.ts` is not tsc-loadable (it imports `./safety.ts`), so we
 * extract its literal copy strings from source and run them through the REAL
 * runtime ban-list engine (`assertNoBannedTokens`, imported from the pure,
 * dual-importable `safety` module). This is a genuine runtime doctrine check of
 * the actual rendered copy — not a weaker string-contains scan.
 *
 * cdiscourse-doctrine §1: no winner/loser/truth/verdict/accusation token; plus
 * the invite-specific `challenger`/`opponent`. No internal validation codes. No
 * heat/popularity/standing language.
 */
import fs from 'fs';
import path from 'path';
import { assertNoBannedTokens, EMAIL_BANNED_TOKENS } from '../supabase/functions/_shared/email/safety';

const TPL_RAW = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'emailTemplates.ts'),
  'utf8',
);
// Strip comments FIRST so the docstring (which legitimately backtick-quotes the
// banned tokens it forbids, e.g. `challenger`/`opponent`) is not mistaken for
// rendered copy. We scan only the executable string literals.
const TPL_SRC = TPL_RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * Extract every double-quoted, single-quoted, and template-literal string from
 * the render module, strip template `${...}` interpolations + HTML tags, and
 * return the human-readable copy fragments. This captures the subject, the
 * visibility copy, the intro/fallback lines, and the HTML text nodes.
 */
function extractCopy(src: string): string[] {
  const out: string[] = [];
  const re = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const lit = m[1] ?? m[2] ?? m[3] ?? '';
    if (!lit) continue;
    const cleaned = lit
      .replace(/\$\{[^}]*\}/g, ' ') // drop interpolations
      .replace(/<[^>]+>/g, ' ') // drop HTML tags
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length > 0) out.push(cleaned);
  }
  return out;
}

const COPY = extractCopy(TPL_SRC);
// Visible-prose fragments: exclude CSS-y / attribute-y fragments (they carry no
// natural-language copy). We keep fragments that contain a space + a letter
// run, which is where doctrine copy lives.
const PROSE = COPY.filter((c) => /[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(c));

describe('emailCopyDoctrine — extracted copy is non-empty + includes the key user-facing strings', () => {
  const JOINED = COPY.join('\n');
  it('captured the neutral subject + intro + capacity copy', () => {
    expect(JOINED).toContain("You've been invited to an argument");
    expect(JOINED).toContain('Private rooms are 1v1 by invitation.');
    expect(JOINED).toContain('Public rooms allow up to 5 active participants; observers are uncapped.');
    expect(PROSE.length).toBeGreaterThan(5);
  });
});

describe('emailCopyDoctrine — every copy fragment passes the runtime ban-list', () => {
  it('no extracted prose fragment trips assertNoBannedTokens', () => {
    const offenders = PROSE.filter((c) => !assertNoBannedTokens(c));
    expect(offenders).toEqual([]);
  });

  it('the whole module copy, concatenated, is ban-list clean', () => {
    expect(assertNoBannedTokens(COPY.join('\n'))).toBe(true);
  });
});

describe('emailCopyDoctrine — no heat / popularity / standing language', () => {
  const HEAT = ['trending', 'viral', 'popular', 'upvote', 'engagement', 'most-liked', 'winning'];
  it('no copy fragment references heat / popularity / standing', () => {
    const lower = COPY.join('\n').toLowerCase();
    for (const token of HEAT) {
      expect(lower).not.toContain(token);
    }
  });
});

describe('emailCopyDoctrine — no internal validation codes in copy', () => {
  it('no snake_case internal code appears in any prose fragment', () => {
    for (const c of PROSE) {
      expect(c).not.toMatch(/\b(source_chain|topic_satisfaction|anti_amplification|evidence_debt|platform_support_warning|validation_failed)\b/);
    }
  });
});

describe('emailCopyDoctrine — the runtime ban-list covers the card vocabulary', () => {
  it('EMAIL_BANNED_TOKENS contains every token the card names', () => {
    const REQUIRED = [
      'winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative',
      'extremist', 'propagandist', 'stupid', 'idiot', 'truth', 'verdict',
      'correct', 'incorrect', 'untrue', 'challenger', 'opponent',
    ];
    for (const token of REQUIRED) {
      expect(EMAIL_BANNED_TOKENS).toContain(token);
    }
  });

  it('a sample of each banned token is actually caught by the engine', () => {
    expect(assertNoBannedTokens('you are the winner')).toBe(false);
    expect(assertNoBannedTokens('this is the truth')).toBe(false);
    expect(assertNoBannedTokens('reply to the opponent')).toBe(false);
    expect(assertNoBannedTokens('that is incorrect')).toBe(false);
  });
});
