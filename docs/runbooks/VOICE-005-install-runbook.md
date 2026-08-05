# VOICE-005 install runbook — live waveform visualizer spike

- **Card:** issue 663
- **Governing design:** `docs/designs/VOICE-005.md`
- **Governing contracts:** VOICE-ADR-002 (scoped audio persistence + non-replayability), VOICE-001 (voice shell + capability + doctrine boundary), VOICE-004 (waveform reducer + artifact — the source of the buckets the visualizer renders)
- **Owner:** the operator running the on-device spike. Claude does NOT execute the install steps in this card.
- **Reversibility floor:** every step has a documented rollback. See § R for the four named rollback scenarios.

## What this runbook is (and is not)

VOICE-005 ships a pure-TS renderer core (`bucketsToPathSegments`, `pathSegmentsToSvgD`, `applyPathSegmentsToSkiaPath`, `quantizeBucketsForRender`) plus a doctrine source-scan guard. That code is INERT until the operator installs the three native dependencies (`@shopify/react-native-skia`, `expo-audio`, `react-native-svg`) and generates the native shells. THIS runbook is the operator recipe for that install.

Per the orchestrator ruling of 2026-08-04 (see design §13), the `app.json` `plugins` array addition + the matching `voice005AppJsonContract.test.ts` were moved out of the VOICE-005 branch and into this runbook. Adding the `expo-audio` plugin tuple to `app.json` on a branch without `expo-audio` installed breaks `npm run web:build`: the Expo config resolver walks `expo.plugins` eagerly during `expo export --platform web` and calls `require.resolve('expo-audio/app.plugin.js')`, raising a hard `PluginError` if the module is not installed. The runbook now adds the plugin tuple + the contract test in the SAME commit as the `npx expo install expo-audio` step.

**Explicitly OUT of scope for THIS card:**

- The React component `VoiceWaveformVisualizer.tsx` is DEFERRED to VOICE-005-composition (or folded into VOICE-007). Statically importing `@shopify/react-native-skia` on this branch would break `npm run web:build`.
- On-device screenshots and the `gh pr ready` promotion mechanic move to the composition card. There is no component to shoot yet on this branch.
- `package.json` / `package-lock.json` / `eas.json` / `App.tsx` / `.env.example` are NEVER committed on the `feat/voice-005-visualizer` branch. Adding them would break `npm ci` on CI or freeze VOICE-002 decisions this card explicitly defers.

## Preconditions (hard checklist)

The operator confirms ALL of the following BEFORE running Step 1:

1. OS is Windows 11 (Git Bash), macOS, or Linux. PowerShell is NOT the recommended shell — every command below is Git-Bash flavored to match existing runbooks.
2. Node version matches `package.json` `engines`.
3. `git status` in the working tree is clean; branch is `feat/voice-005-visualizer` (or a fresh clone thereof); the branch is up-to-date with the operator origin.
4. `npm run typecheck && npm run lint && npm run test && npm run web:build` all exit 0 on the current commit (this is the reversibility floor — everything after must return to green).
5. The operator has read `docs/designs/VOICE-005.md` § 0 (ADR-002 reconciliation), § 8.3 (mic-permission copy), and § 13 (why the plugin registration moved to the runbook).
6. The operator understands this runbook does NOT ship an on-device dev build in this card. The composition card follows.

If any precondition fails, STOP and resolve the failure before continuing.

## Steps

### Step 1 — Baseline confirmation

- **Command:** `npm run typecheck && npm run lint && npm run test && npm run web:build`
- **Expected output:** all four commands exit 0. The `test` line reports the +5 test suites added by VOICE-005 (bucketsToPathSegments, quantizeBucketsForRender, svgPathAdapter, skiaPathAdapter, voice005ForbiddenInferenceGuard). NOTE: `voice005AppJsonContract.test.ts` is NOT yet present on the branch — it lands in Step 3.
- **Verification:** `git status --porcelain` is empty. `grep -c '"expo-audio"' app.json` returns 0 (the plugin tuple lands in Step 3).
- **If failed:** abort the install. Fix the baseline first. Do not proceed with a red gate.
- **Reversibility:** N/A (read-only).

### Step 2 — Install the three native deps

- **Command:** `npx expo install @shopify/react-native-skia expo-audio react-native-svg`
- **Expected output:** `package.json` gains three entries under `dependencies`; `package-lock.json` regenerates.
- **Verification:** `npx expo doctor` exits 0 (or only reports known-yellow items that predate this card). `git status` shows `package.json` and `package-lock.json` as modified but nothing else.
- **If failed:** consult § C troubleshooting by exit code. Common causes: stale `node_modules` from a prior branch (`rm -rf node_modules package-lock.json && npm install`), Node version drift, or npm-registry outage.
- **Reversibility:** `git checkout package.json package-lock.json && rm -rf node_modules && npm install`.

### Step 3 — Add the `expo-audio` plugin tuple to `app.json` AND add `voice005AppJsonContract.test.ts` — SAME commit as Step 2

**This is the step the design amendment of 2026-08-04 moved out of the VOICE-005 branch.** With `expo-audio` now installed, the Expo config resolver can resolve the plugin at build time; the additions below are safe.

- **Command (edit `app.json`):** insert the exact tuple text below into `expo.plugins`. If `expo.plugins` does not yet exist, add it as a new sibling of `web`:

    ```json
    "plugins": [
      [
        "expo-audio",
        {
          "microphonePermission": "CivilDiscourse uses your microphone only to visualize your voice while you speak. Audio is not recorded, saved, or uploaded."
        }
      ]
    ]
    ```

- **Command (add `__tests__/voice005AppJsonContract.test.ts`):** create the file with the exact body in Appendix E.
- **Expected output:** `git diff app.json` shows one additive hunk; `__tests__/voice005AppJsonContract.test.ts` exists.
- **Verification:** `npx jest voice005AppJsonContract` exits 0 (all six contract tests pass). `npm run web:build` exits 0 (the config resolver can now find `expo-audio`). `grep -c 'microphonePermission' app.json` returns 1. `grep -c '"expo-audio"' app.json` returns 1.
- **If failed:** the plugin key was mis-cased or the tuple is malformed. See § C branch "prebuild: cannot resolve plugin `expo-audio`" and the exact error message from `npx jest voice005AppJsonContract`.
- **Reversibility:** `git checkout app.json && rm __tests__/voice005AppJsonContract.test.ts`.

### Step 4 — Do NOT commit `package.json` or `package-lock.json`

This runbook EXPLICITLY forbids `git add package.json` or `git add package-lock.json` on the `feat/voice-005-visualizer` branch. The three deps are operator-local for this card so branch CI (which runs `npm ci`) does NOT need them yet. VOICE-005-composition (or VOICE-007) will pin the versions on a follow-up branch after the composition + on-device proof land.

- **Verification:** `git diff --name-only origin/main` does NOT list `package.json` or `package-lock.json`.

### Step 5 — Optional: `npx expo prebuild --clean`

- **Command:** `npx expo prebuild --clean`
- **Expected output:** `ios/` (macOS only) and `android/` directories appear at the repo root, freshly generated.
- **Verification (macOS, iOS):** `grep -c 'NSMicrophoneUsageDescription' ios/*/Info.plist` returns 1 AND `grep -A 1 'NSMicrophoneUsageDescription' ios/*/Info.plist` shows the string byte-for-byte matching `app.json` `plugins[0][1].microphonePermission`.
- **Verification (Android):** `grep -c 'android.permission.RECORD_AUDIO' android/app/src/main/AndroidManifest.xml` returns 1. `grep -ci 'RECORD_AUDIO_BACKGROUND\|FOREGROUND_SERVICE_MICROPHONE' android/app/src/main/AndroidManifest.xml` returns 0 — the background-recording flags are intentionally OFF per ADR-002 § 5.
- **If failed:** see § C. iOS prebuild only runs on macOS. Windows operators may skip the iOS half of this step in this card; VOICE-005-composition will require both platforms.
- **Reversibility:** `git clean -fdx ios android`.

### Step 6 — Do NOT commit `ios/` or `android/`

Runbook EXPLICITLY forbids `git add ios` or `git add android`. These directories are ephemeral Continuous Native Generation (CNG) outputs; committing them from this branch would prematurely freeze VOICE-002's future decision (managed vs bare workflow, Xcode / Gradle project layout, custom Podfile / build.gradle edits). Keep them untracked.

- **Verification:** `git status --porcelain` shows `ios/` and `android/` as untracked (question-mark prefix), not staged.

### Step 7 — Post-install branch CI

- **Command:** `npm run typecheck && npm run lint && npm run test && npm run web:build`
- **Expected output:** all four commands still exit 0 with the new deps installed AND the `app.json` plugin registered AND `voice005AppJsonContract.test.ts` present. This proves the pure renderer stays green with the deps present — a nice property since Skia sits on the disk but is never imported by anything in the visualizer folder.
- **Verification:** `grep -c '@shopify/react-native-skia' dist/**/*.js` (adjust glob for the web bundle output path) returns 0. The visualizer folder is Skia-free; if a follow-up card ever accidentally static-imports Skia, this grep will fail and the doctrine guard test will fail before it.
- **If failed:** the install broke jest / lint / typecheck / web:build in a way that means a shipped dependency conflicts. Back out per Step 8.
- **Reversibility:** Step 8.

### Step 8 — Reversal recipe (only if the spike is aborted)

- **Command:** `git checkout main && git clean -fdx ios android node_modules && npm ci`
- **Expected output:** the working tree is back at the baseline commit; `app.json` no longer carries the `plugins` array; the three deps are gone; `node_modules` is fresh.
- **Verification:** `npm run typecheck && npm run lint && npm run test && npm run web:build` all exit 0. The reversibility floor is confirmed.

### Step 9 — Cross-reference for the composition card

When VOICE-005-composition (or VOICE-007) starts, its implementer reads `docs/designs/VOICE-005.md` § 5 (intended composition shape) so they do not re-derive the subscription pattern, the Platform-based Skia / SVG split, the permission-denied banner copy, or the renderer override for testing. This runbook has already documented every one of those in § 8 of the design; the composition card only implements them.

## Appendix A — Mic-permission copy (single source of truth)

The doctrine-approved microphone permission copy is:

> **CivilDiscourse uses your microphone only to visualize your voice while you speak. Audio is not recorded, saved, or uploaded.**

Rules:

- The copy lives in `app.json` `plugins[0][1].microphonePermission` (added by Step 3). NEVER hand-write `ios.infoPlist.NSMicrophoneUsageDescription` or `android.permissions.RECORD_AUDIO` alongside — the `expo-audio` config plugin overwrites both on prebuild, and a double source of truth is a classic App Store review reject cause.
- The `microphonePermission` key spelling is camelCase. Wrong casings (`microphonePermissions`, `micPermission`, `MicrophonePermission`) silently no-op. `voice005AppJsonContract.test.ts` (added in Step 3) catches this.
- `enableBackgroundRecording` MUST stay at its default `false` per ADR-002 § 5. Never add it to the plugin config with an explicit `true`.
- Apple app-review rejects vague permission strings. This copy names the purpose (visualize) AND explicitly denies recording / saving / uploading — the two clauses the reviewer looks for.

## Appendix R — Rollback quick-ref (four named scenarios)

- **R1: Prebuild succeeded but the native build later fails.** `git clean -fdx ios android` then re-run Step 5. Untracked CNG outputs regenerate cleanly.
- **R2: `npm ci` fails after checkout.** `rm -rf node_modules package-lock.json && npm install`. Then re-run Step 2 to re-install the three deps AND Step 3 to re-add the plugin + contract test.
- **R3: On-device screenshots (in the FUTURE composition card) reveal doctrine-forbidden UI copy.** Do NOT merge that PR. Comment on the PR with the exact offending copy string. File a follow-up card. Keep the composition PR in draft until the copy is fixed.
- **R4: This card's `app.json` change already merged to `main` and broke prebuild for another workflow.** `git revert -m 1 <merge-sha> && git push origin main`. Re-trigger any downstream Netlify build. File a follow-up card describing the interaction so the composition card can pre-clear it.

## Appendix C — Troubleshooting tree (indexed by symptom)

- **Symptom:** `expo doctor: package.json declares a dependency on X but the installed version is Y`
  - **Fix:** `rm -rf node_modules package-lock.json && npm install`; then re-run `npx expo install` with the failing dep.
- **Symptom:** `prebuild: cannot resolve plugin 'expo-audio'`
  - **Fix:** the plugin key was mis-cased in `app.json`. Run `npx jest voice005AppJsonContract` — it fails loudly on this case with the exact wrong-casing detected.
- **Symptom:** `PluginError: Failed to resolve plugin for module "expo-audio"` during `web:build` or `expo export`
  - **Cause:** the operator added the plugin tuple to `app.json` BEFORE running `npx expo install expo-audio`. Step 3 must land AFTER Step 2 in the same commit.
  - **Fix:** ensure `expo-audio` is installed (`ls node_modules/expo-audio` shows the module directory), then re-run `web:build`.
- **Symptom:** `iOS prebuild fails with CocoaPods error`
  - **Fix:** operator's `pod --version` / `xcode-select -p` is stale. `pod repo update` and re-open Xcode. Step 5 is macOS-only for iOS prebuild.
- **Symptom:** `Android prebuild fails with Gradle sync error`
  - **Fix:** Android SDK is not installed or is stale. Only Skia's C++ compile requires it. On Windows the operator may skip Android prebuild for this card; the composition card will require it.
- **Symptom:** `web:build fails with 'Cannot find module @shopify/react-native-skia'`
  - **Cause:** a file under `src/features/voice/visualizer/` (or a future component) is STATIC-importing Skia. Static imports enter the web bundle graph even under a runtime flag.
  - **Fix:** move the import behind a `.native.tsx` / `.web.tsx` file split OR a `Platform.select` at the import site. The doctrine guard test `voice005ForbiddenInferenceGuard.test.ts` will also fire loudly on this — check its output first.

## Appendix D — What this runbook does NOT do

- Does NOT run `eas build` or `eas login`.
- Does NOT create or edit `eas.json`.
- Does NOT flip an EAS Updates channel.
- Does NOT deploy an OTA update.
- Does NOT invoke any Anthropic, xAI, X, or Supabase API.
- Does NOT touch `.env`, `.env.bot-tests`, `.env.engagement-intelligence`, or `.env.example`.
- Does NOT install any dep other than the three named here.
- Does NOT create a top-level `docs/operator/` directory (existing `docs/runbooks/` convention wins).

## Appendix E — Contract test the operator adds in Step 3

Create `__tests__/voice005AppJsonContract.test.ts` with the EXACT body below (byte-equal — the doctrine copy is pinned as a string constant):

```ts
/**
 * VOICE-005 (issue 663) - app.json expo-audio plugin contract.
 *
 * Pins the plugin tuple shape and the microphonePermission copy
 * byte-for-byte. Two failure modes this catches:
 *   (1) Wording drift. The copy names purpose (visualize) AND denies
 *       recording / saving / uploading. App Store review rejects vague
 *       strings; a silent edit to something like "for voice features"
 *       would fail review at the WORST possible moment.
 *   (2) Key mis-casing. expo-audio silently ignores wrong-cased plugin
 *       keys (microphonePermissions, micPermission). The doctrine-
 *       intended permission would never reach the Info.plist or
 *       AndroidManifest.
 *
 * This test loads app.json with require (jest handles JSON) and asserts
 * string equality on every field the doctrine cares about.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

const DOCTRINE_MIC_COPY =
  'CivilDiscourse uses your microphone only to visualize your voice while you speak. Audio is not recorded, saved, or uploaded.';

interface AppJsonShape {
  readonly expo: {
    readonly plugins?: ReadonlyArray<
      readonly [string, Readonly<Record<string, string>>]
    >;
  };
}

describe('VOICE-005 app.json expo-audio plugin contract', () => {
  const appJson = require('../app.json') as AppJsonShape;

  test('expo.plugins is present and is an array of exactly one entry', () => {
    expect(Array.isArray(appJson.expo.plugins)).toBe(true);
    expect(appJson.expo.plugins).toHaveLength(1);
  });

  test('the single plugin entry is expo-audio', () => {
    const plugins = appJson.expo.plugins as ReadonlyArray<readonly [string, Record<string, string>]>;
    expect(plugins[0][0]).toBe('expo-audio');
  });

  test('the plugin config uses the camelCase microphonePermission key', () => {
    const plugins = appJson.expo.plugins as ReadonlyArray<readonly [string, Record<string, string>]>;
    const cfg = plugins[0][1];
    expect(Object.prototype.hasOwnProperty.call(cfg, 'microphonePermission')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(cfg, 'microphonePermissions')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cfg, 'micPermission')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cfg, 'MicrophonePermission')).toBe(false);
  });

  test('microphonePermission is byte-equal to the doctrine copy', () => {
    const plugins = appJson.expo.plugins as ReadonlyArray<readonly [string, Record<string, string>]>;
    const cfg = plugins[0][1];
    expect(cfg.microphonePermission).toBe(DOCTRINE_MIC_COPY);
  });

  test('the plugin config does NOT enable background recording (ADR-002 section 5)', () => {
    const plugins = appJson.expo.plugins as ReadonlyArray<readonly [string, Record<string, string>]>;
    const cfg = plugins[0][1];
    expect(Object.prototype.hasOwnProperty.call(cfg, 'enableBackgroundRecording')).toBe(false);
  });

  test('runbook file exists and references the same doctrine copy', () => {
    const fs = require('fs');
    const path = require('path');
    const runbookPath = path.join(
      process.cwd(),
      'docs',
      'runbooks',
      'VOICE-005-install-runbook.md',
    );
    const runbook = fs.readFileSync(runbookPath, 'utf8');
    expect(runbook).toContain(DOCTRINE_MIC_COPY);
  });
});
```

## Appendix P — PR promotion mechanic

The `feat/voice-005-visualizer` branch opens the PR as DRAFT. The operator promotes to ready-for-review by posting a comment on the PR containing:

- Confirmation of § Preconditions (all six checked).
- Confirmation of Step 7 output (all four commands green post-install AND Step 3 landed).
- If macOS: verification-line output from Step 5 (iOS grep + Android grep).
- If Windows: verification-line output from Step 5 (Android grep only).
- The operator's explicit `gh pr ready` invocation (or one-click UI equivalent).

The screenshots + on-device visual proof mechanic is deferred to VOICE-005-composition / VOICE-007. This runbook only promotes the pure-TS core + `app.json` plugin registration (added by Step 3).
