# OPS-MCP-TEST-DATA-CLEANUP-SMOKE — Post-merge audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** OPS-MCP-TEST-DATA-CLEANUP shipped at `6455a99` (PR #325; Approach A hard delete, operator-approved at Stage 2B).
**Audit doctrine:** Verifies the hard-delete migration auto-applied via the Supabase GitHub integration, removed exactly the 11 known synthetic test rows (`provider_key='smoke-mcp:test-server'`), and left all non-synthetic rows untouched. The OBSERVABILITY contamination findings from the smoke at `0e98c27` (Q11 production-mode misunderstanding_repair + Q12 unsupported-family positives) are now cleared.

---

## Verdict

**PASS.** Migration auto-applied via Supabase GitHub integration. Exactly 11 rows deleted (2 runs + 9 results via FK CASCADE). All 28 non-synthetic runs + 34 non-synthetic results untouched. Q11 and Q12 reflect clean operational state.

- **Synthetic rows remaining:** 0 (was 2 runs + 9 results = 11 rows pre-merge)
- **Total runs:** 28 (was 30 pre-merge; delta -2 matches the 2 synthetic runs)
- **Total results:** 34 (was 43 pre-merge; delta -9 matches the 9 synthetic results via CASCADE)
- **Q11 cleanup:** misunderstanding_repair production-mode row eliminated; Family B + C remain strictly admin_validation-only
- **Q12 cleanup:** "No unsupported-family attempts observed" (was 3 positives pre-merge)

**Authorizations granted:**
- `OPS-MCP-TEST-DATA-CLEANUP-SMOKE: PASS`.
- Persistence layer aggregates now reflect actual production state.
- `OPS-MCP-IDEMPOTENCY-HARDENING` is **AUTHORIZED to begin** (Q9's 3 duplicate-run pairs are now the only outstanding observability finding).
- `MCP-SERVER-005-FAMILY-D` Stage-2B decision can cite a clean Q11/Q12/cleanup baseline.

---

## Phase 1 — Pre-flight + migration auto-apply verification

**Status:** PASS

`main` at `6455a99` (`OPS-MCP-TEST-DATA-CLEANUP: hard-delete 11 synthetic test rows (Approach A; operator-approved at Stage 2B) (#325)`). Working tree contains only the 10 known operator-territory untracked files.

Migration auto-applied via Supabase GitHub integration (no manual `npx supabase db push --linked` required; the integration auto-applies migrations on merge-to-main).

Live DB row count verification:

```sql
SELECT
  (SELECT COUNT(*) FROM public.argument_machine_observation_runs WHERE provider_key LIKE 'smoke-%') AS remaining_synthetic_runs,
  (SELECT COUNT(*) FROM public.argument_machine_observation_results r
     INNER JOIN public.argument_machine_observation_runs run ON run.id = r.run_id
     WHERE run.provider_key LIKE 'smoke-%') AS remaining_synthetic_results,
  (SELECT COUNT(*) FROM public.argument_machine_observation_runs) AS total_runs,
  (SELECT COUNT(*) FROM public.argument_machine_observation_results) AS total_results;
```

| Counter | Pre-merge (per intent brief §1) | Post-merge | Delta | Expected delta |
| --- | --- | --- | --- | --- |
| remaining_synthetic_runs | 2 | **0** | -2 | -2 ✓ |
| remaining_synthetic_results | 9 | **0** | -9 | -9 ✓ |
| total_runs | 30 | **28** | -2 | -2 ✓ |
| total_results | 43 | **34** | -9 | -9 ✓ |

All four deltas match the binding 11-row inventory exactly. CASCADE behavior worked correctly: the single `DELETE FROM ... runs` statement removed the 2 runs and their 9 child results in a single atomic transaction (Postgres's implicit migration transaction).

---

## Phase 2 — Re-run observability report; verify Q11 + Q12 clean

**Status:** PASS

```
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/cleanup-smoke
→ [run] q01...q14 / write report.md + report.json
EXIT: 0
```

### Q11 — Family B and C admin-validation-only check

```
| requested_family | run_mode | run_count |
| --- | --- | --- |
| disagreement_axis | admin_validation | 3 |
| misunderstanding_repair | admin_validation | 3 |
```

**Comparison (pre-merge vs post-merge):**

| Row | Pre-merge | Post-merge | Status |
| --- | --- | --- | --- |
| disagreement_axis admin_validation | 3 | 3 | UNCHANGED (real admin_validation traffic) |
| misunderstanding_repair admin_validation | 3 | 3 | UNCHANGED (real admin_validation traffic from Family C smoke) |
| **misunderstanding_repair production** | **1** (synthetic) | **(absent)** | **CLEARED** |

The previously-anomalous `misunderstanding_repair production` row (the synthetic seed that confused Q11 in the OBSERVABILITY smoke at `0e98c27`) is now gone. Family B and Family C are strictly admin_validation-only, matching their `productionEnabled: false` Edge registry state.

### Q12 — Unsupported-family attempt visibility

```
<sub>No unsupported-family attempts observed.</sub>
```

**Comparison:**

| Family | Pre-merge positives | Post-merge positives | Status |
| --- | --- | --- | --- |
| evidence_source_chain | 1 (synthetic) | 0 | CLEARED |
| resolution_progress | 2 (synthetic) | 0 | CLEARED |

The Q12 SEMANTIC TIGHTENING fix narrowed the count from the originally-reported inflated 4+4=8 to the true 1+2=3 synthetic positives; this card's cleanup migration now eliminates those 3 underlying rows. Q12 returns "No unsupported-family attempts observed" — a clean signal.

Combined with Q12-SEMANTIC-TIGHTENING (which removed the OR clause + introduced data-derived `supported_families`), Q12 is now reading the post-cleanup state correctly:
- `supported_families` CTE identifies parent_relation + disagreement_axis + misunderstanding_repair as supported (they have real-provider rows).
- `unsupported_families` CTE produces an empty set (no remaining rows have families outside the supported set).
- The Q12 main query's LEFT JOIN against the now-empty `unsupported_families` returns zero rows.
- The report renders "No unsupported-family attempts observed" gracefully.

---

## Phase 3 — Source 6 verification

**Status:** NOT APPLICABLE

Approach A (hard delete) does not touch Source 6. The Source 6 filter at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` remains unchanged: `.eq('argument_machine_observation_runs.run_mode', 'production')`. The synthetic production-mode misunderstanding_repair row that would have rendered through Source 6 today is now physically deleted; the filter does not need to be tightened to exclude it.

(Approach B would have added `.eq('argument_machine_observation_runs.is_synthetic', false)` to defend against future leaks; the operator's Stage 2B choice of Approach A defers that defense to a separate optional follow-on `OPS-MCP-INSERT-GUARDRAILS` card.)

---

## Phase 4 — Targeted regression

**Status:** PASS

```
npx jest --testPathPattern="(opsMcpObservability|opsMcpTestDataCleanup)" --no-coverage
→ Test Suites: 12 passed, 12 total
  Tests:       141 passed, 141 total
EXIT: 0
```

Test count: **141** (was 122 pre-Q12-fix → 131 post-Q12-fix → 141 post-cleanup; +10 new from this card's `opsMcpTestDataCleanup.test.ts`).

```
npm run typecheck → exit 0
npm run lint → exit 0
```

mcp-server Deno tests untouched (no `mcp-server/` file modified).

---

## Phase 5 — Verdict + audit commit

### Final verdict

**PASS** — All criteria met:
- Phase 1: migration auto-applied; exactly 11 rows deleted; non-synthetic rows untouched.
- Phase 2: Q11 misunderstanding_repair production row cleared; Q12 reports clean state.
- Phase 3: N/A (Approach A; no Source 6 change required).
- Phase 4: targeted regression all green; typecheck + lint exit 0.

### Observations

- **CASCADE behavior verified end-to-end:** the FK `argument_machine_observation_results.run_id → argument_machine_observation_runs.id ON DELETE CASCADE` (declared in `20260526000018`) correctly removed all 9 result rows when the 2 parent run rows were deleted. No orphan rows.
- **Exact-equality WHERE clause worked as expected:** `provider_key = 'smoke-mcp:test-server'` matched exactly 2 runs and no others. No collateral damage.
- **Real production data preserved:** 28 non-synthetic runs and 34 non-synthetic results remain intact. The Family A production auto-trigger traffic (per `MCP-021C-AUTO-TRIGGER-FAMILY-A`), Family A/B/C admin_validation smoke traffic, and Family A production prod smoke (per `MCP-021C-FAMILY-A-PROD-SMOKE`) are all preserved.
- **Q11 + Q12 are now clean signals** suitable for Family D Stage-2B reference.
- **Idempotency confirmed by construction:** a second run of the migration's DELETE would match zero rows (the 11 synthetic rows are physically gone). The natural-idempotency pattern (DELETE with WHERE-clause matching nothing on second run) holds.

### Authorizations confirmed on PASS

- `OPS-MCP-TEST-DATA-CLEANUP-SMOKE: PASS`.
- Q11 + Q12 are now clean signals.
- `OPS-MCP-IDEMPOTENCY-HARDENING` is **AUTHORIZED to begin** (Q9's 3 duplicate-run pairs are the only outstanding observability finding from the original OBSERVABILITY smoke at `0e98c27`).
- `MCP-SERVER-005-FAMILY-D` Stage-2B operator-decision checkpoint can cite Q11/Q12 clean baselines.
- Optional follow-on `OPS-MCP-INSERT-GUARDRAILS` may be filed if the operator wants active future-leak defense (insert-time CHECK against `provider_key LIKE 'smoke-%'`). Per Stage 2B Approach A, this is a separate card.

### Operator cleanup

After audit doc commits, the following temp artifacts may be deleted:
- `/tmp/cleanup-smoke/report.md`
- `/tmp/cleanup-smoke/report.json`
- `/tmp/cleanup-postmerge-*.log`
- `/tmp/cleanup-verify-single.sql`
- `/tmp/cleanup-inventory-runs.sql`
- `/tmp/cleanup-inventory-results.sql`
- `/tmp/cleanup-breakdown.sql`
- `/tmp/cleanup-totals.sql`
- `/tmp/cleanup-verify.sql`

None contain secrets (aggregate counts and UUIDs only).
