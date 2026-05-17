/**
 * Stage 6.1.6b — DebateListScreen table-layout tests.
 *
 * Pure-string assertions on the source file. The Debate list is now a real
 * table; Created and Last Updated are first-class sortable columns, not
 * card body text.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(path.join(repoRoot, 'src/features/debates/DebateListScreen.tsx'), 'utf8');

describe('DebateListScreen — table structure', () => {
  it('imports formatDateTime + formatRelativeShort', () => {
    expect(src).toContain("from '../../lib/formatDateTime'");
    expect(src).toContain('formatDateTime');
    expect(src).toContain('formatRelativeShort');
  });

  it('renders every required column header literal', () => {
    for (const label of ['Status', 'My Side', 'Debate', 'Created', 'Last Updated', 'Action']) {
      expect(src).toContain(`label="${label}"`);
    }
  });

  it('table + sortable header + cell testIDs are present', () => {
    expect(src).toContain('testID="debates-table"');
    expect(src).toContain('testID="debates-header-created"');
    expect(src).toContain('testID="debates-header-updated"');
    expect(src).toContain('testID="debates-cell-created"');
    expect(src).toContain('testID="debates-cell-updated"');
  });

  it('wraps the table in a horizontal ScrollView so columns never collapse', () => {
    expect(src).toMatch(/<ScrollView\s+horizontal/);
    expect(src).toMatch(/minWidth:\s*TABLE_WIDTH/);
  });

  it('per-row timestamp cells render two distinct Text nodes (absolute + relative)', () => {
    expect(src).toMatch(/<Text style=\{styles\.timeAbsolute\}>\{formatDateTime\(debate\.createdAt\)\}<\/Text>/);
    expect(src).toMatch(/<Text style=\{styles\.timeRelative\}>\{formatRelativeShort\(debate\.createdAt\)\}<\/Text>/);
    expect(src).toMatch(/<Text style=\{styles\.timeAbsolute\}>\{formatDateTime\(updatedDisplay\)\}<\/Text>/);
    expect(src).toMatch(/<Text style=\{styles\.timeRelative\}>\{formatRelativeShort\(updatedDisplay\)\}<\/Text>/);
  });

  it('regression: no prose concatenation of date · relative', () => {
    expect(src).not.toMatch(/formatDateTime\([^)]+\)\}\s*·\s*\{formatRelativeShort/);
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

  it('renders a "Sorted by:" status above the table', () => {
    expect(src).toContain('Sorted by:');
    expect(src).toContain('debates-sort-status');
  });

  it('uses plain-language sort labels in the status', () => {
    expect(src).toContain('Newest activity');
    expect(src).toContain('Oldest activity');
    expect(src).toContain('Newest created');
    expect(src).toContain('Oldest created');
  });

  it('renders the Poppy UI helper text', () => {
    expect(src).toMatch(/Use Last Updated to find active conversations/);
    expect(src).toMatch(/Use Created to find newest rooms/);
  });

  it('applies sort in memory before rendering using real Date timestamps (not strings)', () => {
    expect(src).toMatch(/const sortedDebates = useMemo/);
    expect(src).toMatch(/sortedDebates\.map\(/);
    expect(src).toMatch(/function safeTimestamp/);
    expect(src).toMatch(/new Date\(candidate\)\.getTime\(\)/);
    // The fallback path: if sortField is 'created_at', use createdAt;
    // otherwise use updatedAt with createdAt as a null-safe fallback.
    expect(src).toMatch(/safeTimestamp\(d\.updatedAt,\s*d\.createdAt\)/);
  });

  it('sortable headers are buttons with accessibility role + state', () => {
    expect(src).toContain('accessibilityRole="button"');
    expect(src).toMatch(/accessibilityState=\{\{ selected: active \}\}/);
    expect(src).toMatch(/sorted descending/);
    expect(src).toMatch(/sorted ascending/);
  });

  it('falls back gracefully when updatedAt is missing', () => {
    expect(src).toMatch(/hasUpdated\s*=\s*Boolean\(debate\.updatedAt\)/);
    expect(src).toMatch(/updatedDisplay\s*=\s*hasUpdated\s*\?\s*debate\.updatedAt\s*:\s*debate\.createdAt/);
    expect(src).toContain('same as created');
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
