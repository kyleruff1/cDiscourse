# OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL — Topology-aware global provider-capacity control

> ⛔ **SUPERSEDED / REJECTED-ALTERNATIVE (2026-05-30).** This design (**Option A** — a Deno-KV
> real-time admission limiter *inside the MCP server hot path*) is **SOUND but NOT the chosen
> path.** It is superseded by the **Postgres-backed async classifier queue** in
> `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` (ARCH-001). Retained in
> full for the record and for harvest. **Do NOT implement this doc.**
>
> **Harvest forward (concepts, not the KV mechanism):** the typed `provider_capacity_exhausted`
> sub-reason; the failure-detail sanitizer rules; the doctrine self-check structure; and the
> retry-after → `available_at` concept (in B the drainer reschedules retryable failures via
> `available_at` with a bounded backoff whether or not the MCP server returns a precise
> retry-after — surfacing a server retry-after is OPTIONAL in B). **Phase-0 topology findings
> TRANSFER and are NOT re-derived in B:** dynamic multi-isolate Deno Deploy, per-isolate in-memory
> state, Deno KV as the cross-isolate primitive, and the **15s Edge→MCP fetch timeout** as the
> binding deadline.
>
> **Why B over A (recorded — do not re-litigate):** (1) A's biggest residual risk is the **15s
> tail** (~2s slot-wait + ~13s p95 Anthropic round-trip ≈ 14.9s, right at the Edge→MCP abort) — B's
> drainer is **off the submit-path 15s clock**; (2) A's global bound is **SOFT** under cross-region
> KV consistency and **FAILS OPEN** (stops limiting) under KV slowness — B's control is a
> **linearizable Postgres queue**; (3) A modified the byte-equal-verified `callAnthropic` path and
> required an **MCP-server redeploy** — B touches the MCP server provider path **ZERO times**.
> The "confirm Deno KV provisioned" pre-flight from A is **retired** (no KV in B).

**Status:** SUPERSEDED — rejected alternative (Option A: in-MCP-server Deno-KV admission limiter), retained for record + harvest. **Chosen path: ARCH-001 (Postgres async classifier queue).** DESIGN ONLY — never implemented.
**Epic:** Epic 12 / MCP semantic-referee track (server-runtime capacity control)
**Release:** Stage 2B successor (server-runtime + Edge-retry change; supersedes #371 per-isolate cap and #365/#368 Edge static-backoff)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/373
**Supersedes:** #371 (per-isolate cap: cap=5 PARTIAL, cap=2 FAIL), the residual burst-`{isError}` concern of #365, the abandoned static-backoff retry of #368
**Pre-Family-H gate:** Family H (BOTH production AND admin design) stays FROZEN until this card passes production-path verification or an explicit Gate H risk acceptance (operator binding, 2026-05-30).

> This design integrates a global (cross-isolate) provider-call limiter and a server-driven
> retry-after as ONE coherent control loop. It is bounded by the issue body + the Phase 0
> comment. Where this doc and the issue could be read differently, the issue wins. This card
> does NOT touch: prompt / taxonomy / family-key / schema-mirror / Source 6 / audit-lint /
> production-flag / `package.json`. It does NOT do Family H/I/J work. It preserves the kept
> work from the prior chain (bounded Edge parallelism limit 2, typed `{isError}` detection
> from #365 Phase 3, safe diagnostics).

---

## Phase 0 — topology confirmation (settled inputs; do not re-litigate)

These are confirmed in the issue's Phase 0 comment via Deno's own docs + the cap=5/cap=2 smoke
evidence + the local code. They are the fixed premises of this design:

- **Q1 — Multiple isolates per production app? YES.** Deno Deploy runs "an appropriate number
  of isolates per deployment, spread out across multiple runners," chosen by CPU/memory load,
  across 30+ anycast edge regions. The isolate count is **dynamic** and has cold-start lag.
- **Q2 — In-memory process state shared or per-isolate? PER-ISOLATE.** Isolates "do not share
  CPU, memory, or disk." The `mcp-server/lib/providerConcurrency.ts` semaphore is a
  module-singleton living in ONE isolate's closure — invisible cross-isolate. **Deno KV is the
  documented cross-isolate shared-state primitive, with atomic check-and-set transactions.**
- **Q3 — Can a burst hit multiple isolates? YES.** The edge proxy spreads concurrent requests
  across isolates/runners by load.
- **Why both smokes failed:**
  - **cap=5 PARTIAL** — the ~10-wide burst spread across a few isolates, each admitting 5 →
    global concurrent Anthropic ~10–15 → `{isError}` (`mcp_api_error`) NOT reduced (~5/35),
    and the per-isolate queue added latency (p95 37.61s, 30–45s warning band).
  - **cap=2 FAIL** — the burst concentrated on a few warm isolates (scale-up lag) → deep
    per-isolate queues → the **15s Edge→MCP fetch timeout** fired before slots opened →
    `mcp_network_error` clustered 15.08–15.46s, **8/35** cells, 27 terminal holes,
    `retryHeals=0` (the 2s retry re-entered the same saturated queue).
- **Binding timeout link.** `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15000`
  (`supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts:56`,
  applied via `AbortSignal.timeout`) is the **tightest** deadline. The MCP server's own
  `MCP_SERVER_REQUEST_TIMEOUT_MS=30000` / `MCP_SERVER_MODEL_TIMEOUT_MS=25000` are looser and
  NOT binding. The global-limiter slot-wait + the Anthropic round-trip must fit inside 15s, OR
  the 15s Edge timeout must be raised (latency tradeoff — addressed in §"15s Edge deadline").

**Settled conclusion:** a per-isolate in-memory semaphore is structurally incapable of bounding
GLOBAL provider concurrency under dynamic multi-isolate fan-in. The control point must be a
**shared layer (Deno KV)**. This card builds that.

---

## Problem statement (tied to the cap-curve evidence)

| cap | mechanism | failure | success | latency | verdict |
| --- | --- | --- | --- | --- | --- |
| uncapped (#368) | global Anthropic overload | `mcp_api_error` `{isError}` ~4 | 33/35 | p95 ~38s | baseline |
| **5** | per-isolate queue; global still overloads | `mcp_api_error` ~5 (NOT reduced) | 33/35 | **p95 37.61s** | **PARTIAL** |
| **2** | per-isolate queue starves vs 15s Edge timeout | **`mcp_network_error` 53 @ 15.08–15.46s** | **8/35**, 27 holes | mass timeout | **FAIL** |

The knob in #371 controls **per-isolate, in-memory** concurrency. The failure is driven by
**global** concurrency across an unknown isolate count **AND** a fixed external 15s request
deadline. There is no per-isolate value that satisfies both run-completeness and latency. The
durable fix has two coupled requirements that this design treats as ONE control loop:

1. **Bound GLOBAL provider concurrency** (so the summed-across-isolates Anthropic load can't
   overload → kills the cap=5 `{isError}` class).
2. **Never host a deep in-request queue** (so a denied call fails FAST with a typed, retryable
   envelope rather than starving against the 15s deadline → kills the cap=2 timeout class).
   The retry that heals the denied call must run in the Edge background (`waitUntil`), driven by
   a **server-supplied** `retryAfterMs` (not a guessed static backoff — that is exactly what
   #368 proved wrong), so submit stays nonblocking.

---

## Chosen control-loop architecture

**Control point: the MCP server owns the global limiter, backed by Deno KV.** The server is the
single choke point through which every Anthropic round-trip already flows (`callAnthropic`), and
KV is co-located with the server isolates on Deno Deploy. The Edge is the retry actor that
honors the server's backpressure. This is one loop:

```
  ┌──────────────────────────── Edge Function (submit-argument, BACKGROUND via waitUntil) ───────────────────────────┐
  │                                                                                                                   │
  │  submit-argument  ──returns 201 to user IMMEDIATELY (nonblocking; user never waits)──►                            │
  │        │                                                                                                          │
  │        └─► dispatchAutoTriggerForArgument (bounded parallelism: ≤ MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2/arg)   │
  │                 │  per family: classifyOneArgumentCore → runBooleanObservationMcpAdapter                          │
  │                 │                                                                                                 │
  │      ┌──────────▼───────────  ONE Edge→MCP fetch  (AbortSignal.timeout = 15s, the BINDING deadline) ───────┐     │
  │      │                                                                                                      │     │
  │      │                          ┌───────────────────── MCP server (any isolate) ───────────────────────┐   │     │
  │      │   POST /mcp/adapter-     │ handleClassifyArgumentBooleanObservations                             │   │     │
  │      │   compat {tool,input} ──►│   Step 1 validate · Step 2 resolve family · Step 3 PROVIDER CALL ◄─┐  │   │     │
  │      │                          │                                                                    │  │   │     │
  │      │                          │   ┌─ NEW: tryAcquireGlobalProviderSlot(KV) ──────────────────────┐ │  │   │     │
  │      │                          │   │  atomic CAS on KV counter, max-wait budget ≈ SLOT_WAIT_MS    │ │  │   │     │
  │      │                          │   │  (~2000ms, well under 15s) with lease/TTL                    │ │  │   │     │
  │      │                          │   │   • slot acquired  ──► callAnthropic (≈ one ~5s round-trip) ─┘ │  │   │     │
  │      │                          │   │   • no slot in budget ──► return CAPACITY ENVELOPE:           │  │   │     │
  │      │                          │   │       { isError:true, reason:'capacity_exhausted',           │  │   │     │
  │      │                          │   │         retryAfterMs:<bounded> }   (NO prompt/body/secret)    │  │   │     │
  │      │                          │   │   • KV unavailable/slow ──► FAIL OPEN: proceed to provider   │  │   │     │
  │      │                          │   └──────────────────── release slot (decrement / lease-expiry) ─┘  │   │     │
  │      │                          └────────────────────────────────────────────────────────────────────┘   │     │
  │      └───────────────────────────────────────────────────────────────────────────────────────────────────┘     │
  │                 │                                                                                                 │
  │   adapter: isServerErrorEnvelope(extracted)===true                                                               │
  │     • reason:'capacity_exhausted'  → unavailable{reason:'api_error', subReason:'provider_capacity_exhausted',    │
  │                                        retryAfterMs}  (NEW; carried on api_error so existing detection holds)     │
  │     • else (existing {isError})    → unavailable{reason:'api_error', subReason:'provider_server_error'}           │
  │                 │                                                                                                 │
  │   dispatcher retry loop (MAX_ATTEMPTS=2):                                                                         │
  │     • capacity_exhausted + retryAfterMs present → wait SERVER-DRIVEN retryAfterMs (clamped), then 1 retry        │
  │     • mcp_network_error / mcp_api_error(server_error) → existing static RETRY_BACKOFF_MS=[2000,8000]             │
  └───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  TIME BUDGET on the binding path:  SLOT_WAIT_MS (~2000ms)  +  Anthropic round-trip (~5000ms p50, ~8000ms tail)
                                     ───────────────────────────────────────────────────────────────────────────
                                     must stay < 15000ms (the Edge AbortSignal).  Headroom: ~5–8s. (see §"15s deadline")
```

**Why the MCP server, not the Edge, owns the limiter:** the Edge is ALSO multi-isolate (Supabase
Edge runtime), so an Edge-side limiter needs the same shared store and would have to be reached
by every Edge isolate. The provider round-trip is a server concept (the server holds the
`ANTHROPIC_API_KEY`, the model timeout, the family providers); admission control belongs adjacent
to the resource it protects. The server already produces `{isError}` envelopes that the Edge
already detects (`isServerErrorEnvelope`, #365 Phase 3) — emitting a `capacity_exhausted` variant
reuses an existing, proven detection path with zero new transport contract. **The in-memory
per-isolate semaphore (`providerConcurrency.ts`) is explicitly rejected as the final fix** — Phase
0 + both smokes prove it cannot bound global concurrency. (See §"Disposition of the per-isolate
semaphore" for whether it is removed or demoted.)

---

## Data model / KV key design + atomic ops + lease/TTL

**No SQL data model. No migration. No DB column.** The only persistent shared state is in Deno
KV, co-located with the MCP server isolates. (The Edge `retryAfterMs` consumption is transient,
in the background promise.)

### KV mechanics — chosen mechanism: leased-slot set (atomic CAS), not a bare counter

A bare atomic integer counter (`increment on acquire`, `decrement on release`) is the obvious
design but has a fatal leak: **if an isolate dies/times out between increment and decrement, the
permit is leaked forever** and the global ceiling silently ratchets down toward zero — which would
recreate the cap=2 starvation FAIL over time. The Phase-0 requirement is explicit: a slot must be
**reliably released, including on crash/timeout, via TTL/lease expiry.** Therefore the design uses
a **leased-slot set** with self-expiring permits:

- **Key space (one logical namespace):**
  - `["provider_slot", <slotToken>]` — one KV entry PER held permit. `slotToken` is a
    crypto-random id minted by the acquiring isolate. Value: a small struct
    `{ acquiredAt: number }` (epoch ms; diagnostic only — no body, no prompt, no secret).
    Each entry is written with `expireIn: SLOT_LEASE_TTL_MS` so a died/timed-out isolate's
    permit **auto-expires** (KV deletes it) — no leak.
  - The live-permit count is the count of non-expired `["provider_slot", …]` entries.

- **Acquire (atomic CAS, bounded retry within the wait budget):**
  1. `list({ prefix: ["provider_slot"] })` to count live permits (expired entries are already
     gone from KV's view). If `liveCount >= GLOBAL_PROVIDER_CONCURRENCY` → no slot now.
  2. If under cap, `atomic()` transaction: `.check(...)` the slots observed in step 1 are
     unchanged (versionstamp guard on a small **head-marker key** — see below) AND
     `.set(["provider_slot", slotToken], {acquiredAt}, { expireIn: SLOT_LEASE_TTL_MS })`.
     `.commit()`. If the commit's `ok===false` (another isolate raced and changed the marker),
     **re-read and retry** within the remaining budget.
  3. If no slot opens within `SLOT_WAIT_MS` (the budget), STOP retrying and signal
     `capacity_exhausted` to the caller. **Never block past the budget.**

  **Head-marker for CAS contention:** atomic `list` has no single versionstamp, so the design
  uses a dedicated `["provider_slot_marker"]` key bumped (its value/versionstamp changes) inside
  the SAME atomic commit as every acquire/release. The acquire transaction `.check`s the marker
  versionstamp read at count time; a concurrent acquire/release that changed the marker forces a
  bounded re-read. This is the documented Deno-KV optimistic-concurrency pattern (read
  versionstamp → check in atomic → commit → retry on conflict). Contention retries are capped by
  a small attempt count AND the overall `SLOT_WAIT_MS` budget, whichever first.

- **Release:** delete `["provider_slot", slotToken]` and bump the marker in one atomic commit.
  Release is best-effort: if the delete commit fails, the lease TTL still reclaims the permit.
  This is the crash-safety backstop — **correctness does not depend on release succeeding.**

- **Tuning constants (all CODE constants in a dedicated pure module — auditable, rollback-via-PR;
  NOT env vars where a runtime flip could silently unbound the system, mirroring the
  `autoTriggerConcurrency.ts` D1 rationale). A single optional env override may gate the cap VALUE
  only (like `MCP_SERVER_MAX_PROVIDER_CONCURRENCY` does today) — see §"Open questions":**
  - `GLOBAL_PROVIDER_CONCURRENCY` — the global ceiling. **Proposed start: 6.** Rationale: the
    failing burst drives ~10 concurrent provider calls; cap=5-per-isolate left global ~10–15 and
    overloaded. A GLOBAL 6 caps total Anthropic in-flight at 6 regardless of isolate count — below
    the overload threshold the uncapped/cap=5 runs hit, while high enough that a single argument's
    ≤2 families and a modest burst still drain quickly. This is a starting value; the smoke
    (verdict bands below) tunes it. **It must be a GLOBAL number, distinct in meaning from the
    old per-isolate 5.**
  - `SLOT_WAIT_MS` — max wait for a slot. **Proposed: 2000ms.** Justification in §"15s deadline".
  - `SLOT_LEASE_TTL_MS` — permit auto-expiry. **Proposed: 30000ms** (> the server's 25s model
    timeout + headroom, so a permit covering a real in-flight call is never reclaimed mid-call,
    but a died isolate's permit is reclaimed within one model-timeout window). Must be
    `> MCP_SERVER_MODEL_TIMEOUT_MS` and comfortably `> SLOT_WAIT_MS + Anthropic round-trip`.
  - `KV_OP_TIMEOUT_MS` — per-KV-operation timeout. **Proposed: 250ms.** A KV op that exceeds this
    triggers FAIL-OPEN (proceed to the provider without a slot) — see §"Edge cases / KV
    unavailable". This bounds the limiter's own latency contribution.

### KV read/write latency + consistency (eventual cross-region) and its effect on correctness

Deno KV reads default to eventual consistency cross-region; atomic transactions are strongly
consistent within a region and use optimistic concurrency globally. Implications, designed-for:

- **The cap is a SOFT global bound, not a hard mutex.** Eventual cross-region read lag means two
  far-apart isolates can briefly both observe `liveCount = cap-1` and both acquire, transiently
  exceeding the cap by a few permits. **This is acceptable and intended** — the goal is to keep
  global Anthropic concurrency in a SAFE BAND (≈6, not ≈15), not to enforce a razor-exact mutex.
  A transient overshoot to 7–8 is far below the overload threshold; the cap=5 FAIL was ~10–15.
  The lease TTL guarantees overshoot self-heals. The design MUST NOT add cross-region locking to
  chase exactness — that would reintroduce the latency the 15s deadline cannot absorb.
- **Marker CAS keeps SAME-region contention correct.** Within a region (where most burst load
  concentrates on the warm isolates — the cap=2 concentration finding), the marker versionstamp
  check serializes acquires so the count is not double-spent. Cross-region is the only place
  overshoot occurs, and it is bounded + self-healing.
- **Latency budget:** a KV `list` + atomic `commit` is single-digit-to-low-tens of ms typical.
  `KV_OP_TIMEOUT_MS=250` bounds the worst case; the `SLOT_WAIT_MS=2000` budget absorbs a few
  contention re-reads. The limiter's latency contribution stays well inside the 15s deadline.

### Failure mode if KV itself is slow/unavailable — FAIL OPEN (hard constraint)

**If KV is unavailable, slow (> `KV_OP_TIMEOUT_MS`), or throws, the limiter FAILS OPEN: it
proceeds to call the provider WITHOUT a slot, and never returns `capacity_exhausted` on that
path.** Rationale: the worst case of fail-open is a temporary return to the uncapped baseline
(~33/35, p95 ~38s) — degraded but functioning. The worst case of fail-closed (deny on KV error)
is the cap=2 mass-incompleteness FAIL. **Degrading to "no limiter" beats degrading to "deny
everything."** This also guarantees the limiter can NEVER block submit (submit is already
nonblocking; even the background classify must not hang on KV). The fail-open path is a first-class
tested branch (test plan T-LIM-FAILOPEN).

---

## File changes

New files (mcp-server/ — the limiter + its constants):

- `mcp-server/lib/globalProviderLimiter.ts` (NEW, ~180–230 lines) — the Deno-KV-backed global
  limiter. Exports:
  - `acquireGlobalProviderSlot(opts?): Promise<GlobalSlotAcquisition>` where
    `GlobalSlotAcquisition = { acquired: true; release: () => Promise<void> } | { acquired: false; reason: 'capacity_exhausted'; retryAfterMs: number } | { acquired: true; release: () => Promise<void>; degraded: 'kv_unavailable' }`.
    (Fail-open returns `acquired:true` with a no-op release + a `degraded` marker for the log
    line; the caller proceeds.)
  - A `kvFactory?: () => Promise<Deno.Kv>` injection point so tests pass a fake/in-memory KV (no
    real KV, no `--unstable-kv` requirement in the unit test where a fake is injected; the
    integration test that exercises real `Deno.openKv()` is separately tagged).
  - Pure helpers split out for unit testing WITHOUT KV: `computeRetryAfterMs(observedWaitMs,
    capPressure)`, `isUnderCap(liveCount, cap)`, lease-TTL/marker key builders. These follow the
    `providerConcurrency.ts` precedent (pure core + thin env/IO seam).
- `mcp-server/lib/globalProviderLimiterConstants.ts` (NEW, ~25–40 lines) — the four tuning
  constants above as exported CODE constants with doc comments (mirrors
  `autoTriggerConcurrency.ts`'s "constant not env" rationale). Zero imports → importable by both
  the limiter and the tests.

Modified files (mcp-server/):

- `mcp-server/lib/anthropicCall.ts` (MODIFY, ~+25/-8 lines) — **replace** the per-isolate
  `providerConcurrencyGate.acquire()` (lines 186–192, 295–297) with the global limiter acquire.
  On `acquired:false` (capacity), `callAnthropic` returns a NEW typed failure
  `{ ok:false, reason:'capacity_exhausted', retryAfterMs }` (extend `AnthropicFailureReason` with
  `'capacity_exhausted'` and `AnthropicCallFailure` with an optional `retryAfterMs?: number`). On
  `acquired:true`, behavior is byte-identical to today (fetch, status mapping, parse), with the
  global `release()` in the `finally` (now async — `await release()` or fire-and-forget with a
  `.catch`). The key-missing fast-reject still happens BEFORE acquire (a missing key must not
  consume a slot — preserved).
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` (MODIFY, ~+8/-2 lines) — at Step 3
  (lines 448–463), when the Anthropic call returns `reason:'capacity_exhausted'`, return
  `errorResult('capacity_exhausted', <message>, { retryAfterMs })`. This is the typed server
  backpressure envelope. NO other Step changes; the existing `provider failed` branch handles all
  other reasons unchanged. (The semantic-move tool, `classifySemanticMove.ts`, also routes through
  `callAnthropic`; it will see the same new failure reason. Its envelope mapping is reviewed for
  parity but the boolean-observation auto-trigger is the only PRODUCTION consumer this card
  verifies — see §"Out of scope".)
- `mcp-server/deno.json` (MODIFY, ~+1 line in the `test` task) — add `--unstable-kv` to the
  `deno test` task IF the real-KV integration test needs it. The unit tests inject a fake KV and
  do not. **This `deno.json` touch is flagged in the HALT self-eval** (it is the MCP server's own
  manifest, not the root `package.json` the issue restricts; but any manifest change is surfaced).

Modified files (supabase/functions/_shared/booleanObservations/ — Edge detection + typing + retry):

- `booleanObservationFailureSubreason.ts` (MODIFY, ~+4 lines) — add the NEW sub-reason value
  `'provider_capacity_exhausted'` to the `BooleanObservationFailureSubreason` union (in the
  `provider/transport` group) AND to `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS`. No mapping
  function change is required (the value is set directly at the adapter site, like
  `provider_server_error`). The ban-list + exhaustiveness tests pick it up automatically.
- `booleanObservationMcpAdapterCore.ts` (MODIFY, ~+6/-1 lines) — extend
  `BooleanObservationAdapterResult.unavailable` with an OPTIONAL `retryAfterMs?: number` (additive;
  `reason`/`subReason`/`detail` unchanged). This carries the server-supplied retry hint up to the
  dispatcher.
- `booleanObservationMcpAdapter.ts` (MODIFY, ~+14 lines) — inside the existing
  `isServerErrorEnvelope(extracted)` branch (lines 223–235), BEFORE the generic
  `provider_server_error` mapping, detect `extracted.reason === 'capacity_exhausted'` and map to
  `{ kind:'unavailable', reason:'api_error', subReason:'provider_capacity_exhausted', retryAfterMs:<clamped> }`.
  `retryAfterMs` is read from `extracted.retryAfterMs` ONLY if it is a finite number, then CLAMPED
  to `[RETRY_AFTER_MIN_MS, RETRY_AFTER_MAX_MS]` (see §"Edge retry-after"). Carrying it on the
  EXISTING `api_error` reason means `unavailableReasonToFailureReason` still yields
  `mcp_api_error` (already in `RETRYABLE_FAILURE_REASONS`) — zero change to the retryable set, the
  existing detection holds. The sub-reason is what distinguishes capacity from a generic server
  error in the logs + in the dispatcher.
- `classifyArgumentCore.ts` (MODIFY, ~+2 lines) — thread the new `retryAfterMs` off the adapter
  result onto `PerArgumentSummary` (add optional `retryAfterMs?: number`, set it on the
  adapter-unavailable branch next to `failureSubReason`/`failureDetail`). Additive; `failureReason`
  unchanged.
- `autoTriggerDispatcher.ts` (MODIFY, ~+18/-3 lines) — in `dispatchOneFamilyIteration`'s retry
  loop, when the terminal summary's `failureSubReason === 'provider_capacity_exhausted'` AND
  `retryAfterMs` is present, use that SERVER-SUPPLIED value as the backoff before the retry
  (clamped, see below) INSTEAD of the static `RETRY_BACKOFF_MS[attempt-1]`. All other retryable
  reasons keep the static schedule. `MAX_ATTEMPTS` (2) and the success-only idempotency guard are
  unchanged. The `emitAutoTriggerLog` failure line gains the `retryAfterMs` field (additive, like
  `failure_sub_reason`/`failure_detail`).

Deleted files: none. (The per-isolate semaphore's disposition is in §"Disposition of the
per-isolate semaphore"; the design DEMOTES it rather than deleting it, to keep the change additive
and reversible.)

No change to: any prompt file, any `family*Prompt.ts` / `family*Keys.ts` / `family*BanListScan.ts`,
`mcpBooleanObservationSchema.ts` / `mcpBooleanObservationSchemaMirror.ts` (the schema mirror — see
§"Schema-mirror analysis"), `familyRegistry.ts` (no production-flag flip), Source 6
(`machineObservationPersistenceQuery.ts`), any audit-lint rule, root `package.json`.

---

## API / interface contracts

### Server: the limiter

```ts
// mcp-server/lib/globalProviderLimiterConstants.ts
export const GLOBAL_PROVIDER_CONCURRENCY = 6;   // GLOBAL ceiling (distinct from per-isolate 5)
export const SLOT_WAIT_MS = 2_000;              // max wait for a slot; << 15s Edge deadline
export const SLOT_LEASE_TTL_MS = 30_000;        // permit auto-expiry > model timeout (25s)
export const KV_OP_TIMEOUT_MS = 250;            // per-KV-op timeout → fail-open past this

// mcp-server/lib/globalProviderLimiter.ts
export type GlobalSlotAcquisition =
  | { acquired: true; release: () => Promise<void>; degraded?: 'kv_unavailable' }
  | { acquired: false; reason: 'capacity_exhausted'; retryAfterMs: number };

export async function acquireGlobalProviderSlot(opts?: {
  kvFactory?: () => Promise<Deno.Kv>;   // test injection; defaults to Deno.openKv()
  now?: () => number;                   // test injection for clock
}): Promise<GlobalSlotAcquisition>;

// pure, KV-free, unit-tested directly:
export function computeRetryAfterMs(input: { observedWaitMs: number }): number; // bounded
export function isUnderCap(liveCount: number, cap: number): boolean;
```

### Server: `callAnthropic` failure extension (additive)

```ts
export type AnthropicFailureReason =
  | 'key_missing' | 'model_timeout' | 'api_error' | 'rate_limited'
  | 'network_error' | 'parse_failure'
  | 'capacity_exhausted';                       // NEW
export interface AnthropicCallFailure {
  ok: false;
  reason: AnthropicFailureReason;
  detail?: string;
  retryAfterMs?: number;                        // NEW — present only on capacity_exhausted
}
```

### Server: the typed backpressure envelope (the wire contract)

Emitted by `handleClassifyArgumentBooleanObservations` Step 3 via the existing `errorResult(...)`,
so the shape is the proven `{ isError:true, structuredContent:{ reason, ...extra } }` the Edge
already parses. Concretely, after the `/mcp/adapter-compat` route wraps it (`adapterCompat.ts`
lines 101–106), the Edge receives:

```jsonc
{ "result": { "isError": true, "reason": "capacity_exhausted", "retryAfterMs": 1800 } }
```

- `reason`: the controlled enum literal `"capacity_exhausted"`. (Adapter-compat surfaces `isError`
  + spreads `structuredContent`.)
- `retryAfterMs`: a BOUNDED integer (see computation below).
- **Doctrine §6 — the envelope carries NO raw prompt, NO argument body, NO raw provider payload,
  NO secret, NO auth header.** It is two scalars (`reason`, `retryAfterMs`). This is asserted by a
  source-scan + a behavioral test (T-ENV-SAFE).

### `retryAfterMs` computation + ceiling (server side)

```
retryAfterMs = clamp( SLOT_WAIT_MS + jitter,  RETRY_AFTER_MIN_MS,  RETRY_AFTER_MAX_MS )
```

- The base is `SLOT_WAIT_MS` (the time we already waited tells the caller a slot churns on roughly
  that timescale).
- `jitter`: a small RANDOM additive spread (e.g. `0..500ms`) to **break thundering-herd
  synchronization** (see edge cases). Jitter is the ONLY use of randomness and never affects
  correctness.
- `RETRY_AFTER_MIN_MS = 500`, `RETRY_AFTER_MAX_MS = 4_000`. The ceiling is the hard cap: a single
  background retry waiting ≤4s, plus a ≤15s retry fetch, keeps the per-family healed wall well
  under the p95<30s budget AND avoids the #368 long-backoff latency trap.

### Edge: clamping on receipt (defense-in-depth)

The Edge re-clamps the server-supplied `retryAfterMs` to `[RETRY_AFTER_MIN_MS, RETRY_AFTER_MAX_MS]`
(same constants, defined Edge-side too) because the server value is UNTRUSTED input crossing a
network boundary — a malformed/huge value must never cause the background retry to wait minutes.
A non-finite/absent value falls back to the static `RETRY_BACKOFF_MS[0]` (2000ms), so the capacity
path degrades to the existing behavior rather than breaking.

---

## The 15s Edge deadline — budget justification + whether to raise it

The binding deadline is `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15000`. On the acquired path
the time spent is `SLOT_WAIT_MS (≤2000) + Anthropic round-trip`. Observed Anthropic round-trips for
this haiku classifier: ~3.6–12.9s on successful cells (cap=2 success-wall data), p50 ≈ 5s. So:

- Worst realistic acquired path ≈ `2000 + 12900 ≈ 14.9s` — RIGHT at the edge. **This is the risk
  the design must manage** (see below).
- Typical acquired path ≈ `~50ms (KV) + 5000 ≈ 5s` — comfortable.

**Why `SLOT_WAIT_MS = 2000` and not larger:** the cap=2 FAIL proved that any wait that pushes the
total past 15s converts to a `mcp_network_error` mass-timeout. The whole point of this design is to
**fail FAST with a typed envelope instead of waiting into the timeout.** A 2s wait leaves ~13s for
the round-trip, covering the p50 and most of the tail; the rare tail call that would exceed 15s
even with a fresh slot is a pre-existing condition (the uncapped baseline had model timeouts too),
NOT something the limiter introduces. Going below ~1.5s risks denying calls that a slot would have
served within a normal churn; going above ~3s eats the round-trip headroom. **2000ms is the
defensible midpoint; the smoke can retune within [1500, 3000].**

**Should we ALSO raise the 15s Edge timeout?** **Recommendation: NO, do not raise it in this
card.** Honest weighing:

- FOR raising (e.g. to 20s): gives the rare slow round-trip more headroom, fewer
  `mcp_network_error` on genuinely-slow-but-eventually-successful calls.
- AGAINST (decisive): raising the Edge timeout is exactly the latency lever #368 pulled (static
  long backoff) and it FAILED — it trades completeness for p95, and the verdict band FAILs at
  p95>45s. A longer Edge timeout means a stuck call ties up its slot longer (worsening the very
  contention we're bounding) and pushes `wall_clock_background` toward the 30s PASS ceiling. The
  global limiter attacks the ROOT cause (too many concurrent calls) so the round-trips themselves
  get faster (no provider overload) — that, not a longer deadline, is what brings the tail in.
- **Decision:** keep 15s. If the post-deploy smoke shows the limiter restored completeness but a
  residual handful of cells still hit 15s on genuine slow round-trips, THAT is the (separate,
  evidence-gated) trigger to consider a modest Edge-timeout bump as a follow-up — not a guess made
  now. (Flagged as a deferred operator decision, not done here.)

---

## Disposition of the per-isolate semaphore (`providerConcurrency.ts`)

The global limiter SUPERSEDES the per-isolate semaphore as the admission control. To keep this
card additive and reversible, the design **demotes, not deletes**:

- `anthropicCall.ts` stops calling `providerConcurrencyGate.acquire()` and calls the global limiter
  instead. The per-isolate gate is no longer in the request path.
- `providerConcurrency.ts` remains in the tree (its pure tests still pass) but is no longer
  imported by `anthropicCall.ts`. **The positive-wiring test in `providerConcurrency.test.ts`
  (lines 302–320) asserts `anthropicCall.ts` imports `providerConcurrencyGate` and calls
  `.acquire()` — that test WILL FAIL after this change and MUST be updated** to assert the global
  limiter wiring instead. This is a known, intended test update (test-discipline: count goes up
  net; this is a rewrite of an existing assertion, documented here so the implementer doesn't
  "fix" it by reverting). Flagged in Risks.
- Rationale for demote-not-delete: a clean revert path if the global limiter smoke FAILs and the
  operator wants to fall back; and deleting the file would also force deleting/relocating its whole
  test suite, widening the diff. A follow-up housekeeping card can remove the dead module once the
  global limiter is proven.

---

## Schema-mirror analysis (HALT-class check — surfaced, NOT made)

The card explicitly forbids a schema-mirror change. Analysis:

- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` mirrors the MCP-021A RESPONSE wire shape
  (the validated packet: `schemaVersion`, `observations`, `confidence`, `evidenceSpan`,
  `modelInfo`). The parity test (`mcpBooleanObservationSchemaParity.test.ts`) guards the
  schemaVersion literal, `MAX_EVIDENCE_SPAN_CHARS=240`, `MAX_FLAGS_PER_RESPONSE=20`, and the 6
  validator failure-reason enum values.
- **The capacity envelope is NOT part of that schema.** It is an `{ isError:true }` ERROR envelope
  produced by `errorResult(...)`, which already carries arbitrary non-schema `extra` fields
  (`unsupported_family` already adds `requestedFamilies`/`supportedFamilies`;
  `provider_server_error` already adds `detail`). The Edge treats `{isError:true}` as a
  NON-packet (it never routes it through `parseMcpBooleanObservationResponse` —
  `isServerErrorEnvelope` short-circuits BEFORE the parser, by design from #365 Phase 3). So
  `reason` + `retryAfterMs` ride OUTSIDE the mirrored schema.
- **Conclusion: this card does NOT touch the schema mirror, does NOT bump the schemaVersion, and
  does NOT change any mirrored constant.** The new sub-reason value
  (`provider_capacity_exhausted`) lives in `booleanObservationFailureSubreason.ts`, which is a
  DIAGNOSTIC vocabulary, NOT a mirrored wire schema (it is never persisted to a DB column, never
  cross-tree-mirrored, never parity-tested against the server). Adding a union member there is the
  same additive move #365 Phase 3 made when it added `provider_server_error`.
- **HALT note:** IF, during implementation, the envelope is found to need a field that DOES live in
  the mirrored schema, that is a HALT — stop and surface to the operator. The design is constructed
  specifically so this does not arise (envelope = error path = unmirrored).

---

## Edge cases (the implementer MUST handle each)

1. **KV unavailable / slow / throws → FAIL OPEN.** `acquireGlobalProviderSlot` catches any KV
   error or a KV op exceeding `KV_OP_TIMEOUT_MS` and returns `{acquired:true, degraded:'kv_unavailable',
   release: async()=>{}}` (no-op release). The call proceeds to the provider WITHOUT a slot. The
   server logs `provider_limiter_degraded` (no secret). Worst case = uncapped baseline, never a
   deny-storm. Tested (T-LIM-FAILOPEN).
2. **Slot leak on crash/timeout.** The isolate dies after acquiring but before releasing. The KV
   permit entry's `expireIn: SLOT_LEASE_TTL_MS` reclaims it automatically. Release is best-effort
   and never load-bearing for correctness. Tested by injecting a fake KV with TTL-expiry semantics
   (T-LIM-LEASE-EXPIRY).
3. **Clock skew across regions.** `acquiredAt` is diagnostic-only and never used for cap math —
   the cap is "count of live (non-expired) permit entries," and expiry is KV-server-side
   (`expireIn`), not client-clock-compared. So cross-region clock skew cannot mis-count or
   prematurely expire a permit. `now()` is injectable for tests but only feeds jitter/diagnostics.
4. **`retryAfterMs` storms / thundering herd.** Without jitter, every denied family in a burst
   would retry at the same instant and re-collide. The server adds RANDOM jitter
   (`0..500ms`) to each `retryAfterMs`, and the Edge already staggers via bounded parallelism (2
   in flight). The clamp ceiling (4s) bounds the worst case. Tested: `computeRetryAfterMs` returns
   values inside `[MIN, MAX]` and is NOT a single fixed value across calls (T-RETRYAFTER-JITTER).
5. **Partial KV writes.** The acquire is a single atomic `commit()`: either the permit entry +
   marker bump both land, or neither does (Deno KV atomic guarantee). There is no
   half-acquired state. A failed commit (lost CAS race) is retried within budget or surfaces
   `capacity_exhausted`. Tested via fake-KV that fails the first commit then succeeds
   (T-LIM-CAS-CONTENTION).
6. **Cap interaction with the existing 2-per-arg Edge bound.** The Edge `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES=2`
   is PER-ARGUMENT and UNCHANGED. The global limiter is the CROSS-argument ceiling. Composition: a
   single argument issues ≤2 concurrent provider calls (well under the global 6, so a lone
   argument never sees `capacity_exhausted`); a 5-arg burst issues up to ~10 concurrent, which the
   global 6 throttles — the surplus ~4 get `capacity_exhausted` + retry-after rather than
   overloading the provider. Both bounds coexist; neither is removed. Tested conceptually in the
   dispatcher test (a capacity outcome on one family does not abort siblings — T-DISP-CAPACITY).
7. **Cold start when KV is empty.** First request on a fresh deployment: `list` returns zero live
   permits → first `GLOBAL_PROVIDER_CONCURRENCY` acquires succeed immediately. No special-casing
   needed; the empty-prefix `list` is the natural base case. Tested (T-LIM-COLD-EMPTY).
8. **Capacity envelope mis-detected as a schema failure.** Guarded by ordering: the adapter checks
   `isServerErrorEnvelope` (and within it, `reason==='capacity_exhausted'`) BEFORE
   `parseMcpBooleanObservationResponse`. A `{isError:true, reason:'capacity_exhausted'}` never
   reaches the schema parser (which would mis-type it `response_wrong_schema_version`). This
   mirrors the Phase-2/Phase-3 lesson exactly. Tested (T-ADAPT-CAPACITY-BEFORE-PARSER).
9. **`retryAfterMs` absent/garbage from server.** Edge reads it only if finite; else falls back to
   `RETRY_BACKOFF_MS[0]`. Clamped on receipt. Tested (T-ADAPT-RETRYAFTER-CLAMP).
10. **Both Anthropic AND limiter would deny (key missing under load).** Key-missing fast-rejects
    BEFORE the limiter acquire (preserved from today), so a missing key never consumes/denies a
    slot and never emits `capacity_exhausted` — it emits `key_missing` as today.
11. **Release after lease already expired.** The best-effort release deletes a key that KV may have
    already auto-expired; the delete is a no-op (idempotent), no error surfaced. Tested
    (T-LIM-RELEASE-AFTER-EXPIRY).

---

## Test plan (mapped to test-discipline)

Tests are part of "done." Server tests are Deno (`mcp-server/tests/`, run by `deno test`); Edge
tests are Jest (`__tests__/`, via the existing Deno→Jest bridges). Pure helpers get direct unit
tests; the KV seam gets a fake-KV; the secret-surface gets a hostile-fixture + source-scan.

Server limiter (Deno) — `mcp-server/tests/globalProviderLimiter.test.ts` (NEW):
- T-LIM-UNDERCAP — `isUnderCap` boundary: `liveCount < cap` true, `=== cap` false (assert against
  the IMPORTED `GLOBAL_PROVIDER_CONCURRENCY`, never a literal — the Card-1B lesson, mirroring
  `providerConcurrency.test.ts`).
- T-LIM-ACQUIRE-HAPPY — with a fake KV starting empty, the first `GLOBAL_PROVIDER_CONCURRENCY`
  acquires succeed (`acquired:true`); the next acquire within `SLOT_WAIT_MS` returns
  `capacity_exhausted` with a bounded `retryAfterMs`.
- T-LIM-CAS-CONTENTION — fake KV fails the first atomic `commit` (simulating a lost race) then
  succeeds; acquire re-reads and still acquires within budget; max live never exceeds cap in a
  same-"region" run.
- T-LIM-LEASE-EXPIRY — a permit written with `expireIn` is gone after the fake KV advances its
  clock past `SLOT_LEASE_TTL_MS`; a subsequent acquire succeeds (no leak).
- T-LIM-FAILOPEN — fake KV throws / exceeds `KV_OP_TIMEOUT_MS`; acquire returns
  `{acquired:true, degraded:'kv_unavailable'}` (NEVER `capacity_exhausted`); release is a safe
  no-op.
- T-LIM-COLD-EMPTY — empty KV cold start: acquire succeeds immediately, no special-case error.
- T-LIM-RELEASE-AFTER-EXPIRY — release of an already-expired permit is a no-op, no throw.
- T-RETRYAFTER-JITTER — `computeRetryAfterMs` output is always in `[RETRY_AFTER_MIN_MS,
  RETRY_AFTER_MAX_MS]` and varies across calls (jitter present); never below MIN, never above MAX.
- T-LIM-PURITY-SCAN — source scan of `globalProviderLimiter.ts`: no `console.*`; no banned verdict
  token; the ONLY randomness is jitter; the limiter file carries NO prompt/body/secret literal;
  `Deno.openKv` reached only through the injectable factory. (Mirrors the
  `providerConcurrency.test.ts` purity/topology scan structure.)
- T-LIM-GLOBAL-FRAMING — source scan asserts the limiter is described as GLOBAL/cross-isolate (the
  inverse of the per-isolate honesty scan) and does NOT claim a hard mutex (it must disclaim
  exactness: "soft bound / eventual cross-region").

Server `callAnthropic` wiring (Deno) — extend `mcp-server/tests/anthropicCallProviderCap.test.ts`
(MODIFY) + `providerConcurrency.test.ts` (MODIFY the positive-wiring assertion, per §"Disposition"):
- T-ANTH-CAPACITY-RETURN — with a fake limiter returning `acquired:false`, `callAnthropic` returns
  `{ok:false, reason:'capacity_exhausted', retryAfterMs}` and does NOT call `fetch` (no provider
  round-trip on a denied slot). Assert the injected `fetchImpl` was never invoked.
- T-ANTH-RELEASE-ALL-PATHS — on every acquired path (success, 429, !ok, throw, parse-null) the
  global `release` is called exactly once (finally-block guarantee preserved). Update the existing
  finally-block source-scan to target the async release.
- T-WIRING — `anthropicCall.ts` imports the global limiter and calls `acquireGlobalProviderSlot`;
  the OLD `providerConcurrencyGate.acquire()` is GONE from the request path (replaces the existing
  positive-wiring test's target).

Server tool envelope (Deno) — extend `mcp-server/tests/classifyArgumentBooleanObservations.test.ts`
(MODIFY):
- T-ENV-CAPACITY — when the provider call yields `capacity_exhausted`, the tool returns
  `{ isError:true, structuredContent:{ reason:'capacity_exhausted', retryAfterMs:<number> } }`.
- T-ENV-SAFE (doctrine §6 ban-list/secret scan) — the returned envelope's serialized form contains
  ONLY `reason` + `retryAfterMs` (+ `isError`); assert it does NOT contain the input
  `currentText`/`parentText` bytes, any `Bearer`/`Authorization`/`sk-ant`/`sb_secret`/JWT shape, or
  any verdict token. Build a fixture whose input body contains a sentinel string + a fake secret
  shape and assert neither appears in the envelope.

Edge adapter detection + typing (Jest) — `__tests__/booleanObservationCapacityEnvelope.test.ts`
(NEW) + extend `__tests__/booleanObservationFailureSubreason.test.ts` (MODIFY):
- T-SUBREASON-VOCAB — `provider_capacity_exhausted` is in `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS`;
  the existing ban-list test (no verdict token in any sub-reason) covers it automatically — add an
  explicit assertion the value is present + verdict-free.
- T-ADAPT-CAPACITY-BEFORE-PARSER — a fixture envelope `{isError:true, reason:'capacity_exhausted',
  retryAfterMs:1800}` routed through the adapter's extract→detect path yields
  `{kind:'unavailable', reason:'api_error', subReason:'provider_capacity_exhausted', retryAfterMs:1800}`
  and NEVER reaches `parseMcpBooleanObservationResponse` (assert it is not mis-typed
  `response_wrong_schema_version`). (Uses the same source-scan/bridge approach as the existing
  adapter-core tests.)
- T-ADAPT-RETRYAFTER-CLAMP — `retryAfterMs` of `999999` clamps to `RETRY_AFTER_MAX_MS`; `10` clamps
  to `RETRY_AFTER_MIN_MS`; `undefined`/`'x'`/`NaN` → falls back (no `retryAfterMs` field, or the
  static default at the dispatcher).
- T-ADAPT-FAILUREREASON-UNCHANGED — `unavailableReasonToFailureReason('api_error')` still returns
  `'mcp_api_error'` (in `RETRYABLE_FAILURE_REASONS`) — the capacity path reuses the existing
  retryable wiring with no set change.

Edge dispatcher retry-after honoring + nonblocking (Jest) — extend the dispatcher's existing test
suite (MODIFY) — `__tests__/autoTriggerDispatcher*.test.ts`:
- T-DISP-CAPACITY-RETRY — a mocked classify core returns a capacity sub-reason + `retryAfterMs` on
  attempt 1, success on attempt 2; assert the dispatcher waited the SERVER-supplied `retryAfterMs`
  (clamped), NOT the static `RETRY_BACKOFF_MS[0]` (use Jest fake timers; assert the `sleep`
  duration). Assert `MAX_ATTEMPTS=2` still caps it (a second capacity → terminal `failed`, no
  third attempt).
- T-DISP-CAPACITY-VS-STATIC — a `mcp_network_error` (no capacity sub-reason) still uses the static
  `[2000,8000]` schedule (the capacity path is isolated to its sub-reason).
- T-DISP-CAPACITY-NONBLOCKING — the capacity outcome on one family does NOT abort sibling families
  (the bounded-parallel runner is allSettled-style); all families still produce an outcome; the
  dispatcher never throws.
- T-DISP-IDEMPOTENCY-PRESERVED — a capacity-then-heal sequence writes exactly ONE success run row
  for the (arg,family) cell (success-only idempotency guard intact; no duplicate).

Doctrine / safety (both trees):
- The server envelope ban-list (T-ENV-SAFE) and the sub-reason ban-list (existing, extended) are
  the doctrine guards. No user-facing string is added (the envelope is operator/diagnostic only,
  never rendered to a user — `gameCopy.toPlainLanguage` is NOT touched because `capacity_exhausted`
  never reaches a user surface; if a future card surfaces it, THAT card adds the mapping). Assert
  no new internal code leaks to a user string by confirming no `src/`/`app/` file imports the new
  symbols (source-scan, mirroring the §7 server-only fence).

**Schema-mirror parity:** no new parity test is needed because the envelope is unmirrored (see
§"Schema-mirror analysis"). The implementer MUST verify the existing
`mcpBooleanObservationSchemaParity.test.ts` still passes UNCHANGED (it will — no mirrored constant
moves). If it requires a change, HALT and surface.

---

## Production-path verification design (matches the card's verdict bands)

Verification is operator-run AFTER the implementer commits and AFTER the operator deploys the MCP
server (with the limiter + KV) and the Edge functions. Anchored to the DEPLOYED hosted MCP server,
not local Deno tests. Mirrors the Phase-1..8 structure of the cap=5/cap=2 audits.

- **Pre-flight (non-spend):** main HEAD = the merge commit; `globalProviderLimiter.ts` present;
  `anthropicCall.ts` wired to the global limiter (not the per-isolate gate); Edge adapter detects
  `capacity_exhausted`; clean tree; Deno + Jest baselines green (test counts up). Operator confirms
  the limiter build deployed to Deno Deploy AND that Deno KV is provisioned/enabled for the
  deployment.
- **Canary first:** ONE synthetic smoke-tagged submission (`[ops-global-cap …]`). 7 family runs
  A–G all `success`; H/I/J zero; no dup; no terminal hole; submit nonblocking;
  `wall_clock_background` recorded; no 429. A lone argument (≤2 concurrent) must NOT see
  `capacity_exhausted` (it's under the global 6). Clean → burst.
- **Burst:** a tight 5-arg back-to-back burst; A–G only; H/I/J ABSENT. Cross-arg concurrency ~10
  (valid burst). Expect: the global limiter throttles to ~6 concurrent provider calls; surplus
  calls return `capacity_exhausted` + retry-after and HEAL in the background within
  `MAX_ATTEMPTS=2`.
- **Classification of rows (separate buckets):** a healed family = `failed`(capacity)+`success`; a
  terminal hole = `failed`+`failed`. Retry/backpressure rows MUST be classified separately from
  terminal holes. The `provider_capacity_exhausted` sub-reason + `retryAfterMs` on the failed row
  is the discriminator.
- **Acceptance checks:**
  - **Every expected (argument, family) cell reaches `success`** (`everyExpectedCellHasSuccess =
    true`).
  - No duplicate success rows (idempotency guard held).
  - Submit nonblocking (submit latency in the ~1.3–3.3s band, unaffected).
  - **p95 `wall_clock_background` < 30s.**
  - Edge auto-trigger overlap bounded at 2 per argument (cross-arg 10 is the burst).
  - Doctrine `evidence_span` scan over positive doctrine-risk rows: ZERO banned verdict tokens
    (the limiter cannot alter classifier output — re-scan for completeness as cap=5 did, 66 spans).
  - No service-role; no secrets / raw provider / model / prompt / auth in logs or output. No
    prompt/taxonomy/family-key/schema-mirror/Source-6/production-flag/package.json change.
- **Settle confirmation:** total run rows accounted for, 0 in-flight after settle.

**Verdict bands (verbatim from the issue):**

- **PASS** — global capacity control restores complete A–G run coverage under meaningful burst
  pressure AND keeps p95 < 30s.
- **PARTIAL** — run-completeness improves but p95 enters 30–45s, OR topology constraints require a
  broader queue-worker redesign.
- **FAIL** — terminal holes remain, OR p95 > 45s, OR submit blocks, OR H/I/J run, OR duplicate rows
  appear, OR raw / secrets leak.

On PASS, Family H may be unfrozen by the operator (or a Gate H risk acceptance). On PARTIAL/FAIL,
Family H stays frozen and the audit prescribes the next move (e.g. retune `GLOBAL_PROVIDER_CONCURRENCY`,
or — only if evidence-justified — the modest Edge-timeout bump deferred in §"15s deadline").

---

## Dependencies (cards / docs / files)

- Assumes #371's per-isolate cap is the superseded baseline (cap=5 PARTIAL / cap=2 FAIL); this card
  reads `mcp-server/lib/providerConcurrency.ts` + `anthropicCall.ts` at the `callAnthropic` gate
  site and replaces the gate.
- Assumes #365 Phase 3's typed `{isError}` detection (`isServerErrorEnvelope` in
  `booleanObservationMcpAdapter.ts`) and the `provider_server_error` sub-reason precedent are in
  place — this card extends both (a sibling `capacity_exhausted` branch + a sibling
  `provider_capacity_exhausted` sub-reason).
- Assumes OPS-MCP-AUTO-TRIGGER-PARALLELIZATION's bounded-parallel dispatcher (limit 2) and the
  success-only idempotency guard — both PRESERVED, not changed.
- Reads `booleanObservationMcpAdapterCore.ts:56` (the 15s timeout constant) and
  `autoTriggerConcurrency.ts` (the 2/arg bound) as fixed inputs.
- **Blocks Family H** (production AND admin) until this card passes production-path verification
  (operator binding).
- Introduces a NEW runtime dependency on **Deno KV** for the MCP server — a platform capability
  (no npm/import-map add for the stable API; `Deno.openKv()` is built-in; local tests injecting a
  fake KV need no flag, the real-KV integration test needs `--unstable-kv` in `deno.json`'s test
  task). Flagged in HALT self-eval + Operator steps.

---

## Risks

- **The 15s deadline is tight on the tail.** Even with a slot, a p95-tail Anthropic round-trip
  (~13s) + 2s slot-wait ≈ 14.9s flirts with the 15s abort. The limiter REDUCES round-trip times
  (less provider overload), which is the mitigation, but the smoke must watch for residual 15s
  `mcp_network_error`. If they persist on genuinely-slow calls, the deferred (separate-card)
  Edge-timeout bump is the lever — NOT done here. Honest precedent: #368's long-backoff FAIL warns
  against reaching for the latency lever first.
- **Deno KV eventual cross-region consistency means the cap is SOFT.** Transient overshoot above 6
  is expected and acceptable (still far below the ~10–15 overload band). The risk is an implementer
  "fixing" the overshoot with cross-region locking and reintroducing latency — DO NOT. The design's
  soft-bound framing is deliberate; the limiter test (T-LIM-GLOBAL-FRAMING) guards the doc framing.
- **The existing positive-wiring test in `providerConcurrency.test.ts` (lines 302–320) WILL FAIL**
  after `anthropicCall.ts` is rewired and MUST be updated to the global limiter (not reverted). A
  fresh implementer could mistake this for a regression. Called out in §"Disposition" + the test
  plan.
- **Deno KV availability on the target deployment.** If the operator's Deno Deploy project does not
  have KV enabled, the fail-open path means the server silently runs uncapped (the cap=5 baseline)
  — functioning but NOT actually throttled. The pre-flight MUST confirm KV is provisioned, else the
  smoke would "pass canary, fail burst" exactly as before. Flagged in verification pre-flight.
- **`deno test --unstable-kv` for the real-KV integration test.** If the implementer writes a
  real-`Deno.openKv()` integration test, the `deno.json` test task needs `--unstable-kv`; otherwise
  the unit tests inject a fake and need nothing. Keep the real-KV test optional/tagged so CI
  without the flag still runs the fake-KV unit coverage.
- **Migration:** none. (No DB. KV is not a migration.)
- **Two consumers of `callAnthropic`.** The semantic-move tool also routes through it and will see
  the new `capacity_exhausted` reason. Its envelope path is reviewed for parity, but only the
  boolean-observation auto-trigger is the PRODUCTION consumer this card verifies. The semantic-move
  path's behavior under capacity is to surface its own error envelope (the existing fallback), which
  is acceptable; flagged so the implementer confirms no semantic-move regression in its existing
  tests.

---

## Out of scope

- Family H/I/J of any kind (production OR admin design) — FROZEN by operator binding until PASS.
- Raising the 15s Edge timeout (deferred; evidence-gated follow-up only, per §"15s deadline").
- Removing/relocating `providerConcurrency.ts` and its test suite (demote now; a follow-up
  housekeeping card deletes the dead module after the global limiter is proven).
- Any prompt / taxonomy / family-key / `family*BanListScan` / schema-mirror / schemaVersion bump.
- Source 6 (`machineObservationPersistenceQuery.ts`) and any rendering/UX change.
- Any `familyRegistry.ts` production-flag flip (no new family enabled).
- Audit-lint rule changes; root `package.json` changes.
- A user-facing surface for `capacity_exhausted` (it is operator/diagnostic only;
  `gameCopy.toPlainLanguage` is untouched — if a future card surfaces it, that card adds the
  mapping + the ban-list coverage).
- Tuning `GLOBAL_PROVIDER_CONCURRENCY` to its final value (the post-deploy smoke does that within
  the verdict bands; the design ships a defensible start = 6).
- A queue-worker / durable-job redesign (named as the PARTIAL escalation path in the verdict bands,
  not built here).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the limiter and the
  envelope are pure capacity/transport admission control — they carry NO verdict, NO truth value,
  NO standing band, NO winner/loser. The only ordering input is slot availability (FIFO-ish by
  arrival + KV CAS), never any score/heat/popularity signal. Score/standing is untouched. Submit is
  nonblocking and the classifier is background-only, so NOTHING here can block posting. Ban-list
  tests (T-ENV-SAFE, the extended sub-reason ban-list) assert verdict-freedom.
- **cdiscourse-doctrine §3 (popularity is not evidence):** no engagement/virality/popularity input
  anywhere in the limiter or the retry — the inputs are live-permit count, a clock for jitter, and
  the server-supplied `retryAfterMs`. None grants any claim factual standing.
- **cdiscourse-doctrine §4 (AI moderator limits):** unchanged — the classifier still returns
  advisory structural observations (`provider:'mcp'`), never authoritative, never auto-acting. The
  limiter only governs WHEN the provider call runs, never WHAT it concludes.
- **cdiscourse-doctrine §5 (rules engine sacred):** untouched — no change to
  `src/lib/constitution/engine.ts`; the limiter is server-runtime IO, never imported by the engine.
- **cdiscourse-doctrine §6 (secrets):** the capacity envelope is two scalars (`reason`,
  `retryAfterMs`) — NO prompt, NO body, NO raw provider payload, NO `ANTHROPIC_API_KEY`/x-api-key,
  NO `Authorization`/`Bearer`, NO service-role. The KV permit value is `{acquiredAt}` only (no
  body, no secret). `retryAfterMs` from the server is UNTRUSTED and is clamped + (Edge-side)
  type-checked; the Edge `buildFailureDetail` allowlist sanitizer is unchanged and still scrubs any
  detail string. Source-scan + hostile-fixture tests enforce this.
- **cdiscourse-doctrine §7 (no AI calls from the production app):** unchanged — the Anthropic call
  stays inside the MCP server (Deno); `src/`/`app/` never import the limiter or `callAnthropic`.
  The new Edge symbols (sub-reason, `retryAfterMs`) live under the `booleanObservations` server-only
  tree fenced out of `src/`/`app/`. A source-scan asserts no client import.
- **cdiscourse-doctrine §8 (Supabase conventions):** no RLS change, no migration, no new table; the
  success-only idempotency guard (no duplicate success rows) is explicitly preserved + tested.
- **cdiscourse-doctrine §10a (observations vs allegations):** the persisted rows remain Machine
  Observations (kind unchanged); the limiter never relabels or implies a person made a claim.

---

## Operator steps (after the implementer commits + the card merges)

1. **Confirm Deno KV is enabled** for the hosted MCP server's Deno Deploy project (KV is enabled
   per-project; the stable KV API needs no flag in production, but the project must have KV
   provisioned). If not, enable it BEFORE deploying — otherwise the limiter fails open (runs
   uncapped) and the burst smoke will reproduce the cap=5 PARTIAL.
2. **Deploy the MCP server** to Deno Deploy with the global-limiter build (operator's existing
   manual redeploy flow — the hosted server URL/token are operator secrets). Verify `/health` is
   serving the new build.
3. **Deploy the Edge functions** that changed (`submit-argument` + the shared boolean-observation
   tree): the Supabase GitHub integration auto-applies on merge to main (per the
   supabase-merge-autodeploy memory), so this is typically automatic — confirm
   `classify-argument-boolean-observations` + `submit-argument` redeployed.
4. **No `npx supabase db push`** — there is NO migration in this card.
5. **(Optional) set `GLOBAL_PROVIDER_CONCURRENCY`** only if the design exposes the cap VALUE via an
   env override (see Open questions) AND the smoke indicates a retune; otherwise the code constant
   (6) governs. Do NOT introduce an env that could silently UNBOUND the cap (must validate-or-default
   like `MCP_SERVER_MAX_PROVIDER_CONCURRENCY`).
6. **Run the production-path verification** (canary → 5-arg burst) per §"Production-path
   verification design" and record the verdict (PASS/PARTIAL/FAIL) in a new audit doc under
   `docs/audits/`.

---

## Open questions for the operator

1. **Cap VALUE as a code constant vs an env override.** The design ships `GLOBAL_PROVIDER_CONCURRENCY
   = 6` as a CODE constant (auditable, rollback-via-PR, can't be silently unbounded). The old
   per-isolate cap had an env knob (`MCP_SERVER_MAX_PROVIDER_CONCURRENCY`) for runtime retune. Do you
   want a validated env override on the GLOBAL cap too (faster smoke retune, at the cost of a runtime
   surface), or keep it code-only? Recommendation: code-only for the first ship; add a validated
   override in a follow-up only if smoke retuning proves it's needed.
2. **Starting `GLOBAL_PROVIDER_CONCURRENCY` = 6 — accept, or start lower (e.g. 4) / higher (e.g. 8)?**
   6 is reasoned from the ~10-wide burst and the ~10–15 overload band, but it is a first estimate the
   smoke validates. A lower start is safer against `{isError}` but risks more `capacity_exhausted`
   retries (more background latency); a higher start risks residual overload. Confirm the starting
   value or pick one for the smoke.

---

## HALT-style self-eval (surfaced for the implementer; do not rediscover)

| # | HALT-trigger risk spotted | Disposition |
| --- | --- | --- |
| H1 | **New runtime dependency: Deno KV.** A cross-isolate durable store is a new platform capability for the MCP server. | NOT a `package.json`/npm add (stable `Deno.openKv()` is built-in). The real-KV integration test needs `--unstable-kv` in `mcp-server/deno.json`'s `test` task — a MANIFEST touch. **Surfaced**: implementer adds the flag ONLY if writing a real-KV test; unit tests inject a fake KV and need no flag. Operator must confirm KV is provisioned (Operator step 1). |
| H2 | **Manifest change: `mcp-server/deno.json`.** | The MCP server's OWN manifest, NOT the root `package.json` the issue restricts. One-line addition to the test task. **Surfaced** here; bounded; reversible. |
| H3 | **Shared-file change is ADDITIVE only.** `booleanObservationFailureSubreason.ts`, `…AdapterCore.ts`, `…Adapter.ts`, `classifyArgumentCore.ts`, `autoTriggerDispatcher.ts`, `callAnthropic.ts` all change. | Every change is ADDITIVE (new union member, new optional field, new branch BEFORE the existing one). `failureReason` strings, the retryable set, the idempotency guard, the 2/arg bound, the schema mirror, and all existing tests' EXPECTATIONS are preserved — EXCEPT the one positive-wiring test (H4). No HALT. |
| H4 | **An existing test's expectation changes** (`providerConcurrency.test.ts` positive-wiring, lines 302–320). | This is the ONLY non-additive test change: it asserts the OLD per-isolate wiring that this card removes. It MUST be rewritten to assert the global limiter wiring (NOT reverted). **Surfaced** in §"Disposition" + Risks + test plan so the implementer doesn't treat the red as a regression. |
| H5 | **Schema-mirror touch?** | NO — analyzed in §"Schema-mirror analysis". The envelope is an unmirrored `{isError}` error path; the new sub-reason is a diagnostic vocabulary, not a mirrored wire schema; no schemaVersion bump. **IF implementation finds the envelope needs a mirrored field → HALT and surface.** |
| H6 | **Migration / DB / RLS?** | NONE. No SQL, no table, no column, no RLS. KV is not a migration. |
| H7 | **Secret handling.** New surfaces cross a network boundary (the envelope `retryAfterMs`, the server `reason`). | Envelope = two scalars, no secret (§6 self-check + T-ENV-SAFE). `retryAfterMs` is UNTRUSTED → clamped server-side AND Edge-side. The existing `buildFailureDetail` allowlist is unchanged. No new secret path. |
| H8 | **Production-flag flip?** | NONE. `familyRegistry.ts` untouched; no new family enabled; Family H stays frozen. |
| H9 | **Dependency add (npm / import-map)?** | NONE beyond the built-in Deno KV (H1). `mcp-server/deno.json` imports map (`std/`) is untouched. |
| H10 | **Could the limiter block submit?** | NO — submit is nonblocking (returns 201 before the background promise); the classifier is `waitUntil`-background; the limiter FAILS OPEN on KV trouble and never waits past `SLOT_WAIT_MS`. Asserted by T-LIM-FAILOPEN + T-DISP-CAPACITY-NONBLOCKING + the existing submit-nonblocking smoke check. |

**Net:** the implementable risks are bounded and surfaced. The two items needing operator awareness
BEFORE/AROUND implementation are H1 (Deno KV must be provisioned on the deployment) and the two
Open Questions (cap-value surface + starting value). No HALT-class blocker requires stopping the
design; H5 is the one to watch DURING implementation.
