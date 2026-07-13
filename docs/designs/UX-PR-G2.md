# UX-PR-G.2 — My-Arguments / Home nav IA + honest hedge copy

**Status:** Design draft
**Epic:** IA / de-misleading (UX continuity audit 2026-07 · finding 7 / P2-R4, split out of UX-PR-G / #920)
**Release:** Post-ASP UX-continuity remediation
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/922

---

## Goal (one paragraph)

Two runtime misleads from the 2026-07 authed walk (finding 7 / P2-R4). **(1)** The resume-first ArgumentHome surface ("Your table", `home_v2`-gated) is only the *initial* `galleryLane` value in `App.tsx`; once a user taps any primary nav item there is no affordance back to it, and "My Arguments" lands on a Browse-lookalike (`galleryLane: 'my_rooms'`) instead of the home surface. **(2)** The deep-link hedge line `ROOM_ACCESS_COPY.unavailable_body` ("This link may not work, or the argument may be limited to its members.") is emitted by `deriveRoomAccessView` for the `private_no_access` state and rendered as the **gallery/list card access line**, so a viewer with real RLS access to a private room they have not formally joined (the admin / moderator / unpropagated-membership seam) sees a room they *can* open described as if it might not exist. This card gives Home a **persistent nav affordance** by re-pointing "My Arguments" at `home_v2`, and makes the hedge **honest** by conditioning it on genuine non-openability — nav-STATE routing (`galleryLane`) + copy conditioning only. The shaping doctrine is `cdiscourse-doctrine` §9 (plain language, no misleading copy), §1-§3 (nav state / access are structure, never verdicts), the no-enumeration guarantee (a non-member never learns a private room exists), and the `home_v2` flag-gating invariant (the Home affordance must no-op / fall back when the flag is off). No router / URL model, no room/seat/submission change, no new dep / flag / migration / Edge / env.

---

## Data model

**No new data model. No migration. No new query. No new dependency. No new flag.**

Every field this card touches already exists:
- `galleryLane` shell state (`App.tsx:677`) is already typed `ConversationGallerySection | 'all' | 'home'` and already initializes to `'home'` when `homeV2Enabled`.
- `homeV2Enabled = isHomeV2Enabled()` (`App.tsx:635`; `src/lib/featureFlags.ts:96`) — synchronous zero-arg boolean, already read.
- `RoomAccessView.state` / `.canObserve` / `.accessLine` already exist on `roomAccessModel.ts`.
- `resolveRoomDeepLinkAccess(...).outcome` (`'resolved' | 'unavailable'`) already exists and already gates the deep-link modal.

One **type widening** (not a data-model change): `PrimaryNavTransition.galleryLane` widens from `'all' | 'my_rooms'` to `'all' | 'my_rooms' | 'home'`.

---

## The IA decision (Part A) — RECOMMENDATION: option (a), route "My Arguments" → `home_v2`

### What each surface actually is (verified)

- **ArgumentHome ("Your table")** — `buildArgumentHomeViewModel` (`src/features/home/homeModel.ts:96`) composes exactly three things from data App.tsx already loaded: `yourTurn` (disputes waiting on the viewer, ranked), `ongoing` (the viewer's **other joined rooms**, recency-ranked), and `isFirstRun` (nothing waiting / ongoing). It is, definitionally, **the viewer's own rooms organized resume-first**. It mounts only when `galleryLane === 'home' && homeV2Enabled` (`App.tsx:1268`).
- **The `my_rooms` gallery lane ("Mine")** — `SECTION_ORDER[0]` (`conversationGalleryModel.ts:1682`), label `"Mine"` (`:387`), classifies `card.hasUserJoined → 'my_rooms'` (`:1745`). It is the **flat list of joined rooms** inside the Browse gallery chrome. It is a first-class **lane chip** rendered by `ConversationGalleryScreen` (`:343-351`, `setActiveLane` → `onActiveLaneChange`), so it is reachable by one chip tap from Browse independent of any primary-nav routing.

So "My Arguments" (the user's rooms) and ArgumentHome (the user's rooms, resume-first) are **the same concept at two fidelities**. The flat "Mine" lane is a subset view of what ArgumentHome already surfaces.

### The three options

**(a) Route "My Arguments" → `home_v2` (RECOMMENDED).** `resolvePrimaryNavTransition('my_arguments')` returns `galleryLane: 'home'` when `homeV2Enabled`, else `'my_rooms'`. "My Arguments" now lands on the resume-first "Your table". The flat `my_rooms` lane does **not** lose its entry point — it stays reachable via the "Mine" lane chip inside Browse (and ArgumentHome's `onOpenFloor` jumps to the full floor). Flag-off is byte-identical to today (`'my_rooms'`).

**(b) Add a distinct 5th "Home" primary-nav item — REJECTED.**
- *390px overflow verdict:* **does not horizontally overflow, but is still rejected.** At 390px, `useHeaderBreakpoint` → `band === 'phone'` (390 ≤ `BRAND.breakpoints.phone.maxPx` < 600; `useHeaderBreakpoint.ts:72`). `AppPrimaryNav` then applies `rootPhone` (`flexDirection: 'column'`) and `navRow` keeps `flexWrap: 'wrap'` (`AppPrimaryNav.tsx:211-223`), so a 5th item **wraps to another line** rather than overflowing horizontally. The known universal 390px overflow was the masthead logo width (`resolveMastheadLogoHeightPx`, already fixed), not the nav row.
- *Why still rejected:* (i) a 5th long-label item ("Start An Argument · Browse Arguments · My Arguments · Profile" + "Home") grows the wrapped nav to more lines, adding **vertical chrome** to a masthead the same audit is trying to *shrink* (the whole UX-001.2 / `home_v2` effort was to make the Timeline the first substantive object). (ii) **Semantic redundancy** — since ArgumentHome *is* "My Arguments" resume-first, "Home" and "My Arguments" would be two nav items that both surface the viewer's rooms. Two doors to one room is worse IA than one door.

**(c) Rename the lane honestly — FALLBACK only.** Lowest effort, least satisfying: relabel so users are not promised a home they cannot return to. Only correct if the operator rejects redefining "My Arguments" (see operator note). Does not deliver the audit's actual ask (a persistent Home affordance).

### Recommendation and the one operator-taste confirm

**Recommend (a).** It is not a close (a)-vs-(b) taste call — (b)'s semantic redundancy + vertical-chrome cost are decisive, and (a) is the option the parent UX-PR-G design already recommended (§Scope recommendation, split card draft). The single genuine product-taste sub-decision, surfaced for an explicit operator confirm (not a blocker):

> **Operator confirm (semantic):** Under (a), "My Arguments" lands on the resume-first "Your table" (your-turn ranking + ongoing list + a first-run empty state) rather than a flat "Mine" list. The flat list stays one chip-tap away (the "Mine" chip in Browse). If the operator specifically wants "My Arguments" to remain the *flat* list, fall back to (c) (rename) instead of (a). The designer's read: (a) matches the audit intent ("give Home a persistent affordance") and the user's likely mental model of "my arguments" = "where I pick up where I left off."

Everything below specifies option (a).

---

## Hedge-copy conditioning (Part B) — the authoritative openability signal

### Root-cause of the over-fire (verified)

`unavailable_body` reaches a user through **two independent paths**:

1. **The deep-link modal** `RoomUnavailableNotice` (`RoomUnavailableNotice.tsx:48`) renders `ROOM_ACCESS_COPY.unavailable_body` **directly from the copy constant** (imported at `:21`), *not* from any access-view field. It is shown only when `roomUnavailableOpen === true`, which is set **only** by the deep-link handlers when `resolveRoomDeepLinkAccess(...).outcome === 'unavailable'` (`App.tsx:788-790`, `846-848`) or a defensive `!target` fallback (`:793-798`, `:850-854`). `resolveRoomDeepLinkAccess` returns `'unavailable'` iff the requested id is **absent from the RLS-filtered `debates` set** — i.e. the client literally has no room object to open. **This path is already honest** and needs no change: the modal fires only for genuinely non-openable ids, and `useDebates()` loads the full RLS-visible set (gallery pagination is client-side over `debates`, so an openable room's id is always present → `'resolved'`).

2. **The gallery / list card access line** (`ConversationGalleryScreen.tsx:722-724`, `DebateListScreen.tsx:191-197`) renders `accessView.accessLine`. `deriveRoomAccessView` sets `accessLine = ROOM_ACCESS_COPY.unavailable_body` for the **`private_no_access`** state (`roomAccessModel.ts:172`, `visibility === 'private' && !isMember`). **This is the over-fire.** A `private_no_access` card is a "defensive terminal — RLS means this rarely renders" (model comment `:163`), but it *does* render for the real seam where a viewer received a private room's row via RLS yet `isMember === false`: an **admin / moderator** browsing (broad `is_moderator_or_admin()` SELECT) or a member whose participant row has not yet propagated. That card **is openable** (its id is in `debates`, tapping it calls `selectDebate`, `resolveRoomDeepLinkAccess` → `'resolved'`), yet its access line reads "This link may not work, or the argument may be limited to its members." — the exact "renders even for rooms the viewer can actually open" complaint.

### The authoritative signal (already computed — do NOT fabricate one)

- **Deep-link path:** `resolveRoomDeepLinkAccess(...).outcome === 'unavailable'` is the genuine non-openability signal. Already the sole gate. **No change.**
- **Gallery / list path:** a card that renders in the gallery/list is **openable by construction** (the viewer received the row via RLS, `canObserve` is true for every readable room). The only state that emits the hedge there is `private_no_access`, whose model contract already treats it as *non-renderable chrome* — its `badgeLabel` is already `''` (empty, `:171`) for exactly the no-enumeration reason. The `accessLine` is the lone inconsistency: it should also be empty.

### The minimal honest fix

1. **`roomAccessModel.ts:172`** — change the `private_no_access` branch `accessLine` from `ROOM_ACCESS_COPY.unavailable_body` to `''`, making it **consistent with its already-empty `badgeLabel`**. A private-no-access view now carries *no* user-facing chrome (empty badge, empty line) — the correct no-enumeration posture. The deep-link modal is unaffected (it references the copy constant directly, not this field).
2. **`ConversationGalleryScreen.tsx:722-724`** and **`DebateListScreen.tsx:191-197`** — render the access line only when non-empty (`accessView.accessLine ? <Text …>{accessView.accessLine}</Text> : null`). Openable-but-unjoined private cards (admin/mod seam) then show **nothing** rather than a false hedge. Every genuinely public/member card is unchanged (its line is non-empty and accurate).

**What the openable case shows instead:** nothing (no access line). The card's action label (`Observe → / Continue → / Open →`, from the shared `deriveGalleryActionLabel`) already communicates that the room is enterable, so a neutral filler line is unnecessary and risks re-introducing enumeration; empty is the honest minimum.

This is strictly *less* disclosure (no false hedge, still no "Private" leak), so it preserves no-enumeration; and it never touches the non-member RLS path (those cards do not reach the client at all).

---

## File changes

### Modified — production (5 files)

- **`src/features/navigation/appPrimaryNavModel.ts`** (~12 lines net)
  - Widen `PrimaryNavTransition.galleryLane` type to `'all' | 'my_rooms' | 'home'`.
  - `resolvePrimaryNavTransition(section, options?: { homeV2Enabled?: boolean })` — add an optional second arg (default `{ homeV2Enabled: false }`). Only the `'my_arguments'` case reads it: `galleryLane: options?.homeV2Enabled ? 'home' : 'my_rooms'`. **Every other case and the no-options call is byte-identical**, so the existing `.toEqual({… galleryLane: 'my_rooms' …})` pins stay green.
  - `deriveActivePrimaryNavSection` — extend the arguments-tab branch so `galleryLane === 'home'` also maps to `'my_arguments'`: `if (!state.hasDebate && (state.galleryLane === 'my_rooms' || state.galleryLane === 'home')) return 'my_arguments';`. `PrimaryNavShellState.galleryLane` is already `string`, so `'home'` typechecks. Additive — the two existing derivation pins (`my_rooms → my_arguments`, `'all' → browse_arguments`) are untouched.
  - Update the doc comments (the `resolvePrimaryNavTransition` header and the `deriveActivePrimaryNavSection` precedence list) to name the `home` lane. Use the string "(issue 922)" if a code comment references the issue — **not** `#922` (Workflow determinism-scanner token hazard — see Risks).

- **`App.tsx`** (~3 lines net)
  - `handlePrimaryNav` (`:1036`): pass the flag — `const t = resolvePrimaryNavTransition(section, { homeV2Enabled });`. `setGalleryLane(t.galleryLane)` (`:1046`) already accepts `'home'` (state type includes it). No other line changes.
  - No change to `deriveActivePrimaryNavSection` call site (`:1058-1064`) — it already passes `galleryLane`, which will now sometimes be `'home'`; the model handles it.
  - **Pinned file** (`uxOneOneSixReadOnlyBoundary.test.ts:144`, `requiredApi: [/roomActive/, /testID="app-tab-bar"/]`). Edit is additive and preserves both tokens → boundary stays green. Reviewer will see the diff in `git diff --stat`; justify in the PR body.

- **`src/features/debates/roomAccessModel.ts`** (~2 lines) — `private_no_access` branch (`:164-174`): `accessLine: ''` (was `ROOM_ACCESS_COPY.unavailable_body`). Update the inline `// cause-neutral; asserts nothing.` comment to note the accessLine is now empty (chrome suppressed; the deep-link modal owns `unavailable_body` directly). **Not pinned** by any boundary test.

- **`src/features/debates/ConversationGalleryScreen.tsx`** (~3 lines) — guard the access line render at `:722-724` on `accessView.accessLine` being non-empty. **Not pinned.**

- **`src/features/debates/DebateListScreen.tsx`** (~5 lines) — guard the access line render at `:191-197` on non-empty (the `<Text testID={`debates-cell-access-…`}>` becomes conditional; keep the testID on the rendered element so the existing test can assert presence/absence). **Not pinned.**

### Modified — tests (see Test plan for new files)

- `__tests__/roomAccessModel.test.ts` — update the `private_no_access` accessLine assertion (`:117`) and the renderable-states length loop (`:397-403`).

### New / deleted

No new production files. No deleted files.

---

## API / interface contracts

```ts
// appPrimaryNavModel.ts

export interface PrimaryNavTransition {
  tab: 'arguments' | 'account';
  startArgumentOpen: boolean;
  galleryLane: 'all' | 'my_rooms' | 'home'; // widened (+ 'home')
  aboutOpen: boolean;
  deselectRoom: boolean;
  clearDemoCorridor: boolean;
}

/**
 * Options default to the flag-off shape, so `resolvePrimaryNavTransition(section)`
 * (no options) is byte-identical to today — existing pins stay green.
 */
export function resolvePrimaryNavTransition(
  section: PrimaryNavSection,
  options?: { homeV2Enabled?: boolean },
): PrimaryNavTransition;
// my_arguments → galleryLane: options?.homeV2Enabled ? 'home' : 'my_rooms'
// every other section: unchanged.

export function deriveActivePrimaryNavSection(
  state: PrimaryNavShellState, // galleryLane is already `string`; 'home' accepted
): PrimaryNavSection;
// arguments tab + galleryLane ∈ {'my_rooms','home'} + !hasDebate → 'my_arguments'
```

```ts
// roomAccessModel.ts — deriveRoomAccessView, private_no_access branch
{
  state: 'private_no_access',
  badgeLabel: '',   // unchanged (no enumeration)
  accessLine: '',   // CHANGED: was ROOM_ACCESS_COPY.unavailable_body — chrome suppressed
  canObserve: false,
  // …rest unchanged
}
```

```ts
// App.tsx handlePrimaryNav (only changed line)
const t = resolvePrimaryNavTransition(section, { homeV2Enabled });
```

No RLS, Edge, SQL, or copy-constant contract changes. `ROOM_ACCESS_COPY.unavailable_body` stays in `gameCopy.ts` verbatim (the modal still uses it).

---

## Edge cases

- **Flag OFF (`homeV2Enabled === false`).** `resolvePrimaryNavTransition('my_arguments', { homeV2Enabled: false })` → `'my_rooms'`; initial `galleryLane` is `'all'`; `'home'` is never set by any path, so the added `deriveActivePrimaryNavSection` `'home'` branch is dead. **Byte-identical to today.** The ArgumentHome mount is double-guarded (`galleryLane === 'home' && homeV2Enabled`, `App.tsx:1268`), so even a stale `'home'` cannot mount it with the flag off.
- **First load with flag ON.** Initial `galleryLane === 'home'` → `deriveActivePrimaryNavSection` returns `'my_arguments'`, so the highlighted nav item matches the visible "Your table" surface (an improvement — previously it highlighted `browse_arguments` while showing the home surface, itself a small mismatch).
- **`my_rooms` reachability under (a).** The flat "Mine" list is not orphaned: the "Mine" lane chip (`ConversationGalleryScreen` `SECTION_ORDER`/chip row) sets `galleryLane: 'my_rooms'` via `onActiveLaneChange`. When it does, `deriveActivePrimaryNavSection` still returns `'my_arguments'` (both `'home'` and `'my_rooms'` map there) — consistent highlight for both "my stuff" views.
- **`onOpenFloor` from ArgumentHome.** `setGalleryLane('all')` (`App.tsx:1288`) → Browse; active nav becomes `browse_arguments`. Round-trip back to Home is "My Arguments". No dead-end.
- **Room open while on Home.** Opening a room from ArgumentHome sets `hasDebate` true; `deriveActivePrimaryNavSection` returns the non-`my_arguments` default for an open room (`hasDebate` short-circuits the lane check) — matches today's "an open room keeps the gallery anchor" behavior.
- **`private_no_access` card that reaches the gallery/list (admin/mod/unpropagated seam).** Access line now renders nothing (empty), badge already empty, action label already correct → card is openable and honestly chrome-light. No "Private" leak.
- **Non-member, non-admin viewer.** `private_no_access` cards never reach the client (RLS), so the accessLine change is a no-op for them; the deep-link modal still covers the genuinely-absent-id case with `unavailable_body`.
- **Deep-link to a genuinely private/nonexistent id.** Unchanged: `resolveRoomDeepLinkAccess → 'unavailable'` → modal shows `unavailable_body`. Still honest (id truly absent).
- **Empty gallery access line vs layout.** `ConversationGalleryScreen`'s `accessLine` style has `marginTop` — rendering `null` instead of an empty `<Text>` avoids a stray gap; ensure the guard returns `null`, not an empty string child.

---

## Test plan

Pure-model tests (no React) unless noted. Reuse existing suites; add targeted cases.

- **`__tests__/HeaderNavigation.regularUser.test.tsx`** (update + add) —
  - Keep the existing `resolvePrimaryNavTransition('my_arguments')` → `galleryLane: 'my_rooms'` pin (`:252-256`) green (no-options default).
  - Add: `resolvePrimaryNavTransition('my_arguments', { homeV2Enabled: true }).galleryLane === 'home'`; `resolvePrimaryNavTransition('my_arguments', { homeV2Enabled: false }).galleryLane === 'my_rooms'`.
  - Add: `deriveActivePrimaryNavSection({ …base, galleryLane: 'home' }) === 'my_arguments'` (home reachable-after-first-load correctness); keep `'my_rooms' → my_arguments` and `'all' → browse_arguments` pins (`:303-308`).
  - Add: an open room with `galleryLane: 'home'` does **not** return `'my_arguments'` (hasDebate short-circuits), matching the existing open-room pin (`:311-313`).
- **`__tests__/navigation/appPrimaryNavCorridorNav.test.ts`** (update) — the regression pin at `:49-56` asserts `resolvePrimaryNavTransition('my_arguments')` deep-equals the full object with `galleryLane: 'my_rooms'`. It stays green (no-options call), but add a parallel assertion for the `{ homeV2Enabled: true }` object (`galleryLane: 'home'`, all other fields identical) so the home routing is pinned alongside `clearDemoCorridor`.
- **`__tests__/roomAccessModel.test.ts`** (update) —
  - `:117` → `expect(v.accessLine).toBe('')` for `private_no_access` (was `unavailable_body`); assert the badge stays `''` and `canObserve === false` (unchanged).
  - `:397-403` renderable-states loop: move the `accessLine.length > 0` check inside the existing `if (state !== 'private_no_access')` guard (its title already excludes `private_no_access` as non-renderable). Add an explicit `expect(view.accessLine).toBe('')` for `private_no_access`.
  - Keep the ban-list / internal-code scans (`:376-395`) green (empty string trivially passes; confirm the scan tolerates `''`).
- **`__tests__/roomUnavailableNotice.test.tsx`** (no change, re-run) — asserts the modal renders `ROOM_ACCESS_COPY.unavailable_body` (`:20`, `:25`). Proves the modal is decoupled from the model change and remains honest. Cite as a regression guard.
- **`__tests__/ConversationGalleryScreen.visibility.test.tsx`** (update/add) — a `private_no_access` card (visibility `private`, `hasUserJoined` false) renders **no** `gallery-card-access-<id>` text (or an empty one); a `public_open` card still renders its `public_open_line`; a `private_member` card still renders `private_member_line`. Assert no rendered access line ever equals `unavailable_body`.
- **`__tests__/DebateListScreen.visibility.test.tsx`** (update/add) — same three cases against `debates-cell-access-<id>`: private-non-member row shows no hedge; public/member rows unchanged.
- **Doctrine ban-list** — the empty accessLine adds no new string; existing `roomAccessModel` ban-list + `copySystemBanList` scans stay green. No new `gameCopy` key.
- **Gate discipline** — run `npm run typecheck`, `npm run lint`, `npm run test` to captured exit 0 (`; echo "EXIT: $?"`). A **`npm run web:build`** pass is prudent (App.tsx + gallery edits) though no new cross-feature import is added, so a require-cycle is not a specific risk here.

No new snapshot files. Test count goes **up** (added nav-routing + hedge-conditioning cases; no deletions).

---

## Dependencies (cards / docs / files)

- Assumes **HOME-001 (#874)** is complete — reuses `homeV2Enabled` gating, the `galleryLane: 'home'` state, and the `ArgumentHome` mount guard (`App.tsx:1268`). This card only *routes* to that surface; it does not modify `homeModel`.
- Assumes **NAV-START-ARGUMENT-001 Slice B** is the live nav model — reads `resolvePrimaryNavTransition` / `deriveActivePrimaryNavSection` / `handlePrimaryNav` unchanged in shape.
- Assumes **ARG-ROOM-006** access model + `RoomUnavailableNotice` are live — reads `deriveRoomAccessView`, `resolveRoomDeepLinkAccess`, and the modal exactly as shipped.
- Split from **UX-PR-G (#920)** per that design's §Scope recommendation (the five de-misleading items ship separately; this is the IA / hedge half). No code dependency on the UX-PR-G branch — the surfaces are disjoint (fixture registry vs nav model vs access line).
- Blocks nothing. A future URL/router card would supersede the nav-STATE approach but is explicitly out of scope here.

---

## Risks

- **`App.tsx` pinned-file diff.** `uxOneOneSixReadOnlyBoundary.test.ts` pins App.tsx by required-API token (`/roomActive/`, `/testID="app-tab-bar"/`), not byte-equality. The one-line `handlePrimaryNav` edit preserves both, so the suite stays green, but the reviewer's `git diff --stat` will show App.tsx — justify in the PR body (additive, pinned tokens intact).
- **Issue-ref token in comments.** If a code comment cites the issue, use `(issue 922)` — the Workflow determinism scanner rejects some bare tokens; the safest is to avoid `#922` and avoid a bare `Date` token in any scanned script (not applicable here, but noted for the implementer's comment discipline).
- **Existing exact-object pins.** `appPrimaryNavCorridorNav.test.ts:49-56` and `HeaderNavigation…:252-256` deep-equal / read `resolvePrimaryNavTransition('my_arguments')`. The **default (no-options)** must stay `'my_rooms'` — do not flip the default to `'home'`, or both pins break and flag-off behavior changes. The flag is opt-in via the options arg only.
- **Widening `PrimaryNavTransition.galleryLane`.** Any exhaustive switch over the old two-member union elsewhere would need the `'home'` arm — grep confirms the only consumers are `handlePrimaryNav` (assigns to a state that already accepts `'home'`) and the tests. Low risk; typecheck is the oracle.
- **Access-line render guard regressions.** Six-ish visibility tests assert the access line text; the private-non-member case flips from "has hedge text" to "no text". Enumerated above so the reviewer expects the churn. Keep the `testID` on the conditionally-rendered element (or assert its absence) so query helpers behave.
- **Perf-budget flakes (LIFE-001 / META-001).** Unrelated to this diff; if they flake under full-suite parallel load, re-run isolated before blaming this branch.
- **`private_no_access` also feeds `canObserve: false`.** This card intentionally does **not** change `canObserve` (a broader access-semantics question). It only suppresses the *string*. If a future card wants admin/mod seam cards to formally read as observable, that is a separate access-model change — out of scope here.

---

## Out of scope

- **No router / URL model.** The app has no URLs; browser Back exits the app (TL-003 / COMPOSER-002 no-route invariant). This card does nav-STATE routing (`galleryLane`) + copy conditioning only.
- **No room / seat / submission semantics change.** No change to `canObserve` / `canClaimSeat` values, capacity, RLS, or the deep-link resolver logic.
- **No new dependency, flag, migration, Edge Function, env var, or masthead visual redesign.**
- **Option (b) (5th nav item)** and any masthead layout change — rejected above.
- **The other five UX-PR-G items** (fixture leakage, participant count, open-counts labels, Share removal, in-room badge) — ship under UX-PR-G (#920).
- **`canObserve` semantics for the admin/mod seam** — string suppression only; the boolean is unchanged.

---

## Doctrine self-check

- **cdiscourse-doctrine §9 (plain language / no misleading copy):** the core fix — `unavailable_body` no longer fires as a gallery/list access line for openable rooms; the hedge now renders only where it is honest (a deep-link id genuinely absent from the RLS set). No internal code reaches any user string; no new string added. ✔
- **§1-§3 (no verdict / heat ≠ truth / popularity ≠ evidence):** nav state (`galleryLane`) and access lines describe *structure/whereabouts*, never a verdict; no heat / popularity / engagement signal is read or added. ✔
- **No-enumeration guarantee:** `private_no_access` now carries an **empty** badge *and* empty access line (fully consistent chrome suppression) — a non-member still never learns a private room exists; the change discloses strictly less. The deep-link modal keeps the cause-neutral `unavailable_body` (identical for private-no-access and nonexistent). ✔
- **`home_v2` flag-gating invariant:** the Home affordance is opt-in via `resolvePrimaryNavTransition(section, { homeV2Enabled })`; flag-off is byte-identical (`'my_rooms'`), and the ArgumentHome mount stays double-guarded (`galleryLane === 'home' && homeV2Enabled`). ✔
- **§4 / §7 (no AI, no client AI):** none — pure nav-state + copy conditioning. ✔
- **§8 (Supabase conventions):** no migration, RLS, service-role, or write. ✔
- **expo-rn-patterns / accessibility-targets:** no new component; the nav items keep their `Pressable` role/label/state and ≥44×44 targets; suppressing an access line removes text, so no new a11y surface; the active-section highlight (`accessibilityState.selected`) now correctly tracks the Home surface. ✔
- **v1 scope guards:** nothing here builds voting / search / OAuth / push / public API. ✔

**Flag posture: UNFLAGGED.** These are de-misleading conformance fixes riding the existing `home_v2` gate; a new flag would delay removing an active mislead. The Home routing only activates when `home_v2` is already on.

---

## Operator steps (if any)

**None — pure code change.** No `supabase db push`, no `functions deploy`, no env var. One **operator product-taste confirm** is requested in Part A (does "My Arguments" become the resume-first "Your table" (a), or stay the flat "Mine" list (c)?) — the design recommends (a); if the operator rules (c), the implementer swaps the routing for a rename and drops the nav-model change. The hedge-copy fix (Part B) is unconditional either way.
