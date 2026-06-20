# UX-BOARD-RAIL-004 — consolidate Open Issues / side action / board chrome into the mediator board

**Status:** Design draft (full surface mapping + a CONSERVATIVE safe-now subset; the A/B Open-Issues placement is held as an operator product decision)
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/730
**Branch:** `feat/UX-BOARD-RAIL-004-board-chrome`
**Implements (deferred-from):** UX-BOARD-RAIL-001 (#706) §10 — the explicitly-spawned "Open Issues + Side Action column placement" follow-up (O-5 / O-6, which RAIL-001 and RAIL-002 deliberately left as bottom chrome — "zero change in 002").
**Lane:** Design-first. GATE-C: **No** (no deploy / migration / provider / backend / Supabase / MCP / submit / classifier / engine change). The safe-now subset, if green-lit, is **local UI / layout / copy / test only**, default behavior unchanged. Effort (this design): **S–M**. The recommended safe-now subset: **S**. The A/B placement decision (if the operator chooses it): **M**.

---

## §1 Summary + the three reading depths + the consolidation goal

The signed-in room currently reads as **a board plus scattered bottom/side decorations**. RAIL-002 turned the single column into a band-driven 1/2/3-column board (`RoomBoardLayout.tsx`), and RAIL-003 made the right ledger's distribution strip a local navigator — but RAIL-001/002 *deliberately deferred* the bottom-chrome cleanup. Today, below the board columns, three surfaces still float as a flat `bottomChrome` slot (`ArgumentGameSurface.tsx:2736-2799`):

- `OpenIssuesRail` — a collapsed "Open issues · N ▾" pill → sheet/side panel.
- `SeatAvailabilityStrip` — the "N of M active seats · … · You're watching." line.
- `ArgumentSideActionRail` — the floating "Watch ▾" / Join / Reply dock.

On phone all three plus the Disagreement Points sheet stack as a column of pills; on wide they sit as a full-width band beneath the three columns. The result reads as decoration competing with the board, not as one mediator board.

This card owns the **visual + interaction PLACEMENT** of those surfaces and how they relate to the persistent Disagreement Points ledger (col 3). It changes **no behavior, no data, no semantics** — it is a placement/grouping/copy pass that preserves the three reading depths and reduces stray chrome.

**The three reading depths (must each stay discoverable):**

1. **Argument path** — what happened in the thread. (col 1: `ArgumentTimelineMap` / `ArgumentBubbleStack`.)
2. **Selected point + actions** — what point is active and what actions are available. (col 2: `TimelineSelectedReadoutPanel` + chip row + composer strip + **Act / Inspect / Go**.)
3. **Mediator ledger** — what remains unresolved + what would move it forward. (col 3: `DisagreementPointsRail`, the persistent right ledger.)

**Consolidation goal:** make the room feel like ONE board by (a) giving the scattered bottom chrome a single, calm, board-bottom grouping with clear ownership; (b) deciding where Open Issues belongs relative to the right ledger (A/B — a product decision); (c) keeping Act/Inspect/Go in the selected-node column (where RAIL-002 already placed it); (d) keeping observer/seat status visible but quiet. **No surface loses reachability; no surface becomes a scoreboard.**

---

## §2 Surface mapping table (one row per surface; the core deliverable)

Legend for the last columns: **Touched?** Y/N for Behavior, Data/API, Room-seat-chime-in semantics. **Disposition:** *bottom chrome* (stays in the bottom-chrome group) / *→ right ledger* (folds into / attaches to col 3) / *→ selected-node col* / *as-is* (no change). **Safe-now vs deferred** is the recommendation, not a mandate.

| Surface | Current implementation (file:line) | Current placement | Current user purpose | Proposed placement | Phone | Tablet | Desktop | Disposition | Behavior touched | Data/API touched | Seat/chime-in semantics touched | Risk | Test strategy | Safe now or deferred |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **OpenIssuesRail** | `src/features/arguments/openIssuesRail/OpenIssuesRail.tsx:100-340`; mounted `ArgumentGameSurface.tsx:2747-2757` (in `bottomChrome`) | bottom chrome, collapsed pill "Open issues · N ▾" → sheet (<720) / 380 side (≥720) | room-wide ledger of unresolved issues (jump / Inspect / Act-move) | **PRODUCT DECISION (§3): A** — a labeled subsection/tab inside col 3 above the Disagreement Points ledger; **OR B** — a compact "N open issues" status control on the ledger header that opens the existing pill/sheet. **Default if undecided: stay bottom chrome, but inside a single grouped `BoardBottomChrome` wrapper (§5).** | sheet (unchanged) | bottom OR col-3 section | bottom OR col-3 section | bottom chrome **(safe-now)** OR → right ledger (deferred) | N (placement only) | N | N | R1 (two ledgers competing for col 3), R6 (A/B reads as ranking) | OpenIssuesRail reachable at all bands; ban-list; A/B render tests if chosen | **safe-now = grouping only; A/B = DEFERRED** |
| **DisagreementPointsRail** | `src/features/mediator/DisagreementPointsRail.tsx`; mounted `ArgumentGameSurface.tsx:2720-2734` (col3) | persistent right ledger (pane tablet/wide; sheet phone); RAIL-003 segment nav lives here | the mediator ledger — what remains unresolved + what would move it forward | **UNCHANGED** — stays the persistent right ledger. (If A is chosen, an Open-Issues subsection mounts ABOVE it — additive, the ledger's own rows/copy/distribution/RAIL-003 nav untouched.) | sheet | pane (380) | pane (380) | **as-is** | N | N | N | R3 (RAIL-003 segment nav must stay intact), R4 (single derivation) | RAIL-003 segment-nav suite green; ban-list; single-derivation ===1 | **safe-now = no change (this is the anchor)** |
| **ArgumentSideActionRail** | `src/features/arguments/ArgumentSideActionRail.tsx:100-...`; mounted `ArgumentGameSurface.tsx:2771-2797` (bottomChrome) | bottom chrome, collapsed "Watch ▾" pill → sheet/side dock | the actor-aware verb dock (Watch · Join · Reply · Disagree · Share) — the one entry point to join / act on a bubble | **stays bottom chrome**, inside the single grouped `BoardBottomChrome` wrapper. Verbs unchanged (`railActionGrouping.test.ts` contract is frozen). Recommendation: NOT folded into col 2 (would double-dock with Act/Inspect/Go — R10). | sheet/dock (unchanged) | dock | dock | **bottom chrome** | N (placement only) | N | N (verbs/availability frozen) | R10 (double-dock with AIG if folded into col2) | rail reachable + verbs unchanged (`railActionGrouping`); collapsed default | **safe-now = grouping only; col-2 fold = DEFERRED (not recommended)** |
| **TimelineNodeActionDock (Act / Inspect / Go)** | `src/features/arguments/TimelineNodeActionDock.tsx`; the live AIG row is `board-menu-trigger-row` + `ActPopout`/`InspectPopout`/`GoPopout` in `ArgumentGameSurface.tsx:~2502-2758`, passed as `col2Footer` | **already in the selected-node column (col 2 footer)** since RAIL-002 | the per-selected-point primary controls (Act / Inspect / Go) | **UNCHANGED — stays in col 2 near the selected point** (§4). | col2-footer (inline, phone stack) | col2-footer | col2-footer | **as-is** | N | N | N | R8 (popout mount-site tests) | AIG reachable at all bands (existing `boardActPopoutMountSite` etc.); 44×44 | **safe-now = no change** |
| **SeatAvailabilityStrip** | `src/features/arguments/SeatAvailabilityStrip.tsx:24-60`; mounted `ArgumentGameSurface.tsx:2763-2765` (bottomChrome, public rooms only) | bottom chrome, read-only seat/observer line | "N of M active seats · 2 open · Readers don't use active seats · You're watching." — quiet seat + viewer status | **stays bottom chrome (quiet), inside `BoardBottomChrome`** — kept visible but demoted as the calm room-status footer (not a floating distraction). NO seat math / copy change. | footer line | footer line | footer line | **bottom chrome** | N | N | N (read-only, counts-only, no seat semantics) | R2 (must stay legible + grayscale) | strip reachable + counts-only (`SeatAvailabilityStrip.test`) | **safe-now = grouping only** |
| **RoomContractSeatStrip** | `src/features/debates/RoomContractSeatStrip.tsx:35-...`; mounted in `DebateDetailHeader.tsx:435` (HEADER, above timeline) | room header chrome (NOT room-board bottom chrome) | the two primary seats + room-type chip + turn label | **UNCHANGED — out of this card's board-bottom scope** (it is header chrome, the one in-room object allowed above the timeline per DebateDetailHeader §). Noted only to disambiguate from `SeatAvailabilityStrip`. | header | header | header | **as-is** | N | N | N | R-confusion (two seat surfaces — clarify, don't merge) | no change; documented as out-of-scope | **safe-now = explicitly NO change** |
| **TimelineSelectedReadoutPanel** | `src/features/arguments/TimelineSelectedReadoutPanel.tsx`; mounted in col2 (`ArgumentGameSurface.tsx:~2320`) | col 2 (selected-node readout, middle column) | "Acting on: counter-rebuttal · #25" + parent hint + expand | **UNCHANGED — stays col 2** (depth 2 content; RAIL-002/UX-SELECTED-NODE-001 own it). | col2 | col2 | col2 | **as-is** | N | N | N | none | existing readout tests green | **safe-now = no change** |
| **ArgumentComposer / ArgumentComposerDock (composer strip)** | `src/features/arguments/ArgumentComposer.tsx` / `ArgumentComposerDock.tsx`; the `CollapsedComposerStrip` is in col2 (`ArgumentGameSurface.tsx:~2381`) | col 2 strip (the dock is App.tsx-level overlay) | the "respond to THIS point" composer | **UNCHANGED — strip stays col 2; the full dock stays App.tsx-level** (R7). | col2 strip | col2 strip | col2 strip | **as-is** | N | N | N | R7 (dock is App.tsx-level — don't relocate) | composer wiring tests green | **safe-now = no change** |
| **DebateDetailHeader (header controls, Timeline/Cards toggle, OPEN/OBS badges)** | `src/features/debates/DebateDetailHeader.tsx` (`Timeline/Cards` toggle L15; `observer:'OBS'` L101; private badge L319) | room header, above the board | room title, visibility, Timeline/Cards toggle, OPEN/OBS badges | **UNCHANGED — header chrome, out of board-bottom scope.** The Timeline/Cards toggle stays the single source of truth (it drives col 1's body mode; O-7 from RAIL-001 already settled "board applies to both modes"). | header | header | header | **as-is** | N | N | N | none | no change | **safe-now = no change** |
| **RoomBoardLayout** | `src/features/arguments/RoomBoardLayout.tsx:64-147` (the `bottomChrome` slot is rendered flat at L93 / L117 / L143) | the pure flex grid that arranges all slots | place the already-built subtrees into 1/2/3 columns | **EXTEND (safe-now): wrap the `bottomChrome` slot in a single grouped container** so the three bottom surfaces read as one calm board-bottom region instead of three loose siblings. Pure presentational; additive `View` + testID; no slot semantics change. | grouped footer | grouped footer | grouped footer | **as-is (extended, additive)** | N | N | N | R5 (must not change topology tests) | extend `uxBoardRail002Topology` additively (count UP); geometry-not-color | **safe-now (grouping wrapper only)** |
| **ArgumentGameSurface** | `src/features/arguments/ArgumentGameSurface.tsx:2203-2799` (the `RoomBoardLayout` call + the `bottomChrome` JSX) | composes everything; derives the board ONCE (`deriveRoomMediatorBoardState` L730) | the room shell | **MINIMAL (safe-now): pass the bottom-chrome surfaces inside the new grouping wrapper** — the JSX subtrees stay textually in-file (R2). NO logic above the `return` changes; the single derivation is untouched. | — | — | — | **as-is (re-parent within bottomChrome only)** | N | N | N | R2 (heavily source-scanned file), R4 (single derivation) | full `npm test` exit-0; single-derivation ===1; source-order preserved | **safe-now (in-file grouping only)** |

---

## §3 Open Issues placement decision (A vs B) — RECOMMENDATION + product decision flag

**This is a PRODUCT DECISION. The designer recommends, the operator decides.** Both options keep Open Issues fully reachable, doctrine-clean, and structural (never a scoreboard). Neither is in the *recommended safe-now subset* (§5) — both move a surface relative to the ledger and need operator sign-off — so both are **DEFERRED** pending the operator's choice.

### Option A — Open Issues as a labeled subsection inside the right mediator ledger (col 3, above the Disagreement Points list)

- **What it is:** col 3 gains a top subsection ("Open issues") above the existing Disagreement Points header. Both are room-wide ledgers of *what remains unresolved*; co-locating them makes col 3 the single "unresolved" home. The Open-Issues rows reuse `OpenIssueRow` verbatim; the Disagreement Points rows/copy/distribution/RAIL-003 segment-nav are untouched below.
- **Pros:** strongest "one board" read — both unresolved-ledgers live in depth 3; removes one bottom pill; conceptually clean (Open Issues and Disagreement Points are the two faces of "unresolved structure").
- **Cons / risk (R1):** two stacked ledgers in a 380px pane is vertically heavy; needs a deliberate stacking + collapse design (each section independently collapsible) so col 3 doesn't become an overwhelming wall. On phone (col 3 is a sheet), two ledgers in one sheet is tight.
- **Doctrine check:** PASS *if* the subsection is labeled by STRUCTURE ("Open issues" — an unresolved-count, never a rank), ordered by the existing `compareLedgerCandidates` (procedural urgency → recency → id; heat/popularity never an input — `openIssuesRailModel.ts:26-27`), and the count is a subordinate "· N" detail, never a "#1 / leaderboard / score". No new copy that implies one ledger outranks the other.

### Option B — Open Issues as a compact board-status control tied to the ledger header

- **What it is:** the col-3 ledger header gains a small "N open issues" status control (a pressable chip) that opens the EXISTING Open Issues pill/sheet (no new ledger render in col 3). The bottom Open-Issues pill is removed; the entry point moves to the ledger header, tying the two unresolved-surfaces together without stacking two full lists.
- **Pros:** lighter than A — col 3 stays a single list; the relationship between the two unresolved-ledgers is signaled (the control lives on the ledger header) without doubling the pane height; smallest blast radius of the two relocations.
- **Cons:** Open Issues is one tap less prominent than a full subsection; the existing sheet/side panel mechanics are reused (so the "scattered decoration" is reduced to a header affordance, not eliminated).
- **Doctrine check:** PASS — the control is a structural status ("N open issues", a count word) tied to a navigation open, never a verdict/score/rank; it adds no magnitude ordering.

### Recommendation

**Recommend B as the default product choice**, with A as the "fuller integration" alternative. Rationale: B achieves the consolidation goal (Open Issues stops being a loose floating pill; it becomes a board-status affordance tied to the ledger) with the **smallest topology + height risk** and the cleanest doctrine surface (a count + a navigation open, no two-ledger stacking). A is the stronger "one board" statement but carries R1 (two ledgers in a 380px pane / a phone sheet) and needs an independent-collapse design.

**If the operator declines both for now:** the recommended safe-now subset (§5) still ships the *grouping wrapper* so the three bottom surfaces read as one calm region — a real consolidation improvement that does not touch the A/B question. A/B can then land as a clean follow-up once the operator picks.

---

## §4 Act / Inspect / Go placement decision (one paragraph)

**Act / Inspect / Go stays in the selected-node column (col 2), near the selected point — UNCHANGED from RAIL-002.** It is already passed as the `col2Footer` slot (`ArgumentGameSurface.tsx` → `RoomBoardLayout` `col2Footer`), where it sits directly beneath the `TimelineSelectedReadoutPanel`, the chip row, and the composer strip — exactly the "respond to THIS point" adjacency depth 2 wants. Moving AIG into the global bottom rail would break that adjacency (the user would act on a point from a control far from the point's readout) and would re-trip the heavily-pinned popout mount-site tests (`boardActPopoutMountSite.test.ts` / `inspectPopoutMountSite` / `goPopoutMountSite`). The key-badge gating (`deriveMenuKeyBadgeContext`, web ≥1024) and the popout chassis are likewise untouched. **No change in this card; this paragraph records the decision so the consolidation does not accidentally pull AIG into the bottom group.**

## §4b Observer / seat status placement decision (one paragraph)

**Observer / seat status (`SeatAvailabilityStrip`) stays visible but quiet, as the calm board-bottom room-status footer — inside the single grouped `BoardBottomChrome` wrapper.** Today it floats between the Open Issues pill and the Side Action dock; the consolidation groups it with them so the seat line reads as deliberate room-status chrome rather than a stray decoration. It stays read-only (counts-only, never identities; "Full"/"observe" are seat facts, never verdicts — `SeatAvailabilityStrip.tsx:8-12`), keeps its `accessibilityRole="summary"`, and its copy/seat-math is unchanged (seat semantics are explicitly out of scope). The header-level `RoomContractSeatStrip` (the two primary seats in `DebateDetailHeader`) is a *different* seat surface and stays in the header — this card does not merge the two (merging unrelated seat concepts to reduce surface count is exactly the anti-pattern the issue warns against).

---

## §5 Safe-now subset (CONSERVATIVE — local UI / layout / copy / test only, default behavior unchanged)

Strict bar: an item is safe-now only if it is trivially additive AND obviously correct AND doctrine-clean AND does not move a surface between columns, into the ledger, or require the A/B decision. The recommended safe-now subset is intentionally SMALL: **one presentational grouping wrapper + its tests.** Everything with topology/semantic risk or the A/B dependency is DEFERRED (§6).

### SN-1 — Group the three bottom-chrome surfaces into a single `BoardBottomChrome` wrapper

- **Exact files:**
  - **New:** `src/features/arguments/BoardBottomChrome.tsx` (~40–70 lines) — a PURE presentational `View` wrapper (RN `View` only, zero hooks/handlers/state/derivation) that receives the three bottom surfaces as `children` (or named slots `openIssues` / `seatStrip` / `sideAction`) and renders them inside one container with a single top geometry border (`borderTopWidth` token) + consistent gutter, `testID="board-bottom-chrome"`. It renders NO text of its own.
  - **Modified:** `src/features/arguments/ArgumentGameSurface.tsx` — wrap the existing `bottomChrome={ <> OpenIssuesRail … SeatAvailabilityStrip … ArgumentSideActionRail … </> }` (L2736-2799) so the three children are passed *through* `BoardBottomChrome` instead of as bare siblings. **Every `<OpenIssuesRail …>` / `<SeatAvailabilityStrip …>` / `<ArgumentSideActionRail …>` JSX subtree stays textually in-file with identical props, testIDs, and `isAnyPanelOpen` OR-terms** — only an enclosing wrapper element is added. No logic above the `return` changes; the single derivation (`deriveRoomMediatorBoardState` L730) is untouched.
- **What changes / what stays:** changes = the three bottom surfaces now sit inside one bordered container so they read as one calm board-bottom region (the consolidation's minimum viable win). Stays = every surface's behavior, collapse default, mutual-exclusion (`isAnyPanelOpen`), reachability, copy, props, testIDs, and the order Open Issues → seat → Side Action.
- **The test that proves it:**
  - **New** `__tests__/uxBoardRail004BottomChrome.test.tsx` — assert: (1) `board-bottom-chrome` renders and contains the three child testIDs (`open-issues-rail`, `seat-availability-strip` when present, `argument-side-action-rail`); (2) the wrapper's top boundary is a real `borderTopWidth` token (geometry, not color-only — accessibility-targets §2); (3) the wrapper renders no text of its own (no banned-copy surface introduced); (4) all three surfaces stay reachable (present) at phone/tablet/wide.
  - **Extend** `__tests__/uxBoardRail002Topology.test.tsx` additively (count UP, no rewrite): assert the `bottomChrome` slot still mounts at all bands and now resolves through `board-bottom-chrome` — the column count (1/2/2/3/3) and col1/col2/col3 placement are unchanged.

### SN-2 (optional, only if it stays trivially additive) — copy clarification on the seat line label, IF a banned/ambiguous token exists

- **Status:** conditional. Only include if SN-1 review surfaces a genuinely ambiguous seat-status string. Current seat copy (`SeatAvailabilityStrip` / `seatClaimModel`) is already doctrine-clean (counts-only, no verdict). **Default: NO copy change** — the seat copy is fine as-is; listing this only to note that *if* a clarification is wanted it must be a frozen ban-list-clean atom with a ban-list test, never a topology change.
- **Recommendation: omit unless review finds a concrete need.**

**That is the entire recommended safe-now subset: SN-1 (one grouping wrapper + tests).** It is a real consolidation improvement, carries no topology/semantic risk, and is independent of the A/B decision.

---

## §6 Deferred items (need the product decision or carry topology/semantic risk)

- **D-A — Open Issues → Option A (subsection inside col 3).** Needs the §3 product decision; carries R1 (two ledgers in a 380px pane / phone sheet) and needs an independent-collapse stacking design. DEFERRED until the operator chooses A.
- **D-B — Open Issues → Option B (status control on the ledger header).** Needs the §3 product decision; moves the Open-Issues entry point into col 3 and removes the bottom pill (a placement change relative to the ledger). DEFERRED until the operator chooses B. (Recommended option, but still a placement decision, so not safe-now.)
- **D-side-fold — Side Action rail folded into col 2.** Carries R10 (double-dock with Act/Inspect/Go in one column). NOT recommended; DEFERRED (and likely declined).
- **D-mutex-rewire — bottom-rail `isAnyPanelOpen` OR-term simplification.** RAIL-002 §11 flagged this as BEHAVIORAL (band-conditional state semantics). It is NOT needed for correctness (the col-3 pane already ignores `isAnyPanelOpen`). DEFERRED; out of this card's "no semantics" scope.
- **D-empty-strip — empty col-3 thin strip (RAIL-001 O-4).** Unrelated enhancement; DEFERRED.
- **D-chimein — chime-in marker activation.** Owned by UX-ROOM-1V1-CHIMEIN-001; the dormant slot stays inert. NOT a board card.

---

## §7 Hard-halt check (confirm the safe-now subset trips NO halt condition)

Walking the recommended safe-now subset (SN-1 only) against each halt condition:

- **Room / seat / chime-in / observer semantics changed?** **NO.** SN-1 wraps existing surfaces; seat math, observer state, chime-in (inert), and seat semantics are untouched.
- **Submit / composer / mediator-derivation / point-standing changed?** **NO.** The composer strip and AIG stay in col 2 unchanged; `deriveRoomMediatorBoardState` is not touched; no point-standing surface is added.
- **Persistence / Supabase / Edge / migration added?** **NO.** Pure RN render-tree grouping; no network, no DB, no Edge.
- **Broad timeline geometry rewrite beyond local chrome grouping?** **NO.** The timeline (col 1) is not touched; only the `bottomChrome` slot gains an enclosing wrapper.
- **Removed access to Open Issues / Disagreement Points / Act / Inspect / Go / observer status?** **NO.** All three bottom surfaces stay reachable inside the wrapper; col 2 AIG and col 3 ledger are unchanged; the test plan asserts reachability at all bands.
- **Scoreboard / ranking / verdict framing introduced?** **NO.** The wrapper renders no text; no count is reordered by magnitude; no verdict/rank/winner copy is added.
- **Single board derivation re-derived / RAIL-003 segment nav broken / RoomBoardLayout topology changed?** **NO.** Single derivation stays one call site; RAIL-003 lives in `DisagreementPointsRail` (untouched); the 1/2/2/3/3 column topology is preserved (additive wrapper inside the `bottomChrome` slot only).

**Result: SN-1 trips NO halt condition.** The A/B options (D-A/D-B) and the side-fold (D-side-fold) DO carry placement/topology risk and are therefore correctly DEFERRED, not in the safe-now subset.

---

## §8 Test plan (covering all required checks)

Run the **FULL `npm test` exit-0 (captured)** — `ArgumentGameSurface.tsx` is source-scanned by ~10 suites, so tailed runs are insufficient (test-discipline gate-timeout rule). Counts go UP.

**For the safe-now subset (SN-1):**

- **Open Issues reachable** — `open-issues-rail` present (collapsed pill) at phone/tablet/wide, inside `board-bottom-chrome`; the existing `OpenIssuesRail.test.tsx` / `openIssuesRailA11y.test.tsx` stay green (no prop/testID change).
- **Disagreement Points reachable** — `disagreement-points-rail` present in col 3 at all bands (sheet phone / pane tablet+wide); unchanged.
- **Act / Inspect / Go reachable** — the three triggers + popouts mount in col 2 footer at all bands (existing `boardActPopoutMountSite` / `inspectPopoutMountSite` / `goPopoutMountSite` green); 44×44 (visual or hitSlop).
- **Observer / seat status visible + correct** — `seat-availability-strip` present (public rooms) inside `board-bottom-chrome`; counts-only, `accessibilityRole="summary"` preserved (`SeatAvailabilityStrip.test.tsx` green).
- **Phone no-overflow** — at 390 the single column stacks the wrapper without horizontal overflow; no 380px pane forced on phone (RAIL-002 invariant preserved).
- **Tablet / desktop columns intact** — `room-board-col-1/-2/-3` present and column count 1/2/2/3/3 at 390/768/1024/1366/1920 (extend `uxBoardRail002Topology` additively).
- **No chip soup** — exactly one `mediator-node-marker-active`; the wrapper adds no new chip; `NodeLabelStrip` not reintroduced.
- **No banned copy** — ban-list scan over all rendered board + bottom-chrome strings: none of `winner|loser|score|verdict|truth|wrong|dishonest|bad[- ]faith|manipulative|leaderboard|ranking|popularity|heat|trending` + no snake_case + `_forbiddenMediatorTokens()` clean (the wrapper renders no text, so this is a regression assertion that grouping introduced none).
- **RAIL-003 segment nav intact** — `uxBoardRail003SegmentNav.test.tsx` green (the rail is not touched).
- **RoomBoardLayout topology tests green** — `uxBoardRail002Topology.test.tsx` green (plus the additive bottom-chrome cases).
- **Selected-node tests green** — `timelineSelectedReadout*` / `uxSelectedNode001CenterOfRoom` green (col 2 unchanged).
- **a11y** — wrapper boundary is geometry (border width token), not color-only; grayscale-legible; reduce-motion unaffected (the wrapper adds no animation); focus order col1→col2→col3→bottom-chrome on web unchanged.
- **Single-derivation invariant** — `deriveRoomMediatorBoardState(` appears exactly once in `ArgumentGameSurface.tsx` (===1).

**Additional tests IF the operator green-lights Option A or B (deferred):**

- **Option A** — assert the Open-Issues subsection mounts in col 3 ABOVE the Disagreement Points header; both sections independently collapsible; ordering by `compareLedgerCandidates` (never magnitude); ban-list over the stacked render; RAIL-003 nav still scoped to the Disagreement Points list only.
- **Option B** — assert the ledger-header status control opens the existing Open Issues sheet; the bottom pill is removed; the control's a11y label is a navigation verb ("Open N open issues"), never a rank; ban-list clean.

---

## §9 Invariants honored

- **Single board derivation (no re-derivation):** `deriveRoomMediatorBoardState` stays one call site (`ArgumentGameSurface.tsx:730`); all columns + the bottom chrome read the one value. SN-1 adds no derivation. Asserted ===1.
- **RAIL-003 segment nav untouched:** the safe-now subset does not touch `DisagreementPointsRail.tsx`; the distribution-segment navigation (`selectedSegment`, `handleSegmentPress`, the "In view" markers, "Show all points") is preserved verbatim. (Options A/B, if chosen, mount Open Issues ABOVE/BESIDE the ledger and explicitly keep RAIL-003 scoped to the Disagreement Points list.)
- **RoomBoardLayout topology preserved:** the 1/2/2/3/3 band-driven column grid is unchanged; SN-1 wraps the `bottomChrome` slot's children only (additive `View`), leaving `room-board-col-1/-2/-3`, the `paneColumn` 380px width, and the `columnDivider` geometry border intact.
- **Doctrine copy clean:** the grouping wrapper renders no text (introduces no copy); seat / Open Issues / Disagreement Points / side-action copy is unchanged; ban-list re-asserted as a regression. No scoreboard/ranking/verdict/heat/popularity surface; Observations stay machine-sourced structural states, Allegations stay user-sourced and separated (§10a — untouched).

---

## §10 Dependencies (cards / docs / files)

- **Deferred-from / spawned-by:** UX-BOARD-RAIL-001 (#706, `docs/designs/UX-BOARD-RAIL-001.md`) §10 — the explicit "UX-BOARD-RAIL-004 (optional) — Open Issues + Side Action column placement" follow-up (resolving O-5/O-6, which 001/002 left as bottom chrome).
- **Consumes (merged on main):** RAIL-002 (`RoomBoardLayout.tsx` + the `bottomChrome` slot + the `presentation` prop); RAIL-003 (`DisagreementPointsRail` segment nav); REF-006-RAIL (`OpenIssuesRail` + `openIssuesRailModel`); SC-005 (`ObserverActionDockLayout` / `resolveObserverDockVariant`); ARG-ROOM-005 (`SeatAvailabilityStrip` / `seatClaimModel`); Stage 6.4 (`ArgumentSideActionRail` / `railActionGrouping` frozen contract); UX-001.4 (`board-menu-trigger-row` / `deriveMenuKeyBadgeContext`).
- **Reads existing (no re-derivation):** the once-derived `mediatorBoard` (`ArgumentGameSurface.tsx:730`); the `bottomChrome` slot composition (L2736-2799); `RoomBoardLayout`'s slot contract; the rail/dock chassis.
- **Blocks (follow-ups):** whichever of Option A / Option B the operator picks becomes the next implement slice on the shipped grouping wrapper.
- **Engine path note** (memory `claude-md-engine-path-stale`): the live engine is `src/domain/constitution/engine.ts`; no board/chrome file imports it — gate-independence is structural.
- **Worktree-agent note** (memory `worktree-agent-write-slips-to-primary`): this design verifies the primary checkout's `docs/designs/` is untouched after the single write (§ self-check in the completion report).

---

## §11 Risks

- **R1 — Two ledgers competing for col 3 (Option A).** Open Issues + Disagreement Points stacked in a 380px pane / phone sheet is vertically heavy. **Mitigation:** A is DEFERRED; if chosen, each section is independently collapsible and the Open-Issues section sits above with its own header; phone keeps the sheet behavior. The safe-now subset avoids this entirely.
- **R2 — `ArgumentGameSurface.tsx` is the most heavily source-scanned room file (~10 suites).** **Mitigation:** SN-1 keeps every bottom-chrome JSX subtree textually in-file with identical props/testIDs/OR-terms; only an enclosing wrapper element is added; run FULL `npm test` (not tailed); preserve source order.
- **R3 — RAIL-003 segment nav regression.** **Mitigation:** SN-1 does not touch `DisagreementPointsRail.tsx`; `uxBoardRail003SegmentNav` is a required green gate.
- **R4 — Single-derivation broken.** **Mitigation:** no logic above the `return` changes; `deriveRoomMediatorBoardState` stays one call site (asserted ===1).
- **R5 — Topology test churn.** **Mitigation:** the wrapper lives INSIDE the `bottomChrome` slot; `RoomBoardLayout`'s column logic is unchanged; extend `uxBoardRail002Topology` additively (count UP).
- **R6 — A/B reads as ranking.** **Mitigation:** the §3 doctrine check requires structural labels (count, never rank), `compareLedgerCandidates` ordering (heat/popularity never an input), and subordinate counts. Ban-list over the chosen render.
- **R7 — Composer dock is App.tsx-level.** **Mitigation:** only the strip is in col 2 (unchanged); the full dock stays App.tsx; SN-1 does not touch it.
- **R8 — Popout mount-site tests.** **Mitigation:** AIG stays in col 2 footer unchanged; the mount-site suites are required green gates.
- **R10 — Double-dock if Side Action folds into col 2.** **Mitigation:** DEFERRED + not recommended; Side Action stays bottom chrome.
- **R-confusion — two seat surfaces.** `SeatAvailabilityStrip` (board bottom) vs `RoomContractSeatStrip` (header). **Mitigation:** documented as distinct; the card does NOT merge them (merging unrelated concepts is the anti-pattern the issue warns against).

---

## §12 Out of scope (explicit non-goals)

- **NO** room / seat / chime-in / observer / permission / submission / composer / mediator-derivation / point-standing change.
- **NO** second board derivation; the single derivation is preserved.
- **NO** `DisagreementPointsRail` row / copy / distribution / RAIL-003 segment-nav change (the ledger is the anchor — it does not move).
- **NO** `OpenIssuesRail` / `ArgumentSideActionRail` / `SeatAvailabilityStrip` behavior, verb-set (`railActionGrouping` frozen), collapse-default, mutual-exclusion, or copy change in the safe-now subset.
- **NO** merge of `SeatAvailabilityStrip` with `RoomContractSeatStrip` (distinct surfaces; header strip stays in the header).
- **NO** Act/Inspect/Go relocation out of col 2.
- **NO** broad timeline geometry change; `timeline-grammar` untouched.
- **NO** scoreboard / leaderboard / ranking / verdict / winner / loser / score / heat / popularity surface.
- **NO** new dependency; NO route/model/table/type rename; NO MCP/provider/classifier/Supabase/migration/Edge change.
- **NO** AI call from the production app; NO service-role.
- **NO** deploy; NO netlify-prod fast-forward / publish.
- **NO** voting / search / OAuth / push / public API / realtime body editing (v1 scope guards).
- **NO** Option A / Option B / side-action col-fold / mutex-rewire in the safe-now subset — those are DEFERRED (§6).

---

## §13 Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the consolidation is a placement/grouping pass; the grouping wrapper renders no text; no verdict/person/truth/score label is added; nothing gates posting; the deterministic engine (never imported here) stays the sole gate. PASS.
- **§2 (heat ≠ truth) / §3 (popularity is not evidence):** no heat/engagement/like/view/follower/trending token enters any surface; Open Issues ordering stays `compareLedgerCandidates` (procedural urgency → recency → id; heat/popularity never an input); the Disagreement Points distribution stays composition, never magnitude. The A/B options (if chosen) inherit this. PASS.
- **§4 (AI moderator limits) / §7 (no AI from the app):** the board + bottom chrome are read-only projections of advisory `authoritative:false` observations; the consolidation runs no AI, mutates no content, asserts no truth. PASS.
- **§5 (engine is sacred):** no chrome/board file touches `src/domain/constitution/engine.ts`. PASS.
- **§9 (plain language):** every label flows through the shipped frozen plain-language atoms (`OPEN_ISSUES_RAIL_COPY`, `DISAGREEMENT_POINTS_RAIL_COPY`, seat view-model copy); the grouping wrapper adds none; ban-list re-asserted as a regression. PASS.
- **§10a (Observations vs Allegations):** col 3 + Open Issues surface machine **Observations** as structural states (the rail renders ZERO `userAllegations` and zero raw codes — `openIssuesRailModel.ts:32`); the consolidation preserves this; the dormant `↳ chime-in` is a contribution marker, never a state. PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing. PASS.
- **accessibility-targets:** the grouping wrapper's boundary is a geometry border (not color-only); all interactive surfaces keep role+label+state+44×44; reduce-motion unaffected (no new animation); grayscale-legible; key-badge gating unchanged. PASS (spec for the implementer).
- **expo-rn-patterns:** RN primitives only (`View`) for the wrapper; no new dependency; reuses `designTokens` (`BORDER_WIDTH` / `SURFACE_TOKENS`); model files (if any) stay pure-TS (no new model is needed for SN-1). PASS.
- **test-discipline:** SN-1 ships one new test file + additive extensions (count UP); full-suite exit-0 gate; phone-no-overflow + single-derivation + ban-list + reachability + topology + RAIL-003 + a11y assertions. PASS (plan).

---

## §14 Operator steps (if any)

**For the design doc: NONE.** For the safe-now subset (SN-1), if green-lit: **NONE — pure UI code change** (no `npx supabase db push`, no `functions deploy`, no env var, no migration, no deploy, no netlify-prod fast-forward). Merges via the normal green-PR path; the single-derivation site picks it up with no operator action. **The one operator decision required is the §3 A/B product choice** (or "defer A/B, ship SN-1 grouping only") — that is a product direction, not a deploy step.

---

## §15 Orchestrator-authored brief ledger (POSTRUN-UX001 lesson)

This card's issue (#730) is orchestrator/roadmap-authored, not operator-authored. Where each design decision came from, and where orchestrator judgment substituted for operator direction:

- **Prior-Phase framing (operator-validated source-of-truth chain):** the board topology + `RoomBoardLayout` `bottomChrome` slot + the `presentation` prop (RAIL-002, merged #714); the Disagreement Points segment nav (RAIL-003, merged #729); the `OpenIssuesRail` / `SeatAvailabilityStrip` / `ArgumentSideActionRail` / AIG chassis (REF-006-RAIL / ARG-ROOM-005 / Stage 6.4 / UX-001.4); the single-derivation invariant — all verified against the live worktree at the RAIL-004 branch base.
- **Epic framing:** the "one mediator board, not scattered decorations" goal, the three reading depths, and the A/B Open-Issues hypothesis — from issue #730 and the CivilDiscourse v4 UX overhaul slate.
- **Pre-launch codebase survey (this card's reading pass):** the exact bottom-chrome mounts (`ArgumentGameSurface.tsx:2736-2799`); the two distinct seat surfaces (`SeatAvailabilityStrip` board-bottom vs `RoomContractSeatStrip` header) — a survey finding that prevents an accidental seat-surface merge; the confirmation that AIG already lives in col 2 (so §4 is a "record, don't change" decision); the `openIssuesRailModel` ordering guarantee (heat never an input) that makes A/B doctrine-clean; the `uxBoardRail002Topology` `bottomChrome` slot assertions that bound the safe-now wrapper.
- **Resolved by orchestrator default (flagged for operator review):**
  1. **Recommend Option B over Option A** (§3) — grounded in the R1 two-ledger height risk and B's smaller blast radius; the operator may prefer A's fuller integration.
  2. **The recommended safe-now subset is SN-1 only (the grouping wrapper)** — a deliberately conservative scope; the orchestrator chose grouping-without-relocation as the obviously-correct, A/B-independent win, holding both relocations as deferred.
  3. **Side Action rail stays bottom chrome (not folded into col 2)** — grounded in R10 (double-dock with AIG); the operator may still want a col-2 fold later.
  4. **The two seat surfaces are NOT merged** — an interpretive call that the issue's "don't merge unrelated concepts" guidance applies to the seat strips.
- **Operator-deferred review:** the §3 A/B product decision (the one decision that gates the relocation slices); whether SN-1's grouping is shipped immediately or held until A/B is chosen; whether the Side Action col-2 fold is ever wanted; whether any seat-line copy clarification (SN-2, currently omitted) is desired. Post-ship revision (if any) should target these specific interpretations.
