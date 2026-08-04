# VOICE-005 — Live waveform visualizer (pure-TS geometry + adapters spike)

- **Card:** issue 663
- **Governing contracts:** VOICE-ADR-002 (scoped audio persistence + non-replayability), VOICE-001 §5.1 / §5.3 (voice shell, capability, doctrine boundary), VOICE-003 (speech reducer house pattern), VOICE-004 (waveform reducer + `VoiceWaveformArtifact` — the parent artifact this visualizer renders)
- **Status:** design ready for implementer (spike; native install + on-device proof are operator-run per the runbook, NOT commits on this branch)
- **Scope:** pure-TS geometry primitive `bucketsToPathSegments(buckets, layout) => readonly PathSegment[]`, two thin adapters (SVG `d`-string join, Skia duck-typed path apply), a defensive re-quantizer, a doctrine source-scan test with a firing positive-control fixture, a single-line addition to `app.json`'s `plugins` array (`expo-audio` config plugin with the mic-permission copy), and an operator runbook. **No React component**, **no `npx expo install`**, **no `npx expo prebuild`**, **no `eas` calls** — those belong to the operator per the runbook (or to a follow-up VOICE-005-composition / VOICE-007 card).

## Summary

Ship a JSON-serializable, side-effect-free geometry primitive that turns the `readonly number[]` amplitude bucket array on `WaveformSessionMachineState.amplitudeBuckets` (the state field the VOICE-004 reducer already exposes during `accumulating` and preserves on every terminal) into a `readonly PathSegment[]` describing a mirrored-bar shape around a horizontal centerline (Voice-Memos style). Two adapters consume the segments: `pathSegmentsToSvgD(segments) => string` for `react-native-svg`, and `applyPathSegmentsToSkiaPath(path, segments) => void` for `@shopify/react-native-skia` (both duck-typed on local interfaces so the pure module imports neither dependency). A defensive re-quantizer (`quantizeBucketsForRender`) applies `clamp01` + `Math.round(x * 255) / 255` as the first step of `bucketsToPathSegments` so a **live** bucket array (unquantized, mid-session) renders byte-identically to the **finalized** artifact's already-quantized bucket array — this is the doctrinal move that inherits VOICE-004's non-replayability without touching VOICE-004. A `voice005ForbiddenInferenceGuard.test.ts` mirrors VOICE-003 / VOICE-004's guard with visualizer-specific bans (`voice signature`, `vocal print`, `prosody visualization`, `spectrogram`, `formant`, plus every trig / non-basic-arithmetic function) and a firing positive-control fixture. The `app.json` `plugins` addition wires the `expo-audio` config plugin to a doctrine-approved mic-permission copy so the operator's downstream `npx expo prebuild` generates the correct `NSMicrophoneUsageDescription` and `RECORD_AUDIO` permission from a single source of truth. The React component (`VoiceWaveformVisualizer.tsx`), the three native dep installs (`@shopify/react-native-skia`, `expo-audio`, `react-native-svg`), the `npx expo prebuild`, the dev-build produce, and the on-device screenshots are **all operator-run steps documented in `docs/runbooks/VOICE-005-install-runbook.md`** — no committed React file, no `package.json` / `package-lock.json` / `eas.json` diff on this branch.

The design adopts the completeness critic's rulings on every panel contradiction: live source = subscribe to `state.amplitudeBuckets` (not a new field, not a local fold, not per-sample reducer re-entry); Skia adapter = handcrafted `moveTo` / `lineTo` / `close` on a duck-typed interface (never `Skia.Path.MakeFromSVGString`); bar-mirror shape only (no smooth curves — smooth kernels defer to a follow-up); runbook path = `docs/runbooks/VOICE-005-install-runbook.md` (existing convention); commit surface = strictly `app.json` + `src/features/voice/visualizer/**` + this design doc + the runbook (no `package.json` / `eas.json` / `App.tsx` / `.env.example` diff).

---

## §0 — VOICE-ADR-002 + VOICE-001 + VOICE-004 reconciliation

The issue 663 acceptance criteria are largely intact but **partially imprecise** because (a) the brief claims `amplitudeBuckets` is "produced ONLY on finalize" — grounding proves the reducer accumulates it on state during `accumulating` (waveformSessionMachine.ts:108, :138, :445), and (b) the brief lists "native install + on-device visual proof" as operator-only but is silent on whether `package.json` / `eas.json` / `App.tsx` are committed on the branch. The panel's completeness critic ruled on both; this design adopts those rulings.

### 0.1 Card AC vs shipped design

| issue 663 AC (as-written)                                                                   | Ship (per critic ruling + grounding)                                                                                                                                                                                                                                                                                                                                     | Source                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| "amplitudeBuckets are produced only on finalize"                                            | **Corrected.** `WaveformSessionMachineState.amplitudeBuckets` accumulates on the reducer state during `accumulating` (unquantized), and `makeArtifact` runs `quantize8bit` at terminal fold. The visualizer subscribes to `state.amplitudeBuckets` directly. It re-quantizes internally so live and finalized renders converge on the same 256-level lattice.             | VOICE-004 waveformSessionMachine.ts:108/:138/:445, :274-:275 |
| Live sampling boundary — where does the visualizer get pre-finalize data?                   | **Ruled.** Subscribe to `state.amplitudeBuckets`. No new reducer state field (would mutate VOICE-004 for no gain). No local fold in the component (would fork `halveBucketsPairMax`). No per-sample reducer re-entry (would break purity). `bucketsToPathSegments` calls `quantizeBucketsForRender` as step 1 — idempotent, so finalized buckets pass through byte-identical. | Critic ruling; Lens 1 §Live-view source |
| Skia primary + SVG fallback                                                                 | **Adapters, not renderers.** Both consume `PathSegment[]` from the same pure `bucketsToPathSegments`. The Skia adapter is a duck-typed `applyPathSegmentsToSkiaPath(path, segments)` with a local `SkiaPathLike = { moveTo, lineTo, close }` interface — **NO import of `@shopify/react-native-skia`** in the pure module. The SVG adapter is `pathSegmentsToSvgD(segments) => string`. | Critic ruling; Lens 1 §Skia adapter surface |
| Depends on VOICE-002 (native install)                                                       | **NOT a build dependency of the pure-TS core.** The visualizer folder imports zero native / React / Skia / SVG code. The operator's install per the runbook is what activates the component composition in the FOLLOW-UP card. VOICE-005 ships independently.                                                                                                             | Critic ruling; Lens 3 §Sequence discipline |
| React component `VoiceWaveformVisualizer.tsx` committed on this branch                      | **Deferred.** Static imports of `@shopify/react-native-skia` / `react-native-svg` break `web:build` before VOICE-002. Lazy requires are brittle. The runbook snippet documents composition; VOICE-005-composition (or VOICE-007) mounts the component. This branch commits geometry + adapters + tests + `app.json` plugin + docs.                                        | Critic ruling; Lens 1 §React composition boundary |
| Screenshots + PR-READY signal on this branch                                                | **Removed.** On-device visual proof belongs to the composition card (there is no component to shoot yet). Runbook completion = install succeeds + `expo doctor` green + `npm run typecheck / lint / test / web:build` green + reversal recipe documented. Screenshots + `gh pr ready` gate move to VOICE-005-composition / VOICE-007.                                    | Critic ruling                     |

### 0.2 Explicit VOICE-004 non-replayability inheritance

VOICE-005 does not compute a new non-replayability guarantee. It **inherits** VOICE-004's by construction:

1. **VOICE-004 property:** the finalized `VoiceWaveformArtifact.amplitudeBuckets` is 8-bit quantized (`Math.round(x * 255) / 255`, waveformSessionMachine.ts:274). This bounds artifact entropy to 256 × 8 = 2048 bits and defeats amplitude-LSB steganographic channels.
2. **VOICE-005 property:** `bucketsToPathSegments` is a pure function of `(buckets, layout)` with NO external state, NO clock reads, NO PRNG, NO trig / sqrt / atan. It calls `quantizeBucketsForRender` as step 1 (idempotent — `quantize8bit(quantize8bit(x)) === quantize8bit(x)` for all `x ∈ [0,1]`, so finalized buckets pass through byte-identical, and live buckets collapse to the same 256-level lattice).
3. **Composite property:** for any pair `(buckets_live, buckets_finalized)` where `buckets_finalized = buckets_live.map(quantize8bit)`, `bucketsToPathSegments(buckets_live, layout)` deep-equals `bucketsToPathSegments(buckets_finalized, layout)`. Live render and finalized render are geometrically identical; the path is a pure function of the 8-bit lattice.

### 0.3 ADR-002 boundary the visualizer must NOT cross

Per VOICE-ADR-002 §5 (audio-source discriminant): the visualizer renders **only** the pre-existing `amplitudeBuckets` field. It never reads raw PCM, never touches the temp cache file, never consumes `activeDurationMs` / `meanLevel` / `peakLevel` as a visible label, never renders text derived from any acoustic scalar, never uses colour / opacity / animation timing correlated to sample content (per LEAK-1 / LEAK-3 / LEAK-4 / LEAK-5 / LEAK-6 in Lens 1). The doctrine source-scan (§6) enforces every one of those bans at commit time.

---

## §1 — File manifest with arming classification

Every file in this table is either committed on this branch (`commit_now`), executed by the operator per the runbook (`operator_step_only`), or referenced by the runbook but never touched by anyone in this card (`documented_in_runbook_only`).

| Path                                                                                                | Purpose                                                                                                                                                                                                | Arming                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `src/features/voice/visualizer/pathSegment.types.ts`                                                | `PathSegment` discriminated union (`{type:'M'|x|y} | {type:'L'|x|y} | {type:'Z'}`), `VisualizerLayout` interface, `SkiaPathLike` local duck-typed interface.                                             | commit_now                    |
| `src/features/voice/visualizer/quantizeBucketsForRender.ts`                                         | Pure `quantizeBucketsForRender(readonly number[]) => readonly number[]`. Applies `clamp01` (non-finite / negative / >1 → safe) then `Math.round(x * 255) / 255`. Idempotent.                             | commit_now                    |
| `src/features/voice/visualizer/bucketsToPathSegments.ts`                                            | The geometry core. Layout precondition validation → `quantizeBucketsForRender` → mirrored-bar segment emission around `centerlineY`. Empty / single / 256-max handled.                                  | commit_now                    |
| `src/features/voice/visualizer/pathSegmentsToSvgD.ts`                                               | `pathSegmentsToSvgD(readonly PathSegment[]) => string`. Emits `toFixed(3)` per number for cross-engine byte-identity.                                                                                    | commit_now                    |
| `src/features/voice/visualizer/applyPathSegmentsToSkiaPath.ts`                                      | `applyPathSegmentsToSkiaPath(SkiaPathLike, readonly PathSegment[]) => void`. No `@shopify/react-native-skia` import — parameter is duck-typed.                                                            | commit_now                    |
| `src/features/voice/visualizer/index.ts`                                                            | Barrel. Exports every name above plus `bucketsToPath` convenience (`bucketsToPathSegments` + `pathSegmentsToSvgD` composition).                                                                          | commit_now                    |
| `src/features/voice/visualizer/__tests__/bucketsToPathSegments.test.ts`                             | 15+ scenarios per the test matrix (§7). Determinism, geometry, defensive clamps, live-vs-finalized parity, cross-module identity.                                                                       | commit_now                    |
| `src/features/voice/visualizer/__tests__/pathSegmentsToSvgD.test.ts`                                | Golden `d`-string fixtures for empty / single / 8-bucket; `toFixed(3)` locale-safety proof; byte-identity across module re-imports.                                                                     | commit_now                    |
| `src/features/voice/visualizer/__tests__/applyPathSegmentsToSkiaPath.test.ts`                       | Fake `SkiaPathLike` records `['moveTo'|x|y]` / `['lineTo'|x|y]` / `['close']`; parametric parity assertion with the SVG-joiner over the canonical shape set.                                            | commit_now                    |
| `src/features/voice/visualizer/__tests__/quantizeBucketsForRender.test.ts`                          | Idempotence property test over the 256-lattice; `clamp01` boundary; parity with VOICE-004's `quantize8bit` on shared inputs; `toFixed(3)` locale-neutrality.                                             | commit_now                    |
| `src/features/voice/visualizer/__tests__/voice005ForbiddenInferenceGuard.test.ts`                   | Source-scan of `src/features/voice/visualizer/**/*.{ts,tsx}` for the VOICE-004 forbidden lexicon + visualizer bans (§6) + module-level mutability bans + trig/non-basic-arith bans + Skia SVG-parser ban. | commit_now                    |
| `src/features/voice/visualizer/__tests__/__fixtures__/voice005ForbiddenInferenceGuard.probe.ts.txt` | Firing positive-control fixture. Contains banned tokens (`Math.random()`, `Date.now()`, `voice signature`, `MakeFromSVGString`). `.ts.txt` so it does not compile.                                       | commit_now                    |
| `src/features/voice/visualizer/__tests__/reducerIntegration.test.ts`                                | Cross-module test: drive `USER_START → N × level_sample → stream_end` through `reduceWaveformSession`, render on every step, assert (a) IGNORE identity, (b) live→finalized convergence.                | commit_now                    |
| `src/features/voice/visualizer/__tests__/appJsonPluginContract.test.ts`                             | Parses `app.json`; asserts `plugins[0] === ['expo-audio', {microphonePermission: <exact doctrine copy>}]`; catches wording drift + typo (`microphonePermissions`, `micPermission`) before prebuild.       | commit_now                    |
| `app.json`                                                                                          | Add `plugins` array (single `expo-audio` tuple entry with the doctrine mic-permission copy). Additive; git diff is one hunk. Inert without the operator install.                                        | commit_now                    |
| `docs/designs/VOICE-005.md`                                                                         | This file. Design + runbook cross-reference + reviewer summary.                                                                                                                                          | commit_now                    |
| `docs/runbooks/VOICE-005-install-runbook.md`                                                        | The operator-facing recipe: preconditions, numbered install steps with commands + expected output + verification greps + rollback branch, doctrine reminders.                                            | commit_now                    |
| `src/features/voice/visualizer/VoiceWaveformVisualizer.tsx`                                         | React component that subscribes to `state.amplitudeBuckets`, mounts `<Canvas>+<SkiaPath>` primary or `<Svg>+<Path/>` fallback. **Not committed** — statically importing native deps breaks `web:build`.  | documented_in_runbook_only    |
| `package.json` / `package-lock.json`                                                                | Operator runs `npx expo install @shopify/react-native-skia expo-audio react-native-svg`. Version pins picked by expo compat manifest. **Not committed on this branch** (would break `npm ci` on CI).      | operator_step_only            |
| `ios/**`, `android/**`                                                                              | Regenerated by `npx expo prebuild --clean`. Untracked (Expo convention). The runbook explicitly forbids committing them from this branch — freezes VOICE-002's future decision.                          | operator_step_only            |
| `eas.json`                                                                                          | Not created on this branch. Operator can add it as a separate step if they want EAS dev builds; local `npx expo run:ios` / `run:android` is the recommended spike path.                                  | documented_in_runbook_only    |
| `.env` (operator-local) / `EXPO_PUBLIC_VOICE_005_SPIKE_ENABLED`                                     | No flag added on this branch (no component to gate). Deferred to VOICE-005-composition / VOICE-007.                                                                                                      | documented_in_runbook_only    |
| `App.tsx`                                                                                           | Not touched on this branch. Composition wiring belongs to VOICE-005-composition / VOICE-007.                                                                                                            | documented_in_runbook_only    |

---

## §2 — Pure-TS geometry primitive (`bucketsToPathSegments`)

The deterministic core. One function; one shape; two adapters consume the output. Signature and contract below are the implementer contract — the implementer writes to this signature verbatim.

### 2.1 Types

```ts
// pathSegment.types.ts

export type PathSegment =
  | { readonly type: 'M'; readonly x: number; readonly y: number }
  | { readonly type: 'L'; readonly x: number; readonly y: number }
  | { readonly type: 'Z' };

export interface VisualizerLayout {
  readonly width: number;              // required, must be finite and > 0
  readonly height: number;             // required, must be finite and > 0
  readonly centerlineY?: number;       // defaults to height / 2
  readonly barGapPx?: number;          // defaults to 1; clamped to [0, +inf)
  readonly minBarWidthPx?: number;     // defaults to 0.5; clamped to (0, +inf)
}

// Duck-typed local Skia surface. NO import from @shopify/react-native-skia.
export interface SkiaPathLike {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  close(): void;
}
```

### 2.2 Signature

```ts
export function bucketsToPathSegments(
  buckets: readonly number[],
  layout: VisualizerLayout,
): readonly PathSegment[];
```

Preconditions checked FIRST (before quantize, before geometry):

- `Number.isFinite(layout.width) && layout.width > 0` — else return `[]` (visualizer renders nothing, no throw).
- `Number.isFinite(layout.height) && layout.height > 0` — else return `[]`.
- `layout.centerlineY`: if omitted or non-finite, defaults to `layout.height / 2`; if provided, clamped into `[0, layout.height]`.
- `layout.barGapPx`: if omitted or non-finite or negative, defaults to `1`; clamped to `[0, +inf)`.
- `layout.minBarWidthPx`: if omitted or non-finite or non-positive, defaults to `0.5`.

Then:

1. `const q = quantizeBucketsForRender(buckets)` — clamp01 + `Math.round(x * 255) / 255` per bucket. Idempotent.
2. Empty case (`q.length === 0`): return `[{ type: 'M', x: 0, y: cy }, { type: 'L', x: layout.width, y: cy }]` — centerline "mic-on-before-speaking" cue.
3. Otherwise: `const rawBarWidth = layout.width / q.length; const barWidth = Math.max(rawBarWidth - barGapPx, minBarWidthPx)`. Emit one rectangle per bucket: for bucket `i` at amplitude `b`, `const x = i * rawBarWidth; const halfH = (b * layout.height) / 2; const yTop = cy - halfH; const yBot = cy + halfH;` push `M(x,yTop) L(x+barWidth,yTop) L(x+barWidth,yBot) L(x,yBot) Z`. (Note: the FULL bar width uses `rawBarWidth` for x-stepping so bars fill the layout; `barWidth` is the DRAWN width so gaps are visible.)

### 2.3 Coordinate + fp determinism

- **Only** `+ - * /` and `Math.round`, `Math.max`, `Math.min`, `Math.abs`, `Math.floor`, `Math.ceil`. Trig / sqrt / atan / pow / log / exp / hypot / cbrt are **BANNED** in the visualizer folder (source-scan §6). This is what makes the underlying IEEE-754 arithmetic bit-exact across V8 / JSC / Hermes.
- **No `Math.random`, `Date.now`, `performance.now`, `requestAnimationFrame`** — banned by source-scan.
- **No `let` / `var` at module scope** — banned by source-scan. `const` only.
- Numbers emitted from `pathSegmentsToSvgD` are pinned via `Number.prototype.toFixed(3)` at the join boundary. `toFixed` is locale-neutral per ECMA-262; §7 asserts it.

### 2.4 Non-replayability invariant (INV-A)

> The path is a pure function of `(buckets, layout)`. No external state may influence it. For any pair `(buckets, layout)`, `bucketsToPathSegments(buckets, layout)` deep-equals `bucketsToPathSegments(buckets, layout)` across module re-imports and across engines.

Enforced by (a) the source-scan doctrine guard (§6), (b) the property-style test that walks the 256-lattice (§7 scenario 11), (c) the `toFixed(3)` locale-safety test (§7 scenario 15).

### 2.5 Bar-mirror ruling (rejected: smooth curves)

Bar-mirror is the terminal aesthetic for v1. Smooth curves (Catmull-Rom / quadratic Bezier / Skia's built-in smooth) require `sqrt` / `atan` / interpolation, opening LEAK-3 (fp non-determinism across engines) and LEAK-1 (interpolation-with-external-state if the kernel is not a pure fn of buckets alone). Bar-mirror is also 1:1 with buckets — no inter-bucket interpolation, no rate-carrier surface. Voice Memos / WhatsApp voice notes / Slack voice messages all use bar-mirror; user expectation is set. Smooth kernels defer to a follow-up card if UX preference data pushes back.

---

## §3 — Skia adapter (handcrafted commands, not `MakeFromSVGString`)

### 3.1 Signature

```ts
export function applyPathSegmentsToSkiaPath(
  path: SkiaPathLike,
  segments: readonly PathSegment[],
): void;
```

Iterate segments in order. For `M` call `path.moveTo(x, y)`; for `L` call `path.lineTo(x, y)`; for `Z` call `path.close()`. No coordinate re-derivation, no reordering, no numeric transform.

### 3.2 Why NOT `Skia.Path.MakeFromSVGString`

The Skia SVG parser is outside our test surface. A Skia release upgrade could silently change how it interprets `M` / `L` / `Z` (whitespace tolerance, number precision, path-close semantics). That drift would retroactively break non-replayability: the SAME finalized `VoiceWaveformArtifact` would produce a DIFFERENT rendered path on the next Skia release. Handcrafted commands eliminate the parser dependency. The source-scan (§6) bans the string `MakeFromSVGString` in every visualizer file to prevent regression.

### 3.3 Test scaffolding — fake `SkiaPathLike`

Adapter tests use a fake path that records every call to a `readonly (['moveTo', number, number] | ['lineTo', number, number] | ['close'])[]` array:

```ts
function makeFakeSkiaPath() {
  const calls: (readonly ['moveTo' | 'lineTo', number, number] | readonly ['close'])[] = [];
  return {
    path: {
      moveTo: (x: number, y: number) => calls.push(['moveTo', x, y] as const),
      lineTo: (x: number, y: number) => calls.push(['lineTo', x, y] as const),
      close: () => calls.push(['close'] as const),
    } satisfies SkiaPathLike,
    calls,
  };
}
```

Parametric parity assertion: for every `PathSegment[]` emitted by `bucketsToPathSegments` across the §7 test matrix, the fake path's recorded call sequence has (a) SAME length as the SVG `d` string's command count and (b) SAME coordinates rounded to 3 dp as the SVG `d` string's inline numbers.

---

## §4 — Live sampling boundary (THE crux)

### 4.1 Options considered

The card brief listed four options:

- **(a) Subscribe to reducer state's live buckets** — CHOSEN.
- (b) Fold locally in the visualizer component — rejected (forks `halveBucketsPairMax`, doubles source of truth).
- (c) Per-sample re-entry into the reducer's purity boundary — rejected (breaks the pure-fn contract; would require a mutable escape hatch).
- (d) Add a new `latestInterimBuckets` state field on the reducer — rejected (mutates a shipped module for no gain — the existing `amplitudeBuckets` field is already on state during `accumulating`).

### 4.2 The grounding correction

The card brief claimed `amplitudeBuckets` is "produced ONLY on finalize". Grounding proves otherwise:

- `WaveformSessionMachineState.amplitudeBuckets: readonly number[]` (waveformSessionMachine.ts:108) — the field is on the reducer state at every state, not just terminal.
- `initialWaveformSessionState()` returns `{ ..., amplitudeBuckets: [] }` (waveformSessionMachine.ts:130-138).
- The `level_sample` fold assigns the new bucket array back to `nextState.amplitudeBuckets` on every sample (waveformSessionMachine.ts:445).
- `makeArtifact` reads `state.amplitudeBuckets` and runs `.map(quantize8bit)` at terminal fold (waveformSessionMachine.ts:274-275).

So the live buckets ARE on state — they are just **not yet 8-bit quantized**. The visualizer's defensive re-quantize inside `bucketsToPathSegments` collapses the live floats onto the same 256-level lattice the finalized artifact uses. Because `quantize8bit` is idempotent, finalized buckets pass through byte-identical.

### 4.3 The chosen approach

The React component (VOICE-005-composition / VOICE-007) subscribes to `state.amplitudeBuckets` via a `useSyncExternalStore`-style selector (getSnapshot returns `state.amplitudeBuckets`). The reducer already returns a NEW bucket array on every `level_sample` fold (`buckets.slice()` per line 214 of `waveformSessionMachine.ts`), so reference equality is a correct re-render signal. On every re-render the component calls `bucketsToPathSegments(state.amplitudeBuckets, layout)` and hands the segments to whichever adapter is active. The subscription pattern itself is a VOICE-007 concern — this card ships the geometry primitive that the subscription will feed.

### 4.4 Terminal-state behaviour (INV-B)

The reducer's blanket-IGNORE for `level_sample` from terminal states (finalized / aborted / no_signal / error / unavailable) preserves state reference (waveformSessionMachine.ts INV-B6, lines 507, 546, 561, 573, 585, 597, 609). The visualizer therefore renders the last frame indefinitely once terminal — no crash on late metering, no stale re-render, no divergence between live and finalized geometry.

### 4.5 Backgrounding / `AVAILABILITY_LOST` behaviour

`toUnavailable` (waveformSessionMachine.ts:389-395) spreads state and only overwrites `state: 'unavailable'` — `amplitudeBuckets` reference is preserved by identity. The visualizer freezes at its last frame; on re-foreground the operator must `USER_RESET` + `USER_START` to re-arm. Documented; tested (§7 scenario 2).

### 4.6 `USER_RESET` behaviour

`USER_RESET` from finalized returns `initialWaveformSessionState()`, which has `amplitudeBuckets: []`. The visualizer snaps to the centerline (empty-buckets case). Multi-session reuse is safe.

---

## §5 — Spike component (documented, NOT committed on this branch)

The React component is deferred. This section documents the intended composition so VOICE-005-composition / VOICE-007 can pick it up without re-deriving it. Nothing here is a commit on this branch.

### 5.1 Intended shape

```tsx
// src/features/voice/visualizer/VoiceWaveformVisualizer.tsx (FUTURE — VOICE-007)

import { Platform, View } from 'react-native';
import { useSyncExternalStore, useMemo } from 'react';
import type { WaveformSessionMachineState } from '../waveform/waveformSessionMachine';
import { bucketsToPathSegments, pathSegmentsToSvgD, applyPathSegmentsToSkiaPath } from './index';

// Callers pass in the store's subscribe + getSnapshot (this file does not know Zustand / redux / etc).
type Subscription = {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => WaveformSessionMachineState;
};

export function VoiceWaveformVisualizer({
  session,
  width,
  height,
  rendererOverride,
}: {
  session: Subscription;
  width: number;
  height: number;
  rendererOverride?: 'skia' | 'svg';
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const segments = useMemo(
    () => bucketsToPathSegments(state.amplitudeBuckets, { width, height }),
    [state.amplitudeBuckets, width, height],
  );

  const renderer = rendererOverride ?? (Platform.OS === 'web' ? 'svg' : 'skia');

  if (renderer === 'skia') {
    // Skia path: platform.select or dynamic require behind Platform.OS !== 'web'
    // ensures @shopify/react-native-skia never enters the web bundle graph.
    // ...
  } else {
    // SVG fallback path.
    const d = pathSegmentsToSvgD(segments);
    // <Svg width={width} height={height}><Path d={d} .../></Svg>
  }
}
```

### 5.2 Web-bundle guard for VOICE-007

The composition card must import Skia via `Platform.select` at import site (or a `.native.tsx` / `.web.tsx` file split) so Metro's web branch STATICALLY excludes `@shopify/react-native-skia`. Flag-gating (`EXPO_PUBLIC_VOICE_005_SPIKE_ENABLED`) does NOT prevent Skia from entering the web bundle graph — the import would still be static at build time (per the memory index "Expo web static env inlining" — `EXPO_PUBLIC_*` reads are inlined by babel-preset-expo but do not shake unused static imports). Reject flag-based bundle exclusion; prefer file-split.

### 5.3 Permission-denied UX

When `state.state === 'unavailable'` AND `state.amplitudeBuckets.length === 0`, the composing component (VOICE-007) MUST show a plain-text banner with the exact copy:

> **"Microphone access is required to show the audio-level bar. Enable it in Settings and try again."**

The pure renderer falls back to the empty-buckets case (centerline). This copy is pinned in the doctrine-approved-copy whitelist so no one can silently swap it for inference-shaped drift ("We could not detect your voice — try speaking clearly", etc.). The composition card owns the banner; this card owns the whitelist entry (§6.2).

### 5.4 Renderer override for testing

VOICE-007 accepts `rendererOverride?: 'skia' | 'svg'` on all platforms so the SVG fallback is reachable on native for isolation testing. In dev builds a debug toggle flips it; in production the default remains Platform-driven.

---

## §6 — Doctrine invariants

### 6.1 Non-replayability tri-fold (INV-A / INV-B / INV-C)

- **INV-A (purity):** `bucketsToPathSegments` is a pure function of `(buckets, layout)`. Enforced by source-scan (§6.3) banning `Math.random`, `Date.now`, `performance.now`, `requestAnimationFrame`, module-level `let` / `var`, and imports of React hooks / the reducer.
- **INV-B (idempotent quantize):** `quantizeBucketsForRender(quantizeBucketsForRender(x)) === quantizeBucketsForRender(x)` for all `x`. Enforced by property-style test over the 256-lattice (§7 scenario 11).
- **INV-C (adapter-agnostic geometry):** for the same segments, the Skia adapter and the SVG adapter produce geometrically identical paths (same coordinates in same order at 3 dp precision). Enforced by parametric parity test (§7 scenario 8).

### 6.2 Forbidden-inference guard — `voice005ForbiddenInferenceGuard.test.ts`

Mirrors VOICE-004's guard pattern. Source-scans `src/features/voice/visualizer/**/*.{ts,tsx}` (excluding `__tests__/__fixtures__/`).

**Inherited from VOICE-003 / VOICE-004 (verbatim copy-and-extend):**

`emotion, tone, stress, arousal, energy-as-trait, shouting, whisper, aggression, dominance, speaker_id, speaker-identity, biometric, sentiment, formant, phoneme, spectrogram, fft, mfcc, prosody, pitch, envelope-as-signal-feature, raw_pcm, sample_buffer, credibility, sincerity, intent, truth, confidence`

**VOICE-005-specific additions:**

`voice signature, vocal print, prosody visualization, voice_print, voiceprint, waveform_fingerprint, audio_fingerprint`

**Purity bans:**

`Math.random, Date.now, performance.now, requestAnimationFrame, cancelAnimationFrame, setTimeout, setInterval, setImmediate`

**Non-basic-arith bans (visualizer folder only):**

`Math.sin, Math.cos, Math.tan, Math.asin, Math.acos, Math.atan, Math.atan2, Math.sqrt, Math.exp, Math.log, Math.log2, Math.log10, Math.pow, Math.cbrt, Math.hypot, Math.sign, Math.sinh, Math.cosh, Math.tanh`

**Import bans (visualizer folder only):**

`@shopify/react-native-skia, react-native-svg, expo-audio, expo-sensors, react-native-sensors, react` (the pure module has zero React imports), `../waveform/waveformSessionMachine` (the pure renderer must not import the reducer — the composing component does), any React hook (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useSyncExternalStore`).

**Structural bans:**

- No top-level `let` or `var` in visualizer files (`const` only). AST-lite regex acceptable.
- No `MakeFromSVGString` string literal anywhere in the folder.

**Firing positive-control fixture:** `src/features/voice/visualizer/__tests__/__fixtures__/voice005ForbiddenInferenceGuard.probe.ts.txt` contains at least one hit for EACH ban category (e.g. `const x = Math.random(); const y = Date.now(); const z = 'voice signature'; import 'react'; let mutable = 0; Math.sin(0); Skia.Path.MakeFromSVGString('M0,0');`). The scanner MUST hit the fixture; if it does not, the scanner is a silent no-op and the test fails (positive-control lesson from the memory index — "Doctrine scanner apostrophe gotcha").

### 6.3 Reviewer heuristic

If a future PR adds a new file under `src/features/voice/visualizer/` that imports `@shopify/react-native-skia` OR `react-native-svg`, the source-scan fires and CI goes red before merge. The pure renderer promise "installable in plain Node jest" is enforced at commit time.

---

## §7 — Test plan

Every test in this section runs in `jest` on this branch WITHOUT any native install. `web:build` is not required (the visualizer folder has zero native / web-only imports).

### 7.1 Pre-install tests (this branch, `npm run test` gate)

| #   | Scenario                                                                                                                                       | Invariant                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Empty buckets → `[{M, x:0, y:cy}, {L, x:width, y:cy}]`. SVG `d = 'M0.000 30.000 L300.000 30.000'`.                                              | Empty renders a visible centerline (mic-on-before-speaking cue); no throw.                                                                            |
| 2   | Single bucket `0.5`, layout `100x40`. One rectangle centred at `x:0..100`, `y:10..30`.                                                          | Single-bucket fills width; no divide-by-zero.                                                                                                        |
| 3   | 8 all-zero buckets, layout `400x80`. 8 zero-height ticks along `cy:40`.                                                                          | All-zero is visibly alive but silent (proves the visualizer, not empty state).                                                                       |
| 4   | 64 varied buckets `b_i = 0.1 + 0.9 * (i % 8) / 8`, layout `640x100`. 64 mirrored bars, `rawBarWidth: 10`, `barWidth: 9`.                        | Bar count = bucket count; total x-span = layout.width; no overlap.                                                                                    |
| 5   | 256 buckets (MAX_AMPLITUDE_BUCKETS boundary) filled 0.5, layout `512x60`. 256 bars, `barWidth: 1`.                                              | Boundary is safe; no allocation blowup; deterministic.                                                                                               |
| 6   | All-ones buckets. Bars span full height. Y coordinates stay within `[0, layout.height]`.                                                        | Clamping to full height without overflow.                                                                                                            |
| 7   | Alternating `0` / `1` buckets. Zero-height ticks and full-height bars alternate strictly in x order.                                            | No inter-bucket smoothing; each bar independent of neighbour.                                                                                        |
| 8   | Byte-equal double call. `bucketsToPathSegments(x, l)` deep-equals `bucketsToPathSegments(x, l)`; SVG `d` strings `===`.                          | INV-A purity — no random, no clock, no global state.                                                                                                  |
| 9   | Live-vs-finalized parity. For raw `[0.501, 0.502, 0.503]` and quantized `raw.map(quantize8bit)`, segments deep-equal.                             | INV-B — live view renders identically to finalized view because renderer quantizes internally.                                                        |
| 10  | Defensive clamp of non-finite / OOB. `[NaN, -0.5, 1.5, Infinity]` treated as `[0, 0, 1, 0]`. No throw.                                            | Adversarial inputs map to safe amplitudes; NaN never becomes a peak.                                                                                 |
| 11  | Property test over the 256-lattice. For every `k ∈ [0, 255]`, `quantizeBucketsForRender([k/255])[0] === k/255` AND segments match `[quantize8bit(k/255)]`. | Fixed-point of quantize; live-vs-finalized parity at every lattice point.                                                                             |
| 12  | Layout defensive. `width: 0`, `height: 0`, `width: -1`, `width: NaN`, `centerlineY: -5`, `barGapPx: -1`, `minBarWidthPx: -1`. All return safely without throwing. | Degenerate layouts return `[]` or safely-clamped values.                                                                                              |
| 13  | `barGapPx > rawBarWidth` degrades gracefully. 200 buckets, `width: 100`, `barGapPx: 5`. `barWidth` clamps to `minBarWidthPx`. No negative widths in `d`.       | Bar overlap does not produce solid rectangle; layout stays inside width.                                                                              |
| 14  | SVG-joiner golden fixture. Three canonical shapes (empty / single / 8-bucket) checked against `__tests__/__fixtures__/*.svg.txt` byte-for-byte.  | Cross-engine byte-identity via string equality with a checked-in pin.                                                                                 |
| 15  | `toFixed(3)` locale-neutrality. Numbers `1234.5678, 0.0005, -0` formatted; separator is `.`; no thousands separator.                             | Pins engine-upgrade safety.                                                                                                                          |
| 16  | Skia-adapter parity. For each canonical shape, fake `SkiaPathLike` records `['moveTo'|x|y]` etc.; length matches SVG command count; coordinates match SVG numbers at 3 dp. | INV-C — Skia and SVG render the same geometry from the same segments.                                                                                 |

### 7.2 Cross-module integration tests (this branch)

| #   | Scenario                                                                                                                                                       | Invariant                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 17  | Drive `initialWaveformSessionState() → USER_START → N × level_sample → stream_end` through `reduceWaveformSession`. On every step call `bucketsToPathSegments(state.amplitudeBuckets, layout)`. Assert segment count grows monotonically (or stays flat during pair-max halving at N > 256). Assert finalized artifact's `amplitudeBuckets` produce segments deep-equal to the LAST live segments. | Live view converges to finalized view — the doctrinal claim the whole card rests on.                                          |
| 18  | Reduce `level_sample` against each terminal state (finalized / aborted / no_signal / error / unavailable). Assert `nextState === state` (`Object.is` — INV-B6). Assert `bucketsToPathSegments(nextState.amplitudeBuckets, l)` deep-equals `bucketsToPathSegments(state.amplitudeBuckets, l)`. | Late metering is a no-op end-to-end; visualizer holds its last frame.                                                        |
| 19  | Reduce `AVAILABILITY_LOST` from `accumulating` with N buckets. Assert `nextState.amplitudeBuckets === state.amplitudeBuckets` (reference identity via `toUnavailable` spread). Assert both bucket arrays render deep-equal segments. | Backgrounding freezes the visualizer at its last frame.                                                                       |
| 20  | Reduce `USER_RESET` from finalized state with N buckets. Assert `nextState.amplitudeBuckets` = `[]` (via `initialWaveformSessionState`). Assert `bucketsToPathSegments([], layout)` = centerline segments. | Multi-session reuse snaps back to centerline.                                                                                 |
| 21  | Sample count exactly at `MIN_SAMPLES_FOR_FINALIZED` (3): finalized with 3 buckets → 3 mirrored bars. Sample count = 2: no_signal with 2 buckets → 2 mirrored bars. | Visualizer works at the reducer's smallest legal outputs.                                                                     |

### 7.3 Doctrine + contract tests (this branch)

| #   | Scenario                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22  | `voice005ForbiddenInferenceGuard.test.ts` scans production files, asserts zero hits. Then scans the positive-control fixture, asserts hits for EACH ban category. Scanner is not a silent no-op. |
| 23  | Web:build-safe import guard. AST-lite test asserts no file under `src/features/voice/visualizer/**/*.ts` imports `@shopify/react-native-skia`, `react-native-svg`, `expo-audio`, or `react`.  |
| 24  | `appJsonPluginContract.test.ts` parses `app.json`, asserts `plugins.length === 1`, `plugins[0][0] === 'expo-audio'`, `plugins[0][1].microphonePermission === '<exact doctrine copy>'` (string equality, not substring). Catches typos (`microphonePermissions`, `micPermission`) that would silently no-op. |
| 25  | Module re-import identity. Import `bucketsToPathSegments` twice via `jest.isolateModules`; assert same input yields byte-identical output across the two import cycles.                       |

### 7.4 Post-install operator gates (runbook, NOT this branch's `npm run test`)

Documented in §8; not part of the branch CI:

- `npx expo doctor` exits 0 (or only known-yellow items).
- `npx expo prebuild --clean` generates `ios/` + `android/`.
- `grep -c 'NSMicrophoneUsageDescription' ios/*/Info.plist` = 1, string matches the doctrine copy byte-for-byte.
- `grep -c 'android.permission.RECORD_AUDIO' android/app/src/main/AndroidManifest.xml` = 1.
- `grep -ci 'RECORD_AUDIO_BACKGROUND\|FOREGROUND_SERVICE_MICROPHONE' android/app/src/main/AndroidManifest.xml` = 0 (background flag stayed off).

On-device visual proof (Skia render, SVG fallback, mode-switch no-crash, permission-denial banner) belongs to VOICE-005-composition / VOICE-007, NOT this card.

---

## §8 — Operator runbook (summary; full file at `docs/runbooks/VOICE-005-install-runbook.md`)

The runbook is a single monolithic file under `docs/runbooks/` (matches ARCH-001-CARD3, cutover-health-monitor, client-plane-verify, stage1-observation, stage1-local-operator-secrets, email-provider-setup, client-plane-verify-runbook precedent). It contains preconditions, 8 numbered steps, and 3 appendices.

### 8.1 Preconditions (hard checklist — operator confirms ALL before step 1)

1. OS is Windows 11 / macOS / Linux (Windows operators use Git Bash, not PowerShell — matches existing runbook shell dialect).
2. Node version matches `package.json` `engines`.
3. `git status` in `C:\Users\kyler\cdiscourse\wt-voice005` (or clone) is clean; branch = `feat/voice-005-visualizer`; up-to-date with origin.
4. `npm run typecheck && npm run lint && npm run test && npm run web:build` all green on the current commit (the reversibility floor).
5. The operator has read VOICE-ADR-002 §5 (audio-source discriminant) so they know why the mic-permission copy says what it says.
6. The operator understands the runbook does NOT ship an on-device dev build in this card. Screenshots + `gh pr ready` gate belong to VOICE-005-composition / VOICE-007.

### 8.2 Numbered steps (5-field template per step: command | expected output | verification | if-failed branch | reversibility)

1. **Baseline confirmation.** `npm run typecheck && npm run lint && npm run test && npm run web:build`. Expected: all exit 0. Verification: `git status --porcelain` = clean. If-failed: abort, fix baseline first. Reversibility: N/A (read-only).
2. **Install the three deps.** `npx expo install @shopify/react-native-skia expo-audio react-native-svg`. Expected: `package.json` gains 3 deps, `package-lock.json` regenerated. Verification: `npx expo doctor` exits 0 (or only known-yellow items). If-failed: Appendix C by exit code. Reversibility: `git checkout package.json package-lock.json && rm -rf node_modules && npm install`.
3. **Do NOT commit `package.json` / `package-lock.json`.** Runbook explicitly forbids `git add package*.json`. These are operator-local for this card.
4. **Optional: prebuild.** `npx expo prebuild --clean`. Expected: `ios/` and `android/` dirs appear (untracked). Verification: `grep -c 'NSMicrophoneUsageDescription' ios/*/Info.plist` returns `1` and the surrounding string matches `app.json` `plugins[0][1].microphonePermission` byte-for-byte. `grep -ci 'RECORD_AUDIO_BACKGROUND\|FOREGROUND_SERVICE_MICROPHONE' android/app/src/main/AndroidManifest.xml` returns `0`. If-failed: Appendix C. Reversibility: `git clean -fdx ios android`.
5. **Do NOT commit `ios/` / `android/`.** These are ephemeral CNG outputs. Runbook explicitly forbids `git add ios android` — freezes VOICE-002's future decision.
6. **Post-install branch CI.** `npm run typecheck && npm run lint && npm run test && npm run web:build`. Expected: all exit 0. Web bundle grep for `@shopify/react-native-skia` returns 0 hits (visualizer folder is Skia-free; if the component were committed and imported Skia statically, this would fail — this step proves the "pure renderer" promise). If-failed: back out.
7. **Reversal recipe (if the spike is aborted).** `git checkout main && git clean -fdx ios android node_modules && npm ci`. Expected: back at baseline; typecheck / lint / test / web:build all green; `app.json` `plugins` key gone; three deps gone. Reversibility floor confirmed.
8. **Cross-reference for the composition card.** Runbook links to `docs/designs/VOICE-005.md` §5 (spike component composition) so VOICE-005-composition / VOICE-007 has the intended shape without re-deriving it.

### 8.3 Appendix A — mic-permission copy (single source of truth)

> **`microphonePermission`: `"CivilDiscourse uses your microphone only to visualize your voice while you speak. Audio is not recorded, saved, or uploaded."`**

Rules:

- The copy lives in `app.json` `plugins[0][1].microphonePermission`. NEVER hand-write `ios.infoPlist.NSMicrophoneUsageDescription` or `android.permissions.RECORD_AUDIO` alongside — the plugin overwrites both on prebuild and double-source-of-truth is the classic app-review reject cause.
- `microphonePermission` key spelling is camelCase. Wrong casing (`microphonePermissions`, `micPermission`) silently no-ops. `appJsonPluginContract.test.ts` catches it before prebuild.
- `enableBackgroundRecording` MUST stay at its default `false` (ADR-002 §5). Never add it to the plugin config.
- Apple app-review rejects vague strings. This copy names the purpose (visualize) AND explicitly denies recording / saving / uploading.

### 8.4 Appendix B — rollback quick-ref (4 named scenarios)

- **R1: Prebuild succeeded but native build later fails.** `git clean -fdx ios android` (regenerate cleanly on next prebuild).
- **R2: `npm ci` fails after checkout.** `rm -rf node_modules package-lock.json && npm install`.
- **R3: Screenshots (in the FUTURE composition card) reveal doctrine-forbidden UI copy.** Do NOT merge; comment on PR with the exact copy string; file a follow-up card; keep PR draft.
- **R4: This card's `app.json` change already merged to `main` and broke prebuild for another workflow.** `git revert -m 1 <merge-sha> && git push origin main`. Re-trigger any downstream Netlify build.

### 8.5 Appendix C — troubleshooting tree (indexed by symptom)

- "expo doctor: package.json declares a dependency on X but the installed version is Y" → `rm -rf node_modules package-lock.json && npm install`; then `npx expo install` again with the failing dep.
- "prebuild: cannot resolve plugin `expo-audio`" → the plugin key was mis-cased in app.json; check `appJsonPluginContract.test.ts` output.
- "iOS prebuild fails with CocoaPods error" → operator's `pod --version` / `xcode-select -p` is stale; runbook step 4 is macOS-only for iOS prebuild.
- "Android prebuild fails with Gradle sync error" → Android SDK not installed / stale; only Skia's C++ compile requires it, so on Windows the operator may skip Android prebuild for this card (the composition card will require it).

---

## §9 — Non-goals

- No React component (`VoiceWaveformVisualizer.tsx`) committed on this branch.
- No `package.json` / `package-lock.json` / `eas.json` / `App.tsx` / `.env.example` diff on this branch.
- No `npx expo install` / `npx expo prebuild` / `eas build` executed by Claude in this card.
- No on-device screenshots or `gh pr ready` promotion mechanic in this card.
- No smooth-curve renderer (Catmull-Rom / Bezier / Skia's smooth) — deferred to a follow-up if UX preference data pushes back.
- No normalized `[0..1]`-coordinate `PathSegment[]` variant (layout-independent) — SVG `viewBox` / Skia transform is simpler and keeps one code path.
- No colour / theme / animation timing coupling — the renderer is geometry-only.
- No memoization of `bucketsToPathSegments` at 60Hz — deferred to a follow-up perf card once we have real device measurements.
- No new reducer state field on VOICE-004 (`latestInterimBuckets`, etc.) — subscription to the existing `state.amplitudeBuckets` suffices.
- No frame-rate throttle in the pure renderer (throttling is a composition-layer concern).
- No live-view via SharedArrayBuffer / worker / etc. — plain state subscription.
- No spectrogram, no FFT, no formant / phoneme / prosody extraction (forbidden per ADR-002; source-scan enforced).
- No test of `Skia.Path.MakeFromSVGString` — the string is banned.

---

## §10 — Boundary (Claude does not do)

- No Anthropic / xAI / X / Supabase API calls.
- No service-role usage.
- No database migration.
- No Edge Function change.
- No feature-flag flip.
- No Netlify / EAS deploy.
- No `npm install` / `npx expo install`.
- No `npx expo prebuild` / `npx expo run:ios` / `npx expo run:android`.
- No `eas build` / `eas login`.
- No `.env` / `.env.bot-tests` / `.env.engagement-intelligence` / `.env.example` edit.
- No web-only dep (no Bootstrap, no jQuery, no anything that fails Metro's native branch).
- No new top-level directory (`docs/operator/` explicitly rejected in favour of existing `docs/runbooks/`).

---

## §11 — Open questions for the operator (small, non-blocking)

1. **Runbook step 4 (prebuild) on Windows.** iOS prebuild requires macOS + Xcode; Windows operators can only prebuild Android in this card. Confirm this is acceptable for the spike (the runbook says yes; the composition card will require both).
2. **Follow-up card ownership.** Panel recommends VOICE-005-composition (a new card) for the React component + on-device proof. Alternative: fold into VOICE-007 if scope permits. Operator ruling requested but non-blocking on THIS card.
3. **Smooth-curve renderer.** Panel recommends deferring. If UX preference data later argues for smooth curves, a new card designs the smoothing kernel as a pure fn of buckets alone (LEAK-1 / LEAK-3 constraints apply).
4. **`.env.example` line for `EXPO_PUBLIC_VOICE_005_SPIKE_ENABLED`.** Not added on this branch (no component to gate). If VOICE-005-composition uses a flag, that card adds the `.env.example` line — this card does not pre-provision.
5. **`docs/operator/` directory.** Panel Lens 3 proposed creating this directory. Rejected — existing `docs/runbooks/` convention wins. If the operator later wants an operator-only doc directory, that is an independent decision.

---

## §12 — Acceptance mapping

Each card AC bullet → the section that satisfies it, plus whether the AC is ratified by commit vs by the operator.

| Card AC bullet                                                          | Satisfied by                                                                      | Ratified by       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------- |
| Pure-TS renderer that turns `amplitudeBuckets` into a path              | §2 (`bucketsToPathSegments`) + §7.1 scenarios 1-16                                | Branch CI (jest)  |
| SVG adapter (`react-native-svg` consumption path)                       | §2.5 + §3.1 (`pathSegmentsToSvgD`) + §7.1 scenarios 14-15                          | Branch CI (jest)  |
| Skia adapter (`@shopify/react-native-skia` consumption path)            | §3 (`applyPathSegmentsToSkiaPath`) + §7.1 scenario 16                              | Branch CI (jest)  |
| Live sampling boundary defined and safe                                 | §4 (all subsections) + §7.2 scenarios 17-21                                        | Branch CI (jest)  |
| Non-replayability preserved (ADR-002 inheritance)                       | §0.2 + §2.4 (INV-A) + §6.1 (INV-A/B/C) + §7.1 scenarios 8-11                       | Branch CI (jest)  |
| Doctrine source-scan guard mirroring VOICE-004                          | §6.2 + §7.3 scenario 22                                                            | Branch CI (jest)  |
| `expo-audio` config plugin wired with doctrine mic-permission copy      | §8.3 + `app.json` diff + §7.3 scenario 24                                          | Branch CI + operator prebuild grep |
| Web-bundle stays clean (no accidental Skia / SVG imports in visualizer) | §6.2 import bans + §7.3 scenario 23                                                | Branch CI (jest)  |
| Native install + prebuild recipe                                        | §8 (runbook summary) + `docs/runbooks/VOICE-005-install-runbook.md` (full)          | Operator          |
| Reversibility floor                                                     | §8.2 step 7 (reversal recipe) + §8.4 (R1-R4)                                       | Operator          |
| On-device visual proof of the live visualizer                           | Deferred to VOICE-005-composition / VOICE-007. Documented as non-goal in §9.        | N/A (out of scope) |
| React component `VoiceWaveformVisualizer.tsx`                            | Deferred to VOICE-005-composition / VOICE-007. Composition documented in §5.        | N/A (out of scope) |

---

## §13 — Implementer note: cannot proceed (2026-08-04)

**Status:** blocked by a factual gap in the design that prevents the `commit_now` file manifest from satisfying the branch reversibility floor. Implementer stopped per role-rules ("If the design is materially wrong ... STOP. Append a clearly-marked 'Implementer note: cannot proceed' section to the design doc, commit that change alone").

### 13.1 The gap

Design §0.1 row 7 and §1 row 15 both classify the `app.json` `plugins` array addition as **commit_now** with the explicit assurance:

> "Additive; git diff is one hunk. **Inert without the operator install.**"

Design §5.2 refines the same claim: "The composition card must import Skia via `Platform.select` ... Flag-gating ... does NOT prevent Skia from entering the web bundle graph." The design correctly diagnoses static-import bundle-graph risk for the React component but implicitly assumes `app.json` plugin registration is inert without the underlying npm module. It is not.

### 13.2 The observed failure

Implementer confirmed by direct verification:

```
$ npm run web:build
> expo export --platform web --output-dir dist

PluginError: Failed to resolve plugin for module "expo-audio" relative to "..."
Do you have node modules installed?
    at resolvePluginForModule (@expo/config-plugins/src/utils/plugin-resolver.ts:52:9)
    at resolveConfigPluginFunctionWithInfo (...:110:50)
    at withStaticPlugin (...:79:47)
    at withPlugins (...:20:59)
    at getConfig (@expo/config/src/Config.ts:217:10)
```

The Expo config resolver walks the `expo.plugins` array eagerly at every `getConfig()` call — including `expo export --platform web` — and calls `require.resolve('<plugin-name>/app.plugin.js')` before it knows or cares whether the plugin is even a native-only plugin. Failure to resolve is a hard `PluginError`, not a warning, and it aborts the build.

Same verification, run again with the `app.json` `plugins` addition stashed:

```
$ git stash push -m "voice005-app-json-only" -- app.json
$ npm run web:build
Exported: dist
EXIT: 0
```

So `web:build` is green without the plugin registration and red with it — but the design mandates the plugin registration on this branch.

### 13.3 Reconciliation candidates (for the designer / operator to rule on)

None of these are within the implementer's scope to pick. Each has trade-offs:

- **(a) Defer the `app.json` plugin registration to VOICE-005-composition** (the same card that adds the React component + installs the deps). Runbook Step 4 becomes: "operator installs `expo-audio` AND edits `app.json` to add the plugin tuple in the same commit." The `appJsonPluginContract.test.ts` cannot ship on this branch (there is nothing yet to assert against); it moves to VOICE-005-composition too. **Only doctrinal cost:** the mic-permission copy is not yet pinned by a test on this branch. **Trade-off:** the copy is still pinned by design §8.3 + runbook Appendix A; the composition card's contract test picks up enforcement one card later.
- **(b) Migrate `app.json` to `app.config.js` (dynamic config)** with a `try/require.resolve/catch` guard that only adds the plugin when `expo-audio` is installed. This keeps the `commit_now` file manifest intact in spirit but replaces the mechanism. `appJsonPluginContract.test.ts` would need to load the dynamic config via `require('../app.config.js')` and would assert the shape only when the dep is present (making the test conditional). **Trade-off:** introduces a new configuration mechanism (dynamic config file) not in the design's file manifest, and the contract test becomes conditional — a doctrine loosening the design intentionally avoided ("wording drift" catch is what the strict contract test bites for).
- **(c) Install `expo-audio` as a real dep on this branch** so the plugin resolver finds it. **Rejected by operator prompt:** package.json / package-lock.json edits are explicitly excluded on `feat/voice-005-visualizer` — they would break `npm ci` on CI. The design itself excludes them in §1 (row 18).

Panel-recommended: **(a)**. It preserves branch reversibility, keeps the doctrine copy pinned by design + runbook (two written sources), and moves the runtime enforcement to the same card that installs the dep — the natural anchor. **(b)** trades tighter type-of-config for looser test enforcement; **(c)** is not an option under the branch constraints.

### 13.4 What implementer did commit

Only this implementer note was committed to `feat/voice-005-visualizer`. All prior implementer work (pure-TS visualizer module, four adapter/property tests, two doctrine tests, one runbook file, and the `app.json` plugin edit) was reset from the worktree before this commit per role-rules ("commit that change alone").

The pure-TS work was fully written and green through gates 1-4 (typecheck / lint / targeted jest / full jest 1098 passed / 1098 total, 36741 passed + 1 skipped = 36742 total, base 36643 + 99 tests). Gate 5 (web:build) went red only because of the `app.json` plugin addition; with that stashed, gate 5 was green. This scoped the gap precisely to the plugin registration.

### 13.5 What the designer / operator needs to do

1. Rule between reconciliation candidates (a) / (b) / (c) or an alternative none of us has thought of.
2. If (a) — update design §0.1 row 7, §1 rows 14 + 15, §8.2 steps 3 + 5, §12 (acceptance mapping row 7) to reclassify the `app.json` change and the contract test as VOICE-005-composition scope. Update the runbook step ordering accordingly.
3. If (b) — extend the design's file manifest with the `app.config.js` migration and rewrite §7.3 scenario 24 to describe the dynamic-config contract test.
4. Once the design is updated, implementer resumes with a fresh pass on `feat/voice-005-visualizer` and lands the pure-TS work (already fully written and gate-green minus the plugin) plus whatever the ruling requires. Estimated re-implementation cost: low (the pure-TS core, adapter tests, guard test, and runbook are all written and self-contained — they can be re-created verbatim from this note plus the design).

### 13.6 Files in this commit

Only this design-doc addendum. `git diff --name-only HEAD~1` should show only `docs/designs/VOICE-005.md`.

