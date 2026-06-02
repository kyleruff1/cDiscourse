# OPS-MCP-FORTIFIED-ARCHITECTURE — design (2026-06-02)

Sibling to `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`. This document is the **design rationale** for the architecture as it stands at HEAD `9ae3c7a` (PR #423). The status doc is "what is true today"; this is "why it is true and what the design constraints are".

This is not a roadmap. It does not propose new work. It codifies the contract every future card in this area must honor.

---

## 1. Problem history (compressed)

The MCP-021C edge work shipped the classifier-boolean-observations adapter (Edge Function) that calls a Deno-deployed MCP server. Family H production-enable (PR #405, Card 3 of the H chain) was attempted and failed at the post-merge smoke (PR #407): canary terminal hole on `argument_scheme`; burst spread holes across argument_scheme + critical_question + disagreement_axis + claim_clarity; 7 `mcp_api_error` events dispersed across 4 distinct families.

The interpretation at the time read as "provider/server reliability resurfacing at 8-family concurrency profile". PR #408 surgically rolled back H production enablement (1-char change to `familyRegistry.ts:106`) while preserving Card 1 server admin-validation files, Card 2 L5 audit-lint entries, and Card 3 docs.

The recovery chain shipped:

- PR #411 — `cutover-health-monitor` alerting Edge Function + classifier with split-literal secret patterns + 40 Jest tests + runbook.
- PR #412 — rollback rehearsal prep (drill runbook + audit skeleton).
- PR #413 — explicit `ADMIN_NOTIFICATION_TO` env + 8 granular `emailStatus` values on the monitor.
- PR #414 — live rollback rehearsal **PASS**.
- PR #415 — queue-load-smoke prep (burst harness + query pack + audit skeleton).
- PR #416 — queue-load-smoke **FAIL** (3/56 dead-letter; 5.357% rate; single-family `argument_scheme` cluster).
- PR #417 — read-only RCA naming H1/H2/H3 hypotheses.
- PR #418 — **R3 structured isError logging** in `mcp-server/tools/classifyArgumentBooleanObservations.ts`.
- PR #419 — retry initially incomplete on R3 log classification (operator forwarded the wrong log source).
- PR #420 — R3 classification completed **from Deno Deploy logs** (Supabase function_logs returned zero rows because the R3 emitter lives in Deno Deploy `cdiscourse-mcp-server`, not in the Edge Function proxy). Architectural correction landed.
- PR #421 — Family E STRICT RESPONSE-SHAPE CONTRACT (5 rules) on `argument_scheme`'s user prompt.
- PR #422 — post-#421 retry **PASS-R3-DIAGNOSTIC / FAIL-LOAD**: E reduced 3 → 1; F surfaced 0 → 1; both packet/schema validation failures.
- PR #423 — Families E + F: E rule 6 RAWKEY-SHAPE REINFORCEMENT for `evidenceSpan.abductive_explanation_present`; F full STRICT block + rule 6 for `evidenceSpan.alternative_explanation_available`.

The decisive epistemic shift was PR #420: R3 logs proved that `argument_scheme`'s recurring `mcp_api_error / provider_server_error` was actually **packet/schema validation failure** post-Phase-3 hardening of the Edge MCP adapter, NOT provider 5xx. Anthropic returned `httpStatus=200` + `anthropic_call_success` BEFORE every validation failure. H1 (ban-list) and H2 (provider-side) were refuted; H3 (packet/schema) was confirmed.

---

## 2. The fortified architecture today

```
                ┌─────────────────────────────────────────────────────────┐
                │                  CLIENT (Expo + RN)                     │
                │   src/ + app/ — never calls AI or service-role          │
                └──────────────────────────┬──────────────────────────────┘
                                           │
                            POST submit-argument
                                           │
                ┌──────────────────────────▼──────────────────────────────┐
                │  SUPABASE EDGE FUNCTION: submit-argument                │
                │  - validates input via rules engine (sole acceptance    │
                │    gate per cdiscourse-doctrine)                        │
                │  - inserts the arg via service-role                     │
                │  - branches on classifier queue routing:                │
                │    if (CLASSIFIER_QUEUE_ROUTING_ENABLED='true' AND      │
                │        (smoke-tag prefix OR hash(argId)%100 < %)) {     │
                │      enqueueClassifierJobs(7 cells, A-G)                │
                │    } else {                                             │
                │      dispatchAutoTriggerForArgument(...) [direct]       │
                │    }                                                    │
                │  - submit returns 201 nonblocking; arg is accepted      │
                │    regardless of classifier outcome (doctrine)          │
                └──┬─────────────────────────────────┬─────────────────────┘
                   │ (queue path)                    │ (direct-dispatch path)
                   ▼                                 ▼
   ┌─────────────────────────────┐    ┌─────────────────────────────────┐
   │ argument_machine_observation │    │ Edge Function:                   │
   │ _runs (queue table; Card 1)  │    │ classify-argument-boolean-       │
   └──────────────┬───────────────┘    │ observations (Edge proxy)        │
                  │                    └──────────────┬───────────────────┘
                  │ pg_cron @ * * * * *              │
                  │                                  │
   ┌──────────────▼─────────────────────────────────▼──────────────────┐
   │ Edge Function: classifier-drainer (ARCH-001 Card 2)               │
   │ - acquire_drain_lease (single-flight, 130s TTL)                   │
   │ - claim_classifier_jobs (batch 20)                                │
   │ - per cell: runBooleanObservationMcpAdapter(family, …)            │
   │   - reads SEMANTIC_REFEREE_MCP_URL from Supabase secrets          │
   │   - POSTs to <deno-deploy>/mcp/adapter-compat                     │
   │   - Bearer auth via SEMANTIC_REFEREE_MCP_TOKEN                    │
   │   - Phase-3 hardening: ANY {isError} envelope → mcp_api_error /   │
   │     provider_server_error                                         │
   │ - finalize_classifier_job (atomic; ARCH-001 Card 2A)              │
   │ - retry policy: [30, 120]s backoff; MAX_ATTEMPTS=4                │
   │ - bounded provider concurrency: C=3; T=90s wall-clock             │
   └──────────────────────────────┬────────────────────────────────────┘
                                  │ HTTPS POST /mcp/adapter-compat
                                  ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │ DENO DEPLOY: cdiscourse-mcp-server                                 │
   │ (https://cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net)│
   │                                                                    │
   │ mcp-server/main.ts → mcp-server/tools/                             │
   │   classifyArgumentBooleanObservations.ts (PR #418 R3 emitter here) │
   │                                                                    │
   │ Per family A-H: route through                                      │
   │   familyXAnthropic.ts → callAnthropic()                            │
   │   → real Anthropic API (claude-haiku-4-5)                          │
   │                                                                    │
   │ Then validateMcpBooleanObservationResponse (schema mirror)         │
   │   → if invalid: errorResult(...) → boolean_observation_tool_error  │
   │   → if valid: ban-list scan (per-family)                           │
   │     → if banned: errorResult(...) → tool_error + ban_list event    │
   │     → if clean: return packet                                      │
   │                                                                    │
   │ R3 emission allowlist (PR #418): event, level, ts, tool, reason,   │
   │ family, requestId, mode, schemaVersion, classifierSetVersion,      │
   │ serverName, path, status. NEVER body, prompt, payload, secrets.    │
   └────────────────────────────────────────────────────────────────────┘
```

Component summary:

- **Client**: never AI, never service-role. Per cdiscourse-doctrine §7.
- **Edge submit-argument**: acceptance gate is the pure rules engine (`src/lib/constitution/engine.ts`). Classifiers run AFTER storage and never block. Queue routing is operator-gated default-off.
- **Queue (ARCH-001)**: Postgres-backed; cron-drained; single-flight lease; bounded concurrency; atomic finalize; idempotent enqueue via partial unique indexes; per-family retry policy on transient classes.
- **Edge classifier-drainer**: drains the queue, calls the MCP server, persists results, never logs secrets.
- **Edge classify-argument-boolean-observations**: thin proxy/adapter; not the host of R3 logging.
- **MCP server on Deno Deploy**: this is the host of the tool handlers, the family prompts, the validators, the ban-list scanners, and the R3 `boolean_observation_tool_error` emitter. Deployed separately from Supabase Edge.

### Cutover state — 2026-06-02

This dated note records the live cutover posture so the diagram above is read against current reality. It changes no design constraint; the binding contract in §3 is unaffected.

- **Stage 1 is ARMED at 1%.** `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` and `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`, armed `2026-06-02T07:50:54Z`. The queue (left) path of the diagram is now live for ~1% of submissions plus all smoke-tagged submissions; the direct-dispatch (right) path remains the route for the other ~99%. Production families on the queue path are A–G only (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`); H/I/J remain `productionEnabled: false` in the family registry and emit zero rows.
- **The 24h observation window is OPEN.** It closes no earlier than `2026-06-03T07:50:54Z`. This note does NOT assert the window closed and issues no `PASS-STAGE-1` verdict; that determination is reserved for the Stage-1 observing audit after the window elapses.
- **Organic 1% traffic so far: ZERO.** At the live checkpoint `2026-06-02T09:10:42Z`, routed args since arm = 10 and ALL were smoke-tagged; non-smoke (organic) routed args = 0. H/I/J rows since arm = 0; M2 non-terminal = 0 (idle/empty); M1 staleness is idle-empty, not stuck (M1 staleness is an alert only when paired with M2 > 0). The `cutover-health-monitor` is healthy (0-fail across its recent runs). Gate-bearing organic 1% evidence has therefore not yet accrued.
- **Synthetic launch-qualification landed PARTIAL** (PR #429, merged `a9602b9` — `OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION`). Because organic traffic at 1% is effectively absent at low volume, qualification was proven synthetically under live-1% conditions:
  - **Canary N=1** (argId `459e9530-…`): 7/7 A–G clean, family-set (`family IS NOT NULL`), 0 legacy `family = NULL` rows, 0 H/I/J, first-attempt. Routing-path verification per §3.7 held.
  - **Burst N=8** (56 cells): 55 succeeded + 1 `dead_letter`. The single dead_letter is argId `9ef5aab5-…`, family `critical_question` (F), attempt 4, `retry_attempts_exhausted` on a provider-side `provider_server_error` (provider 5xx) — one isolated cell, NOT a packet/schema cluster and NOT a repeat of the §3.4 shape failures.
  - **`argument_scheme` (E) was 8/8 clean** in this burst — the family that drove the original FAIL-LOAD drill. The PR #421/#423 STRICT RESPONSE-SHAPE CONTRACT mitigation (§3.4) **held under live 1%**.
  - **All structural gates green**: `duplicate_success = 0`, `overlapping_drain_pairs = 0`, `family = NULL = 0`, H/I/J = 0, M1 < 120s during active drain, M2 drained to 0, monitor healthy.
- **Predecessor synthetic drills** that gated the arm: PR #425 (PASS-LOAD, 56/56, 0 dead-letter) and PR #426 (PASS-LOAD-CONFIRM, second consecutive 56/56) — the two-consecutive prerequisite of §5.
- **Production build in service:** Deno Deploy `cdiscourse-mcp-server` build `qrvrmvp6qqhn` from `d2d436a`, carrying the #421/#423 mitigation. Deployment separation per §4 is unchanged (`mcp-server/` → Deno Deploy; `supabase/functions/` + migrations → Supabase auto-deploy).
- **The single Family-F dead_letter is the open thread.** It is provider-side, not shape — it does NOT trigger the §3.4 packet/schema mitigation template (H2-class, not H3-class). It is tracked as the recommended next card in §6, separately from the observation-window close.

The 5% step is **not** reached by this state. It remains a separate, operator-gated step (§5); no audit or doc advances the percentage.

---

## 3. Design principles (binding)

These are the rules every future card in this area must honor.

### 3.1 The strict validator stays strict.

`validateMcpBooleanObservationResponse` (`mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`) is the structural contract between the model and the system. It enforces:

- bidirectional key-set equality across `observations`, `confidence`, `evidenceSpan`
- `observations.keys ⊆ checkedRawKeys` (one-way containment)
- `evidenceSpan` values are string ≤ 240 chars OR null only
- `observations` boolean only; `confidence` in {low, medium, high} only
- `modelInfo.provider = 'mcp'`; `serverName` non-empty; `classifierSetVersion` non-empty
- `MAX_FLAGS_PER_RESPONSE = 20`

**Never loosen the validator to tolerate model drift.** The PR #421 + #423 mitigation pattern is to harden the prompt to meet the validator, not the reverse. Loosening would mask future shape regressions and could create ban-list-bypass paths.

### 3.2 Ban-lists stay strict.

`familyXBanListScan.ts` for each family enforces the doctrine constraint that classifier output never carries verdict tokens. Even when an R3 classification refutes ban-list rejection for a specific drill (as PR #420 / #422 did for both E and F), the **ban-list pattern set is binding** and not to be relaxed. The PR #423 mitigation included tests that scan the new prompt blocks for banned tokens precisely to keep the prompt hardening doctrine-clean.

### 3.3 Prompt hardening is probabilistic and must be measured by drill.

The STRICT RESPONSE-SHAPE CONTRACT pattern reduced E's failure rate by 67% (3 → 1) in PR #422's measurement. It did not eliminate. The card brief language for this pattern is **"materially reduce, not eliminate"** — and the drill is the source of truth for whether the reduction is within budget.

Wording discipline carried verbatim from PR #422 §1: _response-shape validation confirmed; token-budget pressure remains a possible contributor._ Do NOT claim "token budget confirmed" without a drill that varies it.

### 3.4 Packet/schema clusters are mitigated per family and per rawKey path.

The pattern that works:

1. **Diagnose** the cluster via R3 logs (Deno Deploy `cdiscourse-mcp-server` logs, not Supabase function_logs).
2. **Confirm H3** via co-occurrence of `boolean_observation_tool_error.reason=validation_failed` with `boolean_observations_packet_invalid`.
3. **Refute H1** (ban-list) via zero `boolean_observations_doctrine_ban_list` co-occurrence.
4. **Refute H2** (provider-side) via `anthropic_call_success` + `httpStatus=200` before each failure.
5. **Identify the specific path** (`evidenceSpan.<rawKey>` or `checkedRawKeys`).
6. **Apply STRICT RESPONSE-SHAPE CONTRACT** to the family's user prompt (if not already present from a prior mitigation).
7. **Add per-rawKey RAWKEY-SHAPE REINFORCEMENT** naming the specific failing path, enumerating allowed (string ≤ 240 OR null) and forbidden (object/array/boolean/number/missing) shapes.
8. **Test with teeth**: prompt source-scan tests that fail if the block is removed; validator regression tests that pin both `result.ok === false` AND the exact `result.path`.
9. **Preserve everything else byte-equal**: validator, ban-lists, key files, system prompts, MAX_TOKENS, familyRegistry, drainer constants, retry policy, migrations, runtime flags, package.json.
10. **Deno Deploy push after merge** before any retry drill, then arm the drill via the **canary-then-burst sequence** (§3.7) so the N=8 evidence is valid.

This procedure is the operational template for any future packet/schema cluster on any family.

### 3.5 Deno Deploy logs are authoritative for MCP-server-side observability.

The R3 emitter lives in Deno Deploy. Operator-side log queries against Supabase `function_logs` will return zero rows for `boolean_observation_tool_error` events. Always pull from Deno Deploy `cdiscourse-mcp-server` Logs for MCP-side classification (PR #420's correction).

Forwarded log aggregates from the operator must be **counts only** with allowlisted fields per the R3 emitter spec (event, reason, family, requestId, mode, path, status). Raw lines must never carry body, prompt, payload, or secrets.

### 3.6 DB persistence of `failure_detail` remains a valuable future improvement (RCA's R1).

The queue table `public.argument_machine_observation_runs` carries `failure_reason`, `failure_sub_reason`, `dead_letter_reason` as opaque text. The Edge MCP adapter computes a structured `BooleanObservationFailureDetail` (`serverReason`, `path`, `receivedKeys`, `validatorReason`) but discards it before persistence.

Adding a jsonb `failure_detail` column would persist the inner classification automatically per cell, removing the dependency on operator-side Deno Deploy log pulls for every drill. This was scoped as RCA probe R1 (`docs/rca/OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA-2026-06-01.md`); it has not been implemented and is not blocking the current chain.

### 3.7 Canary-then-burst arming discipline (binding for every queue-routing drill).

**Origin.** During the PR #426 confirmatory drill, the operator armed routing (`CLASSIFIER_QUEUE_ROUTING_ENABLED=true`) and reported "arm done", but the first N=8 burst nonetheless took the **legacy direct-dispatch path** — all 58 resulting `argument_machine_observation_runs` rows had `family = NULL` instead of the expected `family IS NOT NULL` queue rows. The routing flag had not actually propagated to the Edge runtime at burst time. The misfire wasted the operator-authorized burst spend (still ~58 Anthropic calls, just on the wrong path) and produced no gate-bearing queue evidence.

The lesson: **Supabase Edge env-var propagation is non-deterministic on the order of a minute or more, and `npx supabase secrets list` confirming the value is set is necessary but not sufficient** to prove the flag is live in the running Edge isolate. A behavioral verification is required before committing the full N=8 spend.

**The binding arming sequence** (applies to queue-load-smoke, confirmatory smoke, AND Stage 1 ramp drills):

1. **Operator sets** the routing env vars with a Supabase **account PAT** (`SUPABASE_ACCESS_TOKEN`, NOT anon, NOT service-role, NOT db password — see §4 + status doc §4):
   - `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`
   - `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=<0 for smoke; 1 for Stage-1>`
2. **Operator verifies** via `npx supabase secrets list` AND **waits ≥ 120 seconds** for Edge propagation.
3. **CC runs an N=1 canary** burst through the existing smoke-tag harness (`node .claude-tmp/queue-load-smoke-burst.cjs 1`).
4. **CC inspects the canary's cells** with a read-only query scoped to the canary argId:
   - PASS condition: exactly 7 A-G queue rows, **all `family IS NOT NULL`** (queue path), **zero H/I/J rows**. (A single cell in `retry_scheduled` at first inspection is an expected transient and recovers — it does not fail the canary.)
   - HALT condition: any row with `family = NULL` → routing did NOT propagate → **HALT; do NOT run the N=8 burst**. Surface the diagnosis, ask the operator to re-verify/re-set the flag, and re-canary.
5. **Only after the canary confirms `family IS NOT NULL`** does CC run the gate-bearing N=8 burst.
6. The canary's cells are **informational, not gate-bearing**. The N=8 burst's cells are the gate-bearing evidence; the canary is purely a routing-path verification gate.

**Two binding clarifications:**

- **The canary is NOT a substitute for N=8.** It is only a routing-path verification gate. PASS-LOAD / PASS-LOAD-CONFIRM / PASS-STAGE-1 verdicts are evaluated against the N=8 burst's 56 cells, never against the canary's 7.
- **The N=8 burst is gate-bearing only if the canary confirmed `family IS NOT NULL` queue rows.** An N=8 burst that runs without a passing canary first (as the PR #426 first burst did) produces no valid gate evidence and must be discarded.

The canary-then-burst flow has its own dedicated runbook audit: `docs/audits/OPS-MCP-CANARY-THEN-BURST-RUNBOOK-2026-06-02.md`.

---

## 4. Deployment separation (the load-bearing operational fact)

**Supabase Edge auto-deploy and Deno Deploy push are separate operations.**

| Surface | What merge-to-main does | What operator must do additionally |
|---|---|---|
| `supabase/functions/*` | Supabase GitHub integration auto-redeploys all Edge Functions | Nothing (verify via `supabase functions list`) |
| `supabase/migrations/*` | Supabase GitHub integration auto-applies | Nothing (verify via `supabase db status`) |
| `mcp-server/*` | **Nothing** | Push to Deno Deploy `cdiscourse-mcp-server` via `deployctl` or the Deno Deploy GitHub integration configured on the Deno Deploy dashboard (operator's choice) |
| `src/*` + `app/*` | Nothing automatic | Expo client deploy handled separately (out of scope for this design) |

PR #420 noted this as an architectural correction after PR #419's first incorrect attribution. PR #422 confirmed the operator's manual Deno Deploy push between PR #421 merge and the post-mitigation retry was the load-bearing step. PR #423 carries the same requirement.

**Acceptance signal that the Deno Deploy push succeeded**: hosted MCP smoke (`scripts/mcp-server-001-smoke.sh`) returns 23/23 PASS exit 0 against the live URL. The smoke includes Family A through H tool-call checks; any new mcp-server change that breaks tool dispatch will surface here.

---

## 5. Decision gates (binding sequence)

| Gate | Achieved by | Authorized next step |
|---|---|---|
| PASS-R3-DIAGNOSTIC | drill produces enough R3 log evidence to classify cluster cause | classify, write mitigation card, NOT Stage 1 |
| PASS-LOAD | all N·7 cells succeed AND no provider/server cluster recurrence AND queue mechanics gates all PASS | operator separately decides Stage 1 reconsideration |
| Stage 1 reconsideration | operator decision conditional on PASS-LOAD (PR #425 + #426) | small percentage routing ramp via `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` (NOT in this card chain) |
| **Stage 1 arm (1%) — DONE 2026-06-02T07:50:54Z** | operator armed `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` + `…_PERCENTAGE=1` after the two PASS-LOAD drills, then synthetic launch-qualification landed PARTIAL (PR #429) | **Observe the 24h window (closes ≥ 2026-06-03T07:50:54Z), then a Stage-1 observing audit issues PASS/HOLD. NO doc auto-advances from here.** |
| **5% ramp** | a SEPARATE operator-gated step, NOT auto-advanced by any audit; ideally preceded by real organic 1% evidence (organic routed traffic was still 0 at the 2026-06-02T09:10:42Z checkpoint) AND a clean window-close determination | operator raises `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` 1 → 5 in its own card; never inside an audit |
| Family H production retry | PASS-LOAD on a non-H drill PLUS separate operator decision | re-flip `claim_clarity` `productionEnabled: false → true` in `familyRegistry.ts:106` |
| Family I production | scoping → design → implementation, all gated | NEVER auto-enabled |
| Family J production | scoping only | NEVER auto-enabled |

`PASS-R3-DIAGNOSTIC` alone is NEVER `PASS-LOAD`. The current chain (PR #422) explicitly distinguishes these. No future card may conflate them.

**Reproducibility note (PR #425 + #426).** PASS-LOAD was first achieved in PR #425 (56/56 queue cells, 0 dead-letter) and confirmed in PR #426 (PASS-LOAD-CONFIRM, second consecutive 56/56). Two consecutive PASS-LOAD drills satisfy the PASS-LOAD prerequisite for Stage 1 *reconsideration* — but reconsideration is still a SEPARATE operator-gated card (`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1`), and any arming inside it MUST follow the canary-then-burst discipline (§3.7). No audit auto-flips the routing flag.

**Arm note (2026-06-02).** That reconsideration card armed Stage 1 at 1% on `2026-06-02T07:50:54Z` following the §3.7 canary-then-burst discipline, and PR #429 then landed a PARTIAL synthetic launch-qualification under live 1% (see §2 "Cutover state — 2026-06-02"). The arm did NOT advance any further: the 24h observation window is OPEN and gate-bearing organic 1% evidence had not yet accrued (organic routed traffic = 0 at the `2026-06-02T09:10:42Z` checkpoint). The next percentage move (1 → 5) is a distinct operator-gated step and is never reached by an audit or a doc — see the **5% ramp** row above.

---

## 6. Recommended next card

**Updated 2026-06-02.** The queue-load-smoke retry that this section previously recommended has since run (PASS-LOAD in PR #425, PASS-LOAD-CONFIRM in PR #426), Stage 1 is now ARMED at 1%, and PR #429 landed a PARTIAL synthetic launch-qualification (see §2 "Cutover state — 2026-06-02"). The two live-state successors are:

1. **Close the 24h Stage-1 observation window.** It is OPEN until ≥ `2026-06-03T07:50:54Z`. After it elapses, a Stage-1 observing audit reads the cutover-health metrics and the routed-row counts and issues PASS/HOLD. Because organic routed traffic was 0 at the `2026-06-02T09:10:42Z` checkpoint, that audit should explicitly note whether any organic 1% evidence accrued before treating the window as informative — this is the gate that precedes any 5% proposal (§5).
2. **Resolve the open Family-F dead_letter follow-up.** The single isolated `critical_question` (F) dead_letter from the PR #429 burst (argId `9ef5aab5-…`, attempt 4, `retry_attempts_exhausted` on provider-side `provider_server_error`) is a provider-side (H2-class) event, NOT a packet/schema (H3-class) cluster, so it does NOT invoke the §3.4 mitigation template. The follow-up card should confirm via R3 logs that no co-occurring `validation_failed` exists, decide whether one isolated provider 5xx at N=8 is within budget, and — if recurrence appears — consider the fixture-mode partition (RCA's R4) rather than a prompt change.

Two companion roadmap docs authored alongside this catch-up frame the broader forward plan; both describe FUTURE, separately operator-gated steps as proposals, never as done or auto-advancing:

- `docs/roadmap-expansions/2026-06-02-mcp-families-a-g-stability-roadmap.md` — A–G stability hardening proposals (e.g. the RCA R1 `failure_detail` jsonb persistence in §3.6, per-family shape-floor tracking, and the 1% → 5% ramp preconditions).
- `docs/roadmap-expansions/2026-06-02-mcp-families-h-i-j-integration-roadmap.md` — the gated path to integrating H/I/J (`claim_clarity`, `thread_topology`, `sensitive_composer`), which remain `productionEnabled: false`; this is scoping/design only and re-enables nothing.

If a future packet/schema retry is still needed on A–G, the historical retry harness comparison remains valid:

`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY` (operator-gated; same N=8 burst harness + same query pack as PR #416 / #419 / #422). Compare per-family dead-letter rates against PR #422 baseline:

- argument_scheme: 1 dead-letter cell (path `evidenceSpan.abductive_explanation_present`)
- critical_question: 1 dead-letter cell (path `evidenceSpan.alternative_explanation_available`)
- 2/56 dead-letter (3.571%)

Possible outcomes:

| Drill outcome | Interpretation | Next operator step |
|---|---|---|
| Both families further reduce | PR #423 pattern continues to work; iterate if any new path surfaces | Repeat mitigation on the new path; or move toward Stage 1 if cluster eliminated |
| Both families stay at ~1 each | Mitigation pattern has a floor; revisit token-budget hypothesis or R1 DB persistence | Targeted Phase-2 prompt tuning or R1 follow-up |
| New family surfaces | Mitigation pattern applies to the new family analogously | Open `OPS-MCP-FAMILY-<X>-RESPONSE-SHAPE-TUNING` |
| Provider-side error appears | New investigation; H2 was refuted for E/F historically but the next drill is a separate experiment | R3 classification; possibly fixture-mode partition (RCA's R4) |
| PASS-LOAD | Zero cluster | Operator separately decides Stage 1 reconsideration |

---

## 7. Out of scope (do not propose in any card descended from this design)

- Loosening the validator.
- Loosening any ban-list.
- Re-enabling H production without going through the gate sequence.
- Enabling I or J in any form.
- Production routing percentage > 0 without separate operator authorization.
- Changes to drainer concurrency C, retry backoff, MAX_ATTEMPTS, lease TTL, or per-isolate cap.
- Changes to migration history (always append, never edit applied).
- Changes to `familyRegistry.ts` production gates without a dedicated operator card.

---

## 8. Provenance

This design doc is docs-only codification. Created in PR (TBD via PR #424 — see audit `docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md`). No runtime change. Reflects the architecture as of HEAD `9ae3c7a` (PR #423 merged 2026-06-02T01:35:36Z).
