# UX-BOARD-RAIL-002 — Persistent mediator board topology implementation

**Status:** Design draft (IMPLEMENTATION design for the safe-now subset of UX-BOARD-RAIL-001)
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/714
**Base:** `d52da21` · branch `feat/UX-BOARD-RAIL-002-board-topology`
**Implements:** the SAFE-NOW subset of the merged design `docs/designs/UX-BOARD-RAIL-001.md` (#706) — §5/§10's "board re-parent" row.
**Lane:** Production UI change (RN/flex only). GATE-C: **No** (no deploy / migration / provider / backend / Supabase / MCP / submit / classifier / engine change). Effort: **L** (the flex-tree re-parent of the most heavily source-scanned room file).

---

## Goal (one paragraph)

The room currently renders as a single `flex:1` vertical column on every viewport (`ArgumentGameSurface.tsx` `styles.container` L2806 / `styles.body` L2813); the three reading depths the v4 board names (argument path, selected node + composer, disagreement-points ledger) are stacked vertically and the ledger is collapsed-by-default bottom chrome. This card turns that single column into a **band-driven 1/2/3-column board** — a **pure re-parent of the existing render tree into column slots, plus one additive `presentation` prop on `DisagreementPointsRail`** — driven by the already-resident `headerBand` (`ArgumentGameSurface.tsx:449`). No hook, handler, derivation, behavior, data path, timeline geometry, or rail internal changes. The board is a **read-only projection of the once-derived `mediatorBoard`** (single-derivation invariant; `deriveRoomMediatorBoardState` at L718–728), consumed by all three columns and never re-derived per column. Doctrine (`cdiscourse-doctrine`): the ledger is **STRUCTURAL, not a scoreboard** — promoting it to a persistent column adds no number that reads as a score, no winner/loser/verdict/truth copy, no popularity/heat ordering; the deterministic Constitution engine (`src/domain/constitution/engine.ts`, never imported here) stays the sole acceptance gate. Phone is **byte-identical to today** (`presentation` defaults to `'sheet'`).

---

## §1 Data model

**No new data model.** No new type that crosses the network or the engine. Two purely-presentational additions:

1. **`DisagreementPointsRail` props gain one optional field** (`src/features/mediator/DisagreementPointsRail.tsx`, `DisagreementPointsRailProps`, after `defaultCollapsed` L114):

   ```ts
   /**
    * UX-BOARD-RAIL-002 — chassis intent.
    * 'sheet' (default) = today's collapsed-pill → bottom-sheet behavior (byte-identical phone).
    * 'pane'  = expanded-by-default docked column child (no bottom-overlay positioning,
    *           ignores isAnyPanelOpen, no entry animation). Used on tablet/wide.
    */
   presentation?: 'sheet' | 'pane';
   ```

   `MediatorBoardState`, `DisagreementPoint`, `PointAnchor` (in `mediatorBoardTypes.ts`) are all **unchanged**.

2. **`RoomBoardLayout.tsx` props** — a new presentational component's prop interface (see §3 API). Pure RN, no model, no React state of its own.

No SQL, no migration, no RLS, no Edge Function, no storage. The mediator board model (`deriveRoomMediatorBoardState`) is consumed verbatim.

---

## §2 File changes

### New files

- **`src/features/arguments/RoomBoardLayout.tsx`** (~110–150 lines) — a pure presentational grid wrapper. Receives the already-built render-tree subtrees as named slot props and arranges them into 1/2/3 flex columns by band. Holds **zero hooks, zero handlers, zero derivation** — all logic stays above the `return` in `ArgumentGameSurface`. RN `View` + flexbox only; no new dependency. (O-3 from #706 — keeps the heavily source-scanned surface file's logic untouched and the grid independently testable.)

### Modified files

- **`src/features/arguments/ArgumentGameSurface.tsx`** (render-tree only; ~60–110 lines of JSX re-parenting, **no logic above the `return`**):
  - Derive `boardPresentation` near the resident `headerBand` (L449–450): `const boardPresentation = headerBand === 'phone' ? 'sheet' : 'pane';` and a column count `const boardColumns = headerBand === 'phone' ? 1 : headerBand === 'tablet' ? 2 : 3;` (or pass `band={headerBand}` straight into the wrapper and let it resolve — preferred; see §3).
  - Replace the opening `<View style={styles.container} …>` (L2181) / closing `</View>` (L2801) with `<RoomBoardLayout band={headerBand} …slots>` while keeping `styles.container` as the wrapper's outer style and **preserving the `accessibilityLabel="argument-game-surface" testID="argument-game-surface"` on the outer View** (drawer/popout-mount and surface presence tests read these).
  - Pass the existing `styles.body` View (L2208 open / L2391 close) **verbatim** as the `col1` slot (both body modes — timeline at L2269–2313 and stack at L2211–2260; O-7).
  - Pass into the `col2` slot, **in this source order**: `TimelineSelectedReadoutPanel` (L2320–2324) → `MediatorProgressNote` selection note (L2331–2334) → `ArgumentScoreTracker` (L2338) → the `mediator-node-chip-row` (L2354–2373) → `CollapsedComposerStrip` (L2381–2388).
  - Pass into the `col2Footer` slot: the `board-menu-trigger-row` (L2502–2593) → `ActPopout` (L2600–2616) → `InspectPopout` (L2622–2636) → `SelectedNodeInspectDrawer` (L2657–2727, carries the inspect `MediatorProgressNote` at L2706) → `GoPopout` (L2735–2758).
  - Pass into the `col3` slot: `<DisagreementPointsRail … presentation={boardPresentation} />` (L2440–2453) — add the one new prop.
  - Pass into the `bottomChrome` slot, **unchanged**: `OpenIssuesRail` (L2421–2431), `SeatAvailabilityStrip` (L2459–2461), `ArgumentSideActionRail` (L2467–2493). `RefereeBannerView` (L2398–2404), `SemanticOverrideChoiceSheet` (L2405–2411), `DeletionRequestSheet` (L2760–2768), `RequestReviewComposer` (L2777–2800), and the `microMoment` banner (L2191–2206) stay where they are (the banner above the body, the composer-side overlays as trailing siblings) — wire them as additional slots or as trailing children of the wrapper so source residence is preserved.
  - Add the column-grid styles in the surface's `StyleSheet` **only if** the wrapper does not own them; preferred is the wrapper owns all grid geometry (see §3 / R2).

- **`src/features/mediator/DisagreementPointsRail.tsx`** (additive; ~12–18 lines across 5 sites, every existing branch untouched):
  - **Props** (L103–121): add `presentation?: 'sheet' | 'pane';` after `defaultCollapsed` (L114).
  - **Signature** (L134–146): destructure `presentation = 'sheet'`.
  - **Collapse init** (L157): `const [collapsed, setCollapsed] = useState(defaultCollapsed ?? (presentation === 'pane' ? false : true));`
  - **Expanded gate** (L200): `const expanded = presentation === 'pane' ? !collapsed : (!collapsed && !isAnyPanelOpen);`
  - **Animation suppression** (L213): `if (effectiveReducedMotion || variant === 'side' || presentation === 'pane') {`
  - **Wrapper branch** (L391–405): add a pane arm **before** the `variant === 'side'` arm:
    ```tsx
    if (presentation === 'pane') {
      return (
        <View style={[styles.expandedRoot, styles.expandedRootPane]} testID={rootTestID}>
          {body}
        </View>
      );
    }
    ```
    Keep the existing `variant === 'side'` (L391–396) and sheet (L398–405) arms **byte-identical** for `presentation === 'sheet'`.
  - **Styles** (after `expandedRootSide` L698–702): add
    ```ts
    expandedRootPane: {
      flex: 1,
      alignSelf: 'stretch',
      borderTopWidth: 0,
      borderLeftWidth: BORDER_WIDTH.sm,
      borderLeftColor: SURFACE_TOKENS.border,
    },
    ```
    (Left geometry border per color-independence — drops the `borderTop`/`alignSelf:'flex-end'` bottom-overlay cues; the parent column owns width, so no fixed `width:380` inside the pane wrapper — the **column** is sized to 380px in `RoomBoardLayout`.) `BORDER_WIDTH` and `SURFACE_TOKENS` are already imported (L39, L42).

### Deleted files

None.

---

## §3 API / interface contracts

### `RoomBoardLayout.tsx` — the new presentational grid

```tsx
import type { ReactNode } from 'react';
import type { Band } from '../../hooks/useHeaderBreakpoint';

export interface RoomBoardLayoutProps {
  /** Column-count authority. phone => 1 col, tablet => 2 col, wide => 3 col. */
  band: Band;
  /** Banner that sits above the board body on all bands (microMoment). */
  topBanner?: ReactNode;
  /** col 1 — the argument path (timeline OR bubble stack body). */
  col1: ReactNode;
  /** col 2 — selected-node readout + selection note + score tracker + chip row + composer strip. */
  col2: ReactNode;
  /** col 2 footer — Act/Inspect/Go trigger row + popouts + inspect drawer. */
  col2Footer: ReactNode;
  /** col 3 — the Disagreement Points ledger (pane on tablet/wide; sheet content on phone). */
  col3: ReactNode;
  /** Bottom chrome — Open Issues + seat strip + side action rail (unchanged placement). */
  bottomChrome?: ReactNode;
  /** Composer-side overlays + referee banner that trail the board (RefereeBannerView, sheets). */
  overlays?: ReactNode;
  /** Forwarded to the outer container so surface-presence tests keep matching. */
  testID?: string;
  accessibilityLabel?: string;
}

export function RoomBoardLayout(props: RoomBoardLayoutProps): React.ReactElement;
```

**Layout contract (the wrapper's only logic — pure flex, no state):**

| `band` | Columns | Arrangement |
|---|---|---|
| `'phone'` (<600) | **1** | `topBanner` → `col1` → `col2` → `col2Footer` → `col3` → `bottomChrome` → `overlays`, all in ONE vertical column (today's stack order). `col3` carries `presentation='sheet'` so it is the collapsed-pill bottom sheet. Byte-identical to today's render. |
| `'tablet'` (600–1279) | **2** | A `flexDirection:'row'` board region: left column (`flex:1.2`) = `col1` + `col2` + `col2Footer`; right column (`width:380`) = `col3` (pane). `topBanner` spans full width above the row; `bottomChrome` + `overlays` span full width below. |
| `'wide'` (≥1280) | **3** | A `flexDirection:'row'` board region: `col1` (`flex:1.2`) · `col2` + `col2Footer` (`flex:1`) · `col3` (`width:380`, pane). `topBanner` above, `bottomChrome` + `overlays` below. |

- **Column widths:** col3 = fixed `380px` (matches the shipped `'side'` chassis width — zero new sizing math); col1 = `flex:1.2`; col2 = `flex:1` (tunable; these are the #706 §3 recommendations).
- **Column boundaries** carry a 1px geometry border (`borderLeftWidth` on col2/col3), never color alone (accessibility-targets §2). The col3 pane's left border comes from `expandedRootPane`; col2's left border is a wrapper style.
- **Reduce motion:** the wrapper performs **no entry animation** on any band — the re-flow across a band boundary is an instant React re-render (no `Animated` layout transition), which satisfies reduce-motion by construction.
- **The wrapper does NOT read `useWindowDimensions` or `resolveBand` itself** — `band` is passed in from the surface's already-resident `headerBand`. No new breakpoint helper; no second band read.

### `DisagreementPointsRail` — the additive `presentation` prop

Contract: **`presentation` defaults to `'sheet'`, and with the default every line below the destructure is unchanged** — this is the byte-identical-phone guarantee. The `'pane'` value:
- renders **expanded-by-default** (collapse init),
- **ignores `isAnyPanelOpen`** (a docked column is not in the bottom shared-space group),
- renders the `'side'` body content inside `expandedRootPane` (no bottom-overlay positioning),
- **suppresses the entry animation** (width-independent — the tablet band straddles the 720 dock boundary, so a 600–719px pane must not animate).

No row, copy, distribution-bar, jump, evidence, definition/scope, or chime-in change — those internals are owned by UX-MEDIATOR-001..005 and consumed verbatim.

### `ArgumentGameSurface` consumption

```tsx
// near L449 (headerBand already resident)
const { band: headerBand } = useHeaderBreakpoint();
const boardPresentation: 'sheet' | 'pane' = headerBand === 'phone' ? 'sheet' : 'pane';

// in the return (L2180), replacing the styles.container View:
return (
  <RoomBoardLayout
    band={headerBand}
    testID="argument-game-surface"
    accessibilityLabel="argument-game-surface"
    topBanner={/* microMoment banner JSX (L2191-2206) */}
    col1={/* <View style={styles.body}> … </View> (L2208-2391) */}
    col2={/* readout → selection note → score tracker → chip row → composer strip */}
    col2Footer={/* board-menu-trigger-row + ActPopout + InspectPopout + SelectedNodeInspectDrawer + GoPopout */}
    col3={
      <DisagreementPointsRail
        board={mediatorBoard}
        viewerRole={resolvedViewerRole}
        activeNodeId={activeMessageId}
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        reduceMotionOverride={reduceMotionOverride}
        isAnyPanelOpen={Boolean(selectedDockTarget) || openIssuesRailExpanded || sideRailExpanded}
        onExpandedChange={setDisagreementPointsRailExpanded}
        onJump={(nodeId) => { setActiveMessageId(nodeId); setSelectionStatus('explicit'); }}
        presentation={boardPresentation}
      />
    }
    bottomChrome={/* OpenIssuesRail + SeatAvailabilityStrip + ArgumentSideActionRail */}
    overlays={/* RefereeBannerView + SemanticOverrideChoiceSheet + DeletionRequestSheet + RequestReviewComposer */}
  />
);
```

**Critical: every `<Component …>` JSX subtree stays TEXTUALLY inside `ArgumentGameSurface`'s `return`, passed into the wrapper as element children.** The wrapper never imports `DisagreementPointsRail`/`ActPopout`/`ArgumentTimelineMap`/etc. This keeps all testID / handler / prop-wire substrings inside `ArgumentGameSurface.tsx` so the ~10 source-scan suites that read only that file stay green (R2). Physically relocating the mounts into the wrapper file would fail them en masse.

---

## §4 Final insertion-mapping table (anchored to CURRENT d52da21 file:line)

Every line ref below was re-verified against the live worktree file at base `d52da21`.

| Surface | Current site (file:line) | Slot | Pass-through change | Notes |
|---|---|---|---|---|
| Outer container | `ArgumentGameSurface.tsx:2181` open / `:2801` close (`styles.container` `:2806`) | wrapper root | `<View>` → `<RoomBoardLayout band={headerBand} …>`; keep `testID`/`accessibilityLabel`; `styles.container` becomes the wrapper outer style | container = `{flex:1, backgroundColor:'#020617'}` |
| microMoment banner | `:2191–2206` | `topBanner` | none | transient banner, spans full width above the board |
| Body (timeline OR stack) | `:2208` open / `:2391` close; timeline `<ArgumentTimelineMap>` `:2269–2313`; stack `<ArgumentBubbleStack>` `:2211–2250` + `<ArgumentBubbleActions>` `:2256–2260` | `col1` | none (verbatim) | both body modes (O-7); col1 is the spine |
| Selected-node readout | `<TimelineSelectedReadoutPanel viewModel={timelineReadoutViewModel} compact …>` `:2320–2324` | `col2` | none | **keep the `viewModel={…} compact` lines contiguous** (pinned regex) |
| Selection progress note | `<MediatorProgressNote note={activeNodeProgressSelectionNote} testID="mediator-progress-note-selection">` `:2331–2334` | `col2` | none | derived from the one board (deriveCalls===1) |
| Score tracker | `<ArgumentScoreTracker trends={participantTrends} />` `:2338` | `col2` | none | **keep the exact one-line JSX** (pinned regex) |
| Node chip row | `mediator-node-chip-row` `:2354–2373` (`MediatorNodeMarker` `:2356`, Inspect caret `:2360`) | `col2` | none | exactly ONE `mediator-node-marker-active` mount (count===1 pinned in 3 suites) |
| Composer strip | `<CollapsedComposerStrip …>` `:2381–2388` | `col2` | none | strip re-parents; full App.tsx dock untouched (R7) |
| Act/Inspect/Go row | `board-menu-trigger-row` `:2502–2593` (`menuTriggerButtonDominant` on Act `:2517`) | `col2Footer` | none | `menuTriggerButtonDominant` count===2 (1 JSX + 1 style) pinned |
| Act popout | `<ActPopout … testID="board-act-popout">` `:2600–2616` | `col2Footer` | none | props/testID preserved → `boardActPopoutMountSite` green |
| Inspect popout | `<InspectPopout … testID="board-inspect-popout">` `:2622–2636` | `col2Footer` | none | props/handlers preserved → `inspectPopoutMountSite` green |
| Inspect drawer | `inspectVisible && activeMessageId ? (<SelectedNodeInspectDrawer …>` `:2657–2727` (inspect `MediatorProgressNote` `:2706`) | `col2Footer` | none | **keep the gate regex `inspectVisible && activeMessageId ? (<SelectedNodeInspectDrawer` contiguous** (pinned in 3 suites) |
| Go popout | `<GoPopout … testID="board-go-popout">` `:2735–2758` | `col2Footer` | none | props/handlers preserved → `goPopoutMountSite` green |
| Disagreement Points ledger | `<DisagreementPointsRail board={mediatorBoard} …>` `:2440–2453` | `col3` | **+ `presentation={boardPresentation}`** | only changed mount in the re-parent |
| Open Issues rail | `<OpenIssuesRail …>` `:2421–2431` | `bottomChrome` | none | stays bottom chrome (O-6 default); `isAnyPanelOpen` OR-term at `:2426` **unchanged** (DEFER) |
| Seat strip | `<SeatAvailabilityStrip …>` `:2459–2461` | `bottomChrome` | none | unchanged |
| Side action rail | `<ArgumentSideActionRail …>` `:2467–2493` | `bottomChrome` | none | stays bottom dock (O-5 default); `isAnyPanelOpen` OR-term at `:2485` **unchanged** (DEFER) |
| Referee banner | `<RefereeBannerView …>` `:2398–2404` | `overlays` | none | conditional mount preserved (ungated by rail) |
| Override sheet | `<SemanticOverrideChoiceSheet …>` `:2405–2411` | `overlays` | none | unchanged |
| Deletion sheet | `<DeletionRequestSheet …>` `:2760–2768` | `overlays` | none | unchanged |
| Request-review composer | `<RequestReviewComposer …>` `:2777–2800` | `overlays` | none | unchanged |
| Single derivation | `deriveRoomMediatorBoardState(…)` `:718–728` | n/a (above `return`) | **NONE — do not touch** | one call site; all 3 columns read this one value |
| Band read | `useHeaderBreakpoint()` → `headerBand` `:449` | n/a | derive `boardPresentation` adjacent | column authority; no new breakpoint helper |

---

## §5 Responsive contract

Verified resolvers (none change): `resolveBand` (`useHeaderBreakpoint.ts:70`) — phone `<600`, tablet `600–1279`, wide `≥1280`, non-positive → `wide`. `resolveObserverDockVariant` (`ObserverActionDockLayout.ts:108`, `DOCK_SIDE_BREAKPOINT=720`) — stays the rail-internal authority for the **phone sheet only**; it is not consulted for column count.

| Viewport | Band | Columns | col3 chassis | Phone-identity? |
|---|---|---|---|---|
| 390×844 | phone | **1** | bottom **sheet** (`presentation='sheet'`, collapsed pill) | **YES — byte-identical to today** |
| 768×1024 | tablet | **2** | persistent **pane** (`presentation='pane'`, 380px right column) | n/a |
| 1024×1366 | tablet (1024<1280) | **2** | persistent pane (380px) | n/a — note the 1024 seam (key badges follow `deriveMenuKeyBadgeContext`, native iPad → no badges) |
| 1366×768 | wide | **3** | persistent pane (380px col 3) | n/a — web ≥1024 → key badges render |
| 1920×1080 | wide | **3** | persistent pane (380px col 3) | n/a |

- **The 1024 seam is deliberate and exercised:** at 1024px width the board is 2 col (tablet band, `<1280`) while key-badge context is `browser_keyboard` only on **web** (`deriveMenuKeyBadgeContext`, `platformOs` + width). The two thresholds (1280 column boundary vs 1024 badge boundary) are independent and both correct; the topology test asserts column count, the existing `uxOneOneSixViewportMatrix` asserts badge context — neither changes the other.
- **Column widths:** col3 `width:380`; col1 `flex:1.2`; col2 `flex:1`. The 380px pane lives only on tablet/wide, where the smallest band edge (600px) comfortably fits 380 + a ≥220px col1 — so the board never forces col1 below a usable width. **Phone stays 1 col precisely to avoid the 380px pane on a 390px floor** (no body horizontal overflow at phone).
- **Re-flow across a band boundary** (resize 599↔600, 1279↔1280): the grid re-renders 1↔2↔3 col; the single `activeMessageId` selection survives (room state, not column state); no animation (instant render) → reduce-motion-safe.

---

## §6 Edge cases (the implementer must handle)

- **Empty board / no points** — col3 (tablet/wide) shows the shipped `disagreement-points-rail-empty` copy inside the **380px pane** (stable geometry — the column does not collapse to zero or jump when the first point appears; O-4 = render the empty pane, thin-strip deferred). Phone shows it on sheet-expand (unchanged).
- **Board unavailable (`board == null`)** — col3 shows `disagreement-points-rail-unavailable`; col1/col2 render normally (timeline + selected node do not depend on the ledger).
- **Root node selected (no parent)** — col2's responding-to anchor omits cleanly (UX-SELECTED-NODE-001 owns it; `onGoToParent` is `undefined` when `activeParentMessageId` is null, L2323); the board adds no new empty-state.
- **Viewport resize across a band boundary** — grid re-flows; `activeMessageId` survives; no animation.
- **Concurrent ledger tap + open Inspect drawer** — tapping a col3 row fires `onJump` → `setActiveMessageId` + `setSelectionStatus('explicit')` (L2449–2452); col2 selected-node detail + col1 timeline update from the SAME `activeMessageId`; both surfaces are inline (never a `Modal`) so no modal conflict (TL-003/SC-003 doctrine).
- **Pane vs phone-sheet mutual-exclusion** — on phone the rail stays a member of the bottom group (`isAnyPanelOpen` honored, unchanged). On tablet/wide the pane **ignores `isAnyPanelOpen`** (it is a column, not bottom space), so even though the OpenIssues/SideAction OR-terms still include `|| disagreementPointsRailExpanded` (DEFER — not rewired in 002), the pane cannot be force-collapsed and the bottom rails behave exactly as today. **This is why the OR-term rewire is safe to defer: correctness does not depend on it** (see §8 + DEFER list).
- **Offline / network failure** — irrelevant to layout (pure projection; no fetch).
- **Permission-denied / observer** — identical read-only board (the ledger is role-invariant; only the Side Action rail's verbs differ, and those are unchanged).
- **Logged-out / Sign In** — `ArgumentGameSurface` is not mounted on the logged-out path; the re-parent is internal to the room shell, so the Sign In screen is unaffected (asserted negatively in the test plan).
- **Reduce-motion** — the pane has no entry animation (L213 suppression + wrapper no-animation); the phone sheet keeps its shipped reduce-motion snap.

---

## §7 Test plan

All test files use the existing repo patterns. Counts go UP; no rewrites except the additive cases noted. Run the **FULL `npm test` exit-0 (captured)** — `ArgumentGameSurface` is source-scanned by ~10 suites, so tailed runs are insufficient (test-discipline gate-timeout rule).

### New: `__tests__/uxBoardRail002Topology.test.tsx`

- **Column count per band** — render `<RoomBoardLayout band={…}>` (and/or the surface with mocked `useWindowDimensions`) at **390 / 768 / 1024 / 1366 / 1920** → assert **1 / 2 / 2 / 3 / 3** columns. Mirror `uxOneOneSixViewportMatrix`'s cell shape.
- **Each depth's column** — at wide (1366/1920) assert col1 hosts the body (timeline/stack), col2 hosts the readout + chip + score + composer strip + Act/Inspect/Go, col3 hosts the ledger pane. At tablet (768/1024) assert col1 hosts body+selected, col3 hosts the ledger pane. At phone (390) assert single-column stack.
- **Phone byte-identity** — at 390 assert the render is the shipped single-column stack with `DisagreementPointsRail` in `presentation='sheet'` (collapsed pill present, no expanded pane root); cross-check against the today-snapshot (no topology change on phone).
- **Single-derivation invariant** — assert `deriveRoomMediatorBoardState(` appears exactly once in `ArgumentGameSurface.tsx` source (deriveCalls===1) even with 3 columns consuming the board.
- **Cross-column selection coordination** — tap a col3 ledger row → assert `setActiveMessageId` fires once and col2/col1 read the SAME `activeMessageId` (no new selection state added; the single `activeMessageId` useState is preserved).
- **One-chip / no chip soup** — assert exactly one `mediator-node-marker-active` mount; assert `NodeLabelStrip` is NOT reintroduced.
- **Act/Inspect/Go reachable + 44×44** — at all 5 viewports assert the three triggers render with `accessibilityRole="button"` + label + `accessibilityState` and meet 44×44 (visual or `hitSlop`).
- **No body horizontal overflow at phone** — assert col1 at 390 does not impose the 380px pane (phone is 1 col; the pane is tablet/wide-only).
- **UX-FEEDBACK note stays quiet** — assert `mediator-progress-note-selection` renders as a non-interactive note (no `accessibilityRole="button"`), unchanged by the re-parent.
- **Logged-out Sign In unaffected** — assert the Sign In path does not mount `RoomBoardLayout` (negative render / source check that the auth screen does not import it).
- **Column geometry not color-only** — assert col2/col3 boundaries carry a border width token (geometry), not color alone (grayscale-legible).

### Extend: `__tests__/DisagreementPointsRail.test.tsx` (additive cases, count UP, no rewrite)

- `presentation='pane'` renders **expanded-by-default** as a column child: the root `disagreement-points-rail` testID is present, the expanded content (title / rows or empty-state) renders without first pressing the toggle, and the collapse toggle pill (`disagreement-points-rail-toggle`) behavior reflects a persistent pane.
- `presentation='pane'` **ignores `isAnyPanelOpen`**: render with `isAnyPanelOpen` true → still expanded (not force-collapsed).
- `presentation='pane'` uses the pane wrapper (no bottom-overlay positioning): assert the pane root does not carry the `expandedRootSide` `alignSelf:'flex-end'`/`width:380` cues (the column owns width).
- `presentation='sheet'` (default) **byte-identity**: an existing-style fixture rendered with the default prop behaves exactly as today (collapsed-by-default pill; mutual-exclusion via `isAnyPanelOpen` honored).
- Re-run (unchanged) the existing empty/unavailable/jump/ban-list/no-magnitude-ordering cases — they pass with the default.

### Doctrine / regression assertions

- **Ban-list scan over ALL board strings** — collect every rendered string across the 3 columns (rail rows, distribution legend, any column headers if added, selected-node copy) and assert none match `_forbiddenMediatorTokens()` + snake_case + `winner|loser|score|verdict|truth|wrong|dishonest|bad[- ]faith|manipulative|heat|popularity|trending`.
- **No-magnitude-ordering** — assert col3 points order by `V4_PRIMARY_STATE_PRIORITY`, never by count/votes (covered by existing rail tests; re-run as regression).
- **Full-suite regression** — re-run `__tests__/{uxMediator00*,DisagreementPointsRail,disagreementPointsRail*,timelineSelectedReadout*,uxOneOneTwoChromeLayerRemovals,boardActPopoutMountSite,inspectPopoutMountSite,goPopoutMountSite,uxSelectedNode001CenterOfRoom,uxNextMove001SuggestMyNextMove,uxFeedback001ProgressNote,uxMediator002NodeMarkup,uxOneOneSixViewportMatrix,uxMobile003ResponsiveShellNavRail,timelineSelectionSharedAcrossModes,argumentGameSurfaceDockComposerWiring,composerDockInRoom,railActionGrouping}.test.*` plus full `npm test` exit-0 (captured), count UP.

---

## §8 Pinned tests needing lockstep updates (the exact expected change)

The mapping brief carried an internal contradiction (the "responsive-and-pinned-tests" area claimed three "no-topology proof" blocks need relaxing; the blocker-hunter + "reparent-content-ownership" areas said they do not). **I resolved it by reading the actual test files.** The blocker-hunter is correct: for an **in-file re-parent** (mounts stay textually in `ArgumentGameSurface.tsx`, child component sources untouched), the three "no-topology proof" blocks **do NOT need relaxing** — their layout bans are scoped to the CHILD component sources, and their surface assertions are presence/count/gate that survive a move.

| Pinned test | Lockstep change | Why |
|---|---|---|
| `__tests__/DisagreementPointsRail.test.tsx` | **ADD pane-variant cases + a sheet-default byte-identity case** (count UP, no rewrite) | The only MANDATORY test change. The new `presentation` prop needs coverage; default `'sheet'` keeps existing cases green. |
| `__tests__/uxBoardRail002Topology.test.tsx` | **NEW file** (see §7) | The board's own topology proof. |
| `__tests__/uxSelectedNode001CenterOfRoom.test.tsx` "NO room/timeline/board topology change" block (L372–397) | **NO CHANGE.** Keep green. | L373–380 are `toContain('<DisagreementPointsRail'…)` PRESENCE proofs (substrings survive a re-parent). L382–390 + L392–396 scope `flexDirection:'row'` bans to `PANEL_SRC` (TimelineSelectedReadoutPanel.tsx — untouched), NOT the surface. L401–407 one-chip count===1 (preserved by moving, not duplicating). **Verified at d52da21.** |
| `__tests__/uxNextMove001SuggestMyNextMove.test.tsx` "no board/rail/timeline topology change" block (L490–518) | **NO CHANGE.** Keep green. | L491–495 presence proofs survive. L497–502 `menuTriggerButtonDominant` count===2 + chip count===1 preserved. L504–510 flex bans scoped to `CARD_SRC` (MediatorNextMovesCard.tsx — untouched). L513–516 drawer-gate regex preserved. **Verified.** |
| `__tests__/uxFeedback001ProgressNote.test.tsx` "no board/rail/timeline topology change" block (L277–298) + "derives both notes…" (L241–247) | **NO CHANGE.** Keep green. | L278–282 presence proofs survive. L284–291 flex bans scoped to `NOTE_SRC` (MediatorProgressNote.tsx — untouched). L293–296 drawer-gate regex preserved. L245–246 `deriveRoomMediatorBoardState(` count===1 (single derivation preserved). **Verified.** |
| `__tests__/uxOneOneTwoChromeLayerRemovals.test.ts` source-order block (L137–168) | **NO CHANGE — but the re-parent MUST preserve source order + contiguous JSX.** | L139–144: `indexOf('<ArgumentScoreTracker') > indexOf('<ArgumentTimelineMap')`. L161–167: `indexOf('<TimelineSelectedReadoutPanel') > indexOf('<ArgumentTimelineMap')`. **Constraint: emit the col1 slot JSX BEFORE the col2 slot JSX in source order.** L147: keep `<ArgumentScoreTracker trends={participantTrends} />` exact. L156–158: keep `<TimelineSelectedReadoutPanel\s+viewModel={timelineReadoutViewModel}\s+compact` contiguous. Also keep removed-chrome tokens (`styles.header`, `modeChip`, `surface-mode-toggle`) absent. |
| `__tests__/boardActPopoutMountSite.test.ts` (+ `inspectPopoutMountSite`, `goPopoutMountSite`) | **NO CHANGE.** | Verified L22–86: pins testID `board-act-popout` + prop/handler wiring + no-router/no-supabase guards, **NO mount path**. Design #706 §6/§12/R8's "update mount path in lockstep" claim is **OVERSTATED** — there is no path to update. Stays green if props/testIDs/handlers + textual residence in `ArgumentGameSurface.tsx` are preserved. |
| `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` | **NO CHANGE.** | `ArgumentGameSurface.tsx` and `DisagreementPointsRail.tsx` are NOT in `READ_ONLY_PATHS`. **CAUTION: do not add any LISTED composer/timeline/popout file to the diff** — they must stay zero-diff. The re-parent + additive prop touch neither. |
| `__tests__/uxOneOneSixReadOnlyBoundary.test.ts` | **NO CHANGE.** | Presence-based: asserts `ArgumentGameSurface.tsx` retains the `ArgumentGameSurface` export and `designTokens.ts` retains its `requiredApi` tokens. The re-parent keeps the export; no token removed. If a column-grid token is added it must be additive (preferred: the grid lives in `RoomBoardLayout`, no `designTokens` change at all). |
| `__tests__/uxOneOneSixViewportMatrix.test.ts` | **NO CHANGE.** | Asserts the surface mounts `<ArgumentScoreTracker>` (moves into col2, still present) and `resolveBand(width)===band` for its 6 cells (resolveBand untouched). This is the canonical matrix the new topology test mirrors. |
| `__tests__/timelineSelectionSharedAcrossModes.test.ts` + `timelineStaleSelection.test.ts` | **NO CHANGE — but preserve the single `activeMessageId` useState.** | Source-scans for one selection state read by both Stack + Timeline. The cross-column coordination (D-4) relies on this same single id — **do NOT add a second selection state per column.** |
| `__tests__/argumentGameSurfaceDockComposerWiring.test.ts` + `composerDockInRoom.test.ts` | **NO CHANGE.** | Only `CollapsedComposerStrip` re-parents into col2; the full App.tsx dock stays App.tsx-level (R7). App.tsx assertions untouched. |
| `__tests__/railActionGrouping.test.ts` | **NO CHANGE.** | Side Action rail stays bottom chrome; no action definition changes. |
| `__tests__/uxMobile003ResponsiveShellNavRail.test.ts` | **NO CHANGE.** | Pins `resolveObserverDockVariant` (sheet<720/side≥720), never-full-screen sheet, no `fontSize:1`. The phone sheet is preserved; no 1px font added. |

**Net: exactly ONE mandatory existing-test edit (additive cases to `DisagreementPointsRail.test.tsx`) + ONE new test file (`uxBoardRail002Topology.test.tsx`).** Everything else stays green by preserving source order, contiguous JSX, testIDs, handlers, the single derivation, the single selection state, and phone byte-identity.

---

## §9 Dependencies (cards / docs / files)

- **Implements:** the safe-now subset of `docs/designs/UX-BOARD-RAIL-001.md` (#706) §5/§10.
- **Consumes (merged on main at d52da21):** UX-MEDIATOR-001..005 (the `mediatorBoard` model + `DisagreementPointsRail`); SC-005 (`ObserverActionDockLayout` / `resolveObserverDockVariant`); REF-006-RAIL (`OpenIssuesRail`); UX-001.1 (`useHeaderBreakpoint` / `resolveBand`); UX-001.4 (`board-menu-trigger-row` + `deriveMenuKeyBadgeContext`); UX-SELECTED-NODE-001 (the col2 selected-node surfaces) + UX-NEXT-MOVE-001 + UX-FEEDBACK-001 (the inspect/selection notes).
- **Reads existing (no re-derivation):** the once-derived `mediatorBoard` (`ArgumentGameSurface.tsx:718–728`); `getNodeMediatorMarker`; the rail's `'side'`/`'sheet'` chassis; `resolveBand` (via the resident `headerBand`); the AIG dock + popouts; the selected-node readout/chip/Inspect overlays.
- **Implement-ordering dependency (R4):** land AFTER UX-SELECTED-NODE-001 is on main so col2 re-parents the FINAL selected-node surfaces. The verified surface at d52da21 already shows the reconciled `onGoToParent` panel (L2323) — strong evidence #687 has landed. **The implementer must re-confirm at branch base before re-parenting col2.**
- **Blocks (follow-ups):** UX-BOARD-RAIL-003 (distribution-segment navigation) and UX-BOARD-RAIL-004 (Open Issues / Side Action column folds) both build on the shipped board; the deferred mutual-exclusion rewire (below) is the natural first follow-up.

---

## §10 Risks

- **R2 — `ArgumentGameSurface.tsx` is the most heavily source-scanned room file (~10 suites).** **Mitigation:** keep the wrapper IN-FILE-equivalent (slots receive already-built children so every testID/handler/mount substring stays textually inside the surface file); preserve source order + contiguous JSX (§8); run FULL `npm test` (not tailed). Re-parent is structural, not behavioral.
- **R3 — Timeline width in a narrower col1.** `ArgumentTimelineMap` is already a horizontal `ScrollView` (`ArgumentTimelineMap.tsx:~1118`). **Mitigation:** verify no fixed-width clip in a flex col1 at 768/1024; col1 keeps `flex:1.2` so it never starves below a usable width (380px col3 + ≥220px col1 fits the 600px band edge).
- **R5/R6 — Pane variant + default-open churn.** **Mitigation:** the `presentation` default `'sheet'` keeps every shipped fixture byte-identical; the pane is a new render branch; the phone byte-identity test pins it. The pane ignores `isAnyPanelOpen`, so deferring the OR-term rewire is correct (the pane cannot be force-collapsed).
- **R7 — Composer dock is App.tsx-level.** **Mitigation:** only `CollapsedComposerStrip` re-parents into col2; the full `ArgumentComposerDock` (App.tsx) stays put. `composerDockInRoom` assertions untouched.
- **R-band — band/dock seam.** The tablet band (600–1279) straddles the 720 dock boundary. **Mitigation:** `resolveBand`/`headerBand` is the sole column authority; `resolveObserverDockVariant` governs only the phone sheet; the pane suppresses animation width-independently (`|| presentation === 'pane'` at L213) so a 600–719px pane never slides.
- **R-source-order — col1/col2 JSX order.** If the wrapper's slot props are emitted col2-before-col1 in source, `uxOneOneTwoChromeLayerRemovals` `indexOf` checks break. **Mitigation:** emit col1 slot JSX before col2 slot JSX (§8).

---

## §11 Out of scope (explicitly DEFERRED — do NOT design or build into 002)

- **Bottom-rail mutual-exclusion re-wiring** — dropping `|| disagreementPointsRailExpanded` from `OpenIssuesRail` (`:2426`) and `ArgumentSideActionRail` (`:2485`) on tablet/wide. The brief flags this as **BEHAVIORAL** (`behaviorTouched=true`, `sideRailTouched=true`): it is a band-conditional **state-semantics** change, which the operator's "no semantics change in a pure re-parent" rule excludes. **It is NOT needed for correctness** — the `presentation='pane'` branch already ignores `isAnyPanelOpen`, so a stale OR-term cannot force-collapse the pane, and the bottom rails behave exactly as today. Defer to a clearly-scoped follow-up sub-slice (band-gated, phone byte-identical, with its own mutual-exclusion regression test). **State this is intentional and safe.**
- **Distribution-segment navigation** → UX-BOARD-RAIL-003 (keep the bar composition-only now).
- **Open Issues fold into col 3 / Side Action fold into col 2** → UX-BOARD-RAIL-004 (O-5/O-6; leave both as bottom chrome — zero change in 002).
- **Chime-in marker activation** → UX-ROOM-1V1-CHIMEIN-001 (carry the dormant `↳ chime-in` slot UNCHANGED — never synthesize a marker without `contributionKind`).
- **Empty col3 thin-strip (O-4)** → render the shipped 380px empty-state pane (stable geometry); thin-strip is a deferred enhancement.
- **NO** new dependency; NO timeline geometry change; NO rail row/copy/distribution/jump/evidence/definition-scope change; NO selected-node CONTENT change; NO new breakpoint helper; NO second board derivation; NO new selection state per column; NO scoreboard/leaderboard/verdict/heat/popularity surface; NO AI call; NO service-role; NO deploy / netlify-prod fast-forward; NO v1-scope-guard violation (voting/search/OAuth/push/public-API/realtime-body-edit).

---

## §12 Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the board is a layout of structural states + structural moves; promoting the ledger to a persistent pane adds no number that reads as a score and no verdict/person/truth label. The surface imports nothing from `src/domain/constitution/engine.ts` (only `import type { ArgumentType }`, verified) and gates nothing — the deterministic engine stays the sole submission gate. PASS.
- **§2 (heat ≠ truth) / §3 (popularity is not evidence):** no heat/engagement/like/view/follower/trending token enters any column; col3 ordering stays `V4_PRIMARY_STATE_PRIORITY` (structure), never count/vote/heat; the distribution bar is composition, untouched. PASS.
- **§4 (AI moderator limits) / §7 (no AI from the app):** the board is a read-only projection of advisory, `authoritative:false` observations; the re-parent runs no AI, mutates no content, asserts no truth. PASS.
- **§5 (engine is sacred):** no board file touches the engine; gate-independence is structural. PASS.
- **§9 (plain language):** every label flows through the shipped plain-language maps; the ban-list test re-asserts no raw code / snake_case reaches any column. PASS.
- **§10a (Observations vs Allegations):** col3 surfaces machine **Observations** as structural states (never a user **Allegation** as a state); col2's Inspect drawer keeps the Observation/Allegation separation (`NodeLabelInspectGroups`, re-parented verbatim); sensitive composer-only Observations reach neither column for the target node; the dormant `↳ chime-in` is a contribution marker, never a state. PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing. PASS.
- **Single-derivation invariant** (memory `mediator-board-single-derivation`): `deriveRoomMediatorBoardState` stays one call site (L718–728); all 3 columns consume the one value; `deriveCalls===1` is asserted. PASS.
- **accessibility-targets:** Act/Inspect/Go keep role+label+state+44×44 across all 5 viewports; column boundaries carry a border (geometry), not color alone; the re-flow is animation-free (reduce-motion-safe); key-badge gating via `deriveMenuKeyBadgeContext` unchanged; tab/focus order col1→col2→col3 on web; grayscale-legible. PASS (spec).
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`/`ScrollView`) + flexbox columns (no CSS grid, no new dep); reuses `designTokens` + the shipped rail chassis + the resident `headerBand`; the only new prop is `presentation: 'sheet' | 'pane'`. PASS.
- **timeline-grammar:** NOT load-bearing — the timeline's lanes/dots/branches/strength bands are untouched (`ArgumentTimelineMap` re-parents verbatim into col1; no geometry change). PASS (no-op).
- **test-discipline:** one mandatory additive existing-test edit + one new topology test; phone byte-identity + single-derivation + ban-list + viewport-matrix + a11y assertions; full-suite exit-0 gate; count UP. PASS (plan).

---

## §13 Operator steps (§17)

**NONE — pure UI code change.** No `npx supabase db push`, no `functions deploy`, no env var, no migration, no deploy, no netlify-prod fast-forward, no provider/backend/MCP/classifier/submit change. The change merges via the normal green-PR path; the single-derivation site picks it up with no operator action.

---

## §14 Boundary attestation

This card (UX-BOARD-RAIL-002) performs **NO Anthropic / xAI / X API call by Claude, NO Supabase write, NO service-role usage, NO migration, NO Edge Function change, NO deploy, NO netlify-prod fast-forward, NO new dependency, NO engine import, NO submission-gate change.** It is a pure React Native render-tree re-parent (placement) plus one additive presentational prop (`presentation: 'sheet' | 'pane'` on `DisagreementPointsRail`, default `'sheet'` = byte-identical phone). The deferred mutual-exclusion rewire — the only behavioral slice surfaced by the reality audit — is explicitly excluded from this card and routed to a follow-up.

---

## §15 Brief interpretive notes (orchestrator-authored brief ledger)

The card brief and the `mapping-brief.md` are orchestrator/fan-out-authored, not operator-authored. Where each design decision came from and where orchestrator judgment substituted for operator direction:

- **Prior-Phase framing (operator-validated chain):** the single-derivation invariant, the shipped rail chassis, `resolveBand`/`resolveObserverDockVariant`, the AIG dock, the selected-node surfaces — all from the merged UX-MEDIATOR/SC-005/REF-006-RAIL/UX-001.x designs and the verified code at d52da21.
- **#706 design:** the topology decision (RIGHT rail, 1/2/3-col band authority, col widths, O-1..O-7 resolutions, the `presentation` prop) — adopted verbatim.
- **Pre-launch reality audit (`mapping-brief.md`, verified against d52da21 by this designer):** the exact insertion line refs, the IN-FILE-equivalent wrapper constraint, and the pinned-test lockstep reality.
- **Resolved by this designer (flagged for operator review):**
  1. **The brief's internal contradiction on the three "no-topology proof" blocks.** The "responsive-and-pinned-tests" area said they need relaxing; the blocker-hunter + "reparent-content-ownership" areas said they do not. **I read the three test files (uxSelectedNode001 L372–397, uxNextMove001 L490–518, uxFeedback001 L277–298) and confirmed the blocker-hunter is correct for an in-file re-parent: their layout bans are scoped to PANEL_SRC/CARD_SRC/NOTE_SRC (child sources, untouched), and their surface assertions are presence/count/gate that survive a move. They need NO lockstep relax.** This is the one place I overrode a brief sub-section; the implementer should re-confirm but should NOT pre-emptively relax those blocks.
  2. **Adopted the brief's correction that `boardActPopoutMountSite.test.ts` needs no edit** (verified L22–86: testID+props, no path) — over #706 §6/§12/R8's "update mount path in lockstep" claim, which is overstated.
  3. **col3 width owned by the COLUMN, not the rail** — `expandedRootPane` drops the `width:380` and the `RoomBoardLayout` col3 sizes to 380px. This keeps the rail width-agnostic and the geometry in one place.
- **Operator-deferred review:** the col-width flex ratios (1.2 / 1 — tunable); whether the empty col3 stays a 380px pane vs a thin strip (O-4); the timing of the deferred mutual-exclusion rewire follow-up; the R4 re-confirmation that UX-SELECTED-NODE-001 is on the branch base.
