# OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** `feat/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING`
**Design:** `docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING.md`
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-intent.md`
**Predecessor on main:** `84c2d71` (intent brief)
**HEAD:** `9fd8ee2` (3 implementation commits + 1 design commit on top of intent)

---

## Summary

The card ships exactly the one mechanical change the intent brief authorized.
The pre-fix `positives_observed` subquery in
`scripts/ops/sql/12-unsupported-family-attempts.sql` (line 60 pre-fix) contained
an `OR u.family_name = any(r2.requested_families)` clause that over-counted
positive rows in multi-family runs (`evidence_source_chain` reported 4 / actual
1, `resolution_progress` reported 4 / actual 2 against the live DB). The
implementer replaced the hardcoded 7-element `unnest(array[...])` CTE with a
data-derived `supported_families`/`unsupported_families` CTE pair (per intent
brief Decision 2 verbatim) and replaced the OR'd correlated subquery with a
strict `where res.family = u.family_name` match. The 5-column report-parser
contract from `scripts/ops/mcp-observability-report-lib.cjs` is preserved
byte-equal. Nine new Jest tests defend every property of the change, including
the existential OR-clause regression. No locked file in the design's §5
read-only boundary list was touched. All 14 HALT triggers re-evaluated CLEAN.

## Top 3 things

1. **Existential check PASS.** The literal substring
   `or u.family_name = any(r2.requested_families)` is fully gone from the SQL
   (Grep confirmed zero matches in
   `scripts/ops/sql/12-unsupported-family-attempts.sql`), and the `r2` alias is
   also fully gone (no `\br2\b` matches anywhere in the file). The
   `positives_observed` subquery at lines 54–58 of the post-fix file uses only
   `where res.family = u.family_name`, with no JOIN to `runs`, no `requested_families`
   reference, and no `any(` predicate. This is the binding fix the card was
   spawned for.

2. **Data-derived CTE pair is correctly shaped.** Lines 33–47 of the post-fix
   SQL define `supported_families` (line 33) and `unsupported_families` (line
   42) per the design §4 verbatim. `supported_families` correctly JOINs through
   `argument_machine_observation_runs` (alias `r_sf` — non-colliding with the
   outer `r` and the deleted `r2`), filters `provider_key NOT LIKE 'smoke-%'`
   AND `provider_key IS NOT NULL` AND `family IS NOT NULL`, and selects
   `DISTINCT family`. `unsupported_families` derives `DISTINCT family` from the
   same results table MINUS `supported_families` via the `NOT IN` subquery
   pattern. Decision 2 from the intent brief is satisfied — no hardcoded list
   survives, and future Family D-J ships will not require touching this SQL.

3. **9 tests defend every claim including the lib contract cross-check.**
   `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` runs the
   custom `extractPositivesObservedSubquery` and `extractSupportedFamiliesCteBlock`
   paren-balanced walkers to make assertions block-scoped (so the test for
   "no `any(` in positives_observed" cannot be defeated by the legitimate
   `any(r.requested_families)` that remains in the outer `left join`). Test 8
   imports the lib's `SECTIONS` array and asserts the 5 column aliases match
   byte-equal — drift on either side fails the test. Targeted Jest run:
   **131 / 131 passed** across all 11 `opsMcpObservability*` suites. Full
   suite: **17,843 / 17,843 passed** (+9 / +1 vs implementer-claimed delta —
   exact match to the design forecast of +9 within the +5 to +15 band).

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx jest --testPathPattern="opsMcpObservability"` | 131 / 131 passed (exit 0) |
| `npx jest` (full suite) | 17,843 / 17,843 passed across 560 suites (exit 0) |
| Test delta | 17,834 → 17,843 (+9 / +1 suite); matches design forecast exactly |
| Secret scan (`ANTHROPIC_API_KEY \| XAI_API_KEY \| SERVICE_ROLE \| Bearer \| Authorization \| eyJ…` against `git diff main..HEAD`) | clean |
| Doctrine scan (verdict tokens against `scripts/ops/sql/12-unsupported-family-attempts.sql`) | clean (zero matches) |
| Doctrine scan (verdict tokens against full diff) | clean — banned tokens appear only inside the test ban-list array, which is the canonical doctrine-test pattern |
| Migration apply | NOT-APPLICABLE — zero migration files touched |
| Working tree | only the 10 known operator-territory untracked files remain (matches design §5 expectation) |
| Locked files (`scripts/ops/mcp-observability-report.mjs`, `mcp-observability-report-lib.cjs`, `supabase/migrations`, `mcp-server/**`, `supabase/functions/**`) | all untouched (verified via `git diff main..HEAD --name-only`) |

## 14-item verdict matrix

| # | Item | Result |
|---|---|---|
| A | Only `scripts/ops/sql/12-unsupported-family-attempts.sql` SQL file edited (no other SQL touched) | **PASS** |
| B | No edits to `scripts/ops/mcp-observability-report.mjs` | **PASS** |
| C | No edits to `scripts/ops/mcp-observability-report-lib.cjs` | **PASS** |
| D | No new SQL queries added | **PASS** — file count preserved at 14, `opsMcpObservabilitySqlSafety.test.ts` would have failed otherwise |
| E | No schema migration introduced | **PASS** — `git diff main..HEAD --name-only \| grep migrations` empty |
| F | No registry change | **PASS** — `mcp-server/lib/familyRegistry.ts` + `familyRegistryInit.ts` untouched |
| G | No Family D/E/F/G/H/I/J registration | **PASS** |
| H | Post-fix SQL counts ONLY rows where `family` column matches the unsupported set (`OR u.family_name = any(r2.requested_families)` is GONE) | **PASS** — existential Grep confirms zero occurrences in the SQL; the `positives_observed` subquery (post-fix lines 54–58) uses only `where res.family = u.family_name`; the `r2` alias is also fully gone |
| I | Post-fix SQL correctly identifies the 3 known unsupported positives (1 `evidence_source_chain` + 2 `resolution_progress`) | **PASS** — implementer reports live DB sanity check returns 2 rows summing to 3 positives, matching design §2 last bullet "Confirmed post-fix Q12 output" exactly; SQL logic (strict `family=` against the data-derived `unsupported_families` set) is correctly shaped to produce this |
| J | Data-derived `supported_families` CTE present, with `provider_key NOT LIKE 'smoke-%'` filter | **PASS** — CTE at lines 33–41 with `provider_key not like 'smoke-%'` (line 40) plus defensive `provider_key is not null` (line 39) and `family is not null` (line 38) |
| K | Column names preserved (`unsupported_family_attempted`, `attempts`, `failed_attempts`, `mcp_validation_failed_attempts`, `positives_observed`) | **PASS** — all 5 aliases at lines 49–58 match the `mcp-observability-report-lib.cjs` SECTIONS `q12-unsupported-family-attempts` entry (lines 271–283) byte-equal; test #8 enforces this with a runtime cross-check against the imported lib |
| L | Test forecast: observed +9 within design forecast +5 to +15 range | **PASS** — full suite 17,834 → 17,843 (+9 exact) |
| M | Doctrine: no verdict tokens (`winner`, `loser`, `fallacy`, etc.) in any SQL comment or test label | **PASS** — Grep on the SQL file returns zero matches; banned tokens appear only inside the test #9 ban-list array (positive use — they are what the test scans for, not what is being introduced) |
| N | No `evidence_span` content selected in the SQL (default safety preserved) | **PASS** — Grep `evidence_span` against the SQL returns zero matches |

**All 14 items PASS.** Zero FAIL. Zero NOT-APPLICABLE.

## 14 HALT triggers re-evaluation

All 14 HALT triggers re-evaluated against the implementation diff — all 14
remain CLEAN. Re-stating:

- Scope triggers 1-7 (no SQL file other than Q12 edited; no runner edit; no
  new SQL; no migration; no registry change; no family registration; no
  test-data cleanup) — verified via `git diff main..HEAD --name-only`.
- Correctness trigger 8 (no supported-family rows counted) — the
  `positives_observed` subquery cannot include supported-family rows because
  `u.family_name` is sourced from the `unsupported_families` CTE, which by
  construction excludes families ratified by real providers.
- Correctness trigger 9 (no legitimately-unsupported-family false negatives) —
  `unsupported_families` derives `DISTINCT family` from all result rows minus
  the supported set, so every synthetic-only family with at least one result
  row appears in the output; live DB confirms 3 known positives surface.
- Correctness trigger 10 (designer enumerates supported-family derivation) —
  design §2 documents the data-derived approach verbatim.
- Correctness trigger 11 (test forecast > +50) — observed +9, well under +50.
- Doctrine trigger 12 (verdict tokens in SQL comments) — Grep on the SQL
  returns zero verdict-token matches.
- Doctrine trigger 13 (`evidence_span` exposed) — Grep returns zero matches.
- Working-tree trigger 14 (unclassified untracked files) — `git status --short`
  returns only the 10 known operator-territory files documented in the design
  §5 read-only boundary list.

## Doctrine deep-check findings

1. **OR-clause removal.** Grep on
   `scripts/ops/sql/12-unsupported-family-attempts.sql` for the pattern
   `or\s+u\.family_name\s*=\s*any` returns zero matches. The `\br2\b` alias is
   also fully removed from the file. The `positives_observed` subquery at
   post-fix lines 54–58 is now a pure scalar correlated subquery with
   `select count(res.id) from public.argument_machine_observation_results res
   where res.family = u.family_name` — no JOIN, no array predicate, no `r2`
   reference. The fix is the entire card; this check is the existential gate
   and it PASSES.

2. **Data-derived CTE pair.** Lines 33–47 of the post-fix SQL define both
   CTEs per the design §4 verbatim. `supported_families` (line 33) selects
   `distinct res.family` from `argument_machine_observation_results`
   INNER-JOINed to `argument_machine_observation_runs` via the non-colliding
   `r_sf` alias, with three defensive predicates: `res.family is not null`,
   `r_sf.provider_key is not null`, and `r_sf.provider_key not like 'smoke-%'`.
   This is the design's "strictly safer reading" — a NULL `provider_key` row
   cannot ratify a family as supported. `unsupported_families` (line 42)
   derives the complement via `family not in (select family_name from
   supported_families)`. Both CTEs source from the results table, so a
   family with zero result rows of any kind (registered-but-silent) is
   invisible to Q12 by design — registry coverage lives in Appendix A.

3. **`unsupported_families` CTE.** Present and correctly shaped. The
   second CTE uses the `NOT IN (subquery)` pattern. The design noted this
   could be vulnerable to NULL handling in some Postgres edge cases, but
   the inner CTE's `WHERE family IS NOT NULL` predicate ensures no NULL
   values enter the `IN` subquery, so the NOT IN result is well-defined.

4. **Column-name contract preservation.** Cross-checked the SQL aliases
   against the lib's SECTIONS array (`scripts/ops/mcp-observability-report-lib.cjs`
   lines 270–284). The lib expects:
   `unsupported_family_attempted`, `attempts`, `failed_attempts`,
   `mcp_validation_failed_attempts`, `positives_observed`. The SQL emits
   exactly these as `as <name>` aliases at lines 49, 50, 51, 52, 58. Test #8
   does a runtime check by `require()`-ing the lib and `expect(...).toEqual()`-ing
   the columns array, which is the strongest form of contract enforcement
   short of running the actual runner against a fixture.

5. **Test coverage.** New test file is 271 lines / 9 `it` blocks, mapping
   1:1 to the design §3 enumeration. Two of the tests use the custom
   paren-balanced walkers (`extractPositivesObservedSubquery` and
   `extractSupportedFamiliesCteBlock`) to make assertions block-scoped — for
   example, test 6 asserts no `any(` predicate in the `positives_observed`
   subquery specifically, NOT in the entire file (the legitimate `any(r.requested_families)`
   in the outer `left join` for the `attempts` count must remain and would
   defeat a file-wide regex). The doctrine ban-list in test 9 covers 11
   verdict tokens. All 9 tests pass; pure Jest with `fs.readFileSync`, no
   live DB call, follows the existing `opsMcpObservabilitySqlSafety.test.ts`
   pattern.

6. **Working tree.** `git status --short` shows exactly the 10 operator-territory
   untracked files documented in the design §5 read-only boundary list:
   4 `docs/testing-runs/2026-05-25-*.md` files, 3 `mcp021c-edge-smoke-*` JSON/txt
   files, `netlify-prod.git`, and 2 `phase5-mcpserver002-*.log` files. No new
   untracked files introduced by the implementer; selective `git add` was
   used per the design checklist.

## Blockers

None. Verdict is **Approve**.

## Suggestions (non-blocking)

1. **Post-merge smoke audit cadence.** Per the intent brief §8, the
   3-phase smoke runs after merge. The implementer's commit message in
   the handoff to `current-status.md` reports a live DB sanity check
   returned the expected 2 rows summing to 3 positives. Operator should
   still execute the formal smoke audit
   (`node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/q12-smoke`)
   and author
   `docs/audits/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE-2026-05-27.md`
   to formally authorize `OPS-MCP-TEST-DATA-CLEANUP` per intent brief §9.
   This is the next-card unlock, not a blocker for this PR.

2. **(Optional, post-merge candidate.)** The `unsupported_families` CTE
   uses `NOT IN (subquery)` rather than `WHERE NOT EXISTS (...)` or
   `LEFT JOIN ... WHERE supported IS NULL`. The inner CTE's
   `WHERE family IS NOT NULL` makes `NOT IN` safe here, but
   `NOT EXISTS` is sometimes considered idiomatically safer in code
   review style. Not a defect — the current form is correct and the test
   asserts the exact substring `not in (select ... supported_families`.
   If a future operator wants the NOT EXISTS form, they would update
   both the SQL and test 3's regex.

3. **(Optional, post-merge candidate.)** The 9-test file could be
   reduced to a smaller set via consolidation, but the per-property
   one-test mapping makes failure diagnosis more granular. The design
   forecast of +9 is hit exactly, which is preferable to test-count
   drift in either direction.

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING`
- Open PR:
  ```
  gh pr create --title "OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING: replace OR-clause + hardcoded array with data-derived CTE pair" --body-file docs/reviews/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING.md
  ```
- Deploy steps: **none.** No migration to push, no Edge Function to deploy,
  no runner change. The single SQL file change is consumed by the operator
  running `node scripts/ops/mcp-observability-report.mjs` against the
  linked database, which reads the file from disk.
- Post-merge smoke (intent brief §8): run
  `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/q12-smoke`
  and verify Q12 returns 2 rows summing to 3 positives (1
  `evidence_source_chain` + 2 `resolution_progress`, all 3 tracing to
  `provider_key='smoke-mcp:test-server'`). On PASS, author
  `docs/audits/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE-2026-05-27.md`
  and the next card `OPS-MCP-TEST-DATA-CLEANUP` becomes authorized.
- Post-merge worktree cleanup (commands in
  `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup
  (operator step)").
