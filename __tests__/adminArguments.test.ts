/**
 * Stage 6.1.5.1 — Admin Arguments tab — non-rendering contract tests.
 *
 * We don't mount the React Native component here (no native renderer in CI);
 * we test the types + loader shape + the source-file safety contracts.
 *  - AdminArgumentRow fields are stable.
 *  - The new tab id is wired into AdminScreen.
 *  - The loader doesn't import service-role or admin-users service paths
 *    that bypass RLS.
 *  - The tab's source never imports an Authorization header literal.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

describe('AdminArgumentRow type surface', () => {
  it('export from features/admin/types has the expected fields', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/types.ts'), 'utf8');
    for (const field of [
      'AdminArgumentRow', 'createdAt', 'updatedAt', 'debateTitle', 'authorDisplayName',
      'argumentType', 'disagreementAxis', 'targetExcerpt', 'topicSatisfactionScore',
      'selectedTagCodes',
    ]) {
      expect(src).toContain(field);
    }
  });

  it('no longer declares the removed hasEvidence field (QOL-026)', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/types.ts'), 'utf8');
    expect(src).not.toContain('hasEvidence');
  });
});

describe('AdminScreen wiring', () => {
  it('AdminScreen registers the "arguments" tab id and the AdminArgumentsTab component', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminScreen.tsx'), 'utf8');
    expect(src).toContain("'arguments'");
    expect(src).toContain('AdminArgumentsTab');
  });

  it('ADMIN_TAB_LABELS contains an "arguments" label', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/types.ts'), 'utf8');
    expect(src).toMatch(/arguments\s*:\s*['"]Arguments['"]/);
  });
});

describe('adminArgumentsApi — safety + shape', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/adminArgumentsApi.ts'), 'utf8');

  it('uses the shared supabase client (no service-role construction)', () => {
    expect(src).toContain("from '../../lib/supabase'");
    expect(src).not.toMatch(/createClient\(/);
  });

  it('does not import or reference any service-role / secret-shape strings', () => {
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/serviceRoleKey/);
    expect(src).not.toMatch(/sb_secret_[A-Za-z0-9]/);
  });

  it('uses RLS-friendly select (no .rpc() bypass)', () => {
    expect(src).toContain(".from('arguments')");
    expect(src).not.toMatch(/\.rpc\(/);
  });

  it('selects updated_at + created_at columns', () => {
    expect(src).toContain('updated_at');
    expect(src).toContain('created_at');
  });

  it('joins debates(title) and profiles(display_name)', () => {
    expect(src).toContain('debates(title)');
    expect(src).toContain('profiles(display_name)');
  });

  // QOL-026: the loader must not select columns that do not exist on
  // `public.arguments`. `selected_tag_codes` and `attached_evidence` were
  // both bad scalar columns — PostgREST reports unknown columns one at a
  // time, so the page failed on the first and would fail on the second.
  it('does not select the non-existent selected_tag_codes column', () => {
    expect(src).not.toContain('selected_tag_codes');
  });

  it('does not select the non-existent attached_evidence column', () => {
    expect(src).not.toContain('attached_evidence');
  });

  it('does not map a hasEvidence field (evidence indicator removed in QOL-026)', () => {
    expect(src).not.toContain('hasEvidence');
  });

  it('requests tags via the argument_tags(tag_code) nested embed', () => {
    expect(src).toContain('argument_tags(tag_code)');
  });

  it('RawArgumentRow declares the embedded argument_tags relation', () => {
    expect(src).toMatch(/argument_tags:\s*\{\s*tag_code/);
  });

  it('maps the embed into selectedTagCodes via the asTagCodes helper', () => {
    expect(src).toContain('selectedTagCodes: asTagCodes(r.argument_tags)');
  });

  it('exposes a sortField + sortDirection option to the loader', () => {
    expect(src).toContain('AdminArgumentsSortField');
    expect(src).toContain('AdminArgumentsSortDirection');
    expect(src).toContain('sortField');
    expect(src).toContain('sortDirection');
  });

  it('default sort is updated_at desc', () => {
    // Default sortField → updated_at; default sortDirection → desc
    // (ascending: false).
    expect(src).toMatch(/sortField\s*===?\s*'created_at'\s*\?\s*'created_at'\s*:\s*'updated_at'/);
    expect(src).toMatch(/sortDirection\s*===?\s*'asc'\s*\?\s*'asc'\s*:\s*'desc'/);
    expect(src).toMatch(/order\(sortField,\s*\{\s*ascending:\s*sortDirection\s*===\s*'asc'\s*\}\s*\)/);
  });
});

describe('AdminArgumentsTab — source-file safety', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'), 'utf8');

  it('never logs Authorization headers or bearer values', () => {
    expect(src).not.toMatch(/console\.(log|error|warn)\([^)]*Authorization[^)]*\$\{/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });

  it('renders both timestamps using formatDateTime (with fallback display for missing updated_at)', () => {
    expect(src).toContain('formatDateTime(r.createdAt)');
    // Stage 6.1.6a: the "Last Updated" cell shows updatedDisplay, which
    // is `r.updatedAt` when present, else falls back to `r.createdAt`.
    expect(src).toContain('formatDateTime(updatedDisplay)');
  });

  it('uses the message qualifier deriver, not free-form text', () => {
    expect(src).toContain('deriveMessageCategory');
    expect(src).toContain('derivePrimaryQualifier');
    expect(src).toContain('formatCategoryLabel');
    expect(src).toContain('formatQualifierLabel');
  });

  it('does not expose raw author email or auth token in the row', () => {
    // The row uses authorDisplayName (with shortened id fallback). No email reads.
    expect(src).not.toMatch(/authorEmail/);
    expect(src).not.toMatch(/access_token/);
    expect(src).not.toMatch(/refresh_token/);
  });
});

describe('AdminArgumentsTab — footnote disclaimer', () => {
  it('renders a non-verdict advisory footnote', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'), 'utf8');
    expect(src).toMatch(/advisory/);
    // No verdict tokens in the user-facing copy.
    for (const banned of ['truth', 'winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative']) {
      expect(src.toLowerCase()).not.toContain(banned);
    }
  });
});

describe('AdminArgumentsTab — Stage 6.1.6b table layout', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'), 'utf8');

  it('renders every required column header literal', () => {
    for (const label of [
      'Status', 'Side', 'Type', 'Debate / Argument',
      'Category / Qualifier', 'Created', 'Last Updated', 'Action',
    ]) {
      expect(src).toContain(`label="${label}"`);
    }
  });

  it('table + sortable header + cell testIDs are present', () => {
    expect(src).toContain('testID="admin-arguments-table"');
    expect(src).toContain('testID="admin-arguments-header-created"');
    expect(src).toContain('testID="admin-arguments-header-updated"');
    expect(src).toContain('testID="admin-arguments-cell-created"');
    expect(src).toContain('testID="admin-arguments-cell-updated"');
  });

  it('renders a visible "Sorted by:" status label', () => {
    expect(src).toContain('Sorted by:');
  });

  it('includes plain-language sort labels for all four states', () => {
    expect(src).toContain('Newest activity');
    expect(src).toContain('Oldest activity');
    expect(src).toContain('Newest created');
    expect(src).toContain('Oldest created');
  });

  it('default sort state is updated_at + desc', () => {
    expect(src).toMatch(/useState<AdminArgumentsSortField>\('updated_at'\)/);
    expect(src).toMatch(/useState<AdminArgumentsSortDirection>\('desc'\)/);
  });

  it('clicking a sort column toggles direction; switching column resets to desc', () => {
    expect(src).toMatch(/setSortDirection\(\(d\)\s*=>\s*\(d\s*===\s*'desc'\s*\?\s*'asc'\s*:\s*'desc'\)\)/);
    expect(src).toMatch(/setSortField\(field\);\s*setSortDirection\('desc'\)/);
  });

  it('passes sortField + sortDirection through to loadAdminArguments', () => {
    expect(src).toMatch(/loadAdminArguments\(\{\s*limit,\s*sortField,\s*sortDirection\s*\}\)/);
  });

  it('falls back to createdAt display when updatedAt is missing', () => {
    expect(src).toMatch(/hasUpdated\s*=\s*Boolean\(r\.updatedAt\)/);
    expect(src).toMatch(/updatedDisplay\s*=\s*hasUpdated\s*\?\s*r\.updatedAt\s*:\s*r\.createdAt/);
    expect(src).toContain('same as created');
  });

  it('exposes accessibility labels for sort affordances + table status', () => {
    expect(src).toContain('admin-arguments-sort-status');
    expect(src).toContain('accessibilityLabel={`Sort by ${label}`}');
  });

  it('renders explanatory empty / loading / error / filtered-empty states', () => {
    expect(src).toMatch(/Loading latest argument activity…/);
    expect(src).toMatch(/Could not load argument activity\. Check admin access and try again\./);
    expect(src).toMatch(/No arguments yet/);
    expect(src).toMatch(/No arguments match this search\. Try clearing filters or increasing the limit\./);
    expect(src).toContain('admin-arguments-empty');
    expect(src).toContain('admin-arguments-empty-filtered');
    expect(src).toContain('admin-arguments-error');
    expect(src).toContain('admin-arguments-loading');
  });

  it('renders the Poppy UI helper text + legend', () => {
    expect(src).toMatch(/Use .*Last Updated.* to find active conversations/);
    expect(src).toMatch(/Use .*Created.* to find newest rooms/);
    expect(src).toMatch(/Activity = most recent argument update/);
    expect(src).toMatch(/Created = original post\/room creation time/);
    expect(src).toContain('admin-arguments-sort-helper');
    expect(src).toContain('admin-arguments-sort-legend');
  });

  it('shows both absolute timestamp + short relative age per row, as SEPARATE Text elements (not prose)', () => {
    expect(src).toContain('formatDateTime(r.createdAt)');
    expect(src).toContain('formatRelativeShort(r.createdAt)');
    expect(src).toContain('formatDateTime(updatedDisplay)');
    expect(src).toContain('formatRelativeShort(updatedDisplay)');
    // The timestamp cells must use separate <Text style={styles.timeAbsolute}>
    // and <Text style={styles.timeRelative}> — never a concatenated sentence.
    expect(src).toMatch(/styles\.timeAbsolute/);
    expect(src).toMatch(/styles\.timeRelative/);
    expect(src).not.toMatch(/formatDateTime\([^)]+\)\s*\}\s*·\s*\{\s*formatRelativeShort/);
  });

  it('uses an arrow indicator for the active sort column', () => {
    expect(src).toMatch(/↓|↑/);
    expect(src).toMatch(/function sortArrow/);
  });

  // QOL-026: the evidence badge was gated on `r.hasEvidence`, derived from
  // a column (`attached_evidence`) that never existed. The badge therefore
  // never showed real data and is removed entirely.
  it('no longer renders the evidence badge (QOL-026)', () => {
    expect(src).not.toContain('variant="evidence"');
    expect(src).not.toContain('hasEvidence');
  });

  it('sortable headers are buttons with accessibility role + state', () => {
    expect(src).toContain('accessibilityRole="button"');
    expect(src).toMatch(/accessibilityState=\{\{ selected: active \}\}/);
    expect(src).toMatch(/sorted descending/);
    expect(src).toMatch(/sorted ascending/);
  });
});

describe('AdminHistoryTab — Stage 6.1.6a polish', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminHistoryTab.tsx'), 'utf8');

  it('formats audit event timestamps via formatDateTime + formatRelativeShort', () => {
    expect(src).toContain("from '../../lib/formatDateTime'");
    expect(src).toContain('formatDateTime(e.created_at)');
    expect(src).toContain('formatRelativeShort(e.created_at)');
  });

  it('renders explanatory loading / error / empty / sort-status copy', () => {
    expect(src).toMatch(/Loading audit events…/);
    expect(src).toMatch(/Could not load events/);
    expect(src).toMatch(/No events for this user/);
    expect(src).toMatch(/Sorted by: Created/);
  });

  it('does not reference service-role keys or Authorization literals', () => {
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/serviceRoleKey/);
    expect(src).not.toMatch(/Authorization:\s*['"][Bb]earer/);
  });
});
