# OPS-DEPS-003 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-05
**Branch:** feat/ops-deps-003-rimraf (HEAD `357c3df`; design `8764093`; base `origin/main` `20264cc`)
**Design:** docs/designs/OPS-DEPS-003.md
**Issue:** #435

## Summary

Dependency-hygiene card, build/dev-time only — no product, runtime, or doctrine
surface. It clears the `rimraf@3.0.2 — versions prior to v4 are no longer
supported` deprecation line (2026-06-02 Netlify deploy log) by adding a single
npm `overrides` entry `"rimraf": "^4.4.1"` as a sibling of the existing `xcode`
override. The implementation matches the design exactly: package.json carries
only the +1 override line (no RN/Expo bump, no other dependency change), and
package-lock.json regenerates the rimraf subtree (3.0.2 → 4.4.1, `deprecated`
field removed, glob@7 → glob@9.3.5 + minipass/minimatch@8/path-scurry/lru-cache),
all confined to `node_modules/rimraf/`. The load-bearing decision (v4, NOT the
issue's literal `^5`) is empirically verified at the install: `require('rimraf')`
returns a callable function under 4.4.1, so `chromium-edge-launcher@0.2.0`'s
`this.rimraf(path, cb)` call does not `TypeError`. The full gate suite is green
and unchanged at 646 suites / 19541 total. The one residual — a benign
`glob@9.3.5` deprecation echo — is documented and accepted in the design (chasing
it via rimraf 6/glob 11 would reintroduce the v5/v6 TypeError, a strictly worse
trade). No concerns remain.

## Verification

| Gate | Result |
|---|---|
| typecheck | pass (exit 0) |
| lint (`eslint . --max-warnings 0`) | pass (exit 0) |
| test (full suite) | pass (exit 0) — **646 suites / 19540 passed + 1 skipped = 19541 total** (unchanged from baseline; the 1 skip is pre-existing) |
| `npm ci` | pass (exit 0) — **`rimraf@3.0.2 … no longer supported` line GONE**; benign `glob@9.3.5` deprecation line remains (documented/accepted) |
| installed rimraf | 4.4.1 confirmed (`node_modules/rimraf/package.json`) |
| `require('rimraf')` callable | **YES** — `typeof === 'function'` (v4 CJS shim preserved; v5/v6 would have been non-callable) |
| Prettier on touched files | `package.json` clean (exit 0); `package-lock.json` not flagged (repo-wide `format:check` fails on 1196 PRE-EXISTING unrelated files — supabase functions, tsconfig.json — none touched by this card; lint is the enforced gate and is green) |
| secret scan | clean (only doc prose describing the *absence* of secrets; no key/JWT/bearer material) |
| doctrine scan | clean (no truth/winner/loser tokens; zero src/app/supabase files changed) |
| migration apply | N/A — no files under `supabase/migrations/**` (migration-bearing section not triggered) |

## Design conformance

- [x] All design file-changes are present — package.json (+1 override line), package-lock.json (regenerated subtree), docs/designs/OPS-DEPS-003.md (new), docs/core/current-status.md (additive ledger entry).
- [x] No undocumented file-changes — exactly 4 files changed; zero under src/, app/, supabase/.
- [x] Data model matches design — none (no schema/types/SQL).
- [x] API contracts match design — none touched; the implicit `chromium-edge-launcher@0.2.0` ↔ rimraf callable-default contract is preserved (verified callable at install).
- [x] Pin is `^4.4.1` (NOT `^5`/`^6`) as the design's load-bearing analysis requires.
- [x] `chromium-edge-launcher@0.2.0` still declares `"rimraf": "^3.0.2"` (lock :4867) — the top-level override redirects resolution without rewriting the declared range (correct npm behavior).
- [x] Lockfile delta exactly as predicted: rimraf 3.0.2→4.4.1, `deprecated` field removed, bin path → `dist/cjs/src/bin.js`, glob@9.3.5 subtree, all nested under `node_modules/rimraf/`.

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings — no user-facing strings touched (vacuous).
- [x] Score never blocks posting — no scoring surface touched.
- [x] No service-role in client code — zero src/app changes; the only `SERVICE_ROLE` token in the diff is doc prose asserting its absence.
- [x] No direct insert into public.arguments — none; the `public.arguments` token in the diff is a pre-existing current-status.md ledger entry from a prior card.
- [x] No AI calls in production app paths — no provider call added; rimraf is a filesystem util used only by a dev tool.
- [x] Plain language only (no raw internal codes in UI strings) — no UI strings.
- [x] Rules engine stays pure — `src/lib/constitution/engine.ts` untouched.
- [x] v1 scope guards — adds no voting/search/push/OAuth/public-API.
- [x] **Epic-specific (expo-rn-patterns dependency policy):** an npm `overrides` redirect of an existing transitive dep is the correct minimum-blast-radius tool — NOT a speculative new dep, NOT an RN/Expo SDK bump outside the SDK 54 supported range. The RN-bump path is correctly rejected (chromium-edge-launcher is abandoned + hard-pins rimraf ^3.0.2, so no RN version escapes rimraf@3; any RN bump would also leave SDK 54's `npx expo install` range). Constraint respected and central to the design.

## Test coverage

- [x] No new public functions added → no new unit tests required (test-discipline: "tests are part of done" satisfied by the unchanged green gate + the lockfile/install assertion that rimraf@3 and its `deprecated` string are gone and rimraf is now 4.4.1, verified above).
- [x] No user-facing strings → no ban-list assertion needed.
- [x] Design § "Edge cases" — the rimraf-callable edge case (the load-bearing one) is verified live at install (`require('rimraf')` callable).
- [x] No UI card → no accessibility assertions needed.
- [x] Test count does not drop — 19541 total held exactly; no test references `rimraf`.

## Blockers

None.

## Suggestions (non-blocking)

1. The residual `glob@9.3.5` deprecation echo is correctly documented as benign
   in the design (Risks §) and the current-status ledger. No action needed; flagged
   only so a future reader of the deploy log knows it is expected, not a regression.
2. When a future Expo SDK upgrade card lands, re-validate (and likely remove) this
   override if the upstream chain finally drops `chromium-edge-launcher`/rimraf@3.
   The design and ledger already note this; no action now.

## Operator next steps

- Push the branch: `git push -u origin feat/ops-deps-003-rimraf`
- Open PR: `gh pr create --title "OPS-DEPS-003: override rimraf to ^4.4.1 (clear unsupported v3)" --body-file docs/reviews/OPS-DEPS-003.md`
- Deploy steps (from design): **None** — pure dependency-metadata change; no `supabase db push`, no `functions deploy`, no migration, no env var/secret.
- **Operator follow-up (NON-blocking):** `npm run web` (`expo start --web`) dev-server
  smoke — interactive, not headless-CI-friendly. Confirm Metro + the
  dev-middleware/inspector boot with no rimraf/dev-middleware error in the console,
  then Ctrl-C. This is the one live exercise of `chromium-edge-launcher.destroyTmp()`.
  Note the residual v4 behavioral risk on that path (the callback is ignored, so the
  cleanup Promise would not resolve *if* Edge were ever spawned) is confined to an
  effectively-unreached path — chrome-launcher is the dev default; v4's hung-Promise
  is strictly safer than v5/v6's hard `TypeError` on the same path. Not a blocker.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)").
- Rollback (if ever needed): revert the single `overrides` hunk in package.json + `npm install` to restore rimraf 3.0.2.
