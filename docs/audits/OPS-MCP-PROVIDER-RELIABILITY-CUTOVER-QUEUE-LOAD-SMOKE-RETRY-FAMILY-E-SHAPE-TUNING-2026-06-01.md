# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-FAMILY-E-SHAPE-TUNING — drill audit (2026-06-01/02) — PASS-R3-DIAGNOSTIC / FAIL-LOAD

> **Superseded for gate/pass/ramp semantics (2026-06-03).** The canonical reference for every pass / PASS-LOAD / PASS-LOAD-CONFIRM / Stage-1 / plumbing-vs-organic / ramp / dead-letter / cluster definition is `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (operator-ratified). Any pass/load/ramp/threshold language below is historical; where it differs from the canonical doc, the canonical doc governs.

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01/02 UTC (drill window crossed midnight UTC)
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY-FAMILY-E-SHAPE-TUNING
**Issue / trail:** #373 (cutover umbrella); mitigation PR #421
**Base HEAD at execution:** `edb1966` (PR #421 — Family E response-shape mitigation)
**Predecessors merged:** PR #411, #412, #413, #414, #415, #416, #417, #418, #419, #420, #421

**Scope:** Post-mitigation rerun of the smoke-tag-isolated N=8 queue-load-smoke against the same code paths that previously failed in PR #416 + #419. The mitigation (PR #421) hardened only the Family E (`argument_scheme`) user-prompt response-shape contract — no validator, no ban-list, no retry policy, no drainer-concurrency change. This drill measures whether the chronic single-family argument_scheme packet/schema cluster has been eliminated.

**Final verdict:** **PASS-R3-DIAGNOSTIC / FAIL-LOAD** — load gate failed (2/56 dead-letter; cluster recurred on TWO families); R3 classification captured cleanly from Deno Deploy logs and decisively confirms packet/schema validation as the failure mode on BOTH families (`argument_scheme` evidenceSpan.abductive_explanation_present; `critical_question` evidenceSpan.alternative_explanation_available). H1 ban-list rejection REFUTED for both (0 doctrine_ban_list co-occurrences). H2 provider-side REFUTED for both (Anthropic returned httpStatus=200 + anthropic_call_success before each validation failure). The Family E mitigation reduced `argument_scheme` dead-letters from 3 → 1 (67% reduction on E) but did NOT eliminate the `evidenceSpan.abductive_explanation_present` shape drift; a new analogous `critical_question` packet-shape failure appeared on `evidenceSpan.alternative_explanation_available`. **Stage 1 routing flip remains UNAUTHORIZED.** Family H production retry remains gated. Family I remains gated. Family J remains gated. Next operator step: mitigation cards that extend the STRICT RESPONSE-SHAPE CONTRACT pattern to (1) further harden Family E's `abductive_explanation_present` evidenceSpan path and (2) apply analogous prompt hardening to Family F's `alternative_explanation_available` evidenceSpan path.

---

## 1. Drill gate criteria (operator brief verdict rules)

- **PASS-LOAD**: 8 args / 56 cells / all 56 succeeded / 0 dead_letter / 0 failed_terminal / 0 dup-success / 0 overlap / 0 H-I-J / 0 direct-dispatch leakage / 0 non-smoke routed / no provider cluster recurrence / drainer fresh / queue returned to zero.
- **PASS-R3-DIAGNOSTIC but FAIL-LOAD**: load gate fails again but R3 classification captured and system stands down cleanly. Stage 1 remains UNAUTHORIZED.
- **FAIL**: stand-down fails, queue doesn't drain, overlap occurs, H/I/J appears, non-smoke routes, dup-success, log evidence unavailable/unsafe and needed, drainer unhealthy.

## 2. Architectural context (carried from PR #420)

- R3 emitter lives in Deno Deploy `cdiscourse-mcp-server`, NOT in any Supabase Edge Function. Logs source for Phase (d) is Deno Deploy.
- Post-#421 build deployed to Deno Deploy at `https://cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net` (operator-attested; hosted MCP smoke 23/23 PASS).
- Supabase Edge `SEMANTIC_REFEREE_MCP_URL` updated to `https://…/mcp/adapter-compat`; `SEMANTIC_REFEREE_MCP_TOKEN` rotated to match Deno Deploy `MCP_SERVER_BEARER_TOKEN`.

---

## Phase 0 — Preflight (CC read-only)

**Status:** PASS

Preflight observed UTC: `2026-06-02T00:03:00Z`.

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| HEAD on main | post-PR-421 (Family E mitigation) | `edb1966` | PASS |
| Mitigation present in source | `STRICT RESPONSE-SHAPE CONTRACT` in `mcp-server/lib/familyEPrompt.ts` | confirmed (1 match) | PASS |
| `FAMILY_E_MAX_TOKENS` | unchanged at 1500 | `export const FAMILY_E_MAX_TOKENS = 1500;` | PASS |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | `false` (pre-arm) | inferred from `preflight_routed_args_last_hour=0` | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | `0` | inferred | PASS |
| Drainer cron `arch-001-classifier-drain-tick` | active + `* * * * *` | `'true\|* * * * *'`; `drainer_job_count=1` | PASS |
| Drainer freshness | < 120s | 0.4s | PASS |
| Watchdog `cutover-health-monitor-tick` | acceptable unscheduled (per brief; Stage 1 inactive) | `monitor_job_count=0`; `monitor_active_and_schedule=null` | PASS (acceptable) |
| In-flight queue rows | 0 | `preflight_non_terminal_rows=0` | PASS |
| Routed args last hour | 0 | `preflight_routed_args_last_hour=0` | PASS |
| H/I/J production gates | `productionEnabled: false` at familyRegistry.ts:106/111/116 | confirmed | PASS |
| Tracked working tree | clean | git status returns no `M`/`A`/`D` entries | PASS |
| `.claude-tmp/queue-load-smoke-burst.cjs` exists | yes | 17,866 bytes | PASS |
| `.claude-tmp/load-smoke-queries/` exists | yes | 10 .sql + assert-read-only.cjs + diagnostics | PASS |
| Read-only assertion | exit 0 | all .sql files emit `{event:'clean'}`, EXIT 0 | PASS |

---

## Phase (a) — Arm smoke-only routing (Operator)

**Status:** PASS

| Action | Operator-attested | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` set | pre-burst arm message ("arm done") | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed 0 | confirmed in same reply | PASS |

---

## Phase (b) — Burst (one execution, operator-authorized spend)

**Status:** PASS

| Field | Value |
|---|---|
| N (synthetic args) | 8 |
| Expected Anthropic calls (N·7) | 56 |
| Burst harness invocation | exactly 1 — `node .claude-tmp/queue-load-smoke-burst.cjs 8` (output tee'd to `.claude-tmp/queue-load-smoke-retry-family-e-shape-tuning-N8.jsonl`) |
| Burst start UTC | 2026-06-02T00:14:13Z |
| Burst end UTC | 2026-06-02T00:14:18Z (~5s wall clock) |
| Exit code | 0 |
| Posted | 8 |
| Failed | 0 |
| Per-submit latency | 2635ms – 3167ms |
| Synthetic argument ids (8) | `e4c3b440-1854-400e-a500-584543090db8`, `94b5caff-7c62-45a8-a065-76a0028581c9`, `a7d0c0a6-7e1a-4f65-9921-c4d3c5f59468`, `ebcc66e0-5e69-42fe-a9bf-942ad7de2046`, `db550fd4-45d0-4058-9ee0-161c65e8a564`, `9718c3c3-7d63-48d7-8ef3-3ca575f33f09`, `c70dd58c-fcd8-4039-9a88-7a35a240dc27`, `7b3164b2-8da0-4591-99f7-c63569929525` |
| Synthetic debate ids (8) | `1584b652-a2b9-45c0-a543-f9e9c25780d9`, `a067f1c4-ffef-4de3-a5c3-4dc3fcac88cf`, `e530d773-26e9-4821-81ad-f64fac5f930b`, `c85e45b7-9330-481e-8eab-0c12364c6679`, `68a8c39a-1d53-4f8e-b8fd-79797d2e83b0`, `e156a266-11bc-43ec-b8ad-973e4fcb28a1`, `0c39887c-531b-470f-86dc-eeb63a7e1158`, `a2207861-4556-4b87-aec2-4e4f844578f6` |

---

## Phase (c) — Drain monitoring (CC read-only polls)

**Status:** Drained to terminal; cluster RECURRED in reduced-but-not-eliminated form. Gate-2 + gate-5/12 violated.

Drill window: 2026-06-02T00:14:13Z (burst start) → 2026-06-02T00:27:26Z (final terminal state; ~13 min, dominated by 4-attempt retry tail).

| Poll tick (UTC, ~t offset) | M1 | M2 non_terminal (pending / leased / retry) | Oldest pending | M3 succeeded | Notes |
|---|---|---|---|---|---|
| t+54s — 00:15:12Z | 76.84s | 20 (16/3/1) | 64.2s | 39/56 (69.64%) | drain active, 1 retry early |
| t+155s — 00:16:52Z | — | 2 (0/0/2) | null | 54/56 (96.43%) | attempt-2 retry tail; 1× argument_scheme + 1× critical_question |
| t+512s — 00:22:50Z | — | 2 (0/0/2) | null | 54/56 (96.43%) | both at attempt 3, awaiting attempt 4 |
| t+788s — 00:27:26Z (final) | — | 0 | null | 54 succeeded + 2 dead_letter = 56 | all terminal |

**Authoritative completeness (from `load-completeness.sql`):**
- `routed_arg_count_in_burst = 8`
- `expected_cell_count = 56`
- `succeeded_cells = 54`
- `dead_letter_cells = 2`
- `failed_terminal_cells = 0`
- `non_terminal_cells = 0`
- `pct_grid_coverage = 96.43%`

**Gate roll-up (queue mechanics + cluster):**

| Gate | Observed | Verdict |
|---|---|---|
| All 56 cells terminal | 54 succ + 2 dead_letter | PASS |
| Dead-letter rate ≤ 1% (operator brief PASS band) | **3.571% (2/56)** | **FAIL** (within PARTIAL/FAIL band but improved 33% vs pre-fix 5.357%) |
| `duplicate_success_cells = 0` | 0 | PASS |
| `overlapping_drain_pairs = 0` | 0 (30 drains in window) | PASS |
| M1 fresh (< 120s) | peak 76.84s | PASS |
| M2 oldest_pending_age ≤ 300s | peak 64.2s | PASS |
| Time-to-drain | ~13 min (dominated by 4-attempt retry tail) | informational |

**Per-family cluster forensics (from `load-provider-error-cluster.sql` + `diag-shape-tuning-retry.sql` poll trail):**

| Family | Dead-letter cells | failure_reason | failure_sub_reason | attempt_count at terminal |
|---|---:|---|---|---:|
| `argument_scheme` | 1 | `mcp_api_error` | `provider_server_error` | 4 (exhausted) |
| `critical_question` | 1 | `mcp_api_error` | `provider_server_error` | 4 (exhausted) |
| **Total** | **2** | — | — | — |

**Distinct families showing `provider_*` terminal failures: 2** (up from 1 in pre-fix drills — but raw cell count is down 33%).

**Material delta vs pre-fix (PR #416 + #419) on the same N=8 / same harness / same query pack:**

| Metric | PR #416/#419 (pre-fix) | This drill (post-fix) | Delta |
|---|---|---|---|
| Total dead_letter cells | 3 | 2 | **−33%** |
| Dead-letter rate | 5.357% | 3.571% | **−33%** |
| argument_scheme dead_letter | 3 | 1 | **−67%** |
| critical_question dead_letter | 0 | 1 | +1 (NEW) |
| Distinct failing families | 1 | 2 | +1 |
| 0 dup-success / 0 overlap / 0 H-I-J | yes | yes | unchanged |

**Interpretation requires Phase (d) classification** — the single-family argument_scheme cluster from PR #416/#420 has reduced sharply (3→1), but the redistribution into critical_question shifts the interpretation. The Phase (d) R3 log evidence will determine whether:
- The remaining `argument_scheme` failure is still packet/schema (validation_failed + packet_invalid) — in which case the mitigation reduced but did not eliminate the systematic shape drift; OR
- The failures shifted to a provider-side cause (api_error / timeout / network_error) — in which case the mitigation worked on packet shape and the residual is a separate provider transient affecting two families.

---

## Phase (d) — R3 log classification (OPERATOR-FORWARDED; PASS)

**Status:** PASS — classification complete from Deno Deploy `cdiscourse-mcp-server` logs.

**Access source:** Deno Deploy `cdiscourse-mcp-server` Logs (the actual MCP server runtime, per PR #420 architectural correction). NOT Supabase function_logs (which is the proxy layer and does not carry R3 emissions).

**Time window for log query:** 2026-06-02T00:14:00Z → 2026-06-02T00:28:00Z (covers burst + 4-attempt retry tail).

### `argument_scheme` (1 dead-letter cell)

| Aggregate | Count |
|---|---:|
| `boolean_observation_tool_error.reason = validation_failed` | **3** |
| `reason = api_error` | 0 |
| `reason = timeout` | 0 |
| `reason = rate_limited` | 0 |
| `reason = network_error` | 0 |
| `reason = other` | 0 |
| Co-occurrence with `boolean_observations_packet_invalid` (same `requestId`) | **3** |
| Co-occurrence with `boolean_observations_doctrine_ban_list` (same `requestId`) | **0** |
| Observed path: `evidenceSpan.abductive_explanation_present` | **3** |
| Anthropic emitted `anthropic_call_success` + `httpStatus=200` BEFORE each failure | **YES** |

`argument_scheme` requestIds (correlation ids only — no body, no prompt, no payload): `d68c1540-d704-4726-98aa-677a78cf9854`, `1633fcc6-0d78-4a9b-be81-3ead1299bc21`, `02b9e5fb-6515-432e-a8ab-913ca28f8131`.

### `critical_question` (1 dead-letter cell — NEW family)

| Aggregate | Count |
|---|---:|
| `boolean_observation_tool_error.reason = validation_failed` | **2** |
| `reason = api_error` | 0 |
| `reason = timeout` | 0 |
| `reason = rate_limited` | 0 |
| `reason = network_error` | 0 |
| `reason = other` | 0 |
| Co-occurrence with `boolean_observations_packet_invalid` (same `requestId`) | **2** |
| Co-occurrence with `boolean_observations_doctrine_ban_list` (same `requestId`) | **0** |
| Observed path: `evidenceSpan.alternative_explanation_available` | **2** |
| Anthropic emitted `anthropic_call_success` + `httpStatus=200` BEFORE each failure | **YES** |

`critical_question` requestIds: `7553d62e-c048-4ba7-8f89-5bf8ca9e1bd1`, `b4dcb143-323e-4126-a816-55b1519b631c`.

### Classification (per §1)

| Family | Classification | Mechanism |
|---|---|---|
| `argument_scheme` | **Packet/schema validation failure** | model emits non-string-non-null `evidenceSpan.abductive_explanation_present` value despite the new STRICT RESPONSE-SHAPE CONTRACT block; specific path is the same as PR #420 R3 finding |
| `critical_question` | **Packet/schema validation failure** | model emits non-string-non-null `evidenceSpan.alternative_explanation_available` value on Family F path — the analogous shape error on a different rawKey in a different family |

### RCA hypothesis verdicts (this drill)

- **H1 (ban-list rejection)**: **REFUTED for both families**. Zero `boolean_observations_doctrine_ban_list` co-occurrences in either family.
- **H2 (Anthropic provider-side instability)**: **REFUTED for both families**. Anthropic emitted `anthropic_call_success` + `httpStatus=200` BEFORE every validation failure. Zero `api_error`/`timeout`/`rate_limited`/`network_error` R3 reasons.
- **H3 (packet/schema validation)**: **CONFIRMED for both families**, NARROWED to two specific evidenceSpan rawKey paths:
  - `argument_scheme.evidenceSpan.abductive_explanation_present` (Family E)
  - `critical_question.evidenceSpan.alternative_explanation_available` (Family F)

### Verdict on the Family E mitigation (PR #421)

- **Material reduction confirmed on argument_scheme**: dead-letter count fell 3 → 1 (67% reduction on the family the mitigation targeted). Per-cell raw event count fell 9 → 3 (model-generated shape errors per failing cell reduced ~3x).
- **But residual shape drift persists** on the same `evidenceSpan.abductive_explanation_present` path. The STRICT RESPONSE-SHAPE CONTRACT block (PR #421) reduced the model's failure rate on this path but did not eliminate it.
- **Analogous failure surfaced on Family F** (`critical_question.evidenceSpan.alternative_explanation_available`). This is NOT a regression caused by PR #421 — it is a previously-masked failure that becomes visible now that E's failure rate is lower. The drill went from a 3-cell-on-1-family cluster to a 1+1-cell-on-2-families distribution; the F-family failure was likely present at low rate in earlier drills but the E-family's 3-cell cluster dominated the count.
- **Mitigation pattern is working** (probabilistic prompt-hardening reduces but does not fully eliminate model shape drift) and the same pattern is now warranted for Family F.

---

## Phase (e) — Stand down (Operator)

**Status:** PASS

| Action | Operator-attested | Verdict |
|---|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` set | 2026-06-02T01:12:09Z | PASS |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` confirmed 0 | operator-attested in stand-down message | PASS |
| Drainer cron unchanged (active + `* * * * *`) | verified in Phase (f) preflight at 01:13:04Z: `drainer_active_and_schedule = 'true\|* * * * *'`; `drainer_job_count = 1` | PASS |

---

## Phase (f) — Final inert verification (CC read-only)

**Status:** PASS — system in clean inert state post-stand-down.

Phase (f) snapshot @ 2026-06-02T01:13:04Z (≈ 55s after operator stand-down).

| Query | Expected | Observed | Verdict |
|---|---|---|---|
| Routing flag state post-drill | `false` (operator-attested) | operator-attested at 01:12:09Z; `preflight_routed_args_last_hour=8` matches exactly the 8 burst args from the drill window (zero post-stand-down routing) | PASS |
| M1 post-stand-down | < 120s | 4.5s | PASS |
| M2 post-stand-down | non_terminal = 0 | 0 (0 pending / 0 leased / 0 retry_scheduled) | PASS |
| `duplicate_success_cell_count` (drill window) | 0 | 0 | PASS |
| `direct_dispatch_leak_count` (smoke args) | 0 | 0 — all 56 cells routed via queue (`family IS NOT NULL`); load-completeness confirmed at terminal | PASS |
| `hij_rows_in_window` | 0 | 0 — only A-G families observed (`argument_scheme`, `critical_question`, and the 5 succeeded families); H/I/J unchanged | PASS |
| Non-smoke routed args in drill window | 0 | `preflight_routed_args_last_hour=8` matches drill burst args exactly (zero non-smoke leakage) | PASS |
| Drainer health post-drill | active + fresh | `drainer_active_and_schedule='true\|* * * * *'`; `drainer_job_count=1`; M1=4.5s | PASS |
| Overlap (drill window) | 0 | `overlapping_drain_pairs=0` across `drain_rows_in_window=30` | PASS |
| Watchdog cron | unscheduled (acceptable per brief; Stage 1 not active) | `monitor_job_count=0` | PASS (acceptable) |

Verdict: PASS — routing flag operator-attested back to default-off, drainer + queue mechanics all healthy, zero pending queue rows, zero non-smoke args routed, zero duplicate-success, zero direct-dispatch leakage, zero H/I/J rows. The composite drill verdict (PASS-R3-DIAGNOSTIC / FAIL-LOAD) is determined by Phase (c) gate-2 + gate-5/12 (cluster reduced but recurred on a second family) and Phase (d) decisive packet/schema classification, NOT by Phase (f) — the system stand-down is clean.

---

## Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0** by CC. The burst in Phase (b) was operator-authorized; it triggered downstream Anthropic calls via the drainer. CC issued NO direct `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **CC writes (DB):** **0**. Read-only SELECT only via `npx supabase db query --linked --file <path>`.
- **CC writes (file system):** docs/audits/<this file>; 1 new gitignored read-only diagnostic probe (`.claude-tmp/load-smoke-queries/diag-shape-tuning-retry.sql`).
- **Routing flag entry/exit state:** entered at `false` (operator-attested per PR #420 stand-down); MUST exit at `false` (Phase e).
- **Non-smoke production impact:** expected **0** — smoke-tag override + percentage=0.
- **No source / migration / runtime-flag change to main by this card.**
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / raw provider payloads / raw MCP log lines written to this audit.

## Authorizations + follow-ups

**Active verdict: PASS-R3-DIAGNOSTIC / FAIL-LOAD.**

**HALT actions completed during drill:**
- [x] `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested at 2026-06-02T01:12:09Z; verified inert by `preflight_routed_args_last_hour=8` matching exactly the 8 burst args with no post-stand-down routing).
- [x] `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` stays at `0`.
- [x] Classifier drainer active and fresh (M1=4.5s post-stand-down; `drainer_active_and_schedule='true|* * * * *'`).
- [x] No re-enable of Family H. No start of Family I. No start of Family J. No source / migration / cron / percentage changes by CC.

**Stage 1 routing flip remains UNAUTHORIZED unless this retry achieves PASS-LOAD and the operator separately authorizes Stage 1.** PASS-LOAD was NOT achieved; Stage 1 stays blocked.

**Family H production retry remains gated.**

**Family I remains gated.**

**Family J remains gated.**

**Recommended next mitigation cards (operator-gated; NOT auto-opened by this audit):**

1. **`OPS-MCP-FAMILY-E-RESPONSE-SHAPE-TUNING-PHASE-2`** — further harden Family E's prompt for `evidenceSpan.abductive_explanation_present` specifically. PR #421's STRICT RESPONSE-SHAPE CONTRACT block reduced this path's failure rate sharply (3 → 1 dead-letter cell on the same N=8 harness; 67% reduction on E) but did not eliminate it. Candidate measures:
   - Add a per-rawKey worked example showing the correct shape for `abductive_explanation_present` (string-or-null only; no nested structure), placed inline next to the rawKey's definition in `FAMILY_E_PROMPT_ENTRIES`.
   - Consider `FAMILY_E_MAX_TOKENS` bump from 1500 → 1800 (matching Family D's carve-out) as a complementary measure — the residual failure rate is now low enough that incremental token headroom may close the remaining gap.
   - Tighten the SELF-CHECK block to specifically verify `abductive_explanation_present` evidenceSpan is string-or-null before emit.
2. **`OPS-MCP-FAMILY-F-RESPONSE-SHAPE-TUNING`** — apply the analogous STRICT RESPONSE-SHAPE CONTRACT pattern to Family F (`critical_question`), with specific emphasis on the `evidenceSpan.alternative_explanation_available` path that this drill surfaced. Mirror PR #421's structure: bidirectional key-set equality across the four maps; evidenceSpan type uniformity; null for false observations; pre-emit self-check; per-rawKey reinforcement for the failing path.

**Other follow-ups (regardless of mitigation choice):**

- **RCA's R1** (jsonb `failure_detail` column on `argument_machine_observation_runs`) becomes more valuable each drill: persisting the validator's failure-path to the DB automatically would remove the dependency on operator-side Deno Deploy log pulls for future drills.
- **Cutover-health-monitor cron** remains unscheduled. Acceptable while Stage 1 inactive. When Stage 1 reconsideration is on the table, re-schedule via the existing migration that registered the cron.

**Deno Deploy deployment target note:** `mcp-server/` deploys to Deno Deploy `cdiscourse-mcp-server` (separate path from Supabase merge auto-deploy which only covers `supabase/functions/*`). The post-PR #421 build was deployed to Deno Deploy at `https://cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net` per operator confirmation (hosted smoke 23/23 PASS). The next mitigation cards above will require the same deploy step before any retry drill.
