# A11Y-PR0 — Overlay a11y cluster: focus mgmt + Esc gating + corridor nav + sheet containment (RN-web)

**Status:** Design draft
**Epic:** Accessibility / overlay grammar (post-ASP UX remediation; sibling of PR-001…IX-003 a11y epic)
**Release:** Post-ASP UX remediation (2026-07 UX continuity audit, PR-0 — the audit's unanimous top-severity cluster)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/913
**Base:** `da32f56b` (main) · branch `feat/a11y-pr0-overlay`

---

## Goal (one paragraph)

CDiscourse ships **no keyboard/overlay grammar on its live web platform (RN-web / Netlify)**. Grep-confirmed in this worktree: **zero `.focus(` calls anywhere in `src`** (only `autoFocus` on two account TextInputs and read-only `document.activeElement` probes). Every "focus trap" the codebase claims rests on `accessibilityViewIsModal`, which is iOS-only and is **not** `aria-modal` on RN-web — so keyboard and screen-reader users can Tab behind every modal, one Escape can collapse two layers at once, the demo corridor traps the primary nav, and two sheets let background shortcuts mutate room state underneath them. This card lands a **web-only overlay-a11y layer** (initial focus, Tab containment, focus restore, single-Esc arbitration) plus three targeted containment fixes, adopted across the live overlay family. It changes **no** overlay content, no room/seat/chime-in/submission semantics, and no deterministic gate. **Native behavior stays byte-unchanged** — every new primitive is `Platform.OS === 'web'`-guarded and no-ops on native (VoiceOver/TalkBack use the rotor, not Tab). Doctrine anchors: `accessibility-targets` (keyboard nav §"Keyboard navigation (IX-003)" — Esc closes popover and returns focus to trigger; Tab order matches reading order), `expo-rn-patterns` (web-guard-with-graceful-native-default, RN primitives only, no new dep), `cdiscourse-doctrine` (UI-only; no truth labels, no score gate, no service-role, no AI call).

This is a **conformance fix on already-shipped live surfaces**, not a feature. Recommended posture: **UNFLAGGED** (see §"Flag posture").

---

## Verified-in-repo findings (this worktree, not the audit root)

The audit ran against `origin/main` from a different worktree (`wt-voice-adr`); every claim below was re-verified against `da32f56b` in `C:/Users/kyler/cdiscourse/wt-a11y-pr0`. The audit's plan doc (`docs/audits/ux-continuity-2026-07/UX_ACTION_PLAN.md`) lives on branch `docs/ux-continuity-audit-2026-07` and is **not present** on this base — the issue body is the source of record.

| Sub-item | Claim | Verified site (this worktree) |
|---|---|---|
| P0-3a | Zero programmatic focus mgmt | `git grep '\.focus('` over `src/**` + `App.tsx` = **0 hits**. `Popout.tsx:203-209,241` and `ArgumentComposerDock.tsx:519-524,546` set only `accessibilityViewIsModal` (iOS-only). |
| P0-3b | Esc double-dismiss | `composerKeyboardModel.ts:103-104` returns `{type:'close'}` unconditionally; dock listener `ArgumentComposerDock.tsx:296-335` + Popout listener `Popout.tsx:166-180` are BOTH `document`-level bubble-phase, `preventDefault` only (no `stopPropagation`). Dock registers first (earlier mount) → fires first → `onClose()` closes the whole dock before the popout's listener runs. `PreSendReviewSheet.tsx:203-215` inert scrim has **no** Esc listener, so its Esc is swallowed by the dock → whole-dock close destroys the draft the scrim protects. |
| P0-3c | Corridor traps nav | `App.tsx:1028-1044` `handlePrimaryNav` never clears `demoCorridorOpen`. Mount `:1189` (corridor), `:1196` (About guarded `!demoCorridorOpen`), but Account `:1673` / Admin `:1677` / Debug `:1681` are guarded **only** by `!aboutOpen` → they co-render with the corridor. Secondary tab bar `:1162` calls bare `setTab(t)` (no corridor clear). |
| P0-3d | Two sheets uncontained | `MarkerPhrasePickerSheet.tsx` (whole file) and `RequestReviewComposer.tsx` (whole file) are plain absolute `<View>` overlays — **not** `<Modal>`: no `onRequestClose`/hardware-back, no Esc, Cancel-only dismiss, no dismissing backdrop. Both excluded from `hasOpenMenu` (`ArgumentRoom.tsx:2784,2852` compute `boardActVisible || inspectVisible || goVisible` inline) → A/I/G + arrow nav fire behind the open sheet. |

**Reuse/precedent found (adopt, do not fork):**
- `src/features/arguments/composer/useComposerFocusContext.ts` — the house web-focus precedent: `Platform.OS !== 'web'` no-op, `document.activeElement`, `container.contains(activeEl)`, `registerContainer(el: HTMLElement|null)` ref-callback, and the RN-web fact that a `View`/`Pressable` ref **is** the DOM node (`ArgumentComposerDock.tsx:598` casts `el as unknown as HTMLElement`). The new hook mirrors this exactly.
- `src/features/nodeAnnotations/annotationFocusBoundary.ts` — pure-TS `resolveFocusBoundaryKeyEffect` / `applyFocusBoundaryEffect` (arrow-key focus model with wrap). The new pure focus-trap model follows this shape.
- `src/features/evidence/AddAnnotationSheet.tsx:93-105,117` — the house **containment** precedent: `<Modal>` + `accessibilityViewIsModal` + `onRequestClose` + web `keydown` Escape listener. Marker/Request are refactored to match it. (AddAnnotationSheet already has containment; it lacks only focus-trap — hence it is the deferred P0-3a "tail", see §"Focus-utility adoption scope".)

---

## Data model

**No new persisted data model. No DB, no migration, no Edge, no RLS.** All new state is in-memory / module-local.

New pure-TS types (client-only, JSON-serializable, no React/Supabase imports):

```ts
// src/features/a11y/overlayFocusTrapModel.ts

/** CSS selector for tab-reachable descendants on RN-web (rendered DOM). */
export const FOCUSABLE_SELECTOR: string;

/** What a Tab keypress at a boundary should do inside a trap. */
export type FocusTrapEffect =
  | { type: 'pass' }          // interior move — let the browser handle it
  | { type: 'wrap_to_first' } // Tab on the last element → focus first
  | { type: 'wrap_to_last' }; // Shift+Tab on the first element → focus last

export interface FocusTrapInput {
  key: string;        // event.key
  shiftKey: boolean;
  atFirst: boolean;   // activeElement === first focusable in scope
  atLast: boolean;    // activeElement === last focusable in scope
}

/** Pure. Returns 'pass' for any non-Tab key or interior Tab. */
export function resolveFocusTrapEffect(input: FocusTrapInput): FocusTrapEffect;
```

```ts
// src/features/a11y/overlayLayerStack.ts  (module-level LIFO singleton + pure reducer twin)

export type OverlayLayerId = string;

// Pure reducer core (exported for unit tests — no side effects):
export function pushLayer(stack: readonly OverlayLayerId[], id: OverlayLayerId): OverlayLayerId[];
export function removeLayer(stack: readonly OverlayLayerId[], id: OverlayLayerId): OverlayLayerId[];
export function topOf(stack: readonly OverlayLayerId[]): OverlayLayerId | null;

// Singleton façade over a module-local `let stack: OverlayLayerId[]`:
export function registerLayer(id: OverlayLayerId): void;   // push (idempotent per id)
export function unregisterLayer(id: OverlayLayerId): void;  // remove
export function isTopmost(id: OverlayLayerId): boolean;     // topOf(stack) === id
export function hasLayers(): boolean;
export function depth(): number;
export function subscribe(listener: () => void): () => void; // notify on change
export function __resetOverlayLayerStack(): void;            // test-only
```

```ts
// src/features/a11y/useOverlayA11y.ts  (web-only React hook; native = stable no-op)

export interface UseOverlayA11yOptions {
  /** Overlay is mounted+shown. When false the hook tears down and no-ops. */
  visible: boolean;
  /** Called on Escape ONLY when this layer is topmost (skipped if manageEsc:false). */
  onDismiss?: () => void;
  /** Own Escape dismissal. Default true. The dock passes false (its composer
   *  keydown handler owns Esc semantics; see §API). */
  manageEsc?: boolean;
  /** Trap Tab + set initial focus + restore on unmount. Default true. */
  manageFocus?: boolean;
  /** Stable id for the layer stack. Default: an auto-generated per-hook id. */
  layerId?: string;
}

export interface UseOverlayA11yResult {
  /** Attach to the overlay's panel View (ref-callback; el is the DOM node on web). */
  registerContainer: (el: HTMLElement | null) => void;
  /** Live read: is this layer the topmost overlay? (Dock reads this in its keydown guard.) */
  isTopmost: () => boolean;
}

export function useOverlayA11y(options: UseOverlayA11yOptions): UseOverlayA11yResult;
```

```ts
// src/features/arguments/room/roomOpenMenuModel.ts  (new tiny pure helper)
export interface RoomOpenMenuInput {
  boardActVisible: boolean;
  inspectVisible: boolean;
  goVisible: boolean;
  markerPickerOpen: boolean;   // markerPickerTargetId !== null
  requestReviewOpen: boolean;  // requestReviewTarget !== null
}
/** Pure. True iff any board menu OR containment sheet is open. */
export function computeRoomHasOpenMenu(input: RoomOpenMenuInput): boolean;
```

Additive field on the existing nav-transition model (pure, total):

```ts
// src/features/navigation/appPrimaryNavModel.ts — PrimaryNavTransition gains:
  /** Every primary nav item leaves the demo corridor (mirrors deselectRoom). */
  clearDemoCorridor: boolean; // always true, all 5 sections
```

---

## File changes

### New files (all under a new `src/features/a11y/`)
- `src/features/a11y/overlayFocusTrapModel.ts` — pure Tab-trap resolver + `FOCUSABLE_SELECTOR`. ~70 lines.
- `src/features/a11y/overlayLayerStack.ts` — pure reducer + module-level LIFO singleton + `subscribe`. ~95 lines.
- `src/features/a11y/useOverlayA11y.ts` — the web-only hook (focus trap + focus restore + stack registration + optional Esc). Native no-op. ~135 lines.
- `src/features/a11y/index.ts` — barrel export. ~10 lines.
- `src/features/arguments/room/roomOpenMenuModel.ts` — `computeRoomHasOpenMenu`. ~20 lines.

### Modified — pinned files (see §"Pinned-file strategy" for the per-file justification)
- `src/features/arguments/oneBox/Popout.tsx` **(uxOneOneFive zero-diff → RELAX)** — attach `registerContainer` to the panel `Animated.View`; replace the inline Esc `useEffect` (`:166-180`) with the hook's Esc (topmost-gated); `manageEsc:true`. Net ~+12 / −10 lines. Every prop, testID (`one-box-popout`, `-panel`, `-close`, `-scrim`), `POPOUT_FLASH_DURATION_MS`, and the UX-001.4 override behavior unchanged.
- `src/features/arguments/ArgumentComposerDock.tsx` **(uxOneOneFive zero-diff → RELAX)** — call `useOverlayA11y({ visible, manageEsc:false })`, attach `registerContainer` to `argument-composer-dock-panel`, and add one guard line at the top of the keydown handler (`:300`): `if (!isTopmost()) return;` so the composer's Cmd+Enter / Cmd+K / Esc are suppressed while any overlay is above. Net ~+10 lines. `ArgumentComposerDock` export, all testIDs, the `registerContainer` composer-body wiring (`:598`), and the RULE-004 presend flow unchanged.

### Modified — unpinned overlay files
- `src/features/arguments/PreSendReviewSheet.tsx` — `useOverlayA11y({ visible, onDismiss: onBackToEditing, manageEsc:true })`; attach `registerContainer` to `pre-send-review-panel`. Esc now returns to editing (single layer) and **preserves the inert scrim** (scrim still `onPress={()=>undefined}`). ~+12 lines.
- `src/features/arguments/markers/MarkerPhrasePickerSheet.tsx` — wrap in core `<Modal transparent animationType="none" onRequestClose={onCancel}>` (mirrors AddAnnotationSheet → native hardware-back); make the backdrop a dismissing `<Pressable onPress={onCancel}>`; `useOverlayA11y({ visible:true, onDismiss:onCancel })` on the sheet panel. ~+22 lines.
- `src/features/requestReview/RequestReviewComposer.tsx` — same treatment: core `<Modal onRequestClose={onCancel}>`, dismissing backdrop `<Pressable>`, `useOverlayA11y`. ~+22 lines.
- `src/features/arguments/room/ArgumentRoom.tsx` **(uxOneOneSix soft-pin `ArgumentRoom`,`Props`)** — import `computeRoomHasOpenMenu`; replace the two inline `hasOpenMenu = boardActVisible || inspectVisible || goVisible` (`:2784`, `:2852`) with the helper, folding in `markerPickerTargetId !== null` and `requestReviewTarget !== null`. ~+6 lines net. Tokens `ArgumentRoom`, `Props` preserved.
- `App.tsx` **(uxOneOneSix soft-pin `/roomActive/`, `/testID="app-tab-bar"/`)** — (1) in `handlePrimaryNav` (`:1038-1041`) add `if (t.clearDemoCorridor) setDemoCorridorOpen(false);`; (2) tab bar `onPress` (`:1162`) → `{ setDemoCorridorOpen(false); setTab(t); }`; (3) gate Account/Admin/Debug mounts (`:1673`, `:1677`, `:1681`) with `!demoCorridorOpen &&` (mirror the About guard `:1196`). ~+5 lines. Both pinned tokens preserved.
- `src/features/navigation/appPrimaryNavModel.ts` — add `clearDemoCorridor: true` to all 5 `PrimaryNavTransition` returns + the interface field. ~+7 lines.

### Modified — boundary test (the relaxation)
- `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` — remove `'src/features/arguments/oneBox/Popout.tsx'` and `'src/features/arguments/ArgumentComposerDock.tsx'` from `READ_ONLY_PATHS`; add a NOTE block above each removal citing A11Y-PR0 (#913), mirroring the existing AppHeader / designTokens / ArgumentTimelineMap relaxation comments. `composerKeyboardModel.ts`, `OneBox.tsx`, `useComposerFocusContext.ts`, `ArgumentComposer.tsx` **stay pinned** (untouched by this card). ~+16 / −2 lines.

### Deleted files
- None.

---

## API / interface contracts

### `useOverlayA11y` behavior contract (web)
On `visible === true` AND `Platform.OS === 'web'` AND `document` available:
1. **Store trigger:** capture `document.activeElement` as `previouslyFocused`.
2. **Register:** `overlayLayerStack.registerLayer(layerId)` (push → topmost).
3. **Initial focus (`manageFocus`):** after mount, focus the first `FOCUSABLE_SELECTOR` match inside the container; if none, set the container's `tabindex="-1"` (direct DOM `setAttribute` — the hook holds the raw node) and focus the container.
4. **Tab trap (`manageFocus`):** a `keydown` listener (capture phase) active **only when `isTopmost(layerId)`**. On Tab it computes `atFirst`/`atLast` from the live focusable list + `document.activeElement`, calls `resolveFocusTrapEffect`, and on `wrap_to_first`/`wrap_to_last` `preventDefault()` + `.focus()` the wrap target. Interior Tabs (`pass`) are untouched (browser default). Non-topmost layers do NOT trap (nested-overlay correctness — presend over dock: only presend traps).
5. **Esc (`manageEsc`, default true):** a `keydown` listener; on Escape, **iff `isTopmost(layerId)`**, `preventDefault()` + `onDismiss?.()`. Non-topmost → ignored.
6. **Teardown** (on `visible → false` or unmount): `unregisterLayer`, remove listeners, and if `previouslyFocused` is still connected, `previouslyFocused.focus()` (restore).

On native (`Platform.OS !== 'web'`) OR no `document`: every step is a no-op; `registerContainer` is a stable callback; `isTopmost()` returns `false`. **Zero observable native change.**

### Single-Esc arbitration (the P0-3b contract)
One unified `overlayLayerStack`; **every** trapping surface registers (dock included). `isTopmost` is the single arbiter for BOTH focus-trap activation AND Esc/shortcut ownership:
- Dock keydown handler gains `if (!isTopmost()) return;` (line 1 of `handleKeyDown`). When a popout / mode-switcher / presend sheet is above, the dock is not topmost → composer Cmd+Enter / Cmd+K / Esc all suppressed. **`composerKeyboardModel.resolveComposerKeyEffect` is NOT changed** (see §Pinned-file strategy for why this beats threading a boolean into the pure model).
- Popout / PreSend / Marker / Request each own Esc via the hook, topmost-gated → exactly one layer dismisses per Escape.

### `computeRoomHasOpenMenu`
Pure OR of the five booleans. ArgumentRoom's two `document`-level keydown handlers (board A/I/G at `:2769`, stack ←/→ at `:2841`) already bail when `hasOpenMenu` is true (via `resolveBoardMenuKeyEffect` / `resolveStackKeyEffect`); folding the two sheets in suppresses background shortcuts while they're open (the P0-3d acceptance).

### `resolvePrimaryNavTransition(section).clearDemoCorridor`
`true` for all 5 sections. `handlePrimaryNav` reads it; no new section, no behavior change to `tab`/`galleryLane`/`aboutOpen`/`deselectRoom`.

---

## Edge cases

- **Empty overlay (no focusable descendants):** hook falls back to focusing the container via `tabindex="-1"` so focus still leaves the background. (MarkerPhrasePicker with an empty body renders 0 rows + a Cancel button → Cancel is focusable; the fallback covers the pathological 0-focusable case.)
- **`previouslyFocused` detached on close** (trigger unmounted, e.g. the node that opened the popout was removed): restore is skipped when `!previouslyFocused.isConnected`; focus lands on `document.body` (browser default) rather than throwing.
- **Two overlays open at once / nested:** presend inside the dock Modal — both would trap, but only the topmost (presend) traps and owns Esc; the dock's trap deactivates because `isTopmost(dockLayer)` is false. Board Act/Inspect/Go are mutually exclusive (room handler closes the others first), so at most one board popout is on the stack.
- **Same-layer redundant Esc:** when a board Act popout is open, both the room's `resolveBoardMenuKeyEffect` (`close_open_menu`) and the Popout's own hook-Esc target the **same** layer → idempotent double-close, not a cross-layer collision. Benign; documented, not "fixed" (out of tight scope).
- **Mode-switcher popout over the dock:** OneBox opens a `Popout` (same chassis) → it registers on the stack → dock not topmost → dock Esc suppressed; popout Esc closes only the popout. **No OneBox.tsx edit needed** (the chassis carries the registration).
- **Corridor + direct tab switch:** tapping Account/Admin/Debug in the secondary tab bar now clears `demoCorridorOpen` (tab-bar `onPress`) AND the mounts are `!demoCorridorOpen`-gated → no co-render on any path.
- **Corridor's own Close:** unchanged (`onExit={() => setDemoCorridorOpen(false)}`); still works.
- **Reduce-motion:** untouched — the hook adds no animation; Popout/dock keep their existing reduce-motion reads. Focus moves are not animations.
- **Offline / network / permission-denied:** N/A — pure client a11y, no network, no auth path, no writes.
- **SSR / no `document`:** every web branch guards `typeof document === 'undefined'` (mirrors `useComposerFocusContext`).
- **Doctrine edge — does focus/Esc touch score/gate?** No. Focus management never reads or writes the deterministic gate, point standing, or heat. Esc arbitration only chooses which overlay closes; it cannot bypass a validation block (blocks are the engine's, not Esc's).

---

## Test plan

All under `__tests__/` (co-located pure tests where the repo already does so). Named files:

**Pure models (jest-provable, 100% branch on the new pure functions):**
- `__tests__/a11y/overlayFocusTrapModel.test.ts` — `resolveFocusTrapEffect`: Tab@last→`wrap_to_first`, Shift+Tab@first→`wrap_to_last`, interior Tab→`pass`, non-Tab→`pass`, both-boundaries (single focusable)→wrap.
- `__tests__/a11y/overlayLayerStack.test.ts` — pure reducer (`pushLayer`/`removeLayer`/`topOf`, idempotent push, remove-middle) + singleton (`register`→`isTopmost`; register 2nd→topmost flips; unregister→restores; `hasLayers`/`depth`; `subscribe` fires; `__reset`).
- `__tests__/navigation/appPrimaryNavCorridorNav.test.ts` — `resolvePrimaryNavTransition(s).clearDemoCorridor === true` for all 5 sections; other fields unchanged (regression pin).
- `__tests__/arguments/roomOpenMenuModel.test.ts` — `computeRoomHasOpenMenu` truth table incl. marker-only and request-only → true.

**Hook behavior in jsdom (jest-provable; jsdom implements `activeElement`/`focus`/`contains`/`setAttribute` but does NOT auto-move focus on Tab — we assert our `.focus()` calls, not browser focus movement):**
- `__tests__/a11y/useOverlayA11y.test.tsx` —
  - initial focus: mount visible → first focusable's `.focus` spy called; no-focusable → container `tabindex=-1` + focused.
  - restore: set `activeElement` to a trigger, mount, unmount → trigger `.focus` spy called; detached trigger → no throw.
  - Tab trap: seed `activeElement`=last focusable, dispatch Tab keydown → first focusable `.focus` spy called + `preventDefault`; interior → no wrap call.
  - topmost gating: two hooks; lower one's Tab/Esc are no-ops while a higher layer is registered.
  - **native no-op (the byte-unchanged proof):** `jest.mock('react-native', Platform.OS='ios')` → mount+unmount fires **zero** `.focus` calls, `registerContainer` no-ops, `isTopmost()` === false, no `document` listener added.

**Esc single-dismiss matrix (component-level, jsdom):**
- `__tests__/a11y/overlayEscSingleDismiss.test.tsx` —
  - Popout topmost over dock: dispatch Esc → Popout `onClose` called **once**, dock `onClose` **not** called (dock keydown guard `!isTopmost()` returns early).
  - PreSendReviewSheet over dock: Esc → `onBackToEditing` called, dock `onClose` **not** called, draft preserved (inert scrim unchanged).
  - Bare dock (no overlay): Esc → dock `onClose` called (regression — the existing UX-001.3 collapse-then-dismiss still works).

**Containment (jsdom + existing patterns):**
- `__tests__/markerPhrasePickerSheetContainment.test.tsx` — Modal `onRequestClose`→`onCancel`; backdrop Pressable `onPress`→`onCancel`; web Esc (topmost)→`onCancel`; existing pick/whole-move behavior regression-preserved.
- `__tests__/requestReviewComposerContainment.test.tsx` — same matrix; existing 3-step + visibility-readout behavior preserved; copy ban-list still green (re-run `requestReviewCopyBanList.test.ts`).
- Extend / add `__tests__/argumentRoomHasOpenMenu.test.ts` — marker-open and request-open each make `resolveBoardMenuKeyEffect` / `resolveStackKeyEffect` return `none` for A/I/G + arrows (background suppression).

**Doctrine / boundary:**
- `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` — Popout + Dock removed from `READ_ONLY_PATHS`; the remaining pinned composer/oneBox files still diff-clean (they're untouched). uxOneOneSix `requiredApi` for Popout (`/onRequestClose|onDismiss/`), Dock (`ArgumentComposerDock`), App.tsx (`/roomActive/`, `/testID="app-tab-bar"/`) all still pass.
- No new user-facing strings are introduced except the sheets' existing copy → no new ban-list surface. (If any `accessibilityLabel` is added, it routes through existing authored copy; re-run `oneBoxCopyBanList.test.ts` and the sheet copy ban tests.)

**Flake rule (test-discipline):** the a11y model tests are wall-clock-free. Do not add `toBeLessThan(ms)` perf assertions (the LIFE-001/META-001 flake class). If the full suite is run under parallel load and an unrelated perf test flakes, re-run it isolated before attributing to this branch.

**Gate contract:** claim green only on captured `Test Suites: … / Tests: …` + `EXIT: 0`; `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run web:build` all exit 0. Test count goes UP (est. +~60).

---

## Dependencies (cards / docs / files)
- Reads and mirrors `src/features/arguments/composer/useComposerFocusContext.ts` (web-focus precedent) and `src/features/evidence/AddAnnotationSheet.tsx` (Modal-containment precedent).
- Assumes the two boundary tests `uxOneOneFive`/`uxOneOneSix` are the authoritative pins for the composer/popout family (they are, on this base).
- No card blocks this; this card unblocks the **AddAnnotationSheet focus-trap follow-up** and the deferred **native VoiceOver/TalkBack verification** (see Out of scope).
- Touches no Edge Function, migration, RLS, or the rules engine.

---

## Risks
- **RN-web focus-primitive reliability under jsdom vs real browser.** jsdom does not perform sequential focus navigation, so the *actual* Tab-cycling and Esc-visual-dismissal are **RUNTIME-CHECK-only**; jest proves our handler calls `.focus()`/`preventDefault()` on the right node. Mitigation: the RUNTIME-CHECK register (below) is the operator smoke on dev-cdiscourse.netlify.app. Secondary risk: RN-web must render `Pressable`/`Modal` children with a real `tabindex` for `FOCUSABLE_SELECTOR` to match — the `tabindex="-1"` container fallback covers the case where it does not.
- **The two pinned-file relaxations are the review-heat surface.** Popout.tsx + ArgumentComposerDock.tsx leave the uxOneOneFive zero-diff set. Mitigation: each removal carries a NOTE citing #913 (the established AppHeader/designTokens pattern); the load-bearing contract stays pinned by uxOneOneSix `requiredApi` + the files' own contract tests; the edits are additive (hook call + one guard line + ref attach).
- **Native regression.** The whole point is byte-unchanged native. Mitigation: the `Platform.OS='ios'` no-op test is the proof; the hook's every web branch is guarded; `git diff main -- <native-only files>` is empty (only the shared overlay files change, and their native path is the no-op hook).
- **Marker/Request Modal-wrap layout regression.** Moving from inline absolute `<View>` to `<Modal>` (portal) could shift z-order/positioning. Mitigation: mirror AddAnnotationSheet's exact Modal props; RUNTIME-CHECK the two sheets at phone + wide viewports. Fallback if a regression appears: keep the inline `<View>` and add only the web Esc listener + dismissing backdrop (additive path) — loses native hardware-back but satisfies the web acceptance.
- **Module-level singleton stack + test isolation.** A shared mutable stack can leak between tests. Mitigation: `__resetOverlayLayerStack()` in `afterEach`; ids are per-hook-instance.
- **Scope creep on the focus-utility tail.** Adopting the util everywhere at once inflates the diff. Mitigation: the scope line below defers AddAnnotationSheet.

---

## Out of scope
- **AddAnnotationSheet focus-trap adoption** (P0-3a tail) — it already has full containment (Modal + onRequestClose + web Esc); it lacks only the focus trap. Deferred to a fast-follow (`A11Y-PR0-FOLLOW`) because it is an Evidence-epic surface outside this card's four RUNTIME-CHECK items and needs no new pattern — pure mechanical reuse of `useOverlayA11y`.
- **Native VoiceOver / TalkBack verification** — this card is web-focused; native rotor behavior is unchanged and untested here. File as an explicit follow-up (accessibility-targets §"Testing checklist" — do not silently skip).
- Router / URL model (a separate audit card), visual redesign, overlay content changes, seat/room/chime-in/submission semantics, the deterministic gate, arrow-key roving *within* overlays beyond existing behavior, and any new dependency.

---

## Doctrine self-check
- **cdiscourse-doctrine §1 (no truth labels / score never blocks):** no strings, scores, or gates touched; Esc arbitration cannot bypass a validation block (blocks stay the engine's). ✓
- **cdiscourse-doctrine §4/§7 (AI limits / no AI in app):** zero AI calls; pure client a11y. ✓
- **cdiscourse-doctrine §5 (engine sacred):** engine untouched; no import added to it. ✓
- **cdiscourse-doctrine §6 (secrets) / §8 (Supabase):** no `.env`, no service-role, no migration, no RLS, no Edge. ✓
- **accessibility-targets §"Keyboard navigation (IX-003)":** Esc closes the top overlay and restores focus to the trigger; Tab contained; focus order = reading order; native path (rotor) unchanged. ✓
- **accessibility-targets §"Reduce motion":** no new animation; focus moves are not motion. ✓
- **expo-rn-patterns §"Platform branching" / dependency policy:** `Platform.OS==='web'` guard with complete native default (no-op); RN primitives only; **no new dep** (verified against `package.json` — `expo export`/`Modal`/`Pressable`/`document` suffice). ✓
- **test-discipline:** pure models get full-branch tests; hook + containment get jsdom tests; native-unchanged proof; no `.skip`/`.only`; count goes up. ✓
- **Flag posture (see below):** UNFLAGGED — a conformance fix on live surfaces, no user-visible behavior change to gate. ✓

---

## Flag posture — recommend **UNFLAGGED**

Rationale, per the UX-MOBILE-001 / A11Y-693 precedent (mobile-hardening + a11y touch-target fixes shipped unflagged): this is a **defect-class accessibility conformance fix on already-live surfaces**, not a new feature or a visual change a cohort could A/B. There is no new user-visible surface to ramp — a keyboard/SR user simply stops being able to Tab behind a modal. Gating it behind a flag would leave the a11y defect live for the un-flagged cohort, which is the wrong default for a conformance fix. The safety property that would normally justify a flag (bounded blast radius) is instead provided by the **web-only guard + the native-unchanged proof test**: native is provably untouched, and the web changes are additive and reversible by revert. Ship unflagged; the RUNTIME-CHECK register is the operator acceptance gate.

---

## Pinned-file strategy (per file)

| File | Pin | Strategy | Justification |
|---|---|---|---|
| `oneBox/Popout.tsx` | uxFive **zero-diff** | **RELAX + NOTE (#913)** | The focus trap + topmost-Esc must live where the panel ref is — inside the Modal. A wrapping component cannot reach the panel DOM node (Modal renders in a portal). Edit is additive (hook + ref + swap the inline Esc effect). Contract preserved; uxSix `requiredApi` + Popout's own tests keep it pinned. |
| `ArgumentComposerDock.tsx` | uxFive **zero-diff** | **RELAX + NOTE (#913)** | The Esc-suppression guard (`if (!isTopmost()) return`) must sit in the dock's keydown handler, and the dock's own Modal needs the focus trap. Additive (hook + one guard line + ref on the existing panel). |
| `composer/composerKeyboardModel.ts` | uxFive **zero-diff** | **DO NOT TOUCH** | Overlay-awareness is handled in the dock's *handler* via `isTopmost`, not by changing this pure model's signature. Threading an `overlayOpen` boolean here would force a pin relaxation on a pure model for **zero testability gain** (the dock guard is equally testable) and would cascade (the dock would still need the stack read anyway). Keeping it byte-identical means one fewer relaxation and a cleaner review. **This is the recommended answer to the issue's "thread the boolean OR stopImmediatePropagation" choice: do neither to the pure model — gate at the dock via the shared stack.** |
| `oneBox/OneBox.tsx`, `composer/useComposerFocusContext.ts`, `ArgumentComposer.tsx` | uxFive **zero-diff** | **DO NOT TOUCH** | The mode-switcher popout registers via the Popout chassis (already relaxed), so OneBox needs no change to report popout state upward. |
| `room/ArgumentRoom.tsx` | uxSix **soft (`ArgumentRoom`,`Props`)** | **EDIT (tokens preserved)** | `hasOpenMenu` folding requires editing the two inline computations; not a zero-diff pin, so no relaxation needed — just keep the required tokens. |
| `App.tsx` | uxSix **soft (`/roomActive/`,`/testID="app-tab-bar"/`)** | **EDIT (tokens preserved)** | Corridor clear + mount guards; both pinned tokens untouched. |
| `PreSendReviewSheet.tsx`, `markers/MarkerPhrasePickerSheet.tsx`, `requestReview/RequestReviewComposer.tsx`, `navigation/appPrimaryNavModel.ts`, new `a11y/*`, new `roomOpenMenuModel.ts` | **not pinned** | **FREE EDIT / NEW** | — |

---

## Focus-utility adoption scope — recommend **util + 5 primary adopters, defer 1 tail**

Three options (the audit blessed per-overlay adoption):

- **A (broadest):** util + all 6 overlays (Popout, Dock, PreSend, Marker, Request, **AddAnnotationSheet**) this card. Largest diff; pulls in an Evidence-epic file for no acceptance-criteria reason.
- **B (recommended):** util + the 5 overlays inside this card's acceptance blast radius — **Popout, Dock, PreSendReviewSheet, MarkerPhrasePickerSheet, RequestReviewComposer** — and **defer AddAnnotationSheet** (already contained; needs only the trap) to `A11Y-PR0-FOLLOW`. Ships the entire acceptance surface (P0-3a on the two riskiest pinned adopters + the two P0-3d sheets + the P0-3b presend sheet) while deferring exactly one non-acceptance overlay.
- **C (narrowest):** util + Popout + Dock only; defer PreSend/Marker/Request. **Rejected** — P0-3d *requires* Marker+Request containment and P0-3b *requires* presend single-Esc, so C would not satisfy acceptance.

**Recommendation: B.** It is sized to the acceptance criteria and the four RUNTIME-CHECK items, keeps the deferred tail to a single mechanical follow-up, and confines the pinned-file relaxations to the two files that genuinely need them.

---

## Jest-provable vs RUNTIME-CHECK-only split

**Jest-provable (this card's automated gate):**
- All pure models: `resolveFocusTrapEffect`, `overlayLayerStack` reducer + singleton, `computeRoomHasOpenMenu`, `clearDemoCorridor`.
- Hook, in jsdom: initial-focus `.focus()` call, focus-restore `.focus()` call, Tab-boundary wrap `.focus()` call, topmost gating, and the **native no-op proof** (`Platform.OS='ios'` → zero focus calls).
- Esc single-dismiss matrix at component level (dock guard suppresses; presend→back-to-editing; popout closes once; bare dock still closes).
- hasOpenMenu background-suppression via the board/stack key models.
- Boundary tests green (relaxation applied; remaining pins intact).

**RUNTIME-CHECK-only (operator smoke on dev-cdiscourse.netlify.app — jsdom cannot move focus / render a real portal):**
1. **Tab-behind-modal:** with each overlay open, Tab cycles within it and never reaches a background control.
2. **Single-Esc:** one Escape with a popout — and separately with the presend sheet — layered over the dock dismisses exactly one visual layer; the dock/draft survives.
3. **Corridor co-render:** open the corridor, tap each primary nav item and each secondary tab → lands on the target surface, corridor gone, no overlap.
4. **Dock-scrim / mic-slot focusability:** the inert dock scrim does not sink/trap focus; every interactive dock affordance is keyboard-reachable (incl. the future voice/mic slot behind the dark #863 voice flag — currently absent, so this reduces to "scrim is not a focus sink").

**Native (VoiceOver/TalkBack):** unchanged by construction; explicit deferred follow-up, not part of this card's gate.

---

## Reconciliation points needing an orchestrator ruling
1. **Marker/Request: Modal-wrap vs additive-Esc.** Recommend the **Modal wrap** (native hardware-back parity, matches AddAnnotationSheet). If the operator wants to minimize the diff / avoid any portal-layout risk, the additive path (inline `<View>` + web Esc + dismissing backdrop, no native back) is the fallback. Ruling requested; design assumes Modal-wrap.
2. **Pure-model posture for P0-3b.** Design recommends keeping `composerKeyboardModel.ts` byte-identical and gating in the dock (one fewer pin relaxation). The issue text offers "thread `overlayOpen` into `resolveComposerKeyEffect`" as an alternative — confirm the orchestrator is content NOT to touch the pure model.
3. **Adoption scope = Option B** (defer AddAnnotationSheet + native SR verification to `A11Y-PR0-FOLLOW`). Confirm the follow-up card is acceptable rather than folding all 6 overlays into this card.

## Operator steps (if any)
**None — pure code change.** No `db push`, no `functions deploy`, no env var, no secret. Post-merge, the only operator action is the **RUNTIME-CHECK register (items 1–4 above)** as the acceptance smoke on dev-cdiscourse.netlify.app; if it passes, the standard netlify-prod publish (strict FF push + bundle-hash poll) carries it live. Ship **unflagged**.
