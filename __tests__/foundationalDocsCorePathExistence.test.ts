import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');

// The 12 foundational docs that MCP-MOD-001 moved into docs/core/.
// Adding a future 13th foundational doc is welcome; this test asserts
// the minimum set, not the exact contents.
const REQUIRED_CORE_FILES = [
  'current-status.md',
  'session-handoff.md',
  'known-blockers.md',
  'next-prompts.md',
  'implementation-plan.md',
  'product-spec.md',
  'architecture.md',
  'constitution-v1.md',
  'ux-ui-project-board.md',
  'agent-charters.md',
  'agent-workflow.md',
  'roadmap-semantic-referee-modularity.md',
];

// The 11 top-level docs that were moved. The meta-roadmap (row 12) had a
// different old path (docs/roadmap-expansions/2026-05-22-...) and is asserted
// separately.
const MOVED_TOP_LEVEL_DOCS = REQUIRED_CORE_FILES.filter(
  (f) => f !== 'roadmap-semantic-referee-modularity.md',
);

describe('docs/core foundational doc set (MCP-MOD-001)', () => {
  it.each(REQUIRED_CORE_FILES)('docs/core/%s exists', (filename) => {
    const fullPath = path.join(REPO_ROOT, 'docs', 'core', filename);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it.each(MOVED_TOP_LEVEL_DOCS)(
    'old top-level docs/%s no longer exists (moved to docs/core/)',
    (filename) => {
      const oldPath = path.join(REPO_ROOT, 'docs', filename);
      expect(fs.existsSync(oldPath)).toBe(false);
    },
  );

  it('old docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md no longer exists', () => {
    const oldPath = path.join(
      REPO_ROOT,
      'docs',
      'roadmap-expansions',
      '2026-05-22-semantic-referee-modularity-roadmap.md',
    );
    expect(fs.existsSync(oldPath)).toBe(false);
  });
});
