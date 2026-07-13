# UX-PR-F-prime — standing-band re-ramp (magnitude-in-one-hue-family)

**Status:** Design draft
**Epic:** UX-PR-* polish / refactor lane (standing-band visual grammar — Epic 7 Strength/Weakness x Epic 2 Visual Grammar). P1-7b track (the doctrine-gated hue re-ramp PR-F deferred).
**Release:** Post-6.6 UX polish (follows UX-PR-F dedupe, HEAD 07e75095).
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/931

## Goal (one paragraph)

PR-F collapsed the standing-band color map to a single canonical export (`STANDING_BAND_COLOR` in `argumentGameSurfaceModel.ts`) referenced by `argumentScoreModel.ts` and `ArgumentScoreTracker.tsx`, but changed **zero** hue values — it explicitly deferred the re-ramp to this card. UX-PR-F-prime applies the **operator-ruled** doctrine change: band color now encodes **magnitude** in one indigo family, **not right vs wrong**. Wrong and right at the same magnitude share a hue; valence lives only in the plain-language soft label (and, independently, in stroke/glyph/texture). This is a value edit to the 6 changed keys of one canonical map, plus a small a11y text/bar split in the one component that renders a standing color as TEXT, plus the two guard tests that deliberately pinned the old values (the value-pin in `standingBandColorSingleSource.test.ts` and the P9 red-allowlist in `cohesionPrinciple9Guard.test.ts`). Per `cdiscourse-doctrine` the bands remain gameplay-analysis (a point's standing in the game), never truth verdicts; score never blocks posting; nothing here touches scoring logic, vocabulary, labels, tone/kind colors, or the DB. Per `timeline-grammar` and `accessibility-targets`, color was never the sole signal — the doctrine INTENT here is that color stops adjudicating valence at all; the a11y split (operator-ruled) makes that intent literal by taking the band-label TEXT off the hue entirely (fixed high-contrast token) and keeping the magnitude hue only on the color-bar, sparkline, and edge gradient stops.

## Cannot-proceed check

No doctrine conflict. The operator ruling is explicit, verbatim, and internally consistent with the doctrine that color must never adjudicate truth. The direction is not to be re-litigated. The one a11y concern surfaced in the first draft (a WCAG-AA text-contrast regression on the Mediator readout band label) was ruled by the operator to be FIXED IN THIS CARD (not deferred, no follow-up): the band-label TEXT moves to a fixed high-contrast token and the magnitude hue stays on the color-bar / sparkline / edge gradient stops only. That fix is fully specified below (see "A11y text/bar split"). Proceeding.

## The operator ruling (applied verbatim)

Apply this EXACT ramp to `STANDING_BAND_COLOR` in `src/features/arguments/argumentGameSurfaceModel.ts`:

| Band key | Old hex | New hex | Changed? |
|---|---|---|---|
| `pretty_wrong` | `#b91c1c` | `#6366f1` | YES |
| `slightly_wrong` | `#f97316` | `#818cf8` | YES |
| `neutral` | `#64748b` | `#64748b` | no (unchanged) |
| `slightly_right` | `#22d3ee` | `#818cf8` | YES |
| `maybe_right_misguided` | `#facc15` | `#6366f1` | YES |
| `pretty_right` | `#34d399` | `#6366f1` | YES |
| `completely_right` | `#10b981` | `#4f46e5` | YES |
| `unscored` | `#475569` | `#475569` | no (unchanged) |
| `not_enough_signal` | `#374151` | `#374151` | no (unchanged) |

Magnitude semantics after the ramp: `#818cf8` (indigo-300, lighter) = small magnitude (slightly_wrong / slightly_right); `#6366f1` (indigo-500) = mid/high magnitude (pretty_wrong / maybe_right_misguided / pretty_right); `#4f46e5` (indigo-600, deepest) = maximum magnitude (completely_right). Wrong and right at the same magnitude are intentionally the same hue.

## Data model

**No new data model.** No new types, no schema, no migration, no Edge Function. `TimelineStandingBand` (the 9-band union) already exists at `argumentGameSurfaceModel.ts:619-628`; `STANDING_BAND_COLOR: Record<TimelineStandingBand, string>` already exists at `argumentGameSurfaceModel.ts:839-849`. This card changes 6 string values inside that existing literal. Nothing else in the type system moves.

## File changes

Four files. No new files, no deleted files.

- **modified:** `src/features/arguments/argumentGameSurfaceModel.ts` (~6 changed lines) — the 6 changed values of the `STANDING_BAND_COLOR` literal at lines 839-849. The 3 unchanged keys (`neutral`, `unscored`, `not_enough_signal`) stay byte-identical. Optionally one apostrophe-free header comment above the literal noting the operator ruling + `(issue 931)`. No other line in the file changes.
- **modified:** `src/features/arguments/ArgumentScoreTracker.tsx` (~3 changed lines) — the a11y text/bar split: the band-label `<Text>` (line 62) stops reading the standing hue and renders in a fixed high-contrast token; the color-bar (line 56) and sparkline (lines 71-75) keep the magnitude hue. See "A11y text/bar split" for the exact edit. This is the ONLY component that renders a standing color as TEXT (verified codebase-wide).
- **modified:** `__tests__/standingBandColorSingleSource.test.ts` (~7 changed lines) — the VALUE PIN object at lines 77-88 updated to the new 9 hexes; the `it(...)` description at line 76 refreshed to reference issue 931 and "the applied re-ramp". Optionally the header docstring (lines 18-19, 22-23) updated so it no longer says PR-F "changes zero hues". The `(c3)` negative-scan array at line 69 stays as-is (see Test plan).
- **modified:** `__tests__/cohesionPrinciple9Guard.test.ts` (~2 changed lines) — the `ALLOWLIST_P9` entry for `argumentGameSurfaceModel.ts` at line 98 shrinks from `['#ef4444', '#b91c1c', '#dc2626']` to `['#ef4444', '#dc2626']`, and its comment at line 97 drops the `#b91c1c` mention.

The hue re-ramp propagates to the tracker's bar/sparkline and the edge gradient stops **automatically** via the canonical single source (no edit). The tracker's ~3-line text/bar split is the one deliberate consumer edit, required to keep the band-label TEXT above WCAG-AA once the ruled hues land.

## API / interface contracts

The public contract is byte-stable; only literal values inside an existing export change.

- `STANDING_BAND_COLOR: Record<TimelineStandingBand, string>` — exported from `argumentGameSurfaceModel.ts`. Same type, same 9 keys, same export name. 6 values change.
- `argumentScoreModel.ts` **re-exports the same binding** (verified): line 54 is `export { STANDING_BAND_COLOR };` (a re-export, not a copy). Its consumers `computeStatementStanding` (`color: STANDING_BAND_COLOR[finalBand]`, line 212) and `standingBandColor(band)` (lines 280-282) resolve the canonical object at runtime. No edit here — it auto-updates. The single-source test `(a)` asserts `VIA_SCORE === CANON` (object identity), so this is guaranteed.
- `ArgumentScoreTracker.tsx` **references by key** (verified): `standingBandColor(t.currentBand)` (line 49) and the sparkline `STANDING_BAND_COLOR.completely_right / .slightly_right / .slightly_wrong / .pretty_wrong` (lines 71-74). No hardcoded standing hex lives in the component. No edit here — it auto-updates.

Single-source conclusion: editing the 6 values in the canonical literal propagates the hue to the score model, the tracker's bar/sparkline, and the edge gradient stops with **no separate edit**, exactly as PR-F designed. The one deliberate consumer edit is the tracker text/bar split below.

## A11y text/bar split (operator-ruled; in this card)

Doctrine rule (operator ruling): the band-label **TEXT** renders in a fixed high-contrast token; the magnitude indigo hue lives on the **color-bar + sparkline + edge gradient stops** only. This makes color-independence stronger, not weaker — the label text stops encoding valence via color (it never should have), the plain-language soft label carries the meaning, and the magnitude hue becomes a redundant cue on non-text marks.

### 1. Every site that renders a standing-band label as TEXT in the band color — switch to a high-contrast token (exactly ONE)

Codebase-wide verification: `standingBandColor()` / `STANDING_BAND_COLOR` are imported in only three files (`argumentGameSurfaceModel.ts`, `argumentScoreModel.ts`, `ArgumentScoreTracker.tsx`); `StatementStanding` / `computeStatementStanding` / `.currentBand` appear in no other component; `ArgumentRoom.tsx` only computes trends and passes them to the tracker. So the tracker is the only component that can color text with a standing hue.

- **`src/features/arguments/ArgumentScoreTracker.tsx:62`** — the participant band label.
  - Today: `<Text style={[styles.band, { color }]} numberOfLines={1}>{formatStandingBandShort(t.currentBand)}</Text>`, where `color = standingBandColor(t.currentBand)` (line 49). This renders the label TEXT in the standing hue on card bg `#0f172a` — the AA failure (`#4f46e5` approx 2.84:1, `#6366f1` approx 4.0:1).
  - Edit: drop the inline `{ color }` from the band `<Text>` so it reads `<Text style={styles.band} numberOfLines={1}>…</Text>`, and add `color: SURFACE_TOKENS.textPrimary` to the `styles.band` StyleSheet entry (line 103). Add the import `import { SURFACE_TOKENS } from '../../lib/designTokens';` (relative path from `src/features/arguments/` is `../../lib/designTokens`; `SURFACE_TOKENS` is a named export at `designTokens.ts:415`). Keep `const color = …` (line 49) — it is still used by the color-bar (line 56).

Already-safe surface (no change, listed so the implementer does not "fix" it): **`src/features/arguments/TimelineNodePopover.tsx:286`** renders the standing label (`model.standingLabel`) in `styles.bandValue`, a FIXED style color — it never read the standing hue, so it is already compliant.

### 2. Every site that uses the band color as a BAR / sparkline / edge gradient stop — KEEP the magnitude hue (do NOT touch)

- **`ArgumentScoreTracker.tsx:56`** — `colorBar` (`<View style={[styles.colorBar, { backgroundColor: color }]} />`, a 4px vertical accent). KEEP the hue. It is a non-text mark redundant with the now-high-contrast adjacent label text.
- **`ArgumentScoreTracker.tsx:71-75`** — sparkline bars (`backgroundColor: c`, where `c` is `STANDING_BAND_COLOR.completely_right / .slightly_right / .slightly_wrong / .pretty_wrong`). KEEP. Sign/value is also encoded by bar HEIGHT (`h = Math.max(2, Math.round((s + 1) * 6))`), so the bar is not color-only. Note: after the ramp `slightly_right` and `slightly_wrong` both resolve to `#818cf8`, so small-positive and small-negative sparkline bars share a hue — intended magnitude-coloring; height keeps them distinct. No logic edit (it references the canonical keys and auto-updates).
- **`argumentGameSurfaceModel.ts:1563-1571`** — the edge `standingColor` gradient stop on the rail (Inspect path; the default path already collapses it to the neutral `unscored` grey). KEEP — decorative rail gradient, not text.

### 3. The high-contrast token per call site

- Band label text → **`SURFACE_TOKENS.textPrimary`** (`#e2e8f0`; documented "body + values", 11-13:1 vs the dark surface family; computed approx 14.5:1 on the tracker card bg `#0f172a`). This is the primary readout value, so `textPrimary` (not the subordinate `textSecondary` `#94a3b8` approx 5-6:1, which also passes but reads as helper text) is the doctrine-correct pick. **No new hex** — the implementer references the existing token, not a literal.

### 4. Color-independence is now stronger, not weaker

- The band-label TEXT no longer encodes valence (or magnitude) via color at all — it is a single fixed high-contrast token for every band. Meaning is carried entirely by the plain-language soft label (`standingBandCopy.ts`: `Needs work` / `Well supported` / …), reinforced by the stroke (`argumentVisualGrammar.ts` `strokeForBand`), glyph, and texture.
- The magnitude indigo hue is now a **redundant** cue on non-text marks (color-bar, sparkline, edge), where WCAG text-contrast does not apply and the signal is independently carried (adjacent label text; sparkline height; rail geometry).
- **Contract-test impact: none.** No test asserts a `<Text>` color equals a standing-band hex (verified: the exhaustive scan for the six old standing hexes finds only the value-pin and the P9 classifier table; `uxRoomChrome001…` renders the tracker but asserts only copy, and its `color: '#10b981'` fixture is an unused `ParticipantTrend.color` field the tracker ignores for the band text). So the text-color change needs **no** contract-test edit. If a future author adds a test pinning the band `<Text>` color, it must pin `SURFACE_TOKENS.textPrimary`, never a standing hue.

## Edge cases

- **Unchanged keys must stay byte-identical.** `neutral` (`#64748b`), `unscored` (`#475569`), `not_enough_signal` (`#374151`) are NOT in the ruling. If any is touched, the value-pin fails and the VISUAL-SIMPLIFY-003 contract (which pins the default edge stop to `STANDING_BAND_COLOR.unscored`) shifts silently. Leave them alone.
- **Wrong and right now share a hue.** `pretty_wrong`, `maybe_right_misguided`, `pretty_right` all become `#6366f1`; `slightly_wrong` and `slightly_right` both become `#818cf8`. This is intended. Any code that inferred valence from the resolved hex would now be wrong — but no such code exists (verified below).
- **`#b91c1c` fully leaves `argumentGameSurfaceModel.ts`.** It occurs exactly once in the file (the `pretty_wrong` value). After the edit it is absent, so the P9 bidirectional completeness ratchet requires it to drop from the allowlist in the SAME change, or the "every allowlist entry is still on disk" arm fails.
- **`#10b981` (old `completely_right`) still appears in the file** via `TAG_LABEL_MAP.scope_challenge` (line 936). That is a different signal (a dropped-tag color, green, non-red) and is out of scope — do NOT touch it. Its continued presence does not affect the P9 allowlist (green, not red-family).
- **Empty / single-node timelines:** no standing edge is produced; the ramp change is inert. No new branch.
- **Inspect path (`neutralizeStandingBands: false`):** now renders `#6366f1` for both a pretty_wrong edge and a pretty_right edge. The contract test asserts each edge equals the respective `STANDING_BAND_COLOR.<key>` **by reference**, so both pass (they resolve to the same object value). No assertion in that test compares the two edges to each other.

## Test plan

No new test files. This card is verified by the two existing guards being updated to the ruled values, the unchanged VISUAL-SIMPLIFY-003 contract test continuing to pass, and the tracker text/bar split being covered by typecheck + lint + the existing tracker-rendering test (`uxRoomChrome001…`) still passing. Snapshot search result: **there are zero snapshot files in the repo** (no `__snapshots__/`, no `.snap`, no `toMatchSnapshot` / `toMatchInlineSnapshot` anywhere in `__tests__`). So the card's anticipated "snapshot churn" does not exist — expect **no** snapshot deltas.

1. **`__tests__/standingBandColorSingleSource.test.ts` — VALUE PIN (must edit).** Replace the object at lines 77-88 with:
   ```ts
   expect(CANON).toEqual({
     pretty_wrong: '#6366f1',
     slightly_wrong: '#818cf8',
     neutral: '#64748b',
     slightly_right: '#818cf8',
     maybe_right_misguided: '#6366f1',
     pretty_right: '#6366f1',
     completely_right: '#4f46e5',
     unscored: '#475569',
     not_enough_signal: '#374151',
   });
   ```
   Also update the `it(...)` title (line 76) to state the ramp is now applied under issue 931. Tests `(a)` object-identity, `(b)` 9-key routing, `(c1)` symbol import, and `(c2)` four-key reference all pass unchanged.
2. **`__tests__/standingBandColorSingleSource.test.ts` — `(c3)` negative-scan (do NOT change).** Line 69 scans the *tracker source* for `['#10b981', '#22d3ee', '#f97316', '#b91c1c']` and asserts none is present. The tracker references standing colors by KEY (no hex literals), so those four are still absent — `(c3)` passes unchanged and remains a useful regression guard against anyone re-inlining any literal. Leave it.
3. **`__tests__/cohesionPrinciple9Guard.test.ts` — P9 allowlist (must edit).** Change line 98 to `'src/features/arguments/argumentGameSurfaceModel.ts': ['#ef4444', '#dc2626'],` and update the line-97 comment to drop `#b91c1c` (e.g. note the standing-band red was re-ramped to indigo by UX-PR-F-prime, issue 931; the remaining reds `#ef4444` flag-kind and `#dc2626` tone-hostile are the still-pending tone/kind burn-down, keep the file's existing P-label vocabulary). The `it.each` guard (line 136) and the bidirectional completeness `it.each` (line 202) both then pass. The `isRedFamily` unit tables (lines 144-165) are UNCHANGED — `#b91c1c` stays in the positive table (the classifier still classifies it as red; we merely stopped USING it), and the new indigo hexes are not added there. The line-159 comment `// green (standing supported)` on `#10b981` becomes historically stale but its assertion (`isRedFamily === false`) still holds; an optional one-word comment refresh is fine, not required.
4. **`__tests__/visualSimplify003BandNeutralDefault.test.ts` — behavioral contract (NO change, must pass).** Read in full. Every assertion uses `STANDING_BAND_COLOR.<key>` by reference, never a hardcoded hex, and there is **no** `pretty_wrong !== pretty_right` assertion. Verified pass-by-reference under the new ramp:
   - default path: `standingStop === unscored` (`#475569`) holds; `!== pretty_wrong` (now `#6366f1`) holds; `!== pretty_right` (now `#6366f1`) holds — all three still distinct from `#475569`.
   - Inspect path: `edgeToA standingStop === pretty_wrong` and `edgeToC standingStop === pretty_right` both hold by object-value reference even though both now equal `#6366f1`.
   - soft-label / verdict-token sweeps (lines 113-143, 167-171) are hue-independent.
5. **Tracker text/bar split (source edit, no test change needed).** Verified no test asserts a `<Text>` color equals a standing-band hex, so removing the inline `{ color }` from the band `<Text>` and setting `styles.band` to `SURFACE_TOKENS.textPrimary` breaks nothing. `typecheck` covers the new `SURFACE_TOKENS` import; `lint` catches an accidental unused `color` (it stays used by the color-bar); the existing `uxRoomChrome001…` render test (copy-only assertions) still passes. The `(c3)` tracker source-scan and the P9 tracker allowlist (`[]`) are unaffected — the added token is not a hex literal and not red.
6. **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0. Test count must not drop (no tests added or removed; the four edits are in-place). Capture the `Tests: Y passed` line + exit code per test-discipline; cross-check the count against the reviewer re-run and update `docs/core/current-status.md` only after the count is confirmed.
7. **Doctrine ban-list assertions:** none newly required. The `uxOneOneSixDoctrine` scan already covers `argumentGameSurfaceModel.ts`; the edit introduces no user-facing string, no verdict token, no internal code.

## Dependencies (cards / docs / files)

- Assumes **UX-PR-F is complete** (HEAD 07e75095): the single-source dedupe is what makes this a one-site edit. Confirmed on-disk — `argumentScoreModel.ts:54` is a re-export and `ArgumentScoreTracker.tsx` references by key.
- Assumes **UX-PR-D is complete**: the `cohesionPrinciple9Guard` ratchet and its `ALLOWLIST_P9` exist and are the mechanism this card must keep in sync.
- Reads `STANDING_BAND_COLOR` at `argumentGameSurfaceModel.ts:839-849`; the re-export at `argumentScoreModel.ts:54`; the tracker key-references at `ArgumentScoreTracker.tsx:49,71-74`.
- Does NOT block a specific downstream card, but is the precondition for any later "magnitude legend / Inspect readout" copy that describes the indigo ramp.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | **WCAG-AA text-contrast regression on the Mediator readout (RESOLVED IN THIS CARD).** With the ruled hues, `ArgumentScoreTracker.tsx:62` band label TEXT (11px, weight 800, needs 4.5:1) on card bg `#0f172a` would fail: `#4f46e5` approx 2.84:1, `#6366f1` approx 4.0:1. | Operator ruled the fix ships in this card: band-label TEXT renders in `SURFACE_TOKENS.textPrimary` (approx 14.5:1), magnitude hue stays on color-bar / sparkline / edge only. The ruled hexes are NOT altered. Full spec in "A11y text/bar split". After the fix, no text depends on a standing hue for contrast. No new test breaks (no gated contrast test exists; no test pins the band Text color). |
| 2 | **P9 completeness ratchet breaks if `#b91c1c` is not removed from the allowlist.** The bidirectional test (`cohesionPrinciple9Guard.test.ts:202-213`) fails on a stale allowlist entry. | Shrink the allowlist to `['#ef4444', '#dc2626']` in the SAME change. Verified `#b91c1c` occurs exactly once in the file (the removed value). |
| 3 | **Doctrine-scanner apostrophe hazard.** Three doctrine scanners read `argumentGameSurfaceModel.ts` (`uxOneOneSixDoctrine`, `timelineNodeActionDockDoctrine`, `metadataDoctrineAnchors`). Per the repo lesson, a naive quote-parity scanner can be poisoned by a lone apostrophe in a comment. | Any NEW comment added to `argumentGameSurfaceModel.ts` must be apostrophe-free and use `(issue 931)` not `#931`. Prefer NO new comment, or a single terse apostrophe-free line. The value edit itself adds no strings. |
| 4 | Touching an unchanged key (`neutral` / `unscored` / `not_enough_signal`) by accident. | Diff-review the literal; only 6 lines may move. The value-pin catches any drift. |
| 5 | Reviewer mistakes the intended wrong==right hue for a bug. | The value-pin and this doc record the ruling; the P9 comment and (recommended) map header comment name issue 931. |

## Out of scope

- No vocabulary or label change: `standingBandCopy.ts` soft labels, glyphs, and textures are untouched (they are the valence carriers).
- No tone re-hue (`TONE_BAND_COLOR`, incl. `#dc2626`), no kind re-hue (`TIMELINE_KIND_COLORS`, incl. `#ef4444`), no dropped-tag re-hue (`TAG_LABEL_MAP`). Those remaining reds are the separate tone/kind burn-down, not this card.
- No scoring-logic change: `inferStandingBand`, `bandToScore`, `scoreToBand`, band thresholds — untouched.
- No change to `argumentScoreModel.ts` source (it auto-updates via the single-source re-export). `ArgumentScoreTracker.tsx` IS edited — but only the ~3-line text/bar split (band-label text color + one import); no other tracker behavior, copy, or layout changes.
- No follow-up a11y card: the contrast fix ships here (operator ruling), not as a separate card.
- No change to the three unrelated `errorText: '#b91c1c'` usages in `DebateListScreen.tsx`, `ArgumentTreeScreen.tsx`, `PreSendReviewSheet.tsx` (legit app-failure reds, outside the P9 scan set and outside this card).
- No migration, no Edge Function, no DB, no `.env`, no dependency.

## Doctrine self-check

- **cdiscourse-doctrine 1 (score is analysis, never truth):** the ramp makes color encode magnitude only; it removes the last place hue implied valence, strengthening the "color never adjudicates" posture. Bands stay gameplay-analysis; score still never blocks posting; no verdict token is introduced.
- **cdiscourse-doctrine 9 (plain language):** no internal code enters any user-facing string; the change is hex-only.
- **cdiscourse-doctrine 6/7 (secrets / no AI in app):** no secret, no provider import, no network — pure literal edit.
- **timeline-grammar (color is not the only signal; shape/stroke primary):** verified `argumentVisualGrammar.ts` `strokeForBand` distinguishes bands by stroke (pretty_wrong -> dashed weight 1; pretty_right -> solid weight 3; completely_right -> double) keyed on the band ENUM, not the hex. Wrong vs right stays visually distinct after the hue merge.
- **point-standing-economy (bands are standing, not verdicts):** the band enum, thresholds, and economy are untouched; only the render color moves.
- **accessibility-targets (color independence + contrast):** verified valence lives in the soft label (`standingBandCopy.ts`: `Needs work` vs `Well supported`), the glyph (`0x25CC` vs `0x25D0`), and the texture (`diagonal_stripes` vs `solid_fill`), plus stroke — all hue-independent. No new color-only signal is introduced. The AA text-contrast shortfall the ruled hues would have created on the tracker band label is FIXED in this card (band-label text → `SURFACE_TOKENS.textPrimary` approx 14.5:1; hue kept only on non-text bar/sparkline/edge), so the change strengthens color-independence rather than trading it for magnitude coloring.
- **No consumer assumes wrong/right are distinct colors:** verified. `railSegmentModel.ts` does not reference standing colors (treats gradient stops as opaque). `boardDiagnostics.ts` references the band enum, no standing hex. `argumentVisualGrammar.ts` keys on the enum. The only readers of the resolved hex are the edge gradient stop (opaque rail) and the tracker colorBar/band-text/sparkline (decorative; sign also encoded by sparkline bar height and by the soft label).

## New-hex check

All three incoming hexes already exist in the codebase — no truly novel hex is introduced, and no "no-new-hex" / palette guard applies (verified: no dark-theme / surface-token / brand / palette test scans `argumentGameSurfaceModel.ts` or `STANDING_BAND_COLOR`):

- `#6366f1` — already in `argumentGameSurfaceModel.ts` (`TIMELINE_KIND_COLORS.claim`) and `designTokens.ts:103` (`active.borderColor`); indigo-500.
- `#818cf8` — already in `argumentGameSurfaceModel.ts` (`TONE_BAND_COLOR.measured`, `TAG_LABEL_MAP.logic_challenge`) and 4 other source files; indigo-300.
- `#4f46e5` — already in `designTokens.ts:453` (`primary.bg`, indigo-600) and 4 other files; NEW to `argumentGameSurfaceModel.ts` but not to the repo.

All three are indigo, so `isRedFamily` classifies them false (hue approx 234-243 degrees) — they add nothing to the P9 red set and need no allowlisting. **Recommendation: keep literal hexes in the map, matching the ruled values exactly.** A `designTokens` reference exists for two of the three (`active.borderColor`, `primary.bg`), but referencing them would (a) couple standing colors to unrelated button-primary / active-border semantics, (b) change the file import graph, and (c) break the flat `Record<TimelineStandingBand, string>` literal shape that the value-pin and the P9 hex-literal scan depend on. Literals are lower-risk and are what the operator ruling specifies.

## Operator steps (if any)

None — pure code change. No `supabase db push`, no `functions deploy`, no env var. Merge-as-deploy of the client bundle follows the normal path; nothing operator-gated in this card.

## Brief interpretation ledger (orchestrator-authored design)

- **Operator-ruled (verbatim, not re-litigated):** the 9-key ramp values and the "magnitude in one indigo family, valence in the soft label" doctrine; AND (this revision) the a11y resolution — fix the contrast in this card, band-label TEXT to a fixed high-contrast token, magnitude hue on color-bar / sparkline / edge only, no follow-up card. Both taken exactly as given.
- **Derived from on-disk codebase survey (this session):** the single-source re-export fact (`argumentScoreModel.ts:54`); the tracker key-reference fact; the zero-snapshot fact; the P9 allowlist target `['#ef4444', '#dc2626']`; the `#b91c1c`-occurs-once fact; the no-palette-guard fact; the color-independence carriers (stroke/glyph/texture/soft-label); the "no consumer branches on the resolved hex" fact; the "only ArgumentScoreTracker colors text from a standing hue" fact; the `SURFACE_TOKENS.textPrimary` approx 14.5:1 contrast computation; the "no test pins the band Text color" fact.
- **Orchestrator judgment (design defaults, reviewer may adjust):** recommending literals over token refs for the map values; `textPrimary` (not `textSecondary`) for the band label; recommending `(c3)` and the `isRedFamily` positive table stay unchanged; recommending an apostrophe-free map header comment rather than none.
- **Operator-deferred review:** none outstanding. The prior draft's contrast open item was ruled and folded into scope.

## Operator ruling (resolved) — a11y contrast

The first draft flagged that the ruled hues drop the band-label TEXT below WCAG-AA on the Mediator readout. The operator ruled: **fix it in this card**, do not ship the regression, do not file a follow-up. The fix is the doctrine-faithful one — band-label TEXT renders in `SURFACE_TOKENS.textPrimary`, the magnitude indigo hue lives on the color-bar + sparkline + edge gradient stops only. Fully specified in "A11y text/bar split" above. No open questions remain for the operator.
