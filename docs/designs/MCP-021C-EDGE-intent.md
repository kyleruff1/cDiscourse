# MCP-021C-EDGE Design Intent Brief — Boolean Observation Classifier Edge Function

**Card:** MCP-021C-EDGE — Boolean Observation Classifier Edge Function (Family A first; server-side; admin validation mode; reuses MCP-018 adapter pattern; writes MCP-021B persistence)
**Track:** MCP-021 sequence (MCP-021A taxonomy → MCP-021B persistence → **MCP-021C-EDGE** live execution → future family enablement cards)
**Priority:** P0 / Urgent
**Effort:** M-L
**Filed:** 2026-05-26
**Author:** Operator-authored
**Status:** Binding for MCP-021C-EDGE designer phase. Stage 2 HALT is CONDITIONAL per autonomous-pipeline authorization.
**Pivot decision:** `docs/decisions/MCP-021C-edge-pivot.md`
**Predecessors:** MCP-021A (PR #301, `d6648b4`); MCP-021B (PR #303, `eaa1aeb`); MCP-021B smoke audit (`6feeb08`)
**First production family:** Family A — `parent_relation` (16 keys)
**Production enablement:** Family A only. Families B-J remain disabled until later validation cards.
**Test baseline:** 17,128 / 521 suites passing after MCP-021B smoke audit

---

## Why this brief exists

MCP-021A landed the maximal Boolean Machine Observation taxonomy (172 entries / 10 families) and the wire schema (`mcp-021.machine-observations.boolean.v1`). MCP-021B landed durable persistence (runs + results tables with RLS), Source 6 persisted-row consumption, and the MCP-021B smoke audit verified the path end-to-end.

What none of those cards proved is that a live MCP server returns schema-conforming Family A output that the existing parser accepts. The 2026-05-25 bot annotation run made the risk concrete: 38/38 annotation attempts fell back to `deterministic_fallback` because the Anthropic annotation response shape failed validation. That fallback was harmless for UX-001.5A (which doesn't consume those annotations), but full MCP-021C would silently discard every live response if the same shape mismatch occurred.

MCP-021C-EDGE creates the scalable runtime spine for live execution. Family A ships into production first. Future families add by registry entry + admin validation pass + production enablement flag — not by new infrastructure.

The earlier MCP-021C-PRESMOKE proposal assumed a client-side dormant MCP provider slot and an `EXPO_PUBLIC_MCP_SERVER_URL` env var. Pre-flight rejected that direction: MCP credentials are server-side Supabase function secrets per `CLAUDE.md` security policy, `MCP-018` runbook, and `cdiscourse-doctrine §7`. MCP-021C-EDGE is the corrected architectural pivot.

---

## Central product rule

Live Boolean Observation classification happens server-side.

The client NEVER sees:
- MCP server URL
- MCP token
- raw MCP transport
- service-role key
- provider-specific failure internals

The client ONLY reads persisted, RLS-gated Machine Observation rows through MCP-021B's persistence path. Admin validation rows are filtered out of the production read path.

---

## Binding decisions

### Decision 1 — Edge Function only

MCP-021C-EDGE uses Supabase Edge Function code and server-side secrets exclusively. It does NOT add any client-side MCP provider. The existing MCP-018 server-side adapter pattern at `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` is reused.

### Decision 2 — Family-sharded execution

The Edge Function accepts:

```ts
{
  argumentIds: string[];
  requestedFamilies: MachineObservationFamily[];
  mode: 'production' | 'admin_validation';
  schemaVersion: 'mcp-021.machine-observations.boolean.v1';
}
```

The function executes one MCP request per family per argument (or per batch, designer Phase A decides). The implementation is family-agnostic: enabling a future family requires only a registry entry and an enable-flag flip, not new code in the Edge Function handler.

### Decision 3 — Family A first; exact 16 keys binding

Family A keys are binding; exactly 16:
supports_parent
challenges_parent
refines_parent
extends_parent
distinguishes_parent
reframes_parent
questions_parent
summarizes_parent
acknowledges_parent
corrects_parent_detail
contrasts_with_parent
answers_parent_question
has_rebuttal
has_counter_rebuttal
rebutted
quote_anchors_parent

If `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` disagrees with this list during designer Phase A, HALT (Trigger 18). Do not silently add, drop, rename, or alias a key. That is a taxonomy discrepancy and must be resolved upstream before MCP-021C-EDGE proceeds.

Families B-J are registered in the family-agnostic Edge Function plumbing (so future enablement is config-only) but are NOT production-enabled in this card.

### Decision 4 — Admin validation mode is first-class

Admin validation mode replaces the old one-off PRESMOKE concept and lives inside the Edge Function as a first-class capability, not a temporary scaffold.

Admin validation mode:
- May call any requested family (including B-J) against any argument ids
- Records diagnostic run status with `run_mode = 'admin_validation'`
- Writes positive result rows like production runs (so the full path is exercised end-to-end)
- Source 6 filters these rows OUT of production rendering (see Decision 9)
- Does NOT enable a family for production automatically
- Produces enough data to decide whether a future family can be enabled

Future family enablement workflow:
1. Run admin validation mode against fixture moves for the new family
2. Inspect the runs (success / failed / fallback per family)
3. If validation passes, file a small enablement card that flips the production enable-flag
4. If validation fails, fix the prompt or schema; re-run; eventually enable

### Decision 5 — Persistence writes through MCP-021B

MCP-021C-EDGE writes to MCP-021B's tables. For each execution:

- Create one run row (production OR admin_validation per Decision 9)
- Write positive result rows only
- Write zero result rows if no flags are positive
- Mark failures/fallbacks on the run row with `status` and `failure_reason`
- NEVER persist unknown raw keys (sanitizer drops them)
- NEVER persist malformed rows
- NEVER persist rows for schema versions not supported

Writes use the service-role client inside the Edge Function (per MCP-021B Decision 2: client-read service-role-write).

### Decision 6 — Strict MCP-021A parser reuse

Use MCP-021A's `parseMcpBooleanObservationResponse` and `sanitizeMcpBooleanObservationResponse` from `src/features/nodeLabels/mcpBooleanObservationSchema.ts`.

Do NOT weaken schema validation. Do NOT add adaptive parsing, schema migration, or fallback shape coercion in this card.

If live MCP output fails schema validation, mark the family run as `status = 'failed'` with diagnostic `failure_reason`. The run is recorded; no result rows are written for that family/argument pair.

### Decision 7 — Admin-trigger-only initial production posture

Initial MCP-021C-EDGE ship is admin-trigger-only:
- Edge Function can be invoked manually by admin tooling or CLI
- It writes valid persisted results when called
- No automatic "on every argument post" trigger yet

A later card (MCP-021C-AUTO-TRIGGER) adds automatic async triggering after this path proves stable.

If the designer proposes an automatic production trigger in this card, HALT (Trigger 12). The default posture is intentional: validate the live path manually before auto-triggering.

### Decision 8 — Schema-version soft window

MCP-021C-EDGE supports MCP-021A v1. The persistence layer already pins `schema_version` per row. Future schema versions (v2, v3) will be added with a soft compatibility window: existing v1 rows remain readable; the Source 6 adapter renders both versions during transition; a separate operator-driven migration retires v1 rows when ready.

This card does NOT bump the schema version.

### Decision 9 — Admin validation rows persisted distinctly via run_mode column

Admin validation runs write to `argument_machine_observation_runs` with an explicit discriminator:

```sql
ALTER TABLE public.argument_machine_observation_runs
ADD COLUMN run_mode text NOT NULL DEFAULT 'production'
CHECK (run_mode IN ('production', 'admin_validation'));

CREATE INDEX argument_machine_observation_runs_run_mode_idx
ON public.argument_machine_observation_runs (run_mode);
```

For admin validation rows:
- `run_mode = 'admin_validation'`
- (Optional, designer Phase A decides) `validation_family text` column if Phase A determines this column is needed for efficient dashboard querying. If the designer finds `requested_families[]` already supports the dashboard query, this column may be omitted.

Production classifier runs use:
- `run_mode = 'production'` (default)

**Source 6 filter requirement:** Admin validation result rows MUST NOT render through Source 6 in normal production read paths. The MCP-021B persistence query OR adapter must exclude admin-validation runs:

```sql
-- Inside the persistence query (preferred):
WHERE runs.run_mode = 'production'
```

OR (adapter-level filter if the query path doesn't support the join cleanly):

```ts
// In machineObservationPersistenceAdapter.ts:
if (row.runs?.run_mode !== 'production') continue;
```

The bounded edit to MCP-021B's Source 6 adapter / query path is explicitly authorized for this card. It must not break the byte-equal-on-empty-input invariance test (`mcpOneTwoOneASourceSixInvariance.test.ts`) and must not break the MCP-021B persisted-label smoke (the 9 existing smoke seed rows in the linked project have `run_mode = NULL` after the migration adds the column with default `'production'`, so they continue to render).

**Migration safety:**
- The new column has `DEFAULT 'production'` so existing rows backfill to production (preserves MCP-021B smoke seed visibility)
- The `CHECK` constraint allows only the two known values
- The new index supports the production-only filter

**Fallback (only if Phase A proves migration is unsafe):**
If the existing MCP-021B schema cannot accept this migration cleanly, HALT and surface a bounded MCP-021B schema patch rather than falling back silently. As a documented temporary fallback only: `provider_key = 'admin_validation:<family>'` may be used IF Phase A proves the run table has no safe room for a `run_mode` discriminator. If used, it MUST be documented as temporary and Source 6 MUST filter out `provider_key LIKE 'admin_validation:%'`.

Reason for preferring `run_mode` over `provider_key` overloading: `provider_key` identifies provider/tool provenance. `run_mode` identifies purpose. Long-term dashboards, retry logic, analytics, and family pass-rate views will be cleaner if validation runs are first-class rows rather than encoded into provider identity.

### Decision 10 — Initial admin-validation fixture moves

The initial admin-validation fixture uses three posted moves from the 2026-05-25 bot-seeded rooms:

1. One root move, depth 0
2. One direct reply, depth 1
3. One deeper reply, depth 2+

The MCP-021B smoke audit (commit `6feeb08`) already identified the Onboarding apology room as a useful fixture source, with known root/depth-1 candidates:

- **Onboarding apology room:** `1e598dce-8188-4c7e-bdd6-aedede750923`
  - Root candidate: `f41b18b0-...` (designer Phase A resolves full UUID)
  - Depth-1 candidate: `781f8057-...` (designer Phase A resolves full UUID)

Designer Phase A MUST resolve and record the full UUIDs. Partial IDs are acceptable in the intent brief as references only; production code and fixtures MUST use full UUIDs.

For the depth-2+ move, designer Phase A may choose from the Onboarding apology room if it has sufficient depth, or from one of the other 2026-05-25 bot-seeded rooms:

- **Pitch clock baseball:** `35ef4c74-dfc8-4520-bcc9-558272257153`
- **Bike lanes curb:** `2c085a50-4a27-4dad-bc3d-17a3eca09ddb`

If no depth-2+ move can be resolved from the seeded rooms, HALT and surface. Do not fabricate a fixture.

---

## Required production deliverables

1. **New Supabase Edge Function:**
   - Preferred: `supabase/functions/classify-argument-boolean-observations/index.ts`
   - Designer may instead extend an existing semantic-referee Edge Function if Phase A finds that is safer; if extended, must document why
   - Must use server-side secrets only via `Deno.env.get()`

2. **Shared server-side Boolean Observation modules** (under `supabase/functions/_shared/booleanObservations/` or equivalent):
   - Request builder (family-agnostic)
   - Family selection / enable-flag config
   - MCP adapter wrapper (reuses MCP-018 adapter pattern)
   - Response parser/validator bridge (per Decision 6 + parser-import resolution below)
   - Persistence writer (service-role; runs + results)
   - Run status model (success / failed / fallback)

3. **Family A request builder:**
   - Exactly the 16 Family A keys from Decision 3
   - Parent context included
   - Child/reply context included if available
   - No families B-J in production execution

4. **Persistence writer:**
   - Writes run row (with `run_mode` per Decision 9)
   - Writes positive result rows only
   - Uses service-role only inside Edge Function
   - Never writes invalid raw keys or invalid schema versions

5. **Admin validation mode:**
   - Takes argument ids and requested families
   - Returns family-level status
   - Records diagnostic run rows (`run_mode = 'admin_validation'`)
   - Does not alter UI display caps
   - Source 6 filters these rows out per Decision 9

6. **Bounded edits:**
   - New migration adding `run_mode` column + index to MCP-021B's `argument_machine_observation_runs` table
   - Bounded edit to MCP-021B persistence query OR adapter to filter `run_mode = 'production'` (per Decision 9)
   - Bounded edit to MCP-021B persistence types to add `run_mode` field
   - `src/features/nodeLabels/index.ts` if new exports needed

7. **Tests** (categories below; aggregate-test pattern per MCP-021A/B precedent):
   - Edge function request validation
   - Family A request builder exactness (16 keys; parent context; schema version pinned; no other families leaked)
   - MCP response validation reuse (parser called verbatim; failure modes documented)
   - Persistence write contract (run row + positive results only; service-role only)
   - Unknown raw_key discard (sanitizer behavior)
   - Schema mismatch discard
   - Failure/fallback run status
   - No client-side MCP secrets (grep scan)
   - No client-side MCP fetch (grep scan)
   - run_mode discriminator: production rows render via Source 6; admin_validation rows do NOT
   - MCP-021A regression (full mcpOneTwoOneA suite byte-equal)
   - MCP-021B regression (full mcpOneTwoOneB suite passes; smoke seed still renders)
   - Display cap preservation (no new mounts; existing caps unchanged)
   - Read-only boundary

8. **Audit template** at `docs/audits/MCP-021C-EDGE-admin-validation-template.md`:
   - Operator copies this to a dated audit doc after the post-merge EDGE-SMOKE run
   - Captures: which 3 moves were called, which families validated, which failed and why, verdict, recommendations

9. **Handoff section** appended to `docs/core/current-status.md` AFTER existing MCP-021B section (do NOT modify existing sections).

10. **Design doc** at `docs/designs/MCP-021C-EDGE.md` with the 12 required sections (see Designer Deliverable below).

11. **Review doc** at `docs/reviews/MCP-021C-EDGE-review.md`.

---

## Parser import resolution (binding Phase A ledger item)

Designer Phase A MUST resolve parser import to one of three outcomes and document the choice in the design ledger:

**Outcome 1 — Direct import works:**
The Edge Function imports MCP-021A parser/sanitizer directly from `src/features/nodeLabels/mcpBooleanObservationSchema.ts`. Deno's TypeScript support handles the cross-tree import cleanly. Best case; zero duplication.

**Outcome 2 — Bridge import works:**
A server-side bridge module (e.g., `supabase/functions/_shared/booleanObservations/parserBridge.ts`) re-exports the MCP-021A parser/sanitizer without duplicating parser logic. The bridge contains only re-exports; the production parser remains the single source of truth.

**Outcome 3 — Server-side copy is unavoidable:**
A server-side parser copy is created ONLY IF Deno/import constraints prevent direct or bridged reuse. If this happens, the implementer MUST add a drift test asserting the production parser and server-side parser remain byte-equivalent OR semantically equivalent over the full MCP-021A parser test corpus. The drift test fires Trigger 8 if either parser is modified without the other.

If none of the three outcomes can be made safe, HALT under Trigger 14. Do NOT weaken schema validation to make the Edge Function import easier.

---

## Required tests

Test count forecast: +180 to +280. Well below +500 ceiling (Trigger 13).

The integration test uses a mock MCP server (in-test fixture, not a real network call) to validate the full request/response path. The actual live MCP call is operator-driven post-merge (EDGE-SMOKE), not run in CI.

---

## Strict out of scope (any item HALTS)

1. Calling families B-J in production mode (Trigger 5; admin validation mode may call them for diagnostic purposes)
2. Client-side MCP call (Trigger 1)
3. EXPO_PUBLIC_* MCP server URL (Trigger 2)
4. MCP token in app/client code (Trigger 3)
5. New taxonomy key (Trigger 4)
6. Display cap change (Trigger 6)
7. New visual primitive or token (Trigger 7)
8. Weakening MCP-021A schema validation (Trigger 8)
9. Automatic production trigger without safety gate (Trigger 12)
10. New package dependency
11. Modification of MCP-021A taxonomy or schema files (except parser-import bridge per parser resolution above)
12. Modification of UX-001.5A presentation model, priority model, components
13. Modification of UX-001.6 cross-device QA test files (byte-equal)
14. Service-role usage in client code (server-side only inside Edge Function)
15. Raw internal key rendered in UI
16. Verdict/winner/correctness/fallacy/bad-faith language in any new copy
17. Realtime subscription for classifier results (future card)

---

## Read-only API boundaries

MCP-021C-EDGE MAY modify (bounded):
- New: Supabase Edge Function + shared server-side modules
- New: migration adding `run_mode` column + index to MCP-021B runs table
- New: ~14 test files
- New: audit template doc
- New: design doc, review doc
- Bounded edit: MCP-021B persistence query OR adapter (filter `run_mode = 'production'`)
- Bounded edit: MCP-021B persistence types (`run_mode` field)
- Bounded edit: `src/features/nodeLabels/index.ts` if new exports needed
- Bounded edit: `docs/core/current-status.md` (handoff section appended)

MCP-021C-EDGE MAY NOT modify:
- All UX-001.{1-7} read-only files outside bounded list
- All UX-001.5A presentation model, priority model, components
- All MCP-021A taxonomy / schema / definition files (except parser-import bridge per resolution above)
- `src/features/nodeLabels/userAllegationRegistry.ts`
- `src/features/nodeLabels/nodeLabelSourceAdapters.ts` (Source 6 is already wired by MCP-021B; the bounded edit per Decision 9 is to the persistence query/adapter, not the Source 6 adapter itself)
- All UX-001.6 cross-device QA test files (byte-equal)
- All MCP-021A test files (byte-equal)
- Existing MCP-021B test files (byte-equal; new MCP-021C tests cover new behavior)
- Existing MCP-021B migration files (the new migration is additive)
- `package.json` / `package-lock.json` (no new deps)

---

## Designer required reading (in order)

1. `docs/designs/MCP-021C-EDGE-intent.md` (this brief)
2. `docs/decisions/MCP-021C-edge-pivot.md`
3. `docs/decisions/MCP-021-sequencing.md`
4. `docs/audits/MCP-021B-persisted-label-smoke-2026-05-26.md`
5. `docs/designs/MCP-021B.md`
6. `docs/designs/MCP-021A.md`
7. `src/features/nodeLabels/mcpBooleanObservationSchema.ts` (parser reused per Decision 6)
8. `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` (16 entries; verify against Decision 3 binding list)
9. `src/features/nodeLabels/machineObservationPersistenceTypes.ts` + `Adapter.ts` + `Query.ts` (MCP-021B persistence path)
10. `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` (MCP-018 adapter pattern reused)
11. All other files under `supabase/functions/_shared/` and `supabase/functions/<semantic-referee-function>/` (existing Edge Function shape)
12. `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql` (MCP-021B base migration)
13. `CLAUDE.md` § Security (server-only secret policy)
14. `cdiscourse-doctrine §7` (no AI calls from production app)
15. `docs/core/current-status.md` MCP-021A/MCP-021B sections
16. The 2026-05-25 bot annotation run logs (motivating signal for live validation need)

---

## Required designer Phase A audits

**Phase A.1 — MCP-018 server-side adapter reuse:**
- Confirm `supabase/functions/_shared/semanticReferee/mcpAdapter.ts` exact file + exported function(s)
- Confirm env var names: `SEMANTIC_REFEREE_MCP_URL`, `SEMANTIC_REFEREE_MCP_TOKEN`
- Confirm whether the adapter can be reused as-is for a new tool (`classify_argument_boolean_observations` or similar) or whether it should be wrapped/extended
- Document file/line citations in design §1

**Phase A.2 — MCP-021B persistence shape verification:**
- Confirm migration file path
- Confirm table names + row types
- Confirm canonical visibility predicate from MCP-021B design Phase A (META-1A pattern; QOL-039 SECURITY DEFINER helpers)
- Confirm service-role write path inside Edge Function

**Phase A.3 — Parser import resolution (binding):**
- Determine which of the 3 outcomes (direct / bridge / server-side copy) is viable
- If outcome 3, design the drift test
- Document in design ledger

**Phase A.4 — Family A registry verification:**
- Read `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`
- Confirm exactly 16 entries
- Confirm the 16 keys match Decision 3 binding list verbatim
- If ≠16 or any key disagrees, HALT (Trigger 18)
- Confirm verbose fields (positiveExamples, negativeExamples, falsePositiveGuards, confidenceEligibility) present on all entries

**Phase A.5 — run_mode migration safety:**
- Verify `argument_machine_observation_runs` table can accept the new column
- Confirm `DEFAULT 'production'` backfills existing rows (smoke seed preserved)
- Confirm new index on `run_mode` is supported
- If migration is unsafe, document and apply Decision 9 fallback

**Phase A.6 — Admin validation trigger mechanism:**
- Decide: Edge Function action field (`mode: 'admin_validation'`), separate route, or CLI wrapper
- Must remain server-side
- Document in design §5

**Phase A.7 — Initial fixture full UUID resolution:**
- Resolve the 3 fixture move UUIDs per Decision 10
- Confirm parent chain reachable for each
- Confirm at least one depth-2+ move exists in seeded rooms; if none, HALT

If ANY trigger fires during Phase A (Triggers 1-15 + 16-18), HALT immediately.

---

## Designer deliverable

Create `docs/designs/MCP-021C-EDGE.md` with required sections:

1. Scope-reality audit (verify MCP-018 adapter + MCP-021A parser + MCP-021B persistence shapes)
2. MCP-018 adapter reuse design (exact reuse pattern; tool call shape)
3. Request shape design (Family A only for production; family-agnostic plumbing)
4. Response validation design (reuse MCP-021A parser per Decision 6 + parser-import resolution)
5. Admin validation mode design (per Decision 4 + 9)
6. Persistence writer design (per Decision 5 + 9)
7. Migration design (run_mode column + index per Decision 9)
8. Source 6 filter design (production-only rendering per Decision 9)
9. Fixture moves (resolved full UUIDs per Decision 10)
10. Test plan (~14 files; aggregate-test pattern)
11. Audit template design (operator-driven EDGE-SMOKE post-merge)
12. Read-only boundary list
13. Conditional HALT trigger table (15 triggers + 3 designer-specific)
14. Brief ledger (parser import outcome; Family A keys verified; fixture UUIDs resolved; migration safety; admin trigger mechanism; production trigger posture)

---

## Brief ledger requirement

MCP-021C-EDGE's design document MUST include a ledger naming:

- Parser import resolution outcome (1 / 2 / 3 per Phase A.3)
- Family A registry verification result (16 keys confirmed verbatim)
- Three fixture move full UUIDs (per Decision 10)
- Migration safety verification (run_mode column applies cleanly)
- Admin trigger mechanism (Edge Function action field / route / CLI)
- Production trigger posture (admin-trigger-only confirmed; auto-trigger deferred)
- Edge Function path (new function vs extending existing)
- MCP-018 adapter reuse strategy (reuse as-is / wrap / extend)
- Operator-deferred review items

---

## Post-merge operator follow-up (NOT part of the pipeline)

After MCP-021C-EDGE merges, the operator runs EDGE-SMOKE:

1. Deploy Edge Function to the linked Supabase project:
   `npx supabase functions deploy classify-argument-boolean-observations --linked`

2. Verify Supabase function secrets are set:
   `npx supabase secrets list --linked | grep SEMANTIC_REFEREE_MCP`
   Expected: `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN` present. If absent, set them:
   `npx supabase secrets set SEMANTIC_REFEREE_MCP_URL=https://... --linked`
   `npx supabase secrets set SEMANTIC_REFEREE_MCP_TOKEN=... --linked`

3. Run admin validation mode against the 3 fixture moves:
   ```
   curl -X POST https://<project>.supabase.co/functions/v1/classify-argument-boolean-observations \
     -H "Authorization: Bearer <admin-jwt>" \
     -H "Content-Type: application/json" \
     -d '{
       "argumentIds": ["<arg1-full-uuid>", "<arg2-full-uuid>", "<arg3-full-uuid>"],
       "requestedFamilies": ["parent_relation"],
       "mode": "admin_validation",
       "schemaVersion": "mcp-021.machine-observations.boolean.v1"
     }'
   ```

4. Query the resulting run rows:
   ```sql
   SELECT id, argument_id, run_mode, status, requested_families, failure_reason, completed_at
   FROM public.argument_machine_observation_runs
   WHERE run_mode = 'admin_validation'
   ORDER BY started_at DESC
   LIMIT 10;
   ```

5. Inspect positive result rows:
   ```sql
   SELECT r.argument_id, r.raw_key, r.family, r.confidence, r.evidence_span
   FROM public.argument_machine_observation_results r
   JOIN public.argument_machine_observation_runs run ON run.id = r.run_id
   WHERE run.run_mode = 'admin_validation'
     AND run.argument_id IN ('<arg1-full-uuid>', '<arg2-full-uuid>', '<arg3-full-uuid>')
   ORDER BY r.argument_id, r.raw_key;
   ```

6. Verify Source 6 does NOT render admin-validation rows in the UI:
   - Navigate to one of the fixture arguments in the app
   - Confirm no new Machine Observation chips appear from the admin validation run
   - (The 9 production-mode smoke seed rows from MCP-021B still render)

7. Record results in `docs/audits/MCP-021C-EDGE-admin-validation-<date>.md` using the committed template.

8. Verdict:
   - **PASS** (1+ of 3 moves validates with positive result rows OR clean failure_reason): MCP-021C-FAMILY-B is authorized to file
   - **FAIL** (0 of 3 moves validate; systematic schema failure): file MCP-021C-EDGE-FIX scoped to the specific defect

The pipeline does NOT auto-run the live EDGE-SMOKE — that requires operator credentials and a deployed Edge Function.
