# OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-02
**Branch:** feat/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING (single commit `3ba3801`)
**Design:** docs/designs/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING.md
**Gate semantics (2026-06-03):** the fix's production verification is a **target-mitigation pass, not a global PASS-LOAD** and authorizes no ramp — see `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`.

## Summary

Ships exactly what the design specified: one additive numbered **rule 7**
RAWKEY-SHAPE REINFORCEMENT clause for `evidenceSpan.unstated_assumption` in
the Family-F user-prompt builder, byte-mirroring the proven rule-6 pattern
(PR #421/#423). The clause is a faithful copy of rule 6 with only the rawKey
name (`alternative_explanation_available` → `unstated_assumption`, 4 sites)
and the anchor wording (`alternative-explanation gap` → `unstated-assumption
gap`) swapped. The fix is prompt-side only: no validator change, no ban-list
change, no schema/key/taxonomy change. `FAMILY_F_SYSTEM_PROMPT`,
`FAMILY_F_MAX_TOKENS` (1500), `familyFKeys.ts`, and every other rawKey are
untouched. 8 new Deno tests (1 prompt + 7 validator) cover the heading,
enumeration, doctrine scan, the four malformed-shape rejections at the exact
path, the string-≤240 / null acceptances, and the 240/241 boundary. All
binding gates pass at exit 0. No concerns remain. Open the PR.

## Verification

| Gate | Result |
|---|---|
| Family-F prompt Deno suite (`deno test --allow-read tests/familyFPrompt.test.ts`) | **34 passed / 0 failed, exit 0** |
| Family-F validator Deno suite (`deno test --allow-read tests/familyFResponseValidator.test.ts`) | **14 passed / 0 failed, exit 0** |
| Full mcp-server Deno suite (`deno test --allow-read --allow-env`) | **1237 passed / 0 failed, exit 0** |
| typecheck (`tsc --noEmit`) | **pass, exit 0** |
| lint (`eslint . --max-warnings 0`) | **pass, exit 0** |
| Jest (`jest --passWithNoTests`) | **18925 passed / 601 suites, exit 0** (card is Deno-only; Jest count unchanged-by-card, baseline green) |
| secret / endpoint / handle / URL scan (3 changed files) | **clean (no matches)** |
| doctrine scan (added prompt-source lines) | **clean** (only `true`/`false` are JSON-literal/observation-shape prose, byte-identical to rule 6) |
| Migration apply | n/a — no `supabase/migrations/` files in diff |

Note on the full-suite false alarm: a first `deno test` without `--allow-env`
reported 22 "failures" in `initialize/providerConcurrency/structuredOutput/
toolsList` — all `NotCapable: Requires env access to
MCP_SERVER_MAX_PROVIDER_CONCURRENCY`. These are missing-permission-flag
environmental failures in suites this card does not touch; re-running with
`--allow-env --allow-read` yields 1237/0. Not a code defect, not introduced
by this card. The two F suites the card touches pass with `--allow-read`
alone.

Note on Jest count: CLAUDE.md's "1805 tests / 70 suites" is a stale
Stage-6.4 completion baseline (bumped per-stage, not per-card). The live
repo-wide Jest count is 18925/601. Jest `testMatch` is
`**/__tests__/**/*.test.(ts|tsx)`; the mcp-server Deno tests live in
`mcp-server/tests/` (not `__tests__/`), so Jest runs zero mcp-server tests
(grep confirms) — no Deno/Jest double-coverage or cross-runner leakage.

## Design conformance

- [x] All design file-changes are present — `familyFPrompt.ts` (rule 7) +
  the two named test files; nothing else.
- [x] No undocumented file-changes — `git diff main..HEAD --name-status`
  shows exactly the 3 files the design names.
- [x] Data model matches design — n/a (no schema/key/taxonomy change, as
  required).
- [x] API contracts match design — rule 7 placed in `buildFamilyFUserPrompt`
  (line 314), inside the STRICT RESPONSE-SHAPE CONTRACT, after rule 6
  (lines 299-312), before the "Conservative-positives bias:" prose (line
  329) — exactly the insertion point §5 specifies.

### Charter line-item findings

1. **Additive + byte-equal elsewhere — PASS.** `familyFPrompt.ts` diff is
   purely additive (15 `+` lines, 0 `-` lines). `FAMILY_F_MAX_TOKENS = 1500`
   byte-identical on `main` and `HEAD` (line 55).
   `FAMILY_F_SYSTEM_PROMPT` (lines 77–134) is untouched — the only hunk is
   at line 314+, well past it. No incidental edit anywhere.
2. **Faithful mirror — PASS.** Line-by-line, rule 7 (314-327) is rule 6
   (299-312) with only `alternative_explanation_available` →
   `unstated_assumption` (rawKey, 4×) and `alternative-explanation gap` →
   `unstated-assumption gap`. Allowed (string ≤240 / null), forbidden
   (object/array/boolean/number/missing), true→string / false→null, and the
   closing validator-path sentence at `evidenceSpan.unstated_assumption` are
   all identical in form. No drift.
3. **No relaxation — PASS.** Only `mcp-server/lib/familyFPrompt.ts` changed
   under `lib/`. `mcp-server/lib/familyFKeys.ts` is **untouched** — the
   `unstated_assumption` doctrine guard at lines 144-145 (forbids
   `weak / fallacious / invalid / flawed` verdict tokens) is intact. No
   validator source change; the validator still rejects the malformed shapes
   (proven by the 7 passing regressions).

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — rule 7 is a
  model prompt, not a user-facing string; it carries no verdict framing.
- [x] Score never blocks posting — n/a (classifier shape change; no scoring
  path touched).
- [x] No service-role in client code — none in diff.
- [x] No direct insert into public.arguments — none in diff.
- [x] No AI calls in production app paths — change is in `mcp-server/`
  (Deno Deploy semantic-referee), not `app/`/`src/`; no new provider call.
- [x] Plain language only — n/a (internal prompt, not UI copy).
- [x] **Epic-specific doctrine (cdiscourse-doctrine §1/§10a + the F
  shape-only guard):** rule 7 adds **zero** quality/verdict/fallacy framing.
  The implementer's isolated banned-token test in `familyFPrompt.test.ts`
  scans the rule-7 block (16 patterns: fallacy/fallacious/weak/invalid/
  flawed/wrong/refutes/winner/loser/liar/dishonest/…) and the block contains
  none. Verified the scan is **not a no-op**: the block-isolation regex
  `7\. RAWKEY-SHAPE … (?=Conservative-positives bias|…)` terminates at line
  329, which sits **before** the legitimate `"fallacy"` handling prose at
  line 334 — so the scan operates on the genuine rule-7 text and would catch
  a real verdict-token regression. The only `true`/`false` tokens in the
  added lines are JSON-literal / observation-boolean shape prose
  (`observations.unstated_assumption is true or false`, `When false … MUST be
  null`), byte-identical to rule 6, which the existing "DOCTRINE BAN-LIST
  scan … banned tokens only in negation form" test already permits.

## Test coverage

- [x] New public function behavior has unit tests — the prompt builder's new
  clause is anchored (heading + `evidenceSpan.unstated_assumption` +
  allowed-string-≤240-or-null + forbidden object/array/boolean/number +
  `unstated-assumption gap` anchor + false→null convention + validator-path
  sentence).
- [x] User-facing strings have ban-list assertion — the rule-7 block has a
  dedicated 16-pattern doctrine scan (proven non-no-op).
- [x] Edge cases from design § Tests have tests — object/array/boolean/number
  at `evidenceSpan.unstated_assumption` each **rejected** with
  `result.path === 'evidenceSpan.unstated_assumption'`; string-≤240 and null
  each **accepted**; **240/241 boundary** pinned. Each rejection test sets
  `checkedRawKeys`/`observations`/`confidence`/`evidenceSpan` consistently so
  the *only* fault is the evidenceSpan value type — confirming the rejection
  is the genuine string-or-null gate at that path, not a key-set artifact.
- [x] No `.only` / `.skip` / `.ignore` / `xit` in the changed test files.
- [x] Test count goes UP: prompt suite 33→34, validator suite 7→14 (8 new).

## Blockers

None.

## Suggestions (non-blocking)

1. Design §8 Open-Question 1 (proactively reinforcing the remaining
   uncovered F ai_classifier rawKeys — `missing_warrant`,
   `analogy_mapping_missing`, `consequence_probability_unclear`,
   `authority_basis_missing`, `causal_mechanism_missing`) is correctly
   deferred. Now that PR #432 persists `failure_detail`, the next N=8 load
   drill will make any further residual DB-visible; fold the sweep into that
   follow-up rather than pre-emptively. No action this card.
2. Each rule-N RAWKEY-SHAPE REINFORCEMENT clause is a ~14-line near-verbatim
   copy. If a third (rule 8) lands, consider whether the prompt builder
   should template these from `familyFKeys` rather than hand-copy — purely a
   future maintainability note; copy-paste is the right call for a
   minimal-blast-radius hotfix mirroring a proven clause.

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING`
- Open PR: `gh pr create --title "OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING: rule-7 RAWKEY-SHAPE REINFORCEMENT for evidenceSpan.unstated_assumption" --body-file docs/reviews/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING.md`
- Deploy (operator, post-merge — NOT covered by merge-auto-deploy, which is
  `supabase/functions/` only): push `cdiscourse-mcp-server` to Deno Deploy,
  then hosted smoke `scripts/mcp-server-001-smoke.sh` → expect 23/23 PASS,
  then operator-gated N=1 canary → N=8 burst to confirm
  `evidenceSpan.unstated_assumption` no longer dead-letters (read the now-live
  `failure_detail` on any residual).
- Post-merge worktree cleanup: commands in roadmap-reviewer.md
  § "Post-merge worktree cleanup (operator step)".
