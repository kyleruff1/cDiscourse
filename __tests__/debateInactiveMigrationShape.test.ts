/**
 * ADMIN-CONV-INACTIVE-001 — Test: migration shape (textual scan).
 *
 * Pure-text scan of
 *   supabase/migrations/20260606000001_admin_conv_inactive_001_debate_inactive_state.sql.
 *
 * The migration MUST be strictly additive. These tests are the mechanical
 * safety net that fails CI if anyone changes the migration into a destructive
 * form, or removes one of the load-bearing pieces (columns / indexes / audit
 * table / cascade helper / debates SELECT successor).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260606000001_admin_conv_inactive_001_debate_inactive_state.sql',
);

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

describe('ADMIN-CONV-INACTIVE-001 — migration file basics', () => {
  it('exists with non-empty content', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('references the card code in its header', () => {
    expect(migrationText).toContain('ADMIN-CONV-INACTIVE-001');
  });
});

describe('ADMIN-CONV-INACTIVE-001 — additive only, no destructive DDL', () => {
  it('contains no INSERT INTO public.debates (column-add migration, not data rewrite)', () => {
    expect(migrationText).not.toMatch(/INSERT\s+INTO\s+public\.debates/i);
  });

  it('contains no DROP TABLE statement', () => {
    expect(migrationText).not.toMatch(/DROP\s+TABLE/i);
  });

  it('does not DROP a column from public.debates', () => {
    expect(migrationText).not.toMatch(/ALTER\s+TABLE\s+public\.debates\s+DROP\s+COLUMN/i);
  });

  it('does not drop a constraint on public.debates', () => {
    expect(migrationText).not.toMatch(/ALTER\s+TABLE\s+public\.debates\s+DROP\s+CONSTRAINT/i);
  });

  it('does not widen the existing status CHECK constraint on debates', () => {
    // Widening the status enum would re-add a CHECK (status IN ...) clause.
    // The pre-existing CHECK lives in the initial schema and is untouched.
    expect(migrationText).not.toMatch(/CHECK\s*\(\s*status\s+IN/i);
  });
});

describe('ADMIN-CONV-INACTIVE-001 — three new nullable columns on public.debates', () => {
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

describe('ADMIN-CONV-INACTIVE-001 — two partial indexes on public.debates', () => {
  it('creates debates_inactive_at_null_idx as a partial index', () => {
    expect(migrationText).toMatch(/CREATE\s+INDEX\s+debates_inactive_at_null_idx/i);
    expect(migrationText).toMatch(
      /debates_inactive_at_null_idx[\s\S]{0,200}WHERE\s+inactive_at\s+IS\s+NULL/i,
    );
  });

  it('creates debates_inactive_at_set_idx as a partial index', () => {
    expect(migrationText).toMatch(/CREATE\s+INDEX\s+debates_inactive_at_set_idx/i);
    expect(migrationText).toMatch(
      /debates_inactive_at_set_idx[\s\S]{0,200}WHERE\s+inactive_at\s+IS\s+NOT\s+NULL/i,
    );
  });
});

describe('ADMIN-CONV-INACTIVE-001 — debate_inactive_audit table shape', () => {
  it('creates the audit table', () => {
    expect(migrationText).toMatch(/CREATE\s+TABLE\s+public\.debate_inactive_audit/i);
  });

  it('audit table has no title/resolution/body column (only debate_id ref + timestamps + reason)', () => {
    expect(migrationText).not.toMatch(/debate_inactive_audit[\s\S]*\b(title|resolution|body)\s+text/i);
  });

  it('audit table enables RLS', () => {
    expect(migrationText).toMatch(
      /ALTER\s+TABLE\s+public\.debate_inactive_audit\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
  });

  it('audit table has an admin SELECT policy gated on is_admin', () => {
    expect(migrationText).toMatch(
      /CREATE\s+POLICY[^\n]*debate_inactive_audit[\s\S]{0,300}FOR\s+SELECT[\s\S]{0,300}is_admin/i,
    );
  });

  it('audit table has an admin INSERT policy gated on is_admin', () => {
    expect(migrationText).toMatch(
      /CREATE\s+POLICY[^\n]*debate_inactive_audit[\s\S]{0,300}FOR\s+INSERT[\s\S]{0,300}is_admin/i,
    );
  });

  it('audit table has NO UPDATE policy', () => {
    expect(migrationText).not.toMatch(
      /CREATE\s+POLICY[^\n]*debate_inactive_audit[\s\S]{0,200}FOR\s+UPDATE/i,
    );
  });

  it('audit table has NO DELETE policy', () => {
    expect(migrationText).not.toMatch(
      /CREATE\s+POLICY[^\n]*debate_inactive_audit[\s\S]{0,200}FOR\s+DELETE/i,
    );
  });
});

describe('ADMIN-CONV-INACTIVE-001 — is_debate_inactive cascade helper', () => {
  it('defines the SECURITY DEFINER helper with a locked search_path', () => {
    expect(migrationText).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.is_debate_inactive\(p_debate_id\s+uuid\)/i);
    expect(migrationText).toMatch(/is_debate_inactive[\s\S]{0,200}SECURITY\s+DEFINER/i);
    expect(migrationText).toMatch(/is_debate_inactive[\s\S]{0,200}SET\s+search_path\s*=\s*public/i);
  });

  it('revokes EXECUTE from PUBLIC and grants it to authenticated', () => {
    expect(migrationText).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.is_debate_inactive\(uuid\)\s+FROM\s+PUBLIC/i);
    expect(migrationText).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_debate_inactive\(uuid\)\s+TO\s+authenticated/i);
  });
});

describe('ADMIN-CONV-INACTIVE-001 — debates SELECT successor (qol_039 DROP+CREATE)', () => {
  it('drops the qol_039 debates SELECT policy by name (DROP IF EXISTS pattern)', () => {
    expect(migrationText).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"debates:\s+select\s+public-open,\s+own,\s+or\s+participant"/,
    );
  });

  it('creates the successor SELECT policy with inactive_at IS NULL on non-admin arms', () => {
    expect(migrationText).toMatch(
      /CREATE\s+POLICY\s+"debates:\s+select\s+active\s+public-open,\s+own,\s+or\s+participant;\s+admins\s+read\s+all"/,
    );
    // Creator arm + participant arm + public arm all gated on inactive_at IS NULL.
    expect(migrationText).toMatch(/created_by\s*=\s*auth\.uid\(\)\s+AND\s+inactive_at\s+IS\s+NULL/i);
    expect(migrationText).toMatch(/is_debate_participant\(id,\s*auth\.uid\(\)\)\s+AND\s+inactive_at\s+IS\s+NULL/i);
    expect(migrationText).toMatch(/visibility\s*=\s*'public'[\s\S]{0,80}inactive_at\s+IS\s+NULL/i);
  });

  it('keeps the admin/moderator arm unrestricted (is_moderator_or_admin first arm)', () => {
    expect(migrationText).toMatch(/is_moderator_or_admin\(\)\s*$/m);
  });
});
