# OPS-MCP-OBSERVABILITY-002 — Admin classifier health panel (aggregate read of `argument_machine_observation_runs`, first reader of `failure_detail`)

**Card:** OPS-MCP-OBSERVABILITY-002 (GitHub issue #470)
**Type:** admin Edge read path (counts + metadata-only CSV). GATE C — operator-only merge.
**Status:** DESIGN ONLY. No code, no migration, no Edge deploy in this card. Implementation is a later phase behind GATE A.
**Verified-at-HEAD:** `37ccd9e` (`37ccd9ed027c625686f3eee517d03a48df25a29d`, `git rev-parse HEAD`).

`autoMergeEligible: false` (Edge → GATE C). `requiresEdgeDeploy: true`. `requiresOperatorGateC: true`. `requiresMigration: false` (read-only against columns that already exist).

---

## Constitutional acceptance-gate invariant (stated verbatim, binding on this card)

> "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post."

This panel is an **operational diagnostic, never a gate**. It reads the run table after the fact. It exposes **no re-trigger button, no arm/disarm control, no routing dial, no family-registry flip** in v1. It cannot block, reject, route, or delay any user post — it has no write path to `public.arguments`, to the queue substrate, to env, or to the family registry. Per cdiscourse-doctrine §4-C (never-self-approve) the family-registry production flip is forbidden from any panel control.

---

## Scope

A read-only admin "classifier health" panel that aggregates the health of `public.argument_machine_observation_runs` and renders **counts only**, with filters and a **metadata-only CSV export**.

In scope:

1. **An admin Edge read function** (working name `admin-classifier-health`), JWT-verified + `profiles.role = 'admin'` gated, that returns aggregate **counts** of run rows grouped/filtered by:
   - `status` — the run-row status (`success | failed | fallback`; CHECK constraint at `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql:89-90`).
   - `state` — the queue lifecycle state including `dead_letter` (added by `20260528000021_arch_001_classifier_queue_substrate.sql`; per Phase 0 `card2_drainer_model`).
   - `failure_reason` — clustered (e.g. the Phase-7 dominant clusters `mcp_api_error`, `mcp_network_error`; `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md:46-57`).
   - `failure_sub_reason` (text, queue-substrate column).
   - `failure_detail->>'reason'` — the structured reason inside the leak-safe jsonb (this card is the **first reader**; see "first reader" note below).
   - `family` — derived from `requested_families` / the per-result `family` column.
   - `run_mode` — production vs admin-validation lane.
   - **time window** — `started_at` / `completed_at` range.
   - **`runTag`** — derived (see "runTag filter" below; overlaps #476).
2. **A "provider-error cluster" count row** — counts of the ambiguous provider buckets (`provider_server_error`, `mcp_api_error`, `mcp_network_error`) so an operator can see the dominant failure shape at a glance (per the `provider_server_error` bucketing memory note: the bucket is ambiguous; the real reason now lives in `failure_detail`).
3. **An H/I/J-leakage count row** — a single count that should be **zero** at all times: any run row whose `requested_families` / `family` includes `claim_clarity`, `thread_topology`, or `sensitive_composer` in `run_mode = 'production'`. This is a frozen-set tripwire (the panel observes it; it never flips it).
4. **A metadata-only CSV export** of the aggregate rows (counts + the grouping keys + plain-language reason labels). Same field allowlist as the JSON response.

Out of scope (Non-goals, below) is everything that could leak content or act as a control.

---

## Non-goals

- **No raw argument body.** The panel never selects, returns, or exports `public.arguments.body` or any excerpt of it.
- **No `evidence_span`.** `evidence_span` is a column on `argument_machine_observation_results` (`20260526000018_...:113`), not on the runs table. The panel reads the **runs** table for aggregates and **must never join to or surface `evidence_span`**.
- **No raw MCP payload / provider response / prompt.** Only the leak-safe `failure_detail` allow-listed fields (validator_path, reason, family, correlation_id, attempt_count, run_mode, schema_version) ever surface, and only via the existing structural allow-list — see §6 below.
- **No re-trigger / re-run / re-classify button (v1).** No control that enqueues, dispatches, or re-dispatches a classifier job.
- **No arm / disarm / routing-percentage control.** The panel does not read or write `CLASSIFIER_QUEUE_ROUTING_ENABLED` / `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`.
- **No family-registry flip.** No control toggles any `productionEnabled` flag. H/I/J stay `false` (`familyRegistry.ts:106,111,116`).
- **No per-user / per-author breakdown that names a person.** Counts are structural (by status/family/reason), never "user X failed N times" — §10a (Observations, not Allegations) and §1 (no person labels).
- **No new column, table, index, RLS policy, or migration.** Every field read already exists on `argument_machine_observation_runs`.
- **No score, heat, popularity, or truth surface.** This is a transport/health diagnostic only.

---

## Current production state

- The runs table `public.argument_machine_observation_runs` exists with `status CHECK IN ('success','failed','fallback')`, `requested_families text[]`, `failure_reason text`, `started_at`, `completed_at`, `run_mode` (queue-substrate), `state`, `failure_sub_reason text`, `dead_letter_reason text` (queue-substrate), and the additive nullable `failure_detail jsonb` (`20260602000001_ops_mcp_classifier_failure_detail.sql:113-114`).
- **`failure_detail` is WRITE-ONLY today.** The migration header states verbatim: *"WRITE-ONLY diagnostics: the drainer writes failure_detail alongside its existing terminal/retry failure writes; NOTHING reads it (no UI, no consumer, no view, no backfill)."* (`20260602000001_...sql:11-13`). **#470 is the named first READER** (Phase 0 `ops_observability_002_consumer`: *"OPS-MCP-OBSERVABILITY-002 (#470) is the named READ consumer … the column WRITE-ONLY today … #470 would be the first reader"*, `docs/testing-runs/2026-06-04-corpus-30-analysis.md:194`).
- **The queue drainer is the SOLE writer of `failure_detail` / `failure_sub_reason`** (Phase 0 `queue_drainer_is_sole_db_writer`; `classifierDrainerCore.ts:350-352,501-511,560-561`). It builds the value via `buildRunRowFailureDetail(...)` (`classifierRunRowFailureDetail.ts:142-192`) and passes it as `p_failure_detail` to `finalize_classifier_job`.
- **The direct-dispatch (auto-trigger) path leaves `failure_detail` + `failure_sub_reason` NULL by design.** `persistenceWriter.persistRun`'s insert payload omits both keys (`persistenceWriter.ts:83-96`); the typed `failureSubReason`/`failureDetail` ride only the in-memory `PerArgumentSummary` return and the structured log line (`autoTriggerDispatcher.ts:380-389`). Phase-7 confirmed `failure_sub_reason` NULL (all) and `failure_detail.reason` NULL (all) across every A–G family for the corpus (`docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md:46-57`).
- **Routing baseline is OFF.** `CLASSIFIER_QUEUE_ROUTING_ENABLED` unset = false; `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` default 0 (`submit-argument/index.ts:811-816`; `classifierQueueRouting.ts:89-98`). So **today almost all failed run rows come from the direct-dispatch path and have `failure_detail = NULL`** — only smoke-tagged (`[arch-001-queue-smoke]`) submits drain through the queue and populate it (`classifierQueueRouting.ts:51,173-174`).
- An existing aggregate-health Edge function `cutover-health-monitor` already reads `argument_machine_observation_runs` health via a `SECURITY DEFINER` RPC and returns **per-condition verdicts, no raw rows** (`supabase/functions/cutover-health-monitor/index.ts:101-137`). It is the closest existing shape to mirror.
- H/I/J `productionEnabled: false`; A–G `true` (`familyRegistry.ts:69-103` A–G true; `:106,111,116` H/I/J false).

---

## RCA / problem summary

Failure triage on the classifier path requires leaving the database and reading Deno Deploy logs (the motivating incident for the `failure_detail` column; `20260602000001_...sql:6-10`). Three prior investigations in the ARCH-001 + OPS-MCP cutover arc each had to pull provider logs because the run row recorded `failure_reason` but not the validator path or a correlation id. The `failure_detail` column closed the **write** half of that gap; it is currently WRITE-ONLY (`...sql:11-13`). **No surface reads it.** OPS-MCP-OBSERVABILITY-002 is the **read** half: a single admin panel that turns the run table into a self-describing aggregate health view so an operator can answer "what is failing, in which family, with which structured reason, in which window" without an ad-hoc SQL or a log pull.

Two cross-card facts shape the design:

1. **Soft dependency on the direct-dispatch fill card.** Because routing is OFF by default and direct-dispatch leaves `failure_detail` NULL, the panel's `failure_detail->>'reason'` column will be **mostly NULL** until `OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001` (the Phase-7 follow-up #2 fill card; `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md:107`) projects the in-memory detail onto direct-dispatch failed rows via the same `buildRunRowFailureDetail` allow-list. The panel is **valid without it** (it reads queue-drainer rows and the always-present `failure_reason`), but its `failure_detail` column only becomes broadly populated once the fill card lands. This is a **soft** dependency, recorded as an Open Question, not a blocker.
2. **`runTag` filter overlaps #476.** See the runTag filter section below.

---

## Why this is or is not a ceiling / limit

This is **not** a capacity or latency ceiling and does not touch the provider concurrency path. Capacity is solved off-path by the ARCH-001 Postgres async classifier queue (`docs/core/known-blockers.md:552,556`); #371/#373 are superseded (recorded-rejected — this card does not reopen or re-litigate them). The per-isolate provider cap (`providerConcurrency.ts`) is untouched.

The panel **reads** the run table; it imposes no new write, no new index requirement beyond what exists, and no new provider spend. The only "limit" it introduces is intentional and doctrinal: it is **capped at counts + leak-safe metadata** and **cannot grow into a control surface** without a new card and a fresh GATE C review. That cap is a feature, not a debt.

---

## Architecture options considered

**Option A — Client-side aggregation in the existing admin tab (no Edge function).** Have the admin app `select` raw run rows and aggregate in `src/`. **Rejected:** to count across all rows the client would need broad SELECT on `argument_machine_observation_runs`, and the temptation to also pull `body`/`evidence_span` for "context" is exactly the leak surface §6/§10a forbid. Keeping aggregation server-side behind an allow-list is the safer boundary. Also, the runs table RLS is not designed for arbitrary admin client reads of every row.

**Option B — A `SECURITY DEFINER` aggregate RPC + thin Edge reader (mirrors `cutover-health-monitor`).** A privileged read-only Postgres function does the `GROUP BY` / `COUNT` with the filters as parameters and returns **only** counts + grouping keys + the allow-listed `failure_detail` fields; the Edge function gates on admin, calls the RPC, maps reasons through plain-language, and returns the verdict object. **Chosen** (see below). This matches the established `cutover-health-monitor` pattern (`index.ts:101-137`) and keeps the leak boundary inside SQL where the column list is explicit. It is a migration (the RPC) — but the card spec says `requiresMigration: false`; see Open Question Q1 (RPC-in-migration vs. parameterized Edge query). The default recommendation is **Option C** to honor `requiresMigration: false`.

**Option C — Edge function builds the aggregate query directly via the service-role client (no new RPC, no migration).** The admin-gated Edge function, after `requireAdmin`, uses the service-role client to run a **column-explicit** aggregate query against `argument_machine_observation_runs` (selecting only the allow-listed grouping keys + `failure_detail` allow-listed subfields, never `body`, never joining `results.evidence_span`), aggregates in TypeScript, maps reasons through `gameCopy.toPlainLanguage`, and returns counts. **Chosen as the v1 path** because it satisfies `requiresMigration: false` while keeping the column allow-list explicit and server-side. The leak boundary is the **explicit SELECT column list** in the Edge function plus the existing `RunRowFailureDetail` allow-list shape.

**Option D — Add a re-trigger button / drill-down to raw rows.** **Rejected for v1** by the card spec and by the acceptance-gate invariant: no re-trigger, no raw body, no MCP payload. Reserved as a possible future card behind its own GATE C.

---

## Chosen architecture

**Option C** — an admin-gated, JWT-verified Edge read function (`admin-classifier-health`) that:

1. **Gates on admin.** Reuses `requireAdmin(req)` (`supabase/functions/_shared/adminAuth.ts:42`): `Authorization` header → `auth.getUser()` → `profiles.role = 'admin'` via service-role. Missing/invalid token → 401; non-admin → 403. (`verify_jwt = true` in `config.toml`, mirroring `admin-users`.)
2. **Validates a typed filter body** (status / state / family / run_mode / failure_reason / failure_sub_reason / failure_detail.reason / time window / runTag), via a zod schema in `_shared/` mirroring `adminSchemas.ts`. Unknown keys rejected.
3. **Runs a column-explicit aggregate read** via the service-role client (used only after the admin check, exactly like `admin-users` `index.ts:7,66`). The SELECT lists **only**: `status`, `state`, `failure_reason`, `failure_sub_reason`, `run_mode`, `requested_families`, `started_at`, `completed_at`, and `failure_detail` (read field-by-field through the allow-list). **It never selects `body`, never joins `argument_machine_observation_results`, never touches `evidence_span`.**
4. **Aggregates into counts** by the requested grouping keys, plus the fixed rows: provider-error cluster counts and the H/I/J-leakage tripwire count.
5. **Maps every reason code through plain language.** `failure_reason`, `failure_sub_reason`, and `failure_detail->>'reason'` are rendered for the operator via `gameCopy.toPlainLanguage` (`src/features/arguments/gameCopy.ts:518`); unknown codes are **suppressed, not echoed** (`toPlainLanguageOrSuppress`, `:556`). The raw code may accompany the label in the admin-only surface (admin is not an ordinary-user surface), but the operator-facing render is the plain-language string — §9.
6. **Returns a verdict object: counts + grouping keys + plain-language labels only.** No raw rows, no body, no evidence_span, no payload, no recipient, no secret — mirroring `cutover-health-monitor`'s "Response carries the per-condition verdicts … no raw rows" discipline (`index.ts:128-137`).
7. **Metadata-only CSV** is the same aggregate object serialized to CSV; identical field allowlist. The CSV builder lives in pure TS (`src/features/adminClassifierHealth/`) so it is unit-testable and ban-list-scannable.

**Where the leak boundary lives:** the explicit SELECT column list in the Edge function + the existing structural allow-list `RunRowFailureDetail` (`classifierRunRowFailureDetail.ts:43-51`). The panel **must not add a field reader that bypasses the allowlist** — it consumes `failure_detail` as the leak-safe shape the writer already constrained, and never re-derives a richer shape (§6).

---

## Data model (read-only; no migration)

No new column / table / index / RLS policy. The panel reads existing columns on `public.argument_machine_observation_runs`:

| Column | Source migration | Panel use |
|---|---|---|
| `status` (`success\|failed\|fallback`) | `20260526000018:89-90` | primary count axis |
| `state` (incl. `dead_letter`) | `20260528000021` (queue substrate) | dead-letter count |
| `failure_reason text` | `20260526000018:91` | reason cluster (always present) |
| `failure_sub_reason text` | `20260528000021` | sub-reason filter |
| `dead_letter_reason text` | `20260528000021` | dead-letter cluster |
| `failure_detail jsonb` | `20260602000001:113-114` | **first read** of `->>'reason'` etc. (allow-listed fields only) |
| `requested_families text[]` | `20260526000018:85` | family axis + H/I/J tripwire |
| `run_mode` | `20260528000021` | lane filter |
| `started_at` / `completed_at` | `20260526000018:92-93` | time window |

`failure_detail` is read strictly as the `RunRowFailureDetail` allow-list shape (`{ validator_path?, reason?, family?, correlation_id?, attempt_count?, run_mode?, schema_version? }`; `classifierRunRowFailureDetail.ts:43-51`). The panel reads only those keys; an unexpected key is ignored, never echoed.

### `runTag` filter — overlap with #476 (durable run_tag column)

There is **no `run_tag` column** on the runs table at HEAD (Grep for `run_tag|runTag` under `supabase/**` returned no matches — Phase 0 confirms the runner emits runTag only as a debate-title bracket **suffix** `[${runTag} tNN]`, `runXaiAdversarialBotCorpus.js:456,767`). Two paths:

- **Title-suffix heuristic (v1 default):** the panel derives a runTag filter by joining run → `debates.title` and matching the `[<runTag> tNN]` suffix pattern (mirroring the gallery `SUFFIX_TAG_PATTERNS` dedupe in `conversationGalleryModel.ts`). This is heuristic and brittle (it depends on the title convention) but needs no migration.
- **Durable column (preferred if #476 lands first):** **#476 CORPUS-30-RUNTAG-PERSIST** promotes `runTag` to a first-class **indexed** `run_tag` column (Phase 0 `dedup_470`/`#476 CORPUS-30-RUNTAG-PERSIST OPEN`). **This card REFERENCES #476 as the durable alternative so the two are not designed in conflict.** Design rule: **the panel consumes the durable indexed `run_tag` column if #476 has landed; otherwise it falls back to the title-suffix heuristic.** The Edge filter is written so the column path and the heuristic path are interchangeable behind one `runTag` parameter — #476 and #470 do not collide.

---

## Worker / drainer model

Not applicable. This card adds **no** worker, drainer, cron, or queue. It is a synchronous admin read. It does not invoke the drainer, the MCP server, `submit-argument`, or any provider. (For context only: the drainer that *writes* `failure_detail` is the ARCH-001 Card 2 drainer, C=3, MAX_ATTEMPTS=4, backoff [30,120]s — unchanged by this card; `docs/core/known-blockers.md:556`.)

---

## Liveness and observability

- The function is **request-scoped**: an admin opens the panel → one Edge invocation → one aggregate read → one verdict object. No background work, no lease, no liveness concern of its own.
- It is itself an **observability surface** for the classifier path; it has no dependency on its own liveness.
- It emits a structured admin-audit row on each successful read (mirroring `admin-users`'s "Every successful action writes an `admin_audit_events` row", `admin-users/index.ts:9`) — recording *that* an admin viewed classifier health + the filter parameters (no row contents). This is an Open Question (Q4): whether a read needs an audit row, or only the CSV export does.
- **No secret, no body, no evidence_span, no payload** ever appears in logs or the response (§6). The function never logs the `Authorization` header or any service-role key.

---

## Cutover and rollback path

- **Merge = deploy.** Per pipeline-governance-contract §5, `supabase/functions/**` auto-applies on merge to `main` (the Supabase GitHub integration). So merging this card **deploys the read function**. That is why it is GATE C operator-only.
- **No migration**, so there is nothing to apply/roll back at the DB layer.
- **Rollback = remove the function** (or revert the PR). Because it is read-only with no write path, reverting has **zero data effect** — no rows were created or mutated.
- The panel can ship "dark" (function deployed, UI entry point behind an admin flag) and be enabled by an operator after a smoke read confirms the leak-safe response shape.

---

## Smoke plan

All smoke is **read-only** against the existing run table (no new writes required to exercise it — there are already failed rows from the corpus runs, `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md:24` Σ 1,878 failed A–G).

1. **Admin-gate smoke:** call with (a) no `Authorization` → 401; (b) a non-admin JWT → 403; (c) an admin JWT → 200 with a verdict object. (Mirrors `admin-users` gate; values verified via SHA-256 digest, never printed — secrets policy.)
2. **Leak-safety smoke:** assert the 200 response body contains **no** `body`, **no** `evidence_span`, **no** raw provider payload, **no** key/JWT/Bearer shape. A response-scrub test (mirroring `cutover-health-monitor`'s `containsForbiddenSubstring`, `index.ts:265`) runs over the JSON and the CSV.
3. **Count-correctness smoke:** for a known time window, the panel's `failed` count equals a hand-run `SELECT count(*) … WHERE status='failed'` (operator-run; the panel never claims a count it cannot reconcile).
4. **`failure_detail` first-read smoke:** confirm a queue-drainer-produced failed row (smoke-tagged `[arch-001-queue-smoke]` submit) surfaces its `failure_detail->>'reason'` mapped through plain language; confirm a direct-dispatch failed row surfaces `failure_detail = NULL` **without error** (the panel tolerates NULL — the common case until the fill card lands).
5. **H/I/J tripwire smoke:** the leakage count row reads **0** (corroborated zero H/I/J leakage, `phase7-observation.md:36-40`). If it ever reads non-zero, that is the tripwire firing — an alert, never a control.
6. **CSV smoke:** export is metadata-only, parses as CSV, contains the same allow-listed fields, and passes the ban-list scan.

No provider call, no `submit-argument` call, no MCP call in any smoke step.

---

## Open questions

- **Q1 (RPC vs. parameterized Edge query):** The card spec says `requiresMigration: false`. Option C (Edge-built aggregate query) honors that. If a `SECURITY DEFINER` aggregate RPC (Option B) is later preferred for performance, that becomes a migration-bearing variant and shifts the card to `requiresMigration: true` — operator decision at GATE A.
- **Q2 (fill-card soft dependency):** Should the panel ship before `OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001`, accepting that `failure_detail->>'reason'` is mostly NULL until the fill card lands (routing is OFF by default; `submit-argument/index.ts:811-816`)? Recommendation: yes — the panel is valid on `failure_reason` + queue-drainer rows alone, and gains coverage when the fill card lands.
- **Q3 (#476 ordering):** If #476 (durable `run_tag` column) lands first, the panel consumes the indexed column; if not, the title-suffix heuristic. Confirm the operator wants both paths coded, or only the one matching #476's status at IMPLEMENT time.
- **Q4 (audit row on read):** Does a *read* warrant an `admin_audit_events` row, or only the CSV export? `admin-users` audits every action; a pure health read may not need to. Operator decision.
- **Q5 (provider-error cluster definition):** Which `failure_reason` values constitute the "provider-error cluster"? Phase-7 shows `mcp_api_error` + `mcp_network_error`; the `provider_server_error` bucket is ambiguous (memory note). The exact cluster membership is an implementation constant to confirm.
- **Q6 (time-zone / window semantics):** Is the time window on `started_at` or `completed_at`, and in which time zone for the operator? Default proposal: `completed_at` (falls back to `started_at` when NULL), UTC.

---

## Stage gates before implementation

Per pipeline-governance-contract §2 (Phase 0 → DESIGN → GATE A → IMPLEMENT → GATE B → REVIEW → GATE C):

- **GATE A (before IMPLEMENT):** operator confirms Option C (no migration) vs. Option B (RPC migration); confirms Q2 (ship before fill card) and Q3 (#476 ordering); confirms the leak-safe field allowlist and the no-re-trigger / no-control scope.
- **GATE B (before REVIEW):** typecheck + lint + full test suite green on the 630-suite / 19263-passing / 1-skipped baseline; new tests added (see forecast); leak-safety + ban-list scans green.
- **GATE C (operator-only merge):** because merge = deploy of an Edge function (§5), the operator performs the merge. **Never self-approve** (§4-C): the implementer/reviewer does not merge their own Edge deploy. The frozen-set invariant (H/I/J `productionEnabled: false`) is re-verified untouched at the gate.

---

## Commit-slice plan

1. **Slice 1 — pure-TS model + plain-language mapping (no Edge, no DB).** `src/features/adminClassifierHealth/`: the aggregate-row types, the count grouping logic over an in-memory row array, the CSV builder, and the reason→plain-language mapping (reusing `gameCopy.toPlainLanguage`). Fully unit-tested + ban-list scanned. Auto-merge-eligible in isolation (no Edge) — but bundled into the GATE C PR.
2. **Slice 2 — the admin Edge read function** (`admin-classifier-health`): `requireAdmin` gate, filter-body zod schema, column-explicit service-role aggregate read, verdict response, CSV response. Leak-safety response-scrub test.
3. **Slice 3 — admin UI entry point** (read-only panel + CSV download button) behind an admin flag, with the H/I/J tripwire row and the provider-error cluster row. Accessibility per `accessibility-targets` for the table/filters.
4. **Slice 4 — docs + current-status manifest update + smoke run record.**

(Slices 2–4 are the GATE C portion. Slice 1 is the safe pure-TS core.)

---

## Test-count forecast

Baseline (test-discipline): **630 suites / 19263 passing / 1 skipped / 19264 total** on `main`. DESIGN adds **0** tests. IMPLEMENT projects **+30 to +45**:

- Pure-TS model: count grouping, time-window filter, family/H-I-J tripwire derivation, provider-error cluster derivation, CSV builder, plain-language mapping, ban-list scan (~18–25).
- Edge function: admin-gate (401/403/200), filter-schema validation, leak-safety response scrub (no body/evidence_span/payload/secret), `failure_detail` first-read NULL tolerance, count reconciliation against a seeded fixture (~12–20).

No existing test is modified or skipped to pass (test-discipline). The frozen-set assertion test (`familyRegistry` H/I/J false) stays green and untouched.

---

## HALT ceiling

HALT and surface to the operator (do not proceed) if any of the following becomes true during IMPLEMENT:

- Any design or code path would **read `body`, `evidence_span`, a raw MCP payload, or a prompt** — even "for context".
- Any control (re-trigger, arm, disarm, routing %, family-registry flip) is requested into the panel — that breaches the acceptance-gate invariant and §4-C.
- Any change to `familyRegistry.ts` production flags, or any path that enables H/I/J — frozen-set breach.
- Any reader that **bypasses the `RunRowFailureDetail` allow-list** to surface a richer `failure_detail` shape — §6 leak-safety breach.
- Any attempt to reopen / redesign / re-litigate #371 or #373 (recorded-rejected; Deno-KV rejected; ARCH-001 chosen).
- The CSV or JSON response fails the ban-list / secret-shape scan.

---

## Current-status manifest stub

To append to `docs/core/current-status.md` at IMPLEMENT time (NOT in this DESIGN card):

- **MODIFIED:** `docs/core/current-status.md` (stage line + this manifest); `supabase/functions/_shared/` (new zod filter schema, if added there).
- **NEW:** `supabase/functions/admin-classifier-health/index.ts`; `supabase/functions/admin-classifier-health/config.toml` (`verify_jwt = true`); `src/features/adminClassifierHealth/` (types, grouping, CSV builder, plain-language map); admin UI panel component; `__tests__/adminClassifierHealth*.test.ts`; `supabase/functions/admin-classifier-health/__tests__/` (Deno leak-safety + gate tests); `docs/designs/OPS-MCP-OBSERVABILITY-002.md` (this doc).
- **BYTE-EQUAL preserved:** `mcp-server/**` (zero change — no provider path touched); `supabase/migrations/**` (no new migration); `familyRegistry.ts` (H/I/J flags untouched); `submit-argument/index.ts` (acceptance path untouched); `classifierRunRowFailureDetail.ts` (allow-list consumed, not modified); `classifierQueueRouting.ts` (routing untouched); `engine.ts` (sole gate, untouched).
- **Test deltas:** +30 to +45 (see forecast); 0 modified/skipped.
- **Operator follow-up:** GATE C merge (operator performs the Edge deploy); verify H/I/J tripwire reads 0 post-deploy; optionally enable the admin UI flag after a leak-safe smoke read; decide Q1 (RPC vs Edge query), Q2 (ship vs wait for fill card), Q3 (#476 ordering), Q4 (audit-on-read).
- **Discipline line:** typecheck + lint + full suite green on baseline; leak-safety + ban-list scans green; no service-role/secret in client; H/I/J frozen; no re-trigger/arm/flip control; acceptance-gate invariant honored.

---

## Required-reading manifest for the later build phase

- This design doc.
- `supabase/functions/cutover-health-monitor/index.ts` — the aggregate-health Edge read pattern to mirror (admin/secret gate, verdict-only response, `containsForbiddenSubstring` scrub).
- `supabase/functions/admin-users/index.ts` + `supabase/functions/_shared/adminAuth.ts:42` — the `requireAdmin` JWT + `profiles.role='admin'` gate + service-role-after-check + audit-on-action pattern.
- `supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts:43-75,142-192` — the `RunRowFailureDetail` allow-list shape the panel consumes (and must not bypass).
- `supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql:11-13,113-114` — `failure_detail` WRITE-ONLY status + the column add (this card is the first reader).
- `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql:78-95` — the runs table columns; `:99-118` the results table (carries `evidence_span` — the column the panel must never join).
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts:69-118` — A–G `true`, H/I/J `false` (frozen-set tripwire baseline).
- `src/features/arguments/gameCopy.ts:518,556` — `toPlainLanguage` / `toPlainLanguageOrSuppress` (§9 mapping).
- `src/features/debates/conversationGalleryModel.ts` (`SUFFIX_TAG_PATTERNS` / `cleanTitleForDedupe`) — the title-suffix runTag heuristic to mirror if #476 has not landed.
- GitHub #476 CORPUS-30-RUNTAG-PERSIST — the durable indexed `run_tag` column (consume it if landed; else the heuristic).
- GitHub OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 (Phase-7 follow-up #2) — the direct-dispatch fill card that populates `failure_detail` on direct-dispatch rows.
- Skills: `cdiscourse-doctrine` (§1/§4/§4-C/§6/§9/§10a), `supabase-edge-contract`, `test-discipline`, `accessibility-targets` (for the UI slice).
- `docs/core/pipeline-governance-contract.md` §2/§4/§5.

---

*Self-check: design-only; no secret value embedded; frozen set (H/I/J `productionEnabled: false`) untouched; every state claim carries a file:line or Phase-0 fact-key citation verified against HEAD `37ccd9e`. Ban-list scan (winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot) clean.*
