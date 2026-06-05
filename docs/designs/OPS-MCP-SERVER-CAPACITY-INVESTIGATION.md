# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — Per-isolate bounded provider-concurrency cap

> **SUPERSEDED for the active fix axis (pointer, body preserved).** The per-isolate
> synchronous-capacity cap this doc prescribes was superseded by the canonical Postgres
> async classifier queue in [`ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md`](./ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md)
> §"Goal (one paragraph)". This record is preserved byte-equal as the durable #371 card-intent; it is not a current prescription.

**Status:** Design draft
**Epic:** Epic 12 / MCP semantic-referee track (server-runtime capacity control)
**Release:** Stage 2B (server-runtime change; APPROVED in the intent brief)
**Issue:** https://github.com/<owner>/<repo>/issues/371
**Authoritative intent:** `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md`

> This design is bounded by the intent brief. Where the brief and this doc could be
> read differently, the brief wins. This card is **server-cap ONLY**: no retry-after
> protocol, no Edge change, no Family H, no prompt/taxonomy/family-key/schema-mirror/
> Source-6/Edge-flag/audit-lint change, no migration, no `package.json` change.

---

## Goal (one paragraph)

The hosted MCP server (`mcp-server/`) fans out **unthrottled** concurrent Anthropic
calls: `lib/anthropicCall.ts` `callAnthropic` is a single `fetch` per call with no
semaphore, queue, or retry, and every family wrapper (A–G) plus the semantic-move
path routes its one provider round-trip through it. The Edge's
`MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES=2` is **per-argument**, so a cross-argument
burst (≈5 args × up-to-2 families = ~10 concurrent Edge→MCP requests) produces ~10
concurrent unthrottled Anthropic calls → Anthropic 429 (`rate_limited`) / 25s timeout
(`model_timeout`) / 5xx (`api_error`) → the `{isError, reason, …}` envelope the
#365/#368 program chased. No Edge backoff fixes this because the Edge cannot bound
cross-argument fan-in; the throttle must live at the server. We add a **per-isolate
bounded async semaphore** around `callAnthropic`'s provider round-trip: at most
`MCP_SERVER_MAX_PROVIDER_CONCURRENCY` (default **5**) provider fetches in flight per
isolate; excess callers queue inside the isolate and are handed a slot on release.
This drops the ~10 burst peak to two waves while a queued call waits only ~one ~5s
round-trip, keeping the argument wall <30s. Doctrine anchors that shape the design:
cdiscourse-doctrine §5 (the gate logic is pure — no truth/heat/popularity input, the
only ordering signal is FIFO arrival), §6 (no secret/raw-payload reaches a log or
returned detail — the cap touches nothing the logger already scrubs), §7 (server-side
Deno only). The cap **reduces the frequency** of the `{isError}` envelope class under
the current A–G burst profile; it does **not** remove the envelope class (the brief is
explicit: provider failure typing is preserved).

---

## Topology honesty (binding)

A module-level semaphore bounds **per-isolate** concurrency. The hosted MCP server
(Deno Deploy or similar) **may** run multiple isolates/processes, so the cap is
**per-isolate, NOT a true global cap**. This doc, every code comment in
`providerConcurrency.ts`, and the gate comment in `anthropicCall.ts` use the word
**"per-isolate"** and must not claim global enforcement unless the deployment topology
is proven single-instance. The post-merge smoke (separate gate) determines whether the
per-isolate cap is sufficient for the current product load; if it is only partially
effective, the follow-up `OPS-MCP-SERVER-RETRY-AFTER-PROTOCOL` is filed.

---

## Data model

**No new data model. No migration. No DB column.** This is a pure server-runtime
change. The only persistent-shape touch is in-isolate transient state (the semaphore's
in-flight counter + FIFO waiter queue), which lives in module scope and never crosses
a request boundary or a network boundary.

---

## Design — the semaphore module

### Why a closure/class semaphore, NOT `runWithBoundedConcurrency`

The Edge precedent `supabase/functions/_shared/booleanObservations/boundedConcurrencyRunner.ts`
is a **list-based worker pool**: it takes a known `items` array and runs `task(item, i)`
with a fixed worker set of `min(limit, n)`. That shape fits the Edge auto-trigger, which
holds the full family list for one argument up front.

The MCP-server gate is a **different shape**: callers arrive **one at a time** (the
HTTP server invokes `handleClassifyArgumentBooleanObservations` per request → exactly
one `callAnthropic` per request — confirmed 1:1, no internal fanout). There is no
list to map over; there is a stream of independent arrivals that must each acquire a
slot, run, and release. The correct primitive for "N concurrent permits, FIFO queue,
acquire/release across independent callers" is a **counting semaphore**, not a
worker-pool-over-a-list. Reusing `runWithBoundedConcurrency` would require inventing a
synthetic list per arrival, which it cannot do (arrivals are not known in advance).

Decision: implement a small **counting semaphore as a closure-backed object** (a
factory function returning `{ acquire, release-via-returned-fn }`), plus a
module-singleton instance sized from env. A closure is preferred over a class purely
for testability symmetry with the existing pure modules (no `this` capture surprises in
the FIFO handoff) — either is acceptable; the doc specifies a closure and the
implementer may use a class with identical semantics if they prefer, provided the
behavioral tests pass unchanged.

### `mcp-server/lib/providerConcurrency.ts` (NEW, pure)

Purity bar (mirrors `boundedConcurrencyRunner.ts` doctrine §5): the **core gate logic**
(counter, queue, acquire, release/handoff) does **no** `Deno.env`, no `fetch`, no
network, no `console`, no `Date.now`. Determinism: given deterministic task timing the
acquire/release ordering is deterministic (strict FIFO). The **only** env read is the
cap reader, which is isolated in its own exported function (so the gate factory can be
unit-tested with an injected numeric cap, and the cap reader can be unit-tested
separately).

```ts
/**
 * OPS-MCP-SERVER-CAPACITY-INVESTIGATION — per-isolate bounded provider
 * concurrency cap.
 *
 * A counting semaphore that bounds concurrent provider (Anthropic) round-trips
 * to at most `cap` IN FLIGHT AT ONCE WITHIN A SINGLE ISOLATE. Excess callers
 * queue (FIFO) and are handed a slot on release.
 *
 * TOPOLOGY: this is a PER-ISOLATE cap. The hosted server may run multiple
 * isolates; this is NOT a true global cap. Do not describe it as global.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §5 — the gate logic is pure: no Deno.env / fetch /
 *     network / console / Date.now inside acquire/release/handoff. The cap
 *     VALUE is read from env in a separate reader (readEnvMaxProviderConcurrency)
 *     so the semaphore factory itself is injectable + unit-testable.
 *   - cdiscourse-doctrine §1/§3 — no truth/heat/popularity/engagement signal;
 *     the only ordering input is FIFO arrival order.
 *   - cdiscourse-doctrine §6 — touches no secret/prompt/response value; nothing
 *     here is ever logged or returned.
 */

export const DEFAULT_MAX_PROVIDER_CONCURRENCY = 5;

/** A release fn — calling it exactly once frees the held slot (idempotent). */
export type ReleaseFn = () => void;

export interface BoundedSemaphore {
  /**
   * Resolve with a ReleaseFn when a slot is free. If at capacity, the caller
   * is queued (FIFO) and the promise resolves once a prior holder releases.
   */
  acquire(): Promise<ReleaseFn>;
  /** In-flight count — test/observability only; not used by the gate. */
  readonly inFlight: number;
  /** Queue depth — test/observability only. */
  readonly waiting: number;
}

/**
 * Build a counting semaphore with `cap` permits. `cap` must be a finite
 * integer >= 1 (the caller passes the env-resolved cap; the env reader already
 * floors invalid values to the default). cap < 1 / non-finite throws RangeError
 * — NEVER silently unbounded (HALT-5 guard, mirrors the Edge runner's HALT-4).
 */
export function createBoundedSemaphore(cap: number): BoundedSemaphore { /* … */ }

/**
 * Read MCP_SERVER_MAX_PROVIDER_CONCURRENCY from Deno.env. Default 5. Validated:
 * a finite integer >= 1, else fall back to the default. Mirrors
 * anthropicCall.ts `readEnvTimeoutMs` validation exactly.
 */
export function readEnvMaxProviderConcurrency(): number { /* … */ }

/**
 * The PER-ISOLATE module-singleton semaphore used by callAnthropic. Sized from
 * env at module init. Exported so the gate-site test can assert the cap against
 * the IMPORTED resolved value (RESOLVED_MAX_PROVIDER_CONCURRENCY) rather than a
 * literal 5 (Card-1B lesson).
 */
export const RESOLVED_MAX_PROVIDER_CONCURRENCY = readEnvMaxProviderConcurrency();
export const providerConcurrencyGate = createBoundedSemaphore(
  RESOLVED_MAX_PROVIDER_CONCURRENCY,
);
```

### acquire / release semantics + queue handoff (the contract the implementer builds)

- Internal state: `let inFlight = 0;` and `const queue: Array<(release: ReleaseFn) => void> = [];`
  (the array of pending `resolve` callbacks).
- `acquire()`:
  - If `inFlight < cap`: increment `inFlight`, return a resolved promise carrying a
    fresh `makeRelease()`.
  - Else: return a new promise; push its `resolve` onto `queue` (tail). The caller
    blocks until a holder releases and hands it the slot.
- `makeRelease()` returns a **single-use, idempotent** release fn (guarded by a
  captured `let released = false;`):
  - On first call: if `queue` is non-empty, **shift** the head waiter (strict FIFO) and
    resolve it with a fresh `makeRelease()` — the slot transfers directly to the next
    waiter, `inFlight` stays constant (no decrement-then-reincrement race). If the queue
    is empty, decrement `inFlight`.
  - On any subsequent call: no-op (idempotent — a double-release must not over-credit
    the pool or starve it). This is the key robustness property that makes the
    `finally`-release safe even if a future refactor accidentally releases twice.
- **No setTimeout, no microtask trickery** in the core handoff — `acquire` returns a
  promise, `release` resolves a queued promise synchronously. The event loop schedules
  the woken caller naturally.

### The cap value + config (justification)

- Env name: `MCP_SERVER_MAX_PROVIDER_CONCURRENCY`. Default **5**. Validation identical
  to `readEnvTimeoutMs`: parse base-10 int; `Number.isFinite && >= 1` ⇒ use it, else
  fall back to `DEFAULT_MAX_PROVIDER_CONCURRENCY` (5).
- **Why 5:** the RCA burst peak is ~10 concurrent Edge→MCP requests (≈5 args ×
  up-to-2 families). A cap of 5 splits that peak into **2 waves**. A queued call in the
  second wave waits only ~one provider round-trip (~5s observed), so the argument wall
  stays comfortably under the 30s p95 target. 5 is below Anthropic's concurrent
  tolerance for `claude-haiku-4-5` at this request size (the round-trips that succeeded
  pre-burst were not rate-limited until concurrency climbed toward ~10). Range 5–6 is
  acceptable per the brief; this design fixes the **default** at 5 and leaves the env
  override as the tuning knob (no code change needed to retune in production).
- **Evidence-for-lower-cap check:** I found no evidence in the repo that the provider
  tolerance is below 5 at this request shape — the failures correlate with the ~10
  peak, not with steady-state 5. If the post-merge smoke shows 429 instability at
  cap=5, the env override drops it to 3–4 with zero code change, and that finding feeds
  the deferred retry-after card. **No HALT fired on this point.**
- The resolved cap is exported (`RESOLVED_MAX_PROVIDER_CONCURRENCY`) so the gate test
  asserts max-observed-concurrency `<= RESOLVED_MAX_PROVIDER_CONCURRENCY` against the
  **import**, never a literal 5 (Card-1B lesson, restated in the test plan).

---

## The gate in `callAnthropic` (exact placement)

Current structure (anthropicCall.ts:153–286): key check → build body → `anthropic_call_start`
log → `try { fetch } catch { return failure }` → status branches (429 / !ok) each with a
drain + `return` → `response.json()` (`return` on throw) → extract+parse (`return` on
null) → success log → `return { ok:true }`.

The gate must wrap **the whole provider round-trip including the body reads** (the brief:
"release in a `finally` AFTER the response is consumed/drained"). Because the current
body has many interior `return`s, the implementer restructures the post-key region into
a single `try { acquire …; …all fetch + status + json + parse…; return result } finally
{ release() }`. Exact placement:

```ts
export async function callAnthropic(opts: CallAnthropicOpts): Promise<AnthropicCallResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || apiKey.length === 0) {
    log('warn', 'anthropic_key_missing', { /* …unchanged… */ });
    return { ok: false, reason: 'key_missing' };   // <-- BEFORE acquire: no slot consumed
  }
  const model = readEnvModel();
  const timeoutMs = effectiveTimeoutMs(opts.perToolTimeoutMs);
  const body = { /* …unchanged… */ };
  const promptHash = await sha256Hex(opts.userPrompt);
  log('info', 'anthropic_call_start', { /* …unchanged… */ });

  const startMs = performance.now();
  const fetchImpl = opts.fetchImpl ?? fetch;

  // PER-ISOLATE provider-concurrency cap. Acquire AFTER the key check (a missing
  // key must not consume a slot) and BEFORE the fetch (the slot must cover the
  // actual provider round-trip). Released in finally AFTER the body is consumed
  // or drained on EVERY path (success, 429, !ok, fetch-throw/timeout,
  // json-throw, parse-null) — see the idempotent ReleaseFn.
  const release = await providerConcurrencyGate.acquire();
  try {
    let response: Response;
    try {
      response = await fetchImpl(ANTHROPIC_API_URL, { /* …headers/body/signal unchanged… */ });
    } catch (err) {
      // …existing model_timeout / network_error mapping + log…
      return { ok: false, reason };
    }
    const duration = Math.round(performance.now() - startMs);
    if (response.status === 429) {
      // …existing log… ; await response.text() drain ; return rate_limited
    }
    if (!response.ok) {
      // …existing log… ; await response.text() drain ; return api_error
    }
    let responseJson: unknown;
    try { responseJson = await response.json(); }
    catch { /* …existing log… */ return { ok: false, reason: 'parse_failure' }; }
    const text = extractAnthropicContentText(responseJson);
    const parsed = parseJsonFromContent(text);
    if (parsed === null) { /* …existing log… */ return { ok: false, reason: 'parse_failure' }; }
    const responseHash = await sha256Hex(text ?? '');
    log('info', 'anthropic_call_success', { /* …unchanged… */ });
    return { ok: true, packet: parsed };
  } finally {
    release();
  }
}
```

Release guarantees, path by path (all inside the `try`, so all hit the `finally`):
1. `fetch` throws (incl. `AbortSignal.timeout` → `TimeoutError` → `model_timeout`): caught, `return`, `finally` releases.
2. 429: drain `text()` then `return`, `finally` releases (drain is inside the try, slot held until drained).
3. non-OK (`api_error`): drain `text()` then `return`, releases.
4. `response.json()` throws (`parse_failure`): `return`, releases.
5. parse-null (`parse_failure`): `return`, releases.
6. success: `return`, releases.
7. an *unexpected* throw anywhere in the body (defence-in-depth): propagates, but
   `finally` still releases before it escapes — the slot is never leaked even on a
   programming error. The thrown error then surfaces to the caller exactly as today
   (the cap adds no new catch that would swallow it).

The fetch headers/body/signal, every log event, every `reason` value, and every
`return` shape are **byte-equal** to the current function. The only diff is: (a) the
`acquire`/`try`/`finally`/`release` wrapper around the existing fetch+parse region, and
(b) the import line for `providerConcurrencyGate`.

---

## Queue-bound decision (no unbounded queue growth — HALT-5)

**Decision: rely on the natural bound; add NO explicit queue-depth limit and NO bounded
wait-timeout.**

Justification: the semaphore's waiter queue can only contain callers that are *currently
executing inside the isolate*. Each in-flight HTTP request holds at most one
`callAnthropic` invocation (1:1, confirmed), so the maximum simultaneous waiters is
bounded by the isolate's concurrent in-flight request count — a finite number set by the
Deno runtime / Deploy concurrency, not by anything this module controls. There is **no
path** by which the queue grows without a corresponding live caller; a caller that
times out (`AbortSignal.timeout`) still proceeds through `catch → return → finally →
release`, so its slot is freed and any waiter it was ahead of is handed the slot. The
queue therefore drains deterministically.

Adding an explicit wait-timeout would be **harmful** here: it would convert a queued
(but otherwise healthy) caller into a synthetic failure, *increasing* the `{isError}`
rate the card is trying to reduce, and it would need its own release + test surface for
no benefit. The per-request `AbortSignal.timeout(effectiveMs)` already bounds total
wall time once a slot is held; the brief's intent ("a queued call waits only ~one ~5s
round-trip") is satisfied by the fast handoff, not by a timeout. **No HALT fired** — the
natural bound is documented here and asserted by the queue-drain test.

If a future card proves multi-isolate fan-in needs a hard global ceiling, that is the
deferred retry-after / global-coordination work, explicitly out of scope here.

---

## File changes

- **New:** `mcp-server/lib/providerConcurrency.ts` — the counting semaphore factory
  (`createBoundedSemaphore`), the cap reader (`readEnvMaxProviderConcurrency`), the
  exported resolved cap (`RESOLVED_MAX_PROVIDER_CONCURRENCY`), the module-singleton
  (`providerConcurrencyGate`), and the `DEFAULT_MAX_PROVIDER_CONCURRENCY` constant.
  Pure gate logic; env read isolated in the reader. ~70–95 lines incl. the doc block.
- **Modified:** `mcp-server/lib/anthropicCall.ts` — add one import
  (`providerConcurrencyGate` from `./providerConcurrency.ts`); wrap the existing
  fetch+status+json+parse region (currently ~:182–:285) in
  `const release = await providerConcurrencyGate.acquire(); try { … } finally { release(); }`,
  with `acquire` placed AFTER the `key_missing` early-return. No change to headers,
  body, signal, log events, reasons, or return shapes. Net add ~6–10 lines (the
  wrapper + import) plus indentation of the moved block (the diff looks larger than it
  is because of re-indent; behavior is byte-equal).
- **New:** `mcp-server/tests/providerConcurrency.test.ts` — pure behavioral unit tests
  for the semaphore + the cap reader (tests 1, 3, plus cap-reader validation + cap=1
  edge). ~140–190 lines.
- **New (or appended):** `mcp-server/tests/anthropicCallProviderCap.test.ts` — the
  gate-site behavioral tests via injected `fetchImpl` (tests 2, 4, plus the
  release-on-failure-path checks). New file preferred over editing the existing
  `anthropicNoLogging.test.ts` so the no-logging suite stays focused. ~150–200 lines.
- **Unchanged (byte-equal — explicitly preserved):**
  `mcp-server/tools/classifyArgumentBooleanObservations.ts` (the caller — one
  `callAnthropic` per request, no change), `lib/toolDispatch.ts`, every
  `lib/family[A–G]Anthropic.ts`, every `lib/family[A–G]Prompt.ts`,
  `lib/mcpBooleanObservationSchemaMirror.ts`, `lib/familyABanListScan.ts`,
  `lib/anthropic.ts` (semantic-move), the schemas, the taxonomy, all family
  keys/prompts. No Edge file. No migration. No `package.json`. No `deno.json`
  (the existing `deno test` task already globs `tests/`).
- **Deleted:** none.

---

## API / interface contracts

```ts
// mcp-server/lib/providerConcurrency.ts
export const DEFAULT_MAX_PROVIDER_CONCURRENCY = 5;
export type ReleaseFn = () => void;
export interface BoundedSemaphore {
  acquire(): Promise<ReleaseFn>;
  readonly inFlight: number;   // observability/test only
  readonly waiting: number;    // observability/test only
}
export function createBoundedSemaphore(cap: number): BoundedSemaphore; // throws RangeError if cap < 1 / non-finite
export function readEnvMaxProviderConcurrency(): number;               // env, default 5, >=1 validated
export const RESOLVED_MAX_PROVIDER_CONCURRENCY: number;                // = readEnvMaxProviderConcurrency()
export const providerConcurrencyGate: BoundedSemaphore;                // PER-ISOLATE singleton

// mcp-server/lib/anthropicCall.ts — UNCHANGED public surface:
export async function callAnthropic(opts: CallAnthropicOpts): Promise<AnthropicCallResult>;
// CallAnthropicOpts, AnthropicCallResult, AnthropicFailureReason, the 4 named
// constants, extractAnthropicContentText, parseJsonFromContent, readEnvTimeoutMs,
// readEnvModel, effectiveTimeoutMs — all byte-equal.
```

`callAnthropic`'s signature, return union, and every `reason` are unchanged, so the tool
handler's `errorResult(...)` mapping (classifyArgumentBooleanObservations.ts:457–462) and
all family wrappers compile and behave identically. The `fetchImpl` opt already exists
and is reused for the gate-site test (no new opt added).

---

## Edge cases

- **`cap = 1`:** the semaphore fully serializes provider calls (one at a time, strict
  FIFO). Tested. Useful as the smallest valid setting and as the most aggressive
  production fallback via env.
- **`key_missing`:** the early `return` is BEFORE `acquire`, so a missing-key call
  consumes **no slot** and never enters the queue. Tested (the gate test runs a
  key-missing call concurrently with real-key calls and asserts the missing-key one does
  not reduce the observed throughput / does not hold a permit).
- **`fetch` throws / `AbortSignal.timeout` fires (`model_timeout`):** caught inside the
  `try`; `finally` releases the slot before returning. Tested with a `fetchImpl` that
  throws a `TimeoutError`-named error and a concurrent healthy caller that must then
  proceed.
- **429 / non-OK with body drain:** the drain (`await response.text()`) is inside the
  `try`, so the slot is held until the body is drained, then released in `finally`. A
  waiter is handed the slot only after the drain completes (correct — the connection is
  freed first). Tested.
- **`response.json()` throws / parse-null:** both `return` inside the `try`; `finally`
  releases. Tested.
- **Double-release (defensive):** the returned `ReleaseFn` is idempotent (`released`
  flag); a second call is a no-op and cannot over-credit the pool. Tested directly on
  the semaphore.
- **Empty queue on release:** release decrements `inFlight` (no waiter to hand to). The
  next `acquire` sees `inFlight < cap` and proceeds immediately. Tested via the
  acquire→release→acquire ordering test.
- **All slots free, single caller:** `acquire` resolves on the same microtask (no
  artificial delay); the cap adds no latency when uncontended. Asserted implicitly by
  the no-shape-change + drain tests (uncontended calls return normal responses).
- **Doctrine-constraint edge:** the gate reads NO heat/popularity/engagement/truth
  signal — ordering is pure FIFO arrival; the cap value comes only from env. It cannot
  influence which argument "wins" or any standing band. (cdiscourse-doctrine §1/§3.)
- **Concurrent acquire while at capacity then a release:** the FIFO handoff transfers
  the slot to the head waiter without a decrement-reincrement gap, so `inFlight` never
  briefly drops below the true in-use count (no transient over-admission). This is the
  property the max-observed-concurrency test guards.

---

## Test plan (the operator's 10 — Deno tests)

Run command (the deno.json `test` task already globs `tests/`; the brief's explicit
form):

```
deno test --config mcp-server/deno.json --allow-net --allow-env --allow-read mcp-server/tests/
```

(or `cd mcp-server && deno task test`). `deno check mcp-server/lib/providerConcurrency.ts
mcp-server/lib/anthropicCall.ts` and `deno fmt --config mcp-server/deno.json mcp-server/`
(lineWidth 100, singleQuote, semiColons) must also pass.

Test pattern matches the repo: `import { assertEquals } from 'std/assert/mod.ts';`,
`Deno.test('…', async () => { … })`, `_setLogSinkForTesting` / `_resetLogSinkForTesting`
for log capture, `fetchImpl` injection for the gate site. Each `Deno.env.set` is
restored in a `finally` (the existing tests' pattern).

**`mcp-server/tests/providerConcurrency.test.ts`** (semaphore + cap reader — pure):

- **(T1) Cap bounds concurrent tasks; max observed ≤ cap.** Inject a tracking task into
  the semaphore: each task increments a shared `live` counter on entry, records
  `maxLive = max(maxLive, live)`, awaits a controllable barrier, decrements on exit.
  Launch N (> cap) tasks via `acquire → task → release`. Assert
  `maxLive <= RESOLVED_MAX_PROVIDER_CONCURRENCY` (against the **imported** constant, not
  a literal 5 — Card-1B). Also run a `createBoundedSemaphore(3)` variant to assert the
  bound tracks the injected cap, decoupling the behavioral assertion from the env value.
- **(T3, part) Queued tasks all eventually run + the queue drains.** With N > cap tasks,
  assert every task's body executed exactly once and `semaphore.waiting === 0` and
  `semaphore.inFlight === 0` after all settle (drain proof). Assert strict FIFO: tasks
  complete acquisition in submission order.
- **Cap-reader validation.** `readEnvMaxProviderConcurrency()` returns 5 when env unset;
  returns the parsed value when env is a valid int ≥ 1; falls back to 5 for `'0'`,
  `'-2'`, `'abc'`, empty string, `'2.5'`/non-integer per the int-parse rule (mirror the
  `readEnvTimeoutMs` cases). Restore env in `finally`.
- **`RESOLVED_MAX_PROVIDER_CONCURRENCY` equals the default 5** in the unset-env test
  process (sanity that the exported constant is the validated reader output).
- **(Edge) cap = 1 serializes.** `createBoundedSemaphore(1)`: `maxLive === 1` across N
  tasks; all run; FIFO.
- **(HALT-5 guard) `createBoundedSemaphore(0)` and `(NaN)`/`(Infinity)`/`(-1)` throw
  `RangeError`** — never silently unbounded.
- **(Edge) idempotent release.** Calling the returned `ReleaseFn` twice does not free a
  second slot: at cap=1, acquire A, release A twice, acquire B, acquire C — assert only
  one of B/C is admitted at a time (the double-release did not over-credit).
- **(Purity / ban-list source scan)** `providerConcurrency.ts` source: contains no
  `fetch(`, no `Deno.env` outside `readEnvMaxProviderConcurrency`, no `console.`, and
  none of the doctrine ban tokens in comments/strings (`winner|loser|liar|true|false|
  correct|dishonest|bad faith|truth`), and the word **`per-isolate`** is present while
  the bare word `global` is **not** used to describe the cap.

**`mcp-server/tests/anthropicCallProviderCap.test.ts`** (gate site via `fetchImpl`):

- **(T2) The gate wraps the actual provider fetch, not request parsing.** Inject a
  `fetchImpl` that, on entry, increments a shared `live` counter, records `maxLive`,
  resolves after a released barrier with a minimal valid Anthropic Messages response,
  then decrements. Set `ANTHROPIC_API_KEY` to a fake key and
  `MCP_SERVER_USE_FIXTURE_PROVIDER` unset (so the real path runs). Fire N (> cap)
  concurrent `callAnthropic(...)` calls. Assert `maxLive <= RESOLVED_MAX_PROVIDER_CONCURRENCY`
  — proving the cap is observed at the **fetch** boundary, not merely around parsing.
- **(T3, part) Queued calls drain + return normal responses.** All N `callAnthropic`
  promises resolve `{ ok: true }` with the expected `packet` shape; none rejected; the
  later (queued) calls return the same normal classifier packet as the early ones.
- **(T4) No response-shape change.** A single uncontended `callAnthropic` with the fake
  fetch returns exactly `{ ok: true, packet: {…} }` with the parsed object byte-equal to
  what the same `fetchImpl` would have produced pre-cap (compare against a direct parse
  of the mock body). Failure injections return the exact existing `reason` values
  (`rate_limited` on 429, `api_error` on 500, `model_timeout` on TimeoutError-named
  throw, `network_error` on a generic throw, `parse_failure` on non-JSON / no-object).
- **(Release on failure paths) Slot is freed on every failure.** For each of
  {fetch-throws-timeout, fetch-throws-generic, 429, 500, json-throws, parse-null}: run
  one failing call concurrently with cap-1 semantics (env `MCP_SERVER_MAX_PROVIDER_CONCURRENCY=1`),
  then a second healthy call; assert the second call still resolves `{ ok: true }`
  (proves the failing call released its slot — no deadlock). Restore env in `finally`.
- **(Edge) key_missing consumes no slot.** With `MCP_SERVER_MAX_PROVIDER_CONCURRENCY=1`
  and `ANTHROPIC_API_KEY` deleted, a `callAnthropic` returns `{ ok:false, reason:'key_missing' }`
  immediately AND a concurrent real-key call (key re-set for that call's window via a
  per-call fetchImpl that still needs the key) is not blocked — assert the missing-key
  call never entered the semaphore (observable: `providerConcurrencyGate.inFlight`
  stays 0 during the missing-key call, or the healthy call's `maxLive` is unaffected).
- **(T6) Provider failure envelopes remain sanitized.** On the 429/500/timeout paths the
  returned `AnthropicCallFailure` carries only `{ ok:false, reason }` (+ optional
  `detail` where the existing code sets it — it does not for these paths). No raw body,
  no header, no key in the failure object. Capture logs via `_setLogSinkForTesting` and
  assert the fake key never appears in any line (mirrors `anthropicNoLogging.test.ts`).
- **(T7) No secret / raw payload in logs or returned detail.** Reuse the
  `anthropicNoLogging` pattern across the cap-wrapped success + every failure path: the
  fake `sk-ant-…` key, the `x-api-key` header value, the raw prompt text, and the raw
  response body text must NOT appear in any captured log line or in the returned result.
  Plus a **source scan** of `anthropicCall.ts`: still no `console.log` of
  `Authorization` / `x-api-key` / `ANTHROPIC_API_KEY` (the existing
  `anthropicNoLogging.test.ts` already asserts this for `anthropicCall.ts`; this card's
  edit must keep it green — no new assertion needed, but the suite re-runs).

**Regression coverage (T5, T8, T9, T10) — existing suites re-run, no new files:**

- **(T5) No prompt/key/family behavior change.** The existing
  `classifyArgumentBooleanObservationsSourceScan.test.ts` (imports familyAAnthropic,
  routes through callAnthropic, no `src/features/*`, no scaffold language) and the
  family A–G prompt/key/taxonomy suites re-run unchanged and stay green — the edit
  touches none of those files. Add one source-scan assertion in the providerConcurrency
  test that `anthropicCall.ts` still imports `./providerConcurrency.ts` and still calls
  the gate's `acquire()` (positive proof the gate is wired), symmetric to the existing
  "routes through callAnthropic" scan.
- **(T8) Existing hosted MCP smoke/parity tests still pass.** The full
  `deno test mcp-server/tests/` suite (incl. toolDispatch, schema-mirror parity,
  ban-list scan) re-runs green. (Live hosted smoke is the SEPARATE post-merge SPEND
  gate, not part of this card's non-spend tests.)
- **(T9) Existing A–G family tests still pass.** The family A–G Deno suites re-run
  green (no family file edited).
- **(T10) No H/I/J enablement.** No file under this card adds, references, or flips a
  Family H/I/J key, prompt, taxonomy, or supported-family entry. A source scan in the
  providerConcurrency test asserts the new module contains no `Family H|family-h|H/I/J`
  enablement token (defensive — the module is concurrency-only).

**Forecast:** +14 to +20 tests (T1-T4 + cap-reader cases + cap=1 + RangeError guard +
idempotent release + per-failure-path release ≈ 6 + key-missing + sanitized-envelope +
no-secret + source/purity/ban/wiring scans). Comfortably inside the +10..+25 band; well
under the +50 HALT.

---

## Dependencies (cards / docs / files)

- Reads `mcp-server/lib/anthropicCall.ts` at `callAnthropic` (the single shared
  provider chokepoint for families A–G and the semantic-move path — gating here covers
  every round-trip with one edit) and reuses its existing `fetchImpl` opt + the
  `readEnvTimeoutMs` validation idiom for the cap reader.
- Reads (as precedent only, not imported)
  `supabase/functions/_shared/booleanObservations/boundedConcurrencyRunner.ts` for the
  pure-injectable-task / max-observed-concurrency test shape and the HALT "never
  silently unbounded" `RangeError` guard.
- Reuses the test harness from `mcp-server/tests/anthropicNoLogging.test.ts`
  (`_setLogSinkForTesting`, `fetchImpl` injection, env save/restore in `finally`) and
  `familyABanListScan.test.ts` (the `std/assert/mod.ts` import + `Deno.test` shape).
- Assumes the MCP-021C A–G families are production-enabled (they are, per CLAUDE.md head
  and the recent merges) so the post-merge A–G burst smoke is meaningful.
- **Blocks / feeds:** the deferred `OPS-MCP-SERVER-RETRY-AFTER-PROTOCOL` is filed ONLY
  if the post-merge smoke verdict is PARTIAL (per-isolate cap insufficient / p95 30–45s).
  Re-surfacing Gate H (Family H resume) waits on a PASS verdict or explicit residual-risk
  acceptance.

---

## Risks

- **Per-isolate vs global (topology):** if Deploy runs many isolates, N isolates ×
  cap=5 can still exceed Anthropic tolerance. Mitigated by honest wording + the
  post-merge smoke as the decider; the env knob lets the operator drop the per-isolate
  cap without a code change. The true global ceiling, if needed, is the deferred card —
  NOT slipped in here (HALT-10: no "global cap" claim without single-instance proof).
- **Cap starving under sustained (not bursty) load:** at steady-state load above 5
  concurrent/isolate, queued calls could approach the per-request timeout. The
  per-request `AbortSignal.timeout` still bounds wall time, and the smoke's p95<30s gate
  catches starvation; the finding would feed the retry-after card. The design does NOT
  add a wait-timeout (which would manufacture failures — see the queue-bound decision).
- **Missed release → deadlock:** the single highest-impact failure mode for any
  semaphore. Mitigated three ways: (a) `release` is in a `finally` that covers every
  return + any unexpected throw; (b) the `ReleaseFn` is idempotent so a double-release is
  harmless; (c) an explicit per-failure-path release test (one failing call must not
  block a subsequent healthy call at cap=1). If the implementer ever moves a `return`
  outside the `try`, the cap=1 release test fails loudly.
- **Re-indent diff noise:** wrapping the existing block in a `try` re-indents ~100
  lines, making the diff look large. The reviewer should diff with whitespace-insensitive
  view; behavior (headers, body, signal, logs, reasons, returns) is byte-equal. Called
  out so the reviewer doesn't read re-indent as behavior change.
- **`deno fmt` churn:** the new file + the re-indented block must pass `deno fmt`
  (lineWidth 100, singleQuote, semiColons). Run `deno fmt` before committing the
  implementation.
- **No `package.json` / `deno.json` change needed** — the `test` task already globs
  `tests/`; if the implementer believes a config change is required, that is an operator
  check-in point (the brief gates `package.json` changes on operator approval).

---

## Out of scope (explicit — reduces scope creep)

- **No retry-after protocol** (no `Retry-After` header parse, no backoff, no retry loop)
  — deferred to `OPS-MCP-SERVER-RETRY-AFTER-PROTOCOL`.
- **No Edge change** — `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`, the Edge
  `boundedConcurrencyRunner`, the booleanObservation request builder, the
  `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` map: untouched.
- **No Family H/I/J** enablement, key, prompt, taxonomy, or supported-family entry.
- **No prompt / taxonomy / family-key / schema-mirror / Source-6 / Edge-flag /
  audit-lint** change.
- **No migration / DB column.** **No `package.json` change.** No new dependency (the
  semaphore is hand-rolled; Deno std is already imported for tests only).
- **No elimination of the `{isError}` envelope class** — the cap reduces its frequency
  under the A–G burst; provider failure typing is preserved exactly.
- **No instrumentation/metrics endpoint** beyond the test-only `inFlight`/`waiting`
  getters (the smoke observes pressure via existing means; a metrics surface is a
  separate concern).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (score is never truth):** the cap touches no scoring path,
  no standing band, no label. It cannot make a claim a "winner"/"loser". Ordering is
  pure FIFO arrival. ✔
- **cdiscourse-doctrine §2/§3 (heat / popularity not evidence):** the semaphore reads
  zero engagement/heat/popularity/velocity signal; the only inputs are env (cap) and
  arrival order. It cannot let amplification influence anything. ✔
- **cdiscourse-doctrine §4 (AI moderator limits):** unchanged — the classifier still
  returns advisory observations with `authoritative:false`; the cap only throttles when
  the existing call fires. No truth verdict added. ✔
- **cdiscourse-doctrine §5 (rules engine sacred / purity):** the gate core logic is pure
  (no Deno.env/fetch/network/console inside acquire/release/handoff); the env read is
  isolated in `readEnvMaxProviderConcurrency`. The rules engine
  (`src/lib/constitution/engine.ts`) is not touched. ✔
- **cdiscourse-doctrine §6 (secrets):** the cap reads only a numeric env
  (`MCP_SERVER_MAX_PROVIDER_CONCURRENCY`); it never reads, holds, logs, or returns
  `ANTHROPIC_API_KEY`, any header, prompt, or response body. The existing logger
  scrubbing is untouched; the no-secret-in-log tests re-run + are extended. ✔
- **cdiscourse-doctrine §7 (no AI calls from production app):** the change is entirely in
  `mcp-server/` (server-side Deno). Nothing under `app/` or `src/` is touched; no new
  client-side provider call. ✔
- **cdiscourse-doctrine §8 (Supabase conventions):** no table, no RLS, no migration. ✔
- **cdiscourse-doctrine §10 (v1 scope):** no voting/winner, no search, no push, no
  OAuth, no public API, no realtime edit. A concurrency cap is none of these. ✔
- **test-discipline:** new pure module gets full behavioral unit coverage (cap bound,
  drain, FIFO, cap=1, RangeError, idempotent release, env validation); the gate gets
  `fetchImpl`-injected behavioral tests + per-failure-path release; ban-list/secret
  source scans; the count goes UP (+14..+20); no `.skip`/`.only`; the cap is asserted
  against the IMPORTED constant, not a literal. ✔
- **Topology honesty (intent binding):** "per-isolate" used throughout; "global" is
  never claimed for the cap; a source-scan test enforces the wording in the module. ✔

---

## HALT triggers (restated from the intent — none fired in this design)

1. Cap implemented Edge-side instead of server-side — **NO**, the gate is inside
   `mcp-server/lib/anthropicCall.ts`.
2. Retry-after schema / Edge protocol change added — **NO**, explicitly out of scope.
3. Any prompt/taxonomy/family-key/schema-mirror/Source-6/Edge-flag/audit-lint change —
   **NO**.
4. Migration / DB column — **NO**.
5. Unbounded queue growth — **NO**, natural bound documented + drain test; no unbounded
   queue, no explicit wait-timeout that would manufacture failures.
6. A broad retry added — **NO**.
7. Family H touched — **NO**.
8. Classifier response shape changed — **NO**, `callAnthropic` return union byte-equal.
9. A secret / raw payload reachable in log/detail — **NO**, the cap touches none; tests
   extend the no-secret coverage.
10. "Global cap" claimed without single-instance proof — **NO**, "per-isolate"
    throughout, enforced by a source-scan test.
11. Forecast > +50 — **NO**, forecast +14..+20.

**No HALT fired.** The design is server-cap only, inside the single shared `callAnthropic`
chokepoint, with an env-configurable per-isolate cap (default 5, asserted via import),
no unbounded queue, no retry, no Edge/family/schema/migration change.

## Reviewer focus (restated from the intent — the 8 the operator wants checked)

1. Cap is **server-side** (in `mcp-server/lib/anthropicCall.ts` via
   `providerConcurrency.ts`), **not Edge**.
2. The cap bounds the **actual provider fetch** — `acquire` is before the `fetch`,
   `release` in a `finally` after the body is consumed/drained; verified by the
   `fetchImpl`-injected max-observed-concurrency test (T2), not just request parsing.
3. **No unbounded `Promise.all`** around provider calls — the semaphore is a counting
   acquire/release, not a fan-out; the natural waiter bound is documented + drain-tested.
4. **No broad retry** added — zero retry loops; the `{isError}` envelope class preserved.
5. **No retry-after schema / Edge protocol change** slipped in — out of scope; HALT-2.
6. **No family/prompt/taxonomy/schema behavior change** — every family/prompt/schema
   file byte-equal; source scans + parity suite re-run.
7. **Secrets + raw provider/model payloads excluded** from logs and returned detail —
   the cap touches none; no-secret tests extended; logger scrubbing untouched.
8. **Topology wording honest** — "per-isolate" everywhere; "global" never claimed for
   the cap unless single-instance is proven (it is not); source-scan test enforces it.

## Operator steps (if any)

**None for the merge** — pure server-side code change. `MCP_SERVER_MAX_PROVIDER_CONCURRENCY`
has a safe default (5), so no env must be set for the cap to take effect; the operator
MAY set it later to retune without a code change. The hosted MCP server redeploys via
the existing pipeline on merge (no manual `functions deploy` / `db push`). The
**post-merge smoke is a separate, operator-gated SPEND gate** (canary-first + a tight
A–G burst; PASS = full A–G coverage under burst + no H/I/J + no dup + no secret leak +
nonblocking + p95<30s) — that is run after this card merges, per the intent §"Post-merge
smoke".
