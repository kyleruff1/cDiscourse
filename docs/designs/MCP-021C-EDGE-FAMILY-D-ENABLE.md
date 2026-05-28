# MCP-021C-EDGE-FAMILY-D-ENABLE — Family D production-mode flip

**Status:** Design draft
**Epic:** MCP — production-mode enablement
**Release:** Card 2 of 3 in the FAMILY-D-COVERAGE → EDGE-FAMILY-D-ENABLE → FAMILY-E chain
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/335
**Intent brief:** `docs/designs/MCP-021C-EDGE-FAMILY-D-ENABLE-intent.md` (operator-authored)
**Branch:** `feat/MCP-021C-EDGE-FAMILY-D-ENABLE`
**Predecessors on main:**
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE PASS` at `ac66b2e` (Card 1; registry-derived dispatcher)
- `MCP-SERVER-005-FAMILY-D-SMOKE PASS` at `0da43f9` + Edge subset filter at `b0fd068` (Card 2 of prior launch; D admin_validation operational; 19-key Subset)
- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE PASS` at `9b040be` (Q11 reframe + Q14 density + Q15 D subset already 4-family-aware)

---

## Goal (one paragraph)

Flip one boolean — `productionEnabled: false → true` for the `evidence_source_chain` (Family D) entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (currently line 86). After merge + auto-deploy, every new argument submitted via `submit-argument` will fire FOUR sequential production runs (A+B+C+D) instead of three (A+B+C). The dispatcher (Card 1 of the prior launch) already derives its production family list from `productionEnabledFamilies()`; the Edge subset filter at `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain'] = {'ai_classifier'}` (PR #332) already routes only the 19 ai_classifier keys to the hosted MCP server regardless of run_mode; and the OPS observability surface is already 4-family-aware (Q11 reframe + Q14 density + Q15 D subset). This is the smallest possible production-mode flip — one boolean of source code — with the surrounding system already prepared. The card respects cdiscourse-doctrine §1 (the production flip is a routing decision, never a verdict on family quality), §10a (Family D rows persist as Machine Observations with `source = 'machine'`), and §7 (no AI calls leak to client; all classification stays inside Edge Functions + the hosted MCP server).

---

## Scope reality (Phase A.1–A.4 verification)

### Phase A.1 — familyRegistry current state + flip (CONFIRMED)

Current `familyRegistry.ts` state (read at HEAD `21f9874`):

| Index | Family | productionEnabled | adminValidationEnabled | Line range |
|---|---|---|---|---|
| 0 | parent_relation (A) | **true** | true | 69-73 |
| 1 | disagreement_axis (B) | **true** | true | 74-78 |
| 2 | misunderstanding_repair (C) | **true** | true | 79-83 |
| 3 | **evidence_source_chain (D)** | **false** ← flip to **true** | true | **84-88** |
| 4 | argument_scheme (E) | false | true | 89-93 |
| 5 | critical_question (F) | false | true | 94-98 |
| 6 | resolution_progress (G) | false | true | 99-103 |
| 7 | claim_clarity (H) | false | true | 104-108 |
| 8 | thread_topology (I) | false | true | 109-113 |
| 9 | sensitive_composer (J) | false | true | 114-118 |

The flip is exactly 1 boolean character at the value position of `productionEnabled` in the Family D entry at line 86. A/B/C remain `true` (unchanged); E–J remain `false` (unchanged); all `adminValidationEnabled` values remain `true` (unchanged).

### Phase A.2 — Auto-trigger inclusion verification (VERIFIED — no implementation change required)

`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` reads as:

- **Line 87:** `import { productionEnabledFamilies } from './familyRegistry.ts';`
- **Line 403:** `const eligibleFamilies = productionEnabledFamilies();`
- **Line 431:** `for (const family of eligibleFamilies) { ... }`

The dispatcher is **registry-derived**. It contains no family literals at all (asserted by `TRG-18` in `mcpOneTwoOneCAutoTriggerFamilyA.test.ts` lines 164-187 and by `DREG-2` in `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts`). After Family D's boolean flips, `productionEnabledFamilies()` returns 4 entries (A, B, C, D in registry order), the `for-of` loop runs 4 iterations, and the dispatcher calls `classifyOneArgumentCore` once per family with a single-element array. **No dispatcher code change required.** HALT trigger #3 (auto-trigger dispatcher hard-codes families) is impossible to fire because there are no family literals to hard-code.

**Phase A.2 verdict: BINDING YES.** The registry-derived dispatcher already picks up D after the flip.

### Phase A.3 — Subset filter holds under production-mode (CRITICAL — VERIFIED)

The Edge subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` lives in `booleanObservationRequestBuilder.ts` lines 68-72:

```ts
const MCP_SERVER_SUPPORTED_FAMILY_SOURCES: Readonly<
  Partial<Record<MachineObservationFamily, ReadonlySet<MachineObservationSource>>>
> = Object.freeze({
  evidence_source_chain: Object.freeze(new Set<MachineObservationSource>(['ai_classifier'])),
});
```

The builder function `buildBooleanObservationRequestForArgument` (lines 117-173) is **mode-agnostic** in how it applies the subset filter. The flow is:

1. **Line 121:** `const eligibleFamilies = filterFamiliesForMode(input.requestedFamilies, input.mode);` — this is where mode-based family eligibility filtering happens. Pre-flip, mode=`'production'` + `requestedFamilies=['evidence_source_chain']` → `eligibleFamilies=[]` (D rejected by mode). Post-flip, same input → `eligibleFamilies=['evidence_source_chain']` (D accepted by mode).
2. **Lines 132-149:** the iteration over `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY`:
   ```ts
   for (const def of Object.values(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)) {
     if (!eligibleFamilies.includes(def.family)) continue;
     const allowedSources = MCP_SERVER_SUPPORTED_FAMILY_SOURCES[def.family];
     if (allowedSources && !allowedSources.has(def.source)) continue;
     rawKeySet.add(def.rawKey);
     definitions[def.rawKey] = def;
   }
   ```
3. The `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` check (lines 141-142) is applied **AFTER** `eligibleFamilies.includes(def.family)` but **WITHOUT** any reference to `input.mode`. Therefore the subset filter behaves identically in production-mode and admin_validation-mode: any Family D request — regardless of mode — sends only the 19 ai_classifier rawKeys, never the 8 deterministic keys.

**Production-mode call path trace:**
- `dispatchAutoTriggerForArgument` (autoTriggerDispatcher.ts:372)
- → `dispatchOneFamilyIteration` (line 224) iterates eligible families with `mode = AUTO_TRIGGER_MODE = 'production'`
- → `classifyOneArgumentCore(argumentId, [family], AUTO_TRIGGER_MODE, ...)` (line 264)
- → inside `classifyArgumentCore.ts`, calls `buildBooleanObservationRequestForArgument({ ..., mode: 'production' })`
- → builder applies `filterFamiliesForMode([family], 'production')` (production-mode keeps D post-flip)
- → builder applies the source allowlist (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES['evidence_source_chain']`) regardless of mode
- → **production-mode Family D request contains exactly 19 ai_classifier rawKeys** (same as admin_validation-mode)

**Phase A.3 verdict: BINDING YES.** The subset filter is mode-agnostic; production-mode Family D requests contain only the 19 ai_classifier keys. HALT trigger #14 (Family D production runs send all 27 keys) is structurally impossible given the current `booleanObservationRequestBuilder.ts` code.

The current `SF-9` assertion in `mcpFamilyDEdgeMcpSubsetFilter.test.ts` (lines 143-152) explicitly checks the pre-flip state ("`production-mode Family D request returns empty rawKeys (productionEnabled=false)`"). This assertion MUST be REVISED in this card (see Test plan §SF-9 update).

### Phase A.4 — Latency + dispatcher sequential-loop under 4 families (VERIFIED)

The dispatcher's sequential `for-of` loop iterates eligible families one at a time:

```ts
for (const family of eligibleFamilies) {
  const iterationOutcome = await dispatchOneFamilyIteration(
    argumentId,
    family,
    serviceClient,
  );
  outcomes.push(iterationOutcome);
}
```

Each iteration awaits `classifyOneArgumentCore`, which in turn awaits the hosted MCP call. Failure isolation (per-iteration try/catch inside `dispatchOneFamilyIteration` lines 224-356) means one family's failure does not abort the next. Sequential design is preserved per Stage 2B operator preference (DREG-6 asserts no `Promise.all` over the family list).

**Latency projection (from prior smoke audits):**

| Family | Single-arg dispatch | Source |
|---|---|---|
| A (parent_relation) | ~4.5s | Card 1 smoke `2026-05-27` (run `27ed5f98...`) |
| B (disagreement_axis) | ~3.9s | Card 1 smoke (run `ea9c9dd4...`) |
| C (misunderstanding_repair) | ~4.8s | Card 1 smoke (run `3185f3f4...`) |
| D (evidence_source_chain) | ~6.5s | Family D admin_validation smoke `2026-05-28` (19.5s ÷ 3 args ≈ 6.5s/arg; 1.03s per key) |
| **4-family total per arg** | **~19.7s** | A + B + C + D sequential |

The 4-family dispatch (~20s) runs as a background task via `EdgeRuntime.waitUntil(autoTriggerPromise)` (submit-argument:792-794). The user response is returned at submit time (~50-200ms); the dispatcher runs after. There is no blocking call; HALT trigger #13 (auto-trigger broken for A/B/C) is structurally impossible because each family iteration runs in its own try/catch and the loop iterates regardless of prior outcomes.

**Phase A.4 verdict: BINDING YES.** 4-family sequential dispatch is acceptable; well within the `EdgeRuntime.waitUntil` background-task tolerance (Supabase Edge Functions support up to 150s in fire-and-forget mode per platform docs).

---

## The 1-line diff

**File:** `supabase/functions/_shared/booleanObservations/familyRegistry.ts`
**Line 86 change:**

```diff
   {
     family: 'evidence_source_chain',
-    productionEnabled: false,
+    productionEnabled: true,
     adminValidationEnabled: true,
   },
```

That is the entire production-code diff. Zero other source files are modified.

---

## Data model

**No new data model.** The `argument_machine_observation_runs` and `argument_machine_observation_results` tables already accept `run_mode = 'production'` rows for any family. The existing Family D admin_validation rows persist alongside the new production rows.

Persistence rows for the 4 production families remain pairwise distinct:
- `run_mode` discriminator: `'production'` (auto-trigger) vs `'admin_validation'` (manual HTTP endpoint, operator-driven)
- `requested_families` discriminator: each row contains a single-family array (one of `['parent_relation']` / `['disagreement_axis']` / `['misunderstanding_repair']` / `['evidence_source_chain']`)
- `raw_key` cross-family disjointness (per MCP-021A): no Family D raw_key appears in any other family's raw_key set

---

## File changes

### Modified files (1 production-code source file)

- **`supabase/functions/_shared/booleanObservations/familyRegistry.ts`** — flip 1 boolean (line 86: `productionEnabled: false` → `productionEnabled: true`); 1-line diff; no other change. Comment commentary in lines 5-25 of the file describes the general posture ("D–J remain `false` until a per-family enablement card flips the flag"); after this card the comment is technically stale (E-J remain false; D is now flipped). The comment is not load-bearing for behavior; it may be updated to clarify the post-Card-2 state, but operator can leave it intact since intent brief HALT trigger #2 limits scope to Family D — the comment refers to general posture.

### Modified test files (stale-assertion updates anticipated by intent brief §8)

Existing tests that assert pre-flip state must be updated to reflect post-flip state. The updates are mechanical: the literal "3" / "['parent_relation', 'disagreement_axis', 'misunderstanding_repair']" / "false" patterns become "4" / "[..., 'evidence_source_chain']" / "true" patterns. No assertion is loosened or removed; each becomes a stronger post-flip binding.

**Anticipated edits (~5 files):**

| File | Tests affected | Nature of change |
|---|---|---|
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5, FR-6, FR-7, FR-16, FR-26, FR-28, FR-30, FR-32 | Expand A+B+C list to A+B+C+D; D moves from "production-disabled" set to "production-enabled" set |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1, FE-2, FE-3, FE-4, FE-7:evidence_source_chain | Expand "exactly THREE" assertions to "exactly FOUR"; remove D from the FE-7 admin-only iteration list; add FE-11 explicit D flip assertion |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` | FD-2, FD-4, FD-6 | Flip the D assertions: `productionEnabled: true`, included in productionEnabledFamilies(), filter keeps D in production mode |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | AVM-11, AVM-13 | Flip D production-filter assertion: production filter keeps D; mixed-list filter keeps D |
| `__tests__/mcpFamilyDEdgeMcpSubsetFilter.test.ts` | SF-9 | Flip the production-mode assertion: production-mode Family D request now contains exactly 19 ai_classifier rawKeys (mirror of SF-1 with mode='production') |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29, DREG-31 | DREG-29 expands [A, B, C] to [A, B, C, D]; DREG-31 narrows D-J list to E-J (remove D from "must be productionEnabled: false" list) |

**Update discipline:** these updates are anticipated by intent brief §8 ("FR-7 + DREG-* test updates"). No test is removed; the assertion literals are bumped to the new world. Each updated test continues to enforce the same invariant class (catches accidental widening / narrowing of the production posture), just at the 4-family baseline.

### New test files (added by this card)

| File | Purpose | Test count forecast |
|---|---|---|
| `__tests__/edgeFamilyDProductionEnable.test.ts` | Dedicated registry assertion for Family D production flip (mirrors `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` shape; this is the binding gate that catches accidental D revert) | ~6 tests |
| `__tests__/mcpFamilyDSubsetFilterProductionMode.test.ts` | **Critical:** production-mode subset filter assertions (mirrors SF-1..SF-5 with `mode='production'`; binds HALT trigger #14) | ~5 tests |

### Deleted files

**None.** No file is removed.

---

## API / interface contracts

**No API surface change.** The dispatcher signature, the `submit-argument` Edge Function HTTP contract, the `classify-argument-boolean-observations` Edge Function HTTP contract, the hosted MCP server's `classify_argument_boolean_observations` tool contract — all are byte-equal across this card. The only behavioral change is the set of families auto-triggered for new arguments: 3 → 4.

`familyRegistry.ts` exports remain identical:
- `FAMILY_REGISTRY` (frozen ReadonlyArray of `FamilyRegistryEntry`)
- `lookupFamilyRegistryEntry(family)` returns `FamilyRegistryEntry | null`
- `filterFamiliesForMode(requestedFamilies, mode)` returns `ReadonlyArray<MachineObservationFamily>`
- `productionEnabledFamilies()` returns `ReadonlyArray<MachineObservationFamily>` — **post-flip returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain']`**
- `adminValidationEnabledFamilies()` returns `ReadonlyArray<MachineObservationFamily>` — unchanged (all 10 families)

---

## Edge cases

### EC-1 — A submitted argument fires 4 sequential MCP calls + 4 persistence rows

Each call is one of A/B/C/D, in registry order. Latency is additive (~20s total per the latency table in Phase A.4); the user response is returned in submit-time (~200ms) before any dispatcher work completes. If any single family iteration fails (e.g., MCP timeout, validation error), the per-iteration try/catch surfaces a clean `outcome: 'failed'` with a `failureReason`; the next family iteration still runs. This is the same isolation property that protected A/B/C in Card 1 and protects each family individually.

### EC-2 — Family D produces 0 production positives for a synthetic test arg

This is the expected conservative-positives behavior (Card 2 of prior launch smoke documented 0 positives on arg1 even with real evidence-source-chain-relevant content; arg2 + arg3 fired 4 positives total). 0 positives is not a failure — it is `status: 'success'` with an empty result set, persisted as a Family D production run row. Source 6 reads correctly surface zero raw_keys for that arg + Family D.

### EC-3 — Family D production run vs admin_validation run for the same argument

Both can coexist. The auto-trigger writes `run_mode='production'`; admin operators triggering the classifier HTTP endpoint manually write `run_mode='admin_validation'`. The idempotency pre-check (`findExistingRun` in `autoTriggerDispatcher.ts:174-196`) filters on `run_mode='production'` AND `provider_key=PROVIDER_KEY` AND `requested_families` containing the family — so an admin_validation run for D does not block the auto-trigger's production run. Both rows persist; both are visible in observability Q11 (per-family per-mode coverage).

### EC-4 — Edge subset filter under production-mode

`buildBooleanObservationRequestForArgument` with `mode='production'` and `requestedFamilies=['evidence_source_chain']` returns a request with exactly 19 ai_classifier rawKeys (the same 19 as admin_validation-mode). The filter is mode-agnostic; no code path bypasses it. (See Phase A.3 trace above.)

### EC-5 — Multi-family auto-trigger interleaved (not a real path post-Card-2 design)

The dispatcher does NOT batch families into a single MCP call. Each family iteration sends a single-family request. Therefore "4 families in one MCP call sending 66 rawKeys" is structurally impossible — the dispatcher's per-family loop iterates one-at-a-time.

### EC-6 — Family D fires after a runtime kill switch flip

The runtime config kill switch (`get_semantic_referee_runtime_config.enabled`) is checked ONCE at the start of `dispatchAutoTriggerForArgument` (lines 380-396; before the for-of loop). If `enabled=false`, the dispatcher returns a single skipped outcome (`skipReason: 'config_disabled'`); zero family iterations run; no D row persists. The kill switch is dispatch-wide, not per-family. DREG-22 + DREG-23 already assert this shape.

### EC-7 — Family D's existing admin_validation runs co-exist with new production runs

The 3 historical Family D admin_validation runs from Card 2 of the prior launch (Phase 4 smoke: `9abbd3df...`, `fc5e3742...`, `c6b527c5...`) remain in the DB. After this card ships, future new arguments produce a `production` row alongside whatever admin_validation rows may also exist. Source 6's `run_mode='production'` filter at `machineObservationPersistenceQuery.ts:127` correctly surfaces only production raw_keys; admin_validation rows remain visible to the admin tools.

### EC-8 — D production raw_keys rendering in user-facing Source 6

The OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE card already shipped Q11 reframe + Q14 density + Q15 D subset, with the report stitcher 4-family-aware and the rendering layer tested for D raw_keys via `opsMcpObservabilityMultiFamily.test.ts` (Q11 explicitly asserts Family D admin_validation row appears) and `opsMcpObservabilityFamilyDCoverage.test.ts` (Q15 explicitly asserts the 19-key subset list). Post-flip, the renderer continues to consume D rawKeys structurally — no surprise. Intent brief §4 (Source 6 rendering) is satisfied.

---

## Test plan

### New test file 1 — `__tests__/edgeFamilyDProductionEnable.test.ts` (~6 tests)

Dedicated card-scoped binding for the Family D production-mode flip. Mirrors the FD-* pattern from `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` but inverted: every assertion locks in the POST-flip state.

```ts
import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — Family D production-mode flip binding', () => {
  it('FDE-1 — Family D entry has productionEnabled: true (post Card 2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FDE-2 — Family D entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FDE-3 — edgeProductionEnabledFamilies() includes evidence_source_chain', () => {
    expect(edgeProductionEnabledFamilies()).toContain('evidence_source_chain');
  });

  it('FDE-4 — edgeProductionEnabledFamilies() has length 4 (post Card 2 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(4);
  });

  it('FDE-5 — edgeProductionEnabledFamilies() preserves registry A→D order', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
    ]);
  });

  it('FDE-6 — edgeFilterFamiliesForMode([evidence_source_chain], production) keeps evidence_source_chain', () => {
    expect(edgeFilterFamiliesForMode(['evidence_source_chain'], 'production')).toEqual([
      'evidence_source_chain',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — E–J remain admin-only (no widening)', () => {
  const EJ_ADMIN_ONLY = [
    'argument_scheme',
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of EJ_ADMIN_ONLY) {
    it(`FDE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});
```

### New test file 2 — `__tests__/mcpFamilyDSubsetFilterProductionMode.test.ts` (~5 tests)

**Critical** test of HALT trigger #14 (Family D production runs send all 27 keys). Mirrors `mcpFamilyDEdgeMcpSubsetFilter.test.ts` SF-1..SF-5 but with `mode: 'production'`.

```ts
import {
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

const FAMILY_D_AI_CLASSIFIER_KEYS = [
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'creates_source_chain_gap',
  'opens_evidence_debt_marker',
  'closes_evidence_debt_marker',
  'supplies_corroborating_document',
  'source_provided',
  'quote_provided',
  'concrete_example_requested',
  'concrete_example_provided',
  'evidence_claim_present',
  'evidence_gap_present',
  'source_chain_repair',
  'anecdote_used',
  'statistic_used',
  'external_authority_used',
  'evidence_quality_questioned',
  'burden_request_present',
] as const;

const FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS = [
  'has_evidence',
  'source_requested',
  'quote_requested',
  'source_attached',
  'quote_attached',
  'sourced',
] as const;

const FAMILY_D_PRODUCTION_INPUT = {
  argumentId: 'arg-d-prod-1',
  parentArgumentId: 'arg-d-prod-0',
  currentText: 'a reply that may or may not provide evidence',
  parentText: 'a claim being evaluated for evidence chain',
  threadContextExcerpt: 'thread context',
  requestedFamilies: ['evidence_source_chain' as const],
  mode: 'production' as const,
};

describe('MCP-021C-EDGE-FAMILY-D-ENABLE — production-mode subset filter (HALT trigger #14)', () => {
  it('SFP-1 — production-mode Family D request contains exactly 19 ai_classifier rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    expect(req.requestedRawKeys.length).toBe(19);
  });

  it('SFP-2 — every production-mode Family D rawKey matches the 19-key ai_classifier set', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const expected of FAMILY_D_AI_CLASSIFIER_KEYS) {
      expect(sent.has(expected)).toBe(true);
    }
    expect(sent.size).toBe(19);
  });

  it('SFP-3 — production-mode Family D request does NOT include any of the 6 excluded deterministic rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    const sent = new Set(req.requestedRawKeys);
    for (const excluded of FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });

  it('SFP-4 — production-mode Family D definitions map has exactly 19 entries (no orphan keys)', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    expect(Object.keys(req.definitions).length).toBe(19);
  });

  it('SFP-5 — every production-mode Family D definition emitted has source=ai_classifier', () => {
    const req = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    for (const def of Object.values(req.definitions)) {
      expect(def.source).toBe('ai_classifier');
    }
  });

  it('SFP-6 — production-mode + admin_validation-mode emit BYTE-EQUAL rawKey sets for Family D', () => {
    // Doctrine: the subset filter is mode-agnostic. Production and
    // admin_validation modes both go through the same MCP_SERVER_SUPPORTED_FAMILY_SOURCES
    // gate; therefore the rawKey set is identical.
    const reqProd = edgeBuildBooleanObservationRequestForArgument(FAMILY_D_PRODUCTION_INPUT);
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_PRODUCTION_INPUT,
      mode: 'admin_validation',
    });
    const prodKeys = [...reqProd.requestedRawKeys].sort();
    const adminKeys = [...reqAdmin.requestedRawKeys].sort();
    expect(prodKeys).toEqual(adminKeys);
  });

  it('SFP-7 — production-mode multi-family request (D + A) sends 19 D ai_classifier + 16 A full = 35', () => {
    // Mirror of SF-10 with mode='production'. Verifies the subset filter
    // composes correctly under production-mode for mixed-family requests.
    const req = edgeBuildBooleanObservationRequestForArgument({
      ...FAMILY_D_PRODUCTION_INPUT,
      requestedFamilies: ['evidence_source_chain', 'parent_relation'],
    });
    expect(req.requestedRawKeys.length).toBe(35);
    const sent = new Set(req.requestedRawKeys);
    for (const key of FAMILY_D_AI_CLASSIFIER_KEYS) {
      expect(sent.has(key)).toBe(true);
    }
    for (const excluded of FAMILY_D_DETERMINISTIC_EXCLUDED_KEYS) {
      expect(sent.has(excluded)).toBe(false);
    }
  });
});
```

### Test plan summary

| Surface | Test count | Notes |
|---|---|---|
| New `edgeFamilyDProductionEnable.test.ts` | +12 (6 FDE assertions + 6 FDE-7 iterations for E-J) | Dedicated card-scoped binding |
| New `mcpFamilyDSubsetFilterProductionMode.test.ts` | +7 (SFP-1..SFP-7) | **Critical:** HALT trigger #14 binding |
| Updated `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | 0 net (8 assertions flipped) | Stale assertions become post-flip bindings |
| Updated `mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | +1 net (FE-11 added; existing assertions flipped) | Locks in 4-family production posture |
| Updated `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` | 0 net (FD-2, FD-4, FD-6 flipped) | Original D admin-only assertion file inverts; same 8 tests |
| Updated `mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | 0 net (AVM-11, AVM-13 flipped) | Production filter now keeps D |
| Updated `mcpFamilyDEdgeMcpSubsetFilter.test.ts` | 0 net (SF-9 flipped) | Production-mode now returns 19 keys, not empty |
| Updated `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | 0 net (DREG-29, DREG-31 flipped) | Production list expands to 4; D drops out of "must be false" list |
| **Net new tests** | **+20** | Within +20 to +50 forecast |

**Test forecast: +20** (within intent brief §8 budget of +20 to +50). HALT trigger #15 (forecast exceeds +100) is structurally impossible at this scope — there are no new code paths, no new persistence shapes, no new families.

**Doctrine ban-list assertions:** the new test files contain no user-facing strings (they assert structural rawKey sets and registry state). The existing DREG-24 doctrine ban-list assertion in `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` already protects the dispatcher source from verdict tokens; it continues to hold.

---

## Read-only boundary list

The following files are **read-only** in this card (intent brief HALT triggers reference them):

| File / surface | Why read-only | HALT trigger |
|---|---|---|
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | Registry-derived; no code change needed | #3 (auto-trigger dispatcher hard-codes families) |
| `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` | Mode-agnostic subset filter; preserved byte-equal | #6 (subset filter removed/weakened) |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Single per-call orchestrator; no signature change | DREG-32 invariant |
| `supabase/functions/submit-argument/index.ts` | Dispatcher call site preserved byte-equal | TRG-1..TRG-10 invariants |
| `supabase/functions/classify-argument-boolean-observations/index.ts` | Edge classifier HTTP handler; admin_validation path unchanged | #4 (Source 6 filter change) |
| `mcp-server/**/*` | Hosted MCP server byte-equal | #10 (Hosted MCP server file changes) |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` | Source 6 production filter preserved byte-equal | #4 (Source 6 filter change) |
| All Family A-J prompts (`mcp-server/familyDPrompt.ts`, etc.) | No prompt change | #9 (Family A/B/C/D prompt changes) |
| All migration files | No schema change | #5 (Persistence schema change) |
| All `nodeLabelTypes.ts` taxonomy | No new taxonomy keys | #7 (New taxonomy keys) |
| All MCP schema files (`mcpBooleanObservationSchema.ts`) | No schema version change | #8 (MCP schema version change) |

The card's edit surface is exactly **2 files**:
1. `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (1 boolean flip)
2. Test files (+20 new tests, ~10 stale-assertion updates across 7 files)

---

## Dependencies (cards / docs / files)

- **Assumes complete:** `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` (Card 1; registry-derived dispatcher) — without this, the dispatcher would still hard-code Family A and a Family D flip would not auto-trigger
- **Assumes complete:** `MCP-SERVER-005-FAMILY-D` (Card 2 of prior launch; hosted MCP server supports Family D + Edge subset filter at `b0fd068`) — without this, Family D would fail at the MCP server with `unsupported_rawKey`
- **Assumes complete:** `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` — without this, Q11 / Q14 / Q15 would not reflect 4-family production state
- **Reads existing function:** `productionEnabledFamilies()` at `familyRegistry.ts:162-166` (no change)
- **Reads existing function:** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` map at `booleanObservationRequestBuilder.ts:68-72` (no change)
- **Reads existing pattern:** `dispatchOneFamilyIteration` in `autoTriggerDispatcher.ts:224-356` (no change)
- **Will unblock:** post-merge smoke per intent brief §9 (6-phase audit) + `INTER-CARD CHECKPOINT B` + `MCP-SERVER-006-FAMILY-E` design (Card 3 of the chain)

---

## Risks

### Risk 1 — Existing stale assertions block the build

Several existing test files (`mcpOneTwoOneCEdgeFamilyRegistry.test.ts:FR-7`, `mcpOneTwoOneCEdgeFamilyEnablement.test.ts:FE-1..FE-4 + FE-7:evidence_source_chain`, `mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts:FD-2 + FD-4 + FD-6`, `mcpOneTwoOneCEdgeAdminValidationMode.test.ts:AVM-11 + AVM-13`, `mcpFamilyDEdgeMcpSubsetFilter.test.ts:SF-9`, `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts:DREG-29 + DREG-31`) currently assert pre-flip state and will fail after the boolean flip if left unchanged.

**Mitigation:** intent brief §8 anticipates these updates. The implementer must update them in the same PR as the boolean flip. Each updated assertion is a stronger post-flip binding, not a removal — the catch-accidental-widening property is preserved at the new 4-family baseline.

### Risk 2 — Dispatcher latency growth surprises Edge Function timeout

4-family sequential dispatch: ~20s. `EdgeRuntime.waitUntil` tolerates ~150s. Headroom is ~7.5x; safe. If for some reason a Family D MCP call hangs (e.g., upstream Anthropic slowdown), the per-iteration timeout (12s default per `DEFAULT_REQUEST_TIMEOUT_MS` in `booleanObservationRequestBuilder.ts:38` + 2 retries with 2s/8s backoff = 34s worst case per family), worst-case 4-family is ~136s — still under 150s.

**Mitigation:** the dispatcher's per-iteration try/catch + bounded retry (MAX_ATTEMPTS=2) absorbs single-family slowness. A degraded D iteration produces `outcome: 'failed'` without aborting A/B/C iterations.

### Risk 3 — `OPS-MCP-OBSERVABILITY` Q11 title becomes stale

Q11 was reframed from "Family B/C admin-validation-only" to "per-family per-mode coverage" by `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE`. After this flip, Family D shows production rows alongside admin_validation rows in Q11; the title remains accurate (it's "per-family per-mode coverage", which now displays 4 families × 2 modes).

**Mitigation:** none required. Q11 is already 4-family-aware.

### Risk 4 — Family D production runs persist before operator can sanity-check

Once merged + auto-deployed, the next argument submission fires a Family D production run. There is no "soft launch" gate.

**Mitigation:** per intent brief §9, the 6-phase smoke explicitly verifies the first 4-family auto-trigger and validates the subset filter holds. The runtime config kill switch (`get_semantic_referee_runtime_config.enabled`) remains available as a rollback emergency stop (flipping it to `false` halts all auto-trigger including A/B/C/D until re-enabled).

### Risk 5 — Operator unaware that 4 production runs per arg is now the baseline

Q14 (per-family per-mode signal density), Q15 (Family D subset coverage), and the structured `emitAutoTriggerLog` events all surface the 4-family activity. The observability surface is built; this is a documentation moment, not a behavioral surprise.

**Mitigation:** the post-merge smoke audit (intent brief §9 Phase 5) re-runs the observability report and verifies all 14+ SQL queries adapt cleanly.

### Risk 6 — Comment in familyRegistry.ts lines 5-25 becomes technically stale

The header comment describes the post-Card-1 posture ("parent_relation (Family A — 16 keys), disagreement_axis (Family B — 14 keys), and misunderstanding_repair (Family C — 17 keys) are enabled at MCP-021C-EDGE-FAMILIES-B-C-ENABLE ship"). After this card, Family D's 19 keys also ship in production mode.

**Mitigation:** the comment is documentation only; not load-bearing for behavior. Implementer may optionally update lines 7-13 to reflect the post-Card-2 4-family world; the test suite does not assert against comment text. Reviewer can request a minor doc patch if desired.

---

## Out of scope

- ANY runtime code change beyond the 1-boolean flip (intent brief §5)
- ANY mcp-server change (hosted MCP server already supports Family D from Card 2 of prior launch)
- New taxonomy keys (intent brief HALT #7)
- Schema migration (intent brief HALT #5)
- Family A/B/C/D prompt or registry definition changes (intent brief HALT #9)
- Source 6 filter logic changes (intent brief HALT #4)
- Source 6 rendering policy changes (intent brief §5)
- Persistence schema changes (intent brief HALT #5)
- UI changes (intent brief §5)
- New OPS observability sections (Q11/Q14/Q15 already 4-family-aware)
- Family E enablement (separate card: `MCP-SERVER-006-FAMILY-E`)
- Runtime config kill switch behavior change (existing semantics preserved)
- Compound-key response shape (Stage 2B operator binding preserved from prior launch)
- Idempotency uniqueness index changes (existing behavior preserved)
- `forceRerun` parameter introduction
- Multi-family batching (operator preference: per-family sequential loop preserved)

---

## Doctrine self-check

### cdiscourse-doctrine

| Rule | How this design respects it |
|---|---|
| §1 (Score is gameplay analysis, never truth) | The Family D production flip is a routing decision — it determines which family's classifier runs on a new argument. It is NEVER a verdict on the family's quality, the user's claim, or the truth of any statement. Family D's raw_keys (`evidence_gap_present`, `opens_evidence_debt_marker`, etc.) are Machine Observations per §10a, not verdicts. |
| §2 (Heat means activity / friction) | No heat surface changes. |
| §3 (Popularity is not evidence) | No engagement input flows into the production-mode flip. The decision to enable D is operator-driven (intent brief Stage 2B binding from prior launch), not popularity-driven. |
| §4 (AI moderator hard limits) | The MCP classifier remains advisory; `authoritative` flag remains `false` (per Edge Function contract); no automatic deletion / hiding / modification of user content; AI calls stay inside Edge Functions. |
| §5 (Rules engine is sacred) | `src/lib/constitution/engine.ts` is not touched. |
| §6 (Secrets policy) | No env var changes; the existing `MCP_HOSTED_TOKEN` + service-role auth in the dispatcher are preserved byte-equal. |
| §7 (No AI calls from production app) | Production app (`src/`, `app/`) is not touched. All AI calls remain in Edge Functions + hosted MCP server. |
| §8 (Supabase conventions) | No migration, no RLS change, no insert pattern change. `argument_machine_observation_runs` rows continue to be inserted by the service-role client inside the Edge Function. |
| §9 (Plain language for users) | The Family D raw_keys never appear as raw strings in user UI — they map through the existing registry rendering layer (per OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE). No new user-facing strings introduced by this card. |
| §10a (Observations vs Allegations) | Family D production rows persist as Machine Observations (`source = 'machine'`); never as Allegations. The schema boundary in `machineObservationPersistenceQuery.ts` is preserved. |
| §10 (v1 scope guards) | No voting, no winner determination, no public API, no push notifications. The flip is internal classifier routing. |

### test-discipline

| Bar | How this design respects it |
|---|---|
| Pure-TS model tests | New tests (FDE-*, SFP-*) are pure-TS, import via the existing Deno bridge (`__tests__/_helpers/booleanObservationEdgeDeno.ts`), no React, no Supabase, no fetch. |
| Ban-list / safety tests | The DREG-24 doctrine ban-list assertion continues to hold; no new user-facing strings introduced. |
| Test count goes UP | +20 net (within +20 to +50 forecast); never down. |
| Gate timeout handling | Per-file targeted runs are sub-30s; no special timeout configuration needed. |

### supabase-edge-contract

| Rule | How this design respects it |
|---|---|
| No service-role in client | Production app code not touched; service-role stays in Edge Functions only. |
| No direct insert into `public.arguments` from client | `submit-argument` Edge Function is the only path; dispatcher is downstream of it. |
| RLS always on | No migration; RLS unchanged. |
| Migrations append-only | No migration in this card. |
| Soft-delete only for arguments | Not applicable; no argument deletion logic involved. |
| Logging rules | Dispatcher's `emitAutoTriggerLog` continues to omit `Authorization`, service-role keys, raw user emails. The new Family D logs follow the same pattern (D was already logged in admin_validation mode by the classifier core; production-mode logs follow the same shape). |
| Response rules | No API response shape change. |

---

## Operator steps

**On PR merge:** auto-deploy via Supabase GitHub integration. The `submit-argument` and `classify-argument-boolean-observations` Edge Functions redeploy with the new `familyRegistry.ts` source; no separate operator command required.

Specifically:
- `npx supabase functions deploy submit-argument --linked` — **fires automatically** via the GitHub integration (per memory-index `supabase-merge-autodeploy.md`)
- `npx supabase functions deploy classify-argument-boolean-observations --linked` — **fires automatically** via the GitHub integration
- No `npx supabase db push --linked` needed (no migration)

**After auto-deploy completes (~30-90s post-merge):**
- Operator runs the 6-phase post-merge smoke per intent brief §9 (audit at `docs/audits/MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-<date>.md`)
- Phases 1-6 verify pre-flight + 4-family auto-trigger + D subset + Source 6 multi-family read + observability + regression
- On PASS, the chain progresses to INTER-CARD CHECKPOINT B (SOFT gate; ~2-min window) → `MCP-SERVER-006-FAMILY-E` design

**Emergency rollback:** if Family D production starts producing systemic failures (e.g., all 4-family dispatches timing out), the operator can flip `semantic_referee_runtime_config.enabled = false` via SQL — this halts auto-trigger for ALL families (A+B+C+D) at the next dispatch. Per-family rollback (just D) requires a follow-up PR flipping the boolean back; the kill switch is dispatch-wide, not per-family.

---

## HALT trigger table (all 18)

The intent brief defines 18 HALT triggers (§6). Each is mapped to a structural check in this design:

| # | Trigger | Structural check in this design |
|---|---|---|
| 1 | familyRegistry.ts edit affects any family other than D | The 1-line diff is on line 86 only; no other family entry is touched. Reviewer can verify by `git diff --stat` showing 1 file / 1 line / +1 / -1. |
| 2 | Family A/B/C productionEnabled flipped | A/B/C remain `true` (verified by FE-9, FE-10, FR-5, FR-6 post-flip assertions). |
| 3 | Auto-trigger dispatcher hard-codes families | Dispatcher has NO family literals (DREG-2, TRG-18). No edit to dispatcher in this card. |
| 4 | Source 6 filter change | `machineObservationPersistenceQuery.ts:127` not edited; not in scope. |
| 5 | Persistence schema change | No migration in this card. |
| 6 | The Family D Edge subset filter (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) removed or weakened | `booleanObservationRequestBuilder.ts:68-72` not edited; SFP-1..SFP-7 assert the filter still applies under production-mode (19 keys, not 27). |
| 7 | New taxonomy keys | `nodeLabelTypes.ts` not edited. |
| 8 | MCP schema version change | `mcpBooleanObservationSchema.ts` not edited. |
| 9 | Family A/B/C/D prompt changes | `mcp-server/familyDPrompt.ts` not edited. |
| 10 | Hosted MCP server file changes | `mcp-server/**` not edited. |
| 11 | Secret exposure | No new env vars; no key logging. |
| 12 | Logs raw body/prompt/response/token/key | `emitAutoTriggerLog` continues to emit only structured tags (timestamp, argument_id, family, outcome, latency_ms); no raw payloads. |
| 13 | Auto-trigger broken for A/B/C (existential) | Per-iteration try/catch isolates each family; smoke Phase 2 verifies A+B+C still fire alongside D. |
| 14 | Family D production runs send all 27 keys (subset filter weakened under production mode) | **SFP-1..SFP-7** assert 19 keys exactly under production-mode; HALT trigger #14 structurally impossible. |
| 15 | Test forecast exceeds +100 | Forecast is +20; well under +100. |
| 16 | Family D production runs don't persist to results table | `classifyOneArgumentCore` writes `argument_machine_observation_runs` + `argument_machine_observation_results` rows regardless of family (existing pattern preserved). |
| 17 | Verdict tokens in user-facing strings | No new user-facing strings; DREG-24 doctrine ban-list assertion still in effect. |
| 18 | Unclassified untracked files at PR creation | Working tree contains only 10 known operator-territory untracked files (intent brief §8 + reviewer's standard hygiene check). |

**Zero HALT triggers fire** under this design. The card is a single-boolean flip with structural protections against each named risk.

---

## Brief ledger

This design was authored by the roadmap-designer subagent against an **operator-authored intent brief** at `docs/designs/MCP-021C-EDGE-FAMILY-D-ENABLE-intent.md`. The intent brief carries the binding operator decisions for:

- The 1-line diff (intent brief §1)
- The mandatory Phase A.3 subset filter verification (intent brief §2)
- The 4-family latency tolerance (intent brief §3)
- The Source 6 rendering pre-clearance (intent brief §4)
- The HALT trigger table (intent brief §6)
- The Phase A audit set (intent brief §7)
- The test forecast budget (intent brief §8)
- The 6-phase smoke plan (intent brief §9)

### Sections derived from prior Phase framing handoffs

- **Phase A.2 (auto-trigger inclusion):** derived from `docs/designs/MCP-021C-EDGE-FAMILIES-B-C-ENABLE.md` § "Card 1 revised PASS criteria" + Card 1 smoke audit Phase 2 (3-family auto-trigger end-to-end). Pattern: registry-derived dispatcher; no code change required for new family.
- **Phase A.3 (subset filter mode-agnostic):** derived from `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-2026-05-27.md` § "Stage 2A → Stage 2B → Stage 2B-fix narrative" + the Phase 4 fix at PR #332 `b0fd068`. Pattern: subset filter inside the request builder, mode-agnostic.
- **Phase A.4 (latency projections):** derived from Card 1 smoke audit Phase 2 + Card 2 prior smoke audit Phase 4 latency observations. Pattern: ~4-5s per A/B/C family; ~6.5s per D family.

### Sections derived from pre-launch codebase survey

- **Read-only boundary list** + **HALT trigger table** mapped from current source files at HEAD `21f9874`. All file paths + line numbers verified against the actual repo state at design time.
- **Stale-assertion updates** identified by grep against existing test files; the 7 files + ~10 assertion updates are all anticipated by intent brief §8.

### Sections resolved by orchestrator default (require operator review post-ship)

- **EC-6 (kill switch interaction with 4 families)** — the dispatcher's existing kill switch is dispatch-wide, not per-family. This card preserves that semantic. If the operator later wants per-family kill switches, that is a separate card (not in scope).
- **Risk 4 (no soft launch)** — the boolean flip activates 4-family dispatch on the very next argument submission. The intent brief does not call for a soft-launch mechanism; the runtime config kill switch is the rollback. **Operator-deferred review: confirm at PASS that the smoke captures the first 4-family auto-trigger cleanly before declaring the card done.**
- **Risk 6 (familyRegistry.ts header comment)** — the design notes that the comment text becomes technically stale but proposes leaving it intact to minimize the diff. **Operator-deferred review: at PR review, decide whether to amend the header comment.**

### Operator-deferred review surface

After ship + post-merge smoke:
1. Verify the first 4-family auto-trigger via Phase 2 smoke captures clean run rows for all 4 families.
2. Decide whether to amend the `familyRegistry.ts` header comment to reflect the post-Card-2 state.
3. Confirm that the OPS observability report's Q14 density now shows D production density alongside A/B/C.
4. Confirm INTER-CARD CHECKPOINT B (SOFT gate) before authorizing Card 3 (`MCP-SERVER-006-FAMILY-E`).

---

## Summary line

This is the smallest possible production-mode flip: **1 boolean** in `familyRegistry.ts`. The dispatcher (registry-derived since Card 1 of the prior launch), the Edge subset filter (mode-agnostic since PR #332), and the OPS observability surface (4-family-aware since `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE`) are all already prepared. Tests confirm 4-family production posture + production-mode subset preservation. Test forecast: **+20** (within +20 to +50 budget). Zero HALT triggers fire. Open questions: zero.
