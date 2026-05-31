/**
 * ARCH-001 Card 2 — submit-argument routing wiring + findExistingRun fix
 * (SOURCE SCAN).
 *
 * submit-argument/index.ts + autoTriggerDispatcher.ts are Deno-only (fetch /
 * Deno.env / the MCP adapter tree), so these guarantees are locked by a
 * source scan — the repo's established convention for the dispatcher
 * (see mcpOneTwoOneCAutoTriggerIdempotency.test.ts).
 *
 * Covers intent-brief tests (a) smoke-route enqueues + NOT direct-dispatch,
 * (b) non-smoke path UNCHANGED (dispatchAutoTriggerForArgument under
 * waitUntil), (i) findExistingRun active-queue-aware, (k) submit nonblocking.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const SUBMIT_PATH = path.join(REPO, 'supabase/functions/submit-argument/index.ts');
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);

let submitText = '';
let dispatcherText = '';

beforeAll(() => {
  submitText = fs.readFileSync(SUBMIT_PATH, 'utf8');
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
});

describe('ARCH-001 Card 2 — mutually-exclusive routing branch (tests a, b)', () => {
  it('SR-1 — submit imports shouldRouteToQueue + enqueueClassifierJobs', () => {
    expect(submitText).toMatch(/import\s*\{[\s\S]*shouldRouteToQueue[\s\S]*\}\s*from\s*['"][^'"]*classifierQueueRouting/);
    expect(submitText).toMatch(/enqueueClassifierJobs/);
  });

  it('SR-2 — the branch is `if (shouldRouteToQueue(...)) { ... } else { ... }`', () => {
    expect(submitText).toMatch(/if\s*\(\s*\n?\s*shouldRouteToQueue\(/);
    // The enqueue path and the direct-dispatch path are the two arms.
    const branchIdx = submitText.indexOf('shouldRouteToQueue(');
    const elseIdx = submitText.indexOf('} else {', branchIdx);
    expect(branchIdx).toBeGreaterThan(-1);
    expect(elseIdx).toBeGreaterThan(branchIdx);
  });

  it('SR-3 — the enqueue (true) arm calls enqueueClassifierJobs, NOT dispatchAutoTrigger', () => {
    const branchIdx = submitText.indexOf('shouldRouteToQueue(');
    const elseIdx = submitText.indexOf('} else {', branchIdx);
    const trueArm = submitText.slice(branchIdx, elseIdx);
    expect(trueArm).toMatch(/enqueueClassifierJobs\(/);
    expect(trueArm).not.toMatch(/dispatchAutoTriggerForArgument\(/);
  });

  it('SR-4 — the else (false) arm calls dispatchAutoTriggerForArgument (the UNCHANGED direct path)', () => {
    const elseIdx = submitText.indexOf('} else {', submitText.indexOf('shouldRouteToQueue('));
    const elseArm = submitText.slice(elseIdx);
    expect(elseArm).toMatch(/dispatchAutoTriggerForArgument\(\s*\n?\s*insertedArg\.id/);
    expect(elseArm).not.toMatch(/enqueueClassifierJobs\(/);
  });

  it('SR-5 — exactly ONE dispatchAutoTriggerForArgument call (no double-dispatch)', () => {
    const matches = submitText.match(/dispatchAutoTriggerForArgument\s*\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('SR-6 — exactly ONE enqueueClassifierJobs call site', () => {
    // The import line uses the bare identifier; the call uses `(`. Count calls.
    const matches = submitText.match(/enqueueClassifierJobs\s*\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('SR-7 — routing is DEFAULT DISABLED: gated on CLASSIFIER_QUEUE_ROUTING_ENABLED === "true"', () => {
    expect(submitText).toMatch(/Deno\.env\.get\(\s*CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV\s*\)\s*===\s*['"]true['"]/);
  });

  it('SR-8 — the predicate is passed the inserted argument id, the debate id + title, and the enable flag', () => {
    const branchIdx = submitText.indexOf('shouldRouteToQueue(');
    const callSlice = submitText.slice(branchIdx, branchIdx + 400);
    expect(callSlice).toMatch(/insertedArg\.id/);
    expect(callSlice).toMatch(/debate\.title/);
    expect(callSlice).toMatch(/queueRoutingEnabled/);
  });
});

describe('ARCH-001 Card 2 — submit stays nonblocking (test k)', () => {
  it('SR-9 — both arms are fire-and-forget under EdgeRuntime.waitUntil (the 201 is not awaited on classify)', () => {
    // Each arm wraps its promise in EdgeRuntime.waitUntil — the response is
    // returned regardless of the promise settling.
    const waitUntilCount = (submitText.match(/EdgeRuntime\.waitUntil\(/g) ?? []).length;
    expect(waitUntilCount).toBe(2); // one per arm.
  });

  it('SR-10 — the routing branch is positioned BEFORE the `return created(...)` (post-insert tail)', () => {
    const branchIdx = submitText.indexOf('shouldRouteToQueue(');
    // lastIndexOf finds the ACTUAL `return created({...})` statement, not the
    // doc-comment mention of it near the top of the file.
    const createdIdx = submitText.lastIndexOf('return created(');
    expect(branchIdx).toBeGreaterThan(-1);
    expect(createdIdx).toBeGreaterThan(branchIdx);
  });

  it('SR-11 — the enqueue promise is .catch()-guarded (a failed enqueue never rejects the tail)', () => {
    const branchIdx = submitText.indexOf('shouldRouteToQueue(');
    const elseIdx = submitText.indexOf('} else {', branchIdx);
    const trueArm = submitText.slice(branchIdx, elseIdx);
    expect(trueArm).toMatch(/\.catch\(\s*\(\)\s*=>\s*undefined\s*\)/);
  });
});

describe('ARCH-001 Card 2 — findExistingRun active-queue awareness (test i)', () => {
  it('SR-12 — the pre-check SELECT now reads the `state` column', () => {
    expect(dispatcherText).toMatch(/\.select\(\s*['"]id,\s*status,\s*run_mode,\s*state['"]\s*\)/);
  });

  it('SR-13 — ACTIVE_QUEUE_STATES set is pending/leased/retry_scheduled (mirrors index #5)', () => {
    const setBlock = dispatcherText.match(/ACTIVE_QUEUE_STATES[\s\S]*?\]\)/);
    expect(setBlock).not.toBeNull();
    expect(setBlock![0]).toMatch(/'pending'/);
    expect(setBlock![0]).toMatch(/'leased'/);
    expect(setBlock![0]).toMatch(/'retry_scheduled'/);
  });

  it('SR-14 — an active-queue cell is treated as already-in-flight (already_classified)', () => {
    // The already-handled branch returns 'already_classified' when the cell
    // is an active queue job OR a terminal success.
    expect(dispatcherText).toMatch(/isActiveQueueJob/);
    expect(dispatcherText).toMatch(/isActiveQueueJob\s*\|\|\s*existing\.status\s*===\s*['"]success['"]/);
  });

  it('SR-15 — the active-queue check uses the run row state, not status (status is NULL pre-terminal)', () => {
    expect(dispatcherText).toMatch(/ACTIVE_QUEUE_STATES\.has\(\s*existing\.state\s*\)/);
  });

  it('SR-16 — the success-status check is PRESERVED (idempotency for terminal-success rows)', () => {
    expect(dispatcherText).toMatch(/existing\.status\s*===\s*['"]success['"]/);
  });

  it('SR-17 — the rest of the direct path is untouched (still MAX_ATTEMPTS bounded retry loop)', () => {
    // The Card-2 change is minimal: it must NOT have removed the existing
    // bounded-retry machinery.
    expect(dispatcherText).toMatch(/MAX_ATTEMPTS/);
    expect(dispatcherText).toMatch(/classifyOneArgumentCore\(/);
  });
});
