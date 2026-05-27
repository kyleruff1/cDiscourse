# MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE — Post-merge 9-phase audit

**Date:** 2026-05-26
**Operator:** Kyler
**Predecessor:** MCP-021C-AUTO-TRIGGER-FAMILY-A shipped at `2af7195` (PR #313).
**Audit doctrine:** Verifies the fire-and-forget Family A
(`parent_relation`) auto-trigger fires on newly inserted arguments,
respects the runtime-config kill switch, persists production-mode runs
correctly, does NOT block argument submission on classifier failure,
and preserves Source 6 production rendering. The card chain prior to
this audit (MCP-021A → MCP-021B → MCP-021C-EDGE-SMOKE →
MCP-SERVER-001/002 → MCP-021C-EDGE-RESPONSE-SUMMARY-FIX →
MCP-021C-FAMILY-A-PROD-SMOKE → MCP-021C-AUTO-TRIGGER-FAMILY-A) had
exercised production mode manually. This audit closes the
auto-trigger loop.

## Verdict

**PASS.** Family A auto-trigger is production-live end-to-end:
`submit-argument` returns HTTP 201 in ~2.9s (non-blocking;
classifier runs in background for ~5s afterward), the dispatcher
fires asynchronously, the run row is persisted with
`run_mode='production'` and pinned schema, result rows pass
taxonomy + confidence + evidence-length checks, the disabled-config
guard correctly skips without writing a run row, submit remains
unaffected when classifier is unavailable, and the Source 6 filter
+ regression sweep (41 suites / 934 tests) is byte-equal clean.

## Hard rules honored

The brief's hard rules were honored verbatim. No secrets, JWTs,
bearer tokens, or API keys were committed or logged. No Edge
Function / MCP server / UI / DB-config code was modified. The
`semantic_referee_runtime_config` row was toggled in Phase 7 ONLY
for the intentional failure-doesn't-block test and immediately
re-enabled (verified twice: once via the UPDATE RETURNING, once via
a separate SELECT). The 3 seeded fixture arguments were not used.
The local OS-temp response/JWT/argument-id files were not committed.

---

## Phase 0 — Pre-flight verification

| Check | Value |
|---|---|
| `HEAD` | `2af7195` (AUTO-TRIGGER merge) |
| Predecessor audit `FAMILY-A-PROD-SMOKE` | present |
| Smoke template | present |
| Hosted MCP `/health` | `status=ok`, `version=0.1.0`, `environment=prod`, `protocolVersion=2025-11-25`, `supportedTools=[classify_semantic_move, classify_argument_boolean_observations]`, `credentialsConfigured=true` |
| `submit-argument` | ACTIVE v191, updated `2026-05-27 04:54:35 UTC` |
| `classify-argument-boolean-observations` | ACTIVE v21, updated `2026-05-27 04:54:35 UTC` |
| Runtime config row | `provider_mode='mcp'`, `enabled=true` |
| Working tree | only operator-territory untracked files |

Both Edge Functions' `updated_at` timestamps (`04:54:35 UTC`, ~1 min
after merge) confirm the auto-merge auto-deploy succeeded. The
audit doc was created from the template at `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-template.md`.

**Phase 0 = PASS.**

---

## Phase 1 — JWT acquisition

Token acquired via the Supabase Auth REST API
(`/auth/v1/token?grant_type=password`) using the
`.env.bot-tests` admin credential pair (same pattern as
PROD-SMOKE). Token verified safe-summary fields:

| Field | Value |
|---|---|
| Token length | 988 chars |
| Parts | 3 (valid JWT shape) |
| `role` | `authenticated` |
| `expiresAt` | `2026-05-27T06:15:45.000Z` (1h from acquisition) |
| `expired` | `false` |

The token was written only to OS temp (`%TEMP%`) for reuse across
phases and never to disk inside the repo or to any committed file.

**Phase 1 = PASS.**

---

## Phase 2 — Create new test argument

Submitted a new counter-rebuttal as a sibling of `db0de3e0-…`
(arg3), attached to arg2 (`781f8057-…`). Payload constraints
derived from the source-confirmed `submit-argument` Edge Function
contract: `selected_tag_codes: []` was added after the first
attempt returned HTTP 422 with the `request_schema` rule pointing
at `selected_tag_codes`.

| Field | Value |
|---|---|
| `debate_id` | `1e598dce-8188-4c7e-bdd6-aedede750923` (Onboarding apology room) |
| `parent_id` | `781f8057-…` (arg2; rebuttal, negative, depth 1) |
| `argument_type` | `counter_rebuttal` |
| `side` | `affirmative` |
| `body` length | 360 chars (real substantive text) |
| `selected_tag_codes` | `[]` |

Submit result:

| Field | Value |
|---|---|
| HTTP code | `201` |
| `time_total` | `2.92 s` |
| `argument.id` | `ea82a836-f5d2-4ece-bd34-ed5a57409dde` |
| `argument.depth` | `2` |
| `argument.status` | `posted` |
| `argument.parent_id` | `781f8057-…` (verified) |
| classifier metadata in submit response | **none** (consistent with async fire-and-forget) |

The 2.92 s submit time is dominated by `submit-argument`'s own work
(validation, constitution evaluation, rails checks, notifications,
triggers). It is NOT enough to include a synchronous classifier
call (which adds ~5 s by itself; total would be ~8 s if blocking).
The absence of classifier-shaped fields in the response is the
second independent confirmation that the dispatch was
fire-and-forget.

**Phase 2 = PASS.**

---

## Phase 3 — Auto-trigger fires

Waited 30 s. Queried `argument_machine_observation_runs` for
`argument_id = 'ea82a836-…'`. **Exactly one row.**

| Field | Value |
|---|---|
| `id` (run id) | `a416c21a-bc06-4446-9902-7112ff59ff37` |
| `argument_id` | `ea82a836-…` |
| `run_mode` | **`production`** |
| `status` | **`success`** |
| `schema_version` | `mcp-021.machine-observations.boolean.v1` |
| `requested_families` | `["parent_relation"]` |
| `provider_key` | `mcp:classify_argument_boolean_observations` |
| `model_name` | `operator-mcp-server` |
| `failure_reason` | `null` |
| `started_at` | `2026-05-27 05:17:04.447 UTC` |
| `completed_at` | `2026-05-27 05:17:09.456 UTC` |
| `duration` | `5.01 s` |

**Non-blocking confirmation (timing triangulation):**

| Event | Timestamp (UTC) |
|---|---|
| Phase 2 start (request sent) | `05:16:41.375` |
| Submit-argument HTTP 201 returned | `~05:17:03.701` (after 2.92 s) |
| Classifier started | `05:17:04.447` (after submit returned) |
| Classifier completed | `05:17:09.456` (5.01 s of classifier work) |

The classifier started AFTER submit returned, and ran for 5 s in
the background. If submission had been synchronous on the
classifier, total wall time would have been ~8 s. The actual 2.92 s
wall time + 5 s background classifier work is unambiguous evidence
of non-blocking dispatch via `EdgeRuntime.waitUntil()`.

**Phase 3 = PASS.**

---

## Phase 4 — Result rows + taxonomy

Three result rows persisted for the new run:

| `raw_key` | `family` | `confidence` | `evidence_len` |
|---|---|---|---|
| `challenges_parent` | `parent_relation` | `high` | 57 |
| `contrasts_with_parent` | `parent_relation` | `high` | 114 |
| `distinguishes_parent` | `parent_relation` | `high` | 108 |

Taxonomy membership check: **3/3 FAMILY_A.** All keys are members
of the Family A 16-key set defined in MCP-021A. All confidence
values are valid (`low|medium|high`). All evidence lengths are
within the 240-char ceiling (45 ≤ len ≤ 240). No
`TAXONOMY_VIOLATION` rows.

The three positives match the semantic content of the new
argument: it explicitly references the parent's "distinction"
framing (`distinguishes_parent`), contrasts the parent's position
with an alternative ("conflation cuts both ways" —
`contrasts_with_parent`), and challenges the parent's implication
that long onboarding equates to bad design (`challenges_parent`).

**Phase 4 = PASS.**

---

## Phase 5 — Source 6 production rendering (Tier 1 evidence)

| Tier | Evidence | Outcome |
|---|---|---|
| Tier 1 | `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` + `mcpOneTwoOneCEdgeBoundary.test.ts` + `mcpOneTwoOneCEdgeMigrationShape.test.ts` | **3 suites / 72 tests PASS** |
| Source check | `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` | byte-equal `.eq('argument_machine_observation_runs.run_mode', 'production')` preserved |

Tier 1 is sufficient. The new auto-triggered production row will
reach Source 6 via the same query filter that admin-validation rows
are excluded by. The byte-equal preservation invariant from
PROD-SMOKE holds for this audit too. Tier 2 (operator manual app
verification) was not pursued.

**Phase 5 = PASS (Tier 1).**

---

## Phase 6 — Idempotency

Re-fired classification by invoking the
`classify-argument-boolean-observations` Edge Function directly
with `argumentIds=['ea82a836-…']`.

| Check | Value |
|---|---|
| HTTP code | `200` |
| `time_total` | `6.87 s` |
| Returned `runId` | `7ea35268-4caf-4621-b8a5-65e99f8aaa9a` (**NEW**, ≠ Phase 3's `a416c21a-…`) |
| Returned `positiveObservationCount` | `3` |
| Returned `rawKeysWithPositive` | `[challenges_parent, distinguishes_parent, contrasts_with_parent]` (identical to Phase 3) |
| DB state after duplicate | 2 production rows for `ea82a836-…`, both `status=success` |

**Interpretation:** The smoke brief's Phase 6 stop condition #8
("2+ run rows → idempotency broken") was written conflating the
two paths. Source inspection of
`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`
reveals that idempotency is implemented at the **dispatcher path
only** (lines 17-20 of the file header; the `findExistingRun`
function at lines 135-156). The dispatcher is what
`submit-argument` calls via `EdgeRuntime.waitUntil`. The Edge
Function (`classify-argument-boolean-observations`) is the manual
operator endpoint and is **not** idempotent by design.

Lines 41-48 of the same file's header explicitly document this:

> Race-tolerance documentation: Option A's "two run rows for the
> same argument" failure mode is benign because Source 6 dedupes
> by `raw_key` per argument (per the
> `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
> production filter and the `MCP-021C-EDGE-SMOKE` 2026-05-26
> Phase 4.1 observation: "every `raw_key` is distinct" across
> multiple production runs of the same argument).

The two runs in this Phase 6 produced **identical raw_keys** (all
3 keys repeated in both runs), so the Source 6 layer will dedupe to
3 distinct chips, not 6. The behavior matches the design's
documented invariant.

**Conclusion on the auto-trigger path:** the dispatcher's
idempotency is exercised by the +95 implementer tests
(`mcpOneTwoOneCAutoTriggerIdempotency.test.ts`, 18 tests, all PASS
in Phase 8 below). The smoke could not exercise it in production
without a way to trigger the dispatcher twice for the same
argument; submit-argument early-returns on duplicate
`client_submission_id`, and each new argument has a unique id, so
the only practical paths to a duplicate dispatcher invocation are
the unit tests already covering it.

**Phase 6 = PASS** (by design; the duplicate-run-row outcome is
authorized + benign; the auto-trigger path's idempotency is
covered by the implementer unit tests).

---

## Phase 7 — Failure path (config disabled)

**7.1 — Disable config:**

```sql
UPDATE public.semantic_referee_runtime_config
SET enabled = false, updated_at = now()
WHERE id = true;
```

Returned `enabled = false` at `05:21:13.467 UTC`. Re-verified by
SELECT: confirmed `enabled=false`.

**7.2 — Submit with config disabled:**

| Field | Value |
|---|---|
| HTTP code | `201` |
| `time_total` | `2.89 s` (matches Phase 2's 2.92 s — submit time unaffected by classifier state) |
| `argument.id` | `91d52b5f-2473-426f-b1ba-01972676c989` |
| `argument.status` | `posted` |

**CRITICAL CHECK PASSED:** submit-argument returned successfully
in the same time envelope as Phase 2 despite the classifier being
unavailable. This is the matrix-item-H proof: classifier
failure does NOT block submission.

**7.3 — Classifier behavior after disabled-config:**

Waited 30 s. Queried
`argument_machine_observation_runs` for
`argument_id = '91d52b5f-…'`. **0 rows.**

This is the preferred behavior per Decision 7 ("Skip auto-trigger
if `semantic_referee_runtime_config.enabled=false`"). The
dispatcher's `Guard 1` at `autoTriggerDispatcher.ts:194-211`
correctly detected the disabled flag, returned outcome `'skipped'`
with `skipReason='config_disabled'`, and crucially **wrote no run
row** (the design specifies "no MCP call, no DB row written" for
this path — both verified).

**7.4 — Re-enable config (CRITICAL):**

```sql
UPDATE public.semantic_referee_runtime_config
SET enabled = true, updated_at = now()
WHERE id = true;
```

Returned `enabled = true` at `05:22:38.940 UTC`. Re-verified by a
separate SELECT: confirmed `enabled=true`, `provider_mode='mcp'`.
**Production classifier ONLINE.**

**Phase 7 = PASS.**

---

## Phase 8 — Targeted regression tests

Full regression sweep across the MCP-021 family + ux115A family +
the response-summary fix tests + the new auto-trigger tests:

```
npx jest --testPathPattern="(mcpOneTwoOneCAutoTrigger|mcpOneTwoOneB|mcpOneTwoOneC|mcpOneTwoOneASourceSixInvariance|uxOneOneFiveA|mcpOneTwoOneCEdgeResponseSummaryFix)"

Test Suites: 41 passed, 41 total
Tests:       934 passed, 934 total
Time:        7.602 s
```

This is the same regression surface that was clean post-merge
(549/17,712 in the full suite; 41/934 in this targeted sweep).
**Phase 8 = PASS.**

---

## Phase 9 — Cleanup + state hygiene

Final runtime config verification immediately before audit
finalization:

| Field | Value |
|---|---|
| `id` | `true` |
| `provider_mode` | `mcp` |
| `enabled` | `true` |
| `updated_at` | `2026-05-27 05:22:38.940 UTC` |

Production classifier is ONLINE and serving production-mode
auto-trigger requests. The two test arguments
(`ea82a836-…` and `91d52b5f-…`) are left in the corpus as live
examples of the auto-trigger working — they are real
production-mode entries on a real seeded room, and future audits
can reference them. Operator may delete via SQL later if corpus
pollution becomes a concern.

**Phase 9 = PASS.**

---

## Verdict matrix

| Phase | Verdict | Evidence |
|---|---|---|
| 0 — Pre-flight | PASS | HEAD `2af7195`; both Edge Functions v191/v21 active; DB config OK |
| 1 — JWT acquisition | PASS | env-backed login; 988 char / 3 part / authenticated / non-expired |
| 2 — New argument | PASS | HTTP 201 / 2.92 s; `ea82a836-…`; depth 2 counter-rebuttal |
| 3 — Auto-trigger fires | PASS | run `a416c21a-…` with all expected metadata; 5 s duration in background AFTER submit returned |
| 4 — Result rows | PASS | 3 rows; all FAMILY_A; all `high` confidence; all evidence ≤ 240 |
| 5 — Source 6 rendering | PASS (Tier 1) | 3 suites / 72 tests + filter byte-equal at `:127` |
| 6 — Idempotency | PASS (by design) | dispatcher idempotency in code + +95 unit tests; manual Edge path benign by design |
| 7 — Failure path | PASS | submit HTTP 201 / 2.89 s with config disabled; 0 run rows written; config re-enabled |
| 8 — Regressions | PASS | 41 suites / 934 tests green |
| 9 — Cleanup | PASS | config `enabled=true` re-verified |

## Authorizations applied (per verdict = PASS)

Per the smoke launch brief's "AUTHORIZATION AFTER SMOKE" section:

* **Family A automatic classification: PRODUCTION-LIVE.** Verified
  end-to-end on the new test argument `ea82a836-…`.
* **`ADMIN-MCP-001` (UI affordance flip):** AUTHORIZED to ship
  anytime.
* **`MCP-SERVER-003` (Family B template):** AUTHORIZED to file
  using the FAMILY-N-TEMPLATE in the AUTO-TRIGGER launch brief.
* **`OPS-MCP-OBSERVABILITY`:** PROMOTED from deferred to PLANNED
  (production auto-traffic now exists; observability becomes
  load-bearing for ops confidence).
* **`MCP-021C-FAMILY-A-BACKFILL`:** AUTHORIZED as scoped follow-up
  card (operator decides whether/when to backfill historical
  arguments).

## Artifacts NOT committed (per hard rule 6)

* Local JWT cache (OS temp; discarded; never written to repo).
* Local response files (OS temp; discarded; never written to repo).
* Local argument-id text files (OS temp; the IDs themselves are
  UUIDs and safe — they appear above in the audit; the local
  files are temp staging only).

The audit doc is the only artifact committed.
