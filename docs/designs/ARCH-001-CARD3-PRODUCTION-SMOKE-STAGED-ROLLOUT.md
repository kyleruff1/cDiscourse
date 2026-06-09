# ARCH-001 Card 3 — production smoke + staged queue-routing rollout (burst fix)

**Status:** Design draft — DESIGN ONLY. No production code, no migration file, no flag set, no deploy, no arming, no `productionEnabled` flip, no H/I/J movement. This card writes ONE markdown design doc and commits it on `feat/arch-001-card3-design` (no push, no PR).
**Epic:** Epic 12 / MCP semantic-referee track (Civil Discourse classifier infrastructure)
**Release:** ARCH-001 (Postgres async classifier queue) — the final card of the 4-card chain (Card 1 substrate / Card 2 drainer+enqueue / Card 2A atomic finalizer — all shipped + applied; Card 3 = this card).
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/552 ("production smoke + staged queue-routing rollout (burst fix)")
**Parent design:** `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` (§A.2 cron tick + enqueue-kick, §A.4 single-flight, §A.5 bounded batch, §A.7 C-calibration, §A.11 staged cutover, §A.12 smoke, HALT table H8/H9/H10, "Open questions" 1–3).
**Canonical gate reference:** `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (PASS-LOAD = 0 terminal dead-letters at N=56; PASS-LOAD-CONFIRM; the E#7 Family-H precondition; §F ratified bar-integrity).
**Motivating RCA:** `docs/rca/OPS-MCP-AUTOTRIGGER-BURST-PROVIDER-NETWORK-ERROR-RCA-2026-06-08.md`.

---

## 0. What is already shipped (verified read-only at HEAD) — Card 3's true remaining surface

Card 3 is **not** greenfield. The queue is ~75% built and the drainer is deployed. Verified read-only:

| # | Fact | Evidence (file:line) |
|---|---|---|
| S1 | **Substrate applied.** Queue lifecycle columns (`state`, `family`, `available_at`, `lease_*`, `attempt_count`, `failure_sub_reason`, `dead_letter_reason`), the `classifier_drain_lock` + `classifier_drain_audit` tables, the partial unique indexes #4/#5 + claim/stale indexes #6/#7, and the claim/lease/release/reclaim/enqueue SQL functions exist. `pg_cron` + `pg_net` are installed (`CREATE EXTENSION`). | `supabase/migrations/20260528000021_arch_001_classifier_queue_substrate.sql:135-136,148-194,211-238,256-287,310-478` |
| S2 | **Atomic finalizer applied** (`finalize_classifier_job`) — one-transaction result-INSERT + run-row terminal flip; `failure_detail` 9th arg added later. | `supabase/migrations/20260528000022_arch_001_card2a_atomic_finalizer.sql:139-272`; `supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql` |
| S3 | **Enqueue-kick applied.** Statement-level `AFTER INSERT` trigger `arch_001_kick_classifier_drainer_trg` fires ONE `net.http_post` per INSERT statement, advisory-lock-debounced, reads the drainer URL + secret from Vault, skips silently if Vault unseeded. | `supabase/migrations/20260528000023_arch_001_card2_enqueue_kick.sql:148-239` |
| S4 | **Drainer deployed + registered** with `verify_jwt = false` + shared-secret header validation before any work; single-flight + reclaim-first + bounded loop + atomic finalize. | `supabase/functions/classifier-drainer/index.ts:81-146`; `supabase/config.toml:455-470` |
| S5 | **Routing predicate wired into submit** with the Card-3 percentage knob ALREADY present. `shouldRouteToQueue(arg, debate, enabled, percentage=0)` is default-disabled (master flag `=== 'true'`), smoke-tag override at percentage=0, `stableHashArgumentId(id)%100 < pct` for the staged ramp. The submit fork reads both env names. | `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts:160-184`; `supabase/functions/submit-argument/index.ts:811-841` |
| S6 | **Retry calibration already landed** under a "Card 3" label: `DRAINER_MAX_ATTEMPTS = 4` (raised 3→4 after the Card-2 smoke's 2.9% `provider_server_error` dead-letter signal) and the `provider_server_error`-specific backoff `[60,180,360]s`; default backoff stays `[30,120]s`. | `supabase/functions/_shared/booleanObservations/classifierDrainerRetryPolicy.ts:25-32,53,65,79` |
| S7 | **Smoke-tag tooling exists.** The adversarial corpus runner can prefix `[arch-001-queue-smoke]`; the literal is the routing contract. | `docs/designs/CORPUS-QUEUE-SMOKE-TAG-001.md`; `classifierQueueRouting.ts:51` |
| S8 | **NO cron.schedule has been executed.** The two `cron.schedule` grep hits in migrations 21/23 are **commented runbook examples only**, not live jobs. Routing is **unarmed** (all `#479` runs were direct-dispatch `state='succeeded'`, 0 queued). | `supabase/migrations/20260528000023_...:289-304` (comment block); RCA §6 "Confirmed current state: routing is unarmed" |

**Therefore Card 3's remaining deliverables are exactly four things** (RCA §6 "Not yet done"):
1. **Schedule the `pg_cron` drain safety tick** + seed the Vault cron→Edge credential (Channel-1 liveness; today only the enqueue-kick Channel-2 exists, and it too needs the Vault secret seeded).
2. **The staged-arm protocol** (documented, NOT executed): `ENABLED=true` + `PERCENTAGE=0` (smoke-tag only) → synthetic smoke → percentage ramp → organic — operator-gated at every step.
3. **The production smoke plan**: canary → full A–G N=56 burst, PASS = 0 terminal dead-letters + structural gates.
4. **The burst regression test / observability assertion** (the chip's ask): a deterministic test proving the queue path bounds global provider concurrency to C under a synthetic burst, with NO provider call.

Plus surfacing the **3 operator confirmations** as decision points, and stating the **E#7 H-gate** relationship.

---

## Goal (one paragraph)

The production boolean-classifier auto-trigger loses ~96% of classifications under a posting burst: each submit fans out A–G to the per-isolate provider-concurrency cap (=5), and ~38 concurrent submits push cross-argument fan-out to ~76 unbounded MCP→Anthropic calls; the queue-wait behind 5 slots exceeds the Edge fetch `AbortSignal` deadline, aborting to `mcp_network_error` (RCA §2–§3). ARCH-001 is the durable fix — submit only **enqueues** (a fast local INSERT, no provider call) and returns 201, and a single-flight, bounded-batch drainer processes jobs at a known **global** rate C ≤ 5 with its own ≥30s timeout. Cards 1/2/2A built and deployed the substrate, finalizer, drainer, enqueue-kick, and the default-disabled routing predicate (§0). **Card 3 turns the deployed-but-dormant queue on, safely**: it schedules the Channel-1 `pg_cron` safety tick (1-minute floor per I2), wires the Vault credential the tick + kick read, documents (does NOT execute) the operator-gated staged-arm protocol, specifies the production smoke whose PASS bar is **0 terminal dead-letters at the canonical N=56 A–G burst plus the structural gates** (never lowered — `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` §F, ratified), and adds a deterministic burst regression test that proves the queue path bounds global provider concurrency to C where direct dispatch saturates. The design is governed by `cdiscourse-doctrine`: classifiers never gate acceptance (the rules engine stays the sole gate; submit returns 201 before any routing decision — `submit-argument/index.ts` returns before the dispatch fork), no truth labels, claim order is arrival-FIFO (no heat/popularity input), no secret in any row/log (Vault credential read at runtime, never in SQL/git), and H/I/J stay `productionEnabled:false`.

---

## Data model

**No new data model.** Card 3 adds zero columns, zero tables, zero indexes. Every queue structure already exists (§0 S1/S2/S3). Card 3 adds, in SQL, exactly **one scheduled job** (a `cron.schedule` row in the `cron.job` catalog) and, operationally, **two Vault secrets** (rows in `vault.secrets` / readable via `vault.decrypted_secrets`). Neither is a schema change to any application table.

The values Card 3 commits to (all already constants in the deployed code — restated so the smoke + regression test assert against them, not re-decide them):

| Parameter | Value | Source of truth (file:line) |
|---|---|---|
| Global provider concurrency **C** | **3** (≤ MCP cap 5) | `classifierDrainerCore.ts:70` `DRAINER_PROVIDER_CONCURRENCY = 3` |
| Drain wall-clock budget **T** | **90_000 ms** | `classifierDrainerCore.ts:73` |
| Claim batch size **N** | **20** | `classifierDrainerCore.ts:76` |
| Per-invocation processed cap | **60** | `classifierDrainerCore.ts:83` |
| Per-job lease | **120 s** | `classifierDrainerCore.ts:86` |
| Drain lease TTL **L** | **130 s** (≥ T+30+10) | `classifierDrainerCore.ts:94` |
| Live-retry cap `DRAINER_MAX_ATTEMPTS` | **4** | `classifierDrainerRetryPolicy.ts:53` |
| Reclaim (lease-expiry) cap | **3** (independent backstop) | `20260528000021_...:409` |
| Default retry backoff | `[30,120]s` | `classifierDrainerRetryPolicy.ts:65` |
| `provider_server_error` backoff | `[60,180,360]s` | `classifierDrainerRetryPolicy.ts:79` |
| Cron tick interval | **`'* * * * *'`** (60s; the `'60 seconds'` interval form is rejected `22023`) | `20260528000023_...:283-287` |
| Smoke tag literal | `[arch-001-queue-smoke]` | `classifierQueueRouting.ts:51` |
| Master arm env | `CLASSIFIER_QUEUE_ROUTING_ENABLED` (`=== 'true'`) | `classifierQueueRouting.ts:61` |
| Staged ramp env | `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` (fail-closed to 0) | `classifierQueueRouting.ts:72,89-98` |

> **Note the intentional cap asymmetry (S6):** the live-retry path dead-letters at attempt **4**; the lease-expiry reclaimer dead-letters at attempt **3** (`reclaim_stale_leases`, `20260528000021_...:409`). This is by design (`classifierDrainerRetryPolicy.ts:25-32`) — the reclaim path is the slower stuck-row backstop. The smoke's failure-class monitoring (§A.10 query B) must read both `state='dead_letter'` rows regardless of which cap produced them; the regression-test's dead-letter assertions must not assume a single cap. Surfaced as a Risk (§Risks R5), not changed here.

---

## 1. SQL / migration plan (PROPOSED — NOT applied; the implementation card writes the file)

A new migration `supabase/migrations/<next-seq>_arch_001_card3_cron_drain_tick.sql` (the latest applied ordinal is `20260606000001`, so the next is e.g. `20260608000001`). It does **two** things and nothing else: (a) `cron.schedule` the periodic drain safety tick, and (b) document the Vault seed call *shape* (never a real value).

### (a) The cron drain safety tick (Channel-1 liveness, design §A.2)

`pg_cron` + `pg_net` are **already installed by Card 1** (`20260528000021_...:135-136`); Card 3 adds **only** `cron.schedule` — it does NOT re-`CREATE EXTENSION`. The scheduled command reads the drainer URL + secret from Vault **at each tick's runtime** and `net.http_post`s the drainer, byte-aligned with the commented example Card 2 left at `20260528000023_...:289-304`:

```sql
-- PROPOSED (design only — not in this card). The cron command reads Vault at
-- RUNTIME; no secret literal in this SQL. A null/empty URL (Vault not yet
-- seeded) is guarded so a pre-seed tick is a SILENT no-op, never a noisy
-- failed net.http_post (mirrors the enqueue-kick's silent-skip posture,
-- 20260528000023_...:195-197).
SELECT cron.schedule(
  'arch-001-classifier-drain-tick',
  '* * * * *',                              -- 60s floor (I2 PARTIAL; sub-minute NOT relied on)
  $CRON$
    DO $tick$
    DECLARE v_url text; v_secret text;
    BEGIN
      SELECT decrypted_secret INTO v_url
        FROM vault.decrypted_secrets WHERE name = 'arch_001_classifier_drainer_url' LIMIT 1;
      SELECT decrypted_secret INTO v_secret
        FROM vault.decrypted_secrets WHERE name = 'arch_001_classifier_drainer_secret' LIMIT 1;
      IF v_url IS NULL OR v_secret IS NULL OR length(v_url) = 0 OR length(v_secret) = 0 THEN
        RETURN;                              -- Vault not seeded → no-op; the next tick retries.
      END IF;
      PERFORM net.http_post(
        url     := v_url,
        body    := jsonb_build_object('source', 'cron_tick'),
        headers := jsonb_build_object('Content-Type','application/json',
                                      'Authorization','Bearer ' || v_secret));
    END
    $tick$;
  $CRON$
);
```

Design choices and why:
- **Null-URL guard (the one improvement over Card 2's bare example).** Card 2's commented example (`20260528000023_...:293-302`) calls `net.http_post` with an inline sub-SELECT that would POST a NULL url if Vault were unseeded — generating a noisy `cron.job_run_details` failure every minute during the seed window. Wrapping the tick body in a `DO` block with the same silent-skip guard the enqueue-kick uses (`20260528000023_...:195-197`) makes a pre-seed tick a clean no-op. This is the OPS-001 ordering safety: the migration can be applied before Vault is seeded without generating error noise; the tick simply starts draining once the operator seeds Vault + the drainer is live.
- **Interval form.** `'* * * * *'` (standard 5-field cron = once per minute). The `'60 seconds'` interval form is **rejected** by pg_cron with `22023 invalid_schedule` (only `[1-59] seconds` is valid); the standard cron form gives the same 60s cadence and is the locked choice (`20260528000023_...:283-287`). **Do NOT** schedule sub-minute (I2 PARTIAL — sub-minute reliability is unconfirmed; the design does not depend on it because the enqueue-kick is the sub-second latency path and the tick is only the safety net).
- **One job only (H8 worker headroom).** `max_worker_processes = 6` is tight (I8). The footprint stays at exactly ONE cron job. pg_cron's launcher + this one job sit well within 6; the design must NOT add a second cron job (a separate reclaim cron is unnecessary — `reclaim_stale_leases` runs *inside* every drain, `classifierDrainerCore.ts:186-193`). Surfaced as decision point DP-3 (§5).
- **Rollback.** `SELECT cron.unschedule('arch-001-classifier-drain-tick');` pauses the tick (`20260528000023_...:306-307`). The enqueue-kick continues to drive the drainer for any still-routed args; combined with the master-flag disarm (§7) the queue goes fully dormant.

### (b) The Vault secret seed — call SHAPE only (NEVER a real value)

The Vault credential the tick **and** the enqueue-kick read is seeded by the **operator** via `vault.create_secret`, run in the Supabase SQL editor / psql — **never committed to git, never in a migration, never in this doc** (cdiscourse-doctrine §6; the migration files already carry this as runbook notes, `20260528000023_...:269-276`). The two secret **names** (not values) the deployed code looks up are fixed:

```sql
-- OPERATOR-RUN (NOT in any migration, NOT in this card). Shape only — the
-- '<...>' placeholders are NEVER real values in any committed artifact.
SELECT vault.create_secret('<https-drainer-url>',
       'arch_001_classifier_drainer_url',    'ARCH-001 classifier drainer Edge Function URL');
SELECT vault.create_secret('<shared-secret>',
       'arch_001_classifier_drainer_secret', 'ARCH-001 classifier drainer shared secret (Bearer)');
```

- The `<shared-secret>` value **must equal** the `CLASSIFIER_DRAIN_SHARED_SECRET` function secret the drainer validates on its `Authorization` header (`classifier-drainer/index.ts:96`, `config.toml:462-465`). Same string, two homes (Vault for the caller; function env for the validator). Mismatch → every tick/kick gets a 401 and the queue silently never drains → caught by the §A.10 "No successful drain" alert.
- Vault is **installed** (verified, parent design I5). `vault.decrypted_secrets` is the read view; `vault.create_secret` is the write call.

### OPS-001 four-class posture for the proposed migration

| Class | Disposition |
|---|---|
| A — extensions | **None** (pg_cron/pg_net already installed by Card 1; this migration does NOT `CREATE EXTENSION`). |
| B — columns | **None** (no column change). |
| C — constraints/tables | **None** (no new table/CHECK). |
| D — indexes | **None**. |
| E — functions/triggers/cron | The single `cron.schedule(...)` call; created AFTER all objects it references (the drainer URL/secret are runtime Vault reads, not compile-time deps). No `COMMENT ON storage.*` (PR-003 SQLSTATE 42501 boundary). |
| No client write path | ZERO `CREATE POLICY` (mechanical check `grep -E "CREATE POLICY" <file>` returns zero). |

### Alternative considered (and why the migration is preferred)

Card 2 deferred the cron tick to a **manual operator runbook step** (`20260528000023_...:258-312`, "OPERATOR-APPLIED (NOT APPLIED BY THIS MIGRATION)"). The issue directs Card 3 to ship it as a **migration**. The migration is preferred because it is version-controlled, reviewable under OPS-001, idempotent on re-apply (a re-run of `cron.schedule` with the same job name updates in place), and rollback-documented (`cron.unschedule`). The null-URL guard removes the only objection (pre-seed noise) that motivated deferring it. **This is a design reconciliation, not a conflict** — see §Conflicts.

---

## 2. The staged-arm protocol (DOCUMENTED — NOT executed; operator-gated at every step)

Arming routing is a **separate operator GATE** governed by `docs/core/pipeline-governance-contract.md` (the smoke-routing master-flag procedure). **This card does NOT arm anything, set any env, or authorize any ramp.** It documents the protocol the operator follows; each transition below is an independent operator decision + (for ≥1% organic) a separate operator card (`OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` §C: "the percentage sequence is an allowed operator order, not an automatic ladder").

Predicate semantics (the contract the protocol relies on, `classifierQueueRouting.ts:160-184`):
- `enabled !== true` → **false for everything** (the ship state). Master flag gates BOTH paths.
- `enabled === true` + `title.startsWith('[arch-001-queue-smoke]')` → **true** (smoke-tag override; independent of percentage — routes even at `PERCENTAGE=0`).
- `enabled === true` + non-smoke title + `stableHashArgumentId(id) % 100 < pct` → **true** (staged ramp; `pct=0` → no organic routing).
- **`PERCENTAGE>0` with the master flag off is INERT** (`submit-argument/index.ts:811-816` reads both; the predicate returns false on `enabled !== true` before percentage is consulted).

| Step | Operator action (env on `submit-argument`) | Effect | Gate to proceed |
|---|---|---|---|
| **0. Pre-arm** | (none) | Drainer live, cron scheduled, Vault seeded. Routing OFF. | Drainer deploy confirmed; cron `SELECT * FROM cron.job` shows the tick; Vault both secrets present. |
| **1. Smoke arm** | `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` | **Smoke-tag rooms only** route to the queue; **0% organic** (every non-smoke submit stays on direct dispatch, byte-unchanged). This is the `PERCENTAGE=0 ENABLED=true` "smoke-tag-override arm" — NOT any percentage advance (gate doc §E item 17, ratified). | Run the §3 production smoke (canary → N=56). |
| **2. PASS-LOAD** | (unchanged) | — | §3 PASS-LOAD achieved (0 terminal dead-letters at N=56 + structural gates). |
| **3. PASS-LOAD-CONFIRM** | (unchanged) | — | A **second consecutive independent** N=56 drill meeting **all 15** gates (gate doc §A row "PASS-LOAD-CONFIRM"). |
| **4. Organic ramp 1%** | `PERCENTAGE=1` (separate operator card) | A hash-bucketed 1% of **organic** (non-smoke) args route. | Requires an **organic Stage-1 pass** — real non-smoke routed cells appeared AND were handled within budget over the window (gate doc §A, §C). A `PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME` close (organic=0) is **strictly weaker** and does NOT advance. |
| **5. 5 → 25 → 50 → 100** | `PERCENTAGE=5,25,50,100` (one operator card per step) | Each step widens the bucket. | Each step independently needs real organic evidence at the prior percentage + a separate operator authorization card (gate doc §C). No audit/doc/timer auto-advances. |
| **Disarm (any time)** | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` | **Instant revert to direct dispatch** for all new submits (the proven path, still in the tree at `submit-argument/index.ts:836-841`). In-flight queue jobs drain to terminal; optionally `cron.unschedule` to pause the tick. No data migration to roll back (the queue columns/rows are additive + inert when off). | — |

**This card stops at writing the protocol.** No env is set; no `--linked` deploy is run; no `gh secret set` is issued. The "isolated-tolerated / `distinct_dead_letter_families=1`" rule governs the **disarm (rollback)** decision for an already-armed organic window ONLY — it **never** admits a nonzero-dead-letter run to PASS-LOAD (gate doc §F item 1, ratified; §Risks R6).

---

## 3. The production smoke plan (synthetic-only; leak-safe; PASS bar NOT lowered)

Run by the operator after Step-1 smoke arm. Synthetic smoke-tagged rooms only; **no organic user text; no secrets in logs; H/I/J never run.** The verification **polls to actual settle — no fixed sleep** (parent §A.12; test-discipline "exit code is the contract").

### 3.1 Canary (routing-path verification gate — NOT load evidence)

ONE synthetic `[arch-001-queue-smoke]…`-titled submit → expect **7 A–G rows** in `argument_machine_observation_runs` with `family IS NOT NULL`, `run_mode='production'`, **0 H/I/J rows**, all reaching `state='succeeded'`. **HALT on any `family=NULL` queue row** (gate doc §E item 18: the canary is a routing-path gate only; PASS = 7 A–G rows, 0 H/I/J). Record time-to-first-job-start (kick path; SLO ≤ 2s) and time-to-complete (SLO ≤ ~30s at C=3). A clean canary is a **precondition** for the burst; an N=56 burst without a preceding passing canary yields no valid gate evidence and is discarded (gate doc §E item 18).

### 3.2 Full A–G N=56 burst (the canonical PASS-LOAD)

**N=56 = 8 synthetic args × 7 families** (the canonical burst size — `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` §A "Synthetic PASS-LOAD"; the issue mandates "N=56 (8 args × 7 families)"). The 8 args are posted in a tight window into smoke-tagged rooms so the queue must drain across multiple drainer invocations.

**Settle predicate** (poll snapshot A on a loop every ~5s, bounded by a generous max wall e.g. 10 min, until ALL true — parent §A.12):
```
pending = 0  AND  due retry_scheduled (available_at <= now()) = 0  AND  leased = 0
AND  stale leases (leased AND lease_expires_at < now()) = 0
AND  (drain lease not held OR classifier_drain_audit.last_drain_completed > final-submit-ts)
```
Only THEN read run-completeness.

**PASS-LOAD = ALL of (no bar lowered):**
- **0 terminal dead-letters** across all 56 cells (`state='dead_letter'` count = 0). **No nonzero dead-letter budget** is introduced — `1/56 = 1.79% > 1%`, so "0 preferred" and "≤1%" reconcile to the same bar: **0** (gate doc §A threshold note; §F item 1, ratified).
- **Structural gates green:** dup = 0 (no two `succeeded` rows for one `(argument_id, family, run_mode, schema_version)` cell — index #4 holds), overlap = 0, `family=NULL` queue rows = 0, **0 H/I/J rows**, every expected cell reaches `succeeded` OR an explicit terminal with the correct typed reason, monitor healthy (§A.10 snapshot A clean: oldest-pending-age ≤ 5 min during burst, no wedged single-flight).
- **Submit nonblocking** throughout (submit latency band unaffected, ~1.3–3.3s; submit returns 201 before the dispatch fork).
- **Leak-safe:** re-scan every positive row's `evidence_span` + every `failure_*` field for banned verdict tokens (zero hits — as prior smokes did); no `Bearer` / `sk-ant` / `sb_secret` / JWT shape in any drain-audit row or log line.
- **C recorded:** observed provider throughput (RPM/TPM vs the Tier-1 50 RPM ceiling), 429/capacity counts. **C tuned down to reach completeness is PASS-after-tune** (parent §A.7), but C is already locked at 3 (§0 S6 calibration shipped), so no tuning is expected.

**PASS-LOAD-CONFIRM = a second consecutive independent N=56 drill** meeting **all 15** gates (gate doc §A row "PASS-LOAD-CONFIRM"; §E item 3 — "8" is a headline, the gate count is 15).

**PARTIAL** — completeness reached but the async SLO band missed (e.g. oldest-pending > 5 min), or all dead-letters were `provider_*` (tunable via C/pacer): re-tune and re-smoke. PARTIAL does **not** advance the percentage (gate doc §F item 5, ratified).
**FAIL** — any terminal hole (a cell never succeeds and is not an explained terminal), duplicate success rows, submit blocked, H/I/J ran, secret/raw leak, a classifier acceptance gate observed, OR a **single-family provider/server cluster** (any family with ≥2 `provider_*` terminal failures — gate doc §B(iv), §F item 2, ratified; the old cross-family-SQL threshold is superseded).

### 3.3 Monitoring SQL the smoke reads (already shipped — §A.10)

Snapshot A (queue health: pending / retry_scheduled / leased / dead_letter / failed_last_hour / oldest_pending_age_s / oldest_leased_age_s), B (failure-class breakdown by `failure_sub_reason`), C (last-drain + skipped-tick + recovery counters from `classifier_drain_audit`), D (stuck-lease detector) — parent §A.10. The smoke harness wraps these as poll-to-settle queries; no schema change needed.

---

## 4. The burst regression test / observability assertion (the chip's ask)

A **deterministic, pure-TS, NO-provider-call** test proving the queue path bounds **global** provider concurrency to C under a synthetic burst — the exact property direct dispatch lacks (RCA §3: per-isolate cap cannot sum-bound; ~76 concurrent observed).

**File:** `__tests__/archOneCardThreeBurstConcurrency.test.ts` (mirrors the `archOneCardTwo*` naming convention already in `__tests__/`).

**Primary assertion — bounded-concurrency proof (behavioral, pure):**
`runWithBoundedConcurrency` (`boundedConcurrencyRunner.ts`) is **pure TS** (no Deno, no fetch — verified `:50` "Pure: no Deno, no fetch") and is already imported behaviorally by `__tests__/mcpAutoTriggerBoundedConcurrency.test.ts:30`. Reuse its proven deferred-task tracker pattern (`mcpAutoTriggerBoundedConcurrency.test.ts:88-134`: a worker that increments `inFlight`, records `maxObserved`, and resolves on a per-index deferred):
1. Build **56 synthetic jobs** (8 args × 7 families; plain objects, no DB).
2. Drive `runWithBoundedConcurrency(jobs, DRAINER_PROVIDER_CONCURRENCY, fakeWorker)` where `fakeWorker` increments a shared `inFlight` counter, records `maxObserved`, and resolves via a controlled deferred.
3. **Assert `maxObserved <= DRAINER_PROVIDER_CONCURRENCY` (3)** at every release step and `tracker.inFlight <= 3` throughout.
4. **Contrast assertion:** drive the same 56 jobs through an unbounded `Promise.all(jobs.map(fakeWorker))` and assert `maxObserved === 56` — i.e. direct fan-out saturates exactly where the bounded path does not. This makes the regression concrete: it would have caught the RCA's ~76-wide saturation.

**Supporting assertions (source-scan, matching the established `archOneCardTwoDrainerCore.test.ts` source-scan convention — `classifierDrainerCore.ts` transitively pulls Deno so it is not require-loadable, `archOneCardTwoDrainerCore.test.ts:3-9`):**
5. `runClassifierDrain` wires the bound: `coreText` matches `runWithBoundedConcurrency(\s*claimed,\s*DRAINER_PROVIDER_CONCURRENCY` (`classifierDrainerCore.ts:209-213`) — the drainer actually feeds C into the bounded runner.
6. `DRAINER_PROVIDER_CONCURRENCY = 3` and `3 <= 5` (the MCP cap invariant) — value scan.
7. **Single-flight:** `coreText` shows `acquire_drain_lease` first, and `acquiredOwner !== owner` → `outcome='skipped_single_flight'` + early return with no claim/provider call (`classifierDrainerCore.ts:160-182`). A second concurrent drain cannot multiply C.
8. **NO provider call in the test:** assert the test file source contains zero `fetch` / `callAnthropic` / network imports (a self-scan, like `archOneCardTwoDrainerCore.test.ts`'s no-secret scan) — the test exercises only the pure bounded runner + constants + source scans.

**Observability assertion (optional, same file):** assert the drain-audit shape carries the counters the smoke's PASS check reads (`outcome`, `jobs_processed`, `jobs_succeeded`, `jobs_failed`, `jobs_dead_lettered`) and that `dead_letter`-count = 0 is the readable PASS signal (`classifierDrainerCore.ts:135-145`, `writeDrainAudit:595-605`). This ties the regression test to the smoke's gate.

**Why pure-TS / no live 429:** the parent design forbids gambling on live-inducing a 429 (§A.9 "never gamble on live-inducing a 429"); the bound is proven structurally. Deterministic, no flake, no provider spend.

---

## 5. The 3 operator confirmations — explicit DECISION POINTS (surfaced, NOT resolved)

These are the parent design's three open PARTIAL items (ARCH-001 "Open questions" 1–3, HALT H8/H10, RCA §7). Card 3 **surfaces** them with options + a recommended default; each is **operator-confirm before arming** and is NOT resolved by this card.

**DP-1 — Anthropic usage tier (governs C headroom; H10).**
- Options: **Tier 1** (50 RPM / 50k ITPM / 10k OTPM Haiku-4.5) · Tier 2 (1,000 RPM) · higher.
- At C=3, throughput ≈ `12·C` = ~36 RPM < 50 RPM with margin for the "60 RPM enforced as 1 req/s" burst note (parent §A.7).
- **Recommended default: assume Tier 1, ship C=3** (the safe lower bound; already the deployed constant). If the org is Tier 2+, C could rise toward 5 in a later tuning card, but Card 3 does NOT raise it.
- **Operator-confirm before arming:** the tier. If Tier 1, no action; if higher, note headroom but leave C=3 for this card.

**DP-2 — Edge plan free 150s vs paid 400s (governs drain budget T; H5).**
- Options: **free (150s wall-clock ceiling)** · paid (400s).
- The drainer ships **T=90s** against the conservative 150s floor (worst-case batch 121s < 150s, parent §A.5). On the 400s plan T could rise to ~300s (more jobs/invocation), but Card 3 does NOT raise it.
- **Recommended default: ship T=90s against the 150s floor** (correct on the worst case regardless of plan).
- **Operator-confirm before arming:** the plan. The smoke's "submit nonblocking + drain completes" holds at T=90s on either plan; confirming paid only unlocks a *future* tuning option.

**DP-3 — pg_cron granularity + worker headroom (H8; I2 PARTIAL).**
- Options: **60s tick (`'* * * * *'`, 1 cron job)** · sub-minute (`'[1-59] seconds'`, reliability unconfirmed).
- `max_worker_processes = 6` is tight (I8). Keep exactly **one** cron job; the enqueue-kick provides sub-second latency, so the tick need not be sub-minute (parent §A.2/§A.5).
- **Recommended default: 60s `'* * * * *'`, single job.** Do NOT schedule sub-minute (I2 PARTIAL).
- **Operator-confirm before arming:** confirm pg_cron worker headroom after `cron.schedule` (`SELECT * FROM cron.job;` shows exactly the one tick), and that `net.http_post` from cron reaches the drainer (one manual tick → a `classifier_drain_audit` row appears).

---

## 6. Relationship to the E#7 Family-H gate (PRECONDITION, not the gate)

Card 3's clean **N=56 PASS-LOAD (+ PASS-LOAD-CONFIRM)** is a **precondition** for the Family-H re-attempt, **not** Family-H itself. Per `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` §E item 7 / §F item 3 (ratified), the Family-H retry requires **all of**:
(a) a non-H PASS-LOAD, **AND** (b) a separate operator decision, **AND** (c) provider/server reliability proven at the higher 8-family load **+ a clean Card-3 re-run smoke**.

Therefore:
- **H/I/J stay `productionEnabled:false`** (`familyRegistry.ts:106/111/116`) — Card 3 does NOT flip them, does NOT enqueue them, does NOT smoke them. The smoke asserts **0 H/I/J rows** (§3.2).
- A clean Card-3 PASS-LOAD satisfies only **part (a) + part of (c)** of the H precondition. It does **not** unblock H (synthetic-only evidence does not authorize H — §F item 3).
- The Family-H re-attempt is a **separate later card** that consumes Card 3's clean smoke as input. Card 3 names it as a downstream dependency and stops.

---

## 7. Edge cases / failure modes / rollback

| Case | Handling (where) |
|---|---|
| **Disarm = instant revert** | `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` → `shouldRouteToQueue` returns false for everything → all new submits take the unchanged direct-dispatch branch (`submit-argument/index.ts:836-841`). No redeploy of code, no migration rollback. The proven path is still in the tree. |
| **In-flight jobs at disarm** | Continue draining to terminal via the cron tick + drainer; optionally `cron.unschedule('arch-001-classifier-drain-tick')` to pause. Additive columns are inert when off. |
| **Vault unseeded when cron/kick fires** | Both the tick (proposed null-URL guard, §1) and the kick (`20260528000023_...:195-197`) skip silently — no failed `net.http_post`, no broken INSERT, no error noise. The §A.10 "No successful drain while pending>0" alert catches a persistently-unseeded state. |
| **Shared-secret mismatch (Vault vs function env)** | Every tick/kick → drainer 401 (`classifier-drainer/index.ts:96-110`), nothing logged. Queue never drains → §A.10 "No successful drain" alert. Operator re-seeds Vault to match `CLASSIFIER_DRAIN_SHARED_SECRET`. |
| **Lease reclaim (drainer died mid-batch)** | `reclaim_stale_leases` (run first in every drain, `classifierDrainerCore.ts:186-193`) resets `leased`-past-`lease_expires_at` rows → `retry_scheduled` (re-claimable) or `dead_letter` at the reclaim cap (3). The drain lease TTL `L=130 ≥ T+30+10` guarantees a drainer's lease cannot expire while it still has an open provider call (parent §A.4 binding rule) → steady-state in-flight ≤ C. |
| **Dead-letter handling** | A cell that exhausts retries (live cap 4, or reclaim cap 3) → `state='dead_letter'`, typed `dead_letter_reason`, no result rows. §A.10 alert "Dead-letter present" → operator triage via failure-class breakdown B. Re-drive (rare): admin sets `state='pending', available_at=now(), attempt_count=0` (service-role; never client). **In the smoke, any dead-letter = below PASS-LOAD bar.** |
| **Enqueue-kick advisory-lock burst** | `pg_try_advisory_xact_lock(kick_key)` debounces concurrent submits to one kick (`20260528000023_...:178-180`); a burst of N submits → 1 kick. Even if the debounce fails open, single-flight (`acquire_drain_lease`) collapses N kicks to one drain (`classifierDrainerCore.ts:160-182`). The Card-2 burst observed ~106 `skipped_single_flight` audit rows across 15 submits — benign by design; the multi-row enqueue (`classifierQueueRouting.ts:228-255`, ONE INSERT statement → ONE kick) reduced it. |
| **Double-dispatch** | The submit fork is mutually exclusive (`submit-argument/index.ts:817-841`); an arg takes exactly one branch. Even under a code error, index #4 (one success/cell) + index #5 (one active job/cell) make duplicate-success/duplicate-active DB-impossible (`20260528000021_...:256-268`). |
| **isolated-tolerated rule scope** | The "isolated provider dead_letter tolerated / `distinct_dead_letter_families=1`" rule governs the **disarm (rollback)** decision for an already-armed organic window ONLY — **never** PASS-LOAD admission (gate doc §F item 1, ratified). The smoke bar stays 0 terminal dead-letters. |
| **Empty queue / quiet period** | A tick with no due jobs: claim returns 0 → loop breaks immediately (`classifierDrainerCore.ts:204`), `outcome='completed'`, jobs_processed=0. Harmless. |
| **Concurrent ticks + kick** | All but one exit at `acquire_drain_lease` (single-flight); the winner drains, losers write a `skipped_single_flight` audit row and return. |

---

## 8. File-change inventory the IMPLEMENTATION card would touch (NO code in THIS card)

| Kind | Path | Purpose | Est. |
|---|---|---|---|
| NEW migration | `supabase/migrations/<next-seq>_arch_001_card3_cron_drain_tick.sql` | `cron.schedule` the 60s drain tick with the null-URL-guarded `DO`-block body; runbook-comment the Vault seed shape. NO extension, NO column, NO table, NO index, NO policy. | ~60–90 lines (mostly comment header + the one scheduled command) |
| NEW runbook | `docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md` (or a section in current-status) | The §1(b) Vault-seed step + the §2 staged-arm protocol + the §3 smoke poll-to-settle SQL + disarm/rollback. Operator-run; no secret values. | ~150 lines |
| NEW smoke harness | `scripts/arch-001-card3-smoke/` (SQL poll-to-settle + canary/N=56 helpers) | Drive the §3 canary + N=56 burst against smoke-tagged rooms; poll snapshot A/B/C/D to settle; emit a committable audit md (no secrets, leak-scanned). Reuse the smoke-tag tooling (CORPUS-QUEUE-SMOKE-TAG-001) for room titles. | ~200 lines |
| NEW regression test | `__tests__/archOneCardThreeBurstConcurrency.test.ts` | §4 bounded-concurrency proof (pure) + source-scan supports + no-provider-call self-scan. | ~120–180 lines |
| MODIFIED docs | `docs/core/current-status.md` | Add the Card-3 Phase-framing section + new test count (H2 must match the review file's count, per the multi-card chain rule). | ~30 lines |
| MODIFIED docs | `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` | Flip the header "Card 3" status to shipped; note the N=56 canonical bar supersedes the §A.12 "3×5" wording. | ~10 lines |
| (optional) NEW audit | `docs/audits/ARCH-001-CARD3-SMOKE-<date>.md` | The operator's recorded smoke verdict (PASS-LOAD / CONFIRM), produced AFTER the operator runs the smoke. | operator-authored |
| **UNCHANGED (do NOT touch)** | `classifierQueueRouting.ts`, `classifierDrainerCore.ts`, `classifier-drainer/index.ts`, `classifierDrainerRetryPolicy.ts`, `submit-argument/index.ts`, all 3 shipped migrations, `familyRegistry.ts`, the MCP server (`callAnthropic`, `providerConcurrencyGate`), `engine.ts` | The percentage knob, drainer, finalizer, retry calibration, and routing fork already exist; Card 3 only schedules cron + arms (operator) + smokes + adds the regression test. | — |

**This (design) card touches exactly ONE file:** `docs/designs/ARCH-001-CARD3-PRODUCTION-SMOKE-STAGED-ROLLOUT.md`.

---

## 9. Test plan + acceptance criteria (test-discipline)

**Design card (this card):** typecheck / lint / test baseline **preserved unchanged** (no code touched). Current baseline ≈ **704 suites / 29389 passing** (`docs/core/current-status.md` latest H2). The design card adds zero tests; it asserts the baseline is untouched (`npm run typecheck`, `npm run lint`, `npm run test` all exit 0 — design-only, so the count does not move).

**Implementation card (later) test plan:**
- `__tests__/archOneCardThreeBurstConcurrency.test.ts` (new suite, **+8 to +14 tests**):
  - happy path: 56-job bounded run, `maxObserved <= 3` at every release.
  - bound-reached: ≥ C jobs in flight reaches exactly 3 (not under-bounding).
  - contrast: unbounded `Promise.all` reaches `maxObserved === 56` (the saturation the queue prevents).
  - source-scan: `runClassifierDrain` feeds `DRAINER_PROVIDER_CONCURRENCY` into `runWithBoundedConcurrency`; C=3; C ≤ 5; single-flight skip path present.
  - no-provider-call self-scan: the test file contains zero `fetch`/`callAnthropic`/network imports.
  - observability: drain-audit counters shape includes the smoke's PASS signals; `dead_letter`-count readable.
- **Migration test** (new suite, mirroring `archOneClassifierQueueSubstrateMigration.test.ts` / `archOneCardTwoEnqueueKickMigration.test.ts` source-scan convention): assert the Card-3 migration (a) contains exactly one `cron.schedule('arch-001-classifier-drain-tick', '* * * * *', …)`, (b) the tick body reads Vault and has the null-URL guard, (c) contains **zero** `CREATE EXTENSION` / `CREATE TABLE` / `ADD COLUMN` / `CREATE POLICY` / real-secret literals, (d) the scheduled body `net.http_post`s the URL from `vault.decrypted_secrets` and never embeds a secret. **+6 to +10 tests.**
- **Doctrine ban-list scan:** assert the migration + harness + any new strings carry zero verdict tokens (winner/loser/true/false/liar/dishonest/bad faith/etc.) and zero secret-shapes (`Bearer`/`sk-ant`/`sb_secret`/JWT) — pattern of existing safety tests.
- **Acceptance:** `npm run typecheck` / `npm run lint` / `npm run test` exit 0; test count goes UP; no `.skip`/`.only`/committed `console.log`; the new count is captured from the `Test Suites: X passed / Tests: Y passed` line with explicit exit code; `current-status.md` H2 count matches the review file (multi-card-chain cross-check rule).
- **The production smoke is operator-run** (not a CI test) — its PASS-LOAD verdict is recorded in `docs/audits/` after the operator arms + runs it; it is NOT part of the implementation card's green-gate (the gate is the regression + migration tests passing).

---

## 10. Risks + gate map

### Risks
- **R1 (H8) pg_cron worker headroom.** `max_worker_processes=6` is tight; keep exactly ONE cron job (no separate reclaim cron — reclaim runs inside the drain). Surfaced as DP-3; operator confirms `cron.job` shows one tick after apply.
- **R2 (H5/H9) drainer endpoint auth.** `verify_jwt=false` + shared-secret. The Vault `<shared-secret>` MUST equal the function env `CLASSIFIER_DRAIN_SHARED_SECRET`; mismatch → silent 401s. Caught by the §A.10 "No successful drain" alert; operator verifies one manual tick produces a `classifier_drain_audit` row.
- **R3 (I2 PARTIAL) cron sub-minute reliability.** Unconfirmed; the design does NOT depend on sub-minute (kick is the latency path; tick is 60s safety net). If sub-minute is ever needed and unreliable, that is a tunable, not a Card-3 blocker.
- **R4 (DP-1/DP-2 PARTIAL) tier/plan ambiguity.** C=3 + T=90s are the safe lower bounds; confirming higher tier/plan only unlocks *future* tuning, never required for this card.
- **R5 retry-cap asymmetry (live 4 vs reclaim 3).** Intentional (S6); the smoke's dead-letter monitoring + the regression test must not assume a single cap. The implementer must read `state='dead_letter'` regardless of producing path.
- **R6 bar-integrity (the most important).** Do NOT introduce a nonzero dead-letter budget; do NOT cite PARTIAL/PLUMBING/target-mitigation passes as 5%-authorizing; do NOT read the isolated-tolerated rule into PASS-LOAD admission. All ratified in gate doc §F. A reviewer must reject any smoke wording that softens "0 terminal dead-letters at N=56".
- **R7 doc-drift: parent §A.12 says "3×5 waves" (N=15)** while the canonical bar is N=56 (8 args). The implementation card must use **N=56** and add the one-line supersession note to the parent doc (§8). Not a code risk; a wording-alignment risk.
- **R8 migration-bearing review.** The Card-3 migration is migration-bearing → heightened reviewer verification (OPS-001 / roadmap-reviewer "Migration-bearing card verification"). The reviewer runs the mechanical `CREATE POLICY`/secret-literal scans.

### Gate map
- **GATE-A (design approval):** this doc. Reviewer confirms: no bar lowered, the 3 confirmations surfaced (not resolved), no code/migration/flag/arm, H/I/J untouched, the cron-migration shape is OPS-001-clean.
- **GATE-B (implementation self-verify):** typecheck/lint/test exit 0; new test count captured; ban-list + migration mechanical scans pass; byte-equality of all untouched files. The migration file is WRITTEN but NOT applied.
- **GATE-C (deploy + arm — operator only, separate cards):** apply the migration (`npx supabase db push --linked`); confirm DP-1/DP-2/DP-3; seed Vault (`vault.create_secret`); deploy is auto on merge for the registered drainer (already deployed); arm Step-1 (`CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `PERCENTAGE=0`); run the §3 smoke; ramp per §2 with a separate operator card per step. **This card authorizes none of GATE-C.**

---

## Out of scope

- **Arming routing / setting any env / running the smoke** (operator GATE-C; this card writes the protocol only).
- **Raising C above 3 or T above 90s** (future tuning card, gated on DP-1/DP-2 confirmation).
- **Family H/I/J of any kind** (frozen `productionEnabled:false`; the H re-attempt is a separate later card consuming Card 3's clean smoke — §6).
- **Detector tiering** (`ARCH-CIVIL-DISCOURSE-DETECTOR-POLICY`, parent §A.1).
- **Any MCP-server provider-path change or redeploy** (`callAnthropic`, the per-isolate gate, prompts, family keys, taxonomy, schema mirror, Source 6) — touched ZERO times (parent header, RCA §7).
- **Re-tuning the retry policy** (MAX_ATTEMPTS / backoff already calibrated, S6) — do NOT redo.
- **Removing the dead 15s submit-path adapter timeout or the vestigial per-isolate cap** (later cleanup, parent "Out of scope").
- **A user-facing surface for queue/job state** (operator/diagnostic only; `gameCopy.toPlainLanguage` untouched).
- **Re-litigating #371/#373** (Deno-KV recorded-rejected; ARCH-001 is the chosen path).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting).** The cron tick, Vault credential, staged arm, smoke, and regression test are pure capacity/transport scheduling + verification — no verdict, no truth value, no standing band. Claim order is arrival-FIFO (`claim_classifier_jobs … ORDER BY available_at, created_at`, `20260528000021_...:330`). Submit returns 201 before the routing decision is read (`submit-argument/index.ts` returns before the dispatch fork) — **nothing in Card 3 can block posting.** The rules engine (`engine.ts`) remains the sole acceptance gate and is untouched.
- **§3 (popularity is not evidence).** No engagement/virality/heat input anywhere in the cron tick, the arm predicate (reads only the structural smoke tag + operator flag + a stable id-hash, `classifierQueueRouting.ts:160-184`), the smoke, or the regression test. The id-hash has no security/truth claim (`:110-118`).
- **§4 (AI moderator limits).** Card 3 changes only **WHEN** the provider call runs (queue vs direct), never **WHAT** it concludes, and it still runs strictly AFTER storage. No authoritative flag; no auto-act; no client-side AI.
- **§5 (rules engine sacred).** `engine.ts` is not imported, not touched; the queue is server-runtime IO.
- **§6 (secrets).** The Vault credential is read at tick/kick/drainer runtime via `vault.decrypted_secrets`, **never in SQL, never in git, never in this doc** (the seed call shows `<placeholder>` shape only). No queue row, drain-audit row, or log line carries a prompt, body, raw payload, `ANTHROPIC_API_KEY`, `Authorization`/`Bearer`, or service-role key. The drainer's secret compare never logs either value (`classifier-drainer/index.ts:53-61`). The smoke + regression test re-scan for secret shapes. `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` stays zero (no app/src change).
- **§7 (no AI calls from the production app).** Unchanged — the Anthropic call stays inside the MCP server (Deno); the drainer is a Supabase Edge Function (server-side); no `src/`/`app/` file imports the drainer/queue/provider. The regression test is pure TS with no provider call.
- **§8 (Supabase conventions).** RLS unchanged; no new table/column/policy. The cron job is a `cron.job` catalog row, not an application table. Migration sequenced (next ordinal after `20260606000001`), never edits an applied file. OPS-001 four-class posture observed (§1). No service-role in client.
- **§9 / §10a (plain language; Observations vs Allegations).** No new internal code reaches a user string (`gameCopy.toPlainLanguage` untouched). Every persisted row stays a Machine Observation; the queue is infrastructure beneath the observation, never a new label class.

---

## Operator steps (for the LATER implementation + deploy cards — NOT this design card)

**This design card requires the operator to do NOTHING except review + approve GATE-A.** It writes one doc and commits it on `feat/arch-001-card3-design` (no push). The steps below are what the later cards require (listed so the operator can pre-assess):

1. **Implementation card (GATE-B):** writes the cron migration + runbook + smoke harness + regression test; verifies green; does NOT apply/arm.
2. **Apply the migration** — `npx supabase db push --linked` (the single `cron.schedule`). Migration-bearing → heightened reviewer verification (OPS-001).
3. **Confirm DP-1/DP-2/DP-3** (Anthropic tier, Edge plan, pg_cron granularity/worker headroom).
4. **Seed the two Vault secrets** — `vault.create_secret(...)` for the drainer URL + shared secret (the shared secret = `CLASSIFIER_DRAIN_SHARED_SECRET`). Never in SQL/git.
5. **Verify the tick** — one manual tick produces a `classifier_drain_audit` row; `SELECT * FROM cron.job` shows exactly the one tick.
6. **Step-1 smoke arm** — `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `PERCENTAGE=0`.
7. **Run the §3 smoke** (canary → N=56, poll-to-settle); record PASS-LOAD + PASS-LOAD-CONFIRM in `docs/audits/`.
8. **Ramp** per §2 — a separate operator card per percentage step, each gated on real organic evidence.
9. **No MCP-server redeploy** is required by this card.

---

## Conflicts found (surfaced, not papered over)

1. **Cron tick: migration (issue) vs operator runbook step (Card 2's comment block).** Card 2's enqueue-kick migration explicitly left the `cron.schedule` as an "OPERATOR-APPLIED (NOT APPLIED BY THIS MIGRATION)" manual step (`20260528000023_...:258-312`). The issue directs Card 3 to ship a migration. **Reconciliation (not a blocker):** Card 3 ships the migration with a **null-URL guard** so a pre-Vault-seed apply is a silent no-op (removing the only reason Card 2 deferred it). The migration is version-controlled, reviewable, idempotent, and rollback-documented (`cron.unschedule`). Documented in §1.
2. **Smoke size: parent §A.12 "3 waves of 5 (N=15)" vs the canonical "N=56 (8 args × 7 families)".** The gate-criteria consolidation doc (`OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` §A) and the issue both fix PASS-LOAD at **N=56**. The consolidation doc is the canonical reference and **supersedes** the parent's "3×5" phrasing. **Card 3 designs to N=56**; the implementation card adds a one-line supersession note to the parent doc. Surfaced as §Risks R7.
3. **Retry-cap asymmetry (live 4 vs reclaim 3).** Not a true conflict — intentional per `classifierDrainerRetryPolicy.ts:25-32`. Surfaced (§Data model note, R5) so the smoke + monitoring account for both producing paths.

No conflict blocks the design. All three are reconciled in favor of the issue's direction while preserving every shipped invariant and never lowering the PASS-LOAD bar.
