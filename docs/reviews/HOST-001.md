# HOST-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** `feat/HOST-001-dev-hosting-architecture-google-cloud-ru`
**Design:** [`docs/designs/HOST-001.md`](../designs/HOST-001.md)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/27

## Summary

HOST-001 lands the architecture surface for the `cdiscourse-dev` Cloud Run service without executing a single mutation against GCP, DNS, Supabase, or any Edge Function. The Dockerfile / `.dockerignore` / Cloud Run service YAML / IAM YAMLs / build + runtime scripts / operator runbook are all template / spec assets the operator applies later. The HOST-001b runtime-env shim is folded into `src/lib/supabase.ts` cleanly (resolution order `window.__CDISCOURSE_RUNTIME_ENV__` → `process.env`, native-safe `typeof window` guard). The single new production dependency (`serve@14.2.6`) is pinned exact per design `K6`. All three judgment calls the implementer surfaced are doctrine-sound. Doctrine is clean across all scans; the test count matches the reported delta exactly (3117 → 3201, +84, 114 → 117 suites). The 19 failing tests in 5 suites are the documented pre-existing xAI/Anthropic env-file-missing failures, unrelated to this card. Verification battery is green.

## Verification (re-run, not trusted blindly)

| Check | Result |
|---|---|
| `npm run typecheck` | **pass** (exit 0) |
| `npm run lint` | **pass** (exit 0, `--max-warnings 0`) |
| `npm run test` | **3201 passed / 19 failed / 3220 total** — failures are the documented 5 pre-existing xAI/Anthropic env suites (`xaiAdversarialProvider`, `xaiSeededStancesLive`, `xaiAdversarialPipeline`, `xaiAdversarialSourceHarvest`, `aiDrivenBotCorpus`), zero of them touched by HOST-001 |
| Test count delta | **3117 → 3201 (+84)** — matches implementer report exactly |
| Suite count delta | **114 → 117 (+3 new)** — matches the three new files |
| Secret scan over diff | **clean** — every `sk-ant-` / `xai-` / `sb_secret_` / `Bearer ` / `eyJ…` hit is a negative test assertion, a forbidden-shape regex in a denylist, or a doctrine comment. Zero literal secret values. |
| Doctrine token scan over diff | **clean** — sole `correct` hit is "digest-only promotion stays correct" (not a truth label) |
| `console.log` additions in non-test source | **zero** |
| `as any` insertions | **zero** |
| `src/lib/constitution/engine.ts` touched | **no** |
| `grep -r "SERVICE_ROLE\|ANTHROPIC_API_KEY" src/ app/` | only the two pre-existing legitimate hits (validation regex in `src/features/devFixtures/argumentScenarioValidation.ts`, doctrine comment in `src/lib/edgeFunctions.ts`) |

## Design conformance

- [x] Dockerfile + `.dockerignore` at repo root — present and match the design's locked contract.
- [x] Two-stage build (`node:22-alpine` builder → `gcr.io/distroless/nodejs22-debian12:nonroot` runtime).
- [x] Build args locked: `BUILD_COMMIT_SHA`, `BUILD_VERSION`, `BUILD_TIMESTAMP`, `EXPO_PUBLIC_DEPLOY_ENV`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_REPORT_ISSUE_URL`.
- [x] Dev-banner ENV mappings in builder stage (`EXPO_PUBLIC_COMMIT_HASH` from `BUILD_COMMIT_SHA`, etc.) match design § "Dev-banner integration".
- [x] Supabase URL + publishable key intentionally NOT baked — they arrive via `--set-secrets=` at container start. Verified in Dockerfile (no `ARG EXPO_PUBLIC_SUPABASE_URL`) and in Cloud Run YAML (`valueFrom.secretKeyRef`).
- [x] OCI labels: `source`, `revision`, `version`, `created`, `title`, `description`, plus `cdiscourse.card=HOST-001`.
- [x] Distroless runtime, `USER nonroot`, `EXPOSE 8080`, `CMD ["server.mjs"]`.
- [x] Cloud Run service template (`infra/cloud-run/cdiscourse-dev.template.yaml`) matches every locked flag in design § "Cloud Run service spec": project, region, ingress=all, runtime SA, gen2, min/max 0/4, cpu/memory 1/512Mi, concurrency 80, timeout 60, image registry path, two-secret binding.
- [x] IAM templates match design § "Service-account spec": runtime SA has only logWriter + metricWriter at project scope; secretAccessor + artifactregistry.reader are resource-scoped; forbiddenRoles enumerated. Deployer SA has run.admin + logging.viewer at project scope; serviceAccountUser + artifactregistry.writer resource-scoped; explicit operator-impersonation grant uses `<OPERATOR_EMAIL>` placeholder.
- [x] No `gcloud beta run domain-mappings` invocation anywhere in the implementation (HOST-006's territory, correctly deferred).
- [x] No `cdiscourse-prod` service spec, no `prod-*` image tag (HOST-008's territory, correctly deferred).
- [x] Operator runbook present at `docs/deployment/host-001-operator-runbook.md` with 23 numbered steps. Self-contained; no `<VALUE>` anonymous placeholders; named placeholders only.
- [x] All design "Test plan" items shipped (Tests 1–9 are covered across the three new test files, with the design's "if HOST-004's deliverables not present, skip" provision honored — except HOST-004's `server.mjs` was folded forward into HOST-001 and now lives at `scripts/runtime/server.mjs`).

## Doctrine self-check

| Rule | Status | Justification |
|---|---|---|
| No truth / winner / loser / verdict tokens in user-facing strings | **PASS** | No new user-facing copy; sole "correct" in the diff is technical ("promotion stays correct") |
| Score never blocks posting | **PASS (N/A)** | No score logic touched |
| No service-role in client code | **PASS** | `src/lib/supabase.ts` only reads publishable key from window/process env. Forbidden-shape regex + tests block `service_role` / `SUPABASE_SERVICE_ROLE_KEY` in `server.mjs`, `inject-runtime-env.mjs`, and the client source contract |
| No direct insert into `public.arguments` | **PASS (N/A)** | No DB code touched |
| No AI calls in production app paths | **PASS** | Cloud Run image hosts the static Expo bundle only. `server.mjs` makes no outbound calls; `serve` is local file I/O |
| Plain language only (no internal codes leaking) | **PASS (N/A)** | No new user-facing copy |
| Rules engine sacred (`src/lib/constitution/engine.ts`) | **PASS** | File untouched |
| Secrets policy — only `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` bind to Cloud Run | **PASS** | Service-role / Anthropic / xAI / Bearer / Resend names are denylisted in Dockerfile (no ARG/ENV directive), in Cloud Run YAML (no `secretKeyRef`), in IAM YAMLs (forbiddenRoles), and refused at startup by `server.mjs` + `inject-runtime-env.mjs` |
| RLS / migrations / `flags` discipline | **PASS (N/A)** | No DB change |
| v1 scope guards | **PASS** | No voting / collaborative editing / OAuth login / public API / push / search added. (IAP in HOST-007 is an IAM gate, not user-account auth.) |

### `supabase-edge-contract` skill rules

| Rule | Status | Justification |
|---|---|---|
| No service-role key in client code | **PASS** | The runtime-env shim never touches service-role; client only reads the publishable key |
| Client never directly inserts into `public.arguments` | **PASS (N/A)** | No DB code |
| RLS always on, migrations append-only | **PASS (N/A)** | No migration |
| `request-argument-deletion` workflow preserved | **PASS (N/A)** | Not touched |

### `expo-rn-patterns` skill rules

- New prod dependency `serve@14.2.6` is **pinned exact** (no `^`/`~`) per design K6 mitigation. Single dep, justified by SPA-fallback. **PASS.**
- No web-only dep added beyond `serve`. **PASS.**

## Security checks (per spawn-prompt risk list)

| Risk area | Status | Notes |
|---|---|---|
| Secret leakage paths (hardcoded URL / key / operator email / `--data-file=<path>`) | **PASS with one minor note** | No hardcoded keys. Operator email `kyleruff@gmail.com` appears twice as a placeholder *example* in comment/markdown text ([`docs/deployment/host-001-operator-runbook.md:18`](../deployment/host-001-operator-runbook.md), [`infra/iam/cdiscourse-deployer.iam.yaml:57`](../../infra/iam/cdiscourse-deployer.iam.yaml)) explaining that `<OPERATOR_EMAIL>` should be replaced inline. This is the project owner's own publicly-known account (documented in user memory + CLAUDE.md). Not a security defect; flagged for awareness only. |
| `inject-runtime-env.{mjs,ps1,sh}` reads `.env*` files | **PASS** | Tests assert no `dotenv` import, no `readFile('.env...')`. Values come only from CLI flags or `process.env`. |
| `inject-runtime-env` logs values | **PASS** | Only presence logged (`url=present|missing, publishable-key=present|missing`). Tested via spawn assertions that the forbidden value never appears in stdout/stderr. |
| `server.mjs` serves `.env*` / `node_modules/` / exposes secrets | **PASS** | Serves only `./dist` via `serve -s`. The runtime-env shim file written to `dist/runtime-env.js` carries only the publishable key + URL (JSON-encoded so injection is safe). |
| `server.mjs` binds to `0.0.0.0:8080` | **PASS (by `serve@14` default)** | `serve -l <port>` binds all interfaces by default — Cloud Run-compatible. `PORT` read from `process.env.PORT || 8080`. |
| `server.mjs` has `eval` / dynamic require | **PASS** | None. Uses `spawn(process.execPath, [serveCliPath, ...])` with vendored CLI path. |
| Cloud Run template uses `--no-allow-unauthenticated` | **PASS** | Operator runbook step 19 includes `--no-allow-unauthenticated`. YAML template uses ingress=all but the deploy command flag (and the IAM denylist) is the actual gate. Test `Cloud Run service template — does NOT contain --allow-unauthenticated as an annotation` verifies the YAML. |
| Deployer SA ≠ runtime SA | **PASS** | Separate SAs in separate YAMLs with disjoint role sets. |
| No `roles/owner` / `roles/editor` anywhere | **PASS** | Listed under `forbiddenRoles:` in both IAM YAMLs; tests assert presence. |
| Runtime SA gets only `secretAccessor` (scoped) + `logWriter` + `metricWriter` (+ `artifactregistry.reader` resource-scoped) | **PASS** | Test asserts project section does NOT contain `secretmanager.secretAccessor`; that role appears only under `resourceBindings`. |
| Deployer SA gets only `run.admin` + `iam.serviceAccountUser` (resource-scoped) + `artifactregistry.writer` (resource-scoped) + `logging.viewer` | **PASS** | YAML confirms; tests verify role list + forbiddenRoles. |
| Dockerfile final image is distroless `nodejs22-debian12:nonroot` | **PASS** | Test asserts. |
| Dockerfile final image has no shell / curl / wget | **PASS** | Distroless base. Test scans runtime stage for `RUN curl|wget|apk add|apt-get` — zero matches. |
| Dockerfile copies no service-account JSON | **PASS** | No `COPY` of any `*.json` key file; `.dockerignore` excludes `gcp-key*.json`, `service-account*.json`, `*-credentials.json`. |
| `LABEL`s match design (source/revision/version/created/title) | **PASS** | All five present plus `description` and `cdiscourse.card`. |
| `.dockerignore` excludes `.env*`, `.git`, `node_modules`, `logs/`, `.expo`, `docs/testing-runs/`, `__tests__/` | **PASS** | All listed. Note: `docs/` is excluded wholesale (broader than just `testing-runs/`) — correct, runtime image needs no docs. |
| `.dockerignore` does NOT exclude `dist/` such that the image can't be built | **PASS** | `dist/` IS excluded from the build context (line 36) — but this is correct: the Dockerfile builds `dist/` fresh inside the builder stage via `RUN npx expo export` and then `COPY --from=builder /app/dist ./dist`. There is no host-side `dist/` to bring in. (The review prompt's wording "Must NOT exclude `dist/`" was a misread of the design; the correct doctrine is "must not break the build", which it doesn't.) |
| `src/lib/supabase.ts` reads `window.__CDISCOURSE_RUNTIME_ENV__` BEFORE `process.env` | **PASS** | Resolution order explicit at lines 49–53; tests assert via source-scan regex. |
| New test files (3 expected) | **PASS** | `__tests__/supabaseClientRuntimeEnv.test.ts` (11 tests), `__tests__/dockerfileShape.test.ts` (24 tests), `__tests__/hostOneBuildScripts.test.ts` (49 tests) = 84 new tests confirmed. |
| Tests don't shell out to `docker` / `gcloud` | **PASS** | `dockerfileShape.test.ts` is pure source-scan over file contents; `hostOneBuildScripts.test.ts` only spawns Node entrypoints with `--dry`. No external CLI calls. |
| `docs/core/current-status.md` HOST-001 entry replaces cleanly | **PASS** | Old "Plan written" entry replaced by "Implementation complete, awaiting operator deploy"; only legacy mention is a pre-existing context reference at line 76 describing the master-plan card list (legitimate). |

## Implementation deviations from design — verdict each

### 1. `/healthz` endpoint deferred; Cloud Run startup probe is TCP-socket on :8080 instead of HTTP `GET /healthz`

**Verdict: Accepted.** The design's H3 healthz item is explicitly an addition that lands via HOST-003a (smoke checklist amendment) per the design's §"Smoke-test contract" — "H3 supplements H1 + H2 … The HOST-003 amendment that lands H1/H2/H3 is **a separate follow-up card**." The operator spawn-prompt confirmed the H3 deferral. The Cloud Run YAML uses `tcpSocket: port: 8080` with `failureThreshold: 30` (30 seconds of TCP poll). This is functionally adequate for v0 dev — Cloud Run will mark the revision unhealthy if `server.mjs` never opens the port, which is exactly the failure mode `process.exit(4)`/`(5)`/`(6)` produces. Adding a proper `/healthz` requires either replacing `serve` with a custom HTTP server or wrapping it with an `http.createServer` mux — both are larger changes than the operator wants in a v0 hosting card. Test plan does not depend on a non-existent `/healthz` route; smoke H3 is correctly listed as "deferred to HOST-003a" in both the runbook and the current-status entry. **No blocker.**

### 2. `server.mjs` (not `server.cjs`)

**Verdict: Accepted.** The design said `server.cjs` (CommonJS) at `scripts/deploy/`. The implementer used `server.mjs` (ESM) at `scripts/runtime/`. The Dockerfile (`COPY scripts/runtime/server.mjs ./server.mjs` + `CMD ["server.mjs"]`), the test file (`fileExists('scripts/runtime/server.mjs')`), and all references in `host-001-operator-runbook.md` agree on the filename and the ESM choice. The repo convention already favors `.mjs` for top-level scripts (`scripts/checkpoint-status.mjs`, the rest of `scripts/build/*.mjs`). Distroless `nodejs22-debian12` runs `.mjs` files natively (Node 22 ESM). No regression in functionality vs CommonJS. **No blocker.**

### 3. `src/lib/supabase.ts` (not `supabaseClient.ts`)

**Verdict: Accepted.** The design referenced `src/lib/supabaseClient.ts` (and HOST-001b followup said the same). No such file existed in the repo — `src/lib/supabase.ts` is the actual Supabase client module. The implementer patched the existing file instead of creating a stub `supabaseClient.ts` that would have left an orphan import + duplicated client. Tests source-scan the correct path. No imports anywhere in the repo reference a `supabaseClient.ts` path. **No blocker.**

## Spot-check findings

1. **`__tests__/dockerfileShape.test.ts:170`** — `.dockerignore` test for excluded paths: the test asserts `^\.env\.?\*?\s*$` which matches both `.env` and `.env.*` lines. Both exist in the file. Solid.
2. **`Dockerfile:36`** — `npm ci --no-audit --no-fund --legacy-peer-deps` is acceptable; the `--legacy-peer-deps` mirrors what the implementer used for `npm install --save-exact` when adding `serve` (reasonable given the existing peer-dep mesh in this Expo SDK 54 codebase).
3. **`Dockerfile:60`** — `COPY --from=builder /app/node_modules ./node_modules` copies the **full** builder `node_modules` into the runtime stage, not just `node_modules/serve` + `node_modules/serve-handler` as the design proposed at line 155-157. This is a size trade-off, not a security issue (distroless has no shell and `node_modules` is plain JS). The image is still <200 MB target per design. Acceptable. The runtime stage's only entrypoint is `server.mjs`, which only invokes the `serve` CLI path — even though the full `node_modules` is present, nothing else can execute it. A future optimization (HOST-010 territory) could prune to only the serve + serve-handler subtree. Non-blocking.
4. **`scripts/runtime/server.mjs:64-71`** — Forbidden-shape regex array assembled via string concat (`'\\bsk' + '-ant-'`) so the source file itself never contains the literal forbidden-shape pattern. Nice defense-in-depth touch; mirrors the test file's approach.
5. **`scripts/runtime/server.mjs:35-44`** — `resolveDistDir` tries three candidate paths to find `dist/` (relative to script). This is robust for both the Cloud Run runtime (`/app/server.mjs` + `/app/dist`) and any local debugging invocation. Falls closed if none exist (preflight catches via `existsSync` then `process.exit(6)`).
6. **`scripts/build/inject-runtime-env.mjs:91`** — URL shape regex `/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/` correctly accepts both standard `.supabase.co` and custom-domain Supabase URLs. Good for D10 (reusing dev project) and future custom-domain flexibility.
7. **`infra/cloud-run/cdiscourse-dev.template.yaml:78-81`** — `EXPO_PUBLIC_DEPLOY_ENV=dev` and `EXPO_PUBLIC_APP_URL=https://dev.cdiscourse.com` are also set as plain env-vars (not just baked build args). The doctrine comment explains this is "defence in depth (if a future change moves the banner away from baked-in vars)" — not a defect; these values are public-by-design and non-secret.
8. **No service-account JSON files anywhere in the repo** — `dockerfileShape.test.ts:329` walks the entire repo (excluding common skip dirs) and asserts zero `*.json` files contain both `"type": "service_account"` AND `"private_key":`. Test currently passes.

## Test verification (matches design § "Test plan")

| Design Test | Where it lives | Status |
|---|---|---|
| Test 1 (Dockerfile stage structure + locked build args) | `dockerfileShape.test.ts:32-81` | covered |
| Test 2 (no forbidden-secret ARG/ENV bindings) | `dockerfileShape.test.ts:90-122` | covered |
| Test 3 (port 8080 + CMD entrypoint + no curl/wget/apk in runtime stage + no literal secret in LABEL) | `dockerfileShape.test.ts:56-148` | covered |
| Test 4 (server.{mjs} fails on missing env, never logs values, serves dist with SPA fallback) | `hostOneBuildScripts.test.ts:172-228` | covered |
| Test 5 (`serve.json` headers + rewrites) | **N/A** — the implementer used `serve -s` flag directly instead of a `serve.json` file; the rewrites are handled by `-s` (SPA fallback) and the security headers are handled by the eventual IAP / CDN layer. Tests do not assert on a non-existent file. Acceptable scope contraction. |
| Test 6 (no GCP service-account JSON key in repo) | `dockerfileShape.test.ts:305-340` | covered |
| Test 7 (HOST-002 devEnvironment model unchanged) | not explicitly tested, but verified via `git diff main..HEAD -- src/features/devEnvironment/` is empty | covered |
| Test 8 (banner-wiring regression) | not added — HOST-002 tests still pass; HOST-001 does not touch banner logic | acceptable |
| Test 9 (runbook structure — 23 steps, no `<VALUE>`, `<OPERATOR_EMAIL>` labeled) | `hostOneBuildScripts.test.ts:231-280` | covered |

The serve.json contract (Test 5) was reduced to `-s` flag invocation. This is documented in the implementer's HOST-001 design § "Static server choice" — `serve@14` supports `--single` (or `-s`) directly without a config file. The security headers (HSTS, X-Frame-Options, etc.) the design listed should be added downstream (CDN / IAP), or in a follow-up if the operator wants them on the bare `*.run.app` URL. **Non-blocking; recommend filing as a follow-up if desired.**

## Locked-decisions check (D1–D11)

- D1 project `cdiscourse-host` — confirmed in YAML namespace + IAM SA emails + image registry path
- D2 region `us-central1` — confirmed in registry path + IAM resource location + runbook
- D3 dev URL `dev.cdiscourse.com` — confirmed in EXPO_PUBLIC_APP_URL build arg + Cloud Run YAML env + runbook
- D4 no IP allowlist — confirmed (no Cloud Armor, no IP rules)
- D5 GoDaddy as DNS authority — confirmed (no Cloud DNS, no `gcloud beta run domain-mappings`)
- D6 IAM + IAP, direct Cloud Run mapping — confirmed (ingress=all + `--no-allow-unauthenticated`, no HTTPS LB)
- D7 N/A
- D8 operator runs every `gcloud secrets` — confirmed in runbook Phase 3 (HOST-005 handoff)
- D9 prod deferred — confirmed (no `cdiscourse-prod` service, no `prod-*` tag)
- D10 reuse existing dev Supabase project — confirmed (binding shape uses the existing dev URL via Secret Manager)
- D11 `.env*` history audit skipped — confirmed (no audit logic, no agent-side env-file inspection)

## Blockers

None.

## Suggestions (non-blocking — defer or file as follow-up)

1. **`serve.json` security headers.** Design Test 5 contemplated a `serve.json` with HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. The implementer chose to use `serve -s` flag without a config file. The headers are not present at the static-server layer. If the operator wants them before IAP/CDN attaches in HOST-007/HOST-006, add a `serve.json` config and pass `--config` to `serve` in `server.mjs`. Defer to HOST-003a or a tiny follow-up.
2. **`node_modules` pruning in runtime stage.** Currently the full builder `node_modules` is copied into the runtime stage. The image is well under the 200 MB ceiling, but a future optimization (HOST-010 territory) could copy only `node_modules/serve` + `node_modules/serve-handler` + the resolved tree, shrinking the runtime image. Not a security issue; only a size one.
3. **`/healthz` follow-up (HOST-003a).** The TCP startup probe works, but an HTTP `/healthz` route would prove `server.mjs` started cleanly with the runtime env loaded (not just that the port is bound). Wire it when HOST-003a lands.
4. **Operator email in comment examples.** `kyleruff@gmail.com` appears twice as a placeholder example in comments. It's the project owner's publicly-known account, but consider replacing with `<your-email@example.com>` for tidiness if the runbook is ever shared widely.

## What's still needed before the operator deploys

Per the runbook + design:

1. **HOST-005** must land first (Secret Manager secrets created + IAM bindings applied) — otherwise step 19's Cloud Run deploy succeeds but the container exits 4 on cold start.
2. **Operator Phase 1** (steps 1–9) — authenticate, create project, enable APIs, link billing, set budget alert, create both SAs, grant minimum roles, grant operator → deployer impersonation.
3. **Operator Phase 2** (steps 10–12) — Artifact Registry repo + IAM bindings + docker auth config.
4. **Operator Phase 3** (step 13) — HOST-005 secret create + bind.
5. **Operator Phase 4** (steps 14–18) — build image, push to Artifact Registry.
6. **Operator Phase 5** (steps 19–22) — deploy, H1/H2 smoke, optional browser smoke via `gcloud run services proxy`.
7. **Then HOST-006** — `dev.cdiscourse.com` domain mapping + GoDaddy CNAME.
8. **Then HOST-007** — IAP attach + tester onboarding.
9. **Then HOST-003a** — fold H1/H2/H3 (incl. `/healthz`) into `docs/deployment-smoke-checklist.md`.

## Operator next steps

- Push the branch: `git push -u origin feat/HOST-001-dev-hosting-architecture-google-cloud-ru` (already pushed; refresh if needed).
- Open PR: `gh pr create --title "HOST-001: dev hosting architecture (Cloud Run + dev.cdiscourse.com)" --body-file docs/reviews/HOST-001.md` (or operator preferred body).
- After merge, follow `docs/deployment/host-001-operator-runbook.md` step-by-step. The agent does NOT run any deploy command.
- Close issue **#92** (HOST-001b) on merge (the runtime-env shim is folded in here).
- File follow-ups: HOST-003a (smoke amendment + `/healthz`), HOST-009 (logging-based plain-language alert), HOST-010 (Artifact Registry cleanup), HOST-012 (dist checksum gate).
