# DOCS-ARCH-001-DEPRECATE-SYNC-001 — Review (GATE C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-04
**Branch:** feat/docs-arch-001-deprecate-sync-001
**Design:** docs/designs/DOCS-ARCH-001-DEPRECATE-SYNC-001.md (on main)
**Issue:** #486
**Reviewed HEAD:** `b763e32` (top: supersession pointers; parent `78c3fc5 …(#492)` — matches expected)

## Summary

Docs-only supersession-pointer sweep. The implementer prepended a near-identical 4-line supersession blockquote — descriptive, navigation-only, matching the design's EXACT pointer text verbatim — to the two NORMATIVE-actionable synchronous-capacity design docs (`OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md` and `…-intent.md`), placed under the H1 and above the existing metadata block so every body byte stays byte-equal, and appended one additive manifest comment to `docs/core/current-status.md`. The diff is exactly 3 files, +11 / −0 lines, entirely under `docs/`. All 12 historical docs named in the design's classification table are confirmed byte-equal vs main. No code, test, script, supabase, migration, or `familyRegistry.ts` file is in the diff. No secret-shape, X handle, URL, or post-ID in the added lines. No `productionEnabled: true` / H-I-J flip / re-litigation language: the only regex matches on "enable/re-litigate/reopen/productionEnabled" are inside the descriptive manifest comment and are all explicit negations ("No productionEnabled flip (H/I/J stay false)", "never re-litigates ARCH-001", "never claims the sync path should be re-enabled"). The acceptance-gate invariant is restated verbatim (affirmed, not weakened). Typecheck and lint both exit 0; the docs-only change cannot alter the test suite. Ship-clean.

## Verification

| Check | Result |
|---|---|
| typecheck (`npm run typecheck`) | pass — exit 0 |
| lint (`npm run lint`) | pass — exit 0 |
| test | not run — docs-only diff touches zero `.ts`/`.test.ts`; suite provably unchanged from baseline 634 suites / 19332 passing / 1 skipped (test delta 0 per design forecast §Test-count) |
| secret scan (added lines) | clean — no ANTHROPIC/XAI/SERVICE_ROLE/sb_secret/sk-ant/Bearer/Authorization/JWT-shape |
| leak scan (added lines) | clean — no @handle / URL / x.com / t.co / twitter.com / 15–20-digit post-ID |
| doctrine / verdict-token scan (added lines) | clean — no winner/loser/liar/correct/dishonest/extremist/propagandist/etc. |
| Migration apply | N/A — no `supabase/migrations/**` in diff |

## The 7 adversarial checks

1. **Allowlist confined — PASS.** `git diff main --name-only` = exactly 3 paths, all `docs/**`: `docs/core/current-status.md`, `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md`, `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md`. `grep -vE '^docs/'` empty; no `src/` / `app/` / `__tests__/` / `scripts/` / `supabase/` / `mcp-server/` / migration path present.

2. **Historical byte-equal — PASS.** For each of the 12 historical docs (design classification rows 6–8 and 10–18; row 9 `current-status.md` is the manifest target, carved out by the design's manifest-stub §208–214), `git diff main -- <doc>` is EMPTY:
   - `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-CAP2-SMOKE-2026-05-30.md` — byte-equal
   - `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-PHASE4-SMOKE-2026-05-30.md` — byte-equal
   - `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-REVIEW-2026-05-30.md` — byte-equal
   - `docs/core/known-blockers.md` — byte-equal
   - `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md` — byte-equal
   - `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` — byte-equal
   - `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` — byte-equal
   - `docs/designs/UX-001.4.md` — byte-equal
   - `docs/reviews/ARCH-001-CARD2-DRAINER-ENQUEUE.md` — byte-equal
   - `docs/reviews/ARCH-001-CARD3-TUNING-AND-ROLLOUT.md` — byte-equal
   - `docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` — byte-equal
   - `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md` — byte-equal

   `current-status.md` (row 9) is changed only by one additive manifest comment at line 5 (numstat 1/0); its protected body lines (`:27` commented changelog, `:726` UI "direct dispatch" line) are untouched and far below the insertion.

3. **Normative pointer-only — PASS.** `git diff main --numstat` shows `5 0` for each normative doc (5 added, 0 deleted). Whole-diff `grep '^-[^-]'` returns no removed content lines. Both pointers are inserted between the H1 and the existing metadata block: doc-1 line 1 `# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — …` → blockquote (lines 3–6) → `**Status:** Design draft` preserved; doc-2 line 1 → blockquote → `**Operator:** Kyler · **Date:** 2026-05-30 · **Issue:** #371` preserved. The blockquote text matches the design's EXACT pointer text (design §86–106) verbatim. Redirect target `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` exists. No body line removed or modified.

4. **No ARCH-001 re-litigation — PASS.** The two pointer blockquotes are strictly descriptive: "was superseded by the canonical Postgres async classifier queue … preserved byte-equal as the durable #371 card-intent; it is not a current prescription." No "should reconsider / re-enable / re-open / was wrong" language. The manifest comment's only matches on `re-litigat` / `reopen` / `re-enable` are explicit negations ("it never re-litigates ARCH-001, never claims the sync path should be re-enabled, never reopens #371/#373, never resurrects the rejected Deno-KV limiter"). Nothing argues the sync path should return.

5. **No productionEnabled text — PASS.** No `productionEnabled: true` anywhere in the diff. The single `productionEnabled` token appears in the manifest comment as a negative attestation: "No productionEnabled flip (H/I/J stay false)." `git diff main -- supabase/functions/_shared/booleanObservations/familyRegistry.ts` is EMPTY — the file is not in the diff (`--name-only | grep familyRegistry` empty). No H/I/J flip recommendation.

6. **No leak — PASS.** Added-line grep for secret-shapes (ANTHROPIC/XAI/SERVICE_ROLE/sb_secret/sk-ant/xai-/Bearer/Authorization/JWT) → clean. Added-line grep for @handle / `https?://` / `x.com` / `t.co` / `twitter.com` / 15–20-digit post-ID → clean. The only "#"-numbers present are GitHub issue refs (#486, #371, #373), not post IDs.

7. **Acceptance-gate invariant preserved — PASS.** The added text affirms the invariant verbatim ("AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, src/lib/constitution/engine.ts, is the sole gate. Classifiers run after an argument is stored.") and explicitly states the card "changes zero code paths, zero queue routing, zero acceptance behavior." No added text implies a classifier could become the submission gate; `engine.ts` remains the sole gate.

## Doctrine self-check (cdiscourse-doctrine §1/§4/§5/§6/§8)

- [x] §1 No truth/winner/loser language in any added line (verdict-token scan clean).
- [x] §4 No AI-moderator-as-authority text; classifiers explicitly post-store, non-blocking.
- [x] §5 Rules engine untouched (`engine.ts` not in diff; named only as the affirmed sole gate).
- [x] §6 No secret-shape in the diff.
- [x] §8 Historical records preserved byte-equal — the design's "records are evidence, never rewritten" doctrine is honored (append-only / pointer-prepend only); consistent with §8 append-only applied to the documentation layer.
- [x] §9 No raw internal validation code surfaced to a user-facing string (these are internal design docs + a manifest comment, not UI copy).

## Blockers

None.

## Suggestions (non-blocking)

1. (Cosmetic, defer) The manifest comment in `current-status.md` is a single very long line. It is consistent with the file's existing per-card manifest convention (the CORPUS-30 entries above it are equally long), so this is house-style, not a defect — no action required.

## Operator next steps

- This is the reviewer subagent's GATE C verdict only. **No push, no PR, no merge performed here.**
- Card is docs-only · `requiresMigration/EdgeDeploy/GateC: false` · `autoMergeEligible: true`. GATE C is not a merge prerequisite for a docs-only card (design §186); this review records the standard docs review as APPROVE.
- Operator may push the branch and open/auto-merge the PR:
  - `git push -u origin feat/docs-arch-001-deprecate-sync-001`
  - `gh pr create --title "DOCS-ARCH-001-DEPRECATE-SYNC-001: supersession pointers on the 2 normative sync-capacity docs (#486)" --body-file docs/reviews/DOCS-ARCH-001-DEPRECATE-SYNC-001.md`
- No deploy step: change touches only `docs/**`, not `supabase/functions/**` or `supabase/migrations/**`, so the Supabase auto-apply (merge=deploy) path is not triggered.
- Open Question 1 from the design (optional row-11 pointer on `MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md`) was correctly left out of scope; no operator action required unless the operator elects to widen scope in a follow-up.
- Post-merge: run the worktree cleanup procedure (roadmap-reviewer.md § "Post-merge worktree cleanup").

## Boundary attestation

No code modified. No docs modified except this review file. No push. No PR opened. No merge.
