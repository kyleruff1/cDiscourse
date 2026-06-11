# OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY

**Type:** ops / Edge tuning (timeout hierarchy correction)
**Date:** 2026-06-11
**Status:** implemented (design + fix bundled — small diff)
**EDGE-BEARING ON MERGE:** the `classify-argument-boolean-observations` Edge
Function redeploys automatically via the Supabase GitHub integration (it is
registered in `supabase/config.toml`). No migration, no Vault, no routing arm,
no `mcp-server/` redeploy. NOT deployed by Claude.

---

## The finding

From the merged `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md`
Phase 4b typed finding: the Edge `admin_validation` path failed `mcp_api_error`
**3/3** on the Family-J existential person-shift input (the slur-bearing
adversarial fixture) while a **direct hosted-server call on the same semantic
content succeeded**, and the input's four siblings classified cleanly in the
same window.

Verified root cause: `runBooleanObservationMcpAdapter` defaults its
caller-side `AbortSignal.timeout` to
`MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15_000`
(`booleanObservationMcpAdapterCore.ts:58`). The MCP server's own per-model-call
budget is `MCP_SERVER_MODEL_TIMEOUT_MS` (default **25000**, defined at
`mcp-server/lib/anthropicCall.ts:32` as `DEFAULT_MODEL_TIMEOUT_MS = 25_000`,
read via `readEnvTimeoutMs()` at `:97-103`). The slur-adjacent input drives
**longer model deliberation (16-25s)** — valid work, within the server's
tolerance — that clips the fixed **15s** Edge caller abort. The admin Edge
handler (`supabase/functions/classify-argument-boolean-observations/index.ts`)
injected the bare adapter reference and never passed an options object, so the
15s default bound the call. Nothing dirty persisted (fail-closed); the doctrine
proof was obtained at the server boundary instead.

---

## The hierarchy rule

A multi-layer timeout stack is only correct when **each outer (caller) layer is
at least as patient as the inner (callee) work budget it wraps**. Caller
patience must EXCEED the callee's work budget, never undercut it — otherwise the
caller aborts valid in-flight work.

| Layer | Budget | Role |
| --- | --- | --- |
| Edge wall clock | platform ceiling | outermost |
| **Admin caller -> MCP fetch (this card)** | **30000ms** | **>= 25s server budget + 5s headroom** |
| Drainer caller -> MCP fetch (ARCH-001 Card 2) | 30000ms | >= 25s + 5s (already correct) |
| Submit/auto-trigger caller -> MCP fetch (default) | 15000ms | fast-fail on the user hot path — UNCHANGED |
| MCP server request budget (`MCP_SERVER_REQUEST_TIMEOUT_MS`) | 30000ms | looser, not binding |
| Anthropic/model call (`MCP_SERVER_MODEL_TIMEOUT_MS`) | 25000ms | innermost callee budget — UNCHANGED |

The 15s default is **intentionally** tighter than 25s for the **submit hot
path**: a user-blocking auto-trigger should fast-fail and let the background
drainer (or a later admin pass) do the patient retry. The admin_validation path
is operator-driven and OFF the user hot path, so it must be patient.

### Drainer precedent (cited verbatim)

This card mirrors the ARCH-001 Card 2 correction exactly. From
`booleanObservationMcpAdapterCore.ts:60-74` (the `DRAINER_MCP_REQUEST_TIMEOUT_MS`
design comment):

> ARCH-001 Card 2 (design §A.6 — timeout hierarchy correction): the
> BACKGROUND DRAINER's caller-side abort deadline for the MCP-server fetch.
>
> The prior submit-path 15s abort was TIGHTER than the MCP server's own
> model budget (`MCP_SERVER_MODEL_TIMEOUT_MS=25000`), so a valid slow
> provider call (16-25s, within the server's tolerance) was killed by the
> caller — an inverted hierarchy. The drainer runs OFF the user's path, so
> it can (and must) be patient: 30s ≥ 25s server model budget + 5s headroom
> ⇒ caller patience exceeds callee work budget. Passed by the drainer via
> `runBooleanObservationMcpAdapter(request, { timeoutMs:
> DRAINER_MCP_REQUEST_TIMEOUT_MS })`. The 15s default above is left
> untouched (the submit path is byte-unchanged).

The adapter already exposes the parameterized seam
(`RunBooleanObservationMcpAdapterOptions.timeoutMs`,
`booleanObservationMcpAdapter.ts:139-146`); this card only adds a second named
constant and one admin-side injection wrap.

---

## The fix (shape)

1. **New constant**, next to the drainer's in
   `booleanObservationMcpAdapterCore.ts`:
   `export const ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS = 30_000;` with a
   comment carrying the hierarchy rule, the J E3 motivating incident, and the
   batch-interaction bound.

2. **One injection-site wrap** in the admin Edge handler
   (`classify-argument-boolean-observations/index.ts`). The handler builds a
   mode-aware adapter ONCE per request and injects it into
   `classifyOneArgumentCore`:

   ```ts
   const observationAdapter =
     body.mode === 'admin_validation'
       ? (request: McpBooleanObservationRequest) =>
           runBooleanObservationMcpAdapter(request, {
             timeoutMs: ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS,
           })
       : runBooleanObservationMcpAdapter;
   ```

   `classifyOneArgumentCore` invokes the adapter as a 1-arg function
   (`adapter(batchRequest)`), so the pre-bound closure carries the 30s timeout
   transparently. `production` mode (HTTP) keeps the bare reference (15s).

3. **Batch-interaction bound (documented, no enforcement change):**
   `MAX_ARGUMENTS_PER_CALL = 10` classifies sequentially, so a worst case of
   10 args x 30s = 300s would approach the Edge wall clock. Observed per-arg
   latency is ~4-6s; the 30s ceiling is only reached by deliberation-heavy
   sensitive inputs (Family J). The constant's comment recommends operators
   keep admin_validation batches to **<= 5 arguments** for sensitive families.

---

## Blast radius

- **Changed:** one constant + one injection-site wrap in the admin Edge
  handler + a Jest bridge re-export + a new test suite + two docs.
- **Byte-unchanged (verified by tests):**
  - `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15_000` (the default).
  - `DRAINER_MCP_REQUEST_TIMEOUT_MS = 30_000` + `classifierDrainerClassify.ts`
    (the drainer path).
  - `autoTriggerDispatcher.ts` — the submit-path direct-dispatch caller passes
    the bare 1-arg adapter reference (no `timeoutMs`); 15s default preserved.
  - Production-mode HTTP calls through the same handler keep the bare adapter
    (15s) — only `admin_validation` is widened.
- **Untouched:** `engine.ts`, migrations, the family registry, routing,
  `mcp-server/**`, the 25s server model budget, all schema/classifier-set
  versions.

Doctrine: this is a transport-timing tuning only. No verdict, no truth label,
no AI-on-client, no service-role in client, no RLS change. Machine Observations
remain advisory; the admin gate (`requireAdmin`) is unchanged.

---

## Verification

- New `__tests__/adminValidationTimeoutHierarchy.test.ts` (12 tests):
  - (a) the admin_validation path passes `30000` to the adapter options
    (source-scan of the injection wrap, gated on `body.mode === 'admin_validation'`);
  - (b) the constant `>=` the 25s server budget + 5s headroom (the hierarchy
    assertion, behavioural via the Jest bridge);
  - (c) the auto-trigger/direct path still omits options and the 15s + drainer
    30s constants are unchanged (byte-unchanged invariants).
- Adjacent source-scan suites re-run green
  (`mcpOneTwoOneCAutoTriggerFamilyA`, `mcpOneTwoOneCEdgeFunctionHandler`,
  `archOneCardTwoDrainerCore`, `mcpOneTwoOneCEdgeAdapterCore`,
  `booleanObservationBatchingOrchestration`).
- `npm run typecheck` exit 0; per-file eslint exit 0; secret scan clean.
- Full `npx jest --maxWorkers=4` green (see `docs/core/current-status.md` for
  the captured count + exit).

**Operator follow-up:** merge auto-redeploys the Edge Function; then re-run the
Family-J E3 admin_validation smoke step on the existential input and confirm it
now classifies at the Edge boundary (no `mcp_api_error`) within the 30s ceiling.
No production-enable is implied — Family J stays admin-validation-only.
