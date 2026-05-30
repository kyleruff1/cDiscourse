# ARCH-001 — Civil Discourse classifier queue architecture

**Status:** APPROVED as implementation basis (operator, 2026-05-30). Committed design draft — no production code, migration SQL, runtime flag, or deploy yet. Implementation staged: Card 1 (DB substrate), Card 2 (drainer + enqueue behind smoke-only flag), Card 3 (production smoke + staged rollout). Three operator confirmations pending: Anthropic tier, Edge plan, pg_cron granularity.
**Epic:** Epic 12 / MCP semantic-referee track (Civil Discourse classifier infrastructure)
**Release:** Stage 2B successor — supersedes Option A (`OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md`)
**Issue / trail:** source spec absorbed into this document; GitHub issue #373 is the durable trail.
**Supersedes:** `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md` (Option A — Deno-KV in-MCP-server admission limiter; relabelled rejected/alternative, committed `f659d58`). Harvested concepts only; Option A's KV mechanism is NOT used.

> **Doctrine acceptance-gate constraint (HARD, repeated at the top because it is the spine of this design):**
> AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine
> (`src/lib/constitution/engine.ts`) remains the sole acceptance gate. Classifiers run **AFTER** an
> argument is stored. No classifier path designed here may block, reject, route, or delay an ordinary
> post. The queue makes this *more* true than today: submit only ENQUEUES (a fast local INSERT, no
> provider call), then returns 201. All provider work moves off the submit path entirely.

> **What this card touches:** Supabase-side only — a queue surface, an enqueue call, a drainer Edge
> Function, a single-flight mechanism, a feature flag, and monitoring. **The MCP server provider path
> (`callAnthropic`, the per-isolate `providerConcurrencyGate`) is touched ZERO times. No MCP-server
> redeploy is required by this card.** No change to prompts, taxonomy, family keys, schema mirror,
> Source 6, audit-lint, `package.json`, the A–G family set, or production flags.

---

## Investigation ledger — verified project capabilities (read-only, cited)

Every number below was verified read-only against THIS project on 2026-05-30, or cited from vendor
docs. Where a fact could not be verified read-only it is marked **PARTIAL** and carried into the
verdict per the card's PARTIAL rules.

| # | Capability | Finding | Source (verified read-only) |
|---|---|---|---|
| I1 | **pg_cron** | Available `v1.6.4`, **NOT installed** (`installed_version: null`). No `cron` schema exists yet. No `cron.schedule(...)` call anywhere in `supabase/migrations/`. | `SELECT … FROM pg_available_extensions` + `pg_extension` + `pg_namespace` + Grep of migrations |
| I2 | **pg_cron sub-minute granularity** | Supabase Cron docs state jobs "can run anywhere from every second to once a year"; `'N seconds'` interval syntax exists (e.g. `'30 seconds'`). **BUT** community reports flag sub-minute reliability caveats on some instances. **Marked PARTIAL** — design does NOT depend on sub-minute; periodic tick floor = 1 minute. | `supabase.com/docs/guides/cron`; GitHub supabase/discussions #18274 |
| I3 | **pg_net** | Available `v0.20.0`, **NOT installed**. No `net.http_post`/`net.http_get` call anywhere in migrations. Required to invoke an Edge Function from cron/trigger SQL. | `pg_available_extensions` + Grep |
| I4 | **pgmq (Supabase Queues)** | Available `v1.5.1`, **NOT installed**. A candidate queue substrate (evaluated + rejected in A.3). | `pg_available_extensions` |
| I5 | **Supabase Vault** | **Installed** `v0.3.1`; `vault` schema present. The recommended store for the cron→Edge service credential (`vault.create_secret` / `vault.decrypted_secrets`). | `pg_extension` + `pg_namespace` |
| I6 | **Other installed extensions** | `pgcrypto 1.3`, `uuid-ossp 1.1`, `plpgsql 1.0`, `pg_stat_statements 1.11`. `gen_random_uuid()` available (used by existing tables). | `pg_extension` |
| I7 | **Connection topology** | Linked project ref `qsciikhztvzzohssddrq`. Pooler URL host `aws-1-us-east-1.pooler.supabase.com:5432` (Supavisor). Postgres `17.6.1.121`. PostgREST `v14.5`. | `supabase/.temp/pooler-url`, `postgres-version`, `rest-version`, `linked-project.json` |
| I8 | **Connection limits** | `max_connections = 60`; `max_worker_processes = 6`; `statement_timeout = 120000ms`; `idle_in_transaction_session_timeout = 0`; `idle_session_timeout = 0`. (Small instance — nano/free indicators.) | `pg_settings` |
| I9 | **Edge Function wall-clock ceiling** | **150s free plan / 400s paid plan** max wall-clock the worker stays active (incl. `waitUntil` background tasks). CPU time 2s/request. Request idle timeout 150s → 504 if no response. The instance limits in I8 are free/nano-consistent, so **150s is the conservative binding ceiling** for the drain budget. | `supabase.com/docs/guides/functions/limits` |
| I10 | **Existing run table** | `public.argument_machine_observation_runs`: columns `id, debate_id, argument_id, schema_version, requested_families text[], provider_key, model_name, input_hash, status CHECK(success\|failed\|fallback), failure_reason, started_at, completed_at, created_at, run_mode CHECK(production\|admin_validation) DEFAULT 'production'`. Indexes: `(argument_id, schema_version, completed_at DESC)`, `(run_mode)`. **No `family` scalar column** — family identity is membership in the `requested_families` array. **No `(argument_id, family, run_mode)` unique constraint.** | migrations `…18`, `…19` |
| I11 | **Results table** | `public.argument_machine_observation_results`: `id, run_id FK, debate_id, argument_id, schema_version, raw_key, family, confidence CHECK(low\|medium\|high), evidence_span, created_at`. Constraint `amor_unique_run_rawkey UNIQUE (run_id, raw_key)`. Indexes `(argument_id, schema_version, raw_key)`, `(run_id)`. | migration `…18` |
| I12 | **Idempotency today** | Enforced ONLY in application code: `findExistingRun()` in `autoTriggerDispatcher.ts:189` queries `runs` by `(argument_id, schema_version, run_mode='production', provider_key, requested_families CONTAINS [family])`, `order started_at desc limit 1`; if `status='success'` → skip. **No DB unique constraint** backs this. Documented benign race: two run rows for one (arg,family) cell are deduped downstream by Source 6 (by `raw_key`). | `autoTriggerDispatcher.ts:189-211`, `…:73-78` |
| I13 | **Run/result write atomicity** | `persistRun()` and `persistResults()` are **two separate PostgREST INSERTs**, each calling `createServiceClient()` independently. **No shared SQL transaction.** Run row is written `status:'success'` BEFORE results. If results fail, run already says success (benign — Source 6 SELECTs results). Writer is append-only INSERT (no UPDATE/UPSERT) per doctrine §8. | `persistenceWriter.ts:80-163`, `classifyArgumentCore.ts:284-343` |
| I14 | **Dispatch / cutover point** | `submit-argument/index.ts:787-794`: `dispatchAutoTriggerForArgument(insertedArg.id, data.debate_id, serviceClient).catch(...)` then `EdgeRuntime.waitUntil(promise)`. Fire-and-forget; 201 returned at `:797` regardless. **This is exactly where the cutover flag attaches.** | `submit-argument/index.ts` |
| I15 | **Timeout constants** | Edge→MCP fetch abort = **15000ms** at `booleanObservationMcpAdapterCore.ts:56` (applied at adapter `:157`) — the binding deadline. MCP server `MCP_SERVER_REQUEST_TIMEOUT_MS=30000`, `MCP_SERVER_MODEL_TIMEOUT_MS=25000` (looser, NOT binding). | `booleanObservationMcpAdapterCore.ts:56`, `mcp-server/.env.local.example:26-27`, `anthropicCall.ts:98` |
| I16 | **Provider model + cap** | Model `claude-haiku-4-5` (`anthropicCall.ts:31`). Per-isolate cap `MCP_SERVER_MAX_PROVIDER_CONCURRENCY` default **5**, validate-or-default (`Number()`, floor to default if `<1`), `providerConcurrency.ts:117-130`. Operator-confirmed live = 5. | `providerConcurrency.ts`, `anthropicCall.ts` |
| I17 | **Haiku-4.5 rate limits** | Per-model, per-tier, token-bucket (continuous replenishment). **Tier 1: 50 RPM / 50,000 ITPM / 10,000 OTPM.** Tier 2: 1,000 RPM / 450,000 ITPM / 90,000 OTPM. 429 + `retry-after` header on breach. "60 RPM may be enforced as 1 req/s" — short bursts can trip it. | `platform.claude.com/docs/en/api/rate-limits` |
| I18 | **A–G family load** | 7 production-enabled families: `parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress`. H/I/J (`claim_clarity, thread_topology, sensitive_composer`) = `productionEnabled:false`. One submit fans out 7 family-jobs; a 5-arg burst = **35 family-jobs**. | `familyRegistry.ts:68-119` |
| I19 | **semantic-move co-consumer** | `mcp-server/tools/classifySemanticMove.ts` routes through `callAnthropic` (shares the provider chokepoint). But the production `semantic-referee` Edge Function is **DISABLED BY DEFAULT** (`SEMANTIC_REFEREE_ENABLED !== 'true'`), and its only wired providers are `mock` + `fixture` — the `mcp`/`anthropic` slots are stubbed `{enabled:false, not_implemented}`. **`submit-argument` does NOT invoke `semantic-referee`** (zero references). So semantic-move is NOT a live production auto provider path today. | `semantic-referee/index.ts:1-21`, `providers.ts`, Grep of `submit-argument` |

---

## Goal (one paragraph)

Replace the current submit-time MCP classifier fan-out — where `submit-argument` fires
`dispatchAutoTriggerForArgument` as a `waitUntil` background promise that synchronously calls the MCP
server up to `7 families × 2-bounded-parallel` times per argument through a 15s-capped adapter
(I14, I15, I18) — with a **Postgres-backed asynchronous classification queue** drained by a **single-flight,
bounded-batch Edge worker** at a **known global provider rate C ≤ 5** (I16). The prior chain proved
that per-isolate caps + static Edge retry cannot bound *global* provider concurrency under cross-argument
burst (cap=5 left ~10–15 concurrent → `{isError}`; cap=2 starved per-isolate queues into the 15s abort
→ mass `mcp_network_error`). The queue moves the control point Supabase-side: submit ENQUEUES (a fast
local INSERT, no provider call) and returns 201; a drainer claims due jobs and processes them at rate C
with the drainer's OWN MCP-call timeout ≥ 30s (correcting the inverted 15s hierarchy). The design is
shaped by `cdiscourse-doctrine`: §1/§4 — classifiers never gate acceptance, never judge truth, never
auto-act; §3 — no popularity/engagement input to ordering (jobs are claimed oldest-first by arrival,
never by heat/score); §6 — no secret/body/prompt in any queue row, log, or envelope; §8 — RLS on every
new table, append-only result ledger preserved, no service-role in client; §10a — persisted rows stay
Machine Observations.

---

## A.1 — Architecture scope + detector-policy deferral

**This card preserves the current A–G set.** The production queue workload is **A–G (7 families) for
every normal production submit** (I18). The queue's first verification (A.12) runs the **full A–G load**
under sustained/repeated burst — the hardest current case — precisely so the queue is not under-verified.

- AI/MCP classifiers **do NOT block post acceptance** (doctrine gate constraint). Submit enqueues and
  returns 201; the rules engine remains the gate.
- **Detector tiering is INTENTIONALLY OUT OF SCOPE.** This card does NOT redesign which families run,
  when, or whether all of A–G should run. Reducing load *before* the queue smoke would hide whether the
  queue can sustain the real A–G rate.

### Detector-policy deferral section

A later, *separate* card — proposed name **`ARCH-CIVIL-DISCOURSE-DETECTOR-POLICY`** — may introduce
detector tiering (e.g. run a cheap subset on every move; run the full A–G set only on moves that pass a
trigger). **It is filed only AFTER queue throughput is measured (A.12) so tiering decisions are grounded
in real per-family cost data, not guesses.** It is explicitly **excluded from this card's implementation
plan**. Family H/I/J enablement is *also* out of scope and stays frozen (see header).

---

## A.2 — Queue control point + scheduler/kick topology

### Architecture

A Postgres-backed job queue (table design in A.3) plus a two-channel trigger:

1. **Periodic scheduled tick (safety net).** A `pg_cron` job calls the drainer Edge Function on a fixed
   interval via `pg_net` (`net.http_post`). This guarantees liveness even if every enqueue-kick is lost.
2. **Enqueue-time kick (latency path, preferred).** When `submit-argument` enqueues jobs for a new
   argument, it fires **at most ONE** drainer kick for that submit (debounced — see below), so a quiet
   submit's jobs start within a kick round-trip rather than waiting up to a full tick interval.

Duplicate kicks are **harmless** because the drainer is single-flight (A.4): a second concurrent kick
finds the lock held and exits immediately. A 5-arg burst must NOT fire 35 kicks (I18) — the debounce is
**one kick per submit**, not one per family-job. (5 submits → at most 5 kicks; the lock collapses them to
one effective drain.)

### Verified invocation mechanism (I1, I3, I5)

- pg_cron + pg_net are the documented Supabase mechanism to invoke an Edge Function on a schedule. **Both
  must be enabled** (a migration `CREATE EXTENSION` — proposed, see A.3 migration plan; operator-applied).
- The cron SQL reads the drainer URL + a service credential from **Supabase Vault** (`vault.decrypted_secrets`),
  per the Supabase-recommended pattern — **never a hardcoded key in SQL** (doctrine §6). The drainer
  endpoint runs with `verify_jwt = false` and validates the secret on the `apikey`/`Authorization` header
  inside the function (the same posture Supabase documents for cron→function auth).
- **The enqueue-kick** from `submit-argument` reuses the function's already-present service context to
  POST to the drainer (a `fetch` to the drainer URL, fire-and-forget under `waitUntil`), OR — to avoid a
  second outbound HTTP dependency on the submit path — uses `pg_net` from a lightweight `AFTER INSERT`
  statement-level trigger on the queue table that calls the drainer **once per statement** (a batch enqueue
  is one INSERT statement → one kick). The statement-level trigger is the **preferred** kick because it is
  inherently debounced (one fire per multi-row INSERT) and keeps the kick off the Edge isolate's wall-clock.
  **Decision: statement-level `AFTER INSERT` trigger calling `net.http_post` once per statement, guarded by
  an advisory `pg_try_advisory_xact_lock` on a kick key so concurrent submits coalesce.** The periodic
  cron tick remains the safety net.

### Kick debounce / coalescing — explicit bounded mechanism

- **Per-submit:** one enqueue is one multi-row INSERT (7 family-jobs) → the statement-level trigger fires
  **once**. (Not 7.)
- **Cross-submit burst:** the trigger wraps the `net.http_post` in `IF pg_try_advisory_xact_lock(<kick_key>) THEN …`.
  Concurrent submit transactions that fail to grab the transient kick-lock skip their own kick (the
  in-flight drain will pick up their freshly-INSERTed jobs). Worst case: a burst of 5 simultaneous submits
  → 1 kick. **Bounded: at most one in-flight kick per short window; the cron tick covers any missed kick.**
- Even if the debounce fails open and N kicks fire, single-flight (A.4) collapses them to one drain — so
  the debounce is a latency/cost optimization, never a correctness requirement.

### Normal-load latency model

Assumptions: `claude-haiku-4-5` ~5s p50 / ~13s tail call duration (prior-chain observed); C provider
concurrency (A.7); periodic tick = 60s floor (I2 PARTIAL conservatism); kick round-trip ≈ 100–400ms.

| Scenario | Time to first job start | Notes |
|---|---|---|
| **Quiet submit (kick path)** | kick round-trip + claim ≈ **< 1s** | Trigger fires `net.http_post`; drainer acquires lock, claims the 7 due jobs, starts up to C immediately. |
| **Quiet submit (kick lost, tick only)** | ≤ tick interval (**≤ 60s**) | Safety net. The cron tick catches any orphaned pending job. |
| **5-arg burst (35 jobs)** | first batch < 1s; full completion bounded by rate | At C concurrent, ~5s/call: 35 jobs / C ≈ ⌈35/C⌉ "rounds" × ~5s. At C=3 ≈ 12 rounds × 5s ≈ 60s wall (across multiple bounded-batch drains; see A.5). Rate-paced if 429 risk (A.7). |
| **Oldest-pending-age alert threshold** | **5 minutes** (A.10) | If any job is `pending`/`due` older than 5 min, the periodic tick or single-flight is wedged → alert. |

**Doctrine note:** ordering is **arrival-time FIFO** (`ORDER BY available_at, created_at`). No heat,
score, popularity, or engagement signal participates in claim order (doctrine §1, §3).

---

## A.3 — Queue table vs extending the existing run table — **DECISION: extend the run table (Option 2)**

This is the single hardest structural decision. **New-table is NOT the silent default.** Decision:
**extend `public.argument_machine_observation_runs` to BE the job (Option 2).**

### Why Option 2 (extend the run row), and why NOT Option 1 (separate `classification_jobs` table)

The decisive fact is **I13 + I12**: today there is **no shared transaction** across the run-write and the
result-write (two independent PostgREST INSERTs), and **no DB unique constraint** backing the
success-only idempotency guard. A *separate* `classification_jobs` table would create a **three-way
dual-write hazard** — job row, run row, result rows — across a client (PostgREST) that **cannot wrap them
in one transaction** (the Supabase JS client issues independent HTTP statements; I13). That is exactly the
divergence the card warns against:
- (a) job succeeded but no run row,
- (b) run row succeeded but job pending,
- (c) retry job duplicated after success.

With a separate table, *proving* atomicity would require moving all writes into a single Postgres
function (RPC) so they share one transaction — a far more invasive change than the card's "clean lifecycle"
pro implies, and it would still leave the run-vs-results split (I13) unsolved.

**Option 2 collapses the job and the run into one row.** The run row already IS the unit of work per
(argument, family, run_mode): one classify call writes exactly one run row (I13). Making it the job row
means:
- **The run-completeness census stays aligned by construction** — there is no job/run divergence because
  they are the same row. (a) and (b) above are structurally impossible.
- **No new dual-write** is introduced. The existing run↔results split (I13) is unchanged and already
  benign (Source 6 reads results; a success run with zero results renders nothing).
- The lifecycle fields (state, attempt, lease, available_at) live ON the run row, so a single `UPDATE`
  transitions job state atomically.

The cost the card names — "more invasive change to a core table + existing run semantics" — is real but
**additive and bounded**: new nullable columns + a partial unique index + new CHECK values. No existing
column changes meaning; no existing row's semantics change (a backfilled `state='succeeded'` for historical
`status='success'` rows). The write path moves from "INSERT a terminal run row" to "claim a pending run
row, UPDATE it terminal" — analyzed in detail below.

### The one schema tension this surfaces (and resolves)

Today a run row is keyed by `requested_families text[]` *containing* a family (I10, I12) — the
auto-trigger writes **one run row per single-family call** (`singleFamilyArray = [family]`,
`autoTriggerDispatcher.ts:249`), so in production each run row's `requested_families` is effectively a
1-element array. The job identity the card requires — `(argument_id, family, run_mode)` — therefore maps to
**`(argument_id, requested_families, run_mode)` where `requested_families` is the canonical 1-element
array**, OR we add a generated/explicit scalar `family` column for a clean unique index. **Decision: add an
explicit nullable `family text` column to the run row, populated for queue-created jobs** (the
single-family production path). This gives a clean scalar for the partial unique index without disturbing
`requested_families` (kept for backward compat + the admin multi-family path). Historical rows leave
`family = NULL` and are excluded from the partial unique index (see below).

### Migration PLAN (PROPOSED — not implemented; operator applies after approval)

Proposed file: `supabase/migrations/<next-seq>_arch_001_classifier_queue.sql` (sequenced after `…20`).
**All statements `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`; OPS-001 four-class posture observed
(ordering: extensions → columns → CHECK widen → indexes → comments).**

1. **Extensions (operator-gated; required for A.2):**
   - `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;`
   - `CREATE EXTENSION IF NOT EXISTS pg_cron;` (pg_cron installs to its own `cron` schema by Supabase
     convention; it is created in the `postgres` database.)
   - **HALT-class (surfaced):** enabling extensions is an operator action with platform side effects; see
     HALT table + Operator steps.

2. **New columns on `public.argument_machine_observation_runs` (all nullable / defaulted, additive):**
   - `family text` — scalar family for queue jobs (NULL for historical/multi-family rows).
   - `state text NOT NULL DEFAULT 'succeeded'` with `CHECK (state IN ('pending','leased','retry_scheduled','succeeded','failed_terminal','dead_letter'))`.
     **Backfill rationale:** existing terminal rows are historical results, not live jobs; defaulting them to
     `'succeeded'` (for `status='success'`) keeps them out of the claim query. A one-shot `UPDATE … SET state = CASE status WHEN 'success' THEN 'succeeded' ELSE 'failed_terminal' END WHERE state = 'succeeded'`
     reconciles the default for pre-existing `failed` rows. (Detailed in reconciliation below.)
   - `attempt_count int NOT NULL DEFAULT 0`.
   - `available_at timestamptz NOT NULL DEFAULT now()` — earliest time the job may be claimed (retry backoff).
   - `lease_expires_at timestamptz` — set when claimed; NULL otherwise.
   - `lease_owner text` — opaque drainer-invocation id (diagnostic; no secret).
   - `failure_sub_reason text` — typed sub-reason (mirrors `BooleanObservationFailureSubreason`, incl.
     the harvested `provider_capacity_exhausted`). No raw detail/body persisted (doctrine §6).
   - `dead_letter_reason text`.
   - `last_attempt_at timestamptz`.

3. **Widen the `status` CHECK?** **No.** `status` (success|failed|fallback) is unchanged — it stays the
   *terminal outcome* field Source 6 and audits already read. `state` is the *new lifecycle* field. Keeping
   them separate avoids re-meaning an existing column (Class-2/Class-3 safety) and avoids a schema-mirror
   concern (these are server-only diagnostic columns, never part of the MCP wire schema).

4. **Duplicate-success prevention — DB-enforced partial unique index (the core invariant):**
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS amor_one_success_per_cell_idx
     ON public.argument_machine_observation_runs (argument_id, family, run_mode, schema_version)
     WHERE state = 'succeeded' AND family IS NOT NULL;
   ```
   This makes **two `succeeded` rows for one (argument_id, family, run_mode, schema_version) cell a DB
   error** — the defect the card forbids. A failed attempt + a later success is valid (the failed row has
   `state IN ('failed_terminal','retry_scheduled')`, outside the partial index). Historical rows
   (`family IS NULL`) are excluded, so the index can be created without touching legacy data.

5. **Idempotent-enqueue index (active-job identity):**
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS amor_one_active_job_per_cell_idx
     ON public.argument_machine_observation_runs (argument_id, family, run_mode, schema_version)
     WHERE state IN ('pending','leased','retry_scheduled') AND family IS NOT NULL;
   ```
   Enqueue uses `INSERT … ON CONFLICT DO NOTHING` against this index — a second enqueue for an
   already-active (or in-flight) cell is a no-op. Combined with #4, the system can never have two active
   jobs OR two successes for one cell.

6. **Claim/scan index:**
   ```sql
   CREATE INDEX IF NOT EXISTS amor_claimable_idx
     ON public.argument_machine_observation_runs (state, available_at)
     WHERE state IN ('pending','retry_scheduled');
   ```
   Supports the drainer's `WHERE state IN ('pending','retry_scheduled') AND available_at <= now() ORDER BY available_at`.

7. **Lease-recovery index:**
   ```sql
   CREATE INDEX IF NOT EXISTS amor_stale_lease_idx
     ON public.argument_machine_observation_runs (state, lease_expires_at)
     WHERE state = 'leased';
   ```

8. **RLS:** unchanged. The existing `amor_runs_select_via_argument` SELECT policy (TO authenticated)
   already covers the new columns transparently (additive). **No new client write policy** — the drainer
   writes via service-role (bypasses RLS), exactly as the current writer does (I13, doctrine §8). A
   ban-list mechanical check (`grep -E "CREATE POLICY .* FOR (INSERT|UPDATE|DELETE)"`) must return zero
   matches on the new migration.

9. **COMMENTs** documenting each column's doctrine posture (no `storage.*` targets — PR-003 SQLSTATE
   42501 boundary preserved).

### Transaction / upsert strategy (atomicity PROOF for Option 2)

Because the job IS the run row, the lifecycle transition is a **single-row UPDATE**, which Postgres
executes atomically. The claim and the terminal write are each one statement:

- **Enqueue (in `submit-argument`, replacing the direct dispatch):**
  `INSERT INTO …runs (argument_id, debate_id, family, run_mode, schema_version, provider_key, requested_families, state, available_at, started_at) VALUES (…, 'pending', now(), now()) ON CONFLICT (amor_one_active_job_per_cell_idx) DO NOTHING` — one statement per family (7 rows, batchable as one multi-row INSERT). Idempotent by #5.
- **Claim (drainer):** the standard `SELECT … FOR UPDATE SKIP LOCKED` claim *inside one statement*:
  ```sql
  WITH due AS (
    SELECT id FROM public.argument_machine_observation_runs
    WHERE state IN ('pending','retry_scheduled') AND available_at <= now()
    ORDER BY available_at, created_at
    LIMIT <batch_size>
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.argument_machine_observation_runs r
    SET state='leased', lease_owner=$1, lease_expires_at = now() + interval '<lease>',
        attempt_count = attempt_count + 1, last_attempt_at = now()
  FROM due WHERE r.id = due.id
  RETURNING r.id, r.argument_id, r.family, r.run_mode;
  ```
  `FOR UPDATE SKIP LOCKED` guarantees **no two drainer statements claim the same row** even if (against
  the single-flight invariant) two drains ran — this is the *defence-in-depth* layer beneath A.4's
  single-flight. **This claim is a Postgres-native row-lock claim and does NOT depend on session-level
  advisory locks**, so it is pooler-safe (it is one statement = one implicit transaction).
- **Terminal write (drainer, after the MCP call returns):** the existing `persistResults()` writes the
  result rows (unchanged, I13), then a single `UPDATE …runs SET state='succeeded', status='success', completed_at=now(), …`
  (or the failure/retry transition). The partial unique index #4 enforces single-success.

**The run↔results split (I13) is unchanged and remains benign** — Source 6 reads results; a `succeeded`
run with zero result rows renders nothing (it just means the classifier observed no positive rawKeys).
The card's three failure modes are addressed: (a) job-succeeded-no-run is impossible (same row); (b)
run-succeeded-job-pending is impossible (same row); (c) retry-after-success is blocked by index #4.

### Reconciliation strategy (the deterministic path that cannot leave a stranded state)

Two reconcilers, both DB-side and idempotent:

1. **Stale-lease reclaimer (drainer-internal + periodic):** any row `state='leased' AND lease_expires_at < now()`
   is reset to `state='retry_scheduled', available_at = now() + backoff` (bounded by attempt cap → else
   `dead_letter`). This recovers a job whose drainer died mid-batch (A.5). Because the claim incremented
   `attempt_count`, a perpetually-crashing job dead-letters rather than looping forever.
2. **Orphan-pending sweep (periodic cron):** the cron tick is itself the reconciler for "submit succeeded,
   job stuck pending forever" — it always re-invokes the drainer, which claims any due `pending` row. The
   monitoring alert (A.10) on oldest-pending-age catches a wedged single-flight or a dead cron.

**No `classification_jobs` table is created**, so there is no dual-write to reconcile in the first place —
the reconciliation surface is strictly *within* the run table's own lifecycle, which a single-row UPDATE
keeps consistent.

---

## A.4 — Single-flight drainer under Supabase topology — **MECHANISM: TTL lease row (Option B), NOT advisory locks**

Single-flight is **mandatory**. The mechanism is **PROVEN against this project's actual topology (I7)**,
not assumed.

### The topology (verified, I7 + I8 + I9)

- The drainer is a **Supabase Edge Function** (Deno). It accesses the DB the same way the existing writer
  does (I13): the **Supabase JS client over HTTP (PostgREST)** using the service-role key, OR a direct
  pooled SQL connection. The current production write path is **PostgREST over HTTP** (I13:
  `createServiceClient().from(...).insert(...)`).
- The pooler is **Supavisor** at `…pooler.supabase.com:5432` (I7). Port 5432 on the pooler host is
  **session mode**; 6543 is transaction mode. PostgREST itself multiplexes over its own internal pool.
- `max_connections = 60` (I8) — a small ceiling. Holding one connection open for a multi-minute drain
  consumes ~1.7% of the entire instance's connection budget *per concurrent drain*.

### Why advisory locks are REJECTED here (the card's trap)

- **Session-level advisory locks** (`pg_advisory_lock`) require holding **one specific backend session**
  for the whole drain. Over **PostgREST** (the current access path, I13) there is **no stable session** —
  each PostgREST request may use a different pooled backend, so a session lock taken on request 1 is not
  observable/holdable on request 2. **Unsafe — cannot prove a held session.** Over **Supavisor transaction
  mode** the same is true (a transaction-scoped checkout). Even over **session mode (5432)**, proving the
  Edge Function pins ONE backend for the full drain is fragile and burns a scarce connection (I8).
- **Transaction-level advisory locks** (`pg_advisory_xact_lock`) ARE pooler-safe (scoped to one
  transaction) but **cannot span a multi-second/minute multi-job drain** — they release at COMMIT. They
  only protect a single statement/transaction (which is why they ARE used for the *kick debounce* in A.2,
  where the scope is exactly one trigger statement).

**Conclusion: a session advisory lock for the drain duration cannot be proven safe through this project's
PostgREST/Supavisor topology. It is rejected.**

### Chosen mechanism — **TTL lease row + per-row `FOR UPDATE SKIP LOCKED` claim**

Two layers, both pooler-agnostic because they rely only on row state + single-statement transactions:

1. **Drain-level single-flight = a TTL lease row** in a tiny new table:
   ```sql
   CREATE TABLE IF NOT EXISTS public.classifier_drain_lock (
     lock_key      text PRIMARY KEY,           -- constant 'classifier_drain'
     owner         text NOT NULL,              -- drainer invocation id
     acquired_at   timestamptz NOT NULL DEFAULT now(),
     expires_at    timestamptz NOT NULL
   );  -- RLS enabled; no client policy (service-role only).
   ```
   **Acquire (one atomic statement):**
   ```sql
   INSERT INTO public.classifier_drain_lock (lock_key, owner, expires_at)
   VALUES ('classifier_drain', $1, now() + interval '<lease_ttl>')
   ON CONFLICT (lock_key) DO UPDATE
     SET owner = EXCLUDED.owner, acquired_at = now(), expires_at = EXCLUDED.expires_at
     WHERE classifier_drain_lock.expires_at < now()        -- only steal an EXPIRED lease
   RETURNING owner;
   ```
   If the `RETURNING` row's `owner = $1`, this drainer holds the lease. If zero rows returned, a live lease
   is held by someone else → **this invocation exits immediately (single-flight enforced).** The
   `ON CONFLICT … WHERE expires_at < now()` clause makes acquisition **atomic and conditional** — the
   conflicting UPDATE only fires when the existing lease has expired (linearizable per-row in Postgres),
   so two simultaneous acquirers cannot both win (one's UPDATE precondition fails).
   **Release:** `DELETE FROM classifier_drain_lock WHERE lock_key='classifier_drain' AND owner=$1;` (best-effort).
   **Stale recovery:** built into acquire — an expired lease is stealable. **Killed mid-batch** (Edge
   timeout, crash): the lease simply expires after `<lease_ttl>`; the next tick/kick steals it. No manual
   intervention.
   **Heartbeat (optional):** for long drains the drainer may `UPDATE … SET expires_at = now()+ttl WHERE owner=$1`
   periodically. Not required if `<lease_ttl>` ≥ the max drain budget T (A.5) + margin.

2. **Per-job claim = `FOR UPDATE SKIP LOCKED`** (the A.3 claim statement). This is the *defence-in-depth*
   layer: even in the impossible event that two drainers both believe they hold the lease (clock skew at
   the TTL boundary), `SKIP LOCKED` guarantees **no two of them claim the same job row**. A job claimed by
   one is invisible to the other's claim statement.

### PROOF: overlapping invocations CANNOT multiply provider concurrency

Let the lease TTL = `L`, drain budget T ≤ L (A.5), and provider concurrency cap = C (A.7).
- **Overlapping cron ticks / kicks:** each invocation first runs the conditional lease acquire. Per-row
  linearizability in Postgres means the `ON CONFLICT … WHERE expires_at < now()` UPDATE succeeds for **at
  most one** acquirer while a live lease exists. All other concurrent invocations get zero rows back and
  **exit before claiming any job or making any provider call.** ⇒ at most ONE drainer is "active" at a time.
- **The active drainer's own concurrency is bounded by C** (A.7: a bounded worker pool of size C inside
  the single drain). So total in-flight provider calls ≤ C.
- **Lease-expiry edge (drainer A still finishing as drainer B steals an expired lease):** A's jobs are
  already `leased`/`succeeded`. B's claim uses `FOR UPDATE SKIP LOCKED` over `state IN ('pending','retry_scheduled')`
  — it **cannot re-claim A's leased rows**. B's in-flight ≤ C. If A is still mid-call on a few jobs (its
  lease expired but its MCP fetch is still open), the transient total is ≤ C (B) + (A's residual, ≤ C).
  This is bounded by `2C` only in the narrow lease-expiry overlap window, and **only if `L` is set too
  short**. **Mitigation: set `L ≥ T + max_single_call_timeout (30s, A.6) + margin`** so a drainer's lease
  cannot expire while it still has an open provider call. With that, A always finishes (or its jobs
  lease-expire back to `pending` *after* its calls have aborted) before B steals → steady-state in-flight
  ≤ C. **This is the binding constraint linking A.4↔A.5↔A.6: `L ≥ T + 30s`.**

Therefore overlapping invocations cannot multiply provider concurrency beyond C in steady state, and the
`2C` worst case is eliminated by the `L ≥ T + 30s` sizing rule (stated as a hard constant relationship in
A.5's budget model).

### Coverage of the required cases

| Case | Handling |
|---|---|
| Acquisition | Conditional `INSERT … ON CONFLICT … WHERE expires_at < now()` (atomic, one statement). |
| Release | `DELETE … WHERE owner=$1` (best-effort; TTL is the backstop). |
| Stale-lock recovery | Expired lease is stealable on next acquire; no manual step. |
| Drainer killed mid-batch | Lease expires after `L`; claimed-but-unfinished jobs reclaimed via the stale-lease reclaimer (A.3 reconciler) back to `retry_scheduled`. |
| Edge Function timeout mid-batch | Same as killed — the worker is terminated at the 150s ceiling (A.5 exits before this with margin); lease + job leases self-heal. |
| Overlapping scheduled ticks | All but one exit at lease acquire. |
| Overlapping enqueue kicks | Same — debounced at A.2, collapsed at lease acquire. |

---

## A.5 — Bounded-batch drainer, not drain-to-empty

The drainer processes **up to N jobs OR until T seconds, whichever first**, then exits cleanly, releases
the lease (or lets it expire), and lets the next tick/kick continue. **It never drains to empty in one
invocation**, never holds the lease indefinitely, and never silently wedges.

### Verified ceiling (I9) and the derived budget T

- **Edge Function wall-clock ceiling = 150s (free) / 400s (paid)** (I9). The instance limits (I8:
  `max_connections=60`, `max_worker_processes=6`) are free/nano-consistent, so the design uses the
  **conservative 150s ceiling**.
- **Drain budget `T = 90s`** — comfortably below 150s with ~60s margin for: in-flight call completion,
  the terminal `UPDATE`, lease release, and Edge cold-start/teardown. (If the project is confirmed on a
  paid plan with the 400s ceiling, T can rise to ~300s; stated as an operator-tunable, but **the design
  ships T=90s against the verified 150s floor** so it is correct on the worst case.)
- A drainer that hits T mid-batch **stops claiming new jobs, lets in-flight calls finish (each capped at
  30s, A.6), writes their terminals, releases the lease, and returns** — well before 150s.

### Chosen operating parameters

| Parameter | Value | Basis |
|---|---|---|
| **Batch size N** | **20 jobs/invocation** | At C concurrent × ~5s/call, 20 jobs ≈ ⌈20/C⌉ rounds. At C=3 ≈ 7 rounds × ~5s ≈ 35s ≪ T=90s, leaving headroom for tail calls. A 35-job burst (I18) drains in ~2 invocations. |
| **Max drain wall-clock budget T** | **90s** | I9 ceiling 150s − ~60s margin. |
| **Provider concurrency C** | **3** initial (≤ 5 invariant) | A.7 — see calibration. |
| **Tick interval** | **60s** (cron floor; I2 PARTIAL) | Safety net. Enqueue-kick provides sub-second latency on the happy path; the tick need not be sub-minute. |
| **Kick behavior** | one per submit (debounced, A.2) | Latency path. |
| **Queue-age alert threshold** | **5 min** oldest-pending | A.10. |
| **Running-job lease timeout (per-job `lease_expires_at`)** | **120s** | ≥ one 30s provider call (A.6) + retries within the drain + margin; a job whose drainer died is reclaimable after 120s. |
| **Drain lease TTL `L`** | **130s** | **Must satisfy `L ≥ T(90) + max_call_timeout(30) + margin(10)` (the A.4 proof's binding rule).** 130s ≥ 130s. Also < the 150s Edge ceiling is irrelevant (the lease row outlives the isolate; only the proof rule binds). |
| **Stale-lease recovery policy** | reset `leased`→`retry_scheduled`, `available_at = now()+backoff`; dead-letter at attempt cap | A.3 reconciler + A.9 retry table. |

### Drain budget model (worst-case batch duration)

```
Worst-case single invocation:
  claim (1 statement, ~tens of ms)
+ N/C "rounds" of provider calls, each round bounded by the slowest call in it
  → worst round ≈ max single-call timeout = 30s (A.6)  [tail call]
  but the drainer STOPS issuing new rounds once elapsed ≥ T(90s)
+ terminal UPDATEs (batched, ~tens of ms)
+ lease release (~ms)
────────────────────────────────────────────────────────────────────────
Bounded by:  min( N/C rounds × per-round time ,  T=90s )  +  one in-flight 30s tail  +  ~1s overhead
           ≤  90s + 30s + 1s  =  121s  <  150s Edge ceiling.  ✔ exits with ~29s margin.
```

The "+30s tail" term is the one in-flight call that may still be running when the T budget trips; the
drainer **awaits it** (so its terminal is written, no stranded job) but issues no further calls. Because
each call is capped at 30s (A.6), the worst total is 121s < 150s. **The drainer exits before the platform
ceiling by construction.**

A drainer **killed exactly at the 150s ceiling** mid-batch (e.g. paid-plan misconfig, or an in-flight
call that ignored its abort): (a) the drain lease self-expires after `L`=130s — but since the kill is at
150s > 130s, the next tick can already steal it; **no wedged single-flight**; (b) any job left `leased`
is reclaimed by the stale-lease reclaimer (job lease 120s) → `retry_scheduled`, **never stranded**.

---

## A.6 — Timeout hierarchy correction

### The prior inverted bug (I15)

The binding deadline was the **15s** `AbortSignal.timeout` at `booleanObservationMcpAdapterCore.ts:56`,
**tighter than** the MCP server's own model budget (`MCP_SERVER_MODEL_TIMEOUT_MS=25000`). A valid slow
provider call (16–25s, within the server's tolerance) was killed by the 15s caller abort — reintroducing
the cap=2 timeout-starvation class. **Caller patience (15s) < callee work budget (25s) = inverted.**

### The B-critical rule

The **drainer MUST NOT invoke the classify path through the 15s-capped adapter unchanged.** The drainer's
MCP-call timeout must be **≥ `MCP_SERVER_MODEL_TIMEOUT_MS` (25s) + headroom ⇒ ≥ 30s**, so caller patience
exceeds callee work budget. Rule (verbatim intent): **no wait-based design is acceptable if caller
patience < callee/provider budget + expected queue wait.** This design moves *waiting out of request
paths*: jobs wait via `available_at`; the drainer claims only *due* jobs; provider requests never sit in
long in-request queues; overload is *scheduled work* (`retry_scheduled` + `available_at`), not a blocked
HTTP request.

### How the drainer gets the corrected timeout WITHOUT changing the submit-path value

`MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15000` is a **module constant** (I15), and the abort is
applied inside `booleanObservationMcpAdapter.ts` (the orchestration sibling). **Proposed (design-only):
parameterize the adapter's timeout** — add an optional `timeoutMs` argument to the adapter call (defaulting
to the existing 15000 constant), and have the **drainer pass `30000`** while the submit path (if it still
called the adapter, which after cutover it does NOT) would keep 15000. This is the card's "parameterize
the adapter so the drainer gets the corrected timeout while the submit-path value is untouched" option.

- **The 15s submit-path timeout need NOT change in this card.** After cutover, **submit only enqueues and
  makes NO provider call** (I14 path is replaced by an INSERT), so the 15s value no longer gates
  classification — it is dead on the submit path. Stated explicitly so it is not "fixed" unnecessarily.
  (A later cleanup card may remove the dead 15s submit-time usage once the queue is proven.)

### Full timeout hierarchy table

| Layer | Value (proposed) | Relationship | Source / change |
|---|---|---|---|
| Submit request timeout (client→submit-argument) | platform default (~150s idle) | submit returns 201 in ~1–3s after enqueue INSERT | unchanged |
| Enqueue INSERT | bounded by `statement_timeout=120000ms` (I8) | a 7-row INSERT is sub-ms | unchanged |
| Enqueue-kick (`net.http_post` / fetch to drainer) | fire-and-forget; ~5s pg_net default, irrelevant (async) | never on the user's critical path | NEW (A.2) |
| **Drainer invocation budget T** | **90s** | < 150s Edge ceiling (I9) | NEW (A.5) |
| **Drainer→MCP call timeout** | **≥ 30s** (parameterized) | **≥ MCP_SERVER_MODEL_TIMEOUT_MS (25s) + 5s headroom** — corrects the inversion | **CHANGE: adapter `timeoutMs` param; drainer passes 30000** |
| Per-job lease (`lease_expires_at`) | 120s | ≥ one 30s call + intra-drain retry + margin | NEW (A.3/A.5) |
| Drain lease TTL `L` | 130s | **`L ≥ T(90)+call(30)+margin(10)`** (A.4 proof) | NEW (A.4) |
| MCP server request timeout | 30000ms | looser than drainer's 30s by design (server ≥ its own model budget) | **unchanged (no MCP redeploy)** |
| Anthropic/model timeout (`MCP_SERVER_MODEL_TIMEOUT_MS`) | 25000ms | innermost callee budget | **unchanged** |
| Queue retry `available_at` | `now() + backoff` (A.9) | bounded backoff (e.g. 30s, 120s) | NEW (A.9) |
| Dead-letter | at attempt cap (A.9) | bounded retries | NEW (A.9) |
| Submit-path 15s adapter timeout | 15000ms | **left as-is; dead after cutover (submit makes no provider call)** | **unchanged — stated explicitly** |
| Edge background/`waitUntil` expectation | ≤ 150s (I9) | the kick is fire-and-forget; the drainer is the long-runner, gated by T | I9 |

**Net required timeout change:** exactly one — parameterize the adapter timeout and have the **drainer use
≥ 30s**. The 15s submit-path constant is unchanged.

---

## A.7 — C as calibration, not magic

The first queue smoke is the **first true test of a known global provider concurrency C** (the prior chain
never had a real global bound — per-isolate caps could not sum-bound). C=5 is **not** treated as
guaranteed.

### What the rate facts say (I16, I17)

- The two A "defaults" (the code-constant per-isolate cap = 5; the start-6 from Option A) **fold into the
  drainer's C** and are governed here. The MCP per-isolate cap is **kept as a defensive backstop** (the
  invariant C ≤ 5); once the queue is proven, the per-isolate cap is vestigial (removal is later cleanup,
  not this card).
- Hypothesis: the prior `{isError}` burst came from ~10+ concurrent provider calls; a true global cap
  below that should reduce/eliminate overload.
- **BUT Anthropic limits are RATE/token based (RPM/TPM), not pure concurrency** (I17). C is a proxy for
  request/token rate **only while call duration is stable**. The model is `claude-haiku-4-5` (I16);
  limits are per-model, per-tier (I17).

### C calibrated against the documented Haiku-4.5 ceiling

**Assumed tier: Tier 1** (the conservative default for a small project; I8's instance size + no stated
higher tier). Tier 1 Haiku-4.5 = **50 RPM / 50,000 ITPM / 10,000 OTPM** (I17).

- At **stable ~5s p50** call duration, C concurrent calls produce throughput ≈ `C / 5s` req/s = `12·C` RPM.
  - C=5 ⇒ ~60 RPM — **exceeds Tier 1's 50 RPM** → expected intermittent 429s.
  - C=4 ⇒ ~48 RPM — just under 50 RPM (no margin for the "60 RPM enforced as 1 req/s" burst rule, I17).
  - **C=3 ⇒ ~36 RPM** — comfortably under 50 RPM with margin for tail-call variance and the burst-enforcement
    note. **This is why initial C = 3.**
- Token rate: a single A–G classify is a short structural prompt (move + parent + thread excerpt ≤ ~2k
  chars + definitions). Even at C=3 the ITPM stays well under 50,000 — RPM is the binding ceiling at
  Tier 1, not tokens.

**Initial C = 3** (satisfies the invariant **C ≤ 5 = MCP_SERVER_MAX_PROVIDER_CONCURRENCY**, I16). This is
the safest defensible value that keeps a sustained drain under the Tier-1 RPM ceiling while still draining
a 35-job burst in ~2 invocations (A.5).

### How C is configured

A **CODE constant** in a dedicated pure module (mirrors `autoTriggerConcurrency.ts`'s D1 rationale, I16:
auditable, rollback-via-PR, never silently unbounded). A **single optional validated env override**
(`CLASSIFIER_DRAIN_PROVIDER_CONCURRENCY`) MAY gate the VALUE only, using the **validate-or-default** shape
of `readEnvMaxProviderConcurrency` (I16: `Number()`, integer ≥ 1, else default; and additionally **clamp to
≤ 5** so an env flip can never break the invariant). **No silently-unbounded env.** Recommendation: ship
code-only; add the validated override only if smoke retuning proves it needed.

### How C is tuned + verdict handling

- **If C=5 dead-letters but C=3 produces complete coverage within SLO, the architecture is NOT a failure —
  that is PASS-after-tune.** The queue's job is to EXPOSE and ENFORCE the safe operating rate.
- If C=5 still produces provider failures → lower to C=4, C=3, C=2 under the new async SLO (A.12). C=3 or
  C=2 are acceptable; the async SLO does not require the old strict 30s-background p95.
- **When rate-aware pacing is required instead of lowering C forever:** if even C=2 trips 429s because
  *call duration shrank* (so concurrency under-predicts RPM) OR the burst-enforcement rule (I17) bites,
  add a **min inter-call interval / token-bucket pacer in the drainer**: the drainer spaces provider calls
  to ≤ `floor(tier_RPM × safety / 60)` per second (e.g. ≤ 0.7 req/s for a 50 RPM Tier-1 with 0.84 safety
  factor). Pacing is the RATE control; C is the CONCURRENCY control; both are needed because RPM ≠
  concurrency once duration is unstable. **Pacing is designed-in as the fallback, not added reactively.**
  A 429 with `retry-after` (I17) feeds the job's `available_at` (A.9).

**Output:** initial **C = 3** (≤ 5), code constant + optional clamped env override, tuned via the A.12
smoke verdict bands, with token-bucket pacing as the rate-control fallback when concurrency-lowering alone
cannot hold the Tier-1 RPM ceiling.

---

## A.8 — Semantic-move co-consumer of provider budget — **TREATMENT: Option B (low-frequency / not a live production auto path), with an honest caveat**

`classify_semantic_move` routes through the **same** `callAnthropic` chokepoint (I19), so it shares the
provider resource the queue bounds. Honest accounting:

- **In production today, semantic-move is NOT a live auto-fanned provider path** (I19): the
  `semantic-referee` Edge Function is **disabled by default** (`SEMANTIC_REFEREE_ENABLED !== 'true'`), its
  only wired providers are `mock` + `fixture` (the `mcp`/`anthropic` slots are stubbed
  `not_implemented`), and **`submit-argument` never invokes it** (zero references). It is, at most, a
  manual/admin or future path — not a burst contributor.
- Therefore the boolean-observation auto-trigger (A–G) is the **only live production provider consumer**
  this card bounds, and **bounding it bounds the live global provider load.** This satisfies the card's
  honesty test: the design does NOT claim "global provider concurrency is bounded" while leaving a *live*
  unbounded path — there is no live semantic-move provider path to leave unbounded.
- **The honest caveat (surfaced, not hidden):** *if* a future card flips `SEMANTIC_REFEREE_ENABLED=true`
  and wires the MCP/anthropic provider, semantic-move would become a second live consumer of the same
  chokepoint and the global bound would no longer be solely the drainer's C. **That future card MUST route
  semantic-move through the same global budget** — either by (a) enqueuing semantic-move as a job in this
  same queue (a new `run_mode`/job-type or a sibling queue sharing the drain lease + C), or (b) a reserved
  budget split (C_total = C_boolean + C_semantic ≤ 5), or (d) a separate budget class with its own drain.
  This is named as a **dependency/guard on the future semantic-move-enablement card**, not built here.

**Output:** Option B — semantic-move is currently a dormant/manual path (verified I19), excluded from this
card's budget with an explicit guard that any future enablement card must fold it into the same global
budget. The MCP per-isolate cap (≤ 5) remains the shared defensive backstop covering both tools at the
server until the queue subsumes them.

---

## A.9 — Job state machine + retry semantics

### States (on the run row's `state` column, A.3)

```
            enqueue (INSERT ON CONFLICT DO NOTHING)
                       │
                       ▼
                  ┌─ pending ─┐
        claim ────┤           │◄──────────────── available_at reached
   (FOR UPDATE    ▼           │
    SKIP LOCKED)  leased ──────┘
                  │   │   │
        success ──┘   │   └── retryable failure ──► retry_scheduled ──(available_at)──► (re-claimable)
                  │   │                                   │
                  ▼   ▼                                   │ attempt_count ≥ MAX_ATTEMPTS
              succeeded  terminal/doctrine failure        ▼
              (status=    │                          dead_letter
               success)   ▼
                       failed_terminal (status=failed)
                       lease-expiry of a `leased` row ──► retry_scheduled (reconciler, A.3)
```

### Per-attempt fields (on the run row)

`attempt_count`, `last_attempt_at`, `started_at`/`completed_at` (existing), `failure_reason` (existing,
unchanged terminal string), `failure_sub_reason` (typed; incl. harvested `provider_capacity_exhausted`),
`available_at` (next eligible time), `dead_letter_reason`. **No raw provider body, prompt, or secret is
ever stored** (doctrine §6) — only the typed sub-reason + the existing allowlisted, sanitized
`failureDetail` shape (I13 carries this today via `BooleanObservationFailureDetail`).

### Retry table

| Failure class (sub-reason) | Retryable? | `available_at` backoff | Notes |
|---|---|---|---|
| `provider_server_error` (5xx `{isError}`) | **Yes** | attempt 1→2: +30s; 2→3: +120s | maps from existing `mcp_api_error` retryable set (I12). |
| `provider_capacity_exhausted` (harvested) | **Yes** | server `retry-after` → `available_at` if present (OPTIONAL surfacing, harvested); else bounded backoff +30s/+120s | the drainer reschedules whether or not the server returns a precise retry-after. |
| `provider_rate_limited` (429) | **Yes** | **`now() + retry-after`** (I17 header) if present; else +60s | feeds the A.7 pacer; the 429 `retry-after` is authoritative when present. |
| `provider_timeout` (drainer's 30s abort) | **Yes** | +30s/+120s | now ≥ 25s server budget (A.6) so genuine slow calls succeed before the abort; a timeout here is a real outage. |
| `provider_network_error` | **Yes** | +30s/+120s | maps from existing `mcp_network_error` (I12). |
| `response_schema_failure` (`mcp_validation_failed`, wrong schema) | **No (bounded)** | n/a | a deterministic bad response will not heal by retry; **1 retry max** then `failed_terminal` (it MAY be a transient truncation, so a single retry is allowed, but not the full schedule). |
| doctrine / ban-list failure | **No** | n/a → `failed_terminal` | **NEVER retried broadly** (doctrine §1/§6) — a ban-list hit is a content property, not a transient. |

**Rules honored:** doctrine/ban-list failures NOT retried broadly; provider/capacity failures may be
rescheduled; server `retry-after` MAY become `available_at`; retries bounded by `MAX_ATTEMPTS` (proposed
**3** total attempts, matching the spirit of the current `MAX_ATTEMPTS=2`+enqueue but giving the async
path one more bounded try since it is off the user's path); retry attempts visible (`attempt_count`);
failed-attempt-then-later-success acceptable (the failed row stays `failed_terminal`/`retry_scheduled`,
outside the success partial index #4); **two success rows for one cell is a defect blocked by index #4**.

### Required DETERMINISTIC tests (primary proof — never gamble on live-inducing a 429)

Pure-model + DB-harness tests (per `test-discipline`; server-only tree, exercised via the existing
Deno→Jest bridges + a local Supabase test DB where the claim SQL runs). File targets:

- `__tests__/classifierQueue/stateMachine.test.ts` — transition coverage: pending→leased→succeeded;
  pending→leased→retry_scheduled→(due)→leased→succeeded; retry exhaustion→dead_letter; terminal→failed_terminal.
- `__tests__/classifierQueue/retryAvailableAt.test.ts` —
  - **retryable failure sets `available_at` in the future** (asserts `available_at > now()`).
  - **job NOT claimed before `available_at`** (claim query with `available_at = now()+60s` returns it
    excluded).
  - **job claimed after `available_at`** (advance the injected clock; claim returns it).
  - **retry succeeds** → exactly one `succeeded` row; **terminal failure dead-letters** at attempt cap.
- `__tests__/classifierQueue/doctrineNoRetry.test.ts` — a ban-list/doctrine sub-reason yields
  `failed_terminal` with **no `retry_scheduled` transition** (assert `attempt_count` did not climb past 1).
- `__tests__/classifierQueue/bannedDetailNotPersisted.test.ts` — a fixture failure whose raw detail
  contains a sentinel secret/body string is persisted with **only** the typed sub-reason + allowlisted
  detail; assert the run row + log line contain neither the sentinel nor any `Bearer`/`sk-ant`/`sb_secret`/JWT
  shape (doctrine §6).
- `__tests__/classifierQueue/idempotentEnqueue.test.ts` — a second enqueue for an active cell is a no-op
  (`ON CONFLICT DO NOTHING` via index #5); a second `succeeded` write for a cell **raises a unique
  violation** (index #4) — asserted as the duplicate-success guard.
- `__tests__/classifierQueue/singleFlightLease.test.ts` — two concurrent lease acquires: exactly one
  `RETURNING owner = self`; the loser exits; an expired lease is stealable; release deletes only own lease.

---

## A.10 — Liveness monitoring + silent-outage prevention

**New silent failure mode:** submit succeeds (201) but jobs stay `pending` forever (dead cron, wedged
single-flight, drainer startup failure). Monitoring is **DB-table-based** (queryable, not log-scraping) —
the run table already holds everything; the lease table + a tiny `classifier_drain_audit` append row per
drain provide the rest.

### Monitored signals (all from `…runs` + `classifier_drain_lock` + `classifier_drain_audit`)

queue depth; oldest pending age; oldest running/leased age; jobs processed per drain; jobs succeeded per
drain; dead-letter count; retry count; `provider_server_error` count; `provider_capacity_exhausted`
count; last successful drain timestamp; single-flight skipped ticks; stuck-lease recovery count;
enqueue-kick failures.

### Monitoring SQL (read-only; operator/admin)

```sql
-- A. Queue health snapshot
SELECT
  count(*) FILTER (WHERE state = 'pending')                                   AS pending,
  count(*) FILTER (WHERE state = 'retry_scheduled')                           AS retry_scheduled,
  count(*) FILTER (WHERE state = 'leased')                                    AS leased,
  count(*) FILTER (WHERE state = 'dead_letter')                               AS dead_letter,
  count(*) FILTER (WHERE state = 'failed_terminal'
                     AND last_attempt_at > now() - interval '1 hour')         AS failed_last_hour,
  EXTRACT(EPOCH FROM now() - min(available_at))
    FILTER (WHERE state IN ('pending','retry_scheduled'))                     AS oldest_pending_age_s,
  EXTRACT(EPOCH FROM now() - min(lease_expires_at - interval '120 seconds'))
    FILTER (WHERE state = 'leased')                                           AS oldest_leased_age_s
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL;                       -- queue jobs only; historical rows excluded

-- B. Failure-class breakdown (last hour) — capacity vs server vs rate vs schema
SELECT failure_sub_reason, count(*)
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL AND last_attempt_at > now() - interval '1 hour'
  AND state IN ('retry_scheduled','failed_terminal','dead_letter')
GROUP BY failure_sub_reason ORDER BY 2 DESC;

-- C. Last successful drain + skipped-tick / recovery counters (from the per-drain audit row)
SELECT max(completed_at) AS last_drain_completed,
       sum(jobs_processed) FILTER (WHERE completed_at > now()-interval '15 min') AS processed_15m,
       sum(jobs_succeeded) FILTER (WHERE completed_at > now()-interval '15 min') AS succeeded_15m,
       count(*) FILTER (WHERE outcome='skipped_single_flight'
                          AND started_at > now()-interval '15 min')              AS skipped_ticks_15m,
       sum(stale_leases_recovered) FILTER (WHERE completed_at > now()-interval '1 hour') AS recovered_1h
FROM public.classifier_drain_audit;

-- D. Stuck-lease detector (rows leased but past their job lease)
SELECT id, argument_id, family, attempt_count, lease_expires_at
FROM public.argument_machine_observation_runs
WHERE state = 'leased' AND lease_expires_at < now();
```

### Alert / audit thresholds

| Alert | Condition | Likely cause |
|---|---|---|
| Oldest pending age | `oldest_pending_age_s > 300` (5 min) | dead cron + lost kicks, or wedged single-flight. |
| No successful drain | `now() - last_drain_completed > 5 min` while `pending > 0` | drainer down / startup failing. |
| Dead-letter present | `dead_letter > 0` | a cell exhausted retries → operator triage. |
| Terminal failures for baseline families | `failed_last_hour > 0` for any A–G cell | provider/contract regression. |
| Queue depth rising | `pending` increasing across ≥ 3 consecutive snapshots | enqueue outpaces drain → lower interval / raise N / investigate C-vs-rate. |
| Repeated drainer startup failures | `skipped_ticks_15m` high with `processed_15m = 0` | lease never released (stuck owner) — check stuck-lease detector D. |

### Operator runbook (summary)

1. **Pending climbing / oldest-pending > 5 min:** run snapshot A. If `last_drain_completed` is stale →
   check the cron job (`SELECT * FROM cron.job; SELECT * FROM cron.job_run_details ORDER BY end_time DESC LIMIT 10;`)
   and pg_net responses. If cron is healthy but `skipped_single_flight` dominates → run detector D; a stuck
   `leased` lock row past `expires_at` should self-steal on next tick — if not, manually
   `DELETE FROM classifier_drain_lock WHERE expires_at < now();` (safe; TTL semantics).
2. **Dead-letters:** breakdown B identifies the class. `provider_capacity_exhausted`/`provider_rate_limited`
   dominating → lower C or enable the A.7 pacer. `response_schema_failure` → MCP contract regression
   (out of this card's scope; do NOT redeploy the MCP server under this card — file a follow-up).
3. **Re-drive (rare):** to retry a dead-lettered cell after a fix, an admin sets
   `state='pending', available_at=now(), attempt_count=0` for the specific row (service-role; never client).
4. **Never** disable the rules-engine gate, and never let monitoring imply a verdict (doctrine §1) — these
   are operational counters only.

---

## A.11 — Feature flag + scopeable cutover

**Cutover is NOT global big-bang.** Per-argument routing is **feasible** (the dispatch point I14 has the
argument in hand), so it is the preferred flag.

### Flag design — per-argument / per-submit queue routing

- A predicate `shouldRouteToQueue(argument, debate)` evaluated at the I14 dispatch point. Inputs available
  there: the inserted argument row + `debate_id`. Routing rule (initial): **route to the queue iff the
  argument is smoke-tagged** (e.g. debate title carries the existing synthetic smoke prefix used by prior
  smokes, or an explicit `run_mode`/metadata marker on the smoke submit). Ordinary production arguments
  stay on the **current direct dispatch** (`dispatchAutoTriggerForArgument`) until the queue smoke passes.
- After a synthetic smoke PASS, an **optional percentage rollout**: route a hash-bucketed fraction of
  production arguments to the queue (e.g. `hashToBucket(argument.id) < rolloutPct`). `rolloutPct` is a
  code constant (or a validated, clamped env), default 0.
- **Fallback (only if per-argument routing were infeasible, which it is not):** a global queue-mode flag
  with a heightened operator gate. Not chosen.

### Double-dispatch prevention PROOF

The two paths are **mutually exclusive at a single branch point** (I14):

```
// submit-argument/index.ts:787 (PROPOSED shape — design only)
if (shouldRouteToQueue(insertedArg, debate)) {
   await enqueueClassifierJobs(insertedArg.id, debateId, serviceClient);  // INSERT ON CONFLICT DO NOTHING
   // (optionally fire one debounced kick)
} else {
   const p = dispatchAutoTriggerForArgument(insertedArg.id, debateId, serviceClient).catch(()=>undefined);
   EdgeRuntime.waitUntil(p);
}
```

- An argument takes **exactly one** branch — there is no path where both the direct dispatcher and the
  enqueue run for the same argument. **No double-dispatch.**
- Even if a code error caused both to run, **no duplicate family success rows** can occur: the direct
  dispatcher's `findExistingRun` pre-check (I12) AND the new **DB partial unique index #4** (A.3) both
  prevent a second `succeeded` row for a cell. The DB index is the hard backstop (the application
  pre-check is best-effort, I12). So duplicate-success is **DB-impossible**, independent of the flag.
- The queue's enqueue is itself idempotent (index #5, `ON CONFLICT DO NOTHING`) — re-running enqueue for
  the same argument creates no second job.
- **Direct dispatch is disabled for queued arguments** by the `else` exclusivity. The queue flag is
  **visible in audit/smoke** (the per-drain audit row records `route='queue'`; the run row's presence of
  `state`/`family`/`lease_*` distinguishes a queue job from a legacy direct-dispatch run row).

### Cutover sequence (operator-gated, per the card)

1. **Migrate queue structures** (the A.3 migration + the lease/audit tables) — operator `npx supabase db push --linked`.
   Also `CREATE EXTENSION pg_cron, pg_net` and seed the Vault secret + the cron job (or do the cron
   schedule as a follow-up step after the drainer is deployed).
2. **Deploy enqueue code behind a DISABLED flag** (`shouldRouteToQueue` returns false for everything;
   ordinary submits keep direct dispatch). Auto-deploy on merge (Supabase GitHub integration).
3. **Deploy the drainer** Edge Function (new `[functions.classifier-drainer] verify_jwt = false` in
   config.toml; secret-validated internally).
4. **Verify the drainer against test/synthetic jobs** — manually enqueue synthetic jobs (admin SQL) and
   confirm the drainer claims, classifies, and writes terminals, with single-flight + lease behavior
   observed, **before** any real routing.
5. **Enable queue for smoke-tagged arguments only** (`shouldRouteToQueue` true for the smoke prefix).
6. **Run the synthetic production smoke** (A.12) — full A–G, sustained/repeated burst, poll-to-settle.
7. **Expand rollout only after PASS** (percentage bucket, then broaden).
8. **Keep the rollback path until stable.**

### Rollback path

Set `shouldRouteToQueue` to return false (code constant flip → redeploy, or the clamped env override to
0%). All new submits revert to the proven direct dispatcher (unchanged, still in the tree). In-flight queue
jobs continue to drain to terminal (or the cron tick can be paused via `cron.unschedule`); no data
migration needed to roll back. The queue tables/columns are additive and inert when the flag is off.

---

## A.12 — Verification plan

**Verification POLLS to ACTUAL settle — NO fixed sleep** (per `test-discipline`'s "exit code is the
contract" + the card's explicit rule).

### Settle condition (poll until ALL true)

```
pending = 0
AND due retry_scheduled (available_at <= now()) = 0
AND leased (running) = 0
AND stale leases (state='leased' AND lease_expires_at < now()) = 0
AND (drain lease not held OR classifier_drain_audit.last_drain_completed > <final submit timestamp>)
THEN read run-completeness.
```

Poll snapshot A (A.10) on a loop (e.g. every 5s, bounded by a generous max wall e.g. 10 min) until the
settle predicate holds; only THEN evaluate completeness. (A bounded *poll loop* is not a fixed sleep — it
exits on the condition.)

### Live smoke (operator-run, after deploy)

- **Canary first:** ONE synthetic smoke-tagged submission → 7 A–G family jobs all reach `succeeded`;
  H/I/J zero; no duplicate; no terminal hole; submit nonblocking; time-to-first-job-start + time-to-complete
  recorded.
- **Synthetic smoke-tagged arguments only; no organic user text; no secrets in logs.**
- **No H/I/J** unless a later card enables them.
- **Full current A–G load** on every smoke submit (no tiering — A.1).
- **Sustained OR repeated-burst:** **3 waves of 5 arguments** (35 jobs/wave), spaced so the queue must
  drain across multiple invocations — NOT one tight burst only.
- **Verify:** queue creates **no duplicate successes** (index #4 holds); every expected
  `(argument, family, run_mode)` cell reaches `succeeded` OR an explicit terminal with the correct typed
  reason (`failed_terminal`/`dead_letter` + sub-reason); doctrine-risk `evidence_span` over positive rows
  is clean (zero banned verdict tokens — re-scan as prior smokes did); **submit remains nonblocking**
  (submit latency band unaffected, ~1.3–3.3s).
- **Measure + record:** queue latency, drain throughput (jobs/drain), time-to-first-job-start,
  time-to-full-completion, **chosen C + observed provider throughput** (RPM/TPM vs the Tier-1 ceiling),
  429/capacity counts.

### New SLO table (do NOT reuse the old strict 30s background p95 as the sole PASS criterion)

| SLO | Target |
|---|---|
| Submit latency (nonblocking) | p95 ≤ ~3.3s (unchanged from today — submit only enqueues) |
| Quiet-load time-to-first-job-start | ≤ 2s (kick path) |
| Quiet-load p95 time-to-complete (single arg, 7 families) | ≤ ~30s (C=3, ~5s/call, ⌈7/3⌉≈3 rounds) |
| Sustained-burst throughput (3×5 waves) | every cell reaches a terminal within ≤ 5 min of its wave; throughput ≈ `12·C` RPM ± tail |
| Max oldest-pending-age during burst | ≤ 5 min |
| Dead-letter threshold | 0 dead-letters for A–G under the smoke (a dead-letter is PARTIAL/FAIL trigger, see A.13) |
| Retry threshold | retries allowed (capacity/server/429) provided every cell still reaches `succeeded` within SLO |

### Verdict rules (smoke)

- **PASS** — every A–G cell reaches `succeeded` under the 3×5 burst within the async SLO; no duplicate
  successes; single-flight held (no over-concurrency observed beyond C); submit nonblocking; no
  secret/raw leak; chosen C recorded. **C tuned down (e.g. 5→3) to reach completeness is PASS-after-tune**
  (A.7).
- **PARTIAL** — completeness reached but the async SLO band is missed (e.g. oldest-pending > 5 min under
  burst), OR a topology mechanism needs adjustment (e.g. cron sub-minute unreliable forcing kick-only),
  OR dead-letters occurred but were all `provider_*` (tunable via C/pacer) — re-tune and re-smoke.
- **FAIL** — terminal holes remain (a cell never succeeds and isn't an explained terminal), OR duplicate
  success rows appear, OR submit blocks, OR H/I/J run, OR a secret/raw payload leaks, OR a classifier
  acceptance gate is observed (any submit blocked/rejected by a classifier path).

---

## A.13 — Verdict rules (design-card self-assessment)

Mapped to the card's PASS/PARTIAL/FAIL for the **design** (not the later smoke):

**PASS (this design targets all of these):**
- ✅ Detector tiering deferred (A.1) + queue tests run full A–G load (A.12).
- ✅ Queue/run-table model chosen + justified — **extend the run table (Option 2)** (A.3).
- ✅ Single-flight **proven against actual Supabase topology** — TTL lease row + `FOR UPDATE SKIP LOCKED`,
  with advisory locks rejected for cause (A.4).
- ✅ Bounded-batch drainer fits the **verified** 150s Edge ceiling (T=90s, worst-case 121s) (A.5, I9).
- ✅ Enqueue-kick (statement-level trigger via pg_net) + scheduled safety tick (pg_cron) designed (A.2).
- ✅ Duplicate prevention **DB-enforced** (partial unique index #4) (A.3).
- ✅ Dual-write hazard **eliminated** by collapsing job into the run row (Option 2) — no separate-table
  three-way write (A.3).
- ✅ Timeout hierarchy corrected — drainer's MCP call ≥ 30s, **not** the 15s submit-path clock; 15s
  submit-path value stated as needing no change (A.6).
- ✅ Liveness monitoring exists (DB-table-based SQL + runbook) (A.10).
- ✅ Cutover prevents double-dispatch (mutually-exclusive branch + DB index backstop) (A.11).
- ✅ Semantic-move budget handled honestly (Option B, verified dormant, with future-card guard) (A.8).
- ✅ C-calibration plan exists (C=3 ≤ 5, Tier-1 RPM-grounded, pacer fallback) (A.7).
- ✅ Sustained-burst verification polls queue-empty, not a fixed sleep (A.12).
- ✅ MCP server provider path unchanged + no MCP redeploy required (header + A.6 + A.8).

**PARTIAL (carried open items — surfaced, not papered over):**
- ⚠️ **pg_cron sub-minute granularity (I2) is PARTIAL** — could not be confirmed reliable read-only.
  Mitigated: the design does NOT depend on sub-minute (60s tick floor + enqueue-kick for latency). If
  sub-minute proves needed and unreliable, that is a tunable, not a blocker.
- ⚠️ **Edge plan (free vs paid) not verified read-only** — instance signals (I8) suggest free → 150s. The
  design ships T=90s against the 150s floor; if paid (400s), T can rise (operator-tunable). PARTIAL until
  the operator confirms the plan.
- ⚠️ **Anthropic tier not verified read-only** — assumed Tier 1 (I17). If the org is Tier 2+, C could rise
  toward 5; the C=3 ship is the safe lower bound. PARTIAL until the operator confirms the tier.

**FAIL (none present; explicitly avoided):**
- ✗ No session advisory lock assumed through the pooler (rejected with proof, A.4).
- ✗ Not a drain-to-empty worker (bounded N + T, A.5).
- ✗ Liveness monitoring is present (A.10).
- ✗ DB-level dedup/idempotency present (indexes #4, #5, A.3).
- ✗ No double-dispatch risk (A.11).
- ✗ No classifier acceptance gate introduced (header + A.1).
- ✗ No direct provider fanout remains on the submit path for queued families (submit enqueues only, A.11).
- ✗ Sustained-burst verification plan present (A.12).
- ✗ Detector tiering does NOT soften the queue's first A–G verification (A.1).

---

## HALT-style self-eval table

| # | HALT-trigger risk | Disposition / mitigation |
|---|---|---|
| H1 | **Migration proposed but not made** | By design — this is a DESIGN-ONLY card. The A.3 migration is a **PLAN**; the operator applies `npx supabase db push --linked` after approving the implementation card. **No migration SQL file is written by this card.** Surfaced in Operator steps. |
| H2 | **Connection-topology assumption** | Mitigated — topology **verified** (I7: PostgREST/Supavisor session-pooler 5432; I8: max_connections=60). Single-flight uses a TTL lease row + `FOR UPDATE SKIP LOCKED`, both pooler-agnostic (single-statement transactions); session advisory locks **rejected for cause** (A.4). No unverified pooler behavior is relied on. |
| H3 | **Dual-write hazard** | **Eliminated** by Option 2 (job = run row): job-state transition is a single-row UPDATE (atomic). The pre-existing run↔results split (I13) is unchanged and benign (Source 6 reads results). No separate `classification_jobs` table → no three-way dual-write (A.3). |
| H4 | **Single-flight through the pooler** | TTL lease row's conditional `INSERT … ON CONFLICT … WHERE expires_at < now()` is per-row linearizable in Postgres regardless of pooling; `FOR UPDATE SKIP LOCKED` is the per-job backstop. PROOF that overlapping invocations can't multiply C is given in A.4, binding to `L ≥ T+30s`. **Surface to operator:** confirm the lease-TTL/budget constants hold on the deployed plan. |
| H5 | **Edge-ceiling dependency** | Mitigated — ceiling **verified 150s/400s** (I9). Design ships T=90s against the conservative 150s; worst-case batch 121s < 150s with margin. **PARTIAL:** the free-vs-paid plan is not read-only verifiable → **surface to operator** to confirm the plan (T can rise to ~300s on 400s). |
| H6 | **Semantic-move unbounded** | Mitigated — **verified dormant** in production (I19: disabled-by-default, mock/fixture only, not invoked by submit). Not a live provider consumer → the design does not falsely claim a global bound it doesn't have. **Guard surfaced:** any future semantic-move-enablement card MUST fold it into this same global budget (A.8). |
| H7 | **Double-dispatch** | Mitigated — mutually-exclusive branch at the single dispatch point (I14, A.11) + the DB partial unique index #4 makes duplicate-success **DB-impossible** even under a code error. PROOF in A.11. |
| H8 | **Extensions enablement (pg_cron/pg_net) is an operator/platform action** | `CREATE EXTENSION pg_cron, pg_net` is in the migration PLAN but has platform side effects (background workers; `max_worker_processes=6` is tight, I8). **Surface to operator:** confirm pg_cron worker headroom and enable pg_net; verify the Vault credential pattern. |
| H9 | **New `verify_jwt=false` drainer endpoint** | A new internal endpoint reachable by cron must validate a Vault-stored secret internally and never accept user JWTs for the drain action. Designed (A.2/A.11). **Surface to operator:** the drainer secret lives in Vault, never in SQL or git (doctrine §6). |
| H10 | **C exceeding the Tier-1 RPM ceiling** | Mitigated — C=3 chosen specifically to keep ~36 RPM < 50 RPM (A.7). PARTIAL: tier not read-only verifiable → **surface to operator** to confirm the Anthropic tier; pacer is the designed fallback. |

---

## Dependencies (cards / docs / files)

- **Reads** the existing run table (migrations `…18`, `…19`), the dispatcher (`autoTriggerDispatcher.ts`,
  esp. `findExistingRun` at `:189` and the dispatch shape), the writer (`persistenceWriter.ts`), the
  classifier core (`classifyArgumentCore.ts`), the adapter timeout (`booleanObservationMcpAdapterCore.ts:56`),
  the family registry (`familyRegistry.ts`), Source 6 (`machineObservationPersistenceQuery.ts`), and the
  submit dispatch point (`submit-argument/index.ts:787`).
- **Harvests** from the superseded `OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md`: the typed
  `provider_capacity_exhausted` sub-reason; the safe failure-detail sanitizer rules; the doctrine
  self-check structure; the retry-after → `available_at` concept (surfacing a precise server retry-after
  is OPTIONAL here — the drainer reschedules retryable failures via `available_at` with bounded backoff
  regardless). Phase-0 topology findings (dynamic multi-isolate Deno Deploy, per-isolate state, 15s binding
  deadline) are taken as settled and not re-derived.
- **Assumes** the MCP per-isolate cap (`MCP_SERVER_MAX_PROVIDER_CONCURRENCY=5`) is live as the defensive
  backstop (operator-confirmed) — the C ≤ 5 invariant depends on it.
- **Blocks** Family H/I/J enablement (frozen until the queue is implemented + verified or a Gate H risk
  acceptance) — the queue's verification must first prove the A–G load.
- **Blocks / guards** any future `semantic-referee` enablement card (must fold semantic-move into this
  global budget, A.8).
- **Proposes** a later separate card `ARCH-CIVIL-DISCOURSE-DETECTOR-POLICY` (tiering), filed only after
  A.12 throughput is measured (A.1).

## Risks

- **pg_cron sub-minute reliability (I2)** — community-reported caveats. Mitigated by the 60s-tick-floor +
  enqueue-kick design; surfaced as PARTIAL.
- **`max_worker_processes=6` (I8)** — pg_cron consumes background workers; 6 is tight. A single periodic
  job is fine, but stacking many cron jobs could starve workers. Keep the cron footprint to one drain job.
- **Edge plan ambiguity (free/paid)** — T sized for the 150s floor; if the operator is on the 400s plan,
  the design is *conservative* (correct but could drain more per invocation). PARTIAL.
- **Anthropic tier ambiguity** — C=3 is the safe lower bound; if Tier 2+, headroom exists. PARTIAL.
- **The existing `findExistingRun` pre-check becomes belt-and-suspenders** — once index #4/#5 exist, the
  application pre-check is redundant for correctness (DB enforces it). The implementer must NOT remove the
  pre-check as part of this card (it's a latency optimization avoiding a doomed provider call); a later
  cleanup card may reconcile.
- **Adapter timeout parameterization** — the one runtime change (A.6). It is additive (optional arg
  defaulting to 15000); the implementer must ensure no existing caller's behavior changes and the
  submit-path constant is untouched.

## Out of scope

- **Detector tiering** (deferred to `ARCH-CIVIL-DISCOURSE-DETECTOR-POLICY`, A.1).
- **Family H/I/J** of any kind (frozen).
- **Any MCP server provider-path change or redeploy** (`callAnthropic`, the per-isolate cap, prompts,
  family keys, taxonomy, schema mirror, Source 6, audit-lint, `package.json`) — untouched.
- **Removing the per-isolate cap** (vestigial after the queue, but removal is later cleanup).
- **Removing the dead 15s submit-path timeout** (left in place; cleanup later).
- **Raising the per-job model timeout beyond 30s** or changing `MCP_SERVER_MODEL_TIMEOUT_MS` (server-side;
  untouched).
- **Enabling semantic-move as a live provider path** (separate future card; this card only guards it).
- **A user-facing surface** for queue/job state (operator/diagnostic only; `gameCopy.toPlainLanguage`
  untouched — no new internal code reaches a user string; if a future card surfaces job state, it adds the
  mapping + ban-list coverage).
- **Tuning C to its final value** (the A.12 smoke does that; the design ships C=3).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the queue, drainer, lease,
  and job states are pure capacity/transport scheduling — no verdict, no truth value, no standing band, no
  winner/loser. Claim order is arrival-time FIFO (`available_at, created_at`), never any score/heat/popularity
  signal. **Submit enqueues and returns 201 before any classification — NOTHING here can block posting.**
  The rules engine remains the sole acceptance gate.
- **cdiscourse-doctrine §3 (popularity is not evidence):** no engagement/virality/view/follower/heat input
  anywhere in enqueue, claim ordering, retry, or pacing. The only inputs are job state, `available_at`,
  arrival time, a clock, live-permit/lease state, and the provider's `retry-after`. None grants factual
  standing.
- **cdiscourse-doctrine §4 (AI moderator limits):** unchanged — the classifier still returns advisory
  structural Machine Observations (`provider:'mcp'`), never authoritative, never auto-acting, never a
  truth value. The queue only governs **WHEN** the provider call runs, never **WHAT** it concludes, and it
  runs strictly **AFTER** storage.
- **cdiscourse-doctrine §5 (rules engine sacred):** `src/lib/constitution/engine.ts` is untouched — the
  queue is server-runtime IO, never imported by the engine; the engine stays pure/sync/JSON-serializable.
- **cdiscourse-doctrine §6 (secrets):** no queue row, log line, lease row, or audit row carries a prompt,
  argument body, raw provider payload, `ANTHROPIC_API_KEY`/x-api-key, `Authorization`/`Bearer`, or
  service-role key. Failure rows carry only the **typed sub-reason** + the existing allowlisted, sanitized
  `failureDetail` (I13). The cron→drainer credential lives in **Supabase Vault** (verified available, I5),
  never in SQL or git; the drainer endpoint validates it internally. Ban-list + secret-scan tests (A.9)
  enforce this.
- **cdiscourse-doctrine §7 (no AI calls from the production app):** unchanged — the Anthropic call stays
  inside the MCP server (Deno); the drainer is a Supabase Edge Function (server-side), not `src/`/`app/`.
  No `src/`/`app/` file imports the drainer, the queue writer, or any provider client. The new code lives
  under `supabase/functions/` (server-only tree).
- **cdiscourse-doctrine §8 (Supabase conventions):** RLS stays enabled on the run/results tables and is
  added to the new lease/audit tables; **no client write policy** is added (drainer writes via service-role,
  which bypasses RLS — same as today, I13). The append-only **result** ledger is preserved (results are
  still INSERT-only, I13); the run row gains a lifecycle UPDATE, which is a *job* transition, not a
  mutation of an immutable audit fact (the terminal `status`/results remain the audit trail). Migrations
  are sequenced, never edit an applied file (a NEW migration), OPS-001 four-class posture observed (A.3).
  No service-role in client.
- **cdiscourse-doctrine §10a (observations vs allegations):** every persisted row remains a **Machine
  Observation** (kind unchanged; the queue never relabels output or implies a person made a claim). The
  queue is infrastructure beneath the observation, never a new label class.

---

## Operator steps (if any) — for the LATER implementation card, NOT this design card

**This design card requires the operator to do NOTHING except review + approve.** It writes one untracked
doc and commits nothing. The steps below are what the *future implementation* card will require (listed so
the operator can pre-assess feasibility):

1. **Apply the migration** — `npx supabase db push --linked` (the A.3 columns/indexes + lease/audit
   tables). Migration-bearing → heightened reviewer verification per OPS-001.
2. **Enable extensions** — `CREATE EXTENSION pg_cron; CREATE EXTENSION pg_net;` (in the migration or a
   one-time operator step). Confirm pg_cron background-worker headroom (`max_worker_processes=6`, I8).
3. **Store the cron→drainer credential in Vault** — `vault.create_secret(...)` for the project URL +
   service key; never in SQL or git.
4. **Deploy the drainer Edge Function** + add `[functions.classifier-drainer] verify_jwt = false` to
   `config.toml` (auto-deploy on merge via the Supabase GitHub integration).
5. **Schedule the cron tick** — `cron.schedule('classifier-drain', '60 seconds'|'* * * * *', $$ SELECT net.http_post(...) $$);`
   (sub-minute optional/PARTIAL; 1-minute floor is the safe default).
6. **Confirm the Anthropic tier + Edge plan** (resolves the two PARTIAL items: tier → C headroom; plan →
   drain budget T).
7. **Run the A.12 smoke** (canary → 3×5 burst, poll-to-settle) and record the verdict in a new
   `docs/audits/` doc.
8. **No MCP-server redeploy** is required by this card.

---

## Open questions for the operator

1. **Anthropic usage tier?** The design assumes **Tier 1** (50 RPM Haiku-4.5) and ships **C=3**. If the
   org is Tier 2+ (1,000 RPM), C could safely rise toward 5. Confirm the tier.
2. **Edge plan (free 150s vs paid 400s)?** Instance signals suggest free → the design ships T=90s against
   150s. Confirm the plan; on 400s, T can rise to ~300s (more jobs/invocation, fewer invocations).
3. **C as code constant vs validated env override?** Recommendation: code constant for the first ship
   (auditable, can't be silently unbounded); add a clamped (`≤5`) validated env override only if smoke
   retuning proves it needed.
4. **Kick mechanism preference** — statement-level `AFTER INSERT` trigger via `net.http_post` (preferred,
   inherently debounced, off the Edge wall-clock) vs an Edge-side `fetch` kick from `submit-argument`?
   The design defaults to the trigger; confirm acceptability of the pg_net dependency on the write path.
