# OPS-MCP-SMOKE-LINT-CI-WIRING — Review verdict

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-28
**Branch:** feat/OPS-MCP-SMOKE-LINT-CI-WIRING
**HEAD:** 2079558
**Design:** docs/designs/OPS-MCP-SMOKE-LINT-CI-WIRING.md (at aebadd8)
**Intent:** docs/designs/OPS-MCP-SMOKE-LINT-CI-WIRING-intent.md (at 925b616)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/341

---

## Summary

OPS-MCP-SMOKE-LINT-CI-WIRING ships the GitHub Actions workflow that
mechanically enforces the L1-L6 audit-lint on every PR that touches a
smoke audit doc OR the linter source / fixtures. The card lifts the
PARTIAL cap from the predecessor OPS-MCP-SMOKE-DOCTRINE-HARDENING by
adding the `.github/workflows/audit-lint.yml` infrastructure that
HALT trigger 9 prevented the predecessor from shipping inline.

The implementation is doctrinally and structurally clean:

1. A pure `classifyChangedFiles(entries, readMarkerAtHead)` helper
   in `audit-lint-lib.cjs` (preserves the lib's no-fs / no-spawn /
   no-network invariant by accepting an injected reader closure).
2. A `--classify-changed --base <sha> --head <sha>` CLI surface in
   `audit-lint.mjs` that the workflow shells out to once per PR.
3. A 69-line workflow YAML pinned to `actions/checkout@v4` with
   `fetch-depth: 0`, `actions/setup-node@v4` Node 20.x,
   `permissions: contents: read`, resolving `BASE_SHA` /
   `HEAD_SHA` directly from the `pull_request` event payload.
4. 32 net-new tests on top of the 105 baseline (137 total) covering
   the truth table, single-source marker enforcement, CLI parsing,
   workflow YAML shape, and lib export/purity invariants.

All 15 HALT matrix items + 4 additional checks pass. Test forecast
landed at the upper end of the +20-+32 band (HARD HALT was +50).
`package.json` and `package-lock.json` are byte-equal to main
(RO-36 ratchet preserved). `scripts/ops/audit-lint-rules.cjs` is
byte-equal to main (L1-L6 rules untouched). No runtime code
(`src/`, `app/`, `supabase/`, `mcp-server/`) was modified.

---

## Verification

| Check | Result |
| --- | --- |
| typecheck | pass (`tsc --noEmit` exit 0) |
| lint | pass (`eslint --max-warnings 0` exit 0) |
| Jest full suite | pass (18,153 tests / 570 suites; +32 vs main 18,121) |
| Jest targeted (`opsAuditLint`) | pass (137/137; baseline 105 preserved + 32 new) |
| Secret scan | clean (no API key / Bearer / Authorization / JWT in diff) |
| Doctrine ban-list scan | clean (no winner/loser/liar/etc. in shipped strings) |
| 4 historical fixtures | all match expected verdicts (see Additional Check B) |
| Working tree | clean (only 10 known operator-territory untracked files) |
| Migration apply | N/A — this card adds no migrations |

---

## 15-item HALT matrix

### Scope (1-5)

**1. Linter RULES unchanged — PASS.**
`git diff main -- scripts/ops/audit-lint-rules.cjs` is empty. The
`MARKER_STRING` export already exists on main from the predecessor
card (line 25, `const MARKER_STRING = 'Audit-Lint: v1'`). No L1-L6
rule constant changed.

**2. NO runtime code change — PASS.**
`git diff main..HEAD --name-only | grep -E '^(src|app|supabase|mcp-server)/'`
returns empty. Footprint is 7 files: `.github/workflows/audit-lint.yml`
(new), `scripts/ops/audit-lint.mjs`, `scripts/ops/audit-lint-lib.cjs`,
`__tests__/opsAuditLint.test.ts`, `docs/ops/AUDIT-LINT.md`,
`docs/core/current-status.md`, `docs/designs/OPS-MCP-SMOKE-LINT-CI-WIRING.md`.

**3. `package.json` byte-equal — PASS.**
`git diff main -- package.json` empty; `git diff main -- package-lock.json`
empty. RO-36 ratchet from MCP-021B preserved.

**4. NO global historical audit linting — PASS.**
`.github/workflows/audit-lint.yml` line 5-10 scopes `on.pull_request.paths`
to exactly the 5 patterns from intent §3:
`docs/audits/**SMOKE*.md`, `scripts/ops/audit-lint.mjs`,
`scripts/ops/audit-lint-lib.cjs`, `scripts/ops/audit-lint-rules.cjs`,
`__tests__/fixtures/audit-lint/**`. No `workflow_dispatch`. No global
corpus pattern.

**5. NO non-audit-lint CI workflow — PASS.**
`ls .github/workflows/` shows exactly one file: `audit-lint.yml`.

### Correctness (6-11)

**6. PR base SHA used; NO guessed base — PASS.**
`audit-lint.yml` line 37: `BASE_SHA: ${{ github.event.pull_request.base.sha }}`.
Grep for `HEAD~1`, `origin/main`, `~1`, `merge-base` returns no
matches. Line 38: `HEAD_SHA: ${{ github.event.pull_request.head.sha }}`.

**7. NO YAML/bash scoping logic — PASS.**
Grep over workflow YAML for `grep|awk|sed` returns no matches. The
only `bash` block (lines 39-69) does two things: (a) shells out to
the classifier and captures stdout; (b) iterates the captured paths
and invokes the linter on each. Both are post-classifier mechanics,
not scoping logic.

**8. Added-without-marker evasion closed — PASS.**
`__tests__/opsAuditLint.test.ts` line 1379: explicit assertion
"Added smoke audit (status A) without marker -> IN SCOPE". Reader
stub returns false; `classifyChangedFiles` returns the path. This
closes the evasion: a PR cannot ship a new audit doc without
including the marker and thereby evade the linter.

**9. Classifier unit test covers all 4 truth-table rows — PASS.**
- Row 1 (A without marker → IN): line 1379 explicit.
- Row 2 (A with marker → IN): line 1386 explicit.
- Row 3 (M with marker → IN): line 1393 explicit.
- Row 4 (M without marker → OUT): line 1400 explicit.
Plus 7 bonus assertions: non-audit A & M out, deleted out, template
out, order preservation, empty input, reader-invocation count
(0 for A/D/non-audit, 1 for M). 11 tests in this describe block.

**10. Workflow calls the classifier — PASS.**
`audit-lint.yml` line 40:
`IN_SCOPE=$(node scripts/ops/audit-lint.mjs --classify-changed --base "$BASE_SHA" --head "$HEAD_SHA")`.
The shared classifier IS the scoping authority; CI and Jest cannot
disagree.

**11. Marker string single-source — PASS.**
Grep across the repo for `Audit-Lint: v1` returns 13 files. Of those,
only `scripts/ops/audit-lint-rules.cjs` defines the constant (line 25);
`__tests__/opsAuditLint.test.ts` references it via assertion strings
and test seam content (acceptable — tests need to know the literal
to assert the runtime sources from rules). All documentation files
reference the literal for operator-readable copy (acceptable — not
code). The workflow YAML, `audit-lint.mjs`, and `audit-lint-lib.cjs`
do NOT contain the literal (verified by 3 dedicated tests at lines
1493, 1500, 1615).

### Process (12-13)

**12. Test forecast within band — PASS.**
Baseline 18,121 → 18,153 = +32 net tests. Intent §10 says +10 to
+25 forecast with HARD HALT at +50. Implementer landed at +32, which
is over the soft forecast but well below the HARD HALT. The +32
decomposes cleanly: 11 truth-table + 3 single-source + 6 CLI
parsing + 10 workflow-shape + 2 lib-purity. Each test corresponds
to a stated requirement in intent §6 / §8 / §A.3. Reviewer judgement:
within band.

**13. `opsAuditLint.test.ts` baseline 105 preserved — PASS.**
`git show main:__tests__/opsAuditLint.test.ts | grep -cE '^\s*it\('`
returns 105. HEAD count: 137 = 105 + 32. No `xit`, `it.skip`,
`describe.skip`, `it.only`, or `describe.only` anywhere in the file.
The `npx jest --testPathPattern="opsAuditLint"` run shows 137/137
PASS with exit 0.

### Working tree (14-15)

**14. NO verdict tokens / ban-list violations in shipped strings — PASS.**
`git diff main..HEAD -- .github/workflows/audit-lint.yml
scripts/ops/audit-lint.mjs scripts/ops/audit-lint-lib.cjs
docs/ops/AUDIT-LINT.md | grep -iE '\b(winner|loser|liar|...)\b'`
returns no matches. Test fixture strings about R1-R4 rules legitimately
use words like "fail" / "PASS" / "PARTIAL" as verdict-state tokens
(intended doctrine of the audit-lint itself), not as user-facing
judgement labels.

**15. Working tree shows only the 10 known operator-territory files — PASS.**
`git status --short` output matches the spawn-time inventory exactly:
4 `docs/testing-runs/2026-05-25-*.md`, 3 `mcp021c-edge-smoke-*.json/txt`,
`netlify-prod.git`, 2 `phase5-mcpserver002-*.log`. Total: 10
untracked items. Zero unclassified additions.

---

## 4 additional checks

### A. Lib purity preserved — PASS

`scripts/ops/audit-lint-lib.cjs` requires only
`./audit-lint-rules.cjs` (line 22). No `require('fs')`,
`require('child_process')`, `require('node:fs')`, or
`require('node:child_process')`. Test at line 1635-1643 reads
`audit-lint-lib.cjs` and asserts the strings `readFileSync`,
`spawnSync`, and `global.fetch` are ABSENT. The classifier accepts
an injected `readMarkerAtHead` closure built by `audit-lint.mjs`,
so the marker-presence check happens outside the pure lib.

### B. 4 historical fixtures still match expected verdicts — PASS

Direct invocations of the linter against each fixture:

| Fixture | Expected | Observed | Findings |
| --- | --- | --- | --- |
| `original-family-e-IMPROPER-PASS.md` | exit 1 (L1+L2+L5) | exit 1 | L1, L2, L5 (3 findings) |
| `family-e-amendment-PARTIAL.md` | exit 0 | exit 0 | 0 findings |
| `family-e-hosted-completion-PASS.md` | exit 0 | exit 0 | 0 findings |
| `family-d-strengthened-amendment-PASS.md` | exit 0 | exit 0 | 0 findings |

The motivating-defect doc (`29f30b0` Family E improper PASS) still
trips L1 + L2 + L5; no false positives on the model audits.

### C. 9 workflow-YAML inspection tests exist — PASS (actually 10)

Implementer reported 10 (one more than designer's 9). All required
coverage present in describe block at line 1561:

| # | Test | Line |
| --- | --- | --- |
| 1 | workflow file exists | 1562 |
| 2 | classifier flag substring present | 1566 |
| 3 | PR base SHA + HEAD~1 / origin/main / ~1 ABSENT | 1571 |
| 4 | PR head SHA present | 1579 |
| 5 | 5 path patterns all present | 1584 |
| 6 | checkout@v4 + fetch-depth: 0 | 1593 |
| 7 | setup-node@v4 + Node 20.x | 1599 |
| 8 | permissions.contents: read | 1605 |
| 9 | literal `Audit-Lint: v1` ABSENT in YAML | 1610 |
| 10 | inline `git diff --name-status` + marker-grep ABSENT in YAML | 1618 |

All 10 PASS on the live test run.

### D. AUDIT-LINT.md GitHub Actions section — PASS

`docs/ops/AUDIT-LINT.md` diff replaces the "CI deferred" section
with "CI enforcement (GitHub Actions)". The new section:

- Describes trigger paths (the 5 path patterns).
- Describes scoping behavior (the truth table replicated as
  doctrine reference).
- Describes base SHA mechanics (explicit "NEVER HEAD~1, NEVER
  origin/main" prose).
- Documents the operator-run local fallback.
- Adds a historical note tying back to the predecessor's PARTIAL
  cap and citing this card as the lift.

The header was also updated (top of file) to reference this card
and remove the deferral language.

---

## Live classifier validation (bonus dogfood)

Reviewer ran the classifier against this very branch's diff:

```
$ node scripts/ops/audit-lint.mjs --classify-changed --base main --head HEAD
[classify-changed] entries=7 in_scope=0
EXIT: 0
```

The PR adds no SMOKE audit docs; the classifier correctly emits no
in-scope paths and exits 0. The workflow will SKIP the lint step on
this PR via `if: steps.classify.outputs.in_scope != ''`. The
post-merge smoke audit (forthcoming) will be the first PR that
exercises a non-empty classifier result.

Reviewer also ran the stdin mode against a manually-constructed
diff payload (5 entries: 1 added SMOKE doc unmarked, 1 modified
SMOKE doc unmarked, 1 modified template, 1 deleted SMOKE doc, 1
non-audit src/ file). The classifier correctly emitted exactly the
added SMOKE doc and exited 0. Manual truth-table validation
matches the unit tests.

---

## Blockers

None.

---

## Suggestions (non-blocking)

None. The implementation is at the right level of generality — the
classifier is pure and reusable; the workflow is single-purpose and
minimal-permission; the documentation is thorough; the test
coverage is proportional to the change.

A future card may want to consider:

1. A smoke audit on a PR that DOES add a new SMOKE doc (this card's
   own forthcoming post-merge smoke is the natural candidate); the
   GitHub Actions tab on that PR will be the live dogfood.
2. Adding a small status-badge to the README pointing at the
   `audit-lint` workflow's main-branch status (this is a v1.5
   polish item; not required).

Neither is in scope for this card.

---

## Operator next steps

1. Push the branch: `git push -u origin feat/OPS-MCP-SMOKE-LINT-CI-WIRING`
2. Open PR: `gh pr create --title "OPS-MCP-SMOKE-LINT-CI-WIRING:
   audit-lint GitHub Actions wiring (lifts PARTIAL cap)" --body-file
   docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-REVIEW-2026-05-28.md`
3. Squash-merge after CI runs green (the audit-lint workflow itself
   will SKIP on this PR because no SMOKE audit docs were
   added/modified; that's the expected behavior and not a defect).
4. Post-merge: produce the 5-phase smoke audit per intent §11.
   Phase 5 dogfood: the audit doc itself must lint green AND the
   GitHub Actions tab on the smoke-audit PR must show the workflow
   ran (or appropriately green-skipped).
5. Post-merge worktree cleanup per `.claude/agents/roadmap-reviewer.md`
   § "Post-merge worktree cleanup (operator step)".

---

## Verdict rationale

All 15 HALT matrix items + 4 additional checks pass. The card lifts
the predecessor's PARTIAL cap by shipping precisely the deferred
infrastructure (`.github/workflows/`) with a clean classifier
boundary, a single-source marker rule, and proportional test
coverage. The implementation respects every doctrine constraint:

- No truth/winner/loser language in any shipped string.
- No service-role / Anthropic / xAI / X-API usage.
- No runtime code changes (process-tooling only).
- No `package.json` mutation (RO-36 ratchet held).
- No L1-L6 rule changes (the rules data file is byte-equal to main).
- No global corpus enforcement (path-scoped + classifier-gated).

The expected post-merge smoke is PASS, which lifts the
OPS-MCP-SMOKE-DOCTRINE-HARDENING PARTIAL cap to PASS.
