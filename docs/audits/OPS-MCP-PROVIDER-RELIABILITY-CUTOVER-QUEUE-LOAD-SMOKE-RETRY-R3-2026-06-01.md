# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-R3 — drill audit (2026-06-01) — FAIL-LOAD / R3-DIAGNOSTIC = packet/schema validation failure on argument_scheme

> **Superseded for gate/pass/ramp semantics (2026-06-03).** The canonical reference for every pass / PASS-LOAD / PASS-LOAD-CONFIRM / Stage-1 / plumbing-vs-organic / ramp / dead-letter / cluster definition is `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (operator-ratified). Any pass/load/ramp/threshold language below is historical; where it differs from the canonical doc, the canonical doc governs.

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01 UTC
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-R3
**Issue / trail:** #373 (cutover umbrella); RCA #417; R3 implementation #418
**Base HEAD at execution:** `396b939` (PR #418 — R3 structured isError logging)
**Predecessors merged:** PR #411, #412, #413, #414, #415, #416, #417, #418

**Scope:** Rerun the smoke-tag-isolated N=8 queue-load-smoke against the same code paths that produced 3 dead-letter `argument_scheme` cells in PR #416, this time with the R3 logging shipped in PR #418. Aim is **classification of the inner failure reason** — not a guaranteed PASS-LOAD. A `PASS-R3-DIAGNOSTIC` verdict is valid even if the load gate fails again, provided the R3 log evidence is captured and the queue stands down cleanly.

**Final verdict:** **FAIL-LOAD / R3-DIAGNOSTIC = packet/schema validation failure on `argument_scheme`** — load gate failed identically to PR #416 (dead-letter rate 5.357%; single-family cluster with 3 cells at `provider_server_error` after 4-attempt exhaustion). R3 classification completed from **Deno Deploy `cdiscourse-mcp-server` logs** (the actual MCP server runtime) after Supabase `function_logs` returned zero `boolean_observation_tool_error` rows: all 3 failing requestIds carried `boolean_observation_tool_error.reason=validation_failed` + co-occurring `boolean_observations_packet_invalid`, with zero ban-list co-occurrences and zero `api_error` / `timeout` / `rate_limited` / `network_error`. RCA hypothesis **H3 (packet/schema validation) CONFIRMED**; **H1 (ban-list rejection) REFUTED**; **H2 (provider-side / Anthropic backend) REFUTED** (Anthropic calls returned `httpStatus=200` + `anthropic_call_success` before the validation failures). All operational invariants held (no overlap, no dup-success, no non-smoke leakage, no H/I/J, clean stand-down). **Stage 1 routing flip remains UNAUTHORIZED.** Family H production retry remains gated. Family I remains gated. Recommended P0 follow-up: `OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING` — investigate model-side packet shape on `argument_scheme` (specifically `evidenceSpan.abductive_explanation_present` and `checkedRawKeys` arity).

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
| Supabase Edge Function `classify-argument-boolean-observations` proxy | redeployed by Supabase merge auto-deploy | version 163; UPDATED_AT `2026-06-01 18:50:49` (54s after PR #418 merge at 18:49:55Z); this is the proxy, NOT the R3 emitter — see Phase (d) architectural correction | PASS |
| Deno Deploy `cdiscourse-mcp-server` (actual R3 emitter host) | post-PR #418 build deployed before drill | confirmed in Phase (d) by presence of `boolean_observation_tool_error` log lines for the drill window in Deno Deploy logs | PASS (confirmed retroactively in Phase (d)) |
| Edge / MCP log access from CC session | log capture path | NO `supabase functions logs` CLI subcommand; NO `_analytics` or `_logs` Postgres table accessible; NO `SUPABASE_ACCESS_TOKEN`; NO Deno Deploy CLI in session. Phase (d) requires operator-forwarded safe aggregates from the Deno Deploy `cdiscourse-mcp-server` dashboard (Supabase function_logs returned zero rows — wrong source). | NOTED |

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

**Status:** PASS — classification completed via Deno Deploy `cdiscourse-mcp-server` logs.

### Architectural correction (this section supersedes earlier inaccurate phrasing in this audit)

The new `boolean_observation_tool_error` event is emitted by **`mcp-server/tools/classifyArgumentBooleanObservations.ts`** which runs on **Deno Deploy** under the project name `cdiscourse-mcp-server`. The Supabase Edge Function `classify-argument-boolean-observations` (deployment version 163, updated at 2026-06-01T18:50:49Z) is a thin proxy that forwards calls into the Deno Deploy MCP server; its merge-auto-deploy on PR #418 ship did **not** carry the R3 emitter — that emitter lives on the Deno Deploy side. The R3 emitter became visible in Deno Deploy `cdiscourse-mcp-server` logs once the operator deployed the post-PR #418 `mcp-server/` build there (separate deploy path from Supabase merge integration). Earlier wording in this audit that attributed R3 deployment to the Supabase Edge Function version 163 was inaccurate; the corrected attribution is: R3 lives in Deno Deploy `cdiscourse-mcp-server`, NOT in any Supabase Edge Function.

### Capture mechanism

- **Source attempted first (returned zero rows):** Supabase Logs Explorer / `function_logs` and `edge_logs` for `classify-argument-boolean-observations`. No `boolean_observation_tool_error` events present (because the emitter does not run in this proxy layer).
- **Source that produced evidence:** Deno Deploy `cdiscourse-mcp-server` logs for the drill window.
- **Time window of the visible log segment** (operator-forwarded): 2026-06-01T19:42:50Z → 2026-06-01T19:44:05Z (covers the burst's first attempt failure tail; the retry-tail attempts at +30s / +120s / +120s would have produced additional events that fit the same pattern).

### Safe aggregates (operator-forwarded; counts only; no raw log lines)

**`argument_scheme` `boolean_observation_tool_error` by `reason`:**

| reason | count |
|---|---:|
| `validation_failed` | 3 |
| `api_error` | 0 |
| `timeout` | 0 |
| `rate_limited` | 0 |
| `network_error` | 0 |
| (other) | 0 |

**`requestId` co-occurrence** (across the same drill log window):

| Pair | count |
|---|---:|
| `boolean_observation_tool_error` + `boolean_observations_packet_invalid` (same `requestId`) | **3** |
| `boolean_observation_tool_error` + `boolean_observations_doctrine_ban_list` (same `requestId`) | **0** |

**RequestIds observed** (correlation ids only — no body / no prompt / no payload):
- `6ef74311-dfbd-445a-8c00-94f836e442c9`
- `8b0d42de-2005-4e4f-a577-40acee903929`
- `50abe6af-dff4-4fb4-b1cd-b2c60b62b201`

**Observed `path` values** (short structural identifiers; emitted by the R3 emitter from `extra.path`; per the source-scan tests these are never verbatim body / evidenceSpan text):

| path | count |
|---|---:|
| `evidenceSpan.abductive_explanation_present` | 1 |
| `checkedRawKeys` | 2 |

**Anthropic-side observation:** the operator notes that **Anthropic calls returned `httpStatus=200` and emitted `anthropic_call_success` BEFORE the failures appeared.** This is decisive evidence that the underlying Anthropic API was healthy during the drill — the failures are downstream of the provider response, inside the MCP-server-side packet validation step.

### Classification (per §2 rules)

**Packet/schema validation failure on `argument_scheme`.**

Per the §2 mapping table, this drill matches the row: `boolean_observation_tool_error.reason=validation_failed` AND co-occurs with `boolean_observations_packet_invalid` → **Packet/schema issue.**

This decisively confirms RCA hypothesis **H3 (output token budget pressure / response shape)** as the proximate cause — though the new evidence sharpens it beyond "budget pressure": the model returned syntactically present packets that failed specific shape constraints, with all three failures clustered on:
- (a) `evidenceSpan.abductive_explanation_present` (1 instance) — likely a type / length / null-conformance violation on this specific rawKey's evidenceSpan entry
- (b) `checkedRawKeys` (2 instances) — likely an arity / membership mismatch between the model-returned `checkedRawKeys` array and the requested rawKey set

Both paths are downstream of `validateMcpBooleanObservationResponse` (`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`). The ban-list scan path (Family E's strict scoped list) was NEVER reached — the packet failed schema validation before ban-list scan ran. RCA H1 (Family E ban-list rejection on common-English-word patterns) is **REFUTED for this drill**; H2 (Anthropic backend instability) is **REFUTED** (Anthropic returned 200 + success before validation).

The H1 hypothesis was the highest-evidence-weight in the RCA based on cross-drill pattern; this drill's data overrides that ranking. The next mitigation card should target packet shape, not ban-list semantics.

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
- **No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads / raw MCP log lines are written to this audit.** Only safe-aggregated counts from operator-forwarded log aggregates were accepted in Phase (d); the three `requestId` values recorded above are correlation ids only — they carry no body, prompt, or payload. The Deno Deploy log query that produced the aggregates is identified by `family='argument_scheme'` filter on the structured event names — the underlying raw log lines stay inside the Deno Deploy dashboard and were not transmitted to CC.

---

## Authorizations + follow-ups

**Active verdict: FAIL-LOAD / R3-DIAGNOSTIC-INCOMPLETE.**

**HALT actions completed during drill:**
- [x] `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested stand-down message before Phase (f); verified inert by `preflight_routed_args_last_hour=8` matching the 8 burst args with no new routed args post-stand-down).
- [x] `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` stays at `0`.
- [x] Classifier drainer active and fresh (M1=59.5s; `drainer_active_and_schedule = 'true|* * * * *'`).
- [x] No re-enable of Family H. No start of Family I. No source / migration / cron / percentage changes by CC.

**P0 mitigation card recommended: `OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING`.**

The Phase (d) classification is decisive: `argument_scheme` cluster recurrence is a packet/schema validation failure on the model's response, not a ban-list rejection and not a provider-side transient. The two specific failure paths observed in the drill log segment are:

| Path | Count (in visible log segment) | Likely root cause |
|---|---:|---|
| `evidenceSpan.abductive_explanation_present` | 1 | rawKey-specific evidenceSpan field violation — possible causes: wrong type returned (object/array instead of `string \| null`), exceeds the implicit max length, or duplicates a key that the validator rejects |
| `checkedRawKeys` | 2 | arity / membership mismatch — possible causes: model returned a `checkedRawKeys` array that doesn't match the requested rawKey set (missing keys, extra keys, or wrong order/dedup) |

Both paths fail at `validateMcpBooleanObservationResponse` (in `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`), BEFORE the ban-list scan runs. The MAX_TOKENS=1500 ceiling combined with E's 16-key Walton-scheme output may be a contributing factor (response gets truncated mid-evidenceSpan or mid-checkedRawKeys), but the visible failure paths suggest model-side packet-shape errors more than pure truncation. A targeted investigation should:

1. **(low-cost first)** Inspect the model's exact response shape for the three failing requestIds (`6ef74311…`, `8b0d42de…`, `50abe6af…`) via Deno Deploy logs — specifically the `boolean_observations_packet_invalid` log lines should carry the validator's structured `path` + `detail` + `receivedType` / `receivedKeys` fields. Determine if the failures are: (a) one of `null` / wrong-type at `evidenceSpan.abductive_explanation_present`, or (b) `checkedRawKeys` arity drift.
2. **(if MAX_TOKENS pressure confirmed)** Consider bumping E's `FAMILY_E_MAX_TOKENS` from 1500 → 1800 (matching Family D's existing carve-out). This is a one-line constant change in `mcp-server/lib/familyEPrompt.ts`; operator-gated; would also require a fresh drill to verify.
3. **(complementary)** Tighten E's user prompt's response-shape instruction (`mcp-server/lib/familyEPrompt.ts:178-199`) to be more explicit about the `checkedRawKeys`/`evidenceSpan`/`confidence` triple invariant — specifically that every key in `observations` MUST appear identically in all three peer maps and in `checkedRawKeys`. The prompt already says this; revisit whether the model is misreading the instruction.
4. **(orthogonal)** Validator robustness: review whether `validateMcpBooleanObservationResponse` should permit a small set of recoverable shape drifts (e.g., a missing `evidenceSpan` entry coerced to `null`) instead of rejecting whole packets. Doctrine consideration: relaxing validation here is risky because it could mask ban-list-bypass attempts. This is a doctrine review, not a quick fix.

**Refuted / re-ranked from the RCA:**

- **H1 (Family E ban-list rejection)** — REFUTED for this drill. Zero `boolean_observations_doctrine_ban_list` co-occurrences with the failing `requestId`s. The ban-list path was never reached. Cross-drill historical pattern in the RCA (5 prior victim drills) may have had different causes; H1 should not be assumed for those without retroactive log analysis. `OPS-MCP-FAMILY-E-BANLIST-DOCTRINE-REVIEW` is **deprioritized** (still a valid long-term cleanup, but not the lever that unblocks Stage 1).
- **H2 (Anthropic backend instability)** — REFUTED. Anthropic calls returned `httpStatus=200` + `anthropic_call_success` before the failures. No `api_error` / `timeout` / `rate_limited` / `network_error` observed.
- **H3 (output token budget / response shape)** — CONFIRMED, narrowed to packet-shape errors at specific paths. RCA had ranked H3 as LOW-MEDIUM evidence weight; this drill promotes it to the binding cause.

**Authorization gates (unchanged):**
- Stage 1 routing flip stays UNAUTHORIZED until a queue-load-smoke achieves PASS-LOAD (no cluster recurrence) — requires the mitigation card above to land first.
- Family H production retry remains gated until: (a) `OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING` lands, (b) PASS-LOAD on a re-drill.
- Family I scoping remains operator-territory; no implementation work shipped.

**Other follow-ups (regardless of mitigation choice):**
- RCA's R1 (jsonb `failure_detail` column on `argument_machine_observation_runs`) becomes more valuable now that R3 has proven log-based classification works but requires manual operator-side aggregation; R1 would persist this evidence to the DB automatically for every cell.
- RCA's R4 (fixture-mode burst) is less critical now that H2 is refuted — fixture-mode would have helped distinguish provider-side from MCP-internal, but the evidence already places the failure inside the MCP server's validation step.
- Cutover-health-monitor `cutover-health-monitor-tick` cron is currently unscheduled. Acceptable while Stage 1 inactive. When Stage 1 reconsideration is on the table, re-schedule via the existing migration that registered the cron.

**Process improvements surfaced by this drill:**
- The R3 emitter's deploy target was **Deno Deploy `cdiscourse-mcp-server`**, NOT Supabase Edge Functions. The Supabase merge-auto-deploy that updates `supabase/functions/*` did NOT propagate the R3 code; a separate Deno Deploy push was required (and was apparently completed before the operator pulled the logs). For future MCP server changes, document the Deno Deploy push step in the PR's "Deploy step (operator)" line so the deploy chain is explicit.
- CC's session lacks `supabase functions logs` CLI subcommand AND `SUPABASE_ACCESS_TOKEN`. CC also lacks Deno Deploy log access. All MCP-side log capture currently requires operator-side dashboard work. R1 (jsonb `failure_detail` column) would remove this dependency entirely for future drills.

---

## Smoke artifacts

- **Burst harness (gitignored; operator-authorized run):** `.claude-tmp/queue-load-smoke-burst.cjs` — UNCHANGED from PR #415 (17,866 bytes).
- **Query pack (gitignored):** `.claude-tmp/load-smoke-queries/*.sql` + `assert-read-only.cjs` — UNCHANGED from PR #415; +1 new read-only probe `diag-log-schemas.sql` added in Phase 0.
- **Synthetic argument ids + debate ids:** recorded in Phase (b) evidence above.
- **Synthetic debate title prefix:** `[arch-001-queue-smoke]` (routing override key).
- **Burst JSONL output:** `.claude-tmp/queue-load-smoke-retry-r3-N8.jsonl` (gitignored).
- **R3 log aggregate (operator-forwarded; this drill):** counts only — never raw log lines with unsafe fields.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads / raw MCP log lines are written to this audit or any artifact.
