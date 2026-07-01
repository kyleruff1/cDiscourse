# VISUAL-SIMPLIFY-002 — Analysis surfaces on-demand behind drawers

**Card:** VISUAL-SIMPLIFY-002 (GitHub issue #845)
**Roadmap:** PRODUCT-REDIRECT-001 (epic #826)
**Release:** UI / UX only
**Baseline:** main @ f27f018 (includes UX-FLAGS chain, UX-COMPOSER-002, VISUAL-SIMPLIFY-003 band-neutral default)

## Goal

The default room view is dense: the Disagreement Points rail is a **permanent
380 px docked pane** on tablet/wide (`RoomBoardLayout` col3), the Mediator
readout (`ArgumentScoreTracker`) mounts eagerly below the timeline, and the
Open Issues rail sits in bottom chrome. The product north star is
**conversation-first**: the default view should lead with the spine + bubbles +
composer + ≤3 friendly flags, and deep analysis should be **one tap away, never
in the default line of sight**.

This card **re-scopes VISIBILITY, not machinery**. Every analysis component
(`DisagreementPointsRail`, `OpenIssuesRail`, `ArgumentScoreTracker`) is kept
intact; each analysis surface becomes on-demand (summoned by a calm,
verdict-free trigger; dismissed by default) on **every** band. No permanent
analysis pane remains in the default room view.

Doctrine anchors that constrain the change:
- **§1** — triggers and surfaces are verdict-free plain language (reuse shipped
  ban-list-clean copy atoms).
- **Single mediator-board derivation** (UX-BOARD-RAIL-002): `deriveRoomMediatorBoardState`
  is called EXACTLY ONCE upstream; the on-demand mount reads the same
  `mediatorBoard` and never re-derives inside a drawer.
- **Single-owner bottom-chrome exclusion** (REF-006-RAIL / UX-BOARD-RAIL-004):
  extended, not duplicated — one selector decides which analysis surface (if
  any) is mounted.

## Data model

No persisted model. One local UI selector added to `ArgumentGameSurface`:

```ts
type AnalysisSurfaceKey = 'disagreement' | 'open_issues' | 'readout' | null;
const [activeAnalysisSurface, setActiveAnalysisSurface] =
  useState<AnalysisSurfaceKey>(null);   // DEFAULT null → nothing mounted, every band
```

A **single key** (not three booleans) makes "two analysis surfaces open at
once" unrepresentable → structural mutual exclusion, reusing the discipline the
Act/Inspect/Go menus already follow. The existing
`disagreementPointsRailExpanded` / `openIssuesRailExpanded` / `sideRailExpanded`
booleans are **RETAINED** — the child rails still own their own expand/collapse
for the `isAnyPanelOpen` OR-terms. `activeAnalysisSurface` is the **parent gate**
deciding whether the pane/sheet is mounted at all.

## File changes

| File | Change | Approx |
|---|---|---|
| `src/features/arguments/ArgumentGameSurface.tsx` | `AnalysisSurfaceKey` type + selector; `handleOpenAnalysisSurface`; extend `handleRailExpandedChange` + `handleOpenIssuesRailExpandedChange`; gate col3 (Disagreement pane) + `ArgumentScoreTracker` (readout) on the selector; add the calm `board-analysis-trigger-row`; reuse `DISAGREEMENT_POINTS_RAIL_COPY.title` / `OPEN_ISSUES_RAIL_COPY.railTitle` copy atoms; `analysisTriggerRow` style | +~180 / −15 |
| `src/features/arguments/RoomBoardLayout.tsx` | Guard BOTH tablet + wide `paneColumn` with `{col3 ? <View testID="room-board-col-3" …>{col3}</View> : null}` so a null col3 reserves no 380 px column | +~20 / −8 |
| `__tests__/visualSimplify002AnalysisOnDemand.test.tsx` | New test (28 cases) | new |
| `docs/designs/VISUAL-SIMPLIFY-002.md` | This doc | new |

`docs/core/current-status.md` is **NOT** touched (per card scope).

## API / interface contracts

- `RoomBoardLayout` props **unchanged**. The col3 slot now renders inside the
  380 px `paneColumn` **only when `col3` is truthy**. The topology tests always
  pass a truthy marker, so `room-board-col-3` remains present in every
  enumerated case; the production caller passes `col3=null` in the default view.
- `handleOpenAnalysisSurface(key)` — toggles the selector (same key twice →
  null), clears `selectedDockTarget`, and force-collapses the Open Issues rail
  when summoning a different surface (single-owner exclusion).
- Dismiss paths (no standalone close handler needed): (a) pressing the same
  trigger again, (b) the Disagreement rail's own collapse control routed through
  `onExpandedChange(false) → setActiveAnalysisSurface(null)`, (c) opening the
  side action rail (`handleRailExpandedChange`).
- The summoned Disagreement rail still receives `board={mediatorBoard}` and
  `presentation={boardPresentation}` (`'sheet'` on phone, `'pane'` on
  tablet/wide) and `defaultCollapsed={false}` so it opens expanded when summoned.
- Trigger copy reuses shipped ban-list-clean atoms: `DISAGREEMENT_POINTS_RAIL_COPY.title`
  ("Disagreement points"), `OPEN_ISSUES_RAIL_COPY.railTitle` ("Open issues"),
  and the ScoreTracker's own "Mediator readout" title — no new
  `gameCopy.toPlainLanguage` mapping required.

## Per-breakpoint behavior (default HIDDEN everywhere)

- **phone** — nothing mounted by default; summoned Disagreement uses the shipped
  `presentation='sheet'` (opens expanded via `defaultCollapsed={false}`).
- **tablet / wide** — nothing mounted by default (no 380 px docked column,
  because `col3=null` → `RoomBoardLayout` reserves no `paneColumn`); summoned
  Disagreement uses `presentation='pane'`, mounted ONLY while
  `activeAnalysisSurface === 'disagreement'`.
- The Mediator readout (ScoreTracker) and the Disagreement/Open-Issues surfaces
  open on request on all bands. `OpenIssuesRail` keeps its collapsed-chip
  affordance in bottom chrome (machinery kept); its EXPANSION routes through the
  selector so only one analysis surface is expanded at a time.
- The mediator board is still derived ONCE upstream and passed into the pane —
  the on-demand mount never moves/duplicates the derivation into a drawer.

## Affordance spec

A calm `board-analysis-trigger-row` (three per-surface triggers) is added below
the Act/Inspect/Go row. Per trigger:
- `testID`: `board-menu-trigger-disagreement` / `-openissues` / `-readout`.
- `accessibilityRole="button"`; `accessibilityState={{ expanded: activeAnalysisSurface === key }}`;
  descriptive `accessibilityLabel` ("Open disagreement points" / "Open the open
  issues list" / "Open mediator readout") + an `accessibilityHint`.
- ≥44 px target via the reused `styles.menuTriggerButton` (`minHeight: 44`) +
  `hitSlop`.
- Color is never the sole signal — each trigger carries a text label.
- Reduce-motion: surfaces snap mount/unmount; no new `Animated`. The pane
  already suppresses its entry animation.
- Dismiss reuses the shipped `disagreement-points-rail-collapse` /
  `open-issues-rail` collapse controls.

## Edge cases

- **Empty / zero-trends / null board** — components already handle empty/
  unavailable states; the gate only decides mount, never the content.
- **Concurrent opens** — impossible by construction (single selector).
- **Exclusion interplay** — opening the side rail closes any analysis surface;
  summoning Disagreement/readout collapses the Open Issues rail; the retained
  `isAnyPanelOpen` OR-terms are unchanged (DEFER per UX-BOARD-RAIL-002).
- **Reduce-motion** — snap mount/unmount, no new animation.
- **phone vs wide** — default hidden on both; summoned presentation differs
  (sheet vs pane) via the shipped `boardPresentation`.
- **Role** — read-only for every viewer role; no submission gate introduced.
- **Doctrine** — no new copy; the two pre-existing ban-list substrings in the
  room ("…advisory, not a verdict." and "Heat: —") are doctrine-compliant
  denials / activity labels owned by other cards.

## Test plan

`__tests__/visualSimplify002AnalysisOnDemand.test.tsx` (28 cases):
1. `RoomBoardLayout` renders `room-board-col-3` only when `col3` is truthy
   (tablet + wide truthy → present; null → absent; phone → no board row); the
   wrapper guards BOTH branches.
2. Real `ArgumentGameSurface` (via `DemoCorridorScreen`) default view mounts NO
   Disagreement pane, NO `argument-score-tracker`, and NO `room-board-col-3`;
   the Open Issues collapsed chip is still present as default bottom chrome.
3. Summoned `DisagreementPointsRail` (`presentation='pane'`) still mounts its
   title + collapse control (component unchanged).
4. Selector shape: union declared, defaults null, disagreement + readout mounts
   gated; compact `TimelineSelectedReadoutPanel` NOT gated (stays line-of-sight);
   the verbatim `<ArgumentScoreTracker trends={participantTrends} />` substring
   preserved inside the ternary.
5. Single-owner exclusion extended (side rail clears analysis; summon collapses
   Open Issues); existing booleans retained.
6. Single mediator-board derivation preserved (`deriveRoomMediatorBoardState`
   exactly once; `board={mediatorBoard}`; no second derivation).
7. a11y on every trigger (role + label + `expanded` state + ≥44 px + hitSlop).
8. Reduce-motion safe (no new `Animated` in `RoomBoardLayout`; pane snaps).
9. Ban-list clean over trigger copy + summoned pane; default view introduces no
   NEW banned token.

## Dependencies

Reads UX-BOARD-RAIL-002 (single derivation, band-driven columns, pane
presentation), UX-BOARD-RAIL-004 (bottom-chrome grouping), VISUAL-SIMPLIFY-003
(band-neutral default). Does not block #844 (CardDetailPanel hub) or #849
(raw-MCP relocation).

## Risks

- `uxOneOneTwoChromeLayerRemovals` pins the `<ArgumentScoreTracker trends={participantTrends} />`
  substring and its after-`ArgumentTimelineMap` order → preserved byte-identical
  inside the ternary.
- `uxBoardRail002Topology` pins col3 (`room-board-col-3`) presence,
  `deriveRoomMediatorBoardState( === 1`, `board={mediatorBoard}` → all held; the
  topology tests always pass a truthy col3 marker so the `col3 ? … : null` guard
  keeps `room-board-col-3` truthy in every case.
- `DisagreementPointsRail` component-level pane test (expanded-by-default) →
  component unchanged.
- Exclusion routing → verified by the new suite.
- Boundary suites (`uxOneOneFive/SixReadOnlyBoundary`) are API-presence only
  (`ArgumentScoreTracker` + `ArgumentGameSurface` names remain) → **no boundary
  relaxation needed**.

## Out of scope

#844 (CardDetailPanel/hub), #849 (raw-MCP relocation), #834/#835 (friendly-flag
row), #846 (band-neutral default just merged). No deletion of
`DisagreementPointsRail` / `OpenIssuesRail` components. No Edge / mcp-server /
migration / config / validator / ban-list / familyRegistry / prompt change. No
provider spend. No new dependencies. The deferred `isAnyPanelOpen` OR-term
rewire stays deferred. `docs/core/current-status.md` NOT touched.

## Doctrine self-check

- **§1 (score ≠ truth)** — no verdict copy; triggers reuse ban-list-clean atoms;
  ban-list test scans trigger copy + summoned surfaces. ✔
- **§2 (heat = activity)** — no new heat copy; pre-existing "Heat: —" label
  untouched. ✔
- **§3 (popularity ≠ evidence)** — no engagement/amplification surface touched. ✔
- **§5 (engine sacred)** — no engine import/change. ✔
- **§7 (no AI calls from app)** — none. ✔
- **§9 (plain language)** — no internal codes surfaced; triggers are plain words. ✔
- **§10a (Observations vs Allegations)** — node label doctrine untouched. ✔
- **§10 (v1 scope)** — no voting/scoring winner introduced. ✔
- **Accessibility** — role + label + expanded state + ≥44 px + hitSlop +
  color-not-sole-signal + reduce-motion snap. ✔
- **Expo/RN** — RN primitives only (`View` / `Pressable` / `Text`); no new dep. ✔
- **Landmine 1 (single derivation)** — reused, never re-derived in a drawer. ✔
- **Landmine 2 (single-owner exclusion)** — extended via one selector, not a
  competing system. ✔
- **Landmine 3 (read-only boundary)** — API-presence only; no relaxation. ✔
- **Landmine 4 (typography/tap tokens)** — reused `TOUCH_TARGET`-equivalent
  `menuTriggerButton` minHeight 44; no token bump. ✔

## Operator steps

None — pure client-side code change. No migration, no Edge/mcp-server deploy,
no env var, no provider spend.
