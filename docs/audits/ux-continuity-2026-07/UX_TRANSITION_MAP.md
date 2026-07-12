# UX_TRANSITION_MAP — CDiscourse UX Continuity Audit (2026-07)

**Provenance.** Static audit of the main-content worktree (`wt-voice-adr`, src identical to `origin/main` `da32f56b`), synthesized from the motion/overlays/states readers (workflow `wf_713f28ab-971`), spot-verified by the completeness critic, plus an operator-authed runtime walk of the live site (cited below as `RUNTIME 2026-07-12 authed walk @487px`). Every claim carries its source citation (`path:line` for static findings, RUNTIME for the live walk). No code was changed for this audit.

**Runtime coverage caveat** (carry into any follow-up): the walk ran at ~487px viewport width, authenticated as an admin account; wide-viewport behavior, plain-user rendering, and deep states (playback, moderation) are unverified — see the RUNTIME-CHECK register (§7).

---

## 0. Severity canon applied (binding, from the audit plan)

The per-reader severity splits were reconciled into one canon. This artifact uses the canon; the original digest ratings are noted in §8 where they differed.

| Ruling | Canon |
| --- | --- |
| Chime-in silent failure (F6a) | **P0** (P0-2 in the master plan — flag LIVE; expected-contention 409s silently discarded → misleads) |
| Focus / Esc / corridor / containment cluster (F1, F5, F12 + cleanup's corridor nav trap) | **P0** — must appear in UX_ACTION_PLAN Wave 1; not dropped here |
| Button.tsx contrast | **P1** (style-audit item; noted here only because motion primitives share the same shared-component fix lane, PR-A) |
| `useReduceMotion` hook consumer count | **Exactly 1** (grep-verified: `DisagreementPointsRail`) — carried everywhere in this document |

---

## 1. Character of the motion system

Snap-first, sparse, majority reduce-motion(RM)-disciplined. Verified census:

- **5 live custom animators + 1 dead one** (critic-verified: 6 `Animated.timing` files total): `Popout.tsx`, `ArgumentSideActionRail.tsx`, `OpenIssuesRail.tsx`, `DisagreementPointsRail.tsx`, `ArgumentComposerDock.tsx` live; `TimelineMiniMap.tsx` dead — its `heightAnim` is referenced at `TimelineMiniMap.tsx:283,289,291,299` but **never bound to any style** (verified).
- **11 true Modals** (critic-verified; the 12th `<Modal` grep hit at `PreSendReviewSheet.tsx:7` is a comment explaining why it is *not* a Modal), split:
  - `animationType="slide"` × 6: `AddAnnotationSheet.tsx:120`, `PreferencesPopout.tsx:134`, `ProfileTagPopout.tsx:69`, `CallbackCaptureSheet.tsx:63-67`, `LinkTargetPickerSheet.tsx:144-147` (all five RM-gated); `DeletionRequestSheet.tsx:47` **hardcoded slide, no `reduceMotion` prop anywhere in file (verified)**.
  - `animationType="fade"` × 3 (confirm family): `RoomSettleConfirmation.tsx:79` (component gated **but the mount at `DebateDetailHeader.tsx:525-532` omits the prop**, while the reopen path passes it — `RoomSettledNotice.tsx:94`); `MakePrivateConfirmation.tsx:72` (ungated, no prop `:18-24`); `RoomUnavailableNotice.tsx:40` (gated).
  - `animationType="none"` + custom animator × 2: `Popout.tsx:206`, `ArgumentComposerDock.tsx:522`.
- **2 LayoutAnimation sites** — inert on RN-web, the live platform (`SourceChainPopover.tsx:233-242`; `RespondToEvidenceForm` ~`:340-350`).
- **Zero** `Easing` imports, **zero** motion tokens in `designTokens.ts`, **zero** router/lane transitions (`App.tsx:1028-1044` instant setState).
- **`useReduceMotion` hook: exactly 1 consumer** (`DisagreementPointsRail.tsx:50,230`) against **8 inline `AccessibilityInfo` copies** (F11). MEMORY doctrine: reuse, never re-inline.

Consistency grade **B** — the drift is convergence work, not redesign.

---

## 2. Complete transition/animation inventory

| # | Transition | Trigger | Component(s) | Timing / easing | Reduce-motion compliance | Layout-shift risk | Verdict: aid vs ornament |
|---|---|---|---|---|---|---|---|
| T1 | Popout flash (Act/Inspect/Go chassis) | flash-menu btn / board row / kbd shortcut | `src/features/arguments/oneBox/Popout.tsx:44,154-198` (Modal `none` `:206`) | 140ms `Animated.timing` default easing, opacity + 12px translate from anchor edge, native driver | GATED (snap via `setValue` `:150-152`) | none (overlay) | **Aid** — origin-edge cue |
| T2 | Side-action rail sheet slide | rail expand | `ArgumentSideActionRail.tsx:287-301` (travel `:196`, interp `:377-390`) | 160ms / 48px, default easing | GATED + side-variant snap `:289-292` | none | **Aid** — edge provenance |
| T3 | Open-issues rail slide | rail expand | `OpenIssuesRail.tsx:179-191,247-257` | 160ms / 48px | GATED | none | **Aid** |
| T4 | Disagreement-points rail slide | rail expand | `DisagreementPointsRail.tsx:253-269` | 160ms / 48px | GATED (+ pane snap); **sole `useReduceMotion` hook consumer** `:50,230` | none | **Aid** |
| T5 | Composer dock slide | dock open | `ArgumentComposerDock.tsx:214-228` (travel `:148`, RM arm `:499-512`, Modal `none` `:522`) | 180ms / 64px translateY(sheet)/translateX(side) | GATED (opacity-only snap) | none | **Aid** — composer spatial continuity |
| T6 | Exit of T1–T5 | close | rail `:353`, `OpenIssuesRail.tsx:222`, `DisagreementPointsRail.tsx:374`, dock `:514`, Popout `:200` | **0ms in practice** — unmount in same commit; `toValue:0` tweens are dead code | trivially safe | none | **Defect/ornament** — enter-glide/exit-snap asymmetry (F8) |
| T7 | Platform Modal slide (6 sheets) | sheet open/close | `AddAnnotationSheet.tsx:120`, `PreferencesPopout.tsx:134`, `ProfileTagPopout.tsx:69`, `CallbackCaptureSheet.tsx:63-67`, `LinkTargetPickerSheet.tsx:144-147` — all gated; `DeletionRequestSheet.tsx:47` — **ungated (verified)** | RNW platform curve, ~300ms class — RUNTIME-CHECK exact duration + whether exit plays | 5/6 gated | none | **Convention/ornament** — second timing language (F7) |
| T8 | Platform Modal fade (confirm family) | confirm open | `RoomSettleConfirmation.tsx:79` gated **but mount at `DebateDetailHeader.tsx:525-532` omits the prop**; `MakePrivateConfirmation.tsx:72` **ungated, no prop**; `RoomUnavailableNotice.tsx:40` gated | ~300ms platform fade | 1.5/3 gated | none | **Ornament** (acceptable convention) |
| T9 | Timeline auto-scroll to active node | EVERY active-node change (stack tap, swipe, rail action) | `ArgumentTimelineMap.tsx:780-786` — **`animated: true` hardcoded (verified)** | platform scroll ease | **NOT GATED** — highest-frequency motion in the room | none | **Aid** (spatial continuity) but must gate (F3) |
| T10 | Mini-map jump / DPR segment scrolls | jump tap | `ArgumentTimelineMap.tsx:830-833`; `DisagreementPointsRail.tsx:320,331`; scrub always `animated:false` `:851-854` | platform | GATED — the house exemplars | none | **Aid** — cite as doctrine exemplar |
| T11 | Bubble-stack fan | activation/swipe re-render | `ArgumentBubbleStack.tsx:208-220` + `argumentGameSurfaceModel.ts:512-537` | **static** — no Animated import; scale/translate/rotate/opacity/zIndex computed per render | RM-safe by construction | none | **Aid** (depth) — instant promotion is a defensible trade; keep as the RM arm if ever tweened |
| T12 | LayoutAnimation expand/collapse | source-chain expand; clarification show/hide | `SourceChainPopover.tsx:233-242`; `RespondToEvidenceForm` (~`:340-350`) | easeInEaseOut preset ~300ms | GATED, but **inert on RN-web** (RUNTIME-CHECK) — snaps for everyone on the live platform | in-flow expansion (instant) | **Intended aid, delivers nothing where it ships** (F19) |
| T13 | TimelineMiniMap heightAnim | expand toggle | `TimelineMiniMap.tsx:283-299` (**verified: value drives no style**) | 140ms JS-driver, wasted per toggle | gated but moot | none | **Dead — delete** (F9) |
| T14 | Lane/page/room switches | nav | `App.tsx:1028-1044` | instant setState, no transition layer | clean | full-pane swap (accepted) | **Accepted** snap-first identity |
| T15 | Loading→loaded | fetch resolve | `LoadingNotice.tsx:8-15` full-pane swaps; proof/marker/chime chips pop in post-fetch (`ArgumentRoom.tsx:846` loading flag unused) | instant; spinner rotation ungated (industry-standard, leave) | n/a | additive chip pop-in | **Accepted**; optional one-line "loading sources…" hint |
| T16 | PacingChip countdown | 1s interval | `ArgumentComposerDock.tsx:262-269`; `PacingChip.tsx:28-31` (information-not-motion by doctrine) | text re-render | intentionally ticks under RM | digit-width jitter (no tabular-nums) | **Information** — add `fontVariant: tabular-nums` |
| T17 | Pressed styles | press | ~200 sites; gated only in `ArgumentStateRail.tsx:116` + `ArgumentEntryComposer.tsx:401` | instant style swap | inconsistent 2-files-only standard | none | **State feedback, not motion** — rule exempt (F20) |
| T18 | Settle swap | host settles/reopens | `App.tsx:907-908,1539,1559,1592-1598`; `RoomSettledNotice.tsx:59-98` | instant mount swap | n/a | **bottom-band height/content change under the reader** | **Gap** — rare event, P3 (F22) |
| T19 | Gallery nested scroll (double-scrollbar) | scroll in Browse gallery | Browse gallery card list at ~487px: inner scrollbar on the card list inside the page scroll — a nested-scrolling / double-scroll pattern under ~230px of masthead+nav chrome (RUNTIME 2026-07-12 authed walk @487px, finding 8) | n/a (scroll behavior, not animation) | n/a | **scroll-capture risk**: wheel/swipe lands in whichever scroller is under the pointer; two scrollbars render; content viewport shrinks further under the fixed chrome | **Layout/scroll-behavior defect** — one page should own vertical scroll (see §6 item 5) |

---

## 3. Findings, deduped and ranked (canon severities)

### P0 — the focus/Esc/containment cluster + chime silent failure

These four ride together in UX_ACTION_PLAN Wave 1 (with the cleanup digest's corridor nav trap, which shares the same cause: keyboard events reaching surfaces behind the visually-topmost layer).

**F1 — No focus management on any overlay (live web platform).**
- **Where:** every overlay; containment claims rest solely on `accessibilityViewIsModal` — `Popout.tsx:208,241`; `ArgumentComposerDock.tsx:524,546`; `PreSendReviewSheet.tsx:205,219`; `AddAnnotationSheet.tsx:136`; `RequestReviewComposer.tsx:176`.
- **What:** zero programmatic `.focus()`/trap/restore anywhere in src (grep-verified); `accessibilityViewIsModal` is iOS-only — RN-web maps it to nothing.
- **Why it matters:** keyboard and screen-reader users tab behind every modal (WCAG 2.4.3 / 2.1.2) on the platform the app actually ships on. A11y, not aesthetics.
- **Change:** small web-only focus utility (initial focus, Tab containment, restore-on-close) adopted by the Popout chassis + Modal sheets first.
- **Risk:** low — additive utility; worst case is a wrong initial-focus target, caught by the runtime pass.
- **Test:** RUNTIME-CHECK #1 (Tab-through with each overlay open on dev-cdiscourse.netlify.app); unit tests on the utility's trap/restore contract.

**F5 — Escape collision across layered overlays.**
- **Where:** `composerKeyboardModel.ts:102-104` (returns close unconditionally); dock listener `ArgumentComposerDock.tsx:296-335`; Popout listener `Popout.tsx:166-180` (no stopPropagation); `PreSendReviewSheet.tsx:208-215` (deliberately inert scrim).
- **What:** one Esc plausibly closes ActPopout AND collapses the dock; Esc with PreSendReviewSheet up closes the whole dock despite the sheet's inert scrim.
- **Why it matters:** a draft-protection sheet that can be blown past with one keystroke defeats its purpose; layered dismissal must be one-layer-at-a-time.
- **Change:** thread layered-overlay-open state into the key model, or have the topmost overlay `stopImmediatePropagation`.
- **Risk:** low-medium — key routing touches the composer's global shortcuts; needs the F12 exclusion list fixed in the same pass or the bug just moves.
- **Test:** RUNTIME-CHECK #2 (the double-fire is inferred statically — confirm empirically first); then a keyboard-model unit test per layer combination.

**F12 — Non-Modal overlays without containment (corridor leakage class).**
- **Where:** `MarkerPhrasePickerSheet.tsx:51,102-129` (Cancel-only dismiss, no Esc/back/onRequestClose) and `RequestReviewComposer.tsx:172,307`; both excluded from `hasOpenMenu` (`ArgumentRoom.tsx:2784,2852`).
- **What:** stack arrow-keys and the A/I/G shortcuts fire behind the open sheet; the sheet has no keyboard dismissal at all.
- **Why it matters:** same trap class as the cleanup digest's corridor nav item — the room state mutates underneath an open sheet the user believes is modal.
- **Change:** add both overlays to `hasOpenMenu`; give MarkerPhrasePickerSheet Esc + onRequestClose parity with the Modal sheets.
- **Risk:** low — additive guards.
- **Test:** open each sheet, press arrow keys/A/I/G, assert no background state change; Esc closes.

**F6a — Chime-in silent failure (canon P0-2; flag LIVE).**
- **Where:** `ArgumentRoom.tsx:1019-1042` discards the plain-language `errorMessage` from `chimeInApi.ts:102/127`.
- **What:** chime-in attach/retract failures render nothing. `seats_full` / `room_private` 409s are *normal contention outcomes* of the shipped seat model, not rare network edges — and they are silently discarded.
- **Why it matters:** the feature is live at 100%; a user who taps chime-in on a full room believes they chimed. The app misleads under its most expected failure path. (Digest resolved P1; the master-plan canon elevates to P0 because the flag is live.)
- **Change:** surface the already-written plain-language `errorMessage` via one quiet live-region strip — the pattern already exists at `BooleanFeedbackBar.tsx:151-176`.
- **Risk:** minimal — copy already exists; one render path.
- **Test:** simulate a `seats_full` 409 (a second account fills seats), assert the strip renders and is SR-announced; RUNTIME-CHECK #7 (offline simulation confirms the failure renderings).

### P1

**F2 — Focus-visible ring on 3 of ~366 Pressables.**
- **Where:** only `PointFeedbackFlagPill.tsx:90`, `PointFeedbackFlagsRow.tsx:99`, `CardDetailPanel.tsx:1051`; the FOCUS_RING token exists app-wide (`designTokens.ts:499-503`).
- **What/why:** keyboard users cannot see where they are on ~99% of interactive surfaces; on web this is table-stakes a11y.
- **Change:** roll out via shared primitives (Button, rail actionChip, nav, gallery cards), not per-card. Concurrent fix required: the existing ring adds `borderWidth:2` to a borderless base (`PointFeedbackFlagPill.tsx:125-138`) → ~4px focus-triggered layout shift; reserve a transparent base border of equal width (§6 item 1).
- **Risk:** low; visual-only. Rides the same shared-primitive lane as the Button.tsx contrast P1 (PR-A).
- **Test:** RUNTIME-CHECK #1 (does the built bundle's CSS reset suppress default outlines?); snapshot tests on the primitives.

**F3 — Timeline auto-scroll ungated.**
- **Where:** `ArgumentTimelineMap.tsx:784` — `animated: true` hardcoded (verified).
- **What/why:** T9 is the highest-frequency motion in the room (fires on every active-node change) and it ignores reduce-motion entirely, in a file that gates correctly 50 lines later (`:830-833`).
- **Change:** one token — `animated: !effectiveReducedMotion` + dep.
- **Risk:** trivial. **Test:** RM-on unit test asserting `animated:false`; manual scrub with OS reduce-motion set.

**F4 — DeletionRequestSheet hardcoded slide.**
- **Where:** `DeletionRequestSheet.tsx:47` (verified; no `reduceMotion` prop anywhere in the file).
- **What/why:** live shipped surface; a full-height slide is exactly the vestibular-relevant motion class, and all five sibling sheets gate — a straight doctrine violation, not a style choice. (Severity resolved P1: motion reader's P1 over overlays' P2.)
- **Change:** add the prop + gate like its five siblings. Merge-in while touching the file: `accessibilityLabel="deletion-request-sheet"` (`:49`, also `:68-83`) is read verbatim by screen readers — replace with plain language, keep slugs as `testID`.
- **Risk:** trivial. **Test:** RM-on renders `animationType="none"`; SR label test asserts human-readable text.

**F6b/c/d — Silent-failure siblings (remain P1; same fix template as F6a).**
- **F6b Google sign-in initiation voided:** `AuthScreen.tsx:248-250` discards the `signInWithGoogle.ts:29-70` result — a dead tap at the front door.
- **F6c In-room rail join failure → no-op:** `App.tsx:1483-1498` + `seatClaimModel.ts:333-340` map error to `{kind:'none'}`; the error renders only on unmounted screens.
- **F6d Proof-items fetch error renders as "no sources":** `useProofItems.ts:66-69`, no error field — misleads on the evidence spine, the surface the mission most depends on being honest.
- **Change (family template):** hooks return `{data, loading, error, refetch}`; the room shows one quiet live-region strip (`BooleanFeedbackBar.tsx:151-176` pattern).
- **Risk:** low per hook; ~10 files (UX_ACTION_PLAN PR-B). **Test:** per-hook error-path unit tests + RUNTIME-CHECK #7 offline pass. Note the global auth-expiry scenario (critic #11): a JWT expiring mid-room fires this whole family *simultaneously* — the room quietly degrades to "no sources, no markers, seats open". Carried in the register.

### P2

| # | Finding | Where | Change / note |
|---|---|---|---|
| F7 | **Two timing systems** — custom 140/160/180ms vs platform ~300ms Modal class; the Modal path also plays exits where the custom path does not | `AddAnnotationSheet.tsx:120` et al. vs `ArgumentComposerDock.tsx:522`, `Popout.tsx:206` | Harmonize per §5. RUNTIME-CHECK #3 (RNW Modal actual duration/exit) |
| F8 | **Universal enter-animate/exit-snap; dead `toValue:0` branches in all 5 animators** | `ArgumentSideActionRail.tsx:353`, `OpenIssuesRail.tsx:222`, `DisagreementPointsRail.tsx:374`, `ArgumentComposerDock.tsx:514`, `Popout.tsx:200` | Policy ruling needed — §5 recommends bless-exit-snap + delete dead code (maintainability: dead branches invite cargo-cult copies) |
| F9 | **TimelineMiniMap dead heightAnim** | `TimelineMiniMap.tsx:283-299` (verified: drives no style) | Delete (cheaper) or bind; 140ms JS-driver work wasted per toggle |
| F10 | **Confirm-family RM drift** — same dialog behaves differently by entry point | `MakePrivateConfirmation.tsx:72` ungated fade, no prop (`:18-24`); settle confirm supports the prop but the `DebateDetailHeader.tsx:525-532` mount omits it (reopen path passes it, `RoomSettledNotice.tsx:94`) | Add the prop to both mounts; one-token fixes |
| F11 | **`useReduceMotion` hook: 1 consumer, 8 inline copies** (canon count) | inline copies: `ArgumentSideActionRail.tsx:236-269`, `OpenIssuesRail.tsx:135-165`, `ArgumentComposerDock.tsx:175-209`, `Popout.tsx:110-144`, `TimelineNodePopover.tsx:126`, `TimelineNodeActionDock.tsx:61-63`, `DemoCorridorScreen.tsx:67-82` (+ `useUserPreferences.ts:73-89` stays by design); sole consumer `DisagreementPointsRail.tsx:50,230` | Mechanical sweep onto `useReduceMotion(reduceMotionOverride)`; MEMORY doctrine says reuse-never-re-inline |
| F13 | **Silent read-hook siblings** (below the F6 fold) | `useMarkers.ts:68-71` (rebuttal chips vanish), `useMoveMarks.ts:95-97` (dodge aggregate zeroes; the write path is exemplary — the asymmetry proves fixability), `useChimeInContributions.ts:75-78` (seats read as open → invites the 409 that then fails silently per F6a) | Same PR-B template. Note `useMyCircles.ts:10,40-44` is a *documented-intentional* silent hook ("error stays null by construction") — tag by-design so the family fix doesn't "fix" it (critic #1) |
| F14 *(P1 — promoted per UX_ACTION_PLAN P1-8)* | **Gallery renders LoadingNotice AND lane EmptyState simultaneously on first load** | `ConversationGalleryScreen.tsx:370` vs `:380` — **no `!loading` guard (verified)**; `ArgumentTreeScreen.tsx:278` does it right | Add the guard: fixes the layout-shift flash and the false "empty" SR announcement in one line (§6 item 4) |
| F15 | **Join-panel failure lands on an unmounted screen** | `ConversationGalleryScreen.tsx:234-250`, `JoinDebatePanel.tsx:23-28`, `useDebates.ts:100-102`; the displaced banner's Retry retries the *list* fetch, not the join | Route the error to the mounted surface; Retry must retry the join |
| F16 | **Dormant toast copy, no toast surface** | `gameCopy.ts:1746` (`confirmation_post_action_toast`), `:1822` (`settle_toast`) — referenced nowhere; make-private/settle succeed silently | Build the polite live-region strip or delete the keys |
| F17 | **Third confirm grammar in admin** | inline faux-dialog `AdminDebatesTab.tsx:319-368` (no Modal/scrim/Esc, slug label `:322`) vs Modal+alert confirms vs checkbox gate (`AdminUserDetailPanel.tsx:37,78-83`) | Converge on the RoomSettleConfirmation grammar (see §4 last bullet) |
| F18 | **Zero hover states on web** | grep: no `onHoverIn`/`hovered` in src; no CSS | Add via the same shared primitives as F2, fill-shift only (RM-neutral) |
| T19 | **Gallery nested scroll / double scrollbar under ~230px chrome** | RUNTIME 2026-07-12 authed walk @487px (finding 8) | One scroller owns vertical scroll; see §6 item 5. Header-density itself is a SURFACE_MAP/COHESION item; the scroll capture is the motion/behavior half |

### P3

| # | Finding | Where | Note |
|---|---|---|---|
| F19 | LayoutAnimation pair web-inert (T12) | `SourceChainPopover.tsx:236` | Accept + comment, or replace with the house Animated pattern. RUNTIME-CHECK #4 |
| F20 | Press-feedback gating 2-files-only | `ArgumentStateRail.tsx:116`, `ArgumentEntryComposer.tsx:401` | Recommend ruling: instant pressed swaps are exempt from RM (matches `AcceptanceGradientControl.tsx:23-25` doctrine); remove the two gates |
| F21 | PreSendReviewSheet light-palette outlier in dark app | `PreSendReviewSheet.tsx:392-399` | Style-audit lane; its dismiss grammar is correct for draft safety — keep |
| F22 | Settle swap layout shift (T18) | `App.tsx:1592` | Rare event. Optional gated 180ms opacity swap — **SUBJECTIVE DESIGN DIRECTION** (the shift itself is real; the tween is taste). Never a height tween |
| F23 | Scrim grammar: 3 undocumented dialects | dismiss: `Popout.tsx:214-224`, `AddAnnotationSheet.tsx:125-131`; inert: dock `:530-542`, `PreSendReviewSheet.tsx:208-215`; non-interactive: 7 confirms/sheets | Defensible split — document it; standardize scrim AT exposure on the AddAnnotationSheet labelled-Close pattern |
| F24 | Doc/code mismatch: role dialog claimed, none rendered | `SourceChainPopover.tsx:19` vs `:297` | Fix comment or role |
| F25 | Only centered Modal with no alert role or `accessibilityViewIsModal` | `RoomUnavailableNotice.tsx:37-58` | One-line role add |
| F26 | microMoment banner: no dismiss, not live-region announced | `ArgumentRoom.tsx:2996-3020` | SR users may never encounter it |
| F27 | Linked-prior "couldn't refresh" strip designed, never wired | `useLinkedPriorRooms.ts:221`, `linkedPriorArgumentCopy.ts:58` (zero importers) | Wire or delete |
| F28 | ArgumentHome full-screen error wipes populated content | `ArgumentHome.tsx:206-217` | Gallery's banner-over-content is the right sibling pattern |
| F29 | Bundle: DebateListScreen error has no tappable retry (web lacks pull-to-refresh, `DebateListScreen.tsx:333`); FlagSummary blocking-vs-advisory by color only (`FlagSummary.tsx:13-20`; moot if the tree lens is dead in prod — RUNTIME-CHECK #6); AdminMetadataEventsTab selector failure masquerades as empty (`:80,139`); callback retry banner lacks decline affordance (`App.tsx:1630-1645`); ProofDrawer no keyboard close (`ProofDrawer.tsx:157`); settle/reopen failures always read as network copy (`DebateDetailHeader.tsx:288-291`, `useDebates.ts:124,142`) | (as cited) | Fold into PR-B/state-honesty lane where cheap |
| F30 | Chime governance reactions session-ephemeral, no impermanence cue | `useChimeInGovernance.ts:4-15` | Add "this session only" microcopy until persistence lands |

---

## 4. Positive baseline (do not change; cite in the doctrine doc)

- Gated exemplars: `DisagreementPointsRail.tsx:320,331` + `ArgumentTimelineMap.tsx:830-833,851-854` — the house pattern the rest should copy.
- The inert-parity-prop honesty class (`RefereeBannerView.tsx:130` et al.) — keep the void-with-comment idiom.
- `AddAnnotationSheet.tsx:117-227` — best-practice sheet (gated, labelled-Close scrim exposure).
- Mount-order Modal stacking contract (`App.tsx:544-545`).
- Healthy deliberate state coverage across gallery/room/admin/auth/composer/notifications/ProofDrawer (citation list at `ArgumentTreeScreen.tsx:646` reader item).
- `DevEnvironmentBanner` intentionally dormant (`App.tsx:509-512`); InviteRedeemGate/StartArgumentSheet are lane screens, not overlays (`App.tsx:456,1215-1247`).
- Bubble-stack static fan (T11) — RM-safe by construction; instant promotion is a defensible snap-first trade.
- Voice pre-registration: the voice flags (`featureFlags.ts:223-241`) gate no motion code yet — pre-register the RoomSettleConfirmation grammar (Modal + alert role + consequence bullets + reduceMotion + busy) as the one-time-playback gate pattern **before** the voice lane ships a fourth confirm dialect.

---

## 5. Harmonization recommendation — one timing/easing vocabulary

1. **Tokens:** add `MOTION` to `src/lib/designTokens.ts` (currently zero motion tokens; `POPOUT_FLASH_DURATION_MS` at `Popout.tsx:44` is the sole named duration): `MOTION.flash = 140` (popout), `MOTION.surface = 160` (rails + sheets), `MOTION.dock = 180` — or collapse dock into 160 for a two-token vocabulary (**SUBJECTIVE DESIGN DIRECTION**; either is coherent). Consume in all five animators: `Popout.tsx`, `ArgumentSideActionRail.tsx`, `OpenIssuesRail.tsx`, `DisagreementPointsRail.tsx`, `ArgumentComposerDock.tsx`.
2. **Easing:** bless the `Animated.timing` default (zero `Easing` imports repo-wide) as the documented house curve. No new easing vocabulary — maintainability, not taste.
3. **Kill the second timing system:** migrate the six `animationType` sheets (T7) to `animationType="none"` + the house 160ms opacity+translate pattern with RM snap — this simultaneously fixes the two ungated stragglers (F4 `DeletionRequestSheet.tsx:47`, F10 `MakePrivateConfirmation.tsx:72`) and unifies exit behavior. Fallback if migration is deferred: explicitly bless Modal-default as the full-scrim-sheet tier and document a two-tier system — but the single-vocabulary answer is migration.
4. **Exit policy ruling:** bless exit-snap as intentional house behavior (matches the app's snap-first identity, T11/T14) and delete the five dead `toValue:0` branches (F8) — cheaper and honest. Alternative (mount-until-finished exit parity) only if the operator wants it — **SUBJECTIVE DESIGN DIRECTION**.
5. **RM plumbing:** sweep the 8 inline `AccessibilityInfo` copies onto `useReduceMotion(reduceMotionOverride)` (F11; canon: the hook has exactly 1 consumer today). One-token gate fixes at `ArgumentTimelineMap.tsx:784`, `DeletionRequestSheet.tsx:47`, `MakePrivateConfirmation.tsx:72`, `DebateDetailHeader.tsx:525`.
6. **Rulings needed (one line each):** exit policy (item 4), Modal migration vs two-tier (item 3), pressed-style RM exemption (F20), scrim three-dialect documentation (F23).
7. **Packaging:** ship items 1–5 as one low-risk motion-consistency card (behavior-preserving or strictly a11y-additive). The F1/F2 focus work is a separate a11y card via shared primitives — it belongs to the P0 cluster in UX_ACTION_PLAN Wave 1, not to this card.

---

## 6. Layout-shift & scroll-behavior fix list (ranked)

1. **Focus-ring border growth** — `PointFeedbackFlagPill.tsx:125-138` (and any F2 rollout): reserve a transparent base border of equal width so focusing never resizes. Fix concurrently with the F2 rollout or it multiplies across every primitive.
2. **Settle swap bottom-band jump** — `App.tsx:1539,1559,1592-1598`: composer unmounts + a differently-sized RoomSettledNotice mounts in one commit, mid-read. Optional gated 180ms opacity swap (**SUBJECTIVE DESIGN DIRECTION**); never a height tween.
3. **Post-load chip pop-in** — proof/marker/chime chips grow rows after first paint (`ArgumentRoom.tsx:846` unused loading flags): one "loading sources…" header hint, not skeletons (no skeleton pattern exists app-wide — keep it that way).
4. **Gallery false-empty flash** — `ConversationGalleryScreen.tsx:380`: add the `!loading` guard (also fixes the false SR "empty" announcement, F14).
5. **Gallery nested scroll / double scrollbar** — RUNTIME 2026-07-12 authed walk @487px (finding 8): the card list scrolls inside the page scroll under ~230px of fixed masthead+nav chrome; two scrollbars render and wheel/swipe capture depends on pointer position. One scroller should own vertical scroll (flatten the inner list into the page scroll, or make the list the page). The chrome-height half of the finding belongs to SURFACE_MAP/COHESION; the scroll behavior is fixed here.
6. **PacingChip digit jitter** — `PacingChip.tsx:28-31` countdown text: `fontVariant: ['tabular-nums']`.
7. **RoomSettledNotice post-hoc errorMessage row** (`RoomSettledNotice.tsx:81-85`) and **rail helperHint insert** (`ArgumentSideActionRail.tsx:494-496`) — reserve or accept; lowest priority.

All static magnitudes are inferences — **RUNTIME-CHECK** rendered geometry in the browser pass (register #5).

---

## 7. RUNTIME-CHECK register (operator-authed browser pass on dev-cdiscourse.netlify.app)

Carried from the synthesis digest + the runtime walk's coverage gaps. The 2026-07-12 walk ran at ~487px as an admin; items below remain open.

1. **Focus behavior:** Tab-through with each overlay open (F1); whether default focus outlines survive the built bundle's CSS reset (F2); ProfileTagPopout→PreferencesPopout focus/context return (`App.tsx:544-545` comment-only claim). Includes **visual layering** verification: does the mount-order Modal stacking contract actually produce the expected z-order with multiple overlays live.
2. **Esc:** does one press with ActPopout (or PreSendReviewSheet) open also collapse the dock (F5 — the double-fire is inferred); does RNW Modal fire `onRequestClose` on Escape for the backdrop-inert confirms.
3. **Modal open/close symmetry at real frame rates:** RNW `animationType` actual duration/easing, and whether exit animations play at all (F7/F8 harmonization premise) — measure at real frame rates, not inferred from source.
4. **LayoutAnimation truly no-op on the live build** (F19; the try/catch masks either outcome).
5. **Layout-shift magnitudes from §6**; gallery double-render visibility (does the EmptyState sit below the fold); gallery nested-scroll behavior at widths above 487px (does the double-scrollbar persist on desktop widths — RUNTIME 2026-07-12 authed walk @487px covered narrow only).
6. **Tree-lens reachability:** is the legacy tree lens (ArgumentNode + FlagSummary, `ArgumentTreeScreen.tsx:296`) reachable under the 9-live-flag config (decides F29-FlagSummary).
7. **Silent-hook failure renderings:** untestable statically (no telemetry); simulate offline and confirm the F6/F13 renderings; additionally simulate an **expired session** (critic #11) — the whole silent-hook family fails simultaneously and the room quietly degrades.
8. **Not located statically:** COPY-001 "first-run explainer" as an overlay (only the `ArgumentHome.tsx:377` empty-state headline exists) — confirm folded/removed. Native-platform behaviors (hardware back on MarkerPhrasePickerSheet, VoiceOver/TalkBack) out of scope for the web pass.
9. **Coverage gaps from the 2026-07-12 walk** (finding 11): wide-viewport behavior untested (preview pane ~487px); the authed pass ran as an admin — plain-user rendering unverified; deep states (playback, moderation) untriggered.

---

## 8. Contradiction resolutions / dedupe log

- **DeletionRequestSheet severity:** motion reader P1 vs overlays P2 → **P1** (verified in-repo; live surface, vestibular-class slide, sole ungated sibling of five). RM + slug-label findings merged (F4).
- **Chime-in silent failure:** overlays P2 vs states P1 → digest resolved P1; **master-plan canon elevates to P0 (P0-2)** because the flag is live and seats_full/room_private are expected contention paths, not rare network edges. This artifact carries the canon rating (F6a, §3).
- **MakePrivateConfirmation:** both readers P2 → P2 (fade is not vestibular-class); merged with the DebateDetailHeader settle-mount omission into F10.
- **`useReduceMotion` consumer count:** style audit said "2", transitions said 1 — **grep confirms exactly 1** (`DisagreementPointsRail`); the canon number is carried throughout this document.
- **Modal count:** the character summary's "9 RN Modals" and the verified "11 true Modals" reconcile as 9 platform-`animationType` (6 slide + 3 fade) + 2 custom `animationType="none"` = 11; the 12th grep hit (`PreSendReviewSheet.tsx:7`) is a comment (critic-verified).
- No inter-reader factual conflicts survived verification; the four load-bearing claims (ArgumentTimelineMap:784, DeletionRequestSheet:47, ConversationGalleryScreen:380, TimelineMiniMap:283-299) were all spot-verified in-repo and held. Overlays' "PreSendReviewSheet snaps always" is consistent with the animator inventory (it authors no animation).
