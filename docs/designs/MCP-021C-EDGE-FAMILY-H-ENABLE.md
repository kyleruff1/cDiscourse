# MCP-021C-EDGE-FAMILY-H-ENABLE — Family H production-mode flip

**Status:** Design draft
**Epic:** MCP — production-mode enablement (Epic 12 track; semantic-referee roadmap)
**Release:** Card 3 (terminal) of 3 in the FAMILY-H suite (MCP-SERVER-009-FAMILY-H → OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK → EDGE-FAMILY-H-ENABLE)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/391
**Intent brief:** `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md` (operator-authored)
**Branch:** `feat/MCP-021C-EDGE-FAMILY-H-ENABLE`
**Template card (faithful replica of):** `MCP-021C-EDGE-FAMILY-G-ENABLE` (PR #361, shipped `5b6edee`; smoke audit `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-2026-05-29.md`; design `docs/designs/MCP-021C-EDGE-FAMILY-G-ENABLE.md` — 659 lines). The two G-specific divergences DIV-1 (mixed-source subset entry) and DIV-2 (L5 CI-mechanical) invert / re-cast for H (uniform-source / CI-mechanical at ship — see §"Three H-specific divergences" below).
**Predecessors on main (Phase 0 verified at HEAD `92d4ebe`):**
- `3097521` — Card 1 `MCP-SERVER-009-FAMILY-H` PASS (Family H classifier shipped to MCP server; 12 uniform `ai_classifier` keys; classifier-set version `family-h-v1`; H admin_validation baseline live on hosted MCP)
- `12ec7eb` — Card 1 smoke PASS (`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md`; hosted 23/23 + structural ship clean; Phase 4b deferred to Card 3 per the H Card 1 design)
- `c5bea3b` — Card 2 `OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK` PASS (`claim_clarity` / `family_h` / `claim_specificity_low` added to `DOCTRINE_RISK_FAMILIES` → L5 BINDING is now CI-mechanically enforced for any Family-H smoke audit)
- `92d4ebe` — Card 2 smoke PASS (5/5 phases + L5 teeth bite)
- The 7 production families A+B+C+D+E+F+G remain LIVE in production (FAMILY-G chain terminal at `5b6edee`; FAMILY-F chain terminal at `65dbfc3`); this card is their faithful H replica.

---

## Operator gate context (DO NOT silently elide)

> [OPERATOR DECISION NEEDED — verify before merge]
>
> The repo memory note `[[mcp-validation-failed-burst-concurrency]]` (lines 29 / 44 / 46 / 48 / 52) records **multiple operator-binding gates** stating "Family H FROZEN" until the ARCH-001 classifier-queue architecture is approved + implemented + verified end-to-end with a routing-enabled smoke. As of HEAD `92d4ebe`, ARCH-001 Card 2 has shipped (PR #379 / `faf4dae`) and the Card 2 smoke ran with verdict **PARTIAL (PASS-with-tuning-recommendation; C-calibration)** at `docs/audits/ARCH-001-CARD2-SMOKE-2026-05-31.md`. Card 2 closeout placed Card 3 (production smoke + staged rollout) under operator review for the tuning recommendation (drainer C=3→2 OR token-bucket pacer OR longer `provider_server_error` retry backoff). The gate text on line 48 is explicit: **"Card 3 GATED on operator tuning-rec review. Family H STILL FROZEN."**
>
> The operator's intent brief for THIS card (Card 3 of the Family H suite — production-enable of `claim_clarity` at the Edge layer) opens with "Closes the Family H 3-card chain. Flip Family H to production at the Edge layer." The brief implicitly authorizes proceeding with the design + implementer + reviewer pipeline. **The design is authored on that authorization.** The implementer and reviewer pipelines run as scoped here; **the merge gate (Phase 7 / Phase 8 of the smoke; the operator HARD STOP at PR creation) remains the moment at which the operator either ratifies the Family H thaw OR pauses the merge pending ARCH-001 Card 3 (production smoke + staged rollout) ratification.**
>
> The design surfaces this as a single named decision (OPDEC-A below) — the reviewer must explicitly check the operator's most-recent direction at PR-creation time and HALT if the gate has not been ratified.

**OPDEC-A — Operator must ratify Family H thaw at PR-creation time.** The design proceeds; the implementer ships; the smoke runs; **but the squash-merge gate is conditional on the operator's most-recent written direction**. If unratified at PR creation, the reviewer pauses + flags. The design itself never claims authority to bypass this gate.

---

## Goal (one paragraph)

Flip one boolean — `productionEnabled: false → true` for the `claim_clarity` (Family H) entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (line 106). After merge + auto-deploy, every new argument submitted via `submit-argument` fires EIGHT bounded-parallel production runs (A+B+C+D+E+F+G+H) instead of seven. The dispatcher is registry-derived (`autoTriggerDispatcher.ts:461` — eligibleFamilies = `productionEnabledFamilies()`; bounded-parallel via `runWithBoundedConcurrency(eligibleFamilies, MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES=2, …)` at `autoTriggerDispatcher.ts:495-499`) — flipping the flag extends the auto-trigger to H with **zero dispatcher edits**. The Edge subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block at `booleanObservationRequestBuilder.ts:68-78` carries entries ONLY for `evidence_source_chain` (Family D) and `resolution_progress` (Family G); **Family H is uniform `ai_classifier`** (12 keys; `mcp-server/lib/familyHKeys.ts:86-99`) and so MUST NOT carry an entry — absence = full passthrough, like F (uniform 14 keys) and E (uniform 16 keys). This is **DIV-1 — Family H mirrors F's posture, not G's.** The card respects cdiscourse-doctrine §1 (production flip is a routing decision, never a verdict on Family H's clarity), §10a (Family H rows persist as Machine Observations with `source = 'machine'`; the clarity / specificity / hedging axis is structurally distinct from "this argument is weak / vague / lazy / sloppy"), and §7 (no AI calls leak to client; all classification stays inside Edge Functions + the hosted MCP server). **Fourth production-enable card to ship under L3+L4+L5 mechanical CI enforcement; THIRD L5-BINDING card whose L5 BINDING is CI-mechanically enforced AT SHIP — Card 2 of the H suite (`c5bea3b`) added `claim_clarity` / `family_h` / `claim_specificity_low` to `DOCTRINE_RISK_FAMILIES` before this card.** The card re-measures wall-clock latency live at 8 families against the codified budget (DIV-3 — see Phase A.4). The G smoke measured 34.555s p95 at 7 families (PARTIAL band; sequential-era pre-bounded-parallel); under the bounded-parallel limit=2 in force at HEAD, the projection at 8 families is materially lower — the smoke RE-MEASURES live and classifies against the 30s WARN / 45s FAIL budget.

---

## Three H-specific divergences from the G-ENABLE template (read these first)

This card is a faithful replica of `MCP-021C-EDGE-FAMILY-G-ENABLE`, with exactly three substantive divergences. An implementer who mirrors G blindly without honoring these three will produce a wrong card.

| # | Aspect | G-ENABLE (template) | H-ENABLE (this card) | Why it differs |
|---|---|---|---|---|
| **DIV-1** | **Subset filter posture** | **ALREADY PRESENT** for G — `resolution_progress: {'ai_classifier'}` at `booleanObservationRequestBuilder.ts:77` (Card 1A). Family G is MIXED-source (5 auto_metadata + 7 lifecycle + **18 ai_classifier** = 30 total); the entry filters production-mode G to the 18 ai_classifier keys. G's defensive tests (GGE-16/17) assert *presence + the 18-key result*. | **MUST NOT BE ADDED** for H — Family H is uniform `ai_classifier` (**12 keys**; `mcp-server/lib/familyHKeys.ts:86-99`). Absence = full passthrough (12-key request in BOTH modes). H's defensive tests (HHE-15/16) assert *absence + the 12-key full passthrough* — i.e., **the same posture as F (FFE-15/16, 14 keys)**, NOT G's. **The brief HALT 13 binds:** any edit that adds an H entry to the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block fails the card. | Family H's source mix at Card 1's Stage 2B operator decision was UNIFORM `ai_classifier` (no auto_metadata, no lifecycle) — the parity test at Card 1 (`mcpFamilyHKeysParity.test.ts`) asserts upstream `familyH.ts` has zero auto_metadata + zero lifecycle entries. So the subset-filter machinery has nothing to filter; an entry would be a no-op at best and a doctrinal confusion at worst (it would imply H is mixed-source when it is not). |
| **DIV-2** | **L5 BINDING enforcement at ship** | **CI-mechanically enforced** at G's ship — `resolution_progress`/`family_g`/`concedes_broader_point` were added to `DOCTRINE_RISK_FAMILIES` by Card 2 of the G suite (`cfc1fd4`) BEFORE this card. The G smoke audit MUST include persisted `evidence_span` inspection or CI fails the audit PR. G was the FIRST card whose L5 BINDING was CI-mechanical at ship. | **Same posture** — `claim_clarity` / `family_h` / `claim_specificity_low` were added to `DOCTRINE_RISK_FAMILIES` by Card 2 of the H suite (`c5bea3b`, at `scripts/ops/audit-lint-rules.cjs:79-91`) BEFORE this card. The H smoke audit MUST include persisted `evidence_span` inspection or CI fails the audit PR. H is the SECOND card whose L5 BINDING is CI-mechanically enforced at ship (G was the first; F was operator-binding only at ship). | Card 2 of the H suite (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK`) added H to the doctrine-risk set as a prerequisite; the smoke author cannot skip Phase 6 doctrine and pass CI. The H axis-partner choice is `claim_specificity_low` per the H Card 1 design § "axis-partner" choice (the broad/vague-claim verdict-adjacency risk that mirrors F's `consequence_probability_unclear` and G's `concedes_broader_point`). |
| **DIV-3** | **Latency posture** | 6→7 families; sequential-era projection ≈ 36.3s; G smoke measured **34.555s p95** at 7 (PARTIAL band 30–45s; under 45s FAIL line). | **7→8 families under bounded-parallel limit=2** (deployed at PR #364 `2394aef` AFTER the G smoke). Per the operator gate note (`[[mcp-validation-failed-burst-concurrency]]` line 52: "Production auto-trigger is bounded-parallel limit-2 (p95 ~19s at 7 families)"), the live posture is materially faster than G's sequential measurement. At 8 families with limit=2, projection ≈ **22-26s** (4 batches × ~5-7s per-family p95) — likely **PASS band (<30s)**, possibly **PARTIAL band (30-45s)** if the 8th family lands an outlier batch. The brief's "EXPECTED PARTIAL at 8" framing is conservative (it cites the G-sequential baseline 34.555s + ~6s for an added family); the bounded-parallel reality is faster. **The smoke Phase 5 re-measures live; either PASS or PARTIAL is acceptable; only ≥45s is FAIL.** | The dispatcher edit at PR #364 inverted the latency math: per-family p95 stays ~5-7s under live Anthropic conditions, but the wall-clock no longer adds linearly. `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` was filed and shipped specifically as the pre-Family-H latency gate (the issue title and the merge timing — between G's smoke and this card — make the intent explicit). |

Everything else (the boolean-flip mechanics, the registry-derived dispatcher, the card-scoped binding test pattern, the 8-phase smoke skeleton, the doctrine self-check structure) mirrors G-ENABLE.

---

## Stage 2B NOT REQUIRED

The production-flip decision was made at Gate B (operator-authorized chain-through after Card 2 PASS, with explicit data review). Per intent §1-§2:

- Card 1 (`MCP-SERVER-009-FAMILY-H`, `3097521`) shipped the H classifier to the hosted MCP server (12 uniform `ai_classifier` keys; `family-h-v1`) and proved the structural ship clean under admin_validation mode. The Card 1 smoke (`12ec7eb`) hit 23/23 hosted + structural ship clean; Phase 4b (live doctrine existential) was DEFERRED to Card 3 (this card) per the Card 1 design.
- No Card 1A was needed for H — H is uniform `ai_classifier`, so no Edge subset-filter entry is required (the contrast with G's Card 1A is exactly DIV-1; F also had no Card 1A for the same reason).
- Card 2 (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK`, `c5bea3b`) added `claim_clarity` / `family_h` / `claim_specificity_low` to `DOCTRINE_RISK_FAMILIES` so the production-enable smoke is mechanically L5-enforced. Card 2 smoke (`92d4ebe`) PASS — 5/5 phases + L5 teeth bite.

Family H uniform-source posture (12 keys, all `ai_classifier`) was verified at Card 1 and re-verified at design time via `mcp-server/lib/familyHKeys.ts:86-99` (12 keys: `provides_temporal_constraint`, `claim_present`, `reason_present`, `conclusion_missing`, `reason_missing`, `multiple_claims_present`, `claim_specificity_high`, `claim_specificity_low`, `quantifier_present`, `modal_language_present`, `hedging_present`, `unclear_reference_present`). No subset-filter change is needed in this card — Family H is uniform and so absent from the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block; HALT 13 fires if anyone adds an entry. No architectural complexity surfaces during designer Phase A: this is a one-boolean flip with defensive tests + a smoke audit that satisfies L3+L4+L5 with L5 CI-mechanically enforced. **No internal Stage 2B operator decision required mid-card.** Stage 2 of the suite is CONDITIONAL HALT only (see HALT trigger disposition below).

---

## Phase A.1 — familyRegistry current + post-flip state (registry flip)

Verbatim read of `supabase/functions/_shared/booleanObservations/familyRegistry.ts` at HEAD (`92d4ebe`; this branch):

### Family H entry pre-flip (current state)

```ts
// supabase/functions/_shared/booleanObservations/familyRegistry.ts:104-108
{
  family: 'claim_clarity',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

Line numbers: opening brace at line 104; `family:` at line 105; **`productionEnabled: false,` at line 106**; `adminValidationEnabled: true,` at line 107; closing brace at line 108.

### Family H entry post-flip (target state)

```ts
{
  family: 'claim_clarity',
  productionEnabled: true,   // ← FLIPPED (1 boolean character: false → true)
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
| 5 | critical_question (F) | **true** | true | 94-98 | none (byte-equal) |
| 6 | resolution_progress (G) | **true** | true | 99-103 | none (byte-equal) |
| 7 | **claim_clarity (H)** | **false → true** | true | **104-108** | **1 boolean character** |
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

Post-flip behaviour: returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme', 'critical_question', 'resolution_progress', 'claim_clarity']` (length **8**, A→H registry order).

### `filterFamiliesForMode()` function shape

Lines 141-156 — unchanged byte-equal. Post-flip, `filterFamiliesForMode(['claim_clarity'], 'production')` returns `['claim_clarity']` (currently returns `[]` because H is production-disabled).

**Phase A.1 verdict: BINDING YES.** The 1-line diff is exactly 1 boolean change (line 106). A/B/C/D/E/F/G remain `true`; I/J remain `false`; all `adminValidationEnabled` values remain `true`. The exported function signatures and bodies are byte-equal preserved. Reviewer verifies by `git diff --stat` showing 1 file / 1 line / +1 / -1 on `familyRegistry.ts`. HALT 12 binds: any other character change on this file fails the card.

---

## Phase A.2 — Auto-trigger 8-family inclusion mechanism (registry-derived; VERIFY, no edit)

`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` verbatim citations (READ-ONLY in this card):

- **Line 94** — registry import (was line 87 at G's ship; the file has grown with bounded-parallel imports at lines 101 `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`):
  ```ts
  import { runBooleanObservationMcpAdapter } from './booleanObservationMcpAdapter.ts';
  ```
- **Line 461** — eligible family list materialised at runtime (was line 403 at G's ship; bounded-parallel rewrite at PR #364 expanded the surrounding guards):
  ```ts
  const eligibleFamilies = productionEnabledFamilies();
  ```
- **Lines 479-509** — bounded-parallel dispatch using `runWithBoundedConcurrency` (was strictly sequential `for-of` at G's ship; the parallel rewrite at PR #364 `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` introduced the limit-2 worker pool):
  ```ts
  // ── Per-family bounded-parallel dispatch ─────────────────────
  // OPS-MCP-AUTO-TRIGGER-PARALLELIZATION: the families are dispatched
  // with BOUNDED PARALLELISM (at most MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES
  // in flight at once) via the pure worker-pool runner …
  const settled = await runWithBoundedConcurrency(
    eligibleFamilies,
    MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES,
    (family) => dispatchOneFamilyIteration(argumentId, family, serviceClient),
  );
  const outcomes: AutoTriggerOutcome[] = settled.map((result, i) =>
    result.status === 'fulfilled' && result.value
      ? result.value
      : {
          outcome: 'failed',
          runId: null,
          family: eligibleFamilies[i],
          failureReason: 'unexpected_error',
        },
  );
  ```
- **No hard-coded family list anywhere in the dispatcher.** The comment at lines 456-460 is explicit: "No hard-coded family literal here — the production family list is the runtime registry's `productionEnabledFamilies()` output. Adding or removing a production family is a 1-boolean flip in `familyRegistry.ts`; no edit to this file is needed." Asserted by the existing `DREG-2` (no family literals in dispatcher source) and `TRG-18` (dispatcher source-scan) tests; the parallel rewrite preserved both. **HALT 14 binds:** any dispatcher edit fails the card.

### Node-probe evidence: post-flip `productionEnabledFamilies()` = 8

Simulated the post-flip registry shape (flipping `claim_clarity` productionEnabled false→true) and ran the exact registry-derive logic at design time:

```
POST-FLIP productionEnabledFamilies():
["parent_relation","disagreement_axis","misunderstanding_repair","evidence_source_chain","argument_scheme","critical_question","resolution_progress","claim_clarity"]
length = 8
H present = true
I present = false
J present = false
A-H order preserved = true
```

Pre-flip (current HEAD `92d4ebe`, post FAMILY-G chain): `productionEnabledFamilies()` returns `[A, B, C, D, E, F, G]` (length 7). The bounded-parallel worker pool runs 7 tasks under limit-2 concurrency. Post-flip: returns `[A, B, C, D, E, F, G, H]` (length 8); the worker pool runs 8 tasks under limit-2 concurrency. The runner is allSettled-style (`runWithBoundedConcurrency`): a per-family rejection NEVER aborts a sibling (preserved failure isolation); each task's settle state is collected; results are returned in INPUT (registry) order so Family A remains `outcomes[0]` and Family H lands at `outcomes[7]`.

**Phase A.2 verdict: BINDING YES.** The registry-derived dispatcher already picks up H after the flip — **no dispatcher code change required.** HALT 14 (dispatcher diff non-zero) is structurally guarded: there are zero family literals in the dispatcher; the bounded-parallel runner is family-agnostic (takes `eligibleFamilies` as input). HALT (existential, A–G regression) is structurally guarded because each family iteration runs in its own try/catch inside `dispatchOneFamilyIteration` and the allSettled-style runner returns regardless of prior outcomes; the smoke Phase 2 empirically verifies A+B+C+D+E+F+G still fire alongside H.

---

## Phase A.3 — Subset filter MUST STAY ABSENT for Family H (no change; mirror F's FFE-15/16 posture)

> **This is DIV-1 — the principal divergence from G-ENABLE.** G was mixed-source with a subset entry that filters production-mode requests to the 18 ai_classifier keys (GGE-16/17 asserted *presence* + 18-key result). **H is uniform `ai_classifier` (12 keys), so it MUST NOT carry an entry** — H mirrors F's posture (FFE-15/16 asserted *absence* + 14-key full passthrough).

### Family H uniform-source posture (re-verified at design time)

Family H (`claim_clarity`) is a **uniform-source** family: **12 keys, all `ai_classifier`** (zero auto_metadata, zero lifecycle). Verbatim from `mcp-server/lib/familyHKeys.ts:86-99`:

```ts
export const FAMILY_H_RAW_KEYS: readonly string[] = Object.freeze([
  'provides_temporal_constraint',
  'claim_present',
  'reason_present',
  'conclusion_missing',
  'reason_missing',
  'multiple_claims_present',
  'claim_specificity_high',
  'claim_specificity_low',
  'quantifier_present',
  'modal_language_present',
  'hedging_present',
  'unclear_reference_present',
]);
```

The parity test at Card 1 (`mcpFamilyHKeysParity.test.ts`) asserts every literal is present in upstream `familyH.ts` AND that upstream has zero `auto_metadata` + zero `lifecycle` entries — H is uniform. Classifier-set version `family-h-v1` is emitted in `modelInfo.classifierSetVersion`.

### Subset filter constant — confirmed ABSENT for claim_clarity

`supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts:68-78` verbatim (READ-ONLY in this card):

```ts
const MCP_SERVER_SUPPORTED_FAMILY_SOURCES: Readonly<
  Partial<Record<MachineObservationFamily, ReadonlySet<MachineObservationSource>>>
> = Object.freeze({
  evidence_source_chain: Object.freeze(new Set<MachineObservationSource>(['ai_classifier'])),
  // MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET — resolution_progress is a mixed-source
  // family (5 auto_metadata + 7 lifecycle + 18 ai_classifier). Per the
  // MCP-SERVER-008-FAMILY-G Stage 2B operator decision, the MCP server supports
  // ONLY the 18 ai_classifier keys; sending the 12 deterministic keys triggers
  // unsupported_rawKey → mcp_validation_failed. Mirrors the Family D entry above.
  resolution_progress: Object.freeze(new Set<MachineObservationSource>(['ai_classifier'])),
});
```

The map holds TWO keys: `evidence_source_chain` (Family D) and `resolution_progress` (Family G). **NO `claim_clarity` entry exists** — that is the correct state for this card. HALT 13 binds: this card MUST NOT add, remove, or modify any entry in this block.

### Filter is mode-agnostic (the property that protects against accidental leak)

The builder iteration at `booleanObservationRequestBuilder.ts:140-155`:

```ts
for (const def of Object.values(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)) {
  if (!eligibleFamilies.includes(def.family)) continue;
  const allowedSources = MCP_SERVER_SUPPORTED_FAMILY_SOURCES[def.family];
  if (allowedSources && !allowedSources.has(def.source)) continue;  // ← NO mode check
  rawKeySet.add(def.rawKey);
  definitions[def.rawKey] = def;
}
```

For a production-mode Family H request post-flip:
1. `filterFamiliesForMode(['claim_clarity'], 'production')` returns `['claim_clarity']` (post-flip; currently `[]`).
2. Iteration encounters all 12 Family H registry entries; each passes the `eligibleFamilies.includes(def.family)` check.
3. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['claim_clarity']` is `undefined` → the subset-filter branch (`allowedSources && !allowedSources.has(def.source)`) short-circuits to "no filter" → all 12 entries pass.
4. Exactly 12 rawKeys land in `rawKeySet`; exactly 12 definitions land in the map; result is byte-equal to admin_validation mode (the filter is mode-agnostic; the only mode-dependent step is the upstream `filterFamiliesForMode(...)` family gate).

### F's FFE-15 source-text regex tolerates the H absence by design

`__tests__/edgeFamilyFProductionEnable.test.ts:137-161` (FFE-15) uses a size-agnostic regex that matches the full `const MCP_SERVER_SUPPORTED_FAMILY_SOURCES … });` block and asserts `not.toContain('critical_question')`. The regex anchors to the `const` declaration and `\n});` close; it never depended on the block holding any particular key set, only that `critical_question` is absent. **It continues to pass byte-equal after this card's flip** because the block holds D + G (no F, no H, no I, no J). Same for E's FEE-14 (`not.toContain('argument_scheme')`).

**Phase A.3 verdict: BINDING YES.** Family H's subset-filter entry is correctly ABSENT; this card MUST NOT add one. HHE-15 (absence assertion) and HHE-16 (12-key full passthrough; mode-agnostic) lock the posture in. Mirror exactly F's FFE-15/16 structure with the family name + key count swapped.

---

## Phase A.4 — Latency-at-8 + L3/L4/L5 test+smoke plan (DIV-3)

### Codified budget anchor (`OPS-MCP-LATENCY-BUDGET`, issue #351)

- Budget is defined against **`wall_clock_background` p95** (`max(completed_at) − min(started_at)` over the argument's production-success runs). PASS < 30s; **PARTIAL ≥ 30s and < 45s**; FAIL ≥ 45s (or submit blocks on classification — checked first). Constants `WARN_SECONDS = 30` / `FAIL_SECONDS = 45` in `scripts/ops/mcp-latency-report-lib.cjs`.
- **The G smoke** (`docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-2026-05-29.md`) measured 7-family `wall_clock_background` p95 = **34.555s** (PARTIAL band). **That measurement was sequential-era pre-bounded-parallel** — PR #364 (`OPS-MCP-AUTO-TRIGGER-PARALLELIZATION`, `2394aef`) deployed bounded-parallel limit=2 AFTER the G smoke ran.
- **The current live posture** (per the operator gate note `[[mcp-validation-failed-burst-concurrency]]` line 52): "Production auto-trigger is bounded-parallel limit-2 (p95 ~19s at 7 families)" — the bounded-parallel rewrite cut the sequential 34.555s to ~19s at 7 families.
- 8-family projection under bounded-parallel limit=2:
  - Wall-clock is approximately `ceil(N / limit) × per-family-p95 + dispatch-gap`.
  - With per-family p95 ≈ 5–7s (G smoke individual rows: Anthropic latency-dominated per family), limit=2 → `ceil(8/2) = 4` batches × ~5-7s = **~20-28s** (PASS-or-low-PARTIAL).
  - Conservative (per the brief's framing): if the bounded-parallel measurement at 8 families ends up trending toward the brief's "~40s" estimate, that lands at the high end of the PARTIAL band, still under the 45s FAIL line.
  - **The smoke Phase 5 RE-MEASURES live with N=5 fresh submissions. Either PASS or PARTIAL is acceptable; only ≥45s is FAIL.**
- The 45s FAIL line is the binding deadline. The bounded-parallel rewrite was explicitly filed as the pre-Family-H latency gate (PR #364 title: "bounded-parallel auto-trigger dispatch (limit 2; +30 tests; pre-Family-H latency gate)") — so the gate has been pre-paid.

### D8 — live latency re-measurement is part of the smoke

The smoke (Phase 5) re-measures `wall_clock_background` p95 LIVE at 8 families with N=5 fresh submissions (canary-first; gated Anthropic spend ≈ 40-45 calls under bounded-parallel limit=2; no JWTs logged; no `out/` committed) using `scripts/ops/mcp-latency-report.mjs`. It records BOTH (i) the measured 8-family p95 and (ii) classifies against the 30s/45s budget. If materially higher than the bounded-parallel ~22-26s projection → the smoke surfaces it as actionable data (whether the next family-ship can proceed without an additional gate; whether the bounded-parallel limit needs review). **Banked-lesson constraint:** if the re-measure adds any ops SQL, it MUST live in the sibling `scripts/ops-latency-sql/` directory (NOT under `scripts/ops/`, which is observability-owned and asserts an exact 16-`.sql`-file recursive count per `[[ops-sql-dir-observability-owned]]`). This card itself adds no SQL.

### Test surface (the implementer's binding; see full Test plan below)

Per intent §3 D1-D5 + §6: familyRegistry H productionEnabled=true; 8-family auto-trigger inclusion; production-mode H 12-key full passthrough (uniform `ai_classifier` — no subset filter); A–G unregressed (byte-equal behavior). Forecast +18 to +22 net (HALT 8 ceiling +35).

### Smoke surface (the operator's binding; see full Smoke skeleton below)

8-phase production-enable smoke: Phase 1 pre-flight; Phase 2 dispatch (L3a — 8 production runs A–H); Phase 3 targeted-signal (L3b+L4 — ≥1 H positive on a clarity-targeted argument); Phase 4 read-path (L3c — Source 6 8-family); **Phase 5 live latency re-measure (D8)**; **Phase 6 doctrine (L5 BINDING — persisted `evidence_span` clean; mechanically CI-enforced for H)**; Phase 7 observability + enforcement-loop provenance; Phase 8 verdict + audit-lint exit 0.

**Phase A.4 verdict: BINDING YES.** 8-family bounded-parallel dispatch under limit=2 projects ~22-26s typical (PASS band) or ~30-40s upper bound (PARTIAL band); both under the 45s FAIL line; well under `EdgeRuntime.waitUntil` ~150s. The runner's failure isolation protects A–G from any Family H slowdown. The smoke re-measures live (D8). The bounded-parallel pre-Family-H latency gate has been pre-paid by PR #364.

---

## Test plan — dedicated card-scoped binding (HHE-1..HHE-16) + stale-assertion updates

Following the G-ENABLE pattern (`__tests__/edgeFamilyGProductionEnable.test.ts`), this card adds **one new test file** + light stale-assertion updates to four existing files. The new file is the dedicated card-scoped binding that locks in the post-flip Family H state.

### New test file — `__tests__/edgeFamilyHProductionEnable.test.ts`

Mirrors `edgeFamilyFProductionEnable.test.ts` structurally (because H is uniform-source like F), with the family / count / index swaps. **DIV-1 is the load-bearing divergence:** HHE-15/16 mirror F's FFE-15/16 (assert absence + 12-key full passthrough), NOT G's GGE-16/17 (which assert presence + 18-key result). Imports come from the existing helper `__tests__/_helpers/booleanObservationEdgeDeno.ts` (already exports `EDGE_FAMILY_REGISTRY`, `edgeLookupFamilyRegistryEntry`, `edgeProductionEnabledFamilies`, `edgeFilterFamiliesForMode`, `edgeBuildBooleanObservationRequestForArgument`; not modified).

Test surface (~19 individual tests counting parametric `for` iterations across 5 describe blocks; the HHE-1..HHE-17 numbering follows G's slot map):

| Test(s) | Asserts | Mirrors (template) |
|---|---|---|
| **HHE-1** | `edgeLookupFamilyRegistryEntry('claim_clarity').productionEnabled === true` | FFE-1 / GGE-1 |
| **HHE-2** | `…adminValidationEnabled === true` (unchanged across the flip) | FFE-2 / GGE-2 |
| **HHE-3** | `edgeProductionEnabledFamilies()` includes `'claim_clarity'` | FFE-3 / GGE-3 |
| **HHE-4** | `edgeProductionEnabledFamilies()` has length **8** | FFE-4 / GGE-4 (count flipped 7 → 8) |
| **HHE-5** | `edgeProductionEnabledFamilies()` equals `[A,B,C,D,E,F,G,H]` in registry order (ending `'resolution_progress','claim_clarity'`) | FFE-5 / GGE-5 (list extended by `'claim_clarity'`) |
| **HHE-6** | `edgeFilterFamiliesForMode(['claim_clarity'], 'production')` equals `['claim_clarity']` | FFE-6 / GGE-6 |
| **HHE-7:{I,J}** (×2) | each of `thread_topology` / `sensitive_composer` `productionEnabled === false` (no widening past H) | GGE-7 was ×3 → HHE-7 is ×2 (H removed from the admin-only set; only I, J remain) |
| **HHE-8** | `EDGE_FAMILY_REGISTRY[7].family === 'claim_clarity'` AND `productionEnabled === true` AND `adminValidationEnabled === true` (index 7, A→J order preserved) | GGE-8 (index 6 → index 7) |
| **HHE-9** | `EDGE_FAMILY_REGISTRY[0].family === 'parent_relation'` AND `productionEnabled === true` (Family A still iteration #1) | GGE-9 |
| **HHE-10..HHE-16** (×7) | A/B/C/D/E/F/**G** each remain `productionEnabled === true` (catch accidental drift on the now-7 prior production families) | GGE-10..15 (×6 → ×7; G added to the unchanged set; HHE-10 = A, HHE-11 = B, HHE-12 = C, HHE-13 = D, HHE-14 = E, HHE-15 = F, HHE-16 = G) |
| **HHE-15-defensive / HHE-16-defensive** (renumber to **HHE-17 / HHE-18** OR keep grouped as final describe block — see note below) | (1) `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` has **NO** entry for `claim_clarity` (source-text scan; DIV-1 — mirrors FFE-15 absence pattern); (2) production-mode Family H request contains **exactly 12** ai_classifier rawKeys, byte-equal to admin_validation-mode (mode-agnostic; no subset filter) — mirrors FFE-16 14-key full passthrough but for 12 keys | new (H-specific; mirror F's FFE-15/16) |

> Numbering note: the table above lists HHE-10..HHE-16 for the unchanged A–G describe block (7 entries) and then HHE-17 / HHE-18 for the two subset-filter defensive guards (so the total stays at 19 distinct test names). The implementer may instead keep the F-style numbering (HHE-10..HHE-15 for A–F, HHE-16 = G drift-catch, HHE-17 / HHE-18 for the defensive guards). Either label scheme is acceptable so long as: (i) every prior production family A–G is explicitly named in a drift-catch test, (ii) the absence assertion and the 12-key/full-passthrough assertion both exist, (iii) the test count lands within the +18 to +22 forecast. The binding requirement is the *content*, not the exact label.

HHE-15 (absence) source-text scan (DIV-1 — mirrors FFE-15 / FEE-14):

```ts
const fs = require('fs');
const path = require('path');
const builderText = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts'),
  'utf8',
);
const constantBlock = builderText.match(/const MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]*?\n\}\);/);
expect(constantBlock).not.toBeNull();
expect(constantBlock![0]).not.toContain('claim_clarity');  // ← ABSENT (DIV-1; H is uniform)
```

HHE-16 (12-key full passthrough; mode-agnostic) — mirrors FFE-16 with key count swap:

```ts
const FAMILY_H_AI_CLASSIFIER_KEYS = [
  'provides_temporal_constraint', 'claim_present', 'reason_present',
  'conclusion_missing', 'reason_missing', 'multiple_claims_present',
  'claim_specificity_high', 'claim_specificity_low', 'quantifier_present',
  'modal_language_present', 'hedging_present', 'unclear_reference_present',
];
const reqProd = edgeBuildBooleanObservationRequestForArgument({
  argumentId: 'arg-h-prod-1', parentArgumentId: 'arg-h-prod-0',
  currentText: 'a reply with possible clarity / specificity / hedging content',
  parentText: 'a parent claim', threadContextExcerpt: '',
  requestedFamilies: ['claim_clarity'], mode: 'production',
});
expect(reqProd.requestedRawKeys.length).toBe(12);
const sent = new Set(reqProd.requestedRawKeys);
for (const k of FAMILY_H_AI_CLASSIFIER_KEYS) expect(sent.has(k)).toBe(true);  // all 12 pass
const reqAdmin = edgeBuildBooleanObservationRequestForArgument({ /* …same… */ mode: 'admin_validation' });
expect([...reqProd.requestedRawKeys].sort()).toEqual([...reqAdmin.requestedRawKeys].sort());  // mode-agnostic
```

### Updated existing test files (stale-assertion updates; no assertion removed or loosened)

These four files contain assertions that name "7 families" / "A→G" / "H–J admin-only"; this card flips them to "8 families" / "A→H" / "I–J admin-only". Each becomes a stronger post-flip binding at the new 8-family baseline; the catch-accidental-widening property is preserved.

| File | Tests affected | Nature of change | Net count |
|---|---|---|---|
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1 ("SEVEN"→"EIGHT"), FE-2/FE-3 (append `claim_clarity` to the A→G list → A→H), FE-4 (`toHaveLength(7)`→`(8)`), FE-7 `NON_PRODUCTION_FAMILIES` (drop `claim_clarity`; leaves I/J → 2 iterations); new **FE-15** explicit H binding mirroring FE-14 (`it('FE-15 — claim_clarity (H) is productionEnabled: true (Card 3 of FAMILY-H chain)', …)`) | ~5 flipped + 1 new − 1 FE-7 iteration | net **≈ +0** |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5/FR-6 (append H to the A→G production list), FR-7 `PRODUCTION_ENABLED_FAMILIES` set (add H), new FR-26e parallel `filter([claim_clarity], production)` keeps it (mirror FR-26d), FR-28 `HJ_FAMILIES` (currently 3 entries: `claim_clarity`/`thread_topology`/`sensitive_composer`; drop `claim_clarity` → IJ_FAMILIES leaves 2 entries; relabel "H–J" → "I–J"), FR-30 (add `productionList[7] === 'claim_clarity'`), FR-32 `PRODUCTION_ENABLED_NAMES` set (add H) | ~6 flipped + 1 new (FR-26e parallel) | net **≈ +1** |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | AVM-11e new single-family production-filter for H (parallel to AVM-11d for G), AVM-13 mixed-list production-filter extends to include `claim_clarity`; verify AVM-12 (`sensitive_composer` drops) still passes byte-equal | 1 flipped + 1 new | net **≈ +1** |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 (append `claim_clarity` → `[A..H]`, length 8), DREG-31 `HJ_FAMILIES` (drop `claim_clarity`; relabel "H–J"→"I–J"; leaves I/J — 2 entries) | 2 flipped | net **0** |

**Update discipline:** each updated assertion becomes a stronger post-flip binding at the new 8-family baseline; no assertion is removed or loosened. `DREG-30` (B/C source-scan) and `DREG-32` (classifyArgumentCore not modified) are unaffected. The existing `DREG-24` doctrine ban-list assertion (dispatcher source has no verdict tokens) continues to hold.

### Test forecast summary

| Surface | Test count delta | Notes |
|---|---|---|
| New `edgeFamilyHProductionEnable.test.ts` (HHE-1..HHE-18; ~19 individual counting `for` iterations) | **+19** | 6 core (HHE-1..6) + 2 HHE-7 iterations (I/J) + 2 HHE-8/9 + 7 HHE-10..16 (A–G unchanged) + 2 subset-filter guards (absence + 12-key/full-passthrough) |
| Updated `mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | ≈ +0 net (~5 flipped + 1 new FE-15 − 1 FE-7 iteration) | "SEVEN"→"EIGHT"; H exits FE-7 list; new FE-15 mirrors FE-14 |
| Updated `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | ≈ +1 net (~6 flipped + FR-26e parallel) | A→G becomes A→H; index 7 binding added |
| Updated `mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | ≈ +1 net | production-filter mixed-list gains H + single-family H test |
| Updated `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | +0 net (~2 flipped) | DREG-29 → 8; DREG-31 → I–J |
| **Net new tests** | **+18 to +22 (typical)** | Within the brief §4 forecast +15 to +25; HALT 8 ceiling +35 |

**Doctrine ban-list assertions:** the new test file contains no user-facing strings (it asserts structural rawKey sets + registry state). The live-data doctrine ban-list test is the smoke's Phase 6 (16-pattern scan over persisted `evidence_span` from a clarity-targeted argument) — see Smoke skeleton.

---

## Smoke template skeleton (8-phase; L3+L4+L5 + D8 latency; L5 CI-mechanical for H)

**Filename:** `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` (the operator fills it post-merge and commits `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-<YYYY-MM-DD>.md`).

**`Audit-Lint: v1`** marker MUST appear on line 3 (CI lint enforces this). The audit type is **production-enable** → the audit-lint rules require phases `phase-1-preflight`, `phase-2-auto-trigger-dispatch`, `phase-3-targeted-signal`, `phase-4-read-path`, `phase-5-regression` (`REQUIRED_PHASES_BY_AUDIT_TYPE['production-enable']`), with `phase-2/3/4` demanding direct-proof (`DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE`). Because `claim_clarity` / `family_h` / `claim_specificity_low` ∈ `DOCTRINE_RISK_FAMILIES` (Card 2 of this suite, `c5bea3b`), the **L5 persisted `evidence_span` inspection is mechanically required** (`L5_PERSISTED_INSPECTION_PATTERNS`) — CI fails the audit PR if it is missing (DIV-2). The phase-header IDs below map to the normalized required IDs so the linter recognizes them; the latency re-measure + doctrine sections are additive phases the linter accepts.

### 8-phase outline (L3 / L4 / L5-BINDING / D8 sections marked)

```markdown
# MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-021C-EDGE-FAMILY-H-ENABLE (Family H claim_clarity production-mode flip;
  12-key uniform ai_classifier — no subset filter; fourth production-enable card under
  L3+L4+L5 mechanical CI enforcement; SECOND L5-BINDING card whose L5 is CI-mechanically
  enforced at ship via DOCTRINE_RISK_FAMILIES; the FIRST production-enable card to ship
  under bounded-parallel limit=2)
**Chain position:** Card 3 (terminal) of 3 in the FAMILY-H suite
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)

## Phase 1 — Pre-flight
- [ ] HEAD at merge SHA; git status clean (only the known operator-territory untracked files).
- [ ] Edge Functions auto-deployed (submit-argument + classify-argument-boolean-observations reflect post-merge timestamps).
- [ ] Edge familyRegistry H entry post-merge: productionEnabled: true, adminValidationEnabled: true (line 106 flip confirmed live; HALT 12 defense).
- [ ] A/B/C/D/E/F/G entries byte-equal (productionEnabled: true). I/J byte-equal (productionEnabled: false).
- [ ] Subset filter block STILL holds only D + G entries; NO H entry (DIV-1; HALT 13).
- [ ] Targeted regression: Jest count ≥ <post-merge baseline> + new tests; Deno baseline byte-equal (no mcp-server change).
- [ ] Operator gate ratification confirmed (OPDEC-A; the Family H thaw is explicitly authorized in operator direction at the merge timestamp).
**Result:** ☐ PASS ☐ FAIL

## Phase 2 — Auto-trigger dispatch (L3a) — 8 production runs A+B+C+D+E+F+G+H
- [ ] Submit a NEW clarity-targeted argument via submit-argument (NEW text; NOT a prior Card 1 fixture). Arg id recorded.
- [ ] Wait ~30s for the 8-family bounded-parallel background dispatch (limit=2; ~4 batches).
- [ ] Query argument_machine_observation_runs: EXACTLY 8 production runs (run_mode='production') for A+B+C+D+E+F+G+H.
- [ ] All 8 runs status='success' (or clean 'failed'; no missing rows).
- [ ] I/J have ZERO production rows for this arg (registry-derived dispatcher correctly excluded them).
- [ ] Capture per-family duration table + total dispatch wall-time (feeds Phase 5).
**Result:** ☐ PASS ☐ FAIL — _<arg id; run ids>_

## Phase 3 — Targeted-signal (L3b + L4) — Family H positive result row required
- [ ] Targeted text deliberately exercises a claim_clarity pattern (claim_specificity_low OR
      claim_specificity_high OR hedging_present OR modal_language_present OR quantifier_present OR
      unclear_reference_present OR multiple_claims_present OR provides_temporal_constraint OR
      conclusion_missing OR reason_missing OR claim_present OR reason_present).
- [ ] Query argument_machine_observation_results for the H production run: ≥1 positive row with
      raw_key in the 12 ai_classifier keys (any of: provides_temporal_constraint, claim_present,
      reason_present, conclusion_missing, reason_missing, multiple_claims_present,
      claim_specificity_high, claim_specificity_low, quantifier_present, modal_language_present,
      hedging_present, unclear_reference_present).
- [ ] 0-positives on targeted text is PARTIAL not PASS (L4) — retry once with a stronger targeted fixture; HALT if still 0.
- [ ] mcp_validation_failed on first AND fallback targeted → HALT + scoped fix card.
      (Note: there is a known concurrency-class mcp_validation_failed under burst per
      `[[mcp-validation-failed-burst-concurrency]]`. A single-arg targeted submit is NOT a burst;
      a recurrence here would be the input-subset class — which for H is impossible since H is
      uniform `ai_classifier` and no subset entry is needed.)
**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<arg id; positives table; fixture text>_

## Phase 4 — Read-path (L3c) — Source 6 production rows visible
- [ ] Source 6 query path (machineObservationPersistenceQuery.ts run_mode='production' filter) returns the H production result rows for the Phase 3 arg.
- [ ] A+B+C+D+E+F+G rows ALSO present in the Source 6 result for the same arg (8-family production read-path coverage).
- [ ] admin_validation rows (if any) are NOT counted as production proof (Source 6 separation invariant holds).
- [ ] Defensive: confirm Family H has exactly 12 distinct rawKeys reachable in production (uniform ai_classifier; no subset filter; DIV-1).
**Result:** ☐ PASS ☐ FAIL

## Phase 5 — Latency re-measure at 8 families (D8)
- [ ] N=5 fresh submissions (canary-first; gated; no JWTs logged; no out/ committed); each fires 8 production runs under bounded-parallel limit=2.
- [ ] Run scripts/ops/mcp-latency-report.mjs; compute wall_clock_background p50/p95 at 8 families.
- [ ] Classify against the 30s/45s budget; compare measured-8-family p95 to the bounded-parallel projection (~22-26s typical; ~30-40s upper if a batch lands an outlier).
- [ ] State whether the bounded-parallel pre-Family-H latency gate (PR #364) held — i.e., 8-family p95 < 45s.
- [ ] Q9 clean (auto-trigger runs classify as audit_or_smoke_rerun; no organic_duplicate_candidate for fresh args).
- [ ] If the report adds ops SQL, it lives in scripts/ops-latency-sql/ (NOT scripts/ops/ — observability-owned 16-file count; banked lesson `[[ops-sql-dir-observability-owned]]`).
**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<p50/p95 table; projection comparison>_
      (PASS at 8 families is the EXPECTED outcome under bounded-parallel limit=2 — the
      pre-Family-H latency gate has been pre-paid. PARTIAL is acceptable if a batch lands
      an outlier. Only ≥45s is FAIL — that contradicts the bounded-parallel projection AND the
      pre-paid gate, and is a hard stop.)

## Phase 6 — Doctrine (L5 BINDING; CI-mechanically enforced for Family H)
- [ ] R1 column pre-check: argument_machine_observation_results has raw_key, confidence, evidence_span, family, run_id.
- [ ] Use a live ADVERSARIAL clarity-targeted text (asymmetric framing likely to fire claim_specificity_low — the
      H doctrinal-axis partner; a broad / vague / lazy-sounding claim that the classifier should mark structurally
      while the persisted evidence_span MUST NOT echo a verdict on the writer or the claim).
- [ ] Query persisted evidence_span for the Family H production rows; ban-list scan over the doctrine patterns
      (no truth/quality/judgment tokens: winner, loser, won, lost, defeated, true, false, correct, invalid,
      refutes, proves wrong, weak argument, fallacy, lazy, sloppy, vague-as-criticism, dishonest, bad faith,
      manipulative, etc.).
- [ ] Verify ≥1 clean firing (doctrine-clean evidence_span). If any H production evidence_span contains a
      clarity-VERDICT token → HALT IMMEDIATELY + FAIL (BINDING DOCTRINE FAIL).
- [ ] Doctrine note: H's keys are STRUCTURAL clarity / specificity / hedging observations — never "this argument
      is bad / weak / sloppy". `claim_specificity_low` is a structural broad-claim marker (no verdict on quality);
      `hedging_present` is a structural modality marker (no verdict on confidence); etc. (cdiscourse-doctrine §1;
      see also the H Card 1 design § "axis-partner" choice).
**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<fixture text; H rows; ban-list scan output>_

## Phase 7 — Observability + enforcement-loop provenance
- [ ] Q14 density: Family H production density present (first real production data for H).
- [ ] Record the 8-family operational state (A+B+C+D+E+F+G+H production LIVE; I/J admin_validation only).
- [ ] Enforcement provenance subsection: "fourth PRODUCTION-ENABLE card linted by audit-lint CI; SECOND L5-BINDING
      card whose L5 BINDING is CI-mechanically enforced at ship (claim_clarity/family_h/claim_specificity_low ∈
      DOCTRINE_RISK_FAMILIES per Card 2 c5bea3b). CI workflow run ID: <id>; in_scope count: <n>; linter exit: 0.
      L3 satisfied by Phases 2+3+4; L4 by Phase 3 targeted text ≥1 positive; L5 BINDING by Phase 6 persisted
      evidence_span inspection (≥1 clean firing)."
- [ ] FAMILY-H suite completion note: 3-card suite complete; 8 families production+auto-trigger; I/J unsupported.
- [ ] Bounded-parallel pre-Family-H latency gate verification: PR #364 (2394aef) measured held / not held;
      8-family p95 vs the bounded-parallel projection.
**Result:** ☐ PASS ☐ FAIL

## Phase 8 — Verdict + authorization
- [ ] Pre-push audit-lint: node scripts/ops/audit-lint.mjs <audit-doc> exits 0.
- [ ] CI runs on the smoke audit PR and exits 0 (L1–L6 mechanically enforced; L3+L4+L5 met; L5 mechanically enforced for H).
- [ ] Verdict:
  - PASS: 8 runs verified; L3/L4/L5 each satisfied by an explicit phase; Phase 6 ≥1 clean firing; latency under 30s (bounded-parallel projection holds); A–G unregressed; pre-lint + CI exit 0.
  - PARTIAL: Phase 3 0-positives even on stronger targeted arg; OR Phase 6 0-fire even after fallback; OR Phase 5 p95 in 30–45s (acceptable under bounded-parallel; flag for follow-up if persists).
  - FAIL: Phase 6 dirty firing (clarity-verdict token in H production evidence_span) → IMMEDIATE HALT + fix card; OR Phase 3 mcp_validation_failed on first AND fallback (NOT the burst-class — single-arg only); OR any non-Family-H rawKey on an H run; OR A–G byte-equal/regression failure; OR Phase 5 p95 ≥45s at 8 families (contradicts bounded-parallel projection and the pre-paid gate); OR CI passes an L-violating audit; OR operator gate not ratified at PR-creation time (OPDEC-A).
- [ ] Authorizations on PASS: MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE: PASS; Family H PRODUCTION + auto-trigger LIVE (8 families A–H); FAMILY-H 3-card suite COMPLETE; MCP-SERVER-010-FAMILY-I authorized (I is mixed-source per the H/I/J planning decision; J still unsupported).
**Final verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL
```

---

## HALT trigger disposition

The intent brief §5 names HALTs 1, 2, 6, 7, 8, 12, 13, 14, 15. The table below disposes of all named triggers plus the standard chain triggers. The reviewer verifies each row at PR-review time.

| # | Trigger | Structural check |
|---|---|---|
| 1 | Required-reading missing (cdiscourse-doctrine, test-discipline, supabase-edge-contract not invoked) | Reviewer prompt asserts invocation; this design self-checks the doctrine in the §Doctrine self-check below. |
| 2 | Standard preflight not green (typecheck / lint / test exit 0 on the branch HEAD) | Implementer captures the three exit-code lines; reviewer verifies in the review file. |
| 3 | familyRegistry affects any family other than H | 1-line diff on line 106 only; HHE-10..16 assert A–G byte-equal; reviewer `git diff --stat` = 1 file / 1 line / +1 / −1 on familyRegistry.ts. |
| 4 | A–G productionEnabled flipped (already true; do not touch) | A–G remain `true` (HHE-10..16 explicit; FR-* / FE-* / DREG-29 assertions). |
| 5 | Dispatcher hard-codes families (must stay registry-derived) | Dispatcher has NO family literals (DREG-2, TRG-18); no dispatcher edit; line 461 derives from registry; node-probe confirms 8. |
| 6 | roadmap-reviewer returns BLOCK | Reviewer file `docs/reviews/MCP-021C-EDGE-FAMILY-H-ENABLE.md` carries explicit ALLOW; CI green; merge gate held by OPDEC-A. |
| 7 | Adversarial Explore finds blocking refutation | adv1 (capacity load delta 7→8 — bounded-parallel limit=2 makes this small) / adv2 (A–G regression — per-family try/catch + allSettled runner isolation) / adv3 (L5 CI-mechanical — Card 2 added to DOCTRINE_RISK_FAMILIES on main; the smoke template Phase 6 is BINDING). All structurally guarded. |
| 8 | Test delta > +35 net | Forecast +18 to +22 typical; well under +35 ceiling. |
| 9 | H adminValidationEnabled flipped to false (must stay true) | HHE-2 explicitly asserts `adminValidationEnabled: true` post-flip; line 107 unchanged. |
| 10 | Source 6 change | `machineObservationPersistenceQuery.ts` not edited; not in scope. |
| 11 | Schema change | No migration; `mcpBooleanObservationSchema.ts` not edited. |
| **12** (chain-binding) | `familyRegistry.ts` diff has more than 1 boolean character flipped on Family H's entry | Exactly 1 line / +1 / -1 / 1 character (`false` → `true`); HHE-2 asserts `adminValidationEnabled` unchanged; HHE-10..16 catch any A–G accidental drift; FR-29 / FR-4 / FE-8 catch any A→J order drift. |
| **13** (chain-binding) | `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block modified (Family H uniform `ai_classifier`; absence = passthrough) | HHE-15 asserts `claim_clarity` is ABSENT from the block; the block continues to hold D + G only; this card MUST NOT touch `booleanObservationRequestBuilder.ts`. |
| **14** | `autoTriggerDispatcher.ts` diff is non-zero (registry-derived since B/C-enable; dispatcher should not need edits) | Reviewer `git diff supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` = 0 bytes; the bounded-parallel rewrite at PR #364 preserved the registry-derived posture. |
| **15** | `mcp-server/**` diff is non-zero (server-side is Card 1's territory) | Reviewer `git diff mcp-server/` = 0 bytes; Card 1 (`3097521`) shipped the H classifier; this card is Edge-only. |
| 16 (existential) | Auto-trigger broken for A–G (existential) | Per-iteration try/catch in `dispatchOneFamilyIteration` isolates each family; the bounded-parallel `runWithBoundedConcurrency` is allSettled-style (a per-family rejection NEVER aborts a sibling); smoke Phase 2 verifies A–G still fire alongside H. |
| 17 (L5 existential) | **Production-mode smoke missing live adversarial clarity_targeted evidence_span inspection (L5 BINDING — existential)** | DIV-2: Phase 6 of the smoke template mandates R1 column pre-check + live adversarial clarity-targeted text + persisted `evidence_span` ban-list scan + 0-fire fallback. CI mechanically requires it (`claim_clarity` / `family_h` / `claim_specificity_low` ∈ `DOCTRINE_RISK_FAMILIES`), so a missing inspection fails the audit PR. |
| 18 (doctrine BINDING) | **Any H production output evidence_span contains a clarity-verdict token (BINDING DOCTRINE FAIL; HALT)** | Phase 6 includes "If any H production evidence_span contains a clarity-verdict token → HALT IMMEDIATELY + FAIL"; Phase 8 verdict rules explicit FAIL on Phase 6 dirty firing. |
| 19 | Smoke audit lacks `Audit-Lint: v1` marker | Smoke template skeleton places the marker on line 3. |
| 20 | Smoke audit fails local pre-lint OR fails CI | Phase 8 makes local pre-lint a precondition for push; CI workflow run ID required in Phase 7 provenance; the enforcement loop is "the lint working as designed", not a card failure. |
| 21 | Unclassified untracked files at PR creation | Working tree contains only the known operator-territory untracked files (`.tmp/`, smoke artifacts, `out/`, `netlify-prod.git`, etc.); designer commits ONLY the design doc; the implementer commits only the flip + tests + docs. |
| 22 | Latency p95 ≥ 45s at 8 families (post-merge smoke) | Phase 5 + Phase 8 verdict rules state ≥45s is FAIL (contradicts the bounded-parallel projection AND the pre-paid pre-Family-H latency gate from PR #364). |
| 23 | Operator gate not ratified at PR-creation time (OPDEC-A) | The reviewer at PR creation checks the operator's most-recent written direction; HALT + pause if "Family H FROZEN" is still the binding gate without an explicit ratification. |
| 24 | Suite chain blocked by ARCH-001 Card 3 (production smoke + staged rollout) being un-ratified | Cross-reference `[[mcp-validation-failed-burst-concurrency]]` line 52 + the ARCH-001 Card 2 smoke audit; the reviewer surfaces this as a follow-up question for the operator if uncertain. |

**Zero HALT triggers fire** under this design at HEAD `92d4ebe`, conditional on the operator ratifying the Family H thaw at PR-creation time (OPDEC-A; HALT 23). The card is a single-boolean flip with structural protections against each named risk, including the two doctrine-binding H-specific triggers (17, 18) and the subset-filter-must-stay-absent trigger (13) that are the load-bearing checks for this card.

---

## File-touch matrix

### NEW files (this card)

| File | Purpose | Lines (approx) |
|---|---|---|
| `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md` | This design doc | ~600 |
| `__tests__/edgeFamilyHProductionEnable.test.ts` | Dedicated card-scoped binding for the H production flip + subset-filter-ABSENT + 12-key/full-passthrough defensive guards (HHE-1..HHE-18; ~19 tests) | ~200 |
| `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-template.md` | Smoke template with `Audit-Lint: v1` marker + 8-phase outline incl. L3+L4+L5 (L5 CI-mechanical) + D8 latency re-measure | ~300 |

### MODIFIED files (this card)

| File | Change | Net lines | Tests affected |
|---|---|---|---|
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | **Line 106: `productionEnabled: false` → `productionEnabled: true`** | +1 / −1 (1 char effective) | All registry tests (see Test plan) |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1 "SEVEN"→"EIGHT"; FE-2/3 A→H; FE-4 length 8; FE-7 drops H; new FE-15 (mirrors FE-14) | ≈ +0 net | ~5 flipped + 1 new − 1 iteration |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5/6 add H; FR-7 set + FR-28 list adjust; FR-26e parallel for H; FR-30 index-7 binding; FR-32 PRODUCTION_ENABLED_NAMES set | ≈ +1 net | ~6 flipped + 1 new |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | AVM-13 mixed-list adds H; new AVM-11e single-family H production-filter test | ≈ +1 net | 1 flipped + 1 new |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 → `[A..H]` length 8; DREG-31 → I–J | 0 net | 2 flipped |
| `docs/core/current-status.md` | Phase-framing handoff paragraph appended (per intent §2 allowed scope; H2 test-count section reconciled with the smoke/review count) | +30 to +50 lines | none (docs) |

### DELETED files

**None.**

### Explicit NON-TOUCH list (READ-ONLY; any edit fires the named HALT trigger)

| File / surface | Why read-only | HALT trigger |
|---|---|---|
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | Registry-derived; bounded-parallel since PR #364; no code change needed | 14 |
| `supabase/functions/_shared/booleanObservations/autoTriggerConcurrency.ts` | Limit constant (`MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2`); not in this card's scope; any change is a separate ops card | 14 |
| `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` | Subset filter block holds D + G only (DIV-1: H is uniform → absent); preserved byte-equal | 13 |
| `__tests__/edgeFamilyFProductionEnable.test.ts` | F's FFE-15 (`not.toContain('critical_question')`) byte-equal passes; F's FFE-16 (14-key full passthrough) byte-equal passes; this card does NOT touch F's binding | (preserves F structurally) |
| `__tests__/edgeFamilyGProductionEnable.test.ts` | G's GGE-16 (`.toContain('resolution_progress')`) byte-equal passes; G's GGE-17 (18-key production-mode) byte-equal passes; this card does NOT touch G's binding | (preserves G structurally) |
| `__tests__/mcpFamilyHKeysParity.test.ts` (Card 1) | 12-key uniform parity already proved at Card 1; byte-equal | 15 |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Single per-call orchestrator; no signature change | DREG-32 |
| `supabase/functions/submit-argument/index.ts` | Dispatcher call site preserved byte-equal | TRG invariants |
| `supabase/functions/classify-argument-boolean-observations/index.ts` | Edge classifier HTTP handler; admin_validation path unchanged | 10 |
| `mcp-server/**/*` (incl. the H classifier + prompt + `familyHKeys.ts`) | Hosted MCP server byte-equal; H server-side shipped at Card 1 `3097521` | 15 |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts` | Source 6 production filter preserved byte-equal | 10 |
| `src/features/nodeLabels/machineObservationDefinitions/familyH.ts` (+ A–G) | Family definitions byte-equal | 15 |
| All migration files | No schema change | 11 |
| `nodeLabelTypes.ts` / `mcpBooleanObservationSchema.ts` | No new taxonomy keys / no schema version change | 10, 11 |
| `package.json` | No dep install | intent §2 OUT |
| `scripts/ops/audit-lint*` | Card 2 of THIS suite (`c5bea3b`) already added `claim_clarity` / `family_h` / `claim_specificity_low` to `DOCTRINE_RISK_FAMILIES`; this card needs no rules edit | intent §2 OUT |
| `scripts/ops/mcp-latency-report*` / `scripts/ops-latency-sql/` | Latency tooling is read-only; the smoke RUNS the report but this card adds no SQL/CLI change | intent §2 OUT |

The card's edit surface is exactly **3 new files + 6 modified files** (1 source + 4 tests + 1 docs).

---

## API / interface contracts

No new public API surface. The contracts touched are:

- `productionEnabledFamilies(): ReadonlyArray<MachineObservationFamily>` — return value gains `'claim_clarity'` (length 7 → 8). Signature unchanged.
- `filterFamiliesForMode(['claim_clarity'], 'production')` — now returns `['claim_clarity']` (was `[]`). Signature unchanged.
- `buildBooleanObservationRequestForArgument({ requestedFamilies: ['claim_clarity'], mode: 'production' })` — now returns a request with **12 ai_classifier rawKeys** (was 0, because H was production-filtered out upstream). No subset filter is applied; the result is byte-equal to admin_validation mode.
- `dispatchAutoTriggerForArgument(argumentId, debateId, serviceClient): Promise<AutoTriggerOutcome[]>` — returns 8 outcomes instead of 7 (one per production family). Signature unchanged.

---

## Edge cases

- **Empty / sparse signal:** a clarity-targeted arg that yields 0 H positives is PARTIAL, not PASS (Phase 3 L4 binding); retry with a stronger targeted fixture; HALT if a second attempt still 0. Notably H has 12 keys with very different surface conditions (presence/absence markers like `claim_present`, `reason_present` are likely to fire on virtually any well-formed argument; specificity / hedging markers are more targeted).
- **`mcp_validation_failed` on the H production run:** because H is uniform ai_classifier with NO subset filter, the input-subset class of mcp_validation_failed cannot recur (it could only happen if a subset entry was accidentally added — HALT 13). The other known class (burst-concurrency mcp_validation_failed per `[[mcp-validation-failed-burst-concurrency]]`) is concurrency-driven and does NOT apply to single-arg targeted smoke submits. If a single-arg targeted submit fails validation twice, escalate.
- **Concurrent / duplicate runs:** benign — Source 6 dedupes by `raw_key` per argument; cross-family raw_keys are pairwise disjoint; the dispatcher's per-family idempotency pre-check (`findExistingRun`) skips an already-successful H run.
- **One family iteration crashes:** isolated by `dispatchOneFamilyIteration`'s try/catch AND by the allSettled-style `runWithBoundedConcurrency`; A–G still complete; the dispatcher returns 8 outcomes (the crashed one is a clean `failed`).
- **Latency at 8 families lands in 30–45s:** ACCEPTABLE under bounded-parallel limit=2 (PARTIAL band; under the 45s FAIL line) — flag, do not fail. The pre-Family-H latency gate (PR #364) projected the bounded-parallel posture would keep 8-family p95 well under 45s. Only ≥45s at 8 families is a FAIL.
- **Latency at 8 families lands in 0–30s:** EXPECTED under bounded-parallel limit=2 — the bounded-parallel projection (~22-26s) is in the PASS band. This is the most likely outcome.
- **Doctrine edge — can a `claim_specificity_low` evidence_span read as a verdict?** No, structurally. H's `claim_specificity_low` is a structural broad-claim marker (the claim has unspecified scope / temporal frame / quantifier — a measurable property of the text), NOT a verdict ("this claim is weak / lazy / sloppy"). The MCP-server prompt guards (added at Card 1) + the persisted `evidence_span` ban-list scan (Phase 6) ensure no verdict token surfaces. The 5-layer doctrine defense applies (the same machinery proven on G).
- **Kill switch:** `semantic_referee_runtime_config.enabled = false` halts auto-trigger for ALL families (A–H) at the next dispatch (read once per dispatch in `readEnabledFlag`). Per-family rollback (just H) requires a follow-up PR flipping the boolean back.
- **Operator-gate edge:** if the operator gate is unratified at PR-creation time (OPDEC-A; HALT 23), the reviewer pauses + flags. The design ships; the merge gate stays held.

---

## Dependencies (cards / docs / files)

- **Assumes Card 1 `MCP-SERVER-009-FAMILY-H` complete** (`3097521`) — the H classifier (12 keys, uniform ai_classifier, `family-h-v1`) is deployed to the hosted MCP server; without it the H production runs would `mcp_validation_failed`.
- **Assumes Card 1 smoke PASS** (`12ec7eb`) — hosted 23/23 + structural ship clean; Phase 4b (live doctrine existential under admin_validation) was DEFERRED to Card 3 (this card's smoke Phase 6).
- **Assumes Card 2 `OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK` complete** (`c5bea3b`) — `claim_clarity` / `family_h` / `claim_specificity_low` ∈ `DOCTRINE_RISK_FAMILIES`; this is what makes the smoke's L5 BINDING CI-mechanically enforced (DIV-2).
- **Assumes Card 2 smoke PASS** (`92d4ebe`) — 5/5 phases + L5 teeth bite; the audit-lint rules are live on main.
- **Assumes the FAMILY-G chain terminal at `5b6edee`** — 7 production families A–G in force at HEAD; this card lifts to 8.
- **Assumes the bounded-parallel pre-Family-H latency gate at PR #364 (`2394aef`)** — the bounded-parallel rewrite was explicitly the pre-Family-H gate; this card relies on it for the Phase 5 PASS projection.
- **Reads** `familyRegistry.ts` at `productionEnabledFamilies()`; the dispatcher at `dispatchAutoTriggerForArgument` → `productionEnabledFamilies()` → `runWithBoundedConcurrency(eligibleFamilies, limit=2, …)`; the request builder at `buildBooleanObservationRequestForArgument` → (no subset entry for H).
- **Consumes** the `OPS-MCP-LATENCY-BUDGET` codified thresholds + `mcp-latency-report.mjs` for the D8 re-measure.
- **Reads (operational context)** `[[mcp-validation-failed-burst-concurrency]]` for the Family H thaw gate framing.
- **Blocks** `MCP-SERVER-010-FAMILY-I` (the next family-ship card; I is mixed-source per the H/I/J planning decision) — authorized only on this smoke's PASS.

---

## Risks

- **OPDEC-A — Family H gate ratification.** This is the load-bearing operational risk. The repo memory note records "Family H FROZEN" as the binding gate at multiple recent timestamps; the operator's intent brief for this card authorizes proceeding through design + implementer + reviewer; the merge gate is the explicit operator ratification point. Mitigation: HALT 23 + Phase 8 verdict rule "operator gate not ratified at PR-creation time" + OPDEC-A surfaced at the top of this design.
- **Stale-assertion sprawl:** the four updated test files carry "7 / A–G / H–J" assertions; an incomplete sweep leaves a red test. Mitigation: the Test plan enumerates each file + the exact assertion IDs (FE-1/4/7 + FE-15; FR-5/6/7/26e/28/30 + FR-32; AVM-11e + AVM-13; DREG-29/31). The implementer runs `npm run test` and confirms exit 0.
- **DIV-1 inversion (the most likely implementer error):** blindly mirroring G's GGE-16/17 (which assert subset-filter *presence* + 18-key result) would assert the WRONG thing for H. Mitigation: HHE-15/16 explicitly assert *absence* + the 12-key/full-passthrough result; the DIV table and Phase A.3 call this out as the principal divergence. H mirrors F (FFE-15/16 absence pattern), NOT G.
- **DIV-2 (L5 mechanical):** unlike F, the H smoke CANNOT skip the persisted `evidence_span` inspection — CI fails the audit PR. Mitigation: Phase 6 is a first-class required section in the template; Phase 8 gates on CI exit 0.
- **DIV-3 (latency PARTIAL misread as FAIL):** an 8-family p95 in the 30–45s band is the EXPECTED-or-acceptable outcome under bounded-parallel limit=2, not a failure. Mitigation: Phase 5 + Phase 8 verdict rules state PARTIAL-is-acceptable; only ≥45s is FAIL. The bounded-parallel pre-Family-H latency gate (PR #364) was filed specifically to pre-pay this.
- **Bursty `mcp_validation_failed` recurrence under smoke load:** the second mcp_validation_failed class (concurrency-driven, ~4-8s, intermittent) is documented in `[[mcp-validation-failed-burst-concurrency]]` and is gated by ARCH-001 Card 3 (production smoke + staged rollout). A single-arg targeted smoke submit is NOT a burst, so this class is highly unlikely; if it DOES recur, escalate to ARCH-001 follow-up rather than rolling back this card.
- **Existing tests that need updating:** the four files above; all are stale-assertion flips at the new 8-family baseline (no behavioral change, no loosening).
- **Migration / operator deploy:** none — pure source flip; auto-deploys via the Supabase GitHub integration. No `db push`.

---

## Out of scope

- **No dispatcher edit** (`autoTriggerDispatcher.ts` is registry-derived; HALT 14).
- **No subset-filter change** (`booleanObservationRequestBuilder.ts` H entry MUST stay absent; HALT 13).
- **No mcp-server change** (the H classifier shipped at Card 1 `3097521`; HALT 15).
- **No audit-lint rules change** (`claim_clarity` / `family_h` / `claim_specificity_low` already in `DOCTRINE_RISK_FAMILIES` via Card 2 `c5bea3b`).
- **No latency tooling change** (the smoke runs `mcp-latency-report.mjs`; this card adds no SQL/CLI; if the smoke adds SQL it goes in `scripts/ops-latency-sql/`).
- **No bounded-parallel limit change** (PR #364 set `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2`; that's the pre-paid gate; any change is a separate ops card).
- **No A–G flip** (already true); **no I/J flip** (each awaits its own suite; **do not start Family I**).
- **No schema / migration / taxonomy / prompt / key / `package.json` change.**
- **No parallelization-limit change** (raising the limit is a separate `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION-LIMIT-BUMP` style card; the smoke Phase 4c precedent in the limit-bump card frame applies).
- **No user-facing UI** — this is server-side classifier routing; Family H Machine Observations are persisted but their rendering is governed by Source 6 + the node-annotation registry (UX-001.5A doctrine), not this card.
- **No ARCH-001 work** — the ARCH-001 classifier-queue is in flight on a separate track; this card is independent (Family H production-enable is a pre-existing path that bounded-parallel was filed to pre-pay).

---

## Doctrine self-check

Per `cdiscourse-doctrine` skill (mandatory invocation):

| Skill rule | Applied to this card |
|---|---|
| §1 — Score is gameplay analysis, never truth | Production enablement is a routing decision (where the classifier runs), never a verdict on Family H's clarity quality. The flip introduces/modifies no user-facing label. `claim_specificity_low` is a STRUCTURAL marker (the claim has unspecified scope or temporal frame — a measurable property of the text), NOT a verdict ("this claim is weak / lazy / sloppy"). The smoke Phase 6 ban-list scan enforces no quality/judgment/truth token in persisted `evidence_span`. |
| §2 — Heat means activity, not truth | Untouched. The flip adds no heat/engagement signal; latency is a system-performance metric, explicitly NOT a gameplay/truth/heat signal (LATENCY-BUDGET doctrine). |
| §3 — Popularity is not evidence | Untouched. No engagement/popularity input enters the classifier path. |
| §4 — AI moderator hard limits | Family H's classifier returns advisory Machine Observations only (`source = 'machine'`, `authoritative` false). The MCP server-side guards (deployed at Card 1) block verdict-token language at the source; this card does not change them. No client-side AI call. |
| §6 — Secrets policy | No env var added; no service role used by this card's diff; no `ANTHROPIC_API_KEY`/`SERVICE_ROLE` reference; no secret logging. The 1-char boolean flip is the only source-side change. |
| §7 — No AI calls from the production app | Family H classification stays within Edge Functions + the hosted MCP server. The auto-trigger dispatcher is server-side (`supabase/functions/`); client code is unchanged. |
| §10a — Observations vs Allegations | Family H rows persist as Machine Observations (`source: 'machine'`). The clarity / specificity / hedging framing is structurally distinct from "the argument is weak / lazy / unclear-as-criticism". No raw classifier ID surfaces in UI (governed by the node-annotation registry, not this card). |

Plus `test-discipline` skill (mandatory invocation):

| Skill rule | Applied to this card |
|---|---|
| Tests are part of the deliverable | The card ships `edgeFamilyHProductionEnable.test.ts` (HHE-1..HHE-18; ~19 individual tests) + 2 new tests in updated files + 4 stale-assertion file updates. Each post-flip state is bound by ≥1 explicit assertion. |
| Required coverage — doctrine constraints | The smoke audit template's Phase 6 ban-list scan over persisted `evidence_span` from a live adversarial clarity-targeted argument is the live-data doctrine ban-list test (CI-mechanically required for H via `DOCTRINE_RISK_FAMILIES`). |
| Test count tracking | Net delta +18 to +22 typical (within the brief §4 +15 to +25 budget; HALT ceiling +35). `docs/core/current-status.md` is updated AFTER the count is confirmed; its H2 test-count section MUST match the smoke/review count (the cross-check rule from POSTRUN-UX001 chain protocol). |
| Gate timeout handling | Implementer captures `npm run test` exit code explicitly (the count is taken from the `Test Suites: … / Tests: …` line with exit 0, not tailed output). |

Plus `supabase-edge-contract` skill (mandatory invocation):

| Skill rule | Applied to this card |
|---|---|
| No service-role key in client code | Not applicable — this card touches only the Edge-side registry + tests + docs. |
| No direct insert into `public.arguments` from the client | Not applicable. |
| RLS always on | Not applicable — no migration. |
| Migrations are append-only | Not applicable — no migration. |
| Edge Function shape | The auto-trigger dispatcher continues to fire from the existing `submit-argument` Edge Function flow; the boundary is preserved. |
| Deploy step | Auto-deploys via Supabase GitHub integration on merge to main (see Operator steps). |

---

## Operator steps

**On PR merge:** auto-deploy via the Supabase GitHub integration. `submit-argument` and `classify-argument-boolean-observations` redeploy with the new `familyRegistry.ts` source; no separate operator command required.

- `npx supabase functions deploy submit-argument --linked` — **fires automatically** via the GitHub integration (per memory-index `[[supabase-merge-autodeploy]]`).
- `npx supabase functions deploy classify-argument-boolean-observations --linked` — **fires automatically**.
- No `npx supabase db push --linked` (no migration).

**After auto-deploy (~30-90s post-merge):**
- Run the 8-phase post-merge smoke per the template skeleton above (includes the D8 latency re-measure at 8 families under bounded-parallel limit=2, and the L5 BINDING doctrine inspection).
- Commit the completed audit to `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-<date>.md`.
- Local pre-lint `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push.
- CI MUST run on the smoke audit PR and exit 0 (L1–L6 mechanically enforced; L5 mechanically enforced for H via `DOCTRINE_RISK_FAMILIES`).
- On PASS, the FAMILY-H 3-card suite completes; `MCP-SERVER-010-FAMILY-I` becomes authorized.

**Pre-merge operator action (OPDEC-A):** explicitly ratify the Family H thaw by responding to the PR. The design and the reviewer file flag this gate; the merge gate is the operator's call. If the operator chooses to pause for ARCH-001 Card 3 (production smoke + staged rollout) ratification first, the PR stays open + ready.

**Emergency rollback:** flip `semantic_referee_runtime_config.enabled = false` via SQL — halts auto-trigger for ALL families (A–H) at the next dispatch. Per-family rollback (just H) requires a follow-up PR flipping the boolean back; the kill switch is dispatch-wide, not per-family.

---

## Brief ledger (orchestrator-authored design against an operator-authored intent brief)

This design was authored by the roadmap-designer subagent against the **operator-authored intent brief** at `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md`. The intent brief carries the binding operator decisions D1–D5, the HALT triggers, and the suite-completion authorization rules. (The design itself is orchestrator-authored; this ledger maps where designer judgment substituted for operator direction.)

### Sections derived from prior Phase framing handoffs (operator-validated source-of-truth chain)

- **Phase A.2 (registry-derived 8-family auto-trigger):** derived from the FAMILY-G chain (which kept the dispatcher registry-derived; DREG-1..32) plus the bounded-parallel rewrite at PR #364 (`2394aef OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` — explicitly filed as the pre-Family-H latency gate). Pattern: registry-derived dispatcher + bounded-parallel limit=2; no code change for a new family.
- **Phase A.3 (subset filter MUST stay absent + mode-agnostic):** derived from Card 1 of THIS suite (which proved Family H is uniform `ai_classifier`, 12 keys, no auto_metadata / lifecycle) plus the F-ENABLE precedent (FFE-15/16 pattern for uniform families). Pattern: uniform-source families do NOT carry a subset entry; only mixed-source families (D, G) do.
- **Phase A.4 (latency-at-8 under bounded-parallel):** derived from `OPS-MCP-LATENCY-BUDGET` (issue #351) + the G smoke 34.555s p95 sequential baseline + the operator gate note ("p95 ~19s at 7 families" under bounded-parallel limit=2). Pattern: bounded-parallel = ~`ceil(N/limit) × per-family-p95`.
- **Smoke L3+L4+L5 obligations:** derived from intent §2 + the audit-lint rules (`REQUIRED_PHASES_BY_AUDIT_TYPE['production-enable']`, `DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE`, `L5_PERSISTED_INSPECTION_PATTERNS`, `DOCTRINE_RISK_FAMILIES`).

### Sections derived from a pre-launch codebase survey

- **File-touch matrix, HALT table, the exact line numbers (registry line 106; dispatcher line 461; builder lines 68-78; rules lines 79-91), and the stale-assertion map** mapped from current source at HEAD `92d4ebe`, all verified against the actual repo at design time.
- **DIV-1 (subset filter MUST stay absent):** confirmed by direct read of `booleanObservationRequestBuilder.ts:68-78` (block holds D + G only, no H) + `mcp-server/lib/familyHKeys.ts:86-99` (12 uniform keys) — this is the scope-reality audit for the card's principal divergence from G.
- **DIV-2 (L5 CI-mechanical):** confirmed by direct read of `scripts/ops/audit-lint-rules.cjs:79-91` showing `claim_clarity` / `family_h` / `claim_specificity_low` in `DOCTRINE_RISK_FAMILIES`.
- **DIV-3 (bounded-parallel posture):** confirmed by direct read of `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts:479-499` and `autoTriggerConcurrency.ts` (limit=2) plus the operator gate note in `[[mcp-validation-failed-burst-concurrency]]` line 52.
- **Node-probe (post-flip `productionEnabledFamilies()` = 8):** simulated the post-flip registry shape and ran the derive logic; result captured in Phase A.2.

### Sections derived from epic framing

- **Goal paragraph + Stage 2B NOT REQUIRED + Doctrine self-check:** derived from intent §1-§2 (suite position; one-boolean-flip scope; Gate B readiness) + the `cdiscourse-doctrine` skill (§1/§4/§7/§10a) + the H Card 1 design "axis-partner" choice (which named `claim_specificity_low` as the highest-verdict-adjacency H key).

### Sections resolved by orchestrator default rather than explicit operator direction

- **Test file name** `edgeFamilyHProductionEnable.test.ts` — mirrors the F / G / E precedent; the intent does not name the file.
- **HHE-* label scheme + count distribution** (+19 typical; +18-22 forecast) — mirrors the G GGE-* shape with the I/J admin-only set reduced by one iteration (H removed) and the A–G unchanged set increased by one (G added). The two subset-filter guards (HHE-15/16 or HHE-17/18 depending on the implementer's numbering choice) invert G's GGE-16/17 to assert *absence* + the 12-key/full-passthrough result (DIV-1). Within the intent §4 +15 to +25 forecast.
- **Smoke phase numbering** — the latency re-measure is placed at Phase 5 and the doctrine inspection at Phase 6 (mirroring G); the phase-header IDs are written to match the audit-lint normalized required IDs so CI recognizes them.
- **OPDEC-A (operator-gate ratification framing)** — the intent brief does not name the Family H FROZEN gate explicitly. The designer adds OPDEC-A + HALT 23 / HALT 24 to surface the gate context. If the operator's most-recent direction is that the gate is ratified at PR-creation time, OPDEC-A is N/A and HALT 23 does not fire. If the gate is still binding, the reviewer holds.
- **DIV-3 bounded-parallel latency framing** — the intent brief's projection ("~40s p95 at 8 families, PARTIAL band") is the sequential-era extrapolation from G's 34.555s. The designer surfaces the bounded-parallel reality (limit=2, projection ~22-26s, likely PASS band) as the more accurate frame, but PARTIAL remains acceptable per the brief.

### Operator-deferred review surface (post-ship)

1. Confirm 8-family bounded-parallel auto-trigger captures clean run rows for all 8 families in smoke Phase 2 (no burst-concurrency mcp_validation_failed on the single-arg targeted submit).
2. Confirm Phase 3 produces a deliberately-targeted Family H positive (preferably `claim_specificity_low` for Phase 6 L5 coverage — the H doctrinal-axis partner).
3. Confirm Phase 5 measured 8-family `wall_clock_background` p95 under bounded-parallel limit=2; classify against the bounded-parallel projection.
4. Confirm Phase 6 doctrine ban-list scan finds zero verdict tokens in persisted H `evidence_span` (the BINDING DOCTRINE FAIL gate; CI-mechanical for H).
5. Confirm OPDEC-A (operator gate ratification) was met at PR-creation time.
6. Decide whether to amend the `familyRegistry.ts` header comment to reflect the post-H state (it describes the post-B/C state; prior cards left it; this card also leaves it because comment edits are out of scope for a 1-character source flip).
7. Confirm suite-completion authorizations (Family I authorized as mixed-source per H/I/J planning; J still unsupported until its own suite).
8. Confirm the FAMILY-H 3-card suite is reflected in the next current-status H2 section with test counts that cross-check against the review file (the POSTRUN-UX001 cross-check rule).

---

## Summary line

This is the smallest possible production-mode flip and the terminal card of the FAMILY-H three-card suite: **1 boolean** at line 106 of `familyRegistry.ts` (`claim_clarity` productionEnabled false→true). The dispatcher (registry-derived → node-probe-confirmed 8 families A–H, no edit; bounded-parallel limit=2 since PR #364), the Edge subset filter (MUST STAY ABSENT → H is uniform `ai_classifier` 12 keys, no entry; mirrors F's posture; HALT 13 binds), and the audit-lint L5 enforcement (`claim_clarity` / `family_h` / `claim_specificity_low` already in `DOCTRINE_RISK_FAMILIES` from Card 2) are all already prepared. Tests confirm 8-family production posture + the 12-key full passthrough. Test forecast: **+18 to +22 typical (within +15 to +25 budget; HALT +35)**. **Zero HALT triggers fire** at HEAD `92d4ebe`, conditional on the operator ratifying the Family H thaw at PR-creation time (OPDEC-A; HALT 23). **Fourth production-enable card under L3+L4+L5 mechanical CI enforcement; SECOND L5-BINDING card whose L5 BINDING is CI-mechanically enforced at ship; FIRST production-enable card to ship under bounded-parallel limit=2.** The 8-phase smoke re-measures wall-clock latency live at 8 families (D8; bounded-parallel projection ~22-26s, likely PASS band, under the 45s FAIL line) and inspects persisted `evidence_span` for doctrine cleanliness (L5 BINDING). Open questions: OPDEC-A (operator-gate ratification at PR-creation time).
