# HOME-001 — ArgumentHome (Your table): resume-first home behind home_v2

**Status:** Design draft
**Epic:** ASP-000 (#826) — Argument Surface Pivot · Phase 1
**Release:** M-ASP-1 · PR 03 of the pivot slicing plan
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/874
**Priority / effort:** P0 · M · `ux` · flag `home_v2`
**Baseline this design targets:** 901 suites / 32,917 tests (post ASP P0 bundle #877). The CLAUDE.md "1805 tests / 70 suites" stage line is stale; the true current baseline is in `docs/core/current-status.md` (2026-07-08 entry).

---

## Goal (one paragraph)

Today the signed-in landing surface is the public `ConversationGalleryScreen` — a browse-first, 10-lane taxonomy of *everyone's* rooms. A returning participant has to hunt for their own dispute before they can answer it. HOME-001 replaces gallery-as-landing with **"Your table"**: an `ArgumentHome` surface whose spine is a **your-turn strip** (disputes waiting on you, one tap back into the exact awaited node via the existing entry-hint pre-activation), then opponent-forward **ongoing** cards, one **+ Start** CTA, a collapsed **floor door** to today's gallery (intact), and an **activity** module (the existing notification list). The whole thing sits behind the shipped `home_v2` flag (`EXPO_PUBLIC_HOME_V2`, ASP-FLAGS-001 / #873); with the flag unset the landing renders byte-identically to today. The single metric this card moves (Design Pass §14): median seconds from opening the app to a posted reply in an ongoing dispute (journey J2). Doctrine constraints that shape the design: the your-turn ranking is a **deterministic turn-state/recency projection** — no score, heat, popularity, or AI output gates anything (cdiscourse-doctrine §1–§3); opponent-forward cards address a person by name/avatar but carry **no verdict label** (§1, §10a); the read path is the existing anon-key RLS gallery load — **no new query, no service-role, no migration, no AI call** (§4, §6, §7, §8).

---

## Data model

**No new data model.** No migration, no new table, no column, no new Supabase query, no Edge Function.

Why: everything ArgumentHome needs is already loaded in `App.tsx` for the gallery and the notification badge:

- `useDebates()` → `debates: Debate[]` (App.tsx:553)
- `useGalleryArguments(debateIds)` → `argumentsByDebateId` (App.tsx:555) — the single batched `.in('debate_id', [...])` gallery load
- `useNotifications(userId)` → `{ notifications, unreadCount, ... }` (App.tsx:565)
- `useAccountProfile(userId)` → `currentProfile.role` (App.tsx:556) — the admin discriminator for fixture exclusion

`ArgumentHome` receives these as props and re-runs the **pure** `buildConversationGalleryCards(input)` on the same inputs (deterministic, side-effect-free, no I/O — exactly what `ConversationGalleryScreen` does at line 192). The your-turn / ongoing projections are pure functions over the resulting `ConversationGalleryCard[]`. AC6 ("no new network") is satisfied by construction: HOME-001 adds **zero** call sites that touch `supabase`, `fetch`, or any `*Api.ts` network wrapper.

The only card-shape touch is a **zero-behavior-change refactor** (see "Design decision 2 / your-turn derivation"): the three latest-author display literals already emitted at `conversationGalleryModel.ts:984–988` (`'You'` / `'Other voice'` / `'Unknown'`) are hoisted into an exported frozen constant so the deriver can key off them without a magic string. Emitted strings are identical → existing snapshot/equality tests stay green.

---

## Design decisions (the six, each with rationale)

### Decision 1 — Lane, not screen (state-flag nav; no router)

`home_v2` adds a **new landing lane inside the existing arguments tab**, wired via App.tsx state, not a new routed screen. Confirmed against the real shell:

- `App.tsx:544` — `const [galleryLane, setGalleryLane] = useState<ConversationGallerySection | 'all'>('all');`
- `App.tsx:935` — the gallery-as-landing render block, gated by `!aboutOpen && !demoCorridorOpen && activeTab === 'arguments' && !hasDebate && !notificationsOpen`.

Change: widen the state type to `ConversationGallerySection | 'all' | 'home'` and gate the **initial value** on the flag:

```ts
const homeV2Enabled = isHomeV2Enabled();               // the ONE flag read (App.tsx)
const [galleryLane, setGalleryLane] =
  useState<ConversationGallerySection | 'all' | 'home'>(homeV2Enabled ? 'home' : 'all');
```

The landing render block splits into two mutually exclusive branches on `galleryLane === 'home'`:
- `galleryLane === 'home'` → mount `<ArgumentHome … onOpenFloor={() => setGalleryLane('all')} />`.
- otherwise → the **unchanged** gallery-with-toolbar block (passes `activeLane={galleryLane as ConversationGallerySection | 'all'}` — safe because `'home'` is peeled off above).

Rationale: this is the cheapest, most reversible wiring. It matches Design Pass §3 ("HOME and THE FLOOR are two lanes of the arguments tab; galleryLane extends 'all' | 'my_rooms' → + 'home'") and adds **no router package** (AC7). Flag-off ⇒ the initial lane is `'all'` and `'home'` is unreachable (nothing else sets it — see Decision 4) ⇒ the gallery landing is untouched. `'home'` is deliberately **not** added to `ConversationGallerySection` (that union drives `groupGalleryCardsBySection` / `SECTION_ORDER` / gallery chips); it lives only in the App.tsx-local lane state, so the gallery model is not perturbed.

### Decision 2 — Three-slice structure

**Slice 1 — pure model (no UI), in `src/features/debates/conversationGalleryModel.ts`.**
The your-turn primitive lives beside the gallery model (per card scope) so it can reuse the module's card contract and be unit-tested with zero React and zero network.

- `latestPostAuthor` on `ConversationGalleryCard` is a **display string** (`conversationGalleryModel.ts:984–988`): `'You'` when `stats.latestAuthorId === input.currentUserId`, `'Other voice'` when the latest author is a known other user, `'Unknown'` when there is no attributable latest author. The raw author id is intentionally **not** exposed on the card.
- To avoid a magic-string coupling and avoid a card-shape change, **hoist those three literals** into an exported frozen constant and refactor line 984–988 to use it (identical emitted output):

  ```ts
  export const LATEST_AUTHOR_LABEL = Object.freeze({
    you: 'You', other: 'Other voice', unknown: 'Unknown',
  } as const);
  ```

- `isWaitingOnViewer(card)` — a joined room whose latest non-deleted move is not the viewer's:

  ```ts
  export function isWaitingOnViewer(card: ConversationGalleryCard): boolean {
    return (
      card.hasUserJoined === true &&                       // participant (incl. mySide != null; see line 998)
      card.openStatus === 'open' &&                        // answerable (not locked/archived/draft)
      card.moveCount > 0 &&
      card.latestPostAuthor === LATEST_AUTHOR_LABEL.other  // latest move is a known other, not you, not unknown
    );
  }
  ```

  This satisfies AC4 exactly: waiting-on-me appears; viewer authored latest (`'You'`) does not; observer-only (`hasUserJoined === false`) does not.

- `deriveYourTurn(cards, opts?)` — filters to `isWaitingOnViewer`, then applies the fixture exclusion (Decision 3), then **ranks deterministically**: `hint-verb → unread → recency`.

  ```ts
  export interface DeriveYourTurnOptions {
    unreadDebateIds?: ReadonlySet<string>;   // from notifications, keyed by debateId; pure input
    isAdminViewer?: boolean;                  // admins keep fixture rooms (Decision 3)
  }
  export interface YourTurnItem {
    card: ConversationGalleryCard;
    entryHint: GalleryEntryHint;              // deriveGalleryEntryHint(card) — carries verbPhrase + activate
    hasUnread: boolean;
  }
  export function deriveYourTurn(
    cards: ConversationGalleryCard[],
    opts?: DeriveYourTurnOptions,
  ): YourTurnItem[];
  ```

  Sort key (all inputs are structural — none read popularity/engagement, doctrine §3): `[ YOUR_TURN_HINT_RANK[entryHint.code] (asc), hasUnread ? 0 : 1 (asc), -card.sortKeys.latestActivityMs (recency desc) ]`, final tie-break `debateId` asc for total determinism. `YOUR_TURN_HINT_RANK` is a frozen map giving the most actionable entry-hint codes (e.g. `be_first_rebuttal`, `answer`-family) the lowest rank. Same input array ⇒ identical output order (asserted in tests).

**Slice 2 — surface: new `src/features/home/` (`ArgumentHome.tsx` + `homeModel.ts`).**
`homeModel.ts` (pure) composes Slice-1 primitives into the view model: `buildArgumentHomeViewModel({ cards, unreadDebateIds, isAdminViewer })` → `{ yourTurn: YourTurnItem[], ongoing: ConversationGalleryCard[], isFirstRun: boolean }`. `ongoing` = participant cards (the `my_rooms` set: `card.hasUserJoined`) that survive fixture exclusion, opponent-forward, minus the your-turn cards already surfaced above, ranked by recency. `isFirstRun = yourTurn.length === 0 && ongoing.length === 0`. `ArgumentHome.tsx` renders top-to-bottom: your-turn strip → ongoing cards → **+ Start an argument** → **The floor** door → **Activity** module. `ArgumentCard.tsx` renders one opponent-forward dispute row.

**Slice 3 — App.tsx flag wiring + flag-off byte-identical proof.** The `home_v2` read, the `galleryLane` widening, the landing-branch split, and the flag-off equality test. (See Decision 4 + File changes.)

Rationale: Slice 1 is fully testable in isolation and carries the doctrine-critical logic; Slice 2 is presentational and flag-agnostic (so it needs no env mocking to test); Slice 3 is the smallest possible App.tsx delta and owns the reversibility proof. This ordering also lets the reviewer verify the no-new-network and determinism claims before any UI exists.

### Decision 3 — Fixture exclusion (hard AC — D8 / Q12), closing the `[reseed-` gap

Non-admin "Your table" must exclude bot/corpus/reseed rooms; an admin viewer still sees them.

**Verified gap (pre-launch reality audit).** The reseeder writes titles `"<seedTitle> [reseed-<pack>-<yyyymmdd>-<hash8>]"` (`scripts/reseeder/runReseeder.js:109` `buildReseedRunTag` → `:113` `buildRoomTitle`). I ran the current four `SUFFIX_TAG_PATTERNS` / `BOT_SEED_TAG_PATTERNS` against reseed titles:

```
NOMATCH "Bike lanes are better [reseed-baseline-20260708-1a2b3c4d]"
NOMATCH "Remote work [reseed-sonnet-20260708-deadbeef]"
MATCH   "Bike lanes [xai-adv 9018694f]"     ← existing families are caught
```

The reseed family slips through because pattern 1's alternation has `seed-` (word-boundary anchored — `reseed` has no boundary before `seed`) and pattern 2 starts the bracket with `seed`, but reseed starts with `re`. **Both lists must be extended in lockstep.**

**Mechanism.** Extend BOTH pattern families identically (they are byte-identical today at `conversationGalleryModel.ts:437–442` and `botRoomPolicyModel.ts:321–326`) by adding a `reseed` alternative to patterns 1 and 2 of each:

- pattern 1 alternation: add `reseed` → `(?:xai-adv|ai-corpus|stress|reseed|stage-\d+…|run-\d+|scenario-\d+|seed-\d+)` — after `reseed`, the existing `\b[^\]]*` consumes `-<pack>-<date>-<hash>` up to `]`.
- pattern 2 leading-token set: add `reseed` → `(?:xai|ai|bot|corpus|stress|scenario|seed|reseed)`.

The implementer MUST re-verify with the same harness (see Test plan) — the anchored `\b` boundary behaviour is the whole reason the gap exists, so it is not safe to eyeball:

```bash
node -e 'const P=[/…pattern1…/,/…pattern2…/,/…3…/,/…4…/];
["X [reseed-baseline-20260708-1a2b3c4d]","normal title","Y [xai-adv 90ab]"]
.forEach(t=>console.log(P.some(r=>r.test(t))?"MATCH":"NOMATCH",t));'
```

**Where exclusion is applied.** In the home projection only (read-time, per non-admin viewer). A card is a fixture room when `looksLikeBotSeedTag(card.title) === true` OR `looksLikeBotSeedTag(card.fallbackTitle) === true` (the raw title before dedupe-clean is on `debate.title`; the card's `title` is already `cleanTitleForDedupe`'d, so the deriver must also test `fallbackTitle` and, to be safe, the model should test the pre-clean title — see note below) OR the room is bot-**seeded** by author. Since HOME-001 does not load bot-hint rows (no `is_bot` column, admin-only registry — see `botRoomPolicyModel.ts` header), the tag-based `looksLikeBotSeedTag` is the available no-migration signal; `isBotSeededRoom(...)` is documented as the author-based companion but is a no-op here without hints, so exclusion relies on the **title tag families** (which is exactly what the reseeder/corpus runners stamp).

> **Reality-audit sub-finding (title already cleaned):** `card.title` is `cleanTitleForDedupe(debate.title)` (line 976), which *strips* the tag once the pattern matches it — so after we add `reseed`, `card.title` will have the tag removed and `looksLikeBotSeedTag(card.title)` would return **false**. The exclusion predicate must therefore test the **raw** title. Two clean options: (a) the home projection consumes `debates` (raw `debate.title`) alongside cards and tests `looksLikeBotSeedTag(debate.title)`; or (b) add a pure `isFixtureRoomCard(card, rawTitleByDebateId)` helper that receives the raw titles. **Recommended: (a)** — `buildArgumentHomeViewModel` already receives `debates`, so build a `Set<string>` of fixture `debateId`s from raw titles once, and exclude cards whose `debateId` is in it. This keeps the tag test on the un-stripped string and needs no card-shape change.

**Admin path.** `isAdminViewer` (`currentProfile?.role === 'admin'`, `ProfileRole = 'user' | 'moderator' | 'admin'`) short-circuits the exclusion: admins see every room including fixtures (AC5). Non-admin (`user` / `moderator` / signed-out) get the filtered set.

**Lockstep parity test.** Extend the shared fixture in `__tests__/botRoomPolicyModel.test.ts` so `BOT_SEED_TAG_PATTERNS` and `SUFFIX_TAG_PATTERNS` agree on the reseed family (both MATCH reseed titles, both NOMATCH innocent titles). This is the existing lockstep contract — reseed just adds rows.

Rationale: extend the existing pattern registry (card-directed) rather than invent a model-level filter, so the two lists cannot drift. Read-time projection only — **no DB mutation** of fixture rooms (doctrine: exclusion is a client projection, not a write).

### Decision 4 — Flag-off byte-identical proof

The `home_v2` flag is read in **exactly one place** — App.tsx — as `homeV2Enabled = isHomeV2Enabled()`, and it controls only (i) the `galleryLane` initial value (`homeV2Enabled ? 'home' : 'all'`) and (ii) whether any nav affordance is allowed to set `'home'`. With the flag unset:

- initial lane is `'all'`;
- `'home'` is never set by any code path (the only setter is the flag-gated initial value; no header item sets `'home'` unless `homeV2Enabled`);
- therefore `galleryLane === 'home'` is never true → the ArgumentHome branch never mounts → the existing gallery-with-toolbar block (App.tsx:935) renders with identical props.

**Proof test** (`__tests__/homeV2FlagOff.test.tsx`): render the landing region with `EXPO_PUBLIC_HOME_V2` unset and assert (a) the gallery toolbar + `ConversationGalleryScreen` testIDs are present, (b) **no** `home-*` / `argument-home-*` testID is present, and (c) a serialized snapshot of the flag-off landing subtree — the pinned baseline. The reviewer confirms the snapshot equals today's gallery render. Complementary: the existing `__tests__/galleryLaneFilter.test.tsx` and `__tests__/HeaderNavigation.*.test.tsx` suites run **unmodified** and stay green with zero deltas (AC1). A second render with the flag **on** asserts the ArgumentHome subtree mounts and the gallery block does not — proving the branch is real, not vacuous.

Rationale: one flag read, at the nav owner, keeps the reversibility surface a single boolean and makes the byte-identity argument trivial to audit.

### Decision 5 — Empty states (J1 first-run) via copy choke points

When `isFirstRun` (zero joined rooms), ArgumentHome shows exactly the three verbs from Design Pass §4 J1 — **Resume · Start with someone · Watch the floor** — plus **"Start your first argument"** (routes to today's start page) and the **demo-corridor** entry **"See a real one"** (→ `DemoCorridorScreen`). No bucket taxonomy is visible until The Floor is opened (AC2).

- All strings live in a new frozen `HOME_COPY` block in `src/features/arguments/gameCopy.ts` (the module that owns user-facing copy and is already ban-list scanned). Any *internal code* that reaches copy (e.g. an entry-hint code) is routed through `toPlainLanguage` (`gameCopy.ts:882`); the your-turn verb comes from `deriveGalleryEntryHint(card).verbPhrase`, which is already plain language.
- The demo-corridor entry **reuses the existing trigger**: ArgumentHome's "See a real one" calls the same `onOpenDemoCorridor` prop that App.tsx wires to `setDemoCorridorOpen(true)` (mirrors the gallery-toolbar trigger at App.tsx:961–971), and reuses `CORRIDOR_COPY` (`src/features/demoCorridor/corridorModel.ts:108`) for the corridor's own copy. No new corridor entry point.
- "Start your first argument" and "+ Start an argument" both call `onStart`, wired in App.tsx to the existing start-page open (`setStartArgumentOpen(true)`) — the sheet itself is START-001, out of scope here (Decision 6).

Rationale: routing all home copy through `gameCopy` keeps the ban-list guard authoritative and lets the copy be tested in one place; reusing the corridor trigger avoids a second demo entry that could drift.

### Decision 6 — What HOME-001 does NOT do (non-goals, to bound scope)

- **No `StartArgumentSheet` / `PersonArgumentPicker`** (START-001 #827 / START-003) — the CTA routes to *today's* start page unchanged.
- **No circle filter / audience** (HOME-003 #840, START-002).
- **No notification-trigger changes** — the activity module reuses `useNotifications` + `NotificationRow` / `NotificationListScreen` read-only.
- **No router**, no new state-flag *screen* (it is a lane).
- **No new Edge Function, migration, Supabase query, or AI call.** No re-weight of room internals, no composer, no proof drawer, no voice.
- **Gallery is demoted, not deleted** — `ConversationGalleryScreen` internals are untouched; it is the floor door's target.
- **No DB mutation of fixture rooms** — exclusion is a read-time projection.

---

## API / interface contracts

New/changed public surfaces another file will call:

**`src/features/debates/conversationGalleryModel.ts` (Slice 1, additive):**

```ts
export const LATEST_AUTHOR_LABEL: Readonly<{ you: 'You'; other: 'Other voice'; unknown: 'Unknown' }>;

export function isWaitingOnViewer(card: ConversationGalleryCard): boolean;

export interface DeriveYourTurnOptions {
  unreadDebateIds?: ReadonlySet<string>;
  isAdminViewer?: boolean;
  fixtureDebateIds?: ReadonlySet<string>;   // debateIds whose RAW title matches looksLikeBotSeedTag (built from `debates`)
}
export interface YourTurnItem {
  card: ConversationGalleryCard;
  entryHint: GalleryEntryHint;
  hasUnread: boolean;
}
export function deriveYourTurn(
  cards: ConversationGalleryCard[],
  opts?: DeriveYourTurnOptions,
): YourTurnItem[];

export const YOUR_TURN_HINT_RANK: Readonly<Record<GalleryEntryHintCode, number>>;
```

**`src/features/home/homeModel.ts` (Slice 2, pure):**

```ts
export interface BuildArgumentHomeInput {
  cards: ConversationGalleryCard[];
  debates: Debate[];                 // to test RAW debate.title for fixture exclusion
  unreadDebateIds?: ReadonlySet<string>;
  isAdminViewer: boolean;
}
export interface ArgumentHomeViewModel {
  yourTurn: YourTurnItem[];
  ongoing: ConversationGalleryCard[];   // participant cards minus your-turn, fixture-excluded, recency-ranked
  isFirstRun: boolean;
}
export function buildArgumentHomeViewModel(input: BuildArgumentHomeInput): ArgumentHomeViewModel;

/** Pure: debateIds whose raw title looks like a bot/corpus/reseed fixture tag. */
export function collectFixtureDebateIds(debates: Debate[]): Set<string>;

/** notifications → Set<debateId> that has an unread. Pure over the loaded list. */
export function collectUnreadDebateIds(notifications: RoomNotification[]): Set<string>;
```

**`src/features/home/ArgumentHome.tsx` props:**

```ts
export interface ArgumentHomeProps {
  debates: Debate[];
  argumentsByDebateId: Record<string, GalleryArgumentInput[]>;
  currentUserId: string | null;
  isAdminViewer: boolean;
  notifications: RoomNotification[];
  unreadCount: number;
  notificationsLoading: boolean;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpen: (debate: Debate, side: ParticipantSide | null, entryHint: GalleryEntryHint | null) => void;
  onStart: () => void;                       // → today's start page (START-001 later mounts the sheet here)
  onOpenFloor: () => void;                    // → setGalleryLane('all')
  onOpenDemoCorridor: () => void;             // → setDemoCorridorOpen(true) (reused trigger)
  onOpenNotificationDeepLink: (link: NotificationDeepLink) => void;  // existing handler
}
```

**`ArgumentCard.tsx` props:** `{ card: ConversationGalleryCard; entryHint: GalleryEntryHint; viewerId: string | null; state: 'your_turn' | 'waiting' | 'resting' | 'observer'; onPress: () => void }`.

**App.tsx wiring contract (Slice 3):** `onOpen` reuses the exact existing gallery `onSelect` handler shape (`(debate, side, hint) => { setEntryHint(hint || null); selectDebate(debate, side); }`, App.tsx:982–985) so J2's `entryHint` prop threads into the room shell via the shipped `activeMessageId` / `entryHintForArgumentId` path (`deepLinkEntryHint.ts` + `deriveGalleryEntryHint`). This is what makes "resume with the awaited node active and the composer scoped to it" true in ≤2 taps (AC3).

**featureFlags guard relaxation (see Risks + Test plan):** consumer is App.tsx (root, outside the scanned trees).

---

## File-by-file change list with anchors

**New files:**

- `src/features/home/homeModel.ts` — pure view-model composer (`buildArgumentHomeViewModel`, `collectFixtureDebateIds`, `collectUnreadDebateIds`). ~120 lines. No React/Supabase/network import.
- `src/features/home/ArgumentHome.tsx` — the landing surface (your-turn strip → ongoing → +Start → floor door → activity → empty state). ~260 lines.
- `src/features/home/ArgumentCard.tsx` — opponent-forward dispute row (`InitialsAvatar` + name + awaited excerpt + `ConversationMiniTimeline` + one verb). ~140 lines.
- `__tests__/homeModel.test.ts` — Slice-1/2 pure-model unit suite.
- `__tests__/argumentHome.test.tsx` — RNTL surface suite (J1 empty state, J2 tap→entryHint, floor toggle, activity module, fixture exclusion, admin path, a11y floors).
- `__tests__/homeV2FlagOff.test.tsx` — flag-off byte-identical proof.

**Modified files:**

- `src/features/debates/conversationGalleryModel.ts` — (a) hoist `LATEST_AUTHOR_LABEL` and refactor lines 984–988 to use it (byte-identical output); (b) add `isWaitingOnViewer`, `deriveYourTurn`, `YOUR_TURN_HINT_RANK`; (c) add `reseed` to `SUFFIX_TAG_PATTERNS` patterns 1+2 (lines 437–442). ~+70 lines. **`ConversationGallerySection` union unchanged.**
- `src/features/debates/botRoomPolicyModel.ts` — add `reseed` to `BOT_SEED_TAG_PATTERNS` patterns 1+2 (lines 321–326), in lockstep with the gallery model. ~+2 edited lines.
- `src/features/arguments/gameCopy.ts` — add frozen `HOME_COPY` block (three verbs, first-run headline, floor-door label, activity-module heading, "See a real one"). All ban-list-safe, apostrophe-free where the file is scanned. ~+25 lines.
- `App.tsx` — Slice 3:
  - add `import { isHomeV2Enabled } from './src/lib/featureFlags';` (root file — the intended single consumer).
  - add `import { ArgumentHome } from './src/features/home/ArgumentHome';`.
  - `const homeV2Enabled = isHomeV2Enabled();` near the other derived flags.
  - widen `galleryLane` state type to `ConversationGallerySection | 'all' | 'home'` and initial value to `homeV2Enabled ? 'home' : 'all'` (line 544).
  - split the landing block (line 935): add a `galleryLane === 'home'` branch that mounts `<ArgumentHome … />` (passing the already-loaded `debates`, `galleryArgs.argumentsByDebateId`, `state.snapshot.userId`, `currentProfile?.role === 'admin'`, `notifications.*`, and the existing `selectDebate` / `setStartArgumentOpen` / `setDemoCorridorOpen` / `handleOpenNotificationDeepLink` handlers); keep the existing gallery block for every non-`'home'` lane, guarded by `galleryLane !== 'home'` so the two never co-render.
  - if a "Home" primary-nav item is added, gate its `setGalleryLane('home')` on `homeV2Enabled`. (Optional this card; the default-initial-value already lands users on home when the flag is on.) ~+30 lines net.
- `__tests__/botRoomPolicyModel.test.ts` — extend the shared lockstep fixture with reseed titles (MATCH) + innocent titles (NOMATCH). ~+10 lines.
- `.env.example` — already carries `EXPO_PUBLIC_HOME_V2` (name only) from ASP-FLAGS-001; **no change** unless a comment is added.

**Deleted files:** none.

---

## Component specs (props / states / testIDs · a11y floor per component)

Shared a11y floor (all components): every `Pressable` ≥ 44×44 logical px (visual or `hitSlop`) via `TOUCH_TARGET` (`src/lib/designTokens.ts:477`); `accessibilityRole` + `accessibilityLabel` + `accessibilityState` on every interactive element; color is never the only signal (a verb `<Text>` label carries the action; the your-turn "gold border" is paired with the verb text and a state word); reduce-motion parity (no auto-animated strip; any emphasis is a **static** ring, not a pulse — mirrors `ProofButton`'s reduce-motion note in the design pass); all text inside `<Text>`. Mobile 390px: reuse `useHeaderBreakpoint` / `resolveBand` (`src/hooks/useHeaderBreakpoint.ts`) — **do not invent new breakpoints**.

### `ArgumentHome`
- Props: see contract above.
- States: `loading` (skeleton/spinner) · `error` (actionable retry via `onRefresh`) · `empty` (first-run, three verbs) · `normal`.
- Layout: single column; the **your-turn strip is a horizontal `ScrollView`** (`horizontal`, `showsHorizontalScrollIndicator={false}`); ongoing cards are full-bleed vertical rows; the floor door is a collapsed `Pressable` row; the activity module is a bounded list (top N notifications).
- testIDs: `argument-home`, `home-your-turn-strip`, `home-ongoing-list`, `home-start-cta`, `home-floor-door`, `home-activity-module`, `home-empty-state`, `home-empty-verb-resume`, `home-empty-verb-start`, `home-empty-verb-floor`, `home-demo-corridor-link`.
- a11y: strip has `accessibilityRole="list"`; floor door `accessibilityRole="button"`, `accessibilityLabel` = "Open the floor — browse public arguments", `accessibilityHint` = "Shows every public room." Reduce-motion: no animated entrance; horizontal scroll inertia is system-controlled (kept).

### `ArgumentCard`
- Props: `{ card, entryHint, viewerId, state, onPress }`.
- States: `your_turn` (static gold ring + verb "Answer") · `waiting` (verb "Continue") · `resting` (verb "Continue", muted) · `observer` (verb "Watch").
- Content order (opponent-forward): `InitialsAvatar` (`src/features/account/InitialsAvatar.tsx`) + starter/opponent name → awaited-move excerpt (`card.latestPostExcerpt`) → `ConversationMiniTimeline` (`src/features/debates/ConversationMiniTimeline.tsx`) → one verb.
- testIDs: `argument-card-<debateId>`, `argument-card-verb-<debateId>`.
- a11y: whole card is one `Pressable` (`accessibilityRole="button"`), verbose `accessibilityLabel` = `"<verb>: <opponent> — <awaited excerpt>, <state word>"` (one shot per element, per accessibility-targets §"Timeline node accessibility"); `accessibilityState={{}}` (no selected). 44px min height; the verb text is the color-independent signal.

### `HOME_COPY` (gameCopy.ts)
- Not a component; the frozen copy source. Fields: `firstRunHeadline`, `verbResume`, `verbStartWithSomeone`, `verbWatchFloor`, `startFirstArgument`, `seeARealOne`, `floorDoorLabel`, `activityHeading`, `yourTurnHeading`, `ongoingHeading`. Ban-list-safe (no verdict/popularity tokens); routed through the existing gameCopy ban-list scan.

---

## Copy plan (all strings through the choke points; ban-list safe)

- All home UI strings live in `HOME_COPY` (frozen, in `gameCopy.ts`). None of them assert truth, winner/loser, popularity, or a person-verdict.
- The your-turn card verb is `deriveGalleryEntryHint(card).verbPhrase` — already plain and ban-list-clean.
- Any internal code that could surface (entry-hint code, bucket) is passed through `toPlainLanguage` (`gameCopy.ts:882`); unknown codes are suppressed, not echoed (doctrine §9).
- The opponent name/avatar is an **address**, never a label — no adjective, no standing. Bot rooms (for admins who see them) reuse the neutral `BOT_MARKER_COPY` labels; no user-verdict labels anywhere.
- Demo-corridor copy reuses `CORRIDOR_COPY`.
- New copy is added to the existing gameCopy ban-list / forbidden-token scan so the guard covers HOME-001 strings.

---

## Edge cases

- **Signed-out / null userId:** `useNotifications(null)` returns empty without a network call; `currentUserId` null → `isWaitingOnViewer` is false for every card (latest author can't equal null-viewer as `'You'`), so the your-turn strip is empty → first-run empty state. No crash.
- **Zero joined rooms (true first run):** `isFirstRun` → three-verb empty state; no bucket taxonomy (AC2).
- **All joined rooms are fixtures (dev/staging), non-admin:** exclusion drops them all → first-run empty state (this is the Q12 failure the card exists to prevent). Admin: they remain visible.
- **Latest move soft-deleted:** `buildConversationGalleryCards` filters `status !== 'deleted'` (line 881–883) before computing `latestAuthorId`, so `latestPostAuthor` reflects the latest **non-deleted** move — AC4's "latest non-deleted move author" is satisfied by the existing build; the deriver inherits it.
- **Latest author is `'Unknown'`** (no attributable author, e.g. a room with only a null-author root): excluded from your-turn (predicate requires `'Other voice'`). Correct — you can't be "waiting on" a null author.
- **Room locked/archived/draft:** `openStatus !== 'open'` → excluded from your-turn (unanswerable); may still appear under ongoing as "resting". `deriveGalleryEntryHint` already returns `watch_first` for non-open (line 1423–1425).
- **Concurrent edits / new move arrives:** the model is a pure projection of the last load; a refresh (`onRefresh` → `refresh()` + `galleryArgs.refresh()`) re-derives. No optimistic write; nothing to conflict.
- **Offline / network failure:** `error` from `debatesError || galleryArgs.error` renders an actionable retry; the strip shows the last good projection or empty. No new failure surface (reuses the gallery's).
- **Permission-denied rooms:** RLS already withholds them from `debates`; the model never sees them (defense-in-depth inactive-room skip at line 876 also applies).
- **Doctrine edge — "does heat rank the your-turn strip?":** No. The sort key is `[hint-verb, unread, recency]` — heat/temperament/amplification are never read for ordering. A hot room and a cold room that both await you rank purely by how actionable the awaited move is, then unread, then recency (doctrine §2/§3).
- **Doctrine edge — "does the card show a standing/score?":** No. `voteScorePreview`/`winnerPreview`/`promotedArgumentCount` are the reserved placeholders on the card and stay unpopulated; ArgumentCard renders none of them.
- **`galleryLane === 'home'` reached with flag off:** unreachable by construction (Decision 4); belt-and-braces, the ArgumentHome branch may additionally guard on `homeV2Enabled` so a stale `'home'` value can never mount it.
- **Reseed false-positive on a legit title containing "reseed":** the pattern is anchored to a trailing bracket `[reseed…]$`; only titles ending in that bracket match. A body/topic mentioning "reseed" mid-title does not.

---

## Test plan

Baseline: **901 suites / 32,917 tests.** All new tests are additive; count goes up (AC8).

**Slice 1 — pure model (`__tests__/homeModel.test.ts` + additions co-located or in a `conversationGalleryModel` sibling):**
- `isWaitingOnViewer`: waiting-on-me (`hasUserJoined` + `'Other voice'` + open + moveCount>0) → true; viewer authored latest (`'You'`) → false; `'Unknown'` → false; observer (`hasUserJoined:false`) → false; locked/archived/draft → false; moveCount 0 → false.
- `deriveYourTurn` ranking determinism: same input array → identical order; hint-verb precedes unread precedes recency; final `debateId` tie-break; snapshot the ordered `debateId[]` for a fixed fixture.
- Fixture exclusion in the deriver/home model: `[xai-adv …]`, `[ai-corpus …]`, `[stress …]`, and **`[reseed-baseline-20260708-1a2b3c4d]`** all excluded for non-admin; **present** for admin (`isAdminViewer:true`).
- `collectFixtureDebateIds` over raw `debate.title` (tests the raw-title path, not the cleaned card title).
- `collectUnreadDebateIds` maps notifications → debateId set.
- `buildArgumentHomeViewModel`: `isFirstRun` true when both lists empty; ongoing = participant cards minus your-turn, fixture-excluded, recency-ranked.
- `LATEST_AUTHOR_LABEL` refactor: assert emitted `latestPostAuthor` strings are unchanged (`'You'`/`'Other voice'`/`'Unknown'`).

**Pattern parity (`__tests__/botRoomPolicyModel.test.ts`, extend existing lockstep fixture):**
- `SUFFIX_TAG_PATTERNS` and `BOT_SEED_TAG_PATTERNS` both MATCH reseed titles and both NOMATCH innocent titles; the existing xai-adv/ai-corpus/stress rows stay green.
- A `node`-harness-equivalent in-test assertion mirroring the manual verification command (so CI re-proves the regex, not just eyeballs).

**Flag-off pin (`__tests__/homeV2FlagOff.test.tsx`):**
- With `EXPO_PUBLIC_HOME_V2` unset: landing renders gallery toolbar + `ConversationGalleryScreen`; no `argument-home`/`home-*` testID; serialized snapshot = pinned baseline.
- With flag on: `argument-home` mounts; gallery-landing block does not co-render.

**Surface (`__tests__/argumentHome.test.tsx`, RNTL):**
- J1 empty state: three verbs (`home-empty-verb-resume/start/floor`) + "Start your first argument" + `home-demo-corridor-link`; **no bucket/lane chip** testIDs present.
- J2 resume: tapping a your-turn card fires `onOpen(debate, side, entryHint)` with a non-null `entryHint` whose `activate`/`entryHintForArgumentId` matches `deriveGalleryEntryHint(card)` — asserting the ≤2-tap resume wiring (AC3).
- Floor toggle: tapping `home-floor-door` fires `onOpenFloor`.
- Activity module renders the existing notification rows and forwards `onOpenNotificationDeepLink`.
- Fixture exclusion at the surface: non-admin viewer sees zero fixture cards; admin viewer sees them (AC5).
- a11y floors: every `Pressable` has role+label+state and meets 44px (visual or hitSlop); grayscale-legibility assertion that the verb text (not color) carries the action; reduce-motion path renders a static ring.

**Source-scan guards:**
- No `process.env[` dynamic read anywhere new (the `featureFlagsStaticEnv.test.ts` src-wide guard already enforces this; new `src/features/home/**` is inside its scan).
- No verdict/popularity token in any new copy — extend the existing gameCopy forbidden-token scan to cover `HOME_COPY`.

**featureFlags consumer-guard relaxation (see Risks):** update `__tests__/featureFlagsStaticEnv.test.ts` "zero consumers this slice" test.

**Expected suite-count delta vs baseline 901 / 32,917:** approximately **+3 to +4 suites** (`homeModel`, `argumentHome`, `homeV2FlagOff`, and possibly a split gallery-deriver file) and **+90 to +130 tests** (pure-model ranking/exclusion matrix ~40, surface RNTL ~35, flag-off ~8, parity fixture ~10, copy/a11y scans ~15). Final numbers confirmed at implementation from a captured `Test Suites: X passed / Tests: Y passed` line with exit 0, then recorded in `docs/core/current-status.md`.

---

## Dependencies (cards / docs / files)

- **Depends on ASP-FLAGS-001 (#873, shipped):** `src/lib/featureFlags.ts` — `isHomeV2Enabled()` and `EXPO_PUBLIC_HOME_V2` must exist before this lands. Verified present (base = ff9890a / #877).
- **Builds on ASP-EXTRACT-001 (#869/#870, shipped):** room shell already split; entry-hint threading (`entryHint` → `activeMessageId` / `entryHintForArgumentId`) stable.
- **Reads existing:** `buildConversationGalleryCards` / `dedupeConversationCards` (`conversationGalleryModel.ts`), `deriveGalleryEntryHint` (`conversationGalleryModel.ts:1414`), `buildDeepLinkEntryHint` (`deepLinkEntryHint.ts`), `looksLikeBotSeedTag` / `isBotSeededRoom` (`botRoomPolicyModel.ts`), `useDebates` / `useGalleryArguments` / `useNotifications` / `useAccountProfile` (App.tsx), `InitialsAvatar`, `ConversationMiniTimeline`, `NotificationRow` / `NotificationListScreen`, `CORRIDOR_COPY`, `TOUCH_TARGET`, `useHeaderBreakpoint` / `resolveBand`.
- **Blocks START-001 (#827):** the start sheet mounts from the home `+ Start` CTA (this card wires the CTA to today's start page; START-001 swaps the target for the sheet). Also blocks P2 room re-weight sequencing per the roadmap.

---

## Risks & mitigations

- **App.tsx blast radius.** App.tsx is the ~1160-line shell. Mitigation: the change is additive and localized — one flag read, one state-type widen, one landing-branch split; the existing gallery block is moved intact into an `else`/guard, not rewritten. The flag-off snapshot + the unchanged `galleryLaneFilter` / `HeaderNavigation` suites are the regression net.
- **featureFlags "zero consumers this slice" guard — brief mislocation.** The card says this guard lives in `__tests__/featureFlags.test.ts`; it actually lives in **`__tests__/featureFlagsStaticEnv.test.ts` lines 90–104** (scans `src/features` + `src/components` for a `featureFlags` import). HOME-001's consumer is **App.tsx (repo root)**, which is **outside** that scanned tree — so the guard stays literally green with zero edits. To keep it *honest* (its name asserts "zero consumers", which is no longer true), **relax it into a positive allowlist**: keep the "no `src/features`/`src/components` file imports featureFlags" assertion (still valid — nothing in the feature tree reads the flag), and add a companion assertion that **App.tsx is the sole allowlisted importer** (`import { isHomeV2Enabled } from './src/lib/featureFlags'`), with an inline `NOTE: HOME-001 (#874) is the first legitimate consumer — the nav seam owns the landing choice`. This satisfies the card's "allowlist the specific consuming module, keep the guard for everything else." Do **not** put the flag read inside `src/features/home/**` — that would trip the guard *and* couple a presentational component to global env state.
- **`latestPostAuthor` is a display string.** Keying the deriver off `'Other voice'` looks fragile; mitigated by hoisting `LATEST_AUTHOR_LABEL` and comparing to the exported constant (single source of truth, byte-identical emitted output, existing tests stay green). Avoids a card-shape change that would break `toEqual` snapshots.
- **Cleaned-vs-raw title for fixture exclusion.** `card.title` is already tag-stripped by `cleanTitleForDedupe`; once `reseed` is added to the pattern, testing `card.title` would return false. Mitigation: exclusion runs on **raw** `debate.title` via `collectFixtureDebateIds(debates)` → `Set<debateId>`. This is called out as a reality-audit sub-finding so the implementer doesn't test the wrong string.
- **Regex boundary subtlety.** The whole reason `[reseed-` slips through is the `\b`-anchored `seed-` alternative; the implementer MUST re-run the verification harness after editing both pattern lists, not eyeball them.
- **Existing tests that may need updating.** If any test does a full-object `toEqual` on a `ConversationGalleryCard`, the `LATEST_AUTHOR_LABEL` refactor is safe (same strings) but the reviewer should confirm no test snapshots the *pattern arrays* verbatim (adding `reseed` changes `SUFFIX_TAG_PATTERNS` / `BOT_SEED_TAG_PATTERNS` source). The lockstep parity fixture is the intended place that changes.
- **Mobile 390px band.** Reuse `useHeaderBreakpoint` / `resolveBand` + `TOUCH_TARGET`; the horizontal your-turn strip must scroll inside its own container so the page body never scrolls horizontally; do not invent breakpoints.
- **KPI (J2 ≤ 2-taps-to-scoped-composer).** The claim rests entirely on the `entryHint` being threaded unchanged into the room shell. Mitigation: `onOpen` reuses the exact gallery `onSelect` handler (App.tsx:982–985) that already delivers `entryHint`; the J2 test asserts the hint object equals `deriveGalleryEntryHint(card)`. If a future room-shell change breaks the `entryHintForArgumentId` fallback, that is a ROOM-* regression, not a HOME-001 one.
- **No new image asset** is introduced (identity glyphs reuse `InitialsAvatar`, verbs are `<Text>`). Therefore the jest-mocks-asset-requires web-bundle gotcha does **not** apply and no `web:build` asset proof is required. If the implementer adds any image, `npm run web:build` proof becomes mandatory.

---

## Out of scope

- `StartArgumentSheet` / `PersonArgumentPicker` / circle audience (START-001 #827, START-002, START-003).
- Circle filter on the home surface (HOME-003 #840).
- Any notification-trigger / schema change; the activity module is read-only reuse.
- Room re-weight, one-bar composer, proof drawer, voice, marks (later ASP phases, other flags).
- Router introduction; new state-flag *screen*.
- New Edge Function, migration, Supabase query, AI call, or DB mutation of fixture rooms.
- Changing `ConversationGalleryScreen` internals or the `ConversationGallerySection` union.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** ArgumentHome surfaces no standing, band, winner/loser, or verdict; the reserved `voteScorePreview`/`winnerPreview` card fields stay unpopulated and unrendered. The surface posts nothing and gates nothing.
- **§2 (heat = activity, not truth):** heat/temperament are never read for your-turn ranking; ordering is `[hint-verb, unread, recency]`, all structural.
- **§3 (popularity is not evidence):** no engagement/view/follower/velocity signal touches ordering or inclusion. Fixture exclusion is tag-based, not popularity-based.
- **§4 / §7 (AI moderator limits; no AI calls from the app):** zero Anthropic/xAI/X calls; the projection is deterministic pure-TS.
- **§5 (rules engine sacred):** untouched — no import of `engine.ts`, no gate change.
- **§6 (secrets):** no key material; `EXPO_PUBLIC_HOME_V2` is a public runtime flag read via the shipped static accessor; grep for `ANTHROPIC_API_KEY|SERVICE_ROLE` in `src/`+`app/` stays zero.
- **§8 (Supabase conventions):** no migration, no RLS change, no service-role; read path is anon-key RLS via the existing gallery load; fixture exclusion is a client projection, never a write.
- **§9 (plain language):** all home copy in `HOME_COPY`; any internal code routed through `toPlainLanguage`; unknown codes suppressed.
- **§10a (Observations vs Allegations):** the opponent name/avatar is an address, not a machine/user label; no classifier ID is surfaced; bot markers (admin-visible) reuse neutral `BOT_MARKER_COPY`.
- **§10 (v1 scope):** no voting/winner, no OAuth, no push, no search, no public API. Resume/ongoing are read projections, not a scoring system.
- **accessibility-targets:** 44px targets, roles/labels/state on every Pressable, color-independent verb text, reduce-motion static ring, 390px band via existing breakpoint helpers — enforced by the surface test.

---

## Operator steps (if any)

**None to ship the code.** Pure client-side code change: no migration (`db push` not needed), no Edge deploy, no secret.

**To turn the feature ON after merge (operator, when ready):** the flag ships **OFF** (byte-identical to today). Flipping it on is a Netlify env + rebuild step for the dev/prod web bundle, following the shipped ASP-FLAGS-001 / #776 static-inlining pattern:

- set `EXPO_PUBLIC_HOME_V2=true` in the Netlify site env (e.g. `NETLIFY_SITE_ID=<id> netlify env:set EXPO_PUBLIC_HOME_V2 true`) and trigger a rebuild/publish so babel-preset-expo inlines the static `process.env.EXPO_PUBLIC_HOME_V2` read into the bundle; then verify the deployed bundle serves the home landing. Rollback = unset the env + rebuild (or revert the PR). No down-migration is ever required.
