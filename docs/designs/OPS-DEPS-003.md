# OPS-DEPS-003 — Bump rimraf off the unsupported v3 (react-native dev-middleware chain)

**Status:** Design draft
**Epic:** Ops / Dependency hygiene (no UI epic)
**Release:** Maintenance (no stage gate; build/dev-time dependency only)
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/435

> Replace `<owner>` with the repo owner when filing — the issue is #435 ("OPS-DEPS-003: Bump rimraf off v3 (react-native dev-middleware chain) via RN upgrade or npm overrides").

---

## Goal (one paragraph)

The 2026-06-02 Netlify production deploy log surfaced a deprecation warning: `rimraf@3.0.2 — "versions prior to v4 are no longer supported."` This `rimraf@3` is a **transitive, build/dev-time-only** dependency — it is NOT in the production runtime (not in any Edge Function, not in the Deno MCP server, not in the web/RN JS bundle). It exists only to satisfy a temp-directory cleanup helper inside an abandoned dev tool. We want to clear the deprecated package from the dependency tree without destabilising the toolchain. No CDiscourse product doctrine is in play (this touches no truth/heat/scoring/AI surface and no secrets); the binding constraint is the **expo-rn-patterns dependency policy**: an RN bump must stay within the Expo SDK-supported range, and we prefer the narrowest, least-speculative change. This card is **design-only** — no package install, no lockfile change, no provider call, no push/PR/merge.

## Exact rimraf@3 provenance (verified against `package-lock.json` in this worktree)

A single `rimraf@3.0.2` node exists in the tree with exactly one declared dependent:

```
rimraf@3.0.2                          (package-lock.json:12035, deprecated string present at :12039)
  └─ chromium-edge-launcher@0.2.0     (depends "rimraf": "^3.0.2", :4867)
       └─ @react-native/dev-middleware@0.81.5   (depends "chromium-edge-launcher": "^0.2.0", :3042)
            ├─ @react-native/community-cli-plugin@0.81.5   (depends dev-middleware 0.81.5, :3000)
            └─ react-native@0.81.5                          (depends dev-middleware 0.81.5, :6483)
```

- There is **exactly one** `rimraf` in the lockfile (top-level `node_modules/rimraf`, version 3.0.2). No other package depends on rimraf.
- `chromium-edge-launcher` is **abandoned at 0.2.0** (last published 2022). It has **no newer version** and hard-pins `rimraf: ^3.0.2`.
- `@react-native/dev-middleware@0.81.5` pins `chromium-edge-launcher: ^0.2.0`, which can only resolve to `0.2.0`.

This package is dev/build-time only: `@react-native/dev-middleware` is the Metro inspector-proxy middleware used by `expo start` / `expo start --web`. It is not bundled into the app, not shipped to Edge Functions, and not present in the Deno MCP server.

## Environment facts (verified)

- **Expo SDK:** `expo: ~54.0.33` (SDK 54).
- **React Native:** `react-native: 0.81.5` — this is the exact RN version Expo SDK 54 pins (the version `npx expo install react-native` resolves to for this SDK).
- **React / React DOM:** `19.1.0`.
- An `overrides` block already exists in `package.json` (lines 108–112):
  ```json
  "overrides": {
    "xcode": {
      "uuid": "^11.0.0"
    }
  },
  ```
  So the `overrides` mechanism is already established and proven in this repo's `npm` (not Yarn) toolchain.

---

## Chosen approach — `overrides` (path ii), pin to `rimraf@^4.4.1`

**Path (i) — react-native bump — is NOT cleanly available and is rejected. Two independent reasons:**

1. **The chain is unbreakable by an RN bump.** The deprecated rimraf is pulled by `chromium-edge-launcher@0.2.0`, which is abandoned at 0.2.0 and hard-pins `rimraf: ^3.0.2`. Every `@react-native/dev-middleware` release (across the 0.81.x line and beyond) still depends on `chromium-edge-launcher: ^0.2.0`, which can only ever resolve to `0.2.0` → `rimraf@^3`. No `react-native` version — within or beyond the Expo SDK range — escapes `rimraf@3` through `chromium-edge-launcher`.
2. **Any RN bump leaves the Expo SDK 54 supported range.** `react-native@0.81.5` is exactly what Expo SDK 54 pins. Bumping RN to a different version would drift off `npx expo install react-native` semantics for SDK 54, violating the expo-rn-patterns rule "an RN bump must stay within the Expo SDK-supported range." That is out of scope for a dependency-hygiene card and would itself require an Expo SDK upgrade card.

**Therefore the fix is an `npm` `overrides` entry.** The non-obvious part is *which rimraf major* — and the answer is **NOT** the issue's literal suggestion of `^5`. See "Why `^4.4.1`, not `^5`/`^6`" below; the export-shape difference between rimraf v4 and v5+ is load-bearing.

### EXACT `package.json` change

Add a single top-level `"rimraf"` key inside the existing `overrides` object, as a sibling of `"xcode"`.

Before (lines 108–112):

```json
  "overrides": {
    "xcode": {
      "uuid": "^11.0.0"
    }
  },
```

After:

```json
  "overrides": {
    "xcode": {
      "uuid": "^11.0.0"
    },
    "rimraf": "^4.4.1"
  },
```

- 2-space indentation, matching the file's existing style (the file is Prettier-formatted; `npm run format:check` must stay green after the edit).
- A **top-level** override key (`"rimraf": "^4.4.1"`) forces every resolution of `rimraf` in the tree to the v4 line. There is only one `rimraf` consumer (chromium-edge-launcher), so a top-level override is unambiguous and has no collateral targets.
- Do **not** nest it under `chromium-edge-launcher`. A top-level key is simpler, and there is no risk of over-broadening because nothing else depends on rimraf.
- `^4.4.1` pins the **latest v4** (final 4.x release). `4.4.1` is the deliberate floor; `^4` allows future 4.x patches but will not jump to v5 (which is API-incompatible — see below).

### Expected lockfile delta (`package-lock.json` — implementer regenerates via `npm install`, NOT in this card)

- `node_modules/rimraf` version `3.0.2` → a `4.4.x` (latest v4; `4.4.1` at time of writing). Its `deprecated: "Rimraf versions prior to v4 are no longer supported"` field disappears.
- The nested `node_modules/rimraf/node_modules/{glob@7.2.3, minimatch@3.x, brace-expansion, balanced-match}` subtree (the rimraf-3 → glob-7 chain) is removed.
- rimraf 4.4.x depends on `glob: ^9.2.0`, so a `glob@9.x` (e.g. `9.3.5`) subtree appears in rimraf's nested deps, pulling `minipass@^4`, `minimatch@^8`, `path-scurry@^1`, `fs.realpath`. (See the honest caveat about glob@9's own deprecation string under "Risks".)
- An `overrides`-induced `package-lock.json` may add an `"overrides"`-related `node_modules/rimraf` resolution note; npm 9/10 records overridden resolutions inline. No `dependencies`/`devDependencies` block in `package.json` changes — only the `overrides` object.
- No change to any `dependencies` or `devDependencies` entry. The only `package.json` hunk is the 1-line addition inside `overrides`.

---

## Why `^4.4.1`, not `^5`/`^6` (the load-bearing decision)

The issue suggests `"rimraf": "^5"`. **Verified against the actual compiled sources, `^5` and `^6` would break `chromium-edge-launcher` at runtime.** The discriminator is how `chromium-edge-launcher@0.2.0` calls rimraf vs. how each rimraf major ships its CommonJS export.

**How chromium-edge-launcher uses rimraf** (verified from `chromium-edge-launcher@0.2.0/dist/edge-launcher.js`):

```js
const rimraf = require("rimraf");
// ...in constructor:
this.rimraf = moduleOverrides.rimraf || rimraf;
// ...in destroyTmp():
this.rimraf(this.userDataDir, () => resolve());
```

It does two things rimraf v4+ changed: (a) it `require()`s rimraf and calls the **bare module** as a function, and (b) it passes a **callback** as the second argument.

**rimraf API history (verified from the rimraf CHANGELOG and the compiled CJS entries):**

| rimraf major | `require('rimraf')` is callable? | Callback as 2nd arg? | glob dep | Node engine |
|---|---|---|---|---|
| **3.x** (current) | Yes | Yes (callback-style) | glob@7 | any |
| **4.x** | **Yes** — CJS entry does `module.exports = Object.assign(index.default, {...})` | No (Promise-only); callback is silently treated as options and ignored | glob@^9 | ≥14 |
| **5.x** | **No** — only `exports.rimraf = ...`, no `module.exports =` reassignment | No | glob@^10 | ≥14 |
| **6.x** | **No** — compiled CJS is `exports.rimraf = Object.assign(...)`, **no** `module.exports = exports.rimraf` | No | glob@^11 | 20 \|\| ≥22 |

Verification quotes:
- **rimraf 4.4.1** `dist/cjs/src/index-cjs.js` ends with `module.exports = Object.assign(index_js_1.default, { default: index_js_1.default });` → **`require('rimraf')` returns a callable function.** v4 ships a dedicated `index-cjs.js` specifically to keep the CJS default callable.
- **rimraf 6.0.1** `dist/commonjs/index.js` ends with `exports.rimraf = Object.assign(rimraf_, {...})` and `exports.rimraf.rimraf = exports.rimraf` — there is **no** `module.exports = exports.rimraf`. So `require('rimraf')` returns the namespace object, and `this.rimraf(path, cb)` would throw **`TypeError: this.rimraf is not a function`**. v5 behaves the same way ("No default export, only named exports" per the v5 changelog).

**Conclusion:**
- **`^5` / `^6`:** would make `this.rimraf` a non-callable object → **`TypeError` if `destroyTmp()` ever runs.** Rejected. (The issue's literal `^5` suggestion is the worst of the candidates.)
- **`^4.4.1`:** `this.rimraf` stays callable → **no `TypeError`.** The callback `() => resolve()` is passed where v4 expects an options object, so it is ignored; v4 returns a Promise that nothing awaits. The net effect is that `destroyTmp()`'s wrapper Promise would **not resolve** (it only resolves via the now-ignored callback). This is the residual behavioral risk — and it is confined to a code path that is effectively never reached (see next).

**Why the residual v4 risk is acceptable (the cleanup path is effectively dead in this app):**
`destroyTmp()` only does real work when `userDataDir` was auto-generated, which only happens inside `prepare()`, which only runs **when `chromium-edge-launcher` actually spawns Microsoft Edge.** In the Expo/RN dev flow, the inspector proxy uses `chrome-launcher` by default; `chromium-edge-launcher` is a fallback that this repo's dev workflow does not invoke. With no spawned Edge, `destroyTmp()` hits its early return (`if (this.userDataDir === undefined ...) return resolve()`) and the rimraf call is never reached. So the v4 "hung Promise" risk sits on a path the toolchain does not exercise, while the v5/v6 `TypeError` risk would be a hard crash *if* that path were ever exercised. v4 is strictly the safer choice for this consumer.

(If a future card wants to move to rimraf 6 for the newest glob, it must FIRST also override `chromium-edge-launcher` to a patched fork or add a `moduleOverrides.rimraf` shim — out of scope here.)

---

## Data model

No new data model. No TypeScript types, no SQL, no schema. This is a `package.json` `overrides` change only.

## File changes

- modified: `package.json` — add one key `"rimraf": "^4.4.1"` inside the existing `overrides` object (sibling of `xcode`). **1 line added**, 0 removed (plus the trailing comma added to the preceding `}` of the `xcode` block). No other section changes.
- regenerated (by `npm install`, performed by the implementer, NOT in this design card): `package-lock.json` — rimraf 3.0.2 subtree replaced by rimraf 4.4.x subtree as described in "Expected lockfile delta." Lockfile delta is mechanical; the implementer commits it alongside the `package.json` change.
- new (this card only): `docs/designs/OPS-DEPS-003.md` — this design doc.

No files under `src/`, `app/`, or `supabase/` change. No new test files are required (see Test plan — the verification is the existing gate suite plus a lockfile assertion).

## API / interface contracts

None. No function signatures, props, Edge Function shapes, or RLS policies are touched. The only "contract" is the implicit one between `chromium-edge-launcher@0.2.0` and `rimraf`, which the chosen `^4.4.1` pin preserves at the level that matters (a callable default export), as analysed above.

## Edge cases

- **`destroyTmp()` actually invoked (Edge spawned during dev):** with rimraf 4, the cleanup Promise would not resolve (callback ignored). Effect is limited to a leftover temp dir + a non-resolving internal Promise on a dev-only, effectively-unreached path. No production impact, no data impact. Documented, accepted.
- **`npm` vs other package managers:** `overrides` is the npm field (npm 8.3+). This repo uses npm (`package-lock.json` present, existing `overrides` block works). If a contributor uses Yarn/pnpm the field name differs (`resolutions` / `pnpm.overrides`) — out of scope; the repo's canonical tool is npm.
- **Node engine:** rimraf 4 requires Node ≥14. The chain already requires Node ≥20.19.4 (`@react-native/dev-middleware` engines), so the v4 floor is comfortably satisfied. (This is also why we did NOT need rimraf 6's Node-20 floor to be a blocker — but it's another reason to prefer v4's lower, safer floor.)
- **Override too broad:** not a concern — only one package depends on rimraf, so a top-level override cannot collide with another consumer.
- **Doctrine constraint edge case:** none — this card touches no user-facing string, no score, no heat, no AI, no secret. The doctrine ban-list and plain-language map are not in scope (no new codes, no rendered strings).

## Test plan

No new product code → no new product unit tests. The verification is the existing gate suite plus an explicit lockfile assertion. Implementer runs, in order:

1. `npm install` — regenerate `package-lock.json` with the override applied. (This is the only mutation; it is the implementer's job, not the designer's.)
2. `npm ci` — confirm a **clean, lockfile-faithful** install and inspect the install output: the `rimraf@3.0.2 ... no longer supported` deprecation line MUST be gone. (Acceptance criterion #1.)
3. **Lockfile assertion (manual or scripted):** confirm `package-lock.json` no longer contains `"version": "3.0.2"` under `node_modules/rimraf` and no longer contains the `"deprecated": "Rimraf versions prior to v4 are no longer supported"` string. Confirm the new `node_modules/rimraf` is a `4.4.x`.
4. `npm run typecheck` — exit 0 (no type surface changed; this is a regression guard).
5. `npm run lint` — exit 0.
6. `npm run test` — exit 0; **test count must not drop** from the Stage 6.4 baseline (1805 tests / 70 suites). No new tests are expected; the count should be unchanged.
7. `npm run format:check` — confirm the `package.json` edit is Prettier-clean.
8. **Dev-server smoke — `npm run web`** (`expo start --web`): confirm Metro starts, the dev-middleware/inspector boots without error, and the web bundle serves. **OPERATOR-GATED:** this is an interactive dev server that does not exit on its own and may not run headless in CI — the operator (or implementer at a workstation) confirms it manually. The smoke is "Metro starts + page loads + no rimraf/dev-middleware error in the console," then Ctrl-C. If the implementer environment cannot launch a browser, downgrade to "`npm run web` boots Metro and prints the dev-server URL without throwing," and flag the full browser smoke for operator confirmation.

> Note on coverage philosophy (test-discipline): this card writes no production code, so "tests are part of done" is satisfied by (a) the unchanged green suite and (b) the lockfile assertion proving the deprecated package is gone. There is no pure-model or UI surface to unit-test.

## Dependencies (cards / docs / files)

- Reads existing `package.json` `overrides` block (the `xcode` → `uuid` precedent at lines 108–112) — confirms the mechanism and house formatting.
- Reads `package-lock.json` to establish the exact rimraf provenance (verified above).
- Does **not** depend on any other roadmap card.
- Does **not** block any card. (It does, however, *clear the way* for a clean Netlify deploy log; OPS-DEPS sibling cards that target other deprecation lines from the same 2026-06-02 log are independent.)
- **Out-of-band dependency:** a future Expo SDK upgrade card would re-pin `react-native` and could change the dev-middleware/chromium-edge-launcher chain. When that lands, this override should be re-validated and removed if the upstream chain finally drops `chromium-edge-launcher`/rimraf@3. (Add a TODO comment is NOT possible in JSON; instead, note this in the PR body and in `docs/core/current-status.md`.)

## Risks

- **(Primary risk to verify at implementation) rimraf v4 callback-vs-Promise behavior in `chromium-edge-launcher.destroyTmp()`.** v4 ignores the callback; the cleanup Promise would not resolve **if** Edge is ever spawned during dev. Mitigation: the path is effectively unreached (chrome-launcher is the default). The implementer's `npm run web` smoke is the live check — if Metro/inspector boots cleanly, the path is confirmed cold. This is the single biggest thing to watch.
- **Residual glob deprecation echo (honesty caveat — affects acceptance criterion wording).** rimraf 4.4.x depends on `glob@^9`, and the maintainer (isaacs) has stamped a blanket `deprecated` string on **every** glob major below the current one — verified: glob@9.3.5, glob@10.4.5, AND glob@11.0.3 all carry the same "Old versions of glob are not supported…" deprecation field in the npm registry. Therefore **no rimraf major fully eliminates a glob-line deprecation notice**, and chasing "zero warnings" by jumping to rimraf 6 (glob 11) would (a) still warn on glob 11 and (b) reintroduce the v5/v6 `TypeError` risk — a strictly worse trade. The acceptance criterion that matters and is achievable is: **the specific `rimraf@3.0.2 … no longer supported` line from the deploy log is gone.** The PR should state plainly that a glob@9 deprecation line may remain and that it is benign (build/dev-time, unreached cleanup path) and not worth trading runtime safety to chase. If the operator insists on a fully warning-free `npm ci`, that is a separate, larger effort (forking/patching `chromium-edge-launcher`), explicitly out of scope here.
- **RN/Expo compatibility:** none expected — we are not bumping RN or Expo. The override only redirects a leaf dev dependency. Regression guard is the full typecheck/lint/test/web-smoke gate.
- **Lockfile churn / `npm ci` strictness:** because acceptance runs `npm ci` (which fails if `package.json` and `package-lock.json` disagree), the implementer MUST commit the regenerated `package-lock.json` together with the `package.json` edit. A `package.json`-only commit would make `npm ci` fail.
- **Existing tests that might need updating:** none anticipated. If any test snapshots the dependency tree or lockfile (none known in this repo), it would need a refresh — implementer should grep for any test referencing `rimraf` (expected: zero).

## Out of scope

- Bumping `react-native` or upgrading the Expo SDK (would leave SDK 54's supported range; separate card).
- Eliminating the glob-line deprecation echo (would require patching/forking the abandoned `chromium-edge-launcher`).
- Overriding rimraf to v5 or v6 (API-incompatible with `chromium-edge-launcher`'s callable-`require` + callback usage; would risk a `TypeError`).
- Any change to production runtime dependencies, Edge Functions, the Deno MCP server, or the shipped JS bundle (rimraf is not in any of these).
- Other deprecation lines from the 2026-06-02 Netlify deploy log (each is its own OPS-DEPS card).
- Adding a new test framework, CI job, or `npm ci` deprecation-lint gate (could be a nice follow-up, but is not required to close #435).

## Doctrine self-check

- **cdiscourse-doctrine — no truth labels:** N/A — no user-facing strings, scores, or labels are touched. Respected vacuously.
- **cdiscourse-doctrine — score never blocks posting:** N/A — no scoring surface touched.
- **cdiscourse-doctrine — no service-role / secrets in client or git:** Respected — this change adds no env var, no key, no secret; it edits `package.json` `overrides` only. `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` is unaffected (no new matches).
- **cdiscourse-doctrine — no AI calls from the production app:** Respected — no provider call is added; rimraf is a filesystem util used only by a dev tool.
- **cdiscourse-doctrine — rules engine stays pure:** Respected — `src/lib/constitution/engine.ts` is untouched.
- **cdiscourse-doctrine — v1 scope guards:** Respected — adds no voting/search/push/OAuth/public-API.
- **expo-rn-patterns — dependency policy:** Respected and central. We did NOT add a speculative dep; we redirected an existing transitive one. We did NOT bump RN outside the Expo SDK 54 supported range (we chose the `overrides` path precisely *because* the RN-bump path would either fail to fix the issue or leave the SDK range). The override is the minimum-blast-radius change.
- **expo-rn-patterns — prefer RN primitives / no banned web libs:** N/A — no UI dependency added.
- **test-discipline — tests are part of done:** Respected — no production code is added, so "done" = the unchanged green gate suite + an explicit lockfile assertion proving rimraf@3 is gone. Test count must not drop from 1805/70.

## Operator steps (if any)

This is a pure dependency-metadata change — **no Supabase deploy, no migration, no env var.** Specifically: **None — no `supabase db push`, no `functions deploy`, no secret.**

The two operator/implementer-workstation actions that are NOT pure-CI:

1. **`npm install`** to regenerate the lockfile (the implementer performs this; it is the card's one mutation). Then commit `package.json` + `package-lock.json` together.
2. **`npm run web` dev-server smoke** — operator-gated/manual confirmation if it cannot run headless in CI (see Test plan step 8). The operator confirms Metro + inspector boot cleanly and the page loads, then Ctrl-C.

**Rollback:** revert the single `overrides` hunk in `package.json` and run `npm install` to restore `package-lock.json` (rimraf returns to 3.0.2). Because the change is one key in `overrides` plus the mechanical lockfile delta, `git revert <commit>` followed by `npm install` is a complete, low-risk rollback. No data, no schema, no deployed artifact is involved.
