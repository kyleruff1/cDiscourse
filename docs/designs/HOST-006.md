# HOST-006 — DNS strategy for `dev.cdiscourse.com` (GoDaddy stays as authority for v0)

**Status:** Design draft
**Epic:** Hosting
**Release:** 6.8
**Priority:** p0 / Effort: s
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/88
**Branch:** `feat/HOST-006-dns-strategy-for-dev-cdiscourse-com-goda`
**Card body snapshot:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\HOST-006.md`
**Master plan:** [`docs/deployment/google-cloud-run-hosting-plan.md`](../deployment/google-cloud-run-hosting-plan.md) §6 (DNS strategy), §11 (operator steps), §15 R10 (Cloud Run domain mappings are preview).
**Predecessor cards:**
- HOST-001 (PR #93, merged `2c5030e`) — Cloud Run service template at [`infra/cloud-run/cdiscourse-dev.template.yaml`](../../infra/cloud-run/cdiscourse-dev.template.yaml), runbook at [`docs/deployment/host-001-operator-runbook.md`](../deployment/host-001-operator-runbook.md). Phase 5 step 23 explicitly hands off to HOST-006.
- HOST-005 (PR #94, merged `70cd6b6`) — Secret Manager manifest + preflight at [`scripts/deploy/preflight-secrets.mjs`](../../scripts/deploy/preflight-secrets.mjs), runbook at [`docs/deployment/host-005-secrets-runbook.md`](../deployment/host-005-secrets-runbook.md).

**Parallel card:** HOST-007 (IAP attach + tester onboarding) is being designed in another agent at the same time. HOST-006 finishes when `dev.cdiscourse.com` resolves to the Cloud Run service and a Google-managed TLS cert is provisioned; the service is still gated by `--no-allow-unauthenticated` (anonymous browser requests get 401 / 403 from Cloud Run IAM). HOST-007 then attaches IAP on top of that URL so anonymous browser requests get redirected to a Google sign-in.

---

## Goal

HOST-006 is the **DNS records + Cloud Run domain mapping** card. It is the second-to-last card on the path to `https://dev.cdiscourse.com` being a working URL.

This card delivers the **contract + operator runbook + preflight helper + post-mapping verification helper + rollback procedure** for:

1. Verifying domain ownership of `cdiscourse.com` at Google Search Console (a TXT record added at GoDaddy).
2. Creating a Cloud Run **direct domain mapping** for `dev.cdiscourse.com` against the `cdiscourse-dev` service in `us-central1`.
3. Adding the **single new CNAME record** at GoDaddy that Cloud Run prints at mapping creation time.
4. Waiting for the Google-managed TLS cert to provision.
5. Sanity-checking from outside GCP that DNS resolves and the cert is healthy.
6. Rolling back cleanly if anything goes wrong.

GoDaddy stays as DNS authority for v0 (D5). Cloud DNS migration is **deferred**. HTTPS LB + serverless NEG + Cloud Armor is **not** used (consequence of D4 + D6).

The card delivers, and only delivers:

- `docs/deployment/host-006-dns-runbook.md` — 9-numbered-step operator runbook.
- `scripts/deploy/preflight-dns.{mjs,ps1,sh}` — pre-mapping prerequisite check (HOST-001 service healthy + HOST-005 secrets bound).
- `scripts/deploy/verify-dns-mapping.{mjs,ps1,sh}` — post-mapping DNS + TLS sanity from outside GCP.
- `__tests__/hostSixDnsRunbook.test.ts` + `__tests__/hostSixDnsHelpers.test.ts` — runbook structure + helper exit-code + source-scan tests.
- Doc edits to extend [`docs/deployment/host-001-operator-runbook.md`](../deployment/host-001-operator-runbook.md) Phase 5 step 23 hand-off and `docs/current-status.md`.

The card **does NOT** own:

- **Cloud DNS migration** — D5 deferred (Option B in master plan §6, not implemented).
- **HTTPS LB + serverless NEG + Cloud Armor** — D4 + D6 ruled out for v0.
- **IAP attachment / OAuth consent screen / tester onboarding** — HOST-007.
- **Any DNS records for apex `cdiscourse.com` or `www.cdiscourse.com`** — D9 reserves these for prod (HOST-008 stub).
- **Any DNS records other than `dev.cdiscourse.com`** plus the TXT verification record Google Search Console requires.
- **Mail / MX / SPF / DKIM / DMARC records.** Runbook step 2 has the operator snapshot the existing zone and explicit "do-not-touch" list mentions every existing record family.
- **Prod parallels** (`cdiscourse.com` apex domain mapping, `www` CNAME) — HOST-008 stub-only.
- **Cloud Run service spec changes** — `infra/cloud-run/cdiscourse-dev.template.yaml` is HOST-001 territory; HOST-006 reads it but does not modify it.
- **Any modification** to `src/lib/supabase.ts`, `scripts/runtime/server.mjs`, `scripts/build/inject-runtime-env.*`, `infra/secrets/*`, `scripts/deploy/print-secret-commands.*`, or `scripts/deploy/preflight-secrets.*`.

Doctrine constraints that shape this design (per `cdiscourse-doctrine` + master plan §16):

- **Agent never executes any DNS change.** Helpers print or verify; operator clicks at GoDaddy.
- **Agent never executes any mutating `gcloud` command.** Helpers may invoke read-only `gcloud run services describe`, `gcloud beta run domain-mappings describe`, `gcloud secrets describe` only via the same `spawnSync('gcloud', …)` pattern HOST-005's preflight uses. Mutating commands (`create`, `update`, `delete`) appear only as printed shapes the operator pastes.
- **No service-role / Anthropic / xAI / X / Resend keys involved.** No secret values appear anywhere in the diff. No `.env*` is read.
- **No new dependency.** Node built-ins only (`node:dns`, `node:https`, `node:tls`, `node:child_process`, `node:fs`, `node:path`).
- **No service-account JSON files in the repo.**
- **No UI surface / no doctrine-touching copy.** Pure ops plumbing card.

---

## Locked decisions inherited (operator 2026-05-19)

These are NOT open. The design assumes them. If the implementer wants to challenge one, surface as an explicit "Design challenges decision Dx" item and stop.

| # | Decision | Value |
|---|---|---|
| D1 | GCP project ID | **`cdiscourse-host`** |
| D2 | Region | **`us-central1`** |
| D3 | Dev subdomain | **`dev.cdiscourse.com`** |
| D5 | DNS authority | **GoDaddy stays as authority for v0.** Cloud DNS migration deferred. |
| D6 | Dev access control | **IAM + IAP.** Direct Cloud Run domain mapping (no HTTPS LB, no serverless NEG, no Cloud Armor). |
| D8 | Operator runs every mutating `gcloud` / GoDaddy change | Agent never executes. |
| D9 | Production cutover timing | Deferred. Apex (`cdiscourse.com`) and `www.cdiscourse.com` records stay unmodified. |

**Consequences for this design:**

- HOST-006 uses `gcloud beta run domain-mappings create` against the existing Cloud Run service. Not `gcloud compute …`. The Compute API stays unenabled (HOST-001 Phase 1 step 4 deliberately did not enable it).
- The only DNS change is **two new records** at GoDaddy: the TXT verification record + the CNAME for `dev`. Every existing record is preserved.
- Cloud Run domain mappings are labelled **preview** by GCP (master plan R10). This is acceptable for **dev**. For prod, HOST-008 will plan an HTTPS LB + serverless NEG + managed cert path; that is out of scope here.
- Anonymous browser hits to `https://dev.cdiscourse.com` after HOST-006 lands will receive 401 / 403 because HOST-001 deployed with `--no-allow-unauthenticated`. **This is the expected pass state for HOST-006.** HOST-007 changes that to a Google sign-in redirect (302) once IAP is attached.

---

## Domain mapping path decision

### Chosen: direct Cloud Run domain mapping

`gcloud beta run domain-mappings create --service=cdiscourse-dev --domain=dev.cdiscourse.com --region=us-central1 --project=cdiscourse-host`

Cloud Run provisions a Google-managed TLS cert against the mapped domain automatically once DNS resolves. The mapping renders one CNAME target (typically `ghs.googlehosted.com`, but read from the gcloud output rather than hardcoded — the target is part of the command's stdout). The operator pastes that CNAME at GoDaddy.

### Why this is correct for v0

- **D6 (IAM + IAP)** is the access gate. IAP can attach directly to a Cloud Run service with a domain mapping — no HTTPS LB needed. Adding an LB would add ~$18/month base cost (master plan §14) and double the moving parts for zero v0 benefit.
- **D4 (no IP allowlist)** rules out the Cloud Armor + LB path entirely. Cloud Armor IP allow rules attach only to HTTPS LB backend services, never to a Cloud Run domain mapping. Skipping Cloud Armor means skipping the LB.
- The Compute Engine API stays unenabled (HOST-001 Phase 1 step 4). Direct domain mapping needs only `run.googleapis.com` (already enabled) and the operator's prior Search Console domain verification.

### Why we are NOT using HTTPS LB + serverless NEG

- D4 + D6 already ruled out the Cloud Armor / LB path.
- Cost: ~$18/month base for the forwarding rule (master plan §14). Dev does not warrant that.
- Operational surface: the LB adds reserved global static IP, URL map, target HTTPS proxy, SSL cert object, backend service, serverless NEG, and (optionally) Cloud Armor policy. Six additional resources, each with their own IAM and CRUD surface. Direct domain mapping is one resource.
- Future option: HOST-008 (prod) will revisit this path. The master plan §15 R10 captures that Cloud Run domain mappings are labelled preview by GCP and not recommended for prod; for `cdiscourse.com` apex, HOST-008 will plan the LB path. HOST-006 does not prejudge that decision.

### Preview-label caveat (R10)

Cloud Run domain mappings are labelled "preview" by GCP. Acceptable for **dev**. Risks: GCP may change the API shape or deprecate the resource type. Mitigation: HOST-008 plans the prod-grade alternative (HTTPS LB + managed cert + serverless NEG). HOST-006 isolates the dev path so a future migration to LB does not break HOST-001 / HOST-005 contracts.

---

## DNS records to add at GoDaddy

**Two new records.** The runbook adds these one at a time, with verification between each.

### Record 1 — Google Search Console domain ownership verification (TXT)

Required by Google before Cloud Run accepts the `--domain=dev.cdiscourse.com` mapping. The operator runs the domain-verification flow at Google Search Console **for the apex `cdiscourse.com`** (verifying the apex verifies all subdomains, including `dev`). Search Console prints the exact TXT record value at the verification step — the runbook captures it verbatim, does not hardcode it.

| Field | Value |
|---|---|
| Type | `TXT` |
| Host / Name | `@` (apex) |
| Value | `google-site-verification=<TOKEN_FROM_SEARCH_CONSOLE>` |
| TTL | `600` seconds (10 min) |

**Notes:**

- The Search Console TXT record stays after verification (Google re-verifies periodically). It does **not** point any traffic anywhere — it is a string of bytes Google reads via DNS to confirm ownership. Removing it later breaks verification.
- Many GoDaddy zones already have a `google-site-verification=...` TXT at apex from prior Google services (Workspace, Search Console, etc.). If an existing one is present, the runbook step has the operator **add a second** (one TXT record per Google service is allowed) rather than replace.
- This is the **only** TXT record HOST-006 adds. SPF / DKIM / DMARC records are not touched.

### Record 2 — `dev.cdiscourse.com` CNAME pointing at the Cloud Run mapping target

Cloud Run prints the target at the `gcloud beta run domain-mappings create` step. **The target is read from the gcloud output, not hardcoded.** As of 2026-05 the value is typically `ghs.googlehosted.com.` (trailing dot indicates a fully-qualified name); the runbook captures it from gcloud stdout.

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host / Name | `dev` |
| Value | `<TARGET_FROM_GCLOUD>` (typically `ghs.googlehosted.com`) |
| TTL | `300` seconds (5 min) |

**Notes:**

- Low TTL (300s) during initial setup so propagation iteration is fast. After 30 days of stability, the operator may raise to 3600s; this is documented but not required by HOST-006.
- A CNAME record's host name cannot have any sibling records (RFC 1034 §3.6.2). `dev` must not already have an `A`, `AAAA`, `TXT`, or `MX` record at GoDaddy. The runbook step 2 (snapshot existing zone) catches a conflict; runbook step 5 (add CNAME) refuses to proceed if a sibling record exists at `dev`.
- The CNAME does **not** belong on the apex (`@`) — apex CNAMEs are illegal under RFC 1035 (some DNS providers offer ALIAS / ANAME workarounds but GoDaddy does not). `dev.cdiscourse.com` is a subdomain, so a CNAME is legal here.

### Explicit "do-not-touch" list

The runbook explicitly tells the operator NOT to add, edit, delete, or otherwise modify any of these existing GoDaddy records:

- **Apex `A` / `AAAA`** — reserved for production (`cdiscourse.com`), HOST-008.
- **`www` `CNAME`** — reserved for production, HOST-008.
- **`MX` records** — preserve email delivery for `cdiscourse.com`.
- **Existing `TXT` at apex** for SPF (e.g. `v=spf1 ...`).
- **DKIM `TXT`** records at any `_domainkey` selector subdomain.
- **DMARC `TXT`** record at `_dmarc.cdiscourse.com`.
- **Any existing Google Site Verification `TXT`** — operator adds a new one alongside, never replaces.
- **Any other `TXT`** verification record (Microsoft 365, Atlassian, Notion, etc.).
- **`CAA`** records, if any (Google Trust Services issues the dev cert; if a CAA record exists and excludes `pki.goog`, the cert provisioning fails — runbook step 4 verification catches this).
- **Any record at `dev`** — runbook step 5 refuses if a sibling record exists at `dev`.

The runbook has the operator perform a **before snapshot** of the entire GoDaddy zone (step 2) before any change. The snapshot doubles as the rollback baseline.

---

## Cloud Run domain mapping command shape

### Create

The operator pastes this command (substituting nothing — every value is a locked decision):

```bash
gcloud beta run domain-mappings create \
  --service=cdiscourse-dev \
  --domain=dev.cdiscourse.com \
  --region=us-central1 \
  --project=cdiscourse-host
```

Flag rationale:

- `--service=cdiscourse-dev` — locked by D1 / HOST-001.
- `--domain=dev.cdiscourse.com` — locked by D3.
- `--region=us-central1` — locked by D2.
- `--project=cdiscourse-host` — locked by D1.
- No `--force-override` / `--platform=managed` flag — `--platform=managed` is the default for `run` subcommands when the `run/platform` config is unset; the runbook explicitly notes this.
- No `--quiet` flag — operator wants to see the printed CNAME target.

### Verify

```bash
gcloud beta run domain-mappings describe \
  --domain=dev.cdiscourse.com \
  --region=us-central1 \
  --project=cdiscourse-host \
  --format='yaml(spec.routeName,status.resourceRecords,status.conditions,status.url)'
```

Output fields the operator captures:

- `spec.routeName` → must be `cdiscourse-dev` (sanity check).
- `status.resourceRecords[]` → the array of records to add at GoDaddy. Typically a single `{ rrdata: "ghs.googlehosted.com.", type: "CNAME", name: "dev.cdiscourse.com" }`. **The runbook reads the target from this output; it does NOT hardcode `ghs.googlehosted.com`.**
- `status.conditions[]` → array including `CertificateProvisioned`. Initially `status: Unknown` with `reason: ProvisioningCert`; transitions to `status: True` once DNS resolves and cert mints.
- `status.url` → the served URL once everything is healthy.

The `verify-dns-mapping.mjs` helper documented below automates the post-step sanity check using `dns.resolveCname` + an HTTPS HEAD; the operator still uses `gcloud beta run domain-mappings describe` for the cert-status diagnostic.

---

## TLS cert provisioning

### How it works

Cloud Run's `domain-mappings` resource auto-provisions a **Google-managed TLS cert** the moment DNS resolves to the printed target. There is no separate `gcloud compute ssl-certificates …` step. The cert is issued by **Google Trust Services** (the `GTS CA 1C3` intermediate is current as of 2026-05).

### Expected wait time

- **Minutes** in the typical case. Once DNS propagates to Google's resolvers, cert issuance is near-instant.
- **Up to ~24 hours** documented worst case (per GCP docs). If `status.certificate` stays `ProvisioningCert` for more than 30 minutes, the most likely cause is DNS not propagating yet — the helper at `verify-dns-mapping.mjs` will surface that.

### Diagnostic

```bash
gcloud beta run domain-mappings describe \
  --domain=dev.cdiscourse.com \
  --region=us-central1 \
  --project=cdiscourse-host \
  --format='value(status.conditions)'
```

The `conditions[]` array contains an entry with `type: CertificateProvisioned`. Three observable states:

| `status` | `reason` | Meaning |
|---|---|---|
| `Unknown` | `ProvisioningCert` | Cert is being minted. Normal for first several minutes. |
| `True` | (empty) | Cert is live. `verify-dns-mapping.mjs` will return Google Trust Services as the issuer. |
| `False` | `CertificateProvisioningFailed` / `DnsNotConfigured` / `CaaError` / similar | Something is wrong. See remediation below. |

### Remediation if cert fails to provision

Most common causes, in observed-frequency order:

1. **DNS not yet propagating.** Check `dig +short dev.cdiscourse.com @8.8.8.8`. If empty, wait. If wrong, fix the CNAME at GoDaddy.
2. **CNAME pointing at the wrong target.** `gcloud beta run domain-mappings describe` prints the correct target; compare against the GoDaddy record value.
3. **`CAA` record at apex `cdiscourse.com` excludes `pki.goog`.** If a CAA record exists and lists only (e.g.) `letsencrypt.org`, Google's CA cannot issue the cert. Fix: either remove the CAA record (preserves the previous policy by default = any CA), or add a `pki.goog` allow line. **HOST-006 does not modify CAA records without explicit operator confirmation** — runbook step 7 surfaces this case and stops.
4. **Domain ownership not verified at Search Console.** `gcloud beta run domain-mappings create` will refuse outright in this case (exit code non-zero, error message references the verified-domain list). Runbook step 3 is the verification step; if step 4 (`create`) fails with this error, the operator returns to step 3.
5. **Sibling record at `dev` violates CNAME alone-at-name rule.** Some DNS providers silently accept this; some reject. GoDaddy historically rejects, but if it slips through, GCP cert issuance will fail. Fix: remove sibling records at `dev` (runbook step 2's zone snapshot is the rollback baseline).

The runbook step 7 walks the operator through the diagnostic in this order. Helper `verify-dns-mapping.mjs` surfaces (1) and the cert-issuer mismatch directly; (2)–(5) require the gcloud describe + GoDaddy zone review.

---

## Operator runbook (`docs/deployment/host-006-dns-runbook.md`)

The implementer creates `docs/deployment/host-006-dns-runbook.md` with the structure below. **Every command is operator-runnable.** Every section carries an explicit "Agent does NOT run this" banner. Both PowerShell and bash command variants appear where they diverge.

### Required runbook sections + numbered steps

The runbook has **9 numbered steps**, matching the contract:

1. **Preflight — verify HOST-001 and HOST-005 prerequisites.** Operator runs the helper:
   ```bash
   node scripts/deploy/preflight-dns.mjs \
     --service=cdiscourse-dev \
     --region=us-central1 \
     --project=cdiscourse-host \
     --strict-project
   ```
   The helper (a) confirms `gcloud` is installed; (b) confirms `gcloud config get-value project` returns `cdiscourse-host`; (c) calls `gcloud run services describe cdiscourse-dev --region=us-central1 --project=cdiscourse-host --format=json` to confirm the service exists, has at least one ready revision, and is reachable at its bare `*.run.app` URL; (d) delegates to `scripts/deploy/preflight-secrets.mjs --manifest=infra/secrets/cdiscourse-dev-manifest.json --strict-project` to confirm both secrets are bound; (e) performs an HTTPS HEAD against the bare `*.run.app` URL (no Authorization header) expecting a 401 or 403 (proof that `--no-allow-unauthenticated` is in place). Exit 0 means HOST-006 can proceed.

   **Verification:** re-running the helper exits 0 idempotently. **Rollback:** none — read-only.

2. **Snapshot the existing GoDaddy zone.** Operator manually screenshots the GoDaddy DNS Management page for `cdiscourse.com` AND runs a bulk `dig` capture:
   ```bash
   dig +short @8.8.8.8 cdiscourse.com any > /tmp/host-006-cdiscourse-zone-before.txt
   dig +short @8.8.8.8 www.cdiscourse.com any >> /tmp/host-006-cdiscourse-zone-before.txt
   dig +short @8.8.8.8 dev.cdiscourse.com any >> /tmp/host-006-cdiscourse-zone-before.txt
   dig TXT @8.8.8.8 cdiscourse.com >> /tmp/host-006-cdiscourse-zone-before.txt
   dig MX @8.8.8.8 cdiscourse.com >> /tmp/host-006-cdiscourse-zone-before.txt
   dig CAA @8.8.8.8 cdiscourse.com >> /tmp/host-006-cdiscourse-zone-before.txt
   ```
   PowerShell equivalent using `Resolve-DnsName` documented inline. The captured file is the rollback baseline. The operator confirms `dev.cdiscourse.com` returns **no records** (empty output) — if anything is there, stop and surface; HOST-006 refuses to overwrite.

   **Verification:** `/tmp/host-006-cdiscourse-zone-before.txt` is non-empty for apex / `www` / MX / TXT and **empty** for `dev`. **Rollback:** discard the file once HOST-006 is green and stable.

3. **Verify domain ownership at Google Search Console.** Operator opens https://search.google.com/search-console, picks "Add property → Domain", enters `cdiscourse.com`, and copies the printed `google-site-verification=<TOKEN>` TXT value. Operator pastes the value as a **new** TXT record at GoDaddy DNS Management:
   - Type: `TXT`
   - Host: `@`
   - Value: `google-site-verification=<TOKEN>`
   - TTL: `600`

   Operator clicks "Verify" in Search Console. Verification typically completes in under 5 minutes after the TXT propagates.

   **Verification:** Search Console shows green check for `cdiscourse.com`. `dig TXT cdiscourse.com @8.8.8.8` includes the new value. **Rollback:** remove the TXT record at GoDaddy (verification status reverts within ~24h).

   **The agent does NOT click anything in Search Console.** The runbook is a series of instructions for the operator.

4. **Create the Cloud Run domain mapping.** Operator runs:
   ```bash
   gcloud beta run domain-mappings create \
     --service=cdiscourse-dev \
     --domain=dev.cdiscourse.com \
     --region=us-central1 \
     --project=cdiscourse-host
   ```
   The command prints the resource record(s) the operator needs at GoDaddy. Typical output:
   ```
   NAME                 RECORD TYPE  CONTENTS
   dev.cdiscourse.com   CNAME        ghs.googlehosted.com.
   ```
   Operator copies the `CONTENTS` value verbatim — it will be the GoDaddy CNAME target in step 5.

   **Verification:** `gcloud beta run domain-mappings describe --domain=dev.cdiscourse.com --region=us-central1 --project=cdiscourse-host --format='value(spec.routeName)'` returns `cdiscourse-dev`. **Rollback:** see "Rollback" section below — `gcloud beta run domain-mappings delete --domain=dev.cdiscourse.com --region=us-central1 --project=cdiscourse-host`.

5. **Add the CNAME record at GoDaddy.** Operator opens GoDaddy DNS Management for `cdiscourse.com` → "Add record":
   - Type: `CNAME`
   - Host / Name: `dev`
   - Value / Points to: `<TARGET_FROM_STEP_4>` (e.g. `ghs.googlehosted.com.`)
   - TTL: `300`

   **Before saving**, operator confirms no existing record at `dev` (from step 2 snapshot). If one exists, stop and surface.

   **Verification:** `dig CNAME dev.cdiscourse.com @8.8.8.8 +short` returns the target value. **Rollback:** remove the CNAME at GoDaddy. Propagation note: deletion also has TTL lag (up to 5 min at TTL=300).

6. **Wait for DNS propagation.** Operator runs in a loop:
   ```bash
   while true; do
     RESULT=$(dig +short dev.cdiscourse.com @8.8.8.8)
     echo "$(date -u +%H:%M:%S) → ${RESULT:-EMPTY}"
     if [ -n "$RESULT" ]; then break; fi
     sleep 30
   done
   ```
   PowerShell equivalent documented inline (`Resolve-DnsName` polling). Typically resolves within 1–5 minutes at TTL=300. If empty after 15 minutes, return to step 5 and confirm the CNAME exists at GoDaddy (browser refresh of the DNS Management page).

   **Verification:** `dig +short dev.cdiscourse.com @8.8.8.8` returns the CNAME target (or, after a second resolution hop, the resolved IPv4 address — both are pass). **Rollback:** none — propagation is one-way; rollback at step 5.

7. **Wait for cert provisioning.** Operator runs:
   ```bash
   gcloud beta run domain-mappings describe \
     --domain=dev.cdiscourse.com \
     --region=us-central1 \
     --project=cdiscourse-host \
     --format='value(status.conditions)'
   ```
   in a loop until the `CertificateProvisioned` condition transitions from `Unknown` to `True`. Typically minutes. If `False` with reason `CaaError`, jump to the "Remediation" section above. If `False` with reason `DnsNotConfigured`, return to step 6.

   **Verification:** cert condition `CertificateProvisioned: True`. **Rollback:** delete the domain mapping (see "Rollback" below).

8. **Run post-mapping verification helper.** Operator runs:
   ```bash
   node scripts/deploy/verify-dns-mapping.mjs \
     --domain=dev.cdiscourse.com \
     --expected-target=ghs.googlehosted.com \
     --expected-status-set=401,403
   ```
   The helper (a) resolves `dev.cdiscourse.com` via `dns.resolveCname` and confirms the target matches `--expected-target`; (b) opens an HTTPS HEAD request to `https://dev.cdiscourse.com/` and confirms the TLS cert issuer matches Google Trust Services (`GTS`); (c) confirms the HTTP status code is in `--expected-status-set` (default `401,403` because `--no-allow-unauthenticated` is in place). Exit 0 means HOST-006 is complete. If the helper returns a 200, that is a **regression** — `--no-allow-unauthenticated` has been flipped off; STOP and investigate before HOST-007.

   **Verification:** helper exits 0. **Rollback:** see "Rollback" below.

9. **Hand off to HOST-007.** With `dev.cdiscourse.com` resolving and the Google-managed cert provisioned, the next card attaches IAP. Anonymous browser hits return 401 / 403 from Cloud Run IAM today; after HOST-007 they redirect to Google sign-in (302) and then to the app. HOST-006 ends here.

   **Verification:** none — return-to-caller. **Rollback:** none — see "Rollback" for full-card rollback if HOST-007 is not started for an extended period.

### Rollback notes per step

- Steps 1, 6, 9 — read-only / propagation / handoff; no rollback action.
- Step 2 — discard the snapshot file once HOST-006 is green and stable.
- Step 3 — remove the TXT record at GoDaddy; Search Console verification reverts within ~24h.
- Step 4 — `gcloud beta run domain-mappings delete --domain=dev.cdiscourse.com --region=us-central1 --project=cdiscourse-host`. Idempotent.
- Step 5 — remove the CNAME at GoDaddy. Wait for TTL propagation (≤5 min at TTL=300).
- Step 7 — same as step 4; cert is bundled with the mapping.
- Step 8 — same as step 4.

### Explicit "agent does NOT run" markers

Every section header carries:

> **The agent does NOT run any command in this section.** Every `gcloud`, `dig`, GoDaddy click, and Search Console action is operator-runnable. The agent wrote the runbook, the helpers, and the tests. The operator chooses when to apply each step.

---

## Helper scripts

Two helpers ship under `scripts/deploy/`, plus PowerShell + bash wrappers each. Same `.mjs` + `.ps1` + `.sh` pattern as HOST-005.

### Helper 1 — `scripts/deploy/preflight-dns.mjs`

#### Purpose

Confirm HOST-001 + HOST-005 prerequisites before any DNS change. Refuses if the Cloud Run service is not deployed, not healthy, not gated, or if Secret Manager secrets are missing. Runs **before** runbook step 3 (Search Console TXT) and **before** runbook step 4 (`gcloud beta run domain-mappings create`).

#### Interface

```text
node scripts/deploy/preflight-dns.mjs \
  --service=cdiscourse-dev \
  --region=us-central1 \
  --project=cdiscourse-host \
  [--strict-project] \
  [--manifest=infra/secrets/cdiscourse-dev-manifest.json] \
  [--json] \
  [--gcloud-bin=gcloud] \
  [--skip-public-probe]
```

Flags:

- `--service=<name>` — required. Cloud Run service name (default for tests / HOST-006: `cdiscourse-dev`).
- `--region=<id>` — required. Locked default: `us-central1`.
- `--project=<id>` — required.
- `--strict-project` — exit non-zero if `gcloud config get-value project` does not match `--project`. Default behaviour without the flag is to warn but proceed.
- `--manifest=<path>` — optional. Path to HOST-005's manifest. Default: `infra/secrets/cdiscourse-dev-manifest.json`. Helper delegates to `preflight-secrets.mjs` via in-process `spawnSync('node', [PRESFLIGHT_SECRETS_PATH, ...])`.
- `--json` — print structured result to stdout.
- `--gcloud-bin=<path>` — test-only override for the gcloud binary. Defaults to `gcloud` from PATH.
- `--skip-public-probe` — skip the HTTPS HEAD against the `*.run.app` URL (used by tests where outbound HTTPS is not available).

#### Behaviour

Pipeline (short-circuits on first failure):

1. Resolve and validate flags. Refuse if `--service`, `--region`, or `--project` is missing or empty.
2. Check `gcloud --version` succeeds. Exit 3 if not.
3. Read `gcloud config get-value project`. Compare to `--project`. Exit 4 if mismatch AND `--strict-project`.
4. Run `gcloud run services describe <service> --region=<region> --project=<project> --format=json`. Capture stdout, parse JSON.
   - Confirm `status.url` exists and matches `https://.+\.run\.app$`. Exit 8 if not.
   - Confirm `status.conditions[]` includes a `Ready` condition with `status: True`. Exit 9 if not.
   - Confirm `status.traffic[0].percent === 100` and `status.traffic[0].latestRevision === true`. Exit 9 if not.
   - Confirm the service's `spec.template.spec.containers[0].env` includes both `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` bound via `valueFrom.secretKeyRef`. Exit 10 if not.
   - Confirm `metadata.annotations["run.googleapis.com/ingress"]` is `all` and the service was deployed with `--no-allow-unauthenticated` (deduced by checking IAM via `gcloud run services get-iam-policy <service> --region=<region> --project=<project>` — if `allUsers` is bound to `roles/run.invoker`, exit 11 because the service is public when it should not be).
5. Spawn `node scripts/deploy/preflight-secrets.mjs --manifest=<manifest> --project=<project> --strict-project`. Forward its exit code (any non-zero short-circuits HOST-006 preflight).
6. Unless `--skip-public-probe`, open an HTTPS HEAD request to the captured `status.url` (no `Authorization` header). Confirm status is `401` or `403`. Exit 11 if it returns `200` or `2xx` (means the service is publicly readable — regression). Exit 12 if connection fails (network error).
7. Print result to stdout (text or JSON per flag).

#### Exit codes

| Code | Meaning |
|---|---|
| `0` | All prerequisites confirmed. HOST-006 can proceed. |
| `2` | Manifest parse / schema error (forwarded from preflight-secrets). |
| `3` | `gcloud` not on PATH. |
| `4` | `gcloud config get-value project` mismatch with `--strict-project`. |
| `5` | Manifest secret missing ENABLED version (forwarded). |
| `6` | Manifest secret missing entirely (forwarded). |
| `7` | `gcloud` subprocess returned non-zero (auth, API, network) (forwarded). |
| `8` | Cloud Run service status missing or URL malformed. |
| `9` | Cloud Run service not in `Ready: True` state or not serving 100% latest revision. |
| `10` | Cloud Run service env bindings missing one or both required secrets. |
| `11` | Cloud Run service is publicly readable (`allUsers: roles/run.invoker` present, OR HEAD returns `200`). |
| `12` | Public probe HTTPS request failed (network error). |

#### JSON output schema

```json
{
  "service": "cdiscourse-dev",
  "region": "us-central1",
  "project": "cdiscourse-host",
  "checks": {
    "gcloudAvailable": true,
    "projectMatch": true,
    "serviceExists": true,
    "serviceReady": true,
    "trafficLatest": true,
    "secretBindings": ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    "gated": true,
    "publicProbeStatus": 401,
    "preflightSecretsExit": 0
  },
  "ok": true
}
```

The JSON output never includes any secret value, never includes any cert content, and never includes the bearer token used by the operator's prior runbook steps (the public probe sends none).

#### Refusals / safety

- Refuses to run if any positional argument is passed (only `--flag=value` accepted).
- Refuses to spawn `gcloud` with anything other than the documented subcommands (`--version`, `config get-value project`, `run services describe`, `run services get-iam-policy`).
- Refuses to call `gcloud secrets versions access` (forwarded constraint from preflight-secrets).
- Never reads `.env*` files.
- Never writes to a file; stdout / stderr only.
- Never executes any mutating command (no `create` / `update` / `delete` / `add-iam-policy-binding` / `remove-iam-policy-binding` strings appear in the source's gcloud-invocation paths).

### Helper 2 — `scripts/deploy/verify-dns-mapping.mjs`

#### Purpose

DNS + TLS sanity from outside GCP. Runs **after** runbook step 7 (cert provisioning) and is runbook step 8. Confirms `dev.cdiscourse.com` resolves to the expected target, the TLS cert is healthy and issued by Google Trust Services, and the HTTP status code matches expectations (`401` / `403` because IAP isn't on yet OR `200` because IAP isn't on yet AND `--no-allow-unauthenticated` flipped — the latter is a regression).

#### Interface

```text
node scripts/deploy/verify-dns-mapping.mjs \
  --domain=dev.cdiscourse.com \
  [--expected-target=ghs.googlehosted.com] \
  [--expected-issuer-substring=Google Trust Services] \
  [--expected-status-set=401,403] \
  [--timeout-ms=10000] \
  [--json] \
  [--resolver=8.8.8.8]
```

Flags:

- `--domain=<host>` — required. The mapped subdomain to verify.
- `--expected-target=<host>` — optional. CNAME target the helper compares against `dns.resolveCname(domain)` result (trailing dot tolerant). Default: `ghs.googlehosted.com`. The runbook step 8 passes whatever value `gcloud beta run domain-mappings describe` printed in step 4.
- `--expected-issuer-substring=<text>` — optional. Substring the helper requires in the parsed TLS cert's `issuer.O` or `issuer.CN`. Default: `Google Trust Services`.
- `--expected-status-set=<csv>` — optional. Comma-separated set of HTTP status codes the helper accepts. Default for HOST-006 post-mapping: `401,403`. After HOST-007 lands, the operator would re-run with `--expected-status-set=302` (IAP redirect).
- `--timeout-ms=<ms>` — optional. Total budget for DNS + HTTPS HEAD. Default: `10000`.
- `--json` — print structured result.
- `--resolver=<ip>` — optional. DNS resolver IP. Default: `8.8.8.8`. The helper uses `dns.Resolver` (node built-in) and sets servers explicitly so the result does not depend on the operator's local resolver config.

#### Behaviour

Pipeline (short-circuits on first failure):

1. Resolve and validate flags. Refuse if `--domain` is empty.
2. Build a `dns.Resolver` with `resolver` as the only nameserver. Call `resolver.resolveCname(domain)`.
   - Compare each returned target against `--expected-target` (trailing-dot tolerant, lowercase compare).
   - Exit 8 if no CNAME returned (means DNS still propagating OR record missing).
   - Exit 9 if a CNAME is returned but no value matches `--expected-target`.
3. Open an HTTPS HEAD request to `https://<domain>/` via `node:https`. Capture the TLS socket's peer certificate before sending the request (using `tls.connect` with `servername: domain` and reading `getPeerCertificate()` then immediately closing — or, equivalently, reading the cert from the request's `.socket.getPeerCertificate()` callback).
   - Exit 12 on TCP / TLS error (connection refused, handshake failure, hostname mismatch).
   - Exit 10 if the cert's `issuer.O` or `issuer.CN` does not include `--expected-issuer-substring`.
   - Exit 13 if the cert's `valid_to` is in the past (expired).
4. Read the HTTP status code. Exit 11 if it is not in `--expected-status-set`.
5. Print result.

#### Exit codes

| Code | Meaning |
|---|---|
| `0` | DNS resolves, cert is healthy, status matches expectation. |
| `5` | `--domain` flag missing. |
| `8` | DNS returned no CNAME (propagation not complete / record absent). |
| `9` | DNS CNAME target does not match `--expected-target`. |
| `10` | TLS cert issuer does not include `--expected-issuer-substring`. |
| `11` | HTTP status code not in `--expected-status-set`. |
| `12` | TCP / TLS connection or DNS error. |
| `13` | TLS cert expired. |

#### JSON output schema

```json
{
  "domain": "dev.cdiscourse.com",
  "dns": {
    "resolver": "8.8.8.8",
    "cnameTargets": ["ghs.googlehosted.com."],
    "expectedTarget": "ghs.googlehosted.com",
    "match": true
  },
  "tls": {
    "issuer": { "O": "Google Trust Services", "CN": "GTS CA 1C3" },
    "validFrom": "2026-05-19T00:00:00Z",
    "validTo": "2026-08-17T00:00:00Z",
    "issuerMatch": true,
    "expired": false
  },
  "http": {
    "statusCode": 401,
    "expectedSet": [401, 403],
    "match": true
  },
  "ok": true
}
```

#### Refusals / safety

- Refuses any positional argument.
- Refuses to send any `Authorization` header (the helper's HTTPS request must be anonymous, by design).
- Refuses to follow redirects (the helper sets `followRedirects: false` equivalent by reading the status code and not opening a second request).
- Never invokes `gcloud` (this helper is **out-of-GCP** sanity; it deliberately does not depend on the operator's local gcloud auth).
- Never reads `.env*` files.
- Never writes to a file.
- Never executes any DNS-mutating command.

### Wrappers

For each helper:

- `scripts/deploy/preflight-dns.ps1` — thin PowerShell wrapper that forwards `@args` to the `.mjs`. Same shape as HOST-005's `preflight-secrets.ps1`.
- `scripts/deploy/preflight-dns.sh` — thin bash wrapper that does `exec node $REPO_ROOT/scripts/deploy/preflight-dns.mjs "$@"`. Same shape as HOST-005's `preflight-secrets.sh`.
- `scripts/deploy/verify-dns-mapping.ps1` — same shape.
- `scripts/deploy/verify-dns-mapping.sh` — same shape.

---

## Data model

**No new data model.** No TypeScript types, no SQL schema, no Supabase migration, no Edge Function payload. HOST-006 is pure ops plumbing.

The only persisted artifacts are:

- DNS records at GoDaddy (the operator's, not in the repo).
- A Cloud Run `domain-mappings` resource at GCP (the operator's, not in the repo).
- A Google-managed TLS cert auto-provisioned by Cloud Run (not in the repo).

The repo gains a runbook + two helpers + tests. No code under `src/`, `app/`, or `supabase/` changes.

---

## File changes

### New files (committed by HOST-006's implementer; not by HOST-006's designer)

- `docs/deployment/host-006-dns-runbook.md` — 9 numbered operator-runnable steps + rollback per step + explicit "agent does NOT run" markers + the "do-not-touch" GoDaddy record list + the remediation guide for cert provisioning failures. **~250 lines.**
- `scripts/deploy/preflight-dns.mjs` — Node entrypoint. Calls `gcloud run services describe`, `gcloud run services get-iam-policy`, delegates to `preflight-secrets.mjs`, performs an anonymous HTTPS HEAD. **~260 lines.**
- `scripts/deploy/preflight-dns.ps1` — Windows wrapper. **~25 lines.**
- `scripts/deploy/preflight-dns.sh` — POSIX wrapper. **~15 lines.**
- `scripts/deploy/verify-dns-mapping.mjs` — Node entrypoint. Uses `dns.Resolver` + `tls.connect` + `https.request`. **~220 lines.**
- `scripts/deploy/verify-dns-mapping.ps1` — Windows wrapper. **~25 lines.**
- `scripts/deploy/verify-dns-mapping.sh` — POSIX wrapper. **~15 lines.**
- `__tests__/hostSixDnsRunbook.test.ts` — runbook structure tests (numbered steps, "do not touch" list, no apex / www mentions outside the explicit do-not-touch section, no value-shape literals). **~180 lines, ~25 tests.**
- `__tests__/hostSixPreflightDns.test.ts` — preflight helper tests: wrapper existence, source-scan (no mutating gcloud subcommand), exit codes against a gcloud stub. **~280 lines, ~30 tests.**
- `__tests__/hostSixVerifyDnsMapping.test.ts` — verify helper tests: wrapper existence, source-scan, exit codes against a mock DNS resolver + a local HTTPS server fixture that issues a self-signed cert (to test the issuer-mismatch path). **~220 lines, ~25 tests.**
- `__tests__/fixtures/host-006-gcloud-stub.mjs` — Node script that mimics `gcloud` for preflight-dns tests. Reads `HOST_006_STUB_*` env vars to control the canned response (similar to HOST-005's gcloud stub). **~150 lines.**
- `__tests__/fixtures/host-006-https-server.mjs` — tiny local HTTPS server fixture used by verify-dns-mapping tests. Self-signed cert, configurable issuer subject + status code. **~120 lines.**

### Modified files (committed by HOST-006's implementer)

- `docs/deployment/host-001-operator-runbook.md` — Phase 5 step 23 already lists HOST-006 as a follow-up card. **Extend** step 23's bullet for HOST-006 with: a link to the new `docs/deployment/host-006-dns-runbook.md`, the two helper-script paths, and the explicit "operator runs `preflight-dns.mjs` before any DNS change" line. **+15 lines, no deletions.**
- `docs/current-status.md` — add a top-level "HOST-006 — `dev.cdiscourse.com` DNS strategy" section similar in shape to the existing HOST-005 entry. **+30 lines, no deletions.**

### Explicitly NOT modified

- `infra/cloud-run/cdiscourse-dev.template.yaml` — HOST-001 territory. HOST-006 reads it but does not modify.
- `infra/secrets/cdiscourse-dev-manifest.json`, `infra/secrets/manifest.schema.json` — HOST-005 territory.
- `infra/iam/cdiscourse-deployer.iam.yaml`, `infra/iam/cdiscourse-dev-runner.iam.yaml` — no new IAM roles required. (The deployer SA already has `roles/run.admin` which permits `domain-mappings create`. Domain ownership verification at Search Console is operator-Google-account-scoped, not SA-scoped.)
- `scripts/deploy/print-secret-commands.{mjs,ps1,sh}` — HOST-005 territory.
- `scripts/deploy/preflight-secrets.{mjs,ps1,sh}` — HOST-005 territory. HOST-006's preflight-dns spawns it as a subprocess but does not edit it.
- `scripts/runtime/server.mjs`, `scripts/build/inject-runtime-env.{mjs,ps1,sh}` — HOST-001 territory.
- `src/lib/supabase.ts` — HOST-001 territory.
- Any file under `app/`, `supabase/`, or `__tests__/` that does not start with `hostSix` or `host-006-`.
- `docs/deployment/google-cloud-run-hosting-plan.md` — master plan, reference-only.

---

## API / interface contracts

### `preflight-dns.mjs` invocation contract

```text
exit | meaning
-----+--------
   0 | all prerequisites confirmed
   2 | manifest parse / schema error (from preflight-secrets)
   3 | gcloud not on PATH
   4 | gcloud project mismatch (with --strict-project)
   5 | manifest secret missing ENABLED version (from preflight-secrets)
   6 | manifest secret missing (from preflight-secrets)
   7 | gcloud subprocess non-zero (auth, API, network)
   8 | Cloud Run service URL missing / malformed
   9 | Cloud Run service not Ready or not 100% latest
  10 | Cloud Run secret bindings missing
  11 | Cloud Run service publicly readable (allUsers bound OR HEAD returns 200)
  12 | public probe HTTPS request failed
```

### `verify-dns-mapping.mjs` invocation contract

```text
exit | meaning
-----+--------
   0 | DNS + TLS + status all match expectations
   5 | --domain flag missing
   8 | DNS returned no CNAME
   9 | CNAME target mismatch
  10 | TLS issuer mismatch
  11 | HTTP status outside expected set
  12 | TCP/TLS/DNS error
  13 | TLS cert expired
```

### Cross-card binding to HOST-001 + HOST-005

`preflight-dns.mjs` reads no state from HOST-001 / HOST-005 source files. It re-derives state through gcloud queries and delegates to `preflight-secrets.mjs`. Contract:

```text
HOST-006 preflight =
   HOST-005 preflight (delegated unchanged)
 + Cloud Run service health (HOST-001 deployed it)
 + Cloud Run service gated state (HOST-001 + HOST-007 invariant)
```

If HOST-005's `preflight-secrets.mjs` changes its CLI interface, HOST-006's `preflight-dns.mjs` breaks at the spawn boundary. Mitigation: HOST-006's test suite exercises the actual `preflight-secrets.mjs` with the dev manifest; any breaking change is caught.

### No new contract exposed to future cards

HOST-006 does not produce a manifest, schema, or persisted artifact that future cards consume. HOST-008 (prod) will write its own DNS runbook for the apex domain, not extend HOST-006's. The reusable surface is the **pattern** (preflight + verify helpers + 9-step runbook), not a programmatic interface.

---

## Edge cases

- **Operator runs `gcloud beta run domain-mappings create` before Search Console verification (step 4 before step 3).** gcloud refuses with `The domain ... is not verified`. Runbook step 3 ordering catches this; runbook step 4's text explicitly references the error and points back to step 3.
- **Operator runs runbook step 5 (CNAME) before step 4 (mapping create).** GoDaddy accepts the CNAME, but `gcloud beta run domain-mappings create` will then race against DNS — sometimes the cert provisions immediately, sometimes the operator gets a `DnsNotConfigured` for a few minutes. Acceptable; the wait in step 6 covers it.
- **Operator runs runbook step 4 (mapping create) before step 1 (preflight).** `gcloud beta run domain-mappings create` succeeds even if the Cloud Run service is unhealthy — the mapping exists but `status.url` returns 5xx. Runbook step 1 ordering catches this; step 1's helper exits non-zero so step 2 onwards never starts.
- **Operator pastes the wrong target into the GoDaddy CNAME.** `verify-dns-mapping.mjs` exit 9 surfaces the mismatch. Remediation: fix the CNAME value at GoDaddy, wait for propagation.
- **Operator adds a sibling record at `dev` (e.g. a TXT for some unrelated verification).** CNAME-alone-at-name rule is violated; cert provisioning silently fails. `verify-dns-mapping.mjs` exit 8 / 9 depending on how GoDaddy resolves the conflict. Remediation: remove the sibling at `dev`.
- **Apex `CAA` record excludes `pki.goog`.** Cert provisioning fails with `CaaError`. Remediation: runbook step 7 surfaces this; operator either removes the CAA record (preserves previous "any CA" policy) or adds a `pki.goog` allow line. **HOST-006 does not auto-modify CAA records.**
- **Operator's local resolver returns stale results.** `verify-dns-mapping.mjs` uses `dns.Resolver` with `--resolver=8.8.8.8` (Google Public DNS) explicitly, so it never depends on the operator's local resolver. Result is repeatable regardless of laptop config.
- **Cert is provisioned but `--no-allow-unauthenticated` has been flipped off** (regression). `verify-dns-mapping.mjs` exit 11 (status 200 outside expected set `401,403`). The runbook step 8 text explicitly calls this out as "STOP — regression — do not proceed to HOST-007 until investigated."
- **Cert is provisioned by a CA other than Google Trust Services** (very unlikely, but defensive). `verify-dns-mapping.mjs` exit 10. Almost certainly indicates a man-in-the-middle proxy on the operator's network or a wildly misconfigured zone; runbook step 8 text references this case.
- **gcloud beta is not installed.** Operator's gcloud CLI might be on a version that requires `gcloud components install beta` first. `preflight-dns.mjs` runs `gcloud --version` and parses the output for `beta`; if absent, exit 3 with stderr message `"gcloud beta component not installed; run: gcloud components install beta"`.
- **Operator on Windows where `gcloud` is `gcloud.cmd`.** `spawnSync` handles this on Windows when `shell: false` and the binary is `gcloud` because gcloud installs a `gcloud.cmd` shim AND a `gcloud.bat`. The helper passes `shell: false` and lets Node's process-launching find the right shim. (Same pattern as HOST-005's preflight-secrets, already proven on Windows in HOST-001 tests.)
- **GoDaddy DNS Management UI changes.** The runbook describes fields by **semantic name** (Type, Host/Name, Value/Points to, TTL) rather than by GoDaddy's exact button labels. If GoDaddy renames "Points to" to "Value" or vice versa, the runbook still reads correctly.
- **Operator owns `cdiscourse.com` at GoDaddy but Google Search Console is logged in as a different account.** Verification fails because Search Console's ownership lives per-Google-account. Runbook step 3 says explicitly "operator uses the Google account that should own the verification — typically the same account they use for `gcloud auth login`."
- **Domain ownership was previously verified via a `meta` tag on a website (rather than DNS TXT).** Cloud Run domain mapping accepts the verification as long as it lives at the apex level (or higher) and is fresh. The runbook step 3 still has the operator perform a fresh DNS TXT verification regardless — DNS TXT is the most resilient form and survives website downtime.

---

## Test plan

All tests live at three test files under `__tests__/`. Tests use `spawnSync` to exercise the `.mjs` entrypoints (same pattern as HOST-001's `__tests__/hostOneBuildScripts.test.ts` and HOST-005's `__tests__/hostFivePreflightSecrets.test.ts`).

### `__tests__/hostSixDnsRunbook.test.ts`

Runbook structure assertions — these guard against silent regression to the design:

- `docs/deployment/host-006-dns-runbook.md` exists.
- Contains exactly **9 numbered top-level steps** (regex `^\s*[1-9]\.\s+\*\*` per line, expect 9 matches).
- Every numbered step contains either a "Verification:" sub-bullet OR an explicit `# verify` comment.
- Every numbered step that contains a `gcloud` command is preceded by "Operator runs:" or wrapped in an "Agent does NOT run" framing within the same step body.
- Contains the literal string `dev.cdiscourse.com` (sanity).
- Contains the literal string `ghs.googlehosted.com` (the canonical target, referenced as a default — operator reads actual target from gcloud output).
- Contains the literal string `300` (CNAME TTL recommendation).
- Contains the literal string `Google Trust Services`.
- Contains the literal string `GoDaddy`.
- Contains the literal string `Google Search Console`.
- Contains the literal string `--no-allow-unauthenticated`.
- Contains the literal string `Clear-History` if any history-clearing operation is documented (none should be — HOST-006 does not touch secrets — assert absence instead).
- **Never** contains `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, `RESEND_API_KEY` (these are out of scope; HOST-006 does not handle keys).
- **Never** contains a value-shape literal: no `sk-ant-`, `xai-`, `sb_secret_`, `sb_publishable_`, `Bearer\s+[A-Za-z0-9]`, `eyJ[A-Za-z0-9_.-]{10,}`, `https?://[A-Za-z0-9-]+\.supabase\.co` outside its own forbidden-list assertions.
- The "do not touch" list appears with each enumerated record family: apex `A`, `www CNAME`, `MX`, `SPF`, `DKIM`, `DMARC`, `CAA`, existing `google-site-verification` TXT.
- The string `cdiscourse.com` (apex without `dev` prefix) appears **only** in: (a) "do not touch" enumerations, (b) the Search Console verification step where the operator verifies the apex, (c) the snapshot step where `dig` queries the apex. Never appears as a `--domain=` argument to gcloud or as a CNAME target.
- The string `www.cdiscourse.com` appears **only** in: (a) "do not touch" enumerations, (b) the snapshot step where `dig` queries it. Never as a `--domain=` argument.
- References `docs/deployment/host-001-operator-runbook.md` and `docs/deployment/host-005-secrets-runbook.md` by name.
- Cross-file: `docs/deployment/host-001-operator-runbook.md` contains the new HOST-006 link added in HOST-006's PR.

### `__tests__/hostSixPreflightDns.test.ts`

Helper behavioural assertions:

- `scripts/deploy/preflight-dns.{mjs,ps1,sh}` all exist.
- The `.ps1` forwards to the `.mjs`.
- The `.sh` `exec node`s the `.mjs`.
- Source scan: the `.mjs` source contains **only** these `gcloud` subcommand literals: `--version`, `config get-value project`, `run services describe`, `run services get-iam-policy`. (Test asserts presence of those four; asserts absence of every other `gcloud` subcommand string.)
- Source scan: the `.mjs` does **not** contain any of: `secrets versions add`, `domain-mappings create`, `run services update`, `run deploy`, `dns managed-zones`, `dns record-sets`, `compute ssl-certificates`, `compute forwarding-rules`, `compute backend-services`, `compute security-policies` (mutating + out-of-scope subcommands).
- Source scan: does not call `fs.readFile*` on any path matching `/\.env/`.
- Source scan: does not import `dotenv`.
- Source scan: never reads any field named `value`, `data`, `secret`, or `token` from gcloud JSON output.
- Mock test: with the `gcloud` stub returning a healthy service + secrets bound + no `allUsers` binding + HEAD returning 401, helper exits 0.
- Mock test: stub returns "service not found" → exit 7.
- Mock test: stub returns `allUsers: roles/run.invoker` in IAM policy → exit 11.
- Mock test: stub returns `Ready: False` → exit 9.
- Mock test: stub returns env without `EXPO_PUBLIC_SUPABASE_URL` → exit 10.
- Mock test: stub returns `project` as `not-cdiscourse-host` with `--strict-project` → exit 4.
- Mock test: `--skip-public-probe` skips the HEAD request and exits 0 on healthy state.
- Mock test: `--json` produces JSON output containing only the documented fields (no secret value, no cert content).

### `__tests__/hostSixVerifyDnsMapping.test.ts`

- `scripts/deploy/verify-dns-mapping.{mjs,ps1,sh}` all exist.
- Wrappers forward to the `.mjs`.
- Source scan: never calls `gcloud` (string `gcloud` does not appear in the `.mjs` source). The helper deliberately does not depend on the operator's gcloud auth.
- Source scan: never sets an `Authorization` header on its HTTPS request.
- Source scan: never reads `.env*`.
- Source scan: uses `dns.Resolver` (not `dns.lookup`, which depends on the OS resolver).
- Mock test: against a local HTTPS server fixture serving a self-signed cert with issuer `Test CA`, helper exits 10 (issuer mismatch).
- Mock test: against the same fixture serving a cert with issuer including `Google Trust Services` (test cert, fake CN), and status code 401, helper exits 0.
- Mock test: same fixture returning status 200 → exit 11 (regression).
- Mock test: same fixture returning status 302 with `--expected-status-set=302` → exit 0 (HOST-007 future use).
- Mock test: DNS resolver returns no CNAME → exit 8.
- Mock test: DNS resolver returns wrong CNAME → exit 9.
- Mock test: connection refused → exit 12.
- Mock test: `--json` produces JSON with only the documented fields.

### Source safety scan (run across every new file)

- No file contains `sk-ant-`, `xai-`, `sb_secret_`, `sb_publishable_`, `eyJ[A-Za-z0-9_.-]{10,}`, `Bearer\s+[A-Za-z0-9]`, or `https?://[A-Za-z0-9-]+\.supabase\.co` URL.
- No file contains the literal `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, `RESEND_API_KEY` outside `__tests__/hostSixDnsRunbook.test.ts`'s assertion of their absence.
- No file contains `dotenv`, `require('dotenv')`, or `readFile*` of a path containing `.env`.
- No file contains a hard-coded service-account private key (`-----BEGIN PRIVATE KEY-----`) outside `__tests__/fixtures/host-006-https-server.mjs` which generates a self-signed cert at test runtime (NOT shipping a stored key — generated via `node:crypto` `generateKeyPairSync` at the start of each test run).

### CI sweep

- `npm run typecheck` must pass (test files are TypeScript; helpers are pure Node `.mjs` and excluded from tsc).
- `npm run lint` must pass.
- `npm run test` must pass with the three new test files included.
- `npm run skills:validate` must pass (no doctrine drift).

---

## Dependencies (cards / docs / files)

- **HOST-001 (merged `2c5030e`)** — this design assumes:
  - The Cloud Run service `cdiscourse-dev` is deployed in `us-central1` and reachable at its `*.run.app` URL.
  - The service was deployed with `--no-allow-unauthenticated`, so anonymous requests get 401 / 403. `preflight-dns.mjs` verifies this.
  - The runtime SA `cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com` is the bound identity (verified via `gcloud run services describe` → `spec.template.spec.serviceAccountName`).
  - The Cloud Run service template at `infra/cloud-run/cdiscourse-dev.template.yaml` is the canonical service spec. HOST-006 reads its `secretKeyRef` names but does not modify the file.
- **HOST-005 (merged `70cd6b6`)** — this design assumes:
  - Both `cdiscourse-dev-supabase-url` and `cdiscourse-dev-supabase-publishable-key` exist in Secret Manager with at least one ENABLED version.
  - The runtime SA has `roles/secretmanager.secretAccessor` on both secrets.
  - `scripts/deploy/preflight-secrets.mjs` exists and exposes the CLI documented at HOST-005 §"API / interface contracts". HOST-006's preflight spawns it.
- **Operator-side prerequisites:**
  - Operator owns `cdiscourse.com` at GoDaddy with admin access to DNS Management.
  - Operator has a Google account authorized for Cloud Console access on the `cdiscourse-host` project.
  - Operator has `gcloud` CLI installed locally with the `beta` component (`gcloud components install beta`).
  - Operator has authenticated `gcloud` (`gcloud auth login`) and configured impersonation per HOST-001 Phase 1 step 9.
- **HOST-007 (parallel)** — HOST-006 and HOST-007 are sequenced (HOST-006 first, then HOST-007), not parallel-in-time, even though they are being designed in parallel. HOST-007's design will reference `dev.cdiscourse.com` as the URL it attaches IAP to. HOST-006 produces that URL.
- **Master plan §6, §11, §15 R10** — design operationalizes the DNS strategy locked at D5. The plan is reference; HOST-006 implements it.

---

## Risks

- **Operator accidentally modifies an existing GoDaddy record.** Mitigation: runbook step 2 takes a full zone snapshot before any change. The "do-not-touch" list is the most prominent paragraph in the runbook. Step 3 (TXT) and step 5 (CNAME) explicitly say "add a new record; do not edit, replace, or delete any existing record."
- **DNS propagation lag confuses cert provisioning.** Mitigation: step 5 sets TTL=300 explicitly. Step 6 polls until propagation lands. Step 7 polls cert status separately. The two-stage wait avoids confusion.
- **Cloud Run domain mappings are preview.** Mitigation: master plan R10 captures the risk; acceptable for dev. Prod path is HOST-008's HTTPS LB + managed cert plan.
- **GoDaddy DNS UI/UX changes.** Mitigation: runbook describes record fields by semantic name (Type, Host/Name, Value/Points to, TTL) rather than GoDaddy UI labels. Tests assert the runbook contains the field semantics, not the UI words.
- **Operator on a stale `gcloud` version missing `beta run domain-mappings`.** Mitigation: preflight-dns.mjs checks `gcloud --version` and `gcloud components list` for `beta`; if absent, exit 3 with an actionable message.
- **`gcloud beta` command shape may evolve.** As of 2026-05, `gcloud beta run domain-mappings create` is the documented shape. If GCP renames to `gcloud run domain-mappings create` (graduating out of beta), the runbook needs a one-line update; tests assert the literal command string in the runbook so a future regression catches it (operator manually re-aligns).
- **Cert provisioning hangs at `ProvisioningCert` for > 24 hours.** Mitigation: runbook step 7's remediation section walks the operator through the five most common causes. If still hung after 24h, delete + recreate the mapping (rollback procedure).
- **Operator's local DNS resolver caches stale results.** Mitigation: `verify-dns-mapping.mjs` uses `dns.Resolver` pointed at `8.8.8.8` explicitly, bypassing the OS resolver. Operator's `dig` calls in the runbook also pass `@8.8.8.8`.
- **Apex `CAA` record blocks `pki.goog`.** Mitigation: runbook step 7's remediation section flags this case. HOST-006 does not automatically modify CAA records — operator confirms and edits.
- **Domain ownership verification at Search Console takes longer than expected.** Mitigation: runbook step 3 documents the typical 5-minute window; if longer, the operator waits and re-checks. No code path depends on a strict deadline.
- **Operator confuses the apex `cdiscourse.com` with `dev.cdiscourse.com` and accidentally configures a CNAME at apex.** Mitigation: runbook step 5 explicitly says "Host = `dev`, NOT `@` and NOT `cdiscourse.com`." Apex CNAMEs are illegal per RFC 1035, so GoDaddy will likely reject; if it slips through (via ALIAS / ANAME), the runbook step 2 snapshot catches the deviation.
- **HOST-007 starts before HOST-006 completes.** Mitigation: HOST-007's design (per cross-card pre-coordination) will require `dev.cdiscourse.com` resolves before IAP can attach. HOST-006 is the unambiguous predecessor.

---

## Out of scope

- **Cloud DNS migration** (Option B in master plan §6). D5 deferred.
- **HTTPS LB + serverless NEG + Cloud Armor** (Option B in master plan §9). D4 + D6 ruled out.
- **IAP attachment** (HOST-007). HOST-006 ends at `dev.cdiscourse.com` returning 401 / 403 from Cloud Run IAM; HOST-007 takes it to a Google sign-in redirect.
- **Tester onboarding** (HOST-007).
- **OAuth consent screen** (HOST-007).
- **Apex `cdiscourse.com` records** — reserved for HOST-008 (prod).
- **`www.cdiscourse.com` CNAME / A** — reserved for HOST-008.
- **Mail / MX / SPF / DKIM / DMARC records** — preserved as-is; runbook only adds, never edits.
- **`CAA` record changes** — flagged in remediation but not automated.
- **Cloud Run service spec changes** — `infra/cloud-run/cdiscourse-dev.template.yaml` is HOST-001 territory.
- **Cloud Audit Log alerting for domain-mappings or DNS** — no alert policy configured in HOST-006.
- **Cloud Logging alerts** — HOST-009, deferred.
- **Cloud Build / GitHub Actions CI for `gcloud beta run domain-mappings create`** — no CI integration. The operator runs the command manually.
- **TLS cert renewal automation** — Google-managed certs auto-renew at ~60 days; no operator action required. HOST-006 documents the expectation but does not add monitoring.
- **CAA record management** — HOST-006 only reads existing CAA records during step 2's snapshot.
- **A `npm run dns:preflight` / `npm run dns:verify` script** — adds noise to `package.json` for no clear v0 benefit. Operator invokes the helpers directly via `node ...` or via the platform wrappers (`.ps1` / `.sh`). HOST-008 may add npm wrappers if prod cadence justifies them.
- **Service-account JSON key files** — repo `.dockerignore` already excludes them; ADC + impersonation only.
- **Edge Function changes** — no Edge Function is involved in HOST-006.
- **Supabase dashboard config changes** — Site URL / Allowed Redirect URLs are HOST-001 / HOST-007's territory. HOST-006 does not touch Supabase Auth config.
- **Any UI surface, copy, or doctrine-touching code path** — pure ops plumbing.

---

## Doctrine / safety self-check

Walking each `cdiscourse-doctrine` rule:

1. **Score is gameplay analysis, never truth.** No scoring copy added. No verdict tokens. No user-visible string at all. **PASS.**
2. **Heat ≠ truth.** No heat copy. **PASS.**
3. **Popularity is not evidence.** No engagement copy. **PASS.**
4. **AI moderator hard limits.** No AI call from production app. Helpers do not call Anthropic / xAI / X / any AI provider. **PASS.**
5. **Rules engine is sacred.** No change to `src/lib/constitution/engine.ts`. **PASS.**
6. **Secrets policy.** HOST-006 introduces no new secret name and never reads any secret value:
   - `preflight-dns.mjs` delegates secret-existence checks to `preflight-secrets.mjs` (HOST-005), which itself never calls `gcloud secrets versions access`.
   - `verify-dns-mapping.mjs` never reads anything secret — it observes DNS + TLS + HTTP status only.
   - No `.env*` is read.
   - Service-role / Anthropic / xAI / X / Resend keys are NOT touched anywhere in HOST-006.
   - The `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` invariant remains zero matches — HOST-006 adds no such reference.
   - **PASS.**
7. **No AI calls from the production app.** No AI surface touched. **PASS.**
8. **Supabase conventions.** No migration, no RLS change, no constitution mutation, no Supabase write. **PASS.**
9. **Plain language for users.** No user-facing string added. **PASS.**
10. **v1 scope guards.** No voting, no collaborative editing, no OAuth, no public API, no push, no search. **PASS.**

**Additional hosting-specific doctrine (master plan §16, locked decisions D5 / D6 / D8 / D9):**

- **D5** GoDaddy stays as DNS authority. HOST-006 uses GoDaddy. No nameserver migration. **PASS.**
- **D6** IAM + IAP — direct Cloud Run domain mapping. HOST-006 uses domain mapping; no LB / NEG / Cloud Armor. **PASS.**
- **D8** Agent never executes mutating commands. Helpers print or verify; operator runs. The two helpers' source-scan tests explicitly assert no mutating `gcloud` subcommand string appears. **PASS.**
- **D9** No apex / www DNS records modified. Runbook tests assert `cdiscourse.com` and `www.cdiscourse.com` appear only in "do not touch" enumerations and the snapshot step. **PASS.**

**Hard rules from the spawn-card brief:**

- Agent never executes any DNS change. **PASS** — helpers print or verify; operator clicks at GoDaddy.
- Agent never executes any mutating `gcloud` command. **PASS** — only `--version`, `config get-value`, `run services describe`, `run services get-iam-policy` invocations.
- No apex / `www` records added. **PASS** — runbook tests guard.
- No existing GoDaddy record modified. **PASS** — runbook adds only; explicit "do not touch" list.
- No Cloud DNS resources. **PASS** — no `dns managed-zones` / `dns record-sets` strings anywhere.
- No Cloud Armor / HTTPS LB / serverless NEG. **PASS** — no `compute ssl-certificates` / `compute forwarding-rules` / `compute backend-services` / `compute security-policies` strings.
- No secret values in the diff. **PASS** — diff is documentation + helpers + tests; no value-shape literal anywhere.
- No new dependency. **PASS** — Node built-ins only.
- No `console.log` in committed code outside test files. **PASS** — helpers use `process.stdout.write` / structured output.
- TypeScript strict mode preserved. **PASS** — helpers are `.mjs` (no `tsc` constraint); test files are `.ts` and respect strict.
- No service-account JSON files in the repo. **PASS** — none added.
- HOST-001 / HOST-005 files unchanged. **PASS** — only `host-001-operator-runbook.md` step 23 extension and `current-status.md` addition; no source / template / manifest / helper file edited.

**Source-safety final sweep (re-run by implementer at commit time):**

```bash
# Must return zero matches across new files.
grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE\|sk-ant-\|xai-\|sb_secret_\|sb_publishable_\|Bearer " \
  scripts/deploy/preflight-dns.* \
  scripts/deploy/verify-dns-mapping.* \
  docs/deployment/host-006-dns-runbook.md \
  __tests__/hostSix*

# Must return zero matches: mutating gcloud subcommands in helper sources.
grep -E "secrets versions add|domain-mappings create|run services update|run deploy|dns managed-zones|dns record-sets|compute ssl-certificates|compute forwarding-rules|compute backend-services|compute security-policies" \
  scripts/deploy/preflight-dns.mjs \
  scripts/deploy/verify-dns-mapping.mjs
```

If any line matches, refuse to commit.

---

## Operator steps (if any)

After HOST-006's implementer commits + the PR merges:

1. Operator (re-)reads `docs/deployment/host-006-dns-runbook.md`.
2. Operator runs steps 1–9 of the runbook in order. Each step is operator-runnable; no agent involvement.
3. Operator confirms `node scripts/deploy/verify-dns-mapping.mjs --domain=dev.cdiscourse.com --expected-status-set=401,403` exits 0.
4. Operator proceeds to HOST-007 (IAP attach + tester onboarding). HOST-007 changes the expected status set from `401,403` to `302` (sign-in redirect).

Nothing in HOST-006 requires `npx supabase db push --linked`, `npx supabase functions deploy ...`, or any other Supabase command. **No Supabase write happens.** **No Edge Function deploys.** **No DNS change is performed by the agent.**

---

## Cross-card contracts (summary)

- **HOST-001:** Cloud Run service `cdiscourse-dev` in `us-central1`. `preflight-dns.mjs` reads service state via `gcloud run services describe`. No service spec change.
- **HOST-005:** Secret manifest at `infra/secrets/cdiscourse-dev-manifest.json`. `preflight-dns.mjs` spawns `preflight-secrets.mjs` as a subprocess; forwards its exit codes. No manifest change.
- **HOST-007:** HOST-006 sets up the URL + cert; HOST-007 attaches IAP. After HOST-006, anonymous `curl -I https://dev.cdiscourse.com` returns 401 / 403 from Cloud Run IAM. After HOST-007, it returns 302 to Google sign-in (IAP). `verify-dns-mapping.mjs --expected-status-set=302` is the operator's re-verification step after HOST-007 lands.
- **HOST-008:** prod parallels (`cdiscourse.com` apex domain mapping, `www` CNAME, prod-grade HTTPS LB or domain mapping) documented but stub-only. The reusable surface from HOST-006 is the **pattern** (preflight + verify helper + runbook), not a programmatic interface — HOST-008 will write its own equivalents.

---

## Follow-up discovery issues

Recommend opening these as separate cards if the operator wants to track them:

- **HOST-009 (proposed) — Cloud Audit Log alerting for domain-mappings + Cert events.** Today, every `gcloud beta run domain-mappings create` / `delete` is logged at the project level, but no alert fires. HOST-006 does not configure alerts. Effort: s.
- **HOST-010 (proposed) — TLS cert expiry monitoring for `dev.cdiscourse.com`.** Google-managed certs auto-renew, but anomalies (renewal failure, CA outage) can cause expiry. A scheduled `verify-dns-mapping.mjs` invocation under Cloud Scheduler + alerting would catch it. Effort: s.
- **HOST-011 (proposed) — Cloud DNS migration plan.** Master plan §6 Option B is deferred. When prod cuts over (HOST-008), revisit whether to migrate `cdiscourse.com` from GoDaddy to Cloud DNS. Includes the full zone inventory + recreate procedure. Effort: m.
- **HOST-012 (proposed) — TTL hardening.** After HOST-006 is stable (30 days), raise the `dev.cdiscourse.com` CNAME TTL from 300s to 3600s to reduce DNS query load. Effort: xs.
- **HOST-013 (proposed) — DNS provider lockout drill.** Document procedure if GoDaddy admin access is lost (account compromise, lost MFA, billing issue). Includes domain transfer-out procedure. Out of scope for HOST-006 but worth a card. Effort: s.

These are recommendations, not blockers. The operator decides if and when to open them.

---

## Decisions challenged

**None.** All locked decisions (D1, D2, D3, D5, D6, D8, D9) are honored as stated. The design is a pure consequence of the locked decisions plus the HOST-001 / HOST-005 outputs.

One **minor** clarification that the implementer should note (not a challenge): the master plan §6 mentions both "CNAME at `dev` pointing to `ghs.googlehosted.com`" (for direct domain mapping) and "A record at `dev` pointing to the LB's reserved global static IP" (for the LB path). Because D6 locks the direct-mapping path, **only** the CNAME path applies. The runbook documents only the CNAME case; the A-record case is not mentioned in the runbook because it would invite the wrong path. The risk of this choice is that a future maintainer reading only the runbook might miss the LB option — mitigated by the master plan §6 still being the canonical source of both options.

---

## Readiness statement

This design is implementer-ready. A fresh implementer agent should be able to:

1. Create `feat/HOST-006-...` branch from `main`.
2. Land the 11 new files + 2 modified files exactly as specified above.
3. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run skills:validate` — all green.
4. Commit with message `feat(HOST-006): DNS strategy for dev.cdiscourse.com (GoDaddy + Cloud Run domain mapping)`.
5. Push the branch and open a PR linking issue #88.

The implementer does NOT need to:

- Talk to GCP or run any `gcloud` command.
- Talk to GoDaddy or add any DNS record.
- Talk to Google Search Console.
- Read any secret value or modify any HOST-001 / HOST-005 file.
- Open a new dependency PR.
- Touch any UI or doctrine surface.

Any ambiguity in the helper exit codes, the runbook structure, or the cross-file constraints should be resolved by re-reading the relevant section above; the design is intentionally exhaustive to avoid clarifying questions.
