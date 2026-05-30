# ARCH-001 Card 1 — DB substrate ONLY (intent brief)

**Parent design:** `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` §A.3 (schema) + §A.4 (claim/lease) + §A.10 (audit table). That doc is the DDL/function source of truth; this brief records the Card-1 BOUNDARY + the resolved preflight, and frames the work for the implementer.
**Branch:** `feat/ARCH-001-card1-db-substrate`
**Trail:** GitHub #373 (umbrella) + the Card-1 issue.
**Operator gate:** migration is WRITTEN, NOT applied. Operator applies via `npx supabase db push --linked` after merge. NO Card 2/3 work until Card 1 is merged + applied + verified.

---

## Scope — DATABASE SUBSTRATE ONLY

IN scope: a new sequenced migration (written, not applied) implementing ARCH-001 §A.3's additive
columns + partial indexes + the two new tables + the extensions; and the claim/lease/recovery logic
as **SQL functions** (§A.4); plus Card-1 SQL/integration tests.

OUT of scope (Cards 2–3 — do NOT implement here): enqueue code; the drainer Edge Function;
`cron.schedule(...)` of a drain job; any feature flag; any submit-path routing/cutover; any
MCP-server change; any Family H work; and any prompt / taxonomy / family-key / schema-mirror /
Source-6 / audit-lint / `package.json` change.

---

## Preflight — RESOLVED (read-only, completed by orchestrator before any SQL)

### Current `argument_machine_observation_runs` schema (migration `20260526000018`, line 78+)
- `status text NOT NULL CHECK (status IN ('success','failed','fallback'))` — **`status` IS NOT NULL + CHECK-constrained to terminal values.**
- `completed_at timestamptz` (nullable).
- `schema_version text NOT NULL`.
- Existing index: `(argument_id, schema_version, completed_at DESC NULLS LAST)` — note **NULLS LAST**.
- `run_mode` added in `20260526000019`; `requested_families`, `provider_key` present (used by `findExistingRun`).

### BLOCKING: `status` nullability — RESOLUTION
A queue `pending`/`leased`/`retry_scheduled` row exists BEFORE any terminal outcome, so it has no
`status`. `status` is currently `NOT NULL` → a pre-terminal row cannot be inserted. **Resolution:**
the migration does **`ALTER TABLE … ALTER COLUMN status DROP NOT NULL`**. The existing
`CHECK (status IN ('success','failed','fallback'))` is **left unchanged** — a Postgres CHECK passes
when its expression is NULL (`NULL IN (...)` → NULL → not FALSE → constraint satisfied), so a NULL
`status` is already permitted by the CHECK once NOT NULL is dropped. **`status` keeps its meaning
(the terminal-outcome field, one of success/failed/fallback); it is simply NULL until a terminal
outcome.** The new `state` column carries the full queue lifecycle. We do NOT re-mean `status` and
do NOT widen its CHECK. The Card-1 test asserts a `state='pending'`, `status` NULL row inserts
cleanly and violates no CHECK/NOT NULL/FK.

### Reader audit — COMPLETE
Audited every production + analytics consumer of `argument_machine_observation_runs` for tolerance of
new pre-execution rows (`state IN ('pending','leased','retry_scheduled')`, `status` NULL,
`completed_at` NULL):
- **Source 6 — `src/features/nodeLabels/machineObservationPersistenceQuery.ts`: SAFE.** It selects
  from the **results** table (`…_results`) with an `!inner` join to `…_runs` only for `run_mode`,
  filtered `run_mode='production'`. Results rows exist ONLY for successful runs; pending/leased/failed
  runs produce no results, so they are naturally excluded. No status/state filter change needed.
- **`findExistingRun` — `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts:189`:
  SAFE IN CARD 1; LOGGED FOR CARD 2.** It orders by **`started_at DESC LIMIT 1`** (NOT `completed_at`)
  and treats only `status==='success'` as `already_classified`. Card 1 writes NO pending rows, so its
  behavior is unchanged. **Card-2 LOG:** once enqueue writes pending rows, a non-terminal row
  (status NULL) could sort first and be mis-read as "not classified" → re-dispatch. Card 2 must make
  this reader/route aware of active queue state (`state IN ('pending','leased','retry_scheduled')`);
  the partial unique index #5 (one-active-job-per-cell) is the DB backstop regardless.
- **No reader uses `ORDER BY completed_at DESC LIMIT 1`.** The only `completed_at DESC` in the tree is
  the index (NULLS LAST); the only `.order()` reader is `findExistingRun` (by `started_at`). So the
  "NULL `completed_at` sorts first under DESC" hazard does NOT bite any reader.
- **Analytics SQL (`scripts/ops/sql/*`, `scripts/ops-latency-sql/*`): diagnostic, not hot-path;
  LOGGED FOR CARD 2.** E.g. `03-runs-by-family-and-status.sql` groups by `status` — once Card 2 writes
  pending rows, `status` NULL would appear as a group. Cosmetic/diagnostic; Card 2 may add a state
  filter/label. No production behavior affected; nothing to change in Card 1.

### pg_cron / pg_net
Available, not installed. The migration issues `CREATE EXTENSION IF NOT EXISTS …` (operator-applied).
**HALT-class:** `max_worker_processes=6` is tight — enabling `pg_cron` consumes a background worker
and has a silent worker-startup risk; this is an operator-applied step, surfaced for operator
awareness. Card 1 does NOT `cron.schedule(...)` anything (no drainer to invoke until Card 2/3).

---

## Migration (WRITE the `.sql`; DO NOT apply) — per ARCH-001 §A.3

New sequenced file after `20260527000020` (next ordinal; never edit an applied migration). Follow the
OPS-001 four-class ordering: **extensions → columns → CHECK/constraints → indexes → comments.**

1. **Extensions** (operator-applied; HALT-class): `CREATE EXTENSION IF NOT EXISTS pg_cron;`
   `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;`. **No `cron.schedule`.**
2. **Additive columns on `argument_machine_observation_runs`** (all `ADD COLUMN IF NOT EXISTS`):
   `family text`; `state text NOT NULL DEFAULT 'succeeded' CHECK (state IN
   ('pending','leased','retry_scheduled','succeeded','failed_terminal','dead_letter'))`;
   `attempt_count int NOT NULL DEFAULT 0`; `available_at timestamptz NOT NULL DEFAULT now()`;
   `lease_expires_at timestamptz`; `lease_owner text`; `failure_sub_reason text`;
   `dead_letter_reason text`; `last_attempt_at timestamptz`.
3. **`status` nullability:** `ALTER COLUMN status DROP NOT NULL` (CHECK unchanged — see preflight).
4. **Backfill `state` for existing rows:** `'succeeded'` where `status='success'`, else
   `'failed_terminal'`. (`state` has a DEFAULT `'succeeded'` so the column add is safe on a populated
   table; the backfill corrects non-success historical rows.)
5. **Partial indexes (ARCH-001 §A.3 #4–#7), every one predicated `family IS NOT NULL`** so historical
   rows (which have NULL `family`) are excluded:
   - #4 one-success-per-cell: `UNIQUE (argument_id, family, run_mode, schema_version) WHERE state='succeeded' AND family IS NOT NULL`.
   - #5 one-active-job-per-cell: `UNIQUE (argument_id, family, run_mode, schema_version) WHERE state IN ('pending','leased','retry_scheduled') AND family IS NOT NULL`.
   - #6 claim index: on `(available_at, created_at)` (or per §A.3) `WHERE state IN ('pending','retry_scheduled') AND family IS NOT NULL`.
   - #7 stale-lease index: on `(lease_expires_at)` `WHERE state='leased' AND family IS NOT NULL`.
   (Use the EXACT column order + predicates in ARCH-001 §A.3; this brief summarizes.)
6. **New tables** `classifier_drain_lock` + `classifier_drain_audit` (§A.3/§A.4/§A.10): **RLS ENABLED,
   NO client write policy (service-role only).** Columns per §A.3/§A.10.
7. **COMMENTs** per §A.3.
8. The Vault credential for the drainer is a **runbook/plan note only** — NO secret in SQL or git.
9. RLS on existing tables unchanged.

---

## Claim / lease / recovery — SQL FUNCTIONS (HARD: never PostgREST `.from().select()` chains)

All `FOR UPDATE SKIP LOCKED` + lease logic live in SQL functions/RPCs (or direct SQL in a function),
per ARCH-001 §A.4:
- `claim_classifier_jobs(batch_size int, owner text, lease interval)` — the §A.4 CTE: SELECT due rows
  (`state IN ('pending','retry_scheduled') AND available_at <= now()` ORDER BY `available_at, created_at`
  LIMIT batch_size `FOR UPDATE SKIP LOCKED`) → UPDATE to `leased` (set `lease_owner`, `lease_expires_at`,
  bump `attempt_count`, `last_attempt_at`) → `RETURNING`.
- `acquire_drain_lease(owner text, ttl interval)` — conditional
  `INSERT … ON CONFLICT (lock_key) DO UPDATE … WHERE classifier_drain_lock.expires_at < now() RETURNING owner`.
- `release_drain_lease(owner text)` — delete only own lease.
- `reclaim_stale_leases()` — `state='leased' AND lease_expires_at < now()` → `retry_scheduled`, or
  `dead_letter` at the attempt cap.

**ON CONFLICT vs partial indexes — CALL THIS OUT (and it is the load-bearing correctness point):**
the enqueue idempotency form (the SQL/function is DEFINED + TESTED here even though enqueue is WIRED
in Card 2) MUST use the **column-inference + predicate** form
`ON CONFLICT (argument_id, family, run_mode, schema_version) WHERE <index #5 predicate> DO NOTHING`
— **NOT `ON CONFLICT ON CONSTRAINT …`**, which cannot target a *partial* unique index. The predicate
must match index #5 exactly. Inline it with the exact predicate, or encapsulate it in a tested SQL
function.

---

## Card-1 tests (SQL/integration vs a local Supabase test DB; deterministic)
1. Index #4 blocks a SECOND `succeeded` row for one cell (unique violation); `failed_terminal` +
   later `succeeded` is allowed.
2. Index #5 blocks a SECOND active job for a cell; the `ON CONFLICT … DO NOTHING` enqueue is a no-op
   for an active cell.
3. `claim_classifier_jobs` claims due rows; SKIP-LOCKED-skips a row locked by a concurrent txn; never
   double-claims; does NOT claim `available_at > now()` rows.
4. `acquire_drain_lease`: two concurrent acquires → exactly one returns its own owner; an expired
   lease is stealable; `release_drain_lease` deletes only its own.
5. `reclaim_stale_leases` moves an expired `leased` row to `retry_scheduled`; dead-letters at the cap.
6. **Compatibility (the preflight resolution, asserted):** a `state='pending'`, `status` NULL row
   inserts WITHOUT violating any existing CHECK / NOT NULL / FK.

---

## Process + review focus
roadmap-implementer (this scope) → roadmap-reviewer → PR → operator-gated squash-merge → operator
applies the migration (gated) → short Card-1 live verification (migration applies clean; all
indexes/functions exist; partial-index `ON CONFLICT` + claim/lease functions behave as tested).

**Reviewer focus:** index correctness (partial predicates + column order); `ON CONFLICT`
column-inference-with-predicate (NOT `ON CONSTRAINT`); `status`/`state` compatibility (pending rows
insertable; `status` meaning intact); the preflight reader-audit holds (no existing reader broken);
RLS on the two new tables (service-role only, no client write policy); migration WRITTEN not applied;
NO out-of-scope changes (no enqueue/drainer/flag/routing/MCP/Family-H). Migration-bearing card →
heightened verification per `.claude/agents/roadmap-reviewer.md`.
