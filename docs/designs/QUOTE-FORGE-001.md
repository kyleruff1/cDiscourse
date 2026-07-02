# QUOTE-FORGE-001 — Light the cross-room linked-prior wire + create-link picker

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 (epic #826)
**Release:** Cross-room linking activation
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/841

## Goal (one paragraph)

QOL-042 shipped a complete, tested cross-room-linking substrate — a
`public.argument_room_links` table with a `link_target_must_be_locked`
trigger and four RLS policies, a pure `buildLinkedPriorArgumentChip`
model with three RLS-derived access states, a caller-scoped
`argumentRoomLinksApi` (`listLinksForRoom` / `loadPriorRoomContext` /
`createArgumentRoomLink`), a presentational `LinkedPriorArgumentChipRow`,
and an `ArgumentTimelineMap` that already **accepts** `linkedPriorChips`
+ `onOpenLinkedPrior` + `onViewLinkedPriorContext` and renders the chip
row at two seams (empty-timeline + populated header). All of it is DARK:
`ArgumentGameSurface` never passes those three props, and no create-link
picker exists, so the QOL-042 copy `createAffordance` / `pickerEmpty`
sit unrendered. This card is **client wiring only** — no migration, no
Edge Function, no new dependency, no service-role. We (1) load links on
room load, build chip view-models, and thread them + both handlers
through `ArgumentGameSurface` into the already-wired `ArgumentTimelineMap`
so chips RENDER in a live room, and (2) add a create-link picker that
lists caller-visible **locked** prior rooms (a plain `.select()`, never a
free-text global search), segments same-circle rooms first when the
current room has `circle_id`, and calls `createArgumentRoomLink`. The
privacy doctrine is inherited whole from QOL-042: `authorized` /
`title_only` / `unavailable` derive PURELY from what RLS returned; a
prior room the viewer cannot access surfaces at most its title snapshot.

## Data model

**No new data model.** Every table, column, trigger, and RLS policy is
already live (`20260521000010_qol042_argument_room_links.sql` deployed;
`20260702000001_private_groups_002_circles.sql` deployed with
`debates.circle_id uuid null`). The domain types
(`ArgumentRoomLink`, `LinkAccessState`, `PriorRoomSummary`,
`LinkedPriorArgumentChip`, `PriorRoomContext`) already exist in
`linkedPriorArgumentModel.ts` and `argumentRoomLinksApi.ts`.

Two SMALL new pure-TS shapes for the picker candidate list (both in the
crossRoom module, both client-only, no DB change):

```ts
// crossRoom/linkTargetPickerModel.ts (NEW — pure TS)

/** One row a caller may reference: a locked, caller-readable prior room. */
export interface LinkTargetCandidate {
  debateId: string;
  title: string;          // debates.title (live, caller-readable)
  /** debates.circle_id — null for every room today (zero backfill). */
  circleId: string | null;
  /** True when circleId === the current room's circleId (both non-null). */
  sameCircle: boolean;
}

/** The segmented, ordered, capped candidate list the picker renders. */
export interface LinkTargetPickerModel {
  /** Same-circle candidates first (only populated when current circleId set). */
  sameCircle: ReadonlyArray<LinkTargetCandidate>;
  /** Everything else the caller can see, recency-ordered. */
  other: ReadonlyArray<LinkTargetCandidate>;
  /** True when the raw candidate count exceeded the cap and rows were dropped. */
  moreNotShown: boolean;
  /** True when there are zero candidates (drives the pickerEmpty copy). */
  isEmpty: boolean;
}
```

The picker cap is a module constant `MAX_LINK_TARGET_CANDIDATES = 20`.

## File changes

### New files

- `src/features/arguments/crossRoom/linkTargetPickerModel.ts` — pure-TS
  candidate segmentation/capping. `buildLinkTargetPickerModel(candidates,
  currentCircleId)` sorts same-circle first, applies the 20-cap, sets
  `moreNotShown` / `isEmpty`. Deterministic, no fetch. (~90 lines)
- `src/features/arguments/crossRoom/LinkTargetPickerSheet.tsx` — the
  presentational picker overlay (sibling of the deletion sheet pattern):
  header, `createAffordance` label, segmented candidate list (same-circle
  section header when populated), an optional note `TextInput` (≤280),
  the `pickerEmpty` state, the `moreNotShown` line, and a Cancel. Fires
  `onPickTarget(candidate)` + `onSubmit(candidate, note)`. RN primitives
  only. (~230 lines)
- `src/features/arguments/crossRoom/useLinkedPriorRooms.ts` — the room-
  scoped hook that owns the fetch: `listLinksForRoom(sourceDebateId)`
  then, per link, `loadPriorRoomContext(targetDebateId)`; builds the
  chip view-models with `buildLinkedPriorArgumentChip`. Exposes
  `{ chips, loading, error, refresh }`. Also exposes
  `loadLinkCandidates()` (the picker query) and
  `createLink(candidate, note)` wrapping `createArgumentRoomLink` +
  `refresh`. (~160 lines)
- `__tests__/linkTargetPickerModel.test.ts` — pure-model tests.
- `__tests__/useLinkedPriorRooms.test.ts` — hook tests (mocked api).
- `__tests__/LinkTargetPickerSheet.test.tsx` — picker UI + a11y tests.
- `__tests__/quoteForge001ChipWiring.test.tsx` — integration: chips
  render in a live room through `ArgumentGameSurface`.

### New API function (in an EXISTING file)

- `src/features/arguments/crossRoom/argumentRoomLinksApi.ts` — ADD
  `listLinkTargetCandidates(currentDebateId)`: a caller-scoped
  `.select('id, title, status, circle_id').eq('status','locked')
  .neq('id', currentDebateId).order('updated_at',{ascending:false})
  .limit(MAX_LINK_TARGET_CANDIDATES + 1)` on `debates`. RLS returns only
  rooms the caller can read; the trigger's locked-requirement is
  mirrored by the `status='locked'` filter so the picker never offers a
  room that would be rejected at insert. Also ADD
  `loadCurrentRoomCircleId(currentDebateId)`: a one-row
  `.select('circle_id').eq('id', currentDebateId).maybeSingle()` (the
  `Debate` type does not carry `circle_id`, so the picker reads it here).
  Both return the standard `ArgumentRoomLinkResult` envelope. (~55 lines)

### Modified files

- `src/features/arguments/ArgumentGameSurface.tsx` — thread three NEW
  optional props (`linkedPriorChips`, `onOpenLinkedPrior`,
  `onViewLinkedPriorContext`) into the SINGLE `<ArgumentTimelineMap>`
  mount (currently ~line 2409, the `mode === 'timeline'` branch). ADD an
  optional `onOpenLinkPicker?: () => void` prop and surface the
  `createAffordance` entry in the timeline-header affordance set (calm
  posture — see §Chips posture). ALL new comments APOSTROPHE-FREE with
  balanced quotes/backticks (uxOneOneTwoDoctrine scanner). (~25 lines)
- `src/features/arguments/ArgumentTreeScreen.tsx` — mount
  `useLinkedPriorRooms(debate.id)`; forward `chips`, `onOpenLinkedPrior`
  (a callback that bubbles the `targetDebateId` for the tapped link up
  via a new `onOpenPriorRoom?` prop), `onViewLinkedPriorContext` (opens
  the existing Inspect popout section — smallest correct affordance),
  and the picker (`onOpenLinkPicker` → mount `LinkTargetPickerSheet`
  locally, `createLink` on submit). ADD `onOpenPriorRoom?:
  (targetDebateId: string) => void` to its Props and forward from App.
  (~40 lines)
- `App.tsx` — pass `onOpenPriorRoom={handleOpenPriorRoom}` into
  `<ArgumentTreeScreen>`. NEW `handleOpenPriorRoom(targetDebateId)`
  REUSES the exact deep-link mechanism already present
  (`resolveRoomDeepLinkAccess` + `debates.find` + `selectDebate(target,
  side)` where `side = target.myParticipantSide ?? 'observer'`); an
  id absent from the RLS-filtered `debates` list drives the existing
  `roomUnavailableOpen` neutral notice — never a silent drop, never a
  new room-open path. (~20 lines)

### Deleted files

None.

## API / interface contracts

```ts
// argumentRoomLinksApi.ts (additions)
export const MAX_LINK_TARGET_CANDIDATES = 20;

export async function listLinkTargetCandidates(
  currentDebateId: string,
): Promise<ArgumentRoomLinkResult<LinkTargetCandidate[]>>;
// caller-scoped .select on debates: status='locked', id != current,
// updated_at desc, limit MAX+1 (the extra row flags moreNotShown).
// Maps each row to LinkTargetCandidate with circleId = row.circle_id ?? null.

export async function loadCurrentRoomCircleId(
  currentDebateId: string,
): Promise<ArgumentRoomLinkResult<string | null>>;

// linkTargetPickerModel.ts
export function buildLinkTargetPickerModel(
  candidates: ReadonlyArray<LinkTargetCandidate>,
  currentCircleId: string | null,
): LinkTargetPickerModel;

// useLinkedPriorRooms.ts
export function useLinkedPriorRooms(sourceDebateId: string): {
  chips: ReadonlyArray<LinkedPriorArgumentChip>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  loadLinkCandidates: () => Promise<LinkTargetPickerModel>;
  createLink: (
    candidate: LinkTargetCandidate,
    note: string,
  ) => Promise<{ ok: boolean; error?: string; duplicate?: boolean }>;
};

// ArgumentGameSurface Props (additions — all optional, back-compat)
linkedPriorChips?: ReadonlyArray<LinkedPriorArgumentChip>;
onOpenLinkedPrior?: (linkId: string) => void;
onViewLinkedPriorContext?: (linkId: string) => void;
onOpenLinkPicker?: () => void;

// ArgumentTreeScreen Props (addition)
onOpenPriorRoom?: (targetDebateId: string) => void;
```

The `onOpenLinkedPrior(linkId)` handler in `ArgumentTreeScreen` maps
`linkId → link.targetDebateId` (from the loaded links the hook holds)
and calls `onOpenPriorRoom(targetDebateId)`. A `title_only` chip's
"Open" is already disabled in the model, so the handler is only reached
for an authorized link.

## Edge cases

- **No links** — hook returns `chips: []`; `LinkedPriorArgumentChipRow`
  already renders `null` for an empty array. Zero default-path noise.
- **Empty candidate list** — every existing room today has
  `circle_id = NULL` and there may be zero OTHER locked rooms the caller
  can read. `buildLinkTargetPickerModel` sets `isEmpty: true`; the sheet
  renders `LINKED_PRIOR_ARGUMENT_COPY.pickerEmpty`. The picker is NOT
  empty-by-construction: it lists all caller-visible locked rooms, so a
  caller with any settled room to reference sees them.
- **Current room has circle_id (future data)** — `loadCurrentRoomCircleId`
  returns it; `buildLinkTargetPickerModel` segments same-circle first.
  With zero backfill today, `sameCircle` is empty and everything falls
  into `other` — the required "not empty-by-construction in today's data"
  behavior.
- **Target unlocks/changes between list and create** — the picker only
  lists `status='locked'` rooms, but a room could transition after the
  list. `createArgumentRoomLink` surfaces the trigger's
  `check_violation` ("a prior argument can only be linked once it is
  settled") as a calm plain-language error in the sheet; no crash, no
  optimistic chip.
- **Duplicate link** — `createArgumentRoomLink` treats the
  `one_link_per_pair` 23505 conflict as idempotent success and returns
  the existing row. The hook surfaces `duplicate: true`; the sheet
  closes calmly ("This prior argument is already referenced.") and
  `refresh()` shows the existing chip. No error toast.
- **Caller not a participant of the CURRENT room** — the INSERT RLS
  requires `is_debate_participant(source_debate_id, auth.uid())`. A pure
  observer cannot create a link; the create affordance is
  disabled-with-reason for `viewerRole === 'observer'` (QOL-031 doctrine:
  a disabled entry shows a visible reason). Observers still SEE existing
  chips (read path is unaffected).
- **Offline / network failure on context refresh** — `loadPriorRoomContext`
  returns `ok:false`; the hook keeps the last good chips and can surface
  `LINKED_PRIOR_ARGUMENT_COPY.couldNotRefresh`. Never blocks the room.
- **title_only prior room** — chip renders the snapshot title only, no
  content, "Open" disabled with reason, no "View context". Verified by a
  privacy test asserting no body/count leaks in that state.
- **unavailable prior room** — single neutral line, no title, no actions.
- **Reduce motion** — the picker sheet and chip row have no non-essential
  animation; if any open/close transition is added it snaps when
  `reduceMotionOverride` (already threaded to the surface) is true.

## Test plan

- `__tests__/linkTargetPickerModel.test.ts`
  - happy path: mixed circle/non-circle candidates → same-circle first.
  - `currentCircleId === null` → all rows in `other`, `sameCircle` empty.
  - cap: 21 raw candidates → 20 rendered, `moreNotShown: true`.
  - empty input → `isEmpty: true`.
  - current room excluded is a query concern; the model asserts it does
    not re-introduce the current id if passed.
- `__tests__/useLinkedPriorRooms.test.ts` (mocked argumentRoomLinksApi)
  - loads links + context and builds chips for a live room.
  - three access states surface correctly (authorized / title_only /
    unavailable) — PRIVACY: title_only chip carries only the snapshot
    title, no `moveCount`, no content.
  - `createLink` calls `createArgumentRoomLink` with
    `{ sourceDebateId, targetDebateId, targetTitleSnapshot, note, createdBy }`.
  - duplicate path → `duplicate: true`, no error.
  - trigger-rejection path → `ok:false` with a plain-language error.
- `__tests__/LinkTargetPickerSheet.test.tsx`
  - lists only the candidates it is given; same-circle section header
    renders only when populated.
  - `pickerEmpty` copy renders for an empty model.
  - note `TextInput` clamps display at 280; a11y: role/label/44px on
    every Pressable, the create affordance has `accessibilityRole=button`,
    the disabled-for-observer state reports `accessibilityState.disabled`
    + a visible reason.
- `__tests__/quoteForge001ChipWiring.test.tsx`
  - render `ArgumentGameSurface` in `timeline` mode with
    `linkedPriorChips` populated → `linked-prior-chip-row` testID present.
  - `onOpenLinkedPrior` fires with the link id when an authorized chip's
    Open is pressed.
  - empty `linkedPriorChips` → no chip row (default-path calm).
- Ban-list: extend `linkedPriorArgumentCopy.test.ts` coverage is already
  present; add a scan asserting NO new user-facing string in
  `linkTargetPickerModel` / `LinkTargetPickerSheet` contains a forbidden
  token (reuse `_forbiddenLinkedPriorTokens()`).
- Regression re-run (PRESERVE green): `uxOneOneTwoDoctrine`,
  `sunset003DefaultPathLeakage`, `uxOneOneFiveReadOnlyBoundary`,
  `uxOneOneSixReadOnlyBoundary`, `ArgumentTimelineMap.test.tsx`,
  `ArgumentGameSurface.integration.test.tsx`.

## Dependencies (cards / docs / files)

- Assumes QOL-042 is complete (it is: table + trigger + RLS + model +
  api + chip row + ArgumentTimelineMap props all on main).
- Assumes PRIVATE-GROUPS-002 (#859/#860) is complete for the
  `debates.circle_id` column (it is: deployed, all rows NULL).
- Reads existing navigation: `App.tsx` `handleOpenNotificationDeepLink`
  / `handleOpenArgumentFromAdmin` pattern (`resolveRoomDeepLinkAccess` +
  `debates.find` + `selectDebate(target, side)`), reused verbatim for
  `handleOpenPriorRoom`.
- Reads existing `ArgumentTimelineMap.tsx` chip render seams
  (~lines 968 empty-state, ~1065 populated) — already wired, unchanged.
- Blocks QUOTE-FORGE-002 (#842 — node echo treatment) and
  QUOTE-FORGE-003 (#843 — cross-room free-text search) which build on a
  lit wire.

## Risks

- **uxOneOneTwoDoctrine naive scanner** — ArgumentGameSurface.tsx is
  scanned with a quote-parity STRING_RE that mis-reads an apostrophe in a
  comment as an unbalanced quote. ALL new comments in that file must be
  apostrophe-free with balanced quotes/backticks. Run
  `npm run test -- uxOneOneTwoDoctrine` pre-push.
- **Wave-2 line drift** — #844/#845/#846 moved the timeline mount; there
  is now exactly ONE `<ArgumentTimelineMap>` (in the `mode==='timeline'`
  else branch). The design threads props there, not at the stale
  ~2305-2349 anchors from the original card.
- **Boundary suites** — `uxOneOneFive/Six ReadOnlyBoundary` pin
  `ArgumentTimelineMap` / `ArgumentGameSurface` by REQUIRED-API presence
  (they must keep exporting the component), not byte-equal. Adding props
  is fine; do not remove the exports. `ArgumentTimelineMap` is already
  un-pinned for byte-equal via NOTE; no relaxation needed.
- **circle_id has no client data path today** — `listDebates` does not
  select it and `Debate` does not carry it. The picker reads it via the
  new `loadCurrentRoomCircleId` + the candidate `.select('...,circle_id')`
  rather than widening the shared `Debate` type / `listDebates` (keeps
  the change isolated to crossRoom, avoids touching the debates slice).
- **Observer create-affordance** — the INSERT RLS needs source-room
  participation. If the affordance were enabled for observers, every
  create would fail at the DB. The design disables it with a visible
  reason for observers rather than surfacing a DB error.
- **Full-suite flakes** — `startArgumentInviteLinkBox`,
  `pointLifecycleModel` (LIFE-001) flake under parallel load; re-run
  isolated if they fire (they are not in this diff).

## Out of scope

- Composer weave-injection of a linked prior into a move body
  (UX-COMPOSER-005 #831).
- Distinct visual echo treatment on nodes beyond the existing chip row
  (QUOTE-FORGE-002 #842).
- Cross-room free-text / global search of prior rooms
  (QUOTE-FORGE-003 #843).
- Any lore / reel / highlight feature.
- Any Edge Function / mcp-server / migration / config / validator /
  ban-list / familyRegistry / prompt change.
- Widening `listDebates` / the `Debate` type to carry `circle_id`.
- New dependencies; any service-role usage in client code.
- Editing `docs/core/current-status.md`.

## Doctrine self-check

- **cdiscourse-doctrine — no truth labels**: the chip and picker carry
  CONTEXT, never a verdict. Copy is drawn from
  `LINKED_PRIOR_ARGUMENT_COPY` (ban-list scanned); the new picker model /
  sheet add strings that are ban-list scanned against
  `_forbiddenLinkedPriorTokens()`. No "won / proved / correct".
- **cdiscourse-doctrine — score never blocks posting**: links are not
  arguments; `createArgumentRoomLink` never calls `submit-argument` and
  never writes `public.arguments`. Nothing about linking gates a move.
- **cdiscourse-doctrine — no service-role**: the new api functions import
  only the shared `supabase` client under the caller JWT. RLS + the
  trigger do all enforcement. No `createClient`, no service-role key.
- **cdiscourse-doctrine — heat is not truth**: the picker orders by
  `updated_at` (recency, an activity fact) and never by heat/score;
  candidates carry no strength/verdict field.
- **QOL-042 privacy (three-state access)**: `authorized` / `title_only` /
  `unavailable` derive purely from what RLS returned via
  `loadPriorRoomContext`. The picker lists only rooms the caller can
  already read (RLS does the work — no bypass). A private prior room
  surfaces at most its title snapshot; `handleOpenPriorRoom` on an
  id absent from the RLS-filtered `debates` list yields the neutral
  unavailable notice (no enumeration).
- **timeline-grammar**: the chip row lives in the timeline header /
  empty-state seam; it is CONTEXT, not a node — it adds nothing to the
  node token table and carries no strength/heat/type encoding.
- **accessibility-targets**: every picker Pressable + chip action has
  `accessibilityRole=button`, a verbose `accessibilityLabel`,
  `accessibilityState` (disabled/expanded), and a 44x44 target via
  `hitSlop`; color is never the only signal (glyphs + text carry
  meaning); reduce-motion snaps any transition.

## Operator steps (if any)

None — pure client code change. The QOL-042 migration + trigger + RLS
and the circles schema are already deployed. No `db push`, no
`functions deploy`.

## Implementer notes (faithful refinements, not a redesign)

Two small implementation choices refine — without changing — the LOCKED
design. Both keep the design's contracts and doctrine intact.

1. **Duplicate signal via the result envelope.** The design says the hook
   returns `duplicate: true` on the idempotent 23505 path. Rather than
   inferring it from row fields (fragile), `createArgumentRoomLink` now
   carries an OPTIONAL `duplicate?: boolean` on its SUCCESS envelope
   (`{ ok: true; data; duplicate? }`), set only when the pre-existing row
   is returned. This is additive and back-compatible (existing callers
   ignore it). `useLinkedPriorRooms.createLink` reads that flag.

2. **`MAX_LINK_NOTE_CHARS` duplicated in the picker model.** The
   presentational `LinkTargetPickerSheet` must clamp the note at 280 but
   must NOT import `argumentRoomLinksApi` (which pulls in the Supabase
   client into a pure view). The 280 constant is therefore also exported
   from the pure `linkTargetPickerModel.ts` (mirroring the api's
   `MAX_LINK_NOTE_CHARS` + the DB CHECK). The api still clamps on write —
   the sheet clamp is a display-only guard.

3. **`onViewLinkedPriorContext` default handler.** The design routes
   "View context" to the existing Inspect popout. Since the game surface
   OWNS that popout, `ArgumentGameSurface` opens its own Inspect
   (`setInspectVisible(true)`) when the room shell does not supply its own
   `onViewLinkedPriorContext`. `ArgumentTreeScreen` intentionally does not
   pass the prop, so the smallest-correct-affordance default applies.
