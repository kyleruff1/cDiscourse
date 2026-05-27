# OPS-MCP-TEST-DATA-CLEANUP — Clean or quarantine 11 synthetic test rows

**Status:** Design draft (Stage 1 — Phase A audits complete; Stage 2B operator-decision pending)
**Epic:** OPS — data hygiene
**Release:** OPS hardening (post-OBSERVABILITY follow-on)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/324
**Intent brief:** `docs/designs/OPS-MCP-TEST-DATA-CLEANUP-intent.md` (binding)
**Predecessor SHA chain:**
- `19b8d8a` — OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING smoke PASS (Q12 now clean signal)
- `e060eef` — Q12 SEMANTIC TIGHTENING ship (PR #323)
- `0e98c27` — OPS-MCP-OBSERVABILITY smoke PARTIAL (surfaced the contamination)
- `d500037` — OPS-MCP-OBSERVABILITY ship (PR #321)
- `8d0ddb9` — OPS-MCP-TEST-DATA-CLEANUP intent brief (this card)

---

## Goal (one paragraph)

Clean or quarantine the **11 synthetic test rows** (2 runs + 9 results) seeded with `provider_key='smoke-mcp:test-server'` that the OPS-MCP-OBSERVABILITY smoke surfaced as contamination of the production-mode aggregate at Q11 + Q12. The cleanup must respect Supabase migration discipline (append-only, idempotent), preserve the schema's CASCADE behavior (so the FK from results.run_id → runs.id correctly handles dependent rows), leave all 28 non-synthetic runs + 34 non-synthetic results untouched, and avoid any change to MCP-021 doctrine. Stage 2B presents the operator with a binary choice between **Approach A (hard delete)** — simpler, lossy — and **Approach B (quarantine via `is_synthetic` column)** — preservative, broader edit, future-leak defense. The designer recommends **Approach A** for reasons enumerated in §3.

---

## 1. Scope reality (Phase A.1 — live row inventory verification)

**Live DB query executed via `npx supabase db query --linked`.** All 11 rows surfaced exactly as the intent brief §1 binding inventory.

### A.1.a — Totals

| label | count |
| --- | --- |
| `runs_total` (provider_key LIKE 'smoke-%') | **2** |
| `results_total` (joined through smoke-% runs) | **9** |
| `non_synthetic_runs_total` (provider_key IS NULL OR NOT LIKE 'smoke-%') | **28** |
| `non_synthetic_results_total` (joined through non-smoke runs) | **34** |

**Cleanup scope: 11 synthetic rows. Untouched: 62 non-synthetic rows.** Inventory matches §1 of the intent brief exactly. **HALT trigger 5 (delete > 11 rows) does not fire.**

### A.1.b — Run 1 (id `2a16fe8b-ff19-4112-9f41-aab6be5e1a82`)

| field | value |
| --- | --- |
| run_id | `2a16fe8b-ff19-4112-9f41-aab6be5e1a82` |
| argument_id | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` (real argument; `status='posted'`; created 2026-05-25 22:06:33) |
| debate_id | `1e598dce-8188-4c7e-bdd6-aedede750923` |
| provider_key | `smoke-mcp:test-server` |
| model_name | `smoke-test-model-v1` |
| run_mode | `production` |
| status | `success` |
| failure_reason | NULL |
| schema_version | `mcp-021.machine-observations.boolean.v1` |
| requested_families | `['parent_relation', 'misunderstanding_repair']` |
| created_at | `2026-05-26 05:56:33.772763+00` |

Result rows (5):

| result_id | family | raw_key | confidence | schema_version | has_evidence_span |
| --- | --- | --- | --- | --- | --- |
| `371d2a25-81d4-4334-8959-9cf0969f7d9d` | misunderstanding_repair | offers_candidate_understanding | high | v1 | true |
| `addce055-71a7-4bd2-ab05-16ea6dbd9039` | misunderstanding_repair | requests_clarification | high | v1 | true |
| `3f5d6d52-2d96-46a4-9c8e-e93a5a05136a` | parent_relation | refines_parent | high | v1 | true |
| `db6e0f13-ec9f-4524-b326-98c85d0a6173` | parent_relation | supports_parent | high | v1 | true |
| `25fd0c87-ad78-4509-a8ce-4fdcbbb17fc3` | parent_relation | **totally_made_up_key_should_be_discarded** | high | v1 | false |

The fake key `totally_made_up_key_should_be_discarded` is not in the MCP-021A registered taxonomy and would be silently dropped by the adapter at read time. Its presence confirms the developer-test-data origin of this seed.

### A.1.c — Run 2 (id `ff2bd3cc-2e06-411b-878b-b7ceb9139dfd`)

| field | value |
| --- | --- |
| run_id | `ff2bd3cc-2e06-411b-878b-b7ceb9139dfd` |
| argument_id | `781f8057-9e2a-4fa9-92a8-469676950ff7` (real argument; `status='posted'`; created 2026-05-25 22:06:34) |
| debate_id | `1e598dce-8188-4c7e-bdd6-aedede750923` |
| provider_key | `smoke-mcp:test-server` |
| model_name | `smoke-test-model-v1` |
| run_mode | `production` |
| status | `success` |
| failure_reason | NULL |
| schema_version | `mcp-021.machine-observations.boolean.v1` |
| requested_families | `['evidence_source_chain', 'resolution_progress']` |
| created_at | `2026-05-26 05:56:33.772763+00` |

Result rows (4):

| result_id | family | raw_key | confidence | schema_version | has_evidence_span |
| --- | --- | --- | --- | --- | --- |
| `a6afcf18-c148-4737-a1c4-ed078ecf5cff` | evidence_source_chain | evidence_gap_present | high | v1 | true |
| `4a8331ca-716e-4016-9c26-b4cd12fb34a8` | parent_relation | supports_parent | high | **`mcp-999.fake-schema.v999`** | false |
| `716feb77-db81-421a-9c11-69c1d761799f` | resolution_progress | concedes_narrow_point | high | v1 | true |
| `a65b5929-7e3d-40ab-bfb4-06bfe18dd513` | resolution_progress | synthesis_proposed | high | v1 | true |

A second tell of synthetic origin: result_id `4a8331ca-716e-4016-9c26-b4cd12fb34a8` carries `schema_version='mcp-999.fake-schema.v999'` — a deliberately invalid schema version that the adapter would also reject at read time.

### A.1.d — Targets exist (FK CASCADE behavior is benign)

Both target argument rows (`f41b18b0...` and `781f8057...`) are **real posted production arguments** from 2026-05-25 — the smoke run used them as targets but did not create them. Deleting the runs does NOT cascade to the arguments. The schema FK chain is:

```
runs.argument_id → arguments.id  (ON DELETE CASCADE: when an argument is deleted, its runs are deleted; not the reverse)
results.run_id   → runs.id        (ON DELETE CASCADE: deleting a run deletes its results — used by Approach A)
results.argument_id → arguments.id (ON DELETE CASCADE: same direction)
```

Neither approach touches `public.arguments`, `public.debates`, or any other table.

### A.1.e — No HALT triggers fire

- HALT 5 (> 11 rows): NO — exactly 11.
- HALT 6 (backfill scope creep): NO — Approach B backfill is exactly 2 runs (the 2 synthetic).
- HALT 2 (non-synthetic provider affected): NO — single exact `provider_key = 'smoke-mcp:test-server'` predicate; no LIKE pattern, no fuzzy match.
- HALT 3 (touches tables beyond `argument_machine_observation_*`): NO — both approaches touch only those two tables.

---

## 2. Approach A vs Approach B (Phase A.2 — full trade-off table)

### A — Hard delete (single DELETE; CASCADE handles results)

```sql
-- ── Cleanup statement ─────────────────────────────────────────
DELETE FROM public.argument_machine_observation_runs
WHERE provider_key = 'smoke-mcp:test-server';
-- Expected affected rows: 2 (runs).
-- Cascade: 9 result rows auto-deleted via FK ON DELETE CASCADE.
```

| dimension | Approach A — Hard delete |
| --- | --- |
| Lines of new SQL in migration | ~30 (statement + header comment) |
| New columns / indexes | None |
| Source 6 filter touch | None |
| Observability SQL touch | None |
| Files modified beyond migration | Zero |
| Forecast test count delta | **+10** |
| Future-leak defense | None (a future smoke insertion using a new provider pattern would re-contaminate) |
| Reversibility | None (hard delete is irreversible from app side; Supabase point-in-time recovery is the only restore path) |
| Audit trail of historical synthetic seed | None |
| Maintenance burden | Zero post-ship |
| Schema migration risk | Minimal — single DELETE statement; no DDL; CASCADE is well-tested |
| Doctrine boundary | Pure data cleanup; no src/ touch; no code-path semantic change |
| Idempotency | Second run: WHERE clause matches 0 rows; 0 affected — natural no-op |
| Doctrine §8 (soft-delete only for arguments) | NOT VIOLATED — these are *observation runs/results*, NOT arguments. `public.arguments` is untouched. The doctrine "soft-delete only" rule applies specifically to argument rows. |

### B — Quarantine via `is_synthetic` column (preservative)

```sql
-- ── Quarantine statements ────────────────────────────────────
-- 1. Add quarantine column.
ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill the 2 known synthetic runs.
UPDATE public.argument_machine_observation_runs
SET is_synthetic = TRUE
WHERE provider_key = 'smoke-mcp:test-server'
  AND is_synthetic = FALSE;  -- idempotency guard
-- Expected affected rows: 2.

-- 3. Partial index for fast filtering.
CREATE INDEX IF NOT EXISTS amor_runs_synthetic_idx
  ON public.argument_machine_observation_runs (is_synthetic)
  WHERE is_synthetic = TRUE;
```

Plus required code changes:

- **Source 6 filter touch** at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`:

```ts
// Existing:
.eq('argument_machine_observation_runs.run_mode', 'production');

// New (one additional chained call before the await):
.eq('argument_machine_observation_runs.run_mode', 'production')
.eq('argument_machine_observation_runs.is_synthetic', false);
```

- **14 observability SQL files** in `scripts/ops/sql/` need a synthetic-row exclusion predicate added to every aggregation. Strategy: for files that JOIN through `argument_machine_observation_runs r`, add `AND (r.is_synthetic IS DISTINCT FROM TRUE)` to the existing WHERE; for files that only scan the runs table directly, add the same predicate to the top-level WHERE.

| dimension | Approach B — Quarantine |
| --- | --- |
| Lines of new SQL in migration | ~60 (header + 3 statements + comments) |
| New columns | 1 (`is_synthetic BOOLEAN NOT NULL DEFAULT FALSE`) |
| New indexes | 1 (`amor_runs_synthetic_idx` partial) |
| Source 6 filter touch | YES — one `.eq()` chained call added at line 127 (intent brief §10 explicitly permits this single touch for this card only) |
| Observability SQL touch | YES — all 14 files need an `is_synthetic` predicate |
| Files modified beyond migration | 1 src + 14 SQL = **15 files** |
| Forecast test count delta | **+25** |
| Future-leak defense | YES — a future smoke insertion through any provider can be quarantined by flipping `is_synthetic = TRUE` without code change |
| Reversibility | YES — `UPDATE ... SET is_synthetic = FALSE` undoes the quarantine |
| Audit trail of historical synthetic seed | YES — the 2 runs + 9 results remain queryable; Q11 / Q12 can be re-run with the predicate on/off |
| Maintenance burden | Permanent — every new observability SQL file (and every future card touching this filter chain) must remember to include the `is_synthetic` predicate |
| Schema migration risk | Low but non-zero — column ADD on a populated table requires a Supabase table rewrite (transient lock; small data volume) |
| Doctrine boundary | Touches Source 6 (one chained `.eq()` only — additive defense in depth); permitted by intent brief §10 |
| Idempotency | Second run: ADD COLUMN IF NOT EXISTS is no-op; UPDATE with `AND is_synthetic = FALSE` guard matches 0 rows on second run; CREATE INDEX IF NOT EXISTS is no-op |
| Doctrine §8 | Same as A — observation rows, not argument rows; the doctrine soft-delete rule does not apply |

---

## 3. Designer recommendation — **Approach A (hard delete)**

**Pick: Approach A.** Rationale (in priority order):

### 3.a — The data being cleaned is verifiably synthetic, not historical

All 11 rows trace to a **single insertion event** at `2026-05-26 05:56:33.772763+00` (uniform created_at). The data is:

- Tagged with a synthetic provider (`smoke-mcp:test-server`)
- Tagged with a synthetic model (`smoke-test-model-v1`)
- Contains a deliberately invalid raw_key (`totally_made_up_key_should_be_discarded`)
- Contains a deliberately invalid schema version (`mcp-999.fake-schema.v999`)
- Pre-dates the Family B + C ship (so the rows were never operationally meaningful)

There is no real-world signal to preserve. The audit trail of "synthetic test seed inserted on 2026-05-26 and cleaned up on 2026-05-27" is already preserved in the OPS-MCP-OBSERVABILITY smoke audit (`0e98c27`), the Q12 smoke audit (`19b8d8a`), and this design document. Approach B's "preservative" advantage is real-world-meaningful only when the rows themselves carry signal we might want to query later — these don't.

### 3.b — Maintenance burden of Approach B is permanent and asymmetric

Approach B adds a predicate that every new observability SQL file and every new code path that reads `argument_machine_observation_runs` must remember to include. A future card that ships a new ops query and forgets `is_synthetic = FALSE` will silently re-contaminate aggregates. The intent brief's own future-leak argument cuts both ways: future synthetic-data leaks will not all use the `provider_key LIKE 'smoke-%'` pattern, so Approach B is only partially defensive against future leaks anyway.

The maintenance burden in B is **15 files modified now** + **a permanent code-review checklist item** + **a permanent risk that a future query forgets the predicate**. Approach A's burden is **zero files modified post-ship**.

### 3.c — Future-leak defense is the wrong card

If "auto-quarantine future smoke-% rows" is the goal, the right card is **OPS-MCP-IDEMPOTENCY-HARDENING** or a dedicated **OPS-MCP-INSERT-GUARDRAILS** card that adds a CHECK constraint at insert time (e.g., `provider_key NOT LIKE 'smoke-%'`) or routes all inserts through an Edge Function with provider whitelist. Approach B's `is_synthetic` column is a *passive* defense that requires every query to opt in; an *active* defense (insert-time CHECK, Edge Function provider validation) would prevent the data from existing in the first place. Mixing scope-creeping defense into a single S-effort cleanup card violates the "one card, one decision" discipline.

### 3.d — Doctrine boundary preservation

Approach A is purely a data cleanup migration; it touches only `argument_machine_observation_runs` (the migration) and lets the FK CASCADE handle results. Approach B requires a Source 6 filter touch (single `.eq()` line), which the intent brief §10 permits for this card but is a **doctrine boundary edit** — Source 6 lives in `src/`, normally locked for OPS cards. Approach A avoids needing that permission at all.

### 3.e — Schema migration risk

Approach B adds a column to a populated table. PostgreSQL `ALTER TABLE ADD COLUMN ... NOT NULL DEFAULT FALSE` on small tables (< 1000 rows; today: 30 rows total) is fast and safe, but it requires a transient lock on the table. The locks are short, but they're a non-zero risk during peak production write traffic. Approach A's single DELETE doesn't change the schema at all — zero lock-time risk.

### 3.f — Reviewer effort

Approach A is a **one-statement migration** the reviewer can verify by reading 30 lines and confirming the WHERE clause exactly matches the inventory. Approach B is a 15-file diff plus a permanent test surface — the reviewer must verify every new SQL file's `is_synthetic` predicate, the Source 6 chain, the migration's column shape, and the regression test count. The smaller diff makes Approach A's reviewer error rate lower (OPS-001 lesson: heightened textual review is the migration discipline; smaller diff = lower miss probability).

### 3.g — Test forecast

A's +10 forecast vs B's +25 forecast both clear HALT trigger 14 (+60), but +10 is **2.5x smaller**. Smaller test diff = faster regression, lower flake risk, smaller cognitive load when reading the PR.

### 3.h — When Approach B would be preferable (operator override path)

If the operator's strategic posture is "preserve every persisted observation row indefinitely for future audit" (e.g., regulatory reasons, forensic posture for the AI moderation layer), Approach B is the right pick. The intent brief authorizes the operator to override Approach A at Stage 2B with that rationale.

---

## 4. Approach A migration SQL (full text)

**File:** `supabase/migrations/20260527000020_ops_mcp_test_data_cleanup.sql`

```sql
-- ============================================================
-- Migration: 20260527000020_ops_mcp_test_data_cleanup
-- Description: OPS-MCP-TEST-DATA-CLEANUP — remove 11 synthetic test
--   rows (2 runs + 9 results) seeded with provider_key='smoke-mcp:test-server'
--   on 2026-05-26 05:56:33. The OPS-MCP-OBSERVABILITY smoke at
--   0e98c27 surfaced these rows as contamination of the production-mode
--   aggregate at Q11 + Q12. The Q12-SEMANTIC-TIGHTENING smoke at
--   19b8d8a confirmed they persist after the Q12 SQL fix.
--
-- Card: OPS-MCP-TEST-DATA-CLEANUP
--   - Intent brief: docs/designs/OPS-MCP-TEST-DATA-CLEANUP-intent.md
--   - Design: docs/designs/OPS-MCP-TEST-DATA-CLEANUP.md (Approach A)
-- Operator decision: Stage 2B chose Approach A (hard delete).
--
-- Predecessor SHA chain:
--   - 19b8d8a — OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING smoke PASS
--   - e060eef — Q12 SEMANTIC TIGHTENING ship (PR #323)
--   - 0e98c27 — OPS-MCP-OBSERVABILITY smoke PARTIAL
--   - d500037 — OPS-MCP-OBSERVABILITY ship (PR #321)
--
-- Doctrine encoded:
--   - This is data cleanup, NOT argument soft-delete. The
--     cdiscourse-doctrine §8 "soft-delete only for arguments" rule
--     applies to public.arguments rows; this migration touches only
--     public.argument_machine_observation_runs (and via FK CASCADE
--     public.argument_machine_observation_results). The two target
--     argument rows (f41b18b0... and 781f8057...) are real posted
--     production arguments — they are NOT touched by this migration.
--   - This migration does NOT delete any flag row (cdiscourse-doctrine
--     §8 "flags rows never delete"). This migration does NOT touch the
--     flags table at all.
--   - Tightly bounded WHERE clause: single exact provider_key match,
--     NOT a LIKE pattern. Intent brief §2 binding constraint.
--   - Idempotent: a second apply finds 0 matching rows and is a no-op.
--
-- Affected rows (Phase A.1 inventory; design §1):
--   - 2 runs (ids 2a16fe8b-ff19-4112-9f41-aab6be5e1a82 and
--     ff2bd3cc-2e06-411b-878b-b7ceb9139dfd, both provider_key
--     'smoke-mcp:test-server')
--   - 9 result rows (via FK ON DELETE CASCADE from runs.id)
--   - Total: 11 rows.
--
-- HALT trigger evaluation (intent brief §6):
--   - HALT 5 (> 11 rows): does not fire — exact 11.
--   - HALT 6 (backfill scope creep): N/A — no backfill in Approach A.
--   - HALT 2 (non-synthetic provider affected): does not fire —
--     single exact provider_key match.
--   - HALT 3 (touches tables beyond argument_machine_observation_*):
--     does not fire — single DELETE on the runs table only.
--
-- OPS-001 §4 four-class compliance:
--   Class 1 — Ambiguous column references: not applicable; the DELETE
--     references one column (provider_key) on one table; no subquery,
--     no join.
--   Class 2 — Column type mismatches: provider_key is text;
--     'smoke-mcp:test-server' is a text literal. Match.
--   Class 3 — Implicit ordering dependencies: single statement; no
--     ordering. The FK ON DELETE CASCADE on results.run_id is declared
--     in the original MCP-021B migration (line 102) — Postgres handles
--     the cascade automatically within the same transaction.
--   Class 4 — Function / trigger / extension dependencies: none
--     introduced. No COMMENT ON storage.* statement (PR-003 SQLSTATE
--     42501 boundary preserved).
-- ============================================================

-- ── Single DELETE; CASCADE handles dependent results ───────────
-- The ON DELETE CASCADE on results.run_id → runs.id (declared in
-- 20260526000018_mcp_021b_machine_observation_results.sql line 102)
-- guarantees the 9 result rows are atomically removed in the same
-- transaction. PostgreSQL DELETE is implicitly transactional in a
-- migration; no explicit BEGIN/COMMIT is required (Supabase wraps
-- each migration in a transaction).

DELETE FROM public.argument_machine_observation_runs
WHERE provider_key = 'smoke-mcp:test-server';
-- Expected affected rows: 2 (runs). 9 result rows are removed by
-- the CASCADE FK (verified by post-migration Q11 + Q12 returning 0
-- rows for the synthetic providers).

-- Idempotency proof: a second apply of this migration matches 0
-- rows (because the first apply removed them) and is a no-op.
-- The post-merge smoke verifies this by re-running Q11 + Q12 and
-- confirming zero contamination.
```

### Approach A idempotency proof

- Apply 1: WHERE matches 2 runs → 2 runs deleted → CASCADE deletes 9 results. Final count: 2 runs deleted, 9 results deleted.
- Apply 2: WHERE matches 0 runs (the first apply removed them) → 0 rows affected. **No error, no side effect.**
- The migration is therefore re-runnable without harm. Even on a fresh database where the rows never existed (`npx supabase db reset` against the unified migration history), the DELETE is a no-op and the migration succeeds.

---

## 5. Approach B migration SQL (full text) + Source 6 patch + 14-SQL-file filter list

### 5.a — Migration file

**File:** `supabase/migrations/20260527000020_ops_mcp_test_data_cleanup.sql`

```sql
-- ============================================================
-- Migration: 20260527000020_ops_mcp_test_data_cleanup
-- Description: OPS-MCP-TEST-DATA-CLEANUP — quarantine 11 synthetic
--   test rows (2 runs + 9 results) seeded with
--   provider_key='smoke-mcp:test-server' on 2026-05-26 05:56:33 via a
--   new is_synthetic column. The rows remain queryable for audit but
--   are excluded from all production-mode aggregates and from Source
--   6 rendering at the persistence query layer.
--
-- Card: OPS-MCP-TEST-DATA-CLEANUP
--   - Intent brief: docs/designs/OPS-MCP-TEST-DATA-CLEANUP-intent.md
--   - Design: docs/designs/OPS-MCP-TEST-DATA-CLEANUP.md (Approach B)
-- Operator decision: Stage 2B chose Approach B (quarantine).
--
-- Doctrine encoded:
--   - is_synthetic is a structural fact about the run's provenance,
--     NOT a quality judgment of the underlying argument. Engagement,
--     popularity, and heat remain non-inputs (cdiscourse-doctrine §3).
--   - The column DEFAULT FALSE backfills every existing non-synthetic
--     row to is_synthetic = FALSE. Real production rows are
--     unaffected.
--   - The backfill UPDATE has an idempotency guard (AND is_synthetic
--     = FALSE) so a second apply matches 0 rows.
--
-- Affected rows (Phase A.1 inventory; design §1):
--   - 2 runs receive is_synthetic = TRUE via the UPDATE.
--   - 28 existing non-synthetic runs remain is_synthetic = FALSE
--     (the column DEFAULT covers them at ALTER time).
--   - 0 result rows directly mutated (is_synthetic lives on runs;
--     the JOIN to runs propagates the predicate to result queries).
--
-- HALT trigger evaluation:
--   - HALT 5 (> 11 rows mutated): does not fire — 2 runs updated.
--   - HALT 6 (backfill scope creep): does not fire — backfill is the
--     2 exact runs from the inventory.
--   - HALT 13 (non-backward-compatible schema change): does not fire —
--     NOT NULL DEFAULT FALSE is backward-compatible (existing queries
--     do not need to read the column).
--
-- OPS-001 §4 four-class compliance:
--   Class 1 — Ambiguous column references: not applicable; the UPDATE
--     references one column (provider_key) on one table; no subquery.
--   Class 2 — Column type mismatches: is_synthetic is boolean;
--     DEFAULT FALSE is a boolean literal. provider_key is text;
--     'smoke-mcp:test-server' is a text literal.
--   Class 3 — Implicit ordering dependencies: enforced statement order
--     is (1) ALTER TABLE ADD COLUMN → (2) UPDATE backfill → (3) CREATE
--     INDEX. The UPDATE must follow the ADD COLUMN (the column does
--     not exist before step 1); the INDEX must follow the UPDATE
--     (the index can be built before, but defensively after).
--   Class 4 — Function / trigger / extension dependencies: none.
-- ============================================================

-- ── 1. Add quarantine column ─────────────────────────────────
-- NOT NULL DEFAULT FALSE: every existing non-synthetic row is
-- backward-compatible-defaulted to FALSE. Existing reads do not need
-- to be aware of the column.
ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

-- ── 2. Backfill the 2 known synthetic runs ───────────────────
-- The idempotency guard (AND is_synthetic = false) ensures a second
-- apply matches 0 rows.
UPDATE public.argument_machine_observation_runs
   SET is_synthetic = true
 WHERE provider_key = 'smoke-mcp:test-server'
   AND is_synthetic = false;
-- Expected affected rows: 2.

-- ── 3. Partial index for fast filter ─────────────────────────
-- Partial index — only the small synthetic subset is indexed; the
-- production-row scan path is unchanged.
CREATE INDEX IF NOT EXISTS amor_runs_synthetic_idx
  ON public.argument_machine_observation_runs (is_synthetic)
  WHERE is_synthetic = true;

COMMENT ON COLUMN public.argument_machine_observation_runs.is_synthetic IS
  'OPS-MCP-TEST-DATA-CLEANUP: TRUE if the run was inserted by a '
  'synthetic test seed (smoke-mcp:test-server) and should be excluded '
  'from production aggregates and Source 6 rendering. Defaults to '
  'FALSE for real production rows. cdiscourse-doctrine §1, §10a: '
  'structural fact about the run, never a judgment of the underlying '
  'argument.';
```

### 5.b — Source 6 filter patch (`src/features/nodeLabels/machineObservationPersistenceQuery.ts`)

**Current** (line 120–128):

```ts
const { data, error } = await supabase
  .from('argument_machine_observation_results')
  .select(SELECT_COLUMNS)
  .in('argument_id', ids)
  // MCP-021C-EDGE — filter to production-only runs at the query layer.
  // Admin-validation rows are still persisted in the database (for
  // operator audit) but never reach Source 6 rendering.
  .eq('argument_machine_observation_runs.run_mode', 'production');
```

**Patched** (line 120–131; one chained `.eq()` added before `;`):

```ts
const { data, error } = await supabase
  .from('argument_machine_observation_results')
  .select(SELECT_COLUMNS)
  .in('argument_id', ids)
  // MCP-021C-EDGE — filter to production-only runs at the query layer.
  // Admin-validation rows are still persisted in the database (for
  // operator audit) but never reach Source 6 rendering.
  .eq('argument_machine_observation_runs.run_mode', 'production')
  // OPS-MCP-TEST-DATA-CLEANUP (Approach B) — exclude quarantined
  // synthetic test rows. Defense in depth on top of the run_mode
  // filter.
  .eq('argument_machine_observation_runs.is_synthetic', false);
```

Test S6F-12 added: `query applies .eq("argument_machine_observation_runs.is_synthetic", false)` (mirrors S6F-4).

### 5.c — 14 observability SQL file changes

Every SQL file that aggregates `argument_machine_observation_runs` (whether by direct scan or by JOIN through results) gains an `is_synthetic = FALSE` (or `is_synthetic IS DISTINCT FROM TRUE`) predicate. The full list:

| file | current shape | added predicate location |
| --- | --- | --- |
| `01-runs-by-run-mode.sql` | top-level `from runs` | add `where is_synthetic = false` (no existing WHERE) |
| `02-runs-by-family.sql` | `from runs r INNER JOIN results res` | append `where r.is_synthetic = false` |
| `02b-runs-by-requested-family.sql` | subquery `select … from runs` | append `where is_synthetic = false` to inner subquery |
| `03-runs-by-family-and-status.sql` | subquery `select … from runs` | append `where is_synthetic = false` to inner subquery |
| `04-failure-reasons-by-family.sql` | subquery `select … from runs where status = 'failed'` | append `and is_synthetic = false` |
| `05-positive-results-by-family.sql` | `from results res INNER JOIN runs r` | append `where r.is_synthetic = false` |
| `06-top-positive-raw-keys-by-family.sql` | `from results res INNER JOIN runs r` | append `where r.is_synthetic = false` |
| `07-positive-density-7d.sql` | CTE `recent_runs` from `runs where started_at >= now() - interval '7 days'` | append `and is_synthetic = false` to CTE |
| `08-source-six-safety-row-counts.sql` | `from runs r LEFT JOIN results res` | append `where r.is_synthetic = false` |
| `09-duplicate-runs.sql` | CTE `run_to_family` from `runs r LEFT JOIN results res where r.status = 'success'` | append `and r.is_synthetic = false` to CTE |
| `10-family-a-auto-trigger-recent.sql` | `from runs where run_mode = 'production' and 'parent_relation' = any(requested_families) and completed_at >= now() - interval '7 days'` | append `and is_synthetic = false` |
| `11-family-bc-admin-validation-check.sql` | subquery `select … from runs where status = 'success'` | append `and is_synthetic = false` |
| `12-unsupported-family-attempts.sql` | CTE `supported_families` JOINs runs (already excludes `provider_key LIKE 'smoke-%'`); main query LEFT JOINs runs | append `and r_sf.is_synthetic = false` to `supported_families` CTE; append `and r.is_synthetic = false` to main `left join`'s `on` clause OR to a new WHERE on the outer SELECT |
| `13-over-under-firing-summary.sql` | `from runs r LEFT JOIN results res where r.status = 'success'` | append `and r.is_synthetic = false` |

A new sql-safety test asserts every file in `scripts/ops/sql/` references `is_synthetic` exactly once (or for Q12, exactly twice — once in the CTE and once in the main).

---

## 6. Test plan per approach (Phase A.4)

### 6.a — Approach A test plan (forecast +10)

New test file: `__tests__/opsMcpTestDataCleanupApproachA.test.ts`

| # | test name | what it asserts |
| --- | --- | --- |
| A-1 | `migration file exists at expected path` | `supabase/migrations/20260527000020_ops_mcp_test_data_cleanup.sql` is on disk |
| A-2 | `migration file header references the card + intent brief + smoke chain` | header contains `OPS-MCP-TEST-DATA-CLEANUP`, intent-brief path, the 4 predecessor SHAs (19b8d8a, e060eef, 0e98c27, d500037) |
| A-3 | `migration contains exactly one DELETE statement` | scan: exactly 1 `DELETE` keyword; no `INSERT`, no `UPDATE`, no `ALTER`, no `DROP`, no `CREATE` |
| A-4 | `DELETE targets exactly public.argument_machine_observation_runs` | the `FROM` clause names that table; no other table |
| A-5 | `WHERE uses single exact provider_key match` | the WHERE is exactly `provider_key = 'smoke-mcp:test-server'`; NOT `LIKE 'smoke-%'`; NOT `IN (...)`; NOT a pattern |
| A-6 | `idempotency: SQL has no DELETE without WHERE` | guard against accidental table truncation |
| A-7 | `no PII or argument body content in migration text` | grep migration text for `'@'`, common name patterns, body-shaped strings — should find none |
| A-8 | `no verdict tokens in migration header` | grep for the standard verdict ban-list; should find none |
| A-9 | `cleanup never touches the flags table` | grep migration text for `flags` (case-insensitive) — should find none |
| A-10 | `cleanup never touches public.arguments` | grep migration text for `public.arguments` or `arguments(id)` (case-insensitive) — should find none |

Existing `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` continues to pass (Q12 SQL unchanged in Approach A).
Existing `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` continues to pass (Source 6 unchanged in Approach A).

**Post-merge smoke phase 2** re-runs Q11 + Q12 against the linked DB and asserts:
- Q11: 0 `misunderstanding_repair` production rows (was 1 pre-cleanup).
- Q12: 0 rows (was 2 rows = 3 positives total pre-cleanup).
- Non-synthetic counts unchanged (28 runs / 34 results pre-cleanup; same post-cleanup minus the inventory).

### 6.b — Approach B test plan (forecast +25)

New test files:

1. `__tests__/opsMcpTestDataCleanupApproachBMigrationShape.test.ts` — migration file structure
2. `__tests__/opsMcpTestDataCleanupApproachBSqlFilters.test.ts` — every observability SQL file has the predicate
3. `__tests__/opsMcpTestDataCleanupApproachBSourceSixSyntheticFilter.test.ts` — Source 6 patches in the `.eq()` chain

| # | file | test name | what it asserts |
| --- | --- | --- | --- |
| B-1 | migration shape | `migration file exists` | path correct |
| B-2 | migration shape | `migration contains ALTER TABLE ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false` | shape correct |
| B-3 | migration shape | `migration contains UPDATE with provider_key = 'smoke-mcp:test-server' AND is_synthetic = false` | idempotent backfill |
| B-4 | migration shape | `migration contains CREATE INDEX IF NOT EXISTS amor_runs_synthetic_idx … WHERE is_synthetic = true` | partial-index shape |
| B-5 | migration shape | `migration header references card + intent brief + 4 predecessor SHAs` | doc convention |
| B-6 | migration shape | `no verdict tokens or PII in migration text` | doctrine |
| B-7 | sql filters | `every file in scripts/ops/sql/ references is_synthetic` | 14 files (with Q12 having 2 references) |
| B-8 | sql filters | `01-runs-by-run-mode.sql contains is_synthetic = false predicate` | per-file |
| B-9..B-19 | sql filters | … one per file 02 through 13 (11 tests, since Q12 has 2 references shown in B-20) | per-file |
| B-20 | sql filters | `Q12 supported_families CTE retains both provider_key NOT LIKE 'smoke-%' AND is_synthetic = false predicates` | defense in depth |
| B-21 | Source 6 | `query chain contains .eq("argument_machine_observation_runs.run_mode", "production") AND .eq("argument_machine_observation_runs.is_synthetic", false)` | both filters |
| B-22 | Source 6 | `Source 6 production filter literal is byte-equal preserved` | regression guard |
| B-23 | Source 6 | `S6F-12 new test: .eq for is_synthetic is present and value is false (boolean literal, not string "false")` | type discipline |
| B-24 | doctrine | `no verdict tokens in any new SQL` | doctrine |
| B-25 | doctrine | `is_synthetic is documented as structural, not judgment (header comment scan)` | doctrine §1/§10a |

Existing tests:
- `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` is **modified** — the existing tests stay green; one new test asserts the `is_synthetic` predicate is present in the CTE.
- `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` is **modified** — the existing S6F tests stay green; new S6F-12 asserts the `is_synthetic` filter is chained.

**Post-merge smoke phase 2** re-runs Q11 + Q12 and Source 6 simulation:
- Q11: 0 contamination (because the predicate excludes is_synthetic = TRUE).
- Q12: 0 rows.
- Source 6 simulation: a query that includes the 2 synthetic argument_ids returns 0 rows (because the runs are quarantined).
- Q5 / Q13 still count the non-synthetic rows correctly (28 runs / 34 results match pre-cleanup non-synthetic totals).

---

## 7. Read-only boundary list (locked files)

Both approaches honor the following invariants:

### Files NEVER touched (any approach)

- `public.arguments` — never INSERT, UPDATE, DELETE
- `public.debates` — never touched
- `public.profiles` — never touched
- `public.flags` — never touched (cdiscourse-doctrine §8: flags never delete)
- `mcp-server/lib/familyRegistry.ts` (HALT 7)
- `supabase/functions/*` — no Edge Function logic change (HALT 8)
- `supabase/functions/_shared/booleanObservations/*` — no taxonomy or prompt change (HALT 10)
- `src/lib/constitution/engine.ts` — never touched (constitution sacred per cdiscourse-doctrine §5)
- All other `src/` files (HALT 9), with **one exception** for Approach B: `src/features/nodeLabels/machineObservationPersistenceQuery.ts` line 127 (intent brief §10 permits a single chained `.eq()` addition for this card only)

### Files NEVER touched in Approach A specifically

- `src/features/nodeLabels/machineObservationPersistenceQuery.ts` (no need; cleanup is data-only)
- All 14 observability SQL files (no need; cleanup is data-only)
- Existing tests are not modified; only new tests are added

### Files touched in Approach B specifically

- Migration file (1)
- `src/features/nodeLabels/machineObservationPersistenceQuery.ts` (1; single chained `.eq()` addition)
- `scripts/ops/sql/*.sql` (14 files)
- 3 new test files
- Existing `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` and `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` (1 new test each)

---

## 8. HALT trigger evaluation (all 18 from intent brief §6)

### Registry + data safety (1-6)

| # | trigger | evaluation |
| --- | --- | --- |
| 1 | Q12-SEMANTIC-TIGHTENING smoke missing from main | PASS — verified at `19b8d8a`. |
| 2 | DELETE touches rows from non-synthetic providers | PASS (A) — single exact provider_key match. N/A (B) — no DELETE. |
| 3 | Migration touches tables beyond `argument_machine_observation_*` | PASS (both) — A touches only runs (results via CASCADE); B touches only runs. |
| 4 | Source 6 filter change weakens production-only behavior | N/A (A) — no touch. PASS (B) — adds defense-in-depth `is_synthetic = false`; never removes or weakens the existing `run_mode = 'production'` filter. |
| 5 | Migration deletes / updates > 11 rows | PASS (A) — exact 11. PASS (B) — exact 2 (the UPDATE; no DELETE). |
| 6 | Backfill query covers more rows than declared | N/A (A). PASS (B) — backfill matches the inventory exactly. |

### Protocol + security (7-10)

| # | trigger | evaluation |
| --- | --- | --- |
| 7 | Registry change proposed | PASS (both) — no `mcp-server/lib/familyRegistry.ts` touch. |
| 8 | Edge Function change proposed | PASS (both) — no `supabase/functions/*` touch. |
| 9 | UI change proposed | PASS (A) — no `src/*` touch at all. PASS (B) — single chained `.eq()` at the Source 6 persistence query layer, explicitly authorized by intent brief §10. |
| 10 | Taxonomy or prompt change proposed | PASS (both) — no taxonomy or prompt touch. |

### Architecture (11-14)

| # | trigger | evaluation |
| --- | --- | --- |
| 11 | Approach A chosen without Stage 2B operator approval | **PENDING** — fires if implementer proceeds with Approach A before operator's explicit Stage 2B choice. The designer's recommendation in §3 is advisory only; it does NOT constitute approval. |
| 12 | Approach B chosen without Stage 2B operator approval | **PENDING** — same as #11 but for Approach B. |
| 13 | Schema migration introduces non-backward-compatible change | PASS (A) — no schema change. PASS (B) — `NOT NULL DEFAULT FALSE` is backward-compatible. |
| 14 | Test forecast > +60 | PASS (A) — +10. PASS (B) — +25. |

### Doctrine (15-16)

| # | trigger | evaluation |
| --- | --- | --- |
| 15 | Verdict tokens in user-facing strings | PASS (both) — design has no user-facing strings; migration/SQL files have no verdict tokens (defensive ban-list test added). |
| 16 | PII or argument body content in cleanup migration / test output | PASS (both) — migration uses only UUIDs in comments; tests assert no body content; the 2 target argument rows are referenced only by UUID, never by body or author info. |

### Working tree (17-18)

| # | trigger | evaluation |
| --- | --- | --- |
| 17 | Unclassified untracked files at PR creation | DEFER — implementer's responsibility; the 10 known operator-territory files (testing-runs, mcp021c-edge-smoke-*, netlify-prod.git, phase5-*) are pre-existing and known. |
| 18 | Backfill/cleanup script committed to scripts/ instead of supabase/migrations/ | PASS (both) — design specifies the change as a migration file at `supabase/migrations/20260527000020_ops_mcp_test_data_cleanup.sql`, not a script. |

**Active HALT triggers at design time: 0. Pending HALT triggers (fire only after implementer starts without operator approval): 11 and 12.**

---

## 9. Brief ledger — orchestrator-authored brief interpretive notes

The intent brief is operator-authored and binding. The designer's interpretive judgments and resolution defaults applied during Phase A:

| section | source | interpretive judgment / default applied |
| --- | --- | --- |
| §1 row inventory | operator-authored (binding) | Live DB re-verification confirmed exact match; no deviation. |
| §3 binary A/B choice | operator-authored (binding) | Designer recommends A; rationale in §3. Stage 2B operator decides. |
| §3 Approach A SQL outline | operator-authored | Full SQL written; idempotency proof added; OPS-001 four-class compliance documented. |
| §3 Approach B SQL outline | operator-authored | Full SQL written; the brief's outline used `BEGIN; … COMMIT;` framing — designer dropped the explicit transaction wrapping because Supabase migrations are implicitly wrapped in a transaction (consistent with the existing 19 migrations in the repo, none of which use explicit BEGIN/COMMIT). |
| §3 Approach B Source 6 patch | operator-authored | Designer rendered the exact diff (one chained `.eq()` line at `machineObservationPersistenceQuery.ts:127`). |
| §3 Approach B 14-SQL file list | operator-authored (binding count: 14) | Designer enumerated every file with a specific predicate placement. |
| §4 Stage 2B operator decision | operator-authored (binding) | Designer surfaces the binary choice and explicitly does NOT make it. |
| §6 HALT triggers 11, 12 | operator-authored | Marked PENDING — fires if implementer starts without operator approval. |
| §7 Phase A audits | operator-authored | All 4 executed: A.1 live DB; A.2 trade-off table; A.3 full migration SQL for both; A.4 test plan for both. |
| §8 test forecast | operator-authored (binding ceiling: +60) | Designer adopts: A = +10; B = +25. Both well clear of HALT 14. |
| §9 5-phase smoke plan | operator-authored | Designer flags one ambiguity for the implementer: Phase 3 Source 6 verification is only applicable to Approach B; if Approach A is chosen, Phase 3 is skipped. Designer recommends adding a Phase 3-A "verify Q11 + Q12 return 0 rows" check that applies to both approaches. |
| §10 authorizations on PASS | operator-authored | No designer judgment required; the implementer + reviewer surface the PASS outputs. |

**Open questions for the operator beyond the binary A/B choice:**

1. **Smoke plan Phase 3 ambiguity.** The intent brief §9 Phase 3 says "Source 6 verification (Approach B only)". The designer recommends the smoke plan additionally include a Phase 3-A check ("re-run Q11 + Q12 against linked DB and confirm zero contamination") that applies to BOTH approaches. This gives the operator a binary verification gate independent of which approach was chosen. The designer drafted this in §6 post-merge smoke text above; the operator should confirm whether to include it explicitly in the implementer's smoke plan or leave the brief's Phase 3 wording binding.

2. **Future-leak follow-on card.** If Approach A is chosen, the operator may want to immediately file `OPS-MCP-INSERT-GUARDRAILS` (or similar) to add an insert-time CHECK that rejects `provider_key LIKE 'smoke-%'` outside of admin_validation runs. This is out of scope for OPS-MCP-TEST-DATA-CLEANUP but a natural follow-on. Approach B's `is_synthetic` column partially achieves this but only after-the-fact.

3. **`netlify-prod.git` and other operator-territory untracked files.** Not relevant to this card, but flagged: 10 untracked files are in the working tree at design time (per `git status --short`). These are operator-territory and must remain unstaged through implementer's commit. The implementer's smoke audit step 1 should confirm `git status --short` shows only these 10 entries plus the new audit doc.

---

## 10. Operator steps (post-merge deploy)

Once the operator picks A or B at Stage 2B and the PR squash-merges:

- The Supabase GitHub integration **auto-applies** the migration on merge to main (per `docs/core/CLAUDE.md` — "Supabase merge auto-deploy"). No manual `npx supabase db push --linked` is needed.
- Approach A: no Edge Function deploy required (no function change).
- Approach B: no Edge Function deploy required (no function change; Source 6 src/ change is client code, bundled in the next Expo build).
- The post-merge smoke audit at `docs/audits/OPS-MCP-TEST-DATA-CLEANUP-SMOKE-2026-05-27.md` runs the observability report and confirms Q11 + Q12 are clean.

---

## 11. Risks for the implementer

### A — Hard delete risks

- **R-A1: WHERE clause typo.** A single typo in `'smoke-mcp:test-server'` could match 0 rows (silent no-op) or — if a future `LIKE` is mistakenly introduced — match more than the inventory. The test A-5 (exact-match assertion) defends against this.
- **R-A2: CASCADE behavior change.** If a future migration alters the FK from `ON DELETE CASCADE` to something else, the cleanup would leave orphan result rows. Today's schema (verified at migration 18 line 102) is correct. Test A-3 (single DELETE; no ALTER) keeps the migration's contract narrow.
- **R-A3: Apply-twice masking.** If apply-2 fails for some unrelated reason (network, permission), the migration history could end up in a state where the cleanup is partial. Mitigation: the DELETE is atomic within a transaction; partial apply is impossible.

### B — Quarantine risks

- **R-B1: SQL-file predicate drift.** 14 SQL files all need a consistent predicate; a future SQL author may forget. Test B-7 (every file references `is_synthetic`) defends now but is not enforced for future-added files. The implementer should document the convention in `scripts/ops/README.md` (if one exists) or add a SQL-safety test pattern that any new file in `scripts/ops/sql/` must reference `is_synthetic`.
- **R-B2: Source 6 chain depth.** Each chained `.eq()` adds a JOIN constraint at the PostgREST layer. Three filters (`run_mode`, `is_synthetic`, plus the existing implicit JOIN) are well within PostgREST's capacity, but a future card that adds a 4th or 5th chained filter should re-evaluate.
- **R-B3: NOT NULL DEFAULT FALSE lock time.** On the current data volume (30 runs, ~43 result rows), ALTER TABLE ADD COLUMN NOT NULL DEFAULT FALSE completes in milliseconds. If the table grows to millions of rows before this migration is applied to a fresh database, the rewrite could lock for longer. Today: irrelevant.

### Shared risks (both approaches)

- **R-S1: Working-tree discipline at implementer commit time.** The 10 known operator-territory untracked files must NOT be accidentally staged. The implementer's commit step should explicitly enumerate the files being staged (the migration + tests + optionally Source 6 patch + 14 SQL files).
- **R-S2: Auto-deploy timing.** The Supabase GitHub integration applies the migration shortly after merge. If the smoke audit step 2 runs the observability report before the migration has applied, it would see the contamination still present. Mitigation: the smoke audit should explicitly confirm the migration is applied before running the report (e.g., `npx supabase migration list --linked` or a SELECT against the table to confirm 0 / 28 rows respectively for A / B).

---

## 12. Out of scope

- Q9 idempotency hardening — separate card `OPS-MCP-IDEMPOTENCY-HARDENING`.
- Family D / E / F / G / H / I / J registration.
- Auto-trigger changes.
- Edge Function logic changes.
- MCP server changes.
- Taxonomy or prompt changes.
- Insert-time CHECK constraint (`provider_key NOT LIKE 'smoke-%'`) — natural follow-on card.
- Any data deletion beyond the 11-row inventory.
- New observability sections / queries.
- Realtime channel for Machine Observation rows (deferred to a future card).

---

## 13. Doctrine self-check

- **cdiscourse-doctrine §1 (Score is gameplay analysis, never truth):** PASS. This is a data-cleanup migration. No score is touched. No truth label is assigned.
- **cdiscourse-doctrine §3 (Popularity is not evidence):** PASS. The cleanup removes synthetic observation rows that carried no engagement / popularity signal anyway.
- **cdiscourse-doctrine §4 (AI moderator hard limits):** PASS. No AI moderator change.
- **cdiscourse-doctrine §5 (Rules engine is sacred):** PASS. `src/lib/constitution/engine.ts` is not touched.
- **cdiscourse-doctrine §6 (Secrets policy):** PASS. No secret referenced; no service-role key referenced; no Edge Function deploy required.
- **cdiscourse-doctrine §7 (No AI calls from production app):** PASS. No new code path; certainly no AI call.
- **cdiscourse-doctrine §8 (Supabase conventions):**
  - **Soft-delete only for `arguments`:** PASS. This migration touches `argument_machine_observation_runs` (an observation/audit table), NOT `public.arguments`. The doctrine soft-delete rule applies specifically to argument rows.
  - **Flags rows never delete:** PASS. The `flags` table is not touched.
  - **RLS always on:** PASS. No RLS change in either approach.
  - **Migrations append-only:** PASS. New numbered migration file `20260527000020_ops_mcp_test_data_cleanup.sql`; no edit to any existing migration.
- **cdiscourse-doctrine §9 (Plain language for users):** PASS. Migration is operator-facing; no user-facing string change.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** PASS. The Machine Observation taxonomy and the production-only Source 6 contract are preserved. Approach B adds a structural fact (`is_synthetic`) about a run's provenance — explicitly NOT a quality judgment of the underlying argument (header comment encodes this).
- **cdiscourse-doctrine §10 (v1 scope guards):** PASS. No voting, no real-time edit, no OAuth, no public API, no push, no search.
- **supabase-edge-contract:** PASS. No service-role usage. No new Edge Function. No new RLS policy. Migration append-only and idempotent.
- **test-discipline:** PASS. Test forecast +10 (A) or +25 (B); both clear the +60 HALT ceiling. New test files include doctrine ban-list assertions per the standard pattern.
- **supabase-postgres-best-practices:** PASS. Approach A uses a single targeted DELETE with an indexed-friendly WHERE (provider_key is not currently indexed, but the row count is tiny — full-scan is acceptable). Approach B adds a partial index on `is_synthetic` for the small synthetic subset. Both backward-compatible.

---

## 14. Deploy step (operator)

Supabase merge auto-deploy applies the migration. No manual operator command required for the migration. The implementer's smoke audit confirms the migration applied. **None — pure data-only migration; auto-deployed by Supabase on merge.**
