# UX_SURFACE_MAP — CDiscourse UX Continuity Audit (2026-07)

**Scope:** Complete inventory of the viewable product surface — every screen, lane, overlay, panel, and banner — with owner file, reachability, roles, state coverage, and missing-state cells. Static audit root: `wt-voice-adr` (src identical to origin/main `da32f56b`). Runtime findings are from the operator-authed walk of the live site and are cited as **RUNTIME 2026-07-12 authed walk @487px**.

**Sources:** 8-reader → 5-synthesizer → completeness-critic workflow (static, path:line-cited), the critic's verified gap list (gaps #1, #2, #3, #4, #5, #7, #11 folded here), and runtime walk findings 1–7 (embedded verbatim in §8).

**Severity canon (binding, reconciled once for all artifacts):**

| Ruling | Canon |
|---|---|
| Chime-in silent failure | **P0-2** (flag LIVE; expected-contention 409s silently discarded → misleads) |
| Button.tsx contrast | **P1** (4.47:1 hair-miss vs 4.5 AA; owned by UX_STYLE_SYSTEM_AUDIT; rides PR-A) |
| useReduceMotion consumer count | **1** (grep-verified: DisagreementPointsRail only) |
| Focus management / Esc collision / corridor nav trap / MarkerPhrasePicker+RequestReviewComposer containment | **P0 cluster** — must appear in UX_ACTION_PLAN Wave 1; re-ranked here from the digest's P1/P2 entries |

**State-cell notation** (required six cells per surface): `L` loading · `E` empty · `R` error · `P` populated · `D` disabled · `S` success. `✓` = present (cited) · `✗` = missing and recorded as a defect cell · `–` = not applicable / not observed by the static pass (no claim made).

---

## 0. Shell model

No router. `AppRoot` is a 5-way priority branch (App.tsx:435-486): authCallback → unconfigured LoadingNotice → InviteRedeemGate → AuthScreen → MainAppShell. MainAppShell picks surfaces from **in-memory booleans** (tab, galleryLane, aboutOpen, demoCorridorOpen, notificationsOpen, startArgumentOpen, hasDebate). App.tsx is the sole consumer of the 11-flag registry (src/lib/featureFlags.ts); 9 flags threaded as props; the voice pair (`voice_entries`, `one_time_playback`) has zero consumers. A 12th flag lives outside the registry: `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` (googleAuthGate.ts:31,50).

Nav chrome is doubled: masthead `AppPrimaryNav` (AppHeader.tsx:48; appPrimaryNavModel.ts:40-54) + a secondary tab bar that **hides while a room is active** (App.tsx:1156-1181; roomActive App.tsx:900-901). Cross-Modal z-order = mount order only (App.tsx:544-545); no zIndex constants.

### 0.1 [P1] No browser-history/URL model on the live web platform (critic gap #3)

- **Where:** The only history-API usage in src is the auth-callback `replaceState` (AuthCallbackScreen.tsx:96-99). No pushState, no popstate, no beforeunload.
- **What:** Browser **Back exits the app from anywhere** — including mid-room with a draft. Nothing is bookmarkable. **No room has a URL.**
- **Why it matters (utility + mission):** On a web platform this breaks the most basic navigation contract users bring with them; a draft-destroying Back is data loss. It also makes the side-rail Share affordance **unfixable as specced** — there is no link to share (see §2 rail cell and critic gap #2).
- **Change:** Design card (URL model: at minimum room URLs + history entries for room open/close), owned by UX_ACTION_PLAN. Not a quick fix; sequencing decision required.
- **Risk:** Deep-linking interacts with InviteRedeemGate's URL capture (App.tsx:276-313) and the deep-link handlers (App.tsx:760-847); design must not create a second entry path that bypasses gates.
- **Test:** RUNTIME-CHECK — confirm live Back-exits-app behavior mid-room with an unsent draft (register item R-14).

### 0.2 [P1] Notification signal invisible while in a room (critic gap #7)

- **Where:** `NotificationBadge` (unread count) sits on the Arguments tab bar (App.tsx:1170-1174) — the same tab bar the shell hides while a room is active (App.tsx:1156).
- **What:** In-room, new-notification signal is invisible; the two facts were never connected by any single digest. (`useNotifications` itself is healthy-family — returns `error`.)
- **Why it matters (utility):** Rooms are the app's core dwell surface; the one place users spend time is the one place the unread signal cannot reach. Same "silent affordance" class the audit rates P1 elsewhere (critic §D calibration).
- **Change:** Surface the unread count in in-room chrome (DebateDetailHeader strip is the only persistent in-room chrome — DebateDetailHeader.tsx:6).
- **Risk:** Header density is already flagged at ~487px (RUNTIME 2026-07-12 authed walk @487px, finding 8 — owned by UX_COHESION); adding a badge must not worsen it.
- **Test:** Jest: badge renders under roomActive; a11y label announces count change.

---

## 1. Primary lanes

| Surface | Owner | Reachability | Roles | L | E | R | P | D | S |
|---|---|---|---|---|---|---|---|---|---|
| ArgumentHome ("Your table") | src/features/home/ArgumentHome.tsx:99 | gated:home_v2 (LIVE); lane='home' && arguments tab && no room/notifications/sheet/about/corridor (App.tsx:1255-1283); initial lane when flag ON (App.tsx:675-677) | any signed-in | ✓ | ✓ first-run + filtered (228-261) | ✓ retry | ✓ | – | – |
| ConversationGalleryScreen | src/features/debates/ConversationGalleryScreen.tsx:169 | visible; lane≠'home' (App.tsx:1289-1375) | any signed-in | ✓ (370) | ✓ per-lane (380) | ✓ banner tap-to-retry (373-377) | ✓ paginated | – | – |
| StartArgumentSheet | src/features/arguments/startArgument/StartArgumentSheet.tsx | gated:home_v2 && startArgumentOpen (App.tsx:1107-1114, 1222-1247); lane-swapped full surface, not an overlay | any signed-in | – | – | ✓ | ✓ | ✓ two-tap PublicArgumentToggle ceremony (1245) | – |
| StartArgumentPage (legacy) | ConversationGalleryScreen.tsx:251-257 | gated:home_v2 **OFF** only (App.tsx:1371) — one of two parallel create surfaces reachable per flag state | any signed-in | – | – | ✓ submit error (96, 416-428) | ✓ | ✓ disabled-reason line (555-563) | – |
| NotificationListScreen | src/features/notifications/NotificationListScreen.tsx | visible; arguments tab && notificationsOpen && !about && !corridor (App.tsx:1203-1214) | any signed-in | ✓ | ✓ | ✓ | ✓ (all four, 119-138) | – | – |
| DemoCorridorScreen | src/features/demoCorridor/DemoCorridorScreen.tsx:65 | visible; demoCorridorOpen (App.tsx:1189-1191); triggers: gallery toolbar + home | any signed-in | – | – | – | ✓ | – | – |
| AboutScreen | mount App.tsx:1196-1198 | visible | any signed-in | – | – | – | ✓ | – | – |
| AccountScreen | src/features/account/AccountScreen.tsx:22 | visible; tab='account' && !about (App.tsx:1673) | any signed-in | ✓ | – | ✓ + saveError (41-61) | ✓ | – | – |

**Missing-state and defect cells:**

- **ArgumentHome [P3]:** error return wipes populated content — full-screen EmptyState even when cards exist (ArgumentHome.tsx:206-217; the gallery sibling banners-over-content instead). **[info]** no "all caught up" state when yourTurn is empty but ongoing exists (263-288).
- **ConversationGalleryScreen [P1 — promoted per UX_ACTION_PLAN P1-8]:** LoadingNotice + lane EmptyState **co-render** on first load — line 380 lacks a `!loading` guard (contrast ArgumentTreeScreen.tsx:278). **[P2]** join failure feedback lands on an unmounted screen — JoinDebatePanel early-return (234-250) unmounts the banner; useDebates error (useDebates.ts:100-102) surfaces later paired with a list-retry, not a join-retry (375). **[P3]** error banner lacks a live region. **[P3]** lane ids vs bucket ids are near-identical vocabularies (10 lanes :246-256 vs 11 buckets :374-386, e.g. `source_trail` vs `source_chain_fight`); shell widens the union with 'home' (App.tsx:672-677).
- **Gallery data honesty (runtime):** cards show **"0 PARTICIPANTS"** for rooms whose own header says "3 of 5 active seats" with two visible posters — **[P1]** (RUNTIME 2026-07-12 authed walk @487px, finding 2). Smoke rooms render as ordinary content with the `[stress …]` tag **stripped from display** ("Chime cohort smoke", "Proof drawer smoke", "Settle smoke room"… — 18 rooms, only "1 duplicate run collapsed") — **[P1]** fixture leakage treatment (a) (RUNTIME 2026-07-12 authed walk @487px, finding 1). See §8 for the full three-treatment finding.
- **DemoCorridorScreen [P0 — corridor nav trap, canon re-rank from digest P1; VERIFIED in-repo]:** handlePrimaryNav (App.tsx:1028-1044) never clears demoCorridorOpen; About mount requires !demoCorridorOpen (1196) so About taps do nothing while the nav item lights; Browse/My Arguments taps change lane state invisibly (guards at 1255/1289); the corridor mount has no activeTab guard while Account (1673) and Admin (1677) lack !demoCorridorOpen → **co-render** of corridor + Account/Admin in one flex body (verified App.tsx:1189, 1673-1679). Only exit is the corridor's own Close. Detail in §9 (P0-4).
- **AboutScreen [P3]:** Back always lands on the gallery regardless of origin (handlePrimaryNav('browse_arguments'); appPrimaryNavModel.ts:188-195) — opening from Account and pressing Back does not return to Account.
- **AccountScreen [P3]:** "Profile" primary-nav item duplicates the Account tab (two nav systems, same destination); settings live in root modals, not a screen (PreferencesPopout/ProfileTagPopout, App.tsx:526-557).
- **AccountScreen [P2] debug leftover (runtime):** literal **"ADMIN? true"** row + "Contact support to change your role" placeholder (RUNTIME 2026-07-12 authed walk @487px, finding 6). Cross-ref: UX_ARTIFACT_CLEANUP_AUDIT owns removal.

### 1.1 The circles lane (cross-cutting; previously uninventoried — critic gap #1)

`src/features/circles/` (CircleFilterRow.tsx, useMyCircles.ts, circleHomeFilter.ts, circleInviteLifecycle.ts, circlesApi.ts) is **LIVE** and was absent from all 5 digests.

| Surface element | Owner | Reachability | Roles | States |
|---|---|---|---|---|
| CircleFilterRow | mounts in ArgumentHome.tsx:46,115-177 (HOME-003 #840) | visible (inside home_v2 lane) | any signed-in | has its own circle-filtered-empty state; other cells **UNAUDITED** |
| StartArgumentSheet circle-audience lane | StartArgumentSheet.tsx:76-198 (START-002 #839) | visible (inside start sheet) | any signed-in | circle target **forces private + suppresses the invite matrix** — the digest audited only PublicArgumentToggle; cells **UNAUDITED** |
| useMyCircles threading | App.tsx:746,1230,1280 | n/a (data plumbing) | — | — |

- **useMyCircles.ts:10,40-44 is a documented-intentional silent-failure hook — tag: silent-BY-DESIGN.** ("error stays null by construction; a failed read simply yields no circles.") It must be listed in the P1-2 silent-hook family census **with this by-design tag** so the family fix (UX_ACTION_PLAN PR-B, one hook-error template) neither misses it nor accidentally "fixes" it into a noisy state the design deliberately avoids. It is **not** counted as a defect cell.
- **Fixture leakage treatment (c) lands here [P1]:** the Start-sheet circles picker lists **six raw `[stress …]` circles as "Your circles"** (RUNTIME 2026-07-12 authed walk @487px, finding 1c). D8 excluded fixtures from HOME only; the picker was never covered.
- **Open question (RUNTIME-CHECK R-15):** do circle rooms change any of the 21 missing-state cells? (critic #13c — unexamined; circle rooms force-private, so at minimum the join/seat cells may differ.)

### 1.2 [P2] IA: "My Arguments" routes to the gallery, not ArgumentHome (runtime finding 7)

- **Where/What:** The "My Arguments" nav item routes to the gallery my-rooms lane, not ArgumentHome; chrome is identical to Browse. No visible nav affordance returns to the home_v2 resume-first surface — it is only the *initial* lane. Hedge copy "This link may not work…" renders even for rooms the viewer can open (RUNTIME 2026-07-12 authed walk @487px, finding 7).
- **Why it matters (utility/cohesion):** The flagship home_v2 surface becomes unreachable after one nav tap; users cannot get back to "Your table". Hedge copy on openable rooms trains users to distrust working links.
- **Change:** Give home a persistent nav affordance (or make "My Arguments" land on ArgumentHome); condition the hedge copy on actual accessibility. Owned by the fixtures/IA PR in UX_ACTION_PLAN.
- **Risk:** Nav model is doubled (masthead + tab bar, §0); fix must edit appPrimaryNavModel.ts once, not fork the two systems further.
- **Test:** Jest on appPrimaryNavModel routing; runtime re-walk of the nav loop.

---

## 2. Room complex

| Surface | Owner | Reachability | Roles | L | E | R | P | D | S |
|---|---|---|---|---|---|---|---|---|---|
| ArgumentTreeScreen (dispatcher) | src/features/arguments/ArgumentTreeScreen.tsx:166 | visible; arguments tab && hasDebate && !notifications/about/corridor (App.tsx:1385-1671) | any signed-in | ✓ initial spinner | ✓ `!loading`-gated (646-656) | ✓ banner w/ Retry + RefreshControl (264-279) | ✓ | – | – |
| FullRoomGameSurfaceMount → ArgumentRoom | ArgumentTreeScreen.tsx:419; ArgumentGameSurface.tsx:19 (re-export of room/ArgumentRoom) | visible; viewMode 'stack'/'timeline' (:211-245); DEFAULT='timeline' (viewModeCopy.ts:40) | viewerRole participant iff side ∉ {observer, moderator} (:673) | ✓ single data mount (useArgumentRoomMessages :446-456); lens switch never reloads | ✓ | see cells below | ✓ | – | – |
| ExchangeView (Cards lens) | room/ExchangeView.tsx:120 | gated:room_exchange_v2 (LIVE) → RingsideFeed, else legacy ArgumentBubbleStack (:127,157; ArgumentRoom.tsx:3030-3092, 1714-1716) | as above | – | – | – | ✓ | – | – |
| MapView (Timeline lens, default) | room/MapView.tsx:119 | visible; fed by buildArgumentTimelineMap (ArgumentRoom.tsx:903); density threading (App.tsx:1481) | as above | – | – | – | ✓ | – | – |
| DebateDetailHeader (room strip) | DebateDetailHeader.tsx:6 | visible; the **only** room exit (tab bar hidden while roomActive, App.tsx:1156) | all; creator gets Settle; overflow: invite + make-private + dev chips | – | – | ✗ settle/reopen error fidelity (P3, below) | ✓ | – | ✗ silent success (orphaned toast, §3) |
| Composers (ArgumentComposerDock + ArgumentEntryComposer) | App.tsx:1538-1550; 1559-1586 (one-bar gated:room_exchange_v2) | visible when roomAcceptsMoves = open\|draft (907-908); Source slot → ProofDrawer (gated:proof_drawer, 1654-1669); marker chip (gated:timestamp_rebuttals); Callback slot (gated:quote_forge) | participants | – | – | ✓ client validation + server blocking errors inline (ComposerValidationPanel.tsx:110-119; ArgumentEntryComposer.tsx:425-431; ArgumentComposer.tsx:654-657) | ✓ | ✓ | ✓ draft recovery notice |

**In-room chrome** (ArgumentRoom.tsx:2943-3829): ArgumentStateRail (exchange_v2), ChimeInGovernanceSurface + Affordance (chime_in; null unless viewer is initiator/primary opponent with targets, ChimeInGovernanceSurface.tsx:103-105), micro-moment banner (:3005-3020), TimelineSelectedReadoutPanel, Act/Inspect/Go popouts, SelectedNodeInspectDrawer, DisagreementPointsRail, OpenIssuesRail, ArgumentSideActionRail, DeletionRequestSheet, MarkerPhrasePickerSheet. Own-bubble = qualifiers + request-deletion only. MCP-019 referee wired but off by default (:500-567).

### 2.1 Room missing-state cells — the silent-hook family + silent writes

| Sev (canon) | Cell | Citation |
|---|---|---|
| **P0-2** | **Chime-in attach/retract failure fully silent** (merged, two readers agree): handleChimeInAttach/Retract check res.ok only to refetch (ArgumentRoom.tsx:1019-1042); chimeInApi.ts:102/127 plain-language errorMessage (seats_full, room_private, not_author…) **discarded**; ChimeInAffordance has busy state only. seats_full/room_private are *normal contention paths* (Edge 409s) — flag is LIVE. Detail §9 (P0-2). | ArgumentRoom.tsx:1019-1042; chimeInApi.ts:102,127 |
| **P1** | **Rail join failure resolves to no-op**: onJoinSide handles 'select_side'/'full_room_observe' only (App.tsx:1483-1498); resolveJoinSideEffect maps 'unavailable'/'error' → {kind:'none'} (seatClaimModel.ts:333-340); the error lands in the gallery banner, unmounted while in-room. room_full has an a11y announcement; genuine error has nothing. | App.tsx:1483-1498; seatClaimModel.ts:333-340 |
| **P1** | **Proof items read error renders as "no sources"**: setMap({}) on error, no error field (useProofItems.ts:66-69); loading flag returned but unused (ArgumentRoom.tsx:846). Misreads directly against the evidence-debt doctrine — a sourced move appears source-less. proof_drawer LIVE. | useProofItems.ts:66-69; ArgumentRoom.tsx:846 |
| **P1** | **Side-rail "Share" is a production no-op** (critic gap #2; primary owners: UX_ARTIFACT_CLEANUP_AUDIT + UX_ACTION_PLAN Wave 1): ArgumentRoom.tsx:2396 routes `code === 'share'` to `onShareRoom?.()`; **no caller anywhere supplies `onShareRoom`** (App.tsx, ArgumentTreeScreen — nothing). The rail model (ArgumentSideActionRail.tsx:86-100) promises "opens a native/browser share sheet". Share is in the observer expanded set — every observer sees a button that silently does nothing. (`watch` is a *documented* no-op at :2395 — fine.) Note: "fix" is blocked on §0.1 — there is no room URL to share. | ArgumentRoom.tsx:2396; ArgumentSideActionRail.tsx:86-100 |
| P2 | Markers read error drops rebuttal chips silently — scoped replies lose their visible anchor; timestamp_rebuttals LIVE. | useMarkers.ts:68-71 |
| P2 | Move-marks read error zeroes the room aggregate; write path is exemplary (optimistic + revert + quiet note w/ live region, BooleanFeedbackBar.tsx:151-176) — read/write asymmetry. | useMoveMarks.ts:95-97; ArgumentRoom.tsx:1044-1047 |
| P2 | Chime contributions read error **frees all seats** — offers "Chime in" on a full point which then 409s silently (compounds P0-2). | useChimeInContributions.ts:75-78 |
| P3 | Linked-prior staleness strip designed, never wired: LINKED_PRIOR_COULD_NOT_REFRESH exported "for the room shell's error strip", zero importers. | useLinkedPriorRooms.ts:221; linkedPriorArgumentCopy.ts:58 |
| P3 | microMoment banner: no dismiss control, clears on first timeline interaction, never announced to SR. | ArgumentRoom.tsx:2996-3020 |
| P3 | Settle/reopen failures always render network copy — res.error discarded (DebateDetailHeader.tsx:288-291; RoomSettledNotice.tsx:45-49); useDebates.ts:124,142 also double-writes into list error, which can pop the gallery banner later. | DebateDetailHeader.tsx:288-291 |
| P2 | Settle confirm mounted **without** reduceMotion (DebateDetailHeader.tsx:525-532) while the reopen path passes it (RoomSettledNotice.tsx:94). (useReduceMotion consumer count = **1**, per canon.) | DebateDetailHeader.tsx:525-532 |
| info | Chime governance reactions are session-ephemeral by design with no "this session only" cue (useChimeInGovernance.ts:4-15). No skeleton/layout-reserve anywhere; proof/marker/chime chips pop in post-paint (LoadingNotice.tsx:8-15). | useChimeInGovernance.ts:4-15 |

**Auth-expiry amplifier (critic gap #11 → RUNTIME-CHECK R-13):** no digest asked what renders when the JWT expires mid-room. Every silent read-hook above fails *simultaneously* — the room would quietly degrade to "no sources, no markers, no marks, seats open". This is the most probable real-world trigger of the whole silent-hook family and strengthens its P1 rating.

### 2.2 UNAUDITED-CELLS — SelectedNodeInspectDrawer composite (critic gap #4)

The drawer is name-dropped in the room chrome list, but its composite (**ArgumentRoom.tsx:3517-3587**) received **zero state/a11y coverage**:

| # | Component | Provenance | Status |
|---|---|---|---|
| 1 | MediatorNodeInspectDetail | — | UNAUDITED-CELLS |
| 2 | NodeLabelInspectGroups | UX-001.5A Observation/Allegation separation | UNAUDITED-CELLS |
| 3 | MetadataDiffInspector | META-1E | UNAUDITED-CELLS |
| 4 | InspectOpenIssueDetail | REF-004 | UNAUDITED-CELLS |
| 5 | MediatorProgressNote | — | UNAUDITED-CELLS |
| 6 | MediatorNextMovesCard | — | UNAUDITED-CELLS |

This drawer is the exact surface the cohesion P1-6 "visible provenance" fix targets; **writing that card without auditing the drawer risks a wrong insertion point** (flagged to UX_ACTION_PLAN PR-C). Also unaudited: `usePointTagsRealtime` disconnect/reconnect states (mentioned only as a logger issue).

### 2.3 UNAUDITED-CELLS — InvitePanel + RoomContractSeatStrip (critic gap #5)

- **InvitePanel** mounts at **App.tsx:1418** — *outbound* invite creation. Spot-check: healthy-shaped hook `{invites, loading, error, lastInviteLink, create, revoke, refresh}` — likely fine, but **create/revoke failure UX unverified**. The map covered InviteRedeemGate (inbound) but not invite *creation*. Status: UNAUDITED-CELLS.
- **RoomContractSeatStrip** mounts in **DebateDetailHeader.tsx** and is distinct from the audited SeatAvailabilityStrip. Status: UNAUDITED-CELLS.

### 2.4 In-room runtime findings (RUNTIME 2026-07-12 authed walk @487px)

- **[P1] Fixture leakage treatment (b):** inside a room the **RAW tag renders in the title** ("Chime cohort smoke [stress chime-mrgpodh6]") — inconsistent with the gallery's stripped treatment (finding 1, §8).
- **[P1] Competing open-counts:** state rail "**7 open points**" vs mediator strip "**Open issues · 4**" on the same screen, no explanation of the difference (finding 3). Detail §9.
- **[P2] Role-copy mismatch:** creator/Initiator of an empty room sees rail state "You are watching this argument / Watching" plus a "Watch ▾" observer control, while the overflow says "You are the Initiator" and the composer accepts posts (finding 4). Contradictory role signals on one screen undermine the seat model's legibility.
- **[P2] "Public 1:1" labels a 5-seat room** (finding 5) — naming/contract mismatch between the room-type label and the seat contract shown beside it.

---

## 3. Overlays

### 3.1 Systemic

- **[P0-1] Zero programmatic focus management on RN-web (live platform):** no .focus()/focus trap/focus return anywhere in src (only ContactInfoSection autoFocus inputs); every "trap" claim rests on `accessibilityViewIsModal` (Popout.tsx:208,241; ArgumentComposerDock.tsx:524,546; PreSendReviewSheet.tsx:205,219; AddAnnotationSheet.tsx:136; RequestReviewComposer.tsx:176), which is **iOS-only** and not mapped to aria-modal by react-native-web. Keyboard/SR users tab behind every modal — WCAG 2.4.3/2.1.2 exposure across all 11 Modals. Detail §9.
- **[P0-3, canon re-rank from digest P1] Escape collision:** resolveComposerKeyEffect returns 'close' unconditionally (composerKeyboardModel.ts:102-104); the dock's document keydown (ArgumentComposerDock.tsx:296-335) closes the dock while ActPopout (own Esc listener, Popout.tsx:166-180, no stopPropagation) or PreSendReviewSheet is layered above — one Esc plausibly dismisses both, defeating the inert-scrim draft-protection grammar (PreSendReviewSheet.tsx:208-215). RUNTIME-CHECK R-2 to confirm double-fire.
- **[P3] Scrim grammar is 3 undocumented dialects:** scrim-dismiss (Popout :214-224 AT-hidden; AddAnnotationSheet :125-131 labelled-Close — the better pattern), scrim-inert (dock :530-542, PreSendReview :208-215), backdrop-non-interactive (all confirms + bottom sheets). Defensible split by surface weight; document it and standardize AT exposure (maintainability/a11y).

### 3.2 True Modals (11)

| Modal | Owner / gate | Notes + cells |
|---|---|---|
| Popout chassis (Act/Inspect/Go) | oneBox/Popout.tsx:203 | Reference chassis: reduce-motion aware, Esc, scrim tap, 44px close |
| ArgumentComposerDock | :519 | Inert scrim, reduce-motion; hosts PacingChip/PreSendReview |
| RoomSettleConfirmation | RoomSettleConfirmation.tsx:76 | **The house confirm grammar**: alert role, consequence bullets, busy state, reduceMotion prop |
| MakePrivateConfirmation | MakePrivateConfirmation.tsx:72, 18-24 | **[P2]** hardcodes fade, no reduceMotion prop at all |
| DeletionRequestSheet | DeletionRequestSheet.tsx:47-49, 68-83 | **[P1 — aligned to UX_TRANSITION_MAP F4 resolution]** hardcodes slide, no reduceMotion; slug a11y labels read verbatim by SR ("deletion-request-sheet") |
| AddAnnotationSheet | evidence/AddAnnotationSheet.tsx:117 | Best-practice sheet: labelled scrim-close, Esc, live-region error |
| LinkTargetPickerSheet | LinkTargetPickerSheet.tsx:144-148 | gated:quote_forge; consistent |
| CallbackCaptureSheet | CallbackCaptureSheet.tsx:63 | gated:quote_forge; consistent |
| PreferencesPopout | App.tsx:526-557 | Mount-order stacking is the app's only z-order contract |
| ProfileTagPopout | App.tsx:526-557 | Same; focus-return comment-asserted only (RUNTIME-CHECK R-7) |
| RoomUnavailableNotice | RoomUnavailableNotice.tsx:37-45 | **[P3]** only centered notice with neither alert role nor accessibilityViewIsModal |

### 3.3 Absolute non-Modal overlays (3)

| Overlay | Owner | Cells |
|---|---|---|
| PreSendReviewSheet | PreSendReviewSheet.tsx | Deliberately in-dock so the draft survives; correct dismiss grammar. **[P3]** only light-palette surface in a dark app (:392-399) — cohesion defect, not merely aesthetic (breaks the room's visual register mid-flow) |
| MarkerPhrasePickerSheet | markers/MarkerPhrasePickerSheet.tsx:51-129, 60-69; ArgumentRoom.tsx:2784, 2852 | **[P0-5a, canon re-rank from digest P2]** single dismiss path (Cancel only), no onRequestClose/Esc/backdrop/dialog semantics, AND excluded from hasOpenMenu so room keyboard shortcuts fire behind it. Part of the P0 containment cluster — detail §9 |
| RequestReviewComposer | RequestReviewComposer.tsx:172-176, 307; ArgumentRoom.tsx:2784 | **[P0-5b, canon re-rank from digest P2]** same containment pattern — detail §9 |

### 3.4 In-flow panels/banners (~19, incl. the two newly inventoried in §2.3)

ProofDrawer (in-flow by design, never blocks reply; **[P3]** no Esc close on web; ProofDrawer.tsx:157-171, 78-79) · TimelineNodePopover (x-close only; hosts nested AddAnnotationSheet correctly, TimelineNodePopover.tsx:260-277, 337-348) · SourceChainPopover — **[P3]** doc promises role='dialog', code renders 'none' (SourceChainPopover.tsx:19 vs 297) · MapNodeActionPopover + SidecarLinks (healthy, MapNodeActionPopover.tsx:66-176) · BooleanFeedbackBar (**healthy**, gated:move_marks; BooleanFeedbackBar.tsx:76-176) · PacingChip (**healthy**; light palette in dark dock noted; PacingChip.tsx:70-76) · CallbackDraftEcho + ComposerDraftRecoveryNotice (**healthy**; Discard is single-tap destructive, mitigated) · callback link-retry banner (**[P3]** no dismiss-without-retry, App.tsx:1630-1645) · RoomSettledNotice (inline, reopen confirm + error, RoomSettledNotice.tsx:59-85) · microMoment banner (§2.1) · gallery error banner · SemanticOverrideChoiceSheet (dormant, confirm-as-dismiss intentional, SemanticOverrideChoiceSheet.tsx:101-130) · **InvitePanel (App.tsx:1418 — §2.3, UNAUDITED-CELLS)** · **RoomContractSeatStrip (DebateDetailHeader.tsx — §2.3, UNAUDITED-CELLS)**.

**[P2] Orphaned toast copy / silent success:** confirmation_post_action_toast + settle_toast defined (gameCopy.ts:1746, 1822) with **no toast surface anywhere** — make-private/settle success is conveyed only by state change. Build a polite live-region strip or delete the keys.

---

## 4. Admin

| Surface | Owner | Reachability | Roles | L | E | R | P | D | S |
|---|---|---|---|---|---|---|---|---|---|
| AdminScreen (10 sub-tabs: Users+detail, View As, History, Blocks, Bot Users, Arguments, Debates, Metadata Events, Semantic Referee, Classifier Health) | src/features/admin/AdminScreen.tsx:17-28 | admin-only: tab='admin' && profiles.role='admin' (App.tsx:1677-1679); excluded from public nav + FORBIDDEN_PUBLIC_NAV_TOKENS (appPrimaryNavModel.ts:28-30, 211-235) | admin | ✓ | ✓ + filtered-empty | ✓ error-with-detail | ✓ | – | ✓ save paths (AdminSemanticRefereeTab.tsx:354-356) |

Uniform state coverage with a11y labels: AdminArgumentsTab.tsx:923-942; AdminDebatesTab.tsx:378-395; AdminMetadataEventsTab.tsx:261-278; AdminSemanticRefereeTab.tsx:160-176; AdminHistoryTab.tsx:53-78; AdminBlocksTab.tsx:111-131; AdminUsersTab.tsx:81-122; AdminClassifierHealthTab.tsx:110-118. inactiveReason structurally omitted (types.ts:222-235).

**Missing cells:**

- **[P2]** "Open timeline" silent no-op when the debate id is outside the admin's loaded slice (App.tsx:806-812) — siblings show RoomUnavailableNotice (:782-791, :840-847). Third confirm-affordance inconsistency across deep-link handlers.
- **[P2]** Bulk confirm is an inline faux-dialog — no Modal/scrim/Esc/containment, slug a11y label (AdminDebatesTab.tsx:319-368, 322); third confirm grammar alongside Modal+alert and AdminUserDetailPanel's checkbox gate (37, 78-83, 202-207). Reuse RoomSettleConfirmation.
- **[P3]** Metadata-events selector failure masquerades as empty — "No debates have tag activity yet." for a failed read (AdminMetadataEventsTab.tsx:80-82, 139).

**SessionDebugPanel** — tab='debug' && `__DEV__` only (App.tsx:1681; roomNavigation.ts:23). Reachability: dev-only. Prod absence via dead-code elimination = RUNTIME-CHECK R-6.

---

## 5. Auth & entry

| Surface | Owner | Reachability | Roles | L | E | R | P | D | S |
|---|---|---|---|---|---|---|---|---|---|
| AppRoot router | App.tsx:435-486 | visible (shell) | all | ✓ unconfigured LoadingNotice | – | – | ✓ | – | – |
| AuthCallbackScreen | src/features/auth/AuthCallbackScreen.tsx | visible; web-only, sync activation (App.tsx:225-229) | signed-out | ✓ never-stuck spinner | – | ✓ expired/generic (118-191) | ✓ | – | ✓ |
| AuthScreen | AuthScreen.tsx:116 | visible | signed-out | – | – | ✓ bad credentials, unconfigured env (98-119, 194) | ✓ signin/signup | – | ✓ email-sent confirmation (107) |
| InviteRedeemGate (+ InviteCredentialStep) | invites/InviteRedeemGate.tsx | visible (URL-only reachability); mounts above everything on pendingInviteIntent (App.tsx:456-473, capture 276-313) | signed-out/in | ✓ | – | ✓ | ✓ | – | ✓ escape hatch in every non-pending state (:29-30) |

Bare AppHeader only for callback/unconfigured/invite (App.tsx:504-507, 522-524); signed_out deliberately mastheadless. Native scheme capture is an acknowledged follow-up (App.tsx:272-275).

**Missing cell — [P1] Google sign-in initiation failure silent:** `void signInWithGoogle()` (AuthScreen.tsx:248-250, comment 234-236); signInWithGoogle.ts:29-70 returns {ok:false, message} for config_missing/OAuth/transport, all discarded; displayError covers email/password only (113). Front door of the app; flag ON on the dev prod host. **Change:** feed result.message into the existing ErrorNotice (194). **Risk:** minimal — existing surface. **Test:** jest on the failure branch; live OAuth smoke remains operator-gated.

---

## 6. Dormant / stubbed

| Item | Owner | Reachability | Notes |
|---|---|---|---|
| Voice pair flags (`voice_entries`, `one_time_playback`) | featureFlags.ts:120, 136, 223-241 | dormant (resolvable, **zero consumers**, no voice UI component in src) | The "one-time-playback gate pattern" does not exist yet (consistent with VOICE-ADR-002 gating). Pre-registered recommendation: adopt RoomSettleConfirmation grammar (Modal + alert + consequence bullets + reduceMotion + busy) when VOICE-* ships, to avoid a fourth confirm dialect |
| oneToOneRoomModel / oneToOneRoomLifecycle | debates/index.ts:97, 123, 128 | stubbed (barrel-only exports, test-consumed only) | chimeAffordanceVisible hardcoded false (docs/reviews/UX-ROOM-1V1-CHIMEIN-001A.md:56). Awaiting GATE-C. Note the naming collision with runtime finding 5 ("Public 1:1" labeling a 5-seat room) — the 1:1 vocabulary is already leaking into live labels |
| SemanticOverrideChoiceSheet | SemanticOverrideChoiceSheet.tsx:128-130 | dormant (MCP-019 surface; renders null unless prompt.shouldOffer; mcp slot dormant) | — |
| 'tree' view mode | ArgumentTreeScreen.tsx:247-323 | dev-only (`__DEV__` chip, App.tsx:1403) | **[P3]** compiled into bundle. Consequence: FlagSummary color-only blocking/advisory distinction (FlagSummary.tsx:13-20) is prod-moot — only consumer is this dev-only lens; keep as P3-dormant, fix or retire with the lens |
| ArgumentTimelineScreen ('tracks') | ArgumentTreeScreen.tsx:192-205 | dev-only (dev chip) | **[P3]** |
| DevEnvironmentBanner | DevEnvironmentBanner.tsx:27-68 | dormant (built + tested, mount removed by operator opt-out, App.tsx:509-512) | **[P3]** intentional |
| Toast copy keys | gameCopy.ts:1746, 1822 | dormant copy | See §3.4 P2 |

---

## 7. Dead / unreachable

- **DebateListScreen — [P2, VERIFIED in-repo]: dead.** grep confirms importers are only the barrel (debates/index.ts:1) and tests (DebateListScreen.visibility.test.tsx, debateListSort.test.ts, responsiveTableFill.test.ts, argumentInactiveLeakageScan.test.ts) — never mounted; App.tsx imports only DebateDetailHeader/RoomSettledNotice/hooks from the barrel. Retired by Stage 6.3 gallery. Its internal states are healthy but moot; the "add tappable retry" P3 from the overlay pass is **absorbed** — recommendation is delete/annotate + drop barrel export (its JoinDebatePanel mount at :298 keeps that tree compiled). Cross-ref: UX_ARTIFACT_CLEANUP_AUDIT owns the census.
- **COPY-001 first-run explainer** — could not be located as an overlay in src/features/mediator; ArgumentHome.firstRunHeadline (:377) is an empty-state, not an overlay. RUNTIME-CHECK R-8 / git-history item.

---

## 8. Runtime walk findings 1–7 (embedded verbatim — RUNTIME 2026-07-12 authed walk @487px)

1. **Fixture leakage, three inconsistent treatments (P1, misleads users):** (a) Browse gallery shows smoke rooms as ordinary content with the `[stress …]` tag STRIPPED from display ("Chime cohort smoke", "Proof drawer smoke", "Settle smoke room"… — 18 rooms, only "1 duplicate run collapsed"); (b) inside a room the RAW tag renders in the title ("Chime cohort smoke [stress chime-mrgpodh6]"); (c) the Start-sheet circles picker lists six raw `[stress …]` circles as "Your circles". D8 excluded fixtures from HOME only; Browse/room/picker were never covered.
2. **Gallery participant-count broken (P1):** cards show "0 PARTICIPANTS" for rooms whose own header says "3 of 5 active seats" and which visibly have two posters.
3. **Competing open-counts (P1 comprehension):** state rail "7 open points" vs mediator strip "Open issues · 4" on the same screen, no explanation of the difference.
4. **Role-copy mismatch (P2):** creator/Initiator of an empty room sees rail state "You are watching this argument / Watching" plus a "Watch ▾" observer control, while the overflow says "You are the Initiator" and the composer accepts posts.
5. **"Public 1:1" labels a 5-seat room (P2 naming).**
6. **Account surface debug leftover (P2):** literal "ADMIN? true" row + "Contact support to change your role" placeholder. *(Cross-ref: removal owned by UX_ARTIFACT_CLEANUP_AUDIT.)*
7. **IA: "My Arguments" nav routes to the gallery my-rooms lane, not ArgumentHome (P2):** identical chrome to Browse; no visible nav affordance returns to the home_v2 resume-first surface (it is only the initial lane). Hedge copy "This link may not work…" renders even for rooms the viewer can open.

---

## 9. Major findings — where / what / why / change / risk / test

**P0-1 — Focus management absent on RN-web**
- *Where:* All 11 Modals + 3 absolute overlays; anchors Popout.tsx:208,241; ArgumentComposerDock.tsx:524,546; PreSendReviewSheet.tsx:205,219; AddAnnotationSheet.tsx:136; RequestReviewComposer.tsx:176. Zero `.focus(` in src (grep-verified by the critic).
- *What:* No focus trap, no focus move on open, no focus return on close; `accessibilityViewIsModal` is iOS-only and not mapped to aria-modal by react-native-web.
- *Why:* Live platform is web. Keyboard and SR users tab behind every modal — WCAG 2.4.3/2.1.2. This is the audit's unanimous top-severity item (a11y).
- *Change:* Small web focus utility in the Popout chassis + Modal sheets (one utility, reused — maintainability).
- *Risk:* Focus-return interacts with the mount-order z-contract (App.tsx:544-545) and the ProfileTag→Preferences stack (RUNTIME-CHECK R-7).
- *Test:* RUNTIME-CHECK R-3 (Tab/SR behind each Modal on dev-cdiscourse.netlify.app); jest on the utility.

**P0-2 — Chime-in attach/retract silent failure** *(canon ruling; digest had P1)*
- *Where:* ArgumentRoom.tsx:1019-1042; chimeInApi.ts:102,127. Flag chime_in LIVE.
- *What:* res.ok checked only to refetch; the API's plain-language errorMessage (seats_full, room_private, not_author…) discarded; affordance shows busy state only.
- *Why:* seats_full/room_private are *normal contention outcomes* (Edge 409s), not rare faults — users take an action the product invites and get silence; compounded by useChimeInContributions.ts:75-78 freeing all seats on read error (offers a seat that then 409s silently). Misleads users → P0 (mission: honest state).
- *Change:* Surface errorMessage in the affordance (the plain-language strings already exist in chimeInApi.ts).
- *Risk:* Low — display-only; copy already written.
- *Test:* Jest on both handlers' failure branches; live 409 smoke (seats_full path already exercised by the P8 smokes).

**P0-3 — Escape collision (dock under popout)** *(canon cluster; digest had P1)*
- *Where:* composerKeyboardModel.ts:102-104; ArgumentComposerDock.tsx:296-335; Popout.tsx:166-180.
- *What:* Two document-level Esc listeners, no stopPropagation; one Esc plausibly dismisses both layers, defeating PreSendReviewSheet's inert-scrim draft protection (:208-215).
- *Why:* Draft protection is the point of the inert scrim; a keyboard user can lose the protective layer + dock in one keystroke (a11y + data-loss adjacent).
- *Change:* Layer-aware Esc handling (topmost-consumes; stopPropagation or a shared key-owner registry in the dock model).
- *Risk:* Keyboard-shortcut model spans room shortcuts too (hasOpenMenu, ArgumentRoom.tsx:2784) — fix must cover P0-5's exclusion bug in the same pass.
- *Test:* RUNTIME-CHECK R-2 (confirm double-fire live); jest on resolveComposerKeyEffect layering.

**P0-4 — Demo-corridor nav trap + co-render** *(canon cluster; digest had P1, VERIFIED in-repo)*
- *Where:* App.tsx:1028-1044 (handlePrimaryNav), 1189-1191 (corridor mount), 1196 (About guard), 1255/1289 (lane guards), 1673-1679 (Account/Admin lack !demoCorridorOpen).
- *What:* Primary nav never clears demoCorridorOpen: About taps do nothing; Browse/My Arguments change state invisibly; Account/Admin **co-render with the corridor in one flex body**. Only exit is the corridor's own Close.
- *Why:* A first-run/demo surface that traps global nav is a hard dead-end for exactly the newest users (utility).
- *Change:* Clear corridor in handlePrimaryNav and/or gate the corridor mount on activeTab==='arguments'.
- *Risk:* Low — additive guards; verify no other surface relies on corridor persistence.
- *Test:* Jest on handlePrimaryNav clearing; RUNTIME-CHECK R-4 (co-render visual outcome: stacked vs overlapped).

**P0-5 — Containment: MarkerPhrasePickerSheet + RequestReviewComposer** *(canon cluster; digest had P2)*
- *Where:* markers/MarkerPhrasePickerSheet.tsx:51-129, 60-69; RequestReviewComposer.tsx:172-176, 307; ArgumentRoom.tsx:2784, 2852.
- *What:* Absolute overlays with a single dismiss path (Cancel only), no onRequestClose/Esc/backdrop/dialog semantics, and **excluded from hasOpenMenu** so room keyboard shortcuts fire behind them.
- *Why:* Keyboard users can mutate the room underneath an open sheet (a11y + state honesty); pairs with P0-1/P0-3 as one containment cluster.
- *Change:* Give both the Modal-sheet chassis treatment (or Popout chassis) + hasOpenMenu inclusion.
- *Risk:* Marker flow is scoped-reply-bearing (timestamp_rebuttals LIVE) — regression-test the scoped reply path.
- *Test:* Jest: shortcuts suppressed while open; Esc closes; RUNTIME-CHECK R-3 covers SR.

**P1 — Google sign-in silent failure** — §5. Front door; feed the existing {ok:false, message} into ErrorNotice (AuthScreen.tsx:194).

**P1 — Rail join failure no-op** — §2.1. Map 'unavailable'/'error' (seatClaimModel.ts:333-340) to an in-room notice; today the error lands in an unmounted gallery banner.

**P1 — Proof items silent-empty** — §2.1. Evidence rendered source-less on a failed read contradicts evidence-debt doctrine; worst member of the silent-hook family (UX_ACTION_PLAN PR-B template). Remember the **by-design exception**: useMyCircles (§1.1) must not be swept into this fix.

**P1 — Share no-op** — §2.1 (critic gap #2). Fix-or-remove; "fix" is blocked on the URL model (§0.1). Until a room URL exists, remove/disable with honest copy.

**P1 — Notification badge invisible in-room** — §0.2.

**P1 — Fixture leakage ×3 treatments** — §8 finding 1. *Change:* one shared fixture-exclusion predicate (D8 covered HOME only) applied to Browse, room title, and the circles picker; decide strip-vs-exclude once. *Risk:* smoke tooling relies on finding its rooms — exclusion must be display-side only. *Test:* runtime re-walk of all three surfaces; jest on the predicate.

**P1 — Participant count 0-vs-3of5** — §8 finding 2. *Change:* root cause not established by the static pass; investigate the gallery card's participant derivation against the room header's seat count and fix the honest source. *Risk:* two different counters may be counting different populations (see next item) — fix must name what it counts. *Test:* card count equals room-header seat count on the same room, live.

**P1 — Competing open-counts (7 vs 4)** — §8 finding 3. *Change:* reconcile the state rail's "open points" and the mediator strip's "Open issues" to one derivation, or label both with what they count. *Why:* comprehension — two authoritative-looking numbers disagreeing on one screen teaches users to trust neither. *Risk:* the two figures may be legitimately different metrics; if so the fix is labeling, not merging. *Test:* jest on a shared derivation; live re-check.

---

## 10. Ranked findings index (canon-reconciled)

**P0 (6):** focus management absent on RN-web (Popout.tsx:208 et al.) · chime-in silent failure P0-2 (ArgumentRoom.tsx:1019-1042) · Esc collision (composerKeyboardModel.ts:103) · demo-corridor nav trap + co-render (App.tsx:1028/1189/1673-1679) · MarkerPhrasePickerSheet containment (:51) · RequestReviewComposer containment (:172).

**P1 (13):** Google sign-in silent (AuthScreen.tsx:248) · rail join no-op (App.tsx:1483; seatClaimModel.ts:333-340) · proof-items silent-empty (useProofItems.ts:66) · Share no-op (ArgumentRoom.tsx:2396, critic #2) · notification badge invisible in-room (App.tsx:1170-1174 vs 1156, critic #7) · no-URL/browser-Back model (AuthCallbackScreen.tsx:96-99 sole history use, critic #3) · fixture leakage ×3 (RUNTIME finding 1) · participant count 0-vs-3of5 (RUNTIME finding 2) · competing open-counts (RUNTIME finding 3) · *(style artifact)* Button.tsx contrast per canon · gallery loading+empty co-render (ConversationGalleryScreen.tsx:370/380, promoted per ACTION_PLAN P1-8) · DeletionRequestSheet slide+slug labels (DeletionRequestSheet.tsx:47, aligned to TRANSITION F4).

**P2 (14):** join-panel displaced error (:234) · useMarkers silent (:68) · useMoveMarks read silent (:95) · useChimeInContributions silent (:75) · settle confirm w/o reduceMotion (DebateDetailHeader.tsx:525) · MakePrivateConfirmation no reduce-motion (:72) · admin bulk faux-dialog (AdminDebatesTab.tsx:319) · admin Open-timeline silent no-op (App.tsx:806) · orphaned toast copy / silent success (gameCopy.ts:1746,1822) · dead DebateListScreen (index.ts:1) · Initiator-sees-Watching (RUNTIME finding 4) · "Public 1:1" on 5 seats (RUNTIME finding 5) · ADMIN? true debug leftover (RUNTIME finding 6) · My-Arguments IA + hedge copy (RUNTIME finding 7).

**P3 (17):** About back asymmetry · dual-nav duplication · lane/bucket vocab · ArgumentHome error-wipes-content · settle/reopen error fidelity · linked-prior strip unwired · microMoment SR gap · gallery move-marks silent · PreSendReview light palette · callback banner no dismiss · ProofDrawer no Esc · SourceChainPopover doc drift · RoomUnavailableNotice role gap · scrim 3-dialect doc gap · admin metadata selector fail-as-empty · FlagSummary (dev-lens-moot) · tree/tracks/DevEnvironmentBanner dormancy.

**Info:** all-caught-up state · skeletons absent · chime governance ephemerality cue · **useMyCircles silent-BY-DESIGN (family census entry, not a defect)** · healthy-baseline inventory (the states reader's "verified healthy" list stands as the house template: hook returns {data, loading, error, refetch}; screen renders banner-over-stale-content).

No purely aesthetic recommendations appear in this artifact; every item above states a utility, comprehension, a11y, maintainability, or mission rationale. (SUBJECTIVE DESIGN DIRECTION items live in UX_COHESION_AND_MISSION_REVIEW.)

---

## 11. Counts

| Metric | Count | Composition |
|---|---|---|
| **Screen-level surfaces** | **21** | 16 live-reachable (AuthScreen, AuthCallback, InviteRedeemGate, MainAppShell, ArgumentHome, Gallery, StartArgumentSheet, Notifications, DemoCorridor, About, Account, Admin ×10 sub-tabs, room dispatcher, ExchangeView, MapView, DebateDetailHeader strip) · 1 legacy-flag fallback (StartArgumentPage) · 3 dev-only (SessionDebugPanel, tree, tracks) · 1 dead (DebateListScreen). The circles lane (§1.1) adds components inside existing surfaces, not new screens |
| **Overlay-class elements** | **33** | 11 true Modals · 3 absolute non-Modal overlays · ~19 in-flow panels/popovers/banners (digest's ~17 + InvitePanel + RoomContractSeatStrip newly inventoried per critic #5) |
| **Missing-state cells** | **23 active** | Digest's 21 (re-bucketed per canon: 6 now split across P0/P1, 8 P2, 7 P3/info) + 2 new from the critic (Share no-op P1, notification badge P1). Plus 1 **by-design** (useMyCircles — tagged, not counted) and 1 **moot** (DebateListScreen retry, absorbed by dead-code recommendation) |
| **Runtime product findings** | **7** | Findings 1–7 (§8): 3×P1 (fixture leakage, participant count, open-counts), 4×P2 (role copy, 1:1 naming, ADMIN? true, My-Arguments IA) — data-honesty/IA class, tracked separately from state cells |
| **UNAUDITED cells** | **10** | 6 SelectedNodeInspectDrawer children (§2.2) · usePointTagsRealtime disconnect/reconnect (§2.2) · InvitePanel create/revoke failure UX (§2.3) · RoomContractSeatStrip (§2.3) · circle-room delta over the state-cell inventory (§1.1 / critic #13c) |

---

## 12. RUNTIME-CHECK register (carried + extended)

Items R-1…R-12 are carried from the static digest; R-13…R-16 are added by the critic and the runtime walk's own coverage gaps. The 2026-07-12 walk was **authed as an admin (kyleruff+devtests1) at ~487px** — items below remain open unless noted.

| # | Check | Source |
|---|---|---|
| R-1 | Live flag values (9-ON/2-dark split is from context, not source) | digest |
| R-2 | Esc double-dismiss: dock + Popout dual document listeners; whether RN-web Modal fires onRequestClose on Escape (affects backdrop-inert confirms' keyboard dismissal) | digest → feeds P0-3 |
| R-3 | Focus/Tab/SR behavior behind every Modal on dev-cdiscourse.netlify.app (confirm accessibilityViewIsModal is a no-op on RN-web) | digest → feeds P0-1 |
| R-4 | Demo-corridor + Account/Admin co-render visual outcome (stacked vs overlapped) | digest → feeds P0-4 |
| R-5 | Gallery LoadingNotice+EmptyState first-paint visibility (above/below fold; SR announcement) | digest |
| R-6 | `__DEV__` dead-code elimination in the deployed bundle (Debug tab, tree/tracks chips) | digest |
| R-7 | ProfileTagPopout close → PreferencesPopout context/focus return (comment-asserted only, App.tsx:544-545) | digest |
| R-8 | COPY-001 first-run explainer — locate or confirm removed | digest |
| R-9 | Silent-hook failure frequency (no telemetry; P1/P2 ratings assume network-loss/auth-expiry occurrence) | digest |
| R-10 | Semantic-referee enabled-mode failure path (silent fallback verified for disabled mode only, ArgumentRoom.tsx:494-499) | digest |
| R-11 | Whether raw internal codes can ever reach a rendered surface past gameCopy.toPlainLanguage | digest |
| R-12 | Native-lane items (hardware back on MarkerPhrasePickerSheet/RequestReviewComposer, scheme-based invite capture) — deferred; live platform is RN-web | digest |
| R-13 | **Global auth-expiry cascade:** simulate an expired JWT mid-room and observe the simultaneous silent degradation of every P1-2 family hook ("no sources, no markers, no marks, seats open") | critic #11 |
| R-14 | **Browser Back mid-room with an unsent draft:** confirm exit-without-warning on live (no beforeunload; sole history use AuthCallbackScreen.tsx:96-99) | critic #3 |
| R-15 | **Circle rooms vs the state-cell inventory:** do circle rooms (force-private, invite matrix suppressed) change any of the 21/23 missing-state cells? | critic #13c |
| R-16 | **Walk coverage gaps:** wide-viewport behavior untested (preview pane native width ~487px); plain-user rendering unverified (walk ran as admin); deep states (playback, moderation) untriggered | RUNTIME 2026-07-12 authed walk @487px, finding 11 |
