# OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-28
**Branch:** `feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK`
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/349
**Design:** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK.md`
**Intent brief:** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-intent.md`
**Implementer commits:** `7eff12d`, `78791fe`, `9debfb1`, `4dcc122` (on `73f4ebb` design)

---

## Summary

This is a textbook **data-and-tests** card and it landed clean. The single
production-source change is six lines added to the `DOCTRINE_RISK_FAMILIES`
`Set` in `scripts/ops/audit-lint-rules.cjs` — `critical_question`, `family_f`,
and `consequence_probability_unclear` — enrolling Family F so the L5 audit-lint
rule mechanically requires persisted `evidence_span` inspection for any future
doctrine-risk Family F audit, the same teeth already enforced for Family E. The
load-bearing alias is `family_f` (the string `detectFamily` actually emits for a
`MCP-SERVER-NNN-FAMILY-F` title via the `mapFamilyLetterToName` default branch);
the implementer correctly pinned this with both an A.1-trap unit test and the
synthetic teeth fixture, so a future refactor cannot silently un-arm L5. The
LOGIC files (`audit-lint.mjs`, `audit-lint-lib.cjs`, including
`mapFamilyLetterToName`) are byte-untouched (A.2 data-only outcome confirmed
empirically). All three gates are green (typecheck 0, lint 0, jest 0 with
137 → 147 = +10 tests, inside the +8-to-14 forecast and far under the +45 HALT
ceiling). The 7-fixture matrix direct-invokes to exactly `1,0,0,0,0,0,1`. The
teeth proof bites: the synthetic improper-PASS fails on **L5 only**, and the
negative control confirms it would wrongly pass without `family_f` in the set.
No undocumented file changes, no secrets, no doctrine violations, no scope creep.
Zero blockers; zero changes requested.

---

## Verification (independently re-run by reviewer)

| Gate | Result |
| --- | --- |
| typecheck (`npm run typecheck` → `tsc --noEmit`) | **pass** (exit 0) |
| lint (`npm run lint` → `eslint . --max-warnings 0`) | **pass** (exit 0) |
| test (`npx jest --testPathPattern="opsAuditLint" --no-coverage`) | **pass** — `Test Suites: 1 passed, 1 total / Tests: 147 passed, 147 total`, exit 0 |
| test count delta | 137 → **147** (+10); 1 suite. Inside design forecast +8..+14; under HALT ceiling +45 |
| secret scan | **clean** — every `Bearer`/`Authorization:` added line is a redacted placeholder (`<admin JWT redacted>`, `<admin/moderator JWT>`); zero real JWT (`eyJ…`), `sk-ant-`, `sb_secret_`, or `xai-` tokens in added lines |
| doctrine scan | **clean** — no banned verdict token in the new fixtures; no `public.arguments` insert; no service-role/`ANTHROPIC_API_KEY` in any `src/`/`app/` change (card touches neither) |
| migration apply | **N/A** — 0 files under `supabase/migrations/`; 0 under `supabase/functions/` (migration-bearing verification not triggered) |

### Re-run command outputs

7-fixture exit battery (expected `1,0,0,0,0,0,1`):

```
original-family-e-IMPROPER-PASS:                  exit=1
family-e-amendment-PARTIAL:                       exit=0
family-e-hosted-completion-PASS:                  exit=0
family-d-strengthened-amendment-PASS:             exit=0
family-f-original-PARTIAL:                        exit=0
family-f-amendment-PASS:                          exit=0
family-f-IMPROPER-PASS-no-evidence-span:          exit=1
```

Fixture 7 (synthetic improper-F) lint output — **L5 ONLY**:

```
title:       MCP-SERVER-007-FAMILY-F-SMOKE — Amendment (SYNTHETIC improper PASS; doctrine fixture)
audit-type:  amendment
verdict:     PASS
findings:    1
  [L5] Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).
```

Classifier introspection on fixture 7: `family=family_f`, `auditType=amendment`,
`verdict=PASS`, `exitCode=1`, `rules=["L5"]`.

Detector / mapper introspection (A.1 trap):

```
detectFamily('# MCP-SERVER-007-FAMILY-F-SMOKE — x', body) = family_f
mapFamilyLetterToName('F') = family_f      (default branch — no F case)
mapFamilyLetterToName('E') = argument_scheme   (Family E preserved)
```

Negative control (simulate set WITHOUT `family_f`/`critical_question`/`consequence_probability_unclear`):

```
WITHOUT family_f → exit: 0  rules: []   (L5 blind → synthetic WRONGLY passes — proves the teeth)
Family E members preserved: argument_scheme=true  slippery_slope=true
```

Scope-clean line counts (all MUST be 0):

```
git diff main..HEAD -- scripts/ops/audit-lint.mjs scripts/ops/audit-lint-lib.cjs | wc -l   → 0
git diff main..HEAD -- <4 existing fixtures> | wc -l                                       → 0
git diff main..HEAD -- package.json package-lock.json | wc -l                              → 0
git diff main..HEAD -- .github/workflows/audit-lint.yml | wc -l                            → 0
```

Static-fixture byte-faithfulness (vs on-main sources @ `6395023`, after stripping the prepended marker line):

```
family-f-original-PARTIAL.md   body (257 lines) === git show 6395023:…MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md            → BYTE-FAITHFUL
family-f-amendment-PASS.md     body (265 lines) === git show 6395023:…MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT-2026-05-28.md  → BYTE-FAITHFUL
```

Synthetic fixture scrub-completeness (all 5 `L5_PERSISTED_INSPECTION_PATTERNS` must be absent):

```
\bevidence_span\b            → clean
SELECT..evidence_span        → clean
| evidence_span |            → clean
persisted evidence           → clean
direct-output inspection     → clean
ANY trigger present: false
```

---

## 12-item verdict matrix

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Scope clean: audit-lint DATA + tests + fixtures + docs only; ZERO runtime; ZERO logic-file change (data-only) | **PASS** | Full footprint is 9 files: `audit-lint-rules.cjs` (data) + 3 fixtures + `opsAuditLint.test.ts` + 3 docs + design doc. `.mjs`/`lib.cjs` diff = 0 lines. No `src/`/`app/`/`mcp-server/`/`supabase/` change. |
| 2 | `critical_question` now in the doctrine-risk family list | **PASS** | `DOCTRINE_RISK_FAMILIES.has('critical_question') === true` (membership test green; set introspection confirms). |
| 3 | Family F aliases recognized by the ACTUAL detection mechanism (`family_f` present, not just `critical_question`); `mapFamilyLetterToName` NOT edited | **PASS** | `family_f` ∈ set; `detectFamily(F-title) === 'family_f'`; `mapFamilyLetterToName` is in `lib.cjs` (0 diff lines); all diff mentions of the symbol are comments/docs only. |
| 4 | Fixture 7 (synthetic improper-F) FAILS L5 (exit 1, cites L5, L1/L2/L6 do NOT co-fire) — the TEETH proof | **PASS** | exit 1, `findings=["L5"]` only (lint output above); jest assertion `toContain('L5')` + `not.toContain('L1'/'L2'/'L6')` green; negative control proves it would pass without `family_f`. |
| 5 | Fixture 6 (real F amendment PASS) PASSES (exit 0) | **PASS** | exit 0, findings length 0; byte-faithful to on-main `6395023` amendment audit. |
| 6 | Fixture 5 (real F PARTIAL) passes-as-PARTIAL (exit 0) — consistent-PARTIAL preserved (Decision 5) | **PASS** | exit 0, findings length 0; passes L5 via `evidence_span` mention (deferred Phase 4b obligation); byte-faithful to on-main `6395023` PARTIAL audit. |
| 7 | Existing Family E doctrine-risk behavior unchanged (`argument_scheme` + `slippery_slope` preserved; E fixtures' L5 intact) | **PASS** | Both E members still in set; `mapFamilyLetterToName('E') === 'argument_scheme'`; E fixtures 1–3 exit 1,0,0 unchanged; all existing L5 unit tests green. |
| 8 | 4 existing fixtures byte-equal + still exit 1,0,0,0 | **PASS** | `git diff` on the 4 existing fixtures = 0 lines; battery shows exits 1,0,0,0; their 4 `it()`s unchanged in the diff. |
| 9 | No global historical enforcement; census informational; CI scope new/modified-marked-only (`audit-lint.yml` untouched) | **PASS** | `.github/workflows/audit-lint.yml` diff = 0 lines; no `--report-only`/census-enforcement change; fixtures under `__tests__/` do not match the workflow's `docs/audits/**SMOKE*.md` trigger. |
| 10 | No `package.json` / `package-lock.json` changes (RO-36 preserved) | **PASS** | Both files diff = 0 lines; no `audit-lint` npm script exists. |
| 11 | No docs instruct `npm run audit-lint`; direct `node scripts/ops/audit-lint.mjs` remains canonical | **PASS** | Grep of changed docs for `npm run audit-lint` = 0 added lines; `node scripts/ops/audit-lint…` present in changed docs. |
| 12 | `AUDIT-LINT.md` documents how to add a future doctrine-risk family | **PASS** | Two new subsections: "Add the alias the DETECTOR emits, not just the canonical key (Family F lesson)" + "Consistent-PARTIAL is preserved by MENTION, not by verdict-awareness"; both name the guard tests. |

**Matrix result: 12 / 12 PASS. No STOP condition hit.**

---

## Security / doctrine checks

- **No secrets in new fixtures.** The synthetic shows `Token: [REDACTED]` and
  `Authorization: Bearer <admin JWT redacted>`. The two static copies are
  byte-faithful to on-main vetted docs at `6395023`; their only redaction
  markers are `<admin/moderator JWT>` / `<admin JWT redacted>`. Zero real
  JWT/`sk-ant-`/`sb_secret_`/`xai-` tokens in any added line. **CLEAN.**
- **No verdict-token / truth-label doctrine violation in user-facing copy.**
  This card adds no user-facing strings and no `gameCopy` codes. The audit-lint
  linter is explicitly "not a verdict-token doctrine scanner" (per `AUDIT-LINT.md`
  § "What the linter is NOT"). The new-fixture verdict-token scan is clean. The
  word "correctly" in fixture 7 ("4/4 reject correctly") describes a regression
  result in operator-facing audit tooling, not a verdict on any argument or
  person — no doctrine concern. **CLEAN.**
- **Implementer judgment call (a) — extra membership-preservation test.** The
  `'preserves the existing Family E doctrine-risk members'` test asserts
  `argument_scheme` + `slippery_slope` survive the F enrollment. This is
  in-scope (a HALT-trigger-7 defensive guard), additive, and strengthens the
  suite. **ACCEPTABLE.**
- **Implementer judgment call (b) — single L5 row in AUDIT-LINT.md rules table.**
  The L5 row is widened to name Family F aliases alongside the unchanged Family E
  text. Additive, not weakening; the E aliases remain verbatim. **ACCEPTABLE.**
- **README scope.** Editing the fixture-dir `README.md` (count 4→7, 3 new
  expected-outcome rows, re-extraction commands for fixtures 5/6, synthetic
  note) is a fixture-dir `.md` allowed by the brief's `__tests__/fixtures/
  audit-lint/*.md` clause. The 4 existing fixtures' table rows and the
  "DO NOT EDIT" clause are untouched; the only deletion line is the
  `exactly 4` count prose replaced by `exactly 7`. The 4 existing fixtures'
  meaning is unaltered. **ACCEPTABLE.**

---

## Design conformance

- [x] All design file-changes are present (9-file footprint matches the design's "File changes" section exactly).
- [x] No undocumented file-changes (`git diff --name-only` = the 9 enumerated files; no extras).
- [x] Data model matches design (the exact 3 strings, in the exact order, with the documenting comment — verbatim to design § "The exact DATA edit").
- [x] API/interface contracts match design (no callable interface change; the `Set` is the entire mechanism; `applyL5` read-only).
- [x] Edge cases from design § "Edge cases" have tests (A.1 detector-trap pin; consistent-PARTIAL fixture 5; L5-only synthetic fixture 7; marker-on-line-1 parse — all covered).
- [x] Test forecast honored (+10, inside the design's tightened +8..+14 band).

---

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings (card adds none; operator-facing audit tooling only).
- [x] Score never blocks posting (N/A — no scoring surface touched).
- [x] No service-role in client code (no `src/`/`app/` change; scan clean).
- [x] No direct insert into `public.arguments` (scan clean).
- [x] No AI calls in production app paths (pure regex/text DATA + tests; the lib has no fs/spawn/network — existing purity tests still green).
- [x] Plain language only (internal codes `family_f`/`critical_question` live in an operator-facing rules file + operator docs, never surfaced to end users).
- [x] Epic-specific doctrine — **evidence-doctrine** (cited skill: `cdiscourse-doctrine` §3 + evidence-doctrine layer): L5 is the meta-enforcement that a doctrine-risk family audit inspected the **persisted** `evidence_span` before claiming PASS; enrolling Family F extends that evidence-discipline to `critical_question`. The linter never adjudicates argument truth — it checks the audit *inspected* the span. **RESPECTED and reinforced.**

---

## Test coverage

- [x] New public behavior has unit tests (3 membership tests + 1 E-preservation guard + 1 `detectFamily→family_f` pin + 2 L5 firing/non-firing tests for `family_f`).
- [x] Edge cases from design § "Edge cases" have tests (teeth-precision L5-only assertion; consistent-PARTIAL fixtures 5 & 6).
- [x] Doctrine/ban-list assertions — N/A for user-facing strings (card touches no `gameCopy` codes; existing `opsMcpObservabilityDoctrineBanList` suite untouched and out of scope, per design).
- [x] Accessibility assertions — N/A (no UI card).
- [x] Test count goes UP (137 → 147); no `.skip`/`.only`; no committed `console.log`.

---

## Blockers

None.

---

## Suggestions (non-blocking)

1. The synthetic fixture's `Token: [REDACTED]` line sits inside a fenced code
   block that mimics smoke output. It is already redacted and safe; if a future
   author copies this shape for a *real* (non-fixture) smoke doc, the same
   `[REDACTED]` discipline must carry over. No action for this card — noting for
   the post-merge smoke author (intent §9 / design § "Operator steps").
2. The post-merge smoke doc
   (`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-SMOKE-2026-05-28.md`)
   is an operator/implementer step, not part of this branch — it MUST carry the
   `Audit-Lint: v1` marker and self-lint clean (exit 0) since it lives under
   `docs/audits/` and matches the CI `**SMOKE*.md` trigger. This review doc
   deliberately has no `SMOKE` substring and no marker, so CI will not lint it.

---

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK`
- Open PR:
  `gh pr create --title "OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK: enroll Family F in DOCTRINE_RISK_FAMILIES (data-only; +10 tests; L5 teeth proof)" --body-file docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-REVIEW-2026-05-28.md`
- Deploy steps: **none** — pure code + docs; no DB, no Edge Function, no
  migration, no env var. The Supabase GitHub integration auto-deploy is a no-op
  for this card.
- Post-merge: author the 5-phase smoke audit
  (`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-SMOKE-2026-05-28.md`)
  per intent §9; it must carry `Audit-Lint: v1` and self-lint clean.
- Post-merge worktree cleanup (operator step; run from the main repo root, not
  inside the worktree): identify the worktree with
  `git worktree list | grep "feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK"`,
  remove with `git worktree remove -f -f "<path>"`, delete the local branch with
  `git branch -D feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK`, and verify
  with `git worktree list`. On Windows, if removal reports `Filename too long`,
  use the `\\?\` UNC long-path `Remove-Item -Recurse -Force` workaround followed
  by `git worktree prune` (see roadmap-reviewer charter § "Post-merge worktree
  cleanup").
