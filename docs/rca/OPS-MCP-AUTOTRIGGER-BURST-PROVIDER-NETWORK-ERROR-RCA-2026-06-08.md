# RCA — Auto-trigger burst saturates the MCP provider (`mcp_network_error` ~96% loss)

**Date:** 2026-06-08
**Surfaced by:** `#479` MCP-LIT-CORPUS-RUN (verdict + evidence on the issue).
**Severity:** Medium — production classification is **lossy under a posting burst**; real-user
impact is bounded (posts arrive spread out, not in a tight burst), but any bulk/backfill or traffic
spike loses classifications. No data corruption, no doctrine violation, no acceptance-gate impact
(the deterministic rules engine remains the sole submission gate).
**Status:** Diagnosed. Fix is already designed and ~75% built (**ARCH-001**); remaining work is
**ARCH-001 Card 3** (operator-gated staged rollout). No code or flag changed by this RCA.

---

## 1. Summary

The production boolean-classifier **auto-trigger** loses ~96% of classifications when many
arguments are posted in a short window. The loss is a **queue-saturation Edge timeout**, surfaced
as `mcp_network_error` — **not** Anthropic rate-limiting, **not** a classifier or batching defect.
The classifiers and batching are sound; the bottleneck is the **dispatch layer's unbounded
cross-argument concurrency** against a per-isolate provider-concurrency cap.

## 2. Reproduction & evidence

`npm run bot:fixture:ai:3 --pilot` (`runAiDrivenCorpus --rooms 3`) posted **38 args in seconds**.
Each post fires the production auto-trigger (`supabase/functions/submit-argument/index.ts:838` →
`dispatchAutoTriggerForArgument` → `productionEnabledFamilies()` = A–G, bounded concurrency **2 per
argument** via `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`). With ~38 args in flight, cross-argument
fan-out reaches **~76 concurrent** MCP→Anthropic calls.

Of ~511 production runs in the window, **~96% failed with `mcp_network_error /
provider_network_error`**. Per-family success **declines monotonically by registry order**:

| Family | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| runs | 68 | 70 | 72 | 74 | 75 | 76 | 76 |
| **success** | **8** | **7** | **4** | **1** | **1** | **0** | **0** |
| dominant failure | `provider_network_error` across all families | | | | | | |

The monotonic decline is the signature of **per-argument saturation**: each argument dispatches
A→G; by the time the later-ordered families (F/G) fire, the provider is exhausted for that
argument's window, so they are starved to zero.

**Capability is sound** — the same families light up cleanly off the burst path:
- hosted MCP smoke **39/39** (`scripts/mcp-server-001-smoke.sh`);
- Edge **batched** admin_validation proof (G: 21 keys → 16+5 → merged under one run);
- a **paced one-arg-at-a-time** admin_validation sweep: F 5/6, G 5/9 (incl. all 3 new Build-2 keys).

## 3. Root cause

1. **`network_error` is produced ONLY by a thrown Edge→Deno `fetch`**
   (`supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts:200` — "DNS,
   TLS, connection reset, or a timeout abort"). The submit/auto-trigger path uses an
   `AbortSignal.timeout`.
2. **An Anthropic 429 is a different bucket.** The Deno MCP server maps 429 → `rate_limited` and
   returns a **200 `{isError:true}`** envelope, which the Edge adapter types `provider_server_error`
   (`mcp_api_error`) — **not** `network_error`. That bucket was **near-zero** (B=2) in the run. So
   the ~96% `mcp_network_error` is **not** Anthropic rate-limiting surfacing through.
3. **Per-isolate provider-concurrency cap = 5.** The Deno server gates Anthropic calls with a
   module-singleton FIFO semaphore (`mcp-server/lib/providerConcurrency.ts`,
   `DEFAULT_MAX_PROVIDER_CONCURRENCY = 5`; `await providerConcurrencyGate.acquire()` before each
   call — `mcp-server/lib/anthropicCall.ts:192`). Under ~76 concurrent requests hitting (likely one
   warm) isolate, ~71 requests **queue** behind 5 slots. The queue-wait + Anthropic round-trip
   exceeds the Edge fetch's `AbortSignal` deadline → the Edge fetch **aborts** → `mcp_network_error`
   (the reserved `provider_timeout` sub-reason is folded into `network_error` today —
   `booleanObservationFailureSubreason.ts:68`).
4. **Structural.** A per-isolate in-memory semaphore is incapable of bounding **global** provider
   concurrency under dynamic multi-isolate Deno Deploy. This was established in the prior cap-curve
   work (see §5).

The corpus run is simply a **larger (76-wide) reproduction** of the previously-documented failure
mode, pushing cap=5 from "PARTIAL" into the cap=2 "FAIL" regime.

## 4. What we could not directly observe

The Deno R3 logs would confirm the exact queue-wait timing (timeout vs reset), but the available
`DENO_DEPLOY_TOKEN` is **invalid for the logs API** (`deployctl logs` and `api.deno.com` both return
invalid-token). The code + cap-curve evidence is **decisive and matches prior smoke data**, so log
access is confirmatory, not load-bearing. To confirm timing from an authenticated machine:
`deployctl logs --prod --since=<RFC3339> --until=<RFC3339>` (logs <24h only).

## 5. Prior art (this is not new)

| Doc / issue | Relationship |
|---|---|
| `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION*` (#371) | Root-caused the cap curve: **cap=5 PARTIAL** (`mcp_api_error` not reduced, p95 37.61s), **cap=2 FAIL** (`mcp_network_error` clustered at the Edge timeout, `retryHeals=0`). Exactly this mechanism. |
| `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md` (#373) | Option A (Deno-KV global limiter). **Superseded/rejected** in favor of ARCH-001. |
| `#365` / `#368` | Edge static-backoff retry tuning. **Superseded** by ARCH-001. (`#365` is the distinct `mcp_validation_failed` class, not this one.) |
| `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` | **The chosen fix** — Postgres async classifier queue. |

The chip's three options map directly: **option 1 (async queue) = ARCH-001 = chosen**; option 3
(Deno-KV global cap) and option 2 (Edge backoff) were evaluated and superseded.

## 6. Fix — ARCH-001 (already designed, ~75% built)

The durable fix moves classification **off the submit-path timeout** onto a **drainer** that pulls
from a linearizable Postgres queue at a controlled rate, bounding **global** provider concurrency.

**Already in production:**
- Queue substrate + claim/lease + enqueue-kick (migrations `20260528000021/022/023`; `pg_cron` +
  `pg_net` installed). Cards `#374` / `#376` / `#378` closed.
- `classifier-drainer` Edge function registered (`supabase/config.toml`) and deployed.

**Not yet done — ARCH-001 Card 3 (the missing piece):**
- Schedule the `pg_cron` drain tick (`cron.schedule`); seed the Vault cron→Edge secret.
- Arm `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` and ramp `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`
  1% → 100% with production smoke at each step.
- Add a **burst regression test / observability assertion**.

**Confirmed current state:** routing is **unarmed** — all `#479` runs were direct-dispatch
`state='succeeded'`, 0 queued.

## 7. Guardrails for the fix lane (binding)

- Arming routing is **operator-gated** via the staged flag protocol (do **not** auto-arm). See
  `docs/core/pipeline-governance-contract.md` + the smoke-routing master-flag procedure.
- ARCH-001 records **3 pending operator confirmations**: Anthropic tier, Edge plan, `pg_cron`
  granularity.
- Do **not** flip H/I/J `productionEnabled`. Do **not** touch `#394`. The MCP-server provider path
  (`callAnthropic`, the per-isolate gate) is touched **zero** times by ARCH-001.

## 8. Recommendation

File **ARCH-001 Card 3** (staged queue-routing rollout + burst regression test) as the next lane.
Until it lands, classification is best-effort under burst; the bounded retry loop re-enters the same
saturated queue (`retryHeals=0`), so it does not self-heal. No interim flag change is advised
without the staged protocol.

## 9. Related memory

- `autotrigger-burst-provider-network-error` — diagnostic + the A→G monotonic-decline signature.
- `mcp-validation-failed-burst-concurrency` — the **distinct** `mcp_validation_failed` burst class.
- `mcp-provider-server-error-bucketing` — why failure_detail masks the precise sub-reason.
