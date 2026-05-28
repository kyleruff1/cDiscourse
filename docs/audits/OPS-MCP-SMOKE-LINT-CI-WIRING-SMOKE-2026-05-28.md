# OPS-MCP-SMOKE-LINT-CI-WIRING — Post-merge smoke audit

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor:** OPS-MCP-SMOKE-LINT-CI-WIRING shipped at `b11f519` (PR #342; squash-merge of 5 implementation commits + designer `aebadd8` + reviewer verdict `8741336`).
**Audit doctrine:** Verifies the audit-lint runner is mechanically enforced via GitHub Actions for new/modified smoke audit docs; the workflow calls a single shared classifier; CI and the test suite agree about what's in scope; the PR base SHA is sourced from the event payload (not guessed); and the workflow ran live on its own merge PR with the correct no-applicable-files exit path.

---

## Verdict-upgrade provenance (from predecessor PARTIAL)

| Stage | Commit | Verdict | Status of CI mechanism |
| --- | --- | --- | --- |
| OPS-MCP-SMOKE-DOCTRINE-HARDENING smoke | `e4fe8c6` | **PARTIAL** | CI wiring deferred — `.github/workflows/` did not exist; introducing it would have been a non-additive shared-workflow change firing HALT trigger 9 inside the predecessor card. Enforcement was operator-run only. |
| **This card's smoke** | (this commit) | **PASS** | CI wiring landed in `.github/workflows/audit-lint.yml` with a single shared classifier, PR base SHA from the event payload, paths scoping, and a successful live workflow run on the merge PR (PR #342). The predecessor's PARTIAL cap is lifted. |

---

## Verdict

**PASS** — All five smoke phases satisfied. Classifier truth-table verified by 11 unit tests AND direct stdin-seam invocation. Workflow YAML inspection clean on all 9 substring/non-substring checks. Single-source marker verified (one source file holds the literal). Regression clean (Jest 18,153 / Deno 792). Dogfood: the smoke audit itself lints clean; the workflow already ran live on PR #342's PR-paths trigger (`audit-lint.mjs` + `audit-lint-lib.cjs` are in the trigger path list) and exited 0 with `in_scope=0` — the correct no-applicable-files behavior.

**Authorizations granted on PASS:**
- `OPS-MCP-SMOKE-LINT-CI-WIRING: PASS` (lifts the OPS-MCP-SMOKE-DOCTRINE-HARDENING PARTIAL cap)
- L1-L6 now MECHANICALLY ENFORCED on every PR that adds/modifies a smoke audit doc, modifies the audit-lint source, or modifies fixture content
- Operator-run invocation remains valid for local checks
- `MCP-SERVER-007-FAMILY-F` and `MCP-021C-EDGE-FAMILY-E-ENABLE` smoke audits will now run under CI enforcement from their first PR

---

## Phase 1 — Classifier truth-table (CENTERPIECE)

**Status:** PASS

The pure-function `classifyChangedFiles(entries, readMarkerAtHead)` exported by `audit-lint-lib.cjs` is the single decision point used by both Jest tests AND the GitHub Actions workflow.

### Direct invocation via stdin seam

```
printf 'A\tdocs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-30.md\n' \
  | node scripts/ops/audit-lint.mjs --classify-changed --changed-list-stdin
→ docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-30.md
→ [classify-changed] entries=1 in_scope=1
→ EXIT 0
```

### Truth-table coverage (intent §4)

| Case | Status | Marker | Expected | Actual | EXIT |
| --- | --- | --- | --- | --- | --- |
| Added smoke audit without marker | A | n/a | IN SCOPE | IN SCOPE | 0 |
| Added smoke audit with marker | A | yes | IN SCOPE | IN SCOPE | 0 |
| Modified marked smoke audit | M | yes (on disk) | IN SCOPE | IN SCOPE | 0 |
| Modified historical smoke audit (no marker) | M | no | EXEMPT | EXEMPT (`in_scope=0`) | 0 |
| Non-audit file | M | n/a | EXEMPT | EXEMPT | 0 |
| Deleted smoke audit | D | n/a | EXEMPT | EXEMPT | 0 |
| Empty changed list | n/a | n/a | empty | `entries=0 in_scope=0` | 0 |

### Closure of the added-without-marker evasion path

Row 1 above is the binding proof. A new author cannot bypass enforcement by omitting the marker on a new smoke audit: the classifier emits the path regardless of marker presence when status is `A`. The marker is consulted ONLY for modified docs (to preserve historical exemption).

### Jest unit-test mirror

`__tests__/opsAuditLint.test.ts` Section 12 contains 11 truth-table tests + 3 single-source marker tests, all matching the direct-invocation results above. The pure-function classifier is tested without spawning git or touching the filesystem — `readMarkerAtHead` is injected as a closure.

---

## Phase 2 — Workflow-shape inspection

**Status:** PASS

`.github/workflows/audit-lint.yml` inspected for the required shape (9 assertions):

| # | Check | Result |
| --- | --- | --- |
| 1 | `on.pull_request.paths` lists 5 patterns verbatim | YES — `docs/audits/**SMOKE*.md`, `scripts/ops/audit-lint.mjs`, `scripts/ops/audit-lint-lib.cjs`, `scripts/ops/audit-lint-rules.cjs`, `__tests__/fixtures/audit-lint/**` |
| 2 | `BASE_SHA = ${{ github.event.pull_request.base.sha }}` | YES (line 37) |
| 3 | `HEAD_SHA = ${{ github.event.pull_request.head.sha }}` | YES (line 38) |
| 4 | `HEAD~1` / `origin/main` / `merge-base` ABSENT | YES — grep count: 0 / 0 / 0 |
| 5 | `actions/checkout@v4` with `fetch-depth: 0` | YES (lines 25-27) |
| 6 | `actions/setup-node@v4` with `node-version: '20.x'` | YES (lines 30-32) |
| 7 | `permissions.contents: read` | YES (lines 16-17) |
| 8 | Classifier invoked: `audit-lint.mjs --classify-changed --base "$BASE_SHA" --head "$HEAD_SHA"` | YES (line 40) |
| 9 | NO inline `git diff --name-status` and NO inline marker grep in YAML | YES — grep counts: 0 / 0 |

Plus: `npm run audit-lint` count = 0 (RO-36 ratchet preserved; canonical invocation is direct node).

The workflow YAML has ZERO scoping logic. The classifier is the single source of "what's in scope."

---

## Phase 3 — Single-source marker check

**Status:** PASS

`Audit-Lint: v1` literal occurrences across source files:

| File | Count | Role |
| --- | --- | --- |
| `scripts/ops/audit-lint-rules.cjs` | 1 | **Source of truth** (line 25: `const MARKER_STRING = 'Audit-Lint: v1';`; exported on line 281) |
| `scripts/ops/audit-lint-lib.cjs` | 0 | Consumes `rules.MARKER_STRING` via injected closure (line 205, 623) |
| `scripts/ops/audit-lint.mjs` | 0 | Consumes `rules.MARKER_STRING` for the marker reader closure (line 189) |
| `.github/workflows/audit-lint.yml` | 0 | No marker logic in YAML |

The classifier marker IS the rules marker. CI and tests cannot disagree on what counts as a marker.

---

## Phase 4 — Regression

**Status:** PASS

### Test gates
```
npx jest --testPathPattern="opsAuditLint" --no-coverage
→ Test Suites: 1 passed, 1 total
  Tests:       137 passed, 137 total
EXIT: 0

npx jest --no-coverage
→ Test Suites: 570 passed, 570 total
  Tests:       18153 passed, 18153 total
EXIT: 0

npm run typecheck
→ EXIT: 0

npm run lint
→ EXIT: 0

cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 792 passed | 0 failed
EXIT: 0
```

### 4 historical fixtures still self-validate
```
original-family-e-IMPROPER-PASS:   exit 1 (L1+L2+L5)  → matches expected FAIL
family-e-amendment-PARTIAL:        exit 0 (PARTIAL)   → matches expected PASS-as-PARTIAL
family-e-hosted-completion-PASS:   exit 0 (PASS)      → matches expected PASS
family-d-strengthened-amendment:   exit 0 (PASS)      → matches expected PASS
```

### Deltas vs baseline at `e4fe8c6`
- Jest: 18,121 → 18,153 (+32; opsAuditLint 105 → 137 — exactly +32; all 105 originals preserved)
- Deno: 792 unchanged (no `mcp-server/*` touched)
- typecheck + lint: clean
- `package.json` / `package-lock.json` diff vs main: empty (RO-36 ratchet preserved)
- `audit-lint-rules.cjs` rule definitions: byte-equal to predecessor (only `MARKER_STRING` was promoted to a named export)

---

## Phase 5 — Dogfood: this smoke audit + live CI run

**Status:** PASS

### Local dogfood — this audit lints itself

```
node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md
→ findings: 0 (PASS)
→ EXIT 0
```

### Live CI dogfood — the workflow ran on PR #342

The merge PR for THIS card (PR #342) touched two trigger-path files (`scripts/ops/audit-lint.mjs` and `scripts/ops/audit-lint-lib.cjs`). The audit-lint workflow triggered on the PR, fetched base + head SHAs from the event payload, ran the classifier, found no smoke-audit docs in the diff, and exited 0. This is the correct no-applicable-files behavior of a non-empty trigger evaluating to an empty in-scope set.

| Check | Result | Duration |
| --- | --- | --- |
| `Lint changed audit docs (L1-L6)` (the audit-lint workflow) | PASS | 12s |
| `Supabase Preview` (pre-existing) | skipping | 0s |
| `deploy/civildiscourse/cdiscourse-mcp-server` (pre-existing) | PASS | 0s |

Run URL: https://github.com/kyleruff1/cDiscourse/actions/runs/26592401120/job/78354336559

### First-real-enforcement dogfood (deferred but guaranteed)

The first PR after this one that adds OR modifies a smoke audit doc with the marker will trigger the workflow with a non-empty classifier result — the workflow will then exercise the per-path lint path. Candidates per intent §12 authorizations:
- `MCP-SERVER-007-FAMILY-F-SMOKE` (next family-ship audit)
- `MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE` (next production-enable audit)

Each will both: (a) be linted at authoring time by the operator-run invocation per the smoke-template required final step, AND (b) be linted by CI on the PR. Two-layer enforcement.

---

## Final verdict

**PASS** — All five phases satisfied. The previously-deferred enforcement vector is now active. L1-L6 are mechanically enforced on every PR that touches the audit-lint surface; the classifier is the single source of scoping decisions; the PR base SHA is sourced from the event payload (not guessed); and the workflow already proved its no-applicable-files path on its own merge PR.

Predecessor PARTIAL cap is lifted.

---

## Authorizations confirmed on PASS

- `OPS-MCP-SMOKE-LINT-CI-WIRING: PASS` (lifts OPS-MCP-SMOKE-DOCTRINE-HARDENING PARTIAL cap)
- L1-L6 mechanically enforced on smoke-audit-touching PRs via GitHub Actions
- `MCP-SERVER-007-FAMILY-F` smoke audit now ships under two-layer enforcement
- `MCP-021C-EDGE-FAMILY-E-ENABLE` production-enable audit must satisfy L3 + L4 from the start (CI-enforced)

## Operator cleanup

No temp artifacts. No service-role usage. No secrets logged. No `.env*` touched. No migration. No Supabase deploy.
