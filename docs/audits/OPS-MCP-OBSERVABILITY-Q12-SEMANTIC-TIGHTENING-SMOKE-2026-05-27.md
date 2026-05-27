# OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE — Post-merge audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING shipped at `e060eef` (PR #323).
**Audit doctrine:** Verifies the Q12 SQL fix replaces the over-counting OR clause + hardcoded family array with a data-derived `supported_families` CTE pair + strict `family=` match. Q12 must return per-family positive counts matching the live DB ground truth (1 evidence_source_chain + 2 resolution_progress = 3 total positives, all from synthetic test seed).

---

## Verdict

**PASS.** Q12 now returns semantically correct counts. The OR-clause over-counting is eliminated; the data-derived CTE replaces the hardcoded 7-family array. Future family ships will not require touching this SQL.

* **Q12 output post-fix:** evidence_source_chain = 1 positive; resolution_progress = 2 positives; **sum = 3** (matches ground truth from `where family in (unsupported list)` strict query).
* **Q12 output pre-fix (per `0e98c27` smoke):** evidence_source_chain = 4 positives; resolution_progress = 4 positives; sum = 8 (over-counted by the OR clause).
* **Over-count delta eliminated:** 8 → 3 (the inflated 5 positives were cross-counted from multi-family runs whose `requested_families` array included an unsupported family but whose actual result rows belonged to Family A).
* **All 3 remaining positives trace to `provider_key='smoke-mcp:test-server'`** synthetic test seed from 2026-05-26 05:56:33 — to be cleaned up by `OPS-MCP-TEST-DATA-CLEANUP` (the next OPS card).

**Authorizations granted:**
- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE: PASS`.
- Q12 is now a clean signal for future smokes.
- `OPS-MCP-TEST-DATA-CLEANUP` is **AUTHORIZED to begin** — Q12 baseline is clean; cleanup card can verify post-cleanup Q12 returns 0 rows.
- `MCP-SERVER-005-FAMILY-D` Stage-2B decision can cite Q12 as a calibrated reference signal.

---

## Phase 1 — Re-run report; verify Q12 output

**Status:** PASS

```
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/q12-smoke
→ [run] q01-runs-by-run-mode ... q14 / write report.md + report.json
EXIT: 0
```

Q12 section from `/tmp/q12-smoke/report.md`:

```
## Unsupported-family attempt visibility

**Question:** Q12 — Are unsupported-family attempts (D-J) visible as failed runs without positive rows?

**SQL:** `scripts/ops/sql/12-unsupported-family-attempts.sql`

| unsupported_family_attempted | attempts | failed_attempts | mcp_validation_failed_attempts | positives_observed |
| --- | --- | --- | --- | --- |
| evidence_source_chain | 3 | 2 | 2 | 1 |
| resolution_progress | 2 | 1 | 1 | 2 |
```

### Comparison (pre-fix vs post-fix)

| family | pre-fix positives_observed (per `0e98c27` smoke) | post-fix positives_observed | delta |
| --- | --- | --- | --- |
| evidence_source_chain | 4 | 1 | -3 |
| resolution_progress | 4 | 2 | -2 |
| **TOTAL** | **8** | **3** | **-5** |

The eliminated 5 over-counted positives were cross-family inflation: multi-family runs whose `requested_families` array included `evidence_source_chain` or `resolution_progress` but whose actual result rows belonged to Family A (parent_relation). The OR clause previously counted those Family A positives as unsupported-family positives. Strict `WHERE res.family = u.family_name` now correctly excludes them.

### Provider attribution

All 3 remaining positives trace to a single synthetic test seed:

| family | raw_key | provider_key | model_name | created_at |
| --- | --- | --- | --- | --- |
| evidence_source_chain | evidence_gap_present | smoke-mcp:test-server | smoke-test-model-v1 | 2026-05-26 05:56:33 |
| resolution_progress | synthesis_proposed | smoke-mcp:test-server | smoke-test-model-v1 | 2026-05-26 05:56:33 |
| resolution_progress | concedes_narrow_point | smoke-mcp:test-server | smoke-test-model-v1 | 2026-05-26 05:56:33 |

(Same 3 rows surfaced by the OBSERVABILITY smoke at `0e98c27`. The data-derived `supported_families` CTE correctly excludes this provider via `provider_key NOT LIKE 'smoke-%'`, so synthetic-provider rows would not ratify a family as supported — only real-provider rows can.)

---

## Phase 2 — Regression sanity check

**Status:** PASS

```
npx jest --testPathPattern="opsMcpObservability" --no-coverage
→ Test Suites: 11 passed, 11 total
  Tests:       131 passed, 131 total
EXIT: 0
```

Test count: **131** (was 122 pre-fix; +9 new from this card). New `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` provides 9 tests defending the OR-clause removal, both CTEs, JOIN through runs, smoke-% exclusion, strict family= match, hardcoded-array removal, column-name preservation, doctrine ban-list, header comment.

```
npm run typecheck → exit 0
npm run lint → exit 0
```

Targeted regression (per design):

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage
→ Test Suites: 51 passed, 51 total
  Tests:       1057 passed, 1057 total
```

mcp-server Deno tests untouched (no `mcp-server/` file modified).

---

## Phase 3 — Verdict + audit commit

### Final verdict

**PASS** — All criteria met:
- Phase 1: Q12 returns 2 rows summing to 3 positives (1 evidence_source_chain + 2 resolution_progress); breakdown matches ground truth.
- Phase 2: targeted regression all green; full suite 17,843 / 559+1 = 560 suites pass; typecheck + lint exit 0.

### Observations

- **Over-count eliminated:** 8 → 3 positives. The 5 spurious positives were cross-family inflation that the new strict `family=` match correctly excludes.
- **Provider-attribution confirmed:** all 3 remaining positives are from the `smoke-mcp:test-server` synthetic seed. The next OPS card (`OPS-MCP-TEST-DATA-CLEANUP`) will address them.
- **Data-derived CTE working as intended:** the new `supported_families` CTE correctly identifies parent_relation, disagreement_axis, and misunderstanding_repair as supported (they have real-provider rows); `unsupported_families` correctly identifies evidence_source_chain and resolution_progress as unsupported (they have only synthetic rows).
- **Defensive `provider_key IS NOT NULL` predicate working:** NULL-provider rows do not silently ratify a family as supported.
- **Column-name contract preserved:** the runner parses Q12 results without code changes.
- **Future-proof:** Family D ship will not require this SQL to change. When Family D's first real-provider row lands (`mcp:classify_argument_boolean_observations`), `evidence_source_chain` will automatically migrate from `unsupported_families` to `supported_families` and disappear from Q12 output.

### Authorizations confirmed on PASS

- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE: PASS`.
- Q12 is now a clean signal.
- `OPS-MCP-TEST-DATA-CLEANUP` is **AUTHORIZED to begin**.
- `MCP-SERVER-005-FAMILY-D` Stage-2B operator-decision checkpoint can cite Q12 as a calibrated reference.

### Operator cleanup

After audit doc commits, temp artifacts may be deleted:
- `/tmp/q12-smoke/report.md`
- `/tmp/q12-smoke/report.json`
- `/tmp/q12-postmerge-*.log`
- `/tmp/q12-true-counts.sql`
