# OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION — synthetic launch-qualification audit (2026-06-02) — PARTIAL

Audit-Lint: v1
Audit-type: ops
Doctrine-risk: false

> **L5 override note.** This is an OPS load / provider-reliability qualification audit. It names production family keys (`argument_scheme`, `critical_question`, `resolution_progress`, etc.) only as queue *routing targets* and gate references — it does NOT inspect classifier `evidence_span` output for doctrine compliance (that is the job of the per-family ship / production-enable audits). The dead-lettered cell produced **no** result row at all (the provider call itself failed, so there is no persisted `evidence_span` to inspect). The `Doctrine-risk: false` override above tells `audit-lint` to skip the L5 persisted-output-inspection requirement, which does not apply to a synthetic-load qualification audit.

**Date:** 2026-06-02 UTC
**Operator:** Kyler
**Card:** OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION
**Issue / trail:** #373 (cutover umbrella); Stage-1 audit (`docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md`); design (`docs/designs/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION.md`); two predecessor PASS-LOAD drills (PR #425 + #426)
**Base HEAD at execution:** `44bbbd3`
**Deno Deploy production:** build `qrvrmvp6qqhn` from `d2d436a` (carries the PR #421/#423 Family E + F packet-shape mitigation; `mcp-server/` byte-identical d2d436a→HEAD)
**Stage-1 arm state at execution:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`, armed `2026-06-02T07:50:54Z` (unchanged throughout this card; **no advance above 1%**).

**Scope:** Produce a **named synthetic** launch-qualification verdict against the live Stage-1 1% configuration via one operator-authorized N=1 canary + one N=8 smoke-tagged burst. This card does NOT advance the percentage, does NOT enable Family H/I/J, does NOT change any source / migration / validator / prompt / retry / drainer / ban-list, does NOT close the Stage-1 24h observation window, and does NOT issue `PASS-STAGE-1`. It explicitly does NOT manufacture a real-load PASS from the zero-organic Stage-1 window.

## Verdict

**PARTIAL** — `PARTIAL-SYNTHETIC-LAUNCH-QUALIFICATION`.

The mechanism is **synthetically qualified for launch at 1%** with one clearly-typed, within-budget anomaly noted. The canary was clean (7/7 first-attempt). The N=8 burst drove 56 A-G classifier cells through the live queue and drained **55/56 succeeded + 1 dead_letter**, with every structural gate green: idempotency (`duplicate_success=0`), single-flight (`overlapping_drain_pairs=0`), no routing leakage (`family=NULL`=0), no Family H/I/J leakage (=0), drainer fresh (M1=19.5s < 120s), queue fully drained (M2=0), monitor healthy. Critically, the historically-failing family **`argument_scheme` (E) is 8/8 clean** — the PR #421/#423 packet-shape mitigation held under the live 1% config. The single `dead_letter` is an **isolated, clearly-typed provider-side 5xx** (`mcp_api_error / provider_server_error / retry_attempts_exhausted`, attempt 4) in a *different* family (`critical_question` / F), absorbed gracefully by the dead-letter safety net without stalling the queue or the other 55 cells.

This maps to the design §7 **PARTIAL** clause exactly — both sub-conditions hold: *"a transient validation failure that recovered on retry"* (the one E cell, recovered at attempt 2) **and** *"one clearly-typed within-dead-letter-budget anomaly, with all other gates green"* (the one F cell). It is **not** `PASS-SYNTHETIC-LAUNCH-QUALIFICATION` (which requires burst 56/56 terminal succeeded) and it is **not** `FAIL` (which requires packet/schema **cluster** recurrence, routing leakage, queue stall, `duplicate_success>0`, `overlapping>0`, or a monitor/alert failure — none occurred).

**No rollback trigger fired. Stage 1 remains armed at 1%. The Stage-1 24h observation window stays OPEN (closes ≥ `2026-06-03T07:50:54Z`); this audit does not close it and does not advance to 5%.**

---

## 0. What this audit is — and is not

This audit operationalizes `docs/designs/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION.md`. Read that design for the full framing. In brief:

- **Why synthetic at all:** CDiscourse is pre-launch / low-organic-volume. At `PERCENTAGE=1`, an organic submit routes only when `hash(argument_id) % 100 < 1`, and organic submit volume is ≈ 0. As of this run the Stage-1 window has observed `non_smoke_routed_args = 0` — zero organic routed cells. A zero-organic window cannot demonstrate real organic load handling; it demonstrates plumbing / observability / rollback / inertness. The honest launch-readiness question — *can the queue handle a concurrent classifier fan-out without the provider/packet-shape cluster that motivated this whole chain?* — is therefore answered by **synthetic** load.
- **What this audit produces:** a NAMED synthetic launch-qualification verdict, so launch confidence rests on explicit synthetic evidence rather than on a zero-organic window misread as a real-load PASS.
- **What it does NOT do:** it does not convert the zero-organic window into real-load proof; it does not close the Stage-1 window; it does not issue `PASS-STAGE-1`; it does not authorize 5%. Smoke-tagged args route via the `[arch-001-queue-smoke]` title override independent of `PERCENTAGE`, so this burst is a **live-production end-to-end health check**, not an exercise of the 1%-organic-hash path (which, at zero organic volume, cannot be exercised).

---

## Phase 1 — Preflight (PASS)

**Status:** PASS

Confirmed before any spend (read-only `supabase db query --linked` + repo gates):

- **Baseline green:** full suite green at the Card-1 baseline (18,825 tests, typecheck + lint clean) — captured in Phase 0 of this card.
- **Stage-1 armed at 1%:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`, armed `2026-06-02T07:50:54Z`. Routing liveness is independently re-proven below by 63 routed cells all carrying `family IS NOT NULL`.
- **Monitor active:** `cutover-health-monitor-tick` cron active on `*/5 * * * *`; `monitor_failed_15min=0`, `monitor_succeeded_15min=3` at burst time.
- **Drainer active + queue inert pre-burst:** `arch-001-classifier-drain-tick` active; M2 non-terminal = 0 before the canary.
- **Zero organic routed traffic:** `non_smoke_routed_args = 0` since arm (the Stage-1 audit §0 low-traffic interpretation rule applies).

---

## 2. Canary (N=1) — PASS

`node .claude-tmp/queue-load-smoke-burst.cjs 1` — argId **`459e9530-45ee-49c5-98ca-d085999f2413`**.

ArgId-scoped read-only inspection:

| Check | Expected | Observed | |
|---|---|---|---|
| A-G queue rows (`family IS NOT NULL`) | 7 | **7** | ✓ |
| distinct named families | 7 | **7** | ✓ |
| `family=NULL` legacy direct-dispatch rows | 0 | **0** | ✓ |
| Family H/I/J rows | 0 | **0** | ✓ |
| terminal state | all succeeded | **7/7 succeeded** | ✓ |
| total attempts | 7 (first-attempt each) | **7** | ✓ |

The canary confirms the queue path is live and routes correctly at `PERCENTAGE=1` (plumbing liveness). It is **not** load proof. Per the canary-then-burst discipline, a clean canary is the precondition for the burst.

---

## 3. Burst (N=8) — completeness + per-family

`node .claude-tmp/queue-load-smoke-burst.cjs 8`.

- **`BURST_START_UTC`** `2026-06-02T08:32:50Z` → **`BURST_END_UTC`** `2026-06-02T08:32:55Z`
- Submit result: **8 posted / 0 failed**
- 8 burst argIds: `93e332c9-e6ee-4f83-b9e9-8d7419e1b9e1`, `9ca30cdf-01e5-4139-94eb-7622c59d06bb`, `421741c9-0e85-489e-82ed-ad0219f02e2a`, `9744b9a9-868d-455b-8c6a-ffa4231d761a`, `19b108bd-ae17-4d0d-8f00-f3296c3c2168`, `549272fc-8243-47ef-aaf4-28b2b97f7aa7`, `9ef5aab5-d2b2-4c80-a617-f7439469dc8e`, `abb26bff-6794-43f0-8011-8f5019cd7fa5`

**Completeness (argId-scoped, terminal):**

| Metric | Value |
|---|---|
| total cells | 56 |
| succeeded | **55** |
| dead_letter | **1** |
| failed_terminal | 0 |
| non_terminal (at close) | 0 |
| distinct named families | 7 |
| `family=NULL` legacy | 0 |
| Family H/I/J | 0 |

**Per-family breakdown:**

| Family | Cells | Succeeded | Max attempts | Note |
|---|---|---|---|---|
| `parent_relation` (A) | 8 | 8 | 1 | clean |
| `disagreement_axis` (B) | 8 | 8 | 1 | clean |
| `misunderstanding_repair` (C) | 8 | 8 | 1 | clean |
| `evidence_source_chain` (D) | 8 | 8 | 1 | clean |
| `argument_scheme` (E) | 8 | **8** | 2 | **historically-failing family — now clean**; one cell recovered on a single retry |
| `critical_question` (F) | 8 | 7 | 4 | **1 dead_letter** (see §5) |
| `resolution_progress` (G) | 8 | 8 | 1 | clean |

**Drain timeline:** 49/56 succeeded by ~t+85s (`08:34:20Z`); 55/56 by ~t+175s (`08:35:50Z`); the lone laggard (F) cycled through 4 retry attempts spaced by the [30,120]s backoff and reached its terminal `dead_letter` state by `08:49:34Z`. The other 55 cells were unaffected by the laggard — the queue did not stall.

**Provider-call accounting:** 7 (canary) + 60 (burst; 56 cells + 4 retry attempts: one E retry + three F retries) = **≈ 67 Anthropic Haiku calls**. This is the design's "≈63 healthy-run" figure plus the 4 retry calls — far under the ≈252 pathological max-retry ceiling.

---

## 4. Gate table (terminal, argId-scoped)

| Gate | Threshold (PASS) | Observed | Status |
|---|---|---|---|
| Burst completeness | 56/56 succeeded | 55/56 succeeded + 1 dead_letter | **below PASS bar** |
| `argument_scheme` (E) — historically-failing | clean | **8/8** | ✓ mitigation held |
| `duplicate_success_cell_count` | 0 | **0** | ✓ |
| `overlapping_drain_pairs` | 0 | **0** | ✓ |
| provider-failing families | 0 | 1 family / 1 cell (the lone DL) | isolated, not a cluster |
| `family=NULL` leakage | 0 | **0** | ✓ |
| Family H/I/J leakage | 0 | **0** | ✓ |
| M1 drainer freshness | < 120s | **19.5s** | ✓ |
| M2 queue depth | drains to 0 | **0** | ✓ |
| `cutover-health-monitor` | active + healthy | active `*/5`, 0 fail / 3 success | ✓ |
| `non_smoke_routed_args` (organic) | n/a (informational) | **0** | zero organic — synthetic only |

Every **structural** gate is green. The only non-green line is raw completeness (55/56 vs 56/56), driven entirely by the single typed anomaly in §5.

---

## 5. The one `dead_letter` — typed analysis (why PARTIAL, not FAIL)

**Cell:** argId `9ef5aab5-d2b2-4c80-a617-f7439469dc8e`, family `critical_question` (F), `attempt_count=4`, `dead_letter_reason=retry_attempts_exhausted`, `failure_reason=mcp_api_error`, `failure_sub_reason=provider_server_error`.

**Why this is PARTIAL, not FAIL.** The design §7 / Stage-1 §6 FAIL triggers are: packet/schema **cluster** recurrence · `family=NULL` leakage on a routed arg · `duplicate_success>0` · `overlapping_drain_pairs>0` · provider/server **cluster** recurrence · dead-letter **cluster** · monitor cron failure · alert-path failure. None fired:

1. **It is a single isolated cell (1/56 = 1.79%), not a cluster.** Contrast the original FAIL-LOAD drill: 3 dead_letter cells (5.36%), all in `argument_scheme`, deterministic same-input — that was the packet-shape bug (H3) manifesting as provider rejection. A *cluster* is multiple cells failing the same way; this is one.
2. **The mitigated family is clean.** `argument_scheme` (E), the family that motivated the entire mitigation chain, is **8/8** here. Had the packet-shape bug recurred, it would have re-clustered in E (or shown multiple identical F failures). It did neither.
3. **It is typed as a provider-side 5xx, not a schema/validation reject.** `provider_server_error` is an Anthropic server-side failure, exhausted across 4 attempts spaced by [30,120]s backoff (a ~5+ minute span). A single provider 5xx persisting across well-separated retries is consistent with a transient provider degradation window — exactly the failure mode the 4-attempt retry budget + `dead_letter` safety net exist to absorb.
4. **The mechanism degraded gracefully.** The cell parked in `dead_letter` (no infinite retry), the queue drained to M2=0, the other 55 cells were unaffected, no overlapping drain, no duplicate success, monitor stayed healthy. This is the queue working **as designed** under a provider hiccup — a launch-positive signal, not a defect.

**Honest residual ambiguity (not buried).** `provider_server_error` is the *same typed signature* as the original FAIL cluster. From queue metadata alone I cannot 100% exclude a residual Family-F packet-shape edge that the provider rejected. The four discriminators above make a genuine provider-side 5xx the far more likely explanation, but the conservative, honest position is to flag it rather than assert provider-side with certainty — which is precisely why the verdict is PARTIAL and not PASS.

**Recommended read-only disambiguation (follow-up, NOT a blocker):** the operator can inspect the Deno Deploy `cdiscourse-mcp-server` `boolean_observation_tool_error` (R3) log for argId `9ef5aab5…` / family `critical_question` to confirm provider-5xx vs packet-shape. This is read-only, costs no provider spend, and does not gate this verdict. If it shows a packet-shape rejection in F, that is a Family-F mitigation follow-up (parallel to the E work); if it shows a bare upstream 5xx, no action is needed beyond the safety net that already caught it.

---

## 6. What this proves / does not prove

**Proves (synthetic, live 1% config):**
- The ARCH-001 queue substrate accepts a concurrent 56-cell A-G fan-out and drains it under the C=3 bounded drainer, on the live production stack (Supabase Edge + Deno Deploy build `qrvrmvp6qqhn` + real Anthropic).
- The PR #421/#423 packet-shape mitigation holds under load: no `argument_scheme` cluster, no packet-shape cluster recurrence in any family.
- Idempotency, single-flight leasing, and routing isolation (no `family=NULL`, no H/I/J) hold under concurrent load.
- Graceful degradation: a provider hiccup parks one cell without stalling the queue or corrupting the rest.

**Does NOT prove:**
- **Real organic load behavior.** `non_smoke_routed_args = 0`. The smoke-tag override path is independent of the 1%-organic-hash path; this burst never exercised organic routing.
- **Real traffic mix / timing / arrival distribution.** This is a single concurrent fan-out of 8 synthetic theses.
- It does **not** convert the zero-organic Stage-1 window into real-load proof. Organic confirmation accrues separately as real traffic appears.

---

## 7. Rollback assessment

No rollback trigger fired (§5: the lone DL is neither a provider/server *cluster* nor a *dead-letter cluster*; all other triggers are 0/healthy). **Stage 1 remains armed at 1%.** The disarm path (`scripts/ops/stage1/disarm-stage1.sh` → `ENABLED=false`/`PERCENTAGE=0`) was NOT invoked and is held in reserve for a genuine trigger.

---

## 8. Boundaries honored (binding)

- ✅ `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` unchanged at 1 — **no advance above 1%**.
- ✅ No Family H/I/J enablement; no `familyRegistry` production-flag change.
- ✅ `cutover-health-monitor` left active throughout.
- ✅ No MCP-server / runtime source edit; no migration / validator / schema-mirror / prompt / key / ban-list change.
- ✅ Exactly one N=1 canary + one N=8 burst — no additional bursts.
- ✅ No secret value in any script / doc / audit / log / PR / chat (operator secrets referenced by NAME only; all DB access via read-only `supabase db query --linked`).
- ✅ No DB mutation beyond the authorized synthetic submits (no direct insert, no service-role; submits went through the normal `submit-argument` path).
- ✅ This audit does NOT close the Stage-1 24h window and does NOT issue `PASS-STAGE-1`.

---

## 9. Verdict rationale + follow-ups

**`PARTIAL-SYNTHETIC-LAUNCH-QUALIFICATION`.** The launch-readiness mechanism is synthetically qualified at 1%: it handles a concurrent A-G fan-out cleanly, the historical `argument_scheme` cluster is gone, and it degrades gracefully on a provider hiccup. The single within-budget `dead_letter` keeps the verdict honestly at PARTIAL rather than PASS. This is a launch-positive result.

**This verdict does NOT:** advance to 5% (separately operator-gated) · close the Stage-1 24h window (stays OPEN ≥ `2026-06-03T07:50:54Z`) · issue `PASS-STAGE-1` · authorize any H/I/J work.

**Follow-ups (none blocking):**
1. *(read-only, optional)* Operator inspects the Deno Deploy R3 `boolean_observation_tool_error` log for argId `9ef5aab5…` to disambiguate provider-5xx vs Family-F packet residual (§5).
2. *(separate card)* If §5 #1 shows an F packet-shape residual, open a Family-F mitigation follow-up parallel to the E/F STRICT RESPONSE-SHAPE CONTRACT work already shipped (PR #421/#423).
3. *(unchanged)* The Stage-1 organic observation window continues to its ≥ 24h close; the closeout verdict follows the Stage-1 audit §0 rule (`PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME` if organic stays zero).
