# OPS-MCP-SMOKE-LINT-CI-WIRING — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** OPS — process / audit-integrity tooling (CI completion of OPS-MCP-SMOKE-DOCTRINE-HARDENING)
**Predecessor on main:**
- `audit(OPS-MCP-SMOKE-DOCTRINE-HARDENING)` PARTIAL smoke at `e4fe8c6`
- `OPS-MCP-SMOKE-DOCTRINE-HARDENING` merged at `91a3664` (PR #340)
- Intent brief at `15b65c6`

---

## 1. Why this card exists

OPS-MCP-SMOKE-DOCTRINE-HARDENING landed with PARTIAL verdict because CI wiring was deferred (no `.github/workflows/` directory existed; introducing GitHub Actions infrastructure would have been a non-additive shared-workflow change inside that card, firing HALT trigger 9). This card is the planned follow-on that lifts the PARTIAL cap by wiring audit-lint into GitHub Actions for new/modified smoke audit docs.

The enforcement gap this closes: today, the L1-L6 linter only runs if an operator remembers to invoke `node scripts/ops/audit-lint.mjs <doc>` as the smoke template's required final step. A reviewer or operator can forget. CI wiring makes the linter mechanically enforced on every PR that touches a smoke audit.

---

## 2. Strict scope

**IN:**
- `.github/workflows/audit-lint.yml` (NEW; this card creates `.github/` + `.github/workflows/`)
- Single shared changed-file classifier (extend audit-lint OR a thin helper under `scripts/ops/` the workflow calls)
- Classifier unit tests in `__tests__/opsAuditLint.test.ts` (additive)
- `docs/ops/AUDIT-LINT.md` workflow documentation update
- A post-merge smoke audit that itself lints green AND proves the CI scoping logic

**OUT:**
- NO linter RULE changes (L1-L6 unchanged) — if a CI integration bug forces a small compatibility fix, surface BEFORE changing a rule
- NO runtime code (`src/`, `supabase/functions/`, `mcp-server/`)
- NO `package.json` changes (RO-36 ratchet stands; if unavoidable → HALT and surface first)
- NO global historical audit linting (the corpus is exempt by design)
- NO full project CI pipeline (this is an audit-lint-only workflow)
- NO migration; no Supabase deploy; no Anthropic / xAI / X API call

---

## 3. Required workflow shape

**File:** `.github/workflows/audit-lint.yml`

### Triggers
```yaml
on:
  pull_request:
    paths:
      - 'docs/audits/**SMOKE*.md'
      - 'scripts/ops/audit-lint.mjs'
      - 'scripts/ops/audit-lint-lib.cjs'
      - 'scripts/ops/audit-lint-rules.cjs'
      - '__tests__/fixtures/audit-lint/**'
```

Linter source-file changes trigger because changing the linter without re-running self-validation would silently break enforcement; that's the same evasion path the marker scoping closes for new audits.

### Steps
1. `actions/checkout@v4` with `fetch-depth: 0` (so the PR base SHA's tree is fetchable for diff)
2. `actions/setup-node@v4` with the project's Node version
3. Resolve `BASE_SHA="${{ github.event.pull_request.base.sha }}"` and `HEAD_SHA="${{ github.event.pull_request.head.sha }}"`
4. Run the shared classifier: `node scripts/ops/audit-lint.mjs --classify-changed --base "$BASE_SHA" --head "$HEAD_SHA"` (or equivalent helper) → returns the in-scope set as one path per line on stdout
5. For each in-scope path: `node scripts/ops/audit-lint.mjs <path>`; aggregate exit codes
6. If no applicable files → exit 0

### What MUST NOT happen
- DO NOT use `HEAD~1` or `origin/main` or any guessed base — under force-push / stale-base / squash, these go wrong precisely when enforcement matters
- DO NOT re-implement the added-vs-modified scoping in YAML/bash; that drift between CI and linter is the bug class this card explicitly prevents
- DO NOT add `npm run audit-lint` (RO-36 ratchet from prior card stands; canonical invocation is direct node)
- DO NOT touch any non-audit-lint files in CI

---

## 4. Single-source scoping rule (binding)

The workflow passes the changed-file list (with `A` / `M` status) to ONE shared classifier. The classifier returns the in-scope set. CI and the runner cannot disagree about what's in scope.

| Status | Marker check | In-scope? |
| --- | --- | --- |
| `A` (added smoke audit doc) | not needed | YES — always linted (closes "add new audit without marker" evasion) |
| `M` (modified smoke audit doc) | marker present? | YES if contains `Audit-Lint: v1` |
| `M` (modified smoke audit doc) | marker absent? | NO — historical, exempt |
| Any other path | n/a | NO — out of scope |

If no applicable files → exit 0.

The classifier reads marker presence at the HEAD-SHA version of the file (the state that would land if merged), not the base. This handles the case where a PR adds the marker to a previously-unmarked doc — that PR is itself the act of bringing the doc under enforcement, and the linter should run on the new content.

---

## 5. Implementation expected — classifier surface

Either:
- **Option A (preferred):** extend `scripts/ops/audit-lint.mjs` with a `--classify-changed` mode that accepts `--base <sha>` and `--head <sha>`, runs `git diff --name-status <base> <head>`, applies the rule above, and prints one in-scope path per line. The workflow consumes this list directly.
- **Option B:** a thin separate helper `scripts/ops/audit-lint-classify-changed.mjs` (or `.cjs`) used by BOTH the workflow AND a new Jest test. The classifier MUST share its decision logic with `audit-lint-rules.cjs` (the marker string lives in rules).

Either way: ONE classifier, used by BOTH CI and the test suite. NO YAML-side rule logic.

---

## 6. Required tests (binding — not "if needed")

### Classifier unit test (CENTERPIECE)
A new test block in `__tests__/opsAuditLint.test.ts` that:
1. Mocks/stubs `git diff --name-status` output via a test seam (e.g., classifier accepts an injected list)
2. Asserts each of the 4 truth-table rows above produces the expected in-scope/out-of-scope decision
3. Asserts: no applicable files → empty result
4. Asserts: the marker string used by the classifier matches the marker string in `audit-lint-rules.cjs` (single-source check)

### Workflow-calls-classifier proof
The Jest suite asserts (by reading `.github/workflows/audit-lint.yml`) that the workflow's lint step invokes the same classifier surface tested above — closing the drift loophole at the test layer. The workflow file becomes a fixture the test reads.

### Existing tests preserved
`opsAuditLint.test.ts` 105/105 baseline must remain green; new classifier tests add to that count (forecast +10 to +25 from this card; HARD HALT at +50 since the scope is narrow).

---

## 7. Post-merge smoke audit (proves CI scoping)

`docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-<date>.md` carries `Audit-Lint: v1` AND demonstrates each scoping case:

1. **Added doc without marker → linted** (closes evasion at CI layer; verified by classifier unit test + manual classifier invocation against a simulated changed-file list)
2. **Modified historical doc without marker → exempt** (verified by classifier invocation against a historical fixture's path)
3. **Modified marked doc → linted** (verified against this very smoke audit)
4. **Historical corpus → NOT globally enforced** (workflow paths filter excludes corpus-only changes; verified by inspecting `on.pull_request.paths`)
5. **Base SHA diff resolves correctly (not HEAD~1)** (verified by reading the workflow YAML)

The smoke audit must itself lint green (dogfood — same pattern as the predecessor card).

---

## 8. HALT triggers (15)

### Scope (1-5)
1. Any linter RULE change without surfacing FIRST
2. Any runtime code change (`src/`, `supabase/functions/`, `mcp-server/`)
3. `package.json` modified (RO-36 ratchet must hold — if unavoidable, HALT and surface)
4. Workflow lints the FULL historical corpus by default
5. Any non-audit-lint CI workflow added

### Correctness (6-11)
6. Diff base is `HEAD~1` / `origin/main` / any guessed base instead of `${{ github.event.pull_request.base.sha }}`
7. Added-vs-modified scoping re-implemented in YAML/bash separately from the classifier (rule drift)
8. Adding a new smoke audit without `Audit-Lint: v1` can evade enforcement
9. Classifier unit test does NOT exist OR does not cover all 4 truth-table rows
10. Workflow does NOT call the classifier (uses inline shell logic instead)
11. Marker string in classifier differs from `audit-lint-rules.cjs`

### Process (12-13)
12. Test forecast exceeds +50 (this is a narrow card)
13. `__tests__/opsAuditLint.test.ts` baseline (105) regresses (must remain ≥105; new tests add on top)

### Working tree (14-15)
14. Verdict tokens / doctrine ban-list violations in any shipped string
15. Unclassified untracked files at PR creation

---

## 9. Required designer Phase A audits (4)

### A.1 — Workflow shape + checkout + base/head SHA mechanics
Specify the exact YAML shape: `on.pull_request.paths` list verbatim; `actions/checkout@v4 with fetch-depth: 0`; how `BASE_SHA` and `HEAD_SHA` are resolved from the `pull_request` event; what runner OS; what Node version (read from a project-fixed source like `engines` if present, else pin a known-good 20.x).

### A.2 — Classifier surface design
Choose Option A (extend `audit-lint.mjs`) vs Option B (separate helper). Justify the choice. Specify the CLI surface (flags, stdout format, exit codes). Specify the marker-string single-source contract (classifier imports from `audit-lint-rules.cjs`; no string duplication).

### A.3 — Truth-table coverage + Jest seam
Specify how the classifier accepts an injected changed-file list for unit tests (so tests don't shell out to git). Specify each of the 4 truth-table rows as a separate Jest assertion.

### A.4 — Smoke audit shape + dogfood
Specify the 5-phase smoke plan (the CI scoping demonstration is the centerpiece; the workflow itself running on the smoke audit's own PR is the natural dogfood). Address: what counts as "PASS" when the workflow is post-merge and won't itself trigger until the next smoke-audit PR.

---

## 10. Test forecast: +10 to +25

HARD HALT at +50. This is a narrow card. The classifier needs 4-7 tests; workflow-shape assertion needs 3-5; miscellaneous CLI surface 2-5.

---

## 11. Smoke plan (5-phase)

Audit at `docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-<date>.md` (carries `Audit-Lint: v1` marker; must itself pass the linter).

### Phase 1 — Classifier truth-table (CENTERPIECE)
Run the classifier against simulated changed-file lists for each of the 4 truth-table rows. Each row produces the expected in-scope/out-of-scope result.

### Phase 2 — Workflow-shape inspection
- `on.pull_request.paths` includes exactly the 5 path patterns specified
- `actions/checkout@v4` with `fetch-depth: 0`
- `BASE_SHA = github.event.pull_request.base.sha`
- No `HEAD~1`, no `origin/main`, no guessed base
- No inline YAML/bash scoping logic

### Phase 3 — Single-source marker check
The marker string the classifier uses is sourced from `audit-lint-rules.cjs`; no duplicate string in the workflow YAML or a separate constant.

### Phase 4 — Regression
- `npx jest --testPathPattern="opsAuditLint" --no-coverage` exit 0 (≥105 + new classifier tests)
- `npm run typecheck` exit 0
- `npm run lint` exit 0
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` 792/0
- 4 historical fixtures still self-validate (lint each manually; expected verdicts unchanged)

### Phase 5 — Dogfood: smoke audit lints itself + CI dry-run
- `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-<date>.md` exit 0
- Inspect the merged PR's GitHub Actions tab; the audit-lint workflow ran on the PR; result was green (or appropriately green-skipped if no paths matched at merge time)

### Verdict rules
**PASS:** workflow is additive, path-scoped, uses PR base SHA, calls shared classifier (no YAML-side rule copy), 4 fixtures unchanged, smoke audit dogfoods green.
**PARTIAL:** workflow genuinely cannot be added cleanly (surface specific cause).
**FAIL:** workflow globally lints corpus; marker bypass; YAML/bash scoping copy; guessed diff base.

---

## 12. Authorizations granted on PASS

- `OPS-MCP-SMOKE-LINT-CI-WIRING: PASS` (lifts the PARTIAL cap from OPS-MCP-SMOKE-DOCTRINE-HARDENING)
- L1-L6 mechanically enforced on all new/modified post-hardening smoke audit PRs via GitHub Actions
- The previously-deferred enforcement vector is now active; operator-run remains valid for local checks

---

## 13. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/OPS-MCP-SMOKE-LINT-CI-WIRING.md` | Designer plan |
| `.github/workflows/audit-lint.yml` (NEW) | CI workflow |
| Classifier surface (Option A or B; designer picks) | Single-source scoping |
| `__tests__/opsAuditLint.test.ts` (additive) | Truth-table + workflow-calls-classifier proof |
| `docs/ops/AUDIT-LINT.md` (update) | Operator doc workflow section |
| `docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-<date>.md` | Dogfooded smoke audit |

---

## 14. Execution order

1. Phase 0 pre-flight (DONE; `.github/` confirmed absent; HEAD `e4fe8c6`)
2. Stage 0 — commit + push intent brief to main
3. Phase B — create `feat/OPS-MCP-SMOKE-LINT-CI-WIRING` branch + GitHub issue
4. Stage 1 — designer subagent (4 Phase A audits)
5. Stage 2 — conditional HALT eval (proceed unless surfacing a true blocker)
6. Stage 3 — implementer subagent (commit cadence; classifier-first then workflow-second)
7. Stage 4 — reviewer subagent (15 HALT items + scoping single-source verification)
8. Stage 5 — PR + squash-merge + post-merge gates
9. Post-merge 5-phase smoke (classifier centerpiece + workflow dogfood)
