# OPS-MCP-OBSERVABILITY-SMOKE — Post-merge audit

**Date:** 2026-05-27
**Operator:** Kyler
**Predecessor:** OPS-MCP-OBSERVABILITY shipped at `d500037` (PR #321).
**Audit doctrine:** Verifies the read-only operator telemetry script runs against the linked Supabase project, surfaces all 13 telemetry questions for the multi-family MCP classifier, and preserves all doctrine guarantees (no service-role, no secrets, no raw body content, no evidence span by default, no banned doctrine tokens, Source 6 production-only filter intact).

---

## Verdict

**PARTIAL.** The observability card itself is OPERATIONAL — the report runs cleanly, all 13 telemetry sections populate correctly, every safety check passes, and the Source 6 binding constraint is verified at three independent layers. The PARTIAL verdict is driven by **real findings the report successfully surfaced**, not by a card-level defect:

1. **Q9 detected 3 duplicate successful production+admin_validation runs** for `parent_relation` → authorizes `OPS-MCP-IDEMPOTENCY-HARDENING`.
2. **Q11 + Q12 detected historical synthetic test data** with `provider_key="smoke-mcp:test-server"` (3 result rows across 1 run; created 2026-05-26 05:56:33) that contaminates the production-mode aggregate and the unsupported-family-positive aggregate → authorizes `OPS-MCP-TEST-DATA-CLEANUP` and a small Q12 SQL semantic tightening.

The observability surface is doing exactly what the card is for: converting recurring manual SQL inspection into actionable structured findings. Both findings would have been invisible without this card.

* **Report execution:** `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/ops-smoke` — exit 0; markdown (13,553 bytes) + JSON (30,728 bytes) produced.
* **All 14 SQL queries executed** (Q1, Q2, Q2b, Q3-Q13).
* **18 markdown sections** (13 telemetry + 2 appendices + ToC/Source-6/intro).
* **All 4 doctrine guardrails GREEN:** no banned tokens in labels (verdict-token list appears only in Appendix B doctrine-scan annotation); no JWTs / bearer / service-role / API keys in output; no raw body content; no full evidence_span content.
* **Source 6 binding constraint:** literal `'production'` filter at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` byte-equal untouched (verified via `git diff main -- src/` empty); the script's own runtime safety check (exit 3 if literal missing) preserved.
* **Targeted regression:** 50 suites / 1048 tests / 0 failed across `mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability`.
* **Typecheck + lint:** exit 0.

**Authorizations granted:**
- `MCP-SERVER-005-FAMILY-D` remains authorized with mandatory Stage-2B operator-decision checkpoint.
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` remains authorized to design.
- **`OPS-MCP-IDEMPOTENCY-HARDENING`** is **AUTHORIZED to file** (Q9 surfaced 3 duplicate-run pairs).
- **`OPS-MCP-TEST-DATA-CLEANUP`** is **AUTHORIZED to file** (synthetic test seed with `provider_key="smoke-mcp:test-server"` should be purged).
- **`OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING`** is **AUTHORIZED to file** (small SQL refinement — see Phase 3 findings).

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `d500037` (`OPS-MCP-OBSERVABILITY: multi-family MCP classifier telemetry report (#321)`). Working tree contains only the 10 known operator-territory untracked files.

Predecessor audits present:

| Audit | Path |
| --- | --- |
| MCP-021C-AUTO-TRIGGER-FAMILY-A smoke | `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md` |
| MCP-SERVER-003-FAMILY-B smoke | `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md` |
| MCP-SERVER-004-FAMILY-C smoke | `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-2026-05-27.md` |
| OPS validator-refactor smoke | `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md` |

Source 6 file byte-equal verified: `git diff main -- src/features/nodeLabels/machineObservationPersistenceQuery.ts` returns empty.

Hosted server health: `status=ok, environment=prod, credentialsConfigured=true`.

Supabase Management API reachable: tested via `npx supabase db query --linked --file <tmp>.sql` succeeded (used throughout for Phase 0 schema verification, Phase 2 report execution, and Phase 3 follow-up forensics).

---

## Phase 2 — Run the report against linked Supabase

**Status:** PASS

```
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/ops-smoke
→ [run] q01-runs-by-run-mode <- 01-runs-by-run-mode.sql
  [run] q02-runs-by-family <- 02-runs-by-family.sql
  [run] q02b-runs-by-requested-family <- 02b-runs-by-requested-family.sql
  [run] q03-runs-by-family-and-status <- 03-runs-by-family-and-status.sql
  [run] q04-failure-reasons-by-family <- 04-failure-reasons-by-family.sql
  [run] q05-positive-results-by-family <- 05-positive-results-by-family.sql
  [run] q06-top-positive-raw-keys-by-family <- 06-top-positive-raw-keys-by-family.sql
  [run] q07-positive-density-7d <- 07-positive-density-7d.sql
  [run] q08-source-six-safety <- 08-source-six-safety-row-counts.sql
  [run] q09-duplicate-runs <- 09-duplicate-runs.sql
  [run] q10-family-a-auto-trigger-recent <- 10-family-a-auto-trigger-recent.sql
  [run] q11-family-bc-admin-validation-check <- 11-family-bc-admin-validation-check.sql
  [run] q12-unsupported-family-attempts <- 12-unsupported-family-attempts.sql
  [run] q13-over-under-firing-summary <- 13-over-under-firing-summary.sql
  [write] /tmp/ops-smoke/report.md
  [write] /tmp/ops-smoke/report.json
EXIT: 0
```

Generated artifacts:
- `/tmp/ops-smoke/report.md` — 13,553 bytes (markdown primary)
- `/tmp/ops-smoke/report.json` — 30,728 bytes (JSON sibling)

---

## Phase 3 — Verify each required section is populated

**Status:** PASS structurally; PARTIAL on Q9 + Q11 + Q12 substance (findings surfaced)

All 13 required sections present + 2 appendices + ToC + Source 6 safety summary = **18 total `## ` headings**.

Per-question observations:

| Q | Status | Observation |
|---|---|---|
| Q1 — runs by run_mode | PASS | 23 admin_validation (12 success / 11 failed) + 7 production (7 success / 0 failed). Production failure rate = 0%. |
| Q2a — runs with positives by family | PASS structurally; FINDING | parent_relation in both modes (6 production + 4 admin_validation with positives); disagreement_axis admin_validation 2; misunderstanding_repair admin_validation 2 + **production 1 (synthetic test data — see Phase 3 Findings)**; **evidence_source_chain production 1 (synthetic)**; **resolution_progress production 1 (synthetic)**. |
| Q2b — runs by requested family | PASS | All 7 unsupported families and all 3 supported families appear; misunderstanding_repair production 1 (synthetic). |
| Q3 — by family + status | PASS | parent_relation: 10/0/0 (s/f/fb); disagreement_axis: 2/4/0; misunderstanding_repair: 3/4/0; etc. |
| Q4 — failure reasons | PASS | `mcp_validation_failed` is the primary value (11 rows); secondary values appear only on retried-then-recovered paths. |
| Q5 — positives by family | PASS | parent_relation 28; disagreement_axis 7; misunderstanding_repair 5; evidence_source_chain 1; resolution_progress 2; total 43 (matches intent brief §3 snapshot). |
| Q6 — top positive rawKeys by family | PASS | Within Family A: claim_addressed, scope_overlap_present, conclusion_addressed top the list; Family B: substantively_disagrees, disputes_generalization, disputes_value_judgment; Family C: provides_alternate_interpretation, scope_mismatch_identified, offers_candidate_understanding. |
| Q7 — recent positive density (7d) | PASS | Family A 14 positives in 7-day window; B + C as expected from smoke runs. |
| Q8 — Source 6 production filter present | PASS | "YES" assertion; `admin_validation` substring absent from Source 6 module file. Three-layer defense intact. |
| Q9 — duplicate runs | **PARTIAL — FINDING** | **3 duplicate-pair rows surfaced** for parent_relation (2 admin_validation + 1 production). All 3 use real `provider_key=mcp:classify_argument_boolean_observations` + `model_name=operator-mcp-server`. These are real duplicate runs against the same `(argument_id, family, run_mode, schema_version, provider_key, model_name)` tuple. → **`OPS-MCP-IDEMPOTENCY-HARDENING` authorized to file.** |
| Q10 — Family A auto-trigger recent | PASS | 2026-05-27: 5 production runs / 5 success / 0 failed; 2026-05-26: 1 production run / 1 success / 0 failed. Auto-trigger healthy. |
| Q11 — Family B + C admin_validation-only | **PARTIAL — FINDING** | disagreement_axis: 3 admin_validation (correct); misunderstanding_repair: 3 admin_validation + **1 production (synthetic test data; see Phase 3 Findings)**. |
| Q12 — unsupported-family attempts | **PARTIAL — FINDING** | 6 unsupported families show failed_attempts > 0 and `mcp_validation_failed` reason (correct rejection). `evidence_source_chain` shows `positives_observed=4` and `resolution_progress` shows `positives_observed=4` — both inflated by the Q12 SQL's permissive OR clause (see Phase 3 Findings § Q12 SQL semantic tightening). **True unsupported-family positives by strict family= match: 1 evidence_source_chain + 2 resolution_progress, all from a single synthetic test run.** |
| Q13 — over/under-firing summary | PASS | All 3 registered families show non-zero `completed_runs` and positive density signals; conservative-positives bias holding across the corpus. |

### Phase 3 Findings — investigated via follow-up queries

**Finding 1 — Q9: 3 duplicate successful runs (REAL, not synthetic).**

Direct row inspection via follow-up SQL:

| argument_id | family | run_mode | provider_key | model_name | duplicate_count |
|---|---|---|---|---|---|
| 781f8057-9e2a-4fa9-92a8-469676950ff7 | parent_relation | admin_validation | mcp:classify_argument_boolean_observations | operator-mcp-server | 2 |
| db0de3e0-24c6-40af-ba5f-2844acfa5bac | parent_relation | admin_validation | mcp:classify_argument_boolean_observations | operator-mcp-server | 2 |
| ea82a836-f5d2-4ece-bd34-ed5a57409dde | parent_relation | production | mcp:classify_argument_boolean_observations | operator-mcp-server | 2 |

These are REAL operational duplicate runs — same argument_id × family × mode × provider × model. Likely caused by:
- Repeated admin_validation smoke runs against the same 3 seeded args across Family B and Family C smokes (the 2 admin_validation rows).
- Family A auto-trigger firing twice for the same production argument (the production-mode row).

**Action:** File `OPS-MCP-IDEMPOTENCY-HARDENING` — add an idempotency check at the Edge Function layer that detects same-tuple successful runs and either skips or upserts.

**Finding 2 — Q11 + Q12: historical synthetic test data contaminating aggregates.**

Direct row inspection via follow-up SQL shows ALL 3 unsupported-family positive rows + the 1 misunderstanding_repair production-mode run trace to a single synthetic test seed:

| row | family | raw_key | provider_key | model_name | run_mode | created_at |
|---|---|---|---|---|---|---|
| 1 | evidence_source_chain | evidence_gap_present | smoke-mcp:test-server | smoke-test-model-v1 | production | 2026-05-26 05:56:33 |
| 2 | resolution_progress | synthesis_proposed | smoke-mcp:test-server | smoke-test-model-v1 | production | 2026-05-26 05:56:33 |
| 3 | resolution_progress | concedes_narrow_point | smoke-mcp:test-server | smoke-test-model-v1 | production | 2026-05-26 05:56:33 |
| run | (5 positives across parent_relation + misunderstanding_repair) | — | smoke-mcp:test-server | smoke-test-model-v1 | production | 2026-05-26 05:56:33 |

All 3 unsupported-family rows + the misunderstanding_repair production run share:
- `provider_key="smoke-mcp:test-server"` (NOT the real `mcp:classify_argument_boolean_observations`)
- `model_name="smoke-test-model-v1"` (NOT a real model name)
- `created_at=2026-05-26 05:56:33.772763+00` (same insertion timestamp)
- `requested_families=["evidence_source_chain","resolution_progress"]` or `["parent_relation","misunderstanding_repair"]` (multi-family arrays)

This is **leftover synthetic test data** from MCP-021B/C development. It is NOT a live security issue (the rows pre-date Family B+C ship and Family C's `productionEnabled: false` flag). It IS a hygiene issue:
- Q11's "all admin_validation" binding assertion is contaminated by this one synthetic production row.
- Q12's `positives_observed` count for unsupported families is technically non-zero (synthetic).

**Actions:**
- File `OPS-MCP-TEST-DATA-CLEANUP`: identify all rows with `provider_key LIKE 'smoke-mcp:%'` (8 rows total: 1 run + 3 unsupported-family results + 2 parent_relation results + 2 misunderstanding_repair results). Decide whether to soft-delete or hard-delete (the underlying argument_id FK CASCADE behavior may handle this if the test args are also soft-deleted).
- File `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING`: the Q12 SQL `OR u.family_name = any(r2.requested_families)` clause over-counts. Tighten to `WHERE res.family = u.family_name` only (strict family= match). This would surface the 3 synthetic rows as a much clearer signal (1 + 2 = 3, not the inflated 4 + 4 = 8 cross-counted).

---

## Phase 4 — Verify default output safety

**Status:** PASS

Secrets / bearer-token grep:

```
grep -E "(BEGIN [A-Z ]+PRIVATE KEY|Bearer |service_role|apikey|ANTHROPIC_API_KEY|sk-ant-|xai-)" /tmp/ops-smoke/report.md
→ no matches
```

Doctrine ban-list grep (Appendix B excluded; the Appendix legitimately enumerates the banned tokens):

```
sed '/^## Appendix B/,$d' /tmp/ops-smoke/report.md | grep -iE "(winner|loser|fallacy|bad faith|manipulative|extremist|propagandist|liar|dishonest)"
→ no matches
```

Verdict-token grep (correct / incorrect as labels, excluding Appendix B):

```
sed '/^## Appendix B/,$d' /tmp/ops-smoke/report.md | grep -iwE "(correct|incorrect)"
→ no matches
```

Markdown file size: 13,553 bytes (well under the 100 KB sanity bound).

Appendix B verification: the 11 banned tokens appear in exactly ONE line of the markdown (Appendix B's doctrine-scan annotation: "Banned tokens scanned and absent from this report: …"). This is the doctrine-positive use case (the report tells the operator which tokens it scanned for and confirmed absent). Zero verdict tokens appear in section headings, table column names, table row values, or aggregate labels.

---

## Phase 5 — Targeted regression

**Status:** PASS

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage
→ Test Suites: 50 passed, 50 total
  Tests:       1048 passed, 1048 total
EXIT: 0
```

Full Jest suite (run during post-merge gates): `17,834 / 17,834 tests; 559 / 559 suites; 0 failed`.

Typecheck + lint exit 0.

---

## Phase 6 — OPS observations + verdict + audit doc commit

### Final verdict

**PARTIAL** — All structural and safety criteria PASS. PARTIAL is driven by real findings the report successfully surfaced (Q9 + Q11/Q12), not by any defect in the observability card itself.

* **Phase 1 PASS** (clean pre-flight; locked files byte-equal; predecessors present).
* **Phase 2 PASS** (report exit 0; both artifacts produced; all 14 SQL queries executed).
* **Phase 3 PARTIAL** (structural PASS — all 13 sections populated; substantive findings on Q9, Q11, Q12 surfaced as designed).
* **Phase 4 PASS** (no secrets / bodies / verdict-token labels in default output).
* **Phase 5 PASS** (50 suites / 1048 tests; typecheck + lint exit 0).

### Findings + follow-on cards filed

- [x] **`OPS-MCP-IDEMPOTENCY-HARDENING` — AUTHORIZED to file.** Q9 surfaced 3 real duplicate-run pairs against the same `(argument_id, family, run_mode, schema_version, provider_key, model_name)` tuple. Designer Stage 1 should evaluate Edge-Function-level idempotency check (upsert vs skip).
- [x] **`OPS-MCP-TEST-DATA-CLEANUP` — AUTHORIZED to file.** 8 rows trace to `provider_key="smoke-mcp:test-server"` synthetic test seed from 2026-05-26 05:56:33. Decide soft-delete vs hard-delete.
- [x] **`OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING` — AUTHORIZED to file.** Q12's `OR u.family_name = any(r2.requested_families)` clause over-counts cross-family positives in shared-family runs. Small SQL refinement: tighten to strict `WHERE res.family = u.family_name` only.

Optional (operator decides priority):
- `OPS-MCP-TOKEN-BUDGET` not authorized this audit — Q5 / Q7 did NOT surface truncation-suggestive density (all positive counts well within expected ranges for 3-args-per-smoke admin_validation traffic).

### Authorizations confirmed on PARTIAL

- `MCP-SERVER-005-FAMILY-D` remains AUTHORIZED with mandatory Stage-2B operator-decision checkpoint. Observability is operational and will inform the `ai_classifier` subset filter decision.
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` remains AUTHORIZED to design (lower priority than IDEMPOTENCY + TEST-DATA-CLEANUP).
- The 3 follow-on OPS cards above are AUTHORIZED to file.

### Observations

- **Observability surface validation:** the script's runtime safety check (exit 3 if Source 6 production filter missing) was not triggered; the literal `'production'` filter is intact at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`.
- **OAuth-free DB access:** the existing `npx supabase db query --linked --file <file>` Management API path works without any operator OAuth flow. Phase 0 + Phase 2 + Phase 3 follow-up queries all used this path.
- **Doctrine ban-list scan: zero false positives.** Banned tokens appear exactly once each, in Appendix B's enumeration line. No verdict tokens in any operator-facing label.
- **Test count progression:** Jest 17,712 baseline → 17,834 (+122 tests). Within design forecast band after consolidation.
- **Smoke-find rate confirmed:** the observability card found 2 real issues on its first run. This is the value proposition the intent brief argued for ("converts recurring manual SQL inspection into a repeatable surface").

### Operator cleanup

After audit doc commits, the following temp artifacts may be deleted:
- `/tmp/ops-smoke/report.md`
- `/tmp/ops-smoke/report.json`
- `/tmp/q12-true-positives.sql`
- `/tmp/q12-row-ages.sql`
- `/tmp/q11-mr-production.sql`
- `/tmp/ops-mcp-table-shape.sql`
- `/tmp/ops-mcp-indexes.sql`
- `/tmp/ops-mcp-counts.sql`
- `/tmp/ops-mcp-checks.sql`
- `/tmp/ops-postmerge-*.log`

None of these contain secrets (all DB query outputs were aggregate-only or fully redacted UUIDs).
