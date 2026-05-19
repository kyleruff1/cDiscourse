# HOST-005 — Secret Manager operator runbook (dev)

This runbook is for the **human operator** of the `cdiscourse-host` GCP project. It walks through creating, versioning, and binding the two Secret Manager secrets that Cloud Run consumes at container cold start for the `cdiscourse-dev` service.

**The agent does NOT run any `gcloud` command in this runbook.** The agent wrote the helpers + this runbook + the tests. The operator chooses when to apply each step. Every numbered step is operator-runnable; the agent has no execution path here.

Locked decisions (D1–D11):

- D1 GCP project: `cdiscourse-host`
- D2 Region: `us-central1`
- D8 Operator runs every `gcloud secrets create` / `gcloud secrets versions add` themselves. **Agent never executes.**
- D10 Reuse the existing dev Supabase project. Two secrets at v0:
  - `cdiscourse-dev-supabase-url`
  - `cdiscourse-dev-supabase-publishable-key`
- D11 `.env*` history audit skipped. §7.5 rotation criteria are the going-forward policy.

The manifest at [`infra/secrets/cdiscourse-dev-manifest.json`](../../infra/secrets/cdiscourse-dev-manifest.json) is the canonical name list. It contains **only names** — no values. The schema at [`infra/secrets/manifest.schema.json`](../../infra/secrets/manifest.schema.json) defines what a valid manifest looks like.

The two helpers live under [`scripts/deploy/`](../../scripts/deploy/):

- `print-secret-commands.mjs` — emits the operator-runnable command shapes for Steps 5, 6, 7. **Does not run gcloud.** Stdout only. Refuses to accept any value as input.
- `preflight-secrets.mjs` — verifies (via local `gcloud`) that every named secret exists with at least one ENABLED version and (optionally) that the runtime SA has the secretAccessor binding. **NEVER calls `gcloud secrets versions access`.**

The PowerShell + bash wrappers (`.ps1` / `.sh`) for each are thin shells that forward args to the `.mjs`.

Forbidden in this runbook:

- `SUPABASE_SERVICE_ROLE_KEY` — stays in Supabase Function secrets, never bound to Cloud Run.
- `ANTHROPIC_API_KEY` — same.
- `XAI_API_KEY` / `X_BEARER_TOKEN` — same.
- `RESEND_API_KEY` — same.
- Any production secret (`cdiscourse-prod-*`) — HOST-008 stub; not in scope here.

---

## Step-by-step (9 numbered steps)

### 1. **Authenticate.**

> **The agent does NOT run any command in this section.** Operator runs these in their own authenticated shell.

Operator runs:

```bash
gcloud auth login
gcloud auth application-default login
```

Verification: `gcloud auth list` shows at least one active account. If it shows none, do NOT proceed — every subsequent step would fail with auth errors.

Rollback: `gcloud auth revoke <ACCOUNT>` is available but rarely needed; running the login again is idempotent.

### 2. **Select project + region.**

> **The agent does NOT run any command in this section.** Operator runs these in their own authenticated shell.

Operator runs:

```bash
gcloud config set project cdiscourse-host
gcloud config set run/region us-central1
```

Verification: `gcloud config get-value project` returns `cdiscourse-host`. `gcloud config get-value run/region` returns `us-central1`.

Rollback: re-run with different values; `gcloud config unset <key>` clears.

### 3. **Enable Secret Manager API.**

> **The agent does NOT run any command in this section.** Operator runs these in their own authenticated shell.

Operator runs:

```bash
gcloud services enable secretmanager.googleapis.com --project=cdiscourse-host
```

This is idempotent — safe to re-run. Verification: `gcloud services list --enabled --project=cdiscourse-host --filter="name:secretmanager.googleapis.com"` lists the API.

Rollback: `gcloud services disable secretmanager.googleapis.com` (but this also disables read on any existing secrets — only run if you mean it).

### 4. **Pre-flight: generate the command list.**

> **The agent does NOT run gcloud in this section.** Operator runs the helper locally; the helper only prints command shapes to stdout. No `gcloud` call is made by the helper.

Operator runs:

```bash
node scripts/deploy/print-secret-commands.mjs \
  --manifest=infra/secrets/cdiscourse-dev-manifest.json \
  > /tmp/host-005-commands.sh
```

(On Windows PowerShell: `node scripts/deploy/print-secret-commands.mjs --manifest=infra/secrets/cdiscourse-dev-manifest.json | Out-File -Encoding utf8 $env:TEMP\host-005-commands.sh`.)

Verification: open `/tmp/host-005-commands.sh` and confirm:

- Only the two `cdiscourse-dev-*` names appear.
- No real value appears anywhere. The only placeholder is the `--data-file=-` flag (stdin) — there is no `<PASTE-VALUE-HERE>` substitution on the command line.
- The header contains `# The agent did NOT run any of these commands.`

The helper itself runs a forbidden-name + value-shape scan; this step is a manual visual second pass.

Rollback: delete the temporary file: `rm /tmp/host-005-commands.sh`.

### 5. **Create each secret.**

> **The agent does NOT run any command in this section.** Operator pastes Step A from `/tmp/host-005-commands.sh` into their authenticated shell.

Operator runs (per secret):

```bash
gcloud secrets create cdiscourse-dev-supabase-url \
  --replication-policy=automatic \
  --labels=env=dev,card=host-005 \
  --project=cdiscourse-host

gcloud secrets create cdiscourse-dev-supabase-publishable-key \
  --replication-policy=automatic \
  --labels=env=dev,card=host-005 \
  --project=cdiscourse-host
```

Verification: `gcloud secrets describe cdiscourse-dev-supabase-url --project=cdiscourse-host` returns the secret metadata (creation time, replication policy `automatic`). Same for `cdiscourse-dev-supabase-publishable-key`.

Rollback: `gcloud secrets delete <name> --project=cdiscourse-host` — but **only** if Step 6 has not yet run. After a version exists, prefer `versions disable` over `secrets delete`.

### 6. **Add the first version of each secret (value via stdin).**

> **The agent does NOT run any command in this section.** Operator pastes Step B and types or pastes the value directly into the shell's stdin. The value is NEVER passed as an argv literal and NEVER read from a file by the helper.

Operator runs (per secret):

```bash
gcloud secrets versions add cdiscourse-dev-supabase-url \
  --data-file=- \
  --project=cdiscourse-host
```

After the prompt appears, the operator types or pastes the value and sends EOF:

- bash / zsh: press `Ctrl-D` after the value.
- PowerShell: press `Ctrl-Z` then `Enter` after the value.

Repeat for `cdiscourse-dev-supabase-publishable-key`:

```bash
gcloud secrets versions add cdiscourse-dev-supabase-publishable-key \
  --data-file=- \
  --project=cdiscourse-host
```

Immediately after each `versions add` command, the operator clears history + clipboard:

- **PowerShell:** `Clear-History; Set-Clipboard $null`
- **bash / zsh (macOS):** `history -c; pbcopy < /dev/null`
- **bash / zsh (Linux):** `history -c; xclip -selection clipboard < /dev/null`

The two values are:

- `cdiscourse-dev-supabase-url` — the dev Supabase project's REST URL (operator already has this in their existing local config).
- `cdiscourse-dev-supabase-publishable-key` — the dev Supabase project's publishable / anon key. Safe by Supabase design (it cannot bypass RLS), but routed through Secret Manager for parity with prod.

> **Never paste a secret value into Claude or any agent chat — only into your authenticated shell.** If a value reaches the agent by mistake: the agent must NOT echo it back; rotate the key per §7.5 of the master plan.

Verification:

```bash
gcloud secrets versions list cdiscourse-dev-supabase-url \
  --project=cdiscourse-host \
  --filter=state=ENABLED \
  --format='table(name,state)'
```

Must show at least one ENABLED version. Same for the publishable-key secret.

Rollback: `gcloud secrets versions disable <VERSION-ID> --secret=<NAME> --project=cdiscourse-host`. Disabling is reversible (`versions enable`). Avoid `versions destroy` — that is irreversible.

### 7. **Bind the runtime SA to read each secret.**

> **The agent does NOT run any command in this section.** Operator pastes Step C from `/tmp/host-005-commands.sh`.

Operator runs (per secret):

```bash
gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-url \
  --project=cdiscourse-host \
  --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-publishable-key \
  --project=cdiscourse-host \
  --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

These commands are idempotent — re-running has no effect once the binding exists.

Note: the runtime SA `cdiscourse-dev-runner` is created by HOST-001 Phase 1 step 6. If it does not yet exist, the `add-iam-policy-binding` command fails with `Service account ... does not exist`. In that case, return to [`docs/deployment/host-001-operator-runbook.md`](./host-001-operator-runbook.md) Phase 1 first and create the runtime SA.

Verification:

```bash
gcloud secrets get-iam-policy cdiscourse-dev-supabase-url \
  --project=cdiscourse-host \
  --format='value(bindings.role)'
```

Output must include `roles/secretmanager.secretAccessor`. Same for the publishable-key secret.

Rollback: `gcloud secrets remove-iam-policy-binding <NAME> --project=cdiscourse-host --member="serviceAccount:cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"`.

### 8. **Run preflight to confirm.**

> **The agent does NOT run gcloud directly in this section.** The operator invokes the helper, which itself calls `gcloud secrets describe` / `versions list` / `get-iam-policy` — never `gcloud secrets versions access` (which would read a value).

Operator runs:

```bash
node scripts/deploy/preflight-secrets.mjs \
  --manifest=infra/secrets/cdiscourse-dev-manifest.json \
  --strict-project
```

Exit 0 means HOST-005 is complete and HOST-004's deploy script can proceed. Any non-zero exit prints the offending name + state; operator corrects and re-runs.

Exit codes:

- `0` — all manifest secrets exist + ENABLED + IAM binding present.
- `2` — manifest parse / schema error.
- `3` — `gcloud` is not on PATH.
- `4` — `gcloud config get-value project` returns a value other than `cdiscourse-host` AND `--strict-project` was passed.
- `5` — at least one manifest secret has no ENABLED version OR is missing its IAM binding.
- `6` — at least one manifest secret does not exist at all.
- `7` — `gcloud` subprocess returned non-zero (auth missing, API not enabled, network, etc.).

Verification: re-run the same command; exit must be 0.

Rollback: not applicable (read-only command).

### 9. **Hand off back to HOST-001 Phase 4.**

With both secrets created + bound + verified, the [`docs/deployment/host-001-operator-runbook.md`](./host-001-operator-runbook.md) resumes at Phase 4 step 19 (`gcloud run services replace ...` or the equivalent `gcloud run deploy ...`).

The container will now find `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set at cold start, the entrypoint's `process.exit(4)` path no longer triggers, and the `dist/runtime-env.js` shim is written for the SPA.

Rollback: not applicable — this is a return-to-caller step.

---

## Rotation procedure (§7.5 reminder)

For full rotation policy see master plan §7.5 in [`docs/deployment/google-cloud-run-hosting-plan.md`](./google-cloud-run-hosting-plan.md). Short version:

1. Operator opens Supabase dashboard, rotates the key, copies the new value.
2. Operator runs (with stdin paste, never argv):
   ```bash
   gcloud secrets versions add cdiscourse-dev-supabase-publishable-key \
     --data-file=- \
     --project=cdiscourse-host
   ```
   Then Ctrl-D / Ctrl-Z+Enter.
3. Operator clears history + clipboard immediately: `Clear-History; Set-Clipboard $null` (PowerShell) or `history -c; pbcopy < /dev/null` (bash).
4. Operator triggers a deploy (HOST-004). Cloud Run binds `:latest` at cold start.
5. Operator runs preflight to confirm. Exit 0.
6. Operator disables the old version once smoke is green:
   ```bash
   gcloud secrets versions disable <OLD-VERSION-ID> \
     --secret=cdiscourse-dev-supabase-publishable-key \
     --project=cdiscourse-host
   ```
7. Never `versions destroy` without a written audit. Disabled versions cost ~$0.06/month and remain forensically useful.

Rotate when (master plan §7.5):

- History audit (skipped for v0 per D11; criterion applies going forward).
- Screenshot in `docs/testing-runs/` shows a key.
- Key appeared in any external chat, paste, or log.
- Operator suspects exposure.
- Vendor (Supabase) prompts rotation.

---

## Cross-card pointers

- HOST-001 Phase 3 step 13 ([`docs/deployment/host-001-operator-runbook.md`](./host-001-operator-runbook.md)) hands off here.
- HOST-004 (deploy scripts) consumes the manifest contract — `--set-secrets=` is assembled from `infra/secrets/cdiscourse-dev-manifest.json`.
- HOST-006 (DNS) and HOST-007 (IAP) are orthogonal to this card.
- HOST-008 (prod) will add `infra/secrets/cdiscourse-prod-manifest.json` under the same schema. Not in scope for HOST-005.
