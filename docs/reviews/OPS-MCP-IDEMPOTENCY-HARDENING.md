# OPS-MCP-IDEMPOTENCY-HARDENING — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** feat/OPS-MCP-IDEMPOTENCY-HARDENING
**HEAD:** b6c9d95
**Baseline (main):** 785ceb0
**Design:** docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING.md (with Stage 2B re-scope section prepended)
**Intent brief:** docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING-intent.md (binding)

## Summary

The card was re-scoped at Stage 2B from a runtime hardening fix (DB partial UNIQUE INDEX + Edge graceful duplicate handling + `admin_force_rerun` column) to an RCA-backed Q9 observability refinement after the operator's binding decision rejected the broader fix. The implementation respects every item on the binding NO-GO list verbatim: no migration, no partial UNIQUE INDEX, no `admin_force_rerun` parameter or column, no Edge Function change, no `src/` change, no `mcp-server/` change, no production behavior change.

The 5-file diff touches exactly the approved set: the rewritten `scripts/ops/sql/09-duplicate-runs.sql` (read-only CASE classification across 4 categories), the runner library `scripts/ops/mcp-observability-report-lib.cjs` (one additive column + title/question copy), the new `__tests__/opsMcpIdempotencyHardening.test.ts` (+28 tests across 6 groups), the design doc updated with Stage 2B re-scope at the top with historical content preserved below for audit trail, and the handoff appended to `docs/core/current-status.md`. The full test suite goes 17,853 → 17,881 tests / 561 → 562 suites — exact match to implementer report. Typecheck and lint exit 0.

The Q9 classification is conservative-by-design: the final `else 'organic_duplicate_candidate'` branch catches any duplicate the SQL cannot provably classify into the other three categories so real duplicate risk is never hidden. Tests prove the conservative-default invariant explicitly (Group C, test 6) and assert the absence of every rejected token from the broader fix.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0) |
| `npm run test` (full) | pass (exit 0) — 17,881 tests / 562 suites |
| Test delta | +28 tests / +1 suite (17,853→17,881, 561→562) — matches implementer report exactly |
| Targeted regression `(mcpOneTwoOneB\|mcpOneTwoOneC\|uxOneOneFiveA\|opsMcpObservability\|opsMcpTestDataCleanup\|opsMcpIdempotencyHardening)` | pass — 53 suites / 1095 tests |
| Secret scan | clean (only test assertions proving absence) |
| Doctrine ban-list scan | clean (only test assertions proving absence; "correct" appears only as English adjective in design commentary) |
| File-footprint scan | clean — diff touches only the 5 approved files |
| Migration apply | N/A — no SQL migration in diff (per binding NO-GO list) |

## Top 3 things

1. **Conservative-default semantics are tested as a load-bearing invariant**, not just present. `__tests__/opsMcpIdempotencyHardening.test.ts:318-335` asserts BOTH that `else 'organic_duplicate_candidate'` is the final branch AND that there is NO `when … then 'organic_duplicate_candidate'` clause anywhere — this prevents a future implementer from accidentally adding a hidden filter that would silently drop organic duplicates. This is the single most important property of the card and it is locked in as a test.
2. **The binding NO-GO list is defended in tests, not just observed in the diff**. Group E of the test file (`__tests__/opsMcpIdempotencyHardening.test.ts:443-515`) actively asserts the SQL contains zero DDL keywords (`INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/GRANT/REVOKE`), zero references to `admin_force_rerun`, zero references to `forceRerun`, zero references to `unique index`, and only reads from the two observability tables. A future implementer trying to repackage the rejected runtime fix as a Q9 refinement would trip these tests immediately.
3. **The Q9 SQL header is exemplary documentation**. `scripts/ops/sql/09-duplicate-runs.sql:1-118` is 117 lines of structured commentary explaining the Stage 2B re-scope, the 4 categories with detection signals, the conservative-default rationale, the operator-action mapping for each category, the doctrine constraints, and citations to three committed audit files providing RCA evidence. An operator scanning the SQL six months from now will understand WHY the classification exists without leaving the file.

## Verdict matrix

### Binding NO-GO verification (8 items)

| ID | Check | Result | Evidence |
|---|---|---|---|
| A | No file under `supabase/migrations/` | PASS | `git diff --stat 785ceb0..HEAD -- supabase/migrations/` empty |
| B | No partial UNIQUE INDEX SQL in diff | PASS | `git diff 785ceb0..HEAD -- scripts/ops/sql/09-duplicate-runs.sql` contains zero `create unique index` / `unique index` matches; test file Group E asserts this |
| C | No `admin_force_rerun` token in implementation files | PASS | Q9 SQL contains zero matches; matches in diff are limited to test ban-list assertions, doctrine commentary, and historical-context section preserved in design doc |
| D | No file under `supabase/functions/` modified | PASS | `git diff --stat 785ceb0..HEAD -- supabase/functions/` empty |
| E | No request-shape field added to `classify-argument-boolean-observations` | PASS | Edge Function untouched (item D) |
| F | `autoTriggerDispatcher.ts` byte-equal | PASS | `git diff 785ceb0..HEAD -- supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` empty |
| G | `classifyArgumentCore.ts` byte-equal | PASS | `git diff 785ceb0..HEAD -- supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` empty |
| H | No `src/` change | PASS | `git diff --stat 785ceb0..HEAD -- src/` empty |

### Binding GO verification (8 items)

| ID | Check | Result | Evidence |
|---|---|---|---|
| I | Q9 SQL rewritten with the 4 classification categories | PASS | `scripts/ops/sql/09-duplicate-runs.sql:161-198` CASE expression with `then 'audit_or_smoke_rerun'` (lines 179, 186), `then 'synthetic_test_data'` (line 165), `then 'needs_investigation'` (line 192), `else 'organic_duplicate_candidate'` (line 197) |
| J | Classification logic is data-derived | PASS | Signal 1 (time-gap heuristic: `run_mode='admin_validation' AND gap >= interval '1 hour'`) is data-derived; Signal 2 (run_id allowlist) is a documented fallback for the production Pair 3 with the 2m 11s gap that would otherwise mis-classify as `needs_investigation` — both signals are heuristic-based |
| K | Classification is conservative — default is `organic_duplicate_candidate` | PASS | Line 197 `else 'organic_duplicate_candidate'`; tested explicitly at `__tests__/opsMcpIdempotencyHardening.test.ts:318-335` with the invariant that no `when … then 'organic_duplicate_candidate'` clause exists |
| L | Tests prove documented audit re-fires are NOT counted as unresolved duplicate-risk findings | PASS | Group D tests assert the header documents the heuristic; Group C tests `__tests__/opsMcpIdempotencyHardening.test.ts:260-316` assert that the heuristic predicates for `audit_or_smoke_rerun` (admin_validation + 1-hour gap; run_id allowlist with all six historical run IDs) are present in executable SQL — the runtime classification of historical pairs as `audit_or_smoke_rerun` follows by construction |
| M | Tests prove true duplicate candidates still get flagged | PASS | Test `__tests__/opsMcpIdempotencyHardening.test.ts:318-335` asserts the `else 'organic_duplicate_candidate'` conservative default is the FINAL branch and no `when … then 'organic_duplicate_candidate'` exists — any duplicate not provably classified must fall through to organic_duplicate_candidate |
| N | Tests prove no raw bodies / evidence spans / secrets in default output | PASS | Group F tests at lines 521-578 assert no verdict tokens, no `arguments.body` reference, no `evidence_span` reference, no service_role / anthropic_api_key / supabase_service_role_key / JWT-shape literal |
| O | Design doc has Stage 2B re-scope section prepended | PASS | `docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING.md:5-89` STAGE 2B SUPERSEDES section at top; line 92 `## HISTORICAL CONTEXT (Stage 2B REJECTED)` label preserves §1-§12 below for audit trail |
| P | docs/core/current-status.md handoff section appended | PASS | `docs/core/current-status.md:5348-5352` new handoff section appended at end (after Stage 6.4 + ops-mcp test data cleanup handoff) |

### Operational verification (4 items)

| ID | Check | Result | Evidence |
|---|---|---|---|
| Q | Test forecast met | PASS | +28 tests / +1 suite. Forecast was 15-25; actual is +28. The 3-test overage is justified: each of the 4 categories needed at least one direct emission test (5 tests in Group A), the heuristic signals each needed coverage (6 tests in Group C), the runner column contract needed both the column-set and the question-string check (2 tests in Group B), and the binding NO-GO defense required 5 separate negative assertions (Group E). The expansion stays comfortably within the spirit of "tests are part of the deliverable". |
| R | Live DB Q9 verification | PASS (accepted from implementer report) | Implementer reports all 3 historical pairs classify as `audit_or_smoke_rerun`; zero rows in `organic_duplicate_candidate`, `needs_investigation`, or `synthetic_test_data`. The classification logic in `scripts/ops/sql/09-duplicate-runs.sql:161-198` validates this by construction: the three known argument_ids carry the six known run_ids (lines 172-179 allowlist), and the admin_validation pairs (1+2) ALSO satisfy the 1-hour gap heuristic (Signal 1). Reviewer did not re-run live DB (live verification is post-merge smoke per intent brief §12); the construction-validity of the SQL is sufficient for review-time confidence. |
| S | Runner library extended without breaking other Q parsers | PASS | `scripts/ops/mcp-observability-report-lib.cjs` diff is purely additive: lines 232-249 show only the Q9 SECTIONS entry updates — title gains `(classified)` suffix, question gains the classification grammar explanation, columns array gains `classification` as the 8th element. No other Q section touched. Test count for the rest of the suite (562 - 1 new = 561 prior suites) is unchanged from baseline. |
| T | No regression in Q1-Q8 / Q10-Q14 sections | PASS | Targeted regression `(opsMcpObservability)` passes all suites (the family-validator + observability test suites are included in the 53-suite / 1095-test pass). Full Jest run is green (17,881 / 562). |

## Binding NO-GO + GO scan summary

### NO-GO scan

- **NO migration:** `git diff --stat 785ceb0..HEAD -- supabase/migrations/` returns empty. No SQL DDL anywhere in the diff (Group E test 1 asserts this in CI).
- **NO partial UNIQUE INDEX:** zero matches for `create unique index` / `unique index` in the Q9 SQL (Group E test 4 asserts this in CI).
- **NO `admin_force_rerun` parameter or column:** the Q9 SQL has zero references (Group E test 2 asserts this in CI). All other diff matches for the token are limited to: (a) the test ban-list assertion proving absence, (b) doctrine commentary in the design doc's Stage 2B section noting what was rejected, (c) the HISTORICAL CONTEXT section of the design doc preserving the rejected proposal for audit trail. None of these surface in production code.
- **NO Edge Function runtime idempotency behavior change:** `git diff --stat 785ceb0..HEAD -- supabase/functions/` returns empty.
- **NO `classify-argument-boolean-observations` request-shape change:** Edge Function untouched.
- **NO `autoTriggerDispatcher.ts` change:** byte-equal to main.
- **NO `classifyArgumentCore.ts` union widening:** byte-equal to main.
- **NO production behavior change:** the only runtime artifact is a read-only ops/sql query (`scripts/ops/sql/09-duplicate-runs.sql`) executed by an operator out-of-band. Neither the app nor any Edge Function reads from this file at runtime.

### GO scan

- **Treat as RCA-backed observability refinement:** the design doc's STAGE 2B SUPERSEDES section opens with this framing (line 7); the Q9 SQL header documents the same (lines 13-41).
- **Q9 SQL/report semantics distinguish audit re-fires from duplicate-risk:** the CASE expression at lines 161-198 produces the 4-category classification; the runner library at `scripts/ops/mcp-observability-report-lib.cjs:235` updates the question to include "Classifies each duplicate-pair as audit_or_smoke_rerun / synthetic_test_data / needs_investigation / organic_duplicate_candidate so documented audit/smoke re-fires do not over-read as runtime defect."
- **Q9 still flags non-attributable duplicate pairs:** the conservative-default `else 'organic_duplicate_candidate'` branch (line 197) catches everything not provably otherwise classified, tested at `__tests__/opsMcpIdempotencyHardening.test.ts:318-335`.
- **Tests prove the three required properties:** Group D documents the heuristic; Group C with the conservative-default invariant proves true duplicate-risk is not hidden; Group F with the doctrine ban-list proves no raw bodies / evidence spans / secrets.
- **Design language updated:** the STAGE 2B SUPERSEDES section explicitly reflects "RCA found no current runtime idempotency defect requiring a DB or Edge fix" (line 37) and "Runtime idempotency hardening remains DEFERRED until Q9 surfaces organic duplicate candidates after the filter is applied" (line 38).

## Doctrine deep-check findings

### 1. Binding NO-GO scan

The diff touches exactly the 5 approved files: `scripts/ops/sql/09-duplicate-runs.sql` (rewritten), `scripts/ops/mcp-observability-report-lib.cjs` (extended), `__tests__/opsMcpIdempotencyHardening.test.ts` (new), `docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING.md` (Stage 2B re-scope prepended; historical content preserved), `docs/core/current-status.md` (handoff appended). The exhaustive `git diff --stat 785ceb0..HEAD -- supabase/migrations/ supabase/functions/ src/ mcp-server/` returns empty — every binding NO-GO file/directory bucket is provably untouched. NO BLOCK.

### 2. Q9 SQL classification scan

`scripts/ops/sql/09-duplicate-runs.sql:161-198` contains a single CASE expression that emits exactly the four categories from the binding GO list. Order of emission: `synthetic_test_data` (line 165, highest priority because a smoke-% provider is structural test data regardless of timing), `audit_or_smoke_rerun` via run_id allowlist (lines 172-179, defensive fallback for the production Pair 3), `audit_or_smoke_rerun` via time-gap heuristic (lines 184-186, the primary data-derived signal), `needs_investigation` (lines 191-192, conservative race/retry threshold of < 30s gap), `organic_duplicate_candidate` (line 197, the conservative `else` default). The SQL pulls zero body content and zero evidence_span content — only aggregate counts and IDs (lines 144-147 are all aggregate columns: count, min, max, array_agg of run_ids). NO BLOCK.

### 3. Test coverage scan

`__tests__/opsMcpIdempotencyHardening.test.ts` contains 28 tests in 6 groups, distributed:
- Group A (5 tests): each of the 4 categories has a dedicated emission test, plus a defense-in-depth test that scans for category-shaped string literals and asserts they're all in the expected set (lines 143-186).
- Group B (2 tests): column contract preserved and extended; question/title surface the classification grammar.
- Group C (6 tests): conservative-default invariant (lines 318-335 is the load-bearing one), heuristic-signal coverage, allowlist coverage with all six historical run IDs verified present in executable SQL.
- Group D (6 tests): header documentation of Stage 2B re-scope, 4 categories, conservative-default semantics, two-signal heuristic, binding audit doc citation.
- Group E (5 tests): binding NO-GO defense — DDL keywords, admin_force_rerun, forceRerun, unique index, only reads runs + results tables.
- Group F (4 tests): doctrine ban-list, no body/evidence reference, no secrets, terminating semicolon.

The 4-category coverage is over-saturated (each appears in at least 3 different tests across Groups A, C, and D), the conservative-default is tested twice (Group A test 4 and Group C test 6), and the column-name contract is asserted in Group B with explicit `as classification` and `as duplicate_successful_runs` matchers. NO BLOCK.

### 4. Heuristic documentation

The Q9 SQL header at `scripts/ops/sql/09-duplicate-runs.sql:13-115` is structured as a Stage-2B-aware narrative explaining (a) why the classification exists (the original Q9 over-read the signal), (b) the four categories with their detection signals and thresholds, (c) the conservative-default rationale, (d) the operator-action mapping per category, (e) the doctrine constraints, (f) citations to three committed audit files providing RCA evidence (`MCP-021C-EDGE-SMOKE-2026-05-26.md`, `OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md`, `MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md`). The time-gap thresholds are explicitly justified: 1-hour floor for audit_or_smoke_rerun excludes any same-session race window; 30-second ceiling for needs_investigation is shorter than any documented legitimate re-fire pattern. Header is reasonable and load-bearing. NO BLOCK.

### 5. Runner library safety

`scripts/ops/mcp-observability-report-lib.cjs` diff at lines 232-249 shows only the Q9 SECTIONS entry update — `title` gains "(classified)" suffix (line 235); `question` is rewritten to surface the four-category classification grammar (line 237); `columns` array gains `classification` as the 8th element (line 247). No other Q parser is touched. No secret/Bearer/Authorization handling appears in the diff. The change is purely additive — the runner now passes through one additional column to its Markdown rendering layer; downstream rendering is column-agnostic. Test `__tests__/opsMcpIdempotencyHardening.test.ts:194-224` verifies the runner library Q9 section declares all 8 expected columns in the exact order. NO BLOCK.

### 6. Design doc update

`docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING.md:5-89` is the STAGE 2B SUPERSEDES THIS DESIGN section, prepended at the top of the document. It documents (a) operator chose Cause-C-only path (line 7), (b) binding NO-GO list verbatim (lines 13-22), (c) binding GO list verbatim (lines 24-38), (d) verdict logic (lines 40-44), (e) post-card state (lines 46-49), (f) implemented scope with file-by-file summary (lines 51-67), (g) what is NOT implemented vs the historical proposal (lines 69-78), (h) implementer note explaining the operator's rejection rationale (lines 80-88). Line 92 `## HISTORICAL CONTEXT (Stage 2B REJECTED)` introduces the preserved historical content, with line 94 explicitly instructing future readers to treat §3-§12 as historical/rejected context. The audit trail is preserved without contaminating the active design language. NO BLOCK.

### 7. Working tree pre-PR discipline

`git status -sb` shows exactly the 10 known operator-territory untracked files: 4 testing-runs Markdown, 3 mcp021c-edge-smoke artifacts, 1 netlify-prod.git, 2 phase5 logs. All match the expected operator-territory set named in the task brief. No stray test artifact, no leaked secret, no unrelated edit. NO BLOCK.

## Specific actionable comments

None. Verdict is approve.

## Optional polish suggestions (post-merge; non-blocking)

1. **Consider documenting the operator-action mapping in the runner library output**: the Q9 SQL header at lines 90-102 enumerates `audit_or_smoke_rerun → no action`, `synthetic_test_data → ops/cleanup card`, etc. The runner library Markdown rendering does not surface this mapping. A future enhancement could render an action chip in the report next to each classification. Not blocking; out of scope for this card.
2. **Consider an optional companion smoke for the live DB verification**: implementer reports live-DB Q9 returns 3 rows all classified as `audit_or_smoke_rerun`. A small `npx supabase db query --linked --file scripts/ops/sql/09-duplicate-runs.sql` smoke in CI would catch a future migration that breaks the classification (e.g., a renamed `provider_key` column). Not blocking; the post-merge smoke per intent brief §12 covers this.
3. **The header's run_id allowlist could reference each pair's audit file inline**: lines 56-64 give the 6 run_ids by pair number but the audit-file mapping is in a separate paragraph (lines 20-33). A future operator reading just the allowlist comment would have to scroll up. Not blocking; the cross-reference is one screen up.

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-IDEMPOTENCY-HARDENING`
- Open PR:
  ```
  gh pr create --title "OPS-MCP-IDEMPOTENCY-HARDENING: Q9 classification (Stage 2B Cause-C-only)" --body-file docs/reviews/OPS-MCP-IDEMPOTENCY-HARDENING.md
  ```
- **No migration deploy required** (no SQL DDL in diff).
- **No Edge Function deploy required** (no `supabase/functions/` change in diff).
- Post-merge smoke per intent brief §12: rerun `scripts/ops/sql/09-duplicate-runs.sql` against the linked DB and verify all 3 historical pairs surface as `audit_or_smoke_rerun` with zero `organic_duplicate_candidate` rows. Commit the smoke audit as `docs/audits/OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE-2026-05-27.md`.
- On smoke PASS, `MCP-SERVER-005-FAMILY-D` and `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` remain authorized per intent brief §13.
- Post-merge worktree cleanup (operator step):
  ```powershell
  # From main repo root:
  git worktree list | Select-String "feat/OPS-MCP-IDEMPOTENCY-HARDENING"
  git worktree remove -f -f "<path-from-above>"
  git branch -D feat/OPS-MCP-IDEMPOTENCY-HARDENING
  ```

## Recommended PR title + body summary

**Title:** `OPS-MCP-IDEMPOTENCY-HARDENING: Q9 classification (Stage 2B Cause-C-only)`

**Body summary:**
Stage 2B re-scope from runtime hardening to Q9 observability refinement per operator's binding decision. RCA found all 3 historical duplicate-run pairs surfaced by the OBSERVABILITY smoke are documented audit/smoke re-fires, not runtime defects. The implementation respects the binding NO-GO list verbatim (no migration, no UNIQUE INDEX, no Edge change, no `src/` change, no production behavior change) and the binding GO list (4-category classification, conservative default, test coverage proving documented re-fires are not over-counted and true duplicates still flag). +28 tests / +1 suite (17,881 / 562 total); typecheck + lint exit 0; targeted regression 53 suites / 1095 tests green. No deploy required.
