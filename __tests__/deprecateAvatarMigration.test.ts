/**
 * PR-004 — Deprecation migration 17 source-scan tests.
 *
 * These tests verify the SQL of migration 17 without running it. The
 * OPS-001 reviewer template handles live apply via `npx supabase db
 * reset --linked=false` (when Docker is available) or textual review
 * (when not). The static source-scan codifies that review against the
 * four named issue classes plus the PR-003 storage-ownership lesson.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const MIGRATION_PATH = join(
  MIGRATIONS_DIR,
  '20260525000017_pr_004_deprecate_avatar_pipeline.sql',
);
const PRIOR_RLS_PATH = join(
  MIGRATIONS_DIR,
  '20260516000002_rls_policies.sql',
);

const SQL = readFileSync(MIGRATION_PATH, 'utf8');
const PRIOR_RLS = readFileSync(PRIOR_RLS_PATH, 'utf8');

/**
 * Strip SQL comments (-- line comments and /* block comments * /).
 * The migration's header intentionally mentions forbidden patterns
 * (`COMMENT ON POLICY ON storage.*`, `delete from storage.buckets`) as
 * teaching notes; we only forbid them in executable SQL.
 */
function stripSqlComments(src: string): string {
  // Strip /* ... */ block comments first.
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip -- line comments to end of line (preserve the newline).
  out = out.replace(/--.*$/gm, '');
  return out;
}

describe('PR-004 — deprecation migration source-scan', () => {
  it('migration file exists at the expected path', () => {
    expect(SQL.length).toBeGreaterThan(0);
  });

  it('header walks all four OPS-001 classes', () => {
    expect(SQL).toContain('Class 1 — Ambiguous column references in subqueries');
    expect(SQL).toContain('Class 2 — Column type mismatches');
    expect(SQL).toContain('Class 3 — Implicit ordering dependencies');
    expect(SQL).toContain('Class 4 — Function / trigger / extension dependencies');
  });

  it('header mentions the storage ownership lesson (PR-003 2026-05-24)', () => {
    expect(SQL).toContain('supabase_storage_admin');
    expect(SQL).toContain('2026-05-24');
    expect(SQL).toContain('PR-003 Storage Schema Comment Ownership');
  });

  it('does NOT contain any COMMENT ON POLICY ... ON storage.* statement', () => {
    // The 2026-05-24 lesson: COMMENT ON POLICY ... ON storage.objects
    // fails with SQLSTATE 42501 insufficient_privilege because storage
    // schema is owned by supabase_storage_admin, not the standard
    // migration role. Scan the comment-stripped SQL — the migration's
    // header explicitly mentions this forbidden pattern as a teaching
    // note; we forbid it only in executable statements.
    const executable = stripSqlComments(SQL).toLowerCase();
    expect(executable).not.toMatch(/comment\s+on\s+policy[\s\S]*?on\s+storage\./);
  });

  it('statement order: storage SELECT drop appears BEFORE column drops', () => {
    const storageDropIdx = SQL.indexOf('DROP POLICY IF EXISTS "profile-avatars: anyone can read"');
    const columnDropIdx = SQL.indexOf('DROP COLUMN IF EXISTS avatar_path');
    expect(storageDropIdx).toBeGreaterThan(-1);
    expect(columnDropIdx).toBeGreaterThan(-1);
    expect(storageDropIdx).toBeLessThan(columnDropIdx);
  });

  // 2026-05-25 recovery: assertion updated to match the migration's
  // post-hotfix DROP order. The PR-004 hotfix (commit 0756d2f) swapped
  // DROP POLICY narrowed and ALTER TABLE DROP COLUMN to satisfy
  // Postgres's dependency tracking (the narrowed policy's WITH CHECK
  // clause referenced the columns being dropped — SQLSTATE 2BP01 at
  // apply time). This test was originally written against the pre-hotfix
  // order; the assertion now matches the shipped order. See
  // docs/core/known-blockers.md "PR-004 DROP COLUMN Before DROP POLICY"
  // entry for the full lesson.
  it('statement order: narrowed UPDATE drop appears BEFORE column drops (post-hotfix)', () => {
    const columnDropIdx = SQL.indexOf('DROP COLUMN IF EXISTS avatar_path');
    const narrowedDropIdx = SQL.indexOf('DROP POLICY IF EXISTS "profiles: users update own — narrow"');
    expect(columnDropIdx).toBeGreaterThan(-1);
    expect(narrowedDropIdx).toBeGreaterThan(-1);
    expect(narrowedDropIdx).toBeLessThan(columnDropIdx);
  });

  it('statement order: narrowed UPDATE drop appears BEFORE restored UPDATE create', () => {
    const narrowedDropIdx = SQL.indexOf('DROP POLICY IF EXISTS "profiles: users update own — narrow"');
    const restoredCreateIdx = SQL.indexOf(
      'CREATE POLICY "profiles: users update own; mods update any"',
    );
    expect(narrowedDropIdx).toBeGreaterThan(-1);
    expect(restoredCreateIdx).toBeGreaterThan(-1);
    expect(narrowedDropIdx).toBeLessThan(restoredCreateIdx);
  });

  it('all four column drops use IF EXISTS', () => {
    // Each ALTER TABLE ... DROP COLUMN must be guarded by IF EXISTS.
    const columnNames = [
      'avatar_path',
      'avatar_thumb_path',
      'avatar_updated_at',
      'avatar_moderation_status',
    ];
    for (const col of columnNames) {
      const re = new RegExp(`DROP COLUMN IF EXISTS ${col}`);
      expect(SQL).toMatch(re);
    }
  });

  it('both policy drops use IF EXISTS', () => {
    expect(SQL).toMatch(/DROP POLICY IF EXISTS "profile-avatars: anyone can read"/);
    expect(SQL).toMatch(/DROP POLICY IF EXISTS "profiles: users update own — narrow"/);
  });

  it('idempotency: restored policy is dropped first with IF EXISTS before CREATE', () => {
    // Statement 4 must DROP IF EXISTS "profiles: users update own; mods
    // update any" before CREATE-ing it, so re-running the migration
    // on a partial-apply state is safe.
    const dropRestoredIdx = SQL.indexOf(
      'DROP POLICY IF EXISTS "profiles: users update own; mods update any"',
    );
    const createRestoredIdx = SQL.indexOf(
      'CREATE POLICY "profiles: users update own; mods update any"',
    );
    expect(dropRestoredIdx).toBeGreaterThan(-1);
    expect(createRestoredIdx).toBeGreaterThan(-1);
    expect(dropRestoredIdx).toBeLessThan(createRestoredIdx);
  });

  it('restored UPDATE policy body matches the byte-equal text from migration 02', () => {
    // Extract the restored policy block from this migration and the
    // matching policy block from migration 02. Compare the USING and
    // WITH CHECK clauses (excluding leading/trailing whitespace).
    const restoredPolicyMatch = SQL.match(
      /CREATE POLICY "profiles: users update own; mods update any"\s+ON public\.profiles FOR UPDATE\s+TO authenticated\s+USING \(([\s\S]*?)\)\s+WITH CHECK \(([\s\S]*?)\);/,
    );
    expect(restoredPolicyMatch).not.toBeNull();
    const restoredUsing = restoredPolicyMatch![1].replace(/\s+/g, ' ').trim();
    const restoredWithCheck = restoredPolicyMatch![2].replace(/\s+/g, ' ').trim();

    const originalPolicyMatch = PRIOR_RLS.match(
      /CREATE POLICY "profiles: users update own; mods update any"\s+ON public\.profiles FOR UPDATE\s+TO authenticated\s+USING \(([\s\S]*?)\)\s+WITH CHECK \(([\s\S]*?)\);/,
    );
    expect(originalPolicyMatch).not.toBeNull();
    const originalUsing = originalPolicyMatch![1].replace(/\s+/g, ' ').trim();
    const originalWithCheck = originalPolicyMatch![2].replace(/\s+/g, ' ').trim();

    expect(restoredUsing).toBe(originalUsing);
    expect(restoredWithCheck).toBe(originalWithCheck);
  });

  it('no DROP COLUMN outside the four named columns', () => {
    // Find every DROP COLUMN ... statement and assert it references
    // only one of the four expected columns. Any other DROP COLUMN
    // would be scope creep.
    const allowedColumns = new Set([
      'avatar_path',
      'avatar_thumb_path',
      'avatar_updated_at',
      'avatar_moderation_status',
    ]);
    const matches = SQL.match(/DROP COLUMN IF EXISTS (\w+)/g) ?? [];
    for (const m of matches) {
      const col = m.replace(/DROP COLUMN IF EXISTS\s+/, '').trim();
      expect(allowedColumns.has(col)).toBe(true);
    }
  });

  it('no DROP TABLE, DROP FUNCTION, or DROP EXTENSION anywhere', () => {
    // Scope guard: this migration drops policies + columns only.
    // Anything else is a scope violation.
    const lower = SQL.toLowerCase();
    // Use word boundaries to avoid catching DROP POLICY / DROP COLUMN.
    expect(lower).not.toMatch(/\bdrop\s+table\b/);
    expect(lower).not.toMatch(/\bdrop\s+function\b/);
    expect(lower).not.toMatch(/\bdrop\s+extension\b/);
    expect(lower).not.toMatch(/\bdrop\s+trigger\b/);
  });

  it('does NOT contain delete from storage.buckets (privilege boundary)', () => {
    // delete from storage.buckets requires supabase_storage_admin
    // ownership for the same reason COMMENT ON POLICY ON storage.*
    // does. The bucket is intentionally left empty rather than dropped.
    // Scan comment-stripped SQL — the migration header explicitly
    // mentions this forbidden pattern as a teaching note.
    const executable = stripSqlComments(SQL).toLowerCase();
    expect(executable).not.toMatch(/delete\s+from\s+storage\.buckets/);
    expect(executable).not.toMatch(/drop\s+bucket/);
  });

  it('contains no service-role escalation or role-switching SQL', () => {
    // The migration runs in the standard migration role. There is no
    // SET ROLE, no SECURITY DEFINER (the restored policy uses the
    // existing helper, doesn't redefine it).
    const lower = SQL.toLowerCase();
    expect(lower).not.toMatch(/\bset\s+role\b/);
    expect(lower).not.toMatch(/security\s+definer/);
    expect(lower).not.toContain('service_role');
  });
});
