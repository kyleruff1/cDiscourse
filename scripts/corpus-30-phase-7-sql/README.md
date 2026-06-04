# CORPUS-30 Phase 7 — read-only SQL verification

**Card:** CORPUS-30 (pool-driven planner; xAI/Anthropic 30-stage live corpus on pre-launch prod synthetic).
**runTag under inspection:** `corpus-prod-synthetic-20260603-1924-d49e04cd`
**Phase:** 7 — classifier observation verification (read-only).
**Posture:** verify-only, not re-trigger. Every submit-argument insert in the corpus run already fired `dispatchAutoTriggerForArgument` (see `supabase/functions/submit-argument/index.ts:838`) which iterated `productionEnabledFamilies()` (A-G) with bounded concurrency=2 (`MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`). Up to 300 args x 7 families = 2100 rows of `argument_machine_observation_runs` are expected to already exist.

## What these queries verify (and do NOT do)

These SQL files are **read-only inspection**. They do not:

- Insert, update, or delete any row in `public.arguments`, `public.debates`, `public.argument_machine_observation_runs`, or `public.argument_machine_observation_results`.
- Re-trigger the classifier. The HTTP endpoint `classify-argument-boolean-observations` has NO idempotency pre-check and would write duplicate run rows.
- Arm `CLASSIFIER_QUEUE_ROUTING_ENABLED` or any queue-routing percentage. The auto-trigger DIRECT-DISPATCH path is what posted these rows already.
- Touch H/I/J families. They are `productionEnabled: false` in `familyRegistry.ts:104-118` and are skipped automatically by `filterFamiliesForMode` in mode='production'.

## Run order

| Step | File | Purpose | Expected shape |
| --- | --- | --- | --- |
| 1 | `01-universe.sql` | Confirm 30 debates and 300 arguments are present under this runTag. | One row, two columns. |
| 2 | `02-coverage-matrix.sql` | Per-family, per-status, per-state, per-run_mode row counts. Headline result for Phase 7. | Up to ~14 rows (7 families x 2 status values), all `run_mode='production'`, `state='succeeded'` or `state='failed_terminal'`. |
| 3 | `03-failure-reason-breakdown.sql` | If failures exist, group by `failure_reason` + `failure_sub_reason`. | Empty if 0 failures; otherwise one row per (family, reason, sub_reason). |
| 4 | `04-positive-observation-density.sql` | Per-family count of positive observations + distinct argument coverage. | One row per family. |
| 5 | `05-failure-detail-forensics.sql` | If Step 3 surfaced failures, project the leak-safe `failure_detail` jsonb fields. | Optional — only if Step 3 has data. |
| 6 | `06-per-argument-gap.sql` | Per-family count of arguments MISSING a runs row entirely (auto-trigger never persisted). Catches dispatcher-shutdown races. | Empty result = clean. |

## How to run

These queries require a Supabase admin role (bypasses RLS for SELECT on the four tables touched). Pick whichever connection you already use:

1. **Supabase Studio SQL editor** — Project `qsciikhztvzzohssddrq`, paste-and-run.
2. **psql against the project's pooler** — set `PG*` env to the pooler URL + admin password, then `psql -f 01-universe.sql` etc.
3. **Claude via the `mcp__plugin_supabase_supabase__execute_sql` tool** — operator must complete the OAuth flow first (see the prior message in this session for the URL).

## Schema reality

Validated against the canonical migrations on `main` as of 2026-06-03:

- `argument_machine_observation_runs` — created by `20260526000018`, extended by `20260526000019` (run_mode), `20260528000021` (family, state, attempt_count, available_at, lease_*, failure_sub_reason, dead_letter_reason, last_attempt_at; status dropped NOT NULL), `20260602000001` (failure_detail jsonb).
- The `family` column on `_runs` was added for the QUEUE substrate path. The DIRECT-DISPATCH path (`persistenceWriter.persistRun` lines 83-96) does **not** populate it. So for auto-trigger rows, family is in `requested_families[1]` (a 1-element text[] array). All queries that group by family use `COALESCE(family, requested_families[1])` to handle both paths.
- The `family` column on `_results` (per `persistenceWriter.persistResults` line 146) IS populated. Step 4 groups on it directly.
- `run_mode` is NOT NULL DEFAULT 'production'. Auto-trigger pins `AUTO_TRIGGER_MODE='production'` (autoTriggerDispatcher line 109).

## After running

Report the row counts and status splits back into the session. The next move depends on what the matrix shows:

- **All 7 families x 300 args = 2100 success rows, no failures:** Phase 7 is green. CORPUS-30 closes.
- **Some failures dominated by `mcp_validation_failed`:** revisit `OPS-MCP-RESULT-VALIDATION-BURST-HARDENING` Phase 1 typing card; check `failure_sub_reason` + `failure_detail->>'reason'` via Step 5.
- **Some failures dominated by `mcp_network_error` / `mcp_provider_server_error`:** revisit `OPS-MCP-RESULT-VALIDATION-RETRY-TUNING` (reverted at PR #370, so this points to needing a new card).
- **Family-specific gaps (e.g. D or G missing):** check `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` in `booleanObservationRequestBuilder.ts` per memory marker `[[mcp-mixed-source-family-edge-subset]]`.

Backfill via the HTTP endpoint is a SEPARATE operator authorization (not granted by CORPUS-30 Phase 7). Per `classify-argument-boolean-observations/index.ts:82` (MAX_ARGUMENTS_PER_CALL=10) it would require 30 batches of 10 ids each and would write duplicate run rows.
