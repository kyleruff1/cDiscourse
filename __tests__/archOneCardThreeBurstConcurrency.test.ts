/**
 * ARCH-001 Card 3 — burst regression + cron-tick migration shape.
 *
 * The chip's ask (design §4): a DETERMINISTIC, pure-TS, NO-PROVIDER-CALL test
 * proving the queue path bounds GLOBAL provider concurrency to C under a
 * synthetic burst — the exact property direct dispatch lacks (RCA §3: the
 * per-isolate cap=5 cannot sum-bound; ~76 concurrent provider calls observed
 * across ~38 concurrent submits, aborting ~96% of classifications).
 *
 * The bound is proven STRUCTURALLY via the same pure `runWithBoundedConcurrency`
 * the drainer feeds C into (classifierDrainerCore.ts) — never by gambling on
 * live-inducing a 429 (parent §A.9). No Deno, no fetch, no Supabase, no
 * provider call.
 *
 * This single suite (the one test file in the Card-3 inventory, design §8)
 * carries:
 *   - the bounded-concurrency proof (§4 primary assertion),
 *   - the contrast that unbounded fan-out saturates at N=72,
 *   - source-scan supports that the drainer wires C into the runner + the
 *     single-flight skip (§4 supporting assertions),
 *   - the no-provider-call self-scan (§4 step 8),
 *   - the drain-audit observability shape the smoke's PASS check reads (§4),
 *   - the cron-tick migration SHAPE source-scan (§9 migration test), mirroring
 *     the archOneCardTwoEnqueueKickMigration source-scan convention,
 *   - the doctrine ban-list + secret-shape scan over the migration + runbook +
 *     smoke harness (§9).
 *
 * D-convention: every concurrency assertion uses C derived FROM the drainer
 * source (DRAINER_PROVIDER_CONCURRENCY), never a bare literal `3` — a single
 * value-pin (expect(C).toBe(3)) anchors it. The 72-job burst size is pinned
 * to the post-Family-I production roster (8 args × 9 production families) so
 * the structural proof models the REAL current production burst.
 *
 * NOTE — two distinct N's live in this file, deliberately:
 *   - the bounded-concurrency PROOF below uses N=72 (8 args × 9 production
 *     families) because Family I (thread_topology) is now production-enabled
 *     (MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2), on top of Family H
 *     (claim_clarity). The proof must model the real burst.
 *   - BAN-4's PASS-LOAD bar assertion keeps the ARCH-001 cutover live-drill
 *     bar at its operator-gated N=56 (8 args × 7 families) on the external
 *     scripts/arch-001-card3-smoke/README.md — that bar is an ARCH-001
 *     operator gate, untouched here; revisiting it for the widened roster
 *     is an ARCH-001 follow-up, out of scope for this Edge-layer flip.
 */

import * as fs from 'fs';
import * as path from 'path';
import { edgeRunWithBoundedConcurrency as runWithBoundedConcurrency } from './_helpers/booleanObservationEdgeDeno';

const REPO = process.cwd();
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts',
);
const MIGRATION_PATH = path.join(
  REPO,
  'supabase/migrations/20260608000001_arch_001_card3_cron_drain_tick.sql',
);
const RUNBOOK_PATH = path.join(
  REPO,
  'docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md',
);
const SMOKE_DIR = path.join(REPO, 'scripts/arch-001-card3-smoke');
const SELF_PATH = path.join(REPO, '__tests__/archOneCardThreeBurstConcurrency.test.ts');

/* ------------------------------------------------------------------ */
/* Source loads                                                       */
/* ------------------------------------------------------------------ */

let coreText = '';
let migrationText = '';
let migrationCode = ''; // comment-stripped executable SQL

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

/** Strip TS line + block comments so a self-scan inspects CODE, not prose. */
function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

beforeAll(() => {
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  migrationText = fs.readFileSync(MIGRATION_PATH, 'utf8');
  migrationCode = stripSqlComments(migrationText);
});

/**
 * C derived FROM the drainer source — the SAME constant the drainer feeds
 * into runWithBoundedConcurrency. Parsed so the behavioural burst run uses
 * the real shipped value, not a hand-copied literal. The value-pin below
 * asserts it equals 3 (and <= the MCP cap 5).
 */
function drainerProviderConcurrency(): number {
  const m = coreText.match(/DRAINER_PROVIDER_CONCURRENCY\s*=\s*(\d+)\b/);
  if (!m) throw new Error('DRAINER_PROVIDER_CONCURRENCY not found in drainer core source');
  return Number(m[1]);
}

/* ------------------------------------------------------------------ */
/* Deterministic deferred + tracking-task helpers                     */
/* (mirrors mcpAutoTriggerBoundedConcurrency.test.ts:56-151)          */
/* ------------------------------------------------------------------ */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A tracking task fn driven by per-index controllable deferreds. On each call
 * it increments inFlight (updating maxObserved) and returns a promise that
 * settles only when the test releases that index. A slow (unreleased) task
 * stays in flight, so with a bound of K and > K items EXACTLY K tasks can be
 * simultaneously in flight — making observed overlap deterministic.
 */
function makeTrackingTask() {
  const deferreds = new Map<number, Deferred<string>>();
  let inFlight = 0;
  let maxObserved = 0;
  let everExceeded = false;
  // The bound the live run must never exceed; set by the caller before use.
  let assertBound = Number.POSITIVE_INFINITY;

  function deferredFor(index: number): Deferred<string> {
    let d = deferreds.get(index);
    if (!d) {
      d = makeDeferred<string>();
      deferreds.set(index, d);
    }
    return d;
  }

  const task = async (_item: unknown, index: number): Promise<string> => {
    inFlight += 1;
    if (inFlight > maxObserved) maxObserved = inFlight;
    if (inFlight > assertBound) everExceeded = true;
    const d = deferredFor(index);
    try {
      return await d.promise;
    } finally {
      inFlight -= 1;
    }
  };

  function release(i: number): void {
    deferredFor(i).resolve(`value-${i}`);
  }

  function releaseAll(): void {
    for (const i of deferreds.keys()) release(i);
  }

  return {
    task,
    release,
    releaseAll,
    setAssertBound(n: number) {
      assertBound = n;
    },
    get inFlight() {
      return inFlight;
    },
    get maxObserved() {
      return maxObserved;
    },
    get everExceeded() {
      return everExceeded;
    },
  };
}

/** Flush pending microtasks so the runner can advance its workers. */
async function flushMicrotasks(times = 6): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

/* ------------------------------------------------------------------ */
/* The production synthetic burst N=72 (8 args x 9 production families) */
/* ------------------------------------------------------------------ */

const BURST_ARGS = 8;
const PRODUCTION_FAMILIES = [
  'parent_relation',
  'disagreement_axis',
  'misunderstanding_repair',
  'evidence_source_chain',
  'argument_scheme',
  'critical_question',
  'resolution_progress',
  'claim_clarity',
  'thread_topology',
] as const;

interface SyntheticJob {
  argument_id: string;
  family: (typeof PRODUCTION_FAMILIES)[number];
}

/** Build 72 plain-object jobs — NO DB, NO provider, NO network. */
function buildBurstJobs(): SyntheticJob[] {
  const jobs: SyntheticJob[] = [];
  for (let a = 0; a < BURST_ARGS; a += 1) {
    for (const family of PRODUCTION_FAMILIES) {
      jobs.push({ argument_id: `arg-${a}`, family });
    }
  }
  return jobs;
}

/* ============================================================ */
/* C value-pin (single allowed literal)                         */
/* ============================================================ */

describe('ARCH-001 Card 3 — provider-concurrency bound C (value pin)', () => {
  it('BC-1 — DRAINER_PROVIDER_CONCURRENCY = 3 (the single value-pin literal)', () => {
    expect(drainerProviderConcurrency()).toBe(3);
  });

  it('BC-2 — C <= the per-isolate MCP provider cap (5) — the invariant the queue preserves', () => {
    const C = drainerProviderConcurrency();
    const MCP_CAP = 5;
    expect(C).toBeLessThanOrEqual(MCP_CAP);
  });

  it('BC-3 — the production burst is N=72 (8 args x 9 production families post Family I flip)', () => {
    const jobs = buildBurstJobs();
    expect(jobs).toHaveLength(72);
    expect(BURST_ARGS * PRODUCTION_FAMILIES.length).toBe(72);
    expect(PRODUCTION_FAMILIES).toHaveLength(9);
  });
});

/* ============================================================ */
/* §4 primary — bounded-concurrency proof (behavioural, pure)   */
/* ============================================================ */

describe('ARCH-001 Card 3 — the queue path bounds GLOBAL provider concurrency to C (§4)', () => {
  it('BC-4 — 72-job burst through runWithBoundedConcurrency NEVER exceeds C in flight', async () => {
    const C = drainerProviderConcurrency();
    const jobs = buildBurstJobs();
    const tracker = makeTrackingTask();
    tracker.setAssertBound(C);

    const runPromise = runWithBoundedConcurrency(jobs, C, tracker.task);

    // Let the pool spin up to its bound with every task still in flight.
    await flushMicrotasks();
    expect(tracker.inFlight).toBeLessThanOrEqual(C);
    expect(tracker.maxObserved).toBeLessThanOrEqual(C);

    // Drain in waves; at every step the bound must hold.
    for (let i = 0; i < jobs.length + 5; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
      expect(tracker.inFlight).toBeLessThanOrEqual(C);
    }
    const results = await runPromise;

    expect(results).toHaveLength(72);
    expect(tracker.everExceeded).toBe(false);
    expect(tracker.maxObserved).toBeLessThanOrEqual(C);
  });

  it('BC-5 — the pool REACHES exactly C with >> C jobs (not under-bounding)', async () => {
    const C = drainerProviderConcurrency();
    const jobs = buildBurstJobs();
    const tracker = makeTrackingTask();
    tracker.setAssertBound(C);

    const runPromise = runWithBoundedConcurrency(jobs, C, tracker.task);
    // With 72 slow (unreleased) tasks the pool fills to its full bound and holds.
    await flushMicrotasks();
    expect(tracker.maxObserved).toBe(C);

    for (let i = 0; i < jobs.length + 5; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
    }
    await runPromise;
    expect(tracker.maxObserved).toBe(C);
  });

  it('BC-6 — every one of the 72 jobs settles fulfilled (no job lost; allSettled-style)', async () => {
    const C = drainerProviderConcurrency();
    const jobs = buildBurstJobs();
    const tracker = makeTrackingTask();

    const runPromise = runWithBoundedConcurrency(jobs, C, tracker.task);
    for (let i = 0; i < jobs.length + 5; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
    }
    const results = await runPromise;
    expect(results).toHaveLength(72);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    // Results preserve INPUT order (results[i] ↔ jobs[i]).
    expect(results.map((r) => r.index)).toEqual(jobs.map((_, i) => i));
  });
});

/* ============================================================ */
/* §4 contrast — unbounded fan-out saturates at N=72            */
/* (the RCA failure the queue prevents)                         */
/* ============================================================ */

describe('ARCH-001 Card 3 — contrast: unbounded direct fan-out saturates at 72 (§4)', () => {
  it('BC-7 — Promise.all over the same 72 jobs reaches maxObserved === 72 (queue-less saturation)', async () => {
    const jobs = buildBurstJobs();
    const tracker = makeTrackingTask();

    // Direct dispatch = unbounded fan-out: every task is invoked synchronously,
    // so all 72 increment inFlight before any awaits resolve. This is the
    // ~76-wide saturation the RCA observed (here exactly 72 = the burst size).
    const all = Promise.all(jobs.map((job, i) => tracker.task(job, i)));
    expect(tracker.inFlight).toBe(72);
    expect(tracker.maxObserved).toBe(72);

    tracker.releaseAll();
    await all;
    expect(tracker.inFlight).toBe(0);
  });

  it('BC-8 — the bounded peak (C) is strictly less than the unbounded peak (72)', async () => {
    const C = drainerProviderConcurrency();
    // The whole point of ARCH-001: C << N. A regression that let the drainer
    // fan out unbounded would make these equal.
    expect(C).toBeLessThan(72);
  });
});

/* ============================================================ */
/* §4 supporting — the drainer wires C into the runner          */
/* (source scan: classifierDrainerCore.ts is not require-loadable) */
/* ============================================================ */

describe('ARCH-001 Card 3 — drainer feeds C into the bounded runner (source scan)', () => {
  it('BC-9 — runClassifierDrain calls runWithBoundedConcurrency with DRAINER_PROVIDER_CONCURRENCY', () => {
    expect(coreText).toMatch(
      /runWithBoundedConcurrency\(\s*claimed,\s*DRAINER_PROVIDER_CONCURRENCY/,
    );
  });

  it('BC-10 — the runner is imported from the pure boundedConcurrencyRunner module', () => {
    expect(coreText).toMatch(
      /import\s*\{\s*runWithBoundedConcurrency\s*\}\s*from\s*'\.\/boundedConcurrencyRunner\.ts'/,
    );
  });

  it('BC-11 — single-flight: acquire_drain_lease is consulted BEFORE any claim/provider work', () => {
    const acquireIdx = coreText.indexOf("rpc('acquire_drain_lease'");
    const claimIdx = coreText.indexOf("rpc('claim_classifier_jobs'");
    expect(acquireIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(acquireIdx);
  });

  it('BC-12 — a non-self lease → skipped_single_flight + early return (a 2nd drain cannot multiply C)', () => {
    expect(coreText).toMatch(/acquiredOwner\s*!==\s*owner/);
    const skipIdx = coreText.indexOf("outcome = 'skipped_single_flight'");
    const claimIdx = coreText.indexOf("rpc('claim_classifier_jobs'");
    expect(skipIdx).toBeGreaterThan(-1);
    // The skip path is recorded BEFORE the claim loop — it returns without claiming.
    expect(claimIdx).toBeGreaterThan(skipIdx);
  });
});

/* ============================================================ */
/* §4 observability — drain-audit carries the smoke's PASS signals */
/* ============================================================ */

describe('ARCH-001 Card 3 — drain-audit shape carries the smoke PASS counters (§4)', () => {
  it('BC-13 — the audit insert carries outcome + the four job counters the smoke reads', () => {
    const auditInsert = coreText.match(
      /from\(\s*['"]classifier_drain_audit['"]\s*\)\s*\.insert\(\{[\s\S]*?\}\)/,
    );
    expect(auditInsert).not.toBeNull();
    const block = auditInsert![0];
    for (const col of ['outcome', 'jobs_processed', 'jobs_succeeded', 'jobs_failed']) {
      expect(block).toContain(col);
    }
  });

  it('BC-14 — dead_letters is a first-class audit counter (the readable PASS signal: count = 0)', () => {
    // PASS-LOAD = 0 terminal dead-letters. The audit row surfaces dead_letters
    // so the smoke + monitoring can read the bar directly.
    const auditInsert = coreText.match(
      /from\(\s*['"]classifier_drain_audit['"]\s*\)\s*\.insert\(\{[\s\S]*?\}\)/,
    )![0];
    expect(auditInsert).toContain('dead_letters');
  });

  it('BC-15 — the audit row carries NO body/prompt/payload field (leak-safe counters only)', () => {
    const auditInsert = coreText.match(
      /from\(\s*['"]classifier_drain_audit['"]\s*\)\s*\.insert\(\{[\s\S]*?\}\)/,
    )![0];
    expect(auditInsert).not.toMatch(/body|prompt|payload|currentText|parentText|evidence/i);
  });
});

/* ============================================================ */
/* §4 step 8 — no-provider-call self-scan                       */
/* ============================================================ */

describe('ARCH-001 Card 3 — the regression test makes NO provider call (self-scan)', () => {
  it('BC-16 — this test file imports no adapter/Deno/network module and calls no fetch/provider', () => {
    const selfCode = stripTsComments(fs.readFileSync(SELF_PATH, 'utf8'));
    // Needles are assembled from fragments so these assertions' OWN string
    // literals do not appear contiguously in the scanned source (a self-scan
    // must not trip on itself).
    const denoNeedle = 'Den' + 'o.';
    const serviceClientNeedle = 'createServ' + 'iceClient';
    const adapterNeedle = 'booleanObservationMcp' + 'Adapter';
    expect(selfCode).not.toMatch(/\bfetch\s*\(/);
    expect(selfCode).not.toMatch(/callAnthropic\s*\(/);
    expect(selfCode).not.toContain(denoNeedle);
    expect(selfCode).not.toContain(serviceClientNeedle);
    expect(selfCode).not.toContain(adapterNeedle);
    // The ONLY edge import is the PURE runner via the test bridge.
    expect(selfCode).toMatch(/edgeRunWithBoundedConcurrency/);
  });
});

/* ============================================================ */
/* §9 — cron-tick migration SHAPE (text scan)                   */
/* (mirrors archOneCardTwoEnqueueKickMigration.test.ts)         */
/* ============================================================ */

describe('ARCH-001 Card 3 — cron drain-tick migration shape (§1/§9)', () => {
  it('CRON-1 — schedules EXACTLY ONE cron job named arch-001-classifier-drain-tick', () => {
    const scheduleCalls = migrationCode.match(/cron\.schedule\(/g) ?? [];
    expect(scheduleCalls).toHaveLength(1);
    expect(migrationCode).toMatch(/cron\.schedule\(\s*\n?\s*'arch-001-classifier-drain-tick'/);
  });

  it('CRON-2 — uses the 60s standard cron form (* * * * *), NOT a sub-minute interval', () => {
    expect(migrationCode).toMatch(/'\*\s\*\s\*\s\*\s\*'/);
    // No '[1-59] seconds' interval form (design I2 PARTIAL — not relied on).
    expect(migrationCode).not.toMatch(/'\d+\s+seconds'/);
  });

  it('CRON-3 — the tick body reads BOTH Vault secrets from vault.decrypted_secrets', () => {
    expect(migrationCode).toMatch(/FROM vault\.decrypted_secrets/);
    expect(migrationCode).toMatch(/name = 'arch_001_classifier_drainer_url'/);
    expect(migrationCode).toMatch(/name = 'arch_001_classifier_drainer_secret'/);
  });

  it('CRON-4 — has the NULL-URL guard so a pre-Vault-seed tick is a SILENT no-op (RETURN, not RAISE)', () => {
    expect(migrationCode).toMatch(/IF v_url IS NULL OR v_secret IS NULL/);
    expect(migrationCode).toMatch(
      /length\(v_url\) = 0\s*\n?\s*OR length\(v_secret\) = 0 THEN\s*\n?\s*RETURN;/,
    );
    // The guard must not RAISE the URL/secret.
    expect(migrationCode).not.toMatch(/RAISE[\s\S]*v_url/);
    expect(migrationCode).not.toMatch(/RAISE[\s\S]*v_secret/);
  });

  it('CRON-5 — net.http_posts the Vault URL with a constant marker body (no user content)', () => {
    expect(migrationCode).toMatch(/net\.http_post\(/);
    expect(migrationCode).toMatch(/url\s*:=\s*v_url/);
    expect(migrationCode).toMatch(/jsonb_build_object\('source',\s*'cron_tick'\)/);
  });

  it('CRON-6 — wraps the tick in a DO block (so the guard can RETURN; not a bare net.http_post)', () => {
    expect(migrationCode).toMatch(/DO \$tick\$/);
  });

  it('CRON-7 — adds ZERO extension / table / column / index / policy / RLS change', () => {
    expect(migrationCode).not.toMatch(/CREATE EXTENSION/);
    expect(migrationCode).not.toMatch(/CREATE TABLE/);
    expect(migrationCode).not.toMatch(/ADD COLUMN/);
    expect(migrationCode).not.toMatch(/ALTER COLUMN/);
    expect(migrationCode).not.toMatch(/CREATE INDEX/);
    expect(migrationCode).not.toMatch(/CREATE POLICY/);
    expect(migrationCode).not.toMatch(/ENABLE ROW LEVEL SECURITY/);
  });

  it('CRON-8 — does NOT redefine any Card-1/2/2A SQL function', () => {
    for (const fn of [
      'enqueue_classifier_job',
      'claim_classifier_jobs',
      'acquire_drain_lease',
      'reclaim_stale_leases',
      'release_drain_lease',
      'finalize_classifier_job',
      'arch_001_kick_classifier_drainer',
    ]) {
      expect(migrationCode).not.toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}`));
    }
  });

  it('CRON-9 — does NOT seed Vault in executable SQL (vault.create_secret is comment-only)', () => {
    // The seed is an OPERATOR runbook step; the migration shows call SHAPE in a
    // comment only. Executable code must NOT call vault.create_secret.
    expect(migrationCode).not.toMatch(/vault\.create_secret\(/);
    // The commented runbook DOES show the shape.
    expect(migrationText).toMatch(/vault\.create_secret\(/);
  });

  it('CRON-10 — documents rollback via cron.unschedule (commented)', () => {
    expect(migrationText).toMatch(/cron\.unschedule\('arch-001-classifier-drain-tick'\)/);
  });

  it('CRON-11 — sequenced after the latest applied migration (…06… → …08…) and WRITTEN, NOT APPLIED', () => {
    expect(MIGRATION_PATH).toMatch(/20260608000001_arch_001_card3_cron_drain_tick\.sql$/);
    expect(migrationText).toMatch(/WRITTEN, NOT APPLIED/);
  });

  it('CRON-12 — does NOT COMMENT ON a storage.* target (PR-003 SQLSTATE 42501 boundary)', () => {
    expect(migrationCode).not.toMatch(/COMMENT ON[\s\S]*storage\./);
  });
});

/* ============================================================ */
/* §9 — doctrine ban-list + secret-shape scan (migration +      */
/* runbook + smoke harness)                                     */
/* ============================================================ */

describe('ARCH-001 Card 3 — doctrine ban-list + no-secret scan over all new artifacts (§9)', () => {
  function listFilesRecursive(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...listFilesRecursive(full));
      else out.push(full);
    }
    return out;
  }

  function newArtifactTexts(): Array<[string, string]> {
    const files: string[] = [MIGRATION_PATH, RUNBOOK_PATH];
    if (fs.existsSync(SMOKE_DIR)) files.push(...listFilesRecursive(SMOKE_DIR));
    return files.map((f) => [f, fs.readFileSync(f, 'utf8')]);
  }

  const BANNED_VERDICT_TOKENS = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'truth value',
  ];

  it('BAN-1 — every new artifact carries ZERO verdict tokens', () => {
    for (const [file, text] of newArtifactTexts()) {
      const lower = text.toLowerCase();
      for (const token of BANNED_VERDICT_TOKENS) {
        expect(`${file}:${lower.includes(token)}`).toBe(`${file}:false`);
      }
    }
  });

  it('BAN-2 — every new artifact carries NO secret-shaped literal (sk-ant/sb_secret/JWT/SERVICE_ROLE/Bearer-token)', () => {
    for (const [file, text] of newArtifactTexts()) {
      expect(`${file}:sk-ant`).toBe(file + (text.match(/sk-ant-[A-Za-z0-9]/) ? ':HIT' : ':sk-ant'));
      expect(text).not.toMatch(/sb_secret_[A-Za-z0-9]/);
      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\./);
      expect(text).not.toMatch(/SERVICE_ROLE/);
      // 'Bearer ' || v_secret is a runtime concat, NOT a literal token. Assert
      // no contiguous 'Bearer <literal-token>' (>=16 chars).
      expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    }
  });

  it('BAN-3 — the smoke harness exists with at least the README plan + snapshot SQL', () => {
    expect(fs.existsSync(SMOKE_DIR)).toBe(true);
    const files = listFilesRecursive(SMOKE_DIR).map((f) => path.basename(f));
    expect(files).toContain('README.md');
    expect(files.some((f) => f.endsWith('.sql'))).toBe(true);
  });

  it('BAN-4 — the smoke harness keeps the PASS-LOAD bar at 0 terminal dead-letters at N=56 (not lowered)', () => {
    const readme = fs.readFileSync(path.join(SMOKE_DIR, 'README.md'), 'utf8');
    expect(readme).toMatch(/0 terminal dead-letters/i);
    expect(readme).toMatch(/N=56/);
  });
});
