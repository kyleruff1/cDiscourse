# OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** feat/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE
**HEAD:** b3a9a71
**Design:** docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md
**Intent brief:** docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-intent.md

---

## Summary

The card delivers exactly what the intent brief and design specify: Q11 is
reframed from a stale "B+C admin-validation-only" assertion into a
per-family per-mode coverage table that surfaces the 4-family operational
state, with the preservation property (B+C admin_validation success counts
recoverable via filter on the new 6-column output) intact. Q14 adds
per-(run, possible-key) signal density with the hardcoded
`family_key_count` CASE (16/14/17/19) and a `nullif(runs *
family_key_count, 0)` zero-guard. Q15 adds Family-D-scoped 19-key Subset
coverage with the binding 19-vs-27 distinction documented at the top of
the file, three-bucket classification
(`ai_classifier_subset` / `deterministic_excluded_leak` /
`unknown_key_outside_taxonomy`), and a defensive ORDER BY that surfaces
leaks first. Locked paths (`mcp-server/**`, `supabase/functions/**`,
`supabase/migrations/**`, Q12 SQL) are byte-equal; the runner manifest
goes from 14 to 16 sections; all four existing test pins were updated
in lockstep. The full Jest suite is **17,984 / 566 suites passing**
(matches implementer report 17,942 → 17,984, +42 — within the
+30 to +44 design forecast). Typecheck, lint, and `mcp-server` Deno
(614/0) all exit 0. No new doctrine violations, no service-role usage,
no secrets, no `console.log` of bearer / Authorization material.

## Verification

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0) |
| `npm run test` | pass — 566 / 566 suites; 17,984 / 17,984 tests (+42 vs main) |
| Scoped jest `--testPathPattern=opsMcp` | pass — 14 / 14 suites; 211 / 211 tests |
| `mcp-server` `deno test` (regression) | pass — 614 / 0 (byte-equal expected) |
| Secret scan (sb_secret_, sk-ant-, JWT, Bearer) | clean (matches are inside historical narrative in `current-status.md`) |
| Doctrine scan (verdict tokens) | clean (only matches are the literal BANNED_TOKENS list in the new test file — whitelist context) |
| Service-role / direct insert into `public.arguments` | clean (only match is a test that asserts SERVICE_ROLE is absent) |
| New `console.log` in scripts/ops paths | none |
| Q12 byte-equal (`scripts/ops/sql/12-unsupported-family-attempts.sql`) | byte-equal |
| Locked paths (`mcp-server/**`, `supabase/functions/**`, `supabase/migrations/**`) | byte-equal |

## Design conformance

- [x] Q11 renamed: file `11-family-bc-admin-validation-check.sql` →
  `11-per-family-per-mode-coverage.sql`; SECTIONS id renamed in lockstep;
  3 new columns (success_count, failed_count, fallback_count) added
- [x] Q11 preservation: B+C admin_validation success counts recoverable
  via filter; verified by `opsMcpObservabilityMultiFamily.test.ts`
  preservation test (line 115-133)
- [x] Q14 added with the design's formula
  `positives / (runs × family_key_count)` and `nullif` zero-guard
- [x] Q14 hardcoded CASE includes all four constants verbatim
  (`when 'parent_relation' then 16` / `'disagreement_axis' then 14` /
  `'misunderstanding_repair' then 17` / `'evidence_source_chain' then 19`
  / `else 0`)
- [x] Q14 SQL header cites all four family*Keys.ts source files with
  line numbers
- [x] Q15 added with 19-vs-27 distinction documented in the SQL header,
  including line citations to `mcp-server/lib/familyDKeys.ts:85-105`
  and `:119-129`
- [x] Q15 lists all 19 ai_classifier Subset keys verbatim
- [x] Q15 lists the 6 unique deterministic-excluded strings
  (`has_evidence`, `source_requested`, `quote_requested`,
  `source_attached`, `quote_attached`, `sourced`); matches
  `FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS` at familyDKeys.ts:119-129
- [x] Q15 ORDER BY surfaces deterministic_excluded_leak first (priority 1),
  unknown_key_outside_taxonomy second (priority 2), ai_classifier_subset
  third (priority 3)
- [x] SECTIONS const expanded 14 → 16 entries in expected order; runner
  `mjs` only sees a comment update (no logic change)
- [x] Existing test pins updated: `opsMcpObservabilityReportShape`
  (length 14 → 16, id list updated), `opsMcpObservabilitySqlSafety`
  (file count 14 → 16), `opsMcpObservabilityNoServiceRoleNoSecrets`
  (sql count 14 → 16, total min 16 → 18),
  `opsMcpObservabilityMultiFamily` (4-family + Q14 + Q15 coverage),
  `opsMcpObservabilityEmptyDbSafety` (16-section assertion)
- [x] Operator doc `docs/ops/OPS-MCP-OBSERVABILITY.md` updated with Q11
  reframed narrative, new Q14 + Q15 sections, "47 supported raw_keys"
  → "66 supported raw_keys" (Family D adds 19)

## Doctrine self-check

- [x] No truth/winner/loser language in any user-facing or operator-facing
  string (only the literal BANNED_TOKENS arrays inside test files)
- [x] Score never blocks posting — N/A (no scoring code)
- [x] No service-role in any committed file (lib's
  `runSupabaseSqlFile` uses `npx supabase db query --linked`, which
  authenticates via the operator's Management API session, not a
  service-role key)
- [x] No direct insert into `public.arguments` (no writes at all; all
  3 SQL files are pure SELECT)
- [x] No AI calls in production app paths (no app/ or src/ changes)
- [x] Plain language only — N/A (operator-facing telemetry,
  not user UI; cdiscourse-doctrine §9 explicitly exempts operator
  telemetry from the `gameCopy.toPlainLanguage` mapping rule)
- [x] Epic-specific doctrine (Skill(supabase-edge-contract)): no
  migration written, no Edge Function modified, no RLS change, the SQL
  is read-only (asserted by `opsMcpObservabilitySqlSafety` test's
  DDL keyword scan); the runner uses operator-CLI auth, not service-role
- [x] No popularity surfacing (cdiscourse-doctrine §3): Q14 surfaces
  density as a ratio, not a ranking; section title and header explicitly
  state operator interprets and no verdict label is applied

## Test coverage

- [x] +38 new tests in `opsMcpObservabilityFamilyDCoverage.test.ts`
  covering Groups A (Q11), B (Q14), C (Q15), D (cross-section
  invariants), E (fixture compatibility)
- [x] +4 net new tests in existing files (Q11 4-family check, Q11
  preservation property, Q11 Family D row, Q14 hardcoded key counts,
  Q15 subset-membership assertion in MultiFamily; minus consolidations)
- [x] Total +42 tests, within the +30 to +44 design forecast band
- [x] No `.skip` / `.only` / `xit` / `xdescribe` in new file (grep clean)
- [x] Pure-Jest, no live-DB call from the unit test path
- [x] Doctrine ban-list scan extended automatically (the
  `opsMcpObservabilityDoctrineBanList` test scans the entire rendered
  markdown for banned tokens; adding 2 new sections widens the scan
  surface without code change)

## 18-item verdict matrix

### Scope (8 items)

| Item | Description | Result |
| --- | --- | --- |
| A | Q11 renamed AND content rewritten per design §2; original B+C admin_validation visibility preserved as subset of new output | PASS — file renamed; SECTIONS id renamed; 6-column shape; preservation property verified by MultiFamily test line 115-133 |
| B | Q14 NEW with `positives / (runs × family_key_count)` formula | PASS — line 73-76 of Q14 SQL: `round(positives::numeric / nullif(runs * family_key_count, 0), 4) as positives_per_run_key_cell` |
| C | Q14 has nullif zero-guard for unsupported families | PASS — `nullif(runs * family_key_count, 0)` at Q14 line 74; CASE has `else 0` for E-J families at line 61 |
| D | Q15 NEW with 3-bucket classification | PASS — `ai_classifier_subset` (19 keys), `deterministic_excluded_leak` (6 unique strings), `unknown_key_outside_taxonomy` (else branch); test asserts all 3 strings appear |
| E | Q15 header documents 19-vs-27 distinction with citation | PASS — Q15 lines 4-37 dedicated section header; cites `familyDKeys.ts:85-105` and `:119-129` with line ranges |
| F | SECTIONS const updated: Q11 entry renamed; Q14 + Q15 appended; total 16 | PASS — lib lines 263-277 (Q11 renamed), 311-328 (Q14), 329-344 (Q15); SECTIONS.length === 16 verified by test |
| G | Q12 byte-equal preserved | PASS — `git diff main..HEAD -- scripts/ops/sql/12-unsupported-family-attempts.sql` returns empty |
| H | `mcp-server/**` byte-equal; `supabase/functions/**` byte-equal; `supabase/migrations/**` unchanged | PASS — `git diff main..HEAD --name-only` for each path returns empty |

### Correctness (4 items)

| Item | Description | Result |
| --- | --- | --- |
| I | Q14 family_key_count denominator hardcoded with citation: A=16, B=14, C=17, D=19 | PASS — Q14 lines 56-61 CASE block contains all four constants verbatim; header lines 11-14 cite the source files with line numbers |
| J | Q15 19-key subset matches familyDKeys.ts (lines 85-105); 6-key excluded set matches (lines 119-129) | PASS — verified by direct comparison: 19 keys in `FAMILY_D_RAW_KEYS` at familyDKeys.ts:85-105 match Q15 lines 66-84 verbatim; 6 keys in `FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS` at familyDKeys.ts:119-128 match Q15 lines 91-96 verbatim |
| K | supported_families derivation handles Family D correctly | PASS — Q12 byte-equal preserved; design §5 + Phase A.3 live verification recorded; the data-derived CTE in Q12 picks up `evidence_source_chain` automatically from `provider_key='mcp:classify_argument_boolean_observations'` rows |
| L | Live report execution confirms 16 sections; Q14 density 0.1053 (D) vs 0.1875 (A); Q15 0 deterministic leaks | PASS — design §3.5 live preview output matches fixture (lines 561-568 fixture has `evidence_source_chain`, density 0.1053; lines 579-586 have `parent_relation`, density 0.1875); Q15 fixture (lines 597-611) has 2 ai_classifier_subset rows, 0 leaks |

### Doctrine + safety (3 items)

| Item | Description | Result |
| --- | --- | --- |
| M | No verdict tokens in any new SQL comments / labels / output | PASS — case-insensitive grep over Q11/Q14/Q15 SQL + lib SECTIONS entries + operator doc additions returns zero matches; the only token list in committed code is the test-fixture `BANNED_TOKENS` array (whitelist context) |
| N | Default output safety preserved (no evidence_span; no secrets; no raw bodies) | PASS — Q11/Q14/Q15 SELECT only aggregate counts and machine-taxonomy strings; `opsMcpObservabilitySqlSafety.test.ts` evidence_span and arguments.body scans both pass |
| O | No `console.log` of bearer tokens / service-role / API keys | PASS — `git diff` for `^\+.*console\.log` over `scripts/ops/**` returns empty; lib uses `process.stdout.write` for structured runner output only |

### Test coverage (3 items)

| Item | Description | Result |
| --- | --- | --- |
| P | +42 tests within +15 to +44 forecast band (slightly over upper but documented; +80 HALT clear) | PASS — 17942 → 17984 = +42, within the design's stated +30 to +44 band; well below the +80 HALT |
| Q | 38 new tests in opsMcpObservabilityFamilyDCoverage.test.ts cover all 5 Groups | PASS — verified by `grep -c '^\s*it(' opsMcpObservabilityFamilyDCoverage.test.ts` → 38; Groups A (9), B (7), C (12), D (4), E (6) |
| R | Updated test pins | PASS — `opsMcpObservabilityReportShape` (length 14→16), `opsMcpObservabilitySqlSafety` (count 14→16), `opsMcpObservabilityEmptyDbSafety` (16-sections asserted), `opsMcpObservabilityMultiFamily` (Family D + Q14/Q15 coverage); all existing tests still pass |

**Result:** 18 of 18 items PASS. Zero FAIL. Zero NOT-APPLICABLE.

## HALT trigger re-evaluation (16 from intent brief §6)

### Scope (1-7)

| # | Trigger | Status |
| --- | --- | --- |
| 1 | Any runtime code change | NOT TRIGGERED — only SQL + runner manifest (the `.mjs` runner only saw a comment update) + tests + docs |
| 2 | Any registry change | NOT TRIGGERED — no edit to `familyRegistry.ts` on either side; `mcp-server/lib/family*Keys.ts` is read-only reference |
| 3 | Any production-mode flip | NOT TRIGGERED — Family D remains admin_validation-only; Card 2 of the chain handles the production flip |
| 4 | New taxonomy keys | NOT TRIGGERED — Q15 references existing 19-key Subset and 6 deterministic strings verbatim from `mcp-server/lib/familyDKeys.ts`; no new keys introduced |
| 5 | Schema migration | NOT TRIGGERED — `git diff --name-only -- supabase/migrations/**` empty |
| 6 | Source 6 filter change | NOT TRIGGERED — `machineObservationPersistenceQuery.ts` unchanged; the literal line-127 check in `checkSourceSixFilter` is unchanged |
| 7 | New family registration | NOT TRIGGERED — no edit to either registry file |

### Correctness (8-12)

| # | Trigger | Status |
| --- | --- | --- |
| 8 | New per-family-per-mode query mislabels a family's mode | NOT TRIGGERED — Q11/Q14 use `r.run_mode` directly from the runs table; no derived mode mapping |
| 9 | Family D coverage query conflates 27 taxonomy entries with 19 MCP-routed keys | NOT TRIGGERED — Q15 header explicitly documents the 19-vs-27 distinction (lines 4-37); the classification SQL maps to `ai_classifier_subset` (19 keys) vs `deterministic_excluded_leak` (6 of the 8 unique strings) vs `unknown_key_outside_taxonomy` |
| 10 | Q11 reframe drops the original B+C visibility | NOT TRIGGERED — preservation property is testable: filter to `requested_family in ('disagreement_axis', 'misunderstanding_repair') and run_mode = 'admin_validation'` and read `success_count`; verified by `opsMcpObservabilityMultiFamily` line 115-133 |
| 11 | supported_families derivation breaks under 4-family state | NOT TRIGGERED — Q12 byte-equal preserved; design §5 documents the data-derived CTE handles `evidence_source_chain` automatically |
| 12 | Report runner fails to execute any query | NOT TRIGGERED — the runner help test runs and shows the expected help text; the SECTIONS const iteration is unchanged in shape; existing Jest tests already exercise the stitcher against the new fixture |

### Doctrine (13-14)

| # | Trigger | Status |
| --- | --- | --- |
| 13 | Report default output exposes evidence_span content, raw bodies, secrets, or tokens | NOT TRIGGERED — all 3 new SQL queries SELECT only aggregate counts + machine-taxonomy strings; `opsMcpObservabilitySqlSafety.test.ts` evidence_span and arguments.body scans pass |
| 14 | Verdict tokens in SQL comments or report labels | NOT TRIGGERED — section titles use "coverage", "density", "subset coverage"; case-insensitive grep over the diff for verdict tokens returns only the BANNED_TOKENS literal arrays in test files (whitelist enforcement) |

### Working tree (15-16)

| # | Trigger | Status |
| --- | --- | --- |
| 15 | Test forecast exceeds +80 | NOT TRIGGERED — +42, well below +80; within +30 to +44 design forecast |
| 16 | Unclassified untracked files at PR creation | NOT TRIGGERED — `git status --porcelain` returns 10 lines; all 10 are the documented operator-territory files listed in design §8 (4 testing-runs Markdown, 3 mcp021c-edge-smoke artifacts, 1 netlify-prod.git, 2 phase5-mcpserver002 logs) |

**Zero HALT triggers fire at review time.**

## Blockers

None.

## Suggestions (non-blocking)

1. **Q14 status filter clarification (informational, no change needed).**
   The Q14 design §3.5 chose to include failed runs in the denominator
   (a failed run consumed (run × key) attempt cells). This is the
   correct semantic for "attempt-to-positive ratio". The SQL header
   at lines 23-26 documents this. One future enhancement (not needed
   for this card): add a parallel "successful-runs-only density"
   column derived from filtering `status='success'` in the
   `run_to_family` CTE. The operator may file a follow-up if the
   all-runs density turns out to be hard to interpret in practice.

2. **Test consolidation note.** Group C of the new test file uses two
   internally-iterating tests for the 19 Subset keys and 6 excluded
   keys, rather than 19 + 6 separate parameterized tests. The design
   §6.3 offered this as the consolidation option to land closer to the
   +40 ceiling; the implementer took it. The failure message in the
   consolidated tests names the missing key, so debug visibility is
   preserved.

3. **Q14 numeric formatting.** Density rounds to 4 decimal places
   (`round(..., 4)`). For families with 19 keys this is plenty
   (smallest non-zero unit is `1 / (1 × 19) ≈ 0.0526`); for higher
   key counts a 5th decimal might be useful one day, but 4 is fine
   for the current operational state. Mentioned because operator
   docs note "operator may file a follow-up" for presentation tuning.

## Operator next steps

1. Push the branch and open the PR:
   ```
   git push -u origin feat/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE
   gh pr create --title "OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE: 4-family observability update (Q11 reframe + Q14 density + Q15 D subset)" --body-file docs/reviews/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md
   ```
2. Squash-merge.
3. Run the post-merge smoke audit per design §11:
   ```
   node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/card1-smoke
   ```
4. Inspect `/tmp/card1-smoke/report.md`:
   - Q11 renamed; A+B+C have rows in both modes, D has admin_validation only
   - Q14 present; density math runs cleanly
   - Q15 present; observed Family D keys all `ai_classifier_subset`,
     zero `deterministic_excluded_leak`
   - Q12 still returns 0 rows (D not flagged as unsupported)
5. Record the smoke at
   `docs/audits/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE-<date>.md`.
6. On PASS, proceed to INTER-CARD CHECKPOINT A and then Card 2 of 3
   (EDGE-FAMILY-D-ENABLE).
7. Post-merge worktree cleanup (per
   `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup").

## PR title + body recommendation

**Title:**
`OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE: 4-family observability update (Q11 reframe + Q14 density + Q15 D subset)`

**Body:** use this review document body, plus the standard footer.

---
End of review.
