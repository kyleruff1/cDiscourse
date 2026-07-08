# HOME-003 — Circle home as a filtered Your-table lane

**Status:** Design draft
**Epic:** ASP-000 / epic:argument-surface (Argument Surface Pivot) — parent #826
**Release:** M-ASP-1 (Phase 1, `home_v2`)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/840

---

## Goal (one paragraph)

Give circles a **lens, not a screen**. Instead of the retired PRIVATE-GROUPS-003 group-room
collection screen, selecting a circle **filters the already-shipped HOME-001 `ArgumentHome`
"Your table" surfaces** — the your-turn strip and the ongoing cards — down to the rooms that
belong to that circle. This is a **pure client-side projection** over the card array HOME-001
already computes; the only new read is a SELECT-only circle-membership fetch (owned by START-002).
It never rebuilds cards, never re-runs `conversationGalleryModel` bucketing, adds no new screen,
no Edge Function, no migration, and no RLS change. It respects the doctrine floor that a circle is
an **access + memory boundary**, never a verdict or ranking (a chip is a name + a size, never a
score), and it composes strictly *after* HOME-001's D8 bot/fixture exclusion, so a circle can never
resurface an excluded fixture room.

---

## Problem & scope

HOME-001 landed `ArgumentHome` (behind `home_v2`, prop-driven from `App.tsx`): a your-turn strip,
opponent-forward ongoing cards, a Start CTA, a floor door, and an activity module. All of it is a
pure projection (`buildArgumentHomeViewModel`) over inputs `App.tsx` already loads for the gallery
and the notification badge. HOME-003 adds one capability: **narrow that projection to a circle.**

In scope:
- A circle **filter chip row** on `ArgumentHome`, rendered only when the caller has ≥1 live circle.
- A **pure filter** (`filterArgumentHomeByCircle`) that narrows *both* the your-turn strip and the
  ongoing cards to rooms that match the selected circle. Same card references, never a rebuild.
- One new read: **circle membership** via START-002's SELECT-only `listMyCircles` module.
- A **filtered-empty state** (plain-language copy + Start CTA) when a circle is selected but no
  rooms match — never a dead end.
- Clearing the filter (or having no circles) leaves the lane **byte-identical to HOME-001**.

Out of scope: see [Non-goals](#non-goals).

---

## Interface contract with START-002 (numbered assumptions)

> **START-002's design OWNS the shared client circles-read module** (list my circles + membership).
> START-002 is being designed concurrently in this same worktree. The assumptions below are the
> contract this card **reconciles against the final START-002 design before coding.** The filter is
> deliberately built to be **tolerant of reasonable signature differences**: it consumes a narrow
> local `CircleLens` interface, and a single `toCircleLens(raw)` adapter bridges whatever START-002
> actually returns. Reasonable divergence (field names, `CircleMemberSummary[]` vs a raw id array,
> `{ ok, data }` vs a thrown error, hook vs bare api) is absorbed in `toCircleLens` + the `App.tsx`
> wiring — **never in the pure filter.**

1. **Module path.** START-002 exports a SELECT-only client wrapper, assumed at
   `src/features/circles/circlesApi.ts` (mirrors `debatesApi.ts`), and/or a hook at
   `src/features/circles/useMyCircles.ts` (mirrors `useDebates` / `useGalleryArguments`). The
   implementer imports from whatever START-002 actually names; only the import specifier changes.

2. **`listMyCircles` shape.** Assumed
   `listMyCircles(userId: string): Promise<DebateApiResult<MyCircle[]>>` — i.e. the repo's standard
   `{ ok: true; data } | { ok: false; error }` result envelope (as `listDebates` uses). If
   START-002 throws instead, the `App.tsx` wiring try/catches; the filter is unaffected.

3. **Per-circle live-member user-ids are REQUIRED (load-bearing).** Each returned circle must carry
   at minimum `{ id: string; name: string }` **and the live member set as user-ids** — either a
   `memberIds: string[]` or a `members: CircleMemberSummary[]` (the `CircleMemberSummary` from
   `circleModel.ts`, `{ userId, role }`). **The predicate cannot be computed without member
   user-ids.** If START-002's `listMyCircles` returns only counts / bands and no user-ids, this is a
   blocking reconciliation item — flag it and stop rather than shipping a filter that silently
   matches nothing. `toCircleLens` maps whichever of `memberIds` / `members` is present into the
   `CircleLens.memberIds: ReadonlySet<string>` the filter consumes.

4. **Hook availability.** A `useMyCircles()` returning
   `{ circles, loading, error, refresh }` is assumed for `App.tsx` wiring. If START-002 ships only
   the bare api wrapper, the implementer writes a trivial `useEffect` loader in `App.tsx` (or a
   3-line local hook) — no design change to this card.

5. **RLS basis.** The read is **member-scoped SELECT** via the `is_circle_member` SECURITY DEFINER
   helper on `public.circles` + `public.circle_members` (migration
   `20260702000001_private_groups_002_circles.sql`). There is **NO authenticated write policy** and
   none is added. This card's code is SELECT-only and never writes `circles` / `circle_members` /
   `circle_invites`.

6. **Member count for the chip band.** The chip's size band is derived **client-side** from the
   returned live-member list via `circleModel.deriveCircleDisplaySummary` / `memberCountBand` — no
   extra read.

7. **Start-CTA prefill (OPTIONAL).** IF START-002's start picker supports prefilling a circle
   audience — i.e. `ArgumentHome`'s `onStart` can be widened to `onStart(circleId?: string)` — the
   filtered-empty Start CTA passes the selected circle id. **If prefill is not supported, the CTA
   routes to the default start flow.** This card does **not** hard-depend on prefill; the widened
   `onStart` signature is backwards-compatible (the id arg is optional and ignored today).

---

## Loaded-data reality audit (the load-bearing section)

**Question the card poses:** is there enough identity data on the data HOME-001 *already loads* to
test "every room participant ⊆ circle members ∪ me"? **Audited answer: not the full participant
set — only an author-based proxy is available client-side today.** Here is exactly what is loaded
and what is not.

### What the home actually has

`App.tsx` feeds `ArgumentHome` two identity-bearing inputs, both already loaded:

| Source | Loaded by | Identity fields present |
|---|---|---|
| `debates: Debate[]` | `debatesApi.listDebates` | `createdBy` (room creator user-id), `myParticipantSide` (caller's own side only). **No `circle_id`. No participant user-id list.** |
| `argumentsByDebateId: Record<string, GalleryArgumentInput[]>` | `useGalleryArguments` → `listArgumentsForDebateIds` | per-argument `authorId: string \| null` |
| `ConversationGalleryCard` (derived) | `buildConversationGalleryCards` | `starterDisplayName`, `latestPostAuthor` (**display-name strings, not ids**), `participantCount` (a **number**), `mySide`, `hasUserJoined` |

Two decisive facts, verified in source:

1. **`listDebates` loads only the caller's own participant rows.** The participants query is
   `supabase.from('debate_participants').select('debate_id, side').eq('user_id', userId)`
   (`debatesApi.ts:97-100`). It is caller-scoped and does not even select `user_id`. **No other
   participant's user-id reaches the client.**
2. **The card carries no participant user-id list.** `ConversationGalleryCard` (`conversationGalleryModel.ts:263-355`)
   exposes participant *count* and *display names* — never a set of user-ids. Internally
   `deriveMessageStats` computes `rootAuthorId` / `latestAuthorId`, but these are **not projected
   onto the card.**

The one place per-user *ids* survive is `argumentsByDebateId[debateId][].authorId` — the set of
users who **posted an argument** in the room — plus `debate.createdBy`.

### Why the literal predicate is not directly achievable — and the two escape hatches

The AC's literal predicate is *"every room **participant** is a live member."* The full participant
set (including silent joiners / observers who never posted) is **not on the client today.**

- **Escape hatch A — widen the participants read.** RLS *does* permit a participant to read
  co-participant rows (`debate_participants: select own, participant, or public-open debate`,
  migration `20260524000015:210`). But realizing it means **dropping the `.eq('user_id', userId)`
  filter** in `listDebates` and adding `user_id` to the projection — a **materially different
  query** (all participant rows for every debate the caller can see, not just their own) that feeds
  `sideMap` and is consumed app-wide (gallery, `DebateListScreen`, etc.). That violates the AC
  *"No new Supabase query beyond the circle-membership SELECT"* and carries real blast radius.
  **Rejected for this card.**
- **Escape hatch B — load `debate.circle_id`.** The DB already has the authoritative marker
  (`debates.circle_id`, migration `20260702000001:241`). Surfacing it is *one extra column on the
  existing debates SELECT* — same round-trip, no RLS change, **zero approximation**. This is what
  the issue's "widen the existing projection, same query" bullet is most honestly realized as
  (the bullet named `debate_participants`, but the accurate low-cost target is the `debates`
  query's `circle_id` column). Its predicate is `debate.circle_id === C.id`. **This is exact and
  superior — but it (a) changes the shared `Debate` type + loader consumed across the app, and
  (b) only matches rooms START-002 tags with `circle_id`, which changes the AC's stated
  participant-subset semantics.** Recommended as a **fast-follow exactness upgrade**, not this
  card's primary (see Design decision 1).

### The achievable filter (bounded and stated)

**Runtime participant-identity proxy = the room's resolvable author set:**

```
participantsProxy(room) = { a.authorId for a in argumentsByDebateId[room.debateId] if a.authorId != null }
                          ∪ ({ room.createdBy } if room.createdBy != null)
```

This is derivable with **zero new debate/participant query** — purely from data HOME-001 already
loads. The **pure model** does the exact subset test the AC fixture demands; the **proxy** is
isolated in one adapter (`buildParticipantIdIndex`) so the approximation is documented in exactly
one place and swappable for Escape hatch B later.

**Bounded error behavior (must be documented in code + surfaced to the operator):**

- **False positive (room shown though a true non-member participant exists):** occurs only if a
  non-member is a *participant who never posted and is not the creator*. For circle rooms this is
  rare (circle-scoped rooms are private and RLS-gated to members; a non-member cannot be a
  participant). **Critically, over-inclusion only ever shows a room the caller already participates
  in — it is never a visibility leak** (RLS gates what the caller can load at all; this filter only
  ever *removes* from that already-authorized set).
- **False negative (room hidden though all true participants are members):** the model excludes a
  room whose **resolvable** author set is empty (e.g. a brand-new room with only a null/system/
  deleted-author root). Bounded and rare; the room reappears the moment a member posts. Null
  `authorId`s are *skipped* (treated as non-identifying), never treated as a member — so a null
  author can never grant a false match.
- **Caller-always-a-member:** `viewerId` is counted as satisfying membership defensively, so a
  lagging membership snapshot never drops the caller's own authored rooms. (The caller is a live
  member of every circle the chip row lists, so `viewerId ∈ memberIds` already holds; this is
  belt-and-braces.)

**Verdict:** ship the pure participant-subset model exactly as the AC specifies (testable against
the all-in / partial / out fixture), fed at runtime by the author-set proxy (zero new query,
bounded approximation). Recommend `debate.circle_id` exactness (Escape hatch B) as a fast-follow to
reconcile with START-002's room tagging.

---

## Data model

**No new data model, no migration, no new table, no new column.** All new types are pure-TS
interfaces in the client model layer:

```ts
// src/features/circles/circleHomeFilter.ts

/**
 * The narrow local view of a circle the home filter consumes. The single
 * `toCircleLens` adapter maps START-002's actual return shape into this, so the
 * filter tolerates reasonable upstream signature differences.
 */
export interface CircleLens {
  id: string;
  name: string;
  /** Live member user-ids (is_removed = false), caller included. */
  memberIds: ReadonlySet<string>;
  /** Live member count — a SIZE, never a rating (drives the chip band). */
  memberCount: number;
}

/** Per-debate resolvable participant-identity set (the author-set proxy). */
export type ParticipantIdIndex = ReadonlyMap<string, ReadonlySet<string>>;

export interface FilterArgumentHomeInput {
  yourTurn: YourTurnItem[];          // from buildArgumentHomeViewModel
  ongoing: ConversationGalleryCard[]; // from buildArgumentHomeViewModel
  participantIdsByDebateId: ParticipantIdIndex;
  circleMemberIds: ReadonlySet<string>;
  viewerId: string | null;
}

export interface CircleFilteredHome {
  yourTurn: YourTurnItem[];
  ongoing: ConversationGalleryCard[];
}
```

No reserved DB fields, no service-role, no write. `CircleMemberSummary` / `CircleMemberBand` are
reused from `circleModel.ts`.

---

## Design decisions

1. **Predicate = participant-subset at the model level; author-set proxy at runtime; `circle_id`
   exactness deferred.** The pure model tests `participantsProxy(room) ⊆ circleMemberIds` exactly as
   the AC + fixture specify. The runtime proxy (resolvable authors ∪ creator) is the only
   participant-identity source available without a new/widened query. `debate.circle_id` exactness
   is documented as a fast-follow (see reality audit). This honors the binding AC, respects
   *"no new query,"* and keeps blast radius minimal.

2. **Filter runs AFTER `buildArgumentHomeViewModel`, as a post-projection.** D8 fixture exclusion
   already runs inside the VM builder (`homeModel.ts:100-116`). Applying the circle filter to the
   VM's already-D8-filtered `yourTurn` + `ongoing` makes *"D8 before circle"* and *"a circle can
   never resurface an excluded fixture room"* true **by construction** — the circle filter is a
   pure subset operation over an already-excluded set. `homeModel.ts` and its D8 tests are
   **unchanged**.

3. **Pure filter is projection-not-rebuild.** `filterArgumentHomeByCircle` returns the **same
   `ConversationGalleryCard` / `YourTurnItem` references** (a `.filter()`, never a map/rebuild). It
   never calls `buildConversationGalleryCards` or the bucketing. A reference-identity test locks
   this.

4. **No filter selected ⇒ identity.** The UI simply does not call the filter when
   `selectedCircleId == null`, so the lane output is the unfiltered HOME-001 output with the same
   references (zero-diff). A model-level test asserts a `null`/"all" selection returns the input
   references unchanged.

5. **Circles data flows via props from `App.tsx`** (App.tsx calls START-002's `useMyCircles`),
   keeping `ArgumentHome` consistent with HOME-001's "zero supabase/fetch call sites inside the
   surface." The network stays where every other home load lives.

6. **New pure file `circleHomeFilter.ts`, not an addition to `homeModel.ts`.** Co-locates with
   `circleModel.ts`; keeps `homeModel.ts` (and its untouched tests) focused. (The issue explicitly
   allows either; co-location is cleaner.)

7. **Chip = name + size, never a rating.** Each chip renders the circle name plus the live member
   count as a size (e.g. "4"), grouped by `circleModel`'s band. No heat, no temperament, no
   ranking is added to the filtered lane (AC + doctrine §1-§3).

---

## File-by-file change list

**New files**

- `src/features/circles/circleHomeFilter.ts` — pure model (~130-160 lines). Exports:
  `CircleLens`, `ParticipantIdIndex`, `FilterArgumentHomeInput`, `CircleFilteredHome`,
  `buildParticipantIdIndex(input: { debates; argumentsByDebateId })`,
  `roomMatchesCircle(participantIds, circleMemberIds, viewerId)`,
  `filterArgumentHomeByCircle(input)`, `toCircleLens(raw)`. **No React, no Supabase.**
- `src/features/circles/CircleFilterRow.tsx` — presentational chip row (~110-140 lines).
- `__tests__/circleHomeFilter.test.ts` — pure-model matrix (~20-24 tests).
- `__tests__/circleFilterRow.test.tsx` — RNTL chip-row + a11y (~10-14 tests).

**Modified files**

- `src/features/home/ArgumentHome.tsx` (~+55-75 lines, **additive only**). Adds two props
  (`circles: CircleLens[]`, `circlesLoading?: boolean`); a `selectedCircleId` `useState`; renders
  `<CircleFilterRow>` above the your-turn strip when `circles.length > 0`; derives the filtered VM
  via `useMemo` when a circle is selected; renders a filtered-empty block. The existing first-run,
  your-turn, ongoing, CTA, floor-door, and activity blocks are **unchanged** when no circle is
  selected.
- `src/features/arguments/gameCopy.ts` (~+8 lines). Additive `HOME_COPY` circle-filter fields (see
  Copy plan). No existing string changes.
- `App.tsx` (~+8-12 lines). Calls START-002's `useMyCircles` (assumption 4), maps results through
  `toCircleLens` into `circles`, passes `circles` + `circlesLoading` to `<ArgumentHome>`. Optionally
  widens the `onStart` handler to accept a `circleId?` (assumption 7). No navigation-shell change
  beyond wiring the filter's data.
- `__tests__/argumentHome.test.tsx` (**extend**, +~6-8 tests) — surface-level: chip row visible
  with circles / hidden with none; selecting a circle narrows both surfaces; filtered-empty +
  Start CTA; D8 composition holds at the surface. (UI split between the new
  `circleFilterRow.test.tsx` and this file is the implementer's call.)

**No** changes to: `homeModel.ts`, `conversationGalleryModel.ts`, `debatesApi.ts` (recommended path;
Escape hatch B would touch it — deferred), `circleModel.ts`, any migration, any Edge Function, any
feature-flag registry.

---

## API / interface contracts

```ts
// src/features/circles/circleHomeFilter.ts

/**
 * Pure: build the resolvable participant-identity set per debate from the data
 * the home already loads — distinct non-null authorIds ∪ non-null createdBy.
 * This is the author-set PROXY for the participant set (see reality audit).
 */
export function buildParticipantIdIndex(input: {
  debates: ReadonlyArray<Pick<Debate, 'id' | 'createdBy'>>;
  argumentsByDebateId: Readonly<Record<string, ReadonlyArray<Pick<GalleryArgumentInput, 'authorId'>>>>;
}): ParticipantIdIndex;

/**
 * Pure predicate: does this room match the circle? True iff the resolvable
 * participant set is NON-EMPTY and every id is a circle member (viewerId always
 * counts as a member). A room with no resolvable participants never matches.
 */
export function roomMatchesCircle(
  participantIds: ReadonlySet<string> | undefined,
  circleMemberIds: ReadonlySet<string>,
  viewerId: string | null,
): boolean;

/**
 * Pure projection: narrow the your-turn strip AND the ongoing cards to rooms
 * matching the circle. Returns the SAME item references (a filter, never a
 * rebuild). Never mutates its inputs.
 */
export function filterArgumentHomeByCircle(input: FilterArgumentHomeInput): CircleFilteredHome;

/**
 * Tolerant adapter: map START-002's actual circle shape into CircleLens.
 * Accepts either `memberIds: string[]` or `members: CircleMemberSummary[]`.
 */
export function toCircleLens(raw: {
  id: string;
  name: string;
  memberIds?: readonly string[];
  members?: readonly { userId: string }[];
}): CircleLens;
```

```ts
// src/features/circles/CircleFilterRow.tsx
export interface CircleFilterRowProps {
  circles: CircleLens[];
  selectedCircleId: string | null;
  onSelect: (circleId: string | null) => void; // null = "All" (clear)
}
export function CircleFilterRow(props: CircleFilterRowProps): React.ReactElement | null;
// Returns null when circles.length === 0 (AC: no chip row, no empty shell).
```

```ts
// src/features/home/ArgumentHome.tsx — additive props
export interface ArgumentHomeProps {
  // ...all existing props unchanged...
  circles: CircleLens[];        // NEW — mapped in App.tsx from START-002
  circlesLoading?: boolean;     // NEW — optional
  onStart: (circleId?: string) => void; // WIDENED (optional arg, back-compat)
}
```

---

## Component spec (a11y floors)

`CircleFilterRow` — a horizontal, non-color-only chip selector.

- **Container:** horizontal `ScrollView` (`showsHorizontalScrollIndicator={false}`),
  `accessibilityRole="tablist"` (or `"list"` if simpler), `testID="home-circle-filter-row"`. Renders
  **null** when `circles.length === 0`.
- **Chips:** an "All" chip first (clears the filter; selected by default), then one chip per circle.
  Each chip:
  - `Pressable`, `accessibilityRole="button"`, `accessibilityLabel` = circle name + member count
    (e.g. `"Book Club, 4 members"`; the "All" chip reads `"All circles"`),
    `accessibilityState={{ selected }}`.
  - **≥44×44 logical px** (visual `minHeight: 44` + `hitSlop` when the visual is smaller).
  - **Color-independent selection:** selected state carries a **non-color signal** — a filled
    background **and** a leading check glyph (or bold weight + underline) — so the selection is
    legible in grayscale. Verified by a grayscale/no-color check.
  - `testID` = `home-circle-chip-all` and `home-circle-chip-<circleId>`.
- **Chip content:** all text inside `<Text>`. Name (primary) + count as a small size badge (a size,
  never a rating). Long names truncate (`numberOfLines={1}`), full name in `accessibilityLabel`.
- **Reduce motion:** selection is a static style swap (no animated transition), so no
  reduce-motion branch is needed; if any press feedback is added it must be opacity-only and
  disabled under `AccessibilityInfo.isReduceMotionEnabled()`.
- **390px band:** the row is horizontally scrollable, so it never forces horizontal page overflow at
  the phone band; reuses the existing `useHeaderBreakpoint`/`isPhone` sizing already in
  `ArgumentHome`. Verified against the 390×844 phone viewport (and the standard cross-device matrix:
  390 phone, 1024 tablet-portrait, 1366 / 1920 browser).
- **Placement:** directly under the ScrollView top padding, **above** the your-turn strip, so the
  lens control precedes the content it filters (focus/reading order: filter row → your-turn →
  ongoing → CTA → floor door → activity).

**Filtered-empty block** (shown when a circle is selected and the filtered VM is empty but the
unfiltered VM is not first-run): a headline + body (Copy plan) + a Start CTA `Pressable`
(`accessibilityRole="button"`, `accessibilityState={{}}`, ≥44px, `testID="home-circle-empty-start"`)
that calls `onStart(selectedCircleId ?? undefined)`. Never renders the J1 first-run empty state.

---

## Copy plan (additive `HOME_COPY` block, ban-list safe)

Add to `HOME_COPY` in `gameCopy.ts` (no existing strings change):

```ts
// HOME-003 — circle filter lens. A circle is a size + a name, never a rating.
circleFilterAllLabel: 'All',
circleFilterAllA11yLabel: 'All circles',
circleFilterRowA11yLabel: 'Filter your table by circle',
circleFilterEmptyHeadline: 'No rooms with this circle yet.',
circleFilterEmptyBody: 'When you argue with everyone in this circle, those rooms show up here.',
circleFilterStartCta: 'Start one with this circle',
```

- **Ban-list safe:** none of the added strings contain any verdict / truth / amplification token
  (no winner/loser/true/false/correct/liar/dishonest/bad faith/popular/viral/trending/etc.). A
  ban-list test scans them.
- **Circle names are user content** (like a room title). Their doctrine treatment is
  render-time scanning by the circles rendered-UI ban-list test (per the migration doctrine, circle
  name/description are scanned in rendered UI, never rejected at input). This card renders names
  only; it authors no name.
- **Member-count label** is a size ("N members" / a count badge) via `circleModel`, never a rating
  word.

---

## Edge cases

- **No circles at all** → `CircleFilterRow` returns null; lane is byte-identical to HOME-001. No
  empty shell.
- **Circles still loading** (`circlesLoading`) → render nothing (or the existing lane); do not flash
  a chip row then remove it. The unfiltered lane shows until circles resolve.
- **Circle selected, no rooms match** → filtered-empty block with copy + Start CTA. Never the J1
  first-run state, never a blank lane.
- **Circle selected, but the unfiltered lane is itself first-run** (`vm.isFirstRun`) → show the J1
  first-run state (there is nothing to filter); the chip row may still render if circles exist, but
  selecting one shows the filtered-empty block. (Decision: first-run takes precedence — do not
  double-render.)
- **`authorId` is null** on some/all args in a room → those ids are skipped; the room matches only
  if its resolvable set is non-empty and ⊆ members. A room with an entirely null-authored history
  never matches (bounded false-negative, documented).
- **`createdBy` null/empty** → skipped (treated as non-identifying), same as a null author.
- **Caller is the only participant** (solo room) → resolvable set `{ viewerId }`; `viewerId` counts
  as a member ⇒ the room matches every circle the caller belongs to. (Acceptable: a solo room is
  "yours" in every circle lens. If the chain wants solo rooms excluded, gate on `resolvable.size ≥ 2`
  — flagged as an operator decision, not defaulted.)
- **Drained / empty circle** (`memberIds` empty) → no room's non-empty resolvable set can be ⊆ ∅,
  so the filtered lane is empty ⇒ filtered-empty block. `memberCountBand` renders `'empty'`; the
  chip still lists (the caller can select it and see the honest empty state).
- **Room appears in both your-turn and ongoing after filtering** → cannot happen; the VM already
  dedupes (ongoing excludes your-turn ids, `homeModel.ts:114`). The filter preserves that invariant
  (subset of each).
- **Duplicate/collapsed cards** (dedupe) → the filter runs on the post-dedupe cards the VM already
  produced; no new dedupe concern.
- **Concurrent edits / offline** → membership is a read snapshot; a stale snapshot only widens or
  narrows the lens harmlessly (never a leak — RLS gates loadability). `refresh` re-pulls.
- **Permission-denied on the circle read** → `listMyCircles` returns `{ ok: false }`; `App.tsx`
  passes `circles: []` ⇒ no chip row (graceful; the lane is the unfiltered HOME-001).

---

## Test plan

Baseline (per card brief): **928 suites / 33,220 tests.** Expected delta: **~+2 suites / +30-40
tests.** All new production code is covered; test count goes up.

**`__tests__/circleHomeFilter.test.ts` (pure model, ~20-24 tests)**
- `roomMatchesCircle`: all-members match; partial overlap excluded; out-of-circle excluded;
  caller-solo room matches (viewerId always a member); empty resolvable set never matches; drained
  circle (empty memberIds) never matches a non-empty room; null authors skipped; viewerId counted
  even if absent from memberIds.
- `buildParticipantIdIndex`: distinct authors ∪ createdBy; null `authorId` skipped; null
  `createdBy` skipped; multiple rooms indexed independently; empty args → empty set.
- `filterArgumentHomeByCircle`: narrows **both** your-turn and ongoing; **the AC fixture** — mixed
  rooms (all-in-circle / partial-overlap / out-of-circle) proves inclusion/exclusion exactly;
  **projection-not-rebuild** (returned cards/items are the *same references* — `toBe`, not
  `toEqual`); determinism (same input twice → deeply-equal); inputs not mutated.
- `toCircleLens`: maps `memberIds`; maps `members[].userId`; caller-in-set preserved; empty →
  `band 'empty'`.
- No-filter identity: a "select all/null" path (or not calling the filter) yields the input
  references (locks AC "deep-equal to unfiltered HOME-001").

**`__tests__/circleFilterRow.test.tsx` (RNTL, ~10-14 tests)**
- Renders one chip per circle + an "All" chip; returns **null** when `circles.length === 0`.
- Selection toggle: pressing a chip fires `onSelect(id)`; pressing "All" fires `onSelect(null)`;
  `accessibilityState.selected` tracks the current selection.
- a11y floors: every chip has role + label + state; every chip meets 44px (visual or `hitSlop`);
  selection carries a **non-color** signal (assert the selected chip's non-color style/glyph, not
  just a color).
- Copy: chip labels + a11y labels pass the verdict-token ban-list; member count renders as a size.

**`__tests__/argumentHome.test.tsx` (extend, ~+6-8 tests)**
- Chip row visible when `circles.length > 0`; hidden when `0`.
- Selecting a circle narrows **both** the your-turn strip and the ongoing list (assert specific
  rooms in/out via the author-proxy fixture).
- Filtered-empty state renders with the Start CTA when a selected circle matches nothing (and the
  unfiltered lane is not first-run).
- **D8 composition:** a fixture (bot) room that D8 excludes stays excluded when a circle is selected
  (never resurfaced) — the founding AC.
- Start CTA in the filtered-empty state calls `onStart` (with the circle id when prefill is wired).

**Ban-list / regression**
- New `HOME_COPY` circle-filter strings scanned by the existing verdict-token ban-list test
  (extend the copy scan or add a focused test).
- `homeModel.test.ts` and the existing D8-exclusion tests **unchanged and green** (this card does
  not touch `homeModel.ts`).
- `npm run typecheck`, `npm run lint`, full `jest` suite green (capture the `Test Suites: … / Tests:
  …` line + `EXIT: 0`).

---

## Dependencies (cards / docs / files)

- **Blocked by HOME-001 (#874)** — hard blocker. This card filters `ArgumentHome`'s Your-table lane
  (`src/features/home/ArgumentHome.tsx`, `homeModel.ts`). Reads `buildArgumentHomeViewModel`'s
  `{ yourTurn, ongoing }` output and the `argumentsByDebateId` / `debates` props it already receives.
- **Schema (live): PRIVATE-GROUPS-002 (#859)** — `20260702000001_private_groups_002_circles.sql`
  (`circles`, `circle_members`, `is_circle_member`, member-scoped SELECT). Consumed read-only.
- **Interface dependency: START-002 (#839)** — owns the `listMyCircles` / `useMyCircles`
  circles-read module and the start-picker prefill. Reconcile the [numbered
  assumptions](#interface-contract-with-start-002-numbered-assumptions) against START-002's final
  design before coding. Concurrent in this worktree; **do not block on it** — code against the
  narrow `CircleLens` + `toCircleLens` adapter.
- **Reuses** `circleModel.ts` (`deriveCircleDisplaySummary` / `memberCountBand` /
  `CircleMemberSummary`) and `gameCopy.HOME_COPY`.
- **Feature flag:** none new. The filter lives inside the already-`home_v2`-flagged surface
  (prop-driven from `App.tsx`, `App.tsx:1025`); no flag registry change.

---

## Risks

- **Approximate-predicate honesty (primary risk).** The author-set proxy is not the full
  participant set. Mitigation: the pure model is exact; the proxy is isolated in
  `buildParticipantIdIndex` with an explicit comment + this design's bounded-error table; over-
  inclusion is never a visibility leak (RLS-gated); the `debate.circle_id` exactness upgrade is
  documented for reconciliation with START-002. **The reviewer should confirm the code comment
  states the proxy's false-positive/negative bounds.**
- **START-002 shape drift.** If `listMyCircles` does not expose per-circle member **user-ids**
  (assumption 3), the filter cannot compute — a **blocking** reconciliation item; flag and stop,
  do not ship a silently-empty filter. The `CircleLens` adapter absorbs *field-name* drift but not
  *missing member-ids*.
- **HOME-001 surface blast radius.** `ArgumentHome` edits must be **additive** — when no circle is
  selected the lane must be byte-identical (locked by a "no-filter identity" test + the unchanged
  `homeModel.ts` tests). Do not refactor the existing your-turn/ongoing/CTA blocks.
- **`App.tsx` wiring.** Adding the `useMyCircles` call + props is a real (if small) `App.tsx` change;
  keep it to data wiring (no shell/nav change). The `onStart` widening must stay backwards-
  compatible (optional arg).
- **Solo-room inclusion** (caller-only rooms matching every circle) may be surprising; flagged as an
  operator decision (default: included) rather than silently gated.
- **Escape hatch B temptation.** If a future editor loads `debate.circle_id`, it changes the shared
  `Debate` type/loader — that is a *separate, coordinated* change with START-002, not an in-place
  tweak. Keep it out of this card unless the chain explicitly adopts it.

---

## Non-goals

- **No new screen.** No group-room collection screen (the retired PRIVATE-GROUPS-003).
- **No navigation-shell change** beyond wiring the in-lane filter's data.
- **No Edge Function, no migration, no RLS change.**
- **No circle create / rename / invite / management UI** (owned by the PRIVATE-GROUPS service-role
  lane).
- **No circle-audience room creation** (that is START-002 / #839).
- **No public-gallery demotion (SUNSET lane), no lore view (LORE-001).**
- **No heat / temperament / ranking** added to the filtered lane.
- **No widening of `listDebates`** to load all participants (Escape hatch A — rejected).
- **No `debate.circle_id` load in this card** (Escape hatch B — documented as a fast-follow).
- **No new feature flag.**
- **No AI calls** anywhere.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the filter narrows a
  view; it renders no standing / band / winner / verdict. No posting path is touched. ✓
- **§2-§3 (heat ≠ truth; popularity is not evidence):** the filter reads only structural identity
  (circle membership) + author ids; it never reads heat, temperament, amplification, engagement,
  view/follower counts. A chip shows a **size**, never a rating. ✓
- **§4-§5 (AI limits; engine sacred):** no AI call; the rules engine is untouched. ✓
- **§6-§7 (secrets; no AI from the app):** SELECT-only reads, no keys, no service-role, no external
  AI provider. A source scan proves no `SERVICE_ROLE` / `ANTHROPIC_API_KEY` and no write to
  `circles` / `circle_members` / `circle_invites`. ✓
- **§8 (Supabase conventions):** RLS is authoritative; the read is member-scoped via
  `is_circle_member`; nothing widens visibility (the filter only *narrows* the caller's already-
  authorized set). No table/RLS change. ✓
- **§9 (plain language):** all user-facing copy is plain; no internal code (`is_circle_member`,
  bucket codes) reaches a string; new copy is ban-list scanned. ✓
- **§10a (Observations vs Allegations):** no node label is added; a circle chip is neither an
  Observation nor an Allegation — it is a navigation lens. No classifier id is surfaced. ✓
- **§10 (v1 scope guards):** no voting/winner, no search (this is a membership filter, not argument
  search), no OAuth/push/public-API. ✓
- **accessibility-targets:** 44px chips; role + label + state on every chip; color-independent
  selection; reduce-motion safe (static); 390px band via horizontal scroll; verified across the
  standard cross-device matrix. ✓
- **expo-rn-patterns:** RN primitives only (`View` / `Text` / `Pressable` / `ScrollView`); no new
  dep; pure `*Model` file has no React/Supabase import; new surface plugs into HOME-001, does not
  duplicate it. ✓

---

## Operator steps (if any)

**None — pure code change.** No migration to push, no Edge Function to deploy, no env var. The
circles schema is already live (`20260702000001`, PRIVATE-GROUPS-002). The card ships behind the
existing `home_v2` prop gate; no flag flip is required to merge (the filter only appears when the
caller has ≥1 live circle).
