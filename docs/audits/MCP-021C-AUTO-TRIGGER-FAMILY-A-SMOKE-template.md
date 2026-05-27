# MCP-021C-AUTO-TRIGGER-FAMILY-A — Post-merge smoke template

**Operator audit template** — fill in by copying this file to
`MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-<YYYY-MM-DD>.md` after the auto-merge
deploy completes.

**Audit doctrine:** This audit verifies the fire-and-forget Family A
(`parent_relation`) auto-trigger fires on every newly inserted argument,
respects the runtime-config kill switch and the family-registry gate,
honors Option A idempotency, and does NOT block argument submission on
classifier failure. The card chain prior to this audit
(MCP-021A → MCP-021B → MCP-021C-EDGE-SMOKE → MCP-SERVER-001/002 →
MCP-021C-EDGE-RESPONSE-SUMMARY-FIX → MCP-021C-FAMILY-A-PROD-SMOKE)
had exercised production mode manually (admin-triggered curl). This
audit verifies the auto-trigger path closes the loop.

## Verdict

**TBD.** Fill in after running the 3-phase smoke below.

## Hard rules honored

The card brief's hard rules require verbatim preservation of:
- No secrets / JWTs / bearer tokens / API keys committed or logged.
- No Edge Function code modified beyond the MCP-021C-AUTO-TRIGGER-FAMILY-A
  bounded edits (the classifier handler refactor + the submit-argument
  fire-and-forget call site).
- No MCP server source change (operator's Deno Deploy `cdiscourse-mcp-server`
  is unchanged).
- No `semantic_referee_runtime_config` mutation during the audit (the
  operator MAY toggle `enabled` for the Phase 3 failure-doesn't-block
  test, but MUST restore the original value after).
- No new RLS policy. No new migration.

---

## Phase 0 — Pre-flight + deploy verification

Git state at audit start:

```
HEAD: <fill in commit SHA after the auto-merge>
Title: feat(MCP-021C-AUTO-TRIGGER-FAMILY-A): ... (#<PR number>)
```

Verify both Edge Functions redeployed:

```
npx supabase functions list --linked
```

Expected: `submit-argument` and `classify-argument-boolean-observations`
both ACTIVE with `updated_at` timestamps later than the merge commit.

Verify runtime config:

```sql
SELECT id, provider_mode, enabled
FROM public.semantic_referee_runtime_config
WHERE id = true;
```

Expected: `enabled = true`, `provider_mode = 'mcp'`. Record:

| Field | Value |
|---|---|
| `id` | `true` |
| `provider_mode` | `<fill in>` |
| `enabled` | `<fill in>` |

---

## Phase 1 — Trigger fires on new argument

**Setup:** Operator-authenticated session. Pick an existing public debate
(e.g., the Onboarding apology room used in MCP-021C-FAMILY-A-PROD-SMOKE:
`1e598dce-8188-4c7e-bdd6-aedede750923`).

**Action:** Insert a new test argument via the standard mobile-app path
(`submitArgumentDraft` → `submit-argument`). Capture the returned
`argumentId`.

```
argumentId: <fill in>
inserted_at: <ISO timestamp>
```

**Wait:** 30 seconds (the MCP roundtrip is ~5-15s; we add headroom for
the bounded retry's 2s backoff if the first attempt is a transient).

**Verify:**

```sql
SELECT id, argument_id, run_mode, status, schema_version,
       requested_families, provider_key, failure_reason,
       started_at, completed_at,
       EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_sec
FROM public.argument_machine_observation_runs
WHERE argument_id = '<phase-1-arg-id>'
ORDER BY started_at DESC
LIMIT 1;
```

Expected:
- 1 row exists for this argument.
- `run_mode = 'production'`.
- `schema_version = 'mcp-021.machine-observations.boolean.v1'`.
- `requested_families = {parent_relation}`.
- `provider_key = 'mcp:classify_argument_boolean_observations'`.
- `status` is `'success'` (typical) OR `'failed'` with a legitimate
  `failure_reason` like `mcp_network_error` (transient; Phase 1 still
  PASSes the wiring contract — the row was written by the dispatcher).

Verify positives persisted:

```sql
SELECT raw_key, family, confidence
FROM public.argument_machine_observation_results
WHERE argument_id = '<phase-1-arg-id>'
ORDER BY raw_key;
```

Expected: zero or more rows depending on the move's classifier verdict;
all rows have `family = 'parent_relation'`.

Confirm Source 6 rendering reads the production row:

```sql
SELECT amor.run_mode, COUNT(*) AS results
FROM public.argument_machine_observation_results r
JOIN public.argument_machine_observation_runs amor ON amor.id = r.run_id
WHERE r.argument_id = '<phase-1-arg-id>'
GROUP BY amor.run_mode;
```

Expected: `production` row count > 0; no `admin_validation` row count
appears (the auto-trigger only writes production rows).

**Phase 1 verdict:** `<PASS | FAIL>`.

Function-log spot-check (Supabase Studio → Edge Function logs →
`submit-argument`): one structured log line per insert with
`event: 'mcp_021c_auto_trigger'` should be visible. Record one redacted
sample (strip any production debate IDs that should not be in the audit):

```json
{
  "event": "mcp_021c_auto_trigger",
  "timestamp": "<fill in>",
  "argument_id": "<phase-1-arg-id>",
  "trigger_source": "submit_argument_auto_trigger",
  "outcome": "<triggered | failed>",
  "run_id": "<fill in or null>",
  "attempt_number": 1,
  "latency_ms": "<fill in>"
}
```

---

## Phase 2 — Idempotency holds on a duplicate manual run

**Setup:** Take the `argumentId` from Phase 1.

**Action:** Operator manually invokes the classifier Edge Function via
curl with the SAME argument id, mode = 'production'. This exercises the
admin-gated HTTP path; the dispatcher's idempotency pre-check is verified
separately in Phase 2.5 below.

```
curl -X POST https://<project>.supabase.co/functions/v1/classify-argument-boolean-observations \
  -H "Authorization: Bearer <admin-user-JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "argumentIds": ["<phase-1-arg-id>"],
    "requestedFamilies": ["parent_relation"],
    "mode": "production",
    "schemaVersion": "mcp-021.machine-observations.boolean.v1"
  }'
```

**Verify:**

```sql
SELECT COUNT(*) AS total_runs,
       COUNT(*) FILTER (WHERE status='success') AS success_runs
FROM public.argument_machine_observation_runs
WHERE argument_id = '<phase-1-arg-id>'
  AND run_mode = 'production';
```

Expected: `total_runs ≥ 1`. (Option A does NOT prevent multiple
production-mode runs for the same argument when invoked through
DIFFERENT code paths — the dispatcher's pre-check only fires from the
auto-trigger path. Verify Phase 2.5 below for the dispatcher's
idempotency contract.)

Confirm Source 6 deduplicates by raw_key:

```sql
SELECT raw_key, COUNT(*) AS dup_count
FROM public.argument_machine_observation_results r
JOIN public.argument_machine_observation_runs amor ON amor.id = r.run_id
WHERE r.argument_id = '<phase-1-arg-id>'
  AND amor.run_mode = 'production'
GROUP BY raw_key
HAVING COUNT(*) > 1;
```

Expected: zero rows (every `raw_key` is distinct per argument; Source 6
display caps render uniquely).

**Phase 2 verdict:** `<PASS | FAIL>`.

---

## Phase 2.5 — Auto-trigger idempotency (the actual brief contract)

**Setup:** Take the `argumentId` from Phase 1.

**Action:** Operator forces a re-dispatch of the auto-trigger from a
test harness (separate from the mobile-app submit path) — e.g., a
local Deno test that imports `dispatchAutoTriggerForArgument` and
invokes it manually with the test argument's ID and a service-role
client.

Sample minimal harness:

```ts
// scripts/manual/redispatchAutoTrigger.ts (NOT committed)
import { dispatchAutoTriggerForArgument } from '../../supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const outcome = await dispatchAutoTriggerForArgument(
  '<phase-1-arg-id>',
  '<debate-id>',
  serviceClient,
);
console.log(JSON.stringify(outcome));
```

Expected output:

```json
{
  "outcome": "already_classified",
  "runId": "<the phase-1 run id>"
}
```

Verify NO new run row was written:

```sql
SELECT COUNT(*) AS total_runs
FROM public.argument_machine_observation_runs
WHERE argument_id = '<phase-1-arg-id>'
  AND run_mode = 'production';
```

Expected: count is unchanged from Phase 2's final value (auto-trigger
re-dispatch wrote ZERO new rows).

**Phase 2.5 verdict:** `<PASS | FAIL>`.

---

## Phase 3 — Failure doesn't block submit

**Setup:** Temporarily disable the runtime config:

```sql
UPDATE public.semantic_referee_runtime_config
SET enabled = false
WHERE id = true;
```

**Action:** Insert a new test argument via the mobile-app path. Capture
the returned `argumentId`.

```
phase-3-argumentId: <fill in>
inserted_at: <ISO timestamp>
```

**Verify:**

1. **Insert succeeds.** The user sees a 201 response with the argument
   body (submit-argument behavior unchanged regardless of dispatcher
   outcome).

2. **No new run row** is written for this argument ID:

```sql
SELECT COUNT(*) AS total_runs
FROM public.argument_machine_observation_runs
WHERE argument_id = '<phase-3-arg-id>';
```

Expected: 0 rows. The dispatcher skipped with reason `config_disabled`
before invoking the MCP adapter.

3. **Function-log spot-check** shows a `'skipped'` outcome with
   `skip_reason='config_disabled'`:

```json
{
  "event": "mcp_021c_auto_trigger",
  "timestamp": "<fill in>",
  "argument_id": "<phase-3-arg-id>",
  "trigger_source": "submit_argument_auto_trigger",
  "outcome": "skipped",
  "skip_reason": "config_disabled",
  "latency_ms": "<fill in (should be small; no MCP call)>"
}
```

**Restore:**

```sql
UPDATE public.semantic_referee_runtime_config
SET enabled = true
WHERE id = true;
```

**Phase 3 verdict:** `<PASS | FAIL>`.

---

## Phase 4 — Source 6 rendering of the auto-triggered rows

**Setup:** Take the `argumentId` from Phase 1.

**Action:** Open the argument in the mobile app (or the admin web view)
and inspect the labels rendered for the auto-triggered node.

Expected:
- Machine Observation chips render for any positive rawKeys with
  confidence ≥ `low` (the sanitizer's inspect-floor).
- Display caps from UX-001.5A are honored (Timeline 1 + overflow,
  Selected 3 + overflow, Inspect N grouped).
- Plain-language labels appear (no raw rawKey strings in user-facing
  chips per the MCP-021A label registry).
- No User Allegation chips appear on this argument (no user has applied
  a tag).

Record one screenshot or descriptive note per observed chip:

```
- raw_key=<…>, family=parent_relation, confidence=<low|medium|high>
  - timeline: <chip text>
  - selected: <chip text>
  - inspect: <chip text>
```

**Phase 4 verdict:** `<PASS | FAIL>`.

---

## Phase 5 — Regression sweep (offline)

Run the regression sweep specified by the design at §9.4:

```
npx jest --testPathPattern "(mcpOneTwoOneB|mcpOneTwoOneC|mcpOneTwoOneASourceSixInvariance|uxOneOneFiveA)"
```

Expected: ≥ 39 suites, ≥ 934 tests passing (baseline 36 / 839 + the new
5 / 95 from this card). Record the exact count:

```
Test Suites: <fill in> passed
Tests:       <fill in> passed
```

**Phase 5 verdict:** `<PASS | FAIL>`.

---

## Phase 6 — Operator follow-up authorization

If Phase 1 + Phase 2.5 + Phase 3 all PASS:
- **Authorized to file:** `MCP-SERVER-003` (Family B template),
  `ADMIN-MCP-001` (UI affordance flip),
  `MCP-021C-AUTO-TRIGGER-FAMILY-B` (Family B auto-trigger).
- **Promote from DEFERRED to PLANNED:** `OPS-MCP-OBSERVABILITY`.

If Phase 1 PASSes but Phase 2.5 or Phase 3 PARTIALs:
- **File:** `MCP-021C-AUTO-TRIGGER-FAMILY-A-IDEMPOTENCY-HARDENING`
  (if Phase 2.5 surfaced a real duplicate row race) OR a small fix card
  scoped to the specific defect.

If Phase 1 FAILs (dispatch did not fire):
- **File:** `MCP-021C-AUTO-TRIGGER-FAMILY-A-FIX`.
- **PAUSE:** Family B enablement until the fix lands.

If any phase shows production traffic at unexpected volume:
- **Activate operator kill switch:**
  ```sql
  UPDATE public.semantic_referee_runtime_config SET enabled = false WHERE id = true;
  ```
- File `OPS-MCP-RATE-LIMITING` for the v1 cost ceiling.

---

## Conclusion

`<Fill in: overall PASS / PARTIAL / FAIL and one-line summary>`.
