# OPS-MCP-OBSERVABILITY — Operator how-to-run + how-to-interpret

**Status:** Operator-facing documentation (post-merge usage).
**Source-of-truth design:** `docs/designs/OPS-MCP-OBSERVABILITY.md`
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-intent.md`

---

## What this is

A read-only operator script that runs 14 SQL queries against the
linked Supabase project and emits a doctrine-safe markdown + JSON
report answering 13 telemetry questions about the multi-family MCP
classifier (`argument_machine_observation_runs` +
`argument_machine_observation_results`).

The report consolidates inspections that prior smokes (Family A
prod, Family B, Family C) had to do ad-hoc on the side. It is
intended for:

- **Family D Stage-2B operator-decision checkpoint** — see Q5, Q6, Q7,
  Q13 for cross-family calibration.
- **`OPS-MCP-IDEMPOTENCY-HARDENING` triage** — Q9 surfaces duplicate
  successful runs.
- **`OPS-MCP-TOKEN-BUDGET` triage** — Q7 + Q5 surface density that
  may suggest truncation risk.
- **`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`** — Q11 confirms B+C are
  still admin-validation-only in DB; Q5 + Q6 give calibration
  evidence for the production-flip decision.

---

## How to run

```bash
# Default — emits markdown + JSON to ./out/ops-observability/<UTC-timestamp>/
node scripts/ops/mcp-observability-report.mjs

# Custom output directory
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/my-report

# Custom recency window for Q7 / Q10 (default 7 days)
node scripts/ops/mcp-observability-report.mjs --time-window-days 14

# Dry-run (validates + scans but does not write)
node scripts/ops/mcp-observability-report.mjs --no-write

# JSON only (no markdown)
node scripts/ops/mcp-observability-report.mjs --json-only

# Show help
node scripts/ops/mcp-observability-report.mjs --help
```

### Prerequisites

- `npx supabase login` was previously completed (the script uses the
  operator's authenticated Management API session; no service-role
  key is read or stored).
- The project is linked: `npx supabase link --project-ref <ref>` was
  previously completed (the script invokes `--linked`).
- Node 20+.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success; markdown + JSON written; doctrine scan clean |
| 1 | At least one SQL file failed to execute (CLI exit preserved) |
| 2 | Doctrine ban-list scan triggered in stitched output |
| 3 | Source 6 safety check failed (binding production filter missing) |
| 4 | Evidence preview safety check failed |
| 5 | CLI argument parse error |

---

## How to interpret the report

The report has 13 sections, one per telemetry question, plus a
Source 6 safety summary header, Appendix A (family registry), and
Appendix B (doctrine scan note).

### Q1 — Runs by run_mode

Two rows expected (assuming both production and admin_validation have
seen traffic): `admin_validation` and `production`. The Family A prod
smoke + auto-trigger should populate the production row; Family B+C
admin smokes populate the admin_validation row.

**Healthy state:**
- `success_count` >> `failed_count` in production.
- `fallback_count` always 0 (the runner does not have a fallback path
  enabled).

### Q2a — Runs by family (positive-firing)

Counts runs that produced at least one positive result row. Family
attribution from `results.family`.

### Q2b — Runs by requested family (all attempts)

Counts every run that requested a family, including failed and
zero-positive runs. Family attribution from
`unnest(runs.requested_families)`.

The two together: Q2a ≤ Q2b per (family, run_mode) pair. The
multi-family test enforces this invariant.

### Q3 — Runs by family and status

Cross-tab of family × run_mode × status. Family attribution via
unnest (failed runs may have no `results` rows).

### Q4 — Top failure reasons by family

`failure_reason` values are server-controlled enum-like strings
(`mcp_validation_failed`, etc.) — NOT user content. Safe to display
verbatim.

**Healthy state:**
- Unsupported-family attempts surface as `mcp_validation_failed`.
- No unexpected failure_reason values.

### Q5 — Positive results by family

Aggregates positive result rows by family + run_mode. Includes
confidence band counts (high/medium/low).

**Healthy state:**
- `distinct_raw_keys` is reasonable (e.g., Family A has 16 possible
  keys; observing 8 distinct keys is healthy coverage).
- `high_confidence_count` is non-negligible for production runs.

### Q6 — Top positive raw_keys by family

Surfaces the concentration of positive signal across the 47 supported
raw_keys (Family A=16, B=14, C=17).

**Healthy state:**
- Top raw_keys are well-distributed (no single key dominating without
  others appearing).
- Top raw_keys are from the registered taxonomy.

### Q7 — Positive density (recent window)

For each family + run_mode pair, runs in the last 7 days + positives
per run.

**Healthy state:**
- Family A production: continuous positives (auto-trigger is firing).
- Family B+C admin_validation: positives during smoke windows; idle
  outside.

### Q8 — Source 6 production filter present

Script-level assertion that re-reads
`src/features/nodeLabels/machineObservationPersistenceQuery.ts` and
asserts the literal `.eq('argument_machine_observation_runs.run_mode',
'production')` substring is present and `'admin_validation'` is
absent. Plus a supporting DB row count.

**Healthy state:**
- "Source 6 production filter present: YES."
- "admin_validation substring absent from Source 6 module: YES."
- The script exits 3 if either check fails.

### Q9 — Duplicate runs

Groups successful runs by (argument_id, family, run_mode,
schema_version, provider_key, model_name). Any tuple with > 1
successful run is a duplicate candidate.

**Healthy state:** zero rows.

If Q9 returns non-zero rows, file `OPS-MCP-IDEMPOTENCY-HARDENING` per
intent brief §15.

### Q10 — Family A auto-trigger recent activity

Day-by-day count of Family A (`parent_relation`) production-mode
runs in the last 7 days.

**Healthy state:** continuous days of `production_runs > 0`
indicating the auto-trigger is alive.

### Q11 — Family B + C admin-validation-only check

DB confirmation that `disagreement_axis` and `misunderstanding_repair`
have not received production-mode traffic. Cross-checked against the
script-level registry parse of `familyRegistry.ts`.

**Healthy state:** All Q11 rows have `run_mode = 'admin_validation'`.

### Q12 — Unsupported-family attempt visibility

For each of the 7 unsupported families (D-J), counts attempts +
failed attempts + `mcp_validation_failed` attempts. **Binding
assertion:** `positives_observed = 0` for every unsupported family.

**Healthy state:** All Q12 rows have `positives_observed = 0`.

A non-zero positives_observed for an unsupported family is a
security-adjacent finding — file an immediate operator-only audit.

### Q13 — Over/under-firing summary

Operator-interpretive ratios per family + run_mode:
- `completed_runs` — successful run count
- `arguments_with_positives` — distinct argument coverage
- `raw_keys_observed` — distinct raw_keys per family
- `total_positives` — sum
- `avg_positives_per_run` — density
- `fraction_of_runs_with_any_positive`

Compare `raw_keys_observed` against the expected:
- Family A (parent_relation): 16 keys
- Family B (disagreement_axis): 14 keys
- Family C (misunderstanding_repair): 17 keys

The report does NOT label any family as "over-firing" or "under-firing"
in its output — the section title mirrors the operator's §6 question
wording but the data is interpretive. Operator decides.

---

## Doctrine guarantees

The default report output:

- **Never** contains raw argument body text.
- **Never** contains full evidence span values (`evidence_span` is
  excluded from every SQL SELECT).
- **Never** contains secrets (no Authorization header, Bearer token,
  Anthropic key, service-role key, JWT).
- **Never** contains verdict / person-language tokens (no `winner`,
  `loser`, `fallacy`, `bad faith`, `manipulative`, `extremist`,
  `propagandist`, `liar`, `dishonest`, `correct`, `incorrect`).

These guarantees are enforced by:
- Source-scan tests over `scripts/ops/**` (`opsMcpObservabilityNoServiceRoleNoSecrets`).
- SQL safety tests over `scripts/ops/sql/*.sql`
  (`opsMcpObservabilitySqlSafety`).
- Ban-list scan over the stitched markdown
  (`opsMcpObservabilityDoctrineBanList`).
- The script itself runs the same ban-list scan over the markdown
  output before writing; failure triggers exit code 2.

### Optional `--include-evidence-preview` flag

When enabled, evidence spans MAY be surfaced — but every excerpt is:
1. Truncated to 120 chars BEFORE inspection.
2. Doctrine-scanned for banned tokens AFTER truncation.
3. Refused at write time (exit code 4) if the scan finds a banned
   token in the truncated window.

The default smoke does NOT use this flag.

---

## Where artifacts go

Default output directory:

```
./out/ops-observability/<UTC-timestamp>/report.md
./out/ops-observability/<UTC-timestamp>/report.json
```

The `out/` directory is **gitignored** — these are local-only
artifacts. Reviewers operate on the audit template
(`docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md`) which embeds
the relevant findings inline.

---

## Running a single SQL file standalone

Each SQL file is independently runnable:

```bash
npx supabase db query --linked --file scripts/ops/sql/01-runs-by-run-mode.sql
npx supabase db query --linked --file scripts/ops/sql/09-duplicate-runs.sql
# etc.
```

This is the design's "Decision D1 hybrid C" path — the SQL files are
the source-of-truth queries; the Node script orchestrates them and
adds the safety + stitching layer.

---

## Known limitations

1. **No latency telemetry per call.** The schema only has
   `started_at` / `completed_at`; per-token-count instrumentation is
   `OPS-MCP-TOKEN-BUDGET` (future card).
2. **All-time aggregates by default.** Q7 and Q10 use a 7-day overlay
   for recency, configurable via `--time-window-days`. Other queries
   are all-time.
3. **One operator session per run.** Each invocation re-authenticates
   the supabase CLI; 14 sequential SQL invocations take ~15-20s.
   Acceptable for manual audit; not cron-friendly.
4. **No alerting integration.** This is a manual report tool.
   `OPS-MCP-ALERTING` is future work.

---

## Out of scope

Per the intent brief §7 + the design §out-of-scope-explicit-list:

- No taxonomy changes.
- No prompt changes.
- No MCP server runtime behavior changes.
- No production-mode flip for Family B/C.
- No auto-trigger changes.
- No Source 6 rendering changes.
- No UI.
- No new tables / migrations.
- No view.
- No alerting integration.
- No third-party observability vendor.
- No service-role usage.
- No live DB calls in unit tests.
