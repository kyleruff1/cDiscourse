/**
 * OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — Pure bounded-concurrency runner.
 *
 * A standalone, adapter-free worker-pool that runs a task over a list of
 * items with at most `limit` tasks in flight at once, collects every
 * task's settle state (allSettled-style — a rejected task NEVER aborts a
 * sibling), and returns the results in INPUT ORDER.
 *
 * Why a standalone module (NOT a helper inside autoTriggerDispatcher.ts):
 * the dispatcher transitively imports the Deno MCP adapter
 * (`booleanObservationMcpAdapter.ts` → `Deno.env.get` + `fetch`) and the
 * persistence tree, so it is NOT `require()`-loadable into Jest. A runner
 * living inside it could only be source-scan-tested, which cannot observe
 * actual call overlap. Keeping the runner pure (zero imports from the
 * adapter/core/persistence tree, no `Deno.`, no `fetch`, no `console`)
 * lets the Jest bridge load and exercise it with a stubbed task fn.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §5 — pure orchestration; no module-level mutable
 *     state, no Date.now, no side effects. Deterministic given
 *     deterministic task timing. (This is NOT the rules engine, but it
 *     honours the same purity bar.)
 *   - cdiscourse-doctrine §1/§3 — reads no engagement/heat/popularity
 *     signal; the only ordering input is the caller's input index.
 */

/**
 * Result wrapper preserving input order + per-task settle state. `index`
 * is the position in the input `items` array (outcome-order preservation).
 */
export interface BoundedRunnerResult<T> {
  index: number;
  status: 'fulfilled' | 'rejected';
  value?: T; // present iff status === 'fulfilled'
  reason?: unknown; // present iff status === 'rejected'
}

/**
 * Run `task(item, index)` over `items` with at most `limit` tasks in
 * flight at once. allSettled-style: a rejected task NEVER aborts a
 * sibling; every task's settle state is collected. Results are returned
 * in INPUT ORDER (results[i] corresponds to items[i]), independent of
 * completion order.
 *
 * `limit` is REQUIRED and must be a finite integer >= 1 — the caller
 * passes the exported MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES constant; the
 * tests pass the SAME imported constant (D7). limit < 1 or non-finite
 * throws RangeError (never silently runs unbounded — HALT-4 guard).
 *
 * Pure: no Deno, no fetch, no module-level mutable state, no Date.now,
 * no console. Deterministic given deterministic task timing.
 */
export async function runWithBoundedConcurrency<TItem, TResult>(
  items: ReadonlyArray<TItem>,
  limit: number,
  task: (item: TItem, index: number) => Promise<TResult>,
): Promise<ReadonlyArray<BoundedRunnerResult<TResult>>> {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    throw new RangeError('runWithBoundedConcurrency: limit must be an integer >= 1');
  }

  const results: Array<BoundedRunnerResult<TResult>> = new Array(items.length);
  let nextIndex = 0;

  // Each worker pulls the next unclaimed index until the list is
  // exhausted. The index-pull guarantees every index is processed by
  // exactly ONE worker iteration (one-run-per-item — backs the
  // dispatcher's one-pre-check-per-family-per-dispatch invariant).
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      try {
        const value = await task(items[i], i);
        results[i] = { index: i, status: 'fulfilled', value };
      } catch (reason) {
        // allSettled-style: catch the rejection INSIDE the worker so it
        // never propagates out and never aborts a sibling (HALT-6). The
        // worker then continues pulling the next index.
        results[i] = { index: i, status: 'rejected', reason };
      }
    }
  }

  // The pool is bounded to min(limit, n) workers — this fixed worker set
  // IS the bounding mechanism (HALT-4). The Promise.all below awaits the
  // FIXED worker set (<= limit), NOT the task list, so it cannot launch
  // an unbounded number of concurrent tasks and (because workers swallow
  // task rejections) cannot short-circuit on a task failure.
  const workerCount = Math.min(limit, items.length);
  const workers: Array<Promise<void>> = [];
  for (let w = 0; w < workerCount; w += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}
