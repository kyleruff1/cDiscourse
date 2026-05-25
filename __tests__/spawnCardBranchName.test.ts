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
  // 1. Strip "<Code><whitespace>[-:]<whitespace>" prefix.
  const stripped = issueTitle.replace(new RegExp('^' + code + '\\s*[-:]\\s*'), '');
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

  it('strips the colon separator for OPS-004-corrected behaviour (modern titles)', () => {
    // Modern GitHub issue titles in this repo use a colon
    // ("OPS-002: title") instead of the legacy dash ("OPS-002 - title").
    // OPS-004 corrected the PS1 strip regex from `^$Code\s*-\s*` to
    // `^$Code\s*[-:]\s*` so the strip is no longer a no-op for
    // colon-separated titles. The code prefix is now stripped cleanly
    // and the resulting slug starts with the title body (not a
    // duplicated code prefix). Pre-OPS-004 the slug was
    // `feat/OPS-002-ops-002-pipeline-operational-hygiene-spa`; post-OPS-004
    // it is the corrected `feat/OPS-002-pipeline-operational-hygiene-spawn-card`.
    // (The OPS-004 design §5.1 worked example named `-bra` as the trailing
    // fragment after truncation; the actual character count at position 40
    // is `card-` and TrimEnd('-') strips the trailing dash, so the final
    // slug ends at `card`. The design's arithmetic miscount is recorded in
    // the implementer note at the bottom of docs/designs/OPS-004.md; the
    // test expectation here mirrors the actual computed output of the
    // corrected regex.)
    // The four pre-OPS-004 shipped cards' branch names remain immutable
    // in PR history; this test asserts the corrected behaviour for all
    // future spawn-card invocations.
    expect(
      computeSpawnCardBranchName(
        'OPS-002',
        'OPS-002: Pipeline operational hygiene (spawn-card branch naming + worktree cleanup)',
      ),
    ).toBe('feat/OPS-002-pipeline-operational-hygiene-spawn-card');
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

describe('OPS-004 charter extensions — contract (file scan)', () => {
  const reviewerCharterPath = path.join(
    REPO_ROOT,
    '.claude',
    'agents',
    'roadmap-reviewer.md',
  );
  const implementerCharterPath = path.join(
    REPO_ROOT,
    '.claude',
    'agents',
    'roadmap-implementer.md',
  );

  const reviewerCharter = fs.readFileSync(reviewerCharterPath, 'utf8');
  const implementerCharter = fs.readFileSync(implementerCharterPath, 'utf8');

  it('reviewer charter Class 3 cell contains the OPS-004 DROP COLUMN ordering sub-check', () => {
    // Signal phrase: the unique substring "every `DROP COLUMN` or `DROP TABLE`"
    // from §1.2 of the OPS-004 design. Stable across wording polish
    // and proves the Class 3 sub-check (e) is present.
    expect(reviewerCharter).toContain('every `DROP COLUMN` or `DROP TABLE`');
    // Cross-reference to the PR-004 worked example anchors the sub-check
    // to its motivating incident.
    expect(reviewerCharter).toContain('SQLSTATE 2BP01');
  });

  it('reviewer charter Class 4 cell contains the OPS-004 storage COMMENT ownership sub-check', () => {
    // Signal phrase: the unique substring "ON storage.*" appears only
    // in the OPS-004 sub-check (f); pre-OPS-004 the four-class table
    // did not mention the storage schema by name.
    expect(reviewerCharter).toContain('ON storage.*');
    // Cross-reference to the PR-003 worked example anchors the sub-check
    // to its motivating incident.
    expect(reviewerCharter).toContain('SQLSTATE 42501');
  });

  it('implementer charter rename step contains the OPS-004 stale-worktree recovery sequence', () => {
    // Signal phrase: the `--ignore-other-worktrees` override is the
    // canonical recovery command added by OPS-004. Pre-OPS-004 the
    // rename step ended with the bare "STOP and surface" placeholder.
    expect(implementerCharter).toContain('--ignore-other-worktrees');
    // The recovery sequence must be inside the existing rename step
    // (after the rename heading, before the "Verify clean baseline"
    // heading). String-index comparison enforces ordering.
    const renameIndex = implementerCharter.indexOf(
      '**Rename the worktree auto-branch to the named feat branch.**',
    );
    const recoveryIndex = implementerCharter.indexOf('--ignore-other-worktrees');
    const baselineIndex = implementerCharter.indexOf('**Verify clean baseline.**');
    expect(renameIndex).toBeGreaterThan(-1);
    expect(recoveryIndex).toBeGreaterThan(renameIndex);
    expect(baselineIndex).toBeGreaterThan(recoveryIndex);
  });
});
