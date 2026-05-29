# OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — Auto-trigger bounded-parallel dispatch

**Status:** Design draft
**Epic:** Runtime OPS (MCP boolean-observation auto-trigger; not a UI epic)
**Release:** Pre-Family-H latency hardening (predecessor main `494a92a`; Family G suite complete)
**Issue:** operator-authored intent brief — `docs/designs/OPS-MCP-AUTO-TRIGGER-PARALLELIZATION-intent.md`

## Goal (one paragraph)

The 7-family production auto-trigger dispatcher (`autoTriggerDispatcher.ts`) classifies each
production-enabled family in a strictly sequential `for...await` loop. Each family's MCP
classification costs ~5s; the measured 7-family `wall_clock_background` p95 is 34.6s — inside the
30–45s warning band and projected to cross the 45s FAIL line at the 8th (pessimistic) / 9th
(central) family. This card replaces the sequential loop with **bounded parallelism** (concurrency
limit 2) BEFORE the next production flip (Family H), so background completion stays under budget
while every doctrine invariant holds: submit stays fire-and-forget (HALT-5), no family failure
aborts a sibling (HALT-6), parallelism is bounded not unbounded (HALT-4), and one-production-run-
per-family-per-argument idempotency is byte-equal (D3). It ships **no new family, no flag flip, no
prompt/taxonomy/schema/key change**. The organizing principle from the intent brief is
**unit-green ≠ concurrency-correct**: the unit tests verify the runner's structural concurrency
bound and isolation; the post-merge operator smoke (overlap diagnostic + 429 capture) verifies the
live properties unit tests structurally cannot. A second, tightly-scoped fix (D5) corrects an
off-by-one "6-family" anchor in the latency report that became stale after the Family G flip.

This design carries an **orchestrator-authored brief ledger** at the end (the intent brief is
operator-authored; this design doc is orchestrator-authored from it).

---

## Phase 0 confirmation (verified against source — not re-litigated)

All four Phase 0 findings in the intent brief §2 are CONFIRMED by direct source read. Evidence:

1. **Sequential loop — CONFIRMED.** `autoTriggerDispatcher.ts:430–438`:
   ```ts
   const outcomes: AutoTriggerOutcome[] = [];
   for (const family of eligibleFamilies) {
     const iterationOutcome = await dispatchOneFamilyIteration(argumentId, family, serviceClient);
     outcomes.push(iterationOutcome);
   }
   return outcomes;
   ```
   No inter-family `sleep`/throttle between iterations. Per-family failure isolation already
   exists: `dispatchOneFamilyIteration` (lines 224–357) wraps its whole body in `try { … } catch { … }`
   and **returns** a typed `{ outcome: 'failed', … }` (lines 350–355) rather than throwing.

2. **D4 reentrancy — CONFIRMED already satisfied (see Q8 for the full proof).** Every mutable
   binding inside `dispatchOneFamilyIteration` is function-local; the only shared input is the
   stateless `serviceClient`; module-level bindings are all `const`/`Object.freeze`/`ReadonlySet`.

3. **D8 inter-family gap — CONFIRMED await-induced (see Q9).** The wall-vs-sum gap is `await`
   scheduling + the per-family idempotency pre-check `await findExistingRun(...)` between sequential
   awaits, NOT a deliberate throttle. The per-family retry backoff `await sleep(2_000 | 8_000)`
   (lines 314–316) lives INSIDE the iteration and is preserved untouched.

4. **Submit fire-and-forget — CONFIRMED (see Q6).** `submit-argument/index.ts:787–794` calls
   `dispatchAutoTriggerForArgument(...).catch(() => undefined)`, optionally hands the promise to
   `EdgeRuntime.waitUntil`, and falls straight through to `return created(...)`. The dispatcher
   loop is inside the background task; submit never awaits it.

---

## The 10 mandated questions — answered explicitly

### Q1 — Exact current control flow & what bounded-parallel replaces

**Before** (`autoTriggerDispatcher.ts`):
- `dispatchAutoTriggerForArgument` (lines 372–460): outer `try`; Guard 1 (`readEnabledFlag`,
  lines 379–396, once per dispatch); Guard 2 (`productionEnabledFamilies()`, lines 398–419,
  empty → single skipped outcome); then the **sequential loop at lines 430–438** (quoted in Phase 0
  #1); outer `catch` (lines 440–459) → single `unexpected_error` outcome.
- `dispatchOneFamilyIteration` (lines 224–357): idempotency pre-check → bounded retry loop
  (`MAX_ATTEMPTS = 2`) → typed outcome; never throws.

**After:** lines 430–438 are replaced with a single call to a new **pure bounded-concurrency
runner** that consumes `eligibleFamilies` and a per-family task function (a thin closure over
`dispatchOneFamilyIteration`), runs at most `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` (= 2) tasks
concurrently, collects every per-task result (allSettled-style — a rejection never aborts a
sibling), and returns the outcomes **in eligible-family (input) order**. Guard 1, Guard 2,
`dispatchOneFamilyIteration` (including its retry backoff and try/catch), and the outer try/catch
are **byte-unchanged**. The only edited region of `dispatchAutoTriggerForArgument` is the loop body.

### Q2 — Bounded-concurrency runner shape (extract a PURE helper — recommended)

**Decision: EXTRACT a small pure helper.** Rationale — testability. `autoTriggerDispatcher.ts`
directly imports `booleanObservationMcpAdapter.ts` (line 81), which reads `Deno.env.get` and uses
`fetch`; and transitively `classifyArgumentCore.ts → persistenceWriter.ts → supabaseClients`
(`createServiceClient`). **The dispatcher therefore CANNOT be `require()`-loaded into Jest** — the
test bridge `__tests__/_helpers/booleanObservationEdgeDeno.ts` explicitly excludes the adapter
(lines 19–24) for exactly this reason, and all existing dispatcher tests are *source-scan only*.

A runner that lives inside `autoTriggerDispatcher.ts` would inherit those un-loadable imports and
could only be tested by source-scan — which **cannot observe actual call overlap** (the D6 #1/#2
concurrency requirement). So the runner must be a **standalone module with zero Deno/adapter
imports** — pure Promise orchestration over a generic task array — so the Jest bridge can load it
and exercise it with a stubbed task fn that records start/end ticks.

**New file:** `supabase/functions/_shared/booleanObservations/boundedConcurrencyRunner.ts`
(pure TS; imports nothing from the adapter/core/persistence tree). ~70–90 lines.

**Exact signature:**
```ts
/**
 * Result wrapper preserving input order + per-task settle state. `index`
 * is the position in the input `items` array (outcome-order preservation).
 */
export interface BoundedRunnerResult<T> {
  index: number;
  status: 'fulfilled' | 'rejected';
  value?: T;          // present iff status === 'fulfilled'
  reason?: unknown;   // present iff status === 'rejected'
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
): Promise<ReadonlyArray<BoundedRunnerResult<TResult>>>;
```

**How it consumes the eligible-family list:** the dispatcher calls
```ts
const settled = await runWithBoundedConcurrency(
  eligibleFamilies,
  MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
  (family) => dispatchOneFamilyIteration(argumentId, family, serviceClient),
);
```
Because `dispatchOneFamilyIteration` already never throws, every `settled[i].status` will in
practice be `'fulfilled'` carrying a typed `AutoTriggerOutcome` (including the iteration's own
`'failed'` outcomes). The runner's `'rejected'` branch is the **defense-in-depth** path: if a future
refactor or a synchronous bug ever makes the task reject, the runner converts it (not aborts) — see
Q4. The dispatcher maps `settled` back to `AutoTriggerOutcome[]` in order:
```ts
const outcomes: AutoTriggerOutcome[] = settled.map((r, i) =>
  r.status === 'fulfilled' && r.value
    ? r.value
    : { outcome: 'failed', runId: null, family: eligibleFamilies[i], failureReason: 'unexpected_error' },
);
```

**Implementation pattern** (sketch for the implementer — index-pulling worker pool, NOT
`Promise.all`/`Promise.allSettled` over the whole list, NOT chunked batches):
```ts
export async function runWithBoundedConcurrency(items, limit, task) {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    throw new RangeError('runWithBoundedConcurrency: limit must be an integer >= 1');
  }
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    for (;;) {
      const i = nextIndex; nextIndex += 1;
      if (i >= items.length) return;
      try {
        const value = await task(items[i], i);
        results[i] = { index: i, status: 'fulfilled', value };
      } catch (reason) {
        results[i] = { index: i, status: 'rejected', reason };
      }
    }
  }
  const workerCount = Math.min(limit, items.length);
  const workers = [];
  for (let w = 0; w < workerCount; w += 1) workers.push(worker());
  await Promise.all(workers);   // awaits the FIXED worker set (<= limit), NOT the task list
  return results;
}
```
Note: the lone `Promise.all` here awaits the **bounded worker pool** (size `min(limit, n)`), which is
the bounding mechanism itself — it is NOT `Promise.all` over `eligibleFamilies`. This distinction is
load-bearing for HALT-4 and for the D8 source-scan (see Risks → DREG-6).

### Q3 — Where `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` lives (D1)

**Decision (single source of truth):** a new ~10-line pure module
`supabase/functions/_shared/booleanObservations/autoTriggerConcurrency.ts` exports ONLY the constant:
```ts
/**
 * Maximum number of family iterations dispatched concurrently. D1: chosen
 * for SAFETY (rate-limit headroom + simple reasoning), not throughput-
 * optimality. A bump to 3 is a 1-line PR gated on the measured 429 rate
 * at 2 (smoke Phase 4c). A CONSTANT — NOT an env var — so it is auditable
 * and rollback-via-PR. Lives in its own pure module (zero imports) so it
 * is importable by BOTH the dispatcher (which is not Jest-loadable) and
 * the concurrency tests (via the Jest bridge), satisfying D7.
 */
export const MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2;
```

**Why a dedicated 1-export module (not the dispatcher, not the runner):** the dispatcher is NOT
Jest-loadable (Q2 — it transitively imports the Deno adapter), so a constant declared there cannot be
`require()`d by tests; declaring it in the *generic* runner would couple auto-trigger policy into a
reusable mechanism. A standalone pure module is the only seam that keeps ONE source of truth
importable by both consumers.

- **Dispatcher** imports `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` from `./autoTriggerConcurrency.ts` and
  passes it as the runner's `limit` argument.
- **Tests (D7)** import it via the Jest bridge (`__tests__/_helpers/booleanObservationEdgeDeno.ts`
  re-exports it as `edgeMaxAutoTriggerConcurrentFamilies` — the module is pure so the bridge can
  `require()` it the same way it loads `familyRegistry`/`booleanObservationRequestBuilder`).

This is flagged as **Open question O1** (operator may prefer inlining the constant in the dispatcher
and source-scanning its value; that fallback weakens D7's "tests import the constant", which HALT-15
disfavors). Orchestrator recommends the 1-export module.

### Q4 — allSettled-style per-task isolation (NOT `Promise.all`)

**Mechanism:** the worker-pool `worker()` (Q2) wraps each `await task(...)` in its own
`try/catch`. A rejected task is **caught inside the worker** and written to `results[i]` as
`{ status: 'rejected', reason }`; the worker then continues pulling the next index. No rejection ever
propagates out of a worker, so **no sibling task is aborted**. The outer `await Promise.all(workers)`
only ever sees workers that resolve (they never reject — they swallow task rejections), so even that
`Promise.all` cannot short-circuit on a task failure.

**Why not builtin `Promise.allSettled(items.map(task))`:** that would launch ALL tasks at once
(unbounded — HALT-4). The worker pool gives allSettled *semantics* (collect every settle state) with
a *bound* (≤ `limit` concurrent). Builtin `Promise.all` is FORBIDDEN over the task list (it aborts on
first rejection — HALT-6).

**Order preservation:** results are written to `results[i]` by the task's input index `i`, not by
completion order. The dispatcher maps `settled[i] → AutoTriggerOutcome` for `i` in `0..n-1`, so the
returned `AutoTriggerOutcome[]` is in the SAME registry order as the sequential implementation
(Family A first, …, Family G last). **Order matters** because the per-family `started_at`/`completed_at`
audit and the smoke overlap diagnostic partition per-family, and the existing FR-30/DREG-33 invariant
("Family A is iteration #1") is preserved as "Family A is `outcomes[0]`". (With limit 2, A and B start
together; A still occupies index 0.)

**Failed-family collection:** in practice every family's failure is already a *fulfilled* outcome
(`dispatchOneFamilyIteration` returns `{ outcome: 'failed' }`, never throws). The runner's rejected
branch is defense-in-depth; either way the failed family appears in the returned array as a `'failed'`
outcome tagged with its `family`, and the siblings dispatch regardless.

### Q5 — Idempotency preserved under overlap; no cross-family shared state (D3/D4)

One-production-run-per-family-per-argument is enforced by the **per-family idempotency pre-check**
`findExistingRun(argumentId, family, serviceClient)` (lines 174–196), scoped by
`.contains('requested_families', [family])` + `run_mode='production'` + `schema_version` +
`provider_key`. This logic is **inside `dispatchOneFamilyIteration` and is byte-unchanged.** Because
each parallel task operates on a **distinct family**, the pre-checks query disjoint rows:

- The idempotency scope is `(argument_id, family, schema_version='…', run_mode='production', provider_key)`.
- Two concurrently-running tasks always have different `family` values (each `eligibleFamilies` entry
  is processed by exactly one worker iteration — the index-pull guarantees no index is processed
  twice). So no two in-flight tasks ever pre-check or write the SAME idempotency key.
- **Cross-family shared state: NONE.** Confirmed by Q8. Run rows are keyed per-family; `raw_key`s are
  pairwise disjoint across families (dispatcher header comment lines 64–72, citing the MCP-021A
  registry); Source 6 dedups by `raw_key` per argument. Overlap cannot corrupt idempotency.
- **Within-family double-run race** (the same family pre-checking before either writes): this race
  already existed in the sequential design across *separate submit events* and is documented as benign
  (Option A race-tolerance, lines 64–72). Bounded parallelism does NOT introduce a *new* within-family
  race because a single dispatch processes each family exactly once. The intra-dispatch idempotency
  guarantee is byte-identical to before.

### Q6 — Submit fire-and-forget preserved (HALT-5 existential)

The call site `submit-argument/index.ts:787–794` is **NOT edited by this card.** It remains:
```ts
const autoTriggerPromise = dispatchAutoTriggerForArgument(insertedArg.id, data.debate_id, serviceClient)
  .catch(() => undefined);
if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime?.waitUntil === 'function') {
  EdgeRuntime.waitUntil(autoTriggerPromise);
}
// … falls through to return created(...)
```
The dispatcher's return type stays `Promise<AutoTriggerOutcome[]>`; the caller never inspects it
(existing DREG-20/21, FAIL-14/15/16 assert no `.then`/`await`/`Array.isArray`). The bounded runner
lives entirely INSIDE `dispatchAutoTriggerForArgument`, so the background promise still resolves only
after all families settle — but submit never awaits that promise. The submit-nonblocking property is
structurally unchanged; the smoke Phase 2 measures it FIRST (immediate FAIL if regressed). D8 includes
a diff-boundary assertion that `submit-argument/index.ts` is NOT in the card's diff.

### Q7 — D/G mixed-source subset filtering holds through parallel request construction (HALT-8)

The D/G subset filter (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`, `booleanObservationRequestBuilder.ts:68–78`)
runs INSIDE `buildBooleanObservationRequestForArgument` (line 147–148), which is called by
`classifyOneArgumentCore` per (argument, family). The dispatcher passes a single-element `[family]`
array per task; the filter is **mode-driven and stateless** — it reads the frozen
`MCP_SERVER_SUPPORTED_FAMILY_SOURCES[def.family]` allowlist and skips non-allowed sources. Nothing in
the filter path reads shared mutable state or depends on dispatch ORDER or CONCURRENCY. Parallelizing
the dispatch loop does not touch `booleanObservationRequestBuilder.ts` at all; each task independently
calls `classifyOneArgumentCore` which independently builds its request with the family-D / family-G
ai_classifier-only subset intact. **HALT-8 is structurally impossible from a dispatch-strategy change.**
A D6 test (#6) asserts the subset still holds through `buildBooleanObservationRequestForArgument`
(via the bridge `edgeBuildBooleanObservationRequestForArgument`) for Family D and Family G.

### Q8 — Reentrancy proof: `dispatchOneFamilyIteration` is free of shared mutable state (HALT-16)

**Verdict: FREE of shared mutable state. HALT-16 does NOT fire. No "make tasks independent first"
rework is needed.** Evidence, enumerated against `autoTriggerDispatcher.ts:224–357`:

- **Function-local mutable bindings only:** `iterationStartMs` (229, `const`), `singleFamilyArray`
  (234, `const`), `lastSummary` (261, `let` — local), `attemptNumber` (262, `let` — local),
  `existing` (238, `const`), `waitMs` (315, `const`), `terminal` (320, `const`), `outcome` (240,
  `const`). Every one is declared inside the function body → a fresh binding per invocation. No
  closure escapes them.
- **Shared inputs are read-only or stateless:** `argumentId` (string, immutable), `family`
  (enum literal, immutable), `serviceClient` — a Supabase client that is **stateless per request**
  (it issues independent `.from(...).select(...)` / RPC calls; no client-side mutable accumulator;
  concurrent queries on one client are independent). The dispatcher receives the client by argument
  (lines 57–62) and never mutates it.
- **Module-level state is all immutable:** `AUTO_TRIGGER_MODE` (94, `const` literal), `MAX_ATTEMPTS`
  (97, `const`), `RETRYABLE_FAILURE_REASONS` (104, `ReadonlySet`), `RETRY_BACKOFF_MS` (114,
  `Object.freeze([...])`). No module-level `let`, no mutable accumulator, no cache object.
- **No shared accumulator:** the sequential loop's `outcomes` array (430) is built by the OUTER
  function pushing each return value — not mutated by the iteration. In the parallel design the
  outer function builds `outcomes` from the runner's ordered results; the iteration still just
  *returns* its outcome. Two iterations writing the same array slot is impossible (Q4 order
  preservation writes `results[i]` by unique index).
- **Side effects are per-family-scoped:** `emitAutoTriggerLog(...)` writes a structured log line
  (no shared in-memory state); `findExistingRun` / `classifyOneArgumentCore` issue DB I/O scoped to
  the distinct `family`. Interleaving two families' log lines / DB calls is benign (they are
  independent rows).

Conclusion: tasks are independent. The runner can overlap them safely with no rework. This matches
the intent brief §2 and §6 HALT-16 ("Phase 0 already cleared this").

### Q9 — The inter-family gap: await-induced, not a throttle; bounded parallelism subsumes it (D8)

**Characterization: await-induced serialization, NOT a deliberate throttle.** In the sequential
design, between finishing family N and starting family N+1, the only thing that happens is the loop
advancing to the next `await dispatchOneFamilyIteration(...)`, whose first act is
`await findExistingRun(...)` (the idempotency pre-check). The ~1.3–2.2s wall-vs-sum gap the intent
brief cites is (a) the event-loop scheduling cost of resuming the next iteration and (b) the
pre-check round-trip that runs *before* the ~5s classification of the next family. **There is no
`sleep`/`setTimeout`/delay between iterations** — `grep` confirms the only `sleep(...)` call is the
per-family retry backoff at line 316, inside the iteration.

**Why bounded parallelism subsumes the gap:** with limit 2, while family A's ~5s classification is in
flight, family B's pre-check + classification run concurrently — the gap and the next family's pre-
check overlap the *current* family's classification window instead of being serialized after it. The
total background wall-clock drops toward `ceil(n / limit) × (per-family p95 + its own pre-check)`
rather than `n × (per-family p95 + gap)`. The gap is not "removed" — it is *hidden under* the
concurrent classification, which is exactly what "subsumes" means here.

**Per-family retry backoff is PRESERVED.** `RETRY_BACKOFF_MS = [2_000, 8_000]` (line 114) and the
`await sleep(waitMs)` at line 316 are inside `dispatchOneFamilyIteration` and are byte-unchanged. A
family that hits a retryable failure still waits 2s (then 8s) *within its own task*; this does not
serialize other tasks (they run in their own workers). FAIL-9 (backoff schedule source-scan) stays
green.

### Q10 — D5 latency-report anchor fix (label/anchor only; no scope broadening)

**The bug:** `mcp-latency-report-lib.cjs:57` hardcodes `const CURRENT_FAMILY_COUNT = 6; // A+B+C+D+E+F`.
After the Family G production flip, production has **7** families (A–G). The constant is consumed in:
- the projection math base, `buildProjectionRows` (line 355): `anchor + (familyCount - CURRENT_FAMILY_COUNT) * perAddedFamily`;
- the display label, `stitchLatencyMarkdown` (line 605): `"Anchored on measured ${CURRENT_FAMILY_COUNT}-family …"`;
- a doc-comment (line 368) and the export list (line 727).

With target counts `[7,8,9,10]`, the N=7 row currently computes `anchor + (7−6)·perAddedFamily` — it
adds a **phantom 7th family** on top of an anchor that already reflects 7 families. So this is a
genuine off-by-one, not merely cosmetic.

**The fix — derive the count dynamically from the measured data, no Deno import, no new SQL, no scope
broadening:** the `.cjs` lib CANNOT `require()` the Deno `familyRegistry.ts` (`.ts`-extension imports;
Node loads the `.cjs` without babel). The natural data-derived source is already in hand: the
projection's anchor is the *measured* `wall_clock_background` p95, measured over exactly the families
that produced recent production rows. The number of **distinct production families observed** equals
`measuredPerFamilyP95.length` (one entry per distinct family from Q16's
`requested_families[1]`-grouped rows, via `aggregatePerFamily`). Concretely:

1. Add an optional `anchorFamilyCount` parameter to `projectWallClockForFamilyCounts(...)` (after the
   existing `options`). When supplied, it is the projection base; when omitted, it defaults to
   `measuredPerFamilyP95.length` (the data-derived current production-family count). Replace the
   module-constant use in `buildProjectionRows` with this resolved value passed in. **`buildProjectionRows`
   gains an `anchorCount` parameter** instead of closing over `CURRENT_FAMILY_COUNT`.
2. In `stitchLatencyMarkdown` (line 605), render the resolved count from the projection result
   (add `anchorFamilyCount` to the returned projection object) instead of the module constant.
3. The `.mjs` entry (line 129) already passes `measuredPerFamilyP95`; no `.mjs` change is required for
   the default path (the count derives from the array length). Optionally the `.mjs` can pass the
   length explicitly for clarity, but it is not necessary.
4. **Keep `CURRENT_FAMILY_COUNT` exported** but repurpose its meaning to a documented *fallback only*,
   OR remove it. **Decision:** keep the export to avoid breaking the test import at
   `opsMcpLatencyBudget.test.ts:131`, but change its role — it is no longer the projection base; the
   base is now data-derived/parameterized. The existing worked-example tests (lines 247–301) pass an
   **explicit** anchor + addedFamilyP95 and assert the closed form `(n − CURRENT_FAMILY_COUNT)`. To keep
   those tests meaningful AND correct, the worked-example tests are updated to pass the new explicit
   `anchorFamilyCount` (= 6 for the worked fixture, which has 6 measured families) so their arithmetic
   is unchanged. **This is the cleanest reconciliation: the worked-example fixture genuinely has 6
   measured families, so passing `anchorFamilyCount: 6` is correct, and the production default
   (7 today) is exercised by a NEW test** that passes a 7-family measured array and asserts the N=7 row
   equals the anchor (zero added families).

**No SQL change** (the SQL safety test asserts exactly 2 files — `opsMcpLatencySqlSafety.test.ts:78`).
**No new SQL file.** Any future latency SQL would go in `scripts/ops-latency-sql/` (sibling), never
`scripts/ops/sql/` (observability-owned, recursive count-16 test) — but this card adds none. The D5
change is JS-only inside `mcp-latency-report-lib.cjs` (+ test updates).

---

## Data model

**No new data model.** No new table, column, RLS policy, migration, or persisted shape. The
`argument_machine_observation_runs` rows, `requested_families`, `run_mode`, `provider_key`, and
`schema_version` semantics are byte-unchanged. The `AutoTriggerOutcome` interface
(`autoTriggerDispatcher.ts:124–131`) is unchanged. The new `BoundedRunnerResult<T>` interface is an
in-memory orchestration type, not a persisted or wire shape.

---

## File changes

**New files:**
- `supabase/functions/_shared/booleanObservations/boundedConcurrencyRunner.ts` (~70–90 lines) —
  pure, adapter-free worker-pool runner (`runWithBoundedConcurrency` + `BoundedRunnerResult`). Zero
  imports from the adapter/core/persistence tree, so Jest-loadable via the bridge.
- `supabase/functions/_shared/booleanObservations/autoTriggerConcurrency.ts` (~10 lines) — exports
  ONLY `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` (and its doc). Pure, zero imports. Single source of
  truth importable by both the dispatcher and (via the bridge) the tests. *(See Open question O1 — the
  operator may prefer to inline the constant in the dispatcher; this module exists to satisfy D7's
  "tests import the constant" without bridging the un-loadable dispatcher.)*
- `__tests__/mcpAutoTriggerBoundedConcurrency.test.ts` (~25–35 tests) — the behavioral concurrency
  suite (Q2 runner, the 7 D6 cases, D7 import assertions). Loads the runner via the bridge; stubs the
  task fn with start/end-tick recording.

**Modified files:**
- `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` (~15–20 line net change) —
  import `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` from `./autoTriggerConcurrency.ts` and
  `runWithBoundedConcurrency` from `./boundedConcurrencyRunner.ts`; replace lines 430–438 (the
  sequential `for...await` loop) with the bounded-runner call + ordered `outcomes` map (Q1/Q2). Update
  the file header comment block (the "Sequential loop choice" paragraph, lines 74–78, and the
  per-family loop comment at lines 421–429) to describe bounded parallelism. Everything else
  (`dispatchOneFamilyIteration`, both guards, retry backoff, both try/catches, `findExistingRun`,
  `readEnabledFlag`, `AutoTriggerOutcome`) is byte-unchanged.
- `scripts/ops/mcp-latency-report-lib.cjs` (~15–25 line change) — D5 anchor fix: parameterize
  `projectWallClockForFamilyCounts` + `buildProjectionRows` with a resolved `anchorFamilyCount`
  defaulting to `measuredPerFamilyP95.length`; add `anchorFamilyCount` to the returned projection
  object; render it in `stitchLatencyMarkdown` (line 605). Repurpose the `CURRENT_FAMILY_COUNT`
  comment (line 57) and the doc-comment (line 368) from "6 / A+B+C+D+E+F" to "data-derived current
  production-family count". Keep the export.
- `__tests__/opsMcpLatencyBudget.test.ts` (~10–20 line change) — D5 test updates: pass explicit
  `anchorFamilyCount: 6` in the worked-example arithmetic tests (lines 247–312) so their closed form
  is unchanged-and-correct; ADD a test that a 7-family measured array yields N=7 row == anchor (zero
  added families) and a label assertion that the markdown reads "measured 7-family" for a 7-entry
  fixture.
- `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` (~10 line change) — D8:
  update **DREG-5** (no longer require a `for...of eligibleFamilies` in the dispatcher) and **DREG-6**
  (replace the blanket "no `Promise.all` over the family list" with the precise "no UNBOUNDED parallel
  dispatch: the dispatcher delegates to `runWithBoundedConcurrency` with the bounded constant, and no
  `Promise.all(...)` / `Promise.allSettled(...)` is applied DIRECTLY to `eligibleFamilies` /
  `productionEnabledFamilies()`"). Add a positive assertion that the dispatcher imports
  `runWithBoundedConcurrency` + `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`.
- `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` (~3 line change) — D8: update **TRG-19** to drop
  the `for...of eligibleFamilies` existence assertion (the loop moved into the runner); keep the
  `classifyOneArgumentCore` / `AUTO_TRIGGER_MODE` / `runBooleanObservationMcpAdapter` / no-`AUTO_TRIGGER_FAMILIES`
  assertions unchanged.
- `__tests__/_helpers/booleanObservationEdgeDeno.ts` (~4 line change) — add bridge re-exports:
  `edgeRunWithBoundedConcurrency` (from `boundedConcurrencyRunner`) and
  `edgeMaxAutoTriggerConcurrentFamilies` (from `autoTriggerConcurrency`), with their narrow `require`
  type annotations matching the established pattern.

**Deleted files:** none.

**NOT modified (asserted in D8):** `submit-argument/index.ts`, `familyRegistry.ts`,
`booleanObservationRequestBuilder.ts` (and its `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`),
`classifyArgumentCore.ts`, `persistenceWriter.ts`, any prompt/taxonomy/family-key/schema module,
any MCP-server family code, `scripts/ops/sql/*`, any audit-lint rule, `package.json`, the lockfile,
`.gitignore`, any new SQL file.

---

## API / interface contracts

- **`runWithBoundedConcurrency<TItem, TResult>(items, limit, task)`** — signature in Q2. Throws
  `RangeError` for `limit < 1` / non-finite. Returns `ReadonlyArray<BoundedRunnerResult<TResult>>` in
  input order.
- **`MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES: number`** — exported const `= 2` from
  `autoTriggerConcurrency.ts`.
- **`dispatchAutoTriggerForArgument(argumentId, debateId, serviceClient): Promise<AutoTriggerOutcome[]>`**
  — signature, return type, never-throws contract, and outcome ORDER (registry order) all unchanged.
- **`projectWallClockForFamilyCounts(measuredPerFamilyP95, measuredWallClockP95Seconds, targetCounts,
  options?, anchorFamilyCount?)`** — new optional `anchorFamilyCount` (defaults to
  `measuredPerFamilyP95.length`); the returned object gains `anchorFamilyCount`. All existing fields
  preserved.
- **Bridge exports:** `edgeRunWithBoundedConcurrency`, `edgeMaxAutoTriggerConcurrentFamilies`.

---

## Edge cases

- **Empty `eligibleFamilies`:** never reaches the runner — Guard 2 (lines 404–419) returns a single
  `family_not_enabled` skipped outcome before the loop. (If it ever did reach the runner,
  `workerCount = min(limit, 0) = 0`, `Promise.all([])` resolves immediately, returns `[]`.)
- **Single eligible family (n=1):** `workerCount = min(2, 1) = 1` — effectively sequential; the bound is
  never exceeded; D6 #1 holds trivially.
- **All families fail (every iteration returns `'failed'`):** every result is a fulfilled `'failed'`
  outcome; the returned array is all-failed in order; submit unaffected (fire-and-forget).
- **A task synchronously throws (defense-in-depth):** caught by the worker's `try/catch`, recorded as
  `'rejected'`, mapped to a `'failed'` outcome tagged with `eligibleFamilies[i]`; siblings unaffected
  (D6 #4).
- **Concurrent submits for the same argument:** unchanged from today — each submit's dispatch processes
  each family once; cross-submit within-family double-run is the pre-existing benign Option A race
  (Q5). Bounded parallelism adds no new race.
- **`config_disabled` mid-list:** impossible — Guard 1 runs ONCE per dispatch before the loop (lines
  379–396; DREG-22). The kill switch is dispatch-wide, not per family.
- **Retryable failure inside one task:** that task waits its own 2s/8s backoff; other workers keep
  running (Q9). With n=7, limit=2, one family's 8s retry does not stall the other 6.
- **`limit` accidentally set to 0 / negative / NaN in a future edit:** `runWithBoundedConcurrency`
  throws `RangeError` — fail-loud, never silently unbounded (HALT-4 guard).
- **D5: zero measured families (empty `measuredPerFamilyP95`):** `projectWallClockForFamilyCounts`
  already throws `RangeError` when no per-family p95 exists and none supplied (existing test line 325);
  the `anchorFamilyCount` default of `0` is never reached because the function throws first. Preserved.
- **D5: measured family count ≠ target-count minimum:** the projection still computes
  `(familyCount − anchorFamilyCount)`; if the anchor was measured over 7 families and a target is 7,
  the row equals the anchor (correct).
- **Doctrine edge: "what if heat / popularity tries to influence the dispatch order or concurrency?"**
  — it doesn't and can't. Dispatch order is registry order; concurrency is a fixed safety constant;
  neither reads any engagement/heat/popularity signal. Idempotency keys exclude actor/engagement
  columns (IDEM-18).

---

## Test plan

All new behavioral tests use **no live Anthropic** — the runner is exercised with a **stubbed task fn**
that records `start`/`end` ticks (a monotonically incrementing counter or `performance.now()` via fake
timing) and uses a controllable resolve to measure observed concurrency. The dispatcher itself stays
source-scan-tested (it is not Jest-loadable); the *behavioral* concurrency guarantees are tested at
the **runner** seam, which is exactly the pure unit the limit flows through.

**File:** `__tests__/mcpAutoTriggerBoundedConcurrency.test.ts`

Helper inside the test: a `makeTrackingTask()` that, on each call, records `inFlight += 1` /
`maxObserved = max(maxObserved, inFlight)` on start and `inFlight -= 1` on completion, with each task
resolving after a tick the test controls (e.g., `await Promise.resolve()` micro-batches, or a deferred
that the test releases) so overlap is observable deterministically.

**D6 cases (the 7 required):**
1. **Max observed concurrency NEVER exceeds the bound** — run the tracking task over a 7-item array
   with `limit = MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`; assert
   `expect(maxObserved).toBeLessThanOrEqual(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES)` (D7).
2. **Max observed concurrency REACHES the bound with ≥3 eligible families** — same setup, ≥3 items;
   assert `expect(maxObserved).toBe(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES)` (D7). (With limit 2 and
   slow tasks, two run together.)
3. **All A–G dispatch, H/I/J do not** — drive the runner with
   `edgeProductionEnabledFamilies()` (returns A–G) as `items`; assert the result length is 7 and the
   tasked families are exactly `[parent_relation … resolution_progress]` in order, and that
   `claim_clarity` / `thread_topology` / `sensitive_composer` are NOT tasked. (Registry alignment —
   complements existing DREG-29.)
4. **A per-family rejection does NOT prevent siblings dispatching** — task fn rejects for one index
   (e.g. index 2) and resolves for the rest; assert all other indices ran (their start tick recorded),
   the result length == items length, `results[2].status === 'rejected'`, and the dispatcher-level map
   would convert it to a `'failed'` outcome tagged with that family. (A small companion assertion maps
   the runner result through the same mapping the dispatcher uses.)
5. **One-run-per-family idempotency intact** — assert each item's task is invoked **exactly once**
   (no index processed twice): track per-index call counts; assert all counts === 1. This is the
   runner-level guarantee that backs the dispatcher's one-pre-check-per-family-per-dispatch invariant.
   (Complemented by the existing source-scan IDEM-1…18 on the unchanged `findExistingRun`.)
6. **D/G subset filtering still holds through production request construction** — call
   `edgeBuildBooleanObservationRequestForArgument({ … requestedFamilies: ['evidence_source_chain'],
   mode: 'production' })` and assert `requestedRawKeys` contains only `ai_classifier`-source keys for
   Family D; repeat for `resolution_progress` (Family G). Asserts the subset is intact and
   independent of dispatch strategy (the builder is unchanged; this is a guard test). (Lives in this
   file or a co-located request-builder test; either is acceptable.)
7. **Submit path remains fire-and-forget (does NOT await family completion)** — source-scan
   `submit-argument/index.ts`: assert `dispatchAutoTriggerForArgument(...).catch(() => undefined)` is
   present, NO `await dispatchAutoTriggerForArgument`, NO `autoTriggerPromise.then`, and the
   `return created(` appears AFTER the dispatch call. (Mirrors FAIL-14/15/16; asserts the call site is
   unedited.)

**D7 — assertions use the IMPORTED constant, NEVER the literal:**
- Import `edgeMaxAutoTriggerConcurrentFamilies as MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` from the
  bridge.
- Use `expect(maxObserved).toBeLessThanOrEqual(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES)` AND
  `expect(maxObserved).toBe(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES)`.
- Add an assertion that the constant equals 2 TODAY (`expect(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES).toBe(2)`)
  — this single equality is acceptable as a value pin, but **the concurrency assertions themselves MUST
  use the imported symbol**, so a future bump to 3 only changes the value-pin line, not the concurrency
  logic. **FORBID** `expect(maxObserved).toBe(2)` (Card-1B brittleness lesson).
- Add a `RangeError` test: `runWithBoundedConcurrency(items, 0, task)` and `(items, -1, task)` and
  `(items, NaN, task)` throw (HALT-4 fail-loud guard).
- Add an order-preservation test: with staggered completion (later index resolves first), assert
  `results.map(r => r.index)` is `[0,1,2,…]` and `results[i].value` corresponds to `items[i]`.

**Runner purity test (in the same file or a source-scan):** assert
`boundedConcurrencyRunner.ts` source contains no `Deno.`, no `fetch(`, no
`from './booleanObservationMcpAdapter`, no `createServiceClient`, no `console.log` — proving it is
adapter-free and Jest-loadable.

**Doctrine ban-list test:** scan the two new source files
(`boundedConcurrencyRunner.ts`, `autoTriggerConcurrency.ts`) and the edited dispatcher region for the
ban-list (`winner / loser / liar / dishonest / bad faith / manipulative / extremist / propagandist /
fallacy / truth value`) — assert zero matches. (The dispatcher already has DREG-24/TRG-20; the new
files need their own coverage. Latency is a system-performance metric, never a gameplay/heat signal.)

**D5 latency tests (`__tests__/opsMcpLatencyBudget.test.ts`):**
- Update the worked-example arithmetic tests (lines 247–312) to pass explicit `anchorFamilyCount: 6`
  (the worked fixture has 6 measured families) — arithmetic results unchanged.
- ADD: a 7-family measured array → projection N=7 row equals the anchor (zero added families); assert
  `result.anchorFamilyCount === 7`.
- ADD: `stitchLatencyMarkdown` for a 7-entry measured fixture renders "measured 7-family" (label
  derives from the data, not the constant).
- ADD: default-path test — omit `anchorFamilyCount`; assert it defaults to `measuredPerFamilyP95.length`.
- Keep the existing doctrine ban-list + no-body/evidence_span tests green (unchanged).

**Test count forecast:** +25 to +35 (runner + D6 #1–7 + D7 import/RangeError/order + purity + ban-list +
D5 deltas). Within the intent brief's +15 to +40 band. **HALT if the plan implies > 120 without
rationale — it does not.**

**D8 — diff-boundary assertions** (a small source-scan suite, or folded into the concurrency test):
- No prompt/taxonomy/MCP-family diff: assert the card's changed-file set excludes
  `booleanObservationRequestBuilder.ts`, `machineObservationDefinitions.ts`, any `*Family*` family-key
  module, `mcpBooleanObservationSchema.ts`. (Reviewer verifies via `git diff --name-only`.)
- No `familyRegistry.ts` flag diff: `familyRegistry.ts` is NOT in the diff; the H/I/J
  `productionEnabled: false` lines are intact (existing DREG-31/FR invariants already cover the
  registry shape — keep them green).
- No audit-lint rule diff: no file under the audit-lint rule set changes.
- No `package.json` / lockfile diff.
- No staged generated artifacts: `out/`, `*.log`, smoke harnesses/reports are NOT committed (explicit
  `git add <files>` only).
- `submit-argument/index.ts` is NOT in the diff (HALT-5 boundary).
- No new SQL file: `scripts/ops-latency-sql/` still has exactly 2 files (existing
  `opsMcpLatencySqlSafety.test.ts:78` enforces this — keep it green); `scripts/ops/sql/` still has 16
  (observability recursive count — untouched).

---

## Dependencies (cards / docs / files)

- This design assumes **the Family G production flip (MCP-021C-EDGE-FAMILY-G-ENABLE) is complete**
  because (a) `productionEnabledFamilies()` returns A–G (7 families) — confirmed in `familyRegistry.ts`,
  and (b) the D5 "6-family" anchor is stale *precisely because* G is now live (the off-by-one is the
  motivating symptom). Predecessor main `494a92a`.
- This design assumes **OPS-MCP-LATENCY-BUDGET is complete** because it reuses
  `mcp-latency-report-lib.cjs`, `scripts/ops-latency-sql/01|02-*.sql`, and the latency test suites,
  and edits the `projectWallClockForFamilyCounts` anchor it introduced.
- **Reads existing `dispatchOneFamilyIteration`** (`autoTriggerDispatcher.ts:224–357`) at its current
  signature and never-throws contract — the bounded runner wraps it unchanged.
- **Reads the existing test bridge** `__tests__/_helpers/booleanObservationEdgeDeno.ts` — the new pure
  modules are bridged the same way (`require` + narrow type) the registry/request-builder are.
- **Reads the submit call site** `submit-argument/index.ts:787–794` (verifies fire-and-forget; does NOT
  edit it).
- **Will unblock the next production flip (Family H)** because it brings the projected
  `wall_clock_background` p95 back under the 45s FAIL line by overlapping the per-family classifications
  — the explicit motivation in intent brief §1.

---

## Risks

- **Stale existing tests assert the OLD sequential strategy (highest-attention item).** Three tests
  encode "sequential `for...of`, no `Promise.all`": **DREG-5** and **DREG-6**
  (`mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts:84,91`) and **TRG-19**
  (`mcpOneTwoOneCAutoTriggerFamilyA.test.ts:199`). The FR-30 comment
  (`mcpOneTwoOneCEdgeFamilyRegistry.test.ts:304`) merely *mentions* "sequential for-of" in commentary —
  its assertion is registry order, which is preserved (no change needed there). DREG-5/6 and TRG-19
  MUST be updated by this card (the intent brief authorizes "new/updated Edge auto-trigger +
  concurrency tests"). DREG-6's update is the delicate one: replace "no `Promise.all` anywhere near the
  family list" with "no `Promise.all`/`Promise.allSettled` applied DIRECTLY to
  `eligibleFamilies`/`productionEnabledFamilies()`" — because the runner's internal
  `await Promise.all(workers)` is the bounding mechanism over the FIXED worker pool (size ≤ limit), not
  the task list. The runner's `Promise.all` is in a *different file* (`boundedConcurrencyRunner.ts`), so
  a dispatcher-scoped source-scan that forbids `Promise.all` on the family list stays clean. This is a
  **documented D8 boundary item, not a HALT** — the tests describe the strategy this card intentionally
  changes.
- **D7 constant-import seam adds a 1-export module.** Because the dispatcher is not Jest-loadable, the
  cleanest way for tests to import the *real* constant (not a literal) is a tiny pure
  `autoTriggerConcurrency.ts`. See Open question O1 — if the operator rejects the new module, the
  fallback weakens D7 (source-scan the dispatcher value + import the runner default), which the intent
  brief's HALT-15 disfavors. Recommend the 1-export module.
- **D5 worked-example test arithmetic could break if `anchorFamilyCount` is mis-parameterized.** The
  mitigation is explicit: pass `anchorFamilyCount: 6` in the worked-example tests (their fixture has 6
  measured families) so the closed form `(n − 6)` is unchanged-and-correct, and add a *separate* 7-family
  test for the production default. Do NOT simply flip the module constant 6→7 — that would silently
  break lines 263/280/288 arithmetic.
- **Concurrency-test flakiness if the stubbed task uses real wall-clock delays.** Mitigation: drive
  overlap with controllable deferreds / microtask batching and a monotonic counter, not `setTimeout`
  races. The runner is deterministic given deterministic task timing; the test must not depend on real
  timers.
- **No migration; no operator DB deploy.** The runtime change is Edge-Function-only and ships via the
  Supabase GitHub merge auto-deploy (memory: `supabase-merge-autodeploy`). The latency-report change is
  a local operator script — no deploy.
- **Platform note (informational):** the bounded runner does not change the `EdgeRuntime.waitUntil`
  ~150s isolate-keepalive ceiling; 45s is a product budget well under it. No platform-limit interaction.

---

## Out of scope

- Family H/I/J enablement or any `productionEnabled` flag flip (HALT-1, HALT-2).
- Any prompt, taxonomy, family-key, schema, or MCP-server family code change (HALT-3).
- Tuning the concurrency value to 3+ (a future 1-line PR gated on the smoke 429 capture; D1 fixes it at
  2 for SAFETY this card).
- Changing the idempotency strategy (Option A pre-check) or the per-family retry backoff schedule.
- Broadening the latency report's scope, adding SQL files, or touching `scripts/ops/sql/`
  (observability-owned).
- `classifyArgumentCore.ts` / `persistenceWriter.ts` / `booleanObservationRequestBuilder.ts` behavior
  (read-only dependencies; unchanged).
- The live smoke itself (post-merge, operator-gated; this card is design + code + unit tests only). The
  smoke plan is in intent brief §8 and is the operator's to run.
- Any v1-scope-banned feature (voting/score-winner, OAuth, push, search, public API) — none implicated.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the dispatcher classifies
  Machine Observations only; the change is dispatch *timing*, never a verdict. Latency is a
  system-performance metric, never a gameplay/truth signal. Submit is never blocked (fire-and-forget,
  Q6). New source files carry a ban-list test (no `winner/loser/liar/…`).
- **cdiscourse-doctrine §2 (heat = activity, not truth) / §3 (popularity is not evidence):** the runner
  reads no engagement/heat/popularity signal; dispatch order is registry order; concurrency is a fixed
  constant. Idempotency keys exclude actor/engagement/heat/view-count/reply-count columns (existing
  IDEM-18 stays green).
- **cdiscourse-doctrine §4 (AI moderator limits):** unchanged — the dispatcher does not decide
  right/wrong, delete/hide/modify content, assign truth, or return authoritative flags. AI runs only in
  Edge Functions (this IS an Edge Function path). No client-side AI.
- **cdiscourse-doctrine §5 (rules engine sacred):** untouched — no edit to
  `src/lib/constitution/engine.ts`; the runner is pure but is NOT the engine.
- **cdiscourse-doctrine §6 (secrets):** the new files contain no key literals; the dispatcher still
  never creates a service-role client (it receives one by argument); existing DREG-27 (no
  `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `EXPO_PUBLIC_` / `createServiceClient(`) stays
  green; the latency lib stays key-free (existing purity test).
- **cdiscourse-doctrine §7 (no AI from production app; server-only file):** `autoTriggerDispatcher.ts`
  and the new runner live under `supabase/functions/` and are never imported by `src/`/`app/`. No new
  AI call is added — the change is orchestration timing of the EXISTING MCP path.
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration, no RLS change, no table edit, no
  `flags`/`arguments` mutation. `run_mode='production'` idempotency scope byte-equal.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** every persisted row remains a Machine
  Observation; the dispatch-strategy change does not alter the `source`/kind of any row.
- **test-discipline:** tests ship WITH the card (the +25–35 concurrency/D5 suite); pure-runner gets unit
  coverage including failure + boundary + order cases; ban-list test on new strings; gate verification
  via captured exit code + `Test Suites/Tests` line; `current-status.md` test count updated only after a
  confirmed count, cross-checked against the reviewer re-run.
- **HALT review (all 16):** none fire. HALT-4 (unbounded) — bounded by construction + RangeError guard.
  HALT-5 (submit awaits) — call site unedited; Q6. HALT-6 (failure aborts sibling) — per-worker
  try/catch; Q4. HALT-15 (test hardcodes the bound) — D7 imports the constant; only one value-pin
  equality. HALT-16 (shared mutable state) — proven free; Q8. HALT-8 (D/G subset) — builder unchanged;
  Q7. HALT-13 (forecast > 120) — forecast +25–35.

---

## Operator steps (if any)

**Runtime change (`autoTriggerDispatcher.ts` + new runner):** None at deploy time beyond the standard
merge — the Supabase GitHub integration auto-redeploys Edge Functions on merge to main (memory:
`supabase-merge-autodeploy`). No `db push` (no migration). No manual env var (the concurrency value is
a code constant, not an env var — D1).

**Latency-report change (`mcp-latency-report-lib.cjs`):** None — it is a local operator script; the
operator runs `node scripts/ops/mcp-latency-report.mjs` when they want a report.

**Post-merge smoke (operator-gated; intent brief §8):** the operator runs the canary-first smoke
(submit-nonblocking GATE first → 7 production runs A–G → N=5 → Phase 4b overlap diagnostic + Phase 4c
429 capture). This spends ~35–40 gated Anthropic calls and is the operator's to authorize — **not part
of this card's code/test deliverable** (HALT-14: no live smoke Anthropic spend before operator
approval).

---

## Orchestrator-authored brief ledger

The intent brief (`…-intent.md`) is **operator-authored**; this design doc is **orchestrator-authored**
from it. Provenance of each design decision:

- **Derived from the operator intent brief (binding source-of-truth):** D1 (constant = 2, SAFETY
  rationale, code-not-env), D2 (allSettled-style, no `Promise.all`), D3 (idempotency/subset/fire-and-
  forget preservation), D4 (reentrancy already satisfied), D5 (latency anchor fix, label/anchor only,
  sibling SQL dir), D6 (the 7 concurrency cases), D7 (import-the-constant assertions, no `toBe(2)`
  literal), D8 (diff-boundary set), the 16 HALT triggers, the +15–40 forecast, scope allow/deny lists.
- **Derived from the pre-launch codebase survey (this design's own source reads):** the precise
  extraction shape (pure adapter-free runner because the dispatcher is not Jest-loadable — verified via
  the dispatcher's `booleanObservationMcpAdapter.ts` import + the bridge exclusion comment); the worker-
  pool implementation pattern; the exact DREG-5/DREG-6/TRG-19 stale-test list (verified by grep+read);
  the D5 data-derived count = `measuredPerFamilyP95.length` (verified against Q16 SQL +
  `aggregatePerFamily`); the "exactly 2 SQL files" / "no scope broadening" constraint (verified against
  `opsMcpLatencySqlSafety.test.ts:78`); the worked-example test reconciliation (verified against
  `opsMcpLatencyBudget.test.ts:247–312`).
- **Resolved by orchestrator default (NOT explicit operator direction) — operator review invited:**
  (a) **O1** — creating the 1-export pure module `autoTriggerConcurrency.ts` as the D7 import seam (vs
  inlining the constant in the dispatcher and source-scanning it). The intent brief says "placed where
  the test imports it (D7)" but does not name the module; the orchestrator chose the cleanest seam that
  keeps a single source of truth importable by Jest. (b) The defense-in-depth `'rejected'` branch in the
  runner (the brief notes iterations already never throw; the orchestrator kept the rejected path as a
  belt-and-suspenders mechanism — it does not change behavior since `dispatchOneFamilyIteration` returns
  typed failures). (c) Mapping a rejected runner result to a `family`-tagged `'failed'` outcome using
  `eligibleFamilies[i]` (a natural extension of the existing `'failed'` shape).
- **Operator-deferred review (decide before/at implementation):**
  - **O1 (above):** approve the 1-export `autoTriggerConcurrency.ts` module, or direct the inline-constant
    fallback (which weakens D7 — orchestrator recommends the module).
  - **O2:** confirm the DREG-5 / DREG-6 / TRG-19 updates are acceptable as in-scope "updated Edge
    auto-trigger tests" (the orchestrator reads the intent brief as authorizing this; flagging because
    these tests were authored to PIN the sequential strategy this card replaces).
  - **O3:** confirm the D5 `CURRENT_FAMILY_COUNT` export is *kept but repurposed* (vs removed). Keeping it
    avoids breaking the existing test import at `opsMcpLatencyBudget.test.ts:131`; removing it would be a
    larger test churn. Orchestrator recommends keep-and-repurpose.
