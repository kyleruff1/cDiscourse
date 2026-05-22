/**
 * ADMIN-AI-001 — doctrine ban-list scan.
 *
 * ADMIN-AI-001 adds user-facing strings (provider mode labels, the
 * confirmation-dialog copy, the status copy, the "Coming later" label, the
 * error messages). Per `test-discipline`, any card that adds user-facing
 * copy must scan it for verdict / truth tokens — the provider mode chooses
 * *which provider answers*, never *what the answer means*, so no verdict
 * token may reach a user through this surface.
 *
 * Scope is RENDERED strings only — JSX text nodes + quoted string literals,
 * with comments stripped first (the narrow ban-list pattern from
 * `adminMetadataEventsTab.test.ts`).
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

/**
 * Verdict / truth / person-attribution tokens that must never reach a
 * user-facing string. Mirrors the canonical repo ban-list used by
 * `adminMetadataEventsTab.test.ts` — `truth` (covers "assign a truth value")
 * rather than the JS keywords `true` / `false`, which pollute any source scan.
 */
const BANNED = [
  'winner', 'loser', ' won ', ' lost ', ' right ', ' wrong ',
  'correct', 'incorrect', 'liar', 'dishonest', 'bad faith',
  'manipulative', 'propagandist', 'extremist', 'astroturfer',
  'verdict', 'truth',
];

/**
 * Extract user-facing copy from a source file: JSX text nodes plus quoted
 * string literals, after stripping comments. testIDs / accessibilityLabels
 * use kebab-case and are non-rendered — scanning them too is harmless and
 * stricter, so the quoted-literal sweep keeps them in.
 *
 * The JSX-text sweep can incidentally capture code between two JSX tags, so
 * the scan deliberately targets only the BANNED *phrase* tokens above — never
 * a bare JS keyword like `true`.
 */
function userFacingCopy(src: string): string {
  const noComments = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  const jsxText = (noComments.match(/>[^<>{}]+</g) ?? []).join(' ');
  const quoted = (noComments.match(/'[^']*'|"[^"]*"/g) ?? []).join(' ');
  return `${jsxText} ${quoted}`.toLowerCase();
}

const SOURCES = [
  'src/features/admin/AdminSemanticRefereeTab.tsx',
  'src/features/admin/semanticRefereeConfigApi.ts',
];

describe('ADMIN-AI-001 ban-list — no verdict token in user-facing copy', () => {
  for (const rel of SOURCES) {
    const copy = userFacingCopy(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));

    it(`${rel} contains no verdict / truth-attribution token`, () => {
      for (const tok of BANNED) {
        expect(copy).not.toContain(tok);
      }
    });
  }
});

describe('ADMIN-AI-001 ban-list — the provider-mode labels are plain language', () => {
  it('no rendered label leaks an internal validation code (snake_case)', () => {
    // The tab maps provider_mode codes to readable labels — a raw
    // snake_case internal code (e.g. topic_satisfaction_lexical) must never
    // appear in rendered copy.
    const tabCopy = userFacingCopy(
      fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminSemanticRefereeTab.tsx'), 'utf8'),
    );
    // No snake_case word with 2+ underscores (a card code like MCP-018 is
    // hyphenated; a raw provider_mode value like 'anthropic' has none).
    expect(tabCopy).not.toMatch(/[a-z]+_[a-z]+_[a-z]+/);
  });

  it('the footnote states the provider mode makes no judgment', () => {
    const tab = fs.readFileSync(
      path.join(repoRoot, 'src/features/admin/AdminSemanticRefereeTab.tsx'), 'utf8',
    );
    expect(tab).toMatch(/makes no judgment/);
    expect(tab).toMatch(/does not decide who is right/);
  });
});
