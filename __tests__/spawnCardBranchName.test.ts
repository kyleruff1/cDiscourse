import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * OPS-002 — Spawn-card branch-naming regression suite.
 *
 * Two groups:
 *   1. Slug parity — mirrors `.claude/scripts/spawn-card.ps1` lines 73–76
 *      in TypeScript. Pins the current branch-name shape so a future
 *      script edit (deliberate or accidental) cannot silently drift the
 *      naming convention for previously-shipped cards.
 *   2. Charter rename-step contract — file scan over
 *      `.claude/agents/roadmap-implementer.md` asserting the OPS-002
 *      rename step is present, well-formed, and ordered before the
 *      "Verify clean baseline" step. Guards against a future edit that
 *      removes or demotes the rename instruction.
 *
 * Test-only helper; intentionally NOT in `src/` (no production runtime
 * uses it). The PS1 script remains the single source of truth for the
 * actual slug computation at spawn time.
 */

const REPO_ROOT = path.resolve(__dirname, '..');

function computeSpawnCardBranchName(code: string, issueTitle: string): string {
  // 1. Strip "<Code><whitespace>-<whitespace>" prefix.
  const stripped = issueTitle.replace(new RegExp('^' + code + '\\s*-\\s*'), '');
  // 2. Replace non-alphanumeric runs with single dash.
  const dashed = stripped.replace(/[^a-zA-Z0-9]+/g, '-');
  // 3. Trim leading/trailing dashes, lowercase.
  let slug = dashed.replace(/^-+|-+$/g, '').toLowerCase();
  // 4. Truncate to 40 chars and trim any trailing dash.
  if (slug.length > 40) slug = slug.slice(0, 40).replace(/-+$/, '');
  return `feat/${code}-${slug}`;
}

describe('OPS-002 spawn-card branch name — Group 1: slug parity', () => {
  it('produces feat/TL-001-make-timeline for a legacy dash-separated title', () => {
    expect(
      computeSpawnCardBranchName('TL-001', 'TL-001 - Make Timeline...'),
    ).toBe('feat/TL-001-make-timeline');
  });

  it('truncates a long title at 40 chars and trims any trailing dash', () => {
    // The QOL-040.3 title is well over 40 chars after the prefix is
    // stripped; the truncation lands inside "stage" and any trailing
    // dash is removed. The code's dot survives because it is part of
    // the literal $Code prefix (which is not slugged), but inside the
    // slug body the dot is converted to a dash like every other
    // non-alphanumeric character.
    expect(
      computeSpawnCardBranchName(
        'QOL-040.3',
        'QOL-040.3 - Deep-link node pre-activation via Stage 6.4 entry-hint extension',
      ),
    ).toBe('feat/QOL-040.3-deep-link-node-pre-activation-via-stage');
  });

  it('pins the colon-separator double-prefix behaviour for OPS-002 (modern titles)', () => {
    // Modern GitHub issue titles in this repo use a colon
    // ("OPS-002: title") instead of the legacy dash ("OPS-002 - title").
    // The PS1 strip regex `^$Code\s*-\s*` expects a dash, so the strip
    // is a no-op for colon-separated titles and the code prefix is
    // duplicated in the resulting slug. This is cosmetic, not broken:
    // the branch still encodes the code uniquely. The test pins the
    // CURRENT behaviour so a future "fix" to the strip regex
    // (potentially landing as OPS-003) is a conscious test update, not
    // a silent behavioural drift that breaks the four previously
    // shipped cards' branch names.
    expect(
      computeSpawnCardBranchName(
        'OPS-002',
        'OPS-002: Pipeline operational hygiene (spawn-card branch naming + worktree cleanup)',
      ),
    ).toBe('feat/OPS-002-ops-002-pipeline-operational-hygiene-spa');
  });

  it('produces feat/<code>- for an empty title (pins empty-input behaviour)', () => {
    // An empty issue title is a pathological input (gh would normally
    // refuse to create such an issue), but the script does not guard
    // against it. The slug collapses to the empty string and the
    // result is `feat/X-` with a trailing dash. Pinned so a future
    // "trim empty" change is intentional.
    expect(computeSpawnCardBranchName('X', '')).toBe('feat/X-');
  });

  it('collapses runs of special characters into single dashes', () => {
    expect(
      computeSpawnCardBranchName('X', 'X - Foo bar! @baz $qux %quux'),
    ).toBe('feat/X-foo-bar-baz-qux-quux');
  });
});

describe('OPS-002 spawn-card branch name — Group 2: implementer charter rename-step contract', () => {
  const charterPath = path.join(
    REPO_ROOT,
    '.claude',
    'agents',
    'roadmap-implementer.md',
  );

  const charter = fs.readFileSync(charterPath, 'utf8');

  it('contains the verbatim rename-step heading', () => {
    expect(charter).toContain(
      '**Rename the worktree auto-branch to the named feat branch.**',
    );
  });

  it('contains the verbatim git branch -m command with code/slug placeholders', () => {
    expect(charter).toContain('git branch -m feat/<code>-<slug>');
  });

  it('orders the rename step before the "Verify clean baseline" step', () => {
    // String-index comparison guards against a future edit that
    // re-orders the Phase steps and demotes the rename. The rename
    // must run before the baseline check so the commits land on the
    // correctly named branch from the very first commit.
    const renameIndex = charter.indexOf(
      '**Rename the worktree auto-branch to the named feat branch.**',
    );
    const baselineIndex = charter.indexOf('**Verify clean baseline.**');

    expect(renameIndex).toBeGreaterThan(-1);
    expect(baselineIndex).toBeGreaterThan(-1);
    expect(renameIndex).toBeLessThan(baselineIndex);
  });
});
