# OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE — Post-merge audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** OPS-MCP-IDEMPOTENCY-HARDENING shipped at `055deb9` (PR #327; Cause-C-only path, operator-approved at Stage 2B).
**Audit doctrine:** Verifies the Q9 SQL classification refinement correctly labels the 3 historical duplicate-run pairs as `audit_or_smoke_rerun`, returns zero `organic_duplicate_candidate` rows, and preserves the conservative-default invariant. No runtime hardening was implemented per operator's Stage 2B binding decision.

---

## Verdict

**PASS.** Q9 now distinguishes documented audit/smoke re-fires from organic duplicate-risk candidates. All 3 historical pairs classify as `audit_or_smoke_rerun`. Zero `organic_duplicate_candidate` rows. Zero `needs_investigation`. Conservative-default invariant preserved (real organic duplicates would never silently classify as `audit_or_smoke_rerun`).

- **Live Q9 output:** 3 rows, all `audit_or_smoke_rerun` — matches RCA findings verbatim
- **Test count:** Jest 17,853 → 17,881 (+28 tests / +1 suite)
- **Targeted regression:** 13 suites / 169 tests PASS (combined opsMcpObservability + opsMcpTestDataCleanup + opsMcpIdempotencyHardening)
- **No runtime change:** zero edits under `supabase/migrations/`, `supabase/functions/`, `src/`, `mcp-server/`

**Authorizations granted:**
- `OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE: PASS`
- Q9 is now a fully classified signal alongside Q11 + Q12 (also clean post their respective cards)
- `MCP-SERVER-005-FAMILY-D` remains AUTHORIZED with mandatory Stage-2B operator-decision checkpoint; the observability surface is now fully calibrated for the Family D decision
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` remains AUTHORIZED to design
- `OPS-MCP-IDEMPOTENCY-HARDENING-RUNTIME` remains DEFERRED (not filed) — only file if future Q9 surfaces `organic_duplicate_candidate` rows

---

## Phase 1 — Re-run Q9 against linked DB

**Status:** PASS

```
npx supabase db query --linked --file scripts/ops/sql/09-duplicate-runs.sql
```

Results:

| argument_id | run_mode | family | duplicate_successful_runs | classification |
| --- | --- | --- | --- | --- |
| `781f8057-9e2a-4fa9-92a8-469676950ff7` | admin_validation | parent_relation | 2 | **audit_or_smoke_rerun** |
| `db0de3e0-24c6-40af-ba5f-2844acfa5bac` | admin_validation | parent_relation | 2 | **audit_or_smoke_rerun** |
| `ea82a836-f5d2-4ece-bd34-ed5a57409dde` | production | parent_relation | 2 | **audit_or_smoke_rerun** |

All 3 historical pairs correctly classified. Provider for all 6 runs is the real `mcp:classify_argument_boolean_observations` (not synthetic).

**Comparison (pre-card vs post-card):**

| Field | Pre-card Q9 output | Post-card Q9 output |
| --- | --- | --- |
| Row count | 3 | 3 |
| `classification` column | (absent) | present on all rows |
| Pair 1 (781f8057) | flagged as duplicate-risk | classified as `audit_or_smoke_rerun` |
| Pair 2 (db0de3e0) | flagged as duplicate-risk | classified as `audit_or_smoke_rerun` |
| Pair 3 (ea82a836) | flagged as duplicate-risk (production-mode; concerning) | classified as `audit_or_smoke_rerun` (documented Phase 6 manual re-fire) |
| `organic_duplicate_candidate` count | (no classification; all 3 looked like organic) | 0 |
| `needs_investigation` count | N/A | 0 |
| `synthetic_test_data` count | N/A | 0 (synthetic rows already removed by previous cleanup card) |

---

## Phase 2 — Targeted regression

**Status:** PASS

```
npx jest --testPathPattern="(opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage
→ Test Suites: 13 passed, 13 total
  Tests:       169 passed, 169 total
EXIT: 0
```

Test count: **169** (was 141 post-TEST-DATA-CLEANUP-SMOKE; +28 new from this card's `opsMcpIdempotencyHardening.test.ts`).

```
npm run typecheck → exit 0
npm run lint → exit 0
```

mcp-server Deno tests untouched (no `mcp-server/` file modified).

---

## Phase 3 — Binding NO-GO verification

**Status:** PASS (all 8 NO-GO items verified absent)

| NO-GO item | Verification | Result |
| --- | --- | --- |
| No migration | `git diff main^..main -- supabase/migrations/` returns empty for new files | PASS |
| No partial UNIQUE INDEX | Grep for `unique index` in diff returns zero | PASS |
| No `admin_force_rerun` | Grep for `admin_force_rerun` in diff returns zero | PASS |
| No Edge Function change | `git diff main^..main -- supabase/functions/` returns empty | PASS |
| No request-shape change | classify-argument-boolean-observations request body schema unchanged | PASS |
| No `autoTriggerDispatcher.ts` change | File byte-equal | PASS |
| No `classifyArgumentCore.ts` union widening | File byte-equal | PASS |
| No production behavior change | Zero src/ + mcp-server/ + supabase/functions/ edits | PASS |

The binding NO-GO list is also defended by `__tests__/opsMcpIdempotencyHardening.test.ts` Group E (Stage 2B NO-GO defense), which actively asserts these constraints in CI.

---

## Phase 4 — Verdict + audit commit

### Final verdict

**PASS** — All criteria met:
- Q9 classifies all 3 historical pairs correctly as `audit_or_smoke_rerun`
- Zero `organic_duplicate_candidate` rows (no real duplicate risk currently)
- Conservative-default invariant preserved (default branch in CASE = `organic_duplicate_candidate`; future organic duplicates will surface)
- All tests pass; typecheck + lint exit 0
- Zero binding NO-GO violations

### Observations

- **Three-OPS-card progression complete:** Q12 over-counting fixed (Q12 fix), synthetic test data removed (cleanup), Q9 classified (this card). Q11 + Q12 + Q9 are now ALL clean signals for the observability surface.
- **Cause-C-only path was the right call:** RCA found the original Q9 "finding" was entirely documented audit/smoke re-fires. The operator's choice to skip runtime hardening and refine the observability signal instead matches the doctrine: don't build defenses for problems that aren't actually happening.
- **Conservative default is the load-bearing invariant:** the test at `__tests__/opsMcpIdempotencyHardening.test.ts:318-335` ensures future maintainers can't accidentally widen the audit-or-smoke-rerun classification to swallow real duplicate risk.
- **Heuristic documentation in Q9 SQL header** is comprehensive (117 lines explaining categories + detection signals + operator-action mapping + audit citations). Future operators reading the SQL standalone will understand WHY.
- **Family D Stage-2B decision baseline ready:** observability surface fully calibrated.

### Authorizations confirmed on PASS

- `OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE: PASS`
- Q9 + Q11 + Q12 all clean signals
- `MCP-SERVER-005-FAMILY-D` remains AUTHORIZED with Stage-2B checkpoint; observability surface fully calibrated for the subset-filter decision
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` remains AUTHORIZED to design (lower priority)
- `OPS-MCP-IDEMPOTENCY-HARDENING-RUNTIME` DEFERRED — only file if future Q9 surfaces `organic_duplicate_candidate` rows

### Operator cleanup

After audit doc commits, temp artifacts may be deleted:
- `/tmp/idemp-postmerge-*.log`
- `/tmp/q9-current.sql`
- `/tmp/q9-timestamps.sql`

None contain secrets.
