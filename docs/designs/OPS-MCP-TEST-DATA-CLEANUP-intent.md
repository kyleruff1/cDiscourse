# OPS-MCP-TEST-DATA-CLEANUP — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** OPS — data hygiene
**Predecessor chain on main:**
- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE PASS` at `19b8d8a` (Q12 now clean signal)
- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING` ship at `e060eef` (PR #323)
- `OPS-MCP-OBSERVABILITY-SMOKE PARTIAL` at `0e98c27` (surfaced the contamination)
- `OPS-MCP-OBSERVABILITY` ship at `d500037` (PR #321)

---

## 1. The contamination

The OBSERVABILITY smoke at `0e98c27` surfaced synthetic test rows in the persistence layer. The Q12-SEMANTIC-TIGHTENING smoke at `19b8d8a` confirmed they persist post-Q12-fix. Per Phase 0 live DB query at brief authoring (`provider_key LIKE 'smoke-%'`):

**Total: 2 runs + 9 result rows = 11 rows.**

All rows share:
- `provider_key = 'smoke-mcp:test-server'` (NOT the real `mcp:classify_argument_boolean_observations`)
- `model_name = 'smoke-test-model-v1'`
- `created_at = '2026-05-26 05:56:33.772763+00'` (single insertion event)
- `run_mode = 'production'`
- `status = 'success'`
- `failure_reason = NULL`

### Binding row inventory (verbatim from live DB)

**Run 1** — `id=2a16fe8b-ff19-4112-9f41-aab6be5e1a82` — `argument_id=f41b18b0-8ad6-4865-94c5-17a568f6a6ad` — `requested_families=['parent_relation','misunderstanding_repair']`

| family | rawKey | confidence |
| --- | --- | --- |
| misunderstanding_repair | offers_candidate_understanding | high |
| misunderstanding_repair | requests_clarification | high |
| parent_relation | refines_parent | high |
| parent_relation | supports_parent | high |
| parent_relation | **totally_made_up_key_should_be_discarded** | high |

(The fake key `totally_made_up_key_should_be_discarded` confirms the developer-test-data nature of this seed; this rawKey is not in the MCP-021A registered taxonomy.)

**Run 2** — `id=ff2bd3cc-2e06-411b-878b-b7ceb9139dfd` — `argument_id=781f8057-9e2a-4fa9-92a8-469676950ff7` — `requested_families=['evidence_source_chain','resolution_progress']`

| family | rawKey | confidence |
| --- | --- | --- |
| evidence_source_chain | evidence_gap_present | high |
| parent_relation | supports_parent | high |
| resolution_progress | concedes_narrow_point | high |
| resolution_progress | synthesis_proposed | high |

**Designer Phase A.1 MUST re-verify these 11 row IDs against live DB.** The migration's WHERE clause must match the inventory exactly. HALT trigger 5 (delete > 8 rows) was authored against a stale row-count estimate from the OBSERVABILITY smoke audit; the true count is 11 (2 runs + 9 results). HALT trigger 5 binding count is updated to **11 rows**.

---

## 2. Why this row count matters

The 11-row inventory is the **binding gate** for the migration's WHERE clause. Any deviation (more or fewer rows affected) is a HALT (per trigger 6, scope-creep on backfill). The migration must be:

- **Idempotent:** running twice is a no-op (Approach A: DELETE with `WHERE provider_key = 'smoke-mcp:test-server'`; second run finds zero rows; UPDATE for Approach B uses the same WHERE plus `is_synthetic = FALSE` predicate).
- **Tightly bounded:** WHERE clause matches ONLY `provider_key = 'smoke-mcp:test-server'` (single, exact provider_key — not a `LIKE 'smoke-%'` pattern, which could match future synthetic providers we haven't yet designed for).

---

## 3. Two approaches; mandatory Stage 2B operator-decision checkpoint

### Approach A — Hard delete

```sql
-- Migration: <timestamp>_ops_mcp_test_data_cleanup.sql
BEGIN;

-- The ON DELETE CASCADE FK from results.run_id → runs.id automatically deletes results.
-- This single DELETE removes the 2 runs + 9 results in one transaction.
DELETE FROM public.argument_machine_observation_runs
WHERE provider_key = 'smoke-mcp:test-server';

COMMIT;
```

**Pros:**
- Simplest implementation; single DELETE statement.
- No schema change; no follow-on filter logic anywhere.
- Q11 and Q12 immediately return 0 unsupported-family positives.
- No maintenance burden in observability SQL or Source 6.

**Cons:**
- No audit trail of the historical synthetic seed.
- Future synthetic-data leaks (if any developer uses the same pattern) require a follow-on card.
- Hard delete is irreversible; depends on the schema's CASCADE behavior being correct.

### Approach B — Quarantine via `is_synthetic` column

```sql
-- Migration: <timestamp>_ops_mcp_test_data_cleanup.sql
BEGIN;

-- 1. Add quarantine column.
ALTER TABLE public.argument_machine_observation_runs
ADD COLUMN is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill the 2 known synthetic runs.
UPDATE public.argument_machine_observation_runs
SET is_synthetic = TRUE
WHERE provider_key = 'smoke-mcp:test-server'
  AND is_synthetic = FALSE;  -- idempotency guard
-- Expected affected rows: 2.

-- 3. Add a partial index for fast filtering.
CREATE INDEX IF NOT EXISTS amor_runs_synthetic_idx
  ON public.argument_machine_observation_runs (is_synthetic)
  WHERE is_synthetic = TRUE;

COMMIT;
```

Plus required code changes:
- **Source 6 filter** at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` adds `.eq('argument_machine_observation_runs.is_synthetic', false)` (binding; the smoke audit found 1 production-mode synthetic row that would render through Source 6 today).
- **All 14 observability SQL files** in `scripts/ops/sql/` add an `is_synthetic = FALSE` predicate (or `is_synthetic IS DISTINCT FROM TRUE` for nullable safety) on `argument_machine_observation_runs` JOINs. The Q12 SQL's `unsupported_families` CTE remains intact; only the per-section production-mode aggregates need the additional filter.
- New SQL pattern for the existing `supported_families` CTE in Q12: `WHERE provider_key NOT LIKE 'smoke-%' AND is_synthetic = FALSE` (defense in depth).

**Pros:**
- Audit trail preserved.
- Future synthetic-data leaks (same convention) get auto-quarantined.
- Source 6 filter is explicitly tightened (closes the production-mode-synthetic-row leak the OBSERVABILITY smoke surfaced).
- Reversible (UPDATE is_synthetic = FALSE undoes the quarantine).

**Cons:**
- Schema migration with new column + index.
- 14 SQL files + 1 src file need updates.
- More surface area; more tests.
- Source 6 filter touch is a doctrine boundary edit (Source 6 lives in src/, normally locked for OPS cards).

---

## 4. Mandatory Stage 2B operator-decision checkpoint

Per Decision 1 of the operator launch text, the designer produces:
- A clear recommendation between Approach A and Approach B.
- The full row inventory (§1 above, re-verified live by Phase A.1).
- The exact migration SQL outline.
- A trade-offs analysis.

The pipeline then HALTs at Stage 2B and surfaces a "Pick A or B" message to the operator. **Implementer cannot start until the operator explicitly chooses A or B (or overrides with reasoning).**

The Stage 2B message must include:
- Designer's recommendation
- Approach A consequences (clean but lossy)
- Approach B consequences (preservative but broader edit)
- Specific 2-run + 9-result inventory with row IDs
- Source 6 filter touch implication (Approach B only)
- Test forecast per approach (Approach A: ~+10; Approach B: ~+25)
- Explicit "Operator: pick A or B" request

---

## 5. Out of scope

- Q12 SQL fix (DONE: `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE PASS` at `19b8d8a`)
- Idempotency hardening (next card: `OPS-MCP-IDEMPOTENCY-HARDENING`)
- Family D/E/F/G/H/I/J registration
- Auto-trigger changes
- Edge Function logic changes
- MCP server changes
- Taxonomy or prompt changes
- New observability sections / queries
- Any data deletion BEYOND the 11-row synthetic-test-data inventory

---

## 6. HALT triggers (18)

Any ONE fires HALT.

### Registry + data safety (1-6):
1. `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE` missing from main (this card requires Q12 fix landed first — verified at `19b8d8a`).
2. DELETE statements touching rows from non-synthetic providers (`provider_key NOT LIKE 'smoke-%'`).
3. Migration touches tables beyond `argument_machine_observation_*`.
4. Source 6 filter change weakens production-only behavior (Approach B may tighten, never weaken).
5. Migration deletes or updates more than 11 rows (2 runs + 9 results binding inventory; HALT on scope creep).
6. Backfill query covers more rows than declared in Phase A.1 inventory.

### Protocol + security (7-10):
7. Registry change proposed (`mcp-server/lib/familyRegistry.ts`).
8. Edge Function change proposed (`supabase/functions/*`).
9. UI change proposed (`src/*` beyond the single Source 6 filter line for Approach B).
10. Taxonomy or prompt change proposed.

### Architecture (11-14):
11. Approach A chosen without explicit operator Stage 2B approval.
12. Approach B chosen without explicit operator Stage 2B approval.
13. Schema migration introduces a non-backward-compatible breaking change (Approach B adds a NOT NULL DEFAULT FALSE column — backward-compatible).
14. Test forecast > +60 (this is S; +10 to +25 expected).

### Doctrine (15-16):
15. Verdict tokens in user-facing strings (defensive).
16. PII or argument body content appears in cleanup migration or test output (defensive).

### Working tree (17-18):
17. Unclassified untracked files at PR creation.
18. Backfill/cleanup script committed to `scripts/` instead of as a migration in `supabase/migrations/` (must be a migration, not an ad-hoc script).

---

## 7. Required Phase A audits (4)

### A.1 — Row inventory verification
- Query the live DB for all rows with `provider_key LIKE 'smoke-%'`.
- List exact UUIDs for the 2 runs + 9 results.
- Confirm the per-run + per-family breakdown matches §1 above.
- Document any deviation. If row count differs from 11, surface and HALT.

### A.2 — Approach analysis
- Approach A (hard delete): list pros + cons + exact migration SQL + test surface.
- Approach B (quarantine): list pros + cons + exact migration SQL + Source 6 filter change + 14-SQL-file filter updates + test surface.
- **Designer recommendation** (must pick one with rationale).

### A.3 — Detailed migration script
- Exact migration file name (`supabase/migrations/<timestamp>_ops_mcp_test_data_cleanup.sql`).
- Exact SQL per chosen approach (designer Phase A.3 produces both A's and B's full text; operator picks at Stage 2B).
- Idempotency proof: running the migration twice has no additional effect.

### A.4 — Test plan per approach
- Approach A: test that migration deletes exactly the 11 rows; running twice is no-op; non-synthetic rows untouched.
- Approach B: test the column + index added; backfill matches inventory; Source 6 filter correctly excludes is_synthetic=TRUE; all 14 observability SQL files correctly filter.
- Forecast: +10 (A) or +25 (B).

---

## 8. Test forecast

- Approach A: +10 (small migration; small test surface).
- Approach B: +25 (column + index + Source 6 + 14 SQL updates).
- HALT at +60 (well clear of both).

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability|opsMcpTestDataCleanup)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` (regression sanity; should be byte-equal)

---

## 9. Smoke plan

5-phase post-merge audit at `docs/audits/OPS-MCP-TEST-DATA-CLEANUP-SMOKE-2026-05-27.md`:

### Phase 1 — Pre-flight + migration verification
- HEAD at merge SHA.
- Apply migration (or verify auto-applied by Supabase deploy).
- Verify Q11 + Q12 in observability report.

### Phase 2 — Run observability report
- `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/cleanup-smoke`.
- Inspect Q11: 0 misunderstanding_repair / 0 evidence_source_chain / 0 resolution_progress production rows.
- Inspect Q12: 0 unsupported-family-positive rows (down from 3 pre-cleanup).

### Phase 3 — Source 6 verification (Approach B only)
- Run a test query that simulates Source 6's read path:
- Confirm no `is_synthetic=true` rows surface.
- Confirm production parent_relation rows still surface.

### Phase 4 — Regression sanity
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability|opsMcpTestDataCleanup)"` → exit 0.
- `cd mcp-server && deno test` → exit 0.

### Phase 5 — Audit doc commit
- Author + commit + push smoke audit.

### Verdict rules

**PASS:**
- Q11 + Q12 reflect clean state (0 contamination).
- No non-synthetic row affected (Approach A inventory match).
- Source 6 still works for non-synthetic production rows (Approach B).
- Regression tests pass.

**FAIL:**
- Any non-synthetic row affected (catastrophic).
- Source 6 broken (Approach B).
- Q11 / Q12 still surface contamination.

---

## 10. Authorizations granted on PASS

- `OPS-MCP-TEST-DATA-CLEANUP-SMOKE: PASS`.
- Q11 + Q12 now reflect clean operational state.
- `OPS-MCP-IDEMPOTENCY-HARDENING` is **AUTHORIZED to begin** (Q9's 3 duplicate-run pairs are now the only outstanding observability finding).
- `MCP-SERVER-005-FAMILY-D` Stage-2B decision can cite a clean Q11 / Q12 / cleanup baseline.

---

## 11. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/OPS-MCP-TEST-DATA-CLEANUP.md` | Designer's binding plan + Approach A/B recommendation |
| `supabase/migrations/<timestamp>_ops_mcp_test_data_cleanup.sql` | The single migration that effects cleanup (form depends on operator Stage 2B choice) |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts` | Source 6 filter (Approach B only; line 127 extension) |
| `scripts/ops/sql/*.sql` | Observability filter updates (Approach B only; 14 files) |
| `__tests__/opsMcpTestDataCleanup*.test.ts` | Coverage for the cleanup + filter logic |
| `docs/audits/OPS-MCP-TEST-DATA-CLEANUP-SMOKE-2026-05-27.md` | Post-merge audit |

---

## 12. Execution order

1. Phase 0 pre-flight (DONE; inventory captured above).
2. Stage 0 — commit + push this intent brief to `main`.
3. Phase B — create `feat/OPS-MCP-TEST-DATA-CLEANUP` branch + GitHub issue.
4. Stage 1 — spawn roadmap-designer subagent (Phase A.1–A.4).
5. Stage 2A — conditional HALT evaluation against the 18 triggers.
6. **STAGE 2B — MANDATORY operator-decision checkpoint** (Approach A vs Approach B). Pipeline HALTs here.
7. Stage 3 — spawn roadmap-implementer subagent (per operator's Stage 2B choice).
8. Stage 4 — spawn roadmap-reviewer subagent.
9. Stage 5 — PR + squash-merge + post-merge gates.
10. Post-merge smoke (5-phase).
