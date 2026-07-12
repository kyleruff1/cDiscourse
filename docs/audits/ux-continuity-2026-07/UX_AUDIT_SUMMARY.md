# UX Continuity Audit — Executive Summary

**Commission:** full viewable-product-surface continuity audit, planning-only (no code changes, no PR).
**Branch:** `docs/ux-continuity-audit-2026-07` (docs-only).
**Companion artifacts (this directory):** `UX_SURFACE_MAP.md` · `UX_TRANSITION_MAP.md` · `UX_STYLE_SYSTEM_AUDIT.md` · `UX_ARTIFACT_CLEANUP_AUDIT.md` · `UX_COHESION_AND_MISSION_REVIEW.md` · `UX_ACTION_PLAN.md` · this summary.

---

## 1. Method

- **Static research:** 14-agent workflow (8 readers → 5 synthesizers → 1 completeness critic; ~2.05M tokens, 603 tool calls, zero errors) over the main-content worktree `wt-voice-adr` (src identical to `origin/main` @ `da32f56b`). Every finding carries a `path:line` citation into that tree.
- **Runtime verification:** operator-authed walk of the live Netlify deployment at ~487px viewport, cited throughout as **RUNTIME 2026-07-12 authed walk @487px**.
- **Known limits of the runtime pass:** the authed account is an **admin** (`kyleruff+devtests1`) — plain-user rendering is unverified; the preview pane's native width was ~487px — **wide-viewport behavior is untested**; deep states (playback, moderation) were untriggered (RUNTIME 2026-07-12 authed walk @487px, gaps item).
- **Severity canon** (one ruling per finding, reconciled across all digests): chime-in silent failure = **P0**; Button.tsx contrast = **P1** (4.47:1 hair-miss; rides PR-A); `useReduceMotion` consumer count = **1** (grep-verified); the focus/Esc/corridor/containment cluster = **P0** and appears in UX_ACTION_PLAN Wave 1.

---

## 2. Top 10 findings

| # | Finding | Severity | Where (citation) |
|---|---|---|---|
| 1 | Overlay keyboard cluster: no focus management, Esc collision, corridor nav trap, uncontained sheets | **P0** | Popout.tsx:208,241; composerKeyboardModel.ts:102-104; App.tsx:1028-1044,1189,1673-1679; MarkerPhrasePickerSheet.tsx:51-129 |
| 2 | Light-theme shared components on the dark app (+ Button contrast P1 riding along) | **P0** (Button = P1) | TextInputField.tsx:50-63; ErrorNotice.tsx:18-25; EmptyState.tsx:28-29; CreateDebateForm.tsx:155-173; Button.tsx:67,72,76 |
| 3 | Chime-in attach/retract failures fully silent (flag LIVE) | **P0** | ArgumentRoom.tsx:1019-1042; chimeInApi.ts:102/127 |
| 4 | Silent read-hook family (evidence renders source-less on failed read) | **P1** | useProofItems.ts:66-69; useMarkers.ts:68-71; useMoveMarks.ts:95-97; useChimeInContributions.ts:75-78; AuthScreen.tsx:248-250; App.tsx:1483-1498 |
| 5 | Fixture leakage: smoke rooms/circles shown as real content, three inconsistent treatments | **P1** | RUNTIME 2026-07-12 authed walk @487px; argumentRoomLinksApi.ts:286-300 |
| 6 | Gallery participant count broken ("0 PARTICIPANTS" on a 3-of-5-seats room) | **P1** | RUNTIME 2026-07-12 authed walk @487px |
| 7 | Dead Share affordance — observer-set button is a production no-op | **P1** | ArgumentRoom.tsx:2396; ArgumentSideActionRail.tsx:86-100 |
| 8 | No router/URL model on the live web platform: Back exits the app, nothing bookmarkable | **P1-class product gap** | AuthCallbackScreen.tsx:96-99 (only history-API use in src) |
| 9 | Standing bands are a red→green verdict gradient, duplicated ×3 | **P1 (doctrine-gated re-ramp)** | argumentGameSurfaceModel.ts:839-849; argumentScoreModel.ts:49-59; ArgumentScoreTracker.tsx:69 |
| 10 | Two-generation style system: sound token layer, ~14–24% adoption, five coexisting design eras | **P1 (systemic)** | designTokens.ts:2-21; RingsideCard.tsx:416-517; ArgumentBubbleCard.tsx:234-279 |

### Finding detail (where / what / why / change / risk / test)

**F1 — P0: the overlay keyboard/focus cluster (unanimous across readers; must not be dropped).**
*Where:* every overlay — grep confirms **zero `.focus(` calls anywhere in src**; all containment claims rest on `accessibilityViewIsModal` (Popout.tsx:208,241; ArgumentComposerDock.tsx:524,546; PreSendReviewSheet.tsx:205,219; AddAnnotationSheet.tsx:136; RequestReviewComposer.tsx:176), which is iOS-only and maps to nothing on RN-web — the **live platform**. Plus: `resolveComposerKeyEffect` returns `close` unconditionally (composerKeyboardModel.ts:102-104) while the dock (ArgumentComposerDock.tsx:296-335) and Popout (Popout.tsx:166-180, no stopPropagation, verified) both listen — one Esc plausibly dismisses two layers, defeating PreSendReviewSheet's inert-scrim draft protection (PreSendReviewSheet.tsx:208-215). Plus: the demo corridor traps primary nav — `handlePrimaryNav` never clears `demoCorridorOpen` (App.tsx:1028-1044, verified) and Account/Admin lack the guard so they **co-render** with the corridor (App.tsx:1189, 1673-1679). Plus: MarkerPhrasePickerSheet and RequestReviewComposer are Cancel-only, non-modal, and excluded from `hasOpenMenu`, so room keyboard shortcuts fire behind the open sheet (MarkerPhrasePickerSheet.tsx:51-129; RequestReviewComposer.tsx:172,307; ArgumentRoom.tsx:2784,2852).
*Why:* WCAG 2.4.3/2.1.2 exposure across all 11 Modals for keyboard/SR users; nav that reads as dead; data-loss-adjacent Esc behavior.
*Change:* **PR-0** — small web-only focus utility (initial focus, Tab containment, restore-on-close) adopted by the Popout chassis + Modal sheets first; thread overlay-open state into the key model; clear the corridor in `handlePrimaryNav`; modal-ize the two uncontained sheets.
*Risk:* focus utility touches many overlays — regression risk in tab order; ship chassis-first, then sheets.
*Test:* jest per overlay + RUNTIME-CHECK tab-behind-modal and single-Esc behavior on the live host.

**F2 — P0: light-theme shared components on the dark app.**
*Where:* TextInputField.tsx:50-63 (label `#374151` ≈ 2:1 on the `#08060F` shell; white input patch), ErrorNotice.tsx:18-25 (`#fef2f2`/`#991b1b`), EmptyState.tsx:28-29, CreateDebateForm.tsx:155-173. Consumers are live lanes including the **auth front door**.
*Why:* near-invisible labels hide content; SURFACE_TOKENS ships purpose-built input roles these ignore (designTokens.ts:416-418).
*Change:* **PR-A** — re-skin 4 components onto SURFACE_TOKENS + STATUS.danger. **Button.tsx rides the same PR at P1**: primary `#6366f1`+white is the documented 4.47:1 AA hair-miss (Button.tsx:67,76; designTokens.ts:428-430) and danger is the full-bleed red flood CONTROL.danger forbids (Button.tsx:72; designTokens.ts:445-450); secondary was already fixed (UX-BRAND-001 precedent in-file).
*Risk:* ~10 consumer screens change visually; low test-pin exposure.
*Test:* render tests + visual smoke per consumer screen + grep guard for gray-family hexes in components/.

**F3 — P0: chime-in silent failure (canon ruling).**
*Where:* handleChimeInAttach/Retract check `res.ok` only to refetch (ArgumentRoom.tsx:1019-1042, verified); plain-language `errorMessage` (seats_full, room_private, not_author…) exists in chimeInApi.ts:102/127 and is discarded.
*Why:* the flag is **LIVE** and seats_full/room_private are *expected contention 409s*, not rare edges — users' actions fail invisibly, which misleads. Compounded by useChimeInContributions.ts:75-78 silently freeing all seats on a failed read (invites the 409 that then fails silently).
*Change:* **PR-B** — thread `errorMessage` into ChimeInAffordance as a quiet live-region note (pattern exists: BooleanFeedbackBar.tsx:151-176).
*Risk:* low; additive.
*Test:* jest failure branch renders the message; a11y live-region assert.

**F4 — P1: the silent read-hook family.**
*Where:* useProofItems.ts:66-69 is the worst — a failed read renders every sourced move **source-less**, directly against the evidence-debt doctrine (proof_drawer LIVE; loading flag returned but unused, ArgumentRoom.tsx:846). Siblings: useMarkers.ts:68-71 (rebuttal chips vanish), useMoveMarks.ts:95-97 (aggregate zeroes; the write path is exemplary — asymmetry proves fixability), useChimeInContributions.ts:75-78, useGalleryMoveMarks.ts:58-62. Same class: Google sign-in initiation voided (AuthScreen.tsx:248-250 discards signInWithGoogle.ts:29-70 results — front-door dead tap, flag ON) and the rail join no-op (App.tsx:1483-1498; seatClaimModel.ts:333-340 maps error→`{kind:'none'}`).
*Why:* a JWT expiry mid-room fails the whole family **simultaneously** — the room quietly degrades to "no sources, no markers, no marks, seats open" (critic gap #11; the most probable real-world trigger). One deliberate exception: `useMyCircles` is **documented-intentional** silent (useMyCircles.ts:10,40-44) — tag by-design; do not "fix" it.
*Change:* **PR-B** — one hook-error template (`{data, loading, error, refetch}`) + one non-blocking room-level "could not load — retry" strip.
*Risk:* medium (~10 files), but a single review lens.
*Test:* jest per hook (error in → error out); room renders the strip once, not per-card.

**F5 — P1: fixture leakage, three inconsistent treatments (RUNTIME 2026-07-12 authed walk @487px).**
*Where/what:* (a) Browse gallery shows smoke rooms as ordinary content with the `[stress …]` tag **stripped** from display ("Chime cohort smoke", "Proof drawer smoke", "Settle smoke room"… — 18 rooms, only "1 duplicate run collapsed"); (b) inside a room the **raw tag renders** in the title ("Chime cohort smoke [stress chime-mrgpodh6]"); (c) the Start-sheet circles picker lists six raw `[stress …]` circles as "Your circles". D8 excluded fixtures from HOME only; Browse/room/picker were never covered. Static twin: the weave (quote_forge) picker selects ALL locked debates with raw titles and has zero fixture logic (argumentRoomLinksApi.ts:286-300).
*Why:* misleads users — the product reads as full of fake/broken content; three different treatments of the same rooms erode trust in what is real.
*Change:* **PR-G** — apply the existing policy pair (filter via `looksLikeBotSeedTag`, homeModel.ts:59-65; or clean titles + BotRoomMarker, ConversationGalleryScreen.tsx:26,639) uniformly across Browse, room title, circles picker, and weave picker, for non-admins.
*Risk:* low; policy and patterns already exist — this is coverage, not invention.
*Test:* picker-model test mirroring homeModel's; RUNTIME-CHECK that prod-DB fixture rooms disappear for a plain user.

**F6 — P1: gallery participant count broken (RUNTIME 2026-07-12 authed walk @487px).**
*Where/what:* cards show "0 PARTICIPANTS" for rooms whose own header says "3 of 5 active seats" and which visibly have two posters.
*Why:* the gallery's liveness signal is the primary browse heuristic; a wrong zero reads as a dead room and contradicts the room's own header on the same click path.
*Change:* **PR-G** — fix the count derivation against the same source the room header uses, or drop the stat until it is real.
*Risk:* low.
*Test:* unit test pinning card count == seat-strip source; runtime spot-check.

**F7 — P1: dead Share affordance (critic-verified).**
*Where:* ArgumentRoom.tsx:2396 routes `code === 'share'` to `onShareRoom?.()`; grep confirms **no caller anywhere supplies `onShareRoom`**; the rail model promises "opens a native/browser share sheet" (ArgumentSideActionRail.tsx:86-100). Share is in the observer expanded set — every observer sees a button that silently does nothing.
*Why:* same silent-affordance class the audit rates P1 elsewhere; observers are the growth audience.
*Change:* **PR-G** — fix-or-remove. Note: genuinely fixing it depends on F8 (there is no room URL to share).
*Risk:* removal is trivial; fixing is gated on routing.
*Test:* either the action is absent from the rail model, or an integration test proves a share payload exists.

**F8 — P1-class product gap: no browser-history/URL model (critic gap #3).**
*Where:* the only history-API usage in src is the auth-callback `replaceState` (AuthCallbackScreen.tsx:96-99). No pushState/popstate, no beforeunload.
*Why:* on the live web platform, browser Back **exits the app from anywhere** (including mid-room with a draft), nothing is bookmarkable, no room has a URL — which blocks Share (F7), deep links, and notification links. The surface map records "No router" as fact; the web cost was never priced until now.
*Change:* dedicated **design card** (Wave 3) — not a quick PR; a routing retrofit touches the shell's 5-way priority branch (App.tsx:435-486).
*Risk:* high blast; needs its own design→implement→review cycle.
*Test:* design card first; RUNTIME-CHECK register carries the Back-exits-app behavior.

**F9 — P1 (doctrine-gated): standing-band red→green verdict gradient, ×3 copies.**
*Where:* argumentGameSurfaceModel.ts:839-849 ≡ argumentScoreModel.ts:49-59 (byte-identical red→green map, `pretty_wrong #b91c1c` → `completely_right #10b981`) + a third inline ternary at ArgumentScoreTracker.tsx:69 — **live** via room_exchange_v2. SW-001 softened the labels only (standingBandCopy.ts:32-40); the color keeps the right/wrong channel. Mitigant already shipped: default timeline edge collapses to neutral (argumentGameSurfaceModel.ts:834-838).
*Why:* red/green verdict coloring is the exact channel the mediator board test-bans (a11y693MediatorBoardAxisGuard) — the app contradicts its own doctrine.
*Change:* **PR-F** dedupe to one canonical export now; **PR-F′** re-ramp off red/green (e.g. neutral→indigo intensity = support strength, not truth) — **operator doctrine ruling required first**.
*Risk:* 2 models + tracker + VISUAL-SIMPLIFY-003 contract test + timeline-grammar skill expectations.
*Test:* import-equality test replaces the byte-pin; ruling recorded before any re-hue.

**F10 — P1 (systemic): a two-generation style system.**
*Where/what:* a mature, well-documented token layer (104/182 .tsx files import designTokens; SURFACE_TOKENS ~1,007 refs — winning in new files) underneath ~1,169 file-local hex literals, 990 fontSize literals vs 157 TYPOGRAPHY refs (~14%), 1,290 spacing literals vs 414 (~24%) (digest-verified counts). Five named eras coexist: **A** token-slate (canonical target), **A′** hex-slate (same look, no token linkage — a retune strands RingsideCard.tsx:416-517, ConversationGalleryScreen.tsx:713-805, RoomBoardLayout.tsx:165 silently), **B** warm brand shell (`#08060F` vs interior `#020617` — the two-blacks seam), **C** legacy bubble theater (dormant-but-reachable, ArgumentBubbleCard.tsx:234-279; ExchangeView.tsx:127), **D** sanctioned admin console. Kind palette has 3 sources of truth; tone band has 3 copies, one drifted outside its byte-pin (argumentGameSurfaceModel.ts:851-857).
*Why:* **the tokens are sound; adoption is the gap.** Without guards, eras multiply faster than migration converges.
*Change:* **PR-D** (cohesion contract doc + source-scan guards) then **PR-E** (additive tokens: TYPOGRAPHY body/title roles, SPACING 2/6/10, RADIUS 6/10, SCRIM, MOTION, GLYPHS, missing chip tints) then Wave-2 consolidations.
*Risk:* low if additive-only — TYPOGRAPHY/SPACING_PRESETS values are test-pinned (designTokens.ts:540,582): **add keys, never mutate**.
*Test:* existing pin tests byte-stable; guards red on seeded violations.

*Adjacent P1 carried in the plan (not double-counted above):* competing open-counts on one screen — state rail "7 open points" vs mediator strip "Open issues · 4", no explanation of the difference (RUNTIME 2026-07-12 authed walk @487px) — rides PR-G as a comprehension fix.

---

## 3. Top 10 recommended changes (PR-lettered)

| # | Change | PR | Payload |
|---|---|---|---|
| 1 | Overlay focus utility + Esc layering + corridor nav clear + sheet containment | **PR-0** | F1 cluster (P0); ship chassis-first |
| 2 | Dark-theme re-skin of 4 shared components + Button primary/danger → CONTROL | **PR-A** | F2 (P0) + Button P1; one visual-smoke pass covers both |
| 3 | State honesty: chime error surfacing, hook-error template ×5 hooks, Google sign-in error, rail-join error kind, gallery loading/empty co-render guard (ConversationGalleryScreen.tsx:370/380), in-panel join error | **PR-B** | F3 (P0) + F4 (P1); ~10 files, one review lens |
| 4 | Visible provenance: visible "note"/"derived" affix or dashed-border treatment (today "Advisory:" exists only in accessibilityLabel — derivedSignalConsumerModel.ts:47-48; MediatorNodeMarker.tsx:44) | **PR-C** | Tiny, independent, mission-core |
| 5 | Cohesion contract doc (the 12 principles) + source-scan guards for tokens-by-reference, visible provenance, red-means-failure | **PR-D** | Lands the ratchet before token work |
| 6 | Additive tokens only: TYPOGRAPHY body/title roles, SPACING 2/6/10, RADIUS 6/10 + pill codemod, SCRIM, MOTION {140/160/180}, GLYPHS, chip tints | **PR-E** | Zero-risk vs the pins; unblocks everything |
| 7 | Standing-band dedupe to one canonical export (now); re-ramp off red/green (after operator doctrine ruling) | **PR-F / PR-F′** | F9; import-equality pin |
| 8 | Fixtures + runtime IA honesty: fixture filtering across Browse/room/picker/weave, participant-count fix, competing open-counts reconciliation, Share fix-or-remove, "ADMIN? true" debug row removal (RUNTIME 2026-07-12 authed walk @487px), role-copy mismatch (creator shown as "Watching") | **PR-G** | F5, F6, F7 + runtime P2s |
| 9 | Motion consistency: thread `useReduceMotion` (exactly **1** consumer today, grep-verified — DisagreementPointsRail) through the 8 inline copies; one-token gates at ArgumentTimelineMap.tsx:784, DeletionRequestSheet.tsx:47, MakePrivateConfirmation.tsx:72, DebateDetailHeader.tsx:525 | rides **PR-E** or standalone card | MEMORY doctrine: reuse, never re-inline |
| 10 | Router/URL design card: room URLs, Back behavior, draft guard — prerequisite to a real Share | Wave-3 **design card** | F8; not a quick fix |

---

## 4. What NOT to change

- **The token layer itself.** designTokens values are sound and documented; TYPOGRAPHY + SPACING_PRESETS are test-pinned (designTokens.ts:540,582) — additive keys only, never mutate. The problem is adoption, not design.
- **The state-rail glyph / color-independence system.** Glyphs are always paired with text, never color-alone (the claim/challenge/evidence spine grammar passes: argumentGameSurfaceModel.ts:824-832; RingsideCard.tsx:170-176). It is the audit's strongest asset alongside the dashed/dotted = owed/provisional, solid = standing-fact obligation grammar (ReceiptChip.tsx:91-97; EvidenceDebtChip.tsx:68-76) — name it in the contract doc, extend it, do not redesign it.
- **Observer and confirm-sheet copy grammar.** RoomSettleConfirmation is the house confirm grammar (alert role, consequence bullets, busy state, reduceMotion — RoomSettleConfirmation.tsx:76) and the pre-registered pattern for the future voice one-time-playback gate. Observer copy is strong live ("Readers do not use active seats", "Join to reply" — RUNTIME 2026-07-12 authed walk @487px, positives).
- **Anything pinned by uxOneOneFive/uxOneOneSix read-only boundaries.** Those pins hold timeline/composer files zero-diff; when a pinned file must be edited, relax the specific path with a NOTE — never bulk-relax.
- **The settle sheet.** Live and doctrine-clean (5 honest bullets, RUNTIME 2026-07-12 authed walk @487px); the settled-room gap is *ambient* signaling (a rail chip), not the sheet.
- **The un-game-like doctrine surfaces.** Verdict-token ban-lists (designTokens.ts:637-647), advisory-never-gates (DerivedSignalAdvisoryLines.tsx:14), the mediator one-chip-per-node budget (ArgumentRoom.tsx:3253-3267), marker tombstones (TimestampMarker.tsx:68-76), and capability parity across lenses (roomCapabilityParity.ts) are working guardrails — the fix direction everywhere else is to *generalize* them.
- **The snap-first motion identity.** Exit-snap and instant lane switches are a defensible house behavior; the recommendation is to bless + document it, not to add motion. (Any richer exit choreography would be **SUBJECTIVE DESIGN DIRECTION** and is not recommended.)

---

## 5. Open questions

1. **Plain-user rendering.** The entire runtime walk ran as an admin; nothing confirms what a non-admin sees (fixture filtering, admin-only chrome, seat affordances). (RUNTIME 2026-07-12 authed walk @487px, gaps.)
2. **Wide viewport.** ~487px only. Untested: the 90–120ch estimated reading measure at 1280+ (RoomBoardLayout.tsx:175-177), admin TABLE_WIDTH ≈ 1462 behavior, masthead at desktop widths.
3. **Auth-expiry cascade.** What renders when the JWT expires mid-room — every silent read-hook fails simultaneously (critic gap #11). Needs a simulated expired-session pass; it is the strongest justification for PR-B's rating.
4. **Circle-room state cells.** Circles are a live audience type (CircleFilterRow in ArgumentHome.tsx:46,115-177; StartArgumentSheet.tsx:76-198) — do circle rooms change any of the 21 missing-state cells? Unexamined (critic gap #13c).
5. **The P1-7b doctrine ruling.** Is a standing-band color ramp acceptable at all, and if so on what axis (support strength vs right/wrong)? Operator ruling required before PR-F′; not statically decidable.
6. **Voice flag-coupling.** (a) `one_time_playback` OFF while `voice_entries` ON = voice stored but replayable without receipts — contradicts the consent sheet's one-listen promise; reconcile flag coupling before any voice flip. (b) VOICE-ADR-002 D4 is private-1:1-only, but circles are live and the ungated "Voice — coming soon" mic teaser renders in ALL room types (ArgumentEntryComposer.tsx:369-379, verified unconditional) — the teaser must respect D4's room gating when voice ships.

---

## 6. Recommendation

**Ship several small PRs — PR-0 first, then A through G — not one mega-PR, and not a design-system rewrite.**

Rationale: the P0/P1 items are behavior and a11y honesty fixes with low blast and in-repo templates — they must not queue behind token debates. A big-bang restyle was evaluated and rejected: 1,290+ spacing literals, test-pinned TYPOGRAPHY/SPACING_PRESETS, and the jest-pinned legacy chassis make a mass rewrite high-risk and low-user-value. **The token layer is good; adoption is the gap** — so the sequence is: fix what hides/blocks/misleads (PR-0, A, B, C), land the guards (PR-D), add tokens additively (PR-E), then converge mechanically (PR-F, Wave-2 consolidations) with the guards preventing new drift. The doctrine-gated red/green re-ramp (PR-F′) and the high-blast chrome-budget extraction are isolated so nothing else waits on an operator ruling.

---

## 7. Commission final-response data block

- **App ran:** yes — live Netlify deployment, operator-authed session (admin account, ~487px viewport).
- **Surfaces found:** **21 screen-level surfaces** (16 live-reachable, 1 legacy-flag fallback, 3 dev-only, 1 dead) **+ 33 overlay-class elements** (11 true Modals, 3 absolute non-Modal overlays, ~19 in-flow panels/popovers/banners incl. InvitePanel + RoomContractSeatStrip) = **54 total**, with **23 active missing-state cells** (UX_SURFACE_MAP §11 counts, post-critic).
- **Transitions found:** **19 inventoried transition/animation classes** (T1–T19; T19 is the gallery nested-scroll behavior row, not an animation): 5 live custom animators + 1 dead, 2 web-inert LayoutAnimation sites, the platform-Modal slide/fade families across 11 Modals, plus non-motion state feedback (UX_TRANSITION_MAP inventory).
- **Major cohesion risks:**
  - Silent-failure culture on read/write paths misleads on the evidence spine itself (sourced moves render source-less) and cascades room-wide on auth expiry.
  - Verdict-color leakage: red→green standing gradient + legacy red 'counter' + maroon gallery chips contradict the app's own test-enforced red/green ban — doctrine self-contradiction.
  - Era multiplication: five coexisting visual generations with ~14–24% token adoption on type/spacing; without guards, drift outpaces migration.
  - Fixture/test content leaking into three user surfaces (gallery, room titles, circles picker) reads as a fake or broken product.
  - Emphasis competition: ~12 chrome bands per exchange screen, ~15 elements on the active card — the mission leaks by accumulation, not by any one component.
- **Top-5 implementation priorities:** (1) PR-0 focus/Esc/corridor/containment cluster; (2) PR-A dark-theme components + Button→CONTROL; (3) PR-B state honesty (chime P0 + silent-hook family); (4) PR-G fixture leakage + participant count (runtime trust fixes); (5) PR-D+E cohesion guards + additive tokens (stop era multiplication before converging).
- **Docs written (7):** `UX_SURFACE_MAP.md`, `UX_TRANSITION_MAP.md`, `UX_STYLE_SYSTEM_AUDIT.md`, `UX_ARTIFACT_CLEANUP_AUDIT.md`, `UX_COHESION_AND_MISSION_REVIEW.md`, `UX_ACTION_PLAN.md`, `UX_AUDIT_SUMMARY.md`.

---

## 8. RUNTIME-CHECK register (carried — summary-relevant items)

Items the static audit could not settle; each needs the next operator-authed pass (or a plain-user pass) to confirm. Detailed per-artifact registers live in the sibling documents.

| # | Check | Decides |
|---|---|---|
| 1 | Tab-behind-modal on every overlay; whether default focus outlines survive the built bundle's CSS reset | F1 empirical confirmation (P0 cluster) |
| 2 | Single Esc press with ActPopout / PreSendReviewSheet layered over the dock — double-dismiss?; does RNW Modal fire onRequestClose on Esc | F1 Esc collision |
| 3 | Demo corridor open → tap Account/Admin: visual co-render outcome (stacked vs overlapped) | F1 corridor severity |
| 4 | Rendered contrast of TextInputField/ErrorNotice/EmptyState/CreateDebateForm on live dark lanes | F2 (confirms P0) |
| 5 | Plain-user (non-admin) rendering pass: fixture rooms, admin chrome, "ADMIN? true" row | F5 severity for real users; open question 1 |
| 6 | Wide-viewport pass at ≥1280px: reading measure, admin tables, masthead | Open question 2 |
| 7 | Simulated expired-session: what the room renders when the silent-hook family fails at once | F4 rating; open question 3 |
| 8 | Weave picker on prod: do locked `[stress…]/[xai-adv…]/[reseed-…]` rooms appear? | F5 static twin |
| 9 | Live flag ON-set (9-ON/2-dark split is from session context, not read from runtime) | All reachability claims |
| 10 | Silent-hook failure frequency (no telemetry exists; ratings assume network-loss/auth-expiry occurrence) | F4 calibration |
| 11 | Legacy tree lens / red TRACK palette prod reachability | Kind-palette consolidation scope |
| 12 | __DEV__ dead-code elimination in the deployed bundle (Debug tab, tree/tracks chips, devFixtures) | Cleanup keep-list |
| 13 | RNW Modal `animationType` actual duration and whether exit animations play | Motion harmonization premise |
| 14 | Retracted-marks SELECT-policy invisibility (memory + model comments; migration SQL not re-read) | Trust-surface verdict |
| 15 | Circle-room variants of the 21 missing-state cells | Open question 4 |
