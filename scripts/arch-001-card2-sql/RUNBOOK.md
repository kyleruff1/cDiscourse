# ARCH-001 Card 2 — Classifier queue operator runbook

Operator-facing runbook for the ARCH-001 classifier queue (drainer +
enqueue). Pairs with `classifier-queue-monitoring.sql` (the read-only signal
queries) and `smoke-runbook.md` (the post-deploy smoke). Source of truth for
the signals + thresholds: parent design
`docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` §A.10.

All queries here are **read-only** unless explicitly marked as a re-drive /
recovery write. None reads a secret, an argument body, a prompt, or a
provider payload. The queue/lease/audit tables are service-role/dashboard
reads (no client SELECT policy by design).

---

## Operator prerequisites (one-time, before any smoke)

These are the operator actions the migration + code DO NOT perform (the
migration is written-not-applied; routing ships DISABLED). Do them in order:

1. **Apply the Card-2 migration:** `npx supabase db push --linked`. This
   installs the enqueue-kick trigger. Because routing ships DISABLED
   (`shouldRouteToQueue` returns false for everything), this is INERT for
   ordinary submits. (Card 1 + Card 2A migrations must already be applied.)
2. **Deploy the drainer Edge Function:** auto-deploys on merge via the
   Supabase GitHub integration. Confirm `classifier-drainer` is live and note
   its URL.
3. **Set the drainer's shared secret** as a function secret:
   `CLASSIFIER_DRAIN_SHARED_SECRET=<a strong random value>`
   (Supabase dashboard → Edge Functions → Secrets, or
   `npx supabase secrets set CLASSIFIER_DRAIN_SHARED_SECRET=... --linked`).
   The drainer validates this on the Authorization header before any work.
4. **Seed the Vault secrets** the kick trigger + cron read (the URL + the
   SAME shared secret value as step 3). Run in the SQL editor / psql
   (NEVER commit the values):
   ```sql
   SELECT vault.create_secret(
     '<https drainer URL>', 'arch_001_classifier_drainer_url',
     'ARCH-001 classifier drainer Edge Function URL');
   SELECT vault.create_secret(
     '<same shared secret as step 3>', 'arch_001_classifier_drainer_secret',
     'ARCH-001 classifier drainer shared secret (Bearer)');
   ```
5. **Schedule the 60s cron tick** — ONLY after steps 2-4 (so its
   `net.http_post` resolves a real URL). Apply the `cron.schedule(...)` block
   documented at the bottom of
   `supabase/migrations/20260528000023_arch_001_card2_enqueue_kick.sql`.
6. **Restore the MCP per-isolate cap backstop:**
   `MCP_SERVER_MAX_PROVIDER_CONCURRENCY=5` (invariant: drainer C=3 ≤ cap).
7. **Enable smoke routing** for the smoke tag:
   `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` (a submit-argument function
   secret). With this on, ONLY debates whose title starts with
   `[arch-001-queue-smoke]` route to the queue; everything else still uses
   direct dispatch.

Rollback at any time: set `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (or unset
it) and redeploy submit-argument — all submits revert to the proven direct
dispatcher. Pause the tick with
`SELECT cron.unschedule('arch-001-classifier-drain-tick');`. In-flight queue
jobs drain to terminal; no data migration is needed to roll back. The queue
columns/tables are additive and inert when routing is off.

---

## Alert thresholds (run `classifier-queue-monitoring.sql` query A + C)

| Alert | Condition | Likely cause | First action |
|---|---|---|---|
| Oldest pending age | `oldest_pending_age_s > 300` (5 min) | dead cron + lost kicks, or wedged single-flight | Query C: is `last_drain_completed` stale? Check the cron job (below). |
| No successful drain | `now() - last_drain_completed > 5 min` while `pending > 0` | drainer down / startup failing | Confirm the drainer is deployed + the shared secret is set; check `cron.job_run_details`. |
| Dead-letter present | `dead_letter > 0` (query A) | a cell exhausted retries → triage | Query B (which class?) + query G (which cells?). |
| Terminal failures for A–G | `failed_last_hour > 0` for any A–G cell (query A) | provider / contract regression | Query B — `provider_*` = tune C/pacer; `response_*` = MCP contract follow-up (NOT this card). |
| Queue depth rising | `pending` increasing across ≥3 consecutive snapshots | enqueue outpaces drain | Lower the tick interval / raise the batch / investigate C-vs-rate. |
| Repeated drainer startup skips | high `skipped_ticks_15m` with `processed_15m = 0` (query C) | lease never released (stuck owner) | Query E (stuck-lease detector); query F (lease snapshot). |

---

## Triage procedures

### 1. Pending climbing / oldest-pending > 5 min
Run query A, then query C.
- If `last_drain_completed` is stale → the drainer is not running. Check the
  cron job:
  ```sql
  SELECT * FROM cron.job;
  SELECT * FROM cron.job_run_details ORDER BY end_time DESC LIMIT 10;
  ```
  and confirm the drainer Edge Function is deployed + `CLASSIFIER_DRAIN_SHARED_SECRET`
  is set (a 401 from the drainer means the secret mismatches the Vault value).
- If cron is healthy but `skipped_single_flight` dominates → run query E
  (stuck-lease detector) + query F (lease snapshot). An expired
  `classifier_drain_lock` row past `expires_at` self-steals on the next tick.
  If it lingers and no drain runs, it is SAFE to clear it (TTL semantics):
  ```sql
  DELETE FROM classifier_drain_lock WHERE expires_at < now();
  ```

### 2. Dead-letters
Run query B (the failure-class breakdown).
- `provider_capacity_exhausted` / `provider_rate_limited` dominating → lower C
  (the drainer constant `DRAINER_PROVIDER_CONCURRENCY`, or the clamped env if
  added in a later card) or enable the §A.7 pacer.
- `response_schema_failure` (a `response_*` sub-reason) → MCP contract
  regression. This is OUT OF SCOPE for this card — do NOT redeploy the MCP
  server here; file a follow-up.

### 3. Re-drive a dead-lettered cell (rare; service-role only — NEVER client)
After fixing the root cause, an admin may re-drive a specific dead-lettered
cell by resetting it to pending:
```sql
UPDATE public.argument_machine_observation_runs
   SET state = 'pending', available_at = now(), attempt_count = 0,
       failure_reason = NULL, failure_sub_reason = NULL, dead_letter_reason = NULL,
       lease_owner = NULL, lease_expires_at = NULL
 WHERE id = '<run_id>' AND state = 'dead_letter';
```
The next tick claims it. NEVER batch-reset blindly; re-drive specific cells
you have triaged.

### 4. Doctrine guardrails (always)
- NEVER disable the rules-engine gate. Classifiers never gate submission;
  the queue makes this more true (submit only enqueues).
- Monitoring NEVER implies a verdict (cdiscourse-doctrine §1) — these are
  operational counters only.
- NEVER paste a secret, an argument body, a prompt, or a provider payload
  into a ticket/log when triaging. The queries here surface none of those.
