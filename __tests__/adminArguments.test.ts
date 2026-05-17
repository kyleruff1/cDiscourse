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
    ]) {
      expect(src).toContain(field);
    }
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
});

describe('AdminArgumentsTab — source-file safety', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'), 'utf8');

  it('never logs Authorization headers or bearer values', () => {
    expect(src).not.toMatch(/console\.(log|error|warn)\([^)]*Authorization[^)]*\$\{/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });

  it('renders both timestamps using formatDateTime', () => {
    expect(src).toContain('formatDateTime(r.createdAt)');
    expect(src).toContain('formatDateTime(r.updatedAt)');
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
