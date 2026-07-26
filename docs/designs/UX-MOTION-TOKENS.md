# UX-MOTION-TOKENS — link Animated.timing duration literals to the MOTION token scale

**Status:** Design draft
**Epic:** Design-token adoption (UX-PR-E motion scale / P2 polish)
**Release:** UX Wave-2 (P2 follow-ups)
**Issue:** https://github.com/kyleruff1/debate-constitution-app/issues/944 (issue 944)

> Scanner-hazard note (for the implementer): reference the issue as `(issue 944)`, never `#944`,
> and keep every comment you add to a scanned `src/**` file APOSTROPHE-FREE. The naive doctrine
> quote-parity scanner (`uxOneOneTwoDoctrine`) treats a single stray apostrophe in any comment as
> an unbalanced string and can flag distant innocent lines. Run the full suite before handoff.

---

## Goal (one paragraph)

PR-E (UX-PR-E, F-26) landed a motion duration scale in `src/lib/designTokens.ts` —
`MOTION = { fastMs: 140, baseMs: 160, slowMs: 180 }` — as inert data with an explicit note that
"Consumers (Wave-2 P2-12) thread the existing `useReduceMotion` hook through the uncovered Animated
sites." P2-12 (issue 941) did the reduce-motion half. This card does the remaining, deliberately
tiny half: replace the hard-coded `duration:` millisecond literals at the six `Animated.timing`
sites in the room surface with references to the exact-equal `MOTION` token, so the duration scale
has a single source of truth. This is a **byte-identical behavior change** — every swap maps a
literal to a token whose value is EXACTLY equal, so the compiled animation timing is unchanged. No
doctrine surface is touched (no user-facing strings, no score, no truth labels, no data, no network,
no AI). The doctrine constraint that shapes this card is minimalism: do-not-overbuild — only the
three canonical durations (140/160/180) that already have a token get linked; any other duration
stays a literal, and a token swap whose value differs from the literal would be a forbidden,
un-gated timing change and is explicitly out of scope.

---

## Data model

**No new data model.** `MOTION` already exists and is unchanged:

```ts
// src/lib/designTokens.ts:709-714 (UNCHANGED by this card)
export const MOTION = {
  fastMs: 140 as const,
  baseMs: 160 as const,
  slowMs: 180 as const,
} as const;
export type MotionKey = keyof typeof MOTION;
```

Each member is a `const`-literal type (`140 as const`, etc.), so `MOTION.slowMs` has type `180`,
identical to the literal it replaces — no widening, no type churn.

---

## Complete duration enumeration (grep-confirmed, all six files read in full)

Every `Animated.timing` / `Animated.spring` / `Animated.loop` `duration` in the six target files.
A case-insensitive `duration` sweep across the six files returned EXACTLY the rows below — each file
has precisely ONE `Animated.timing` with a `duration`; there are NO `Animated.spring` and NO
`Animated.loop` calls in any of the six (springs carry no `duration`; no loops exist). Value-equality
is proven by pasting the MOTION token value next to each literal.

| # | File | Line | Current duration | Literal value | Maps to | Token value | Equal? | Action |
|---|------|------|------------------|---------------|---------|-------------|--------|--------|
| 1 | `src/features/arguments/ArgumentComposerDock.tsx` | 194 | `duration: 180` | 180 | `MOTION.slowMs` | 180 | ✅ | swap literal → token |
| 2 | `src/features/arguments/ArgumentSideActionRail.tsx` | 264 | `duration: 160` | 160 | `MOTION.baseMs` | 160 | ✅ | swap literal → token |
| 3 | `src/features/arguments/openIssuesRail/OpenIssuesRail.tsx` | 155 | `duration: 160` | 160 | `MOTION.baseMs` | 160 | ✅ | swap literal → token |
| 4 | `src/features/mediator/DisagreementPointsRail.tsx` | 264 | `duration: 160` | 160 | `MOTION.baseMs` | 160 | ✅ | swap literal → token |
| 5 | `src/features/arguments/TimelineMiniMap.tsx` | 304 | `duration: 140` | 140 | `MOTION.fastMs` | 140 | ✅ | swap literal → token |
| 6 | `src/features/arguments/oneBox/Popout.tsx` | 128 | `duration: POPOUT_FLASH_DURATION_MS` | (named const = 140) | see §Popout const | 140 | ✅ | point the CONST at the token (not the use-site) |

**No "keep literal" rows exist.** Every duration in the six files is exactly 140, 160, or 180 and
has a matching token. There is no duration in these files that is not 140/160/180, so nothing stays
a raw literal for a "no matching token" reason.

### Popout const (row 6) — decision

`POPOUT_FLASH_DURATION_MS` is defined and exported in the SAME file, not in a constants module:

```ts
// src/features/arguments/oneBox/Popout.tsx:50-51
/** Flash open/close duration (logical ms) — inside the design's 120-160 band. */
export const POPOUT_FLASH_DURATION_MS = 140;
```

The use-site at line 128 already reads the named const (`duration: POPOUT_FLASH_DURATION_MS`), so
the use-site is already clean. Its value (140) equals `MOTION.fastMs` (140).

**RECOMMENDATION: point the CONST at the token — do NOT edit the use-site.**

```ts
// AFTER (recommended)
export const POPOUT_FLASH_DURATION_MS = MOTION.fastMs;
```

Rationale: this keeps a single source of truth (the const is the one place the number lives; the
use-site and the exported API both flow from it), it preserves the exported symbol
`POPOUT_FLASH_DURATION_MS` that other modules and tests depend on, and 140 → `MOTION.fastMs` (140)
is byte-identical. The const KEEPS its type `140` because `MOTION.fastMs` is `140 as const`. Keep
the existing JSDoc comment (it stays true — 140 is inside the 120-160 band). If the implementer
prefers, the comment may add "= MOTION.fastMs" but must stay apostrophe-free; note the current
comment already contains an apostrophe ("design's"), which is PRE-EXISTING and untouched — do not
introduce a NEW apostrophe.

---

## Per-file import wiring + pin verdict

`MOTION` is a NAMED export of `src/lib/designTokens`. Wire it at the correct relative depth per file.
Four of the six files already import from `designTokens` (extend the existing import); two do not
(add a new import). Relative depths are confirmed against the P2-12 `useReduceMotion` import that
already lives in each file.

| File | designTokens import today | Depth to `designTokens` | Import action | Pin verdict |
|------|---------------------------|-------------------------|---------------|-------------|
| `ArgumentComposerDock.tsx` | `import { SURFACE_TOKENS } from '../../lib/designTokens';` (line 78) | `../../lib/designTokens` | EXTEND → `{ MOTION, SURFACE_TOKENS }` | Not zero-diff pinned (see below); token-presence pin preserved |
| `ArgumentSideActionRail.tsx` | none | `../../lib/designTokens` | ADD new import line | Not pinned |
| `openIssuesRail/OpenIssuesRail.tsx` | multi-line import ending `} from '../../../lib/designTokens';` (line 50) | `../../../lib/designTokens` | EXTEND the named list (add `MOTION,`) | Not pinned |
| `mediator/DisagreementPointsRail.tsx` | multi-line import ending `} from '../../lib/designTokens';` (line 44; already pulls `TOUCH_TARGET`, `TYPOGRAPHY`) | `../../lib/designTokens` | EXTEND the named list (add `MOTION,`) | Not pinned |
| `TimelineMiniMap.tsx` | none | `../../lib/designTokens` | ADD new import line | Not pinned |
| `oneBox/Popout.tsx` | `import { SURFACE_TOKENS, RADIUS, SPACING } from '../../../lib/designTokens';` (line 40) | `../../../lib/designTokens` | EXTEND → add `MOTION` | Not zero-diff pinned (see below); token-presence pin preserved |

Keep the named-import lists alphabetized only if the file already is; otherwise match the file's
existing ordering to keep the diff minimal (do-not-reformat).

### Pin / boundary analysis (uxOneOneFive + uxOneOneSix)

Two read-only boundary suites were checked in full:

- **`__tests__/uxOneOneFiveReadOnlyBoundary.test.ts`** — a `git diff main` ZERO-DIFF gate over an
  enumerated `READ_ONLY_PATHS` list.
  - `ArgumentComposerDock.tsx` was **removed** from this zero-diff list by A11Y-PR0 (#913); it now
    appears only as an explanatory NOTE comment (lines 129-142), NOT as an active pinned path.
  - `Popout.tsx` was **removed** from this zero-diff list by A11Y-PR0 (#913); it appears only as a
    NOTE comment (lines 176-190), NOT as an active pinned path.
  - The other four files (`ArgumentSideActionRail`, `OpenIssuesRail`, `DisagreementPointsRail`,
    `TimelineMiniMap`) are not in the list at all.
  - **Verdict: this suite pins NONE of the six.** No zero-diff line is touched.

- **`__tests__/uxOneOneSixReadOnlyBoundary.test.ts`** — a `requiredApi` TOKEN-PRESENCE suite (it
  asserts named strings still appear; it is NOT a zero-diff gate).
  - `ArgumentComposerDock.tsx` (line 185) requires the token `ArgumentComposerDock`. The swap +
    import add do not remove that token → stays green.
  - `Popout.tsx` (line 190) requires `Popout` and `/onRequestClose|onDismiss/`. Untouched by the
    swap → stays green.
  - `designTokens.ts` (lines 66-78) requires `BRAND`, `SURFACE_TOKENS`, `SPACING`, etc. — **this
    card does not modify `designTokens.ts` at all** (MOTION already exists), so this is moot.
  - The other four files are not enumerated here.
  - **Verdict: token-presence pins for ComposerDock + Popout are preserved by construction.**

**Overall pin verdict: NO house-way relaxation and NO companion pin are required.** Every one of
the six swaps lands outside any active zero-diff boundary, and every token-presence pin survives the
edit unchanged. This is the clean-pass case; the implementer does NOT need to relax-with-NOTE or add
a companion pin. (If a future maintainer re-adds ComposerDock/Popout to the zero-diff list, this
analysis would change — but as of base `origin/main @ 74849dde` it does not.)

---

## API / interface contracts

No public signature changes. The only exported-symbol touch is `POPOUT_FLASH_DURATION_MS`, whose
**name, export-ness, value (140), and type (`140`) are all preserved** — only its right-hand side
changes from the literal `140` to `MOTION.fastMs`. Consumers (`oneBoxPopoutChassis.test.tsx`, any
Popout caller) see no observable change.

The `Animated.timing(...)` config objects keep their exact shape — `toValue`, `duration`,
`useNativeDriver` — with `duration` now sourced from a token of equal value.

---

## Edge cases

- **Reduce-motion path unchanged.** Each site already snaps via `setValue` when
  `effectiveReducedMotion` is true and never enters the `Animated.timing` branch (P2-12 wiring).
  The token swap lives inside the tween branch only; the reduce-motion snap is untouched. Verify the
  snap branch still keys off `effectiveReducedMotion` (the P2-12 source-scan test enforces this and
  the swap does not disturb it).
- **`useNativeDriver` divergence is irrelevant to duration.** `TimelineMiniMap` uses
  `useNativeDriver: false`; the other five use `true`. Duration is orthogonal to the driver — the
  swap does not touch `useNativeDriver`.
- **No new duration introduced.** The card only replaces existing 140/160/180 literals. If the
  implementer discovers an additional `Animated.timing` with a NON-140/160/180 duration during the
  edit, it STAYS a literal (do-not-overbuild) and must be reported, not silently tokenized. (The
  exhaustive grep found none, so this should not arise.)
- **Import must not create an unused symbol.** For the two files that gain a new `MOTION` import,
  the import is used immediately at the swap site — no unused-import lint failure. For the two files
  that already import a set, extend (do not duplicate) the import specifier.
- **Do not touch `MOTION.baseMs` semantics.** Three sites map to `baseMs` (160). They are distinct
  Animated.Value instances in distinct components; sharing the token does not couple them at
  runtime — it only shares the numeric literal source. No behavioral coupling is introduced.

---

## Test plan

This repo has NO jest snapshots (byte-identity is proven by value-equality + web build, not
snapshots). The card is a pure literal→token linkage, so the test burden is small and mostly
verification that existing tests stay green.

**Existing tests that must stay green (no flip required):**

- `__tests__/uxP212ReduceMotionThreading.test.ts` — source-scan discipline. Asserts import of
  `useReduceMotion`, `useReduceMotion(<arg>)`, `effectiveReducedMotion`, `Animated.timing` present,
  `.setValue(` present, no `AccessibilityInfo`/`isReduceMotionEnabled`/`reduceMotionChanged`. The
  swap preserves all of these strings → **stays green, no edit.**
- `__tests__/uxP212ReduceMotionThreading.render.test.tsx` — renders + toggles; references duration
  only in a comment, asserts no numeric duration → **stays green, no edit.**
- `__tests__/oneBoxPopoutChassis.test.tsx:171-175` — imports `POPOUT_FLASH_DURATION_MS` and asserts
  it is within the **120-160 band** (`toBeGreaterThanOrEqual(120)` + `toBeLessThanOrEqual(160)`).
  `MOTION.fastMs` = 140 still satisfies `120 ≤ 140 ≤ 160` → **stays green, NO flip.** (This is the
  ONLY test in the tree that reads a duration constant; it is a band assertion, not an equality, so
  it does not need to change.)

**Search performed for tests that WOULD need to flip:** `grep duration:\s*(140|160|180)` across
`__tests__` returned ZERO matches; no test asserts a literal `duration: 180` / `160` / `140` as an
equality anywhere. **Therefore NO test must flip.**

**New test (RECOMMENDED — designer's call: include it): a scoped no-raw-duration ratchet.**

- File: `__tests__/uxMotionTokensDurationRatchet.test.ts` (pure fs source-scan, mirrors the P2-12
  pattern; apostrophe-free comments).
- For EACH of the six site paths, assert the source no longer contains a raw animation-duration
  literal AND that the motion linkage is present:

  ```ts
  const RAW_DURATION = /duration:\s*(?:140|160|180)\b/;      // negative
  // per file:
  expect(src).not.toMatch(RAW_DURATION);
  ```
  Plus, for the five direct sites, assert `MOTION.` appears; for `Popout.tsx`, assert
  `POPOUT_FLASH_DURATION_MS = MOTION.` appears (the const points at the token).

- **False-fire safety (checked):** the only `duration` occurrences in the six files after the swap
  are `duration: MOTION.<key>` (no digit) and `duration: POPOUT_FLASH_DURATION_MS` (no digit). The
  Popout JSDoc comment ("Flash open/close duration (logical ms) — inside the design's 120-160 band")
  does NOT match `duration:\s*(140|160|180)` — the numbers are "120-160", not `duration: 140`, and
  they are not preceded by `duration:`. There are no CSS transition strings in RN. So the regex
  cannot false-fire on a comment or a non-animation use. The ratchet is safe.
- **TDD property (a feature, not a bug):** this ratchet FAILS on `main` (the literals are still
  there) and PASSES only after the swap — it proves the swap landed. Scope it to the six enumerated
  paths only; do NOT make it a global tree scan (other, out-of-scope files may legitimately hold such
  literals — see Out of scope).

**Verification commands (gate contract):**

- `npm run typecheck` → 0 (const-literal types preserved).
- `npm run lint` → 0 (no unused imports; no reformat).
- `npm run test` → 0, count = prior + N (N = number of `it` cases in the ratchet, if included; else
  unchanged). Capture the `Test Suites: … / Tests: …` line + exit code.
- `npm run web:build` → clean Metro/web bundle (proves the token import resolves in the real bundle,
  not just under jest — jest could mask a bad relative path).

---

## Byte-identity proof plan

1. **Value-equality table (above)** proves each literal equals its token at authoring time.
2. **Type preservation:** `MOTION.<key>` is `<value> as const`, so no numeric widening; `typecheck`
   passing confirms no type drift.
3. **No behavior change:** duration is the only value swapped; `toValue`, `useNativeDriver`, easing
   (default), and the reduce-motion snap branch are all untouched. There is no easing or driver
   change, so the animation curve and duration are identical frame-for-frame.
4. **Bundle proof:** `npm run web:build` clean confirms the six imports resolve in the real bundle.
5. **Ratchet (if included):** proves the literals are gone and the token linkage is present.

There is nothing to snapshot; equality of the swapped value plus a clean build is the whole proof.

---

## Dependencies (cards / docs / files)

- Assumes **PR-E (UX-PR-E, F-26)** is complete — it authored `MOTION` in `designTokens.ts:709-714`.
  Confirmed present on base `origin/main @ 74849dde`.
- Assumes **P2-12 (issue 941)** is complete — it threaded `useReduceMotion` through five of the six
  sites (DisagreementPointsRail was A11Y-693). Confirmed: `uxP212ReduceMotionThreading.test.ts` pins
  all five. This card sits directly on top of that wiring and reuses the exact same import depths.
- Reads existing `POPOUT_FLASH_DURATION_MS` (Popout.tsx:51) and repoints it at the token.
- Blocks nothing downstream. This is a leaf-node polish card; it is the "small deferred follow-up
  from P2-12" and closes the token-adoption loop the PR-E note opened.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Wrong relative import depth passes jest (mocked) but breaks the web bundle | Low | Depths are cross-checked against the file's existing `useReduceMotion` import; `web:build` is a mandatory gate (jest mocks can hide a bad path). |
| A NEW apostrophe in a scanned comment trips the doctrine quote-parity scanner | Low | Keep added comments apostrophe-free; do not touch the pre-existing "design's" apostrophe in Popout; run full suite pre-handoff. |
| Accidental reformat of a multi-line import balloons the diff / risks a token-presence pin | Low | Extend the existing named list in place; do not reorder or reflow. |
| Over-reach: tokenizing a non-140/160/180 duration, or a swap whose token value differs | Low | None exist (exhaustive grep); rule stated explicitly — any mismatch is a forbidden ungated timing change and out of scope. |
| Ratchet false-fires on a comment | Very low | Regex requires `duration:` immediately before the digits; verified against all six files. If the implementer judges it risky in context, SKIP it (designer marked it optional) and rely on the value-equality table + web:build. |
| A future re-add of ComposerDock/Popout to the uxOneOneFive zero-diff list | Low | Documented; not the case at base HEAD. If it changes, apply the house-way relax-with-NOTE + companion pin. |

---

## Out of scope

- **No easing, driver, or `toValue` change.** Only `duration` is swapped.
- **No reduce-motion change.** P2-12 owns that; this card does not touch the snap branch.
- **No new `MOTION` key.** The scale stays `{ fastMs, baseMs, slowMs }`. If a site needed a
  non-140/160/180 duration, it would stay a literal — but none do.
- **No codebase-wide duration sweep.** Only the six enumerated files. Other files elsewhere in the
  tree may hold `duration:` literals; tokenizing them is a separate, un-scoped effort and is NOT part
  of this card. The optional ratchet is scoped to the six paths precisely to avoid pulling those in.
- **No change to `designTokens.ts`.** MOTION already exists; this card only consumes it.
- **No `Animated.spring` / `Animated.loop` work** — none exist in the six files.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels / score never blocks):** untouched. No user-facing
  string, no score, no verdict copy is added or changed. Pure internal constant linkage.
- **cdiscourse-doctrine §2-3 (heat / popularity):** N/A — no signal logic touched.
- **cdiscourse-doctrine §7 (no AI calls) / §6 (secrets):** N/A — no network, no provider, no secret.
- **cdiscourse-doctrine §9 (plain language):** N/A — no user-facing string added.
- **expo-rn-patterns (deps / primitives):** no new dependency; `MOTION` is a pure-TS token in
  `designTokens.ts`; `Animated.timing` is an existing RN core primitive. Model/token purity intact.
- **expo-rn-patterns (reduce-motion):** the reduce-motion snap path (from P2-12) is preserved
  unchanged; the token swap is confined to the tween branch.
- **test-discipline:** tests are part of done. Existing tests verified green by construction; an
  optional scoped ratchet is recommended; the byte-identity proof is value-equality + `web:build`.
- **Do-not-overbuild:** only exact-match 140/160/180 literals are linked; a value-mismatched swap is
  explicitly forbidden and flagged.

---

## Operator steps (if any)

**None — pure client-side code change.** No migration, no Edge Function deploy, no env var, no
`supabase`/`netlify` action. Merge-as-deploy of the web bundle follows the normal path; nothing
operator-gated is introduced by this card.

---

## One-paragraph summary (reviewer check-against)

UX-MOTION-TOKENS links six `Animated.timing` duration literals in the room surface to the existing
`MOTION` token scale (`designTokens.ts:709-714`): `ArgumentComposerDock:194` `180 → MOTION.slowMs`,
`ArgumentSideActionRail:264` / `OpenIssuesRail:155` / `DisagreementPointsRail:264` `160 →
MOTION.baseMs`, `TimelineMiniMap:304` `140 → MOTION.fastMs`, and `Popout` by repointing the exported
`POPOUT_FLASH_DURATION_MS` const (currently `= 140`) at `MOTION.fastMs` rather than editing its
use-site. Every swap is value-identical (token value pasted next to each literal proves it), so
behavior is byte-identical; no easing/driver/reduce-motion/`toValue` change. Four files extend an
existing `designTokens` import; `ArgumentSideActionRail` and `TimelineMiniMap` gain a new
`MOTION` import (depths: `../../lib/designTokens` for the four `arguments/` + `mediator/` files,
`../../../lib/designTokens` for `oneBox/Popout` and `openIssuesRail/OpenIssuesRail`). No file among
the six is actively zero-diff pinned (uxOneOneFive relaxed ComposerDock + Popout via A11Y-PR0; the
other four are unlisted) and the uxOneOneSix token-presence pins for ComposerDock/Popout survive the
edit — so no house-way relaxation is needed. No existing test asserts a numeric duration equality;
`oneBoxPopoutChassis.test.tsx` asserts only the 120-160 band, which 140 still satisfies, so NO test
must flip. An optional scoped no-raw-duration ratchet (`/duration:\s*(?:140|160|180)\b/`, six paths
only) is recommended and verified false-fire-safe. Blast radius: 6 source files + at most 1 new test.
Proof: value-equality table + `typecheck`/`lint`/`test`/`web:build` all green. Operator steps: none.
