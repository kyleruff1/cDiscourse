# OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 — Design

Populate `failure_detail` (jsonb) + `failure_sub_reason` (text) on the
**direct-dispatch** (auto-trigger) terminal-failure persist path, reusing the
existing leak-safe projection builder off the in-memory `PerArgumentSummary`.

> **Constitutional acceptance-gate invariant (verbatim).**
> "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The
> deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole
> gate. Classifiers run after an argument is stored. No path may block, reject,
> route, or delay an ordinary user post."
>
> This card touches the classifier **persist** path. Everything below happens
> *after* the argument row already exists and *after* `submit-argument` has
> returned `201`. It changes only what diagnostic columns get written on a run
> row whose classification already failed. It adds no read, no branch, no gate,
> no latency to the user submit path.

---

## Verified-at-HEAD hash

All file:line citations in this document were verified against
**`git rev-parse HEAD` = `37ccd9ed027c625686f3eee517d03a48df25a29d`
(short `37ccd9e`)**.

---

## Scope

1. Extend `PersistRunInput` and `persistRun`'s `insertPayload`
   (`persistenceWriter.ts:35-50`, `:83-96`) with two **additive, optional**
   fields: `failureDetail` (the leak-safe jsonb object) and `failureSubReason`
   (text). When omitted, the writer behaves byte-identically to today.
2. Thread those two values from the failed branch of `classifyOneArgumentCore`
   (`classifyArgumentCore.ts:245-276`) into the `persistRun(...)` call it
   already makes on the adapter-`unavailable` path.
3. Build the `failure_detail` jsonb by calling the **existing** leak-safe
   builder `buildRunRowFailureDetail(...)`
   (`classifierRunRowFailureDetail.ts:142-192`) off the data already in hand on
   the in-memory `PerArgumentSummary` / `adapterResult`.
4. Map the typed `failureSubReason` (already threaded onto the return at
   `classifyArgumentCore.ts:273`) into the `failure_sub_reason` text column.
5. Tests (source-scan + builder reuse coverage; the Deno-only files cannot run
   under Jest — see Test-count forecast).

This is **Edge design** under `supabase/functions/_shared/**`. Merge =
deploy → **GATE C operator-only**. This run is **design-only**: no code, no
tests, no migration, no mutating command.

---

## Non-goals

- **No migration.** The `failure_detail jsonb` column already exists
  (`20260602000001_ops_mcp_classifier_failure_detail.sql:113-114`), and
  `failure_sub_reason text` already exists from the queue-substrate migration
  (`20260528000021_arch_001_classifier_queue_substrate.sql`, per Phase-0
  fact `column_types`). `requiresMigration: false`.
- **No routing / ramp / H-I-J change.** This card does not arm
  `CLASSIFIER_QUEUE_ROUTING_ENABLED`, does not change
  `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`, and does not flip any family's
  `productionEnabled` in `familyRegistry.ts`. The frozen set (A–G `true`;
  H/I/J `false`, `familyRegistry.ts:69-118`) is untouched.
- **No queue-drainer change.** The drainer already writes these two columns
  (`classifierDrainerCore.ts`, per Phase-0 fact `queue_drainer_is_sole_db_writer`).
  This card adds the *direct-dispatch* writer; the drainer path is byte-equal.
- **No new builder / no widening of the allow-list.** We reuse
  `buildRunRowFailureDetail` exactly as the drainer does. No new entry point,
  no `extra`/`message`/`body`/`payload`/`prompt` field is added
  (`classifierRunRowFailureDetail.ts:53-58`).
- **No read consumer in this card.** `OPS-MCP-OBSERVABILITY-002` (#470) is the
  downstream reader; it is a **soft dependency**, not in scope here.
- **No retry / dispatch / concurrency / idempotency change.** The retry
  schedule, bounded-parallel dispatch, and per-family idempotency pre-check are
  all untouched.
- **No user-facing surface.** `failure_detail` is WRITE-ONLY diagnostics
  (`classifierRunRowFailureDetail.ts:11-12`: "nothing reads `failure_detail`").
  Nothing in this card renders any field to a user (doctrine §9 / §10a N/A —
  no user string emitted).

---

## Current production state

### The direct-dispatch failed-branch write

The auto-trigger (direct-dispatch) path is the default for every ordinary
submit (`autoTriggerDispatcher.dispatchAutoTriggerForArgument`, the `else`
branch of the routing fork; Phase-0 fact `direct_dispatch_default_confirmed`,
`autoTriggerDispatcher.ts:430-499`). When the MCP adapter is `unavailable`,
`classifyOneArgumentCore` writes a terminal-failure run row via `persistRun`:

```
classifyArgumentCore.ts:245-260  (failed branch)
  if (adapterResult.kind === 'unavailable') {
    const failureReason = unavailableReasonToFailureReason(adapterResult.reason);
    const runWrite = await persistRun({
      ...,
      status: 'failed',
      failureReason,         // ← the ONLY failure field written
      startedAt, completedAt,
    });
```

`persistRun`'s `insertPayload` carries **only** `failure_reason`
(`persistenceWriter.ts:93`); the `PersistRunInput` interface has no
`failureDetail` and no `failureSubReason` key (`persistenceWriter.ts:35-50`).
So on every direct-dispatch failed run row, `failure_detail` and
`failure_sub_reason` stay at their NULL column default.

### The data is computed but dropped before persist

The typed detail already exists in memory:

- `classifyOneArgumentCore` threads `adapterResult.subReason` and
  `adapterResult.detail` onto the **return** value's `failureSubReason` /
  `failureDetail` fields (`classifyArgumentCore.ts:261-275`), where
  `failureDetail: BooleanObservationFailureDetail` carries structural fields
  only (`validatorReason / path / expected / receivedType / receivedKeys /
  checkedRawKey / schemaVersion / family / serverReason`;
  `booleanObservationFailureSubreason.ts:107-131`).
- The dispatcher then emits both to the **structured log line only**
  (`autoTriggerDispatcher.ts:380-389`): the comment is explicit — "the run
  row's `failure_reason` is untouched". They never reach a DB column.

### The queue drainer is the sole DB writer of these two columns today

`buildRunRowFailureDetail` + `finalize_classifier_job` appear ONLY in
`classifierDrainer*` files (Phase-0 fact `queue_drainer_is_sole_db_writer`).
The drainer builds the leak-safe object and passes it as `p_failure_detail`;
the direct path imports neither.

### Phase-7 evidence (the motivating finding)

The CORPUS-30 Phase-7 audit observed `failure_sub_reason` NULL (all) and
`failure_detail.reason` NULL (all) across **every A–G family** —
**1,878 failed A–G rows** (1,403 `mcp_api_error` / 74.7% + 475
`mcp_network_error` / 25.3%), explicitly attributing it to the direct path:
"direct-dispatch leaves it NULL by design … `failure_detail` populates only
on terminal-failure write paths in the queue drainer, not in the auto-trigger
dispatcher's direct path"
(`docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md:46-57`, `:24`).
That blinds triage: 1,878 failures with no validator path, no structured
reason, no correlation id on the row.

### The leak-safe builder we reuse

`buildRunRowFailureDetail(input)` (`classifierRunRowFailureDetail.ts:142-192`)
accepts ONLY seven named, allow-listed inputs
(`validatorPath / reason / family / correlationId / attemptCount / runMode /
schemaVersion`; `:60-75`). There is no `extra / message / details / payload /
body / prompt` field — an argument body, prompt fragment, `evidenceSpan`, or
raw provider response **has no entry point** (`:53-58`, `:14-20`). On top of
that structural deny-list: each string field is dropped if it trips a
secret-shape matcher (`sk-ant-…`, `xai-…`, `sb_secret_…`, JWT triple, Bearer,
`Authorization`, `SERVICE_ROLE`; `:88-99`), capped at 200 chars (`:77`,
`:114-118`), and the whole object capped at 2000 serialized chars with
graceful degradation (`:78`, `:176-191`). It returns `undefined` when nothing
safe survives → the column is written NULL, not `{}` (`:173-174`).

### Frozen / append-only state (unchanged by this card)

- Family registry: A–G `productionEnabled: true`; H/I/J (`claim_clarity`,
  `thread_topology`, `sensitive_composer`) `productionEnabled: false`
  (`familyRegistry.ts:69-118`).
- Routing baseline off: `CLASSIFIER_QUEUE_ROUTING_ENABLED` strict `=== 'true'`
  (unset = false); `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` default 0 (Phase-0
  facts `master_enable_env_name`, `percentage_env_name`).

---

## RCA / problem summary

**Root cause.** The diagnostic projection (`failure_sub_reason`,
`failure_detail`) was built into the queue drainer's terminal-failure write
when migration `20260602000001` landed, but the **direct-dispatch** path — the
default for every ordinary submit when routing is off (which is the production
baseline) — was never extended to write them. `persistRun`'s `insertPayload`
predates the columns and only carries `failure_reason`
(`persistenceWriter.ts:83-96`). The typed detail is computed
(`classifyArgumentCore.ts:273-274`) and logged
(`autoTriggerDispatcher.ts:385-386`) but dropped before the INSERT.

**Effect.** With routing baseline off, the production failure population is
*entirely* on the direct path, so 100% of production classifier-failure run
rows have NULL `failure_detail` / `failure_sub_reason` — exactly the 1,878-row
Phase-7 finding. The structured log line carries the data, but logs are not
queryable alongside the run row and roll off; the row is the durable record.

**Fix.** Thread the already-in-memory typed detail through `persistRun` and the
existing leak-safe builder so the direct-path failed row is self-describing,
matching what the drainer path already writes. No new data is collected; an
existing in-memory value stops being dropped.

---

## Why this is or is not a ceiling/limit

This is **not** a capacity / concurrency / provider-reliability ceiling, and it
does **not** re-litigate the superseded #371 (per-isolate cap) or #373
(Deno-KV limiter) work. Capacity is solved off-path by the ARCH-001 Postgres
async classifier queue (`docs/core/known-blockers.md:552,556`); #373 carries a
SUPERSEDED/REJECTED-ALTERNATIVE banner and was never built. This card touches
only the *diagnostic projection on an already-failed run row*. It adds no
provider call, no concurrency lever, no env flag. The "limit" it removes is an
**observability** gap (NULL diagnostic columns on the default failure path),
not a throughput or correctness ceiling. The deterministic acceptance gate
(`engine.ts`) is unchanged and remains the sole gate (invariant above).

---

## Architecture options considered

**Option A — Extend `persistRun` + thread from the failed branch + reuse
`buildRunRowFailureDetail` (CHOSEN).**
Add two optional fields to `PersistRunInput`; populate them in the failed
branch of `classifyOneArgumentCore` by calling the existing builder. Mirrors
the drainer's exact pattern; zero new modules; zero new allow-list surface;
byte-equal when the fields are omitted (success path, queue path).
*Trade-off:* touches three existing Edge files. Accepted — it is the minimal
diff that closes the gap and stays leak-safe by construction.

**Option B — Have the auto-trigger dispatcher UPDATE the run row after
`persistRun` returns.**
The dispatcher already holds the `PerArgumentSummary` with `runId`,
`failureSubReason`, `failureDetail` (`autoTriggerDispatcher.ts:378-386`), so it
could issue a follow-up `UPDATE … SET failure_detail = …, failure_sub_reason =
…`. *Rejected:* (1) `persistenceWriter` is documented append-only / INSERT-only
(`persistenceWriter.ts:21-22`, "never UPDATEs or DELETEs"); adding an UPDATE
breaks that invariant and the source-scan test that enforces it. (2) A second
round-trip per failed run adds a write the INSERT can carry in one statement.
(3) Idempotency: a retried failed write would need conflict handling. Option A
writes the values atomically in the single INSERT the row already gets.

**Option C — Route the direct path through the queue so the drainer writes the
columns.**
*Rejected:* that is an arming / routing change (flip
`CLASSIFIER_QUEUE_ROUTING_ENABLED` / raise the percentage), which the frozen
set and the never-self-approve rule forbid for this card, and is a far larger
behavior change than the observability gap warrants.

**Option D — Add a free-text `detail` blob to the projection so more context is
captured.**
*Rejected outright:* the builder's deny-list is **structural** by design — a
free-text field is exactly the entry point the allow-list exists to deny
(`classifierRunRowFailureDetail.ts:14-20`, `:53-58`). Doctrine §6.

---

## Chosen architecture

### 1. `persistenceWriter.ts` — additive optional fields

Extend `PersistRunInput` (`:35-50`) with two **optional** fields so existing
callers (the success path; any other caller) are unaffected:

```
export interface PersistRunInput {
  ...
  failureReason: string | null;
  // ADDITIVE (optional): direct-dispatch failed-branch diagnostics.
  // Omitted on the success path → column stays NULL (byte-equal).
  failureSubReason?: string | null;     // → failure_sub_reason (text)
  failureDetail?: Record<string, unknown> | null;  // → failure_detail (jsonb)
  startedAt: string;
  completedAt: string | null;
}
```

Extend `insertPayload` (`:83-96`) to write them **only when present**, so the
serialized INSERT for callers that omit them is unchanged:

```
const insertPayload = {
  ...,
  failure_reason: input.failureReason,
  ...(input.failureSubReason !== undefined
    ? { failure_sub_reason: input.failureSubReason }
    : {}),
  ...(input.failureDetail !== undefined
    ? { failure_detail: input.failureDetail }
    : {}),
  started_at: input.startedAt,
  completed_at: input.completedAt,
};
```

`failureDetail` carries the **already-sanitized** object returned by
`buildRunRowFailureDetail` (or `null` when the builder returned `undefined`).
The writer does no further sanitization — sanitization lives in the builder,
exactly as on the drainer path. The writer still never echoes the service-role
client and still returns sanitized error strings (`:104-118`, unchanged).

### 2. `classifyArgumentCore.ts` — thread from the failed branch

In the `adapterResult.kind === 'unavailable'` branch (`:245-260`), build the
projection from the in-memory adapter result and pass it to the existing
`persistRun` call (no new call site, no new branch):

```
import { buildRunRowFailureDetail } from './classifierRunRowFailureDetail.ts';

// inside the unavailable branch, before persistRun(...):
const failureDetail = buildRunRowFailureDetail({
  validatorPath: adapterResult.detail?.path,
  reason: failureReason,                       // controlled string already computed
  family: eligibleFamilies[0],                 // single-family auto-trigger run
  correlationId: undefined,                    // runId not known until after INSERT (see Open Q1)
  runMode: mode,
  schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
}) ?? null;

const runWrite = await persistRun({
  ...,
  status: 'failed',
  failureReason,
  failureSubReason: adapterResult.subReason ?? null,
  failureDetail,
  startedAt, completedAt,
});
```

The mapping reuses values **already computed in this branch**:
`failureReason` (the controlled `mcp_*` enum string from
`unavailableReasonToFailureReason`, `:163-182`), `adapterResult.subReason` /
`adapterResult.detail` (the same fields already threaded onto the return at
`:273-274`), `eligibleFamilies` (`:219`), `mode`, and the
`MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant already imported in this file
(`mcpBooleanObservationSchema.ts:36`). The success-path `persistRun` call
(`:284-297`) is **left byte-equal** — it omits the two new optional fields, so
the success row's `failure_detail` / `failure_sub_reason` stay NULL exactly as
the migration intends (`20260602000001_*.sql:109-110`).

### 3. No change to the dispatcher's log line

`autoTriggerDispatcher.ts:380-389` keeps emitting `failure_sub_reason` +
`failure_detail` to the structured log (operator convenience). The row now ALSO
carries them. The two are independent and consistent.

### Leak-safe attestation

- **Structural deny-list, not a filter.** The only path to the jsonb column is
  `buildRunRowFailureDetail`'s seven named inputs
  (`classifierRunRowFailureDetail.ts:53-75`). No `Authorization`, no request
  body, no prompt, no raw provider payload, no `evidenceSpan` text, no secret
  has an entry point. The same allow-list the drainer relies on.
- **Inputs we feed are all controlled:** `failureReason` is a fixed `mcp_*`
  enum (`:163-182`); `adapterResult.detail?.path` is the structural validator
  PATH string from a static allow-list (`booleanObservationFailureSubreason.ts:110`);
  `family` / `runMode` / `schemaVersion` are enum/constant strings;
  `failureSubReason` is the typed `BooleanObservationFailureSubreason` enum
  (`:53-74`). None is free text or user content.
- **Defense-in-depth still applies:** secret-shape drop + 200-char field cap +
  2000-char object cap run inside the builder regardless of caller
  (`:88-99`, `:114-118`, `:176-191`).
- **No secret logged / returned.** `persistRun` already returns only a
  sanitized `persistRun_failed:<code>` string and never the service-role client
  (`persistenceWriter.ts:104-118`); unchanged.
- **Doctrine §1 / §10a:** fields are transport / schema / structural strings
  only — no verdict, no truth value, no participant attribution. §6: the column
  remains a structurally-closed secret surface. §8: `persistRun` stays
  INSERT-only / append-only (`persistenceWriter.ts:21-22`); no UPDATE, no
  DELETE added.

### Idempotency unaffected

This card adds no new INSERT, no new branch, and no new RPC — it adds two
columns to the **single INSERT the failed run row already gets**. The per-family
idempotency pre-check and retry backoff in `dispatchOneFamilyIteration` are
untouched (`autoTriggerDispatcher.ts:479-499` comment: "each family is
processed exactly once"). A retried family that fails again writes a new run
row exactly as today, now with the same diagnostic columns. The
`UNIQUE (run_id, raw_key)` result-table constraint is irrelevant here (no
result rows on the failed path).

---

## Data model (if relevant)

No schema change. Columns already exist on `argument_machine_observation_runs`:

| Column | Type | Nullable | Origin |
|---|---|---|---|
| `failure_reason` | `text` | yes | written by both paths today |
| `failure_sub_reason` | `text` | yes | `20260528000021_arch_001_classifier_queue_substrate.sql` (queue substrate); written by drainer today, **direct path after this card** |
| `failure_detail` | `jsonb` | yes (default NULL, no backfill) | `20260602000001_ops_mcp_classifier_failure_detail.sql:113-114`; written by drainer today, **direct path after this card** |

`requiresMigration: false`. The migration that added `failure_detail` explicitly
notes success rows and pre-terminal rows stay NULL
(`20260602000001_*.sql:109-111`); this card preserves that — only the
terminal-failure direct-dispatch row gains the values.

---

## Worker/drainer model (if relevant)

Not applicable. This card does **not** touch the queue drainer
(`classifierDrainerCore.ts`), the enqueue path, `finalize_classifier_job`, the
lease model, or the pg_cron tick. The drainer already writes these columns and
is byte-equal after this card.

---

## Liveness and observability

- **Producer (this card):** the direct-dispatch failed run row now carries
  `failure_sub_reason` (text) + `failure_detail` (jsonb), queryable via ad-hoc
  ops SQL exactly like the drainer's rows: `failure_detail->>'reason'`,
  `failure_detail->>'validator_path'`, `failure_detail->>'family'`
  (`classifierRunRowFailureDetail.ts:40-41`).
- **Consumer (downstream, soft dependency):**
  `OPS-MCP-OBSERVABILITY-002` (#470) — "Classifier health panel (consumes
  `failure_detail`)" — is the named first reader
  (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:194`). Today the column
  is WRITE-ONLY (`classifierRunRowFailureDetail.ts:11-12`). This card makes the
  *direct-path* rows populated so #470 sees a complete failure population rather
  than only the drainer subset. #470 is **not** blocked by this card and is not
  in scope; it benefits from it.
- **Existing log line unchanged:** `autoTriggerDispatcher.ts:380-389` keeps
  emitting both fields; the row and the log now agree.

---

## Cutover and rollback path

- **Cutover:** standard merge = deploy. On merge to `main`, the Supabase GitHub
  integration auto-applies migrations (none here) and redeploys the Edge
  Functions that import `_shared/booleanObservations/**` (`submit-argument`
  redeploys because `persistenceWriter` / `classifyArgumentCore` are in its
  import graph). No env change, no operator flag flip required for the behavior
  to take effect.
- **Rollback:** revert the PR. The columns remain (additive migration is
  untouched); reverting the writer/core change simply stops the direct path
  writing them again — rows revert to NULL on those two columns, exactly the
  pre-card state. No data migration, no down-migration, no orphaned rows. The
  drainer path is unaffected either way.
- **Forward-compat:** because the two `PersistRunInput` fields are optional and
  the `insertPayload` spreads them only when present, an old caller (or a future
  caller that omits them) produces a byte-equal INSERT to today.

---

## Smoke plan

(Operator-run post-merge, GATE C. Design-only here.)

1. **Pre-deploy unit gates (CI):** `npm run typecheck`, `npm run lint`,
   `npm run test` all exit 0. New source-scan tests prove the writer + core
   wiring (see Test-count forecast).
2. **Direct-path failure smoke (dev):** with `CLASSIFIER_QUEUE_ROUTING_ENABLED`
   unset (baseline off → direct dispatch), submit an argument under conditions
   that force an adapter `unavailable` outcome (e.g. MCP URL/token deliberately
   misconfigured in dev). Confirm the resulting
   `argument_machine_observation_runs` row has `status='failed'`,
   `failure_reason` populated **and** `failure_detail` non-NULL with
   `reason` / `family` / `run_mode` / `schema_version` keys, and
   `failure_sub_reason` populated when the adapter set one.
3. **Success-path byte-equal check:** a successful classification still writes a
   row with `failure_detail` NULL and `failure_sub_reason` NULL (regression
   guard that the success branch is untouched).
4. **Leak-safety spot check:** confirm no `failure_detail` value contains a
   body excerpt, prompt fragment, `Authorization`, `Bearer`, `sk-ant-`,
   `sb_secret_`, or JWT-shaped string (the builder guarantees this
   structurally; spot-check is belt-and-suspenders).
5. **Drainer-path regression:** a queue-routed smoke
   (`[arch-001-queue-smoke]`, operator-armed) still writes `failure_detail` via
   the drainer exactly as before (unchanged path).
6. **Submit-not-blocked invariant:** confirm `submit-argument` still returns
   `201` on the user submit regardless of classifier outcome (the dispatch is
   fire-and-forget in the `EdgeRuntime.waitUntil` tail;
   `autoTriggerDispatcher.ts:417-424`).

---

## Open questions

1. **`correlation_id` source on the direct path.** On the drainer path
   `correlationId = job.id` (the run row's own uuid;
   `classifierRunRowFailureDetail.ts:67-68`). On the direct path the `runId` is
   not known until *after* the INSERT returns (`persistRun` generates it), so we
   cannot put it into the same INSERT's `failure_detail`. Options for the build
   phase: (a) leave `correlationId` undefined (the row's `id` IS the
   correlation key, redundantly storing it adds nothing); (b) use
   `argumentId` as the correlation id. **Recommendation: (a) omit it** — the
   row PK already correlates, and the builder gracefully drops an undefined
   field. Confirm at GATE A.
2. **`failure_sub_reason` type at the column.** The text column accepts any
   string; the in-memory value is the typed `BooleanObservationFailureSubreason`
   enum. Should the writer coerce/validate, or trust the typed source?
   **Recommendation: trust the typed source** (it is a closed union;
   `booleanObservationFailureSubreason.ts:53-74`) and pass through as text —
   matches the drainer, which writes the enum string directly. No new
   validation surface.
3. **Whether to also populate `failureSubReason` when only `failureReason` is
   present but `subReason` is unset** (e.g. `url_missing` / `token_missing`
   leave `subReason` unset per `classifyArgumentCore.ts:271-272`). In that case
   we write `failure_sub_reason = null` (no synthetic value) — confirm this is
   the intended behavior so triage can distinguish "no sub-reason emitted" from
   "sub-reason lost".

---

## Stage gates before implementation

Per pipeline-governance-contract §2 (Phase 0 → DESIGN → GATE A → IMPLEMENT →
GATE B → REVIEW → GATE C):

- **GATE A (operator, before IMPLEMENT):** approve this design; resolve Open
  Questions 1–3; confirm the frozen set stays untouched (no routing/ramp/H-I-J).
- **GATE B (operator, after IMPLEMENT):** `npm run typecheck` / `lint` / `test`
  green with captured exit code 0; reviewer re-runs the count.
- **GATE C (operator-only, REVIEW → merge):** because this is `supabase/
  functions/_shared/**`, **merge = deploy** (pipeline-governance-contract §5).
  `autoMergeEligible: false`. An operator merges; no self-merge. Never-self-
  approve (§4): the implementer/designer does not also approve the deploy.
- **Frozen-set attestation at every gate:** H/I/J `productionEnabled` stays
  `false`; routing ENABLED/PERCENTAGE untouched.

---

## Commit-slice plan

1. **Slice 1 — writer (`persistenceWriter.ts`):** add the two optional fields to
   `PersistRunInput` + the conditional spread in `insertPayload`. Update/extend
   the writer source-scan test
   (`__tests__/mcpOneTwoOneCEdgePersistenceWriter.test.ts`) to assert the two
   fields are present, optional, and that the writer is still INSERT-only.
2. **Slice 2 — core wiring (`classifyArgumentCore.ts`):** import
   `buildRunRowFailureDetail`; build the projection in the failed branch; pass
   `failureSubReason` + `failureDetail` into the failed-branch `persistRun`
   call; leave the success-path call byte-equal. Add a source-scan test for the
   failed-branch threading + success-path byte-equality.
3. **Slice 3 — docs/status:** update `docs/core/current-status.md` manifest
   (MODIFIED list, test delta, operator follow-up) and the CLAUDE.md stage line
   if the operator deems it stage-completing.

Each slice keeps `typecheck` / `lint` / `test` green.

---

## Test-count forecast

The two edited files are Deno-only (`persistenceWriter.ts` imports
`createServiceClient` which reads `Deno.env`; `classifyArgumentCore.ts` is the
Edge core) and cannot execute under Jest. The repo's established pattern for
these files is a **source-text scan** (e.g.
`mcpOneTwoOneCEdgePersistenceWriter.test.ts:1-35`,
`mcpOneTwoOneCAutoTriggerFailureMode.test.ts:1-45`). The builder itself
(`classifierRunRowFailureDetail.ts`) is pure TS and already has 22 runnable
tests (`__tests__/classifierRunRowFailureDetail.test.ts`); the drainer write
has 15 (`__tests__/classifierDrainerFailureDetailWrite.test.ts`).

Forecast for this card: **+10 to +16 tests**, in a new
`__tests__/opsMcpClassifierFailureDetailAutoTriggerFill.test.ts` (plus minimal
additions to the existing writer source-scan):

- Writer: `PersistRunInput` declares optional `failureSubReason` +
  `failureDetail`; `insertPayload` conditionally spreads `failure_sub_reason`
  + `failure_detail`; still no UPDATE/DELETE token; still imports
  `createServiceClient` (~5).
- Core: failed branch imports + calls `buildRunRowFailureDetail`; passes both
  fields into the failed-branch `persistRun`; success-path `persistRun` does
  **not** pass them (byte-equal); inputs fed to the builder are the controlled
  `failureReason` / `adapterResult.detail?.path` / `eligibleFamilies[0]` /
  `mode` / schema-version constant (no body/prompt token) (~6).
- Leak-safety / doctrine: the new test file's referenced inputs contain no
  free-text/body/payload entry point; ban-list scan of any new copy (~2–5).

Baseline (test-discipline skill): **630 suites / 19263 passing / 1 skipped /
19264 total** on `main`. The forecast keeps the count strictly increasing
(no `.skip` / `.only` introduced).

---

## HALT ceiling

STOP and surface to the operator (do not self-resolve) if, during IMPLEMENT,
any of the following is true:

- **H-1:** closing the gap appears to require widening
  `buildRunRowFailureDetail`'s allow-list, adding a free-text field, or feeding
  it any value derived from the argument body / prompt / raw provider response.
  (Doctrine §6 — the deny-list is structural; do not breach it.)
- **H-2:** the only way to write the columns turns out to require an UPDATE on
  the run row (breaking the INSERT-only invariant,
  `persistenceWriter.ts:21-22`) rather than carrying them in the existing
  INSERT.
- **H-3:** the change requires touching the routing predicate, the family
  registry, any `productionEnabled` flag, or any
  `CLASSIFIER_QUEUE_ROUTING_*` env (frozen set).
- **H-4:** the change requires a new migration (it must not — the columns
  exist).
- **H-5:** the success-path `persistRun` call cannot remain byte-equal.
- **H-6:** any new path could block, reject, route, or delay an ordinary user
  submit (acceptance-gate invariant breach).

---

## Current-status manifest stub

```
OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 — direct-dispatch failure_detail/failure_sub_reason fill

MODIFIED:
  supabase/functions/_shared/booleanObservations/persistenceWriter.ts
    (+2 optional PersistRunInput fields; conditional insertPayload spread)
  supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts
    (failed branch: build via buildRunRowFailureDetail + pass both fields to persistRun)

NEW:
  __tests__/opsMcpClassifierFailureDetailAutoTriggerFill.test.ts
    (source-scan: writer optional fields + core failed-branch threading + leak-safety)

BYTE-EQUAL preserved:
  classifierRunRowFailureDetail.ts (reused as-is; no allow-list change)
  classifierDrainerCore.ts + finalize_classifier_job (drainer path untouched)
  autoTriggerDispatcher.ts log line (still emits both fields)
  classifyArgumentCore.ts success-path persistRun call (omits the new fields)
  familyRegistry.ts (A–G true; H/I/J false — frozen set untouched)
  supabase/migrations/** (NO new migration; columns already exist)

TEST DELTAS:
  +10..+16 tests (new source-scan file + writer scan additions)
  baseline 630 suites / 19263 passing / 1 skipped / 19264 total → count strictly up

OPERATOR FOLLOW-UP:
  GATE C operator-only merge (merge = deploy; submit-argument redeploys).
  Resolve Open Q1 (correlation_id omit-vs-argumentId) + Q2/Q3 at GATE A.
  Soft dependency: OPS-MCP-OBSERVABILITY-002 (#470) reads the now-populated rows.

DISCIPLINE:
  Edge design under supabase/functions/_shared/**; merge=deploy → GATE C.
  Acceptance-gate invariant preserved (post-storage observability; never a gate).
  Frozen set untouched (H/I/J productionEnabled:false; routing baseline off).
  No migration. No routing/ramp change. INSERT-only/append-only preserved. No secret surfaced.
```

---

## Required-reading manifest for the later build phase

Read before implementing (all at HEAD `37ccd9e`):

1. `supabase/functions/_shared/booleanObservations/persistenceWriter.ts:35-50`
   (`PersistRunInput`), `:80-119` (`persistRun` + `insertPayload`) — the file
   to extend.
2. `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts:193-276`
   — `classifyOneArgumentCore`, the failed branch (`:245-275`) and the
   success branch (`:278-297`, keep byte-equal).
3. `supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts`
   (whole file) — the leak-safe builder + allow-list + caps to REUSE
   unchanged.
4. `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts:53-131`
   — `BooleanObservationFailureSubreason` enum + `BooleanObservationFailureDetail`
   shape (the in-memory source fields).
5. `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts:360-415`
   (log line, unchanged) and `:430-499` (dispatch entry, unchanged) — confirm
   the fire-and-forget submit-not-blocked invariant.
6. `supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql:100-126`
   — column definition + WHY-NULL semantics (no migration to write; confirm the
   column type/nullability).
7. `supabase/functions/_shared/booleanObservations/familyRegistry.ts:68-119`
   — frozen-set verification (A–G true; H/I/J false).
8. `__tests__/mcpOneTwoOneCEdgePersistenceWriter.test.ts` and
   `__tests__/classifierRunRowFailureDetail.test.ts` — the source-scan +
   builder test patterns to mirror.
9. `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md:24,46-57,107`
   — the motivating Phase-7 NULL finding + the fill-card follow-up note.
10. `docs/core/pipeline-governance-contract.md` §2/§4/§5 — stage machine,
    never-self-approve, merge=deploy.
```

---

## Implementer note: blocked — pre-existing test THR-4 pins the `failureSubReason:` occurrence count (operator adjudication required)

**Status: BLOCKED at GATE B.** The two SUT edits, the new test file, and the
current-status manifest are implemented exactly per the design + GATE-A answers,
and they are committed on `feat/ops-mcp-classifier-failure-detail-fill-001`
(2 feature commits + this note). `npm run typecheck` and `npm run lint` exit 0.
The new suite `__tests__/opsMcpClassifierFailureDetailAutoTriggerFill.test.ts`
passes (21/21). **One pre-existing test regresses and cannot be resolved inside
the HARD allowlist this card was given.**

### The conflict

`__tests__/mcpOneTwoOneCFailureSubreasonThreading.test.ts` **THR-4** asserts:

```
expect((coreText.match(/failureSubReason:/g) ?? []).length).toBe(1);
expect((coreText.match(/failureDetail:/g) ?? []).length).toBe(1);
```

with the stated rationale *"Exactly ONE return sets each new field — the
adapter-unavailable branch."* That test was written for
`OPS-MCP-RESULT-VALIDATION-BURST-HARDENING`, when `failureSubReason` /
`failureDetail` appeared ONLY on the `PerArgumentSummary` **return** value
(`classifyArgumentCore.ts:297-298`) and in **no** `persistRun` call.

This card's whole point is to ALSO write those two values into the
**failed-branch `persistRun` INSERT**. My change adds a second
`failureSubReason:` token (`failureSubReason: adapterResult.subReason ?? null`
in the failed-branch persistRun call), so THR-4's first assertion now sees
`2`, not `1`, and fails. (The `failureDetail:` assertion still passes — I pass
the built detail as the shorthand `failureDetail,`, not `failureDetail:`.)

Full-suite impact: exactly ONE regressed test (THR-4); everything else green.
Captured: `Test Suites: 1 failed, 637 passed, 638 total / Tests: 1 failed,
1 skipped, 19392 passed, 19394 total` (the new suite is the +1; the new tests
are the +21).

### Why I did not self-resolve

THR-4's file is **not in this card's HARD allowlist**
(`persistenceWriter.ts` + `classifyArgumentCore.ts` + ONE new test file +
`docs/core/current-status.md`). Editing it is an out-of-allowlist edit, which
the spawn prompt classifies as a HALT. The two in-allowlist "fixes" are both
unacceptable:

1. **Game the regex** — introduce `const failureSubReason = adapterResult.subReason ?? null;`
   and pass it by shorthand (`failureSubReason,`) so the colon-count stays `1`.
   Rejected: that keeps a now-FALSE test green (the field really IS set in two
   places) — dishonest test-passing, an explicit anti-pattern.
2. **Ship the red test.** Rejected — "Don't ship red tests."

This is also NOT one of the design's enumerated HALT triggers (H-1..H-6); it is
an unforeseen test-coupling the design did not anticipate. THR-4's *semantic
intent* ("success / persist / not-found summaries do NOT set these fields") is
still satisfied by my change — only its *occurrence-count implementation* is now
too strict.

### Recommended resolution (operator GATE-A addendum / one-line allowlist widen)

Authorize a minimal, intent-preserving update to THR-4 in
`__tests__/mcpOneTwoOneCFailureSubreasonThreading.test.ts`. The honest assertion
is "these fields are set ONLY within the unavailable branch (on its persistRun
call and its return), and the success / persist-failure / not-found returns do
NOT set them." Concretely, scope the count to the unavailable branch, e.g.:

```
const branch = coreText.slice(
  coreText.indexOf("adapterResult.kind === 'unavailable'"),
  coreText.indexOf('// Success path'),
);
// both new fields appear ONLY inside the unavailable branch
expect((branch.match(/failureSubReason/g) ?? []).length).toBeGreaterThanOrEqual(2); // persistRun + return
expect((branch.match(/failureDetail/g) ?? []).length).toBeGreaterThanOrEqual(2);
// and they appear NOWHERE in the success / not-found return tails
const afterSuccess = coreText.slice(coreText.indexOf('// Success path'));
expect(afterSuccess).not.toMatch(/failureSubReason|failureDetail/);
```

(Exact wording is the operator's call.) Once THR-4 is authorized for update —
either by adding that one file to the allowlist, or by the operator editing it
directly — the full suite goes green at `638 suites / 19393 passing / 1 skipped`
and the card is GATE-B ready. **No production behavior changes; the only thing
that moves is the stale occurrence-count assertion in one source-scan test.**

The two feature commits and the new test suite remain on the branch (they are
correct and complete); they are NOT reverted, because the implementation itself
is right — the blocker is purely the out-of-allowlist stale test.
