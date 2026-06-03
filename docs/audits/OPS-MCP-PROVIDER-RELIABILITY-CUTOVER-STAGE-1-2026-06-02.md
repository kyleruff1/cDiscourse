# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1 — Stage 1 (1%) audit (2026-06-02) — CLOSED: PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME

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

**Verdict:** **PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME** (window CLOSED 2026-06-02 by `OPS-MCP-STAGE1-CLOSEOUT`; see § 11). The 1% queue-routing *plumbing* is verified — canary routed 7/7 correctly, drain + monitor crons stayed healthy, rollback was one command away, the system stayed inert/healthy across the window — but organic routed volume was **zero throughout** (`non_smoke_routed_args = 0`), so real-organic-load handling was **not observed and is not claimed**. The window was **closed deliberately and early** because a zero-traffic soak adds no information beyond its first snapshot. Routing was **disarmed to baseline** (`ENABLED=false`/`PERCENTAGE=0`, `UTC_DISARMED_TIMESTAMP=2026-06-02T18:32:26Z`). **5% and higher are NOT advanced by this verdict — the real ramp is a launch-time decision when real traffic exists, not a scheduled percentage ladder.**

> _History: this audit was OBSERVING from arm (2026-06-02T07:50:54Z) until the deliberate early close on 2026-06-02. The § 0 low-traffic interpretation rule (added during the window) anticipated exactly this closeout verdict._

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

---

## 10. Live observation window checkpoints (read-only)

Periodic read-only checks taken during the OPEN Stage-1 1% window via the Card-2 observation pack (`scripts/ops/stage1/stage1-snapshot.sh`, `stage1-routed-volume.sh`, `stage1-hij-leakage.sh`, `stage1-window-close-readonly.sh` → read-only `supabase db query --linked` against `scripts/ops-stage1-sql/`). These are observation only: **none of them close the window, issue `PASS-STAGE-1`, or change the percentage.** See `docs/runbooks/stage1-observation.md`.

| UTC | routed since arm (all smoke) | organic (non_smoke) | H/I/J rows | M2 depth | M1 since last drain | monitor (15 min) | note |
|---|---|---|---|---|---|---|---|
| 2026-06-02T09:10:42Z | 10 | **0** | **0** | 0 (idle) | ~35 min (idle-empty) | 0 fail / 3 ok (`*/5`) | queue idle post-qualification; ~22.7h to window close |
| 2026-06-02T18:31:08Z | 10 | **0** | **0** | 0 (idle) | ~9.9h (idle-empty) | 0 fail / 3 ok (`*/5`) | window-close snapshot; no trigger ever fired; deliberate early close (§ 11); routing disarmed 18:32:26Z |

Reading the columns:

- **routed since arm = 10, all smoke-tagged** (the #428 canary + the Card-1 qualification canary + the 8-thesis burst). **organic (`non_smoke_routed_args`) = 0** — no organic submit has hashed into the 1% bucket yet (pre-launch volume; the §0 low-traffic rule governs the closeout verdict).
- **H/I/J rows = 0** — no dormant-family leakage on the routed path.
- **M2 depth = 0** — the queue is fully drained / idle.
- **M1 since last drain is large here precisely because the queue is idle-empty, NOT because the drainer is stuck.** M1 staleness is a rollback signal **only when paired with M2 > 0** (depth present AND drainer not completing). With M2 = 0 and the monitor reporting 0 failures, an old `last completed drain` timestamp is expected and benign.
- **monitor = 0 fail / 3 ok on `*/5`** — Layer-1 watchdog healthy.

The window was **closed deliberately and early on 2026-06-02** (≈10.7h into the ≥24h window) at the **`PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME`** verdict per the § 0 closeout-verdict rule — organic routed stayed zero throughout, so the remaining ~13h could not have produced real-load evidence. See § 11.

---

## 11. Closeout — PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME (2026-06-02)

`OPS-MCP-STAGE1-CLOSEOUT` closed the Stage-1 1% window **deliberately and early** — ≈10.7h into the ≥24h window (armed `2026-06-02T07:50:54Z`; window would otherwise have elapsed `2026-06-03T07:50:54Z`). Final read-only snapshot `2026-06-02T18:31:08Z`; routing disarmed `2026-06-02T18:32:26Z`.

**The verdict and what it means.** The 1% queue-routing **plumbing** is verified: the canary routed 7/7 correctly (`family IS NOT NULL`, 0 legacy, 0 H/I/J), the ARCH-001 drainer + `cutover-health-monitor` crons stayed healthy throughout, rollback was one command away (`disarm-stage1.sh`), and the system stayed inert/healthy with the flag on. Organic routed volume was **zero throughout** (`non_smoke_routed_args = 0`), so real-organic-load handling was **not observed and is not claimed** — hence `PLUMBING / INSUFFICIENT-ORGANIC-VOLUME`, explicitly **not** a plain `PASS-STAGE-1`.

**No rollback trigger ever fired** (window-wide read-only sweep, snapshot `2026-06-02T18:31:08Z`): 0 H/I/J rows · 0 `family=NULL` leakage on a routed arg · 0 `duplicate_success` cells · 0 `overlapping_drain_pairs` · M2 drained to 0 · monitor 0-fail / 3-ok on `*/5`. The window's single `dead_letter` (the synthetic `critical_question` cell from the PR #429 burst — characterized as a provider-side 5xx at closeout, **later corrected to a packet-shape residual by the R3 disambiguation; see § 12**) is **one isolated cell in one family — not a dead-letter or provider cluster** (`distinct_dead_letter_families = 1`); it was adjudicated within-budget in the PARTIAL synthetic qualification and is **not** a rollback trigger. The disarm was therefore a clean planned standdown, **not** a rollback.

**The early close was deliberate.** The product is pre-launch with no organic traffic and no testers; per the § 0 "Low-traffic interpretation rule" a zero-organic window proves plumbing / observability / rollback / inertness, never real organic load. With `non_smoke_routed_args = 0` and nothing in the pipeline to change that, the window's remaining ~13h could not have produced real-load evidence — the same fact that makes this PLUMBING rather than a plain PASS-STAGE-1. Holding the full ≥24h would have been bookkeeping, not safety; closing early loses no information.

**Where the real load-readiness evidence lives.** The synthetic launch-qualification (PR #429, **PARTIAL** — N=8 burst 55/56 succeeded, `argument_scheme` 8/8 clean, one isolated provider-side `dead_letter`; `docs/audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md`) plus the two PASS-LOAD drills (PR #425 56/56 0-dead-letter + #426 PASS-LOAD-CONFIRM, second consecutive 56/56). Organic confirmation will accrue only once real traffic exists.

**5% and higher are NOT advanced.** This verdict closes Stage 1 at the plumbing level only. The real ramp is a **launch-time decision** — route at a measured percentage when real traffic exists, informed by capacity testing — not a scheduled percentage ladder. No audit/doc auto-advances the percentage.

**Disarm to baseline.** Routing set to `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` / `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` via `scripts/ops/stage1/disarm-stage1.sh` (`secrets set` exit 0, `UTC_DISARMED_TIMESTAMP=2026-06-02T18:32:26Z`); confirmed inert at `2026-06-02T18:32:44Z` (M2 non-terminal = 0; `arch-001-classifier-drain-tick` + `cutover-health-monitor-tick` crons still active). This is the clean "Stage 1 closed; baseline until launch" production state and makes the upcoming R1 drainer deploy zero-risk (no routing, no traffic). `cutover-health-monitor` may be stood down or left active — operator's call; leaving it is cheap and harmless.

**Open follow-up (non-blocking) — NOW RESOLVED (see § 12).** The read-only R3 disambiguation of the lone Family-F `provider_server_error` dead-letter (argId `9ef5aab5…` — provider-side 5xx vs an F packet-shape residual; see `docs/roadmap-expansions/2026-06-02-mcp-A-G-stability-roadmap.md` § Family-F follow-up) **was completed on 2026-06-02** via the Deno Deploy R3 logs. Result: **packet-shape residual** (`validation_failed` on `evidenceSpan.unstated_assumption`), **not** provider-side. It did not gate this closeout and does not change the verdict — see § 12.

## 12. R3 disambiguation of the lone dead-letter — packet-shape residual, not provider-side (resolves § 11 open follow-up) (2026-06-02)

Run under incident-triage discipline (read-only, metadata-only; **no argument body / evidence_span text / prompt / raw provider payload was queried or recorded** — only structural aggregates below).

**Phase 0 — classification: `9ef5aab5` is SYNTHETIC, not organic.** Four converging signals (signals 1 and 4 are logically *coupled* by the routing predicate — a smoke-tagged arg is by construction excluded from the organic count, which only **strengthens** the synthetic conclusion):

| Signal | Result |
|---|---|
| Debate smoke-tag (DB) | `is_smoke_tagged = true` — its debate carries the `[arch-001-queue-smoke]` prefix |
| Synthetic artifact files | present in `.claude-tmp/stage1-qual-burst-N8.jsonl` (the PR #429 N=8 qualification burst) |
| PR #429 qualification audit | a recorded burst argId — listed among the 8 burst argIds (§3) and typed in the dead-letter analysis (§5); 4 textual mentions of the **one** cell |
| Organic routed traffic since arm | `organic_non_smoke_routed_args = 0` (all 10 routed args since arm `2026-06-02T07:50:54Z` were smoke-tagged; `organic_terminal_failure_args = 0`) |

There has been **zero organic routed traffic** in the entire window, so the dead-letter **cannot** be organic. This is fully consistent with the § 11 `PLUMBING / INSUFFICIENT-ORGANIC-VOLUME` verdict.

**R3 evidence (Deno Deploy `boolean_observation_tool_error` logs, 2026-06-02T08:32–08:48Z; safe aggregates only):**
- **5 tool-error events** in the window; **5/5 `reason = validation_failed`** — **0 × `provider_server_error`** in the R3 log.
- **5/5 co-occurred with `boolean_observations_packet_invalid`** (the packet-shape signature).
- **0 `doctrine_ban_list` co-occurrences** (not a ban-list issue).
- **61 `anthropic_call_success` / `httpStatus=200`**, the earliest (08:32:02) **preceding** the first failure (08:33:40) — the provider was healthy; the failure is downstream MCP-021A packet validation.
- `critical_question` path = **`evidenceSpan.unstated_assumption`, count 4** (= `9ef5aab5`'s four attempts, all failing on the same rawKey → deterministic, not a transient the 4-attempt budget can absorb).
- `argument_scheme` path = `evidenceSpan.abductive_explanation_present`, count 1 — failed once then **recovered on retry** (E finished 8/8), because PR #421/#423 added per-rawKey rule-6 reinforcement for that key. `unstated_assumption` has **no** such reinforcement (`familyFPrompt.ts:299-312` names only `alternative_explanation_available`) → the residual.

**Correction to the closeout characterization.** § 0 / § 10 / § 11 described this cell as a "provider-side 5xx" because the **queue row** recorded `failure_sub_reason = provider_server_error` — the Edge adapter buckets *any* MCP `{isError}` envelope (including a packet-validation failure) under `provider_server_error`, stuffing the real inner reason into `detail.serverReason` / `detail.path`. The R3 disambiguation corrects the inner cause: it was a **deterministic Family-F packet-shape residual** on `critical_question.evidenceSpan.unstated_assumption`, **not** a transient Anthropic 5xx. (Going forward, PR #432's `failure_detail` column persists this distinguisher directly to the queue row; `9ef5aab5` predates that deploy, so the Deno R3 log was required.)

**Phase 1 — decision: SYNTHETIC branch. No verdict change, no new mutation.**
- The dead-letter was **synthetic**, so it is **not** a Stage-1 organic-rollback trigger. The § 11 verdict (`PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME`, `organic_non_smoke_routed_args = 0`) **stands unchanged** — only the *inner cause* of the synthetic dead-letter is corrected.
- Routing is **already disarmed to baseline** (§ 11; `UTC_DISARMED_TIMESTAMP=2026-06-02T18:32:26Z`) and confirmed still inert at this triage (M2 non-terminal = 0; drainer + monitor crons active; env vars survive the PR #432 redeploy). **No new disarm action is required or taken.**
- **Not advancing to 5%. Family H/I/J remain `productionEnabled:false`.** No validator/ban-list relaxation, no prompt change in this triage.

**Phase 2 — hardening plan filed (design-only).** `docs/designs/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING.md` extends the proven PR #421/#423 rule-6 RAWKEY-SHAPE REINFORCEMENT pattern to `evidenceSpan.unstated_assumption`. Implementation is a **separate operator-authorized mitigation card** (requires a `mcp-server/` → Deno Deploy push, which the merge-auto-deploy does not cover).

## 13. Post-deploy verification of the Family-F `unstated_assumption` fix — **PASS** (2026-06-03)

The § 12 hardening was implemented (rule 7 RAWKEY-SHAPE REINFORCEMENT for `evidenceSpan.unstated_assumption`, **PR #443 `f529edb`**; roadmap-reviewer Approve), the operator deployed `cdiscourse-mcp-server` to Deno Deploy, and this verification confirms the fix in production under canary-then-burst discipline. Read-only, metadata-only DB analysis (no argument body / evidence_span / prompt / provider payload queried).

**Attestation timeline (UTC):**
- Operator hosted-MCP smoke attestation: **`2026-06-03T02:34:49Z`** — `MCP-SERVER-001 smoke: 23 PASSES, 0 FAILS` (operator-run, exit 0).
- Smoke-only arm: **`2026-06-03T02:42:33Z`** — `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` (digest-verified: ENABLED=SHA256("true"), PERCENTAGE=SHA256("0")). **0% organic — smoke-tag override only; not a 5% advance.**
- Disarm to baseline: **`2026-06-03T03:04:54Z`** — `ENABLED=false` (digest-verified SHA256("false")), `PERCENTAGE=0`. Inert confirmed (`system_non_terminal = 0`, `smoke_non_terminal = 0`).

**Result (63 classifier cells = N=1 canary + N=8 burst, each × 7 A–G families):**

| Metric | Value |
|---|---|
| `critical_question` (Family F) cells | **9 / 9 succeeded on first attempt** (`max_attempts = 1`) |
| **dead_letter on `critical_question` / `evidenceSpan.unstated_assumption`** | **0** ✅ |
| Total cells succeeded | 62 / 63 |
| Canary gate | 7/7 succeeded first-attempt → PASS → proceeded to burst |
| Submit success | canary 1/1, burst 8/8 posted, 0 submit failures |

**The single dead-letter is orthogonal and within budget.** One `argument_scheme` (Family **E**) cell exhausted its 4-attempt budget on `provider_server_error`. Its persisted `failure_detail` (now live, PR #432) shows **`validator_path = null` / `serverReason = null` / `reason = mcp_api_error`** — i.e. a **genuine provider-side transient**, NOT a packet-shape validation failure. This is the documented ~2–4% transient floor (known-blockers § 3) and a single isolated provider-side 5xx dead-letter is **within the dead-letter budget** (roadmap § 6.2), not a rollback trigger or a regression.

**This is the decisive contrast.** The original incident `9ef5aab5` was `critical_question` with `validator_path = evidenceSpan.unstated_assumption` (**packet-shape**). Post-fix, that class is **eliminated** (0/9 cq dead-letters, all first-attempt), and the only residual is a **different, provider-side class** that `failure_detail` distinguishes by `validator_path = null` — so **no Deno-log pull was needed** (the operator constraint held). Both the rule-7 prompt fix **and** the #432 `failure_detail` observability are validated by this run.

**Boundaries held:** 0% organic (PCT=0 smoke-only, no 5% advance); no Family H/I/J enablement; no runtime/validator/ban-list change in the verification; canary-then-burst discipline; routing disarmed back to baseline; `failure_detail` (not Deno logs) used for the residual.
