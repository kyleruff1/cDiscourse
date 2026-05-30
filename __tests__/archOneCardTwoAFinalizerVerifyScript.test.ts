/**
 * ARCH-001 Card 2A — operator post-merge verification SQL: existence, the
 * 6-case coverage, safety, and the always-rollback posture.
 *
 * The behavioral pass/fail of the 5 LIVE cases (success / duplicate-safe /
 * wrong-owner / stale-owner / terminal-failure) genuinely needs a live
 * Postgres (Docker was unavailable in the implementer environment), so it
 * runs under the operator's post-merge verification via
 * scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql. Case 6
 * (direct-dispatch path unchanged) is SHAPE-only and proven in the migration
 * test. THIS test locks that the script exists, covers all 6 intent-brief
 * cases (5 live + 1 documented shape note), is secret-free
 * (cdiscourse-doctrine §6), and never mutates the live DB (BEGIN … ROLLBACK;
 * fabricates no new debate/argument/profile rows).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const VERIFY_PATH = join(
  __dirname,
  '..',
  'scripts',
  'arch-001-card2a-sql',
  'verify-finalize-classifier-job.sql',
);

let sql = '';

beforeAll(() => {
  sql = readFileSync(VERIFY_PATH, 'utf8');
});

describe('ARCH-001 Card 2A — verification script exists + is documented as live-DB', () => {
  it('VER2A-1 — script exists with non-empty content', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('VER2A-2 — lives in the SIBLING dir scripts/arch-001-card2a-sql (NOT scripts/ops)', () => {
    expect(VERIFY_PATH).toContain(join('scripts', 'arch-001-card2a-sql'));
    expect(VERIFY_PATH).not.toContain(join('scripts', 'ops'));
  });

  it('VER2A-3 — documents that it runs AFTER the operator applies the migration', () => {
    expect(sql).toMatch(/AFTER the operator applies/i);
    expect(sql).toContain('20260528000022_arch_001_card2a_atomic_finalizer.sql');
  });

  it('VER2A-4 — explains why the live assertions cannot run in Jest (need a live Postgres)', () => {
    expect(sql).toMatch(/live Postgres/i);
    expect(sql).toMatch(/Docker/);
    expect(sql).toMatch(/unavailable/i);
  });

  it('VER2A-5 — labels which cases are SHAPE vs LIVE', () => {
    expect(sql).toMatch(/SHAPE vs LIVE/i);
    expect(sql).toMatch(/Cases 1-5 below are LIVE/);
    expect(sql).toMatch(/Case 6 \(direct-dispatch path unchanged\) is a SHAPE assertion/);
  });
});

describe('ARCH-001 Card 2A — verification covers all 6 intent-brief cases', () => {
  it('VER2A-6 — Case 1 (success finalization) asserted', () => {
    expect(sql).toMatch(/CASE 1 PASS/);
  });

  it('VER2A-7 — Case 2 (duplicate-safe: repeat + pre-existing rawKey) asserted', () => {
    expect(sql).toMatch(/CASE 2a PASS/);
    expect(sql).toMatch(/CASE 2b PASS/);
  });

  it('VER2A-8 — Case 3 (wrong-owner no-op) asserted', () => {
    expect(sql).toMatch(/CASE 3 PASS/);
  });

  it('VER2A-9 — Case 4 (stale/reclaimed-owner no-op) asserted', () => {
    expect(sql).toMatch(/CASE 4 PASS/);
  });

  it('VER2A-10 — Case 5 (terminal-failure: failed_terminal + dead_letter) asserted', () => {
    expect(sql).toMatch(/CASE 5a PASS/);
    expect(sql).toMatch(/CASE 5b PASS/);
  });

  it('VER2A-11 — Case 6 (direct-dispatch path unchanged) documented as shape-only', () => {
    expect(sql).toMatch(/CASE 6 NOTE \(shape-only\)/);
    expect(sql).toMatch(/persistenceWriter\.ts/);
  });

  it('VER2A-12 — asserts the function return contract (true on finalize, false on no-op)', () => {
    // The script must assert BOTH a true (finalized) and a false (no-op) path.
    expect(sql).toMatch(/v_ok = true/);
    expect(sql).toMatch(/v_ok = false/);
  });

  it('VER2A-13 — Case 1 asserts the result rows + terminal state + lease clear + completed_at', () => {
    expect(sql).toMatch(/state should be succeeded/);
    expect(sql).toMatch(/status should be success/);
    expect(sql).toMatch(/completed_at should be set/);
    expect(sql).toMatch(/lease_owner should be cleared/);
    expect(sql).toMatch(/expected 2 result rows/);
  });

  it('VER2A-14 — Case 1 asserts NULL evidence_span persists as NULL (persistResults parity)', () => {
    expect(sql).toMatch(/NULL evidence_span should persist as NULL/);
  });

  it('VER2A-15 — Case 2b asserts ON CONFLICT DO NOTHING does not overwrite the pre-existing row', () => {
    expect(sql).toMatch(/must NOT overwrite the pre-existing row/);
  });

  it('VER2A-16 — Case 5a asserts dead_letter_reason stays NULL for failed_terminal', () => {
    expect(sql).toMatch(/dead_letter_reason must stay NULL for failed_terminal/);
  });

  it('VER2A-17 — Case 5 asserts terminal failure writes NO result rows', () => {
    expect(sql).toMatch(/terminal failure must insert no result rows/);
  });
});

describe('ARCH-001 Card 2A — verification script safety', () => {
  it('VER2A-18 — wraps in BEGIN and ALWAYS ROLLBACK (never mutates the live DB)', () => {
    expect(sql).toMatch(/^\s*BEGIN;/m);
    expect(sql).toMatch(/^\s*ROLLBACK;/m);
    expect(sql).not.toMatch(/^\s*COMMIT;/m);
  });

  it('VER2A-19 — fabricates NO new debate/argument/profile rows (reuses an existing argument)', () => {
    expect(sql).not.toMatch(/INSERT INTO public\.debates/i);
    expect(sql).not.toMatch(/INSERT INTO public\.arguments\b/i);
    expect(sql).not.toMatch(/INSERT INTO public\.profiles/i);
    expect(sql).toMatch(/FROM public\.arguments/);
  });

  it('VER2A-20 — only ever calls public.finalize_classifier_job (no other queue function invoked)', () => {
    // The verify script exercises the finalizer; it must not call the Card-1
    // claim/lease/reclaim/enqueue functions (out of this card's scope).
    expect(sql).toMatch(/public\.finalize_classifier_job/);
    expect(sql).not.toMatch(/public\.claim_classifier_jobs/);
    expect(sql).not.toMatch(/public\.acquire_drain_lease/);
    expect(sql).not.toMatch(/public\.reclaim_stale_leases/);
    expect(sql).not.toMatch(/public\.enqueue_classifier_job/);
  });

  it('VER2A-21 — no secret / service-role literal (cdiscourse-doctrine §6)', () => {
    expect(sql).not.toMatch(/SERVICE_ROLE/i);
    expect(sql).not.toMatch(/sk-ant-/);
    expect(sql).not.toMatch(/sb_secret/);
    expect(sql).not.toMatch(/Bearer /);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('VER2A-22 — does NOT deploy / push / schedule anything (executable SQL only)', () => {
    const executable = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executable).not.toMatch(/cron\.schedule/i);
    expect(executable).not.toMatch(/db push/i);
    expect(executable).not.toMatch(/functions deploy/i);
  });
});
