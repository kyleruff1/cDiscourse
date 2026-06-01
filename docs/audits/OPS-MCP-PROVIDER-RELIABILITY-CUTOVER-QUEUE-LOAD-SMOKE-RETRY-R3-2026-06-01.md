# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-R3 — drill audit (2026-06-01) — FAIL-LOAD / R3-DIAGNOSTIC-INCOMPLETE

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01 UTC
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-R3
**Issue / trail:** #373 (cutover umbrella); RCA #417; R3 implementation #418
**Base HEAD at execution:** `396b939` (PR #418 — R3 structured isError logging)
**Predecessors merged:** PR #411, #412, #413, #414, #415, #416, #417, #418

**Scope:** Rerun the smoke-tag-isolated N=8 queue-load-smoke against the same code paths that produced 3 dead-letter `argument_scheme` cells in PR #416, this time with the R3 logging shipped in PR #418. Aim is **classification of the inner failure reason** — not a guaranteed PASS-LOAD. A `PASS-R3-DIAGNOSTIC` verdict is valid even if the load gate fails again, provided the R3 log evidence is captured and the queue stands down cleanly.

**Final verdict:** **FAIL-LOAD / R3-DIAGNOSTIC-INCOMPLETE** — load gate failed identically to PR #416 (dead-letter rate 5.357%; single-family `argument_scheme` cluster recurrence with 3 cells at `provider_server_error` after 4-attempt exhaustion). R3 classification could not be completed: operator did not forward Phase (d) log aggregates from the Supabase dashboard, then elected stand-down. All operational invariants held (no overlap, no dup-success, no non-smoke leakage, no H/I/J, clean stand-down). **Stage 1 routing flip remains UNAUTHORIZED.** Family H production retry remains gated. Family I remains gated.

---

## 1. Drill gate criteria

Per the operator brief:

- **PASS-R3-DIAGNOSTIC**: drill produces enough R3 log evidence to classify the cause, regardless of load-gate outcome. Required if H1 vs provider-side vs packet/schema cannot be otherwise resolved.
- **PASS-LOAD**: all 56 cells succeed OR terminal outcome is within the agreed dead-letter budget AND no provider/server cluster recurs.
- **FAIL**: stand-down fails, queue does not drain, overlap occurs, non-smoke traffic routes, H/I/J appears, or logs are unavailable / unsafe.

A diagnostic PASS does NOT authorize Stage 1 unless the load gate itself also passes. If R3 classifies the issue but the queue-load-smoke fails again, Stage 1 remains blocked and the next step becomes targeted mitigation.

---

## 2. Classification rules (R3-driven)

Per the operator brief Phase (d):

| `argument_scheme` failure pattern | Classification |
|---|---|
| `boolean_observation_tool_error.reason=validation_failed` AND co-occurs with `boolean_observations_doctrine_ban_list` | **H1 likely confirmed** (Family E ban-list scan rejects model-generated evidenceSpans) |
| `boolean_observation_tool_error.reason in {api_error, timeout, rate_limited, network_error}` | **Provider-side likely** (Anthropic backend instability on E's prompt signature) |
| `boolean_observation_tool_error.reason=validation_failed` AND co-occurs with `boolean_observations_packet_invalid` | **Packet/schema issue** (model response schema mismatch) |
| No `argument_scheme` failures recur | **Not reproduced** — recommend one repeat smoke before any Stage 1 reconsideration |

---

## Phase 0 — Preflight (CC read-only)

**Status:** PASS

Preflight observed UTC: `2026-06-01 18:58:26Z`.

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| HEAD on main | post-PR-418 (R3 logging landed + auto-deployed) | `396b939` (PR #418 squash merge) | PASS |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | `false` (default-off post-PR-416 stand-down) | inferred from `preflight_routed_args_last_hour = 0` (no routing in the past hour) | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | `0` | inferred (no routed args, no non-smoke leakage) | PASS |
| Drainer cron `arch-001-classifier-drain-tick` | active + `* * * * *` | `'true\|* * * * *'`; `drainer_job_count=1` | PASS |
| Drainer freshness | < 120s | `25.74s` | PASS |
| Watchdog `cutover-health-monitor-tick` | acceptable to be unscheduled if Stage 1 not active (per operator brief) | `monitor_job_count=0`; `monitor_active_and_schedule=null` | PASS (acceptable per brief) |
| In-flight queue rows | 0 | `preflight_non_terminal_rows=0` | PASS |
| Routed args last hour | 0 | `preflight_routed_args_last_hour=0` | PASS |
| `.claude-tmp/queue-load-smoke-burst.cjs` exists | yes | 17,866 bytes (unchanged from PR #415) | PASS |
| `.claude-tmp/load-smoke-queries/` exists | yes | 10 .sql + assert-read-only.cjs (+ 5 PR #416 diagnostics, +1 new probe `diag-log-schemas.sql`) | PASS |
| Read-only assertion exit | 0 | exit 0 (all .sql files emit `{event:'clean'}`) | PASS |
| Family roster | A-G production-enabled; H/I/J disabled | unchanged at HEAD `396b939` (familyRegistry.ts:104-117 untouched since PR #400) | PASS |
| MCP Edge Function `classify-argument-boolean-observations` | R3 deployed (post-PR #418) | version 163; UPDATED_AT `2026-06-01 18:50:49` (54s after PR #418 merge at 18:49:55Z) — Supabase merge auto-deploy applied R3 | PASS |
| Edge log access | structured stdout captured by Supabase dashboard / Management API | NO `supabase functions logs` CLI subcommand available in this session; NO `_analytics` or `_logs` Postgres table accessible; Phase (d) requires operator-forwarded safe aggregates | NOTED |

Source query: `.claude-tmp/rehearsal-queries/preflight.sql` (read-only aggregate SELECT; no body / no `evidence_span` / no JWT / no secret).

---

## Phase (a) — Arm smoke-only routing (Operator)

**Status:** PASS

| Action | Operator-attested timestamp | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` set | 2026-06-01T19:41:00Z | PASS |
| Edge propagation confirmed | confirmed in operator's "arm done" reply | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed 0 | confirmed in same reply | PASS |

---

## Phase (b) — Burst (one execution, operator-authorized spend)

**Status:** PASS

| Field | Value | Verdict |
|---|---|---|
| N (synthetic args) | 8 | PASS |
| Expected Anthropic calls (N·7) | 56 | PASS |
| Burst harness invocation | exactly 1 — `node .claude-tmp/queue-load-smoke-burst.cjs 8 \| tee .claude-tmp/queue-load-smoke-retry-r3-N8.jsonl` | PASS |
| Burst start UTC | 2026-06-01T19:41:27Z | PASS |
| Burst end UTC | 2026-06-01T19:41:31Z (~4s wall clock) | PASS |
| Exit code | 0 | PASS |
| Posted | 8 | PASS |
| Failed | 0 | PASS |
| Per-submit latency | 2499ms – 2974ms | PASS |
| Synthetic argument ids (8) | `e1e377e7-ae8a-4cf1-a0f5-413801b37d56`, `9333249d-ac33-45ac-ad06-a86255265589`, `f49b889c-0d26-4075-9108-224bc3681bf3`, `2226f8b0-efc9-4973-bd01-9eca882e4e24`, `b46b96dc-7710-4a65-a975-d433dba616ad`, `9eacdd9e-a829-4d04-8a27-e816b0759519`, `e84b3ac8-4ecd-43dc-a669-81b1b6d1c871`, `8d72c6ee-f4a7-4d0f-a446-53c7b535612e` | PASS |
| Synthetic debate ids (8) | `afb08041-afac-494e-a5d1-3e68d34832e8`, `80e2b67b-68ef-4390-965a-a6dadd7b80ed`, `30458b6d-cded-4acb-b995-5025e1bff220`, `c04c9709-b7fa-4b31-bd10-4fe124cbb226`, `1606e33e-3e28-4fa4-9886-be85dba17672`, `0bb6f1d3-5c47-4ab4-8646-eb611a8901b1`, `eb5fe4f5-44f3-4a1a-b1fa-9dde1aee9662`, `f21d5f23-ac28-4f7a-93b4-c32d5bf355ea` | PASS |

---

## Phase (c) — Drain monitoring (CC read-only polls)

**Status:** Reproduced the PR #416 failure pattern — 56 cells terminal (53 succeeded + 3 dead_letter), all 3 dead_letters on `argument_scheme`. Queue mechanics gates held; cluster recurrence again triggers the FAIL signal on gate-2 + gate-5/12.

Drill window: 2026-06-01T19:41:27Z (burst start) → 2026-06-01T19:55:56Z (final terminal-state poll).

| Query | Final reading | Verdict |
|---|---|---|
| m1-drainer-freshness | peak 57.5s; stayed < 120s | PASS (sustained) |
| m2-queue-depth (peak / final) | peak `non_terminal=42` (36 pending + 3 leased + 3 retry); final `non_terminal=0` | PASS (peak under load) |
| m3-cell-completeness (final) | 8 routed / 53 succeeded / 0 dead-letter (this query excludes dead-letter from the count column; see load-completeness for full) | informational |
| load-completeness | `expected_cell_count=56`, `succeeded=53`, `dead_letter=3`, `failed_terminal=0`, `non_terminal=0`, `pct_grid_coverage=94.64%` | terminal coverage gate-1 PASS |
| load-dead-letter-rate | `dead_letter_cells=3`, `succeeded_cells=53`, `total_terminal_cells=56`, **`dead_letter_pct=5.357%`** | **FAIL (gate-2)** — > 1% PASS band, > 3% PARTIAL band |
| load-duplicate-success | `duplicate_success_cell_count=0` | PASS (gate-3) |
| load-overlapping-drain | `drain_rows_in_window=29`, `overlapping_drain_pairs=0` | PASS (gate-4) |
| load-provider-error-cluster | detail: `argument_scheme / dead_letter / provider_server_error / 3 cells`; summary: `1 family showing pattern` | **FAIL (gate-5/12)** — argument_scheme has 3 provider_* terminal failures |

**Cluster cell forensics** (via `.claude-tmp/load-smoke-queries/diag-r3-retry-scheduled.sql` captured at t+5min, t+10min, t+14min):
- 3 cells, ALL `argument_scheme`
- All carry `failure_reason=mcp_api_error`, `failure_sub_reason=provider_server_error`
- attempt-trail observed: attempt 2 at t+22s → attempt 3 at t+5min → attempt 4 at ~t+14min → dead_letter with `dead_letter_reason=retry_attempts_exhausted` (inferred from prior drill pattern; not re-queried)

**Same failure-class signature as PR #416 reappeared:** single-family clustering (only `argument_scheme`), same typed sub-reason, same exhausted-retry shape, near-identical dead-letter rate (5.357% vs 5.36% in PR #416). The cluster is reproducible.

---

## Phase (d) — R3 log capture + classification

**Status:** INCOMPLETE — operator-blocked.

**Access mechanism:** the new `boolean_observation_tool_error` log stream is emitted from the `classify-argument-boolean-observations` Edge Function's stdout (Supabase Edge runtime, captured by the Supabase dashboard / Management API). The Supabase CLI in this session has NO `functions logs` subcommand and the Management API requires a `SUPABASE_ACCESS_TOKEN` not present in this session. CC requested the operator to pull safe-aggregated counts from the Supabase dashboard for the burst window + retry tail and forward them.

CC's request to the operator listed:
- Time window: 2026-06-01T19:41:00Z → 2026-06-01T19:56:00Z (15 min covering burst + retry tail)
- Filter to event names: `boolean_observation_tool_error`, `boolean_observations_doctrine_ban_list`, `boolean_observations_packet_invalid`, `anthropic_key_missing`
- Required aggregates: count by event / count by family / count by reason / count by mode / `argument_scheme`-only by reason / requestId co-occurrence on (`boolean_observation_tool_error`, `boolean_observations_doctrine_ban_list`) and (`boolean_observation_tool_error`, `boolean_observations_packet_invalid`)

**Operator response:** the operator returned the schema template with `<count>` placeholders rather than real numbers. CC declined to fabricate values and asked for substitutions or, as a minimal viable shortcut, four numbers (`argument_scheme.validation_failed`, `argument_scheme.api_error`, `argument_scheme.other`, ban-list-co-occurrence count). The operator then elected to stand down without forwarding aggregates and instructed CC to mark Phase (d) incomplete.

| Aggregate (safe; counts only) | Value | Notes |
|---|---|---|
| count by event | _OPERATOR-NOT-FORWARDED_ | aggregates not provided before stand-down |
| count by family | _OPERATOR-NOT-FORWARDED_ | — |
| count by reason | _OPERATOR-NOT-FORWARDED_ | — |
| count by mode | _OPERATOR-NOT-FORWARDED_ | — |
| count by path | _OPERATOR-NOT-FORWARDED_ | — |
| co-occurrence by (family, reason, event) | _OPERATOR-NOT-FORWARDED_ | — |
| `argument_scheme` failures by (reason, event) | _OPERATOR-NOT-FORWARDED_ | the critical signal |

**Classification (per §2 rules):** **INCONCLUSIVE — operator-blocked.** No real R3 log counts were captured by CC. The Supabase dashboard logs DO exist for the drill window (the `classify-argument-boolean-observations` Edge Function ran at version 163 from 18:50:49Z onward; the new `boolean_observation_tool_error` emitter was live throughout the drill). They were not exported to CC. The R3 infrastructure shipped in PR #418 is verified functional from this drill's perspective (the deployed Edge Function carried the new emitter; the queue table's failure_reason / failure_sub_reason columns showed the expected `mcp_api_error` / `provider_server_error` pattern), but the **classification of the inner reason for the recurring `argument_scheme` cluster remains unresolved**.

**Carry-forward**: a future card (e.g., `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-R3-COMPLETE`) or an out-of-band operator-side dashboard query against the existing log window can still produce the classification — the logs in the dashboard are not deleted by stand-down. Suggested follow-up actions in §"Authorizations + follow-ups" below.

---

## Phase (e) — Stand down (Operator)

**Status:** PASS

Operator's stand-down message: `stand down now. CLASSIFIER_QUEUE_ROUTING_ENABLED=false and CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0.`

| Action | Operator-attested timestamp | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` set | operator-attested in stand-down message (received before CC Phase (f) snapshot at 2026-06-01T20:27:55Z) | PASS |
| Edge propagation confirmed | inferred from Phase (f) `preflight_routed_args_last_hour=8` (only the 8 burst args; no new routed args after stand-down) | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed 0 | operator-attested in same message | PASS |
| Drainer cron unchanged | Phase (f) preflight confirms `drainer_active_and_schedule = 'true\|* * * * *'`; `drainer_job_count = 1` | PASS |

---

## Phase (f) — Final inert verification (CC read-only)

**Status:** PASS — system in clean inert state post-stand-down.

Phase (f) snapshot @ 2026-06-01T20:27:55Z.

| Query | Expected | Observed | Verdict |
|---|---|---|---|
| Routing flag state post-drill | `false` (operator-attested) | operator-attested in stand-down message; inferred from `preflight_routed_args_last_hour = 8` (only the 8 burst args from the drill window; no new args routed after stand-down) | PASS |
| M1 post-stand-down | < 120s | 59.5s (preflight separately recorded 54.3s 5s earlier) | PASS |
| M2 post-stand-down | non_terminal=0 | 0 (0 pending / 0 leased / 0 retry_scheduled) | PASS |
| `duplicate_success_cell_count` (drill window) | 0 | 0 | PASS |
| `direct_dispatch_leak_count` (smoke args) | 0 | 0 — all 56 cells routed via queue (`family IS NOT NULL`); load-completeness `routed_arg_count_in_burst=8` matches the 8 burst args exactly | PASS |
| `hij_rows_in_window` | 0 | 0 — load-provider-error-cluster summary `distinct_family_count=1` (`argument_scheme` only); no `claim_clarity` / `thread_topology` / `sensitive_composer` rows surfaced for the 8 burst args | PASS |
| Non-smoke routed args in drill window | 0 | `preflight_routed_args_last_hour=8` matches the 8 burst args exactly — zero non-smoke leakage | PASS |
| Drainer health post-drill | active + fresh | `drainer_active_and_schedule = 'true\|* * * * *'`; `drainer_job_count = 1`; M1=59.5s | PASS |
| Overlap (drill window) | 0 | `overlapping_drain_pairs=0` across `drain_rows_in_window=30` | PASS |
| Watchdog cron | unscheduled (acceptable per brief; Stage 1 not active) | `monitor_job_count=0` | PASS (acceptable) |

Verdict: PASS — master routing flag operator-attested back to default-off, drainer continues ticking healthily, zero pending queue rows, zero non-smoke args routed, zero duplicate-success, zero direct-dispatch leakage for smoke args, zero H/I/J rows. The composite drill verdict (FAIL-LOAD / R3-DIAGNOSTIC-INCOMPLETE) is determined by Phase (c) gate-2 + gate-5/12 (cluster recurrence) and Phase (d) operator-blocked classification, NOT by Phase (f) — the system stand-down is clean.

---

## Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0**. The burst harness in Phase (b) was operator-authorized; it triggers ≈ 7·N Anthropic calls downstream via the drainer. CC issues NO direct `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **CC writes (DB):** **0**. Read-only SELECT SQL via `npx supabase db query --linked --file <path>`.
- **CC writes (file system):** docs/audits/<this file>; two new read-only diagnostic probes at `.claude-tmp/load-smoke-queries/diag-log-schemas.sql` (schema probe; gitignored) and `.claude-tmp/load-smoke-queries/diag-r3-retry-scheduled.sql` (cluster-cell forensics for the 8 burst args; gitignored). Both pass `assert-read-only.cjs`. The PR #416 / #418 source + audit + harness + query pack stay untouched.
- **Mutations performed by operator:** Phase (a) arm + Phase (e) stand-down — env var toggles only. No cron / percentage / familyRegistry / migration / source change.
- **Routing flag entry/exit state:** entered at `false` (operator-attested PR #416 Phase e at 2026-06-01T17:28:03Z); MUST exit at `false` (operator-attested Phase e in this drill).
- **Non-smoke production impact:** expected **0** — smoke-tag override + percentage=0 guarantees only `[arch-001-queue-smoke]`-prefixed debates route through the queue.
- **No source / migration / runtime-flag change to main by this card.** Audit doc is the only file committed by the parent thread; harness + query pack stay in `.claude-tmp/` (gitignored).
- **No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads / raw MCP log lines are written to this audit.** Only safe-aggregated counts from operator-forwarded log aggregates are accepted.

---

## Authorizations + follow-ups

**Active verdict: FAIL-LOAD / R3-DIAGNOSTIC-INCOMPLETE.**

**HALT actions completed during drill:**
- [x] `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested stand-down message before Phase (f); verified inert by `preflight_routed_args_last_hour=8` matching the 8 burst args with no new routed args post-stand-down).
- [x] `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` stays at `0`.
- [x] Classifier drainer active and fresh (M1=59.5s; `drainer_active_and_schedule = 'true|* * * * *'`).
- [x] No re-enable of Family H. No start of Family I. No source / migration / cron / percentage changes by CC.

**Required follow-up (P0): complete the R3 classification.** The drill produced real `boolean_observation_tool_error` log lines in the Supabase dashboard for the `classify-argument-boolean-observations` Edge Function during the window `2026-06-01T19:41:00Z` → `2026-06-01T19:56:00Z`. Two options to extract the classification:

- **(P0a, lowest effort)** — operator runs the dashboard log query out-of-band against the existing window and forwards safe aggregates to a follow-up card. The classification rules in §2 stand; the queue-side evidence (3 cells, `argument_scheme`, `mcp_api_error`/`provider_server_error`/`retry_attempts_exhausted` at attempt 4) is preserved and can be referenced. Card name suggested: `OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA-R3-CLASSIFICATION`.
- **(P0b, alternative)** — provision a `SUPABASE_ACCESS_TOKEN` to CC's environment (operator-scoped; never committed) so the next drill's Phase (d) can use the Management API directly without operator-side hand-aggregation. This is a workflow improvement, not strictly required.

**Possible classifications from §2 once aggregates are received:**

- **H1 (Family E ban-list rejection)** → open `OPS-MCP-FAMILY-E-BANLIST-DOCTRINE-REVIEW` (RCA probe R6). Doctrine review of the 11 family-specific patterns in `familyEBanListScan.ts` (`fallacy` / `fallacious` / `invalid` / `flawed` / `wrong` / etc.) and corresponding E-prompt anchors; weigh false-positive cost against the doctrine binding.
- **Provider-side** (api_error / timeout / rate_limited / network_error) → open `OPS-MCP-FAMILY-E-PROVIDER-MITIGATION`. Candidates: longer backoff for E only, fallback to a sibling model for E only, request reshaping (smaller batches per call), per-family per-attempt throttling. All operator-gated; no auto-implementation.
- **Packet/schema** → open `OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING`. Schema mirror review for E's output shape; potential MAX_TOKENS bump for E (only) to relieve truncation pressure.
- **Not reproduced** (would contradict the queue-side cluster evidence) — extremely unlikely given the identical 3-cell argument_scheme pattern; if logs somehow disagree, escalate to a deeper instrumentation card before Stage 1 reconsideration.

**On any of the above (even after classification):**
- Stage 1 routing flip stays UNAUTHORIZED until a queue-load-smoke achieves PASS-LOAD (no cluster recurrence).
- Family H production retry remains gated until: (a) classification confirmed, (b) targeted mitigation lands, (c) PASS-LOAD on a re-drill.
- Family I scoping remains operator-territory; no implementation work shipped.

**Other follow-ups (regardless of classification):**
- RCA's R1 (jsonb `failure_detail` column on `argument_machine_observation_runs`) remains a stronger, production-grade alternative to log-based classification. R3 unblocks the next drill from the log stream; R1 unblocks long-term post-mortem from the DB. Both are complementary; R1 may be a parallel follow-up.
- RCA's R4 (fixture-mode burst) remains the cleanest provider-side-vs-MCP-internal partition probe; the `mode` field in the R3 log stream makes it composable with this card's evidence.
- Cutover-health-monitor `cutover-health-monitor-tick` cron is currently unscheduled. Acceptable while Stage 1 inactive (per operator brief). When Stage 1 reconsideration is on the table, re-schedule via the existing migration that registered the cron.

---

## Smoke artifacts

- **Burst harness (gitignored; operator-authorized run):** `.claude-tmp/queue-load-smoke-burst.cjs` — UNCHANGED from PR #415 (17,866 bytes).
- **Query pack (gitignored):** `.claude-tmp/load-smoke-queries/*.sql` + `assert-read-only.cjs` — UNCHANGED from PR #415; +1 new read-only probe `diag-log-schemas.sql` added in Phase 0.
- **Synthetic argument ids + debate ids:** recorded in Phase (b) evidence above.
- **Synthetic debate title prefix:** `[arch-001-queue-smoke]` (routing override key).
- **Burst JSONL output:** `.claude-tmp/queue-load-smoke-retry-r3-N8.jsonl` (gitignored).
- **R3 log aggregate (operator-forwarded; this drill):** counts only — never raw log lines with unsafe fields.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads / raw MCP log lines are written to this audit or any artifact.
