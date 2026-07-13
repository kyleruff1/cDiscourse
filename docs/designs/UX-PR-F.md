# UX-PR-F — standing-band color-map dedupe

**Status:** Design draft
**Epic:** UX-PR-* polish / refactor lane (standing-band visual grammar — Epic 7 Strength/Weakness × Epic 2 Visual Grammar). P1-7 track.
**Release:** Post-6.6 UX polish (follows UX-PR-E dimension tokens, HEAD 7ccfea7d)
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/929

## Goal (one paragraph)

The standing-band color map (`pretty_wrong → completely_right`, the current red→green
ramp) is hand-maintained in three places that must stay in lockstep: the exported
canonical `STANDING_BAND_COLOR` in `argumentGameSurfaceModel.ts`, a byte-identical
module-local copy in `argumentScoreModel.ts`, and a four-arm inline hex ternary in the
`ArgumentScoreTracker.tsx` sparkline. Three copies means three chances to drift.
PR-F collapses them to **one canonical export referenced by all three**, so a future
edit (notably the doctrine-gated hue re-ramp, PR-F′ / P1-7b) has a single edit site and
divergence is caught by a test. This is a **pure structural refactor**: it renders
**byte-identical** — no hex value changes, no label changes, no scoring-logic changes.
Per `cdiscourse-doctrine` the bands remain gameplay-analysis (a point's standing in the
game), never truth verdicts, and score never blocks posting; PR-F touches none of that
semantics. Per `point-standing-economy` and `timeline-grammar` the color is a rendering
detail layered over stroke/texture encodings; nothing here alters what a band *means* or
how strength is encoded independent of color.

## Cannot-proceed check

No doctrine conflict. No under-specification. The card is a well-bounded refactor with a
single defensible canonical home. Proceeding.

## Data model

**No new data model.** No new types, no schema, no migration. `TimelineStandingBand`
(the 9-band union: `pretty_wrong | slightly_wrong | neutral | slightly_right |
maybe_right_misguided | pretty_right | completely_right | unscored | not_enough_signal`)
is already defined in `argumentGameSurfaceModel.ts` (line ~619) and re-aliased in
`argumentScoreModel.ts` as `StandingBand` (line 40). The canonical
`STANDING_BAND_COLOR: Record<TimelineStandingBand, string>` already exists and is already
exported from `argumentGameSurfaceModel.ts:839-849`. PR-F removes a duplicate and adds
references — no shape changes.

## Canonical-home decision

**DECISION: Option (a) — KEEP the canonical in `argumentGameSurfaceModel.ts`.** Do not
extract a new file.

Rationale (strong default, lowest blast):

1. **Already the source of truth.** `argumentGameSurfaceModel.ts:839` is already the
   `export const STANDING_BAND_COLOR`, and it is already the object the
   `VISUAL-SIMPLIFY-003` pin (`visualSimplify003BandNeutralDefault.test.ts:21`) and the
   `argumentTimelineMap.test.ts:25` import from. Nothing needs to move.
2. **Zero new module edge.** `argumentScoreModel.ts` **already** imports from
   `./argumentGameSurfaceModel` (line 29-38, for `inferStandingBand`, the band types,
   etc.). Adding `STANDING_BAND_COLOR` to that existing import statement adds **no new
   edge** and, by construction, **no new cycle**.
3. **gameSurfaceModel needs ZERO edits.** Because the canonical already lives there and
   is already exported, option (a) modifies only two *downstream* files
   (`argumentScoreModel.ts`, `ArgumentScoreTracker.tsx`) plus one new test. Every test
   that imports from `argumentGameSurfaceModel.ts` is therefore trivially unaffected.
4. **Boundary pin holds untouched.** `uxOneOneSixReadOnlyBoundary.test.ts:136-138` pins
   `argumentGameSurfaceModel.ts` on the token `TIMELINE_NODE_SIZE`. Under (a) that file
   is not edited at all, so the pin is safe with margin to spare.

**Option (b) — extract `src/features/arguments/standingBandColor.ts` (mirroring
`standingBandCopy.ts`) — is REJECTED.** It is cycle-safe (a sibling would import only
`type TimelineStandingBand` from gameSurfaceModel, exactly as `standingBandCopy.ts` does
today) but strictly higher blast for no benefit: it would require *editing*
`argumentGameSurfaceModel.ts` to delete the const and import from the new module, and
updating the two test imports (`visualSimplify003BandNeutralDefault.test.ts:21` and
`argumentTimelineMap.test.ts:25`) plus the internal gameSurfaceModel usage at
`argumentGameSurfaceModel.ts:1564-1565`. That is four more edit sites — including two on
live-rendered, boundary-pinned files — to relocate a map that already sits at the
correct, already-exported home. We do not pay that for a rename.

## File changes

- **Modified:** `src/features/arguments/argumentScoreModel.ts` — delete the byte-identical
  module-local copy; import + re-export the canonical. **~ −9 net lines** (delete 11-line
  const, add 1 import name, add a ~4-line re-export block with comment).
  - Line 29-38 import block: add `STANDING_BAND_COLOR,` as a **value** import (place it
    among the value imports, before the `type` imports) from `./argumentGameSurfaceModel`.
  - Delete lines 49-59 (the local `const STANDING_BAND_COLOR = { … }`).
  - Add a **value** re-export near the existing `STANDING_BAND_LABEL` re-export
    (lines 46-47), so the tracker can consume the single source without adding a new
    module edge:
    ```ts
    // UX-PR-F — the standing-band color map now comes from the canonical source in
    // argumentGameSurfaceModel.ts (this was a byte-identical local copy). Re-exported
    // so the score-tracker sparkline consumes the single source without a new module
    // edge. Hue values are pinned; the red-to-green re-ramp is PR-F-prime (issue 929).
    export { STANDING_BAND_COLOR };
    ```
  - Lines 217 (`color: STANDING_BAND_COLOR[finalBand]`) and 286
    (`return STANDING_BAND_COLOR[band]`) are **unchanged** — they now resolve the imported
    canonical instead of the deleted local. Same runtime value.

- **Modified:** `src/features/arguments/ArgumentScoreTracker.tsx` — replace the inline
  sparkline hex ternary with canonical keys. **~ +1 import name, 1 line rewritten.**
  - Line 16-19 import: add `STANDING_BAND_COLOR,` to the existing destructured import from
    `./argumentScoreModel` (keeping `standingBandColor` and `type ParticipantTrend`).
  - Line 69: rewrite the four arms to reference the canonical map (see next section for
    the exact key→arm mapping). Same runtime strings.

- **New:** `__tests__/standingBandColorSingleSource.test.ts` — single-source + value-pin
  test. **~ 70-90 lines.**

- **Unchanged (deliberately):** `src/features/arguments/argumentGameSurfaceModel.ts` —
  canonical home; **zero diff** under option (a).

## API / interface contracts

Public API is preserved exactly; PR-F only *adds* one re-exported name.

- `argumentGameSurfaceModel.ts` — `export const STANDING_BAND_COLOR: Record<TimelineStandingBand, string>`
  (unchanged; canonical).
- `argumentScoreModel.ts`:
  - `export function standingBandColor(band: StandingBand): string` — **unchanged
    signature and behavior** (now reads the imported canonical internally).
  - `export function standingBandLabel(band: StandingBand): string` — unchanged.
  - `export const STANDING_BAND_LABEL` — unchanged.
  - **NEW:** `export { STANDING_BAND_COLOR }` — re-export of the canonical (identity
    preserved: a re-export is the same binding, so `scoreModel.STANDING_BAND_COLOR ===
    gameSurfaceModel.STANDING_BAND_COLOR`).
  - Grep confirms **no existing consumer** imports `STANDING_BAND_COLOR` *from* scoreModel
    (it was a module-local `const`, never exported). The re-export exists solely to feed
    the tracker sparkline through the existing `tracker → scoreModel` edge. The only
    prior external color interface of scoreModel — `standingBandColor()` — is consumed
    only by `ArgumentScoreTracker.tsx` (lines 17, 48).
- `ArgumentScoreTracker.tsx` — `export function ArgumentScoreTracker({ trends }: Props)`
  unchanged (token preserved for the boundary pin).

### Exact sparkline key→arm mapping (`ArgumentScoreTracker.tsx:69`)

Current:
```ts
const c = s >= 0.4 ? '#10b981' : s >= 0 ? '#22d3ee' : s >= -0.4 ? '#f97316' : '#b91c1c';
```
Rewritten (byte-identical output; the four literals map 1:1 onto canonical keys):

| Ternary arm | Old literal | Canonical key | Canonical value |
| --- | --- | --- | --- |
| `s >= 0.4`  | `#10b981` | `completely_right` | `#10b981` |
| `s >= 0`    | `#22d3ee` | `slightly_right`   | `#22d3ee` |
| `s >= -0.4` | `#f97316` | `slightly_wrong`   | `#f97316` |
| else        | `#b91c1c` | `pretty_wrong`     | `#b91c1c` |

```ts
const c =
  s >= 0.4 ? STANDING_BAND_COLOR.completely_right
  : s >= 0 ? STANDING_BAND_COLOR.slightly_right
  : s >= -0.4 ? STANDING_BAND_COLOR.slightly_wrong
  : STANDING_BAND_COLOR.pretty_wrong;
```
(Import source: `./argumentScoreModel`, via the re-export — no new module edge.)

## Edge cases

- **Band absent from the map / bad key.** Not reachable: `STANDING_BAND_COLOR` is a
  `Record<TimelineStandingBand, string>` with all 9 keys; TypeScript rejects any key
  outside the union. The four sparkline keys are literals, statically checked.
- **`s` exactly on a boundary (0.4, 0, -0.4).** The `>=` comparisons are copied verbatim;
  boundary behavior is identical to today (e.g. `s === 0` → `slightly_right`).
- **`standingBandColor(band)` fallback.** The `unscored`/`not_enough_signal` fallback
  bands still resolve (`#475569` / `#374151`) through the same map; behavior unchanged.
- **The `#475569` internal fallback at gameSurfaceModel:1565** (`|| '#475569'`) is inside
  the unchanged file and out of PR-F's scope.
- **`#64748b` reuse in the tracker.** `STANDING_BAND_COLOR.neutral` is `#64748b`, and the
  tracker independently uses `#64748b` as a *muted-text* style color at lines 97 and 104
  (`count`, `note`). These are **unrelated** style literals, NOT part of the sparkline and
  NOT part of the dedupe. The single-source test's negative scan must therefore target
  **only the four removed sparkline hexes**, never `#64748b` (see Risks R1).
- **Doctrine edge — "does dedupe change any user-facing meaning?"** No. Same hexes, same
  bands, same labels, same advisory framing. Score still never blocks posting.

## Test plan

New file `__tests__/standingBandColorSingleSource.test.ts` (pure-model + static source
scan; **no snapshot**):

- **SINGLE SOURCE (object identity).** Import the canonical from gameSurfaceModel and the
  re-export from scoreModel; assert they are the *same object* so future divergence fails:
  ```ts
  import { STANDING_BAND_COLOR as CANON } from '../src/features/arguments/argumentGameSurfaceModel';
  import { STANDING_BAND_COLOR as VIA_SCORE } from '../src/features/arguments/argumentScoreModel';
  expect(VIA_SCORE).toBe(CANON); // re-export preserves identity
  ```
- **SINGLE SOURCE (score function routes through canonical).** Behavioral proof that the
  exported `standingBandColor()` reads the canonical:
  ```ts
  import { standingBandColor } from '../src/features/arguments/argumentScoreModel';
  for (const band of Object.keys(CANON) as (keyof typeof CANON)[]) {
    expect(standingBandColor(band)).toBe(CANON[band]);
  }
  ```
- **TRACKER consumes the canonical (static import-graph scan, no snapshot).** Read the
  tracker source and assert (a) it imports `STANDING_BAND_COLOR`; (b) it references the
  four canonical keys; (c) it contains **none** of the four removed sparkline literals:
  ```ts
  import * as fs from 'fs';
  import * as path from 'path';
  const src = fs.readFileSync(
    path.resolve(process.cwd(), 'src/features/arguments/ArgumentScoreTracker.tsx'), 'utf8');
  expect(src).toContain('STANDING_BAND_COLOR');
  for (const key of ['completely_right', 'slightly_right', 'slightly_wrong', 'pretty_wrong']) {
    expect(src).toContain(`STANDING_BAND_COLOR.${key}`);
  }
  // Negative scan: ONLY the four removed sparkline hexes. Do NOT include #64748b —
  // it stays as an unrelated muted-text style color (lines 97/104).
  for (const hex of ['#10b981', '#22d3ee', '#f97316', '#b91c1c']) {
    expect(src).not.toContain(hex);
  }
  ```
- **VALUE PIN (the F′ hinge).** Assert the canonical is the exact current 9-hex ramp. This
  is the assertion PR-F′ / P1-7b will deliberately change under the operator ruling —
  call that out in the comment so the next author knows this is the intended edit site:
  ```ts
  it('VALUE-PIN — the canonical ramp is the current 9 hexes; PR-F-prime re-ramps these under the operator ruling (issue 929)', () => {
    expect(CANON).toEqual({
      pretty_wrong: '#b91c1c',
      slightly_wrong: '#f97316',
      neutral: '#64748b',
      slightly_right: '#22d3ee',
      maybe_right_misguided: '#facc15',
      pretty_right: '#34d399',
      completely_right: '#10b981',
      unscored: '#475569',
      not_enough_signal: '#374151',
    });
  });
  ```
- **No new doctrine ban-list test needed.** PR-F changes zero user-facing strings/labels.
  The existing doctrine sweeps (`timelineReadoutBanList.test.ts`,
  `visualSimplify003BandNeutralDefault.test.ts` verdict sweep, the
  `uxRoomChrome001…` scoreboard-token ban) already cover the rendered surface and stay
  green unchanged.

Existing tests that must stay green **unchanged** (they import the untouched canonical
file, or assert only values that are unchanged): `visualSimplify003BandNeutralDefault.test.ts`,
`argumentTimelineMap.test.ts`, `keyboardNavigationModel.test.ts` (and its consumers),
`uxRoomChrome001CompactHeaderAndMediatorReadout.test.tsx`, `uxOneOneSixReadOnlyBoundary.test.ts`.

Gates: `npm run typecheck`, `npm run lint`, `npm run test` (capture the `Test Suites:` /
`Tests:` line + exit 0). Test count goes **up by one file** (~4 tests); update
`docs/core/current-status.md` only after the count is confirmed from a captured run.

## Byte-identity proof plan

1. **`argumentGameSurfaceModel.ts` = zero diff** under option (a). Therefore
   `VISUAL-SIMPLIFY-003`'s behavioral contract, `argumentTimelineMap`, and every
   `keyboardNavigationModel` consumer are unaffected *by construction* — they import a
   file that did not change. `git diff --stat -- src/features/arguments/argumentGameSurfaceModel.ts`
   must be empty.
2. **`argumentScoreModel.ts` output identical.** The deleted local map and the imported
   canonical are byte-identical (verified line-by-line: `#b91c1c / #f97316 / #64748b /
   #22d3ee / #facc15 / #34d399 / #10b981 / #475569 / #374151`). So `computeStatementStanding`
   (line 217) and `standingBandColor` (line 286) return the same hexes as before.
3. **Tracker sparkline identical.** Each ternary arm's canonical key resolves to the same
   hex it used to hard-code (mapping table above). Runtime `backgroundColor` strings are
   unchanged.
4. **No snapshot churn.** There are no Jest `__snapshots__` for these components; the
   relevant tests use explicit assertions. The `uxRoomChrome001…` render test asserts only
   the "Mediator readout" title + a scoreboard-token ban — it never asserts a sparkbar or
   colorBar hex, so the literal→reference swap is invisible to it. Zero snapshot updates
   expected.

## Cycle-safety analysis

Current import edges (verified by grep):

- `argumentScoreModel.ts` → `argumentGameSurfaceModel.ts` (line 29-38) — **exists.**
- `argumentScoreModel.ts` → `standingBandCopy.ts` (line 46) — exists.
- `ArgumentScoreTracker.tsx` → `argumentScoreModel.ts` (line 16-19) — **exists.**
- `ArgumentScoreTracker.tsx` → `standingBandCopy.ts` (line 20) — exists.
- `argumentGameSurfaceModel.ts` → `{ formatDateTime, timelineNodeVisualModel,
  keyboardNavigationModel }` + two **type-only** imports (`compositionTypes`,
  `conversationGalleryModel`). It imports **no** scoreModel, no tracker, no component.
  Grep for `argumentScoreModel|ArgumentScoreTracker` inside `argumentGameSurfaceModel.ts`
  returns **no matches** — there is **no reverse edge**.

Under option (a):
- scoreModel's new value import of `STANDING_BAND_COLOR` travels the **already-existing**
  `scoreModel → gameSurfaceModel` edge. No new edge, no cycle.
- The tracker imports `STANDING_BAND_COLOR` via scoreModel's re-export, over the
  **already-existing** `tracker → scoreModel` edge. No new edge, no cycle.
- gameSurfaceModel remains a leaf-ward upstream module (nothing it imports points back to
  scoreModel or the tracker). Acyclic.

Alternative considered and not needed: tracker importing `STANDING_BAND_COLOR` *directly*
from `argumentGameSurfaceModel.ts`. That would be a `component → model` edge, which is
also acyclic (gameSurfaceModel imports no components), but it adds a new module edge for no
benefit. The re-export path is preferred: it adds **zero** new edges and keeps the tracker
depending on a single model.

## Completeness — every consumer enumerated (no 4th copy)

Full 9-hex map (exhaustive hex sweep of `src/`, all nine hexes, confirms exactly two
full-map copies):

- `argumentGameSurfaceModel.ts:839-849` — canonical `export const` (**KEEP**).
- `argumentScoreModel.ts:49-59` — byte-identical module-local `const` (**DELETE**).

`STANDING_BAND_COLOR` symbol consumers:

- `argumentGameSurfaceModel.ts:839` decl; `:1564-1565` internal edge-gradient usage
  (untouched, canonical file).
- `argumentScoreModel.ts:49` dup decl (delete); `:217` + `:286` usages (retargeted to
  import, no line change).
- `__tests__/argumentTimelineMap.test.ts:25` import (from gameSurfaceModel); usages
  `:165, :168, :186` — untouched.
- `__tests__/visualSimplify003BandNeutralDefault.test.ts:21` import (from gameSurfaceModel);
  usages `:105, :108, :109, :160, :164` — untouched.
- `ArgumentScoreTracker.tsx:69` — the four raw hex literals (**the third copy**; retarget
  to canonical keys). The tracker's `:17`/`:48` consume the `standingBandColor()` function,
  which already routes through the canonical after the scoreModel edit.
- **No consumer imports `STANDING_BAND_COLOR` from `argumentScoreModel`** (it was never
  exported there), so the new re-export introduces the name safely with no shadowing.

Unrelated hex occurrences (confirmed out of scope — same hex, different meaning):

- `#f97316` — `TIMELINE_KIND_COLORS.challenge` (826), `TONE_BAND_COLOR.heated` (854),
  disagreement-axis `fact_disagreement` (930), `ArgumentBubbleActions.disagree`,
  `railSegmentModel.heated`, `timelineNodeVisualModel.heated`, `TimelineNodePopover.disagree`,
  `ArgumentTimelineMap.firstClashPill`, `conversationGalleryModel.challenge`.
- `#475569` — `TIMELINE_KIND_COLORS.default` (831), `TONE_BAND_COLOR.unknown` (856),
  `STANDING_BAND_COLOR.unscored` (847), `railSegmentModel` neutral fills, plus many
  component border/text styles.
- `#22d3ee` — `TONE_BAND_COLOR.calm` (852), `slightly_right` band, self-actor colors,
  card/ring border styles.
- `#10b981` — `completely_right` band, `receipts` glyph color, `scope_challenge` axis (936),
  `ArgumentDraftQualifierCards.cardNudge`, `RefereeBannerView` (no — that is `#34d399`).
- `#34d399` — `pretty_right` band, `RefereeBannerView.celebratory`.
- `#facc15` — `maybe_right_misguided` band, admin-actor color (`argumentDetailModel`,
  `ArgumentTimelineScrubber`).
- `#b91c1c` — `pretty_wrong` band, error text (`DebateListScreen`, `ArgumentTreeScreen`,
  `PreSendReviewSheet`).
- `#64748b` — `neutral` band, plus pervasive muted-text/placeholder style token
  (`designTokens.textMuted/placeholder`, and ~30 component styles **including the tracker's
  own `count`/`note` at lines 97/104**).
- `#374151` — `not_enough_signal` band, plus many component text styles.

None of these is a standing-band *map*; they are single-purpose kind/tone/axis/actor/error/
style literals that coincidentally reuse a hex. **There is no 4th full-map copy and no
`.js` parity twin** (the repo-wide `STANDING_BAND_COLOR` grep returned only the two `.ts`
sources, the two test files, and docs).

## Dependencies (cards / docs / files)

- Reads `argumentGameSurfaceModel.ts` `STANDING_BAND_COLOR` (canonical) and
  `TimelineStandingBand` type — both already present; no upstream card required.
- Assumes `VISUAL-SIMPLIFY-003` is complete (it established the canonical as the pin
  source); it is, on main.
- **Blocks / enables PR-F′ (P1-7b)** — the doctrine-gated red→green → neutral→indigo hue
  re-ramp. After PR-F, F′ is a one-file edit to `argumentGameSurfaceModel.ts:839-849` plus
  a one-line update to the VALUE-PIN test; the dedupe is what makes F′ a clean single-site
  change. F′ remains **out of scope** here and is gated on the operator ruling.

## Risks

| # | Risk | Likelihood | Mitigation |
| --- | --- | --- | --- |
| R1 | Implementer writes an over-broad negative scan ("no band hex in tracker") that trips on `#64748b` used for muted text at `ArgumentScoreTracker.tsx:97/104`. | Medium | The test's negative scan targets **only** the four removed sparkline hexes (`#10b981 #22d3ee #f97316 #b91c1c`), never `#64748b`. Spelled out in the Test plan. |
| R2 | Implementer "helpfully" adjusts a hex while in the file (starts F′). | Low-Med | VALUE-PIN test + explicit Non-goals + the re-export comment name F′ as the only place hues change. Any hue edit fails the pin. |
| R3 | Re-export forgotten → tracker cannot import `STANDING_BAND_COLOR`. | Low | Caught immediately by `npm run typecheck` (unresolved import). |
| R4 | A future reader sees two names (`gameSurfaceModel.STANDING_BAND_COLOR` and the scoreModel re-export) and assumes two maps. | Low | The re-export comment states it is the same canonical object; the single-source `===` test proves identity. |
| R5 | Value re-export accidentally written as `export type` (type-only), so the runtime binding is missing. | Low | It is a value re-export (`export { STANDING_BAND_COLOR }`). Typecheck + the identity test catch a type-only slip. |
| R6 | Reviewer sees `ArgumentScoreTracker.tsx` in the diff and flags it against the UX-001.6 read-only budget. | Low | UX-001.6's budget governs *that* card only; PR-F is a separate card. The boundary **unit** test asserts token presence (`ArgumentScoreTracker`), which PR-F preserves. Called out in Scanner-hazard note. |

## Out of scope (non-goals)

- **NO hue change.** The red→green → neutral→indigo re-ramp is **PR-F′ / P1-7b**,
  doctrine-gated, operator-ruling-dependent. PR-F is byte-identical; every hex is pinned.
- **NO tone-band dedup.** `TONE_BAND_COLOR` (gameSurfaceModel:851-857) is a separate map;
  consolidating it is **P2-4**, not this card.
- **NO consolidation** of kind colors (`TIMELINE_KIND_COLORS`), disagreement-axis colors,
  actor colors, error-text hexes, or muted-text style tokens that happen to share a hex.
- **NO extraction** to a new `standingBandColor.ts` file (option (b) rejected).
- **NO change** to `STANDING_BAND_SOFT_LABEL` / `standingBandCopy.ts`, to
  `standingBandColor()` / `standingBandLabel()` signatures, to scoring logic, bands, or
  any user-facing string.
- **NO snapshot** introduction.

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; no service-role).**
  PR-F changes zero labels and zero strings; bands stay gameplay-analysis; posting is
  unaffected; no network, no DB, no service-role — pure client-side constant plumbing. The
  *current* red→green ramp is preserved exactly (its doctrine-sensitive re-ramp is F′,
  explicitly deferred), so PR-F neither introduces nor removes any truth-adjacent framing.
- **cdiscourse-doctrine §9 (plain language).** No internal codes enter user-facing strings;
  no copy touched.
- **point-standing-economy.** Bands describe a point's standing in the game, not a verdict;
  the color map is a rendering detail. No scoring/`antiAmplification` path is touched; the
  engagement-vs-factual-standing separation is untouched.
- **timeline-grammar.** Strength is encoded by stroke/weight/texture **and** color; PR-F
  removes no color-independent signal and changes no hue — color independence for the 9
  bands is preserved. The dedupe is structural only.
- **test-discipline.** One new test file (count goes up), pure-model + static-scan, no
  `.skip`/`.only`, no snapshot; `current-status.md` updated only after a captured green run.

## Operator steps (if any)

None — pure code change. No migration (`npx supabase db push`), no Edge Function deploy,
no env var, no Netlify publish. Ships via normal PR merge.

---

**One-paragraph summary for the reviewer.** PR-F removes the two redundant copies of the
9-band `STANDING_BAND_COLOR` map — the byte-identical module-local `const` in
`argumentScoreModel.ts:49-59` and the four raw hex literals in the
`ArgumentScoreTracker.tsx:69` sparkline — and points both at the already-exported canonical
in `argumentGameSurfaceModel.ts:839-849` (canonical-home option (a); gameSurfaceModel is
**not** edited). scoreModel adds `STANDING_BAND_COLOR` to its existing gameSurfaceModel
import and re-exports it; the tracker imports that re-export (zero new module edges, no
cycle — the `scoreModel→gameSurfaceModel` and `tracker→scoreModel` edges already exist and
there is no reverse edge). The sparkline's four arms map 1:1 to `completely_right /
slightly_right / slightly_wrong / pretty_wrong`, so runtime output is byte-identical and no
snapshot changes. A new `__tests__/standingBandColorSingleSource.test.ts` asserts object
identity (`scoreModel.STANDING_BAND_COLOR === gameSurfaceModel.STANDING_BAND_COLOR`), that
the tracker consumes the canonical (static scan: imports the symbol, references the four
keys, contains none of the four removed hexes — never scanning `#64748b`, which stays as
muted-text style), and value-pins the current 9 hexes with a comment flagging that PR-F′
re-ramps them under the operator ruling. Hues are unchanged (F′ is out of scope), the
`uxOneOneSixReadOnlyBoundary` API-presence pins for both files still hold, and no operator
step is required.
