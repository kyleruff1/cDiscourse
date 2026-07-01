# VISUAL-SIMPLIFY-003 — Retire per-node strength bands from the default timeline

**Card:** VISUAL-SIMPLIFY-003 (GitHub issue #846)
**Roadmap:** PRODUCT-REDIRECT-001 (epic #826)
**Baseline:** main @ 1b5cc6f

## Goal

Resolve the product audit's single doctrine-adjacency flag: every default-timeline
node currently receives an AI-flag-driven strength color/glyph via `inferStandingBand`
(`src/features/arguments/argumentGameSurfaceModel.ts`), whose internal enum keys are
truth-shaped (`pretty_wrong` / `completely_right`). Even though `standingBandCopy`
softens the rendered copy, this is the closest thing to a per-message verdict in the
default UX.

This card makes the **default** timeline a plain move spine: strength/analysis lives
behind Inspect. The point card leads with the message + minimal chrome.

**The branch grammar (shape = argument type, lanes = branches, spine, rail) is PRESERVED.**
It is the DECORATION — the per-node strength band colors/glyphs driven by AI flags —
that is retired from the default path. Per the `timeline-grammar` skill, shape and lane
carry no strength meaning and stay untouched.

## Data model

No new model. Two additive optional flags, both defaulting to pre-card behavior:

- `BuildTimelineMapInput.neutralizeStandingBands?: boolean` — default `true` (the
  default caller passes nothing → band-neutral). Resolved once in
  `buildArgumentTimelineMap` as `const neutralize = input.neutralizeStandingBands !== false;`.
- `NodeAccessibilityInput.includeStandingBand?: boolean` — default `true` (back-compat:
  the strength fragment is present). The default timeline path passes `false`.

All band types, `standingBandCopy`, `STANDING_BAND_SOFT_LABEL`, and `inferStandingBand`
are KEPT. `node.standingBand` STAYS POPULATED — we neutralize default-path rendering
CONSUMPTION, not the underlying signal, so opt-in surfaces keep working with zero edits.

## Band pipeline map

### Source (KEEP — unchanged)

- `inferStandingBand` (`argumentGameSurfaceModel.ts` ~:982–1017) — deterministic, reads
  AI flag codes. Unchanged.
- Per-node `standingBand` set in `buildArgumentTimelineMap` Pass 1 and stored on the
  node. **KEEP POPULATED** — opt-in consumers read it.

### Default-path consumption NEUTRALIZED (the verdict-adjacent decoration)

1. **Edge `gradientStops` standing stop** (`argumentGameSurfaceModel.ts` Pass 5 edge
   builder) → on the default path the standing stop collapses to
   `STANDING_BAND_COLOR.unscored` (neutral grey). The 5-stop array length is preserved,
   so the `gradientStops[length-3] === child kindColor` assertion still holds and the
   kind stops at `[0]`/`[length-3]` are untouched.
2. **Pass 4c a11y label** — `buildNodeAccessibilityLabel({ includeStandingBand: !neutralize })`
   omits the strength fragment on the default path.
3. **NodeDot a11y rebuild** (`ArgumentTimelineMap.tsx` ~:297) — passes
   `includeStandingBand: false` to match the model's default so the rendered label and
   the model's stored label never drift.
4. **`buildNodeAccessibilityLabel`** (`keyboardNavigationModel.ts` ~:273) — the
   `STANDING_BAND_SOFT_LABEL[...]` push is guarded by
   `if (input.includeStandingBand !== false)`.

### NO CHANGE (correct as-is)

5. **Hot-zone `detectBands`** (`argumentGameSurfaceModel.ts`, `standingBand === 'pretty_wrong' | 'slightly_wrong'`)
   → NO CHANGE. `standingBand` stays populated, and the Hot zone is a **heat/friction
   band**, not a per-node strength verdict (doctrine §2: heat ≠ truth).

### Already band-neutral (regression-assert only, no change)

- Node dot `backgroundColor = node.kindColor` (`ArgumentTimelineMap.tsx`) — type color,
  carries no strength.
- `timelineNodeVisualModel.deriveTimelineNodeVisualStyle` — glow/halo/receipt/tone are
  documented strength-INDEPENDENT (reads no `standingBand`).
- `ArgumentBubbleViewModel` has NO `standingBand` field — the bubble stack is already
  band-neutral. `pointStandingHint` is a caller passthrough, out of scope.

### Opt-in consumers PRESERVED (read `node.standingBand` by design)

- `timelineNodePopoverModel.ts` (SC-002 tap popover standing label).
- `detail/argumentDetailModel.ts` (Inspect "Standing:" line + code).
- `ArgumentScoreTracker.tsx` + `argumentScoreModel.ts` (Mediator readout — uses its OWN
  `computeParticipantTrends`, not the timeline per-node band, so unaffected; ZERO edits).

## Neutralization mechanism

`const neutralize = input.neutralizeStandingBands !== false;` → two effects only:

```ts
// (a) edge builder — keeps the 5-stop array length
const standingColor = neutralize
  ? STANDING_BAND_COLOR.unscored
  : (STANDING_BAND_COLOR[node.standingBand] || '#475569');

// (b) Pass 4c a11y — omit the strength fragment on the default path
buildNodeAccessibilityLabel({ ..., includeStandingBand: !neutralize });
```

`ArgumentGameSurface.tsx` (the room caller) needs NO edit — the default
(`undefined → neutralize=true`) makes the room band-neutral automatically.

## Card hierarchy edit

Effectively none required. The Stack/bubble path (`ArgumentBubbleCard` +
`ArgumentBubbleViewModel`) carries no `inferStandingBand`-derived strength band already;
there is no band stripe/tint on the bubble to remove. On the Timeline the node dot is
already message/type-first (`kindColor` + ordinal); once the rail standing-tint and the
a11y strength fragment are neutralized, the spine is message-first with no further
hierarchy edit. The BIG density collapse is #844 — not done here.

## File changes

- `src/features/arguments/argumentGameSurfaceModel.ts` (~25 L): add
  `neutralizeStandingBands?` to `BuildTimelineMapInput`; export `STANDING_BAND_COLOR`;
  resolve `neutralize`; neutralize the edge standing stop; pass `includeStandingBand: !neutralize`.
- `src/features/arguments/keyboardNavigationModel.ts` (~6 L): add `includeStandingBand?`
  to `NodeAccessibilityInput`; guard the strength push.
- `src/features/arguments/ArgumentTimelineMap.tsx` (~4 L): pass `includeStandingBand: false`
  in the NodeDot a11y rebuild.
- `__tests__/visualSimplify003BandNeutralDefault.test.ts` (new, ~200 L).
- `__tests__/argumentTimelineMap.test.ts` (updated: 1 test amended + 1 added).
- `__tests__/keyboardNavigationModel.test.ts` (updated: 2 cases added).

## API / interface contracts

Both flags are additive and optional; the default caller needs no edit. `undefined`
resolves to the pre-card default in both interfaces:

- `neutralizeStandingBands: undefined | true` → band-neutral default path.
- `neutralizeStandingBands: false` → Inspect/admin path (restores band decoration + a11y fragment).
- `includeStandingBand: undefined | true` → strength fragment present (back-compat).
- `includeStandingBand: false` → strength fragment omitted.

## Edge cases

- Empty / single-node conversation: no edges → nothing to neutralize; a11y labels still
  omit the fragment.
- Detached child: no edge (unchanged); a11y label still non-empty (type/ordinal/branch/time).
- Inspect path (`neutralizeStandingBands: false`): standing stop reflects the band color;
  a11y label includes the soft label (parity with pre-card behavior).
- `standingBand` populated in both builds — opt-in consumers keep their signal.
- Reduce-motion: a11y label is motion-independent and stays non-empty.
- Heat vs strength: Hot zone (`detectBands`) still uses `standingBand` to detect
  friction runs — this is heat/activity, not a per-node strength verdict, and is retained.

## Test plan

New `visualSimplify003BandNeutralDefault.test.ts` contract:

- Default build: every edge standing stop === `STANDING_BAND_COLOR.unscored` even with
  `off_topic` / `ad_hominem` flags present.
- Default build: no node `accessibilityLabel` contains any `STANDING_BAND_SOFT_LABEL`
  value.
- Default build: `node.standingBand` STILL populated (off_topic node → `pretty_wrong`).
- Inspect path: standing stop reflects the band color AND the a11y label includes the
  soft label.
- Regression: `kindColor` / `kindColorFamily` / `lane` / `branchId` / `standingBand`
  identical across default and inspect builds; `timelineNodeVisualModel` derivation
  deep-equal for identical input (strength-independent).
- Doctrine sweep: every default-path node label contains NO banned verdict token AND no
  soft-label strength value.
- reduce-motion + a11y: default-path label stays non-empty.

Updated tests: `argumentTimelineMap.test.ts` gradient-stops test asserts the default
standing stop is `unscored` and adds an Inspect-path case;
`keyboardNavigationModel.test.ts` adds the `includeStandingBand:false` omit case + the
default-true keep case. The `it.each(ALL_BANDS)` soft-label + no-verdict-token blocks
and the `inferStandingBand` / Hot-zone unit tests are PRESERVED unchanged.

## Dependencies

None. No new packages, no Edge/mcp-server/migration/config/validator/ban-list/prompt
change, no provider spend.

## Risks

- **Model–render a11y drift**: mitigated by passing `includeStandingBand: false` in BOTH
  the model Pass 4c and the NodeDot rebuild, and by a contract test asserting no soft
  label appears on default-path labels.
- **Boundary tests**: none needed. `uxOneOneFiveReadOnlyBoundary.test.ts` already removed
  `ArgumentTimelineMap.tsx` from the zero-diff set (UX-MOBILE-001 / UX-COPY-001 NOTEs).
  `uxOneOneSixReadOnlyBoundary.test.ts` pins `argumentGameSurfaceModel.ts` /
  `ArgumentTimelineMap.tsx` only at API-presence level (`TIMELINE_NODE_SIZE` /
  `ArgumentTimelineMap` tokens preserved). `keyboardNavigationModel.ts` is unpinned. All
  edits are additive.
- **Hot-zone inert arm**: `detectBands` still reads `standingBand`; it stays populated so
  Hot zone is unchanged (heat band, not a strength verdict).
- **Popover opt-in operator-review**: `timelineNodePopoverModel` still surfaces a standing
  label on tap — this is an opt-in Inspect-adjacent surface, retained by scope.
- **TYPOGRAPHY untouched**: no font-size changes.

## Out of scope

- #844 (CardDetailPanel hub / density collapse), #845 (drawer work), #849 (raw-MCP
  leakage).
- The friendly-flag row (#834/#835) — stays.
- `pointStandingHint` (caller-supplied passthrough) — untouched.
- No deleting `standingBandCopy.ts` or `inferStandingBand` — re-scope consumption only.
- No Edge / mcp-server / migration / config change.
- `ArgumentScoreTracker.tsx` / `argumentScoreModel.ts` (Mediator readout) — PRESERVED,
  zero edits.
- `docs/core/current-status.md` — not touched by this card.

## Doctrine self-check

- **cdiscourse-doctrine §1** (score is gameplay analysis, never truth): retiring the
  per-node verdict-adjacent decoration from the default path REMOVES the closest thing to
  a per-message verdict. Nothing new introduces truth/strength framing into the default
  view. ✓
- **§2** (heat = activity): the Hot zone stays a friction band, not a strength verdict. ✓
- **§4** (AI moderator limits): AI-derived flags no longer decorate the default node as a
  per-message reading; the signal survives only behind opt-in Inspect. ✓
- **§7** (no AI calls from production app): unchanged — pure-TS model edits only. ✓
- **timeline-grammar** (color independence + no truth drift): shape = type, lane =
  branch preserved; the default rail carries no strength tint; grayscale legibility of
  type/branch unchanged. ✓
- **test-discipline**: new + updated pure-model tests; no ban-list/doctrine assertion
  weakened; test count up. ✓
- **expo-rn-patterns**: no new deps; RN primitives; a11y labels non-empty; 44px targets
  unchanged. ✓

## Operator steps

None — pure code change. No migration, no Edge deploy, no env var, no provider spend.
