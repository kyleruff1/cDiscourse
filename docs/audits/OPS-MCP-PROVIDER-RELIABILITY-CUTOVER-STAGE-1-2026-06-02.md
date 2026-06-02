# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1 — Stage 1 (1%) audit (2026-06-02) — OBSERVING

Audit-Lint: v1
Audit-type: ops
Doctrine-risk: false

> **L5 override note.** This is an OPS cutover audit. It names production family keys (`argument_scheme`, `critical_question`, `claim_clarity`, etc.) only as queue *routing targets* and gate references — it does NOT inspect classifier `evidence_span` output for doctrine compliance (that is the job of the per-family ship / production-enable audits). The `Doctrine-risk: false` override above tells `audit-lint` to skip the L5 persisted-output-inspection requirement, which does not apply to a routing-percentage cutover audit.

**Date:** 2026-06-02 UTC
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1
**Issue / trail:** #373 (cutover umbrella); two PASS-LOAD drills (PR #425 + #426); canary-then-burst runbook (PR #427)
**Base HEAD at execution:** `6abded6` (PR #427 — canary-then-burst runbook)
**Deno Deploy production:** build `qrvrmvp6qqhn` from `d2d436a` (carries PR #423 mitigation; `mcp-server/` byte-identical d2d436a→HEAD); hosted MCP smoke 23/23 PASS.

**Scope:** First production cutover step — queue routing enabled at **1% only** (`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`). No Family H/I/J enablement. No advance above 1%. No source/migration/validator/prompt/retry/drainer change. This is the separate operator authorization card that the PR #425/#426 PASS-LOAD audits explicitly did NOT auto-grant.

**Verdict:** **OBSERVING** — Stage 1 armed at 1%, canary PASS, T0 baseline all-green, observation window OPEN. The terminal verdict (PASS-STAGE-1 / PARTIAL / FAIL) is recorded at window close (≥ 24h), in a follow-up audit update. **PASS-STAGE-1, when reached, does NOT auto-advance to 5% — that requires a separate operator card.**

---

## 0. Low-traffic interpretation rule (added by OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION)

**The Stage-1 1% window is observing ZERO organic routed traffic.** As of 2026-06-02T08:28:29Z, read-only metrics show `routed_args_since_arm_total = 1`, of which `smoke_routed_args = 1` (the #428 canary `d3133d7f-…`) and **`non_smoke_routed_args = 0`**. No organic submit has hashed into the 1% bucket (`hash(argument_id) % 100 < 1`) because the product is pre-launch / low-volume — organic submit volume is effectively zero.

This shapes how the 24h closeout verdict must be read:

1. **What the canary proves:** the queue path is live and routes correctly at `PERCENTAGE=1` (7 A-G cells, `family IS NOT NULL`, zero H/I/J, zero `family=NULL` leakage). This is *plumbing liveness*, not load.
2. **What a zero-organic 24h window proves:** the routing flag is live, the drainer drains, the cutover-health-monitor watchdog ticks and alerts, rollback is one command away, and the system stays inert/healthy with the flag on. It proves **plumbing + observability + rollback + inertness** — NOT real organic load handling.
3. **What it does NOT prove:** how the queue behaves under real organic traffic mix, timing, and concurrency. With `non_smoke_routed_args = 0`, the window has observed exactly zero organic cells.
4. **Where the real load-readiness evidence lives:** the synthetic N=8 PASS-LOAD drills — PR #425 (PASS-LOAD, 56/56, 0 dead-letter) and PR #426 (PASS-LOAD-CONFIRM, second consecutive 56/56) — are the actual concurrent-load-handling evidence. Stage-1 organic observation supplements them; it does not replace them.
5. **5% remains separately gated** regardless of this window's outcome.

**Closeout-verdict rule:** if organic routed traffic remains zero (`non_smoke_routed_args = 0`) through the ≥ 24h window, the honest closeout verdict is **`PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME`** — explicitly **not** a plain `PASS-STAGE-1` (which would imply real organic load was observed and handled). A plain `PASS-STAGE-1` requires that organic routed cells actually appeared and were handled within budget. This audit's overall status stays **OBSERVING**; the window is NOT closed by this rule.

**Synthetic launch-qualification result (2026-06-02):** the named synthetic qualification ran a fresh N=1 canary + N=8 burst against the live 1% config and landed **`PARTIAL-SYNTHETIC-LAUNCH-QUALIFICATION`** — canary 7/7 clean, burst 55/56 succeeded + 1 isolated provider-side `dead_letter` (`critical_question`, `provider_server_error`), with the historically-failing `argument_scheme` family **8/8 clean** and every structural gate green (dup=0, overlap=0, M1<120s, M2=0, 0 H/I/J, 0 `family=NULL`, monitor healthy). See `docs/audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md`. This is synthetic launch confidence; it does NOT close this window, issue `PASS-STAGE-1`, or advance to 5%.

---

## 1. Phase 1 — observability/alerting (PASS)

Per `docs/audits/OPS-MCP-CANARY-THEN-BURST-RUNBOOK-2026-06-02.md` predecessor + `docs/runbooks/cutover-health-monitor.md`:

| Check | Observed | Verdict |
|---|---|---|
| Metrics-function migration `20260601000001` applied | present | PASS |
| Read-only metrics RPC `cutover_health_metrics()` live | returns valid object: `conditionA…conditionF` + `collected_at` | PASS |
| Vault secrets `cutover_monitor_url` + `cutover_monitor_shared_secret` | both present (Step-5 cron deps satisfied) | PASS |
| Admin recipients | 4 admin profiles + operator-set `ADMIN_NOTIFICATION_TO` | PASS |
| **Layer 3 email-delivery pre-flight** | operator injected an ALERT condition, ran the Layer 2 probe (`overallSeverity='alert'`, `emailStatus='sent'`, HTTP 200), and **confirmed an admin inbox received the alert email** | **PASS** (operator-attested) |
| `cutover-health-monitor-tick` scheduled | active, `*/5 * * * *`, 3 succeeded / 0 failed (15 min) | PASS |
| Drainer recovered after injected alert | M1 returned < 120s; queue depth zero | PASS |

The alerting watchdog is live and covers Conditions A–F throughout the 1% window. Per the runbook §206, the cron was enabled ONLY after the Layer 3 pre-flight passed.

## 2. Phase 2 — arm at 1%

**First arm attempt FAILED-CLEAN (no production change).** CC ran `scripts/ops/stage1/arm-stage1-1pct.sh`; `supabase secrets set` returned `"JWT could not be decoded"` (rc=1) because the `SUPABASE_ACCESS_TOKEN` in `.claude-tmp/operator-secrets.env` was not a valid account PAT (length 31, unrecognized prefix — not `sbp_`). The script aborted (rc=4) **before** changing any state; CC confirmed production routing stayed OFF (`routed_args_last_hour=0`, `non_terminal=0`). The secrets file itself was clean (ASCII, no BOM, no CRLF); only the token value was invalid. No disarm was needed (nothing was armed).

**Successful arm (operator):**

| Field | Value |
|---|---|
| Operator corrected `SUPABASE_ACCESS_TOKEN` (valid `sbp_…` account PAT) | yes |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | `true` |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | `1` (1% only) |
| Arm script exit code | 0 |
| **UTC_ARMED_TIMESTAMP** | **2026-06-02T07:50:54Z** |
| Edge propagation wait | ≥ 120s (operator-attested) |
| Pre-arm verification | both crons active; drainer freshness 40.19s; queue `non_terminal=0`; H/I/J gated |

## 3. Phase 2 — N=1 canary (PASS; canary-then-burst discipline)

Canary submitted at 2026-06-02T07:52:24Z (argId `d3133d7f-fe1a-46e9-b161-0460a7a4adf2`, smoke-tagged `[arch-001-queue-smoke]`). Routing inspected at 07:53:18Z:

| Criterion | Required | Observed | Verdict |
|---|---|---|---|
| Queue rows (`family IS NOT NULL`) | exactly 7 | **7** | PASS |
| Legacy rows (`family = NULL`) | 0 | **0** | PASS |
| Distinct A-G families | 7 | **7** (parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress) | PASS |
| H/I/J rows | 0 | **0** | PASS |
| Queue path confirmed | yes | yes — routing is live at 1% via the queue substrate | PASS |

The canary smoke-tag override routes regardless of percentage, directly proving the queue path is live. No `family = NULL` direct-dispatch leakage. The canary cells all reached `succeeded` (terminal) by T0.

## 4. Observation window — T0 baseline (all-green)

**Observation-window START:** 2026-06-02T07:52:24Z (canary submit) / first full snapshot 2026-06-02T07:55:11Z.

| Metric (T0 @ 07:55:11Z) | Observed | Status |
|---|---|---|
| Canary cells | 7/7 succeeded; 0 dead-letter; 0 failed_terminal; 0 H/I/J; 0 legacy | ✅ |
| M1 drainer freshness | 21.6s (< 120s) | ✅ |
| M2 queue depth | `non_terminal=0` (drained) | ✅ |
| `duplicate_success_cell_count` | 0 | ✅ |
| `overlapping_drain_pairs` | 0 | ✅ |
| Provider-error cluster (`distinct_provider_failing_family_count`) | 0 | ✅ |
| Routed args last hour | 1 — exactly the canary (zero organic non-smoke routed yet; expected for pre-launch low-volume) | ✅ |
| Monitor watchdog (Layer 1) | active `*/5 * * * *`, 3 succeeded / 0 failed (15 min) | ✅ |
| Drainer cron | active `* * * * *`, fresh | ✅ |
| H/I/J rows | 0 | ✅ |

T0 is fully green. No rollback trigger present.

## 5. Read-only monitoring cadence (ongoing, ≥ 24h)

Tracked via read-only SQL only (`.claude-tmp/load-smoke-queries/` + `.claude-tmp/rehearsal-queries/preflight.sql`):

- `preflight.sql` (routing + monitor health + drainer + queue)
- `m1-drainer-freshness.sql`
- `m2-queue-depth.sql`
- `load-duplicate-success.sql`
- `load-overlapping-drain.sql`
- `load-provider-error-cluster.sql`
- H/I/J leakage (any `claim_clarity`/`thread_topology`/`sensitive_composer` rows)
- non-smoke routed-args count (organic 1% routing volume vs expectation)
- monitor cron success/failure (Layer 1 watchdog freshness)
- dead-letter / failed-terminal rate on routed args

Cadence: design §5.9 — every ~15 min during Stage 1 (the 5-min alerting tick is the primary detector; manual SQL is the cross-check). Window held ≥ 24h before any 5% consideration.

## 6. Rollback criteria (immediate `scripts/ops/stage1/disarm-stage1.sh`)

Roll back to `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` / `PERCENTAGE=0` immediately on ANY of:

- H/I/J rows appear.
- `family = NULL` direct-dispatch leakage on a routed canary/smoke arg.
- Queue does not drain (M2 non-terminal climbing / not returning to zero).
- `duplicate_success > 0`.
- `overlapping_drain_pairs > 0`.
- Provider/server error cluster recurs (`distinct_provider_failing_family_count > 0` on a family/path).
- Dead-letter cluster appears.
- Monitor cron fails (Layer 1 FAIL: `recent_invocations=0` OR `failed_invocations>0` OR `seconds_since_last_invocation ≥ 600`).
- Alert email path failure.
- Non-smoke routed volume materially exceeds the 1% expectation.
- Operator requests rollback.

`disarm-stage1.sh` sets both env vars back to safe defaults via `supabase secrets set` and prints `UTC_DISARMED_TIMESTAMP`.

## 7. Stage 1 automation scripts (committed with this audit)

NEW under `scripts/ops/stage1/` (operator local-secrets automation; reference `.claude-tmp/operator-secrets.env` by variable NAME only — never a secret value; `set +x`; the gitignored secrets file is never committed):

- `check-operator-secrets.sh` — verifies the 3 secret NAMES present (no values printed).
- `verify-crons-and-queue.sh` — read-only cron + M1 + M2 verification.
- `arm-stage1-1pct.sh` — sets `ENABLED=true` + `PERCENTAGE=1`, verifies names, waits 120s, prints `UTC_ARMED_TIMESTAMP`. Aborts without changing state if the PAT is rejected (proven this drill).
- `disarm-stage1.sh` — sets `ENABLED=false` + `PERCENTAGE=0`; prints `UTC_DISARMED_TIMESTAMP`.

Verified: both `opsMcpObservability*` tests (which recursively scan `scripts/ops/`) PASS with the new scripts present (`FILES.length ≥ 19`, `sqlFiles === 17` unchanged since the scripts are `.sh`; zero banned-token / secret-shaped literals in the scripts including their `#` comments). Full Jest suite green.

## 8. Boundaries held (binding)

- **Stage 1 percentage = 1 only.** No advance to 5% without a separate operator card.
- **Family H production retry remains gated.** Family I gated. Family J gated. (`familyRegistry.ts:105/110/115` `productionEnabled: false` — untouched.)
- **`cutover-health-monitor` remains active** (`*/5 * * * *`) for the duration of Stage 1.
- No source / migration / validator / schema-mirror / prompt / key file / ban-list / retry-policy / drainer-constant change.

## 9. Provenance + boundary compliance

- **CC provider-spend invocations this card:** 1 operator-authorized N=1 canary (≈7 Anthropic Haiku calls via the drainer). No other provider call.
- **CC writes (DB):** **0**. Read-only `SELECT` SQL only.
- **CC env mutation:** the arm/disarm scripts set `CLASSIFIER_QUEUE_ROUTING_*` via `supabase secrets set` — this card is the explicit operator authorization for CC to run that automation. The **successful** arm (07:50:54Z) was performed by the operator (arm script exit 0 after the operator corrected the PAT). CC's earlier arm attempt failed-clean (invalid PAT; no state change).
- **CC writes (file system):** the 4 `scripts/ops/stage1/*.sh` automation scripts; this audit doc; read-only diagnostic SQL probes under `.claude-tmp/` (gitignored).
- **Secrets discipline:** no SUPABASE_ACCESS_TOKEN / MCP_SERVER_BEARER_TOKEN / CUTOVER_MONITOR_SHARED_SECRET / RESEND_API_KEY / service-role / JWT / Bearer / recipient-email value printed to chat, logs, scripts, or this audit. The `.claude-tmp/operator-secrets.env` is gitignored and never committed.
- **No H/I/J enablement. No advance above 1%. No prompt/validator/migration/familyRegistry change.**
