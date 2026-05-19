# HOST-001 — Operator runbook (first Cloud Run dev deploy)

**Card:** HOST-001 — Dev hosting architecture (Google Cloud Run + `dev.cdiscourse.com`)
**Branch:** `feat/HOST-001-dev-hosting-architecture-google-cloud-ru`
**Design:** [`docs/designs/HOST-001.md`](../designs/HOST-001.md)
**Master plan:** [`docs/deployment/google-cloud-run-hosting-plan.md`](google-cloud-run-hosting-plan.md) (especially §11)

> **The agent does NOT run any command in this runbook.** Every `gcloud`,
> `docker`, and `npm run web:build` step below is operator-runnable. The agent
> writes the templates, the runbook, and the tests. The operator chooses when
> to apply each step.

> **No production deploy. No DNS mutation. No Supabase migration. No Edge
> Function deploy.** Those land in later cards (HOST-005 / HOST-006 / HOST-007
> / HOST-008).

> **Notation:** `<OPERATOR_EMAIL>` is the operator's personal Google account
> (e.g. `kyleruff@gmail.com`). Replace it inline. Other angle-bracket tokens
> (`<COMMIT_SHA_7>`, `<REVISION_SUFFIX>`) are command output, captured into
> shell variables as you go.

---

## Phase 1 — Project + identity setup (one-time)

1. **Authenticate.** Operator runs:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

2. **Create / select the project.** Operator runs:
   ```bash
   gcloud projects create cdiscourse-host --name=CDiscourse   # only if not already created
   gcloud config set project cdiscourse-host
   gcloud config set run/region us-central1
   ```

3. **Link a billing account.** Operator opens the Cloud Console → Billing → Link
   a billing account → picks the operator's billing account. No CLI; manual UI
   step. Agent does not run this.

4. **Enable required APIs.** Operator runs:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     artifactregistry.googleapis.com \
     secretmanager.googleapis.com \
     iam.googleapis.com \
     iap.googleapis.com
   ```
   Compute API is intentionally NOT enabled — direct Cloud Run domain mapping is
   the chosen path (D6). HOST-006 enables compute later only if mapping needs
   it.

5. **Set a budget alert.** Operator opens Cloud Console → Billing → Budgets &
   alerts → Create budget → scope to `cdiscourse-host` → alert at `$20/month`
   → alert email is the operator's. Manual UI step. Agent does not run this.

6. **Create both service accounts.** Operator runs the two commands at the
   bottom of [`infra/iam/cdiscourse-dev-runner.iam.yaml`](../../infra/iam/cdiscourse-dev-runner.iam.yaml)
   and [`infra/iam/cdiscourse-deployer.iam.yaml`](../../infra/iam/cdiscourse-deployer.iam.yaml):
   ```bash
   gcloud iam service-accounts create cdiscourse-dev-runner \
     --display-name="CDiscourse dev Cloud Run runtime" \
     --description="Runtime identity for cdiscourse-dev Cloud Run service. NOT for human use. No key download." \
     --project=cdiscourse-host

   gcloud iam service-accounts create cdiscourse-deployer \
     --display-name="CDiscourse deployer (Cloud Run + Artifact Registry)" \
     --description="Used by operator-run deploy scripts. Impersonated via ADC; no key download." \
     --project=cdiscourse-host
   ```

7. **Grant the deployer SA roles.** Operator runs:
   ```bash
   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/run.admin"

   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/logging.viewer"

   # Resource-scoped: deployer can pass --service-account=cdiscourse-dev-runner@...
   gcloud iam service-accounts add-iam-policy-binding \
     cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com \
     --project=cdiscourse-host \
     --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   ```

8. **Grant the runtime SA the project-wide minimum.** Operator runs:
   ```bash
   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/logging.logWriter"

   gcloud projects add-iam-policy-binding cdiscourse-host \
     --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
     --role="roles/monitoring.metricWriter"
   ```
   `roles/secretmanager.secretAccessor` and `roles/artifactregistry.reader` are
   resource-scoped and applied in step 11 and step 13.

9. **Grant the operator → deployer impersonation role.** Replace
   `<OPERATOR_EMAIL>` with the operator's personal Google account. Operator
   runs:
   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com \
     --project=cdiscourse-host \
     --member="user:<OPERATOR_EMAIL>" \
     --role="roles/iam.serviceAccountTokenCreator"
   ```

---

## Phase 2 — Artifact Registry

10. **Create the Docker repo.** Operator runs:
    ```bash
    gcloud artifacts repositories create cdiscourse-web \
      --repository-format=docker \
      --location=us-central1 \
      --project=cdiscourse-host \
      --description="CDiscourse web container images (dev + prod)"
    ```

11. **Bind Artifact Registry IAM.** Operator runs:
    ```bash
    gcloud artifacts repositories add-iam-policy-binding cdiscourse-web \
      --location=us-central1 \
      --project=cdiscourse-host \
      --member="serviceAccount:cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com" \
      --role="roles/artifactregistry.writer"

    gcloud artifacts repositories add-iam-policy-binding cdiscourse-web \
      --location=us-central1 \
      --project=cdiscourse-host \
      --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
      --role="roles/artifactregistry.reader"
    ```

12. **Configure docker auth.** Operator runs:
    ```bash
    gcloud auth configure-docker us-central1-docker.pkg.dev
    ```

---

## Phase 3 — Secret Manager (handed to HOST-005)

13. **HOST-005 secret create + IAM binding.** HOST-005 has landed. The
    operator follows
    [`docs/deployment/host-005-secrets-runbook.md`](./host-005-secrets-runbook.md)
    (9 numbered steps) to:
    - `gcloud secrets create cdiscourse-dev-supabase-url --replication-policy=automatic --project=cdiscourse-host`
    - `gcloud secrets versions add cdiscourse-dev-supabase-url --data-file=- --project=cdiscourse-host`
      (operator types or pastes the value on stdin; Ctrl-D / Ctrl-Z+Enter).
    - Same shape for `cdiscourse-dev-supabase-publishable-key`.
    - Apply the resource-scoped `roles/secretmanager.secretAccessor` bindings
      shown at the bottom of [`infra/iam/cdiscourse-dev-runner.iam.yaml`](../../infra/iam/cdiscourse-dev-runner.iam.yaml).

    Two HOST-005 helper scripts shipped to support this step:

    - [`scripts/deploy/print-secret-commands.mjs`](../../scripts/deploy/print-secret-commands.mjs)
      prints the operator-runnable `gcloud secrets create` / `versions add` /
      IAM binding shapes from the manifest at
      [`infra/secrets/cdiscourse-dev-manifest.json`](../../infra/secrets/cdiscourse-dev-manifest.json).
      Refuses forbidden names + value-shaped literals. Stdout only; the agent
      never runs `gcloud`.
    - [`scripts/deploy/preflight-secrets.mjs`](../../scripts/deploy/preflight-secrets.mjs)
      verifies each manifest secret exists with state=ENABLED + the runtime
      SA has the secretAccessor binding. Never calls `gcloud secrets versions
      access`. Run before step 19 (`gcloud run services replace ...`).

    The agent never runs any `gcloud secrets create` /
    `gcloud secrets versions add` step. The operator passes the value via
    stdin (`--data-file=-`) so the value is never an argv literal.
    Skip this step until HOST-005 secrets are actually created — HOST-001's
    first build can be validated without secrets (see step 17).

---

## Phase 4 — First image build + push

14. **Configure impersonation for the deploy session.** Operator runs:
    ```bash
    gcloud config set auth/impersonate_service_account cdiscourse-deployer@cdiscourse-host.iam.gserviceaccount.com
    ```

15. **Pre-flight check (local).** Operator runs (no GCP calls in this step):
    ```bash
    npm run typecheck
    npm run lint
    npm run test
    npm run skills:validate
    npm run web:build:dry          # plan-only dry build
    ```
    All four must exit 0. The dry build prints "would run: npx expo export ..."
    and exits without invoking expo.

16. **Build the web bundle locally.** Operator runs:
    ```bash
    npm run web:build               # writes dist/
    ```
    or the platform wrapper:
    ```bash
    ./scripts/build/build-web.ps1   # Windows
    ./scripts/build/build-web.sh    # macOS / Linux
    ```
    Confirm `dist/` is non-empty and contains `index.html` plus the JS bundle.

17. **Build + tag the container image.** Operator runs:
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
    ```
    Image size should land under 200 MB. If it does not, inspect `dist/` for
    accidental fixture / log bloat before pushing.

18. **Push the image.** Operator runs:
    ```bash
    docker push ${REGISTRY}/cdiscourse-web:dev-${COMMIT_SHA_7}
    docker push ${REGISTRY}/cdiscourse-web:dev-latest
    ```
    Capture the digest from the second `docker push` output — promotion
    (HOST-008) operates on digest, not tag.

---

## Phase 5 — Deploy + verify

19. **Apply the Cloud Run service template.** Operator substitutes
    `<COMMIT_SHA_7>` and `<REVISION_SUFFIX>` into
    [`infra/cloud-run/cdiscourse-dev.template.yaml`](../../infra/cloud-run/cdiscourse-dev.template.yaml)
    (use a one-off scratch copy; do NOT commit the substituted file). Then:
    ```bash
    gcloud run services replace /tmp/cdiscourse-dev.yaml \
      --region=us-central1 \
      --project=cdiscourse-host
    ```
    Alternative (one-shot deploy without the YAML — flag-equivalent):
    ```bash
    gcloud run deploy cdiscourse-dev \
      --project=cdiscourse-host \
      --region=us-central1 \
      --image=${REGISTRY}/cdiscourse-web:dev-${COMMIT_SHA_7} \
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
      --set-env-vars=NODE_ENV=production,EXPO_PUBLIC_DEPLOY_ENV=dev,EXPO_PUBLIC_APP_URL=https://dev.cdiscourse.com \
      --set-secrets=EXPO_PUBLIC_SUPABASE_URL=cdiscourse-dev-supabase-url:latest,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cdiscourse-dev-supabase-publishable-key:latest \
      --labels=env=dev,commit=${COMMIT_SHA_7},card=host-001
    ```
    Refuse this step if HOST-005 secrets do not yet exist — the deploy succeeds
    but the container exits 4 ("env missing") on every cold start.

20. **Capture the service URL.** Operator runs:
    ```bash
    SERVICE_URL=$(gcloud run services describe cdiscourse-dev \
      --region=us-central1 --project=cdiscourse-host \
      --format='value(status.url)')
    echo "$SERVICE_URL"
    ```

21. **H1 + H2 smoke (TLS + revision match).** Operator runs:
    ```bash
    TOKEN=$(gcloud auth print-identity-token)
    curl -I -H "Authorization: Bearer ${TOKEN}" "${SERVICE_URL}/"
    # → HTTP/2 200, Google Trust Services cert

    gcloud run revisions list \
      --service=cdiscourse-dev \
      --region=us-central1 \
      --project=cdiscourse-host \
      --limit=1 \
      --format='table(metadata.name,spec.containers[0].image)'
    # → image tag matches dev-${COMMIT_SHA_7}
    ```

22. **(Optional) Browser smoke against the bare `*.run.app` URL.** Until IAP
    lands in HOST-007, this requires the Cloud Run identity-token proxy:
    ```bash
    gcloud run services proxy cdiscourse-dev \
      --region=us-central1 --project=cdiscourse-host --port=8080
    # then open http://localhost:8080 in the operator's browser
    ```
    Walk the [`docs/deployment-smoke-checklist.md`](../deployment-smoke-checklist.md)
    items. Stop at any failure and roll back per the design's
    "Rollback design" section.

23. **Handoff to the next card.** HOST-001 ends at the bare `*.run.app` URL
    serving the bundle behind `--no-allow-unauthenticated`. The next cards:
    - **HOST-005** — Secret Manager secret create + version add (if not done
      already).
    - **HOST-006** — `dev.cdiscourse.com` domain mapping + GoDaddy CNAME.
    - **HOST-007** — IAP attach + tester onboarding.
    - **HOST-003a** *(deferred per spawn-card; out of scope here)* — fold H1 /
      H2 / H3 smoke items into [`docs/deployment-smoke-checklist.md`](../deployment-smoke-checklist.md).

---

## Rollback

If smoke fails, operator runs:

```bash
# Find the last-known-good revision.
gcloud run revisions list \
  --service=cdiscourse-dev \
  --region=us-central1 --project=cdiscourse-host \
  --format='table(metadata.name,status.conditions[0].lastTransitionTime,spec.containers[0].image)'

# Shift 100% of traffic back.
gcloud run services update-traffic cdiscourse-dev \
  --region=us-central1 --project=cdiscourse-host \
  --to-revisions=<last-good-revision-name>=100
```

Do not delete the bad revision until the regression is understood. See
[`docs/designs/HOST-001.md`](../designs/HOST-001.md) §"Rollback design" for the
roll-back vs roll-forward decision matrix.

---

## What this runbook does NOT cover

- DNS records at GoDaddy (HOST-006).
- IAP attachment + OAuth consent (HOST-007).
- Production cutover (HOST-008).
- Cloud Build / GitHub Actions CI/CD (later card).
- Cloud Logging alerting policies (HOST-009, deferred).
- Artifact Registry cleanup policy (HOST-010, deferred).
- Reproducible `dist/` checksum gate (HOST-012, deferred).

Each of those has its own runbook section or card.
