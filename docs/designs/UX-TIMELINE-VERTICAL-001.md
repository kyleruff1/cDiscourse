# UX-TIMELINE-VERTICAL-001 — Vertical argument-path / timeline mode

> Design-first plan for a VERTICAL rendering of the argument timeline that preserves
> every capability of the current HORIZONTAL surface. DOCS + ISSUE-PLANNING run; no
> production source is changed by this document.
>
> Sibling issues: #751 (pure model), #752
> (component), #753 (optional read-only history/replay).

## 1. Problem

The shipped timeline is horizontal. `src/features/arguments/ArgumentTimelineMap.tsx:1124`
mounts a `<ScrollView horizontal>`, and the pure model places nodes with `x` monotonic
by chronological ordinal and `y` by branch lane:

- `src/features/arguments/argumentGameSurfaceModel.ts:1372` — `const x = TIMELINE_LEFT_PAD + i * xStep;`
- `src/features/arguments/argumentGameSurfaceModel.ts:1373` — `let y = TIMELINE_RAIL_Y + lane * TIMELINE_LANE_HEIGHT;`

On a tall phone, a long room scrolls sideways while the vertical space below the rail
sits unused. The v4 reference frames the timeline as a top-to-bottom history of a
disagreement (handoff `07-argument-timeline.md`, TL1 event log `:17-118`). A vertical
mode reclaims the wasted space and matches how a long disagreement is naturally read.

## 2. Doctrine — the timeline is structure, not a feed

The timeline is a high-reliability MEDIATOR board surface, never a social feed or
scoreboard. The vertical mode MUST NOT drift into an infinite scroll of full message
cards. Concretely:

- Nodes stay COMPACT structural markers on a spine (ordinal + kind dot + one state),
  exactly like today's `NodeDot` (`ArgumentTimelineMap.tsx:236`). Body text stays in the
  selected-node readout (`TimelineSelectedReadoutPanel.tsx:205`) — one selected point at
  a time.
- Branch lanes, junction "N routes" pills, off-thread markers, and collapse stubs MUST
  render, so the surface reads as a DAG, not a chat thread. Without them a vertical list
  is a feed, which is forbidden.
- No truth / winner / loser / verdict / heat / popularity framing. Color is never the
  only signal (per the `timeline-grammar` skill). Unknown stays unknown.
- The deterministic Constitution engine remains the SOLE submission gate. The timeline
  is read/navigate-only over a derived projection; it never posts, scores, or judges.
- Room / submit / seat / chime-in semantics are untouched by a rendering-axis change.

## 3. Current horizontal functionality inventory (must ALL be preserved)

Every capability below is owned by the horizontal surface today and must reach parity in
the vertical mode before the horizontal mode is retired.

| # | Capability | Owned today by (file:line) |
|---|---|---|
| 1 | Node tap → activate; second tap / info icon → popover or action dock | `ArgumentTimelineMap.tsx:838` (`handleNodeTap`), `:875` (`handleInfoTap`) |
| 2 | One-primary-state node treatment (active ring, latest ring, glow, halo, receipt mark, tone tint) | `ArgumentTimelineMap.tsx:236-444` (`NodeDot`) via `deriveTimelineNodeVisualStyle` |
| 3 | Route / branch cues: junction "N routes" pill, Off-thread (detached) pill | `ArgumentTimelineMap.tsx:420`, `:425` |
| 4 | Opening + First-clash markers | `ArgumentTimelineMap.tsx:407`, `:415` |
| 5 | Collapse stubs (one stub per collapsed branch, child count) | `ArgumentTimelineMap.tsx:1186` (`BranchCollapseStub`) |
| 6 | Selected-node "Responding to this point" + parent excerpt + Go-to-parent jump | `TimelineSelectedReadoutPanel.tsx:205-239` |
| 7 | Disagreement Points "View in timeline" jump | `DisagreementPointsRail.tsx:640` (`onJump?.(point.anchor.nodeId)`) |
| 8 | Act / Inspect / Go action dock (mutually exclusive with popover) | `TimelineNodeActionDock.tsx`; mount `ArgumentTimelineMap.tsx:1083-1122` |
| 9 | Prev / Next / Latest / Back-to-root / mode-toggle controls | `ArgumentTimelineMap.tsx:998-1055` |
| 10 | Bands (Opening / First clash / Evidence run / Hot zone / Current endgame) | `ArgumentTimelineMap.tsx:1150`; model `argumentGameSurfaceModel.ts:713` |
| 11 | Mini-map overview + viewport window + scrub-pan + jump | `ArgumentTimelineMap.tsx:1069` (`TimelineMiniMap`), `timelineMiniMapModel.ts` |
| 12 | Virtualized rail slice (bounded View count by viewport) | `ArgumentTimelineMap.tsx:701` (`visibleSlice`) |
| 13 | Gradient wave rail segments + source-chain / evidence-thread status | `ArgumentTimelineMap.tsx:1181` (`GradientWaveRail`), `railSegmentModel.ts` |
| 14 | Auto-scroll toward the active node | `ArgumentTimelineMap.tsx:744` |
| 15 | Begin / middle / end timestamp legend + color legend | `ArgumentTimelineMap.tsx:1217-1230` |
| 16 | Keyboard nav (web): single Tab stop, Arrow/Home/End/Enter/Space/Escape roving | `ArgumentTimelineMap.tsx:892` (`handleKeyDown`, `resolveTimelineNavEffect`) |
| 17 | Reduce-motion gating of glow + scroll animation | `ArgumentTimelineMap.tsx:502-546` |
| 18 | Whole-rail + per-node screen-reader labels (no verdict tokens) | `ArgumentTimelineMap.tsx:296-315`; `buildWholeRailAccessibilityLabel` |
| 19 | Linked prior-argument context chips | `ArgumentTimelineMap.tsx:1060` (`LinkedPriorArgumentChipRow`) |
| 20 | Empty state copy | `ArgumentTimelineMap.tsx:957` |
| 21 | Board column placement (timeline = col1; 1/2/3-column board by band) | `RoomBoardLayout.tsx:42`; pin `__tests__/uxBoardRail002Topology.test.tsx:6-24` |

## 4. Vertical target model

Transpose the geometry axis:

- **Time → `y`**: top = oldest (Opening), bottom = newest. `y` strictly monotonic in
  chronological ordinal (the inverse of today's `x` mapping at `argumentGameSurfaceModel.ts:1372`).
- **Branch lane → `x`**: mainline centered; side branches indented left/right by lane.
  Reuse `computeLane` verbatim (`argumentGameSurfaceModel.ts:899`) — first child continues
  the parent's lane, additional siblings alternate (per the `timeline-grammar` skill).
- **Scroll**: a vertical `<ScrollView>` (the page's natural scroll), replacing
  `<ScrollView horizontal>`. The center rail becomes a vertical spine.
- **Bands** become labeled vertical zones (yStart/yEnd) instead of horizontal x-spans.
- **Begin/middle/end** become top/middle/bottom anchors (reuse `beginningLabel` /
  `middleLabel` / `endLabel`).
- **Mini-map** becomes a vertical overview gutter; the viewport window + scrub-pan reuse
  the same projection (`timelineMiniMapModel.ts`).

The pure layout model (#751) is a deterministic transpose:
same node ids, same ordinal order, same lanes — only the x/y mapping flips, plus a
vertical `scrollHeight`, band y-ranges, and neighbor-lookup helpers for vertical keyboard
nav. Every selection / action / jump CALLBACK keeps its exact signature so the room-shell
wiring (`ArgumentGameSurface.tsx:2305`, mode state `:473`) is unchanged. Node visual
grammar (shape/stroke/glow/halo/receipt) is reused verbatim — only placement changes.

### Anti-feed guardrails (restated, concrete)

- Node markers are compact (ordinal + kind dot + state), NOT full posts.
- Bodies render only in the one selected-node readout, never inline per node.
- Junction pills, off-thread markers, and collapse stubs render so structure is legible.
- No like / score / verdict / reaction affordance is added.

## 5. Responsive behavior

- **phone (<600)**: vertical spine as `col1`, full width; selected-node readout below;
  Disagreement Points stays a collapsed bottom SHEET (unchanged). Vertical scroll IS the
  page scroll — this is where the wasted-vertical-space win lands hardest.
- **tablet (600-1279)**: vertical spine in the left spine column; Disagreement Points
  docked as the 380 px right PANE. `RoomBoardLayout` topology unchanged.
- **wide (>=1280)**: vertical spine in col1; selected-node readout + Act/Inspect/Go in
  col2; Disagreement Points pane in col3. The handoff's desktop axis under the columns
  (TL4, `07-argument-timeline.md:281-390`) is an OPTIONAL later enhancement, not required
  scope here.

The room shell chooses vertical vs horizontal via a band default and/or an explicit
operator choice. **Horizontal stays the default until vertical proves parity** (tests +
browser smoke). The mode switch is purely a rendering choice — it never changes room /
submit / seat / chime-in semantics.

## 6. Accessibility plan (invoke `accessibility-targets`)

- **Touch targets**: every node marker keeps >=44x44 effective area
  (`TIMELINE_NODE_SIZE = 44`, `argumentGameSurfaceModel.ts:784`); small affordances use
  `hitSlop` (`TOUCH_TARGET.hitSlopAll`), as the info icon does today
  (`ArgumentTimelineMap.tsx:401`).
- **Keyboard (web)**: keep the single-Tab-stop roving model but remap arrows for a
  vertical axis — ArrowDown = newer, ArrowUp = older, ArrowLeft/Right = across branch
  lanes, Home/End = Opening/latest, Enter = open detail, Escape = close overlay. Reuse the
  `resolveTimelineNavEffect` effect shape; the #751 model
  supplies the up/down/left/right neighbor lookups.
- **Color independence**: branch / junction / state carried by geometry + text, never
  color alone (per `timeline-grammar`).
- **Reduce-motion**: vertical auto-scroll + glow shadow gated by the existing
  `effectiveReducedMotion` read (`ArgumentTimelineMap.tsx:543`).
- **Screen reader**: reuse `buildNodeAccessibilityLabel` and
  `buildWholeRailAccessibilityLabel` (plain language, no verdict tokens); update the
  whole-rail phrasing to describe top-to-bottom ordering.

## 7. Test strategy

- **Pure model** (002): `y` monotonic by ordinal; lane→`x`; transpose parity vs the
  horizontal model (same ids/order); `scrollHeight`; band y-ranges; neighbor lookups at
  edges; empty input; determinism. Mirrors `__tests__/argumentTimelineMap.test.ts`.
- **Parity** (003): a feature-parity table asserting every row of §3 has a vertical
  equivalent.
- **Component** (003): render a fixture room; assert testIDs preserved
  (`timeline-node-*`, `timeline-prev/next/jump-latest/jump-root/toggle-mode`); the
  Disagreement "View in timeline" jump lands on the right node.
- **A11y**: grayscale snapshot, keyboard-effect table, 44x44 targets, reduce-motion
  snapshot.
- **Ban-list**: no winner/loser/score/verdict/truth/heat/popularity + no snake_case
  classifier keys over rendered strings (reuse the `uxBoardRail002Topology` pattern).
- **Web build**: any asset-path change proven by `npm run web:build` (jest mocks asset
  requires, so jest alone is insufficient — per repo memory) + 390/768/1440 parity.
- Invoke `test-discipline`, `timeline-grammar`, `cdiscourse-doctrine`,
  `accessibility-targets`, `expo-rn-patterns`.

## 8. Phased DAG

1. **#751** — pure-TS vertical layout model (file/design only).
2. **Fixture / story / dev render** of the vertical model (no production wiring) — may fold
   into the first commit slice of 003.
3. **#752** — component implementation (only after 001 + 002).
4. **Responsive switch / operator choice** — how the room picks vertical vs horizontal
   (band default and/or explicit toggle); horizontal stays default until parity proven.
   Folded into 003 unless it grows.
5. **Browser smoke** — `npm run web:build` + Claude_Preview / Netlify parity at
   390 / 768 / 1440.
6. **Optional later** — #753 read-only history/replay
   (scrub-to-moment). Separate feature, confirmed by handoff `07-argument-timeline.md`
   TL1-TL4; NOT a dependency of the vertical-rendering work.

## 9. Reference-copy note

The v4 handoff (`07-argument-timeline.md`, `08-component-inventory.md`) is feature / IA /
interaction reference only — not a copy source. Any user-facing copy in the vertical mode
reuses canonical repo strings ("Responding to this point", "View in timeline →",
"Opening", "Off-thread", "First clash") or original repo-native wording. Reference lines
such as "navigating the history of a disagreement" are not lifted verbatim.
