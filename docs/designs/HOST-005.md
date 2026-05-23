# HOST-005 — Secret Manager migration and Cloud Run secret binding

**Status:** Design draft
**Epic:** Hosting
**Release:** 6.8
**Priority:** p0 / Effort: s
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/87
**Branch:** `feat/HOST-005-secret-manager-migration-and-cloud-run-s`
**Card body snapshot:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\HOST-005.md`
**Master plan:** [`docs/deployment/google-cloud-run-hosting-plan.md`](../deployment/google-cloud-run-hosting-plan.md) §7 (especially §7.1 / §7.3 / §7.4 / §7.5)
**Predecessor card:** HOST-001 — design [`docs/designs/HOST-001.md`](./HOST-001.md), runbook [`docs/deployment/host-001-operator-runbook.md`](../deployment/host-001-operator-runbook.md), Phase 3 step 13 explicitly hands off here.
**Successor cards:** HOST-004 (deploy scripts) consumes the manifest + preflight contract defined here; HOST-008 (prod) inherits the same shape under the `cdiscourse-prod-*` namespace, **stub only — not implemented in HOST-005**.

---

## Goal

HOST-005 is the **Secret Manager migration + Cloud Run binding** card. It is the smallest blast radius of the hosting cards and is the next bottleneck after HOST-001 (the container `process.exit(4)`s on every cold start until these two secrets exist and the Cloud Run service binds them via `--set-secrets=`).

This card delivers the **contract + operator runbook + helper scripts** for moving two dev-environment client config values from the operator's local laptop into Google Secret Manager, then naming exactly how Cloud Run binds them as env vars at container start.

The two values are:
1. **`EXPO_PUBLIC_SUPABASE_URL`** — the existing dev Supabase project's REST URL (per D10).
2. **`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** — the existing dev Supabase project's publishable / anon key (per D10). The publishable key is safe by Supabase design; it is routed through Secret Manager anyway so the runtime configuration source is identical across dev and prod and so a single IAM principal (`cdiscourse-dev-runner`) is the only thing with access.

The card **does NOT** own:

- Deploy scripts (HOST-004 owns `scripts/deploy/deploy-cloud-run-dev.*`; HOST-005 only specifies the contract it consumes).
- DNS records (HOST-006).
- IAP / dev access control (HOST-007).
- Production secrets (`cdiscourse-prod-*`) — HOST-008, stub-only.
- Edge Function secrets (service-role, Anthropic, xAI, Resend live in Supabase Function secrets and are **never** bound to Cloud Run).
- Any modification to `src/lib/supabase.ts`, `scripts/runtime/server.mjs`, or `scripts/build/inject-runtime-env.*` — those shipped with HOST-001 and HOST-005 must not change them.
- Any modification to `infra/cloud-run/cdiscourse-dev.template.yaml`. If the template's `secretKeyRef` names disagree with the manifest names HOST-005 produces, **stop and surface the deviation** rather than mutate the template.
- A `.env*` history audit gate — operator skipped that per D11.

Doctrine constraints that shape this design (per `cdiscourse-doctrine` skill + master plan §16):

- **Agent never executes any `gcloud` command.** Helpers print operator-runnable command shapes; the operator pastes them into their own authenticated shell. The card's automation surface is "print" + "verify", never "do".
- **Agent never reads any secret value.** Helpers refuse to accept values as input.
- **No `.env*` file read.** Helpers refuse to open `.env*` even if present on disk.
- **No service-role / Anthropic / xAI / X / Resend keys in Cloud Run env.** The manifest contains only the two v0 names. Helpers reject any name on a forbidden-name list.
- **No new dependency.** Node built-ins (`node:fs`, `node:path`, `node:child_process`) only. No `@google-cloud/secret-manager` SDK — every `gcloud` interaction is an operator-runnable shell command shape that the helper prints to stdout, or (preflight only) a `child_process.spawnSync('gcloud', ...)` call that the operator has implicitly authorized by running the helper.
- **No service-account JSON files in the repo.** Helpers use the operator's existing ADC + impersonation (set up in HOST-001 Phase 1, steps 1 and 14).
- **No production secrets.** A `cdiscourse-prod-*` name in the manifest is a refusal condition.
- **No verdict copy / no AI calls.** The card is pure ops plumbing; no user-facing UI string is added; no AI / external API surface is touched.

---

## Locked decisions inherited (D1–D11, operator 2026-05-19)

These are NOT open. The design assumes them. If the implementer wants to challenge one, surface as an explicit "Design challenges decision Dx" item and stop.

| # | Decision | Value |
|---|---|---|
| D1 | GCP project ID | **`cdiscourse-host`** |
| D2 | Region | **`us-central1`** |
| D8 | Secret Manager migration execution | **Operator runs every `gcloud secrets create` / `gcloud secrets versions add --data-file=-` themselves** when prompted. Agent never executes. Values piped from stdin; no command-line history. |
| D10 | Dev Supabase project | **Reuse the existing dev Supabase project.** Two secrets only at v0: `cdiscourse-dev-supabase-url` and `cdiscourse-dev-supabase-publishable-key`. |
| D11 | `.env*` history audit | **Skipped** per operator confirmation that keys never left local gitignored files. §7.5 rotation criteria apply going forward. |

**Consequences for this design:**

- The manifest is exactly **two** names. No third secret in v0. A future card (e.g. admin email wired into Cloud Run, prod parallels) may extend; HOST-005 does not pre-empt them.
- The "history audit" code path is intentionally absent. The §7.5 rotation criteria are the going-forward policy.
- Every helper assumes operator-run impersonation via the `cdiscourse-deployer` SA (configured in HOST-001 Phase 1 step 9 + Phase 4 step 14). The helper does NOT set impersonation itself; it asserts that `gcloud config get-value project` returns `cdiscourse-host` and exits otherwise.

---

## Secret manifest

### File format decision — JSON

The manifest is a **JSON** file at `infra/secrets/cdiscourse-dev-manifest.json`. Rationale:

- JSON parses with `JSON.parse` (Node built-in) — zero dependency.
- JSON has no comment syntax, which keeps the file dead-simple — a single object literal cannot disguise a value as a comment.
- YAML would require either a parser dependency (forbidden by the no-new-dep doctrine) or a hand-rolled mini-parser (more code to test). The cost of YAML's comment affordance does not outweigh the dependency cost.
- The IAM templates at `infra/iam/*.iam.yaml` are operator-readable narrative + commands and chose YAML for that reason; this manifest is a strict machine contract and chooses JSON for that reason.

### File path

`infra/secrets/cdiscourse-dev-manifest.json`

The implementer creates the `infra/secrets/` directory (it does not yet exist; verified). HOST-008 will later add `cdiscourse-prod-manifest.json` next to it.

### File contents (NAMES ONLY)

```json
{
  "$schema": "./manifest.schema.json",
  "version": 1,
  "environment": "dev",
  "project": "cdiscourse-host",
  "region": "us-central1",
  "runtimeServiceAccount": "cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com",
  "replicationPolicy": "automatic",
  "versionBindingPolicy": "latest",
  "labels": { "env": "dev", "card": "host-005" },
  "secrets": [
    {
      "name": "cdiscourse-dev-supabase-url",
      "cloudRunEnvVar": "EXPO_PUBLIC_SUPABASE_URL",
      "purpose": "Dev Supabase project REST URL. Routed through Secret Manager for parity with prod; not technically secret.",
      "consumerFile": "src/lib/supabase.ts",
      "consumerSymbol": "supabaseUrl"
    },
    {
      "name": "cdiscourse-dev-supabase-publishable-key",
      "cloudRunEnvVar": "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "purpose": "Dev Supabase publishable / anon key. Safe by Supabase design; routed through Secret Manager for parity with prod.",
      "consumerFile": "src/lib/supabase.ts",
      "consumerSymbol": "supabaseAnonKey"
    }
  ]
}
```

The implementer commits this file verbatim. **Every string is either a name, a path, a label, or an enum literal — never a value.**

### Schema (`infra/secrets/manifest.schema.json`)

A draft-07 JSON Schema validating the manifest. Required so future cards can run `validate-manifest --schema=infra/secrets/manifest.schema.json --manifest=infra/secrets/cdiscourse-prod-manifest.json` (HOST-008) without rewriting the schema.

Shape:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CDiscourse Cloud Run Secret Manager manifest",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "environment",
    "project",
    "region",
    "runtimeServiceAccount",
    "replicationPolicy",
    "versionBindingPolicy",
    "labels",
    "secrets"
  ],
  "properties": {
    "$schema": { "type": "string" },
    "version": { "type": "integer", "const": 1 },
    "environment": { "type": "string", "enum": ["dev", "prod"] },
    "project": { "type": "string", "pattern": "^cdiscourse-host$" },
    "region": { "type": "string", "pattern": "^us-central1$" },
    "runtimeServiceAccount": {
      "type": "string",
      "pattern": "^cdiscourse-(dev|prod)-runner@cdiscourse-host\\.iam\\.gserviceaccount\\.com$"
    },
    "replicationPolicy": { "type": "string", "enum": ["automatic"] },
    "versionBindingPolicy": { "type": "string", "enum": ["latest"] },
    "labels": {
      "type": "object",
      "required": ["env"],
      "additionalProperties": { "type": "string" },
      "properties": {
        "env": { "type": "string", "enum": ["dev", "prod"] }
      }
    },
    "secrets": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "cloudRunEnvVar", "purpose", "consumerFile"],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^cdiscourse-(dev|prod)-[a-z0-9-]+$",
            "minLength": 18,
            "maxLength": 63
          },
          "cloudRunEnvVar": {
            "type": "string",
            "pattern": "^EXPO_PUBLIC_[A-Z0-9_]+$"
          },
          "purpose": { "type": "string", "minLength": 8 },
          "consumerFile": { "type": "string", "pattern": "^src/" },
          "consumerSymbol": { "type": "string" }
        }
      }
    }
  }
}
```

The schema's `pattern: "^EXPO_PUBLIC_"` constraint on `cloudRunEnvVar` is the **structural** doctrine guard: no non-public-prefixed env var can be added to Cloud Run via this manifest. Service-role / Anthropic / xAI / Resend names all fail the pattern.

### Forbidden-name list (helpers enforce; not in the manifest itself)

The helpers in `scripts/deploy/print-secret-commands.*` and `scripts/deploy/preflight-secrets.*` carry an explicit denylist on the **secret `name`** field:

```text
SUPABASE_SERVICE_ROLE_KEY
service_role
service-role
sb-secret
sb_secret
ANTHROPIC_API_KEY
anthropic
XAI_API_KEY
xai
X_BEARER_TOKEN
RESEND_API_KEY
resend
```

Any manifest entry whose `name` (case-insensitive) contains any token above is a refusal — helpers exit non-zero and never print a `gcloud` command. The forbidden-name check runs as `name.toLowerCase().includes(token.toLowerCase())`, so `cdiscourse-dev-anthropic` is rejected.

Additionally, helpers refuse if any **value-shaped** literal appears in any manifest field — strings matching:

- `sk-ant-` (Anthropic key prefix)
- `xai-` (xAI key prefix)
- `sb_secret_` (Supabase service-role / secret-key prefix)
- `sb_publishable_` (Supabase publishable-key prefix — placeholder confusion)
- `eyJ` followed by `[A-Za-z0-9_.-]{10,}` (JWT-shaped)
- `Bearer\s+` (OAuth bearer prefix)
- HTTPS URL ending in `.supabase.co` (project ref leak)

Test coverage asserts every token in this list is matched by both the manifest scanner and the printed-command sanitizer.

---

## Cross-card contract — Cloud Run binding (HOST-004 consumes)

### `--set-secrets=` shape

HOST-004's `scripts/deploy/deploy-cloud-run-dev.{mjs,ps1,sh}` will read `infra/secrets/cdiscourse-dev-manifest.json` and assemble:

```text
--set-secrets=EXPO_PUBLIC_SUPABASE_URL=cdiscourse-dev-supabase-url:latest,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=cdiscourse-dev-supabase-publishable-key:latest
```

The algorithm (HOST-004 implements; HOST-005 contracts):

```text
parts = manifest.secrets.map(s => `${s.cloudRunEnvVar}=${s.name}:${manifest.versionBindingPolicy}`)
arg = `--set-secrets=${parts.join(',')}`
```

The `:latest` suffix is per `manifest.versionBindingPolicy`. Pinning to specific version IDs (e.g. `cdiscourse-dev-supabase-url:3`) is a future option but **not v0** — see "Version pinning policy" below.

### Confirmation against `infra/cloud-run/cdiscourse-dev.template.yaml`

The YAML at lines 84–93 already declares:

```yaml
- name: EXPO_PUBLIC_SUPABASE_URL
  valueFrom:
    secretKeyRef:
      name: cdiscourse-dev-supabase-url
      key: latest
- name: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  valueFrom:
    secretKeyRef:
      name: cdiscourse-dev-supabase-publishable-key
      key: latest
```

**Confirmed match.** Both names + both env-var names + `:latest` version policy are identical to the HOST-005 manifest. **No deviation.** If the YAML is ever edited in a way that diverges from the manifest, HOST-005's tests fail (see "Test plan" — a cross-file structural test compares both files).

### Version pinning policy

**v0 = `:latest`.** Rationale:

- v0 has exactly one operator. The operator's rotation cadence is "rotate only on evidence of exposure" (§7.5). Pinned versions only help if multiple deploys race against an in-flight rotation; that race is not possible with one operator.
- Cloud Run binds the value at **container cold start**, not at request time. New revisions pick up the new version automatically on next deploy. Old revisions continue to serve the version that was current at their cold start until they scale to 0 (min-instances=0 means they roll quickly).
- Pinning by integer ID would require the manifest to ship a value-adjacent integer per secret. The manifest is intentionally values-and-IDs-free in v0.

**When to switch to pinned IDs (future card, not HOST-005):**
- Multi-operator deploy environment with simultaneous in-flight changes.
- Compliance regime requiring deterministic revision → secret-version provenance.
- A canary / blue-green pattern that wants old revisions to serve the old secret version even after rotation.

When that day comes, the manifest gains an optional `versionPin: { name: integer }` field; the schema's `versionBindingPolicy` enum expands to `["latest", "pinned"]`; HOST-004's deploy script branches on the policy. **Not in scope here.**

---

## Cross-card contract — HOST-004 preflight

HOST-004 must, before it ever runs `gcloud run deploy ...`, confirm that the Secret Manager secrets named in the manifest actually exist with at least one enabled version. HOST-005 ships the helper that performs this check.

### Interface — `scripts/deploy/preflight-secrets.mjs`

```text
node scripts/deploy/preflight-secrets.mjs \
  --manifest=infra/secrets/cdiscourse-dev-manifest.json \
  [--project=cdiscourse-host] \
  [--strict-project] \
  [--json]
```

Flags:

- `--manifest=<path>` — required. Path to a manifest JSON file. Absolute or repo-relative.
- `--project=<id>` — optional override (default reads `gcloud config get-value project`). The helper refuses if the resolved project does not match `manifest.project` UNLESS `--allow-project-mismatch` is also passed (testing only — guarded by an `if (process.env.HOST_005_TEST !== '1') refuse` clause in the test harness path).
- `--strict-project` — exit non-zero if `gcloud config get-value project` returns anything other than `manifest.project`. Default behaviour without this flag is to **warn** but proceed; HOST-004's deploy script will pass `--strict-project`.
- `--json` — print result as JSON to stdout (for programmatic consumption by HOST-004 deploy script).

Exit codes:

- `0` — all manifest secrets exist with state=ENABLED.
- `2` — manifest parse / schema validation failed (forbidden name, value-shape literal, missing field, schema-pattern mismatch).
- `3` — `gcloud` is not on PATH.
- `4` — `gcloud config get-value project` returns a value other than `manifest.project` AND `--strict-project` was passed.
- `5` — at least one manifest secret has no `state=ENABLED` version.
- `6` — at least one manifest secret does not exist at all.
- `7` — `gcloud secrets list` returned a non-zero exit (auth missing, API not enabled, etc.).

Behaviour (each step is gated; the helper short-circuits on the first failure):

1. Resolve and read manifest file. Refuse if missing.
2. Parse JSON. Refuse on parse error.
3. Validate against the schema (in-process). Refuse on any violation; print the failing path (e.g. `secrets[1].name` does not match pattern).
4. Run the forbidden-name + value-shape scan on every string in the manifest. Refuse if any match.
5. Check `gcloud` is on PATH (`spawnSync('gcloud', ['--version'])`). Refuse if exit != 0.
6. Check `gcloud config get-value project`. Compare to `manifest.project`. Refuse if mismatch AND `--strict-project`.
7. For each `manifest.secrets[i]`:
   - `gcloud secrets describe <name> --project=<project> --format=json` — captures whether the secret exists.
   - `gcloud secrets versions list <name> --project=<project> --filter=state=ENABLED --format='value(name)' --limit=1` — captures whether at least one enabled version exists.
8. Print result to stdout (text or JSON per flag). **Never print a secret value** — the helper only ever reads name + state.

The helper **never** invokes `gcloud secrets versions access`, **never** reads a secret value, **never** writes one.

HOST-004's deploy script's algorithm:

```text
1. Run preflight-secrets --strict-project. If non-zero, refuse to deploy.
2. Assemble --set-secrets= argument from manifest.
3. Run gcloud run deploy ... --set-secrets=<arg>.
```

### Shell wrappers

- `scripts/deploy/preflight-secrets.mjs` — Node entrypoint (real logic).
- `scripts/deploy/preflight-secrets.ps1` — thin wrapper for Windows; forwards to `node ./scripts/deploy/preflight-secrets.mjs $args`.
- `scripts/deploy/preflight-secrets.sh` — thin wrapper for macOS / Linux; forwards to `node ./scripts/deploy/preflight-secrets.mjs "$@"`.

Both wrappers honor `pwsh -File`-style invocation and inherit env from the operator's shell.

---

## Helper script — `scripts/deploy/print-secret-commands.*`

This is the **agent-runnable** helper that operators run **before** they create any secret. It reads the manifest and prints exactly the `gcloud secrets create`, `gcloud secrets add-iam-policy-binding`, and (placeholder-for) `gcloud secrets versions add` command shapes the operator must paste into their own shell.

### Interface — `scripts/deploy/print-secret-commands.mjs`

```text
node scripts/deploy/print-secret-commands.mjs \
  --manifest=infra/secrets/cdiscourse-dev-manifest.json \
  [--include-versions-add] \
  [--include-iam-binding]
```

Flags:

- `--manifest=<path>` — required.
- `--include-versions-add` — also print the **shape** of `printf %s "<VALUE_PLACEHOLDER>" | gcloud secrets versions add <name> --data-file=- --project=...`. Default: ON (operator needs both create + versions add).
- `--include-iam-binding` — also print `gcloud secrets add-iam-policy-binding ... --member=serviceAccount:cdiscourse-dev-runner@... --role=roles/secretmanager.secretAccessor` per secret. Default: ON.

Output format (operator-readable; one section per phase):

```
# HOST-005 — operator-runnable secret commands (generated YYYY-MM-DDTHH:MM:SSZ)
# Manifest: infra/secrets/cdiscourse-dev-manifest.json
# Project:  cdiscourse-host
# Region:   us-central1
# Runtime SA: cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com
#
# The agent did NOT run any of these commands. The operator runs them in
# their own authenticated shell. Values are piped via printf so they never
# appear as argv literals.

# --- Step A: create each secret (run once per secret) ---

gcloud secrets create cdiscourse-dev-supabase-url \
  --replication-policy=automatic \
  --labels=env=dev \
  --project=cdiscourse-host

gcloud secrets create cdiscourse-dev-supabase-publishable-key \
  --replication-policy=automatic \
  --labels=env=dev \
  --project=cdiscourse-host

# --- Step B: add the first version of each secret (operator pipes value via stdin) ---
# IMPORTANT:
#   - <VALUE> is a placeholder. Operator substitutes inline.
#   - Operator runs `Clear-History` (PowerShell) or `history -c` (bash) and
#     clears the clipboard immediately after each command.

printf %s "<PASTE-VALUE-HERE>" | gcloud secrets versions add cdiscourse-dev-supabase-url \
  --data-file=- \
  --project=cdiscourse-host

printf %s "<PASTE-VALUE-HERE>" | gcloud secrets versions add cdiscourse-dev-supabase-publishable-key \
  --data-file=- \
  --project=cdiscourse-host

# --- Step C: bind runtime SA to read each secret ---

gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-url \
  --project=cdiscourse-host \
  --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-publishable-key \
  --project=cdiscourse-host \
  --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# --- Step D: verify ---
# After running A + B + C, run:
#   node scripts/deploy/preflight-secrets.mjs --manifest=infra/secrets/cdiscourse-dev-manifest.json --strict-project
# Exit 0 means the manifest is satisfied; HOST-004 deploy can proceed.
```

Exit codes:

- `0` — printed successfully (manifest parsed, no forbidden names, no value-shaped literals).
- `2` — manifest parse / schema validation failed.
- `3` — manifest contains a forbidden name.
- `4` — manifest contains a value-shaped string literal.
- `5` — `--manifest` flag missing.

Hard refusals:

- **Refuses to accept any value as input.** No `--value` flag. No `--data-file` flag. No stdin reading mode (the helper does not even check `process.stdin.isTTY`).
- **Refuses to read any `.env*` file.** The Node source contains no `fs.readFile*('.env...')` and no `fs.readFile*` of a path that matches `/\.env/`.
- **Refuses if `--include-versions-add` is paired with a value-looking arg** — defense in depth against accidental flag confusion.

**The output goes to stdout only.** No file write. Operator captures via `> /tmp/host-005-commands.sh` if they want a file, but the helper itself never writes one.

### Shell wrappers

- `scripts/deploy/print-secret-commands.mjs` — Node entrypoint.
- `scripts/deploy/print-secret-commands.ps1` — Windows wrapper.
- `scripts/deploy/print-secret-commands.sh` — POSIX wrapper.

---

## Operator runbook (`docs/deployment/host-005-secrets-runbook.md`)

The implementer creates `docs/deployment/host-005-secrets-runbook.md` with the structure below. **Every command is operator-runnable.** Every section carries an explicit "Agent does NOT run this" banner. Both PowerShell and bash command variants are provided where they diverge (e.g. `Clear-History` vs `history -c`).

### Required runbook sections + numbered steps

The runbook has **9 numbered steps**, matching the cross-card contract:

1. **Authenticate.** Operator runs `gcloud auth login` and `gcloud auth application-default login`. Refuse to proceed if `gcloud auth list` shows zero active accounts.

2. **Select project + region.** `gcloud config set project cdiscourse-host` and `gcloud config set run/region us-central1`.

3. **Enable Secret Manager API.** `gcloud services enable secretmanager.googleapis.com --project=cdiscourse-host`. Idempotent — safe to re-run.

4. **Pre-flight: generate the command list.** Operator runs the helper:
   ```bash
   node scripts/deploy/print-secret-commands.mjs \
     --manifest=infra/secrets/cdiscourse-dev-manifest.json \
     > /tmp/host-005-commands.sh
   ```
   Operator inspects `/tmp/host-005-commands.sh` to confirm only the two `cdiscourse-dev-*` names appear and no value-shape literal is present. Helper itself runs a forbidden-name + value-shape scan; this step is a manual visual second pass.

5. **Create each secret.** Operator pastes Step A commands (`gcloud secrets create ...`) into their authenticated shell. Both create commands are idempotent against `--replication-policy=automatic --labels=env=dev`. Verification command: `gcloud secrets describe cdiscourse-dev-supabase-url --project=cdiscourse-host`.

6. **Add the first version of each secret (value via stdin).** Operator pastes Step B commands, **substituting `<PASTE-VALUE-HERE>` with the actual value inline**:
   - `cdiscourse-dev-supabase-url` value is the dev Supabase project's REST URL (e.g. the operator's existing project URL).
   - `cdiscourse-dev-supabase-publishable-key` value is the dev Supabase project's publishable / anon key.

   Immediately after each `versions add` command, operator runs:
   - **PowerShell:** `Clear-History; Set-Clipboard $null`.
   - **bash/zsh:** `history -c; pbcopy < /dev/null` (macOS) or `xclip -selection clipboard < /dev/null` (Linux).

   Verification: `gcloud secrets versions list cdiscourse-dev-supabase-url --project=cdiscourse-host --filter=state=ENABLED --format='table(name,state)'` — must show at least one ENABLED version.

7. **Bind the runtime SA to read each secret.** Operator pastes Step C commands. Idempotent — safe to re-run. Verification: `gcloud secrets get-iam-policy cdiscourse-dev-supabase-url --project=cdiscourse-host --format='value(bindings.role)'` should include `roles/secretmanager.secretAccessor`.

   Note: the runtime SA `cdiscourse-dev-runner` is created by HOST-001 Phase 1 step 6; if it does not yet exist, the binding command fails with `serviceAccount not found`. In that case, return to HOST-001 Phase 1 first.

8. **Run preflight to confirm.** Operator runs:
   ```bash
   node scripts/deploy/preflight-secrets.mjs \
     --manifest=infra/secrets/cdiscourse-dev-manifest.json \
     --strict-project
   ```
   Exit 0 means HOST-005 is complete and HOST-004's deploy script can proceed. Any non-zero exit prints the offending name + state; operator corrects and re-runs.

9. **Hand off back to HOST-001 Phase 4.** With both secrets created + bound + verified, the HOST-001 runbook resumes at step 19 (`gcloud run services replace ...` or the equivalent `gcloud run deploy ...`) — the container will now find `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set at cold start, the entrypoint's `process.exit(4)` path no longer triggers, and the dist `runtime-env.js` shim is written for the SPA.

### Rollback notes per step

- Steps 1–3 are idempotent and have no rollback (auth, config, API enable).
- Step 5 rollback: `gcloud secrets delete <name>` — but **only** if no version has been added (Step 6 not yet run). After Step 6, prefer disabling versions over deleting the secret (see "Rotation procedure").
- Step 6 rollback: `gcloud secrets versions disable <version-id>`. Never `delete --etag` a version that may have been bound to a running revision; disabling is reversible.
- Step 7 rollback: `gcloud secrets remove-iam-policy-binding ...` with the same `--member` and `--role`.

### Explicit "agent does NOT run" markers

Every section header carries:

> **The agent does NOT run any command in this section.** Every `gcloud` step is operator-runnable. The agent writes the runbook + helpers + tests. The operator chooses when to apply each step.

---

## Rotation procedure (§7.5 of the master plan)

### When to rotate

Rotate a key if and only if one of these conditions is met (§7.5 verbatim, plus a v0-specific note):

- The history-leak audit (master plan §7.2) finds a key in a public commit, PR comment, or issue body. **D11 skipped this for v0; the criterion applies going forward.**
- A screenshot in `docs/testing-runs/` shows a key.
- The key has appeared in any external chat, paste service, or log shipped off-laptop.
- The key is over **90 days old** for Anthropic / xAI / Resend (vendor best practice). **Note:** none of those keys are bound to Cloud Run, so this criterion is informational only for HOST-005. It governs Supabase Function secrets, not Cloud Run secrets.
- For Supabase publishable keys: vendor best practice does not require periodic rotation. Rotate only on evidence of exposure or on Supabase dashboard prompt.

### Procedure

1. **Generate the new value.** Operator opens the Supabase dashboard, rotates the key, copies the new value.
2. **Add the new version.** Operator pastes (with inline value substitution, never argv-leaked):
   ```bash
   printf %s "<NEW-VALUE-HERE>" | gcloud secrets versions add cdiscourse-dev-supabase-publishable-key \
     --data-file=- \
     --project=cdiscourse-host
   ```
3. **Clear history + clipboard** immediately.
4. **Trigger a deploy** (HOST-004's deploy script). Cloud Run binds `:latest` at cold start; the new revision serves the new value.
5. **Verify** with `preflight-secrets.mjs` (still passes; new version is ENABLED).
6. **Disable the old version.** Once the new revision is serving 100% traffic AND a smoke check has confirmed Supabase auth still works:
   ```bash
   gcloud secrets versions disable <OLD-VERSION-ID> \
     --secret=cdiscourse-dev-supabase-publishable-key \
     --project=cdiscourse-host
   ```
7. **Never delete the old version** without an audit. Disabled versions remain forensically useful and cost ~$0.06/version/month (master plan §14). Delete only after a documented audit, never reflexively.

### Disable vs delete

- **Disable** = version remains, state changes to `DISABLED`, Cloud Run cannot bind it. Reversible.
- **Delete** = version is gone, etag burned, **irrecoverable**. Delete only after a written audit that confirms no running revision depends on the version.

### Audit trail

Cloud Audit Logs are automatic; no extra config. Every `gcloud secrets versions add`, `disable`, `delete`, and `gcloud secrets get-iam-policy` call is logged at the project level. Audit-log review is operator-run during incident response; HOST-005 does not script it.

---

## File changes

### New files (committed by HOST-005's implementer; not by HOST-005's designer)

- `infra/secrets/cdiscourse-dev-manifest.json` — the canonical name list. ~25 lines.
- `infra/secrets/manifest.schema.json` — draft-07 JSON Schema. ~65 lines.
- `scripts/deploy/print-secret-commands.mjs` — Node entrypoint that reads the manifest and emits operator-runnable command shapes to stdout. ~180 lines.
- `scripts/deploy/print-secret-commands.ps1` — thin Windows wrapper that forwards to the `.mjs`. ~20 lines.
- `scripts/deploy/print-secret-commands.sh` — thin POSIX wrapper that forwards to the `.mjs`. ~15 lines.
- `scripts/deploy/preflight-secrets.mjs` — Node entrypoint that runs `gcloud secrets list / versions list` against the manifest names + verifies state=ENABLED. ~220 lines.
- `scripts/deploy/preflight-secrets.ps1` — Windows wrapper. ~20 lines.
- `scripts/deploy/preflight-secrets.sh` — POSIX wrapper. ~15 lines.
- `docs/deployment/host-005-secrets-runbook.md` — 9 numbered operator-runnable steps + rollback per step + "agent does NOT run" markers. ~200 lines.
- `__tests__/hostFiveSecretManifest.test.ts` — manifest + schema + helper script tests. ~400 lines, ~60 individual tests.

### Modified files (committed by HOST-005's implementer)

- `docs/deployment/host-001-operator-runbook.md` — Phase 3 step 13 already references HOST-005 ("HOST-005 secret create + IAM binding"); extend the body of step 13 to link to `docs/deployment/host-005-secrets-runbook.md` and to mention the two helper scripts by path. **Do not change Phase 1 / 2 / 4 / 5 structure.** Approx +10 lines, no deletions.
- `docs/core/current-status.md` — add a top-level "HOST-005 — Secret Manager migration" section similar in shape to the existing HOST-001 entry. Approx +30 lines, no deletions.

### Explicitly NOT modified

- `infra/cloud-run/cdiscourse-dev.template.yaml` — already declares the two `secretKeyRef` names. **HOST-005 must not edit this.** If a name mismatch ever appears, the implementer surfaces the deviation and stops.
- `infra/iam/cdiscourse-dev-runner.iam.yaml` — already enumerates the two resource-scoped `roles/secretmanager.secretAccessor` bindings (lines 31–43) for the same two secret names. HOST-005 must not edit this.
- `scripts/runtime/server.mjs`, `scripts/build/inject-runtime-env.{mjs,ps1,sh}`, `src/lib/supabase.ts` — HOST-001 shipped these. HOST-005 must not edit them.
- `docs/core/ux-ui-project-board.md` — the implementer of HOST-005 will sync the project board via the existing GitHub Project workflow; the design doc does not pre-stage that edit.
- `docs/deployment/google-cloud-run-hosting-plan.md` — the master plan is reference-only; HOST-005 does not edit it.
- Any production-namespaced file (`cdiscourse-prod-*`). HOST-008 stub-only.

---

## API / interface contracts

### `print-secret-commands.mjs` invocation contract

```text
exit code | meaning
----------+--------
        0 | printed successfully
        2 | manifest parse / schema error (path printed to stderr)
        3 | manifest contains forbidden name (name printed to stderr)
        4 | manifest contains value-shaped literal (no value echoed; only the field path)
        5 | --manifest flag missing
```

Stdout is the operator-pasteable script body. Stderr is for refusal / status messages.

### `preflight-secrets.mjs` invocation contract

```text
exit code | meaning
----------+--------
        0 | all manifest secrets exist + state=ENABLED + IAM binding present
        2 | manifest parse / schema error
        3 | gcloud not on PATH
        4 | gcloud project mismatch (with --strict-project)
        5 | secret exists but has no ENABLED version
        6 | secret does not exist at all
        7 | gcloud subprocess returned non-zero (auth missing, API not enabled, etc.)
```

JSON output schema (when `--json` is passed):

```json
{
  "manifest": "infra/secrets/cdiscourse-dev-manifest.json",
  "project": "cdiscourse-host",
  "checked": [
    { "name": "cdiscourse-dev-supabase-url", "exists": true, "enabledVersions": 1, "hasRuntimeBinding": true },
    { "name": "cdiscourse-dev-supabase-publishable-key", "exists": true, "enabledVersions": 1, "hasRuntimeBinding": true }
  ],
  "summary": { "ok": true, "missing": 0, "noEnabledVersion": 0, "noRuntimeBinding": 0 }
}
```

Even in `--json` mode, the helper never includes any value field. Only `name`, `exists`, `enabledVersions` (count), `hasRuntimeBinding` (boolean).

### Manifest as cross-card source of truth

HOST-004 reads `infra/secrets/cdiscourse-dev-manifest.json` to assemble `--set-secrets=`. HOST-008 will read `infra/secrets/cdiscourse-prod-manifest.json` (when it exists) for the prod parallel. The schema at `infra/secrets/manifest.schema.json` validates both. The schema is the **only** point of truth for what a valid manifest looks like; helpers re-validate against the schema (in-process JSON Schema validator, hand-rolled — no `ajv` dependency).

### "Hand-rolled JSON Schema validator" — scope

The validator covers exactly the features used in `manifest.schema.json`:

- `type` for `object`, `array`, `string`, `integer`.
- `required` arrays.
- `additionalProperties: false`.
- `enum`.
- `const`.
- `pattern` (uses `new RegExp(pattern).test(value)`).
- `minLength` / `maxLength` for strings.
- `minItems` for arrays.
- `properties` recursion.
- `items` recursion.

No `$ref`, no `allOf` / `oneOf` / `anyOf`, no `format`, no `if`/`then`/`else`. If a future schema needs those, the implementer adds them then; the v0 manifest doesn't.

Estimated validator: ~120 lines pure TS / JS, fully unit-tested.

---

## Edge cases

- **Manifest contains zero `secrets`.** Refuse with exit 2 (schema requires `minItems: 1`).
- **Manifest contains a duplicate `name`.** Refuse with exit 2 (the validator checks uniqueness of `name` and `cloudRunEnvVar` even though JSON Schema draft-07 lacks a built-in `uniqueItems` for objects).
- **Manifest contains a `name` that matches the forbidden-name list (case-insensitive).** Refuse with exit 3.
- **Manifest contains a value-shaped literal in any field.** Refuse with exit 4. The scanner checks every string value (recursively).
- **`gcloud` not installed.** Preflight exits 3. Print-commands does not need `gcloud` at all (just generates strings) and ignores its absence.
- **`gcloud` installed but operator not authenticated.** Preflight: `gcloud secrets describe` exits non-zero; helper exits 7. Operator runs `gcloud auth login` and retries.
- **Operator runs against wrong project** (e.g. left `gcloud config` pointed at a personal project). Preflight with `--strict-project` exits 4. Without the flag, prints a warning + proceeds (HOST-004 deploy script always passes `--strict-project`).
- **Runtime SA does not exist yet** (HOST-001 Phase 1 step 6 not run). The `gcloud secrets add-iam-policy-binding` step (operator-run) fails with `Service account ... does not exist`. Runbook step 7 calls out this case and points back to HOST-001.
- **Operator pastes a value into Claude by mistake.** Mitigation: every helper refuses values as input; runbook step 6 says "never paste a secret value into Claude or any agent chat — only into your authenticated shell." If a value does reach the agent: it must NOT be echoed back, NOT be stored, NOT be referenced; operator immediately rotates per §7.5.
- **Operator's shell history persists the value via the `printf` argv.** Mitigation: runbook step 6 mandates `Clear-History` / `history -c` and `Set-Clipboard $null` / `pbcopy < /dev/null` immediately after each `versions add`. Note: `printf %s "<VALUE>"` does put the value in argv, but the `gcloud secrets versions add ... --data-file=-` reads from stdin (not argv), so it's the `printf` invocation alone that needs the history clear — `gcloud`'s own argv never sees the value.
- **Concurrent `versions add`** during a deploy window. Operator advisory only: avoid rotating while a deploy is running; preflight detects only the "exists + enabled" state, not race conditions. (Master plan §7.5 keeps two versions live during rollover; this is the safety net.)
- **Cold start during rotation.** Cloud Run binds at cold start; an in-flight rotation that lands between two cold starts means revision A serves old value, revision B serves new value. For v0 (single operator, eventual consistency acceptable) this is fine. For prod (HOST-008) the recommendation will be pinned version IDs.
- **Manifest schema and Cloud Run YAML drift.** If `infra/cloud-run/cdiscourse-dev.template.yaml` is edited and no longer matches the manifest, the cross-file test (see "Test plan") fails. This is the structural alarm that catches an out-of-band YAML change.
- **A future card adds a third secret.** The manifest schema permits N secrets; no helper hardcodes "exactly 2". The contract scales without code change beyond bumping the manifest array length.

---

## Test plan

All tests live at `__tests__/hostFiveSecretManifest.test.ts`. Test file is a single Jest suite of ~60 individual `it(...)` blocks across the groups below. Use `spawnSync` to exercise the Node entrypoints (matches the HOST-001 test pattern at `__tests__/hostOneBuildScripts.test.ts`).

### Manifest file shape

- `infra/secrets/cdiscourse-dev-manifest.json` exists.
- Parses as JSON.
- Validates against `infra/secrets/manifest.schema.json` (via the in-process hand-rolled validator).
- `secrets` array has **exactly 2** entries (asserts v0 scope — a third entry is a deliberate scope expansion that triggers test failure).
- The two entries have `name` exactly `cdiscourse-dev-supabase-url` and `cdiscourse-dev-supabase-publishable-key` (order-independent).
- The two entries have `cloudRunEnvVar` exactly `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (order-independent).
- `project` is `cdiscourse-host`. `region` is `us-central1`. `runtimeServiceAccount` is `cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com`. `replicationPolicy` is `automatic`. `versionBindingPolicy` is `latest`.
- No string field in the manifest matches any forbidden-name token (case-insensitive).
- No string field matches any value-shape regex (`sk-ant-`, `xai-`, `sb_secret_`, `sb_publishable_`, `eyJ[...]{10,}`, `Bearer\s+`, `https?://.+\.supabase\.co`).

### Schema file shape

- `infra/secrets/manifest.schema.json` exists.
- Parses as JSON.
- `cloudRunEnvVar.pattern` requires `EXPO_PUBLIC_` prefix.
- `name.pattern` requires `cdiscourse-(dev|prod)-` prefix.
- `project.pattern` requires `cdiscourse-host`.
- `region.pattern` requires `us-central1`.
- `versionBindingPolicy.enum` contains `latest`.
- `replicationPolicy.enum` contains `automatic`.

### Cross-file structural consistency

- `infra/cloud-run/cdiscourse-dev.template.yaml` references **both and only** the two manifest secret names in its `secretKeyRef.name` lines.
- `infra/cloud-run/cdiscourse-dev.template.yaml` `env[].name` values include both manifest `cloudRunEnvVar` values.
- `infra/iam/cdiscourse-dev-runner.iam.yaml` `resourceBindings` lists both manifest secret names with `roles/secretmanager.secretAccessor`.

If any of these cross-file assertions fail, the design's "deviation + STOP" rule is triggered.

### `print-secret-commands.mjs` behaviour

- Exists at `scripts/deploy/print-secret-commands.mjs`.
- Wrappers exist at `.ps1` + `.sh`.
- Default-flag invocation against the real manifest exits 0 and prints exactly:
  - The two `gcloud secrets create cdiscourse-dev-supabase-url ...` and `... cdiscourse-dev-supabase-publishable-key ...` commands.
  - The two `printf %s "<PASTE-VALUE-HERE>" | gcloud secrets versions add ...` commands.
  - The two `gcloud secrets add-iam-policy-binding ... --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host..." --role="roles/secretmanager.secretAccessor"` commands.
- Output never contains a real value — the only "value-shaped" string allowed is the literal `<PASTE-VALUE-HERE>` placeholder. Test asserts the output, when scanned with the value-shape regex set, matches only the placeholder (which does not match any of the regexes).
- Output never contains a forbidden name (e.g. `SUPABASE_SERVICE_ROLE_KEY`).
- Output never contains a forbidden-key vendor prefix (`sk-ant-`, `xai-`, `sb_secret_`, `Bearer`).
- Output contains the literal string `# The agent did NOT run any of these commands.`.
- Output contains the literal string `Clear-History` and `history -c` in the inline guidance comments.
- Exit 2 on a manifest with a schema violation (test fixture: a tweaked manifest with `cloudRunEnvVar: "SUPABASE_SERVICE_ROLE_KEY"`).
- Exit 3 on a manifest with a forbidden name (test fixture: `name: "cdiscourse-dev-anthropic-api-key"`).
- Exit 4 on a manifest with a value-shape literal (test fixture: a `purpose` field containing `sk-ant-something`).
- Exit 5 when `--manifest` flag is omitted.
- Source-scan: the `.mjs` source does NOT import `dotenv`, does NOT call `fs.readFile*` on any path containing `.env`, does NOT call `child_process.spawn*('gcloud', ...)` — it only prints strings.
- Source-scan: the `.mjs` source contains the literal `'EXPO_PUBLIC_'` constraint check.

### `preflight-secrets.mjs` behaviour

- Exists at `scripts/deploy/preflight-secrets.mjs`.
- Wrappers exist at `.ps1` + `.sh`.
- Exit 5 when `--manifest` flag is omitted.
- Source-scan: NEVER calls `gcloud secrets versions access` (which would read a value). Test: `expect(src).not.toMatch(/secrets versions access/)`.
- Source-scan: only invokes `gcloud secrets describe`, `gcloud secrets versions list`, `gcloud secrets get-iam-policy`, `gcloud config get-value project`, `gcloud --version`. No other `gcloud` subcommand strings appear.
- Source-scan: never reads `.env*` (same regex set as the inject-runtime-env test).
- Mock test: with `gcloud` replaced by a stub that returns canned JSON, asserts exit 0 when both secrets exist with ENABLED versions and both have IAM bindings.
- Mock test: stub returns "no enabled version" → exit 5.
- Mock test: stub returns "secret not found" → exit 6.
- Mock test: stub `gcloud config get-value project` returns `not-cdiscourse` → exit 4 with `--strict-project`.

The `gcloud` stub is a small Node script at `__tests__/fixtures/host-005-gcloud-stub.mjs` that the test launches via `PATH` or `--gcloud-bin=` override (the helper exposes `--gcloud-bin` for test-only injection; defaults to `gcloud`).

### Operator runbook structure

- `docs/deployment/host-005-secrets-runbook.md` exists.
- Contains exactly 9 numbered top-level steps (regex: `^\s*[1-9]\.\s+\*\*` per line).
- Each numbered step contains a "Verification:" sub-bullet OR an explicit `# verify` comment.
- Every numbered step that contains a `gcloud` command is preceded by "Operator runs:" or "**Agent does NOT run**" framing within the same step body.
- Contains the literal string `Clear-History` and `history -c`.
- Never references `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, `RESEND_API_KEY`.
- Never contains a value-shape literal (full regex sweep).
- References `docs/deployment/host-001-operator-runbook.md` Phase 3 step 13 by name.

### HOST-001 runbook patch

- `docs/deployment/host-001-operator-runbook.md` step 13 contains a link to `docs/deployment/host-005-secrets-runbook.md`.
- Step 13 references `scripts/deploy/print-secret-commands` and `scripts/deploy/preflight-secrets` by name.

### Source safety scan (run across every new file)

- No file contains any literal `sk-ant-`, `xai-`, `sb_secret_`, `Bearer ` followed by a credential-shaped token, or a `https?://.+\.supabase\.co` URL.
- No file contains the literal `SUPABASE_SERVICE_ROLE_KEY` outside a forbidden-name test fixture or comment.
- No file contains `dotenv` import, `require('dotenv')`, or `readFile*` of a path containing `.env`.
- No file contains a hard-coded service-account private key (`-----BEGIN PRIVATE KEY-----`).

### CI sweep

- `npm run typecheck` must pass (the tests are TypeScript; helpers are pure Node `.mjs` and excluded from tsc).
- `npm run lint` must pass.
- `npm run test` must pass, with the new test file included.
- `npm run skills:validate` must pass (no doctrine drift).

---

## Dependencies (cards / docs / files)

- **HOST-001 (PR #93, merged at `2c5030e`)** — this design assumes:
  - The Cloud Run service template at `infra/cloud-run/cdiscourse-dev.template.yaml` already declares `secretKeyRef.name: cdiscourse-dev-supabase-url` and `cdiscourse-dev-supabase-publishable-key`. **HOST-005 cross-checks this in tests but does not modify it.**
  - The runtime SA `cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com` is created by HOST-001 Phase 1 step 6 (operator-run). HOST-005's runbook step 7 explicitly references this dependency.
  - `scripts/runtime/server.mjs` exits 4 when env vars are missing and exits 5 on forbidden secret shapes. HOST-005 produces the values that fill those env vars; HOST-005 does NOT modify `server.mjs`.
  - `src/lib/supabase.ts` reads `window.__CDISCOURSE_RUNTIME_ENV__` first, then `process.env`. HOST-005's bindings ultimately populate the latter; the SPA reads via the former.
- **HOST-001 operator runbook (`docs/deployment/host-001-operator-runbook.md`)** — Phase 3 step 13 hands off to HOST-005. HOST-005 extends step 13 with a link to its own runbook and helper-script paths.
- **HOST-004 (open, blocked on HOST-005)** — consumes the manifest contract:
  - Reads `infra/secrets/cdiscourse-dev-manifest.json`.
  - Calls `node scripts/deploy/preflight-secrets.mjs --manifest=... --strict-project` before any deploy.
  - Assembles `--set-secrets=` from the manifest.
  - HOST-005's tests assert the contract; HOST-004's tests will assert it from the consumer side.
- **HOST-006 / HOST-007** — independent; no contract overlap.
- **HOST-008** — inherits manifest shape under `cdiscourse-prod-manifest.json` namespace; **not implemented in HOST-005**.
- **Master plan §7** — design operationalizes §7.1 (inventory — skipped per D11), §7.3 (gcloud commands), §7.4 (Cloud Run binding), §7.5 (rotation). The plan is the source of truth; HOST-005 implements it.

---

## Risks

- **Operator pastes a value into Claude chat.** Mitigation chain: (a) every helper refuses values as input; (b) runbook step 6 explicitly says "never paste into Claude"; (c) the design has no agent-runnable path that accepts a value. If a value reaches the agent, the agent must NOT echo it back; operator rotates per §7.5.
- **Operator's shell history retains a value via `printf` argv.** Mitigation: runbook step 6 mandates `Clear-History` / `history -c` immediately after each `versions add`. Documented in plain language with both PowerShell and bash variants.
- **Operator runs against the wrong GCP project.** Mitigation: every helper checks `gcloud config get-value project` and refuses on mismatch (with `--strict-project`). HOST-004 always passes `--strict-project`.
- **Secret Manager regional vs automatic replication.** Decision: `automatic`. Rationale: dev workload + single region (us-central1) — multi-region replication adds nothing for v0 and the "automatic" policy is the simpler operational stance. Documented in the manifest as `replicationPolicy: automatic`. Future card may revisit for prod.
- **Runtime SA doesn't exist yet.** Mitigation: runbook step 7 calls this out explicitly; preflight detects the missing IAM binding (exit code triggered when binding check fails).
- **Manifest + Cloud Run YAML drift.** Mitigation: cross-file structural test fails if names diverge. Implementer is required to surface the deviation and stop, not silently align.
- **A future card adds a third secret without updating the schema's structural test.** Mitigation: the "exactly 2 entries" test is intentionally tight. The first card that legitimately needs a third secret must update the test in the same PR — this is the design's "scope guard" mechanism.
- **`gcloud` CLI version drift.** Mitigation: helpers check `gcloud --version` succeeds, but do not pin a minimum version. The commands used (`secrets create`, `versions add`, `add-iam-policy-binding`, `secrets list`, `versions list`, `get-iam-policy`) have been stable across `gcloud` releases since 2020. Future regression is possible but low-risk.
- **Hand-rolled JSON Schema validator drift.** Mitigation: the validator is small (~120 lines), fully unit-tested, and covers only the features used in the schema. If the schema grows beyond the validator's feature set, the test that exercises every schema rule against the manifest fails — the implementer is forced to extend the validator before merging.
- **No new dependency** is required, but: if the implementer reaches for `ajv` or `@google-cloud/secret-manager`, that is a scope expansion that requires operator approval before the design changes.

---

## Out of scope

- **Deploy scripts** (`scripts/deploy/deploy-cloud-run-dev.*`, `scripts/deploy/gcloud-preflight.*`) — HOST-004.
- **DNS records** at GoDaddy or anywhere else — HOST-006.
- **IAP attach / OAuth consent screen** — HOST-007.
- **Production secrets** (`cdiscourse-prod-supabase-url`, etc.) — HOST-008 stub.
- **Edge Function secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, `RESEND_API_KEY`) — these stay in Supabase Function secrets (`npx supabase secrets set ...`). HOST-005 specifically asserts NONE of these names ever appear in a Cloud Run binding.
- **Admin email** wiring into Cloud Run env — out of scope; admin email today lives in the `request-argument-deletion` Edge Function and stays there.
- **`.env*` history audit** — D11 skipped.
- **Rotating Supabase publishable keys preemptively** — vendor best practice does not require this; §7.5 criteria are reactive, not periodic.
- **Multi-region Secret Manager replication** — `automatic` only; no `user-managed` replication policy in v0.
- **Service-account JSON key files** — repo `.dockerignore` already excludes them; ADC + impersonation is the only auth model.
- **Cloud Audit Log alerting** — automatic logging exists; no alerting policy is configured in HOST-005.
- **Any UI surface, copy, or doctrine-touching code path** — pure ops plumbing card.

---

## Doctrine / safety self-check

Walking each `cdiscourse-doctrine` rule:

1. **Score is gameplay analysis, never truth.** No scoring copy added. No verdict tokens introduced. **PASS.**
2. **Heat ≠ truth.** No heat copy. **PASS.**
3. **Popularity is not evidence.** No engagement copy. **PASS.**
4. **AI moderator hard limits.** No AI call from production app. Helpers do not call Anthropic / xAI / X / any AI provider. **PASS.**
5. **Rules engine is sacred.** No change to `src/lib/constitution/engine.ts`. **PASS.**
6. **Secrets policy.** Card's entire purpose is to enforce the secrets policy:
   - Service-role / Anthropic / xAI / X / Resend keys: explicitly forbidden in Cloud Run env; helpers reject these names; tests assert their absence in every artifact. **PASS.**
   - `EXPO_PUBLIC_*` values: routed through Secret Manager via Cloud Run binding (not via committed `.env`). **PASS.**
   - Agent never reads a secret value; helpers never accept one. **PASS.**
   - `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` must remain zero matches — HOST-005 adds no such reference outside test fixtures asserting absence. **PASS.**
7. **No AI calls from the production app.** No AI surface touched. **PASS.**
8. **Supabase conventions.** No migration, no RLS change, no constitution mutation. **PASS.**
9. **Plain language for users.** No user-facing string added. **PASS.**
10. **v1 scope guards.** No voting, no collaborative editing, no OAuth, no public API, no push, no search. **PASS.**

**Additional doctrine layered on top of the universal set (master plan §16, locked decisions D8 / D10 / D11):**

- **D8** Agent never executes any `gcloud` command. Helpers print or verify; operator runs. **PASS.**
- **D10** Reuse existing dev Supabase project; manifest names target the existing project. No new Supabase project created or referenced. **PASS.**
- **D11** No `.env*` history audit gate; §7.5 rotation criteria are the going-forward policy. **PASS.**

**Source-safety final sweep (re-run by implementer at commit time):**

```bash
# Must return zero matches across new files.
grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE\|sk-ant-\|xai-\|sb_secret_\|Bearer " \
  infra/secrets/ scripts/deploy/ docs/deployment/host-005-secrets-runbook.md
```

If any line matches and is not inside a forbidden-name **denylist** literal (which is its own deliberate doctrine assertion), refuse to commit.

---

## Operator steps (if any)

After HOST-005's implementer commits + the PR merges:

1. Operator (re-)reads `docs/deployment/host-005-secrets-runbook.md`.
2. Operator runs steps 1–9 of the runbook in order. Each step is operator-runnable; no agent involvement.
3. Operator confirms `node scripts/deploy/preflight-secrets.mjs --manifest=infra/secrets/cdiscourse-dev-manifest.json --strict-project` exits 0.
4. Operator returns to HOST-001 Phase 4 step 19 (`gcloud run services replace ...`) — the container will now boot successfully because both secrets exist and are bound.

Nothing in this card requires `npx supabase db push --linked`, `npx supabase functions deploy ...`, or any other Supabase command. **No Supabase write happens.** **No Edge Function deploys.** **No DNS mutation.**

---

## Cross-card contracts (summary)

- **HOST-001:** secret names match `infra/cloud-run/cdiscourse-dev.template.yaml` `secretKeyRef.name` entries exactly. Cross-file structural test enforces.
- **HOST-004:** deploy script reads `infra/secrets/cdiscourse-dev-manifest.json` to assemble `--set-secrets=`; calls `scripts/deploy/preflight-secrets.mjs --strict-project` before every deploy. The contract is the JSON file + schema + helper exit codes documented above.
- **HOST-006 (DNS):** no impact. HOST-005's secrets are not domain-bound.
- **HOST-007 (IAP):** no impact. Access control is orthogonal to secret binding.
- **HOST-008 (prod):** inherits manifest shape under `cdiscourse-prod-manifest.json`. The schema permits `environment: "prod"` and `name` pattern `cdiscourse-prod-*`. Helpers are environment-agnostic — they read whatever manifest is passed via `--manifest`. **HOST-005 ships only the dev manifest;** the prod manifest is HOST-008's deliverable.

---

## Follow-up discovery issues

Recommend opening these as separate cards if the operator wants to track them:

- **HOST-009 (proposed) — Cloud Audit Log alerting for Secret Manager access.** Today, every secret access is logged but no alert fires on anomalous patterns (e.g. an unexpected principal calling `secrets versions access`). HOST-005 documents the audit-log existence but does not configure alerts. Effort: s.
- **HOST-010 (proposed) — Pinned version IDs for Cloud Run secret bindings.** When prod cuts over (HOST-008), revisit the `:latest` vs pinned-integer decision. Effort: s.
- **HOST-011 (proposed) — Secret rotation drill.** Schedule a quarterly drill where the operator rotates the Supabase publishable key, runs the §7.5 procedure end-to-end, and confirms zero downtime. Drill produces an audit-log artifact. Effort: s.
- **HOST-012 (proposed) — Migration helper for `.env*` → Secret Manager.** Currently the operator hand-pastes the two values during step 6. A future card may add a `migrate-env-to-secret-manager.mjs` helper that, when run **locally on the operator's laptop**, reads a single `.env.local` file (with explicit operator opt-in flag), pipes each value via `printf | gcloud secrets versions add`, and immediately deletes the local file. **This helper would have to live outside the agent's automation surface** because it reads values; HOST-005 deliberately does not include it. Effort: m.

These are recommendations, not blockers. The operator decides if and when to open them.

---

## Readiness statement

This design is implementer-ready. A fresh implementer agent should be able to:

1. Create `feat/HOST-005-...` branch from `main`.
2. Land the 8 new files + 2 modified files exactly as specified above.
3. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run skills:validate` — all green.
4. Commit with message `feat(HOST-005): Secret Manager migration manifest + helpers + runbook`.
5. Push the branch and open a PR linking issue #87.

The implementer does NOT need to:

- Talk to GCP or run any `gcloud` command.
- Read any secret value.
- Modify any HOST-001 file.
- Open a new dependency PR.
- Touch any UI or doctrine surface.

Any ambiguity in the schema, the helper exit codes, or the runbook structure should be resolved by re-reading the relevant section above; the design is intentionally exhaustive to avoid clarifying questions.
