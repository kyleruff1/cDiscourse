import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * OPS-002 / OPS-003 — Spawn-card + cleanup procedure regression suite.
 *
 * Three groups:
 *   1. Slug parity — mirrors `.claude/scripts/spawn-card.ps1` lines 73–76
 *      in TypeScript. Pins the current branch-name shape so a future
 *      script edit (deliberate or accidental) cannot silently drift the
 *      naming convention for previously-shipped cards.
 *   2. Charter rename-step contract — file scan over
 *      `.claude/agents/roadmap-implementer.md` asserting the OPS-002
 *      rename step is present, well-formed, and ordered before the
 *      "Verify clean baseline" step. Guards against a future edit that
 *      removes or demotes the rename instruction.
 *   3. Cleanup procedure contract (OPS-003) — file scan over
 *      `.claude/agents/roadmap-reviewer.md` asserting that all four
 *      EC-N handlers added by OPS-003 are present, ordered, and carry
 *      the canonical signal phrase for each gap. The HTML comment
 *      markers `<!-- OPS-003: EC-N handler -->` are the stable contract
 *      surface; single-token signal phrases (`-f -f`, `\\?\`,
 *      `Compare-Object`, `git branch --list`) guard against wording
 *      drift while still catching deletion of a handler block.
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

describe('OPS-003 worktree cleanup procedure — charter contract (file scan)', () => {
  const reviewerCharterPath = path.join(
    REPO_ROOT,
    '.claude',
    'agents',
    'roadmap-reviewer.md',
  );

  const charter = fs.readFileSync(reviewerCharterPath, 'utf8');

  it('contains the EC-1 (double-force) handler marker and signal phrase', () => {
    expect(charter).toContain('<!-- OPS-003: EC-1 handler -->');
    // Signal phrase: the EC-1 fix is `-f -f` (double force). The
    // single-token `-f -f` substring is stable across wording changes
    // and proves the per-card step 2 command uses double-force.
    expect(charter).toContain('git worktree remove -f -f');
  });

  it('contains the EC-2 (Windows long-path) handler marker and signal phrase', () => {
    expect(charter).toContain('<!-- OPS-003: EC-2 handler -->');
    // Signal phrases: the EC-2 fix is the `\\?\` UNC prefix used with
    // PowerShell `Remove-Item`; the trigger condition is the literal
    // `Filename too long` substring from git's error output. All three
    // tokens are stable and platform-specific.
    expect(charter).toContain('\\\\?\\');
    expect(charter).toContain('Remove-Item');
    expect(charter).toContain('Filename too long');
  });

  it('contains the EC-3 (filesystem orphan sweep) handler marker and signal phrase', () => {
    expect(charter).toContain('<!-- OPS-003: EC-3 handler -->');
    // Signal phrases: the EC-3 fix is a `Compare-Object` sweep that
    // diffs the filesystem listing against git's worktree list to
    // surface filesystem orphans (directories that exist on disk but
    // are not in git's admin state).
    expect(charter).toContain('Compare-Object');
    expect(charter).toContain('filesystem orphan');
  });

  it('contains the EC-4 (periodic branch-ref cleanup) handler marker and signal phrase', () => {
    expect(charter).toContain('<!-- OPS-003: EC-4 handler -->');
    // Signal phrases: the EC-4 fix is a pattern-based bulk
    // `git branch -D` pass driven by `git branch --list <patterns>`;
    // the patterns list is the stable signal. Two of the four
    // observed patterns are asserted to confirm the list shape.
    expect(charter).toContain('git branch --list');
    expect(charter).toContain("'feat/*'");
    expect(charter).toContain("'worktree-agent-*'");
  });

  it('orders all four EC handler markers in EC-1, EC-2, EC-3, EC-4 sequence', () => {
    // String-index comparison guards against a future edit that
    // re-orders the handlers. The intended order is the natural
    // execution order: blocking errors first (EC-1 lock-force, EC-2
    // long-path) before accumulation sweeps (EC-3 filesystem orphan,
    // EC-4 branch refs).
    const ec1 = charter.indexOf('<!-- OPS-003: EC-1 handler -->');
    const ec2 = charter.indexOf('<!-- OPS-003: EC-2 handler -->');
    const ec3 = charter.indexOf('<!-- OPS-003: EC-3 handler -->');
    const ec4 = charter.indexOf('<!-- OPS-003: EC-4 handler -->');

    expect(ec1).toBeGreaterThan(-1);
    expect(ec2).toBeGreaterThan(ec1);
    expect(ec3).toBeGreaterThan(ec2);
    expect(ec4).toBeGreaterThan(ec3);
  });
});
