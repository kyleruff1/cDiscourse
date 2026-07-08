# ASP-FLAGS-001 — Feature-flag registry for ASP surfaces (static EXPO_PUBLIC reads)

**Status:** Design draft
**Epic:** ASP-000 (Argument Surface Pivot) · Milestone M-ASP-0 · Lane ux-infra (pure TS)
**Release:** Phase 0 (slice 02b, `14_PR_SLICING_PLAN.md`)
**Issue:** https://github.com/kyleruff1/debate-constitution-app/issues/873

---

## Goal (one paragraph)

Ship a single typed feature-flag registry (`src/lib/featureFlags.ts`) that resolves the seven Argument Surface Pivot (ASP) surface flags — `home_v2`, `room_exchange_v2`, `proof_drawer`, `voice_entries`, `timestamp_rebuttals`, `one_time_playback`, `move_marks` — each **default OFF**. This is the rollback story for the whole pivot: every downstream ASP surface card rides its flag, so "rollback = flag OFF" (slice 02b). The design exists to prevent every downstream card from hand-rolling its own env read and re-risking the house gotcha that bit the Google SSO gate in PR #776: **`babel-preset-expo` inlines `EXPO_PUBLIC_*` values ONLY for static member reads (`process.env.EXPO_PUBLIC_X`); a dynamic computed read passes jest + typecheck (Node has a real `process.env`) but is `undefined` in the deployed Netlify web bundle**, silently forcing every flag OFF in production while all CI stays green. The module mirrors the shipped exemplar `src/features/auth/googleAuthGate.ts` (#746, gate-fix #776) exactly. Doctrine constraints that shape this design: flags gate **UI surface availability only** — never the deterministic Constitution engine, never validation outcomes, never truth/score (cdiscourse-doctrine §1, §5); all flags default OFF so merging exposes nothing to any user (private-by-default); the `EXPO_PUBLIC_` prefix is the public-config contract, so these are runtime toggles, never secrets (§6); no consumer wiring lands in this card, so the visual diff is exactly zero.

---

## Data model

**No new persisted data model. No migration. No table. No RLS.** These are build-time / runtime configuration booleans, not database rows.

The only "type" introduced is a small in-module registry of flag descriptors. The public shape is a set of named boolean accessors plus a frozen registry of the seven `{ key, envName, resolve }` descriptors used by the guard test and by future consumers.

```ts
// src/lib/featureFlags.ts — illustrative shape (implementer owns final wording)

/** The seven ASP surface flags. Stable string ids used as registry keys. */
export type AspFeatureFlag =
  | 'home_v2'
  | 'room_exchange_v2'
  | 'proof_drawer'
  | 'voice_entries'
  | 'timestamp_rebuttals'
  | 'one_time_playback'
  | 'move_marks';

/** A single flag descriptor. `resolve()` returns the current boolean state. */
export interface AspFeatureFlagDescriptor {
  /** Stable internal id, e.g. 'home_v2'. */
  readonly key: AspFeatureFlag;
  /** The public runtime env var name, e.g. 'EXPO_PUBLIC_HOME_V2'. */
  readonly envName: string;
  /** Pure resolver — reads the runtime-env shim then the STATIC process.env dot read. */
  readonly resolve: () => boolean;
}
```

The registry maps each `AspFeatureFlag` to its descriptor. Because a computed `process.env[descriptor.envName]` read is FORBIDDEN (that is the #776 defect), each descriptor's `resolve()` closes over a **hard-coded static dot read** — the env access cannot be factored into a shared loop that indexes `process.env` by a variable. See "API / interface contracts" for the exact per-flag shape.

---

## File changes

### New files

- `src/lib/featureFlags.ts` — the registry. ~110–140 lines including the mandatory doc comment that explains the static-read gotcha in prose (WITHOUT ever writing the banned bracket literal — see "Edge cases"). Contains:
  - the `AspFeatureFlag` union + `AspFeatureFlagDescriptor` interface,
  - seven env-name constants (`export const HOME_V2_FLAG = 'EXPO_PUBLIC_HOME_V2' as const;` etc.),
  - seven resolver functions, each with exactly ONE static `process.env.EXPO_PUBLIC_<NAME>` dot read,
  - seven named boolean accessors (e.g. `isHomeV2Enabled()`),
  - a frozen `ASP_FEATURE_FLAGS` registry object keyed by `AspFeatureFlag`,
  - a convenience `resolveAspFeatureFlag(key: AspFeatureFlag): boolean` that dispatches to the descriptor's `resolve()` (a real-object registry lookup — NOT a `process.env` index).

- `__tests__/featureFlags.test.ts` — behavioral suite (~90–130 lines). Per-flag default-off matrix, exact-`'true'` enable, shim-override parity, flag independence. See "Test plan".

- `__tests__/featureFlagsStaticEnv.test.ts` — source-scan guard (~70–100 lines). Seven static-literal presence assertions + recursive `src/` ban on the dynamic-read substring + a red-on-violation self-test fixture. See "Test plan". (The issue permits extending the existing `__tests__/googleAuthGateStaticEnv.test.ts` instead; a **separate** file is recommended so the ASP guard's `src/`-wide recursion does not entangle the auth gate's single-file check, and so a future auth refactor cannot silently drop the ASP scan.)

### Modified files

- `.env.example` — append the seven flag names, **names only, empty values**, under a short comment block (see "`.env.example` additions"). ~10 added lines. No other file content changes.

### Deleted files

- None.

### Explicitly NOT modified

- `src/lib/supabase.ts` — the `CDiscourseRuntimeEnv` interface is **not** extended. `readRuntimeEnv()` production output projects only its three known slots; the ASP flags are read from the shim defensively via a `Record` cast (mirrors `googleAuthGate.ts:52`), so no shim-type change is needed. See "Risks".
- Any `src/features/**` screen or component — **no consumer wiring** in this card.

---

## API / interface contracts

The production web path is the **static `process.env.EXPO_PUBLIC_<NAME>` dot read**. That is the ONLY form `babel-preset-expo` inlines into the Netlify bundle. Everything else about resolution mirrors `googleAuthGate.ts`.

### Per-flag env-name mapping (from `07_COMPONENT_REFACTOR_PLAN.md` feature-flags row)

| Flag id (`AspFeatureFlag`) | Env var name (static read literal) | Accessor |
|---|---|---|
| `home_v2` | `EXPO_PUBLIC_HOME_V2` | `isHomeV2Enabled()` |
| `room_exchange_v2` | `EXPO_PUBLIC_ROOM_EXCHANGE_V2` | `isRoomExchangeV2Enabled()` |
| `proof_drawer` | `EXPO_PUBLIC_PROOF_DRAWER` | `isProofDrawerEnabled()` |
| `voice_entries` | `EXPO_PUBLIC_VOICE_ENTRIES` | `isVoiceEntriesEnabled()` |
| `timestamp_rebuttals` | `EXPO_PUBLIC_TIMESTAMP_REBUTTALS` | `isTimestampRebuttalsEnabled()` |
| `one_time_playback` | `EXPO_PUBLIC_ONE_TIME_PLAYBACK` | `isOneTimePlaybackEnabled()` |
| `move_marks` | `EXPO_PUBLIC_MOVE_MARKS` | `isMoveMarksEnabled()` |

### Resolver contract (one per flag — HOME_V2 shown; the other six are identical modulo name)

```ts
import { readRuntimeEnv } from './supabase';

export const HOME_V2_FLAG = 'EXPO_PUBLIC_HOME_V2' as const;

/**
 * Default OFF. True ONLY when the public runtime flag resolves to the exact
 * string 'true'. Resolution order mirrors src/lib/supabase.ts and
 * src/features/auth/googleAuthGate.ts: the runtime-env shim (a real-object
 * Record access, NOT an inlining concern) first, then the STATIC process.env
 * dot read (native + local dev, and the path Metro inlines for the web bundle).
 */
export function isHomeV2Enabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[HOME_V2_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_HOME_V2; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}
```

Notes on the contract, all load-bearing:

- **One static dot read per flag.** There is no shared helper that takes an env-name and indexes `process.env` by it — that would be the un-inlined dynamic form and would break the whole registry on web. Seven flags ⇒ seven hard-coded `process.env.EXPO_PUBLIC_<NAME>` literals in the source. The guard test asserts each literal is present.
- **Runtime-shim read via `Record` cast is safe.** `(readRuntimeEnv() as Record<string, unknown>)[HOME_V2_FLAG]` indexes the returned **object**, not `process.env`. It is not an inlining concern and is not caught by the `process.env[` ban. It is retained solely so a test that stubs `readRuntimeEnv()` can flip a flag (parity with `googleAuthGate.ts`), and so the Cloud-Run shim path stays open should the shim ever carry these keys. In production today `readRuntimeEnv()` returns only its three typed slots, so the shim contributes nothing and the static `process.env` read is authoritative.
- **Exact `=== 'true'`.** Unset, `''`, `'false'`, `'1'`, `'TRUE'`, `'True'`, `' true '`, `'yes'`, `'enabled'` — all resolve `false`. Only the exact three-character lowercase `'true'` enables.
- **Difference from `googleAuthGate.ts`:** the ASP resolvers do NOT gate on `SUPABASE_CONFIGURED`. These flags toggle client-only UI surfaces that do not require a live Supabase connection to be legible; adding a Supabase-config guard would wrongly force every ASP surface OFF in an unconfigured local build. (The Google gate needs it because sign-in is meaningless without Supabase.) This is an intentional, documented divergence.

### Registry + dispatcher

```ts
export const ASP_FEATURE_FLAGS: Readonly<Record<AspFeatureFlag, AspFeatureFlagDescriptor>> = Object.freeze({
  home_v2:             { key: 'home_v2',             envName: HOME_V2_FLAG,             resolve: isHomeV2Enabled },
  room_exchange_v2:    { key: 'room_exchange_v2',    envName: ROOM_EXCHANGE_V2_FLAG,    resolve: isRoomExchangeV2Enabled },
  proof_drawer:        { key: 'proof_drawer',        envName: PROOF_DRAWER_FLAG,        resolve: isProofDrawerEnabled },
  voice_entries:       { key: 'voice_entries',       envName: VOICE_ENTRIES_FLAG,       resolve: isVoiceEntriesEnabled },
  timestamp_rebuttals: { key: 'timestamp_rebuttals', envName: TIMESTAMP_REBUTTALS_FLAG, resolve: isTimestampRebuttalsEnabled },
  one_time_playback:   { key: 'one_time_playback',   envName: ONE_TIME_PLAYBACK_FLAG,   resolve: isOneTimePlaybackEnabled },
  move_marks:          { key: 'move_marks',          envName: MOVE_MARKS_FLAG,          resolve: isMoveMarksEnabled },
});

/** Registry lookup (a real-object index, NOT a process.env index) → the flag's boolean. */
export function resolveAspFeatureFlag(key: AspFeatureFlag): boolean {
  return ASP_FEATURE_FLAGS[key].resolve();
}
```

Strict-clean typing: no `any`. The `Record<string, unknown>` cast on the shim result is the same pattern already shipped in `googleAuthGate.ts` and is not an `any`.

---

## `.env.example` additions

Append (names only, no values — the empty value IS the default-OFF state; the `EXPO_PUBLIC_` prefix marks these as safe-to-expose public config, never secrets):

```
# ASP-FLAGS-001 — Argument Surface Pivot feature flags. Each defaults OFF; set a
# flag to the exact string true to enable that surface. Public runtime toggles,
# NOT secrets. Left empty here so a fresh .env keeps every ASP surface OFF.
EXPO_PUBLIC_HOME_V2=
EXPO_PUBLIC_ROOM_EXCHANGE_V2=
EXPO_PUBLIC_PROOF_DRAWER=
EXPO_PUBLIC_VOICE_ENTRIES=
EXPO_PUBLIC_TIMESTAMP_REBUTTALS=
EXPO_PUBLIC_ONE_TIME_PLAYBACK=
EXPO_PUBLIC_MOVE_MARKS=
```

Note: the shipped `.env.example` does NOT list `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` even though it exists. Listing the ASP flags here is a deliberate improvement for discoverability, and the issue explicitly calls for ".env.example additions (names only)". Keep the comment apostrophe-free is not required for `.env.example` (it is not scanned by the doctrine string-parity scanner), but the phrasing above already avoids apostrophes for safety.

---

## How a future card flips a flag (doc section — belongs in the module doc comment + this design)

This card ships the registry with **every flag OFF and zero consumers**. A downstream ASP surface card (HOME-001, ROOM-002, PROOF-002, MARKS, etc.) does two things:

1. **Consume** the accessor at the surface boundary, e.g. in the home lane:
   ```ts
   import { isHomeV2Enabled } from '../../lib/featureFlags';
   // ...
   if (isHomeV2Enabled()) { /* render home_v2 surface */ } else { /* current surface */ }
   ```
   The consuming card owns the byte-identical fallback branch and its own zero-diff proof when the flag is OFF.

2. **Flip the value** — an operator action, never by Claude, never in this repo's committed code:
   - **Web (Netlify / Cloud Run):** set the env var (e.g. `EXPO_PUBLIC_HOME_V2=true`) in the deployment environment and republish. Per house memory `expo-web-static-env-inlining`, **Netlify bakes `EXPO_PUBLIC_*` at build time** — the value is inlined into the JS bundle by `babel-preset-expo` during `npm run web:build`, so a flip requires a rebuild + republish, not just an env edit on a running instance. (The Cloud-Run runtime-env shim path — `window.__CDISCOURSE_RUNTIME_ENV__` — is the exception that can inject at container start, but `readRuntimeEnv()` only projects its three typed slots today; using the shim for an ASP flag would require extending `CDiscourseRuntimeEnv`, out of scope here.)
   - **Native / local dev:** set the var in `.env` before `expo start` / `expo run:*`.
   - **Rollback:** unset the var (or set anything other than `'true'`) and rebuild/republish → the surface returns to its default-OFF branch. That is the pivot's rollback story (slice 02b: "rollback = flag OFF").

---

## Edge cases

The implementer must handle:

- **Web bundle vs jest env (the whole reason this card exists).** jest runs on Node with a real `process.env`, so a behavioral test can never observe the Metro-inlining defect. The **source-scan guard** is the real regression net: it asserts each of the seven static literals is present in the source AND that no dynamic `process.env[` read exists anywhere in `src/`.
- **`undefined` vs `'false'`.** An unset env var reads `undefined`; `undefined === 'true'` is `false`. An explicit `'false'` also reads `false`. Both must resolve OFF. The exact-`'true'` check handles both without a special case.
- **Whitespace / casing traps.** `' true '`, `'TRUE'`, `'True'` must all resolve `false` (no trim, no lowercase). This is intentional strictness copied from the auth gate — an operator who typos the value gets a safe OFF, not a surprise ON.
- **Shim carries a non-string.** If `readRuntimeEnv()` ever returns a non-string for a flag key (e.g. a boolean or object), the `typeof fromRuntime === 'string'` guard falls through to the `process.env` read. Never coerce a truthy non-string to enabled.
- **The doc comment must not self-trip the ban.** `src/lib/featureFlags.ts` explains the gotcha in prose. It must describe the forbidden form WITHOUT writing the literal `process.env[` substring anywhere in the file (comments included) — otherwise the guard's `src/`-wide scan flags its own explainer. Mirror `googleAuthGate.ts`, which says "bracket-indexed by a variable" / "a DYNAMIC computed read" and never writes the bracket literal. (The literal `process.env[` lives only in the **test** files, which the guard does not scan.)
- **Apostrophe-free comments in scanned files.** Any file the doctrine scanner (`uxOneOneTwoDoctrine`) reads must keep comments apostrophe-free with balanced quotes (house `doctrine-scanner-apostrophe-gotcha`: one stray apostrophe poisons the file-wide string parse and flags distant innocent comments). `featureFlags.ts` is a new `src/` file that the doctrine suites' recursive scanners will pick up — write its comments apostrophe-free (use "does not" not "doesn't", "cannot" not "can't").
- **Permission-denied / offline / concurrent edits:** N/A — this is a pure synchronous config read with no I/O, no auth, no network, no persisted state. There is nothing to race and nothing to deny.
- **Doctrine edge case:** a flag being ON must never grant a claim factual standing, alter a strength band, change a validation outcome, or touch the engine. Flags gate **surface availability** only. Nothing in this module reads or writes score/heat/evidence.

---

## Test plan

Two new suites. Test counts go UP, never down. Baseline before this card (from `docs/core/current-status.md`, ASP-EXTRACT-001 Slice 2): **899 suites / 32,797 tests**.

### `__tests__/featureFlags.test.ts` (behavioral — mocks `../src/lib/supabase`)

Mirror `__tests__/googleAuthGate.test.ts`: `jest.mock('../src/lib/supabase', () => ({ readRuntimeEnv: () => mockReadRuntimeEnv() }))` with a `jest.fn` that defaults to `{}`; save/restore each `process.env.EXPO_PUBLIC_<NAME>` around each case (delete in `beforeEach`, restore in `afterEach`).

- **Default OFF, unset:** each of the seven accessors returns `false` when its env var is unset and the shim is empty. (7 assertions, table-driven.)
- **Default OFF matrix (per flag):** `it.each(['', 'false', '1', 'TRUE', 'True', ' true ', 'yes', 'enabled'])` → `false`, for every flag. (Acceptance criterion 3.)
- **Exact `'true'` enables (per flag):** setting `process.env.EXPO_PUBLIC_<NAME> = 'true'` → the accessor returns `true`. Set the env key by its **static literal name** in the test (as `googleAuthGate.test.ts` does in its static-read block) so the exact production key is exercised.
- **Shim override (per flag):** stubbing `readRuntimeEnv()` to return `{ [<FLAG>]: 'true' }` with `process.env` unset → `true`; shim `'true'` wins over `process.env` `'false'`; shim non-string / missing key → falls back to `process.env`. (Acceptance criterion 5.)
- **Flag independence:** setting exactly one flag ON (via env or shim) leaves the other six `false`. Assert the full 7-vector for at least two different single-ON cases — proves no cross-talk / no shared mutable state. (Acceptance criterion — Test plan "independence".)
- **Registry dispatcher:** `resolveAspFeatureFlag('home_v2')` agrees with `isHomeV2Enabled()` for ON and OFF; `ASP_FEATURE_FLAGS` has exactly the seven keys, each with the correct `envName` literal; the registry object is frozen (`Object.isFrozen`).

### `__tests__/featureFlagsStaticEnv.test.ts` (source-scan guard — the web-bundle-safety proof)

Mirror `__tests__/googleAuthGateStaticEnv.test.ts` (the assertion idiom) and the recursive `readTree` walk from `__tests__/adminSemanticConfigSecretScan.test.ts` (the house `src/`-recursion shape: `fs.readdirSync(dir, { withFileTypes: true })`, recurse dirs, collect `.ts`/`.tsx`).

- **Seven static-literal presence assertions:** read `src/lib/featureFlags.ts` and assert it `.toContain('process.env.EXPO_PUBLIC_HOME_V2')` … through all seven names. This is the web-bundle-safety proof (Metro inlining is invisible to jest's runtime — the presence of the static literal is what guarantees inlining). (Acceptance criterion 2.)
- **`src/`-wide dynamic-read ban:** recurse all `.ts`/`.tsx` under `src/` and assert **zero** files match `/process\.env\[/`. Verified zero occurrences today (design confirmed via repo scan), so the ban lands green. Report offenders by relative path if it ever goes red. (Acceptance criterion 4.)
  - Build the ban regex from parts so the **test file itself** does not contain the raw `process.env[` substring that it would then have to exclude — e.g. `const DYNAMIC_ENV = new RegExp('process\\.env' + '\\[');`. (The guard scans `src/` only, and the test lives in `__tests__/`, so a raw literal in the test is harmless to the scan — but keeping the test file free of the raw substring is tidier and avoids any future scan-scope surprise.)
- **Red-on-violation self-test:** assert the ban regex matches a fixture string constructed to contain the dynamic form (built from parts, e.g. `` `const x = process.env` + `[key];` ``), proving the guard actually fires on the defect and is not a vacuous always-green assertion. (Acceptance criterion 4 — the `googleAuthGateStaticEnv` idiom.)
- **Self-source cleanliness:** assert `src/lib/featureFlags.ts` itself does NOT match the dynamic-read regex (belt-and-suspenders: it is inside the `src/`-wide scan already, but an explicit single-file assertion documents intent).

### Zero-visual-diff pins

- **No production import:** a source-scan assertion (in the guard suite) that no file under `src/features/**` or `src/components/**` imports `featureFlags` in this card. (Optional but recommended — makes the "zero consumers this slice" contract test-enforced, so a later merge cannot accidentally wire a consumer under cover of this card.)
- **Full existing suite green with zero snapshot deltas** — the module is unreferenced by any rendered surface, so no snapshot can move. (Acceptance criterion 6.) Verified by `npm run test` exit 0 with count strictly greater than 32,797 and no updated `.snap`.

### Gates (test-discipline)

- `npm run typecheck` exit 0 (strict, no `any`).
- `npm run lint --max-warnings 0` exit 0 (no `console.log`, no `.only`/`.skip`).
- `npm run test` exit 0 — capture the `Test Suites: … / Tests: …` line + exit code (indeterminate on a tool-timeout; re-run with `; echo "EXIT: $?"` if truncated).
- `npm run web:build` exit 0 — a free extra proof that the new module compiles into the bundle (no consumer, so no behavior change; confirms no import/require path error).

---

## Dependencies (cards / docs / files)

- **Reads** `src/lib/supabase.ts` at `readRuntimeEnv()` — imported for the runtime-shim resolution leg (same import the auth gate uses). Does not modify it.
- **Mirrors** `src/features/auth/googleAuthGate.ts` (#746, gate-fix #776) — the proven exemplar for the static-read + shim-fallback + exact-`'true'` pattern. Mirrors `__tests__/googleAuthGateStaticEnv.test.ts` for the guard idiom and `__tests__/adminSemanticConfigSecretScan.test.ts` for the recursive `src/` walk.
- **Blocked by:** nothing. Lands immediately, in parallel with the completed ASP-EXTRACT-001 (#869/#870). A deferred VOICE-ADR-002 does not block this card (registry slots are inert).
- **Blocks:** every flagged ASP surface card — HOME-001 (`home_v2`), ROOM-001/002/003 (`room_exchange_v2`), PROOF-001/002/003 (`proof_drawer`), the voice/timestamp/playback cards (`voice_entries`, `timestamp_rebuttals`, `one_time_playback`, still hard-gated on VOICE-ADR-002 / ASP-ADR-001 #863), and MARKS (`move_marks`). Each consumes an accessor from this registry.

---

## Risks

- **The #776 defect is invisible to jest.** The single most important risk: an implementer "simplifies" the seven static reads into a loop over the registry that indexes `process.env` by `descriptor.envName`. That passes jest, typecheck, and lint — and silently forces every flag OFF on Netlify. **Mitigation:** the seven-static-literal presence assertions + the `src/`-wide `process.env[` ban are mandatory and non-negotiable; the red-on-violation self-test proves the ban fires. Do not refactor the seven dot reads into one dynamic read, ever.
- **Self-tripping the ban in the module doc comment.** If `featureFlags.ts` writes the literal `process.env[` in a comment while explaining the gotcha, the `src/`-wide scan flags its own file. **Mitigation:** describe the forbidden form in prose only ("dynamic bracket-indexed read", "computed key"), exactly as `googleAuthGate.ts` does; keep the literal confined to test files.
- **Doctrine scanner apostrophe gotcha.** `featureFlags.ts` is a new `src/` file the recursive doctrine scanners will read. A single apostrophe in any comment can poison the file-wide string parse and flag distant innocent comments (house memory). **Mitigation:** apostrophe-free comments, balanced quotes; run the doctrine suites (`uxOneOneTwoDoctrine`) pre-push.
- **`readRuntimeEnv()` type does not surface the ASP flags.** `CDiscourseRuntimeEnv` declares only three slots, so in production the shim never carries an ASP flag and the static `process.env` read is authoritative. This is correct and matches `googleAuthGate.ts`. **Do not** extend `CDiscourseRuntimeEnv` in this card (out of scope; the `Record` cast already lets tests stub the shim). Flagging it here so a reviewer does not mistake the cast for a bug.
- **New-file source-scan blast radius.** Several existing suites recursively `readFileSync` all of `src/` (secret scans, doctrine scans, viewport-matrix scans, read-only-boundary pins). Adding `src/lib/featureFlags.ts` puts a new file in their path. **Mitigation:** the module contains no secrets, no `process.env[`, no verdict tokens, no provider calls, no `console.*`, no snake_case user-facing strings — it should pass every existing recursive scan unchanged. The implementer must run the FULL suite (not just the two new files) and confirm no previously-green recursive scan goes red on the new file. If a read-only-boundary pin (e.g. `uxOneOneSixReadOnlyBoundary`) counts files under `src/lib`, it may need a one-line allow-list bump — surface it, do not silently relax an unrelated boundary.
- **`.env.example` is not a scanned string source but is a committed config.** Adding names-only lines is safe (no values, no secrets). Confirm no secret-scan test asserts an exact `.env.example` line count (none found in the survey, but the implementer should re-confirm).

---

## Out of scope

Explicitly NOT in this card (prevents scope creep):

- **No consumer wiring.** No screen, component, lane, or model reads any flag in this slice. HOME-001 / ROOM-001-003 / PROOF-001-003 / the voice cards / MARKS each wire their own flag.
- **No flag flipping.** No Netlify / env value change; merging changes zero live surfaces. Every flag stays OFF.
- **No remote / dynamic flag service.** No per-user targeting, no A/B, no persistence, no network fetch, no LaunchDarkly-style provider.
- **No voice implementation.** `voice_entries` / `one_time_playback` / `timestamp_rebuttals` get registry slots ONLY. Building or flipping anything behind them stays hard-gated on VOICE-ADR-002 ratification (ASP-ADR-001, #863). This card does not authorize audio capture, storage, playback, or any S3/transcription work.
- **No `CDiscourseRuntimeEnv` type extension** (the shim keeps its three typed slots; the `Record` cast covers the shim-read path).
- **No `SUPABASE_CONFIGURED` coupling.** Deliberately unlike the auth gate — see "API / interface contracts".
- **No new dependency.** Pure TS + the existing `readRuntimeEnv` import. No `npm install` / `npx expo install`.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the module emits no user-facing copy and no score. Flag ids (`home_v2` etc.) and env names contain zero verdict vocabulary (no winner/loser/true/false/liar/etc.). A flag being ON never labels a claim, never alters a strength band, never blocks or unblocks posting. RESPECTED.
- **cdiscourse-doctrine §5 (rules engine is sacred):** the module never imports, calls, or influences `src/domain/constitution/engine.ts`; flags gate UI surface availability only, never a transition or validation outcome. The engine stays pure. RESPECTED.
- **cdiscourse-doctrine §6 / §7 (secrets; no client AI):** the seven values are PUBLIC runtime toggles — the `EXPO_PUBLIC_` prefix IS the public-config contract; no key material, no service-role, no `ANTHROPIC_API_KEY`/`SERVICE_ROLE` anywhere; no AI/xAI/X/network call; pure synchronous TS. `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" src/` stays zero. RESPECTED.
- **cdiscourse-doctrine §3 (popularity is not evidence):** no flag reads or writes engagement / heat / factual-standing; the anti-amplification gate is untouched. RESPECTED (n/a but affirmed).
- **cdiscourse-doctrine §4 (AI moderator limits):** no AI surface, no flag field, no authoritative output. RESPECTED (n/a but affirmed).
- **cdiscourse-doctrine §9 (plain language):** no internal validation code enters any user-facing string (the module renders nothing). RESPECTED (n/a but affirmed).
- **cdiscourse-doctrine §10 (v1 scope guards):** no voting/winner system, no OAuth, no push, no search, no public API introduced. Flags are inert config. RESPECTED.
- **Private-by-default (pivot doctrine):** all seven flags default OFF; merging exposes nothing new to any user. RESPECTED.
- **Voice gate (VOICE-ADR-001 / ASP-ADR-001 #863):** the three voice-adjacent registry slots do NOT authorize audio persistence, capture, or playback; ASP-ADR-001 remains the sole gate. RESPECTED.
- **expo-rn-patterns (no new dep; RN-first):** no dependency added; pure TS; no RN primitive needed (non-visual). RESPECTED.
- **test-discipline (tests are the deliverable):** two new suites ship WITH the module (behavioral + source-scan guard); count goes up; both gates + web:build required green before "done". RESPECTED.

---

## Operator steps (if any)

**None to merge — pure code change.** Merging this card changes zero live surfaces (every flag defaults OFF; no consumer reads them).

Deferred to the downstream surface cards (documented here for completeness, NOT run by Claude and NOT part of this card): when a surface card is ready to go live, the operator sets the corresponding `EXPO_PUBLIC_<NAME>=true` in the Netlify (or Cloud Run) deployment environment and **rebuilds + republishes** the web bundle — because Netlify bakes `EXPO_PUBLIC_*` at build time (house memory `expo-web-static-env-inlining`), an env edit alone on a running instance does not take effect. Rollback = unset the var (or set it to anything other than `'true'`) and rebuild/republish.
