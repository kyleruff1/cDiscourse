# UX Artifact Cleanup Audit — ux-continuity-2026-07

**Artifact 4 of 7** in the UX/Product-Surface Continuity Audit (`docs/audits/ux-continuity-2026-07/`).
**Scope:** dead/dormant components, dead flag UI, debug/dev surfaces, placeholder copy, reserved-but-unrendered doctrine-risky props, z-index/overflow/focus/aria issues (including the canonical P0 cluster), fixture-leakage checks. Every item is tagged **safe-cleanup**, **risky-cleanup**, or **keep-by-design**, and slotted into a removal order.
**Sources:** the cleanup synthesis digest (8-reader → 5-synthesizer → completeness-critic workflow, read-only over the audit worktree), the completeness critic (gaps #2 and #6 folded here), and the operator-authed runtime walk of the live site (cited as `RUNTIME 2026-07-12 authed walk @487px`). No finding in this document is invented; every claim keeps its source citation.

**Root macro:** `WT = C:/Users/kyler/cdiscourse/wt-voice-adr` — all `WT/...` citations are absolute paths under this root (src identical to origin/main `da32f56b`).

**Flag-state caveat (global):** prod flag state (9 live / 2 dark voice flags, `room_exchange_v2` ON) comes from session memory, not code — every "unreachable in prod" claim below is conditional on it. Carried as RUNTIME-CHECK R-7.

---

## 0. Severity canon applied (binding rulings)

The critic found the severity ledger inconsistent across digests; the plan ruled one canon. This artifact applies it:

| Ruling | Canonical severity | Effect on this artifact |
|---|---|---|
| Chime-in silent failure | **P0** (P0-2; flag LIVE, expected-contention 409s silently discarded → misleads) | Digest item #16 promoted from P2 → **P0**, moved to §2 |
| Focus / Esc / corridor / containment cluster | **P0** (unanimous; must not be dropped; appears in UX_ACTION_PLAN Wave 1) | Digest items #1, #2, #3, #13, #14 promoted → **P0**, §2 |
| Button.tsx contrast | **P1** (4.47:1 hair-miss; rides PR-A) | Not a cleanup item — lives in `UX_STYLE_SYSTEM_AUDIT.md`; listed here only so the canon reads consistently across artifacts |
| useReduceMotion consumer count | **1** (grep-verified: DisagreementPointsRail only) | Carried wherever reduce-motion threading appears (#10, #11, #12) |

The digest's original static-confidence note stands for provenance: *no P0s were confirmed statically; the promotions above are the canon's ruling* (the cluster was "promote to P0 if runtime confirms" in the digest; the canon ruled it P0 outright because the live platform is web and the claims are grep-exact).

---

## 1. Verification provenance

The cleanup synthesis pass performed these read-only verifications before writing (all held):

- CONFIRMED `handlePrimaryNav` writes tab/start/lane/about but never `setDemoCorridorOpen(false)` (`WT/App.tsx:1028-1044`) — the corridor nav trap is real.
- CONFIRMED the mic slot renders unconditionally with comment "Reserved voice slot — disabled until VOICE-UI-001" (`WT/src/features/arguments/composer/ArgumentEntryComposer.tsx:369-379`) — no flag read.
- CONFIRMED zero `.focus(` calls anywhere in `WT/src` (grep: no matches) — the no-focus-management claim is exact.
- CONFIRMED Popout Esc listener uses `preventDefault` only, no `stopPropagation` (`WT/src/features/arguments/oneBox/Popout.tsx:166-180`) — double-dismiss is structurally possible; actual behavior stays RUNTIME-CHECK.
- CONFIRMED `DebateListScreen` has zero references in `WT/App.tsx` (grep: no matches) — dead.
- CONFIRMED `WT/src/lib/featureFlags.ts:194-197` chime_in doc points at `oneToOneRoomModel.chimeAffordanceVisible` (unmounted model, hardcoded false) while the real mounted affordance is `ChimeInAffordance` — stale pointer verified; the comment does correctly name ChimeInGovernanceSurface.
- Contradiction resolved: DebateListScreen severity (leftovers P3 vs surfaces P2) → **P2** — dead code that recent cards (ARG-ROOM-006) still paid parity tax on actively misleads implementers.
- Critic spot-checks (independent, also held): `ArgumentRoom.tsx:2396` Share routing with no `onShareRoom` caller anywhere; FistBumpReaction / NodeLabelStrip / AnnotationEdgeHighlight zero production mounts.

---

## 2. P0 — canonical cluster (do not drop; cross-referenced into UX_ACTION_PLAN Wave 1)

### P0-A. Zero programmatic focus management on any overlay (RN-web is the live platform) — digest #2

- **Where:** `WT/src/features/arguments/oneBox/Popout.tsx:208,241`; also `ArgumentComposerDock.tsx:524,546`, `PreSendReviewSheet.tsx:205,219`, `AddAnnotationSheet.tsx:136`, `RequestReviewComposer.tsx:176`.
- **What:** All overlay "trap" claims rest on `accessibilityViewIsModal` — iOS-only; it is not `aria-modal` on RN-web. Grep-confirmed **zero `.focus()` in src**. No overlay sets initial focus, contains Tab, or restores focus on close.
- **Why it matters:** a11y — keyboard and screen-reader users on the live web platform can Tab straight behind every modal; overlays are not modal at all for them. This is the audit's number-one severity item.
- **Change:** new web-only focus utility (initial focus + Tab containment + focus restore) adopted in the Popout chassis + Modal sheets first.
- **Risk:** **risky-cleanup** — a shared utility touches every overlay; regressions would be app-wide. Land in the chassis first, then sheets.
- **Test:** RUNTIME-CHECK R-1 (tab-behind-modal on dev-cdiscourse.netlify.app) before/after; jest coverage on the utility's mount/unmount focus bookkeeping.

### P0-B. Escape double-dismiss collision (dock under layered overlays) — digest #3

- **Where:** `WT/src/features/arguments/composer/composerKeyboardModel.ts:102-104` returns `close` unconditionally; dock listener `WT/src/features/arguments/ArgumentComposerDock.tsx:296-335`; Popout listener `Popout.tsx:166-180` (no `stopPropagation`, verified).
- **What:** One Esc with ActPopout or PreSendReviewSheet open likely closes both layers — contradicting the inert-scrim draft-protection grammar (`PreSendReviewSheet.tsx:208-215`).
- **Why it matters:** utility + draft safety — the draft-protection sheet exists to prevent accidental loss; a single keystroke bypassing it defeats the grammar.
- **Change:** thread overlay-open state into `resolveComposerKeyEffect`, or have the topmost overlay `stopImmediatePropagation`.
- **Risk:** **safe-cleanup** (localized keyboard-model change; behavior pinned by model tests).
- **Test:** RUNTIME-CHECK R-2 (single Esc press with layered overlays — one layer or two?); model unit test for the new overlay-open input.

### P0-C. Demo corridor traps the primary nav — digest #1

- **Where:** `WT/App.tsx:1028-1044` (handler), `:1189-1196` (guards), `:1673-1677` (Account/Admin).
- **What:** `handlePrimaryNav` never clears `demoCorridorOpen`; About mount requires `!demoCorridorOpen` (`:1196`); gallery blocks guarded at `:1255`/`:1289`; Account/Admin lack the guard so DemoCorridorScreen + AccountScreen/AdminScreen **co-render**. Primary nav reads as dead until the corridor's own Close.
- **Why it matters:** utility — the app's primary navigation silently stops working inside an onboarding surface; new users hit this first.
- **Change:** clear `demoCorridorOpen` in `handlePrimaryNav` and/or gate corridor mount on `activeTab === 'arguments'`.
- **Risk:** **safe-cleanup** (statically confirmed; single-handler change).
- **Test:** RUNTIME-CHECK R-4 (corridor open → tap Account/Admin: visual co-render outcome); jest on the nav handler clearing corridor state. This fix can ship ahead of the rest of the cluster.

### P0-D. MarkerPhrasePickerSheet: single dismiss path, no modal semantics, background keyboard live — digest #13

- **Where:** `WT/src/features/arguments/markers/MarkerPhrasePickerSheet.tsx:51,60-69,102-129`; exclusion from `hasOpenMenu` at `ArgumentRoom.tsx:2784,2852`.
- **What:** Cancel-only dismissal (no Esc, no `onRequestClose`/hardware back, no `accessibilityViewIsModal`); because it is excluded from `hasOpenMenu`, room A/I/G shortcuts + arrow navigation fire **behind** the open sheet.
- **Why it matters:** a11y + utility — keyboard users can mutate room state underneath an open picker; there is exactly one way out of the sheet.
- **Change:** wrap in the core Modal pattern or add Esc + backdrop dismiss + `hasOpenMenu` inclusion.
- **Risk:** **safe-cleanup** (containment addition; no data path).
- **Test:** keyboard-shortcut suppression test while sheet open; Esc-dismiss test.

### P0-E. RequestReviewComposer: same containment pattern — digest #14

- **Where:** `WT/src/features/requestReview/RequestReviewComposer.tsx:172,307,335-336`; excluded from `hasOpenMenu` (`ArgumentRoom.tsx:2784`).
- **What/Why/Change/Risk/Test:** identical class to P0-D — Cancel-only, not a Modal, room shortcuts live behind it. Same treatment as P0-D; **safe-cleanup**; same test shape.

### P0-F. Chime-in attach/retract failures are silent — digest #16 (canon: P0-2)

- **Where:** `WT/src/features/arguments/room/ArgumentRoom.tsx:1019-1042` (checks `res.ok` only for refetch); unused error copy at `chimeInApi.ts:41`; contrast: quote_forge got a retry banner (`WT/App.tsx:1630-1645`).
- **What:** With the chime_in flag LIVE, a user's attach/retract action can fail (409s are *expected contention* in the seat model) and the UI discards the failure invisibly. The error copy already exists and is never rendered.
- **Why it matters:** mission + utility — a live, flagged-on user action that fails silently misleads users about what the room state is. The canon rates this the audit's P0-2.
- **Change:** polite live-region banner near ChimeInAffordance mirroring the callbackRetryBanner pattern (`WT/App.tsx:1630-1645`).
- **Risk:** **safe-cleanup** (additive banner; error copy pre-exists).
- **Test:** jest on the failure branch rendering the banner; live smoke: force a seats_full 409 and confirm visible feedback.

---

## 3. P1 — major cohesion / blocks-use

### P1-A. Side-rail "Share" is a production no-op — critic #2 (NEW; folded per commission)

- **Where:** `WT/src/features/arguments/room/ArgumentRoom.tsx:2396` routes `code === 'share'` to `onShareRoom?.()`; grep confirms **no caller anywhere supplies `onShareRoom`** (App.tsx, ArgumentTreeScreen — nothing). The rail model promises "opens a native/browser share sheet" (`ArgumentSideActionRail.tsx:86-100`).
- **What:** Share sits in the observer expanded rail set (Stage 6.4) — every observer sees a button that silently does nothing. (`watch` is a *documented* no-op at `:2395` — that one is fine.)
- **Why it matters:** utility + honesty — same silent-affordance class the audit rates P0/P1 elsewhere (chime, rail-join). The rail copy makes an explicit promise the app cannot keep.
- **Change:** **fix-or-remove — and note it is unfixable-as-specced today:** rooms have no URL. The only history-API usage in src is the auth-callback `replaceState` (`AuthCallbackScreen.tsx:96-99`); no pushState, nothing bookmarkable, no room link exists to share (cross-ref critic #3, carried in `UX_SURFACE_MAP.md` shell section and the ACTION_PLAN design card). Near-term honest option: remove Share from the observer rail set until the URL/router design card lands; long-term: wire `onShareRoom` to a real share sheet once rooms are addressable.
- **Risk:** **risky-cleanup (product decision)** — removal is trivially safe mechanically, but whether to remove vs. hold for the router card is an operator ruling; do not "fix" by sharing a URL that does not exist.
- **Test:** rail-model test asserting Share absent (if removed) or an integration test that `onShareRoom` is supplied (if wired). RUNTIME-CHECK R-10.

---

## 4. Dead / dormant component census

Full census — the digest's entries plus the critic #6 additions. "Dead" = zero production mounts (grep-verified; dynamic imports not observed in this codebase, see residual gaps).

| # | Component | Where | Status / evidence | Tag |
|---|---|---|---|---|
| 4 | **DebateListScreen** | `WT/src/features/debates/DebateListScreen.tsx:229`; barrel `WT/src/features/debates/index.ts:1` | **Dead, still actively maintained** — zero non-test importers (App.tsx grep verified); pinned by 4 test files (`__tests__/DebateListScreen.visibility.test.tsx:2-44`, debateListSort, `responsiveTableFill.test.ts:94-97`, `argumentInactiveLeakageScan.test.ts:71`). Recent cards (ARG-ROOM-006) paid parity tax on it — it actively misleads implementers (critic #6 confirms zero non-test mounts). Sub-finding: its non-tappable "Pull to refresh" error text (`DebateListScreen.tsx:333`) is moot on deletion. | **risky-cleanup** — decide keep-as-fallback vs delete; delete removes barrel export + 4 pin tests together; keep requires an "unmounted since Stage 6.3" header |
| 44 | **FistBumpReaction** | `WT/src/features/concessions/FistBumpReaction.tsx` (QOL-041) | Zero production mounts (critic #6, verified). | **risky-cleanup** — confirm no concession-UX roadmap card intends to mount it, then delete or annotate reserved |
| 45 | **NodeLabelStrip** | barrel-exported `WT/src/features/arguments/nodeLabels/index.ts:179` | Mounted **nowhere**; `ArgumentRoom.tsx:304` comment says "no longer mounted in the DEFAULT view" — understates it (critic #6, verified). | **safe-cleanup** — fix the misleading comment; **risky-cleanup** for deletion (nodeLabels family is live elsewhere via NodeLabelInspectGroups) |
| 46 | **AnnotationEdgeHighlight** | barrel-exported `WT/src/features/arguments/nodeAnnotations/index.ts:101` | Zero production mounts (critic #6, verified). | **risky-cleanup** — same ruling shape as #44 |
| 20 | **PublicRoomMetricsStrip** | `WT/src/features/debates/PublicRoomMetricsStrip.tsx:26`; barrel `index.ts:132` | Zero production mounts; test-only consumers. P8 mounted ChimeInGovernanceSurface instead. | **risky-cleanup** — confirm no chime-in roadmap card mounts it (roadmap intent lives outside the repo), then delete + tests, or annotate reserved. RUNTIME-CHECK R-6-adjacent |
| 5 | **Legacy stack/CardDetail chassis** | `WT/src/features/arguments/room/ExchangeView.tsx:127-190` (flag-off branch, byte-preserved pin `argumentGameSurfaceSemanticWiring.test.tsx`); `ArgumentRoom.tsx:3046-3052` | Unreachable prod branch whose inputs (`activeCardDetail`/`activeMappingSection`/`activeRefereeCard`) are **still derived every render**; RingsideFeed receives none (`ExchangeView.tsx:129-152`). CardDetailPanel (~1100 lines) + RefereeCardView invisible to real users. Wasted render work + maintenance surface. | **keep-by-design (pinned fallback) + risky-cleanup card** — skip derivations when Ringside renders, or port panels into RingsideCard; decide before deleting anything |
| 40 | **Legacy `tree` + `tracks` view modes** | `WT/src/features/arguments/ArgumentTreeScreen.tsx:192-205,247-323`; `ArgumentTimelineScreen.tsx:25`; chips `WT/App.tsx:1403-1404` | Compiled in, dev-chip-only. | **keep-by-design** (dev tooling); delete eventually with the legacy chassis (#5) |
| 41 | **`src/features/analytics` harness modules** | `WT/src/features/analytics/visualQaFixtures.ts:93`, boardDiagnostics.ts (test-only), treePlayabilityDiagnostics.ts (scripts-only consumer) | Test/scripts harnesses living under an app path; bundle exclusion inferred, not proven. | **safe-cleanup** (relocate to scripts/ or annotate harness-only headers). RUNTIME-CHECK R-6 |

**Also-mounted-but-uncounted** (critic #6 — fine, just absent from earlier counts; recorded so the census is complete): MetadataDiffInspector, NodeLabelInspectGroups, **GradientWaveRail** (verified static — "No animation" header — so the transitions inventory is not wrong, but it belongs in the rail/style inventory), ComposerContextStrip, CollapsedComposerStrip, DemoComposerPanel/DemoCorridorGuidancePanel. No action; keep them in future census baselines.

---

## 5. Dead flag UI / misleading affordances

### 5.1 Ungated "Voice — coming soon" disabled mic slot, live in prod — digest #7

- **Where:** `WT/src/features/arguments/composer/ArgumentEntryComposer.tsx:369-379` (verified unconditional; comment "Reserved voice slot — disabled until VOICE-UI-001"); copy `argumentEntryComposerModel.ts:50-51`; mounts whenever room_exchange_v2 ON (`WT/App.tsx:1559-1586`); does **not** read `isVoiceEntriesEnabled`.
- **What:** an inert tab-stop plus a public promise gated on the unruled/paused VOICE-ADR-002. Two carried voice risks compound it (plan Part B, critic #10): (a) `one_time_playback` OFF while `voice_entries` ON would store voice replayable without receipts — contradicting the consent sheet's one-listen promise; (b) ADR ruling D4 launches voice private-1:1-only, but this teaser renders in **all** room types including circle rooms — the teaser must respect D4's room gating when voice ships.
- **Why it matters:** honesty (a promise with no ruling behind it), a11y (inert element potentially in web tab order), and doctrine-coupling risk at voice flip time.
- **Change:** gate behind `isVoiceEntriesEnabled` or keep as deliberate roadmap signaling — **record the ruling either way**; if kept, exclude from focus order and pre-plan the D4 room-type gate.
- **Risk:** **risky-cleanup (product decision)**.
- **Test:** RUNTIME-CHECK R-3 (is the disabled Pressable in web tab order); flag-gating unit test once ruled.

### 5.2 Dark voice flags — registry-only, zero consumers — keep-by-design

`WT/src/lib/featureFlags.ts:120,136,223-241` — the voice pair exists only in the flag registry; no accidental surface can light. Gated on VOICE-ADR-002. When VOICE-* lands, adopt the RoomSettleConfirmation grammar (Modal + alert + consequence bullets + reduceMotion + busy) as the one-time-playback gate — pre-registered target to avoid a fourth confirm dialect. **Tag: keep-by-design.**

### 5.3 Dead toast copy with no toast surface — digest #8

`WT/src/features/arguments/gameCopy.ts:1746` (`confirmation_post_action_toast`), `:1822` (`settle_toast`); zero references, no toast/snackbar component exists in the app. Make-private/settle succeed **silently**. **Why:** either dead weight or a missing feedback surface — pick one. **Change:** delete the keys (**safe-cleanup**) or build the polite live-region strip (**risky-cleanup**) — decide before Wave 3. **Test:** copy-reference scan; if built, live-region announce test.

### 5.4 featureFlags chime_in doc stale pointer — digest #25

`WT/src/lib/featureFlags.ts:195-197` names unmounted `oneToOneRoomModel.chimeAffordanceVisible` (VERIFIED — hardcoded false, unmounted) while the real gate is ChimeInAffordance (`ArgumentRoom.tsx:2981`). **Change:** comment fix only. **Tag: safe-cleanup.** Companion: the oneToOneRoomModel/oneToOneRoomLifecycle display cluster is model-only with no renderer (`WT/src/features/debates/oneToOneRoomModel.ts:178,258`, `oneToOneRoomLifecycle.ts:391`, `gameCopy.ts:1904`) — **keep-by-design** (1v1-room scaffolding) + add a "no surface consumes this yet" header.

---

## 6. Debug / dev surfaces

### 6.1 AccountScreen live debug leftover: "ADMIN? true" row + support placeholder — RUNTIME finding 6 (NEW)

- **Where:** Account surface on the live site — literal **"ADMIN? true"** row plus a **"Contact support to change your role"** placeholder (RUNTIME 2026-07-12 authed walk @487px, finding 6; severity P2 per the runtime ledger).
- **What:** a raw boolean debug row shipping on a production account screen, next to placeholder support copy with no support channel behind it.
- **Why it matters:** cohesion + honesty — debug-grammar text ("ADMIN? true") on a user-facing surface reads as unfinished; the support line promises a path that does not exist.
- **Change:** remove the debug row (or render a proper role label via the existing plain-language copy layer, `gameCopy.toPlainLanguage` already maps `moderator`/`observer` codes); replace or delete the support placeholder.
- **Risk:** **safe-cleanup** (display-only).
- **Test:** RUNTIME-CHECK R-11 — the walk ran as an admin (kyleruff+devtests1); confirm what a plain user sees ("ADMIN? false"? nothing?) before writing the fix.

### 6.2 `__DEV__` surfaces — all correctly gated — keep-by-design

Verified: ComposerValidationPanel (`ComposerValidationPanel.tsx:103-166`); DebateDetailHeader dev rows (`DebateDetailHeader.tsx:302,487,499`); SessionDebugPanel (`WT/App.tsx:1681,891`); dev pacing override (`ArgumentComposerDock.tsx:236`, `pacingModel.ts:477-486`); QOL-040.3 warn (`ArgumentRoom.tsx:713-725`). **Tag: keep-by-design.** Bundle stripping is inferred, not proven — RUNTIME-CHECK R-6 (deployed bundle scan).

### 6.3 DevEnvironmentBanner — deliberate dormancy — keep-by-design

`WT/App.tsx:162-165,509-512`; non-mount is test-pinned (`appHeader.test.ts:149-151`). This is the healthy documented-dormancy pattern other reserved components (#44–#46, #20) should copy.

### 6.4 devEnvironmentModel stale patterns + wrong header — digest #19

`WT/src/features/devEnvironment/devEnvironmentModel.ts:4,147-150` — no reseed pattern; header claims gallery consumption (gallery actually uses botRoomPolicyModel); sole consumer DevEnvironmentBanner is unmounted. **Change:** fix header; delete `getBotOrTestDebateKind` in favor of botRoomPolicyModel, or sync. **Tag: safe-cleanup.**

### 6.5 Demo Corridor teaches the legacy stack UI, not live Ringside — digest #6

`WT/src/features/demoCorridor/DemoCorridorScreen.tsx:180-203` mounts ArgumentGameSurface with `initialMode="stack"`, no roomExchangeV2Enabled/ringsideFeed. **Why:** onboarding shows an interface prod users never see — a training surface that mis-trains. **Change:** thread the flag + fixture feed, or document the divergence; verify scripted beats map to Ringside affordances. **Tag: risky-cleanup.**

### 6.6 Production import from devFixtures — digest #24

`WT/src/features/pointStanding/concessionEffects.ts:10` imports CONCESSION_MARKERS from `../devFixtures/argumentScenarioValidation`; prod-load-bearing via `pointStanding/index.ts:11`, `eligibility.ts:16`, `scoringEngine.ts:24`. **Why:** maintainability — prod behavior depends on a fixtures directory. **Change:** move markers into pointStanding as the single source, devFixtures imports back; byte-identical values (tests pin behavior). **Tag: risky-cleanup.**

---

## 7. Placeholder copy / stale barrels / dead props

| # | Item | Where | What / why | Change | Tag |
|---|---|---|---|---|---|
| 21 | Dead prop `ArgumentEntryComposer.activeMessageId` | `WT/src/features/arguments/composer/ArgumentEntryComposer.tsx:64-65`; supplied at `WT/App.tsx:1564`; never read in body | Maintenance noise; implies a divergence cue that does not exist | Remove prop + pass-through, or wire the reserved divergence cue | **safe-cleanup** |
| 22 | Stale placeholder barrels | `WT/src/features/moderation/index.ts:1` (empty Stage-5 husk); `WT/src/features/auth/index.ts:1` (claims "will contain AuthScreen…" while 12 sibling files exist, imported direct-path) | Misleads implementers about module layout | Delete moderation dir or pointer-comment; rewrite auth barrel honestly | **safe-cleanup** |
| 23 | ChimeInGovernanceControl stray barrel export | `WT/src/features/debates/index.ts:131`; Control is Surface-internal (`ChimeInGovernanceSurface.tsx:128`); no external importer (tests import direct-path, `chimeInGovernanceControl.test.tsx:22`) | Fake public API surface | Drop the export | **safe-cleanup** |
| 26 | SourceChainPopover doc/code role drift | `WT/src/features/evidence/SourceChainPopover.tsx:19` promises `role dialog`; code renders `none` (`:297`) | Doc lies to the next implementer; `none` is arguably correct inline | Fix the comment | **safe-cleanup** |
| 27 | Promised structured logger still absent | `WT/src/features/metadata/usePointTagsRealtime.ts:346-366` — prod-reachable console.warn documented as fallback | Known debt, honestly documented | Fold into the eventual logger card | **keep-by-design** |

---

## 8. Reserved-but-unrendered props with doctrine-risky names

### 8.1 `voteScorePreview` / `winnerPreview` / `promotedArgumentCount` — digest #28

- **Where:** `WT/src/features/debates/conversationGalleryModel.ts:338-341` (emitted null/0 at `:1090-1092`); zero readers (reader grep verified).
- **What/why:** CLAUDE.md bans voting/scoring in v1 and "winner" tokens in UI vocabulary. These fields never render — but they sit one careless card away from a doctrine violation: any future gallery card that "just displays the available fields" ships a winner label.
- **Change:** rename doctrine-neutral or delete until a v2 voting design exists. **Safe-cleanup preferred** over keep.
- **Risk/test:** rename is mechanical (zero readers); add a vocabulary scan asserting no `winner`/`vote` tokens in gallery card props if kept.

### 8.2 ROOM-001 rail reserved counts — digest #29

`WT/src/features/arguments/room/argumentStateRailModel.ts:87-92,220-247`: `openChimeInSeatCount` now wired (#761, `ArgumentRoom.tsx:1221-1226`); `savedRecordingCount` hard-empty-gated (cannot leak a blank chip); `watchingCount` accepted but never used in derivation. **Tag: keep-by-design** (VOICE-ADR-002 scaffolding); optional **safe-cleanup:** drop the dead `watchingCount` input.

---

## 9. Fixture leakage

### 9.1 Weave (quote_forge) picker has no fixture-room filter or marker — digest #9

- **Where:** `WT/src/features/arguments/crossRoom/argumentRoomLinksApi.ts:286-300` selects ALL locked debates, raw titles; `linkTargetPickerModel.ts` has zero bot/reseed/clean logic (grep-verified). Contrast baseline: home filters (`WT/src/features/home/homeModel.ts:59-65`), gallery labels (`ConversationGalleryScreen.tsx:26,639` BotRoomMarker). quote_forge is live.
- **What/why:** the digest rated severity data-dependent on whether locked fixture rooms exist in prod. **The runtime walk answered the existence half:** fixture rooms are present and visible in prod — Browse gallery shows 18 smoke rooms as ordinary content with the `[stress …]` tag stripped from display, the raw tag renders inside room titles, and the Start-sheet circles picker lists six raw `[stress …]` circles as "Your circles" (RUNTIME 2026-07-12 authed walk @487px, finding 1; D8 excluded fixtures from HOME only). Whether any are **locked** (weave-eligible) remains unchecked, but the leak class is confirmed live in three sibling surfaces.
- **Change:** filter via `looksLikeBotSeedTag` (or clean titles + BotRoomMarker) for non-admins + a picker-model test mirroring homeModel's.
- **Risk:** **safe-cleanup** (behavioral but additive; do before any further quote_forge promotion).
- **Test:** picker-model fixture-filter test; RUNTIME-CHECK R-5 (locked fixture rooms in the live picker specifically). The broader three-surface fixture leak (P1) is owned by `UX_SURFACE_MAP.md`; this artifact owns the picker lane.

### 9.2 Mirror drift: `argumentArtifactModel` SUFFIX_TAG_PATTERNS missing `reseed` — digest #18

`WT/src/features/arguments/argumentArtifactModel.ts:128-139` claims to mirror `conversationGalleryModel.ts:437-455` which got reseed at `:458-459`; `botRoomPolicyModel.ts:329-330` also has it. Consumers: `AdminArgumentsTab.tsx:46`, `adminArgumentsRoomGroupingModel.ts:33-45` — reseed rooms won't fold in admin grouping. **Change:** add the alternative + a parity test diffing the arrays. **Tag: safe-cleanup.**

(#19 devEnvironmentModel pattern drift is in §6.4 — same grammar-mirror family.)

---

## 10. Overlay grammar drift & remaining a11y items (P2/P3)

Items #13/#14 promoted to P0 (§2). The rest of the confirm-sheet family and minor a11y:

| # | Item | Where | What / why | Change | Tag |
|---|---|---|---|---|---|
| 10 | Settle confirm mounted without reduceMotion | `WT/src/features/debates/DebateDetailHeader.tsx:525-532` omits the prop the component supports (`RoomSettleConfirmation.tsx:79`); reopen path passes it (`RoomSettledNotice.tsx:94`) | a11y — reduce-motion inconsistently honored (canon: useReduceMotion has exactly **1** consumer app-wide today) | Thread `effectiveReduceMotion` | **safe-cleanup** |
| 11 | MakePrivateConfirmation ignores reduce-motion entirely | `WT/src/features/debates/MakePrivateConfirmation.tsx:72` hardcoded fade, no prop (`:18-24`) | Same family | Add prop matching RoomSettleConfirmation | **safe-cleanup** |
| 12 | DeletionRequestSheet hardcodes slide + slug a11y labels | `WT/src/features/arguments/DeletionRequestSheet.tsx:47-49,68-83` | Only family sheet without reduceMotion; SR reads "deletion-request-sheet" verbatim | Add prop; plain-language labels, slugs → testID only | **safe-cleanup** |
| 15 | Admin bulk confirm is an inline faux-dialog (third confirm grammar) | `WT/src/features/admin/AdminDebatesTab.tsx:319-368`; no Modal/scrim/Esc/containment; slug a11y label (`:322`); AdminUserDetailPanel checkbox gate (`:37,78-83,202-207`) is a fourth variant | Cohesion — four confirm dialects; admin-only, so P2 not P1 | Reuse RoomSettleConfirmation pattern; plain-language labels | **safe-cleanup** |
| 17 | Admin "Open timeline" silent no-op | `WT/App.tsx:806-812` early-returns with no feedback when the debate isn't in the loaded slice; sibling deep-link paths show RoomUnavailableNotice (`:782-791`, `:840-847`) | Silent-affordance class, admin-scoped | Reuse RoomUnavailableNotice | **safe-cleanup** |
| 30 | AboutScreen asymmetric back | `WT/App.tsx:1197`; `appPrimaryNavModel.ts:188-195` — always lands on gallery regardless of origin | Navigation surprise | Record pre-About tab, restore on back | **safe-cleanup** |
| 31 | Dock scrim aria-hidden yet Pressable | `WT/src/features/arguments/ArgumentComposerDock.tsx:535-542` | Possible invisible web tab stop | `focusable={false}` if confirmed | **keep-by-design (touch shield) + safe-cleanup if confirmed**; RUNTIME-CHECK R-3 |
| 32 | PreSendReviewSheet hardcoded light palette | `WT/src/features/arguments/PreSendReviewSheet.tsx:392-399` | Only light-surface overlay in a dark app — cohesion. Which way to resolve (align to SURFACE_TOKENS vs document as intentional contrast) is **SUBJECTIVE DESIGN DIRECTION**; that it must be one-or-the-other, documented, is cohesion/maintainability | Align or document | **safe-cleanup** |
| — | PreSendReviewSheet fast-path unreachability under v2 | `WT/App.tsx:1552-1558`; `ArgumentComposerDock.tsx:620-631` | By-design per App.tsx comment | Record the ruling in the ASP plan | **keep-by-design** |
| 33 | RoomUnavailableNotice lacks alert role / viewIsModal | `WT/src/features/debates/RoomUnavailableNotice.tsx:37-45` | Only centered notice without either | Add role | **safe-cleanup** |
| 34 | microMoment banner: no dismiss, not announced | `WT/src/features/arguments/room/ArgumentRoom.tsx:2996-3020` | SR users may never encounter it | Live-region announce or dismiss affordance | **safe-cleanup** |
| 35 | Callback retry banner: no dismiss-without-retry | `WT/App.tsx:1630-1645` | User trapped between retry and nothing | Add decline affordance | **safe-cleanup** |
| 36 | ProofDrawer: no keyboard close on web | `WT/src/features/proof/ProofDrawer.tsx:157-171` (deliberate in-flow, no scrim) | Deliberate pattern | Optional Esc handler | **keep-by-design** |
| 37 | Scrim-dismiss grammar: 3 undocumented dialects | dismissing (`Popout.tsx:214-224`, `AddAnnotationSheet.tsx:125-131`), inert (`ArgumentComposerDock.tsx:530-542`, `PreSendReviewSheet.tsx:208-215`), non-interactive (7 sheets, e.g. `RoomSettleConfirmation.tsx:83`) | Defensible split by surface weight — but undocumented, so drift is unguarded. Choice of standard target is **SUBJECTIVE DESIGN DIRECTION**; documenting one rule is maintainability | Document the rule; standardize scrim AT exposure on the AddAnnotationSheet labelled-Close pattern | **keep-by-design + doc fix** |
| 38 | Dual nav duplication (masthead AppPrimaryNav vs tab bar; Profile===Account) | `WT/src/components/AppHeader.tsx:48`; `appPrimaryNavModel.ts:40-54` | Known | Note only | **keep-by-design** |
| 39 | galleryLane `'home'` union widening + 10-lane vs 11-bucket vocab overlap | `WT/App.tsx:672-677`; `conversationGalleryModel.ts:246-256` vs `:374-386` | Comprehension hazard for implementers | Note only | **keep-by-design** |

---

## 11. Keep-by-design (verified healthy — no action)

- **Dark voice flags registry-only** (§5.2) — `WT/src/lib/featureFlags.ts:120,136,223-241`.
- **All `__DEV__` surfaces correctly gated** (§6.2) — bundle stripping inferred; RUNTIME-CHECK R-6.
- **DevEnvironmentBanner deliberate dormancy** (§6.3) — the pattern others should copy.
- **ArgumentGameSurface re-export shim** — `WT/src/features/arguments/ArgumentGameSurface.tsx:19-20` (ASP-EXTRACT-001).
- **Fixture policy split home-filters/gallery-labels is deliberate** — `homeModel.ts:59-65`, `ConversationGalleryScreen.tsx:573-587,639` — pattern source for the §9.1 fix. (The runtime walk showed the split's *coverage* is the problem — D8 covered HOME only — not the pattern itself; the coverage finding belongs to `UX_SURFACE_MAP.md`.)
- **Healthy overlays/notices** (mission spot-checks cleared): AddAnnotationSheet (reference sheet), LinkTargetPickerSheet + CallbackCaptureSheet, MapNodeActionPopover, BooleanFeedbackBar, PacingChip, CallbackDraftEcho, ComposerDraftRecoveryNotice, SemanticOverrideChoiceSheet (confirm-as-dismiss intentional), PreferencesPopout/ProfileTagPopout mount-order stacking (`WT/App.tsx:544-545` — the app's only z-order contract; **document it**), TimelineSelectedReadoutPanel + ArgumentScoreTracker live (`ArgumentRoom.tsx:3186,3250-3252`), InviteRedeemGate/StartArgumentSheet are lane surfaces not overlays.
- **COPY-001 "first-run explainer"** does not exist as an overlay (`ArgumentHome.tsx:377` is an empty-state) — treat mission reference as resolved-elsewhere.
- **`watch` rail action documented no-op** — `ArgumentRoom.tsx:2395` (contrast with the *undocumented* Share no-op, P1-A).
- **oneToOneRoomModel display cluster** (§5.4 companion) — 1v1 scaffolding; add dormancy header.

---

## 12. Safe-vs-risky cleanup matrix

| # | Finding | Severity | Tag | Wave |
|---|---|---|---|---|
| 2 | Zero focus management on overlays | **P0** (canon) | risky-cleanup | ACTION_PLAN Wave 1 / cleanup Wave 5 |
| 3 | Esc double-dismiss collision | **P0** (canon) | safe-cleanup | ACTION_PLAN Wave 1 / cleanup Wave 5 |
| 1 | Demo corridor nav trap | **P0** (canon) | safe-cleanup | ACTION_PLAN Wave 1 (can ship first — statically confirmed) |
| 13 | MarkerPhrasePickerSheet containment | **P0** (canon) | safe-cleanup | ACTION_PLAN Wave 1 / cleanup Wave 5 |
| 14 | RequestReviewComposer containment | **P0** (canon) | safe-cleanup | ACTION_PLAN Wave 1 / cleanup Wave 5 |
| 16 | Chime-in silent failure | **P0** (canon P0-2) | safe-cleanup | ACTION_PLAN Wave 1 / cleanup Wave 5 |
| 42 | Side-rail Share production no-op (critic #2) | **P1** | risky-cleanup (product decision; unfixable-as-specced without room URLs — critic #3) | Wave 6 ruling (removal itself trivial once ruled) |
| 4 | DebateListScreen dead-but-maintained | P2 | risky-cleanup | Wave 6 |
| 5 | Legacy chassis derivations for unreachable branch | P2 | keep-by-design + risky-cleanup card | Wave 6 |
| 6 | Demo corridor teaches legacy UI | P2 | risky-cleanup | Wave 6 |
| 7 | Ungated "Voice — coming soon" mic slot | P2 | risky-cleanup (product decision) | Wave 6 |
| 8 | Dead toast copy / missing toast surface | P2 | safe-cleanup (delete) or risky-cleanup (build) | Wave 3 (decide first) |
| 9 | Weave picker fixture leakage | P2 (leak class RUNTIME-confirmed live in sibling surfaces) | safe-cleanup | Wave 4 |
| 10 | Settle confirm missing reduceMotion | P2 | safe-cleanup | Wave 5 |
| 11 | MakePrivateConfirmation no reduce-motion | P2 | safe-cleanup | Wave 5 |
| 12 | DeletionRequestSheet hardcoded slide + slug labels | P1 (aligned to UX_TRANSITION_MAP F4) | safe-cleanup | Wave 5 |
| 15 | Admin inline faux-dialog confirms | P2 | safe-cleanup | Wave 5 |
| 17 | Admin "Open timeline" silent no-op | P2 | safe-cleanup | Wave 5 |
| 43 | AccountScreen "ADMIN? true" + support placeholder (RUNTIME 6) | P2 | safe-cleanup | Wave 3 (after R-11 plain-user check) |
| 44 | FistBumpReaction dead (critic #6) | P2 | risky-cleanup | Wave 6 |
| 45 | NodeLabelStrip dead + misleading comment (critic #6) | P2 | comment: safe-cleanup; deletion: risky-cleanup | Wave 1 (comment) / Wave 6 (delete) |
| 46 | AnnotationEdgeHighlight dead (critic #6) | P2 | risky-cleanup | Wave 6 |
| 18 | SUFFIX_TAG_PATTERNS reseed drift | P3 | safe-cleanup | Wave 2 |
| 19 | devEnvironmentModel stale patterns/header | P3 | safe-cleanup | Wave 1 (header) / Wave 2 (patterns) |
| 20 | PublicRoomMetricsStrip dead | P3 | risky-cleanup | Wave 6 |
| 21 | Dead prop activeMessageId | P3 | safe-cleanup | Wave 3 |
| 22 | Stale placeholder barrels (moderation/auth) | P3 | safe-cleanup | Wave 1 |
| 23 | ChimeInGovernanceControl stray export | P3 | safe-cleanup | Wave 3 |
| 24 | Prod import from devFixtures (CONCESSION_MARKERS) | P3 | risky-cleanup | Wave 6 |
| 25 | featureFlags chime_in stale doc pointer | P3 | safe-cleanup | Wave 1 |
| 26 | SourceChainPopover role comment drift | P3 | safe-cleanup | Wave 1 |
| 27 | Structured logger absent (console.warn fallback) | P3 | keep-by-design | — (logger card) |
| 28 | voteScorePreview/winnerPreview doctrine-risky names | P3 (doctrine risk) | safe-cleanup preferred | Wave 3 |
| 29 | Rail reserved counts (watchingCount dead input) | P3 | keep-by-design; optional safe-cleanup | Wave 3 (optional) |
| 30 | AboutScreen asymmetric back | P3 | safe-cleanup | Wave 5 |
| 31 | Dock scrim aria-hidden Pressable | P3 | keep-by-design + safe-cleanup if confirmed | Wave 5 (after R-3) |
| 32 | PreSendReviewSheet light palette | P3 | safe-cleanup (direction = SUBJECTIVE DESIGN DIRECTION) | Wave 5 |
| 33 | RoomUnavailableNotice missing alert role | P3 | safe-cleanup | Wave 5 |
| 34 | microMoment banner not announced/dismissible | P3 | safe-cleanup | Wave 5 |
| 35 | Retry banner no decline | P3 | safe-cleanup | Wave 5 |
| 36 | ProofDrawer no keyboard close | P3 | keep-by-design | — |
| 37 | Scrim-dismiss dialects undocumented | P3 | keep-by-design + doc | Wave 1 (doc) |
| 38 | Dual nav duplication | P3 | keep-by-design | — |
| 39 | galleryLane union widening | P3 | keep-by-design | — |
| 40 | Legacy tree/tracks view modes | P3 | keep-by-design | Wave 6 (with #5) |
| 41 | analytics harness under app path | P3 | safe-cleanup | Wave 6 (after R-6) |

---

## 13. Removal-order recommendation

**P0 cluster first — escalated out of this artifact's waves into UX_ACTION_PLAN Wave 1** (canon ruling; see `UX_ACTION_PLAN.md`): #2 focus utility → #3 Esc gating → #13/#14 modal-ization → #16 chime failure surfacing → #1 corridor nav fix (#1 can ship earliest; statically confirmed, single handler).

Then, for everything else, the cleanup waves:

- **Wave 1 — zero-behavior doc/comment fixes (safe, one commit):** #25 flag comment, #19 header, #26 role comment, #22 barrels, #45 NodeLabelStrip comment correction, oneToOneRoomModel dormancy note, #37 scrim-dialect doc + the `WT/App.tsx:544-545` z-order contract note.
- **Wave 2 — grammar-mirror sync + parity tests:** #18 reseed regex + array-diff test, #19 pattern sync-or-delete.
- **Wave 3 — dead tokens/props/exports + debug leftovers:** #8 toast keys (decide build-vs-delete first), #21 activeMessageId, #23 Control export, #29 watchingCount, #28 rename/delete doctrine-risky fields, #43 ADMIN? true row + support placeholder (after RUNTIME-CHECK R-11).
- **Wave 4 — fixture leakage:** #9 weave-picker filter + test (behavioral but additive; do before any further quote_forge promotion; existence of prod fixture rooms already RUNTIME-confirmed).
- **Wave 5 — a11y/overlay batch (after the operator browser RUNTIME-CHECK pass):** #10/#11/#12 reduceMotion threading (consumer count today: 1) → #15 admin confirm → #17 failure surfacing → #30/#31/#32/#33/#34/#35 minor a11y/cohesion.
- **Wave 6 — risky deletions/decisions, each needs an explicit ruling first:** #4 DebateListScreen (+4 pin tests + barrel), #44 FistBumpReaction, #46 AnnotationEdgeHighlight, #45 NodeLabelStrip deletion, #20 PublicRoomMetricsStrip, #24 CONCESSION_MARKERS relocation, #7 mic-slot gating ruling (with the D4 room-type interaction), #42 Share fix-or-remove ruling (blocked-as-specced on the room-URL design card — critic #3), #6 corridor-Ringside decision, #5 chassis derivation-skip vs port, #40 legacy view modes, #41 analytics relocation.

---

## 14. RUNTIME-CHECK register (carried; operator-authed browser pass)

| ID | Check | Feeds | Status |
|---|---|---|---|
| R-1 | Tab-behind-modal on every overlay | P0-A (#2) — confirms the promoted rating live | Open |
| R-2 | Single Esc press with ActPopout / PreSendReviewSheet layered over dock — double-dismiss? Also whether RN-web Modal fires `onRequestClose` on Esc for backdrop-inert confirms | P0-B (#3) | Open |
| R-3 | Web tab order: aria-hidden dock scrim (#31) and disabled mic slot (#7) focusability | #31, #7 | Open |
| R-4 | Demo corridor open → tap Account/Admin: visual co-render outcome | P0-C (#1) | Open |
| R-5 | Weave picker on prod: do **locked** fixture-tagged rooms appear? | #9 | **Partially answered** — fixture rooms confirmed present and leaking in Browse gallery / room titles / circles picker (RUNTIME 2026-07-12 authed walk @487px, finding 1); the weave picker itself and the locked-status subset remain unchecked |
| R-6 | Deployed bundle scan: analytics/devFixtures/`__DEV__` exclusion | #41, §6.2 keep-list | Open |
| R-7 | Netlify env: confirm 9-ON/2-dark flag split underpinning all reachability claims | Global caveat | Corroborated by plan context (9/11 flags live, voice pair dark); direct env read still owed |
| R-8 | ProfileTagPopout close → context/focus returns to PreferencesPopout (comment-asserted only) | §11 z-order contract | Open |
| R-9 | MarkerPhrasePickerSheet Android hardware back (native-only, lower priority; live platform is web) | P0-D (#13) | Open |
| R-10 | Observer taps Share on the live site — confirm silent no-op end-to-end | P1-A (#42) | Open (static confirmation already exact: no `onShareRoom` caller) |
| R-11 | AccountScreen as a **plain user** — what does the ADMIN? row render (false? absent?), and does the support placeholder show? The walk ran as admin only (RUNTIME 2026-07-12 authed walk @487px, gap 11) | #43 | Open |

**Residual gaps carried from readers:** grep-based dead-code detection can miss dynamic imports (none observed); ArgumentRoom.tsx (~4000 lines) chrome inventory covers top-level mounts `:2943-3829`, not every sub-condition; admin tabs sampled not exhaustive (inline faux-dialogs like #15 may exist in unread tabs); native iOS/Android behavior unaudited; roadmap intent for #20/#25-cluster/#44/#46 lives outside the repo.
