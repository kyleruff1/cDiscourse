# ASP-EXTRACT-001 — Split ArgumentGameSurface by extraction (room/ dir)

**Status:** Design draft
**Epic:** Argument Surface Pivot — Phase 0 (structural, no capability)
**Release:** Pivot foundation (precedes Ringside Exchange lens, one-bar composer, ambient StateRail, proof drawer, voice)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/864

---

## Goal (one paragraph)

`src/features/arguments/ArgumentGameSurface.tsx` is a 3,279-line monolith that
mounts the entire argument room: mode switch (stack <-> timeline), active-message
selection, ~30 memoized derivations (surface state, mediator board, evidence
debts, lifecycle map, card-hub detail, open-issues ledger, menu presentation),
~40 handlers, a `RoomBoardLayout` slot skeleton (topBanner / col1 / col2 /
col2Footer / col3 / bottomChrome / overlays), and every sibling overlay. Every
future room card is taxed by this file. ASP-EXTRACT-001 relocates code into a
new `src/features/arguments/room/` directory with ZERO behavior change, ZERO
visual diff, and ZERO new capability. It carves the two lens branches out of the
`col1` slot into `ExchangeView.tsx` (stack) and `MapView.tsx` (timeline map),
introduces a shared `roomActionCodes.ts` action-code vocabulary (an alias layer
over the already-shipped `RailActionCode` + `ArgumentBubbleControl` unions), and
leaves `ArgumentGameSurface.tsx` as a thin re-export shim so all 68 existing
importers stay valid. The controlling doctrine here is not product doctrine
(`cdiscourse-doctrine` §1-§10 are untouched because no user-facing string or
score path changes) but the repo's byte-preservation + source-scan-suite
discipline: the current file was deliberately built so that "every `<Component>`
JSX subtree stays TEXTUALLY inside this `return`" (its own comment, lines
2327-2337) to satisfy the source-scan test suites. Extraction MOVES those
substrings out of `ArgumentGameSurface.tsx`, so the dominant work of this card
is updating each source-scan suite to follow the code to its new home — not the
relocation itself.

---

## Cannot-proceed check

No doctrine conflict. No v1-scope violation (no voting/search/push/OAuth/public
API). No AI call added. No Supabase write added. No new dependency. The card is a
pure internal refactor. Proceeding.

---

## Data model

**No new data model.** No TypeScript domain type is added, no SQL schema, no RLS
policy, no migration, no Edge Function. Every type consumed by the extracted
files already exists (`ArgumentSurfaceMode`, `ArgumentBubbleControl`,
`ArgumentBubbleViewModel`, `ArgumentTimelineMapModel`, `RailActionCode`,
`RailViewerRole`, `MediatorBoardState`, `TimelineNodeActionDockTarget`, etc.).

The ONE new exported artifact is a **vocabulary alias module** (`roomActionCodes.ts`)
that re-exports and unions the two action-code sources that already exist — it
introduces no NEW code strings, it names the existing set (see "API / interface
contracts" below).

---

## The controlling architectural reality (read before the file assignments)

The current `return` (lines 2326-3134) is ONE `<RoomBoardLayout>` element with
named element-slot props:

```
<RoomBoardLayout band=… testID="argument-game-surface"
  topBanner={ …microMoment… }
  col1={ <View style={styles.body}> {mode === 'stack' ? <StackBranch/> : <TimelineBranch/>} </View> }
  col2={ mode === 'timeline' ? <SupportingPanels/> : null }
  col2Footer={ <MenuTriggerRow/> + <AnalysisTriggerRow/> + <ActPopout/> + <InspectPopout/> + <SelectedNodeInspectDrawer/> + <GoPopout/> }
  col3={ activeAnalysisSurface === 'disagreement' ? <DisagreementPointsRail/> : null }
  bottomChrome={ <BoardBottomChrome> <OpenIssuesRail/> <SeatAvailabilityStrip/> <ArgumentSideActionRail/> </BoardBottomChrome> }
  overlays={ <RefereeBannerView/> <SemanticOverrideChoiceSheet/> <DeletionRequestSheet/> <RequestReviewComposer/> }
/>
```

The two lens branches (`mode === 'stack'` at 2376-2432, `mode === 'timeline'` at
2434-2520) live INSIDE the `col1` slot. Everything else in the return
(col2/col2Footer/col3/bottomChrome/overlays) is shared chrome that renders around
BOTH modes and reads orchestrator state directly.

**Consequence:** a faithful, zero-diff extraction CANNOT lift "the timeline
branch" into `MapView.tsx` while also dragging col2/col3/chrome/overlays with it
(those are shared). The safe carve is:

- **`ArgumentRoom.tsx`** keeps ALL state, ALL ~30 derivations, ALL ~40 handlers,
  the `RoomBoardLayout` skeleton, and every SHARED slot (topBanner, col2,
  col2Footer, col3, bottomChrome, overlays). This is the thin orchestrator the
  card asks for. "Thin" here means "no lens-body JSX", not "few lines" — the
  derivations and handlers are the room's brain and must stay in one place to
  preserve the single-derivation invariants and the handler-sharing.
- **`ExchangeView.tsx`** receives the props the stack branch reads and renders
  exactly the `mode === 'stack'` sub-tree (ArgumentBubbleStack + the conditional
  ArgumentBubbleActions).
- **`MapView.tsx`** receives the props the timeline branch reads and renders
  exactly the `mode === 'timeline'` sub-tree (ArgumentTimelineMap + the
  QUOTE-FORGE create-link affordance).
- The orchestrator's `col1` slot becomes
  `{mode === 'stack' ? <ExchangeView {...exchangeProps}/> : <MapView {...mapProps}/>}`.

This is the least-churn carve that (a) keeps every derivation single-sourced,
(b) keeps every handler defined once and shared, and (c) confines the moved
source-scan substrings to a small, enumerable set of files.

---

## File changes

### New files (all under `src/features/arguments/room/`)

- **`src/features/arguments/room/ArgumentRoom.tsx`** — the orchestrator.
  ~2,950 lines. Contains: the `Props` interface (moved verbatim, lines 284-460),
  the component signature + destructure (462-498), EVERY derivation and handler
  (503-2320), the `RoomBoardLayout` return skeleton with all shared slots, and
  the `col1` slot dispatching to `<ExchangeView/>` / `<MapView/>`. Exports
  `export function ArgumentRoom(props: Props)`. The `styles` StyleSheet
  (3137-3279) stays here EXCEPT the handful of keys ExchangeView/MapView need
  (see StyleSheet note). testID on the root stays `"argument-game-surface"`
  (unchanged — this is the integration-test anchor).

- **`src/features/arguments/room/ExchangeView.tsx`** — the stack/feed lens.
  ~120 lines. Renders the `mode === 'stack'` fragment: `<ArgumentBubbleStack .../>`
  (all 20 current props) + the conditional `<ArgumentBubbleActions .../>`. Owns
  NO state, NO derivation, NO handler — every value arrives as a prop. This is
  the future Ringside Exchange target; today a faithful extraction.

- **`src/features/arguments/room/MapView.tsx`** — the timeline-map lens.
  ~90 lines. Renders the `mode === 'timeline'` fragment: `<ArgumentTimelineMap .../>`
  (all 28 current props, including the QUOTE-FORGE-001 linkedPriorChips +
  onOpenLinkedPrior + onViewLinkedPriorContext threading) + the QUOTE-FORGE-001
  `onOpenLinkPicker` create-link affordance (lines 2506-2520). Thin pass-through;
  owns NO state/derivation/handler.

- **`src/features/arguments/room/roomActionCodes.ts`** — the shared action-code
  registry (~60 lines, pure TS, no React). See "API / interface contracts".

- **`src/features/arguments/room/exchangeViewProps.ts`** (OPTIONAL, recommended)
  — a type-only module exporting `ExchangeViewProps` and `MapViewProps`
  interfaces so the orchestrator and the views share one prop contract without a
  circular import. ~50 lines. (If the implementer prefers, these interfaces can
  live inline in each view file; the separate module keeps the orchestrator
  import list flat.)

### Modified files

- **`src/features/arguments/ArgumentGameSurface.tsx`** — becomes a thin
  re-export shim. From 3,279 lines to ~30 lines:

  ```ts
  // ASP-EXTRACT-001 — this file is now a re-export shim. The room surface
  // was split into src/features/arguments/room/ (ArgumentRoom orchestrator +
  // ExchangeView + MapView + roomActionCodes) with zero behavior change.
  // The shim preserves every existing import path and every render-test that
  // imports ArgumentGameSurface by name. All source-scan suites that read
  // THIS file were repointed to the room/ files they now live in.
  export { ArgumentRoom as ArgumentGameSurface } from './room/ArgumentRoom';
  export type { Props as ArgumentGameSurfaceProps } from './room/ArgumentRoom';
  ```

  Note: all comments in the shim (and every room/ file) MUST be apostrophe-free
  with balanced quotes/backticks — see Landmine 1.

- **`__tests__/uxOneOneTwoDoctrine.test.ts`** — extend `UX_001_2_FILES`
  (lines 29-36) to add the three room/ view files (see Landmine 1).

- **`__tests__/uxOneOneSixReadOnlyBoundary.test.ts`** — the `ArgumentGameSurface.tsx`
  entry (lines 88-91) stays (its `requiredApi: ['ArgumentGameSurface']` still
  passes because the shim contains that token); ADD a NOTE + three new
  `READ_ONLY_FILES` entries pinning the room/ files' public API (see Landmine 2).

- **Source-scan behavior suites** — repoint each `readFileSync` path (and, where a
  suite asserts cross-file tokens, split the reads). See "Test plan" + the
  per-file `testImpact` table.

- **`docs/core/current-status.md`** — append the ASP-EXTRACT-001 Phase-framing
  section with the extraction map + the new file layout + the confirmed test
  count (implementer updates AFTER the count is captured).

### Deleted files

None. (The monolith is not deleted — it is reduced to a shim so imports/tests
survive.)

---

## API / interface contracts

### `roomActionCodes.ts` — the shared registry

The card asks for "a single exported vocabulary of the room action codes ...
derive this from the ACTUAL action set the current ArgumentSideActionRail +
surface use — do not invent codes." Two real vocabularies already exist and must
NOT be duplicated:

1. **`RailActionCode`** (in `railActionCategories.ts`, re-exported by
   `ArgumentSideActionRail.tsx`) — the RAIL dispatch codes:
   `watch | join_aff | join_neg | ask_source | open_timeline | share | reply |
   disagree | ask_quote | split_branch | flag | qualifiers | request_deletion`.
2. **`ArgumentBubbleControl`** (in `argumentGameSurfaceModel.ts` lines 52-60) —
   the SURFACE dispatch enum the game surface routes through:
   `reply | disagree | flag | ask_for_source | ask_for_quote | branch |
   view_qualifiers | request_deletion`.

Plus the timeline-node action dock (`TimelineNodeActionDockActionCode`) and the
Act popout (`ActEntryId`), and the QUOTE-FORGE linked-prior handlers
(`open_linked_prior`, `view_linked_prior_context`, `open_link_picker`) which are
callback names, not enum codes.

**Design decision: `roomActionCodes.ts` is a NON-DUPLICATING ALIAS + BRIDGE
module.** It re-exports the two existing unions under a single room-scoped name
and re-exports the existing bridge fn `railActionToBubbleControl`. It adds NO new
string literals to the type system (so it cannot drift from the shipped
vocabularies, and it cannot break `railActionGrouping.test.ts` /
`duplicateRailRemovalDisposition.test.ts` which pin the rail set verbatim).

```ts
// src/features/arguments/room/roomActionCodes.ts
// ASP-EXTRACT-001 — one shared vocabulary handle for room action dispatch.
// This module DOES NOT define new codes. It aliases the two shipped unions
// (RailActionCode + ArgumentBubbleControl) and re-exports the shipped bridge
// so Exchange and Map dispatch through ONE import surface. The A x B
// capability-parity foundation: a later card can add a code in ONE place.
import type { RailActionCode } from '../railActionCategories';
import type { ArgumentBubbleControl } from '../argumentGameSurfaceModel';
import { railActionToBubbleControl } from '../ArgumentSideActionRail';

// The rail-level codes (observer/participant tap surface).
export type RoomRailActionCode = RailActionCode;
// The surface-level dispatch enum (what onAction receives).
export type RoomBubbleControlCode = ArgumentBubbleControl;

// The union both lenses may emit (rail codes + bubble controls). No new
// members — purely the set-union of the two shipped unions.
export type RoomActionCode = RoomRailActionCode | RoomBubbleControlCode;

// Re-export the shipped bridge unchanged (rail code -> bubble control | null).
export { railActionToBubbleControl } from '../ArgumentSideActionRail';

// A frozen enumeration of the rail codes for any consumer that needs to
// iterate (derived from the shipped RAIL_ACTION_CATEGORIES-backed set — NOT a
// hand-typed second list). Optional; include only if a consumer needs it.
export const ROOM_RAIL_ACTION_CODES = [
  'watch', 'join_aff', 'join_neg', 'ask_source', 'open_timeline', 'share',
  'reply', 'disagree', 'ask_quote', 'split_branch', 'flag', 'qualifiers',
  'request_deletion',
] as const satisfies readonly RailActionCode[];
```

> Design note for the implementer: the `satisfies readonly RailActionCode[]`
> clause is load-bearing — it makes the compiler FAIL if `ROOM_RAIL_ACTION_CODES`
> ever drifts from the shipped `RailActionCode` union, which is how we honor
> "do not invent codes." If you prefer zero risk of duplication, omit
> `ROOM_RAIL_ACTION_CODES` entirely and export only the types + the bridge; no
> current consumer iterates the code list.

**How Exchange and Map consume it without behavior change today:** they don't
dispatch through it directly in the extraction — they dispatch through the SAME
handler props the orchestrator passes down (`onRailAction`, `onAction`,
`onActionDockAction`). `roomActionCodes.ts` is the TYPE surface those prop
signatures reference, so both views import their handler prop types from one
place. This is the "one shared source" the card wants: today it unifies the
type/import surface (zero behavior change); a future capability-parity card adds
a code once and both lenses see it.

### `ExchangeView` props (the stack branch, from the map lines 2378-2432)

```ts
export interface ExchangeViewProps {
  viewModels: ArgumentBubbleViewModel[];
  activeMessageId: string | null;
  windowWidth: number;
  viewerRole: RailViewerRole;                 // resolvedViewerRole
  activeCardDetail: CardDetailViewModel | null;
  activeMappingSection: CardMappingSection | null;
  activeRefereeCard: DisagreementContract | null; // refereeCardIssue
  activePointFeedbackFlags: PrioritizedPointFeedbackFlags; // the {visible, suppressedCount,...}
  // handlers (all defined in ArgumentRoom, passed down):
  onActivate: (id: string) => void;           // handleActivate
  onPrevious: () => void;                      // handlePrev
  onNext: () => void;                          // handleNext
  onToggleMode: () => void;                    // handleToggleMode
  onActivateAncestor: (id: string) => void;    // handleActivate
  onRailAction: (code: RoomRailActionCode, ctx: {...}) => void; // handleRailAction
  onRefereeMove: (...) => void;                // handleRefereeMove
  onRefereeNavigate: (verb: RefereeNavVerb) => void; // handleRefereeNavigate
  // the conditional ArgumentBubbleActions:
  activeViewModel: ArgumentBubbleViewModel | null;
  onBubbleAction: (control: ArgumentBubbleControl, messageId: string) => void; // handleBubbleAction
}
```

The exact prop names/values must be copied verbatim from lines 2378-2432 so the
render output is byte-identical. The implementer copies the JSX unchanged; the
only edit is that prop VALUES that were local identifiers become
`props.<name>`.

### `MapView` props (the timeline branch, from the map lines 2441-2520)

```ts
export interface MapViewProps {
  map: ArgumentTimelineMapModel;               // timelineMap
  activeViewModel: ArgumentBubbleViewModel | null;
  totalCount: number;                          // timelineMap.nodes.length
  artifactsByMessageId: Record<string, ReadonlyArray<EvidenceArtifact>>;
  selectedTarget: TimelineNodeActionDockTarget | null; // selectedDockTarget
  actionDockModel: TimelineNodeActionDockModel | null; // dockModel
  actingOnLabel: string | null;                // timelineReadoutViewModel.actingOnShortLabel
  isReadModeViewer: boolean;                   // resolvedViewerRole === 'observer'
  reduceMotionOverride?: boolean;
  density?: TimelineDensityMode;               // if the affordance/label needs it
  // lookups (defined in ArgumentRoom):
  evidenceContractFor: (id: string) => TimelineEvidenceContract | null;
  evidenceDebtSummaryFor: (id: string) => NodeEvidenceDebtSummary | null;
  // handlers (defined in ArgumentRoom):
  onActivate: (id: string) => void;            // handleActivate
  onPrev: () => void;                          // handlePrev
  onNext: () => void;                          // handleNext
  onJumpLatest: () => void;                    // inline arrow (2448) -> lift to a named handler in ArgumentRoom
  onJumpToRoot: () => void;                    // inline arrow (2457) -> lift to a named handler
  onToggleMode: () => void;                    // handleToggleMode
  onAction: (control: ArgumentBubbleControl, id: string) => void; // handleBubbleAction
  onOpenDetails: (id: string) => void;         // inline arrow (2469) -> lift to a named handler
  onSelectTarget: (t: TimelineNodeActionDockTarget | null) => void; // setSelectedDockTarget
  onActionDockAction: (action: TimelineNodeActionDockActionCode, target: TimelineNodeActionDockTarget) => void; // handleActionDockAction
  onOpenCardsDetail: (t: TimelineNodeActionDockTarget) => void; // handleOpenCardsDetail
  // QUOTE-FORGE-001 linked-prior threading:
  linkedPriorChips?: ReadonlyArray<LinkedPriorArgumentChip>;
  onOpenLinkedPrior?: (linkId: string) => void;
  onViewLinkedPriorContext?: (linkId: string) => void;
  onOpenLinkPicker?: () => void;               // drives the create-link affordance (2506-2520)
}
```

> IMPORTANT refactor note: the timeline mount currently uses THREE inline arrow
> callbacks for `onJumpLatest` (2448), `onJumpToRoot` (2457), and `onOpenDetails`
> (2469). Each closes over `setActiveMessageId` + `setSelectionStatus` +
> `dismissMicroMoment` (and `setMode('stack')` for onOpenDetails). To pass them
> as props without changing behavior, LIFT each inline arrow into a named
> `useCallback` in `ArgumentRoom` (`handleJumpLatest`, `handleJumpToRoot`,
> `handleOpenDetailsFromTimeline`) with the SAME body, then pass the named
> handler. This is a mechanical lift; the resulting behavior is identical.
> NB: two of the 20 `setActiveMessageId` sites (2448, 2457, 2469) are these
> inline arrows — lifting them keeps all 20 setters accounted for in the
> orchestrator.

---

## Edge cases

- **Empty message list (fresh room):** the integration test renders with
  `messages={[]}` and asserts `getByTestId('argument-game-surface')`. The
  orchestrator's empty-state path (viewModels=[], timelineMap has 0 nodes) is
  unchanged; ExchangeView/MapView render their empty sub-trees exactly as today.
  No new guard needed.
- **Observer (read-mode) viewer:** `resolvedViewerRole === 'observer'` gates
  `ArgumentBubbleActions` (only mounts for participants) and sets
  `isReadModeViewer` on MapView. Both flow through as props; the extraction must
  copy the exact conditional (`activeViewModel && resolvedViewerRole ===
  'participant'`) into ExchangeView verbatim.
- **Active message vanishes (admin removal):** the snap-to-latest effect (628-641)
  stays in the orchestrator (it owns `activeMessageId` state). Unchanged.
- **Mode toggled mid-session:** `handleToggleMode` stays in the orchestrator; the
  `col1` ternary re-mounts ExchangeView<->MapView. Because `mode` is orchestrator
  state, the switch behavior is identical.
- **Deep-link entry hint (QOL-040.3):** `deriveInitialActiveMessageId` +
  the `__DEV__` warn stay in the orchestrator (they own `initialActiveId`).
  Unchanged.
- **Concurrent edits / offline / network failure:** N/A — this card adds no fetch,
  no write, no async path. The two metadata write handlers
  (`handleApplyManualTag`, `handleRemoveManualTag`) stay in the orchestrator
  unchanged.
- **Permission-denied paths:** N/A — no new RLS, no new Edge call. The existing
  `request-argument-deletion` / `submit-argument` paths are reached via unchanged
  handlers.
- **Doctrine-constraint edge cases:** none introduced. No score path, no
  truth-label surface, no heat->strength coupling is touched. The band-neutral
  timeline (VISUAL-SIMPLIFY-003) default stays because `MapView` passes `map`
  (already built with `neutralizeStandingBands` default) straight through — MapView
  does not touch band rendering.
- **The `col2` supporting panels are timeline-only:** `col2` is
  `mode === 'timeline' ? <panels/> : null` and stays in the orchestrator (NOT in
  MapView) because on phone the single-column `RoomBoardLayout` restacks col2
  beneath col1, and that stacking is a RoomBoardLayout concern, not a lens
  concern. Moving col2 into MapView would change the RoomBoardLayout slot tree
  and risk a visual diff. KEEP col2 in the orchestrator.

---

## Test plan

This card writes NO new behavior tests (nothing new to test) but MUST keep the
full existing suite green with zero snapshot delta, and MUST add doctrine
coverage for the new files. The work splits into: (a) doctrine-scan additions,
(b) source-scan repoints, (c) zero-diff render pins that stay unchanged.

### (a) New doctrine coverage (add the room/ files to existing scanners)

- `__tests__/uxOneOneTwoDoctrine.test.ts` — add
  `src/features/arguments/room/ArgumentRoom.tsx`,
  `.../room/ExchangeView.tsx`, `.../room/MapView.tsx`,
  `.../room/roomActionCodes.ts` to `UX_001_2_FILES`. This gives the new files
  the verdict-ban-list + internal-code-leak + security-keyword + provider-import
  + no-console.log coverage the monolith had.

### (b) Source-scan repoints (the dominant work — one edit per suite)

For EACH suite below, the `readFileSync(... 'ArgumentGameSurface.tsx')` path is
repointed to the room/ file the scanned tokens now live in. Where a suite
asserts tokens that split across files, it reads BOTH and each `toMatch` targets
the correct source. Full per-suite disposition is in the `testImpact` table.

- `__tests__/boardActPopoutMountSite.test.ts` — repoint `SURFACE_PATH` to
  `room/ArgumentRoom.tsx` (the board Act mount + `setBoardActVisible` +
  `useConstitution()` all stay in the orchestrator).
- `__tests__/argumentGameSurfaceDockComposerWiring.test.ts` — repoint
  `GAME_SURFACE_SRC` to `room/ArgumentRoom.tsx` (the `handleActionDockAction` +
  the `handleAction('reply'|'disagree'|'ask_for_source'|…, targetMessageId,
  preset)` dispatch + the `onAction?:` prop + `onAction?.(control, messageId,
  preset)` all stay in the orchestrator; see the "keep handleActionDockAction in
  the orchestrator" decision).
- `__tests__/argumentGameSurface.test.ts` (EV-003 block) — SPLIT: the derivation
  tokens (`deriveEvidenceDebts(`, `getNodeEvidenceDebtSummary`,
  `artifacts: artifactsByMessageId[m.id]`, no `SERVICE_ROLE`) read
  `room/ArgumentRoom.tsx`; the mount-prop token
  (`evidenceDebtSummaryFor={evidenceDebtSummaryFor}`) reads `room/MapView.tsx`.
- `__tests__/argumentGameSurfaceSemanticWiring.test.tsx` — SPLIT: banner/override
  wiring + Props-optional tokens read `room/ArgumentRoom.tsx`; the
  `ArgumentBubbleStack` sanity token reads `room/ExchangeView.tsx`; the
  `ArgumentTimelineMap` sanity token reads `room/MapView.tsx`; `ArgumentSideActionRail`
  reads `room/ArgumentRoom.tsx` (bottomChrome). The two negative
  `refereeBanner[^\n]*ArgumentSideActionRail|ArgumentBubbleActions` assertions
  read `room/ArgumentRoom.tsx` (ArgumentSideActionRail is there; ArgumentBubbleActions
  moved to ExchangeView, so the negative trivially holds on the orchestrator).
- `__tests__/cardViewRefineContainmentNav.test.tsx` (the `read('...ArgumentGameSurface.tsx')`
  at line 153) — repoint to `room/ArgumentRoom.tsx` (the Stack keyboard effect
  `handleStackKeyDown` / `resolveStackKeyEffect` / `if (mode !== 'stack') return;`
  stays in the orchestrator; see "keep the Stack keyboard effect in the
  orchestrator" decision). The `read('...ArgumentBubbleStack.tsx')` block is
  unchanged (that file is untouched).
- `__tests__/composerDockInRoom.test.ts` — reads `App.tsx` + `ArgumentComposerDock.tsx`
  only; the sole `ArgumentGameSurface` reference is a comment. UNCHANGED (no
  readFileSync of the surface).
- `__tests__/demoCorridorNoProvider.test.ts` — asserts `DemoCorridorScreen`
  imports `ArgumentGameSurface` from `'../arguments/ArgumentGameSurface'` (line 65).
  The shim KEEPS that import path valid AND keeps `DemoCorridorScreen`
  unchanged, so the regex still matches. UNCHANGED (unless the implementer
  chooses to migrate DemoCorridorScreen to import ArgumentRoom directly — NOT
  recommended; leave it on the shim).
- `__tests__/demoCorridorFixture.test.ts` — a comment references
  `ArgumentGameSurface.tsx:607-624` (stale line ref, non-load-bearing). The test
  body derives debts independently; no readFileSync of the surface. UNCHANGED
  (optionally refresh the comment's line ref, cosmetic).

### (c) Zero-diff render pins that MUST stay green UNCHANGED (do not edit)

- `__tests__/ArgumentGameSurface.integration.test.tsx` — imports
  `{ ArgumentGameSurface }` by name (line 102), renders it, asserts
  `getByTestId('argument-game-surface')`, `argument-bubble-stack`,
  `argument-timeline-map`, `argument-side-action-rail`, `timeline-node-m*`, and
  the doctrine no-verdict-token scan of rendered strings. The re-export shim
  makes this GREEN with NO edit — the component behaves identically.
- `__tests__/sunset003DefaultPathLeakage.test.tsx` — imports the surface; the
  shim preserves the import + behavior. UNCHANGED (verify green; do not edit).
- `__tests__/ArgumentTimelineMap.test.tsx` — tests `ArgumentTimelineMap` directly
  (mirrors the integration mocks). `ArgumentTimelineMap.tsx` is UNTOUCHED, so
  this stays green unchanged.
- `__tests__/uxOneOneSixReadOnlyBoundary.test.ts` — `requiredApi:
  ['ArgumentGameSurface']` on the shim still matches (the shim exports that
  token). Add the room/ entries + a NOTE (Landmine 2), but the existing
  `ArgumentGameSurface.tsx` assertion needs NO change.
- `__tests__/visualSimplify002AnalysisOnDemand.test.tsx`,
  `uxBoardRail002Topology.test.tsx`, `uxBoardRail004BottomChrome.test.tsx`,
  `uxSelectedNode001CenterOfRoom.test.tsx`, `uxMediator002NodeMarkup.test.tsx`,
  `uxNextMove001SuggestMyNextMove.test.tsx`, `uxFeedback001ProgressNote.test.tsx`,
  `boardActPopoutMountSite`/`inspectPopoutMountSite`/`goPopoutMountSite` — the
  reviewer MUST run each of these to confirm whether it renders the surface or
  source-scans it. Any that source-scan `ArgumentGameSurface.tsx` for a token
  that moved get the same repoint treatment as (b). The implementer must GREP the
  full `__tests__/` tree for `ArgumentGameSurface.tsx` string reads before
  claiming done (see zeroDiffProofPlan). This design enumerates the KNOWN
  scanners; the implementer verifies exhaustively.

### Doctrine ban-list assertions

The new files touch NO user-facing strings (they render existing components with
existing copy). The `uxOneOneTwoDoctrine` extension in (a) supplies the verdict
+ internal-code ban-list coverage. No new gameCopy mapping is added, so no
plain-language coverage delta.

---

## Dependencies (cards / docs / files)

- **Reads existing `railActionCategories.ts`** at `RailActionCode` /
  `groupRailActionsByCategory` — `roomActionCodes.ts` aliases this. Assumes it
  stays the canonical rail vocabulary (it is; pinned by `railActionGrouping.test.ts`).
- **Reads existing `argumentGameSurfaceModel.ts`** at `ArgumentBubbleControl`
  (52-60) + all the builder fns — unchanged; the orchestrator still calls them.
- **Reads existing `ArgumentSideActionRail.tsx`** at `railActionToBubbleControl`
  — re-exported unchanged by `roomActionCodes.ts`.
- **Reads existing `roomMediatorAdapter.ts`** at `deriveRoomMediatorBoardState`
  — the single mediator-board derivation stays in the orchestrator (Landmine 4).
- **Reads existing `ArgumentTimelineMap.tsx`** props (103-229) — MapView is a
  pass-through wrapper; that component is UNTOUCHED (and pinned zero-diff by
  `uxOneOneSixReadOnlyBoundary` line 81 + `ArgumentTimelineMap.test.tsx`).
- **Reads existing `ArgumentBubbleStack.tsx` / `ArgumentBubbleActions.tsx`** props
  — ExchangeView passes them through; both components UNTOUCHED.
- **Blocks all future Argument Surface Pivot cards** (Ringside Exchange lens,
  one-bar composer, ambient StateRail, proof drawer, voice) because those cards
  target `room/ExchangeView.tsx` / `room/MapView.tsx` / `room/ArgumentRoom.tsx`
  as their edit surfaces. This card creates those seams.
- **This design assumes RESEED-002 (main `cd3ab6d`) is complete** — the worktree
  base; no functional dependency, just the branch point.

---

## Risks

1. **The "everything textually in one return" invariant is being deliberately
   broken.** The monolith's own comment (2327-2337) says the JSX was kept in one
   `return` SO THAT the source-scan suites keep passing. Extraction moves those
   substrings. The mitigation is exhaustive: EVERY suite that `readFileSync`s
   `ArgumentGameSurface.tsx` must be found and repointed. The KNOWN set is
   enumerated in `testImpact`; the residual risk is an UNENUMERATED scanner. The
   implementer MUST run a repo-wide grep for the literal string
   `ArgumentGameSurface.tsx` inside `__tests__/` (and `scripts/`) and repoint any
   hit before claiming done. A missed scanner is a red suite, caught by the full
   `npm run test` — but only if the full suite (not a tailed subset) runs to a
   captured exit 0.

2. **Cross-file token scanners (`argumentGameSurface.test.ts` EV-003,
   `argumentGameSurfaceSemanticWiring.test.tsx`) must be SPLIT, not just
   repointed.** A naive "change the path" edit fails because the asserted tokens
   land in different room/ files. The design specifies the split per token; the
   implementer must apply it exactly. Risk: getting a token->file mapping wrong
   yields a false red. Mitigation: the design's token->file table is derived from
   the confirmed region map.

3. **`doctrine-scanner-apostrophe-gotcha` (memory).** `uxOneOneTwoDoctrine`'s
   `STRING_RE` (line 66) is a naive quote-parity regex: a SINGLE unbalanced
   apostrophe in ANY comment in a scanned file poisons string parsing file-wide
   and flags distant innocent strings. The room/ files will be added to the scan
   list. THEREFORE every comment in `ArgumentRoom.tsx`, `ExchangeView.tsx`,
   `MapView.tsx`, `roomActionCodes.ts`, and the shim MUST be apostrophe-free with
   balanced quotes/backticks. The monolith's existing comments (which move into
   ArgumentRoom) must be audited for apostrophes DURING the move and de-
   apostrophized (e.g. "the composer's" -> "the composer" / "of the composer").
   Mitigation: run `uxOneOneTwoDoctrine` in isolation immediately after the move,
   before the rest of the suite.

4. **`worktree-agent-write-slips-to-primary` (memory).** New files under
   `src/features/arguments/room/` (a real dir in the primary checkout, not a
   junction) can slip to the primary checkout on Write. The implementer MUST
   `git status` + `ls` the primary path after each new-file Write and move any
   slipped file back into the worktree, then re-verify the primary is clean
   before merge.

5. **Inline-arrow lift changes closure identity subtly.** Lifting the three
   timeline inline arrows (onJumpLatest/onJumpToRoot/onOpenDetails) into named
   `useCallback`s changes their referential identity per-render (a `useCallback`
   with deps vs a fresh arrow each render). Behavior is identical, but if any
   test asserted referential stability it could flake. None do (they are
   source-scans + render pins). Low risk; noted for completeness.

6. **`mediator-board-single-derivation` (memory).** `deriveRoomMediatorBoardState`
   is called exactly ONCE (line 799). It MUST stay called once in the orchestrator
   and its `mediatorBoard` result passed to any child that needs it. ExchangeView
   and MapView do NOT re-derive it (neither consumes it directly today — the
   mediator surfaces live in col2/col2Footer/col3, all in the orchestrator). Risk:
   an implementer "tidying" a mediator read into a view re-derives the board.
   Mitigation: the design forbids any `deriveRoomMediatorBoardState` /
   `deriveMediatorBoardState` import in ExchangeView.tsx or MapView.tsx; add a
   guard assertion in `uxOneOneTwoDoctrine` scope is unnecessary, but the reviewer
   should grep the two view files for those symbols and confirm ZERO hits.

7. **Line count of ArgumentRoom stays ~2,950.** The card frames ArgumentRoom as
   "thin", but the orchestrator legitimately keeps all derivations + handlers +
   shared chrome. This is NOT a failure — "thin" means "no lens-body JSX + a clean
   slot skeleton", and the real thinning (extracting derivations into hooks/models)
   is a FOLLOW-UP card, out of scope here. Flag to the operator so the ~2,950-line
   orchestrator is not read as an incomplete extraction.

8. **`eslint scans .ts scratch` + full-suite flakes (memory).** Two wall-clock
   perf tests (`pointLifecycleModel` LIFE-001, `moveMetadataLedger` META-001)
   flake under full-suite parallel load but pass isolated. If they go red in the
   ASP-EXTRACT-001 run, re-run isolated before blaming the branch — they are not
   in this card's diff.

---

## Out of scope

- Extracting the ~30 derivations into custom hooks (`useRoomSurfaceState`,
  `useRoomEvidence`, `useRoomMediator`, etc.) or pure models. This is the OBVIOUS
  next refactor but it is a SEPARATE card — this card only relocates JSX branches
  and creates the seams.
- Any change to `ArgumentTimelineMap.tsx`, `ArgumentBubbleStack.tsx`,
  `ArgumentBubbleActions.tsx`, `RoomBoardLayout.tsx`, `BoardBottomChrome.tsx`, or
  any Popout — all UNTOUCHED.
- Any change to the rail vocabulary, the Constitution engine, the composer, the
  Edge Functions, or any migration.
- The Ringside Exchange lens redesign, one-bar composer, ambient StateRail, proof
  drawer, voice — all future cards that CONSUME the seams this card creates.
- Repointing `App.tsx`'s mount (it mounts `ArgumentTreeScreen`, which mounts the
  surface via the shim — no App.tsx change needed; see shim-vs-remount decision).
- Migrating `ArgumentTreeScreen`/`DemoCorridorScreen` to import `ArgumentRoom`
  directly — leave them on the shim to minimize churn (a later cosmetic card can
  drop the shim once no importer remains).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels, score never blocks posting):**
  respected — no score path, no truth-label surface, no validation path touched.
  The extraction renders the exact same components with the exact same strings.
- **cdiscourse-doctrine §2-§3 (heat != truth, popularity != evidence):** respected
  — no band/heat/standing rendering logic changes; `MapView` passes the
  already-band-neutral `timelineMap` straight through.
- **cdiscourse-doctrine §4 (AI moderator limits) / §7 (no AI in prod app):**
  respected — no AI call added; no provider import; `uxOneOneTwoDoctrine`
  extension enforces this on the new files.
- **cdiscourse-doctrine §5 (rules engine sacred):** respected — the engine is not
  imported by any new file.
- **cdiscourse-doctrine §6 (secrets):** respected — no key reference; the
  security-keyword scan covers the new files.
- **cdiscourse-doctrine §8 (Supabase conventions):** respected — no migration, no
  RLS, no service-role. The two existing metadata-write handlers move verbatim.
- **cdiscourse-doctrine §9 (plain language):** respected — no new internal code
  enters a user-facing string; no gameCopy mapping added.
- **cdiscourse-doctrine §10 / §10a (v1 scope, Observations vs Allegations):**
  respected — no scope item built; node-label rendering (NodeLabelInspectGroups)
  moves verbatim inside the orchestrator, preserving the machine/user source
  boundary untouched.
- **timeline-grammar:** respected — MapView is a pass-through over
  `ArgumentTimelineMap`; no node shape/stroke/strength/lane logic changes. The
  band-neutral default (VISUAL-SIMPLIFY-003) and the lane-continuity fix survive
  because the `timelineMap` model is built unchanged in the orchestrator.
- **expo-rn-patterns:** respected — no new dependency; the new files use only
  `<View>` / `<Text>` / `<Pressable>` primitives already in the moved JSX; model
  file `roomActionCodes.ts` is pure TS (no React import). The 44x44 targets +
  a11y labels move verbatim with the JSX.
- **test-discipline:** respected — test count goes UP (the new files gain
  `uxOneOneTwoDoctrine` cases); no `.skip`/`.only`; full-suite exit-0 is the gate;
  the design mandates a captured `Test Suites/Tests` line, not tailed output.
- **mediator-board-single-derivation (memory):** respected — single
  `deriveRoomMediatorBoardState` call stays in the orchestrator; views forbidden
  from re-deriving.
- **doctrine-scanner-apostrophe-gotcha (memory):** respected — the design mandates
  apostrophe-free, quote-balanced comments in every new/moved file and an isolated
  `uxOneOneTwoDoctrine` run right after the move.

---

## Operator steps (if any)

None — pure code change. No `supabase db push`, no `functions deploy`, no env
var, no manual step. The card ships behind the existing app with byte-identical
runtime behavior; a normal merge to `main` is the only action, and the Supabase
GitHub integration is not triggered (no migration, no registered Edge Function
touched).

---

## Slicing recommendation

**Recommendation: 2 slices, in order. Slice 1 is low-risk and independently
mergeable; Slice 2 carries the source-scan-repoint blast radius.**

**Slice 1 (low-risk foundation) — `roomActionCodes.ts` + `MapView.tsx`:**
- Create `src/features/arguments/room/roomActionCodes.ts` (pure alias module; no
  behavior change, no importer yet).
- Create `src/features/arguments/room/MapView.tsx` and repoint ONLY the
  `mode === 'timeline'` col1 branch to `<MapView {...mapProps}/>` (lift the three
  inline timeline arrows to named handlers in the still-monolithic
  `ArgumentGameSurface.tsx`).
- Repoint the timeline-touching scan tokens: `argumentGameSurface.test.ts`
  EV-003 mount token (`evidenceDebtSummaryFor=…` -> MapView), the
  `ArgumentTimelineMap` sanity token in `argumentGameSurfaceSemanticWiring` ->
  MapView.
- Add MapView + roomActionCodes to `uxOneOneTwoDoctrine`.
- Rationale: MapView is a pure pass-through wrapper with a small, well-bounded
  scan-token footprint; landing it first proves the extraction pattern (props
  interface + inline-arrow lift + scan repoint) on the SIMPLER lens before the
  stack lens. The file is still `ArgumentGameSurface.tsx` (no shim yet), so the
  integration render test is untouched.

**Slice 2 (the orchestrator carve) — `ArgumentRoom.tsx` + `ExchangeView.tsx` +
the shim:**
- Rename `ArgumentGameSurface.tsx`'s component to `ArgumentRoom` in a new
  `room/ArgumentRoom.tsx` (moving the whole file), extract the
  `mode === 'stack'` branch into `ExchangeView.tsx`, and reduce
  `ArgumentGameSurface.tsx` to the re-export shim.
- De-apostrophize all moved comments (apostrophe-gotcha).
- Repoint the remaining scanners: `boardActPopoutMountSite`,
  `argumentGameSurfaceDockComposerWiring`, `argumentGameSurface.test.ts` EV-003
  DERIVATION tokens, `argumentGameSurfaceSemanticWiring` orchestrator tokens +
  the ExchangeView `ArgumentBubbleStack` token, `cardViewRefineContainmentNav`.
- Add ArgumentRoom + ExchangeView to `uxOneOneTwoDoctrine`; add the NOTE + room/
  entries to `uxOneOneSixReadOnlyBoundary`.
- Rationale: this slice moves the bulk of the substrings the scanners read, so it
  carries the coordination risk. Doing it AFTER Slice 1 means the MapView pattern
  is already proven and the reviewer can focus the heightened source-scan
  verification here.

> If the operator prefers a single PR for atomicity (so `main` is never in a
> "half-extracted" state where MapView exists but ExchangeView does not), ONE PR
> is acceptable — the slices are logically independent but not required to land
> separately. The recommendation for 2 is about REVIEW ergonomics (smaller diffs,
> the pattern proven on the simpler lens first), not correctness. Either way, the
> full `npm run test` must exit 0 with a captured count before merge.

---

## Zero-diff proof plan (which pins to run)

Run ALL of the following to a CAPTURED exit code (append `; echo "EXIT: $?"`;
raise the per-command timeout to 5-10 min for the full suite per test-discipline):

1. `npm run typecheck` — proves the new prop interfaces + `roomActionCodes.ts`
   `satisfies` clause compile; catches any moved-identifier miss.
2. `npm run lint` — catches stray `.ts` scratch, unused imports after the move.
3. `npx jest __tests__/uxOneOneTwoDoctrine.test.ts` — ISOLATED, FIRST after the
   move (apostrophe-gotcha early-warning).
4. `npx jest __tests__/ArgumentGameSurface.integration.test.tsx` — the behavioral
   zero-diff anchor; MUST pass UNCHANGED via the shim (root testID + sub-mounts +
   node selection + rail collapse + composer dock + referee banner + doctrine
   scan of rendered strings).
5. `npx jest __tests__/sunset003DefaultPathLeakage.test.tsx __tests__/ArgumentTimelineMap.test.tsx`
   — additional render pins that must pass unchanged.
6. The repointed source-scanners:
   `npx jest __tests__/boardActPopoutMountSite.test.ts __tests__/argumentGameSurfaceDockComposerWiring.test.ts __tests__/argumentGameSurface.test.ts __tests__/argumentGameSurfaceSemanticWiring.test.tsx __tests__/cardViewRefineContainmentNav.test.tsx __tests__/uxOneOneSixReadOnlyBoundary.test.ts`.
7. **Repo-wide grep gate (do BEFORE claiming done):**
   `Grep pattern "ArgumentGameSurface\.tsx" path __tests__` and
   `Grep pattern "ArgumentGameSurface\.tsx" path scripts` — every hit that is a
   `readFileSync`/`read(` of the file must be repointed; every hit that is a
   comment/import-path-string is fine on the shim. This is the safety net for
   risk #1.
8. **Mediator single-derivation grep:** `Grep pattern "deriveMediatorBoardState|deriveRoomMediatorBoardState" path src/features/arguments/room` — MUST return
   hits ONLY in `ArgumentRoom.tsx` (zero in ExchangeView.tsx / MapView.tsx).
9. `npm run test` — the FULL suite, captured `Test Suites: X passed / Tests: Y
   passed` line + `EXIT: 0`. Baseline is 1805 tests / 70 suites; the count MUST
   go UP (new doctrine cases) and NEVER down. If a wall-clock perf test flakes,
   re-run it isolated (risk #8).

A green result across 1-9 is the zero-behavior / zero-snapshot proof: the render
tests prove runtime identity, the source-scans prove the wiring moved intact, the
grep gates prove nothing was missed and the single-derivation invariant holds.

---

## Decisions (summary for the reviewer)

- **Shim, not remount.** `ArgumentGameSurface.tsx` becomes
  `export { ArgumentRoom as ArgumentGameSurface } from './room/ArgumentRoom';`.
  Rationale: 68 files reference `ArgumentGameSurface`; the ONLY JSX mount is
  `ArgumentTreeScreen.tsx:545` (App.tsx references it in comments only, mounting
  `ArgumentTreeScreen`). The shim keeps all 68 references + the integration render
  test valid with ZERO import-path churn. Remounting would edit
  `ArgumentTreeScreen` + risk the `demoCorridorNoProvider` import-path regex + gain
  nothing.
- **Keep `handleAction`, `handleActionDockAction`, and the Stack keyboard effect
  in the orchestrator.** They are shared and/or read orchestrator-only state; this
  keeps the `argumentGameSurfaceDockComposerWiring` + `cardViewRefineContainmentNav`
  scanners pointed at ONE file (`ArgumentRoom.tsx`) instead of splitting them.
- **`roomActionCodes.ts` is an alias/bridge, not a new vocabulary.** It unions the
  two shipped unions + re-exports the shipped bridge; a `satisfies` clause guards
  against drift. This honors "do not invent codes" and keeps
  `railActionGrouping.test.ts` / `duplicateRailRemovalDisposition.test.ts` green.
- **col2 (supporting panels) stays in the orchestrator, not MapView.** Its phone
  re-stacking is a `RoomBoardLayout` slot concern; moving it would risk a visual
  diff.
- **The orchestrator stays ~2,950 lines and that is correct for THIS card.** Deep
  thinning (derivations -> hooks) is an explicit follow-up, out of scope.
