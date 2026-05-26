# MCP-021B — Persisted Machine Observation Classifier Results

**Card:** MCP-021B
**Status:** Design draft (designer phase)
**Branch:** `feat/MCP-021B-persisted-machine-observation-classifier-results`
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/302
**Intent brief:** `docs/designs/MCP-021B-intent.md` at commit `2c95999` (operator-authored, binding)
**Sequencing decision:** `docs/decisions/MCP-021-sequencing.md` at commit `d2282af` (binding)
**Predecessor design:** `docs/designs/MCP-021A.md` at commit `d6648b4` (PR #301 merged; 172 entries shipped)
**Effort:** M-L (one migration + RLS + 3 new persistence files + 2 bounded edits + 7 tests)
**Track position:** MIDDLE card of 3-card MCP-021 chain (021A taxonomy → **021B persistence** → 021C live MCP execution)

This card is the FIRST card authorized to change Source 6 runtime behavior. The
change is bounded and additive: `adaptRawClassifierBinarySource(...)` transitions
from `[]` unconditionally to `[] OR valid persisted Machine Observation marks`.
The function continues to return `[]` for every existing caller that does not
pass persisted rows — the signature change is backwards-compatible. MCP-021B
does NOT call MCP, does NOT execute classifier work live, does NOT write
classifier rows from the client. MCP-021C is the live-execution card.

---

## §1 — Scope-reality audit

### 1.1 Source 6 baseline verification (binding)

Direct read of `src/features/nodeLabels/nodeLabelSourceAdapters.ts` at the
branch base commit `2c95999`, lines 306-310:

```typescript
export function adaptRawClassifierBinarySource(
  _input: RawClassifierBinaryAdapterInput,
): NodeLabelMark[] {
  return [];
}
```

The function body is `return [];` with no preceding `if`-branch. The `_input`
underscore prefix confirms the parameter is unused. The jsdoc (lines 288-305)
declares this is `future_source` v1 behavior per the UX-001.5A audit and per
MCP-021A precondition.

**MCP-021B binding contract:** the function signature changes additively (a
new optional second parameter), and the runtime behavior changes from "always
return `[]`" to "return `[]` OR valid persisted Machine Observation marks
derived from the optional persisted-rows parameter". Existing callers (the
convenience aggregator and the MCP-021A invariance test) continue to pass NO
persisted-rows input, and therefore continue to receive `[]`. The byte-equal
test contract is preserved.

### 1.2 MCP-021A 172-entry registry baseline verification

Direct read of `src/features/nodeLabels/machineObservationDefinitions.ts` at
`2c95999` confirms the parallel definitions registry exports
`MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` (compound key) and
`MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY` (rawKey-keyed, lifecycle-wins
priority). Each definition carries the 8 verbose MCP-021A fields including
`confidenceEligibility: { timelineMinConfidence, selectedContextMinConfidence,
inspectMinConfidence }` — these are the per-surface confidence floors that
MCP-021B's persistence adapter must enforce when mapping persisted rows into
`NodeLabelMark[]`.

The schema-version constant
`MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1'`
is exported from `src/features/nodeLabels/mcpBooleanObservationSchema.ts:36-37`.
MCP-021B reuses this constant verbatim. Persisted rows with any other
`schema_version` are silently discarded by the adapter — never echoed, never
logged.

### 1.3 UX-001.5A display caps remain unchanged

Direct read of `src/features/nodeLabels/nodeLabelPresentationModel.ts` confirms
`enforceTimelineNodeDisplayCap` (1 Observation + 1 Allegation + overflow),
`enforceSelectedContextDisplayCap` (3+3+overflow), and `enforceInspectGroupedView`
(unbounded grouped) are unchanged in MCP-021B. The persistence pipeline feeds
persisted rows through the EXISTING presentation pipeline; the caps absorb the
new input transparently.

### 1.4 Byte-equal preservation contract

MCP-021B preserves byte-equal:

- `src/features/nodeLabels/nodeLabelPresentationModel.ts` (display caps)
- `src/features/nodeLabels/nodeLabelPriorityModel.ts` (priority + tiebreak)
- `src/features/nodeLabels/nodeLabelDescriptorAdapter.ts` (mark → chip)
- `src/features/nodeLabels/NodeLabelStrip.tsx` and
  `src/features/nodeLabels/NodeLabelInspectGroups.tsx` (RN consumers)
- `src/features/nodeLabels/machineObservationDefinitions.ts` (172 definitions)
- `src/features/nodeLabels/machineObservationDefinitions/familyA-J.ts`
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts` (MCP-021A wire
  contract; schema version constant)
- `src/features/nodeLabels/userAllegationRegistry.ts` (10 User Allegations)
- `src/features/nodeLabels/machineObservationRegistry.ts` (65 legacy entries)
- `src/features/nodeLabels/threadTopologyAutoMetadata.ts` (stubs)
- All UX-001.6 cross-device QA test files (`__tests__/uxOneOneSix*.test.{ts,tsx}`)
- All MCP-021A test files (`__tests__/mcpOneTwoOneA*.test.ts`)
- All `package.json` / `package-lock.json`
- All existing Edge Functions and existing `supabase/migrations/` files

The implementer's reviewer will use `git diff main..HEAD` to assert byte-equal
on the read-only-file list.

**Conditional triggers 1, 2, 3, 4, 5, 10 CLEAN at scope-reality boundary**
(no live MCP, no AI provider, no taxonomy key, no visual primitive, no display
cap change, no read-only-file mutation outside the bounded list).

---

## §2 — Existing visibility predicate audit (Phase A.1)

Read all RLS-bearing migrations in `supabase/migrations/`. Result:

### 2.1 Canonical visibility predicate for `public.arguments` (QOL-039)

File: `supabase/migrations/20260524000015_qol_039_room_visibility.sql`,
lines 236-252, verbatim:

```sql
CREATE POLICY "arguments: select own, participant-private, or posted-public"
ON public.arguments
FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR is_moderator_or_admin()
  OR (
    status = 'posted'
    AND (
      -- public room: any authenticated user
      public.is_debate_open_or_locked_public(debate_id)
      -- private room: participants only
      OR public.is_debate_participant(debate_id, auth.uid())
    )
  )
);
```

### 2.2 Canonical READ predicate for child tables of `public.arguments` (META-1A precedent)

File: `supabase/migrations/20260517000009_meta_1a_point_tags.sql`, lines 88-98,
verbatim:

```sql
drop policy if exists pt_select_read_access on public.point_tags;
create policy pt_select_read_access
  on public.point_tags
  for select
  using (
    exists (
      select 1 from public.arguments a
      where a.id = argument_id
    )
  );
```

The header comment (lines 25-30) makes the doctrine explicit: "SELECT: anyone
who can read the argument can read its tags." The single-table EXISTS into
`public.arguments` DELEGATES the visibility check to the `arguments` SELECT
policy. Postgres applies the `arguments` SELECT policy when the subquery runs,
so a non-participant of a private room cannot see the `point_tags` row because
the underlying argument row is invisible to them.

### 2.3 SECURITY DEFINER helpers (recursion-safe pattern)

File: `supabase/migrations/20260516000006_fix_debates_rls_recursion.sql`,
lines 36-89, and `qol_039_room_visibility.sql` lines 130-177 define:

- `public.is_debate_participant(p_debate_id uuid, p_user_id uuid DEFAULT auth.uid())` — RETURNS boolean, SECURITY DEFINER, STABLE
- `public.is_debate_open_or_locked(p_debate_id uuid)` — RETURNS boolean, SECURITY DEFINER, STABLE
- `public.is_debate_open_or_locked_public(p_debate_id uuid)` — RETURNS boolean, SECURITY DEFINER, STABLE
- `public.is_debate_private(p_debate_id uuid)` — RETURNS boolean, SECURITY DEFINER, STABLE
- `public.is_moderator_or_admin()` — RETURNS boolean (existing helper)

All four are `EXECUTE`-granted to `authenticated` and `REVOKE`d from `PUBLIC`.

### 2.4 Brief target vs canonical alignment

The intent brief's target shape (lines 184-202) used:

```sql
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

This shape is MATERIALLY DIFFERENT from the canonical pattern:

1. The brief's shape **JOINS into `public.debates` directly**, which would
   re-trigger the recursion problem QOL-039 specifically uses SECURITY DEFINER
   helpers to avoid. The recursion fix introduced
   `is_debate_open_or_locked_public(debate_id)` exactly to gate room visibility
   without joining `debates` from a subquery.
2. The brief's shape **JOINS into `public.debate_participants` directly**,
   which would trigger the second recursion path (`debates ↔ debate_participants`)
   that migration 20260516000006 specifically broke. The canonical helper is
   `is_debate_participant(debate_id, auth.uid())`.
3. The brief's shape **omits `is_moderator_or_admin()` and `author_id` arms**
   that the canonical `arguments` SELECT policy includes. Without these arms,
   moderator/admin review of persisted observations would be blocked.
4. The brief's shape **omits the `status = 'posted'` arm** that gates
   soft-deleted (`is_deleted = true`) arguments. Persisted observation rows on
   a soft-deleted argument should not be exposed.

### 2.5 Canonical predicate chosen for MCP-021B

**Decision: USE META-1A's DELEGATION PATTERN** (single-table EXISTS into
`public.arguments`). Rationale:

1. **Recursion-safe** — the META-1A pattern delegates to the existing
   `arguments` SELECT policy, which already uses SECURITY DEFINER helpers
   internally. MCP-021B's policy does NOT re-introduce raw subqueries into
   `debates` or `debate_participants`.
2. **Inherits the full canonical arm set** — moderator/admin, author, posted-public,
   participant-private, and (implicitly) soft-delete gating via `arguments`
   SELECT.
3. **Cheaper plan** — one EXISTS, one subquery, no joins.
4. **Forward-stable** — any future tightening of `arguments` SELECT automatically
   tightens MCP-021B's observation visibility without a migration.

The intent brief explicitly authorizes this divergence (intent brief §"Required
RLS posture" → "Read policy for runs" → line 204): "If the project uses a
different canonical visibility predicate, use the canonical predicate and
document the difference in the design ledger." This design ledger §11.1 records
the divergence and rationale. **Conditional trigger 15 (Phase A reconciliation
surfaces materially different predicate): NOT FIRED — divergence anticipated
by brief.**

**Conditional trigger 12 (canonical visibility predicate identified): CLEAN.**

---

## §3 — Migration design

New migration file: `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`.

The numeric prefix `20260526000018` continues the sequential numbering scheme;
the suffix increments after `20260525000017_pr_004_deprecate_avatar_pipeline.sql`.

### 3.1 OPS-001 four-class header walk

The migration's header (top-of-file SQL comment block) explicitly enumerates
the four heightened-review issue classes and the migration's posture per
class. This is mandatory per `.claude/agents/roadmap-reviewer.md` lines 112-117
and per OPS-001 reviewer template strengthening (`docs/designs/OPS-001.md`).

The header text MUST contain a "Class N — <pattern>: <posture>" line for each
of Classes 1-4, like the QOL-039 migration header at lines 57-78 of that file.

Verbatim header skeleton (the implementer writes the body):

```sql
-- ============================================================
-- Migration: 20260526000018_mcp_021b_machine_observation_results
-- Description: MCP-021B — Persisted Machine Observation classifier
--   results (runs + results tables, read-only client RLS).
--
-- Card: MCP-021B (intent brief docs/designs/MCP-021B-intent.md;
--                 design docs/designs/MCP-021B.md)
-- Predecessor: MCP-021A (172-entry registry; schema version
--              mcp-021.machine-observations.boolean.v1 baked in
--              src/features/nodeLabels/mcpBooleanObservationSchema.ts:36)
--
-- Doctrine:
--   - Persisted Machine Observations are structural facts about moves;
--     never verdicts, never truth labels. (cdiscourse-doctrine §1, §10a)
--   - Engagement / popularity / heat are NEVER inputs. (cdiscourse-doctrine §3)
--   - Service-role is the ONLY write path; the client never inserts,
--     updates, or deletes classifier rows. (Decision 2 of intent brief)
--   - Soft-delete semantics inherit from public.arguments cascade.
--
-- Statement order (OPS-001 §4 Class 3 — implicit ordering dependencies):
--   1. CREATE TABLE public.argument_machine_observation_runs
--   2. CREATE TABLE public.argument_machine_observation_results
--   3. CREATE INDEX (×3 — runs + results + results-by-run)
--   4. ALTER TABLE … ENABLE ROW LEVEL SECURITY (×2)
--   5. CREATE POLICY (×1 on runs — SELECT only)
--   6. CREATE POLICY (×1 on results — SELECT only)
--   7. COMMENT ON TABLE / COMMENT ON COLUMN (no storage.* targets)
--
-- OPS-001 §4 four-class posture:
--   Class 1 — Ambiguous column references in subqueries: all RLS
--     subqueries fully-qualify column names against the policy-target
--     table (e.g. argument_machine_observation_runs.argument_id, NOT
--     bare argument_id). Defensive even where no ambiguity exists today,
--     to prevent a future maintainer's join from regressing.
--   Class 2 — Column type mismatches: every foreign key references the
--     same column type as declared on the referenced table (uuid against
--     uuid). debate_id and argument_id are both uuid; run_id is uuid.
--     Confidence is text with CHECK against the 3-value enum.
--   Class 3 — Implicit ordering dependencies: runs CREATE TABLE precedes
--     results CREATE TABLE (results.run_id FK references runs.id);
--     CREATE INDEX statements follow their CREATE TABLE; ENABLE ROW
--     LEVEL SECURITY precedes every CREATE POLICY on each table.
--   Class 4 — Function / trigger / extension dependencies: gen_random_uuid()
--     requires pgcrypto (enabled by every prior migration in this repo,
--     verified at QOL-039 header lines 19-30; same posture here). RLS
--     subqueries delegate to public.arguments SELECT, whose policy was
--     created by 20260524000015_qol_039_room_visibility.sql (applied).
--     NO `COMMENT ON … storage.*` statements anywhere in this migration
--     (PR-003 SQLSTATE 42501 boundary preserved).
--
-- No client INSERT / UPDATE / DELETE policy for either table.
-- MCP-021C will write through a service-role Edge Function; service-role
-- bypasses RLS. This migration ships ZERO server-side write path.
-- ============================================================
```

### 3.2 Table `public.argument_machine_observation_runs`

```sql
CREATE TABLE IF NOT EXISTS public.argument_machine_observation_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id           uuid        NOT NULL
                                    REFERENCES public.debates(id)   ON DELETE CASCADE,
  argument_id         uuid        NOT NULL
                                    REFERENCES public.arguments(id) ON DELETE CASCADE,
  schema_version      text        NOT NULL,
  requested_families  text[]      NOT NULL DEFAULT '{}',
  provider_key        text,
  model_name          text,
  input_hash          text,
  status              text        NOT NULL
                                    CHECK (status IN ('success', 'failed', 'fallback')),
  failure_reason      text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

Column rationale:
- `id` — primary key; cascade target for `results.run_id`.
- `debate_id` and `argument_id` — duplicated on each row so RLS subqueries
  can match by a single column without an additional join. Both cascade on
  delete from their respective parents.
- `schema_version` — stored verbatim so adapter can filter on equality with
  `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`. Rows with any other version are
  silently discarded by the adapter.
- `requested_families` — pg `text[]` so MCP-021C can record exactly which
  families the run targeted. MCP-021B does not write this; it only reads it.
- `provider_key`, `model_name`, `input_hash` — operator-audit metadata. All
  nullable so MCP-021C can be selective about what it records.
- `status` — 3-value enum via CHECK constraint. `success` = run completed and
  produced results; `failed` = run terminated without producing results;
  `fallback` = run hit an MCP-021C fallback path (timeout, parse failure).
- `failure_reason` — operator-readable; nullable; MCP-021C populates it for
  `failed` / `fallback` rows.
- `started_at`, `completed_at`, `created_at` — three timestamps because run
  lifecycle is "started" → "completed" with optional retry. `created_at` is
  the row insert; `started_at` is the classifier-run start; `completed_at`
  is the classifier-run end (nullable while a run is in-flight).

### 3.3 Table `public.argument_machine_observation_results`

```sql
CREATE TABLE IF NOT EXISTS public.argument_machine_observation_results (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid        NOT NULL
                                REFERENCES public.argument_machine_observation_runs(id)
                                ON DELETE CASCADE,
  debate_id       uuid        NOT NULL
                                REFERENCES public.debates(id)   ON DELETE CASCADE,
  argument_id     uuid        NOT NULL
                                REFERENCES public.arguments(id) ON DELETE CASCADE,
  schema_version  text        NOT NULL,
  raw_key         text        NOT NULL,
  family          text        NOT NULL,
  confidence      text        NOT NULL
                                CHECK (confidence IN ('low', 'medium', 'high')),
  evidence_span   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT amor_unique_run_rawkey UNIQUE (run_id, raw_key)
);
```

Column rationale:
- One row PER POSITIVE OBSERVATION. Absence of a result row = "not present"
  or "not evaluated"; run status disambiguates.
- `run_id` cascades from `runs`; deleting a run drops its positive results.
- `debate_id` and `argument_id` duplicated for RLS subquery cheapness, same
  pattern as runs.
- `schema_version` stored per-row so adapter can filter independently of run.
- `raw_key` — one of the 172 MCP-021A definition rawKeys. Stored verbatim.
  Adapter validates against `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`
  membership and drops unknown rawKeys silently (never echoes raw codes).
- `family` — Family A–J code (`parent_relation`, `disagreement_axis`, etc.).
  Stored for operator-audit + future per-family filtering; adapter does not
  require it to match (the rawKey-to-family mapping is in MCP-021A registry).
- `confidence` — 3-value enum. Adapter applies per-surface threshold via
  `MachineObservationDefinition.confidenceEligibility`.
- `evidence_span` — optional text excerpt. Adapter truncates to 240 chars at
  read time (defensive, even if MCP-021C truncates at write time).
- `CONSTRAINT amor_unique_run_rawkey UNIQUE (run_id, raw_key)` — one
  positive observation per (run, rawKey). Prevents MCP-021C from
  accidentally writing duplicates within a single run.

### 3.4 Indexes

```sql
-- runs: lookup by argument + version, most recent first.
CREATE INDEX IF NOT EXISTS amor_runs_argument_version_completed_idx
  ON public.argument_machine_observation_runs
     (argument_id, schema_version, completed_at DESC NULLS LAST);

-- results: lookup by argument + version + rawKey (adapter happy path).
CREATE INDEX IF NOT EXISTS amor_results_argument_version_rawkey_idx
  ON public.argument_machine_observation_results
     (argument_id, schema_version, raw_key);

-- results: lookup by run (cascade-aware queries).
CREATE INDEX IF NOT EXISTS amor_results_run_idx
  ON public.argument_machine_observation_results (run_id);
```

The argument+version+raw_key index supports the adapter's happy-path query
(fetch all positive observations for one argument at the current schema
version). The runs.argument+version+completed_at index supports MCP-021C's
"most-recent successful run per argument" query. The results.run_id index
supports cascade-aware operator queries.

### 3.5 COMMENT statements

```sql
COMMENT ON TABLE public.argument_machine_observation_runs IS
  'MCP-021B: per-classifier-run audit row for Machine Observation classifier '
  'work on a single argument. Status enum records success / failed / fallback. '
  'Service-role WRITE only (MCP-021C); client SELECT only.';

COMMENT ON TABLE public.argument_machine_observation_results IS
  'MCP-021B: per-positive-observation row. Absence of a row for a (run, rawKey) '
  'means the classifier did not observe that rawKey on the move. The adapter '
  'src/features/nodeLabels/machineObservationPersistenceAdapter.ts validates '
  'schema_version, rawKey-registry membership, confidence floor, and truncates '
  'evidence_span to 240 chars at read time.';

COMMENT ON COLUMN public.argument_machine_observation_results.raw_key IS
  'One of the 172 MCP-021A MachineObservationDefinition rawKeys. Unknown rawKeys '
  'are silently dropped by the adapter — never echoed in UI, never logged.';

COMMENT ON COLUMN public.argument_machine_observation_results.confidence IS
  'One of low / medium / high. The adapter applies per-surface threshold via '
  'MachineObservationDefinition.confidenceEligibility before emitting a '
  'NodeLabelMark for any surface.';
```

**Zero `COMMENT ON … storage.*` statements.** The migration touches only the
two new tables in the public schema. PR-003 SQLSTATE 42501 boundary is
preserved. **Conditional trigger 7 (storage.* comment): CLEAN.**

### 3.6 Migration line-count estimate

| Section | Lines |
|---|---:|
| OPS-001 four-class header block | ~75 |
| CREATE TABLE runs + comment | ~25 |
| CREATE TABLE results + comment | ~25 |
| CREATE INDEX (×3) | ~10 |
| ALTER TABLE ENABLE RLS (×2) | ~5 |
| CREATE POLICY (×2) | ~30 |
| COMMENT ON TABLE (×2) + COMMENT ON COLUMN (×2) | ~25 |
| **Total** | **~195** |

---

## §4 — RLS policy design

### 4.1 Read policy for `argument_machine_observation_runs`

```sql
ALTER TABLE public.argument_machine_observation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amor_runs_select_via_argument
  ON public.argument_machine_observation_runs;

CREATE POLICY amor_runs_select_via_argument
  ON public.argument_machine_observation_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.arguments a
      WHERE a.id = argument_machine_observation_runs.argument_id
    )
  );
```

**Rationale:** delegates to the canonical `arguments: select own, participant-private,
or posted-public` policy (QOL-039). The `EXISTS` subquery succeeds only when
the calling user can see the underlying argument row, which inherits the full
arm set (author / moderator-admin / posted-public / participant-private). No
direct join into `debates` or `debate_participants` — recursion-safe.

The `argument_machine_observation_runs.argument_id` qualifier is fully
qualified to the policy-target table (NOT bare `argument_id`) per OPS-001 §4
Class 1. This is defensive — there is no ambiguity today, but if a future
maintainer adds a join inside the subquery, the qualification prevents the
QOL-041 SQLSTATE 42702 class of failure.

### 4.2 Read policy for `argument_machine_observation_results`

**Phase A.4 decision:** inherit-via-run, NOT duplicate-predicate. See §4.3.

```sql
ALTER TABLE public.argument_machine_observation_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amor_results_select_via_run
  ON public.argument_machine_observation_results;

CREATE POLICY amor_results_select_via_run
  ON public.argument_machine_observation_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.argument_machine_observation_runs r
      WHERE r.id = argument_machine_observation_results.run_id
    )
  );
```

The inner `EXISTS` triggers the `amor_runs_select_via_argument` policy on
`argument_machine_observation_runs`, which in turn triggers the
`arguments: select own, participant-private, or posted-public` policy on
`public.arguments`. The chain is one level deeper than META-1A's `pt_select_read_access`
but follows the same delegation pattern and remains recursion-free because each
hop is a single-table EXISTS into a table whose own SELECT policy resolves
without a cycle.

The `argument_machine_observation_results.run_id` qualifier is fully qualified
to the policy-target table per OPS-001 §4 Class 1 defensive discipline.

### 4.3 Phase A.4 — RLS recursion safety verification

**Decision: inherit-via-run.**

The brief's intent was to inherit visibility from runs through results via the
subquery in §4.2. Postgres RLS recursion concerns arise when policies on
table A query into table B whose policy queries back into table A. The
proposed chain is:

```
results SELECT policy → EXISTS into runs → runs SELECT policy → EXISTS into arguments → arguments SELECT policy → SECURITY DEFINER helpers
```

No table is visited twice in the chain. The SECURITY DEFINER helpers
(`is_debate_open_or_locked_public`, `is_debate_participant`,
`is_moderator_or_admin`) bypass RLS when they query `debates` /
`debate_participants` / role tables. The chain terminates at the SECURITY
DEFINER call. This is the same shape META-1A's `pt_select_read_access` uses
(one EXISTS hop) extended by one additional hop; both shapes are recursion-safe
because each hop targets a distinct table.

**Operator-deferred review item §11.2:** if MCP-021C's smoke surfaces unusual
plan cost or unexpected RLS denial on the results read path, the operator may
instruct a follow-up migration to switch results to the duplicate-predicate
shape (apply the canonical `public.arguments` EXISTS directly to results).
This design ships the inherit-via-run shape as the cheaper plan; the
duplicate-predicate shape is the fallback if the chained plan misbehaves
under load.

### 4.4 Write policies — explicit "no client write" posture

```sql
-- NO client INSERT / UPDATE / DELETE policy for either table.
-- MCP-021C writes via a service-role Edge Function; service-role bypasses RLS.
-- This migration ships ZERO client write path.
```

Explicitly enumerated as comments in the migration body for reviewer
visibility. No `CREATE POLICY … FOR INSERT` / `… FOR UPDATE` / `… FOR DELETE`
statements anywhere in the file. **Conditional trigger 6 (client-JWT
INSERT/UPDATE/DELETE policy): CLEAN.**

The reviewer's mechanical check is:

```bash
grep -E "CREATE POLICY .* FOR (INSERT|UPDATE|DELETE)" supabase/migrations/20260526000018_*.sql
# Must return zero matches.
```

---

## §5 — Source 6 adapter design

### 5.1 New file: `src/features/nodeLabels/machineObservationPersistenceTypes.ts`

Pure-TS. No React. No Supabase. No network. JSON-serializable. Frozen exports.

```typescript
/**
 * MCP-021B — Persistence row types and pure-TS type guards.
 *
 * Mirrors the SQL schema in
 * supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql.
 * Adapter functions in machineObservationPersistenceAdapter.ts validate
 * runtime row shapes against these types; query helpers in
 * machineObservationPersistenceQuery.ts map raw Supabase rows into these
 * shapes.
 *
 * Doctrine: pure types only. The type guards never make claims about a
 * person or assign a verdict to a claim. They only validate row shape.
 */

import { ALL_MACHINE_OBSERVATION_FAMILIES } from './nodeLabelTypes';
import type { MachineObservationFamily } from './nodeLabelTypes';

export type MachineObservationRunStatus = 'success' | 'failed' | 'fallback';
export type MachineObservationConfidence = 'low' | 'medium' | 'high';

export interface MachineObservationRunRow {
  id: string;
  debateId: string;
  argumentId: string;
  schemaVersion: string;
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  providerKey: string | null;
  modelName: string | null;
  inputHash: string | null;
  status: MachineObservationRunStatus;
  failureReason: string | null;
  startedAt: string;     // ISO-8601
  completedAt: string | null; // ISO-8601
  createdAt: string;     // ISO-8601
}

export interface MachineObservationResultRow {
  id: string;
  runId: string;
  debateId: string;
  argumentId: string;
  schemaVersion: string;
  rawKey: string;
  family: MachineObservationFamily | string; // adapter validates against ALL_MACHINE_OBSERVATION_FAMILIES
  confidence: MachineObservationConfidence;
  evidenceSpan: string | null;
  createdAt: string;     // ISO-8601
}

export function isMachineObservationConfidence(
  value: unknown,
): value is MachineObservationConfidence {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function isMachineObservationRunStatus(
  value: unknown,
): value is MachineObservationRunStatus {
  return value === 'success' || value === 'failed' || value === 'fallback';
}

export function isMachineObservationFamily(
  value: unknown,
): value is MachineObservationFamily {
  if (typeof value !== 'string') return false;
  return (ALL_MACHINE_OBSERVATION_FAMILIES as ReadonlyArray<string>).includes(value);
}

/**
 * Validate a candidate result row shape. Pure. Returns true only if every
 * field is present and well-typed; returns false otherwise. Never throws.
 */
export function isWellFormedResultRow(
  candidate: unknown,
): candidate is MachineObservationResultRow {
  // Inline shape checks (no third-party validator dependency).
  // Implementation: typeof checks against every required field.
}

/** Sibling validator for run rows. */
export function isWellFormedRunRow(
  candidate: unknown,
): candidate is MachineObservationRunRow {
  // Inline shape checks.
}
```

Line-count estimate: ~120 LOC.

### 5.2 New file: `src/features/nodeLabels/machineObservationPersistenceAdapter.ts`

Pure-TS. No React. No Supabase. No network. The pure transformer between
persisted rows and `NodeLabelMark[]`.

```typescript
/**
 * MCP-021B — Map persisted Machine Observation rows into NodeLabelMark[].
 *
 * Pure TS. The adapter is the bridge between the persistence layer and
 * UX-001.5A's existing presentation pipeline. It applies four filters in
 * order:
 *
 *   1. schema_version === MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION
 *   2. rawKey ∈ MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY
 *   3. confidence ≥ confidenceEligibility[<surface>MinConfidence]
 *   4. evidence_span truncated to ≤240 chars (defensive)
 *
 * Every dropped row is dropped SILENTLY — never echoed, never logged.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §9 — no raw internal codes in user-facing copy
 *     (the adapter never returns a raw_key as a label; only as a NodeLabelMark
 *     whose label/shortLabel/description are sourced from the MCP-021A
 *     definition registry's plain-language fields).
 *   - cdiscourse-doctrine §10a — Observations remain Observations
 *     (`kind: 'machine_observation'`; never user_allegation).
 *
 * Pure JSON-serializable. No React / Supabase / network imports.
 */

import {
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  type MachineObservationDefinition,
  type NodeLabelMark,
} from '.';
import type {
  MachineObservationResultRow,
} from './machineObservationPersistenceTypes';
import { isWellFormedResultRow, isMachineObservationConfidence } from './machineObservationPersistenceTypes';

const MAX_EVIDENCE_SPAN_CHARS = 240;

const CONFIDENCE_RANK: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export type MachineObservationSurface =
  | 'timeline_node'
  | 'selected_context'
  | 'inspect';

function meetsConfidenceFloor(
  confidence: 'low' | 'medium' | 'high',
  eligibility: MachineObservationDefinition['confidenceEligibility'],
  surface: MachineObservationSurface,
): boolean {
  const required =
    surface === 'timeline_node' ? eligibility.timelineMinConfidence
    : surface === 'selected_context' ? eligibility.selectedContextMinConfidence
    : eligibility.inspectMinConfidence;
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[required];
}

function truncate(span: string): string {
  if (span.length <= MAX_EVIDENCE_SPAN_CHARS) return span;
  return `${span.slice(0, MAX_EVIDENCE_SPAN_CHARS - 1)}…`;
}

/**
 * Map persisted Machine Observation rows into NodeLabelMark[] for the
 * requested surface. Pure. Returns [] when:
 *   - rows is null / undefined / empty / non-array
 *   - argumentId is missing
 *   - no row passes the four-filter chain
 *
 * Dropped per row (silently):
 *   - row shape malformed (`isWellFormedResultRow` returns false)
 *   - row.argumentId !== argumentId (defensive — caller passed wrong scope)
 *   - row.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION
 *   - row.rawKey not in MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY
 *   - row.confidence below per-surface threshold for the registry entry
 *   - row.confidence not in ('low' | 'medium' | 'high')
 *
 * Truncated:
 *   - evidence_span > 240 chars → adapter truncates to 239 + '…'
 *
 * The returned NodeLabelMark[] has every mark's
 *   - kind: 'machine_observation'
 *   - source: definition.source (preserves the registry's auto / lifecycle /
 *     ai_classifier / semantic_referee / composition_mutation provenance)
 *   - confidence: row.confidence (carried on the mark for downstream chrome)
 *   - label/shortLabel/description/disposition/defaultSurface/priority:
 *     spread from the MCP-021A definition (NEVER from the raw row)
 *   - id: `machine_observation:persisted:${row.id}:${argumentId}` (stable
 *     React diffing key)
 */
export function mapPersistedObservationRowsToNodeLabelMarks(
  rows: ReadonlyArray<unknown> | null | undefined,
  options: {
    argumentId: string;
    surface: MachineObservationSurface;
  },
): NodeLabelMark[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (typeof options?.argumentId !== 'string' || options.argumentId.length === 0) {
    return [];
  }
  const out: NodeLabelMark[] = [];
  for (const candidate of rows) {
    if (!isWellFormedResultRow(candidate)) continue;
    const row = candidate;
    if (row.argumentId !== options.argumentId) continue;
    if (row.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) continue;
    if (!isMachineObservationConfidence(row.confidence)) continue;
    const definition = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[row.rawKey];
    if (!definition) continue;
    if (!meetsConfidenceFloor(row.confidence, definition.confidenceEligibility, options.surface)) {
      continue;
    }
    out.push({
      ...definition,
      id: `machine_observation:persisted:${row.id}:${options.argumentId}`,
      confidence: row.confidence,
      // evidence_span is carried for inspect chrome only; presentation pipeline
      // does not read it today. Truncation is defensive in case a future
      // chrome consumer reads it directly.
      ...(row.evidenceSpan != null && row.evidenceSpan.length > 0
        ? { evidenceSpan: truncate(row.evidenceSpan) }
        : {}),
    } as NodeLabelMark);
  }
  return out;
}
```

Line-count estimate: ~180 LOC.

### 5.3 New file: `src/features/nodeLabels/machineObservationPersistenceQuery.ts`

Supabase-touching, but read-only SELECT against `argument_machine_observation_results`.
Pattern matches `fetchPointTagsForArguments` in `argumentsApi.ts` lines 281-295.

```typescript
/**
 * MCP-021B — Read-only fetcher for persisted Machine Observation result rows.
 *
 * Mirrors the META-1A precedent (`fetchPointTagsForArguments` in
 * src/features/arguments/argumentsApi.ts:281-295): a typed Supabase SELECT
 * with the shared authed client, no service-role, no mutation helper.
 *
 * RLS gates visibility — the caller's auth.uid() must satisfy the
 * amor_results_select_via_run policy (inherits from runs → arguments).
 * Non-participants of a private room receive zero rows. Unauthenticated
 * callers receive zero rows.
 *
 * Errors are returned as `{ ok: false, error }`; callers degrade gracefully
 * (the adapter returns [] downstream).
 */

import { supabase } from '../../lib/supabase';
import type { MachineObservationResultRow } from './machineObservationPersistenceTypes';

export type FetchPersistedObservationsResult =
  | { ok: true; data: MachineObservationResultRow[] }
  | { ok: false; error: string };

const SUPABASE_CONFIGURED = /* same env-gate pattern as argumentsApi.ts */;

interface RawPersistedRow {
  id: string;
  run_id: string;
  debate_id: string;
  argument_id: string;
  schema_version: string;
  raw_key: string;
  family: string;
  confidence: string;
  evidence_span: string | null;
  created_at: string;
}

function mapRawRow(raw: RawPersistedRow): MachineObservationResultRow {
  return {
    id: raw.id,
    runId: raw.run_id,
    debateId: raw.debate_id,
    argumentId: raw.argument_id,
    schemaVersion: raw.schema_version,
    rawKey: raw.raw_key,
    family: raw.family,
    confidence: raw.confidence as 'low' | 'medium' | 'high',
    evidenceSpan: raw.evidence_span,
    createdAt: raw.created_at,
  };
}

/**
 * Fetch ACTIVE persisted Machine Observation result rows for the given
 * argument ids in one batched query.
 *
 *   - Read-only SELECT; documented exception to the "Edge Function is the
 *     only write path" rule (same pattern as fetchPointTagsForArguments).
 *   - Uses the shared authed supabase client (no service-role).
 *   - RLS gates visibility via the amor_results_select_via_run policy.
 *   - Empty argumentIds short-circuits with { ok: true, data: [] }.
 *   - Hard cap of 1000 ids matches the gallery loader's PostgREST .in() budget.
 *   - SUPABASE_CONFIGURED false → { ok: true, data: [] } (offline-safe).
 *
 * NO write helpers exported from this file. NO service-role import.
 */
export async function fetchPersistedObservationsForArguments(
  argumentIds: ReadonlyArray<string>,
): Promise<FetchPersistedObservationsResult> {
  if (!SUPABASE_CONFIGURED) return { ok: true, data: [] };
  if (argumentIds.length === 0) return { ok: true, data: [] };
  const ids = argumentIds.slice(0, 1000);
  const { data, error } = await supabase
    .from('argument_machine_observation_results')
    .select(
      'id,run_id,debate_id,argument_id,schema_version,raw_key,family,confidence,evidence_span,created_at',
    )
    .in('argument_id', ids);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: ((data ?? []) as RawPersistedRow[]).map(mapRawRow) };
}
```

Line-count estimate: ~110 LOC.

### 5.4 Source 6 adapter — additive signature change

Bounded edit to `src/features/nodeLabels/nodeLabelSourceAdapters.ts`:

**Before (lines 282-310):**

```typescript
export interface RawClassifierBinaryAdapterInput {
  messageId: string;
  binaries?: ReadonlyArray<unknown>;
}

export function adaptRawClassifierBinarySource(
  _input: RawClassifierBinaryAdapterInput,
): NodeLabelMark[] {
  return [];
}
```

**After (additive — backwards-compatible):**

```typescript
export interface RawClassifierBinaryAdapterInput {
  messageId: string;
  /** Reserved for future_source consumption; pre-MCP-021B callers ignored. */
  binaries?: ReadonlyArray<unknown>;
  /**
   * MCP-021B — Persisted Machine Observation result rows for THIS message,
   * pre-fetched by the room loader. When absent OR empty, the adapter
   * returns [] (byte-equal pre-MCP-021B behavior). When supplied with
   * valid rows, the adapter delegates to
   * mapPersistedObservationRowsToNodeLabelMarks. The pipeline never calls
   * MCP live; MCP-021C wires the live execution path separately.
   */
  persistedClassifierRows?: ReadonlyArray<unknown>;
  /**
   * MCP-021B — Target surface for confidence-floor gating. Defaults to
   * 'timeline_node' for safety (highest confidence floor; least
   * surface noise). Inspect path can request 'inspect' to permit
   * lower-confidence rows.
   */
  surface?: 'timeline_node' | 'selected_context' | 'inspect';
}

export function adaptRawClassifierBinarySource(
  input: RawClassifierBinaryAdapterInput,
): NodeLabelMark[] {
  if (!input || typeof input.messageId !== 'string' || input.messageId.length === 0) {
    return [];
  }
  const persisted = input.persistedClassifierRows;
  if (!Array.isArray(persisted) || persisted.length === 0) {
    return [];
  }
  return mapPersistedObservationRowsToNodeLabelMarks(persisted, {
    argumentId: input.messageId,
    surface: input.surface ?? 'timeline_node',
  });
}
```

**Backwards-compatibility verification (Phase A.2):**

| Existing caller | Pre-MCP-021B input shape | Post-MCP-021B behavior |
|---|---|---|
| `adaptAllSourcesForNode` (line 362) | `{ messageId: input.messageId }` (no `persistedClassifierRows`) | `persisted === undefined` → returns `[]` (byte-equal) |
| `__tests__/mcpOneTwoOneASourceSixInvariance.test.ts` | `{ messageId: 'any' }` / `{ messageId: '', binaries: [] }` / etc. (no `persistedClassifierRows`) | All 8 test cases continue to receive `[]` (byte-equal) |

The MCP-021A invariance test file remains BYTE-EQUAL. The new behavior is
opt-in: only callers that supply `persistedClassifierRows` see the new path.

**Conditional trigger 11 (Source 6 adapter signature changes break existing
UX-001.5A consumers): CLEAN.**

### 5.5 Aggregator update — additive

Bounded edit to `adaptAllSourcesForNode` (same file, lines 334-366). Add two
optional inputs and a surface parameter to enable persisted-row pass-through.

**Before (line 334-365):**

```typescript
export function adaptAllSourcesForNode(input: {
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  clusterState: PointLifecycleState;
  messageContribution: PointLifecycleState | null;
  messageId: string;
}): PerNodeMarkInput {
  return {
    manualTagMarks: adaptManualTagSource(...),
    autoMetadataMarks: adaptAutoMetadataSource(...),
    lifecycleMarks: adaptLifecycleSource(...),
    compositionMutationMarks: adaptCompositionMutationSource({ messageId: input.messageId }),
    semanticRefereeNodeMountMarks: adaptSemanticRefereeSourceNodeMount({ messageId: input.messageId }),
    rawClassifierMarks: adaptRawClassifierBinarySource({ messageId: input.messageId }),
  };
}
```

**After (additive):**

```typescript
export function adaptAllSourcesForNode(input: {
  manualTagEntries: ReadonlyArray<ManualTagEntry>;
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  clusterState: PointLifecycleState;
  messageContribution: PointLifecycleState | null;
  messageId: string;
  /** MCP-021B — Persisted Machine Observation rows for this message.
   *  Pre-MCP-021B callers may omit. */
  persistedClassifierRows?: ReadonlyArray<unknown>;
  /** MCP-021B — Surface gate for the raw-classifier adapter. Defaults to
   *  'timeline_node'. */
  surface?: 'timeline_node' | 'selected_context' | 'inspect';
}): PerNodeMarkInput {
  return {
    manualTagMarks: adaptManualTagSource(...),    // unchanged
    autoMetadataMarks: adaptAutoMetadataSource(...),  // unchanged
    lifecycleMarks: adaptLifecycleSource(...),    // unchanged
    compositionMutationMarks: adaptCompositionMutationSource({ messageId: input.messageId }),
    semanticRefereeNodeMountMarks: adaptSemanticRefereeSourceNodeMount({ messageId: input.messageId }),
    rawClassifierMarks: adaptRawClassifierBinarySource({
      messageId: input.messageId,
      persistedClassifierRows: input.persistedClassifierRows,
      surface: input.surface,
    }),
  };
}
```

Existing `NodeLabelStrip` and `NodeLabelInspectGroups` callers that do NOT
pass `persistedClassifierRows` get `[]` for `rawClassifierMarks` — byte-equal
behavior. **No change to either component is required for the persistence
adapter to be a no-op; the components become live-aware only when their
upstream `ArgumentGameSurface.tsx` host starts threading the persisted rows
through.**

---

## §6 — Integration site design (Phase A.3)

### 6.1 Integration site identified

**File:** `src/features/arguments/ArgumentGameSurface.tsx`

**Existing wiring (lines 1377-1393, 1606-1620):** the component already mounts
`NodeLabelStrip` (Timeline-node consumer) and `NodeLabelInspectGroups`
(Inspect-popout consumer) per UX-001.5A. Each component receives
`manualTagEntries`, `autoMetadataCodes`, `clusterState`, `messageContribution`,
and `messageId` as props.

**Data-flow upstream:** the room data loader is
`src/features/arguments/useArgumentRoomMessages.ts`. It:

1. Calls `listArgumentsForDebate(debateId, limit)` (line 165) → `messages`.
2. Calls `fetchArgumentRelations(ids)` (line 176) → tags / flags / checks /
   pointTags.
3. Returns `pointTagsByArgumentId: Record<string, PersistedPointTag[]>` (line 228).

`ArgumentTreeScreen.tsx` consumes the hook and passes `pointTagsByArgumentId`
into `ArgumentGameSurface` as a prop (line 502).

### 6.2 MCP-021B integration plan

**Bounded edit 1 — `src/features/arguments/argumentsApi.ts`:** extend
`fetchArgumentRelations` (lines 219-258) to ALSO fetch persisted observation
rows in the existing `Promise.all` batch.

```typescript
// ADDED to the Promise.all array (line 247):
supabase
  .from('argument_machine_observation_results')
  .select('id,run_id,debate_id,argument_id,schema_version,raw_key,family,confidence,evidence_span,created_at')
  .in('argument_id', argumentIds),
```

The return shape (`ArgumentRelations`) gains a new field:

```typescript
export interface ArgumentRelations {
  tags: ArgumentTag[];
  flags: ArgumentFlag[];
  checks: TopicSatisfactionCheck[];
  pointTags: PersistedPointTag[];
  // MCP-021B: Persisted Machine Observation result rows. Empty when MCP-021C
  // has not yet run on the room, or when the caller is unauthorized to read.
  persistedObservations: MachineObservationResultRow[];
}
```

This single-batched-query approach mirrors the META-1A precedent and
introduces ONE additional network round-trip's worth of work (parallel within
the existing Promise.all, so wall-clock impact is bounded by the slowest of
the four queries already in the batch).

**Bounded edit 2 — `src/features/arguments/useArgumentRoomMessages.ts`:**
group the fetched rows by `argumentId` into a new
`persistedObservationsByArgumentId: Record<string, MachineObservationResultRow[]>`
and expose it on the hook return shape. Mirror the existing
`pointTagsByArgumentId` accumulator pattern (lines 192-194).

**Bounded edit 3 — `src/features/arguments/ArgumentTreeScreen.tsx`:**
destructure `persistedObservationsByArgumentId` from the hook (alongside
existing fields at line 316) and pass it through to `<ArgumentGameSurface … />`
(alongside existing props at line 502).

**Bounded edit 4 — `src/features/arguments/ArgumentGameSurface.tsx`:**

- Add `persistedObservationsByArgumentId?: Record<string, MachineObservationResultRow[]>`
  prop (mirror the existing `pointTagsByArgumentId` shape at line 166).
- At the existing `<NodeLabelStrip …>` mount (line 1385): add
  `persistedClassifierRows={persistedObservationsByArgumentId?.[activeMessageId] ?? []}`.
- At the existing `<NodeLabelInspectGroups …>` mount (line 1613): add the same
  prop pass-through.

**Bounded edit 5 — `src/features/nodeLabels/NodeLabelStrip.tsx`:** accept a
new optional prop `persistedClassifierRows?: ReadonlyArray<unknown>` and
forward it into the existing `adaptAllSourcesForNode` call (line 92). The
component's `computeNodeLabelStripDescriptors` helper gains the same optional
parameter for direct test usage. Same change to `NodeLabelInspectGroups.tsx`
(line 91).

The strip's surface argument to the persistence adapter is `'timeline_node'`
(byte-equal to the existing `filterMarksBySurface(combined, 'timeline_node')`
at line 100). The inspect-groups surface is `'inspect'`.

### 6.3 Why no new visual surface

The persisted observations land in `PerNodeMarkInput.rawClassifierMarks`,
which is already part of the convenience aggregator and the
`combinePerNodeMarks` order at line 71. The existing display caps
(`enforceTimelineNodeDisplayCap`, `enforceSelectedContextDisplayCap`,
`enforceInspectGroupedView`) absorb the new rows transparently. No new
chrome, no new design token, no new component. **Conditional trigger 4 (new
visual primitive): CLEAN.**

### 6.4 Composer-only path untouched

The composer-only `RefereeBannerView.observationChips` path
(`adaptSemanticRefereeSourceComposer` + `toAnnotationChipDescriptors`)
remains a SEPARATE wire from the persistence path. MCP-021B persists
classifier output for the Timeline / Selected / Inspect surfaces only;
composer-only Observations (`shifts_to_person_or_intent`,
`contains_unplayable_insult_only`, `needs_pre_send_pause`) remain ephemeral
per UX-001.5A Decision 2.

---

## §7 — Display cap preservation design

### 7.1 Stress test approach

The new test file `__tests__/mcpOneTwoOneBDisplayCapPreservation.test.ts`
synthesizes a single argument with **100+ valid persisted Machine Observation
rows** (mix of high / medium / low confidence; mix of `parent_relation`,
`evidence_source_chain`, `resolution_progress`, etc.).

The test then asserts:

| Surface | Pre-MCP-021A | MCP-021B (100+ persisted rows) | Cap test |
|---|---|---|---|
| Timeline node | 1 Observation + 1 Allegation + overflow | 1 Observation + 1 Allegation + overflow | `enforceTimelineNodeDisplayCap(deduped).observation` is non-null; `.allegation` is null (no user allegations in fixture); `.overflowCount === filtered.length - 1` |
| Selected context | 3 Observations + 3 Allegations + overflow | 3 Observations + 3 Allegations + overflow | `enforceSelectedContextDisplayCap(deduped).observations.length === 3`; `.allegations.length === 0`; `.overflowCount === filtered.length - 3` |
| Inspect | Unbounded grouped | Unbounded grouped | `enforceInspectGroupedView(deduped).observations.length === filtered.length` (no cap) |

The fixture passes through the FULL pipeline: persistence adapter →
`adaptAllSourcesForNode` (new wire) → `combinePerNodeMarks` → `filterMarksBySurface` →
`dedupePerNodeMarks` → display-cap function. This catches accidental cap
breakage at any step.

### 7.2 Confidence floor stress

The 100+ fixture includes:

- 30 rows at `confidence: 'high'`
- 40 rows at `confidence: 'medium'`
- 30 rows at `confidence: 'low'`

The test verifies that at `surface: 'timeline_node'`, low-confidence rows for
high-floor families (e.g. `argument_scheme`, `critical_question` whose
`timelineMinConfidence` is `'high'`) are SILENTLY DROPPED. The pre-cap row
count drops accordingly; the post-cap Timeline still surfaces 1 Observation
+ 1 Allegation + overflow.

### 7.3 Composer-only safety

The fixture includes a row with `raw_key: 'shifts_to_person_or_intent'` (a
sensitive composer-only entry from Family J). The test asserts this row
NEVER appears in the Timeline, Selected, or Inspect output — the existing
`filterMarksBySurface` correctly drops `composer_only` disposition entries
from all three target surfaces (already enforced by
`nodeLabelPresentationModel.ts` lines 158-183). MCP-021B does not weaken
this gate.

### 7.4 User Allegation parity

A separate fixture includes 10 persisted Machine Observation rows plus 10
User Allegation rows (via `manualTagEntries`). The test verifies:

- Timeline: 1 Observation + 1 Allegation + 18 overflow.
- Selected: 3 Observations + 3 Allegations + 14 overflow.
- Inspect: 10 + 10 grouped, unbounded.

The doctrine boundary holds: Machine and User are never collapsed (per
`dedupePerNodeMarks` rule at line 88-91).

---

## §8 — Test plan

Seven new test files, aggregate-test pattern per MCP-021A precedent. Total
test forecast: **+140 to +200** (well within the +500 Trigger 8 ceiling).

### 8.1 `__tests__/mcpOneTwoOneBPersistenceMigration.test.ts` (forecast: ~22 tests)

Pure-text scan of `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`.

- **MIG-1** The migration file exists.
- **MIG-2** Header contains `OPS-001 §4 four-class posture:` block.
- **MIG-3** Header explicitly names each of Class 1, Class 2, Class 3, Class 4.
- **MIG-4** `CREATE TABLE public.argument_machine_observation_runs` is present.
- **MIG-5** Runs table has every required column (`id`, `debate_id`,
  `argument_id`, `schema_version`, `requested_families`, `provider_key`,
  `model_name`, `input_hash`, `status`, `failure_reason`, `started_at`,
  `completed_at`, `created_at`).
- **MIG-6** Runs `status` has CHECK constraint with `success`, `failed`, `fallback`.
- **MIG-7** Runs has FK to `public.debates(id)` ON DELETE CASCADE.
- **MIG-8** Runs has FK to `public.arguments(id)` ON DELETE CASCADE.
- **MIG-9** `CREATE TABLE public.argument_machine_observation_results` is present.
- **MIG-10** Results table has every required column.
- **MIG-11** Results `confidence` has CHECK constraint with `low`, `medium`, `high`.
- **MIG-12** Results has FK to runs ON DELETE CASCADE.
- **MIG-13** Results has FK to debates / arguments ON DELETE CASCADE.
- **MIG-14** Results has UNIQUE `(run_id, raw_key)` constraint.
- **MIG-15** Three CREATE INDEX statements present (`amor_runs_argument_version_completed_idx`,
  `amor_results_argument_version_rawkey_idx`, `amor_results_run_idx`).
- **MIG-16** `ALTER TABLE … ENABLE ROW LEVEL SECURITY` for both tables.
- **MIG-17** ZERO `CREATE POLICY … FOR INSERT` statements.
- **MIG-18** ZERO `CREATE POLICY … FOR UPDATE` statements.
- **MIG-19** ZERO `CREATE POLICY … FOR DELETE` statements.
- **MIG-20** ZERO `COMMENT ON … storage.*` statements.
- **MIG-21** CREATE INDEX statements appear AFTER their CREATE TABLE.
- **MIG-22** ENABLE ROW LEVEL SECURITY appears BEFORE every CREATE POLICY on the same table.

### 8.2 `__tests__/mcpOneTwoOneBRlsPolicy.test.ts` (forecast: ~14 tests)

Pure-text scan of the migration's RLS policy text.

- **RLS-1** `CREATE POLICY amor_runs_select_via_argument` present.
- **RLS-2** Runs SELECT policy text contains `EXISTS` subquery into `public.arguments`.
- **RLS-3** Runs SELECT subquery uses fully-qualified `argument_machine_observation_runs.argument_id` (NOT bare `argument_id`).
- **RLS-4** Runs SELECT policy text does NOT contain a direct join into `public.debates`.
- **RLS-5** Runs SELECT policy text does NOT contain a direct join into `public.debate_participants`.
- **RLS-6** `CREATE POLICY amor_results_select_via_run` present.
- **RLS-7** Results SELECT policy text contains `EXISTS` subquery into `public.argument_machine_observation_runs`.
- **RLS-8** Results SELECT subquery uses fully-qualified `argument_machine_observation_results.run_id`.
- **RLS-9** No `CREATE POLICY` for INSERT / UPDATE / DELETE on either table.
- **RLS-10** Runs policy applies to `TO authenticated` (not `TO PUBLIC`, not anon).
- **RLS-11** Results policy applies to `TO authenticated`.
- **RLS-12** Client source code scan: `grep -r 'SERVICE_ROLE\|service_role' src/` returns zero matches in MCP-021B's new files.
- **RLS-13** Client source code scan: no MCP-021B file imports any service-role client.
- **RLS-14** New file `machineObservationPersistenceQuery.ts` exports ONLY read helpers (no `apply…`, no `submit…`, no `insert…` exports).

### 8.3 `__tests__/mcpOneTwoOneBPersistedRowAdapter.test.ts` (forecast: ~28 tests)

Pure-TS tests of `mapPersistedObservationRowsToNodeLabelMarks`.

- **ADP-1** Valid row → produces 1 NodeLabelMark with `kind === 'machine_observation'`.
- **ADP-2** Valid row → mark.source preserves definition's source (not the literal `'ai_classifier'`).
- **ADP-3** Valid row → mark.label === definition.label (plain language).
- **ADP-4** Valid row → mark.shortLabel === definition.shortLabel.
- **ADP-5** Valid row → mark.id starts with `'machine_observation:persisted:'`.
- **ADP-6** Valid row → mark.confidence === row.confidence.
- **ADP-7** Unknown raw_key → row dropped silently (output [], no throw).
- **ADP-8** Wrong schema_version → row dropped silently.
- **ADP-9** Empty schema_version → row dropped silently.
- **ADP-10** Confidence below floor for surface 'timeline_node' → row dropped.
- **ADP-11** Confidence below floor for surface 'inspect' → row passes (lower floor).
- **ADP-12** Confidence band 'invalid' → row dropped silently.
- **ADP-13** Wrong argument_id (defensive) → row dropped silently.
- **ADP-14** Malformed row shape (missing rawKey) → row dropped silently.
- **ADP-15** Malformed row shape (rawKey === null) → row dropped silently.
- **ADP-16** Malformed row shape (entire row === null) → row dropped silently.
- **ADP-17** Malformed row shape (entire row === undefined) → row dropped silently.
- **ADP-18** evidence_span > 240 chars → truncated to 239 chars + '…'.
- **ADP-19** evidence_span === 240 chars → preserved verbatim.
- **ADP-20** evidence_span === null → not present on mark.
- **ADP-21** evidence_span === empty string → not present on mark.
- **ADP-22** rows === [] → returns [].
- **ADP-23** rows === null → returns [].
- **ADP-24** rows === undefined → returns [].
- **ADP-25** options.argumentId === '' → returns [].
- **ADP-26** options.argumentId === undefined → returns [].
- **ADP-27** Two rows: one valid + one invalid → returns 1 mark (only valid).
- **ADP-28** Defensive 20-input random-input battery → never throws; output array length ≤ input array length.

### 8.4 `__tests__/mcpOneTwoOneBSourceSixAdapter.test.ts` (forecast: ~22 tests)

Pure-TS tests of the updated `adaptRawClassifierBinarySource`.

- **S6-1** No persistedClassifierRows → returns [] (byte-equal pre-MCP-021B).
- **S6-2** Empty persistedClassifierRows → returns [].
- **S6-3** Valid persistedClassifierRows + missing messageId → returns [].
- **S6-4** Valid persistedClassifierRows + valid messageId → returns marks.
- **S6-5** Single valid row → returns array of 1 mark.
- **S6-6** Two valid rows → returns array of 2 marks (in input order).
- **S6-7** Mixed valid + invalid → returns only valid marks.
- **S6-8** All invalid → returns [].
- **S6-9** Defensive: persistedClassifierRows === null → returns [].
- **S6-10** Defensive: persistedClassifierRows === { not: 'array' } → returns [].
- **S6-11** Surface defaults to 'timeline_node' (verified by confidence-floor behavior).
- **S6-12** Surface 'inspect' admits lower-confidence rows.
- **S6-13** Surface 'selected_context' applies the correct floor.
- **S6-14-S6-21** 8 random-input cases asserting `[]` for the 20-input battery from MCP-021A invariance test PLUS persisted rows — the pre-MCP-021B inputs still return `[]`, and the persisted-input cases return marks per spec.
- **S6-22** `adaptAllSourcesForNode` with `persistedClassifierRows` passes through to `rawClassifierMarks`.

### 8.5 `__tests__/mcpOneTwoOneBDisplayCapPreservation.test.ts` (forecast: ~26 tests)

End-to-end tests: persisted rows → adapter → presentation pipeline → display caps.

- **CAP-1** 100 persisted observations on one argument → Timeline cap returns 1 Observation + 0 Allegation + 99 overflow.
- **CAP-2** Same 100 + 10 user allegations → Timeline returns 1 Observation + 1 Allegation + 108 overflow.
- **CAP-3** Same 100 + 10 allegations → Selected returns 3 + 3 + 104 overflow.
- **CAP-4** Same 100 + 10 allegations → Inspect returns 100 + 10 (no cap).
- **CAP-5** All 100 rows at 'low' confidence → Timeline filters by per-surface floor; high-floor families produce zero on Timeline.
- **CAP-6** 100 rows at 'high' confidence → Timeline cap still 1 + 1 + 98 overflow (cap independent of confidence).
- **CAP-7** Composer-only row in input → dropped on Timeline.
- **CAP-8** Composer-only row in input → dropped on Selected.
- **CAP-9** Composer-only row in input → dropped on Inspect (composer_only disposition).
- **CAP-10** Future_source row in input (defensive) → dropped on all 3 surfaces.
- **CAP-11** Cross-source dedupe: persisted + auto_metadata with same rawKey → presentation pipeline dedupes (existing behavior).
- **CAP-12** Cross-kind preservation: persisted Observation + manual Allegation with same label text → both kept (existing behavior).
- **CAP-13** Priority ordering: high-priority rawKey beats low-priority rawKey when only one slot is available on Timeline.
- **CAP-14** Priority ordering: same priority → alphabetical tiebreak.
- **CAP-15** Empty persisted + empty allegations → Timeline cap returns null + null + 0.
- **CAP-16** Empty persisted + 1 allegation → Timeline returns null Observation + 1 Allegation + 0 overflow.
- **CAP-17** 1 persisted + empty allegations → Timeline returns 1 Observation + null Allegation + 0 overflow.
- **CAP-18-22** Five additional stress fixtures (1000 rows, all same family, all same confidence, etc.) → cap invariants hold.
- **CAP-23** Doctrine: every visible chip's label is from the registry (no raw_key strings echoed).
- **CAP-24** Doctrine: every visible chip's source is one of `auto_metadata | lifecycle | ai_classifier | semantic_referee | composition_mutation | manual_tag`.
- **CAP-25** Confidence-floor matrix: 'low' / 'medium' / 'high' × 3 surfaces × 3 representative families.
- **CAP-26** Persistence rows for `composer_only` disposition → adapter returns the marks (with disposition preserved), but the presentation filter `filterMarksBySurface` drops them. End-to-end output is empty.

### 8.6 `__tests__/mcpOneTwoOneBDoctrine.test.ts` (forecast: ~24 tests)

Doctrine / ban-list scans across the new code surface and the migration text.

- **DOC-1** No new file echoes a raw_key as a user-facing string (label / description / shortLabel must be derived from registry).
- **DOC-2** Ban-list scan over `machineObservationPersistenceAdapter.ts` source: no `winner`, `loser`, `liar`, `truth`, `correct`, `wrong`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `fallacy`, `fallacious`.
- **DOC-3** Same ban-list scan over `machineObservationPersistenceQuery.ts`.
- **DOC-4** Same ban-list scan over `machineObservationPersistenceTypes.ts`.
- **DOC-5** Same ban-list scan over the migration SQL text.
- **DOC-6** Adapter never emits a mark with `kind === 'user_allegation'` from a Machine Observation row.
- **DOC-7** User Allegation path unchanged: `adaptManualTagSource` produces identical output for the existing fixture in pre-MCP-021B / post-MCP-021B (byte-equal regression guard).
- **DOC-8** Every Machine Observation registry entry consumed by the adapter has `kind === 'machine_observation'`.
- **DOC-9** Confidence value 'high' never blocks posting (architectural — the adapter has no posting path).
- **DOC-10** Adapter result never contains a `verdict` / `winner` / `loser` field.
- **DOC-11** Persistence query has no `truth` / `correctness` filter.
- **DOC-12** Persistence query has no engagement / popularity / heat sort.
- **DOC-13** Persistence query orders by NEITHER engagement NOR view count NOR follower count (cdiscourse-doctrine §3).
- **DOC-14** Adapter source has zero `console.log` / `console.error` (no echo of unknown rawKeys to logs).
- **DOC-15** Migration text contains the cdiscourse-doctrine §1 / §10a anchor comments.
- **DOC-16** Migration text contains the engagement-not-evidence anchor (cdiscourse-doctrine §3) for the doctrine note on the new tables.
- **DOC-17** Adapter accepts ONLY the 172 MCP-021A rawKeys (registry-membership filter is the gate).
- **DOC-18** Adapter silently drops rawKeys outside the 172 (no exception, no warning, no log).
- **DOC-19** Persistence query source contains zero `from('point_tags')` references (Allegation path stays separate).
- **DOC-20** Sensitive composer-only entries from Family J never surface on Timeline / Selected / Inspect via the persistence path (end-to-end assertion).
- **DOC-21** New file scan: zero imports from `@anthropic`, `@xai`, `xai-sdk`, `openai`.
- **DOC-22** New file scan: zero `fetch(` calls (the query helper uses `supabase.from(...)`).
- **DOC-23** Plain-language scan: every label / shortLabel / description visible after the pipeline has no snake_case (matches existing pattern).
- **DOC-24** Persistence types file: `MachineObservationRunStatus` enum does NOT contain `winner` / `loser` / `truth` / `correct`.

### 8.7 `__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts` (forecast: ~24 tests)

Byte-equal regression guard over the read-only list.

- **RO-1** `git diff main..HEAD -- src/features/nodeLabels/nodeLabelPresentationModel.ts` returns no changes.
- **RO-2** Same for `nodeLabelPriorityModel.ts`.
- **RO-3** Same for `nodeLabelDescriptorAdapter.ts`.
- **RO-4** Same for `NodeLabelStrip.tsx` (note: this file IS edited per §6.2 bounded edit 5; reframe — assert the diff is minimally additive: ONE new optional prop + ONE additional argument to `adaptAllSourcesForNode`, no other changes).
- **RO-5** Same for `NodeLabelInspectGroups.tsx` (same minimally-additive assertion).
- **RO-6** Same for `machineObservationDefinitions.ts` (NO diff; 172 entries untouched).
- **RO-7-RO-16** Same for each `machineObservationDefinitions/familyA.ts` … `familyJ.ts` (NO diff; per-family files untouched).
- **RO-17** Same for `mcpBooleanObservationSchema.ts` (NO diff; schema-version constant untouched).
- **RO-18** Same for `userAllegationRegistry.ts` (NO diff).
- **RO-19** Same for `machineObservationRegistry.ts` (NO diff).
- **RO-20** Same for `threadTopologyAutoMetadata.ts` (NO diff).
- **RO-21** All `__tests__/uxOneOneSix*.test.{ts,tsx}` byte-equal (NO diff).
- **RO-22** All `__tests__/mcpOneTwoOneA*.test.ts` byte-equal (NO diff).
- **RO-23** `package.json` byte-equal (NO diff).
- **RO-24** `package-lock.json` byte-equal (NO diff).

Note for the implementer: tests RO-4 and RO-5 use a tighter assertion than
"byte-equal" — they assert the diff is bounded to the documented additive
edits in §6.2. The pattern is: `git diff main..HEAD -- <file> | grep -c '^[+-]'`
returns a count ≤ a documented ceiling (e.g. 10 lines for a single new prop +
single new argument pass-through).

### 8.8 Test count forecast summary

| File | Forecast |
|---|---:|
| `mcpOneTwoOneBPersistenceMigration.test.ts` | 22 |
| `mcpOneTwoOneBRlsPolicy.test.ts` | 14 |
| `mcpOneTwoOneBPersistedRowAdapter.test.ts` | 28 |
| `mcpOneTwoOneBSourceSixAdapter.test.ts` | 22 |
| `mcpOneTwoOneBDisplayCapPreservation.test.ts` | 26 |
| `mcpOneTwoOneBDoctrine.test.ts` | 24 |
| `mcpOneTwoOneBReadOnlyBoundary.test.ts` | 24 |
| **Total** | **160** |

**+160 forecast is well within the +500 ceiling per Trigger 8.** The
implementer may add additional defensive-input cases (battery expansions) if
the +500 ceiling permits; the operator-deferred review item in §11.3 records
this latitude.

---

## §9 — Read-only boundary list

MCP-021B MAY MODIFY (bounded):

| Path | Class | Rationale |
|---|---|---|
| `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql` | NEW | The migration that introduces both persistence tables. |
| `src/features/nodeLabels/machineObservationPersistenceTypes.ts` | NEW | Pure-TS row types and type guards. |
| `src/features/nodeLabels/machineObservationPersistenceAdapter.ts` | NEW | Pure-TS adapter from persisted rows → NodeLabelMark[]. |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts` | NEW | Read-only Supabase SELECT helper. |
| `src/features/nodeLabels/nodeLabelSourceAdapters.ts` | BOUNDED EDIT | Additive: `RawClassifierBinaryAdapterInput` gains 2 optional fields; `adaptRawClassifierBinarySource` body changes from `return [];` to the persisted-rows pass-through; `adaptAllSourcesForNode` signature gains 2 optional inputs that pass through to Source 6. NO other adapter function modified. |
| `src/features/nodeLabels/index.ts` | BOUNDED EDIT | Export the 3 new persistence helpers + the new types. Header comment updated to note MCP-021B's additions. |
| `src/features/arguments/argumentsApi.ts` | BOUNDED EDIT | Extend `fetchArgumentRelations` Promise.all with the new SELECT; extend `ArgumentRelations` return type. NO write helper added. |
| `src/features/arguments/useArgumentRoomMessages.ts` | BOUNDED EDIT | Accumulate persisted rows into a new `persistedObservationsByArgumentId` map; expose on hook return shape. NO realtime channel added (deferred to a future card). |
| `src/features/arguments/ArgumentTreeScreen.tsx` | BOUNDED EDIT | Destructure the new field and pass through to `ArgumentGameSurface`. |
| `src/features/arguments/ArgumentGameSurface.tsx` | BOUNDED EDIT | Add new prop `persistedObservationsByArgumentId` and thread it into the existing `NodeLabelStrip` + `NodeLabelInspectGroups` mounts. NO new visual surface. |
| `src/features/nodeLabels/NodeLabelStrip.tsx` | BOUNDED EDIT | Accept new optional prop `persistedClassifierRows`; pass it into the existing `adaptAllSourcesForNode` call. |
| `src/features/nodeLabels/NodeLabelInspectGroups.tsx` | BOUNDED EDIT | Same minimal change as NodeLabelStrip. |
| `docs/core/current-status.md` | APPEND ONLY | Add MCP-021B handoff section AFTER existing MCP-021A H2 section. Do NOT modify existing sections. |
| `__tests__/mcpOneTwoOneB*.test.{ts,tsx}` (×7) | NEW | The 7 test files per §8. |

MCP-021B MAY NOT MODIFY:

| Path | Reason |
|---|---|
| `src/features/nodeLabels/nodeLabelPresentationModel.ts` | UX-001.5A display caps; byte-equal binding. |
| `src/features/nodeLabels/nodeLabelPriorityModel.ts` | UX-001.5A priority logic; byte-equal binding. |
| `src/features/nodeLabels/nodeLabelDescriptorAdapter.ts` | UX-001.5A descriptor adapter; byte-equal binding. |
| `src/features/nodeLabels/machineObservationDefinitions.ts` + every `machineObservationDefinitions/familyA-J.ts` | MCP-021A 172 definitions; byte-equal binding. |
| `src/features/nodeLabels/mcpBooleanObservationSchema.ts` | MCP-021A wire contract + schema version constant; byte-equal binding. |
| `src/features/nodeLabels/userAllegationRegistry.ts` | UX-001.5A User Allegation registry; byte-equal binding. |
| `src/features/nodeLabels/machineObservationRegistry.ts` | UX-001.5A legacy 65-entry registry; byte-equal binding. |
| `src/features/nodeLabels/threadTopologyAutoMetadata.ts` | MCP-021A stubs; byte-equal binding. |
| All `__tests__/uxOneOneSix*.test.{ts,tsx}` | UX-001.6 cross-device QA matrix; byte-equal binding. |
| All `__tests__/mcpOneTwoOneA*.test.ts` | MCP-021A test files; byte-equal binding (including the Source 6 invariance test). |
| `src/features/arguments/useSemanticReferee.ts` | MCP-021C territory; out of scope for MCP-021B. |
| Any `supabase/migrations/` file other than the new MCP-021B migration | OPS-001 never-edit-applied-migration rule. |
| Any existing Edge Function source under `supabase/functions/` | MCP-021B writes no Edge Function (MCP-021C territory). |
| `package.json` / `package-lock.json` | No new dependency. |
| `src/features/nodeAnnotations/*` | UX-001.5 primitive layer; UX-001.5A boundary. |
| `src/lib/designTokens.ts` | No new token. |

---

## §10 — Conditional HALT trigger table

All 15 triggers evaluated CLEAN at design phase. The implementer must re-check
each trigger before submitting the implementation; any new finding HALTS.

| # | Trigger | Status | Evidence |
|---|---|---|---|
| 1 | Live MCP call proposed | CLEAN | §1.4, §5, §6 explicitly route through persistence only. No `fetch()` to MCP server. No `mcpResponseToNodeLabelMarks` use beyond the existing MCP-021A export (which is unused by MCP-021B's adapter). |
| 2 | New AI provider call path | CLEAN | No `@anthropic`, `@xai`, `openai` imports. All new files pure-TS or Supabase SELECT. |
| 3 | New taxonomy key | CLEAN | Adapter validates rawKey against the existing 172-entry registry. Unknown keys dropped silently. No new key added. |
| 4 | New visual primitive or token | CLEAN | §6.3. Persisted rows land in `rawClassifierMarks` and flow through the existing display caps. No new component, no new token. |
| 5 | Display cap change | CLEAN | §7. UX-001.5A display caps absorb new input transparently. The stress test asserts the cap holds at 100+ rows. |
| 6 | Client-JWT INSERT/UPDATE/DELETE policy on the new tables | CLEAN | §4.4. Migration has zero write policies. Reviewer's mechanical `grep` check returns zero matches. |
| 7 | `COMMENT ON storage.*` statement | CLEAN | §3.5. Migration touches only `public.argument_machine_observation_runs` and `public.argument_machine_observation_results`. PR-003 boundary preserved. |
| 8 | Test count delta forecast exceeds +500 | CLEAN | §8.8. +160 forecast. Implementer may expand to +200 within ceiling. |
| 9 | Migration ordering surfaces SQLSTATE 2BP01 or 42501 risk | CLEAN | §3.1 header walks Class 3 ordering: runs CREATE TABLE before results CREATE TABLE (FK); ENABLE RLS before CREATE POLICY; CREATE INDEX after CREATE TABLE. PR-004 SQLSTATE 2BP01 not applicable (no DROP COLUMN / DROP TABLE). PR-003 SQLSTATE 42501 not applicable (no storage.* statements). |
| 10 | Modify MCP-021A taxonomy or schema outside bounded edit list | CLEAN | §9 explicitly forbids modifying `machineObservationDefinitions.ts`, per-family files, `mcpBooleanObservationSchema.ts`, `userAllegationRegistry.ts`, `machineObservationRegistry.ts`, `threadTopologyAutoMetadata.ts`. Byte-equal regression test RO-6 through RO-20 enforces. |
| 11 | Source 6 adapter signature changes break existing UX-001.5A consumers | CLEAN | §5.4. Signature change is additive (new optional params); existing callers receive `[]` byte-equal. MCP-021A invariance test continues to pass. |
| 12 | Designer cannot locate canonical visibility predicate AND cannot identify a documented fallback | CLEAN | §2.1, §2.2. Canonical `arguments` SELECT policy at `qol_039_room_visibility.sql:236-252`; canonical delegation pattern at `meta_1a_point_tags.sql:88-98`. Both verified verbatim. |
| 13 | Context window threshold (70%) | CLEAN | Designer (this writer) has read all 12 required inputs in full; design doc written without re-fetching. |
| 14 | Interpretive judgment requires operator decision beyond brief + sequencing-note + MCP-021A inputs | CLEAN | All design decisions trace to brief + sequencing-note + MCP-021A + canonical SQL. Operator-deferred items (§11.2, §11.3) are explicitly latitude items, not blockers. |
| 15 | Phase A reconciliation surfaces existing visibility predicate materially different from sequencing-note's stated shape | NOT FIRED (anticipated) | §2.5. The canonical META-1A delegation pattern IS materially different from the brief's target shape. The brief explicitly authorized this divergence (line 204). Design ledger §11.1 records the divergence and rationale. |

**EXPLICIT VERDICT: ALL 15 CONDITIONAL TRIGGERS CLEAN. Auto-proceed to implementer.**

---

## §11 — Brief ledger

### 11.1 Canonical visibility predicate divergence (designer decision)

**Decision:** USE the META-1A single-table EXISTS delegation pattern.

**Brief's target:** verbose join into `public.debates` AND
`public.debate_participants` with `visibility = 'public'` arm.

**Canonical chosen:** EXISTS into `public.arguments` (which inherits the full
QOL-039 arm set via the existing `arguments: select own, participant-private,
or posted-public` policy).

**Rationale:** the canonical pattern is recursion-safe (QOL-039 specifically
introduced SECURITY DEFINER helpers to avoid this recursion), inherits the
full canonical arm set (moderator/admin + author + posted-public + participant-private),
generates a cheaper plan, and is forward-stable. The brief's target shape
would re-introduce the recursion problem QOL-039 already solved.

**Operator action:** none required. Brief line 204 explicitly authorized this
divergence.

### 11.2 RLS recursion decision (designer decision)

**Decision:** inherit-via-run for `argument_machine_observation_results`.

**Alternative considered:** duplicate the canonical `public.arguments` EXISTS
directly on the results table.

**Rationale:** the inherit-via-run chain is recursion-free
(results → runs → arguments → SECURITY DEFINER helpers; each hop targets a
distinct table). The inherit chain is one level deeper than META-1A's
`pt_select_read_access` but follows the same delegation pattern. Cheaper
plan than duplicating the full canonical predicate.

**Operator action:** none required. **Operator-deferred follow-up:** if
MCP-021C's smoke surfaces unusual plan cost or unexpected RLS denial, the
operator may instruct a follow-up migration to switch results to the
duplicate-predicate shape.

### 11.3 Source 6 adapter signature change (designer decision)

**Decision:** additive optional `persistedClassifierRows` + `surface` fields
on `RawClassifierBinaryAdapterInput`.

**Why additive (not new function):** the existing `adaptAllSourcesForNode`
aggregator wires Source 6 by name; introducing a new function would require
breaking the aggregator's pattern OR adding a new aggregator path. The
additive signature lets existing callers pass through unchanged while new
callers opt into the persisted-rows path.

**Backwards-compatibility verified (Phase A.2):** the convenience aggregator
and the MCP-021A invariance test continue to pass NO `persistedClassifierRows`
and continue to receive `[]`. The byte-equal MCP-021A test file remains
unchanged.

**Operator action:** none required.

### 11.4 Integration site (designer identification)

**Identified site:** `src/features/arguments/ArgumentGameSurface.tsx`
(receives a new prop `persistedObservationsByArgumentId`), threaded through
from `useArgumentRoomMessages` via `ArgumentTreeScreen`.

**Data-loader extension:** `fetchArgumentRelations` in
`src/features/arguments/argumentsApi.ts` gains the new SELECT in its existing
`Promise.all` batch; mirror the META-1A `pointTags` precedent (lines 239-247
of that file).

**Why no new fetcher pattern:** `fetchArgumentRelations` already batches three
relation reads in parallel. Adding the fourth keeps the network round-trip
count at ONE for the room load.

**Operator action:** none required.

### 11.5 OPS-001 four-class header walk (designer commitment)

**Decision:** the migration's top-of-file SQL comment block contains:

- Description, predecessor, doctrine notes
- Statement order list (Class 3 — implicit ordering dependencies)
- Explicit four-class posture block ("Class 1: …", "Class 2: …", "Class 3: …", "Class 4: …")
- No-write-policy posture
- PR-003 / PR-004 boundary statements

Pattern matches `qol_039_room_visibility.sql:1-78` header verbatim style.

**Operator action:** none required. Header is mandatory per
`.claude/agents/roadmap-reviewer.md` lines 105-117.

### 11.6 Operator-deferred review items

| # | Item | When operator may need to revisit |
|---|---|---|
| 1 | RLS recursion decision (§11.2) | If MCP-021C smoke surfaces plan cost or unexpected denial on results read path. |
| 2 | Test count latitude (§8.8) | Implementer may add defensive-input batteries up to +500 ceiling; operator may instruct trim if forecast exceeds +300. |
| 3 | Realtime channel for persisted observations | NOT in MCP-021B scope. A future card may wire a realtime channel on the new tables mirroring `pointTagsRealtime.ts`. Deferred. |
| 4 | Family-sharded batched MCP execution | MCP-021C territory. Persistence schema accommodates per-family `requestedFamilies` array on the runs row. |

### 11.7 Missing skill — `source-access-audit`

The card prompt referenced a `source-access-audit` skill applied in
`docs/audits/MCP-020-semantic-boolean-observation-inventory.md` and
`docs/audits/UX-001.5A-source-access-audit.md`. **No such skill is registered**
in the available-skills list for this session. Per card prompt's substitution
guidance, this designer applied the audit-mode protocol from those two
exemplar audit documents as the working pattern:

- **Spot-check audit citations byte-stable** — every source-path citation in
  the predecessor (MCP-021A design + intent brief) was re-read at the cited
  line range during Phase A.
- **Reconciliation tables** — Phase A.1 visibility-predicate reconciliation in
  §2 follows the same pattern as MCP-020 audit §"Family E entries" and
  MCP-021A §2.1 / §2.2.
- **Defensive disposition statements** — §1.4 byte-equal preservation contract
  uses the same enumerated-list pattern as MCP-021A §1.3.

The substitution is documented here for the reviewer.

---

## §12 — MCP-021B → MCP-021C handoff

### 12.1 What MCP-021C inherits

1. **The persistence schema.** Two tables: `argument_machine_observation_runs`
   and `argument_machine_observation_results`. RLS read-only for clients;
   service-role-only writes. MCP-021C builds its server-side write path
   against this schema unchanged.
2. **The adapter contract.** `mapPersistedObservationRowsToNodeLabelMarks`
   accepts rows of the new persisted shape and produces `NodeLabelMark[]`
   filtered by surface + confidence + registry membership + schema version.
   MCP-021C produces rows that the adapter consumes; no change to the
   adapter signature.
3. **The integration site.** `ArgumentGameSurface.tsx` already threads
   `persistedObservationsByArgumentId` into `NodeLabelStrip` and
   `NodeLabelInspectGroups`. MCP-021C's live execution writes rows; the next
   room-load picks them up via the existing query helper.
4. **The display cap behavior.** Stress-tested at 100+ rows per argument.
   MCP-021C may produce hundreds of rows per argument across families; the
   caps absorb the input transparently.
5. **The schema version constant.** `mcp-021.machine-observations.boolean.v1`
   verbatim. MCP-021C continues to use this version. Any future v2 wire shape
   requires a coordinated MCP-021A schema-version bump.

### 12.2 What MCP-021C must add

1. **Live MCP execution path.** A new Edge Function (e.g.
   `run-machine-observation-classifier`) that:
   - Accepts an argument id + (optional) family-shard list.
   - Builds the MCP request via `buildMcpBooleanObservationRequest` (already
     in MCP-021A schema file).
   - Calls MCP transport (out of scope for the persistence card).
   - Parses the response via `parseMcpBooleanObservationResponse` +
     `sanitizeMcpBooleanObservationResponse` (already in MCP-021A schema file).
   - Writes one `argument_machine_observation_runs` row + N positive
     `argument_machine_observation_results` rows in a transaction.
   - Returns success / failure / fallback status.
2. **Service-role write client.** The Edge Function uses
   `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for writes. MCP-021B explicitly
   has NO client write path; the service-role write is MCP-021C's
   responsibility.
3. **Family-sharded batching.** MCP-021A's 172 entries span 10 families with
   varying confidence floors. MCP-021C may batch by family (e.g. one MCP call
   per family) and persist each batch as a separate run. The schema's
   `requested_families` array column accommodates this.
4. **Transport / retry / sanitization.** MCP-021A schema file references
   "MCP-021C wires the sanitizer" for `currentText` / `parentText` /
   `threadContextExcerpt`. MCP-021C delivers the actual sanitizer.
5. **PRESMOKE for one family.** Per MCP-021-sequencing.md §"Required follow-up
   before full MCP-021C": call live MCP for one small family only, validate
   schema, require confidence on every positive flag, discard unknown rawKeys
   silently, assert malformed output emits zero observations.
6. **Realtime channel (optional, deferred).** Not required for MCP-021C, but
   a follow-up card may add `usePersistedObservationsRealtime` mirroring
   `usePointTagsRealtime` (META-1B precedent). When this lands, MCP-021C's
   write path also broadcasts an event to refresh active room loaders.

### 12.3 Operator smoke after MCP-021B merges

Per `docs/decisions/MCP-021-sequencing.md` §"Required follow-up after MCP-021B":

1. Seed 5-10 fake persisted Machine Observation result rows via service-role
   SQL against the bot-seeded rooms.
2. Verify Source 6 adapter consumes them (open the room, observe new chips on
   the Timeline / Selected / Inspect).
3. Verify Timeline still caps at 1 Machine Observation + 1 User Allegation +
   overflow.
4. Verify Selected Context still caps at 3 Machine Observations + 3 User
   Allegations + overflow.
5. Verify Inspect remains grouped and unbounded.
6. Verify reload preserves persisted Machine Observations.
7. Verify second-account visibility follows RLS (a non-participant of a
   private room sees zero persisted observations on that room's arguments).

### 12.4 Estimated implementer wall time

| Phase | Hours |
|---:|---:|
| Migration SQL (header + 2 tables + RLS + indexes + comments) | ~1.5 |
| 3 new persistence files (types + adapter + query) | ~2.5 |
| Bounded edits (6 existing files; mostly 1–10 line additions each) | ~1.5 |
| 7 test files (~160 tests; aggregate-test pattern) | ~4.0 |
| Local typecheck / lint / test runs + iteration | ~1.5 |
| Migration apply check (operator runs `npx supabase db reset --linked=false` if Docker is available; else heightened textual review per OPS-001) | ~0.5 |
| Current-status.md handoff append | ~0.5 |
| **Total** | **~12 hours** |

This is a higher estimate than MCP-021A's pure-TS-only L card because MCP-021B
adds a migration + RLS pattern + integration wiring through 4 layers of
React state. The implementer should expect 1.5x to 2x the MCP-021A wall time.

### 12.5 Operator steps after implementer commits

After the implementer's PR merges to main, the operator runs:

```powershell
npx supabase db push --linked   # apply the new migration
```

The Supabase GitHub integration auto-applies migrations on merge to main per
the existing `Supabase merge auto-deploy` pattern (operator memory:
`supabase-merge-autodeploy`). Operator should confirm:

- `npx supabase db status` reports the new migration applied.
- `npx supabase db lint` returns zero issues.
- A smoke insertion via service-role SQL produces a row that the client can
  read through the new query helper.

No Edge Function deploys for MCP-021B (no Edge Function in MCP-021B scope).
No env var changes. No client redeploy required for the persistence pipeline
to activate (the bounded edits ship code that becomes live as soon as the
migration applies).
