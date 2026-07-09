# ROOM-004 — MapView capability parity (node action popover + data-rich sidecar)

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP) — room surface · Phase P2 · Milestone M-ASP-2
**Release:** ASP program (behind `room_exchange_v2`; live in prod, client deploys gated by the deliberate netlify-prod push)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/886
**Flag:** `room_exchange_v2` (`EXPO_PUBLIC_ROOM_EXCHANGE_V2`, default OFF; `isRoomExchangeV2Enabled()` — App.tsx is the sole flag consumer, threads `roomExchangeV2Enabled` into `ArgumentRoom`)
**Bundle branch:** `feat/room-002-004-ab-hybrid` (shared with ROOM-002; base `6d812a2`)

---

## Goal (one paragraph)

Complete the B-side of the Design Pass A×B hybrid: **view choice is a lens, never a capability gate** (Design Pass §6, binding). Exchange (Ringside feed) and Map (the shipped horizontal timeline) are two lenses on ONE shared selection (`activeMessageId`). Every capability reachable in the Exchange lens must be reachable from the Map lens for the **same actor** through the **same action codes** (`RailActionCode`, aliased `RoomRailActionCode`) and the **same handler** (`handleRailAction` in `ArgumentRoom`). ROOM-004 adds (1) a band-free, actor-aware **node action popover** on the Map that surfaces the SAME action set ROOM-002 gives an Exchange element (the 44px rule: small nodes open a popover before actions), (2) the **data-rich sidecar readout** the closed #504 supersession assigned here — body excerpt, kind/side, qualifier chips, friendly feedback flags behind disclosure, receipt/proof chips, open-point membership, and the "Answer this → Exchange scoped" deep link (J9) — reusing the surfaces that already exist, at the **lower density** the #504 PRODUCT-REDIRECT-001 comment mandates, and (3) the **parity matrix test** (QA-002 seed) that makes silent parity drift impossible to merge. Doctrine that shapes the design: mark the point never the person; advisory-only chips, never verdicts; **no per-node strength bands** (retired by VISUAL-SIMPLIFY-003 — stays retired); heat ≠ correctness, popularity ≠ evidence; plain-language only; engine untouched; score never blocks posting. Flag-off = today's Map byte-identical.

---

## Problem & scope

### What exists today (grounded reality audit)

The Map lens is `src/features/arguments/room/MapView.tsx`, a thin pass-through wrapper over the shipped `ArgumentTimelineMap`. `ArgumentRoom` (the orchestrator, formerly `ArgumentGameSurface`) owns the single `activeMessageId`, all derivations, and all handlers, and dispatches `col1` to `ExchangeView` (stack/feed) or `MapView` (timeline) by `mode`.

Capability surfaces that ALREADY exist and their lens-reach:

| Surface | Where mounted | Lens reach today | Actions |
| --- | --- | --- | --- |
| **Side action rail** (`ArgumentSideActionRail`, `handleRailAction`) | `bottomChrome` (not mode-gated) | Both | `watch · join_aff · join_neg · share · reply · disagree` (+ `open_timeline`); consumes `getRailActions(viewerRole, bubbleActor)` |
| **Board Act / Inspect / Go menus** (`ActPopout`/`InspectPopout`/`GoPopout`) | `col2Footer` (not mode-gated) | Both | migrated codes: `ask_source · ask_quote · branch · flag · view_qualifiers · request_deletion`; Go `view_timeline` |
| **Exchange per-element action zone** (`ArgumentBubbleStack` inline "Actions on this point") | `ExchangeView` (`mode === 'stack'`) | Exchange only | derived from the SAME `getRailActions(viewerRole, bubbleActor)`, dispatched via `onRailAction={handleRailAction}` |
| **SC-004 lifecycle dock** (`TimelineNodeActionDock`) | inside `ArgumentTimelineMap`, on `selectedDockTarget` | Map only | `reply · challenge · mark_moved_on(disabled v1) · mark_ignored(disabled v1) · open_cards_detail · expand_branch` |
| **SC-002 info-icon popover** (`TimelineNodePopover`) | inside `ArgumentTimelineMap`, on `popoverMessageId` (active-node info icon / keyboard open_detail) | Map only | preview + **standing/tone/heat bands (retired)** + `ArgumentBubbleControl` chips |
| **Map col2 readout** (`TimelineSelectedReadoutPanel` compact → `ArgumentReplySidecar` 6-section) + `PointFeedbackFlagsRow` (≤3 friendly flags) + mediator marker + Inspect caret | `col2` (`mode === 'timeline'`) | Map only | read-only detail; no "Answer this" deep-link |

**The real gaps ROOM-004 closes:**

1. **Actor-aware node action popover.** The Exchange lens surfaces the `getRailActions` actor row per element; the Map has the *lifecycle* SC-004 dock but NOT the actor-aware `RailActionCode` row that ROOM-002 owns. A Map user cannot reach `reply`/`disagree` (participant-other) or `watch`/`join`/`share` (observer) as the SAME per-node row they'd get in Exchange.
2. **Data-rich sidecar with the J9 deep-link.** The Map col2 readout exists but has no first-class **"Answer this → Exchange scoped"** verb (J9: review the Map → sidecar readout → Answer this jumps to Exchange, composer scoped to that node) and no consolidated open-point / proof reachability at low density.
3. **No parity guarantee.** Nothing prevents a future card from adding an Exchange-only capability. The **parity matrix test** is the defining artifact: `RailActionCode × lens × actor-class → reachable + same handler identity`.

### In scope
- A new band-free, actor-aware **Map node action popover** consuming a NARROW `actor → action list` derivation and dispatching through `handleRailAction`.
- A **sidecar deep-link footer** (Answer this → Exchange scoped; Open disagreement points) + open-point membership line, reusing the existing readout panel + flags row.
- The **parity matrix suite** + popover actor-matrix RNTL + sidecar RNTL + J9 deep-link test + flag-off byte-identical proof + a11y + copy ban-list.
- Everything gated behind `room_exchange_v2`; flag-off = byte-identical.

### Non-goals (from the issue, verbatim intent)
- No new action semantics / no new `RailActionCode` or dock codes.
- No lane-algebra / layout changes to the timeline map.
- No marker pins (P5).
- No per-node strength bands (retired by VISUAL-SIMPLIFY-003 — **stays retired**; the new popover is band-free).
- No `ExchangeView` edits (ROOM-002 owns the Exchange row).
- No Edge / migration / engine / `submit-argument` change; no service-role; no AI; no new dependency.

---

## Interface contract with ROOM-002 (numbered assumptions)

ROOM-002 (the Ringside Exchange re-weight, concurrently designed at `docs/designs/ROOM-002.md`) **OWNS** the actor-aware action-row contract: *actor class → ordered action codes → handler dispatch*. ROOM-004's popover must consume the SAME derivation, never a fork. Because ROOM-002's final design is not yet on disk, the implementer MUST reconcile the following numbered assumptions against the merged ROOM-002 design **before coding**. The popover is designed to consume a **narrow, prop-injected interface** so it survives reasonable contract differences: it never imports the derivation directly — `ArgumentRoom` is the single reconciliation point.

- **A1 — Derivation source & signature.** Today the actor→actions derivation is `getRailActions(viewerRole: RailViewerRole, bubbleActor: RailBubbleActor): RailAction[]`, exported from `src/features/arguments/ArgumentSideActionRail.tsx` (types in `railActionCategories.ts`). It is the SAME function `ExchangeView`'s inline zone (`ArgumentBubbleStack` → `getRailActions`), `CardDetailPanel`, and the side rail consume. **Assumption:** ROOM-002 keeps this as the single derivation (possibly renamed / relocated into a `room/` module or wrapped to return an ordered `RailActionCode[]`). Reconcile the import; if ROOM-002 introduces `deriveActorActionRow(...)` or similar, `ArgumentRoom` calls THAT and passes the result to the popover.
- **A2 — Action-code set.** The vocabulary is `RailActionCode` (13 codes), aliased `RoomRailActionCode` in `src/features/arguments/room/roomActionCodes.ts`, frozen as `ROOM_RAIL_ACTION_CODES`. Both ROOM-002 and ROOM-004 declare "no new action codes" as a non-goal. **Assumption:** the set is stable at 13. If ROOM-002 re-orders or re-buckets (its 7-category taxonomy), the popover consumes the ORDERED output, not a hand-copied list.
- **A3 — Actor derivation inputs.** The actor is `(resolvedViewerRole: RailViewerRole, activeViewModel.actor: RailBubbleActor)`. `resolvedViewerRole` is already `'observer' | 'participant'`; `ArgumentBubbleActor` is exactly `RailBubbleActor` (`'self'|'other'|'bot'|'admin'|'unknown'`), so `getRailActions(resolvedViewerRole, activeViewModel.actor)` is a legal call today. **Assumption:** ROOM-002 does not introduce a richer actor classifier the Exchange row uses but the Map cannot compute. If it does, `ArgumentRoom` derives the actor once and feeds BOTH lenses.
- **A4 — Handler dispatch.** The dispatcher is `handleRailAction(code: RailActionCode, ctx: { activeMessageId: string | null })` in `ArgumentRoom` (routes `join_aff/join_neg/share/open_timeline/watch` locally; bridges the rest via `railActionToBubbleControl` → `handleAction` → composer + `submit-argument`). ROOM-002 OWNS any re-weight of this handler. **Assumption:** the popover receives the SAME `handleRailAction` **function instance** `ArgumentRoom` passes to `ExchangeView.onRailAction`. The parity test asserts handler identity by source-scanning that both mounts pass `handleRailAction`.
- **A5 — Own-move contract.** `getRailActions('participant', 'self')` returns `SELF_ACTIONS = []` (empty post-UX-001.4); `view_qualifiers` + `request_deletion` live in the board Act menu (lens-agnostic). **Assumption:** ROOM-002 keeps own-move = "qualifiers + request deletion only, via Act" in the Exchange row. The Map popover mirrors this exactly: empty rail row for own moves + an "Open Act ▾" affordance routing to the same board Act mounts. The parity test encodes that `reply`/`disagree` are NOT reachable via the popover for `self` in EITHER lens, and `view_qualifiers`/`request_deletion` ARE reachable via Act in BOTH.
- **A6 — Exchange element row source.** ROOM-002's re-weighted Exchange element row (Ringside "one primary action per element" + migrated codes via Act) is derived from `getRailActions` (A1). **Assumption:** the Map popover mirrors the SAME derivation OUTPUT for the SAME `(viewerRole, actor)`. If ROOM-002 narrows the Exchange row to a subset (e.g., primary-only + overflow), the popover consumes the identical subset function — the parity test compares the two lenses' surfaced sets and FAILS on divergence.

**Reconciliation rule for the implementer:** the popover component (`MapNodeActionPopover`) takes `actions: RailAction[]` (or the final ROOM-002 shape) + `onAction: (code: RailActionCode) => void` as PROPS. It imports NO derivation. If any A1–A6 assumption is contradicted by the merged ROOM-002 design, change ONLY the one line in `ArgumentRoom` that builds `actions` and the one `onAction` binding — the popover view and its tests are unaffected.

---

## Data model

**No new data model.** ROOM-004 is a pure UI + pure-view-model card. No SQL, no migration, no Edge Function, no RLS, no storage, no new table, no schema change, no persisted state. Every input is already held in memory by `ArgumentRoom`:

- `activeMessageId: string | null` — the single shared selection (invariant: exactly one `[*MessageId, set*MessageId] = useState` in `ArgumentRoom`; see Pin inventory).
- `selectedDockTarget: TimelineNodeActionDockTarget | null` — the existing SC-004 selection state (node / cluster / collapsed_stub). Drives popover visibility for node targets.
- `resolvedViewerRole: RailViewerRole`, `activeViewModel: ArgumentBubbleViewModel | null` (→ `.actor: RailBubbleActor`).
- `activePointFeedbackFlags: PrioritizedPointFeedbackFlags` (`.visible`, `.suppressedCount`) — already built for the active node (friendly flags, ≤3, priority-ranked).
- `timelineReadoutViewModel` (`.actingOnShortLabel`, `.sidecar`), `mediatorBoard` (`.markupByNodeId[nodeId]?.pointId`, `.points`), `evidenceDebts`, `activeParentMessageId`, `artifactsByMessageId`.

The one new pure view-model (`mapNodeActionSurfaceModel.ts`) is a deterministic projection of the above — it holds nothing, fetches nothing.

---

## Design decisions

### D1 — Popover architecture (44px rule; mount without editing pinned timeline internals)
- **Selection is the existing single-tap.** `ArgumentTimelineMap.handleNodeTap` already turns a node tap into `onSelectTarget({ kind: 'node', messageId })` → `selectedDockTarget`. ROOM-004 reuses this — **no new tap gesture, no new selection state.** The 44px rule is satisfied because the node itself only *selects*; actions render in the popover, never at node scale.
- **Mount point = MapView-level docked card, NOT inside `ArgumentTimelineMap`.** The popover renders as a new optional child of `MapView` (a docked card after `ArgumentTimelineMap`, mirroring the existing `styles.popoverDock` pattern), driven by props `ArgumentRoom` passes down. `ArgumentTimelineMap.tsx` is **not edited** (it carries a load-bearing contract test + source-order + touch-target pins). Feasibility confirmed: `MapView` already receives `selectedTarget`, `activeViewModel`, `isReadModeViewer`, `reduceMotionOverride` and forwards them.
- **Supersession of the SC-004 node dock under flag-on, without a timeline edit.** `ArgumentRoom` already OWNS `actionDockModel` (it builds `dockModel` and passes it to `MapView`). When `room_exchange_v2` is ON **and** the selection is a `node` target, `ArgumentRoom` passes `actionDockModel={null}` (the SC-004 dock's render guard `selectedTarget && actionDockModel && !popoverModel` then yields nothing) and the ROOM-004 popover takes over. For `cluster` / `collapsed_stub` targets the dock is passed through unchanged (so `expand_branch` and cluster actions are preserved). Precise gate:
  ```
  actionDockModel = (roomExchangeV2Enabled && selectedDockTarget?.kind === 'node') ? null : dockModel
  ```
  Flag OFF → `actionDockModel = dockModel` always → SC-004 dock byte-identical to today; popover renders nothing. **No capability regression:** the dock's node codes are `reply` (→ popover `reply`), `challenge` (→ popover `disagree`), `mark_moved_on`/`mark_ignored` (disabled for all actors in v1), and `open_cards_detail` (→ popover "Open details ↗").
- **Double-tap = answer? — DEFERRED (a11y-safe default).** Design Pass §5B floats "double-tap node = answer." ROOM-004 does **not** ship double-tap: (a) a reliable double-tap primitive is not present in `ArgumentTimelineMap` and adding one would edit a pinned file and demand a keyboard/screen-reader equivalent; (b) the popover already gives "Answer this ↗" as a single explicit tap after selection, which is a11y-complete and satisfies the ≤2-tap J9 criterion (tap node = select; tap "Answer this" = answer). Double-tap is recorded in Out of scope as a follow-up.
- **SC-002 info-icon band popover — left untouched.** It shows retired standing/tone/heat bands and is opt-in via the active-node info icon. ROOM-004 does not add bands and does not remove this legacy surface (that would edit `ArgumentTimelineMap`). Documented as a Risk + an Out-of-scope follow-up (retire its retired-band content). When flag-on, the ROOM-004 popover is the *primary* node-action surface; the info-icon popover remains an opt-in secondary that the implementer may additionally suppress ONLY via the optional NOTEd relaxation in the Pin inventory if the reviewer prefers zero coexistence.

### D2 — Sidecar readout (reuse, extend minimally, keep density LOW)
Per the #504 PRODUCT-REDIRECT-001 comment, the enrichment half is **inverted** from "maximally data-rich centerpiece" to **friendly optional flags at lower density, behind disclosure**. So ROOM-004 **reuses** the existing Map col2 stack rather than authoring a new dense sidecar:
- **Reuse as-is:** `TimelineSelectedReadoutPanel` (compact readout → expandable `ArgumentReplySidecar` 6-section: body excerpt, kind/side, qualifiers, evidence) + `PointFeedbackFlagsRow` (friendly flags, ≤3 visible + `suppressedCount`, advisory, dismissible-behind-disclosure per VISUAL-SIMPLIFY-002). These already render in `col2` for the Map lens.
- **Add one small presentational footer** (`MapNodeSidecarLinks`, flag-gated) mounted in `col2` AFTER `PointFeedbackFlagsRow`, carrying the deep-links the readout lacks:
  - **"Answer this ↗"** → J9: switch to Exchange (`setMode('stack')`) + open the composer scoped to the node (`handleAction('reply', activeMessageId)`), via a single new `handleAnswerThisFromMap` handler. ≤2 taps from a Map selection.
  - **"Open disagreement points"** → the existing analysis surface (`handleOpenAnalysisSurface('disagreement')`) — for owed debts / open-issue detail. No new analysis UI.
  - **Open-point membership line** — a plain-language, read-only line derived from `mediatorBoard.markupByNodeId[activeMessageId]?.pointId` (e.g., "Part of an open point" / nothing when settled). Read-only projection of the already-derived board; never re-derived.
- **Proof / receipt chips** already surface inside the `ArgumentReplySidecar` evidence section (EV-001/EV-002 `ReceiptChip`) and the SC-002 popover; ROOM-004 does NOT duplicate a proof zone. If the reviewer wants a proof chip on the low-density footer, it reuses `ReceiptChip` with the `evidenceContractFor(activeMessageId)` already available — noted as optional, not required.
- **What the sidecar MUST NOT show:** no strength bands, no verdicts, no standing/winner framing, no heat-as-truth. Flags stay advisory + behind disclosure.

### D3 — Shared view-model (Slice 1, pure)
New pure module `src/features/arguments/room/mapNodeActionSurfaceModel.ts` exports `buildMapNodeActionSurface(input)` returning `MapNodeActionSurface` (see Interface contracts). It consumes the actor→actions list (A1) + the node id + the low-density readout links; it produces the popover row + the sidecar link set + accessibility labels. Pure TS, no React/Supabase/network/AI, no verdict tokens. This is the single testable seam for the parity matrix (D5).

### D4 — Flag / flag-off
Same `room_exchange_v2` prop `ArgumentRoom` already receives (`roomExchangeV2Enabled`). App.tsx stays the sole flag consumer (`isRoomExchangeV2Enabled`). Flag OFF: popover unmounted, sidecar links unmounted, `actionDockModel = dockModel` → the Map is byte-identical to today. Flag ON: popover replaces the SC-004 *node* dock, sidecar links mount. Mirrors the ROOM-001 / ROOM-003 flag-off discipline (`roomThreeFlagOff.test.tsx`, `argumentStateRailFlagOff.test.tsx`).

### D5 — Parity matrix (the defining artifact)
A pure capability-reachability model + a matrix test (Slice 3). See Test plan → Parity matrix.

### D6 — Slices
- **S1** — pure `mapNodeActionSurfaceModel.ts` + pure `roomCapabilityParity.ts` reachability model (consume the actor→actions derivation; produce popover row + sidecar links + per-lens reachable-code sets). Tests only touch pure models.
- **S2** — `MapNodeActionPopover.tsx` + `MapNodeSidecarLinks.tsx` views; wire into `MapView` + `ArgumentRoom` (new optional props, `actionDockModel` node-gate, `handleAnswerThisFromMap`); RNTL popover/sidecar; J9 deep-link test.
- **S3** — parity matrix suite + popover actor-matrix + flag-off byte-identical proof + a11y + copy ban-list.

Each slice is its own commit; each carries pure-model + (S2/S3) UI + a11y + ban-list tests.

---

## Pin-relaxation inventory

Classification of every suite that scans the files ROOM-004 touches. **Additive-safe** = the change is purely additive/optional and the pin passes unchanged. **NOTEd relaxation** = the pin must be updated with a NOTE (only where an edit is unavoidable).

| Pin / suite | What it pins | ROOM-004 verdict |
| --- | --- | --- |
| `uxOneOneFiveReadOnlyBoundary.test.ts` | Zero-diff list. **`ArgumentTimelineMap.tsx` and `TimelineSelectedReadoutPanel.tsx` are ALREADY REMOVED** from zero-diff (relaxed by UX-MOBILE-001 / UX-SELECTED-NODE-001). `room/*` files are NOT listed. Composer files + OneBox + Act/Go popouts ARE zero-diff. | **Additive-safe.** ROOM-004 edits none of the still-pinned files. `MapView.tsx`, `ArgumentRoom.tsx`, `roomActionCodes.ts` are unpinned. `ArgumentTimelineMap.tsx` is NOT edited (D1). |
| `timelineSelectionSharedAcrossModes.test.ts` | (line 216–219) **EXACTLY ONE** `const [*MessageId, set*MessageId] = useState` in `ArgumentRoom.tsx`; one shared `activeMessageId`; `handleToggleMode` does not reset it. | **Additive-safe IFF** the popover rides `activeMessageId` + `selectedDockTarget` + a NON-`MessageId` boolean (e.g. `mapPopoverDismissed`). **HARD CONSTRAINT: do NOT add any `[xMessageId, setXMessageId] = useState`.** |
| `uxOneOneTwoChromeLayerRemovals.test.ts` | `indexOf('<MapView')` < `indexOf('<ArgumentScoreTracker')` and < `indexOf('<TimelineSelectedReadoutPanel ... compact')`; the readout mount substring is preserved. | **Additive-safe.** Add popover props to the existing `<MapView ...>` element (indexOf of `<MapView` unchanged) and mount `<MapNodeSidecarLinks>` AFTER the readout/flags in col2. Never insert a component before `<MapView>`. Keep the `<TimelineSelectedReadoutPanel viewModel={timelineReadoutViewModel} compact` substring intact. |
| `railActionGrouping.test.ts` | `getRailActions` contract + 7-category taxonomy + the verbatim rail sets. | **Additive-safe.** ROOM-004 CONSUMES `getRailActions`; it does not modify the sets or categories. |
| `argumentTimelineMap.test.ts` / `ArgumentTimelineMap.test.tsx` / `argumentTimelineMapRootOnboarding.test.ts` / `uxMobile001MobileHardening.test.ts` | `ArgumentTimelineMap` shape, testIDs, touch targets, root onboarding. | **Additive-safe.** `ArgumentTimelineMap.tsx` is not edited (D1). |
| `roomThreeFlagOff.test.tsx` / `argumentStateRailFlagOff.test.tsx` | ROOM-001/003 flag-off wiring in `App.tsx` + `ArgumentRoom.tsx`. | **Additive-safe.** ROOM-004 adds a NEW flag-off assertion set; it does not alter the ROOM-001/003 lines these pin. |
| `uxOneOneTwoDoctrine.test.ts` | Naive quote-parity STRING_RE ban-list scanner over `ArgumentRoom.tsx`. **Apostrophe gotcha:** one apostrophe in ANY comment poisons file-wide string parsing. | **Additive-safe IFF** every NEW comment ROOM-004 adds to `ArgumentRoom.tsx` is **apostrophe-free**. Run this suite pre-push. |
| `visualSimplify002AnalysisOnDemand.test.tsx` | Analysis surfaces are on-demand / mutually exclusive; default view is conversation-only. | **Additive-safe.** The sidecar "Open disagreement points" reuses `handleOpenAnalysisSurface('disagreement')` (existing toggle); the popover is not an analysis surface. |
| `timelineReadoutBanList.test.ts` / `timelineReadoutNoRoute.test.ts` / `timelineSelectedReadoutNav.test.ts` | Readout copy ban-list + no-route + nav. | **Additive-safe.** `TimelineSelectedReadoutPanel` not edited; the new footer is a sibling with its own ban-list test. |

**Optional NOTEd relaxation (only if the reviewer requires zero SC-002 coexistence):** to suppress the legacy info-icon band popover under flag-on, add an additive optional prop `disableLegacyNodePopover?: boolean` to `ArgumentTimelineMap` (default `undefined` → byte-identical) that gates the active-node info icon + the `popoverModel` render. This is a NOTEd relaxation of `uxOneOneFiveReadOnlyBoundary` history (already relaxed for that file) and requires re-running `argumentTimelineMap.test.ts` + `uxMobile001MobileHardening.test.ts`. **Recommendation: do NOT take this relaxation** — keep `ArgumentTimelineMap` untouched and file the band-popover retirement as a separate doctrine-cleanup follow-up.

---

## File-by-file change list

### New files
- `src/features/arguments/room/mapNodeActionSurfaceModel.ts` (~140 lines) — pure view-model. `buildMapNodeActionSurface(input): MapNodeActionSurface`; the popover row (from the injected `RailAction[]`), the sidecar link set, the open-point membership line, and all accessibility labels. No React/Supabase/network/AI. Exports `_forbiddenMapSurfaceTokens()` for the ban-list test.
- `src/features/arguments/room/roomCapabilityParity.ts` (~120 lines) — pure parity model. `reachableRailActionCodes(lens: 'exchange' | 'map', viewerRole, actor): ReadonlySet<RailActionCode>` (union of: `getRailActions` set + board-Act/Go entries + — for map — the popover set which == `getRailActions`); `railActionHandlerId(code): 'rail' | 'act' | 'go'` (lens-independent). `PARITY_ACTION_CODES` frozen list. This is the single source the matrix test iterates.
- `src/features/arguments/room/MapNodeActionPopover.tsx` (~150 lines) — presentational, band-free node action popover. Props: `{ surface: MapNodeActionSurface; onAction: (code: RailActionCode) => void; onAnswerThis: () => void; onOpenDetails?: () => void; onOpenAct?: () => void; onClose: () => void; reduceMotion?: boolean }`. Renders the actor action row (44px targets), "Answer this ↗", own-move "Open Act ▾", Close. Imports NO derivation.
- `src/features/arguments/room/MapNodeSidecarLinks.tsx` (~90 lines) — presentational footer: "Answer this ↗", "Open disagreement points", open-point membership line. Display-only text where non-interactive (affordance-consistency: real `Pressable` + `button` role + 44×44 for links; label text for the membership line).
- Test files (see Test plan): `__tests__/mapNodeActionSurfaceModel.test.ts`, `__tests__/roomCapabilityParityMatrix.test.ts`, `__tests__/MapNodeActionPopover.test.tsx`, `__tests__/MapNodeSidecarLinks.test.tsx`, `__tests__/roomFourFlagOff.test.tsx`, `__tests__/roomFourAnswerThisJ9.test.ts`, `__tests__/roomFourCopyBanList.test.ts`.

### Modified files
- `src/features/arguments/room/MapView.tsx` (~+35 lines) — add optional props (`nodeActionPopover?: MapNodeActionSurface | null`, `onPopoverAction?`, `onAnswerThis?`, `onPopoverOpenDetails?`, `onPopoverOpenAct?`, `onPopoverClose?`, `reduceMotionOverride?` already present). Render `<MapNodeActionPopover>` as a docked card AFTER `<ArgumentTimelineMap>` when `nodeActionPopover` is supplied. Back-compat: props absent → renders nothing new → byte-identical. **What stays:** the existing `ArgumentTimelineMap` mount + linked-prior affordance, unchanged.
- `src/features/arguments/room/ArgumentRoom.tsx` (~+70 lines) — (a) build `mapNodeActionSurface` (memoized on `activeMessageId`, `resolvedViewerRole`, `activeViewModel.actor`, the injected actions, `mediatorBoard`) only when `roomExchangeV2Enabled`; (b) node-gate `actionDockModel` per D1; (c) new `handleAnswerThisFromMap` (setMode('stack') + `handleAction('reply', id)`); (d) pass the new props into `<MapView>`; (e) mount `<MapNodeSidecarLinks>` in col2 AFTER `PointFeedbackFlagsRow`, gated on `roomExchangeV2Enabled`. **What stays:** the single `activeMessageId` useState, `handleRailAction`, `selectedDockTarget`, all existing derivations/handlers, source order of `<MapView>`/`ScoreTracker`/`ReadoutPanel`. **Constraint:** no new `[*MessageId, set*MessageId]` state; all new comments apostrophe-free.

### Deleted files
- None.

**Boundary line (verbatim):** No Anthropic / xAI / X API call by Claude in this card. No Supabase write. No service-role. No migration. No Edge Function. No engine change. `src`-only → ships via the operator web/Expo build.

---

## Component spec

### `MapNodeActionPopover` (a11y floors)
- Docked card (reuses the `styles.popoverDock` visual pattern), `minWidth 260 / maxWidth 380`, dark brand tokens. Band-free (no Standing/Tone/Heat chips).
- Root: `accessibilityRole="none"`, `accessibilityLabel` = `surface.accessibilityLabel` (e.g. "Actions for message 4."). `testID="map-node-action-popover-<messageId>"`.
- Each action = `Pressable`, `accessibilityRole="button"`, `accessibilityLabel` = the `RailAction.label` (+ helper as `accessibilityHint`), **≥44×44** (visual chip + `hitSlop`), visible focus ring on web (`FOCUS_RING`). `testID="map-popover-action-<code>-<messageId>"`.
- "Answer this ↗": `Pressable` button, label "Answer this", hint "Opens the reply composer scoped to this point in the conversation view." `testID="map-popover-answer-this-<messageId>"`.
- Own-move (`actor === 'self'`, empty rail row): render NO reply/disagree; render "Open Act ▾" (`accessibilityLabel="Open Act menu"`, hint "View qualifiers or request deletion") routing to the same board Act mount. Matches Exchange own-move exactly (A5).
- Close: `button`, `accessibilityLabel="Close actions"`.
- Reduce-motion: popover mount/unmount **snaps** (no slide) when `reduceMotion` (OS read composed with `reduceMotionOverride`). Color is never the only signal (glyph + label on every chip). Grayscale legible.

### `MapNodeSidecarLinks` (a11y floors)
- Interactive links = real `Pressable` + `button` role + ≥44×44. Non-interactive membership line = `<Text>` label only (no clickable box) — affordance-consistency sweep.
- `testID="map-sidecar-links"`, `map-sidecar-answer-this`, `map-sidecar-open-debts`, `map-sidecar-point-membership`.
- Open-point membership line copy is advisory + plain-language; renders nothing when the node has no open-point membership.

### Selection-change announcement
- No new chatty announcements. The existing IX-004 live-region on the readout panel already announces selection changes; the popover does not re-announce on open (role + label carry it).

---

## Copy plan

All strings owned locally / routed through existing plain-language maps; no internal codes leak (`toPlainLanguage` / `standingBandCopy` unknown codes suppressed). Zero verdict/standing/winner tokens.

| Element | Copy | Notes |
| --- | --- | --- |
| Popover root a11y | `Actions for <acting-on short label>.` | reuses `timelineReadoutViewModel.actingOnShortLabel` |
| Action chips | from `RailAction.label` (`Reply`, `Disagree`, `Watch`, `Join For`, `Join Against`, `Share`) | verbatim from the shared derivation — never re-authored |
| Answer this | `Answer this ↗` | J9 verb |
| Own-move Act | `Open Act ▾` / hint `View qualifiers or request deletion` | mirrors rail collapsed-dock label |
| Sidecar debts link | `Open disagreement points` | reuses `DISAGREEMENT_POINTS_RAIL_COPY.title` where possible |
| Open-point membership | `Part of an open point` (or nothing) | advisory, never "unresolved = wrong" |
| Close | `Close actions` | |

Ban-list (scanned by `roomFourCopyBanList.test.ts` + `mapNodeActionSurfaceModel._forbiddenMapSurfaceTokens`): `winner, loser, correct, incorrect, true, false, right, wrong, liar, dishonest, bad faith, manipulative, extremist, propagandist, verdict, proof, proven, won, lost, likes, retweets, followers, engagement, trending, viral` — must not appear in any label / hint / a11y string.

---

## Test plan

Baseline (stated by orchestrator): **934 suites / 33,311 tests.** The reviewer MUST reconcile this against the branch's actual pre-change captured `Test Suites:` / `Tests:` line + exit code 0 (per test-discipline gate rule); the H2 test count in `current-status.md` must match `docs/reviews/ROOM-004-review.md`.

New suites (all pure-model or `.test.tsx` source-scan / RNTL patterns already used in this repo):

1. **`__tests__/mapNodeActionSurfaceModel.test.ts`** (pure, ~14 cases) — happy path (participant-other → reply/disagree row), observer (watch/join/share), own-move (empty row + Open-Act path), open-point membership line derivation, accessibility-label shape, empty/`null` `activeMessageId`, and `_forbiddenMapSurfaceTokens` presence.
2. **`__tests__/roomCapabilityParityMatrix.test.ts`** (THE defining artifact, pure) — for every `code ∈ PARITY_ACTION_CODES` × `viewerRole ∈ {observer, participant}` × `actor ∈ {self, other, bot, admin, unknown}`: assert `reachableRailActionCodes('exchange', vr, actor).has(code) === reachableRailActionCodes('map', vr, actor).has(code)` (reachability parity) AND `railActionHandlerId(code)` is lens-independent (same handler class). Plus a source-scan asserting `ArgumentRoom` passes the SAME `handleRailAction` to `ExchangeView.onRailAction` and to the Map popover binding (handler identity). Own-move sub-matrix: `reply`/`disagree` unreachable via popover for `self` in BOTH lenses; `view_qualifiers`/`request_deletion` reachable via Act in BOTH.
3. **`__tests__/MapNodeActionPopover.test.tsx`** (RNTL spot checks, ~6) — renders reply+disagree for participant-other; watch/join/share for observer; own-move shows Open-Act + no reply/disagree; every `Pressable` has role+label+≥44 target; reduce-motion snaps.
4. **`__tests__/MapNodeSidecarLinks.test.tsx`** (RNTL, ~4) — Answer this + Open disagreement points are buttons with 44×44; membership line is display-only text (no button role); renders nothing for a settled node.
5. **`__tests__/roomFourAnswerThisJ9.test.ts`** (source-scan + handler, ~3) — "Answer this" routes through `handleAnswerThisFromMap` = `setMode('stack')` + `handleAction('reply', activeMessageId)`; the Map selection id is preserved into Exchange (≤2 taps: select + Answer this).
6. **`__tests__/roomFourFlagOff.test.tsx`** (source-scan, ~6) — flag OFF: popover + sidecar links unmounted, `actionDockModel` = `dockModel` (SC-004 node dock unchanged); flag ON: popover mounts, `actionDockModel` node-gated to null, sidecar links mount; App.tsx stays the sole flag consumer; the new files import no `featureFlags`.
7. **`__tests__/roomFourCopyBanList.test.ts`** (~2) — no verdict/standing/amplification token in any ROOM-004 label/hint/a11y string; no snake_case leak.

Regression suites that MUST stay green (run explicitly): `timelineSelectionSharedAcrossModes`, `uxOneOneTwoChromeLayerRemovals`, `uxOneOneTwoDoctrine` (apostrophe scanner), `railActionGrouping`, `argumentTimelineMap`, `visualSimplify002AnalysisOnDemand`, `roomThreeFlagOff`.

**Expected test delta:** +~35 tests across +7 suites → ~**941 suites / ~33,346 tests** (exact numbers set by the implementer from the captured run; the count only goes UP). Full gates: `npm run typecheck`, `npm run lint`, `npm run test` (exit 0 captured), `npm run web:build`.

---

## Dependencies (cards / docs / files)
- **Blocks-on / reconcile-with ROOM-002** (`docs/designs/ROOM-002.md`, same bundle branch) — ROOM-002 owns the actor-aware action-row contract the popover mirrors (assumptions A1–A6). The implementer reconciles A1–A6 against the merged ROOM-002 design before coding S2.
- **Assumes ROOM-001 shipped** (#876 `ArgumentStateRail` + `room_exchange_v2` prop path) — the flag prop `roomExchangeV2Enabled` already threads into `ArgumentRoom`.
- **Assumes ROOM-003 shipped** (#829 one-bar composer, flag-off pattern) — mirrors its flag-off discipline (`roomThreeFlagOff.test.tsx`).
- **Reads existing derivations in `ArgumentRoom`:** `getRailActions` / `handleRailAction` / `railActionToBubbleControl` (`ArgumentSideActionRail.tsx` + `roomActionCodes.ts`), `selectedDockTarget` + `dockModel` (SC-004), `activePointFeedbackFlags` (`feedbackFlags/`), `timelineReadoutViewModel` + `ArgumentReplySidecar` (readout/sidecar), `mediatorBoard` (open-point membership), `handleOpenAnalysisSurface`.
- **Supersedes #504's B-half** — the data-rich sidecar, at the LOWER density the #504 PRODUCT-REDIRECT-001 comment mandates.

---

## Risks
- **Parity drift is THE risk.** Mitigation: the `roomCapabilityParityMatrix` test compares per-lens reachable-code SETS (not hand-lists) built from the single `getRailActions`/board-Act model, and asserts handler identity by source-scan. A future Exchange-only capability makes the two sets diverge → the matrix FAILS → cannot merge silently. Keep `PARITY_ACTION_CODES` derived from `ROOM_RAIL_ACTION_CODES` (the `satisfies` guard already fails the compiler if the code set drifts).
- **ROOM-002 contract lands differently than A1–A6.** Mitigation: the popover consumes prop-injected `actions` + `onAction`; the reconciliation surface is ~2 lines in `ArgumentRoom`. If ROOM-002 renames/relocates `getRailActions`, only that import + the parity model's import change.
- **`timelineSelectionSharedAcrossModes` one-selection-state pin.** Adding any `[xMessageId, setXMessageId]` state fails it. Mitigation: HARD CONSTRAINT in the change list — the popover rides `activeMessageId` + `selectedDockTarget` + a non-`MessageId` boolean.
- **`uxOneOneTwoDoctrine` apostrophe scanner.** A single apostrophe in a new `ArgumentRoom` comment poisons the file-wide scan and flags innocent distant comments (known MEMORY gotcha). Mitigation: all new comments apostrophe-free; run the suite pre-push.
- **Source-order pins (`uxOneOneTwoChromeLayerRemovals`).** Mitigation: add popover props to the existing `<MapView>` element (never a new component before it); mount sidecar links AFTER the readout/flags; keep the pinned readout substring intact.
- **SC-002 band popover coexistence.** With flag-on, the opt-in info-icon popover (retired bands) still reachable. Mitigation: documented; recommend leaving `ArgumentTimelineMap` untouched and filing a separate follow-up to retire the retired-band content; the optional NOTEd relaxation exists if the reviewer insists on zero coexistence.
- **`web:build` gate.** New `.tsx` under `room/` uses relative imports within the same dir + `../../` for feature siblings — jest mocks asset requires but Metro does not; run `npm run web:build` (no CI web-build step exists).

---

## Out of scope
- ROOM-002's Exchange re-weight (kind spines, one-primary-per-element) — that card owns `ExchangeView`.
- Retiring the SC-002 info-icon band popover / removing retired-band content (separate doctrine-cleanup follow-up).
- Double-tap-to-answer on Map nodes (Design Pass §5B) — deferred; "Answer this ↗" is the a11y-complete ≤2-tap path this card ships.
- Marker pins on the map (P5), voice entries, lane-algebra changes.
- Any new proof zone / dense classifier centerpiece (inverted by #504 PRODUCT-REDIRECT-001; proof stays inside the reused sidecar section).
- New action codes, Edge Functions, migrations, engine changes, service-role usage, AI calls.

## Doctrine self-check
- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; advisory-only):** the popover surfaces only Constitution-governed user moves; the sidecar shows advisory friendly flags behind disclosure. No standing/verdict/winner framing. No banned token (ban-list test). Score/flags never block; posting flows through the unchanged `submit-argument`.
- **§2/§3 (heat ≠ truth; popularity ≠ evidence):** no heat/engagement input feeds the popover or sidecar; open-point membership is procedural (mediator board), never "popular = right".
- **§4/§7 (AI limits; no client AI):** no AI call anywhere; the sidecar reads already-persisted advisory flags (post-storage), never authoritative.
- **§5 (engine sacred):** engine untouched; no import of the engine into any new file.
- **§6 (secrets):** no secret, no service-role, client-only.
- **§10a (Observations vs Allegations):** the reused friendly-flags surface preserves the machine-Observation vs user-Allegation distinction; §10a-sensitive observations stay composer-only (unchanged; ROOM-004 adds none).
- **§10 (v1 scope):** no voting/search/push/OAuth/public-API introduced.
- **timeline-grammar (bands retired):** the new popover is band-free; VISUAL-SIMPLIFY-003 band retirement is preserved.
- **accessibility-targets:** 44×44 on every `Pressable`; role+label+state; reduce-motion snap; color never the only signal; grayscale legible.
- **expo-rn-patterns:** RN primitives only; no new dep; pure `*Model.ts` with no React/Supabase imports; `web:build` gate honored.
- **A×B parity rule (Design Pass §6):** every `RailActionCode` reachable in both lenses for the same actor via the same handler — enforced by the parity matrix test.

## Operator steps (if any)
None — pure code change. Ships via the existing operator web/Expo build; the `room_exchange_v2` client rollout is the deliberate netlify-prod push already in the ASP program (no new flag, no new env var, no deploy of Edge/DB).

---

### Orchestrator-authored brief ledger
This design was authored from the GitHub issue #886 body + the closed #504 supersession + the Design Pass §5B/§6/J9 + a pre-launch codebase survey. Interpretive resolutions (for operator post-ship review):
- **Derived from operator source-of-truth:** the A×B parity rule, the #504 B-half assignment, the "bands stay retired" + "lower-density (PRODUCT-REDIRECT-001)" constraints — all verbatim from the issue/comments.
- **Derived from codebase survey (orchestrator default):** the decision to REUSE the existing Map col2 readout + flags as the sidecar (rather than a new dense sidecar); the decision to node-gate `actionDockModel` to null under flag-on to supersede the SC-004 dock without editing `ArgumentTimelineMap`; the decision to DEFER double-tap; the decision to LEAVE the SC-002 band popover untouched. **Operator-deferred review:** confirm (a) the SC-004-node-dock supersession is desired vs. co-rendering, and (b) the SC-002 band-popover coexistence is acceptable pending a follow-up.
- **Reconciliation-deferred:** A1–A6 depend on the concurrent ROOM-002 design; the implementer reconciles them before S2.
