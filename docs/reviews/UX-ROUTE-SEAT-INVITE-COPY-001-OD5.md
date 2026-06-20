# UX-ROUTE-SEAT-INVITE-COPY-001 (OD-5 slice, #759) — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-20
**Branch:** feat/ux-route-seat-od5 (HEAD 17d8700)
**Design / spec:** operator Phase 2 criteria + `docs/designs/CIVILDISCOURSE-COPY-SYSTEM.md` §3.6

## Summary
OD-5 (operator-decided second-principal role word) ships as a pure copy-only relabel: the visible
"Opponent" label for the second active principal on an established 1:1 now reads **"Other voice"**.
Exactly the named rendered VALUE surfaces flipped — `argumentGameSurfaceModel.pickActorLabel('other')`,
`argumentScoreModel.pickActorLabel('other')`, `conversationGalleryModel.latestPostAuthor`,
`ROOM_CONTRACT_COPY.seatOpponent` (seat pill), and `ROOM_CONTRACT_COPY.turnOpponent`
("Opponent's move" → "Other voice's move"). Internal model names, KEYS, the open respondent seat,
and all observer/reader copy are untouched. Footprint is copy/model/test/doc only. All four gates pass.
One non-blocking note: the pre-existing screen-reader `accessibilityLabel` open-seat sentence still
says "Opponent seat is open" — pre-existing, byte-identical to base, outside OD-5's named scope.

## Verification
- typecheck: **pass** (exit 0)
- lint (`--max-warnings 0`): **pass** (exit 0)
- jest (targeted: od5OtherVoiceRelabel, roomContractModel, roomContractSeatStrip, conversationGalleryModel + visibility): **pass** 152/152 (exit 0)
- jest (related: copySystemBanList, oneToOneRoomModel, timelineDensityLensModel): **pass** 162/162 (exit 0)
- web:build: **pass** (exit 0; 764 modules; 2 existing branding assets, no new asset bytes)
- secret scan: **clean**
- doctrine scan: **clean** (only hits are the ban-list ARRAY inside the OD-5 test and a negation sentence in current-status.md)
- Migration apply: **n/a** — no `supabase/migrations/**` files in diff

Note: `npx jest argumentScoreModel argumentGameSurfaceModel` matches no test FILE (confirmed via Glob — none exists).
Their OD-5 actor-label coverage is asserted from inside `od5OtherVoiceRelabel.test.ts`
(`computeStatementStanding`, `buildArgumentTimelineMap`), which passed. Not a coverage gap.

## Design conformance
- [x] All required relabel surfaces present (5 VALUE sites + doc carve-out)
- [x] No undocumented file-changes (footprint = copy/model/test/doc only)
- [x] No data-model change (copy-only; no schema/contract delta)
- [x] No API/Edge change

## Doctrine self-check
- [x] No truth/winner/loser language in user-facing strings ("Other voice" carries no verdict/truth/enemy/adversary/challenger token; asserted by test §5)
- [x] Score never blocks posting (untouched)
- [x] No service-role in client code (untouched; secret scan clean)
- [x] No direct insert into public.arguments (untouched)
- [x] No AI calls in production app paths (untouched)
- [x] Plain language only (no raw internal codes in UI strings)
- [x] Epic-specific doctrine — `cdiscourse-doctrine` §1 (no verdict labels) + COPY-SYSTEM §3.6 carve-out: "opponent" stays un-banned (KEY name); rendered VALUES no longer say "Opponent"

## Phase 2 focus items (operator criteria)
1. **OD-5 resolved, copy-only, no semantics** — ✓ VALUES flipped at exactly the named sites: `argumentGameSurfaceModel.ts:877`, `argumentScoreModel.ts:137`, `conversationGalleryModel.ts:987`, `roomContractModel.ts:120` (seatOpponent) + `:122` (turnOpponent). No room/seat/invite/chime-in/observer logic touched.
2. **Open respondent seat unchanged** — ✓ `ROOM_CONTRACT_COPY.seatOpen`/`turnOpenSeat` still "Respondent seat open"; never "chime-in" (asserted od5OtherVoiceRelabel.test.ts §1 + seat-pill §2).
3. **Observer/reader copy distinct** — ✓ test asserts no non-seatOpponent ROOM_CONTRACT_COPY value equals "Other voice" and no VALUE contains bare "Opponent" (§1 completeness guard + §5 reservation guard).
4. **Internal names byte-identical** — ✓ grep confirms `primaryOpponentUserId`/`resolvePrimaryOpponent`/`isPrimaryOpponentSeatStale`/`botMayBePrimaryOpponentOfRealUser` + the `seatOpponent`/`turnOpponent` KEYS all unchanged; only string values + doc comments changed.
5. **No adversarial/person-judgment tone** — ✓ "Other voice" is neutral; doctrine scan clean.
6. **No code outside copy/model/test/doc** — ✓ `--name-only` out-of-scope grep returns NONE (no app.json/package/lockfile/.env/supabase/mcp-server/migration/Edge).
7. **Tests real, lockstep doesn't weaken coverage** — ✓ `od5OtherVoiceRelabel.test.ts` +340 lines of genuine derivation/reservation/internal-name assertions; lockstep flips are balanced value swaps (roomContractModel ×3, roomContractSeatStrip ×1, timelineDensityLens ×2 inert fixtures); no `.skip`/`.only`/`console.log` added.

## Test coverage
- [x] Each touched public function exercised (pickActorLabel via buildArgumentTimelineMap + computeStatementStanding; latestPostAuthor via buildConversationGalleryCards; seatOpponent/turnOpponent via buildRoomContractViewModel)
- [x] User-facing string has ban-list assertion (§5 verdict-token guard)
- [x] Reservation edge case covered ("Other voice" never on open seat / observer / reader)
- [x] Internal-name byte-identity guard present (§6)

## Suggestions (non-blocking)
1. The screen-reader `accessibilityLabel` built by `buildStripAccessibilityLabel`
   (`src/features/debates/roomContractModel.ts:606,608,610`) still emits
   "Opponent seat is open …" / "the Primary Opponent seat …". These are **pre-existing
   and byte-identical to base 7051e20** (verified), and lines 608/610 use the
   preserved "Primary Opponent" role-CONCEPT phrasing that focus item 4 explicitly
   keeps. They are outside OD-5's named VALUE-surface scope, so not a blocker — but a
   later card may want to align the open-seat a11y sentence ("Respondent seat open")
   with the visible pill to remove the sighted/screen-reader drift.
2. Cosmetic prose mismatch: the commit message and the `current-status.md` entry both
   state `turnOpponent` was "left byte-identical / OUT of OD-5 scope", but the diff (and
   the operator's focus item 1) correctly flip its VALUE to "Other voice's move". The
   code + test are right; only the narrative prose describes an earlier plan. No action
   required for merge.

## Operator next steps
- Push the branch: `git push -u origin feat/ux-route-seat-od5`
- Open PR: `gh pr create --title "UX-ROUTE-SEAT-INVITE-COPY-001: OD-5 — Opponent → Other voice (copy-only)" --body-file docs/reviews/UX-ROUTE-SEAT-INVITE-COPY-001-OD5.md`
- Deploy steps: **none** — copy/model/test/doc only; no migration, Edge, MCP, app.json, native dep, or provider call. Safe to merge with no deploy.
- **#759 closure:** the route-action-label slice (#765, merged) AND this OD-5 slice are both done; #759 is fully satisfied → **closeable** on merge.
- Post-merge worktree cleanup (see roadmap-reviewer § "Post-merge worktree cleanup").
