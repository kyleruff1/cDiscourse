# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL — Topology-aware provider reliability cutover plan

**Status:** Design draft. No production code, no migration, no runtime flag change, no deploy in this card.
**Epic:** Epic 12 / MCP semantic-referee track (Civil Discourse classifier infrastructure)
**Issue / trail:** #373 (provider/server reliability architecture umbrella); references #391 (H Card 3), #388 (H umbrella), #371 (per-isolate cap, superseded).
**Branch:** `design/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL`
**Date:** 2026-06-01 UTC (operator local 2026-05-31).
**Operator:** Kyler.

> **Filename note.** The operator's prompt for this card suggested `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md`. That file ALREADY EXISTS as the **SUPERSEDED** record of Option A (Deno-KV in-MCP-server admission limiter; rejected 2026-05-30, retained for harvest). To preserve the rejected-alternative record without overwriting it, this card uses a non-colliding filename. The substantive content (RCA + chosen architecture + cutover plan) is in this file.

> **Doctrine acceptance-gate constraint (HARD; repeated at the top because it is the spine of this design):** AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine (`src/lib/constitution/engine.ts`) remains the sole acceptance gate. Classifiers run AFTER an argument is stored. No path designed here may block, reject, route, or delay an ordinary post.

> **What this card touches.** Documentation only — a new design doc + optional review doc + optional current-status entry. **No** runtime code, **no** migration, **no** runtime flag flip, **no** deploy, **no** prompt / taxonomy / family-key / schema-mirror / Source 6 / audit-lint / package.json / production-flag change. **No** invocation of `submit-argument`, `classify-argument-boolean-observations`, or any provider-spend path.

---

## 0. Scope and non-goals

### Scope

1. Consolidate the H Card 3 production smoke FAIL (PR #407 / `540bfeb`) into a single RCA + architectural recommendation.
2. Confirm the chosen architecture (ARCH-001 Postgres async classifier queue) and reference its already-shipped substrate.
3. Define the **cutover plan** — the staged rollout that must complete before the H production-enable smoke is re-attempted.
4. Identify any gaps in ARCH-001's already-shipped surface that the cutover requires before the master routing flag is flipped on for non-smoke production traffic.
5. List the Stage 2B operator gates that must be cleared before any cutover step is taken.

### Non-goals

- Implementation of any of the cutover steps. This card is design-only.
- Migration of code, schema, or runtime flags.
- Re-attempt of the H Card 3 production-enable smoke.
- Family I production-enable or any I-track work.
- H observability backfill.
- Re-derivation of the architecture fork that ARCH-001 already settled.
- Modification of `mcp-server/lib/familyH*.ts` (Card 1 server admin_validation files; preserved).
- Modification of `scripts/ops/audit-lint-rules.cjs` (Card 2 L5 entries; preserved).
- Annotation of `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE-intent.md` (Adv 3 stale-precondition finding from the rollback PR; deferred to a separate followup card).

---

## 1. Current production state (verified at HEAD `722f17b`)

| Item | State | Verified at |
|---|---|---|
| Production family roster | A–G (7 families): `parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress` | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:68-118` |
| Family H `claim_clarity` | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:104-108` |
| Family I/J | `productionEnabled: false`, `adminValidationEnabled: true` | `familyRegistry.ts:109-118` |
| Edge dispatcher bounded-parallel limit | `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` | `autoTriggerConcurrency.ts` |
| MCP server per-isolate provider cap | `MCP_SERVER_MAX_PROVIDER_CONCURRENCY = 5` (default; per-isolate) | `mcp-server/lib/providerConcurrency.ts:24,117-138` |
| Edge→MCP fetch timeout | `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15000ms` (BINDING deadline) | `booleanObservationMcpAdapterCore.ts:56` |
| MCP server request timeout | `MCP_SERVER_REQUEST_TIMEOUT_MS = 30000ms` (looser; NOT binding) | `mcp-server/.env.local.example` |
| Anthropic model timeout | `MCP_SERVER_MODEL_TIMEOUT_MS = 25000ms` (looser; NOT binding) | `anthropicCall.ts:32,97-103` |
| Anthropic model | `claude-haiku-4-5` | `anthropicCall.ts:31` |
| ARCH-001 substrate | Migrations 21 (queue), 22 (atomic finalizer), 23 (enqueue kick) APPLIED | `supabase/migrations/2026052800002[123]_*` |
| ARCH-001 drainer Edge Function | `classifier-drainer/index.ts` ACTIVE | `supabase/functions/classifier-drainer/index.ts` |
| ARCH-001 routing module | `classifierQueueRouting.ts` with master-enable flag + percentage knob | `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts` |
| ARCH-001 master routing flag | `CLASSIFIER_QUEUE_ROUTING_ENABLED` — **DEFAULT DISABLED** (must be exactly `'true'`) | `classifierQueueRouting.ts:55-61`; submit-argument reads at `index.ts:812` |
| ARCH-001 staged rollout knob | `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` — DEFAULT 0 (smoke-tag override only) | `classifierQueueRouting.ts:64-72`; submit-argument reads at `index.ts:815` |
| ARCH-001 smoke-tag prefix | `[arch-001-queue-smoke]` (routing override path; only this prefix routes when master flag is on and percentage is 0) | `classifierQueueRouting.ts:51` |
| ARCH-001 Card 3 smoke verdict | **PASS** (2026-05-31); 112/112 cells terminal; 0 H/I/J leak; 0 duplicate-success; kick coalescing 84.82% reduction; dead-letter 0.893%; doctrine 0 banned tokens | `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` |
| H Card 3 production-enable smoke | **FAIL** (2026-06-01); canary terminal hole on `argument_scheme`; burst 1/4 reached 8/8 with terminal holes on 4 families | `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` |
| H Card 3 production-enable rollback | **MERGED** (PR #408 / `722f17b`); production roster restored to A–G | `git log -1 722f17b` |

**Routing path matrix (post-rollback):**

| Argument shape | Master flag `CLASSIFIER_QUEUE_ROUTING_ENABLED` | Routing percentage | Smoke tag on debate | Path taken |
|---|---|---|---|---|
| Ordinary production submit (today) | `false` (DEFAULT) | 0 | (any) | **DIRECT-dispatch** (`dispatchAutoTriggerForArgument`; the path that failed in the H Card 3 smoke) |
| ARCH-001 smoke-tagged submit | `true` (operator-flipped during smoke window) | 0 | `[arch-001-queue-smoke]…` | **ARCH-001 queue** (enqueue → drainer; the path that PASSED the ARCH-001 Card 3 smoke) |
| Synthetic H smoke submit (the H FAIL canary + burst) | `false` | 0 | `[mcp-021c-family-h-enable-smoke 2026-05-31]…` | **DIRECT-dispatch** (the H FAIL ran here because the H smoke tag is NOT the ARCH-001 routing tag) |
| Staged-rollout production submit (proposed; this card's cutover) | `true` | 1 → 5 → 25 → 50 → 100 (incrementally) | (any) | ARCH-001 queue for the percentage bucket; DIRECT for the rest |

**Critical observation:** the H Card 3 production-enable smoke ran on the LEGACY direct-dispatch path. ARCH-001 was never exercised by the H FAIL. The H FAIL's `mcp_api_error` cluster is the SAME failure class that #371 cap=5 PARTIAL and #368 baseline already documented — `{isError}` not reduced by per-isolate cap because multi-isolate fan-in makes global Anthropic concurrency unbounded.

---

## 2. RCA consolidation

### Q1. Is this a family-count limit?

**No.** Increasing the production family count from 7 (A–G) to 8 (A–H) added pressure, but the root cause is **uncoordinated global provider concurrency**, not the family count itself. The same failure mode appeared with N=7 families during the cap=5 PARTIAL audit (5 `{isError}` events on a 5-arg burst with N=7) and the cap=2 FAIL audit (53 `mcp_network_error` events at N=7); the H Card 3 smoke just re-exposed the same class at N=8 + 5 args. A family-count ceiling would manifest as a clean cliff at a specific N — what we observe is a steady-state reliability defect that gets worse linearly with the offered provider load.

### Q2. Is A–F or A–G a permanent ceiling?

**No.** A–G is the *current safe production posture* — it works under bounded-parallel limit=2 because the offered provider load (7 families × N submits × bounded-parallel 2 per submit) happens to sit below the cliff most of the time. The rollback to A–G is a *temporary safety measure* until the provider-reliability fix lands. ARCH-001 (the chosen architecture) lifts the ceiling by moving the control point Supabase-side and decoupling submit from provider-side scheduling. Once the cutover is complete, the family count is no longer the load knob — the drainer's bounded concurrency `C` is.

### Q3. What failed?

1. **Provider/server error envelopes (the recurrent `{isError}` / `mcp_api_error` class).** Visible in #368 baseline (~4/35 cells), cap=5 PARTIAL (~5/35 cells, p95 37.61s), the H Card 3 smoke (11 cell-level `mcp_api_error` failures across canary + 4 burst args at N=8 family load; spread `argument_scheme` 5× / `claim_clarity` 2× / `critical_question` 2× / `disagreement_axis` 2×; 4 of 5 args carried at least one failed cell). Anthropic's Tier-1 limits (50 RPM / 50k ITPM / 10k OTPM per `claude-haiku-4-5`) plus token-bucket "60 RPM may be enforced as 1 req/s" produce envelope errors under short clustered bursts; the per-isolate cap cannot prevent this because the burst spreads across isolates.
2. **Per-isolate cap proven exhausted as a control point.** cap=5 PARTIAL (`{isError}` not reduced) + cap=2 FAIL (queue starves vs 15s Edge timeout → 53 `mcp_network_error`). The per-isolate semaphore is structurally insufficient under dynamic multi-isolate Deno Deploy fan-in.
3. **Edge static retry tuning ceiling.** 2s retry re-entered hot window; 7–10s retry healed some isolated failures but stacked into p95 >45s under clustered failures (#365 + #368 history).
4. **Fixed Edge→MCP timeout interaction.** The 15000ms abort is the binding deadline. The MCP server's own request (30s) and model (25s) deadlines are LOOSER. This inverted hierarchy makes any in-request waiting structurally unsafe — a deep queue inside the request lifecycle WILL starve against the 15s ceiling.
5. **H Card 3 production-enable smoke ran on the LEGACY direct-dispatch path.** The H synthetic harness used the H smoke tag (`[mcp-021c-family-h-enable-smoke 2026-05-31]`), which does NOT match the ARCH-001 routing tag (`[arch-001-queue-smoke]`); the routing master flag is default-disabled; the staged-rollout percentage is 0. So the H FAIL is not a falsification of ARCH-001 — it is a re-exposure of the legacy path's known reliability ceiling at N=8 family load.

### Q4. What succeeded?

1. **Bounded parallelism limit=2 held throughout the H FAIL** (`maxOverlapObserved = 2` across all canary + 4 burst args). The Edge-side concurrency bound is doing its job — what failed is the provider-side reliability under the offered load.
2. **Submit stayed nonblocking.** Every submit returned 201 within bot-test wall budget; the H FAIL did not leak into user-visible latency or blocking behavior.
3. **H server / admin_validation support preserved.** `mcp-server/lib/familyH*.ts` zero diff; H continues to be classifiable under admin_validation mode without changes.
4. **H L5 doctrine enforcement preserved.** `claim_clarity` / `family_h` / `claim_specificity_low` remain in `DOCTRINE_RISK_FAMILIES` at `audit-lint-rules.cjs:79-91`. Any future H production-enable smoke audit will be CI-mechanically L5-enforced from the moment it lands.
5. **H produced clean positive result rows on the runs that completed.** 29 H production success rows across 4 args; 0 banned-token hits across 7 banned-token categories; every positive raw_key in the 12-key `ai_classifier` set; no deterministic / auto_metadata / lifecycle key leak. Family H itself is not the proximate defect.
6. **Rollback restored safe A–G state.** Test count returned to exact pre-Card-3 baseline (18,762 / 594 suites); typecheck / lint clean; mcp-server / src / migrations / package.json / audit-lint scripts all zero diff.
7. **ARCH-001 architecture is shipped and SMOKE-PASSED.** Card 1 (substrate), Card 2 (drainer + enqueue), Card 2a (atomic finalizer), Card 3 (production smoke + staged rollout knob) all landed; ARCH-001 Card 3 smoke 2026-05-31 PASS (112/112 cells terminal, 0 H/I/J leak, kick coalescing 84.82% reduction, dead-letter 0.893%, 0 banned tokens). The infrastructure is ready; only the master flag + percentage knob are default-off on non-smoke production traffic.

---

## 3. Architecture fork analysis

The architecture fork was settled by ARCH-001 in `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` (committed design draft; APPROVED 2026-05-30; implementation through Card 3 SHIPPED). The three options are restated here at-a-glance and the chosen path is the same one ARCH-001 already adopted.

### Option A — Hot-path global admission control (Deno-KV admission limiter inside MCP server)

- **Mechanism:** shared global concurrency counter in Deno KV; MCP server's `callAnthropic` consults the counter before issuing a provider call; if at cap, return typed `provider_capacity_exhausted` with bounded `retryAfterMs`; Edge honors the retry-after in `waitUntil`.
- **Status:** **SUPERSEDED 2026-05-30.** Documented in `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md`.
- **Why rejected (recorded; not re-litigated):**
  - **15s tail risk.** A slot-wait (~2s) plus an Anthropic round-trip (~13s p95) ≈ 14.9s, right at the Edge→MCP 15000ms abort. Any KV latency or cross-region consistency drift pushes the tail past 15s.
  - **Cross-region KV consistency is SOFT.** The global bound under KV is a best-effort, not linearizable, and FAILS OPEN under KV slowness (stops limiting rather than blocking).
  - **Touches byte-equal-verified `callAnthropic`.** Requires an MCP server redeploy and re-verification of the provider hot path.
- **Risks (would have to mitigate):** distributed-counter correctness; lease leaks; stale reads / consistency model; retry thrash; timeout hierarchy.

### Option B — Async classifier queue / drainer (ARCH-001)

- **Mechanism:** submit-argument enqueues N rows into a Postgres table (one per requested family); a single-flight drainer Edge Function (pg_cron tick every 60s + statement-level enqueue kick via pg_net + `pg_try_advisory_xact_lock` coalescing) claims due jobs and processes them at a bounded global rate `C`. Submit returns 201 immediately; no provider call on the submit path. Retries are rescheduled via `available_at`; terminal failures are typed and dead-lettered. Single-flight is enforced by a DB-level `pg_advisory_xact_lock`; deduplication is enforced by partial unique indexes `(argument_id, family, run_mode)` — one success row per cell at the DB level, not in application code.
- **Status:** **CHOSEN PATH.** SHIPPED through ARCH-001 Card 3 (`d42d6da`) with smoke PASS 2026-05-31.
- **What ARCH-001 already provides:**
  - Migrations 21/22/23 applied (queue substrate; atomic finalizer; statement-level enqueue kick).
  - `supabase/functions/classifier-drainer/index.ts` ACTIVE; cron firing every minute; `outcome=completed` on empty queue.
  - `classifierQueueRouting.ts` with `shouldRouteToQueue(argument, debate, enabled, percentage)` pure predicate.
  - Default-disabled master flag (`CLASSIFIER_QUEUE_ROUTING_ENABLED` must be exactly `'true'`).
  - Staged-rollout knob (`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` 0–100; default 0; fail-closed on negative; clamp-up on overshoot).
  - Smoke-tag override (`[arch-001-queue-smoke]`) independent of percentage — only smoke-tagged debates route at percentage=0.
  - Single-flight: pg_advisory_xact_lock; verified 0 overlapping drains in ARCH-001 Card 3 smoke (56 drain invocations, 0 overlap).
  - Deduplication invariant: DB partial unique index on `(argument_id, family, run_mode)` for success rows + `(argument_id, family, run_mode) WHERE active` for in-flight; verified 0 duplicate-success in ARCH-001 Card 3 smoke.
  - Liveness: `classifier_drain_audit` table with outcome per drain tick; ARCH-001 Card 3 smoke confirmed cron firing every minute on empty queue.
  - Kick coalescing: statement-level `AFTER INSERT` trigger fires one `net.http_post` per multi-row INSERT (7 enqueues in one statement → 1 kick); verified 84.82% reduction vs Card 2.
  - Retry backoff schedule: `DRAINER_MAX_ATTEMPTS=4` with `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS=[60, 180, 360]` for the api_error / provider_server_error class.
  - Drainer concurrency: `C=3` (bounded global provider concurrency at the drainer; per-isolate cap stays 5 as defense-in-depth).
  - Timeout discipline: drainer's MCP-call timeout is 90s (T=90s) — looser than the Edge submit-path 15s, decoupled from the submit lifecycle.
- **What ARCH-001 explicitly DOES NOT do:**
  - Strict sub-30s per-argument completion SLO. ARCH-001 relaxes the background-completion target from "p95 < 30s per argument" to **bounded eventual completion / throughput** — a job is processed when its turn comes in the drainer queue. Per-argument tail wall-clock can be longer than the legacy direct-dispatch path's tail when the queue depth is non-trivial. The cron-tick floor + kick coalescing keep the median fast for quiet load.
  - Reduction of the A–G family count.
  - Replacement of the MCP server provider path. The drainer calls the same MCP server endpoint; only the *caller* and *control point* change.

### Option C — Server-side queue / worker inside MCP layer

- **Mechanism:** MCP server accepts requests, internally enqueues provider calls, and responds either when the work is done or with an explicit "accepted; check back" envelope.
- **Status:** **REJECTED.** Two failure modes:
  - If the server *waits* for the internal queue to clear before responding, it inherits the 15000ms Edge→MCP abort and reproduces the cap=2 FAIL pattern (mass `mcp_network_error`).
  - If the server *sheds fast* on internal queue saturation, it produces an envelope (similar to Option A's `provider_capacity_exhausted`), and the caller has to re-poll — moving the orchestration burden to the caller, which is exactly what Option B already does with a Postgres-backed queue. Option B is more durable (DB persistence) and observable (audit table) than a server-internal queue would be.

### Recommended option

**Option B (ARCH-001).** Already chosen, already shipped through Card 3, already smoke-passed. This card's contribution is the **production cutover plan** that takes ARCH-001 from "smoke-tag-only on non-production traffic" to "100% of non-smoke production traffic routed via the queue", in measured stages, with a rollback at each stage. Once cutover Stage 5 (100% routing) is verified PASS, the H Card 3 production-enable smoke is re-attempted under the ARCH-001 path — which is what should have been done the first time.

**SLO relaxation acknowledgment.** Adopting Option B at scale means accepting that the production background classification SLO shifts from "strict p95 < 30s per argument" to **bounded eventual completion / throughput** with a typed liveness floor (drainer last-success-tick freshness < N minutes; queue depth oldest-pending-age < M minutes; dead-letter rate < 1%). For the rules-engine-gated submit path this is doctrinally fine — the user post is never blocked on the classifier.

---

## 4. Timeout hierarchy analysis

Current verified constants:

| Layer | Constant | Value | Source |
|---|---|---|---|
| Edge submit path → MCP fetch abort | `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS` | **15000 ms** (BINDING) | `booleanObservationMcpAdapterCore.ts:56` |
| MCP server request budget | `MCP_SERVER_REQUEST_TIMEOUT_MS` | 30000 ms | `mcp-server/.env.local.example` |
| Anthropic model call (inside MCP server) | `MCP_SERVER_MODEL_TIMEOUT_MS` | 25000 ms (default in code) | `anthropicCall.ts:32,97-103` |
| Effective Anthropic timeout (Edge call) | `min(env timeout, per-tool timeout)` | min(25000, perTool) | `anthropicCall.ts:116-120` |
| Drainer Edge function MCP-call timeout (ARCH-001) | `T` | 90000 ms (T=90s) | ARCH-001 Card 3 audit §Phase 0 |
| Per-isolate provider concurrency cap | `MCP_SERVER_MAX_PROVIDER_CONCURRENCY` | 5 (per-isolate; default) | `providerConcurrency.ts:24` |
| Drainer global concurrency | `C` | 3 | ARCH-001 Card 3 audit §Phase 0 |
| Drainer cron tick | (cron expression) | `* * * * *` (every minute) | ARCH-001 Card 3 audit §Phase A4 |
| Drainer max attempts | `DRAINER_MAX_ATTEMPTS` | 4 | ARCH-001 Card 3 audit §Phase A6 |
| Drainer provider_server_error backoff schedule (seconds) | `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS` | [60, 180, 360] | ARCH-001 Card 3 audit §Phase A6 |
| Edge Function wall-clock ceiling (Supabase Edge) | (vendor) | 150s free / 400s paid (binding ceiling for drainer wall-clock + waitUntil) | Supabase Functions limits docs |

### Are these inverted? (Submit path)

**YES, on the submit path.** The BINDING deadline is the OUTERMOST one (15000ms Edge→MCP abort), while the actual work happens behind two looser deadlines (30000ms server budget, 25000ms model timeout). This inversion is what makes any in-request waiting (per-isolate queue, KV slot-wait, internal MCP queue) structurally unsafe.

### Are these inverted? (Drainer path)

**No.** The drainer's `T = 90000ms` MCP-call timeout is LOOSER than the MCP server's 30000ms request budget — the drainer is willing to wait the full MCP server budget plus headroom. The 150s Edge Function wall-clock ceiling is the outermost bound and is comfortably above both the MCP server budget and the drainer's per-call T. This is the correct hierarchy: the BINDING deadline is the OUTERMOST one, with looser deadlines nested inside.

### Required design principle

**No in-request waiting past the caller timeout.** Prefer shed-fast / enqueue / retry-later over waiting inside the HTTP request. ARCH-001 satisfies this principle by moving provider work off the submit path entirely — the submit path's only provider-adjacent action is a fast local INSERT into the queue table (no network, no provider call). The drainer's longer T is safe because the drainer is NOT inside any user-facing request lifecycle.

---

## 5. Queue design requirements vs ARCH-001 satisfactions

### 5.1 Single-flight drainer

| Requirement | ARCH-001 satisfaction | Status |
|---|---|---|
| Scheduled invocation must not allow overlapping drainers | DB advisory lock (`pg_try_advisory_xact_lock`) in the drainer entry; a second concurrent invocation finds the lock held and exits immediately | **SATISFIED** (ARCH-001 Card 3 smoke: 0 overlapping drains across 56 drain invocations) |
| `SKIP LOCKED` alone is not enough | ARCH-001 uses BOTH the advisory lock (single-flight) AND `FOR UPDATE SKIP LOCKED` (per-row claim within the single flight) | **SATISFIED** (advisory lock prevents parallel drainers; SKIP LOCKED is for safe per-row claim within the single drain) |

### 5.2 Deduplication invariant

| Requirement | ARCH-001 satisfaction | Status |
|---|---|---|
| One success row per `(argument_id, family, run_mode)` | DB partial unique index `(argument_id, family, run_mode) WHERE status = 'success'` (migration 21) | **SATISFIED** (ARCH-001 Card 3 smoke: 0 duplicate-success rows across 112 cells) |
| One active job per `(argument_id, family, run_mode)` | DB partial unique index `(argument_id, family, run_mode) WHERE status IN (active states)` (migration 21) | **SATISFIED** |
| Prefer DB constraint or atomic finalizer, not test-only assurance | Atomic finalizer in migration 22 (single SQL function that flips status from `in_progress` to `success` + writes results in one transaction) | **SATISFIED** |

### 5.3 Liveness monitoring

| Requirement | ARCH-001 satisfaction | Status |
|---|---|---|
| Queue depth | `argument_machine_observation_runs` queryable by `status IN (pending, active states)` count | **SATISFIED** (read-only SQL; no application metric needed) |
| Oldest-pending age | `argument_machine_observation_runs` queryable by `MIN(created_at) WHERE status = 'pending'` | **SATISFIED** |
| Dead-letter count | `argument_machine_observation_runs` queryable by `status = 'dead_letter'` count | **SATISFIED** (ARCH-001 Card 3 smoke: 1/112 = 0.893% dead-letter rate) |
| Drainer last successful run timestamp | `classifier_drain_audit` table holds outcome per drain tick; `outcome = 'completed'` records show last successful drain time | **SATISFIED** (ARCH-001 Card 3 smoke: cron firing every minute, most recent `completed` 42s before audit observation) |
| Alert if no completed drain tick within threshold | **GAP** — no alerting wired today; the audit table is queryable but no operator alert fires automatically | **PARTIAL — gap noted for cutover** |

### 5.4 Cutover flag

| Requirement | ARCH-001 satisfaction | Status |
|---|---|---|
| Direct dispatch vs enqueue must be mutually exclusive | `classifierQueueRouting.ts:shouldRouteToQueue` returns a boolean; the submit-argument branch is `if (routedToQueue) { enqueue } else { dispatchAutoTriggerForArgument }` — mutually exclusive per design §A.11 double-dispatch proof | **SATISFIED** (ARCH-001 Card 3 smoke: 0 direct-dispatch leakage on routed args) |
| Routing flag should default disabled | `CLASSIFIER_QUEUE_ROUTING_ENABLED` strict `=== 'true'` check; missing/empty/any-other-value → disabled | **SATISFIED** |
| Smoke tag override available | `[arch-001-queue-smoke]` prefix on debate title routes the argument independent of percentage (still requires master flag on) | **SATISFIED** |
| Production rollout percentage separate from smoke override | `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` knob; smoke-tag override active at percentage=0; percentage > 0 active for non-smoke-tagged debates | **SATISFIED** |
| Mutually exclusive: master flag off + percentage > 0 must be INERT | Predicate first check is `enabled !== true → return false` regardless of percentage | **SATISFIED** |

### 5.5 Retry / backoff behavior

| Requirement | ARCH-001 satisfaction | Status |
|---|---|---|
| Retry-after natural as `available_at` | `argument_machine_observation_runs.available_at` column; drainer claim queries `WHERE available_at <= now()` | **SATISFIED** |
| Avoid hot-path retry waits | Retries are deferred via `available_at`; no in-request waiting | **SATISFIED** |
| Retry attempts bounded | `DRAINER_MAX_ATTEMPTS = 4`; on attempt > max → `dead_letter` | **SATISFIED** |
| Terminal failures typed | `failure_reason` column with typed reason classes; `dead_letter` is a separate status from `failed` | **SATISFIED** |
| Schedule shape | `[60, 180, 360]` seconds for the `provider_server_error` / `api_error` class; verified in ARCH-001 Card 3 smoke to bound a known-persistent failure at lifetime ~795s | **SATISFIED** |

### 5.6 Verification shape

| Requirement | ARCH-001 satisfaction | Status |
|---|---|---|
| Canary | 1 synthetic submit; verified per-cell terminal completeness | **SATISFIED in ARCH-001 Card 3 smoke** |
| Sustained / repeated burst (not a single burst only) | 3 waves × 5 args with 30s spacing; verified 112/112 cells terminal | **SATISFIED in ARCH-001 Card 3 smoke** |
| Queue depth / time-to-first-job / time-to-complete | Measured: time-to-first-job < 1s on quiet kick; settle wall ~15.7s canary, ~13min for 15-burst | **SATISFIED in ARCH-001 Card 3 smoke** |
| Run-completeness (100% grid coverage) | Verified 100% grid coverage; 0 H/I/J leak | **SATISFIED in ARCH-001 Card 3 smoke** |
| Duplicate-success absence | Verified 0 duplicates | **SATISFIED in ARCH-001 Card 3 smoke** |
| Doctrine `evidence_span` cleanliness | Verified 0 banned tokens across 185 evidence-span scans | **SATISFIED in ARCH-001 Card 3 smoke** |
| Provider RPM / throughput | Measured 27 calls/min instantaneous in canary; below Anthropic Tier-1 50 RPM ceiling | **SATISFIED in ARCH-001 Card 3 smoke** |
| Drainer liveness | `classifier_drain_audit.outcome='completed'` rows within 30-min window; cron firing every minute | **SATISFIED in ARCH-001 Card 3 smoke** |

### 5.7 Gap summary

The only material gap surfaced above is **5.3 alerting**: queue depth / dead-letter count / drainer last-success-tick are queryable but not alerted. **Adversarial review surfaced that "operator-driven SQL observability" is NOT sufficient without explicit cadence + queries + detection SLA + fallback** — a dead drainer at 1% routing would silently queue arguments for hours before manual detection. The fix is:

- §6 Stage 1 now carries an explicit SQL query set (§5.8 below) + an explicit check cadence + an explicit detection SLA + a fallback "auto-rollback if missed-check" rule.
- §8 Stage 2B gate 6 (rollback rehearsal) is expanded to include drainer-failure scenario rehearsal.
- The alerting gate at Stage 4 stays, but Stages 1-3 are no longer "hope-based" — they have a defined operator obligation.

### 5.8 Operator SQL query set (Stages 1-5)

The operator MUST run the following 8 queries during each Stages-1-through-3 check window. The exact SQL is reproduced inline so the operator can copy-paste into `npx supabase db query --linked --file <path>` without ambiguity. None of these is provider-spend; all are read-only SELECTs.

> **Convention.** `:routing_start` is the Stage 1 begin timestamp (operator-supplied parameter at check time; placeholder shown). Replace inline when running. All queries return aggregate rows only — no `evidence_span` content, no body text, no JWTs. The doctrine ban-list scan in M8 returns counts only.

**M1 — Drainer cron freshness (most critical):**

```sql
SELECT
  EXTRACT(EPOCH FROM (now() - MAX(completed_at))) AS seconds_since_last_completed_drain,
  COUNT(*) FILTER (WHERE outcome = 'completed') AS completed_in_window,
  COUNT(*) FILTER (WHERE outcome != 'completed') AS non_completed_in_window
FROM public.classifier_drain_audit
WHERE completed_at >= now() - INTERVAL '30 minutes';
-- PASS: seconds_since_last_completed_drain < 120 (drainer ticked within 2 min)
-- PARTIAL: 120-300 (one missed tick; investigate)
-- FAIL: > 300 (drainer is stuck or stopped; auto-rollback)
```

**M2 — Queue depth + oldest-pending-age:**

```sql
SELECT
  COUNT(*) FILTER (WHERE state IN ('pending', 'leased', 'retry_scheduled')) AS non_terminal_rows,
  EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE state = 'pending'))) AS oldest_pending_age_seconds,
  COUNT(*) FILTER (WHERE state = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE state = 'leased') AS leased_count,
  COUNT(*) FILTER (WHERE state = 'retry_scheduled') AS retry_scheduled_count
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL  -- queue rows only; legacy direct-dispatch has family=NULL on the run row
  AND created_at >= now() - INTERVAL '30 minutes';
-- PASS: oldest_pending_age_seconds < 300 (5 min)
-- PARTIAL: 300-900 (5-15 min; investigate)
-- FAIL: > 900 (drainer behind; auto-rollback)
```

**M3 — Per-cell completeness on routed arguments in last window:**

```sql
WITH routed_args AS (
  SELECT DISTINCT argument_id
  FROM public.argument_machine_observation_runs
  WHERE family IS NOT NULL
    AND created_at >= now() - INTERVAL '1 hour'
)
SELECT
  COUNT(DISTINCT r.argument_id) AS routed_arg_count,
  COUNT(*) FILTER (WHERE r.state = 'succeeded') AS succeeded_cells,
  COUNT(*) FILTER (WHERE r.state = 'dead_letter') AS dead_letter_cells,
  COUNT(*) FILTER (WHERE r.state NOT IN ('succeeded', 'dead_letter', 'failed_terminal')) AS non_terminal_cells,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE r.state = 'succeeded')
    / NULLIF(COUNT(DISTINCT r.argument_id) * 7, 0),
    2
  ) AS pct_grid_coverage
FROM public.argument_machine_observation_runs r
WHERE r.argument_id IN (SELECT argument_id FROM routed_args)
  AND r.family IS NOT NULL;
-- PASS: pct_grid_coverage > 99.0% (allows some in-flight)
-- PARTIAL: 95-99%
-- FAIL: < 95%
```

**M4 — Dead-letter rate over last window:**

```sql
SELECT
  COUNT(*) AS total_terminal_cells,
  COUNT(*) FILTER (WHERE state = 'dead_letter') AS dead_letter_cells,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE state = 'dead_letter') / NULLIF(COUNT(*), 0),
    3
  ) AS dead_letter_pct
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL
  AND state IN ('succeeded', 'dead_letter', 'failed_terminal')
  AND created_at >= now() - INTERVAL '24 hours';
-- PASS: dead_letter_pct < 1.0
-- PARTIAL: 1.0-3.0
-- FAIL: > 3.0
```

**M5 — Duplicate-success absence:**

```sql
SELECT
  argument_id,
  family,
  run_mode,
  COUNT(*) AS success_row_count
FROM public.argument_machine_observation_runs
WHERE state = 'succeeded'
  AND family IS NOT NULL
  AND created_at >= now() - INTERVAL '24 hours'
GROUP BY argument_id, family, run_mode
HAVING COUNT(*) > 1
LIMIT 50;
-- PASS: 0 rows returned (the DB partial unique index prevents this; query is a defensive backstop)
-- FAIL: ANY rows returned → IMMEDIATE auto-rollback + escalation
```

**M6 — Direct-dispatch leakage absence on routed arguments:**

```sql
WITH routed_args AS (
  SELECT DISTINCT argument_id
  FROM public.argument_machine_observation_runs
  WHERE family IS NOT NULL
    AND created_at >= now() - INTERVAL '1 hour'
)
SELECT COUNT(*) AS direct_dispatch_leak_count
FROM public.argument_machine_observation_runs
WHERE argument_id IN (SELECT argument_id FROM routed_args)
  AND family IS NULL;  -- direct-dispatch run rows have NULL family on the run row
-- PASS: 0 (routed arguments must NEVER take both paths)
-- FAIL: > 0 → IMMEDIATE auto-rollback + escalation (the routing predicate is broken)
```

**M7 — Provider RPM at the drainer over last window:**

```sql
SELECT
  COUNT(*) AS provider_calls_last_window,
  ROUND(
    60.0 * COUNT(*) / EXTRACT(EPOCH FROM (now() - (now() - INTERVAL '5 minutes'))),
    1
  ) AS rpm_observed
FROM public.argument_machine_observation_runs
WHERE family IS NOT NULL
  AND completed_at >= now() - INTERVAL '5 minutes';
-- PASS: rpm_observed < 50 (Anthropic Tier-1 ceiling)
-- PARTIAL (Stage 3 onward): rpm_observed > 40 (within 10 RPM of ceiling)
-- FAIL: > 50 → rollback (Tier-1 will start emitting 429)
```

**M8 — Doctrine ban-list scan on routed-arg `evidence_span` content (Stage-1 specific; runs over recent routed args):**

```sql
WITH routed_args AS (
  SELECT DISTINCT argument_id
  FROM public.argument_machine_observation_runs
  WHERE family IS NOT NULL
    AND created_at >= now() - INTERVAL '24 hours'
)
SELECT
  COUNT(*) AS total_evidence_spans_scanned,
  SUM(CASE WHEN LOWER(evidence_span) ~ '\b(winner|loser|liar|dishonest)\b' THEN 1 ELSE 0 END)
    AS hits_verdict_persona,
  SUM(CASE WHEN LOWER(evidence_span) ~ '\b(true|correct|proves|refutes|defeated|conceded)\b' THEN 1 ELSE 0 END)
    AS hits_truth_or_victory,
  SUM(CASE WHEN LOWER(evidence_span) ~ '\b(weak|sloppy|lazy|careless|confused|unsound|incoherent|illogical)\b' THEN 1 ELSE 0 END)
    AS hits_quality_verdict,
  SUM(CASE WHEN LOWER(evidence_span) ~ '\b(bad faith|manipulative|propagandist|extremist|stupid|idiot)\b' THEN 1 ELSE 0 END)
    AS hits_motive_verdict
FROM public.argument_machine_observation_results r
JOIN public.argument_machine_observation_runs rn ON rn.id = r.run_id
WHERE r.argument_id IN (SELECT argument_id FROM routed_args)
  AND rn.family IS NOT NULL
  AND rn.run_mode = 'production'
  AND rn.state = 'succeeded';
-- PASS: all 4 hit counts = 0
-- FAIL: ANY hit count > 0 → IMMEDIATE rollback + doctrine escalation
```

### 5.9 Operator observability cadence (Stages 1-5)

| Stage | Routing % | Min check cadence | Detection SLA | Missed-check fallback |
|---|---|---|---|---|
| 1 | 1 | M1+M2 every **15 min**; M3-M8 every **2 hours** | M1/M2 PASS-band breach must be detected within **15 min** | If no operator-recorded check has happened in **> 30 min**, the cutover is in violation; operator must roll back. |
| 2 | 5 | M1+M2 every **15 min**; M3-M8 every **2 hours** | 15 min | > 30 min → rollback |
| 3 | 25 | M1+M2 every **10 min**; M3-M8 every **1 hour** | 10 min | > 20 min → rollback |
| 4 | 50 | **ALERTING WIRED (replaces manual cadence below);** M1-M8 fallback every **30 min** | 5 min (alert-driven) | > 10 min alert outage → rollback |
| 5 | 100 | Alerting + M1-M8 fallback every **30 min** | 5 min | > 10 min alert outage → rollback |

**Cadence enforcement.** The operator MUST record each check in a log file under `.claude-tmp/` (gitignored) with timestamp + per-query verdict. A gap longer than the missed-check fallback triggers automatic rollback to the previous stage's percentage value. This is not optional.

**Stage 1 staffing requirement.** A 15-min cadence over a 24-hour Stage 1 window implies ~96 manual checks. The operator MUST confirm staffing capacity for this cadence before flipping the master flag. If staffing is not available, Stage 1 cannot begin until alerting is wired (i.e., the alerting gate moves from Stage 4 to Stage 1 as a precondition).

### 5.10 Drainer-liveness fallback detection

The `classifier_drain_audit` table records each drain tick's outcome — but if the drainer cannot even WRITE an audit row (e.g., DB unavailable, Edge function 500 on startup, secret rotation broke auth, cron job disabled), there will be NO row to query. Two layers of fallback detection:

1. **Cron job invocation health (independent of audit table):**
   ```sql
   SELECT
     COUNT(*) AS recent_invocations,
     COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded_invocations,
     COUNT(*) FILTER (WHERE status = 'failed') AS failed_invocations,
     MAX(start_time) AS most_recent_invocation
   FROM cron.job_run_details d
   JOIN cron.job j ON j.jobid = d.jobid
   WHERE j.jobname = 'arch-001-classifier-drain-tick'
     AND d.start_time >= now() - INTERVAL '15 minutes';
   -- PASS: recent_invocations >= 13 (15 invocations expected in 15 min; allow 2 missed)
   --       AND failed_invocations = 0
   -- FAIL: recent_invocations < 13 OR failed_invocations > 0
   ```
   This query is run as part of M1 at every cadence interval.

2. **Drainer endpoint health probe (operator-authenticated):**
   The operator can hit the drainer URL directly with a valid Bearer token to confirm the function responds 200/204 even with no work. This is a manual check used when M1 + cron.job_run_details disagree (e.g., cron fires but no audit rows appear).

---

## 6. Cutover plan

**Premise.** ARCH-001 routing is the chosen production path. The legacy direct-dispatch path is the source of the H Card 3 smoke FAIL. The cutover gradually moves traffic from direct-dispatch to the queue, observing reliability + latency at each step.

**Routing knobs available today (no code change needed for any of these):**

- `CLASSIFIER_QUEUE_ROUTING_ENABLED` env (master flag; must be exactly `'true'` to route any non-smoke traffic).
- `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` env (0–100; default 0; fail-closed on negative; clamp-up on overshoot; deterministic-hash bucketing on argument id).

**Stage gates.** Each stage carries a verification window + a PASS/PARTIAL/FAIL judgment + a rollback path. PARTIAL or FAIL stops the cutover; rollback is "set the percentage env back to the previous stage's value and unset the master flag if Stage 1 fails". The master flag flip itself is reversible — no migration is required to revert.

### Stage 0 — Pre-cutover preflight (operator-territory; no code from CC)

- Operator-only env reads (anon-key-impossible; uses Supabase management API or Vault):
  - Confirm `CLASSIFIER_QUEUE_ROUTING_ENABLED` is not currently set or is `'false'`.
  - Confirm `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` is unset or `0`.
- Read-only DB checks (operator runs):
  - `cron.job` row `arch-001-classifier-drain-tick` is `active=true` with `* * * * *`.
  - `classifier_drain_audit` last 30 rows have `outcome = 'completed'`.
  - `argument_machine_observation_runs` queue depth (non-terminal rows) is 0 in the last 30 min on non-smoke debates.
- Read-only typecheck / lint / test: `npm run typecheck && npm run lint && npm run test -- --silent` exit 0.
- Confirm production family roster is A–G (`familyRegistry.ts:106` `claim_clarity productionEnabled: false`).
- Confirm rollback PR #408 / `722f17b` is on main.

**Gate to Stage 1:** all preflight items PASS.

### Stage 1 — Routing master flag ON; percentage = 1

- **Action (operator-only):** set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` and `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1` via Supabase env / Vault. Trigger Edge function redeploy (the new env propagates with the deploy).
- **What happens:** 1% of production arguments (deterministic hash bucketing) route through the ARCH-001 queue; the other 99% take the legacy direct-dispatch path. Smoke-tagged debates (`[arch-001-queue-smoke]`) route regardless of percentage.
- **Verification window:** ≥ 24 hours of production traffic (or ≥ 500 routed arguments, whichever comes first).
- **Operator-runs metrics (read-only SQL).** Use the **8 exact SQL queries** in §5.8 (M1 drainer cron freshness; M2 queue depth + oldest-pending-age; M3 per-cell completeness; M4 dead-letter rate; M5 duplicate-success absence; M6 direct-dispatch leakage absence; M7 provider RPM; M8 doctrine ban-list scan). Each query's PASS / PARTIAL / FAIL thresholds are inline in the SQL header comment.
- **Observability cadence at Stage 1.** Per §5.9: M1+M2 every **15 min**; M3-M8 every **2 hours**. Detection SLA for M1/M2 breach: **15 min**. Missed-check fallback: > 30 min without a recorded check → automatic rollback to Stage 0.
- **Drainer-liveness fallback detection.** Use §5.10 — cron job invocation health query is part of M1; endpoint probe is the last-resort manual check.
- **Operator must log each check** to `.claude-tmp/cutover-stage-1-checks.log` (gitignored) with timestamp + per-query verdict. The log is the source-of-truth for cadence compliance.
- **Stage 1 PASS gate:** all 8 M-queries meet PASS threshold across the verification window AND cadence is met without exception.
- **Stage 1 PARTIAL:** M4 dead-letter 1-3%, OR M2 oldest-pending 5-15 min p95, OR M1 drainer freshness lapses 2-5 min once. STOP; investigate; do not advance.
- **Stage 1 FAIL:** M4 > 3%, OR M1 lapses > 5 min, OR M6 > 0, OR M5 > 0, OR M8 any hit > 0, OR M7 > 50 RPM. STOP; revert; investigate before re-trying.
- **Rollback:** unset `CLASSIFIER_QUEUE_ROUTING_ENABLED` (or set `'false'`); redeploy; routing returns to default-disabled. Operator must confirm rollback within **< 5 min** of detection. Detection-to-rollback total budget: **< 20 min** (15 min cadence + 5 min rollback execution).

### Stage 2 — Percentage = 5

- **Action:** set `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=5` (master flag stays `'true'`). Redeploy.
- **Verification window:** ≥ 24 hours OR ≥ 2,500 routed arguments.
- **Metrics:** same as Stage 1.
- **PASS / PARTIAL / FAIL:** same thresholds as Stage 1.
- **Rollback:** set percentage back to 1.

### Stage 3 — Percentage = 25

- **Action:** percentage = 25.
- **Verification window:** ≥ 24 hours OR ≥ 12,500 routed arguments.
- **Metrics:** same as Stage 1.
- **Additional Stage 3 gate:** Provider RPM at peak hour must be < 40 (more headroom below the 50 RPM ceiling because percentage is higher).
- **Rollback:** percentage back to 5.

### Stage 4 — Percentage = 50; alerting gate

- **Action:** percentage = 50.
- **Pre-Stage-4 requirement:** alerting wired for the three liveness signals (queue depth oldest-pending-age, dead-letter rate, drainer last-success-tick freshness). This is the gap identified in §5.3. **This is operator-territory** — Datadog / Grafana / Resend / Discord webhook etc.; not a CC-written runtime. The cutover does NOT proceed to Stage 4 without alerting in place.
- **Verification window:** ≥ 72 hours OR ≥ 25,000 routed arguments.
- **Metrics:** same as Stage 1 PLUS the alerting end-to-end test (operator-triggered known-stale condition fires an alert within 5 min).
- **Rollback:** percentage back to 25.

### Stage 5 — Percentage = 100; legacy direct-dispatch retirement (deferred decision)

- **Action:** percentage = 100. All non-smoke production traffic routes through ARCH-001. Legacy direct-dispatch path is dormant.
- **Verification window:** ≥ 1 week.
- **Metrics:** same as Stage 1.
- **Decision point:** after Stage 5 PASS, the legacy `dispatchAutoTriggerForArgument` direct-dispatch code path can be deleted in a separate cleanup card (not this one). Until that cleanup card lands, leave the direct-dispatch code in place as the rollback fallback (revert percentage to 0 to send all traffic back to direct-dispatch).
- **Rollback:** percentage back to 50.

### Stage 6 — Re-attempt H Card 3 production smoke (separate card)

- **Pre-Stage-6 gate:** Stage 5 PASS for ≥ 1 week.
- **Action:** in a SEPARATE card (e.g. `MCP-021C-EDGE-FAMILY-H-ENABLE-RETRY`), re-run the H Card 3 production-enable smoke under the ARCH-001 path. The 1-char `familyRegistry.ts:106` flip can be re-applied as a `git revert 722f17b` on a feature branch (the rollback PR's commit is the only change to revert).
- **Critical behavior change vs first H smoke:** with percentage = 100 and master flag on, the H Card 3 smoke synthetic harness will exercise the queue path (because all non-smoke-tagged debates route at 100%). The H smoke tag (`[mcp-021c-family-h-enable-smoke 2026-05-31]`) is NOT the ARCH-001 routing tag — but at percentage = 100 it doesn't need to be; non-smoke-tagged debates route by percentage. To explicitly route, the H smoke synthetic harness could also include the `[arch-001-queue-smoke]` prefix (operator decision; not material if percentage is 100).
- **NOT this card.** Stage 6 is the re-attempt and is filed as its own follow-up.

### Cutover-stage staging table

| Stage | Routing percentage | Verification window | Primary metrics | Rollback target |
|---|---|---|---|---|
| 0 | 0 (default-off) | preflight | preflight items | n/a |
| 1 | 1 | ≥ 24h / ≥ 500 routed | dead-letter < 1%, queue oldest < 5 min p95, drainer freshness < 2 min, direct-dispatch leak = 0, dup-success = 0, doctrine = 0, RPM < 50 | Stage 0 (unset master flag) |
| 2 | 5 | ≥ 24h / ≥ 2,500 routed | Stage 1 metrics | Stage 1 |
| 3 | 25 | ≥ 24h / ≥ 12,500 routed | Stage 1 metrics + RPM < 40 | Stage 2 |
| 4 | 50 | ≥ 72h / ≥ 25,000 routed + alerting wired | Stage 3 metrics + alert E2E test | Stage 3 |
| 5 | 100 | ≥ 1 week | Stage 4 metrics | Stage 4 |
| 6 | (H retry; separate card) | n/a here | n/a here | n/a here |

---

## 7. Open questions

1. **Anthropic Tier-2 upgrade.** Tier-1 50 RPM is the ceiling that bounds drainer concurrency `C` at the high end of the cutover. If sustained production load at Stage 4 or 5 approaches the Tier-1 ceiling, the operator may need to upgrade to Tier-2 (1,000 RPM / 450k ITPM / 90k OTPM) BEFORE Stage 5. This is a billing decision; not a code change.
2. **Drainer `C` value at percentage = 100.** ARCH-001 Card 3 shipped `C = 3`. At percentage = 100 with production-level argument throughput, `C = 3` may produce queue backlog under sustained load. The Stage 5 verification window should measure queue depth oldest-pending-age under real production load and decide whether `C` needs to be raised (and to what — bounded above by Anthropic Tier-1 50 RPM / 7-family fan-out = ~7 concurrent provider calls max safely).
3. **Alerting substrate decision.** §5.3 + Stage 4 require alerting infrastructure that the project doesn't currently document. Operator picks the substrate (Datadog, Grafana, Resend email, Discord webhook, GitHub Issues bot, etc.). This is operator-territory; CC does not pick the substrate.
4. **Cleanup card for legacy direct-dispatch.** Once Stage 5 has held for ≥ 1 week and operator decides the rollback fallback is no longer needed, a separate cleanup card deletes `dispatchAutoTriggerForArgument` and related direct-dispatch test fixtures. Not in scope here.
5. **Detector-policy deferral.** ARCH-001 §A.1 mentions a future `ARCH-CIVIL-DISCOURSE-DETECTOR-POLICY` card for detector tiering (run cheap subset on every move; full A–G only on triggered moves). The H Card 3 FAIL does not change that deferral — detector tiering is still filed AFTER queue throughput is measured. Not in scope here.

---

## 8. Stage 2B gates before implementation

This card is design-only. NO cutover step is taken by this card. The Stage 2B gates that must be cleared before the *first* cutover action (Stage 1 `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`):

1. **Operator authorization on the cutover plan.** This design must be approved by the operator. Approval is the squash-merge of this PR.
2. **Stage 0 preflight runs clean.** All 5 preflight items in §6 Stage 0 PASS.
3. **Stage 1 metric thresholds are operator-binding.** The thresholds in §6 Stage 1 are recommendations; the operator may adjust before Stage 1 begins.
4. **No competing routing changes in flight.** The cutover assumes ARCH-001 routing module is byte-equal to ship state; any in-flight changes to `classifierQueueRouting.ts` or the drainer must merge first.
5. **Anthropic tier confirmation.** Operator confirms the current Anthropic tier (likely Tier-1 50 RPM) and whether a tier upgrade is needed before any later stage's percentage step.
6. **Rollback rehearsal (full).** Before Stage 1 begins, the operator MUST rehearse the rollback end-to-end on a smoke-only debate:
   - (a) Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=100` with a `[arch-001-queue-smoke]`-tagged synthetic debate (smoke-tag override path).
   - (b) Verify one routed argument completes via the drainer (M1/M2/M3 PASS).
   - (c) Simulate drainer failure by temporarily killing the drainer cron (DISABLE the cron job row via `UPDATE cron.job SET active = false WHERE jobname = 'arch-001-classifier-drain-tick'` — operator-territory; reversible).
   - (d) Confirm M1 query surfaces the failure within **< 5 min** (drainer cron freshness > 300 seconds threshold).
   - (e) Execute rollback: unset `CLASSIFIER_QUEUE_ROUTING_ENABLED` and re-enable cron (`UPDATE cron.job SET active = true …`).
   - (f) Confirm: any in-flight smoke arguments either complete (because cron is back up) or fall to dead-letter; no production traffic affected.
   - Total rehearsal time: ≤ 30 min. Pass criterion: M1 surfaces the failure within 5 min AND rollback returns the system to default-off within 5 min of detection.
7. **Operator staffing commitment.** Stage 1 cadence is 15-min checks for ≥ 24h = ~96 manual checks. Operator confirms staffing capacity for this cadence BEFORE flipping the master flag. If staffing is unavailable, Stage 1 cannot begin until the alerting gate (currently Stage 4) is moved up to Stage 1 as a precondition.

---

## 9. Family H state under this design

- H `productionEnabled: false` (unchanged).
- H admin_validation path unchanged.
- H L5 doctrine enforcement unchanged.
- H Card 1 + Card 2 + Card 3 FAIL audit + rollback all unchanged.
- H production-enable retry is **NOT** in this card's scope. It is a Stage 6 follow-up that depends on Stage 5 PASS.
- Family I remains untouched. The Adv 3 stale-precondition note in `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE-intent.md` is deferred to a separate followup as recorded in PR #408.

---

## 10. Verification + boundary compliance for THIS card

- Files touched by this card:
  - NEW `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` (this file)
  - Optional NEW `docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` (reviewer's verdict)
  - Optional EDIT `docs/core/current-status.md` (status entry)
- Files NOT touched by this card (boundary):
  - No source under `src/`, `app/`, `mcp-server/`, `supabase/functions/`, `scripts/`.
  - No test under `__tests__/`, `mcp-server/tests/`.
  - No migration under `supabase/migrations/`.
  - No env / Vault / runtime flag change.
  - No `package.json` / `package-lock.json` change.
  - No `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md` (SUPERSEDED file preserved).
  - No `docs/designs/ARCH-001-*.md` (existing ARCH-001 design preserved).
  - No `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE-intent.md` (Adv 3 finding deferred).
- typecheck / lint / test: NOT RUN (no source change to verify; running tests would be pointless for a docs-only change). The repo state at HEAD is the verified state from the rollback PR (18,762 / 594 suites).
- Provider-spend invocations by Claude this turn: **zero.**

---

## 11. Recommended next prompt

After this design PR merges + operator confirms Stage 2B gates §8 are cleared:

**Next prompt name:** `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1` (or equivalent) — operator-territory action to flip the master flag and percentage on for Stage 1, with CC running the read-only metric checks during the verification window.

Following Stage 5 PASS:

**Subsequent prompt name:** `MCP-021C-EDGE-FAMILY-H-ENABLE-RETRY` — the H Card 3 production-enable re-attempt under the now-cutover ARCH-001 path. This is a separate roadmap-designer → roadmap-implementer → roadmap-reviewer → smoke chain.

---

## Appendix A — Required reading manifest (Phase 0)

This design was authored after reading the following files at HEAD `722f17b`:

- `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` — H Card 3 FAIL audit (the proximate input).
- `docs/reviews/REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE.md` — Rollback PR reviewer APPROVE.
- `docs/core/current-status.md` line 2 — Rollback narrative HTML comment (post-rollback state).
- `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md` lines 1–25 — SUPERSEDED Option A header + harvest-forward concepts.
- `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` lines 1–150 — ARCH-001 parent design (Phase 0 topology + Goal + A.1 scope + A.2 control point + A.3 schema + invariants).
- `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` lines 1–120 — ARCH-001 Card 3 production smoke PASS verdict, preflight, canary, burst evidence.
- `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-PHASE4-SMOKE-2026-05-30.md` lines 1–40 — cap=5 PARTIAL evidence (the closest analog to the H FAIL `{isError}` cluster).
- `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-CAP2-SMOKE-2026-05-30.md` lines 1–40 — cap=2 FAIL evidence (the inverse-direction failure that proved the per-isolate cap is the wrong control point).
- `mcp-server/lib/anthropicCall.ts` — provider call wrapper (timeout + failure-reason taxonomy + per-isolate gate integration).
- `mcp-server/lib/providerConcurrency.ts` — per-isolate provider concurrency cap (the legacy control point; not global).
- `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts` — ARCH-001 routing predicate + percentage knob.
- `supabase/functions/submit-argument/index.ts:33-34,804-816` — submit-path routing branch (verified routing knobs are wired).
- `supabase/functions/classifier-drainer/index.ts` — drainer Edge function (existence + active state).
- `supabase/migrations/20260528000021_arch_001_classifier_queue_substrate.sql` — substrate (existence; not byte-by-byte for this docs-only card).
- `supabase/migrations/20260528000022_arch_001_card2a_atomic_finalizer.sql` — atomic finalizer (existence).
- `supabase/migrations/20260528000023_arch_001_card2_enqueue_kick.sql` — statement-level kick (existence).

---

## Appendix B — Glossary

- **Direct-dispatch path.** The legacy `submit-argument` → `dispatchAutoTriggerForArgument` flow that runs N MCP calls under `EdgeRuntime.waitUntil` with bounded-parallel limit=2 per submit. This is the path that failed in the H Card 3 production-enable smoke.
- **ARCH-001 queue path.** The chosen replacement. `submit-argument` enqueues N rows; the drainer Edge function processes them at bounded global concurrency `C`. Smoke-passed at PR #383 / `d42d6da` / 2026-05-31.
- **Per-isolate cap.** `MCP_SERVER_MAX_PROVIDER_CONCURRENCY` on the MCP server. PROVEN insufficient as a global-load control point by cap=5 PARTIAL + cap=2 FAIL audits.
- **Master routing flag.** `CLASSIFIER_QUEUE_ROUTING_ENABLED`. Must be exactly `'true'` for ANY ARCH-001 routing to happen.
- **Routing percentage knob.** `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`. Deterministic-hash bucketing on argument id; 0–100; default 0; fail-closed on negative; clamp-up on overshoot.
- **Smoke-tag override.** Debate title prefix `[arch-001-queue-smoke]` routes the argument independent of percentage (still requires master flag on). Used by ARCH-001 Card 2 / Card 3 smokes.
- **HALT 15.** The Card 3 smoke FAIL → chain HALT (operator-defined; recorded in PR #407 FAIL audit and PR #408 rollback).
- **Cutover stage.** A bounded routing-percentage step (Stage 1 = 1%, Stage 2 = 5%, Stage 3 = 25%, Stage 4 = 50% with alerting, Stage 5 = 100%) plus its verification window + PASS/PARTIAL/FAIL judgment + rollback target.
