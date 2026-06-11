# OPS-MCP-OBSERVABILITY — Operator how-to-run + how-to-interpret

**Status:** Operator-facing documentation (post-merge usage).
**Source-of-truth design:** `docs/designs/OPS-MCP-OBSERVABILITY.md`
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-intent.md`

---

## What this is

A read-only operator script that runs 19 SQL queries against the
linked Supabase project and emits a doctrine-safe markdown + JSON
report answering 18 telemetry questions about the multi-family MCP
classifier (`argument_machine_observation_runs` +
`argument_machine_observation_results`).

The report consolidates inspections that prior smokes (Family A
prod, Family B, Family C, Family D) had to do ad-hoc on the side. It
is intended for:

- **Family D operational visibility** — Q14 + Q15 (added by
  OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE) give per-family-per-mode
  signal density and Family-D 19-key Subset coverage.
- **`OPS-MCP-IDEMPOTENCY-HARDENING` triage** — Q9 surfaces duplicate
  successful runs.
- **`OPS-MCP-TOKEN-BUDGET` triage** — Q7 + Q5 surface density that
  may suggest truncation risk.
- **`MCP-021C-EDGE-FAMILIES-B-C-ENABLE` post-flip verification** —
  Q11 (reframed by OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE) confirms
  B+C have production AND admin_validation activity after the flip,
  with Family D admin_validation-only visibility.

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

The report has 16 sections, one per telemetry question, plus a
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

Surfaces the concentration of positive signal across the 84 supported
raw_keys (Family A=16, B=14, C=17, D=19, G=18). Family E (16 keys) and
F (14 keys) are queued behind their respective observability backfill
cards; until then their density renders as `null` and their raw_keys
are not counted in the total. Family H (12 keys, uniform ai_classifier)
and Family I (6-key ai_classifier Subset; 15 deterministic keys
excluded) are backfilled by OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE —
H via the Q14 CASE branch only (uniform source, no subset file), I via
its Q14 branch plus the dedicated Q17 subset-coverage query.

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

### Q11 — Per-family per-mode coverage

Reframed by OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE (Card 1 of 3) and
extended by OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE. The section now
surfaces run counts and status breakdown across ALL registered
families and both run_modes, providing a single coverage table that
captures the 5-family carrier-forward state:

- Family A (`parent_relation`): production + auto-trigger + admin_validation
- Family B (`disagreement_axis`): production + admin_validation
- Family C (`misunderstanding_repair`): production + admin_validation
- Family D (`evidence_source_chain`): admin_validation only (19-key
  ai_classifier Subset)
- Family G (`resolution_progress`): production + admin_validation
  (18-key ai_classifier Subset)
- Families E, F, H-J: see operator notes (E, F production-enabled;
  H Card-1 admin_validation; I, J unsupported)

Columns: `requested_family`, `run_mode`, `run_count`, `success_count`,
`failed_count`, `fallback_count`.

The query makes NO assumption that any family is mode-restricted; it
reports the actual observed state. The operator interprets per the
Edge registry (Appendix A).

**Preservation property:** the original Q11 (Family B + C
admin-validation success counts) is a strict subset of this output —
filter to `requested_family in ('disagreement_axis',
'misunderstanding_repair') and run_mode = 'admin_validation'` and read
the `success_count` column.

**Healthy state:**
- A+B+C have rows in both `production` and `admin_validation`.
- D has rows only in `admin_validation` (Stage 2B subset path).
- `success_count + failed_count + fallback_count = run_count` for
  every row.

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
- Family D (evidence_source_chain): 19 keys (Subset; 8 deterministic
  excluded)
- Family G (resolution_progress): 18 keys (Subset; 12 deterministic
  excluded)

The report does NOT label any family as "over-firing" or "under-firing"
in its output — the section title mirrors the operator's §6 question
wording but the data is interpretive. Operator decides.

### Q14 — Per-family per-mode signal density

Added by OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE (Card 1 of 3). For
each (family, run_mode) pair, computes the per-(run, possible_key)
signal density: the fraction of (run × key) cells that fired positive.

**Formula:** `positives / (runs × family_key_count)`

`family_key_count` is hardcoded per family from the binding contract
in `mcp-server/lib/family[ABCD]Keys.ts`:

| Family | Key count | Source file (citation) |
| --- | --- | --- |
| parent_relation | 16 | mcp-server/lib/familyAKeys.ts:49 |
| disagreement_axis | 14 | mcp-server/lib/familyBKeys.ts:53 |
| misunderstanding_repair | 17 | mcp-server/lib/familyCKeys.ts:61 |
| evidence_source_chain | 19 | mcp-server/lib/familyDKeys.ts:85 (Subset; 8 deterministic excluded) |
| resolution_progress | 18 | mcp-server/lib/familyGKeys.ts:99 (Subset; 12 deterministic excluded) |
| others (E, F, H-J) | 0 | not yet backfilled (E/F observability cards queued; H Card 1 landed 2026-05-30) |

`nullif(runs * family_key_count, 0)` handles zero-runs and unsupported
families gracefully (density renders as `null` / `—`).

The query **does NOT filter `status='success'`** — a failed run
consumed (run × key) attempt cells and is included in the denominator.
Q13 already provides the success-only `avg_positives_per_run` signal;
Q14 complements with the all-runs density.

**Use cases:**
- Compare Family D's 19-key admin_validation density to Family A's
  16-key production density.
- Compare production vs admin_validation per family.
- Spot over- or under-firing patterns (operator interprets; the report
  applies no verdict label).

### Q15 — Family D 19-key subset coverage

Added by OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE (Card 1 of 3).
Family-D-scoped query that verifies the Stage-2B Subset-path contract
holds in the persisted data.

**The 19-vs-27 distinction (binding context):**

Family D (`evidence_source_chain`) has 27 entries in the upstream Edge
taxonomy registry (`src/features/nodeLabels/machineObservationDefinitions/familyD.ts`):

- **19 ai_classifier-source rawKeys** (the "Subset") — routed to the
  MCP server per the Stage 2B operator decision.
- **8 deterministic rawKeys** split across `auto_metadata` and
  `lifecycle` — intentionally excluded from the MCP path. A future
  Edge/app-side card will compute these app-side without an Anthropic
  call. (`source_requested` and `quote_requested` each appear twice
  in the upstream taxonomy across the two source-types, so the unique
  excluded-string count is 6.)

Source-of-truth files:
- 19-key list: `mcp-server/lib/familyDKeys.ts:85-105` (`FAMILY_D_RAW_KEYS`)
- excluded list: `mcp-server/lib/familyDKeys.ts:119-129` (`FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS`)

**`subset_membership` values:**

| Value | Meaning |
| --- | --- |
| `ai_classifier_subset` | The observed raw_key is in the 19-key Subset — expected and healthy. |
| `deterministic_excluded_leak` | The observed raw_key is one of the 6 deterministic-excluded strings — would indicate a leak from somewhere outside the MCP path. Expected count: 0. |
| `unknown_key_outside_taxonomy` | The observed raw_key is neither in the Subset nor in the excluded list — would indicate a registry-vs-DB inconsistency or a stale row. |

**ORDER BY** prioritizes `deterministic_excluded_leak` first so any
security-adjacent finding lands at the top of the section.

**Healthy state:** all rows have `subset_membership =
'ai_classifier_subset'`; zero `deterministic_excluded_leak` rows; zero
`unknown_key_outside_taxonomy` rows.

A non-zero `deterministic_excluded_leak` count is a security-adjacent
finding worth surfacing for operator investigation.

### Q16 — Family G 18-key subset coverage

Added by OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE (sibling card to
D-COVERAGE). Family-G-scoped query that verifies the Stage-2B
Subset-path contract holds in the persisted data for
`resolution_progress`.

**The 18-vs-30 distinction (binding context):**

Family G (`resolution_progress`) has 30 entries in the upstream Edge
taxonomy registry (`src/features/nodeLabels/machineObservationDefinitions/familyG.ts`):

- **18 ai_classifier-source rawKeys** (the "Subset") — routed to the
  MCP server per the Stage 2B operator decision.
- **12 deterministic rawKeys** split across `auto_metadata` (5) and
  `lifecycle` (7) — intentionally excluded from the MCP path. A future
  Edge/app-side card will compute these app-side without an Anthropic
  call.

Source-of-truth files:
- 18-key list: `mcp-server/lib/familyGKeys.ts:99-118` (`FAMILY_G_RAW_KEYS`)
- excluded list: `mcp-server/lib/familyGKeys.ts:136-151`
  (`FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS`)

**Disambiguation footnote:** Family G has intentional name-pairs
across sources. `narrows_claim` (ai_classifier, move-intrinsic) is
distinct from `narrowed` (lifecycle, cluster state).
`concedes_narrow_point` (ai_classifier) is distinct from `conceded`
(lifecycle). `ready_for_synthesis` (ai_classifier, move) is distinct
from `synthesis_ready` (lifecycle, cluster) which is distinct from
`synthesis_candidate` (auto_metadata). The MCP subset takes ONLY the
ai_classifier member of each pair.

**`subset_membership` values:** (same 3 values as Q15)

| Value | Meaning |
| --- | --- |
| `ai_classifier_subset` | The observed raw_key is in the 18-key Subset — expected and healthy. |
| `deterministic_excluded_leak` | The observed raw_key is one of the 12 deterministic-excluded strings — would indicate a leak from somewhere outside the MCP path. Expected count: 0. |
| `unknown_key_outside_taxonomy` | The observed raw_key is neither in the Subset nor in the excluded list — would indicate a registry-vs-DB inconsistency or a stale row. |

**ORDER BY** prioritizes `deterministic_excluded_leak` first so any
security-adjacent finding lands at the top of the section.

**Healthy state:** all rows have `subset_membership =
'ai_classifier_subset'`; zero `deterministic_excluded_leak` rows; zero
`unknown_key_outside_taxonomy` rows.

**Doctrine note (Family G specific):** Family G's concession /
synthesis / settlement keys (`concedes_broader_point`,
`concedes_narrow_point`, `accepts_settlement_terms`,
`synthesis_proposed`, etc.) are SCORING REPAIRS per
`point-standing-economy`, NEVER defeats. A high positive count for
`concedes_broader_point` is a structural observation of relinquishment,
NOT a verdict that one side lost. The report's section title and
ORDER BY logic carry no verdict overlay; the operator interprets per
`cdiscourse-doctrine §1`.

### Q17 — Family I 6-key subset coverage

Added by OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE (Family I sibling to
the D + G subset queries). Family-I-scoped query that verifies the
Stage-2B Subset-path contract holds in the persisted data for
`thread_topology`.

**The 6-vs-21 distinction (binding context):**

Family I (`thread_topology`) has 21 entries in the upstream Edge
taxonomy registry (`src/features/nodeLabels/machineObservationDefinitions/familyI.ts`):

- **6 ai_classifier-source rawKeys** (the "Subset") — the
  text-derivable thread-graph relations routed to the MCP server per
  the Stage 2B operator decision.
- **15 deterministic rawKeys** split across `auto_metadata` (8) and
  `lifecycle` (7) — intentionally excluded from the MCP path (the 8
  auto_metadata keys are argument-tree-structure-derived; the 7
  lifecycle keys are cluster/temporal-derived). A future Edge/app-side
  card will compute these app-side without an Anthropic call.

Source-of-truth files:
- 6-key list: `mcp-server/lib/familyIKeys.ts:92-99` (`FAMILY_I_RAW_KEYS`)
- excluded list: `mcp-server/lib/familyIKeys.ts:117-135`
  (`FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS`)

**Minority-subset asymmetry:** unlike Family D (22 of 30 routed) and
Family G (21 of 33 routed), Family I routes only the MINORITY of its
keys (6 of 21). A misrouted deterministic key has a 15/21 chance of
landing in the excluded set, so this leak-detection query is *more*
load-bearing for Family I than for D or G. All 21 Family I strings are
unique within the family (no name-pair collision), so the included(6)
and excluded(15) sets are disjoint.

**`subset_membership` values:** (same 3 values as Q15 / Q16)

| Value | Meaning |
| --- | --- |
| `ai_classifier_subset` | The observed raw_key is in the 6-key Subset — expected and healthy. |
| `deterministic_excluded_leak` | The observed raw_key is one of the 15 deterministic-excluded strings — would indicate a leak from somewhere outside the MCP path. Expected count: 0. |
| `unknown_key_outside_taxonomy` | The observed raw_key is neither in the Subset nor in the excluded list — would indicate a registry-vs-DB inconsistency or a stale row. |

**ORDER BY** prioritizes `deterministic_excluded_leak` first so any
security-adjacent finding lands at the top of the section.

**Healthy state:** all rows have `subset_membership =
'ai_classifier_subset'`; zero `deterministic_excluded_leak` rows; zero
`unknown_key_outside_taxonomy` rows.

**Doctrine note (Family I specific):** Family I's thread-topology keys
(`introduces_new_issue`, `returns_to_prior_issue`, `compares_options`,
etc.) are DESCRIPTIVE STRUCTURE per `cdiscourse-doctrine §1` —
introducing a new issue is not a derailment, returning to a prior
issue is not repetition, and comparing options never adjudicates
between the options. The `references_external_context` key records only
the structural fact of an external reference and NEVER grants factual
standing (`cdiscourse-doctrine §3` — popularity is not evidence). Per
`point-standing-economy`, Family I emits no standing delta.

### Q18 — Unclean-span key drops by family

Added by OPS-MCP-KEY-LEVEL-FAIL-CLOSED. Counts SUCCESS runs that dropped
>= 1 key by OMISSION (key-level fail-closed) because that key's
`evidenceSpan` tripped the byte-unchanged doctrine ban-scan, grouped by
family + `run_mode` + the `unnest`-ed dropped rawKey NAME, over a recent
30-day window. The query reads the new additive nullable
`argument_machine_observation_runs.dropped_unclean_span_keys text[]`
column.

**What key-level fail-closed is:** when ONE Family J `evidenceSpan`
tripped the ban-scan, the prior behavior failed the WHOLE response packet
(`validation_failed` / `doctrine_ban_list`), discarding the clean sibling
keys' Observations. Key-level fail-closed instead OMITS the unclean key
(it never returns and never persists its span) while the clean siblings
survive. It relaxes NOTHING — the ban-scan patterns are byte-unchanged and
no unclean span ever reaches the wire, the Edge, the DB, or the client.

**Columns:** `family`, `run_mode`, `dropped_raw_key`, `runs_with_drop`,
`distinct_arguments`. NAMES ONLY — the query surfaces the dropped rawKey
NAME (e.g. `needs_pre_send_pause`) and per-key counts; it NEVER reads a
body or a span.

**Advisory, never a gate:** a sustained drop rate on one key is the
operator's cue that prompt iteration is warranted for that key's
span-anchoring. The per-key DROP RATE is ADVISORY (`cdiscourse-doctrine
§1`) — it never gates, never disarms, never flips a family posture. The
per-key drop ITSELF is fail-closed validation at the key scope.

**Scope (first ship):** Family J (`sensitive_composer`) only — it is
admin-validation-only (`productionEnabled:false`) and uses the
direct-dispatch persistRun path, so production rows here should be empty
until a widening follow-up (which would re-create `finalize_classifier_job`
to write the column on the drainer SUCCESS branch).

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
   the supabase CLI; 16 sequential SQL invocations take ~18-25s.
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
