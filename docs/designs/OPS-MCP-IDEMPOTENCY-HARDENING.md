# OPS-MCP-IDEMPOTENCY-HARDENING — design document

**Status:** Design draft (Stage 2B operator-decision pending)
**Epic:** OPS — operational integrity
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/326
**Branch:** `feat/OPS-MCP-IDEMPOTENCY-HARDENING`
**Intent brief:** `docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING-intent.md` (binding)
**Designer skill stack invoked:** `cdiscourse-doctrine`, `test-discipline`, `supabase-edge-contract`
**Predecessor SHAs:**
- `b8ce07b` — OPS-MCP-TEST-DATA-CLEANUP-SMOKE PASS (synthetic rows removed)
- `19b8d8a` — OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE PASS (Q12 clean)
- `0e98c27` — OPS-MCP-OBSERVABILITY-SMOKE PARTIAL (originated Q9 finding)
- `e281753` — MCP-021C-AUTO-TRIGGER-FAMILY-A production-live
- `785ceb0` — operator-authored intent brief (this card's HEAD baseline)

---

## 1. Scope reality (live RCA + table state snapshot)

### 1.1 Worktree state

- HEAD: `785ceb0` (operator-authored intent brief)
- Branch: `feat/OPS-MCP-IDEMPOTENCY-HARDENING`
- Working tree: clean except 10 known operator-territory untracked files (RCA SQL artifact removed before commit)
- Baseline gates pre-design:
  - `npm run typecheck`: exit 0
  - `npm run lint`: exit 0
  - `npm run test`: 17,853 / 561 suites passing (Jest)

### 1.2 Live DB state (Phase 0 re-verification)

Re-ran `scripts/ops/sql/09-duplicate-runs.sql` against the linked Supabase project at design time. **Three duplicate-run pairs surface, unchanged from the intent brief §1 inventory.** All three involve `family=parent_relation`, `provider_key=mcp:classify_argument_boolean_observations`, `model_name=operator-mcp-server`, `schema_version=mcp-021.machine-observations.boolean.v1`:

| Pair | argument_id | run_mode | run 1 (started_at) | run 2 (started_at) | gap | run 1 / 2 ids |
|---|---|---|---|---|---|---|
| 1 | `781f8057-9e2a-…` | `admin_validation` | `2026-05-27 02:03:37` | `2026-05-27 10:29:26` | 8h 26m | `67431fe3-…` / `c8f09f4d-…` |
| 2 | `db0de3e0-24c6-…` | `admin_validation` | `2026-05-27 02:03:43` | `2026-05-27 10:29:31` | 8h 26m | `f370e813-…` / `0263205e-…` |
| 3 | `ea82a836-f5d2-…` | **`production`** | `2026-05-27 05:17:04` | `2026-05-27 05:19:15` | **2m 11s** | `a416c21a-…` / `7ea35268-…` |

Pair 3 is the BINDING production-mode finding. The 2m 11s gap (vs Pairs 1+2's 8h 26m) is consistent with a single test session, not a cross-session re-smoke.

### 1.3 Schema state — what UNIQUE / idempotency constraints exist today

Per `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`:
- `argument_machine_observation_runs`: **no UNIQUE constraint beyond `id` PRIMARY KEY**. No business-key UNIQUE.
- `argument_machine_observation_results`: UNIQUE `(run_id, raw_key)` — prevents duplicates within a single run, but not across runs.

Per `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`:
- `run_mode` column added with CHECK `('production' | 'admin_validation')`. No new UNIQUE.

Per `supabase/migrations/20260516000001_initial_schema.sql`:
- `arguments` table: no UNIQUE constraint that would prevent two argument rows with identical body / parent_id / debate_id / author_id.
- Per `supabase/migrations/20260516000005_stage5_session_scalability.sql`: UNIQUE `(author_id, client_submission_id) WHERE client_submission_id IS NOT NULL` — idempotency by client-supplied UUID only. This is the existing submit-argument idempotency surface (see §2.3 below).

**There is no DB-level uniqueness preventing two production-mode runs for the same argument.** All three pairs sit in this gap.

### 1.4 The two production-mode run-creation paths

Source-code inspection (verified against `supabase/functions/`):

1. **Path A — auto-trigger** (`submit-argument` Edge Function → `autoTriggerDispatcher.ts`):
   - Fires on every successful argument INSERT in the submit-argument tail (lines 787-794).
   - Always invokes the dispatcher in mode `'production'` (`AUTO_TRIGGER_MODE = 'production'` at dispatcher line 69).
   - **HAS an idempotency pre-check** at dispatcher lines 232-248: queries for an existing run with `status='success'` for the same (argument_id, schema_version, run_mode, provider_key, requested_families) tuple. If found, returns `outcome: 'already_classified'` without invoking the classifier or creating a new run row.
   - Has a bounded retry loop (max 2 attempts) that creates a NEW run row on each retry — but only retries on retryable failure classes (`mcp_network_error`, `mcp_api_error`, `mcp_rate_limited`).

2. **Path B — admin HTTP endpoint** (`classify-argument-boolean-observations` Edge Function):
   - Admin-gated (`requireAdmin`) for both `production` and `admin_validation` modes.
   - Per `classifyArgumentCore.ts` and the Edge handler at `classify-argument-boolean-observations/index.ts:246-270`: **no idempotency check**. Every successful invocation creates a new run row.
   - The MCP-021C-AUTO-TRIGGER-FAMILY-A smoke audit at `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md` Phase 6 documents this as "Idempotency PASS (by design) — manual Edge path benign by design".

---

## 2. Phase A.1 RCA findings (per-pair root-cause analysis with file/line evidence)

### 2.1 Pair 1 — argument `781f8057-…` (admin_validation, 8h 26m gap)

**Root cause: CAUSE C — Test-driven duplicate (operator-initiated admin_validation smoke re-run across two sessions).**

Evidence:
- **First run `67431fe3-…`** at `2026-05-27 02:03:37 UTC` is documented in `docs/audits/MCP-021C-EDGE-SMOKE-2026-05-26.md` Phase 3.2 line 180. The audit explicitly lists run id `67431fe3-…` against argument `781f8057-…` with `run_mode=admin_validation, status=success, requested_families=["parent_relation"]`. This is the operator-driven MCP-021C-EDGE admin_validation smoke.
- **Second run `c8f09f4d-…`** at `2026-05-27 10:29:26 UTC` is documented in `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md` Phase 3.4 line 192. The audit explicitly lists run id `c8f09f4d-…` against argument `781f8057-…` with `run_mode=admin_validation`. This is the operator-driven OPS-MCP-FAMILY-VALIDATOR-REFACTOR admin_validation smoke.
- The 8h 26m gap matches a cross-session operator audit cadence (early-morning smoke session followed by late-morning smoke session same day).
- Both audits ran against the same seeded argument set with `mode=admin_validation`; neither audit was unaware of the other — the SECOND audit's purpose was to verify Family A behavior is preserved after a refactor.

Interpretation: this is **expected operator behavior** — admin_validation is by design a re-runnable audit path. The pair is a Q9 signal artifact, not a system defect.

### 2.2 Pair 2 — argument `db0de3e0-…` (admin_validation, 8h 26m gap)

**Root cause: CAUSE C — Test-driven duplicate (same root cause as Pair 1, paired one-to-one with the same two audits).**

Evidence:
- **First run `f370e813-…`** at `2026-05-27 02:03:43 UTC` is documented in `docs/audits/MCP-021C-EDGE-SMOKE-2026-05-26.md` Phase 3.2 line 181 — same MCP-021C-EDGE admin_validation smoke as Pair 1, against the same 3-argument seed set (`f41b18b0` + `781f8057` + `db0de3e0`).
- **Second run `0263205e-…`** at `2026-05-27 10:29:31 UTC` is documented in `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md` Phase 3.4 line 193 — same OPS-MCP-FAMILY-VALIDATOR-REFACTOR admin_validation smoke as Pair 1.

Interpretation: identical pattern to Pair 1, same operator-audit pair, same Q9 signal artifact.

### 2.3 Pair 3 — argument `ea82a836-…` (production, 2m 11s gap) — BINDING

**Root cause: CAUSE C — Test-driven duplicate (operator-initiated production-mode idempotency smoke).**

This is the central finding of the RCA and contradicts the operator's pre-RCA hypothesis (which suspected Cause A or Cause D-light for Pair 3).

Evidence:
- **Argument row `ea82a836-…` was created at `2026-05-27 05:17:03.701 UTC`**, depth 2 counter-rebuttal under parent `781f8057-…`. This is the seeded argument from the MCP-021C-AUTO-TRIGGER-FAMILY-A production-live smoke per `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md` Phase 2.
- **First run `a416c21a-…`** at `2026-05-27 05:17:04.447 UTC` (0.74 seconds after argument creation) is documented at the same audit Phase 3, lines 130-146. The audit explicitly lists `run_id=a416c21a-…, run_mode=production, status=success, started_at=2026-05-27 05:17:04.447 UTC, duration=5.01 s`. This is the **expected auto-trigger fire**, dispatched from `submit-argument`'s post-insert tail via `EdgeRuntime.waitUntil(dispatchAutoTriggerForArgument(...))`.
- **Second run `7ea35268-…`** at `2026-05-27 05:19:15.911 UTC` (132 seconds after argument creation) is documented at the same audit Phase 6, lines 210-234. The audit explicitly says:
  > "Re-fired classification by invoking the `classify-argument-boolean-observations` Edge Function directly with `argumentIds=['ea82a836-…']`. … Returned `runId`: `7ea35268-…` (NEW, ≠ Phase 3's `a416c21a-…`). DB state after duplicate: 2 production rows for `ea82a836-…`, both `status=success`."

The same audit document then concludes:
> "Source inspection of `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` reveals that idempotency is implemented at the dispatcher path only … The Edge Function (`classify-argument-boolean-observations`) is the manual operator endpoint and is **not** idempotent by design."

And the audit's verdict matrix (line 377): **"Idempotency PASS (by design)"**.

Interpretation: **Pair 3 is the deliberate output of Phase 6 of the auto-trigger smoke**, executed in production mode. The operator manually fired the admin classifier Edge Function with `mode=production` for an argument that had already received an auto-trigger run, in order to TEST whether the dispatcher's idempotency pre-check would refuse a second classification. The dispatcher's pre-check did refuse (the second run came from the admin HTTP path, which bypasses the dispatcher entirely), so the smoke verdict was "PASS by design". The Q9 finding is the artifact of that deliberate smoke action.

**Pair 3 is NOT a system race, NOT a user-driven duplicate, NOT a retry loop side effect.** It is a deliberate operator action documented in the audit at design time.

### 2.4 Cause hierarchy ranked by evidence strength

| Cause | Pair 1 | Pair 2 | Pair 3 (BINDING) |
|---|---|---|---|
| **C — Test-driven** | **PRIMARY** (cross-session audit re-runs) | **PRIMARY** (cross-session audit re-runs) | **PRIMARY** (Phase 6 idempotency-smoke deliberate re-fire) |
| A — User-driven | Ruled out (admin_validation is not a user surface) | Ruled out (same reason) | Ruled out (no evidence of two user submissions; second run is from admin HTTP path, not submit-argument) |
| B — Retry-driven | Ruled out (Run 1 succeeded; no retry loop fires on success) | Ruled out (same) | Ruled out (Run 1 succeeded with status=success in 5.01s; dispatcher retry loop only fires on failure) |
| D — Race condition | Ruled out (8h 26m gap impossible for any race) | Ruled out (same) | Ruled out (2m 11s gap from independent invocation paths, not concurrent racing isolates) |
| E — Key collision | Ruled out (input_hash determinism is by design; the hash is an audit artifact, not a uniqueness key) | Ruled out (same) | Ruled out (same) |

**RCA verdict: ALL THREE pairs are CAUSE C — Test-driven duplicates, attributable to deliberate operator smoke actions documented in committed audit files.**

### 2.5 What this RCA does NOT say

- It does NOT say the auto-trigger dispatcher's idempotency check is broken. The check works as designed — the audit verifies this end-to-end at Phase 3 → Phase 6 transitions.
- It does NOT say there is a current production-traffic bug. There is no evidence of any non-operator-initiated duplicate in production.
- It does NOT say the OPS-MCP-IDEMPOTENCY-HARDENING card is unnecessary. It says the card's MOTIVATION shifts: from "fix a production bug" to "harden against an admitted gap so future smokes/admin actions don't manufacture Q9 signal artifacts AND future legitimate races (Scenario X5 below) cannot create duplicates either".

### 2.6 Latent risks that the RCA also surfaces

Even with Cause C identified, the RCA exposes two latent risks that operator-mode hardening can address:

1. **Scenario X1 — admin re-run creates production-mode duplicate.** Any admin who invokes the `classify-argument-boolean-observations` Edge Function with `mode=production` for an argument that already has a successful production run creates a new run row. This is the Pair 3 mechanism. While the operator audit treats this as "benign by design", it pollutes Q9 telemetry and contradicts the idempotency posture documented for the dispatcher path.

2. **Scenario X5 — network-level retry race.** If two parallel `submit-argument` calls land for the same `client_submission_id` AND one's idempotency pre-check sees the other's row before the other's auto-trigger has persisted a run, both dispatcher invocations could pass the pre-check (TOCTOU window). Today: zero evidence in 3 pairs. The dispatcher's source explicitly acknowledges this race at lines 41-48 and documents it as "race-tolerant" because Source 6 dedupes by raw_key. However, Q9 telemetry surfaces this race as a duplicate, even if Source 6 silently filters it.

A DB-level UNIQUE constraint on the `(argument_id, family, run_mode, schema_version, provider_key)` tuple — or an Edge-Function-level idempotency check that ALSO protects Path B — closes both gaps.

---

## 3. Phase A.2 Fix proposal (chosen approach + alternative rejected)

### 3.1 Chosen approach — **Hybrid: DB partial UNIQUE constraint + Edge-level graceful handling at BOTH paths**

A two-layer fix:

**Layer 1 — DB partial UNIQUE INDEX (new migration):**

A partial UNIQUE INDEX on `public.argument_machine_observation_runs` over the tuple `(argument_id, schema_version, provider_key, run_mode, requested_families)` where `status = 'success'`. The partial predicate is critical:
- Successful runs are the canonical artifact. Failed runs MUST remain duplicable (retries create new failed rows; this is intentional).
- The dispatcher's idempotency check returns `already_classified` ONLY on `status='success'`; partial uniqueness mirrors that semantic.
- Backward compatibility: the 3 existing duplicate pairs (all `status=success`) violate the constraint. **The migration uses `CREATE UNIQUE INDEX … WHERE status='success' AND created_at > '<cutoff>'`** — a future-prevention cutoff that admits the 3 historical pairs while preventing new duplicates. The cutoff is the migration's apply time; this is documented in the migration header.

`requested_families` is a `text[]` array. Postgres supports a btree UNIQUE index over an array column (the array is compared element-by-element after normalization). However, to preserve element-order independence (the dispatcher always sends `['parent_relation']` but a future caller could send a permutation), the index uses an expression that sorts the array: `array(SELECT unnest(requested_families) ORDER BY 1)`. The dispatcher already sorts in `buildBooleanObservationInputHash` (`booleanObservationRequestBuilder.ts:140` — `[...input.families].sort().join(',')`), so this is a consistent pattern.

**Layer 2 — Edge-Function-level graceful handling at BOTH paths:**

- **Path A (`autoTriggerDispatcher.ts`):** the existing pre-check is preserved. The new behavior is: if `persistRun` returns a UNIQUE-violation error (Postgres SQLSTATE `23505`), the dispatcher catches it, logs a `'skipped' / 'unique_violation'` outcome, and returns gracefully. Without this catch, the run insert would surface as a generic `persist_run_failed` and the auto-trigger would record `outcome=failed` with `failureReason='persistRun_failed:23505'`, which would pollute Q3 (runs-by-family-and-status) with phantom failures. The catch turns the constraint hit into a clean structural skip.

- **Path B (`classify-argument-boolean-observations/index.ts`):** add a **pre-INSERT idempotency check** mirroring the dispatcher's pattern, gated by a new optional request-body parameter `forceRerun: boolean` (default `false`). When `mode === 'production'` AND `forceRerun !== true` AND a successful production run already exists, the per-argument summary returns `status: 'skipped_already_classified'` with the existing `runId`. When `forceRerun === true`, the call proceeds (admin override; intentional re-run for audit / debugging; the DB constraint's partial-cutoff predicate admits the new row). For `mode === 'admin_validation'`, the check does NOT fire — admin_validation is the operator audit surface and must remain re-runnable by design.

This preserves Family A auto-trigger production behavior (HALT trigger 18) and Path B's pre-existing admin/audit posture.

### 3.2 Why this combined approach

- **DB partial UNIQUE catches all paths** — if a future code change introduces a third invocation path (e.g., a backfill script), the DB constraint prevents the duplicate at the storage layer regardless of where the call originates.
- **Edge-level graceful handling at Path B** prevents the constraint from manifesting as a user-visible 500 error on admin re-runs — the admin gets a clean `status: 'skipped_already_classified'` instead of a constraint-violation message.
- **Edge-level graceful handling at Path A** keeps Q3 telemetry clean — TOCTOU races between concurrent auto-triggers (Scenario X5) surface as structural skips in Q9-like queries, not as `persistRun_failed:23505` phantom failures.
- **Partial-cutoff predicate** is the brief's required §8 backward-compat posture for the 3 existing historical duplicates.

### 3.3 Alternative considered + rejected

**Alternative: Edge-Function-only idempotency check at Path B (no DB constraint).**

Rejection reasoning:
- Does not catch Scenario X5 (network-level retry race) because both checks run before either persists. The pre-check sees no row in both isolates; both proceed.
- Does not catch a future third invocation path (e.g., a backfill script that bypasses both Edge Functions and writes directly via service-role).
- Solves only Pair 3's specific Cause C path but leaves the latent race window unaddressed.
- Cheaper (~10 lines change to the Edge handler; no migration) but the cost differential is small and the DB constraint is the canonical pattern for content-identity uniqueness in this codebase (`UNIQUE (run_id, raw_key)` on the results table is a direct precedent).

**Alternative: DB UNIQUE constraint with no partial-cutoff predicate.**

Rejection reasoning:
- The 3 existing duplicate pairs would fail the constraint at migration time. The brief explicitly states the migration MUST NOT delete existing run rows (HALT trigger 7) and MUST treat the 3 pairs as historical (intent brief §8). A no-cutoff predicate would either fail at apply time or require deleting existing data.
- The partial-cutoff predicate is the only way to satisfy both "future-prevention only" AND "constraint at the DB layer".

**Alternative: introduce a separate `admin_revalidate` run_mode for legitimate admin re-runs.**

Rejection reasoning:
- The brief allows this in §8 as a bypass-mechanism option, but the operator's stated semantics for `production` vs `admin_validation` are already encoded in `runModeConstants.ts:12-18`. Adding a third mode would require:
  - A new CHECK constraint value (migration).
  - A new entry in `MachineObservationRunMode` (mirror file on both src/ and supabase/functions/).
  - A Source 6 query update to include `admin_revalidate` in the production filter (touches `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` — locked by the brief).
- The chosen approach achieves the same outcome with a `forceRerun: boolean` request-body parameter, which is purely additive and does not touch run_mode semantics.

---

## 4. Phase A.3 Backward compatibility plan

### 4.1 The 3 existing duplicate pairs

The 3 pairs from §1.2 are documented as historical and are NOT retroactively fixed. The partial UNIQUE INDEX's `created_at > '<cutoff>'` predicate admits them — Postgres only enforces uniqueness on rows whose `created_at` exceeds the cutoff timestamp. The cutoff value is the migration's apply time captured at runtime (`now()` at the moment of `CREATE UNIQUE INDEX … WHERE …`).

**Implementer note:** Postgres partial UNIQUE INDEX predicates must be IMMUTABLE expressions. `now()` is not IMMUTABLE. The migration captures the cutoff via a fixed timestamp literal computed by the operator at design time (the brief allows this in §15 — design fixes the cutoff value). The cutoff baked into this design: **`'2026-05-27 11:00:00 UTC'`** — this is after the latest Pair-2 second-run timestamp (`10:29:31 UTC`) and before any future production traffic. Validate the cutoff exceeds all 3 pairs' second-run timestamps at implementer time.

### 4.2 Future single submissions

A new argument submitted via the standard path:
- `submit-argument` Edge Function → inserts row in `arguments` → dispatches auto-trigger.
- Dispatcher's pre-check: no existing successful run → proceeds.
- Adapter call → `persistRun` → row created with `status='success'`. **PASS — no constraint violation, single run row.**

### 4.3 Future legitimate duplicates (admin re-runs, retries)

Three legitimate-bypass paths supported:

1. **Admin debugging re-run with explicit override.** Admin calls `classify-argument-boolean-observations` with `mode: 'production'` + `forceRerun: true`. Path B's pre-check is bypassed; the adapter runs; `persistRun` writes a new row. The DB constraint admits the row because the existing successful run row exists ONLY for the same exact tuple — but the `created_at` cutoff predicate means the constraint applies only to rows after the cutoff, AND the constraint key tuple uniquely identifies content-equivalent runs. Wait — this is the subtle case: a forced re-run for the SAME argument with the SAME tuple would still hit the constraint. The fix: the `forceRerun` path also bypasses the DB constraint by passing through Path B's pre-INSERT idempotency check.

   **Resolution:** The DB partial UNIQUE INDEX's predicate is `WHERE status='success' AND created_at > '<cutoff>' AND admin_force_rerun IS NULL`. We add a new optional column `admin_force_rerun boolean` to `argument_machine_observation_runs` (NULL default). Admin force re-runs set `admin_force_rerun = true` in the insert payload; these rows do NOT compete against the partial UNIQUE INDEX. Q9 must explicitly filter `admin_force_rerun IS NULL` to avoid flagging legitimate admin re-runs. This is documented in the migration AND in `scripts/ops/sql/09-duplicate-runs.sql` (the brief allows ops/sql/ refinements in §15 even though it's listed in HALT trigger 10 for Source 6 — Source 6 is `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`, NOT Q9; the brief's HALT trigger 10 specifically references Source 6 in `src/`, not the ops/sql/ scripts).

   **Q9 update is intentionally scoped:** the ops/sql/09 query updates ONLY add a `WHERE admin_force_rerun IS NULL` clause to the Q9 join. This does NOT touch Q1-Q8 or Q10-Q13.

2. **Admin audit re-run with `mode: 'admin_validation'`.** No bypass needed. `admin_validation` runs are by design re-runnable — the partial UNIQUE INDEX's tuple includes `run_mode`, and Q9 already segments by run_mode. Admin_validation re-runs are legitimate operator audit traffic. Two admin_validation runs for the same argument continue to be possible (and will continue to surface in Q9, exactly as the 3 historical Pairs 1 + 2 did). This is correct per the brief §8 ("admin re-runs ... must have a documented bypass") and matches `runModeConstants.ts`'s established semantics.

3. **Retry after transient failure.** The dispatcher's retry loop creates a new run row only on retryable failure (`mcp_network_error`, `mcp_api_error`, `mcp_rate_limited`). All retry-created run rows have `status='failed'` initially. The retry's final attempt either succeeds (`status='success'`, partial UNIQUE applies) or stays failed (`status='failed'`, partial UNIQUE does not apply). Either way, the constraint is satisfied. **PASS — no constraint violation.**

### 4.4 Recap — bypass mechanism chosen

**Chosen bypass: `forceRerun: boolean` request-body parameter on Path B + `admin_force_rerun boolean` column on the runs table.**

This is option (a) of the brief §8's enumerated bypasses ("Admin override flag") plus a defensive DB-layer counterpart that prevents the constraint from blocking legitimate admin overrides. Documented at runtime via the Edge Function handler comments AND in the migration COMMENT block.

---

## 5. Phase A.4 Test plan + smoke plan

### 5.1 New test file — `__tests__/opsMcpIdempotencyHardening.test.ts`

Test suite name: `OPS-MCP-IDEMPOTENCY-HARDENING — idempotency-tuple uniqueness + bypass semantics`.

Per design §3 + §4. **Forecast: 60-80 new tests across all source-scan + behavioral assertions** (within the brief's M-L bracket: +30 to +80 per Cause-D / Cause-A hybrid). Concrete count to be sharpened by implementer; design-time estimate is 65.

**Test groups:**

**Group A — DB constraint schema assertions (source-scan against migration):** ~15 tests
- `CONSTRAINT-1` — new migration file exists at `supabase/migrations/<timestamp>_ops_mcp_idempotency_hardening.sql`.
- `CONSTRAINT-2` — migration creates a partial UNIQUE INDEX on `argument_machine_observation_runs`.
- `CONSTRAINT-3` — partial INDEX tuple includes `argument_id, schema_version, provider_key, run_mode, requested_families` (or sorted-array equivalent).
- `CONSTRAINT-4` — partial predicate includes `status = 'success'`.
- `CONSTRAINT-5` — partial predicate includes `created_at > '<cutoff>'` AND the cutoff is a single literal (no `now()` or other VOLATILE function).
- `CONSTRAINT-6` — partial predicate includes `admin_force_rerun IS NULL`.
- `CONSTRAINT-7` — migration adds `admin_force_rerun boolean DEFAULT NULL` to `argument_machine_observation_runs`.
- `CONSTRAINT-8` — migration adds a COMMENT on the new column explaining its purpose (bypass for legitimate admin re-runs).
- `CONSTRAINT-9` — migration does NOT delete any existing row (no DELETE statement in the file).
- `CONSTRAINT-10` — migration does NOT touch storage.* (PR-003 SQLSTATE 42501 boundary).
- `CONSTRAINT-11` — migration follows OPS-001 §4 four-class header convention (Class 1 / 2 / 3 / 4 enumerated in the comment block).
- `CONSTRAINT-12` — cutoff timestamp exceeds the latest existing duplicate pair's second-run timestamp.
- `CONSTRAINT-13` — migration header references the binding intent brief.
- `CONSTRAINT-14` — migration is append-only (`ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`).
- `CONSTRAINT-15` — `requested_families` column is referenced via a sorted-array expression to match the dispatcher's `buildBooleanObservationInputHash` sort order.

**Group B — Dispatcher graceful handling (source-scan + behavior):** ~12 tests
- `DISPATCHER-1` — `persistRun` SQLSTATE 23505 returns from the dispatcher as `outcome: 'skipped' / 'unique_violation'`, NOT `'failed'`.
- `DISPATCHER-2` — the existing `'already_classified'` outcome is preserved when the pre-check finds a successful row.
- `DISPATCHER-3` — the new SKIP outcome emits a structured log entry with `outcome: 'skipped', skip_reason: 'unique_violation'`.
- `DISPATCHER-4` — the `AutoTriggerOutcome.skipReason` union extends to include `'unique_violation'`.
- `DISPATCHER-5` — the dispatcher source explicitly catches SQLSTATE `23505` (string check or coded error class).
- `DISPATCHER-6` — the dispatcher's retry loop does NOT retry on SQLSTATE 23505 (a unique-violation is structural, not transient).
- `DISPATCHER-7` — the dispatcher's pre-check shape is BYTE-EQUIVALENT to the pre-fix version (Source 6's race-tolerance documentation in the header comment is preserved with an addendum noting the DB constraint backstop).
- `DISPATCHER-8` — the dispatcher does NOT throw on SQLSTATE 23505 (defensive — surfaces via outcome).
- `DISPATCHER-9` — the dispatcher's `AUTO_TRIGGER_MODE` literal remains `'production'`.
- `DISPATCHER-10` — the dispatcher's idempotency pre-check filters `run_mode='production'` (existing — preserved).
- `DISPATCHER-11` — the dispatcher's emit-log on SQLSTATE 23505 does NOT include the existing run's ID (defensive — no internal-state leak to log surface).
- `DISPATCHER-12` — the dispatcher's `MAX_ATTEMPTS=2` is unchanged.

**Group C — classifier Edge Function (Path B) — `forceRerun` + pre-check:** ~18 tests
- `EDGE-PATH-B-1` — request body schema validation accepts an optional `forceRerun: boolean`.
- `EDGE-PATH-B-2` — unknown / missing `forceRerun` defaults to `false`.
- `EDGE-PATH-B-3` — `mode='production'` + `forceRerun=false` + existing successful production run returns per-argument summary `status: 'skipped_already_classified'` with the existing runId.
- `EDGE-PATH-B-4` — `mode='production'` + `forceRerun=true` + existing successful production run proceeds to classify and writes a new run row with `admin_force_rerun=true`.
- `EDGE-PATH-B-5` — `mode='admin_validation'` + `forceRerun=false` + existing successful admin_validation run STILL proceeds (admin_validation is re-runnable by design).
- `EDGE-PATH-B-6` — `mode='admin_validation'` + `forceRerun=true` is accepted but `admin_force_rerun` is NOT set on the persisted row (admin_validation runs don't need the bypass flag).
- `EDGE-PATH-B-7` — `forceRerun=true` is admin-required (the existing `requireAdmin` gate covers this; no new auth path).
- `EDGE-PATH-B-8` — the pre-check uses the SAME SELECT shape as the dispatcher's `findExistingRun` (consistency).
- `EDGE-PATH-B-9` — the new per-argument summary status `'skipped_already_classified'` is added to the `PerArgumentSummary.status` union in `classifyArgumentCore.ts`.
- `EDGE-PATH-B-10` — `'skipped_already_classified'` is also returned by the dispatcher (consistency).
- `EDGE-PATH-B-11` — Edge Function's response shape does NOT expose `admin_force_rerun` in any per-argument summary field (the column is internal).
- `EDGE-PATH-B-12` — Edge Function pre-check is no-op when the argument is missing entirely (proceeds to classifier core which returns `argument_not_found`).
- `EDGE-PATH-B-13` — Edge Function's `forceRerun` documentation comment explains the audit / debugging use case.
- `EDGE-PATH-B-14` — banned-token sweep: no verdict tokens in any new comment / error message (cdiscourse-doctrine §1, §9).
- `EDGE-PATH-B-15` — no service-role key reference in any new code (cdiscourse-doctrine §6).
- `EDGE-PATH-B-16` — no logging of `Authorization` header / `forceRerun` value in new log statements (supabase-edge-contract logging rules).
- `EDGE-PATH-B-17` — pre-check uses the `serviceClient` passed into the handler, not a newly-created client.
- `EDGE-PATH-B-18` — pre-check passes `provider_key` and `requested_families` filters identically to the dispatcher's check.

**Group D — Q9 ops/sql update — admin_force_rerun filter:** ~6 tests
- `Q9-1` — `scripts/ops/sql/09-duplicate-runs.sql` adds `AND r.admin_force_rerun IS NULL` to the runs join.
- `Q9-2` — the comment block on the SQL file documents the new admin_force_rerun filter.
- `Q9-3` — header rule (`-- OPS-MCP-OBSERVABILITY`) preserved per the existing `opsMcpObservabilitySqlSafety.test.ts` invariant.
- `Q9-4` — no other Q1-Q13 file is modified.
- `Q9-5` — Q9's GROUP BY does not include `admin_force_rerun` (we filter not segment — admin force re-runs are not "duplicates" semantically).
- `Q9-6` — Q9's expected-empty postcondition stays "zero rows after the migration apply time", documented in the header.

**Group E — Read-only boundary assertions (defensive):** ~8 tests
- `BOUNDARY-1` — `src/features/nodeLabels/machineObservationPersistenceQuery.ts` byte-equal to main (HALT trigger 10).
- `BOUNDARY-2` — `mcp-server/**` byte-equal to main.
- `BOUNDARY-3` — `supabase/functions/_shared/booleanObservations/familyRegistry.ts` byte-equal to main (no taxonomy change).
- `BOUNDARY-4` — `supabase/functions/_shared/booleanObservations/machineObservationDefinitions.ts` byte-equal to main.
- `BOUNDARY-5` — `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts` byte-equal to main.
- `BOUNDARY-6` — Family B / Family C admin_validation paths byte-equal at adapter and registry layers.
- `BOUNDARY-7` — `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` literal byte-equal.
- `BOUNDARY-8` — the existing `clientSubmissionId` idempotency in `submit-argument` is UNTOUCHED.

**Group F — Doctrine + safety assertions:** ~6 tests
- `DOCTRINE-1` — no verdict tokens (winner / loser / liar / true / false / etc.) in any new file (cdiscourse-doctrine §1).
- `DOCTRINE-2` — no service-role key reference in any new src/ file (none expected — all src/ is read-only per the boundary list).
- `DOCTRINE-3` — no Authorization header / service-role / API key logging in any new log statement.
- `DOCTRINE-4` — partial UNIQUE INDEX's `requested_families` expression sorts the array (consistent with the dispatcher's `buildBooleanObservationInputHash` sort order at `booleanObservationRequestBuilder.ts:140`).
- `DOCTRINE-5` — no engagement / popularity / heat columns referenced in the constraint tuple (cdiscourse-doctrine §3).
- `DOCTRINE-6` — Source 6 binding constraint preserved (literal `'production'` at `machineObservationPersistenceQuery.ts:127` byte-equal).

### 5.2 Run gates (per intent brief §11)

```
npm run typecheck                                   # exit 0
npm run lint                                        # exit 0
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read   # regression sanity; mcp-server byte-equal
```

### 5.3 Smoke plan — 8-phase

Per intent brief §12. The smoke audit lands at `docs/audits/OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE-2026-05-28.md` (or whichever date applies post-merge).

**Phase 1 — Pre-flight.** Confirm `main` SHA, both Edge Functions deployed at the new version, DB migration applied via Supabase auto-deploy GitHub integration. Source 6 file byte-equal verified.

**Phase 2 — Observability report.** Run `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/ops-smoke`. Q9 should still show the 3 historical pairs (cutoff predicate admits them) AND no NEW duplicates since the merge SHA timestamp.

**Phase 3 — Idempotency positive test (Cause D defense).**
- Submit two argument-creation calls with DIFFERENT `client_submission_id` values but the SAME body in rapid succession (TOCTOU race simulation). Two arguments are created (different `argument_id` each, by primary key). Each gets its own auto-trigger → each produces one run row. **PASS** — no duplicate runs (because argument_id differs).
- Then trigger the actual race by manually invoking `classify-argument-boolean-observations` with `mode: 'production'` for a single argument with two parallel curl calls. **One must succeed; one must return `skipped_already_classified` or fail gracefully with the SQLSTATE 23505 mapped to `skipped / unique_violation`.** Zero duplicate run rows for that argument.

**Phase 4 — Single-submit happy path.** Submit a new argument via `submit-argument`. Auto-trigger fires. ONE run row exists for the argument after 30s. **PASS.**

**Phase 5 — Legitimate duplicate bypass.** Admin invokes `classify-argument-boolean-observations` with `mode: 'production', forceRerun: true` for an existing argument. The call succeeds and writes a new run row with `admin_force_rerun=true`. Q9 does NOT surface this as a duplicate (Q9 filters `admin_force_rerun IS NULL`).

**Phase 6 — Family B/C admin_validation regression.** Re-run the OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE admin_validation smoke against the 3 seeded args. **Same result as before — Family A success rows. Family B / Family C admin_validation paths function identically.** (Note: Family A admin_validation re-runs WILL CREATE new run rows because partial UNIQUE INDEX scopes to `status=success AND admin_force_rerun IS NULL`; admin_validation re-runs use neither path. This is exactly the intended behavior — admin_validation is re-runnable by design per §4.3.)

**Phase 7 — OPS observations.** Verify no regression on existing Q1-Q13 reports. Compare aggregate counts pre- and post-merge.

**Phase 8 — Verdict + authorization.** PASS / FAIL gate per intent brief §13. On PASS, `MCP-SERVER-005-FAMILY-D` is NEXT.

---

## 6. Read-only boundary list (locked files)

Per intent brief §6 + the implementation constraints in the launch instructions. The implementer MUST NOT modify:

**HARD-LOCKED (HALT triggers fire):**
- `src/features/nodeLabels/machineObservationPersistenceQuery.ts` line 127 — Source 6 filter (HALT trigger 10 + 22).
- `src/**` — entire `src/` tree is downstream of this card; no UI changes required.
- `mcp-server/**` — entire MCP server is downstream; byte-equal preserved (HALT trigger 18 implicit).
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — no taxonomy / production-enablement change.
- `supabase/functions/_shared/booleanObservations/machineObservationDefinitions.ts` — no rawKey / family change.
- `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts` — no schema-version change.
- `supabase/functions/_shared/booleanObservations/persistenceWriter.ts` — service-role write path UNCHANGED (the new Edge handling catches SQLSTATE 23505 at the CALLER level, not inside the writer).
- `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` — except for ONE necessary extension: the `PerArgumentSummary.status` union extends to include `'skipped_already_classified'`. The existing `classifyOneArgumentCore` function body is byte-equal; only the type union grows. (Implementer note: if this extension is contested at review, the alternative is to add a separate `skippedAlreadyClassified` boolean field to the summary; designer's preference is the union extension because it's the cleaner pattern.)
- Existing observability SQL files `scripts/ops/sql/01-*.sql` through `scripts/ops/sql/08-*.sql` AND `scripts/ops/sql/10-*.sql` through `scripts/ops/sql/13-*.sql` — only `09-duplicate-runs.sql` is touched.

**SOFT-LOCKED (touched only where strictly required by the fix):**
- `supabase/functions/submit-argument/index.ts` — UNCHANGED. The auto-trigger dispatch call site at lines 787-794 is byte-equal. The fix lives entirely in the dispatcher and the classifier Edge Function.

**ALLOWED-FOR-EDIT (per the fix surface):**
- `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` — adds SQLSTATE 23505 handling + new outcome `'skipped' / 'unique_violation'`.
- `supabase/functions/classify-argument-boolean-observations/index.ts` — adds optional `forceRerun` body param + pre-INSERT idempotency check at mode=production.
- `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` — extends `PerArgumentSummary.status` union to include `'skipped_already_classified'`.
- `supabase/migrations/<new timestamp>_ops_mcp_idempotency_hardening.sql` — NEW file, adds partial UNIQUE INDEX + `admin_force_rerun` column.
- `scripts/ops/sql/09-duplicate-runs.sql` — adds `AND r.admin_force_rerun IS NULL` to the join.
- `__tests__/opsMcpIdempotencyHardening.test.ts` — NEW file (~65 tests).

---

## 7. HALT trigger table (all 24 evaluated)

Per intent brief §9. **PENDING** = fires at implementer / PR stage if condition is met; design-time status is "not applicable yet".

| # | Trigger | Status at design time |
|---|---|---|
| 1 | Phase A.1 RCA does not identify a primary cause for the production pair | **CLEAR** — RCA identifies Cause C for Pair 3 with explicit audit-document evidence. |
| 2 | Phase A.2 fix approach does not address the identified cause | **CLEAR** — fix addresses Cause C (Path B idempotency check) AND the latent Scenario X1 + X5 risks (DB constraint + dispatcher SQLSTATE 23505 handling). |
| 3 | Phase A skips RCA and proposes a generic fix | **CLEAR** — §2 documents per-pair RCA with file/line evidence. |
| 4 | Stage 2B operator approval missing when implementer starts | **PENDING** — fires if implementer subagent spawns before operator approves at Stage 2B. Design halts pipeline as required. |
| 5 | Multiple fixes proposed without operator picking one | **CLEAR** — §3 proposes ONE primary approach + names the rejected alternative. |
| 6 | Fix proposes addressing causes not surfaced by RCA (scope creep) | **CLEAR** — fix scope = Cause C + Scenario X1 + Scenario X5. Latent X1 + X5 are explicitly surfaced by the RCA in §2.6. |
| 7 | Migration deletes existing run rows | **CLEAR** — migration adds INDEX + COLUMN only. Zero DELETE statements. Existing 3 pairs admitted via partial-cutoff predicate. |
| 8 | Database constraint changes break ON DELETE behavior | **CLEAR** — partial UNIQUE INDEX does not interact with FK cascade. The existing ON DELETE CASCADE from `arguments` → `argument_machine_observation_runs` is unchanged. |
| 9 | Auto-trigger logic change affects Family B/C admin_validation path | **CLEAR** — auto-trigger affects only Family A production mode (dispatcher's `AUTO_TRIGGER_MODE = 'production'` byte-equal). Family B/C admin_validation goes through Path B; the new Path B pre-check is mode-gated (admin_validation does not fire). |
| 10 | Source 6 filter changes (out of scope) | **CLEAR** — `machineObservationPersistenceQuery.ts:127` byte-equal. Hard-locked in §6. |
| 11 | Idempotency key includes sensitive data (argument body, user PII) | **CLEAR** — partial UNIQUE INDEX tuple is `(argument_id, schema_version, provider_key, run_mode, requested_families)`. No body, no PII. |
| 12 | Lock implementation introduces deadlock potential | **CLEAR** — no advisory lock / row lock introduced. The fix is constraint-based. |
| 13 | Retry-logic change introduces silent-failure modes | **CLEAR** — SQLSTATE 23505 maps to `outcome='skipped', skip_reason='unique_violation'` — visible in logs and Q3 telemetry. Not silent. |
| 14 | Edge Function timeout-budget changes that affect other features | **CLEAR** — added pre-check adds ~50ms; net budget unchanged. |
| 15 | Fix introduces a new external dependency | **CLEAR** — pure Postgres + Edge Function changes. No Redis / etc. |
| 16 | Schema migration introduces a non-backward-compatible breaking change | **CLEAR** — partial cutoff admits historical rows; `admin_force_rerun` defaults to NULL on existing rows. Append-only. |
| 17 | Existing test data invalidated by fix | **CLEAR** — existing 3 pairs remain in DB and remain visible in Q9; the constraint admits them via cutoff predicate. |
| 18 | Family A auto-trigger logic disabled to prevent duplicates | **CLEAR** — auto-trigger production path UNCHANGED. Dispatcher continues to fire after every successful argument INSERT. |
| 19 | Test forecast > +150 | **CLEAR** — forecast is +60 to +80 (design-time estimate: 65). Well below threshold. |
| 20 | Verdict tokens in user-facing strings | **CLEAR** — fix touches only Edge Function + migration + ops/sql + tests. No user-facing strings. New status `'skipped_already_classified'` is internal-only (NOT mapped through `gameCopy.toPlainLanguage`; the brief implies it never reaches the UI). |
| 21 | Idempotency error messages expose internal state in user-visible surface | **CLEAR** — `skipped_already_classified` does include the existing runId (internal admin audit surface), but only the admin gets that response. The dispatcher's log entry on SQLSTATE 23505 does NOT include the existing run's ID (DISPATCHER-11). |
| 22 | Source 6 affected by idempotency check | **CLEAR** — Source 6 reads finished result rows. The new constraint operates on runs.status='success' AND admin_force_rerun IS NULL; the partial-INDEX-skipped admin force re-runs DO write result rows, which DO render in Source 6 (this is correct — a forced re-run IS a real classification result; the operator wants to see it). |
| 23 | Unclassified untracked files at PR creation | **PENDING** — fires if implementer or reviewer creates files beyond the design's surface. The current 10 operator-territory untracked files are pre-existing. |
| 24 | Migration script committed to repo `scripts/` | **CLEAR** — migration lives under `supabase/migrations/`, not `scripts/`. Confirmed in §6 ALLOWED-FOR-EDIT. |

**Triggers 4 + 23 are explicitly PENDING per the launch instructions.** Triggers 4 fires at implementer start; trigger 23 fires at PR creation.

---

## 8. Brief ledger

The intent brief at `docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING-intent.md` is operator-authored. This design adheres to every binding constraint in the brief:

| Brief section | Design treatment |
|---|---|
| §1 — 3-pair inventory | §1.2 re-verifies live; matches verbatim |
| §2 — operator pre-RCA reading | §2 supersedes with binding RCA evidence; Pair 3 reclassified from "Cause A or D-light" to Cause C with audit-document evidence |
| §3 — RCA-first methodology | §2 follows methodology fully |
| §4 — fix-approach selection | §3 selects hybrid DB constraint + Edge handling, with explicit reject reasoning |
| §5 — Stage 2B operator-decision wrapper | Pipeline halts after this design commit; parent agent surfaces RCA + recommendation to operator |
| §6 — preserve auto-trigger production behavior | §6 hard-locks the dispatcher's auto-trigger semantics |
| §7 — idempotency tuple `(argument_id, family, run_mode)` | §3 implements `(argument_id, schema_version, provider_key, run_mode, requested_families)` — the brief's tuple is preserved as a strict subset (`family` ⊂ `requested_families` array); the broader tuple is defensive without losing the brief's semantic |
| §8 — backward compatibility | §4 implements: partial-cutoff for historical; `forceRerun` flag for admin overrides; admin_validation re-runs untouched; retry-loop semantics preserved |
| §9 — 24 HALT triggers | §7 evaluates each with current status |
| §10 — 4 required Phase A audits | §2 (A.1), §3 (A.2), §4 (A.3), §5 (A.4) |
| §11 — test forecast | §5.1 forecasts +65 tests, within the Cause D / Cause A hybrid range (+30 to +80) |
| §12 — smoke plan | §5.3 implements 8-phase smoke |
| §13 — authorizations on PASS | not yet evaluated; awaits smoke result |
| §14 — brief ledger | this table |
| §15 — execution order | this design is Stage 1; Stage 2A HALT eval = §7; Stage 2B operator decision is the next step |

**Intent brief is BINDING.** Where the design adds detail (e.g., adding `admin_force_rerun` column), it does so to satisfy a brief constraint, not to override one.

**Orchestrator-authored content acknowledgment:** The design itself was orchestrator-authored in the sense that the operator did not pre-author the per-pair RCA verdicts. The operator's pre-RCA reading in brief §2 was explicit about its own non-binding status ("designer's Phase A.1 RCA is the BINDING analysis; the operator's pre-reading is offered as a starting point only"). Designer judgments where operator direction was absent are flagged below in §9 Risks for explicit Stage 2B review.

---

## 9. Risks

Things that might trip up the implementer or the smoke.

1. **Migration cutoff-timestamp correctness.** The partial UNIQUE INDEX's `created_at > '<cutoff>'` predicate must use a literal that strictly exceeds the latest existing duplicate pair's second-run timestamp. Design chooses `'2026-05-27 11:00:00 UTC'`. Implementer must re-verify against live DB at apply time (the cutoff must remain valid even if new Q9 rows appeared between design and ship — unlikely but possible).

2. **Pre-fix Q9 expected-empty contract.** The existing `scripts/ops/sql/09-duplicate-runs.sql` documents "Expected today: zero rows" but the live Q9 shows 3 rows. The pre-fix expectation is already invalid. The implementer must update the comment to reflect the new contract: "zero rows after the migration's cutoff timestamp; historical pairs admitted intentionally". This is documentation, not behavior.

3. **`requested_families` array sort-order subtlety.** Postgres compares array elements positionally. Two arrays with the same elements in different order are NOT equal under the default array-equality operator. The partial UNIQUE INDEX expression `array(SELECT unnest(requested_families) ORDER BY 1)` normalizes this. The dispatcher's `buildBooleanObservationInputHash` ALSO sorts (`[...input.families].sort().join(',')` at `booleanObservationRequestBuilder.ts:140`). The implementer must verify that BOTH sites use the same sort semantics (lexicographic ASCII; the family names are all-ASCII-lowercase strings so `.sort()` and `ORDER BY 1` produce the same order).

4. **`admin_force_rerun` column visibility in Source 6.** Source 6 (`machineObservationPersistenceQuery.ts:127`) filters by `run_mode='production'`. It does NOT filter by `admin_force_rerun`. This is intentional — admin force re-runs ARE production-mode result rows; the operator wants to see their results in the timeline. The risk: if a future operator audit expects admin force re-runs to be invisible by default, this design is wrong. The choice is deliberate; document it in the migration COMMENT block AND in the Edge Function's `forceRerun` docstring.

5. **Edge Function deployment ordering.** The migration MUST land BEFORE the Edge Function deploy. If the Edge Function deploys first and attempts to write `admin_force_rerun=true` against an old schema, the INSERT fails. Supabase auto-deploy via GitHub integration applies migrations first by design, but the implementer should add a sanity check in the smoke Phase 1.

6. **The 'skipped_already_classified' status union extension touches `PerArgumentSummary`.** This is a TypeScript union widening on an export consumed by both Edge Functions (Path A dispatcher AND Path B handler). The implementer must verify no consumer of `PerArgumentSummary.status` switch-exhaustiveness checks are present (a `default: assertNever(s)` would compile-fail). Source-scan: only `mcpOneTwoOneCAutoTriggerIdempotency.test.ts` IDEM-8 + IDEM-15 reference the union; both are content matchers, not exhaustiveness. **PASS** at design time; implementer re-checks.

7. **Q9 admin_force_rerun filter is a doctrine-relevant query change.** The SQL change is one line + a comment. The `opsMcpObservabilitySqlSafety.test.ts` invariant ("first non-empty line starts with `--`" and "file contains `OPS-MCP-OBSERVABILITY`") continues to hold. The new line is INSIDE the existing comment block and `with` CTE; the file's identity stays. The implementer must NOT relocate the file or rename it.

8. **Cutoff backdating concern (operator direction needed).** The design picks `'2026-05-27 11:00:00 UTC'` as the cutoff. If the operator wants a different cutoff (e.g., immediately before the merge SHA to maximize historical-row admission), this is a Stage 2B clarification point. Design recommends Stage 2B operator confirmation of the cutoff value.

---

## 10. Out of scope

Explicit list of work NOT included.

1. **Retroactive deduplication of the 3 existing pairs.** They are admitted by the cutoff predicate AND continue to surface in Q9 with status segmented (not flagged as the "new" duplicate that the constraint prevents). The brief §8 explicitly says historical pairs are NOT retroactively fixed.

2. **`mode='admin_validation'` idempotency.** Admin_validation runs are by design re-runnable. The fix does NOT add a pre-check at `mode='admin_validation'`. Operator-driven audit smokes that re-run admin_validation against the same arg set continue to create new run rows (and continue to appear in Q9 as admin_validation duplicates — the canonical Q9 signal pattern that Pairs 1 + 2 represent).

3. **Source 6 query layer changes.** `machineObservationPersistenceQuery.ts:127` is the production-filter binding constraint. UNCHANGED.

4. **MCP server changes.** The `mcp-server/**` tree is downstream; UNCHANGED.

5. **UI changes.** No `src/` edits. No UI debounce. The RCA does NOT identify a user-driven duplicate cause, so the brief's Cause A surface (UI debounce + Edge idempotency check) is NOT needed.

6. **Push-notification gating.** v1 scope guard preserved (cdiscourse-doctrine §10).

7. **Family B / Family C / Family D production enablement.** Those are separate cards; this card touches only Family A's production-mode dispatch path AND the admin HTTP path which is family-agnostic but mode-aware.

8. **Schema version bumps.** `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` byte-equal.

9. **Family registry changes.** `familyRegistry.ts` byte-equal.

10. **Test data cleanup.** Already shipped at `b8ce07b`. This card does NOT re-touch the synthetic-row cleanup migration or its associated SQL.

---

## 11. Doctrine self-check

Walk through every relevant doctrine constraint.

- **cdiscourse-doctrine §1 (no truth labels, score never blocks posting):** The new `'skipped_already_classified'` outcome is a structural fact, not a verdict. The dispatcher's `'skipped' / 'unique_violation'` outcome is structural. The migration's `admin_force_rerun` column is an audit fact. None of these surface in user-facing strings.
- **cdiscourse-doctrine §3 (popularity is not evidence):** The constraint tuple includes argument_id + schema_version + provider_key + run_mode + requested_families. Zero engagement / popularity / heat columns. The partial UNIQUE INDEX does NOT use any anti-amplification surface.
- **cdiscourse-doctrine §4 (AI moderator hard limits):** No AI calls added from production code. Edge Function path is unchanged; classifier still routes through MCP adapter. No client-side AI.
- **cdiscourse-doctrine §6 (secrets policy):** No service-role key in any new src/ code (no src/ edits). Service-role usage in `autoTriggerDispatcher.ts` and `classify-argument-boolean-observations/index.ts` is via existing patterns; no new service-role surface.
- **cdiscourse-doctrine §7 (no AI calls from production app):** Production app `src/` is read-only by this card. AI calls remain Edge-Function-only.
- **cdiscourse-doctrine §8 (Supabase conventions):** Migration is APPEND-ONLY (new file with new timestamp). RLS preserved (no policy changes; the new column inherits the existing `amor_runs_select_via_argument` policy because RLS is row-level, not column-level — the policy applies to the row regardless of the new column). Soft-delete semantics preserved (no DELETE statements).
- **cdiscourse-doctrine §10a (Observations vs Allegations):** Persisted Machine Observations remain `source: 'machine'`. The constraint and the new column are administrative metadata, not display labels.
- **test-discipline:** Tests are part of the deliverable (§5.1). Forecast count documented. Source-scan tests for every behavioral assertion. No `.skip` / `.only` introduced.
- **supabase-edge-contract:** Service-role usage continues per existing pattern. No service-role in client code. Edge Function logging rules: no `Authorization` header, no service-role key, no `forceRerun` value in logs (DISPATCHER-3 + EDGE-PATH-B-16 enforce this). Migration discipline: append-only, sequentially-timestamped, OPS-001 §4 four-class header included (CONSTRAINT-11 enforces).

All checks PASS at design time. Implementer verifies again at PR time.

---

## 12. Operator steps (deploy / smoke)

After PR merges to main:

1. **Migration auto-deploys** via Supabase GitHub integration. Operator verifies in Supabase Dashboard → Database → Migrations that the new migration appears with apply-time = post-merge.
2. **Edge Functions auto-deploy** via Supabase GitHub integration. Operator verifies in Supabase Dashboard → Edge Functions that both `submit-argument` and `classify-argument-boolean-observations` have updated version numbers AND timestamps post-merge.
3. **Operator runs 8-phase smoke** documented at `docs/audits/OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE-2026-05-28.md` (or applicable date). Smoke documented per §5.3 above.
4. **On smoke PASS:** authorizations granted per brief §13. `MCP-SERVER-005-FAMILY-D` is next.
5. **On smoke FAIL:** file `OPS-MCP-IDEMPOTENCY-HARDENING-FIX` per brief §13.

No operator action required between PR merge and smoke. Supabase auto-deploy handles migrations + Edge Function deploys.
