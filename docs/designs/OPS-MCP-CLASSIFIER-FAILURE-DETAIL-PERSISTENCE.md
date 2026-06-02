# OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — leak-safe `failure_detail` jsonb on the classifier-queue run row

**Status:** Design draft
**Epic:** Epic 12 / MCP semantic-referee track (ARCH-001 classifier-queue substrate — operational hardening)
**Release:** OPS / operational follow-up on the ARCH-001 + OPS-MCP cutover arc
**Issue:** (filed by the caller for OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE)
**Owner of build:** a fresh implementer agent (design-only handoff)

> **Design-only scope reminder for the reader of this doc:** the designer wrote ONLY this file.
> The implementer who picks this up writes the migration, the drainer failure-write change, the new
> helper, the type edits, and the named tests — nothing else.

---

## Goal (one paragraph)

Persist a small, allow-listed `failure_detail jsonb` column on the classifier-queue row
`public.argument_machine_observation_runs` so that failure investigations stop requiring a manual
Deno Deploy log pull. Three investigations in this arc — the `argument_scheme` cluster RCA chases in
**PR #419** (`8a01f64`) and **PR #420** (`2f179cc`), and the lone synthetic `critical_question`
(Family F) `provider_server_error` dead-letter adjudicated in **PR #429** (`a9602b9`) — each had to
leave the database and read Deno logs, because the run row records `failure_reason`,
`failure_sub_reason`, and `dead_letter_reason` but NOT the validator path (e.g.
`evidenceSpan.abductive_explanation_present`), the structured server/validator `reason`, or a
correlation id that ties the row to a log line. This card makes the row **self-describing for triage**.
It is **WRITE-ONLY diagnostics**: the drainer writes `failure_detail` alongside its existing failure
writes, and **nothing reads `failure_detail`** — no UI, no consumer, no SQL view, no backfill.

The design is shaped by `cdiscourse-doctrine` §1 (no verdict / truth label — `failure_detail` is an
operational triage signal, never a judgment about a participant), §6 (secrets policy — the column is
a secret-surface and the writer is a structural allow-list with no body/prompt/payload entry point),
and §10a (machine observations are structural facts; this is operational metadata one level below
even that). It is shaped by `test-discipline` in that the **leak-safety convergence gate is the
centerpiece of the test plan**, mirroring the existing
`__tests__/booleanObservationFailureSubreason.test.ts` HALT-4 hostile-fixture wall.

---

## Acceptance-gate invariant (stated, per the card)

**AI/MCP classifiers MUST NEVER be the submission acceptance gate.** The pure rules engine
(`src/lib/constitution/engine.ts`) is the sole gate; classifiers run AFTER an argument is stored.
`failure_detail` is diagnostic metadata on a queue row — it MUST NEVER influence acceptance, routing,
retry scheduling, the retry/dead-letter decision, drainer concurrency, or any user-visible output.
It is written; it is never read by any code path that decides anything. The retry/terminal/dead-letter
decision is made by `classifyDrainerFailure(...)` from `reason + attempt_count + subReason` ONLY
(`classifierDrainerRetryPolicy.ts:175-247`) — that signature is **byte-unchanged** by this card, so
`failure_detail` is provably downstream of every decision.

---

## Scope

In scope, and nothing else:

1. **One new migration** adding `failure_detail jsonb` NULLABLE DEFAULT NULL to
   `public.argument_machine_observation_runs`, **and** a `CREATE OR REPLACE` of the terminal finalizer
   `public.finalize_classifier_job(...)` to accept one new trailing parameter `p_failure_detail jsonb`
   (plus a `DROP FUNCTION` of the prior 8-arg overload). No backfill.
2. **The drainer's two failure write-paths** in
   `supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts`:
   - terminal failures (`failed_terminal` / `dead_letter`) → the `finalize_classifier_job` RPC call
     in `finalizeJob(...)`;
   - retry scheduling (`retry_scheduled`) → the run-row `.update(...)` in `scheduleRetry(...)`.
3. **One new pure-TS helper** `buildRunRowFailureDetail(...)` (allow-list builder; new file in the
   `booleanObservations` tree) and the small input-threading that carries the existing in-memory
   `classify.adapterResult.detail` + `.subReason` + decision fields into it.
4. **Type edits** local to the drainer: extend `FinalizeJobInput` and `ScheduleRetryInput` with an
   optional `failureDetail` field; add the helper's return type.
5. **The named tests** (helper unit + leak-safety convergence gate; migration shape; drainer
   write-path; no-behavior-change guard).

## Non-goals

- No reporting UI, no admin tab, no SQL view, no consumer, no read path.
- No backfill of historical rows or existing failure rows.
- No change to the success path (it stays byte-equal and leaves `failure_detail` NULL).
- No change to the acceptance gate, routing predicate, retry policy, backoff, `MAX_ATTEMPTS`,
  drainer concurrency (`C=3`), wall-clock budget, claim batch size, or single-flight lease.
- No edit to any prompt, validator, schema mirror, family registry, ban-list, or key.
- **No MCP-server (`mcp-server/`) change** — see "MCP-side change" below; the structured detail the
  card wants already reaches the drainer's write-site. (If a future card wants the MCP server's
  internal `requestId` on the row, that is a separate Deno-push card — out of scope here.)
- No migration APPLY, no deploy, no provider call by the implementer.

---

## Why this is write-only diagnostics

The card's value is "stop leaving the DB to triage." That is achieved the moment the row carries the
fields an investigator currently greps Deno logs for. A **reader** (a view, an admin surface, an
alert) is a separate, larger concern with its own doctrine surface (rendering operational reasons to a
human without implying a verdict; `gameCopy.toPlainLanguage` mapping if it ever becomes user-facing).
Keeping this card write-only:

- **Minimizes blast radius.** The only behavioral change is "a failing cell's row now also carries a
  jsonb." No existing read is altered; the success path is byte-equal.
- **Keeps the doctrine surface tiny.** A column that nothing renders cannot leak to a user and cannot
  imply a verdict to a user. The only doctrine risk is the secret-surface (§6), which the allow-list
  helper closes structurally.
- **Lets the leak-safety gate be total.** Because the only thing the card does with the field is
  *write* it through one helper, a single source-scannable helper + one convergence test fully
  characterize the safety contract. A consumer would add a second surface to audit.

The operator already reads the row via service-role monitoring SQL (the ARCH-001 §A.10 queries and
`scripts/ops/sql/04-failure-reasons-by-family.sql`); `failure_detail` becomes another column those
ad-hoc queries can `SELECT` without any code change. That is the entire "consumer" — a human with
`psql`, not an app code path.

---

## The leak-safe field set (the contract)

`failure_detail` is a jsonb object containing **ONLY** these seven allow-listed keys (every key
optional; the object is absent/NULL when no safe field is available):

| key | type | example | source at the write-site |
|---|---|---|---|
| `validator_path` | string | `evidenceSpan.abductive_explanation_present`, `modelInfo.provider`, `observations.<rawKey>`, `schemaVersion` | `classify.adapterResult.detail.path` (re-derived, allow-listed by the adapter already) |
| `reason` | string (structured) | `validation_failed`, `provider_server_error`, `mcp_api_error` | the persisted `failure_reason` (`decision.failureReason`) and/or the typed `subReason` |
| `family` | string | `argument_scheme`, `critical_question` | `job.family` (the claimed cell's family) |
| `correlation_id` | string (safe id) | `e7c1…` (the run row's own `id` uuid) | `job.id` — see "Correlation-id choice" |
| `attempt_count` | number | `4` | the `attemptCount` already read back via `readAttemptCount(...)` |
| `run_mode` | string | `production`, `admin_validation` | `job.run_mode` |
| `schema_version` | string | `mcp-021.machine-observations.boolean.v1` | the `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant (already imported in the adapter tree) |

**DENY-LIST — NEVER persisted into `failure_detail`, EVER:**

- argument body / `currentText` / `parentText` / `threadContextExcerpt`
- prompt text / any system or user prompt fragment
- `evidenceSpan` / `evidence_span` **values** (the *path string* `evidenceSpan.<rawKey>` is allowed;
  the span **text** is not)
- raw provider payload / response body / the validator's free-text `detail` / `parsed.details`
- any secret: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, JWT, `Bearer …`,
  `Authorization`, MCP token / PAT
- recipient emails
- any free-text the model produced

### Helper rationale — the deny-list is STRUCTURAL

Per the card, the deny-list is enforced **by construction**, not by a filter that hopes to catch
everything: a single small helper `buildRunRowFailureDetail(input)` accepts **ONLY** the seven
allow-listed named inputs. There is **no** `extra` / `message` / `details` / free-text parameter, so a
body / prompt / payload / span text **has no entry point**. This is the exact discipline the repo
already uses for the adapter's in-memory detail in
`booleanObservationFailureSubreason.ts:buildFailureDetail` (named-args-only, no free-text passthrough,
`receivedType` stores `typeof` not the value). The leak-safety test then source-scans the helper and
hostile-fuzzes its inputs.

Defense-in-depth inside the helper (mirroring the proven `buildFailureDetail`):

- `validator_path` kept only if it is a non-empty string that passes a **secret-shape scrub** and is
  ≤ 200 chars. (Optionally also gate against a small allow-list of known validator path prefixes —
  see Open Questions; the adapter's `detail.path` is already allow-listed upstream, so a shape-scrub +
  length cap is sufficient and avoids a brittle second allow-list.)
- `reason`, `family`, `run_mode`, `schema_version` kept only if non-empty strings passing the
  secret-shape scrub, each ≤ 200 chars.
- `correlation_id` kept only if a non-empty string passing the secret-shape scrub, ≤ 200 chars (a
  uuid is ~36 chars and identifier-shaped — it cannot trip the scrub, but the scrub runs anyway).
- `attempt_count` kept only if a finite non-negative integer.
- A final whole-object serialized-size cap (≤ 2000 chars) with graceful degradation, identical in
  spirit to `buildFailureDetail`'s cap.
- Returns `undefined` when no safe field survives (so the column is written NULL, not `{}`).

The **secret-shape scrub** is the same fragment-assembled matcher set already in
`booleanObservationFailureSubreason.ts:283-302` (`SECRET_SHAPE_MATCHERS` / `looksSecret`): `sk-ant-…`,
`xai-…`, `sb_secret_…`, JWT triple, `Bearer …`, `Authorization`, `SERVICE_ROLE`. **Recommendation:**
the new helper re-derives its own copy of these fragment-assembled matchers in its own file (zero edit
to the existing module → maximal preservation; the existing `buildFailureDetail` stays byte-equal).
The alternative — exporting `looksSecret` from `booleanObservationFailureSubreason.ts` — is a one-line
additive change but touches a file the preservation manifest would rather keep frozen. Both are listed
in Open Questions; the design recommends re-derivation.

---

## Data model

One additive, nullable column. No new table, no index, no RLS change, no constraint.

```sql
ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS failure_detail jsonb;   -- NULLABLE, DEFAULT NULL, NO backfill
```

Current column set of `public.argument_machine_observation_runs` (confirmed by reading
`20260526000018` + `20260526000019` + `20260528000021`): `id`, `debate_id`, `argument_id`,
`schema_version`, `requested_families`, `provider_key`, `model_name`, `input_hash`, `status`
(NOT NULL dropped by ARCH-001), `failure_reason`, `started_at`, `completed_at`, `created_at`,
`run_mode`, and the ARCH-001 queue columns `family`, `state`, `attempt_count`, `available_at`,
`lease_expires_at`, `lease_owner`, `failure_sub_reason`, `dead_letter_reason`, `last_attempt_at`.
**There is NO `updated_at`** (the card is right; nothing in this card needs one). `failure_detail`
joins this set as column N+1.

Properties:
- **Nullable, default NULL.** Historical rows stay NULL. Success rows stay NULL. Pre-terminal rows
  (`pending` / `leased`) stay NULL. Only a terminal-failure or retry-scheduled write populates it.
- **No backfill.** No `UPDATE` statement touches existing rows. (The ARCH-001 substrate's one-shot
  `state` backfill is a precedent for being deliberate about NOT backfilling diagnostic columns.)
- **jsonb, not text.** It is a small structured object; jsonb lets future ad-hoc SQL filter on
  `failure_detail->>'reason'` without parsing.

### TypeScript type for the row

The only Edge-side run-row "type" the drainer uses is the 4-field `ClaimedJob` projection
(`classifierDrainerCore.ts:110-115`) and the RPC-input shapes. `failure_detail` is an **input to a
write**, not a field read off a row, so the drainer does NOT add it to a row-read type. The type edits
are on the two write-input interfaces (below).

**Client-side mirror — do NOT touch.** `src/features/nodeLabels/machineObservationPersistenceTypes.ts`
defines `MachineObservationRunRow` (camelCase) and `isWellFormedRunRow`. That mirror is the **MCP-021B
Source-6 read shape**: it requires `status` to be a valid non-null enum (`isWellFormedRunRow` line 212)
and does not model any ARCH-001 queue column (`state`, `attempt_count`, `failure_sub_reason`,
`dead_letter_reason`, …). It is consumed only by the production Source-6 read path
(`machineObservationPersistenceQuery.ts`, filtered to `run_mode='production'` succeeded rows). Since
this card is write-only and the client never reads `failure_detail`, **this mirror MUST NOT gain a
`failureDetail` field** — adding it would imply a read contract that does not exist and would be a
scope violation. This is the type-sync finding: the run row has TWO type surfaces (the queue/drainer
write-input shapes in the Deno tree, and the Source-6 read mirror in `src/`); only the **write-input**
shapes change.

---

## File changes

**New files**

- `supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql` — adds the
  `failure_detail` column to `public.argument_machine_observation_runs` AND re-creates
  `public.finalize_classifier_job(...)` with the trailing `p_failure_detail jsonb` parameter (plus
  `DROP FUNCTION` of the prior 8-arg overload + one `COMMENT ON COLUMN`). ~120–160 lines incl. the
  OPS-001 four-class header and the full function body (the body is the existing finalizer body with
  one extra `SET failure_detail = p_failure_detail` in the terminal-failure UPDATE).
- `supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts` — the new pure-TS
  `buildRunRowFailureDetail(input)` allow-list helper + its `RunRowFailureDetail` return type + the
  re-derived secret-shape scrub. Pure TS (no `Deno.`, no `fetch`, no `console`, no `npm:`), Jest-
  bridgeable. ~120–160 lines.
- `__tests__/_helpers/classifierRunRowFailureDetailDeno.ts` — the require-bridge re-exporting
  `buildRunRowFailureDetail` (mirrors `_helpers/booleanObservationFailureSubreasonDeno.ts`). ~25 lines.
- `__tests__/classifierRunRowFailureDetail.test.ts` — the helper unit tests + the **leak-safety
  convergence gate** (the centerpiece). ~250–320 lines.
- `__tests__/opsMcpClassifierFailureDetailMigration.test.ts` — the migration shape test (mirrors
  `__tests__/archOneCardTwoAFinalizerMigration.test.ts`). ~150–200 lines.

**Modified files**

- `supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts` — the failure-write
  placement (see next section). Adds `failureDetail` to `FinalizeJobInput` (≈ line 428-442) and
  `ScheduleRetryInput` (≈ line 473-480); threads `buildRunRowFailureDetail(...)` into the terminal
  `finalizeJob(...)` call (≈ line 350-359) and the retry `scheduleRetry(...)` call (≈ line 338-344);
  passes `p_failure_detail` in the `finalize_classifier_job` RPC (≈ line 456-465) and
  `failure_detail` in the retry `.update({...})` (≈ line 508-515). The **success** `finalizeJob`
  call (≈ line 293-302) and the **argument_missing** call (≈ line 309-318) and the
  defensive-catch call (≈ line 366-375) pass `failureDetail: undefined` → the RPC receives `NULL`.
  Net change ≈ 30–45 lines, almost all additive.
- `__tests__/_helpers/classifierQueueCard2Deno.ts` — OPTIONAL: extend the bridge if the drainer
  write-path test drives `runClassifierDrain` end-to-end through this helper (it currently bridges the
  retry policy / routing / registry; a full-core drainer test may already live elsewhere — see Test
  plan). ~5–10 lines if touched.

**Deleted files**

- None. (The migration `DROP FUNCTION public.finalize_classifier_job(uuid, text, text, text, text,
  text, text, jsonb)` removes the old 8-arg overload, but that is a SQL statement inside the new
  migration, not a deleted file. The prior migration `20260528000022` is **never edited**.)

---

## API / interface contracts

### New helper

```ts
// classifierRunRowFailureDetail.ts

export interface RunRowFailureDetail {
  validator_path?: string;
  reason?: string;
  family?: string;
  correlation_id?: string;
  attempt_count?: number;
  run_mode?: string;
  schema_version?: string;
}

/**
 * Named, allow-listed inputs ONLY. No free-text / extra / message / payload field exists,
 * so a body / prompt / evidenceSpan value / raw response has no entry point (structural deny-list).
 */
export interface RunRowFailureDetailInput {
  validatorPath?: string;     // <- classify.adapterResult.detail?.path
  reason?: string;            // <- decision.failureReason and/or the typed subReason
  family?: string;            // <- job.family
  correlationId?: string;     // <- job.id (the run row id)
  attemptCount?: number;      // <- attemptCount (already read back)
  runMode?: string;           // <- job.run_mode
  schemaVersion?: string;     // <- MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION
}

/** Returns a sanitized, bounded object, or undefined when no safe field survives (→ write NULL). */
export function buildRunRowFailureDetail(
  input: RunRowFailureDetailInput,
): RunRowFailureDetail | undefined;
```

### Extended write-input types (drainer-local)

```ts
interface FinalizeJobInput {
  // ...existing fields unchanged...
  failureDetail?: RunRowFailureDetail | null;   // ADDITIVE; undefined/null on success & argument_missing
}

interface ScheduleRetryInput {
  // ...existing fields unchanged...
  failureDetail?: RunRowFailureDetail | null;   // ADDITIVE
}
```

### Extended SQL function signature

```
public.finalize_classifier_job(
  p_run_id             uuid,
  p_owner              text,
  p_terminal_state     text,
  p_status             text,
  p_failure_reason     text,
  p_failure_sub_reason text,
  p_dead_letter_reason text,
  p_observations       jsonb,
  p_failure_detail     jsonb    -- NEW trailing param; NULL on success
) RETURNS boolean
```

The new param is **trailing**, nullable, and the **success branch ignores it** (the success UPDATE
does not reference `failure_detail`, so a succeeded row's `failure_detail` stays NULL). The
terminal-failure UPDATE adds exactly one assignment: `failure_detail = p_failure_detail`. Everything
else in the function body is byte-equal to `20260528000022`.

### RPC call from the drainer

`finalizeJob(...)` adds `p_failure_detail: input.failureDetail ?? null` to the `rpc('finalize_classifier_job', {...})`
argument object. `scheduleRetry(...)` adds `failure_detail: input.failureDetail ?? null` to the
`.update({...})` payload.

---

## MCP-side change — needed? **NO.** (with evidence)

**Conclusion: no `mcp-server/` edit, therefore no separate Deno Deploy push.** The structured
`validator_path` and `reason` the card wants are ALREADY produced by the MCP server and ALREADY
delivered to the drainer's failure write-site. Evidence chain:

1. **The MCP server already emits `reason` + `path` on its error envelope.**
   `mcp-server/tools/classifyArgumentBooleanObservations.ts:304-317` (`errorResult`) returns
   `structuredContent: { reason, ...extra }` where `extra` carries `path` (e.g. `modelInfo.provider`,
   `observations.<rawKey>`) and `detail`. The validation-failure and ban-list-failure sites pass a
   `path` (lines 489-497, 582-595, 629-645). PR #418 (`396b939`) added the structured
   `boolean_observation_tool_error` log carrying `reason` + `path` + `requestId` per the `{ isError }`
   envelope — that is the very log these investigations grepped.

2. **The Edge adapter already re-derives `path` + `reason` into `detail` and `subReason`.**
   `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts`:
   - server `{ isError, reason, path }` envelope (lines 264-276) → `subReason: 'provider_server_error'`
     + `detail: buildFailureDetail({ serverReason: extracted.reason, path: extracted.path, … })`;
   - validator failure (lines 287-300) → `subReason: mapToFailureSubreason('validation_failed',
     parsed.reason)` + `detail: buildFailureDetail({ validatorReason: parsed.reason, path?, … })`;
   - schema-version guard (lines 306-318) → `detail.path = 'schemaVersion'`, `detail.expected = <const>`.
   So `BooleanObservationAdapterResult` (`booleanObservationMcpAdapterCore.ts:130-137`) of kind
   `unavailable` already carries `reason`, `subReason?`, and `detail?: BooleanObservationFailureDetail`
   — and `detail.path` is exactly the `validator_path` the card names.

3. **The drainer already HOLDS that detail at the failure branch.**
   `classifierDrainerClassify.ts:82` returns the full
   `Extract<BooleanObservationAdapterResult, { kind: 'unavailable' }>` as `classify.adapterResult`.
   At `classifierDrainerCore.ts:325-359` the drainer reads `classify.adapterResult.reason` and
   `classify.adapterResult.subReason` (passed to `classifyDrainerFailure`). `classify.adapterResult.detail`
   is present and available at that exact site — it is simply **unused today**. The card's change is to
   thread `classify.adapterResult.detail?.path` (→ `validator_path`) and the `failure_reason`/`subReason`
   (→ `reason`) into `buildRunRowFailureDetail(...)` at this branch. **No new data has to cross the
   MCP↔Edge boundary.**

The one thing the MCP server has that the drainer does **not** is the MCP server's **internal**
`requestId` (`input.requestId`): it appears only in the MCP server's own Deno log line and is **not**
returned in the tool result, so the adapter never sees it and it cannot be persisted from the Edge
side. The correlation id is therefore the **run row id** (see next section), not the MCP `requestId`.
If a future card decides it wants the MCP `requestId` on the row to join the two log surfaces, that
WOULD require the MCP server to echo `requestId` into its error/success result → a `mcp-server/` edit
→ a **separate Deno Deploy push** + a familyRegistry-untouched smoke. That is explicitly **out of
scope** here and called out so the implementer does not reach for it.

---

## Correlation-id choice (safe id, cited)

**Recommendation: `correlation_id = job.id`** — the claimed run row's own primary key (a uuid),
available at the write-site as `job.id` (`ClaimedJob.id`, `classifierDrainerCore.ts:110-115`, sourced
from `claim_classifier_jobs` RETURNING `r.id`). Rationale:

- **Non-sensitive.** It is a `gen_random_uuid()` row id — never a token, never a secret. It already
  appears in every ops query and in `lease_owner`-adjacent diagnostics.
- **Ties the row to itself and to any pivot.** An investigator who has a `failure_detail` blob
  (copied into an alert, an export, a paste) can pivot straight back to the row by `id`. Inside the DB
  it is technically redundant with the row's `id`, but the value's purpose is to survive **outside**
  the row (in a log/alert/export context detached from the row), and to be the stable join key when a
  richer id is threaded later.
- **Already the natural unit.** Per-cell failures are per-row; `job.id` is the per-row id. The
  drainer's `owner` (`drain-<uuid>`, `classifier-drainer/index.ts:68-74`) is a coarser
  per-invocation id (many jobs share one `owner`); it is a reasonable **secondary** but the card's
  allow-list has a single `correlation_id`, so `job.id` is the pick.

**Open question for the operator** (see Open Questions): if you would rather the single
`correlation_id` be the **drain-invocation** id (`owner`) so a `failure_detail` blob points at the
drain run rather than the cell, say so — the helper input flips from `job.id` to `deps.owner` with no
other change. The design recommends `job.id`.

The MCP server's `requestId` is explicitly NOT used (it does not reach the Edge side; see MCP-side
section).

---

## Type sync (file + any mirror)

- **Edge write-input shapes (CHANGE):** `FinalizeJobInput` + `ScheduleRetryInput` in
  `classifierDrainerCore.ts` gain `failureDetail?: RunRowFailureDetail | null`. New
  `RunRowFailureDetail` type lives in `classifierRunRowFailureDetail.ts`.
- **Source-6 read mirror (DO NOT CHANGE):**
  `src/features/nodeLabels/machineObservationPersistenceTypes.ts` `MachineObservationRunRow` /
  `isWellFormedRunRow`. This is the read shape for production Source-6 rendering; it is not a consumer
  of `failure_detail` and must stay frozen (adding the field would imply a non-existent read contract).
- **No other run-row TS mirror exists.** A grep for `failure_sub_reason | failureSubReason |
  dead_letter_reason | deadLetterReason` across `*.ts` returns only the drainer core, the retry
  policy, the direct-dispatch core, the bridges, and tests — there is no third dual-copy of the run
  row to keep in sync.

---

## Write-path placement (exact file:line per failure branch)

The drainer is the **only** write-path this card touches. There are exactly three failure outcomes,
all inside `processOneJob(...)` in
`supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts`. The success path is
**separate** and stays byte-equal.

| outcome | decided where | writes failure columns where (file:line) | `failure_detail` added how |
|---|---|---|---|
| `retry_scheduled` | `classifyDrainerFailure(...)` → `decision.disposition === 'retry'` (`classifierDrainerCore.ts:332`) | `scheduleRetry(...)` run-row `.update({...})` — `classifierDrainerCore.ts:506-519` (sets `state='retry_scheduled'`, `available_at`, `failure_reason`, `failure_sub_reason`, clears lease) | add `failure_detail: input.failureDetail ?? null` to the `.update({...})` payload; build the detail in the `scheduleRetry(...)` call at lines 338-344 |
| `failed_terminal` | `decision.disposition === 'failed_terminal'` (+ the `argument_missing` branch at 308-320, and the defensive-catch at 362-380) | `finalizeJob(...)` → `finalize_classifier_job` RPC — `classifierDrainerCore.ts:451-471`; the terminal call site is 350-359 | add `p_failure_detail: input.failureDetail ?? null` to the RPC args; build the detail in the `finalizeJob(...)` call at 350-359 |
| `dead_letter` | `decision.disposition === 'dead_letter'` (`classifierDrainerCore.ts:353`) | same `finalizeJob(...)` RPC at 451-471, terminal call site 350-359 (sets `dead_letter_reason` too) | same as `failed_terminal` |

The SQL columns these branches write to live in two places:
- the **retry** UPDATE is a direct PostgREST `.update(...)` in the Edge function → just add the key;
- the **terminal** writes go through `public.finalize_classifier_job(...)`
  (`supabase/migrations/20260528000022_arch_001_card2a_atomic_finalizer.sql:139-272`) → that function's
  terminal-failure UPDATE (lines 255-268) gets one new assignment `failure_detail = p_failure_detail`,
  and the function signature gains the trailing `p_failure_detail jsonb` (line 147 area).

**Success path is separate and untouched.** The success outcome calls `finalizeJob(...)` at
`classifierDrainerCore.ts:293-302` with `terminalState: 'succeeded'`; that maps to the finalizer's
success branch (`20260528000022:194-246`), which does NOT reference `failure_detail`. The card requires
the success path to "stay byte-equal and write `failure_detail = NULL`": the drainer passes
`failureDetail: undefined` (→ RPC `NULL`) and the success UPDATE simply never assigns the column, so it
remains NULL by the column default. Confirmed byte-equal: the only edit to the success branch is none.

**Where the detail is built (the threading):** at the terminal call site (350-359) and the retry call
site (338-344), construct:
```ts
const failureDetail = buildRunRowFailureDetail({
  validatorPath: classify.adapterResult.detail?.path,           // available at this branch
  reason: decision.failureReason,                                // and/or classify.adapterResult.subReason
  family: job.family,
  correlationId: job.id,                                         // the run row id
  attemptCount,                                                  // already read via readAttemptCount(...)
  runMode: job.run_mode,
  schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,         // import the existing constant
});
```
For `argument_missing` (308-320) and the defensive-catch (362-380), `classify.adapterResult` does not
exist (there is no adapter result), so the implementer either passes `failureDetail: undefined` (→ NULL,
simplest, recommended) OR builds a minimal detail of `{ reason: 'argument_not_found' | 'drainer_unexpected_error',
family, correlationId, attemptCount?, runMode }`. **Recommendation: minimal detail for these two too**
(they are exactly the kind of terminal a future investigator wants self-described) — but it is the
implementer's call and either is leak-safe. State the choice in the PR.

---

## Out-of-scope write-paths (do NOT touch — disambiguation)

These superficially look like "failure write sites" but are the **wrong path** and are explicitly out
of scope:

- `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` — this is the
  **direct-dispatch / submit-path** classifier. It calls `persistRun(...)` (INSERT) with
  `status:'failed'` + `failureReason` on the submit path (lines 211-212, 246-265, 302-303, 369-370).
  It **INSERTs a fresh run row per call** and is NOT the queue drainer. The queue reuses one run row
  across retries; the drainer is the card's surface. Touching `classifyArgumentCore` would (a) be
  scope creep, (b) change the submit path (a user-facing latency surface), and (c) require its own
  `persistRun` column plumbing. Leave it byte-equal.
- `supabase/functions/_shared/booleanObservations/persistenceWriter.ts` — `persistRun` /
  `persistResults`, the INSERT writer used by the direct-dispatch path. Out of scope.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — see MCP-side section; no change.
- `classifierDrainerRetryPolicy.ts` — the decision function. **Byte-unchanged** (the card forbids any
  retry-policy change). It may *supply* `decision.failureReason` to the helper input, but its own
  source does not change.

---

## Edge cases

- **Empty / absent detail.** When `classify.adapterResult.detail` is undefined (e.g. a
  `network_error` / `rate_limited` path where the adapter sets `subReason` but no `detail` —
  `booleanObservationMcpAdapter.ts:205-222`), `validatorPath` is `undefined`; the helper still
  populates `reason` + `family` + `correlation_id` + `attempt_count` + `run_mode` + `schema_version`.
  If literally nothing safe is available, `buildRunRowFailureDetail` returns `undefined` → the column
  is written NULL (not `{}`).
- **`argument_missing` and defensive-catch terminals.** No adapter result exists. Pass
  `failureDetail: undefined` (NULL) or a minimal `{ reason, family, correlation_id, … }` — both
  leak-safe (see write-path section).
- **Concurrent finalize / lost lease.** `finalize_classifier_job` returns FALSE as a hard no-op when
  the caller lost the lease (`20260528000022:188-191`); the run-row UPDATE never executes, so
  `failure_detail` is NOT written by a non-owner. The retry `scheduleRetry(...)` is guarded on
  `lease_owner = owner AND state = 'leased'` (`classifierDrainerCore.ts:516-518`) → a reclaimed/wrong
  -owner row writes nothing. `failure_detail` inherits these existing guards for free; it is in the
  same single UPDATE statement, so it is written **iff** the existing failure columns are written.
- **Reclaim path (lease expiry).** `reclaim_stale_leases()` (`20260528000021:402-436`) can flip a
  stuck `leased` row to `dead_letter` with `dead_letter_reason='lease_expired_attempt_cap_reached'`
  **without** going through the drainer or the finalizer. Those rows will have `failure_detail = NULL`.
  That is correct and acceptable: a reclaim is a lease-expiry backstop, not a classify failure, and
  there is no adapter detail to record. The card does not ask to populate `failure_detail` on the
  reclaim path, and doing so is out of scope (it would edit `20260528000021`'s function, which is
  applied — forbidden). State this explicitly so the investigator knows reclaim-dead-letters are
  legitimately detail-NULL.
- **Hostile / misbehaving server.** If a future provider stuffs a token or body into `path` /
  `reason` / `serverReason`, the helper's secret-shape scrub + length cap + serialized cap drop it
  (the leak-safety gate proves this with the same HALT-4 fixture pattern). The deny-list-by-
  construction means body/prompt/payload never even reach the helper.
- **Oversized detail.** Bounded by the per-field 200-char cap and the whole-object ≤ 2000-char cap
  with graceful degradation. A jsonb of ~7 short string fields is well under budget; the cap is
  belt-and-suspenders.
- **Doctrine-constraint edge case ("could heat / popularity reach `failure_detail`?").** No — none of
  the seven fields carries engagement, heat, popularity, or a verdict; `reason`/`validator_path`/
  `family` are transport/schema/structural strings. The vocabulary ban-list test asserts the fields
  are verdict-free.
- **Empty-string vs NULL.** The helper drops empty strings (treats them as absent), so a field is
  either a non-empty sanitized string or absent — never `''`.

---

## Test plan

All under `__tests__/`. Pure-TS helper + migration-text scans + drainer write-path; no live DB
(Docker is typically unavailable — runtime DB behavior is proven by the operator post-merge, same as
the Card-2A finalizer). **The leak-safety convergence gate is the centerpiece.**

### 1. `__tests__/classifierRunRowFailureDetail.test.ts` — helper unit + LEAK-SAFETY GATE (centerpiece)

Mirror the structure of `__tests__/booleanObservationFailureSubreason.test.ts` (the proven HALT-4
wall). Cases:

- **Allow-only (happy path):** each of the seven keys round-trips when given a benign value;
  `validator_path: 'evidenceSpan.abductive_explanation_present'` survives; `attempt_count: 4` survives
  as a number; empty input → `undefined` (NULL, not `{}`).
- **Deny-never (the gate):** a single hostile fixture passing benign structural fields PLUS every
  banned shape via every string entry point (`sk-ant-…`, `xai-…`, `sb_secret_…`, JWT triple,
  `Bearer …`, `Authorization: …`, a long prompt body, a 5000-char blob — each assembled from
  fragments so the test file itself carries no contiguous secret literal). Assert: the serialized
  output trips NONE of the secret-shape matchers; the prompt/body text is nowhere; the safe fields
  survive; a hostile `validator_path`/`reason`/`family` carrying a token is **dropped**, and when it
  was the only field the whole detail is `undefined`.
- **Structural deny-list (the point of the helper):** assert by source-scan that
  `RunRowFailureDetailInput` has **no** `extra` / `message` / `details` / `payload` / `body` / `prompt`
  field — i.e. there is no free-text entry point. (A `Object.keys` assertion on the input shape is not
  possible for an interface; instead source-scan `classifierRunRowFailureDetail.ts` for the absence of
  those identifiers as input keys, and assert the helper ignores any extra property passed via
  `as any`.)
- **Caps:** a 5000-char `reason`/`validator_path` is capped at ≤ 200 chars; a detail built from many
  long inputs serializes ≤ 2000 chars with graceful degradation; `validatorReason`/`reason` survive
  degradation.
- **`attempt_count` typing:** a non-integer / negative / `NaN` / string is dropped; a valid
  non-negative integer is kept.
- **Vocabulary ban-list (doctrine §1):** assert no field value the helper *emits from its own
  constants* contains a verdict token (`winner / loser / true / false / correct / liar / dishonest /
  bad faith / manipulative / extremist / propagandist / stupid / idiot`). (The dynamic `reason` comes
  from `failure_reason`, which is already proven verdict-free by the retry-policy ban-list test; this
  gate covers any literal the helper itself introduces.)

### 2. `__tests__/opsMcpClassifierFailureDetailMigration.test.ts` — migration shape

Mirror `__tests__/archOneCardTwoAFinalizerMigration.test.ts` (comment-strip + `functionBody`
helpers). Assert:

- file exists; sorts AFTER `20260601000001` (ordinal string compare); OPS-001 four-class header
  present; OPERATOR GATE ("WRITTEN, NOT APPLIED" + `supabase db push --linked`).
- **column add:** `ADD COLUMN IF NOT EXISTS failure_detail jsonb` present; **NOT NULL is NOT applied**
  (`failure_detail(?!\s+NOT NULL)`); **NO backfill** (no `UPDATE public.argument_machine_observation_runs`
  in executable SQL); no new table / index / RLS / policy / extension.
- **finalizer re-create:** exactly the expected `CREATE OR REPLACE FUNCTION
  public.finalize_classifier_job` with a **9-parameter** signature ending in `p_failure_detail jsonb`;
  a `DROP FUNCTION public.finalize_classifier_job(uuid, text, text, text, text, text, text, jsonb)`
  (the old 8-arg overload) present; the terminal-failure UPDATE assigns `failure_detail =
  p_failure_detail`; **the success branch does NOT reference `failure_detail`** (window-scan the
  success branch like FIN-28 does for `failure_reason`).
- **atomicity preserved:** the finalizer body still contains NO `COMMIT / ROLLBACK / SAVEPOINT /
  autonomous / dblink / pg_background / EXCEPTION WHEN` (re-assert FIN-13/14/15 against the new body).
- **ownership guard preserved:** the guard SELECT still runs before any write (re-assert FIN-16/18).
- **secret-safety (§6):** no `SERVICE_ROLE / ANTHROPIC_API_KEY / sk-ant- / sb_secret / xai- / Bearer /
  JWT` literal in executable SQL; no `COMMENT ON … storage.*`.
- **one COMMENT ON COLUMN** documenting `failure_detail` as a leak-safe diagnostic jsonb (doctrine
  §1/§6 wording).

### 3. `__tests__/classifierDrainerFailureDetailWrite.test.ts` (or extend an existing Card-2 drainer suite) — write-path

Drive the drainer core (via the `classifierQueueCard2Deno.ts` bridge / a stubbed `serviceClient`
+ adapter, the pattern the Card-2 drainer tests already use). Assert:

- **terminal failure** (`failed_terminal` / `dead_letter`) → the `finalize_classifier_job` RPC is
  called with a `p_failure_detail` argument that equals `buildRunRowFailureDetail({...})` for that
  branch (and carries `validator_path`/`reason`/`family`/`correlation_id`/`attempt_count`/`run_mode`/
  `schema_version` as available).
- **retry** (`retry_scheduled`) → the run-row `.update({...})` payload includes `failure_detail` equal
  to the built detail.
- **success** → the `finalize_classifier_job` RPC is called with `p_failure_detail: null` (NOT a
  populated object). **This is the no-behavior-change guard for the success path.**
- **lost-lease / wrong-owner** → unchanged dispositions; `failure_detail` rides the same guarded
  UPDATE (the test asserts the disposition counts are byte-identical to the pre-card baseline — i.e.
  adding `failure_detail` did not change `jobsRetried` / `jobsFailed` / `jobsDeadLettered` /
  `jobsLostLease` for any fixture).

### 4. No-behavior-change guard (doctrine + decision invariant)

- Assert `classifyDrainerFailure(...)`'s signature/behavior is unchanged (its existing test
  `__tests__/archOneCardTwoRetryPolicy.test.ts` must remain green with zero edits — the card touches
  no retry-policy line).
- Assert the drainer `DrainSummary` counters are computed from the same dispositions (existing Card-2
  drainer tests stay green).

Run `npm run typecheck && npm run lint && npm run test`; capture the `Test Suites: … / Tests: …` line
with the explicit exit code (test-discipline gate-timeout rule). Update `docs/core/current-status.md`
with the new count only after it is confirmed. Current baseline: **18,153 tests / 570 suites** (per
the tail of `current-status.md`). Expect +~30–45 new tests; the count must go UP.

---

## Dependencies (cards / docs / files)

- **Assumes ARCH-001 Cards 1 + 2 + 2A are complete and applied** — the run row, the
  `finalize_classifier_job` finalizer, and the drainer all exist (they do; migrations
  `20260528000021/000022/000023` shipped, drainer is live, Stage 1 ran and closed). `failure_detail`
  extends that substrate.
- **Reads** `public.finalize_classifier_job` at `20260528000022:139-272` (extends its signature +
  terminal UPDATE) and the run row column set at `20260528000021:148-194`.
- **Reads** the drainer write-sites at `classifierDrainerCore.ts:293-359, 451-527`.
- **Reuses** the secret-shape scrub pattern from `booleanObservationFailureSubreason.ts:283-302` and
  the leak-safety test pattern from `__tests__/booleanObservationFailureSubreason.test.ts:306-473`.
- **Does NOT block any known future card.** A later "failure_detail reader / triage view" card (if
  ever filed) would depend on THIS card. This card creates a column that nothing reads.

---

## Risks

- **Finalizer overload trap (the main one).** Postgres treats `finalize_classifier_job(8 args)` and
  `finalize_classifier_job(9 args)` as **distinct functions**. The migration MUST `DROP FUNCTION` the
  old 8-arg overload, otherwise both coexist and the drainer's 9-arg RPC call must match exactly. The
  migration-shape test asserts the `DROP FUNCTION (… 8 args)` is present and that the new
  `CREATE OR REPLACE` is 9-arg. Mitigation: explicit `DROP FUNCTION IF EXISTS public.finalize_classifier_job(uuid,
  text, text, text, text, text, text, jsonb);` then the 9-arg `CREATE OR REPLACE`.
- **Deploy ordering (HALT-class).** If the drainer (which calls the 9-arg RPC and writes
  `failure_detail`) is deployed BEFORE the migration applies, every failing cell's terminal write
  throws (unknown column / no matching function), turning a clean failure into a drainer error. The
  migration MUST land first — see Deployment ordering below. Because Edge auto-deploys on merge, the
  migration must be applied BEFORE the PR merges.
- **`archOneCardTwoAFinalizerMigration.test.ts` (the existing 8-arg shape test).** It reads the OLD
  file `20260528000022` (unchanged) and asserts an 8-arg signature. It stays GREEN because this card
  never edits `20260528000022` — the 9-arg finalizer lives in the NEW migration with its own shape
  test. The implementer must NOT "fix" the old test to 9 args.
- **`scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql`** (the operator post-merge
  verifier) exercises the 8-arg finalizer. After this card it should be re-run against the 9-arg
  version (passing `NULL` for `p_failure_detail`); the implementer should either update that script or
  the operator runbook notes that the verifier must pass `NULL` for the new param. Flag in the PR; it
  is operator tooling, not app code, so updating it is low-risk and in-spirit (but confirm whether the
  card's boundary permits editing that script — see Open Questions).
- **Source-scan fences.** The new helper file lives under `supabase/functions/` (Deno tree), which the
  `src/`/`app/` source-scan fences out; keep it pure TS (no `Deno.`/`fetch`/`console`/`npm:`) so the
  Jest bridge loads it. The test file must assemble secret-shaped literals from fragments (the SCAN-17
  convention) so the repo secret-literal scan stays green.
- **jsonb passed via supabase-js `.update(...)`.** The retry path passes a JS object as `failure_detail`;
  supabase-js serializes it to jsonb. Confirm the object is plain (the helper returns a plain object).
  No risk for the RPC path (the RPC arg is jsonb).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels; score never blocks posting):** `failure_detail`
  is operational triage metadata on a queue row; it carries transport/schema/structural strings only,
  never a verdict about a participant. It does not block posting (the rules engine is the sole gate;
  this is written AFTER storage and read by nothing). The vocabulary ban-list test asserts the helper
  emits no verdict token; the dynamic `reason` is sourced from `failure_reason`, already proven
  verdict-free.
- **cdiscourse-doctrine §3 (popularity/heat is not evidence):** none of the seven fields carries
  engagement, heat, popularity, or virality — they are failure-class facts. No anti-amplification
  surface is touched.
- **cdiscourse-doctrine §6 (secrets; service-role server-only):** the column is a secret-surface
  closed STRUCTURALLY — `buildRunRowFailureDetail` accepts only seven named allow-listed inputs (no
  body/prompt/payload/free-text entry point), runs a secret-shape scrub + length/serialized caps, and
  the leak-safety convergence gate proves every banned shape is dropped. The drainer already runs
  service-role server-side; no key, token, JWT, Bearer, or Authorization can reach the column. No
  secret literal is added to any migration or source (fragment-assembled matchers; SCAN-17).
- **cdiscourse-doctrine §7 (no AI calls from the production app):** untouched — this is Edge/DB only,
  no provider call, no `mcp-server/` change.
- **cdiscourse-doctrine §8 (Supabase conventions):** new sequential migration (never edits an applied
  one); RLS unchanged (service-role writes, bypasses RLS as the existing writer does); the column is
  additive nullable; `arguments`/`flags` row rules untouched.
- **cdiscourse-doctrine §10a (observations vs allegations):** `failure_detail` is operational metadata
  one level below even a Machine Observation — it describes the classifier RUN's failure, not the
  argument. It is never rendered, so it cannot read as an allegation against a person.
- **Acceptance-gate invariant:** `classifyDrainerFailure(...)` (the retry/terminal/dead-letter
  decision) is byte-unchanged; `failure_detail` is provably written AFTER and downstream of every
  decision; nothing reads it. It cannot influence acceptance, routing, retry, or user output.

---

## Preservation manifest (what stays byte-equal)

- **Success path:** `classifierDrainerCore.ts` success `finalizeJob` call (293-302) and the finalizer
  success branch (`20260528000022:194-246`) — no `failure_detail` reference; row stays NULL.
- **Retry/terminal DECISION:** `classifierDrainerRetryPolicy.ts` (`classifyDrainerFailure` and all
  constants `DRAINER_MAX_ATTEMPTS`, backoff schedules) — byte-unchanged.
- **Drainer operating params:** `DRAINER_PROVIDER_CONCURRENCY=3`, `DRAINER_WALL_CLOCK_BUDGET_MS`,
  `DRAINER_CLAIM_BATCH_SIZE`, `DRAINER_MAX_JOBS_PER_INVOCATION`, lease TTL/seconds — untouched.
- **Submit / direct-dispatch path:** `classifyArgumentCore.ts`, `persistenceWriter.ts`,
  `autoTriggerDispatcher.ts` — untouched.
- **MCP server:** entire `mcp-server/` tree — untouched (no Deno push).
- **Existing failure-detail module:** `booleanObservationFailureSubreason.ts` (`buildFailureDetail`,
  `mapToFailureSubreason`, the vocabulary) — untouched (the new helper re-derives its scrub rather than
  importing, per the recommendation). The existing
  `__tests__/booleanObservationFailureSubreason.test.ts` stays green.
- **Existing finalizer migration `20260528000022`** and its test
  `archOneCardTwoAFinalizerMigration.test.ts` — never edited.
- **Family registry, prompts, validators, schema mirror, ban-lists, keys** — untouched.
- **RLS / policies / indexes / extensions** — untouched.

---

## Migration filename recommendation

`supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql`

It sorts strictly after the current latest `20260601000001_cutover_health_metrics_function.sql`
(string compare `20260602000001 > 20260601000001` ✓) and is dated for the current build day. The
header must carry the OPS-001 four-class statement-order block (Class B: the `ADD COLUMN`; Class E: the
`DROP FUNCTION` + `CREATE OR REPLACE FUNCTION` + `COMMENT ON COLUMN`), the "WRITTEN, NOT APPLIED"
operator gate, the predecessor list (`20260528000021`, `20260528000022`), and the "no client write
path" note (zero `CREATE POLICY`).

---

## Deployment ordering (operator runbook — MANDATORY)

Routing is currently **DISARMED** (Stage 1 closed 2026-06-02; `CLASSIFIER_QUEUE_ROUTING_ENABLED=false`,
`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0`), so the live blast radius of this change is **zero** organic
cells while it lands. Keep it disarmed through the deploy.

1. **Apply the migration FIRST**, from the branch, BEFORE the PR merges (because the Supabase GitHub
   integration auto-applies migrations + auto-redeploys Edge Functions on merge to `main`, and the
   drainer's terminal write calls the 9-arg `finalize_classifier_job` + writes `failure_detail`; if
   the drainer deploys before the column + function exist, every failing cell's write throws):
   - Either land a **migration-only PR** first and apply it, then open the drainer PR; OR
   - apply from the feature branch: `npx supabase db push --linked` while the branch is checked out,
     confirm the column + 9-arg function exist, THEN merge.
2. **Verify the column + function exist** before merge:
   - column: `SELECT 1 FROM information_schema.columns WHERE table_name =
     'argument_machine_observation_runs' AND column_name = 'failure_detail';`
   - function: `\df public.finalize_classifier_job` shows the 9-arg overload (and the 8-arg overload is
     gone).
3. **Merge the PR.** The Supabase integration auto-redeploys the `classifier-drainer` Edge Function
   (Phase 5 auto-deploy). No manual `functions deploy` is needed for the drainer.
4. **No `mcp-server/` deploy** — there is no MCP change.
5. **Leave routing DISARMED.** Re-arming Stage 1 is a separate operator decision unrelated to this
   card. When routing is eventually re-armed, `failure_detail` populates automatically on the next
   failing cell; no further action.
6. (Optional, operator tooling) re-run `scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql`
   against the applied DB (passing `NULL` for the new `p_failure_detail`) to confirm the finalizer
   still behaves; or rely on the new migration-shape test + a smoke after re-arming.

**Why migration-before-merge is non-negotiable:** auto-deploy on merge means the drainer code and the
schema land in the same merge event; if the schema is not already present, the first failing cell after
deploy errors instead of recording a clean failure. Applying the migration from the branch (or via a
prior migration-only PR) guarantees the column + 9-arg function exist before any drainer build that
references them goes live.

---

## Operator steps (summary)

1. `npx supabase db push --linked` from the feature branch (apply migration BEFORE merge).
2. Verify `failure_detail` column + 9-arg `finalize_classifier_job` exist.
3. Merge the PR (Edge auto-deploys the drainer).
4. Routing stays disarmed; nothing else to run.

(No provider call, no `mcp-server/` deploy, no re-arm required by this card.)

---

## Open questions (operator decision before / during build)

1. **`correlation_id` value:** the design recommends `job.id` (the run row's own id). Confirm, or
   choose the drain-invocation `owner` (`drain-<uuid>`) instead if you want a `failure_detail` blob to
   point at the drain run rather than the cell. (One-line change either way.)
2. **`argument_missing` + defensive-catch terminals:** populate a minimal `failure_detail`
   (`{ reason, family, correlation_id, … }`) on these, or leave them NULL? The design recommends
   minimal-populate (they are exactly the terminals an investigator wants self-described), but NULL is
   equally leak-safe. Default to minimal-populate unless you say otherwise.
3. **Scrub sharing:** the new helper re-derives its own secret-shape matchers (recommended; zero edit
   to `booleanObservationFailureSubreason.ts`) vs. exporting `looksSecret` from that module and
   importing it (one-line additive edit, no duplication). Default to re-derive unless you prefer the
   shared export.
4. **`verify-finalize-classifier-job.sql`:** may the implementer update that operator verifier script
   (and/or its review doc) to pass `NULL` for the new 9th param, or should it be left for you to
   update out-of-band? It is operator SQL tooling, not app code; the card boundary is silent on it.
5. **`validator_path` gating:** shape-scrub + length cap only (recommended; the adapter already
   allow-lists `detail.path` upstream), or also gate against a static allow-list of known validator
   path prefixes in the new helper (more defensive, more brittle)? Default to scrub + cap.
