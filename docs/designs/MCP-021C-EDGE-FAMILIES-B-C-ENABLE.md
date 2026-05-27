# MCP-021C-EDGE-FAMILIES-B-C-ENABLE — production-mode flip for Families B + C

**Status:** Design draft — **HALT trigger 4 fires; scope-reality finding requires operator decision before implementation**
**Epic:** MCP — production-mode enablement for shipped families
**Release:** Card 1 of the 2-card flip + Family D batch (per intent brief §12)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/328
**Predecessor:** `OPS-MCP-IDEMPOTENCY-HARDENING` at `1624f6b` (Q9 classification semantics)
**Intent brief:** `docs/designs/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-intent.md` (orchestrator-authored)

---

## 0. Cannot proceed as scoped — HALT trigger 4 finding (binding)

The intent brief §2 states:

> "The auto-trigger dispatcher at `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` **derives families from the Edge family registry** (verified at Phase 0). If the auto-trigger is registry-derived, the production flip automatically extends auto-trigger to Families B + C."

Phase A.2 source audit (this document §3) finds this assumption **empirically incorrect**. The dispatcher is hard-coded to a single-element `['parent_relation']` constant, and the MCP server resolves a single family per call. A 2-boolean flip in `familyRegistry.ts` alone WILL NOT extend auto-trigger to Families B + C. The smoke plan §11 Phase 2 expectation ("3 new runs (one per family) for the new argument_id") is therefore **not achievable with the brief's stated 1-file edit**.

Per intent brief §2 (line 53–54):

> "If the auto-trigger is hard-coded to Family A only, designer surfaces as HALT trigger 4 (auto-trigger dispatcher change beyond registry-derived path)."

HALT trigger 4 is hereby surfaced. The remainder of this design document enumerates every Phase A finding, the read-only boundary list, and a recommended scope correction the operator can act on. **No edits to source files are proposed by this design until the operator chooses a path forward.**

The recommended scope correction (this document §10) is to extend Card 1 to also edit `autoTriggerDispatcher.ts` so that `AUTO_TRIGGER_FAMILIES` derives from `productionEnabledFamilies()` and the dispatcher loops once per eligible family — a small, registry-derived change that aligns the source with the brief's §2 stated assumption rather than going "beyond" registry-derived.

---

## 1. Goal (one paragraph)

Make Families B (`disagreement_axis`, 14 keys) and C (`misunderstanding_repair`, 17 keys) production-mode-eligible at the Edge Function so they (a) produce `run_mode='production'` rows that Source 6 surfaces in the production UI for node-label rendering, and (b) auto-trigger on every newly inserted argument alongside Family A's existing 16-key auto-trigger. Admin-validation continues to operate for all 10 families. This card builds on `MCP-SERVER-003-FAMILY-B` (Family B classifier live on hosted MCP) and `MCP-SERVER-004-FAMILY-C` (Family C classifier live on hosted MCP). It is the production cutover for those two already-shipped admin-validation-only classifiers.

Doctrine anchors:
- **cdiscourse-doctrine §1, §10a** — `run_mode` and `productionEnabled` discriminate purpose/routing; never quality, never participant judgment.
- **cdiscourse-doctrine §4** — Family B's `disputes_value_weighting` (doctrine-risk key) and Family C's `clarified` lifecycle guard continue to operate as structural observations only; production-mode enablement does not weaken either guard (they live in MCP-server prompts, not in `familyRegistry.ts`).
- **cdiscourse-doctrine §7** — Anthropic calls remain server-side (MCP server). No production-app AI call introduced.

---

## 2. Phase A.1 — Edge familyRegistry current state

File: `supabase/functions/_shared/booleanObservations/familyRegistry.ts`

Current state at this design's HEAD (`5a88f7c`):

| Line | Family | productionEnabled | adminValidationEnabled |
|---|---|---|---|
| 63–67 | `parent_relation` (A) | `true` | `true` |
| **68–72** | **`disagreement_axis` (B)** | **`false`** | **`true`** |
| **73–77** | **`misunderstanding_repair` (C)** | **`false`** | **`true`** |
| 78–82 | `evidence_source_chain` (D) | `false` | `true` |
| 83–87 | `argument_scheme` (E) | `false` | `true` |
| 88–92 | `critical_question` (F) | `false` | `true` |
| 93–97 | `resolution_progress` (G) | `false` | `true` |
| 98–102 | `claim_clarity` (H) | `false` | `true` |
| 103–107 | `thread_topology` (I) | `false` | `true` |
| 108–112 | `sensitive_composer` (J) | `false` | `true` |

The registry is `Object.freeze`d on line 62 and exposes `lookupFamilyRegistryEntry`, `filterFamiliesForMode`, `productionEnabledFamilies`, and `adminValidationEnabledFamilies`. The pure-TS helper module shape is unchanged since `MCP-021C-EDGE` ship — no schema or signature change is required by this card. **Phase A.1 = PASS.**

---

## 3. Phase A.2 — Auto-trigger pattern verification (HALT trigger 4 evidence)

File 1: `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`

```ts
// Lines 63–69 of the current source (verbatim):

/** The dispatcher always invokes the classifier with this family list. */
const AUTO_TRIGGER_FAMILIES: ReadonlyArray<MachineObservationFamily> = Object.freeze([
  'parent_relation',
]);

/** Production-mode literal. The dispatcher never runs admin_validation. */
const AUTO_TRIGGER_MODE = 'production' as const;
```

This is a **hard-coded literal** — NOT a call to `productionEnabledFamilies()` or any registry-derived helper. The constant is then passed to `filterFamiliesForMode(AUTO_TRIGGER_FAMILIES, AUTO_TRIGGER_MODE)` on line 214, which returns `['parent_relation']` (because Family A is `productionEnabled: true`). Flipping B + C to `productionEnabled: true` in the registry has **zero effect** on this dispatcher's behavior because `AUTO_TRIGGER_FAMILIES` is the INPUT, not derived from registry state.

Additionally, line 148 of the same file:

```ts
.contains('requested_families', ['parent_relation'])
```

The idempotency `findExistingRun` query is also hard-coded to `'parent_relation'`. Re-running it for B + C arguments would require either (a) parameterizing the family in the query, or (b) running 3 separate idempotency queries per dispatcher invocation.

File 2: `supabase/functions/submit-argument/index.ts`

Lines 787–794 (verbatim):

```ts
const autoTriggerPromise = dispatchAutoTriggerForArgument(
  insertedArg.id,
  data.debate_id,
  serviceClient,
).catch(() => undefined);
if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime?.waitUntil === 'function') {
  EdgeRuntime.waitUntil(autoTriggerPromise);
}
```

The call site is correct (fire-and-forget with `EdgeRuntime.waitUntil`); the dispatcher contract is `(argumentId, debateId, serviceClient) → Promise<AutoTriggerOutcome>`. The dispatcher signature itself does not need to change. What needs to change is what the dispatcher does internally with the registry.

File 3: `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts`

The `classifyOneArgumentCore(...)` orchestrator (lines 175–359) takes a `requestedFamilies` array and:

- Filters via `filterFamiliesForMode(requestedFamilies, mode)` (line 201)
- Builds ONE MCP request with the full array (line 204–212)
- Invokes the adapter ONCE (line 223: `await adapter(mcpRequest)`)
- Persists ONE run row with the family array in `requested_families` (line 259–272)

File 4: `mcp-server/tools/classifyArgumentBooleanObservations.ts`

Lines 297–305 (verbatim):

```ts
// Step 2: resolve which family this request targets. Per design §7, when
// requestedFamilies is non-empty we route to the first entry; when empty,
// the byte-equal-preservation default routes to 'parent_relation' (the
// validator already gated rawKey membership against this same default).
const resolvedFamily: string =
  request.requestedFamilies.length > 0
    ? request.requestedFamilies[0]
    : 'parent_relation';
const providers = pickFamilyProviders(resolvedFamily);
```

**The MCP server resolves a SINGLE family per call (the first entry of `requestedFamilies`).** Passing `['parent_relation', 'disagreement_axis', 'misunderstanding_repair']` would result in ONLY Family A being classified, with B and C silently dropped.

### Phase A.2 verdict

**The auto-trigger is NOT registry-derived.** The hard-coded `['parent_relation']` constant is the INPUT; the registry-derived filter happens downstream but cannot widen what isn't in the input. Combined with the MCP server's single-family-per-call resolution, the only way to produce 3 runs per argument (smoke plan §11 Phase 2's success criterion) is to:

1. Make `AUTO_TRIGGER_FAMILIES` derive from `productionEnabledFamilies()`, AND
2. Loop the dispatcher over each eligible family with a separate `classifyOneArgumentCore` call per family, AND
3. Adjust `findExistingRun` to query per-family rather than against a hard-coded array.

This is materially more than the brief's "2 boolean flips" scope. **HALT trigger 4 fires.**

Reference: existing test `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` explicitly asserts the current single-family hard-coded posture:

- **TRG-11**: "dispatcher hard-codes requestedFamilies = ['parent_relation'] (no external input)"
- **TRG-18**: scans dispatcher source and asserts NO `'disagreement_axis'` or `'misunderstanding_repair'` literal appears
- **TRG-19**: asserts dispatcher uses `AUTO_TRIGGER_FAMILIES` const + `AUTO_TRIGGER_MODE` const + the existing adapter

These tests will FAIL the moment the dispatcher is extended. The implementer would need to either rewrite TRG-11, TRG-18, TRG-19 (to assert registry-derived semantics) or carry a new test file that supersedes them. This is implementer territory but documenting the test-set impact here is part of Phase A.5.

---

## 4. Phase A.3 — Source 6 rendering compatibility

File 1: `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`

```ts
.eq('argument_machine_observation_runs.run_mode', 'production')
```

The filter operates on `run_mode`, NOT on `family`. Production-mode rows from Families B and C will pass this filter the moment they are written. **Filter is byte-equal preserved; no change needed.** (Honors HALT trigger 5: "Source 6 filter change.")

File 2: `src/features/nodeLabels/machineObservationPersistenceAdapter.ts:142–143`

```ts
const definition = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[row.rawKey];
if (!definition) continue;
```

The renderer looks up each `raw_key` in the unified `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY` registry. Unknown `raw_key`s are dropped SILENTLY (line 143). No hard-coded allowlist; no family-specific gate.

File 3: `src/features/nodeLabels/machineObservationDefinitions.ts`

The 171-entry parallel registry already includes:
- Family A — `parent_relation` (16 entries)
- **Family B — `disagreement_axis` (14 entries)**
- **Family C — `misunderstanding_repair` (17 entries)**
- Family D–J — already registered (admin_validation runs surface these in operator audit pipelines today)

Family B and Family C raw_keys are already present in `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY` (the registry was populated to support admin-validation rendering, even though Source 6 does not currently surface admin-validation rows). The lookup table is multi-family-ready.

File 4: `src/features/nodeLabels/nodeLabelSourceAdapters.ts`

`adaptRawClassifierBinarySource` (line 343–357) takes pre-fetched persisted rows and delegates to the adapter. No family-specific logic.

### Phase A.3 verdict

**The renderer is registry-driven and multi-family-ready.** Family A's 16 keys already render through `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY`; the same lookup will resolve Family B's 14 keys and Family C's 17 keys with no source change. No HALT trigger fires. **Phase A.3 = PASS.**

---

## 5. Phase A.4 — Persistence path verification

File 1: `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`

```sql
-- runs table — line 78–95:
CREATE TABLE IF NOT EXISTS public.argument_machine_observation_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
  requested_families  text[]      NOT NULL DEFAULT '{}',
  ...
);

-- results table — line 99–118:
CREATE TABLE IF NOT EXISTS public.argument_machine_observation_results (
  ...
  raw_key         text        NOT NULL,
  family          text        NOT NULL,
  ...
  CONSTRAINT amor_unique_run_rawkey UNIQUE (run_id, raw_key)
);
```

Key facts:

1. **`family` is freeform `text NOT NULL`** — no CHECK constraint limits values. Accepts `disagreement_axis` and `misunderstanding_repair` as-is.
2. **`requested_families` is `text[]`** — accepts any array of strings, multi-family-ready by construction.
3. **`UNIQUE (run_id, raw_key)`** — scoped per run. If 3 family runs produce 3 separate `run_id`s, no UNIQUE collision is possible across families. (If a single run held all 3 families' raw_keys in one row — which is NOT the architecture per Phase A.2 — there would still be no collision because no raw_key appears in more than one family in MCP-021A.)

File 2: `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql`

```sql
ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS run_mode text NOT NULL DEFAULT 'production'
  CHECK (run_mode IN ('production', 'admin_validation'));
```

Both `production` and `admin_validation` are permitted; the 9 backfill MCP-021B smoke-seed rows defaulted to `production`. No schema change needed for this card.

### Phase A.4 verdict

**No persistence-layer constraint blocks 3-family writes.** Whether the runtime produces 1 run row with multi-family array (currently impossible per Phase A.2 §4 because MCP server resolves single-family) OR 3 run rows (one per family — the only architecture that achieves the smoke plan's contract), neither hits a UNIQUE collision, CHECK constraint, or shape mismatch. RLS policies (`amor_runs_select_via_argument` and `amor_results_select_via_run`) inherit visibility from `public.arguments` and are family-agnostic. **Phase A.4 = PASS.**

---

## 6. Phase A.5 — Test plan

### Estimated test forecast: **+30 to +45 tests** if the scope correction in §10 is approved.

If ONLY the 2-boolean flip ships (no dispatcher edit), the forecast is **+10 to +14** assertion-only updates and the smoke plan §11 Phase 2 ("3 new runs per argument") cannot pass. The detailed enumeration below assumes the scope correction.

### Test surface placement

The existing `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` carries 23 FR-* assertions, several of which assume Family-A-only production posture and must be updated. The existing `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` carries 25 TRG-* assertions, several of which hard-code Family A as the only auto-trigger family.

**Recommended placement:**

1. **Extend `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts`** to reflect the post-flip state. Update FR-5, FR-6, FR-7, FR-15, FR-16. Add new FR-24…FR-30 covering the 3-family production posture explicitly.
2. **Extend `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts`** OR create a new `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABC.test.ts` that supersedes the single-family assertions. Update TRG-11, TRG-18, TRG-19. Add new TRG-26…TRG-35 covering the registry-derived dispatcher loop.
3. **New `__tests__/edgeFamilyRegistryProductionFlip.test.ts`** is NOT recommended — the existing file's FR-* numbering should be preserved; adding parallel files fragments the source-of-truth.

### Per-file test count forecast

| File | Update / New | Test count delta |
|---|---|---|
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | Extend (5 updated + 7 new) | +7 net (FR-24..FR-30; FR-5/6/7/15/16 reshaped but stay numerically same) |
| `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` | Extend (3 updated + 10 new) | +10 net (TRG-26..TRG-35; TRG-11/18/19 reshaped) |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | **NEW** | +10 (registry-derived semantics, loop-once-per-family, idempotency-per-family pre-check) |
| `__tests__/mcpOneTwoOneCAutoTriggerSourceSixRendering.test.ts` | Extend (1 new assertion) | +1 (Family B + C rows surface through Source 6 the same way Family A does) |
| `__tests__/mcpOneTwoOneCAutoTriggerIdempotency.test.ts` | Extend (2 new assertions) | +2 (per-family idempotency pre-check; benign double-write across families) |
| **Total** | | **+30 tests** |

If the implementer adds a third "binding-payload-per-family" source-scan test set (similar to TRG-18's ban-list), the count could land closer to +45. HALT trigger 14 threshold is +100; +30–45 lands well inside the brief's +20-to-+50 band.

### Test case enumeration

**A — Registry assertion updates (existing file `mcpOneTwoOneCEdgeFamilyRegistry.test.ts`):**

- **FR-5 (updated):** "only parent_relation, disagreement_axis, AND misunderstanding_repair have productionEnabled: true" — replaces the current single-family assertion.
- **FR-6 (updated):** `edgeProductionEnabledFamilies()` returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair']` (exact order matches the registry iteration order).
- **FR-7 (updated):** "every NON-parent_relation/disagreement_axis/misunderstanding_repair family is productionEnabled: false" — replaces the current single-family assertion.
- **FR-15 (updated):** `filter([parent_relation, disagreement_axis], production)` returns `['parent_relation', 'disagreement_axis']`.
- **FR-16 (updated):** `filter(allFamilies, production)` returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair']`.
- **FR-24 (new):** `filter([disagreement_axis], production)` returns `['disagreement_axis']`.
- **FR-25 (new):** `filter([misunderstanding_repair], production)` returns `['misunderstanding_repair']`.
- **FR-26 (new):** `filter([evidence_source_chain], production)` returns `[]` (D still admin-only).
- **FR-27 (new):** `lookupFamilyRegistryEntry('disagreement_axis')` returns `{productionEnabled: true, adminValidationEnabled: true}`.
- **FR-28 (new):** `lookupFamilyRegistryEntry('misunderstanding_repair')` returns `{productionEnabled: true, adminValidationEnabled: true}`.
- **FR-29 (new):** registry order is unchanged (A→J).
- **FR-30 (new):** `Object.isFrozen(EDGE_FAMILY_REGISTRY)` still true post-flip.

**B — Dispatcher source-scan updates (existing file `mcpOneTwoOneCAutoTriggerFamilyA.test.ts`):**

- **TRG-11 (updated):** "dispatcher derives requestedFamilies from productionEnabledFamilies()" — replaces hard-coded literal assertion.
- **TRG-18 (updated):** dispatcher source MAY contain `'disagreement_axis'` and `'misunderstanding_repair'` LITERALS (allow-list pattern), OR (preferred) dispatcher source contains NO family literals at all and derives entirely from registry.
- **TRG-19 (updated):** dispatcher loops over `productionEnabledFamilies()`, calling `classifyOneArgumentCore(...)` once per family.

**C — New registry-derived dispatcher tests (new file `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts`):**

- **D1:** dispatcher imports `productionEnabledFamilies` from `familyRegistry.ts`.
- **D2:** dispatcher does not declare an `AUTO_TRIGGER_FAMILIES` literal const (or, if it does, the const is computed from `productionEnabledFamilies()`).
- **D3:** dispatcher source contains a loop (`for…of` / `for…each` / `Promise.all` over the family list).
- **D4:** each iteration calls `classifyOneArgumentCore` with EXACTLY ONE family (per the MCP server's single-family-per-call resolution).
- **D5:** `findExistingRun` is parameterized by family (no hard-coded `['parent_relation']` array).
- **D6:** each per-family iteration's outcome is logged via `emitAutoTriggerLog` with the family tag.
- **D7:** `AutoTriggerOutcome` shape extends to multi-family — either a per-family outcome list or a top-level summary.
- **D8:** dispatcher continues to never throw (catch-all preserved).
- **D9:** ban-list scan extended over the new source (no verdict tokens introduced).
- **D10:** no `console.log` introduced.

**D — Source 6 rendering (existing file `mcpOneTwoOneCAutoTriggerSourceSixRendering.test.ts`):**

- **SR-N1:** persisted Family B + C production rows pass through `mapPersistedObservationRowsToNodeLabelMarks` and produce `NodeLabelMark`s with the correct registry-sourced `label` / `description` (no raw `raw_key` echoed in user-facing copy).

**E — Idempotency (existing file `mcpOneTwoOneCAutoTriggerIdempotency.test.ts`):**

- **IDM-N1:** `findExistingRun` query is per-family-scoped; A's prior run does NOT make B's or C's first run skip.
- **IDM-N2:** Two dispatcher invocations on the same argument result in 6 run rows (3 per invocation) with benign duplicate raw_keys (Source 6 dedupes by raw_key per the documented Phase 4.1 invariance).

### Test files NOT touched

- `__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts` — failure-mode tests are family-agnostic; no edit needed unless the loop introduces a new failure class.
- `__tests__/mcpOneTwoOneCAutoTriggerSecurityBoundary.test.ts` — security boundary is family-agnostic.
- `mcp-server/tests/**` — out of scope (hard rule from intent brief: no mcp-server changes).
- `__tests__/opsMcp*` — out of scope (Q9/Q11/Q12 observability is post-merge smoke surface, not pre-merge gate).

---

## 7. Data model

**No new data model.** No migration. No new column. No new RLS policy. No new helper function.

The 2 booleans in `familyRegistry.ts` are pre-existing struct fields. The persistence layer was multi-family-ready from MCP-021B (Phase A.4 §5).

---

## 8. File changes

### If the scope correction in §10 is approved (RECOMMENDED):

**Modified files:**

| File | Lines changed | Purpose |
|---|---|---|
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | 2 (lines 70 + 75: `false` → `true`) | The two-boolean flip per intent brief §1 |
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | ~40 lines (lines 63–66 + 137–156 + 187–342 wrapped in family loop) | Registry-derived families + per-family loop + per-family idempotency |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | ~30 lines (5 updated + 7 new FR-*) | Reflect 3-family production posture |
| `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` | ~20 lines (3 updated TRG-*) | Reflect registry-derived dispatcher posture |

**New files:**

| File | Estimated lines | Purpose |
|---|---|---|
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | ~250 | Asserts the registry-derived dispatcher loop semantics |

**Deleted files:** None.

### If ONLY the 2-boolean flip ships (NOT RECOMMENDED — smoke plan §11 Phase 2 cannot pass):

**Modified files:**

| File | Lines changed | Purpose |
|---|---|---|
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | 2 (lines 70 + 75: `false` → `true`) | Per intent brief §1 |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | ~30 lines (5 updated + 7 new FR-*) | Reflect 3-family production posture |

In this case the auto-trigger remains Family-A-only post-merge. Source 6 will surface production rows for B + C only when an operator manually runs `admin_validation`-style calls with `runMode: 'production'` via a separate endpoint (which is NOT currently wired — the Edge function defaults to admin-gated). This is a meaningful state change (the registry permits B + C production) but is not user-visible without manual classifier invocation. The smoke plan Phase 2 cannot pass; Phase 4 (Q11 observability) would show no B/C production rows.

---

## 9. API / interface contracts

**No new exports.** `familyRegistry.ts` continues to export `FAMILY_REGISTRY`, `lookupFamilyRegistryEntry`, `filterFamiliesForMode`, `productionEnabledFamilies`, `adminValidationEnabledFamilies` with byte-equal signatures.

If §10 scope correction is approved, `autoTriggerDispatcher.ts`'s public function `dispatchAutoTriggerForArgument(argumentId, debateId, serviceClient): Promise<AutoTriggerOutcome>` keeps the same signature. `AutoTriggerOutcome` may grow a per-family detail field or be wrapped in a multi-outcome summary type — the implementer chooses. The `submit-argument` call site does not need to change.

**Edge Function HTTP contract:** unchanged. The `classify-argument-boolean-observations` endpoint's admin gate, JSON-RPC envelope, and response shape are preserved. Operators continue to invoke `admin_validation` for any of the 10 families.

**MCP server contract:** unchanged. The hosted MCP server's single-family-per-call resolution is left in place; the Edge dispatcher adapts to it by calling once per family rather than passing a multi-family array.

---

## 10. Recommended scope correction (operator decision required)

Per the scope-reality audit rule (CLAUDE.md POSTRUN-UX001 lesson), the orchestrator-authored brief assumed a registry-derived dispatcher that does not exist in source. The minimum change set to honor both the brief's stated §2 expectation AND the §11 Phase 2 smoke-plan success criterion is:

### Recommended scope expansion

Add to Card 1's edit scope:

```
supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts
```

with these specific changes:

1. **Lines 63–66 (current):**
   ```ts
   const AUTO_TRIGGER_FAMILIES: ReadonlyArray<MachineObservationFamily> = Object.freeze([
     'parent_relation',
   ]);
   ```
   **Becomes:**
   ```ts
   // Registry-derived: every family with productionEnabled: true gets auto-triggered.
   // Pure function call; no hard-coded family literals.
   import { productionEnabledFamilies } from './familyRegistry.ts';
   // (called inline at the dispatch site — NOT captured at module load —
   // so a runtime registry change would take effect on next dispatcher invocation;
   // this also keeps the test surface deterministic per the existing pattern.)
   ```

2. **Lines 135–156 (`findExistingRun`):** parameterize the family in the query, so the function takes `(argumentId, family, serviceClient)` and the `.contains('requested_families', [family])` argument is built from the parameter rather than hard-coded.

3. **Lines 187–342 (`dispatchAutoTriggerForArgument`):** wrap the dispatch loop (Guard 3 + bounded retry) in a `for-of` loop over `productionEnabledFamilies()`. Each iteration produces its own `AutoTriggerOutcome`-shaped object; the function's top-level return becomes either an array of outcomes or an aggregated outcome record.

4. **Logging:** each `emitAutoTriggerLog` call carries the `family` tag so observability (`Q10`) can break down per-family success rates.

### Why this is "registry-derived" and NOT "beyond" registry-derived (HALT trigger 4 boundary clarification)

HALT trigger 4 reads: "Auto-trigger dispatcher change **beyond** the registry-derived path." The proposed change MAKES the dispatcher registry-derived. It does not add a side-channel, hard-code a non-registry-sourced list, or introduce a new gate beyond the registry. The boundary is preserved: the dispatcher's family list source is `productionEnabledFamilies()`, which is THE registry. A hypothetical "beyond" change would be adding (e.g.) a hard-coded retry-list, a non-registry env var, or a feature-flag override — none of which is proposed.

### Operator decision needed

The intent brief authored the card as "2-boolean flip." Reality requires "2-boolean flip + dispatcher loop." The operator must explicitly authorize the scope expansion (or accept that smoke plan Phase 2 will fail). Options:

- **Option A (RECOMMENDED):** Approve the scope expansion. Card 1 ships with both edits; ~30 tests; smoke plan §11 Phase 2 PASS achievable.
- **Option B:** Ship only the 2-boolean flip; defer dispatcher loop to a separate card (`MCP-021C-AUTO-TRIGGER-FAMILY-B-C-EXTEND`). Card 1 ships clean with ~10 test updates; smoke plan §11 Phase 2 will fail; another design+implement+review cycle is needed.
- **Option C:** Revise the intent brief to explicitly drop the "auto-trigger extends to B+C" expectation and reframe Card 1 as "registry permits B+C production but does not auto-trigger them." Source 6 would surface B/C production rows only via operator-manual invocation; Phase 4 Q11 would not show new B/C production runs from auto-trigger.

No source edit is proposed by this design until the operator chooses.

---

## 11. Edge cases

**If scope correction in §10 is approved:**

- **Empty `productionEnabledFamilies()`:** dispatcher loops zero times, returns "skipped" with reason `'family_not_enabled'` for the outer envelope. Should never happen post-merge because Family A stays `productionEnabled: true` (HALT trigger 2 gate).
- **One family fails mid-loop, others succeed:** outcome envelope reports per-family status; the failure of one family must NOT abort the loop for others. The bounded retry (`MAX_ATTEMPTS = 2`) applies per family.
- **Idempotency across families:** A successful Family A run for argument X must NOT block Family B's first run for argument X. `findExistingRun` MUST be family-scoped (item 2 in §10's change set).
- **Race-tolerance:** the existing Family A audit Phase 6 invariance (Source 6 dedupes by raw_key per argument) is maintained because Family A keys, Family B keys, and Family C keys are pairwise disjoint (MCP-021A registry §3 — no shared raw_keys across families). The UNIQUE constraint `amor_unique_run_rawkey` is scoped per `run_id`, so 3 family runs produce 3 distinct UNIQUE scopes.
- **Family A regression:** Family A auto-trigger continues to fire post-merge. The HALT 13 ("Family A auto-trigger still works post-merge is existential") is enforced by the registry — A's `productionEnabled: true` line is unchanged.
- **`semantic_referee_runtime_config.enabled = false`:** still skips ALL auto-trigger (the existing Guard 1 at line 194–211 fires before the family loop). No per-family carve-out; one config kill switch governs all.

**If ONLY 2-boolean flip ships:**

- **Family A continues unchanged** — the only path that exists for production-mode runs.
- **B + C admin-validation continues unchanged** — operators continue to invoke explicitly.
- **B + C production rows do not appear** in the database until something else triggers them (manual call, future card, etc.).
- **Smoke plan Phase 2 will fail.** Phase 4 Q11 will show no B/C production-mode rows.

---

## 12. Test plan (delegated to §6)

Forecast: **+30 to +45 tests** (if §10 scope correction approved) OR **+10 to +14 tests** (if 2-boolean flip only).

Test files and per-file counts are enumerated in §6. The total stays inside the brief's +20-to-+50 forecast band for the recommended scope, and well inside HALT trigger 14's +100 ceiling.

---

## 13. Dependencies (cards / docs / files)

- **This design assumes** `MCP-SERVER-003-FAMILY-B` is complete (Family B hosted MCP classifier live; confirmed at audit `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md`).
- **This design assumes** `MCP-SERVER-004-FAMILY-C` is complete (Family C hosted MCP classifier live; confirmed at audit `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-2026-05-27.md`).
- **This design assumes** `MCP-021C-AUTO-TRIGGER-FAMILY-A` is complete (Family A auto-trigger live; confirmed at audit `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-2026-05-26.md`).
- **Reads existing** `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (lines 62–113 unchanged structure).
- **Reads existing** `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` (lines 63–342 — full file touched if §10 approved).
- **Reads existing** `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` (no edit; the orchestrator path is preserved).
- **Reads existing** `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` (byte-equal preserved).
- **Reads existing** `mcp-server/tools/classifyArgumentBooleanObservations.ts` (no edit; single-family-per-call routing preserved).
- **Reads existing** `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql` (no edit; persistence layer multi-family-ready).
- **Reads existing** `supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql` (no edit).
- **Will block** `MCP-SERVER-005-FAMILY-D` (next card in the brief's §12 sequence) — Family D's production cutover follows the same pattern and inherits whichever §10 path is chosen.

---

## 14. Risks

- **HALT trigger 4 surfaced (this design's §0 / §3) is the primary risk.** Operator must explicitly resolve before implementation. The reviewer should not approve a PR that goes "beyond registry-derived" without an operator decision recorded in the intent brief or its successor.
- **Cross-family test entanglement:** `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` TRG-18 asserts the dispatcher source contains NO Family B/C/D-J literals. The §10 scope correction would need to either rewrite TRG-18 to pattern-allow registry-derived family iteration OR (preferred) rewrite the dispatcher to contain NO family literals at all (derive everything from `productionEnabledFamilies()`). The latter is cleaner.
- **Smoke plan Phase 6 (idempotency observability) interaction:** if the §10 scope expansion lands, Q9 may transiently surface new `audit_or_smoke_rerun` patterns as 3-family runs go through the dispatcher's idempotency pre-check. The `OPS-MCP-IDEMPOTENCY-HARDENING` Q9 classification semantics (Cause C path) absorb this cleanly — the brief's §6 expectation holds.
- **Family A regression risk: nil.** Family A is at the top of `productionEnabledFamilies()`, runs first in the loop, and its existing tests are byte-equal preserved by the implementation strategy. HALT trigger 13 is honored.
- **Race condition on multi-family loop:** if the dispatcher uses `Promise.all` to parallelize the per-family calls, the 3 families fire in parallel — faster, but requires care that `findExistingRun`'s SELECT-then-INSERT pattern doesn't double-write within a single argument. The existing race-tolerance documentation (lines 41–48 of `autoTriggerDispatcher.ts`) says "Source 6 dedupes by raw_key per argument" — which holds because the 3 families' raw_keys are pairwise disjoint. Implementer should prefer sequential `for-of` for simpler reasoning, or document the parallelism choice in the dispatcher header.
- **Deno-only modules:** `autoTriggerDispatcher.ts` is Deno-only; Jest cannot execute it. The new test file `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` MUST follow the source-scan pattern (`fs.readFileSync` + regex / substring assertions) established by `mcpOneTwoOneCAutoTriggerFamilyA.test.ts`. The pure-TS `familyRegistry.ts` IS Jest-loadable via the `_helpers/booleanObservationEdgeDeno.ts` bridge.

---

## 15. Out of scope

Per intent brief §7 (explicitly enumerated), and reconfirmed by this design:

- Family D/E/F/G/H/I/J registration or production-mode enablement (Family D is the next card).
- New taxonomy keys.
- Prompt changes for Family A / B / C (the existing prompts on the hosted MCP server are byte-equal preserved).
- Hosted MCP server file changes (`mcp-server/**` is read-only territory for this card).
- Persistence schema changes.
- Source 6 filter changes (`machineObservationPersistenceQuery.ts:127` byte-equal preserved).
- UI / renderer changes (renderer is multi-family-ready per Phase A.3).
- New Edge Function endpoints.

Additional out-of-scope items surfaced by this design:

- MCP server's single-family-per-call routing (the Edge dispatcher adapts to it; the MCP server is not changed).
- Family A's existing prompt, classifier set, and admin-gate behavior.
- `semantic_referee_runtime_config` table or its RPC — the kill switch continues to work as-is.
- Observability Q9/Q10/Q11/Q12 surface — read at smoke time only; not edited at card time.

---

## 16. Read-only boundary list (locked files)

The following files MUST NOT be edited by the implementer for this card:

1. `mcp-server/**` — every file under this tree (hard rule from intent brief §7 + HALT trigger 10).
2. `src/features/nodeLabels/machineObservationPersistenceQuery.ts` — byte-equal preserved (HALT trigger 5).
3. `src/features/nodeLabels/machineObservationPersistenceAdapter.ts` — byte-equal preserved.
4. `src/features/nodeLabels/machineObservationDefinitions.ts` and `src/features/nodeLabels/machineObservationDefinitions/family*.ts` — byte-equal preserved.
5. `src/features/nodeLabels/nodeLabelSourceAdapters.ts` — byte-equal preserved.
6. `src/features/nodeLabels/mcpBooleanObservationSchema.ts` — byte-equal preserved (HALT trigger 8: MCP schema version change).
7. `supabase/migrations/**` — no new migration; no edit to existing migrations (HALT trigger 6).
8. `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` — orchestrator path preserved.
9. `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts` — fetch path preserved.
10. `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts` — pure helper preserved.
11. `supabase/functions/_shared/booleanObservations/persistenceWriter.ts` — write path preserved.
12. `supabase/functions/submit-argument/index.ts` — call site preserved (HALT trigger 4 boundary: dispatcher SIGNATURE is preserved; the call site does not change).
13. `supabase/functions/classify-argument-boolean-observations/index.ts` — admin-gated HTTP endpoint preserved.
14. `scripts/ops/mcp-observability-report.mjs` and any other ops scripts — out of scope.
15. `__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts` — family-agnostic; preserve.
16. `__tests__/mcpOneTwoOneCAutoTriggerSecurityBoundary.test.ts` — family-agnostic; preserve.
17. Every test file matching `__tests__/opsMcp*.test.ts` — not pre-merge gate territory.
18. `.env*`, `supabase/config.toml`, `supabase/config.local.toml` — operator territory.

### Files this card MAY edit (recommended scope, §10 approved)

1. `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — exact 2-boolean flip per intent brief §1.
2. `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` — registry-derived family list + per-family loop + per-family idempotency. ~40 line touch.
3. `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` — FR-* extensions.
4. `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` — TRG-* updates.
5. `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` — NEW.
6. `__tests__/mcpOneTwoOneCAutoTriggerSourceSixRendering.test.ts` — SR-N1.
7. `__tests__/mcpOneTwoOneCAutoTriggerIdempotency.test.ts` — IDM-N1, IDM-N2.

### Files this card MAY edit (2-boolean-only scope, §10 NOT approved)

1. `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — exact 2-boolean flip.
2. `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` — FR-* updates.

---

## 17. HALT trigger table (all 18 evaluated)

| # | Trigger | Evaluation at design time | Status |
|---|---|---|---|
| 1 | `familyRegistry.ts` edit affects family other than B + C | The 2 booleans flipped are exactly B + C entries (lines 70 + 75). No other family touched. | **CLEAR** |
| 2 | `familyRegistry.ts` `productionEnabled` flip affects Family A | Family A entry (lines 63–67) is byte-equal preserved; remains `productionEnabled: true`. | **CLEAR** |
| 3 | Non-Edge family registry change (`mcp-server/lib/familyRegistryInit.ts`) | mcp-server tree is read-only per §16. | **CLEAR** |
| 4 | Auto-trigger dispatcher change beyond registry-derived path | **FIRED.** Phase A.2 verdict in §3. The dispatcher is currently hard-coded; making it registry-derived is required to deliver the smoke contract. The §10 recommended scope correction MAKES the dispatcher registry-derived (not "beyond" it), so technically the proposed change is on the safe side of "beyond" — but the brief explicitly told the designer to surface this as HALT trigger 4 when the dispatcher is found hard-coded, and that is what this document does. **Operator decision required.** | **FIRED (operator decision required)** |
| 5 | Source 6 filter change | `machineObservationPersistenceQuery.ts:127` byte-equal preserved per §16 item 2. | **CLEAR** |
| 6 | Persistence schema change | No migration; no `ALTER TABLE`; no new policy. Per §16 item 7. | **CLEAR** |
| 7 | New taxonomy keys | None proposed. The 171-key registry stays byte-equal. | **CLEAR** |
| 8 | MCP schema version change | `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` byte-equal preserved per §16 item 6. | **CLEAR** |
| 9 | Family A / B / C prompt changes | mcp-server tree read-only; the prompts live in `mcp-server/lib/family[ABC]Prompt.ts`. | **CLEAR** |
| 10 | Hosted MCP server file changes | mcp-server tree read-only per §16 item 1. | **CLEAR** |
| 11 | New Edge Function endpoint | No new endpoint. The existing `classify-argument-boolean-observations` HTTP endpoint is preserved; the auto-trigger dispatcher is internal to `submit-argument` and remains a function call. | **CLEAR** |
| 12 | Logs raw argument body, raw prompt, raw model response, bearer token, or API key | The dispatcher's structured log emits `argument_id`, `family`, `outcome`, `skip_reason`, `failure_reason`, `attempt_number`, `latency_ms`, `run_id`. No payload bodies. Implementer must preserve this. | **CLEAR (implementer must preserve)** |
| 13 | Auto-trigger logic broken (Family A still works post-merge is existential) | Family A is first in `productionEnabledFamilies()`; the loop is identical to today's single-family path for the first iteration. Existing TRG-1..TRG-10 wiring tests preserved. | **CLEAR** |
| 14 | Test forecast exceeds +100 | Forecast +30 to +45 (§6). Well under +100. | **CLEAR** |
| 15 | Production-mode runs from B + C don't persist to results table | Phase A.4 confirms the persistence layer accepts the writes; runtime evidence will come from the post-merge smoke. | **CLEAR (smoke-verifiable)** |
| 16 | Verdict tokens in user-facing strings | Design carries zero verdict tokens. Existing dispatcher ban-list scan (TRG-20) protects the source. The new registry-derived dispatcher source will be scanned by the same pattern. | **CLEAR** |
| 17 | Family C `clarified` lifecycle FALSE-low guard breaks under production-mode | The guard lives in `mcp-server/lib/familyCPrompt.ts` (prompt-level), not in `familyRegistry.ts` or `autoTriggerDispatcher.ts`. Both files are out of scope for this card. The guard is independent of run_mode and continues to operate identically for production and admin_validation. **Implementation discipline: the implementer MUST NOT touch the prompt; if smoke shows the guard breaking under production, that's a separate Family C card.** | **CLEAR** |
| 18 | Unclassified untracked files at PR creation | The 10 operator-territory files at HEAD (`docs/testing-runs/2026-05-25-*`, `mcp021c-edge-smoke-*`, `netlify-prod.git`, `phase5-mcpserver002-*`) are known; the implementer should `git status --short` before PR and confirm ONLY card-territory files are staged. | **CLEAR (process gate)** |

**Result:** 1 fired (#4), 17 clear. The #4 firing is the binding finding that requires operator decision before implementation.

---

## 18. Doctrine self-check

- **cdiscourse-doctrine §1 (score never blocks; no truth labels):** `run_mode` and `productionEnabled` discriminate routing/purpose; no quality, victory, defeat, correctness, or participant label. The flip changes WHERE rows land, never WHAT they say. **Respected.**
- **cdiscourse-doctrine §3 (popularity is not evidence):** the dispatcher, registry, and renderer all ignore engagement, view-count, retweet, follower-count. No new input introduced. **Respected.**
- **cdiscourse-doctrine §4 (AI moderator hard limits):** Family B's `disputes_value_weighting` and Family C's misunderstanding-repair raw keys are STRUCTURAL observations. They are advisory ("authoritative: false" envelope), they do not assign truth, they do not delete or hide content. The hosted MCP prompts (out of scope) enforce the prompt-level guard. Production-mode flip changes only WHERE results render, never how the model decides. **Respected.**
- **cdiscourse-doctrine §6 (secrets policy):** no `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `Authorization`, or bearer token is logged or returned. The dispatcher uses the service-role client passed by argument from `submit-argument`'s already-authenticated isolate. Implementer must preserve this. **Respected.**
- **cdiscourse-doctrine §7 (no AI calls from production app):** all AI calls go through the hosted MCP server via the Edge adapter. The production app continues to call only `submit-argument`'s HTTPS endpoint. **Respected.**
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration; no RLS disable; no constitution mutation; no `flags` deletion; no hard-delete. **Respected.**
- **cdiscourse-doctrine §9 (plain language):** Family B's 14 raw keys and Family C's 17 raw keys are mapped through `MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY` to plain-language `label` / `description` strings (registered at MCP-021A). The renderer drops unknown raw keys silently per §4. Implementer must confirm none of the post-flip raw keys appear in any user-facing copy as a raw snake_case string — the existing test pattern enforces this. **Respected.**
- **cdiscourse-doctrine §10a (Observations vs Allegations):** rows persisted by Families B and C are Machine Observations (`kind: 'machine_observation'`, never `user_allegation`). The schema boundary is preserved by the renderer adapter (`mark.kind = 'machine_observation'`). **Respected.**
- **supabase-edge-contract:** dispatcher uses the service-role client passed by argument; no new service-role client. RLS continues to gate Source 6 reads. The auto-trigger path is server-only (`supabase/functions/` tree). **Respected.**
- **test-discipline:** every new behavior is covered by a test (§6 enumerates). The existing FR-* and TRG-* assertions are preserved or surgically updated to reflect the post-flip posture. No `.skip` / `.only` / `xit`. **Respected.**

---

## 19. Operator steps (if any)

### If §10 scope correction is approved:

1. **Operator decision:** explicitly confirm the §10 scope expansion (touching `autoTriggerDispatcher.ts`) is authorized. Record the decision in the intent brief or in the issue thread.
2. **Implementer ships the PR** with both `familyRegistry.ts` and `autoTriggerDispatcher.ts` edits + the test extensions.
3. **Post-merge auto-deploy** (Supabase GitHub integration) deploys both Edge Functions (`submit-argument` and `classify-argument-boolean-observations`). Operator confirms the version bump in the dashboard.
4. **Smoke verification** per intent brief §11 (5-phase audit):
   - Phase 1: pre-flight (HEAD at merge SHA; Edge versions bumped).
   - Phase 2: submit a new argument; wait ~15–30 s; query `argument_machine_observation_runs` for 3 new rows (one per family) with `run_mode='production'`, `status='success'`.
   - Phase 3: query Source 6 results for the new argument; confirm Family B + C raw_keys appear alongside Family A's.
   - Phase 4: run `scripts/ops/mcp-observability-report.mjs`; confirm Q9 shows no new `organic_duplicate_candidate`; Q11 shows production-mode for B + C; Q12 shows no unsupported-family attempts.
   - Phase 5: regression sanity (Family A still auto-triggers; B + C admin_validation still works; hosted MCP smoke unaffected).
5. **Audit doc** written to `docs/audits/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-2026-05-27.md` with PASS/PARTIAL/FAIL verdict.

### If ONLY the 2-boolean flip ships:

1. **Operator decision:** explicitly confirm that the auto-trigger extension is deferred to a separate card and that smoke Phase 2 / Phase 4 will be partial.
2. **Implementer ships the smaller PR** with only `familyRegistry.ts` and the FR-* test updates.
3. **Post-merge auto-deploy.**
4. **Smoke verification** is reduced to Phase 1 + Phase 5 (regression-only); Phase 2/3/4 are deferred to the follow-up card.

### Either way

Deploy step (operator):
- The Supabase GitHub integration auto-deploys Edge Functions on merge to main. No manual `npx supabase functions deploy` is required. The auto-deploy of `submit-argument` (production-app surface) and `classify-argument-boolean-observations` (admin surface) takes ~30–90 s post-merge.
- No `npx supabase db push --linked` because no migration ships.

---

## 20. Brief ledger (orchestrator-authored brief, source map)

Per the POSTRUN-UX001 multi-card chain protocol, this design captures the orchestrator-authored brief's source map so the operator can audit where orchestrator judgment substituted for operator judgment.

| Brief section | Source basis | Designer finding |
|---|---|---|
| §1 — the 2-boolean flip | Operator-authored intent (clear) | Matches source; 2 booleans flip cleanly. |
| §2 — auto-trigger inclusion ("derives from registry") | Orchestrator assumption — **empirically incorrect** | Phase A.2 reveals dispatcher is hard-coded. HALT trigger 4 surfaced per §0. |
| §3 — Source 6 rendering preservation | Codebase fact (confirmed) | Phase A.3 confirms multi-family-ready renderer. |
| §4 — backward compatibility | Codebase fact (confirmed) | Phase A.4 confirms persistence layer multi-family-ready. |
| §5 — smoke verification (3 runs expected) | Orchestrator assumption based on §2 | Achievable only if §10 scope correction is approved. |
| §6 — idempotency observability | Operator-authored (clear) | Compatible with §10 scope correction. |
| §7 — out of scope | Operator-authored (clear) | Adopted as §15 verbatim. |
| §8 — 18 HALT triggers | Operator-authored (clear) | Each evaluated in §17. |
| §9 — 5 Phase A audits | Operator-authored (clear) | Executed in §§2–6 of this design. |
| §10 — test forecast +20 to +50 | Operator-authored (clear) | Designer forecast +30 to +45 lands inside the band. |
| §11 — 5-phase smoke plan | Orchestrator-authored — relies on §2 assumption | Phase 2 not achievable without §10 scope correction. |
| §12 — authorizations granted on PASS | Operator-authored (clear) | Adopted as-is. |
| §13 — brief ledger | Operator-authored ledger of artifacts | Adopted as-is. |

### Operator-deferred review items

- **§2 (auto-trigger registry-derivation assumption):** the operator should confirm that "extending Card 1 to make the dispatcher registry-derived" is the intended path, OR explicitly defer the dispatcher extension to a follow-up card.
- **§5 / §11 Phase 2 (3 runs per argument smoke):** the operator should confirm that smoke verification of B + C auto-trigger is in scope for this card OR is a deferred follow-up.
- **§14 (test forecast band):** the +30 to +45 designer estimate sits inside the brief's +20 to +50 band, but on the upper half. Operator may decide to tighten if any test family is over-forecast.

---

## 21. Recommendation

**The designer recommends Option A (scope expansion) per §10.**

Rationale: 
1. The brief's §2 stated assumption (registry-derived) and §11 Phase 2 success criterion (3 runs per argument) require it.
2. The change is small (~40 lines in `autoTriggerDispatcher.ts`) and stays on the safe side of HALT trigger 4 (registry-derived, not beyond it).
3. The next card in the sequence (`MCP-SERVER-005-FAMILY-D` per brief §12) will follow the same pattern; setting up the registry-derived dispatcher now means D's enablement is a 1-boolean flip + a 1-line registry order tweak, not another scope expansion.
4. The test forecast lands comfortably inside the brief's band (+30 to +45 vs +20 to +50).
5. The smoke plan PASS verdict is achievable.

**If Option B (2-boolean-only) is selected**, this design should be revised to remove §6's full test enumeration and §11's auto-trigger-fires expectations, and the brief should be amended to drop the §11 Phase 2 / Phase 4 expectations.

**If Option C (brief revision)**, the brief itself needs operator authorship for the new framing; this design can be re-issued against the new brief.

---

## 22. Status

**Design draft. Operator decision required at §0 / §10 / §20 before implementation begins.**

No source files have been edited by this design. The next step is operator selection of Option A / B / C and any consequent brief amendment. Once the operator chooses, this document can be promoted from "draft" to "approved" and the implementer subagent can be spawned with the chosen scope.
