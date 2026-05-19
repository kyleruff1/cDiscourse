# COPY-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** feat/COPY-001-plain-language-label-review-pass-post-wa
**Design:** docs/designs/COPY-001.md
**Audit:** docs/copy-review/plain-language-labels-pass-1.md

## Summary

COPY-001 is an audit-first, docs-led card with a small, purely-additive code hardening tail. The audit (435 lines) categorizes all 78 `PLAIN_LANGUAGE_COPY` entries by semantic level, surfaces five collision / near-collision pairs with explicit render-time qualification rules (R1–R5) that are consumable by SC-004 / ST-002 / RULE-003, and re-confirms the ban-list against the full doctrine vocabulary. The implementation tail appends three verdict-flavored adjacency tokens (`right`, `wrong`, `validated`) to both `_forbiddenLifecycleTokens()` and `_forbiddenMetadataTokens()` and pins the doctrine §2 "hot = activity" carve-out as a test invariant. No `gameCopy.ts` label was touched. No production app code path was touched. The work is doctrine-clean, the test additions follow the existing access patterns, and the operator can push and PR as-is.

## Verification
- typecheck: pass
- lint: pass
- test (COPY-001 + adjacent doctrine suites): 52/52 pass (`copyReviewBanListGaps.test.ts` + `pointLifecyclePlainLabels.test.ts` + `metadataPlainLabels.test.ts` + `metadataDoctrineAnchors.test.ts`)
- test (full suite): 3344 passed / 19 failed / 3363 total — **the 19 failures are pre-existing on `main`** (verified by checking out `main` and running the same 5 xai/anthropic test files in isolation: identical 19 failures, same root cause = missing `.env.engagement-intelligence` in the dev environment; unrelated to COPY-001).
- test count delta: 3356 → 3363 (+7), 121 → 122 (+1) — matches the implementer's stated baseline exactly.
- secret scan: clean (no `ANTHROPIC_API_KEY`, no `SERVICE_ROLE`, no `sk-ant-*`, no `xai-*`, no `Bearer`, no `Authorization`, no `eyJ…` JWT shape in the diff).
- doctrine scan: clean — the verdict tokens (`right`, `wrong`, `validated`) appear ONLY as ban-list data + test fixture assertions, never as user-facing labels. No `console.log`. No `from public.arguments`. No `insert into public.arguments`.

## Design conformance
- [x] All design file-changes are present — `docs/designs/COPY-001.md` (219 lines), `docs/copy-review/plain-language-labels-pass-1.md` (435 lines), 5-line append to `pointLifecycleModel.ts`, 5-line append to `moveMetadataLedger.ts`, new `__tests__/copyReviewBanListGaps.test.ts` (91 lines), 17-line note in `docs/current-status.md`.
- [x] No undocumented file-changes — `git diff main..HEAD --stat` matches the design plan exactly.
- [x] Data model matches design — design says "no new data model"; diff confirms zero new types / interfaces / unions.
- [x] API contracts match design — design says R1–R5 are consumer obligations (not new public APIs in this card); diff confirms no new exports were added.
- [x] `gameCopy.ts` PLAIN_LANGUAGE_COPY map unchanged (`git diff main..HEAD -- src/features/arguments/gameCopy.ts` returned no output, confirming the design's "zero drifts found, no relabel" claim).
- [x] R1–R5 are well-formed: each rule has a statement, a consumer list (matrix in audit §6), a status row, and an explicit doctrine-vs-hygiene classification. R1 + R2 are mandatory; R3 is "implicit in META-001 eligibility, now explicit"; R4 reuses the existing `toPlainLanguageOrSuppress` discipline; R5 is hygiene-only, v1.1-optional, with a doctrine-clean v1 fallback. Consumable by SC-004 / ST-002 / RULE-003 as design inputs.

## Doctrine self-check
- [x] No truth/winner/loser language in user-facing strings — confirmed by the full per-label scan against the expanded ban-list (the 3 new tests scan every lifecycle + manual-tag + auto-metadata label against `right`/`wrong`/`validated` + the existing 22 verdict + 12 amplification + 6 block tokens and all pass).
- [x] Score never blocks posting — N/A (no scoring code touched).
- [x] No service-role in client code — verified (`grep` on the diff returned no matches).
- [x] No direct insert into `public.arguments` — verified (no Supabase write paths touched).
- [x] No AI calls in production app paths — verified (no Anthropic / xAI / X / OpenAI fetch in any code path touched).
- [x] Plain language only (no raw internal codes in UI strings) — this card IS the plain-language audit; the design output strengthens the discipline.
- [x] Doctrine §2 "hot = activity" carve-out preserved — both ban-list comments explicitly cite §5.1 + §8 of the audit; the new test file has two dedicated `expect().not.toContain('hot')` assertions on each ban-list. The audit recommendation deliberately excludes `hot` from the additions, citing `GALLERY_SECTIONS` "Hot rooms…" / "Hot but unresolved" as the legitimate activity-meaning usage.
- [x] Epic-specific doctrine (cdiscourse-doctrine §1 / §2 / §9 — "no truth labels", "heat means activity", "plain language for users"): every audit recommendation is encoded as test-enforced invariants. The audit also explicitly cross-checks `cdiscourse-doctrine §1` through `§10` in its §"Doctrine self-check" section of the design doc.
- [x] accessibility-targets (chip-fit label length): no new labels were added; existing label-length tests in `metadataPlainLabels.test.ts` lines 40–44 and `pointLifecyclePlainLabels.test.ts` lines 37–42 are unchanged and continue to enforce the 32-char chip-fit constraint.

## Test coverage
- [x] New public functions have unit tests — N/A (no new public functions; the 3-token append is to the body of existing helpers).
- [x] User-facing strings have ban-list assertion — the new test file re-runs the per-label scan against the expanded ban-list for all 19 lifecycle states + all 10 manual tags + all 16 auto-metadata codes (45 labels × 3 new tokens = 135 new substring assertions per run).
- [x] Edge cases from design § "Edge cases" have tests — the design enumerates edge cases that consumers must handle (R1–R5 application matrix); these are consumer obligations, not this card's. The `hot` carve-out is pinned as a test invariant on both ban-lists (4 dedicated tests).
- [x] Accessibility assertions present — N/A for an audit / ban-list card (no UI surface).
- [x] New test file follows existing access pattern — imports `_forbiddenLifecycleTokens` from `../src/features/lifecycle` (the barrel; same path as `pointLifecyclePlainLabels.test.ts:9–13`) and `_forbiddenMetadataTokens` from `../src/features/metadata` (the barrel; same path as `metadataPlainLabels.test.ts`). The underscore-prefix-with-internal-export pattern is unchanged — no widened visibility.

## Blockers
None.

## Suggestions (non-blocking)

1. **Extend SC-004's `timelineNodeActionDockDoctrine.test.ts`** with the `sourced` + `source_attached` dedup case (audit §8 item 2). The implementer of the next consumer card (ST-002 design or SC-004 follow-up, whichever lands first) should pick this up. COPY-001 names the test but does not own SC-004's test file.
2. **Pass-2 audit trigger.** The audit is anchored to Stage 6.4 / post-META-001. When Wave 2 (SC-004 + ST-002 + IX-001) lands and the chips are renderable in-product, file a pass-2 audit card so the rule index can be re-validated against an actual rendered surface.
3. **Future audit on `GALLERY_SECTIONS`.** Out of scope for COPY-001, but the audit §5.1 flags that the "hot" carve-out lives in a sibling map; a future audit pass on `GALLERY_SECTIONS` should re-confirm "hot" appears only in activity-clarifying subhead pairs.
4. **Untracked side-effect files.** `docs/testing-runs/2026-05-19-ai-driven-bot-corpus-dry.md` and `docs/testing-runs/2026-05-19-engagement-epidemiology-synthetic.md` are present in the worktree as untracked files. They are dry-run output from earlier bot-fixture tests (no secrets, no `Authorization`, no `xai-` / `sk-ant-` strings — content begins with "_Mode_: dry" / "_Source mode_: synthetic"). They are correctly excluded from the commit. No action required; the operator can delete or leave them.

## Operator next steps

- Push the branch: `git push -u origin feat/COPY-001-plain-language-label-review-pass-post-wa`
- Open PR: `gh pr create --title "COPY-001: Plain-language label review pass (post-Wave 1)" --body-file docs/reviews/COPY-001.md`
- No migration. No Edge Function deploy. No `.env*` change. No secret rotation. No service restart. No xAI / Anthropic / X / OpenAI API call required at any step.
- After merge, mark issue #71 closed and queue ST-002 + RULE-003 design phase to consume the R1–R5 rule index from `docs/copy-review/plain-language-labels-pass-1.md` §6.
