# CDiscourse — MCP families A-G queue-routing stability roadmap (2026-06-02)

**Card:** OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP
**Type:** Authoring-only roadmap. No production code, no migration, no validator/prompt/registry/secret change, no provider/MCP/network call, no DB query, no env or cron mutation, no percentage advance. This document is a planning artifact: it describes a sequence of **future, separately operator-authorized** gated steps as **PROPOSALS**. It authorizes nothing by being merged.
**Purpose:** Lay out the honest path to scale classifier **queue routing** for the production-enabled families **A-G** beyond the current 1%, with each step gated on its own operator authorization, its own observation window, and (ideally) real organic routed evidence from the prior step first.

**Scope boundary (binding on this doc):** This roadmap covers **only** the A-G queue-routing percentage ramp (1% → 5% → higher). It does **not** cover, propose advancing, or describe enabling families **H/I/J** (`claim_clarity`, `thread_topology`, `sensitive_composer`) — those remain `productionEnabled: false` in the family registry and are out of scope for this track entirely (§9). It does not close the Stage-1 observation window, does not issue `PASS-STAGE-1`, and does not advance the percentage.

---

## Companion documents

- [`docs/roadmap-expansions/2026-05-20-mcp-integration-readiness-roadmap.md`](2026-05-20-mcp-integration-readiness-roadmap.md) — house-style precedent: a staged readiness roadmap whose live step is explicitly **NOT** filed and is gated behind a separate operator decision. This document follows the same discipline for the percentage ramp.
- [`docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md`](../audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md) — the Stage-1 audit (status **OBSERVING**), including the §0 low-traffic interpretation rule and the §6 rollback criteria.
- [`docs/audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md`](../audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md) — the named synthetic qualification (verdict **PARTIAL-SYNTHETIC-LAUNCH-QUALIFICATION**), including the §5 typed analysis of the lone dead-letter.
- **Stage-1 automation (existing):** `scripts/ops/stage1/{arm-stage1-1pct,disarm-stage1,check-operator-secrets,verify-crons-and-queue}.sh`.
- **Stage-1 read-only gate probes (added by this card):** `scripts/ops-stage1-sql/*.sql` (read-only `SELECT`s) and their `scripts/ops/stage1/gate-*.sh` wrappers (§5.4, §6.4).
- **Drainer:** ARCH-001 bounded drainer (`arch-001-classifier-drain-tick` cron) over `public.argument_machine_observation_runs`; concurrency `C=3`, `MAX_ATTEMPTS=4`, backoff `[30,120]s`, lease TTL `130s`.
- **Monitor:** `cutover-health-monitor` Edge Function, cron `*/5`, 6 alert conditions, `cutover_health_metrics()` RPC, Layer 1/2/3 watchdog.

---

## 1. Executive summary

Queue routing for the production-enabled families **A-G** (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`) is **armed at 1%** (`CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`, armed `2026-06-02T07:50:54Z`). The Stage-1 24h observation window is **OPEN** (closes ≥ `2026-06-03T07:50:54Z`).

Three independent lines of evidence exist today, and they say three different, honest things:

1. **Synthetic concurrent-load evidence is strong.** Two predecessor PASS-LOAD drills (PR #425: 56/56, 0 dead-letter; PR #426: PASS-LOAD-CONFIRM, second consecutive 56/56) plus a live-1% synthetic qualification (canary 7/7 clean; burst 55/56 + 1 isolated provider-side dead-letter) show the ARCH-001 queue substrate handles a concurrent A-G fan-out with idempotency, single-flight leasing, and routing isolation intact. The historically-failing `argument_scheme` (E) family — the one that caused the original FAIL-LOAD drill — was **8/8 clean** under live 1%, confirming the PR #421/#423 STRICT RESPONSE-SHAPE CONTRACT mitigation holds under load.
2. **Real organic load evidence does not exist yet.** As of the `2026-06-02T09:10:42Z` checkpoint, `routed_args_since_arm = 10`, **all 10 smoke-tagged**, `non_smoke_routed_args = 0` — **zero organic cells have routed**. The product is pre-launch / low-volume; nothing organic has hashed into the 1% bucket. A zero-organic window proves plumbing + observability + rollback + inertness, **not** real organic load handling.
3. **One open follow-up.** A single isolated provider-side `dead_letter` (argId `9ef5aab5-…`, family `critical_question` (F), attempt 4, `retry_attempts_exhausted` / `provider_server_error`) is within dead-letter budget but carries an honest residual ambiguity: from queue metadata alone it cannot be 100% distinguished from an F packet-shape edge that the provider rejected. §7 lays out the read-only disambiguation and the conditional mitigation. **(RESOLVED 2026-06-02: the §7 disambiguation confirmed a packet-shape residual on `evidenceSpan.unstated_assumption`, not provider-side — see the § 7 DISPOSITION block.)**

This roadmap therefore proposes a **conservative, evidence-led percentage ramp** — `1% → 5% → higher` — where **each step is its own operator-authorized card** with its own observation window, and where the strong preference is that **real organic routed evidence at the prior percentage is observed and handled within budget before the next step is authorized**. It defines, per gate, the exact evidence required; the dead-letter budget thinking that separates a tolerable isolated provider 5xx from a HALT-worthy cluster or routing leak; the disposition of the Family-F follow-up; and the explicit non-goals (no auto-advance; no H/I/J).

**Nothing here advances the percentage. Every ramp step below is a PROPOSAL requiring separate, explicit operator authorization.**

---

## 2. Current state (verified)

Verified against the two Stage-1 audits, the family registry (`supabase/functions/_shared/booleanObservations/familyRegistry.ts`), the latency SQL precedent (`scripts/ops-latency-sql/`), and the cutover facts captured 2026-06-02.

### 2.1 Arm state

| Field | Value |
|---|---|
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | `true` |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | `1` (1% only) |
| Armed | `2026-06-02T07:50:54Z` |
| Stage-1 24h window | **OPEN** — closes ≥ `2026-06-03T07:50:54Z` |
| Deno Deploy production build | `qrvrmvp6qqhn` from `d2d436a` (carries the PR #421/#423 mitigation) |

Deploy split (unchanged by this roadmap): `mcp-server/` → Deno Deploy `cdiscourse-mcp-server`; `supabase/functions/` → Supabase merge auto-deploy.

### 2.2 Production families (A-G) vs gated families (H/I/J)

| Family | Key | `productionEnabled` | In this track? |
|---|---|---|---|
| A | `parent_relation` | `true` | ✅ yes |
| B | `disagreement_axis` | `true` | ✅ yes |
| C | `misunderstanding_repair` | `true` | ✅ yes |
| D | `evidence_source_chain` | `true` | ✅ yes |
| E | `argument_scheme` | `true` | ✅ yes |
| F | `critical_question` | `true` | ✅ yes |
| G | `resolution_progress` | `true` | ✅ yes |
| H | `claim_clarity` | **`false`** | ❌ out of scope (§9) |
| I | `thread_topology` | **`false`** | ❌ out of scope (§9) |
| J | `sensitive_composer` | **`false`** | ❌ out of scope (§9) |

A routing row carries `family IS NOT NULL`; a legacy direct-dispatch row carries `family = NULL`. The smoke-tag override is `public.debates.title LIKE '[arch-001-queue-smoke]%'` (join `public.debates` on `debate_id`); it routes independent of `PERCENTAGE`, which is why synthetic bursts are a live end-to-end health check rather than an exercise of the organic 1%-hash path.

### 2.3 Evidence inventory

| Evidence | Source | What it shows | What it does NOT show |
|---|---|---|---|
| PASS-LOAD drill (PR #425) | synthetic N=8 | 56/56 succeeded, 0 dead-letter | organic load |
| PASS-LOAD-CONFIRM (PR #426) | synthetic N=8 | second consecutive 56/56 | organic load |
| Synthetic launch-qualification (PR #429) | live-1% N=1 canary + N=8 burst | canary 7/7 first-attempt; burst 55/56 + 1 isolated DL; E 8/8 clean; all structural gates green | organic load; provider-vs-packet certainty on the 1 DL *(since resolved — packet-shape residual; see § 7 DISPOSITION)* |
| Stage-1 window (OBSERVING) | live 1% | plumbing + observability + rollback + inertness with the flag on | organic load (`non_smoke_routed_args = 0`) |

### 2.4 Live observation checkpoint (`2026-06-02T09:10:42Z`)

| Metric | Value | Reading |
|---|---|---|
| `routed_args_since_arm` | 10 | all smoke-tagged |
| `non_smoke_routed_args` | **0** | zero organic |
| `hij_rows_since_arm` | 0 | no H/I/J leakage |
| `m2_non_terminal` | 0 | queue idle / drained |
| `m1_since_last_drain` | ~35 min | **IDLE-EMPTY, not stuck** — M1 staleness is an alert ONLY when paired with `M2 > 0` |
| monitor | 0 fail / 3 success / 15 min | healthy |
| window remaining | ~22.7h | OPEN |

**Interpretation rule (carried from the Stage-1 audit §0):** an idle-empty drainer (`M1` stale **and** `M2 = 0`) is healthy inertness, not a stall. The drainer is alert-worthy only when `M1` is stale **while** `M2 > 0` (work present but not progressing).

---

## 3. The gate sequence (`1% → 5% → higher`) — PROPOSAL

Each step below is a **separate operator-authorized card**. No step auto-advances from the previous one; an audit reaching a clean verdict at one percentage does **not** grant the next percentage (this is the same discipline the Stage-1 audit states: "PASS-STAGE-1, when reached, does NOT auto-advance to 5%").

```
   Gate 0 — NOW: 1% armed, Stage-1 window OPEN (closes >= 2026-06-03T07:50:54Z)
   ┌───────────────────────────────────────────────────────────────┐
   │ Synthetic: PARTIAL qualification (1 isolated provider DL).     │
   │ Organic: ZERO routed so far. Window still observing.           │
   └───────────────────────────────┬───────────────────────────────┘
                                    │  operator authorizes Gate 1 (separate card)
                                    ▼
   Gate 1 — close Stage-1 1% window  ✋ SEPARATE OPERATOR CARD
   ┌───────────────────────────────────────────────────────────────┐
   │ Window >= 24h elapsed. Record terminal verdict:                │
   │  • organic cells appeared + handled within budget  -> PASS-STAGE-1
   │  • organic stayed zero -> PASS-STAGE-1-PLUMBING /              │
   │       INSUFFICIENT-ORGANIC-VOLUME (audit §0 rule)             │
   │ Family-F follow-up (§7) dispositioned (provider-5xx vs F      │
   │ packet residual) before any ramp.                              │
   └───────────────────────────────┬───────────────────────────────┘
                                    │  operator authorizes Gate 2 (separate card)
                                    ▼
   Gate 2 — 5%  ✋ SEPARATE OPERATOR CARD  (PERCENTAGE 1 -> 5)
   ┌───────────────────────────────────────────────────────────────┐
   │ Pre: Gate-1 verdict recorded; Family-F dispositioned;          │
   │      monitor healthy; one fresh canary+burst clean at the      │
   │      current build.                                            │
   │ Arm 5%, run canary-then-burst, open a >= 24h 5% window.        │
   │ Strong preference: real organic cells observed + handled       │
   │      within budget at 1% first (else explicitly note the       │
   │      gap and lean on synthetic + plumbing evidence).           │
   └───────────────────────────────┬───────────────────────────────┘
                                    │  operator authorizes Gate 3 (separate card)
                                    ▼
   Gate 3+ — higher (e.g. 10% / 25% / ...)  ✋ SEPARATE OPERATOR CARD(S)
   ┌───────────────────────────────────────────────────────────────┐
   │ Each step: its own card, its own >= 24h window, its own        │
   │ canary+burst, ideally real organic evidence from the prior     │
   │ percentage handled within budget first. Same gate table (§4).  │
   └───────────────────────────────────────────────────────────────┘
```

**Why conservative and evidence-led.** The honest launch-readiness question is *can the queue handle a real organic classifier fan-out without the provider/packet cluster that motivated this whole chain?* Synthetic bursts answer the **mechanism** question (and answer it well). Only real organic routed cells answer the **traffic** question (mix, timing, arrival distribution). The ramp is therefore designed so each percentage increase is backed by the strongest available evidence — synthetic always, and real organic from the prior step wherever the pre-launch volume produces it.

**No ratchet without a card.** There is no schedule, timer, or audit verdict in this repo that advances `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`. The value changes only when an operator runs an arm script for the new percentage under a new authorization.

---

## 4. The per-gate evidence contract

Every ramp gate (Gate 2 onward) must record **all** of the following, read-only and argId-scoped to that gate's canary + burst (and, where present, organic cells). This is the shared "definition of ready to advance" — it mirrors the gate table the synthetic qualification already used, generalized to each percentage.

| # | Evidence | PASS bar | HALT (rollback) trigger | Probe |
|---|---|---|---|---|
| E1 | **Real organic cells handled within budget** | organic routed cells (if any appeared at the prior %) reached terminal `succeeded` within the retry budget; dead-letters (if any) are isolated + typed | organic dead-letter **cluster**, or organic cell stuck non-terminal | §5 organic probe |
| E2 | **No provider/packet CLUSTER** | ≤ 1 isolated, clearly-typed dead-letter across the burst; mitigated family `argument_scheme` (E) clean | provider/server **cluster** recurrence, or packet/schema **cluster** in any family | §5 dead-letter + per-family probe |
| E3 | **Idempotency** | `duplicate_success_cell_count = 0` | `duplicate_success > 0` | §5 duplicate-success probe |
| E4 | **Single-flight** | `overlapping_drain_pairs = 0` | `overlapping_drain_pairs > 0` | §5 overlapping-drain probe |
| E5 | **No `family = NULL` leakage on routed args** | `0` | any `family = NULL` on a routed canary/smoke/organic arg | §5 routing-leakage probe |
| E6 | **No H/I/J leakage** | `0` rows for `claim_clarity` / `thread_topology` / `sensitive_composer` | any H/I/J row appears | §5 H/I/J-leakage probe |
| E7 | **Monitor healthy** | `cutover-health-monitor-tick` active `*/5`, `monitor_failed_15min = 0`, recent successes present | monitor cron failure (Layer 1 FAIL) or alert-path failure | §5 monitor-health probe |
| E8 | **M1 drainer freshness under load** | `< 120s` while `M2 > 0` (work present) | `M1 ≥ 120s` while `M2 > 0` (work present but not draining) | §5 M1 probe |
| E9 | **M2 drains to 0** | queue returns to `non_terminal = 0` after the burst | `M2` climbs / does not return to zero | §5 M2 probe |

**On E1 at low organic volume.** If a gate's prior-percentage window observed zero organic cells (the current reality at 1%), E1 cannot be satisfied by organic evidence and the gate verdict must say so explicitly — the honest framing is the audit §0 rule: lean on synthetic + plumbing/observability/rollback evidence, name the organic gap, and let the operator decide whether to advance on that basis. The roadmap's **preference** is real organic evidence first; it does not pretend a zero-organic window is organic proof.

**On E8 at idle.** E8 only bites when `M2 > 0`. An idle-empty drainer (`M1` stale, `M2 = 0`) is healthy inertness (the 09:10Z checkpoint is exactly this), not a stall — do not read it as an E8 failure.

---

## 5. Read-only gate probes (added by this card)

To make the §4 contract concretely runnable at each gate without minting new ad-hoc SQL every time, this card adds a small set of **read-only** `SELECT` probes under `scripts/ops-stage1-sql/` and thin `.sh` wrappers under `scripts/ops/stage1/`.

### 5.1 Why a sibling SQL directory (`scripts/ops-stage1-sql/`, NOT `scripts/ops/sql/`)

The observability suite (`__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts`, `__tests__/opsMcpObservabilitySqlSafety.test.ts`) asserts an **exact 17-file `.sql` count** recursively under `scripts/ops/`. Adding a `.sql` anywhere under `scripts/ops/` would break that count and the build. The latency track already hit this and resolved it the same way — `scripts/ops-latency-sql/` is a **sibling** of `scripts/ops/`, invisible to the recursive scan. This card follows that precedent exactly: every committed Stage-1 `.sql` lives in `scripts/ops-stage1-sql/`, never under `scripts/ops/`.

### 5.2 Read-only + doctrine guarantees every Stage-1 SQL file honors

Each `scripts/ops-stage1-sql/*.sql` file:

- is **read-only** — no `INSERT` / `UPDATE` / `DELETE` / `ALTER` / `CREATE` / `DROP` / `TRUNCATE` / `GRANT` / `REVOKE` in executable SQL;
- ends with a terminating `;`;
- has its **first non-empty line** be a comment referencing `OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP`;
- contains **no** `select * from public.arguments`, **no** bare `arguments.body`, **no** bare `evidence_span`, and **no** secret literal;
- aggregates over **queue/run metadata only** (`public.argument_machine_observation_runs`, `public.debates.title` for the smoke-tag join) — never argument body text, never classifier `evidence_span` output. Doctrine: these are system-health metrics, never a gameplay or truth signal.

### 5.3 The probe set

| File | Maps to | Reads (metadata only) |
|---|---|---|
| `scripts/ops-stage1-sql/01-routing-liveness-and-leakage.sql` | E5, E6 | per-arg family fan-out: count of `family IS NOT NULL` routing rows, count of `family = NULL` legacy rows, count of H/I/J rows — for recent routed args |
| `scripts/ops-stage1-sql/02-organic-vs-smoke-routed.sql` | E1 | routed-arg counts split into smoke-tagged (`[arch-001-queue-smoke]` title) vs organic, with terminal-state breakdown for the organic subset |
| `scripts/ops-stage1-sql/03-deadletter-and-per-family.sql` | E1, E2 | per-family terminal-state counts (succeeded / dead_letter / failed_terminal / non_terminal) + max attempt count, for recent routed args — so an isolated DL is distinguishable from a cluster |
| `scripts/ops-stage1-sql/04-idempotency-and-singleflight.sql` | E3, E4 | duplicate-success cell count and overlapping-drain-lease pair count over recent routed runs |
| `scripts/ops-stage1-sql/05-drainer-freshness-and-depth.sql` | E8, E9 | M1 (seconds since last drain activity) and M2 (`non_terminal` row count) together, so the idle-empty-vs-stuck distinction is explicit in one result |

The monitor-health check (E7) is read via the existing `cutover_health_metrics()` RPC / cron state; this card does not duplicate that RPC.

### 5.4 The `.sh` wrappers

Thin, read-only wrappers under `scripts/ops/stage1/` (`.sh` files do not affect the 17-`.sql` count):

| Wrapper | Runs |
|---|---|
| `scripts/ops/stage1/gate-routing-leakage.sh` | `01-routing-liveness-and-leakage.sql` |
| `scripts/ops/stage1/gate-organic-vs-smoke.sh` | `02-organic-vs-smoke-routed.sql` |
| `scripts/ops/stage1/gate-deadletter-per-family.sh` | `03-deadletter-and-per-family.sql` |
| `scripts/ops/stage1/gate-idempotency-singleflight.sh` | `04-idempotency-and-singleflight.sql` |
| `scripts/ops/stage1/gate-drainer-freshness-depth.sh` | `05-drainer-freshness-and-depth.sql` |

Each wrapper, like the existing Stage-1 scripts:

- starts with `#!/usr/bin/env bash`, then `set -uo pipefail`, then `set +x`;
- runs **only** read-only `npx supabase db query --linked --file scripts/ops-stage1-sql/<name>.sql` — the linked db query authenticates via the **project link**, not the operator account token; no privileged client is constructed;
- references operator secret **names** only, never values; prints no secret value;
- makes **no** env mutation, **no** percentage change, **no** provider call.

These wrappers are **diagnostic read-only tools**, not ramp actions. They never arm, advance, or disarm anything. The arm/disarm/advance actions stay in the operator-run scripts (§6.3).

---

## 6. Dead-letter budget thinking + rollback

### 6.1 Tolerable vs HALT

The line between "advance is still on the table" and "roll back now" is **isolated-and-typed vs cluster-or-leak**:

| Signal | Disposition |
|---|---|
| A single isolated, clearly-typed provider-side 5xx dead-letter (e.g. the §7 `9ef5aab5` cell), the rest of the burst clean, mitigated family E clean | **Within tolerance.** The 4-attempt retry budget + dead-letter safety net absorbing a transient provider hiccup is the queue working as designed. Note it; do not roll back on it alone. |
| A **cluster** of dead-letters (multiple cells failing the same way), especially same-family or same-input | **HALT + roll back.** This is the original FAIL-LOAD signature (3 E dead-letters, deterministic same-input = the packet-shape bug). |
| Any packet/schema **cluster** recurrence in any family | **HALT + roll back.** |
| Any `family = NULL` leakage on a routed arg | **HALT + roll back.** Routing isolation breach. |
| Any H/I/J row appears | **HALT + roll back.** Gated-family leakage. |
| `duplicate_success > 0` or `overlapping_drain_pairs > 0` | **HALT + roll back.** Idempotency / single-flight breach. |
| Queue does not drain (`M2` climbing / not returning to 0) | **HALT + roll back.** |
| Monitor cron failure or alert-path failure | **HALT + roll back.** |

This is the same FAIL/HALT set the Stage-1 audit §6 and the synthetic qualification §5 use, restated as the ramp's per-gate budget so no future card has to re-derive it.

### 6.2 The "isolated provider 5xx is within budget" rule, stated plainly

An **isolated** provider 5xx is a property of the upstream provider, not of CDiscourse's queue, packet shape, or routing. The dead-letter safety net exists precisely to absorb it: the cell parks (no infinite retry), the queue keeps draining, the other cells are unaffected, the monitor stays healthy. One such cell per burst is **expected occasionally** and does not gate a ramp. What gates a ramp is the *pattern* — a cluster, a repeat in the mitigated family, or any of the isolation/idempotency/leakage breaches above.

### 6.3 Rollback is always one command

At every percentage, rollback is `scripts/ops/stage1/disarm-stage1.sh` (sets `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` / `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0`). The arm scripts for higher percentages are operator-run under their own authorization. CC does not advance the percentage; the percentage advances only when an operator runs an arm action for the new value.

### 6.4 The read-only probes never roll back

The §5.4 `gate-*.sh` wrappers are read-only diagnostics. Rollback is a separate, deliberate operator action via `disarm-stage1.sh`. Keeping diagnosis and action in separate scripts means a future agent cannot "accidentally advance" by running a gate check.

---

## 7. The open Family-F follow-up (the lone `9ef5aab5` dead-letter)

The synthetic qualification's single dead-letter — argId `9ef5aab5-…`, family `critical_question` (F), attempt 4, `retry_attempts_exhausted` / `provider_server_error` — is within budget but carries an honest residual ambiguity: `provider_server_error` is the *same typed signature* as the original FAIL cluster, so queue metadata alone cannot 100% exclude an F packet-shape edge that the provider rejected. This follow-up is **not a blocker** for closing the Stage-1 window, but it should be **dispositioned before any percentage ramp** so a possible F residual is not carried silently into higher traffic.

> **✅ DISPOSITION (2026-06-02) — Option 1 RUN; packet-shape residual CONFIRMED.** The read-only R3 log inspection (§ 7.1) was completed against the Deno Deploy `cdiscourse-mcp-server` `boolean_observation_tool_error` log. Result: **5/5 events `validation_failed` + `packet_invalid`, 0 provider 5xx, 0 ban-list, 61 healthy Anthropic 200s, deterministic path `critical_question.evidenceSpan.unstated_assumption` ×4.** This is the **§ 7.1 second branch (packet-shape rejection)**, NOT a bare upstream 5xx → it confirms a Family-F residual on `unstated_assumption`, which lacks the per-rawKey rule-6 reinforcement that PR #421/#423 gave `alternative_explanation_available`. The mitigation (§ 7.2) is therefore **REQUIRED before Gate 2 (5%)**, not optional. Design filed: `docs/designs/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING.md`. Full evidence: § 12 of `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md`. `9ef5aab5` was **synthetic** (smoke-tagged burst, organic routed = 0) so it did not gate or change the Stage-1 closeout verdict.

### 7.1 Option 1 — read-only R3 log inspection (do this first)

**Read-only** inspection of the Deno Deploy `cdiscourse-mcp-server` `boolean_observation_tool_error` (R3) log for argId `9ef5aab5…` / family `critical_question`, to disambiguate:

- a **bare upstream 5xx** (provider-side server error) → no code action needed; the safety net already caught it; the ramp can proceed on the budget rule (§6.2);
- a **packet-shape rejection** in F (the provider rejected a malformed F packet) → confirms a residual; proceed to Option 2.

This is read-only, costs no provider spend, and does not gate the Stage-1 closeout. It is the cheapest discriminator and should run before any mitigation work is considered. **PROPOSAL — operator-run; this roadmap does not perform it.**

### 7.2 Option 2 — F packet-shape mitigation (only if Option 1 confirms a residual)

If Option 1 shows an F packet-shape rejection, open a **Family-F packet-shape mitigation** card parallel to the **E/F STRICT RESPONSE-SHAPE CONTRACT** mitigation already shipped (PR #421/#423). That work hardened the response/packet shape for `argument_scheme` (E) and `critical_question` (F); a confirmed F residual means an additional F-specific edge slipped the contract and needs the same treatment. This is a **source-touching** card (it changes the F packet/response handling) and therefore sits **outside this docs-and-roadmap track** — it is its own designed, implemented, reviewed, and operator-deployed card. **PROPOSAL — separate card; not performed or authorized here.**

### 7.3 Sequencing relative to the ramp

- **Before Gate 1 closeout:** Option 1 (read-only) should run so the closeout records a disposition, not an open question.
- **Before Gate 2 (5%):** if Option 1 confirmed a residual, Option 2 should land (designed → built → reviewed → operator-deployed) before increasing F's traffic share. If Option 1 showed a bare 5xx, no F code action is needed and the ramp proceeds on the budget rule.

---

## 8. What this card does NOT do (binding non-goals)

- **Does NOT close the Stage-1 1% observation window.** The window stays OPEN until ≥ `2026-06-03T07:50:54Z`; its terminal verdict is recorded by a separate Gate-1 card.
- **Does NOT issue `PASS-STAGE-1`** (or `PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME`).
- **Does NOT advance `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`** above 1, and does not authorize 5% or any higher step. **5% is a SEPARATE operator-gated step; no audit or doc auto-advances the percentage.**
- **Does NOT enable families H/I/J** or change any `productionEnabled` flag in the family registry.
- **Does NOT change any source, migration, validator, prompt, retry policy, drainer constant, ban-list, schema mirror, secret, or env var.**
- **Does NOT run** git, gh, `npx supabase`, any DB query, any provider/MCP/network call, any cron/env mutation, or any burst harness. This is an authoring artifact only.
- **Does NOT make any provider spend.** Zero Anthropic / xAI / X API calls.

Every ramp step, every disambiguation, and every mitigation referenced above is a **PROPOSAL requiring separate, explicit operator authorization**. None is scheduled, none auto-advances, none is "done" by this document existing.

---

## 9. Out of scope: families H/I/J

Families **H** (`claim_clarity`), **I** (`thread_topology`), and **J** (`sensitive_composer`) are `productionEnabled: false` in the registry and are **entirely out of scope for this track**. This roadmap:

- does not propose enabling them;
- does not include them in any ramp gate, probe, or evidence contract;
- treats any H/I/J row appearing during an A-G ramp as a **HALT trigger** (§6.1, E6), precisely because they must not be in the routed set.

Their production enablement is a separate, doctrine-gated track (the per-family ship / production-enable audits) with its own classifier `evidence_span` doctrine review — which this OPS routing-percentage track deliberately does not touch.

---

## 10. Doctrine self-check

- **No truth-value assignment.** Every metric in §4/§5 is a system-health signal (routing isolation, idempotency, drain freshness, dead-letter typing). None labels any person, post, or claim as winner/loser/correct/true/false/liar/dishonest/bad-faith, and none assigns factual standing.
- **Machine outputs are Observations.** The classifier families A-G produce Observations, not Allegations; this roadmap treats them strictly as queue routing targets and never inspects or surfaces their `evidence_span` content (that is the per-family ship audit's job).
- **Heat ≠ truth; popularity ≠ evidence.** No metric here treats activity, throughput, or engagement as a truth or evidence signal; they are load/health signals only.
- **Secrets policy honored.** All Stage-1 SQL is read-only and references no secret; all `.sh` wrappers authenticate via the project link (not a privileged client / not the operator account token), reference operator secret **names** only, keep `set +x`, and print no secret value. No banned token appears in any script or its comments.
- **No client AI, no service-role in client, no `.env*` touched, no migration.** Consistent with the cutover track's standing boundaries.

---

## 11. Next recommended step

**Gate 1 — close the Stage-1 1% window once it reaches ≥ 24h** (`≥ 2026-06-03T07:50:54Z`), as a **separate operator-authorized card**:

1. Confirm the window has elapsed ≥ 24h.
2. Run the read-only Family-F disambiguation (§7.1, Option 1) so the closeout records a disposition.
3. Record the terminal verdict per the audit §0 rule — `PASS-STAGE-1` if organic cells appeared and were handled within budget, else `PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME` if organic stayed zero.
4. Leave 5% (Gate 2) as a further separate operator card; do **not** advance the percentage as part of the closeout.

**This roadmap is ready for operator review — no implementation performed, no live API call made, no `.env*` read, no Supabase mutation, no percentage advance.**
