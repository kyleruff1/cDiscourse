# MCP-021C-EDGE-FAMILY-F-ENABLE — Family F production-mode flip

**Status:** Design draft
**Epic:** MCP — production-mode enablement
**Release:** Card 3 (terminal) of 3 in the FAMILY-F-SHIP → EDGE-FAMILY-E-ENABLE → EDGE-FAMILY-F-ENABLE chain
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/347
**Intent brief:** `docs/designs/MCP-021C-EDGE-FAMILY-F-ENABLE-intent.md` (operator-authored, committed at `24ccb45`)
**Branch:** `feat/MCP-021C-EDGE-FAMILY-F-ENABLE`
**Predecessors on main:**
- `1ca701a` audit(MCP-021C-EDGE-FAMILY-E-ENABLE): smoke PASS — first production-enable card under L3+L4+L5 mechanical CI enforcement; 5-family A+B+C+D+E live
- `9a3d8fe` MCP-021C-EDGE-FAMILY-E-ENABLE ship (PR #346; Card 2 of the chain; pattern reference for this card)
- `deff068` audit-amend(MCP-SERVER-007-FAMILY-F): PASS — Family F admin baseline live (9 runs; 19 persisted rows; 0 dirty rows; doctrine-clean evidence_span across 16 patterns)
- `5591b76` audit(MCP-SERVER-007-FAMILY-F): PARTIAL (predecessor of the amendment)
- `1ee8ab3` MCP-SERVER-007-FAMILY-F ship (PR #344; Card 1 of the chain)
- `87a2784` audit(OPS-MCP-SMOKE-LINT-CI-WIRING): PASS — L3+L4+L5 mechanically enforced in CI

---

## Goal (one paragraph)

Flip one boolean — `productionEnabled: false → true` for the `critical_question` (Family F) entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (currently line 96). After merge + auto-deploy, every new argument submitted via `submit-argument` will fire SIX sequential production runs (A+B+C+D+E+F) instead of five. The dispatcher is registry-derived (`autoTriggerDispatcher.ts:87,403,431`); the Edge subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` MUST NOT receive an entry for `critical_question` because Family F's 14 keys are uniform `ai_classifier` (verified in Card 1 designer Phase A.1; re-verified in Phase A.3 below by direct read of `familyF.ts`); and the OPS observability surface is family-agnostic. The card respects cdiscourse-doctrine §1 (production flip is a routing decision, never a verdict on Family F's critical-question quality), §10a (Family F rows persist as Machine Observations with `source = 'machine'`; the critical-question framing is structurally distinct from "this argument is wrong"), and §7 (no AI calls leak to client; all classification stays inside Edge Functions + the hosted MCP server). **Second production-enable card to ship its smoke audit under L3+L4+L5 mechanical CI enforcement; FIRST card with L5 BINDING enforcement (Family F is doctrine-risk-by-construction per intent §6 D6.L5 — every key surfaces a critical question that, naively rendered, could read as a verdict on the argument's quality).**

---

## Stage 2B NOT REQUIRED

The production-flip decision was made at Gate B (operator-authorized chain-through after Card 2 PASS, with explicit data review). Per Gate B baseline (intent §3):
- Family F admin_validation: 9 runs (5 success / 4 failed `mcp_validation_failed` — proportionate to cross-family baseline)
- 19 persisted result rows from 5 successful runs; 6 of 14 keys observed
- Q14 density: 27.1% per-(run,key) — above Family E baseline 14.6%
- Doctrine scan over 19 rows × 16 patterns: **0 dirty rows; 0 fallacy echoes**
- `consequence_probability_unclear` fired 2× on production-doctrine-paired key; doctrine-clean
- Failure pattern proportionate to baseline (3 failures on arg `781f8057`; 1 on arg `f1757532`)

Family F uniformity (`source: 'ai_classifier'` across all 14 keys) was verified at Card 1 designer Phase A.1 and is re-verified in Phase A.3 below by direct read of `src/features/nodeLabels/machineObservationDefinitions/familyF.ts`. No subset filter needed. No architectural complexity surfaces during designer Phase A — this is a one-boolean flip with defensive tests + a smoke audit that satisfies L3+L4+L5+L5-BINDING. **No internal Stage 2B operator decision required mid-card.**

Stage 2 of the chain is CONDITIONAL HALT only (20 triggers in §"HALT trigger disposition" below).

---

## Phase A.1 — familyRegistry current + post-flip state

Verbatim read of `supabase/functions/_shared/booleanObservations/familyRegistry.ts` at HEAD (`24ccb45`; this branch):

### Family F entry pre-flip (current state)

```ts
// supabase/functions/_shared/booleanObservations/familyRegistry.ts:94-98
{
  family: 'critical_question',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

Line numbers: opening brace at line 94; `family:` at 95; **`productionEnabled: false,` at 96**; `adminValidationEnabled: true,` at 97; closing brace at line 98.

### Family F entry post-flip (target state)

```ts
{
  family: 'critical_question',
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
| 4 | argument_scheme (E) | **true** | true | 89-93 | none (byte-equal) |
| 5 | **critical_question (F)** | **false → true** | true | **94-98** | **1 boolean character** |
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

Post-flip behaviour: returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme', 'critical_question']` (length 6, A→F registry order).

### `filterFamiliesForMode()` function shape

Lines 141-156 — unchanged byte-equal. Post-flip, `filterFamiliesForMode(['critical_question'], 'production')` returns `['critical_question']` (currently returns `[]`).

**Phase A.1 verdict: BINDING YES.** The 1-line diff is exactly 1 boolean character (line 96). A/B/C/D/E remain `true`; G/H/I/J remain `false`; all `adminValidationEnabled` values remain `true`. The exported function signatures and bodies are byte-equal preserved.

---

## Phase A.2 — Auto-trigger 6-family inclusion mechanism (registry-derived, sequential loop)

`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` verbatim citations:

- **Line 87** — registry import:
  ```ts
  import { productionEnabledFamilies } from './familyRegistry.ts';
  ```
- **Line 403** — production family list materialised at runtime:
  ```ts
  const eligibleFamilies = productionEnabledFamilies();
  ```
- **Lines 421-438** — sequential `for-of` loop iterates eligible families:
  ```ts
  // ── Per-family sequential loop ───────────────────────────────
  // Sequential `for-of` (NOT Promise.all) per Stage 2B operator
  // preference: observability + idempotency clarity + per-family run
  // rows are easier to reason about when each family runs to
  // completion before the next starts. Family A is the first entry
  // (registry order A→J) so its iteration runs first. A failure in
  // one family iteration does NOT abort the next iteration — the
  // per-iteration try/catch inside dispatchOneFamilyIteration
  // isolates each family.
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

### Projection: after the flip, 6 sequential iterations per arg

Pre-flip (current HEAD `24ccb45`, post Card 2 ship): `productionEnabledFamilies()` returns `[A, B, C, D, E]` (length 5). The for-of loop runs 5 iterations. Card 2 smoke at `1ca701a` empirically confirmed 5/5 runs success on a deliberately scheme-targeted submit-argument call (run ids `160d1392`, `8afc4ed4`, `1e5977f3`, `1fcfa09b`, `d9e3d676`; ~22s background dispatch).

Post-flip: `productionEnabledFamilies()` returns `[A, B, C, D, E, F]` (length 6). The for-of loop runs 6 iterations. The dispatcher's per-iteration try/catch (in `dispatchOneFamilyIteration` lines 224-356) preserves failure isolation — one family's failure does not abort the next iteration.

**Per Stage 2B operator binding from the prior launch (Card 1: B/C enablement), the loop is intentionally SEQUENTIAL (NOT `Promise.all`).** DREG-6 asserts no `Promise.all` over the family list:
```ts
expect(dispatcherText).not.toMatch(/Promise\.all\s*\([\s\S]*?productionEnabledFamilies/);
```

Failure isolation invariant preserved: a Family F iteration failure produces a clean `outcome: 'failed'` with `failureReason`; the dispatcher returns 6 outcomes total even when one (or more) family iteration fails.

**Phase A.2 verdict: BINDING YES.** The registry-derived dispatcher already picks up F after the flip — **no dispatcher code change required.** HALT trigger #3 (auto-trigger dispatcher hard-codes families) is structurally impossible: there are zero family literals in the dispatcher to hard-code. HALT trigger #14 (auto-trigger broken for A/B/C/D/E — existential) is structurally guarded because each family iteration runs in its own try/catch and the loop iterates regardless of prior outcomes.

---

## Phase A.3 — Subset filter NOT applied verification

### Family F uniformity (re-verified at design time by direct read)

`src/features/nodeLabels/machineObservationDefinitions/familyF.ts` — all 14 entries declare:

```ts
source: 'ai_classifier' as const,
family: 'critical_question' as const,
```

via the shared `buildCritical()` helper (lines 52-76, applied 14 times for keys: `missing_warrant`, `unstated_assumption`, `authority_basis_missing`, `causal_mechanism_missing`, `analogy_mapping_missing`, `example_representativeness_unclear`, `consequence_probability_unclear`, `definition_boundary_unclear`, `criterion_weighting_unclear`, `alternative_explanation_available`, `counterexample_available`, `scope_limit_unstated`, `qualification_missing`, `comparison_baseline_missing`). Verified at design read: all 14 builder calls produce `source='ai_classifier'`. No deterministic auto_metadata / lifecycle source mixed in. Family F is **uniform** `ai_classifier`. This matches Card 1 designer Phase A.1 verification (intent §5 D3).

### Subset filter constant — confirmed NO entry for critical_question

`supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts:68-72` verbatim:

```ts
const MCP_SERVER_SUPPORTED_FAMILY_SOURCES: Readonly<
  Partial<Record<MachineObservationFamily, ReadonlySet<MachineObservationSource>>>
> = Object.freeze({
  evidence_source_chain: Object.freeze(new Set<MachineObservationSource>(['ai_classifier'])),
});
```

**The only key in the map is `evidence_source_chain` (Family D).** No `critical_question` entry exists. This is the correct state: Family F does NOT need a subset filter entry because all 14 of its keys are already `ai_classifier`. Adding an entry would be no-op at best and confusing at worst; defense-in-depth doctrine says "absence = full passthrough"; Family F uniformity makes "full passthrough" already mean "ai_classifier-only".

### Builder semantics under production-mode for Family F

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

For a production-mode Family F request post-flip:
1. `filterFamiliesForMode(['critical_question'], 'production')` returns `['critical_question']` (post-flip).
2. Iteration over the registry encounters all 14 Family F entries; each passes the `eligibleFamilies.includes(def.family)` check.
3. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['critical_question']` is `undefined` → `allowedSources` is falsy → the `&&` short-circuits → the entry passes through.
4. All 14 rawKeys land in `rawKeySet`; all 14 definitions land in the map.

**Production-mode Family F request contains exactly 14 ai_classifier rawKeys** — the full Family F set. Identical shape under admin_validation mode (mode-agnostic passthrough since no entry exists).

### Defensive test design

Two structural tests assert this state:
- `FFE-15` asserts no `critical_question` entry in the subset filter constant block via direct source-text scan (mirrors Card 2 `FEE-14`).
- `FFE-16` asserts the production-mode Family F builder returns all 14 ai_classifier rawKeys, byte-equal vs the admin_validation-mode set (mirrors Card 2 `FEE-15`).

**Phase A.3 verdict: BINDING YES.** Family F does NOT need a subset filter entry; one MUST NOT be added in this card; the defensive tests assert the absence. HALT trigger #7 (subset filter present/absent for F mismatches Card 1's T1 outcome — T1 NOT FIRED in Card 1 → NO entry for F should exist) is structurally guarded by the two tests and the read-only boundary list.

---

## Phase A.4 — Latency + dispatcher sequential-loop projection for 6 families

### Card 2 empirical baseline (1ca701a)

From the Card 2 smoke audit at `docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-2026-05-28.md` Phase 2:

| run | family | run_mode | status | duration |
| --- | --- | --- | --- | --- |
| 160d1392 | parent_relation | production | success | ~5s |
| 8afc4ed4 | disagreement_axis | production | success | ~5s |
| 1e5977f3 | misunderstanding_repair | production | success | ~5s |
| 1fcfa09b | evidence_source_chain | production | success | ~6s |
| d9e3d676 | argument_scheme | production | success | ~6s |

**Total 5-family sequential observed: ~22s** (better than the design A.4 projection of ~25.6s). Per Card 2 Phase 7: total dispatch wall-time 22s, headroom ~6.8x against `EdgeRuntime.waitUntil` budget.

### Family F per-family from Card 1 amendment baseline

From the Card 1 Family F amendment (`deff068`) Phase 4 Edge admin_validation: 14 keys × 3 args ≈ 24s total → ~8s/arg average. Per-arg single-family auto-trigger projection (one arg, single Family F call): ~5-6s typical (matching Family E's per-arg ≈ 5-6s; the 24s/3args includes batched cross-arg overhead).

### 6-family sequential per-arg projection

```
A (~5s) + B (~5s) + C (~5s) + D (~6s) + E (~6s) + F (~5-6s) ≈ 27-28s per arg
```

Conservative upper bound (each family at its slowest observed): ~5s + ~5s + ~5s + ~6.5s + ~6.5s + ~6s ≈ 34s per arg.

### Background dispatch budget

The dispatcher runs as `EdgeRuntime.waitUntil(autoTriggerPromise)` from `submit-argument`. The user-facing submit response returns BEFORE the dispatcher's promise settles (~50-200ms; verified in Card 2 Phase 2 where HTTP 201 was returned in 4s wall time). Supabase Edge Function `EdgeRuntime.waitUntil` background-task budget is platform-documented at ~150s.

**Headroom analysis:**
- 6-family typical per-arg: ~27-28s
- `EdgeRuntime.waitUntil` budget: ~150s
- Headroom: ~5.4x
- 45s partial threshold: ~38% margin

**Worst-case per-family slowdown bounds:**
- Per-iteration timeout `DEFAULT_REQUEST_TIMEOUT_MS` = 12s (booleanObservationRequestBuilder.ts:38)
- Retry policy: MAX_ATTEMPTS=2, RETRY_BACKOFF_MS=[2_000, 8_000] (autoTriggerDispatcher.ts:97,114)
- Worst case per family: 12s + 2s + 12s = 26s (attempt 1 timeout + backoff + attempt 2 timeout); or 12s + 8s + 12s = 32s if hit the second backoff
- 6-family worst case: 6 × 32s = 192s — **over the 150s budget**

The worst-case is reached only when ALL 6 families hit the MAX_ATTEMPTS retry path. In practice, Card 2 Family E observed total ~22s (well under projection). The retry path is for transient failures (mcp_network_error / mcp_api_error / mcp_rate_limited per `RETRYABLE_FAILURE_REASONS`); non-retryable failures (e.g., schema validation failure) terminate immediately. Worst-case retry exhaustion across all 6 families simultaneously is extremely unlikely under healthy hosted MCP conditions.

**Phase A.4 verdict: BINDING YES.** 6-family sequential dispatch projects ~27-28s typical (within `EdgeRuntime.waitUntil` tolerance; 38% margin under 45s partial threshold). The dispatcher's failure isolation (per-iteration try/catch) protects A/B/C/D/E from any Family F slowdown. HALT trigger #14 (auto-trigger broken for A/B/C/D/E — existential) is structurally impossible because each family iteration runs in its own try/catch and the loop iterates regardless of prior outcomes.

---

## Test plan: dedicated card-scoped binding (FFE-1..FFE-16)

Following the Card 2 pattern (`__tests__/edgeFamilyEProductionEnable.test.ts`), this card adds **one new test file** + light updates to existing files. The new file is the dedicated card-scoped binding that locks in the post-flip Family F state.

### New test file — `__tests__/edgeFamilyFProductionEnable.test.ts`

Mirrors Card 2's FEE-* pattern structurally. Test surface count: **~17 individual tests** counting parametric `for` iterations (FFE-1..FFE-6 core flip + FFE-7 × 4 for G/H/I/J non-widening + FFE-8/FFE-9 index/order + FFE-10..FFE-14 × 5 for A/B/C/D/E unchanged + FFE-15/FFE-16 subset-filter-not-applied + FFE-17 14-key surface).

```ts
import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — Family F production-mode flip binding', () => {
  it('FFE-1 — Family F entry has productionEnabled: true (post Card 3 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('critical_question');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-2 — Family F entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('critical_question');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FFE-3 — edgeProductionEnabledFamilies() includes critical_question', () => {
    expect(edgeProductionEnabledFamilies()).toContain('critical_question');
  });

  it('FFE-4 — edgeProductionEnabledFamilies() has length 6 (post Card 3 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(6);
  });

  it('FFE-5 — edgeProductionEnabledFamilies() preserves registry A→F order', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
    ]);
  });

  it('FFE-6 — edgeFilterFamiliesForMode([critical_question], production) keeps critical_question', () => {
    expect(edgeFilterFamiliesForMode(['critical_question'], 'production')).toEqual([
      'critical_question',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — G–J remain admin-only (no widening past F)', () => {
  const GJ_ADMIN_ONLY = [
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of GJ_ADMIN_ONLY) {
    it(`FFE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — Family F is the 6th entry; registry order preserved', () => {
  it('FFE-8 — Family F occupies index 5 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[5].family).toBe('critical_question');
    expect(EDGE_FAMILY_REGISTRY[5].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[5].adminValidationEnabled).toBe(true);
  });

  it('FFE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — A/B/C/D/E production posture unchanged', () => {
  // HALT trigger #2: A/B/C/D/E productionEnabled flipped (already true; do not touch).
  // These assertions catch any accidental drift on A/B/C/D/E state during
  // the Family F flip.
  it('FFE-10 — Family A (parent_relation) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-11 — Family B (disagreement_axis) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-12 — Family C (misunderstanding_repair) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-13 — Family D (evidence_source_chain) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-14 — Family E (argument_scheme) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — subset filter NOT applied to Family F (defensive guard for HALT trigger #7)', () => {
  it('FFE-15 — MCP_SERVER_SUPPORTED_FAMILY_SOURCES has NO entry for critical_question', () => {
    // Family F is uniform ai_classifier (all 14 keys); a subset filter
    // entry would be a no-op at best and a doctrinal confusion at worst.
    // The intent brief HALT trigger #7 binds this: "Subset filter
    // present/absent for F mismatches Card 1's T1 outcome (T1 NOT FIRED
    // in Card 1 → NO entry for F should exist)".
    const fs = require('fs');
    const path = require('path');
    const builderPath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
    );
    const builderText = fs.readFileSync(builderPath, 'utf8');
    // The constant block must not contain a key 'critical_question'.
    // The only key in the map at the time of this card is
    // 'evidence_source_chain' (Family D Stage 2B subset filter).
    const constantBlock = builderText.match(
      /MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]{0,500}\}\);/,
    );
    expect(constantBlock).not.toBeNull();
    expect(constantBlock![0]).not.toContain('critical_question');
  });

  it('FFE-16 — production-mode Family F request contains all 14 ai_classifier rawKeys (no subset filter)', () => {
    // Defensive: confirms the production-mode builder returns the full
    // 14-key Family F set, identical to admin_validation-mode. The
    // subset filter is absent for F → full passthrough.
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-f-prod-1',
      parentArgumentId: 'arg-f-prod-0',
      currentText: 'a reply with possible critical-question content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['critical_question'],
      mode: 'production',
    });
    expect(req.requestedRawKeys.length).toBe(14);
    // Byte-equal vs admin_validation-mode (mode-agnostic since no subset
    // filter):
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-f-prod-1',
      parentArgumentId: 'arg-f-prod-0',
      currentText: 'a reply with possible critical-question content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['critical_question'],
      mode: 'admin_validation',
    });
    expect([...req.requestedRawKeys].sort()).toEqual([...reqAdmin.requestedRawKeys].sort());
  });
});
```

The new file uses `require('fs')` and `require('path')` inside the test body for the source-text scan (matching the AVM-14 / FEE-14 pattern). It imports `edgeBuildBooleanObservationRequestForArgument` from the existing test helper at `__tests__/_helpers/booleanObservationEdgeDeno.ts` (already exported and used elsewhere; not modified).

### Updated existing test files (stale-assertion updates anticipated)

These files contain Card 2 assertions that name "5 families" or "A+B+C+D+E"; Card 3 flips them to "6 families" or "A+B+C+D+E+F". No assertion is removed or loosened; each becomes a stronger post-flip binding at the new 6-family baseline.

| File | Tests affected | Nature of change | Net count |
|---|---|---|---|
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5, FR-6, FR-16, FR-28 (G/H/I/J list), FR-30 (index 5 binding), FR-32 (PRODUCTION_ENABLED_NAMES set) | Expand A+B+C+D+E list to A+B+C+D+E+F; F moves from "production-disabled" set to "production-enabled" set; index 5 binding flips from "argument_scheme" check on length 5 to "critical_question" check on length 6 | 0 net (~6 assertions flipped) |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1, FE-2, FE-3, FE-4: "FIVE" → "SIX"; FE-7 list drops F; new FE-13 (or equivalent) for F explicit binding | 0 net (~5 flipped) + 1 new explicit binding | +1 net |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | AVM-13 (mixed list); add an AVM for F single-family production filter (parallel to AVM-11b for E) | Production filter now keeps F in mixed lists | +1 net (new AVM-11c or relabel) |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 (production list = 6 families), DREG-31 (G/H/I/J list — F removed) | DREG-29 expands [A, B, C, D, E] to [A, B, C, D, E, F]; DREG-31 narrows G/H/I/J list (F removed) | 0 net (~2 flipped) |

**Update discipline:** each updated assertion becomes a stronger post-flip binding at the new 6-family baseline; no assertion is removed or loosened. The catch-accidental-widening property is preserved.

### Test forecast summary

| Surface | Test count delta | Notes |
|---|---|---|
| New `edgeFamilyFProductionEnable.test.ts` (FFE-1..FFE-16; ~17 individual tests counting `for` iterations) | **+17** | Dedicated card-scoped binding (6 FFE core + 4 FFE-7 iterations for G/H/I/J + 2 FFE-8/9 + 5 FFE-10..14 + 2 FFE-15/16 subset guards) |
| Updated `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | 0 net (~6 flipped) | A→E becomes A→F throughout |
| Updated `mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | +1 net (~5 flipped + 1 new explicit F binding) | "FIVE" → "SIX"; F exits FE-7 list; new FE-13 mirrors Card 2's FE-12 |
| Updated `mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | +1 net (new AVM-11c for F parallel to AVM-11b) | Production filter mixed-list test gains F coverage |
| Updated `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | 0 net (~2 flipped) | DREG-29 production list expands to 6; DREG-31 narrows G/H/I/J |
| **Net new tests** | **+19 (typical) to ~+25 (conservative upper)** | Within +25 to +70 forecast (intent §8) |

Conservative upper bound for net delta (counting additional FR-* / FE-* / AVM additions if needed to harden the new posture during implementation): **+25 to +30**. Well within HALT ceiling +100 (intent §10).

**Doctrine ban-list assertions:** the new test file contains no user-facing strings (it asserts structural rawKey sets and registry state). The existing DREG-24 doctrine ban-list assertion in `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` already protects the dispatcher source from verdict tokens; it continues to hold.

---

## Smoke template skeleton

**Filename:** `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md`

**Audit-Lint: v1** marker MUST appear on line 3 (per OPS-MCP-SMOKE-LINT-CI-WIRING rule precedent; CI lint enforces this on smoke audit PRs).

### 8-phase outline (L3+L4+L5+L5-BINDING sections marked)

```markdown
# MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-021C-EDGE-FAMILY-F-ENABLE (Family F critical_question production-mode flip; 14-key uniform ai_classifier; second production-enable card under L3+L4+L5 mechanical CI enforcement; FIRST card with L5 BINDING enforcement)
**Chain position:** Card 3 (terminal) of 3 in FAMILY-F-SHIP → EDGE-FAMILY-E-ENABLE → EDGE-FAMILY-F-ENABLE (this) chain
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)

> Template binding source: intent brief §9 (8-phase smoke incl. L3+L4+L5
> mechanical CI enforcement + L5 BINDING for Family F doctrine-risk) +
> design §"Smoke template skeleton". Fill each section after merge;
> commit the completed audit to `docs/audits/` as
> `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<YYYY-MM-DD>.md`. Local pre-lint
> `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; git status clean (only the 10 known
      operator-territory untracked files).
- [ ] Edge Functions auto-deployed via GitHub integration:
      `submit-argument` and `classify-argument-boolean-observations`
      reflect post-merge version timestamps.
- [ ] Verify Edge familyRegistry Family F entry post-merge state:
      `productionEnabled: true, adminValidationEnabled: true`.
- [ ] Verify A/B/C/D/E entries byte-equal preserved (productionEnabled: true).
- [ ] Verify G/H/I/J entries byte-equal preserved (productionEnabled: false).
- [ ] Targeted regression: Jest test count ≥ 18,173 + new tests; Deno
      871 byte-equal (no mcp-server change).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Dispatch success (L3a) — 6 production runs A+B+C+D+E+F

- [ ] Submit a NEW critical-question-targeted argument via
      `submit-argument` Edge Function. **Operator binding from intent §9
      Phase 2: the targeted body MUST be a NEW critical-question-targeted
      text that's NOT `781f8057` and NOT a prior known-failing fixture
      (rules out cd67e76f / f1757532 / 5242c8cd which are Family F
      Phase 4b adversarial fixtures from Card 1 amendment).** Arg id
      recorded.
- [ ] Wait ~30s for the 6-family dispatch to complete.
- [ ] Query `argument_machine_observation_runs` for the new arg id:
      verify EXACTLY 6 production runs (run_mode='production',
      provider_key=PROVIDER_KEY) for A+B+C+D+E+F.
- [ ] All 6 runs `status='success'` (or at minimum: A+B+C+D+E+F all
      `'success'` or `'failed'` cleanly; no missing rows).
- [ ] G/H/I/J do NOT have production rows for this arg (registry-derived
      dispatcher correctly excluded them; query asserts zero matches).
- [ ] Capture latency: per-family duration table + total dispatch
      wall-time. Expected ~27-28s per design A.4.

**Result:** ☐ PASS ☐ FAIL — _<notes; arg id; run ids>_

---

## Phase 3 — Targeted-signal success (L3b + L4) — Family F positive result row required

**Per operator binding instruction (intent §9 Phase 3):** the targeted arg
MUST contain deliberately critical-question-targeted text (causal
mechanism implied without explanation; analogy without mapping;
consequence without probability anchor; warrant assumed but unstated; etc.).
**0-positives on a targeted text is NOT PASS** — use a stronger targeted
critical-question fixture before accepting PASS.

**Fallback rules (operator binding from intent §6 D6.L4 + §9 Phase 3):**
- If first targeted F production fixture returns `mcp_validation_failed`:
  do NOT mark PASS; retry once with stronger, clearer critical-question
  fixture; if still fails, HALT and file scoped fix card.

- [ ] Query `argument_machine_observation_results` for the new arg's
      Family F production run:
      `SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results r JOIN argument_machine_observation_runs runs ON runs.id = r.run_id WHERE r.family = 'critical_question' AND runs.run_mode = 'production' AND runs.argument_id = '<arg-id>';`
- [ ] Verify ≥ 1 positive result row (`raw_key` in the 14-key Family F
      set: missing_warrant, unstated_assumption, authority_basis_missing,
      causal_mechanism_missing, analogy_mapping_missing,
      example_representativeness_unclear, consequence_probability_unclear,
      definition_boundary_unclear, criterion_weighting_unclear,
      alternative_explanation_available, counterexample_available,
      scope_limit_unstated, qualification_missing,
      comparison_baseline_missing; `confidence` band emitted).
- [ ] **If 0 positives:** record the fixture text, design a stronger
      targeted fixture, resubmit, repeat. PASS REQUIRES ≥ 1 positive
      result row from targeted text.
- [ ] **If mcp_validation_failed:** apply the fallback rule above (one
      retry; HALT if second attempt fails).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<arg id; positives table; fixture
text>_

---

## Phase 4 — Read-path success (L3c) — Source 6 production rows visible

- [ ] Source 6 query path
      (`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
      `run_mode='production'` filter via PostgREST `!inner` join) returns
      the Family F production result rows for the Phase 3 arg.
- [ ] A+B+C+D+E rows ALSO present in the Source 6 result for the same
      arg (6-family production read-path coverage verified).
- [ ] admin_validation rows for the same arg (if any exist) are NOT
      counted as production proof — they are filtered out by the
      production-only filter (Source 6 separation invariant holds).
- [ ] Defensive: confirm Family F has no `deterministic_key` rows in
      production (F is uniform ai_classifier; no auto_metadata /
      lifecycle source contamination).

**Result:** ☐ PASS ☐ FAIL — _<query output excerpts>_

---

## Phase 4b — DOCTRINE (L5 BINDING) — persisted evidence_span doctrine inspection

**Doctrine binding (intent §6 D6.L5; BINDING):** Family F is doctrine-risk-
by-construction. If `consequence_probability_unclear` or any E-paired
critical-question key fires on the production-mode targeted arg, perform
the persisted-output inspection.

> **NOTE on audit-lint enforcement:** `DOCTRINE_RISK_FAMILIES` in
> `scripts/ops/audit-lint-rules.cjs` currently contains `argument_scheme`
> and `slippery_slope` but NOT `critical_question`. Per intent §2 OUT
> binding, this card MUST NOT modify `scripts/ops/audit-lint*`. The L5
> BINDING obligation in this audit is therefore **operator-binding from
> the intent brief, not CI-mechanically enforced**. The audit must
> include explicit `evidence_span` inspection content so that even if a
> future card adds `critical_question` to `DOCTRINE_RISK_FAMILIES`, this
> audit will retroactively comply. The audit author MUST treat L5 as
> binding-required (not optional) regardless of CI's current scope.

- [ ] **R1 — column pre-check:** verify the `argument_machine_observation_results`
      table has columns `raw_key`, `confidence`, `evidence_span`,
      `family`, `run_id`. (Catches a schema drift that would silently
      break the doctrine scan.) Same column set verified at Card 1
      amendment `deff068` Phase 4b and Card 2 Phase 4b.
- [ ] If `consequence_probability_unclear` or another E-paired CQ key
      fired in Phase 3: query persisted `evidence_span` from the F
      production run for the doctrine-risk-paired raw_key.
- [ ] If NOT fired: design a STRONGER targeted critical-question fixture
      whose pattern is likely to trigger one of the doctrine-risk-paired
      keys (consequence_probability_unclear / causal_mechanism_missing /
      analogy_mapping_missing / counterexample_available). Resubmit;
      query; repeat Phase 3 + 4 for the new arg.
- [ ] **Ban-list scan over 16 patterns** (same set as Card 1 amendment):
      `unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`,
      `fallacy`, `fallacious`, `flawed`, `wrong`, `weak argument`,
      `invalid argument`, `bad reasoning`, `proof of`, `weak`,
      `invalid`, `logical error`, `informal fallacy`.
- [ ] Query persisted `evidence_span` for the Family F production rows
      containing CQ keys; scan for any of the 16 patterns. Verify ZERO
      banned tokens present.
- [ ] If targeted input contained "fallacy" or similar adversarial
      verdict bait: verify NO ECHO in output `evidence_span`.
- [ ] If a banned token is present in persisted F production
      `evidence_span`: **HALT IMMEDIATELY** and FAIL (intent §6 HALT
      #17 BINDING DOCTRINE FAIL; file scoped fix card).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<fixture text; CQ rows; ban-list
scan output>_

---

## Phase 5 — Observability

- [ ] Q11 reframed (per-family per-mode coverage): Family F now shows
      production rows (FIRST real production data for F).
- [ ] Q14 density: Family F production density present. Pre-merge
      admin-baseline F density was 27.1% per-(run,key) (Gate B baseline).
      Production density may differ.
- [ ] Q9: no new `organic_duplicate_candidate` rows for the new args.
      Auto-trigger runs classify as `audit_or_smoke_rerun` (intent §6 D8).
- [ ] Rerun the observability report (`scripts/ops/mcp-observability-report.mjs --no-write`)
      and confirm Family F appears in production mode.

**Result:** ☐ PASS ☐ FAIL — _<observability report excerpts>_

---

## Phase 6 — Regression

- [ ] A/B/C/D/E production behavior unregressed (Phase 2 verified
      A+B+C+D+E ran; this section confirms there's no quality drift in
      their output for the new args).
- [ ] admin_validation still works for E + F (operator HTTP call against
      `classify-argument-boolean-observations` with `mode: 'admin_validation'`
      and `requestedFamilies: ['critical_question']` returns a Family F
      admin_validation run row; same for E).
- [ ] G/H/I/J still reject under `mcp_validation_failed` for
      admin_validation calls (unsupported-family behavior preserved).
- [ ] Local gates: `npm run typecheck`, `npm run lint`,
      `npm run test`, `cd mcp-server && deno test --allow-net
      --allow-env --allow-read` all exit 0.

**Result:** ☐ PASS ☐ FAIL — _<gate output>_

---

## Phase 7 — OPS observations + enforcement-loop provenance

**Required subsection (verbatim per intent §9 Phase 7):**

> "Third-enforcement provenance: second PRODUCTION-ENABLE card linted by
> audit-lint CI; first card under L5 BINDING enforcement. CI workflow
> run ID: `<id from PR>`; in_scope count: `<n>`; linter exit: 0. L3
> satisfied by Phases 2+3+4 (dispatch ✓ + targeted-signal ✓ + read-path
> ✓). L4 satisfied by Phase 3 targeted critical-question text producing
> ≥1 positive result row. L5 BINDING satisfied by Phase 4b persisted
> evidence_span doctrine inspection (≥1 clean firing under production
> mode)."

- [ ] Record the 6-family operational state (A+B+C+D+E+F production
      LIVE; G/H/I/J admin_validation only).
- [ ] Record latency observations (per-family + total dispatch
      wall-time).
- [ ] Doctrine-key calibration note (any unexpected Family F
      raw_key behaviour observed during the smoke).
- [ ] **Chain completion note:** 3-card chain complete; all 6 families
      production+auto-trigger; G/H/I/J unsupported.

**Result:** ☐ PASS ☐ FAIL — _<provenance subsection completed>_

---

## Phase 8 — Verdict + authorization

- [ ] **Pre-push audit-lint:** `node scripts/ops/audit-lint.mjs
      docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<date>.md` exits 0
      before push.
- [ ] CI runs on the smoke audit PR and exits 0 (L1-L6 mechanically
      enforced; L3+L4 mechanical obligations met; L5 operator-binding
      satisfied via explicit `evidence_span` content even if
      `critical_question` is not in `DOCTRINE_RISK_FAMILIES`).
- [ ] Verdict:
  - **PASS:** All phases clean; L3/L4/L5 each satisfied by an explicit
    phase; Phase 4b ≥1 clean firing (doctrine-clean); pre-lint + CI
    both exit 0; A/B/C/D/E unregressed.
  - **PARTIAL:** Phase 3 0-positives even on stronger targeted arg
    (sparse signal); Phase 4b 0-fire even after fallback fixture.
    Card 3 PASS is required to fully close the 3-card chain.
  - **FAIL:**
    - Phase 4b dirty firing (banned token in F production
      `evidence_span`) → IMMEDIATE HALT + fix card.
    - Phase 3 `mcp_validation_failed` on first AND fallback targeted
      → HALT + fix card.
    - Any non-Family-F rawKey on F run.
    - Family A/B/C/D/E byte-equal failure.
    - CI passes an L3/L4/L5-missing audit.

**Authorizations granted on PASS:**
- `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE: PASS`
- Family F PRODUCTION + auto-trigger LIVE (6 production families:
  A+B+C+D+E+F)
- 3-card chain COMPLETE
- `MCP-SERVER-008-FAMILY-G` AUTHORIZED to begin (G/H/I/J still unsupported)

**Final verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<verdict notes>_
```

---

## HALT trigger disposition (all 20)

The intent brief §6 defines 20 HALT triggers. Each is mapped to a structural check in this design:

### Registry + data safety (1-7)

| # | Trigger | Structural check |
|---|---|---|
| 1 | familyRegistry.ts edit affects any family other than F | The 1-line diff is on line 96 only; the FFE-10..FFE-14 tests assert A/B/C/D/E byte-equal post-flip. Reviewer can verify by `git diff --stat` showing 1 file / 1 line / +1 / -1 on `familyRegistry.ts`. |
| 2 | Family A/B/C/D/E `productionEnabled` flipped (already true; do NOT touch) | A/B/C/D/E remain `true` (FFE-10..FFE-14 explicit; FR-* and DREG-29 assertions). |
| 3 | Auto-trigger dispatcher hard-codes families (must stay registry-derived) | Dispatcher has NO family literals (DREG-2, TRG-18); no dispatcher edit in this card. |
| 4 | F `adminValidationEnabled` flipped to false (must stay true) | FFE-2 explicitly asserts `adminValidationEnabled: true` post-flip. |
| 5 | Source 6 filter change | `machineObservationPersistenceQuery.ts:127` not edited; not in scope. |
| 6 | Persistence schema change | No migration in this card. |
| 7 | Subset filter present/absent for F mismatches Card 1's T1 outcome (T1 NOT FIRED in Card 1 → NO entry for F should exist) | FFE-15 asserts no `critical_question` entry in the constant block (source-text scan); FFE-16 asserts the full 14-key request shape. |

### Protocol + security (8-13)

| # | Trigger | Structural check |
|---|---|---|
| 8 | New taxonomy keys | `nodeLabelTypes.ts` not edited; no new families. |
| 9 | MCP schema version change | `mcpBooleanObservationSchema.ts` not edited. |
| 10 | Family A/B/C/D/E/F prompt changes (NO change to existing prompts) | No `mcp-server/familyFPrompt.ts` edit (deployed at Card 1 ship `1ee8ab3`); no `familyF.ts` definition edit; no other family prompt edit. |
| 11 | Hosted MCP server file changes | `mcp-server/**` not edited; Deno baseline (871 tests) preserved byte-equal. |
| 12 | Secret exposure | No new env vars; no key logging. |
| 13 | Logs raw body/prompt/response/token/key | `emitAutoTriggerLog` byte-equal preserved; structured tags only. |

### Architecture (14-15)

| # | Trigger | Structural check |
|---|---|---|
| 14 | Auto-trigger broken for A/B/C/D/E (existential) | Per-iteration try/catch isolates each family iteration (`dispatchOneFamilyIteration` lines 224-356); smoke Phase 2 verifies A+B+C+D+E still fire alongside F. |
| 15 | Test forecast > +100 | Forecast is +19 to +25 typical; conservative upper +30; well under +100 ceiling. |

### Doctrine — F-specific (16-17)

| # | Trigger | Structural check |
|---|---|---|
| 16 | Production-mode smoke missing live adversarial critical-question evidence_span inspection (L5 BINDING; existential) | Phase 4b template explicitly requires R1 column pre-check + persisted `evidence_span` query + 16-pattern ban-list scan + 0-fire-fallback rule. The template's Phase 4b is mandatory (NOT optional) per intent §6 D6.L5 and §9 Phase 4b BINDING. |
| 17 | Any F production output evidence_span contains a banned verdict token (BINDING DOCTRINE FAIL; HALT immediately + file fix card) | Phase 4b includes "If a banned token is present in persisted F production `evidence_span`: HALT IMMEDIATELY and FAIL"; the audit's Phase 8 verdict rules explicit FAIL on Phase 4b dirty firing. |

### Enforcement-loop (18-19)

| # | Trigger | Structural check |
|---|---|---|
| 18 | Smoke audit lacks `Audit-Lint: v1` marker | Smoke template skeleton (§"Smoke template skeleton" above) places the marker on line 3. |
| 19 | Smoke audit fails local pre-lint OR fails CI | Phase 8 makes local pre-lint a precondition for push; CI workflow run ID required in Phase 7 provenance subsection; the enforcement loop is "the lint working as designed", not a card failure. |

### Working tree (20)

| # | Trigger | Structural check |
|---|---|---|
| 20 | Unclassified untracked files at PR creation | Working tree contains only the 10 known operator-territory untracked files (intent §6 + reviewer's standard hygiene check); designer commits ONLY the design doc. |

**Zero HALT triggers fire** under this design. The card is a single-boolean flip with structural protections against each named risk, including the two doctrine-binding F-specific triggers (16, 17) that are unique to this card.

---

## File-touch matrix

### NEW files (this card)

| File | Purpose | Lines (approx) |
|---|---|---|
| `docs/designs/MCP-021C-EDGE-FAMILY-F-ENABLE.md` | This design doc | ~700 |
| `__tests__/edgeFamilyFProductionEnable.test.ts` | Dedicated card-scoped binding for Family F production flip + subset-filter-not-applied defensive guards (FFE-1..FFE-16) | ~180 |
| `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md` | Smoke template with `Audit-Lint: v1` marker + 8-phase outline incl. L3+L4+L5+L5-BINDING | ~280 |

### MODIFIED files (this card)

| File | Change | Net lines | Tests affected |
|---|---|---|---|
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | Line 96: `productionEnabled: false` → `productionEnabled: true` | +1/-1 (1 char effective) | All registry tests (see Test plan) |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5, FR-6, FR-16, FR-28 (G/H/I/J list), FR-30 (index 5), FR-32 (PRODUCTION_ENABLED_NAMES set) updated: A+B+C+D+E → A+B+C+D+E+F | 0 net | ~6 assertions |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1, FE-2, FE-3, FE-4: "FIVE" → "SIX"; FE-7 list drops F; new FE-13 mirroring FE-12 for F | +1 net | ~5 assertions flipped + 1 new |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | AVM-13 mixed-list expands to include F; optional new AVM-11c for F single-family production filter | +1 net | 1-2 assertions |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 production list expands to 6; DREG-31 G/H/I/J list (F removed) | 0 net | 2 assertions |
| `docs/core/current-status.md` | Handoff paragraph (~1 paragraph appended; per intent §11 ledger) | +30 to +50 lines | none (docs) |

### DELETED files

**None.**

### Explicit NON-TOUCH list

The following files / surfaces are READ-ONLY in this card. Any edit fires the corresponding HALT trigger:

| File / surface | Why read-only | HALT trigger |
|---|---|---|
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | Registry-derived; no code change needed | #3 |
| `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` | Subset filter mode-agnostic; preserved byte-equal; F has no entry per Card 1 T1 | #7 |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Single per-call orchestrator; no signature change | DREG-32 invariant |
| `supabase/functions/submit-argument/index.ts` | Dispatcher call site preserved byte-equal | TRG-1..TRG-10 invariants |
| `supabase/functions/classify-argument-boolean-observations/index.ts` | Edge classifier HTTP handler; admin_validation path unchanged | #5 |
| `mcp-server/**/*` (including `mcp-server/lib/familyF*.ts` and `familyFPrompt.ts`) | Hosted MCP server byte-equal; Family F server-side built and verified at Card 1 ship `1ee8ab3` + Card 1 amendment `deff068` | #10, #11 |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` | Source 6 production filter preserved byte-equal | #5 |
| `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` | Family F definitions byte-equal (14 keys uniform ai_classifier) | #10 |
| `src/features/nodeLabels/machineObservationDefinitions/familyE.ts` | Family E definitions byte-equal | #10 |
| All Family A-F prompts (`mcp-server/familyAPrompt.ts`, etc.) | No prompt change | #10 |
| All migration files | No schema change | #6 |
| All `nodeLabelTypes.ts` taxonomy | No new taxonomy keys | #8 |
| All MCP schema files (`mcpBooleanObservationSchema.ts`) | No schema version change | #9 |
| `package.json` | No dep install (RO-36 ratchet; intent §2 OUT) | intent §2 OUT |
| `scripts/ops/audit-lint*` | No audit-lint rule change (intent §2 OUT; means `critical_question` will NOT be added to `DOCTRINE_RISK_FAMILIES` in this card; the audit author satisfies L5 via explicit content per the template) | intent §2 OUT |

The card's edit surface is exactly **3 new files + 6 modified files** (1 source + 5 tests + 1 docs).

---

## Test forecast

**Net new tests:** +19 typical (within +25 to +70 budget). Conservative upper bound: +25 to +30.

**Forecast breakdown:**
- New `edgeFamilyFProductionEnable.test.ts`: +17 (16 named FFE-* tests + parametric `for` iteration counts: 6 core FFE-1..6 + 4 FFE-7 iterations × G/H/I/J + 2 FFE-8/9 + 5 FFE-10..FFE-14 + 2 FFE-15/16 subset guards)
- New AVM-style production filter test (F single-family parallel to E's AVM-11b): +1
- New FE-13 in `mcpOneTwoOneCEdgeFamilyEnablement.test.ts` mirroring FE-12 for E: +1
- Stale-assertion updates across 4 existing files: 0 net (assertions flipped, not added or removed)

**HALT ceiling:** +100 (per intent §10).

**Conservative band:** +19 to +25 — safely centered in the forecast range; structurally bounded by the card scope (one boolean flip + binding tests). Implementation may produce +25 to +30 if additional FR-* / FE-* / AVM additions are needed to harden the new 6-family posture during testing.

---

## Doctrine self-check

Per cdiscourse-doctrine skill (mandatory invocation):

| Skill rule | Applied to this card |
|---|---|
| §1 — Score is gameplay analysis, never truth | Production enablement is a routing decision (where the classifier runs), never a verdict on Family F's CQ quality. The flip does not introduce or modify any user-facing label. |
| §4 — AI moderator hard limits | Family F's classifier returns advisory observations only (Machine Observations, `source = 'machine'`). The MCP server-side per-key `falsePositiveGuards` (deployed at Card 1 ship) plus the `familyFBanListScan.ts` post-processor block any verdict-token language at the source. This card does not change those guards. |
| §6 — Secrets policy | No env vars added; no service role used; no `ANTHROPIC_API_KEY` reference; no secret logging. Verified by file-touch matrix (only `familyRegistry.ts` source-side change is a 1-char boolean flip). |
| §7 — No AI calls from the production app | Family F classification remains within Edge Functions + hosted MCP server. Auto-trigger dispatcher is server-side. Client code is unchanged. |
| §10a — Observations vs Allegations | Family F rows persist as Machine Observations (source: 'machine'). The critical-question framing is structurally distinct from "the argument is wrong" — every Family F key surfaces a productive inquiry, never a fault. Card 1 amendment empirically verified this under live Anthropic conditions (19 persisted rows; 0 dirty rows; 0 fallacy echoes including the F3 adversarial fixture with "fallacy" 2× in input). |

Plus test-discipline skill (mandatory invocation):

| Skill rule | Applied to this card |
|---|---|
| Tests are part of the deliverable | The card ships FFE-1..FFE-16 (17 individual tests) + 2 new tests in updated files + 4 file updates inverting stale assertions. Each post-flip state is bound by ≥1 explicit assertion. |
| Required coverage — doctrine constraints | The smoke audit template's Phase 4b 16-pattern ban-list scan is the live-data ban-list test. It runs over real persisted `evidence_span` from a deliberately critical-question-targeted argument. This is the doctrine-safety counterpart to FFE-1..FFE-16's structural assertions. |
| Test count tracking | The card's net delta (+19 to +25) is within forecast; the post-merge test count baseline becomes 18,173 + delta. |

---

## Operator steps

**On PR merge:** auto-deploy via Supabase GitHub integration. The `submit-argument` and `classify-argument-boolean-observations` Edge Functions redeploy with the new `familyRegistry.ts` source; no separate operator command required.

Specifically:
- `npx supabase functions deploy submit-argument --linked` — **fires automatically** via the GitHub integration (per memory-index `supabase-merge-autodeploy.md`)
- `npx supabase functions deploy classify-argument-boolean-observations --linked` — **fires automatically** via the GitHub integration
- No `npx supabase db push --linked` needed (no migration)

**After auto-deploy completes (~30-90s post-merge):**
- Operator runs the 8-phase post-merge smoke per the template skeleton above
- Smoke audit committed to `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<date>.md`
- Local pre-lint `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push
- CI MUST run on the smoke audit PR and exit 0 (L1-L6 mechanically enforced; L3+L4 mechanical obligations met; L5 operator-binding satisfied via explicit `evidence_span` content)
- On PASS, the 3-card chain completes. `MCP-SERVER-008-FAMILY-G` becomes authorized.

**Emergency rollback:** if Family F production starts producing systemic failures (e.g., all 6-family dispatches timing out), the operator can flip `semantic_referee_runtime_config.enabled = false` via SQL — this halts auto-trigger for ALL families (A+B+C+D+E+F) at the next dispatch. Per-family rollback (just F) requires a follow-up PR flipping the boolean back; the kill switch is dispatch-wide, not per-family.

---

## Brief ledger

This design was authored by the roadmap-designer subagent against an **operator-authored intent brief** at `docs/designs/MCP-021C-EDGE-FAMILY-F-ENABLE-intent.md` (committed at `24ccb45`). The intent brief carries the binding operator decisions D1-D8, the 20 HALT triggers, and the chain-completion authorization rules.

### Sections derived from prior Phase framing handoffs (operator-validated source-of-truth chain)

- **Phase A.2 (auto-trigger 6-family inclusion):** derived from Card 1 of prior launch (`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`) which made the dispatcher registry-derived (`DREG-1..DREG-34`), and from Card 2 smoke at `1ca701a` Phase 2 which empirically confirmed 5-family sequential dispatch (~22s, 5/5 success). Pattern: registry-derived dispatcher; no code change needed for new family.
- **Phase A.3 (subset filter NOT applied for F):** derived from Card 1 designer Phase A.1 (Family F is uniform `ai_classifier`; T1 NOT FIRED) + Card 2 design §"Phase A.3" + intent §5 D3 (BINDING: no subset filter for F because uniform ai_classifier). Pattern: subset filter is opt-in per family; absence = full passthrough.
- **Phase A.4 (latency projection for 6 families):** derived from Card 2 Phase 2 observed 5-family ~22s + Card 1 amendment Phase 4 per-family ~5-6s. Pattern: ~5-6s per family typical; ~27-28s for 6-family sequential.
- **Smoke template L3+L4+L5 obligations:** derived from intent §6 D6 + audit-lint rules in `scripts/ops/audit-lint-rules.cjs` (REQUIRED_PHASES_BY_AUDIT_TYPE.production-enable, L3_REQUIRED_ASSERTIONS, L4_RESULT_ROW_EVIDENCE, L5_PERSISTED_INSPECTION_PATTERNS). Pattern: production-enable audits MUST satisfy dispatch + targeted-signal + read-path; doctrine-risk audits MUST inspect persisted output.
- **Smoke template L5 BINDING obligation:** derived from intent §6 D6.L5 BINDING + §9 Phase 4b BINDING + Card 1 amendment `deff068` Phase 4b live empirical baseline (19 persisted rows; 0 dirty rows; 0 fallacy echoes; F3 adversarial verified). The audit-lint `DOCTRINE_RISK_FAMILIES` set currently contains `argument_scheme` + `slippery_slope` but NOT `critical_question`; the design surfaces this gap explicitly and binds the smoke author to satisfy L5 via explicit content even though CI does not mechanically enforce it for `critical_question` at this card's ship time. Pattern: intent §2 OUT binding forbids editing `scripts/ops/audit-lint*`; operator-binding obligation supersedes CI-mechanical scope for this card.

### Sections derived from pre-launch codebase survey

- **File-touch matrix** + **HALT trigger table** mapped from current source files at HEAD `24ccb45`. All file paths + line numbers verified against the actual repo state at design time.
- **Stale-assertion updates** identified by Grep against existing test files; the 4 files + ~13 assertion updates are all anticipated by intent §7 D7.
- **Family F uniformity re-verification (14 keys uniform `ai_classifier`)** done via direct read of `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` confirming the shared `buildCritical()` helper sets `source: 'ai_classifier' as const` on every entry.
- **Test count baselines** from intent §0 spawn-time state ("Baseline: Jest 18,173 / Deno 871").
- **Audit-lint DOCTRINE_RISK_FAMILIES audit:** direct read of `scripts/ops/audit-lint-rules.cjs:55-58` confirms `critical_question` is NOT in the set. The design surfaces this and binds the L5 obligation via explicit `evidence_span` content in the smoke template rather than via a rules edit (which would violate intent §2 OUT).

### Sections derived from epic framing

- **Goal paragraph and Stage 2B NOT REQUIRED section:** derived from intent §1-§4 (chain position; one-boolean flip scope; Gate B production-readiness; no architectural decision required mid-card).
- **Doctrine self-check** (explicit table above): derived from `cdiscourse-doctrine` skill §1 (gameplay-routing not verdict), §4 (AI moderator hard limits — Family F doctrine guards already deployed at Card 1), §7 (no AI calls from client; all stays in Edge + MCP server), §10a (Machine Observations are structural; critical-question framing is productive inquiry, never fault).

### Sections resolved by orchestrator default rather than explicit operator direction

- **Test file naming convention** — the new file uses `edgeFamilyFProductionEnable.test.ts` to mirror the Card 2 pattern (`edgeFamilyEProductionEnable.test.ts`). The intent brief does not name the file; the orchestrator default mirrors the precedent.
- **Test surface count distribution** — the design lands at +19 typical (slightly below Card 2's +21 net because F has only 14 keys vs E's 16, but also includes one extra FFE-7:G iteration removed by chain progression). Within the +25 to +70 intent forecast. The orchestrator default biased toward "match Card 2's defensive coverage shape with one fewer iteration for the production-disabled set" rather than adding speculative tests.
- **Smoke template structure** — the 8-phase outline mirrors Card 2's smoke audit at `1ca701a` (which itself mirrors the Card 2 design template). Phase 4b L5 BINDING is the new requirement vs Card 2 (where L5 was satisfied without explicit BINDING gate because `argument_scheme` is in `DOCTRINE_RISK_FAMILIES`). The orchestrator default added the audit-lint gap commentary and the explicit "operator-binding from intent, not CI-mechanically enforced" note in Phase 4b.
- **Targeted fixture guidance** — Phase 2 / Phase 3 operator binding excludes `781f8057` (intent §6 D6.L4) and also flagged the three Card 1 amendment adversarial fixtures (`cd67e76f`, `f1757532`, `5242c8cd`) as known-failing/seeded fixtures unsuitable as primary production proof. The intent does not name those three explicitly; the orchestrator default added them to the exclusion list from cross-referencing Card 1 amendment `deff068` Phase 4b.

### Operator-deferred review surface (post-ship)

After ship + post-merge smoke:
1. Confirm 6-family auto-trigger captures clean run rows for all 6 families in Phase 2.
2. Decide whether to amend the `familyRegistry.ts` header comment to reflect the post-Card-3 state (it currently describes the post-Card-1 of prior launch / post-D state; Card 2 did not update it; Card 3 also does not update it because comment edits are out of scope for a 1-character source flip).
3. Decide whether to add `critical_question` to `DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs` in a follow-up OPS card to make L5 BINDING mechanically CI-enforced for future Family F audits. Note: this card's design surfaces this gap but intent §2 OUT forbids the edit in this card.
4. Confirm Phase 3 produces a deliberately-targeted Family F positive (preferably `consequence_probability_unclear` or another doctrine-risk-paired key for Phase 4b L5 BINDING coverage). If 0 positives or `mcp_validation_failed`, use the operator-binding fallback protocol (one retry; HALT if second attempt fails).
5. Confirm Phase 4b doctrine ban-list scan over 16 patterns finds zero matches in persisted `evidence_span` (the BINDING DOCTRINE FAIL gate).
6. Confirm 3-card chain completion authorizations (Family G authorized; G/H/I/J still unsupported until their own cards).

---

## Summary line

This is the smallest possible production-mode flip and the terminal card of the FAMILY-F three-card chain: **1 boolean** at line 96 of `familyRegistry.ts`. The dispatcher (registry-derived), the Edge subset filter (correctly absent for F because uniform ai_classifier), and the OPS observability surface (family-agnostic) are all already prepared. Tests confirm 6-family production posture + subset-filter-NOT-applied for F. Test forecast: **+19 typical (within +25 to +70 budget; HALT +100)**. Zero HALT triggers fire. **Second production-enable card to ship its smoke audit under L3+L4+L5 mechanical CI enforcement; FIRST card with L5 BINDING enforcement per intent §6 D6.L5 — the smoke audit's Phase 4b satisfies L5 BINDING via explicit persisted `evidence_span` inspection over real Anthropic-produced F production output, with zero-tolerance for banned verdict tokens.** Open questions: zero.
