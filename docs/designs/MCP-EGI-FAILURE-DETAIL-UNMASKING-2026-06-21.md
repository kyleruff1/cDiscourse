# MCP-EGI-003 — Edge unmasking of hosted-MCP validation_failed into `failure_detail`

**Status:** Implementation PR open (#785 lane).
**Lane:** Edge-only (`supabase/functions/_shared/booleanObservations/**`). Edge auto-deploys on merge via the Supabase GitHub integration; mcp-server UNCHANGED; **no migration**.
**Tracking:** #785 (this card), #783 (MCP-EGI-001 root), #786 (MCP-EGI-004 next D3 canary).
**Trigger:** MCP-EGI-004 D3 canary on `26fbeb1` (post-MCP-EGI-002 deploy `ahrj6fnbectc`) **FAILED** with the same E / G / I cluster dead-lettering at attempt 5; the persisted `failure_detail` jsonb still does not distinguish hosted-MCP `validation_failed` from a genuine provider 5xx, so the next iteration cannot be picked on evidence. See [docs/designs/MCP-EGI-EVIDENCESPAN-VALIDATION-FIX-2026-06-21.md](docs/designs/MCP-EGI-EVIDENCESPAN-VALIDATION-FIX-2026-06-21.md) §10 for the ordering MCP-EGI-001 prescribed.

---

## 1. Goal

Make the row-level `failure_detail` discriminate between:
- a hosted-MCP `validation_failed` residual (Edge currently masks as `provider_server_error`), and
- a genuine upstream Anthropic 5xx / 429 / timeout / capacity transient

without storing any raw prompt, body, response, or evidenceSpan value, and without changing classifier outcomes, retry policy, or any prompt.

## 2. Current masking problem

The 2026-06-21 MCP-EGI-004 D3 canary surfaced exactly the gap the post-MCP-EGI-001 design predicted. Per-family terminal state on canary target `7bf37011-fbca-4de7-b24f-a9ea6060966a`:

| Family | State | Attempt | Reason |
|--------|-------|---------|--------|
| A / B / C / F / H | succeeded | 1 | — |
| D `evidence_source_chain` | succeeded | 3 (recovered) | `mcp_api_error` / `provider_server_error` retries 1-2 |
| E `argument_scheme` | **dead_letter** | 5 | `mcp_api_error` / `provider_server_error` / `retry_attempts_exhausted` |
| G `resolution_progress` | **dead_letter** | 5 | same |
| I `thread_topology` | **dead_letter** | 5 | same |

`failure_detail` on each dead-letter:
```json
{
  "family": "...",
  "reason": "mcp_api_error",
  "run_mode": "production",
  "attempt_count": 5,
  "correlation_id": "<uuid>",
  "schema_version": "mcp-021.machine-observations.boolean.v1"
}
```

The row cannot distinguish:
1. Hosted-MCP `validation_failed` at `evidenceSpan.<rawKey>` (prompt-rewrite residual).
2. Genuine Anthropic 5xx / 429 / capacity transient lasting >26 min.
3. A different MCP-server-internal error (ban-list residual, modelInfo drift).

This is because the Edge intentionally drops the validator detail string for leak-safety, AND the path allowlist drops `evidenceSpan.compares_options` because the dotted form is not in the legacy literal set.

## 3. Root code surfaces (read-only audit)

| Surface | Current behavior | Gap |
|---------|------------------|-----|
| `mcp-server/tools/classifyArgumentBooleanObservations.ts:355-360` | Returns `{isError:true, reason, path, detail}` envelope | NONE — server already emits the discriminator |
| `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:212-225` + `:239-263` | Validator emits structural `detail` strings like `"value must be string or null"`, `"length 241 exceeds max 240"`, `"rawKey present in observations but missing from evidenceSpan"` | NONE — all detail strings are structural |
| `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts:264-276` | Forwards `serverReason` + `path`; **drops `detail`** | GAP 1 — `extracted.detail` never read |
| `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts:259-270` | `ALLOWED_DETAIL_PATHS` accepts only top-level literals | GAP 2 — `evidenceSpan.compares_options` dropped |
| `supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts:43-51` | `RunRowFailureDetail` has no `mcp_tool_*` fields | GAP 3 — even if 1+2 fixed, no place to persist |
| `classifierDrainerCore.ts:354` + `classifyArgumentCore.ts:341` | Call sites forward only `validatorPath` | GAP 4 — no flow for `serverReason` / `detailCategory` |

## 4. Safe metadata contract

### New closed-enum type (in `booleanObservationFailureSubreason.ts`)

```ts
export type McpToolDetailCategory =
  | 'evidence_span_length_exceeded'
  | 'evidence_span_invalid_type'
  | 'evidence_span_key_set_missing'
  | 'evidence_span_key_set_extra'
  | 'confidence_key_set_missing'
  | 'confidence_key_set_extra'
  | 'confidence_invalid_value'
  | 'observation_invalid_value'
  | 'observation_key_missing_from_checked'
  | 'schema_version_mismatch'
  | 'missing_required_field'
  | 'flag_count_too_high'
  | 'doctrine_ban_list'
  | 'unknown_validation_failed';
```

### New closed allowlist for `mcp_tool_reason`

```ts
export const ALLOWED_MCP_TOOL_REASONS: ReadonlySet<string> = new Set([
  'validation_failed',
  'not_implemented',
  'unsupported_family',
  'unsupported_raw_key',
  'invalid_source_subset',
  'fixture_load_failed',
  'key_missing',
  'timeout',
  'rate_limited',
]);
```

A reason outside this set is dropped at the persisted-row layer (defense-in-depth — a future server emitting an unknown reason is leak-safe by construction).

### Path widening — `isAllowedDetailPath`

Accepts both:
- legacy top-level literals (`schemaVersion`, `nodeId`, `checkedRawKeys`, `observations`, `confidence`, `evidenceSpan`, `modelInfo`, `modelInfo.provider`, `modelInfo.serverName`, `modelInfo.classifierSetVersion`), and
- `<top>.<identifier>` where `<top>` ∈ `{evidenceSpan, observations, confidence}` and `<identifier>` matches `/^[A-Za-z][A-Za-z0-9_]{0,79}$/`.

The dotted form CANNOT smuggle a value because (a) identifier-shaped (no whitespace, no quotes, no raw text), (b) capped at 80 chars (rawKey names are <= ~40), (c) the validator's emit path is structural by construction.

### Pure mapper `mcpToolDetailToCategory(detail) → McpToolDetailCategory | undefined`

13 structural patterns matched via regex / literal; fall-through is `unknown_validation_failed`. Critically: the function NEVER captures a named group, NEVER extracts a model-emitted value, and NEVER returns the raw `detail` string. The risky `expected mcp-021.…; got <X>` shape is matched by PREFIX only — the X value is discarded.

### New persisted fields

```ts
export interface RunRowFailureDetail {
  validator_path?: string;
  reason?: string;
  family?: string;
  correlation_id?: string;
  attempt_count?: number;
  run_mode?: string;
  schema_version?: string;
  // MCP-EGI-003 additive:
  mcp_tool_reason?: string;            // ALLOWED_MCP_TOOL_REASONS member only
  mcp_tool_detail_category?: string;   // McpToolDetailCategory enum only
}
```

Both fields are jsonb-additive — no schema migration.

## 5. Raw-value prohibition (preserved + extended)

- `detail` string from the server is read ONLY as the single argument to `mcpToolDetailToCategory()`. The raw string never appears in `BooleanObservationFailureDetail` or `RunRowFailureDetail`.
- A maliciously-crafted `serverReason` carrying a `Bearer …` / JWT / `sk-ant-…` shape is dropped by the existing `looksSecret` scrub (Phase-1 hardening retained).
- `mcp_tool_reason` is allowlisted against `ALLOWED_MCP_TOOL_REASONS` — an unknown value is dropped silently (leak-safe by construction).
- `mcp_tool_detail_category` is allowlisted against `ALL_MCP_TOOL_DETAIL_CATEGORIES` — an unknown value is dropped silently.

Tests (in `__tests__/mcpEgiZeroZeroThreeFailureDetailUnmasking.test.ts`):
- LEAK-1 — schemaVersion-mismatch raw value (e.g. arbitrary model-emit string) is never captured in any persisted field.
- LEAK-2 — `observations key "<X>" missing from checkedRawKeys` does not smuggle the `<X>` value.
- LEAK-3 — every documented category is identifier-shaped `[a-z][a-z0-9_]*`.

## 6. Implementation surfaces

| File | Change |
|------|--------|
| `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts` | Add `McpToolDetailCategory` + `ALL_MCP_TOOL_DETAIL_CATEGORIES` + `ALLOWED_MCP_TOOL_REASONS` exports; add `mcpToolDetailToCategory()`; widen `ALLOWED_DETAIL_PATHS` literal set → `isAllowedDetailPath()` structural check accepting dotted forms; add `detailCategory` to `BooleanObservationFailureDetail` + `FailureDetailInput`; plumb through `buildFailureDetail`. |
| `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts` | Import `mcpToolDetailToCategory`; in the `isServerErrorEnvelope` branch, derive `detailCategory` from `extracted.detail`; pass through `buildFailureDetail`. |
| `supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts` | Re-derive `RUN_ROW_ALLOWED_MCP_TOOL_REASONS` + `RUN_ROW_ALLOWED_MCP_TOOL_DETAIL_CATEGORIES` locally (preservation-manifest pattern); add `mcpToolReason` + `mcpToolDetailCategory` to `RunRowFailureDetailInput`; add `mcp_tool_reason` + `mcp_tool_detail_category` to `RunRowFailureDetail`; plumb through `buildRunRowFailureDetail`. |
| `supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts` | At the terminal/retry-write call (`buildRunRowFailureDetail` invocation), forward `mcpToolReason: classify.adapterResult.detail?.serverReason` and `mcpToolDetailCategory: classify.adapterResult.detail?.detailCategory`. |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Same forwarding at the direct-dispatch / admin_validation write path. |
| `__tests__/_helpers/booleanObservationFailureSubreasonDeno.ts` | Bridge-export the new type + mapper + allowlists. |
| `__tests__/_helpers/classifierRunRowFailureDetailDeno.ts` | Mirror the new input/output fields. |
| `__tests__/mcpEgiZeroZeroThreeFailureDetailUnmasking.test.ts` (NEW) | 42 tests — mapper, path widening, builder plumbing, allowlist drift, leak scans. |
| `__tests__/mcpOneTwoOneCServerErrorEnvelope.test.ts:388-397` | SEV-15b updated to assert the new MCP-EGI-003 invariant: `extracted.detail` is read only as input to `mcpToolDetailToCategory()`, never as a `buildFailureDetail` free-text input. |

## 7. Behavior preservation

| Surface | Status |
|---------|--------|
| `mcp-server/**` (Deno target) | UNCHANGED — no Deno Deploy needed |
| Validator (`validateMcpBooleanObservationResponse`) | UNCHANGED |
| Ban-list scanners | UNCHANGED |
| Family prompts | UNCHANGED |
| `MAX_EVIDENCE_SPAN_CHARS = 240` | UNCHANGED |
| `FAMILY_*_MAX_TOKENS = 1500` | UNCHANGED |
| `DRAINER_*` retry / backoff / concurrency | UNCHANGED (#782 retained) |
| `familyRegistry` | UNCHANGED |
| `failure_reason` (e.g. `mcp_api_error`) | UNCHANGED — already-existing rows keep the same shape |
| `failure_sub_reason` (e.g. `provider_server_error`) | UNCHANGED |
| Retry/dead-letter dispositions | UNCHANGED — `classifyDrainerFailure` lookup keys off `subReason`, which is byte-equal |
| Migration | NONE — `failure_detail` is jsonb |
| Engine | UNCHANGED |
| Env / secret / cron | UNCHANGED |

The change is purely ADDITIVE: rows from before this PR carry no `mcp_tool_*` keys; rows from after carry them when the `{isError}` envelope branch fires. Operator SQL `failure_detail->>'reason'` continues to work; new keys are queryable via `failure_detail->>'mcp_tool_reason'` and `failure_detail->>'mcp_tool_detail_category'`.

## 8. Tests

| Suite | Count | Surface |
|-------|-------|---------|
| `__tests__/mcpEgiZeroZeroThreeFailureDetailUnmasking.test.ts` (NEW) | 42 | mapper × 14 cases; path widening × 9 cases; builder plumbing × 4 + 9 cases; leak scans × 3 |
| `__tests__/mcpOneTwoOneCServerErrorEnvelope.test.ts` | 18 (1 updated) | SEV-15b updated to the new contract |
| Existing FailureDetail / FailureSubreason / drainer / direct-dispatch suites | 116 unchanged | regression preservation |
| Full Jest | 32,166 passed / 1 skipped / 0 failed | repo-wide |

`npm run typecheck` clean. `npm run lint --max-warnings 0` clean.

## 9. Deploy implications

- **Supabase Edge** auto-deploys on merge via the Supabase GitHub integration (`classifier-drainer` + `classify-argument-boolean-observations` are config.toml-registered). No operator deploy step is needed.
- **Deno Deploy** is NOT required — `mcp-server/**` is byte-unchanged. `cdiscourse-mcp-server` build `ahrj6fnbectc` (the MCP-EGI-002 deploy) remains the live revision.
- **No migration.** `failure_detail` is jsonb; the new keys are additive at the application layer.
- **No env / secret / cron / routing mutation.**

## 10. Next D3 canary after deploy

Per the canary-then-burst rule the prior MCP-EGI-004 attempts have used:
1. After merge, the Supabase integration auto-redeploys the Edge functions.
2. Operator runs ONE MCP-EGI-004 canary against the new Edge revision (1 target → 9 cells; same `[arch-001-queue-smoke]` lane).
3. If E / G / I dead-letter at attempt 5 again, the row now distinguishes the inner cause:
   - `mcp_tool_reason='validation_failed'` + `mcp_tool_detail_category='evidence_span_length_exceeded'` → another prompt iteration on the length contract.
   - `mcp_tool_reason='validation_failed'` + `mcp_tool_detail_category='evidence_span_invalid_type'` → another prompt iteration on value-type.
   - `mcp_tool_reason='validation_failed'` + `mcp_tool_detail_category='evidence_span_key_set_*'` → another prompt iteration on key-set coordination.
   - `mcp_tool_reason='validation_failed'` + `mcp_tool_detail_category='doctrine_ban_list'` → a hidden ban-list residual on the structural span (different family lane).
   - `mcp_tool_reason='validation_failed'` + `mcp_tool_detail_category='unknown_validation_failed'` → a new validator path not in this enum's whitelist; treat as MCP-EGI-003 follow-up (extend the enum).
   - **Both `mcp_tool_reason` and `mcp_tool_detail_category` absent** → genuine Anthropic 5xx / 429 / capacity transient → the #409 capacity / drain-pacing lane.
4. If canary clean (9/9 succeeded), proceed to the canonical burst (8 targets × 9 families) per the same lane.

## 11. Non-goals (explicit)

- NO validator relaxation.
- NO ban-list relaxation.
- NO `MAX_EVIDENCE_SPAN_CHARS` / `max_tokens` change.
- NO retry-budget / backoff / drainer / concurrency change. #782 stays merged.
- NO familyRegistry change.
- NO Family I `productionEnabled` rollback.
- NO mcp-server change (no Deno Deploy).
- NO fixture rewrite.
- NO #409 capacity / drain-pacing work — that is the post-canary follow-up IF the new row data points there.
- NO migration.

---

_Doctrine: `cdiscourse-doctrine §1 / §10a` (no verdict tokens in the category vocabulary — banned-token scan asserts), `§6` (secret-surface closed structurally — closed-enum + closed-reason allowlists at the persisted layer). test-discipline binds; the new suite carries 42 behavioral tests + leak scans._
