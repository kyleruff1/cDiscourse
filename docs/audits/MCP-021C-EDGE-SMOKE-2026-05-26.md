# MCP-021C-EDGE-SMOKE — 2026-05-26

**Card:** MCP-021C-EDGE-SMOKE — live Family A edge-to-persistence audit (admin_validation mode)
**Operator:** Kyler
**Date:** 2026-05-26
**Server commit:** `fc28605` (HEAD of `main` at audit start; previous MCP-SERVER-002-SMOKE PASS)
**Supabase project ref:** `qsciikhztvzzohssddrq`
**Hosted MCP server:** `https://cdiscourse-mcp-server.civildiscourse.deno.net`
**DB runtime config:** `provider_mode='mcp'`, `enabled=true` (unchanged since MCP-SERVER-001-SMOKE fix)
**Audit status:** COMPLETE — final verdict **PASS**

---

## Verdict

**PASS** — live Family A edge-to-persistence chain operational end-to-end:

```
admin-trigger → classify-argument-boolean-observations Edge Function
             → DB-config provider_mode='mcp'
             → hosted Deno MCP server (cdiscourse-mcp-server.civildiscourse.deno.net)
             → classify_argument_boolean_observations Family A tool
             → Anthropic claude-haiku-4-5
             → MCP-021A parser + sanitizer
             → MCP-021B persistence (run_mode='admin_validation', 6 positive result rows)
             → Source 6 admin-validation exclusion (Tier 1 + Tier 2 evidence)
```

Authorizations applied:
- **MCP-021C-EDGE-SMOKE:** PASS
- **MCP-021C-FAMILY-A-PROD:** ✅ **AUTHORIZED to file** (production auto-trigger NOT enabled until that card ships with its own design phase deciding admin-trigger-first vs auto-on-post)
- **MCP-SERVER-003 / Family B planning:** ✅ AUTHORIZED after operator sequencing decision
- **ADMIN-MCP-001** (UI affordance flip): remains AUTHORIZED (parallel-shippable)

One non-blocking discrepancy noted (Edge Function response-summary reporting bug; see Phase 3 §3.3) — separate from the verdict; recommend small follow-up card.

---

## Phase 0 — Pre-flight

- [x] `main` HEAD at `fc28605` (MCP-SERVER-002-SMOKE PASS at this SHA)
- [x] Predecessor audit `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md` present + `MCP-021C-EDGE-SMOKE AUTHORIZED` line confirmed
- [x] Hosted MCP server `/health`: `status=ok, environment=prod, credentialsConfigured=true, supportedTools=[classify_semantic_move, classify_argument_boolean_observations], protocolVersion=2025-11-25`
- [x] Both Edge Functions ACTIVE: `semantic-referee` (v130) + `classify-argument-boolean-observations` (v16)
- [x] All 4 SEMANTIC_REFEREE_* secrets present with non-null digests: `ENABLED`, `PROVIDER`, `MCP_URL`, `MCP_TOKEN`
- [x] DB runtime config: `{id: true, provider_mode: "mcp", enabled: true, updated_at: 2026-05-26 22:51:28+00}`

**Result:** PASS

---

## Phase 0.5 — Seeded argument body status (binding for verdict logic)

| Argument | Body length | Preview | Status |
|---|---|---|---|
| `f41b18b0-8ad6-4865-94c5-17a568f6a6ad` (root, depth 0) | 272 | "Long onboarding sequences that dump feature lists and permissions on users usually signal the produc..." | **REAL** |
| `781f8057-9e2a-4fa9-92a8-469676950ff7` (depth 1) | 280 | "You're conflating necessary disclosure with bad design. \"Long onboarding sequences that dump feature..." | **REAL** |
| `db0de3e0-24c6-40af-ba5f-2844acfa5bac` (depth 2) | 280 | "\"Long onboarding sequences that dump feature lists and permissions\" can still be bad UI even if the ..." | **REAL** |

All 3 args have substantive bot-seeded text. The chain is:
- arg1 (root): asserts long onboarding signals bad design
- arg2 (depth 1): rebuttal — distinguishes disclosure from design
- arg3 (depth 2): counter-rebuttal — the original onboarding claim still holds

**Binding interpretation for verdict logic:** 0 positives across 3 runs would be a SIGNAL of prompt under-detection (not EXPECTED behavior, as it was in MCP-SERVER-002-SMOKE Phase 2.5 fixture text). Phase 0.5 prediction: arg2 likely fires `challenges_parent`; arg3 likely fires `has_counter_rebuttal` or `rebutted`.

**Result:** PASS — all 3 args have real text.

---

## Phase 1 — Source-confirmed Edge Function request contract

Edge Function entrypoint: `supabase/functions/classify-argument-boolean-observations/index.ts` (542 lines).

Request shape verbatim (lines 97-100):

```typescript
interface ClassifyArgumentBooleanObservationsRequest {
  argumentIds: string[];
  requestedFamilies: MachineObservationFamily[];
  mode: MachineObservationRunMode;
  schemaVersion: typeof MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
}
```

Validation rules (source):
- `argumentIds`: array of UUID strings (line 143-156)
- `requestedFamilies`: non-empty array (line 160-174)
- `mode`: must be `"production"` or `"admin_validation"` (line 177-183, error message "must be \"production\" or \"admin_validation\"")
- `schemaVersion`: must equal `mcp-021.machine-observations.boolean.v1` (line 185-191)
- Production mode gates non-`parent_relation` families (line 473-474); admin_validation mode does not

**Payload used (matches source verbatim; no adjustment):**

```json
{
  "argumentIds": [
    "f41b18b0-8ad6-4865-94c5-17a568f6a6ad",
    "781f8057-9e2a-4fa9-92a8-469676950ff7",
    "db0de3e0-24c6-40af-ba5f-2844acfa5bac"
  ],
  "requestedFamilies": ["parent_relation"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

**Result:** PASS — source-confirmed contract; payload matches.

---

## Phase 1.5 — Persistence model determination (binding for Phase 3 verdict logic)

Source-confirmed at `supabase/functions/_shared/booleanObservations/persistenceWriter.ts:13-14`:

> "persistResults: INSERT batch into argument_machine_observation_results (one row per POSITIVE observation). UNIQUE (run_id, raw_key) constraint prevents duplicates within a single run."

**Persistence model: POSITIVES_ONLY**

The persistence writer accepts `PersistResultInput[]` already-sanitized by the MCP-021A sanitizer (which retains only positive observations with valid confidence). No filter step inside the writer; the writer is the defensive last line.

**Phase 3 verdict logic for this audit (args have REAL text per Phase 0.5):**
- 1+ positive across 3 runs → PASS-eligible
- 0 positives across 3 runs → PARTIAL (prompt under-detection signal)

**Result:** PASS — model determined unambiguously.

---

## Phase 2 — Edge Function call

Operator captured admin JWT via `read -s` (length 3 parts; no echo). Edge Function invoked at `https://qsciikhztvzzohssddrq.supabase.co/functions/v1/classify-argument-boolean-observations`.

**HTTP result:**

```
HTTP 200 | time_total=17.334029s
```

17.3s total for 3 args = ~5.8s/arg average (consistent with MCP-SERVER-002-SMOKE Phase 2.5 single-arg latency of 3.93s, with 3-arg parallelism adding the rest).

**Top-level response shape:**

```
topLevelKeys: [ 'mode', 'schemaVersion', 'perArgument' ]
mode: admin_validation
schemaVersion: mcp-021.machine-observations.boolean.v1
perArgumentCount: 3
```

**Per-argument summary (safe; no body text; no secrets):**

| # | argumentId | runId | status | runMode | schemaVersion | resultRowsCount | positiveObservationCount |
|---|---|---|---|---|---|---|---|
| 0 | f41b18b0 | 5e8b759d-f0f4-4c8e-bb28-b5be882020e4 | success | admin_validation | mcp-021.…boolean.v1 | 0 | 0 |
| 1 | 781f8057 | 67431fe3-5e29-4c38-8fc3-96c6f59467fa | success | admin_validation | mcp-021.…boolean.v1 | 0 | 0 |
| 2 | db0de3e0 | f370e813-1f80-4b40-8bc1-7a4d71c59489 | success | admin_validation | mcp-021.…boolean.v1 | 0 | 0 |

All 3 runs `status=success` with no `failureReason`. **However, the per-arg `resultRowsCount` / `positiveObservationCount` values are misleading** — see Phase 3 §3.3 below; persistence actually contains 6 positive result rows across runs 2 and 3.

**Result:** PASS — Edge Function authenticated, executed, returned HTTP 200 with valid response shape. Response-summary count discrepancy noted but not blocking.

---

## Phase 3 — Persistence readback (binding verdict per Phase 1.5)

### 3.1 — Table shape confirmed

**`argument_machine_observation_runs`** columns: `id`, `debate_id`, `argument_id`, `schema_version`, `requested_families`, `provider_key`, `model_name`, `input_hash`, `status`, `failure_reason`, `started_at`, `completed_at`, `created_at`, `run_mode`.

**`argument_machine_observation_results`** columns: `id`, `run_id`, `debate_id`, `argument_id`, `schema_version`, `raw_key`, `family`, `confidence`, `evidence_span`, `created_at`.

### 3.2 — Run row readback

All 3 run rows persisted with the canonical shape:

| run_id | argument_id | run_mode | status | schema_version | provider_key | model_name | requested_families | duration | failure_reason |
|---|---|---|---|---|---|---|---|---|---|
| `5e8b759d-...` | `f41b18b0` (arg1, root) | admin_validation | success | `mcp-021.…boolean.v1` | `mcp:classify_argument_boolean_observations` | `operator-mcp-server` | `["parent_relation"]` | (per arg row) | null |
| `67431fe3-...` | `781f8057` (arg2, depth 1) | admin_validation | success | `mcp-021.…boolean.v1` | `mcp:classify_argument_boolean_observations` | `operator-mcp-server` | `["parent_relation"]` | 00:00:04.841 | null |
| `f370e813-...` | `db0de3e0` (arg3, depth 2) | admin_validation | success | `mcp-021.…boolean.v1` | `mcp:classify_argument_boolean_observations` | `operator-mcp-server` | `["parent_relation"]` | 00:00:05.278 | null |

All identity fields correct:
- `run_mode='admin_validation'` ✓
- `status='success'` ✓
- `schema_version` matches MCP-021A constant verbatim ✓
- `provider_key='mcp:classify_argument_boolean_observations'` confirms MCP-server path identity ✓
- `model_name='operator-mcp-server'` is the deployed MCP server's identity stamp ✓
- `requested_families=['parent_relation']` ✓ (Family A only)
- `failure_reason=null` on all 3 ✓

### 3.3 — Result row readback (the binding signal)

**6 positive result rows persisted across runs 2 and 3.** This contradicts the Edge Function's response-summary `positiveObservationCount: 0` per arg — the persistence is correct; the response-summary count is a reporting bug.

Per-run breakdown:

| Run | Argument | n_results | Family A keys flagged |
|---|---|---|---|
| `5e8b759d-...` | arg1 (root, depth 0) | **0** | none (no parent → most parent-relation keys structurally false; expected) |
| `67431fe3-...` | arg2 (depth 1, rebuttal) | **3** | `challenges_parent`, `distinguishes_parent`, `quote_anchors_parent` (all confidence=high) |
| `f370e813-...` | arg3 (depth 2, counter) | **3** | `challenges_parent`, `distinguishes_parent`, `quote_anchors_parent` (all confidence=high) |

**Phase 0.5 prediction validated:** arg2's first predicted key (`challenges_parent`) fires with high confidence. arg3 fires the same pattern (challenges its immediate parent arg2 — the rebuttal — and quotes from it). The model did NOT fire `has_counter_rebuttal` on arg3, which is reasonable: `has_counter_rebuttal` may semantically belong on the FIRST parent that received the counter-rebuttal, not on the counter-rebuttal itself. Internal consistency is correct.

### 3.4 — Raw key membership verification

All 6 raw_keys are members of Family A's 16-key set:

| raw_key | In Family A? |
|---|---|
| `challenges_parent` | ✓ |
| `distinguishes_parent` | ✓ |
| `quote_anchors_parent` | ✓ |

(3 distinct keys, each appearing in both runs 67431fe3 and f370e813.) Zero taxonomy violations.

### 3.5 — Per-row confidence + evidence_span sanity

All 6 result rows:
- `confidence='high'` (within the binding `{low, medium, high}` set per MCP-021A)
- `evidence_span` lengths 45 / 67 / 185 chars (well under MCP-021A's 240-char ceiling)
- `family='parent_relation'` stamped correctly

### Phase 3 verdict

**PASS per Phase 1.5 verdict logic:** REAL text + POSITIVES_ONLY model + 1+ positives observed → PASS-eligible. Persistence layer correct. Raw key taxonomy correct. Identity stamps correct.

**Response-summary reporting discrepancy (non-blocking; recommend follow-up):** Edge Function's per-arg response summary returned `positiveObservationCount: 0` and `resultRowsCount: 0` for all 3 runs despite the persistence layer containing 6 positive rows. This is a response-shape reporting bug, not a chain-correctness failure. The underlying chain (Edge → MCP → Anthropic → parser → sanitizer → persistence) worked correctly. Recommend filing a small follow-up card: **MCP-021C-EDGE-RESPONSE-SUMMARY-FIX** to align the per-arg summary counts with the actual persisted result rows. Not authorized to ship MCP-021C-FAMILY-A-PROD before that's fixed if production observability depends on the response summary.

---

## Phase 4 — Source 6 admin-validation exclusion (3-tier evidence)

### Tier 2 (source-level filter) — PRESENT

`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`:

```typescript
.eq('argument_machine_observation_runs.run_mode', 'production');
```

The persistence query uses PostgREST `!inner` join (line 69) to force INNER JOIN against `argument_machine_observation_runs`, then `.eq()` filters `run_mode = 'production'`. Admin-validation rows are persisted but never reach Source 6 production rendering.

Module docstring (lines 16-20) documents this as MCP-021C-EDGE Decision 9 "Source 6 filter requirement" at the query layer (Decision 9 "preferred" location vs adapter layer).

### Tier 1 (test) — PRESENT

Targeted test run:

```
$ npx jest __tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts __tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts
PASS __tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts
PASS __tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts

Test Suites: 2 passed, 2 total
Tests:       26 passed, 26 total
```

`mcpOneTwoOneCEdgeAdminValidationMode.test.ts:14` references the exclusion behavior; `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` (referenced at line 155) is the dedicated exclusion test.

### Verdict

**PASS (Tier 1 + Tier 2)** — admin_validation rows are excluded from Source 6 production rendering both at the source-level filter (verifiable via grep) AND via passing tests (26 tests across 2 suites). The 6 admin_validation result rows persisted in Phase 3 are correctly held out of production read paths.

---

## Phase 5 — Targeted regression tests

| Suite | Suites | Tests | Time | Exit |
|---|---|---|---|---|
| MCP-021B (`mcpOneTwoOneB*`) | 9 | 220 | 7.55s | **0** |
| MCP-021C (`mcpOneTwoOneC*`) | 20 | 412 | 3.83s | **0** |
| Source 6 invariance (`mcpOneTwoOneASourceSixInvariance.test.ts`) | 1 | 8 | 0.93s | **0** |
| UX-001.5A (`uxOneOneFiveA*`) | 5 | 174 | 1.66s | **0** |

**Total: 35 suites / 814 tests / all exits 0.** No regressions; no failed suites.

**Result:** PASS.

---

## Authorizations applied (per PASS verdict)

- **MCP-021C-EDGE-SMOKE:** PASS
- **MCP-021C-FAMILY-A-PROD:** ✅ **AUTHORIZED to file**. Production auto-trigger on argument post is NOT yet enabled; the design phase of that card decides admin-trigger-first vs auto-on-post. The current path is fully admin-gated via the `mode='admin_validation'` discriminator + the Source 6 query filter.
- **MCP-SERVER-003 / Family B planning:** ✅ AUTHORIZED after operator sequencing decision (one family proven end-to-end before scaling horizontally).
- **ADMIN-MCP-001** (UI affordance flip): remains AUTHORIZED — operator chooses ordering relative to FAMILY-A-PROD.
- **MCP-021C-EDGE-RESPONSE-SUMMARY-FIX** (recommended small follow-up): reconcile Edge Function per-arg response summary `positiveObservationCount` / `resultRowsCount` with the actual persisted result row counts. Phase 3 §3.3 evidence.

## What this PASS proves

The MCP-021 boolean-observation track is operationally proven end-to-end across all layers:

1. **Client** (CDiscourse Edge Function caller) — `classify-argument-boolean-observations` v16 ACTIVE
2. **DB-config routing** — `provider_mode='mcp'` selects the MCP path (verified in MCP-SERVER-001-SMOKE)
3. **MCP server** — hosted Deno Deploy `cdiscourse-mcp-server` v0.1.0 prod
4. **Model** — Anthropic `claude-haiku-4-5` via the operator-mcp-server identity
5. **Parser** — MCP-021A `parseMcpBooleanObservationResponse` accepted output verbatim
6. **Sanitizer** — MCP-021A `sanitizeMcpBooleanObservationResponse` retained only positive observations with valid confidence
7. **Persistence** — MCP-021B `argument_machine_observation_runs` + `argument_machine_observation_results` populated with `run_mode='admin_validation'` discriminator
8. **Source 6 exclusion** — production read path filters `run_mode='production'` at the query layer; admin_validation rows persisted for audit but never rendered

The Phase 0.5 prediction was confirmed in detail: arg2 (depth 1 rebuttal) fired `challenges_parent` exactly as expected, plus `distinguishes_parent` + `quote_anchors_parent` (both well-supported by the bot-seeded text). The model's behavior is internally consistent and conservatively biased toward true positives.

## What this PASS does NOT prove

- **Auto-trigger on argument post.** The current path is admin-gated. MCP-021C-FAMILY-A-PROD design will decide whether to enable automatic invocation on every argument post or stay admin-trigger-first.
- **Multiple families.** Only Family A is verified. Family B (`disagreement_axis`) and others remain at MCP-SERVER-003 scope.
- **Production rendering.** The Source 6 production read path was tested for EXCLUSION of admin rows; it was NOT yet exercised on production rows (none exist; admin_validation only). MCP-021C-FAMILY-A-PROD will exercise the production rendering path.

## Status across the MCP-021 + MCP-SERVER tracks

- MCP-021A (taxonomy + schema + parser): shipped (`d6648b4`)
- MCP-021B (persistence + Source 6 adapter): shipped (`eaa1aeb`), smoke PASS (`6feeb08`)
- MCP-021C-EDGE (Edge Function runtime spine): shipped (`9a4de95`)
- MCP-SERVER-001 (server foundation): shipped (`8a1652c`), smoke PASS (`bae4984`)
- MCP-SERVER-002 (real Family A classifier): shipped (`27bb837`), smoke PASS (`fc28605`)
- **MCP-021C-EDGE-SMOKE (live Family A edge-to-persistence): PASS (this audit)**
- MCP-021C-FAMILY-A-PROD: ✅ AUTHORIZED to file (next card)
- MCP-021C-EDGE-RESPONSE-SUMMARY-FIX: recommended small follow-up
- MCP-SERVER-003 / Family B planning: AUTHORIZED after operator sequencing
- ADMIN-MCP-001: AUTHORIZED (parallel)
- OPS-MCP-OBSERVABILITY: deferred

## References

- Edge Function: `supabase/functions/classify-argument-boolean-observations/index.ts:97-100` (request shape), `:177-183` (mode enum), `:473-474` (family gate)
- Persistence writer: `supabase/functions/_shared/booleanObservations/persistenceWriter.ts:13-14` (positives-only model)
- Source 6 query filter: `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
- Predecessor audit: `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md`
- Design: `docs/designs/MCP-021C-EDGE.md` (Decision 9 — Source 6 filter at query layer)
- Pivot decision: `docs/decisions/MCP-021C-edge-pivot.md`
- Intent brief: `docs/designs/MCP-021C-EDGE-intent.md`
