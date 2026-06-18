# VOICE Slate Index — Speech-first input + waveform feedback (2026-06-13)

**Run code:** `VOICE-SLATE-2026-06-13` · **Type:** DOCS + ISSUE-PLANNING run (no code, no installs, no production change).
**Baseline read at:** `main @ 3c99cbc` (read-only). Primary worktree parked on the stale `feat/arch-001` branch at `9719bd9`.
**Author role:** Claude Code (Agent I), human-orchestrated under the CDiscourse credential contract.
**Filed:** 2026-06-18 (run is *named* and *dated* 2026-06-13 — see Divergence ledger item 1).
**Governance:** binds to `docs/core/pipeline-governance-contract.md`. This run performs no card's IMPLEMENT stage, no deploy, no provider call, no Supabase write, no install, no routing/registry change. The cards plan future work, implemented later one at a time through the house pipeline.

---

## 0. What this run did (and did not do)

- **PLANNED 14 net-new cards** (12 VOICE + 2 MCP-K + 1 AUDIO) for a speech-first composition aid with active-mic waveform feedback across every argument-entry surface, plus a deferred audio-playback experiment. All are **FILE** (none fold, none skip).
- **RECONCILED against the live issue set:** no existing issue owns STT / audio / waveform / Family-K (searches for STT / AUDIO / waveform / Skia / expo-audio / microphone / "Family K" returned zero). Four existing issues are named as **EXTEND** targets (dependency-note extensions, NOT duplicates): QOL-030 #199 (one-box composer chassis), QOL-031 #200 (Act popout), CARD-VIEW-DATA-001 #504 (OPEN — transcript / STT-confidence chip card zones), IX-003 #22 (a11y / keyboard contract).
- **No code, no tests, no migrations, no Edge/Deno source, no native install** were written or run. No `package.json` change, no config plugin added, no dev build triggered.
- **14 issues filed by the orchestrator** (#658–#671) and patched into the issue table below (the drafting agent left `#TBD` placeholders, replaced after filing).
- **Docs-automerge IS armed** (`CDISCOURSE_ALLOW_DOCS_AUTOMERGE=1`), so the docs-only PR auto-merges once all §15 gates are green + path-verified. See Divergence ledger item 4.

---

## 1. Baseline counts (read-only at run start)

- `npm run typecheck` — **0 errors** (clean).
- `npm run lint` — **0 errors** (clean).
- Full Jest on the primary worktree's parked commit `9719bd9` (`feat/arch-001-card3-retune-pacer`) — **2 failures**, both branch-artifact / stale-branch noise, NOT regressions:
  1. RO-40 `RefereeBannerView` byte-equal-vs-main read-only-boundary assertion (fails because the parked feat branch carries an intended-but-not-yet-on-main diff),
  2. one other failure from the same stale `feat/arch-001` branch state.
- Full Jest on `main @ 3c99cbc` — **merged-green** (the two failures above do not reproduce on main).
- Suite total noted for scale: **~31,075 tests** in the full suite.
- No audio / speech / waveform test fixtures exist yet (all net-new).

> Baseline interpretation: the 2 failures are artifacts of where the *primary* worktree is parked (`feat/arch-001`), not of `main`. The VOICE slate baselines against `main @ 3c99cbc`, which is merged-green. No VOICE card is gated on resolving the stale-branch RO-40 noise.

---

## 2. Live-state inventory (confirmed at `main @ 3c99cbc`)

**Platform / build model**
- Expo SDK ~54.0.33 · react 19.1.0 · react-native 0.81.5 · `newArchEnabled: true` (`app.json:9`).
- **MANAGED / CNG workflow:** `app.json` only — no `ios/` or `android/` folders, no `eas.json`, no `app.config.*`, no `babel.config` / `metro.config`. ⇒ config plugins + a **development build** (EAS Build or local prebuild) are REQUIRED; the native-config libraries CANNOT run in Expo Go.
- Jest: config inline in `package.json:116-128`; preset `jest-expo ^55.0.17` (jest ^29.7.0); `transformIgnorePatterns` already allowlists `react-native-svg`; no `setupFiles` / `setupFilesAfterEach` defined yet.
- **Audio / speech deps: ALL ABSENT** — `expo-av`, `expo-audio`, `expo-speech`, `expo-speech-recognition`, `@shopify/react-native-skia`, `react-native-view-shot`, `react-native-svg` (svg appears only in the jest regex, not installed). Everything is net-new.

**Composer seam (the single universal voice-adapter insertion point)**
- `ArgumentComposer.tsx` is the SOLE shared composer: the one canonical free-body argument `TextInput` (testID `composer-body-input`, `ArgumentComposer.tsx:424`) + the only `submit-argument` post path (`handleSubmit`, `ArgumentComposer.tsx:249`).
- Every ordinary argument-drafting surface routes through it: `ArgumentComposerDock` (`ArgumentComposerDock.tsx:153`, sole live in-room mount at `App.tsx:1045`) → `OneBox` (`oneBox/OneBox.tsx:173`, QOL-030 single switchable box) → `ArgumentComposer`.
- Launchers re-typing the SAME OneBox→ArgumentComposer (none has its own input): Act popout (`ActPopout.tsx:269`, QOL-031); Referee Card next-move (`RefereeCardView.tsx` onMove → `ArgumentGameSurface.handleOpenIssueMove:2264`); `CollapsedComposerStrip.tsx`; and the move types Reply / Ask source / Ask quote / Add evidence / Narrow / Branch / Concede / Confirm / Synthesize / Clarify (seeded via `quickActionPresets`). Demo corridor (`DemoComposerPanel.tsx:62`) mounts the real OneBox.
- ⇒ A universal voice adapter wrapping ArgumentComposer's body TextInput covers one-box, dock, Act popout, Referee Card, CollapsedComposerStrip, all move types, and the demo corridor in ONE insertion point. OneBox header is the mode / type-switch seam.
- NON-drafting surfaces (need a text path but are forms, not ordinary argument entry): `RequestReviewComposer` (REF-005), `DeletionRequestSheet` (request-argument-deletion). `StartArgumentPage` (root-claim creation; separate createDebate path; own TextInput) — speech-first applies via its own input. 3 dormant structured-form bodies built-but-unwired: `RespondToEvidenceForm`, `RespondToConcessionSchema`, `OfferConcessionSchema`.

**Submit / gate / persistence invariant**
- SOLE acceptance gate = the DETERMINISTIC constitution engine via `evaluateArgumentDraft`. `submit-argument/index.ts:297` (evaluate) → `:329` (if `!allowPost` return validationFailed) → insert at `:376-380`. No AI / MCP / network call precedes the insert. The MCP classifier fan-out is fire-and-forget AFTER the insert (`index.ts:811-846`), returned off the 201 critical path — it structurally CANNOT block / route / delay a post. Engine: `src/domain/constitution/engine.ts` (Edge byte-parity mirror `evaluateArgumentDraft.ts`).
- Arguments persist to `public.arguments`; sole writer = service-role insert inside `submit-argument` (clients are SELECT-only). No direct client insert into `public.arguments`.
- Post-storage artifact-attach seam (precedent): a service-role-written child table FK→arguments ON DELETE CASCADE, RLS SELECT-only, like `argument_machine_observation_results` (migration `20260526000018`; writer `persistenceWriter.ts` `persistRun`/`persistResults`, fire-and-forget AFTER insert). Lightweight inline alternative: `server_validation` jsonb on arguments (advisory verbatim sink, `index.ts:349-355`, never re-validated).

**MCP family roster (all `Object.freeze`'d in `_shared/booleanObservations/familyRegistry.ts`)**
- A `parent_relation`, B `disagreement_axis`, C `misunderstanding_repair`, D `evidence_source_chain`, E `argument_scheme`, F `critical_question`, G `resolution_progress`, H `claim_clarity`, I `thread_topology` = ALL `productionEnabled: true`.
- J `sensitive_composer` = `productionEnabled: FALSE` (frozen).
- **NEXT FREE LETTER = K.** Family K (speech / waveform artifact) is a clean new slot.
- MCP response cap: `MAX_FLAGS_PER_RESPONSE = 20` (one entry per checked key, true + false). >20-key families use the SHIPPED #545 request batching (`BATCH_SIZE = 16`) — Family K must respect the cap (≤20 keys or batch).
- `mcp-server/` deploys to **Deno Deploy** (NOT a Supabase Edge Function). Any `mcp-server/` change is deploy-bearing GATE-C.

---

## 3. Upstream library facts (verified via upstream docs, 2026-06)

| Library | Load-bearing facts (cite: "upstream docs, verified 2026-06") |
|---|---|
| **expo-speech-recognition** (jamsch) | Wraps iOS SFSpeechRecognizer / Android SpeechRecognizer / Web SpeechRecognition. Requires a **config plugin** in `app.json` (microphonePermission, speechRecognitionPermission, androidSpeechServicePackages) + a **dev build** (not Expo Go). Events via `useSpeechRecognitionEvent`: `result` (interim + final; `event.results[0].transcript`; `interimResults:true`), `error`, `start`/`end`. Availability: `isRecognitionAvailable()`, `supportsOnDeviceRecognition()`, `supportsRecording()`. Platform matrix: Android 12- = basic + interim only; Android 13+ & iOS 17+ = full; Web = Chrome + Safari 16+ (NOT Firefox). `recordingOptions.persist` DEFAULT FALSE — **v1 MUST keep persist OFF/absent** (no audio file). |
| **expo-audio** | `useAudioRecorderState(recorder, interval=500ms)` → metering ONLY when `isMeteringEnabled:true`. `useAudioStream(options)` → real-time PCM mic capture WITHOUT a persistent file (needs `requestRecordingPermissionsAsync`). Recordings default to the **cache** directory (OS may delete); document-directory is opt-in only. Config plugin: `microphonePermission`, `recordAudioAndroid`. `enableBackgroundRecording` DEFAULT FALSE. ⇒ Prefer metering-only / `useAudioStream` to avoid replayable files; if recorder metering is required, keep cache-only, never document-dir, never background, delete the local URI as soon as the waveform artifact is derived. |
| **@shopify/react-native-skia** | Requires RN ≥0.79 + react ≥19 (repo RN 0.81.5 / react 19.1 ⇒ COMPATIBLE). Expo: dev build, not Expo Go. Native: iOS pod install; Android NDK + proguard keep rule. Jest: `testEnvironment '@shopify/react-native-skia/jestEnv.js'` + `setupFilesAfterEach '@shopify/react-native-skia/jestSetup.js'` + add the pkg to `transformIgnorePatterns`. Web: supported (~2.9MB bundle). **Canvas→image snapshot reliability is NOT documented ⇒ treat snapshot as a SPIKE, not a dependency.** |
| **react-native-view-shot** | `captureRef(ref, {format, result:'tmpfile'(default)|'base64'|'data-uri', quality, width/height})`. tmpfile lives only while the app runs; `releaseCapture(uri)` to clean. base64 WARNING (string crosses the bridge → lag; small images only). Android GL/SurfaceView: `handleGLSurfaceViewOnAndroid` (FALSE by default). **Capturing a Skia canvas is NOT documented ⇒ spike risk.** Web via html2canvas, LIMITED for react-native-svg. MUST set `collapsable={false}` on Android Views and capture only AFTER the first `onLayout`. |
| **react-native-svg** | Actively maintained, v15.15.5 (2026-05); Expo-installable (`npx expo install react-native-svg`); iOS / Android / macOS / Windows + web compat layer; supports Path/Rect/Circle/Line/Polyline/Polygon/G ⇒ deterministic **static** waveform path; avoids the GL/SurfaceView snapshot caveats for static preview. ⇒ the reliable SVG fallback renderer + deterministic path export. |

---

## 4. FILE / AMEND / FOLD / SKIP table

| Disposition | Cards | Rationale |
|---|---|---|
| **FILE (net-new)** | All 14: VOICE-ADR-001, VOICE-001 … VOICE-010, MCP-K-001, MCP-K-002, AUDIO-001 | No existing issue owns STT / audio / waveform / Family-K. Each is a clean new slot. |
| **FILE-as-deferred** | AUDIO-001 (P3) | Filed but off the main path; does not block any P0/P1. Deferred audio-playback experiment. |
| **EXTEND (dependency-note, NOT duplicate)** | QOL-030 #199, QOL-031 #200, CARD-VIEW-DATA-001 #504, IX-003 #22 | Add explicit "extends #N" dependency notes; do NOT rebuild. QOL-030 = one-box chassis (VOICE adds a voice-capture box TYPE). QOL-031 = Act popout (VOICE adds a Speak/Record ENTRY). #504 (OPEN) = transcript / STT-confidence chip lands in its card zones (coordinate). IX-003 = a11y / keyboard contract VOICE inherits. |
| **FOLD** | none | No card folds into another; the ADR stays standalone (defines operative doctrine). |
| **SKIP** | none | No VOICE deliverable is superseded by shipped work. |

**False positives (ignored, NOT extended):** #468 (bot writing-voice), #5 (gradient wave rail visual), #588 (Request review allegations), #79 (transcript = vocab codes). Family J #473 confirms K is the free MCP slot.

---

## 5. Issue table

> Every `issue #` cell was patched with the filed issue number (#658–#671). All rows land on **Project #1**, Phase = **Backlog**.

| code | issue # | title | priority | effort | lane | GATE-C | automerge posture | dependencies | Project Phase |
|---|---|---|---|---|---|---|---|---|---|
| VOICE-ADR-001 | #658 | Speech-first input doctrine + no-audio privacy posture | P0 | S | docs ADR | No | Not eligible — operator-ratified (defines operative doctrine) | (root) | Backlog |
| VOICE-001 | #659 | Speech + waveform architecture design | P0 | L | design | No | Eligible after reviewer PASS (design-only) | VOICE-ADR-001 | Backlog |
| VOICE-002 | #660 | Native dependency + config plugin integration | P0 | M | native/config | **YES** | Not eligible — GATE-C (dev-build / config-plugin bearing) | VOICE-001 | Backlog |
| VOICE-003 | #661 | Speech recognition session state machine + transcript artifact model | P0 | M | pure TS | No | Prefer eligible after reviewer PASS (pure model) | VOICE-002 | Backlog |
| VOICE-004 | #662 | Audio metering + waveform artifact core | P0 | M | pure TS / adapter | No (unless native) | Prefer eligible after reviewer PASS; case-by-case if native lands in-card | VOICE-002 | Backlog |
| VOICE-005 | #663 | Live waveform visualizer spike (expo-audio + Skia + SVG fallback) | P0 | M | UI spike | Case-by-case | Case-by-case (spike; native/Skia branch ⇒ GATE-C) | VOICE-004 | Backlog |
| VOICE-006 | #664 | Waveform snapshot export spike (view-shot / fallback) | P1 | M | UI/dev-tooling spike | Case-by-case | Case-by-case (spike; capture path may be native) | VOICE-005 | Backlog |
| VOICE-007 | #665 | Universal VoiceInput adapter for every argument entry surface | P0 | L | UI foundation | Case-by-case | Case-by-case (gate-adjacent UI foundation) | VOICE-003, VOICE-004 | Backlog |
| VOICE-008 | #666 | Speech-first integration across argument entry surfaces | P0 | XL | UI integration | Case-by-case (YES if submit-path changes) | Not eligible if submit-path changes; else case-by-case | VOICE-007 | Backlog |
| VOICE-009 | #667 | Speech/waveform artifact persistence + MCP handoff, no audio | P1 | L | persistence/server | **YES** | Not eligible — GATE-C (migration + Edge persistence) | VOICE-008 | Backlog |
| VOICE-010 | #668 | Device/web speech + waveform smoke matrix | P1 | S | testing/docs | No | Eligible (docs/testing; live run operator-armed) | VOICE-008 | Backlog |
| MCP-K-001 | #669 | Family K speech/waveform artifact MCP design | P1 | M | MCP design | No (GATE-A only) | Eligible after reviewer PASS (design-only; GATE-A ratification separate) | VOICE-009 | Backlog |
| MCP-K-002 | #670 | Family K speech/waveform artifact MCP implementation | P2 | L | mcp-server (Deno-deploy-bearing) | **YES** | Not eligible — GATE-C (Deno-Deploy-bearing) | MCP-K-001 | Backlog |
| AUDIO-001 | #671 | Optional local audio playback experiment | P3 | S | deferred | **YES** | Not eligible — GATE-C + deferred (off main path) | (deferred; off the main path) | Backlog |

---

## 6. Dependency DAG (verbatim)

```
VOICE-ADR-001 -> VOICE-001 -> VOICE-002 -> {VOICE-003, VOICE-004}
VOICE-004 -> VOICE-005 -> VOICE-006
{VOICE-003, VOICE-004} -> VOICE-007 -> VOICE-008 -> {VOICE-009 -> MCP-K-001 -> MCP-K-002, VOICE-010}
AUDIO-001  (deferred, P3; does NOT block the main path)
```

**DAG rules (all satisfied):** no P0 hard-depends on a P2/P3; no MCP implementation before artifact persistence (MCP-K-002 after VOICE-009 + MCP-K-001); no waveform snapshot required for basic speech entry; no audio playback required for anything; no native install before the architecture design (VOICE-001 before VOICE-002).

---

## 7. Doctrine attestation

- **Acceptance-gate invariant:** AI / MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the SOLE gate. Classifiers run AFTER an argument is stored. No VOICE path may block, reject, route, or delay an ordinary user post. Speech recognition is a COMPOSITION AID, not a judge; waveform rendering is feedback that the mic is active, NOT evidence of credibility / sincerity / emotion / intent.
- **No truth adjudication:** no winner / loser / verdict framing; no machine-made person / intent accusation; no emotion detection; no speaker identity; no biometric inference; no "voice stress" / "tone" / "anger" / "confidence" / "honesty" / "manipulation-by-voice" classification anywhere in the slate or any card.
- **Text-only fallback exists for EVERY entry window.** Permission denial NEVER blocks text posting. Speech-recognition failure NEVER blocks text posting.
- **Plain language only** in user-facing strings (no raw internal codes); any waveform image is non-authoritative decoration / provenance, not evidence of what was said.

---

## 8. Privacy / no-audio attestation

- **Raw audio is NOT stored / uploaded / replayed / shared / sent to MCP in v1.** No local audio URI is persisted to Supabase or MCP.
- `expo-speech-recognition` `recordingOptions.persist` stays OFF/absent (v1); `expo-audio` paths prefer metering-only / `useAudioStream` (no persistent file); if a recorder metering path is unavoidable it stays cache-only, never document-dir, never background, and the local URI is deleted as soon as the waveform artifact is derived.
- No service-role in client. No direct insert into `public.arguments`. The only persisted artifacts (VOICE-009) are the transcript text the user chose to keep + a non-authoritative waveform image / deterministic SVG path — never raw audio.

---

## 9. Native build attestation

- The repo is **MANAGED / CNG** (`app.json` only; no `ios/`, `android/`, `eas.json`, `app.config.*`). The native-config libraries CANNOT run in Expo Go.
- ⇒ Adopting speech / audio / Skia / view-shot requires **config plugins + a development build** (EAS Build or local prebuild). No native code can be exercised in Expo Go.
- **VOICE-002 is the GATE-C native/config card** (dependency install + config-plugin registration + dev-build). No native install happens before the architecture design (VOICE-001 precedes VOICE-002). VOICE-005/006 native/Skia branches are case-by-case GATE-C spikes; VOICE-009 (migration + Edge persistence) and MCP-K-002 (Deno-Deploy) and AUDIO-001 are GATE-C.

---

## 10. MCP Family K attestation

- **K is the next free letter** (A–I production-enabled, J `sensitive_composer` frozen `productionEnabled:false`; #473 confirms K free).
- **No audio is sent to MCP.** Family K consumes only the persisted non-authoritative speech / waveform artifact (transcript text + waveform shape metadata), never raw audio.
- Family K MUST respect the response cap (`MAX_FLAGS_PER_RESPONSE = 20`): stay ≤20 keys or use the shipped #545 request batching (`BATCH_SIZE = 16`).
- **MCP-K-002 is Deno-Deploy-bearing GATE-C:** `mcp-server/` is not a Supabase Edge Function and is NOT production-live on git merge — live only after the standalone MCP server redeploys to Deno Deploy AND a hosted `*.deno.net` smoke passes. MCP-K-002 lands only after VOICE-009 (artifact persistence) + MCP-K-001 (design).

---

## 11. Divergence ledger

1. **Run date vs file date.** The slate is *named* and *dated* `2026-06-13` (the run name), but is filed **2026-06-18**. The card spec, baseline anchors, and doctrine restatements are carried verbatim from the 2026-06-13 brief.
2. **Main advanced past the original baseline.** The brief's verified-facts pass was taken at `main @ 3c99cbc`; the primary worktree is separately parked on `feat/arch-001-card3-retune-pacer @ 9719bd9` (the source of the 2 RO-40 / branch-artifact Jest failures). The VOICE slate baselines against `main @ 3c99cbc` (merged-green).
3. **Stale-branch Jest failures are not regressions.** The 2 failures (RO-40 `RefereeBannerView` byte-equal-vs-main + 1 other) come from the parked `feat/arch-001` branch, not from `main`. No VOICE card is gated on them.
4. **Docs-automerge armed mid-run.** The operator armed `CDISCOURSE_ALLOW_DOCS_AUTOMERGE=1` after the slate was drafted, so this docs-only PR auto-merges once all §15 gates pass (path-verified docs-only, secret-scan clean, no issues closed, typecheck+lint green on main, Jest unchanged by the code-inert diff). The automerge applies ONLY to this docs PR; VOICE-ADR-001's own implementation remains operator-ratified doctrine, and every GATE-C card (VOICE-002/009, MCP-K-002, AUDIO-001) stays operator-gated.
5. **All 14 cards are net-new; four existing issues are EXTEND targets only.** No VOICE deliverable duplicates a shipped or open card; #199/#200/#504/#22 receive dependency-note extensions, not rebuilds.

---

## 12. Recommended next command

```
.\.claude\scripts\spawn-card.ps1 VOICE-001
```

(VOICE-ADR-001 is the doctrine root; VOICE-001 is the first design card and the recommended first spawn after the ADR is ratified.)
