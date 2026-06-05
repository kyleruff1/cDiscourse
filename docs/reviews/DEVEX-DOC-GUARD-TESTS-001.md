# DEVEX-DOC-GUARD-TESTS-001 — Review (GATE C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-04
**Branch:** feat/devex-doc-guard-tests-001
**Issue:** #496
**Skills applied:** cdiscourse-doctrine (§1 / §4-A / §4-C / §6 / §10a + `policy_no_censorship`), test-discipline

---

## Summary

This card adds 3 deferred CI guard tests over two already-merged docs — the #471
H/I/J readiness ledger (`docs/core/MCP-HIJ-READINESS-LEDGER.md`) and the #474
CORPUS-30 human review board (`docs/testing-runs/2026-06-03-corpus-30-human-review.md`).
The diff is exactly 4 files (3 new `__tests__/**` suites + a single benign
`current-status.md` HTML-comment note), +603 lines, test-only. Both guarded docs
are untouched (§4-A clean). All 3 new suites PASS as-committed (40/40), typecheck
and lint are clean, and the secret/doctrine scans surface only the guards' own
*detection vocabulary* (banned-token list, env-var-name regexes, the synthetic
`xai-EXAMPLENOTAREALKEY...` placeholder) — no real secret, no verdict prose, no
Tier-3 source, no `productionEnabled: true` value. The implementer applied the
PR #495 `xai-` scoping lesson correctly and the three documented scoping decisions
(100-char negation window, 200-char fenced-block proxy, ±80-char adjacency) are
scoping-to-the-clean-doc, not bar-lowering — each was independently shown to still
fail a genuine leak / bare prescriptive verb / registry flip. Approve.

---

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0, `--max-warnings 0`) |
| 3 new suites (isolated) | **3 passed / 40 passed**, exit 0 |
| full suite (worktree rootDir) | 637 suites discovered; 636 pass, 1 env-only fail (see note); 19370 passed / 1 skipped |
| 3 new suites in full run | 40/40 pass |
| secret scan (diff) | clean (only regex pattern defs + synthetic placeholder) |
| doctrine token scan (diff) | clean (only the BANNED_TOKENS list + status note) |
| Migration apply | N/A — no `supabase/migrations/**` in diff |

**Captured test lines (authoritative):**

Isolated 3-suite run:
```
Test Suites: 3 passed, 3 total
Tests:       40 passed, 40 total
EXIT: 0
```

Full suite with the worktree as `--rootDir` (so the 3 new files are discovered):
```
Test Suites: 1 failed, 636 passed, 637 total
Tests:       2 failed, 1 skipped, 19370 passed, 19373 total
EXIT: 1
```

**The "1 failed" is a worktree-review artifact, NOT a card regression.** The
failing suite is `__tests__/corpusPoolDrivenPlanner.dry-mode.test.ts` (not one of
this card's 4 files). It `readdirSync`s `logs/engagement-intelligence/`, a
runner-output directory that exists in the main checkout but does not exist in
this fresh sibling worktree → `ENOENT … scandir …\logs\engagement-intelligence`.
That test is part of the green 634/19332 baseline in the canonical
main-checkout run; it is unrelated to the docs-guard tests.

**Why the plain `npm run test` shows 634 not 637.** The repo's `jest` config in
`package.json` declares no explicit `rootDir`, so jest resolves `rootDir` to the
main checkout (`C:\…\debate-constitution-app`), not this worktree. `--listTests`
from the worktree therefore discovers the 634 baseline files (main is on `main`,
without the new files). Forcing `--rootDir` to the worktree discovers exactly
**637** files (634 + the 3 new), and `--listTests | grep` returns the 3 new files.
On a real branch checkout in CI, `rootDir` is the branch root and all 3 guards are
discovered and run. This is an environment artifact of reviewing from a worktree,
not an implementer defect.

---

## The 9 adversarial checks

1. **Allowlist confined — PASS.** `git diff main --name-only` = exactly 4 files:
   `__tests__/corpus30HumanReviewLeakage.test.ts`,
   `__tests__/docs/mcpHijReadinessLedgerBanList.test.ts`,
   `__tests__/docs/mcpHijReadinessLedgerCitations.test.ts`,
   `docs/core/current-status.md` (+ this review doc, which I add). The grep for
   `src/|app/|supabase/|scripts/|migration|engine.ts|familyRegistry.ts|...`
   returned zero. No guarded-doc edit.

2. **Tests read live committed docs — PASS.** All 3 suites `fs.readFileSync` the
   actual repo-relative doc path resolved from `__dirname` (`REPO_ROOT` =
   `path.resolve(__dirname, '..')` for the corpus test, `'..','..'` for the two
   ledger tests). Each `beforeAll` asserts `fs.existsSync(...) === true` before
   reading. No stub/DI; a test cannot pass on empty content (the citations test
   would find 0 cites and fail `>= 10`; the BanList HARD-RULE `toContain` would
   fail; the corpus suppression-verb sanity floor `>= 5` would fail).

3. **Tests PASS on committed docs (THE gate) — PASS.** Isolated run: 3 suites /
   40 tests, exit 0. Full-suite (worktree rootDir): the 3 card suites are 40/40.
   No new card suite fails on the committed doc.

4. **`xai-` regex correctly scoped (PR #495 lesson) — PASS.** Empirically verified:
   (a) regex is `/\bxai-[A-Za-z0-9_]{30,}\b/` — body class excludes `-`, so
   `xai-adversarial` terminates the body before 30 chars; (b) NEGATIVE test asserts
   no match on `'2026-06-03-xai-adversarial-bot-corpus.md'` AND `'xai-adversarial'`
   (plus a third negative, `'xai-adversarial-corpus-summary.md'`); (c) POSITIVE test
   asserts a match on the synthetic `'xai-' + 'EXAMPLENOTAREALKEY'.repeat(2)` (36-char
   body, no real value). All three present and confirmed by direct regex evaluation.
   The other leak regexes (X handle, social URL, post id, sk-ant, sb_secret, JWT,
   Bearer, secret-env, full UUID) are shape-scoped and produced zero substantive
   hits on the committed corpus doc.

5. **Citation test asserts load-bearing content — PASS.** `mcpHijReadinessLedgerCitations.test.ts`
   resolves the bare `familyRegistry.ts` cite to the full
   `supabase/functions/_shared/booleanObservations/familyRegistry.ts`, reads it, and
   content-checks (not existence-only) that lines **106 / 111 / 116** each contain
   `productionEnabled: false` and that the family name (`'claim_clarity'` /
   `'thread_topology'` / `'sensitive_composer'`) sits on the line above (105 / 110 /
   115). Independently re-verified at HEAD: 105→`family: 'claim_clarity'`,
   106→`productionEnabled: false`; 110/111 thread_topology→false; 115/116
   sensitive_composer→false. I also re-ran the cite parser: 30 cites, 0 missing
   files, 0 out-of-range, and the `familyRegistry.ts` bare cites include 69/106/111/116.

6. **Ban-list + advancement-neutral test is real — PASS.** `mcpHijReadinessLedgerBanList.test.ts`
   asserts: the verbatim line-18 HARD RULE substring (`toContain`); both
   "NOT a gate-pass" disclaimers; the 10-token verdict ban-list with both-side word
   boundaries (so `ban` ≠ `band`); no `productionEnabled: true` within ±80 chars of
   any H/I/J family name; no prescriptive advancement phrase (`ready to flip` /
   `should advance` / `recommend production` / `ready for production` /
   `green-light production`). None vacuous — each would fire if the doc regressed
   (HARD RULE removed, a disclaimer dropped, a verdict token added, an H/I/J family
   flipped to `true`). The adjacency scope correctly tolerates the legitimate A–G
   `productionEnabled: true` on ledger line 40 (the nearest H/I/J name, `claim_clarity`
   on line 44, is well beyond 80 chars).

7. **No skip/only — PASS.** `git grep` for `.skip` / `.only` / `.todo` / `xit(` /
   `xdescribe(` across the 3 new files returned zero matches.

8. **No leak in the test files themselves — PASS.** The only `xai-`/key-shaped
   literals are `xai-EXAMPLENOTAREALKEY...` (obvious synthetic placeholder) and the
   `xai-adversarial-bot-corpus` filename tokens used in the negative scoping tests.
   The secret-scan hits on the diff are the leak-detection *regex pattern definitions*
   (`SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN` as a
   regex alternation; the literal label `'Bearer token'`) — not real key material.
   No `sk-ant-`/`sb_secret`/JWT body with a real value anywhere.

9. **No Tier-3 surface — PASS.** Diff excludes `engine.ts`, `familyRegistry.ts`,
   any submission path, any Edge/migration/script. No `productionEnabled: true`
   introduced as a registry value (the `^\+    productionEnabled: true,` value-line
   grep is empty; the string only appears inside the BanList test's assertion logic
   and the status note).

---

## §4-A confirmation

- **Guarded docs untouched.** `git diff main -- docs/core/MCP-HIJ-READINESS-LEDGER.md
  docs/testing-runs/2026-06-03-corpus-30-human-review.md` is EMPTY.
- **No test weakened to pass.** The branch adds tests; it changes no existing test
  or guard. All 3 new suites pass as-committed against the real clean docs.
- **The three documented decisions are scoping, not bar-lowering** — each was
  independently exercised:
  - **100-char negation window** (corpus suppression-verb guard): 27/27 suppression
    verbs in the committed doc are negated within ±100 chars (passes; ≥5 sanity floor
    met). A synthetic *bare* prescriptive verb ("Reviewers should remove the hostile
    content…") has NO negation in ±100 chars → the guard FAILS it. Teeth intact.
  - **200-char fenced-block proxy** (blockquotes excluded): the committed doc has 0
    fenced blocks >200 chars (passes). The legitimate 264-char line-13 acceptance-gate
    text is a markdown blockquote (`>`), correctly excluded; a pasted-body fenced
    ``` ``` ``` block >200 chars would still fail.
  - **±80-char adjacency** (`productionEnabled: true` vs H/I/J names): allows the
    legitimate A–G `true` on ledger line 40 while still failing a `true` adjacent to
    a frozen family name. The load-bearing false lines are content-checked, not
    assumed.

  None neuters a check: a genuine leak still fails, a bare prescriptive suppression
  verb still fails, and a real H/I/J registry flip still fails.

---

## Boundary attestation

- Diff is test-only (3 `__tests__/**` suites) + 1 benign `docs/core/current-status.md`
  HTML-comment note. No `src/` / `app/` / `supabase/` / `scripts/` / migration /
  Edge / `familyRegistry.ts` change.
- No secret value committed (synthetic placeholders only).
- No truth/verdict prose; the banned tokens appear only as the guard's own
  detection list.
- No `productionEnabled` flip, no routing arm, no frozen-set change (§4-C honored;
  the tests *prove* the frozen H/I/J set stays `productionEnabled: false`).
- Reviewer made no code change, did not push, did not open a PR.

---

## Suggestions (non-blocking)

1. The full-suite count in the implementer's `current-status.md` note (637 suites /
   19372 tests) is correct only when `rootDir` is the branch checkout. From a sibling
   worktree the plain `npm run test` reports the 634 baseline because jest binds
   `rootDir` to the main checkout (no explicit `rootDir` in the `package.json` jest
   config). Not a defect for this card — but a future devex card could add an explicit
   `"rootDir": "."` (or run jest with cwd-anchored rootDir) so worktree reviews and CI
   discover the same file set without an override. Deferrable.

---

## Operator next steps

- Push the branch: `git push -u origin feat/devex-doc-guard-tests-001`
- Open PR: `gh pr create --title "DEVEX-DOC-GUARD-TESTS-001: 3 CI guard tests for #471 ledger + #474 review board" --body-file docs/reviews/DEVEX-DOC-GUARD-TESTS-001.md`
- Deploy steps: none — test-only, no migration / Edge / runtime change.
- Post-merge: standard worktree cleanup (roadmap-reviewer.md § "Post-merge worktree cleanup").
