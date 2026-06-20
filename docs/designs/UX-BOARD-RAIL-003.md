# UX-BOARD-RAIL-003 — Disagreement Points distribution-segment navigation

Issue: #728
Branch: `feat/UX-BOARD-RAIL-003-segnav`
Scope: **DisagreementPointsRail only.** Make the distribution strip a local
navigation control. No board topology, mediator derivation, room semantics, or
submission change.

## Problem

`DisagreementDistributionBar` rendered a `View` per state segment (flex-weighted
by count) plus a text legend, but the segments were purely visual — there was no
way to act on them. A reader scanning the composition strip and wanting to find,
say, the structured-impasse points had to hunt the row list manually.

## What this card does

Turns the distribution strip into a **local navigation control** over the rail's
own row list. The strip stays a structure composition (priority-ordered, counts
subordinate); it gains interaction, not ranking.

### Behavior implemented: FOCUS + SCROLL (not a hard filter)

1. **Segments + legend items become pressable navigation.** Each distribution
   segment and each legend item is now a `Pressable` (`accessibilityRole="button"`,
   `accessibilityState={{ selected }}`). The bar segments carry
   `TOUCH_TARGET.hitSlopAll` (the 18 px bar → ≥44×44 effective); each legend item
   wraps in a `minHeight: 44` Pressable with `hitSlopCompact`.
   - a11y label, unselected: `Jump to <plainLabel> points: <count> of <total>`
     (bar) / `Jump to <plainLabel> points` (legend).
   - a11y label, selected: `Showing <plainLabel> points…`.
   - Labels use the ban-list-clean `plainLabel` (never the snake_case
     `displayState`), so the screen-reader name names navigation, never a score.

2. **Selecting a segment focuses the group and jumps the list.** A local
   `selectedSegment: V4MediatorStateCode | null` state is added to the rail. On
   press:
   - `selectedSegment` is set;
   - the first live point whose `v4DisplayStateFor(state) === displayState` is
     found (chronological order preserved — `firstMatchingPointId`);
   - the rail's **own** `ScrollView` (testID `disagreement-points-rail-scroll`)
     scrolls to that row via a `ScrollView` ref + per-row vertical offset captured
     through `onLayout` on each row wrapper → `scrollRef.current.scrollTo({ y,
     animated: !reducedMotion })`;
   - `showAll` is set so a matching point past the initial 6-row cap is revealed
     and reachable.
   - This is a **focus / group anchor, NOT a hard filter** — every row stays
     mounted.

3. **Non-color-only selected / in-focus treatment.**
   - The selected **segment** gets a top accent rule (`borderTopWidth: 2`) AND a
     `▸` glyph prefixing its count; the selected **legend** entry gets a bottom
     underline rule AND a `▸` glyph. Geometry + text, never color alone.
   - A **header anchor line** `Showing: <plainLabel>` (testID
     `disagreement-points-rail-showing`, `accessibilityRole="header"`) names the
     focused group as text.
   - Each **matching row** widens its left accent rule (`activeBarInViewWidth`,
     muted fill) and renders a `▸ In view` text marker (testID
     `disagreement-points-rail-inview-<id>`). A row that is also the active node
     keeps its focus-ring active bar precedence.

4. **"Show all points" reset.** A dashed-border `Pressable` (testID
   `disagreement-points-rail-show-all`, label `Show all points`) clears
   `selectedSegment` (→ every row reads as in view again) and returns the rail to
   the top. The anchor row + reset are absent on the default all-points baseline,
   so the calm default is unchanged. Collapsing the rail also clears the
   selection.

5. **Reduced motion.** The scroll uses `animated: !effectiveReducedMotion`, so a
   reduce-motion reader gets a non-animated jump; selection + markers still apply.

### What is unchanged (preserved invariants)

- **Priority order, never count-rank.** Segments still render in
  `V4_PRIMARY_STATE_PRIORITY` order (`buildDisagreementDistribution` untouched).
- **Counts subordinate.** No rank / percentage / "#1" copy; the count is a
  trailing detail on each segment + legend item.
- `onJump` "View in timeline →" row action, the per-point state badges, the
  "Move forward:" lead-in, the impasse / bridge / evidence rows, and the empty /
  unavailable states are all unchanged.
- The dormant chime-in slot stays inert (no marker without `contributionKind`).
- Sheet (phone) vs pane (tablet/wide) presentation is preserved; segment nav
  works in both.

## Files changed

- `src/features/mediator/DisagreementPointsRail.tsx` — `selectedSegment` state,
  `scrollRef` + `rowOffsetsRef`, `firstMatchingPointId` / `handleSegmentPress` /
  `handleShowAll` / `selectedSegmentLabel`, pressable bar + legend, the
  `Showing:` anchor + `Show all points` reset, per-row `inSelectedSegment` +
  `onMeasureOffset` wiring + the "In view" marker, and the supporting styles.
- `src/features/mediator/mediatorRailCopy.ts` — 3 new ban-list-clean copy atoms:
  `showAllPoints`, `showingPrefix`, `inViewMarker`.
- `__tests__/uxBoardRail003SegmentNav.test.tsx` — new suite (20 tests).

## Doctrine self-check (cdiscourse-doctrine)

- §1 score ≠ truth: the strip is a structure navigator; no verdict/score/rank
  copy was introduced. Ban-list scan over all rendered rail copy (incl. a
  selected state) is clean; a11y labels are jump verbs.
- §2/§3 heat / popularity: ordering stays structural priority; counts stay
  subordinate; nothing reads as magnitude/heat/engagement.
- a11y: every new interactive element has role + label + state; ≥44×44 targets;
  selected state is geometry + text, never color alone; reduce-motion honored.
- No board topology / `RoomBoardLayout` / `ArgumentGameSurface` /
  `deriveRoomMediatorBoardState` / `v4DisplayStateFor` / submit / persistence /
  Supabase / Edge / package change. Single derivation stays single (the rail is a
  pure consumer; the scroll model touched is the rail's OWN ScrollView).

## Gates

- `npm run typecheck` — exit 0.
- `npm run lint -- --max-warnings 0` — exit 0.
- `npm run test` — exit 0; 840 suites / 31,782 tests (31,781 passed, 1 pre-existing
  skipped); +1 suite / +20 tests over the QUICK-BRAND-LOCKUP-003 baseline
  (839 / 31,762).
- `npm run web:build` — exit 0; bundle produced (768 modules).
