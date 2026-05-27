# OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** OPS — observability quality
**Predecessor chain on main:**
- `OPS-MCP-OBSERVABILITY-SMOKE PARTIAL` at `0e98c27` (surfaced the Q12 bug)
- `OPS-MCP-OBSERVABILITY` ship at `d500037` (PR #321)
- `MCP-SERVER-004-FAMILY-C-SMOKE PASS` at `70b18f2`

---

## 1. The Q12 bug

The `OPS-MCP-OBSERVABILITY` smoke at `0e98c27` surfaced a counting error in the Q12 SQL at `scripts/ops/sql/12-unsupported-family-attempts.sql`:

```sql
(
  select count(res.id)
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r2 on r2.id = res.run_id
  where res.family = u.family_name
     or u.family_name = any(r2.requested_families)
) as positives_observed
```

The `OR u.family_name = any(r2.requested_families)` clause matches any result row whose run's `requested_families` array included the unsupported family — regardless of whether the result row's own `family` column is that unsupported family.

In multi-family admin_validation requests (which the system supports), this over-counts. For example, a run with `requested_families=['parent_relation','evidence_source_chain']` that produces 4 `parent_relation` positives will be counted as having 4 `evidence_source_chain` positives.

**Smoke observed output:** Q12 reported `evidence_source_chain` = 4 and `resolution_progress` = 4, totaling 8 over-counted positives.

**Ground truth (verified live):** Strict `where family in (unsupported list)` returns:
- `evidence_source_chain`: 1 positive row
- `resolution_progress`: 2 positive rows
- **Total: 3 unsupported-family positives** (all from synthetic test seed at 2026-05-26 05:56:33 with `provider_key='smoke-mcp:test-server'`).

---

## 2. The fix

Drop the `OR u.family_name = any(r2.requested_families)` clause. Count strictly by the row's persisted `family` column.

The unsupported-families list must be **derived from data** (Decision 2 below), not hardcoded. Hardcoding creates per-family-ship maintenance burden.

Decision 2: derive the supported-family set from `argument_machine_observation_results` by selecting `DISTINCT family` where `provider_key NOT LIKE 'smoke-%'` (exclude synthetic providers). Then `unsupported_families` is `DISTINCT family` minus that set.

---

## 3. Supported family derivation (Decision 2 verbatim)

```sql
WITH supported_families AS (
  SELECT DISTINCT family AS family_name
  FROM public.argument_machine_observation_results
  WHERE provider_key NOT LIKE 'smoke-%'  -- exclude synthetic providers
    AND family IS NOT NULL
),
unsupported_families AS (
  SELECT DISTINCT family AS family_name
  FROM public.argument_machine_observation_results
  WHERE family IS NOT NULL
    AND family NOT IN (SELECT family_name FROM supported_families)
)
```

**Note on `provider_key` location:** `provider_key` is on `argument_machine_observation_runs`, not on `argument_machine_observation_results`. The CTE will need to JOIN through runs to filter by `provider_key`. Designer Phase A.2 must produce the exact JOIN shape.

Edge cases addressed in Phase A.2:
- **Registered family with zero real rows yet:** would appear as "unsupported" until first real (non-synthetic) row lands. Today: Family A, B, C all have real rows (`mcp:classify_argument_boolean_observations` provider). Pre-Family-D: Family D will appear as unsupported until its first real row.
- **Real provider posts a row with an unregistered family:** the row appears in `unsupported_families` output — this is the correct security-adjacent surfacing.
- **Synthetic test rows:** filtered from `supported_families` derivation by `provider_key NOT LIKE 'smoke-%'`. They still appear in Q12 output (correctly) as unsupported-family positives until cleaned up by the next OPS card.

Alternative considered + rejected: **hardcoded supported family list** (`WHERE family IN ('parent_relation', 'disagreement_axis', 'misunderstanding_repair')`). Rejected because every family ship would require a follow-on PR to update this SQL, defeating the observability surface's promise of being a stable signal across family rollouts.

---

## 4. Out of scope

- Test data cleanup (next card: `OPS-MCP-TEST-DATA-CLEANUP`)
- Idempotency hardening (after that: `OPS-MCP-IDEMPOTENCY-HARDENING`)
- Any other observability SQL file (only Q12 changes)
- The Node runner script (`scripts/ops/mcp-observability-report.mjs`) — unchanged
- The library helpers (`scripts/ops/mcp-observability-report-lib.cjs`) — unchanged
- Database migrations (no schema change)
- Registry changes (`mcp-server/lib/familyRegistry.ts` / `familyRegistryInit.ts`)
- Edge Function changes
- Source 6 filter
- Family registration

---

## 5. HALT triggers (14)

Any ONE fires a HALT and surfaces:

### Scope (1-7):
1. Proposes editing any SQL file other than `scripts/ops/sql/12-unsupported-family-attempts.sql`.
2. Proposes editing the observability report `.mjs` runner.
3. Proposes adding a new SQL query.
4. Proposes a database migration.
5. Proposes registry changes (`mcp-server/lib/familyRegistry.ts` or `familyRegistryInit.ts`).
6. Proposes Family D/E/F/G/H/I/J registration.
7. Proposes test-data cleanup (next card; not this one).

### Correctness (8-11):
8. The new Q12 SQL returns counts that include rows where `family` column is supported (parent_relation, disagreement_axis, misunderstanding_repair).
9. The new Q12 SQL excludes legitimately-unsupported-family rows (false negative).
10. Designer Phase A does not enumerate the supported-family derivation approach (must pick one explicitly per Decision 2).
11. Test forecast exceeds +50 (this is XS; +5 to +15 expected).

### Doctrine (12-13):
12. Verdict/winner/fallacy tokens introduced in SQL comments.
13. SQL output exposes `evidence_span` content (default output must remain redacted per OPS-MCP-OBSERVABILITY safety).

### Working tree (14):
14. Unclassified untracked files at PR creation (operator-territory files are KNOWN exclusions).

---

## 6. Required Phase A audits (3)

### A.1 — Current Q12 SQL inspection + bug reproduction
- Read `scripts/ops/sql/12-unsupported-family-attempts.sql` verbatim.
- Identify the exact OR clause that causes over-counting (line numbers).
- Document the current return shape (columns + semantics).
- Confirm the bug by analyzing a known multi-family scenario where the OR clause produces a known over-count.

### A.2 — Data-derived supported-families approach
- Document the WITH CTE pattern per §3.
- Confirm `provider_key` is on the `runs` table, not `results`; produce the exact JOIN shape.
- Address edge cases:
  - Registered family with zero real rows yet.
  - Real provider posts a row with an unregistered family.
  - Synthetic test rows (`provider_key LIKE 'smoke-%'`) excluded from `supported_families` derivation.
- Confirm: post-fix Q12 will return exactly the 3 known synthetic test rows (1 evidence_source_chain + 2 resolution_progress).
- Document the rejected alternative (hardcoded list) and why.

### A.3 — Test plan
- Forecast test delta: +5 to +15 (HALT at +50).
- Test surface decision: pure Jest unit test parsing SQL execution against a mock pg-style query interface (Option A) or shell test against fixture DB (Option B). Default: Option A.
- Enumerate test cases:
  - OR-clause-bug regression test (the core proof).
  - Data-derived `supported_families` derivation test.
  - Edge case: zero real rows for a registered family.
  - Edge case: synthetic provider exclusion.
  - Verifies Q12 output count matches expected ground truth (3 rows) against fixture data.

---

## 7. Test forecast

+5 to +15 new tests. HALT trigger fires at +50. The OR-clause-regression test is the binding new test; supporting tests cover edge cases.

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="opsMcpObservability" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` (regression sanity; should be untouched)

---

## 8. Smoke plan

3-phase smoke audit at `docs/audits/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE-2026-05-27.md`:

### Phase 1 — Re-run report; verify Q12 output
- `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/q12-smoke`
- Inspect Q12 section in `/tmp/q12-smoke/report.md`.
- **Expected:** row count = 3 (1 evidence_source_chain + 2 resolution_progress). All 3 rows have `provider_key='smoke-mcp:test-server'`.

### Phase 2 — Regression sanity
- `npx jest --testPathPattern="opsMcpObservability" --no-coverage` → exit 0.
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` → exit 0.

### Phase 3 — Audit doc commit
- Author + commit + push smoke audit.

### Verdict rules

**PASS:**
- Q12 returns 3 rows.
- All 3 rows have `provider_key='smoke-mcp:test-server'`.
- Breakdown: 1 evidence_source_chain + 2 resolution_progress.
- Regression tests pass.

**FAIL:**
- Q12 returns > 3 or < 3 rows.
- Any synthetic-provider exclusion failure.
- Regression test failure.

---

## 9. Authorizations granted on PASS

- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE: PASS`.
- Q12 is now a clean signal for future smokes.
- `OPS-MCP-TEST-DATA-CLEANUP` is **authorized to begin** (clears the contamination).
- Family D Stage-2B decision (for `MCP-SERVER-005-FAMILY-D`) can cite Q12 as clean reference.

---

## 10. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING.md` | Designer's binding plan |
| `scripts/ops/sql/12-unsupported-family-attempts.sql` | The single file to edit |
| `__tests__/opsMcpObservabilityQ12*.test.ts` (NEW) | OR-clause regression + edge cases |
| `docs/audits/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE-2026-05-27.md` | Post-merge audit |

---

## 11. Execution order

1. Phase 0 pre-flight (DONE; this brief is the artifact).
2. Stage 0 — commit + push this intent brief to `main`.
3. Phase B — create `feat/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING` branch + GitHub issue.
4. Stage 1 — spawn roadmap-designer subagent.
5. Stage 2 — conditional HALT evaluation against the 14 triggers.
6. Stage 3 — spawn roadmap-implementer subagent.
7. Stage 4 — spawn roadmap-reviewer subagent.
8. Stage 5 — PR + squash-merge + post-merge gates.
9. Post-merge smoke (3-phase audit).
