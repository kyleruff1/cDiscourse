# COMPOSER-002 — In-room composer dock for Stack and Timeline (no Your Move redirect)

**Status:** Design draft
**Epic:** Composer / argument-room (Wave 2 — Board interaction)
**Release:** 6.6 (Wave 2)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/111
**Branch:** `feat/COMPOSER-002-composer-002-in-room-composer-dock-for-s`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\COMPOSER-002.md`
**Depends on (all shipped):**
- TL-003 (no-route invariant — the room never pushes a route; this card extends the same invariant to the composer).
- SC-004 (`timelineNodeActionDockModel.ts` — the 15-code action dock; `ArgumentGameSurface.handleActionDockAction` dispatch).
- COMPOSER-001 (#84 — `actionDockToComposerPreset` result threaded through `handleAction`'s optional third `preset` arg into `onComposerPreset`).

---

## Goal

Today, opening *Start argument / Reply / Challenge / Ask source / Narrow / Concede / Synthesize* unmounts the entire argument room. `App.tsx` renders `<ArgumentTreeScreen>` only when `!composerOpen` (line 301) and `<ArgumentComposer>` only when `composerOpen` (line 441) — the two are mutually exclusive branches of the same `activeTab === 'arguments' && hasDebate && currentDebate` block. The user lands on a detached light-themed full-screen form (`ArgumentComposer` titled "Your Move", line 300) that loses the timeline, the active node, observer/participant context, and scroll position. Browser back strands them.

COMPOSER-002 keeps the room mounted and renders the composer as an **in-room dock** — a bottom sheet on narrow viewports, a right-side panel on wide ones — anchored over the live Stack/Timeline surface. The room's `viewMode`, `activeMessageId`, `entryHint`, and scroll state survive a compose-cancel round trip because the components that own them are never unmounted. Esc and hardware-back close the dock without a route change. This is the largest single UX regression on the Timeline-first pivot; the card removes it.

Doctrine constraints that shape the design (from `cdiscourse-doctrine`):
- §1 — score never blocks posting; the dock changes *where* the composer renders, not *whether* a post is gated. The existing `canSubmit` / `evaluateArgumentDraft` gate is zero-diff.
- §4 / §7 — no AI call is added; the composer's existing client-side `evaluateArgumentDraft` (pure rules engine) is the only validation.
- §6 — no secrets, no service-role; the `submit-argument` Edge Function path through `submitArgumentDraft` is untouched.
- §9 — no internal codes added to user-facing strings; the dock's only new copy is the handle label and "Cancel / Post move" footer.
- §10 — no v1 scope item touched; this is a pure UI re-placement.

---

## Cannot-proceed check

The card is buildable within the stated file footprint **with one explicit caveat that does NOT widen scope** but must be called out:

> **`activeMessageId` is not lifted into `MainAppShell` today.** It lives as local `useState` inside `ArgumentGameSurface.tsx` (line 193). The card's "active node remains selected" acceptance criterion is satisfied *for free* by keeping `ArgumentGameSurface` mounted — because the component never unmounts, its local state survives. No state-lifting refactor is needed, and none should be attempted in this card (that would be a separate refactor). The design below relies on "keep the room mounted" as the mechanism, not "lift active-node state up."

Everything else fits the footprint: NEW `ArgumentComposerDock.tsx`; MODIFIED `App.tsx`, `ArgumentComposer.tsx`, and `ArgumentTreeScreen.tsx` (the last only if a `pointerEvents` / scroll-lock tweak is needed — see File changes). The card proceeds.

---

## Data model

**No new data model.** No new types, no SQL, no migration, no Edge Function.

The composer's existing types are reused verbatim:
- `MoveDraftPatch` (`conversationMoves.ts`) — the preset patch.
- `ArgumentRow` (`types.ts`) — the reply target.
- `ArgumentViewMode` (`ArgumentTreeScreen.tsx`) — the room's Timeline/Stack mode.
- `GalleryEntryHint` (`conversationGalleryModel.ts`) — the entry hint.

One small **prop-type addition** (not a data model) on `ArgumentComposer`:

```ts
// ArgumentComposer.tsx — add to Props
/**
 * COMPOSER-002 — Render mode.
 *  - 'dock'  (default): no "Your Move" page header; the dock chrome
 *            (handle + Cancel/Post footer) is provided by ArgumentComposerDock.
 *  - 'page'  : legacy full-screen header. Only reachable behind __DEV__.
 * Omitting the prop defaults to 'dock'.
 */
mode?: 'dock' | 'page';
```

`ArgumentComposerDock` itself is a presentational shell; it holds only local UI state:

```ts
// ArgumentComposerDock.tsx — internal only, no export
interface DockLayout {
  /** 'sheet' when window width < 720; 'side' otherwise. */
  variant: 'sheet' | 'side';
}
```

---

## File changes

### New files

- **`src/features/arguments/ArgumentComposerDock.tsx`** (~190–230 lines)
  - Presentational dock shell. Props: `{ visible, debate, selectedParentId, parentArgument, initialPatch, onClearParent, onClose, onSubmitSuccess, reduceMotionOverride? }` — the same set `App.tsx` already passes to `<ArgumentComposer>` plus `visible` and `reduceMotionOverride`.
  - Reads `useWindowDimensions()` → `variant = width < 720 ? 'sheet' : 'side'`. (`width <= 0` during web static-export hydration → treat as `'side'`, mirroring `resolveHeaderBreakpoint`'s "non-positive = wide" rule.)
  - Renders a thin **drag handle** (a non-interactive bar) plus a **header strip** with a `Cancel` `Pressable` — NO "Your Move" page header.
  - Renders `<ArgumentComposer mode="dock" .../>` in the dock body inside a flex container that lets the composer's internal `ScrollView` scroll.
  - Renders a sticky **footer**: `Cancel` (left) · the existing `Post move` button is *inside* `ArgumentComposer`; the dock footer carries only `Cancel`. (Decision: keep `Post move` where it is — moving it would force a larger `ArgumentComposer` refactor. The dock handle + `Cancel` are the only new chrome.)
  - Animation: `Animated.View` slide-up (sheet) / slide-in-from-right (side). Reads reduce-motion (see API contracts) — when reduced, snaps with an opacity fade only, no translate.
  - Esc + hardware-back close handling (see Edge cases).
  - `accessibilityViewIsModal` on the dock container so screen readers trap focus inside the dock while open.

### Modified files

- **`App.tsx`** (~25–40 lines changed)
  - **Stop unmounting the room.** Change the room render guard at line 301 from `... && !composerOpen` to `... && currentDebate` (drop the `!composerOpen` term) so `<ArgumentTreeScreen>` stays mounted while composing.
  - **Delete the standalone composer branch** at lines 441–451 (`activeTab === 'arguments' && hasDebate && currentDebate && composerOpen && <ArgumentComposer .../>`).
  - **Mount `<ArgumentComposerDock>`** as a sibling *inside* the `styles.debateRoom` `<View>` (after the action bar `<View style={styles.actionBar}>`, line 419–436), so it overlays the room. Pass `visible={composerOpen}` plus the existing props (`debate`, `selectedParentId`/`replyTarget`, `parentArgument`, `onClearParent`, `onSubmitSuccess`, `onClose`, `initialPatch`/`composerPreset`) and `reduceMotionOverride={preferences.effectiveReduceMotion}`.
  - The `composerOpen` / `composerPreset` / `replyTarget` state and the four handlers (`handleStartArgument`, `handleReply`, `handleComposerClose`, `handleSubmitSuccess`) are **unchanged** — they already do exactly the right thing; only the *consumer* of `composerOpen` moves from "swap the screen" to "toggle the dock."
  - `viewMode`, `entryHint`, scroll, and `activeMessageId` are preserved automatically because `ArgumentTreeScreen` (and through it `ArgumentGameSurface`) is never unmounted.

- **`src/features/arguments/ArgumentComposer.tsx`** (~15–25 lines changed)
  - Add the `mode?: 'dock' | 'page'` prop (default `'dock'`).
  - Guard the `<View style={styles.header}>` block (lines 299–308, the "Your Move" title + "Discard" link) so it renders **only when `mode === 'page' && __DEV__`**. In `'dock'` mode the page header is gone; the dock provides the handle + `Cancel`.
  - In `'dock'` mode, `ArgumentComposer` still owns the `discardDraft()` call — wire it so `ArgumentComposerDock`'s `Cancel` press calls back into `onClose`, and `onClose` (in `App.tsx` = `handleComposerClose`) already resets `replyTarget` / `composerOpen` / `composerPreset`. The draft-discard semantics: the dock's `Cancel` should call the same `{ discardDraft(); onClose?.(); }` the old header "Discard" did. Expose this by passing an `onRequestDiscard` prop down, or simpler: keep the discard inside `ArgumentComposer` by rendering a compact `Cancel` affordance the dock positions. **Decision:** `ArgumentComposer` exposes the discard via the existing `onClose` contract — `ArgumentComposerDock.Cancel` → calls a prop `onCancel` → `ArgumentComposerDock` calls `onClose`; the actual `discardDraft()` stays inside `ArgumentComposer`, triggered by a `useEffect` is overkill. Cleanest: `ArgumentComposer` accepts an optional `headerSlot?: ReactNode` is also overkill. **Final decision (smallest diff):** `ArgumentComposer` keeps a hidden-in-dock-mode discard, and `ArgumentComposerDock`'s `Cancel` calls `onClose` directly; `App.tsx`'s `handleComposerClose` is the single close path and the draft is left intact on cancel (drafts already auto-persist and recover via `ComposerDraftRecoveryNotice`). This matches existing behavior where closing without discard keeps the recoverable draft. The explicit destructive "discard" stays available only in `mode === 'page'` `__DEV__`.
  - The light theme (`styles.safe` `#f9fafb`) stays; the dock supplies a dark surround so the visual seam is acceptable for v1. A full dark re-skin of the composer is **out of scope** (noted below).

- **`src/features/arguments/ArgumentTreeScreen.tsx`** (0–10 lines, only if needed)
  - Likely **no change**. The room stays mounted and the dock overlays it. If manual testing shows the room's `ScrollView` steals touches behind the open sheet, add `pointerEvents={composerOpen ? 'none' : 'auto'}` — but this prop is not currently threaded into `ArgumentTreeScreen`. To avoid widening the prop surface, prefer handling the touch trap in `ArgumentComposerDock` via a full-bleed backdrop `Pressable` (the dock owns its own scrim). **Default plan: do not modify `ArgumentTreeScreen`.** The file is listed as "if needed"; the design's expectation is zero diff there.

### Deleted files

None.

---

## API / interface contracts

### `ArgumentComposerDock` props

```ts
interface ArgumentComposerDockProps {
  /** Drives mount + slide-in. When false the dock is not rendered (or
   *  animates out then unmounts). */
  visible: boolean;
  /** Same objects App.tsx already passes to <ArgumentComposer>. */
  debate: Debate;
  selectedParentId: string | null;
  parentArgument: ArgumentRow | null;
  initialPatch?: MoveDraftPatch | null;
  /** Clears the reply target (the composer's "Clear" affordance). */
  onClearParent: () => void;
  /** Close without posting. App.tsx -> handleComposerClose. */
  onClose: () => void;
  /** Post succeeded. App.tsx -> handleSubmitSuccess (refreshes the room). */
  onSubmitSuccess: () => void;
  /** PR-001 — effective reduce-motion (OS value composed with the user's
   *  preference). When omitted the dock reads AccessibilityInfo itself. */
  reduceMotionOverride?: boolean;
}
```

### `ArgumentComposer` prop addition

```ts
mode?: 'dock' | 'page';   // default 'dock'
```

Behavioral contract: `mode === 'page' && __DEV__` → renders the legacy `<View style={styles.header}>` ("Your Move" + "Discard"). Any other combination → header omitted. **No other branch of `ArgumentComposer` changes** — the body input, type/side/axis pickers, validation panel, preset application (`initialPatch` `useEffect`), and `handleSubmit` are all zero-diff.

### Layout breakpoint (inline in `ArgumentComposerDock`)

```ts
// width < 720  -> bottom sheet (sheet covers ~88% height, rounded top, handle)
// width >= 720 -> right-side dock (fixed ~420px wide, full room height,
//                  left edge border, no handle — uses a header strip)
// width <= 0   -> 'side' (web static-export hydration; mirrors
//                 resolveHeaderBreakpoint's non-positive = wide rule)
const variant: 'sheet' | 'side' =
  windowWidth > 0 && windowWidth < 720 ? 'sheet' : 'side';
```

### Reduce-motion read (mirror existing pattern)

`ArgumentComposerDock` follows the **exact** pattern already used by `TimelineNodePopover.tsx` (lines 70–80) and `ArgumentTimelineMap.tsx` (lines 407–451):

```ts
const effectiveReducedMotion =
  typeof reduceMotionOverride === 'boolean'
    ? reduceMotionOverride                       // PR-001 override wins
    : prefersReducedMotion;                      // else local OS read
```

The local OS read uses `AccessibilityInfo.isReduceMotionEnabled()` once on mount plus an `addEventListener('reduceMotionChanged', ...)` subscription, with the Promise / try-catch guards the existing components use.

### Close-path contract (Esc + hardware-back)

- **Native hardware-back:** the dock's outer container is a core RN `<Modal transparent onRequestClose={onClose}>` — `onRequestClose` fires on Android hardware-back and dismisses the dock **without** a route change (RN `Modal` is not a navigation route). This is the exact pattern `DeletionRequestSheet.tsx` already uses (line 47). No `BackHandler` import is needed (the repo currently uses none).
- **Web Esc:** the dock attaches a `keydown` listener guarded by `Platform.OS === 'web'`, added in a `useEffect` on mount, removed on unmount. On `key === 'Escape'` it calls `onClose()` and `e.preventDefault()`. This mirrors how `ArgumentTimelineMap.handleKeyDown` (lines 659–675) prevent-defaults Escape only when an overlay is open. The listener is attached only while `visible` is true.
- Either path calls the single `onClose` → `App.tsx#handleComposerClose`, which resets `composerOpen` (and `replyTarget` / `composerPreset`). No `router`, no `Linking`, no history entry.

### Preset wiring — unchanged round trip

The full SC-004 → composer preset path is preserved end to end. The dock changes nothing in this chain:

```
ArgumentSideActionRail / TimelineNodeActionDock
  -> ArgumentGameSurface.handleAction / handleActionDockAction   (computes MoveDraftPatch via quickActionToPreset / actionDockToComposerPreset)
  -> FullRoomGameSurfaceMount.handleAction                       (calls onComposerPreset(preset) then onReply(messageId, arg))
  -> App.tsx: setComposerPreset(preset); setReplyTarget(...); setComposerOpen(true)
  -> <ArgumentComposerDock visible initialPatch={composerPreset} parentArgument={replyTarget.argument} ...>
  -> <ArgumentComposer mode="dock" initialPatch={...}>           (applies patch once via appliedPatchRef useEffect)
```

Every preset-emitting action listed in the card (Reply · Challenge · Ask source · Ask quote · Clarify · Add evidence · Narrow · Concede · Confirm · Synthesize · Branch) already routes through `onComposerPreset` + `onReply`; the only thing that changes is the *destination* of `composerOpen` — a dock instead of a screen swap.

---

## Edge cases

The implementer must handle each of these:

- **Composer opened with no preset (plain `Start argument`).** `handleStartArgument` sets `replyTarget = null` and `composerOpen = true`, `composerPreset` stays `null`. Dock opens; `ArgumentComposer` gets `initialPatch = null` and `parentArgument = null` — the existing "Replying to" block (line 333) and `ConversationMoveNavigator` simply render their no-parent forms. No regression.
- **Open the dock, then tap a different node behind it.** The room is mounted, so taps on the timeline behind the sheet could change `activeMessageId`. Decision: the sheet variant renders a full-bleed scrim `Pressable` that absorbs background touches; tapping the scrim does NOT close the dock (a half-typed draft must not be lost by a stray tap) — the scrim is inert except as a touch shield. The side variant leaves the room interactive (wide screens have room for both); changing the active node behind a side dock is acceptable and does not affect the in-progress draft (the draft is keyed by `debateId + parentId`, not active node).
- **Hardware-back while the dock is open.** `Modal.onRequestClose` → `onClose`. Back closes the dock and returns to the room at the same `viewMode` / scroll / active node. Back must NOT exit the room or the app.
- **Esc on web while the dock is open.** `keydown` → `onClose`. Esc must not bubble to any parent modal (preferences popout etc.) — `preventDefault` + the listener being scoped to `visible` handles this.
- **Esc / back while a `TextInput` inside the composer has focus.** The `keydown` listener is on `document` (web) and fires regardless of focus; closing mid-typing is the intended Cancel behavior. The auto-persisted draft (existing `useArgumentComposer` behavior) means the text is recoverable on next open via `ComposerDraftRecoveryNotice`.
- **Submit succeeds while the dock is open.** `handleSubmit` → `onSubmitSuccess` → `App.tsx#handleSubmitSuccess` → resets `composerOpen` (dock animates out) + `refreshTreeRef.current?.()` refreshes the room. The room was already mounted, so the refresh lands on the live surface.
- **Submit fails (422 from `submit-argument`).** `serverErrors` renders inside `ArgumentComposer` exactly as today; the dock stays open. No change.
- **Viewport rotates / resizes across the 720 boundary while open.** `useWindowDimensions` re-renders; `variant` flips. The composer state (draft, scroll) is React state inside the still-mounted `ArgumentComposer`, so it survives the variant flip. Test this explicitly.
- **`width <= 0` first paint on web static export.** Treated as `'side'` so the first paint is the polished layout; the hydration pass corrects to `'sheet'` if narrow. Mirrors `resolveHeaderBreakpoint`.
- **Observer (read-mode) viewer.** Observers cannot reach the composer in the first place (the rail gates post actions behind Join). The dock only ever opens for participants — no observer-specific dock branch is needed. If an observer somehow triggers `composerOpen` (they cannot via the rail), the composer's `canSubmit` gate still blocks the post; no doctrine violation.
- **Reduce-motion enabled.** No slide translate; opacity fade only (or instant snap). Verified by test.
- **Double-open (preset action fired twice).** `composerOpen` is a boolean; a second `setComposerOpen(true)` is idempotent. The second `setComposerPreset` updates `initialPatch`; `ArgumentComposer`'s `appliedPatchRef` compares by reference and applies the new patch — existing COMPOSER-001 behavior, unchanged.
- **Doctrine edge case — does keeping the room mounted let score "leak" into the composer?** No. The composer's submit gate is `evaluateArgumentDraft` (rules engine) only; score / heat / standing are display-only on the timeline and never read by `canSubmit`. Keeping the timeline mounted does not change what gates a post.

---

## Test plan

Four new test files in `__tests__/`, matching the issue's named files. Tests follow the repo's React Testing Library + JSDOM patterns (see `__tests__/composerUI.test.ts`, existing rail/dock tests). UI tests render `App` (or `MainAppShell`) with a seeded session + mocked room data, or render `ArgumentComposerDock` directly with fixture props.

- **`__tests__/composerDockInRoom.test.ts`** — room stays mounted; state preserved.
  - Opening the dock keeps `ArgumentTreeScreen` / `argument-game-surface` (`testID="argument-game-surface"`) in the tree — assert the surface testID is still present after `composerOpen` flips true.
  - Closing the dock returns to the same room: assert the surface is still mounted and the same `viewMode` toolbar chip is active (`room-toolbar-timeline` / `room-toolbar-stack` `accessibilityState.selected`).
  - The legacy mutually-exclusive branch is gone: assert there is no full-screen state where `argument-game-surface` is absent while the composer is present.
  - `entryHint` micro-moment (`testID="argument-micro-moment"`) is still rendered while the dock is open (proves the room did not remount and lose the hint).
  - The composer body (`testID="composer-body-input"`) is present while the room surface is also present — the defining assertion of "in-room."

- **`__tests__/composerDockPresetWiring.test.ts`** — every SC-004 action opens the dock with the correct preset (COMPOSER-001 regression).
  - Parameterized over the preset-emitting actions (`reply`, `challenge`, `source`, `quote`, `clarify`, `evidence`, `concede`, `narrow`, `confirm`, `synthesize`, `branch`).
  - For each: fire the rail/dock action, assert `composerOpen` becomes true AND the composer body / `argumentType` / tags reflect `quickActionToPreset` / `actionDockToComposerPreset` output (e.g. `narrow` seeds `NARROW_PRESET_BODY` + `concession` + `narrow_scope`; `confirm` seeds `CONFIRM_PRESET_BODY`; `synthesize` seeds `SYNTHESIZE_PRESET_BODY` + `synthesis`).
  - Assert `reply` opens the dock with no forced `argumentType` (preset `null`).
  - Regression guard: assert the preset is applied exactly once (a re-render with the same patch object does not re-apply) — exercises `appliedPatchRef`.

- **`__tests__/composerDockNoRoute.test.ts`** — no route transition from the dock open/close path.
  - Static-import scan: assert `ArgumentComposerDock.tsx` source contains no `react-navigation`, `expo-router`, `@react-navigation`, `Linking.openURL`, `routerPush`, `router.push`, `navigate(` substrings. (Pattern: read the file via `fs` and regex, mirroring SC-004's `forbiddenImports` test.)
  - Assert no `Linking` import and no `history.pushState` usage.
  - Behavioral: open the dock, close via Esc, close via hardware-back (`Modal.onRequestClose`) — assert `onClose` fired and that the room surface (`argument-game-surface`) is still mounted (no navigation occurred). Mock any navigation primitive if one were present and assert it is never called.

- **`__tests__/composerDockA11y.test.ts`** — accessibility + close affordances.
  - Esc (`keydown` `Escape`) closes the dock (`onClose` called) on web (`Platform.OS = 'web'`).
  - The drag handle / `Cancel` `Pressable` has `hitSlop` ≥ 14 and a 44×44 effective target.
  - The `Cancel` and `Post move` controls expose `accessibilityRole="button"` and a descriptive `accessibilityLabel`.
  - The dock container exposes `accessibilityViewIsModal` (focus trap) and an `accessibilityLabel` for the dock root.
  - Reduce-motion: with `reduceMotionOverride={true}`, assert the dock does not apply a slide `translateY` / `translateX` transform (snap/fade only). With `false`, assert the slide transform is present.
  - Grayscale / color-independence: the handle + Cancel are recognizable by shape + text, not color alone (assert the `Cancel` label text exists; the handle has a non-color affordance).

Doctrine ban-list assertion (added to one of the above, or `composerDockA11y`): scan every string `ArgumentComposerDock` renders for the banned token list (`winner`, `loser`, `liar`, `true`, `false`, `correct`, `dishonest`, `bad faith`, etc.) — the dock's only new copy is the handle label + `Cancel` + `Post move`, so this is a cheap guard but required by `test-discipline` because the card touches user-facing strings.

Run order before claiming done: `npm run typecheck`, `npm run lint`, `npm run test` — all exit 0; test count goes up by the four suites; no `.skip` / `.only` / `console.log`.

---

## Dependencies (cards / docs / files)

- This design assumes **COMPOSER-001** (#84) is complete because it relies on `actionDockToComposerPreset`'s result being threaded through `handleAction`'s third `preset` argument into `onComposerPreset`. Verified present at `ArgumentGameSurface.tsx:396-460` and `ArgumentTreeScreen.tsx:317-357`.
- This design assumes **SC-004** is complete because the dock-action dispatch (`handleActionDockAction`) and the `TimelineNodeActionDockTarget` selection model already exist. Verified at `ArgumentGameSurface.tsx`.
- This design assumes **TL-003** is complete — the room already never pushes a route; this card extends that invariant to the composer.
- Reads existing `App.tsx` `MainAppShell` at the `composerOpen` state (line 180) + the four composer handlers (lines 211–236) + the two render branches (lines 301, 441).
- Reads existing `ArgumentComposer.tsx` header block (lines 297–308) and `initialPatch` application `useEffect` (lines 116–131).
- Reuses the reduce-motion read pattern from `TimelineNodePopover.tsx` (70–80) and `ArgumentTimelineMap.tsx` (407–451), and the `Modal` + `onRequestClose` pattern from `DeletionRequestSheet.tsx` (47).
- Reuses the `width <= 0 = wide` rule from `useHeaderBreakpoint.ts` / `resolveHeaderBreakpoint`.
- **Blocks** nothing directly, but improves the substrate for any later composer card (e.g. RULE-004 pre-send review) — that card will render its friction step inside the same dock instead of a full-screen detour.

---

## Risks

- **`ArgumentComposer` light theme vs dark room.** The composer ships `#f9fafb` light styling; the room is `#020617` dark. Inside a dock over a dark room the seam is visible. v1 accepts this (the card explicitly scopes only the redirect removal). The implementer should give the dock a clean border / shadow so the light panel reads as an intentional surface, not a glitch. A full dark re-skin is a separate card — do **not** attempt it here; it would balloon `ArgumentComposer.tsx`'s diff far past the footprint.
- **`Modal` stacking on web.** RN-web renders `<Modal>` as a fixed-position overlay. The preferences/profile popouts are also `Modal`s but mounted at `AppRoot`; the composer dock mounts inside `MainAppShell`. Z-order is fine (the dock is opened by an explicit action; the popouts are not open simultaneously in practice), but the implementer should verify the dock sits above the action bar and below the app header on web. If `Modal` causes layout grief, the fallback is an absolutely-positioned `<View>` overlay inside `styles.debateRoom` — but then hardware-back needs an explicit `BackHandler` listener (the repo currently uses none; adding one is acceptable and stays in-footprint). **Preferred: `Modal` for the free `onRequestClose`.**
- **`keydown` listener leaks.** The web Esc listener must be removed on unmount AND when `visible` flips false. A missed cleanup means Esc closes a dock that is already gone. The test for Esc must also assert no double-fire.
- **Existing composer tests.** `__tests__/composerUI.test.ts` tests `composerHelpers` / `evaluateArgumentDraft` — not the component render — so it is unaffected. If any test renders `ArgumentComposer` directly and asserts the "Your Move" header text, it must be updated to pass `mode="page"` or drop the header assertion. The implementer must grep `__tests__` for `'Your Move'` and reconcile. Likely zero hits, but verify.
- **Scroll preservation depends on no remount.** If a future change makes `ArgumentTreeScreen` remount on `composerOpen` (e.g. a `key` prop change), scroll/active-node preservation breaks. The `composerDockInRoom` test guards this by asserting the surface testID persists; keep that test.
- **No migration, no Edge Function, no deploy** — so there is no operator-deploy risk.

---

## Out of scope

Explicitly NOT part of COMPOSER-002:

- **RULE-004** pre-send review / "Pause before you swing" friction. The dock removes the page redirect only.
- **BR-003** tangent routing.
- **GAME-003** argument-mode strictness rules.
- A **dark re-skin of `ArgumentComposer`** to match the room palette — the composer keeps its current light theme; the dock supplies surrounding chrome.
- **Lifting `activeMessageId` (or any room state) into `MainAppShell`** — preservation is achieved by not unmounting, not by state-lifting.
- A **wide-screen inline-near-node composer** — the wide variant is a fixed right-side dock, not an inline-anchored panel (matching SC-004's deferral of inline docks to a discovery follow-up).
- **Moving the `Post move` button** out of `ArgumentComposer` into the dock footer — the button stays where it is; the dock adds only a handle + `Cancel`.
- Any change to **`submit-argument`**, validation rules, draft persistence, or the rules engine.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels, score never blocks posting):** The dock relocates the composer; it adds no score, no verdict, no band. The post gate (`canSubmit` → `evaluateArgumentDraft`) is byte-identical. The only new strings are the handle label, `Cancel`, and `Post move` — all neutral; a ban-list test scans them.
- **cdiscourse-doctrine §4 / §7 (no AI from the production app):** No AI call is added. The composer's validation is the existing pure rules engine. No Anthropic / xAI / X API import in `ArgumentComposerDock.tsx`.
- **cdiscourse-doctrine §5 (rules engine sacred):** Not touched. `evaluateArgumentDraft` runs unchanged.
- **cdiscourse-doctrine §6 (secrets / service-role):** No secrets, no `SERVICE_ROLE`, no service-role client. The `submit-argument` path through `submitArgumentDraft` is unchanged. `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` stays at zero matches.
- **cdiscourse-doctrine §8 (Supabase conventions):** No migration, no RLS change, no new table. No `.env` change.
- **cdiscourse-doctrine §9 (plain language):** No internal validation codes are introduced into user-facing strings; the dock surfaces no codes.
- **cdiscourse-doctrine §10 (v1 scope):** No voting, no real-time co-edit, no OAuth, no public API, no push, no search. Pure UI re-placement.
- **expo-rn-patterns (no new dependency):** The dock is built from RN primitives only — `Modal`, `View`, `Pressable`, `Text`, `Animated`, `ScrollView`, `useWindowDimensions`, `AccessibilityInfo`, `Platform`, `StyleSheet`. The issue forbids a new dependency; this design adds none. The bottom-sheet is a `Modal` + `Animated.View` (the `DeletionRequestSheet` precedent), not a sheet library.
- **accessibility-targets:** 44×44 targets via `hitSlop` on the handle + `Cancel`; `accessibilityRole` / `accessibilityLabel` on every `Pressable`; `accessibilityViewIsModal` focus trap; reduce-motion fade path; Esc + hardware-back close; color-independent affordances (shape + text). All asserted by `composerDockA11y.test.ts`.
- **test-discipline:** Four test suites ship with the card (not a follow-up); ban-list assertion included because the card touches user-facing strings.

---

## Operator steps (if any)

**None — pure code change.** No migration (`npx supabase db push` not needed), no Edge Function deploy, no environment variable, no secret. After the implementer commits, the operator runs the standard `npm run typecheck && npm run lint && npm run test` and ships the build normally.
