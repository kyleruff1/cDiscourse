# A11Y-PR0-FOLLOW — Overlay a11y follow-up: AddAnnotation trap, native back parity, SR containment audit

**Status:** Design draft
**Epic:** Cross-cutting accessibility (PR-0 overlay a11y line)
**Release:** Argument-surface pivot / a11y floor
**Issue:** https://github.com/(owner)/debate-constitution-app/issues/915 (issue 915; follow-up to A11Y-PR0 issue 913)

## Goal (one paragraph)

A11Y-PR0 (issue 913) shipped the web-only overlay accessibility layer (`src/features/a11y/`:
`overlayFocusTrapModel`, `overlayLayerStack`, `useOverlayA11y`) and adopted it in 5 overlays.
Three items were explicitly deferred. This card closes them: (1) adopt `useOverlayA11y` in
`AddAnnotationSheet` so it traps Tab and restores focus like the other adopters; (2) give the two
inline (non-`Modal`) sheets — `MarkerPhrasePickerSheet` and `RequestReviewComposer` — Android
hardware-back dismissal via a new shared native-only hook, without regressing the web-gated
containment; (3) close the `accessibilityViewIsModal` gap on `MarkerPhrasePickerSheet` (currently 0
refs) and ship a recorded VoiceOver/TalkBack verification checklist for the on-device SR pass jest
cannot reach. The work is doctrine-inert: no user-facing copy changes, no truth/heat/popularity
surface, no score, no network, no AI, no new production dependency (`BackHandler` is a core RN
export). It is a pure keyboard/focus/SR-containment hardening of existing overlays.

## Data model

No new data model. No types beyond one new hook signature (`useNativeBackClose`, below). No SQL, no
RLS, no Edge Function, no migration.

## File changes

New files
- `src/features/a11y/useNativeBackClose.ts` — ~40 lines. A shared, native-only hook that closes an
  open overlay on the Android hardware back button. Web is a hard no-op. Reused by both inline sheets.

Modified files
- `src/features/a11y/index.ts` — +2 lines. Barrel-export `useNativeBackClose`.
- `src/features/evidence/AddAnnotationSheet.tsx` — net roughly -10 / +8 lines (Item 1). Adopt
  `useOverlayA11y`; attach `registerContainer` to the inner sheet element; **remove** the ad-hoc
  `globalThis` web Escape `useEffect` (lines 94-105) because the hook now owns a topmost-gated
  Escape. `Modal` + `onRequestClose` (native back) and the existing `accessibilityViewIsModal`
  stay unchanged.
- `src/features/arguments/markers/MarkerPhrasePickerSheet.tsx` — +~5 lines (Items 2 + 3). Call
  `useNativeBackClose(true, props.onCancel)`; add `accessibilityViewIsModal` to the root overlay
  `View` (and, mirroring `PreSendReviewSheet`, to the inner sheet panel `View`).
- `src/features/requestReview/RequestReviewComposer.tsx` — +~2 lines (Item 2). Call
  `useNativeBackClose(visible, onCancel)`. Its existing root-overlay `accessibilityViewIsModal`
  (line 194) is already correctly placed — no change (Item 3 verify-only).

Test files
- `__tests__/a11y/useNativeBackClose.test.tsx` — NEW. The hook's native consume / web no-op /
  closed no-op / cleanup contract.
- `__tests__/markerPhrasePickerSheetContainment.test.tsx` — MODIFY. Add native-back wiring
  assertions + an `accessibilityViewIsModal` prop assertion.
- `__tests__/requestReviewComposerContainment.test.tsx` — MODIFY. Add native-back wiring
  assertions + an `accessibilityViewIsModal` regression pin.
- `__tests__/addAnnotationSheet.test.tsx` — MODIFY. Rewrite the now-stale "on web an Escape keydown
  calls onClose" source-scan block (lines 127-131 pin the removed ad-hoc effect) into a
  `useOverlayA11y`-adoption source-scan; keep the `onRequestClose` (native back) and
  `accessibilityViewIsModal` assertions.
- `__tests__/addAnnotationSheetContainment.test.tsx` — NEW (recommended). Render-based
  (jsdom + web) proof that a topmost Escape closes the sheet via the hook, and native is a no-op.

Deleted files
- None.

## API / interface contracts

### New hook — `useNativeBackClose`

```ts
// src/features/a11y/useNativeBackClose.ts
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * A11Y-PR0-FOLLOW (issue 915) native hardware-back dismissal for inline
 * overlays. The two inline sheets (MarkerPhrasePickerSheet,
 * RequestReviewComposer) are plain Views, not RN Modal, so they have no
 * onRequestClose and the Android back button falls through to app navigation.
 * This hook subscribes to hardwareBackPress while the overlay is open and
 * consumes it (returns true) so back closes the overlay instead of popping the
 * screen. Web is a hard no-op (RN-web BackHandler never fires; the explicit
 * Platform guard keeps it byte-inert and mirrors the useOverlayA11y native
 * no-op invariant). onClose is read through a ref so the subscription is not
 * torn down and rebuilt on every render.
 */
export function useNativeBackClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    if (Platform.OS === 'web') return; // hard no-op on web
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true; // consume: prevents default app-exit / screen pop
    });
    return () => sub.remove();
  }, [open]);
}
```

- Signature: `useNativeBackClose(open: boolean, onClose: () => void): void`.
- Location: `src/features/a11y/useNativeBackClose.ts`, re-exported from `src/features/a11y/index.ts`.
- Web story: `Platform.OS === 'web'` early-returns before any subscription — no listener, no
  `BackHandler` touch. This matches the `useOverlayA11y` native-no-op invariant, inverted (there
  native is the no-op; here web is). RN-web's `BackHandler` is itself a no-op stub, so the guard is
  belt-and-suspenders + intent-documenting.
- Cleanup: uses the RN 0.81 `NativeEventSubscription.remove()` returned by `addEventListener` (the
  legacy `BackHandler.removeEventListener` is not used).
- Return-true rationale: RN calls back subscriptions last-registered-first and stops at the first
  `true`; returning `true` consumes the press so the overlay closes without the app exiting or the
  navigator popping the underlying screen.

### Item 1 — AddAnnotationSheet adoption (mirrors PreSendReviewSheet / RequestReviewComposer)

The hook call, placed with the other hooks (before any early return; `AddAnnotationSheet` does not
early-return null — the `Modal` owns visibility, so pass the `visible` prop):

```ts
// after the existing useState/useEffect/useCallback block, before `return (<Modal ...>`
const { registerContainer } = useOverlayA11y({
  visible,
  onDismiss: onClose,
});
```

Attach the container ref to the **inner sheet `Pressable`** (the element that already carries
`accessibilityViewIsModal`, currently at lines 134-140) — that is the trap scope whose focusable
descendants (option radios, note `TextInput`, Cancel, Confirm, header close) are cycled:

```tsx
<Pressable
  ref={(el) => registerContainer(el as unknown as HTMLElement | null)}
  style={styles.sheet}
  accessibilityViewIsModal
  accessibilityRole="none"
  onPress={() => undefined}
  testID="add-annotation-sheet"
>
```

**Remove** the ad-hoc web Escape `useEffect` (lines 94-105, the `globalThis` `keydown` listener).
The hook now owns Escape and gates it on topmost-layer (correct for nested overlays; the old
listener fired on any Escape regardless of stacking). Import stays: `useOverlayA11y` from
`../a11y/useOverlayA11y` (or the barrel `../a11y`). The `Platform` import is still used elsewhere
(the reduce-motion `animationType` path uses `reduceMotion`, and the scrim keeps its props); confirm
`Platform` is still referenced after the effect removal — if it becomes unused, drop it from the
import to keep lint green. (Grep after editing: `Platform` currently appears only in the removed
effect at lines 95/99-102, so it will become unused and MUST be removed from the react-native
import.)

Do NOT pass an explicit `layerId` (auto-generated per-hook id, matching the other adopters). Do NOT
add the native-back hook here — `Modal` + `onRequestClose={onClose}` already handles Android back.

### Item 2 — inline-sheet native-back wiring

`MarkerPhrasePickerSheet` (the sheet is only mounted while open, so `open` is `true`, matching its
existing `useOverlayA11y({ visible: true })`):

```ts
useNativeBackClose(true, props.onCancel);
```

`RequestReviewComposer` (has a real `visible` prop and early-returns null; place the call beside the
existing `useOverlayA11y({ visible, onDismiss: onCancel })`, before `if (!visible) return null`):

```ts
useNativeBackClose(visible, onCancel);
```

### Item 3 — accessibilityViewIsModal fixes

`MarkerPhrasePickerSheet` (0 refs today → the real gap). Add `accessibilityViewIsModal` to the
**root overlay `View`** (styles.overlay, lines 65-68) — this is the element whose siblings are the
host's background room content, so it is the element that makes VoiceOver ignore the background
(exactly where `RequestReviewComposer` places its one AVIM). Also add it to the **inner sheet panel
`View`** (styles.sheet, lines 83-87) to mirror `PreSendReviewSheet`'s belt-and-suspenders
double placement:

```tsx
<View
  style={[styles.overlay, isSide ? styles.overlaySide : styles.overlayBottom]}
  accessibilityViewIsModal
  testID="marker-phrase-picker-sheet"
>
  ...
  <View
    ref={(el) => registerContainer(el as unknown as HTMLElement | null)}
    style={[styles.sheet, isSide ? styles.sheetSide : styles.sheetBottom]}
    accessibilityViewIsModal
  >
```

`RequestReviewComposer` — verify-only. Its single `accessibilityViewIsModal` on the root overlay
`View` (line 194) is already on the correct element (root overlay whose siblings are the
background). No code change; add a regression pin in its containment test.

`AddAnnotationSheet` — verify-only. Its `accessibilityViewIsModal` on the inner sheet `Pressable`
(line 136) is correct: it sits inside a `Modal` (which already isolates from the background on
native), and marks the sheet against its sibling scrim. No code change.

## Edge cases

- **Web Escape double-fire (AddAnnotationSheet):** if the ad-hoc `globalThis` listener is left in
  AND the hook is added, Escape fires `onClose` twice. The design REQUIRES removing the ad-hoc
  effect so exactly one topmost-gated Escape path remains.
- **Nested overlays / topmost gating:** the hook's Escape only fires when its layer is topmost
  (`overlayLayerStack`). If AddAnnotationSheet opens over another registered overlay, only the top
  layer dismisses — the reason the ad-hoc (ungated) listener is removed rather than kept.
- **Native back while closed:** `useNativeBackClose(false, …)` never subscribes; `open=false`
  early-returns. The back button behaves normally (no consume) when the overlay is not open.
- **Native back consume vs. app exit:** the handler returns `true` to consume. This is intentional —
  returning `false`/`undefined` would let the OS pop the screen behind the overlay. Verify the
  handler does not swallow back when the overlay is already closed (guaranteed by the `open` gate +
  cleanup on close).
- **Web hardware back:** RN-web `BackHandler` never fires `hardwareBackPress`; the `Platform.OS ===
  'web'` guard means the subscription is never even created on web. No behavior change to the shipped
  web containment (backdrop press + topmost Escape) from issue 913.
- **`registerContainer` under react-test-renderer:** RTL (react-test-renderer) passes a component
  instance, not an `HTMLElement`; `useOverlayA11y`'s `isDomElement` duck-type returns false and the
  container stays null. Escape still fires `onDismiss` (independent of the container), so RTL
  containment tests can assert Escape-closes but NOT real Tab cycling. Real DOM focus-trap behavior
  is already proven once by `__tests__/a11y/useOverlayA11y.test.tsx` (react-dom harness); per-adopter
  tests only prove wiring.
- **`onClose` identity churn:** callers may pass inline closures. The hook reads `onClose` via a ref
  so the `hardwareBackPress` subscription is not rebuilt every render (matches
  `useOverlayA11y`'s `onDismissRef`).
- **Android AVIM limitation (documented, not fixed here):** `accessibilityViewIsModal` is honored by
  iOS VoiceOver; on Android it is effectively a no-op for inline overlays. Full Android TalkBack
  containment for an inline (non-`Modal`) overlay would require the host to set
  `importantForAccessibility="no-hide-descendants"` on the background siblings — that is host wiring
  outside these 3 files and is recorded as a RUNTIME-CHECK + follow-up (see Out of scope). The
  backdrop already carries `no-hide-descendants` but that only hides the backdrop's own descendants.
- **Doctrine edge:** none of these changes touch score, heat, popularity, truth labels, evidence
  standing, or copy. The sheets remain advisory-only surfaces.

## Test plan

`__tests__/a11y/useNativeBackClose.test.tsx` (NEW; jsdom docblock, `Platform.OS` toggled per block,
`BackHandler.addEventListener` spied):
- native (`ios`), `open=true`: `addEventListener` called once with `'hardwareBackPress'`; invoking
  the captured handler calls `onClose` once AND returns `true`.
- native, unmount / `open`→`false`: the returned subscription's `remove` is called.
- native, `open=false`: `addEventListener` NOT called.
- web (`web`), `open=true`: `addEventListener` NOT called (hard no-op).
- callback-ref: changing `onClose` between renders does not re-subscribe (assert `addEventListener`
  call count stays 1) but the latest `onClose` is invoked.

`__tests__/markerPhrasePickerSheetContainment.test.tsx` (MODIFY):
- native (`ios`): spy `BackHandler.addEventListener`; render the sheet → called with
  `'hardwareBackPress'`; captured handler → `onCancel` called once + returns `true`.
- AVIM: render (web) → the root overlay (`testID="marker-phrase-picker-sheet"`) has
  `accessibilityViewIsModal === true`; the inner sheet panel has it too.
- keep the existing web backdrop / Escape / pick / cancel regressions green.

`__tests__/requestReviewComposerContainment.test.tsx` (MODIFY):
- native (`ios`): `BackHandler` wiring same pattern → `onCancel` on back.
- AVIM regression pin: the overlay root (`testID="request-review-composer"`) has
  `accessibilityViewIsModal === true`.

`__tests__/addAnnotationSheet.test.tsx` (MODIFY):
- REPLACE the "on web an Escape keydown calls onClose" source-scan block (lines 127-131, which pin
  the removed `Platform.OS !== 'web'` / `e.key === 'Escape'` / `addEventListener?.('keydown'` /
  `removeEventListener?.('keydown'` ad-hoc effect) with source-scan assertions that the sheet
  imports/calls `useOverlayA11y`, passes `onDismiss: onClose`, and attaches `registerContainer` to
  the sheet element; assert the ad-hoc `globalThis` `keydown` listener is GONE (negative match).
- KEEP: `onRequestClose={onClose}` (native back), `accessibilityViewIsModal`, radio / confirm /
  note / reduce-motion assertions.

`__tests__/addAnnotationSheetContainment.test.tsx` (NEW; jsdom + `Platform.OS='web'`, RTL render):
- web topmost Escape closes the sheet (`onClose` called once) — proves the hook owns Escape.
- native (`ios`) Escape does nothing (hook no-op) — mirrors the other containment suites.

Doctrine ban-list: no new user-facing strings are added, so no new copy ban-list test is required;
existing `evidenceAnnotationBanList` / `requestReviewCopyBanList` stay green (unchanged copy).

## Dependencies (cards / docs / files)

- Assumes A11Y-PR0 (issue 913) is complete: `src/features/a11y/{overlayFocusTrapModel,
  overlayLayerStack,useOverlayA11y}.ts` exist and are the shared arbiter. Confirmed present on
  `origin/main @ 33088492`.
- Reads `useOverlayA11y` (the `registerContainer` + topmost-gated Escape contract) and mirrors the
  proven adopters `PreSendReviewSheet` (inline, AVIM double placement) and `RequestReviewComposer`
  (root AVIM).
- Reuses RN core `BackHandler` (RN 0.81.5) — no new dependency; zero prior `BackHandler` usage in
  the repo, so `useNativeBackClose` is the first and should be the single canonical wrapper.
- `docs/designs/A11Y-693-ASP.md` context: the `a11y693AspSurfaceAudit` test enumerates
  `MarkerPhrasePickerSheet` but asserts only role/label/44-target/reduce-motion — unaffected by AVIM
  or the back hook (no `Animated`/`animationType` antecedent is introduced).

## Risks

- **Stale AddAnnotation source-scan (highest-likelihood breakage):** removing the ad-hoc Escape
  effect WILL fail `addAnnotationSheet.test.tsx:127-131` until those four `expect(SHEET_SRC)...`
  lines are rewritten. This is a required, expected test update, not an incidental break — call it
  out in the commit.
- **`Platform` becoming an unused import in AddAnnotationSheet:** after removing the effect,
  `Platform` is no longer referenced; leaving it triggers `no-unused-vars` lint. Drop it from the
  `react-native` import (re-grep for `Platform` before finalizing).
- **`BackHandler` spy hygiene in tests:** the hook subscribes on native only; tests MUST set
  `Platform.OS` before render and restore it after (the containment suites already use the
  `Object.defineProperty(Platform, 'OS', …)` pattern — reuse it). A leaked `ios` OS would bleed into
  sibling suites.
- **react-test-renderer cannot prove Tab cycling** (see Edge cases) — do not attempt DOM focus
  assertions in the RTL adopter suites; rely on the existing react-dom `useOverlayA11y` suite.
- **Android AVIM is a partial fix** — the on-device TalkBack containment for inline overlays is
  weaker than iOS; this is recorded, not silently shipped (checklist + follow-up).
- **Scanner hazards:** `MarkerPhrasePickerSheet` is scanned by the `uxOneOneTwoDoctrine`
  quote-parity scanner — every comment added there MUST be apostrophe-free (the file already states
  this). Reference the follow-up in new comments as `A11Y-PR0-FOLLOW (issue 915)` (no `#`) to avoid
  any `#`/token scanner surprises; existing `#913` refs in these files are retained as-is.

## Out of scope

- No web-behavior change from issue 913 (backdrop press + topmost Escape stay exactly as shipped;
  the native-back hook is web-inert).
- No RN `Modal` wrap of `MarkerPhrasePickerSheet` or `RequestReviewComposer` (the orchestrator R1
  ruling keeps them inline Views; that ruling is unchanged).
- No new pinned-file relaxation: none of the 3 target files is pinned by `uxOneOneFive/Six/Two`
  read-only boundary scanners (verified by grep), so no boundary edit is needed. AddAnnotationSheet
  is **not** pinned.
- No host-level Android background-sibling `importantForAccessibility` wiring (would be a separate
  card touching the room/host that mounts these overlays). Recorded as a follow-up.
- No changes to the other 4 already-adopted overlays (`ArgumentComposerDock`, `PreSendReviewSheet`,
  `oneBox/Popout`) beyond leaving them untouched.
- No animation, no copy, no score/heat/evidence surface.

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels / score never blocks):** no score, no truth label, no
  copy touched. Overlays stay advisory. PASS.
- **cdiscourse-doctrine §2-§3 (heat / popularity):** untouched — no heat or engagement surface in
  scope. PASS.
- **cdiscourse-doctrine §4 (AI limits):** no AI call; these are pure client UI overlays. PASS.
- **cdiscourse-doctrine §5 (engine sacred):** engine not imported or touched. PASS.
- **cdiscourse-doctrine §6-§7 (secrets / no client AI):** no secrets, no network, no provider call.
  PASS.
- **cdiscourse-doctrine §9 (plain language):** no new user-facing strings; no internal codes
  surfaced. PASS.
- **accessibility-targets:** this card IS the a11y hardening — Tab trap + focus restore
  (AddAnnotation), keyboard/back parity, SR containment. 44-target / role / label / reduce-motion on
  the touched overlays are preserved (no interactive element added or resized). The native
  VoiceOver/TalkBack pass is captured as a recorded checklist (below), per the skill's "document as
  deferred, do not silently skip" rule. PASS.
- **expo-rn-patterns:** RN core primitives only (`BackHandler`, `Platform`); no new dep; web/native
  branch via `Platform.OS` guard with a complete native path and inert web path; model/hook file is
  React-only, no Supabase. PASS.
- **test-discipline:** tests ship with the code (new hook suite + adopter wiring + rewritten
  source-scan); count goes up; no `.skip`/`.only`. PASS.

## Native VoiceOver / TalkBack verification checklist (RUNTIME-CHECK — operator-assisted)

jest cannot reach the on-device screen reader. The CODE deliverable is the `accessibilityViewIsModal`
gap closure + the native-back hook; the on-device confirmation below is a recorded checklist the
operator checks off after the branch is on a device build. Ship this section as-is in the doc.

For each overlay: open it, then attempt to reach background content with the SR cursor (VoiceOver:
swipe right/left through elements; TalkBack: swipe right/left) and attempt to dismiss.

| # | Overlay | Container / mechanism | iOS VoiceOver expected | Android TalkBack expected | Hardware/gesture back expected |
|---|---------|-----------------------|------------------------|---------------------------|-------------------------------|
| 1 | `AddAnnotationSheet` | RN `Modal` + AVIM on sheet | Swiping does not escape to background; cursor stays in the sheet | `Modal` isolates; cursor stays in the sheet | Android back closes (via `Modal.onRequestClose`) |
| 2 | `MarkerPhrasePickerSheet` | inline View + AVIM on root overlay + panel + `useNativeBackClose` | Background ignored; cursor stays in the sheet | AVIM weak on Android — background MAY remain reachable (known limitation; record actual) | Android back closes (via `useNativeBackClose`) |
| 3 | `RequestReviewComposer` | inline View + AVIM on root overlay + `useNativeBackClose` | Background ignored; cursor stays in the composer | AVIM weak on Android — record actual reachability | Android back closes (via `useNativeBackClose`) |
| 4 | `PreSendReviewSheet` | inline View + AVIM (root + panel) | Background ignored | Record actual | Back = Back-to-editing (already wired? record) |
| 5 | `oneBox/Popout` | inline View + AVIM (3 refs) | Background ignored | Record actual | Record actual |
| 6 | `ArgumentComposerDock` overlay | inline View + AVIM (2 refs) | Background ignored | Record actual | Record actual |

How to test:
- iOS: build to a device/simulator, Settings → Accessibility → VoiceOver on. Open each overlay,
  three-finger swipe / single-finger swipe through the elements, confirm the cursor cannot land on a
  background room element while the overlay is up. Confirm dismiss paths.
- Android: Settings → Accessibility → TalkBack on. Open each overlay, swipe right repeatedly, note
  whether any background element is announced. Press the hardware/gesture Back button, confirm the
  overlay closes (for #2 and #3 this is the new `useNativeBackClose` path).
- Record PASS / PARTIAL / the actual observed behavior per cell. PARTIAL Android AVIM cells feed the
  host-level `importantForAccessibility` follow-up (Out of scope here).

Code-vs-device split:
- **Ship now (code, jest-verified):** Item 1 Tab-trap + focus restore adoption; Item 2 native-back
  hook + wiring; Item 3 `MarkerPhrasePickerSheet` AVIM additions.
- **Recorded, checked off later (operator device):** the 6-row SR table above; Android inline-overlay
  containment strength; any host-level `importantForAccessibility` follow-up card.

## Operator steps (if any)

None for the code change — pure client code, no migration, no Edge Function deploy. The only
operator-assisted step is the on-device VoiceOver/TalkBack pass in the checklist above, which is a
verification (not a deploy) and can happen after merge.
