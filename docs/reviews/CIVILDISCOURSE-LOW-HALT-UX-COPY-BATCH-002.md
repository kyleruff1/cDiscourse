# CIVILDISCOURSE-LOW-HALT-UX-COPY-BATCH-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-20
**Branch:** feat/ux-copy-batch-002 (HEAD bf362cc)
**Designs:** docs/designs/AUTH-FOUNDATION-UI-001.md (#740), docs/designs/UX-ONBOARDING-SSO-FIRST-001.md (#760), docs/designs/CIVILDISCOURSE-COPY-SYSTEM.md (#754), docs/designs/UX-BOARD-MOBILE-DEPTH-001.md (#758)

## Summary
A coordinated low-halt UI/copy/docs/test batch covering five issues. #740+#760 are reconciled into ONE canonical pure model (`authProviderSlotModel.ts`) backing an email-only default Sign In surface: a future-reserved disabled Google slot, a future-framed "coming soon" `<Text>` notice (never a Pressable), and an "or continue with email" divider above the byte-identical email/password form. No `signInWithOAuth` exists anywhere in `src/` (recursive source-scan test enforces it). #758 adds an additive `bodyFull` model field + a read-only "Show full body" disclosure toggle gated on `isTruncated`, closing the 390px truncation dead-end in ≤2 taps with the 280-char excerpt pins byte-identical. #759 routes the DebateListScreen action label through the already-shared `accessView.actionLabel` (`deriveGalleryActionLabel` policy) — copy-only, no seat/route semantics change. #754 ships a docs standard + an additive consolidated ban-list guard mutating no shipped copy. All four gates pass; no provider call, no Supabase/Edge/migration/MCP/native/app.json/deploy. No concerns remain.

## Verification
- typecheck: pass (exit 0)
- lint (`--max-warnings 0`): pass (exit 0)
- targeted jest (`authProviderSlotModel authScreenProviderRegion DebateListScreen uxBoardMobileDepth001 argumentReplySidecar argumentReplySidecarModel copySystemBanList`): pass — 8 suites / 159 tests, exit 0
- web:build: pass (exit 0; 775 modules, same two branding assets, no new asset bytes)
- secret scan: clean (exit 1, no match)
- doctrine scan: clean (the only `verdict`/`truth` hits are inside source comments describing the constraint, not rendered copy)
- console.log scan: clean
- migration check: N/A — no `supabase/migrations/` files in diff

## Design conformance
- [x] All design file-changes are present (authProviderSlotModel.ts new; AuthScreen, sidecar model+component, DebateListScreen modified; 4 designs; current-status; test files)
- [x] No undocumented file-changes (the only untracked file is an unrelated dry corpus md, not part of the commit)
- [x] Data model matches design (`bodyFull` additive field exactly as designed; provider-slot region model matches both auth docs)
- [x] API contracts match design (`resolveAuthProviderSlotRegion` default = empty/false; `deriveGalleryActionLabel` policy reused, not re-implemented)

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings (scan clean; ban-list test green)
- [x] Score never blocks posting (no submission-path change; sidecar toggle is read-only disclosure)
- [x] No service-role in client code (none added; no `SERVICE_ROLE` in src diff)
- [x] No direct insert into public.arguments (none)
- [x] No AI calls in production app paths (none; auth model is pure TS, no network)
- [x] Plain language only ("Show full body"/"Show less", "or continue with email", "Social sign-in is coming soon…" — no internal codes, no snake_case in new labels)
- [x] Epic-specific doctrine — `cdiscourse-doctrine` §10 (email+password only in v1): the stricter default is honored (no inert visible provider button); `expo-rn-patterns` (RN primitives only, no new dep); `accessibility-targets` (toggle inherits SHOW_DETAILS_HIT_SLOP + minHeight 28 → ≥44 effective, `accessibilityState={{expanded}}`; divider rules `importantForAccessibility="no"`, label is plain Text)

## Test coverage
- [x] New public functions have unit tests (`authProviderSlotModel.test.ts` 165 lines; `bodyFull` model assertions in `uxBoardMobileDepth001.test.tsx`)
- [x] User-facing strings have ban-list assertion (`copySystemBanList.test.ts` + per-module tests + new toggle-label verdict-free scan)
- [x] Edge cases from design have tests (default-no-enabled-button; mockSignInWithOAuth stays at 0 calls on render AND email path; email path still calls signInWithPassword once; toggle gated on isTruncated; ≤280 vs >280 char body; recursive `signInWithOAuth`-absent source-scan)
- [x] Accessibility assertions present (UI cards): divider non-interactive, notice `accessibilityLiveRegion="polite"`, toggle `accessibilityState={{expanded}}` + touch budget asserted

## Reviewer focus findings
1. **No fake capability — PASS.** AuthScreen default renders `auth-provider-unavailable` as a `<Text>` (AuthScreen.tsx:155-163), gated by `providerRegion.hasVisibleProvider` which is `false` by default (authProviderSlotModel.ts:147,153). No enabled provider button, no Continue-with-Google literal in render. `signInWithOAuth` appears in `src/` zero times (only docs prose + test assertions of absence).
2. **No provider call / no config / no behavior change — PASS.** `authProviderSlotModel.ts` is pure (zero imports). `authApi.ts`, `app.json`, `supabase/**`, `mcp-server/**`, `package*`, lockfiles, migrations, Edge are NOT in the diff (email/password path byte-identical).
3. **#740+#760 coherent + singular — PASS.** Exactly ONE provider-slot model (`authProviderSlotModel.ts`); no `authProviderUiModel`/`signInProviderLayoutModel` anywhere. Both docs describe the same email-only default, future-reserved disabled slot, button deferred to #746 — no contradiction. Tests assert default-no-enabled-button + region/model present.
4. **#758 additive + safe — PASS.** `bodyFull` is additive; `bodyExcerpt`/280-cap/`isTruncated`/`fullBodyLength`/`truncateAtWordBoundary` byte-identical (argumentReplySidecarModel.ts:389-391 unchanged around the additive line). Toggle is read-only disclosure (local `useState` only; no TextInput/editable/onChangeText/callback/new prop). `bodyFull` reuses the same already-redacted `viewModel.body` source as `bodyExcerpt` — no redaction bypass. Pinned readonly/parity tests green.
5. **#759 copy-only — PASS.** DebateListScreen.tsx:223 now renders `accessView.actionLabel` (derived line 141 via `deriveRoomAccessView` → `deriveGalleryActionLabel`). No seat/invite/route change; `onPress(debate)` untouched. OD-5 "Opponent" correctly NOT changed. Recommendation below.
6. **#754 copy-system — PASS.** Doc is original repo-native wording (no lifted v4 slogans). The additive ban-list test imports only existing constants and mutates no shipped copy. Carve-outs are reasonable and honest: STATUS_COPY excluded because it carries the shipped both-sides humility phrase "You might both be wrong" (verified at gameCopy.ts:82 / gameStatus.ts:96), which a whole-word `wrong` match would trip; `block`/`opponent`/`hot` carve-outs are pinned as invariants with positive + negative controls. The narrowed token set co-exists with the per-module ban-list tests (it is a consolidation guard, not a replacement) — not a way to hide a real hit.
7. **Doctrine/ban-list — CLEAN.** No winner/loser/score/verdict/truth/wrong/dishonest/bad-faith/manipulative/pile-on/feed/comment-thread/forum/audience/open-mic/join-the-debate in any changed rendered string.

## Per-issue closability
- **#740 AUTH-FOUNDATION-UI-001 — CLOSE.** Provider-region → divider → email layout shipped with future-reserved disabled Google slot, no visible/enabled button, email/password preserved, single canonical model, tests green. Acceptance met.
- **#760 UX-ONBOARDING-SSO-FIRST-001 — CLOSE.** Email-only default surface with documented slot contract consumable by #746 with zero re-layout; future-framed notice + divider; no faked capability. Acceptance met.
- **#754 UX-COPY-SYSTEM-002 — CLOSE.** Canonical copy-system standard doc + consolidated additive ban-list guard with controls and pinned carve-outs; no shipped copy mutated. Acceptance met.
- **#758 UX-BOARD-MOBILE-DEPTH-001 — CLOSE.** Measured 390px reading-depth doc with before/after; the one true truncation dead-end (F-1) closed via read-only toggle reachable in ≤2 taps; 280-cap pins intact; touch target ≥44; tests green. Acceptance met.
- **#759 UX-ROUTE-SEAT-INVITE-COPY-001 — PARTIAL / keep OPEN.** The list↔gallery action-label drift slice is satisfied (now both route through `deriveGalleryActionLabel`). The OD-5 "Opponent" seat-word consistency slice is explicitly deferred (correctly — `opponent` relabel is an unresolved operator decision, pinned as a non-banned carve-out). Recommend the operator leave #759 OPEN with a follow-up note scoping it to the remaining OD-5 seat-word slice, OR split that slice into its own card and close #759. Do not close #759 outright while the OD-5 slice remains in its stated scope.

## Blockers
None.

## Suggestions (non-blocking)
1. The untracked `docs/testing-runs/2026-06-20-xai-adversarial-bot-corpus-dry.md` in the worktree is unrelated to this card — operator should confirm it is intentional and not accidentally swept into the PR.
2. Consider, in a future copy-lint card, broadening `copySystemBanList.test.ts`'s token set to include the §3.3 amplification family (`feed`, `trending`, etc.) once STATUS_COPY's both-sides phrasing is isolated, so the consolidated guard covers all of doc §3 rather than the §3.1/§3.2/§3.4 subset. Non-blocking — the per-module tests still cover those families today.

## Operator next steps
- Push the branch: `git push -u origin feat/ux-copy-batch-002`
- Open PR: `gh pr create --title "CIVILDISCOURSE-LOW-HALT-UX-COPY-BATCH-002: provider-ready Sign In slot (email-only) + copy-system doc + mobile reading-depth (#740/#754/#758/#760, #759 partial)" --body-file docs/reviews/CIVILDISCOURSE-LOW-HALT-UX-COPY-BATCH-002.md`
- Deploy steps: NONE. No provider call, no hosted config, no Supabase/Edge/migration/MCP, no app.json/native dep. Safe to merge with no deploy.
- Issue actions on merge: close #740, #760, #754, #758; keep #759 OPEN (or split) for the remaining OD-5 "Opponent" seat-word slice.
- Post-merge worktree cleanup (from main repo root): see roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)" — `git worktree remove -f -f ".claude/worktrees/agent-uxcopy002"` then `git branch -D feat/ux-copy-batch-002`.
