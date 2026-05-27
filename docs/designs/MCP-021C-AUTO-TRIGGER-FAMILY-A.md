# MCP-021C-AUTO-TRIGGER-FAMILY-A — Auto-trigger production-mode Family A classification on argument insert

**Status:** Design draft
**Card:** MCP-021C-AUTO-TRIGGER-FAMILY-A — Automatic Family A boolean-observation
classification for new arguments
**Effort:** M-L (design-heavy)
**Branch:** `feat/MCP-021C-AUTO-TRIGGER-FAMILY-A`
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/312
**Intent brief:** `docs/designs/MCP-021C-AUTO-TRIGGER-FAMILY-A-intent.md` at
commit `f2078cd` (operator-authored, binding)
**Predecessor:** MCP-021C-FAMILY-A-PROD-SMOKE PASS (`67fcba5`)
**Filed:** 2026-05-26

---

## §1 — Scope reality

### 1.1 — In scope (this card ships)

* Auto-invocation of `classify-argument-boolean-observations` for newly
  inserted arguments, in `mode='production'` for
  `requestedFamilies=['parent_relation']` (Family A only).
* Idempotency via Option A (query-before-create against existing columns;
  no new migration in this card).
* Bounded retry policy per intent brief Decision 5 (2 attempts for
  transient classes only).
* Skip-on-disabled-config + skip-on-family-not-enabled rate/cost guards.
* Structured logging per intent brief Decision 9.
* Tests covering trigger, idempotency, retry, failure, security boundary
  (single-file aggregate pattern; +~95 tests forecast).
* No new RLS policy; no new migration; no MCP-021A taxonomy change; no MCP
  server prompt change; no UI change.

Quoting the intent brief §3 ALLOWED list verbatim: "Add a trigger that
invokes `classify-argument-boolean-observations` asynchronously when a
new argument is created. Idempotency strategy per Decision 4. Bounded
retry per Decision 5. Skip-on-disabled-config + skip-on-family-not-enabled
rate/cost guards. Structured logging per Decision 9. Tests for trigger,
idempotency, retry, failure, security boundary. Optional migration ONLY
if Decision 4 chooses Option B AND source inspection proves it's the right
call."

### 1.2 — Out of scope (deferred)

Per intent brief §3 DISALLOWED list:

* New families (B–J remain `productionEnabled: false`).
* New taxonomy keys.
* MCP server prompt changes.
* UI / display cap changes.
* Historical backfill (deferred to `MCP-021C-FAMILY-A-BACKFILL`).
* Client-side MCP fetch / `EXPO_PUBLIC_*` MCP credentials.
* Service-role client in app/client code.
* Source 6 filter weakening or admin-row leakage.

Per intent brief §9 operator-deferred future cards:

* `MCP-021C-FAMILY-A-BACKFILL` — historical argument classification.
* `MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING` — only filed if
  Option A surfaces race-condition duplicates under production traffic.
* `OPS-MCP-RATE-LIMITING` — concurrent caps, per-debate limits,
  cost-budget enforcement.
* `OPS-MCP-OBSERVABILITY` — production traffic observability (promotable
  to PLANNED after this card's smoke PASS).
* `ADMIN-MCP-001` — UI affordance flip (authorized post-smoke).
* `MCP-SERVER-003` — Family B template (authorized post-smoke).
* `MCP-021C-AUTO-TRIGGER-FAMILY-B`–`-FAMILY-J` — one per family per
  cadence.

### 1.3 — What this card is NOT

Quoting the intent brief verbatim: "This card is NOT: a taxonomy card; a
prompt-tuning card; a Family B-J card; a historical-backfill card."

---

## §2 — Trigger architecture (Phase A.2 binding)

### 2.1 — Argument creation path (Phase A.1)

Source-confirmed canonical insert point: **`submit-argument` Edge Function,
`supabase/functions/submit-argument/index.ts:348-352`** (single
service-role INSERT after JWT verification + RLS-checked authorization +
constitution evaluation):

```ts
const { data: insertedArg, error: insertError } = await serviceClient
  .from('arguments')
  .insert(argInsert)
  .select()
  .single();
```

The client-side wrapper at `src/lib/edgeFunctions.ts:137-166`
(`submitArgumentDraft`) is the ONLY mobile-app entry point. Direct table
inserts from the client are explicitly prohibited (file header: "The
mobile client must NEVER directly insert posted arguments into
public.arguments."). Bot fixtures under `scripts/bot-fixtures/` also route
through `submit-argument`.

There is no Postgres-trigger path on `public.arguments` today, no Supabase
Database Webhook path, and no existing job/task system. `submit-argument`
is therefore the ONLY surface where a "new argument was just created"
event is reliably observable for every authentic argument insert.

### 2.2 — Chosen trigger site: **shared in-process helper invoked from `submit-argument` via fire-and-forget non-blocking dispatch**

**Decision:** Refactor the per-argument classifier core out of
`supabase/functions/classify-argument-boolean-observations/index.ts` into
a new shared module
`supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts`,
then invoke it from `submit-argument`'s post-insert tail using a
fire-and-forget Promise that the response handler does NOT await.

**Why this site (intent brief Decision 1 ordering):**

1. **Existing post-submit async hook / queue if present** — **no such
   queue exists**; the only async side-effect surface today is the
   `try { … } catch { … }` block at
   `supabase/functions/submit-argument/index.ts:619-752` (QOL-040
   notification side-effect). That block is `await`-but-swallow-errors —
   it still waits for completion, which would block submit by up to
   ~20s for an MCP roundtrip. NOT suitable as-is.

2. **Server-side fire-and-forget invocation after argument write** —
   **selected.** The submit-argument function already holds:
   * the inserted argument's UUID (`insertedArg.id`),
   * the inserted argument's `debate_id`, `parent_id`, `body`,
   * a verified user JWT,
   * a `serviceClient` already in scope.
   The classifier work needs exactly these inputs. By calling
   `classifyArgumentCore(insertedArg.id, ...)` AFTER the insert and the
   notification side-effect, but WITHOUT `await`-ing the returned
   promise, the submit-argument response is unblocked and the
   classification proceeds in the background of the same isolate.

3. **Minimal Edge Function helper called after argument creation** —
   redundant; we already have a perfectly good shared module surface.
   An Edge-to-Edge HTTP roundtrip to
   `/functions/v1/classify-argument-boolean-observations` would add
   network latency, force us to widen the classifier's admin gate (or
   introduce a new function-secret), and require a second isolate to
   spin up. None of those costs buy us anything.

**Why not the alternatives?**

* **Post-submit client callback (rejected).** Would require the client
  to call `classify-argument-boolean-observations` from `ArgumentComposer`
  after `submitArgumentDraft` returns. Two blockers:
  1. The classifier Edge Function requires admin role (`requireAdmin`).
     Widening it to "any authenticated caller" allows any user to
     trigger production MCP traffic, which is a cost/abuse vector that
     contradicts intent brief Decision 7's rate/cost discipline.
  2. The client would need to know the MCP server is even running, which
     leaks operational state into the production app and risks the
     "fire-and-forget" becoming "fire-and-await-because-the-UI-needs-it"
     by the next card. Doctrine §4 (AI moderator hard limits) plus
     doctrine §7 (no AI calls from production app) make this strictly
     a server-side concern.
* **Database trigger / Supabase webhook (rejected).** A Postgres trigger
  cannot invoke an Edge Function natively. It would require the
  `pg_net` extension (not currently enabled in this repo's migrations)
  or a Supabase Database Webhook. Adding pg_net is a separate migration
  with operational surface area (timeout tuning, error-row handling,
  retry semantics in PL/pgSQL) that's disproportionate to a v1
  fire-and-forget hook. Database Webhooks add an extra hop and a second
  auth boundary. Both options add operator-deploy surface area without
  improving correctness.
* **Existing job/task system (rejected — does not exist).** This repo
  has no Celery/Sidekiq/cron-style worker. Building one for a single
  fire-and-forget call is out of v1 scope.

### 2.3 — Code shape (sketch — NOT implementation)

```
supabase/functions/_shared/booleanObservations/
└── classifyArgumentCore.ts                    # NEW
    ├── export classifyOneArgumentCore(input) → PerArgumentSummary
    ├── (lifted verbatim from
    │   classify-argument-boolean-observations/index.ts:305-489)
    └── + new export isAutoTriggerEnabled() → boolean
        (reads semantic_referee_runtime_config.enabled via the existing
        SECURITY DEFINER RPC pattern — no new RPC required if classifier
        Edge Function continues to enforce its admin gate; the auto-
        trigger path lives entirely server-side)

supabase/functions/_shared/booleanObservations/
└── autoTriggerDispatcher.ts                   # NEW
    ├── export async dispatchAutoTriggerForArgument(
    │     argumentId, debateId, serviceClient
    │   ) → AutoTriggerOutcome
    ├── 1. Check `semantic_referee_runtime_config.enabled === true`
    │     (skip with reason 'config_disabled' if false)
    ├── 2. Idempotency pre-check (Option A — see §3 below)
    ├── 3. Retry loop (Option A — see §4 below)
    ├── 4. Structured log emit (see §6 below)
    └── Returns the outcome enum (triggered | skipped | already_classified |
        failed) plus run_id when applicable; NEVER throws.

supabase/functions/submit-argument/index.ts    # MODIFIED (post-insert tail only)
└── After QOL-040 notification side-effect block ends (line ~752):
    Add a try/catch block invoking:
      const autoTriggerPromise = dispatchAutoTriggerForArgument(
        insertedArg.id, data.debate_id, serviceClient
      ).catch(() => undefined);
      // EdgeRuntime.waitUntil keeps the isolate alive for the
      // background task; the submit-argument response is returned
      // immediately. The promise is allowed to settle independently.
      if (typeof EdgeRuntime !== 'undefined' &&
          typeof (EdgeRuntime as { waitUntil?: (p: Promise<unknown>) => void })
            .waitUntil === 'function') {
        (EdgeRuntime as { waitUntil: (p: Promise<unknown>) => void })
          .waitUntil(autoTriggerPromise);
      }
      // Defensive: if waitUntil is unavailable (local Deno run, jest),
      // the promise is still dispatched but with a short max-wait so it
      // can't leak into the next request. No await; the response below
      // is returned immediately.

  No change to the early-return idempotency path (the same-
  client_submission_id replay path at lines 70-106 returns the
  previously-inserted argument; the classifier auto-trigger for
  that argument was dispatched on its ORIGINAL insert and is not
  re-dispatched here — the idempotency check at §3 would skip it
  anyway).
```

### 2.4 — Why it's non-blocking

* The submit-argument handler's `return created({…})` (line 754-768)
  fires BEFORE the `autoTriggerPromise` settles. The user's POST
  completes in submit-argument's normal latency band (a few seconds,
  dominated by the validation + insert path), not the MCP-call latency
  band (~5-15s observed in MCP-021C-EDGE-SMOKE Phase 2).
* `EdgeRuntime.waitUntil` is Supabase's documented contract for
  background tasks (`https://supabase.com/docs/guides/functions/background-tasks`);
  the runtime keeps the isolate alive until the promise settles. If
  it's absent (local Deno run / jest), the promise is still kicked off
  but cannot block the response that already returned.
* The submit-argument response shape is byte-equal to today's response
  (no new field). Existing clients neither see nor wait for the
  classifier outcome. The classifier outcome surfaces ONLY via Source
  6 rendering of the persisted rows (which the client polls via its
  existing `useArgumentRoomMessages` / `fetchPersistedObservationsForArguments`
  path on the next render tick).
* Decision 6 of the intent brief ("Failure behavior: never block argument
  submission") is structurally guaranteed by the fire-and-forget Promise
  pattern — any classifier failure can only affect the persisted
  `argument_machine_observation_runs.status='failed'` row, never the
  argument insert that already committed.

---

## §3 — Idempotency design (Phase A.3 binding)

### 3.1 — Chosen option: **Option A — Query-before-create with existing columns**

Per intent brief Decision 4 default lean: "Option A for v1; file
`MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING` as follow-up if
production traffic surfaces race conditions."

This card adopts that default.

### 3.2 — Pre-INSERT existence check

Before invoking the MCP adapter, `autoTriggerDispatcher.ts` runs a
service-client `SELECT` against `argument_machine_observation_runs`
filtered by the auto-trigger's canonical identity tuple:

```sql
SELECT id, status, run_mode
FROM public.argument_machine_observation_runs
WHERE argument_id = <argumentId>
  AND schema_version = 'mcp-021.machine-observations.boolean.v1'
  AND run_mode = 'production'
  AND provider_key = 'mcp:classify_argument_boolean_observations'
  AND requested_families = ARRAY['parent_relation']::text[]
ORDER BY started_at DESC
LIMIT 1;
```

(In supabase-js this is `serviceClient.from('argument_machine_observation_runs').select('id, status, run_mode').eq('argument_id', …).eq('schema_version', …).eq('run_mode', 'production').eq('provider_key', PROVIDER_KEY).contains('requested_families', ['parent_relation']).order('started_at', { ascending: false }).limit(1).maybeSingle()`.)

Three branches:

| Pre-check result | Action |
|---|---|
| No matching row | Proceed to MCP invocation. Outcome = `triggered`. |
| Match with `status='success'` | Skip MCP invocation. Outcome = `already_classified`. Persist NO new row. |
| Match with `status='failed'` | Allow re-attempt per retry policy (see §4). Persist a NEW run row (the previous failed run remains the audit trail). Outcome = `triggered` (retry-of-failed). |

### 3.3 — Why not Option B (new unique index migration)?

Option B would add:

```sql
CREATE UNIQUE INDEX argument_machine_observation_runs_auto_trigger_idx
  ON public.argument_machine_observation_runs (argument_id, schema_version, run_mode, provider_key)
  WHERE status = 'success'
    AND requested_families = ARRAY['parent_relation']::text[];
```

The `WHERE` clause referencing a `text[]` array column with a literal
equality is unusual but legal Postgres syntax. The migration would
guarantee race-free uniqueness at the DB layer.

**Ruled out because:**

* The intent brief explicitly states the default lean is Option A,
  predicated on the v1 traffic estimate (see §5 below) where the
  race-window concentration is low enough that duplicate cost is
  negligible.
* Migrations carry operator deploy surface area (OPS-001 four-class
  posture, `npx supabase db push` step). Adding one for an unconfirmed
  race condition is premature optimization.
* Option A's race window is small: from the `SELECT` returning "no
  match" to the `INSERT` of the new run row, the dispatcher does the
  full MCP roundtrip (~5-15s). Two `submit-argument` calls for the
  SAME `argument_id` is extraordinarily rare (it would require the
  same row to be inserted twice, which the FK on `argument_id` would
  forbid — there's only one argument per `argument_id` by definition).
  The only way to hit the race is two concurrent dispatcher calls for
  the same argument, which can only happen if a single submit-argument
  call somehow dispatches twice (it won't) OR if the
  `client_submission_id` idempotency replay path at
  `submit-argument/index.ts:70-106` somehow re-dispatches — see §3.4.
* If production traffic somehow surfaces duplicates (e.g., from a
  retry storm), we file
  `MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING` and ship
  Option B then.

### 3.4 — Why not Option C (advisory lock + query)?

Option C uses `pg_advisory_xact_lock(hashtextextended(argument_id::text || ':parent_relation'))`
inside a transaction to eliminate the race without a migration. Ruled out:

* Adds noticeable complexity (lock scope, deadlock concerns, lock
  acquisition latency).
* The race it solves (concurrent dispatches for the same argument_id)
  cannot occur in practice because submit-argument is the SOLE
  dispatcher and only dispatches once per insert (see §3.5 below).
* Option A's failure mode is "two run rows for the same argument" —
  benign: the persistence query in
  `machineObservationPersistenceQuery.ts:127` already returns rows
  from ANY matching production run, and the Source 6 adapter's
  display caps dedupe by `raw_key` within an argument anyway (per
  MCP-021C-EDGE-SMOKE Phase 4.1: "every `raw_key` is distinct" across
  multiple production runs of the same argument).

### 3.5 — Race-condition reasoning

The only realistic concurrent-dispatch scenario for Option A:

* **Submit replay via `client_submission_id`.** If the client retries
  a submit and the deduplication path at submit-argument:70-106 fires,
  the EARLY-RETURN (line 88-105) returns the existing argument WITHOUT
  re-running `dispatchAutoTriggerForArgument` (the auto-trigger call
  must be wired AFTER the deduplication path so the replay path never
  re-dispatches). This is the binding constraint on the implementer:
  the dispatch call site MUST be in the new-insert-only code path,
  AFTER `insertedArg` is freshly inserted, NOT in the replay-return
  branch. Explicit test asserts this.
* **Operator manual production run + auto-trigger collision.** An
  operator running `mode='production'` manually via curl while
  auto-trigger fires on the same argument. The pre-check `SELECT`
  catches whichever ran first; the second one finds the existing run
  and skips (or, if the first one failed, retries). Benign.
* **Two replicas of the same Edge Function.** Supabase Edge Functions
  are single-process per request; there is no shared concurrency that
  would interleave two dispatches for the same argument from different
  workers.

The race window is small enough that Option A is the documented
intent-brief default. No duplicate-tolerance reasoning is needed beyond
the existing Source 6 deduplication semantics (per-argument display caps
operate on `raw_key`, not on `run_id`).

### 3.6 — Defense-in-depth — UNIQUE (run_id, raw_key)

The MCP-021B migration's `CONSTRAINT amor_unique_run_rawkey UNIQUE
(run_id, raw_key)` already prevents duplicate result rows within a
single run. Even in the rare scenario where Option A's race produces
two run rows for the same argument, each run row's results are still
unique within itself; the persistence query returns at most one chip
per `raw_key` per argument anyway.

---

## §4 — Retry / failure design (Phase A.4 binding)

### 4.1 — Failure-mode mapping

The intent brief Decision 5 table is adopted verbatim with explicit
mapping to the adapter's `BooleanObservationUnavailableReason` enum
(from
`supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts`)
and the persisted `failure_reason` strings already defined in
`classify-argument-boolean-observations/index.ts:275-294`
(`unavailableReasonToFailureReason`).

| Adapter outcome / classifier outcome                       | Retry?         | Cap (attempts incl. first) | Backoff                      | Persisted `failure_reason`          |
|------------------------------------------------------------|----------------|----------------------------|------------------------------|--------------------------------------|
| `unavailable.network_error`                                | Yes            | 2 (1 retry)                | 2s then 8s before second try | `mcp_network_error`                  |
| `unavailable.rate_limited` (HTTP 429)                      | Yes            | 2                          | 2s then 8s                   | `mcp_rate_limited`                   |
| `unavailable.api_error` (HTTP 5xx)                         | Yes            | 2                          | 2s then 8s                   | `mcp_api_error`                      |
| `unavailable.url_missing`                                  | No (skip)      | 0                          | n/a                          | `mcp_url_missing` (run row written)  |
| `unavailable.token_missing`                                | No (skip)      | 0                          | n/a                          | `mcp_token_missing` (run row written)|
| `unavailable.parse_failure`                                | No             | 0                          | n/a                          | `mcp_parse_failure`                  |
| `unavailable.validation_failed` (schema mismatch)          | No             | 0                          | n/a                          | `mcp_validation_failed`              |
| HTTP 401 / 403 from MCP server                             | No             | 0                          | n/a                          | (covered by `mcp_api_error` today;   |
|                                                            |                |                            |                              |  the adapter does not distinguish    |
|                                                            |                |                            |                              |  401 from other 4xx — see §4.2 below)|
| Persisted-side: `persist_run_failed`                       | No             | 0                          | n/a                          | (no row; outcome `failed` in log)    |
| Persisted-side: `persist_results_failed:<code>`            | No             | 0                          | n/a                          | `persist_results_failed:<code>`      |
| Persisted-side: `argument_not_found`                       | No (skip)      | 0                          | n/a                          | (no run row; outcome `skipped`)      |
| Config skipped: `config_disabled`                          | No             | 0                          | n/a                          | (no run row; outcome `skipped`)      |
| Config skipped: `family_not_enabled`                       | No             | 0                          | n/a                          | (no run row; outcome `skipped`)      |
| Idempotency hit: existing `status='success'` row found     | No             | 0                          | n/a                          | (outcome `already_classified`)       |

### 4.2 — HTTP 401 / 403 reality check

The current adapter at
`supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts`
does NOT distinguish HTTP 401/403 from other 4xx/5xx errors. The current
mapping is:

```
!rawResponse.ok → 'rate_limited' if 429, else 'api_error'
```

That means a 401 (token rejected) maps to `'api_error'` today, which would
trigger 2 retries even though retries cannot help. This is a pre-existing
adapter behavior outside this card's scope — the intent brief Decision 5
specifies non-retryable for 401/403, but the existing adapter doesn't
expose the status code at this granularity.

**Decision:** Match the intent-brief table by adding a small auth-error
classification helper INSIDE `autoTriggerDispatcher.ts` (NOT in the
adapter): when `unavailable.api_error` is observed, check the
HTTP status code if exposed (the adapter would need a small additive
change to surface the raw HTTP status alongside the unavailable reason).

**Adapter scope decision:** Adding a status-code field to
`BooleanObservationAdapterResult.unavailable` is a small ADDITIVE change
to the adapter return type. It does NOT change the failure vocabulary
(the seven `unavailable` reasons stay the same); it just makes the HTTP
status visible to the dispatcher's retry decision. Document this in the
read-only-boundary list as a bounded edit (§11.2).

Without this small change, all `api_error` retries would still cap at
2 attempts (so total worst-case attempts is still 2), and the only cost
is one extra MCP roundtrip on a permanently-401 deployment — which is
operator-detectable via the `mcp_api_error` failure_reason in the run
row. The implementer MAY ship without the bounded adapter edit if test
forecast pressure requires; the dispatcher tracks the retry cap
correctly either way.

### 4.3 — Retry budget math

* Total worst-case retries per insert: 1 (so worst-case 2 MCP calls per
  argument).
* Retry total wall time worst case: 2s + 8s = 10s of backoff + 2 × 15s
  MCP timeout = ~40s.
* The 40s lives in the background of submit-argument's isolate via
  `EdgeRuntime.waitUntil`. Supabase Edge Function background-task
  budget is 150s (documented). 40s is well under budget.

### 4.4 — Retry metadata in the persisted run row

The MCP-021B `argument_machine_observation_runs` schema does NOT have an
`attempt_number` column. The brief's Decision 9 requirement says retry
attempts MUST be surfaced "in run metadata or structured logs."

**Decision:** Surface `attempt_number` in **structured logs only**
(not in a new schema column). Each retry emits its own
`mcp_021c_auto_trigger` log event with the `attempt_number` field.
The final outcome row in `argument_machine_observation_runs` captures
only the LAST attempt's terminal status + failure_reason; the earlier
attempts are visible only in the function logs.

This avoids a migration. If post-merge observability surfaces a need
to query retry counts directly from the DB, file
`OPS-MCP-OBSERVABILITY` (already in the deferred list) with an
additive `attempt_number INT NOT NULL DEFAULT 1` migration.

---

## §5 — Rate / cost guardrails (Phase A.5 binding)

### 5.1 — Expected production load

The intent brief asks for an `argumentInsertsPerHour` estimate. Source
truth:

* `submit-argument` is the only authentic insert path.
* Current Stage 6.4 production traffic: the test corpus and bot
  fixtures route through `submit-argument` and the persistence is
  visible in the linked Supabase project; the predecessor PROD-SMOKE
  Phase 4.1 observed at most 2 production runs per argument.
* Bot fixtures `bot:fixture:corpus:50` posted 625 moves across 50 rooms
  in a single bursty run (Stage 6.1.3.1 commit history) — that's the
  realistic upper bound of operator-driven inserts in a single hour.
* Real-user production traffic is currently zero (the app is
  pre-launch).
* **Working estimate for v1: 0–10 inserts/hour mean, with a
  worst-case bursty peak of ~600/hour during a bot-corpus run** (and
  even those runs are operator-gated by the existing
  `bot:fixture:ai:*` env flags).

### 5.2 — Cost per call

MCP server roundtrip cost is bounded by:

* One Anthropic `claude-haiku-4-5` call per argument (single-input
  classification call; MCP server enforces 16 Family A rawKeys per
  prompt).
* MCP-SERVER-002-SMOKE Phase 2.5 observed `time_total=3.93s` for one
  classifier call. Anthropic input-token usage was within the
  operator-deferred 6000-input-token threshold (Stage 6.1.3.2a).
* Per-call dollar cost is a function of Anthropic billing; the
  operator-deferred follow-ups
  (intent brief §9: `OPS-MCP-RATE-LIMITING`) cover budget
  enforcement.

### 5.3 — In-scope guards (this card ships)

Per intent brief Decision 7 binding list:

1. **`semantic_referee_runtime_config.enabled` gate.**
   `autoTriggerDispatcher.ts` reads the singleton runtime config row
   via the existing `get_semantic_referee_runtime_config()` SECURITY
   DEFINER RPC (the same RPC `semantic-referee` uses today; see
   `supabase/functions/_shared/semanticReferee/runtimeConfig.ts`). If
   `enabled === false`, the dispatcher skips with reason
   `'config_disabled'` BEFORE the MCP roundtrip. No run row written.
   Note: this config row's `provider_mode` field has four values
   (`'anthropic' | 'mock' | 'fixture' | 'mcp'`). The auto-trigger
   dispatcher respects only the `enabled` boolean — it does NOT
   condition on `provider_mode`, because the classifier path is
   already MCP-mode-only (the existing Edge Function uses the MCP
   adapter regardless of the runtime config's `provider_mode`).

2. **Family registry enablement gate.**
   `filterFamiliesForMode(['parent_relation'], 'production')` from
   `supabase/functions/_shared/booleanObservations/familyRegistry.ts:135`
   is called by the dispatcher. If the filter returns empty (i.e., if
   someone has flipped Family A's `productionEnabled` to false in
   the registry without filing a card), the dispatcher skips with
   reason `'family_not_enabled'`. No run row written.

3. **Idempotency pre-check.** Per §3 above; eliminates duplicate work
   from re-fires.

These three guards in combination cap the cost surface at 1 MCP call
per (argument × family × time-of-first-success). Cost is bounded.

### 5.4 — Deferred to `OPS-MCP-RATE-LIMITING`

Per intent brief Decision 7 deferred list:

* Concurrent / burst invocation caps (e.g., max 5 in-flight MCP calls
  globally).
* Per-debate rate limits (e.g., no more than 10 classifications per
  debate per 60s).
* Cost-budget enforcement (e.g., hard stop at $X/day Anthropic spend).
* Adaptive throttle on Anthropic 429 frequency.

These all require either a new persistence table (rate-limit counters)
or a new env-var driven config knob. None is justified at v1 scale.
The `OPS-MCP-RATE-LIMITING` card is fileable post-smoke if traffic
demands.

### 5.5 — Why this is sufficient for v1

The three in-scope guards mean that under any realistic v1 traffic
shape (≤600 inserts/hour during a bot-fixture burst, all on operator
control), the worst-case MCP traffic is bounded by:

* The argument-insert rate (capped by the operator's bot-fixture
  decision OR by genuine user behavior — both are small at v1).
* Times one MCP call per insert (deduplicated by §3.2 idempotency).
* Times worst-case 2 retries on transient failures (capped at 2
  attempts).
* Times zero for the OFF position of `enabled` (operator kill
  switch).

The operator kill switch (`enabled === false` on the singleton row) is
the highest-priority circuit breaker. It is settable from the existing
admin UI affordance under `admin-users.set_semantic_config` (verified
in `supabase/functions/admin-users/index.ts`); no new admin-UI surface
is needed for it.

---

## §6 — Data model / migration decision

### 6.1 — Migration count: **zero**

This card adds NO new migration. Rationale:

* Idempotency uses Option A (existing columns; §3 above).
* Rate/cost guards use the existing
  `semantic_referee_runtime_config` row (no schema change).
* Retry metadata lives in structured logs only (§4.4).
* No new table; no new column; no new index; no new RLS policy.

### 6.2 — Tables read/written by this card

| Table                                                | Read by         | Written by                | Notes |
|------------------------------------------------------|------------------|--------------------------|-------|
| `public.arguments`                                   | Existing pattern in `loadArgumentContext` (lifted into `classifyArgumentCore.ts`) | submit-argument (unchanged) | No change to read or write pattern. |
| `public.argument_machine_observation_runs`           | Pre-check SELECT in `autoTriggerDispatcher.ts` | `persistRun` (existing helper) | Idempotency SELECT is new; INSERT path unchanged. |
| `public.argument_machine_observation_results`        | (none — only the classifier writes; the response-summary fix's post-persist SELECT is preserved) | `persistResults` (existing helper) | Unchanged. |
| `public.semantic_referee_runtime_config`             | New SELECT via existing `get_semantic_referee_runtime_config()` RPC (already SECURITY DEFINER) | (none) | The RPC already returns `enabled`; we just call it from a new caller. |

All four tables have RLS enabled (cdiscourse-doctrine §8). The
auto-trigger dispatcher uses the service-role client (already in
submit-argument scope), which bypasses RLS for the audit writes —
identical posture to the existing classifier Edge Function.

---

## §7 — Source 6 rendering preservation (Phase A.6 binding)

### 7.1 — The filter line (read-only)

Source-confirmed at
`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`:

```ts
.eq('argument_machine_observation_runs.run_mode', 'production');
```

This line is byte-equal preserved by this card. The auto-trigger writes
`run_mode='production'` (per intent brief Decision 3 binding payload:
`"mode": "production"`), which matches the filter exactly. Source 6
renders auto-trigger results identically to manual-production-mode
results — the persistence query layer has no knowledge of "manual"
vs "auto" provenance.

### 7.2 — Admin-validation rows remain excluded

The current behavior (admin-validation rows are persisted for operator
audit but never reach Source 6 rendering) is preserved: the filter
line above strictly drops them. The auto-trigger does NOT call the
classifier in `mode='admin_validation'`; admin-validation remains the
manual-only path.

### 7.3 — Auto-triggered production rows render

Per the MCP-021C-FAMILY-A-PROD-SMOKE Phase 3 + Phase 4 evidence
(2026-05-26 audit), production-mode rows with the canonical identity
tuple render through Source 6 with the existing display caps
(Timeline 1 + overflow, Selected 3 + overflow, Inspect N grouped). The
auto-trigger writes rows with the identical tuple, so the rendering
path is exercised by an existing 36-suite / 839-test regression sweep.

### 7.4 — Tests pinning the filter (regression sweep)

These existing tests pin the filter at byte-equal:

* `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` — S6F-4
  asserts the exact `.eq('argument_machine_observation_runs.run_mode', 'production')`
  call.
* `__tests__/mcpOneTwoOneCEdgeBoundary.test.ts` — BND-5 asserts the
  inner-join + production filter at the query layer.
* `__tests__/mcpOneTwoOneCEdgeMigrationShape.test.ts` — MIG-6 + MIG-7
  pin the CHECK constraint + DEFAULT.
* `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` — pins
  `ALL_MACHINE_OBSERVATION_RUN_MODES === ['production', 'admin_validation']`.
* `__tests__/mcpOneTwoOneASourceSixInvariance.test.ts` — adapter
  byte-equal-on-empty-input.

This card's read-only-boundary test (file #5 in §9 below) explicitly
asserts byte-equality of `machineObservationPersistenceQuery.ts:127`
against the committed value, so any drift fails an explicit test in
this card's scope.

---

## §8 — Auth / security boundary (Phase A.8 binding)

### 8.1 — No client-side MCP secrets

Verified by source scan. The auto-trigger lives entirely in
`supabase/functions/`:

* `submit-argument` (existing — only changed in its post-insert tail).
* `autoTriggerDispatcher.ts` (new — Deno-side only).
* `classifyArgumentCore.ts` (new — Deno-side only; lifted from the
  classifier Edge Function).

No file under `src/` or `app/` imports any of the above. Existing tests
`mcpOneTwoOneCEdgeNoClientMcpFetch.test.ts` (SEC-7, SEC-8, SEC-9) and
`mcpOneTwoOneCEdgeNoClientMcpSecrets.test.ts` /
`mcpOneTwoOneCEdgeNoExpoPublicMcp.test.ts` already enforce this — they
scan `src/` + `app/` for forbidden imports. The new dispatcher file
inherits that protection; a new ban-list test (§9 file #4) extends
it explicitly to `classifyArgumentCore` and `autoTriggerDispatcher`.

### 8.2 — No service-role surface in app/client code

The submit-argument function already creates the service-role client
via `createServiceClient()` for its insert. The new dispatcher receives
that same `serviceClient` as a function argument from submit-argument;
it never re-imports `createServiceClient` itself in a way that could
leak. Verified by source-pattern test: the new
`autoTriggerDispatcher.ts` does NOT call `createServiceClient` (the
client is passed in), and `classifyArgumentCore.ts` does (matching the
existing classifier Edge Function's pattern, which is Edge-only).

### 8.3 — RLS preserved on `argument_machine_observation_runs` + `_results`

No new RLS policy. No edit to existing policies. The service-role write
posture is unchanged; the read posture
(`amor_runs_select_via_argument` + `amor_results_select_via_run`,
META-1A delegation) is unchanged.

### 8.4 — Trigger site doesn't bypass existing auth boundaries

submit-argument's existing auth chain holds:

1. `verify_jwt = true` in `config.toml` → request requires a valid user
   JWT.
2. `callerClient.auth.getUser()` → JWT verified against Supabase Auth.
3. Profile / debate / participant / authorization-matrix checks
   (lines 108-166 of submit-argument).
4. Constitution rules engine evaluation (lines 168-309).
5. **Argument INSERT happens.** (line 348-352)
6. QOL-040 notification side-effect (lines 619-752).
7. **NEW: auto-trigger dispatcher fires.** (post-line 752)
8. `return created(...)` (line 754-768).

The auto-trigger dispatcher runs **after** every existing auth gate.
It cannot bypass any of them because it can only be reached for
arguments that were validly inserted by the existing auth-checked
path. Source-pattern test (§9 file #1) asserts the dispatch call site
is **after** the QOL-040 notification block and **before** the
final `return created(...)`.

### 8.5 — How the auto-trigger obtains an authenticated invocation context without exposing service-role to client

This is the brief's load-bearing security question. The answer:

**The auto-trigger does NOT obtain authentication; it inherits the
already-authenticated submit-argument isolate's service-role client by
function-argument passing, with NO HTTP roundtrip.**

Specifically:

* The classifier Edge Function's existing `requireAdmin` gate is
  **PRESERVED for the HTTP endpoint**. Admins continue to invoke
  `/functions/v1/classify-argument-boolean-observations` directly
  for manual production runs and admin-validation runs, just as
  they do today.
* The auto-trigger path skips that HTTP endpoint entirely. It calls
  `classifyArgumentCore(...)` as a direct Deno function call inside
  the submit-argument isolate. There is no HTTP boundary to gate.
* The classifier core function does NOT do its own auth check — it
  trusts its caller (the classifier Edge Function handler) to have
  done the admin gate, OR (the new path) the submit-argument
  handler to have done its own JWT verification + RLS-checked
  authorization-matrix.
* The service-role client used by the dispatcher is the SAME service
  client submit-argument is already using. It is created INSIDE the
  submit-argument Edge Function, lives only in the Deno isolate, and
  is never exposed to the response body or the client.
* The submit-argument function's existing `verify_jwt = true` setting
  is the de-facto auth gate for the auto-trigger: only authenticated
  users can submit arguments, and only validly-submitted arguments
  trigger classifier work. The user does NOT need admin role to
  invoke the auto-trigger because the user is not invoking it
  directly — the server-side post-insert hook is.

This is identical in posture to how the QOL-040 notification
side-effect already works in submit-argument (lines 619-752): the
authenticated user inserts an argument; the server-side
`room_notifications` INSERT happens with the same service-role client;
the user never needs additional privileges.

### 8.6 — Doctrine §7 compliance (no AI calls from production app)

Verified: the new dispatcher and core are server-side only. The
production app continues to never import any AI-provider module. The
existing client-boundary tests
(`mcpOneTwoOneCEdgeNoClientMcpFetch.test.ts`,
`mcpOneTwoOneCEdgeNoClientMcpSecrets.test.ts`) cover the existing
`booleanObservationMcpAdapter` + `booleanObservationMcpAdapterCore` +
`persistenceWriter`. The new file `classifyArgumentCore.ts` and
`autoTriggerDispatcher.ts` get explicit ban entries in the new test
file (§9 file #4) so the same boundary holds for them.

---

## §9 — Test plan (Phase A.9)

### 9.1 — Forecast

Target band per intent brief §7: **+50 to +120 tests.**
HALT at +350.

**Forecast: ~+95 tests across 5 new files plus targeted regression
sweep.** Well within the target band; HALT trigger 23 is CLEAN.

### 9.2 — Test files (5)

Following the existing MCP-021C-EDGE source-scan + integration pattern
(`mcpOneTwoOneCEdge*.test.ts`):

| # | File                                                                        | Approx tests | Phenomenon                                                                                                                                    |
|---|------------------------------------------------------------------------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts`                          | ~25          | Trigger fires on new arg; payload shape; schema version pin; family scope (`parent_relation` only); mode (`production` only); idempotency call site is post-insert + post-notification, pre-return. |
| 2 | `__tests__/mcpOneTwoOneCAutoTriggerIdempotency.test.ts`                      | ~18          | Pre-INSERT SELECT exact shape (table + columns + filters); success-row found → skip; failed-row found → retry; absent → invoke; replay path at submit-argument:70-106 does NOT re-dispatch.        |
| 3 | `__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts`                      | ~22          | Each failure class from §4.1 table; retry-cap = 2 attempts for transients; non-retryable classes fire 0 retries; persisted run row carries the right `failure_reason`; submit-argument response is unchanged on failure. |
| 4 | `__tests__/mcpOneTwoOneCAutoTriggerSecurityBoundary.test.ts`                 | ~18          | No client import of `classifyArgumentCore` or `autoTriggerDispatcher`; no service-role surface in `src/` + `app/`; no raw arg-body / prompt / response / bearer / Authorization in any log emit; doctrine ban-list scan over `autoTriggerDispatcher.ts` source. |
| 5 | `__tests__/mcpOneTwoOneCAutoTriggerSourceSixRendering.test.ts`               | ~12          | Source 6 production filter at `machineObservationPersistenceQuery.ts:127` is byte-equal; auto-triggered rows render (production); admin-validation rows still excluded; UX-001.5A display caps unchanged. |

**Total: ~95 tests, 5 files.** Plus regression sweep verification
across `mcpOneTwoOneB|mcpOneTwoOneC|mcpOneTwoOneASourceSixInvariance|uxOneOneFiveA`
(36 suites / 839 tests per PROD-SMOKE Phase 5) must remain GREEN.

### 9.3 — Per-test scope and assertion pattern

**File 1 — `mcpOneTwoOneCAutoTriggerFamilyA.test.ts` (~25 tests)**

* `TRG-1` Source scan: `submit-argument/index.ts` imports
  `dispatchAutoTriggerForArgument` from
  `../_shared/booleanObservations/autoTriggerDispatcher.ts`.
* `TRG-2` Source scan: import statement is in the file's top-of-file
  import block, NOT inside any function body (eager import; tree-shake
  friendly).
* `TRG-3` Source scan: there is exactly ONE call to
  `dispatchAutoTriggerForArgument(` in submit-argument.
* `TRG-4` Source scan: the call site is AFTER the QOL-040 notification
  block (`submit_argument_notification_failed` appears earlier in the
  file than the dispatcher call).
* `TRG-5` Source scan: the call site is BEFORE the final
  `return created(` call.
* `TRG-6` Source scan: the call is NOT inside the
  `client_submission_id` early-return branch (the dispatcher call
  position is below `if (data.client_submission_id) { ... }` block
  AND below the `if (existingArg) {` early-return).
* `TRG-7` Source scan: the dispatch promise is NOT awaited at the
  call site (`await dispatchAutoTriggerForArgument(` regex returns
  zero matches).
* `TRG-8` Source scan: the call site uses `EdgeRuntime.waitUntil`
  (or a documented equivalent) to keep the isolate alive.
* `TRG-9` Source scan: dispatcher arguments are
  `insertedArg.id`, `data.debate_id`, `serviceClient` — no other
  arguments leaked.
* `TRG-10` Source scan: dispatcher promise has a `.catch(...)` clause
  so an unhandled rejection cannot bubble out and crash the isolate.
* `TRG-11` Source scan: dispatcher source declares
  `requestedFamilies = ['parent_relation']` as a literal (NOT
  pulled from a request body — auto-trigger never accepts an
  external family list).
* `TRG-12` Source scan: dispatcher source declares `mode = 'production'`
  as a literal (NOT computed).
* `TRG-13` Source scan: dispatcher source declares `schemaVersion`
  by importing `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` (not
  hardcoded a second time).
* `TRG-14` Module re-export: `classifyArgumentCore.ts` exports a
  function named `classifyOneArgumentCore` with the same signature
  shape as the existing `classifyOneArgument`.
* `TRG-15` Module structure: `classifyArgumentCore.ts` imports from
  `./booleanObservationMcpAdapter.ts`, `./mcpBooleanObservationSchema.ts`,
  `./familyRegistry.ts`, `./booleanObservationRequestBuilder.ts`,
  `./persistenceWriter.ts`, and `./machineObservationDefinitions.ts`
  (the existing shared modules — no new dependency).
* `TRG-16` Edge Function regression: the existing
  `classify-argument-boolean-observations/index.ts` continues to call
  `classifyOneArgumentCore` (after the refactor; the existing
  handler keeps its admin gate and HTTP envelope).
* `TRG-17` Admin gate regression: the existing
  `requireAdmin(req)` call site in the classifier Edge Function
  remains present.
* `TRG-18` Family scope: `autoTriggerDispatcher.ts` source contains
  `'parent_relation'` exactly once (the literal); no other family
  string literal appears.
* `TRG-19` Payload shape: the dispatcher's MCP request matches the
  binding payload from intent brief Decision 3 (argumentIds = single
  UUID, requestedFamilies = ['parent_relation'], mode = 'production',
  schemaVersion = the constant).
* `TRG-20` Doctrine ban-list scan over the dispatcher source: no
  verdict / winner / loser / true / false / correct / fallacy /
  liar / bad faith tokens.
* `TRG-21` Doctrine ban-list scan: no raw classifier raw_key
  surfaced in any string the dispatcher might log (raw_keys may
  appear as DATA in run rows, but never in a log message keyed by
  a user-readable field).
* `TRG-22` No EXPO_PUBLIC: source grep `EXPO_PUBLIC_` against the
  dispatcher returns zero matches.
* `TRG-23` Edge Function ban-list: dispatcher source does not import
  any `npm:@anthropic-ai/sdk` or any other AI-provider SDK directly
  (the MCP adapter is the sole MCP server boundary).
* `TRG-24` Type contract: dispatcher returns
  `{ outcome: 'triggered' | 'skipped' | 'already_classified' | 'failed', runId: string | null, skipReason?: string, failureReason?: string }`.
* `TRG-25` No console.log in committed dispatcher source (other than
  the structured-log helper which is allowed and tested in file #4).

**File 2 — `mcpOneTwoOneCAutoTriggerIdempotency.test.ts` (~18 tests)**

* `IDEM-1` Source scan: pre-check SELECT calls
  `.from('argument_machine_observation_runs')`.
* `IDEM-2` Pre-check filters by `argument_id` (`.eq('argument_id', ...)`).
* `IDEM-3` Pre-check filters by `schema_version`
  (`.eq('schema_version', MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION)`).
* `IDEM-4` Pre-check filters by `run_mode = 'production'`
  (`.eq('run_mode', 'production')`).
* `IDEM-5` Pre-check filters by `provider_key`
  (`.eq('provider_key', PROVIDER_KEY)`).
* `IDEM-6` Pre-check filters by `requested_families` containing
  `'parent_relation'` (`.contains('requested_families', ['parent_relation'])`
  or equivalent).
* `IDEM-7` Pre-check orders by `started_at` descending and limits
  to 1 (only the most-recent run is consulted).
* `IDEM-8` Branch: pre-check returns success row → dispatcher
  returns outcome `'already_classified'`.
* `IDEM-9` Branch: pre-check returns success row → no MCP adapter
  call is made (the adapter call site is past the pre-check
  guard).
* `IDEM-10` Branch: pre-check returns failed row → dispatcher
  proceeds (retry path; outcome eventually `'triggered'`).
* `IDEM-11` Branch: pre-check returns no row → dispatcher proceeds
  (outcome eventually `'triggered'`).
* `IDEM-12` Source scan: the SELECT does NOT use the service-role
  client through any new helper (uses the same serviceClient that
  was passed in).
* `IDEM-13` Source scan in `submit-argument/index.ts`: the
  dispatcher call is positioned AFTER the
  `if (data.client_submission_id)` replay branch's
  `if (existingArg) { return ok({...}); }` early return. (A
  client-replay-deduped insert does NOT re-dispatch the trigger.)
* `IDEM-14` Source scan: there is no second `dispatchAutoTriggerForArgument`
  call in the replay early-return branch.
* `IDEM-15` Outcome enum: dispatcher's return type discriminates
  `'triggered'` from `'already_classified'` from `'skipped'` from
  `'failed'`.
* `IDEM-16` Race-tolerance documentation: dispatcher source comment
  explicitly notes that Option A's race window is benign because
  Source 6 dedupes by `raw_key` per argument (per the §3 design
  rationale; the comment is part of the implementer's deliverable).
* `IDEM-17` Schema version pin: pre-check filters by the same
  constant `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` the dispatch
  payload pins (single source of truth).
* `IDEM-18` Doctrine: pre-check does NOT filter by `author_id` /
  `created_by` / engagement / heat — idempotency is a content-
  identity check, not an actor / popularity check (cdiscourse-
  doctrine §3).

**File 3 — `mcpOneTwoOneCAutoTriggerFailureMode.test.ts` (~22 tests)**

* `FAIL-1` to `FAIL-7`: For each of the 7 unavailable adapter
  reasons (`url_missing`, `token_missing`, `network_error`,
  `api_error`, `rate_limited`, `parse_failure`, `validation_failed`),
  assert the dispatcher records the matching `failure_reason`
  string from the existing mapping in
  `classify-argument-boolean-observations/index.ts:275-294`.
* `FAIL-8` Retry cap: transient classes (`network_error`,
  `api_error`, `rate_limited`) retry exactly once (2 total
  attempts).
* `FAIL-9` Backoff schedule: retry attempts use 2s then 8s waits
  (verified via source-pattern match for the constants).
* `FAIL-10` No retry: `url_missing` / `token_missing` /
  `parse_failure` / `validation_failed` do not retry (0 retries).
* `FAIL-11` Skip-on-disabled: when
  `semantic_referee_runtime_config.enabled === false`, dispatcher
  returns outcome `'skipped'` with `skipReason = 'config_disabled'`.
* `FAIL-12` Skip-on-disabled: when disabled, NO run row is
  persisted (verified via the absence of a `persistRun` call in
  the disabled-path branch).
* `FAIL-13` Skip-on-family-not-enabled: when
  `filterFamiliesForMode(['parent_relation'], 'production')`
  returns empty, dispatcher returns `'skipped'` with
  `skipReason = 'family_not_enabled'`.
* `FAIL-14` Submit-not-blocked: source-pattern check that the
  dispatcher promise is NOT in the submit-argument response's
  return path (the response returns the same shape regardless
  of dispatcher outcome).
* `FAIL-15` Submit-not-blocked: source-pattern check that the
  submit-argument handler does NOT inspect the dispatcher promise's
  resolution value before returning.
* `FAIL-16` Submit-not-blocked: source-pattern check that any
  thrown error from the dispatcher path is caught by a `.catch(...)`
  that returns undefined (the `.catch` runs in the background of
  the isolate; submit-argument response is already returned).
* `FAIL-17` Persistence: a failed MCP run still writes a run row
  with `status='failed'` and `failure_reason` set (verified via
  the existing `persistRun` call in `classifyArgumentCore` carrying
  the failed-status branch).
* `FAIL-18` Persistence: a failed MCP run writes zero result rows
  (the existing `classifyOneArgument` code path already does this;
  the lifted-shared core preserves it).
* `FAIL-19` Argument-not-found: when the loaded argument context is
  null (e.g., soft-deleted between insert and dispatch — extreme
  edge), dispatcher returns outcome `'skipped'` with
  `skipReason = 'argument_not_found'`. No run row written.
* `FAIL-20` Persist-failure: when `persistRun` returns `ok: false`,
  dispatcher returns outcome `'failed'` with
  `failureReason = 'persist_run_failed:...'`.
* `FAIL-21` Persist-results-failure: when `persistResults` returns
  `ok: false`, dispatcher returns outcome `'failed'` with
  `failureReason = 'persist_results_failed:...'` (the response-
  summary-fix code path is preserved).
* `FAIL-22` Defensive throw: dispatcher never throws — the entire
  body is wrapped in try/catch and any uncaught condition returns
  `{ outcome: 'failed', failureReason: 'unexpected_error' }`.

**File 4 — `mcpOneTwoOneCAutoTriggerSecurityBoundary.test.ts` (~18 tests)**

* `SEC-1` No client import of `autoTriggerDispatcher` from
  `src/` or `app/` (mirrors `mcpOneTwoOneCEdgeNoClientMcpFetch`
  pattern).
* `SEC-2` No client import of `classifyArgumentCore` from
  `src/` or `app/`.
* `SEC-3` No `createServiceClient` call inside
  `autoTriggerDispatcher.ts` (the service client is passed in).
* `SEC-4` `classifyArgumentCore.ts` is the only new file that may
  call `createServiceClient` (it doesn't have to — the existing
  Edge Function pattern is to pass the client in; either is
  acceptable).
* `SEC-5` Source ban: no `console.log` in the dispatcher source
  outside the dedicated structured-log helper (counts the `log`
  call surface explicitly).
* `SEC-6` Doctrine ban-list: scan the dispatcher source for
  `winner`, `loser`, `liar`, `true`, `false`, `correct`,
  `dishonest`, `bad faith`, `manipulative`, `extremist`,
  `propagandist`, `fallacy` — all absent.
* `SEC-7` No raw body logged: dispatcher source does NOT contain
  `body:` / `currentText:` / `parentText:` in any log emit
  (parameter-shape verification — log emits only short hashed/
  shortened identifiers).
* `SEC-8` Structured log fields: log emit carries `timestamp`,
  `argument_id` (UUID), `trigger_source`, `outcome`, optionally
  `skip_reason`, `run_id`, `failure_reason`, `attempt_number`,
  `latency_ms` — matches intent brief Decision 9 verbatim.
* `SEC-9` Forbidden log fields: log emit does NOT carry bearer
  tokens, API keys, service-role credentials, raw argument body,
  raw prompt, raw model response, user IDs. Verified by absence
  of the substring patterns `Bearer`, `Authorization`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `MCP_TOKEN`, `body:` in the log-builder's source.
* `SEC-10` No `EXPO_PUBLIC_` in dispatcher source.
* `SEC-11` No `npm:@anthropic-ai/sdk` import in dispatcher source.
* `SEC-12` No direct `fetch(` to an Anthropic / xAI / X API URL in
  dispatcher source (MCP adapter handles MCP fetch; dispatcher
  uses the adapter via the request builder).
* `SEC-13` RLS-aware: dispatcher source does NOT modify any
  existing RLS policy. (Verified by absence of `CREATE POLICY` /
  `DROP POLICY` patterns; the file has no SQL.)
* `SEC-14` Read-only boundary: dispatcher source does NOT modify
  `machineObservationPersistenceQuery.ts` at line 127. (Verified
  via byte-equality assertion against the committed value.)
* `SEC-15` Submit-argument auth gate: source assertion that
  submit-argument still calls `callerClient.auth.getUser()` before
  the dispatch (the dispatch position is after the auth gate).
* `SEC-16` Submit-argument JWT verification: source assertion that
  `verify_jwt = true` is set in
  `supabase/functions/submit-argument/config.toml` (if present; the
  default Supabase function config also enforces this).
* `SEC-17` Authentication context: dispatcher does NOT require
  admin role. Source pattern: dispatcher source does NOT contain
  `requireAdmin(` (admin gate is for the existing HTTP endpoint
  only).
* `SEC-18` Doctrine §10a — Observation kind: dispatcher records
  rows that carry `kind: 'machine_observation'` semantics
  (preserved by the existing `classifyOneArgumentCore` path; the
  dispatcher does not override the kind).

**File 5 — `mcpOneTwoOneCAutoTriggerSourceSixRendering.test.ts` (~12 tests)**

* `S6R-1` Byte-equal pin: read
  `src/features/nodeLabels/machineObservationPersistenceQuery.ts`
  and assert line 127 is exactly
  `      .eq('argument_machine_observation_runs.run_mode', 'production');`
  (verbatim including the leading whitespace).
* `S6R-2` The `!inner` join on the runs table is present at line 74
  (verified via the existing test
  `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts:S6F-4` — this
  card's test references it for explicit re-verification).
* `S6R-3` Admin-validation rows are still excluded by the filter
  (re-runs the existing assertion).
* `S6R-4` Auto-triggered production rows render through Source 6:
  use the existing UX-001.5A presentation-model tests' fixtures
  with a freshly-shaped persisted-row representing an
  auto-trigger output; assert the chip emits.
* `S6R-5` UX-001.5A display caps unchanged: timeline cap is still
  1+overflow, selected cap is still 3+overflow, inspect cap is
  still N grouped. (Verified by existing `uxOneOneFiveA*` tests
  remaining GREEN; this test asserts the byte-equality of the
  cap-relevant source files.)
* `S6R-6` MCP-021A taxonomy unchanged: byte-equality of the 16
  Family A entries in
  `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`
  against a snapshot committed in the fixtures.
* `S6R-7` MCP-021A schema version unchanged: byte-equality of
  `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` at
  `src/features/nodeLabels/mcpBooleanObservationSchema.ts:36-37`.
* `S6R-8` MCP server prompt unchanged: out of repo scope (lives in
  Deno Deploy MCP server); the existing read-only-boundary list in
  the design's §12 names this explicitly. This test asserts no file
  under `supabase/functions/_shared/booleanObservations/` changes
  the byte sequence of the existing MCP request body shape (the
  request builder remains byte-equal).
* `S6R-9` Run-mode preserved: the new dispatcher writes
  `run_mode = 'production'` (verified by source-pattern match).
* `S6R-10` Run-mode never weakened: byte-equality of the
  migration `20260526000019_mcp_021c_edge_run_mode.sql` against a
  snapshot.
* `S6R-11` Schema-version mismatch: any persisted row with a
  schemaVersion other than the canonical value is dropped by the
  adapter (existing behavior; re-verified).
* `S6R-12` Unknown raw_key: any persisted row with an unknown
  raw_key is dropped by the adapter (existing behavior; re-verified
  for completeness — the auto-trigger never writes unknown keys
  because the sanitizer drops them upstream).

### 9.4 — Regression sweep

Per PROD-SMOKE Phase 5, this regression sweep must remain green:

```
npx jest --testPathPattern "(mcpOneTwoOneB|mcpOneTwoOneC|mcpOneTwoOneASourceSixInvariance|uxOneOneFiveA)"
```

Expected: 36+ suites, 839+ tests (the existing baseline) plus the
new ~95 tests across the 5 new files in this card.

### 9.5 — Why the test forecast is small relative to the design weight

The implementation surface is intentionally small:

* Most of the per-argument classifier logic already exists in
  `classify-argument-boolean-observations/index.ts:305-489` — the
  refactor lifts it into a shared module. The existing 30+
  function-handler tests cover the behavior; this card adds tests
  for the new dispatcher wiring and the new idempotency / retry
  logic only.
* The auth boundary is preserved verbatim (existing tests cover the
  client-import + service-role-leak bans). This card adds boundary
  tests specific to the two new files.
* No new migration → no new migration-shape tests.
* No new RLS policy → no new RLS tests.
* No new UI surface → no UX-001 / UX-001.5A test additions.

This is consistent with intent brief §7's target band of +50 to +120
and well below the +350 HALT.

---

## §10 — Smoke plan (Phase A.10)

### 10.1 — Three-phase post-merge smoke

To be run by the operator AFTER merge using a freshly-inserted argument
on the linked Supabase project. Full 9-phase audit will be at
`docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-<YYYY-MM-DD>.md`.

#### Phase 1 — Trigger fires on new arg (verifies trigger wiring)

**Setup:** Operator-authenticated session. Pick an existing public
debate (e.g., the Onboarding apology room used in PROD-SMOKE:
`1e598dce-8188-4c7e-bdd6-aedede750923`).

**Action:** Insert a new test argument via the standard mobile-app
path (`submitArgumentDraft` → `submit-argument`). Capture the
returned `argumentId`.

**Wait:** 30 seconds.

**Verify:**

```sql
SELECT id, argument_id, run_mode, status, schema_version,
       requested_families, provider_key, failure_reason,
       started_at, completed_at
FROM public.argument_machine_observation_runs
WHERE argument_id = '<new-arg-id>'
ORDER BY started_at DESC
LIMIT 1;
```

**Expected:** 1 row, `run_mode='production'`, `status='success'`
(or `status='failed'` with a legitimate `failure_reason` like
`mcp_network_error` — a network transient is a Phase 1 PASS for the
wiring; a clean repro is captured in Phase 3 below).

**Phase 1 verdict:** PASS if the row exists with `run_mode='production'`
within 30s. FAIL if no row exists after 60s.

#### Phase 2 — Idempotency holds on duplicate event

**Setup:** Take the `argumentId` from Phase 1.

**Action:** Manually invoke the classifier Edge Function for the
SAME argument:

```
POST /functions/v1/classify-argument-boolean-observations
{
  "argumentIds": ["<phase-1-arg-id>"],
  "requestedFamilies": ["parent_relation"],
  "mode": "production",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

**Verify:**

```sql
SELECT COUNT(*) AS total_runs,
       COUNT(*) FILTER (WHERE status='success') AS success_runs
FROM public.argument_machine_observation_runs
WHERE argument_id = '<phase-1-arg-id>'
  AND run_mode = 'production';
```

**Expected (Option A semantics):**

* Total runs ≥ 1.
* The manual call may produce an additional run row (Option A does
  NOT prevent two production-mode runs for the same argument when
  invoked through different code paths — the dispatcher's idempotency
  pre-check only fires from the auto-trigger path).
* The Source 6 rendering remains unique per `raw_key` (no
  per-argument display duplication, verified by inspecting the
  argument in the UI OR by:

```sql
SELECT raw_key, COUNT(*) AS n_dup
FROM public.argument_machine_observation_results r
JOIN public.argument_machine_observation_runs run ON run.id = r.run_id
WHERE r.argument_id = '<phase-1-arg-id>'
  AND run.run_mode = 'production'
GROUP BY raw_key
HAVING COUNT(*) > 1;
```

**Phase 2 verdict:** PASS if Source 6 dedupes (zero rows from the
HAVING clause). The dispatcher's pre-check is verified to fire
correctly via a separate auto-trigger-only test in Phase 2.5 below.

#### Phase 2.5 — Auto-trigger idempotency (the actual brief contract)

**Setup:** Take the `argumentId` from Phase 1.

**Action:** Operator forces a re-dispatch of the auto-trigger from a
test harness (separate from the mobile-app submit path) — e.g., a
local Deno test that imports `dispatchAutoTriggerForArgument` and
invokes it manually with the test argument's ID and a service-role
client (operator territory; not production code).

**Verify:** Dispatcher returns `outcome: 'already_classified'`,
`runId: <phase-1-run-id>`, and writes ZERO new rows to
`argument_machine_observation_runs`.

**Phase 2.5 verdict:** PASS if the second auto-trigger call returns
`'already_classified'` and writes zero new rows.

#### Phase 3 — Failure doesn't block submit

**Setup:** Temporarily disable the runtime config:

```sql
UPDATE public.semantic_referee_runtime_config
SET enabled = false
WHERE id = true;
```

**Action:** Insert a new test argument via the mobile-app path.

**Verify:**

* Insert succeeds; the user sees a 201 response with the
  argument body (submit-argument behavior unchanged).
* No new run row is written for this argument ID (the dispatcher
  skipped per `'config_disabled'`).
* Function logs show a `'skipped'` outcome with
  `skip_reason='config_disabled'`.

**Restore:**

```sql
UPDATE public.semantic_referee_runtime_config
SET enabled = true
WHERE id = true;
```

**Phase 3 verdict:** PASS if the argument inserts successfully AND
the runtime-config gate stops the dispatch as designed.

### 10.2 — Operator audit document

Post-smoke, the operator records the three phases (plus 6 additional
audit phases — see launch brief's mention of a full 9-phase audit)
at `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-<YYYY-MM-DD>.md`.
The standard verdict structure follows the predecessor PROD-SMOKE
document (`docs/audits/MCP-021C-FAMILY-A-PROD-SMOKE-2026-05-26.md`).

### 10.3 — Smoke verdict rules

* **PASS** = all three phases PASS. Authorize next-card filing
  (`MCP-SERVER-003` Family B template, `ADMIN-MCP-001` UI flip,
  `MCP-021C-AUTO-TRIGGER-FAMILY-B` queued as future).
* **PARTIAL** = Phase 1 PASS but Phase 2.5 or Phase 3 PARTIAL.
  File a small fix card scoped to the specific defect (e.g.,
  `MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING` if
  Option A surfaced a real race in production).
* **FAIL** = Phase 1 FAILs (dispatch did not fire). File
  `MCP-021C-AUTO-TRIGGER-FAMILY-A-FIX` and pause Family B
  enablement.

---

## §11 — Read-only boundary list

### 11.1 — MAY modify (bounded)

This card may modify ONLY:

* **New:** `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts`
  (lifted from
  `supabase/functions/classify-argument-boolean-observations/index.ts:305-489`).
* **New:** `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`.
* **New:** `supabase/functions/_shared/booleanObservations/autoTriggerLog.ts`
  (the structured-log helper; isolated for test surface clarity).
* **Bounded edit:** `supabase/functions/submit-argument/index.ts` — single
  call-site addition AFTER the QOL-040 notification block and BEFORE
  the final `return created(...)`. No change to the JWT verification,
  authorization matrix, constitution evaluation, argument insert, or
  notification side-effect.
* **Bounded edit:** `supabase/functions/classify-argument-boolean-observations/index.ts` —
  refactor only: replace the inline `classifyOneArgument` function
  body with a call to `classifyOneArgumentCore`. The HTTP handler
  contract, the `requireAdmin` gate, the request validation, and
  the response shape MUST be byte-equal-after-refactor (no semantic
  change). Verified by `TRG-16`, `TRG-17`, and the existing
  `mcpOneTwoOneCEdgeFunctionHandler.test.ts` + `mcpOneTwoOneCEdgeResponseSummaryFix.test.ts`
  remaining GREEN.
* **OPTIONAL bounded edit:** `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts`
  and `booleanObservationMcpAdapterCore.ts` — only if the implementer
  decides to surface the HTTP status code on `unavailable.api_error`
  results (per §4.2 above). Strictly additive to the return type;
  no change to the seven `unavailable` reasons. May be deferred.
* **New:** `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts`,
  `mcpOneTwoOneCAutoTriggerIdempotency.test.ts`,
  `mcpOneTwoOneCAutoTriggerFailureMode.test.ts`,
  `mcpOneTwoOneCAutoTriggerSecurityBoundary.test.ts`,
  `mcpOneTwoOneCAutoTriggerSourceSixRendering.test.ts`.
* **New:** This design doc (`docs/designs/MCP-021C-AUTO-TRIGGER-FAMILY-A.md`).
* **Bounded edit:** `docs/core/current-status.md` — append a handoff
  section at the END (after the existing MCP-021B/C/PROD-SMOKE
  entries); no edit to any prior entry.

### 11.2 — MAY NOT modify (byte-equal hard)

This card MUST NOT touch the byte sequence of any of the following:

* `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
  — the Source 6 production filter. **Byte-equal required.**
* `src/lib/constitution/engine.ts` — pure TS rules engine; no
  network, no React.
* `src/features/nodeLabels/` adapter contracts — MCP-021A / 021B
  byte-equal invariants.
* `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`
  (and B-J) — MCP-021A taxonomy.
* `src/features/nodeLabels/mcpBooleanObservationSchema.ts` —
  MCP-021A schema definition (parser, sanitizer, request builder,
  schema-version constant).
* `src/features/nodeLabels/machineObservationRegistry.ts` —
  registry helpers.
* `src/features/nodeLabels/nodeLabelPresentationModel.ts` —
  UX-001.5A display caps.
* `src/features/nodeLabels/nodeLabelPriorityModel.ts` — UX-001.5A
  priority model.
* `src/features/nodeLabels/userAllegationRegistry.ts` — User
  Allegations registry.
* All existing migrations under `supabase/migrations/`. The new
  migration count for this card is ZERO.
* `supabase/functions/_shared/booleanObservations/familyRegistry.ts`
  — `productionEnabled` flips are out of scope.
* `supabase/functions/_shared/booleanObservations/persistenceWriter.ts`
  — service-role write helper byte-equal.
* `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts`
  — request shape byte-equal (the auto-trigger uses it verbatim).
* `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts`
  — parser/sanitizer mirror byte-equal.
* `supabase/functions/_shared/booleanObservations/machineObservationDefinitions/*.ts`
  — server-side taxonomy mirror byte-equal.
* `supabase/functions/_shared/booleanObservations/runModeConstants.ts`
  — run mode enum byte-equal.
* `supabase/functions/_shared/booleanObservations/nodeLabelTypes.ts`
  — type-only re-exports byte-equal.
* MCP server source (Deno Deploy `cdiscourse-mcp-server`) — out of
  repo scope; this card never touches it.
* `package.json` / `package-lock.json` — no new deps.

---

## §12 — HALT trigger table (25 from intent brief)

Every trigger from intent brief §5 reproduced here. For each, this
design's posture is recorded with one-line justification.

### Protocol + Security (1-9)

| # | Trigger                                                                    | Posture       | Justification |
|---|-----------------------------------------------------------------------------|---------------|---------------|
| 1 | Proposes client-side MCP call                                              | NOT TRIGGERED | All MCP execution is in `supabase/functions/`; §8.1 + §11.2 byte-equal client boundary tests. |
| 2 | Proposes `EXPO_PUBLIC_*` MCP credentials in client bundle                  | NOT TRIGGERED | No env-var change; existing `mcpOneTwoOneCEdgeNoExpoPublicMcp.test.ts` is preserved. |
| 3 | Proposes exposing MCP bearer token / Anthropic key / service-role key to client | NOT TRIGGERED | The dispatcher receives the service-role client by function-argument from submit-argument; no client surface. §8.2. |
| 4 | Proposes client-JWT writes to Machine Observation persistence              | NOT TRIGGERED | Writes use the existing service-role helper `persistRun` / `persistResults` only. |
| 5 | Proposes disabling or weakening Source 6 `run_mode='production'` filter    | NOT TRIGGERED | Byte-equal preserved at `machineObservationPersistenceQuery.ts:127`; explicit test SEC-14 + S6R-1. |
| 6 | Proposes rendering admin_validation rows as production chips               | NOT TRIGGERED | No change to the Source 6 query filter; admin_validation rows remain excluded. §7.2. |
| 7 | Proposes service-role client invocation from app/client code               | NOT TRIGGERED | Service-role lives only in `supabase/functions/`. Client-boundary scan tests SEC-1/2/3. |
| 8 | Logs raw argument body, raw prompt, raw model response, bearer token, or API key | NOT TRIGGERED | Structured log emits only the fields enumerated in intent brief Decision 9; SEC-7 + SEC-8 + SEC-9. |
| 9 | Proposes RLS weakening on `argument_machine_observation_runs` or `_results` | NOT TRIGGERED | No RLS change; no migration. §6.1. |

### Scope (10-17)

| # | Trigger                                                                    | Posture       | Justification |
|---|-----------------------------------------------------------------------------|---------------|---------------|
| 10 | Proposes enabling family other than `parent_relation`                     | NOT TRIGGERED | Dispatcher hard-codes `requestedFamilies = ['parent_relation']` (TRG-11, TRG-18). |
| 11 | Proposes changing MCP-021A schema version                                 | NOT TRIGGERED | Dispatcher imports `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant; TRG-13. |
| 12 | Proposes changing any taxonomy key                                        | NOT TRIGGERED | Family A registry is byte-equal preserved; S6R-6. |
| 13 | Proposes changing the MCP server prompt                                   | NOT TRIGGERED | MCP server source out of repo scope; §11.2. |
| 14 | Proposes changing UX-001.5A display caps                                  | NOT TRIGGERED | Cap source files byte-equal preserved; S6R-5. |
| 15 | Proposes new visual primitive or design token                             | NOT TRIGGERED | No UI surface in this card. |
| 16 | Proposes historical / backfill mode in this card                          | NOT TRIGGERED | Backfill is deferred to `MCP-021C-FAMILY-A-BACKFILL`; intent brief §9 + §13.7. |
| 17 | Proposes modifying Family A classifier behavior on the MCP server side    | NOT TRIGGERED | No MCP server change; the classifier core is lifted unchanged (refactor only). TRG-16. |

### Architecture (18-23)

| # | Trigger                                                                    | Posture       | Justification |
|---|-----------------------------------------------------------------------------|---------------|---------------|
| 18 | Proposes auto-trigger without idempotency strategy                         | NOT TRIGGERED | Option A documented + pre-check enforced. §3. |
| 19 | Proposes auto-trigger without retry / failure semantics                    | NOT TRIGGERED | Bounded retry policy (2 attempts for transients) + failure-mode table. §4. |
| 20 | Proposes auto-trigger without rate / cost protection (even minimal)        | NOT TRIGGERED | Three guards in scope: enabled gate, family gate, idempotency. §5.3. |
| 21 | Proposes auto-trigger that blocks argument submission on classifier completion | NOT TRIGGERED | Fire-and-forget via `EdgeRuntime.waitUntil`; submit response returns BEFORE dispatch settles. §2.4. |
| 22 | Proposes running classifier synchronously in the UI submit path            | NOT TRIGGERED | Classifier runs in the server-side isolate's background, not the UI submit path. §2. |
| 23 | Test count forecast exceeds +350                                           | NOT TRIGGERED | Forecast: ~+95; well below ceiling. §9.1. |

### Doctrine + Working Tree (24-25)

| # | Trigger                                                                    | Posture       | Justification |
|---|-----------------------------------------------------------------------------|---------------|---------------|
| 24 | Verdict / winner / correctness / fallacy / bad-faith language in user-facing strings | NOT TRIGGERED | No user-facing string added; doctrine ban-list scans in TRG-20 + SEC-6. |
| 25 | Working tree contains unclassified untracked files at PR creation         | NOT TRIGGERED | Known exclusions (`docs/testing-runs/*-corpus*.md`, `netlify-prod.git`, transient smoke artifacts) tracked per intent brief §5; design phase commits ONLY this design doc. |

**Status: 25/25 CLEAN.** Design proceeds.

---

## §13 — Brief ledger

This brief is **operator-authored** (`docs/designs/MCP-021C-AUTO-TRIGGER-FAMILY-A-intent.md`
at `f2078cd`). The designer phase below names each adjudication.

| Item                          | Value                                                                            |
|-------------------------------|----------------------------------------------------------------------------------|
| Card                          | MCP-021C-AUTO-TRIGGER-FAMILY-A                                                    |
| Effort                        | M-L (design-heavy)                                                                |
| Predecessor                   | MCP-021C-FAMILY-A-PROD-SMOKE PASS (`67fcba5`)                                     |
| HALT triggers                 | 25 (intent brief §5) — 25/25 CLEAN this design                                    |
| Binding decisions             | 10 (intent brief §4) — all adopted verbatim                                       |
| Phase A audits                | 10 (A.1 – A.10) — all addressed in §1-§10 of this design                          |
| Trigger-site decision         | Phase A.2 — **Shared in-process helper invoked from `submit-argument` via fire-and-forget non-blocking dispatch** (§2.2) |
| Idempotency option            | Phase A.3 — **Option A (query-before-create with existing columns; no new migration)** (§3.1) |
| Retry policy                  | Phase A.4 — Bounded; 2 attempts for transients (network/429/5xx); 0 for parser/validation/auth/skip (§4.1) |
| Rate / cost in scope          | Phase A.5 — Three guards: enabled gate, family gate, idempotency. Cost-budget + concurrency caps deferred to `OPS-MCP-RATE-LIMITING` (§5.3 + §5.4) |
| Source 6 preservation         | Phase A.6 — Byte-equal pin at `machineObservationPersistenceQuery.ts:127` (§7.1) |
| Backfill                      | Phase A.7 — Out of scope; deferred to `MCP-021C-FAMILY-A-BACKFILL` (§1.2) |
| Auth / security boundary      | Phase A.8 — Auto-trigger inherits submit-argument's already-authenticated service-role context; no HTTP roundtrip, no widening of classifier admin gate (§8.5) |
| Test forecast (target)        | +50 to +120 (intent brief §7)                                                     |
| Test forecast (this design)   | ~+95 across 5 new files                                                            |
| Test forecast HALT threshold  | +350 (NOT TRIGGERED)                                                              |
| Smoke plan                    | 3 phases minimum (Phase 1 = trigger fires; Phase 2 = idempotency; Phase 3 = failure doesn't block). Full 9-phase audit post-merge by operator. §10. |
| Operator gates                | Stage 2A conditional (designer phase) + Stage 2B mandatory (pre-implementer)      |
| Post-merge smoke              | 9-phase audit at `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-<YYYY-MM-DD>.md` |
| Brief author                  | Operator (per intent brief §11)                                                   |
| Designer phase author         | Roadmap-designer subagent (this document)                                          |

### 13.1 — Designer-phase adjudications

The operator-authored brief is binding on every Decision (1-10) and
every HALT trigger (1-25). The designer phase makes the following
adjudications WITHIN the brief's bounds:

1. **Trigger-site decision (Phase A.2).** Selected option 2 of the
   brief's preferred ordering ("server-side fire-and-forget invocation
   after argument write"), but chose the **shared-helper-no-HTTP**
   pattern over the Edge-to-Edge HTTP pattern. The brief allows either;
   the shared-helper pattern requires no auth-boundary widening and
   no new function-secret.
2. **Idempotency option (Phase A.3).** Adopted the brief's stated
   default (Option A) with explicit race-condition reasoning.
3. **Auth boundary (Phase A.8).** Resolved the brief's load-bearing
   question by avoiding the HTTP roundtrip entirely. The classifier's
   `requireAdmin` gate stays intact for the existing HTTP endpoint;
   the auto-trigger path uses a direct function call inside an
   already-authenticated isolate.
4. **`EdgeRuntime.waitUntil` introduction.** Not previously used in
   this codebase. Documented as the canonical Supabase background-task
   pattern; falls back gracefully when absent (local Deno run /
   jest). The fallback path may produce a dispatch that is
   killed when the isolate terminates, but local Deno + jest never
   serve real production traffic, so this is acceptable.
5. **HTTP-401/403 retry classification (§4.2).** The current adapter
   doesn't distinguish 401 from other 4xx/5xx; the design proposes a
   small optional additive change to surface the status code. The
   implementer MAY ship without it; the worst-case extra retry is
   one extra MCP call on a permanently-401 deployment, which is
   operator-detectable.
6. **Retry metadata in logs only (§4.4).** No new schema column for
   `attempt_number`. Defers the column to `OPS-MCP-OBSERVABILITY` if
   needed.
7. **Test count vs design weight (§9.5).** The implementation surface
   is intentionally small because most of the per-argument classifier
   logic already exists; the refactor reuses it. The test forecast
   reflects this.

### 13.2 — Operator-deferred review items (post-ship)

Three items defer to post-smoke operator decision:

1. **Whether to file `MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING`
   (Option B migration).** Only if production traffic surfaces duplicate
   run rows for the same argument. Default: leave Option A.
2. **Whether to surface the HTTP status code on `unavailable.api_error`
   (the optional adapter additive in §4.2).** Operator decides based
   on whether the implementer ships it or defers.
3. **Whether to enable Family B (`MCP-021C-AUTO-TRIGGER-FAMILY-B`)
   immediately after this card's smoke PASS, OR to wait one cycle to
   observe production traffic stability on Family A.** This is an
   operator-tempo call.

### 13.3 — Doctrine self-check

| Doctrine skill                  | This design's compliance |
|---------------------------------|---------------------------|
| cdiscourse-doctrine §1 (no truth labels) | Machine Observations remain advisory; no verdict / winner / loser language. TRG-20 + SEC-6 enforce. |
| cdiscourse-doctrine §2 (heat is activity, not truth) | No heat / engagement / popularity input or output. |
| cdiscourse-doctrine §3 (popularity is not evidence) | No engagement input; no view counts; no retweet counts. |
| cdiscourse-doctrine §4 (AI moderator hard limits) | Classifier produces advisory Observations; never deletes / hides / modifies content; `authoritative: false` semantics preserved at the Source 6 render layer. |
| cdiscourse-doctrine §5 (rules engine is sacred) | `src/lib/constitution/engine.ts` byte-equal preserved. |
| cdiscourse-doctrine §6 (secrets policy) | `SEMANTIC_REFEREE_MCP_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` all server-only. No client surface. SEC-1 through SEC-12. |
| cdiscourse-doctrine §7 (no AI calls from production app) | All MCP work in `supabase/functions/`; client boundary tests SEC-1 + SEC-2. |
| cdiscourse-doctrine §8 (Supabase conventions) | RLS preserved; no migration edited; soft-delete semantics unchanged. |
| cdiscourse-doctrine §9 (plain language for users) | No new internal-code surface; Source 6 continues to render plain-language labels. |
| cdiscourse-doctrine §10a (Observations vs Allegations) | Auto-trigger writes Machine Observations only; the `kind: 'machine_observation'` semantics preserved at Source 6. |
| cdiscourse-doctrine §10 (v1 scope guards) | No voting, scoring-with-winner, real-time collaborative editing, OAuth, public API, push notifications, or argument search introduced. |
| test-discipline | 5 new test files; ~95 tests; below +350 ceiling; aggregate-test pattern with multiple `it()` cases per file; ban-list test (TRG-20 + SEC-6) + plain-language coverage preserved. |
| expo-rn-patterns | No new dep; no UI change; no new RN primitive. |
| supabase-edge-contract | Standard Edge Function shape preserved; service-role write only inside the function; sanitized errors; no secret echo. The fire-and-forget pattern uses Supabase's documented `EdgeRuntime.waitUntil`. |
| evidence-doctrine | Family A keys are parent-relation structural facts; not evidence artifacts; anti-amplification semantics preserved (no engagement input). |

---

## §14 — Operator steps (post-merge)

1. **Auto-merge applies code change + redeploys submit-argument and
   classify-argument-boolean-observations** via the Supabase GitHub
   integration (no manual migration; this card adds none).

2. **Verify both functions deployed:**
   ```
   npx supabase functions list --linked
   ```
   Expected: `submit-argument` and
   `classify-argument-boolean-observations` both ACTIVE with
   updated `updated_at` timestamps post-merge.

3. **Verify the runtime config:**
   ```
   npx supabase db query --linked --query "
     SELECT id, provider_mode, enabled
     FROM public.semantic_referee_runtime_config
     WHERE id = true;
   "
   ```
   Expected: `enabled = true`, `provider_mode = 'mcp'`.

4. **Run the 3-phase smoke per §10.1.**

5. **Record results at
   `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-<YYYY-MM-DD>.md`.**

6. **On PASS:** authorize next cards per intent brief §9.

7. **On PARTIAL or FAIL:** file the corresponding fix card and
   reduce production traffic flag if needed
   (`UPDATE public.semantic_referee_runtime_config SET enabled = false`
   — operator kill switch).

---
