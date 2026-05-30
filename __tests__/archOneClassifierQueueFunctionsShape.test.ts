/**
 * ARCH-001 Card 1 — SQL function shape + the load-bearing ON CONFLICT form.
 *
 * Pure-text scan of the migration's CREATE FUNCTION bodies. The RUNTIME
 * behavior of these functions (SKIP-LOCKED isolation, the lease race) is
 * proven by scripts/arch-001-card1-sql/verify-classifier-queue-substrate.sql
 * against the applied DB. THESE tests lock the function DEFINITIONS so the
 * design §A.4 logic — and especially the enqueue idempotency
 * column-inference-with-predicate ON CONFLICT (NOT ON CONSTRAINT) — cannot
 * regress silently.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260528000021_arch_001_classifier_queue_substrate.sql',
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

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

/** Extract the body of a CREATE OR REPLACE FUNCTION up to the closing `$$;`. */
function functionBody(name: string): string {
  const start = migrationText.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  if (start < 0) return '';
  // The body ends at the first `$$;` AFTER the opening `AS $$`.
  const open = migrationText.indexOf('AS $$', start);
  const close = migrationText.indexOf('$$;', open);
  return migrationText.slice(start, close + 3);
}

describe('ARCH-001 Card 1 — all five SQL functions are defined', () => {
  const FUNCTIONS = [
    'claim_classifier_jobs',
    'acquire_drain_lease',
    'release_drain_lease',
    'reclaim_stale_leases',
    'enqueue_classifier_job',
  ];

  it('FN-1 — every required function has a CREATE OR REPLACE FUNCTION', () => {
    for (const fn of FUNCTIONS) {
      expect(migrationText).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
    }
  });

  it('FN-2 — every function is SECURITY INVOKER (no SECURITY DEFINER escalation surface)', () => {
    for (const fn of FUNCTIONS) {
      const body = functionBody(fn);
      expect(body).toMatch(/SECURITY INVOKER/);
    }
    // and NO function is SECURITY DEFINER in executable SQL. (The header
    // comment legitimately MENTIONS "no SECURITY DEFINER … surface", so we
    // scan the comment-stripped text, not the raw file.)
    expect(stripSqlComments(migrationText)).not.toMatch(/SECURITY DEFINER/);
  });
});

describe('ARCH-001 Card 1 — claim_classifier_jobs (design §A.3 claim CTE)', () => {
  const body = (): string => functionBody('claim_classifier_jobs');

  it('FN-3 — signature is (batch_size int, owner text, lease interval)', () => {
    expect(migrationText).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_classifier_jobs\(\s*batch_size int,\s*owner\s+text,\s*lease\s+interval\s*\)/,
    );
  });

  it('FN-4 — selects due rows: state IN (pending, retry_scheduled) AND available_at <= now() AND family IS NOT NULL', () => {
    const b = body();
    expect(b).toMatch(/state IN \('pending', 'retry_scheduled'\)/);
    expect(b).toMatch(/available_at <= now\(\)/);
    expect(b).toMatch(/family IS NOT NULL/);
  });

  it('FN-5 — orders by available_at, created_at and LIMIT batch_size', () => {
    const b = body();
    expect(b).toMatch(/ORDER BY r\.available_at, r\.created_at/);
    expect(b).toMatch(/LIMIT batch_size/);
  });

  it('FN-6 — uses FOR UPDATE SKIP LOCKED (the defence-in-depth claim lock)', () => {
    expect(body()).toMatch(/FOR UPDATE SKIP LOCKED/);
  });

  it('FN-7 — UPDATE sets state=leased, lease_owner, lease_expires_at, bumps attempt_count + last_attempt_at', () => {
    const b = body();
    expect(b).toMatch(/SET state\s*=\s*'leased'/);
    expect(b).toMatch(/lease_owner\s*=\s*claim_classifier_jobs\.owner/);
    expect(b).toMatch(/lease_expires_at\s*=\s*now\(\) \+ claim_classifier_jobs\.lease/);
    expect(b).toMatch(/attempt_count\s*=\s*r\.attempt_count \+ 1/);
    expect(b).toMatch(/last_attempt_at\s*=\s*now\(\)/);
  });

  it('FN-8 — RETURNING the claimed rows (id, argument_id, family, run_mode)', () => {
    expect(body()).toMatch(/RETURNING r\.id, r\.argument_id, r\.family, r\.run_mode/);
  });
});

describe('ARCH-001 Card 1 — acquire/release_drain_lease (design §A.4 TTL lease)', () => {
  it('FN-9 — acquire signature is (owner text, ttl interval)', () => {
    expect(migrationText).toMatch(
      /CREATE OR REPLACE FUNCTION public\.acquire_drain_lease\(\s*owner\s+text,\s*ttl\s+interval\s*\)/,
    );
  });

  it('FN-10 — acquire INSERTs with the constant lock_key classifier_drain', () => {
    const b = functionBody('acquire_drain_lease');
    expect(b).toMatch(/INSERT INTO public\.classifier_drain_lock \(lock_key, owner, expires_at\)/);
    expect(b).toMatch(/'classifier_drain'/);
  });

  it('FN-11 — acquire uses ON CONFLICT (lock_key) DO UPDATE … WHERE classifier_drain_lock.expires_at < now() (only steal EXPIRED)', () => {
    const b = functionBody('acquire_drain_lease');
    expect(b).toMatch(/ON CONFLICT \(lock_key\) DO UPDATE/);
    // The steal precondition MUST be fully-qualified (OPS-001 Class 1) and
    // gate on expiry — this is what makes two concurrent acquirers safe.
    expect(b).toMatch(/WHERE classifier_drain_lock\.expires_at < now\(\)/);
    // RETURNING the column (qualified to disambiguate from the `owner`
    // parameter): yields the owner now holding the lease, or zero rows when
    // a live lease is held by someone else → the function returns NULL.
    expect(b).toMatch(/RETURNING classifier_drain_lock\.owner/);
  });

  it('FN-12 — release deletes only the OWN lease (lock_key + owner match) and returns the row count', () => {
    const b = functionBody('release_drain_lease');
    expect(b).toMatch(/DELETE FROM public\.classifier_drain_lock/);
    expect(b).toMatch(/lock_key = 'classifier_drain'/);
    expect(b).toMatch(/classifier_drain_lock\.owner = release_drain_lease\.owner/);
    expect(b).toMatch(/GET DIAGNOSTICS\s+\w+\s*=\s*ROW_COUNT/);
  });
});

describe('ARCH-001 Card 1 — reclaim_stale_leases (design §A.3 reconciler / §A.9 cap)', () => {
  const body = (): string => functionBody('reclaim_stale_leases');

  it('FN-13 — targets leased rows past lease_expires_at, queue rows only (family IS NOT NULL)', () => {
    const b = body();
    expect(b).toMatch(/WHERE r\.state = 'leased'/);
    expect(b).toMatch(/r\.lease_expires_at < now\(\)/);
    expect(b).toMatch(/r\.family IS NOT NULL/);
  });

  it('FN-14 — below cap → retry_scheduled, at the attempt cap (3) → dead_letter', () => {
    const b = body();
    expect(b).toMatch(/max_attempts CONSTANT int := 3/);
    expect(b).toMatch(/WHEN r\.attempt_count >= max_attempts THEN 'dead_letter'/);
    expect(b).toMatch(/ELSE 'retry_scheduled'/);
  });

  it('FN-15 — clears the lease (lease_owner / lease_expires_at NULL) on reclaim and returns the reclaimed count', () => {
    const b = body();
    expect(b).toMatch(/lease_owner = NULL/);
    expect(b).toMatch(/lease_expires_at = NULL/);
    expect(b).toMatch(/GET DIAGNOSTICS\s+\w+\s*=\s*ROW_COUNT/);
  });
});

describe('ARCH-001 Card 1 — enqueue_classifier_job (THE load-bearing ON CONFLICT form)', () => {
  const body = (): string => functionBody('enqueue_classifier_job');

  it('FN-16 — INSERTs a pending queue row mirroring family into requested_families', () => {
    const b = body();
    expect(b).toMatch(/INSERT INTO public\.argument_machine_observation_runs/);
    expect(b).toMatch(/'pending'/);
    expect(b).toMatch(/ARRAY\[p_family\]/);
  });

  it('FN-17 — uses column-inference ON CONFLICT (argument_id, family, run_mode, schema_version), NOT ON CONSTRAINT', () => {
    const b = body();
    expect(b).toMatch(
      /ON CONFLICT \(argument_id, family, run_mode, schema_version\)/,
    );
    // ON CONSTRAINT cannot target a PARTIAL unique index — it must NOT appear.
    expect(b).not.toMatch(/ON CONFLICT ON CONSTRAINT/);
  });

  it('FN-18 — the ON CONFLICT predicate matches index #5 EXACTLY (the active-cell predicate)', () => {
    const b = body();
    expect(b).toMatch(
      /WHERE state IN \('pending', 'leased', 'retry_scheduled'\) AND family IS NOT NULL/,
    );
    expect(b).toMatch(/DO NOTHING/);
  });

  it('FN-19 — the enqueue ON CONFLICT predicate is byte-identical to index #5\'s predicate', () => {
    // Extract index #5 predicate.
    const idxStart = migrationText.indexOf('amor_one_active_job_per_cell_idx');
    const idxBody = migrationText.slice(idxStart, migrationText.indexOf(';', idxStart));
    const idxPredMatch = idxBody.match(/WHERE (.+?) AND family IS NOT NULL/s);
    // Extract enqueue ON CONFLICT predicate.
    const enq = body();
    const enqPredMatch = enq.match(/WHERE (state IN \([^)]*\)) AND family IS NOT NULL/);
    expect(idxPredMatch).not.toBeNull();
    expect(enqPredMatch).not.toBeNull();
    // Both predicates state the SAME active-state set.
    const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim();
    expect(normalize(enqPredMatch![1])).toBe("state IN ('pending', 'leased', 'retry_scheduled')");
    expect(normalize(idxPredMatch![1])).toBe(
      "state IN ('pending', 'leased', 'retry_scheduled')",
    );
  });

  it('FN-20 — RETURNING id (NULL when the ON CONFLICT DO NOTHING fires for an active cell)', () => {
    expect(body()).toMatch(/RETURNING id;/);
  });
});

describe('ARCH-001 Card 1 — function comments document Card-1 vs Card-2 scope', () => {
  it('FN-21 — enqueue comment states it is DEFINED+TESTED in Card 1, WIRED in Card 2', () => {
    expect(migrationText).toMatch(/DEFINED \+ TESTED in Card 1; WIRED into the submit/);
  });
});
