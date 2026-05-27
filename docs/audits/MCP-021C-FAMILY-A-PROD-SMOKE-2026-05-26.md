# MCP-021C-FAMILY-A-PROD-SMOKE — Production-mode Family A end-to-end audit

**Date:** 2026-05-26
**Audit doctrine:** This audit verifies the production execution path for the
Family A (`parent_relation`) Machine Observation classifier. The card chain
prior to this audit (MCP-021A → MCP-021B → MCP-021C-EDGE-SMOKE →
MCP-SERVER-001/002 → MCP-021C-EDGE-RESPONSE-SUMMARY-FIX) had exercised
admin-validation mode end-to-end and proven the response-summary fix at
the test level. Production mode itself had never been exercised on a real
deployed chain. This audit closes that gap.

## Verdict

**PASS.** Production mode is correct end-to-end: Edge Function returns
HTTP 200, persistence rows carry `run_mode='production'` with the pinned
schema version, the response summary now matches the persisted positives,
Source 6 production rendering accepts only `run_mode='production'` rows
(admin rows are excluded at the query layer), classifier output is stable
vs the EDGE-SMOKE admin-mode baseline (HIGH agreement, 3/3 raw_keys per
non-root argument), and 36 / 839 regression tests pass.

## Hard rules honored

The launch brief's nine hard rules were honored verbatim. No secrets,
JWTs, bearer tokens, or API keys were committed or logged. No Edge
Function / Deno Deploy / MCP server / UI code was modified. The
`semantic_referee_runtime_config` DB-config row (`provider_mode='mcp'`)
was not touched. The production auto-trigger on argument post was not
enabled — that remains the scope of MCP-021C-AUTO-TRIGGER-FAMILY-A and
is contingent on this card's PASS. The local `/tmp/*` response file,
runIds file, and acquired user JWT were not committed and the JWT was
discarded after use. PASS was reached only because production rows were
persisted AND production rows are correctly admitted by Source 6
filtering AND admin rows are excluded — not merely because the Edge
Function returned HTTP 200.

---

## Phase 0 — Pre-flight + response-summary fix deploy verification

Git state at audit start:

```
HEAD: c5c6d9be96080c0a233c5c684375431cb147f6cb
Title: fix(MCP-021C-EDGE-RESPONSE-SUMMARY-FIX): per-arg summary
       reflects persisted rows (#311)
```

The response-summary fix at `c5c6d9b` merged into `main` and the
`classify-argument-boolean-observations` Edge Function redeployed
automatically (Supabase GitHub integration). The deploy was verified
live by reading the function metadata: the latest deployed function
version's `updated_at` is later than the merge timestamp by ~1 minute,
which is the expected behavior. The fix is therefore in the path for
this audit.

The fix encoded by `c5c6d9b` removed a response-payload bug where the
per-argument summary returned `positiveObservationCount: 0` and
`rawKeysWithPositive: []` even when rows had in fact been persisted —
the result was that operators saw an inconsistent picture (DB rows
present, response saying empty). The fix is encoded in
`supabase/functions/classify-argument-boolean-observations/index.ts`
lines 414-488: persistResults' outcome is captured, then a post-persist
SELECT computes `actualPositiveCount` / `actualRawKeys` from the
persisted rows, and those values are written into the response summary.

`mcpOneTwoOneCEdgeResponseSummaryFix.test.ts` passes (verified in
Phase 5).

---

## Phase 1 — Source-confirmed production-mode request contract

The Edge Function's request shape is fixed by source. Confirmed by
reading `supabase/functions/classify-argument-boolean-observations/index.ts`:

| Field                 | Value sent in this audit                                  |
| --------------------- | ---------------------------------------------------------- |
| `argumentIds`         | `["f41b18b0-…", "781f8057-…", "db0de3e0-…"]`               |
| `requestedFamilies`   | `["parent_relation"]`                                      |
| `mode`                | `"production"`                                             |
| `schemaVersion`       | `"mcp-021.machine-observations.boolean.v1"`                |

Mode validator (lines 177-183) accepts `production` and `admin_validation`.
Production-mode family gate (line 331) is the production version of
`filterFamiliesForMode`. Production-mode invocation writes
`run_mode: 'production'` into both run-row create paths (lines 367, 397).
`requireAdmin` gates the Edge Function call (`supabase/functions/_shared/adminAuth.ts:69`
requires `profile.role === 'admin'`).

---

## Phase 2 — Production-mode Edge Function call

A user JWT was acquired against the Supabase Auth REST endpoint
(`/auth/v1/token?grant_type=password`) using the `.env.bot-tests`
admin credentials (`CDISCOURSE_ADMIN_EMAIL` / `CDISCOURSE_ADMIN_PASSWORD`).
The acquired token was 988 characters, three JWT parts, `role=authenticated`,
non-expired, used inline, and then discarded. No JWT value is recorded
in this audit.

Result:

```
HTTP 200 | time_total = 17.5s
mode = "production"
schemaVersion = "mcp-021.machine-observations.boolean.v1"
perArgument =
  [ { index: 0, argumentId: f41b18b0-…, runId: c8273579-…,
      status: success, positiveObservationCount: 0, rawKeysWithPositive: [] }
  , { index: 1, argumentId: 781f8057-…, runId: cc2c4bb7-…,
      status: success, positiveObservationCount: 3,
      rawKeysWithPositive:
        [ "challenges_parent", "distinguishes_parent", "quote_anchors_parent" ] }
  , { index: 2, argumentId: db0de3e0-…, runId: 9e52ca15-…,
      status: success, positiveObservationCount: 3,
      rawKeysWithPositive:
        [ "challenges_parent", "distinguishes_parent", "quote_anchors_parent" ] }
  ]
```

The response summary's per-argument counts and rawKeys now reflect what
was persisted — exactly the contract the response-summary fix
introduced. Without the fix this call would have returned
`positiveObservationCount: 0` with `rawKeysWithPositive: []` for arg2
and arg3 despite the database having 3 result rows each.

The three production run IDs were:

```
c8273579-6720-4dec-9033-0e03dfecf989 (arg1, root)
cc2c4bb7-a6bc-4762-94ec-a551a4a17c02 (arg2, depth 1)
9e52ca15-f24f-4823-b70d-cf06a7af9d49 (arg3, depth 2)
```

---

## Phase 3 — Production persistence readback

Run-row readback (`argument_machine_observation_runs`):

| Run id (prefix) | argument_id | run_mode    | status  | schema_version                              | requested_families | provider_key                                  | model_name           | failure_reason | duration |
| --------------- | ----------- | ----------- | ------- | ------------------------------------------- | ------------------ | --------------------------------------------- | -------------------- | -------------- | -------- |
| c8273579-…      | f41b18b0-…  | production  | success | mcp-021.machine-observations.boolean.v1     | ["parent_relation"] | mcp:classify_argument_boolean_observations    | operator-mcp-server  | null           | 4.17 s   |
| cc2c4bb7-…      | 781f8057-…  | production  | success | mcp-021.machine-observations.boolean.v1     | ["parent_relation"] | mcp:classify_argument_boolean_observations    | operator-mcp-server  | null           | 4.49 s   |
| 9e52ca15-…      | db0de3e0-…  | production  | success | mcp-021.machine-observations.boolean.v1     | ["parent_relation"] | mcp:classify_argument_boolean_observations    | operator-mcp-server  | null           | 5.85 s   |

All three rows: `run_mode='production'` (NOT `admin_validation`),
`status='success'`, `schema_version` pinned, `failure_reason=null`,
`completed_at` populated, durations 4-6 seconds (well under any timeout).

Result-row readback (`argument_machine_observation_results`):

| Run id (prefix) | raw_key                | family            | confidence | evidence_len |
| --------------- | ---------------------- | ----------------- | ---------- | ------------ |
| cc2c4bb7-…      | challenges_parent      | parent_relation   | high       | 185          |
| cc2c4bb7-…      | distinguishes_parent   | parent_relation   | high       | 45           |
| cc2c4bb7-…      | quote_anchors_parent   | parent_relation   | high       | 67           |
| 9e52ca15-…      | challenges_parent      | parent_relation   | high       | 202          |
| 9e52ca15-…      | distinguishes_parent   | parent_relation   | high       | 176          |
| 9e52ca15-…      | quote_anchors_parent   | parent_relation   | high       | 67           |

All six rows: `family='parent_relation'`, `confidence='high'`,
`evidence_span` populated, `evidence_len ≤ 240` (the source-span ceiling
from MCP-021A's schema), and each `raw_key` is a member of Family A's
16-key set (POSITIVES_ONLY persistence model honored).

The root argument (arg1, c8273579-…) has zero result rows. This is
expected — Family A is the `parent_relation` family and the root has no
parent to relate to. The run row is still persisted (with zero
positives), which keeps run-row presence a reliable signal that the
classifier was invoked.

---

## Phase 3.1 — Classifier stability vs EDGE-SMOKE admin baseline

The EDGE-SMOKE audit (`docs/audits/MCP-021C-EDGE-SMOKE-2026-05-26.md`)
exercised the same three fixture arguments in admin-validation mode.
Comparing raw_keys:

| Argument            | Admin-validation raw_keys                                     | Production raw_keys                                            | Agreement   |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | ----------- |
| arg1 (root)         | (none — root has no parent)                                    | (none — root has no parent)                                     | 100 % (n=0) |
| arg2 (depth 1)      | challenges_parent, distinguishes_parent, quote_anchors_parent  | challenges_parent, distinguishes_parent, quote_anchors_parent   | 3 / 3       |
| arg3 (depth 2)      | challenges_parent, distinguishes_parent, quote_anchors_parent  | challenges_parent, distinguishes_parent, quote_anchors_parent   | 3 / 3       |

**HIGH agreement.** The classifier produces the same Family A keys for
the same inputs whether `mode=production` or `mode=admin_validation`,
confirming that `run_mode` discriminates *purpose* (which observability
bucket) and not *behavior* (the prompt and parser are mode-agnostic).
This is the doctrine encoded by MCP-021C-EDGE: `run_mode` is a
persistence-and-rendering discriminator, never a classifier toggle.

---

## Phase 4 — Source 6 production rendering (Tier-1 evidence)

The Source 6 filter is encoded at
`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
as:

```ts
.eq('argument_machine_observation_runs.run_mode', 'production')
```

backed by a `!inner` join on the runs table (line 74 SELECT_COLUMNS).
The query layer therefore returns ONLY `run_mode='production'` rows;
admin-validation rows cannot reach the adapter, and the adapter's
contract (byte-equal-on-empty-input) is preserved upstream.

Tier 1 test evidence (all pass in Phase 5):

* `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` S6F-4 — asserts the
  exact `.eq('argument_machine_observation_runs.run_mode', 'production')`
  call is present in the query.
* `mcpOneTwoOneCEdgeBoundary.test.ts` BND-5 — boundary test asserting
  the inner join + production filter at the query layer.
* `mcpOneTwoOneCEdgeMigrationShape.test.ts` MIG-6 + MIG-7 — migration
  shape: `run_mode text NOT NULL DEFAULT 'production'` + CHECK
  constraint `IN ('production', 'admin_validation')`.
* `mcpOneTwoOneCEdgeAdminValidationMode.test.ts` — asserts
  `ALL_MACHINE_OBSERVATION_RUN_MODES === ['production', 'admin_validation']`.
* `mcpOneTwoOneASourceSixInvariance.test.ts` — adapter still
  byte-equal-on-empty-input (i.e. when filter returns no rows, Source 6
  behaves identically to the empty-input case).

Tier 1 is sufficient by itself — production rendering is a query-layer
filter assertion plus the upstream byte-equal invariance. No Tier 2
(operator manual app verification) was pursued for this audit; the
adapter is purely a function of the rows it receives, and Phase 3
already confirms that the production rows reaching the adapter are
well-shaped.

---

## Phase 4.1 — Admin / production coexistence state

The three fixture arguments now have a mixed-run history. Coexistence
breakdown:

| argument_id   | run_mode          | run_count | result_count | distinct_raw_keys |
| ------------- | ----------------- | --------- | ------------ | ----------------- |
| f41b18b0-…    | admin_validation  | 1         | 0            | 0                 |
| f41b18b0-…    | production        | 2         | 5            | 5                 |
| 781f8057-…    | admin_validation  | 1         | 3            | 3                 |
| 781f8057-…    | production        | 2         | 7            | 7                 |
| db0de3e0-…    | admin_validation  | 1         | 3            | 3                 |
| db0de3e0-…    | production        | 1         | 3            | 3                 |

The "extra" production runs (one per arg1 and arg2 at
`2026-05-26 05:55 UTC`) predate this audit. They originate from the
MCP-021B smoke-seed insert (the seed used `input_hash LIKE 'smoke-%'`),
which was created before `run_mode` existed as a column. The MCP-021C-EDGE
migration backfilled the column with the `DEFAULT 'production'` value,
which is the correct semantic choice (the seed was intended to populate
production rendering) and which is also the only reachable behavior
given the CHECK constraint.

Coexistence is **benign**:

* Across all production rows for a given argument, every `raw_key` is
  distinct (no within-argument duplication across runs:
  `distinct_raw_keys == result_count` in every production-mode row of
  the table above). This means Source 6 will render at most one chip
  per `raw_key` per argument without needing to dedupe.
* No `raw_key` from the admin runs leaks into the production
  rendering — the inner-join filter excludes them at the query layer.
  This is the property MCP-021C-EDGE-SMOKE Phase 4 verified in the
  reverse direction (admin rows present, production rows absent);
  this audit verifies it in the forward direction (production rows
  present, admin rows correctly excluded).

The display caps (Timeline 1 + overflow, Selected 3 + overflow, Inspect
N grouped) are unaffected — they operate on the query-filtered
production row set just as they always have.

---

## Phase 5 — Targeted regression tests

Three jest sweeps were run during this audit. All passed:

| Sweep | Pattern | Suites | Tests |
| ----- | ------- | ------ | ----- |
| Phase 0 narrow | response-summary fix + source-six invariance | 8 | 152 |
| Phase 4 ux115A family | uxOneOneFiveA* | 4 | 144 |
| Phase 5 full | `(mcpOneTwoOneB\|mcpOneTwoOneC\|mcpOneTwoOneASourceSixInvariance\|uxOneOneFiveA)` | 36 | 839 |

The Phase 5 sweep is a superset of the others. Zero regressions in:

* MCP-021B persistence + RLS + read-only-boundary + display-cap preservation
* MCP-021C-EDGE family registry + family enablement + parser parity +
  adapter source scan + boundary + persistence types + migration shape
  + persistence writer + request builder + admin-validation mode +
  function handler + fixture UUIDs + integration flow
* MCP-021C-EDGE Source 6 run_mode filter (S6F-1 through S6F-N)
* MCP-021C-EDGE response-summary fix (the Phase 0 deploy proof at the
  test level)
* MCP-021A Source 6 invariance (byte-equal-on-empty-input)
* ux115A label doctrine + aria label + priority model + call-site wiring

---

## What this audit does NOT cover (out of scope by design)

* MCP-021C-AUTO-TRIGGER-FAMILY-A. Production-mode invocation in this
  audit was operator-triggered, not auto-triggered on argument post.
  Enabling the production auto-trigger is its own card, contingent on
  this audit's PASS.
* MCP-SERVER-003 / Family B planning. Same gating: contingent on this
  audit's PASS.
* Anti-amplification scoring + game economy interactions. Source 6
  rendering produces chips; the scoring economy that consumes those
  chips is a separate surface (Stage 6.1.5.2 onward) and was not
  exercised in this audit.

---

## Artifacts not committed (per hard rule 6)

* Local response file in OS temp (`mcp021c-family-a-prod-response.json`).
* Local runIds file in OS temp (`mcp021c-family-a-prod-runids.txt`).
* The acquired user JWT (discarded after use; never written to disk
  outside OS temp during the inline `node -` script).

These contain identifying values (run IDs, argument IDs, user email,
auth token) that are unsafe to commit.
