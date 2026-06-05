# OPS-MCP-OBSERVABILITY-002 — Review (Edge GATE-C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-05
**Branch:** feat/ops-mcp-observability-002
**Design:** docs/designs/OPS-MCP-OBSERVABILITY-002.md
**HEAD:** `d4b1bdd` (base `fe6c126`) — 5 commits ahead of origin/main
**Issue:** GitHub #470 — admin classifier health panel

> **merge = deploy → operator-only; do NOT auto-merge.** `supabase/functions/**`
> auto-applies on merge to `main` via the Supabase GitHub integration, so
> merging this card deploys the `admin-classifier-health` Edge function. Per
> pipeline-governance-contract §4-C (never-self-approve), the operator performs
> the merge. This review does NOT push, NOT open a PR, NOT merge.

---

## Summary

This card ships a **read-only admin "classifier health" panel** — the first
reader of the write-only `failure_detail` jsonb column — as three slices: a
pure-TS counts-only aggregation model (`src/features/adminClassifierHealth/`),
a JWT-+admin-gated Edge read function (`admin-classifier-health`) that runs a
**column-explicit** aggregate over `argument_machine_observation_runs`, and a
read-only admin UI tab. The implementation faithfully realizes design Option C
(no migration, no RPC). The leak boundary is enforced in three layers — a
`z.strictObject` request schema that rejects unknown keys, a column-explicit
`SELECT` constant that names only 11 allow-listed columns and never `body` /
`evidence_span` / a results-table join, and a `containsForbiddenSubstring`
scrub (mirroring `cutover-health-monitor`) over the JSON + CSV before return.
The H/I/J frozen-set leakage tripwire is derived from a code-frozen constant
(pinned to `ALL_MACHINE_OBSERVATION_FAMILIES`), counts production-SUCCESS rows
only, and is observed-not-controlled. Every producer-chain file, the family
registry, `engine.ts`, and `submit-argument` are **byte-equal** to main. The
only write is the `admin_audit_events` insert (actor + filter params + count,
never row contents). typecheck + lint clean; the full suite is green at
**643 suites / 19494 passing / 1 skipped / 19495 total** — exactly the
forecast. No concerns remain that block approval.

---

## The 15 adversarial checks (Edge GATE-C)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No write ops except audit insert | PASS | `git diff` `.insert/.update/.delete/.upsert` (excl `__tests__`) → ONLY `sc.from('admin_audit_events').insert(...)` at `supabase/functions/admin-classifier-health/index.ts:254`. No write to `argument_machine_observation_runs` / `public.arguments`. |
| 2 | No re-trigger / re-classify / re-dispatch / provider call | PASS | Diff grep for `submit-argument`/`classify-argument`/`autoTrigger`/`classifyArgumentCore`/`dispatchAuto`/`Anthropic`/`xai`/`MCP_SERVER` in non-test code → only docstring negations + test assertions. Edge `index.ts:41-42` docstring: "This function never calls Anthropic / xAI / the MCP server / submit-argument". |
| 3 | No routing arm / productionEnabled flip | PASS | `CLASSIFIER_QUEUE_ROUTING_ENABLED/PERCENTAGE` + `productionEnabled` appear only in (a) test ban-list assertions (`adminClassifierHealthEdgeSourceScan.test.ts:153-155`), (b) docstring/comment negations, (c) the model docstring mirroring `familyRegistry`. No setter, no env read of routing flags. |
| 4 | No migration | PASS | `git diff main..HEAD --name-only -- 'supabase/migrations/**'` → 0 files. |
| 5 | `familyRegistry.ts` byte-equal | PASS | `git diff main -- …/familyRegistry.ts` → 0 lines (file exists; diff meaningful). |
| 6 | Producer chain byte-equal | PASS | `classifierRunRowFailureDetail.ts`, `classifierDrainerCore.ts`, `persistenceWriter.ts`, `classifyArgumentCore.ts`, `autoTriggerDispatcher.ts` → 0 diff lines each (all files exist). |
| 7 | `engine.ts` + submit-argument byte-equal | PASS | Real engine path is `src/domain/constitution/engine.ts` (CLAUDE.md cites `src/lib/…`, but the actual file is `src/domain/…`). `git diff main -- src/domain/constitution/engine.ts` → 0 lines; no engine/constitution file in the diff at all. `submit-argument/index.ts` → 0 lines. |
| 8 | **THE LEAK CHECK — output excludes raw content** | PASS | `RUN_COLUMNS` (`index.ts:72-73`) names exactly `status, state, failure_reason, failure_sub_reason, dead_letter_reason, run_mode, requested_families, family, started_at, completed_at, failure_detail` — no `*`, no `body`, no `evidence_span`. No join to `argument_machine_observation_results`. `runTag` adds only `debates(title)` (`:74`, title-only, suffix-read). Verdict + CSV types carry no body/span field. `adminClassifierHealthLeakSafety.test.ts:157-164` structurally asserts `evidence_span`/`body`/`payload`/`prompt` absent at any JSON depth; `:166-173` asserts raw titles never echoed. PASS. |
| 9 | `failure_detail` only as allow-list shape + scrub | PASS | `readFailureDetailAllowListed` (`index.ts:84-96`) whitelists exactly the 7 RunRowFailureDetail keys (validator_path/reason/family/correlation_id/attempt_count/run_mode/schema_version); any other key ignored. No `JSON.stringify` of a whole row; no arbitrary key pluck. `containsForbiddenSubstring(jsonString) \|\| containsForbiddenSubstring(csv)` runs before return (`index.ts:199-201`), mirroring `cutover-health-monitor`. Poisoned-row test (`adminClassifierHealthLeakSafety.test.ts:176-207`) proves a runtime `evidence_span`/`body` key never survives the aggregate. |
| 10 | H/I/J tripwire correct | PASS | `FROZEN_NON_PRODUCTION_FAMILIES` is a code-frozen `Object.freeze([claim_clarity, thread_topology, sensitive_composer])` (`classifierHealthModel.ts:36-40`), pinned to `ALL_MACHINE_OBSERVATION_FAMILIES` (`adminClassifierHealthModel.test.ts:196-200`). Counts production-mode + status=success + frozen-family rows (`:208-236`). Tests: production-success H/I/J → fires count 1 (`:212-220`); clean A–G → 0 (`:202-210`); FAILURE-only → 0 (`:222-234`); admin_validation success → 0 (`:236-247`). |
| 11 | Backward-compat — NULL rows render | PASS | Model buckets a NULL column under `rawKey: null`, never literal "null"/"undefined" (`classifierHealthModel.ts:148-157`; test `:63-74`). UI `displayKey` renders `null`/empty as `—` (`AdminClassifierHealthTab.tsx:42-45`); empty buckets show an `emptyHint`. |
| 12 | No new env read / secret surface | PASS | Diff grep `Deno.env.get`/`process.env` in non-test code → none. The Edge function reads SUPABASE_URL/SERVICE_ROLE only inside `requireAdmin` → `createServiceClient()` (shared helper, after the admin check), mirroring `admin-users`. No NEW secret env name introduced. `adminClassifierHealthEdgeSourceScan.test.ts:158-162` asserts no `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` and no Authorization/SERVICE_ROLE logging. |
| 13 | No new provider call / outbound HTTP | PASS | Diff grep `fetch(`/`https?://`/`api.anthropic`/`api.x.ai` in non-test code → none. The only `https://` in the diff is an adversarial leak-safety **test fixture** input. `adminClassifierHealthEdgeSourceScan.test.ts:147-150` asserts the Edge source contains zero `https://` calls. |
| 14 | Acceptance-gate invariant preserved | PASS | Stated verbatim in `index.ts:9-16`, `types.ts:8-14`, `config.toml`, and the UI footnote (`AdminClassifierHealthTab.tsx:268-273`): "the classifier path never gates a user post; the deterministic rules engine is the sole acceptance gate." Read-only; no write path to the submit path; cannot block/route/delay. |
| 15 | No existing test modified (THR-4) | PASS | `git diff main..HEAD --name-status` over test dirs → 5 files, all status `A` (added). No `M`/`D` on any pre-existing test. No count-snapshot masking. |

---

## Leak-safety centerpiece (#8 / #9) — new read surface over sensitive data

This is the load-bearing finding. The panel is the **first reader** of
`failure_detail` and reads the runs table that sits alongside
`argument_machine_observation_results.evidence_span` and `public.arguments.body`.
The leak boundary holds across four independent layers, each independently tested:

1. **Request schema (input).** `AdminClassifierHealthRequestSchema` is
   `z.strictObject` (`adminClassifierHealthSchemas.ts:27`). A smuggled `body` /
   `select` / `columns` / `evidence_span` key fails validation rather than being
   silently stripped (`adminClassifierHealthSchemaSourceScan.test.ts:48-52`
   asserts the schema declares NO `action/select/columns/insert/update/delete/
   sql/body/evidence_span` field; `:32-36` asserts `z.strictObject`, not
   `z.object`/`passthrough`).

2. **Query column allow-list (read).** `RUN_COLUMNS` (`index.ts:72-73`) is a
   literal column list — never `*`, never `body`, never `evidence_span`, never a
   join to the results table. `adminClassifierHealthEdgeSourceScan.test.ts:52-96`
   asserts every `.select(...)` has no `*`, no `body`, no `evidence_span`; reads
   only `argument_machine_observation_runs` + `admin_audit_events`; and pins the
   exact column-constant string.

3. **failure_detail field allow-list (parse).** `readFailureDetailAllowListed`
   (`index.ts:84-96`) copies only the 7 RunRowFailureDetail keys; an unexpected
   key is dropped. The pure-TS model `ClassifierHealthRunRow.failure_detail` type
   never exposes a richer shape. The poisoned-row test
   (`adminClassifierHealthLeakSafety.test.ts:176-207`) casts a runtime object
   carrying `evidence_span` + `body` through `unknown` and proves the aggregate
   verdict re-emits neither.

4. **Response scrub (output).** `containsForbiddenSubstring` runs over the
   serialized JSON AND the CSV before return; a hit drops to `internalError`
   rather than leak (`index.ts:199-201`;
   `adminClassifierHealthLeakSafety.test.ts:152-155`). The leak-safety suite
   also scans the verdict + CSV for X handles / social URLs / post-ids / emails /
   sk-ant- / xai- key / sb_secret / JWT / Bearer / SERVICE_ROLE / full UUID and
   asserts `evidence_span`/`body`/`payload`/`prompt` are absent at every JSON
   depth.

The one residual byte that *could* carry free text into the function —
`debates.title` (joined only for the runTag heuristic) — is read solely for its
trailing `[<runTag> tNN]` suffix and is never echoed into any count
(`runTagSource.ts:49-63`; verdict-never-carries-raw-title test
`adminClassifierHealthLeakSafety.test.ts:166-173`). This is leak-safe.

---

## Admin gate + audit (mirror admin-users)

- **Gate.** `requireAdmin(req)` (`adminAuth.ts:42-84`): missing Authorization →
  401; invalid token / profile-not-found → 401; authenticated non-admin → 403;
  admin → returns `{ caller, serviceClient }`. Edge maps `auth.status === 401 →
  unauthorized()`, else `forbidden(reason)` (`index.ts:150-154`). `config.toml`
  sets `verify_jwt = true`, mirroring `admin-users`. The service-role client is
  destructured from the `requireAdmin` success result — built only after the
  gate, never independently before it
  (`adminClassifierHealthEdgeSourceScan.test.ts:44-49`).
- **Audit (Q4).** `writeClassifierHealthAudit` (`index.ts:244-264`) inserts
  `actor_user_id` + `action` + `{ filter: <params>, resultRowCount }`. The filter
  block carries only the validated scalar filter params + the aggregate total —
  **never row contents, never a body, never a count beyond the aggregate total**
  (`adminClassifierHealthEdgeSourceScan.test.ts:121-124`). Audit failure is
  caught and logged via `console.error` of an error class only — never the
  Authorization header or service-role key.

---

## Doctrine self-check (all ✓)

- ✓ No truth/winner/loser language in user-facing strings — diff ban-list scan
  over `src/**` + `supabase/**` non-comment code → clean; model test
  `adminClassifierHealthModel.test.ts:363-376` scans every plain-language label.
- ✓ Score never blocks posting — N/A control surface; panel is read-only,
  downstream of every gate (acceptance-gate invariant restated verbatim).
- ✓ No service-role in client code — `src/**`/`app/**` diff has zero
  `SERVICE_ROLE`/`ANTHROPIC_API_KEY`; the client wrapper
  (`adminClassifierHealthApi.ts`) holds no key and only invokes the Edge function.
- ✓ No direct insert into `public.arguments` — only write is
  `admin_audit_events` (audit-only insert-pattern table).
- ✓ No AI calls in production app paths — no provider import / fetch / URL.
- ✓ Plain language only — reason codes route through
  `classifierHealthPlainLanguage` (gameCopy first → admin transport map →
  unknown SUPPRESSED, `classifierHealthPlainLanguage.ts:89-100`). The raw code
  accompanies the label on the admin-only surface (§9 permits this for admin).
- ✓ Epic-specific (supabase-edge-contract): standard Edge shape — CORS preflight,
  JWT/admin gate, strict input schema, service-role only after the auth check,
  audit on action, stable error shape, no secret echoed. (cdiscourse-doctrine
  §4-C never-self-approve): H/I/J `productionEnabled:false` frozen + observed,
  never flipped.

---

## Test coverage

- ✓ New public functions have unit tests — `aggregateClassifierHealth`,
  `classifierHealthPlainLanguage`, `buildClassifierHealthCsv`, `makeRunTagSource`,
  `runTagMatches` all covered (`adminClassifierHealthModel.test.ts`, 101 new tests
  across 5 suites). Non-array input handled (`:97-101`).
- ✓ User-facing strings have ban-list assertion (`:363-376`).
- ✓ Edge cases from design covered — Q5 provider cluster (`:166-184`), Q6 window
  on completed_at w/ started_at fallback + no-timestamp exclusion (`:132-161`),
  H/I/J tripwire matrix (`:189-248`), NULL bucket (`:63-74`), runTag heuristic
  (`:252-294`), CSV RFC-4180 escape (`:351-358`).
- ✓ Accessibility (UI card) — `AdminClassifierHealthTab.tsx` Pressables carry
  `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState`, and
  `hitSlop`; inputs ≥44px min height; NULL → "—". Covered by
  `AdminClassifierHealthTab.test.tsx`.

---

## Verification

- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, `--max-warnings 0`)
- test: **643 suites / 19494 passing / 1 skipped / 19495 total** (exit 0) — from
  baseline `fe6c126` `638 → 643` suites / `19393 → 19494` passing; matches the
  card forecast exactly. The 5 new suites
  (`adminClassifierHealthModel`, `…LeakSafety`, `…EdgeSourceScan`,
  `…SchemaSourceScan`, `AdminClassifierHealthTab`) pass with 101 tests.
- secret scan: **clean** — only obvious placeholders in adversarial test fixtures
  (`sk-ant-PLACEHOLDER…`, `sb_secret_PLACEHOLDER…`, `xai-…EXAMPLENOTAREALKEY`).
- doctrine scan: **clean** — verdict tokens appear only in test ban-list arrays
  and docstring prohibitions.
- Migration apply: **N/A — no migration in this card** (Option C, read-only over
  existing columns; `git diff … 'supabase/migrations/**'` → 0).

---

## Design conformance

- ✓ All design file-changes present — pure-TS model dir, Edge function +
  config.toml, `_shared/` zod schema, UI tab, client wrapper, AdminScreen/types
  registration, current-status stub.
- ✓ No undocumented file-changes — diff footprint matches the manifest; the only
  non-listed working-tree item is an untracked unrelated dry-run corpus doc
  (`docs/testing-runs/2026-06-05-xai-adversarial-bot-corpus-dry.md`) that is NOT
  committed on this branch and is out of scope.
- ✓ Data model matches design — reads existing runs-table columns; no new
  column/table/index/RLS/migration.
- ✓ API contract matches design — Option C column-explicit Edge aggregate;
  verdict = counts + grouping keys + plain-language labels; metadata-only CSV.

---

## Blockers

None.

## Suggestions (non-blocking)

1. The Edge function validates the request body **before** the admin gate
   (`index.ts:134-147` then `:150`). This is harmless (no DB access, no leak —
   pure schema validation) and arguably leaks no information a non-admin could
   not already infer, but most admin-users-family functions gate first. Optional
   reorder for consistency; not required.
2. `runTagSource.kind` is surfaced in the verdict as `runTagSource`. When #476
   (durable `run_tag` column) lands, the follow-up `DEVEX-RUNTAG-COLUMN-SWAP-001`
   swaps the seam — confirm that issue is filed (named in the design's open
   questions and the current-status stub).
3. Design open questions Q1–Q6 were resolved by the implementer (Option C, ship
   before fill card, title-suffix heuristic, audit-on-read, cluster = mcp_api_error
   + mcp_network_error + provider_server_error, window on completed_at→started_at
   UTC). The operator should confirm Q4 (audit-on-read) is acceptable — it is the
   only behavior beyond the strict design minimum, and it records params-only.

---

## Operator next steps

> **merge = deploy → GATE C operator-only. Do NOT auto-merge.**

1. Operator reviews this doc, then pushes + opens the PR:
   - `git push -u origin feat/ops-mcp-observability-002`
   - `gh pr create --title "OPS-MCP-OBSERVABILITY-002: admin classifier health panel (#470)" --body-file docs/reviews/OPS-MCP-OBSERVABILITY-002.md`
2. **Operator performs the merge** (never self-approve; merge = Edge deploy via
   the Supabase GitHub integration).
3. **§7 post-deploy smoke checklist (operator, read-only):**
   - Admin-gate: call with no `Authorization` → 401; non-admin JWT → 403; admin
     JWT → 200 verdict object. (Secret values verified via SHA-256 digest, never
     printed.)
   - Leak-safety spot check: confirm the 200 body has no `body`, no
     `evidence_span`, no raw payload, no key/JWT/Bearer shape.
   - Count reconciliation: panel `failed` count for a known window equals a
     hand-run `SELECT count(*) … WHERE status='failed'`.
   - runTag heuristic smoke: a `[<runTag> tNN]`-titled room filters correctly.
   - H/I/J tripwire reads **0** post-deploy (any non-zero = tripwire firing, an
     alert, never a control).
   - Backward-compat: a direct-dispatch failed row (`failure_detail = NULL`)
     renders without error and as `—`, not "null".
4. File `DEVEX-RUNTAG-COLUMN-SWAP-001` (run_tag column swap when #476 lands), if
   not already filed.
5. Optionally enable the admin UI flag after the leak-safe smoke read.
6. Post-merge worktree cleanup (operator, from main repo root) per
   roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".

---

## Boundary attestation

No code modified. No push. No PR opened. No merge. This review is read-only;
the review doc is the only file written, committed on `feat/ops-mcp-observability-002`.
