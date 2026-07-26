# UX-P2-4 — kind/tone palette consolidation

**Status:** Design draft
**Epic:** Epic 2 — Visual Grammar / design-cohesion burn-down (UX-PR-D principle track)
**Release:** UX polish (P2 band)
**Issue:** https://github.com/kyleruff1/debate-constitution-app/issues/937 (issue 937)

---

## Goal

Three palette maps in `src/features/arguments/` are duplicated, drifted, or living in
the wrong module. This card folds the kind palette into `designTokens.ts`, collapses the
three tone-palette copies to one canonical export, and re-hues one legacy red off pure
red. The doctrine that shapes it: COHESION principle #2 (tokens by reference), principle
#9 (red means app failure, never a content state), and the `cdiscourse-doctrine` §1 rule
that no visual may read as a verdict. UX-PR-F-prime already moved the standing bands off
a red/green valence ramp onto an indigo magnitude ramp; this card asks whether the tone
palette should follow — and deliberately does NOT answer that question, because the
answer is a product judgment, not an engineering one. See the OPERATOR DECISION section.

Part (a) and part (c) are mechanical and safe. Part (b) is the one real decision.

---

## Reality audit (pre-launch, per the scope-reality rule)

Findings that change the shape of the work versus the brief:

1. **Both `TONE_BAND_HEX` copies are module-private `const`, not exported.** The brief
   assumed a promote-one/delete-one shape. Consolidation therefore requires a NEW export,
   not a re-point of an existing one.
2. **`TIMELINE_KIND_COLORS` cannot be merged into the existing `ARGUMENT` token.**
   `ARGUMENT` (designTokens.ts:116-123) is a `{bg, fg}` pair shape pinned by a validity
   test (`designTokens.test.ts`, "every ARGUMENT entry has a valid hex bg + fg"), and its
   6 keys (`branch`) do not match the kind families (`flag`, `default`). It must be a new
   sibling export.
3. **Every red in the three scanned files is a SINGLE occurrence.** Verified by
   `grep -on` per file (see the guard table). This makes the allowlist edits exact rather
   than probabilistic.
4. **The legacy track surface is statically unreachable.** `'tracks'` appears in exactly
   two places in `src/` + `app/`: the type union (`ArgumentTreeScreen.tsx:49`) and the
   render guard (`:193`, commented "legacy lane/Tracks screen. Dev-only."). **No call site
   anywhere passes `viewMode='tracks'`**; the prop defaults to `'tree'`. Part (c) is
   therefore a **zero-pixel change on production screens**. This does not block it — its
   value is guard-ratchet hygiene — but the operator should know they are not buying a
   visible improvement. Audit RUNTIME-CHECK #3 (tree-lens / legacy-track PROD
   REACHABILITY, OPEN) is corroborated, not closed, by this static finding: static
   unreachability is strong evidence, but only an eyes-on runtime check can close it.
5. **The drifted `TONE_BAND_COLOR` and the `TONE_BAND_HEX` pair are BOTH live on the same
   rail**, at different layers. This is the single most important fact for part (b) and
   the brief did not state it. See "Where tone color actually lands" below.

Effort re-estimate: unchanged for (a) and (c). Part (b) is smaller in code than it looks
(one export, three call sites) and larger in judgment than it looks.

---

## Data model

No new data model. No schema change, no migration, no Edge Function, no network call.
Every change is a compile-time constant relocation or a hex value edit in pure-TS /
component modules.

---

## Part (a) — fold `TIMELINE_KIND_COLORS` into designTokens

### Current state

`src/features/arguments/argumentGameSurfaceModel.ts:824-832`:

```ts
export const TIMELINE_KIND_COLORS: Record<TimelineKindColorFamily, string> = {
  claim: '#6366f1',       // indigo
  challenge: '#f97316',   // orange/red
  evidence: '#06b6d4',    // cyan/green
  clarify: '#f59e0b',     // amber
  concede: '#a855f7',     // purple
  flag: '#ef4444',        // red/slate
  default: '#475569',     // slate
};
```

### Complete consumer enumeration

Production consumers (5 sites across 4 files):

| File | Line | Use |
| --- | --- | --- |
| `argumentGameSurfaceModel.ts` | 873 | `pickKindColor` → `TIMELINE_KIND_COLORS[getKindFamily(kind)]` |
| `argumentGameSurfaceModel.ts` | 1414 | `const kindColor = TIMELINE_KIND_COLORS[kindColorFamily]` (node VM) |
| `argumentGameSurfaceModel.ts` | 1671-1676 | timeline legend rows (claim / challenge / evidence / clarify / concede / flag) |
| `room/ringsideFeedModel.ts` | 150 | `spineColor = TIMELINE_KIND_COLORS[family] ?? .default` |
| `timelineMiniMapModel.ts` | 37, 267 | mini-map marker fill |
| `ArgumentTimelineMap.tsx` | 23, 1462-1463 | imported + `void`-referenced to defeat tree-shaking |

Test consumers: `__tests__/argumentTimelineMap.test.ts` (23, 157-158, 183-184) asserts
edge gradient stops equal `TIMELINE_KIND_COLORS.claim` / `.challenge`.

Guard consumers (these constrain HOW the fold is done):
- `__tests__/timelineMiniMapForbiddenImports.test.ts:177-181` — asserts the literal string
  `TIMELINE_KIND_COLORS` **is present in a value-import line** of `timelineMiniMapModel.ts`.
  It checks the *name*, not the source module, so a re-point is survivable — but see the
  recommended approach, which avoids touching it at all.
- `__tests__/a11y693MediatorBoardAxisGuard.test.tsx:304` — asserts the mediator marker/rail
  sources do NOT match `/TIMELINE_KIND_COLORS/`. Unaffected (different files), but the
  implementer must not "helpfully" import the new token into a mediator surface.

### Recommended approach — define canonically, re-export for compatibility

1. Add to `src/lib/designTokens.ts`, after the `ARGUMENT` block (~line 125), a new export
   with **byte-identical values**:

```ts
// UX-P2-4 (issue 937) - canonical timeline kind palette. Values are the
// byte-identical relocation of the former argumentGameSurfaceModel map; no
// re-hue in this step. Flat hex strings, NOT the ARGUMENT bg/fg pair shape.
export const TIMELINE_KIND = {
  claim:     '#6366f1',
  challenge: '#f97316',
  evidence:  '#06b6d4',
  clarify:   '#f59e0b',
  concede:   '#a855f7',
  flag:      '#ef4444',
  default:   '#475569',
} as const;

export type TimelineKindTokenKey = keyof typeof TIMELINE_KIND;
```

2. In `argumentGameSurfaceModel.ts`, replace the literal map with a typed re-export:

```ts
import { TIMELINE_KIND } from '../../lib/designTokens';

// UX-P2-4 (issue 937) - canonical values now live in designTokens.
// Re-exported under the historical name so all consumers and the
// mini-map value-import guard are unaffected.
export const TIMELINE_KIND_COLORS: Record<TimelineKindColorFamily, string> = TIMELINE_KIND;
```

3. **Do not touch** `ringsideFeedModel.ts`, `timelineMiniMapModel.ts`,
   `ArgumentTimelineMap.tsx`, or `argumentTimelineMap.test.ts`. The re-export keeps every
   import path and every assertion valid. This is the minimum-blast-radius fold and it is
   strictly better than re-pointing five import sites.

### Why not add it to the `TOKENS` aggregate

Optional and recommended **yes**, additively, per the UX-P2-2 / PR-E playbook: add
`timelineKind: TIMELINE_KIND,` to the `TOKENS` object (designTokens.ts:709-731) and extend
the exact-key pin in `designTokens.test.ts:61-88` from 20 to 21 keys, inserting
`'timelineKind',` in sorted position (between `'surfaceTokens'` and `'touchTarget'`).
The aggregate is how `getToken` reaches a family; leaving it out makes the token
second-class. Update the test title to "contains all twenty-one categories (UX-P2-4 added
timelineKind)".

### Value changes in part (a)

**NONE.** Every one of the 7 hexes is byte-identical. Proof obligation: an equality test
(see Test plan) plus a per-key literal assertion.

---

## Part (b) — one canonical tone palette

### The three copies

| # | Location | calm | measured | heated | hostile | unknown |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `railSegmentModel.ts:160-166` (private) | `#22c55e` | `#3b82f6` | `#f97316` | `#ef4444` | `#94a3b8` |
| 2 | `timelineNodeVisualModel.ts:134-140` (private, frozen) | `#22c55e` | `#3b82f6` | `#f97316` | `#ef4444` | `#94a3b8` |
| 3 | `argumentGameSurfaceModel.ts:857-863` (private) | `#22d3ee` | `#818cf8` | `#f97316` | `#dc2626` | `#475569` |

Copies 1 and 2 are byte-identical (call this **the pair**). Copy 3 has **drifted on four
of five keys** — only `heated` matches.

### Where tone color actually lands (the fact that governs blast radius)

The three copies are not alternatives competing for one surface. They feed **three
different visual layers, two of which are simultaneously visible on the same rail**:

- **Copy 3 (`TONE_BAND_COLOR`)** is consumed at `argumentGameSurfaceModel.ts:1572`:
  `const toneColor = TONE_BAND_COLOR[node.toneBand] || '#475569'`, which becomes
  `gradientStops[4]` — the **last stop of every edge gradient** in the timeline map.
  Consumer of that array: `deriveBaseSubStripColors` in `railSegmentModel.ts:193-208`,
  which blends the 5 stops into the 6 base sub-strips of each rail segment. So copy 3
  tints **the tail end of every rail segment on the main timeline**.
- **Copy 1 (`railSegmentModel.TONE_BAND_HEX`)** is consumed at `:218` by `deriveToneWash`,
  producing the **tone-wash overlay** painted on top of that same base band, at alpha
  0 to 0.45 by temperature band.
- **Copy 2 (`timelineNodeVisualModel.TONE_BAND_HEX`)** is consumed at `:194` by
  `deriveTimelineNodeVisualStyle`, producing `toneTint` — the **node tint**, capped at
  alpha 0.18 (`NODE_TONE_TINT_MAX_ALPHA`), and **only for active-path nodes**
  (non-active-path returns `null`, pinned by VG-004 tests).

So today the rail shows copy-3 hues in the gradient tail *underneath* copy-1 hues in the
wash, and active-path nodes carry copy-2 hues at a whisper. Unifying them is a genuine
visual change to the rail, not a refactor.

### Complete consumer enumeration

**Copy 1 — `railSegmentModel.TONE_BAND_HEX`**
- Production: `railSegmentModel.ts:218` (`deriveToneWash`) → the rail tone-wash overlay,
  rendered by `GradientWaveRail.tsx` via `ArgumentTimelineMap.tsx`.
- Tests: `__tests__/railSegmentModel.test.ts:361-365` — an explicit five-row table
  (`['calm','#22c55e'] … ['unknown','#94a3b8']`). **This is one half of the byte-pin.**
- Downstream model consumers of `railSegmentModel` (unaffected by hue, listed for the
  implementer's regression sweep): `branchGrammarModel`, `branchTopologyModel`,
  `tangentRoutingModel`, `argumentGameSurfaceEvidence`, `timelineNodeVisualModel`.

**Copy 2 — `timelineNodeVisualModel.TONE_BAND_HEX`**
- Production: `timelineNodeVisualModel.ts:194` (`deriveTimelineNodeVisualStyle.toneTint`)
  → active-path node tint, consumed by `ArgumentTimelineMap.tsx`, `ArgumentTreeScreen.tsx`,
  `room/ArgumentRoom.tsx`, `timelineDensityLensModel.ts`, `preferences/userPreferencesModel.ts`.
- Tests: `__tests__/argumentNodeVisualVG004.test.ts:311-324` — the `expected` map
  (`calm: '#22c55e', measured: '#3b82f6', …`) asserted per tone band. **This is the other
  half of the byte-pin.** Also `ArgumentTimelineMap.test.tsx`,
  `visualSimplify003BandNeutralDefault.test.ts`, `timelineDensityLensForbiddenImports.test.ts`.

**Copy 3 — `argumentGameSurfaceModel.TONE_BAND_COLOR`**
- Production: `argumentGameSurfaceModel.ts:1572` → `gradientStops[4]` of every timeline
  edge → blended into every rail base sub-strip by `railSegmentModel.deriveBaseSubStripColors`.
- Tests: `__tests__/argumentTimelineMap.test.ts` asserts `gradientStops[0]` and
  `[length-3]` (the kind stops) but **not** `[4]` — so the tone stop is currently
  unpinned. `railSegmentModel.test.ts:155-156, 169` uses `toneColor`/`gradientStops`
  fixtures with `#94a3b8` / `#f97316`, which are fixture inputs, not assertions about
  copy 3.
- Guard: `argumentGameSurfaceModel.ts` is in `SCAN_SET_P9`, and `#dc2626` (copy-3
  `hostile`) is its allowlisted red at `ALLOWLIST_P9` line 101.

### The doctrine dimension — argued both ways, honestly

The pair defends itself in a comment at `railSegmentModel.ts:158-160`:

> "Hostile / heated tones push hue toward warm; calm / measured tones stay close to the
> base. Color is *activity*, never *correctness*."

And `timelineNodeVisualModel.ts:122-124` reinforces it: "a node tint must never read as a
verdict, so it stays a whisper."

**Against the pair (the case that it violates the F-prime lesson):** the pair's ramp is
`calm = green #22c55e` → `hostile = red #ef4444`. That is exactly the red/green valence
axis UX-PR-F-prime moved the standing bands OFF of, for the reason that a red/green pair
is culturally pre-loaded with bad/good and a viewer does not read the code comment. A user
seeing a green segment and a red segment on the same rail will infer "this part is fine,
that part is bad" regardless of what the module docstring says. The stated intent
("activity, never correctness") is the *author's* semantics, not the *viewer's*. Doctrine
§1 is about what the app communicates, not what it intends. Further, `#ef4444` is
precisely the hex principle #9 reserves for **application failure** — using it for a
content state is the #9 misuse by definition.

**For the pair (the case that tone is legitimately different):** tone is not a valence
axis in the way standing is. Standing bands ran from `pretty_wrong` to `completely_right`
— an explicitly evaluative axis where hue-as-valence was doctrinally fatal. Tone runs
`calm → measured → heated → hostile`, which is a **describable observable property of the
exchange's temperature**, closer to a thermometer than a scorecard. Warm-for-hot is the
near-universal convention (`heated = #f97316` orange is already correct and uncontroversial
under the #9 classifier). And per `cdiscourse-doctrine` §2, heat means activity/friction —
which the app is *allowed* to surface, and which the `timeline-grammar` skill explicitly
sanctions as fill-saturation. The problem is not the warm end. **The problem is only the
two poles**: green `calm` imports a "good" reading the thermometer metaphor does not need,
and pure red `hostile` collides with #9.

That asymmetry is what motivates Option C.

### The options

Each option below states the exact 5 hexes, which visible surfaces change, and the
doctrine argument. **All three options unify to ONE canonical export; they differ only in
its values.** In all options the canonical map lives in `designTokens.ts` as
`TIMELINE_TONE` and all three call sites read it.

---

#### Option A — promote the pair as-is, delete the drifted copy 3

**Hexes:** `calm #22c55e` · `measured #3b82f6` · `heated #f97316` · `hostile #ef4444` · `unknown #94a3b8`

**Surfaces that change color:**
- **Rail base gradient tail (`gradientStops[4]`) on every timeline edge** — changes on 4
  of 5 tone bands: calm `#22d3ee` cyan → `#22c55e` green; measured `#818cf8` indigo →
  `#3b82f6` blue; hostile `#dc2626` → `#ef4444` (lighter red); unknown `#475569` slate →
  `#94a3b8` lighter slate. This is the **most-seen surface in the app** — every rail
  segment in the argument room.
- Rail tone-wash overlay: unchanged (already the pair).
- Active-path node tint: unchanged (already the pair).

**Doctrine:** cheapest option, zero new judgment, but it **propagates the green/red
valence ramp to a surface that does not currently carry it** — copy 3's calm is cyan and
its hostile is a darker red. Option A makes the timeline *more* red/green than it is
today. Given F-prime's direction of travel, this is the option that moves against the
grain.

**Guard effect:** `#dc2626` leaves `argumentGameSurfaceModel.ts` → `ALLOWLIST_P9` entry
shrinks. `#ef4444` and `#22c55e` land in `designTokens.ts` (currently unscanned).

---

#### Option B — promote the drifted copy 3, delete the pair

**Hexes:** `calm #22d3ee` · `measured #818cf8` · `heated #f97316` · `hostile #dc2626` · `unknown #475569`

**Surfaces that change color:**
- Rail base gradient tail: unchanged (already copy 3).
- **Rail tone-wash overlay** — changes on 4 of 5 bands, at alpha up to 0.45, so the change
  is strongly visible on hot segments.
- **Active-path node tint** — changes on 4 of 5 bands, but capped at alpha 0.18 and only
  on active-path nodes, so the change is subtle.

**Doctrine:** copy 3's cyan/indigo cool end is doctrinally *better* than green (no "good"
reading), and `#818cf8` measured is already the F-prime indigo family — pleasing
coherence with the standing re-ramp. But `hostile #dc2626` is a **darker, more saturated
red** than `#ef4444`; it still trips principle #9 and reads more alarming, not less. Option
B fixes the green problem and worsens the red problem.

**Guard effect:** `#dc2626` remains a red in a scanned file if the canonical map is
re-exported from `argumentGameSurfaceModel` — the implementer must move the literal to
`designTokens.ts` for the allowlist to shrink.

---

#### Option C — the pair's cool end, F-prime-aligned poles (RECOMMENDED)

**Hexes:** `calm #22d3ee` · `measured #818cf8` · `heated #f97316` · `hostile #9a3412` · `unknown #94a3b8`

A neutral→warm **intensity ramp**: cool cyan at rest, indigo at measured, orange at
heated, deep rust at hostile. Monotonic in warmth and in saturation-weight, with **no
green pole and no crimson pole**.

**Surfaces that change color:**
- **Rail base gradient tail:** changes on 2 of 5 bands (`hostile #dc2626 → #9a3412`,
  `unknown #475569 → #94a3b8`). calm/measured/heated unchanged from today's copy 3.
- **Rail tone-wash overlay:** changes on 3 of 5 (`calm #22c55e → #22d3ee`,
  `measured #3b82f6 → #818cf8`, `hostile #ef4444 → #9a3412`).
- **Active-path node tint:** same 3 bands, at ≤0.18 alpha.

**Doctrine:** this is the option that carries the F-prime lesson forward. It preserves
everything the pair's comment claims to want — warm means active, cool means quiet, hue
carries temperature — while removing both culturally-loaded poles. `#9a3412` is rust,
explicitly classified **not-red** by the principle #9 classifier (it is in the guard's own
must-NOT-fire list, `cohesionPrinciple9Guard.test.ts:157`) and already in use in
`designTokens.ts` as `ARGUMENT.challenge.bg` — so it is a palette-native value, not an
invention. `#22d3ee` and `#818cf8` are likewise already in the tree. Option C introduces
**zero new hexes**.

It is also the only option under which **every red leaves every scanned file**, letting
`ALLOWLIST_P9` for `argumentGameSurfaceModel.ts` shrink to `[]` after part (a).

**Cost:** it is the only option that changes a value nobody asked to change (`hostile`),
so it is the one that most needs the operator's explicit yes.

---

### RECOMMENDATION — Option C. **This is the operator's call, not the implementer's.**

Rationale in one line: Options A and B each fix one pole and keep the other; Option C is
the only one consistent with what UX-PR-F-prime already decided for standing bands, and it
does it with hexes already in the palette. But `hostile` is a *product* signal about how
the app talks about conflict, and re-hueing it away from red is a stance — the operator
owns that stance.

**If the operator declines to rule**, the safe fallback is **Option B**, not A: it is the
smaller visible delta on the most-seen surface (the rail base gradient is untouched), it
keeps the F-prime indigo coherence, and it leaves the `hostile` question open for a
dedicated follow-up card rather than baking green back in. The implementer must NOT
default to a choice — see Blocking condition below.

**Blocking condition:** part (b) does not ship until the operator names an option in the
issue-937 thread. Parts (a) and (c) are independent and may ship first.

---

### Part (b) implementation shape (option-independent)

1. Add `TIMELINE_TONE` to `designTokens.ts` with the chosen 5 hexes, plus
   `timelineTone: TIMELINE_TONE` in the `TOKENS` aggregate (making the aggregate 22 keys if
   part (a) also lands; sorted position between `'surfaceTokens'` and `'touchTarget'` —
   `'timelineKind'` then `'timelineTone'`).
2. `railSegmentModel.ts` — delete the private map (`:160-166`), import `TIMELINE_TONE`,
   and re-export it under a named export so the equality test can reach it:
   `export const TONE_BAND_HEX: Record<TimelineToneBand, string> = TIMELINE_TONE;`
   Keep the `:158-159` doctrine comment; it still describes the intent and it is the
   comment the reviewer will look for. **Comment must stay apostrophe-free.**
3. `timelineNodeVisualModel.ts` — delete the private frozen map (`:134-140`) and import.
   Update the `:128-133` docstring: it currently says "Re-stated here (not imported — the
   rail keeps its copy private)", which becomes false. Replace with a note that the
   canonical value lives in `designTokens` and that the model still has zero React imports
   (true — `designTokens.ts` is a pure leaf).
4. `argumentGameSurfaceModel.ts` — delete `TONE_BAND_COLOR` (`:857-863`) and point `:1572`
   at the canonical map. Keep the `|| '#475569'` fallback or replace it with
   `TIMELINE_TONE.unknown`; **prefer the latter** so no orphan slate literal remains.
   Note `#475569` also appears in that file as `TIMELINE_KIND_COLORS.default` (leaving in
   part (a)) and `STANDING_BAND_COLOR.unscored` (`:853`, staying) — it is not a red, so it
   has no #9 consequence either way.

### Value changes in part (b) — enumerated

Depends on the ruling. Under **Option C** (recommended), the intended changes are exactly:

| Layer | Band | From | To |
| --- | --- | --- | --- |
| rail gradient tail | hostile | `#dc2626` | `#9a3412` |
| rail gradient tail | unknown | `#475569` | `#94a3b8` |
| tone wash + node tint | calm | `#22c55e` | `#22d3ee` |
| tone wash + node tint | measured | `#3b82f6` | `#818cf8` |
| tone wash + node tint | hostile | `#ef4444` | `#9a3412` |

Byte-identical under Option C: `heated #f97316` on all three layers; `unknown #94a3b8` on
wash + tint; `calm`/`measured` on the gradient tail.

---

## Part (c) — legacy `counter` red → challenge orange

### Current state

`ArgumentTimelineNode.tsx:14-21` (`TRACK_COLORS`) and `ArgumentTrack.tsx:19-26`
(`TRACK_ACCENT`) are byte-identical 6-key maps:
`core #6366f1` · `counter #ef4444` · `receipts #10b981` · `clarification #f59e0b` ·
`concession #8b5cf6` · `tangent #6b7280`.

### The edit

`counter: '#ef4444'` → `counter: '#f97316'` in **both** files. This aligns the legacy
`counter` lane with `TIMELINE_KIND.challenge`, which is the same semantic category. It is
the only value change in part (c); the other five keys stay byte-identical in both files.

### Consumers

- `ArgumentTimelineNode.tsx:24` → `borderLeftColor` + the 8px dot on each card.
- `ArgumentTrack.tsx:33` → the 4px lane accent bar in the track header.
- `ArgumentTrack.tsx:56` renders `ArgumentTimelineNode`; both are reached only through
  `ArgumentTimelineScreen.tsx:81`, itself reached only through
  `ArgumentTreeScreen.tsx:193` under `viewMode === 'tracks'`.
- Both are also re-exported from `src/features/arguments/index.ts:5-6` (barrel export, no
  external consumer found).

### Reachability

As established in the reality audit: **no producer of `viewMode='tracks'` exists in
`src/` or `app/`**. This is dead-on-arrival UI. Record this in the PR body. The re-hue is
justified by ratchet hygiene (it lets two allowlist entries shrink to `[]`), not by
user-visible improvement. Do not claim a visual win.

### Dedupe recommendation — **do NOT dedupe in this card**

Recommended: leave the two maps duplicated, change the one hex in each.

Reasoning: deduping means creating a shared export, which means deciding *where* it lives.
The only defensible homes are (i) `argumentTimeline.ts` — plausible, it already owns
`ArgumentTrackKind` and `TRACK_LANE_LABELS`, or (ii) `designTokens.ts` — which would
promote a **statically dead** palette to canonical-token status, exactly the wrong signal.
Spending a token slot on dead UI is worse than a two-line duplicate. And the duplicate is
currently *load-bearing for the ratchet*: two separate allowlist entries in `ALLOWLIST_P9`
independently prove both files are red-clean after this card. Collapsing them to one export
would make one of those two guard entries vacuous.

**The better follow-up is deletion, not dedupe.** File a follow-up card to either delete
the `'tracks'` lens entirely (union member, guard, `ArgumentTimelineScreen`,
`ArgumentTrack`, `ArgumentTimelineNode`, barrel exports, and both `ALLOWLIST_P9` entries)
or restore a producer for it — after RUNTIME-CHECK #3 is closed with eyes-on
confirmation. That is a scope decision the operator should make with runtime evidence, and
it is explicitly out of scope here.

---

## Guard and pin edits — the complete list

### `__tests__/cohesionPrinciple9Guard.test.ts` — `ALLOWLIST_P9` (lines 91-111)

The allowlist-completeness test (`:204-217`) is **bidirectional**: every on-disk red must
be allowlisted AND every allowlist entry must still be on disk. A stale entry fails as
loudly as a new red. Each red below was verified as a **single** occurrence per file via
`grep -on`, so each removal empties its key exactly.

| File (in SCAN_SET_P9) | Today | After (a) | After (b) | After (c) | Final |
| --- | --- | --- | --- | --- | --- |
| `argumentGameSurfaceModel.ts` | `['#ef4444','#dc2626']` | `['#dc2626']` (`#ef4444` at :830 leaves with `TIMELINE_KIND_COLORS`) | `[]` under **any** option (`#dc2626` at :861 leaves with `TONE_BAND_COLOR`) | — | `[]` |
| `ArgumentTimelineNode.tsx` | `['#ef4444']` | — | — | `[]` (`#ef4444` at :16 re-hued) | `[]` |
| `ArgumentTrack.tsx` | `['#ef4444']` | — | — | `[]` (`#ef4444` at :21 re-hued) | `[]` |
| `ConversationGalleryScreen.tsx` | `['#7f1d1d','#fecaca']` | unchanged | unchanged | unchanged | unchanged (P2-9) |
| `argumentScoreModel.ts` | `[]` | unchanged | unchanged | unchanged | `[]` |
| `ArgumentScoreTracker.tsx` | `[]` | unchanged | unchanged | unchanged | `[]` |

Also update the explanatory comments at `:97-101`, which currently say "flag kind
(#ef4444), tone-hostile (#dc2626) — P1-7" and describe the burn-down as pending. After
this card both are burned down; the comment must say so and reference issue 937. **Write
the comment apostrophe-free** (the `uxOneOneTwoDoctrine` scanner's quote-parity string
regex is poisoned file-wide by a single apostrophe in any comment).

`SCAN_SET_P9` itself stays at 6 files and the `toHaveLength(6)` assertion is unchanged —
unless the operator accepts the recommendation below.

### Recommended (flag to operator): add `designTokens.ts` to `SCAN_SET_P9`

This card relocates `#ef4444` (kind `flag`) into `designTokens.ts`, which is **not
currently scanned by either ratchet**. Left alone, the card would *weaken* the #9 ratchet:
a red would move from a watched file to an unwatched one and the burn-down would look
complete while the red is merely hidden. Honest options:

1. **Add `'src/lib/designTokens.ts'` to `SCAN_SET_P9`** with allowlist `['#ef4444']` (the
   kind `flag` red, legitimately retained — flag genuinely is a review/failure affordance,
   which is the one role #9 permits red for), bump `toHaveLength(6)` → `7`, and add the
   path to the scan-set-coverage test. Under Option A this allowlist would additionally
   need `#ef4444` for tone-hostile (same hex, one entry). Under Option B add `'#dc2626'`.
   Under Option C no tone red exists, so `['#ef4444']` is complete.
2. Do not add it, and record in the PR body that `designTokens.ts` is an unscanned red
   sink. Weaker.

**Recommend (1).** It costs three lines and it is the difference between a real burn-down
and a shell game. Note this is a guard-scope expansion, so per the pipeline-governance
"never-self-approve" rule the reviewer — not the implementer — should confirm the new
allowlist is exactly the on-disk set.

### `__tests__/cohesionPrinciple2Guard.test.ts` — `SCAN_SET_P2`: **no change**

Checked, and the answer is a clean no. Neither legacy file becomes hex-clean:
`ArgumentTimelineNode.tsx` retains `#fff`, `#6366f1`, `#000`, `#111827`, `#6b7280`,
`#f3f4f6`, `#f0f0ff` and the five other track hexes; `ArgumentTrack.tsx` retains
`#f9fafb`, `#e5e7eb`, `#fff`, `#374151`, `#6b7280`, `#f3f4f6`, `#9ca3af` and its five.
`argumentGameSurfaceModel.ts` retains `STANDING_BAND_COLOR` and many others. No file
qualifies for the #2 ratchet under this card. Do not add one speculatively — the guard
asserts `toEqual([])` on quoted hex, so a premature add is an immediate red.

### `__tests__/designTokens.test.ts` — the exact-key `TOKENS` pin (`:61-88`)

Extend additively. With both (a) and (b): 20 → 22 keys. Insert in sorted position:

```
      'surfaceTokens',
      'timelineKind',    // UX-P2-4
      'timelineTone',    // UX-P2-4
      'touchTarget',     // UX-001.7
```

Update the test title to "contains all twenty-two categories (UX-P2-4 added timelineKind +
timelineTone)". If part (b) is deferred pending the operator ruling, land 21 keys with
`timelineKind` only and add `timelineTone` in the follow-up commit.

The `ARGUMENT` exact-key test (`:57-59`) and the "every ARGUMENT entry has a valid hex bg +
fg" test (`:118-123`) are **unchanged** — `TIMELINE_KIND` is a separate flat-string export
and must not be folded into `ARGUMENT`, whose pair shape those tests pin.

### `__tests__/uxOneOneSevenTokenExports.test.ts` / `uxPrETokenExports.test.ts`

No change required. Both assert specific documented shapes (`TOUCH_TARGET`, `FOCUS_RING`,
`BORDER_WIDTH`, `TYPOGRAPHY`, `SPACING`, `RADIUS`) and "leaves every pre-existing value
byte-identical". This card adds new sibling exports and touches none of those values.
The implementer must re-run both to prove no incidental drift.

### The tone byte-pin → import-equality (PR-F pattern)

The current mutual pin is **two independent literal tables in two test files**, not one
shared assertion:
- `__tests__/railSegmentModel.test.ts:361-365` — the five-row `[band, hex]` table.
- `__tests__/argumentNodeVisualVG004.test.ts:311-324` — the `expected` map asserted through
  `deriveTimelineNodeVisualStyle(...).toneTint.color`.

Both encode the pair's values as literals, so both go red the moment part (b) lands with
Option B or C. **Do not simply retune the literals in place** — that reproduces the
duplication this card exists to remove. Replace per PR-F:

1. In `railSegmentModel.test.ts`, replace the literal table with a derivation from the
   imported canonical token, keeping the behavioral assertion (that `deriveToneWash`
   returns the canonical hue per band) and dropping the hardcoded hexes.
2. In `argumentNodeVisualVG004.test.ts`, replace the literal `expected` map with
   `TIMELINE_TONE` imported from `designTokens`. The surrounding assertions
   (alpha ≤ 0.18, null off active path, only-`toneTint`-differs) are behavioral and stay
   **exactly as-is** — they are the doctrine pins and must not be softened.
3. Add ONE new import-equality test asserting all three former copies now resolve to the
   same object (see Test plan).

Keep **one** literal-value assertion, in the new token test only, so the canonical hexes
are pinned exactly once in the suite. That is the whole point of the pattern: values
asserted once, behavior asserted everywhere.

---

## Test plan

New file `__tests__/uxP2FourPaletteConsolidation.test.ts` (pure-TS, no React, no Supabase):

- `TIMELINE_KIND` has exactly the 7 keys `claim/challenge/evidence/clarify/concede/flag/default`.
- `TIMELINE_KIND` values are byte-identical to the pre-card map — assert all 7 literals
  explicitly. **This is the part-(a) no-re-hue proof.**
- `TIMELINE_KIND_COLORS` (re-exported from `argumentGameSurfaceModel`) `toBe`-identical to
  `TIMELINE_KIND` — reference equality, not deep equality, proving one object not two.
- `TIMELINE_TONE` has exactly the 5 keys `calm/measured/heated/hostile/unknown`.
- `TIMELINE_TONE` values match the ruled option — the single literal pin for tone.
- **Import-equality (replaces the byte-pin):** `railSegmentModel.TONE_BAND_HEX` `toBe`
  `TIMELINE_TONE`, and the tone hue reached through
  `deriveTimelineNodeVisualStyle({isActivePath: true, toneBand}).toneTint.color` equals
  `TIMELINE_TONE[toneBand]` for all 5 bands. One object, three consumers.
- `TOKENS.timelineKind` `toBe` `TIMELINE_KIND`; `TOKENS.timelineTone` `toBe` `TIMELINE_TONE`
  (aggregate reachability, per the UX-001.7 precedent).
- Every value in both maps matches `/^#[0-9a-f]{6}$/i`.
- **Doctrine — no crimson in the tone ramp** (Option C only): re-implement the #9
  `isRedFamily` classifier locally (self-contained, mirroring the guard's own convention
  that helpers never import from `src`) and assert no `TIMELINE_TONE` value is red-family.
  Under Option A or B this test is inverted to an explicit acknowledged-exception with the
  operator ruling cited in a comment.
- **Doctrine — no green pole** (Option C only): assert `TIMELINE_TONE.calm` is not in the
  green hue band, documenting that the calm pole is deliberately cyan not green.
- Monotonic warmth: assert the hue ordering `calm → measured → heated → hostile` is
  non-decreasing in warmth under the option's ramp, so a future edit cannot silently
  scramble the thermometer.

Extend `__tests__/cohesionPrinciple9Guard.test.ts`: the existing `it.each` coverage and
allowlist-completeness tests carry the ratchet automatically once `ALLOWLIST_P9` is
edited — **no new test needed**, but the implementer must confirm the completeness test
passes in both directions (it is the one that catches a forgotten allowlist shrink).

Legacy track re-hue: add to the new test file — `TRACK_COLORS.counter` and
`TRACK_ACCENT.counter` both equal `#f97316` and equal `TIMELINE_KIND.challenge`; the other
five keys in both maps equal their pre-card values (the byte-identical proof); and the two
maps remain deep-equal to each other (pinning the intentional duplicate so a future edit
cannot drift one without the other).

Regression sweep (existing suites the implementer must run and report by name):
`argumentTimelineMap.test.ts`, `railSegmentModel.test.ts`, `argumentNodeVisualVG004.test.ts`,
`GradientWaveRail.test.ts`, `timelineMiniMapForbiddenImports.test.ts`,
`a11y693MediatorBoardAxisGuard.test.tsx`, `designTokens.test.ts`,
`uxOneOneSevenTokenExports.test.ts`, `uxPrETokenExports.test.ts`,
`cohesionPrinciple2Guard.test.ts`, `cohesionPrinciple9Guard.test.ts`,
`visualSimplify003BandNeutralDefault.test.ts`, `timelineDensityLensForbiddenImports.test.ts`,
`ArgumentTimelineMap.test.tsx`, `branchGrammarModel.test.ts`, `branchTopologyModel.test.ts`,
`tangentRoutingModel.test.ts`, `mainlineDemotion.test.ts`, `BranchCollapseStub.test.tsx`.

Gates: `npm run typecheck`, `npm run lint`, `npm run test` — each as a **sole command with
direct exit-code capture** (per the durable lesson that a subshell-tail masked a real
typecheck failure). Report the captured `Test Suites: / Tests:` line with its exit code.

Not required: `npm run web:build`. That gate exists for asset-require path errors; this
card touches no asset requires.

---

## Edge cases

- **Unknown / missing tone band.** `TONE_BAND_HEX[toneBand] ?? .unknown` and
  `TONE_BAND_COLOR[node.toneBand] || '#475569'` are the two existing fallbacks. Both must
  keep falling back to the canonical `unknown`. Under Option C `unknown` changes on the
  gradient-tail layer (`#475569` → `#94a3b8`); that is intended and enumerated.
- **`as const` narrowing.** `TIMELINE_KIND` declared `as const` gives literal string types,
  which will not satisfy `Record<TimelineKindColorFamily, string>` on assignment in one
  direction. Either drop `as const` or widen at the re-export site. The implementer should
  typecheck this specifically — it is the most likely compile break in the card.
- **Key-set mismatch.** `TimelineKindColorFamily` and `TimelineToneBand` are the source of
  truth for the key sets. If either union has a member the new token lacks, `Record<>`
  fails at compile time — good. Do not silence it with an index signature.
- **Import cycle.** `designTokens.ts` is a pure leaf and must stay one. It must never
  import from `src/features/`. The direction is always features → tokens.
- **`void TIMELINE_KIND_COLORS`** at `ArgumentTimelineMap.tsx:1462-1463` exists to defeat
  tree-shaking for the tests. The re-export keeps it working; do not remove it.
- **Frozen vs unfrozen.** Copy 2 was `Object.freeze`d, copies 1 and 3 were not. The
  canonical export should be frozen (or `as const`) so the strictest prior guarantee is
  preserved rather than silently relaxed.
- **Concurrent edits.** None — no runtime state, no DB, no network.
- **Offline / permission-denied.** Not applicable; compile-time constants only.
- **Doctrine edge case — can heat influence the strength band?** No, and this card does
  not create a path for it. `TIMELINE_TONE` feeds `gradientStops[4]`, the tone wash, and
  the node tint. `STANDING_BAND_COLOR` feeds `gradientStops[3]` and is untouched. The two
  never read each other. VISUAL-SIMPLIFY-003's band-neutral default (standing stop
  collapses to `unscored` grey on the default path) is likewise untouched — verify via
  `visualSimplify003BandNeutralDefault.test.ts`.

---

## Dependencies

- Assumes **UX-PR-D** (issue 925) is complete — this card edits its two ratchet guards.
- Assumes **UX-PR-F** (929) and **UX-PR-F-prime** (931) are complete — F-prime's indigo
  standing re-ramp is the precedent Option C follows, and F's canonical-single-source +
  import-equality pattern is the template for the tone pin replacement.
- Assumes **UX-P2-2** (935) is complete — the 20-key `TOKENS` pin including `chipTint` is
  the baseline this card extends.
- Reads `TimelineKindColorFamily` and `TimelineToneBand` from the existing type module;
  neither changes.
- **Blocks nothing.** Unblocks P2-9 (gallery red burn-down) partially, in that this card
  demonstrates the allowlist-shrink discipline P2-9 will need at larger scale.
- **Part (b) is blocked on the operator ruling.** Parts (a) and (c) are not.

---

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Allowlist not shrunk in the same PR → completeness test fails both directions | High | The table above gives the exact final state per file; reviewer re-derives it from `grep -on` rather than trusting the table |
| Reds relocated into unscanned `designTokens.ts` → ratchet silently weakened | High | Recommendation (1): add `designTokens.ts` to `SCAN_SET_P9`. If declined, record explicitly in the PR body |
| Implementer picks a part-(b) option to unblock themselves | High | Blocking condition stated above; reviewer rejects any part-(b) diff without a cited operator ruling |
| Retuning the two literal tone tables instead of replacing them with import-equality | Medium | Named explicitly in the guard section; the new test asserts `toBe` reference equality, which a retune cannot satisfy |
| `as const` type-narrowing compile break at the re-export | Medium | Called out in Edge cases; typecheck as a sole command |
| Rail visual regression on the most-seen surface (option-dependent) | Medium | Per-option surface enumeration above; snapshot suites in the regression sweep |
| Doctrine scanner fires on an apostrophe in a new comment | Low | All new/edited comments apostrophe-free; issue written as "(issue 937)" not "#937" |
| Flaky wall-clock perf tests (`pointLifecycleModel`, `moveMetadataLedger`) fail under full-suite load | Low | Known pre-existing flake; re-run the file isolated before blaming this branch |
| Someone later folds `TIMELINE_KIND` into `ARGUMENT` | Low | Shape difference documented; the bg/fg validity test would fire |

---

## Out of scope

- Deleting the `'tracks'` lens or `ArgumentTimelineScreen` / `ArgumentTrack` /
  `ArgumentTimelineNode` (follow-up, gated on RUNTIME-CHECK #3).
- Deduping `TRACK_COLORS` / `TRACK_ACCENT` into a shared export (argued against above).
- Any re-hue of `TIMELINE_KIND_COLORS` values, including the `flag` red `#ef4444`. Part (a)
  is a byte-identical relocation. A `flag` re-hue is a separate judgment.
- The gallery red burn-down (`#7f1d1d` / `#fecaca`, P2-9).
- `STANDING_BAND_COLOR`, the standing bands, and the VISUAL-SIMPLIFY-003 band-neutral path.
- `TAG_LABEL_MAP` reds.
- Adding any file to `SCAN_SET_P2`.
- Migrating other hardcoded hex in the touched files (`ArgumentTimelineNode.tsx` and
  `ArgumentTrack.tsx` keep ~7 grays each).
- Any dark-theme / light-theme token work.
- Any DB, Edge Function, migration, or deploy.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels, score never blocks posting):** no user-facing
  string is added or changed. No label, no copy. Score paths untouched — `STANDING_BAND_COLOR`
  and the point-standing economy are not read by this card. PASS.
- **cdiscourse-doctrine §1 (nothing may read as a verdict):** the central question of part
  (b), argued both directions rather than assumed, and escalated to the operator. Option C
  is recommended precisely because it removes both verdict-adjacent poles. PASS with the
  decision surfaced, not papered over.
- **cdiscourse-doctrine §2 (heat = activity, never correctness):** preserved. The tone ramp
  continues to encode temperature; `railSegmentModel.ts:158-159`'s "Color is *activity*,
  never *correctness*" comment is retained verbatim at the new canonical site. Option C
  strengthens the claim by removing the green/red pair that undercut it. PASS.
- **cdiscourse-doctrine §3 (popularity is not evidence):** untouched — no engagement or
  amplification signal is read. PASS.
- **cdiscourse-doctrine §4 (AI moderator limits):** no AI involvement. PASS.
- **cdiscourse-doctrine §5 (rules engine sacred):** the engine is not touched. `designTokens.ts`
  remains a pure leaf with no Supabase / React / network import. PASS.
- **cdiscourse-doctrine §6-7 (secrets, no AI calls from the app):** no env var, no key, no
  network call, no provider. PASS.
- **cdiscourse-doctrine §10 (v1 scope):** no voting, search, OAuth, push, or public API. PASS.
- **timeline-grammar (color is never the only signal):** unchanged by construction. Node
  kind is carried by shape plus text label; standing by stroke; the tone layers are
  low-alpha washes and tints (≤0.45 wash, ≤0.18 node tint) that were already supplementary.
  This card changes hue values only — it adds no new color-only signal and removes none of
  the shape/stroke/text encodings. PASS.
- **timeline-grammar (kind color table):** part (a) is byte-identical, so the documented
  kind→color family mapping is unchanged. The skill's token table needs no revision. PASS.
- **accessibility-targets (color independence, grayscale legibility):** Option C's ramp is
  monotonic in warmth AND in luminance-weight, so it degrades to a legible grayscale ramp;
  the existing green→red pair does not (`#22c55e` and `#ef4444` have similar luminance and
  collapse toward each other in grayscale). This is an accessibility argument for Option C
  independent of doctrine, and the implementer should note it in the PR. Contrast targets
  are unaffected — these are overlays on an existing base, not text colors. PASS.
- **accessibility-targets (hit targets, roles, labels):** no interactive element is added
  or resized; no `accessibilityLabel` changes. PASS.
- **test-discipline:** new tests specified with paths and assertions; the byte-pin is
  replaced rather than deleted, so coverage does not regress; test count goes up. PASS.

---

## Operator steps

**None — pure code change.** No migration, no Edge Function deploy, no env var, no Netlify
publish. `npx supabase` is not involved.

The one operator action required is **a decision, not a command**: rule on part (b) —
Option A, B, or C — in the issue-937 thread before the implementer touches the tone
palette. Parts (a) and (c) can proceed immediately and can ship as a separate commit or PR
if the ruling is slow.

---

## Orchestrator-authored brief ledger

This design was authored against an orchestrator-supplied brief. Where judgment substituted
for operator direction:

- **Derived from a pre-launch codebase survey (this design's reality audit):** the
  three-layer tone rendering model; the static unreachability of the `'tracks'` lens; the
  single-occurrence red counts; the `ARGUMENT` shape incompatibility; the fact that both
  `TONE_BAND_HEX` copies are unexported. The brief did not contain these.
- **Derived from prior Phase framing (UX-PR-D / F / F-prime / P2-2):** the additive
  token-pin playbook; the import-equality pattern; the bidirectional allowlist contract;
  the F-prime valence-ramp precedent.
- **Resolved by orchestrator/designer default, requiring operator review:**
  (i) the recommendation of Option C and the specific hex `#9a3412` for `hostile`;
  (ii) the fallback-to-Option-B guidance if the operator declines to rule;
  (iii) the recommendation to add `designTokens.ts` to `SCAN_SET_P9` — a guard-scope
  expansion; (iv) the recommendation NOT to dedupe `TRACK_COLORS`/`TRACK_ACCENT`;
  (v) the recommendation to add both new tokens to the `TOKENS` aggregate.
- **Operator-deferred review (post-ship):** whether the `flag` kind should keep `#ef4444`
  at all; whether the `'tracks'` lens should be deleted or revived; whether P2-9 should
  adopt the same allowlist-shrink discipline.

**The brief did not itself carry a ledger.** Per the multi-card chain protocol that is an
incompleteness the reviewer should record as a finding against the brief, not against this
design.
