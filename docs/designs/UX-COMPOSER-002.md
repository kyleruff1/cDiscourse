# UX-COMPOSER-002 — Collapse the create-screen framing taxonomy behind one optional disclosure

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 — Recorded Wit, Private Memory, and Single-Composer UX (GitHub epic #826)
**Release:** Wave 1 UX-simplification
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/828
**Branch:** `feat/UX-COMPOSER-002-<slug>`
**Design substrate:** `docs/designs/PRODUCT-REDIRECT-RECORDED-WIT-PRIVATE-MEMORY-2026-06-28.md` §2.1, §4 (line 203), §6

## Goal (one paragraph)

The Start-an-argument create screen (`StartArgumentPage.tsx`) is declaration-first — the typed declaration *becomes* the root argument — which is already aligned with the one-composer north star. But below the declaration it renders an "Optional framing" block of three single-select taxonomy groups (argument scheme; disagreement strategy, split into labelled clusters; disagreement cause) at lines 457–520. All three are optional, all are disclaimed as non-authoritative, and collectively they are the largest visual mass on the screen — turning "type one line and go" into a survey. This card removes that mass from the default view by moving all three groups behind a single optional "Add framing (optional)" disclosure that is collapsed on first render, expands on tap, and never gates submit. Doctrine constraints that shape the design: the taxonomy is **self-declared framing metadata** the author chooses about their *own* move (never a machine classification, never a verdict — `cdiscourse-doctrine` §1, §10a); the disclosure copy must be plain and non-verdict (§1, §9); the affordance must meet the a11y bar (`accessibility-targets`: role `button`, `accessibilityState.expanded`, ≥44px, reduce-motion-safe snap).

## Decision — KEEP behind disclosure (do NOT drop from creation)

**Data-flow trace (the deciding evidence):**

1. The three taxonomy values are held only in component `useState`:
   - `argumentScheme` (`StartArgumentPage.tsx:130`)
   - `disagreementStrategy` (`:131–132`)
   - `disagreementCause` (`:133–134`)
2. The submit payload built at `:203–216` (`const input: CreateDebateInput = { … }`) contains **only** `title`, `resolution`, `description`, `visibility`, and the optional `invite`. **None of the three taxonomy values are read into it.**
3. `CreateDebateInput` (`src/features/debates/types.ts:43`) has **no** framing fields — no `argumentScheme`, `disagreementStrategy`, or `disagreementCause`.
4. Repo-wide grep for `argumentScheme|disagreementStrategy|disagreementCause` returns hits in exactly two files: `StartArgumentPage.tsx` and `startArgumentTaxonomy.ts`. Grep for the id types (`ArgumentSchemeId|DisagreementStrategyId|DisagreementCauseId|StartArgumentDraft`) adds only `index.ts` (re-exports), `startArgumentTaxonomy.test.ts` (unit tests of the constants), and `docs/core/current-status.md` (prose). **No downstream surface consumes any of these values.**

**Conclusion:** the taxonomy is, today, **write-only ceremony** — the selected values are collected and then discarded on submit. On pure data-flow that argues for dropping.

**Why we KEEP it behind a disclosure anyway (conservative default per the card brief and PRODUCT-REDIRECT-001 §4 line 203):**

- The card brief instructs: "prefer the conservative disclosure option unless dropping is clearly safe." Dropping is *safe* (nothing reads the values) but not *clearly cheaper or lower-risk*: removing the option constants would delete `ARGUMENT_SCHEME_OPTIONS`, `DISAGREEMENT_STRATEGY_OPTIONS`, `DISAGREEMENT_CAUSE_OPTIONS`, the cluster helpers, and the HiTODS honesty flags from `startArgumentTaxonomy.ts`, which would force a rewrite/deletion of the dedicated `__tests__/startArgumentTaxonomy.test.ts` suite and the `index.ts` re-exports — a strictly larger and less reversible blast radius than collapsing the render.
- Keeping the state + constants intact preserves the clean option for a *future* card to thread these values into the create payload (they are the natural inputs to the "few friendly optional flags" layer PRODUCT-REDIRECT-001 describes) without re-adding UI.
- The disclosure option satisfies **every** acceptance criterion: no taxonomy selectors visible by default; framing lives behind exactly one optional affordance; framing never gates submit (it already does not — the values are not even in the submit guard).

**Decision: collapse all three groups behind one "Add framing (optional)" disclosure, collapsed by default. Keep the taxonomy state and `startArgumentTaxonomy.ts` unchanged. Do not thread values into the payload in this card (out of scope — payload contract is frozen).**

## Data model

**No new data model.** No change to `startArgumentTaxonomy.ts` types or constants. No change to `CreateDebateInput`. The three taxonomy state fields keep their existing `'unspecified'` defaults (`StartArgumentPage.tsx:130–134`) and are still never threaded into the submit payload — exactly as today when the user skips framing.

One new piece of local UI state in `StartArgumentPage`:

```ts
// Collapsed by default: no framing selectors visible on first render.
const [framingExpanded, setFramingExpanded] = useState(false);
```

## File changes

- **modified:** `src/features/arguments/startArgument/StartArgumentPage.tsx` (net change small, roughly +25 / −8 lines)
  - Add one `useState` line for `framingExpanded` (near the other `useState`s at `:122–135`).
  - Add two copy constants to the in-file `COPY` object (`:68–93`): `framingToggleCollapsed` and `framingToggleExpandedHint` (or a single `framingToggleLabel`). See disclosure spec.
  - Restructure the framing `<View testID="start-argument-taxonomy">` block (`:457–520`): the section keeps its outer wrapper + `sectionLabel` + `disclaimer` is MOVED to render only when expanded (or the label becomes the toggle button — see edit spec). Insert a single `<Pressable>` disclosure control (`testID="start-argument-framing-toggle"`) directly under the declaration/surface sections. Wrap the three existing taxonomy groups (`start-argument-scheme`, `start-argument-strategy`, `start-argument-cause` — unchanged internally) in `{framingExpanded ? ( … ) : null}`.
  - Add StyleSheet entries for the toggle button (reuse existing tokens; no new token file).
- **modified:** `__tests__/StartArgumentPage.test.tsx` — update the one describe block that asserts taxonomy renders by default (`:71–82`). See `testsToUpdate`.
- **new:** `__tests__/startArgumentFramingDisclosure.test.tsx` — the disclosure behavior + a11y + doctrine suite. See `newTestPath` / `testContract`.
- **NOT modified:** `startArgumentTaxonomy.ts`, `index.ts`, `create-argument-room` Edge Function, `CreateDebateInput`, the visibility/invite block, the surface selector, the invite-link success screen, `docs/core/current-status.md`.

## API / interface contracts

**No prop or exported-signature changes.** `StartArgumentPageProps` (`:97–117`) is unchanged. The taxonomy option constants and helpers exported from `startArgumentTaxonomy.ts`/`index.ts` are unchanged.

Internal component contract (the disclosure):

```tsx
<Pressable
  onPress={() => setFramingExpanded((v) => !v)}
  accessibilityRole="button"
  accessibilityLabel={COPY.framingToggleLabel}      // "Add framing (optional)"
  accessibilityState={{ expanded: framingExpanded }}
  hitSlop={TOUCH_TARGET.hitSlopCompact}
  style={styles.framingToggle}                        // minHeight: 44
  testID="start-argument-framing-toggle"
>
  <Text style={styles.framingToggleGlyph}>{framingExpanded ? '▾' : '▸'}</Text>
  <Text style={styles.framingToggleLabel}>{COPY.framingToggleLabel}</Text>
</Pressable>

{framingExpanded ? (
  <View testID="start-argument-framing-groups">
    {/* existing disclaimer + the three unchanged taxonomy groups */}
  </View>
) : null}
```

The three inner groups (`start-argument-scheme` / `-strategy` / `-cause` and their per-option chips) keep their **exact existing testIDs, labels, roles, and onPress handlers**. Only their mount is now conditional.

## Edge cases

- **Empty inputs / never opening the disclosure:** submit must work with the disclosure closed and all three taxonomy values at `'unspecified'`. `canSubmit` (`:186–187`) already depends only on `isStartArgumentDraftSubmittable({ declaration })` + `creation.valid` — it does not reference any taxonomy value, so a closed disclosure has zero effect on submit. Verified by the payload trace above.
- **Open → select → collapse → submit:** selecting a chip while expanded, then collapsing, then submitting: the selection persists in state (state is not reset on collapse) but is still not threaded into the payload — identical outcome to today. Test asserts the payload has no framing fields regardless.
- **Toggling repeatedly:** pure `setState((v) => !v)`; idempotent, no side effect, no console.
- **Reduce-motion:** the disclosure is a conditional mount (`{expanded ? … : null}`), i.e. a **snap** show/hide with no animation — this is reduce-motion-safe by construction. No `Animated` / `LayoutAnimation` is introduced, so there is nothing to gate on `AccessibilityInfo.isReduceMotionEnabled()`. (Documented so a reviewer does not expect a reduce-motion listener.)
- **Permission-denied / offline / concurrent edits:** not applicable — this card touches only client-side render/collapse state; no network, no writes, no auth path.
- **Doctrine edge:** the collapsed toggle must not imply the framing is a classification or judgment. Copy is "Add framing (optional)"; the existing non-verdict disclaimer (`taxonomyDisclaimer`, `:82–83`) still renders *inside* the expanded region. Heat/score/truth are untouched — this card surfaces no standing, no classifier output.

## Test plan

- **`__tests__/startArgumentFramingDisclosure.test.tsx`** (new) covering:
  - default render shows the toggle but **no** taxonomy groups (`queryByTestId('start-argument-scheme')` / `-strategy` / `-cause` all null; `start-argument-framing-groups` null);
  - the toggle exposes `accessibilityRole="button"`, `accessibilityState.expanded === false` initially;
  - pressing the toggle reveals all three groups (`getByTestId('start-argument-scheme')` etc. truthy) and flips `accessibilityState.expanded` to `true`;
  - pressing again collapses (groups null again) — toggle is idempotent;
  - the toggle meets the 44px hit target (flattened `minHeight >= 44`);
  - **submit with the disclosure never opened** calls `onCreate` and the payload has **no** `argumentScheme`/`disagreementStrategy`/`disagreementCause` keys (guards write-only-ceremony contract and no-gate);
  - selecting a chip inside the open disclosure still leaves the submit payload free of framing fields (threading unchanged — same as today);
  - ban-list over the new copy string(s): no verdict tokens (`winner`, `loser`, `correct`, `true`, `false`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `popular`, `trending`, `viral`, `troll`) and no snake_case internal-code leak.
- **`__tests__/StartArgumentPage.test.tsx`** (update): the "renders the three optional taxonomy selectors" test (`:71–82`) must be changed so it presses the toggle first, OR asserts the groups are absent by default and present after expansion. See `testsToUpdate`.
- **Isolated re-run (mandatory, per known flake):** `__tests__/startArgumentInviteLinkBox.test.tsx` renders `StartArgumentPage` and is a known full-suite parallel-load flake that passes isolated. Because this card edits `StartArgumentPage`, the implementer MUST run it ISOLATED and confirm it passes at its current count — do not dismiss a failure there as "the known flake" without an isolated re-run proving green. Also run `__tests__/startArgumentVisibilityInvite.test.tsx` and `__tests__/StartArgumentPage.test.tsx` isolated (both render the page).

## Dependencies (cards / docs / files)

- Reads the existing submit payload builder `StartArgumentPage.tsx:203–216` and `CreateDebateInput` (`src/features/debates/types.ts:43`) — the trace that grounds the keep-not-drop decision.
- Reuses the house disclosure pattern from `ArgumentReplySidecar.tsx:135–143` (`Pressable` + `onPress={() => setX((v) => !v)}` + `accessibilityRole="button"` + `accessibilityState={{ expanded }}` + conditional render).
- Reuses `SURFACE_TOKENS`, `SPACING`, `RADIUS`, `TOUCH_TARGET` from `src/lib/designTokens` (already imported at `:35`).
- Does **not** depend on UX-COMPOSER-001 (#827, the visibility/invite default-Private gate) — that block is out of scope and untouched. The two cards edit disjoint regions of the same file; a rebase may be needed if both land, but there is no logical coupling.
- Does not block any card; it is part of the Wave 1 UX-simplification set.

## Risks

- **Same-file parallel-merge with UX-COMPOSER-001:** both cards edit `StartArgumentPage.tsx`. UX-COMPOSER-002 touches `:457–520` (framing) and adds one `useState`; UX-COMPOSER-001 touches `:126–127,186–187` (visibility gate). Regions are disjoint but a merge conflict on the `useState` cluster (`:122–135`) is possible. Mitigation: the implementer inserts the new `framingExpanded` state adjacent to the taxonomy states (`:130–134`), not at the top, to minimize overlap; and does NOT touch `docs/core/current-status.md` (parallel-merge avoidance, per card brief).
- **Known flake in blast radius:** `startArgumentInviteLinkBox.test.tsx` flakes under full-suite parallel load. The implementer must re-run it isolated and prove green — this is the single highest-risk verification step. Its source-scan guard (`PAGE_CODE` must contain no `console.*`) means the new disclosure code must introduce no `console` call.
- **`StartArgumentPage.test.tsx:71–82` will fail if not updated** — it asserts the three groups render by default. This is an expected, in-scope update, not a regression. Do not leave it stale.
- **Copy ban-list:** any new copy string is scanned by the new suite; keep "Add framing (optional)" and any hint plain and verdict-free.
- **No dep, no migration, no Edge change, no provider spend** — nothing to deploy.

## Out of scope

- Threading the taxonomy values into `CreateDebateInput` / the `create-argument-room` payload (the payload contract is explicitly frozen for this card; a future "friendly optional flags" card may do this).
- Dropping the taxonomy constants / `startArgumentTaxonomy.ts` (decided against; see Decision).
- The default-Private visibility gate + invite logic (UX-COMPOSER-001 / #827).
- The declaration field, `pickDisplayTitle` title derivation, the "Open into" surface selector, the invite-link success screen.
- The reply composer / OneBox / `ArgumentComposer` always-visible type+side pickers (UX-COMPOSER-004).
- Draft persistence for the create flow (noted in PRODUCT-REDIRECT-001 §, separate card).
- Any Edge / mcp-server / migration / config / validator / ban-list-module / familyRegistry / prompt change.

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the framing is self-declared metadata, not a verdict; nothing new labels a person/claim; submit is unaffected (framing never gated it and still does not). No score/standing surfaced.
- **cdiscourse-doctrine §2/§3 (heat / popularity):** untouched — no heat, engagement, or amplification signal on this screen.
- **cdiscourse-doctrine §4/§7 (no AI on client):** no classifier/AI/MCP call added; the existing source-scan test (`StartArgumentPage.test.tsx` "no classifier / AI / MCP") continues to pass — the disclosure adds only React state + Pressable.
- **cdiscourse-doctrine §9 (plain language):** new copy is plain English ("Add framing (optional)"); no internal snake_case code is echoed; ban-list test enforces it.
- **cdiscourse-doctrine §10a (Observation vs Allegation):** the taxonomy remains *author self-declared framing about their own move* — not a machine Observation and not an Allegation about another person. Collapsing it does not change its provenance.
- **cdiscourse-doctrine §6/§8 (secrets / RLS):** no secrets, no DB, no RLS touched.
- **accessibility-targets:** toggle is a `Pressable` with `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, ≥44px (`minHeight: 44` + `hitSlop`), color-independent glyph (▸/▾) carries the expanded state in addition to any color; conditional-mount = snap, reduce-motion-safe by construction.
- **test-discipline:** production edit ships with tests in the same card (new suite + updated existing suite); test count goes up.

## Operator steps (if any)

None — pure client-side UI change. No migration, no Edge deploy, no env var, no provider spend.
