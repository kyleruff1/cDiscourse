# OPS-MCP-SMOKE-DOCTRINE-HARDENING — Reviewer Verdict

**Verdict:** APPROVE for merge with PARTIAL post-merge smoke (CI wiring deferred per operator addendum)
**Reviewer agent run:** 2026-05-28
**Branch:** `feat/OPS-MCP-SMOKE-DOCTRINE-HARDENING`
**HEAD:** `d1f3b9a`
**Design:** `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md` (`d1b1b36`)
**Intent:** `docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING-intent.md` (`15b65c6`)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/339

---

## Summary

The implementation converts the operator-stated audit-integrity rules R1-R4 from prose into six mechanical, read-only linter rules L1-L6, with a 4-fixture self-validation centerpiece that demonstrates the linter catches the exact `29f30b0` Family E improper-PASS defect at authoring time. All four fixtures behave exactly as specified by the intent brief: the original Family E doc fails with L1+L2+L5 findings; the PARTIAL amendment, the hosted-completion PASS, and the Family D strengthened amendment all pass with zero findings. The +105 test delta is justified by 23 rule unit tests + 24 detection tests + 15 parser tests + 13 CLI tests + 6 pure-helper discipline tests + 7 rules-file invariant tests + 6 text-normalization tests + 4 fixture self-validations + 3 fixture-directory invariants + 2 determinism tests + 2 formatFindingsText tests, with no redundant duplication observed. The npm `audit-lint` script was reverted in commit `1922279` because RO-36 (MCP-021B read-only boundary) enforces `package.json` unchanged on non-MCP-021B branches; templates, AUDIT-LINT.md, and handoff prose all reference the full `node scripts/ops/audit-lint.mjs <path>` invocation. CI wiring is correctly deferred to a follow-on per HALT trigger 9 (`.github/workflows/` confirmed absent). All gates green: typecheck 0, lint 0, Jest 18,121 (+105), Deno 792 unchanged.

---

## Verification

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0) |
| `npm run test` (full Jest) | pass — **18,121 tests / 570 suites** (baseline 18,016 → 18,121; +105) |
| `npx jest --testPathPattern="opsAuditLint" --no-coverage` | pass — 105 tests / 1 suite |
| `cd mcp-server && deno test` | pass — 792 passed / 0 failed (unchanged) |
| `npx jest -t "RO-36"` | pass — RO-36 package.json-unchanged still green |
| Fixture 1 manual (`original-family-e-IMPROPER-PASS.md`) | **FAILS** as expected (exit 1; cites L1, L2, L5) |
| Fixture 2 manual (`family-e-amendment-PARTIAL.md`) | **PASSES** as expected (exit 0; 0 findings) |
| Fixture 3 manual (`family-e-hosted-completion-PASS.md`) | **PASSES** as expected (exit 0; 0 findings) |
| Fixture 4 manual (`family-d-strengthened-amendment-PASS.md`) | **PASSES** as expected (exit 0; 0 findings) |
| Secret scan | clean (only literal `$MCP_HOSTED_TOKEN` shell-substitution references in fixture body and template — no actual key values) |
| Doctrine scan | clean (two textual references to "winner / loser / liar" inside design + AUDIT-LINT.md are explanatory text declaring what the linter does NOT do; fixture defect language is operator-addendum-exempted) |
| Working tree | clean — only the 10 known operator-territory untracked files |

---

## 8 operator-directive items

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | +105 test delta is justified | **PASS** | See "Test-delta category breakdown" below. 23 rule unit tests, 4 fixture self-validations (centerpiece), 3 fixture-directory invariants, 15 parser tests, 24 detection tests, 13 CLI tests, 6 pure-helper-discipline tests, 7 rules-file invariant tests, 6 text-normalization tests, 2 determinism tests, 2 formatFindingsText tests. No redundant duplication. |
| 2 | No meaningful duplicate/redundant tests | **PASS** | Spot-checked test names across CLI parsing, detection, L1-L6, and fixture suites. Each `it()` block exercises a distinct branch (e.g., L1 has 5 tests covering: fires when required NOT-RUN + PASS; does NOT fire on PARTIAL; does NOT fire when optional; does NOT fire on amendment empty list; vacuously passes no-phase). No pair of tests exercises the same code path. |
| 3 | `package.json` remains unchanged | **PASS** | `git diff main..HEAD -- package.json` returns empty output. The audit-lint npm script was added in `5fb1130` and reverted in `1922279` (the centerpiece commit) when the implementer caught the RO-36 conflict. |
| 4 | RO-36 remains intact | **PASS** | `npx jest -t "RO-36"` passes. Test at `__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts:202` is unchanged. |
| 5 | All docs use direct `node scripts/ops/audit-lint.mjs <path>` invocation, not `npm run audit-lint` | **PASS** | `grep -r "npm run audit-lint"` across the three templates + `docs/ops/AUDIT-LINT.md` + `docs/core/current-status.md` returns zero hits. Every reference uses the full `node scripts/ops/audit-lint.mjs <path>` form. |
| 6 | No doc references the omitted npm script | **PASS** | Same evidence as item 5. The handoff prose in `docs/core/current-status.md` explicitly documents the revert: "`package.json` `audit-lint` npm script reverted in C3 (MCP-021B `RO-36 — package.json unchanged` test conflict; runner remains invokable via full `node scripts/ops/audit-lint.mjs <path>`; smoke templates use the full form)." |
| 7 | Linter self-validates the four fixtures exactly | **PASS** | Manual fixture verification (run directly via `node scripts/ops/audit-lint.mjs`): fixture 1 exits 1 citing L1+L2+L5; fixtures 2, 3, 4 all exit 0 with 0 findings. The L5 finding on fixture 1 is an addition over the intent brief's "L1+L2" minimum and is correct (the original Family E audit IS a doctrine-risk Family E audit that did not inspect persisted `evidence_span`; this is a stronger signal, not a regression). Jest assertions only require L1 and L2 to be present (lines 1044-1046), and they are. |
| 8 | CI wiring PARTIAL/deferred is accepted | **PASS** | `.github/workflows/` confirmed absent. The intent brief §7 operator addendum and design §A.3 both authorize CI deferral. Handoff prose, AUDIT-LINT.md, and current-status.md all document the deferral and name the follow-on card `OPS-MCP-SMOKE-LINT-CI-WIRING`. |

---

## 16-item review matrix

### Scope (designer / intent boundary)

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| A | NO runtime code change | **PASS** | `git diff main..HEAD -- src/ app/ supabase/functions/ mcp-server/` returns empty. |
| B | NO registry / prompt / taxonomy change | **PASS** | None of the changed files (15 total) live in registry / prompt / taxonomy paths. |
| C | NO existing audit doc modified or deleted (templates excepted) | **PASS** | The 3 modified files are templates only: `MCP-SERVER-004-FAMILY-C-SMOKE-template.md`, `MCP-SERVER-005-FAMILY-D-SMOKE-template.md`, `MCP-SERVER-006-FAMILY-E-SMOKE-template.md`. `git diff main..HEAD -- 'docs/audits/*SMOKE*.md' --name-only \| grep -v template` returns empty. |
| D | Linter is READ-ONLY over the audit corpus | **PASS** | `git diff main..HEAD -- scripts/ops/ \| grep -E '(fs\.writeFile\|fs\.unlink\|fs\.rm\|fs\.mkdir)'` returns empty. `audit-lint.mjs` only uses `readFileSync` + `existsSync`. `audit-lint-lib.cjs` has no fs at all (operates on text strings). |
| E | NO network calls in the linter | **PASS** | `git diff main..HEAD -- scripts/ops/ \| grep -E '(fetch\|node:http\|node:https\|node:net)'` returns empty. Pure-helper-discipline tests assert this (`describe('pure-helper discipline')` lines 1237-1276). |
| F | `.github/workflows/` NOT created | **PASS** | `test -d .github/workflows` → ABSENT. Verified by direct file-system check. |

### Linter correctness

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| G | Runner mirrors `mcp-observability-report.mjs` pattern | **PASS** | Both runners use `import { createRequire } from 'node:module'` (line 28 vs line 24) and `const require = createRequire(import.meta.url)` (line 38 vs line 33). Same ESM-entry + CJS-lib pattern. |
| H | Fixture-protection triple layer | **PASS** | (a) HTML comment marker `<!-- AUDIT-LINT-FIXTURE: ... -->` is line 1 of every fixture file (verified via `head -1` on each); (b) `__tests__/fixtures/audit-lint/README.md` declares intent with exclusion contract; (c) Jest test "each fixture file starts with the HTML comment marker" (lines 1102-1108) asserts (a); "README.md exists with required exclusion-contract content" (lines 1092-1100) asserts (b). |
| I | Determinism | **PASS** | `sortFindings` (audit-lint-lib.cjs line 584) sorts by rule id ASCII then line number; no `Date.now`, `Math.random`, UUID generation, or timestamps in linter output. Two determinism tests (lines 1123-1146) assert same-input-same-output and sort order. |
| J | Marker + added-vs-modified scoping closes evasion loophole | **PASS** | Per design §A.3 + AUDIT-LINT.md "Marker mechanism": ADDED smoke audit docs are always linted regardless of marker (closes loophole); MODIFIED docs without marker are exempted (preserves historical edits). Marker constant `'Audit-Lint: v1'` is exact-match. The scoping itself is documented for the future CI follow-on; the runner does not enforce scoping (the runner lints whatever path it receives — scoping is a CI-policy concern, as designed). |
| K | Rules data is pure DATA | **PASS** | `audit-lint-rules.cjs` exports only Sets, Arrays, RegExps, and a string constant. `Object.freeze` is applied to top-level audit-type / phase / assertion bundles. No functions executed at require time beyond exports. `it('rules source: contains no fs / spawn / network references')` (line 1261) asserts this. |

### Smoke template + handoff

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| L | Smoke-template updates are ADDITIVE only | **PASS** | `git diff main..HEAD -- docs/audits/*-template.md` shows two additions only per template: (1) `Audit-Lint: v1` marker line near top; (2) `## Audit-lint required final step` section appended at end. No existing required-phase substance changed. |
| M | `docs/ops/AUDIT-LINT.md` documents required topics | **PASS** | 221 lines covering: usage (lines 15-29), exit codes (lines 33-39), six rules (lines 43-50), audit-type detection (lines 56-71), phase-id normalization (lines 73-85), marker mechanism (lines 87-101), CI deferral rationale (lines 103-117), how to add a doctrine-risk family (lines 119-141), how to add an indirect-proof phrase (lines 143-158), fixture directory contract (lines 160-181), updating a smoke template (lines 183-195), what the linter is NOT (lines 197-211). All required topics present. |
| N | `docs/core/current-status.md` adds ONE paragraph | **PASS** | `git diff main..HEAD -- docs/core/current-status.md` shows exactly 6 added lines forming a single new section header + paragraph. No existing content rewritten. |

### Working tree + secrets

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| O | Working tree shows only the 10 known operator files | **PASS** | `git status --porcelain` returns exactly the 10 expected entries: 4 testing-run docs + 3 mcp021c-edge-smoke files + 1 netlify-prod.git + 2 phase5-mcpserver002 logs. No unclassified untracked files. |
| P | No raw JWTs, MCP_HOSTED_TOKEN, ANTHROPIC_API_KEY, service-role keys | **PASS** | Refined secret scan `KEY\s*[:=]\s*[A-Za-z0-9_-]{8,}` returns zero hits. The earlier broad scan matched `$MCP_HOSTED_TOKEN` references inside shell scripts and fixture body text — these are env-var SUBSTITUTIONS / NAMES, not actual key values, and are present in pre-existing template content. |

---

## Test-delta category breakdown (operator item 1)

Counts from `awk '/^describe\(/{section=$0} /^\s+it\(/{count[section]++}'` over `__tests__/opsAuditLint.test.ts`:

| Category | Tests | Files | Justification |
| --- | --- | --- | --- |
| L1-L6 rule unit tests | 23 | (L1=5, L2=5, L3=3, L4=3, L5=4, L6=3) | Each rule covers: positive trigger, negative-on-PARTIAL, negative-on-optional/non-doctrine-risk, negative-on-non-amendment, etc. Mirror of intent §11 forecast (~3-5 tests per rule). |
| **4-fixture self-validation (CENTERPIECE)** | **4** | `__tests__/fixtures/audit-lint/*.md` | The existential test contract from intent §4 + HALT trigger 8. Each fixture's expected exit code + rule trips is asserted. |
| Fixture-directory invariants | 3 | (README exists + each fixture has marker + count exactly 4) | Implements design §A.4 fixture-protection triple layer + operator-addendum doctrine-scan protection. |
| Parser tests | 15 | (parseAuditDoc=13, lintAuditDoc basic=2) | Title extraction, audit type detection, marker presence, 5 verdict-header forms, multi-verdict last-wins, phase extraction with statuses, (optional) marker, CRLF tolerance, BOM tolerance, code-block ignore. Each tests a distinct format-variance case from design §A.1. |
| Detection tests | 24 | (audit-type=10, family=8, phase-id=6) | Each audit-type / family / phase-id detection variant per design §A.2. Includes precedence tests (AMENDMENT > COMPLETION > family-ship) and override tests (body-level `Audit-type:` wins). |
| CLI tests | 13 | (CLI parsing=9, template refusal=4) | Empty argv, non-array, --help, -h shorthand, --report-only, positional doc path, unknown flag, two positionals, helpText content. Template refusal covers 4 filename patterns. |
| Text normalization | 6 | (stripBom=3, splitLines=3) | BOM/CRLF/LF/non-string tolerance per design §A.1 format-variance row. |
| Pure-helper discipline (source scan) | 6 | Asserts no `spawnSync`, no `child_process`, no fs reads in lib, no fetch/http/https, no fs/network in rules, entry mjs delegates via createRequire | Mirrors `__tests__/opsMcpObservabilityNoLiveDb.test.ts` source-scan pattern. |
| Rules-file invariants | 7 | Marker exact value, non-empty pattern bundles, doctrine-risk set membership, required phase set, direct-proof phase set, L2 phrase regex, three-key production-enable bundle | Schema assertions for `audit-lint-rules.cjs` pure-data shape. |
| Determinism | 2 | Same input → same output; sort order stable | Asserts HALT trigger 11 (non-determinism) does not fire. |
| formatFindingsText | 2 | Zero-findings rendering; rule id prefix | Covers the CLI human-readable output path. |
| **TOTAL** | **105** | | Within intent §11 forecast band (+25 to +60 expected; +105 actual). Per operator addendum: accepted via operator Option 1. |

**Redundancy spot-check (operator item 2):**

- L1 has 5 tests, each exercising a distinct branch: fires-on-required-NOT-RUN-PASS / does-not-fire-on-PARTIAL / does-not-fire-on-explicit-optional / does-not-fire-on-amendment-empty-set / vacuously-passes-no-phases. No pair exercises the same predicate.
- audit-type detection has 10 tests covering family-ship / amendment / hosted-completion / production-enable / ops / unknown / amendment-precedence-over-family-ship / hosted-completion-precedence-over-family-ship / amendment-precedence-over-completion / body-level-override. The three precedence tests look adjacent but each tests a distinct precedence rule.
- Determinism has 2 tests: same-input-same-output (assert pure function) vs sort-order-stable (assert sortFindings invariant). Distinct.
- The 4 fixture self-validation tests are not redundant with the rule unit tests — the rule unit tests use synthetic minimal docs, the fixtures are real historical docs that exercise the rules end-to-end against real content variance.

No redundant duplication found.

---

## Fixture-validation evidence (manual run)

Each command was executed by the reviewer; outputs captured verbatim:

```
$ node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/original-family-e-IMPROPER-PASS.md
[audit-lint] C:\Users\kyler\cdiscourse\debate-constitution-app\__tests__\fixtures\audit-lint\original-family-e-IMPROPER-PASS.md
  title:       MCP-SERVER-006-FAMILY-E-SMOKE — Post-merge audit
  audit-type:  family-ship
  verdict:     PASS
  findings:    3
    [L1] Required phase(s) NOT-RUN but verdict is PASS — under R1/R2 the verdict CANNOT exceed PARTIAL.
    [L2] Direct-proof-required phase justified by indirect-proof phrase — R4 forbids substitution.
    [L5] Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).
EXIT: 1
```

```
$ node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-e-amendment-PARTIAL.md
  title:       MCP-SERVER-006-FAMILY-E-SMOKE — Amendment (smoke-completion)
  audit-type:  amendment
  verdict:     PARTIAL
  findings:    0 (PASS)
EXIT: 0
```

```
$ node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-e-hosted-completion-PASS.md
  title:       MCP-SERVER-006-FAMILY-E-SMOKE — Hosted-smoke completion (Gap 1 closed)
  audit-type:  hosted-completion
  verdict:     PASS
  findings:    0 (PASS)
EXIT: 0
```

```
$ node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-d-strengthened-amendment-PASS.md
  title:       MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — Amendment per strengthened proof obligations
  audit-type:  amendment
  verdict:     PASS
  findings:    0 (PASS)
EXIT: 0
```

All four match expected outcomes. Fixture 1 reports L1+L2+L5 (the intent brief required L1+L2 as the minimum; L5 is an additional correct finding — the original Family E audit was a doctrine-risk family-ship audit that did not cite persisted `evidence_span`, so L5's third finding is doctrinally accurate, not a regression). The Jest assertion at line 1044-1046 verifies `ruleIds.toContain('L1')` and `ruleIds.toContain('L2')` without requiring exhaustive equality, so L5's addition is compatible.

---

## Doctrine self-check

| Rule | How the implementation respects it |
| --- | --- |
| §1 score is not truth | N/A — no scoring surface touched. |
| §2 heat is activity, not truth | N/A. |
| §3 popularity is not evidence | N/A. |
| §4 AI moderator limits | N/A — linter is pure regex / text parsing; no LLM call; no network. |
| §5 rules engine sacred | N/A — `src/lib/constitution/engine.ts` unchanged. |
| §6 secrets policy | Linter reads docs from local filesystem; never reads env vars (verified by `git diff main..HEAD \| grep "process\.env"` returning empty in scripts/ops/); never touches secrets. |
| §7 no AI calls from prod app | N/A — script is `scripts/ops/`, not prod app; no AI calls. |
| §8 Supabase conventions | N/A — no DB, no migration, no RLS. |
| §9 plain language for users | N/A — operator-facing tool. CLI output uses plain English exit codes + finding messages. |
| §10a observations vs allegations | N/A — no node-label surface touched. |
| §10 v1 scope guards | Linter is process tooling, not a user feature. No voting / scoring / search / OAuth introduced. |

---

## test-discipline self-check

| Rule | How the implementation respects it |
| --- | --- |
| Tests are part of done | 105 new tests bundled in this card. |
| Test file location | `__tests__/opsAuditLint.test.ts` (top-level). Fixtures under `__tests__/fixtures/audit-lint/`. |
| Pure-model tests | All linter helpers are pure (no fs in lib; no network). Tests import via `require()` from CJS lib. Source-scan tests (lines 1237-1276) assert pure-helper discipline. |
| Doctrine ban-list test | No new ban-list scanner added. Fixture directory protection contract (README + HTML markers + Jest assertions) protects existing scanners from false-failing on fixture content per operator addendum. |
| Test count goes UP | +105 new tests; baseline 18,016 → 18,121. |
| Gate timeouts | Targeted `--testPathPattern="opsAuditLint"` runs in 0.812s; full suite runs in 14.9s. All exit codes captured explicitly. |

---

## Blockers

None.

---

## Suggestions (non-blocking)

1. **Consider a future test for the marker-scoping CI logic itself.** The runner does not enforce the added-vs-modified marker scoping today — that's a CI-policy concern designed into the follow-on `OPS-MCP-SMOKE-LINT-CI-WIRING` card. When the follow-on lands, add a test that simulates the scoping rule (e.g., given a fixture file list with status A vs M, the scoping function returns the right "lint" / "skip" verdicts). Not in scope for this card.
2. **L5 fixture-1 finding is doctrinally correct but not minimum-required.** The intent brief specifies L1+L2 minimum for fixture 1; the linter additionally reports L5 because the original Family E audit was indeed doctrine-risk-without-persisted-inspection. This is a stronger signal than required and is not a defect. If the operator wants the centerpiece test to assert the FULL set (L1+L2+L5) rather than just `.toContain('L1')` + `.toContain('L2')`, a one-line tightening in the test would do it; otherwise leave as-is to keep the minimum contract.
3. **AUDIT-LINT.md mentions the future `OPS-MCP-SMOKE-LINT-CI-WIRING` card.** Once that card exists and ships, update AUDIT-LINT.md § "CI deferred" to remove the deferral wording. The handoff prose in current-status.md is fine as-is for the moment.

These are all post-merge polish; none block the verdict.

---

## Operator next steps

- **Push the branch:** `git push -u origin feat/OPS-MCP-SMOKE-DOCTRINE-HARDENING`
- **Open PR:** `gh pr create --title "OPS-MCP-SMOKE-DOCTRINE-HARDENING: Audit-lint enforcement for direct-proof obligations (L1-L6 + 4-fixture self-validation; CI deferred)" --body-file docs/audits/OPS-MCP-SMOKE-DOCTRINE-HARDENING-REVIEW-2026-05-28.md`
- **Post-merge smoke plan** (per design §12, PARTIAL expected per CI deferral):
  - Phase 1 — Re-run the 4-fixture self-validation manually; confirm exit codes match expected (already verified at review time).
  - Phase 2 — Optional informational corpus census: `for f in docs/audits/*SMOKE*.md; do node scripts/ops/audit-lint.mjs "$f" --report-only; done`. Never blocks.
  - Phase 3 — Document the simulated CI-scoping verification (added-vs-modified marker logic) in the smoke audit doc.
  - Phase 4 — Regression: re-run `npm run typecheck && npm run lint && npx jest --testPathPattern="opsAuditLint" --no-coverage && cd mcp-server && deno test`.
  - Phase 5 — Dogfood: write a `docs/audits/OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE-<date>.md` carrying `Audit-Lint: v1` marker; run `node scripts/ops/audit-lint.mjs` against it; it must exit 0.
- **No Supabase deploy required.** This card touches no Edge Function, no DB, no migration.
- **Post-merge worktree cleanup** (per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)"):
  ```
  cd <main repo root>
  git worktree list | grep "feat/OPS-MCP-SMOKE-DOCTRINE-HARDENING"
  git worktree remove -f -f ".claude/worktrees/<this-worktree>"
  git branch -D feat/OPS-MCP-SMOKE-DOCTRINE-HARDENING
  git worktree list | grep -c "OPS-MCP-SMOKE"   # must print 0
  ```
- **Authorizations granted on PARTIAL post-merge** (per intent §13):
  - `MCP-SERVER-007-FAMILY-F` — its smoke audit ships under the linter from Phase 1.
  - `MCP-021C-EDGE-FAMILY-E-ENABLE` — its production-enable audit must satisfy L3+L4 from authoring.
  - `OPS-MCP-SMOKE-LINT-CI-WIRING` — file as follow-on whenever `.github/workflows/` is introduced.
