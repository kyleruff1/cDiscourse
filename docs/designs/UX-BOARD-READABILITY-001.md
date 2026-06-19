# UX-BOARD-READABILITY-001 — mediator board readability + density polish

Issue: #718
Status: implemented
Scope: signed-in argument-room readability / density polish ONLY — surface-local
style / spacing / copy-presentation. NO topology, NO room / mediator / submit
semantics, NO rail navigation, NO data / API change.

## Root cause

Inverted type hierarchy: on every room surface the most load-bearing text was the
*smallest*. The room title (the primary heading) was 13/14/15px — smaller than
body copy. The selected node's own body excerpt was 11px / 1-line — smaller and
dimmer than the kind label above it. The DisagreementPointsRail section header was
11px all-caps — the same 11px as the rows beneath it, so there was no title-vs-row
hierarchy. Timeline node micro-labels were 8–9px.

The fix raises the load-bearing text and quiets metadata, with zero topology /
semantics / data change. All changes are surface-local literals or re-points to
EXISTING design tokens (no token-value mutation, no new token).

## Mapping (old → new)

### Room chrome — `src/features/debates/DebateDetailHeader.tsx`
- `titleFontSize` 13/14/15 → **16/17/18** (phone/tablet/wide), file-local literals.
- `styles.title` gains explicit `lineHeight: titleFontSize + 6` for stable
  single-line centring.
- `containerPaddingVertical` (4/6/8) + `rowMinHeight` (36/38/42) **UNCHANGED** —
  the strip-height cap arithmetic (≤48/56/64, pinned by
  `uxOneOneTwoCompactStripHeight`) still holds; the 16–18px title fits the row.
- Phone `chipFontSize` 10 → **11**.
- Leave glyph `chipFontSize+2 → +3`; Leave label `chipFontSize → +1`.

### Disagreement rail — `src/features/mediator/DisagreementPointsRail.tsx`
- `title` → re-point to `popoutHeading` (13/18), drop `textTransform:'uppercase'`
  + `letterSpacing`. Header composed string `'Disagreement points · N total'`
  byte-identical (sourced from `DISAGREEMENT_POINTS_RAIL_COPY`).
- `header.marginBottom` xs → s.
- `nextStep` → `popoutBody` (12/16). `jumpHint` / `evidenceLine` /
  `blockedPathLine` / `activeWord` badgeLabel(10) → `chipLabel`(11), with explicit
  lineHeights on the wrapping lines.
- `rowMain` padding s(8) → m(12), gap 2 → xs(4).
- `distributionBar` height 14 → 18; `distributionWrap.marginBottom` xs → s.
- `expandedRootPane` border block (borderLeftWidth `BORDER_WIDTH.sm` +
  borderTopWidth 0) **intact** (uxBoardRail002Topology).

### Selected-node centre — `src/features/arguments/TimelineSelectedReadoutPanel.tsx`
- `bodyLine` 11 → **13**, lineHeight 18, color `#cbd5e1 → #e2e8f0`,
  `numberOfLines` 1 → **2** (relaxed-with-NOTE, see below).
- `kindLine` demoted to an eyebrow (`#e2e8f0 → #94a3b8`), lineHeight 16.
- `parentExcerptLine` `#cbd5e1 → #94a3b8`, lineHeight 15 (now clearly smaller than
  the 13px body).
- `compactBody.gap` 1 → 3; explicit lineHeights on meta / acting lines.
- 5 line-style names (kind/body/parent/meta/acting), `panel marginTop:8`, no
  `flexDirection:'row'`, no rail import — all preserved (uxSelectedNode001). Copy
  `'Responding to this point'` / `'Go to parent point'` byte-identical.

### Mediator inspect — `MediatorNodeInspectDetail.tsx` / `SelectedNodeInspectDrawer.tsx`
- `stateLabel` chipLabel(11) → `popoutHeading`(13/18) + marginBottom xs so the
  lead reads louder than its 12px helper.
- Drawer `section.marginBottom` s → m.

### Mediator readout — `src/features/arguments/ArgumentScoreTracker.tsx`
- `title` 10 → 11, drop `textTransform:'uppercase'` (renders the EXISTING string
  `'Mediator readout'` sentence-cased; visible string + aria `'mediator readout'`
  byte-identical, only the style is dropped). `marginBottom` 6 → 8.
- `root` padding 8 → 10; `card.minWidth` 160 → 180; `cardBody` padding 8 → 10;
  `row.gap` 6 → 8; band/meta gain explicit lineHeight + marginTop 2 → 4.

### Timeline — `src/features/arguments/ArgumentTimelineMap.tsx`
- `junctionPillText` / `rootMarkerPillText` / `firstClashPillText` /
  `detachedPillText` 9 → **11** (pill paddingV 2 → 3; letterSpacing 0.4 → 0.2).
- `chipText` 8 → **10** (chip paddingH 4 → 5 / V 1 → 2).
- `bandLabel` 10 → **11**. `timestampLabel` color `#64748b → #94a3b8`.
- Presentation-only relabels: root pill `Root → Opening`; detached pill
  `detached → Off-thread`. Model band label + node a11y strings UNCHANGED.
- Band overlay `opacity` left at **0.6** — pinned by
  `uxOneOneTwoChromeLayerRemovals` (not an authorized relaxation for this card);
  the fontSize lift carries the readability win. See "Implementer note" below.
- ≥6 `TOUCH_TARGET.hitSlopAll` sites + per-node info-icon hitSlop preserved; no
  `left:4,right:4` reintroduced (uxMobile001).

### AIG dock — `src/features/arguments/ArgumentGameSurface.tsx`
- `menuTriggerRow.paddingBottom` 4 → 8 (even rhythm). `menuTriggerBadgeText`
  10 → 11. `styles.body` paddingHorizontal/Bottom 8 → 12.
- `board-menu-trigger-*` testIDs + Act/Inspect/Go labels/routing + col1/col2 JSX
  order verbatim; board state derived ONCE.

### Layout — `src/features/arguments/RoomBoardLayout.tsx`
- Additive interior gutter `paddingHorizontal: 12` on `spineColumn` /
  `spineColumnWide` / `readoutColumn` (tablet/wide only; phone branch returns
  first and is untouched). `paneColumn` width 380 + 1px `columnDivider`
  UNCHANGED (uxBoardRail002Topology).

### Bubble card — `src/features/arguments/ArgumentBubbleCard.tsx`
- `timeRelative` / `badgeText` / `sidePillText` / `latestPillText` 10 → 11.

## Relax-with-NOTE rationale (the two authorized boundary relaxations)

1. **`DebateDetailHeader.tsx`** was a zero-diff entry in
   `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts`. Removed the path + added a
   dated NOTE citing this card, mirroring the existing AppHeader / designTokens /
   ArgumentTimelineMap / ArgumentScoreTracker / TimelineSelectedReadoutPanel
   relaxations. Justified: the room title is the surface's primary heading yet was
   its smallest text; the edit is surface-local style only and the strip-height
   cap (the one pinned dimension) is held by the unchanged padding/minHeight
   literals. The file's load-bearing contract stays pinned by
   `uxOneOneTwoCompactStripHeight`, `uxOneOneSixReadOnlyBoundary` (testID /
   API-presence), and `uxBoardRail002Topology`.

2. **`uxOneOneTwoReadoutCompactMode.test.tsx`** pinned the selected-node
   `bodyLine numberOfLines={1}`. Relaxed to `{2}` with a dated NOTE. Justified:
   the node body is the readable centre of the room and is the card's root-cause
   surface; 1 line at 11px was the inverted-hierarchy bottom. `ellipsizeMode="tail"`
   is preserved, the panel margins + 5 line-style names are unchanged.
   (`TimelineSelectedReadoutPanel.tsx` itself is already NOTE-relaxed out of the
   `uxOneOneFive` array.)

## Implementer note — one brief item adjusted to a pre-existing pin

The brief listed an *optional* band-overlay `opacity` 0.6 → 0.75 bump on
ArgumentTimelineMap. That inline opacity is pinned by
`uxOneOneTwoChromeLayerRemovals.test.ts:133` ("bands overlay the rail with reduced
opacity"), which is NOT one of this card's operator-authorized relaxations. Rather
than open an unlisted third boundary relaxation, the opacity was left at 0.6; the
`bandLabel` fontSize lift (10 → 11) delivers the readability improvement. No other
brief item required adjustment.

## Tests

- NEW `__tests__/uxBoardReadability001.test.tsx` (27 tests) pins the readability
  contract: room title ≥16 per band; selected-node bodyLine ≥13 + numberOfLines 2;
  rail title distinct tier from row guidance; old game copy absent (comment-stripped
  scan) + 'Mediator readout' present; ban-list / snake_case scan over the changed
  visible strings; topology (pane 380 + divider) intact; Act/Inspect/Go reachable;
  rail mounted; no NodeLabelStrip JSX; bubble micro-type ≥11.
- Relaxed (with NOTE) `uxOneOneFiveReadOnlyBoundary` (DebateDetailHeader entry) and
  `uxOneOneTwoReadoutCompactMode` (numberOfLines 1 → 2). No other assertions
  weakened.

## Doctrine self-check

- No winner/loser/score/scoreboard/verdict/truth/fallacy/popularity/ranking copy
  introduced; the rail stays a STRUCTURE board, distribution bar a composition
  roll-up, impasse gold-not-red, color-independence preserved (left accent bar +
  'Currently active' word + text legend).
- 'Mediator readout' (+ aria) and the byte-identical pinned copy strings unchanged.
- Plain-language: 'Root' → 'Opening', 'detached' → 'Off-thread' are user-facing
  plain-language wins; model/classifier/a11y strings unchanged.
- No AI provider call, no Supabase write, no service-role, no migration, no Edge,
  no dependency change. Sign In / AuthScreen untouched.
