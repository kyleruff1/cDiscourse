# UX-ROOM-1V1-CHIMEIN-001A — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-20
**Branch:** feat/UX-ROOM-1V1-CHIMEIN-001A-uicopy (HEAD 5253b86)
**Design:** docs/designs/UX-ROOM-1V1-CHIMEIN-001.md (§5 safe-now subset + appended "001A implementation map")
**Issue:** kyleruff1/cDiscourse#737 (child of #680)

## Summary
This is the Layer-A safe-now slice of the 1:1-first room design: a pure-TS display-state
model (`oneToOneRoomModel.ts`), 1:1-first copy relabels, a display-only visibility-wiring
bug fix, and a +38-test suite. It does exactly what the card scopes and nothing more — no
backend, schema, RLS, migration, Edge, capacity enforcement, or chime-in contribution path.
The chime-in states are dormant classifications, `chimeAffordanceVisible` is hardcoded
`false`, and no live UI renders the dormant chime copy. OD-1 is not resolved and the
private-room copy is OD-1-safe (never claims "no observers"). The respondent seat is
test-locked as principal language, never "chime-in". All five gates pass. No concerns.

## Verification
- typecheck: pass (exit 0)
- lint (`--max-warnings 0`): pass (exit 0)
- focused jest (`oneToOneRoomModel roomContractModel roomAccessModel seatClaimModel argumentRoomCreateCopyDoctrine RoomContractSeatStrip CreateDebateForm.visibility`): pass — **8 suites / 190 tests**, exit 0
- web:build: pass (exit 0; dist exported, only the two existing branding assets, favicon unchanged)
- secret scan: clean
- doctrine scan: clean (verdict-word hits are all ban-list array entries / comments enforcing doctrine, never product strings)
- forbidden footprint (supabase/ mcp-server/ migrations Edge package.json lockfile app.json engine.ts): clean — none present

The card permits noting the documented `pointLifecycleModel` LIFE-001 wall-clock flake; the
focused gates fully cover every surface in the diff (`oneToOneRoomModel` is the only new
suite), so no full-suite re-run was needed to clear the diff. The implementer's claimed
full-suite delta (+1 suite / +38 tests → 844 / 31,901) is consistent with the focused run.

## Design conformance
- [x] All design file-changes are present (App.tsx wiring, ROOM_CONTRACT_COPY / ROOM_ACCESS_COPY / ROOM_VISIBILITY_COPY relabels, new ROOM_ONE_TO_ONE_COPY + dormant POINT_SCOPED_CHIME_IN_COPY, new oneToOneRoomModel.ts, RoomContractSeatStrip glyph, index.ts barrel, lockstep tests, docs)
- [x] No undocumented file-changes (12 files; every one matches the §5 / implementation-map rows)
- [x] Data model matches design (read-only projection over RoomContract seat state + visibility + viewer flags + GAME-005 openChimeInSeatCount; `unknown` on insufficient data)
- [x] API contracts match design (no API touched — pure model + copy + display threading)

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings — verified by word-scan; verdict words appear only in `_forbiddenOneToOneTokens()` and the test AVOID array
- [x] Score never blocks posting — N/A (no scoring, no submit path touched)
- [x] No service-role in client code — grep over `src/**` + App.tsx clean
- [x] No direct insert into public.arguments — none; model contains no `.insert(` / `functions.invoke` / `submit-argument` (asserted by test)
- [x] No AI calls in production app paths — none
- [x] Plain language only — `looksLikeInternalCode` / snake_case ban-list test passes over all new/changed strings
- [x] Epic-specific doctrine — expo-rn-patterns: model is pure-TS (no React/Supabase import, asserted by source-scan), no new deps; accessibility-targets: no new interactive control is added (dormant copy only), so the 44×44 / role-label-state surface is correctly deferred to the GATE-C card

## Test coverage
- [x] New public functions have unit tests — `deriveRoomOneToOneDisplayState`, `buildRoomOneToOneViewModel`, `buildOneToOneSeatLineViewModel`, `chimeInAllowed`, `_forbiddenOneToOneTokens` all covered, including failure/`unknown`/NaN cases
- [x] User-facing strings have ban-list assertion — `oneToOneRoomModel.test.ts` § "copy ban-list" + `argumentRoomCreateCopyDoctrine` over the new helpers
- [x] Edge cases from design have tests — `unknown` fallback, NaN chime count never invents a chime state, contradictory viewer flags (principal wins over observer), private-regardless-of-seat, respondent-seat-not-chime-in at three layers
- [x] Accessibility assertions — not applicable to a pure model + copy authoring (no new control); deferred to the GATE-C card per design

## Focus-item findings (card's named criteria)
1. **Layer A only** — ✓ Footprint check confirms `supabase/**`, `mcp-server/**`, migrations, Edge fns, `package.json`/lockfile, `app.json`, and `src/domain/constitution/engine.ts` are NOT in the diff. 12 files: App.tsx, gameCopy.ts, roomContractModel.ts, RoomContractSeatStrip.tsx, index.ts, oneToOneRoomModel.ts + 3 lockstep test files + 2 docs + the new test.
2. **No faked chime-in path** — ✓ `oneToOneRoomModel.ts` imports only `gameCopy` strings + a type (no React/Supabase/fetch); the two `*_dormant` states are classification-only; `buildRoomOneToOneViewModel(...).chimeAffordanceVisible` is hardcoded `false` (oneToOneRoomModel.ts:282) and tested across every state; repo-wide grep confirms `POINT_SCOPED_CHIME_IN_COPY` is referenced only by its definition, the barrel, and the model re-export — no live component imports it.
3. **OD-1 not resolved + private-observer truthful** — ✓ Private subcopy is "Invited access." / helper is "...invited access. No public chime-ins."; tests assert the forbidden phrases (`no observers`, `invited parties only`, `only the person you invite`, `invitees only`) are ABSENT (oneToOneRoomModel.test.ts:252-287; CreateDebateForm.visibility.test.tsx:88-90). No observer/room semantics changed.
4. **Respondent seat ≠ chime-in** — ✓ `seatOpen`/`turnOpenSeat` = "Respondent seat open"; `public_open_line` = "Respondent seat open — observe or take it."; locked by tests that assert `.not.toContain('chime')` at the state, view-model, and shared-copy layers (oneToOneRoomModel.test.ts:189-211).
5. **Private no-public-chime = render nothing** — ✓ `chimeInAllowed('private') === false` (tested); private view-model `chimeAffordanceVisible: false`; no disabled/fake CTA anywhere; node rail untouched.
6. **Visibility-wiring fix is display-only** — ✓ App.tsx adds only `options: { roomType: currentDebate?.visibility }`; `roomType` flows solely into `buildRoomContract` → `buildRoomContractViewModel` (pure display projection) and the useEffect dep array; the adjacent `seatAvailability` derivation was already `visibility === 'public'`-gated and is unchanged. `RoomVisibility` and `RoomType` are both `'public' | 'private'` — type-safe.
7. **Copy correctness + label parity** — ✓ "Public 1:1"/"Private 1:1", "Respondent seat open", access lines + create-form 1:1 framing all present; `seatOpponent: 'Opponent'` left byte-identical (OD-5 deferred — correct, and still pinned by the unchanged held-by-other test); `roomTypeGlyph` keys off `ROOM_CONTRACT_COPY.privateRoom` (drift-proof, tested).
8. **No comment-thread/social-feed framing + ban-list** — ✓ Card ban-list (comment, pile on, audience, forum, join the debate, open mic, third side, winner, loser, score, verdict, truth, wrong, fallacy, dishonest, bad faith, manipulative, AI decides, AI judge) run over new/changed copy — zero in product strings. "comment thread" appears only in code comments stating what a chime-in is NOT.
9. **Tests strong** — ✓ 38 new tests make real assertions per state + `unknown` fallback + NaN guard + chime-dormant invariant + OD-1-safe wording + respondent≠chime-in (3 layers) + principal/observer separation + visibility-threading pipeline + source-scans. Lockstep updates are exact relabels that ADD assertions (OD-1-safe negatives) and harden the glyph test; no unrelated coverage weakened.

## Blockers
None.

## Suggestions (non-blocking)
1. The new model fns and `ROOM_ONE_TO_ONE_COPY` / `buildOneToOneSeatLineViewModel` are exported
   through the barrel but not yet consumed by a live render surface (the visible header relabel
   flows through the pre-wired `RoomContractSeatStrip` via `ROOM_CONTRACT_COPY`). This is the
   correct Layer-A "author the pure model + copy now, wire consumers in a later card" shape and
   is fully test-covered, so it is not a defect — just a note that the GATE-C / seatline follow-up
   (#681) is where these become live UI. No action needed for this card.

## Operator next steps
- Push the branch: `git push -u origin feat/UX-ROOM-1V1-CHIMEIN-001A-uicopy`
- Open PR: `gh pr create --title "UX-ROOM-1V1-CHIMEIN-001A: 1:1-first room-state UI/copy + pure display model" --body-file docs/reviews/UX-ROOM-1V1-CHIMEIN-001A.md`
- Deploy steps: **None — pure code change.** No migration, no Edge deploy, no env var, no dependency change. Safe to merge with no deploy.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)"): worktree path `.claude/worktrees/agent-chimein001a`, branch `feat/UX-ROOM-1V1-CHIMEIN-001A-uicopy`.
