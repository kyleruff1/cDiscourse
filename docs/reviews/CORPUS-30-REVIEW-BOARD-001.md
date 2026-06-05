# CORPUS-30-REVIEW-BOARD-001 — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-04
**Branch:** feat/corpus-30-review-board-001
**Design:** docs/designs/CORPUS-30-REVIEW-BOARD-001.md
**GitHub issue:** #474

## Summary

Docs-only human review-board workflow that turns the committed `d49e04cd` prod-synthetic
corpus run (30 debates / 300 args) into routable product/playability feedback. The diff is
exactly two files under `docs/**` (+202 lines): a new 201-line review board
(`docs/testing-runs/2026-06-03-corpus-30-human-review.md`) and a one-line
`current-status.md` manifest comment. The board is a fixed-schema, leak-safe, operator-run
workflow: §0 restates the acceptance-gate invariant verbatim, §1/§6 restate
`policy_no_censorship` (this is explicitly NOT a suppression workflow), §4 teaches how to
read the four landed reporter metrics, §5 is an empty 30-row scaffold table, §7 defines the
conditional planner-rotation file-trigger, §8 is the five-bucket findings map, §10 is the
doctrine attestation. All eight adversarial checks pass. Because the design's named guard
test (`__tests__/corpus30HumanReviewLeakage.test.ts`) was correctly deferred — `__tests__/**`
is a Tier-3 no-edit surface for this docs-only batch — I performed the authoritative leak
scan manually and thoroughly; the committed doc is leak-safe by independent scan. No
concerns remain.

## Verification

| Check | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint | pass (exit 0, `--max-warnings 0`) |
| test | suite unchanged — docs-only diff, zero `.ts` files; no re-run required |
| Migration apply | n/a — no `supabase/migrations/**` in diff |
| secret scan | clean — only sibling-doc filenames containing `xai-` (not secret values) |
| doctrine scan | clean — all `winner/correct/true/false` hits are doctrine-guard descriptions or metric-band terms |

## The 8 adversarial checks

1. **Allowlist confined — PASS.** `git diff main --name-only` = exactly
   `docs/core/current-status.md` + `docs/testing-runs/2026-06-03-corpus-30-human-review.md`.
   No `src`/test/script/supabase/migration path. `git diff main -- …/familyRegistry.ts`
   is empty (frozen set untouched). No `.ts` in the diff.

2. **NO suppression workflow (LOAD-BEARING) — PASS.** Every hit of
   `remove|redact|hide|filter|ban|suppress|block|censor` in the added lines is
   **descriptive/prohibitive**, never a prescriptive action step:
   - Doc lines 25, 43, 145, 163, 201: "This is NOT a suppression workflow", "does NOT
     propose… any step that would ban, redact, hide, filter, suppress, or block", "We do NOT
     remove hostile rhetoric".
   - Doc line 149/167: the prescriptive form is explicitly **barred** — "If any proposed
     finding reads as 'if reviewers find X, remove / redact / hide / filter / ban / suppress /
     block X,' that finding is **out of scope** and must not be written."
   - `block/reject/route/delay` on lines 13/15/33/176/194 are the acceptance-gate
     invariant's prohibitions on gating a *user submission*, not content-suppression steps.
   The board's only outputs are (a) run usable / needs-another-pass and (b) file/don't-file
   the planner-rotation follow-on (lines 15, 26). Read end-to-end: no suppression path smuggled in.

3. **policy_no_censorship preserved — PASS.** §1 (line 21), §6 (lines 140-149), and the §10
   attestation (line 201) restate and defer to `policy_no_censorship`; the doc never proposes
   modifying it. Hostile rhetoric is framed as the corpus's INPUT, not a defect to suppress
   (lines 25, 144).

4. **Independent leak scan (AUTHORITATIVE — guard test absent) — PASS / CLEAN.**
   I read the full 201-line doc and ran pattern scans against it. Results:
   - X handles `@name` (1-15 chars): **none**.
   - `x.com` / `twitter.com` / `t.co` URLs: **none**.
   - 15-20 digit post IDs: **none**.
   - Emails: **none**.
   - Secret shapes (`sk-ant-`/`sb_secret`/`Bearer `/`SERVICE_ROLE`/`ANTHROPIC_API_KEY`/`eyJ…`
     JWT): **none**. The only `xai-` matches (line 36) are the two committed sibling-doc
     **filenames** `2026-06-03-xai-adversarial-bot-corpus.md` /
     `…-corpus-summary.md`, not secret values.
   - Full UUID (8-4-4-4-12 hex): **none** — the scaffold uses shortened first-8-hex ids only,
     and the 30-row table (lines 105-134) is empty (operator fills ≥10 post-merge).
   - Verdict/truth tokens (`winner/loser/liar/dishonest/bad faith/manipulative/extremist/
     propagandist/stupid/idiot`): the only `winner`/`correct`/`true` occurrences (lines 101,
     190) are the doctrine-guard statements that the schema deliberately has **no** such
     column. `false`/`true` on lines 63/68/74/155 are metric-band / boolean terms
     ("false YELLOW", "attributionPresent: false"), not truth verdicts about a claim or author.
   - Raw hostile body content: **none reproduced** — the doc uses neutral summaries +
     shortened-id/hash references only (per §1/§3/§10a). Required-reading line 36 explicitly
     states "Bodies stay in the reviewer's own view; they never enter this committed doc."

   The committed doc is leak-safe by independent scan. The deferred automated guard is
   therefore acceptable (see deferred-test note).

5. **Acceptance-gate invariant preserved — PASS.** §0 (line 13) states verbatim: "AI/MCP
   classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine,
   `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is
   stored. No path may block, reject, route, or delay an ordinary user post." Lines 7, 15,
   176, 195 reinforce that the board reviews SYNTHETIC corpus runs only and "never touches a
   user submission." Nothing implies the board's verdict could block/route/delay a user post.

6. **Metrics references accurate — PASS.** All four names appear verbatim in
   `scripts/bot-fixtures/xaiAdversarialReport.js` at HEAD, and the behaviors the doc
   describes match the source:
   - `fallbackReasonHistogram` — present; prefix-bucketed (§4.1).
   - `sameyMoveFromEvents` — present; `SAMEY_MOVE_SAMPLE_FLOOR = 50` (src:529), high-pair
     `0.60` (src:530), yellow-mean `0.35` (src:531), `insufficient_samples` → "NEVER read
     green" (src:528, 621-627). Matches doc §4.2 (Jaccard + N<50 n/a).
   - `recalibrateVoiceBand` — present; `VOICE_BAND_LOW_FACTOR = 0.5` (src:413),
     `VOICE_BAND_HIGH_FACTOR = 2.0` (src:414), `expectedPerVoice = totalVoiceAssignments /
     distinctVoiceCount` (src:430). Matches doc §4.3 (two teeth).
   - `qualityThresholds` — present; `deterministicFallbackPct {yellow:20,red:40}` (src:756),
     `topOpeningPhrasePct {yellow:8,red:15}` (src:757), `sameyMoveMean` delegating to samey,
     `attributionPresent:false` n/a gate (src:782). Matches doc §4.4.

7. **Planner-rotation deferral honored — PASS.** §7 (lines 153-162) frames planner-rotation
   as a CONDITIONAL, evidence-triggered follow-on to **file** (not build) only if reviewers
   across multiple runs find genuine voice-sameyness despite a GREEN band. Line 162 states
   explicitly: "This doc does NOT declare that planner-rotation should be built."

8. **No productionEnabled advancement — PASS.** The only `productionEnabled` reference
   (line 193) is the §4-C attestation that there is NO flip and NO routing arm; the frozen
   set is untouched. No recommendation anywhere to advance H/I/J based on review-board outputs.

## Deferred-test note

The design (§ Smoke plan, § Commit-slice plan, § Test-count forecast) named a guard test
`__tests__/corpus30HumanReviewLeakage.test.ts`. It was **not** created because `__tests__/**`
is a Tier-3 no-edit surface for this docs-only batch — a correct deferral, not an omission.
The reviewer's manual authoritative leak scan (check 4 above) covers the same leak classes
the test would have asserted and returns CLEAN, so the deferral is acceptable for this card.
**Recommended follow-up (non-blocking):** add `__tests__/corpus30HumanReviewLeakage.test.ts`
in a later dev-tooling lane so the leak-safe contract on this committed doc is guarded by CI
(it should scan the doc for X handles / `x.com`·`t.co`·`twitter.com` URLs / 15-20-digit post
IDs / emails / secret shapes / verdict tokens → zero matches). This matters because the
operator will fill ≥10 rows post-merge, and the automated guard would catch a leak introduced
during that manual pass.

## Boundary attestation

- Diff is 2 files, both `docs/**` (+202 lines). No `src` / `__tests__` / `scripts` /
  `supabase` / migration edit.
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` NOT in diff —
  H/I/J frozen set untouched; no `productionEnabled` flip.
- `src/lib/constitution/engine.ts` untouched — sole acceptance gate preserved.
- No routing arm, no routing-percentage change, no submission-path change.
- No suppression workflow. `policy_no_censorship` preserved and deferred to.
- No Anthropic / xAI / X API call by Claude. No Supabase write. No direct insert into
  `public.arguments`. No secret / raw body / handle / URL / post-id / email in the committed
  doc.
- typecheck + lint green (exit 0) from the worktree; test suite unchanged (zero `.ts`).

## Operator next steps

- Push the branch: `git push -u origin feat/corpus-30-review-board-001`
- Open PR: `gh pr create --title "CORPUS-30-REVIEW-BOARD-001: human review board workflow"
  --body-file docs/reviews/CORPUS-30-REVIEW-BOARD-001.md`
- Deploy steps: none — docs-only; no `supabase/functions/**` or `supabase/migrations/**`, so
  §5 merge=deploy does NOT trigger. Autonomous green squash-merge eligible.
- Post-merge: operator fills ≥10 of the 30 rows, consolidates flagged cells into the five
  buckets, and (separately) consider filing the deferred-test follow-up named above.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup".
