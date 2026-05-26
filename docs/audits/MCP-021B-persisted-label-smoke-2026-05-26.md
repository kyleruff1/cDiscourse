# MCP-021B Persisted Label Smoke Audit

**Date:** 2026-05-26
**Author:** Operator + autonomous pipeline
**Card:** MCP-021B (merged at `eaa1aeb`, PR #303)
**Migration:** `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`
**Sequencing decision:** `docs/decisions/MCP-021-sequencing.md` § "Required follow-up after MCP-021B"

## Verdict

**PASS** — all three phases passed. MCP-021C is **AUTHORIZED** to launch.

The persisted-label path works end-to-end at the database, adapter, and UI
layers:

- Tables, RLS, read policies, and indexes match the design.
- Service-role seeds (2 runs + 7 valid result rows + 2 defensive rows)
  survive the round-trip through Supabase's Management API and read back
  with the expected shape.
- The UI renders persisted Machine Observations on the seeded arguments
  with the correct per-surface caps and grouping, and silently discards
  both defensive rows (unknown `raw_key`, wrong `schema_version`).

## Phase 1 — Migration apply

**Status:** PASS

The migration had already been applied by the Supabase GitHub integration
when PR #303 merged to `main`. `npx supabase db push --linked --dry-run`
returned `Remote database is up to date`, so the live `db push` step was
skipped per the sequencing plan.

Post-apply verification via `npx supabase db query --linked`:

- **Tables present (both `BASE TABLE`):**
  - `public.argument_machine_observation_runs`
  - `public.argument_machine_observation_results`
- **RLS enabled (`rowsecurity = true`) on both.**
- **Policies — 1 SELECT per table, zero non-SELECT:**
  - `amor_runs_select_via_argument` on `argument_machine_observation_runs`
    — `cmd=SELECT`, `permissive=PERMISSIVE`, `roles={authenticated}`
  - `amor_results_select_via_run` on `argument_machine_observation_results`
    — `cmd=SELECT`, `permissive=PERMISSIVE`, `roles={authenticated}`
  - Zero INSERT/UPDATE/DELETE policies on either table (confirms the
    "service-role-only write" posture).
- **Indexes (matches design §3 + the UNIQUE constraint):**
  - `amor_runs_argument_version_completed_idx` on runs
  - `argument_machine_observation_runs_pkey` (auto)
  - `amor_results_argument_version_rawkey_idx` on results
  - `amor_results_run_idx` on results
  - `amor_unique_run_rawkey` (the `UNIQUE (run_id, raw_key)` constraint
    index from migration line 117)
  - `argument_machine_observation_results_pkey` (auto)

## Phase 2 — Service-role seed + SQL verification

**Status:** PASS

- **Target room:** `Long onboarding is an apology for bad UI.`
  (debate `1e598dce-8188-4c7e-bdd6-aedede750923`, public, 15 arguments)
- **Target arguments:**
  - `arg1` = `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` (root, depth 0)
  - `arg2` = `781f8057-9e2a-4fa9-92a8-469676950ff7` (first reply, depth 1)
- **Rows seeded:** 2 runs + 9 result rows (7 valid + 2 defensive).
- **Valid raw_keys exercised (all `confidence='high'` so per-surface
  confidence floors do not muddle the chip-count signal):**
  - Family A (parent_relation): `supports_parent`, `refines_parent`
  - Family C (misunderstanding_repair): `offers_candidate_understanding`,
    `requests_clarification`
  - Family D (evidence_source_chain): `evidence_gap_present`
  - Family G (resolution_progress): `synthesis_proposed`,
    `concedes_narrow_point`
- **Defensive rows:**
  - `arg1`: 1 row with raw_key `totally_made_up_key_should_be_discarded`
    (valid `schema_version`) — adapter filter 3 (rawKey not in registry)
    must discard at read time.
  - `arg2`: 1 row with raw_key `supports_parent` (registry-valid) and
    `schema_version='mcp-999.fake-schema.v999'` — adapter filter 1
    (schemaVersion mismatch) must discard. Using a registry-valid raw_key
    isolates the schema_version filter from the rawKey filter.
- **SQL readback:** 9 rows present in the DB
  (`arg1=5` rows = 4 valid + 1 defensive; `arg2=4` rows = 3 valid + 1
  defensive). All valid rows carry the canonical
  `schema_version='mcp-021.machine-observations.boolean.v1'`; evidence
  spans length range `[43, 54]` chars (well inside the 240-char ceiling).
- **Cleanup-grep handle:** every seeded row carries an `input_hash` /
  provider key prefixed `smoke-` so the entire seed can be cleared with
  `DELETE FROM public.argument_machine_observation_runs WHERE input_hash
  LIKE 'smoke-%'` (CASCADE handles the result rows).

## Phase 3 — UI smoke (operator-driven)

**Status:** PASS

Operator confirmation: `phase 3 PASS` (2026-05-26).

### Pre-smoke unblockers

Phase 3 could not run cleanly when first attempted because of three
issues outside MCP-021B's scope; all were resolved in PR #304 (squash
commit `56b2fd8` on `main`) before Phase 3 verification began:

1. **Stage 6.4 web bundle TDZ crash.** The Side Action Rail ↔ Observer
   Action Dock Layout modules had a circular import that the web
   bundler refused to tolerate (Hermes / JSC on mobile let it slide).
   Rail action category model extracted to a new pure-TS module
   `src/features/arguments/railActionCategories.ts`; both former
   participants now import from there. `ArgumentSideActionRail`
   re-exports the moved symbols so existing tests and consumers
   continue to import from `./ArgumentSideActionRail` unchanged.
2. **Admin Arguments loader crash.** `loadAdminArguments` filtered on
   a non-existent `arguments.is_deleted` column. The schema's
   soft-delete sentinel is `arguments.status = 'deleted'` (Stage
   6.1.8). Replaced the `.eq('is_deleted', false)` filter with
   `.neq('status', 'deleted')` and dropped the dead column from the
   SELECT list + the `RawArgumentRow` type.
3. **Operator UX preferences:** removed the persistent "Unverified
   build" dev banner mount (component file intact); added full
   `debate_id` / `argument_id` rows to Admin Arguments plus an "Open
   timeline" button per row that routes via the existing entry-hint
   mechanism (same path notification deep-links use); bumped the
   AppHeader logo to a prominent 288 px uniform across bands, with an
   inline 10 px italic-serif tagline reading
   `...Just get to the bottom of it` to the right of the logo.

These unblockers are documented in PR #304 and live alongside the
audit reference for future investigators.

### Verification checklist

- ✓ Timeline cap (1+1+overflow) preserved on `arg1`.
- ✓ Timeline cap preserved on `arg2`.
- ✓ Selected context cap (3+3+overflow) preserved on `arg1`.
- ✓ Selected context cap preserved on `arg2`.
- ✓ Inspect popout shows all valid Machine Observations grouped.
- ✓ No `raw_key` strings visible in user-facing copy (plain-language
  labels only, sourced from the MCP-021A definition registry).
- ✓ Defensive unknown raw_key row NOT rendered on `arg1`.
- ✓ Defensive wrong-schema row NOT rendered on `arg2`.
- ✓ Reload preserves persisted Machine Observations.
- ✓ RLS gates secondary-account visibility correctly (the target room
  is public; the secondary account can read the rows as designed).

### Operator notes

None provided; verdict was unconditional `PHASE 3 PASS`.

## Phase 4 — Verdict

**MCP-021C is AUTHORIZED to launch.** The persisted-label path is
verified end-to-end. Per `docs/decisions/MCP-021-sequencing.md`
§ "Required follow-up before full MCP-021C":

1. File **MCP-021C-PRESMOKE** intent brief (one small family only;
   validates exact schema version; requires confidence on every
   positive flag; discards unknown rawKey silently; asserts malformed
   output emits zero observations).
2. Run MCP-021C-PRESMOKE pipeline against bot-seeded rooms.
3. Only then launch the full MCP-021C autonomous pipeline.

## Cleanup recommendation

The 9 seeded result rows + 2 runs remain in the linked Supabase project.
They are harmless (the adapter correctly filters the defensive rows; the
valid rows demonstrate the persistence path works end-to-end). Options:

- Leave as test data (useful for MCP-021C development reference).
- Delete via service-role SQL when ready:
  ```sql
  delete from public.argument_machine_observation_runs
  where input_hash like 'smoke-%';
  ```
  The result rows cascade via the FK.

Operator decides at MCP-021C-PRESMOKE time.

## References

- Migration: `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`
- Design: `docs/designs/MCP-021B.md` (commit `553281d`)
- Intent brief: `docs/designs/MCP-021B-intent.md` (commit `2c95999`)
- Review: `docs/reviews/MCP-021B-review.md` (commit `bb9d936`)
- Sequencing: `docs/decisions/MCP-021-sequencing.md` (commit `d2282af`)
- Merge of MCP-021B: PR #303 at `eaa1aeb`
- Pre-smoke unblockers PR: #304 at `56b2fd8`
- Phase 1 / Phase 2 ad-hoc SQL was executed via
  `npx supabase db query --linked` (Management API). Inputs were
  written to `.claude-tmp/` (gitignored). Outputs were captured
  inline in the smoke session conversation; no persistent log files
  were created in the repo.
