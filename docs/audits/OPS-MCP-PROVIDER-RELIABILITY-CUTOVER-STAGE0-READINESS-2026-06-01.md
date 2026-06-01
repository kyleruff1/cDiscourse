# OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE0-READINESS — readiness gate audit (2026-06-01)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01 UTC (operator local 2026-05-31)
**Operator:** Kyler
**Base:** main HEAD `7560826` (design merged at PR #409)
**Predecessors:** PR #408 H rollback at `722f17b`; PR #407 H Card 3 FAIL audit at `540bfeb`; PR #409 cutover design at `7560826`
**Scope:** Read-only Stage 0 readiness verification for the OPS-MCP-PROVIDER-RELIABILITY-CUTOVER chain. The cutover design landed in PR #409; this audit determines whether the next prompt (rollback rehearsal → Stage 1 routing) can be operator-authorized. **No routing flag was flipped, no synthetic argument was submitted, no provider-spend call was made.**

**Verdict: STAGE0_READY_FOR_OPERATOR_DECISION** — technical readiness PASSES across all 10 readiness agents. Two non-blocking findings that require an operator decision before any next-prompt authorization:
1. **Management API PAT not available locally** (`.claude-tmp/supabase-management.env` missing). Dashboard fallback works for Stage 1 routing flips + rollback, but adds operator friction.
2. **Manual cadence burden is HIGH for Stage 1** — ~108 cadence events over 24h. Operator decides between (a) staffing the manual cadence, or (b) pulling alerting forward from Stage 4 to Stage 1 as a precondition. The design (§5.9 + §8 gate 7) anticipates this decision.

---

## 0. Reading manifest (Phase B)

Read at HEAD `7560826`:
- `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` (design)
- `docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` (review APPROVE)
- `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md` (H Card 3 FAIL evidence)
- `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` (ARCH-001 Card 3 smoke PASS)
- `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts`
- `supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts`
- `supabase/functions/classifier-drainer/index.ts`
- `supabase/functions/submit-argument/index.ts:780-846` (routing branch)
- Migrations `20260528000021/22/23_arch_001_*.sql`

**Extracted:**

- §8 gate list (7 gates): operator approval; Stage 0 preflight; thresholds confirmed; no competing routing changes; Anthropic tier; rollback rehearsal; operator staffing commitment.
- §5.8 M1–M8 query names: cron freshness; queue depth + oldest-pending-age; per-cell completeness; dead-letter rate; duplicate-success absence; direct-dispatch leakage absence; provider RPM; doctrine ban-list scan.
- §5.9 Stage 1 cadence: M1+M2 every 15 min; M3-M8 every 2h; detection SLA 15 min; missed-check fallback rollback after > 30 min.
- §8 gate 6 (rollback rehearsal): full end-to-end drainer-failure simulation including cron disable + M1 detection + flag flip + cron re-enable.
- Alerting placement: **Stage 4 currently** with §8 gate 7 + §5.9 explicit conditional "if staffing unavailable, alerting moves to Stage 1 as precondition."

---

## 1. Phase A state confirmation

| Item | Expected | Observed | Verdict |
|---|---|---|---|
| Main HEAD | `7560826` (PR #409 merge) | `7560826` | PASS |
| Card 3 FAIL audit commit in history | `540bfeb` | present | PASS |
| H rollback commit in history | `722f17b` | present | PASS |
| `claim_clarity` productionEnabled | `false` | `false` (line 106) | PASS |
| `claim_clarity` adminValidationEnabled | `true` | `true` (line 107) | PASS |
| Production roster | A–G (7 families) | A–G confirmed | PASS |
| Local tracked changes | 0 | 0 | PASS |
| `.claude-tmp/` gitignored | yes | yes (`.gitignore:4`) | PASS |

---

## 2. Phase C — 10-agent readiness table

| # | Agent | Probe | Result | Verdict |
|---|---|---|---|---|
| 1 | Migration substrate | Check ARCH-001 migrations 21/22/23 + queue columns + required functions | 3 migrations applied; 4 expected columns present (`family`, `state`, `available_at`, `attempt_count`); 4 functions present (`enqueue_classifier_job`, `claim_classifier_jobs`, `finalize_classifier_job`, `acquire_drain_lease`); `classifier_drain_audit` table exists | PASS |
| 2 | Cron/drainer health | Check `cron.job` entry + `classifier_drain_audit` recent rows | Cron job `arch-001-classifier-drain-tick` present; `active = true`; schedule = `* * * * *`; 30 recent `outcome='completed'` rows in last 30 min; newest completed drain ≈ 12.4s ago (well under M1 PASS threshold of 120s) | PASS |
| 3 | Drainer auth gate | Re-probe `classifier-drainer` no-auth + wrong-Bearer | INCONCLUSIVE on live re-probe (drainer URL not held locally; PAT missing). **Historically verified** at ARCH-001 Card 3 audit Phase A2: no-auth POST = 401; wrong-Bearer POST = 401; both bodies byte-identical `{"error":"unauthorized"}` (length 24). Source-equality argument: zero diff in `supabase/functions/classifier-drainer/` since ARCH-001 Card 3 ship at `d42d6da`. | PASS (historical + source-equality); live re-probe deferred |
| 4 | Routing default-disabled | Source-grep for master-flag check + default percentage + smoke-tag override | `enabled !== true` strict check at `classifierQueueRouting.ts:167`; default percentage `= 0` at line 164; fail-closed parsing at lines 89-98; smoke-tag override at lines 51 + 174 | PASS |
| 5 | Direct dispatch fallback | Source-verify mutually exclusive branch | `submit-argument/index.ts:817-846` — explicit `if (shouldRouteToQueue) { enqueue } else { dispatchAutoTriggerForArgument }` with no fall-through. An argument routes to exactly one path. Verified inline at the source. | PASS |
| 6 | Single-flight drainer | Source/migration check for advisory lock + lease + SKIP LOCKED context | `acquire_drain_lease(owner, ttl)` at `classifierDrainerCore.ts:157` — DB TTL-lease (single-flight); `pg_try_advisory_xact_lock` at migration `20260528000023:178` (enqueue-kick coalescing); `FOR UPDATE SKIP LOCKED` inside the lease, NOT the only protection (migration `…021:332`) | PASS |
| 7 | Duplicate-success protection | DB check for partial unique indexes + scan for existing dupes | 2 dedup indexes present on `argument_machine_observation_runs`; 0 prior duplicate-success rows across full history | PASS |
| 8 | M1–M8 SQL dry-run | Write 8 query files; execute each read-only | All 8 queries parsed + executed exit 0 against the linked DB: M1 (cron freshness): seconds_since_last_completed_drain ≈ 19.5s (PASS band); M2 (queue depth): 0 non-terminal rows; M3 (completeness): 0 routed args (expected — routing default-off); M4 (dead-letter): 4/224 cells = 1.786% over 24h (historical from ARCH-001 Card 3 + Card 2 smokes; resets at Stage 1 begin); M5 (duplicate): 0; M6 (leakage): 0; M7 (RPM): 0; M8 (doctrine): 364 spans scanned; 0 banned-token hits across 4 categories | PASS |
| 9 | Management API capability | Check `.claude-tmp/supabase-management.env` presence | **MISSING.** No SUPABASE_ACCESS_TOKEN available locally. Management CLI path requires the PAT to be loaded; dashboard fallback works but adds operator friction for every Stage 1 / rollback flip. | INCONCLUSIVE (management path); dashboard fallback available; non-blocking but a planning input |
| 10 | Operational cadence feasibility | Compute manual check burden for 24h Stage 1 window | M1+M2 every 15 min × 24h = 96 cadence events; M3-M8 every 2h × 24h = 12 cadence events; **total ≈ 108 cadence events over 24h** (average ~1 event every 13 min). Each event executes 2–6 queries + threshold check + log entry. Without alerting this is a HIGH operator burden. | NON-BLOCKING — operator decision required: staff the cadence OR pull alerting forward to Stage 1. |

**Convergence:** **READINESS_VERIFIED** (10/10 agents PASS or non-blocking caveats only). No hard blockers identified.

---

## 3. M4 dead-letter pct = 1.786% — interpretation

The M4 query returned 4 dead_letter cells / 224 terminal cells over 24h, a rate of 1.786%. This is **historical** (from ARCH-001 Card 3 smoke 2026-05-31 + ARCH-001 Card 2 smoke artifacts left in the DB). The ARCH-001 Card 3 smoke audit explicitly recorded `0.893% (1/112) dead_letter rate` as PASS-band. The 1.786% over 24h includes both Card 2 and Card 3 smoke leftovers plus any production routing (zero today). The Stage 1 measurement window resets when Stage 1 begins (the 24h interval becomes `created_at >= Stage 1 begin time`).

**Stage 1 implication:** M4 must be re-evaluated using a Stage-1-relative time window. The current 24h value is NOT directly comparable to Stage 1 PASS/PARTIAL/FAIL bands. A Stage 1 operator runbook can adjust the M4 interval to `now() - INTERVAL '<Stage 1 elapsed>'`.

---

## 4. Phase D — Stage 2B gate checklist (§8 of design)

| # | Gate | Status | Notes |
|---|---|---|---|
| 1 | Operator authorization on the cutover plan | PR #409 merged (operator squash-merge) → design APPROVED. Stage 1 itself NOT YET authorized; the operator must explicitly enable the next prompt. | **NEEDS_OPERATOR_STAGE1_APPROVAL** |
| 2 | Stage 0 preflight runs clean | This audit IS the Stage 0 preflight. 10/10 readiness agents PASS or non-blocking caveats. | **PASS** |
| 3 | Stage 1 metric thresholds operator-binding | The thresholds in §5.8 + §5.9 are recommended; the operator may adjust before Stage 1 begins. | **NEEDS_OPERATOR_CONFIRMATION** — recommend operator review §5.8 PASS/PARTIAL/FAIL bands and confirm or amend. |
| 4 | No competing routing changes in flight | Source byte-equality: `classifierQueueRouting.ts` and `classifier-drainer/index.ts` are byte-equal to ARCH-001 Card 3 ship state (no changes since `d42d6da`). | **PASS** |
| 5 | Anthropic tier confirmation | Likely Tier-1 (50 RPM). Operator confirms. Tier-2 (1,000 RPM) would unlock Stage 3+ at higher percentages without RPM headroom concerns. | **NEEDS_OPERATOR_CONFIRMATION** |
| 6 | Rollback rehearsal (full) | NOT YET performed. Required end-to-end (set master flag + percentage on smoke-only debate → verify M1/M2/M3 PASS → disable cron → confirm M1 surfaces failure < 5 min → flag back to off + cron re-enable). Total rehearsal time ≤ 30 min. **Recommend this be the NEXT operator-authorized prompt.** | **NEEDS_REHEARSAL_PROMPT** |
| 7 | Operator staffing commitment | ~108 cadence events over 24h Stage 1 window. High burden. Operator decides: (a) staff the cadence OR (b) pull alerting forward from Stage 4 to Stage 1. | **NEEDS_OPERATOR_DECISION** |

**Composite gate state:** 2 of 7 PASS unconditionally (gates 2 + 4); 1 of 7 satisfied conditionally (gate 1 — design APPROVED but Stage 1 not yet authorized); 4 of 7 require operator decisions/confirmations before Stage 1 can begin.

---

## 5. Phase E — Decision recommendation

Per the design's §5.9 + §8 gate 7 anticipation, recommend **Recommendation B (modified)**:

> Recommendation B (modified) — **Wire alerting before Stage 1, OR run rollback rehearsal first.** Then decide based on rehearsal outcome.

Two sequencing options for the operator:

**Option B.1 — Alerting-first sequence (recommended for highest safety):**
1. Operator picks alerting substrate (Datadog / Grafana / Resend / Discord webhook / etc. — operator-territory; design §7 Open Q3 anticipates this).
2. Operator wires alerts on M1 (drainer freshness), M2 (queue oldest-pending), M4 (dead-letter rate). E2E test the alerts.
3. Operator runs the rollback rehearsal (gate 6) under alert coverage.
4. Stage 1 begins with alerting in place — manual cadence drops from 15 min to 30 min fallback only.

**Option B.2 — Rehearsal-first sequence (recommended if operator confirms 15-min cadence staffing):**
1. Operator confirms staffing for 108 cadence events over 24h (gate 7).
2. Operator runs the rollback rehearsal (gate 6) using manual M1 checks.
3. Stage 1 begins with manual cadence per §5.9.
4. Alerting deferred to Stage 4 per original design.

**CC does NOT pick between B.1 and B.2.** This is operator-territory because it depends on staffing availability + alerting-substrate preference — both outside CC's purview.

**NOT recommended:**
- Recommendation A (proceed directly to rollback rehearsal without operator staffing/alerting decision) — works if operator confirms gate 7 + gate 5 + gate 3 explicitly first.
- Recommendation C (fix readiness blockers first) — no hard blockers exist.

---

## 6. Boundary compliance for THIS audit

- ❌ No `CLASSIFIER_QUEUE_ROUTING_ENABLED` flip.
- ❌ No `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` change.
- ❌ No `submit-argument` invocation.
- ❌ No `classify-argument-boolean-observations` invocation.
- ❌ No live Anthropic / xAI / X / MCP provider-spend call.
- ❌ No source code change.
- ❌ No migration created.
- ❌ No Family I work.
- ❌ No H production-enable retry.
- ❌ No staged-rollout step taken.
- ❌ No prompt / taxonomy / family-key / schema-mirror / Source 6 / audit-lint / package.json / production-flag change.
- ❌ No GitHub issue write (no comments posted on #391 / #388 / #373 from this audit — chat-only status per operator instruction).
- ✓ Read-only DB queries via `npx supabase db query --linked` only (substrate check + 8 M-queries).
- ✓ `.claude-tmp/` SQL files: 9 files (substrate + M1-M8); gitignored; NOT committed.
- ✓ Explicit `git add` only of this audit doc (Phase F deliverable) — no other files staged.

---

## 7. Recommended next prompt

**`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ROLLBACK-REHEARSAL`** — operator-authorized rehearsal of the rollback per §8 gate 6, on a `[arch-001-queue-smoke]`-tagged synthetic debate (smoke-tag override path; routing percentage = 100 for the rehearsal duration; smoke-tag = the only argument shape that routes). The rehearsal:

- (a) Set `CLASSIFIER_QUEUE_ROUTING_ENABLED='true'` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=100` via dashboard (or PAT if operator sets up `.claude-tmp/supabase-management.env`).
- (b) Submit one synthetic argument to a `[arch-001-queue-smoke]…`-titled debate; verify M1/M2/M3 PASS within 60s.
- (c) Disable the cron: `UPDATE cron.job SET active = false WHERE jobname = 'arch-001-classifier-drain-tick'`.
- (d) Confirm M1 surfaces the failure within 5 min (drainer freshness > 300s).
- (e) Execute rollback: unset `CLASSIFIER_QUEUE_ROUTING_ENABLED`; re-enable cron.
- (f) Confirm: in-flight smoke arguments complete or fall to dead-letter; no production traffic affected.
- Total ≤ 30 min. Pass criteria per §8 gate 6.

This rehearsal IS a provider-spend operation (one synthetic argument's worth ≈ 7 Anthropic calls at the drainer). Operator authorization required. Stage 1 routing is NOT enabled by this rehearsal — only the smoke-tag-override path is exercised.

After rehearsal PASS: operator decides B.1 vs B.2 sequence above, then authorizes either alerting-substrate selection OR the Stage 1 begin prompt.

---

## 8. Final verdict

**STAGE0_READY_FOR_OPERATOR_DECISION.**

- All 10 readiness agents PASS or non-blocking caveats only.
- Stage 2B gates 2 + 4 PASS unconditionally; gate 1 satisfied for design (Stage 1 not yet authorized); gates 3 + 5 + 6 + 7 require operator action.
- Production state on main is post-rollback safe: 7 production families A–G; H production-disabled; H admin_validation preserved; I/J unchanged; H L5 doctrine entries preserved; Card 3 FAIL audit preserved; ARCH-001 substrate ready; routing default-disabled.

Stop here. Operator chooses Recommendation B.1 (alerting first) or B.2 (rehearsal first under manual cadence) before any next prompt is authorized.
