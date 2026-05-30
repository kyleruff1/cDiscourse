/**
 * ARCH-001 Card 1 — operator post-merge verification SQL: existence, the
 * 6-case coverage, safety, and the always-rollback posture.
 *
 * The behavioral pass/fail of these 6 cases genuinely needs a live
 * Postgres (Docker was unavailable in the implementer environment), so it
 * runs under the operator's post-merge verification via
 * scripts/arch-001-card1-sql/verify-classifier-queue-substrate.sql. THIS
 * test locks that the script exists, covers all 6 intent-brief cases, is
 * secret-free (cdiscourse-doctrine §6), and never mutates the live DB
 * (BEGIN … ROLLBACK; fabricates no new debate/argument/profile rows).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const VERIFY_PATH = join(
  __dirname,
  '..',
  'scripts',
  'arch-001-card1-sql',
  'verify-classifier-queue-substrate.sql',
);

let sql = '';

beforeAll(() => {
  sql = readFileSync(VERIFY_PATH, 'utf8');
});

describe('ARCH-001 Card 1 — verification script exists + is documented as live-DB', () => {
  it('VER-1 — script exists with non-empty content', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('VER-2 — documents that it runs AFTER the operator applies the migration', () => {
    expect(sql).toMatch(/AFTER the operator applies/i);
    expect(sql).toContain('20260528000021_arch_001_classifier_queue_substrate.sql');
  });

  it('VER-3 — explains why these assertions cannot run in the Jest suite (need a live Postgres)', () => {
    expect(sql).toMatch(/live Postgres/i);
    // The phrase "Docker was unavailable" may wrap across a comment-line
    // boundary; assert both tokens are present rather than a contiguous match.
    expect(sql).toMatch(/Docker/);
    expect(sql).toMatch(/unavailable/i);
  });
});

describe('ARCH-001 Card 1 — verification covers all 6 intent-brief cases', () => {
  it('VER-4 — Case 1 (index #4 success uniqueness) asserted', () => {
    expect(sql).toMatch(/CASE 1a PASS/);
    expect(sql).toMatch(/CASE 1b PASS/);
  });

  it('VER-5 — Case 2 (index #5 active-job uniqueness + ON CONFLICT no-op) asserted', () => {
    expect(sql).toMatch(/CASE 2a PASS/);
    expect(sql).toMatch(/CASE 2b PASS/);
  });

  it('VER-6 — Case 3 (claim due / not future) asserted', () => {
    expect(sql).toMatch(/CASE 3 PASS/);
  });

  it('VER-7 — Case 4 (lease acquire/expire/release) asserted', () => {
    expect(sql).toMatch(/CASE 4a PASS/);
    expect(sql).toMatch(/CASE 4b PASS/);
    expect(sql).toMatch(/CASE 4c PASS/);
  });

  it('VER-8 — Case 5 (reclaim retry_scheduled + dead_letter cap) asserted', () => {
    expect(sql).toMatch(/CASE 5 PASS/);
  });

  it('VER-9 — Case 6 (pending row + NULL status compatibility) asserted', () => {
    expect(sql).toMatch(/CASE 6 PASS/);
  });

  it('VER-10 — documents the two-session concurrency procedure (SKIP-LOCKED + lease race)', () => {
    expect(sql).toMatch(/Section F/);
    expect(sql).toMatch(/SKIP-LOCKED/);
    expect(sql).toMatch(/two-acquirer/i);
  });
});

describe('ARCH-001 Card 1 — verification script safety', () => {
  it('VER-11 — wraps in BEGIN and ALWAYS ROLLBACK (never mutates the live DB)', () => {
    expect(sql).toMatch(/^\s*BEGIN;/m);
    expect(sql).toMatch(/^\s*ROLLBACK;/m);
    // The ROLLBACK must appear (no COMMIT of the fixture transaction).
    expect(sql).not.toMatch(/^\s*COMMIT;/m);
  });

  it('VER-12 — fabricates NO new debate/argument/profile rows (reuses an existing argument)', () => {
    expect(sql).not.toMatch(/INSERT INTO public\.debates/i);
    expect(sql).not.toMatch(/INSERT INTO public\.arguments\b/i);
    expect(sql).not.toMatch(/INSERT INTO public\.profiles/i);
    expect(sql).toMatch(/FROM public\.arguments/);
  });

  it('VER-13 — no secret / service-role literal (cdiscourse-doctrine §6)', () => {
    expect(sql).not.toMatch(/SERVICE_ROLE/i);
    expect(sql).not.toMatch(/sk-ant-/);
    expect(sql).not.toMatch(/sb_secret/);
    expect(sql).not.toMatch(/Bearer /);
    expect(sql).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('VER-14 — does NOT deploy / push / schedule anything (executable SQL only; the header comment may reference the operator apply step)', () => {
    // The header comment documents that the operator applies the migration
    // via `npx supabase db push --linked` BEFORE running this script — that
    // reference is fine. Assert the EXECUTABLE SQL performs no such action.
    const executable = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executable).not.toMatch(/cron\.schedule/i);
    expect(executable).not.toMatch(/db push/i);
    expect(executable).not.toMatch(/functions deploy/i);
  });
});
