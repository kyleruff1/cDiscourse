/**
 * ARCH-001 Card 2 — enqueue-kick migration (TEXT SCAN).
 *
 * Pure-text scan of supabase/migrations/20260528000023_arch_001_card2_enqueue_kick.sql.
 * The RUNTIME behavior (the statement-level trigger firing net.http_post; the
 * advisory-lock debounce) is exercised by the operator post-deploy + the smoke
 * runbook against the applied DB. These tests lock the migration SHAPE so the
 * §A.2 kick decision + the Vault-read + the OPS-001 ordering posture cannot
 * regress silently. Mirrors the Card-1/Card-2A migration text-scan tests.
 *
 * Covers intent-brief test (m) (no secret literal / no logged secret) for the
 * kick channel, plus the design §A.2 kick mechanism + §A.11 cron sequencing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260528000023_arch_001_card2_enqueue_kick.sql',
);

let migrationText = '';

/** Strip SQL line + block comments so keyword scans hit executable DDL only. */
function stripSqlComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

let code = ''; // comment-stripped executable SQL

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
  code = stripSqlComments(migrationText);
});

describe('ARCH-001 Card 2 — kick trigger function (design §A.2)', () => {
  it('KICK-1 — defines the trigger function arch_001_kick_classifier_drainer', () => {
    expect(code).toMatch(/CREATE OR REPLACE FUNCTION public\.arch_001_kick_classifier_drainer\(\)/);
    expect(code).toMatch(/RETURNS trigger/);
  });

  it('KICK-2 — is SECURITY INVOKER (no privilege-escalation surface)', () => {
    expect(code).toMatch(/SECURITY INVOKER/);
    expect(code).not.toMatch(/SECURITY DEFINER/);
  });

  it('KICK-3 — the trigger is STATEMENT-level AFTER INSERT (one kick per statement, not per row)', () => {
    expect(code).toMatch(/AFTER INSERT ON public\.argument_machine_observation_runs/);
    expect(code).toMatch(/FOR EACH STATEMENT/);
    expect(code).not.toMatch(/FOR EACH ROW/);
  });

  it('KICK-4 — uses a NEW TABLE transition (inserted_rows) to inspect what was inserted', () => {
    expect(code).toMatch(/REFERENCING NEW TABLE AS inserted_rows/);
  });

  it('KICK-5 — only kicks for QUEUE rows (state=pending AND family IS NOT NULL)', () => {
    // Direct-dispatch rows (state default succeeded, family NULL) must NOT kick.
    expect(code).toMatch(/ir\.state = 'pending'/);
    expect(code).toMatch(/ir\.family IS NOT NULL/);
  });

  it('KICK-6 — debounces concurrent submits via pg_try_advisory_xact_lock', () => {
    expect(code).toMatch(/pg_try_advisory_xact_lock\(/);
    // A failed lock grab → RETURN (skip the kick); another submit kicks.
    expect(code).toMatch(/IF NOT pg_try_advisory_xact_lock/);
  });

  it('KICK-7 — reads the drainer URL + secret from Supabase Vault (vault.decrypted_secrets)', () => {
    expect(code).toMatch(/FROM vault\.decrypted_secrets/);
    expect(code).toMatch(/name = 'arch_001_classifier_drainer_url'/);
    expect(code).toMatch(/name = 'arch_001_classifier_drainer_secret'/);
  });

  it('KICK-8 — an unseeded Vault secret SKIPS the kick (does NOT fail the INSERT)', () => {
    // OPS-001 ordering: applying before Vault is seeded must not break enqueue.
    expect(code).toMatch(/IF v_url IS NULL OR v_secret IS NULL/);
    // The skip is a RETURN, not a RAISE.
    expect(code).toMatch(/v_secret IS NULL OR length\(v_url\) = 0 OR length\(v_secret\) = 0 THEN\s*RETURN NULL/);
  });

  it('KICK-9 — fires net.http_post to the drainer (the kick), fire-and-forget', () => {
    expect(code).toMatch(/net\.http_post\(/);
  });

  it('KICK-10 — a net.http_post failure is swallowed (EXCEPTION), never failing the INSERT', () => {
    expect(code).toMatch(/EXCEPTION WHEN OTHERS THEN/);
  });
});

describe('ARCH-001 Card 2 — the AFTER INSERT trigger binding', () => {
  it('KICK-11 — creates the statement-level trigger bound to the function', () => {
    expect(code).toMatch(/CREATE TRIGGER arch_001_kick_classifier_drainer_trg/);
    expect(code).toMatch(/EXECUTE FUNCTION public\.arch_001_kick_classifier_drainer\(\)/);
  });

  it('KICK-12 — drops any pre-existing trigger of the same name first (idempotent re-apply)', () => {
    expect(code).toMatch(/DROP TRIGGER IF EXISTS arch_001_kick_classifier_drainer_trg/);
  });
});

describe('ARCH-001 Card 2 — secret safety + scope (test m + guardrails)', () => {
  it('KICK-13 — NO hardcoded secret literal anywhere (sk-ant/sb_secret/JWT/Bearer-token)', () => {
    expect(migrationText).not.toMatch(/sk-ant-[A-Za-z0-9]/);
    expect(migrationText).not.toMatch(/sb_secret_[A-Za-z0-9]/);
    expect(migrationText).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\./);
    // 'Bearer ' || v_secret reads the secret from Vault at runtime — that is
    // NOT a hardcoded token. Assert no contiguous 'Bearer <literal-token>'.
    expect(migrationText).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });

  it('KICK-14 — never RAISE/RAISE NOTICE the URL or secret (no logged secret)', () => {
    // The function body must not RAISE the URL/secret. A blanket scan: no
    // RAISE statement references v_url / v_secret.
    expect(code).not.toMatch(/RAISE[\s\S]*v_url/);
    expect(code).not.toMatch(/RAISE[\s\S]*v_secret/);
  });

  it('KICK-15 — NO table / column / index / RLS-policy change (kick is functions+trigger only)', () => {
    expect(code).not.toMatch(/CREATE TABLE/);
    expect(code).not.toMatch(/ADD COLUMN/);
    expect(code).not.toMatch(/ALTER COLUMN/);
    expect(code).not.toMatch(/CREATE INDEX/);
    expect(code).not.toMatch(/CREATE POLICY/);
    expect(code).not.toMatch(/ENABLE ROW LEVEL SECURITY/);
  });

  it('KICK-16 — does NOT redefine the Card-1/2A SQL functions', () => {
    for (const fn of [
      'enqueue_classifier_job',
      'claim_classifier_jobs',
      'acquire_drain_lease',
      'reclaim_stale_leases',
      'release_drain_lease',
      'finalize_classifier_job',
    ]) {
      expect(code).not.toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`));
    }
  });

  it('KICK-17 — does NOT cron.schedule in the migration (operator applies it AFTER deploy + Vault)', () => {
    // §A.11 step 1: scheduling the tick before the drainer/Vault exist would
    // net.http_post a null URL. The cron.schedule must be a COMMENTED operator
    // step only — never executable SQL in this migration.
    expect(code).not.toMatch(/cron\.schedule\(/);
    // The commented operator instructions DO mention it (the raw file has it).
    expect(migrationText).toMatch(/cron\.schedule\(/);
  });

  it('KICK-18 — does NOT CREATE EXTENSION (Card 1 already enabled pg_cron + pg_net)', () => {
    expect(code).not.toMatch(/CREATE EXTENSION/);
  });

  it('KICK-19 — does NOT COMMENT ON a storage.* target (PR-003 SQLSTATE 42501 boundary)', () => {
    expect(code).not.toMatch(/COMMENT ON[\s\S]*storage\./);
  });
});

describe('ARCH-001 Card 2 — migration is sequenced + written-not-applied', () => {
  it('KICK-20 — sequenced after the Card-2A finalizer (…22 → …23)', () => {
    expect(MIGRATION_PATH).toMatch(/20260528000023_arch_001_card2_enqueue_kick\.sql$/);
  });

  it('KICK-21 — header documents WRITTEN, NOT APPLIED (operator db push)', () => {
    expect(migrationText).toMatch(/WRITTEN, NOT APPLIED/);
  });
});
