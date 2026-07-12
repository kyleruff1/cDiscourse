# UX-PR-B — state honesty: make silent failures visible + announced

**Status:** Design draft
**Epic:** UX continuity / a11y (audit lane PR-B — cross-epic; touches Auth, Gallery, Evidence read, Room)
**Release:** UX continuity audit 2026-07 remediation
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/918
**Base:** `4703a2a6` (main) · Branch: `feat/ux-prb-state-honesty`
**Flag posture:** UNFLAGGED (a11y / honesty conformance — see §Flag posture)

---

## Goal (one paragraph)

The UX continuity audit found that failure states across six coupled surfaces are **silent**: an error is caught and swallowed into an empty/no-op success, so the user — and, more sharply, a screen-reader user — is misled that data is *absent* or that an action *did nothing*. The load-bearing case is a JWT expiring mid-room, which fails every room read hook simultaneously; the room then quietly degrades to "no sources, no markers, no marks, seats open" with no signal that anything went wrong. PR-B makes these failures honest and announced, using **one shared hook-error template** applied five times plus one shared room-level strip, and four one-site fixes. It changes only the *error channel* — no data shape, no behavior, no new dependency, no migration/Edge/flag. This design respects `cdiscourse-doctrine` (every surfaced string is plain-language and ban-list clean; no verdict/heat/popularity token; no score gating), `accessibility-targets` (every notice carries a live region; every retry control meets role + 44×44), and the repo's silent-by-design exemption for `useMyCircles` (explicitly not "fixed").

---

## Cannot-proceed check

No doctrine conflict. One reconciliation note is worth flagging up front, because `cdiscourse-doctrine` §10 lists "No OAuth / social login" as a v1 scope guard, and P1-4 touches Google sign-in:

- **This card does NOT build OAuth.** The Google SSO lane already shipped (AUTH-GOOGLE-SSO-003 #746, gated behind `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`, live in the deployed env per the auth-deployment memory). PR-B only threads the **already-returned** `result.message` from the existing `signInWithGoogle` wrapper into the **already-present** `ErrorNotice`. It adds no provider, no new call site, no new gate. This is pure failure-surfacing on an existing surface, fully inside PR-B's "error channel only" scope. No v1-scope violation.

Proceeding.

---

## Data model

**No new data model. No DB change. No wire-shape change.** Every change is an additive field on a hook's in-memory return type or a widened pure-TS discriminated union. TypeScript surfaces only:

### 1. The hook-error template (the core — applied 5×)

Each of the five read hooks gains an `error: string | null` field on its result interface, set in the existing `if (error)` catch branch, cleared to `null` on every successful load and on every "disabled / unconfigured / no-ids" early return. The value is a **fixed plain-language string**, never the raw Supabase error (no code leak, ban-list clean).

```ts
// One shared read-error sentinel, plain-language + ban-list clean.
// Lives in gameCopy.ts (see §API). The hooks import the string; they never
// echo the raw supabase error object.
const READ_ERROR = ROOM_LOAD_ERROR_COPY.hookError; // "Some of this could not load."
```

### 2. The shared room-strip aggregation state (pure model)

```ts
// src/features/arguments/room/roomLoadErrorModel.ts  (NEW, pure TS, no React)
export type RoomLoadErrorSource = 'proof' | 'markers' | 'move_marks' | 'chime_in';

export interface RoomLoadErrorInput {
  source: RoomLoadErrorSource;
  error: string | null;
}

export interface RoomLoadErrorStripState {
  visible: boolean;                 // true iff >= 1 source errored
  message: string;                  // ONE stable message regardless of N failures
  failedSources: RoomLoadErrorSource[]; // drives which refetches the retry fires
}

export function deriveRoomLoadErrorStrip(
  inputs: ReadonlyArray<RoomLoadErrorInput>,
): RoomLoadErrorStripState;
```

The retry *functions* (refetch closures) are **not** in the pure model — they are not JSON-serializable. The component holds a `Record<RoomLoadErrorSource, () => void | Promise<void>>` and, on retry, invokes the refetch for each `failedSources` entry.

### 3. The widened join side-effect union (pure model)

```ts
// src/features/debates/seatClaimModel.ts  (widen existing union)
export type JoinSideEffect =
  | { kind: 'select_side'; side: ParticipantSide }
  | { kind: 'full_room_observe' }
  | { kind: 'error'; message: string }   // NEW
  | { kind: 'none' };                    // retained (see pre-flight)
```

Plus a small pure mapper for the join panel:

```ts
export interface JoinPanelFeedback { joined: boolean; message: string | null; }
export function resolveJoinPanelFeedback(result: {
  side: ParticipantSide | null;
  outcome: JoinOutcomeKind;
}): JoinPanelFeedback;
```

---

## File changes

Budget: **15 production files touched** (2 new, 13 modified — 8 of the modifications are one-to-five-line additive edits) + **~9 test files** (2 extended, ~7 new). This exceeds the "~10 files" napkin estimate because the six audit items are coupled but land on distinct surfaces; the *conceptual* surface is small (one template + one strip + four one-liners). Honest count below.

### New files
- `src/features/arguments/room/roomLoadErrorModel.ts` — pure aggregation helper `deriveRoomLoadErrorStrip` + types. ~45 lines.
- `src/features/arguments/room/RoomLoadErrorStrip.tsx` — the ONE presentational strip (renders null when `!visible`; live region; retry Pressable). ~55 lines.

### Modified — the five hooks (one template, five mirrors)
- `src/features/proof/useProofItems.ts` — **worked example / worst case.** Add `error` to `UseProofItemsResult`; set in the `if (error)` branch (~:66); clear on success + on the disabled early return; expose via return. ~8 lines.
- `src/features/arguments/markers/useMarkers.ts` — mirror. `error` on `UseMarkersResult`; set at ~:68. ~8 lines.
- `src/features/feedback/useMoveMarks.ts` — mirror, **read-path only.** Add a top-level `error` (the read error) distinct from the existing per-move write `moveMarkErrorFor`; set at the read catch (~:95). The write path (~:171-188) is already exemplary and is **not** touched. ~8 lines.
- `src/features/debates/useChimeInContributions.ts` — mirror. `error` on `UseChimeInContributionsResult`; set at ~:75. ~8 lines.
- `src/features/debates/useGalleryMoveMarks.ts` — mirror. `error` folded into the existing bundled `State`; set at ~:58. ~6 lines. (Surfacing: gallery, not the room strip — see §Reconciliation.)

### Modified — the shared strip mount + chime note (room)
- `src/features/arguments/room/ArgumentRoom.tsx` (**soft uxOneOneSix pin — additive, keep `ArgumentRoom` + `Props` tokens**):
  - Destructure `error` (+ `refetch`) from the four room hooks at ~:855 / ~:861 / ~:1000 / ~:1009.
  - `useMemo` → `deriveRoomLoadErrorStrip([...4 inputs])`; a `handleRetryRoomLoad` callback mapping `failedSources` → refetches.
  - Mount `<RoomLoadErrorStrip>` **once** in the `topBanner` region (~:2985, above the microMoment, sibling of `ArgumentStateRail`/`ChimeInAffordance`).
  - Add `chimeInNote` state; set it from `res.errorMessage` in the `handleChimeInAttach`/`handleChimeInRetract` failure branches (~:1032-1033 / ~:1044-1045); clear on success + on a fresh attempt; pass as a `note` prop to `<ChimeInAffordance>` (~:3020). ~30 lines total.
- `src/features/debates/ChimeInAffordance.tsx` — add optional `note?: string | null` prop; render a quiet inline `<Text accessibilityLiveRegion="polite">` note below the pill, mirroring `BooleanFeedbackBar.tsx:151-176`. ~15 lines.

### Modified — the four one-site fixes + join
- `App.tsx` (**soft uxOneOneSix pin — additive, keep `/roomActive/` + `testID="app-tab-bar"` tokens**): add `joinFailureNote` state; in the `onJoinSide` handler (~:1497) handle the new `effect.kind === 'error'` branch → set note + `AccessibilityInfo.announceForAccessibility`; clear on success; render a room-scoped live-region note banner (mirror `callbackRetryBanner` ~:1636). ~20 lines.
- `src/features/debates/seatClaimModel.ts` — widen `JoinSideEffect` with `{ kind: 'error'; message }`; `resolveJoinSideEffect` returns it for `error`/`unavailable` (side null); add `resolveJoinPanelFeedback`. ~20 lines.
- `src/features/auth/AuthScreen.tsx` — add `providerError` state; `onPress` awaits `signInWithGoogle()` and sets `providerError` on `!ok`; fold into `displayError` (~:113); the existing `ErrorNotice` (~:194) renders it. ~10 lines.
- `src/features/debates/ConversationGalleryScreen.tsx` — (a) P1-8: add `!loading &&` to the EmptyState guard (~:380); (b) P2-10: the `JoinDebatePanel` `onJoin` closure (~:238) computes `resolveJoinPanelFeedback` and returns `JoinPanelFeedback`; (c) gallery-signal note for `useGalleryMoveMarks.error` (quiet, non-blocking — see §Reconciliation). ~15 lines.
- `src/features/debates/JoinDebatePanel.tsx` — change `onJoin` prop to `=> Promise<JoinPanelFeedback>`; add local `error` state set from the returned feedback on `!joined`; render an inline `<ErrorNotice>`. ~12 lines.
- `src/features/arguments/gameCopy.ts` — add `ROOM_LOAD_ERROR_COPY` block, `SEAT_CLAIM_COPY.joinFailed`, `GALLERY_SIGNAL_ERROR_COPY`. All ban-list clean. ~12 lines.

### Deleted files
None.

### Read-only (verified, NOT changed)
- `src/features/circles/useMyCircles.ts` — **silent-by-design; excluded.** Already carries an `error` field that is `null` by construction (`:44` comment: "Never a blocking error"). Census-listed with a by-design tag. Do **not** wire it to any strip.
- `src/features/auth/signInWithGoogle.ts` — already returns `{ ok, error, message }`; consumed, not changed.
- `src/features/feedback/BooleanFeedbackBar.tsx` — the write-path precedent we mirror; unchanged.
- `src/features/arguments/ArgumentTreeScreen.tsx` — the `!loading` EmptyState template we copy; unchanged.

---

## API / interface contracts

### `deriveRoomLoadErrorStrip(inputs)` (pure)
- Input: array of `{ source, error }`. Order-independent.
- `visible = inputs.some(i => i.error !== null)`.
- `message`: **one stable string** — `ROOM_LOAD_ERROR_COPY.stripMessage` (`"Some of this room could not load."`) regardless of how many sources failed. It does **not** enumerate which sources failed (that would be noise and could leak internal concepts like "markers"/"proof").
- `failedSources`: the subset with non-null error, in a **fixed canonical order** (`proof, markers, move_marks, chime_in`) so the output is deterministic and testable.

### `<RoomLoadErrorStrip>` props
```ts
interface RoomLoadErrorStripProps {
  state: RoomLoadErrorStripState;
  onRetry: () => void;   // parent maps failedSources -> refetch()s
  testID?: string;       // default "room-load-error-strip"
}
```
Renders `null` when `!state.visible`. Otherwise a `<View accessibilityLiveRegion="polite">` containing the message `<Text>` and a retry `<Pressable accessibilityRole="button" accessibilityLabel={ROOM_LOAD_ERROR_COPY.retryA11y} hitSlop={{12,12,12,12}}>`. Non-blocking (does not cover room content). Muted styling (mirror `errorNote` tone, not the red danger banner — a failed *load* is recoverable, not fatal).

### `resolveJoinSideEffect(result)` (widened)
```
room_full                        -> { kind: 'full_room_observe' }
side !== null                    -> { kind: 'select_side', side }
outcome 'error' | 'unavailable'  -> { kind: 'error', message: SEAT_CLAIM_COPY.joinFailed }   // NEW
otherwise (impossible: side-null success) -> { kind: 'none' }
```

### `resolveJoinPanelFeedback(result)` (new, pure)
```
side !== null   -> { joined: true,  message: null }
room_full       -> { joined: false, message: SEAT_CLAIM_COPY.fullRoomObserve }  // reuse existing copy
otherwise       -> { joined: false, message: SEAT_CLAIM_COPY.joinFailed }
```

### `<ChimeInAffordance>` (add prop)
```ts
note?: string | null;  // quiet plain-language failure note; renders live-region Text below the pill
```
`note` is set by the parent from `ChimeInApiResult.errorMessage` (already plain-language + ban-list clean, from `CHIME_IN_ERROR_COPY`). The affordance still renders its pill; the note sits beneath it. Because the affordance already returns `null` when ineligible, the note only appears in the eligible/attached states where a chime action was possible — which is exactly where an attach/retract failure can occur.

### `<JoinDebatePanel>` (change prop signature)
```ts
onJoin: (side: ParticipantSide) => Promise<JoinPanelFeedback>;  // was Promise<void>
```

### New copy (gameCopy.ts — all ban-list clean, plain-language)
```ts
export const ROOM_LOAD_ERROR_COPY = Object.freeze({
  stripMessage: 'Some of this room could not load.',
  hookError: 'Some of this could not load.',   // per-hook sentinel
  retryLabel: 'Retry',
  retryA11y: "Retry loading this room's details.",
});
// added to SEAT_CLAIM_COPY:
joinFailed: 'We could not add you to this argument. Try again.',
export const GALLERY_SIGNAL_ERROR_COPY = Object.freeze({
  note: 'Some room activity could not load.',
});
```

---

## JoinSideEffect union pre-flight result (P1-5, the UX-FLAGS-004 lesson)

**Result: NO exhaustive consumer exists. Widening is SAFE and additive.**

Every reference to `JoinSideEffect` / `resolveJoinSideEffect` in `src/`, `App.tsx`, and `__tests__/`:

| Site | Kind of consumption | Breaks on widening? |
|---|---|---|
| `seatClaimModel.ts:318` | the `type` declaration (widened here) | n/a |
| `seatClaimModel.ts:333` | `resolveJoinSideEffect` producer (updated here) | n/a |
| `src/features/debates/index.ts:256,265` | re-export of fn + type only | No |
| `App.tsx:1497` | **`if (effect.kind === 'select_side') … else if (… 'full_room_observe')`** — non-exhaustive if/else-if, no `default`/`assertNever`/`switch` | No — a new kind falls through today's no-op; the new `'error'` branch is *added* |
| `__tests__/seatClaimModel.test.ts:412-413` | asserts `unavailable`/`error` → `{ kind: 'none' }` | **Yes — expected test update** (these two assertions must change to `{ kind: 'error', message }`; the whole point of the card) |

There is **no** `assertNever`, exhaustive `switch`, or `never`-typed sink over the union anywhere. `'none'` is retained in the union (not replaced) so no type-only reference is disturbed; `resolveJoinSideEffect` simply stops emitting it for genuine failures. The only required test change is the two intentional assertion flips in `seatClaimModel.test.ts` — documented in §Test plan and §Risks.

---

## Edge cases

- **Expired session (the load-bearing case):** JWT expires mid-room → all four room reads' `if (error)` branch fires → four non-null errors → `deriveRoomLoadErrorStrip` returns `visible: true` with **one** stable message and `failedSources: [proof, markers, move_marks, chime_in]`. The strip renders **once** (not four banners), announces once, and the room stays readable (posted moves already in state are untouched). Retry fires all four refetches.
- **Single-hook failure:** only proof errors → strip shows the same one message, `failedSources: [proof]`, retry fires only proof's refetch.
- **Flag-off hooks:** a disabled hook's early return sets `error = null` (byte-identical to today), so a flag-off room never shows the strip. The strip mounts unconditionally but self-renders `null`.
- **Empty inputs / no argument ids:** the hooks' `argumentIds.length === 0` early return sets `error = null` (empty is not an error). Strip stays hidden. `useProofItems` returning `{}` on empty is *legitimate* absence, not a swallowed failure.
- **Transient error then success:** a refetch success must clear `error` back to `null`. The template sets `error = null` at the top of the success write, so the strip auto-dismisses on recovery (live region announces nothing on clear — correct).
- **Concurrent tap during retry:** retry re-invokes refetch; the hooks already guard with `mountedRef` / `inflightRef`. No new concurrency introduced.
- **Chime contention 409s (`seats_full`/`room_private`):** these are *expected* outcomes, not edge cases — `CHIME_IN_ERROR_COPY` already carries their plain-language copy. Surfacing them is the fix; they must **not** read as errors-of-the-user (copy is neutral seat/visibility facts).
- **Chime affordance unmounts after retract:** if a successful retract removes the last open seat and the affordance would re-render `null`, a *prior* failure note must not resurrect. Note state is cleared on every fresh attach/retract attempt, so a stale note cannot outlive the affordance.
- **Google failure with redirect already navigating:** on success the browser navigates away, so no note renders (nothing to show). Only the `!ok` (pre-redirect) path sets `providerError`. A second attempt clears the prior `providerError`.
- **Join panel room_full:** previously a no-op; now surfaces the existing `fullRoomObserve` copy in-panel (honest, and consistent with the rail's degrade-to-observe).
- **Gallery banner vs panel note (P2-10):** while the panel is mounted the gallery list (and its list-scoped error banner) is not rendered, so the in-panel note is the only visible failure surface — no double-notice. The stale list banner on panel-cancel is pre-existing and out of scope (noted in Risks).
- **Gallery loading + empty (P1-8):** during initial load `paged.page.length === 0` AND `loading` are both true → today both `LoadingNotice` and `EmptyState` render. The `!loading` guard makes exactly one show.
- **Doctrine edge:** none of the surfaced strings may imply a verdict, heat, popularity, or truth. Every string is a load/seat/connection fact. The strip message is generic ("Some of this room could not load") — it does not name what failed and cannot be read as a judgment.

---

## Test plan

All pure-model + hook tests use the established `renderHook` + mocked-`../src/lib/supabase` pattern from `__tests__/useMarkers.test.ts`. Full suite must stay green; `web:build` clean (no asset/require changes here, but run it because ArgumentRoom/App are touched).

### Pure model
- `__tests__/roomLoadErrorModel.test.ts` (NEW): zero errors → `{ visible:false }`; one error → visible + single `failedSources`; **two+ errors → `visible:true`, ONE message, `failedSources` in canonical order** (the "renders once" invariant at the model layer); message is stable regardless of count; ban-list scan of the emitted message.
- `__tests__/seatClaimModel.test.ts` (EXTEND): flip the two existing assertions (`unavailable`/`error` → `{ kind:'error', message }`); add `resolveJoinPanelFeedback` cases (claimed→joined; room_full→fullRoomObserve copy; error/unavailable→joinFailed); assert `joinFailed`/panel messages are ban-list clean (extend `seatClaimModel.doctrine.test.ts`).

### Per-hook (error in → error out)
For each of the 5 hooks: mock the terminal query to resolve `{ data: null, error: {...} }` and assert the result's `error` is the plain-language sentinel (never the raw code); mock success and assert `error === null`; assert the disabled/empty early return keeps `error === null`.
- `__tests__/useProofItems.test.tsx` (NEW — worst-case worked example)
- `__tests__/useMarkers.test.ts` (EXTEND — the file already documents "read error degrades to empty maps"; add the `error` assertion)
- `__tests__/useMoveMarks.readError.test.tsx` (NEW — read-path error field; assert it is **separate** from the write-path `moveMarkErrorFor`, which stays working)
- `__tests__/useChimeInContributions.test.tsx` (EXTEND)
- `__tests__/useGalleryMoveMarks.test.tsx` (NEW)

### Component / integration
- `__tests__/RoomLoadErrorStrip.test.tsx` (NEW): renders null when `!visible`; renders message + retry when visible; retry Pressable has role button + `accessibilityLabel` + ≥44 hitSlop; the container exposes `accessibilityLiveRegion`.
- `__tests__/argumentRoomLoadErrorStrip.test.tsx` (NEW — the acceptance integration): mock two room hooks to error simultaneously → assert **exactly one** `room-load-error-strip` in the tree (query-all length === 1, not per-card); assert the room still renders its posted moves (readable, not blocked); assert retry invokes the failed hooks' refetch. This is the **simulated-expired-session** proof, to the extent jest can drive it.
- `__tests__/ChimeInAffordance.test.tsx` (EXTEND): `note` prop renders a live-region note; absent note renders nothing extra; note text is ban-list clean.
- `__tests__/authScreenProviderRegion.test.tsx` (EXTEND): Google button press with `signInWithGoogle` mocked `{ ok:false, message }` → `ErrorNotice` shows the message; `{ ok:true }` → no error surfaced. (Keep the existing single-file `signInWithOAuth` source-guard green.)
- `__tests__/joinDebatePanelFailure.test.tsx` (NEW): `onJoin` resolving `{ joined:false, message }` → inline `ErrorNotice` renders; `{ joined:true }` → parent close path (no in-panel error). room_full → fullRoomObserve copy in-panel.
- `__tests__/conversationGalleryEmptyGuard.test.tsx` (NEW): `loading:true` + empty page → exactly one notice (LoadingNotice, no EmptyState); `loading:false` + empty → EmptyState only.
- App-level rail-join note: extend an existing App/room integration test (or add `__tests__/appRailJoinFailureNote.test.tsx`) asserting `effect.kind === 'error'` sets a live-region room note + calls `announceForAccessibility`.

### Doctrine ban-list
- Extend the relevant copy-doctrine scan (`gameCopy`/`seatClaimModel.doctrine`) to cover the three new copy blocks: no `winner/loser/correct/true/false/liar/dishonest/bad faith/heat/popular/…` token; no snake_case internal-code leak.

### Perf regression (LIFE-001 / META-001 rule)
- `pointLifecycleModel.test.ts` / `moveMetadataLedger.test.ts` wall-clock budgets are unrelated to this diff; if either flakes under full-suite parallel load, **re-run isolated** before attributing it to this branch (documented flake, per repo memory).

### Pinned boundaries
- `uxOneOneFiveReadOnlyBoundary.test.ts` + `uxOneOneSixReadOnlyBoundary.test.ts` stay green: `ArgumentRoom.tsx` keeps `ArgumentRoom` + `Props`; `App.tsx` keeps `/roomActive/` + `testID="app-tab-bar"`. No relaxation needed (edits are additive).

---

## Dependencies (cards / docs / files)

- Reads the existing write-path precedent `useMoveMarks.ts:171-188` + `BooleanFeedbackBar.tsx:151-176` (the error-surfacing house pattern this card generalizes).
- Reads `chimeInApi.ts` `CHIME_IN_ERROR_COPY` + `ChimeInApiResult.errorMessage` (already plain-language; consumed unchanged).
- Reads `ArgumentTreeScreen.tsx:278` (the `!loading` EmptyState template).
- Reads `App.tsx` `callbackRetryBanner` (~:1636) as the room-scoped live-region banner pattern for the join note.
- Assumes the `chime_in` / `proof_drawer` / `timestamp_rebuttals` / `move_marks` flags exist and thread as `enabled` props (they do — ASP is live 9/11). PR-B does not read any flag directly; it only surfaces errors on hooks that are already flag-gated at their mount.
- Does not block any known future card. Enables a follow-up telemetry card (failure-frequency counting) which is explicitly a non-goal here.

---

## Risks

- **The two intentional `seatClaimModel.test.ts` assertion flips** (`unavailable`/`error` → `{ kind:'error' }`) are the *only* pre-existing test changes. They are expected and documented — a reviewer seeing them should confirm they match the widened producer, not treat them as a regression.
- **JoinDebatePanel `onJoin` signature change** (`Promise<void>` → `Promise<JoinPanelFeedback>`): the only caller is the closure in `ConversationGalleryScreen.tsx:238`, updated in the same card. No other consumer (verified). Low risk, but it is a contract change, so the panel's own tests must move with it.
- **ArgumentRoom is a large soft-pinned file** (~3900 lines). The edits are additive and localized (four destructures, one memo, one mount, one note state), but a stray edit that drops the `ArgumentRoom`/`Props` tokens fails the boundary test. Keep edits inside the existing structure; do not reflow the `return`/`RoomBoardLayout` JSX (the `uxOneOneTwoChromeLayerRemovals` `indexOf` pins depend on col1-before-col2 source order).
- **`accessibilityLiveRegion` double-announce:** if the strip's message string changed on each render, screen readers would re-announce. The design guarantees a *stable* message (one constant, not derived from `failedSources`), so it announces once and stays quiet until cleared. Tests assert the message is constant.
- **Gallery-signal note noise:** `useGalleryMoveMarks` feeds only a heat-enrichment term; escalating its failure to the red list-error banner would falsely imply the room list failed. The design uses a *separate, quiet, non-blocking* note. See §Reconciliation — this is the one judgment call worth an explicit ruling.
- **Stale gallery list banner on panel-cancel:** pre-existing; a failed panel join sets `useDebates.error`, which shows on the list after cancel. Out of scope (PR-B adds the in-panel note; it does not rework the list banner's retry-retries-the-list quirk). Noted so the reviewer doesn't expect it fixed.
- **RN Web live-region reliability:** `accessibilityLiveRegion="polite"` maps to `aria-live` on web and `android:accessibilityLiveRegion` on Android; iOS VoiceOver relies on `announceForAccessibility` for dynamic changes. The room strip uses the live-region View (matches house pattern); the rail-join note *also* calls `announceForAccessibility` for iOS parity. This split is why the join note both renders a live region and announces.

---

## Out of scope

- No new telemetry / failure-frequency counting (a non-goal; that is a follow-up).
- No change to any hook's data-fetch path, query, RLS, or return *data* shape — only the error channel.
- No "fix" to `useMyCircles` (silent-by-design; census-listed only).
- No migration, Edge Function, flag, or deploy.
- No router/URL work, no retry backoff/limits, no offline queueing.
- No redesign of the gallery list-error banner's retry semantics (the "retry retries the LIST" quirk stays; only the panel gets in-panel feedback).
- No change to `signInWithGoogle.ts` (it already returns the message).
- No new dependency (RN primitives + existing `ErrorNotice`/`LoadingNotice`/live-region only).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels / score never blocks):** every surfaced string is a load/seat/connection fact ("Some of this room could not load", "We could not add you…", chime seat/visibility copy). No verdict token. The strip is non-blocking and never gates posting or reading. PASS.
- **§2 / §3 (heat / popularity):** no surfaced string references heat, trending, popularity, or consensus. `useGalleryMoveMarks` feeds a heat term, but its *error* copy ("Some room activity could not load") is a neutral load fact, not a heat/popularity claim. PASS.
- **§4 (AI limits):** no AI call added or touched. PASS.
- **§5 (engine sacred):** the pure models (`roomLoadErrorModel`, `seatClaimModel` additions) are side-effect-free, React-free, JSON-serializable in/out. No engine change. PASS.
- **§6 / §7 (secrets / no AI from app):** no secret, no service-role, no provider call. `signInWithGoogle` is the existing anon-client OAuth initiation, unchanged. PASS.
- **§8 (Supabase conventions):** no table, RLS, or migration touched. PASS.
- **§9 (plain language):** every new user-facing string lives in `gameCopy.ts` (`ROOM_LOAD_ERROR_COPY`, `SEAT_CLAIM_COPY.joinFailed`, `GALLERY_SIGNAL_ERROR_COPY`) and is ban-list-scanned; the hooks emit a fixed sentinel, never the raw supabase error object → no internal-code leak. Chime copy already routes through `CHIME_IN_ERROR_COPY`. PASS.
- **§10 (v1 scope):** no voting/search/push/public-API. Google is *existing* SSO (surfacing only), not new OAuth — see Cannot-proceed check. PASS.
- **accessibility-targets:** every notice has a live region; the room strip + join note announce once; retry controls carry `accessibilityRole="button"`, an `accessibilityLabel`, and ≥44 via `hitSlop`; `ErrorNotice` carries `role="alert"`; text is inside `<Text>`; color is not the only signal (the notice is text, not a color swatch). PASS.
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`Pressable`); no new dep; pure model in `*Model.ts` with no React import; the strip plugs into the existing `topBanner` region rather than rebuilding room chrome. PASS.

---

## Flag posture

**UNFLAGGED.** PR-B is a11y / honesty *conformance*, not a feature. A feature flag would let the silent-failure state persist for the flag-off cohort — i.e., it would keep shipping the exact defect the audit filed. The change is byte-identical for any room where no hook errors (flag-off hooks return `error = null`), so there is no cohort worth gating; the only observable difference is *when a real failure occurs*, and that difference is strictly "an honest, announced, dismissible notice appears." Consistent with prior conformance fixes (the `!loading` EmptyState guard, the BooleanFeedbackBar write-path note) landing unflagged.

---

## Reconciliation points (need an orchestrator ruling)

1. **`useGalleryMoveMarks` error surfacing (the one real judgment call).** The hook feeds only the engagement-lane dodge-chain *heat enrichment*; the primary gallery list is unaffected when it fails. Options: **(A, recommended)** add the `error` field *and* a quiet, non-blocking gallery-signal note (`GALLERY_SIGNAL_ERROR_COPY`) distinct from the red list-error banner — honest without falsely implying the list failed; **(B)** add the `error` field but render no visible surface (field exposed for testability + future use, gallery visually unchanged) — a softer reintroduction of "silent" that the card's spirit argues against. I designed for (A). Confirm (A) vs (B).
2. **Rail-join note: note-only vs note-with-retry.** The issue says "a room-level note." I designed a note + live region + `announceForAccessibility`, with the **rail itself as the retry surface** (re-tapping Join re-attempts) — no extra retry button, minimal state. If the orchestrator wants an explicit in-note "Try again" (mirroring the read-strip retry), that adds a remembered `lastJoinSide` + a retry Pressable (~8 more lines). Confirm minimal vs retry-in-note.
3. **Google failure copy source.** P1-4 threads `result.message`, which for a provider error is the raw Supabase `error.message` (consistent with how the existing email `authError` is shown). If the orchestrator wants Google failures mapped to a curated plain-language string instead of the raw provider message, that is a small addition to `mapAuthError`/a copy constant — but it diverges from the existing email-flow behavior. I designed for parity with the email flow (raw message). Confirm parity vs curated.

---

## Jest-provable vs RUNTIME-CHECK split

**Jest-provable (must be green before the card is done):**
- Each hook: error-in → error-out; success → `error = null`; disabled/empty → `error = null`.
- `deriveRoomLoadErrorStrip`: two+ failures → one stable message + canonically-ordered `failedSources` (the "renders once" invariant at the model layer).
- ArgumentRoom integration: two hooks error → exactly one `room-load-error-strip` in the tree; room still renders posted moves; retry fires the failed refetches.
- Live-region presence (`accessibilityLiveRegion` / `role="alert"`) on the strip, chime note, join note, ErrorNotice.
- `resolveJoinSideEffect` new `'error'` kind + App handler branch; `resolveJoinPanelFeedback` cases; the two intentional test flips.
- Gallery single-notice guard (`!loading`).
- Per-failure-branch: chime attach/retract failure → note; Google `!ok` → ErrorNotice; join-panel `!joined` → in-panel ErrorNotice.
- Ban-list scans of all new copy.
- Pinned-boundary suites green.

**RUNTIME-CHECK only (cannot be proven in jest; acceptance-time manual/deployed):**
- **Real expired-session degradation:** jest can simulate all-hooks-error and prove "one strip + room readable," but it cannot reproduce a genuine mid-room JWT expiry against the live backend. The deployed acceptance pass must confirm the room degrades *visibly* (one strip, announced) rather than silently.
- **Failure frequency** of each surface (how often `seats_full`/`room_private`/network actually fires in production) — no telemetry is added (non-goal); this stays a runtime observation.
- **`EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` is ON in the deployed env** (acceptance requires confirming the flag is live so the Google button — and thus its failure path — actually renders). Per the auth-deployment memory it is ON on `dev-cdiscourse.netlify.app`; the reviewer/operator confirms at acceptance.
- **VoiceOver / TalkBack** actual announcement of the live regions on real devices (jest asserts the props exist, not that the OS speaks them) — document as the standard a11y follow-up if not eyes-on before ship.

---

## Operator steps (if any)

None — pure code change. No `db push`, no `functions deploy`, no env var, no flag flip. The only operator-facing acceptance action is the RUNTIME-CHECK confirmation that `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` is ON in the deployed env (already true per memory) and the simulated-expired-session visual check.
