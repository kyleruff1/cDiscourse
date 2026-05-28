# MCP-021C-EDGE-FAMILY-E-ENABLE — Family E production-mode flip

**Status:** Design draft
**Epic:** MCP — production-mode enablement
**Release:** Card 2 of 3 in the FAMILY-F-SHIP → EDGE-FAMILY-E-ENABLE → EDGE-FAMILY-F-ENABLE chain
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/345
**Intent brief:** `docs/designs/MCP-021C-EDGE-FAMILY-E-ENABLE-intent.md` (operator-authored, committed at `f23aba1`)
**Branch:** `feat/MCP-021C-EDGE-FAMILY-E-ENABLE`
**Predecessors on main:**
- `deff068` audit-amend(MCP-SERVER-007-FAMILY-F): PASS (chain HALT lifted; Gate A satisfied)
- `1ee8ab3` MCP-SERVER-007-FAMILY-F ship (PR #344) — Family E production-side coverage in MCP server already shipped at MCP-SERVER-006-FAMILY-E; F admin baseline now operational
- `87a2784` audit(OPS-MCP-SMOKE-LINT-CI-WIRING): PASS — L3+L4+L5 mechanically enforced in CI
- `b324dae` audit-amend(MCP-021C-EDGE-FAMILY-D-ENABLE): PASS (4-family production live; pattern reference)
- `4c4ca9c` MCP-021C-EDGE-FAMILY-D-ENABLE (PR #336; pattern reference for this card)

---

## Goal (one paragraph)

Flip one boolean — `productionEnabled: false → true` for the `argument_scheme` (Family E) entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (currently line 91). After merge + auto-deploy, every new argument submitted via `submit-argument` will fire FIVE sequential production runs (A+B+C+D+E) instead of four (A+B+C+D). The dispatcher is registry-derived since Card 1 of the prior launch (`autoTriggerDispatcher.ts:87,403,431`); the Edge subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` MUST NOT receive an entry for `argument_scheme` because Family E's 16 keys are uniform `ai_classifier` (pre-flight confirmed; verified again in Phase A.3); and the OPS observability surface is already 5-family-aware (Family E admin_validation rows already persist; production rows will join them post-flip). The card respects cdiscourse-doctrine §1 (production flip is a routing decision, never a verdict on scheme quality), §10a (Family E rows persist as Machine Observations with `source = 'machine'`), and §7 (no AI calls leak to client; all classification stays inside Edge Functions + the hosted MCP server). **First production-enable card to ship its smoke audit under L3+L4+L5 mechanical CI enforcement.**

---

## Stage 2B NOT REQUIRED

The production-flip decision was made at Gate A (operator authorization following Card 1 PASS). Family E uniformity (`source: 'ai_classifier'` across all 16 keys) was verified at pre-flight per intent brief §3 and re-verified in Phase A.3 below. No subset filter needed. No architectural complexity surfaces during designer Phase A — this is a one-boolean flip with defensive tests + a smoke audit that satisfies L3+L4+L5. **No internal Stage 2B operator decision required mid-card.**

Stage 2 of the chain is CONDITIONAL HALT only (19 triggers in §11 below).

---

## Phase A.1 — familyRegistry current + post-flip state

Verbatim read at HEAD (`f23aba1`; this branch):

### Family E entry pre-flip (current state)

```ts
// supabase/functions/_shared/booleanObservations/familyRegistry.ts:89-93
{
  family: 'argument_scheme',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

Line numbers: opening brace at line 89; `family:` at 90; **`productionEnabled: false,` at 91**; `adminValidationEnabled: true,` at 92; closing brace at line 93.

### Family E entry post-flip (target state)

```ts
{
  family: 'argument_scheme',
  productionEnabled: true,   // ← FLIPPED (1 boolean character)
  adminValidationEnabled: true,
},
```

### Full registry post-flip byte-equality table

| Index | Family | productionEnabled | adminValidationEnabled | Line range | Change in this card |
|---|---|---|---|---|---|
| 0 | parent_relation (A) | **true** | true | 69-73 | none (byte-equal) |
| 1 | disagreement_axis (B) | **true** | true | 74-78 | none (byte-equal) |
| 2 | misunderstanding_repair (C) | **true** | true | 79-83 | none (byte-equal) |
| 3 | evidence_source_chain (D) | **true** | true | 84-88 | none (byte-equal) |
| 4 | **argument_scheme (E)** | **false → true** | true | **89-93** | **1 boolean character** |
| 5 | critical_question (F) | false | true | 94-98 | none (byte-equal) |
| 6 | resolution_progress (G) | false | true | 99-103 | none (byte-equal) |
| 7 | claim_clarity (H) | false | true | 104-108 | none (byte-equal) |
| 8 | thread_topology (I) | false | true | 109-113 | none (byte-equal) |
| 9 | sensitive_composer (J) | false | true | 114-118 | none (byte-equal) |

### `productionEnabledFamilies()` function shape

Lines 162-166 — unchanged byte-equal:

```ts
export function productionEnabledFamilies(): ReadonlyArray<MachineObservationFamily> {
  return Object.freeze(
    FAMILY_REGISTRY.filter((e) => e.productionEnabled).map((e) => e.family),
  );
}
```

Post-flip behaviour: returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme']` (length 5, A→E registry order).

### `filterFamiliesForMode()` function shape

Lines 141-156 — unchanged byte-equal. Post-flip, `filterFamiliesForMode(['argument_scheme'], 'production')` returns `['argument_scheme']` (currently returns `[]`).

**Phase A.1 verdict: BINDING YES.** The 1-line diff is exactly 1 boolean character (line 91). A/B/C/D remain `true`; F-J remain `false`; all `adminValidationEnabled` values remain `true`. The exported function signatures and bodies are byte-equal preserved.

---

## Phase A.2 — Auto-trigger 5-family inclusion mechanism (registry-derived, sequential loop)

`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` verbatim citations:

- **Line 87** — registry import:
  ```ts
  import { productionEnabledFamilies } from './familyRegistry.ts';
  ```
- **Line 403** — production family list materialised at runtime:
  ```ts
  const eligibleFamilies = productionEnabledFamilies();
  ```
- **Lines 431-438** — sequential `for-of` loop iterates eligible families:
  ```ts
  const outcomes: AutoTriggerOutcome[] = [];
  for (const family of eligibleFamilies) {
    const iterationOutcome = await dispatchOneFamilyIteration(
      argumentId,
      family,
      serviceClient,
    );
    outcomes.push(iterationOutcome);
  }
  return outcomes;
  ```
- **No hard-coded family list anywhere in the dispatcher.** Asserted by:
  - `TRG-18` in `__tests__/mcpOneTwoOneCAutoTriggerFamilyA.test.ts` (dispatcher source-scan)
  - `DREG-2` in `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` (no family literals in dispatcher source)

### Projection: after the flip, 5 sequential iterations per arg

Pre-flip (current HEAD): `productionEnabledFamilies()` returns `[A, B, C, D]` (length 4). The for-of loop runs 4 iterations.

Post-flip: `productionEnabledFamilies()` returns `[A, B, C, D, E]` (length 5). The for-of loop runs 5 iterations. The dispatcher's per-iteration try/catch (in `dispatchOneFamilyIteration` lines 224-356) preserves failure isolation — one family's failure does not abort the next iteration.

**Per Stage 2B operator binding from the prior launch (Card 1: B/C enablement), the loop is intentionally SEQUENTIAL (NOT `Promise.all`).** DREG-6 asserts no `Promise.all` over the family list:
```ts
expect(dispatcherText).not.toMatch(/Promise\.all\s*\([\s\S]*?productionEnabledFamilies/);
```

Failure isolation invariant preserved: a Family E iteration failure produces a clean `outcome: 'failed'` with `failureReason`; the dispatcher returns 5 outcomes total even when one (or more) family iteration fails.

**Phase A.2 verdict: BINDING YES.** The registry-derived dispatcher already picks up E after the flip — **no dispatcher code change required.** HALT trigger #3 (auto-trigger dispatcher hard-codes families) is structurally impossible: there are zero family literals in the dispatcher to hard-code.

---

## Phase A.3 — Subset filter NOT applied verification

### Family E uniformity (re-verified at design time)

`src/features/nodeLabels/machineObservationDefinitions/familyE.ts` — all 16 entries declare:

```ts
source: 'ai_classifier' as const,
family: 'argument_scheme' as const,
```

via the shared `buildScheme()` helper (lines 46-70). Verified at design read: all 16 builder calls produce `source='ai_classifier'`. No deterministic auto_metadata / lifecycle source mixed in. Family E is **uniform** `ai_classifier`.

### Subset filter constant — confirmed NO entry for argument_scheme

`supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts:68-72` verbatim:

```ts
const MCP_SERVER_SUPPORTED_FAMILY_SOURCES: Readonly<
  Partial<Record<MachineObservationFamily, ReadonlySet<MachineObservationSource>>>
> = Object.freeze({
  evidence_source_chain: Object.freeze(new Set<MachineObservationSource>(['ai_classifier'])),
});
```

**The only key in the map is `evidence_source_chain` (Family D).** No `argument_scheme` entry exists. This is the correct state: Family E does NOT need a subset filter entry because all 16 of its keys are already `ai_classifier`. Adding an entry would be no-op at best and confusing at worst; defense-in-depth doctrine says "absence = full passthrough"; Family E uniformity makes "full passthrough" already mean "ai_classifier-only".

### Builder semantics under production-mode for Family E

The builder iteration at lines 132-149:

```ts
for (const def of Object.values(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)) {
  if (!eligibleFamilies.includes(def.family)) continue;
  const allowedSources = MCP_SERVER_SUPPORTED_FAMILY_SOURCES[def.family];
  if (allowedSources && !allowedSources.has(def.source)) continue;
  rawKeySet.add(def.rawKey);
  definitions[def.rawKey] = def;
}
```

For a production-mode Family E request post-flip:
1. `filterFamiliesForMode(['argument_scheme'], 'production')` returns `['argument_scheme']` (post-flip).
2. Iteration over the registry encounters all 16 Family E entries; each passes the `eligibleFamilies.includes(def.family)` check.
3. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['argument_scheme']` is `undefined` → `allowedSources` is falsy → the `&&` short-circuits → the entry passes through.
4. All 16 rawKeys land in `rawKeySet`; all 16 definitions land in the map.

**Production-mode Family E request contains exactly 16 ai_classifier rawKeys** — the full Family E set. Identical shape under admin_validation mode (mode-agnostic passthrough since no entry exists).

### Defensive test design

A test will assert structurally that no `argument_scheme` entry exists in the subset filter constant. The test uses `getMcpServerSupportedFamilySources('argument_scheme')` (the existing test-only export at line 79-83) and asserts the return is `undefined`. This catches a future PR accidentally adding an entry.

**Phase A.3 verdict: BINDING YES.** Family E does NOT need a subset filter entry; one MUST NOT be added in this card; the defensive test asserts the absence. HALT trigger #7 (subset filter entry added for E) is structurally guarded by the test and the read-only boundary list.

---

## Phase A.4 — Latency + dispatcher sequential-loop projection for 5 families

### Family E baseline (pre-flight observed)

Family E admin_validation smoke from MCP-SERVER-006-FAMILY-E ship (5th MCP family, 16 keys uniform ai_classifier, MAX_TOKENS=1500):

- 16 keys × 3 args ≈ 16.73s total (per intent brief §6 + Phase 4 of admin baseline)
- Per-arg average: ~5.6s
- Per-key average: ~0.35s

### Single-family per-arg dispatch table

| Family | Per-arg dispatch | Source |
|---|---|---|
| A (parent_relation; 16 keys) | ~4-4.5s | Card 1 of prior launch smoke (`27ed5f98`) + Card 2 (Family D smoke) Phase 7 |
| B (disagreement_axis; 14 keys) | ~3.9-4s | Card 1 of prior launch smoke (`ea9c9dd4`) |
| C (misunderstanding_repair; 17 keys) | ~4.8-5s | Card 1 of prior launch smoke (`3185f3f4`) |
| D (evidence_source_chain; 19 keys ai_classifier subset) | ~6-6.5s | Family D enable smoke (`38dcc8cf`) |
| **E (argument_scheme; 16 keys uniform ai_classifier)** | **~5-5.6s** | **MCP-SERVER-006-FAMILY-E admin_validation smoke** |

### 5-family sequential per-arg projection

```
A (~4.5s) + B (~4s) + C (~5s) + D (~6.5s) + E (~5.6s) ≈ 25.6s per arg
```

Conservative upper bound (each family at its slowest observed): ~5s + ~4s + ~5s + ~6.5s + ~5.6s ≈ 26s per arg.

### Background dispatch budget

The dispatcher runs as `EdgeRuntime.waitUntil(autoTriggerPromise)` from `submit-argument` (lines around 792-794). The user-facing submit response returns BEFORE the dispatcher's promise settles (~50-200ms; verified in Family D Phase 7). Supabase Edge Function `EdgeRuntime.waitUntil` background-task budget is platform-documented at ~150s.

**Headroom analysis:**
- 5-family per-arg: ~26s
- `EdgeRuntime.waitUntil` budget: ~150s
- Headroom: ~5.8x

**Worst-case per-family slowdown bounds:**
- Per-iteration timeout `DEFAULT_REQUEST_TIMEOUT_MS` = 12s (booleanObservationRequestBuilder.ts:38)
- Retry policy: MAX_ATTEMPTS=2, RETRY_BACKOFF_MS=[2_000, 8_000] (autoTriggerDispatcher.ts:97,114)
- Worst case per family: 12s + 2s + 12s = 26s (attempt 1 timeout + backoff + attempt 2 timeout); or 12s + 8s + 12s = 32s if hit the second backoff
- 5-family worst case: 5 × 32s = 160s — **slightly over the 150s budget**

The worst-case is reached only when ALL 5 families hit the MAX_ATTEMPTS retry path. In practice, Family D's enable smoke observed ~19s for 4 families (well under projection). The retry path is for transient failures (mcp_network_error / mcp_api_error / mcp_rate_limited per `RETRYABLE_FAILURE_REASONS`); non-retryable failures (e.g., schema validation failure) terminate immediately. Worst-case retry exhaustion across all 5 families simultaneously is extremely unlikely under healthy hosted MCP conditions.

**Phase A.4 verdict: BINDING YES.** 5-family sequential dispatch projects ~26s typical; within `EdgeRuntime.waitUntil` tolerance. The dispatcher's failure isolation (per-iteration try/catch) protects A/B/C/D from any Family E slowdown. HALT trigger #14 (auto-trigger broken for A/B/C/D — existential) is structurally impossible because each family iteration runs in its own try/catch and the loop iterates regardless of prior outcomes.

---

## Test plan: 5 defensive Jest tests with explicit names

Following the Family D pattern (`__tests__/edgeFamilyDProductionEnable.test.ts` mirrors), this card adds **one new test file** + light updates to existing files. The new file is the dedicated card-scoped binding that locks in the post-flip Family E state.

### New test file — `__tests__/edgeFamilyEProductionEnable.test.ts`

Mirrors the Family D file structurally. Test surface count: **~15 tests** (matching the Family D file's coverage shape: FEE-1..FEE-6 core flip, FEE-7:F-J non-widening iterations × 5, FEE-8 index 4 binding, FEE-9 Family A still first, FEE-10..FEE-13 A/B/C/D unchanged).

```ts
import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — Family E production-mode flip binding', () => {
  it('FEE-1 — Family E entry has productionEnabled: true (post Card 2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-2 — Family E entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FEE-3 — edgeProductionEnabledFamilies() includes argument_scheme', () => {
    expect(edgeProductionEnabledFamilies()).toContain('argument_scheme');
  });

  it('FEE-4 — edgeProductionEnabledFamilies() has length 5 (post Card 2 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(5);
  });

  it('FEE-5 — edgeProductionEnabledFamilies() preserves registry A→E order', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
    ]);
  });

  it('FEE-6 — edgeFilterFamiliesForMode([argument_scheme], production) keeps argument_scheme', () => {
    expect(edgeFilterFamiliesForMode(['argument_scheme'], 'production')).toEqual([
      'argument_scheme',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — F–J remain admin-only (no widening)', () => {
  const FJ_ADMIN_ONLY = [
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of FJ_ADMIN_ONLY) {
    it(`FEE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — Family E is the 5th entry; registry order preserved', () => {
  it('FEE-8 — Family E occupies index 4 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[4].family).toBe('argument_scheme');
    expect(EDGE_FAMILY_REGISTRY[4].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[4].adminValidationEnabled).toBe(true);
  });

  it('FEE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — A/B/C/D production posture unchanged', () => {
  // HALT trigger #2: A/B/C/D productionEnabled flipped (already true; do not touch).
  // These assertions catch any accidental drift on A/B/C/D state during the
  // Family E flip.
  it('FEE-10 — Family A (parent_relation) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-11 — Family B (disagreement_axis) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-12 — Family C (misunderstanding_repair) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-13 — Family D (evidence_source_chain) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — subset filter NOT applied to Family E (defensive guard for HALT trigger #7)', () => {
  it('FEE-14 — MCP_SERVER_SUPPORTED_FAMILY_SOURCES has NO entry for argument_scheme', () => {
    // Family E is uniform ai_classifier (all 16 keys); a subset filter
    // entry would be a no-op at best and a doctrinal confusion at worst.
    // The intent brief HALT trigger #7 binds this: "Subset filter
    // (MCP_SERVER_SUPPORTED_FAMILY_SOURCES) entry added for E (E is
    // uniform ai_classifier; should NOT need an entry)".
    const fs = require('fs');
    const path = require('path');
    const builderPath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
    );
    const builderText = fs.readFileSync(builderPath, 'utf8');
    // The constant block must not contain a key 'argument_scheme'.
    // The only key in the map at the time of this card is
    // 'evidence_source_chain' (Family D Stage 2B subset filter).
    const constantBlock = builderText.match(
      /MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]{0,500}\}\);/,
    );
    expect(constantBlock).not.toBeNull();
    expect(constantBlock![0]).not.toContain("argument_scheme");
  });

  it('FEE-15 — production-mode Family E request contains all 16 ai_classifier rawKeys (no subset filter)', () => {
    // Defensive: confirms the production-mode builder returns the full
    // 16-key Family E set, identical to admin_validation-mode. The
    // subset filter is absent for E → full passthrough.
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-e-prod-1',
      parentArgumentId: 'arg-e-prod-0',
      currentText: 'a reply with possible scheme content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['argument_scheme'],
      mode: 'production',
    });
    expect(req.requestedRawKeys.length).toBe(16);
    // Byte-equal vs admin_validation-mode (mode-agnostic since no subset filter):
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-e-prod-1',
      parentArgumentId: 'arg-e-prod-0',
      currentText: 'a reply with possible scheme content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['argument_scheme'],
      mode: 'admin_validation',
    });
    expect([...req.requestedRawKeys].sort()).toEqual([...reqAdmin.requestedRawKeys].sort());
  });
});
```

The new file uses `require('fs')` and `require('path')` inside the test body for the source-text scan (matching the AVM-14 / AVM-15 pattern in `mcpOneTwoOneCEdgeAdminValidationMode.test.ts`). It imports `edgeBuildBooleanObservationRequestForArgument` from the existing test helper at `__tests__/_helpers/booleanObservationEdgeDeno.ts` (already exported and used elsewhere).

### Updated existing test files (stale-assertion updates anticipated)

| File | Tests affected | Nature of change | Net count |
|---|---|---|---|
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` | FE-2, FE-4, FE-6 | Flip 3 assertions: `productionEnabled: false → true`; production list now includes E; production-mode filter now keeps E | 0 net (inverted assertions) |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5, FR-6, FR-7, FR-16, FR-26 (new), FR-28 (FJ list), FR-30 (preserve order), FR-32 | Expand A+B+C+D list to A+B+C+D+E; E moves from "production-disabled" set to "production-enabled" set | 0 net (assertions flipped) |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1, FE-2, FE-3, FE-4, FE-7 list (drop E) | Expand "exactly FOUR" to "exactly FIVE"; remove E from FE-7 iteration list; preserve FE-5/FE-6/FE-8 (admin baseline) | 0 net |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | AVM-13 (mixed-list); add AVM-11-style for E | Production filter now keeps E in mixed lists | +1 net (new AVM-11b for E or relabel) |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29, DREG-31 | DREG-29 expands [A, B, C, D] to [A, B, C, D, E]; DREG-31 narrows F-J list (E removed) | 0 net |

**Update discipline:** each updated assertion becomes a stronger post-flip binding at the new 5-family baseline; no assertion is removed or loosened. The catch-accidental-widening property is preserved.

### Test forecast summary

| Surface | Test count delta | Notes |
|---|---|---|
| New `edgeFamilyEProductionEnable.test.ts` (FEE-1..FEE-15) | **+20** (6 FEE core + 5 FEE-7 iterations for F-J + 2 FEE-8/9 + 4 FEE-10..13 + 2 FEE-14..15 subset guards + 1 import overhead) | Dedicated card-scoped binding |
| Updated `mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` (FE-1..FE-8) | 0 net (3 flipped) | Pre-flip "admin-only" assertions invert |
| Updated `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | 0 net (~8 flipped) | A→D becomes A→E throughout |
| Updated `mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | 0 net (~5 flipped) | "FOUR" → "FIVE"; E exits FE-7 list |
| Updated `mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | +1 net (new AVM-11b for E parallel to AVM-11) | Production filter mixed-list test gains E coverage |
| Updated `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | 0 net (~2 flipped) | DREG-29 production list expands to 5; DREG-31 narrows F-J |
| **Net new tests** | **+21** | Within +25 to +60 forecast |

Conservative upper bound for net delta (counting all the FEE-7:family iterations, plus any DREG / FR-* assertion additions if needed to harden the new posture): **+25 to +30**. Well within HALT ceiling +90.

**Doctrine ban-list assertions:** the new test file contains no user-facing strings (it asserts structural rawKey sets and registry state). The existing DREG-24 doctrine ban-list assertion in `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` already protects the dispatcher source from verdict tokens; it continues to hold.

---

## Smoke template skeleton

**Filename:** `docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-template.md`

**Audit-Lint: v1** marker MUST appear on line 3 (per OPS-MCP-SMOKE-LINT-CI-WIRING rule precedent; CI lint enforces this on smoke audit PRs).

### 8-phase outline (L3+L4+L5 sections marked)

```markdown
# MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-021C-EDGE-FAMILY-E-ENABLE (Family E argument_scheme production-mode flip; 16-key uniform ai_classifier; first production-enable card under L3+L4+L5 mechanical CI enforcement)
**Chain position:** Card 2 of 3 in FAMILY-F-SHIP → EDGE-FAMILY-E-ENABLE (this) → EDGE-FAMILY-F-ENABLE chain
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)

> Template binding source: intent brief §8 (8-phase smoke incl. L3+L4+L5
> mechanical CI enforcement) + design §"Smoke template skeleton". Fill
> each section after merge; commit the completed audit to `docs/audits/`
> as `MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-<YYYY-MM-DD>.md`. Local pre-lint
> `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; git status clean (only the 10 known
      operator-territory untracked files).
- [ ] Edge Functions auto-deployed via GitHub integration:
      `submit-argument` and `classify-argument-boolean-observations`
      reflect post-merge version timestamps.
- [ ] Verify Edge familyRegistry Family E entry post-merge state:
      `productionEnabled: true, adminValidationEnabled: true`.
- [ ] Verify A/B/C/D entries byte-equal preserved (productionEnabled: true).
- [ ] Verify F/G/H/I/J entries byte-equal preserved (productionEnabled: false).
- [ ] Targeted regression: Jest test count ≥ 18,153 + new tests; Deno
      871 byte-equal (no mcp-server change).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Dispatch success (L3a) — 5 production runs A+B+C+D+E

- [ ] Submit a new argument via `submit-argument` Edge Function (debate
      seed; non-targeted body for the dispatch test; observed; arg id
      recorded).
- [ ] Wait ~30s for the 5-family dispatch to complete.
- [ ] Query `argument_machine_observation_runs` for the new arg id:
      verify EXACTLY 5 production runs (run_mode='production',
      provider_key=PROVIDER_KEY) for A+B+C+D+E.
- [ ] All 5 runs `status='success'` (or at minimum: A+B+C+D+E all
      `'success'` or `'failed'` cleanly; no missing rows).
- [ ] F/G/H/I/J do NOT have production rows for this arg (registry-derived
      dispatcher correctly excluded them; query asserts zero matches).
- [ ] Capture latency: per-family duration table + total dispatch
      wall-time.

**Result:** ☐ PASS ☐ FAIL — _<notes; arg id; run ids>_

---

## Phase 3 — Targeted-signal success (L3b + L4) — Family E positive result row required

**Per operator binding instruction (intent §4 D6.L4):** the targeted arg
MUST contain deliberately scheme-targeted text (causal / principle /
precedent / example / definition / classification / consequence /
analogy / authority / abductive / slippery_slope / cost_benefit / risk /
exception / tradeoff / means_end). **0-positives on a targeted text is
NOT PASS** — use a stronger targeted slippery_slope (or other E scheme)
fixture before accepting PASS.

- [ ] Submit a SECOND new argument with body deliberately exercising one
      or more Family E schemes (recommended starter fixture: a
      slippery_slope-targeted body to hit the doctrine-risk path for
      Phase 4b). Arg id recorded.
- [ ] Wait ~30s for the 5-family dispatch.
- [ ] Query `argument_machine_observation_results` for the new arg's
      Family E production run:
      `SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results r JOIN argument_machine_observation_runs runs ON runs.id = r.run_id WHERE r.family = 'argument_scheme' AND runs.run_mode = 'production' AND runs.argument_id = '<arg-id>';`
- [ ] Verify ≥ 1 positive result row (`raw_key` in the 16-key
      Family E set; `confidence` band emitted).
- [ ] **If 0 positives:** record the fixture text, design a stronger
      targeted fixture, resubmit, repeat. PASS REQUIRES ≥ 1 positive
      result row from targeted text.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<arg id; positives table; fixture
text>_

---

## Phase 4 — Read-path success (L3c) — Source 6 production rows visible

- [ ] Source 6 query path
      (`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
      `run_mode='production'` filter via PostgREST `!inner` join) returns
      the Family E production result rows for the Phase 3 arg.
- [ ] A+B+C+D rows ALSO present in the Source 6 result for the same arg
      (5-family production read-path coverage verified).
- [ ] admin_validation rows for the same arg (if any exist) are NOT
      counted as production proof — they are filtered out by the
      production-only filter (Source 6 separation invariant holds).
- [ ] Defensive: confirm Family E has no `deterministic_key` rows in
      production (E is uniform ai_classifier; no auto_metadata /
      lifecycle source contamination).

**Result:** ☐ PASS ☐ FAIL — _<query output excerpts>_

---

## Phase 4b — DOCTRINE verification (L5) — persisted evidence_span ban-list scan

**Doctrine binding (intent §4 D6.L5):** if
`slippery_slope_reasoning_present` fires on any production run, perform
the persisted-output inspection. If it does NOT fire on the Phase 3
targeted text, use a stronger slippery_slope-targeted fixture before
accepting PASS.

- [ ] **R1 — column pre-check:** verify the `argument_machine_observation_results`
      table has columns `raw_key`, `confidence`, `evidence_span`,
      `family`, `run_id`. (Catches a schema drift that would silently
      break the doctrine scan.)
- [ ] If `slippery_slope_reasoning_present` fired in Phase 3: skip to
      "ban-list scan" below.
- [ ] If NOT fired: design a STRONGER targeted slippery_slope fixture
      (chained "X → X1 → X2 → bad final state" body; multi-step
      consequence chain). Resubmit; query; repeat Phase 3 + 4 for the
      new arg.
- [ ] **Ban-list scan over 13 patterns** (per intent §4 D6.L5):
      `fallacy`, `fallacious`, `weak`, `weak argument`, `invalid`,
      `invalid argument`, `bad reasoning`, `flawed`, `flawed reasoning`,
      `wrong`, `proof of`, `logical error`, `informal fallacy`.
- [ ] Query persisted `evidence_span` for the Family E production rows
      containing `slippery_slope_reasoning_present`; scan for any of the
      13 patterns. Verify ZERO banned tokens present.
- [ ] If a banned token is present: HALT and FAIL (intent §"FAIL"
      conditions).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<fixture text; slippery_slope row;
ban-list scan output>_

---

## Phase 5 — Observability

- [ ] Q11 reframed (per-family per-mode coverage): Family E now shows
      production rows (FIRST real production data for E).
- [ ] Q14 density: Family E production density present.
- [ ] Q9: no new `organic_duplicate_candidate` rows for the new args.
      Auto-trigger runs classify as `audit_or_smoke_rerun`.
- [ ] Rerun the observability report and confirm Family E appears in
      production mode.

**Result:** ☐ PASS ☐ FAIL — _<observability report excerpts>_

---

## Phase 6 — Regression

- [ ] A/B/C/D production behavior unregressed (Phase 2 verified A+B+C+D
      ran; this section confirms there's no quality drift in their
      output for the new args).
- [ ] admin_validation still works for E + F (operator HTTP call against
      `classify-argument-boolean-observations` with `mode: 'admin_validation'`
      and `requestedFamilies: ['argument_scheme']` returns a Family E
      admin_validation run row; same for F).
- [ ] Local gates: `npm run typecheck`, `npm run lint`,
      `npm run test`, `cd mcp-server && deno test --allow-net
      --allow-env --allow-read` all exit 0.

**Result:** ☐ PASS ☐ FAIL — _<gate output>_

---

## Phase 7 — OPS observations + enforcement-loop provenance

**Required subsection (verbatim per intent §8):**

> "Second-enforcement provenance: first PRODUCTION-ENABLE card linted by
> audit-lint CI with L3+L4+L5 mechanically enforced. CI workflow run ID:
> `<id from PR>`; in_scope count: `<n>`; linter exit: 0. L3 satisfied by
> Phases 2+3+4 (dispatch+targeted-signal+read-path). L4 satisfied by
> Phase 3 targeted scheme text producing ≥1 positive result row. L5
> satisfied by Phase 4b persisted evidence_span doctrine inspection (≥1
> clean firing)."

- [ ] Record the 6-family operational state (A+B+C+D+E production
      LIVE; F admin baseline; G/H/I/J admin baseline).
- [ ] Record latency observations (per-family + total dispatch
      wall-time).
- [ ] Doctrine-key calibration note (any unexpected Family E
      raw_key behaviour observed during the smoke).

**Result:** ☐ PASS ☐ FAIL — _<provenance subsection completed>_

---

## Phase 8 — Verdict + authorization

- [ ] **Pre-push audit-lint:** `node scripts/ops/audit-lint.mjs
      docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-<date>.md` exits 0
      before push.
- [ ] CI runs on the smoke audit PR and exits 0 (L1-L6 mechanically
      enforced; L3+L4+L5 obligations met).
- [ ] Verdict:
  - **PASS:** All 8 phases clean; L3/L4/L5 each satisfied by an
    explicit phase; local pre-lint + CI both exit 0; A/B/C/D
    unregressed.
  - **PARTIAL:** Phase 3 0-positives even on stronger targeted arg
    (sparse signal; do NOT authorize Card 3); Phase 4b 0-fire on
    slippery_slope-targeted arg even after fallback fixture.
  - **FAIL:** Phase 3 0-positives on targeted arg AND no PARTIAL marker;
    Phase 4b dirty firing (banned token in E production evidence_span);
    A/B/C/D regression; CI incorrectly passes an L3/L4/L5-missing audit.

**Authorizations granted on PASS:**
- `MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE: PASS`
- Family E PRODUCTION + auto-trigger LIVE (5 production families:
  A+B+C+D+E)
- `MCP-021C-EDGE-FAMILY-F-ENABLE` (Card 3) AUTHORIZED to design under
  Gate B surface

**Final verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<verdict notes>_
```

---

## HALT trigger disposition (all 19)

The intent brief §5 defines 19 HALT triggers. Each is mapped to a structural check in this design:

### Registry + data safety (1-7)

| # | Trigger | Structural check |
|---|---|---|
| 1 | familyRegistry.ts edit affects any family other than E | The 1-line diff is on line 91 only; the FEE-10..FEE-13 tests assert A/B/C/D byte-equal post-flip. Reviewer can verify by `git diff --stat` showing 1 file / 1 line / +1 / -1 on `familyRegistry.ts`. |
| 2 | Family A/B/C/D `productionEnabled` flipped (already true; do NOT touch) | A/B/C/D remain `true` (FEE-10..FEE-13 + FR-* assertions). |
| 3 | Auto-trigger dispatcher hard-codes families (must stay registry-derived) | Dispatcher has NO family literals (DREG-2, TRG-18); no dispatcher edit in this card. |
| 4 | E `adminValidationEnabled` flipped to false (must stay true) | FEE-2 explicitly asserts `adminValidationEnabled: true` post-flip. |
| 5 | Source 6 filter change | `machineObservationPersistenceQuery.ts:127` not edited; not in scope. |
| 6 | Persistence schema change | No migration in this card. |
| 7 | Subset filter (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) entry added for E (E is uniform ai_classifier; should NOT need an entry) | FEE-14 asserts no `argument_scheme` entry in the constant block (source-text scan). |

### Protocol + security (8-13)

| # | Trigger | Structural check |
|---|---|---|
| 8 | New taxonomy keys | `nodeLabelTypes.ts` not edited; no new families. |
| 9 | MCP schema version change | `mcpBooleanObservationSchema.ts` not edited. |
| 10 | Family A/B/C/D/E/F prompt changes (NO change to existing prompts) | No `mcp-server/familyEPrompt.ts` edit; no `mcp-server/familyFPrompt.ts` edit; no `familyE.ts` definition edit. |
| 11 | Hosted MCP server file changes | `mcp-server/**` not edited; Deno baseline (871 tests) preserved byte-equal. |
| 12 | Secret exposure | No new env vars; no key logging. |
| 13 | Logs raw body/prompt/response/token/key | `emitAutoTriggerLog` byte-equal preserved; structured tags only. |

### Architecture (14-15)

| # | Trigger | Structural check |
|---|---|---|
| 14 | Auto-trigger broken for A/B/C/D (existential) | Per-iteration try/catch isolates each family iteration (`dispatchOneFamilyIteration` lines 224-356); smoke Phase 2 verifies A+B+C+D still fire alongside E. |
| 15 | Test forecast > +90 | Forecast is +21 to +30; well under +90 ceiling. |

### Enforcement-loop (16-18)

| # | Trigger | Structural check |
|---|---|---|
| 16 | Smoke audit lacks `Audit-Lint: v1` marker | Smoke template skeleton (§"Smoke template skeleton" above) places the marker on line 3. |
| 17 | Smoke audit fails local pre-lint OR CI for an L1-L6 violation | Phase 8 makes local pre-lint a precondition for push; CI workflow run ID required in Phase 7 provenance subsection; the enforcement loop is "the lint working as designed", not a card failure. |
| 18 | Smoke audit Phase 3 (targeted-signal) does not include a deliberately-scheme-targeted argument and ≥1 positive result row | Phase 3 explicitly requires deliberately-targeted text and ≥1 positive result row; PARTIAL/FAIL conditions in Phase 8 verdict criteria match the L4 mechanical CI rule. |

### Working tree (19)

| # | Trigger | Structural check |
|---|---|---|
| 19 | Unclassified untracked files at PR creation | Working tree contains only the 10 known operator-territory untracked files (intent §5 + §11 + reviewer's standard hygiene check); designer commits ONLY the design doc. |

**Zero HALT triggers fire** under this design. The card is a single-boolean flip with structural protections against each named risk.

---

## File-touch matrix

### NEW files (this card)

| File | Purpose | Lines (approx) |
|---|---|---|
| `docs/designs/MCP-021C-EDGE-FAMILY-E-ENABLE.md` | This design doc | ~600 |
| `__tests__/edgeFamilyEProductionEnable.test.ts` | Dedicated card-scoped binding for Family E production flip + subset-filter-not-applied defensive guards (FEE-1..FEE-15) | ~150 |
| `docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-template.md` | Smoke template with `Audit-Lint: v1` marker + 8-phase outline incl. L3+L4+L5 | ~200 |

### MODIFIED files (this card)

| File | Change | Net lines | Tests affected |
|---|---|---|---|
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | Line 91: `productionEnabled: false` → `productionEnabled: true` | +1/-1 (1 char effective) | All registry tests (see Test plan) |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` | FE-2, FE-4, FE-6 inverted: pre-flip "admin-only" assertions become post-flip "production-enabled" assertions; FE-1, FE-3, FE-5, FE-7, FE-8 byte-equal | 0 net | FE-2, FE-4, FE-6 |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5, FR-6, FR-7, FR-16, FR-26 (new line for E), FR-28, FR-30, FR-32 updated: A+B+C+D → A+B+C+D+E | 0 net | ~8 assertions |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1, FE-3, FE-4: "FOUR" → "FIVE"; FE-7 list drops E | 0 net | ~4 assertions |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | AVM-13 mixed-list expands to include E; optional new AVM for E single-family production filter | +1 net | 1-2 assertions |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 production list expands to 5; DREG-31 F-J list (E removed) | 0 net | 2 assertions |
| `docs/core/current-status.md` | Handoff paragraph (~1 paragraph appended; per intent §10 ledger) | +30 to +50 lines | none (docs) |

### DELETED files

**None.**

### Explicit NON-TOUCH list

The following files / surfaces are READ-ONLY in this card. Any edit fires the corresponding HALT trigger:

| File / surface | Why read-only | HALT trigger |
|---|---|---|
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | Registry-derived; no code change needed | #3 |
| `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` | Subset filter mode-agnostic; preserved byte-equal | #7 |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Single per-call orchestrator; no signature change | DREG-32 invariant |
| `supabase/functions/submit-argument/index.ts` | Dispatcher call site preserved byte-equal | TRG-1..TRG-10 invariants |
| `supabase/functions/classify-argument-boolean-observations/index.ts` | Edge classifier HTTP handler; admin_validation path unchanged | #5 |
| `mcp-server/**/*` (including `mcp-server/lib/familyE*.ts` and `familyF*.ts`) | Hosted MCP server byte-equal | #10, #11 |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` | Source 6 production filter preserved byte-equal | #5 |
| `src/features/nodeLabels/machineObservationDefinitions/familyE.ts` | Family E definitions byte-equal (16 keys uniform ai_classifier) | #10 |
| `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` | Family F definitions byte-equal (just shipped Card 1) | #10 |
| All Family A-F prompts (`mcp-server/familyAPrompt.ts`, etc.) | No prompt change | #10 |
| All migration files | No schema change | #6 |
| All `nodeLabelTypes.ts` taxonomy | No new taxonomy keys | #8 |
| All MCP schema files (`mcpBooleanObservationSchema.ts`) | No schema version change | #9 |
| `package.json` | No dep install (RO-36 ratchet) | intent §2 OUT |
| `scripts/ops/audit-lint*` | No audit-lint rule change | intent §2 OUT |

The card's edit surface is exactly **3 new files + 6 modified files** (1 source + 5 tests + 1 docs).

---

## Test forecast

**Net new tests:** +21 (within +25 to +60 budget). Conservative upper bound: +30.

**Forecast breakdown:**
- New `edgeFamilyEProductionEnable.test.ts`: +20 (15 named FEE-* tests; effective ~20 tests counting FEE-7 iterations × 5 + FEE-10..FEE-13 × 4 + 2 subset guards + 6 core)
- New AVM-style production filter test (E single-family): +1
- Stale-assertion updates across 5 existing files: 0 net (assertions flipped, not added or removed)

**HALT ceiling:** +90 (per intent §7).

**Conservative band:** +21 to +30 — safely centered in the forecast range; structurally bounded by the card scope (one boolean flip + binding tests).

---

## Brief ledger

This design was authored by the roadmap-designer subagent against an **operator-authored intent brief** at `docs/designs/MCP-021C-EDGE-FAMILY-E-ENABLE-intent.md` (committed at `f23aba1`). The intent brief carries the binding operator decisions D1-D8 and the 19 HALT triggers.

### Sections derived from prior Phase framing handoffs (operator-validated source-of-truth chain)

- **Phase A.2 (auto-trigger 5-family inclusion):** derived from Card 1 of prior launch (`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`) which made the dispatcher registry-derived (`DREG-1..DREG-34`), and from Family D production-enable smoke (Phase 2 confirmed 4-family sequential dispatch ~19s). Pattern: registry-derived dispatcher; no code change needed for new family.
- **Phase A.3 (subset filter NOT applied for E):** derived from `docs/designs/MCP-021C-EDGE-FAMILY-D-ENABLE.md` §"Phase A.3" (Family D Stage 2B subset filter; mode-agnostic) + intent brief §3 (D3 BINDING: no subset filter for E because uniform ai_classifier). Pattern: subset filter is opt-in per family; absence = full passthrough.
- **Phase A.4 (latency projection):** derived from Family E admin_validation baseline (16 keys × 3 args ≈ 16.73s) + Family D production smoke per-family table. Pattern: ~5-6s per family typical; ~26s for 5-family sequential.
- **Smoke template L3+L4+L5 obligations:** derived from intent §4 D6 + audit-lint rules in `scripts/ops/audit-lint-rules.cjs` (REQUIRED_PHASES_BY_AUDIT_TYPE.production-enable, L3_REQUIRED_ASSERTIONS, L4_RESULT_ROW_EVIDENCE, L5_PERSISTED_INSPECTION_PATTERNS, DOCTRINE_RISK_FAMILIES includes `argument_scheme`). Pattern: production-enable audits MUST satisfy dispatch + targeted-signal + read-path; doctrine-risk audits MUST inspect persisted output.

### Sections derived from pre-launch codebase survey

- **File-touch matrix** + **HALT trigger table** mapped from current source files at HEAD `f23aba1`. All file paths + line numbers verified against the actual repo state at design time.
- **Stale-assertion updates** identified by Grep against existing test files; the 5 files + ~13 assertion updates are all anticipated by intent §7.
- **Family E uniformity re-verification (16 keys uniform `ai_classifier`)** done via direct read of `src/features/nodeLabels/machineObservationDefinitions/familyE.ts` confirming the shared `buildScheme()` helper sets `source: 'ai_classifier'` on every entry.
- **Test count baselines** from intent §0 ("Baseline: Jest 18,153 / Deno 871").

### Sections derived from epic framing

- **Goal paragraph and Stage 2B NOT REQUIRED section:** derived from intent brief §1-3 (chain position; one-boolean flip scope; no architectural decision required mid-card).
- **Doctrine self-check** (implicit in the HALT trigger table and the smoke template Phase 4b L5 doctrine inspection): derived from `cdiscourse-doctrine` skill §1 (gameplay-routing not verdict), §4 (AI moderator hard limits — Family E ban-list scan ensures no fallacy / weak / invalid / etc.), §7 (no AI calls from client; all stays in Edge + MCP server), §10a (Machine Observations are structural).

### Sections resolved by orchestrator default rather than explicit operator direction

- **Test file naming convention** — the new file uses `edgeFamilyEProductionEnable.test.ts` to mirror the Family D pattern (`edgeFamilyDProductionEnable.test.ts`). The intent brief does not name the file; the orchestrator default mirrors the precedent.
- **Test surface count distribution** — the design lands at +21 net (slightly above the +20 of Family D card); within the +25 to +60 intent forecast. The orchestrator default biased toward "match Family D's defensive coverage shape" rather than a bare-minimum surface.
- **Smoke template structure** — the 8-phase outline mirrors the Family D enablement smoke audit's structure; phases 4b (L5 doctrine) is new vs Family D (which did not have a doctrine-risk family). The orchestrator default expanded the template to include the Family E-specific L5 scan.

### Operator-deferred review surface (post-ship)

After ship + post-merge smoke:
1. Confirm 5-family auto-trigger captures clean run rows for all 5 families in Phase 2.
2. Decide whether to amend the `familyRegistry.ts` header comment to reflect the post-Card-2 state (it currently describes the post-Card-1 / post-D state; this card flips E).
3. Confirm Phase 3 produces a deliberately-targeted Family E positive (preferably slippery_slope for Phase 4b L5 coverage). If 0 positives, use the operator-binding stronger-fixture protocol.
4. Confirm Phase 4b doctrine ban-list scan over 13 patterns finds zero matches in persisted evidence_span.
5. Confirm Gate B disposition (HARD with observation-period; F admin baseline thin) before authorizing Card 3.

---

## Operator steps

**On PR merge:** auto-deploy via Supabase GitHub integration. The `submit-argument` and `classify-argument-boolean-observations` Edge Functions redeploy with the new `familyRegistry.ts` source; no separate operator command required.

Specifically:
- `npx supabase functions deploy submit-argument --linked` — **fires automatically** via the GitHub integration (per memory-index `supabase-merge-autodeploy.md`)
- `npx supabase functions deploy classify-argument-boolean-observations --linked` — **fires automatically** via the GitHub integration
- No `npx supabase db push --linked` needed (no migration)

**After auto-deploy completes (~30-90s post-merge):**
- Operator runs the 8-phase post-merge smoke per the template skeleton above
- Smoke audit committed to `docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-<date>.md`
- Local pre-lint `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push
- CI MUST run on the smoke audit PR and exit 0 (L1-L6 mechanically enforced; L3+L4+L5 obligations met from authoring time)
- On PASS, the chain progresses to Gate B (HARD with observation-period) → operator decides Card 3 path

**Emergency rollback:** if Family E production starts producing systemic failures (e.g., all 5-family dispatches timing out), the operator can flip `semantic_referee_runtime_config.enabled = false` via SQL — this halts auto-trigger for ALL families (A+B+C+D+E) at the next dispatch. Per-family rollback (just E) requires a follow-up PR flipping the boolean back; the kill switch is dispatch-wide, not per-family.

---

## Summary line

This is the smallest possible production-mode flip: **1 boolean** at line 91 of `familyRegistry.ts`. The dispatcher (registry-derived), the Edge subset filter (correctly absent for E because uniform ai_classifier), and the OPS observability surface (5-family-aware) are all already prepared. Tests confirm 5-family production posture + subset-filter-NOT-applied for E. Test forecast: **+21** (within +25 to +60 budget; HALT +90). Zero HALT triggers fire. **First production-enable card to ship its smoke audit under L3+L4+L5 mechanical CI enforcement.** Open questions: zero.
