# Claude Code on Google Vertex AI — Setup Note

_Last updated: 2026-05-19. This document is a **note**, not a runbook. Vertex AI setup is an operator-run, optional configuration and is **completely separate** from app hosting._

---

## Why this is a separate doc

Vertex AI and Cloud Run are both Google Cloud products, but they serve different purposes for CDiscourse:

| | Cloud Run (app hosting) | Vertex AI (Claude Code routing) |
|---|---|---|
| What runs there | The Expo web build of the CDiscourse app | Nothing belonging to the app; it's a model-routing endpoint for Claude Code (the CLI) |
| Who consumes it | End users in a browser | The operator's Claude Code CLI |
| Lives in | `docs/deployment/google-cloud-run-hosting-plan.md` | This file |
| Touches the app code | Yes — Cloud Run service runs the bundle | No — the app does not call Vertex AI |
| Touches the app's secrets | Yes via Secret Manager binding | No |
| Required for production | Yes | No |

**Do not mix the two.** Configuring `CLAUDE_CODE_USE_VERTEX=1` in the operator's shell has no effect on Cloud Run. Deploying the app to Cloud Run does not require Vertex AI access. Vertex AI is purely an inference-routing convenience for the operator's local Claude Code session.

---

## When this matters

Use Vertex AI for Claude Code if any of the following is true:
- You want Claude Code billing to flow through your existing GCP billing account rather than a separate Anthropic console subscription.
- Your organization requires that AI model calls stay inside a GCP project boundary (audit logs in Cloud Logging, etc.).
- You want region-pinning of inference (`us-east5`, `europe-west1`, etc.) for residency reasons.

If none of those apply, **skip this entirely** and continue using Claude Code's default Anthropic-routed endpoint. The default works fine for everything in this repo.

---

## Manual setup (operator runs)

Prerequisites:
- A GCP project with **billing enabled**.
- Google Cloud SDK installed and authenticated (`gcloud auth login`, `gcloud auth application-default login`).
- The **Vertex AI API enabled** in the project: `gcloud services enable aiplatform.googleapis.com`.
- **Claude model access** in Vertex AI Model Garden — the operator must request access to the specific Claude model(s) they want to use (Opus 4.7, Sonnet 4.6, Haiku 4.5, etc.) in the Model Garden UI. Access provisioning is per-model and per-region.
- **Quota** for the chosen model + region. New GCP projects start at low TPM (tokens per minute) limits; the operator may need to request a quota increase.
- **Claude Code v2.1.98 or later** (current Anthropic docs reference this minimum for stable Vertex routing). Verify with `claude --version`.

### Environment variables

The operator sets these in their shell profile (`$PROFILE` for PowerShell, `~/.zshrc` / `~/.bashrc` for bash/zsh):

```powershell
# PowerShell
$env:CLAUDE_CODE_USE_VERTEX = "1"
$env:CLOUD_ML_REGION = "us-east5"            # or "global", or whichever region the operator has model access in
$env:ANTHROPIC_VERTEX_PROJECT_ID = "<gcp-project-id>"
```

```bash
# bash / zsh
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION=us-east5
export ANTHROPIC_VERTEX_PROJECT_ID=<gcp-project-id>
```

Notes:
- `CLOUD_ML_REGION` must match a region where the operator has Claude model access in Vertex Model Garden. `global` works for some Claude models in newer Vertex configurations; check the current Anthropic docs.
- `ANTHROPIC_VERTEX_PROJECT_ID` is the GCP project ID, **not** the project number.
- Application Default Credentials (set by `gcloud auth application-default login`) are how Claude Code authenticates to Vertex. No API key is required when using Vertex routing.

### Verify

After setting the env vars, restart Claude Code and run any short prompt. If routing is correct, the request will show up in `Cloud Logging → Logs Explorer` under the `aiplatform.googleapis.com` resource. If it isn't, double-check that the model is accessible in the chosen region.

---

## What NOT to commit

- **No service-account JSON key files** anywhere in the repo. Application Default Credentials live under `~/.config/gcloud/` on the operator's machine; that path is per-user and never touched by the repo.
- **No `ANTHROPIC_API_KEY`** when using Vertex routing — Vertex routes via ADC, not via an API key. If `ANTHROPIC_API_KEY` is set in the shell at the same time as `CLAUDE_CODE_USE_VERTEX=1`, behavior is undefined; prefer to unset the API key when Vertex routing is active.
- **No GCP project IDs in commits if your organization treats project IDs as sensitive.** For CDiscourse the project ID is not currently treated as secret, but if the operator decides otherwise, `ANTHROPIC_VERTEX_PROJECT_ID` should be set only in their local shell profile and never committed to the repo.

---

## Relation to `cdiscourse.com` hosting

None. The app:
- Does not call Anthropic, OpenAI, xAI, or any other LLM provider directly from the client.
- Does not call Anthropic from Cloud Run.
- Calls Anthropic only from Edge Functions (operator-gated bot fixtures), where the API key lives in Supabase Function secrets — **not** in Vertex AI, **not** in Cloud Run env vars, **not** in Secret Manager.

If a future Edge Function is rewritten to call Anthropic through Vertex AI for residency reasons, that gets its own card. It is **not** part of HOST-001 / the Cloud Run hosting plan.

---

## Reference

The authoritative source for Vertex AI configuration is Anthropic's official "Claude on Vertex AI" docs. The values above match what those docs specified at the time of this file's last-updated date; if a later Claude Code version changes the env-var names, defer to the official docs.
