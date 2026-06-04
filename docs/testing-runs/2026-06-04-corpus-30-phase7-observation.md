# CORPUS-30 Phase 7 — A–G Classifier Observation Verification

`Audit-Lint: v1`

**Card:** `PHASE7-OBSERVATION-001` (GitHub issue [#465](https://github.com/kyleruff1/cDiscourse/issues/465))
**Run audited:** `corpus-prod-synthetic-20260603-1924-d49e04cd` (30 debates / 300 args / 2026-06-03 live).
**Phase 7 executed:** 2026-06-04, read-only, via `npx supabase db query --linked --file scripts/corpus-30-phase-7-sql/*.sql`.
**SQL pack:** `scripts/corpus-30-phase-7-sql/01-06*.sql` + `README.md` (shipped on main via PR #475).
**Posture:** verify-only. No `INSERT`/`UPDATE`/`DELETE`. No classifier re-trigger. No queue routing arm. No H/I/J touch. No `public.arguments` mutation.

---

## 1. Phase 7 verdict matrix (per family)

| Family (A–G) | Production-enabled? | Success rows | Failed rows | Total rows | Success % | Verdict |
|---|---|---:|---:|---:|---:|---|
| A `parent_relation` | ✅ | 197 | 236 | 433 | 45.5% | PARTIAL |
| B `disagreement_axis` | ✅ | 136 | 351 | 487 | 27.9% | PARTIAL |
| C `misunderstanding_repair` | ✅ | 190 | 259 | 449 | 42.3% | PARTIAL |
| D `evidence_source_chain` | ✅ | 183 | 268 | 451 | 40.6% | PARTIAL |
| E `argument_scheme` | ✅ | 202 | 233 | 435 | 46.4% | PARTIAL |
| F `critical_question` | ✅ | 187 | 264 | 451 | 41.5% | PARTIAL |
| G `resolution_progress` | ✅ | 182 | 267 | 449 | 40.5% | PARTIAL |
| **Σ A–G** | | **1,277** | **1,878** | **3,155** | **40.5%** | **PARTIAL** |

Every production-enabled family A–G fired for every one of the 300 arguments (Step 6 returned **zero gaps**). The auto-trigger dispatcher honored `productionEnabledFamilies()` exactly. PARTIAL is per-family success rate, not coverage — coverage is complete.

**Row-count > 300×7 = 2100 explanation.** The dispatcher's `MAX_ATTEMPTS = 2` (per `autoTriggerDispatcher.ts:112`) plus per-attempt failure-retry produces ~10.5 rows/argument on average (3,155 / 300). Direct-dispatch persists one `_runs` row per attempt; this is by design.

---

## 2. H/I/J production leakage — verdict

| Family | productionEnabled (registry) | Rows for this runTag |
|---|---|---:|
| H `claim_clarity` | `false` (familyRegistry.ts:106) | **0** |
| I `thread_topology` | `false` (familyRegistry.ts:111) | **0** |
| J `sensitive_composer` | `false` (familyRegistry.ts:116) | **0** |

**Verdict: zero leakage.** `filterFamiliesForMode('production', …)` correctly elided H/I/J from the auto-trigger dispatch, per the registry's `productionEnabled: false` clause for each. The frozen-surface §4-C invariant is observed in production telemetry.

---

## 3. Failure-reason breakdown (per family)

| Family | `mcp_api_error` | `mcp_network_error` | failure_sub_reason | failure_detail.reason |
|---|---:|---:|:---:|:---:|
| `parent_relation` | 152 | 84 | NULL (all) | NULL (all) |
| `disagreement_axis` | 273 | 78 | NULL (all) | NULL (all) |
| `misunderstanding_repair` | 193 | 66 | NULL (all) | NULL (all) |
| `evidence_source_chain` | 197 | 71 | NULL (all) | NULL (all) |
| `argument_scheme` | 176 | 57 | NULL (all) | NULL (all) |
| `critical_question` | 206 | 58 | NULL (all) | NULL (all) |
| `resolution_progress` | 206 | 61 | NULL (all) | NULL (all) |
| **Σ** | **1,403 (74.7%)** | **475 (25.3%)** | | |

`failure_sub_reason` is the queue-substrate column (`20260528000021_arch_001_classifier_queue_substrate.sql:148-169`); direct-dispatch leaves it NULL by design. `failure_detail` jsonb (added by `20260602000001_ops_mcp_classifier_failure_detail.sql:113-114`) is also NULL because that surface populates only on terminal-failure write paths in the queue drainer, not in the auto-trigger dispatcher's direct path.

**Root pattern.** mcp_api_error dominance under direct-dispatch bounded concurrency=2 dispatching 7 families per insert is consistent with the pattern memory `[[mcp-validation-failed-burst-concurrency]]` (2nd cause; load-correlated). Disagreement_axis is the worst-hit family at 27.9% — likely because it is the second family in registry order and competes for the same MCP worker slot as `parent_relation` at insert time.

---

## 4. Positive observation density (per family)

| Family | Positive observation rows | Args with ≥1 positive | Args coverage % |
|---|---:|---:|---:|
| `parent_relation` | 380 | 175 | 58.3% |
| `disagreement_axis` | 210 | 84 | 28.0% |
| `misunderstanding_repair` | 265 | 129 | 43.0% |
| `evidence_source_chain` | 374 | 139 | 46.3% |
| `argument_scheme` | 187 | 133 | 44.3% |
| `critical_question` | 367 | 135 | 45.0% |
| `resolution_progress` | 380 | 155 | 51.7% |
| **Σ A–G** | **2,163** | (per-family) | |

Positive density tracks success rate × keys-fired-per-success. `parent_relation` (broadest at 58.3% argument coverage) reflects its role as the universal Family-A first-pass. `disagreement_axis` (lowest at 28%) directly reflects its 27.9% success rate.

---

## 5. Per-argument gap analysis

`scripts/corpus-30-phase-7-sql/06-per-argument-gap.sql` returned **0 rows**. Every one of the 300 arguments has at least one `_runs` row for every one of the 7 production-enabled families. **No dispatcher-shutdown races.** No `EdgeRuntime.waitUntil` cutoff observed for this corpus.

---

## 6. Phase 7 boundaries preserved

| Boundary | Status |
|---|---|
| No `INSERT` / `UPDATE` / `DELETE` issued | ✅ |
| No classifier HTTP endpoint triggered | ✅ |
| No queue routing armed | ✅ |
| No H/I/J `productionEnabled` flipped | ✅ |
| No `public.arguments` mutation | ✅ |
| No service-role in client | ✅ (queries run via `npx supabase db query --linked` from the operator-authorized credentials store) |
| No secret value printed | ✅ |
| No raw `evidence_span` or argument body in this doc | ✅ |
| No raw provider payload in this doc | ✅ |

---

## 7. Follow-up cards (created by this audit)

The 40.5% Σ-success rate is too low to leave unaddressed. Suggested follow-up cards (operator decision required to file):

1. **OPS-MCP-AUTO-TRIGGER-BURST-HARDENING-FOLLOWUP** — investigate the burst-concurrency mcp_api_error pattern. Tie to memory `[[mcp-validation-failed-burst-concurrency]]` and `[[mcp-provider-server-error-bucketing]]`. Does the direct-dispatch path need its own backoff/jitter? Should `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` shrink to 1 under burst-detected conditions? **NOT** a §4-T bar lowering — the bar is currently "fire-and-forget retries up to MAX_ATTEMPTS"; this card would TIGHTEN by adding backoff.
2. **OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL** — `failure_detail` jsonb populates only on the queue drainer's terminal-failure path. The auto-trigger direct-dispatch path also writes terminal failures (status='failed'); those rows would benefit from the same leak-safe diagnostic projection. Tie to `OPS-MCP-OBSERVABILITY-002` (#470) for the read consumer.
3. **CORPUS-30-RESULTS-001 (#466)** — Phase 7 verdict + failure analysis are inputs to the analysis card. Cite this audit doc as Phase-7 input.
4. **CORPUS-30-QUALITY-001 (#467)** — the renderer's deterministic_fallback rate (23 / 240 = 9.6% Anthropic success on M3-M10) is orthogonal to the classifier failure rate measured here, but both reflect operational reliability under burst. Mention in CORPUS-30-QUALITY-001's discussion section.

---

## 8. Cross-references

- **SQL pack source:** `scripts/corpus-30-phase-7-sql/` (committed on main via PR #475).
- **Original run report:** `docs/testing-runs/2026-06-03-xai-adversarial-bot-corpus.md` (committed via PR #481).
- **Run id:** `2026-06-03T19-24-32-740Z-d49e04cd`.
- **runTag:** `corpus-prod-synthetic-20260603-1924-d49e04cd`.
- **Auto-trigger source:** `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`.
- **Family registry:** `supabase/functions/_shared/booleanObservations/familyRegistry.ts:68-119` (A–G `productionEnabled: true`; H/I/J `false`).
- **Failure-detail schema:** `supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql`.
- **Queue substrate (not exercised here):** `supabase/migrations/20260528000021_arch_001_classifier_queue_substrate.sql`.
- **Sprint backlog index:** `docs/designs/SPRINT-CORPUS30-ADMIN-HIJ-BACKLOG.md` (this card is Wave-1 step 4 / row 5 in the issue index).

---

## 9. Doctrine attestation

- **§1 no truth labels.** This doc uses operational-health vocabulary only (success / failed / coverage / leakage). No correctness verdicts on arguments or authors.
- **§3 popularity not evidence.** Positive observation density is a coverage metric for the classifier substrate, not factual standing.
- **§4 AI moderator advisory-only.** Every classifier row in `argument_machine_observation_runs` is a Machine Observation; nothing here gates submission.
- **§4-C never-self-approve.** H/I/J `productionEnabled` remains `false` after this audit. No registry flip proposed.
- **§4-T no bar lowering.** Phase 7 success rate is reported honestly. PARTIAL verdict per family. No looser threshold applied to make any family read as PASS.
- **§5 engine.ts sacred.** Untouched.
- **§6 secrets.** No secret value printed. Queries executed via the operator-authorized credentials store.
- **§7 no AI from production app.** Queries run only via `npx supabase db query --linked`. No provider call.
- **§8 RLS + soft-delete + append-only.** No row mutated. Append-only nature of the audit table preserved (no writes occurred).
- **§9 plain-language mapping.** Internal codes (`mcp_api_error`, `mcp_network_error`, `failure_sub_reason`, `failure_detail`) appear in this audit doc with explicit operator-facing gloss in §3 commentary.
- **§10a Observations vs Allegations.** Classifier rows are Machine Observations; this doc preserves that boundary.

---

## 10. Phase 7 verdict

**PASS** (with operationally honest PARTIAL per-family success).

- Coverage: complete (zero gaps).
- H/I/J leakage: zero.
- Boundaries: preserved.
- Reliability: 40.5% Σ-success — below the success bar that would justify autonomous routing-percentage advancement; matches operator's earlier P1 organic Stage-1 gating criteria. The Phase 7 audit confirms the substrate IS observable under direct-dispatch, the classifier IS firing for the right families, and the H/I/J freeze IS holding.
