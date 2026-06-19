# UX-BOARD-RAIL-001 — Persistent mediator rail + selected-node board topology

**Status:** Design draft (topology decision; the rail-placement IMPLEMENTATION is a separate later card)
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/706
**Base:** `5b764a4` · branch `feat/UX-BOARD-RAIL-001-board-topology`
**Lane:** Design / planning ONLY — **no production code in this card.** GATE-C: No (design doc only; no deploy / migration / provider / backend / Supabase / MCP / submit / classifier change). Effort (this design): **S–M** authoring; the implement sequence it spawns is **L** total.
**Owns:** the persistent rail / board-topology decision **pulled out of UX-SELECTED-NODE-001 (#687)**. The prior #687 design's global-left-rail recommendation (its O-2 explicitly deferred the left-rail because it "would force a layout rewrite of the timeline flex tree — broader than this card") is **superseded** and now lives here.
**Consumes (all merged on main):** UX-MEDIATOR-001 (precedence + `v4DisplayStateFor` + `V4_PRIMARY_STATE_PRIORITY`) · UX-MEDIATOR-002 (one node chip + chip-adjacent Inspect caret + `MediatorNodeInspectDetail` + `NodeLabelInspectGroups`) · UX-MEDIATOR-003 (evidence-blocked copy) · UX-MEDIATOR-004 (definition/scope copy) · UX-MEDIATOR-005 (`DisagreementPointsRail` — collapsed pill → sheet/side panel + distribution bar). Relates to: SC-005 (`ObserverActionDockLayout`), REF-006-RAIL (`OpenIssuesRail`), UX-001.1 (`useHeaderBreakpoint` / `resolveBand`).

---

## §0 Scope-reality audit (POSTRUN-UX001 rule — orchestrator-authored card, audit BEFORE any implement card is filed)

This card's success depends on **current layout, current data availability, and current source placement**, so a pre-build reality audit was run against the shipped room at base `5b764a4`. The audit reshapes the card from "decide & build the persistent board" into a **two-phase topology decision**: a no-code-now design that records the target topology + the responsive contract + the spawn sequence, because every ingredient already ships — the gap is *arrangement*, not *capability*.

### Finding A — the room is a SINGLE vertical column today, NOT a board

`ArgumentGameSurface.tsx` renders one `flex: 1` column (`styles.container`, L2076 / `styles.container` L2669 = `{ flex: 1, backgroundColor: '#020617' }`). Top-to-bottom, every viewport gets the SAME stack:

```
container (flex:1 column)
  ├─ microMoment banner            (transient)
  ├─ body (flex:1)                 — Timeline map  OR  Bubble stack (mode toggle)
  │     ├─ ArgumentTimelineMap     (horizontal DAW scrubber)  ── Timeline mode
  │     ├─ TimelineSelectedReadoutPanel (compact)             ── selected-node readout
  │     ├─ ArgumentScoreTracker
  │     ├─ mediator-node-chip-row  (ONE chip + Inspect caret) ── UX-MEDIATOR-002
  │     └─ CollapsedComposerStrip
  ├─ Referee banner / override sheet
  ├─ OpenIssuesRail                (collapsed pill → sheet/side)   REF-006-RAIL
  ├─ DisagreementPointsRail        (collapsed pill → sheet/side)   UX-MEDIATOR-005
  ├─ SeatAvailabilityStrip
  ├─ ArgumentSideActionRail        (collapsed dock → sheet/side)   SC-005
  ├─ board-menu-trigger-row        (Act · Inspect · Go)            UX-001.4
  └─ Inspect overlays (4 siblings, gated on inspectVisible)        UX-MEDIATOR-002/003/004 + REF-004
```

There is **no column split, no persistent rail, no two-pane / three-column layout at ANY viewport** today. The "rails" are all **bottom chrome**: collapsed-by-default pills that expand into a `'sheet'` (narrow) or a `'side'` 380px bottom-right panel (wide), governed by `resolveObserverDockVariant(width)` (`<720 → sheet`, `≥720 → side`). On wide viewports the three bottom rails (Open Issues, Disagreement Points, Side Action) are a **single-owner mutual-exclusion group** — only one expands at a time (`isAnyPanelOpen`), so even on a 1920px desktop the room never shows the rail and the timeline side-by-side. **Conclusion: the "stable board" the card asks for does not exist; this is a topology decision, not a tuning delta.**

### Finding B — every BOARD INGREDIENT already ships; the gap is arrangement

The three reading depths the issue names are each already rendered — just stacked vertically and (for depth 1) collapsed behind a pill:

| Reading depth | Already-shipped surface | Today's placement |
|---|---|---|
| (1) Room-level rail (disagreement points, evidence debts, definition/scope, impasses, distribution bar) | `DisagreementPointsRail` (UX-MEDIATOR-005, 854 lines) | collapsed pill → bottom sheet (<720) / 380px side panel (≥720); **collapsed by default** |
| (2) Selected node (active point · what it responds to · state · actions) | `TimelineSelectedReadoutPanel` (compact) + `mediator-node-chip-row` (one chip + Inspect caret) + the 4 Inspect overlays + the Act/Inspect/Go dock | stacked BELOW the timeline body |
| (3) Composer / next move | `CollapsedComposerStrip` + the composer (`ArgumentComposerDock`, App.tsx) + the dock's "Move forward:" routing | below the readout |

**Conclusion: this card does NOT author a new rail, a new selected-node detail, or a new composer.** It decides where the three already-built depths LIVE on a stable board, and the implement sequence it spawns re-parents them (no rebuild). This is the "reuse, never re-implement" discipline the whole mediator stack was built around.

### Finding C — the single-derivation invariant is the load-bearing constraint

`mediatorBoard` is derived ONCE in `ArgumentGameSurface` (`deriveRoomMediatorBoardState`, L694–704) and shared by the rail (`board=`, L2322), the node chip (`getNodeMediatorMarker(mediatorBoard, …)`, L711), and the Inspect detail. **Any board-topology change MUST keep this single derivation** — the new column layout consumes the same one `mediatorBoard`; it never re-derives per column (memory: `mediator-board-single-derivation`). This is the strongest reason the implement work is re-parenting (move where a consumer mounts), not re-architecting (no second board, no second pass).

### Finding D — TWO breakpoint systems already exist; the board topology must reconcile them, not add a third

| System | Helper | Bands | Owner |
|---|---|---|---|
| Header / room density | `resolveBand(width)` (`useHeaderBreakpoint`) | `phone` (<600) · `tablet` (600–1279) · `wide` (≥1280) | UX-001.1 / BRAND-001 |
| Bottom-rail dock variant | `resolveObserverDockVariant(width)` | `sheet` (<720) · `side` (≥720) | SC-005 |

The board topology decision (§4) **adopts the three-band `resolveBand` vocabulary as the column-count authority** (phone = 1 col, tablet = 2 col, wide = 3 col) and keeps `resolveObserverDockVariant` as the *rail-internal* sheet-vs-side authority for phone (the rail stays a sheet on phone). **No new breakpoint helper is added** — the topology composes the two shipped resolvers. (R1 below covers the one seam: `tablet` band spans 600–1279, which straddles the 720 dock boundary; §3 resolves it.)

### Finding E — the superseded #687 left-rail recommendation was deferred FOR A SPECIFIC REASON this card must honor

UX-SELECTED-NODE-001 §16 O-2 recommended a **top anchor over a left-rail** *specifically because* "a left-rail would force a layout rewrite of the timeline flex tree (broader than this card)." That rewrite is exactly THIS card's owned domain. The audit confirms the cost: turning the single `flex:1` column into a multi-column board touches `styles.container` / `styles.body` and re-parents 3+ mounted surfaces — a real, test-heavy layout change. This is why the card is split: **decide the topology here (no code), execute the re-parent in a dedicated implement card** with the heavily-pinned `ArgumentGameSurface` snapshot surface to manage.

**Effort re-estimate:** issue labels none. This DESIGN is **S–M** (audit + topology decision + table + spawn sequence). The IMPLEMENT sequence it spawns is **L** total (the flex-tree re-parent is genuinely test-and-care heavy because `ArgumentGameSurface` is the most heavily-pinned room file). The split is correct.

---

## Goal (one paragraph)

The room must read as a **stable mediator board** — a structured space whose three reading depths are always discoverable — rather than a horizontal timeline with collapsible side decorations bolted to the bottom. This card decides the **board topology**: which depth lives where, how the layout adapts across phone / tablet / desktop, which column the timeline becomes, and how the already-shipped `DisagreementPointsRail`, the selected-node treatment (UX-SELECTED-NODE-001 local scope), and the Act/Inspect/Go dock compose on that board. It is a **read-only projection of the once-derived `mediatorBoard`** (single-derivation invariant; Finding C) and changes **no behavior, no data, no engine, no submission gate** — the deterministic Constitution engine (`src/domain/constitution/engine.ts`) remains the sole acceptance gate; the mediator remains a read-only projection (`authoritative:false`). Doctrine (`cdiscourse-doctrine`): the rail is **STRUCTURAL, not a scoreboard** — no winner/loser/score/verdict/truth/wrong/dishonest/bad-faith/manipulative copy, no AI-judge framing, no popularity/heat ordering. **This card writes the topology decision only; the rail-placement implementation is a separate later card (UX-BOARD-RAIL-002, §10).**

---

## §1 Inventory — the current room layout + responsive bands (read before tabulating)

### Current composition (the single-column stack)

| Surface | File · site | What it does today | Topology role |
|---|---|---|---|
| Room shell | `ArgumentGameSurface.tsx:2076` (`styles.container` = `flex:1` column) | one vertical flex column for ALL viewports | becomes the board grid container |
| Timeline body | `ArgumentTimelineMap.tsx` (mounted `ArgumentGameSurface.tsx:2164`, inside `styles.body` `flex:1`) | horizontal DAW-style scrubber; one dot per move | the **argument-path column** (col 1) |
| Bubble stack body | `ArgumentBubbleStack` (mounted L2106, `mode === 'stack'`) | stacked-card alternative to the timeline | stays the body's alt mode (col 1) |
| Selected-node readout | `TimelineSelectedReadoutPanel.tsx` (mounted L2215, `compact`) | kindLine · bodyExcerpt · parentHint · Acting-on · expand → 6-section sidecar; IX-004 live-region inside | the **selected-node column** content (col 2) |
| One state chip + Inspect caret | `ArgumentGameSurface.tsx:2235–2254` (`mediator-node-chip-row`) | one `MediatorNodeMarker` + chip-adjacent Inspect Pressable (opens drawer) | selected-node column (col 2) |
| Score tracker | `ArgumentScoreTracker` (mounted L2219) | participant trend strip | selected-node column (col 2) |
| Collapsed composer strip | `CollapsedComposerStrip` (mounted L2262) | always-visible "what compose would act on" | composer zone (under col 2) |
| Open Issues rail | `OpenIssuesRail` (mounted L2302) | room-wide open-issues ledger; collapsed pill → sheet/side | bottom chrome (stays; see O-6) |
| **Disagreement Points rail** | `DisagreementPointsRail.tsx` (mounted L2321) | live points · distribution bar · evidence/definition/scope rows · jump; collapsed pill → sheet (<720) / 380px side (≥720); **collapsed by default**, mutual-exclusion group | the **Disagreement Points ledger column** (col 3) |
| Seat strip | `SeatAvailabilityStrip` (mounted L2340) | read-only public seat counts | bottom chrome (unchanged) |
| Side action rail | `ArgumentSideActionRail.tsx` (mounted L2348) | actor-aware verbs (Watch · Join · Reply · …); SC-005 dock | bottom chrome / col-2 action zone (O-5) |
| Act / Inspect / Go dock | `ArgumentGameSurface.tsx:2383` (`board-menu-trigger-row`) | three triggers; key badges web ≥1024; mutual-exclusion popouts | the board's **primary controls** (col 2 footer) |
| Inspect overlays (4 siblings) | `ArgumentGameSurface.tsx:2529–2590` (gate `inspectVisible && activeMessageId`) | `MediatorNodeInspectDetail` · `NodeLabelInspectGroups` · `MetadataDiffInspector` · `InspectOpenIssueDetail` | selected-node detail (col 2 overlay) |

### Responsive bands today

- **Header / density band** (`resolveBand`): `phone` <600 · `tablet` 600–1279 · `wide` ≥1280 · non-positive → `wide` (SSR-safe first paint). Drives logo + header height; **does not drive room column count today (there are no columns).**
- **Bottom-rail dock variant** (`resolveObserverDockVariant`): `sheet` <720 · `side` ≥720 · non-positive → `side`. The Disagreement Points + Open Issues + Side Action rails ALL use this: a bottom sheet on narrow, a 380px bottom-right panel on wide.
- **Mutual exclusion**: on every viewport, at most ONE bottom rail is expanded (`isAnyPanelOpen = Boolean(selectedDockTarget) || openIssuesRailExpanded || sideRailExpanded || disagreementPointsRailExpanded`). So the room never shows the timeline AND an expanded rail at once today — even at 1920px.

**Key audit conclusion feeding the tables: the board does not exist; the depths are all built; the topology decision is "which depth becomes which column at which band, and how the shipped rail/selected-node/AIG surfaces re-parent onto it without a second derivation."**

---

## §3 Responsive board spec (mobile bottom-sheet · tablet two-pane · desktop three-column)

The board adopts **`resolveBand` as the column-count authority** (Finding D) and keeps `resolveObserverDockVariant` as the rail-internal sheet-vs-side authority on phone:

| Band | Width | Columns | Layout | Disagreement Points (depth 1) | Selected node (depth 2) | Composer (depth 3) |
|---|---|---|---|---|---|---|
| **phone** | <600 | **1** | single column (today's stack) | **bottom sheet** (the SHIPPED `DisagreementPointsRail` `'sheet'` variant — collapsed pill → capped sheet, ~28% viewport) | inline, below the timeline body (today's `TimelineSelectedReadoutPanel` compact + chip row) | `CollapsedComposerStrip` → composer dock |
| **tablet** | 600–1279 | **2** | argument-path/selected (col 1) **+** Disagreement Points ledger (col 2) | **persistent right pane** (the rail's `'side'` variant promoted from collapsed-by-default to a docked ledger pane — see O-2) | col 1 (timeline + readout + chip + AIG) | col 1 footer (composer strip) |
| **wide** | ≥1280 | **3** | (1) argument path/timeline · (2) selected node + composer · (3) Disagreement Points ledger | **persistent col 3** | **col 2** (selected-node detail + the composer + the AIG dock) | **col 2** (composer is co-located with the selected node — the "respond to THIS point" adjacency the v4 board wants) |

**The seam (R1):** the `tablet` band (600–1279) straddles the `resolveObserverDockVariant` 720 boundary. **Resolution:** at the tablet band the board uses **2 columns regardless of the 720 dock boundary**, and the Disagreement Points col-2 pane renders the rail's `'side'` chassis (which is viewport-independent once mounted as a pane — it is a 380px `<View>`, not a sheet). The `resolveObserverDockVariant` resolver stays the authority ONLY for the **phone** band's bottom-sheet behavior. So: phone → rail is a `'sheet'`; tablet/wide → rail is a docked `'side'`-chassis pane. No third breakpoint; the two shipped resolvers compose cleanly under the band authority.

**Mobile bottom-sheet behavior (phone, <600):** UNCHANGED from the shipped rail. Collapsed pill ("Disagreement points · N ▾"), tap-to-expand → capped bottom sheet (`resolveSheetMaxHeightPx`, never full-screen, floor 168px), reduce-motion snaps, web-Escape collapses, mutual-exclusion with the other bottom rails preserved. The phone board IS the current single-column stack; the topology change is **zero on phone** (the rail is already the right shape there). This is intentional — the phone gets the smallest blast radius.

**Tablet two-pane behavior (600–1279):** col 1 = the argument-path body + the selected-node readout + chip + AIG dock (today's stack, narrowed to the left pane); col 2 = the Disagreement Points ledger promoted from a collapsed pill to a **persistent docked pane** (the rail's shipped `'side'` chassis, mounted as a flex column not a bottom overlay). The composer stays in col 1's footer. The mutual-exclusion group shrinks: on tablet the Disagreement Points pane is always visible (no longer in the bottom-rail group), so the bottom group reduces to Open Issues + Side Action (O-6).

**Desktop three-column board (≥1280):** col 1 = argument path / timeline; **col 2 = selected node + composer** (the selected-node readout + chip + Inspect entry + the AIG dock + the composer, co-located so "respond to this point" is one glance); col 3 = the Disagreement Points ledger (persistent). This is the v4 board the issue names. Col widths: col 3 = 380px (the shipped rail width — zero new sizing); col 1 + col 2 share the remainder via flex (recommend col 1 ~`flex:1.2`, col 2 ~`flex:1`, tunable in implement). Reduce-motion: no column-entry animation (snap). Color independence: column boundaries carry a 1px border (geometry), never color alone.

**Cross-device QA viewports (per `expo-rn-patterns`):** the implement card MUST verify the topology at **390×844 (phone, 1 col)**, **768×1024 (tablet portrait, 2 col)**, **1024×1366 (iPad Pro portrait — tablet band, 2 col)**, **1366×768 (narrow desktop — wide band, 3 col)**, **1920×1080 (wide desktop, 3 col)**. Note the 1024-width seam: at 1024px the board is 2 col (tablet band, <1280), and key badges follow `deriveMenuKeyBadgeContext` (web ≥1024 → badges) independently — the two thresholds are deliberately different and both are exercised.

---

## §4 Decisions this card owns (each resolved, with a recommendation)

**D-1 — Left rail vs right rail; does it differ by role / density / viewport?**
**Decision: RIGHT.** The Disagreement Points ledger is **col 3 on the right** at tablet+wide; the argument path is col 1 left; the selected node is the center. **Rationale:** (a) the shipped `'side'` variant already anchors **bottom-right** (`alignSelf:'flex-end'`, width 380) — right placement is zero re-architecture of the rail's own chassis; (b) left-rail would collide with the argument-path/timeline which is the natural left-to-right reading anchor (the timeline IS the spine); (c) the superseded #687 global-LEFT-rail recommendation was deferred precisely because left forces a flex rewrite — right reuses the shipped anchor. **Does it differ by role?** No — observers and participants see the IDENTICAL read-only ledger (the rail is read-only for both in v1; `viewerRole` only affects the Side Action rail's verbs, not the ledger). **By density/viewport?** Yes — it is a bottom sheet on phone, a docked right pane on tablet/wide (D-3). **By default-open?** Collapsed on phone (mutual-exclusion preserved); persistent (default-shown) as a pane on tablet/wide (O-2). **Recommendation: right rail, role-invariant, viewport-adaptive.**

**D-2 — Does the timeline stay the primary column or become an "argument path" column?**
**Decision: it becomes the "argument path" column (col 1)** but remains the primary spine. **Rationale:** the timeline is the move-by-move structure of the dispute — it is the *path through the argument*, which is exactly what col 1 should hold. Renaming it conceptually to "argument path" (no code rename, no `ArgumentTimelineMap` change) reframes it as one of three coordinated depths rather than "the screen with stuff bolted to the bottom." The bubble-stack mode stays its alternate body. **Recommendation: timeline = the argument-path column (col 1); no rename of the component, only a topology reframe; it stays the visual anchor.**

**D-3 — Mobile bottom-sheet behavior; tablet two-pane behavior; desktop three-column.**
**Decision: as §3.** Phone = 1 col + the shipped bottom sheet (zero change). Tablet = 2 col (argument-path/selected col 1 + Disagreement Points ledger col 2 pane). Desktop = 3 col (path · selected+composer · ledger). **Recommendation: adopt the §3 table; phone keeps the smallest blast radius (the sheet is already correct).**

**D-4 — Interaction between `DisagreementPointsRail`, selected-node detail, and Act/Inspect/Go.**
**Decision: the ledger DRIVES selection; the selected-node detail RESPONDS; AIG acts on the selection.** The shipped wiring already does this: a ledger row's "View in timeline →" calls `onJump(nodeId)` → `setActiveMessageId` + `setSelectionStatus('explicit')` (L2330–2333), which updates the selected-node readout/chip AND re-targets the AIG dock. On the board, this becomes a **cross-column** interaction: tap a point in col 3 → col 1 timeline scrolls/highlights the anchor node → col 2 selected-node detail updates → AIG (col 2 footer) acts on it. **No new handler** — the existing `onJump` + single `activeMessageId` selection state already coordinate all three; the board just makes the three columns simultaneously visible so the coordination is *seen* rather than inferred. **Recommendation: reuse the shipped `onJump`/`activeMessageId` single-selection spine; the board surfaces it; add no new selection state.**

**D-5 — How the rail avoids scoreboard / leaderboard / verdict framing.**
**Decision: structural ordering + structural copy + a composition bar (not a magnitude bar), all already enforced.** The ledger orders by `V4_PRIMARY_STATE_PRIORITY` (impasse-first STRUCTURE), **never by count, votes, heat, or engagement**. The distribution bar shows *composition* (flex-weighted by count, with a text count + legend) — it is "how the disagreement is shaped," not "who's winning." Every label flows through `plainLanguageForMediatorState` / `DISAGREEMENT_POINTS_RAIL_COPY` and is ban-list scanned. **The board changes NONE of this** — promoting the rail to a persistent column does not add a single number that reads as a score; it shows the SAME structural states more prominently. **Recommendation: inherit the shipped anti-scoreboard guarantees verbatim; the implement card re-runs the ban-list + no-magnitude-ordering tests over the persistent-pane render.**

**D-6 — Does the rail state-distribution stay a summary strip or become navigation?**
**Decision: it BECOMES light navigation, additively, without losing the summary.** Today the distribution bar (`disagreement-points-rail-distribution`) is a read-only composition summary. On the persistent board it gains an **optional** affordance: tapping a distribution segment scrolls the ledger to the first point in that bucket (a within-column scroll, not a new selection). This is a **deferred enhancement** (UX-BOARD-RAIL-003, §10) — the topology card and the first implement card keep the bar as a pure summary; navigation is a follow-up so the re-parent ships first with the smallest surface. **Recommendation: keep the bar a summary in the topology + first implement card; spawn UX-BOARD-RAIL-003 for segment-as-navigation; never make a segment width imply rank/score (composition only).**

**D-7 — How dormant chime-in affordances eventually integrate WITHOUT changing room semantics now.**
**Decision: the board reserves the SAME dormant render slot the rail already ships; no chime-in semantics change in any board card.** UX-MEDIATOR-005 already ships a dormant `↳ chime-in` marker (`isChimeInAnchor`, reads an OPTIONAL `contributionKind` that no producer fills today). The board carries this slot forward UNCHANGED — when UX-ROOM-1V1-CHIMEIN-001 lands and supplies `contributionKind`, the marker lights up in the persistent ledger with zero board-card change. **No board card adds a chime-in field, a seat, a principal, or a third voice.** **Recommendation: inherit the dormant slot; never synthesize the marker; chime-in data + semantics stay owned by UX-ROOM-1V1-CHIMEIN-001.**

---

## §5 REQUIRED DESIGN TABLE (core deliverable)

Legend: **timeline-geo** = does the timeline's own geometry change? · **DPR-change** = `DisagreementPointsRail` internal change? · **SN-change** = selected-node treatment change? · **behavior** = state/handler change? · **data/API** = data/network change? · **impl-card** = which spawned implement card owns it.

| Surface | Current implementation | Proposed board layout | Mobile (phone <600) | Tablet (600–1279) | Desktop (≥1280) | Rail side / placement | timeline-geo | DPR-change | SN-change | behavior | data/API | impl-card dep | Risk | Test strategy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Room shell / grid** | single `flex:1` column (`styles.container`) | a band-driven grid (1/2/3 col) via `resolveBand` | 1 col (today's stack) | 2 col flex row | 3 col flex row | n/a | **n** | **n** | **n** | **n** (layout only) | **n** | UX-BOARD-RAIL-002 | R1 (band/dock seam), R2 (pinned `ArgumentGameSurface` snapshot) | render at 5 viewports; assert col count per band; full surface-suite regression |
| **Argument path (timeline)** | `ArgumentTimelineMap`, in `styles.body` flex:1 | col 1 "argument path"; component unchanged | col 1 (full width) | col 1 (left pane) | col 1 (left, ~flex:1.2) | n/a (it is the spine) | **n** | **n** | **n** | **n** | **n** | UX-BOARD-RAIL-002 | R3 (timeline width assumptions in narrow pane) | re-parent render test; reduce-motion; 390px no-overflow |
| **Selected-node readout + chip + AIG** | stacked below timeline (`TimelineSelectedReadoutPanel` + `mediator-node-chip-row` + `board-menu-trigger-row`) | col 2 "selected node + composer" | inline below timeline (today) | col 1 footer | **col 2** (center) | n/a | **n** | **n** | **n** (UX-SELECTED-NODE-001 owns content) | **n** (re-parent only) | **n** | UX-BOARD-RAIL-002; consumes UX-SELECTED-NODE-001 | R4 (selected-node card not yet merged) | assert readout+chip+AIG mount in col 2 at wide; a11y preserved |
| **Disagreement Points ledger** | `DisagreementPointsRail`, collapsed pill → sheet/side, bottom chrome, mutual-exclusion | col 3 persistent ledger (tablet+wide); bottom sheet (phone) | bottom **sheet** (shipped `'sheet'` variant, unchanged) | **persistent right pane** (`'side'` chassis as a flex col) | **persistent col 3** (380px) | **RIGHT** | **n** | **MINIMAL** — add a `presentation: 'sheet' \| 'pane'` prop so the side chassis can mount as a docked pane vs a bottom overlay; NO row/copy/distribution change | **n** | **MINIMAL** (new presentation prop; default `'sheet'` = byte-identical phone) | **n** | UX-BOARD-RAIL-002 | R5 (promoting collapsed→persistent must not break mutual-exclusion), R6 (default-open churns rail snapshots) | extend `DisagreementPointsRail.test.tsx` with the pane variant; assert phone `'sheet'` byte-identical; mutual-exclusion regression |
| **Composer / next move** | `CollapsedComposerStrip` + composer dock | col 2 footer (co-located with selected node) | below readout (today) | col 1 footer | **col 2 footer** | n/a | **n** | **n** | **n** | **n** (re-parent only) | **n** | UX-BOARD-RAIL-002 | R7 (composer dock is App.tsx-level, not surface-level) | assert composer adjacency in col 2 at wide; keyboard focus order |
| **Act / Inspect / Go dock** | `board-menu-trigger-row`, after the rails | col 2 footer — the board's primary controls | below stack (today) | col 1 footer | col 2 footer | n/a | **n** | **n** | **n** | **n** (re-parent) | **n** | UX-BOARD-RAIL-002 | R8 (popout mount sites pinned by `boardActPopoutMountSite.test.ts`) | assert AIG + popouts mount in col 2; key-badge gating unchanged |
| **Open Issues rail** | `OpenIssuesRail`, bottom chrome, mutual-exclusion | stays bottom chrome OR folds into col 3 above the ledger (O-6) | bottom sheet (unchanged) | bottom sheet OR col-3 section | bottom sheet OR col-3 section | bottom / right | **n** | **n** | **n** | **n** (placement) | **n** | UX-BOARD-RAIL-002 (or deferred) | R9 (two ledgers competing for col 3) | O-6 decision; default = leave bottom chrome (zero change) |
| **Side action rail** | `ArgumentSideActionRail` (SC-005 dock), bottom chrome | stays bottom dock (phone) / col-2 action zone (wide) (O-5) | bottom dock (unchanged) | bottom dock | bottom dock OR col-2 zone | bottom | **n** | **n** | **n** | **n** (placement) | **n** | UX-BOARD-RAIL-002 (or deferred) | R10 (verb dock vs AIG dock both in col 2) | O-5 decision; default = leave bottom dock (zero change) |
| **State-distribution bar** | summary strip in the rail header | summary now; segment-as-navigation later | summary (unchanged) | summary | summary | within col 3 | **n** | **n** (now) / additive (later) | **n** | **n** (now) | **n** | UX-BOARD-RAIL-003 (navigation) | R11 (segment tap reading as rank) | D-6; keep composition-only; defer navigation |
| **Dormant chime-in marker** | `↳ chime-in` slot, reads optional `contributionKind` | carried forward unchanged in the persistent ledger | dormant (unchanged) | dormant | dormant | within col 3 | **n** | **n** | **n** | **n** | **n** | UX-ROOM-1V1-CHIMEIN-001 (data) | R12 (never synthesize) | assert no marker without data on the pane |

**Safe-now vs deferred summary:** the topology decision is design-only (no code in THIS card). The first implement card (UX-BOARD-RAIL-002) is a **layout re-parent + one minimal `presentation` prop on the rail** — every behavior, every data path, the single derivation, the timeline geometry, the rail rows, and the selected-node content are UNCHANGED. The deferred slices are: segment-as-navigation (UX-BOARD-RAIL-003), Open-Issues/Side-Action col placement (O-5/O-6, optionally deferred), and the chime-in data (UX-ROOM-1V1-CHIMEIN-001).

---

## §6 How it reuses the shipped surfaces (extend, never rebuild)

**`DisagreementPointsRail` (UX-MEDIATOR-005) — EXTEND with ONE presentation prop, do not rebuild.** The rail already has the `'side'` chassis (380px, `alignSelf:'flex-end'`) and a `'sheet'` chassis. The board needs the `'side'` chassis to mount as a **docked flex column** rather than a bottom-anchored overlay. The smallest delta the implement card will make: add an optional `presentation?: 'sheet' | 'pane'` prop (default `'sheet'` → today's behavior, byte-identical on phone). When `'pane'`, the rail renders expanded-by-default, without the bottom-overlay positioning, as a column child. **No row, copy, distribution, jump, evidence, definition/scope, or chime-in change** — those are owned by UX-MEDIATOR-001..005 and are consumed verbatim. The collapsed pill stays the phone affordance. This is the entire rail delta the topology implies.

**Selected-node treatment (UX-SELECTED-NODE-001 local scope) — CONSUME, do not modify.** UX-SELECTED-NODE-001 owns the selected-node content (responding-to anchor, parent excerpt, one chip, the four-section Inspect drawer, the halo). This card **re-parents those surfaces into col 2** at wide; it changes none of their content or behavior. The two cards compose: #687 makes the selected node "the center of the room" as CONTENT; this card makes col 2 "the center of the board" as PLACEMENT. (Dependency: the board implement card should land AFTER UX-SELECTED-NODE-001 merges, so col 2 re-parents the final selected-node surfaces — R4.)

**Act / Inspect / Go dock (UX-001.4) — RE-PARENT, do not reinvent.** The `board-menu-trigger-row` + its `ActPopout`/`InspectPopout`/`GoPopout` mount where they are today; the board moves the trigger row into col 2's footer. The popout mount sites are pinned by `boardActPopoutMountSite.test.ts` (R8) — the implement card updates that test's expected mount path in lockstep. The key-badge platform gating (`deriveMenuKeyBadgeContext`, web ≥1024) is untouched.

**The single-derivation spine — PRESERVE.** `mediatorBoard` is derived once (L694) and passed to col 3's rail and col 2's chip/Inspect from the SAME value. The board adds NO second derivation (Finding C; memory `mediator-board-single-derivation`). A test asserts `deriveRoomMediatorBoardState` is called once per render.

---

## §10 Proposed sequence of IMPLEMENT cards this design spawns (+ dependencies / risks)

| Card | Scope | Depends on | Effort | Risk |
|---|---|---|---|---|
| **UX-BOARD-RAIL-002 — board re-parent (the topology implementation)** | Turn `styles.container` into a band-driven 1/2/3-col grid (`resolveBand`); re-parent the argument-path body (col 1), the selected-node readout+chip+AIG+composer (col 2), the Disagreement Points ledger (col 3). Add the `presentation: 'sheet' \| 'pane'` prop to `DisagreementPointsRail` (default `'sheet'` = byte-identical phone). Preserve the single derivation; preserve all behavior/data/handlers. | UX-MEDIATOR-001..005 (merged); **UX-SELECTED-NODE-001 (merge FIRST** so col 2 re-parents the final selected-node surfaces) | **L** | R2 (heavily-pinned `ArgumentGameSurface` snapshot), R4 (#687 ordering), R5/R6 (rail pane variant + mutual-exclusion), R7 (App.tsx composer level), R8 (`boardActPopoutMountSite.test.ts`) |
| **UX-BOARD-RAIL-003 — distribution-bar segment navigation** | Tapping a distribution segment scrolls col 3 to the first point in that bucket (within-column scroll, NOT a selection or a score). Additive to the persistent ledger. | UX-BOARD-RAIL-002 | **S** | R11 (segment tap reading as rank — composition-only copy + a11y guard) |
| **UX-BOARD-RAIL-004 (optional) — Open Issues + Side Action column placement** | Resolve O-5 (Side Action verbs as a col-2 zone at wide) + O-6 (Open Issues folded into col 3 above the ledger). Only if the operator wants the bottom-chrome cleanup; default leaves both as bottom chrome (zero change in 002). | UX-BOARD-RAIL-002 | **S–M** | R9 (two ledgers in col 3), R10 (two docks in col 2) |
| **(consumed, not spawned) UX-ROOM-1V1-CHIMEIN-001** | Supplies the `contributionKind` data that lights up the dormant `↳ chime-in` marker in the persistent ledger. NOT a board card. | independent | — | R12 (never synthesize) |

**Sequencing rule:** 002 is the only card that touches the room flex tree; it MUST run after UX-SELECTED-NODE-001 merges. 003 and 004 are additive follow-ups on the shipped board. Each implement card runs the FULL `npm test` (exit-0, captured) — `ArgumentGameSurface` snapshots make tailed runs insufficient (test-discipline gate-timeout rule).

---

## §11 Edge cases (the implement cards must handle)

- **Empty board / no points** — col 3 (tablet/wide) shows the shipped `disagreement-points-rail-empty` copy as a persistent pane; phone shows it on sheet-expand. The pane never collapses to zero width (reserve the 380px even when empty, OR collapse to a thin "no open points" strip — O-4).
- **Board unavailable (`board == null`)** — col 3 shows `disagreement-points-rail-unavailable`; col 1/col 2 render normally (the timeline + selected node do not depend on the ledger).
- **Root node selected (no parent)** — col 2's responding-to anchor omits cleanly (UX-SELECTED-NODE-001 handles this); the board adds no new empty-state.
- **Viewport resize across a band boundary** — the grid re-flows (1↔2↔3 col) on `resolveBand` change; the single `activeMessageId` selection survives the re-flow (it is room state, not column state); reduce-motion snaps the re-flow.
- **The 1024px seam** — at 1024px width the board is 2 col (tablet band, <1280) while key badges render (web ≥1024). Both thresholds are correct and different; the implement card's viewport matrix asserts both.
- **Concurrent rail + selection** — tapping a col-3 row while a col-2 Inspect drawer is open: the selection updates both; no modal conflict (both are inline, never a `Modal` — TL-003/SC-003 doctrine).
- **Offline / network failure** — irrelevant to layout (the board is a pure projection; no fetch). The underlying data states are owned by the data cards.
- **Permission-denied / observer** — observers see the identical read-only board (D-1); only the Side Action rail's verbs differ, and those are unchanged.
- **Phone has the smallest blast radius** — phone topology is UNCHANGED (the shipped sheet is already correct); a regression test asserts the phone render is byte-identical to today (`presentation='sheet'` default).

---

## §12 Test plan (for the SPAWNED implement cards — this design card writes NO tests)

This card is design-only; it adds no tests. The implement cards (UX-BOARD-RAIL-002+) must:

- `__tests__/uxBoardRail002Topology.test.tsx` (new) — render the surface at 390 / 768 / 1024 / 1366 / 1920; assert **column count per band** (1 / 2 / 2 / 3 / 3); assert each depth mounts in the expected column.
- **Phone byte-identity** — assert the phone (390) render keeps the shipped single-column stack + collapsed `DisagreementPointsRail` `'sheet'` (no topology change on phone).
- **Single-derivation invariant** — assert `deriveRoomMediatorBoardState` is invoked exactly once per render even with 3 columns consuming the board.
- **Cross-column selection coordination** — tap a col-3 ledger row → assert `setActiveMessageId` fires once and col-2 selected-node detail + col-1 timeline highlight update from the SAME `activeMessageId` (D-4); no new selection state.
- **Rail pane variant** — extend `__tests__/DisagreementPointsRail.test.tsx`: `presentation='pane'` renders expanded-by-default as a column child (no bottom-overlay positioning); `presentation='sheet'` (default) is byte-identical to today; mutual-exclusion preserved when the rail is a bottom sheet.
- **AIG re-parent** — update `__tests__/boardActPopoutMountSite.test.ts` expected mount path in lockstep; assert Act/Inspect/Go + popouts mount in col 2; key-badge gating unchanged.
- **Doctrine ban-list (mandatory)** — scan ALL rendered board strings (rail rows, distribution legend, column headers if any, selected-node copy) for `_forbiddenMediatorTokens()` + snake_case + winner/loser/score/verdict/truth/wrong/dishonest/bad-faith/manipulative/heat/popularity → none.
- **No-magnitude-ordering** — assert col-3 points order by `V4_PRIMARY_STATE_PRIORITY`, never by count/votes (D-5).
- **a11y** — every interactive element role+label+state+44×44 across all 5 viewports; column boundaries carry geometry (border) not color-only; reduce-motion snaps the re-flow; tab/focus order = col 1 → col 2 → col 3 on web; grayscale-legible.
- **Full-suite regression** — re-run the whole `__tests__/{uxMediator00*,DisagreementPointsRail,disagreementPointsRail*,timelineSelectedReadout*,uxOneOneTwo*,boardActPopoutMountSite,argumentTimelineMap*,roomMediatorAdapter,mediatorBoardState}.test.*` suite; full `npm test` exit-0 (captured), test count UP.

---

## §13 Dependencies (cards / docs / files)

- **Consumes (merged on main):** UX-MEDIATOR-001..005 (`docs/designs/UX-MEDIATOR-001.md`..`005.md`); SC-005 (`ObserverActionDockLayout`); REF-006-RAIL (`OpenIssuesRail`); UX-001.1 (`useHeaderBreakpoint` / `resolveBand` / `BRAND.breakpoints`); UX-001.4 (`board-menu-trigger-row` + `deriveMenuKeyBadgeContext`).
- **Supersedes:** the global-left-rail recommendation in UX-SELECTED-NODE-001 (#687) — its O-2 deferred the left-rail to "a layout rewrite broader than this card," which is this card's owned domain. This card decides RIGHT, not left (D-1).
- **Implement ordering dependency:** UX-BOARD-RAIL-002 (the re-parent) MUST land AFTER UX-SELECTED-NODE-001 merges (R4), so col 2 re-parents the final selected-node surfaces.
- **Reads existing (no re-derivation):** the once-derived `mediatorBoard` (`ArgumentGameSurface.tsx:694`), `getNodeMediatorMarker`, the rail's `'side'`/`'sheet'` chassis (`resolveObserverDockVariant` / `resolveSheetMaxHeightPx`), the band resolver (`resolveBand`), the AIG dock + popouts, the selected-node readout/chip/Inspect overlays.
- **Single-derivation invariant** (memory: `mediator-board-single-derivation`): the board is derived ONCE and shared by all three columns — never re-derived per column.
- **Engine path note** (memory: `claude-md-engine-path-stale`): the live engine is `src/domain/constitution/engine.ts`; no board card imports it — gate-independence is structural.
- **Mobile overflow note** (memory: `mobile-responsive-overflow-causes`): the implement card reuses `useHeaderBreakpoint`/`resolveBand` + `TOUCH_TARGET(44)`; the col-3 380px width must not push col 1+2 below the 390px phone floor (phone is 1 col, so this only bites if the tablet band's lower edge — 600px — can't fit 380 + a usable col 1; §3 keeps phone at 1 col precisely to avoid this).

---

## §14 Risks (for the implement cards)

- **R1 — Band/dock breakpoint seam.** `resolveBand` (600/1280) and `resolveObserverDockVariant` (720) disagree in the tablet band. **Mitigation:** §3 makes `resolveBand` the column authority; the rail's `'side'` chassis is viewport-independent once mounted as a pane; `resolveObserverDockVariant` governs ONLY the phone sheet. No third breakpoint.
- **R2 — `ArgumentGameSurface` is the most heavily-pinned room file.** Re-parenting its flex tree risks broad snapshot churn. **Mitigation:** the re-parent is structural (move mount sites into columns), not behavioral; run the FULL suite (not tailed); update pinned mount-site tests in lockstep; consider extracting a `RoomBoardLayout.tsx` presentational grid wrapper so the surface file's logic is untouched (O-3).
- **R3 — Timeline width assumptions in a narrow col 1.** `ArgumentTimelineMap` is a horizontal scrubber; in a narrower pane it must still scroll horizontally, not clip. **Mitigation:** the timeline is already a horizontal `ScrollView`; verify no fixed-width assumption breaks in a flex pane at 768/1024.
- **R4 — UX-SELECTED-NODE-001 not yet merged on main at base `5b764a4`.** Col 2 re-parents its surfaces. **Mitigation:** sequence 002 after #687 merges; if #687 slips, 002 re-parents the CURRENT (pre-#687) selected-node surfaces and a follow-up reconciles — but the clean path is #687 first.
- **R5 — Promoting the rail from collapsed-by-default to a persistent pane must not break the bottom-rail mutual-exclusion group.** **Mitigation:** on tablet/wide the Disagreement Points pane LEAVES the bottom group (it is a column, not a bottom overlay), so the group shrinks to Open Issues + Side Action; on phone the rail stays in the group unchanged. The `presentation` prop gates this cleanly.
- **R6 — Default-open pane churns rail snapshots.** **Mitigation:** the `presentation='pane'` path is a new render branch; `presentation='sheet'` (default) keeps every shipped fixture byte-identical; the phone byte-identity test pins it.
- **R7 — The composer dock is App.tsx-level, not `ArgumentGameSurface`-level.** Co-locating it in col 2 may cross the component boundary. **Mitigation:** the `CollapsedComposerStrip` IS in `ArgumentGameSurface` (L2262) and re-parents cleanly; the full composer dock (`ArgumentComposerDock`) is App.tsx and may stay where it is — the board co-locates the STRIP in col 2 and leaves the expand-to-dock flow unchanged (the dock is a transient overlay, not a column resident).
- **R8 — `boardActPopoutMountSite.test.ts` pins the AIG popout mount path.** **Mitigation:** update the expected mount path in lockstep with the re-parent.
- **R9/R10 — Two ledgers (Open Issues + Disagreement Points) or two docks (Side Action + AIG) competing for one column.** **Mitigation:** O-5/O-6 default to LEAVING Open Issues + Side Action as bottom chrome (zero change in 002); only UX-BOARD-RAIL-004 consolidates them, and only if the operator wants it.
- **R11 — Distribution segment tapped → reads as rank/score.** **Mitigation:** D-6 keeps the bar composition-only; navigation (003) scrolls to a bucket, never reorders by magnitude; a11y label says "scroll to <state> points," never "rank."
- **R12 — Chime-in marker synthesized from absent data.** **Mitigation:** carry the dormant slot UNCHANGED; never synthesize; a test asserts no marker without `contributionKind`.

---

## §15 Out of scope (explicit non-goals)

- **NO production code in THIS card** — design / topology decision only. The rail-placement implementation is UX-BOARD-RAIL-002 (a separate later card).
- **NO backend / room / seat / chime-in / persistence / Supabase / MCP / submit-path / classifier change** — in any board card. The board is a pure read-only layout projection.
- **NO second board derivation** — the single-derivation invariant is preserved; all columns consume the one `mediatorBoard`.
- **NO timeline geometry change** — the timeline is re-parented into col 1, not re-rendered (no lane/dot/branch change; `timeline-grammar` is untouched).
- **NO `DisagreementPointsRail` row / copy / distribution / jump / evidence / definition/scope / chime-in change** — only an additive `presentation` prop (UX-MEDIATOR-001..005 own the internals).
- **NO selected-node CONTENT change** — UX-SELECTED-NODE-001 owns it; the board only re-parents it.
- **NO new breakpoint helper** — the board composes `resolveBand` + `resolveObserverDockVariant`.
- **NO scoreboard / leaderboard / verdict / winner / loser / score / heat / popularity surface** — the rail stays structural.
- **NO AI-judge framing; NO AI call from the production app; NO service-role; NO new dependency; NO route/model/type rename; NO deploy; NO netlify-prod fast-forward.**
- **NO voting, search, OAuth, push, public API, realtime body editing** (v1 scope guards).
- **NO segment-as-navigation in the first implement card** — deferred to UX-BOARD-RAIL-003.

---

## §16 Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the board is a layout of structural states + structural moves; it shows no verdict/person/truth label; it imports nothing from the engine and gates nothing; the deterministic engine stays the sole submission gate. The persistent ledger is the SAME structural rail, more visible — not a scoreboard. PASS.
- **§2 (heat ≠ truth) / §3 (popularity is not evidence):** no heat/engagement/like/view/follower/trending token enters any column; col-3 ordering is `V4_PRIMARY_STATE_PRIORITY` (structure), never count/vote/heat; the distribution bar is composition, not magnitude/popularity. PASS.
- **§4 (AI moderator limits):** the mediator board is a read-only projection of advisory, `authoritative:false` observations; no board card runs AI, mutates content, or asserts truth; no AI call from the production app. PASS.
- **§5 (engine is sacred):** no board card touches `src/domain/constitution/engine.ts`; the board is gate-independent by construction. PASS.
- **§9 (plain language):** every label flows through the shipped plain-language maps; no raw classifier key / snake_case reaches any column (re-asserted by the implement card's ban-list test). PASS.
- **§10a (Observations vs Allegations):** col 3 surfaces machine **Observations** as structural states (never a user **Allegation** as a state); the selected-node detail (col 2) keeps "Machine Observations" / "User Allegations" separate; sensitive composer-only Observations reach neither column for the target node; the dormant `↳ chime-in` is a contribution marker, never a state. PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing. PASS.
- **accessibility-targets:** 44×44 on every interactive element across all 5 viewports; column boundaries carry geometry (border), not color-only; reduce-motion snaps the re-flow; tab/focus order col1→col2→col3 on web; key-badge gating via `deriveMenuKeyBadgeContext` unchanged; grayscale-legible. PASS (spec for the implement card).
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`/`ScrollView`) + flexbox columns (no CSS grid, no new dep); reuses `designTokens` + the shipped rail chassis + `resolveBand`; the only new prop is `presentation: 'sheet' | 'pane'` on the existing rail. PASS.
- **test-discipline:** this design card writes no tests (design-only, no code); the spawned implement cards carry the full test plan (§12) with the full-suite exit-0 gate and the phone byte-identity + single-derivation + ban-list + viewport-matrix assertions. PASS (plan).

---

## §17 Operator steps (if any)

**None — this card produces a design doc only.** No `db push`, no `functions deploy`, no env var, no migration, no deploy, no netlify-prod fast-forward. The spawned implement cards (UX-BOARD-RAIL-002+) are pure UI changes merged via the normal green-PR path; the single-derivation site picks them up with no operator action.

---

## §18 Open questions for the operator (each with a designer recommendation)

- **O-1 (column order at wide — path · selected+composer · ledger):** the issue specifies "(1) argument path/timeline · (2) selected node + composer · (3) Disagreement Points ledger" — left-to-right. **Recommendation: adopt the issue's order verbatim** (path left, selected center, ledger right). It matches D-1 (ledger right = the shipped `'side'` anchor) and reads left-to-right as "the path → the point I'm on → the open disagreements." Alternative (ledger center) is rejected: it buries the selected node, the user's primary focus.
- **O-2 (col-3 default-open on tablet/wide vs collapsed-by-default):** today the rail is collapsed-by-default (observer-first). On a persistent board the ledger has dedicated real estate. **Recommendation: default-OPEN as a pane on tablet/wide** (the whole point of a persistent ledger column is that it's always there), but keep **collapsed-by-default on phone** (the sheet preserves the mutual-exclusion + space economy). The `presentation` prop encodes this: `'pane'` = expanded; `'sheet'` = collapsed pill.
- **O-3 (re-parent in-place vs extract a `RoomBoardLayout.tsx` grid wrapper):** the flex-tree change can be inline in `ArgumentGameSurface` or extracted into a pure presentational grid component. **Recommendation: extract `RoomBoardLayout.tsx`** — it keeps the heavily-pinned surface file's LOGIC untouched (only its render tree moves into the wrapper), is independently testable at the 5 viewports, and matches the "small presentational wrapper" pattern the mediator stack already uses. Reduces R2's snapshot blast radius.
- **O-4 (empty col-3 — reserve 380px vs thin "no open points" strip):** when there are no live points, should the persistent ledger column hold its 380px or shrink? **Recommendation: render the shipped empty-state copy in a 380px pane** (stable board geometry; the column doesn't jump when the first point appears). A thin strip is an enhancement if operators find the empty pane wasteful — defer.
- **O-5 (Side Action rail at wide — bottom dock vs col-2 action zone):** the SC-005 verb dock could fold into col 2 alongside the AIG dock at wide. **Recommendation: LEAVE it as a bottom dock in UX-BOARD-RAIL-002 (zero change)**; consolidate into col 2 only in the optional UX-BOARD-RAIL-004 if the operator wants the bottom-chrome cleanup. Two docks in col 2 (verbs + AIG) risk crowding (R10); keep the first re-parent minimal.
- **O-6 (Open Issues rail at wide — bottom chrome vs col-3 section above the ledger):** Open Issues and Disagreement Points are both room-wide ledgers; on a board they could share col 3. **Recommendation: LEAVE Open Issues as bottom chrome in 002 (zero change)**; fold it into col 3 (above the Disagreement Points ledger) only in UX-BOARD-RAIL-004. Two ledgers in col 3 need a deliberate stacking design (R9); don't bundle it into the first re-parent.
- **O-7 (does the board apply to BOTH timeline and stack modes, or timeline only?):** the body has a Timeline/Stack toggle. **Recommendation: the board grid applies to BOTH modes** — col 1 holds whichever body mode is active (timeline scrubber OR bubble stack); col 2/col 3 are mode-independent (they read the selected node + the board, not the body presentation). This keeps the toggle a col-1-internal choice, not a board-topology fork.

---

## §19 Orchestrator-authored brief ledger (POSTRUN-UX001 lesson)

This card's issue (#706) is orchestrator/roadmap-authored, not operator-authored. Where each design decision came from:

- **Prior-Phase framing (operator-validated source-of-truth chain):** the single-derivation invariant, the shipped `DisagreementPointsRail` `'sheet'`/`'side'` chassis, the `resolveObserverDockVariant` boundary, the `resolveBand` three-band vocabulary, the AIG dock + key-badge gating, the selected-node readout/chip/Inspect surfaces — all from the merged UX-MEDIATOR-001..005 + SC-005 + REF-006-RAIL + UX-001.x designs and the shipped code at base `5b764a4`.
- **Epic framing:** the v4 "stable mediator board" + three reading depths + the desktop three-column spec — from issue #706 and the CivilDiscourse v4 UX overhaul slate.
- **Pre-launch codebase survey (this §0 reality audit):** Finding A (room is a single column, no board today), Finding B (every depth ships, the gap is arrangement), Finding C (single-derivation is the load-bearing constraint), Finding D (two breakpoint systems must be reconciled, not extended), Finding E (the #687 left-rail was deferred for the flex-rewrite cost this card owns).
- **Resolved by orchestrator default (flagged for operator review):** D-1 (right rail), D-2 (timeline = argument-path col), D-6 (distribution stays summary; navigation deferred), and the seven O-decisions in §18 (column order, default-open, wrapper extraction, empty col-3, Side-Action placement, Open-Issues placement, board-applies-to-both-modes). The supersession of #687's left-rail with a RIGHT-rail recommendation is an orchestrator interpretation grounded in the shipped `'side'` anchor + the timeline-as-left-spine reading.
- **Operator-deferred review:** the seven O-decisions in §18; the spawn sequence in §10 (especially whether UX-BOARD-RAIL-004 is wanted at all); the implement-ordering dependency on UX-SELECTED-NODE-001 (R4). Post-ship revision (if any) should target these specific interpretations.
