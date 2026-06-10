/**
 * OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — Bounded-concurrency runner suite.
 *
 * The behavioural concurrency suite for the auto-trigger parallelization
 * card. The dispatcher itself is NOT Jest-loadable (it transitively imports
 * the Deno MCP adapter + persistence tree), so its dispatch STRATEGY is
 * source-scan-tested in mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived
 * / FamilyA. The *behavioural* concurrency guarantees (actual call overlap,
 * per-task isolation, order preservation, the fail-loud bound guard) are
 * tested HERE at the pure runner seam — the exact unit the
 * MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES bound flows through.
 *
 * The runner is exercised with a STUBBED task fn that records in-flight /
 * max-observed counts. Overlap is made observable DETERMINISTICALLY via
 * controllable deferreds (NOT real setTimeout races) — the runner is
 * deterministic given deterministic task timing.
 *
 * D7 (Card-1B lesson): every concurrency assertion uses the IMPORTED
 * constant `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`, never the literal `2`.
 * A single value-pin equality (expect(constant).toBe(2)) is allowed.
 *
 * NO live Anthropic; NO Deno; NO network. Loads the runner + the constant
 * via the Jest bridge (the modules are pure, so the bridge can require()
 * them the same way it loads familyRegistry / requestBuilder).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  edgeRunWithBoundedConcurrency as runWithBoundedConcurrency,
  edgeMaxAutoTriggerConcurrentFamilies as MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
  edgeProductionEnabledFamilies,
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';
import type { EdgeBoundedRunnerResult } from './_helpers/booleanObservationEdgeDeno';
import type { MachineObservationFamily } from '../src/features/nodeLabels/nodeLabelTypes';

const REPO = process.cwd();
const RUNNER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/boundedConcurrencyRunner.ts',
);
const CONCURRENCY_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerConcurrency.ts',
);
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);

/* ------------------------------------------------------------------ */
/* Deterministic deferred + tracking-task helpers                     */
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
 * A tracking task fn driven by per-index controllable deferreds. On each
 * call it: records the call (per-index call count), increments inFlight
 * (updating maxObserved), and returns a promise that settles only when the
 * test releases that index's deferred. This makes observed overlap
 * deterministic: a slow task stays in flight until explicitly released, so
 * with a bound of K and >K items exactly K tasks can be simultaneously
 * in flight.
 */
function makeTrackingTask(options?: {
  rejectIndices?: ReadonlySet<number>;
}) {
  const rejectIndices = options?.rejectIndices ?? new Set<number>();
  const deferreds = new Map<number, Deferred<string>>();
  const callCounts = new Map<number, number>();
  const startedIndices: number[] = [];
  let inFlight = 0;
  let maxObserved = 0;

  function deferredFor(index: number): Deferred<string> {
    let d = deferreds.get(index);
    if (!d) {
      d = makeDeferred<string>();
      deferreds.set(index, d);
    }
    return d;
  }

  const task = async (item: string, index: number): Promise<string> => {
    callCounts.set(index, (callCounts.get(index) ?? 0) + 1);
    startedIndices.push(index);
    inFlight += 1;
    if (inFlight > maxObserved) maxObserved = inFlight;
    const d = deferredFor(index);
    try {
      const value = await d.promise;
      return value;
    } finally {
      inFlight -= 1;
    }
  };

  /** Release index `i` (resolve, or reject when configured to). */
  function release(i: number, value?: string): void {
    const d = deferredFor(i);
    if (rejectIndices.has(i)) {
      d.reject(new Error(`tracking-task rejected at index ${i}`));
    } else {
      d.resolve(value ?? `value-${i}`);
    }
  }

  /** Release every index that has been started but not yet released. */
  function releaseAll(): void {
    for (const i of deferreds.keys()) release(i);
  }

  return {
    task,
    release,
    releaseAll,
    get inFlight() {
      return inFlight;
    },
    get maxObserved() {
      return maxObserved;
    },
    get startedIndices() {
      return startedIndices.slice();
    },
    callCounts,
  };
}

/** Flush pending microtasks so the runner can advance its workers. */
async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

/**
 * Strip block + line comments so a structural-purity scan inspects CODE,
 * not prose. (The runner's doc-comment legitimately NAMES the forbidden
 * tokens — "no Deno.", "the caller passes MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES"
 * — to document its contract; those mentions must not trip a code-only
 * purity assertion.) Crude but sufficient for these source files, which
 * contain no comment-delimiter sequences inside string literals.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const sevenItems = ['i0', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6'];

/* ============================================================ */
/* D7 — the imported constant (value pin)                       */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — bound constant (D7)', () => {
  it('MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES is importable via the bridge and equals 2 TODAY', () => {
    // The ONLY allowed literal `2` in this suite — the single value-pin.
    // Every concurrency assertion below uses the imported symbol, so a
    // future bump to 3 changes only this line (Card-1B lesson).
    expect(typeof MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES).toBe('number');
    expect(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES).toBe(2);
  });
});

/* ============================================================ */
/* D6 #1 / #2 — concurrency bound (against the imported const)  */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — observed concurrency bound (D6 #1/#2)', () => {
  it('D6 #1 — max observed concurrency NEVER exceeds the bound (7 items)', async () => {
    const tracker = makeTrackingTask();
    const runPromise = runWithBoundedConcurrency(
      sevenItems,
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      tracker.task,
    );
    // Let the pool spin up to its bound, then confirm it never overshoots
    // even with every task still in flight.
    await flushMicrotasks();
    expect(tracker.inFlight).toBeLessThanOrEqual(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES);
    tracker.releaseAll();
    await flushMicrotasks();
    // The pool may need several release/flush cycles to drain all 7.
    for (let i = 0; i < sevenItems.length + 2; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
    }
    await runPromise;
    expect(tracker.maxObserved).toBeLessThanOrEqual(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES);
  });

  it('D6 #2 — max observed concurrency REACHES the bound with >= 3 eligible families', async () => {
    const tracker = makeTrackingTask();
    const runPromise = runWithBoundedConcurrency(
      sevenItems,
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      tracker.task,
    );
    // With slow (unreleased) tasks and >= 3 items, the pool fills to its
    // full bound and holds there.
    await flushMicrotasks();
    expect(tracker.maxObserved).toBe(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES);
    // Drain.
    for (let i = 0; i < sevenItems.length + 2; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
    }
    await runPromise;
    expect(tracker.maxObserved).toBe(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES);
  });

  it('a single eligible family (n=1) never exceeds the bound and runs (effectively sequential)', async () => {
    const tracker = makeTrackingTask();
    const runPromise = runWithBoundedConcurrency(
      ['only'],
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      tracker.task,
    );
    await flushMicrotasks();
    expect(tracker.maxObserved).toBeLessThanOrEqual(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES);
    expect(tracker.maxObserved).toBe(1);
    tracker.releaseAll();
    const results = await runPromise;
    expect(results).toHaveLength(1);
  });
});

/* ============================================================ */
/* D6 #3 — A–I dispatch, J does not                             */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — all A–I dispatch, J does not (D6 #3)', () => {
  it('drives the runner with edgeProductionEnabledFamilies() (A–I); tasks exactly those 9 in order', async () => {
    const families = edgeProductionEnabledFamilies();
    const taskedInOrder: string[] = [];
    const results = await runWithBoundedConcurrency(
      families,
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      async (family) => {
        taskedInOrder.push(family);
        return family;
      },
    );
    // Exactly the 9 production families, in registry order
    // (post MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2 flip).
    expect(results).toHaveLength(9);
    const taskedSorted = taskedInOrder.slice().sort();
    expect(taskedSorted).toEqual(
      [
        'parent_relation',
        'disagreement_axis',
        'misunderstanding_repair',
        'evidence_source_chain',
        'argument_scheme',
        'critical_question',
        'resolution_progress',
        'claim_clarity',
        'thread_topology',
      ].slice().sort(),
    );
    // The result values preserve INPUT (registry) order regardless of
    // completion order.
    expect(results.map((r) => r.value)).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
    ]);
    // J is NOT tasked.
    for (const notProduction of ['sensitive_composer']) {
      expect(taskedInOrder).not.toContain(notProduction);
    }
  });
});

/* ============================================================ */
/* D6 #4 — a per-family rejection does NOT abort siblings       */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — per-task isolation (D6 #4)', () => {
  it('a rejection at one index does NOT prevent siblings dispatching; all indices run', async () => {
    const tracker = makeTrackingTask({ rejectIndices: new Set([2]) });
    const runPromise = runWithBoundedConcurrency(
      sevenItems,
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      tracker.task,
    );
    for (let i = 0; i < sevenItems.length + 2; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
    }
    const results = await runPromise;
    // Every index ran exactly once (its start tick was recorded).
    expect(tracker.startedIndices.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // The result array has one entry per item.
    expect(results).toHaveLength(sevenItems.length);
    // Index 2 is rejected; all others fulfilled.
    expect(results[2].status).toBe('rejected');
    for (const i of [0, 1, 3, 4, 5, 6]) {
      expect(results[i].status).toBe('fulfilled');
    }
  });

  it('the dispatcher-style map converts a rejected runner result to a family-tagged failed outcome', async () => {
    // Mirrors the exact mapping the dispatcher applies over the settled
    // results (Q2): rejected -> { outcome: 'failed', family: items[i], ... }.
    const eligibleFamilies = ['parent_relation', 'disagreement_axis', 'misunderstanding_repair'];
    const settled = await runWithBoundedConcurrency(
      eligibleFamilies,
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      async (family, index) => {
        if (index === 1) throw new Error('boom');
        return { outcome: 'triggered', runId: `run-${family}`, family };
      },
    );
    const outcomes = settled.map(
      (
        result: EdgeBoundedRunnerResult<{ outcome: string; runId: string | null; family: string }>,
        i: number,
      ) =>
        result.status === 'fulfilled' && result.value
          ? result.value
          : {
              outcome: 'failed' as const,
              runId: null,
              family: eligibleFamilies[i],
              failureReason: 'unexpected_error' as const,
            },
    );
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0]).toMatchObject({ outcome: 'triggered', family: 'parent_relation' });
    expect(outcomes[1]).toMatchObject({
      outcome: 'failed',
      family: 'disagreement_axis',
      failureReason: 'unexpected_error',
    });
    expect(outcomes[2]).toMatchObject({ outcome: 'triggered', family: 'misunderstanding_repair' });
  });

  it('a synchronously-throwing task is caught and recorded as rejected (defense-in-depth)', async () => {
    const results = await runWithBoundedConcurrency(
      ['a', 'b', 'c'],
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      async (_item, index) => {
        if (index === 0) throw new Error('sync-ish throw');
        return index;
      },
    );
    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(results[2].status).toBe('fulfilled');
  });
});

/* ============================================================ */
/* D6 #5 — one-run-per-family (each index tasked exactly once)  */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — one-run-per-family (D6 #5)', () => {
  it('each item is tasked EXACTLY once (no index processed twice)', async () => {
    const tracker = makeTrackingTask();
    const runPromise = runWithBoundedConcurrency(
      sevenItems,
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      tracker.task,
    );
    for (let i = 0; i < sevenItems.length + 2; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
    }
    await runPromise;
    // Every index 0..6 has a call count of exactly 1.
    expect(tracker.callCounts.size).toBe(sevenItems.length);
    for (let i = 0; i < sevenItems.length; i += 1) {
      expect(tracker.callCounts.get(i)).toBe(1);
    }
  });
});

/* ============================================================ */
/* D6 #6 — D/G subset filtering holds through request build     */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — D/G subset filtering (D6 #6)', () => {
  // The builder is UNCHANGED by this card; this is a guard test that the
  // ai_classifier-only subset for the mixed-source families D + G holds
  // through production request construction, independent of dispatch
  // strategy. The request carries `requestedRawKeys` + a `definitions`
  // map keyed by rawKey; each definition declares its `source`. The subset
  // filter keeps ONLY ai_classifier-source keys for D + G.
  function assertAiClassifierRawKeysOnly(family: MachineObservationFamily): void {
    const request = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'A current argument body for request construction.',
      parentText: 'A parent argument body for request construction.',
      threadContextExcerpt: 'Thread context excerpt.',
      requestedFamilies: [family],
      mode: 'production',
    });
    // The family survives the production filter (it's productionEnabled).
    expect(request.requestedFamilies).toContain(family);
    // There is at least one requested rawKey, and EVERY requested rawKey
    // resolves (via the definitions map) to an ai_classifier source — no
    // auto_metadata / lifecycle key slipped through the subset filter.
    expect(request.requestedRawKeys.length).toBeGreaterThan(0);
    for (const rawKey of request.requestedRawKeys) {
      const def = request.definitions[rawKey];
      expect(def).toBeDefined();
      expect(def.source).toBe('ai_classifier');
    }
  }

  it('Family D (evidence_source_chain) production request carries ai_classifier-source keys only', () => {
    assertAiClassifierRawKeysOnly('evidence_source_chain');
  });

  it('Family G (resolution_progress) production request carries ai_classifier-source keys only', () => {
    assertAiClassifierRawKeysOnly('resolution_progress');
  });
});

/* ============================================================ */
/* D6 #7 — submit path remains fire-and-forget                  */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — submit fire-and-forget (D6 #7)', () => {
  const SUBMIT_PATH = path.join(REPO, 'supabase/functions/submit-argument/index.ts');
  let submitText = '';
  beforeAll(() => {
    submitText = fs.readFileSync(SUBMIT_PATH, 'utf8');
  });

  it('submit-argument wraps the dispatch in .catch(() => undefined) and never awaits it', () => {
    expect(
      /dispatchAutoTriggerForArgument\([^)]+\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/.test(
        submitText,
      ),
    ).toBe(true);
    expect(/await\s+dispatchAutoTriggerForArgument\s*\(/.test(submitText)).toBe(false);
    expect(submitText).not.toMatch(/autoTriggerPromise\.then/);
    expect(submitText).not.toMatch(/await\s+autoTriggerPromise/);
  });

  it('the return created(...) appears AFTER the dispatch call (submit not blocked by classification)', () => {
    const dispatchIdx = submitText.indexOf('dispatchAutoTriggerForArgument(');
    const returnIdx = submitText.lastIndexOf('return created(');
    expect(dispatchIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(dispatchIdx);
  });
});

/* ============================================================ */
/* D7 — RangeError fail-loud guard (HALT-4)                     */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — RangeError fail-loud bound guard (HALT-4)', () => {
  const noopTask = async (_item: string, _index: number): Promise<string> => 'x';

  it.each([
    [0, 'zero'],
    [-1, 'negative'],
    [Number.NaN, 'NaN'],
    [1.5, 'non-integer'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
  ] as Array<[number, string]>)(
    'runWithBoundedConcurrency(items, %s, task) throws RangeError (never silently unbounded)',
    async (limit) => {
      await expect(runWithBoundedConcurrency(['a', 'b'], limit, noopTask)).rejects.toBeInstanceOf(
        RangeError,
      );
    },
  );

  it('a valid integer bound (the imported constant) does NOT throw', async () => {
    await expect(
      runWithBoundedConcurrency(['a', 'b'], MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES, noopTask),
    ).resolves.toBeDefined();
  });
});

/* ============================================================ */
/* D7 — order preservation                                      */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — input-order preservation (D7)', () => {
  it('results are in INPUT order even when a later index resolves FIRST', async () => {
    const tracker = makeTrackingTask();
    const runPromise = runWithBoundedConcurrency(
      ['x0', 'x1', 'x2', 'x3'],
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      tracker.task,
    );
    await flushMicrotasks();
    // Staggered completion: release index 1 (the later of the two
    // in-flight) before index 0. This lets index 2 start before index 0
    // finishes — completion order != input order.
    tracker.release(1, 'value-1');
    await flushMicrotasks();
    tracker.release(0, 'value-0');
    await flushMicrotasks();
    // Drain the rest.
    for (let i = 0; i < 6; i += 1) {
      tracker.releaseAll();
      await flushMicrotasks();
    }
    const results = await runPromise;
    // Indices are 0,1,2,3 regardless of completion order.
    expect(results.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    // results[i].value corresponds to items[i].
    expect(results[0].value).toBe('value-0');
    expect(results[1].value).toBe('value-1');
    expect(results[2].value).toBe('value-2');
    expect(results[3].value).toBe('value-3');
  });

  it('an empty items array resolves immediately to an empty result array', async () => {
    const tracker = makeTrackingTask();
    const results = await runWithBoundedConcurrency(
      [],
      MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
      tracker.task,
    );
    expect(results).toEqual([]);
    expect(tracker.maxObserved).toBe(0);
  });
});

/* ============================================================ */
/* Runner purity + doctrine ban-list on the new source files    */
/* ============================================================ */

describe('OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — runner purity (adapter-free, Jest-loadable)', () => {
  let runnerText = '';
  let concurrencyText = '';
  let dispatcherText = '';
  beforeAll(() => {
    runnerText = fs.readFileSync(RUNNER_PATH, 'utf8');
    concurrencyText = fs.readFileSync(CONCURRENCY_PATH, 'utf8');
    dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  });

  it('boundedConcurrencyRunner.ts contains no Deno / fetch / adapter / service-client / console (code, not comments)', () => {
    // Scan CODE only — the doc-comment legitimately names "Deno." / "fetch"
    // when documenting what the runner avoids.
    const code = stripComments(runnerText);
    expect(code).not.toContain('Deno.');
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toContain("from './booleanObservationMcpAdapter");
    expect(code).not.toContain('createServiceClient');
    expect(code).not.toMatch(/console\.\w+\s*\(/);
  });

  it('boundedConcurrencyRunner.ts imports NOTHING (no import statement at all — fully standalone)', () => {
    expect(runnerText).not.toMatch(/^\s*import\s/m);
  });

  it('autoTriggerConcurrency.ts exports ONLY the constant and imports nothing', () => {
    expect(concurrencyText).not.toMatch(/^\s*import\s/m);
    expect(concurrencyText).toContain('export const MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2;');
    // Exactly one export.
    const exportMatches = concurrencyText.match(/export\s+const\s+\w+/g) ?? [];
    expect(exportMatches).toHaveLength(1);
  });

  it('the runner is generic — its CODE does not reference the auto-trigger policy constant', () => {
    // The runner is generic — it must NOT hard-code the auto-trigger bound;
    // it takes `limit` as a parameter. Scan CODE only (the doc-comment
    // legitimately names the constant when describing the caller contract).
    const code = stripComments(runnerText);
    expect(code).not.toContain('MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES');
  });

  it('the two new source files + the edited dispatcher carry ZERO verdict tokens (doctrine ban-list)', () => {
    const banned = [
      'winner',
      'loser',
      'liar',
      'dishonest',
      'bad faith',
      'manipulative',
      'extremist',
      'propagandist',
      'fallacy',
      'truth value',
    ];
    for (const src of [runnerText, concurrencyText, dispatcherText]) {
      const lower = src.toLowerCase();
      for (const term of banned) {
        expect(lower.includes(term)).toBe(false);
      }
    }
  });
});
