# MCP-021B Design Intent Brief — Persisted Machine Observation Classifier Results

**Card:** MCP-021B — Persisted Machine Observation Classifier Results (persistence + RLS + Source 6 adapter wiring; NO live MCP call; NO new taxonomy)
**Track:** MCP-021 sequence (MCP-021A taxonomy → MCP-021B persistence → MCP-021C live execution)
**Priority:** P0 / Urgent
**Effort:** M-L (migration + RLS + adapter + query + smoke harness)
**Filed:** 2026-05-26
**Author:** Operator-authored
**Status:** Binding for MCP-021B designer phase. Stage 2 HALT is CONDITIONAL per autonomous-pipeline authorization.
**Sequencing decision:** `docs/decisions/MCP-021-sequencing.md` — MCP-021B persistence before MCP-021C live execution
**Predecessor:** MCP-021A, PR #301, merged at `d6648b4`
**MCP-021A baseline:** 172 Machine Observation definitions across 10 families; schema version `mcp-021.machine-observations.boolean.v1`; Source 6 still returns `[]` byte-equal after MCP-021A.
**Test baseline:** 16,909 tests / 512 suites after MCP-021A.

---

## Why this brief exists

MCP-021A landed the maximal boolean Machine Observation taxonomy, definition registry, MCP response schema, and test scaffolding. It did not change runtime behavior. Source 6 still returns `[]` because there is no persisted classifier-output source and no live MCP execution path.

MCP-021B is the persistence card. It makes Machine Observation classifier results durable, reload-surviving, and shareable across authorized room participants. MCP-021B does not call MCP live. MCP-021C does that later.

The key runtime change in MCP-021B is explicit and binding:

`adaptRawClassifierBinarySource(...)` transitions from `[]` unconditionally to `[] OR valid persisted Machine Observation marks`.

The adapter still returns `[]` when there are no valid persisted rows. It never calls MCP. It never writes. It only consumes RLS-gated persisted rows and maps them through MCP-021A's registry and schema rules.

---

## Central product rule

Persisted Machine Observations must behave like durable node labels, not ephemeral local classifier hints.

They must:

1. Survive reload.
2. Be visible to authorized room participants.
3. Be hidden from unauthorized users by RLS.
4. Respect UX-001.5A display caps.
5. Preserve Machine Observation vs User Allegation provenance.
6. Discard malformed or unknown classifier output silently.
7. Never expose raw internal keys in user-facing copy.
8. Never imply truth, correctness, winner/loser, bad faith, fallacy, or verdict.

---

## Binding decisions

### Decision 1 — Persistence table shape: runs + results split

Two tables:

- `public.argument_machine_observation_runs` — one row per classifier run. Captures run status, schema version, requested families, provider/model metadata if available, input hash, start/completion timestamps, and failure/fallback state.
- `public.argument_machine_observation_results` — one row per positive observation only. Absence of a result row means "not present" or "not evaluated." MCP-021B does not persist 172 false rows per argument.

Rejected alternative: single observations table with `present boolean`. Reason: larger row volume, weaker failed-run diagnostics, noisier future MCP-021C transaction semantics.

### Decision 2 — Client read, service-role write

Authenticated clients may read rows they are authorized to see.

Authenticated clients may NOT insert, update, or delete classifier runs or result rows.

MCP-021C will write through a service-role Edge Function or equivalent server-side execution path. Service-role bypasses RLS. MCP-021B does not implement the live write path yet.

### Decision 3 — Source 6 runtime behavior changes in MCP-021B

MCP-021A preserved Source 6 byte-equal. MCP-021B is the FIRST card authorized to change Source 6 runtime behavior.

Before MCP-021B:

```
adaptRawClassifierBinarySource(input) // returns []
```

After MCP-021B:

```
adaptRawClassifierBinarySource(input) // returns [] OR valid persisted marks
```

The function must still return `[]` for:

- missing persisted rows
- empty persisted rows
- unknown `raw_key` not in `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY`
- wrong `schema_version` (anything other than the MCP-021A constant)
- invalid confidence
- confidence below per-surface threshold per `confidenceEligibility`
- wrong `argument_id` (defensive)
- malformed row shape
- `present=false` if any defensive row shape includes the flag

### Decision 4 — Display caps remain unchanged

MCP-021B must preserve UX-001.5A display caps verbatim:

- Timeline: 1 Machine Observation + 1 User Allegation + overflow
- Selected Context: 3 Machine Observations + 3 User Allegations + overflow
- Inspect: grouped and unbounded
- Composer: composer-only sensitive entries remain composer-only

MCP-021B must add a stress test with 100+ valid persisted observations for one argument proving the existing presentation model still caps Timeline and Selected Context correctly.

### Decision 5 — Schema version reuse

MCP-021B reuses MCP-021A's schema version constant:

`mcp-021.machine-observations.boolean.v1`

MCP-021B does not bump the version. Persisted rows with any other schema version are silently discarded by the adapter layer.

---

## Required persistence schema

Designer may adjust names only if Phase A finds an existing project convention requiring a different spelling. The conceptual shape is binding.

### Table: `public.argument_machine_observation_runs`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `debate_id uuid not null`
- `argument_id uuid not null`
- `schema_version text not null`
- `requested_families text[] not null default '{}'`
- `provider_key text`
- `model_name text`
- `input_hash text`
- `status text not null check (status in ('success', 'failed', 'fallback'))`
- `failure_reason text`
- `started_at timestamptz not null default now()`
- `completed_at timestamptz`
- `created_at timestamptz not null default now()`

Foreign keys:

- `debate_id` references `public.debates(id)` on delete cascade
- `argument_id` references `public.arguments(id)` on delete cascade

### Table: `public.argument_machine_observation_results`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `run_id uuid not null`
- `debate_id uuid not null`
- `argument_id uuid not null`
- `schema_version text not null`
- `raw_key text not null`
- `family text not null`
- `confidence text not null check (confidence in ('low', 'medium', 'high'))`
- `evidence_span text`
- `created_at timestamptz not null default now()`

Foreign keys:

- `run_id` references `public.argument_machine_observation_runs(id)` on delete cascade
- `debate_id` references `public.debates(id)` on delete cascade
- `argument_id` references `public.arguments(id)` on delete cascade

Uniqueness:

- unique `(run_id, raw_key)`

Indexes:

- runs: `(argument_id, schema_version, completed_at desc)`
- results: `(argument_id, schema_version, raw_key)`
- results: `(run_id)`

---

## Required RLS posture

RLS must be enabled on both tables.

### Read policy for runs

Target shape (designer verifies canonical visibility predicate during Phase A):

```
using (
  exists (
    select 1
    from public.arguments a
    join public.debates d on d.id = a.debate_id
    where a.id = argument_machine_observation_runs.argument_id
      and (
        d.visibility = 'public'
        or exists (
          select 1
          from public.debate_participants p
          where p.debate_id = d.id
            and p.user_id = auth.uid()
        )
      )
  )
)
```

If the project uses a different canonical visibility predicate, use the canonical predicate and document the difference in the design ledger.

### Read policy for results

Preferred shape:

```
using (
  exists (
    select 1
    from public.argument_machine_observation_runs r
    where r.id = argument_machine_observation_results.run_id
  )
)
```

Intended meaning: result visibility inherits from run visibility. If Postgres / Supabase RLS recursion behavior makes this unsafe or ambiguous, duplicate the run visibility predicate directly on results instead. Designer decides after Phase A and documents the decision in the design ledger.

### Write policies

No client-JWT insert/update/delete policies.

Required posture:

- No authenticated INSERT policy.
- No authenticated UPDATE policy.
- No authenticated DELETE policy.
- Service-role writes bypass RLS and are MCP-021C territory.

---

## Required production deliverables

1. Migration `supabase/migrations/<timestamp>_mcp_021b_machine_observation_results.sql` with OPS-001 four-class header walk:
   - Class 1: schema changes
   - Class 2: RLS
   - Class 3: indexes
   - Class 4: comments
   - Must NOT include `COMMENT ON ... storage.*`

2. New file `src/features/nodeLabels/machineObservationPersistenceTypes.ts`:
   - `MachineObservationRunRow` interface
   - `MachineObservationResultRow` interface
   - Pure-TS type guards
   - Confidence/schema/rawKey validators if useful

3. New file `src/features/nodeLabels/machineObservationPersistenceAdapter.ts`:
   - `mapPersistedObservationRowsToNodeLabelMarks(rows, surface)`
   - Applies schema version filter
   - Applies registry membership filter
   - Applies confidence floor
   - Truncates/bounds `evidence_span` to 240 chars
   - Returns `NodeLabelMark[]`

4. New file `src/features/nodeLabels/machineObservationPersistenceQuery.ts`:
   - Query helper to fetch persisted observations for argument IDs
   - No mutation helper
   - No service-role helper
   - Handles empty result and RLS-denied result gracefully

5. Bounded edit `src/features/nodeLabels/nodeLabelSourceAdapters.ts`:
   - Source 6 adapter changes only
   - Signature may be additive/backwards-compatible
   - Default no-data behavior must remain `[]`

6. Bounded edit `src/features/nodeLabels/index.ts`:
   - Export persistence helpers
   - Header comment updated to note MCP-021B's additions

7. Bounded integration edit (designer identifies canonical loader; likely `src/features/arguments/ArgumentGameSurface.tsx` or the room data loader):
   - Fetch persisted rows for visible argument IDs
   - Pass rows into existing node label source adapter path
   - Do not create new visual surface
   - Do not create new display cap
   - Do not alter User Allegation path

8. Handoff section appended to `docs/core/current-status.md` AFTER existing MCP-021A H2 section (do NOT modify existing sections).

---

## Required tests

Minimum 7 test files (aggregate-test pattern per MCP-021A precedent):

1. `__tests__/mcpOneTwoOneBPersistenceMigration.test.ts`
   - Migration file exists
   - Two tables created
   - Indexes created
   - RLS enabled
   - OPS-001 four-class header present
   - No `COMMENT ON ... storage.*`
   - No client write policy

2. `__tests__/mcpOneTwoOneBRlsPolicy.test.ts`
   - Read policy references argument/debate visibility
   - Result read policy inherits or duplicates run visibility
   - No authenticated insert/update/delete policy
   - Service-role not referenced in client source

3. `__tests__/mcpOneTwoOneBPersistedRowAdapter.test.ts`
   - Valid rows map to Machine Observation marks
   - Unknown raw_key discarded
   - Invalid schema_version discarded
   - Invalid confidence discarded
   - Confidence below surface threshold discarded
   - evidence_span bounded to 240 chars
   - Wrong argument id discarded

4. `__tests__/mcpOneTwoOneBSourceSixAdapter.test.ts`
   - No input returns []
   - Empty persisted rows return []
   - Valid persisted rows return marks
   - Malformed rows return []
   - Defensive 20-input random-input battery

5. `__tests__/mcpOneTwoOneBDisplayCapPreservation.test.ts`
   - 100+ persisted Machine Observations for one argument
   - Timeline remains 1+1+overflow
   - Selected Context remains 3+3+overflow
   - Inspect remains grouped and unbounded

6. `__tests__/mcpOneTwoOneBDoctrine.test.ts`
   - No raw_key user-facing render
   - No verdict tokens
   - No winner/loser/correctness/truth/fallacy/bad-faith language
   - Machine never rendered as User
   - User Allegation path unchanged

7. `__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts`
   - Zero diff over UX-001.5A presentation files
   - Zero diff over userAllegationRegistry
   - Zero diff over MCP-021A taxonomy files
   - Zero diff over MCP-021A schema file unless explicitly authorized
   - Zero diff over UX-001.6 test files
   - Zero diff over package.json/package-lock.json

Test count forecast: +120 to +220 tests. If forecast exceeds +500, HALT at design phase (Trigger 8).

---

## Strict out of scope (any item HALTS)

1. Live MCP call
2. New AI provider path
3. New taxonomy key
4. New visual primitive
5. New design token
6. Display cap change
7. User Allegation registry change
8. Manual tag path change
9. Auto metadata path change outside persisted classifier integration
10. Lifecycle path change outside persisted classifier integration
11. Client-JWT write policy for classifier result tables
12. Service-role usage in client code
13. Raw internal key rendered in UI
14. Verdict/winner/correctness/fallacy/bad-faith language
15. Any Edge Function implementation (MCP-021C territory)
16. Any package dependency
17. Any migration touching storage schema

---

## Read-only API boundaries

MCP-021B MAY modify (bounded):
- New: 3 persistence files + 1 migration + 7 tests + 1 handoff doc
- Bounded edits: `nodeLabelSourceAdapters.ts`, `nodeLabels/index.ts`, `ArgumentGameSurface.tsx` (or canonical loader; designer Phase A confirms)

MCP-021B MAY NOT modify:
- All UX-001.{1-7} read-only files outside bounded list
- All UX-001.5A presentation model, priority model, components
- `src/features/nodeLabels/userAllegationRegistry.ts`
- `src/features/nodeLabels/machineObservationRegistry.ts` (legacy)
- `src/features/nodeLabels/machineObservationDefinitions.ts` + per-family files
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts` (MCP-021A's wire contract)
- `src/features/nodeLabels/threadTopologyAutoMetadata.ts`
- All UX-001.6 cross-device QA test files (byte-equal)
- All MCP-021A test files (byte-equal)
- Any `supabase/migrations/` file other than the new MCP-021B migration
- Any existing Edge Function source

---

## Designer required reading (in order)

1. `docs/designs/MCP-021B-intent.md` (this brief)
2. `docs/decisions/MCP-021-sequencing.md`
3. `docs/designs/MCP-021A.md`
4. `src/features/nodeLabels/machineObservationDefinitions.ts`
5. `src/features/nodeLabels/mcpBooleanObservationSchema.ts`
6. `src/features/nodeLabels/nodeLabelSourceAdapters.ts`
7. `src/features/nodeLabels/nodeLabelPresentationModel.ts`
8. `src/features/nodeLabels/nodeLabelDescriptorAdapter.ts`
9. `docs/designs/UX-001.5A.md`
10. `docs/reviews/UX-001.5A-review.md`
11. Existing Supabase migrations with RLS over debates / arguments
12. Existing tests for OPS-001 migration header walk and RLS scans

---

## Designer deliverable

Create `docs/designs/MCP-021B.md` with required sections:

1. Scope-reality audit
2. Existing visibility predicate audit (canonical predicate identified)
3. Migration design
4. RLS policy design
5. Source 6 adapter design
6. Integration site design
7. Display cap preservation design
8. Test plan
9. Read-only boundary list
10. Conditional HALT trigger table (12 triggers + 3 designer-specific)
11. Brief ledger
12. MCP-021B → MCP-021C handoff

---

## Brief ledger requirement

MCP-021B's design document MUST include a ledger naming:

- Canonical visibility predicate verified against existing migrations
- Result-table RLS recursion decision (inherit via run vs duplicate predicate)
- Source 6 adapter signature change (additive parameter; backwards-compatible default)
- Integration point confirmation (which file wires the persistence query)
- OPS-001 four-class header walk applied to the migration
- Any operator-deferred review items
