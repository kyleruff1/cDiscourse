# cutover-health-monitor — operational runbook

**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING
**Edge Function:** `supabase/functions/cutover-health-monitor/index.ts`
**Migration:** `supabase/migrations/20260601000001_cutover_health_metrics_function.sql`
**Classifier:** `src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts`
**Tests:** `__tests__/cutoverHealthAlertModel.test.ts`
**Parent design:** `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` §5.8 / §5.9 / §8 gate 7

## What this Edge Function does

Runs the **6 silent-failure alert conditions** (A–F) on the existing ARCH-001 queue substrate and sends a Resend email to admin profiles when any condition reaches **ALERT** severity. It is the load-bearing piece of the alerting-first sequence the operator chose at PR #410 Stage 0 audit.

| Condition | Source query | PASS | WARN | ALERT |
|---|---|---|---|---|
| A — drainer stale | `classifier_drain_audit` | < 120s | 120–299s | ≥ 300s OR null |
| B — queue backlog | `argument_machine_observation_runs` pending | < 300s | 300–899s | ≥ 900s |
| C — dead-letter spike | `argument_machine_observation_runs` | < 1.0% | 1.0–2.999% | ≥ 3.0% |
| D — direct-dispatch leak | `argument_machine_observation_runs` | 0 | (no warn) | > 0 |
| E — duplicate success | `argument_machine_observation_runs` group-by | 0 | (no warn) | > 0 |
| F — doctrine ban-list | `argument_machine_observation_results` × `_runs` | all 0 | (no warn) | any > 0 |

## What this Edge Function does NOT do

- ❌ Does NOT call Anthropic / xAI / X / MCP / `submit-argument` / `classify-argument-boolean-observations` — zero provider-spend path.
- ❌ Does NOT enable routing — the master flag (`CLASSIFIER_QUEUE_ROUTING_ENABLED`) stays operator-controlled.
- ❌ Does NOT print evidence_span text, body text, prompts, raw provider payloads, JWTs, Bearer tokens, RESEND_API_KEY, or service-role keys.
- ❌ Does NOT alert per-cell results — only aggregated counts and severities.
- ❌ Does NOT modify queue rows / schedule / family registry / production flags.

## Operator setup steps (required before alerting goes live)

The Edge Function code + migration are MERGED, but alerting is INACTIVE until:

### Step 1 — Apply the migration

Auto-applies on merge via the Supabase GitHub integration. Verify post-merge:

```bash
npx supabase db query --linked --file /dev/stdin <<'SQL'
SELECT 1 AS migration_present FROM supabase_migrations.schema_migrations
  WHERE version = '20260601000001';
SQL
```

Expected: 1 row.

### Step 2 — Set the shared secret in Supabase env

`CUTOVER_MONITOR_SHARED_SECRET` is **distinct from `CLASSIFIER_DRAIN_SHARED_SECRET`** — they MUST be different values. Rotating one does NOT rotate the other. Defense in depth: a leaked drainer secret should not grant access to the alerting endpoint, and vice versa.

Dashboard path (no PAT required):
- Supabase console → Project Settings → Edge Functions → Environment Variables.
- Add `CUTOVER_MONITOR_SHARED_SECRET` = a fresh random 64-char value (NOT the drainer secret).
- Save.

Management CLI path (requires PAT in `.claude-tmp/supabase-management.env`):
```bash
npx supabase secrets set CUTOVER_MONITOR_SHARED_SECRET=<random-64-char> --project-ref qsciikhztvzzohssddrq
```

The function will return 401 to ALL invocations until this secret is set (fail-closed).

### Step 3 — Ensure Resend env is configured

The function reuses the existing Resend pattern from `request-argument-deletion` + `room-notifications`.

**Required env vars:**
- `RESEND_API_KEY` (already configured for existing email pipelines)
- `ADMIN_NOTIFICATION_FROM` (already configured for existing email pipelines)
- `ADMIN_NOTIFICATION_TO` — **preferred for ops alerts.** Explicit recipient list, comma OR semicolon separated. Trimmed; empty entries dropped. When at least one recipient is parsed, the function uses this list and skips the admin-profile lookup. Recommended for ops/on-call distribution to addresses that are not necessarily admin-role profiles in the database.

**Optional:**
- `APP_BASE_URL` (used to include a dashboard link in alerts)

**Fallback when `ADMIN_NOTIFICATION_TO` is missing or empty:** the function falls back to the original admin-profile + `auth.users.email` lookup (profiles where `role='admin'`). This preserves backward compatibility.

**Recipient-value handling — operator discipline (mandatory):**
- Recipient email addresses MUST NEVER be committed to git, pasted into chat, or logged. The function itself never returns or logs recipient values.
- Set `ADMIN_NOTIFICATION_TO` via the Supabase dashboard (Edge Functions → Environment Variables) OR via `npx supabase secrets set` from a local shell that does not persist the value to a shell history file. Use a long-lived ops-distribution address (e.g. `ops-cutover-alerts@<your-domain>`) rather than per-person addresses where possible.

**Granular `emailStatus` (response field; never includes recipient values):**

| Value | Meaning | Operator action |
|---|---|---|
| `sent` | Resend returned 2xx | None — confirm admin actually received the email |
| `not_required` | Overall severity was not `alert`; no email attempted | None |
| `not_configured_missing_resend` | `RESEND_API_KEY` env missing or empty | Set the env var |
| `not_configured_missing_from` | `ADMIN_NOTIFICATION_FROM` env missing or empty | Set the env var |
| `not_configured_no_recipients` | `ADMIN_NOTIFICATION_TO` empty AND admin-profile fallback returned zero recipients | Set `ADMIN_NOTIFICATION_TO` to an explicit ops address, OR create at least one `profiles` row with `role='admin'` and a valid `auth.users.email` |
| `failed_recipient_lookup` | Admin-profile fallback threw OR `auth.admin.listUsers` returned an error | Check service-role key validity; check Supabase Auth API availability; consider setting `ADMIN_NOTIFICATION_TO` to bypass the fallback |
| `failed_sanitized` | Email body tripped the defensive `containsForbiddenSubstring` scrub; email dropped to avoid leaking a forbidden token | Investigate the source of the forbidden substring (likely a classifier remediation regression) |
| `failed_resend` | Resend returned non-2xx OR the `fetch` call threw | Check Resend API status (https://status.resend.com); verify `RESEND_API_KEY` is not rotated/rate-limited; check from-domain DNS verification |

The granular split deliberately avoids the previous opaque `not_configured` value — each failure mode is now distinguishable from the operator's side without exposing recipient values.

### Step 4 — Seed the secret into Supabase Vault for cron invocation

The pg_cron job calls the Edge Function via `net.http_post` and must authenticate with the same shared secret. Following the existing classifier-drainer Vault pattern:

```sql
-- Operator runs this via supabase db query --linked --file <path>
SELECT vault.create_secret(
  '<the same value you set in Step 2>',
  'cutover_monitor_shared_secret'
);
```

Verify: `SELECT name FROM vault.decrypted_secrets WHERE name = 'cutover_monitor_shared_secret';`

### Step 5 — Schedule the pg_cron tick (every 5 min)

```sql
SELECT cron.schedule(
  'cutover-health-monitor-tick',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cutover_monitor_url'),
      headers := jsonb_build_object(
        'authorization',
        'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cutover_monitor_shared_secret'),
        'content-type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Verify: `SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'cutover-health-monitor-tick';`

Optional one-off invocation (operator-only) to confirm wiring before scheduling:
```bash
curl -sS -X POST \
  -H "Authorization: Bearer <secret>" \
  -H "content-type: application/json" \
  "<edge-function-url>" \
  | jq '.overallSeverity, .alertCount, .warnCount, .passCount'
```

## Alert behavior

- **Cadence:** every 5 minutes (operator-scheduled).
- **Trigger:** any condition reaching ALERT severity.
- **Sink:** Resend email to all profiles with `role = 'admin'`.
- **Subject:** `[CDISCOURSE CUTOVER ALERT] N alert / M warn`
- **Body:** per-condition severity + observed value + threshold expression + remediation hint.
- **Safety:** body is defensively scanned for forbidden substrings (Supabase PAT prefix, Supabase service-key prefix, JWT prefix, doctrine verdict tokens) before send; if any are detected, the email is dropped (`emailStatus: 'failed_sanitized'`).

## Critical dependencies (watchdog-of-the-watchdog)

**This Edge Function IS the alerting watchdog. If its own cron stops, alerting silently dies.** The operator MUST monitor the watchdog itself. Two layers:

### Layer 1 — watchdog cron freshness (operator-runnable SQL)

Run this query at the SAME cadence as the design's §5.9 Stage 1 M1/M2 checks (every 15 min during Stage 1, every 10 min at Stage 3, alerting-driven at Stage 4+):

```sql
SELECT
  COUNT(*)                                                AS recent_invocations,
  COUNT(*) FILTER (WHERE status = 'succeeded')            AS succeeded_invocations,
  COUNT(*) FILTER (WHERE status = 'failed')               AS failed_invocations,
  EXTRACT(EPOCH FROM (now() - MAX(start_time)))           AS seconds_since_last_invocation
FROM cron.job_run_details d
JOIN cron.job              j ON j.jobid = d.jobid
WHERE j.jobname    = 'cutover-health-monitor-tick'
  AND d.start_time >= now() - INTERVAL '15 minutes';
```

| Verdict | Condition |
|---|---|
| PASS | `recent_invocations >= 2` AND `failed_invocations = 0` AND `seconds_since_last_invocation < 360` |
| WARN | exactly one missed tick (`recent_invocations = 1` OR `seconds_since_last_invocation` 360–599) — investigate before next check |
| **FAIL — IMMEDIATE ROLLBACK** | `recent_invocations = 0` (no ticks at all in the window) OR `failed_invocations > 0` OR `seconds_since_last_invocation >= 600` |

**If FAIL while Stage 1+ is active:** roll back routing IMMEDIATELY by unsetting `CLASSIFIER_QUEUE_ROUTING_ENABLED`. The watchdog is dead; the drainer is unobservable; continuing to route is unsafe.

### Layer 2 — endpoint health probe (operator on-demand)

When Layer 1 disagrees with the dashboard (e.g., cron rows show invocations but no emails arrive), POST directly to the Edge Function URL with a valid Bearer token:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer <secret>" \
  -H "content-type: application/json" \
  "<edge-function-url>" \
  | jq '.overallSeverity, .emailStatus'
```

Expected: `overallSeverity` in `{pass, warn, alert}` (NOT a parse error / 5xx); `emailStatus` is one of the 8 granular values documented in Step 3 (NOT a repeated `failed_*` value).

Failure modes the probe surfaces:
- 5xx response → Edge Function is broken (TypeScript regression, runtime init failure, DB unreachable).
- `emailStatus: 'failed_sanitized'` → body tripped the defensive forbidden-substring scrub; investigate the classifier remediation source for a regression.
- `emailStatus: 'failed_resend'` → Resend rejected the request OR the fetch threw. Check `https://status.resend.com` and verify `RESEND_API_KEY` is not rotated/rate-limited.
- `emailStatus: 'failed_recipient_lookup'` → the admin-profile fallback threw (service-role key rotated, Supabase Auth API unavailable). Set `ADMIN_NOTIFICATION_TO` to bypass the fallback while investigating.
- `emailStatus: 'not_configured_missing_resend'` → `RESEND_API_KEY` env missing or empty.
- `emailStatus: 'not_configured_missing_from'` → `ADMIN_NOTIFICATION_FROM` env missing or empty.
- `emailStatus: 'not_configured_no_recipients'` → `ADMIN_NOTIFICATION_TO` is empty AND no `role = 'admin'` profiles have a valid `auth.users.email`. Set `ADMIN_NOTIFICATION_TO` to an explicit ops distribution address.

### Layer 3 — Resend pre-flight before alerting goes live

Before Step 5's cron schedule is enabled, the operator MUST run the Layer 2 probe with an injected ALERT condition (e.g., by temporarily disabling the drainer cron for 6 min so M1 reaches ALERT band) and CONFIRM at least one admin actually received the Resend email. Verifying `emailStatus: 'sent'` in the response is necessary but not sufficient — the email must land in the admin inbox + not be silently rate-limited / spam-foldered.

**Do not enable the cron schedule (Step 5) until the Layer 3 pre-flight passes.** Without this, a misconfigured Resend or stale `RESEND_API_KEY` produces a system that reports `emailStatus: 'sent'` per request but delivers no actual alert — the worst silent-failure mode.

## Rollback

To disable alerting:

```sql
SELECT cron.unschedule('cutover-health-monitor-tick');
```

Or temporarily: `UPDATE cron.job SET active = false WHERE jobname = 'cutover-health-monitor-tick';`

The Edge Function remains callable (operator on-demand) until the master `CUTOVER_MONITOR_SHARED_SECRET` is unset.

## What gates Stage 1 routing

After this card ships AND operator completes Steps 1–5 above, the **rollback rehearsal** (§8 gate 6 of the cutover design) is the next operator-authorized prompt. Stage 1 begins after rehearsal PASS. Alerting must be active throughout Stage 1.

## Stage 4 alerting gate (future)

The design's original Stage 4 alerting gate is now pre-paid by this card. Stages 1–3's manual cadence (per design §5.9) becomes a 30-min fallback rather than the primary observation method, because the 5-min alerting tick covers Conditions A–F.
