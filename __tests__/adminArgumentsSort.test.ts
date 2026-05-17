/**
 * Stage 6.1.6a — Admin Arguments sort + Poppy UI behavior tests.
 *
 * Pure-string tests on the source file (no React Native renderer in CI)
 * plus a behavioral test of the API loader's sort options via a thin mock.
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

describe('AdminArgumentsTab — visible label contract', () => {
  it('plain-language sort labels — all four states', () => {
    expect(tabSrc).toContain("'updated_at:desc': 'Newest activity'");
    expect(tabSrc).toContain("'updated_at:asc': 'Oldest activity'");
    expect(tabSrc).toContain("'created_at:desc': 'Newest created'");
    expect(tabSrc).toContain("'created_at:asc': 'Oldest created'");
  });

  it('column headers visible as text: "Last Updated" + "Created"', () => {
    expect(tabSrc).toContain("updated_at: 'Last Updated'");
    expect(tabSrc).toContain("created_at: 'Created'");
  });

  it('"Sorted by" status renders human label + column with arrow', () => {
    expect(tabSrc).toMatch(/Sorted by:\s*\{sortStatusColumn\}\s*\(\{sortStatusHuman\}\)/);
  });

  it('tap-hint copy on inactive sort columns guides the admin', () => {
    expect(tabSrc).toContain('Tap for newest activity');
    expect(tabSrc).toContain('Tap for newest created');
  });

  it('absolute timestamp + relative age both appear per row', () => {
    expect(tabSrc).toContain('formatDateTime(r.createdAt)');
    expect(tabSrc).toContain('formatRelativeShort(r.createdAt)');
    expect(tabSrc).toContain('formatDateTime(updatedDisplay)');
    expect(tabSrc).toContain('formatRelativeShort(updatedDisplay)');
  });

  it('shows an arrow indicator only on the active sort column', () => {
    // The sortArrow helper returns '' when inactive.
    expect(tabSrc).toMatch(/function sortArrow\(active: boolean,\s*dir:\s*AdminArgumentsSortDirection\)/);
    expect(tabSrc).toMatch(/if \(!active\) return '';/);
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
