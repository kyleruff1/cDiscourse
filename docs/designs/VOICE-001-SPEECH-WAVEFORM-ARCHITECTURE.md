# VOICE-001 — Speech + Waveform Architecture

**Status:** Design draft
**Epic:** 15 — Speech-first voice input + waveform (`epic:voice`)
**Release:** v1 (post-Stage 6.4 UI/UX track)
**Issue:** https://github.com/civildiscourse/cdiscourse/issues/659
**Slate:** VOICE-SLATE-2026-06-13 (`docs/roadmap-expansions/2026-06-13-speech-first-voice-waveform-roadmap.md`, index `docs/designs/VOICE-SLATE-2026-06-13-INDEX.md`)
**Doctrine root:** VOICE-ADR-001 (#658) — see "Operator notes" §17 re: the ADR file not yet authored
**Baseline:** branched off `main @ 79b9508` as `feat/voice-001-speech-waveform-architecture`

> This is the engineering spec the downstream cards (VOICE-002 … VOICE-010, MCP-K-001/002) build from. It is deliberately deeper than the slate roadmap: where the roadmap states *what* and *why*, this doc states *exactly where, in what shape, threaded through which prop, gated by which check*. It is DESIGN ONLY — no production code, no installs, no config-plugin edits.

---

## Goal

CDiscourse's single highest-friction moment is the blank composer box. This architecture makes **speech the first-class way to draft an argument**: tap Speak, talk, watch a live waveform confirm the mic is hearing you, read an editable transcript that lands in the *same* `ArgumentComposer` body `TextInput`, fix it with full keyboard parity, choose your argument type/side in the OneBox header, and submit. The submitted artifact is still plain text passing through the *unchanged* deterministic constitution engine that gates every post today.

The constraints that shape every decision below are doctrinal, not stylistic:

- **The deterministic engine is the SOLE acceptance gate.** Speech/STT/waveform/classifiers are upstream composition aids or downstream post-storage decoration. Nothing here may block, reject, route, or delay a post. (cdiscourse-doctrine §1; slate §15.)
- **Raw audio is never stored, uploaded, replayed, shared, or sent to MCP in v1.** No local audio URI is persisted to Supabase or MCP. (slate §4, §8; ADR #658.)
- **A text-only path exists for every entry window.** Permission denial and STT failure NEVER block text posting. (slate §12; ADR #658.)
- **The waveform is mic-active feedback, NOT evidence** of credibility, sincerity, emotion, or intent. No emotion / identity / biometric / voice-stress inference anywhere. (cdiscourse-doctrine §1, §4; evidence-doctrine "Hard refusals".)
- **No service-role in client; no direct client insert into `public.arguments`.** Artifacts attach via the existing post-store service-role path only. (supabase-edge-contract "Hard rules" §1, §2.)

---

## 1. Entry-surface integration map

### 1.1 The single seam (verified against live code)

`ArgumentComposer.tsx` is the **sole shared composer**. Verified at `main @ 79b9508`:

| Seam | Location | Verified |
|---|---|---|
| Canonical free-body argument input | `src/features/arguments/ArgumentComposer.tsx:424` — `<TextInput … testID="composer-body-input">` | ✅ line 424, testID at :432 |
| Body update path | `ArgumentComposer.tsx:339` — `handleBodyChange = (body) => updateField({ body })`; wired to `onChangeText` at :426 | ✅ |
| Sole submit path | `ArgumentComposer.tsx:249` — `handleSubmit` → `buildSubmitArgumentPayload` (:271) → `submitArgumentDraft` (:272) → `submit-argument` Edge Function | ✅ |
| Value source | `value={draft.body}` (:425); draft state owned by `useArgumentComposer(debateId, parentId)` (:115) | ✅ |

The OneBox header is the **mode / type-switch seam** (the type chips render in `ArgumentComposer.tsx:438-459`, side chips at :462+; the OneBox box-type header sits above the hosted composer).

### 1.2 Surfaces that all re-type the SAME `OneBox → ArgumentComposer` (none owns its own input)

Verified: `OneBox.tsx:400` mounts exactly one `<ArgumentComposer mode="dock" …>` (the box body). Every ordinary drafting surface routes through it:

- **`ArgumentComposerDock`** (`src/features/arguments/ArgumentComposerDock.tsx:153`) — sole live in-room mount at `App.tsx:1045`. Hosts OneBox; owns the pre-send review sheet (RULE-004 `onBeforeSubmit`/`postSignal`).
- **`OneBox`** (`src/features/arguments/oneBox/OneBox.tsx:173`, mount of composer at :400) — QOL-030 single switchable box; adds the box-type header + Act popout, reuses `ArgumentComposer` as the post engine.
- **Act popout** (`ActPopout.tsx:269`, rendered from `OneBox.tsx:419`) — QOL-031 flash menu; a launcher that re-targets the same hosted composer, no separate input.
- **Referee Card next-move** (`RefereeCardView.tsx onMove → ArgumentGameSurface.handleOpenIssueMove:2264`) — opens the dock/composer with a preset; no separate input.
- **`CollapsedComposerStrip`** (`CollapsedComposerStrip.tsx`) — collapsed affordance that expands into the same dock/composer.
- **Move types** seeded via `quickActionPresets` (Reply / Ask source / Ask quote / Add evidence / Narrow / Branch / Concede / Confirm / Synthesize / Clarify) — these apply an `initialPatch: MoveDraftPatch` to the *same* composer (prop at `ArgumentComposer.tsx:53`), they do not create new inputs.
- **Demo corridor** (`DemoComposerPanel.tsx:62`) — mounts the real OneBox, so it inherits voice for free.

**Implication:** a universal voice adapter wrapping the `composer-body-input` `TextInput` covers one-box, dock, Act popout, Referee Card, CollapsedComposerStrip, all move types, and the demo corridor in **ONE insertion point**.

### 1.3 The exact insertion point + prop-threading plan (the one adapter)

The adapter wraps the body section of `ArgumentComposer.tsx` (the `<View style={styles.section}>` at :417-435 that contains the `composer-body-input` `TextInput`). The principle: **the adapter never bypasses `handleBodyChange`.** A finalized transcript reaches the body the *same way* keyboard typing does — through `updateField({ body })` — so the engine, the draft persistence, the char-count, and the validation panel all behave identically whether text arrived by thumb or by voice.

VOICE-007 builds `VoiceInputAdapter` as a presentational wrapper. The minimal prop surface added to `ArgumentComposer` (additive, optional — every existing caller that omits them behaves byte-identically, mirroring the RULE-004 `onBeforeSubmit`/`postSignal` precedent at :71-80):

```ts
// Added to ArgumentComposer Props (VOICE-007/008) — all OPTIONAL & additive.
interface VoiceComposerProps {
  /**
   * Master switch for the voice affordance. Default false at adapter
   * introduction (VOICE-007), flipped on per-surface in VOICE-008.
   * When false the composer renders today's byte-identical UI.
   */
  voiceEnabled?: boolean;
  /**
   * Capability snapshot from the speech model (VOICE-003). Drives whether
   * the Speak button renders, is disabled, or is replaced by a text-only
   * hint. Never blocks the keyboard path.
   */
  voiceCapability?: SpeechCapabilitySnapshot;
  /**
   * Optional sink for the derived artifacts (transcript + waveform) so the
   * dock can hand them to the post-store attach (VOICE-009) AFTER submit.
   * The composer never persists them itself.
   */
  onVoiceArtifacts?: (artifacts: VoiceDraftArtifacts) => void;
}
```

How the adapter funnels transcript into the body **without** a new write path:

```
VoiceInputAdapter (VOICE-007)
  owns SpeechSessionState (VOICE-003) + WaveformModel (VOICE-004)
  renders: [Speak button] + [live waveform] + the EXISTING composer-body-input
  on FINAL transcript -> calls the composer's handleBodyChange(mergedBody)
       (append-or-replace policy below) -> updateField({ body }) -> draft.body
  the user then edits draft.body with the keyboard exactly as today
  handleSubmit (:249) is UNCHANGED -> evaluateArgumentDraft -> submit-argument
```

Body-merge policy (VOICE-007 model; pure-TS, testable): if `draft.body` is empty, the final transcript *replaces* it; if non-empty, the transcript is *appended* with a single separating space (the user never loses keyboarded text). Interim results are shown in a dedicated interim region in the adapter chrome — they are NEVER written to `draft.body` until final, so a half-recognized phrase can't get submitted.

The dock (`ArgumentComposerDock`) is the natural owner of `onVoiceArtifacts` because it already owns the submit lifecycle (review sheet + `postSignal`). After a successful submit, the dock hands the artifacts to the VOICE-009 post-store attach keyed by the returned `argument.id` (mirroring the classifier fan-out — see §11).

### 1.4 StartArgumentPage (separate `createDebate` path)

`StartArgumentPage.tsx` is the root-claim creation surface. It is a *separate* path: verified `createDebate` (not `submit-argument`) at `StartArgumentPage.tsx:201`, with its **own** `TextInput`s at :339 and :392 (resolution + body), not the universal `composer-body-input`. The universal adapter does NOT auto-cover it. VOICE-008 adds speech to StartArgumentPage by mounting the *same* `VoiceInputAdapter` around its own body `TextInput` (the model/state machine from VOICE-003/004 is shared; only the wrapping target differs). This is called out so it is not silently skipped — it is in scope for VOICE-008 but through its own input.

### 1.5 Dormant structured-form bodies

Three structured-form bodies are built-but-unwired: `RespondToEvidenceForm`, `RespondToConcessionSchema`, `OfferConcessionSchema`. They get speech *later* (when/if wired) by the same adapter around each form's free-text field. They are tracked here so they are not forgotten, but they are NOT in VOICE-007/008 scope.

### 1.6 NON-drafting surfaces — explicitly OUT of scope

These need a text path but are **forms, not ordinary argument entry**:

- **`RequestReviewComposer`** (REF-005, moderation/concern) — out of scope. Not argument drafting.
- **`DeletionRequestSheet`** (`request-argument-deletion`) — out of scope. Not argument drafting.

Speech-first does not target these in this slate. (A later non-VOICE card could add dictation to forms if desired; it is not a VOICE deliverable.)

---

## 2. Package compatibility matrix

> All facts cited "upstream docs, verified 2026-06" via the slate §3 verified-facts pass; platform/stack facts re-confirmed against this repo at `main @ 79b9508` (see §3 for the install plan). **All 7 libraries are net-new** — `node -e` over `package.json` confirms every one is `ABSENT`; `react-native-svg` appears only in the Jest `transformIgnorePatterns` regex, not in `dependencies`.

Repo stack (verified): Expo SDK **~54.0.33** · react **19.1.0** · react-native **0.81.5** · `newArchEnabled: true` (`app.json`) · **managed / CNG** (`app.json` only — no `ios/`, `android/`, `eas.json`, `app.config.*`, `babel.config`, `metro.config`) · Jest preset `jest-expo` (config inline in `package.json`; no `setupFiles`/`setupFilesAfterEach`/`testEnvironment` set today).

| Library | Role | Expo 54 / RN 0.81.5 / react 19.1 | Dev-build / native impact | Verdict |
|---|---|---|---|---|
| **expo-speech-recognition** (jamsch) | Primary STT | Compatible with SDK 54 expo-modules; wraps iOS `SFSpeechRecognizer` / Android `SpeechRecognizer` / Web `SpeechRecognition` | **Config plugin** (`microphonePermission`, `speechRecognitionPermission`, `androidSpeechServicePackages`) **+ dev build** (NOT Expo Go) | ✅ adopt — primary STT |
| **expo-audio** | Waveform data source (metering / `useAudioStream`) | First-party Expo module; SDK 54 compatible | Config plugin (`microphonePermission`, `recordAudioAndroid`); `enableBackgroundRecording` default **false**; dev build | ✅ adopt — metering/stream only |
| **@shopify/react-native-skia** | Live animated waveform (spike) | Requires RN ≥0.79 + react ≥19 → repo (0.81.5 / 19.1) **COMPATIBLE** (older stacks need v1.12.4) | Dev build (`template -e with-skia`); iOS pod install; Android NDK (`$ANDROID_NDK`) + proguard keep rule; Jest needs `testEnvironment` + `setupFilesAfterEach` + `transformIgnorePatterns` entry; web ~2.9MB | ⚠️ adopt as live renderer; **canvas→image snapshot UNDOCUMENTED → spike (VOICE-006), never a posting dependency** |
| **react-native-view-shot** | Optional snapshot export (spike) | Compatible; `captureRef(ref, {format, result})` | tmpfile default; `releaseCapture(uri)` cleanup; base64 bridge-lag warning; `handleGLSurfaceViewOnAndroid` (false default); `collapsable={false}` + capture only after `onLayout` | ⚠️ **spike only (VOICE-006)**; capturing a Skia canvas is undocumented; web `html2canvas` limited |
| **react-native-svg** | Deterministic static waveform fallback + path export | v15.15.5 (2026-05); Expo-installable; iOS/Android/macOS/Windows + web compat | `npx expo install` (config-plugin-light); already in Jest `transformIgnorePatterns` regex | ✅ adopt — **the reliable floor under the Skia/view-shot spikes** |
| **expo-av** | (legacy, NOT needed) | — | — | ❌ do not adopt — `expo-audio` supersedes |
| **expo-speech** | (TTS, NOT needed for v1) | — | — | ❌ do not adopt — v1 is STT-in, not TTS-out |

**Net consequence:** the native-config cost is real but **isolated into VOICE-002**. Every spike (Skia live render, view-shot snapshot) has a deterministic non-spike floor (`react-native-svg`), so basic speech entry never depends on an undocumented capability.

---

## 3. Dependency install plan (for VOICE-002 to execute — NOT executed here)

> Ordering matters: install the Expo-managed modules with `expo install` (gets the SDK-54-compatible version) *before* the npm-only library, then verify the dev-build prerequisites. **VOICE-001 installs nothing.**

```bash
# 1. Expo-managed native modules — use `expo install` (NOT plain npm install)
#    so the SDK-54-compatible versions are resolved.
npx expo install expo-audio
npx expo install react-native-svg          # v15.x; Expo-installable; the deterministic fallback

# 2. STT library (jamsch) — published on npm; install via expo install so
#    Expo can advise on the compatible range and register the config plugin.
npx expo install expo-speech-recognition

# 3. Skia (live waveform; spike renderer). RN 0.79+/react 19+ required → repo OK.
npx expo install @shopify/react-native-skia

# 4. view-shot (snapshot export spike). Installed but exercised only in VOICE-006.
npx expo install react-native-view-shot

# 5. Generate the development build (managed/CNG → cannot run in Expo Go):
#    EAS build path:
#       eas build --profile development --platform ios
#       eas build --profile development --platform android
#    OR local prebuild path:
#       npx expo prebuild         # generates ios/ + android/ from app.json plugins
#       npx expo run:ios / npx expo run:android
```

**Version pins:** VOICE-002 records the exact resolved versions in `package.json` (Expo resolves them); the slate cites `react-native-svg` v15.15.5 (2026-05) and the Skia ≥ the v compatible with RN 0.79+/react 19 (NOT the legacy v1.12.4 used by older stacks). Do not hand-pin; let `expo install` resolve, then commit the lockfile.

**`expo-av` / `expo-speech` are NOT installed** — only the 5 libraries above.

**Jest config additions VOICE-002 must add** (so Skia-importing tests don't break the existing 70-suite green): add `@shopify/react-native-skia` to `transformIgnorePatterns`; for any suite that renders the live Skia Canvas, scope `testEnvironment '@shopify/react-native-skia/jestEnv.js'` + `setupFilesAfterEach '@shopify/react-native-skia/jestSetup.js'` to that suite (or add globally with care — the repo has no `setupFilesAfterEach` today). Pure-model suites (VOICE-003/004) need none of this.

---

## 4. Permission / config-plugin plan (for VOICE-002 — NOT applied here)

> The exact `app.json` blocks VOICE-002 writes. `app.json` today has `plugins: []`, no `ios.infoPlist` keys, no `android.permissions` (verified). All copy is **plain language, doctrine-clean** — no internal codes, no claim that audio is stored, framed as *help you draft*.

```jsonc
// app.json  → expo.plugins  (VOICE-002 adds these blocks)
"plugins": [
  [
    "expo-speech-recognition",
    {
      "microphonePermission": "CDiscourse uses your microphone so you can speak your argument instead of typing it. Your voice is never saved or uploaded.",
      "speechRecognitionPermission": "CDiscourse turns your speech into editable text in the composer. You review and edit it before posting. The recording is not kept.",
      "androidSpeechServicePackages": ["com.google.android.googlequicksearchbox"]
    }
  ],
  [
    "expo-audio",
    {
      "microphonePermission": "CDiscourse uses your microphone to show a live waveform confirming it can hear you while you speak. No audio is saved or uploaded.",
      "recordAudioAndroid": true
    }
  ]
]
```

```jsonc
// Effective native permission strings produced by the plugins:
//   iOS Info.plist:
//     NSMicrophoneUsageDescription      <- microphonePermission
//     NSSpeechRecognitionUsageDescription <- speechRecognitionPermission
//   Android manifest:
//     android.permission.RECORD_AUDIO   <- recordAudioAndroid: true
```

**Disabled by doctrine (VOICE-002 must NOT enable):**

- `expo-audio` `enableBackgroundRecording` — leave default **false** (no background recording).
- `enableBackgroundPlayback` — false (no v1 playback at all; AUDIO-001 is deferred P3).
- `expo-speech-recognition` `recordingOptions.persist` — leave **OFF / absent** at every call site (this is a *runtime* call option, not a plugin field; enforced in VOICE-003 and tested — see §5/§16). With `persist` off, no `{uri}` is emitted and no replayable audio file is created.

`react-native-svg` needs no plugin block (Expo autolinks it). Skia needs the dev-build template/NDK setup (a build-config concern documented in VOICE-002, not an `app.json` permission block) — and Skia + view-shot are exercised only behind the VOICE-005/006 spikes.

---

## 5. Speech recognition event model → `SpeechSessionState` machine (VOICE-003)

> Pure-TS state machine. No React, no network, no Supabase imports (model-file rule, expo-rn-patterns §"File structure"). The React hook (`useSpeechSession`) wraps `useSpeechRecognitionEvent` and feeds events into this reducer. The machine's contract: **it can drive UI and own transcript provenance, but it can never block, gate, or delay a post** — the editable text box is always the floor.

### 5.1 Capability probe (runs once, before the machine)

```ts
// VOICE-003 — capability snapshot from expo-speech-recognition.
interface SpeechCapabilitySnapshot {
  recognitionAvailable: boolean;   // isRecognitionAvailable()
  onDeviceRecognition: boolean;    // supportsOnDeviceRecognition()
  supportsRecording: boolean;      // supportsRecording()
  platform: 'ios' | 'android' | 'web';
  // Derived flags (pure):
  interimSupported: boolean;       // Android 12- = basic + interim only; 13+/iOS17+/web Chrome+Safari16+ = full
  voiceOfferable: boolean;         // recognitionAvailable && !knownUnsupportedBrowser (Firefox web = false)
}
```

When `voiceOfferable` is false the adapter renders **no Speak button** (or a disabled one with a plain-language hint) and the user simply types — text-only fallback, doctrine §"text-only for every window".

### 5.2 States

```ts
type SpeechSessionStatus =
  | 'idle'              // nothing started; keyboard is the only input
  | 'permission_pending'// requestPermissionsAsync in flight
  | 'permission_denied' // user refused; FALL BACK to text, never block
  | 'unavailable'       // recognizer unavailable on this device/browser
  | 'listening'         // start fired; interim results may stream
  | 'recognizing'       // speechstart..speechend; interim transcript updating
  | 'finalizing'        // end fired; awaiting/holding the final result
  | 'final'             // final transcript available, handed to composer body
  | 'error_recoverable' // error event; retry offered; text still works
  | 'text_fallback';    // user chose to abandon voice and type
```

### 5.3 Event → transition map (`useSpeechRecognitionEvent`)

| Upstream event | Field used | Transition | Side effect |
|---|---|---|---|
| (user taps Speak) | — | `idle` → `permission_pending` | call `requestPermissionsAsync` |
| permission granted | — | `permission_pending` → `listening` | `ExpoSpeechRecognitionModule.start({ interimResults: true, /* persist OFF */ })` |
| permission refused | — | `permission_pending` → `permission_denied` | show plain-language note; keep keyboard active |
| `start` | — | `listening` (confirm) | start the waveform model (§6) |
| `audiostart` | — | `listening` | mark mic active for the waveform |
| `speechstart` | — | `listening` → `recognizing` | — |
| `result` (interim) | `event.results[0].transcript`, `isFinal=false` | stay `recognizing` | update `interimTranscript` (display only; NOT written to `draft.body`); bump `interimCount` |
| `result` (final) | `event.results[0].transcript`, `isFinal=true` | `recognizing` → `final` | set `rawTranscript`; hand merged body to composer via `handleBodyChange` |
| `speechend` | — | `recognizing` → `finalizing` | — |
| `audioend` | — | `finalizing` | stop the waveform model; derive `VoiceWaveformArtifact`; if any cache file exists, delete URI now (§6.4) |
| `end` | — | `finalizing` → `final` (or `error_recoverable` if no result) | finalize transcript artifact |
| `error` | `event.error` (code), `event.message` | any → `error_recoverable` | map code → plain-language string via `gameCopy.toPlainLanguage`; keyboard still works |
| (user taps "Type instead") | — | any → `text_fallback` | stop recognition; focus the body `TextInput` |

### 5.4 Interim vs final ownership

- **Interim** transcript lives in the adapter's own display region. It is provenance/feedback, never authoritative, and is NEVER written to `draft.body`.
- **Final** transcript is the only thing that touches `draft.body`, and only via `handleBodyChange` (the same path as typing).
- **Submitted-text ownership:** the machine NEVER posts. The user edits `draft.body` and presses Post; `handleSubmit` (:249) is unchanged. `submittedBody` (the artifact field) is read from `draft.body` at submit time by the dock, not from the recognizer. The machine *records* the divergence (edit distance), it does not *control* it.

### 5.5 Doctrine guards in the machine

- Every terminal/error state keeps the keyboard path alive — permission denial, `unavailable`, and `error_recoverable` all fall through to a working text box.
- No state encodes emotion / confidence / stress / identity. The only signals captured are *provenance* (which recognizer, interim count, edited-or-not).
- All user-facing strings route through `gameCopy.toPlainLanguage`; raw `event.error` codes are never echoed.

---

## 6. Audio metering / waveform model (VOICE-004)

### 6.1 Metering-vs-stream decision — recommend the no-durable-audio path

**Recommendation: `expo-audio`'s `useAudioStream` (real-time PCM, NO persistent file) as the primary waveform data source; `useAudioRecorderState` metering only if `useAudioStream` proves unavailable on a target platform — and then cache-only with immediate URI deletion.**

Rationale (doctrine-driven):

- `useAudioStream` captures real-time PCM **without creating a persistent file** (verified upstream fact). This is the cleanest fit for "no replayable audio anywhere off-device" — there is no file to delete because none is created.
- `useAudioRecorderState(recorder, interval)` exposes `metering` (dB) **only when `isMeteringEnabled: true`**, but a recorder may write to the **cache directory** by default (the OS may delete it; document-dir is opt-in). If metering is the only path on a platform, the recorder file is cache-only, **never document-directory, never background**, and its URI is **deleted as soon as the waveform artifact is derived** (on `audioend`, §5.3).
- In **either** path, no audio URI is ever persisted to Supabase, uploaded, or sent to MCP. The waveform is derived on-device from amplitude samples and the samples themselves are bounded and non-replayable (§6.3).

Decision recorded verbatim in §15. The pure-TS amplitude model (below) is **source-agnostic**: it consumes a stream of dB/level samples regardless of whether they came from `useAudioStream` or metering, so the renderer and artifact are identical across platforms.

### 6.2 dB → normalized amplitude-bucket algorithm (pure TS)

```ts
// VOICE-004 — pure TS, no React/native imports. Source-agnostic: input is a
// dB level (typically negative, ~ -160..0). Output is a 0..1 amplitude.
const DB_FLOOR = -60;   // below this we treat as silence
const DB_CEIL  = 0;     // 0 dB is the loudest reference

function normalizeDbToAmplitude(db: number): number {
  if (!Number.isFinite(db)) return 0;
  const clamped = Math.max(DB_FLOOR, Math.min(DB_CEIL, db));
  return (clamped - DB_FLOOR) / (DB_CEIL - DB_FLOOR); // 0..1
}
```

Bucketing into a fixed-width waveform (so the artifact is bounded regardless of speaking duration):

```ts
const MAX_AMPLITUDE_BUCKETS = 256;  // hard cap — bounded, non-replayable summary

// Down-sample an arbitrary-length amplitude stream into <= 256 bins by
// max-pooling each window (peak per bucket reads best for a "mic is hearing
// you" waveform). RMS summary is computed alongside for the artifact.
function bucketAmplitudes(samples: number[], maxBuckets = MAX_AMPLITUDE_BUCKETS): number[] { /* … */ }
```

### 6.3 Ring buffer / sample cap (the no-replayable-audio guarantee)

- The live model keeps a **ring buffer** of the most recent N normalized amplitudes (N ≈ enough for the on-screen window, e.g. 256) for live rendering. Older raw samples are overwritten — the buffer is fixed-size and cannot grow into something resembling a recording.
- The *artifact* stores at most `MAX_AMPLITUDE_BUCKETS` (256) downsampled bins + scalar `peakSummary`/`rmsSummary`. 256 amplitude floats in [0,1] is a shape, **not** reconstructable speech — it is the visual envelope of loudness over time, with no spectral content, no phase, nothing from which words could be recovered. This is the "bounded non-replayable amplitude buckets" guarantee.

### 6.4 No-audio deletion / avoidance lifecycle

```
start (Speak)
  -> prefer useAudioStream: PCM in memory, NO file created
  -> sample loop: dB/level -> normalizeDbToAmplitude -> ring buffer (live render)
audioend / speechend
  -> stop stream; bucketAmplitudes(ringBuffer) -> amplitudeBuckets (<=256)
  -> compute peakSummary / rmsSummary
  -> derive VoiceWaveformArtifact (audio-free; see §10)
  -> IF a recorder cache file was unavoidable: delete the URI NOW
  -> discard the raw PCM/ring buffer (it is not part of the artifact)
```

Invariant: by the time the session reaches `final`, **no audio data and no audio URI exists** anywhere — only the bounded amplitude summary and scalar provenance fields.

---

## 7. Waveform rendering design — live Skia Canvas (VOICE-005)

A presentational component `<LiveWaveform amplitudes={number[]} renderer="skia" reduceMotion={bool} />` consumes the ring buffer from VOICE-004.

- **Skia path:** a `<Canvas>` draws vertical bars (or a smoothed `Path`) per amplitude bucket, animated as the ring buffer updates. Skia is chosen for the *live* (per-frame) render because it is GPU-accelerated and smooth on RN 0.81.5/react 19.1.
- **Reduce motion:** when `AccessibilityInfo.isReduceMotionEnabled()` is true, the live animation is replaced by a static/low-frequency-updating bar set (snap, not animate) — accessibility-targets §"Reduce motion".
- **No color-only meaning:** the waveform conveys "mic is active / hearing sound" via *height/shape*, not color. A grayscale render is still legible (a flat line = silence, tall bars = sound). accessibility-targets §"Color is never the only signal".
- **Accessibility:** the waveform is decorative feedback; it carries `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"` on the canvas, and the Speak button (the interactive element) carries `accessibilityRole="button"`, a plain-language `accessibilityLabel` ("Speak your argument"), and `accessibilityState={{ busy: isListening }}`. The mic-active fact is announced once via `announceForAccessibility("Listening")`, not per frame.
- **Doctrine:** the component has NO prop and NO code path that encodes emotion, stress, confidence, or any per-speaker inference. It renders loudness-over-time and nothing else.

GATE-C posture: VOICE-005 is a spike; the Skia branch requires the dev build to exercise, so the native-touching path is GATE-C while the SVG fallback path (§9) is plain-UI and mergeable.

---

## 8. View-shot snapshot feasibility plan (VOICE-006 — SPIKE)

**Framing:** capturing a waveform to a PNG is an *optional export*, never a posting dependency. Speech entry works fully without any snapshot.

Decision tree the spike answers:

```
Can react-native-view-shot captureRef() a Skia <Canvas> reliably on iOS?
  YES -> snapshot from Skia (tmpfile, result:'tmpfile', releaseCapture after use)
  NO / undocumented / flaky ->
    Can it captureRef() the react-native-svg static path? (well-supported shape)
      YES -> snapshot from the SVG fallback render (deterministic)
      NO  -> NO image snapshot; export the deterministic SVG path string (§9) instead
```

Spike rules:

- `collapsable={false}` on the captured Android View; capture only **after** the first `onLayout` (verified upstream caveat).
- `result: 'tmpfile'` (default), `releaseCapture(uri)` after use; never `base64` for anything but tiny previews (bridge-lag warning).
- `handleGLSurfaceViewOnAndroid` is false by default and has a perf cost — only flip it if the spike proves it's required for Skia/GL capture.
- Web `html2canvas` is limited for `react-native-svg` — document the web result separately; web export may simply use the deterministic SVG path string.
- **No snapshot output is audio.** A captured PNG is a non-authoritative waveform image (mic-active provenance), never evidence of what was said. It is local/transient unless VOICE-009 explicitly persists a derived image — and even then it is decoration, not evidence.

Outcome recorded in the VOICE-006 spike doc: "view-shot of Skia is reliable / unreliable / web-limited" + the chosen fallback. **No card downstream may make a working snapshot a hard dependency of speech entry.**

---

## 9. SVG fallback plan — deterministic static path (VOICE-005 floor)

`react-native-svg` is the guaranteed floor under both spikes.

- A pure-TS function `buildWaveformSvgPath(amplitudes: number[], width, height): string` produces a deterministic SVG `Path` `d` string (or a `<Polyline>`/`<Rect>` bar set) from the same amplitude buckets. Same input → same path, on iOS / Android / web — no GL, no SurfaceView, no snapshot caveat.
- `<StaticWaveform amplitudes renderer="svg" />` renders that path with `react-native-svg`. This is the static preview after recognition ends, and the always-available renderer when Skia is unavailable or `voiceCapability` is degraded.
- Because the path is a pure function of the buckets, it doubles as a **deterministic path export** (the "export the SVG path string" leaf of the §8 decision tree) — no rasterization needed.
- Doctrine: identical to §7 — loudness shape only, color-independent, no inference.

The `renderer: 'skia' | 'svg'` field on the artifact (§10) records which actually drew.

---

## 10. Artifact schema — finalized TS interfaces (VOICE-003 / VOICE-004)

> **No `AudioArtifact` exists.** There is intentionally no shape that holds, references, or points at raw audio. Both artifacts are derived on-device; persistence (if any) is VOICE-009 only.

```ts
// src/features/voice/voiceArtifactTypes.ts  (VOICE-003 transcript; VOICE-004 waveform)

/**
 * SpeechTranscriptArtifact — provenance of how text arrived in the box.
 * NEVER asserts truth, correctness, sincerity, emotion, or intent.
 */
export interface SpeechTranscriptArtifact {
  transcriptId: string;             // stable id for the drafting session
  recognizer: 'ios' | 'android' | 'web'; // advisory provenance
  onDeviceRecognition: boolean;     // from supportsOnDeviceRecognition()
  language: string;                 // locale of recognition, e.g. 'en-US'
  rawTranscript: string;            // final recognizer output (what it heard)
  submittedBody: string;            // what the user approved + posted (may differ)
  wasEdited: boolean;               // submittedBody !== rawTranscript (after normalization)
  editDistance: number;             // advisory measure of correction (>= 0)
  interimCount: number;             // # interim updates (mic-activity provenance)
  createdAt: string;                // ISO timestamp

  // ── No-audio invariants (constant by design) ──
  audioPersisted: false;            // literal false — never persisted
  audioUri: null;                   // literal null — no local URI kept
  rawAudioPersisted: false;         // literal false — no PCM/recording retained
}

/**
 * VoiceWaveformArtifact — non-authoritative decoration / provenance that the
 * mic was active. NOT evidence of what was said, how, or the speaker's state.
 * No field encodes emotion, tone, stress, confidence, or identity — by design.
 */
export interface VoiceWaveformArtifact {
  waveformId: string;               // stable id, paired to the transcript session
  transcriptId: string;             // FK to the SpeechTranscriptArtifact session
  durationMs: number;               // total speaking-window duration
  sampleWindowCount: number;        // # metering/stream windows captured
  amplitudeBuckets: number[];       // <= 256 normalized [0,1] bins — bounded, NON-REPLAYABLE
  peakSummary: number;              // max amplitude over the window [0,1]
  rmsSummary: number;               // RMS amplitude over the window [0,1]
  renderer: 'skia' | 'svg';         // which path actually drew
  imageRef: string | null;          // optional LOCAL/transient handle; absent unless VOICE-009 persists a derived image. NEVER an audio handle.
  createdAt: string;

  // ── No-audio invariants (constant by design) ──
  audioPersisted: false;
  audioUri: null;
  rawAudioPersisted: false;
}

/** What the adapter hands to the dock after a session (in-memory only). */
export interface VoiceDraftArtifacts {
  transcript: SpeechTranscriptArtifact;
  waveform: VoiceWaveformArtifact | null; // null if waveform capture was skipped/unavailable
}
```

`amplitudeBuckets` capped at 256 floats in [0,1] is the bounded, non-replayable summary — a loudness envelope, not reconstructable speech (§6.3). The `audioPersisted: false` / `audioUri: null` / `rawAudioPersisted: false` literals make the no-audio posture **type-enforced** — a value other than `false`/`null` is a compile error, and a ban-list test (§16) asserts it at runtime too.

---

## 11. Persistence strategy options (VOICE-009 — design level only here)

> Two options, both **post-storage attach** (after the `public.arguments` row exists), both **service-role-write only / client SELECT only**, both **audio-free**. No client insert into `public.arguments` (verified: sole writer is the service-role insert at `submit-argument/index.ts:376-380`).

### Option A (RECOMMENDED) — new child table FK→arguments ON DELETE CASCADE

Mirror the MCP-021B precedent exactly (`argument_machine_observation_results`, migration `20260526000018`; writer `persistenceWriter.ts`, fire-and-forget after insert). DDL sketch:

```sql
-- VOICE-009 migration sketch (operator applies; NOT written in VOICE-001).
CREATE TABLE IF NOT EXISTS public.argument_voice_artifacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_id           uuid NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE,
  debate_id             uuid NOT NULL REFERENCES public.debates(id)   ON DELETE CASCADE,
  schema_version        text NOT NULL,
  -- transcript provenance (NO audio columns exist):
  recognizer            text NOT NULL CHECK (recognizer IN ('ios','android','web')),
  on_device_recognition boolean NOT NULL,
  language              text NOT NULL,
  was_edited            boolean NOT NULL,
  edit_distance         integer NOT NULL CHECK (edit_distance >= 0),
  interim_count         integer NOT NULL CHECK (interim_count >= 0),
  -- waveform provenance (bounded, non-replayable):
  duration_ms           integer CHECK (duration_ms >= 0),
  sample_window_count   integer CHECK (sample_window_count >= 0),
  amplitude_buckets     real[]  NOT NULL DEFAULT '{}',   -- <= 256 floats in [0,1]
  peak_summary          real,
  rms_summary           real,
  renderer              text CHECK (renderer IN ('skia','svg')),
  -- explicit no-audio columns (constant; defensive, asserted by review):
  audio_persisted       boolean NOT NULL DEFAULT false CHECK (audio_persisted = false),
  audio_uri             text CHECK (audio_uri IS NULL),  -- always null
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avoice_amplitude_bucket_cap CHECK (array_length(amplitude_buckets, 1) IS NULL OR array_length(amplitude_buckets, 1) <= 256)
);

ALTER TABLE public.argument_voice_artifacts ENABLE ROW LEVEL SECURITY;

-- SELECT-only client RLS, delegating to the canonical arguments visibility
-- (META-1A / MCP-021B precedent — single-table EXISTS into public.arguments):
CREATE POLICY avoice_select_via_argument
  ON public.argument_voice_artifacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arguments a WHERE a.id = argument_voice_artifacts.argument_id));

-- NO client INSERT / UPDATE / DELETE policy. The VOICE-009 writer uses
-- service-role (bypasses RLS), fire-and-forget AFTER the argument insert.
```

Attach flow (mirrors the classifier fan-out at `submit-argument/index.ts:811-846`): after the 201, a service-role writer (Edge Function or the dock calling a dedicated `attach-voice-artifact` function with the returned `argument.id`) inserts the row off the critical path. It can never block / reject / route / delay the post — the post already succeeded.

### Option B — inline `server_validation` jsonb sink

Write the (audio-free) artifact metadata into the existing `arguments.server_validation` jsonb (verbatim advisory sink, `submit-argument/index.ts:349-355`, never re-validated). Lighter (no migration), but: (1) the artifact would have to ride the *submit* payload (coupling voice provenance to the gate path — undesirable), or (2) require a separate update to the row. Less clean than Option A's post-store attach.

**Recommendation: Option A.** It matches the established post-store child-table precedent, keeps voice provenance entirely off the acceptance-gate path, gives proper RLS + cascade semantics, and bounds the data shape at the DB level (the `audio_persisted = false` / `audio_uri IS NULL` / 256-bucket CHECK constraints make the no-audio posture enforceable in SQL). Option B is recorded as the lighter alternative if the operator wants to avoid a migration in v1.

**Deploy posture:** VOICE-009 is GATE-C (migration-bearing + Edge persistence). Operator runs `npx supabase db push --linked` + `npx supabase functions deploy attach-voice-artifact --linked`. Claude does not deploy.

---

## 12. MCP Family K sequencing (MCP-K-001 design; MCP-K-002 impl)

> **K = next free letter** (verified: registry `_shared/booleanObservations/familyRegistry.ts` has 10 entries A `parent_relation` … J `sensitive_composer`; `MachineObservationFamily` union in `nodeLabelTypes.ts:110-120` ends at `sensitive_composer`; A–I `productionEnabled: true`, J frozen `productionEnabled: false`). Family K = **`speech_waveform_artifact`**.

- **Input to Family K = TEXT + METADATA ONLY.** Never audio. The MCP server never receives an audio sample, file, URI, or stream. Family K consumes the persisted `argument_voice_artifacts` row (provenance metadata) + the argument body text — same as every existing family's text path.
- **Allowed observations** (advisory, boolean, `authoritative: false`):
  - `speech_input_used` — the move was drafted via speech (provenance).
  - `text_only_fallback_used` — the user typed instead (provenance).
  - `recognizer_unavailable` — STT was unavailable for this session.
  - `transcript_was_edited` — `submittedBody !== rawTranscript`.
  - `recognizer_on_device` — on-device recognition was used.
  - `low_interim_activity` / `short_speaking_window` — mic-activity provenance signals.
  - plus topic/type-fit observations on the **text** identical to any existing family.
- **FORBIDDEN observations (doctrine — not "discouraged", *not allowed in any field*):** emotion, tone, voice stress, anger, confidence, honesty, sincerity, manipulation-by-voice, speaker identity, biometric state, intent, credibility; no truth value; no winner/loser/verdict; no machine-made person/intent accusation. (cdiscourse-doctrine §1, §4; evidence-doctrine "Hard refusals"; slate §8.)
- **Response cap:** `MAX_FLAGS_PER_RESPONSE = 20` (verified `mcpBooleanObservationSchema.ts:161`). Family K must stay **≤ 20 keys** or use the shipped #545 request batching (`BATCH_SIZE = 16`, verified `booleanObservationBatching.ts:58`). Given the allowed list above, ≤ 20 keys is comfortably achievable — no batching expected.
- **Deploy posture:** `mcp-server/` deploys to **Deno Deploy** (NOT a Supabase Edge Function). MCP-K-002 is **deploy-bearing GATE-C** — not production-live on git merge; live only after the standalone MCP server redeploys to Deno Deploy AND a hosted `*.deno.net` smoke passes. Never self-approve.
- **Sequencing (DAG-enforced):** MCP-K-001 (design) only AFTER VOICE-009 (artifact persistence) exists — there is nothing to observe before the artifact is persisted. MCP-K-002 (impl) only AFTER MCP-K-001. **No MCP implementation before artifact persistence.**

---

## 13. Device / web smoke matrix (VOICE-010 preview)

VOICE-010 is a testing/docs card (no live run without operator arming). The matrix exercises capability-driven graceful degradation:

| Context | STT | Interim | Waveform | Expected behavior |
|---|---|---|---|---|
| iOS 17+ (dev build) | full | yes | Skia live | Speak → live waveform → interim → final → editable body |
| iOS < 17 | limited | check | SVG fallback | degrade gracefully; text always works |
| Android 13+ (dev build) | full | yes | Skia live | full path |
| Android 12- | basic + interim only (no continuous/on-device/recording) | interim only | SVG fallback / metering | degrade; no recording; text always works |
| Web Chrome | yes | yes | Skia/SVG | full path |
| Web Safari 16+ | yes | yes | Skia/SVG | full path |
| Web Safari < 16 | unavailable | — | — | no Speak button; text-only |
| Web Firefox | **unavailable** | — | — | no Speak button; text-only (verified: Firefox unsupported) |
| Permission denied (any) | — | — | — | `permission_denied` → plain-language note → text posting works |

Cross-device viewport check (expo-rn-patterns §"Cross-device QA"): Speak button + waveform must meet 44×44 tap target and be legible at 390×844 phone, 1024×1366 tablet, 1366×768 + 1920×1080 browser. The Speak button is a touch-first affordance on all platforms (it is not a keyboard-only badge), so it renders regardless of platform/width — but it respects `voiceCapability` (hidden when STT unavailable).

---

## 14. Implementation DAG (per-card files + gate)

```
VOICE-ADR-001 (#658)  [doctrine root; docs/adr/ — see §17]
  -> VOICE-001 (#659)  THIS DOC  [design only; reviewer PASS -> mergeable]
       -> VOICE-002 (#660)  GATE-C: deps + config plugins + dev build
            -> VOICE-003 (#661)  pure TS  [no gate]
            -> VOICE-004 (#662)  pure TS  [no gate unless native lands in-card]
                 -> VOICE-005 (#663)  UI spike  [Skia branch GATE-C; SVG branch mergeable]
                      -> VOICE-006 (#664)  snapshot spike  [capture path may be native -> GATE-C]
       {VOICE-003, VOICE-004}
            -> VOICE-007 (#665)  universal adapter  [gate-adjacent; native-activating path GATE-C]
                 -> VOICE-008 (#666)  integration  [GATE-C IF submit-path changes -> it must NOT]
                      -> VOICE-009 (#667)  GATE-C: migration + post-store writer
                           -> MCP-K-001 (#669)  MCP design  [GATE-A only]
                                -> MCP-K-002 (#670)  GATE-C: Deno-Deploy + hosted smoke
                      -> VOICE-010 (#668)  smoke matrix  [docs/testing; mergeable]
AUDIO-001 (#671)  [deferred P3; off the main path; GATE-C if ever taken up]
```

| Card | Files it touches | Gate |
|---|---|---|
| **VOICE-002** #660 | `package.json` (+ lockfile), `app.json` (plugins/permissions), Jest config (Skia env), build config (NDK/proguard/EAS-or-prebuild) | **GATE-C** — dev build; operator confirms device launch |
| **VOICE-003** #661 | `src/features/voice/speechSessionModel.ts` (state machine), `voiceArtifactTypes.ts` (transcript), `useSpeechSession.ts` (hook), `gameCopy` additions (error-code → plain language) | none (pure TS + hook) |
| **VOICE-004** #662 | `src/features/voice/waveformModel.ts` (normalize/bucket/ring-buffer), `voiceArtifactTypes.ts` (waveform), `useWaveformStream.ts` (hook over `useAudioStream`/metering) | none (unless native module pulled into build) |
| **VOICE-005** #663 | `src/features/voice/LiveWaveform.tsx` (Skia), `StaticWaveform.tsx` (SVG), `buildWaveformSvgPath.ts` | spike; Skia path GATE-C, SVG path mergeable |
| **VOICE-006** #664 | `src/features/voice/waveformSnapshot.ts` (view-shot wrapper), VOICE-006 spike doc | spike; capture path may be native → GATE-C |
| **VOICE-007** #665 | `src/features/voice/VoiceInputAdapter.tsx`, body-merge model, `ArgumentComposer.tsx` (additive optional props §1.3) | gate-adjacent; native-activating path GATE-C |
| **VOICE-008** #666 | `OneBox.tsx` / `ArgumentComposerDock.tsx` (flip `voiceEnabled`), `StartArgumentPage.tsx` (own input), wiring across surfaces | **GATE-C IF submit-path changes** — it MUST NOT; must prove engine gate byte-unchanged |
| **VOICE-009** #667 | `supabase/migrations/<ts>_voice_artifacts.sql`, `supabase/functions/attach-voice-artifact/index.ts`, client wrapper | **GATE-C** — migration + Edge; operator applies |
| **VOICE-010** #668 | `docs/testing-runs/<date>-voice-smoke.md`, capability-probe tests | none (docs/testing) |
| **MCP-K-001** #669 | `docs/designs/MCP-K-001-*.md` (Family K design) | GATE-A only (design) |
| **MCP-K-002** #670 | `mcp-server/` Family K handler, `familyRegistry.ts` + `nodeLabelTypes.ts` (add `speech_waveform_artifact`), Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` if mixed-source, fixtures | **GATE-C** — Deno Deploy + hosted `*.deno.net` smoke |

**DAG rules (all satisfied):** no P0 hard-depends on a P2/P3; no MCP impl before artifact persistence (MCP-K-002 after VOICE-009 + MCP-K-001); no waveform snapshot required for basic speech entry; no audio playback required for anything; no native install before the architecture design (VOICE-001 precedes VOICE-002).

---

## 15. Design decisions (recorded verbatim)

1. **Audio source:** use `expo-audio` `useAudioStream` (real-time PCM, **no persistent file**) as the primary waveform source. Use `useAudioRecorderState` metering only if `useAudioStream` is unavailable on a target platform — and then **cache-only, never document-dir, never background, with immediate URI deletion** as soon as the waveform artifact is derived. Either way, no audio URI is ever persisted/uploaded/sent to MCP.
2. **STT:** `expo-speech-recognition` (jamsch) for transcript, with `recordingOptions.persist` **OFF / absent** for the entire v1 path — no replayable audio file is ever created by the recognizer.
3. **Live render:** `@shopify/react-native-skia` for the live animated waveform.
4. **Snapshot:** `react-native-view-shot` is used **ONLY after the VOICE-006 spike proves it** reliably captures the chosen render target. A working snapshot is never a hard dependency of speech entry.
5. **Fallback / floor:** `react-native-svg` is the deterministic static fallback renderer and deterministic path export — the safe floor under both the Skia and view-shot spikes.
6. **One seam:** the universal `VoiceInputAdapter` wraps the single `composer-body-input` `TextInput` and funnels transcript through `handleBodyChange` only — the engine gate (`handleSubmit` → `evaluateArgumentDraft` → `submit-argument`) is byte-unchanged.
7. **Persistence:** Option A (new `argument_voice_artifacts` child table, post-store service-role attach mirroring MCP-021B) over inline jsonb.

---

## 16. Test plan (downstream-card coverage) + Risks + Edge cases

### 16.1 Tests each downstream card needs

- **VOICE-003** (`__tests__/speechSessionModel.test.ts`): every event → state transition (happy path: idle→listening→recognizing→final); permission-denied → `permission_denied` falls through to text; `error` → `error_recoverable` keeps keyboard alive; interim results never written to `submittedBody`; capability-probe derivations (Firefox web → `voiceOfferable:false`, Android 12- → interim-only). **Doctrine ban-list:** assert no state/field name or emitted string contains emotion/identity/stress/confidence/verdict tokens; assert all error strings route through `gameCopy.toPlainLanguage` (no raw `event.error` codes). **No-audio assert:** `SpeechTranscriptArtifact.audioPersisted === false`, `audioUri === null`, `rawAudioPersisted === false`.
- **VOICE-004** (`__tests__/waveformModel.test.ts`): `normalizeDbToAmplitude` clamps `[-60,0]`→`[0,1]`, non-finite → 0; `bucketAmplitudes` never exceeds 256 bins regardless of input length; ring buffer is fixed-size (cannot grow); determinism (same input → same buckets). **No-audio assert:** artifact has no audio field; `amplitudeBuckets.length <= 256`.
- **VOICE-005** (`__tests__/waveform.render.test.tsx` + `buildWaveformSvgPath.test.ts`): `buildWaveformSvgPath` is deterministic + cross-platform-stable; grayscale legibility (shape carries meaning, color-independent); reduce-motion path snaps; Speak button 44×44 + role/label/state.
- **VOICE-006** (spike doc + `waveformSnapshot.test.ts` for the wrapper contract): records reliability outcome; asserts `releaseCapture` is called; asserts snapshot output is never wired as a posting dependency.
- **VOICE-007** (`__tests__/voiceInputAdapter.test.tsx`): adapter funnels final transcript through `handleBodyChange` (append-vs-replace policy); interim never reaches `draft.body`; `voiceEnabled:false` renders byte-identical-to-today composer; capability-gated Speak button.
- **VOICE-008** (`__tests__/voiceIntegration.test.tsx` + a submit-path-unchanged assertion): the engine gate (`evaluateArgumentDraft` / `submit-argument` payload) is byte-unchanged when voice is on; every covered surface (one-box/dock/Act/Referee/CollapsedStrip/move-types/demo + StartArgumentPage) reaches a working body; permission denial never blocks Post.
- **VOICE-009** (migration shape + writer tests, like `argument_machine_observation_results`): RLS SELECT-only (no client INSERT/UPDATE/DELETE policy — the `grep -E "CREATE POLICY .* FOR (INSERT|UPDATE|DELETE)"` check returns zero); `audio_persisted = false` / `audio_uri IS NULL` CHECK constraints; 256-bucket cap CHECK; writer is fire-and-forget after insert (never blocks the 201).
- **VOICE-010**: capability-probe matrix tests; smoke-run doc.
- **MCP-K-001/002**: Family K registry membership (`speech_waveform_artifact`), allowed-key list ≤ 20 (or batching), **adversarial doctrine test** asserting no forbidden observation key/string (emotion/identity/stress/confidence/voice/biometric/intent/credibility/verdict) can appear in any Family K field; input is text+metadata only (no audio field reaches the handler).

### 16.2 Risks

- **Native build complexity** — managed/CNG forces a dev build + config plugins. Mitigation: all native cost isolated in VOICE-002; nothing downstream installs natively before VOICE-001 lands.
- **Platform support gaps** — Android 12- basic+interim only; web excludes Firefox; Safari needs 16+. Mitigation: capability probe drives graceful degradation; VOICE-010 matrix.
- **Permission denial / recognizer unavailability** — Mitigation (doctrine): text fallback for every window; neither ever blocks text posting.
- **Skia/view-shot capture reliability** — canvas→image undocumented for both. Mitigation: SVG static path is the deterministic floor; capture is spike-only and never a posting dependency.
- **Audio cache cleanup** — metering may create a cache file. Mitigation: prefer `useAudioStream` (no file); if a file is unavoidable, cache-only, never document-dir, never background, delete URI on `audioend`.
- **Privacy misunderstanding** — users/reviewers may assume audio is stored or the waveform judges. Mitigation: ADR + plain-language permission copy; waveform framed as mic-active feedback; no audio field exists anywhere in the model; DB CHECK constraints enforce no-audio.
- **Storage creep** — Mitigation: artifact shapes are fixed and audio-free; `amplitudeBuckets` capped at 256 in both TS and SQL; VOICE-009 persists metadata only.
- **Engine-gate regression in VOICE-008** — Mitigation: VOICE-008 is GATE-C if the submit path is touched and must prove `evaluateArgumentDraft`/`submit-argument` is byte-unchanged.

### 16.3 Edge cases (downstream implementers must handle)

- **Empty transcript / no speech** — final result is empty: stay in/return to text; do not write an empty body over keyboarded text.
- **Interim-only then session ends with no final** (Android 12-) — promote last interim to `draft.body` only on explicit user confirm, OR keep it display-only and let the user type; never auto-submit an interim.
- **User edits body mid-recognition** — final transcript appends (never overwrites) keyboarded text per the merge policy.
- **Permission revoked mid-session** — transition to `permission_denied`/`error_recoverable`; keep the body editable; never lose the draft.
- **Recognizer error mid-stream** — `error_recoverable`; retry offered; keyboard works.
- **Offline / network failure** — on-device recognition (if available) still works; cloud recognizer failure → `error_recoverable` → text. (Submit itself is the engine's concern, unchanged.)
- **Concurrent submit while listening** — Post is enabled by `draft.body` + `evaluationResult.allowPost` (unchanged at :251); a still-listening session does not block Post; finalizing happens independently.
- **Doctrine edge:** "can the waveform influence the strength band / score / acceptance?" — **No.** The waveform never reaches the engine, the score model, or the acceptance gate. It is on-screen feedback and (optionally, post-store) non-authoritative provenance.
- **Doctrine edge:** "does an edited transcript imply the user was dishonest?" — **No.** `wasEdited`/`editDistance` are neutral provenance (text arrived, then was corrected), never a credibility signal; Family K must not interpret them as such.

---

## 17. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; advisory only):** ✅ The engine is the sole gate (`submit-argument:329`); speech/waveform/classifiers are upstream aid or downstream decoration; no field anywhere encodes truth/winner/loser/verdict. The waveform never reaches the engine or the score model.
- **cdiscourse-doctrine §3 (popularity is not evidence):** ✅ No engagement/popularity input anywhere; the waveform is loudness-over-time, not influence.
- **cdiscourse-doctrine §4 (AI moderator limits; no client AI; `authoritative:false`):** ✅ No AI/MCP runs on the client; Family K is post-store, advisory, `authoritative:false`, text+metadata only, never audio.
- **cdiscourse-doctrine §6/§7 (secrets; no client AI calls):** ✅ No keys in client; STT is a device/OS API (not Anthropic/xAI); no production app AI provider call introduced.
- **cdiscourse-doctrine §9 (plain language):** ✅ All user-facing strings (permissions, errors) are plain language; `event.error` codes route through `gameCopy.toPlainLanguage`.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** ✅ Family K outputs are machine **Observations** (`source:'machine'`), never user allegations, never person-attributions.
- **supabase-edge-contract (no service-role in client; no direct insert into `public.arguments`; RLS on; migration discipline; soft-delete):** ✅ No service-role in client; artifacts attach post-store via service-role only; `argument_voice_artifacts` is RLS SELECT-only with no client write policy; ON DELETE CASCADE inherits arguments lifecycle.
- **evidence-doctrine (no popularity/identity as evidence; no person labels; waveform ≠ evidence):** ✅ The waveform is explicitly non-authoritative decoration, never evidence of what was said; no banned person label; no emotion/identity/stress field exists.
- **expo-rn-patterns (deps via `expo install`; primitives first; model files pure TS):** ✅ Install plan uses `expo install`; model files (VOICE-003/004) are pure TS with no React/Supabase imports; SVG fallback is the primitive floor before relying on a spike.
- **accessibility-targets (44×44; color-independent; role/label/state; reduce-motion):** ✅ Speak button 44×44 + role/label/state; waveform grayscale-legible; reduce-motion snaps; mic-active announced once, not per frame.
- **Slate/ADR no-audio posture:** ✅ No `AudioArtifact`; `persist` OFF; `useAudioStream`/metering no-file path; `audioPersisted:false`/`audioUri:null`/`rawAudioPersisted:false` type- and SQL-enforced; no audio to Supabase or MCP.

**No conflict found.** The card is buildable as specified.

---

## 18. Operator steps / notes

- **VOICE-001 (this card): None — pure design doc.** No code, no install, no plugin, no migration. Claude does not deploy or push.
- **HARD-BLOCKER-ADJACENT NOTE (VOICE-ADR-001 file not yet authored):** the slate index calls VOICE-ADR-001 "operator-ratified doctrine," but no `docs/adr/` directory or VOICE-ADR file exists on `main @ 79b9508` (verified). The doctrine *content* is fully captured in the slate roadmap §15 and issue #658, and this design restates the operative subset (§17). **This is not a blocker for VOICE-001** (the doctrine source exists in the slate + issue), but the operator should ensure VOICE-ADR-001's ADR file is committed before/alongside VOICE-002, since every downstream card's doctrine self-check references it as the durable contract.
- **VOICE-002 (next, GATE-C):** runs the install plan (§3) + the config-plugin/permission plan (§4), then generates a development build (EAS or prebuild). Operator confirms the dev build launches on a device before treating VOICE-002 as live. Keep `persist` OFF and `enableBackgroundRecording` false.
- **VOICE-009 (GATE-C):** operator runs `npx supabase db push --linked` + `npx supabase functions deploy attach-voice-artifact --linked`.
- **MCP-K-002 (GATE-C):** `mcp-server/` redeploys to Deno Deploy; hosted `*.deno.net` smoke must pass before live.

---

## 19. Dependencies (cards / docs / files)

- **Depends on:** VOICE-ADR-001 (#658) doctrine root (content present in slate §15 + issue; ADR file pending — §18).
- **Blocks:** VOICE-002 (#660) and the entire downstream DAG.
- **Reads existing seams (verified, must remain stable for the adapter):**
  - `src/features/arguments/ArgumentComposer.tsx` — body input :424/:432, `handleBodyChange` :339, `handleSubmit` :249, additive-optional-prop precedent :71-80.
  - `src/features/arguments/oneBox/OneBox.tsx:400` — sole composer mount.
  - `src/features/arguments/ArgumentComposerDock.tsx:153` — submit lifecycle owner.
  - `src/features/arguments/startArgument/StartArgumentPage.tsx` — separate `createDebate` path, own inputs :339/:392.
  - `supabase/functions/submit-argument/index.ts` — evaluate :297, allowPost :329, insert :376-380, classifier fan-out :811-846.
  - `supabase/functions/_shared/booleanObservations/familyRegistry.ts` + `nodeLabelTypes.ts:110-120` — A–J roster, K free.
  - `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql` — child-table + RLS precedent.
  - `_shared/booleanObservations/mcpBooleanObservationSchema.ts:161` (cap 20) + `booleanObservationBatching.ts:58` (batch 16).
- **Extends (dependency notes, NOT rebuilds):** #199 QOL-030 one-box chassis (voice adds a capture box TYPE), #200 QOL-031 Act popout (adds a Speak/Record ENTRY), #504 CARD-VIEW-DATA-001 (transcript/STT chip card zones — coordinate), #22 IX-003 (a11y/keyboard contract voice inherits).

---

## 20. Out of scope (this card and this slate v1)

- **Any code, install, config-plugin edit, migration, or mcp-server change** (VOICE-001 is design only; those are VOICE-002+).
- **Audio playback** of recorded speech (AUDIO-001 deferred P3).
- **Cloud audio storage** of any kind — no raw audio uploaded, ever, in v1.
- **Emotion / voice analysis** — no tone, stress, anger, confidence, honesty, manipulation-by-voice.
- **Speaker identity / biometric inference** — no voiceprint, identity, biometric state.
- **Speech as a submit gate** — speech is upstream of the engine; the engine remains the sole acceptance gate.
- **TTS / read-aloud** (`expo-speech`) — v1 is speech-in only.
- **Dictation on the non-drafting forms** (`RequestReviewComposer`, `DeletionRequestSheet`) — not argument entry; not a VOICE deliverable.
