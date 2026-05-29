# OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-29
**Branch:** `feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/357
**Design:** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK.md`
**Template (mirrored):** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK.md` + `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-REVIEW-2026-05-28.md`
**Implementer commits (Card 2 only):** `678d856`, `44e4500`, `a32cc08`, `498beac` (on `bab80ef` design); `a027829` is the base-advancement merge of main (Card 1B #358 lives in the base).

---

## Summary

A textbook **data-and-tests** card and a faithful G-replica of the shipped
Family F doctrine-risk card. The single production-source change is exactly
three strings appended to the `DOCTRINE_RISK_FAMILIES` `Set` in
`scripts/ops/audit-lint-rules.cjs` — `resolution_progress`, `family_g`, and
`concedes_broader_point` — enrolling Family G so L5 mechanically requires
persisted `evidence_span` inspection for any future doctrine-risk Family G
audit, the same teeth already enforced for Families E + F. The load-bearing
alias is `family_g` (the string `detectFamily` actually emits for a
`MCP-SERVER-NNN-FAMILY-G` title via the `mapFamilyLetterToName` default branch);
the implementer pinned it with both an A.1-trap `detectFamily` unit test and the
synthetic teeth fixture, so a future refactor cannot silently un-arm L5. The
LOGIC files (`audit-lint.mjs`, `audit-lint-lib.cjs`, including
`mapFamilyLetterToName`) are byte-untouched — `git diff` is literally 0 lines
(A.2 data-only outcome confirmed). All three gates are green (typecheck 0, lint
0, jest 0 with 147 → 158 = +11 tests, inside the +8..+14 forecast and far under
the +45 HALT ceiling). The 10-fixture matrix direct-invokes to exactly
`1,0,0,0,0,0,1,0,0,1`. The teeth proof bites: the synthetic improper-PASS fails
on **L5 only** (not L1/L2/L6), and the reviewer-run negative control confirms it
would wrongly pass (exit 0) without `family_g` in the set. The real on-main G
PARTIAL smoke still lints exit 0 (consistent-PARTIAL preserved). No undocumented
file changes, no secrets, no doctrine violations, no scope creep. Zero blockers;
zero changes requested.

---

## Verification (independently re-run by reviewer)

| Gate | Result |
| --- | --- |
| typecheck (`npm run typecheck` → `tsc --noEmit`) | **pass** (exit 0) |
| lint (`npm run lint` → `eslint . --max-warnings 0`) | **pass** (exit 0) |
| test (`npx jest --testPathPattern="opsAuditLint" --no-coverage`) | **pass** — `Test Suites: 1 passed, 1 total / Tests: 158 passed, 158 total`, exit 0 |
| test count delta | 147 → **158** (+11); 1 suite. Inside design forecast +8..+14; under HALT ceiling +45 |
| secret scan | **clean** — the only `Bearer`/`Authorization:` added lines are the redacted placeholder `<admin JWT redacted>` (in the G fixtures' Phase 4 example + a pre-existing CLAUDE-card comment block the base merge carried). Zero real JWT (`eyJ…`), `sk-ant-`, `sb_secret_`, or `xai-` tokens in added lines |
| doctrine scan | **clean** — see "Doctrine self-check" below; verdict-token language appears only inside the marker-protected `family-g-original-PARTIAL.md` fixture (the adversarial *input* the classifier was tested against) and operator-facing docs describing the rule, never in any `src/`/`app/` user-facing surface (this card touches neither) |
| migration apply | **N/A** — 0 files under `supabase/migrations/`; 0 under `supabase/functions/`. Migration-bearing verification not triggered |

### Re-run command outputs

Boundary checks (the brief's "INDEPENDENTLY RE-RUN" set):

```
git diff main..HEAD -- scripts/ops/audit-lint.mjs scripts/ops/audit-lint-lib.cjs | wc -l   -> 0   (logic untouched)
git diff main..HEAD -- <the 4 hardening + 3 F fixtures>                          | wc -l   -> 0   (7 existing fixtures byte-equal)
git diff main..HEAD -- package.json package-lock.json                            | wc -l   -> 0   (no dep change)
git diff main..HEAD --name-only | grep -E '^(mcp-server|supabase|src)/'          -> (empty)       (no runtime/edge/src touch)
```

10-fixture exit battery (expected `1,0,0,0,0,0,1,0,0,1`):

```
original-family-e-IMPROPER-PASS:                  exit=1
family-e-amendment-PARTIAL:                       exit=0
family-e-hosted-completion-PASS:                  exit=0
family-d-strengthened-amendment-PASS:             exit=0
family-f-original-PARTIAL:                        exit=0
family-f-amendment-PASS:                          exit=0
family-f-IMPROPER-PASS-no-evidence-span:          exit=1
family-g-original-PARTIAL:                        exit=0
family-g-amendment-PASS:                          exit=0
family-g-IMPROPER-PASS-no-evidence-span:          exit=1
```

Fixture 10 (the teeth) — exit 1, finding `[L5]` ONLY (NOT L1/L2/L6):

```
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-g-IMPROPER-PASS-no-evidence-span.md
  title:       MCP-SERVER-008-FAMILY-G-SMOKE — Amendment (SYNTHETIC improper PASS; doctrine fixture)
  audit-type:  amendment
  verdict:     PASS
  findings:    1
    [L5] Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).
EXIT: 1
```

Real on-main G smoke — passes-as-PARTIAL (consistent-PARTIAL preserved):

```
node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md
  title:       MCP-SERVER-008-FAMILY-G-SMOKE — Post-merge smoke (2026-05-29)
  audit-type:  family-ship
  verdict:     PARTIAL
  findings:    0 (PASS)
EXIT: 0
```

Synthetic-G negative control (reviewer-run, in-memory `.delete()` of the 3 G
aliases; never written to disk):

```
WITH family_g:    exit=1 rules=["L5"] family=family_g       <- the teeth bite
WITHOUT family_g: exit=0 rules=[]     family=family_g       <- would WRONGLY pass; rule is currently blind to G
```

This independently reproduces the design's evidence-section claim: `family_g`
is genuinely load-bearing, and `resolution_progress` alone is a silent no-op for
the real G doc (which detects as `family_g`, not `resolution_progress`).

Static-copy byte-equality (fixture 8 = marker line + on-main `1c19d11` body):

```
git show 1c19d11:docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md  vs
  tail -n +2 family-g-original-PARTIAL.md   ->  IDENTICAL (byte-for-byte)
```

evidence_span literal counts (the L5 hinge):

```
family-g-amendment-PASS.md             : 6  (>0 -> hasInspection true -> exit 0)
family-g-IMPROPER-PASS-no-evidence-span: 0  (=0 -> hasInspection false -> L5 fires)
```

---

## Design conformance

- [x] All design file-changes are present — the 9 changed files match the
  design's "File changes" section exactly: 1 DATA file
  (`scripts/ops/audit-lint-rules.cjs`), 3 new G fixtures, the test file, 2 docs
  (`AUDIT-LINT.md`, fixture `README.md`), `current-status.md`, and this card's
  design doc.
- [x] No undocumented file-changes — `git diff main..HEAD --name-only` is exactly
  those 9 files; nothing under `mcp-server/`, `supabase/`, `src/`, `app/`,
  `.github/`, `package.json`, or `package-lock.json`. The untracked `out/` and
  other `??` items are pre-existing operator-territory working-tree clutter
  (identical to the `main` snapshot), not part of any branch commit.
- [x] Data model matches design — the exact DATA edit is `resolution_progress`,
  `family_g`, `concedes_broader_point` appended *after* F's 3, with the
  designed 6-line comment block; F's 3 (`critical_question`, `family_f`,
  `consequence_probability_unclear`) and E's 2 (`argument_scheme`,
  `slippery_slope`) preserved verbatim.
- [x] API contracts match design — no callable interface change; `applyL5` reads
  `rules.DOCTRINE_RISK_FAMILIES` at call time; adding Set members is the entire
  mechanism. `MARKER_STRING` unchanged; export list unchanged.

---

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — verdict words
  (won/lost/winner/loser/beat) appear only inside `family-g-original-PARTIAL.md`,
  which carries the `<!-- AUDIT-LINT-FIXTURE … exclude from doctrine/verdict
  scans -->` marker on line 1 and is a byte-identical static copy of the on-main
  smoke. Those words are the **adversarial input the classifier was tested
  against** ("scanned for resolution-verdict tokens … and did NOT echo any
  verdict word"), not a label the app applies. The marker opts the fixture out
  of the observability ban-list scanner (which scans the stitched observability
  report, not `__tests__/fixtures/audit-lint/`). No `src/`/`app/` surface is
  touched.
- [x] Score never blocks posting — N/A; the audit-lint linter is an
  authoring-time process gate, not a posting path.
- [x] No service-role in client code — `git diff … -- 'src/**' 'app/**' | grep -iE 'SERVICE_ROLE|ANTHROPIC_API_KEY'` is empty (card touches neither tree).
- [x] No direct insert into `public.arguments` — none; pure DATA + text fixtures.
- [x] No AI calls in production app paths — none; the rules file is pure regex +
  Sets, no fs/spawn/network/LLM. The lib is unchanged.
- [x] Plain language only — N/A for users; the internal codes (`family_g`,
  `resolution_progress`, `concedes_broader_point`) live only in an
  operator-facing rules file and operator docs, never surfaced to end users.
- [x] Epic-specific doctrine (`evidence-doctrine`): L5 is the *meta-enforcement*
  of the evidence-doctrine boundary — factual standing requires persisted
  evidence inspection. Enrolling Family G extends that discipline to
  `resolution_progress`, the family whose live proof
  (`concedes_broader_point` evidence_span anchoring "I withdraw the broad claim
  and stand on the narrow scope only" without echoing won/lost/beat) is the
  canonical demonstration that the persisted span must be **inspected, not
  assumed**. The card converts that proof from operator discipline into
  mechanical CI enforcement. RESPECTED and reinforced. (`point-standing-economy`
  note: `concedes_broader_point` is a scoring *repair* axis, not a defeat —
  consistent with the doctrine that concession lifts broad standing; nothing in
  this card touches the standing model, but the fixture language is doctrine-
  consistent.)

---

## Test coverage

- [x] New public surface has unit tests — the DATA change is covered by 3
  membership tests (`resolution_progress`, `family_g`,
  `concedes_broader_point`), 1 additive-only E+F-preservation guard, 1
  `detectFamily → family_g` A.1-trap pin, and 3 L5 firing/non-firing tests
  (fires on PASS-without-inspection; does not fire when `evidence_span` is
  named; consistent-PARTIAL-for-G case).
- [x] User-facing strings have ban-list assertion — N/A; no user-facing copy or
  `gameCopy` code in this card. The existing `opsMcpObservabilityDoctrineBanList`
  suite is untouched and out of scope, per design.
- [x] Edge cases from design § "Edge cases" have tests — the A.1 silent-no-op
  trap (the `detectFamily` pin + the teeth fixture, which only fails-correctly
  when `family_g` is present), consistent-PARTIAL-by-mention, and the
  L5-only-not-L1/L2/L6 precision are all asserted. The teeth fixture's
  marker-on-line-1 / title-on-line-2 shape parses `family_g` correctly
  (verified by exit 1).
- [x] Accessibility assertions — N/A (no UI card).
- [x] The 7 existing fixture `it()`s and the 4+3 self-validation assertions stay
  byte-identical; `FIXTURE_FILES` grows 7→10; `fixture count is exactly 7` →
  `exactly 10` (`toHaveLength(7)`→`toHaveLength(10)`); the marker `it()`
  iterates 10 files and stays green.

---

## 12-item verdict matrix

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | **[core]** audit-lint DATA + tests + fixtures + docs only; ZERO runtime; ZERO logic-file change | **PASS** | `git diff` on `audit-lint.mjs` + `audit-lint-lib.cjs` = 0 lines; name-only `grep '^(mcp-server\|supabase\|src)/'` empty; the only source edit is +11 lines (3 strings + 6-line comment) in `audit-lint-rules.cjs` |
| 2 | `resolution_progress` + `family_g` + `concedes_broader_point` now in set; E's 2 + F's 3 preserved verbatim | **PASS** | exact diff appends the 3 after F's 3; membership tests + the E+F-preserved guard all green; F/E entries unchanged in the diff |
| 3 | `family_g` (the detector output) is the load-bearing alias present; `mapFamilyLetterToName` NOT edited | **PASS** | `family_g` present in set; `detectFamily('…-FAMILY-G…') === 'family_g'` pin test green; `mapFamilyLetterToName` lives in `audit-lint-lib.cjs` (0-line diff) |
| 4 | **[core; FAIL→BLOCK]** Fixture 10 FAILS L5 (exit 1, cites L5, NOT L1/L2/L6) — the teeth | **PASS** | `node` run: exit 1, `findings: 1`, `[L5]` only; fixture `it()` asserts `toContain('L5')` + `not.toContain('L1'/'L2'/'L6')` |
| 5 | Fixture 9 (g-amendment-PASS) PASSES (exit 0) | **PASS** | exit 0; 6 `evidence_span` occurrences → `hasInspection` true |
| 6 | **[core; FAIL→BLOCK]** Fixture 8 (real Card 1 G smoke copy) passes-as-PARTIAL (exit 0) | **PASS** | exit 0, verdict PARTIAL; byte-identical to on-main `1c19d11`; consistent-PARTIAL via `evidence_span` mention |
| 7 | **[FAIL→BLOCK]** Existing Family E + F doctrine-risk behavior unchanged | **PASS** | fixtures 1–7 exit `1,0,0,0,0,0,1` (E/F PARTIAL/PASS/teeth all unchanged); E+F membership guard green |
| 8 | **[FAIL→BLOCK]** The 7 existing fixtures byte-equal + still exit `1,0,0,0,0,0,1` | **PASS** | `git diff` on all 7 = 0 lines; exit battery confirms `1,0,0,0,0,0,1` |
| 9 | No global historical enforcement; census informational; CI scope unchanged | **PASS** | no `.github/workflows/audit-lint.yml` change; fixtures live under `__tests__/fixtures/` (not matched by the `docs/audits/**SMOKE*.md` CI trigger); no `--report-only` enforcement change |
| 10 | No `package.json` change (RO-36) | **PASS** | `git diff … package.json package-lock.json` = 0 lines |
| 11 | No docs instruct `npm run audit-lint`; direct `node` invocation canonical | **PASS** | grep of changed docs for `npm run audit-lint`/`audit:lint` empty; AUDIT-LINT.md + design operator-steps use `node scripts/ops/audit-lint.mjs` |
| 12 | `AUDIT-LINT.md` documents the G addition; `FIXTURE_FILES`/count 7→10; README 7→10 | **PASS** | AUDIT-LINT.md adds the "Family G followed the same DATA path" note + 3 bullets + "exactly 10"; test `FIXTURE_FILES` 7→10 + `fixture count is exactly 10`; README count + table + re-extraction recipe updated |

**Core items 1 / 4 / 6 / 7 / 8: all PASS. No item FAIL.**

---

## HALT-trigger cross-check (intent §7, all 12)

All 12 HALT triggers evaluated NON-FIRING, matching the design's table:
1 (logic change) — no; 2 (taxonomy/prompt/key) — no; 3 (production flag / Card 3)
— no, Card 3 not started; 4 (`package.json`) — no; 5 (broad historical
enforcement) — no; 6 (weaken existing behavior) — no, additive; 7 (remove/alter
E or F rule) — no, all preserved + guarded by the E+F-preservation test; 8 (no
G L5 regression) — **satisfied** by fixture 10 + negative control; 9 (existing
fixtures drift from `1,0,0,0,0,0,1`) — no, empirically unchanged; 10 (A.2
requires logic change) — no, data-only; 11 (G-PARTIAL newly fails) — no, exit 0;
12 (forecast > +45) — no, +11.

---

## Blockers

None.

---

## Suggestions (non-blocking)

1. The two `??` smoke-artifact families in the working tree (`mcp021c-edge-smoke-*`,
   `phase5-mcpserver002-*`, `out/`, `netlify-prod.git`, `docs/testing-runs/2026-05-25-*`)
   are pre-existing operator-territory clutter, not part of this branch. The
   operator may want to `.gitignore` or sweep them in a separate housekeeping
   pass so future `git status` is quieter — but this is unrelated to Card 2 and
   does not affect the verdict.
2. Per the design's "Operator steps", the post-merge smoke audit
   (`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-SMOKE-2026-05-29.md`)
   is an operator/implementer step (not part of this review). It must carry the
   `Audit-Lint: v1` marker and self-lint clean (exit 0) — the CI workflow will
   lint it because it lands under `docs/audits/`.

---

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`
- Open PR: `gh pr create --title "OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK: enroll Family G in L5 doctrine-risk (data-only; +11 tests)" --body-file docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-REVIEW-2026-05-29.md`
- Deploy steps: **none** — pure code + docs; no migration, no Edge Function, no
  DB, no env var. The Supabase GitHub auto-deploy is a no-op for this card.
- Post-merge: run the 5-phase smoke per the design's "Operator steps" and author
  the SMOKE audit doc (carries `Audit-Lint: v1`, self-lints clean). **Do NOT
  start Card 3 (G production flip).**
- Post-merge worktree cleanup (operator step, run from main repo root):
  ```
  git worktree list | grep "feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK"
  git worktree remove -f -f ".claude/worktrees/agent-<hash>"
  git branch -D feat/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK
  git worktree list | grep -c "agent-<hash>"   # must print 0
  ```
  (On Windows, if `git worktree remove` reports "Filename too long", use the
  `\\?\` UNC long-path form with `Remove-Item -Recurse -Force` then
  `git worktree prune`. See `.claude/agents/roadmap-reviewer.md` § "Post-merge
  worktree cleanup" EC-2.)
