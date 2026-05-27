# OPS-MCP-OBSERVABILITY — Review

**Verdict:** Approve

**Reviewer agent run:** 2026-05-27
**Branch:** `feat/OPS-MCP-OBSERVABILITY` at `73c2486`
**Base:** `main` at `b8f911c` (intent brief `fbf7c87`, design `553ed30`)
**Design:** `docs/designs/OPS-MCP-OBSERVABILITY.md` (1121 lines)
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-intent.md` (554 lines)
**Issue:** #320

---

## Top 3 things justifying the verdict

1. **Source 6 binding constraint preserved end-to-end.**
   `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
   is untouched (`git diff main..HEAD -- src/` is empty) and the
   literal `.eq('argument_machine_observation_runs.run_mode',
   'production')` is verified at three independent layers: the runtime
   safety check in `scripts/ops/mcp-observability-report-lib.cjs:322-343`
   (exit code 3 on failure, before any SQL invocation), the
   `opsMcpObservabilitySourceSixSafety.test.ts` Jest suite (which reads
   the file from disk via `fs.readFileSync` and tests the literal byte
   substring plus `'admin_validation'` absence plus line-number
   tolerance), and the 11 pre-existing S6F-* assertions in
   `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` (byte-equal
   preserved). The lib stores the literal as two concatenated fragments
   (`SOURCE_SIX_LITERAL_FRAGMENT_A` + `SOURCE_SIX_LITERAL_FRAGMENT_B`)
   so the safety library itself does not carry the contiguous binding
   string. This is the highest-stakes doctrine check on the card and
   it is properly defended in depth.

2. **Doctrine + secrets layer is fully enforced by tests, not by
   convention.** Every safety claim has a corresponding Jest assertion
   that the reviewer ran and saw PASS:
   - `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:84-156` —
     comment-stripped scan over every file under `scripts/ops/`
     refuses SERVICE_ROLE, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
     X_BEARER_TOKEN, XAI_API_KEY, `Bearer ` literal, `Authorization`
     header literal, contiguous `sk-ant-`, `xai-`, `sb_secret_`, and
     JWT-shaped patterns; refuses `@supabase/supabase-js` imports;
     refuses `process.env.SUPABASE_SERVICE_ROLE_KEY` references.
   - `opsMcpObservabilitySqlSafety.test.ts:68-176` — refuses every DDL
     keyword (INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, TRUNCATE,
     GRANT, REVOKE) in executable SQL (comment-stripped); refuses
     `SELECT * FROM public.arguments`; refuses bare `arguments.body` or
     `evidence_span` outside `LENGTH/AVG/MAX/MIN/COALESCE/COUNT`
     wrappers; asserts every SQL file is properly terminated and named.
   - `opsMcpObservabilityDoctrineBanList.test.ts` — parameterized scan
     over every banned token (`winner`, `loser`, `fallacy`, `bad faith`,
     `manipulative`, `extremist`, `propagandist`, `liar`, `dishonest`,
     `correct`, `incorrect`) against section titles, questions,
     emptyMessages, and the rendered markdown body before Appendix B
     (which legitimately enumerates the list).
   - `opsMcpObservabilityEvidencePreviewSafety.test.ts:77-121` — proves
     the truncate-before-scan ordering: a banned token at characters
     115-119 IS caught, a banned token at characters 121+ is dropped
     by truncation to 120 and therefore not in the output.

3. **Verification gates all PASS at the reviewer's re-run.**
   - `npm run typecheck` exit 0 (TypeScript clean across the full repo
     including the new tests).
   - `npm run lint` exit 0 (ESLint clean with `--max-warnings 0`).
   - `npm run test` — **17,834 / 17,834 tests pass / 559 / 559 suites
     pass** — exactly matching the implementer's reported delta of
     +122 tests over the 17,712 baseline (10 new `opsMcpObservability*`
     suites contribute 122 new tests; existing 549 suites untouched).
   - Targeted regression
     `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage`
     — 50 suites / 1048 tests PASS (matching implementer's report).
   - All 10 new `opsMcpObservability*` test files pass: 122 tests, 0
     failures.

---

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0) |
| test (full suite) | pass — 17,712 → 17,834 (+122) / 549 → 559 suites |
| test (targeted regression) | pass — 50 suites / 1048 tests |
| secret scan over diff | clean (only test-assertion and meta-listing strings) |
| doctrine scan over diff | clean (only BANNED_TOKENS list definition + meta-listing) |
| Source 6 byte-equal (`src/...`) | empty diff |
| migration footprint | empty (0 files under supabase/migrations/) |
| package.json / lock | empty diff |
| .skip / .only / xit / xdescribe / console.log in new tests | none |
| `fetch(` in unit tests | only inside a `expect ... not.toContain` assertion |

---

## 22-item verdict matrix

| # | Item | Status | Evidence |
|---|---|---|---|
| A | Scope: observability only; no taxonomy / prompt / MCP server / Source 6 / auto-trigger change | PASS | `git diff main..HEAD -- src/ mcp-server/ supabase/` returns empty |
| B | Source 6 production-only filter literally present + untouched at `machineObservationPersistenceQuery.ts:127` | PASS | Literal `.eq('argument_machine_observation_runs.run_mode', 'production')` confirmed in source by direct Read; zero diff on file |
| C | No new migration (zero files under `supabase/migrations/`) | PASS | `git diff main..HEAD --name-only` lists zero migration files |
| D | No service-role usage in any new file | PASS | `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:84-98, 150-156` PASS; no `SERVICE_ROLE`, no `@supabase/supabase-js`, no `process.env.SUPABASE_SERVICE_ROLE_KEY` |
| E | No JWT / Bearer / Authorization / API key literal in any new file | PASS | `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:100-148` PASS; the only `Bearer`/`Authorization` mentions in diff are test assertions and operator-doc grep instructions |
| F | No raw argument body selection in any SQL file | PASS | `opsMcpObservabilitySqlSafety.test.ts:111-130` PASS; no `arguments.body` reference in any of the 14 SQL files |
| G | No full evidence_span output in default report (truncation logic correct) | PASS | `opsMcpObservabilityEvidencePreviewSafety.test.ts` 11 tests PASS, including the truncate-before-scan ordering proof |
| H | Report distinguishes production vs admin_validation (Q1 / Q8) | PASS | Q1 SQL groups by `run_mode`; Q8 lib code does the literal-line readback; `opsMcpObservabilityReportShape.test.ts:126-133` PASS |
| I | Report groups by family (Q2 / Q2b / Q3 / Q5 / Q6 / Q11) | PASS | Q2-Q11 SQL files all group by family; `opsMcpObservabilityMultiFamily.test.ts` 8 tests PASS |
| J | Report identifies failure reasons (Q4) | PASS | Q4 SQL aggregates `failure_reason`; SECTIONS descriptor names it; `opsMcpObservabilityReportShape.test.ts:62-79` confirms Q4 in ordering |
| K | Report includes rawKey positive density (Q6 / Q7) | PASS | Q6 lists top raw_keys by family; Q7 computes positives-per-run in recent window |
| L | Report includes duplicate-run query (Q9) | PASS | Q9 SQL groups by (argument_id, family, run_mode, schema_version, provider_key, model_name); HAVING > 1 |
| M | Report annotates family support status (Q11 + Appendix A) | PASS | `parseEdgeFamilyRegistry` parses the Edge `familyRegistry.ts`; Q11 SQL filters B+C; `opsMcpObservabilityMultiFamily.test.ts:118-129` confirms productionEnabled = [parent_relation] |
| N | Test forecast met (+122 observed; +94 design; +200 HALT) | PASS | Implementer-documented consolidation; 122 well below +200 HALT |
| O | All new tests pass (10 suites / 122 tests) | PASS | Reviewer re-run: `npx jest --testPathPattern="opsMcpObservability"` — 122 / 122 PASS |
| P | Existing Jest tests pass (no regression) | PASS | Reviewer re-run full suite: 17,834 / 17,834 PASS; targeted regression: 50 / 50 suites |
| Q | No verdict / person-language tokens in section headings or labels in report or operator-facing doc | PASS | `opsMcpObservabilityDoctrineBanList.test.ts:117-155` PASS over SECTIONS title + question + emptyMessage |
| R | No UI / dashboard added (script-first) | PASS | Zero `.tsx` files in diff |
| S | No OAuth or browser interaction required to run the report | PASS | Script uses `npx supabase db query --linked` only (Management API; OAuth-free per design D1) |
| T | `.mjs` + `.cjs` split is operator-opaque and necessary (Jest CommonJS bridge justification) | PASS | `.mjs` is the operator-facing entry; `.cjs` is the pure-helper lib (no live DB calls in helpers); bridge via `createRequire(import.meta.url)`; `opsMcpObservabilityNoLiveDb.test.ts:74-93` proves `stitchMarkdownReport` and `buildJsonArtifact` do NOT call `spawnSync` |
| U | CLI surface matches design §5 | PASS | All 6 documented flags (`--out-dir`, `--time-window-days`, `--include-argument-detail`, `--include-evidence-preview`, `--json-only`, `--no-write`) + `--help` implemented in `parseCliArgs`; 21-test assertion coverage in `opsMcpObservabilityCliArgParsing.test.ts`; exit codes 0-5 match design |
| V | Doctrine scan: no `winner / loser / correct / incorrect / fallacy / bad faith / manipulative / extremist / propagandist / liar` as verdict tokens | PASS | Only matches in diff are: BANNED_TOKENS list definition (intentional, defining the ban-list), test assertion strings (verifying tokens are flagged when present), and meta-listing in operator doc (`"never contains … `winner`, `loser`, …`"`) |

**Matrix score:** 22 PASS / 0 FAIL / 0 NOT-APPLICABLE.

---

## HALT trigger re-evaluation

All 22 HALT triggers from intent brief §10 re-evaluated against the
code at HEAD `73c2486`:

**All 22 HALT triggers re-evaluated CLEAN.**

Per-trigger notes for the runtime-shaped ones the design called out
as deferred to implementation:

- **#11 (new tables / migrations).** `git diff main..HEAD -- supabase/migrations/` returns empty. No new migration.
- **#12 (UI before script).** `git diff main..HEAD --name-only | grep '\.tsx$'` returns empty. No UI.
- **#18 (test forecast exceeds +200).** +122 observed; below the +200 threshold. Implementer's design-deviation report explains the consolidation from a naive +239 plan via parameterized DDL-keyword tests, landing above the design forecast band but well under HALT.
- **#19 (OAuth / browser interaction).** Script invokes `npx supabase db query --linked --file <file> --output json` only. Per design A.1, this path is the Management API session (operator's pre-authenticated `npx supabase login` session). No browser interaction.
- **#20 (third-party observability vendor).** `git diff main..HEAD -- package.json package-lock.json` returns empty. Pure Node 20+ stdlib. No new deps.
- **#21 (dirty worktree at PR creation).** `git status --short` lists exactly 10 untracked files — all known operator-territory artifacts named in `docs/core/current-status.md`'s OPS-MCP-OBSERVABILITY block. None are in the implementation diff path.
- **#22 (doctrine verdict tokens in operator-facing labels).** Grep across `scripts/ops/`, `docs/ops/`, `docs/audits/` finds the banned tokens only inside (a) the BANNED_TOKENS list definition (intended use), (b) the operator-doc's "Doctrine guarantees" section that enumerates them as banned, and (c) the smoke audit template's `grep` instructions that detect leaks. No usage as labels.

---

## Doctrine deep-check findings (the 8 special checks)

1. **Source 6 binding constraint integrity.** PASS at three layers.
   The file `src/features/nodeLabels/machineObservationPersistenceQuery.ts`
   was directly read at line 127 by the reviewer and the literal
   `.eq('argument_machine_observation_runs.run_mode', 'production');`
   is present byte-equal. `git diff main..HEAD -- src/` is empty.
   `opsMcpObservabilitySourceSixSafety.test.ts:74-103` re-reads the
   file via `fs.readFileSync(ABS_PATH, 'utf8')` and asserts the literal
   substring is present and `'admin_validation'` is absent. The lib
   stores the literal as two concatenated fragments (`SOURCE_SIX_LITERAL_FRAGMENT_A`
   + `SOURCE_SIX_LITERAL_FRAGMENT_B`) so the test file itself does not
   carry the contiguous binding string — an elegant defense-in-depth
   pattern. Runtime safety check in `mcp-observability-report.mjs:78-85`
   aborts with exit code 3 before any SQL query runs if the binding
   constraint is missing.

2. **SQL safety scan.** PASS over all 14 SQL files.
   Read each file under `scripts/ops/sql/`. Every SELECT list is
   enumerated (no `SELECT *`); aggregation functions (COUNT, FILTER,
   DISTINCT, ROUND, NULLIF, DATE_TRUNC) are used appropriately; no
   `arguments.body` or `evidence_span` reference in executable SQL
   (only one mention is inside a comment in `06-top-positive-raw-keys-by-family.sql`
   noting that evidence_span is excluded); no DDL keyword; no
   `service_role`, `apikey`, `Bearer`, or `Authorization` reference;
   every file has a header comment beginning with `OPS-MCP-OBSERVABILITY`
   and a closing semicolon. The `02b-runs-by-requested-family.sql`,
   `03-runs-by-family-and-status.sql`, `04-failure-reasons-by-family.sql`,
   `11-family-bc-admin-validation-check.sql` all use `unnest(requested_families)`
   safely with an indexed-or-acceptable-sequential-scan plan
   (corpus is ~30 rows today). `12-unsupported-family-attempts.sql`
   has a subquery for `positives_observed` that uses an `OR` predicate
   to catch both `results.family = u.family_name` and
   `u.family_name = any(r2.requested_families)` — defensive belt-and-braces
   for the binding "zero positives for unsupported families" assertion.

3. **Script source safety scan.** PASS.
   `scripts/ops/mcp-observability-report.mjs` is a thin 184-line entry
   that resolves the repo root via `import.meta.url`, dispatches the
   safety check, runs the 14 SQL files, stitches markdown + JSON, runs
   the doctrine scan, and writes the artifacts. No hardcoded secret;
   no env-var read that exfiltrates a secret; the only env access is
   none (the script delegates auth entirely to `npx supabase db query --linked`
   which reads the operator's pre-authenticated CLI session).
   `scripts/ops/mcp-observability-report-lib.cjs` is the 681-line pure-helper
   library with no `fetch`, no `@supabase/supabase-js`, no `process.env.*`
   secret read. The `--include-evidence-preview` path's `safeTruncateEvidence`
   function truncates BEFORE the doctrine scan (the truncate-then-scan
   ordering proved correct by 11 tests in
   `opsMcpObservabilityEvidencePreviewSafety.test.ts`). The doctrine
   ban-list scan over the stitched markdown happens before write — line
   128-137 of the `.mjs` entry — and exits with code 2 on failure
   (defense-in-depth, since the source-scan tests should already catch
   any such leak).

4. **Test source safety scan.** PASS over all 10 test files.
   No `.skip`, no `.only`, no `xit`, no `xdescribe`, no `console.log`.
   No `fetch(` call (only one `expect ... not.toContain('fetch(')`
   assertion that verifies the lib does not use fetch). No
   `process.env` read demanding a real secret. The fixture
   `__tests__/fixtures/opsMcpObservabilityFixture.ts` contains zero
   real-looking secrets, zero raw argument bodies — only `Object.freeze`
   nested fake aggregates with synthetic UUIDs and the registered
   taxonomy raw_key values (verified against `multiFamily.test.ts:142-160`
   which enumerates the Family A 16-key set).

5. **Operator-facing doc audit.** PASS.
   `docs/ops/OPS-MCP-OBSERVABILITY.md` is 325 lines. Section headings
   are plain English ("Q1 — Runs by run_mode", "Q5 — Positive results
   by family", "Source 6 production filter present", "Over/under-firing
   summary"). The "Doctrine guarantees" section (lines 226-247) lists
   the banned tokens by name as a meta-description; this is the
   intended use. The "How to run" section (lines 33-53) names exactly
   the CLI flags implemented in `parseCliArgs` — `--out-dir`,
   `--time-window-days`, `--no-write`, `--json-only`, `--help` —
   matching the actual `helpText()` output. No inline secret examples;
   the prerequisites section (lines 57-62) correctly states the
   operator must have `npx supabase login` previously completed and
   the project linked. Plain-language posture preserved (no internal
   codes leaking as labels; `mcp_validation_failed` is shown as a
   server-controlled enum value in tables, not as UI copy).

6. **Smoke audit template structure.** PASS.
   `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md` is 339 lines
   with 6 phases (Pre-flight, Run report, Verify sections populated,
   Verify default output safety, Targeted regression, OPS observations
   + verdict + audit doc commit) — exactly mapping to design §smoke-plan
   and intent brief §14. Each phase has explicit PASS / PARTIAL / FAIL
   criteria. Phase 1 enforces the locked-file diff sanity check
   (`git diff main -- src/features/nodeLabels/ mcp-server/ supabase/functions/_shared/booleanObservations/ supabase/migrations/`
   must return empty). Phase 4's secret + doctrine grep instructions
   are syntactically correct and use the `sed '/^## Appendix B/,$d'`
   pattern to exclude the meta-enumeration section. The follow-on
   card filing checkboxes (Q9 → OPS-MCP-IDEMPOTENCY-HARDENING,
   Q12 positives → security-adjacent finding) align with intent brief §16.

7. **.mjs + .cjs split justification.** PASS.
   The implementer's one acknowledged design deviation. The split is
   operator-opaque: `node scripts/ops/mcp-observability-report.mjs` is
   the operator-facing entry (matches design §5 + the operator doc's
   "How to run"). The `.cjs` is purely the helper library — no live DB
   calls in the pure helpers (`opsMcpObservabilityNoLiveDb.test.ts:74-93`
   verifies `stitchMarkdownReport` and `buildJsonArtifact` slices do
   NOT contain `spawnSync(`). The bridge uses `createRequire(import.meta.url)`
   from Node 20+ stdlib (no new dep). The justification — Jest's
   default loader treats `.mjs` as ESM and `.cjs` as CommonJS without
   an additional transform — is technically sound and matches a common
   pattern. No circular import (the `.mjs` imports the `.cjs` only;
   the `.cjs` imports only Node stdlib). No hidden secret-read
   introduced by the split.

8. **Test forecast +122 vs +94 forecast.** PASS.
   The implementer documents the consolidation in current-status.md
   (line 5310 "+122 new across 10 new test files; consolidated from
   an initial +239 via the parameterized-DDL-by-keyword-not-by-(keyword,file)
   consolidation per design risk #6"). The actual +122 is over the
   design forecast band (+40 to +80, with the design itself noting
   +94 as the cleaner-shape forecast — see `OPS-MCP-OBSERVABILITY.md`
   §test-plan), but it lands well below the +200 HALT threshold. The
   surplus is concentrated in the parameterized DDL-keyword sub-tests
   inside `opsMcpObservabilitySqlSafety.test.ts` (9 keywords × the
   inner per-file iteration) and the per-banned-token enumeration in
   `opsMcpObservabilityDoctrineBanList.test.ts` (11 tokens via
   `it.each`). Reviewer judgment: the surplus reflects defensive
   coverage, not noise, and the implementer's transparency about the
   consolidation rationale meets the "explain when above design
   forecast" obligation. No `.skip` used to game the count.

---

## Specific actionable comments

None. The implementation matches the design, the doctrine layer is
test-enforced at three levels (script source, SQL files, rendered
output), all 22 HALT triggers re-evaluate clean, and the verification
battery is green at the reviewer's re-run.

---

## Optional polish suggestions (non-blocking; defer or accept post-merge)

1. **`scripts/ops/sql/06-top-positive-raw-keys-by-family.sql`** has a
   comment referencing "evidence_span" (line 11-12) explaining its
   absence. The SQL safety regex correctly strips comments before
   testing, so this is not a hit. Optional polish: phrase the comment
   as "we deliberately do not select the evidence_span column" to make
   the absence even more explicit. Non-blocking.

2. The `--include-argument-detail` flag is parsed but never wired into
   a per-argument table emission in the current implementation (the
   probe at `mcp-observability-report.mjs:140-153` only exercises the
   `--include-evidence-preview` path). The design names
   `--include-argument-detail` (D4 resolution) but defers the
   per-argument table to "where the rare drill-down where an operator
   wants to know 'which specific arguments fired positive for
   acknowledges_misread'." Today the flag is functionally a no-op.
   Non-blocking; a follow-on micro-card could either implement the
   per-argument table or remove the flag. Document the no-op state in
   the operator doc to set correct expectation. Non-blocking.

3. The smoke template's Phase 4 size sanity bound (`wc -c report.md
   < 100 KB`) is a useful invariant. Consider adding a Jest assertion
   that drives the stitcher with the full fixture and verifies the
   markdown stays under, say, 20 KB at fixture-corpus size — would
   catch a regression where the stitcher accidentally renders a
   per-row debug field. Non-blocking; the smoke catches it post-merge.

4. The fixture's `Object.freeze` usage at multiple layers is correct
   but somewhat verbose. A `deepFreeze` helper would condense the
   fixture and keep the immutability guarantee. Non-blocking;
   stylistic.

---

## Recommendation to operator

**PR title:** `OPS-MCP-OBSERVABILITY: Multi-family MCP classifier telemetry report (script-only; no migration)`

**PR body summary:** 4 implementation commits on top of the design at
`553ed30` (which is on top of the operator-authored intent brief at
`fbf7c87`). Adds a read-only operator script + 14 SQL files + 10 test
files + 1 fixture + 2 operator docs. Zero production source touched,
zero migration, zero Edge Function deploy, zero new npm dependency.
+122 Jest tests (well below the +200 HALT threshold). All 22 HALT
triggers re-evaluated CLEAN at code time. Source 6 binding constraint
(`machineObservationPersistenceQuery.ts:127`) is defended at three
independent layers: pre-existing 11 S6F-* tests preserved byte-equal,
new `opsMcpObservabilitySourceSixSafety.test.ts` re-reads the file from
disk and asserts the literal, and the script runtime aborts with exit
code 3 before any SQL invocation if the literal is missing. Per design
§out-of-scope-explicit-list: no UI, no view, no migration, no taxonomy
change, no prompt change, no MCP server change, no auto-trigger change,
no third-party vendor.

Post-merge: run the 6-phase smoke per
`docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md`. Commit the
filled audit doc as `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-<YYYY-MM-DD>.md`.
PASS unlocks `OPS-MCP-IDEMPOTENCY-HARDENING` filing if Q9 returns
non-zero rows, and `OPS-MCP-TOKEN-BUDGET` filing if Q5/Q7 surface
truncation-suggestive signals. `MCP-SERVER-005-FAMILY-D` Stage-2B
operator-decision checkpoint now has cross-family calibration data.

Verdict: **Approve**. Ready to push.

### Operator next steps

```bash
# 1. Push the branch.
git push -u origin feat/OPS-MCP-OBSERVABILITY

# 2. Open the PR.
gh pr create --title "OPS-MCP-OBSERVABILITY: Multi-family MCP classifier telemetry report (script-only; no migration)" \
  --body-file docs/reviews/OPS-MCP-OBSERVABILITY.md

# 3. Deploy steps: NONE (no migration, no Edge Function, no MCP server change).

# 4. Post-merge: run the 6-phase smoke.
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/ops-observability-smoke
# Then follow docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md.

# 5. Post-merge worktree cleanup (operator step; per roadmap-reviewer.md).
#    Run from main repo root.
git worktree list | grep "feat/OPS-MCP-OBSERVABILITY"
git worktree remove -f -f ".claude/worktrees/agent-<hash>"
git branch -D feat/OPS-MCP-OBSERVABILITY
git worktree list | grep -c "agent-<hash>"   # must print 0
```
