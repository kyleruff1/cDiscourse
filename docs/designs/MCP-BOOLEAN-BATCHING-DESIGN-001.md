# MCP-BOOLEAN-BATCHING-DESIGN-001 — Request batching for >20-key families

**Status:** Design draft
**Epic:** Epic 12 (Rules UX / MCP semantic-referee track) — Boolean Machine Observation classifier
**Release:** Build-2 enablement (unblocks Families D + G)
**Issue:** (filed by caller — MCP-BOOLEAN-BATCHING-DESIGN-001)
**Branch:** `docs/mcp-boolean-batching-design`
**Stacks on:** Build-2 Family-F commit `2d4fa70` (branch `feat/mcp-build2-family-f`); see §Dependencies for the fork-point reconciliation.
**Deploy posture:** Deploy-bearing (Edge classifier mirror auto-deploys on merge; the mcp-server is a manual Deno Deploy step) → **GATE-C** at implementation time. THIS DOC IS DESIGN-ONLY.

---

## BLOCKERS summary (read first)

**NO HARD BLOCKERS.** Request batching is feasible with **no global schema-version bump, no DDL, no migration, no `familyRegistry`/`productionEnabled` change, no `engine.ts`/submission-path change.** Every structural precondition for batching already exists in the deployed code:

- The per-family prompt builders already accept an arbitrary rawKey subset (`buildFamilyDUserPrompt` filters to `request.requestedRawKeys`, `familyDPrompt.ts:165-173`; Family G mirrors it).
- The request validator already accepts any subset of a family's rawKeys with no minimum count (`familyBooleanRequestSchema.ts:243-261`).
- The persistence run model already keys results on `(run_id, raw_key)` with the read path keyed on `(argument_id, schema_version, raw_key)` membership — never on the *count* of keys per run (`machineObservationPersistenceAdapter.ts:140-142`, migration `20260526000018:117`).
- The `MAX_FLAGS_PER_RESPONSE = 20` cap is a *per-response* check (`mcpBooleanObservationSchema.ts:261`, mirror `:163`). Splitting one family's keys into N responses, each ≤ 20, satisfies it byte-for-byte unchanged.

The cap is the ONLY thing that blocks D (22) and G (21) today; batching dissolves it without touching the cap, the schema, or the wire shape.

---

## Goal (one paragraph)

Build-2 expands Family **D** (`evidence_source_chain`) from a 19-key ai_classifier subset to **22** and Family **G** (`resolution_progress`) from 18 to **21** (BUILD2 manifest §3, §6 — `docs/designs/MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001-build2-families-manifest.md:24,27`). The boolean-observation classifier validates the model's response with `MAX_FLAGS_PER_RESPONSE = 20`, counted over **every checked key** in `observations` (true *and* false), not just positives (`mcpBooleanObservationSchema.ts:260-267` — `Object.entries(parsed['observations']).length`). A single MCP request that asks all 22 D keys (or all 21 G keys) produces a 22-entry (or 21-entry) `observations` map, which the mcp-server's own validator rejects with `validation_failed` (mirror `:163`) and which the Edge parser would also reject (`flag_count_too_high`). This card adds a deterministic **chunking layer** that splits a family's classified-key list into batches of ≤ `BATCH_SIZE` keys, issues one MCP request per batch (each ≤ 20 keys → each passes the unchanged validator), and merges the N batch responses into the family's full result before persisting through the **same** `persistRun`/`persistResults` path. The doctrine that shapes this design: the cap is a *per-response* leak/cost guard, not a *per-family* semantic limit — so the cap stays per-response (each batch ≤ 20) while the family's merged observation set may exceed 20. No observation's meaning changes; only the transport is split. Every doctrine invariant from the BUILD2 manifest §7.2 holds (no schema bump, no DDL, post-storage/display-only, advisory, `authoritative: false`).

---

## Data model

**No new data model. No DDL. No migration.** The key-value result store already accommodates an arbitrary number of distinct rawKeys per argument:

- `argument_machine_observation_runs` — one row per classifier invocation. Columns unchanged (`migration 20260526000018:78-95`). This design defines **one logical run per (argument, family)**; see §"Response merge / run model" for the run_id decision (recommend: **one run row per family**, all batches share it).
- `argument_machine_observation_results` — one row per **positive** observation. `CONSTRAINT amor_unique_run_rawkey UNIQUE (run_id, raw_key)` (`:117`). Batching never writes the same rawKey twice in one family run (each key lives in exactly one batch — see chunking determinism), so the constraint is honored unchanged. No new columns; `batch_index`/`batch_total` are NOT persisted (out-of-band orchestration; see §"No-schema-bump invariant").

The TS types `McpBooleanObservationRequest` / `McpBooleanObservationResponse` are **unchanged** (`mcpBooleanObservationSchema.ts:53-129`). Each batch request is a fully-valid `McpBooleanObservationRequest` whose `requestedRawKeys` is the batch's key slice; each batch response is a fully-valid `McpBooleanObservationResponse` with ≤ 20 `observations`.

A single new pure-TS helper type (orchestration-internal, NOT on the wire):

```ts
// supabase/functions/_shared/booleanObservations/booleanObservationBatching.ts (NEW)
export interface RawKeyBatch {
  /** 0-based index of this batch within the family's batch list. */
  readonly batchIndex: number;
  /** Total batches for the family this call. */
  readonly batchTotal: number;
  /** The rawKeys assigned to this batch (≤ BATCH_SIZE; stable order). */
  readonly rawKeys: readonly string[];
}

/** Per-batch outcome carried through the merge step (orchestration-internal). */
export interface BatchClassifyOutcome {
  readonly batchIndex: number;
  readonly rawKeys: readonly string[];
  readonly result:
    | { kind: 'success'; response: McpBooleanObservationResponse }
    | { kind: 'unavailable'; reason: string; subReason?: string; detail?: unknown };
}
```

These types live only in `supabase/functions/_shared/booleanObservations/` and its parity mirror; they never serialize to the wire.

---

## File changes

Counts are estimates to help the implementer plan; the implementer right-sizes.

### New files

- `supabase/functions/_shared/booleanObservations/booleanObservationBatching.ts` (~120 lines) — the pure chunker: `chunkRawKeys(rawKeys, batchSize): RawKeyBatch[]` (deterministic split with stable order), `BATCH_SIZE` constant, `mergeBatchResponses(outcomes): McpBooleanObservationResponse` (combines N batch `observations`/`confidence`/`evidenceSpan`/`checkedRawKeys` into one logical response object), and the partial-failure policy helper. Pure TS — no Deno, no fetch.
- `mcp-server/lib/mcpBooleanObservationBatchingMirror.ts` (~60 lines) — byte-equal mirror of the `BATCH_SIZE` constant + `chunkRawKeys` ONLY, **if** the implementer decides the mcp-server must self-chunk a single >20-key request defensively (see §"Edge + mcp-server changes" — recommend NOT; the Edge does all chunking, the mcp-server stays single-call-per-batch). Parity-tested against the Edge copy if created.
- `__tests__/booleanObservationBatching.test.ts` (~200 lines) — chunk determinism, merge correctness, partial-failure, backward-compat (≤20-key families → 1 batch).
- `mcp-server/tests/mcpBooleanObservationBatchingMirror.test.ts` (only if the mirror is created).

### Modified files

- `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` (~+60/-15 lines) — `classifyOneArgumentCore` currently builds ONE request and calls the adapter ONCE (`:223-242`). Change: after building the family's full rawKey set (via the existing `buildBooleanObservationRequestForArgument`), chunk it; for each batch build a per-batch request (clone the base request, override `requestedRawKeys` + `definitions` slice), call the adapter per batch (sequential or bounded-parallel — see §"Failure semantics"), merge responses, then run the **unchanged** `sanitize → persistRun → persistResults → post-persist SELECT` tail. The single-batch path is byte-identical to today (see §"No-schema-bump invariant" proof). One run row per family; results from all batches written under that run_id.
- `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` (~+25 lines) — add a thin `buildBatchRequest(base, batch)` helper that returns a `McpBooleanObservationRequest` with `requestedRawKeys = batch.rawKeys` and `definitions` narrowed to the batch's keys. The existing `buildBooleanObservationRequestForArgument` is unchanged (still the source of the *full* family request that the chunker splits). No change to the source-subset filter (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) — D/G stay ai_classifier-only; the chunker splits the *already-source-filtered* set.
- `mcp-server/lib/familyDPrompt.ts` / `familyGPrompt.ts` — **NO change needed** (the prompt builders already filter to `requestedRawKeys`; `familyDPrompt.ts:165-173`). The card adds the 3 new D keys + 3 new G keys to `familyDKeys.ts` / `familyGKeys.ts` — that work belongs to the **Family-D / Family-G cards**, NOT this infra card. The infra card touches NO family key file.
- `__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts` — the infra card does **not** touch any `family*.ts` definition file, so RO-10/RO-12/RO-13 stay green. The Family-D card relaxes its own RO-10; the Family-G card relaxes its own RO-13 (each per the existing relaxation pattern, `:201-209`).

### Deleted files

- None.

---

## API / interface contracts

### Chunker (new, pure)

```ts
export const BATCH_SIZE = 16; // ≤ 20 with headroom; see §"Chunking strategy"

/**
 * Deterministically split a family's rawKey list into batches of ≤ batchSize.
 * Stable, reproducible: same input → byte-identical batches (no Date, no sort
 * unless the input is pre-sorted by the caller; preserves caller's input order).
 * A list of length ≤ batchSize returns exactly ONE batch (backward-compat).
 */
export function chunkRawKeys(
  rawKeys: readonly string[],
  batchSize?: number, // defaults to BATCH_SIZE
): RawKeyBatch[];

/**
 * Merge N batch responses into one logical family-level response.
 * Concatenates checkedRawKeys; merges observations/confidence/evidenceSpan maps.
 * Throws NEVER. Duplicate-key guard: if two batches report the same rawKey
 * (must not happen given disjoint chunks), the FIRST wins and the collision is
 * recorded for the run's failure_detail (defensive — should be unreachable).
 * nodeId + modelInfo taken from the first successful batch.
 */
export function mergeBatchResponses(
  outcomes: readonly BatchClassifyOutcome[],
): { merged: McpBooleanObservationResponse; collisions: string[] };
```

### Per-batch request builder (new helper on the request-builder module)

```ts
/**
 * Build a per-batch McpBooleanObservationRequest from the full family request.
 * Overrides requestedRawKeys with the batch slice and narrows definitions to
 * the batch's keys. All other fields (nodeId, currentText, parentText,
 * threadContextExcerpt, requestedFamilies, schemaVersion, timeoutMs) are copied
 * verbatim from the base. Pure.
 */
export function buildBatchRequestFromFull(
  base: McpBooleanObservationRequest,
  batch: RawKeyBatch,
): McpBooleanObservationRequest;
```

### Orchestration change (existing function, signature UNCHANGED)

`classifyOneArgumentCore(argumentId, requestedFamilies, mode, serviceClient, adapter)` — signature unchanged (`classifyArgumentCore.ts:194-200`). The adapter injection point is preserved (tests still mock it). Internally the function now loops batches and calls `adapter(batchRequest)` once per batch instead of once total.

### Wire contract (UNCHANGED)

- Request: `McpBooleanObservationRequest` (`mcpBooleanObservationSchema.ts:53-88`) — each batch is a valid instance.
- Response: `McpBooleanObservationResponse` (`:98-129`) — each batch is a valid instance with ≤ 20 `observations`.
- mcp-server tool input/output JSON Schema (`classifyArgumentBooleanObservations.ts:167-237`) — **unchanged**.
- `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1'` — **byte-equal, unchanged** (a regression test asserts the constant).

---

## §1 — Chunking strategy

**Recommendation: `BATCH_SIZE = 16`.**

- The cap is 20 *per response*. The observation count = number of *checked keys* (true + false), and the per-family prompts instruct the model to answer **every requested key** (`familyDPrompt.ts:256` — "Every key in checkedRawKeys MUST appear in observations"). So a batch of N requested keys produces ~N observation entries. Choosing `BATCH_SIZE = 16` leaves **4 entries of headroom** under 20 — defensive against a model that emits an extra spurious key (which the sanitizer would drop, but which still counts toward the cap before sanitization at the mcp-server step-4 validator).
- **D (22 keys) → 2 batches** (16 + 6). **G (21 keys) → 2 batches** (16 + 5). Both well within 20 per batch.
- **Justification for not using 20:** 20 = the cap itself, zero headroom. A single extra emitted key trips `flag_count_too_high`. 16 is the largest round value with comfortable headroom; it keeps D and G at 2 batches (a higher value like 11 would force D to 2 batches too but with no benefit, and 8 would force 3 batches — more round-trips for no gain). The implementer MAY justify a different value (e.g. 18) but MUST keep headroom ≥ 2 and document the round-trip count.

**Stable ordering (reproducible):** `chunkRawKeys` preserves the caller's input order and slices sequentially (`rawKeys.slice(i, i+batchSize)`). The caller (`buildBooleanObservationRequestForArgument`) already produces rawKeys in a deterministic registry-iteration order (`booleanObservationRequestBuilder.ts:140-156` — `Object.values(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)` iteration, deduped via a `Set` whose insertion order is the registry order). To guarantee batch assignment is stable across deploys even if registry iteration order shifts, **the chunker sorts the rawKey list lexicographically before slicing** (a one-line `[...rawKeys].sort()`), so a given rawKey always lands in the same batch regardless of upstream iteration changes. This makes batch membership a pure function of the family's key set + `BATCH_SIZE` — important for idempotent re-runs (§Risks).

**Families ≤ the cap send exactly 1 batch → byte-identical behavior, zero change for A/B/C/E/F.** Proof: for a family whose source-filtered rawKey set has length L ≤ 20:
- Today (post-Build-2): A=19, B=17, C=20, E=19, F=17 — all ≤ 20.
- `chunkRawKeys(rawKeys)` with any of these L ≤ `BATCH_SIZE`? **No** — C=20 and E=19 and A=19 exceed `BATCH_SIZE=16`. This is a problem: a `BATCH_SIZE` of 16 would force A/C/E into 2 batches too, which is a *behavior change* (2 round-trips instead of 1) even though they fit under the cap.

**Resolution (important):** the chunker must produce **1 batch when the family's key count ≤ 20 (the cap)**, and only split when it *exceeds the cap*. So the split predicate is "L > 20 (the response cap)", and `BATCH_SIZE` applies only to the *resulting* batches when a split is needed. Concretely:

```ts
export function chunkRawKeys(rawKeys, batchSize = BATCH_SIZE): RawKeyBatch[] {
  if (rawKeys.length <= MAX_FLAGS_PER_RESPONSE) {
    return [{ batchIndex: 0, batchTotal: 1, rawKeys: [...rawKeys] }]; // 1 batch, byte-identical path
  }
  // split into ceil(L / batchSize) batches of ≤ batchSize each
  ...
}
```

This guarantees **A (19), B (17), C (20), E (19), F (17) → exactly 1 batch → the single-batch path is byte-identical to today** (same one adapter call, same one run row, same merge-of-one = the response itself). Only **D (22) and G (21)** — the two families that *exceed the 20 cap* — split. D → ⌈22/16⌉ = 2 batches (16 + 6); G → ⌈21/16⌉ = 2 batches (16 + 5).

This is the load-bearing design choice: **split-threshold = the cap (20); batch-size = 16 only for the split itself.** It preserves byte-identical behavior for every family that fits, and minimizes round-trips for those that do not.

---

## §2 — Per-batch request/response & the no-schema-bump invariant

Each batch is its own `McpBooleanObservationRequest` (`requestedRawKeys` = the batch slice, `definitions` narrowed to the batch). The mcp-server handles it through the **unchanged** `handleClassifyArgumentBooleanObservations` path (`classifyArgumentBooleanObservations.ts:431`): validate → resolve family → provider → validate response (≤ 20 keys → passes) → ban-list scan → return. The response is a `McpBooleanObservationResponse` with ≤ 20 `observations` → passes both validators unchanged.

**How the no-schema-bump invariant holds:**

1. **The wire SHAPE per batch is byte-identical to today.** A batch request/response uses the exact `McpBooleanObservationRequest`/`McpBooleanObservationResponse` shapes — same fields, same types, same `schemaVersion` constant. The mcp-server tool's JSON Schema (`:167-237`) accepts it without modification. No field is added to the wire.
2. **No `batch_index`/`batch_total` on the wire.** Batch orchestration is **out-of-band** — it lives entirely in the Edge `classifyOneArgumentCore` loop. The mcp-server never knows it is serving a batch; it sees N independent single-family requests with N different rawKey subsets. This is the *preferred* design per the brief: zero wire change.
   - *Considered and rejected:* adding optional `batchIndex`/`batchTotal` to the request. Even as additive-optional fields, they would (a) require touching the tool's `inputSchema` `additionalProperties: false` (`:194`), making it not additive in practice, and (b) serve no purpose — the mcp-server does not merge; the Edge does. Out-of-band is strictly simpler and changes nothing.
3. **The cap stays per-response.** `MAX_FLAGS_PER_RESPONSE = 20` is unchanged on both sides (`mcpBooleanObservationSchema.ts:151`, mirror `:35`). Each batch's response has ≤ 20 keys, so each passes. The *family's merged set* (22 for D, 21 for G) is assembled **after** validation, in the Edge merge step, where no per-response cap applies (the merged object is never re-validated against `MAX_FLAGS_PER_RESPONSE` — it is sanitized per-rawKey and persisted per-positive-row). The cap's purpose (bound a single model response's size for leak/cost/parse safety) is fully preserved per batch; it was never a semantic limit on how many distinct observations an argument may carry.
4. **The read path is version-pinned and count-agnostic.** `mapPersistedObservationRowsToNodeLabelMarks` filters on `schema_version === MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` + rawKey membership (`machineObservationPersistenceAdapter.ts:140-142`). Because the schema version is unchanged, every existing room's observations remain visible; because the read path never counts keys-per-run, a 22-key D argument renders all 22 (whichever fired positive) with no change.

**Single-batch byte-identity proof (A/B/C/E/F):** when `chunkRawKeys` returns 1 batch (L ≤ 20), `buildBatchRequestFromFull(base, theOneBatch)` returns a request whose `requestedRawKeys` equals `base.requestedRawKeys` (the one batch holds all keys) and whose `definitions` equals `base.definitions` (narrowed to all keys = unchanged). The single `adapter(request)` call, the single `persistRun`, and `mergeBatchResponses([oneSuccess])` (which returns that response verbatim) reproduce today's exact behavior. A regression test asserts: for a ≤20-key family, the adapter is called exactly once and the persisted rows match the no-batching baseline.

---

## §3 — Response merge / run model

**Run model decision: ONE run row per (argument, family); all batches share its `run_id`.** Rationale:

- A "run" is the classifier's logical attempt at a family for an argument (`migration 20260526000018:218` — "per-classifier-run audit row … on a single argument"). Splitting transport into N HTTP calls does not make N logical runs; it is one logical classification delivered in N packets. One run row keeps the audit semantics intact and keeps `requested_families`, `input_hash`, and `run_mode` meaningful.
- The `UNIQUE (run_id, raw_key)` constraint (`:117`) is satisfied because chunks are **disjoint** (each rawKey in exactly one batch). The merge step's duplicate-key guard (defensive) ensures no rawKey is written twice even if a misbehaving model echoes a key outside its batch (the sanitizer already drops unknown/out-of-batch keys; the merge keeps first-wins).

**Merge algorithm (`mergeBatchResponses`):**
1. Take `nodeId` + `modelInfo` from the first **successful** batch (all batches share the same argument → same nodeId; modelInfo is per-server, identical across batches).
2. Concatenate `checkedRawKeys` across successful batches.
3. Merge `observations`, `confidence`, `evidenceSpan` maps (object spread; disjoint keys, so no real collision; first-wins on any collision + record it).
4. Return the merged `McpBooleanObservationResponse`.

**Feeds the SAME persistence path with no change:** the merged response goes into the existing `sanitizeMcpBooleanObservationResponse(merged, {surface:'inspect'})` → the existing positive-collection loop (`classifyArgumentCore.ts:339-357`) → `persistResults` (`:362-367`) → the existing post-persist SELECT (`:377-387`). `persistRun` is called **once** (one run row), `persistResults` is called once with all positives from all batches. No double-count: positives are collected from the single merged response, not per-batch.

**Ordering:** batches are issued in `batchIndex` order; merge is order-independent (map union). The `input_hash` (`booleanObservationRequestBuilder.ts:191-208`) is computed over `{argumentId, schemaVersion, runMode, sortedFamilies}` — **unchanged** (it does not include rawKeys, so batching does not perturb it; the audit hash still identifies the family-level run).

---

## §4 — Failure semantics

**Recommendation: per-batch partial-persist with a run-level status of `'success'` only when ALL batches succeed; `'failed'` when ANY batch fails, but persist the positives from the batches that DID succeed.** Justification:

- The existing model already treats a partial persist as a failed run while keeping the run row as the audit trail (`classifyArgumentCore.ts:389-398` — `persistFailureReason` path returns `status:'failed'` with the actual persisted count). Batching extends this: if batch 1 of D succeeds (16 keys, 3 positives) and batch 2 fails (provider error on the 6-key tail), the 3 positives from batch 1 are persisted, the run row is marked `status:'failed'` with `failure_reason` reflecting the failed batch's reason and a `failure_detail` recording `{failedBatchIndex, batchTotal}` (via the existing `buildRunRowFailureDetail` leak-safe builder, `:259-265`).
- **Why partial-persist over all-or-nothing:** an evidence observation that the classifier *did* make (batch 1) is a real structural fact about the move; discarding it because an unrelated batch's HTTP call timed out would lose true signal and waste the provider spend already incurred. The read path is per-rawKey membership, so partial results render correctly (the missing batch's keys simply have no rows → render as "not observed", which is the correct absent-fallback per the manifest's test-8). The `status:'failed'` run row + `failure_detail` lets the operator/admin surface see that the run was incomplete and re-trigger.
- **Mirrors the existing failure_detail / dead-letter model.** A batch's adapter-`unavailable` result maps through the existing `unavailableReasonToFailureReason` (`:164-183`) and `BooleanObservationFailureSubreason` plumbing. The auto-trigger dead-letter / retry policy (`classifierDrainerRetryPolicy.ts`) re-runs the *whole family run* (all batches) on retry — idempotent because chunk assignment is deterministic and `UNIQUE (run_id, raw_key)` + a fresh run_id per retry prevents cross-run dup (each retry is a new run row; the read path takes the most recent successful run via the `amor_runs_argument_version_completed_idx` ordering). **The card MUST confirm the drainer re-runs at family granularity, not batch granularity** (Open Question Q1).

**Latency — N× round-trips:** D and G now cost **2 sequential MCP round-trips** instead of 1. At the deployed 15s submit-path / 30s drainer timeout per call (`booleanObservationMcpAdapterCore.ts:58,74`), worst-case wall time for a 2-batch family roughly doubles.
- **Recommendation: bounded-parallel (limit 2) for the batches of a single family**, reusing the existing `boundedConcurrencyRunner.ts` pattern (the same primitive the auto-trigger uses, per the memory note "auto-trigger now bounded-parallel limit 2"). Two batches in parallel ≈ the latency of one call, at the cost of 2 concurrent provider requests. Because only D and G ever split (2 batches each), and the auto-trigger already bounds *argument-level* concurrency at 2, the implementer must ensure the **product** of (argument concurrency × batch concurrency) does not exceed the provider's rate limit (§Risks — provider rate limits). Conservative fallback: **sequential batches** (simpler, no concurrency-product risk, ~2× latency on D/G only). The card decides based on the live rate-limit headroom observed in admin_validation smoke; recommend starting **sequential** for the infra card's smoke, then enabling bounded-parallel in a follow-up if latency is a problem.

---

## §5 — Edge + mcp-server changes (both mirrored)

| Layer | Change | Why |
|---|---|---|
| **Edge** `classifyArgumentCore.ts` | Loop: chunk full rawKeys → per-batch request → adapter call (sequential or bounded-2) → merge → existing sanitize/persist tail. | The single orchestration point that issues the MCP call (`:223-242`). |
| **Edge** `booleanObservationRequestBuilder.ts` | Add `buildBatchRequestFromFull(base, batch)`. `buildBooleanObservationRequestForArgument` unchanged (still builds the full family request). | Clean separation: full-request build stays; batch-slicing is a new pure helper. |
| **Edge** `booleanObservationBatching.ts` (NEW) | `chunkRawKeys`, `mergeBatchResponses`, `BATCH_SIZE`. Pure. | The batching core. |
| **mcp-server** | **NO functional change.** The server already serves any rawKey subset per call. | The prompt builders filter to `requestedRawKeys` (`familyDPrompt.ts:165-173`); the validator accepts subsets (`familyBooleanRequestSchema.ts:243`). |
| **mcp-server** `mcpBooleanObservationBatchingMirror.ts` (NEW, OPTIONAL) | Only if defensive server-side self-chunking is wanted. **Recommend NOT** — keep the server single-call-per-batch; the Edge owns chunking. | Avoids two chunkers drifting; one source of truth (the Edge). |

**Backward-compat for 1-batch families:** §2 proves the single-batch path is byte-identical. The Edge change is a strict superset: when `chunkRawKeys` returns 1 batch, the loop runs once and reproduces today's behavior exactly.

**Mirroring discipline:** the only new mirrored artifact (if the optional server chunker is created) is the `BATCH_SIZE` + `chunkRawKeys` pair, parity-tested like the existing `mcpBooleanObservationSchemaMirror.ts` parity test. The `MAX_FLAGS_PER_RESPONSE = 20` constant stays byte-equal on both sides (unchanged).

---

## §6 — Frozen-family forward-compat

This batching layer also unblocks **any future >20-key family** (e.g. the deferred HiTODS / claim_clarity expansions, or thread_topology/sensitive_composer if they ever exceed 20 ai_classifier keys). Once `chunkRawKeys` + the merge exist in `classifyOneArgumentCore`, a family crossing 20 keys "just works" — it splits automatically with no further code. **This card does NOT design HiTODS or H/I/J in** — those families stay `productionEnabled: false` / frozen per BUILD2 manifest §7.2 invariant 5. The forward-compat is a free consequence of the infra, noted only so the operator knows the cap is no longer a hard ceiling on family size.

---

## Edge cases

- **Empty rawKey set** (a family filtered to zero eligible keys for the mode) → `chunkRawKeys([])` returns `[]` → no adapter call → the existing "empty requestedRawKeys, caller decides whether to skip" behavior (`booleanObservationRequestBuilder.ts:119-122`) is preserved. The run is skipped exactly as today.
- **Exactly 20 keys** (Family C today) → 1 batch (split threshold is `> 20`). Byte-identical.
- **Exactly 21 keys** (Family G) → 2 batches (16 + 5). **Exactly 22** (Family D) → 2 batches (16 + 6).
- **A batch returns 0 positives** → contributes 0 result rows; the merge still records its `checkedRawKeys`. No row written for that batch; correct.
- **A batch returns a key NOT in its requested slice** (model misbehavior) → the sanitizer drops unknown/out-of-registry keys (`mcpBooleanObservationSchema.ts:369-371`); the merge's first-wins guard handles an in-registry-but-wrong-batch echo; the `UNIQUE (run_id, raw_key)` is the last-line defense.
- **All batches fail** → no positives persisted; run row `status:'failed'` with the first batch's failure_reason; identical to today's single-call all-fail.
- **Concurrent edits / re-trigger of the same argument+family** → each trigger creates a NEW run_id (fresh run row); the read path takes the most recent successful run (`amor_runs_argument_version_completed_idx` DESC). No cross-run dup because `UNIQUE` is `(run_id, raw_key)`, not `(argument_id, raw_key)`. Idempotent: deterministic chunk assignment means a re-run produces the same batches → same positives → a new clean run row.
- **Offline / network failure mid-family** → the failing batch is `unavailable`; partial-persist policy applies (§4).
- **Permission-denied** → unchanged; service-role writes bypass RLS (`persistenceWriter.ts:91-94`); the admin gate at the handler boundary is unchanged.
- **Doctrine edge:** "does heat/engagement affect how many batches?" — **No.** Batch count is a pure function of the family's *static* rawKey-set size + `BATCH_SIZE`. Nothing about the argument's content, popularity, or heat changes the chunking. The cap is a transport guard, never a semantic input (cdiscourse-doctrine §3).
- **Doctrine edge:** "can a split change which observation fires?" — **No.** Each batch's prompt carries the same system prompt + the per-key definitions/guards for its slice; the per-key boolean answer does not depend on which other keys are co-requested (the prompts ask independent structural yes/no per key). The card's merge-correctness test asserts the union of 2-batch positives equals the (hypothetical, cap-aside) single-call positives on a fixture.

---

## Test plan

All under the existing test conventions (`test-discipline`). Test count goes UP; no existing test relaxed (THR-4).

- `__tests__/booleanObservationBatching.test.ts`:
  - **Chunk determinism:** `chunkRawKeys(keys)` is a pure function — same input → byte-identical batches; lexicographic pre-sort makes a given key's batch stable.
  - **Split threshold:** L ≤ 20 → exactly 1 batch (covers A=19, B=17, C=20, E=19, F=17 — backward-compat). L = 21 → 2 batches. L = 22 → 2 batches (16 + 6). L = 33 (synthetic) → 3 batches.
  - **Disjointness:** every rawKey appears in exactly one batch; union of batches = input set.
  - **Per-batch ≤ 20:** every batch's `rawKeys.length ≤ MAX_FLAGS_PER_RESPONSE` (and ≤ `BATCH_SIZE` for split batches).
  - **Merge correctness:** `mergeBatchResponses` of 2 batch responses → union of observations/confidence/evidenceSpan; checkedRawKeys concatenated; nodeId/modelInfo from first success.
  - **Merge duplicate guard:** two batches reporting the same rawKey → first-wins + collision recorded.
  - **Partial-failure merge:** [success, unavailable] → merged carries the success's keys; the outcome list flags the failed batch.
- `__tests__/classifyArgumentCoreBatching.test.ts` (or extend the existing core test):
  - **>20 end-to-end (mocked adapter):** a synthetic 22-key family (or a D fixture) → adapter called twice → one run row → all positives from both batches persisted under that run_id → post-persist SELECT count matches.
  - **1-batch backward-compat:** a ≤20-key family → adapter called exactly once → persisted rows byte-match the no-batching baseline (regression-locks A/B/C/E/F unchanged).
  - **Partial-failure:** batch 2 adapter returns `unavailable` → batch 1 positives persisted → run row `status:'failed'` + `failure_detail` records the failed batch index → never throws.
  - **Run model:** exactly one `persistRun` call per family regardless of batch count.
- **Schema-version regression:** assert `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION === 'mcp-021.machine-observations.boolean.v1'` unchanged (client + mirror).
- **Cap-constant regression:** assert `MAX_FLAGS_PER_RESPONSE === 20` unchanged (client + mirror).
- **Doctrine ban-list:** no new user-facing string is introduced by the infra card (batching is transport-only), but a scan over any new `failure_detail` field values asserts no verdict tokens / no rawKey leak (the `failure_detail` carries only `{batchIndex, batchTotal, reason}` structural integers/enums).
- **mcp-server Deno:** if the optional mirror is created, `mcp-server/tests/mcpBooleanObservationBatchingMirror.test.ts` parity-tests it against the Edge copy; otherwise no mcp-server test change (the server is functionally unchanged).
- **Boundary test:** `__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts` stays green for the infra card (it touches no `family*.ts` definition). The Family-D card relaxes RO-10; the Family-G card relaxes RO-13.
- **OPS regression:** the per-family signal-density SQL (`scripts/ops/sql/14-per-family-per-mode-signal-density.sql`) hardcodes per-family key counts; the **Family-D / Family-G cards** bump those (+3 each) and their mirror count test — NOT the infra card (which adds no keys).

---

## Card breakdown (stacked on Family-F `2d4fa70`)

Three cards, branched in sequence off the Build-2 stack top (`feat/mcp-build2-family-f`, commit `2d4fa70`) so the shared registry / ops-SQL / boundary-test state stays monotonic and D/G inherit A–F's registry state:

1. **MCP-BOOLEAN-BATCHING-INFRA-001** (this design's plumbing) — branches off `2d4fa70`. Adds `booleanObservationBatching.ts` + `buildBatchRequestFromFull` + the `classifyArgumentCore` loop + tests. Adds **NO family keys** (so D/G still send ≤20 and the 1-batch path is exercised by every existing family — proving backward-compat before any family grows). Validated against a **synthetic >20-key family fixture** (a test-only family of 22 dummy keys) so the >20 path is proven without depending on D/G landing first. Deploy-bearing (Edge mirror) but **inert** until a family exceeds 20 — safe to ship alone.
2. **MCP-BUILD2-FAMILY-D** — branches off card 1. Adds D's 3 booleans (`names_method_difference`, `separates_observation_from_inference`, `flags_context_limit`) to `familyDKeys.ts` + client/Edge definitions per BUILD2 manifest §3, taking the subset 19 → **22** → 2 batches. This is the **first real exercise** of batching in production. Relaxes its own RO-10. Bumps the D ops-SQL count + mirror test. Deploy-bearing → GATE-C (manual Deno Deploy + admin_validation sign-off).
3. **MCP-BUILD2-FAMILY-G** — branches off card 2. Adds G's 3 booleans (`records_remaining_disagreement`, `defines_next_evidence_needed`, `separates_normative_from_empirical`) per BUILD2 manifest §6, taking the subset 18 → **21** → 2 batches. Relaxes RO-13. Bumps the G ops-SQL count. Deploy-bearing → GATE-C.

**Fold-or-separate recommendation: KEEP THE INFRA CARD SEPARATE; do NOT fold Family D into it.** Rationale:
- The infra card is **doctrine-clean and low-risk** (transport only, no new vocabulary, no verdict surface) and can ship + smoke independently against a synthetic >20-key fixture. Folding D in couples a pure-plumbing change to a new-boolean vocabulary change with its own verdict-free / ban-list / fixture obligations — a larger, harder-to-review blast radius.
- Shipping infra alone gives an **inert, reversible** change (no family exceeds 20 yet, so the 1-batch path is all that runs; if a problem surfaces, the infra is dormant). D then becomes the **first live proof** of batching on a real family, with the infra already merged and smoked.
- The BUILD2 manifest stack order is B→A→C→D→E→F→G; this batching infra is a *prerequisite* that must precede D (D cannot ship without it, or D's 22-key response is rejected). Slotting infra **between F and D's expansion** (i.e. infra branches off F `2d4fa70`, then D branches off infra) keeps the manifest's monotonic accretion intact: A–F shipped their +3 already (those stay ≤20, 1-batch); infra lands; then D/G expand and split.
- *Trade-off acknowledged:* a separate infra card means the >20 path is first proven on a **synthetic** fixture, not D itself. Mitigation: card 2 (Family D) is the end-to-end live proof immediately after; the infra card's synthetic-family test + card 2's real D smoke together cover the path. If the operator prefers a single live proof, the alternative is to fold D into infra — but the reviewer should weigh the larger blast radius against the convenience. **Recommendation stands: separate.**

---

## Dependencies (cards / docs / files)

- **Assumes Build-2 Families A–F are complete** (commits `e91a964`…`2d4fa70` on `feat/mcp-build2-family-f`) — D/G need A–F's shared registry / gameCopy / ops-SQL / manifest-count state so the accretion stays monotonic and merge-conflict-free (BUILD2 manifest §7.3).
- **Reads** `classifyArgumentCore.classifyOneArgumentCore` (the single MCP-call point), `booleanObservationRequestBuilder.buildBooleanObservationRequestForArgument` (the full-request source), `mcpBooleanObservationSchema` (the unchanged wire types + cap), `persistenceWriter.persistRun/persistResults` (unchanged persistence), `machineObservationPersistenceAdapter` (the count-agnostic read path), and the BUILD2 manifest (the authoritative D=22 / G=21 counts).
- **Blocks** MCP-BUILD2-FAMILY-D and MCP-BUILD2-FAMILY-G — both produce >20-key responses and CANNOT ship until batching exists (their responses would be rejected by `flag_count_too_high` / `validation_failed` otherwise). This is the card's whole reason to exist.
- **Branch reconciliation (operator note):** the Build-2 stack lives on `feat/mcp-build2-family-f` (forked from `f1b55a3`). The current `main` (`97236eb`, the BUILD2 manifest PR #539) shares base `f1b55a3` but is a sibling, not a descendant, of the stack. The infra card MUST branch off `2d4fa70` (the Family-F stack top), NOT off `main`, so it inherits A–F's mirror/registry/ops-SQL state. If the Build-2 stack is merged to `main` before this card starts, branch off the merge commit instead and re-confirm `2d4fa70`'s changes are present. **This is a pre-launch reality-audit item for the infra card.**

---

## Risks

- **Provider rate limits with N calls.** D and G now issue 2 provider calls each (vs 1). Combined with the auto-trigger's argument-level bounded concurrency (limit 2, per the memory note), bounded-parallel batches could put up to 4 concurrent Anthropic calls in flight from the mcp-server. The mcp-server has its own `providerConcurrency.ts` gate; the card MUST verify the product (arg-concurrency × batch-concurrency) stays within the provider's per-minute limit. **Mitigation:** start sequential (no concurrency-product increase); enable bounded-parallel only if smoke shows latency pain and the rate-limit headroom is confirmed.
- **Token budget per batch vs one prompt.** Each batch carries the full system prompt + thread context + the batch's per-key definitions. Two batches re-send the system prompt + context (the move/parent/thread text appears in BOTH requests). This is **more total input tokens** than one prompt (the shared preamble is duplicated). For D (16 + 6 keys) the duplication is the system prompt (~1k tokens) + context (≤2k) per extra batch — modest. The card notes this cost; it is the price of staying under the cap without a schema change. The per-family `FAMILY_D_MAX_TOKENS = 1800` output budget (`familyDPrompt.ts:56`) is **per response** and now comfortably covers a 16-key batch (was sized for 19); G's budget similarly. No output-token risk.
- **Latency ~2× on D/G** (sequential). See §4. Acceptable for the drainer path (off the user's path, 30s budget); for the submit path (15s), 2 sequential 7s calls could approach the budget — **the card must confirm the submit-path timeout accommodates 2 sequential D/G batches, or route D/G through the drainer.** (Open Question Q2.)
- **Drainer retry granularity.** The dead-letter / retry policy must re-run at **family** granularity (all batches), not batch granularity, or a retried half-family creates a confusing partial run. Confirm in `classifierDrainerRetryPolicy.ts` (Open Question Q1).
- **Existing tests that might need updating:** the core classifier test (`classifyOneArgumentCore`) currently asserts "adapter called once". After batching it asserts "called once per batch". This is an *intended* update (the 1-batch backward-compat test locks the ≤20 case), not a relaxation. The reviewer should confirm the assertion change is the only one and that no doctrine/coverage test is weakened.
- **Migration:** **none.** No operator `db push` for any of the three cards (key-value store; BUILD2 manifest §7.2 invariant 2).

---

## Out of scope

- Adding the 3 new D keys or 3 new G keys (those are the Family-D / Family-G cards, not the infra card).
- Any change to `MAX_FLAGS_PER_RESPONSE` (it stays 20).
- Any schema-version bump (stays v1).
- Any DDL / migration / `failure_detail` column addition.
- HiTODS / Family H/I/J / any frozen-family advancement.
- Seeding the ~60 pair/triple mapping rows per family (Build-3, GATE-A §12).
- Changing `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (D/G stay ai_classifier-only; the chunker splits the already-source-filtered set).
- Bounded-parallel-by-default (recommend sequential first; parallel is a follow-up if latency demands it).
- Any client/app code (`app/`, `src/` outside the pure-TS `machineObservationPersistenceAdapter` read path, which is unchanged).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels / score never blocks):** batching is transport-only; it introduces no label, no verdict, no score. Observations stay advisory, `authoritative: false`, post-storage/display-only. `engine.ts` untouched; no batch blocks/delays/routes a post. ✓
- **cdiscourse-doctrine §3 / evidence-doctrine (popularity ≠ evidence):** batch count is a pure function of the family's static key-set size, NEVER of heat/engagement/popularity. The cap is a transport guard, never a semantic input. Family D/G evidence-dynamic observations are unchanged by how they are transported; the anti-amplification module is untouched. ✓
- **cdiscourse-doctrine §4 (AI moderator limits):** classification still runs only in the Edge/mcp-server layer (never the client); each batch is advisory; `provider:'mcp'` pinned. ✓
- **cdiscourse-doctrine §6 / supabase-edge-contract (secrets / service-role):** no service-role in client; the merge/chunk helpers are pure TS; `failure_detail` carries only structural integers/enums (no body, no prompt, no key). RLS untouched; service-role write path unchanged. ✓
- **cdiscourse-doctrine §9 (plain language):** the infra card adds no user-facing string; any new `failure_detail` field is structural (batch index/total) and never surfaced raw to users. ✓
- **cdiscourse-doctrine §10a (Observations vs Allegations):** every persisted row stays a `machine_observation` about the MOVE; batching does not change `source`, `kind`, or which rawKeys exist. ✓
- **supabase-edge-contract:** no migration; key-value store; the `UNIQUE (run_id, raw_key)` constraint honored by disjoint chunks; merge=deploy for the Edge mirror, manual Deno Deploy for the mcp-server. ✓
- **test-discipline:** new pure-model tests (chunk/merge), end-to-end core tests (>20 + 1-batch backward-compat + partial-failure), schema-version + cap-constant regression, no existing test relaxed (THR-4), test count up. ✓
- **No-schema-bump invariant (BUILD2 manifest §7.2.1):** `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` byte-equal; the read adapter's version filter keeps every existing room's observations visible. ✓

---

## Open questions for the operator

- **Q1 — Drainer retry granularity:** does `classifierDrainerRetryPolicy.ts` re-run a failed run at family granularity (all batches) — or would a partial-batch retry be possible? The design assumes family-granularity retry (a fresh run_id per retry). The implementer must confirm; if batch-granularity is somehow possible, the partial-persist policy needs a guard against mixing batches across run_ids.
- **Q2 — Submit-path vs drainer for D/G:** 2 sequential batches on the 15s submit-path timeout may be tight for D/G. Should D/G classification be routed through the 30s drainer path (off the user's path) rather than the submit path, or is bounded-parallel-2 on the submit path acceptable? Recommend: confirm at admin_validation smoke; default to sequential + drainer routing for D/G if submit-path latency is marginal.
- **Q3 — BATCH_SIZE value:** the design recommends 16 (headroom 4, D/G → 2 batches). Operator may prefer 18 (headroom 2, still 2 batches) or a per-family constant. Recommend the single constant 16 unless a family later needs different tuning.
- **Q4 — Optional mcp-server self-chunk mirror:** the design recommends the Edge owns all chunking and the mcp-server stays single-call-per-batch (no mirror). Confirm the operator does not want a defensive server-side chunker (which would add a parity-tested mirror but risk two chunkers drifting).

---

## Operator steps (if any)

Per **family card** (D and G), after the implementer merges:

1. **Merge** → the Edge classifier mirror auto-deploys (registered in `supabase/config.toml`).
2. **Manual Deno Deploy of the mcp-server** (the single manual step) so the new `booleanQuestion`s are asked. The infra card alone needs the Deno Deploy too (to ship the loop), but it is inert until a family exceeds 20.
3. **Hosted smoke** — for the infra card, exercise the synthetic >20-key fixture path (or wait and prove on D); for D/G, a synthetic run exercising the 2-batch split with **zero terminal dead-letters** (mirror the family-G N=56 / 0-dead-letter bar).
4. **admin_validation audit + operator sign-off** at Admin → Classifier Health before D/G's new booleans are trusted on the production card surface (both families are `adminValidationEnabled: true`).

**No `npx supabase db push`** for any of the three cards — no DDL (BUILD2 manifest §7.2 invariant 2 / §10).
