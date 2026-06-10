# MCP-021C-EDGE-FAMILY-I-ENABLE — D3 production-enable smoke (2026-06-10)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-10
**Operator:** Kyler (D3 GATE-SPEND explicitly approved after the D2 GATE-MERGE)
**Merge under test:** PR #562 → main `c86ce53` (MCP-I-D2: `thread_topology` `productionEnabled false → true`, single registry boolean; reviewer APPROVE; FULL jest 707 suites / 29455 tests exit 0 on the branch). Edge redeploy confirmed by version readback (`submit-argument` v461 → v464) before any smoke traffic.
**Design under execution:** `docs/designs/MCP-021C-EDGE-FAMILY-I-PRODUCTION-ENABLE-D1.md` §6 (the D3 canary-then-burst plan, merged at GATE-A as PR #561).
**Preconditions consumed:** D0 H-stable precondition cleared on #394 (accelerated standard; no-organic-volume caveat); D1 GATE-A merged (#561, closing #478); D2 GATE-MERGE executed (#562).

**Final verdict: PASS.** Canary 9/9, targeted I-signal canary elicited all three intended `ai_classifier` keys, and the N=8 burst reached **72/72 terminal success with 0 dead-letters** at the canonical bar. The mixed-source subset filter held perfectly: zero `mcp_validation_failed` anywhere in the smoke, zero `thread_topology` result keys outside the six `ai_classifier` keys, zero deterministic-key leakage. Family J rows remain zero globally.

---

## Phase A — canary (1 smoke-tagged submit at the live A–I roster)

**Status:** PASS

One synthetic `[arch-001-queue-smoke]` thesis via production `submit-argument` (admin bot lane; no service-role; no direct insert). `submit_response_latency_ms = 3409` (cold-start after the merge redeploy).

| Check | Observed |
|---|---|
| Queue cells | **9/9** — A–H plus exactly one `thread_topology` cell, all `run_mode='production'` |
| Terminal state | 9/9 `succeeded`, `attempt_count = 1`, settled on the first 5 s poll |
| `mcp_validation_failed` | 0 |
| `family=NULL` / J cells | 0 / 0 |

## Phase B — targeted Family I signal canary

**Status:** PASS (signal target exceeded)

One smoke-tagged room with a thesis + one rebuttal written to elicit `compares_options` / `introduces_sub_axis` / `references_external_context` (option comparison on cost per ton-mile, an explicit maintenance-funding sub-axis, and named external studies). Both submits HTTP 201 (1799 / 1704 ms).

| Check | Observed |
|---|---|
| `thread_topology` cells | 2/2 `succeeded` (one recovered via retry — see typed finding) |
| Persisted I keys from this pair | `compares_options`, `introduces_sub_axis`, `references_external_context` — **all three intended keys, one row each**, no fixture strengthening needed |
| Keys outside the six `ai_classifier` keys | 0 |
| `mcp_validation_failed` | 0 |

**Typed finding (recorded; not part of the burst bar):** during this phase the provider entered a visibly transient window — two NON-I cells (`argument_scheme` on one arg, `claim_clarity` on the other) failed `mcp_api_error` on all 4 attempts and dead-lettered (`validator_path = null` → provider/transport per the cutover-gate discriminator; dispersed across two families and two args; both `thread_topology` cells succeeded). Per the gate-doc taxonomy these are isolated, clearly-typed provider transients: noted, not a rollback trigger, and not an I defect — the same class observed throughout the H window. They are excluded from the Phase C bar by design (the bar governs the burst's own 72 cells), and recorded here without softening.

## Phase C — N=8 burst (72 cells at the 9-family roster)

**Status:** PASS at the canonical bar

8 synthetic smoke-tagged theses posted in a 13.3 s window (21:11:25–21:11:38 UTC); 8/8 HTTP 201; submit latency min/max = 1399/2784 ms — all under the 5000 ms nonblocking line; the acceptance decision remained `engine.ts` validation pre-fork.

| Gate | Observed |
|---|---|
| Cells | **72/72** present; each of 8 args exactly the 9 A–I families |
| Terminal success | **72/72 `succeeded` — 0 `dead_letter`, 0 `failed_terminal`** |
| `thread_topology` | **8/8 succeeded**, including one cell that failed `mcp_api_error` three times and **recovered on attempt 4** — the full Card-3 retry schedule exercised end-to-end on an I cell |
| Retries | 2 retried cells total, both recovered (`max attempt_count = 4`) |
| Duplicate success | 0 |
| `family=NULL` / J cells / `mcp_validation_failed` | 0 / 0 / 0 |
| Settle wall | 21:11:27 → 21:25:04 UTC ≈ 13.6 min (long retry tail per the backoff schedule — by design) |

## Phase D — doctrine / leak / J-zero

**Status:** PASS

All 164 persisted result rows from the burst args were scanned by SQL: **0** banned verdict tokens in `evidence_span`, **0** secret-shape strings (`Bearer `/`sk-ant`/`sb_secret`/JWT). The `thread_topology` result-key namespace across the entire database remains a strict subset of the six `ai_classifier` keys (the deterministic 15 have never appeared — the `unsupported_rawKey` class is structurally excluded by the untouched subset entry). Family J (`sensitive_composer`) production rows: **0 globally**. Evidence spans counted, never printed.

## Disposition

- **D3 = PASS.** The 9-family production roster is load-proven at the canonical bar (0 terminal dead-letters at N=72), the targeted I-signal evidence is positive on all three intended keys, and the subset filter held with zero validation failures.
- **D4 (observation window) is the next operator gate** per the D1 runbook §7 — default window with the accelerated operator-seeded option (NO ORGANIC VOLUME caveat) mirroring the H C4 pattern.
- Rollback lever unchanged: single-boolean revert (`thread_topology` true → false), preserving admin_validation, the I server, and the subset entry.
- Routing posture at audit close: `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `PERCENTAGE=1` (unchanged by this lane).
- Still-separate follow-ups: client/admin frozen-set re-scope `{H,I,J}`→`{J}` (the admin tripwire counts legitimate H+I rows until then — advisory-only); #397 Family-I observability backfill (queued post-I-enable); any queue-percentage ramp.
