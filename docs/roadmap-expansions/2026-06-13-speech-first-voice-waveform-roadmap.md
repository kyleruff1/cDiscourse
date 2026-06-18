# Speech-First Voice + Waveform Roadmap

**Slate:** VOICE-SLATE-2026-06-13
**Baseline:** main @ 3c99cbc (read-only verification)
**Status:** Docs + issue-planning only. No code, no installs, no production change. Every card is implemented later, one at a time, through the house pipeline.

---

## 1. Executive thesis

CDiscourse is a mobile-first debate app. The single hardest moment in the entire product is the blank composer box: a user has a point in their head and has to thumb-type it into a structured argument. This roadmap makes **speech the first-class way to draft any argument** — tap, talk, watch a live waveform confirm the mic is hearing you, read an editable transcript, fix it, and submit. The submitted artifact is still plain text passing through the same deterministic constitution engine that gates every post today. Nothing about the acceptance contract changes.

The roadmap is deliberately staged from doctrine outward: an ADR first, then architecture, then a single native-dependency card, then pure-TS state and artifact models, then UI spikes, then one universal adapter wrapping the **one** shared composer seam, then integration, then optional post-store artifact persistence, and only then an optional MCP family. Audio is never stored, never uploaded, never replayed, never sent to MCP, and never used to infer anything about a person. Speech is a **composition aid, not a judge**.

## 2. Why speech-first now

- **The composer is already unified.** QOL-030 collapsed every drafting surface into one switchable OneBox that funnels into a single `ArgumentComposer` body input. That means a voice adapter has exactly one insertion point to cover the entire app — the architectural cost of speech-first just dropped by an order of magnitude.
- **The platform is ready.** Expo SDK ~54, React Native 0.81.5, React 19.1, `newArchEnabled:true`. The speech and audio libraries we need are compatible with this exact stack (see §5). The only structural requirement is moving from Expo Go to a development build, which a managed/CNG app supports via config plugins.
- **Mobile-first means thumb-first is the bottleneck.** A debate app lives or dies on how cheap it is to contribute. Speech entry is the highest-leverage reduction in friction available, and it composes cleanly with the existing one-box mode/type switch.
- **It stays inside doctrine.** Because the submitted artifact is plain text through the unchanged engine, speech-first adds zero risk to the acceptance-gate invariant. Voice is upstream of the gate, never the gate.

## 3. User loop

The canonical speech-first loop. Every arrow is a step a user can see and control; the engine step is unchanged from today.

```
Tap Speak
  -> mic permission (first time only; denial falls back to text, never blocks)
  -> interim transcript streams in real time (event.results[0].transcript, interimResults:true)
  -> live waveform animates to confirm the mic is active (feedback, NOT credibility)
  -> recognition ends -> editable transcript lands in the SAME ArgumentComposer body TextInput
  -> user edits / corrects / restructures the text (full keyboard parity, plain text)
  -> user picks argument type / mode in the OneBox header (unchanged switch)
  -> handleSubmit -> DETERMINISTIC constitution engine (evaluateArgumentDraft) is the SOLE gate
  -> if allowPost: submit-argument inserts plain text into public.arguments (service-role insert, unchanged)
  -> POST-STORE: optional transcript + waveform artifact attached AFTER the row exists (fire-and-forget)
  -> MCP fan-out (if any) sees TEXT + METADATA ONLY — never audio
```

Key invariants visible in the loop:

- The waveform is **on-screen feedback that the mic is hearing sound**. It is not evidence of credibility, sincerity, emotion, or intent.
- The transcript is **editable before submit**. The machine never posts what it heard; the user posts what they approve.
- The engine step is byte-identical to today. Speech changes how text arrives in the box, not how the box is judged.
- Artifact attach happens **after** the insert, mirroring the existing post-storage child-table precedent. It can never block, reject, route, or delay the post.

## 4. Data / privacy posture

| Data | Stored? | Uploaded / MCP? | Notes |
|---|---|---|---|
| Raw audio (PCM / recording file) | **NO** | **NO — never** | Not persisted to Supabase, not uploaded, not replayed, not shared, not sent to MCP in v1. No local audio URI is persisted to Supabase or MCP. |
| Transcript text | Yes (it becomes the argument body) | The body text only, through the unchanged engine + (optional) MCP text path | The submitted argument *is* the transcript-derived text the user approved. |
| Transcript **metadata** | MAY be stored (later card) | Metadata only | e.g. recognizer used, interim/final flag, edit-distance between raw transcript and submitted body, language, on-device vs cloud recognizer. Advisory provenance, never a verdict. |
| Waveform **metadata** | MAY be stored (later card) | Metadata only | e.g. duration, peak/RMS summary, sample-window count. Non-authoritative decoration/provenance, NOT evidence of what was said. |
| Waveform **image** | Local / transient by default | No | Lives only while the app runs unless a later card (VOICE-009) explicitly persists a derived image artifact. Even if persisted, it is non-authoritative decoration, not evidence. |

Hard rules carried from the frozen doctrine:

- **No raw audio anywhere off-device in v1.** Prefer metering-only / `useAudioStream` so no replayable file is created. If a recorder file is unavoidable for metering, keep it cache-only (never document-directory), never background, and delete the local URI as soon as the waveform artifact is derived.
- **No service-role in the client. No direct client insert into `public.arguments`.** Artifacts attach via the service-role post-store path only.
- **Plain language only** in any user-facing string — no raw internal codes.
- A waveform image, if ever shown or stored, is **non-authoritative provenance**, never evidence of what was said or of the speaker's state.

## 5. Library architecture

Five candidate libraries. All are net-new — none of `expo-av`, `expo-audio`, `expo-speech`, `expo-speech-recognition`, `@shopify/react-native-skia`, `react-native-view-shot`, or `react-native-svg` is currently installed (`react-native-svg` appears only in the Jest `transformIgnorePatterns` regex, not in dependencies).

**Stack compatibility:** Expo SDK ~54, RN 0.81.5, React 19.1, `newArchEnabled:true`. The app is **managed / CNG** — `app.json` only, no `ios/` or `android/` folders, no `eas.json`, no `app.config.*`, no `babel.config`/`metro.config`. Consequence: the speech/audio/Skia libraries need **config plugins** in `app.json` **plus a development build** (EAS Build or local prebuild). **They cannot run in Expo Go.** This is the single biggest implementation cost and is isolated into VOICE-002.

> Upstream facts below cited as "upstream docs, verified 2026-06."

### expo-speech-recognition (jamsch) — primary STT
- Wraps iOS `SFSpeechRecognizer` / Android `SpeechRecognizer` / Web `SpeechRecognition`.
- Requires a config plugin in `app.json` (`microphonePermission`, `speechRecognitionPermission`, `androidSpeechServicePackages`) **plus a dev build** (not Expo Go).
- Permissions: `requestPermissionsAsync` / `getPermissionsAsync` / `requestMicrophonePermissionsAsync`.
- Events via `useSpeechRecognitionEvent`: `result` (interim+final; `event.results[0].transcript`; `interimResults:true`), `error` (`event.error` code + message), `start`, `end`, `audiostart`/`audioend`, `speechstart`/`speechend`.
- Availability: `isRecognitionAvailable()`, `supportsOnDeviceRecognition()`, `supportsRecording()`.
- Platform matrix: Android 12- = basic + interim only (no continuous / on-device / recording); Android 13+ & iOS 17+ = full; Web = Chrome + Safari 16+ (NOT Firefox).
- `recordingOptions.persist` defaults **false** — when true emits `{uri}` in `audiostart`/`audioend` (Android 13+/iOS only). **v1 MUST keep `persist` OFF / absent** so no replayable audio file is created.

### expo-audio — metering / waveform source
- `useAudioRecorderState(recorder, interval=500ms default)` -> `RecorderState` including **metering** (only when `isMeteringEnabled:true`).
- `useAudioStream(options)` -> real-time PCM microphone capture (`stream.start()`/`stop()`) **without creating a persistent file** (needs `requestRecordingPermissionsAsync`).
- Recordings default to the **cache directory** (OS may delete); document-directory is opt-in only.
- Config plugin: `microphonePermission` (`NSMicrophoneUsageDescription`), `recordAudioAndroid` (`RECORD_AUDIO`, default true). `enableBackgroundRecording` defaults **false**; `enableBackgroundPlayback` can be false.
- **Doctrine fit:** prefer metering-only / `useAudioStream` to avoid replayable files. If recorder metering is required, keep cache-only, never document-dir, never background, and delete the local URI as soon as the waveform artifact is derived.

### @shopify/react-native-skia — live waveform visualizer (spike)
- Requires RN >= 0.79 + React >= 19 -> repo (RN 0.81.5 / React 19.1) is **compatible** (older stacks need v1.12.4).
- Expo: dev build (`template -e with-skia`), not Expo Go. Native: iOS pod install; Android NDK (`$ANDROID_NDK`) + proguard keep rule.
- Jest: `testEnvironment '@shopify/react-native-skia/jestEnv.js'` + `setupFilesAfterEnv '@shopify/react-native-skia/jestSetup.js'` + add the package to `transformIgnorePatterns`.
- Web: supported (~2.9MB bundle).
- **Canvas -> image snapshot reliability is NOT documented** -> treat snapshot as a **spike**, not a dependency.

### react-native-view-shot — waveform snapshot export (spike)
- `captureRef(ref, {format:'png'|'jpg'|..., result:'tmpfile'(default)|'base64'|'data-uri', quality, width/height})`.
- `tmpfile` lives only while the app runs; `releaseCapture(uri)` to clean; auto-clean on app close.
- `base64` warning (string crosses the bridge -> lag; small images only).
- Android GL/SurfaceView: `handleGLSurfaceViewOnAndroid` (false by default; perf impact).
- **Capturing a Skia canvas is NOT documented** -> spike risk. Web via `html2canvas`, limited for `react-native-svg`.
- Must set `collapsable={false}` on Android Views and capture only **after** the first `onLayout` (not instantly).

### react-native-svg — reliable static waveform fallback + deterministic path export
- Actively maintained, v15.15.5 (2026-05); Expo-installable (`npx expo install react-native-svg`); iOS/Android/macOS/Windows + web compat layer.
- Supports `Path`/`Rect`/`Circle`/`Line`/`Polyline`/`Polygon`/`G` -> a **deterministic static waveform path** that avoids the GL/SurfaceView snapshot caveats for static preview.
- **The reliable SVG fallback renderer and deterministic path export** — the safe floor under the Skia/view-shot spikes.

**Architecture summary:** `expo-speech-recognition` for STT; `expo-audio` (metering / `useAudioStream`) as the waveform data source; Skia for the live animated visualizer (spike) with `react-native-svg` as the guaranteed static fallback; `react-native-view-shot` only for an optional snapshot export (spike). The native-config cost is concentrated in one card (VOICE-002), and every spike has a deterministic non-spike floor.

## 6. Entry-surface inventory

**The single seam:** `ArgumentComposer.tsx` is the sole shared composer. It owns the one canonical free-body argument `TextInput` (`testID composer-body-input`, `ArgumentComposer.tsx:424`) and the only `submit-argument` post path (`handleSubmit`, `ArgumentComposer.tsx:249`). A universal voice adapter wrapping that body `TextInput` covers every ordinary drafting surface in **one** insertion point. The OneBox header is the mode/type-switch seam.

**Drafting surfaces that all re-type the SAME `OneBox -> ArgumentComposer` (none has its own input):**
- `ArgumentComposerDock` (`src/features/arguments/ArgumentComposerDock.tsx:153`, sole live in-room mount at `App.tsx:1045`)
- `OneBox` (`src/features/arguments/oneBox/OneBox.tsx:173`, QOL-030 single switchable box)
- Act popout (`ActPopout.tsx:269`, QOL-031)
- Referee Card next-move (`RefereeCardView.tsx onMove -> ArgumentGameSurface.handleOpenIssueMove:2264`)
- `CollapsedComposerStrip` (`CollapsedComposerStrip.tsx`)
- Move types seeded via `quickActionPresets`: Reply / Ask source / Ask quote / Add evidence / Narrow / Branch / Concede / Confirm / Synthesize / Clarify
- Demo corridor (`DemoComposerPanel.tsx:62`) mounts the real OneBox

**Non-drafting surfaces (NOT ordinary argument entry; still need a text path but are forms):**
- `RequestReviewComposer` (REF-005, moderation/concern)
- `DeletionRequestSheet` (`request-argument-deletion`)
- `StartArgumentPage` (root-claim creation; separate `createDebate` path; its own `TextInput`) — speech-first applies but through its own input, not the universal adapter

**Dormant structured-form bodies (built-but-unwired):**
- `RespondToEvidenceForm`
- `RespondToConcessionSchema`
- `OfferConcessionSchema`

**Implication:** VOICE-007 builds the universal adapter against the `ArgumentComposer` body seam; VOICE-008 integrates it everywhere that seam is reused and adds the speech-first path to `StartArgumentPage`'s own input separately. The non-drafting forms and dormant schemas are explicitly tracked so they are not silently skipped, but they are forms, not free-body argument entry, and are integrated only where it makes sense.

## 7. Artifact model

Two artifacts. **No audio artifact exists.** Both are derived on-device and, if persisted at all, are persisted only by a later post-store card (VOICE-009) as metadata.

### SpeechTranscriptArtifact (pure TS shape, summarized)
- `transcriptId` — stable id for the drafting session.
- `recognizer` — which engine produced it (iOS / Android / Web), advisory provenance.
- `onDeviceRecognition` — boolean, from `supportsOnDeviceRecognition()`.
- `language` — locale of recognition.
- `rawTranscript` — what the recognizer emitted (final).
- `submittedBody` — what the user actually approved and posted (may differ after edits).
- `editDistance` / `wasEdited` — advisory measure of how much the user corrected the machine output.
- `interimCount` — how many interim updates streamed (mic-activity provenance, not a verdict).
- `createdAt`.

> The transcript artifact never asserts truth, correctness, sincerity, or intent. It records provenance of how text arrived in the box.

### VoiceWaveformArtifact (pure TS shape, summarized)
- `waveformId` — stable id, paired to the transcript session.
- `durationMs` — total speaking-window duration.
- `sampleWindowCount` — number of metering windows captured.
- `peakSummary` / `rmsSummary` — compact numeric summary of amplitude over time (e.g. downsampled bins), used to render the static path.
- `renderer` — `'skia' | 'svg'` (which path actually drew).
- `imageRef` — optional, local/transient handle; absent unless a later card persists a derived image. Never an audio handle.
- `createdAt`.

> The waveform artifact is **non-authoritative decoration / provenance** confirming the mic was active. It is NOT evidence of what was said, how it was said, or the speaker's state. There is no field that encodes emotion, tone, stress, confidence, or identity — by design.

**No `AudioArtifact`.** There is intentionally no shape that holds, references, or points at raw audio.

## 8. MCP Family K plan

Family K = **next free MCP slot** (A-I are `productionEnabled:true`; J `sensitive_composer` is frozen `productionEnabled:false`; next free letter = **K**). Family K is `speech/waveform artifact`.

- **Source of truth:** registry `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (Object.freeze'd).
- **Input to Family K = TEXT + METADATA ONLY.** Never audio. The MCP server never receives an audio sample, file, URI, or stream.
- **Allowed observations (advisory, boolean, non-authoritative):** transcript-provenance signals such as `transcript_was_edited`, `recognizer_on_device`, `low_interim_activity`, `short_speaking_window`, plus topic/type-fit observations on the **text** that are no different from any existing family. All flags carry `authoritative:false`.
- **Forbidden observations (doctrine):** anything inferring emotion, tone, voice stress, anger, confidence, honesty, sincerity, manipulation-by-voice, speaker identity, or biometric state. No truth value, no winner/loser/verdict, no machine-made person/intent accusation. These are not "discouraged" — they are not allowed in any field.
- **Response cap:** `MAX_FLAGS_PER_RESPONSE = 20` (one entry per checked key, true+false). Family K must stay **<= 20 keys** or use the shipped #545 request batching (`BATCH_SIZE = 16`).
- **Deploy posture:** `mcp-server/` deploys to **Deno Deploy** (NOT a Supabase Edge Function). Any `mcp-server` change is **deploy-bearing GATE-C** — not production-live on git merge; live only after the standalone MCP server redeploys to Deno Deploy AND a hosted `*.deno.net` smoke passes.
- **Sequencing:** MCP-K-001 (design) only after VOICE-009 (artifact persistence) exists; MCP-K-002 (implementation) only after MCP-K-001. No MCP implementation before artifact persistence.

## 9. Card table

| Code | Title | Priority | Effort | Lane | GATE-C | Deps |
|---|---|---|---|---|---|---|
| VOICE-ADR-001 | Speech-first input doctrine + no-audio privacy posture | P0 | S | docs ADR | No | (root) |
| VOICE-001 | Speech + waveform architecture design | P0 | L | design | No | VOICE-ADR-001 |
| VOICE-002 | Native dependency + config plugin integration | P0 | M | native/config | YES | VOICE-001 |
| VOICE-003 | Speech recognition session state machine + transcript artifact model | P0 | M | pure TS | No | VOICE-002 |
| VOICE-004 | Audio metering + waveform artifact core | P0 | M | pure TS / adapter | No (unless native) | VOICE-002 |
| VOICE-005 | Live waveform visualizer spike (expo-audio + Skia + SVG fallback) | P0 | M | UI spike | Case-by-case | VOICE-004 |
| VOICE-006 | Waveform snapshot export spike (view-shot / fallback) | P1 | M | UI/dev-tooling spike | Case-by-case | VOICE-005 |
| VOICE-007 | Universal VoiceInput adapter for every argument entry surface | P0 | L | UI foundation | Case-by-case | VOICE-003, VOICE-004 |
| VOICE-008 | Speech-first integration across argument entry surfaces | P0 | XL | UI integration | Case-by-case (YES if submit-path changes) | VOICE-007 |
| VOICE-009 | Speech/waveform artifact persistence + MCP handoff, no audio | P1 | L | persistence/server | YES | VOICE-008 |
| VOICE-010 | Device/web speech + waveform smoke matrix | P1 | S | testing/docs | No | VOICE-008 |
| MCP-K-001 | Family K speech/waveform artifact MCP design | P1 | M | MCP design | No (GATE-A only) | VOICE-009 |
| MCP-K-002 | Family K speech/waveform artifact MCP implementation | P2 | L | mcp-server (Deno-deploy-bearing) | YES | MCP-K-001 |
| AUDIO-001 | Optional local audio playback experiment | P3 | S | deferred | YES | (deferred; off the main path) |

## 10. Dependency DAG

```
VOICE-ADR-001
  -> VOICE-001
       -> VOICE-002
            -> VOICE-003
            -> VOICE-004
                 -> VOICE-005
                      -> VOICE-006
       {VOICE-003, VOICE-004}
            -> VOICE-007
                 -> VOICE-008
                      -> VOICE-009
                           -> MCP-K-001
                                -> MCP-K-002
                      -> VOICE-010

AUDIO-001  (deferred, P3, does NOT block the main path)
```

**DAG rules (enforced):**
- No P0 hard-depends on a P2/P3.
- No MCP implementation before artifact persistence (MCP-K-002 after VOICE-009 + MCP-K-001).
- No waveform snapshot required for basic speech entry.
- No audio playback required for anything.
- No native install before the architecture design (VOICE-001 before VOICE-002).

## 11. GATE-C / automerge matrix

GATE-C = a deploy-bearing card that cannot be considered live on git merge alone; it requires an out-of-band deploy + hosted smoke before it is production-real, and it never self-approves.

| Card | GATE-C | Why | Automerge posture |
|---|---|---|---|
| VOICE-ADR-001 | No | Docs only. | Green -> mergeable. |
| VOICE-001 | No | Design doc only. | Green -> mergeable. |
| VOICE-002 | **YES** | Native deps + config plugins require a **development build** (EAS Build / prebuild); managed/CNG app cannot pick this up in Expo Go on merge. | No automerge; operator confirms dev build + device launch before live. |
| VOICE-003 | No | Pure TS state machine + artifact model. | Green -> mergeable. |
| VOICE-004 | No (unless native) | Pure TS / adapter core; GATE-C only if it pulls a native module into the build. | Green -> mergeable unless native surface added. |
| VOICE-005 | Case-by-case | UI spike; GATE-C if it requires the dev build to exercise Skia/native. | Spike outcome gates; no automerge of native-touching path. |
| VOICE-006 | Case-by-case | Snapshot export spike; GATE-C if it needs native capture path. | Spike outcome gates. |
| VOICE-007 | Case-by-case | Universal adapter; GATE-C only if it activates native capture in the build. | Green pure-UI path mergeable; native path gated. |
| VOICE-008 | Case-by-case (**YES if submit-path changes**) | Integration; if any change touches the submit / acceptance path it is deploy-bearing and must prove the engine gate is unchanged. | No automerge if submit-path touched. |
| VOICE-009 | **YES** | Persistence + server handoff (migration + post-store writer); migration-bearing + Edge/Deno surface. | No automerge; migration-bearing heightened review + operator apply. |
| VOICE-010 | No | Testing/docs matrix. | Green -> mergeable. |
| MCP-K-001 | No (GATE-A only) | MCP design; design-gate only. | Green -> mergeable. |
| MCP-K-002 | **YES** | `mcp-server` change deploys to **Deno Deploy**; live only after redeploy + hosted `*.deno.net` smoke; never self-approve. | No automerge; Deno redeploy + hosted smoke required. |
| AUDIO-001 | **YES** | Deferred audio-playback experiment; native + deploy-bearing if ever taken up. | Deferred; out of the main path. |

## 12. Risks

- **Native build complexity.** Managed/CNG -> every native lib forces a development build + config plugins. Mitigation: isolate the entire native cost in VOICE-002; nothing downstream installs natively before the architecture (VOICE-001) lands.
- **Platform support gaps.** Android 12- has basic + interim only (no continuous/on-device/recording); Web excludes Firefox; Safari needs 16+. Mitigation: VOICE-010 smoke matrix + capability probes (`isRecognitionAvailable`, `supportsOnDeviceRecognition`, `supportsRecording`) drive graceful degradation.
- **Permission denial.** Mic / speech permission can be refused. Mitigation (doctrine): text fallback exists for every entry window; denial NEVER blocks text posting.
- **Recognizer unavailability.** STT may be unavailable or error mid-session. Mitigation (doctrine): recognition failure NEVER blocks text posting; the editable transcript box is the floor.
- **view-shot / Skia capture reliability.** Canvas->image snapshot is undocumented for both libs. Mitigation: treat VOICE-005/006 as **spikes** with `react-native-svg` static path as the deterministic floor; never make a snapshot a hard dependency of speech entry.
- **Audio cache cleanup.** Metering may create cache-dir files. Mitigation: prefer `useAudioStream`/metering-only; if a file is created, cache-only, never document-dir, never background, delete the URI as soon as the waveform artifact is derived; `releaseCapture` for any view-shot tmpfile.
- **Privacy misunderstanding.** Users (or reviewers) may assume audio is stored or that the waveform judges them. Mitigation: explicit copy + ADR; waveform framed as mic-active feedback only; no audio field exists anywhere in the artifact model.
- **Storage creep.** Metadata persistence could grow unbounded or drift toward storing more than metadata. Mitigation: artifact shapes are fixed and audio-free; VOICE-009 persists metadata only; any image is local/transient unless an explicit card persists a derived (non-audio) image.

## 13. Out of scope

- **Audio playback** of recorded speech (AUDIO-001 is deferred P3, off the main path).
- **Cloud audio storage** of any kind — no raw audio is uploaded, ever, in v1.
- **Emotion / voice analysis** — no tone, stress, anger, confidence, honesty, or manipulation-by-voice classification.
- **Speaker identity / biometric inference** — no voiceprint, no identity, no biometric state.
- **Speech as a submit gate** — speech is upstream of the deterministic engine; the engine remains the SOLE acceptance gate. Recognition output never blocks, rejects, routes, or delays a post.

## 14. Operator launch checklist

1. **Spawn VOICE-001 first** (`spawn-card.ps1 VOICE-001`) — the architecture design. (VOICE-ADR-001 is the doctrine ADR root and may be authored alongside; VOICE-001 is the first build-shaped card.)
2. **Do NOT install packages first.** No `npx expo install`, no `npm install`, no native deps before the architecture is designed.
3. **VOICE-002 native install comes AFTER VOICE-001.** Only once the architecture is agreed does the single native-dependency + config-plugin + dev-build card run. VOICE-002 is GATE-C — operator confirms a development build launches on device before treating it as live.
4. Proceed down the DAG one card at a time through the house pipeline (designer -> implementer -> reviewer). Honor every GATE-C: VOICE-002, VOICE-009, MCP-K-002 (and AUDIO-001 if ever taken up) are deploy-bearing and never self-approve.
5. Keep `persist` OFF in `expo-speech-recognition` and prefer metering-only / `useAudioStream` in `expo-audio` for the entire v1 path — no replayable audio file.

## 15. Doctrine (woven throughout, restated)

- **Acceptance-gate invariant:** AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the SOLE gate. Classifiers run AFTER an argument is stored. No path may block, reject, route, or delay an ordinary user post.
- **Speech recognition is a composition aid, not a judge.** Waveform rendering is feedback that the mic is active, NOT evidence of credibility / sincerity / emotion / intent.
- **No AI truth adjudication;** no winner/loser/verdict framing; no machine-made person/intent accusation; no emotion detection; no speaker identity; no biometric inference; no voice-stress/tone/anger/confidence/honesty/manipulation-by-voice classification.
- **Text-only fallback exists for EVERY entry window.** Permission denial NEVER blocks text posting. Speech-recognition failure NEVER blocks text posting.
- **Raw audio is NOT stored / uploaded / replayed / shared / sent to MCP in v1.** No local audio URI persisted to Supabase or MCP. No service-role in client. No direct insert into `public.arguments`. Plain language only. Any waveform image is non-authoritative decoration / provenance, not evidence of what was said.

## 16. Reconciliation with existing issues

All VOICE / MCP-K / AUDIO cards are **net-new** — no existing issue owns STT / audio / waveform / Family-K (searches for STT / AUDIO / waveform / Skia / expo-audio / microphone / "Family K" returned zero).

**Extend (add explicit "extends #N" dependency notes; do NOT rebuild):**
- QOL-030 #199 (one-box composer chassis) — VOICE adds a voice-capture box **type**.
- QOL-031 #200 (Act popout) — VOICE adds a Speak/Record **entry**.
- CARD-VIEW-DATA-001 #504 (OPEN) — any transcript / STT-confidence chip lands in its card zones; coordinate.
- IX-003 #22 — the a11y/keyboard contract VOICE inherits.
- Family J #473 confirms K is the free MCP slot.

**False positives (ignore):** #468 (bot writing-voice), #5 (gradient wave rail visual), #588 (Request review allegations), #79 (transcript = vocab codes).
