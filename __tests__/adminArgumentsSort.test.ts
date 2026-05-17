/**
 * Stage 6.1.6b — Admin Arguments table-layout sort behavior tests.
 *
 * Pure-string assertions on the source file (no React Native renderer in CI).
 * The previous toolbar-based "Sort by" chips have been replaced by sortable
 * column headers in a real table; these tests cover the new structure.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const apiSrc = fs.readFileSync(path.join(repoRoot, 'src/features/admin/adminArgumentsApi.ts'), 'utf8');
const tabSrc = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'), 'utf8');

describe('adminArgumentsApi — sort option contract', () => {
  it('declares both sort field union members', () => {
    expect(apiSrc).toMatch(/AdminArgumentsSortField\s*=\s*'updated_at'\s*\|\s*'created_at'/);
  });

  it('declares both sort direction union members', () => {
    expect(apiSrc).toMatch(/AdminArgumentsSortDirection\s*=\s*'desc'\s*\|\s*'asc'/);
  });

  it('exposes sortField + sortDirection on LoadAdminArgumentsOptions', () => {
    expect(apiSrc).toContain('sortField?: AdminArgumentsSortField');
    expect(apiSrc).toContain('sortDirection?: AdminArgumentsSortDirection');
  });

  it('defaults to updated_at + desc when not specified', () => {
    expect(apiSrc).toMatch(/options\.sortField\s*===\s*'created_at'\s*\?\s*'created_at'\s*:\s*'updated_at'/);
    expect(apiSrc).toMatch(/options\.sortDirection\s*===\s*'asc'\s*\?\s*'asc'\s*:\s*'desc'/);
  });

  it('threads sortField + sortDirection through to .order()', () => {
    expect(apiSrc).toMatch(/\.order\(sortField,\s*\{\s*ascending:\s*sortDirection\s*===\s*'asc'\s*\}\s*\)/);
  });

  it('the loader does not touch service-role keys or auth header literals', () => {
    expect(apiSrc).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(apiSrc).not.toMatch(/serviceRoleKey/);
    expect(apiSrc).not.toMatch(/Authorization:\s*['"][Bb]earer/);
    expect(apiSrc).not.toMatch(/sb_secret_[A-Za-z0-9]/);
  });
});

describe('AdminArgumentsTab — table structure', () => {
  it('wraps the table in a horizontally scrollable container so columns never collapse', () => {
    expect(tabSrc).toMatch(/<ScrollView\s+horizontal/);
    expect(tabSrc).toMatch(/minWidth:\s*TABLE_WIDTH/);
  });

  it('renders a header row with sortable Created + Last Updated columns', () => {
    expect(tabSrc).toContain('SortableHeader');
    expect(tabSrc).toContain('field="created_at"');
    expect(tabSrc).toContain('field="updated_at"');
    expect(tabSrc).toContain('testID="admin-arguments-header-created"');
    expect(tabSrc).toContain('testID="admin-arguments-header-updated"');
  });

  it('per-row timestamp cells carry distinct testIDs (not card body text)', () => {
    expect(tabSrc).toContain('testID="admin-arguments-cell-created"');
    expect(tabSrc).toContain('testID="admin-arguments-cell-updated"');
  });

  it('shows the absolute timestamp + relative age as two stacked Text elements per cell', () => {
    // The cell renders <Text style={styles.timeAbsolute}>{formatDateTime(...)}</Text>
    // followed by <Text style={styles.timeRelative}>{formatRelativeShort(...)}</Text>.
    // The two MUST appear as separate Text nodes — no prose concatenation.
    expect(tabSrc).toMatch(/<Text style=\{styles\.timeAbsolute\}>\{formatDateTime\(r\.createdAt\)\}<\/Text>/);
    expect(tabSrc).toMatch(/<Text style=\{styles\.timeRelative\}>\{formatRelativeShort\(r\.createdAt\)\}<\/Text>/);
    expect(tabSrc).toMatch(/<Text style=\{styles\.timeAbsolute\}>\{formatDateTime\(updatedDisplay\)\}<\/Text>/);
    expect(tabSrc).toMatch(/<Text style=\{styles\.timeRelative\}>\{formatRelativeShort\(updatedDisplay\)\}<\/Text>/);
  });

  it('regression: no prose concatenation of date · relative', () => {
    // Anti-pattern from 6.1.6a:
    //   {formatDateTime(...)} · {formatRelativeShort(...)}
    // …would put the two side by side inside the same parent. The new
    // table places them in distinct stacked Texts.
    expect(tabSrc).not.toMatch(/formatDateTime\([^)]+\)\}\s*·\s*\{formatRelativeShort/);
  });
});

describe('AdminArgumentsTab — visible label contract', () => {
  it('plain-language sort labels — all four states', () => {
    expect(tabSrc).toContain("'updated_at:desc': 'Newest activity'");
    expect(tabSrc).toContain("'updated_at:asc': 'Oldest activity'");
    expect(tabSrc).toContain("'created_at:desc': 'Newest created'");
    expect(tabSrc).toContain("'created_at:asc': 'Oldest created'");
  });

  it('column-name dictionary uses "Last Updated" + "Created"', () => {
    expect(tabSrc).toContain("updated_at: 'Last Updated'");
    expect(tabSrc).toContain("created_at: 'Created'");
  });

  it('"Sorted by" status renders human label + column with arrow', () => {
    expect(tabSrc).toMatch(/Sorted by:\s*\{sortStatusColumn\}\s*\(\{sortStatusHuman\}\)/);
  });

  it('inactive sort header shows "tap to sort"; active header shows newest/oldest first', () => {
    expect(tabSrc).toContain('tap to sort');
    expect(tabSrc).toContain('↓ newest first');
    expect(tabSrc).toContain('↑ oldest first');
  });

  it('graceful fallback when updated_at is missing', () => {
    expect(tabSrc).toContain('Boolean(r.updatedAt)');
    expect(tabSrc).toContain('hasUpdated ? r.updatedAt : r.createdAt');
    expect(tabSrc).toContain('same as created');
  });
});

describe('AdminArgumentsTab — Poppy UI states', () => {
  it('loading state mentions argument activity + the active sort column', () => {
    expect(tabSrc).toMatch(/Loading latest argument activity…\s*\(sort:\s*\{sortStatusColumn\}\)/);
  });

  it('error state is actionable and tells the admin what to do', () => {
    expect(tabSrc).toContain('Check admin access and try again');
  });

  it('empty state explains what will appear and when', () => {
    expect(tabSrc).toContain('newest activity first');
  });

  it('filtered-empty state tells the admin how to recover', () => {
    expect(tabSrc).toContain('Try clearing filters or increasing the limit');
  });

  it('Poppy helper text + activity legend appear near the sort controls', () => {
    expect(tabSrc).toMatch(/Use .*Last Updated.* to find active conversations/);
    expect(tabSrc).toMatch(/Use .*Created.* to find newest rooms/);
    expect(tabSrc).toContain('Activity = most recent argument update');
    expect(tabSrc).toContain('Created = original post/room creation time');
  });
});

describe('AdminArgumentsTab — UI does not introduce verdict copy', () => {
  it('no verdict tokens in user-facing UI copy', () => {
    const lower = tabSrc.toLowerCase();
    for (const banned of [
      'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist',
      'propagandist', 'troll', 'bot user is bad', 'winner', 'loser',
    ]) {
      expect(lower).not.toContain(banned);
    }
  });
});
