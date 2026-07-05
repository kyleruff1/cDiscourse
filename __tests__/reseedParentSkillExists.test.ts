/**
 * RESEED-001 — parent skill existence + frontmatter + boundary line.
 *
 * The operating-procedure skill lives at the PARENT level, outside the repo:
 *   <cdiscourse-root>/.claude/skills/cdiscourse-reseeder/SKILL.md
 *
 * From this test file (__tests__/ inside the repo worktree), we resolve the
 * cdiscourse root by walking up to the repo root, then up one more to its
 * parent, then into .claude/skills. The worktree lives under
 * .claude/worktrees/<name>, so the canonical primary checkout root is the
 * grandparent-of-grandparent; we search a few candidate roots to be robust to
 * whether the test runs from the primary checkout or a worktree.
 */
const fs = require('node:fs');
const path = require('node:path');

function findParentSkill(): string | null {
  // Candidate cdiscourse roots relative to this test file.
  const here = __dirname; // .../debate-constitution-app[/.claude/worktrees/<name>]/__tests__
  const candidates: string[] = [];
  // Walk up several levels collecting any `<dir>/.claude/skills/cdiscourse-reseeder/SKILL.md`.
  let cur = here;
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(cur, '.claude', 'skills', 'cdiscourse-reseeder', 'SKILL.md'));
    // Also check a SIBLING cdiscourse dir (parent of the repo).
    candidates.push(path.join(path.dirname(cur), '.claude', 'skills', 'cdiscourse-reseeder', 'SKILL.md'));
    cur = path.dirname(cur);
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

describe('parent reseeder skill', () => {
  const skillPath = findParentSkill();

  it('exists at the parent-level path (outside the repo)', () => {
    expect(skillPath).not.toBeNull();
  });

  it('carries the required frontmatter and boundary lines', () => {
    if (!skillPath) throw new Error('parent skill not found');
    const src = fs.readFileSync(skillPath, 'utf8');

    // Frontmatter.
    expect(src).toMatch(/name:\s*cdiscourse-reseeder/);
    expect(src).toMatch(/disable-model-invocation:\s*true/);
    expect(src).toMatch(/user-invocable:\s*true/);

    // Identity Declaration.
    expect(src).toContain('Identity Declaration');
    expect(src.toLowerCase()).toContain('i do not decide truth');
    expect(src.toLowerCase()).toContain('i do not decide winners');

    // The boundary line (service-role / direct-insert / submit-argument).
    const lower = src.toLowerCase();
    expect(lower.includes('does not use service-role') || lower.includes('does not use service-role keys')).toBe(true);
    expect(lower).toContain('does not write directly to `public.arguments`');
    expect(lower).toContain('does not bypass `submit-argument`');
  });

  it('is NOT inside the repo tree (parent-level only)', () => {
    if (!skillPath) throw new Error('parent skill not found');
    // The repo root is the nearest ancestor containing package.json.
    let repoRoot = __dirname;
    for (let i = 0; i < 8; i++) {
      if (fs.existsSync(path.join(repoRoot, 'package.json'))) break;
      repoRoot = path.dirname(repoRoot);
    }
    const rel = path.relative(repoRoot, skillPath);
    // A path inside the repo would NOT start with '..'.
    expect(rel.startsWith('..')).toBe(true);
  });
});
