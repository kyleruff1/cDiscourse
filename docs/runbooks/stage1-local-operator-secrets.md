# stage1-local-operator-secrets — operator runbook

**Card:** OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP
**Local secrets file (gitignored, operator-prepared):** `.claude-tmp/operator-secrets.env`
**Verifier script:** `scripts/ops/stage1/check-operator-secrets.sh`
**Consumers:** `scripts/ops/stage1/arm-stage1-1pct.sh`, `scripts/ops/stage1/disarm-stage1.sh`
**Sibling docs:** `docs/runbooks/stage1-observation.md`, `docs/runbooks/cutover-health-monitor.md`
**Stage-1 audits this supports:** `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md` (OBSERVING), `docs/audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md` (PARTIAL)

## What this runbook covers

How the operator prepares the gitignored local secrets file that the Stage-1 arm / disarm scripts read, and how `check-operator-secrets.sh` confirms the file is complete **by NAME only**, without ever printing a value. The arming step itself is documented in the Stage-1 audit (§2); this runbook is strictly about the local secret material those scripts consume.

The single hard rule that governs this entire runbook: **secret values NEVER appear in any script, doc, log, commit, PR, or chat.** Everything below is designed to keep it that way. No real or realistic-looking token value appears anywhere in this document — only the three NAMES.

## The three required secret NAMES

`.claude-tmp/operator-secrets.env` is a plain `KEY=value` env file that the operator creates locally. It is gitignored (under `.claude-tmp/`) and is **never** committed. It must define these three names, each with a non-empty value:

| NAME | Role | Used by |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Operator account personal access token for the Supabase CLI. Used by the arm / disarm scripts to set the routing env vars via `supabase secrets set`. | `arm-stage1-1pct.sh`, `disarm-stage1.sh` |
| `MCP_SERVER_BEARER_TOKEN` | Shared secret for the hosted MCP server endpoint. Referenced by NAME for completeness of the Stage-1 secret set; the read-only observation pack does not transmit it. | reserved / referenced by name |
| `CUTOVER_MONITOR_SHARED_SECRET` | Shared secret the `cutover-health-monitor` Edge Function authenticates against. Set separately in the Supabase Edge env + Vault (see `docs/runbooks/cutover-health-monitor.md` Steps 2 + 4); the local copy here lets the verifier confirm the operator holds the same value the monitor expects. | `cutover-health-monitor` (server-side); verifier presence-check only |

Notes on each:

- **`SUPABASE_ACCESS_TOKEN` must be a valid account PAT.** The Stage-1 audit (§2) records a real failure mode: a malformed token (wrong length / unrecognized prefix) caused `supabase secrets set` to reject the request with a decode error, and `arm-stage1-1pct.sh` aborted **before changing any state** (production routing stayed off). The verifier here only checks presence-by-name; it does NOT validate the token shape or call any API. A present-but-invalid token still surfaces at arm time as a clean abort, not a partial state change.
- **`CUTOVER_MONITOR_SHARED_SECRET` is distinct from the drainer secret.** Per the monitor runbook, the cutover-monitor secret and the classifier-drainer secret are deliberately different values; rotating one does not rotate the other. The local file holds only the cutover-monitor value.
- These three are the complete Stage-1 set the verifier enforces. Adding more names to the file is harmless; omitting any of these three fails the verifier.

## Preparing the file

1. Create `.claude-tmp/operator-secrets.env` locally (the `.claude-tmp/` directory is gitignored). Do NOT create it anywhere tracked by git.
2. Add one `NAME=value` line per required name. Use a plain ASCII file — no BOM, no CRLF line endings. The Stage-1 audit (§2) notes that a clean-but-invalid-token file passed file-shape checks while still failing at arm time, so file hygiene and token validity are separate concerns.
3. Save the file. Confirm it is NOT staged: it must never appear in `git status` as a tracked or staged path. If it does, it is in the wrong location — move it under `.claude-tmp/`.
4. Run the verifier (next section). Do not paste the file contents into chat, a PR description, a commit message, or any log to "show it worked" — the verifier output is the only evidence you need, and it prints names only.

## How the verifier confirms presence by NAME

`scripts/ops/stage1/check-operator-secrets.sh`:

- Starts with `#!/usr/bin/env bash`, then `set -uo pipefail`, then `set +x`. The `set +x` is load-bearing: with xtrace off, the line that sources the secrets file is never echoed, so no value is ever written to the terminal or a captured log.
- Aborts with a clear `MISSING:` message and a non-zero exit if `.claude-tmp/operator-secrets.env` does not exist.
- Sources the file, then for each of `SUPABASE_ACCESS_TOKEN`, `MCP_SERVER_BEARER_TOKEN`, `CUTOVER_MONITOR_SHARED_SECRET`, uses indirect expansion to test whether the value is non-empty. It prints `PRESENT: <NAME>` or `MISSING: <NAME>` — **the value itself is never expanded into the output.**
- Prints `RESULT: PASS — all 3 operator secrets present (values never printed)` and exits 0 when all three are present, or `RESULT: FAIL` with a non-zero exit when one or more is missing.

Run it:

```bash
bash scripts/ops/stage1/check-operator-secrets.sh
```

Expected on a correctly prepared file:

```
PRESENT: SUPABASE_ACCESS_TOKEN
PRESENT: MCP_SERVER_BEARER_TOKEN
PRESENT: CUTOVER_MONITOR_SHARED_SECRET
RESULT: PASS — all 3 operator secrets present (values never printed)
```

If you see any `MISSING:` line, add the named entry to the file and re-run. The verifier never tells you *what* a value should be — only whether a non-empty value is present under that name.

## The `set +x` discipline (mandatory for every Stage-1 script)

Every script under `scripts/ops/stage1/` follows the same opening contract so that no value can leak via shell trace:

1. `#!/usr/bin/env bash`
2. `set -uo pipefail`
3. `set +x`

`set +x` explicitly disables command tracing even if an ambient `BASH_XTRACEFD` / inherited xtrace is in effect. Combined with sourcing the env file rather than passing values on a command line, and with indirect expansion for presence checks, this guarantees the secret material is read into the process environment but never rendered to stdout/stderr. The arm / disarm scripts additionally pass the PAT to the CLI as an environment prefix (never as an echoed argument), so the value is not visible in process listings or trace output either.

## Hard rule: values never appear anywhere

This is non-negotiable and applies to every Stage-1 surface:

- **Never** commit `.claude-tmp/operator-secrets.env` (it is gitignored; keep it that way — do not add a tracked copy "for convenience").
- **Never** paste a secret value into chat, a PR description, a commit message, an audit doc, this runbook, or any issue comment.
- **Never** log a value. Scripts print names + presence + result strings only. If you add a new Stage-1 script, keep `set +x` and never `echo` a value.
- **Never** include a real or realistic-looking token literal in any committed file. The committed scripts and docs reference these secrets **by name only** — the values live exclusively in the operator's gitignored local file and in the Supabase Edge env / Vault, which are managed through the Supabase console or the CLI from a shell that does not persist the value to history.
- Reference secrets by NAME in all written material. Phrasing like "set `CUTOVER_MONITOR_SHARED_SECRET`" or "the operator token referenced by name" is correct; printing or transcribing the value is not.

## Where each secret is actually consumed

| Secret NAME | Local file role | Authoritative store | Documented in |
|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | sourced by arm / disarm scripts to authenticate the CLI for `supabase secrets set` | operator's account (PAT) | Stage-1 audit §2 / §7 |
| `MCP_SERVER_BEARER_TOKEN` | presence-checked for set completeness | hosted MCP server config | (referenced by name only) |
| `CUTOVER_MONITOR_SHARED_SECRET` | presence-checked; must match the server-side value | Supabase Edge env + Vault | `docs/runbooks/cutover-health-monitor.md` Steps 2 + 4 |

The read-only **observation** pack (`docs/runbooks/stage1-observation.md`) does **not** source any of these — it authenticates via the project link (`supabase db query --linked`), not the account token. Only the **mutating** arm / disarm scripts use `SUPABASE_ACCESS_TOKEN`. This separation keeps the day-to-day observation cadence off the privileged-token path entirely.

## Cross-references

- Arming the 1% config (uses `SUPABASE_ACCESS_TOKEN`): `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md` §2 + §7.
- Synthetic launch qualification against the armed config: `docs/audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md`.
- Cutover-monitor secret setup (Edge env + Vault): `docs/runbooks/cutover-health-monitor.md` Steps 2 + 4.
- Read-only observation cadence: `docs/runbooks/stage1-observation.md`.
