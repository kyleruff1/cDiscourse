# UX-ROUTE-SEAT-INVITE-COPY-001B — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-20
**Branch:** feat/ux-route-seat-od5b (HEAD bdd6c99, ahead 1 of origin/main)
**Design:** follow-up to #766 (UX-ROUTE-SEAT-INVITE-COPY-001, OD-5)

## Summary
Tiny accessibility/copy-only follow-up that aligns the strip
`accessibilityLabel` strings in `roomContractModel.ts` with the visible OD-5
vocabulary shipped in #766. `buildStripAccessibilityLabel` now announces
"Respondent seat is open — …" for the open principal seat (was "Opponent seat
is open …") and "You hold the Other voice seat." / "The Other voice seat is
held." for an established second principal (was "…Primary Opponent seat…").
"Initiator" wording is preserved. The change is three string literals plus one
clarifying comment block; the if/else control flow is byte-identical. Internal
KEYS (`seatOpponent`/`turnOpponent`) and model names
(`primaryOpponentUserId`/`resolvePrimaryOpponent`/`invitedOpponentUserId`/the
`'primary_opponent'` enum) are unchanged. Visible VALUES from #766
(`ROOM_CONTRACT_COPY`) are untouched. No concerns remain.

## Verification
- typecheck: pass (exit 0)
- lint (`-- --max-warnings 0`): pass (exit 0)
- jest (od5OtherVoiceRelabel roomContractModel roomContractSeatStrip oneToOneRoomModel): pass — 4 suites / 121 tests (exit 0)
- web:build: pass (exit 0; bundle exported, 775 modules)
- secret scan: clean (no matches)
- doctrine scan (incl. enemy/adversary/challenger/verdict/truth): clean (no matches)
- hygiene scan (console.* / .skip / .only / xit / xdescribe): clean (no matches)
- out-of-scope file scan (app.json/package/lockfile/supabase/mcp/migration/Edge/.env): clean (no matches)

## Design conformance
- [x] All design file-changes present — only `src/features/debates/roomContractModel.ts` + `__tests__/od5OtherVoiceRelabel.test.ts`
- [x] No undocumented file-changes — `git diff --name-only` shows exactly the two expected files
- [x] Data model matches design — no model/schema change
- [x] API contracts match design — `buildStripAccessibilityLabel` signature unchanged; public `buildRoomContractViewModel` shape unchanged

## Reviewer focus items
1. **A11y labels aligned, scoped** — ✓ open principal seat → "Respondent seat is open — …"; established second principal → "You hold the Other voice seat." / "The Other voice seat is held." (`roomContractModel.ts:610,612,614` at HEAD). "Initiator" kept (`:600,602`).
2. **No "Opponent" in any rendered/announced string** — ✓ verified against `git show bdd6c99:`: every remaining `Opponent` is an internal KEY (`seatOpponent`/`turnOpponent`), the `'primary_opponent'` enum, `primaryOpponentUserId`, `resolvePrimaryOpponent`, `invitedOpponentUserId`, the `opponentSeat` variable, or a code comment. All `push()` strings and all `ROOM_CONTRACT_COPY` VALUES use "Other voice"/"Respondent". Internal KEYS + model names byte-identical.
3. **No visible-copy churn beyond a11y** — ✓ diff does not touch `ROOM_CONTRACT_COPY`; VALUES unchanged: `seatOpponent: 'Other voice'`, `seatOpen: 'Respondent seat open'`, `turnOpponent: "Other voice's move"`, `privateRoom: 'Private 1:1'`, `publicRoom: 'Public 1:1'`. Open respondent seat is NOT "chime-in".
4. **No semantics / no out-of-scope** — ✓ same if/else structure, only string literals + comment changed; no room/seat/invite/chime-in semantics; no key/model rename; no app.json/package/lockfile/supabase/mcp/migration/Edge/.env.
5. **Tests real** — ✓ section-7 assertions exercise the public `buildRoomContractViewModel(...).accessibilityLabel` with genuine `roomInput()`/`roomRoot()` fixtures; assert both positive OD-5 vocabulary AND absence of "Opponent"/"chime" across initiator/other/null/opponent viewers and the open-seat path. Not tautological.
6. **Doctrine/ban-list** — ✓ no winner/loser/verdict/truth/enemy/adversary/challenger in the new a11y strings.

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings
- [x] Score never blocks posting (n/a — no scoring path touched)
- [x] No service-role in client code
- [x] No direct insert into public.arguments
- [x] No AI calls in production app paths
- [x] Plain language only (no raw internal codes in UI strings)
- [x] Epic-specific doctrine — `accessibility-targets`: announced strings are
      plain-language seat descriptions, no verdict words; this card narrows the
      screen-reader name to match the visible label so a11y users hear the same
      role word sighted users read.

## Test coverage
- [x] New behavior (a11y label vocabulary) has unit tests via the public model
- [x] User-facing/announced strings have a "no Opponent / no chime" assertion
- [x] Edge cases covered — open seat vs claimed seat vs viewer-is-second-principal
- [x] Accessibility assertions present — the suite asserts the strip
      `accessibilityLabel` content directly

## Blockers
None.

## Suggestions (non-blocking)
None.

## Operator next steps
- Push the branch: `git push -u origin feat/ux-route-seat-od5b`
- Open PR: `gh pr create --title "UX-ROUTE-SEAT-INVITE-COPY-001B: align OD-5 screen-reader labels" --body-file docs/reviews/UX-ROUTE-SEAT-INVITE-COPY-001B.md`
- Deploy: none. Copy/a11y-only change to a pure-TS model; no migration, no Edge Function, no config. Safe to merge with no deploy.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)") — worktree `agent-od5b`, branch `feat/ux-route-seat-od5b`.
