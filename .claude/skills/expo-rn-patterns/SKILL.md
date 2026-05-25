---
name: expo-rn-patterns
description: Expo React Native patterns and dependency policy for this repo. Invoke when designing or implementing any UI card (Epic 1-9, 11). Covers RN primitives, dep install rules, platform-specific APIs, and why we don't add Bootstrap or other web-only deps.
---

# Expo / React Native patterns — CDiscourse

## Dependency policy

1. Check `package.json` before installing anything.
2. Expo / React Native packages: `npx expo install <package>` (gets compatible version, NOT plain `npm install`).
3. Pure-JS packages (Zustand, etc.): `npm install <package>`.
4. Supabase Edge Function deps: import via URL (Deno-compatible); no npm installs inside `supabase/functions/`.
5. Do not install packages speculatively — only when they serve the current card.
6. If a card seems to need a new dep, **first try React Native primitives**. Document the attempt in the design doc before adding the dep.

### Specifically banned for UI work

- **Bootstrap CSS** — web-only, not an RN primitive. Build a Bootstrap-*inspired* token layer in pure RN (`spacing.xs/s/m/l/xl`, `radius.sm/md/lg/pill`, `status.*`, `surface.*`).
- **react-native-web specific libraries** that don't degrade on native.
- Animation libraries beyond `react-native-reanimated` (already in deps if needed).
- Icon libraries — use existing repo icons or simple `<Text>` glyphs.

## Visual primitives — what to reach for

| Need | Use | Avoid |
| --- | --- | --- |
| Layout | `<View>` with flexbox | CSS grid, web-only flex tricks |
| Text | `<Text>` (must wrap all text) | Raw strings outside `<Text>` (RN errors) |
| Gradients | Segmented `<View>` with interpolated colors | Native gradient lib (would be a new dep) |
| Touch target | `<Pressable>` with `accessibilityRole="button"` | `<TouchableOpacity>` (legacy) |
| Animation | RN `Animated.View` transforms | Layout animations on every frame |
| Color blending | A pure JS `mixHex(a, b, t)` helper | Color manipulation libs |

## Color and shape rules (from `cdiscourse-doctrine`)

- Shape, stroke, and texture carry information first. Color is supplementary.
- This means: a node is recognizable as "evidence" without color (hex shape + receipt mark inside).
- All UI tests must pass a "no-color" check where applicable: replace the color token with neutral and verify meaning is still legible.

## Test target requirements

- 44px minimum tap target on all `Pressable`s (use `hitSlop` if visual is smaller).
- `accessibilityLabel`, `accessibilityRole`, `accessibilityState` populated on every interactive element.
- For timeline nodes specifically: expose `accessibilityLabel` describing type, ordinal, strength band, and "active" state.

## File structure conventions

```
src/features/<feature>/
  <Feature>Screen.tsx              # screen-level container
  <Component>.tsx                  # presentational pieces
  <feature>Model.ts                # pure TypeScript model — NO React imports
  <feature>Api.ts                  # Supabase / network glue, exports typed wrappers
  __tests__ or co-located *.test.ts
```

Model files (`*Model.ts`) MUST be pure TypeScript with no React or Supabase imports. They are unit-testable in isolation. UI files import the model.

## Composer / argument-room patterns

Existing structure to align with (do not rebuild):

- `src/features/arguments/ArgumentGameSurface.tsx` — the room surface that toggles Timeline / Stack
- `src/features/arguments/ArgumentTimelineMap.tsx` — horizontal DAW-style timeline
- `src/features/arguments/ArgumentBubbleStack.tsx` — stack mode
- `src/features/arguments/ArgumentReplySidecar.tsx` — selected-message detail
- `src/features/arguments/ArgumentSideActionRail.tsx` — action rail (Stage 6.4)
- `src/features/arguments/ArgumentComposer.tsx` — submit flow
- `src/features/arguments/argumentGameSurfaceModel.ts` — lane assignment, active mode
- `src/features/arguments/argumentScoreModel.ts` — point standing bands
- `src/features/arguments/gameCopy.ts` — internal code → plain language map
- `src/features/arguments/quickActionPresets.ts` — preset composer payloads per action

New surfaces should plug into these, not duplicate them.

## Platform branching

When behavior must differ between web and native:

```ts
import { Platform } from 'react-native';
// Prefer:
const radius = Platform.select({ web: 8, default: 6 });
// Avoid scattering Platform.OS === 'web' checks across files
```

For web-only enhancements (keyboard nav, larger viewports), guard with `Platform.OS === 'web'` and provide a graceful native default. The native path must still be a complete experience.

## Cross-device QA viewport conventions (POSTRUN-UX001 / UX-001.6 prep)

Cross-device QA distinguishes six device contexts. Component-level tests verify props and rendering; cross-device QA verifies actual viewport behavior. React Native Web layout MUST be validated against actual viewport assumptions, not only via component tests.

The four hard-blocker viewports for the UX-001 epic (and the default cross-device QA matrix going forward):

| Viewport | Label | Context |
|---|---|---|
| 390 × 844 | Phone (iPhone-class) | Touch-first; no keyboard hints |
| 1024 × 1366 | Tablet portrait (iPad Pro 11-class) | Touch-first; optional keyboard |
| 1366 × 768 | Narrow browser (small laptop / desktop window) | Keyboard-first; key badges render |
| 1920 × 1080 | Wide browser (desktop) | Keyboard-first; key badges render |

The four extension viewports for broader coverage (use when QA matrix calls for it):

| Viewport | Label | Context |
|---|---|---|
| 360 × 800 | Phone (small Android) | Touch-first; tightest layout budget |
| 412 × 892 | Phone (large Android) | Touch-first |
| 768 × 1024 | Tablet portrait (iPad-class) | Touch-first |
| 2560 × 1440 | Wide browser (4K-class desktop) | Keyboard-first; verify nothing scales oddly |

Touch-first and keyboard-first divergence is acceptable when documented. The same screen can render different chrome (e.g., key badges on browser, not on phone) as long as the no-color-only and 44×44 rules apply to both paths.

When a card's design specifies cross-device QA, the design doc must enumerate which of these viewports the implementation has been verified against, with notes on any per-viewport adaptations.

## When in doubt

Read the corresponding existing component before designing. If your design would force the existing component into a major rewrite, surface it in the design doc and stop — that's a separate refactor card.
