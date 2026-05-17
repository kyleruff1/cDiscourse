/**
 * Stage 6.1.6a — DebateListScreen timestamp + sort tests.
 *
 * Pure-string checks on the source file. No native renderer in CI.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(path.join(repoRoot, 'src/features/debates/DebateListScreen.tsx'), 'utf8');

describe('DebateListScreen — timestamp display per card', () => {
  it('imports formatDateTime + formatRelativeShort', () => {
    expect(src).toContain("from '../../lib/formatDateTime'");
    expect(src).toContain('formatDateTime');
    expect(src).toContain('formatRelativeShort');
  });

  it('shows both Created and Last Updated on each debate card', () => {
    expect(src).toMatch(/Created\s/);
    expect(src).toMatch(/Last Updated/);
    expect(src).toContain('formatDateTime(debate.createdAt)');
    expect(src).toContain('formatDateTime(updatedDisplay)');
  });

  it('falls back gracefully when updatedAt is missing', () => {
    expect(src).toMatch(/hasUpdated\s*=\s*Boolean\(debate\.updatedAt\)/);
    expect(src).toMatch(/updatedDisplay\s*=\s*hasUpdated\s*\?\s*debate\.updatedAt\s*:\s*debate\.createdAt/);
    expect(src).toContain('same as created');
  });
});

describe('DebateListScreen — sort affordance', () => {
  it('declares sort field + direction state with updated_at desc defaults', () => {
    expect(src).toMatch(/useState<DebateSortField>\('updated_at'\)/);
    expect(src).toMatch(/useState<DebateSortDirection>\('desc'\)/);
  });

  it('toggles direction on same-field tap; switches to desc on new-field tap', () => {
    expect(src).toMatch(/setSortDirection\(\(d\)\s*=>\s*\(d\s*===\s*'desc'\s*\?\s*'asc'\s*:\s*'desc'\)\)/);
    expect(src).toMatch(/setSortField\(field\);\s*setSortDirection\('desc'\)/);
  });

  it('renders a "Sort by" toolbar with two chips + a "Sorted by" status', () => {
    expect(src).toContain('Sort by:');
    expect(src).toContain('Sorted by:');
    expect(src).toContain('debates-sort-bar');
    expect(src).toContain('debates-sort-updated');
    expect(src).toContain('debates-sort-created');
    expect(src).toContain('debates-sort-status');
  });

  it('uses plain-language sort labels', () => {
    expect(src).toContain('Newest activity');
    expect(src).toContain('Oldest activity');
    expect(src).toContain('Newest created');
    expect(src).toContain('Oldest created');
  });

  it('renders the Poppy UI helper text', () => {
    expect(src).toMatch(/Use Last Updated to find active conversations/);
    expect(src).toMatch(/Use Created to find newest rooms/);
  });

  it('applies sort in memory before rendering', () => {
    // sortedDebates is the array actually mapped to the JSX.
    expect(src).toMatch(/const sortedDebates = useMemo/);
    expect(src).toMatch(/sortedDebates\.map\(/);
  });
});

describe('DebateListScreen — file-level safety', () => {
  it('never references service-role keys or auth header literals', () => {
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/serviceRoleKey/);
    expect(src).not.toMatch(/Authorization:\s*['"][Bb]earer/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(src).not.toMatch(/XAI_API_KEY/);
    expect(src).not.toMatch(/X_BEARER_TOKEN/);
  });

  it('introduces no verdict tokens', () => {
    const lower = src.toLowerCase();
    for (const banned of ['liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist', 'winner', 'loser']) {
      expect(lower).not.toContain(banned);
    }
  });
});
