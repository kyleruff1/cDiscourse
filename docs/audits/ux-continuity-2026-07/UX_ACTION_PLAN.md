# UX_ACTION_PLAN — UX/Product-Surface Continuity Audit (2026-07)

**Status:** Master remediation plan. Docs-only artifact — no code changes ship with this audit.
**Audit root for all `path:line` citations:** `C:/Users/kyler/cdiscourse/wt-voice-adr` (src identical to `origin/main` @ `da32f56b`).
**Runtime evidence:** operator-authed walk of the live site, cited as `RUNTIME 2026-07-12 authed walk @487px`.
**Companion artifacts:** UX_SURFACE_MAP, UX_TRANSITION_MAP, UX_STYLE_SYSTEM_AUDIT, UX_ARTIFACT_CLEANUP_AUDIT, UX_COHESION_AND_MISSION_REVIEW, UX_AUDIT_SUMMARY (same directory).

## Severity rubric and canonical rulings

**Rubric:** P0 = hides content / blocks use / breaks a11y / misleads. P1 = major cohesion, or misleads under plausible conditions. P2 = major polish / product debt. P3 = polish, experiments, gated work.

The five research digests disagreed on three severities. These rulings are **canonical** for every artifact in this audit:

| Finding | Digest disagreement | Canonical ruling |
|---|---|---|
| Chime-in silent failure | P1 (surface-map, transitions, cleanup) vs P0-2 (cohesion) | **P0-2.** The `chime_in` flag is LIVE; expected-contention 409s (`seats_full`, `room_private`) are silently discarded — the app actively misleads a user whose action failed. |
| Button.tsx contrast | P0-3 (cohesion) vs P1 "marginal AA fail" (style F-02) | **P1.** 4.47:1 is a hair's-width miss of the 4.5:1 AA threshold; the style audit's calibration is accepted. It still ships in PR-A alongside the P0 light-theme work — same review lens, one visual smoke. |
| `useReduceMotion` consumer count | "imported in only 2" (style F-26) vs 1 (transitions F11) | **Exactly 1 consumer** (DisagreementPointsRail), grep-verified. Carried everywhere in this plan, including P2-12. |
| Focus/Esc/corridor/containment cluster | Lived only in cleanup Wave-5; absent from the plan skeleton's P0 table | **P0, Wave 1, as PR-0.** This was the audit's unanimous top-severity class (critic gap #8); it may not live only in an appendix. |

---

## P0 — hides content / blocks use / breaks a11y / misleads

All four items are statically verified. PR-0 (the a11y cluster) ships **first**; see PR sequencing.

### P0-1 — Light-theme shared components on the dark app

- **Where:** `TextInputField.tsx:50-62` (VERIFIED — label `#374151` + white input), `ErrorNotice.tsx:18-25` (`#fef2f2`), `EmptyState.tsx:28-29` (`#111827` title), `CreateDebateForm.tsx:155-173` (`#444`/`#fafafa`).
- **What/why:** Pre-era light-theme remnants render on the dark `#08060F` shell — labels compute to ~1.9:1 contrast, near-invisible **on the auth front door**, the first screen every new user meets. This hides content and fails a11y outright.
- **Change:** Re-skin all four onto `SURFACE_TOKENS.inputBg/inputBorder/placeholder` + `STATUS.danger`.
- **Risk/blast:** Medium — 4 component files, ~10 consumer screens visually affected.
- **Test:** Jest render tests; RUNTIME-CHECK visual smoke on a Netlify preview (contrast per consumer screen); a grep guard banning gray-family hexes in `components/`.

### P0-2 — Chime-in attach/retract fully silent on failure

- **Where:** `ArgumentRoom.tsx:1019-1042` (VERIFIED — `if (res.ok)` only gates the refetch; the failure branch does nothing). Plain-language error copy already exists unused: `chimeInApi.ts:102,127` (also cited at `chimeInApi.ts:41` by the cleanup lane).
- **What/why:** `chime_in` is a LIVE flag. `seats_full` / `room_private` are **expected contention outcomes**, not edge cases — a user taps chime-in, the request 409s, and the UI shows nothing. Contrast: quote_forge failures got a retry banner (`App.tsx:1630-1645`); chime did not. This misleads under entirely plausible conditions.
- **Change:** Thread `res.errorMessage` into ChimeInAffordance as a quiet note + a11y live region, following the `BooleanFeedbackBar.tsx:151-176` write-path pattern.
- **Risk/blast:** Low — `ArgumentRoom.tsx` + `ChimeInAffordance.tsx`.
- **Test:** Jest: failure branch renders `errorMessage`; a11y live-region assertion.

### P0-3 — Focus / Esc / corridor / containment cluster (the unanimous P0 → PR-0)

Four coupled defects in overlay and navigation grammar on the **live platform (RN-web)**. Shipped together as PR-0 because they share one review lens (keyboard/overlay behavior) and one runtime verification pass.

**P0-3a — Zero programmatic focus management on any overlay.**
- **Where:** grep-confirmed **zero `.focus(` calls anywhere in `src`**. Overlay sites: `Popout.tsx:208,241`, `ArgumentComposerDock.tsx:524,546`, `PreSendReviewSheet.tsx:205,219`, `AddAnnotationSheet.tsx:136`, `RequestReviewComposer.tsx:176`.
- **What/why:** Every "trap" claim in the codebase rests on `accessibilityViewIsModal` — which is iOS-only and is **not** `aria-modal` on RN-web. No overlay sets initial focus, contains Tab, or restores focus on close. Keyboard and screen-reader users can Tab behind every modal. Breaks a11y on the shipping platform.
- **Change:** New web-only focus utility (initial focus, Tab containment, focus restore), adopted first in the Popout chassis + the Modal sheets, then rolled to the rest of the overlay family.
- **Risk/blast:** Medium-high (risky-cleanup tag) — a new utility touching every overlay; native behavior must stay unchanged.
- **Test:** Jest per overlay (focus lands, Tab wraps, focus restores); RUNTIME-CHECK tab-behind-modal on dev-cdiscourse.netlify.app confirms/refutes on-device.

**P0-3b — Escape double-dismiss collision.**
- **Where:** `composerKeyboardModel.ts:102-104` returns `close` unconditionally; dock listener `ArgumentComposerDock.tsx:296-335`; Popout listener `Popout.tsx:166-180` (VERIFIED — `preventDefault` only, **no** `stopPropagation`).
- **What/why:** One Esc with ActPopout or PreSendReviewSheet layered over the dock likely closes **both** layers — contradicting the inert-scrim draft-protection grammar (`PreSendReviewSheet.tsx:208-215`). A user protecting a draft can lose the composer with a single key.
- **Change:** Thread overlay-open state into `resolveComposerKeyEffect`, or have the topmost overlay `stopImmediatePropagation`.
- **Risk/blast:** Low-medium — model + two listeners.
- **Test:** Jest matrix on `resolveComposerKeyEffect` (overlay-open → dock ignores Esc); RUNTIME-CHECK single-press behavior on layered overlays.

**P0-3c — Demo corridor traps the primary nav.**
- **Where:** `App.tsx:1028-1044` (VERIFIED — `handlePrimaryNav` writes tab/start/lane/about but never `setDemoCorridorOpen(false)`), guards at `:1189-1196`, Account/Admin unguarded at `:1673-1677`.
- **What/why:** With the corridor open, About cannot mount (`:1196`), gallery blocks are guarded (`:1255/:1289`), and Account/Admin **co-render** with DemoCorridorScreen. Primary navigation reads as dead until the corridor's own Close — blocks use.
- **Change:** Clear `demoCorridorOpen` in `handlePrimaryNav` and/or gate the corridor mount on `activeTab === 'arguments'`. (Safe-cleanup tag; statically confirmed.)
- **Risk/blast:** Low.
- **Test:** Jest on the nav model; RUNTIME-CHECK the visual co-render outcome (corridor open → tap Account/Admin).

**P0-3d — MarkerPhrasePickerSheet / RequestReviewComposer: no containment, background keyboard live.**
- **Where:** `MarkerPhrasePickerSheet.tsx:51,60-69,102-129` (Cancel-only dismiss; no Esc, no `onRequestClose`/hardware back, no `accessibilityViewIsModal`); `RequestReviewComposer.tsx:172,307,335-336` (same pattern); both excluded from `hasOpenMenu` (`ArgumentRoom.tsx:2784,2852`) so the A/I/G shortcuts + arrow navigation **fire behind the open sheet**.
- **What/why:** A keyboard user with the sheet open can silently mutate room state underneath it. Blocks use / breaks a11y.
- **Change:** Wrap both in the core Modal pattern, or add Esc + backdrop dismiss + `hasOpenMenu` inclusion.
- **Risk/blast:** Low — two sheets + one predicate.
- **Test:** Jest: `hasOpenMenu` includes both sheets; shortcut suppression while open.

---

## P1 — major cohesion / misleads under plausible conditions

| # | Item | Where (citations) | Change | Blast | Validation |
|---|---|---|---|---|---|
| P1-1 | **Cohesion contract doc + guards** — land the 12 cohesion principles + the state principle as `docs/design-cohesion-principles.md` with source-scan guards for principles #2/#3/#9 (ban-list test precedent `designTokens.ts:637-647`) | Cohesion review, principles section | 1 doc + 1-2 test files; the ratchet that stops era drift before Wave-2 migration | Low | Guards go red on seeded violations |
| P1-2 | **Silent-empty read-hook family** — failed reads render as empty success. Worst: `useProofItems` — a failed read renders **every move source-less**, directly misleading against the evidence-first mission (`useProofItems.ts:66-69` no error field; `loading` returned but unused at `ArgumentRoom.tsx:846`). Also `useMarkers.ts:68-71`, `useMoveMarks.ts:95-97` read path (write path already exemplary), `useChimeInContributions.ts:75-78` (shows seats open that will 409 — feeds P0-2), `useGalleryMoveMarks.ts:58-62`. **EXCLUDE `useMyCircles`** (`useMyCircles.ts:10,40-44`) — documented-intentional silent-by-design ("error stays null by construction"); list it in the family census with a by-design tag so the family fix neither misses it nor accidentally "fixes" it (critic #1). **Aggravator (critic #11):** a JWT expiring mid-room fails every hook in this family *simultaneously* — the room quietly degrades to "no sources, no markers, no marks, seats open." This is the most probable real-world trigger and is what holds the family at P1. | 5 hooks + `ArgumentRoom` + gallery | Add `error` to each hook result + **one** non-blocking room-level "could not load — retry" strip (one shared template, not five bespoke banners) | Med | Jest per hook: error in → error out; room renders the strip once, not per-card; RUNTIME-CHECK failure frequency + a simulated expired-session pass |
| P1-3 | **Button.tsx contradicts CONTROL on both documented rules** (demoted from the skeleton's P0-3 per the severity canon; rides PR-A) — primary `#6366f1`+white is the exact 4.47:1 AA fail the token doc warns about (`Button.tsx:67,72,76` VERIFIED; `designTokens.ts:429-431`); danger is the full-bleed red flood `CONTROL.danger` forbids (`:446-450`) | `Button.tsx` + 5 consumers (ArgumentComposer, AuthScreen, AuthCallbackScreen, CreateDebateForm, JoinDebatePanel) + snapshots | Point variants at `CONTROL.*` (secondary already fixed via UX-BRAND-001 — precedent in-file) | Low | Snapshot updates + one-step-darker visual smoke |
| P1-4 | **Google sign-in initiation is silent on failure** — `AuthScreen.tsx:248-250` voids the AuthResult; `signInWithGoogle.ts:29-70` returns messages that never render | `AuthScreen.tsx` | Feed `result.message` into the existing ErrorNotice (`:194`). Gated by `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` (ON per memory — RUNTIME-CHECK) | Low | Jest failure-path render |
| P1-5 | **In-room rail join failure resolves to a no-op** — `App.tsx:1483-1498` handles `select_side`/`full_room_observe` only; `seatClaimModel.ts:333-340` maps error → `'none'`; the error lands in an **unmounted** gallery banner via `useDebates.ts:100-102` | `App.tsx`, `seatClaimModel.ts`, seat strip | Add an `'error'` JoinSideEffect kind + a room-level note | Med | Jest: error outcome → visible room note + a11y announce |
| P1-6 | **Provenance must be visible, not only audible** (VERIFIED) — "Advisory:" exists solely in `accessibilityLabel`; visible text is a bare hedged sentence (`derivedSignalConsumerModel.ts:38-65`, `:40`; `MediatorNodeMarker.tsx:44`; 11px dimming only at `DerivedSignalAdvisoryLines.tsx:53-57`). Sighted users get **less** provenance than SR users — mission-core for an app whose grammar separates human moves from machine notes | `derivedSignalConsumerModel.ts`, `DerivedSignalAdvisoryLines.tsx`, `MediatorNodeMarker.tsx` | Add a fixed visible affix ("note"/"derived" word, or the dashed-border treatment per cohesion principle #4) | Low | Render test pins the visible prefix; existing ban-lists unaffected |
| P1-7 | **Standing-band red→green verdict gradient, ×3 copies** — `argumentGameSurfaceModel.ts:839-849` ≡ `argumentScoreModel.ts:49-59` byte-identical + inline ternary `ArgumentScoreTracker.tsx:69`; live via `room_exchange_v2`; contradicts the mediator board's test-guarded red/green ban even though SW-001 softened the labels (`standingBandCopy.ts:32-40`) | 2 models + tracker + VISUAL-SIMPLIFY-003 contract test + timeline-grammar expectations | **(a) P1-7a dedupe to one canonical export — ships now (PR-F).** (b) P1-7b re-ramp off red/green (neutral→indigo intensity) — **DOCTRINE-GATED: operator ruling required before any hue change** (PR-F′) | Med | Import-equality test replaces the byte-pin; operator ruling recorded before (b) |
| P1-8 | **Gallery renders LoadingNotice + EmptyState simultaneously on first load** (VERIFIED `ConversationGalleryScreen.tsx:370-385` — EmptyState lacks a `!loading` guard; `ArgumentTreeScreen.tsx:278` is the correct in-repo template). SR announces a false empty state | `ConversationGalleryScreen.tsx` | 1-line guard | Low | Jest: loading+empty renders exactly one notice; RUNTIME-CHECK visual layering |
| P1-9 | **Fixture leakage — three inconsistent treatments in production** (RUNTIME 2026-07-12 authed walk @487px, finding 1): (a) Browse gallery shows smoke rooms as ordinary content with the `[stress …]` tag **stripped from display** ("Chime cohort smoke", "Proof drawer smoke", "Settle smoke room"… — 18 rooms, only "1 duplicate run collapsed"); (b) inside a room the **raw tag renders in the title** ("Chime cohort smoke [stress chime-mrgpodh6]"); (c) the Start-sheet circles picker lists six raw `[stress …]` circles as "Your circles". D8 excluded fixtures from HOME only (`homeModel.ts:59-65`); Browse/room/picker were never covered. Same class statically: the weave (quote_forge) picker has **no** fixture filter (`argumentRoomLinksApi.ts:286-300` selects all locked debates, raw titles; `linkTargetPickerModel.ts` has zero bot/reseed logic — cleanup #9). Misleads real users into treating test fixtures as live discourse | Gallery, room title render, StartArgumentSheet circles picker, weave picker; registry sources `botRoomPolicyModel.ts:329-330` / `looksLikeBotSeedTag`, label precedent `ConversationGalleryScreen.tsx:26,639` (BotRoomMarker) | **One registry-driven exclusion** (non-admin viewers) applied to gallery, room title, circles picker, and weave picker, **plus a display-strip rule**: raw `[stress …]`/`[xai-adv …]`/`[reseed-…]` tags never render verbatim on any user surface (strip + BotRoomMarker where admins still see them). Mind the regex-mirror drift: `argumentArtifactModel.ts:128-139` is missing the `reseed` alternative its mirrors have (cleanup #18) — the registry consolidation should end the mirror family | Med | Jest per surface mirroring the homeModel filter test + an array-diff parity test across the tag regexes; RUNTIME re-walk of all four surfaces |
| P1-10 | **Gallery participant-count broken** (RUNTIME 2026-07-12 authed walk @487px, finding 2): cards show "0 PARTICIPANTS" for rooms whose own header says "3 of 5 active seats" and which visibly have two posters | Gallery card model (`conversationGalleryModel.ts`) + whatever feeds its participant field — **root-cause first**: derivation bug vs. data source never wired | Fix the derivation or drop the count until it is real — a wrong number is worse than none | Low-Med | Jest on the card model with seeded seat data; RUNTIME re-check against a room with known seat state |
| P1-11 | **Competing open-counts on one screen** (RUNTIME 2026-07-12 authed walk @487px, finding 3): state rail "7 open points" vs mediator strip "Open issues · 4", same screen, no explanation of the difference — comprehension failure for exactly the users the mediator surface exists to orient | State-rail model + mediator strip copy | **One vocabulary, or explicit labels** — either unify the counted concept or label both ("7 open points across the tree" / "4 mediator issues"). Copy fix first; concept unification is a follow-on design card if the concepts genuinely differ | Low | Copy-pin test updates; RUNTIME re-read of the room screen |
| P1-12 | **Side-rail "Share" is a production no-op — remove it** (critic #2): `ArgumentRoom.tsx:2396` routes `code === 'share'` to `onShareRoom?.()` and **no caller anywhere supplies `onShareRoom`**; the rail model promises "opens a native/browser share sheet" (`ArgumentSideActionRail.tsx:86-100`); Share is in the observer expanded set, so every observer sees a dead button. **It is also unfixable as specced** (critic #3): rooms have no URLs — the only history-API usage in src is the auth-callback `replaceState` (`AuthCallbackScreen.tsx:96-99`); there is nothing to share | Rail model + `ArgumentRoom.tsx` | **Remove Share from the rail until rooms have URLs.** The router/URL model is its own design card (browser Back currently exits the app from anywhere, nothing is bookmarkable — see RUNTIME-CHECK register); when that lands, Share returns with a real payload. (`watch` at `:2395` is a *documented* no-op — leave it) | Low | Jest on the rail expanded-set; grep guard that no rail code ships without a handler |
| P1-13 | **Notification badge invisible while in a room** (critic #7): `NotificationBadge` renders on the Arguments tab bar (`App.tsx:1170-1174`) which is hidden whenever a room is active (`App.tsx:1156`) — the one place users spend sustained time is the one place new-notification signal cannot reach | `App.tsx` tab-bar/room-header seams | Surface the unread count in the in-room header strip (DebateDetailHeader lane) or restore a minimal badge affordance while roomActive; rider on **PR-G** | Low | Jest: badge-visible-while-roomActive assertion; RUNTIME re-check in-room |

---

## P2 — major polish / product debt (carried from the cohesion synthesis)

| # | Item | Where | Blast | Validation |
|---|---|---|---|---|
| P2-1 | Reading-measure cap ~640-720px, centered, on spineColumn/RingsideFeed + gallery/home excerpts | `RoomBoardLayout.tsx:175-177`; `RingsideFeed.tsx:108-110` | Low | Snapshot + RUNTIME-CHECK at 1280+ |
| P2-2 | Era A′ token migration: replace matching hex literals with token refs in RingsideCard/ConversationGalleryScreen/RoomBoardLayout/RoomSettledNotice; ADD missing chip-tint tokens (quote `#111827`, proof `#0c4a6e`, marker highlight `#1e3a5f` — `TimestampMarker.tsx:125`) | 4-5 files + designTokens (additive) | Med | Byte-identical rendered styles (snapshot); no-new-hexes guard |
| P2-3 | Chrome-budget extraction for the active card (~15 stacked elements, `RingsideCard.tsx:55-64,169-331`) + fold OpenIssuesRail/SideActionRail verbs into the state rail/action row (precedent: one-chip-per-node, `ArgumentRoom.tsx:3253-3267`) | ArgumentRoom + rails | **High** | Capability-parity tests (`roomCapabilityParity.ts`) stay green; RUNTIME-CHECK band count |
| P2-4 | Kind/tone palette consolidation: fold TIMELINE_KIND_COLORS into designTokens; promote one TONE_BAND_HEX and delete the drifted third copy (`argumentGameSurfaceModel.ts:851-857`); re-hue legacy red 'counter' → challenge orange (`ArgumentTimelineNode.tsx:14-21`, `ArgumentTrack.tsx:19-26`) | 5-6 files + pin-test updates | Med | Import-equality tests; visual smoke of tree lens if reachable (RUNTIME-CHECK) |
| P2-5 | Additive dimension tokens: SPACING 2-grid interior keys, TYPOGRAPHY body/title roles + microLabel≥10, RADIUS ruling, SCRIM steps, MOTION {140/160/180}, GLYPHS export — **ADD keys only** (TYPOGRAPHY/SPACING_PRESETS are test-pinned) | `designTokens.ts` (+ glyphs.ts) | Low (additive) | Existing pin tests byte-stable; new keys exported |
| P2-6 | Sub-10px user-facing type bump to a 10-11px floor (gallery 9px `ConversationGalleryScreen.tsx:780,793`; `DebateListScreen.tsx:459,486,490`; `TimelineNodePopover.tsx:398`; 8px `BranchCollapseStub.tsx:226`) | ~12 files, ~24 lines | Low | Grep guard: no fontSize <10 outside admin/ |
| P2-7 | Gray-family consolidation: slate as the only neutral ramp; codemod ~220 gray-family occurrences → SURFACE_TOKENS roles | ~40 files, mechanical | Med | Per-file; snapshot diffs one hue step |
| P2-8 | Settled-room ambient treatment: 'Settled' chip in ArgumentStateRail (cards untouched; `RoomSettledNotice.tsx:57` stays) | State-rail model + rail | Low | Jest: locked status → chip present |
| P2-9 | Gallery de-gamification pass: collapse 6 sort modes behind one control; retire game-flavored bucket names ('Logic traps', 'Source trail fights' — `gameCopy.ts:1085-1139`); re-tone maroon signal chips → attention amber (principle #9; `ConversationGalleryScreen.tsx:790`). Mission-grounded (un-game-like requirement + red-means-failure principle), not aesthetic | `gameCopy.ts`, `ConversationGalleryScreen.tsx` | Med | Copy-pin test updates; ban-list style guard for red-on-content |
| P2-10 | Join panel inline failure feedback (`JoinDebatePanel.tsx:23-28`; error currently displaced to a gallery banner whose retry retries the LIST — `ConversationGalleryScreen.tsx:234-250,375`). Rides PR-B | JoinDebatePanel + gallery | Low | Jest: failed join renders in-panel error |
| P2-11 | SOURCE vs EVIDENCE + derived distinction at spine level: extend the dashed/dotted grammar (principle #4) **after P1-6 lands** (`argumentGameSurfaceModel.ts:814`) | Model + RingsideCard | Med | Render tests |
| P2-12 | Reduce-motion coverage: thread `useReduceMotion` through the uncovered Animated call sites — 6 `Animated.timing` files (5 live + 1 dead), hook consumed by **exactly 1** component today (canon; memory rule: reuse the hook, never re-inline) | ≤6 files | Low | Jest with override prop; RUNTIME-CHECK OS setting |
| P2-13 | Comparison affordance (opportunity, unbuilt): pinned-quote split view extending quote-chip semantics, and/or the spec's Constitution version diff (`product-spec.md:83-85`) | New surface | High | **Design card first** — not a quick fix |

### P2 additions from the runtime walk (RUNTIME 2026-07-12 authed walk @487px)

| # | Item | Change | Blast | Validation |
|---|---|---|---|---|
| P2-R1 | **Role-copy mismatch** (finding 4): creator/Initiator of an empty room sees rail state "You are watching this argument / Watching" + a "Watch ▾" observer control, while the overflow says "You are the Initiator" and the composer accepts posts. Two surfaces disagree about who the user is | Rail state derivation must consume the same role source as the overflow; creator never renders as observer | Low-Med | Jest on rail-state derivation for the creator-of-empty-room case; RUNTIME re-check |
| P2-R2 | **"Public 1:1" labels a 5-seat room** (finding 5) — naming no longer matches the seat model | Label derives from the seat contract, not a fixed string | Low | Jest on label derivation |
| P2-R3 | **Account surface debug leftover** (finding 6): literal "ADMIN? true" row + "Contact support to change your role" placeholder | Replace with a proper role line or remove; placeholder copy gets a real destination or is cut | Low | Jest render; RUNTIME re-check |
| P2-R4 | **IA: "My Arguments" nav routes to the gallery my-rooms lane, not ArgumentHome** (finding 7): identical chrome to Browse; no visible nav affordance returns to the home_v2 resume-first surface (it is only the initial lane). Hedge copy "This link may not work…" renders even for rooms the viewer can open. Rides **PR-G** | Give home_v2 a persistent nav affordance; route "My Arguments" to it or rename the lane honestly; hedge copy conditions on actual openability | Med | Jest on nav model + lane routing; RUNTIME re-walk of the nav loop |
| P2-R5 | **Header density** (finding 8): ~230px of masthead + nav chrome above content at 487px; nested scrolling card list (inner scrollbar, double-scroll) in the gallery | Chrome-budget question — fold into the P2-3 lens rather than a bespoke fix; kill the double-scroll independently (one scroll container) | Med | RUNTIME-CHECK measured chrome height; scroll behavior re-walk |

---

## P3 — polish / experiments / gated (carried)

- **P3-1** Two-blacks ratification: pick `#08060F` or formally ratify the two-zone model (`App.tsx:1731` vs `RoomBoardLayout.tsx:165`; `designTokens.ts:206-219` mapping unfollowed). **SUBJECTIVE DESIGN DIRECTION** as to which black wins; that the seam needs *a* ruling is a maintainability fact.
- **P3-2** Vocabulary ruling: verb='Disagree', kind-label='challenge'; retire 'Challenge' as a verb (`gameCopy.ts:40/966/1091/1180`).
- **P3-3** Era C deprecation card: retire or restyle the ArgumentBubbleCard theater idiom post-bake (`ArgumentBubbleCard.tsx:234-279`; `ExchangeView.tsx:127` fallback). High blast — jest-pinned baseline; schedule, don't rush.
- **P3-4** Receipt two-fidelity codification: "card face = presence count; Inspect = status contract" doc + card pill consumes TONE_BG.info (`RingsideCard.tsx:268-273` vs `ProofChip.tsx:39-70`).
- **P3-5** hitSlop/TOUCH_TARGET codemod (~100 literal hitSlops → presets; `designTokens.ts:477-481`).
- **P3-6** visuallyHidden util extraction (`TimelineSelectedReadoutPanel.tsx:330` 1px-text hack); inline ⤴ literals → CALLBACK_GLYPH (`ArgumentEntryComposer.tsx:363`, `room/MapView.tsx:174`).
- **P3-7** Admin: shared column presets + 9px→10-11 lift (`AdminArgumentsTab.tsx:92-106,1549,1573`); metadata selector failure copy (`AdminMetadataEventsTab.tsx:80-82,139`).
- **P3-8** ArgumentHome banner-over-content on refresh error (`ArgumentHome.tsx:206-217`); "All caught up" line when yourTurn empty but ongoing (`:263-288`).
- **P3-9** Linked-prior "couldn't refresh" strip: wire `LINKED_PRIOR_COULD_NOT_REFRESH` or delete the orphan export (`useLinkedPriorRooms.ts:102-107,221`; `linkedPriorArgumentCopy.ts:58`).
- **P3-10** Settle/reopen error fidelity: map permission-shaped failures off `error_network`; stop double-writing into list state (`DebateDetailHeader.tsx:288-291`; `RoomSettledNotice.tsx:45-49`; `useDebates.ts:124,142`).
- **P3-11** FlagSummary word-not-color for blocking-vs-advisory (`FlagSummary.tsx:13-20`) — moot if the tree lens is dead in prod (RUNTIME-CHECK reachability first).
- **P3-12** Chime governance "this session only" microcopy (`useChimeInGovernance.ts:4-15`); loading-hint for ancillary chip pop-in using already-returned loading flags (`ArgumentRoom.tsx:846`).
- **P3-R1** Raw locale timestamps ×3 stacked in the map ("07/11/2026, 12:42:10 PM") — use the existing `formatDateTime`/`formatRelativeShort` pair (RUNTIME 2026-07-12 authed walk @487px, finding 9).

### P3-V — Voice persuasion-UX fold-in (ALL gated on #863 / VOICE-ADR-002 merge)

Internal priority order preserved from the voice lane (these are that lane's P1s). Voice INFRA items excluded per scope; they live in the separate voice plan.

1. **P3-V0 (do FIRST when the lane opens):** stale-numbers reconciliation — every VOICE-* card cites ADR-002 §D6 as the sole number source; banner on the 08/12 plans (stale exemplars at 08:13,24,52,66,96,116,139; 07:64; 12:13 scope mismatch vs ADR:103,246).
2. **P3-V1** Consent sheet two-register design: intimacy frame ("They can hear this once. Save it to keep it." — 03_PRODUCT_NORTH_STAR.md:47) above the factual D6 retention table; persuasive copy and legal disclosure as distinct strings (consent-version bump isolation, ADR:109,172). Validation: proofDrawerCopyBanList-style test.
3. **P3-V2** Tap-latch default on RN-web, hold-to-talk as the power gesture (contradicts the plan's hold-default 06:213 — INFERRED recommendation; ≥44px targets, permission on first Speak tap only, VOICE-001:265-266). Validation: SR-operable gate (07:105).
4. **P3-V3** Magic-moment polish budget: interim-transcript latency is THE P4 performance headline (08:11; interim never enters the body, ADR:66-67). Validation: RUNTIME-CHECK latency measurement in the P4 card.
5. **P3-V4** Scarcity-as-attention copy + ban-list guard banning DRM-theater terms ('secure', 'unrecordable', 'gone forever') (07:63; 08:135; ADR:171-172).
6. **P3-V5** Edit-anxiety review-step messaging: keyboard parity / unlimited local replay / "the argument stands", surfaced at the moment of hesitation (ADR:209,67-68; 08:72,133; 03:47).
7. **P3-V6** Reciprocity ordering (Speak visually-first after a consumed playback; the text box never shrinks/hides — ADR:31-39 is verbatim-binding) + advisory instrumentation before amplification (`onFastPathCivilitySignal` shape, `ArgumentEntryComposer.tsx:114-115`).
8. **P3-V7** Nudge placement on existing surfaces only (composer slot, room empty state, gallery micro-moment hint, J5 journey script); no push/modals/streaks (08:138; CLAUDE.md What-Not-to-Build).
9. **P3-V8** Voice-as-accessibility framing in the P4 card + first-run copy (the transcript IS the body, ADR §1:101; 07:61,105) — also the internal argument against text-path decay.
10. **P3-V9 (carried risk — critic #10a / voice reader gaps): flag-coupling rule required before any voice flip.** `one_time_playback` OFF while `voice_entries` ON creates an intermediate state — voice **stored but freely replayable without receipts** — directly contradicting the consent sheet's one-listen promise ("flag OFF ⇒ P4 open playback", 13_IMPLEMENTATION_ROADMAP.md:50; both flags registered dark at `featureFlags.ts:78,80`). Change: record a coupling rule (either the flags flip together, or the consent copy for the intermediate state is written and versioned) **before** either flag is ever enabled. Validation: a flag-registry test asserting the coupling, plus a consent-copy branch test.
11. **P3-V10 (carried risk — critic #10b + cleanup #7): the ungated mic teaser must adopt D4 room-gating when voice ships.** The "Voice — coming soon" slot renders **unconditionally** in every room type today (`ArgumentEntryComposer.tsx:369-379` VERIFIED — no flag read), while ADR D4 launches voice **private 1:1 only, circles excluded** — and circles are a live audience type (`StartArgumentSheet.tsx:76-198`). Change: when voice ships, the Speak affordance (and the teaser before it) gates on room type per D4; the teaser's presence in circle/public rooms today is a promise D4 cannot keep. Also exclude the disabled slot from web focus order (RUNTIME-CHECK). Validation: jest on the composer gating matrix by room type.

---

## PR plan

Several small PRs, **not** one design-system refactor. Big-bang rejected: 1,290+ spacing literals, test-pinned TYPOGRAPHY/SPACING_PRESETS, and the jest-pinned Era C fallback make a mass rewrite high-risk and low-user-value; the P0/P1 items are behavior/a11y fixes that must not wait on token debates.

| PR | Scope | Blast | Validation |
|---|---|---|---|
| **PR-0 — overlay a11y cluster (FIRST; a11y blocker class)** | P0-3a focus utility (Popout chassis + Modal sheets first), P0-3b Esc gating, P0-3c corridor nav fix, P0-3d MarkerPhrasePicker/RequestReviewComposer containment | Med-High (every overlay touched; native must stay unchanged) — shippable in internal slices: corridor fix and containment are low-risk and statically confirmed; the focus utility is the risky piece and lands behind per-overlay adoption | Jest per overlay (focus/Tab/restore, Esc single-dismiss, hasOpenMenu); the RUNTIME-CHECK overlay pass (tab-behind-modal, single Esc, co-render) is the acceptance gate |
| **PR-A — dark-theme shared components + Button→CONTROL** | P0-1 (4 light-theme components) + P1-3 (Button variants → CONTROL.*) | Med (4 components, ~10 screens, 5 Button consumers) | Jest renders + snapshots; one visual-smoke pass covers both; grep guard on gray-family hexes in components/ |
| **PR-B — state honesty** | P0-2 chime failure surfacing, P1-2 hook family (one shared hook-error template, `error` added per hook, one room-level strip), P1-4 Google sign-in, P1-5 rail join error, P1-8 gallery co-render guard, P2-10 join-panel inline feedback | Med (~10 files; one template, single review lens) | Jest per hook and per failure branch; live-region asserts; simulated expired-session RUNTIME-CHECK |
| **PR-C — visible provenance** | P1-6 visible affix on derived/mediator lines | Low (tiny, independent, mission-core) | Render test pins the visible prefix |
| **PR-D — cohesion contract doc + guards** | P1-1: `docs/design-cohesion-principles.md` + source-scan guards for principles #2/#3/#9 — the ratchet lands before token migration starts | Low | Guards red on seeded violations |
| **PR-E — additive tokens** | P2-5 additive keys only | Low (zero-risk, unblocks Wave-2 migration) | Pin tests byte-stable; new keys exported |
| **PR-F — standing-band dedupe** | P1-7a: one canonical band export; byte-pin → import-equality test | Med | Import-equality test; renders byte-identical |
| **PR-F′ — standing-band re-ramp (GATED)** | P1-7b: red→green → neutral→indigo intensity. **Does not start until the operator doctrine ruling is recorded** | Med | Ruling recorded first; timeline-grammar expectations + visual smoke |
| **PR-G — fixtures + IA (NEW, from the runtime walk)** | P1-9 registry-driven fixture exclusion (gallery + room title + circles picker + weave picker) + display-strip rule + regex-mirror consolidation; P1-10 participant-count fix; P1-11 open-counts vocabulary/labels; P1-12 Share removal; P1-13 in-room notification badge surfacing; P2-R4 My-Arguments/Home nav affordance | Med (multiple surfaces, but each change is small and independently testable) | Jest per surface mirroring the homeModel filter test; card-model test with seeded seats; copy-pin updates; rail-set test; RUNTIME re-walk of gallery, room, picker, nav loop |

Wave-2 continuation after D+E: P2-4 palette consolidation, P2-2 Era A′ migration, then per-file literal migrations sequenced by the top-5 literal-heavy files (ConversationGalleryScreen 54 hex, ArgumentTimelineMap 42, DebateListScreen 35, argumentGameSurfaceModel 35, ArgumentReplySidecar 33) — each byte-stable-render verified.

Wave-3 feature-shaped cards (one card each, normal designer→implementer→reviewer pipeline): reading measure (P2-1), settled ambient (P2-8), gallery de-gamification (P2-9), role-copy + naming (P2-R1/R2), header/chrome budget (P2-3 + P2-R5 — highest blast, last), comparison affordance (P2-13, design card first), the router/URL design card (prerequisite for Share's return), P3 backlog opportunistically. The P3-V lane opens only on #863/ADR merge, starting with P3-V0 and the P3-V9 flag-coupling rule.

## Suggested implementation sequence

**PR-0 → PR-A → PR-B → PR-G → PR-C / PR-D / PR-E (parallelizable) → PR-F** (PR-F′ only after the operator doctrine ruling).

Rationale: PR-0 clears the a11y blocker class that every later runtime verification pass depends on (you cannot smoke overlay behavior honestly while focus/Esc are broken). PR-A fixes the front door. PR-B makes failure states honest so subsequent runtime checks distinguish "broken" from "silently failed". PR-G goes early because fixture leakage and the dead Share button actively mislead live users today and every item in it is low-risk. C/D/E are small and independent — D's guards should land before any Wave-2 token migration begins. F is mechanical once the byte-pin is replaced; F′ queues behind the operator without blocking anything else.

---

## RUNTIME-CHECK register (carried; operator-authed browser pass required)

Items relevant to this action plan, with the PR whose acceptance they gate:

| # | Check | Source | Gates |
|---|---|---|---|
| 1 | Tab-behind-modal on every overlay; focus lands/contains/restores after the utility ships | cleanup #2 | PR-0 acceptance |
| 2 | Single Esc press with ActPopout / PreSendReviewSheet layered over the dock — double-dismiss? Does RN-web Modal fire onRequestClose on Esc for backdrop-inert confirms? | cleanup #3 | PR-0 acceptance |
| 3 | Demo corridor open → tap Account/Admin: visual co-render outcome | cleanup #1 | PR-0 acceptance |
| 4 | Web tab order: aria-hidden dock scrim (`ArgumentComposerDock.tsx:535-542`) and the disabled mic slot (`ArgumentEntryComposer.tsx:369-379`) focusability | cleanup #7/#31 | PR-0; P3-V10 |
| 5 | Rendered contrast of the P0-1 components per consumer screen; Button one-step-darker visual delta | cohesion register | PR-A acceptance |
| 6 | Silent-hook failure frequency (no telemetry exists); simulated expired-session pass — does the room degrade visibly or silently after PR-B? | cohesion register + critic #11 | PR-B acceptance |
| 7 | Google flag actually ON in the deployed env (`EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`) | cohesion P1-3 note | PR-B scope |
| 8 | Gallery loading+empty visual layering before/after the guard | cohesion register | PR-B acceptance |
| 9 | Fixture rooms in prod re-walk after PR-G: gallery display, room title, circles picker, weave picker (walk already confirmed 18 fixture rooms visible in gallery + 6 fixture circles in the picker — RUNTIME 2026-07-12 authed walk @487px, finding 1; the weave-picker cell itself is still unwalked) | cleanup #9 + runtime 1 | PR-G acceptance |
| 10 | Participant count re-check against a room with known seat state | runtime 2 | PR-G acceptance |
| 11 | Open-counts: re-read of the room screen after the copy ruling | runtime 3 | PR-G acceptance |
| 12 | Live flag ON-set confirmation (9/11 per memory; the journey-gate table predates the 07-11 flip) | cohesion register + cleanup #7(register) | all reachability claims |
| 13 | Legacy tree-lens + red TRACK palette prod reachability | cohesion register | P2-4, P3-11 |
| 14 | Actual line measure at 1280+ (wide-viewport behavior entirely untested — the walk ran at ~487px) | cohesion register + runtime gaps | P2-1 |
| 15 | Animated-without-guard behavior under OS reduce-motion | cohesion register | P2-12 |
| 16 | Retracted-marks RLS invisibility (migration SQL not re-read this audit) | cohesion register | trust-surface claims |
| 17 | Font scaling / 200% browser text-zoom on the fixed 9-13px chrome and the ~1462px admin tables (`allowFontScaling` never assessed) | critic #12 | P2-6, P3-7 |
| 18 | Plain-user rendering (the authed walk ran as an admin — kyleruff+devtests1); deep states (playback, moderation) untriggered | critic #13 + runtime gaps | all P1 fixture/IA claims |
| 19 | Circle-room variants of the missing-state cells | critic #13c | PR-B, PR-G |
| 20 | Is #863 / VOICE-ADR-002 actually merged? (one `git log` answers it; the voice reader could not determine) | critic #13a | P3-V lane opening |
| 21 | ProfileTagPopout close → focus/context returns to PreferencesPopout (comment-asserted only) | cleanup register #8 | PR-0 follow-up |
| 22 | Deployed bundle scan: analytics/devFixtures/__DEV__ exclusion (inferred, never verified) | cleanup register #6 | cleanup lane |
| 23 | Interim-transcript latency measurement (the voice magic-moment budget) | voice reader | P3-V3 (P4 card) |
