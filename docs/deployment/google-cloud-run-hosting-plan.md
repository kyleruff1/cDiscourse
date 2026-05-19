# Google Cloud Run Hosting Plan — cdiscourse.com

_Status: **PLAN + LOCKED DECISIONS** (operator confirmed 2026-05-19). No deployment scripts have been executed yet. No DNS records have been mutated. No secrets have been moved. No production deployment has happened. Implementation cards (HOST-001/004/005/006/007) target the locked decisions below._

> ## Locked decisions (2026-05-19, operator confirmation)
>
> | # | Decision | Value |
> |---|---|---|
> | D1 | GCP project ID | **`cdiscourse-host`** |
> | D2 | Region | **`us-central1`** |
> | D3 | Dev subdomain | **`dev.cdiscourse.com`** |
> | D4 | IP allowlist | **NOT used** — Cloud Armor IP allowlist path retired from active scope |
> | D5 | DNS authority | **GoDaddy stays as authority for v0** (Option A in §6); Cloud DNS migration deferred |
> | D6 | Dev access control | **IAM + IAP (Option A in §9)** — Google sign-in in front of the Supabase sign-in. No Cloud Armor IP rules. |
> | D7 | Operator public IP / CIDR capture | **N/A** — not required because D4 / D6 use IAP, not IP allowlisting |
> | D8 | Secret Manager migration execution | **Operator runs every `gcloud secrets create` / `gcloud secrets versions add --data-file=-`** when prompted by the agent. Agent never executes. Values piped from stdin; no command-line history. |
> | D9 | Production cutover timing | **Get the dev site live first** so daily changes flow to an online dev environment instead of only `localhost`. Production cutover follows after dev stabilizes. |
>
> **Effect on this plan:**
> - §9 Option B (Cloud Armor IP allowlist) is documented for completeness but **not the chosen path**. HOST-007 implements Option A (IAM + IAP) only.
> - §6 Option B (Cloud DNS migration) is deferred. HOST-006 implements Option A (GoDaddy stays + Cloud Run-printed CNAME) only.
> - Because IAP — not Cloud Armor / HTTPS LB — is the gate, **direct Cloud Run domain mapping** (no HTTPS LB, no serverless NEG) becomes the default in §4. The HTTPS LB path stays in the doc only as fallback if IAP setup hits an unexpected blocker.
> - Every script template defaults to `--project=cdiscourse-host --region=us-central1` (overridable via flags). Service names: `cdiscourse-dev` (now), `cdiscourse-prod` (deferred).
> - HOST-008 (production promotion) stays **p1 and stub-only** until dev is live and stable.

This document is the master plan for moving CDiscourse from purely-local dev onto a real hosted dev / sandbox environment on Google Cloud Run, using the existing `cdiscourse.com` domain (registered at GoDaddy) and the existing Supabase backend. It supersedes the original `HOST-001` scope (which only asked "spike `dev.cdiscourse.com` vs `cdiscourse.com/dev`") with concrete Google Cloud architecture, secret-migration discipline, and a promotion path to production.

Related cards / docs:
- Roadmap card: [`HOST-001 — Dev hosting architecture`](../ux-ui-project-board.md) (open, to be refreshed against this plan).
- Sister cards already merged: HOST-002 (dev banner), HOST-003 (smoke checklist at [`docs/deployment-smoke-checklist.md`](../deployment-smoke-checklist.md)).
- Supabase email + redirect config: [`QOL-016`](https://github.com/kyleruff1/cDiscourse/issues/40).
- Vertex AI / Claude Code note (separate scope): [`docs/deployment/claude-code-vertex-ai-note.md`](./claude-code-vertex-ai-note.md).

---

## 1. Goal

Stand up a public-internet-reachable **dev / sandbox** deployment of the CDiscourse Expo web build on Google Cloud Run, mapped to a CDiscourse-owned subdomain (default candidate: `dev.cdiscourse.com`). The dev deployment must:

- Continue using the existing Supabase project for auth + data + Edge Functions (no swap to Cloud SQL, Firestore, or Firebase Auth).
- Never expose service-role keys, AI provider keys, or any other secret in the client bundle.
- Pull non-public configuration (Supabase publishable key, etc.) at runtime from Google Secret Manager via Cloud Run secret bindings — never from a committed `.env*` file.
- Show the existing dev banner (HOST-002) and pass the smoke checklist (HOST-003).
- Leave a clean promotion path to `cdiscourse.com` / `www.cdiscourse.com` for production, with **no DNS cutover and no production deploy in this plan**.

**Out of scope for this plan**: production cutover, Cloud SQL adoption, Firebase Hosting, paid Cloud Armor tiers beyond the minimum needed for an IP allowlist, Cloud Build/GitHub Actions CI/CD (a manual deploy script is the first deliverable; CI is a later card).

---

## 2. Current app assumptions

The plan assumes the following about the current repo state, all of which are observable from `main` at commit `904143e` and from prior status entries:

- **Client**: Expo React Native app (`App.tsx`, `src/`) targeting iOS / Android via Expo, and producing a web bundle via Expo Web for browser deployment. `package.json` already carries the Expo + RN tooling.
- **Backend**: Supabase project (the operator owns the project ref). Tables have RLS enabled. Edge Functions live under `supabase/functions/*` and are deployed via `npx supabase functions deploy <name> --linked`.
- **Public client env vars** (safe in the bundle):
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon / publishable; safe by Supabase design)
- **Secret env vars** (never in client, never in repo, Edge Functions only):
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - any xAI / X Bearer keys used by operator-gated bot fixtures
  - `RESEND_API_KEY` (admin email)
- **Local secrets layout**: per operator, the keys are in gitignored `.env*` files at the repo root. The plan **treats this as plausible but unverified** — see §7 for the inventory-only audit.
- **Active branch policy**: PRs are merged to `main`; release labels (`release:6.5` … `release:6.8`) signal which sprint a card belongs to; Project #1 (UX/UI Roadmap) tracks status with Status / Priority / Effort / Epic / Release fields.

---

## 3. Environment topology

| Environment | Purpose | URL (proposed) | Supabase project | Auth gating | Deployment trigger |
|---|---|---|---|---|---|
| **local** | Developer laptop | `http://localhost:8081` (Expo dev server) | Dev Supabase project | None | `npm start` |
| **dev / sandbox** | Public-internet sandbox for ad-hoc operator testing + invited external testers | `https://dev.cdiscourse.com` (recommended) — fallback `https://sandbox.cdiscourse.com` | **Same dev Supabase project** as local for v0; consider separate Supabase project once external testers begin posting | **Authenticated Cloud Run invoker** OR **Cloud Armor IP allowlist** — see §9 | Manual operator-run `deploy-cloud-run-dev` script |
| **prod** | Production app | `https://cdiscourse.com` + `https://www.cdiscourse.com` (alias) | **Separate prod Supabase project** (new project, not yet created) | Public | Manual operator-run `promote-cloud-run-prod` script (stub only in this plan) |

The dev and prod Cloud Run services live in the **same GCP project** for v0 simplicity, separated by service name, service account, and Secret Manager secret names. Splitting into two GCP projects (`cdiscourse-dev`, `cdiscourse-prod`) is a later hardening card.

---

## 4. Recommended Google Cloud architecture

```
                     ┌────────────────────────────────────────┐
                     │             GoDaddy DNS                │
                     │  cdiscourse.com (A / CNAME records)    │
                     └──────────────────┬─────────────────────┘
                                        │
                                        ▼
                    ┌──────────────────────────────────────────┐
                    │  Google-managed TLS cert (Cloud Run      │
                    │  domain mapping OR HTTPS Load Balancer)  │
                    └──────────────────┬───────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────┐
        │                                                         │
        ▼ direct domain-mapping path                               ▼ Load Balancer + Cloud Armor path
┌─────────────────────────┐                          ┌─────────────────────────────────────┐
│ Cloud Run               │                          │ HTTPS LB → serverless NEG → Cloud   │
│ Service:                │                          │ Run service. Cloud Armor policy     │
│   cdiscourse-dev        │                          │ attached at the LB backend service. │
│ Service Account:        │                          └────────────────┬────────────────────┘
│   cdiscourse-dev-runner │                                           │
│ Ingress: internal-and-  │                                           │
│   cloud-load-balancing  │                                           │
│   (LB path) OR all      │                                           │
│   (direct mapping path) │◀──────────────────────────────────────────┘
│ Secrets mounted from    │
│ Secret Manager refs     │
└──────┬────────┬─────────┘
       │        │
       │        │
       ▼        ▼
┌─────────────┐ ┌─────────────────────────────────────────┐
│ Artifact    │ │ Existing Supabase project (REST + Auth  │
│ Registry    │ │ + Edge Functions). Service-role key     │
│ (Docker     │ │ stays in Supabase Function secrets,     │
│ images)     │ │ never in Cloud Run.                     │
└─────────────┘ └─────────────────────────────────────────┘
```

### 4.1 Components and their roles

- **Artifact Registry** — a single Docker repository (`us-central1-docker.pkg.dev/<PROJECT>/cdiscourse-web`) holding image revisions. Tagging strategy:
  - `dev-<git-sha-7>` — every dev deploy.
  - `dev-latest` — moving pointer at the most recent dev image (convenience only; deploys reference the SHA tag).
  - `prod-<git-sha-7>` — created only by the prod promotion script, which copies a dev image digest to a prod tag.
- **Cloud Run service `cdiscourse-dev`** — runs the Expo web build behind a tiny Node static server (or `nginx` in the container — chosen at build time). One revision per deploy. Initial config:
  - Region: **`us-central1`** (lowest-cost, supports both direct domain mapping and serverless NEG). Operator decision: confirm or override.
  - CPU: 1, Memory: 512 MiB, Min instances: 0, Max instances: 4 (dev only — keep cold-start cost minimal).
  - Concurrency: 80 (Cloud Run default).
  - Service account: `cdiscourse-dev-runner@<PROJECT>.iam.gserviceaccount.com`. **Not the Compute Engine default SA.**
  - Ingress: depends on §9 decision. Default until the decision lands: `--ingress=internal-and-cloud-load-balancing` (Load Balancer path) — refuses direct internet hits.
  - Auth: depends on §9. Default until decision: `--no-allow-unauthenticated`.
- **Cloud Run service `cdiscourse-prod`** — **not created in this plan**. Designed identically to dev with: region match, separate service account `cdiscourse-prod-runner`, separate Secret Manager secrets (prefix `cdiscourse-prod-*`), min instances ≥ 1 (warm), ingress `all`, auth `--allow-unauthenticated`.
- **Secret Manager** — the **only** place secrets live outside the operator's laptop. Naming convention:
  - `cdiscourse-dev-supabase-url` (the dev Supabase project URL; not technically secret but versioned for parity with prod)
  - `cdiscourse-dev-supabase-publishable-key`
  - `cdiscourse-dev-resend-api-key` (only if admin email is wired into the dev Cloud Run service, which it probably is not — admin email today lives in the Edge Function)
  - Prod parallels: `cdiscourse-prod-*`
  - Service-role / Anthropic / xAI keys **do not** appear in Cloud Run Secret Manager bindings. They remain in Supabase Function secrets (which is where the Edge Functions read them from).
- **Service accounts** — per environment:
  - `cdiscourse-dev-runner` — Cloud Run runtime SA. Grants: `roles/secretmanager.secretAccessor` (limited to `cdiscourse-dev-*` secrets), `roles/logging.logWriter`, `roles/monitoring.metricWriter`.
  - `cdiscourse-deployer` — used by operator/Cloud Build when deploying. Grants: `roles/run.admin`, `roles/iam.serviceAccountUser` on the runtime SAs, `roles/artifactregistry.writer`.
- **DNS** — GoDaddy initially. See §6.
- **HTTPS Load Balancer + serverless NEG + Cloud Armor** — only if the §9 decision is "IP allowlist". Otherwise dev uses direct Cloud Run domain mapping or an authenticated invoker on the bare `*.run.app` URL.
- **Supabase** — untouched by this plan. Configuration changes in Supabase (allowed redirect URLs, site URL) are operator-run steps in §8.

---

## 5. Domain strategy

### Why `dev.cdiscourse.com`, not `cdiscourse.com/dev`

- **Cloud Run domain mapping maps a domain to `/`**, not to a path prefix. There is no `cdiscourse.com/dev → service` mapping in Cloud Run. Achieving a `/dev` path would require an HTTPS Load Balancer with a URL map rewriting `/dev/*` to the dev backend, **plus** a separate backend for `/` (currently empty — production not yet deployed). That is more moving parts than the dev environment needs.
- **Expo web's base path** must be configured at build time. A subpath (`/dev`) adds risk to every static-asset path, every router path, and every SPA refresh fallback. A subdomain has none of those problems.
- **TLS** is simpler on a subdomain: one Google-managed cert per subdomain via Cloud Run domain mapping, no shared cert chain to manage.
- **Production cutover** is cleaner: `cdiscourse.com` and `www.cdiscourse.com` are reserved until the prod service is ready; dev users do not get bookmarks that conflict with prod URLs.

**Recommendation**: use `dev.cdiscourse.com` for v0. If the operator has a strong preference for `sandbox.cdiscourse.com` (less "real-looking" to external testers), use that instead — both work identically. Do not attempt `cdiscourse.com/dev` for v0.

`cdiscourse.com` (apex) and `www.cdiscourse.com` are **reserved** until the production card runs. No DNS records pointing them at any service in this plan.

---

## 6. DNS strategy

Two paths, presented as a deferred decision. Both keep GoDaddy as the registrar. Either path needs the operator to add DNS records by hand at GoDaddy's DNS control panel.

### Option A — Keep GoDaddy as DNS authority (recommended for v0)

- GoDaddy continues to serve the authoritative nameservers for `cdiscourse.com`.
- Operator adds records at GoDaddy's "DNS Management" page:
  - For Cloud Run **direct domain mapping**: Cloud Run displays the required CNAME / A / AAAA records after the domain is verified. Typically a CNAME at `dev` pointing to `ghs.googlehosted.com`.
  - For Cloud Run + **HTTPS Load Balancer** (the Cloud Armor / IP allowlist path): an A record at `dev` pointing to the LB's reserved global static IP, plus a CAA record permitting `pki.goog` to issue the Google-managed cert (optional but recommended).
- Pros: zero migration risk, GoDaddy DNS is already operational.
- Cons: split-brain risk — GCP infra and DNS records live in two different control panels; the operator has to remember to update GoDaddy whenever a Cloud Run mapping changes.

### Option B — Migrate DNS authority to Cloud DNS

- Operator creates a Cloud DNS managed zone for `cdiscourse.com`, then changes the nameservers at GoDaddy from GoDaddy's defaults to the four Cloud DNS nameservers.
- All DNS records (apex, www, dev, MX for email, TXT for SPF/DKIM, etc.) live in Cloud DNS.
- Pros: single control plane, easier scripting, faster propagation when changing records.
- Cons: any existing GoDaddy-side mail / verification records (Google Workspace TXT verifications, MX for whatever email provider, Microsoft 365 verifications, etc.) must be **fully inventoried and recreated in Cloud DNS before** the nameserver switch. Mistakes here can break email delivery for the domain.

**Recommendation**: stay on Option A for HOST-001 / dev launch. Revisit Option B as its own card (`HOST-006` proposed) once production cutover is on the table.

### What this plan will NOT do

- Will not change any DNS records on cdiscourse.com.
- Will not switch nameservers.
- Will not issue any TLS certificate.
- Will not verify domain ownership in GCP.

All of those are **operator-run manual steps** documented in §11.

---

## 7. Secret migration plan

The operator's claim is that all app keys live only in gitignored local `.env*` files. The migration plan treats that as a **starting assumption** but verifies it before relying on it.

### 7.1 Inventory-only audit (names only, never values)

These commands the operator runs locally. The agent **does not** read `.env*` contents. Output that the operator may share back is **only key names**, with values redacted to `***`.

```powershell
# In repo root. Lists key names from local .env files.
Get-Content -ErrorAction SilentlyContinue .env*, .env.*    | `
  Select-String -Pattern '^[A-Z][A-Z0-9_]*='            | `
  ForEach-Object { ($_ -split '=')[0] }                 | `
  Sort-Object -Unique
```

```bash
# Bash equivalent.
grep -hE '^[A-Z][A-Z0-9_]*=' .env .env.* 2>/dev/null \
  | cut -d= -f1 | sort -u
```

The operator should verify the resulting list contains only expected names:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (only if present locally for migrations — should NOT be in any client `.env`)
- `ANTHROPIC_API_KEY`
- `XAI_API_KEY`, `X_BEARER_TOKEN` (operator-gated bot fixtures only)
- `RESEND_API_KEY` (admin email)

If any **unexpected** names appear (e.g. AWS keys, Stripe keys, GitHub tokens) the operator must investigate before migrating. The agent should not be told the values.

### 7.2 History-leak audit

Before deciding whether to rotate, confirm the keys were never committed historically.

```bash
# Search the entire git history for token-shaped patterns.
git log --all -p \
  | grep -nE 'ANTHROPIC_API_KEY=|sk-ant-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{20,}|sb_secret_|SUPABASE_SERVICE_ROLE_KEY=|eyJ[A-Za-z0-9_-]{20,}\.|Bearer [A-Za-z0-9._-]{16,}' \
  | head -50
```

Also check:
- GitHub Issues + PR descriptions + comments on `kyleruff1/cDiscourse`.
- Screenshots in `docs/testing-runs/` for visible keys.
- Discord / Slack / email threads where the operator may have pasted a key.

If history is clean **and** no public exposure is found, **do not rotate**. Rotation is only required when there is concrete evidence of exposure outside the operator's laptop.

### 7.3 Move to Google Secret Manager

The operator runs these commands. The agent does **not** run them — the agent has no way to receive secret values without printing them, and operator-run gives them control of input.

```bash
# One-time per secret. PIPING THE VALUE FROM stdin AVOIDS COMMAND-LINE HISTORY.
gcloud secrets create cdiscourse-dev-supabase-url \
  --replication-policy=automatic --project=<PROJECT_ID>

printf %s "<VALUE>" \
  | gcloud secrets versions add cdiscourse-dev-supabase-url \
      --data-file=- --project=<PROJECT_ID>

# Repeat for every secret. Use --data-file=- with stdin, NEVER --data-file=.env.
```

After every `gcloud secrets versions add`, the operator immediately runs `Clear-History` (PowerShell) or `history -c` (bash) and clears the clipboard.

### 7.4 Bind secrets to Cloud Run

Cloud Run can read secrets either as environment variables or as files mounted under `/secrets/`. We use the **env-var** binding for simplicity:

```bash
gcloud run services update cdiscourse-dev \
  --region=us-central1 \
  --set-secrets=EXPO_PUBLIC_SUPABASE_URL=cdiscourse-dev-supabase-url:latest,\
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cdiscourse-dev-supabase-publishable-key:latest
```

**Important**: the publishable / anon key is safe to embed in the Expo web bundle. We route it through Secret Manager anyway so that the build-time vs runtime-config distinction is consistent across dev and prod and so the Cloud Run service account is the only thing with secret access.

Service-role / Anthropic / xAI keys **never** get bound to the Cloud Run service. They live in Supabase Function secrets:

```bash
# Operator-run. NOT done by the hosting plan.
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=*** --project-ref <DEV_PROJECT_REF>
```

### 7.5 Rotation criteria

Rotate a key if and only if:
- The history-leak audit (§7.2) finds it in a public commit, PR comment, or issue body.
- A screenshot in `docs/testing-runs/` shows a key.
- The key has appeared in any external chat, paste service, or log shipped off-laptop.
- The key is over **90 days old** for Anthropic / xAI / Resend (vendor best practice). Supabase publishable keys do not rotate; Supabase service-role keys can be rotated via the Supabase dashboard.

Rotation procedure: generate a new key in the vendor dashboard, add a new Secret Manager version (`gcloud secrets versions add ... --data-file=-`), update Cloud Run to reference `:latest`, verify, then **disable** (not delete) the old version (`gcloud secrets versions disable <version-id>`). Keep two versions live during the rollover.

### 7.6 Hard rules

- Agent **never** reads `.env*` values.
- Agent **never** prints a secret value.
- Agent **never** runs `gcloud secrets versions add`.
- Operator **never** pastes a secret value into the Claude chat.
- The `.env*.example` file in the repo contains key names only with empty placeholders. Safe to commit.

---

## 8. Supabase integration plan

The Supabase project is **not** migrated, replaced, or schema-changed by this plan. All changes are operator-run dashboard config edits.

### 8.1 Site URL + redirect URLs

Supabase Auth needs to know what origins are allowed to send users back after email confirmation, OAuth, magic-link, password reset, etc.

In the Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL** → leave at production URL once prod exists; for v0, **set to `https://dev.cdiscourse.com`**.
- **Additional Redirect URLs** → add:
  - `https://dev.cdiscourse.com/**`
  - `http://localhost:8081/**` (preserve local dev)
  - `http://localhost:19006/**` (Expo web alt port)

Operator must save these in the dashboard. **The agent does not edit Supabase config.**

### 8.2 No service-role in client

Re-affirmed:
- Client code does not import `SUPABASE_SERVICE_ROLE_KEY`.
- Cloud Run runtime does not have access to the service-role key.
- The service-role key lives only in Supabase Function secrets, used by Edge Functions.
- `submit-argument`, `request-argument-deletion`, `admin-users`, and any other server-side write path stays an Edge Function.

The Cloud Run dev service can read the same Supabase REST URL + publishable key from Secret Manager — that is all it needs.

### 8.3 No schema change

This plan adds zero migrations. Existing `supabase/migrations/*` are left exactly as they are. If a future card needs a schema change for hosting (e.g. a `deployments` audit table), it gets its own card and migration.

### 8.4 Edge Function URL stability

Edge Functions are reachable at `https://<project-ref>.functions.supabase.co/<function-name>` regardless of where the client is hosted. Moving the client from `localhost` to `dev.cdiscourse.com` does **not** change Edge Function URLs and does **not** require redeploy. The smoke checklist (HOST-003) item P7 still applies — confirm `submit-argument` is at the post-Stage-6.2 advisory version.

---

## 9. Dev access control plan

The hardest decision in this plan: should the dev environment be **gated**, and if so, how?

### 9.1 Option A — Authenticated Cloud Run invoker (RECOMMENDED for v0)

- Cloud Run service deployed with `--no-allow-unauthenticated`.
- The runtime service account `cdiscourse-dev-runner` is granted `roles/run.invoker` on the service to permit IAM-authenticated requests.
- Operator + invited testers are granted `roles/run.invoker` on the service.
- Testers authenticate via `gcloud auth print-identity-token` (CLI / `curl` testing) or via IAP (Identity-Aware Proxy) for browser access — IAP is the canonical browser-friendly path.
- Pros: no IP allowlist drama. Pulling a tester off the list is one IAM revoke. Free-tier IAM, no Cloud Armor cost.
- Cons: testers need a Google identity, and IAP requires HTTPS Load Balancer + a Google sign-in page in front of the app. The CDiscourse app itself uses Supabase auth — IAP adds a **second** sign-in step before the app loads. Acceptable for an invite-only sandbox.

### 9.2 Option B — Cloud Armor IP allowlist via HTTPS Load Balancer + serverless NEG

- Cloud Run service deployed with `--ingress=internal-and-cloud-load-balancing` and `--allow-unauthenticated` (the LB is the gate, not Cloud Run IAM).
- HTTPS Load Balancer with a serverless NEG pointing at the Cloud Run service.
- Cloud Armor security policy attached to the LB's backend service:
  - Default rule: `deny(403)` for all sources.
  - Allow rule: `priority=1000`, `expression="inIpRange(origin.ip, '<OPERATOR_CIDR>')"`, action `allow`.
- The operator's public IP is captured at policy-creation time. Do **not** hardcode an IP guessed by the agent.
- Pros: no Google sign-in on top of Supabase sign-in. Testers don't need a Google identity — just their machines on an allowlisted IP / CIDR.
- Cons: home-ISP IPs change. Mobile testing requires the tester's carrier IP range, which is broader than ideal. Cloud Armor adds non-zero cost (the standard tier is small, but non-zero).

### 9.3 Decision needed

Operator must pick A or B before HOST-001 implementation begins. Default recommendation: **A (authenticated invoker via IAP)** because:
- The operator does not need to share a Google sign-in flow during early dogfooding (operator is the only tester at first).
- Adding external testers later is one IAM grant rather than asking each one for their IP.
- Cloud Armor's IP allow/deny works through supported load balancers/backends — for Cloud Run that means routing via the LB + serverless NEG — which means the Cloud Armor path also forces the LB build-out. Option A skips that complexity.

### 9.4 What we will NOT do

- Will not deploy with `--allow-unauthenticated` and no other gate. The dev environment must not be world-readable during v0 sandboxing.
- Will not embed a guessed IP in any config.
- Will not capture the operator's IP via a CLI side-channel.

### 9.5 Capturing the operator's public IP (Option B only)

If Option B is chosen, the operator runs this themselves:

```bash
curl -s https://api.ipify.org
# or
curl -s https://ifconfig.me
```

The operator pastes the **CIDR** (e.g. `203.0.113.42/32`) into the Cloud Armor allow rule. The agent does not see or store this value beyond the immediate edit.

---

## 10. Deployment scripts plan

Scripts live under `scripts/deploy/`. **None of them deploy production. None of them mutate DNS. None of them print secret values. All default to dry-run.**

### 10.1 `gcloud-preflight.ps1` / `gcloud-preflight.sh`

Verifies:
- `gcloud` is installed and on PATH.
- `gcloud config get-value project` returns a project ID (non-empty).
- `gcloud auth list` shows at least one active account (account name only, no tokens).
- `git status` is clean.
- Current branch matches the expected pattern (default `main`, overridable with `--branch=<name>`).
- Required env vars are set: `PROJECT_ID`, `REGION`, `SERVICE_NAME`. **Does not** read `.env*` files.

Exits non-zero on any failure. Prints a checklist summary.

### 10.2 `deploy-cloud-run-dev.ps1` / `deploy-cloud-run-dev.sh`

Pipeline:
1. Run preflight.
2. Build the Expo web bundle (`npm run web:build` or the project's equivalent — TBD at script-implementation time).
3. Build a Docker image: `docker build -t <REGISTRY>/cdiscourse-web:dev-<SHA> .`
4. Push image: `docker push <REGISTRY>/cdiscourse-web:dev-<SHA>`
5. Deploy revision: `gcloud run deploy cdiscourse-dev --image=<REGISTRY>/cdiscourse-web:dev-<SHA> --region=<REGION> --service-account=cdiscourse-dev-runner@<PROJECT>.iam.gserviceaccount.com --no-allow-unauthenticated --set-secrets=EXPO_PUBLIC_SUPABASE_URL=cdiscourse-dev-supabase-url:latest,...`
6. Print the resulting revision URL.

Default mode is **dry-run** — prints the commands that would run, does **not** execute. Set `--apply` to actually deploy.

Never grants `roles/run.invoker` to `allUsers` unless the operator passes `--allow-public` (which prints a loud red warning and requires double-confirmation).

### 10.3 `promote-cloud-run-prod.ps1` / `promote-cloud-run-prod.sh` (STUB ONLY)

Future card. Documented contract only:
- Takes a dev image digest as input.
- Re-tags as `prod-<SHA>` in Artifact Registry.
- Deploys to `cdiscourse-prod` service.
- Requires explicit `--i-understand-this-is-production` flag.
- Refuses to run if the dev image hasn't passed the smoke checklist (links to `docs/deployment-smoke-checklist.md`).

In this plan: the file exists with `exit 1; "Production promotion not yet implemented — see HOST-008"`.

### 10.4 Script safety rules

Every script must:
- Start by sourcing the preflight check. Refuse if preflight fails.
- Use named arguments / env vars only (no positional flag order).
- Default to dry-run.
- Print no secret values, ever. When echoing `gcloud --set-secrets=` lines, redact the right-hand side to `***`.
- Refuse to run if `git status` shows uncommitted changes (unless `--allow-dirty`).
- Refuse to run if the current branch is not `main` (unless `--allow-branch=<name>`).
- Refuse to run if `XAI_API_KEY` / `ANTHROPIC_API_KEY` is set in the shell environment (defensive — those should never be present during a Cloud Run deploy).
- Log to `logs/deploy/<timestamp>-<service>.log` (which is in `.gitignore`).

### 10.5 What NOT to script

- DNS changes (manual at GoDaddy).
- Supabase config changes (manual in dashboard).
- Secret value reads or writes (operator-run, never agent-run).
- Production deploy (separate card).
- Migration runs (not in this plan's scope).

---

## 11. Manual operator steps

These the operator runs once, by hand, before any of the scripts work. The agent **does not** automate these.

1. **GCP project**
   - `gcloud auth login`
   - `gcloud projects create cdiscourse-host --name=CDiscourse` (or pick an existing project ID; the agent does not invent one)
   - `gcloud config set project <PROJECT_ID>`
   - Link a billing account in the Cloud Console.

2. **Enable APIs**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com \
     iam.googleapis.com \
     iap.googleapis.com \
     compute.googleapis.com  # only if Option B / LB path
   ```

3. **Create the Artifact Registry repo**
   ```bash
   gcloud artifacts repositories create cdiscourse-web \
     --repository-format=docker --location=us-central1
   ```

4. **Create service accounts**
   ```bash
   gcloud iam service-accounts create cdiscourse-dev-runner
   gcloud iam service-accounts create cdiscourse-deployer
   # Grant minimum roles. See §4.1.
   ```

5. **Create Secret Manager secrets**
   - One `gcloud secrets create ...` per secret name in §7.3.
   - One `gcloud secrets versions add ... --data-file=-` per secret, with the value piped from stdin so it never appears on the command line.

6. **Verify domain ownership in Google Search Console**
   - Required before Cloud Run domain mapping accepts `dev.cdiscourse.com`.
   - Operator adds the TXT verification record at GoDaddy DNS.

7. **Configure Cloud Run domain mapping (Option A) OR HTTPS LB (Option B)**
   - Option A: `gcloud beta run domain-mappings create --service=cdiscourse-dev --domain=dev.cdiscourse.com --region=us-central1`. Cloud Run prints the DNS record the operator must add at GoDaddy.
   - Option B: separate LB + serverless NEG + managed cert + Cloud Armor policy creation. Documented as its own card.

8. **Add DNS records at GoDaddy**
   - Whatever Cloud Run or the LB cert issuance prints, paste into GoDaddy's DNS Management.
   - Wait for the Google-managed cert to provision (can take up to ~24 hours; typically minutes).

9. **Update Supabase**
   - Add `https://dev.cdiscourse.com/**` to Allowed Redirect URLs in the Supabase Auth dashboard.

10. **Deploy a first dev revision**
    - `./scripts/deploy/deploy-cloud-run-dev.ps1 --apply`

11. **Run the smoke checklist** at `docs/deployment-smoke-checklist.md` against `https://dev.cdiscourse.com`. Do not announce the URL until P1–P8 and the security-and-leak checks pass.

---

## 12. Test / smoke plan

This plan adds nothing new to the smoke checklist — `docs/deployment-smoke-checklist.md` already covers the right items. Specifically the new dev URL must pass:

- Pre-conditions P1 through P8 (typecheck / lint / test / skills:validate / no service-role in bundle / Supabase URL points at dev / `submit-argument` deployed at Stage 6.2+ / no `.env*` committed).
- Auth A1–A4.
- Gallery G1–G5.
- Conversation entry C1–C4.
- In-room R1–R6.
- Profile Q1–Q2.
- Plain-language L1–L3.
- Security S1–S5.

In addition this plan adds **two hosting-specific checks** to fold into HOST-003's checklist as a follow-up edit (proposed in §17):

- **H1 — TLS healthy**: `curl -I https://dev.cdiscourse.com` returns `HTTP/2 200` (or `401`/`403` if gated by IAP/Cloud Armor — which is also a pass). Cert chain is Google Trust Services. No `SSLError`, `ERR_CERT_*`, or self-signed warnings in the browser.
- **H2 — Cloud Run revision matches expected SHA**: `gcloud run revisions list --service=cdiscourse-dev --region=us-central1 --limit=1` returns a revision tagged with the deployed `dev-<SHA>` image. Confirms the deploy script actually rolled the image rather than serving a stale revision.

---

## 13. Rollback plan

Cloud Run keeps every revision until the operator deletes it. Rollback is one command:

```bash
gcloud run services update-traffic cdiscourse-dev \
  --region=us-central1 \
  --to-revisions=<previous-revision-name>=100
```

Procedure:
1. Determine the bad revision: `gcloud run revisions list --service=cdiscourse-dev --region=us-central1`.
2. Roll 100% traffic to the prior revision.
3. Verify with the smoke checklist (at minimum, sections Auth + Gallery).
4. File an issue describing what regressed in the bad revision.
5. **Do not delete** the bad revision until the regression is understood — it may be needed for debugging.

Rolling forward (re-deploying a fixed image) is preferred over `git revert + redeploy` because Cloud Run's revision history gives instant rollback while git revert requires another full build + push.

---

## 14. Cost / quota watchpoints

- **Cloud Run dev**: with min-instances 0 and Expo's small bundle, dev cost is dominated by request count and is typically well within free tier for operator-only traffic.
- **Artifact Registry**: ~$0.10/GB-month. The Expo web bundle wrapped in a slim Node container is < 200 MB. Negligible.
- **Secret Manager**: $0.06 per active secret version per month, plus access fees. ~$0.30/month for the dev secrets.
- **HTTPS Load Balancer** (Option B only): ~$18/month base for a forwarding rule, plus per-GB egress. **This is the largest single line item in Option B.**
- **Cloud Armor** (Option B only): per-policy + per-evaluation pricing. Trivial for dev traffic but non-zero.
- **Google-managed TLS**: free.
- **Domain registration at GoDaddy**: unchanged by this plan; not a GCP cost.

Set a **GCP budget alert** at $20/month for the dev project. Alert email to operator. This is a manual step in the GCP Console — Billing → Budgets & alerts.

---

## 15. Risks and decision points

Locked decisions D1–D9 are in the table at the top of this doc. Items below are operational risks that survive even after the decisions are settled.

| # | Risk / decision | Status | Notes |
|---|---|---|---|
| R1 | Subdomain choice | **LOCKED — D3** | `dev.cdiscourse.com` |
| R2 | GCP project ID | **LOCKED — D1** | `cdiscourse-host` |
| R3 | Region | **LOCKED — D2** | `us-central1` |
| R4 | Direct domain mapping vs HTTPS LB | **LOCKED — direct mapping** (consequence of D6 — IAP gate, no LB needed) | HTTPS LB stays in plan as fallback only |
| R5 | Dev access control | **LOCKED — D6** | IAM + IAP. No Cloud Armor IP rules. |
| R6 | DNS authority | **LOCKED — D5** | Keep GoDaddy for v0 |
| R7 | Dev Supabase project: reuse existing or create new | **OPEN** | Default = reuse existing dev project. Operator can flip when external testers begin posting. |
| R8 | Production cutover timing | **DEFERRED — D9** | Dev must stabilize first |
| R9 | Existing `.env*` keys ever leaked | **OPEN** | Run §7.1 inventory + §7.2 history audit before any Secret Manager migration |
| R10 | Cloud Run domain mappings are labelled **preview** by GCP and not recommended for production | Acceptable for **dev** | For prod, plan to use HTTPS LB + managed cert + serverless NEG; captured in HOST-008 design |
| R11 | Cold start latency on Cloud Run min-instances 0 | **OPEN** | Acceptable for dev. Bump min-instances to 1 (~$10/mo) only if testers complain. |
| R12 | Supabase rate limits during smoke runs | **OPEN** | Watch the Supabase dashboard during first dev smoke; raise the limit only if reached. |
| R13 | IAP OAuth consent screen branding | **OPEN** | Internal vs external user type; "CDiscourse Dev" product name; logo. Operator decides during HOST-007. |
| R14 | IAP tester onboarding cost | **OPEN** | Every tester needs a Google identity. For an invite-only sandbox this is acceptable; revisit before any wider release. |

---

## 16. Do NOT implement in this card

This plan is plan-only. The implementation card (HOST-001 refresh + any new HOST-00X cards in §17) is where code gets written. Specifically the **plan card** (the one this doc lands in) does **not**:

- Run any `gcloud` command that creates, updates, or deletes a resource.
- Push any image to Artifact Registry.
- Add or modify any DNS record at GoDaddy.
- Move any secret value into Secret Manager.
- Bind any secret to any Cloud Run service.
- Update any Supabase dashboard setting.
- Deploy any Cloud Run revision.
- Issue or renew any TLS certificate.
- Touch any `.env*` file in the repo.
- Add any production-targeting code path.

The plan card delivers only:
- This document.
- The Vertex AI note at `docs/deployment/claude-code-vertex-ai-note.md`.
- Optional script scaffolds under `scripts/deploy/` that are dry-run-only (if §10 review passes).
- Roadmap updates: refresh of HOST-001 (#27); optional new HOST-004…HOST-008 issues with proper labels + Project #1 fields.
- A status entry in `docs/current-status.md` summarizing the plan.

---

## 17. Proposed issue changes

### Refresh `HOST-001` (#27) in place

Update the body to point at this plan doc, tighten scope to "design + implementation of Cloud Run **dev** service (no prod, no DNS cutover)". Keep `priority:p0`, `effort:l`, `epic:hosting`, `release:6.8`. Keep Project #1 status `Todo` until design starts.

New acceptance criteria for HOST-001:
- Cloud Run service `cdiscourse-dev` is reachable (via IAM-authenticated invoker or Cloud Armor-allowlisted source) at `https://dev.cdiscourse.com`.
- Secret Manager secrets exist for Supabase URL + publishable key.
- Cloud Run service binds them via `--set-secrets=`.
- No `.env*` file is read at runtime by the deployed bundle.
- Smoke checklist passes against the new URL.
- No production deploy. No DNS records on the apex / www.

### New cards (only if HOST-001 alone is too large)

The agent recommends **splitting** HOST-001 into the cards below rather than leaving it as a single L-effort card, because each piece has a distinct manual-operator gate and rollback surface:

- **HOST-004 — Google Cloud Run dev deploy scripts + Artifact Registry**
  - Scope: `scripts/deploy/gcloud-preflight.*`, `scripts/deploy/deploy-cloud-run-dev.*`, `scripts/deploy/README.md`. Dry-run by default. No DNS, no domain mapping, no production.
  - Acceptance: scripts pass safety lints (no `--allow-unauthenticated` without `--allow-public` flag, no secret echoing, refuse on dirty git tree). Manual test: operator runs `--dry-run` and reviews the printed gcloud command list.
  - Labels: `priority:p0`, `effort:m`, `epic:hosting`, `release:6.8`, `area:roadmap`.

- **HOST-005 — Secret Manager migration + Cloud Run binding**
  - Scope: operator-run secret creation + version-add commands (documented, not scripted). `scripts/deploy/secrets-template.md` listing required secret names. No values, ever.
  - Acceptance: Cloud Run dev service successfully reads Supabase URL + publishable key from Secret Manager at runtime. Bundle contains no plaintext keys.
  - Labels: `priority:p0`, `effort:s`, `epic:hosting`, `release:6.8`, `area:roadmap`.

- **HOST-006 — DNS strategy for `dev.cdiscourse.com` (GoDaddy stay vs Cloud DNS migrate)**
  - Scope: documented decision + GoDaddy record set required by the chosen mapping path. Does not perform the DNS change — operator does.
  - Acceptance: `docs/deployment/dns-runbook.md` exists with both Option A and Option B record sets and a rollback procedure. The dns-runbook is followed once and `dev.cdiscourse.com` resolves to the Cloud Run domain mapping.
  - Labels: `priority:p0`, `effort:s`, `epic:hosting`, `release:6.8`, `area:roadmap`.

- **HOST-007 — Dev access control (IAM + IAP OR Cloud Armor IP allowlist)**
  - Scope: implement whichever §9 option the operator picks. If IAP: configure OAuth consent screen, attach IAP, grant testers. If Cloud Armor: provision LB + serverless NEG + Cloud Armor policy. Document operator IP capture procedure.
  - Acceptance: Anonymous browser requests to `https://dev.cdiscourse.com` return 401 / 403. Allowlisted requests return the app. Tester onboarding is a single IAM grant (Option A) or a single CIDR add (Option B).
  - Labels: `priority:p0`, `effort:m`, `epic:hosting`, `release:6.8`, `area:roadmap`.

- **HOST-008 — Prod promotion pipeline (`cdiscourse-prod`) stub + design**
  - Scope: `scripts/deploy/promote-cloud-run-prod.*` stub that refuses to run plus design doc covering separate Supabase project, separate service account, separate Secret Manager namespace, prod DNS cutover. **No production deploy.**
  - Acceptance: design doc exists; stub refuses without `--i-understand-this-is-production` flag; `cdiscourse.com` and `www.cdiscourse.com` DNS records are still unchanged.
  - Labels: `priority:p1`, `effort:l`, `epic:hosting`, `release:6.8`, `area:roadmap`.

If the operator wants a single bundled HOST-001 instead of the split, that is also workable — just understand that HOST-001 then becomes a multi-week card with multiple manual-operator gates inside it.

### Refresh HOST-003 smoke checklist

Add the two hosting-specific checks H1 (TLS) and H2 (revision match) from §12.

---

## 18. Next implementation sequence

Recommended order once this plan PR merges:

1. **HOST-001 refresh + this plan PR merge** (current card).
2. **HOST-005 — Secret Manager migration** (smallest blast radius, unblocks everything else).
3. **HOST-004 — Deploy scripts** (lets us start producing images in Artifact Registry).
4. **HOST-007 — Access control** (must land before any URL gets shared with testers).
5. **HOST-006 — DNS** (last because the operator wants to verify everything works at the bare `*.run.app` URL before mapping the subdomain).
6. **HOST-003 amendment** with H1 + H2 checks.
7. **HOST-008 — Prod stub** (no production deploy; just gets the contract in place).
8. **Production cutover card** (out of this plan's scope — gets opened only after the operator decides to go live).

Each card runs through the normal design → build → review → merge pipeline with `roadmap-designer` → `roadmap-implementer` → `roadmap-reviewer`. No card may merge without `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run skills:validate` all green, plus a clean safety-scan diff (no secrets, no token-shaped strings, no service-account JSON files).
