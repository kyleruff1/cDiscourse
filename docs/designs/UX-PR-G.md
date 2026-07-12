# UX-PR-G — fixtures + IA: registry-driven fixture exclusion + participant count + open-counts + Share removal + in-room badge + nav

**Status:** Design draft
**Epic:** IA / fixtures / de-misleading (UX continuity audit 2026-07 · UX_ACTION_PLAN PR-G)
**Release:** Post-ASP UX-continuity remediation
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/920

---

## Goal (one paragraph)

The 2026-07 authed runtime walk surfaced six surfaces that actively **mislead live users today**: fixture/test rooms leaking into discovery with three inconsistent treatments plus one totally-unfiltered picker (P1-9), a gallery participant count that always reads `0` (P1-10), two different "open" counts on one screen with no explanation (P1-11), a side-rail Share button that is a guaranteed no-op (P1-12), an unread-notification badge that disappears exactly where users spend the most time (P1-13), and a "My Arguments" nav item that lands on a Browse-clone with no way back to the resume-first Home surface, under a hedge line that fires even for openable rooms (P2-R4). PR-G removes the misleads. The shaping doctrine is `cdiscourse-doctrine` §9 (plain language — internal codes / raw fixture tags never reach a user surface), §1-§3 (counts are activity/structure, never verdicts), and §10a (a bot/test marker describes an *account/room type*, never a person). Nothing here changes room/seat/submission semantics, adds a query/migration/Edge/flag, or calls any AI provider — it is display / filter / copy / nav only. **This design recommends splitting P2-R4 (nav IA + hedge conditioning) into its own card** (see §Scope recommendation) so the remaining five items ship under one clean de-misleading review lens.

---

## Data model

**No new data model. No migration. No new query. No new dependency.** Every fix reads data the app already loads.

Two small **pure-TS additions** (no persisted shape change):

1. A shared fixture-tag registry module (`stripFixtureTag`, `shouldHideFixtureForViewer`, `collectFixtureDebateIds`) consolidating the three drifted regex mirrors into one source (§API contracts).
2. A derived `participantCount` in the gallery card model — `distinctAuthorCount` computed from the already-fetched argument rows (§P1-10).

---

## The shipped registry (verified) — what we reuse

`src/features/debates/botRoomPolicyModel.ts` is the source of truth:

- `looksLikeBotSeedTag(title): boolean` (`:335`) — the shipped predicate, already imported by `homeModel.collectFixtureDebateIds`.
- `BOT_SEED_TAG_PATTERNS` (`:328-333`) — the canonical 4-regex family; **includes the `reseed` alternative** (added HOME-001 #874).

`src/features/home/homeModel.ts` is the D8 exclusion precedent to mirror exactly:

- `collectFixtureDebateIds(debates: Debate[]): Set<string>` (`:59-65`) — builds the fixture id-set from the **raw** `debate.title` (never `card.title`, which is already stripped).
- `buildArgumentHomeViewModel` (`:97-124`) gates on `isAdminViewer`: admins keep fixtures; non-admins get the filtered set. `deriveYourTurn` / the `ongoing` filter both use `if (!isAdmin && fixtureDebateIds.has(id)) continue;`.

`BotRoomMarker.tsx` + `buildBotMarkingViewModel` are the admin-visible "test room" marker (dashed border, `◇` glyph, `BOT_MARKER_COPY`; renders nothing when `roomMarkerLabel === ''`).

### Regex-mirror family census (the consolidation target)

| # | File | Symbol | `reseed`? | Disposition |
|---|---|---|---|---|
| 1 | `src/features/debates/botRoomPolicyModel.ts:328-333` | `BOT_SEED_TAG_PATTERNS` | ✅ yes | **Registry / source of truth** — keep (or move into the new registry module and re-export). |
| 2 | `src/features/debates/conversationGalleryModel.ts:457-462` | `SUFFIX_TAG_PATTERNS` (feeds `cleanTitleForDedupe`) | ✅ yes | **Delete local copy** → `cleanTitleForDedupe` delegates to shared `stripFixtureTag`. |
| 3 | `src/features/arguments/argumentArtifactModel.ts:134-139` | `SUFFIX_TAG_PATTERNS` (feeds `cleanArtifactTitleForDedupe`) | ❌ **NO — drifted** | **Delete local copy** → `cleanArtifactTitleForDedupe` delegates to shared `stripFixtureTag`. Consolidation *fixes the reseed drift by construction*. |

**Not consolidated (different concern — leave as-is):** `src/features/admin/adminArgumentsRunTagModel.ts`, `src/features/admin/adminArgumentsRoomGroupingModel.ts`, `src/features/adminClassifierHealth/runTagSource.ts` — these *parse* run tags to **surface** them on admin-only tables (admins are supposed to see the tag). They are not user-facing exclusion and must not be routed through the strip. The design leaves them untouched; the parity test (§Test plan) scopes to files 1-3 only.

---

## File changes

### New file

- **`src/features/debates/fixtureTagRegistry.ts`** (~55 lines) — the ONE zero-dependency fixture-tag registry.
  - Recommended over adding to `botRoomPolicyModel.ts` because a new **import-free** module cannot participate in a require cycle. This repo has been bitten twice by web-bundle TDZ cycles when a widely-imported model gained a cross-feature import (`railActionCategories.ts` was extracted for exactly this reason; see its header). `conversationGalleryModel.ts` is imported very broadly, so its new dependency must be cycle-proof.
  - Contents: `FIXTURE_SUFFIX_TAG_PATTERNS` (the canonical patterns, moved from `botRoomPolicyModel`), `looksLikeBotSeedTag`, `stripFixtureTag`, `shouldHideFixtureForViewer`, `collectFixtureDebateIds`. No imports except the `Debate` type (type-only, erased at build).
  - `botRoomPolicyModel.ts` then **re-exports** `looksLikeBotSeedTag` (and aliases `BOT_SEED_TAG_PATTERNS = FIXTURE_SUFFIX_TAG_PATTERNS`) so every existing importer (`homeModel`, tests) is byte-source-compatible.
  - *Alternative if the reviewer prefers no new file:* put `stripFixtureTag` + `collectFixtureDebateIds` directly in `botRoomPolicyModel.ts`. This is acceptable (verified: `botRoomPolicyModel` imports only `roomContractModel` + `gameCopy`; neither imports `conversationGalleryModel`, so no cycle today) but is more fragile than the zero-dep module. **Recommend the new module.** Prove either choice with `npm run web:build` (the web bundler is the cycle oracle; Jest/Hermes tolerate cycles).

### Modified files

- **`src/features/debates/conversationGalleryModel.ts`** (~15 lines net)
  - `cleanTitleForDedupe` → delegate to `stripFixtureTag`; delete local `SUFFIX_TAG_PATTERNS` (import the shared patterns/helper). Emitted strip output must stay byte-identical for the existing corpus (parity test).
  - `deriveMessageStats` (or the card builder): add a `distinctAuthorCount` (count of distinct non-null `authorId` among the already-filtered, non-deleted `messages`). Set `card.participantCount` from it (P1-10). **Leave the `computeConversationHeat({ participantCount: ... })` input at `participantCountByDebateId[debate.id] || 0` verbatim** so heat / bucket / lane stay byte-identical (see §P1-10 for the decoupling rationale).
- **`src/features/arguments/argumentArtifactModel.ts`** (~8 lines) — `cleanArtifactTitleForDedupe` delegates to `stripFixtureTag`; delete local `SUFFIX_TAG_PATTERNS`. Fixes the `reseed` drift.
- **`src/features/home/homeModel.ts`** (~2 lines) — re-import `collectFixtureDebateIds` from the registry (single source) instead of defining it locally; keep the export name so `App.tsx`/`ArgumentHome` are unaffected. (Optional but recommended to complete the consolidation.)
- **`src/features/debates/ConversationGalleryScreen.tsx`** (~15 lines) — new prop `isAdminViewer?: boolean`; filter `allCards` (before dedupe) to exclude cards whose `debateId ∈ collectFixtureDebateIds(debates)` when `!isAdminViewer`. `card.title` is already tag-stripped by `cleanTitleForDedupe`, so no raw tag reaches the card title (P1-9a). Admin path is byte-identical to today (fixtures still shown, still marked by the existing `BotRoomMarker` block at `:645`).
- **`src/features/debates/DebateDetailHeader.tsx`** (~20 lines) — (i) render the in-room title as `stripFixtureTag(debate.title)` instead of raw `debate.title` (`:352`) so `Chime cohort smoke [stress chime-mrgpodh6]` renders as `Chime cohort smoke` (P1-9b); (ii) new optional props `unreadCount?: number` + `onOpenNotifications?: () => void` and a small in-strip notification affordance reusing `NotificationBadge` (P1-13). **Pinned file** (uxOneOneSix boundary) — edits are additive; preserves `requiredApi` tokens.
- **`src/features/arguments/ArgumentSideActionRail.tsx`** (~3 lines) — delete the `share` entry from `OBSERVER_ACTIONS` (`:96-100`) (P1-12). `RailActionCode` union keeps `'share'` for back-compat; `railActionToBubbleControl` keeps its default→`null`.
- **`src/features/arguments/room/ArgumentRoom.tsx`** (~4 lines) — delete the dead `if (code === 'share') { onShareRoom?.(); return; }` branch (`:2464`), the `onShareRoom` prop (`:439`, `:654`), and the `onShareRoom` dep (`:2467`) — zero suppliers confirmed (P1-12). **Pinned file** — additive-safe (removing a never-supplied prop preserves the pinned public API; confirm the boundary `requiredApi` list does not name `onShareRoom`, which it does not).
- **`src/features/arguments/crossRoom/linkTargetPickerModel.ts`** (~12 lines) — `buildLinkTargetPickerModel` gains `isAdminViewer?: boolean`; strips each candidate `title` via `stripFixtureTag` (always) and drops candidates where `looksLikeBotSeedTag(rawTitle)` when `!isAdminViewer` (P1-9d).
- **`src/features/arguments/gameCopy.ts`** (~4 lines) — P1-11 copy edits (`STATE_RAIL_COPY.open_points_a11y_suffix`; a new `DISAGREEMENT_POINTS_RAIL_COPY.scopeNote`); P1-10 `Stat` relabel string if "Voices" is chosen. All ban-list-clean.
- **`src/features/mediator/DisagreementPointsRail.tsx`** (~5 lines) — render the new `scopeNote` sub-line under the expanded header (P1-11).
- **`App.tsx`** (~12 lines) — (a) pass `isAdminViewer={currentProfile?.role === 'admin'}` to `ConversationGalleryScreen` (`:1337`); (b) pass `unreadCount` + `onOpenNotifications={() => setNotificationsOpen(true)}` to `DebateDetailHeader` (`:1403`); (c) route the circles-picker mapping (`:1240`) and the home circle-chip mapping (`:1290`) through the new pure `projectCirclesForPicker` helper (P1-9c). **Pinned file** — additive.
- **`src/features/circles/circleHomeFilter.ts`** *(or a new `src/features/circles/circlePickerProjection.ts`)* (~15 lines) — pure `projectCirclesForPicker(circles, { isAdminViewer })`: strip `[stress …]` from each circle `name`/`label` (always) and drop fixture-named circles when `!isAdminViewer` (P1-9c).

### Deleted files

None.

---

## API / interface contracts

### Shared fixture-tag registry (`fixtureTagRegistry.ts`)

```ts
/** The ONE canonical fixture-tag pattern family (moved from botRoomPolicyModel). */
export const FIXTURE_SUFFIX_TAG_PATTERNS: ReadonlyArray<RegExp>;

/** Predicate: does this RAW title carry a corpus/bot/reseed fixture tag? */
export function looksLikeBotSeedTag(title: string | null | undefined): boolean;

/**
 * Display-strip: remove the trailing fixture tag(s) for user display.
 * `"Chime cohort smoke [stress chime-mrgpodh6]"` -> `"Chime cohort smoke"`.
 * Returns the trimmed original when no tag matches. Never returns ''
 * unless the whole title was a bare tag (callers fall back accordingly).
 * This is the exact loop `cleanTitleForDedupe` / `cleanArtifactTitleForDedupe`
 * already run — hoisted so all three share one implementation.
 */
export function stripFixtureTag(title: string | null | undefined): string;

/** Convenience: hide for a non-admin viewer only. */
export function shouldHideFixtureForViewer(
  input: { title: string | null | undefined; isAdminViewer: boolean },
): boolean; // !isAdminViewer && looksLikeBotSeedTag(title)

/** Set of debateIds whose RAW title is a fixture tag (mirrors homeModel). */
export function collectFixtureDebateIds(debates: Pick<Debate, 'id' | 'title'>[]): Set<string>;
```

### Gallery screen

```ts
// ConversationGalleryScreen Props (added)
isAdminViewer?: boolean; // default false -> non-admin exclusion applies
```

### Weave picker

```ts
export function buildLinkTargetPickerModel(
  candidates: ReadonlyArray<LinkTargetCandidate>,
  currentCircleId: string | null,
  currentDebateId?: string,
  options?: { isAdminViewer?: boolean }, // NEW — default false
): LinkTargetPickerModel;
// titles in the returned model are stripped; fixture candidates excluded for non-admins.
```

### DebateDetailHeader

```ts
// Props (added)
unreadCount?: number;              // unread notifications for the viewer
onOpenNotifications?: () => void;  // opens the notifications sub-screen (setNotificationsOpen(true))
// Title now renders stripFixtureTag(debate.title).
```

### Circles projection

```ts
export interface PickerCircle { id: string; label: string; memberCount: number }
export function projectCirclesForPicker(
  circles: ReadonlyArray<{ id: string; name: string; memberCount: number }>,
  options: { isAdminViewer: boolean },
): PickerCircle[]; // label = stripFixtureTag(name); fixture-named circles dropped for non-admins
```

No RLS, Edge, or SQL contracts change.

---

## Per-item fix specs

### P1-9 — Fixture leakage (the load-bearing item)

**One registry-driven exclusion + one display-strip rule, applied to 4 surfaces. Non-admins get fixtures EXCLUDED; admins see them (tagged via the existing `BotRoomMarker`). No raw `[stress …]` / `[xai-adv …]` / `[reseed-…]` / `[ai-corpus …]` tag ever renders verbatim on any user surface.**

| Surface | File(s) | Exclusion (non-admin) | Display-strip (always) | `isAdminViewer` available? |
|---|---|---|---|---|
| (a) Gallery | `ConversationGalleryScreen` + `conversationGalleryModel` | Filter `allCards` by `collectFixtureDebateIds(debates)` | `card.title` already stripped by `cleanTitleForDedupe` | **1 hop** — thread new prop from `App.tsx:1337` (`currentProfile?.role === 'admin'`). Easy. |
| (b) Room title | `DebateDetailHeader` | (room already open; discovery-excluded upstream) | `stripFixtureTag(debate.title)` at `:352` | **Not needed for the strip** (strip is unconditional). Optional admin marker would need 1 hop. |
| (c) Circles picker | `App.tsx:1240` mapping + `projectCirclesForPicker` (+ home chips `:1290`) | Drop circles where `looksLikeBotSeedTag(name)` | `label = stripFixtureTag(name)` | **0 hops** — mapping is in the App shell where the admin flag lives. Easy. |
| (d) Weave picker | `linkTargetPickerModel.buildLinkTargetPickerModel` | Drop candidates where `looksLikeBotSeedTag(rawTitle)` | `title = stripFixtureTag(title)` | **Deepest thread** — see reconciliation note below. |

**Viewer-admin threading trace (verified).** The single admin signal is `currentProfile?.role === 'admin'`, where `currentProfile` comes from `useAccountProfile(state.snapshot.userId)` (`App.tsx:742`); it is already used at `App.tsx:1270` (`ArgumentHome`) and `:1714` (Admin tab). Availability per surface: (a) trivial new prop; (b) not needed (strip unconditional); (c) already in-shell at the `:1240` map site; (d) the weave picker is rendered deep inside the room (`App.tsx` → `ArgumentTreeScreen` → `ArgumentRoom` → the `useLinkedPriorRooms` hook → `buildLinkTargetPickerModel`), so threading `isAdminViewer` there is a **3-hop prop thread**.

> **Reconciliation point (weave admin gating) — orchestrator ruling requested.** Two options for surface (d):
> - **(d-i) Thread `isAdminViewer` 3 hops** (App→ArgumentTreeScreen→ArgumentRoom→picker) so admins still see fixture rooms as weave targets. Fully consistent with "admins see fixtures." Cost: 3 additive prop threads through pinned `ArgumentRoom.tsx`.
> - **(d-ii) Exclude fixtures for everyone (incl. admins) in the weave picker only**, and always strip titles. Rationale: the weave picker is an *action* surface ("link a prior room"), not a *discovery* surface — admins do not lose QA visibility (fixtures still appear in the admin gallery). Zero thread; `isAdminViewer` defaults `false`.
> **Recommendation: (d-ii)** for a smaller, cleaner diff; it does not weaken admin QA. If the operator wants strict "admins see fixtures everywhere," fall back to (d-i). Either way the **strip is unconditional**.

**Cap caveat (weave, low risk):** the query fetches `MAX+1` locked rooms; post-query fixture filtering can let fixtures consume slots so fewer than `MAX` real rooms show and `moreNotShown` may under-count. Acceptable for a display filter (the issue forbids a query change). Note in the PR.

**Consolidation:** delete the two drifted mirror copies (files 2 & 3 above); all three former call sites (`looksLikeBotSeedTag`, `cleanTitleForDedupe`, `cleanArtifactTitleForDedupe`) resolve to the one registry. The parity test proves the family is unified.

---

### P1-10 — Gallery participant count

**Root cause (verified): the field is NEVER WIRED, not miscounted.** `buildConversationGalleryCards` sets `participantCount: participantCountByDebateId[debate.id] || 0` (`conversationGalleryModel.ts:1057`), and **`App.tsx` mounts `ConversationGalleryScreen` (`:1337-1383`) without passing `participantCountByDebateId` at all** — so the map is always `{}` and every card reads `0`. The room header's "3 of 5 active seats" is a *seat* count (from the room contract, includes joined-but-not-posted), a different metric.

**Fix (make it real — no query): derive distinct-poster count.** The gallery loader (`useGalleryArguments`) already fetches every argument row with `authorId`. Add `distinctAuthorCount` = count of distinct non-null `authorId` among the debate's already-filtered non-deleted `messages`, and set `card.participantCount` from it. For "a room that visibly has two posters," this renders **2** (matching what the user sees), not 0.

**Decoupling (doctrine boundary):** `card.participantCount` (display) and the heat term are already read from *different* places — heat reads `participantCountByDebateId[debate.id] || 0` **directly** (`:987`), not `card.participantCount`. **Keep the heat input line verbatim** so heat/bucket/lane are byte-identical (no lane reshuffle, existing snapshots green). Only the display field becomes real. Keep the `participantCountByDebateId` prop as an override (`typeof supplied === 'number' ? supplied : distinctAuthorCount`) for any future caller.

**Copy (orchestrator confirm):** distinct posters ≠ seats, so relabel the card `Stat` from **"Participants"** → **"Voices"** (the codebase already uses "voice"/"Other voice" for a poster). This avoids re-creating the P1-11 problem (two different numbers labelled the same). *Fallback if the reviewer rejects the derivation:* **drop the `Stat` entirely** — a missing count beats a wrong one. **Recommend derive + "Voices".**

---

### P1-11 — Competing open-counts on one screen

**Finding (verified): they are genuinely different concepts *because of a live flag*, not a bug.**
- State rail `open_points` chip renders `${n} open points` (`argumentStateRailModel.ts:162-166`). Its `openPointCount` (`ArgumentRoom.tsx:1260-1267`) = `mediatorBoard.points.filter(p => p.state !== 'resolved_or_settled').length` **plus** `moveMarkAggregate.unaddressedMoveIds.length` when the `move_marks` flag is on (FEEDBACK-001).
- Mediator `DisagreementPointsRail` renders `Disagreement points · ${count}` (`:391`, `:418`) where `count = livePoints.length` = `board.points.filter(p => p.state !== 'resolved_or_settled')` — the structured points **only**.

So `move_marks` (live in prod per current status) makes the state-rail count a **superset**: `structured disagreement points + unanswered "did-not-address" chains`. Example "7 vs 4" = 4 structured points + 3 unaddressed chains. Neither is wrong; they measure different things and nothing explains it.

**Fix: explicit labels (copy first; no concept unification).** Two additive edits, both ban-list-clean:

1. `STATE_RAIL_COPY.open_points_a11y_suffix`: `'on this argument.'` → **`'across this whole argument.'`** (screen-reader scope; the compact visible chip stays `"N open points"`).
2. Add `DISAGREEMENT_POINTS_RAIL_COPY.scopeNote`: **`'The disagreement points the mediator is actively tracking.'`** rendered as a one-line subtitle under the mediator rail's expanded header. It self-explains the mediator count as the structured/curated subset — no cross-reference to the other surface, so it stands alone.

*(Alternative literal wording from the issue — `"N open points across the tree"` / `"N mediator issues"` — is rejected: "tree" and "mediator issues" are dev jargon; the plain scope-note above is doctrine-cleaner.)* **Flag exact strings as an orchestrator copy-confirm.** Concept unification (a single derived count) is explicitly a follow-on, not PR-G.

---

### P1-12 — Side-rail "Share" is a production no-op

**Verified:** `onShareRoom` has **zero suppliers** — `git grep onShareRoom` returns only its own declaration (`ArgumentRoom.tsx:439`), destructure (`:654`), the routing branch (`:2464 if (code === 'share') { onShareRoom?.(); return; }`), and the dep array (`:2467`). No caller of `ArgumentRoom` passes it. Share is in `OBSERVER_ACTIONS` (`ArgumentSideActionRail.tsx:100`), so **every observer sees a dead button**. Rooms have no URLs (no router — the TL-003/COMPOSER-002 no-route invariant), so it is also unfixable as specced.

**Fix:**
1. Delete the `share` entry from `OBSERVER_ACTIONS`. `RailActionCode` keeps `'share'` (back-compat with `railActionToBubbleControl`'s `default → null`); the `'share'` category stays in `RAIL_ACTION_CATEGORIES` (`groupRailActionsByCategory` skips empty groups). Leave `OBSERVER_COPY.shareHelp` (frozen copy constant; harmless).
2. Delete the dead `share` branch + the `onShareRoom` prop/dep in `ArgumentRoom.tsx`.
3. Leave `watch` (`ArgumentRoom.tsx:2463`, a documented no-op) untouched.

**Guard test (new):** export a frozen `RAIL_LOCALLY_ROUTED_CODES = ['join_aff','join_neg','open_timeline','watch']` from the room (or a small model) and assert: for every `code` returned by `getRailActions(role, actor)` across all `(role, actor)` combinations, either `railActionToBubbleControl(code) !== null` **or** `code ∈ RAIL_LOCALLY_ROUTED_CODES` — i.e. **no rendered rail code ships without a handler**. After removal, `'share'` never appears in `getRailActions`, so the guard passes; a future codeless entry fails it.

---

### P1-13 — Notification badge invisible in-room

**Verified:** `NotificationBadge` renders inside the `{!roomActive ? (<tab bar>…)}` block (`App.tsx:1164, 1182-1186`); the whole tab bar is hidden while a room is active, so the badge vanishes exactly where users linger. `notifications` comes from `useNotifications` (`notifications.unreadCount`); an out-of-room toolbar affordance at `App.tsx:1309-1318` already opens the list via `setNotificationsOpen(true)`.

**Fix (recommend: surface it in `DebateDetailHeader`).** The compact in-room strip is the right home — it is always mounted in-room and already carries the room chrome. Add a small notification affordance to the strip's right cluster (before the overflow `⋯`), rendered only when `onOpenNotifications` is supplied:

```tsx
{onOpenNotifications ? (
  <Pressable
    onPress={onOpenNotifications}
    accessibilityRole="button"
    accessibilityLabel={`Notifications${unreadCount ? `, ${unreadCount > 9 ? '9+' : unreadCount} unread` : ''}`}
    accessibilityState={{ disabled: false }}
    hitSlop={{ top: sizing.controlHitSlop + 6, bottom: ..., left: ..., right: ... }} // 44×44 effective
    testID="debate-detail-notifications"
  >
    <Text>🔔{/* or a glyph consistent with the tab-bar cue */}</Text>
    <NotificationBadge unreadCount={unreadCount ?? 0} testID="notification-badge-in-room" />
  </Pressable>
) : null}
```

Wire in `App.tsx:1403`: `unreadCount={notifications.unreadCount}` + `onOpenNotifications={() => setNotificationsOpen(true)}`. Opening the list hides the room (the room mount is guarded by `!notificationsOpen`, `App.tsx:1395`) — identical to the existing toolbar affordance, so no new navigation model.

**Accessibility (accessibility-targets):** the glyph is not color-only (the badge count carries meaning + the a11y label states the count); the badge itself is `accessibilityRole="text"` and lives inside a `button`-role Pressable with a 44×44 hit target via `hitSlop`; the label reads naturally without the count when zero. `NotificationBadge` renders nothing at 0 (existing behavior).

---

### P2-R4 — IA nav + hedge copy (RECOMMEND SPLIT — see §Scope recommendation)

**Findings (verified):**
- `resolvePrimaryNavTransition` (`appPrimaryNavModel.ts:161-211`) maps `my_arguments → { galleryLane: 'my_rooms' }` — the gallery my-rooms lane, identical chrome to Browse. **No primary nav item targets `galleryLane: 'home'`** (`ArgumentHome` / "Your table"). `'home'` is only the initial `useState` value (`App.tsx:675`) when `home_v2` is on, so once a user taps Browse or My Arguments there is no affordance back to the resume-first Home surface.
- The hedge line `ROOM_ACCESS_COPY.unavailable_body` — `"This link may not work, or the argument may be limited to its members."` (`gameCopy.ts:1899`) — is used in two paths: the `RoomUnavailableNotice` deep-link modal (`App.tsx:1724`, gated by `roomUnavailableOpen`) **and** as the `accessLine` for the `private_no_access` state in `roomAccessModel.deriveRoomAccessView` (`:172`). The runtime complaint ("renders even for openable rooms") requires a focused root-cause of *which* render path fires for a room the viewer can open — itself an investigation.

**Chosen fix if it rides (see split rec.): give Home a persistent nav affordance.** Preferred option = **re-point `my_arguments` at `home_v2`** (return `galleryLane: 'home'` when `homeV2Enabled`, else `'my_rooms'`), so "My Arguments" lands on the resume-first "Your table" instead of a Browse-clone — plus condition the hedge on actual openability (only emit `unavailable_body` when the room id is genuinely absent from the RLS-filtered set, never on a card the viewer can open). The alternative (add a 5th "Home" nav item) is **not recommended** — it grows `PRIMARY_NAV_ORDER` and the masthead is already 390px-overflow-sensitive (see the mobile-overflow known issue).

---

## Edge cases

- **Title that legitimately contains a bracket** (e.g. `"[2024] budget debate"`) — must NOT be treated as a fixture. `FIXTURE_SUFFIX_TAG_PATTERNS` is anchored to the real tag shapes (`\[(?:xai-adv|ai-corpus|stress|reseed|…)\b…\]\s*$`), keyed to specific run-tag keywords + end-anchor. Add an explicit negative test (`"[2024] budget debate"`, `"Re: [urgent] housing"`) to prove no false-positive exclusion.
- **Fixture room the viewer actually joined** — a non-admin who is a participant in a fixture room: exclusion is a *discovery* filter. For the gallery, exclude it from discovery lanes as designed; the raw tag is still stripped everywhere. (Edge case is rare — fixtures are bot-seeded; a real user rarely joins one. Note in PR.)
- **Empty title / title that is only a bare tag** — `stripFixtureTag` can return `''`; the gallery card already falls back via `fallbackTitle`; the room title should fall back to the raw title when the strip empties it (guard: `stripFixtureTag(t) || t`).
- **`participantCount` with a single self-posted root** — distinct authors = 1 → renders "1 Voice"; ensure singular/plural if the label is pluralized (recommend a static "Voices" label to avoid a pluralization branch, or handle 1).
- **`participantCount` with only null authorIds** (system/anonymous) — distinct non-null count = 0 → renders "0 Voices"; acceptable (honest — nobody attributable posted). Verify the derivation ignores `null`.
- **Open-counts when `move_marks` is OFF** — the state-rail count then equals the mediator count exactly; the scope labels are still correct (they just happen to match). No special-casing.
- **Share removal + a participant on another bubble** — `PARTICIPANT_OTHER_ACTIONS` never had `share`; only `OBSERVER_ACTIONS` did. Confirm no observer-set snapshot elsewhere depends on `share`.
- **In-room badge when signed-out / no notifications hook** — `onOpenNotifications` omitted → affordance renders nothing (byte-identical). `unreadCount` 0 → badge renders nothing.
- **Weave picker with all candidates filtered out** — `buildLinkTargetPickerModel` must still return `isEmpty: true` cleanly (existing empty-copy path), not crash.
- **Circle whose name is exactly a tag** — `stripFixtureTag(name)` → `''`; if `!isAdminViewer` it is dropped anyway; for admin, fall back to a neutral placeholder rather than an empty label.

---

## Test plan

Pure-model tests (no React) unless noted. New/updated files:

- **`__tests__/fixtureTagRegistry.test.ts`** (new) — `looksLikeBotSeedTag` / `stripFixtureTag` happy + failure paths; the **reseed** family (`[reseed-baseline-20260708-1a2b3c4d]`) recognized + stripped; the bracket false-positive negatives (`"[2024] budget debate"`); `shouldHideFixtureForViewer` admin/non-admin; `collectFixtureDebateIds`.
- **`__tests__/fixtureTagRegistryMirrorParity.test.ts`** (new) — the **array-diff parity** test: over a shared fixture corpus (incl. `stress` / `xai-adv` / `ai-corpus` / `reseed` / bare-bracket), assert `looksLikeBotSeedTag`, `cleanTitleForDedupe`, and `cleanArtifactTitleForDedupe` produce **identical** strip/predicate results — proving the three former mirrors are consolidated and the reseed drift is gone (this test would have FAILED on `argumentArtifactModel` before the fix).
- **`__tests__/botRoomPolicyModel.test.ts`** (update) — keep the existing parity fixture green after the registry move / re-export.
- **`__tests__/conversationGalleryParticipantCount.test.ts`** (new) — seed a debate with 2 distinct `authorId`s across 3 messages → `card.participantCount === 2`; single author → 1; null authors ignored; **assert heat/bucket are byte-identical** to a baseline with the empty `participantCountByDebateId` (proves the heat input stayed decoupled).
- **`__tests__/conversationGalleryFixtureExclusion.test.ts`** (new) — mirror the `homeModel` filter test: non-admin excludes fixture debateIds, admin keeps them; `card.title` never contains a raw tag.
- **`__tests__/linkTargetPickerModel.test.ts`** (update) — fixture candidates dropped (non-admin) / kept (admin per the chosen option); titles stripped in both; `moreNotShown`/`isEmpty` still correct; all-filtered → `isEmpty`.
- **`__tests__/circlePickerProjection.test.ts`** (new) — `projectCirclesForPicker` strips labels always; drops fixture-named circles for non-admins; keeps for admins.
- **`__tests__/stateRailMediatorOpenCounts.test.ts`** (new/copy-pin) — pin the two exact strings: state-rail a11y suffix `'across this whole argument.'`; mediator `scopeNote`; assert both are ban-list-clean and the visible state-rail chip stays `"N open points"`.
- **`__tests__/railHandlerPresenceGuard.test.ts`** (new) — the P1-12 guard: every `getRailActions` code has a handler (`railActionToBubbleControl !== null` OR ∈ `RAIL_LOCALLY_ROUTED_CODES`); assert `'share'` no longer appears in any `getRailActions` set.
- **`__tests__/railActionGrouping.test.ts`, `sideActionDockMatrix.test.ts`, `duplicateRailRemovalDisposition.test.ts`, `sideActionDockCategoryGrouping.test.ts`, `sideActionDockNoVerdictCopy.test.ts`, `seamlessConversationEntry.test.ts`** (update) — the tests that assert `share` in the observer set move to assert its **absence** (the intended contract change).
- **`__tests__/DebateDetailHeader.*.test.tsx`** (update + new) — title renders stripped (fixture room → clean title, no `[stress …]`); a **badge-visible-in-room** assertion: with `unreadCount>0` + `onOpenNotifications`, the `notification-badge-in-room` testID is present and the affordance has role `button` + a 44×44 target + a count-bearing a11y label; omitting `onOpenNotifications` renders nothing.
- **Doctrine ban-list** — the existing `copySystemBanList.test.ts` scans the new strings automatically; add the new `gameCopy` keys to any explicit copy coverage test.
- **P2-R4 (only if it rides)** — `appPrimaryNavModel` test: `my_arguments` routes to `home` when `homeV2Enabled` else `my_rooms`; `deriveActivePrimaryNavSection` marks `my_arguments` active for the home lane; hedge-copy conditioned on `resolveRoomDeepLinkAccess.outcome === 'unavailable'` only.

**Pinned boundaries (soft — additive, keep green):** `uxOneOneSixReadOnlyBoundary.test.ts` pins `DebateDetailHeader.tsx`, `App.tsx`, `ArgumentRoom.tsx` by **required-API token** (not byte-equality — that is a reviewer `git diff --stat` step, per the file header). Edits are additive and preserve the pinned tokens, so the suite stays green; update each pinned file's boundary NOTE/label so the reviewer sees the diff is intentional. `conversationGalleryModel`, `ConversationGalleryScreen`, `ArgumentSideActionRail`, and `argumentArtifactModel` are **not** pinned by either boundary test.

**Perf-budget note (LIFE-001 / META-001):** the added `distinctAuthorCount` is O(n) over rows already iterated — no perf regression. If the wall-clock `pointLifecycleModel` (LIFE-001, 30ms) / `moveMetadataLedger` (META-001, 60ms) budget tests flake under full-suite parallel load, re-run them **isolated** before blaming this branch (they flake under load and are unrelated to this diff).

**Gate discipline:** run `npm run typecheck`, `npm run lint`, `npm run test` to captured exit 0 (with `; echo "EXIT: $?"`), and **`npm run web:build`** (mandatory — the web bundler is the require-cycle oracle for the new registry import into the broadly-imported `conversationGalleryModel`).

---

## Dependencies (cards / docs / files)

- Assumes HOME-001 (#874) is complete — reuses `homeModel.collectFixtureDebateIds` + the `looksLikeBotSeedTag` registry + the D8 `isAdminViewer` exclusion pattern.
- Assumes FEEDBACK-001 (#898) is complete — the state-rail superset (`moveMarkAggregate.unaddressedMoveIds`) is the root of the P1-11 mismatch.
- Reads `ConversationGalleryScreen` (`buildConversationGalleryCards`), `ArgumentSideActionRail` (`OBSERVER_ACTIONS` / `railActionToBubbleControl`), `ArgumentRoom.handleRailAction`, `DebateDetailHeader`, `appPrimaryNavModel`, `roomAccessModel`, `linkTargetPickerModel`, `circlesApi`/`circleHomeFilter`, `NotificationBadge`/`useNotifications` — all verified above at the cited line numbers.
- Blocks nothing; the P2-R4 split card (if approved) depends on this one only for the shared registry (it does not need it — P2-R4 is nav/hedge).

---

## Risks

- **Require cycle from the registry import** — `conversationGalleryModel` is imported very broadly; a new cross-feature import that eventually points back would be a web-bundle TDZ crash (Jest/Hermes tolerate it). Mitigated by the **zero-dependency** `fixtureTagRegistry.ts`; **must** verify with `npm run web:build`.
- **Regex false-positive exclusion** — a legitimate title with a trailing bracket could be hidden. Mitigated by the keyword+end-anchored patterns (verified against `looksLikeBotSeedTag`) and explicit negative tests.
- **Participant-count derivation semantics** — "Voices" (distinct posters) ≠ the header's "active seats". Mitigated by relabeling the stat; flagged as an orchestrator copy-confirm. If the reviewer insists the metric must equal seats, that would require the room-contract seat data in the gallery query (a **query change → out of scope** → then *drop* the count instead).
- **Heat/lane reshuffle** — if an implementer naively feeds the derived count into `computeConversationHeat`, heat/bucket/lane change and snapshots break. Mitigated by the explicit instruction to keep the heat input line verbatim + the byte-identical-heat test.
- **Share removal moving snapshot pins** — six existing rail tests assert the observer set; they must flip to assert `share`'s absence (intended). Enumerated in the test plan so the reviewer expects the churn.
- **Weave admin thread depth** — see the (d-i)/(d-ii) reconciliation; (d-ii) avoids threading through pinned `ArgumentRoom.tsx`.
- **Pinned-file diffs** — `DebateDetailHeader`, `App.tsx`, `ArgumentRoom.tsx` are soft-pinned; additive edits keep the API-token assertions green but the reviewer's `git diff --stat` will show them — must be justified in the PR body.

---

## Out of scope

- No router / URL model (Share returns only when rooms have URLs — a separate future card).
- No migration, no Edge Function, no RLS change, no service-role, no new flag, no new dependency, no deploy by Claude.
- No new fixture-tagging scheme — reuse the shipped `looksLikeBotSeedTag` registry.
- **Concept-unification** of the two open-counts (a single derived count) — copy/labels only in PR-G; unification is a follow-on.
- Admin run-tag parsers (`adminArgumentsRunTagModel`, `adminArgumentsRoomGroupingModel`, `runTagSource`) — a separate admin-display concern, not consolidated.
- The seat-based participant/observer count in the gallery (would need a query change).
- **P2-R4 (nav IA + hedge)** — recommended to split (see below).

---

## Doctrine self-check

- **cdiscourse-doctrine §9 (plain language):** raw internal fixture tags (`[stress …]` / `[xai-adv …]` / `[reseed-…]` / `[ai-corpus …]`) never render verbatim on any user surface after the strip — the exact "internal codes never reach a user string" rule. ✔
- **§1-§3 (no verdict / heat ≠ truth / popularity ≠ evidence):** every new/changed string is ban-list-clean (`STATE_RAIL_COPY`, `DISAGREEMENT_POINTS_RAIL_COPY.scopeNote`, "Voices"); the participant-count and open-counts describe *activity/structure*, never a verdict; the heat computation is left byte-identical (no new popularity signal). ✔
- **§10a (Observations vs Allegations / machine markers):** admins still see the machine-generated `BotRoomMarker` describing a *room type* ("Test room"), never a person; the strip does not alter that. ✔
- **§4 / §7 (no AI, no client AI):** zero AI calls; display/filter/copy/nav only. ✔
- **§8 (Supabase conventions):** no migration, no RLS change, no service-role, no write. ✔
- **accessibility-targets:** the in-room badge affordance is a 44×44 `button` with a count-bearing a11y label, not color-only; the badge renders nothing at 0. ✔
- **v1 scope guards:** nothing here builds voting/search/OAuth/push/public-API. ✔

**Flag posture: UNFLAGGED.** These are de-misleading *conformance* fixes — a flag would delay removing an active mislead from live users, which is the opposite of the intent. Two fixes live *within* already-flag-gated surfaces (the weave picker under `quote_forge`; the P1-11 superset under `move_marks`), but the fixes add **no new flag** — they ride the existing gate. Justification: doctrine §9 is a correctness floor, not an experiment.

---

## Scope recommendation

**Ship P1-9, P1-10, P1-11, P1-12, P1-13 under PR-G. Split P2-R4 into its own card.**

Rationale:
- The five retained items are small, independently-testable **display / filter / copy** fixes with one coherent review lens ("stop misleading live users"). Bundling them is right-sized — they share the fixture registry and the same boundary/pin considerations.
- **P2-R4 is a different shape.** It is an **IA decision** (does "My Arguments" become Home, or do we add a 5th nav item?) that touches the masthead nav model + ordering — and the masthead is already 390px-overflow-sensitive (documented mobile-overflow issue). It also entangles a **second investigation** (which of the two `unavailable_body` render paths fires for an openable room). Both the semantic redefinition of "My Arguments" and the hedge root-cause warrant the operator's eyes, separate from the low-risk de-misleading batch.
- The issue itself invites this ("Designer may recommend splitting this one out if it balloons — it is the most design-heavy of the six").

**Recommended split card (draft):** *UX-PR-G.2 — Home nav affordance + honest unavailable copy* — re-point `my_arguments → home_v2` (persistent affordance back to "Your table"), condition `ROOM_ACCESS_COPY.unavailable_body` on `resolveRoomDeepLinkAccess.outcome === 'unavailable'` (never on an openable card), with the masthead 6-viewport QA matrix. If the operator prefers PR-G to carry all six, the P2-R4 spec above is complete enough to implement — but the review lens widens.

---

## Reconciliation points needing an orchestrator ruling

1. **Weave-picker admin gating (P1-9d):** (d-i) thread `isAdminViewer` 3 hops vs (d-ii) exclude-for-all in the weave picker (strip always). **Recommend (d-ii).**
2. **Participant-count copy (P1-10):** relabel `Stat` "Participants" → **"Voices"** (recommended) vs keep "Participants" vs drop the stat. **Recommend "Voices" + derive.**
3. **Open-counts wording (P1-11):** confirm `open_points_a11y_suffix = 'across this whole argument.'` and `scopeNote = 'The disagreement points the mediator is actively tracking.'` (recommended) vs the issue's literal `"across the tree"` / `"mediator issues"`.
4. **Scope (P2-R4):** approve the **split** (recommended) vs ride all six under PR-G.
5. **Registry home:** new zero-dep `fixtureTagRegistry.ts` (recommended) vs extend `botRoomPolicyModel.ts`.
