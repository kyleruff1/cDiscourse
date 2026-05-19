# HOST-001 — Dev hosting architecture (Google Cloud Run + dev.cdiscourse.com)

**Status:** Design draft
**Epic:** Hosting
**Release:** 6.8
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/27
**Branch:** `feat/HOST-001-dev-hosting-architecture-google-cloud-ru`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\HOST-001.md`
**Master plan:** [`docs/deployment/google-cloud-run-hosting-plan.md`](../deployment/google-cloud-run-hosting-plan.md) (merged via PR #91 at `03ef436`)
**Companion (out of scope):** [`docs/deployment/claude-code-vertex-ai-note.md`](../deployment/claude-code-vertex-ai-note.md) — Vertex AI is the operator's local Claude Code routing convenience and is NOT part of `cdiscourse.com` hosting. This card does not touch it.
**Shipped sister cards consumed as inputs:**
- HOST-002 (#28, closed) — `src/features/devEnvironment/devEnvironmentModel.ts`: `getDeployEnvironment` / `shouldShowDevBanner` / `getBuildInfo` already read `EXPO_PUBLIC_DEPLOY_ENV` / `EXPO_PUBLIC_APP_URL` / `EXPO_PUBLIC_COMMIT_HASH` / `EXPO_PUBLIC_BUILD_VERSION`. HOST-001 just needs to populate them at build time.
- HOST-003 (#29, closed) — [`docs/deployment-smoke-checklist.md`](../deployment-smoke-checklist.md) is the verification gate. HOST-001's "done" means a passing run of this checklist plus the two new items H1 + H2.

---

## Goal

HOST-001 is the **architecture + first Cloud Run revision** card. It owns the deployable surface that turns the existing Expo web build into a publicly-reachable (but IAP-gated) dev sandbox at `https://dev.cdiscourse.com`, hosted on Google Cloud Run in project `cdiscourse-host` / region `us-central1`, with runtime config pulled from Google Secret Manager via `--set-secrets=` bindings.

This card delivers **the contract** for:

- The container image that runs the Expo web bundle.
- The Artifact Registry repo it lives in.
- The Cloud Run service spec that runs it.
- The two service accounts (runtime + deployer) and their minimum roles.
- The env-var + Secret Manager binding shape the runtime expects.
- The dev-banner integration (commit SHA threaded into `EXPO_PUBLIC_COMMIT_HASH`).
- The smoke-test mapping that proves a deploy actually went live.
- The first-deploy operator runbook.
- The rollback flow.

It explicitly does **not** own:

- The deploy scripts themselves (HOST-004 builds `scripts/deploy/*`).
- Secret Manager `gcloud secrets create` ceremony (HOST-005 — operator-run, never agent-run).
- DNS records at GoDaddy (HOST-006).
- IAP configuration / OAuth consent screen (HOST-007).
- The `cdiscourse-prod` service (HOST-008 — stub-only).

Doctrine constraints that shape this design (per `cdiscourse-doctrine` skill + master plan §16):

- **No production deploy. No DNS mutation. No Supabase migration. No Edge Function deploy.**
- **No `.env*` file read or print.** Operator runs the inventory locally and shares only key names.
- **No service-role / Anthropic / xAI / Resend keys in Cloud Run env or Secret Manager binding.** Those stay in Supabase Function secrets.
- **The app cannot call Anthropic / xAI / X from the client or from Cloud Run.** AI calls live only in Edge Functions.
- **The container is the Expo web static bundle behind a tiny static server.** No server-side rendering, no Node API surface beyond serving files.
- **No service-account JSON key files in the repo.** ADC / Workload Identity only.
- **Heat ≠ truth. Popularity ≠ evidence. No verdict tokens.** Doctrine carries across every card.

---

## Locked decisions inherited (D1–D11, operator 2026-05-19)

These are NOT open. The design assumes them. If the implementer wants to challenge one, surface it as an explicit "Design challenges decision Dx" item and stop.

| # | Decision | Value |
|---|---|---|
| D1 | GCP project ID | **`cdiscourse-host`** |
| D2 | Region | **`us-central1`** |
| D3 | Dev subdomain | **`dev.cdiscourse.com`** |
| D4 | IP allowlist | **NOT used** — Cloud Armor IP allowlist path retired from active scope |
| D5 | DNS authority | **GoDaddy stays as authority for v0** |
| D6 | Dev access control | **IAM + IAP (Google sign-in)** — direct Cloud Run domain mapping (no HTTPS LB) is the default |
| D7 | Operator public IP capture | **N/A** (D4 / D6 use IAP, not IP allowlisting) |
| D8 | Secret Manager migration | **Operator runs every `gcloud secrets create` / `gcloud secrets versions add --data-file=-`** themselves. Agent never executes. |
| D9 | Production cutover | **Deferred.** Dev must be live and stable first. |
| D10 | Dev Supabase project | **Reuse the existing dev Supabase project** for the hosted dev URL. |
| D11 | `.env*` history audit | **Skipped** per operator confirmation that keys never left local gitignored files. §7.5 rotation criteria still apply. |

**Consequence on this design:**

- **Direct Cloud Run domain mapping** is the only path implemented. The HTTPS LB + serverless NEG + Cloud Armor path stays in the master plan only as fallback if IAP setup hits an unexpected blocker — HOST-001 does NOT build it.
- **Cloud Run service `cdiscourse-dev` ingress = `all`.** Because IAP gates access in front of Cloud Run (not Cloud Armor at an LB), Cloud Run must accept the IAP-forwarded requests directly. Ingress `all` is correct here; the IAM `--no-allow-unauthenticated` + IAP IAM grant chain is the actual gate.
- **No `gcloud beta run domain-mappings` until HOST-006.** HOST-001 stops at the `*.run.app` URL working under IAP. The custom-domain mapping is part of HOST-006's contract.
- **No image promotion to a `prod-*` tag.** That is HOST-008's contract.

---

## Container design

### Base image

```
node:22-alpine  →  builder stage  (Expo web build)
gcr.io/distroless/nodejs22-debian12:nonroot  →  runtime stage  (serves static files)
```

Rationale:
- Node 22 is the current LTS and matches Expo SDK 54's tested baseline (`expo@~54.0.33` per `package.json`).
- Alpine for the builder keeps the build stage small; distroless for the runtime keeps the production attack surface minimal (no shell, no package manager) and runs as non-root.
- Distroless nodejs ships `node` only, which is enough to run the static-server choice below.

### Static server choice

**Decision: `npx serve` is NOT used.** It pulls a dev-time tarball at container start, which is unacceptable for a production-shaped container. Instead, the runtime stage uses **a pinned, vendored static server** that ships inside the image.

The design picks **`serve@14`** (the `vercel/serve` package) installed at **build time** in the runtime stage, **not at container start**:

- Pros: smallest config surface, native Node, supports `--single` (SPA fallback) which Expo web requires for client-side router state to survive a page refresh, and supports custom `serve.json` headers.
- Cons: adds one dep to the production image (~1 MB unpacked). Acceptable trade-off vs. nginx (heavier base image, FROM-chain complexity) or hand-rolled Node `http` server (more surface to maintain).
- Alternatives considered and rejected:
  - **nginx-alpine** — would force a switch off the Node distroless base, doubles the FROM-chain, and the only thing nginx buys us is config flexibility we don't need for a SPA static bundle.
  - **`npx serve`** — pulls at runtime; tarball signature can drift between deploys; fails the "reproducible image" doctrine.
  - **Hand-rolled `http` server** — more code to maintain, no SPA fallback for free, and the SPA-fallback bug surface is exactly what `serve --single` exists to solve.

**This is a new production dependency.** Per the spawn-card hard rules ("No new dependency unless the design explicitly recommends one with justification and stops for operator approval"), the implementer must STOP and confirm with the operator before `npm install --save serve@14` lands. The alternative is a hand-rolled SPA-fallback static server (~40 lines of Node) — also acceptable if the operator prefers zero new deps.

**Default recommendation: install `serve@14` as a production dep, justified by SPA-fallback safety and reproducibility.**

### Dockerfile contract (the implementer's BUILD-phase target)

The implementer will write `Dockerfile` at repo root. The contract this design locks:

```dockerfile
# Stage 1 — builder
FROM node:22-alpine AS builder
WORKDIR /app

# Build args wired by the deploy script
ARG BUILD_COMMIT_SHA="unknown"
ARG BUILD_VERSION="unknown"
ARG BUILD_TIMESTAMP="unknown"
ARG EXPO_PUBLIC_DEPLOY_ENV="dev"
ARG EXPO_PUBLIC_APP_URL="https://dev.cdiscourse.com"
ARG EXPO_PUBLIC_REPORT_ISSUE_URL="https://github.com/kyleruff1/cDiscourse/issues"

# Build-time only — the Supabase URL + publishable key are NOT baked here
# because they come from --set-secrets= at runtime via Secret Manager.
# See "Runtime config flow" below for why this is safe.

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Stamp the dev-banner build info into the bundle via EXPO_PUBLIC_ env vars
# that the Expo Web build picks up. The HOST-002 banner reads them via
# `getBuildInfo` / `getDeployEnvironment`.
ENV EXPO_PUBLIC_DEPLOY_ENV=${EXPO_PUBLIC_DEPLOY_ENV}
ENV EXPO_PUBLIC_APP_URL=${EXPO_PUBLIC_APP_URL}
ENV EXPO_PUBLIC_COMMIT_HASH=${BUILD_COMMIT_SHA}
ENV EXPO_PUBLIC_BUILD_VERSION=${BUILD_VERSION}
ENV EXPO_PUBLIC_REPORT_ISSUE_URL=${EXPO_PUBLIC_REPORT_ISSUE_URL}

# Expo Web build. Output goes to ./dist (default for `expo export -p web`).
RUN npx expo export --platform web --output-dir dist

# Stage 2 — runtime
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

# Vendor serve@14 at build time so the image is reproducible.
# Layout: /app/node_modules + /app/dist + /app/serve.json + /app/server.cjs entry.
COPY --from=builder /app/node_modules/serve ./node_modules/serve
COPY --from=builder /app/node_modules/serve-handler ./node_modules/serve-handler
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/dist ./dist
COPY scripts/deploy/serve.json ./serve.json
COPY scripts/deploy/server.cjs ./server.cjs

# OCI labels for traceability (mirrors the labels Artifact Registry shows).
ARG BUILD_COMMIT_SHA="unknown"
ARG BUILD_VERSION="unknown"
ARG BUILD_TIMESTAMP="unknown"
LABEL org.opencontainers.image.source="https://github.com/kyleruff1/cDiscourse"
LABEL org.opencontainers.image.revision=${BUILD_COMMIT_SHA}
LABEL org.opencontainers.image.version=${BUILD_VERSION}
LABEL org.opencontainers.image.created=${BUILD_TIMESTAMP}
LABEL org.opencontainers.image.title="cdiscourse-web"

EXPOSE 8080
USER nonroot

# Cloud Run injects PORT=8080 by default; server.cjs reads it.
CMD ["server.cjs"]
```

`scripts/deploy/server.cjs` (HOST-004's deliverable; contract here):

- Reads `process.env.PORT` (default 8080) — required for Cloud Run.
- Reads `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` at startup and writes them into `dist/env.js` as `window.__CDISCOURSE_RUNTIME_ENV__ = { ... }` **only if** the keys are set and non-empty. If either is missing, the server exits non-zero with a single-line message — fail-closed, no app served.
- Mounts `serve-handler` against `./dist` with `serve.json` config + `--single` SPA-fallback semantics.
- Exposes `GET /healthz` returning `200 OK\n` with `content-type: text/plain` — used by Cloud Run's HTTP startup probe and by smoke check H1.
- Never logs the values of `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Logs only "env loaded: 2/2" / "env missing: SUPABASE_URL".

`scripts/deploy/serve.json` (HOST-004 deliverable; contract here):

```json
{
  "public": "dist",
  "cleanUrls": true,
  "rewrites": [{ "source": "/**", "destination": "/index.html" }],
  "headers": [
    {
      "source": "**/*",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Cache-Control", "value": "public, max-age=300" }
      ]
    },
    {
      "source": "**/*.{js,css,woff2,png,jpg,svg,ico}",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

### Runtime config flow — why Supabase URL + publishable key are not baked in

Expo Web normally bakes `EXPO_PUBLIC_*` env vars into the JS bundle at build time. We deliberately **do not** bake `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` into the bundle. Instead:

1. Cloud Run injects them into `process.env` at container start via `--set-secrets=`.
2. `server.cjs` reads them and writes a tiny `dist/env.js` that sets `window.__CDISCOURSE_RUNTIME_ENV__`.
3. The client bundle (`src/lib/supabaseClient.ts` — small adjustment land in HOST-004's BUILD phase, NOT this design) reads from `window.__CDISCOURSE_RUNTIME_ENV__ ?? process.env` so local dev (`expo start`) continues to read `.env` exactly as today.

**Why this matters:**
- A single container image can be promoted dev → prod (HOST-008) without rebuild, because no Supabase URL or key is baked in. Promotion is digest-only.
- The runtime can prove "this image came from THIS commit SHA" via the `EXPO_PUBLIC_COMMIT_HASH` build arg, which IS baked in.
- The `EXPO_PUBLIC_DEPLOY_ENV` build arg controls whether the dev banner is visible (HOST-002 fails closed: anything not `production` shows the banner).

**Doctrine check:** `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the anon / publishable key. Supabase publishes it by design; embedding it in the bundle is safe. We route it through Secret Manager anyway so that dev / prod parity is consistent and so the Cloud Run runtime SA is the only thing with secret access. **The service-role key is NEVER bound to Cloud Run.** It lives in Supabase Function secrets and only Edge Functions read it.

### Image size budget

| Layer | Estimated size |
|---|---|
| `gcr.io/distroless/nodejs22-debian12:nonroot` | ~70 MB |
| `node_modules/serve` + `serve-handler` | ~3 MB |
| `dist/` (Expo web bundle, gzipped JS + assets) | ~20-50 MB depending on assets |
| `server.cjs` + `serve.json` | < 5 KB |
| **Total** | **< 130 MB target, < 200 MB hard ceiling** |

If the image exceeds 200 MB, the BUILD-phase implementer must investigate (`dist/` bloat is the most likely cause) before deploying. A `docker images cdiscourse-web --format='{{.Size}}'` check belongs in the H2 smoke item.

---

## Cloud Run service spec

The `cdiscourse-dev` service:

| Property | Value | Why |
|---|---|---|
| Name | `cdiscourse-dev` | Matches D1 / D6 naming. `cdiscourse-prod` reserved for HOST-008. |
| Project | `cdiscourse-host` | D1 |
| Region | `us-central1` | D2 |
| Service account | `cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com` | NEVER the Compute Engine default SA. |
| Image | `us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web/cdiscourse-web:dev-<sha7>` | One image tag per deploy. |
| Ingress | `all` | Because IAP fronts the service (not Cloud Armor at an LB). |
| Auth flag | `--no-allow-unauthenticated` initially | Until IAP is wired in HOST-007, only the deployer can `curl` with an identity token. |
| Min instances | 0 | Dev only. Cold start acceptable. |
| Max instances | 4 | Cap blast radius if a tester loops. |
| CPU | 1 | Static-serve only. |
| Memory | 512 Mi | Comfortable headroom for `serve`. |
| Concurrency | 80 | Cloud Run default; matches a single static-serve process well. |
| Request timeout | 60s | Static-serve only — Edge Function calls go direct to Supabase, not via this service. |
| Startup probe | `GET /healthz`, initialDelay 0s, period 1s, timeout 1s, failureThreshold 5 | Implementer wires via `gcloud run services replace` YAML or `--startup-probe-*` flags. |
| Liveness probe | none (Cloud Run handles process lifecycle) | |
| Execution environment | `gen2` | gen2 is faster cold start than gen1 for Node static-serve. |
| VPC connector | none | Dev doesn't need egress through a VPC for v0. |
| CMEK | none | Default Google-managed encryption is fine for dev. |
| Labels | `env=dev`, `commit=<sha7>`, `card=host-001` | For Cloud Logging / Billing filtering. |
| Revision suffix | `dev-<utc-yyyymmdd-hhmmss>` | Set via `--revision-suffix=` so revisions are human-readable in the rollback UI. |

**Env-var contract** (set via deploy command, not in the image):

```
PORT=8080                              # injected by Cloud Run automatically
NODE_ENV=production                    # set via --set-env-vars
```

**Secret-binding contract** (HOST-005 creates these secrets; HOST-001 specifies the binding shape):

```
EXPO_PUBLIC_SUPABASE_URL              → cdiscourse-dev-supabase-url:latest
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY  → cdiscourse-dev-supabase-publishable-key:latest
```

Deploy command shape (HOST-004 owns this; locked here for cross-card contract):

```bash
gcloud run deploy cdiscourse-dev \
  --project=cdiscourse-host \
  --region=us-central1 \
  --image=us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web/cdiscourse-web:dev-${COMMIT_SHA_7} \
  --service-account=cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com \
  --ingress=all \
  --no-allow-unauthenticated \
  --min-instances=0 \
  --max-instances=4 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --timeout=60 \
  --execution-environment=gen2 \
  --revision-suffix=dev-$(date -u +%Y%m%d-%H%M%S) \
  --set-env-vars=NODE_ENV=production \
  --set-secrets=EXPO_PUBLIC_SUPABASE_URL=cdiscourse-dev-supabase-url:latest,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cdiscourse-dev-supabase-publishable-key:latest \
  --labels=env=dev,commit=${COMMIT_SHA_7},card=host-001
```

**Refusals** (the deploy script HOST-004 implements; locked here):

- Refuses if any of `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, `RESEND_API_KEY` appears as a key in `--set-env-vars=` or `--set-secrets=`.
- Refuses if `--allow-unauthenticated` is present without explicit `--allow-public` operator double-confirmation.
- Refuses if the working tree is dirty (unless `--allow-dirty`).
- Refuses if the current branch is not `main` (unless `--allow-branch=<name>`).

---

## Artifact Registry spec

| Property | Value |
|---|---|
| Repo name | `cdiscourse-web` |
| Format | `docker` |
| Location | `us-central1` |
| Project | `cdiscourse-host` |
| Mode | Standard (not remote / virtual) |
| Cleanup policy | **Phase 1: none.** Keep all images. Phase 2 (after ~50 deploys): keep latest 20 per tag prefix. |
| IAM bindings | `cdiscourse-deployer` → `roles/artifactregistry.writer` (push images). `cdiscourse-dev-runner` → `roles/artifactregistry.reader` (pull images). No `allUsers` binding. |

**Image tag taxonomy:**

| Tag pattern | Who creates it | Lifetime |
|---|---|---|
| `dev-<sha7>` | HOST-004 deploy script on every dev deploy | Forever (until cleanup policy kicks in). |
| `dev-latest` | HOST-004 deploy script, moves on every dev deploy | Always points at the most recent dev image. **Deploys reference `dev-<sha7>`, not `dev-latest`** — `dev-latest` is a convenience for `gcloud artifacts` inspection. |
| `prod-<sha7>` | HOST-008 promotion script (out of scope here) | Created by digest-copy from an existing `dev-<sha7>`. No rebuild. |
| `prod-latest` | HOST-008 promotion script | Forward-compat slot. |

**Full image URL shape:**

```
us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web/cdiscourse-web:dev-<sha7>
```

The repo is `cdiscourse-web`; the image name (inside the repo) is also `cdiscourse-web`. Same name twice is intentional — Artifact Registry repos contain N images, and we keep N=1 for v0.

**Digest pinning:** the deploy script captures the pushed digest (`docker push` → `sha256:...`) and includes it in the deploy log. Promotion (HOST-008) operates on the digest, not the tag.

---

## Service-account spec

### Runtime SA — `cdiscourse-dev-runner`

| Property | Value |
|---|---|
| Email | `cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com` |
| Display name | `CDiscourse dev Cloud Run runtime` |
| Description | `Runtime identity for cdiscourse-dev Cloud Run service. NOT for human use. No key download.` |

**Granted roles (minimum):**

| Role | Scope | Why |
|---|---|---|
| `roles/secretmanager.secretAccessor` | **Resource-scoped to secrets matching `cdiscourse-dev-*`** (not project-wide). | Reads the two dev secrets at container start. |
| `roles/logging.logWriter` | Project-wide | Writes structured logs to Cloud Logging. |
| `roles/monitoring.metricWriter` | Project-wide | Emits Cloud Monitoring metrics (request count, latency). |
| `roles/artifactregistry.reader` | Resource-scoped to repo `cdiscourse-web` | Pulls the container image at cold-start. |

**Forbidden:**
- `roles/owner`, `roles/editor`, any `*Admin` role.
- Project-wide `roles/secretmanager.secretAccessor` (must be secret-scoped — see below).
- The Compute Engine default SA (`<project-number>-compute@developer.gserviceaccount.com`). The Cloud Run service spec must explicitly set `--service-account=cdiscourse-dev-runner@...`.
- Service-account key download. ADC + impersonation only.

**Secret-scoped binding shape:**

```bash
# Operator-run, not agent-run. HOST-005 documents these.
gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-url \
  --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-publishable-key \
  --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

The runtime SA does **not** get a wildcard binding. Each secret name receives an explicit binding.

### Deployer SA — `cdiscourse-deployer`

| Property | Value |
|---|---|
| Email | `cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com` |
| Display name | `CDiscourse deployer (Cloud Run + Artifact Registry)` |
| Description | `Used by operator-run deploy scripts. Impersonated via ADC; no key download.` |

**Granted roles:**

| Role | Scope | Why |
|---|---|---|
| `roles/run.admin` | Project-wide (project: `cdiscourse-host`) | `gcloud run deploy`, `gcloud run services update-traffic`, etc. |
| `roles/iam.serviceAccountUser` | **Resource-scoped to `cdiscourse-dev-runner`** (and later `cdiscourse-prod-runner`) | Required to pass `--service-account=cdiscourse-dev-runner@...` on deploy. |
| `roles/artifactregistry.writer` | Resource-scoped to repo `cdiscourse-web` | `docker push`. |
| `roles/logging.viewer` | Project-wide | Read deploy-time logs. |

**Forbidden:**
- `roles/owner`, `roles/editor`.
- `roles/serviceAccountTokenCreator` on `cdiscourse-dev-runner` for v0 (operator uses ADC, not token-stealing). May be revisited in HOST-008 if Cloud Build is wired.

### Operator personal identity

The operator authenticates with `gcloud auth login` (their personal Google account) and `gcloud auth application-default login`. The operator's personal account holds `roles/owner` or equivalent on the project for setup; deploys impersonate `cdiscourse-deployer` via:

```bash
gcloud config set auth/impersonate_service_account cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com
```

The operator's personal account needs `roles/iam.serviceAccountTokenCreator` **on `cdiscourse-deployer`** (resource-scoped, not project-wide) for impersonation to work.

**No service-account JSON keys exist anywhere.** The repo must never contain a `*.json` key file. The deploy script refuses if `GOOGLE_APPLICATION_CREDENTIALS` points at a file inside the repo tree.

---

## Dev-banner integration

HOST-002 already shipped `src/features/devEnvironment/devEnvironmentModel.ts`. The functions HOST-001 must populate inputs for:

- `getDeployEnvironment(env)` reads `EXPO_PUBLIC_DEPLOY_ENV`. Set to `"dev"` via `ARG EXPO_PUBLIC_DEPLOY_ENV="dev"` in the Dockerfile so the banner stays visible. (Fails closed: any value other than `"production"` shows the banner.)
- `getBuildInfo(env)` reads `EXPO_PUBLIC_COMMIT_HASH` + `EXPO_PUBLIC_BUILD_VERSION`. Populate `EXPO_PUBLIC_COMMIT_HASH` from the deploy script via `--build-arg BUILD_COMMIT_SHA=$(git rev-parse --short=7 HEAD)`.
- `getReportIssueUrl(env)` reads `EXPO_PUBLIC_REPORT_ISSUE_URL`. Defaults to the GitHub issues URL if unset, so we let the default apply unless the operator overrides.

**Build-arg vs runtime env-var decision:**

- `EXPO_PUBLIC_COMMIT_HASH`, `EXPO_PUBLIC_BUILD_VERSION`, `EXPO_PUBLIC_DEPLOY_ENV`, `EXPO_PUBLIC_APP_URL`, `EXPO_PUBLIC_REPORT_ISSUE_URL` → **build-arg**, baked into the bundle by Expo Web. These values are immutable per image — they identify which commit produced this image. They MUST be baked, otherwise a single image promoted dev → prod would lie about its origin.
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → **runtime env-var**, injected by `--set-secrets=`. These are environment-specific (dev vs prod project) and must NOT be baked, so the same image can promote across envs.

This split is the core architectural decision of HOST-001. It is what makes HOST-008's digest-only promotion correct: only environment-specific config differs between dev and prod, and that config arrives at container start, not build time.

**`server.cjs` writes runtime env to `dist/env.js`** (a tiny file the SPA fetches before bootstrap). HOST-001's design contract for that file:

```js
// dist/env.js — written by server.cjs at container start.
window.__CDISCOURSE_RUNTIME_ENV__ = Object.freeze({
  EXPO_PUBLIC_SUPABASE_URL: "<from process.env at start>",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "<from process.env at start>"
});
```

HOST-001 does NOT modify `src/lib/supabaseClient.ts`. That seam-wiring change lives in HOST-004 (or a tiny follow-up if the implementer prefers to split it out). The contract HOST-001 locks: `src/lib/supabaseClient.ts` must read `window.__CDISCOURSE_RUNTIME_ENV__?.EXPO_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL` (with the same OR pattern for the publishable key) so local dev (`expo start`) keeps working.

---

## Smoke-test contract

HOST-001 inherits the full HOST-003 checklist at `docs/deployment-smoke-checklist.md`. The mapping below shows which existing items apply directly to a Cloud Run-served URL plus the two new hosting-specific items.

### Existing HOST-003 items — how each lands on Cloud Run

| Item | Where it executes on Cloud Run | Notes |
|---|---|---|
| **P1 typecheck** | CI / local before image build | Image build fails if typecheck fails — HOST-004 wires this into the deploy script. |
| **P2 lint** | CI / local before image build | Same as P1. |
| **P3 test** | CI / local before image build | Same as P1. |
| **P4 skills:validate** | CI / local before image build | Same as P1. |
| **P5 no secrets in bundle** | `grep` over the built `dist/` BEFORE the image is built; re-run inside the image via `docker run --rm <image> sh -c 'grep -rE ...'` (but distroless has no sh — see note). | Distroless has no shell. The grep runs on `dist/` before the runtime stage; HOST-004's deploy script gates on it. The implementer must NOT add a shell to the distroless image. |
| **P6 Supabase URL points at dev** | Verify via browser console at startup: `window.__CDISCOURSE_RUNTIME_ENV__.EXPO_PUBLIC_SUPABASE_URL` matches the dev project ref. | Trivial check after first deploy. |
| **P7 `submit-argument` Stage 6.2+** | Existing Edge Function on the existing Supabase project — Cloud Run does not affect this. | Per D10, dev Supabase is reused. P7 was already passing before this card. |
| **P8 no `.env*` committed** | `git ls-files \| grep '^\.env'` → zero | Already enforced by `.gitignore`. Re-verified on every deploy. |
| **A1–A4 Auth flow** | Browser flow against `https://<cloud-run-url>` (or `dev.cdiscourse.com` once HOST-006 lands). | Identical behaviour to local — Supabase Auth allowed redirect URLs need `https://dev.cdiscourse.com/**` added (operator step, plan §11.9). |
| **G1–G5 Gallery** | Browser flow. | Same as local. |
| **C1–C4 Conversation entry** | Browser flow. | Same as local. |
| **R1–R6 In-room** | Browser flow. | Same as local. |
| **Q1–Q2 Profile** | Browser flow. | Same as local. |
| **L1–L3 Plain-language** | Browser flow + grep over `dist/` for banned tokens. | Banned-token grep also runs at image build. |
| **S1 no service-role in client** | `grep -r "SUPABASE_SERVICE_ROLE_KEY\|service_role" dist/` → zero. | Belongs in the deploy script's pre-push gate. |
| **S2 no long-form secrets** | `grep -E 'sk-ant-\|xai-\|sb_secret_\|Bearer \|eyJ[A-Za-z0-9_-]{20,}' dist/` → zero. | Same. |
| **S3 no admin email leak** | Network panel during smoke run. | Unchanged by hosting. |
| **S4 no Authorization in logs** | Cloud Run logs UI (`gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=cdiscourse-dev'`). | New surface — operator scans the cloud logs in addition to browser console. |
| **S5 no X handles in user copy** | Browser flow. | Unchanged. |

### New hosting-specific items (proposed to fold into HOST-003 follow-up — plan §17)

**H1 — TLS healthy**

- Run: `curl -I https://dev.cdiscourse.com` (or `curl -I -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://<cloud-run-url>` before HOST-006 lands).
- Pass: HTTP/2 200 (or 401/403 if gated by IAP without an identity token — also a pass, because it proves the gate works). Certificate chain is "Google Trust Services" — view via browser certificate inspector.
- Fail: any `SSLError`, `ERR_CERT_*`, self-signed warning, TLS handshake error, or HTTP/1.1 fallback that exposes a missing HSTS header.

**H2 — Cloud Run revision matches expected SHA**

- Run: `gcloud run revisions list --service=cdiscourse-dev --region=us-central1 --project=cdiscourse-host --limit=1 --format='value(metadata.name,spec.containers[0].image)'`
- Pass: the latest revision's image tag matches the `dev-<sha7>` you intended to deploy, AND the deploy script's recorded image digest matches `gcloud run revisions describe <name> --format='value(spec.containers[0].imageDigest)'`.
- Fail: revision shows a stale image; digest mismatch; revision created before "now" minus 5 minutes (suggests the deploy didn't actually roll).

**H3 — Health endpoint responds (added in design)**

- Run: `curl -fsS -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://<cloud-run-url>/healthz`
- Pass: 200, body `OK\n`. Confirms `server.cjs` started cleanly with `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` present (otherwise server.cjs exits non-zero and Cloud Run never serves).
- Fail: connection refused, 503 (no healthy revisions), 500.

H3 supplements H1 + H2 — H1 only proves the cert, H2 only proves the metadata, H3 proves the runtime actually loaded.

The HOST-003 amendment that lands H1/H2/H3 is **a separate follow-up card** (proposed `HOST-003a` — see §16 of master plan and the follow-ups list below). HOST-001's design references the contract; the doc edit is not in this card's scope.

---

## Operator runbook for first deploy

> **Agent never runs these steps.** Every command is operator-runnable. Cross-reference plan §11.

### Phase 1 — One-time project setup

1. **Authenticate.**
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
2. **Create / select the project.**
   ```bash
   gcloud projects create cdiscourse-host --name=CDiscourse   # if not already created
   gcloud config set project cdiscourse-host
   gcloud config set run/region us-central1
   ```
3. **Link a billing account** in the Cloud Console (Billing → Link a billing account → pick the operator's).
4. **Enable APIs.**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com \
     iam.googleapis.com \
     iap.googleapis.com
   ```
   (Note: `compute.googleapis.com` is NOT enabled here because direct Cloud Run domain mapping is the chosen path. HOST-006 may enable it later if domain mapping requires it; that's HOST-006's call.)
5. **Set a budget alert** at $20/month (Billing → Budgets & alerts → Create budget → scope to `cdiscourse-host` → alert email to operator). Manual UI step.

### Phase 2 — Identity setup

6. **Create service accounts.**
   ```bash
   gcloud iam service-accounts create cdiscourse-dev-runner \
     --display-name="CDiscourse dev Cloud Run runtime" \
     --description="Runtime identity for cdiscourse-dev Cloud Run service. NOT for human use. No key download."

   gcloud iam service-accounts create cdiscourse-deployer \
     --display-name="CDiscourse deployer (Cloud Run + Artifact Registry)" \
     --description="Used by operator-run deploy scripts. Impersonated via ADC; no key download."
   ```
7. **Grant deployer SA roles.**
   ```bash
   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/run.admin"

   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/logging.viewer"

   # Resource-scoped: deployer can act AS the runtime SA on deploys.
   gcloud iam service-accounts add-iam-policy-binding \
     cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com \
     --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   ```
8. **Grant runtime SA roles.**
   ```bash
   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/logging.logWriter"

   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/monitoring.metricWriter"
   # NOTE: secretmanager.secretAccessor is granted per-secret in HOST-005, NOT project-wide.
   # NOTE: artifactregistry.reader is granted on the repo in step 9, NOT project-wide.
   ```
9. **Operator → deployer SA impersonation grant.**
   ```bash
   # <OPERATOR_EMAIL> = the operator's personal Google account.
   gcloud iam service-accounts add-iam-policy-binding \
     cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com \
     --member="user:<OPERATOR_EMAIL>" \
     --role="roles/iam.serviceAccountTokenCreator"
   ```

### Phase 3 — Artifact Registry

10. **Create the Docker repo.**
    ```bash
    gcloud artifacts repositories create cdiscourse-web \
      --repository-format=docker \
      --location=us-central1 \
      --description="CDiscourse web container images (dev + prod)"
    ```
11. **Bind repo IAM.**
    ```bash
    gcloud artifacts repositories add-iam-policy-binding cdiscourse-web \
      --location=us-central1 \
      --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
      --role="roles/artifactregistry.writer"

    gcloud artifacts repositories add-iam-policy-binding cdiscourse-web \
      --location=us-central1 \
      --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
      --role="roles/artifactregistry.reader"
    ```
12. **Configure docker auth.**
    ```bash
    gcloud auth configure-docker us-central1-docker.pkg.dev
    ```

### Phase 4 — Secrets (handed off to HOST-005)

13. **HOST-005 runbook.** When HOST-005 is ready, run its operator runbook to:
    - `gcloud secrets create cdiscourse-dev-supabase-url --replication-policy=automatic`
    - `printf %s "<VALUE>" | gcloud secrets versions add cdiscourse-dev-supabase-url --data-file=-`
    - Same for `cdiscourse-dev-supabase-publishable-key`.
    - `gcloud secrets add-iam-policy-binding ... --role=roles/secretmanager.secretAccessor` for each secret, scoped to `cdiscourse-dev-runner`.
    
    HOST-001's first deploy CANNOT succeed without these secrets existing. If the operator wants to validate the Dockerfile + image build path BEFORE HOST-005 lands, run a placeholder deploy with **dummy values** in `--set-env-vars=` (not `--set-secrets=`) — but the app will fail to talk to Supabase. This is acceptable for validating the deploy pipeline alone.

### Phase 5 — First image build + deploy (HOST-004 deliverables; runbook here)

14. **Configure impersonation for the deploy session.**
    ```bash
    gcloud config set auth/impersonate_service_account cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com
    ```
15. **Verify pre-flight** (HOST-004 implements `scripts/deploy/gcloud-preflight.*`; described in plan §10.1).
    ```bash
    ./scripts/deploy/gcloud-preflight.sh   # or .ps1
    ```
16. **Build + push the image.**
    ```bash
    export COMMIT_SHA_7=$(git rev-parse --short=7 HEAD)
    export BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    export BUILD_VERSION="dev-${COMMIT_SHA_7}"
    export REGISTRY=us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web

    docker build \
      --build-arg BUILD_COMMIT_SHA=${COMMIT_SHA_7} \
      --build-arg BUILD_VERSION=${BUILD_VERSION} \
      --build-arg BUILD_TIMESTAMP=${BUILD_TIMESTAMP} \
      --build-arg EXPO_PUBLIC_DEPLOY_ENV=dev \
      --build-arg EXPO_PUBLIC_APP_URL=https://dev.cdiscourse.com \
      -t ${REGISTRY}/cdiscourse-web:dev-${COMMIT_SHA_7} \
      -t ${REGISTRY}/cdiscourse-web:dev-latest \
      .

    docker push ${REGISTRY}/cdiscourse-web:dev-${COMMIT_SHA_7}
    docker push ${REGISTRY}/cdiscourse-web:dev-latest
    ```
17. **Deploy.** Run the HOST-004 deploy script (default dry-run; `--apply` to execute). The script executes the `gcloud run deploy` command shape locked in §"Cloud Run service spec" above.
    ```bash
    ./scripts/deploy/deploy-cloud-run-dev.sh --apply
    ```
18. **Capture the service URL.**
    ```bash
    gcloud run services describe cdiscourse-dev \
      --region=us-central1 --format='value(status.url)'
    # e.g. https://cdiscourse-dev-<hash>-uc.a.run.app
    ```
19. **Smoke H1 + H2 + H3 against the bare `*.run.app` URL** (needs identity token because `--no-allow-unauthenticated`):
    ```bash
    TOKEN=$(gcloud auth print-identity-token)
    SERVICE_URL=$(gcloud run services describe cdiscourse-dev \
      --region=us-central1 --format='value(status.url)')

    # H3 — server up
    curl -fsS -H "Authorization: Bearer ${TOKEN}" "${SERVICE_URL}/healthz"
    # → expect 200 OK

    # H1 — TLS healthy
    curl -I -H "Authorization: Bearer ${TOKEN}" "${SERVICE_URL}/"
    # → HTTP/2 200, Google Trust Services chain

    # H2 — revision match
    gcloud run revisions list --service=cdiscourse-dev \
      --region=us-central1 --limit=1 \
      --format='table(metadata.name,spec.containers[0].image)'
    ```
20. **(Optional) Smoke the full HOST-003 checklist** via browser. Until HOST-007 wires IAP, this requires running a local proxy that injects the identity token (Cloud Run docs cover the `gcloud run services proxy` pattern). Once IAP is on (HOST-007), the browser hits the IAP login page and proceeds normally.

### Phase 6 — Cross-card handoff

21. **HOST-006 picks up** to add `dev.cdiscourse.com` → Cloud Run domain mapping and the GoDaddy CNAME.
22. **HOST-007 picks up** to wire IAP in front of the service.
23. **HOST-003a (smoke amendment)** picks up to fold H1 + H2 + H3 into `docs/deployment-smoke-checklist.md`.

---

## Rollback design

Cloud Run preserves every revision until the operator deletes it. Rollback is a single `update-traffic` call.

### Procedure

1. **Identify the bad revision and the last-known-good revision.**
   ```bash
   gcloud run revisions list --service=cdiscourse-dev \
     --region=us-central1 \
     --format='table(metadata.name,status.conditions[0].lastTransitionTime,spec.containers[0].image,status.conditions[0].status)'
   ```
2. **Shift 100% of traffic back to the last-known-good revision.**
   ```bash
   gcloud run services update-traffic cdiscourse-dev \
     --region=us-central1 \
     --to-revisions=<last-good-revision-name>=100
   ```
3. **Verify** via the smoke checklist (at minimum: H1 + H2 + H3 + Auth + Gallery from HOST-003).
4. **File an issue** describing what regressed in the bad revision. Link to the deploy log (HOST-004 writes one to `logs/deploy/<timestamp>-cdiscourse-dev.log` which is gitignored).
5. **Do NOT delete the bad revision** until the regression is understood. It is needed for debugging. Mark it via a Cloud Run label: `gcloud run revisions describe <name> --update-labels=status=quarantined` — or note it in the issue.

### Roll-back vs roll-forward decision matrix

| Symptom | Roll back | Roll forward |
|---|---|---|
| Smoke item A1 fails (signup broken) | YES, immediately. | After fix lands. |
| Smoke item S1 / S2 fails (secret leaked into bundle) | YES, immediately, AND rotate the leaked key per plan §7.5. | After fix lands. |
| Cold-start latency regression (acceptable but annoying) | NO — note in the issue, fix forward. | YES. |
| Plain-language regression (L1/L2/L3) — code leakage | YES if a verdict token leaked; otherwise roll forward. | YES for the snake-case regression. |
| H1 cert fail | This is upstream of revisions — rollback won't help. Investigate domain mapping + Google-managed cert status. | N/A. |
| H2 revision-mismatch (deploy didn't roll) | N/A (the new revision didn't actually deploy). | Re-run deploy with a fresh build. |
| H3 health-fail | YES, immediately, because the server.cjs never started — almost certainly a secret-binding misconfiguration. | After fix. |

### Revision preservation rules

- Keep the last 10 revisions minimum. Cloud Run holds them at no per-revision cost; the only cost is on the Artifact Registry image (~$0.10/GB-month).
- Do not delete a quarantined bad revision until at least 14 days after the regression issue closes.
- Do not delete the revision that the current rollback is pointing at (`gcloud run services update-traffic` cannot point at a deleted revision).

---

## Risks & known unknowns

| # | Risk | Monitoring signal | Mitigation |
|---|---|---|---|
| K1 | **Cold start latency** (min-instances=0). First request after idle can be 2–6 seconds. | Cloud Run "Request latencies (p99)" chart in the Cloud Console; operator anecdote during smoke. | Bump `--min-instances=1` (~$10/month) if testers complain. Plan §15 R11 — acceptable for dev. |
| K2 | **Supabase rate limits during a smoke burst.** A full smoke run (Auth + Gallery + Entry + Room) hits Supabase ~30–50 times. | Supabase dashboard → Reports → API → 429 count. | Run smoke in single-tab serial mode; raise dev project limits only if hit. Plan §15 R12. |
| K3 | **IAP propagation delay.** After HOST-007 wires IAP, new tester IAM grants can take 5–10 minutes to propagate. A fresh tester gets 403 until propagation completes. | Operator polls with `gcloud auth print-access-token` from the tester's session. | Document the propagation expectation in HOST-007's tester onboarding. HOST-001 marks the contract — the actual mitigation is HOST-007's. |
| K4 | **Google-managed cert provisioning time.** After HOST-006 maps `dev.cdiscourse.com`, the cert can take 10 minutes to 24 hours to issue. During provisioning the bare cloud-run URL works but the custom domain serves a `Cloud Run is not configured to serve traffic on this URL` page. | Cloud Run console → Domain Mappings → status. | Wait. Don't announce the dev URL until cert provisions. H1 smoke item catches this. |
| K5 | **Distroless image has no shell.** `kubectl exec` / `docker exec sh` won't work. Debugging requires `gcloud logging read` for app logs and `gcloud run revisions describe` for crash info. | Cloud Logging for runtime; deploy log for build. | Pre-publish a known-good Dockerfile that the operator can run locally for repro before pushing. HOST-004 includes a `docker run --rm -p 8080:8080 <image>` smoke step. |
| K6 | **`serve@14` supply-chain risk.** Pinning to a major-version range exposes us to a minor-version compromise. | npm audit on `serve` + lockfile. | Pin `serve` to exact version in `package.json` (`"serve": "14.2.1"` or whatever the operator-approved version is). Re-bump only on explicit security review. |
| K7 | **Build-time vs runtime env split confusion.** A future contributor bakes `EXPO_PUBLIC_SUPABASE_URL` into the bundle, breaking digest-only promotion. | Test plan item below: source-scan asserts no `EXPO_PUBLIC_SUPABASE_URL` literal in the build output that does NOT come from `window.__CDISCOURSE_RUNTIME_ENV__`. | Test + design doc + a one-line code comment at the supabase client import site (HOST-004's work). |
| K8 | **The deploy script accidentally publishes `--allow-unauthenticated`.** Service becomes world-readable before IAP lands. | Smoke H1 returns 200 WITHOUT a Bearer token. | Deploy-script refusal logic (per master plan §10.4); `--allow-public` requires double-confirm. Reviewer scans `gcloud run deploy` invocation for `--allow-unauthenticated`. |
| K9 | **Operator binds a non-dev secret to Cloud Run.** E.g. `SUPABASE_SERVICE_ROLE_KEY=...:latest`. | Deploy log's `--set-secrets=` line. | Deploy-script denylist + smoke S1/S2 + reviewer eyeball. The deploy script enumerates the allow-list of bind targets (only `EXPO_PUBLIC_*` keys permitted). |
| K10 | **Cloud Run domain mapping is "preview" per Google.** It is not GA. | Google's Cloud Run release notes. | Acceptable for dev. Prod (HOST-008) uses HTTPS LB + managed cert + serverless NEG instead. Plan §15 R10. |
| K11 | **Quota exhaustion on first deploy.** New GCP projects start with low Cloud Run quotas (e.g. 100 deploys/day, 1000 build minutes). | `gcloud run deploy` returns a quota error. | Operator requests increase via the Cloud Console. Unlikely to bite on day 1. |
| K12 | **Vertex AI confusion.** Operator follows `docs/deployment/claude-code-vertex-ai-note.md` and accidentally enables `aiplatform.googleapis.com` in `cdiscourse-host`. | Project's "APIs & Services" page. | No-op risk: enabling the API costs nothing. But if operator wires `CLAUDE_CODE_USE_VERTEX=1` thinking it affects the app, they will be confused. Note in operator runbook: Vertex AI is NOT part of HOST-001. |

---

## Test plan

HOST-001 is mostly operator-runbook + Dockerfile + scripts. Most of "done" is verified by running the smoke checklist, not by Jest. The pieces that CAN have repo-side tests:

### What's automatable in this repo's test suite

New test file: `__tests__/hostOneDockerfileContract.test.ts` (HOST-001 BUILD-phase deliverable; locked here):

- **Test 1 (5 assertions):** `Dockerfile` at repo root exists, contains the two stages, declares the locked build args (`BUILD_COMMIT_SHA`, `BUILD_VERSION`, `BUILD_TIMESTAMP`, `EXPO_PUBLIC_DEPLOY_ENV`, `EXPO_PUBLIC_APP_URL`), uses the distroless runtime base, and runs as `nonroot`.
- **Test 2 (4 assertions):** `Dockerfile` does NOT contain `--allow-unauthenticated`, does NOT reference `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `RESEND_API_KEY` / `X_BEARER_TOKEN` anywhere in any build arg, env, or comment.
- **Test 3 (3 assertions):** `Dockerfile` exposes 8080 and uses `CMD ["server.cjs"]` (or an equivalent locked entrypoint); has no `RUN curl`, `RUN wget`, or `RUN apk add` in the runtime stage; has no `LABEL` containing a literal secret-shape pattern.
- **Test 4 (3 assertions):** `scripts/deploy/server.cjs` (if it exists by the time the test runs — HOST-004 delivers it) exits non-zero when `EXPO_PUBLIC_SUPABASE_URL` is unset, never logs values for `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and serves `dist/` with `--single` SPA fallback.
- **Test 5 (2 assertions):** `scripts/deploy/serve.json` (if it exists) declares `"rewrites":[{"source":"/**","destination":"/index.html"}]` and sets the locked security headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`).
- **Test 6 (1 assertion):** The repo contains no `*.json` file matching the GCP service-account-key shape (`"type":"service_account"` + `"private_key":`).

If HOST-004's deliverables (`server.cjs`, `serve.json`, deploy scripts) are not present at the time HOST-001's BUILD phase lands, Tests 4 + 5 mark the missing files as `it.skip(...)` with a TODO referencing HOST-004. They are NOT silently dropped.

New test file: `__tests__/hostOneDevBannerWiring.test.ts`:

- **Test 7 (4 assertions):** `src/features/devEnvironment/devEnvironmentModel.ts` is unchanged by HOST-001 (asserted via source-scan; if the test fails, the implementer touched a file outside HOST-001's scope).
- **Test 8 (3 assertions):** `getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'dev' })` returns `'dev'`; `getBuildInfo({ EXPO_PUBLIC_COMMIT_HASH: 'abc1234' })` returns `{ commitHash: 'abc1234', buildVersion: null }`; `shouldShowDevBanner({ EXPO_PUBLIC_DEPLOY_ENV: 'dev' })` returns `true`. (Regression on the wiring contract — confirms HOST-002's existing functions still consume the build-arg-injected env-vars correctly.)

New test file (optional): `__tests__/hostOneRunbookStructure.test.ts`:

- **Test 9 (3 assertions):** This design doc exists; the runbook section contains the 23 numbered steps; none of the runbook steps contain `<VALUE>` as the literal placeholder (i.e. the operator runbook is self-contained — except for the documented `<OPERATOR_EMAIL>` placeholder).

### What's only verifiable via the operator runbook

Most of HOST-001's "done":

- Cloud Run service exists and serves the bundle → verified by H1 + H3 against the `*.run.app` URL.
- The deployed revision is the expected SHA → H2.
- Secret Manager binding actually loads the keys → H3 fails closed if not.
- Anonymous request returns 401/403 → `curl -I https://<cloud-run-url>` without `Authorization: Bearer` returns 403.
- No `.env*` files in the image → grep over the image filesystem (distroless makes this hard from inside; do it on `dist/` pre-build).
- No service-role / Anthropic key in the bundle → S1 + S2 on `dist/` before push.

The implementer's BUILD phase ends with an operator-runnable runbook that the operator follows step by step. The implementer must NOT execute any `gcloud` step.

---

## Cross-card contracts

### Contract → HOST-004 (deploy scripts + Artifact Registry build wiring)

HOST-004 builds `scripts/deploy/`. HOST-001 locks the script flag surface so HOST-004 has a stable target:

| Script | Flags HOST-001 requires |
|---|---|
| `gcloud-preflight.{ps1,sh}` | `--branch=<name>`, `--allow-dirty`, `--require-clean`. Exits non-zero on any check failure. Prints check summary. |
| `deploy-cloud-run-dev.{ps1,sh}` | `--apply` (default is dry-run), `--allow-dirty`, `--allow-branch=<name>`, `--allow-public` (refused-by-default), `--image-tag=<dev-sha>` (override default `dev-$(git rev-parse --short=7 HEAD)`). |
| `promote-cloud-run-prod.{ps1,sh}` | Stub only. Refuses without `--i-understand-this-is-production`. Belongs to HOST-008. |

Command shape `deploy-cloud-run-dev` calls internally (locked):

```
docker build --build-arg BUILD_COMMIT_SHA=... --build-arg BUILD_VERSION=... \
  --build-arg BUILD_TIMESTAMP=... --build-arg EXPO_PUBLIC_DEPLOY_ENV=dev \
  --build-arg EXPO_PUBLIC_APP_URL=https://dev.cdiscourse.com \
  -t us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web/cdiscourse-web:dev-<sha7> \
  -t us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web/cdiscourse-web:dev-latest .

docker push us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web/cdiscourse-web:dev-<sha7>
docker push us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web/cdiscourse-web:dev-latest

gcloud run deploy cdiscourse-dev <flags-from-Cloud-Run-spec-section>
```

The deploy script writes a log to `logs/deploy/<timestamp>-cdiscourse-dev.log` (gitignored under `logs/`). Log contents: command line **with secret values redacted to `***`**, exit code, resulting service URL, resulting revision name, resulting image digest.

The deploy script's denylist (refuses to execute if these appear anywhere in the resolved command line): `SUPABASE_SERVICE_ROLE_KEY=`, `ANTHROPIC_API_KEY=`, `XAI_API_KEY=`, `X_BEARER_TOKEN=`, `RESEND_API_KEY=`, `sk-ant-`, `xai-`, `sb_secret_`, `eyJ` (substring), `Bearer ` (substring outside `gcloud auth print-identity-token` capture).

The deploy script's allow-list for `--set-secrets=` bind targets: exactly two names, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Anything else triggers refusal.

### Contract → HOST-005 (Secret Manager migration + Cloud Run binding)

HOST-001 locks the secret names + binding shape:

| Secret name | Cloud Run env-var name | Source |
|---|---|---|
| `cdiscourse-dev-supabase-url` | `EXPO_PUBLIC_SUPABASE_URL` | Operator paste from the dev Supabase project URL. |
| `cdiscourse-dev-supabase-publishable-key` | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Operator paste from the dev Supabase project publishable / anon key. |

Binding format in the deploy command:

```
--set-secrets=EXPO_PUBLIC_SUPABASE_URL=cdiscourse-dev-supabase-url:latest,\
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cdiscourse-dev-supabase-publishable-key:latest
```

Forbidden secret names in Cloud Run binding (HOST-005's design doc must enumerate this):

```
cdiscourse-dev-service-role-key       ← NEVER
cdiscourse-dev-anthropic-api-key      ← NEVER
cdiscourse-dev-xai-api-key            ← NEVER
cdiscourse-dev-x-bearer-token         ← NEVER
cdiscourse-dev-resend-api-key         ← only if a future Edge-Function-on-Cloud-Run pattern needs it; v0 NO
```

Service-role / Anthropic / xAI / Resend keys live in Supabase Function secrets, not Cloud Run.

### Contract → HOST-006 (DNS strategy + GoDaddy record set)

HOST-001 locks the hostname target:

| Property | Value |
|---|---|
| Hostname | `dev.cdiscourse.com` |
| Mapped to | Cloud Run service `cdiscourse-dev` in `us-central1` |
| Expected CNAME target (printed by Cloud Run) | `ghs.googlehosted.com` (Google-managed cert path) |
| Apex / www | **Untouched.** No A, AAAA, or CNAME on `@` or `www`. |

HOST-006 runs `gcloud beta run domain-mappings create` (or its v1 equivalent), retrieves the CNAME target Cloud Run prints, and the operator adds it at GoDaddy. HOST-001 does NOT run that command; HOST-001's deploy stops at the `*.run.app` URL.

### Contract → HOST-007 (Dev access control — IAP)

HOST-001 leaves the service at `--no-allow-unauthenticated`. HOST-007 adds IAP in front. The contract:

| Property | Value |
|---|---|
| Service URL HOST-007 attaches IAP to | The bare `*.run.app` URL of `cdiscourse-dev` |
| Required Cloud Run service flag (set by HOST-001) | `--no-allow-unauthenticated` (so IAP IAM grants are the only path in) |
| OAuth consent screen branding inputs | Product name = `"CDiscourse Dev"`; logo = TBD by operator in HOST-007; support email = the operator's. **No mention of "verdict", "winner", "loser", "truth" in the consent text.** |
| User type | Internal vs External — operator decides in HOST-007. External requires app verification for the Google sign-in; internal limits to a Workspace. Master plan §15 R13. |
| Required IAP role | `roles/iap.httpsResourceAccessor` on the IAP resource for each tester. |

HOST-001 does NOT create the OAuth client or attach IAP. HOST-007 does. HOST-001's `--no-allow-unauthenticated` is what makes the IAP-only path the actual gate (no second world-readable path exists).

### Contract → HOST-008 (Prod promotion stub)

HOST-001 enables digest-only promotion via the build-arg vs runtime-env split. The contract HOST-008 inherits:

| Promotion property | Value |
|---|---|
| Source | A `dev-<sha7>` image digest in `us-central1-docker.pkg.dev/cdiscourse-host/cdiscourse-web` |
| Target tag | `prod-<sha7>` in the SAME repo (no separate prod repo for v0) |
| Promotion mechanism | `gcloud artifacts docker tags add <source-digest> <target-tag>` — **no rebuild** |
| Target service | `cdiscourse-prod` (does not exist in HOST-001 scope) |
| Target service env binding | `cdiscourse-prod-supabase-url`, `cdiscourse-prod-supabase-publishable-key` (separate Supabase project per master plan) |
| Refusal flag | `--i-understand-this-is-production` (script-level), plus prod-cutover-deferral per D9 |

HOST-008 must NEVER need to rebuild a different image for prod. If a prod-only behaviour ever needs to differ from dev, that's a feature flag or a runtime env-var — not a different image.

---

## Do NOT implement in this card

Explicit list:

- DNS records at GoDaddy (HOST-006).
- Cloud Run domain mapping (`gcloud beta run domain-mappings create ...`) (HOST-006).
- IAP attachment, OAuth consent screen, tester onboarding (HOST-007).
- Secret Manager secret creation or version-add (HOST-005 — operator-run, never agent-run).
- `cdiscourse-prod` service or any `prod-<sha7>` image (HOST-008).
- Cloud Build / GitHub Actions CI/CD pipeline (later card; manual deploy is v0).
- Cloud Armor IP allowlist (retired per D4).
- HTTPS Load Balancer (only as fallback per master plan; D6 chose direct mapping).
- Cloud DNS migration (deferred per D5).
- Supabase schema changes (none required; D10 reuses dev project).
- Supabase Edge Function deploy (P7 already passing on the existing project).
- `.env*` file read by the agent.
- Service-account JSON key file creation.
- Any production-targeting code path.
- `expo export -p web` flag set to anything other than `web`.
- A second Cloud Run service in `cdiscourse-host` for any purpose.
- Bumping the dev banner copy.
- Editing `docs/deployment-smoke-checklist.md` (HOST-003a does that).

---

## Doctrine / safety self-check

The design respects each `cdiscourse-doctrine` skill rule:

1. **Score is gameplay analysis, never truth.** Hosting card. No score / band / heat copy is added or changed. No copy of any kind in the runtime image beyond the existing Expo bundle. PASS.
2. **Heat means activity / friction.** No heat copy added. PASS.
3. **Popularity is not evidence.** No popularity / engagement copy added. PASS.
4. **AI moderator hard limits.** Cloud Run runtime is a static-file server. It calls zero AI providers. The Expo bundle running inside it also calls zero AI providers (AI calls live only in Edge Functions, which run on Supabase, not on Cloud Run). PASS.
5. **Rules engine is sacred.** `src/lib/constitution/engine.ts` is not touched. PASS.
6. **Secrets policy.** Service-role / Anthropic / xAI / X Bearer / Resend keys are explicitly denylisted in Cloud Run env + Secret Manager binding. Only `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are bound. The publishable key is safe by Supabase design. PASS.
7. **No AI calls from production app.** Cloud Run's hosted Expo bundle is "production app" for the purpose of this rule. Zero AI calls. PASS.
8. **Supabase conventions.** No migration, no RLS change, no `flags` mutation, no hard-delete of `arguments`. PASS.
9. **Plain language for users.** No new user-facing copy in this card. The dev banner copy comes from HOST-002 and is unchanged. PASS.
10. **v1 scope guards.** No voting / collaborative-editing / OAuth-login / public-API / push-notification / search added. (Note: IAP Google sign-in in HOST-007 is **not** "OAuth social login" — it's an IAM gate in front of the dev URL, not a user-account auth path. Supabase auth in the app is still email+password.) PASS.

Plus the `supabase-edge-contract` skill rules:

- **No service-role key in client code.** Not bound to Cloud Run. Not in the image. PASS.
- **No direct insert into `public.arguments` from the client.** N/A — hosting card doesn't touch DB code paths. PASS.
- **RLS always on.** Not changed. PASS.
- **Migrations append-only.** No migrations in this card. PASS.

Hard rules from the spawn prompt:

- No production deploy. PASS — `cdiscourse-prod` is HOST-008 stub.
- No DNS mutation. PASS — HOST-006 owns DNS.
- No Supabase migration. PASS.
- No Edge Function deploy. PASS.
- No `.env*` read or print. PASS.
- No `gcloud` command that mutates GCP. PASS — design contains command shapes only.
- No service-role / Anthropic / xAI / Resend in Cloud Run binding. PASS — denylisted.
- No new dependency without operator approval. PARTIAL — `serve@14` is proposed, justified, and the implementer must STOP for operator approval before `npm install`. The alternative (hand-rolled SPA-fallback static server) is also documented.
- No production-targeting code path. PASS.
- No new Supabase schema / migration / RLS. PASS.
- No new Edge Function. PASS.
- No service-account JSON files in the repo. PASS — ADC + Workload Identity only.
- No DNS records beyond the Cloud Run-printed CNAME (and that is HOST-006's surface). PASS.
- No "winner / loser / liar / verdict" UI copy. PASS — none added.

---

## Follow-up discovery issues

These came up while designing HOST-001 and would benefit from their own cards:

1. **HOST-003a — Smoke checklist amendment** (effort:s, priority:p0, release:6.8). Adds H1 (TLS), H2 (revision-match), H3 (healthz) to `docs/deployment-smoke-checklist.md` plus the Cloud Logging-based S4 verification path. Reviewer scans the resulting checklist for the doctrine-required plain-language compliance.
2. **HOST-001b — Runtime config bootstrap (`src/lib/supabaseClient.ts`)** (effort:s, priority:p0, release:6.8). Tiny seam-wiring patch so the Supabase client reads `window.__CDISCOURSE_RUNTIME_ENV__?.EXPO_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL`. Could land inside HOST-001's BUILD phase or HOST-004's BUILD phase. Designer recommendation: fold into HOST-004 because HOST-004 owns `server.cjs` (the other half of the bootstrap). If the implementer puts it in HOST-001's BUILD phase instead, that is also fine.
3. **HOST-009 — Cloud Logging-based plain-language regression alert** (effort:m, priority:p2, release:6.9). After HOST-001 + HOST-007 ship, write a Cloud Logging alerting policy that flags any rendered string in client logs containing snake_case codes or verdict tokens. This is a production-hardening item for later — not a blocker.
4. **HOST-010 — Cleanup policy on Artifact Registry** (effort:s, priority:p2, release:6.9). Once we hit ~50 deploys, switch on a `keep-tagged-revisions=20` rule so dev images don't pile up. No urgency at v0.
5. **HOST-011 — `package.json` `web:build` script** (effort:xs, priority:p0, release:6.8). Add `"web:build": "expo export --platform web --output-dir dist"` so the deploy script and local image build can call `npm run web:build` instead of inlining the Expo command. Could be folded into HOST-001 BUILD or HOST-004.
6. **HOST-012 — Reproducible `dist/` checksum gate** (effort:s, priority:p2). Hash `dist/` after build, store in the deploy log, allow rebuild verification. Belt-and-suspenders on K7.

None of these block HOST-001.

---

## Operator steps (summary — full runbook in §"Operator runbook")

Pre-build (one-time):

- Authenticate, create project, link billing, enable APIs.
- Create both service accounts + grant minimum roles.
- Create Artifact Registry repo + bind IAM.
- (HOST-005) Create the two Secret Manager secrets + bind to runtime SA.

Per deploy:

- `git rev-parse --short=7 HEAD` → SHA arg.
- `docker build` with the locked build-args.
- `docker push` to Artifact Registry.
- `gcloud run deploy cdiscourse-dev` with the locked flag set.
- `curl -fsS -H "Authorization: Bearer $(gcloud auth print-identity-token)" <service-url>/healthz` → H3.
- `curl -I -H "..." <service-url>/` → H1.
- `gcloud run revisions list ...` → H2.

The agent does **not** run any of these. The deploy script in HOST-004 wraps them. The operator runs the deploy script.

**Decision the implementer must surface BEFORE installing anything:** does the operator approve `serve@14` as a new production dependency, or should HOST-001 use a hand-rolled SPA-fallback static server instead?
