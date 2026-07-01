# VISUAL-SIMPLIFY-001 — Collapse the active-card hub to message + ≤3 flags + ≤1 advisory line

**Status:** Design draft
**Card:** VISUAL-SIMPLIFY-001 (GitHub issue #844)
**Roadmap:** PRODUCT-REDIRECT-001 (epic #826)
**Release:** UI / UX only
**Baseline:** main @ 58e5aab (VISUAL-SIMPLIFY-002 #856; includes UX-FLAGS chain #833/#834/#835, band-neutral default #846, analysis-drawer default-hidden #845)

## Goal

The default room view is apparatus-first. The ACTIVE card in the stack mounts
`src/features/arguments/cardView/CardDetailPanel.tsx`, an exploded Inspect-style
hub that renders roughly thirteen always-visible zones (parent bubble, referee
card, current-message body, step reference, category/qualifier chips, Standing /
Tone / Heat strip, evidence zone, standing zone, lifecycle zone, actions zone,
uncapped classifier hub grid, combination-observations zone, notes/tags columns).
Standing appears four times, evidence three times, and next-move guidance three
times across that one card. The reader meets analysis before they meet the
message.

This card **collapses the active card by default** so it leads with the message,
at most three friendly flags, and at most one advisory line. Standing, evidence,
and next-move guidance each appear exactly once in the default render. Everything
else keeps its machinery and its zone components but moves behind ONE opt-in
expansion (a calm "More detail" disclosure). Nothing is deleted; visibility is
re-scoped.

Doctrine anchors that constrain the change (cdiscourse-doctrine):
- **§1** — the surviving advisory line and the flag row are verdict-free plain
  language; the expansion toggle is not a verdict, importance, or score cue.
- **§9 / §10a** — the expansion still routes every family heading and observation
  through the existing plain-language funnels; no raw `family` / `rawKey` /
  snake_case leaks into the default OR the expanded render.
- **Reuse the shipped flag surface** — the flag row is `PointFeedbackFlagsRow`
  fed by `buildPointFeedbackFlags` + `prioritizePointFeedbackFlags`. No second
  flag renderer is invented; the feedbackFlags modules are consumed as-is and
  are NOT edited.
- **Compose with #845 / #846** — the analysis-drawer selector (#845) and the
  band-neutral default (#846) are untouched; this card is the CARD-LEVEL
  density collapse that sits beneath them.

## Data model

**No new persisted data model. No migration. No Edge Function change.**

One local UI state field is added to `CardDetailPanel` (the collapsed/expanded
disclosure):

```ts
const [detailExpanded, setDetailExpanded] = useState(false); // default collapsed
```

One additive optional prop is added to `CardDetailPanel`, `ArgumentBubbleCard`,
and `ArgumentBubbleStack` to thread the already-computed prioritized feedback
flags from the surface into the collapsed card (mirroring the `activeCardDetail`
pass-through). It carries the SHIPPED view-model type — nothing new is defined:

```ts
// PrioritizedPointFeedbackFlags is the shipped #835 return type.
import type { PrioritizedPointFeedbackFlags } from '../feedbackFlags/feedbackFlagPriority';

/** VISUAL-SIMPLIFY-001 — prioritized (≤3 + suppressedCount) friendly feedback
 *  flags for the ACTIVE point, computed ONCE at the surface. Omitted → the flag
 *  row renders nothing (calm default), byte-equivalent for direct-render tests. */
pointFeedbackFlags?: PrioritizedPointFeedbackFlags | null;
```

Rationale for threading rather than re-deriving: `ArgumentGameSurface` already
computes `activePointFeedbackFlags` (a `PrioritizedPointFeedbackFlags`) via the
exact #834/#835 wiring and consumes it in the timeline-path
`PointFeedbackFlagsRow`. Reusing that single derivation keeps the flag list
identical across surfaces and avoids re-reading `persistedObservationsByArgumentId`
inside the card. The stack path forwards it to the active card only, exactly like
`activeCardDetail`.

## Section map — the current card (file:line) + duplicate sites

All references are `src/features/arguments/cardView/CardDetailPanel.tsx` unless
noted. The panel renders (top → bottom) in the stacked layout reading order:

| # | Zone | Component / testID | Line |
|---|---|---|---|
| 1 | Parent "replying-to" comparison bubble | `ParentComparisonBubble` / `card-detail-parent-bubble-slot` | 1017-1022 (fn 430-524) |
| 2 | Synthesized Referee Card | `RefereeCardView` / `card-detail-referee-card-slot` | 1029-1038 |
| 3 | Current-message body ("Your move") | `card-detail-current-message-zone` / `-body` | 749-762 |
| 4 | Step reference (parent nav token) | `CardStepReferenceHeader` / `card-detail-step-reference` | 765-769 |
| 5 | Category + qualifier chips | `card-detail-category-zone` | 772-781 |
| 6 | Standing / Tone / Heat strip | `StandingToneHeatZone` / `card-detail-sth-zone` | 785-787 (fn 531-554) |
| 7 | Evidence sources + debt | `card-detail-evidence-zone` | 790-808 |
| 8 | Point-standing label | `card-detail-standing-zone` | 811-820 |
| 9 | Lifecycle label | `card-detail-lifecycle-zone` | 823-830 |
| 10 | Actions on this point | `ActionsZone` / `card-detail-actions-zone` | 839-846 (fn 637-700) |
| 11 | Uncapped classifier hub grid | `HubClassifierZone` / `card-detail-classifier-zone` | 876 (fn 252-304) |
| 12 | Combination observations | `CombinationObservationsZone` / `card-detail-mapping-zone` | 881-883 (fn 366-399) |
| 13 | Semantic flags ("Notes") + full doctrine-grouped Tags | `TagsColumn` / `card-detail-flags-zone` + `card-detail-full-tags-zone` | 903-918 (fn 893-921) |

**Standing — 4 sites in the default card:**
1. S/T/H strip standing chip — `card-detail-standing-band`, line 542.
2. Standing zone label — `card-detail-standing`, lines 811-820.
3. Referee Card Zone 1 (the "what this move is doing" state readout is
   standing-adjacent) — `RefereeCardView`, line 1031.
4. Standing also reaches the reader via the timeline-path `PointFeedbackFlagsRow`
   band framing (`ArgumentGameSurface.tsx:2482`) — a sibling surface, not the
   card, but it is the 4th standing exposure the reader sees in the room.

**Evidence — 3 sites in the default card:**
1. Evidence zone — sources + debt summary, `card-detail-evidence-zone`, lines 790-808.
2. Referee Card Zone 2 ("what remains open" — surfaces evidence-debt burden),
   `RefereeCardView`, line 1031.
3. Classifier hub + combination zones surface evidence-adjacent family
   observations (Family D receipt/source signals), lines 876 + 881.

**Next-move — 3 sites in the default card:**
1. Actions on this point — `ActionsZone` chips, lines 839-846.
2. Referee Card Zone 3 — the 2-3 constructive next moves (`onRefereeMove`),
   `RefereeCardView`, line 1031.
3. Advisory captions on the classifier + mapping zones ("What the referee
   noticed — advisory, not a verdict") frame a next-move nudge, lines 267 + 380.

## Collapsed default spec — kept sections + survivors + justification

The collapsed default render (when `detailExpanded === false`) mounts EXACTLY:

1. **Parent context** — the `ParentComparisonBubble` (zone 1) stays. It is the
   "what am I answering" anchor, not analysis; the message is unreadable without
   it. Degrades to nothing for a root parent (unchanged).
2. **The message** — the "Your move" current-message body (zone 3) plus the step
   reference nav token (zone 4). This is the point of the card.
3. **ONE compact metadata line** — a single new compact line that folds the
   category label + first qualifier + lifecycle label into one plain-language
   row (`card-detail-compact-meta`, `accessibilityRole="text"`, display-only).
   It REPLACES the standalone category-zone chips (zone 5), lifecycle zone (zone
   9), and Standing/Tone/Heat strip (zone 6) in the default view. Standing is
   deliberately NOT in this line (see survivor choice below).
4. **The capped friendly-flag row** — `PointFeedbackFlagsRow` fed the shipped
   prioritized `{ visible, suppressedCount }` (≤3 pills + "+N more"). This is the
   single de-duplicated standing/observation surface for the default card.
5. **≤1 advisory line** — ONE advisory sentence. The survivor is the Referee
   Card's Zone-2 open-issue line, rendered as a single compact advisory `<Text>`
   via a new lightweight `card-detail-advisory-line` (NOT the full three-zone
   `RefereeCardView`, which moves into the expansion). When no referee issue is
   derived, this line renders nothing (calm default).

Below the message, kept order is: parent bubble → message + step ref → compact
meta line → flag row → advisory line → the ONE expansion toggle.

**Survivor choices (the ONE that stays; the rest render only in the expansion):**

- **Standing survivor = the friendly-flag row (#4).** The flag row is the
  product's chosen calm standing/observation surface and is already the
  de-dupe target the wave-2 chain built toward. The S/T/H strip standing chip
  (site 1) and the Standing zone label (site 2) move into the expansion; the
  Referee Card state readout (site 3) moves into the expansion with the full
  card. Justification: doctrine §1 wants standing framed as advisory game
  standing, and the flag descriptors already encode that framing without a
  band grid; #846 made the timeline band-neutral for the same reason.
- **Evidence survivor = the advisory line (#5) when it carries an evidence
  burden, else the expansion's Evidence zone.** The default view does not render
  a standalone Evidence zone; the single advisory line surfaces the open
  evidence burden when one exists (Referee Zone-2 already phrases it). The full
  Evidence zone (sources + debt) renders in the expansion. Justification: the
  reader needs to know "a source is owed here" once, not a full source ledger,
  in the default view.
- **Next-move survivor = the advisory line (#5).** ONE advisory line is the
  next-move nudge in the default view. The full `ActionsZone` (user-move chips)
  and the Referee Zone-3 move buttons render in the expansion. Justification:
  the card note caps the default at ≤1 advisory line; the user's full move set
  lives on the side rail (`ArgumentSideActionRail`) and inside the expansion —
  the default card is for reading, not for a move palette.

The compact meta line, flag row, and advisory line are the only additions; all
other default-view reductions are achieved by gating existing zones behind
`detailExpanded`.

## Expansion spec — affordance + contents

**Affordance:** ONE Pressable disclosure toggle, mounted after the advisory line
in both layouts. Modeled byte-for-behavior on the shipped `PointFeedbackFlagsRow`
"why?" toggle (same repo disclosure pattern; `accessibilityState={{ expanded }}`
is already used across 12 argument-surface files).

- **Copy (collapsed):** `More detail`
- **Copy (expanded):** `Hide detail`
- **testID:** `card-detail-more-toggle`
- **a11y:** `accessibilityRole="button"`, `accessibilityState={{ expanded: detailExpanded }}`,
  `accessibilityLabel={detailExpanded ? 'Hide detail' : 'More detail'}`,
  `hitSlop={TOUCH_TARGET.hitSlopAll}` so the small visual clears ≥44×44. Web
  focus ring via the `Platform.OS === 'web' && state.focused` pattern already in
  `PointFeedbackFlagsRow`.
- **Reduce-motion:** the expanded block SNAPS open/closed — no `Animated`, no
  `LayoutAnimation`. Reduce-motion safe by construction (matches the shipped
  disclosure precedent).
- **Copy is verdict-free / ban-list clean** — "More detail" carries no
  importance / severity / score / winner framing.

**Contents (render only when `detailExpanded === true`), unchanged components:**
- Referee Card — `RefereeCardView` (zone 2), full three-zone card incl. Zone-3
  moves + REF-004 nav verbs.
- Standing / Tone / Heat strip — `StandingToneHeatZone` (zone 6).
- Evidence zone — sources + debt (zone 7).
- Standing zone — `card-detail-standing-zone` (zone 8).
- Lifecycle zone — `card-detail-lifecycle-zone` (zone 9).
- Actions on this point — `ActionsZone` (zone 10).
- Uncapped classifier hub grid — `HubClassifierZone` (zone 11).
- Combination observations — `CombinationObservationsZone` (zone 12).
- Notes + full doctrine-grouped Tags — `TagsColumn` (zone 13).
- Full category/qualifier chip row (zone 5) — so the expansion is the complete
  superset and nothing is lost vs today.

The 3-column wide layout still applies INSIDE the expansion (tags · centerpiece
· classifier), so the wide reading order is preserved when expanded. The
collapsed default is always a single stacked column (message-first), regardless
of viewport, because the collapsed set is short.

**Family-heading funnel invariant:** every zone in the expansion already routes
family headings + observation labels through the shipped plain-language layer
(`markToChip` / `friendlyFlagMap` / `toPlainLanguage`). This card does not add a
raw-code render path; the source-scan doctrine test asserts no `family_` /
`rawKey` snake_case in either render.

## Flag-row wiring (exact usage, mirroring the #834 surface integration)

The surface already owns the derivation (`ArgumentGameSurface.tsx:1235-1242`):

```ts
const activePointFeedbackFlags = useMemo(() => {
  if (!activeMessageId) return prioritizePointFeedbackFlags([]);
  const rows = persistedObservationsByArgumentId?.[activeMessageId] ?? [];
  const built = buildPointFeedbackFlags(rows, {
    isOwnPoint: activeViewModel?.actor === 'self',
  });
  return prioritizePointFeedbackFlags(built);
}, [activeMessageId, persistedObservationsByArgumentId, activeViewModel?.actor]);
```

VISUAL-SIMPLIFY-001 does NOT re-derive. It forwards `activePointFeedbackFlags`
into the stack path (mirroring `activeCardDetail`):

- `ArgumentGameSurface` → `<ArgumentBubbleStack pointFeedbackFlags={activePointFeedbackFlags} … />`
  (new additive prop next to `activeCardDetail`, ~1 line at the existing
  `<ArgumentBubbleStack>` mount, `ArgumentGameSurface.tsx:2346`).
- `ArgumentBubbleStack` → `<ArgumentBubbleCard pointFeedbackFlags={t.isActive ? pointFeedbackFlags : null} … />`
  (active card only, same gating as `cardDetail`).
- `ArgumentBubbleCard` → `<CardDetailPanel pointFeedbackFlags={pointFeedbackFlags} … />`.
- `CardDetailPanel` renders the row in the collapsed default:

```tsx
{pointFeedbackFlags && pointFeedbackFlags.visible.length > 0 ? (
  <PointFeedbackFlagsRow
    flags={pointFeedbackFlags.visible}
    suppressedCount={pointFeedbackFlags.suppressedCount}
    testID="card-detail-feedback-flags"
  />
) : null}
```

`buildPointFeedbackFlags`, `prioritizePointFeedbackFlags`, and
`PointFeedbackFlagsRow` are imported/consumed exactly as in #834; the
feedbackFlags modules themselves are NOT edited. The row already caps at ≤3 +
"+N more" and renders `null` for an empty list (calm default holds).

## Boundary-test relaxation

**None needed.** None of the four files this card edits are pinned to a zero-diff
boundary:
- `CardDetailPanel.tsx`, `ArgumentBubbleCard.tsx`, `ArgumentBubbleStack.tsx` are
  absent from `uxOneOneFiveReadOnlyBoundary.test.ts` READ_ONLY_PATHS and from
  `uxOneOneSixReadOnlyBoundary.test.ts`.
- `ArgumentGameSurface.tsx` appears in `uxOneOneSixReadOnlyBoundary.test.ts` only
  as an `requiredApi: ['ArgumentGameSurface']` API-presence pin (line 89-90),
  NOT a zero-diff pin; the additive prop preserves the exported component API, so
  the pin still holds.

**Doctrine scanner (`uxOneOneTwoDoctrine.test.ts`):** `ArgumentGameSurface.tsx`
IS scanned by this suite's `STRING_RE` quote-parity extractor. The prop-threading
edit there MUST use apostrophe-free comments with balanced backticks/quotes (the
landmine that bit the last card). `CardDetailPanel.tsx` / `ArgumentBubbleCard.tsx`
/ `ArgumentBubbleStack.tsx` are NOT in that suite's `UX_001_2_FILES`, but I will
apply the apostrophe-free rule to all new comments regardless. Run
`npm run test -- uxOneOneTwoDoctrine` before pushing.

## Test audit

Enumerated cardView + surface test files, each classified UPDATE vs PRESERVE:

- `__tests__/CardDetailPanel.test.tsx` — **UPDATE.** Lines 86-97 assert
  `card-detail-classifier-zone / evidence-zone / standing-zone / lifecycle-zone /
  flags-zone` are present by default. Flip to: default render → these are
  `queryByTestId(...)` null; after pressing `card-detail-more-toggle` →
  `getByTestId(...)` truthy. The PIPS test (99-106) stays but its zone is now
  inside the expansion (open first).
- `__tests__/CardDetailHubPanel.test.tsx` — **UPDATE.** Hub grid / mapping /
  S-T-H-strip assertions move behind the expansion; open then assert.
- `__tests__/cardDetailComparisonLayout.test.tsx` — **PARTIAL UPDATE.** The
  parent-bubble + centerpiece + reading-order assertions PRESERVE (parent bubble
  and message stay in the default). Any assertion that a demoted zone renders in
  the default flips to open-first.
- `__tests__/cardViewRefine.test.tsx` — **UPDATE.** `ActionsZone` assertions move
  behind the expansion (open first). The actor-aware move-set logic is unchanged.
- `__tests__/CardMappingSection.test.tsx` — **PRESERVE (zone unit tests).** These
  exercise `CombinationObservationsZone` / `CombinationObservationChip` shape and
  the mapping model directly; the component is unchanged, so they render the zone
  in isolation and stay green. (If any test renders through the full panel and
  expects the zone by default, open the expansion first — audit at implement.)
- `__tests__/argumentDetailParity.test.ts` — **PRESERVE (model parity).** Pure
  model parity; no default-visibility assertion.
- `uxOneOneFiveReadOnlyBoundary.test.ts` / `uxOneOneSixReadOnlyBoundary.test.ts`
  — **PRESERVE.** No relaxation needed (see boundary section); both stay green.
- `uxOneOneTwoDoctrine.test.ts` — **PRESERVE.** Stays green iff the
  `ArgumentGameSurface` comment edits are apostrophe-free / quote-balanced.

Zone COMPONENT unit tests (HubClassifierZone/CombinationObservationsZone/
FullTagsZone/StandingToneHeatZone rendered directly) are untouched — the zones
still render identically INSIDE the expansion.

## New test file

`__tests__/visualSimplify001CardCollapse.test.tsx`

## Test contract

- **Default-collapsed kept set:** default render of `CardDetailPanel` (active
  card) mounts `card-detail-parent-bubble-slot` (when parent present),
  `card-detail-current-message-body`, `card-detail-step-reference`,
  `card-detail-compact-meta`, `card-detail-feedback-flags` (when flags present),
  `card-detail-advisory-line` (when a referee issue is present), and
  `card-detail-more-toggle`.
- **Default demoted set (queryBy null):** `card-detail-classifier-zone`,
  `card-detail-mapping-zone`, `card-detail-sth-zone`, `card-detail-evidence-zone`,
  `card-detail-standing-zone`, `card-detail-lifecycle-zone`,
  `card-detail-actions-zone`, `card-detail-full-tags-zone`,
  `card-detail-flags-zone`, `card-detail-referee-card-slot` are ALL null before
  the toggle is pressed.
- **Expansion mounts them all:** after `fireEvent.press(getByTestId('card-detail-more-toggle'))`
  every demoted testID above is truthy; pressing again re-collapses them.
- **Flag cap:** with >3 mapped observations the flag row shows exactly 3 pills +
  `point-feedback-flags-more` "+N more"; with 0 the row renders nothing.
- **Standing appears at most once (default):** across the default render, the
  standing surface is the flag row only — assert `card-detail-standing-band`,
  `card-detail-standing`, and `card-detail-referee-card-slot` are all absent in
  the default render (standing not duplicated).
- **Evidence appears at most once (default):** `card-detail-evidence-zone` is
  absent in the default render; the single advisory line is the only evidence-
  burden surface.
- **Next-move appears at most once (default):** `card-detail-actions-zone` and
  the Referee Zone-3 move buttons are absent in the default render; only
  `card-detail-advisory-line` remains (≤1 advisory line).
- **a11y contract on the toggle:** role `button`; `accessibilityState.expanded`
  tracks the state; hitSlop present (≥44×44); label reads "More detail" /
  "Hide detail" without a keyboard-shortcut or verdict token.
- **No raw-code leak:** source-scan the default AND expanded render strings for
  `family_` / snake_case rawKey patterns and the verdict ban-list → none.
- **Reduce-motion safe:** assert no `Animated` / `LayoutAnimation` in the toggle
  path (source-scan or render assertion mirroring the shipped disclosure test).
- **Doctrine suite green:** `uxOneOneTwoDoctrine.test.ts` passes (apostrophe-free
  surface comments).
- **Boundary suites green:** both read-only boundary suites pass with no
  relaxation.

## Design-doc outline (this file)

Goal · Data model · Section map (13 zones + 4x/3x/3x sites) · Collapsed default
spec (kept + survivors + justification) · Expansion spec (affordance + contents)
· Flag-row wiring · Boundary relaxation · Test audit · New test file · Test
contract · Dependencies · Risks · Out of scope · Doctrine self-check · Operator
steps.

## Dependencies (cards / docs / files)

- Assumes #834/#835 complete: consumes `buildPointFeedbackFlags`,
  `prioritizePointFeedbackFlags`, `PointFeedbackFlagsRow`,
  `PrioritizedPointFeedbackFlags` from `src/features/feedbackFlags/` as-is.
- Reads `ArgumentGameSurface.activePointFeedbackFlags` (already computed,
  `ArgumentGameSurface.tsx:1235`) and forwards it through the stack.
- Reuses `CardDetailPanel` zone components (`HubClassifierZone`,
  `CombinationObservationsZone`, `StandingToneHeatZone`, `FullTagsZone`,
  `ActionsZone`, `RefereeCardView`) unchanged — only their gating changes.
- Composes with #845 (analysis-drawer selector) and #846 (band-neutral default)
  without touching either.
- Does not block a named future card; #849 (raw/debug residual-leakage audit)
  benefits because the dense classifier grid leaves the default path here.

## Risks

- **Test surface is large.** `CardDetailPanel` has ~200 assertions across five
  cardView suites. The high-risk failure is a suite that asserts a demoted zone
  by default and is not migrated to open-first — enumerate every
  `getByTestId('card-detail-*-zone')` in the default-render blocks and flip it.
- **Doctrine quote-parity landmine.** Any apostrophe in a new comment in
  `ArgumentGameSurface.tsx` (e.g. `card's`) breaks `STRING_RE` and can bleed a
  banned token across literals → false-positive failure. Mitigation: all new
  comments apostrophe-free, balanced quotes/backticks; run the doctrine suite
  before pushing.
- **Wide-layout column ordering.** The 3-col wide layout must now apply INSIDE
  the expansion, not at the panel root. Verify the collapsed default is always a
  single stacked column and the wide reading order is preserved once expanded.
- **`RefereeCardView` double-surfacing.** The advisory line reuses the Referee
  Zone-2 open-issue phrasing; ensure it does not mount a second `RefereeCardView`
  (a lightweight `<Text>` derived from the same view model), matching REF-003's
  "one banner surface" invariant, so the no-second-banner pins hold.
- **`persistedObservationsByArgumentId` timing.** A late classifier result
  updates the flags after mount; since the derivation stays memoized at the
  surface, the collapsed card updates reactively via the prop — no new fetch,
  no submit-path coupling.

## Out of scope

- No edits to `src/features/feedbackFlags/` modules (consumed as-is).
- No re-work of #845's analysis-surface selector or #846's band-neutral
  mechanism (compose only).
- No deletion of any zone component or its unit tests (visibility re-scoped).
- No raw-MCP-relocation / residual-debug-leakage policy work (#849 owns that).
- No Edge Function, mcp-server, migration, config, validator, ban-list,
  familyRegistry, or prompt change.
- No provider spend, no new dependency (RN primitives + shipped tokens only).
- No composer / side-rail move-set change (the ActionsZone logic is unchanged;
  it only moves behind the expansion).

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; no
  service-role):** the toggle copy, compact meta line, flag row, and advisory
  line are all advisory plain language; no verdict token; this is a
  presentation-only re-scoping — no submit-path, no service-role, no score gate.
- **§9 / §10a (plain language; observations vs allegations):** the expansion
  keeps routing family headings + observations through the shipped plain-language
  funnels; no raw `family` / `rawKey` reaches either render; the doctrine
  source-scan test enforces it.
- **§3 (popularity is not evidence):** the flag row passes `neverGrantsStanding`
  through untouched; no engagement→standing conversion is introduced.
- **accessibility-targets:** the ONE new interactive element (the toggle) has
  role `button` + `accessibilityState.expanded` + ≥44×44 via hitSlop + reduce-
  motion-safe snap + web focus ring; color is never the only signal (the toggle
  is a labeled text control); the collapsed set keeps every string inside
  `<Text>`.
- **expo-rn-patterns:** RN primitives only (`View` / `Text` / `Pressable` /
  `useState`); reuses `TOUCH_TARGET`, `SPACING`, `SURFACE_TOKENS`, `TYPOGRAPHY`,
  `FOCUS_RING` tokens; no new dep; the disclosure mirrors the shipped
  `PointFeedbackFlagsRow` pattern rather than adding a library.
- **test-discipline:** new tests ship with the card; test count goes up; no
  `.skip` / `.only`; boundary + doctrine suites stay green.

## Operator steps (if any)

None — pure client-side UI change. No `db push`, no `functions deploy`, no env
var, no migration.

## Implementer note (as-built)

Implemented exactly per the locked design, with two small mechanical details a
reviewer should know:

1. **Wide-layout testID split.** The message-first centerpiece renders at the
   panel root in the collapsed default; the expansion also renders a centerpiece
   region (demoted zones only). To keep a single-match `getByTestId` unambiguous,
   the root region keeps `card-detail-centerpiece` (+ `-card`) and the expansion
   region uses a distinct `card-detail-centerpiece-zones` (+ `-zones-card`).
   The wide 3-column row now lives on a new `card-detail-expansion` container
   (`isThreeColumn` is additionally gated on `detailExpanded`), so the collapsed
   default panel root is always a single stacked column.

2. **#14 disclosure-regression tests flipped (intended).** VISUAL-SIMPLIFY-001
   deliberately reverses the CVDH-001 §7.1 "no disclosure on the Card" invariant
   — that is the whole point of the card. The four `cardDetailComparisonLayout`
   tests that pinned "no `accessibilityState.expanded` on the Card" and "the
   only Card buttons are navigation" were rewritten to assert the NEW intended
   behavior (the collapsed default hides the dense zones; the ONE `More detail`
   toggle carries `accessibilityState.expanded`; the expansion reveals them
   all). The separate assertion that the **Timeline** projection keeps its own
   disclosure is preserved unchanged.

3. **Test files updated beyond the design list.** In addition to the four files
   the design named, `__tests__/cardViewRefineContainmentNav.test.tsx` and
   `__tests__/CardMappingSection.test.tsx` render the demoted zones **through
   the full panel** and were migrated to open-first (press
   `card-detail-more-toggle`) per the design test-audit rule ("if a test renders
   through the full panel and expects the zone by default, open the expansion
   first"). Zone COMPONENT unit tests remain untouched.
