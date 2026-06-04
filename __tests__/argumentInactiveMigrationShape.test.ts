/**
 * ADMIN-ARGS-INACTIVE-001 — Test: migration shape (textual scan).
 *
 * Pure-text scan of
 *   supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql.
 *
 * The migration MUST be strictly additive. These tests are the mechanical
 * safety net that fails CI if anyone changes the migration into a
 * destructive form (HALT triggers c, i, j in the design doc).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260604000001_admin_args_inactive_001_argument_inactive_state.sql',
);

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

describe('ADMIN-ARGS-INACTIVE-001 — migration file basics', () => {
  it('exists with non-empty content', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('references the card code in its header', () => {
    expect(migrationText).toContain('ADMIN-ARGS-INACTIVE-001');
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — additive only, no destructive DDL', () => {
  it('contains no INSERT INTO public.arguments (column-add migration, not data rewrite)', () => {
    // Allow lowercase / mixed-case via regex.
    expect(migrationText).not.toMatch(/INSERT\s+INTO\s+public\.arguments/i);
  });

  it('contains no DROP TABLE statement', () => {
    expect(migrationText).not.toMatch(/DROP\s+TABLE/i);
  });

  it('does not DROP a column from public.arguments', () => {
    expect(migrationText).not.toMatch(/ALTER\s+TABLE\s+public\.arguments\s+DROP\s+COLUMN/i);
  });

  it('does not drop a constraint on public.arguments', () => {
    expect(migrationText).not.toMatch(/ALTER\s+TABLE\s+public\.arguments\s+DROP\s+CONSTRAINT/i);
  });

  it('does not widen the existing status CHECK constraint', () => {
    // The existing status enum is draft|posted|hidden|deleted; widening it
    // would re-add a CHECK constraint on the status column.
    expect(migrationText).not.toMatch(/CHECK\s*\(\s*status\s+IN/i);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — three new nullable columns on public.arguments', () => {
  it('adds inactive_at as a nullable timestamptz with no DEFAULT', () => {
    expect(migrationText).toMatch(/ADD\s+COLUMN\s+inactive_at\s+timestamptz\s+NULL/i);
    expect(migrationText).not.toMatch(/inactive_at\s+timestamptz[^,\n]*DEFAULT/i);
  });

  it('adds inactive_by as a nullable uuid referencing public.profiles ON DELETE SET NULL', () => {
    expect(migrationText).toMatch(/ADD\s+COLUMN\s+inactive_by\s+uuid\s+NULL/i);
    expect(migrationText).toMatch(/inactive_by[\s\S]{0,200}REFERENCES\s+public\.profiles/i);
    expect(migrationText).toMatch(/inactive_by[\s\S]{0,200}ON\s+DELETE\s+SET\s+NULL/i);
  });

  it('adds inactive_reason as a nullable text column', () => {
    expect(migrationText).toMatch(/ADD\s+COLUMN\s+inactive_reason\s+text\s+NULL/i);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — two partial indexes on public.arguments', () => {
  it('creates arguments_inactive_at_null_idx as a partial index', () => {
    expect(migrationText).toMatch(/CREATE\s+INDEX\s+arguments_inactive_at_null_idx/i);
    expect(migrationText).toMatch(
      /arguments_inactive_at_null_idx[\s\S]{0,200}WHERE\s+inactive_at\s+IS\s+NULL/i,
    );
  });

  it('creates arguments_inactive_at_set_idx as a partial index', () => {
    expect(migrationText).toMatch(/CREATE\s+INDEX\s+arguments_inactive_at_set_idx/i);
    expect(migrationText).toMatch(
      /arguments_inactive_at_set_idx[\s\S]{0,200}WHERE\s+inactive_at\s+IS\s+NOT\s+NULL/i,
    );
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — argument_inactive_audit table shape', () => {
  it('creates the audit table', () => {
    expect(migrationText).toMatch(/CREATE\s+TABLE\s+public\.argument_inactive_audit/i);
  });

  it('audit table has no body column (only argument_id ref + timestamps + reason)', () => {
    // Body is in public.arguments; the audit row never duplicates it.
    expect(migrationText).not.toMatch(/argument_inactive_audit[\s\S]*\bbody\s+text/i);
  });

  it('audit table enables RLS', () => {
    expect(migrationText).toMatch(
      /ALTER\s+TABLE\s+public\.argument_inactive_audit\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
  });

  it('audit table has an admin SELECT policy gated on is_admin', () => {
    expect(migrationText).toMatch(
      /CREATE\s+POLICY[^\n]*argument_inactive_audit[\s\S]{0,300}FOR\s+SELECT[\s\S]{0,300}is_admin/i,
    );
  });

  it('audit table has an admin INSERT policy gated on is_admin', () => {
    expect(migrationText).toMatch(
      /CREATE\s+POLICY[^\n]*argument_inactive_audit[\s\S]{0,300}FOR\s+INSERT[\s\S]{0,300}is_admin/i,
    );
  });

  it('audit table has NO UPDATE policy', () => {
    expect(migrationText).not.toMatch(
      /CREATE\s+POLICY[^\n]*argument_inactive_audit[\s\S]{0,200}FOR\s+UPDATE/i,
    );
  });

  it('audit table has NO DELETE policy', () => {
    expect(migrationText).not.toMatch(
      /CREATE\s+POLICY[^\n]*argument_inactive_audit[\s\S]{0,200}FOR\s+DELETE/i,
    );
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — additive RLS on public.arguments', () => {
  it('drops the qol_039 SELECT policy by name (DROP IF EXISTS pattern)', () => {
    expect(migrationText).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"arguments:\s+select\s+own,\s+participant-private,\s+or\s+posted-public"/,
    );
  });

  it('creates the successor SELECT policy with inactive_at IS NULL on non-admin arms', () => {
    expect(migrationText).toMatch(
      /CREATE\s+POLICY\s+"arguments:\s+select\s+active\s+for\s+own\/participant\/public/,
    );
    // The author-own arm has inactive_at IS NULL.
    expect(migrationText).toMatch(/author_id\s*=\s*auth\.uid\(\)\s+AND\s+inactive_at\s+IS\s+NULL/i);
    // The posted-public/participant arm has inactive_at IS NULL.
    expect(migrationText).toMatch(/status\s*=\s*'posted'\s+AND\s+inactive_at\s+IS\s+NULL/i);
  });

  it('preserves the admin/moderator arm unrestricted (no inactive_at predicate)', () => {
    // The is_moderator_or_admin() arm appears WITHOUT an `AND inactive_at`
    // qualifier on the same line (the policy contains `is_moderator_or_admin()`
    // as its first arm).
    expect(migrationText).toMatch(/is_moderator_or_admin\(\)\s*$/m);
  });
});
