# MCP-021C-EDGE Admin Validation Audit

**Status:** TEMPLATE — operator copies to a dated file
(`docs/audits/MCP-021C-EDGE-admin-validation-<YYYY-MM-DD>.md`) after
EDGE-SMOKE.

**Date:** \<YYYY-MM-DD\>
**Author:** Operator (with autonomous-pipeline support)
**Card:** MCP-021C-EDGE (merged at `<commit>`, PR \#\<number\>)
**Migration:** `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`
**Edge Function:** `supabase/functions/classify-argument-boolean-observations/`
**MCP server:** operator-hosted (`SEMANTIC_REFEREE_MCP_URL` + `SEMANTIC_REFEREE_MCP_TOKEN`)
**Pivot decision:** `docs/decisions/MCP-021C-edge-pivot.md`
**Sequencing decision:** `docs/decisions/MCP-021-sequencing.md`
**Design:** `docs/designs/MCP-021C-EDGE.md`
**Intent brief:** `docs/designs/MCP-021C-EDGE-intent.md`

---

## Verdict

(PASS | FAIL | PARTIAL — see Phase 5 decision matrix below)

---

## Phase 1 — Edge Function deploy

Auto-deploy via Supabase GitHub integration on merge to main. Verification steps:

- [ ] Function deploy completed:
  ```
  npx supabase functions list --linked | grep classify-argument-boolean-observations
  ```
- [ ] Secrets present (BOTH must be set; SAME values as MCP-018):
  ```
  npx supabase secrets list --linked | grep SEMANTIC_REFEREE_MCP_
  ```
  Expected: `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN`.
  If absent (MCP-018 secrets were never set), set them now:
  ```
  npx supabase secrets set SEMANTIC_REFEREE_MCP_URL=https://... --linked
  npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=... --linked
  ```
- [ ] Migration applied:
  ```
  npx supabase db query --linked --query "
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'argument_machine_observation_runs'
      AND column_name = 'run_mode';
  "
  ```
  Expected: one row, `data_type = text`, `column_default = ''production''::text`.

**Status:** PASS | FAIL — \<notes\>

---

## Phase 2 — Admin validation invocation

Three fixture moves from the Onboarding apology room
(`1e598dce-8188-4c7e-bdd6-aedede750923`), invoked via curl with the
operator's admin JWT in `Authorization`:

| \# | argumentId                            | depth | Expected positives (Family A)                              | Actual result |
|---|---------------------------------------|-------|------------------------------------------------------------|---------------|
| 1 | `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` | 0     | none (root — children fire `has_*` on parent, not root)    | (success/failed) |
| 2 | `781f8057-9e2a-4fa9-92a8-469676950ff7` | 1     | likely `challenges_parent`, `has_rebuttal` (counter at d2) | (success/failed) |
| 3 | `db0de3e0-24c6-40af-ba5f-2844acfa5bac` | 2     | likely `challenges_parent` (counter to depth-1 rebuttal)   | (success/failed) |

Example curl:
```
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/classify-argument-boolean-observations" \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "argumentIds": [
      "f41b18b0-8ad6-4865-94c5-17a568f6a6ad",
      "781f8057-9e2a-4fa9-92a8-469676950ff7",
      "db0de3e0-24c6-40af-ba5f-2844acfa5bac"
    ],
    "requestedFamilies": ["parent_relation"],
    "mode": "admin_validation",
    "schemaVersion": "mcp-021.machine-observations.boolean.v1"
  }'
```

For each argument, record:
- run_id
- status (success / failed)
- failure_reason (if any)
- positive raw_keys + confidences

**Status:** PASS | FAIL — \<notes\>

---

## Phase 3 — Persisted-row inspection (SQL readbacks)

Run via `npx supabase db query --linked --query` (or the Supabase
Studio SQL editor). Confirm shape + values match Phase 2 results.

### 3.1 Runs created with `run_mode = 'admin_validation'`

```sql
SELECT
  id,
  argument_id,
  schema_version,
  requested_families,
  provider_key,
  model_name,
  status,
  failure_reason,
  run_mode,
  started_at,
  completed_at
FROM public.argument_machine_observation_runs
WHERE run_mode = 'admin_validation'
  AND argument_id IN (
    'f41b18b0-8ad6-4865-94c5-17a568f6a6ad',
    '781f8057-9e2a-4fa9-92a8-469676950ff7',
    'db0de3e0-24c6-40af-ba5f-2844acfa5bac'
  )
ORDER BY started_at DESC;
```

### 3.2 Result rows per fixture argument

```sql
SELECT
  res.argument_id,
  res.raw_key,
  res.family,
  res.confidence,
  LEFT(res.evidence_span, 80) AS evidence_excerpt
FROM public.argument_machine_observation_results res
INNER JOIN public.argument_machine_observation_runs run
  ON res.run_id = run.id
WHERE run.run_mode = 'admin_validation'
  AND res.argument_id IN (
    'f41b18b0-8ad6-4865-94c5-17a568f6a6ad',
    '781f8057-9e2a-4fa9-92a8-469676950ff7',
    'db0de3e0-24c6-40af-ba5f-2844acfa5bac'
  )
ORDER BY res.argument_id, res.raw_key;
```

**Status:** PASS | FAIL — \<notes\>

---

## Phase 4 — Source 6 production-filter verification

The bounded edit to
`src/features/nodeLabels/machineObservationPersistenceQuery.ts` adds a
`!inner` join on `argument_machine_observation_runs` with
`.eq('argument_machine_observation_runs.run_mode', 'production')`.
Admin-validation rows MUST NOT render in the production UI.

Steps:

- [ ] Open the Conversation Gallery and navigate to the Onboarding
      apology room (`1e598dce-8188-4c7e-bdd6-aedede750923`).
- [ ] Open the Argument Stack for one of the three fixture arguments.
- [ ] Open the Inspect panel for the argument.
- [ ] Confirm: NO new Machine Observation chips appear from the
      admin-validation run just executed.
- [ ] Confirm: The 7 valid MCP-021B smoke-seed rows STILL render (their
      runs are `run_mode = 'production'` post-migration default backfill).

If a new chip from an admin-validation run leaks into the UI, that's a
filter regression — file MCP-021C-EDGE-FIX immediately.

**Status:** PASS | FAIL — \<notes\>

---

## Phase 5 — Verdict + next card decision

- **PASS** (1+ of 3 moves validates with positive results OR clean
  failure_reason): MCP-021C-FAMILY-B is AUTHORIZED to file (enable Family
  B for production via the next enablement card).

- **PARTIAL** (some moves validate, some fail with non-systematic errors):
  document per-move detail; consider rerun or file MCP-021C-EDGE-PATCH
  for the specific defect. Do NOT enable additional families yet.

- **FAIL** (0 of 3 moves validate; systematic schema failure or
  unavailable reason on every call): file MCP-021C-EDGE-FIX scoped to
  the specific defect; pause further family enablement until fix lands.

### Common failure_reason interpretations

| failure_reason          | Likely cause                                          |
|-------------------------|-------------------------------------------------------|
| `mcp_url_missing`       | SEMANTIC_REFEREE_MCP_URL secret not set OR non-https. |
| `mcp_token_missing`     | SEMANTIC_REFEREE_MCP_TOKEN secret not set.            |
| `mcp_network_error`     | DNS / TLS / timeout. MCP server unreachable.          |
| `mcp_api_error`         | MCP server returned non-OK HTTP (not 429).            |
| `mcp_rate_limited`      | MCP server returned 429.                              |
| `mcp_parse_failure`     | MCP server's response envelope didn't match.          |
| `mcp_validation_failed` | MCP-021A parser rejected the response shape.          |
| `argument_not_found`    | Argument soft-deleted or non-existent.                |
| `persist_run_failed`    | DB INSERT into runs table failed.                     |
| `unexpected_error`      | Defensive catch — adapter never throws by contract.   |

---

## Phase 6 — Operator-deferred review items

Three items from intent brief / design ledger that defer to operator decision:

1. **Whether to clean up the 9 MCP-021B smoke-seed rows after EDGE-SMOKE.**
   The smoke-seed audit noted "Leave as test data" as an option. After
   EDGE-SMOKE, the operator may opt to delete via service-role SQL:
   ```sql
   DELETE FROM public.argument_machine_observation_runs
   WHERE input_hash LIKE 'smoke-%';
   ```
   (the result rows cascade). The MCP-021C-EDGE design does NOT clean
   these up automatically; they continue to be useful reference data
   for MCP-021C-FAMILY-B and beyond.

2. **Whether to enable Family B (`disagreement_axis`) for production
   in the IMMEDIATE next card or to delay.** Family B is the natural
   next candidate (14 keys; similar parent-relative structure). The
   operator may wish to run one full admin validation cycle on Family
   B before filing the enablement card.

3. **Whether to upgrade the initial production posture to auto-trigger
   (MCP-021C-AUTO-TRIGGER) before any family beyond A.** Two viable
   sequences: (a) enable Family B first (admin-trigger-only); (b)
   auto-trigger Family A first (so live data flows into the persistence
   path), then enable Family B with auto-trigger already in place. The
   brief does not specify; this is an operator-tempo call.

---

## References

- Migration: `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`
- Design: `docs/designs/MCP-021C-EDGE.md`
- Intent brief: `docs/designs/MCP-021C-EDGE-intent.md`
- Sequencing: `docs/decisions/MCP-021-sequencing.md`
- Pivot decision: `docs/decisions/MCP-021C-edge-pivot.md`
- MCP-018 adapter runbook: `docs/deployment/mcp-018-mcp-adapter-runbook.md`
- MCP-021B smoke audit: `docs/audits/MCP-021B-persisted-label-smoke-2026-05-26.md`
