# DEVEX-FX10-CLEAN-CHECKOUT-001 — Review (GATE C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-04
**Branch:** fix/devex-fx10-clean-checkout-001
**Top commit:** `208dfa5 fix(DEVEX-FX10-CLEAN-CHECKOUT-001): commit FX-10 corpus reference — green main in clean checkouts` (present — not HALT)
**Issue:** #489

## Executive summary

`origin/main` was red in every clean checkout / fresh worktree / CI:
`__tests__/mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` FX-10 hard-asserts
`docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md` exists, but that file
was **untracked / absent from `origin/main`** (it lived only on the operator's
local disk, masking the failure locally). The fix is **Path A**: commit the
one leak-safe corpus reference file plus a `current-status.md` entry. No test
logic changed, no runner change, no Edge/DB/migration/src/routing change. The
full suite is **green in this fresh worktree** (`631 passed, 631 total` suites /
`1 skipped, 19281 passed, 19282 total` tests, exit 0). FX-10 now passes AND the
previously skip-guarded FX-11–FX-15 cross-checks now genuinely **run** (strictly
more coverage). The committed corpus is leak-clean: zero handles/URLs/post-IDs,
zero credential shapes, `_Secrets exposed_: no`, the single `password` token is
a compliance-checklist line. The only credential-pattern grep "hit" in the diff
is a pre-existing **unchanged context line** (CORPUS-30) that names scan patterns
as documentation, not a leak. APPROVE.

## Per-check findings

### Check 1 — Clean-checkout green (THE check) — PASS
- Full `npm run test` run from this worktree (the actual clean-checkout failure
  mode; worktree branch reset to fix HEAD `208dfa5`). Captured summary line:
  - `Test Suites: 631 passed, 631 total`
  - `Tests:       1 skipped, 19281 passed, 19282 total`
  - exit code **0**. Matches expected ≈631 suites / ≈19281 passing / 1 skipped.
- `__tests__/mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` isolated re-run:
  **19 passed, 19 total**, exit 0. FX-1…FX-19 all green.
- Test source confirms the skip-guard semantics (read `mcpOneTwoOneCEdgeFixtureUUIDs.test.ts:88-126`):
  - FX-10 (`:96-98`) hard-asserts `expect(fs.existsSync(CORPUS_PATH)).toBe(true)`
    — genuinely fails when the file is absent (the red-main mode).
  - FX-11–FX-15 (`:100-126`) each guard with `if (corpusText === '') return;`,
    and `corpusText` is only populated when `fs.existsSync(CORPUS_PATH)` (`:90-94`).
    So on a clean checkout without the file: FX-10 **FAILED** and FX-11–FX-15
    **skipped vacuously**. With the file committed, all five now run and assert
    the fixture UUIDs / phrase. Confirmed present in the corpus (see Check below).

### Check 2 — Leak-safety (Path A gate) — PASS
Scanned committed `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md` (838 lines):
- X handles (`@handle`, 1–15 chars): **none**.
- `x.com` / `twitter.com` / `t.co` URLs: **none**.
- 15–20 digit decimal post IDs: **none**. (UUIDs present are internal Supabase
  room/argument IDs in 8-4-4-4-12 hex form — not X post IDs.)
- `sk-ant-` / `xai-<key>` / `sb_secret` / JWT (`eyJ…`) / `Bearer <token>` /
  `Authorization:` / `SERVICE_ROLE` / `ANTHROPIC_API_KEY` / `XAI_API_KEY` /
  `X_BEARER_TOKEN`: **none**.
- Emails: **none**.
- Header (`:9`) declares `_Secrets exposed_: no  ·  _Anthropic called_: no  ·  _service-role used_: no`.
- Single `password` occurrence is the compliance-checklist line
  `:834  - [x] No passwords or `password=...` lines` — a checkbox, not a secret.
  Full "Secrets check" block (`:831-838`) is the standard runner-emitted
  redaction attestation (all boxes checked).
- §1/§3/§10a prose: zero truth-verdict tokens
  (winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/
  is true/is false/proven/verdict). "Engagement" appears only as a structural
  per-room gameplay score (`engagement (avg): 4.3 / 5`, `:60/:303/:529`),
  never as popularity-as-evidence. Bodies (`:77`, `:97`, `:114`, …) are
  synthetic bot-debate content authored by declared test-bot personas
  (Alex/Jordan/Sam = provocateur/revocateur/synthesizer, `:7`), truncated with
  `…` (33 excerpts) — no raw real-user hostile content reproduced. This is a
  pre-existing structural run artifact, no new doctrine-violating prose.
- **File IS leak-safe → Path A is correct.** No Path-B trigger.

### Check 3 — No masking — PASS
- `git diff origin/main --stat -- '__tests__/**' 'src/**' 'app/**' 'supabase/**'`
  is **empty** — no test/src/app/edge file modified.
- `__tests__/mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` is NOT in the diff
  (`git diff origin/main --name-only -- <test>` empty). The test still
  genuinely asserts the file exists; threshold not lowered.
- Added-line scan for `.only(` / `.skip(` / `xit(` / `xdescribe(` / `todo(`:
  **none**. Nothing skipped or weakened.

### Check 4 — Boundary — PASS
`git diff origin/main --name-only` touches **only**:
- `docs/core/current-status.md` (+2 net: new DEVEX-FX10 status entry)
- `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md` (+838, new file)
- (plus this `docs/reviews/` file, added by the reviewer)
No `__tests__/**`, no runner, no Edge/DB/migration/src/app/routing change
(confirmed empty diff for those globs).

### Check 5 — Runner untouched — PASS
`git diff origin/main -- scripts/bot-fixtures/runXaiAdversarialBotCorpus.js`
is **empty** (byte-equal to main). File exists and is tracked on the branch
(`git ls-files --error-unmatch` succeeds). The batch surface is not touched.

### Check 6 — No collateral regression — PASS
Full suite green in the clean checkout (Check 1): `631/631` suites,
`19281` passing / `1` skipped, exit 0. `npm run typecheck` exit 0.
`npm run lint` (`--max-warnings 0`) exit 0. No other suite newly fails.

### Plus — Tracked on branch — PASS
- `git ls-files --error-unmatch docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`
  succeeds → file is **tracked** on the fix branch.
- `git cat-file -e origin/main:docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`
  fails with "exists on disk, but not in 'origin/main'" → confirms the exact
  failure mode (untracked working-copy file masked the red main locally).
- All six fixture UUIDs each appear exactly once in the corpus:
  `1e598dce-…923` (debate), `f41b18b0-…6ad` (d0), `781f8057-…ff7` (d1),
  `db0de3e0-…bac` (d2), `35ef4c74-…153` (Pitch clock alt),
  `2c085a50-…ddb` (Bike lanes alt). "onboarding" ×37, "apology" ×11 → FX-15 ok.

### Plus — §6 staged-diff secret scan — PASS (zero)
- No **added (`+`) line** in the diff carries any credential value
  (verified: `git diff | grep '^+' | grep -iE '<credential shapes with value
  bodies>'` is empty).
- The one credential-pattern grep "hit" is a pre-existing **unchanged context
  line** (` ` prefix) — the CORPUS-30 status entry already on `origin/main`
  that lists `sk-ant- keys / xai- keys / sb_secret / JWT shapes` as the *names*
  of patterns a leakage test scans for. Security-control documentation, not a
  leak. Not introduced by this card.

## Boundary attestation

No code modified. No production code, test, runner, Edge Function, migration,
or src/app file changed by this review. No push. No PR opened. No merge. The
reviewer's only write is this review file. The worktree branch was reset to the
fix HEAD purely to read the branch content in-place (operates on the worktree's
own branch, never on `main`).

## Verdict

**APPROVE** — clean checkout green (631/631 suites, 19281 passing, exit 0),
FX-10 + FX-11–FX-15 genuinely run, corpus leak-safe (`_Secrets exposed_: no`),
no test weakened, boundary is the two doc files only, runner byte-equal,
secret scan clean. Path A was the correct fix.
