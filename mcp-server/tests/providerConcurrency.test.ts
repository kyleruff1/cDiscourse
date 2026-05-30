/**
 * OPS-MCP-SERVER-CAPACITY-INVESTIGATION — providerConcurrency semaphore +
 * cap-reader unit tests (pure; no network, no fetch).
 *
 * Covers (the operator's 10, semaphore portion):
 *   - T1  cap bounds concurrent tasks; max observed <= cap (asserted against the
 *         IMPORTED RESOLVED_MAX_PROVIDER_CONCURRENCY, plus a createBoundedSemaphore(3)
 *         variant against its injected cap — never a literal 5).
 *   - T3  queued tasks all run; the queue drains (waiting===0 / inFlight===0); strict FIFO.
 *   - cap-reader validation (unset / valid / '0' / '-2' / 'abc' / '' / '2.5' / non-int).
 *   - RESOLVED_MAX_PROVIDER_CONCURRENCY === default 5 in the unset-env process.
 *   - cap=1 serializes.
 *   - RangeError on cap 0 / NaN / Infinity / -1 (never silently unbounded).
 *   - idempotent release (double-release does not over-credit the pool).
 *   - purity / topology / ban-list source scan + positive gate-wiring scan.
 */
import { assertEquals, assertThrows } from 'std/assert/mod.ts';
import {
  createBoundedSemaphore,
  DEFAULT_MAX_PROVIDER_CONCURRENCY,
  readEnvMaxProviderConcurrency,
  RESOLVED_MAX_PROVIDER_CONCURRENCY,
} from '../lib/providerConcurrency.ts';
import type { BoundedSemaphore } from '../lib/providerConcurrency.ts';

const ENV_NAME = 'MCP_SERVER_MAX_PROVIDER_CONCURRENCY';

/** A manually-resolvable deferred used as a controllable barrier. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Run N tasks through `sem`. Each task records its acquisition order, holds the
 * permit until `barrier` resolves (so concurrency piles up to the cap), tracks
 * the max simultaneously-live count, then releases. Returns the recorded
 * acquisition order and the observed max-live once everything settles.
 */
async function runTrackedTasks(
  sem: BoundedSemaphore,
  n: number,
): Promise<{ acquireOrder: number[]; runOrder: number[]; maxLive: number }> {
  const barrier = deferred();
  let live = 0;
  let maxLive = 0;
  const acquireOrder: number[] = [];
  const runOrder: number[] = [];

  const tasks = Array.from({ length: n }, (_unused, i) =>
    (async () => {
      const release = await sem.acquire();
      acquireOrder.push(i);
      runOrder.push(i);
      live += 1;
      if (live > maxLive) maxLive = live;
      try {
        await barrier.promise;
      } finally {
        live -= 1;
        release();
      }
    })());

  // Let the first wave acquire + pile up to the cap, then release the barrier so
  // queued waiters get handed slots and drain.
  await Promise.resolve();
  await Promise.resolve();
  barrier.resolve();
  await Promise.all(tasks);

  return { acquireOrder, runOrder, maxLive };
}

Deno.test('T1: max observed concurrency never exceeds the imported resolved cap', async () => {
  const sem = createBoundedSemaphore(RESOLVED_MAX_PROVIDER_CONCURRENCY);
  const n = RESOLVED_MAX_PROVIDER_CONCURRENCY * 3;
  const { maxLive } = await runTrackedTasks(sem, n);
  // Assert against the IMPORTED constant, never a literal (Card-1B lesson).
  if (maxLive > RESOLVED_MAX_PROVIDER_CONCURRENCY) {
    throw new Error(
      `maxLive ${maxLive} exceeded RESOLVED_MAX_PROVIDER_CONCURRENCY ${RESOLVED_MAX_PROVIDER_CONCURRENCY}`,
    );
  }
});

Deno.test('T1: max observed concurrency tracks an INJECTED cap of 3 (decoupled from env)', async () => {
  const cap = 3;
  const sem = createBoundedSemaphore(cap);
  const { maxLive } = await runTrackedTasks(sem, cap * 4);
  // The bound follows the injected cap, proving the assertion is not tied to 5.
  if (maxLive > cap) {
    throw new Error(`maxLive ${maxLive} exceeded injected cap ${cap}`);
  }
  // The barrier holds the first wave, so the cap is actually reached (not under-filled).
  assertEquals(maxLive, cap);
});

Deno.test('T3: every queued task runs exactly once and the queue fully drains', async () => {
  const cap = 3;
  const n = 11;
  const sem = createBoundedSemaphore(cap);
  const { runOrder } = await runTrackedTasks(sem, n);
  assertEquals(runOrder.length, n);
  // Each task index 0..n-1 ran exactly once.
  const seen = new Set(runOrder);
  assertEquals(seen.size, n);
  for (let i = 0; i < n; i += 1) {
    if (!seen.has(i)) throw new Error(`task ${i} never ran`);
  }
  // Drain proof: no waiters, no in-flight permits after settle.
  assertEquals(sem.waiting, 0);
  assertEquals(sem.inFlight, 0);
});

Deno.test('T3: acquisition order is strict FIFO', async () => {
  const cap = 2;
  const n = 8;
  const sem = createBoundedSemaphore(cap);
  const { acquireOrder } = await runTrackedTasks(sem, n);
  // Tasks are launched in index order; FIFO handoff means they acquire in the
  // same order (first `cap` immediately, the rest as slots free, head-first).
  const expected = Array.from({ length: n }, (_unused, i) => i);
  assertEquals(acquireOrder, expected);
});

Deno.test('cap-reader: unset env returns the default 5', () => {
  const prev = Deno.env.get(ENV_NAME);
  Deno.env.delete(ENV_NAME);
  try {
    assertEquals(readEnvMaxProviderConcurrency(), DEFAULT_MAX_PROVIDER_CONCURRENCY);
    assertEquals(DEFAULT_MAX_PROVIDER_CONCURRENCY, 5);
  } finally {
    if (prev === undefined) Deno.env.delete(ENV_NAME);
    else Deno.env.set(ENV_NAME, prev);
  }
});

Deno.test('cap-reader: a valid integer >= 1 is parsed and used', () => {
  const prev = Deno.env.get(ENV_NAME);
  try {
    Deno.env.set(ENV_NAME, '3');
    assertEquals(readEnvMaxProviderConcurrency(), 3);
    Deno.env.set(ENV_NAME, '12');
    assertEquals(readEnvMaxProviderConcurrency(), 12);
    Deno.env.set(ENV_NAME, '1');
    assertEquals(readEnvMaxProviderConcurrency(), 1);
  } finally {
    if (prev === undefined) Deno.env.delete(ENV_NAME);
    else Deno.env.set(ENV_NAME, prev);
  }
});

Deno.test('cap-reader: invalid values fall back to the default 5', () => {
  const prev = Deno.env.get(ENV_NAME);
  try {
    for (const bad of ['0', '-2', 'abc', '', '2.5', '5x', 'NaN', 'Infinity']) {
      Deno.env.set(ENV_NAME, bad);
      assertEquals(
        readEnvMaxProviderConcurrency(),
        DEFAULT_MAX_PROVIDER_CONCURRENCY,
        `expected fallback for ${JSON.stringify(bad)}`,
      );
    }
  } finally {
    if (prev === undefined) Deno.env.delete(ENV_NAME);
    else Deno.env.set(ENV_NAME, prev);
  }
});

Deno.test('RESOLVED_MAX_PROVIDER_CONCURRENCY equals the default 5 in the unset-env process', () => {
  // The test process does not set the env, so the module-init resolved value is
  // the validated reader output for "unset" == the default.
  assertEquals(RESOLVED_MAX_PROVIDER_CONCURRENCY, DEFAULT_MAX_PROVIDER_CONCURRENCY);
  assertEquals(RESOLVED_MAX_PROVIDER_CONCURRENCY, 5);
});

Deno.test('cap=1 fully serializes provider permits (max observed === 1)', async () => {
  const sem = createBoundedSemaphore(1);
  const { maxLive, runOrder } = await runTrackedTasks(sem, 6);
  assertEquals(maxLive, 1);
  assertEquals(runOrder.length, 6);
  assertEquals(sem.inFlight, 0);
  assertEquals(sem.waiting, 0);
});

Deno.test('createBoundedSemaphore throws RangeError for non-int / out-of-range caps', () => {
  assertThrows(() => createBoundedSemaphore(0), RangeError);
  assertThrows(() => createBoundedSemaphore(-1), RangeError);
  assertThrows(() => createBoundedSemaphore(Number.NaN), RangeError);
  assertThrows(() => createBoundedSemaphore(Number.POSITIVE_INFINITY), RangeError);
  assertThrows(() => createBoundedSemaphore(2.5), RangeError);
});

Deno.test('idempotent release: a double-release does not over-credit the pool', async () => {
  const sem = createBoundedSemaphore(1);
  // Hold the only slot.
  const releaseA = await sem.acquire();
  assertEquals(sem.inFlight, 1);

  // Queue B and C while A holds.
  let bRan = false;
  let cRan = false;
  const b = sem.acquire().then((rel) => {
    bRan = true;
    return rel;
  });
  const c = sem.acquire().then((rel) => {
    cRan = true;
    return rel;
  });
  assertEquals(sem.waiting, 2);

  // Release A TWICE. The first hands the slot to B (FIFO). The second is a no-op
  // and must NOT also wake C — otherwise the pool would be over-credited.
  releaseA();
  releaseA();
  const releaseB = await b;
  await Promise.resolve();

  assertEquals(bRan, true);
  assertEquals(cRan, false, 'double-release wrongly admitted C');
  assertEquals(sem.inFlight, 1);
  assertEquals(sem.waiting, 1);

  // Releasing B (once) correctly hands the slot to C; everything drains.
  releaseB();
  const releaseC = await c;
  assertEquals(cRan, true);
  releaseC();
  assertEquals(sem.inFlight, 0);
  assertEquals(sem.waiting, 0);
});

Deno.test('purity + topology source scan: no fetch/console/Date.now; Deno.env only in the reader; per-isolate not global', async () => {
  const source = await Deno.readTextFile(
    new URL('../lib/providerConcurrency.ts', import.meta.url),
  );

  // Pure gate core: no network, no console, no wall-clock.
  if (/\bfetch\s*\(/.test(source)) {
    throw new Error('providerConcurrency.ts must not call fetch()');
  }
  if (/console\./.test(source)) {
    throw new Error('providerConcurrency.ts must not use console.*');
  }
  // Match the CALL form so the doctrine comment that merely names Date.now (to
  // say it is absent) is not a false positive — a real usage is Date.now().
  if (/Date\.now\s*\(/.test(source)) {
    throw new Error('providerConcurrency.ts must not use Date.now()');
  }

  // Deno.env is READ exactly once, and only inside readEnvMaxProviderConcurrency.
  // Match the call form `Deno.env.get(` so the doctrine comment that merely names
  // Deno.env (to say the gate core does not touch it) is not a false positive.
  const envMatches = source.match(/Deno\.env\.get\s*\(/g) ?? [];
  assertEquals(
    envMatches.length,
    1,
    'Deno.env.get must be called exactly once (in the reader only)',
  );
  const readerStart = source.indexOf('export function readEnvMaxProviderConcurrency');
  const readerEnd = source.indexOf('export const RESOLVED_MAX_PROVIDER_CONCURRENCY');
  const envIndex = source.search(/Deno\.env\.get\s*\(/);
  if (!(envIndex > readerStart && envIndex < readerEnd)) {
    throw new Error('Deno.env.get must live inside readEnvMaxProviderConcurrency only');
  }

  // Topology honesty (HALT-10): "per-isolate" present; the cap must NEVER be
  // CLAIMED to be global. The doctrine comment is allowed to DISCLAIM globalness
  // (e.g. "this is NOT a true global cap. Do not describe it as global.") — that
  // negation is the honest framing the design requires. We strip the explicit
  // disclaimer phrasings, then assert no AFFIRMATIVE "global" mention survives.
  if (!/per-isolate/i.test(source)) {
    throw new Error('providerConcurrency.ts must describe the cap as per-isolate');
  }
  const withoutDisclaimer = source
    .replace(/not\s+(?:a\s+)?(?:true\s+)?global\s+cap/gi, '')
    .replace(/do\s+not\s+describe\s+it\s+as\s+global/gi, '');
  if (/\bglobal\b/i.test(withoutDisclaimer)) {
    throw new Error('providerConcurrency.ts must not affirmatively claim the cap is global');
  }

  // Doctrine ban-list (no truth/verdict tokens in comments or strings).
  const banned = ['winner', 'loser', 'liar', 'dishonest', 'bad faith', 'truth', 'correct'];
  const lower = source.toLowerCase();
  for (const token of banned) {
    if (lower.includes(token)) {
      throw new Error(`providerConcurrency.ts contains banned token: ${token}`);
    }
  }

  // No Family H/I/J enablement language (the module is concurrency-only).
  if (/family\s*[hij]\b|family-[hij]\b|H\/I\/J/i.test(source)) {
    throw new Error('providerConcurrency.ts must not reference Family H/I/J');
  }
});

Deno.test('positive wiring scan: anthropicCall.ts imports providerConcurrency and calls acquire()', async () => {
  const source = await Deno.readTextFile(new URL('../lib/anthropicCall.ts', import.meta.url));
  if (
    !/import\s*\{[^}]*providerConcurrencyGate[^}]*\}\s*from\s*'\.\/providerConcurrency\.ts'/.test(
      source,
    )
  ) {
    throw new Error(
      'anthropicCall.ts must import providerConcurrencyGate from ./providerConcurrency.ts',
    );
  }
  if (!/providerConcurrencyGate\.acquire\s*\(\s*\)/.test(source)) {
    throw new Error('anthropicCall.ts must call providerConcurrencyGate.acquire()');
  }
  // The release must be in a finally (release-on-all-paths guarantee).
  if (!/finally\s*\{\s*release\s*\(\s*\)\s*;?\s*\}/.test(source)) {
    throw new Error('anthropicCall.ts must release the permit in a finally block');
  }
});
