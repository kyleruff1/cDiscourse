/**
 * ARCH-001 Card 2 — Drainer core + classify-for-finalize (SOURCE SCAN).
 *
 * classifierDrainerCore.ts transitively imports the classify helper →
 * loadArgumentContext → persistenceWriter → createServiceClient (Deno), so
 * it is NOT directly require()-loadable into Jest. The constants module is
 * exercised behaviorally by importing it (no Deno dep) where possible; the
 * orchestration GUARANTEES are locked by a source scan, matching the
 * repo's autoTriggerDispatcher source-scan convention.
 *
 * Covers intent-brief tests (d) single-flight, (e) claim+finalize+release +
 * reclaim-first, (f) honor false finalize return, (g) consistent terminal
 * pairs, (h) retryable → run-row UPDATE to retry_scheduled (NOT finalize),
 * (l) drainer ≥30s timeout, (n) bounded by C/T/batch + exits before ceiling,
 * (m) no secret/raw leak.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts',
);
const CLASSIFY_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerClassify.ts',
);

let coreText = '';
let classifyText = '';
let classifyCode = ''; // comment-stripped (for import/call scans)

/** Strip TS line + block comments so keyword scans hit executable code only. */
function stripTsComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
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
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  classifyText = fs.readFileSync(CLASSIFY_PATH, 'utf8');
  classifyCode = stripTsComments(classifyText);
});

describe('ARCH-001 Card 2 — drainer operating constants (design §A.5/§A.7)', () => {
  // The constants are exported from a module that transitively pulls Deno,
  // so we scan their literal values rather than importing.
  it('DC-1 — provider concurrency C = 3 (<= MCP cap 5)', () => {
    expect(coreText).toMatch(/DRAINER_PROVIDER_CONCURRENCY\s*=\s*3\b/);
  });

  it('DC-2 — wall-clock budget T = 90s (< 150s Edge ceiling)', () => {
    expect(coreText).toMatch(/DRAINER_WALL_CLOCK_BUDGET_MS\s*=\s*90_000\b/);
  });

  it('DC-3 — claim batch size cap is present (20)', () => {
    expect(coreText).toMatch(/DRAINER_CLAIM_BATCH_SIZE\s*=\s*20\b/);
  });

  it('DC-4 — per-invocation processed cap is present (defence-in-depth bound)', () => {
    expect(coreText).toMatch(/DRAINER_MAX_JOBS_PER_INVOCATION\s*=\s*\d+/);
  });

  it('DC-5 — job lease 120s; drain lease TTL 130s (>= T(90)+call(30)+margin(10))', () => {
    expect(coreText).toMatch(/DRAINER_JOB_LEASE_SECONDS\s*=\s*120\b/);
    expect(coreText).toMatch(/DRAINER_LEASE_TTL_SECONDS\s*=\s*130\b/);
  });
});

describe('ARCH-001 Card 2 — single-flight + reclaim-first + release (tests d, e)', () => {
  it('DC-6 — acquires the drain lease via acquire_drain_lease FIRST', () => {
    expect(coreText).toMatch(/rpc\(\s*['"]acquire_drain_lease['"]/);
  });

  it('DC-7 — when the lease is not acquired (not self), records skipped_single_flight and EXITS', () => {
    expect(coreText).toMatch(/acquiredOwner\s*!==\s*owner/);
    expect(coreText).toMatch(/skipped_single_flight/);
    // The skip path returns BEFORE any claim/provider call.
    const skipIdx = coreText.indexOf("outcome = 'skipped_single_flight'");
    const claimIdx = coreText.indexOf("rpc('claim_classifier_jobs'");
    expect(skipIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(skipIdx);
  });

  it('DC-8 — reclaim_stale_leases runs BEFORE the claim loop (reclaim-first)', () => {
    const reclaimIdx = coreText.indexOf("rpc('reclaim_stale_leases')");
    const claimIdx = coreText.indexOf("rpc('claim_classifier_jobs'");
    expect(reclaimIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(reclaimIdx);
  });

  it('DC-9 — claims via claim_classifier_jobs with batch_size, owner, lease', () => {
    expect(coreText).toMatch(/rpc\(\s*['"]claim_classifier_jobs['"]\s*,\s*\{/);
    expect(coreText).toMatch(/batch_size:\s*DRAINER_CLAIM_BATCH_SIZE/);
    expect(coreText).toMatch(/lease:\s*`\$\{DRAINER_JOB_LEASE_SECONDS\} seconds`/);
  });

  it('DC-10 — finalizes via finalize_classifier_job', () => {
    expect(coreText).toMatch(/rpc\(\s*['"]finalize_classifier_job['"]/);
  });

  it('DC-11 — releases the lease via release_drain_lease in a finally', () => {
    expect(coreText).toMatch(/rpc\(\s*['"]release_drain_lease['"]/);
    expect(coreText).toMatch(/finally\s*\{[\s\S]*release_drain_lease[\s\S]*?\}/);
  });

  it('DC-12 — writes a per-drain audit row to classifier_drain_audit', () => {
    expect(coreText).toMatch(/from\(\s*['"]classifier_drain_audit['"]\s*\)/);
    expect(coreText).toMatch(/\.insert\(/);
  });
});

describe('ARCH-001 Card 2 — honor false finalize return (carry-forward #1, test f)', () => {
  it('DC-13 — finalizeJob returns the boolean (data === true), false on RPC error', () => {
    expect(coreText).toMatch(/return\s+data\s*===\s*true/);
    // A FALSE return is mapped to a distinct lost-lease disposition, NOT success.
    expect(coreText).toMatch(/'lost_lease'/);
  });

  it('DC-14 — a false finalize on the success path → lost_lease, NOT succeeded', () => {
    expect(coreText).toMatch(/finalized\s*\?\s*'succeeded'\s*:\s*'lost_lease'/);
  });

  it('DC-15 — lost_lease is counted in jobsLostLease, NOT jobsSucceeded/jobsRetried', () => {
    expect(coreText).toMatch(/jobsLostLease\s*\+=\s*1/);
    // The lost_lease switch arm does NOT increment succeeded or retried.
    const arm = coreText.match(/case 'lost_lease':[\s\S]*?break;/);
    expect(arm).not.toBeNull();
    expect(arm![0]).not.toMatch(/jobsSucceeded/);
    expect(arm![0]).not.toMatch(/jobsRetried/);
  });

  it('DC-16 — the scheduleRetry UPDATE is guarded on lease_owner + state=leased (lost-lease parity)', () => {
    // A retry-schedule by a drainer that lost the lease must be a no-op.
    expect(coreText).toMatch(/\.eq\(\s*['"]lease_owner['"]\s*,\s*input\.owner\s*\)/);
    expect(coreText).toMatch(/\.eq\(\s*['"]state['"]\s*,\s*['"]leased['"]\s*\)/);
  });
});

describe('ARCH-001 Card 2 — consistent terminal pairs (carry-forward #6, test g)', () => {
  it('DC-17 — success finalize passes (succeeded, success)', () => {
    expect(coreText).toMatch(/terminalState:\s*'succeeded'[\s\S]*?status:\s*'success'/);
  });

  it('DC-18 — terminal-failure finalize passes status=failed for failed_terminal|dead_letter', () => {
    // The terminal-failure finalize sets status:'failed' with the
    // disposition (failed_terminal | dead_letter) as terminalState.
    expect(coreText).toMatch(/terminalState:\s*decision\.disposition/);
    expect(coreText).toMatch(/status:\s*'failed'/);
  });

  it('DC-19 — the only terminalState literals are the 3 valid finalizer states', () => {
    const literals = (coreText.match(/terminalState:\s*'([a-z_]+)'/g) ?? []).map((m) =>
      m.replace(/terminalState:\s*'/, '').replace(/'$/, ''),
    );
    for (const lit of literals) {
      expect(['succeeded', 'failed_terminal', 'dead_letter']).toContain(lit);
    }
  });
});

describe('ARCH-001 Card 2 — retryable → run-row UPDATE to retry_scheduled (test h)', () => {
  it('DC-20 — retry disposition does a run-row UPDATE to state=retry_scheduled, NOT finalize', () => {
    expect(coreText).toMatch(/state:\s*'retry_scheduled'/);
    // scheduleRetry uses .update(...), not the finalize RPC.
    const retryFn = coreText.match(/async function scheduleRetry\([\s\S]*?\n\}/);
    expect(retryFn).not.toBeNull();
    expect(retryFn![0]).toMatch(/\.update\(/);
    expect(retryFn![0]).not.toMatch(/finalize_classifier_job/);
  });

  it('DC-21 — retry sets available_at in the future (now + backoff) and clears the lease', () => {
    const retryFn = coreText.match(/async function scheduleRetry\([\s\S]*?\n\}/)![0];
    expect(retryFn).toMatch(/available_at:\s*availableAt/);
    expect(retryFn).toMatch(/Date\.now\(\)\s*\+\s*input\.backoffSeconds\s*\*\s*1000/);
    expect(retryFn).toMatch(/lease_owner:\s*null/);
    expect(retryFn).toMatch(/lease_expires_at:\s*null/);
  });

  it('DC-22 — retry does NOT block in-request (no sleep/setTimeout/await delay in the loop)', () => {
    // The drainer schedules a retry via available_at; it never waits in-request.
    expect(coreText).not.toMatch(/setTimeout/);
    expect(coreText).not.toMatch(/\bsleep\(/);
  });
});

describe('ARCH-001 Card 2 — bounded batch (test n)', () => {
  it('DC-23 — the loop is bounded by the processed cap AND the wall-clock budget', () => {
    expect(coreText).toMatch(/jobsProcessed\s*<\s*DRAINER_MAX_JOBS_PER_INVOCATION/);
    expect(coreText).toMatch(/clock\.nowMs\(\)\s*-\s*startedAtMs\s*<\s*DRAINER_WALL_CLOCK_BUDGET_MS/);
  });

  it('DC-24 — batch processing uses the bounded-concurrency runner with C', () => {
    expect(coreText).toMatch(/runWithBoundedConcurrency\(/);
    expect(coreText).toMatch(/DRAINER_PROVIDER_CONCURRENCY/);
  });

  it('DC-25 — a budget-tripped / cap-hit drain is reported partial (not completed)', () => {
    expect(coreText).toMatch(/outcome\s*=\s*'partial'/);
  });
});

describe('ARCH-001 Card 2 — classify-for-finalize maps to p_observations (test l)', () => {
  it('DC-26 — classify passes the >=30s drainer timeout (NOT the 15s default)', () => {
    expect(classifyText).toMatch(/DRAINER_MCP_REQUEST_TIMEOUT_MS/);
    expect(classifyText).toMatch(/timeoutMs:\s*DRAINER_MCP_REQUEST_TIMEOUT_MS/);
    // The adapter is invoked WITH the options arg carrying the timeout.
    expect(classifyText).toMatch(/adapter\(mcpRequest,\s*\{/);
  });

  it('DC-27 — positive observations are mapped to the finalizer jsonb shape', () => {
    // [{ raw_key, family, confidence, evidence_span }] — snake_case to match
    // the SQL jsonb_to_recordset column names.
    expect(classifyText).toMatch(/raw_key:\s*rawKey/);
    expect(classifyText).toMatch(/family:\s*def\.family/);
    expect(classifyText).toMatch(/confidence,/);
    expect(classifyText).toMatch(/evidence_span:\s*evidenceSpan/);
  });

  it('DC-28 — classify does NOT persist (no persistRun / persistResults in executable code)', () => {
    // The job IS the run row; finalize_classifier_job does the atomic write.
    // Scan the COMMENT-STRIPPED source — the doc comments legitimately
    // explain that this helper does NOT use persistRun/persistResults.
    expect(classifyCode).not.toMatch(/persistRun/);
    expect(classifyCode).not.toMatch(/persistResults/);
  });

  it('DC-29 — classify reuses the existing context loader + request builder', () => {
    expect(classifyText).toMatch(/loadArgumentContext/);
    expect(classifyText).toMatch(/buildBooleanObservationRequestForArgument/);
  });

  it('DC-30 — a missing/soft-deleted argument is a terminal (argument_missing), not a retry', () => {
    expect(classifyText).toMatch(/argument_missing/);
  });
});

describe('ARCH-001 Card 2 — drainer never leaks a secret/raw payload (test m)', () => {
  it('DC-31 — core never console.logs', () => {
    expect(coreText).not.toMatch(/console\./);
  });

  it('DC-32 — classify never console.logs', () => {
    expect(classifyText).not.toMatch(/console\./);
  });

  it('DC-33 — core carries no secret-shaped literal (Bearer/sk-ant/sb_secret/JWT/SERVICE_ROLE)', () => {
    expect(coreText).not.toMatch(/sk-ant-/);
    expect(coreText).not.toMatch(/sb_secret_/);
    expect(coreText).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\./);
    expect(coreText).not.toMatch(/SERVICE_ROLE/);
    // No Authorization header is assembled in the core (the kick/cron/drainer-index
    // own the auth; the core only calls SQL RPCs via the service client).
    expect(coreText).not.toMatch(/Authorization/);
  });

  it('DC-34 — the audit row carries only operational counters (no body/prompt/payload field)', () => {
    const auditInsert = coreText.match(/from\(\s*['"]classifier_drain_audit['"]\s*\)\s*\.insert\(\{[\s\S]*?\}\)/);
    expect(auditInsert).not.toBeNull();
    const block = auditInsert![0];
    expect(block).not.toMatch(/body|prompt|payload|currentText|parentText|evidence/i);
  });
});
