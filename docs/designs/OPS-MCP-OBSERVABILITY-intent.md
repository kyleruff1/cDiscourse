# OPS-MCP-OBSERVABILITY — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** OPS — Machine Observation operational telemetry
**Predecessor chain on main:**
- `MCP-SERVER-004-FAMILY-C-SMOKE` PASS at `70b18f2`
- `MCP-SERVER-003-FAMILY-B-SMOKE` PASS at `05b42c3`
- `MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE` PASS at `e281753`
- `OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE` PASS at `21f1b0b`
- Family A production + auto-trigger live; Family B admin_validation; Family C admin_validation; D-J unsupported

---

## 1. Why observability is now justified

Three classifier families are now operational on the hosted MCP server. The
MCP-SERVER-004-FAMILY-C-SMOKE audit at `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-2026-05-27.md`
explicitly records this card as **STRONGLY RECOMMENDED before Family D**:

> "3 families now operational; per-family telemetry now valuable for Family D
> calibration."

The decision rationale records three concurrent pressures:
1. **Ad-hoc SQL on every smoke:** every Family-N smoke (A prod, A auto-trigger,
   B, C) has required an operator-authored or claude-authored one-off SQL
   inspection to verify positive density, failure reasons, and Source 6
   production-only filter integrity. The Family C smoke explicitly deferred
   persistence readback because Supabase MCP requires OAuth — observability
   would have provided the readback path natively.
2. **Family D mandatory Stage-2B checkpoint:** Family D has compound-key
   collision risk and an `ai_classifier` subset filter decision. The operator
   needs aggregate signal-density evidence (Family A + B + C calibration) at
   design time to inform the subset filter choice. Without observability, that
   evidence is reconstructed manually from each smoke audit.
3. **Family A/B/C calibration drift risk:** the conservative-positives bias
   was tuned on small fixture sets. Real-corpus signal density across 3
   families is now a question observability can answer; without it, drift
   can accumulate silently for many cards.

---

## 2. Predecessor smoke evidence (live DB snapshot at brief authoring)

Sampled at brief-authoring time via `npx supabase db query --linked`:

| Counter | Value | Source |
| --- | --- | --- |
| Total runs (`argument_machine_observation_runs`) | 30 | `select count(*)` |
| Production-mode runs | 7 | `where run_mode='production'` |
| Admin_validation-mode runs | 23 | `where run_mode='admin_validation'` |
| Successful runs | 19 | `where status='success'` |
| Failed runs | 11 | `where status='failed'` |
| Fallback runs | 0 | `where status='fallback'` |
| Total positive result rows | 43 | `select count(*) from argument_machine_observation_results` |

The 30 runs and 43 result rows are accumulated from:
- Family A production auto-trigger (`MCP-021C-AUTO-TRIGGER-FAMILY-A`).
- Family A prod smoke admin_validation traffic (`MCP-021C-FAMILY-A-PROD-SMOKE`).
- Family B admin_validation smoke (`MCP-SERVER-003-FAMILY-B-SMOKE` — 3 args).
- Family C admin_validation smoke (`MCP-SERVER-004-FAMILY-C-SMOKE` — 3 args, 3 positives).
- 7 unsupported-family rejection probes from each smoke (D-J).

This is the real corpus the observability surface will operate against on
day 1. The dataset is small but exercises all 4 expected run_mode + status
combinations.

---

## 3. Persistence schema (DB-level facts the designer must internalize)

Sampled via `information_schema.columns` + `pg_constraint`:

### `public.argument_machine_observation_runs`

| Column | Type | Nullable | Notes |
| --- | --- | --- | --- |
| `id` | uuid | NO | PK |
| `debate_id` | uuid | NO | FK debates |
| `argument_id` | uuid | NO | FK arguments |
| `schema_version` | text | NO | currently `mcp-021.machine-observations.boolean.v1` |
| `requested_families` | text[] | NO | the families the caller asked for; default `'{}'` |
| `provider_key` | text | YES | provider identifier (e.g. `mcp`, `direct_anthropic`) |
| `model_name` | text | YES | model identifier |
| `input_hash` | text | YES | reserved |
| `status` | text | NO | CHECK `IN ('success', 'failed', 'fallback')` |
| `failure_reason` | text | YES | populated only when status != 'success' |
| `started_at` | timestamptz | NO | |
| `completed_at` | timestamptz | YES | populated on terminal state; enables latency = completed_at - started_at |
| `created_at` | timestamptz | NO | |
| `run_mode` | text | NO | CHECK `IN ('production', 'admin_validation')` |

Indexes:
- `argument_machine_observation_runs_pkey` (id)
- `amor_runs_argument_version_completed_idx` (argument_id, schema_version, completed_at DESC NULLS LAST)
- `argument_machine_observation_runs_run_mode_idx` (run_mode) — **direct index on run_mode; group-by-run_mode queries are fast**

### `public.argument_machine_observation_results`

| Column | Type | Nullable | Notes |
| --- | --- | --- | --- |
| `id` | uuid | NO | PK |
| `run_id` | uuid | NO | FK runs |
| `debate_id` | uuid | NO | FK debates |
| `argument_id` | uuid | NO | FK arguments |
| `schema_version` | text | NO | mirrors runs |
| `raw_key` | text | NO | the rawKey that fired positive |
| `family` | text | NO | the family the rawKey belongs to (denormalized for query speed) |
| `confidence` | text | NO | CHECK `IN ('low', 'medium', 'high')` |
| `evidence_span` | text | YES | up to 240 chars per schema |
| `created_at` | timestamptz | NO | |

Indexes:
- `argument_machine_observation_results_pkey` (id)
- `amor_results_argument_version_rawkey_idx` (argument_id, schema_version, raw_key)
- `amor_results_run_idx` (run_id)
- `amor_unique_run_rawkey` UNIQUE (run_id, raw_key)

RLS: both tables are read-only for `authenticated`; visibility is delegated
through `runs.argument_id → arguments` (META-1A inherit pattern). Service-role
is the only write path (MCP-021C Edge Function).

**Key implications for the designer:**
- `run_mode` is a first-class column. Group-by-run_mode queries are
  index-supported.
- `family` is denormalized onto results rows (no need to JOIN through runs
  to find which family a positive belongs to).
- `requested_families` on runs is an `text[]` — for unsupported-family
  attempts that get rejected by registry, the run row still records what was
  requested.
- `completed_at - started_at` is the only latency signal available; no
  per-call token-count column exists today.

---

## 4. Source 6 binding constraint (must not weaken)

`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`:

```ts
.eq('argument_machine_observation_runs.run_mode', 'production');
```

This is the binding production-only filter at the rendering layer. The
observability surface MUST NOT alter, weaken, bypass, or shadow this filter.
The observability layer reads BOTH `production` and `admin_validation` rows
(for operator visibility) but the rendering chain stays production-only.

Existing tests under `__tests__/mcpOneTwoOneB*.test.ts` (10 files) pin this
filter:
- `mcpOneTwoOneBSourceSixAdapter.test.ts`
- `mcpOneTwoOneBDoctrine.test.ts`
- `mcpOneTwoOneBReadOnlyBoundary.test.ts`
- `mcpOneTwoOneBPersistedRowAdapter.test.ts`

Observability must not touch these tests; must not regress any assertion.

---

## 5. What questions operators currently answer manually

From the 4 prior smoke audits, the recurring manual inspections were:

1. **Per-family run counts.** Family A prod smoke counted production runs by
   hand; Family B and C smokes counted admin_validation runs from response
   payloads.
2. **Failure reasons in detail.** Every smoke reported "mcp_validation_failed"
   counts; nobody has yet validated that those reasons are unique to
   unsupported-family attempts vs other failure modes.
3. **Positive rawKey density.** Family C smoke noted "0 clarified positives"
   as a passing observation — but the inference was operator-eyeballed from a
   3-arg sample, not aggregate-derived.
4. **Production vs admin_validation separation.** Every Family-N smoke asserts
   Source 6 production-only filter is in place, but no smoke has counted how
   many admin_validation rows would HAVE rendered if the filter were absent.
5. **Cross-family raw_keys leak check.** Every smoke checks "all positives in
   the family's key set" per-response — but no smoke has run an aggregate
   check across all persisted results.
6. **Duplicate run detection.** No smoke has checked whether the same
   (argument_id, family, run_mode, schema_version, provider_key, model_name)
   tuple has multiple successful runs. Idempotency hardening (per launch
   text) depends on this signal.
7. **Recent failure-reason trend.** Operator-eyeballed from individual smoke
   audits; no time-window aggregate.

This card converts those into a repeatable surface.

---

## 6. Minimum telemetry questions (binding for designer)

The observability surface MUST answer these 13 questions (numbered as the
launch text enumerates):

1. How many runs exist by `run_mode`?
2. How many runs exist by family (via `requested_families` array unnest or via results.family)?
3. How many runs succeeded / failed by family?
4. What are the top `failure_reason` values by family?
5. How many positive result rows exist by family?
6. What are the top positive `raw_keys` by family?
7. For a recent time window, what is the positive density per family?
8. Are admin_validation rows excluded from production rendering? (binding
   assertion against `machineObservationPersistenceQuery.ts:127`)
9. Are production rows accumulating duplicates for the same
   `(argument_id, family, run_mode, schema_version, provider_key, model_name)` tuple?
10. Are Family A auto-trigger production runs happening recently?
11. Are Family B and C still admin_validation-only?
12. Are unsupported-family attempts (D-J) visible as failed runs without positive rows?
13. Can an operator identify whether a family is over-firing or under-firing from aggregate data?

---

## 7. Strict scope (IN / OUT)

### IN scope

- Read-only operational queries over `argument_machine_observation_runs` +
  `argument_machine_observation_results`.
- A repo-local operator script (`scripts/ops/mcp-observability-report.*`) or
  equivalent CLI helper that runs the queries and emits a safe summary.
- Checked-in SQL files under `scripts/ops/sql/` for reproducibility.
- Unit tests for the report shape + parser + doctrine scan.
- Source-scan tests asserting no raw body / no evidence span / no secrets
  in default output.
- A smoke audit template at `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md`.
- An operator-facing doc at `docs/ops/OPS-MCP-OBSERVABILITY.md` describing
  how to run the report and interpret the output.

### OUT of scope

- No taxonomy changes (`src/features/nodeLabels/**` is locked).
- No prompt changes (`mcp-server/lib/family[ABC]Prompt.ts` locked).
- No MCP server classifier behavior changes.
- No production-mode flip for Family B/C (`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`
  is a separate authorized-to-design card).
- No auto-trigger changes (Family A auto-trigger remains as-is).
- No Source 6 rendering changes.
- **No UI** unless the designer proves a minimal admin-only UI is the right
  first surface AND the operator approves it explicitly. Default is
  **script-first**.
- No new tables / migrations unless the designer proves the existing tables
  cannot answer the required questions. (Phase 0 evidence: existing tables
  CAN answer all 13 questions; no new tables expected.)
- No alerting infrastructure (PagerDuty, Slack webhooks, etc.).
- No third-party observability vendor (Datadog, Honeycomb, Grafana Cloud).
- No dashboards that require secrets in the client.

---

## 8. Default implementation preference

**Start with a repo-local operator script and/or SQL view/report, not a new UI.**

Preferred first surface:
- `scripts/ops/mcp-observability-report.mjs` (or `.sh` if pure bash is cleaner;
  designer to decide).
- Outputs safe aggregate telemetry only.
- No raw argument body text.
- No `evidence_span` text by default (optional `--include-evidence-preview`
  flag may be added if designer justifies; max 120 chars + doctrine scan
  required if so).
- No JWT / token / API key values.
- Can run against linked Supabase via the existing
  `npx supabase db query --linked --file <file>` pattern.
- Produces markdown or JSON summary suitable for audit docs.

If a dashboard / UI is proposed, **HALT for operator approval** before
implementation.

---

## 9. Telemetry safety rules (binding)

The observability surface MUST NOT print:
- JWTs.
- Bearer tokens.
- Anthropic API keys.
- Service-role keys.
- Raw argument body text.
- Raw model output.
- Full `evidence_span` content by default.

The observability surface MAY print:
- `family` id.
- `raw_key` (one of the 47 keys across Families A+B+C).
- `run_id` (uuid).
- `argument_id` (uuid).
- `run_mode` ('production' / 'admin_validation').
- `status` ('success' / 'failed' / 'fallback').
- `failure_reason` text values (these are server-controlled enum-like strings,
  not user content).
- Counts.
- Timestamps.
- Durations (computed from `completed_at - started_at`).
- `confidence` band ('low' / 'medium' / 'high').
- Aggregate evidence-length statistics (avg, max, min — but NOT the content).

**Evidence span inspection:** optional flag only; default off; if implemented,
max 120 chars per excerpt + doctrine scan over the excerpt before print;
designer must justify inclusion.

---

## 10. HALT triggers (designer + implementer + reviewer enforce)

Any ONE fires a HALT:

1. Proposes client-side service-role or direct DB access.
2. Proposes exposing secrets (Anthropic key, bearer token, service-role key).
3. Proposes printing raw argument bodies by default.
4. Proposes printing full evidence spans by default.
5. Proposes changing taxonomy.
6. Proposes changing classifier prompts.
7. Proposes changing MCP server runtime behavior.
8. Proposes enabling production mode for Family B or Family C.
9. Proposes modifying Source 6 rendering.
10. Proposes auto-trigger changes.
11. Proposes new tables/migrations before proving existing tables are insufficient.
12. Proposes UI before evaluating script/report first.
13. Weakens admin_validation / production separation.
14. Cannot distinguish production vs admin_validation rows.
15. Cannot group by family.
16. Cannot identify failure reasons.
17. Cannot identify rawKey positive density.
18. Test forecast exceeds +200 without rationale.
19. Requires OAuth / browser interaction for basic report generation.
20. Adds third-party observability vendor.
21. Dirty worktree includes smoke artifacts at PR creation.
22. Any doctrine verdict / person-language introduced in operator-facing report
    labels (e.g., "winner", "loser", "fallacy", "bad faith", "manipulative",
    "extremist", "propagandist", "correct", "incorrect" as verdict tokens).

---

## 11. Design questions (designer must answer)

The designer's `docs/designs/OPS-MCP-OBSERVABILITY.md` must explicitly resolve:

D1. **Script vs SQL view vs admin UI.** Default recommendation: script + SQL files;
    no view; no UI. Justify if deviating.
D2. **Output format.** Markdown? JSON? Both? Default: both, with markdown as
    the primary operator-facing artifact and JSON as a machine-readable
    sibling for follow-on tooling.
D3. **Default time window.** All-time? Last 7 days? Last 30 days? Default:
    all-time aggregates + a "last 7 days" overlay for trend detection.
D4. **Per-argument rows vs aggregates only.** Default: aggregates only by
    default; optional `--include-argument-detail` flag may emit per-argument
    rows with no body text.
D5. **Duplicate handling.** The duplicate-run query groups by
    `(argument_id, family, run_mode, schema_version, provider_key, model_name)`
    — but `family` is on results, not on runs. Designer must decide whether
    to unnest `requested_families` array or to join through results
    (with `DISTINCT family`) or both.
D6. **Family support status surface.** Static enumeration in the report?
    Derived from `mcp-server/lib/familyRegistryInit.ts`? Derived from
    `supabase/functions/_shared/booleanObservations/familyRegistry.ts`?
    Default: a static section in the report doc with citations to the source
    of truth; the runtime report annotates "expected supported" vs "observed
    in DB".
D7. **DB view necessity.** A view encapsulating Source 6's production-only
    filter could be reused. Default: NOT in this card (would require a
    migration); designer to confirm.
D8. **Smoke proof of correctness.** What does the smoke actually verify?
    Default: smoke runs the report against linked Supabase, asserts each of
    the 13 sections is present, asserts no banned tokens in default output,
    asserts production/admin_validation separation in the output.

---

## 12. Implementation options the designer should weigh

A. **Pure SQL files + a thin script that runs them sequentially and stitches the markdown.**
   - Simplest. Each SQL file is a single query. Script formats the
     results. SQL is version-controlled, reviewable, and replayable.
B. **Single Node script with embedded queries.**
   - All in one file. Marginally less reproducible (cannot run a query
     standalone via `npx supabase db query --linked --file <file>`).
C. **Hybrid: SQL files for the canonical queries + a small Node helper that
   adds aggregation logic that's awkward to express in plain SQL.**
   - Best balance for our needs. Designer's likely choice.

Designer should pick one and justify.

---

## 13. Tests (binding minimum coverage)

The designer must enumerate, but at minimum:

T1. Source-scan: the report's SQL files contain no `select *` over
    `arguments.body` or `evidence_span` without aggregation.
T2. Source-scan: the report's source files contain no service-role usage.
T3. Output shape: the report includes a `Run summary by run_mode` section.
T4. Output shape: the report includes a `Run summary by family` section.
T5. Output shape: the report includes a `Failure reasons` section.
T6. Output shape: the report includes a `Positive rawKey density` section.
T7. Output shape: the report includes a `Duplicate runs` section.
T8. Output shape: the report includes a `Source 6 safety` assertion section
    that re-checks `machineObservationPersistenceQuery.ts:127` line content
    (the literal `'production'` string).
T9. Doctrine: report output (when run against a synthetic fixture or
    JSON-fixture) contains no banned token.
T10. Empty-DB safety: the report handles 0 rows gracefully without producing
     `NaN`, `undefined`, or unhandled-promise output.
T11. Multi-family safety: the report correctly groups when all 3 families
     are present in the dataset.

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage`
- `npm test` (full suite at end)

Network discipline: unit tests MUST NOT make live DB calls. DB calls are
confined to the smoke audit, not the test suite. Use a JSON fixture for the
report-shape tests (designer to author).

Test forecast: +40 to +80 tests. HALT trigger fires at +200.

---

## 14. Smoke plan

Post-merge audit at `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-2026-05-27.md`:

### Phase 1 — Pre-flight
- HEAD at merge SHA + 1 (the audit commit being authored).
- Predecessor audits present (Family C smoke, Family B smoke, AUTO-TRIGGER A
  smoke, validator-refactor smoke).
- Hosted MCP `/health` OK.
- Edge Functions ACTIVE.
- DB shapes match the §3 snapshot (no schema drift).

### Phase 2 — Run the observability report against linked Supabase
- Invoke the report.
- Capture markdown + JSON.
- Confirm exit 0.

### Phase 3 — Verify each required section is present
- Per-family run counts (3 families + unsupported-attempts breakdown).
- Per-run_mode run counts (production + admin_validation).
- Failure reasons.
- Positive rawKey density.
- Duplicate-run query result (zero expected today; non-zero would surface
  `OPS-MCP-IDEMPOTENCY-HARDENING` candidate).
- Source 6 safety section asserting `production` filter still in place.

### Phase 4 — Verify default output safety
- Grep the report output for any of: `BEGIN PRIVATE KEY`, `Bearer `,
  `service_role`, `apikey`, `ANTHROPIC_API_KEY`, full UUID-shaped JWT
  patterns.
- Grep for verdict tokens: `winner`, `loser`, `fallacy`, `bad faith`,
  `manipulative`, `extremist`, `propagandist`, `liar`.
- Grep for raw body content: this is harder; designer must define how
  to assert "no body content was printed" (e.g., by counting characters of
  field types known to contain body content — none should be present in
  the default output).

### Phase 5 — Targeted regression
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage`
- All exit 0.

### Phase 6 — OPS observations + verdict + audit doc commit

PASS criteria:
- Report runs successfully against linked Supabase.
- Distinguishes production vs admin_validation.
- Groups by family.
- Includes positive rawKey density.
- Includes failure reasons.
- Confirms Source 6 production-only filter present.
- Default output has no raw body / evidence span / secrets.
- All tests pass.

PARTIAL:
- Report runs but some family has no data yet (Family A unsupported in some
  smoke window; acceptable; report should explicitly state "no data" rather
  than omit the section).
- Report lacks latency due to missing `completed_at` on some rows; record the
  limitation.

FAIL:
- Report prints raw bodies or secrets.
- Report cannot distinguish run_mode.
- Report cannot group by family.
- Report requires manual OAuth or browser interaction.
- Tests fail.

---

## 15. Future expansion path

Cards this observability surface enables / motivates:

- **`OPS-MCP-IDEMPOTENCY-HARDENING`** — if the duplicate-run query shows
  non-zero rows, a follow-on card adds idempotency checks at the Edge
  Function layer to prevent duplicate production runs.
- **`OPS-MCP-TOKEN-BUDGET`** — if per-family latency or per-call response
  length suggests truncation risk, a follow-on card adds token-count
  telemetry to runs (requires a migration) and informs whether Family D's
  27-key call needs MAX_TOKENS bump.
- **`OPS-MCP-OBSERVABILITY-DASHBOARD`** — eventual admin UI once the report
  pattern stabilizes and the operator wants a visual surface. NOT in this
  card.
- **`OPS-MCP-ALERTING`** — eventual alerting integration (Slack/PagerDuty)
  once failure-reason patterns are stable. NOT in this card.
- **`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`** — observability informs the
  decision on when to flip Family B and Family C to production mode.

---

## 16. Authorizations granted on PASS

If the post-merge smoke PASSes:

- `MCP-SERVER-005-FAMILY-D` remains authorized with mandatory Stage-2B
  operator-decision checkpoint (observability informs the subset filter
  decision).
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` remains authorized to design (lower
  priority).
- `OPS-MCP-IDEMPOTENCY-HARDENING` is **authorized to file** if the
  observability report's duplicate-run query returns non-zero rows during
  the post-merge smoke.
- `OPS-MCP-TOKEN-BUDGET` is **authorized to file** if observability surfaces
  latency or response-length signals that suggest truncation risk.

---

## 17. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/OPS-MCP-OBSERVABILITY.md` | Designer's binding plan; written by roadmap-designer subagent in Stage 1 |
| `scripts/ops/mcp-observability-report.*` | The operator-facing CLI; reads aggregate telemetry |
| `scripts/ops/sql/mcp-observability-*.sql` | Reproducible queries; each runnable standalone via `npx supabase db query --linked --file <file>` |
| `__tests__/opsMcpObservability*.test.ts` | Coverage for the report shape + parser + doctrine scan |
| `docs/ops/OPS-MCP-OBSERVABILITY.md` | Operator-facing doc on how to run + interpret |
| `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md` | Smoke template for post-merge audit |

---

## 18. Execution order (orchestrator-bound)

1. Phase 0 pre-flight (autonomous; DONE; this intent brief is the artifact).
2. **Stage 0** — commit + push this intent brief to `main`.
3. Phase B — create `feat/OPS-MCP-OBSERVABILITY` branch + GitHub issue.
4. Stage 1 — spawn roadmap-designer subagent (binding source: this brief +
   the §3 schema snapshot).
5. Stage 2 — conditional HALT evaluation against the 22 triggers.
6. Stage 3 — spawn roadmap-implementer subagent.
7. Stage 4 — spawn roadmap-reviewer subagent.
8. Stage 5 — PR + squash-merge + post-merge gates.
9. Post-merge — operator-or-claude runs the smoke; commit audit doc.

If any HALT fires, surface to operator and stop.
