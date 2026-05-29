# MCP-021C-EDGE-FAMILY-G-ENABLE — Family G production-mode flip

**Status:** Design draft
**Epic:** MCP — production-mode enablement (Epic 12 track; semantic-referee roadmap)
**Release:** Card 3 (terminal) of 3 in the FAMILY-G suite (MCP-SERVER-008-FAMILY-G → OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK → EDGE-FAMILY-G-ENABLE)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/360
**Intent brief:** `docs/designs/MCP-021C-EDGE-FAMILY-G-ENABLE-intent.md` (operator-authored, committed at `19fca47`)
**Branch:** `feat/MCP-021C-EDGE-FAMILY-G-ENABLE`
**Template card (faithful replica of):** `MCP-021C-EDGE-FAMILY-F-ENABLE` (PR #348, shipped `65dbfc3`; smoke PASS `6395023`; design `docs/designs/MCP-021C-EDGE-FAMILY-F-ENABLE.md`; smoke audit `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-2026-05-28.md`)
**Predecessors on main (Phase 0 verified per intent §2):**
- `87ef6ac` — Card 1 `MCP-SERVER-008-FAMILY-G` PASS (hosted amendment; G classifier shipped to MCP server; G admin_validation baseline live)
- `cfc1fd4` — Card 2 `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK` PASS (`resolution_progress` / `family_g` / `concedes_broader_point` added to `DOCTRINE_RISK_FAMILIES` → L5 BINDING is now CI-mechanically enforced for any Family-G smoke audit)
- `65dbfc3` / `6395023` — the FAMILY-F chain terminal (Card 3 of the F suite); 6 production families A+B+C+D+E+F live; this card is its faithful G replica

---

## Goal (one paragraph)

Flip one boolean — `productionEnabled: false → true` for the `resolution_progress` (Family G) entry in `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (line 101). After merge + auto-deploy, every new argument submitted via `submit-argument` will fire SEVEN sequential production runs (A+B+C+D+E+F+G) instead of six. The dispatcher is registry-derived (`autoTriggerDispatcher.ts:87,403,431`) — flipping the flag extends the auto-trigger to G with **zero dispatcher edits**. The Edge subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress'] = {'ai_classifier'}` is **already present** (added at Card 1A `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET`, line 77) and is **mode-agnostic**, so the production flip inherits the correct 18-key ai_classifier subset with no subset-filter change. The card respects cdiscourse-doctrine §1 (production flip is a routing decision, never a verdict on Family G's resolution-progress quality), §10a (Family G rows persist as Machine Observations with `source = 'machine'`; the resolution-progress framing — narrowing / conceding / synthesis-readiness — is structurally distinct from "this argument won/lost"), and §7 (no AI calls leak to client; all classification stays inside Edge Functions + the hosted MCP server). **Third production-enable card to ship its smoke audit under L3+L4+L5 mechanical CI enforcement; SECOND card with L5 BINDING enforcement — and the FIRST whose L5 BINDING is CI-mechanically enforced from the moment of ship (Family F's L5 BINDING was operator-binding only because `critical_question` was not in `DOCTRINE_RISK_FAMILIES` at F's ship; Card 2 of this suite closed that gap for G before this card ships).** The card also re-measures wall-clock latency live at 7 families against the codified budget (≈36.3s projection, in the 30–45s PARTIAL band, under the 45s FAIL line) — the banked discipline from `OPS-MCP-LATENCY-BUDGET`.

---

## Three G-specific divergences from the F-ENABLE template (read these first)

This card is a faithful replica of `MCP-021C-EDGE-FAMILY-F-ENABLE`, with exactly three substantive divergences. An implementer who mirrors F blindly without honoring these three will produce a wrong card.

| # | Aspect | F-ENABLE (template) | G-ENABLE (this card) | Why it differs |
|---|---|---|---|---|
| **DIV-1** | **Subset filter** | **NOT applied** for F — Family F is uniform `ai_classifier` (all 14 keys), so absence = full passthrough; F's defensive tests (FFE-15/16) assert the *absence* of an entry | **ALREADY PRESENT** for G — `resolution_progress: {'ai_classifier'}` at line 77 (Card 1A). Family G is MIXED-source (5 auto_metadata + 7 lifecycle + **18 ai_classifier** = 30 total); the entry filters production-mode G to the 18 ai_classifier keys, no deterministic leak. This card's defensive tests assert the *presence + the 18-key result* | Family G is mixed-source; uniform-source families (E, F) need no entry, mixed-source families (D, G) need one. The entry was added at Card 1A, not this card. |
| **DIV-2** | **L5 BINDING enforcement** | **Operator-binding only** at F's ship — `critical_question` was NOT in `DOCTRINE_RISK_FAMILIES`; the F smoke satisfied L5 via explicit `evidence_span` content; the F audit recommended a follow-up OPS card to add it | **CI-mechanically enforced** — `resolution_progress` / `family_g` / `concedes_broader_point` are in `DOCTRINE_RISK_FAMILIES` (`scripts/ops/audit-lint-rules.cjs:55-79`, added by Card 2 of this suite). The G smoke audit MUST include persisted `evidence_span` inspection or CI fails the audit PR | Card 2 of the G suite (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`) added G to the doctrine-risk set as a prerequisite; the smoke author cannot skip Phase 6 doctrine and pass CI |
| **DIV-3** | **Latency context** | 5→6 families; design projected ~27-28s typical; smoke measured 26s wall (42% headroom under 45s) | **6→7 families**; the codified `OPS-MCP-LATENCY-BUDGET` anchors on a measured 6-family wall p95 ≈ 30.4s and projects 7-family ≈ 36.3–36.9s (**PARTIAL band — past the 30s warning, under the 45s FAIL line**); the smoke RE-MEASURES live with N=5 fresh submissions (D8) | The 30s warning line is already crossed at 6 families; G enters right at that line. The 45s FAIL line is projected to cross at the 9th family, so the parallelization card is the pre-I gate, not pre-G. A live re-measure at 7 confirms the projection holds. |

Everything else (the boolean-flip mechanics, the registry-derived dispatcher, the card-scoped binding test pattern, the 8-phase smoke skeleton, the doctrine self-check structure) mirrors F-ENABLE.

---

## Stage 2B NOT REQUIRED

The production-flip decision was made at Gate B (operator-authorized chain-through after Card 2 PASS, with explicit data review). Per intent §1-§2:

- Card 1 (`MCP-SERVER-008-FAMILY-G`) shipped the G classifier to the hosted MCP server and proved the doctrine existential live (Phase 4b) under admin_validation mode.
- Card 1A (`MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET`) added the Edge subset-filter entry so admin_validation (and, mode-agnostically, production) G requests filter to the 18 ai_classifier keys — without it, the Edge sent all 30 keys and the MCP server rejected the 12 deterministic keys (`unsupported_rawKey` → `mcp_validation_failed`).
- Card 2 (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK`) added `resolution_progress` / `family_g` / `concedes_broader_point` to `DOCTRINE_RISK_FAMILIES` so the production-enable smoke is mechanically L5-enforced.

Family G mixed-source posture (5 auto_metadata + 7 lifecycle + 18 ai_classifier) was verified at Card 1A and re-verified at design time via `mcpFamilyGEdgeMcpSubsetFilter.test.ts` (SFG-1..SFG-9, 9/9 PASS at HEAD `19fca47`). No subset-filter change is needed in this card — the entry already exists and is mode-agnostic. No architectural complexity surfaces during designer Phase A: this is a one-boolean flip with defensive tests + a smoke audit that satisfies L3+L4+L5 with L5 CI-mechanically enforced. **No internal Stage 2B operator decision required mid-card.** Stage 2 of the suite is CONDITIONAL HALT only (20 triggers in §"HALT trigger disposition" below).

---

## Phase A.1 — familyRegistry current + post-flip state (registry flip)

Verbatim read of `supabase/functions/_shared/booleanObservations/familyRegistry.ts` at HEAD (`19fca47`; this branch):

### Family G entry pre-flip (current state)

```ts
// supabase/functions/_shared/booleanObservations/familyRegistry.ts:99-103
{
  family: 'resolution_progress',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

Line numbers: opening brace at line 99; `family:` at line 100; **`productionEnabled: false,` at line 101**; `adminValidationEnabled: true,` at line 102; closing brace at line 103.

### Family G entry post-flip (target state)

```ts
{
  family: 'resolution_progress',
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
| 6 | **resolution_progress (G)** | **false → true** | true | **99-103** | **1 boolean character** |
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

Post-flip behaviour: returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme', 'critical_question', 'resolution_progress']` (length 7, A→G registry order).

### `filterFamiliesForMode()` function shape

Lines 141-156 — unchanged byte-equal. Post-flip, `filterFamiliesForMode(['resolution_progress'], 'production')` returns `['resolution_progress']` (currently returns `[]` because G is production-disabled).

**Phase A.1 verdict: BINDING YES.** The 1-line diff is exactly 1 boolean change (line 101). A/B/C/D/E/F remain `true`; H/I/J remain `false`; all `adminValidationEnabled` values remain `true`. The exported function signatures and bodies are byte-equal preserved. Reviewer verifies by `git diff --stat` showing 1 file / 1 line / +1 / -1 on `familyRegistry.ts`.

---

## Phase A.2 — Auto-trigger 7-family inclusion mechanism (registry-derived; VERIFY, no edit)

`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` verbatim citations (READ-ONLY in this card):

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
  // preference: observability + idempotency clarity ...
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
- **No hard-coded family list anywhere in the dispatcher.** The comment at lines 399-402 is explicit: "No hard-coded family literal here — the production family list is the runtime registry's productionEnabledFamilies() output. Adding or removing a production family is a 1-boolean flip in familyRegistry.ts; no edit to this file is needed." Asserted by the existing `DREG-2` (no family literals in dispatcher source) and `TRG-18` (dispatcher source-scan) tests.

### Node-probe evidence: post-flip `productionEnabledFamilies()` = 7

Simulated the post-flip registry shape (flipping `resolution_progress` productionEnabled false→true) and ran the exact registry-derive logic at design time:

```
POST-FLIP productionEnabledFamilies():
["parent_relation","disagreement_axis","misunderstanding_repair","evidence_source_chain","argument_scheme","critical_question","resolution_progress"]
length = 7
G present = true
H present = false
I present = false
J present = false
A-G order preserved = true
```

Pre-flip (current HEAD `19fca47`, post FAMILY-F chain): `productionEnabledFamilies()` returns `[A, B, C, D, E, F]` (length 6). The for-of loop runs 6 iterations. Post-flip: returns `[A, B, C, D, E, F, G]` (length 7); the for-of loop runs 7 iterations. The dispatcher's per-iteration try/catch (in `dispatchOneFamilyIteration` lines 224-356) preserves failure isolation — one family's failure does not abort the next iteration. The loop is intentionally SEQUENTIAL (NOT `Promise.all`) per the Stage 2B operator binding; `DREG-6` asserts no `Promise.all` over the family list.

**Phase A.2 verdict: BINDING YES.** The registry-derived dispatcher already picks up G after the flip — **no dispatcher code change required.** HALT trigger #3 (dispatcher hard-codes families) is structurally impossible: there are zero family literals in the dispatcher. HALT trigger #14 (auto-trigger broken for A–F — existential) is structurally guarded because each family iteration runs in its own try/catch and the loop iterates regardless of prior outcomes; the smoke Phase 2 empirically verifies A+B+C+D+E+F still fire alongside G.

---

## Phase A.3 — Subset filter ALREADY PRESENT + mode-agnostic (no change; cite SFG-6)

> **This is DIV-1 — the principal divergence from F-ENABLE.** F was uniform ai_classifier (no subset entry; FFE-15/16 asserted *absence*). G is mixed-source and HAS a subset entry that filters production-mode requests to the 18 ai_classifier keys.

### Family G mixed-source posture (re-verified at design time)

Family G (`resolution_progress`) is a **mixed-source** family: 5 auto_metadata + 7 lifecycle + **18 ai_classifier** = 30 total keys. The MCP server (per the Card 1 Stage 2B operator decision) supports ONLY the 18 ai_classifier keys; sending the 12 deterministic keys triggers `unsupported_rawKey` → `mcp_validation_failed`.

### Subset filter constant — confirmed PRESENT for resolution_progress

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

The map holds TWO keys: `evidence_source_chain` (Family D) and **`resolution_progress` (Family G, line 77, added at Card 1A)**. This is the correct state for this card.

### Filter is mode-agnostic (the load-bearing property)

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

The subset-filter branch (`allowedSources && !allowedSources.has(def.source)`) has **no `mode` discriminator** — it applies identically under `production` and `admin_validation`. The only mode-dependent step is the upstream `filterFamiliesForMode(...)` family gate (line 127). So for a production-mode Family G request post-flip:
1. `filterFamiliesForMode(['resolution_progress'], 'production')` returns `['resolution_progress']` (post-flip; currently `[]`).
2. Iteration encounters all 30 Family G registry entries; each passes the `eligibleFamilies.includes(def.family)` check.
3. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress']` is the `{'ai_classifier'}` set → the 12 deterministic-source entries (auto_metadata + lifecycle) are skipped; the 18 ai_classifier entries pass.
4. Exactly 18 rawKeys land in `rawKeySet`; exactly 18 definitions land in the map; **no deterministic leak.**

### SFG-6 already proves this (design-time re-verification)

`__tests__/mcpFamilyGEdgeMcpSubsetFilter.test.ts` (Card 1A) — re-ran at HEAD `19fca47`: **9/9 PASS**. The binding tests:
- **SFG-1** — G admin_validation request = exactly 18 ai_classifier rawKeys.
- **SFG-6** — production-mode G request also returns only ai_classifier keys, never the 12 deterministic keys ("subset filter is mode-agnostic; admin + production share the path"). The test's own comment (lines 122-126) anticipates this card: *"Family G is NOT productionEnabled yet (Card 3 flips it), so production mode may filter it out entirely (0 keys) OR, once enabled, return the same 18 ai_classifier keys. This asserts the subset filter does not LEAK deterministic keys in either case."*
- **SFG-8** — confirms uniform families E (16 keys) and F (14 keys) remain full passthrough (no filter entry).

After this card's flip, SFG-6's "once enabled" branch becomes the live path: production-mode G returns the 18 ai_classifier keys. SFG-6 passes both before and after the flip (the no-leak property holds in both cases), so it does NOT change in this card — it transitions from proving "0 or 18, never deterministic" to proving "18, never deterministic" without any edit.

**Phase A.3 verdict: BINDING YES.** Family G's subset filter entry is ALREADY PRESENT (Card 1A) and mode-agnostic; this card MUST NOT add, remove, or modify it. HALT trigger #7 (subset filter for G mismatches Card 1's outcome — it must stay present) is structurally guarded: the entry is verified present at line 77, and this card's new test `GGE-15`/`GGE-16` assert the entry's presence + the 18-key production-mode result. The defensive `FFE-15` test in `edgeFamilyFProductionEnable.test.ts` (which scans the constant block) already tolerates the G entry — its comment (lines 152-155) explicitly notes the map "now holds 'evidence_source_chain' (Family D) + 'resolution_progress' (Family G, added in MCP-SERVER-008A)" and uses a size-agnostic regex; no FFE-15 update is needed.

---

## Phase A.4 — Latency-at-7 + L3/L4/L5 test+smoke plan (DIV-3)

### Codified budget anchor (`OPS-MCP-LATENCY-BUDGET`, issue #351)

- Budget is defined against **`wall_clock_background` p95** (`max(completed_at) − min(started_at)` over the argument's production-success runs). PASS < 30s; **PARTIAL ≥ 30s and < 45s**; FAIL ≥ 45s (or submit blocks on classification — checked first). Constants `WARN_SECONDS = 30` / `FAIL_SECONDS = 45` in `scripts/ops/mcp-latency-report-lib.cjs`.
- Measured 6-family `wall_clock_background` p95 ≈ **30.4s** (live probe; sitting on the 30s warning line). `sum_of_per_family` ≈ 28.7s; per-family p95 empirically flat across A–F (4.0–7.6s regardless of key count).
- 7-family projection: `projectedWallClockP95(7) = measuredWallClockP95(6) + (addedFamilyP95 + perFamilyDispatchGap)`. With `addedFamilyP95 = 6s` (rounded-up median per-family p95) and gap ≈ 0.5s → **≈ 36.3–36.9s** (the intent §2/§4 cites ≈36.3s; the LATENCY-BUDGET doc's illustrative example cites ≈36.9s; both land in the same 30–45s PARTIAL band).
- **Classification: PARTIAL — G is UNDER the 45s FAIL budget, already past the 30s warning.** The 45s FAIL line is projected to cross at the **9th** family. So G can ship sequentially with a known, documented budget; `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` is the pre-I gate, not the pre-G gate.

### D8 — live latency re-measurement is part of the smoke (the banked discipline)

The smoke (Phase 5) re-measures `wall_clock_background` p95 LIVE at 7 families with N=5 fresh submissions (canary-first; gated Anthropic spend ≈ 35–40 calls; no JWTs logged; no `out/` committed) using `scripts/ops/mcp-latency-report.mjs`. It confirms the measured 7-family p95 lands near the ≈36.3s projection. If materially higher → the smoke surfaces it (the 45s-crossing family count shifts; the parallelization pre-H/pre-I decision moves). **Banked-lesson constraint:** if the re-measure adds any ops SQL, it MUST live in the sibling `scripts/ops-latency-sql/` directory (NOT under `scripts/ops/`, which is observability-owned and asserts an exact 16-`.sql`-file recursive count). This card itself adds no SQL.

### Test surface (the implementer's binding; see full Test plan below)

Per intent §3 D7 + §6: familyRegistry G productionEnabled=true; 7-family auto-trigger inclusion; production-mode G 18-key subset (no deterministic leak); Source 6 7-family read; A–F unregressed (byte-equal behavior). Forecast +20 to +60 (HALT +90).

### Smoke surface (the operator's binding; see full Smoke skeleton below)

8-phase production-enable smoke: Phase 1 pre-flight; Phase 2 dispatch (L3a — 7 production runs A–G); Phase 3 targeted-signal (L3b+L4 — ≥1 G positive on resolution-targeted text); Phase 4 read-path (L3c — Source 6 7-family); **Phase 5 live latency re-measure (D8)**; **Phase 6 doctrine (L5 BINDING — persisted `evidence_span` clean; mechanically CI-enforced for G)**; Phase 7 observability + enforcement-loop provenance; Phase 8 verdict + audit-lint exit 0.

**Phase A.4 verdict: BINDING YES.** 7-family sequential dispatch projects ≈36.3s typical (PARTIAL band; under the 45s FAIL line; under `EdgeRuntime.waitUntil` ~150s with ~4x headroom). The dispatcher's failure isolation protects A–F from any Family G slowdown. The smoke re-measures live to confirm the projection (D8).

---

## Test plan — dedicated card-scoped binding (GGE-1..GGE-16) + stale-assertion updates

Following the F-ENABLE pattern (`__tests__/edgeFamilyFProductionEnable.test.ts`), this card adds **one new test file** + light stale-assertion updates to four existing files. The new file is the dedicated card-scoped binding that locks in the post-flip Family G state.

### New test file — `__tests__/edgeFamilyGProductionEnable.test.ts`

Mirrors `edgeFamilyFProductionEnable.test.ts` structurally, with DIV-1 honored: the subset-filter guards assert the entry is PRESENT and that production-mode G returns the 18 ai_classifier keys with no deterministic leak (F's FFE-15/16 asserted *absence* + a 14-key full passthrough). Imports come from the existing helper `__tests__/_helpers/booleanObservationEdgeDeno.ts` (already exports `EDGE_FAMILY_REGISTRY`, `edgeLookupFamilyRegistryEntry`, `edgeProductionEnabledFamilies`, `edgeFilterFamiliesForMode`, `edgeBuildBooleanObservationRequestForArgument`; not modified).

Test surface (~18 individual tests counting parametric `for` iterations):

| Test(s) | Asserts | Mirrors |
|---|---|---|
| **GGE-1** | `edgeLookupFamilyRegistryEntry('resolution_progress').productionEnabled === true` | FFE-1 |
| **GGE-2** | `…adminValidationEnabled === true` (unchanged across the flip) | FFE-2 |
| **GGE-3** | `edgeProductionEnabledFamilies()` includes `'resolution_progress'` | FFE-3 |
| **GGE-4** | `edgeProductionEnabledFamilies()` has length **7** | FFE-4 |
| **GGE-5** | `edgeProductionEnabledFamilies()` equals `[A,B,C,D,E,F,G]` in registry order (ending `'critical_question','resolution_progress'`) | FFE-5 |
| **GGE-6** | `edgeFilterFamiliesForMode(['resolution_progress'], 'production')` equals `['resolution_progress']` | FFE-6 |
| **GGE-7:{H,I,J}** (×3) | each of `claim_clarity` / `thread_topology` / `sensitive_composer` `productionEnabled === false` (no widening past G) | FFE-7 (×4 → ×3; G removed from the admin-only set) |
| **GGE-8** | `EDGE_FAMILY_REGISTRY[6].family === 'resolution_progress'` AND `productionEnabled === true` AND `adminValidationEnabled === true` (index 6, A→J order preserved) | FFE-8 (index 5 → index 6) |
| **GGE-9** | `EDGE_FAMILY_REGISTRY[0].family === 'parent_relation'` AND `productionEnabled === true` (Family A still iteration #1) | FFE-9 |
| **GGE-10..GGE-15** (×6) | A/B/C/D/E/**F** each remain `productionEnabled === true` (catch accidental drift on the now-6 prior production families; HALT #2) | FFE-10..14 (×5 → ×6; F added to the unchanged set) |
| **GGE-16** | `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` **HAS** an entry for `resolution_progress` (source-text scan; DIV-1 — opposite of FFE-15) | new (G-specific) |
| **GGE-17** | production-mode Family G request contains **exactly 18** ai_classifier rawKeys, byte-equal to admin_validation-mode (mode-agnostic), and contains **none** of the 12 deterministic keys (DIV-1 — opposite of FFE-16's 14-key absence assertion) | new (G-specific) |

> Numbering note: the table above lists GGE-1..GGE-17 to keep the F→G mapping legible; the implementer may renumber the two subset-filter guards as GGE-15/GGE-16 (matching F's slot names) so long as both the presence assertion and the 18-key/no-leak assertion exist. The exact label scheme is an orchestrator default (see ledger); the binding requirement is the *content*.

GGE-16 source-text scan (DIV-1 — note this asserts PRESENCE, the inverse of FFE-15):

```ts
const fs = require('fs');
const path = require('path');
const builderText = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts'),
  'utf8',
);
const constantBlock = builderText.match(/const MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]*?\n\}\);/);
expect(constantBlock).not.toBeNull();
expect(constantBlock![0]).toContain('resolution_progress');  // ← PRESENT (DIV-1)
```

GGE-17 production-mode 18-key + no-leak assertion:

```ts
const FAMILY_G_DETERMINISTIC_EXCLUDED = [
  'branch_suggested','branch_created','point_stalled','point_exhausted','synthesis_candidate',  // auto_metadata (5)
  'narrowed','conceded','confirmed','synthesis_ready','exhausted','branch_recommended','archived_or_resolved',  // lifecycle (7)
];
const reqProd = edgeBuildBooleanObservationRequestForArgument({
  argumentId: 'arg-g-prod-1', parentArgumentId: 'arg-g-prod-0',
  currentText: 'a reply that narrows a claim or concedes a narrow point',
  parentText: 'a broad claim under discussion', threadContextExcerpt: '',
  requestedFamilies: ['resolution_progress'], mode: 'production',
});
expect(reqProd.requestedRawKeys.length).toBe(18);
const sent = new Set(reqProd.requestedRawKeys);
for (const k of FAMILY_G_DETERMINISTIC_EXCLUDED) expect(sent.has(k)).toBe(false);  // no deterministic leak
const reqAdmin = edgeBuildBooleanObservationRequestForArgument({ /* …same… */ mode: 'admin_validation' });
expect([...reqProd.requestedRawKeys].sort()).toEqual([...reqAdmin.requestedRawKeys].sort());  // mode-agnostic
```

### Updated existing test files (stale-assertion updates; no assertion removed or loosened)

These four files contain assertions that name "6 families" / "A+B+C+D+E+F" / "G–J admin-only"; this card flips them to "7 families" / "A+B+C+D+E+F+G" / "H–J admin-only". Each becomes a stronger post-flip binding at the new 7-family baseline; the catch-accidental-widening property is preserved.

| File | Tests affected | Nature of change | Net count |
|---|---|---|---|
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1 ("SIX"→"SEVEN"), FE-2/FE-3 (append `resolution_progress` to the A→F list → A→G), FE-4 (`toHaveLength(6)`→`(7)`), FE-7 `NON_PRODUCTION_FAMILIES` (drop `resolution_progress`; leaves H/I/J → 3 iterations); new **FE-14** explicit G binding mirroring FE-13 | 4 flipped + 1 net new; FE-7 loses 1 iteration → net **+0** | ~5 flipped + 1 new − 1 iteration |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5/FR-6 (append G to the A→F production list), FR-7 `PRODUCTION_ENABLED_FAMILIES` set (add G), FR-26c (add a parallel `filter(['resolution_progress'], production)` keeps it), FR-28 `GJ_FAMILIES` absent-list (drop G → H/I/J), index binding at line 304 (add `productionList[6] === 'resolution_progress'`), `PRODUCTION_ENABLED_NAMES` set at line 316 (add G) | ~6 flipped + 1 new (FR-26c parallel) | net **≈ +1** |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | mixed-list production-filter test expands to include G; add a single-family production-filter test for G (parallel to F's) | 1 flipped + 1 new | net **≈ +1** |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 (append `resolution_progress` → `[A..G]`, length 7), DREG-31 `GJ_FAMILIES` (drop `resolution_progress`; relabel "G–J"→"H–J"; leaves H/I/J) | 2 flipped | net **0** |

**Update discipline:** each updated assertion becomes a stronger post-flip binding at the new 7-family baseline; no assertion is removed or loosened. `DREG-30` (B/C source-scan) and `DREG-32` (classifyArgumentCore not modified) are unaffected. The existing `DREG-24` doctrine ban-list assertion (dispatcher source has no verdict tokens) continues to hold.

### Test forecast summary

| Surface | Test count delta | Notes |
|---|---|---|
| New `edgeFamilyGProductionEnable.test.ts` (GGE-1..GGE-17; ~18 individual counting `for` iterations) | **+18** | 6 core (GGE-1..6) + 3 GGE-7 iterations (H/I/J) + 2 GGE-8/9 + 6 GGE-10..15 (A–F unchanged) + 2 subset-filter guards (presence + 18-key/no-leak) − net offset |
| Updated `mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | +0 net (~5 flipped + 1 new FE-14 − 1 FE-7 iteration) | "SIX"→"SEVEN"; G exits FE-7 list; new FE-14 mirrors FE-13 |
| Updated `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | ≈ +1 net (~6 flipped + FR-26c parallel) | A→F becomes A→G; index 6 binding added |
| Updated `mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | ≈ +1 net | production-filter mixed-list gains G + single-family G test |
| Updated `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | +0 net (~2 flipped) | DREG-29 → 7; DREG-31 → H–J |
| **Net new tests** | **+20 (typical) to ~+30 (conservative upper)** | Within +20 to +60 forecast (intent §6); HALT ceiling +90 (intent §5) |

**Doctrine ban-list assertions:** the new test file contains no user-facing strings (it asserts structural rawKey sets + registry state). The live-data doctrine ban-list test is the smoke's Phase 6 (16-pattern scan over persisted `evidence_span` from a resolution-targeted argument) — see Smoke skeleton.

---

## Smoke template skeleton (8-phase; L3+L4+L5 + D8 latency; L5 CI-mechanical for G)

**Filename:** `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-template.md` (the operator fills it post-merge and commits `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-<YYYY-MM-DD>.md`).

**`Audit-Lint: v1`** marker MUST appear on line 3 (CI lint enforces this; HALT #18). The audit type is **production-enable** → the audit-lint rules require phases `phase-1-preflight`, `phase-2-auto-trigger-dispatch`, `phase-3-targeted-signal`, `phase-4-read-path`, `phase-5-regression` (`REQUIRED_PHASES_BY_AUDIT_TYPE['production-enable']`), with `phase-2/3/4` demanding direct-proof (`DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE`). Because `resolution_progress` / `family_g` / `concedes_broader_point` ∈ `DOCTRINE_RISK_FAMILIES`, the **L5 persisted `evidence_span` inspection is mechanically required** (`L5_PERSISTED_INSPECTION_PATTERNS`) — CI fails the audit PR if it is missing (DIV-2). The phase-header IDs below map to the normalized required IDs so the linter recognizes them; the latency re-measure + doctrine sections are additive phases the linter accepts.

### 8-phase outline (L3 / L4 / L5-BINDING / D8 sections marked)

```markdown
# MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-021C-EDGE-FAMILY-G-ENABLE (Family G resolution_progress production-mode flip;
  18-key ai_classifier subset of a 30-key mixed-source family; third production-enable card
  under L3+L4+L5 mechanical CI enforcement; SECOND card with L5 BINDING, FIRST whose L5 BINDING
  is CI-mechanically enforced at ship via DOCTRINE_RISK_FAMILIES)
**Chain position:** Card 3 (terminal) of 3 in the FAMILY-G suite
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)

## Phase 1 — Pre-flight
- [ ] HEAD at merge SHA; git status clean (only the known operator-territory untracked files).
- [ ] Edge Functions auto-deployed (submit-argument + classify-argument-boolean-observations reflect post-merge timestamps).
- [ ] Edge familyRegistry G entry post-merge: productionEnabled: true, adminValidationEnabled: true (line 101 flip confirmed live; HALT #4 defense).
- [ ] A/B/C/D/E/F entries byte-equal (productionEnabled: true). H/I/J byte-equal (productionEnabled: false).
- [ ] Subset filter entry for resolution_progress STILL PRESENT (DIV-1; HALT #7).
- [ ] Targeted regression: Jest count ≥ <post-merge baseline> + new tests; Deno baseline byte-equal (no mcp-server change).
**Result:** ☐ PASS ☐ FAIL

## Phase 2 — Auto-trigger dispatch (L3a) — 7 production runs A+B+C+D+E+F+G
- [ ] Submit a NEW resolution-progress-targeted argument via submit-argument (NEW text; NOT a prior Card 1 fixture). Arg id recorded.
- [ ] Wait ~40s for the 7-family background dispatch.
- [ ] Query argument_machine_observation_runs: EXACTLY 7 production runs (run_mode='production') for A+B+C+D+E+F+G.
- [ ] All 7 runs status='success' (or clean 'failed'; no missing rows).
- [ ] H/I/J have ZERO production rows for this arg (registry-derived dispatcher correctly excluded them).
- [ ] Capture per-family duration table + total dispatch wall-time (feeds Phase 5).
**Result:** ☐ PASS ☐ FAIL — _<arg id; run ids>_

## Phase 3 — Targeted-signal (L3b + L4) — Family G positive result row required
- [ ] Targeted text deliberately exercises a resolution_progress pattern (narrows a claim / concedes a narrow point /
      proposes synthesis / identifies common ground / isolates an unresolved point / proposes settlement terms).
- [ ] Query argument_machine_observation_results for the G production run: ≥1 positive row with raw_key in the 18 ai_classifier
      keys (narrows_claim, concedes_narrow_point, ready_for_synthesis, suggests_side_branch, suggests_diagonal_tangent,
      accepts_partial_with_caveat, concedes_with_new_dispute, proposes_settlement_terms, accepts_settlement_terms,
      concedes_broader_point, common_ground_identified, unresolved_point_isolated, synthesis_proposed, move_on_requested,
      issue_closed_by_participant, decision_criterion_proposed, action_item_proposed, followup_question_proposed).
- [ ] 0-positives on targeted text is PARTIAL not PASS (L4) — retry once with a stronger targeted fixture; HALT if still 0.
- [ ] mcp_validation_failed on first AND fallback targeted → HALT + scoped fix card.
**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<arg id; positives table; fixture text>_

## Phase 4 — Read-path (L3c) — Source 6 production rows visible
- [ ] Source 6 query path (machineObservationPersistenceQuery.ts run_mode='production' filter) returns the G production result rows for the Phase 3 arg.
- [ ] A+B+C+D+E+F rows ALSO present in the Source 6 result for the same arg (7-family production read-path coverage).
- [ ] admin_validation rows (if any) are NOT counted as production proof (Source 6 separation invariant holds).
- [ ] Defensive: confirm Family G has NO deterministic_key rows in production (the 12 auto_metadata/lifecycle keys never reach the classifier; subset filter holds end-to-end — DIV-1).
**Result:** ☐ PASS ☐ FAIL

## Phase 5 — Latency re-measure at 7 families (D8)
- [ ] N=5 fresh submissions (canary-first; gated; no JWTs logged; no out/ committed); each fires 7 production runs.
- [ ] Run scripts/ops/mcp-latency-report.mjs; compute wall_clock_background p50/p95 at 7 families.
- [ ] Classify against the 30s/45s budget; compare measured-7-family p95 to the ≈36.3s projection.
- [ ] State whether the 45s-crossing family count (projected 9th) still holds; if measured materially higher → surface (parallelization pre-H/pre-I decision moves).
- [ ] Q9 clean (auto-trigger runs classify as audit_or_smoke_rerun; no organic_duplicate_candidate for fresh args).
- [ ] If the report adds ops SQL, it lives in scripts/ops-latency-sql/ (NOT scripts/ops/ — observability-owned 16-file count; banked lesson).
**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<p50/p95 table; projection comparison>_
      (PARTIAL is EXPECTED at 7 families: p95 in the 30–45s band, under the 45s FAIL line.)

## Phase 6 — Doctrine (L5 BINDING; CI-mechanically enforced for Family G)
- [ ] R1 column pre-check: argument_machine_observation_results has raw_key, confidence, evidence_span, family, run_id.
- [ ] Use a live ADVERSARIAL resolution text (asymmetric resolution: concede-on-one-axis-while-pressing-another; settlement-terms framing; broad-point concession) likely to fire a verdict-adjacent key (concedes_broader_point — G's doctrinal-axis partner; concedes_narrow_point; ready_for_synthesis).
- [ ] Query persisted evidence_span for the Family G production rows; ban-list scan over the doctrine patterns
      (no truth/victory/defeat tokens: winner, loser, won, lost, defeated, conceded-as-loss, true, false, correct, invalid, refutes, proves wrong, weak argument, fallacy, etc.).
- [ ] Verify ≥1 clean firing (doctrine-clean evidence_span). If any G production evidence_span contains a resolution-VERDICT token → HALT IMMEDIATELY + FAIL (HALT #17; BINDING DOCTRINE FAIL).
- [ ] Doctrine note: G's keys are STRUCTURAL game-state observations (a point narrowed / a synthesis is ready / common ground exists) — never "X won this exchange". A concession is a scoring REPAIR, not a scoring DEFEAT (cdiscourse-doctrine §1; point-standing-economy doctrine).
**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<fixture text; G rows; ban-list scan output>_

## Phase 7 — Observability + enforcement-loop provenance
- [ ] Q14 density: Family G production density present (first real production data for G).
- [ ] Record the 7-family operational state (A+B+C+D+E+F+G production LIVE; H/I/J admin_validation only).
- [ ] Enforcement provenance subsection: "third PRODUCTION-ENABLE card linted by audit-lint CI; second card under L5 BINDING
      and FIRST whose L5 BINDING is CI-mechanically enforced at ship (resolution_progress/family_g/concedes_broader_point ∈ DOCTRINE_RISK_FAMILIES per Card 2 cfc1fd4). CI workflow run ID: <id>; in_scope count: <n>; linter exit: 0. L3 satisfied by Phases 2+3+4; L4 by Phase 3 targeted text ≥1 positive; L5 BINDING by Phase 6 persisted evidence_span inspection (≥1 clean firing)."
- [ ] FAMILY-G suite completion note: 3-card suite complete; 7 families production+auto-trigger; H/I/J unsupported.
**Result:** ☐ PASS ☐ FAIL

## Phase 8 — Verdict + authorization
- [ ] Pre-push audit-lint: node scripts/ops/audit-lint.mjs <audit-doc> exits 0.
- [ ] CI runs on the smoke audit PR and exits 0 (L1–L6 mechanically enforced; L3+L4+L5 met; L5 mechanically enforced for G).
- [ ] Verdict:
  - PASS: 7 runs verified; L3/L4/L5 each satisfied by an explicit phase; Phase 6 ≥1 clean firing; latency near projection (or shift documented); A–F unregressed; pre-lint + CI exit 0.
  - PARTIAL: Phase 3 0-positives even on stronger targeted arg; OR Phase 6 0-fire even after fallback; OR Phase 5 p95 in 30–45s (EXPECTED at 7 — flag, not fail).
  - FAIL: Phase 6 dirty firing (resolution-verdict token in G production evidence_span) → IMMEDIATE HALT + fix card; OR Phase 3 mcp_validation_failed on first AND fallback; OR any non-Family-G rawKey on a G run; OR A–F byte-equal/regression failure; OR Phase 5 p95 ≥45s at 7 families (contradicts projection); OR CI passes an L-violating audit.
- [ ] Authorizations on PASS: MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE: PASS; Family G PRODUCTION + auto-trigger LIVE (7 families A–G); FAMILY-G 3-card suite COMPLETE; MCP-SERVER-009-FAMILY-H authorized (H/I/J still unsupported).
**Final verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL
```

---

## HALT trigger disposition (all 20 from intent §5)

| # | Trigger | Structural check |
|---|---|---|
| 1 | familyRegistry affects any family other than G | 1-line diff on line 101 only; GGE-10..15 assert A–F byte-equal; reviewer `git diff --stat` = 1 file / 1 line / +1 / −1. |
| 2 | A–F productionEnabled flipped (already true; do not touch) | A–F remain `true` (GGE-10..15 explicit; FR-* / FE-* / DREG-29 assertions). |
| 3 | Dispatcher hard-codes families (must stay registry-derived) | Dispatcher has NO family literals (DREG-2, TRG-18); no dispatcher edit; line 403 derives from registry; node-probe confirms 7. |
| 4 | G adminValidationEnabled flipped to false (must stay true) | GGE-2 explicitly asserts `adminValidationEnabled: true` post-flip; line 102 unchanged. |
| 5 | Source 6 change | `machineObservationPersistenceQuery.ts` not edited; not in scope. |
| 6 | Schema change | No migration; `mcpBooleanObservationSchema.ts` not edited. |
| 7 | Subset filter for G mismatches Card 1's outcome (it must STAY PRESENT) | DIV-1: entry verified PRESENT at line 77; GGE-16 asserts presence; GGE-17 asserts the 18-key production-mode result + no deterministic leak; SFG-6 (9/9 PASS) cited. This card does NOT touch the subset filter. |
| 8-13 | Protocol + security (new taxonomy keys / MCP schema version / A–G prompt changes / hosted MCP file changes / secret exposure / raw body-prompt-response-token-key logging) | `nodeLabelTypes.ts`, `mcpBooleanObservationSchema.ts`, `mcp-server/**` (incl. G classifier shipped Card 1), all prompts, env, and `emitAutoTriggerLog` all byte-equal / not in scope. No new env var; no key logging. |
| 14 | **Auto-trigger broken for A–F (existential)** | Per-iteration try/catch isolates each family (`dispatchOneFamilyIteration` lines 224-356); the for-of iterates regardless of prior outcomes; smoke Phase 2 verifies A–F still fire alongside G. |
| (forecast) | Forecast > +90 | Forecast +20 typical; conservative upper +30; well under +90 ceiling. |
| 16 (L5) | **Production-mode smoke missing live adversarial resolution_progress evidence_span inspection (L5 BINDING — existential)** | DIV-2: Phase 6 of the smoke template mandates R1 column pre-check + live adversarial resolution text + persisted `evidence_span` ban-list scan + 0-fire fallback. CI mechanically requires it (`resolution_progress`/`family_g`/`concedes_broader_point` ∈ `DOCTRINE_RISK_FAMILIES`), so a missing inspection fails the audit PR. |
| 17 (doctrine) | **Any G production output evidence_span contains a resolution-verdict token (BINDING DOCTRINE FAIL; HALT)** | Phase 6 includes "If any G production evidence_span contains a resolution-verdict token → HALT IMMEDIATELY + FAIL"; Phase 8 verdict rules explicit FAIL on Phase 6 dirty firing. |
| 18 | Smoke audit lacks `Audit-Lint: v1` marker | Smoke template skeleton places the marker on line 3. |
| 19 | Smoke audit fails local pre-lint OR fails CI | Phase 8 makes local pre-lint a precondition for push; CI workflow run ID required in Phase 7 provenance; the enforcement loop is "the lint working as designed", not a card failure. |
| 20 | Unclassified untracked files at PR creation | Working tree contains only the known operator-territory untracked files; designer commits ONLY the design doc; the implementer commits only the flip + tests + docs. |

Plus the intent §5 entries "intent lacks L3/L4/L5 obligations" and "smoke audit lacks marker/fails CI" — both satisfied by the intent (which carries D6.L3/L4/L5) and the smoke template (marker on line 3; pre-lint + CI gate in Phase 8).

**Zero HALT triggers fire** under this design. The card is a single-boolean flip with structural protections against each named risk, including the two doctrine-binding G-specific triggers (16, 17) and the subset-filter-must-stay-present trigger (7) that are the load-bearing checks for this card.

---

## File-touch matrix

### NEW files (this card)

| File | Purpose | Lines (approx) |
|---|---|---|
| `docs/designs/MCP-021C-EDGE-FAMILY-G-ENABLE.md` | This design doc | ~650 |
| `__tests__/edgeFamilyGProductionEnable.test.ts` | Dedicated card-scoped binding for the G production flip + subset-filter-PRESENT + 18-key/no-leak defensive guards (GGE-1..GGE-17) | ~200 |
| `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-template.md` | Smoke template with `Audit-Lint: v1` marker + 8-phase outline incl. L3+L4+L5 (L5 CI-mechanical) + D8 latency re-measure | ~300 |

### MODIFIED files (this card)

| File | Change | Net lines | Tests affected |
|---|---|---|---|
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | **Line 101: `productionEnabled: false` → `productionEnabled: true`** | +1/−1 (1 char effective) | All registry tests (see Test plan) |
| `__tests__/mcpOneTwoOneCEdgeFamilyEnablement.test.ts` | FE-1 "SIX"→"SEVEN"; FE-2/3 A→G; FE-4 length 7; FE-7 drops G; new FE-14 (mirrors FE-13) | +0 net | ~5 flipped + 1 new − 1 iteration |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | FR-5/6 add G; FR-7 set + FR-28 list adjust; FR-26c parallel for G; index-6 binding; PRODUCTION_ENABLED_NAMES set | ≈ +1 net | ~6 flipped + 1 new |
| `__tests__/mcpOneTwoOneCEdgeAdminValidationMode.test.ts` | mixed-list adds G; new single-family G production-filter test | ≈ +1 net | 1 flipped + 1 new |
| `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | DREG-29 → `[A..G]` length 7; DREG-31 → H–J | 0 net | 2 flipped |
| `docs/core/current-status.md` | Phase-framing handoff paragraph appended (per intent §4 allowed scope; H2 test-count section reconciled with the smoke/review count) | +30 to +50 lines | none (docs) |

### DELETED files

**None.**

### Explicit NON-TOUCH list (READ-ONLY; any edit fires the named HALT trigger)

| File / surface | Why read-only | HALT trigger |
|---|---|---|
| `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts` | Registry-derived; no code change needed | #3 |
| `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` | Subset filter for G ALREADY PRESENT (Card 1A) + mode-agnostic; preserved byte-equal | #7 |
| `__tests__/mcpFamilyGEdgeMcpSubsetFilter.test.ts` | Card 1A's SFG-1..9 already prove the 18-key subset incl. SFG-6 production-mode; byte-equal (passes before + after the flip) | #7 |
| `__tests__/edgeFamilyFProductionEnable.test.ts` | F's FFE-15 already tolerates the G subset entry (size-agnostic regex, comment names resolution_progress); byte-equal | #7 |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Single per-call orchestrator; no signature change | DREG-32 |
| `supabase/functions/submit-argument/index.ts` | Dispatcher call site preserved byte-equal | TRG invariants |
| `supabase/functions/classify-argument-boolean-observations/index.ts` | Edge classifier HTTP handler; admin_validation path unchanged | #5 |
| `mcp-server/**/*` (incl. the G classifier + prompt) | Hosted MCP server byte-equal; G server-side shipped at Card 1 `87ef6ac` | #10, #11 |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts` | Source 6 production filter preserved byte-equal | #5 |
| `src/features/nodeLabels/machineObservationDefinitions/familyG.ts` (+ A–F) | Family definitions byte-equal | #10 |
| All migration files | No schema change | #6 |
| `nodeLabelTypes.ts` / `mcpBooleanObservationSchema.ts` | No new taxonomy keys / no schema version change | #8, #9 |
| `package.json` | No dep install | intent §4 OUT |
| `scripts/ops/audit-lint*` | No audit-lint rule change — `resolution_progress`/`family_g`/`concedes_broader_point` are ALREADY in `DOCTRINE_RISK_FAMILIES` (Card 2); this card needs no rules edit | intent §4 OUT |
| `scripts/ops/mcp-latency-report*` / `scripts/ops-latency-sql/` | Latency tooling is read-only; the smoke RUNS the report but this card adds no SQL/CLI change | intent §4 OUT |

The card's edit surface is exactly **3 new files + 6 modified files** (1 source + 4 tests + 1 docs).

---

## API / interface contracts

No new public API surface. The contracts touched are:

- `productionEnabledFamilies(): ReadonlyArray<MachineObservationFamily>` — return value gains `'resolution_progress'` (length 6 → 7). Signature unchanged.
- `filterFamiliesForMode(['resolution_progress'], 'production')` — now returns `['resolution_progress']` (was `[]`). Signature unchanged.
- `buildBooleanObservationRequestForArgument({ requestedFamilies: ['resolution_progress'], mode: 'production' })` — now returns a request with 18 ai_classifier rawKeys (was 0, because G was production-filtered out upstream). The subset-filter contract (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES['resolution_progress'] = {'ai_classifier'}`) is unchanged.
- `dispatchAutoTriggerForArgument(argumentId, debateId, serviceClient): Promise<AutoTriggerOutcome[]>` — returns 7 outcomes instead of 6 (one per production family). Signature unchanged.

---

## Edge cases

- **Empty / sparse signal:** a resolution-targeted arg that yields 0 G positives is PARTIAL, not PASS (Phase 3 L4 binding); retry with a stronger targeted fixture; HALT if a second attempt still 0.
- **`mcp_validation_failed` on the G production run:** the subset filter (18 keys) should prevent the `unsupported_rawKey` path that caused Card 1's pre-fix failures; if it recurs, the subset entry has regressed (HALT #7). One retry; HALT if a second attempt fails.
- **Concurrent / duplicate runs:** benign — Source 6 dedupes by `raw_key` per argument; cross-family raw_keys are pairwise disjoint; the dispatcher's per-family idempotency pre-check (`findExistingRun`) skips an already-successful G run.
- **One family iteration crashes:** isolated by `dispatchOneFamilyIteration`'s try/catch; A–F still complete; the dispatcher returns 7 outcomes (the crashed one is a clean `failed`).
- **Latency at 7 families lands in 30–45s:** EXPECTED (PARTIAL band; under the 45s FAIL line) — flag, do not fail. Only ≥45s at 7 families is a FAIL (contradicts the projection; the parallelization decision moves earlier).
- **Doctrine edge — can a concession read as a verdict?** No. Family G's keys are structural game-state observations (`narrows_claim`, `ready_for_synthesis`, `common_ground_identified`, `concedes_broader_point`). A concession is a scoring REPAIR, not a scoring DEFEAT (cdiscourse-doctrine §1; point-standing-economy doctrine). The MCP-server prompt guards + the persisted `evidence_span` ban-list scan (Phase 6) ensure no verdict token surfaces; the 5-layer doctrine defense was proven live at Card 1 Phase 4b.
- **Kill switch:** `semantic_referee_runtime_config.enabled = false` halts auto-trigger for ALL families (A–G) at the next dispatch (read once per dispatch in `readEnabledFlag`). Per-family rollback (just G) requires a follow-up PR flipping the boolean back.

---

## Dependencies (cards / docs / files)

- **Assumes Card 1 `MCP-SERVER-008-FAMILY-G` complete** (`87ef6ac`) — the G classifier is deployed to the hosted MCP server; without it the G production runs would `mcp_validation_failed`.
- **Assumes Card 1A `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` complete** — the Edge subset-filter entry (`booleanObservationRequestBuilder.ts:77`) filters G to the 18 ai_classifier keys; without it the Edge would send all 30 keys and the MCP server would reject the 12 deterministic keys.
- **Assumes Card 2 `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK` complete** (`cfc1fd4`) — `resolution_progress`/`family_g`/`concedes_broader_point` ∈ `DOCTRINE_RISK_FAMILIES`; this is what makes the smoke's L5 BINDING CI-mechanically enforced (DIV-2).
- **Reads** `familyRegistry.ts` at `productionEnabledFamilies()`; the dispatcher at `dispatchAutoTriggerForArgument` → `productionEnabledFamilies()`; the request builder at `buildBooleanObservationRequestForArgument` → `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`.
- **Consumes** the `OPS-MCP-LATENCY-BUDGET` codified thresholds + `mcp-latency-report.mjs` for the D8 re-measure.
- **Blocks** `MCP-SERVER-009-FAMILY-H` (the next family-ship card) — authorized only on this smoke's PASS, because H/I/J remain unsupported until their own suites.

---

## Risks

- **Stale-assertion sprawl:** the four updated test files carry several "6 / A–F / G–J" assertions; an incomplete sweep leaves a red test. Mitigation: the Test plan enumerates each file + the exact assertion IDs and line anchors (FE-1/4/7 + FE-14; FR-5/6/7/26c/28 + index-6 + PRODUCTION_ENABLED_NAMES; AVM mixed + single-family; DREG-29/31). The implementer runs `npm run test` and confirms exit 0.
- **DIV-1 inversion (the most likely implementer error):** blindly mirroring F's FFE-15/16 (which assert subset-filter *absence* + 14-key passthrough) would assert the WRONG thing for G. Mitigation: GGE-16/17 explicitly assert *presence* + the 18-key/no-leak result; the DIV table and Phase A.3 call this out as the principal divergence.
- **DIV-2 (L5 mechanical):** unlike F, the G smoke CANNOT skip the persisted `evidence_span` inspection — CI fails the audit PR. Mitigation: Phase 6 is a first-class required section in the template; Phase 8 gates on CI exit 0.
- **Latency PARTIAL misread as FAIL:** a 7-family p95 in the 30–45s band is the EXPECTED PARTIAL outcome, not a failure. Mitigation: Phase 5 + Phase 8 verdict rules state PARTIAL-is-expected; only ≥45s is FAIL.
- **Existing tests that need updating:** the four files above; all are stale-assertion flips at the new 7-family baseline (no behavioral change, no loosening).
- **Migration / operator deploy:** none — pure source flip; auto-deploys via the Supabase GitHub integration. No `db push`.

---

## Out of scope

- **No dispatcher edit** (`autoTriggerDispatcher.ts` is registry-derived; HALT #3).
- **No subset-filter change** (`booleanObservationRequestBuilder.ts` G entry already present + mode-agnostic; HALT #7).
- **No mcp-server change** (the G classifier + prompt shipped at Card 1 `87ef6ac`; HALT #10/#11).
- **No audit-lint rules change** (`resolution_progress`/`family_g`/`concedes_broader_point` already in `DOCTRINE_RISK_FAMILIES` via Card 2).
- **No latency tooling change** (the smoke runs `mcp-latency-report.mjs`; this card adds no SQL/CLI; if the smoke adds SQL it goes in `scripts/ops-latency-sql/`).
- **No A–F flip** (already true); **no H/I/J flip** (each awaits its own suite); **do not start Family H**.
- **No schema / migration / taxonomy / prompt / key / `package.json` change.**
- **No parallelization** — `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` is the pre-I gate, filed only if the projection shows a near-term FAIL crossing.
- **No user-facing UI** — this is server-side classifier routing; Family G Machine Observations are persisted but their rendering is governed by Source 6 + the node-annotation registry (UX-001.5A doctrine), not this card.

---

## Doctrine self-check

Per `cdiscourse-doctrine` skill (mandatory invocation):

| Skill rule | Applied to this card |
|---|---|
| §1 — Score is gameplay analysis, never truth | Production enablement is a routing decision (where the classifier runs), never a verdict on Family G's resolution-progress quality. The flip introduces/modifies no user-facing label. A concession (`concedes_broader_point` / `concedes_narrow_point`) is a scoring REPAIR, never a "loss" — the smoke Phase 6 ban-list scan enforces no victory/defeat/truth token in persisted `evidence_span`. |
| §2 — Heat means activity, not truth | Untouched. The flip adds no heat/engagement signal; latency is a system-performance metric, explicitly NOT a gameplay/truth/heat signal (LATENCY-BUDGET doctrine). |
| §3 — Popularity is not evidence | Untouched. No engagement/popularity input enters the classifier path. |
| §4 — AI moderator hard limits | Family G's classifier returns advisory Machine Observations only (`source = 'machine'`, `authoritative` false). The MCP server-side guards (deployed at Card 1) block verdict-token language at the source; this card does not change them. No client-side AI call. |
| §6 — Secrets policy | No env var added; no service role used by this card's diff; no `ANTHROPIC_API_KEY`/`SERVICE_ROLE` reference; no secret logging. The 1-char boolean flip is the only source-side change. |
| §7 — No AI calls from the production app | Family G classification stays within Edge Functions + the hosted MCP server. The auto-trigger dispatcher is server-side (`supabase/functions/`); client code is unchanged. |
| §10a — Observations vs Allegations | Family G rows persist as Machine Observations (`source: 'machine'`). The resolution-progress framing (narrowing / synthesis-readiness / common ground / settlement terms) is structurally distinct from "the argument won/lost". No raw classifier ID surfaces in UI (governed by the node-annotation registry, not this card). |

Plus `test-discipline` skill (mandatory invocation):

| Skill rule | Applied to this card |
|---|---|
| Tests are part of the deliverable | The card ships `edgeFamilyGProductionEnable.test.ts` (GGE-1..GGE-17, ~18 individual tests) + 2 new tests in updated files + 4 stale-assertion file updates. Each post-flip state is bound by ≥1 explicit assertion. |
| Required coverage — doctrine constraints | The smoke audit template's Phase 6 ban-list scan over persisted `evidence_span` from a live adversarial resolution-targeted argument is the live-data doctrine ban-list test (CI-mechanically required for G via `DOCTRINE_RISK_FAMILIES`). |
| Test count tracking | Net delta +20 typical (within the +20 to +60 forecast). `docs/core/current-status.md` is updated AFTER the count is confirmed; its H2 test-count section MUST match the smoke/review count (the cross-check rule from the multi-card chain protocol). |
| Gate timeout handling | Implementer captures `npm run test` exit code explicitly (the count is taken from the `Test Suites: … / Tests: …` line with exit 0, not tailed output). |

---

## Operator steps

**On PR merge:** auto-deploy via the Supabase GitHub integration. `submit-argument` and `classify-argument-boolean-observations` redeploy with the new `familyRegistry.ts` source; no separate operator command required.

- `npx supabase functions deploy submit-argument --linked` — **fires automatically** via the GitHub integration (per memory-index `supabase-merge-autodeploy.md`).
- `npx supabase functions deploy classify-argument-boolean-observations --linked` — **fires automatically**.
- No `npx supabase db push --linked` (no migration).

**After auto-deploy (~30-90s post-merge):**
- Run the 8-phase post-merge smoke per the template skeleton above (includes the D8 latency re-measure at 7 families and the L5 BINDING doctrine inspection).
- Commit the completed audit to `docs/audits/MCP-021C-EDGE-FAMILY-G-ENABLE-SMOKE-<date>.md`.
- Local pre-lint `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push.
- CI MUST run on the smoke audit PR and exit 0 (L1–L6 mechanically enforced; L5 mechanically enforced for G via `DOCTRINE_RISK_FAMILIES`).
- On PASS, the FAMILY-G 3-card suite completes; `MCP-SERVER-009-FAMILY-H` becomes authorized.

**Emergency rollback:** flip `semantic_referee_runtime_config.enabled = false` via SQL — halts auto-trigger for ALL families (A–G) at the next dispatch. Per-family rollback (just G) requires a follow-up PR flipping the boolean back; the kill switch is dispatch-wide, not per-family.

---

## Brief ledger (orchestrator-authored design against an operator-authored intent brief)

This design was authored by the roadmap-designer subagent against the **operator-authored intent brief** at `docs/designs/MCP-021C-EDGE-FAMILY-G-ENABLE-intent.md` (committed at `19fca47`). The intent brief carries the binding operator decisions D1–D8, the 20 HALT triggers, and the suite-completion authorization rules. (The design itself is orchestrator-authored; this ledger maps where designer judgment substituted for operator direction.)

### Sections derived from prior Phase framing handoffs (operator-validated source-of-truth chain)

- **Phase A.2 (registry-derived 7-family auto-trigger):** derived from the FAMILY-F chain (which made the dispatcher registry-derived; DREG-1..34) and the F-ENABLE smoke (`6395023`) which empirically confirmed 6-family sequential dispatch (26s wall). Pattern: registry-derived dispatcher; no code change for a new family.
- **Phase A.3 (subset filter already present + mode-agnostic):** derived from Card 1A `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` (the `resolution_progress: {'ai_classifier'}` entry) + its SFG-1..9 tests (incl. SFG-6 production-mode) + intent §2/§3 D3. Pattern: mixed-source families carry a subset entry; uniform-source families do not.
- **Phase A.4 (latency-at-7):** derived from `OPS-MCP-LATENCY-BUDGET` (issue #351) measured 6-family wall p95 ≈ 30.4s + the codified projection method. Pattern: ~6s per added family + ~0.5s gap; 7 families ≈ 36.3s (PARTIAL).
- **Smoke L3+L4+L5 obligations:** derived from intent §6 D6 + the audit-lint rules (`REQUIRED_PHASES_BY_AUDIT_TYPE['production-enable']`, `DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE`, `L5_PERSISTED_INSPECTION_PATTERNS`, `DOCTRINE_RISK_FAMILIES`).

### Sections derived from a pre-launch codebase survey

- **File-touch matrix, HALT table, the exact line numbers (registry line 101; dispatcher 87/403/431; builder 77; rules 55-79), and the stale-assertion map** mapped from current source at HEAD `19fca47`, all verified against the actual repo at design time.
- **DIV-1 (subset filter present, not absent):** confirmed by direct read of `booleanObservationRequestBuilder.ts:68-78` + a live re-run of `mcpFamilyGEdgeMcpSubsetFilter.test.ts` (9/9 PASS) — this is the scope-reality audit for the card's principal divergence from F.
- **DIV-2 (L5 CI-mechanical):** confirmed by direct read of `scripts/ops/audit-lint-rules.cjs:55-79` showing `resolution_progress`/`family_g`/`concedes_broader_point` in `DOCTRINE_RISK_FAMILIES`.
- **Node-probe (post-flip `productionEnabledFamilies()` = 7):** simulated the post-flip registry shape and ran the derive logic; result captured in Phase A.2.

### Sections derived from epic framing

- **Goal paragraph + Stage 2B NOT REQUIRED + Doctrine self-check:** derived from intent §1-§2 (suite position; one-boolean-flip scope; Gate B readiness) + the `cdiscourse-doctrine` skill (§1/§4/§7/§10a) + the `point-standing-economy` doctrine (concession-is-repair-not-defeat, which shapes the G doctrine edge case).

### Sections resolved by orchestrator default rather than explicit operator direction

- **Test file name** `edgeFamilyGProductionEnable.test.ts` — mirrors the F/E precedent; the intent does not name the file.
- **GGE-* label scheme + count distribution** (+20 typical) — mirrors the F FFE-* shape with the H/I/J admin-only set reduced by one iteration (G removed) and the A–F unchanged set increased by one (F added). The two subset-filter guards (GGE-16/17) invert F's FFE-15/16 to assert *presence* + the 18-key/no-leak result (DIV-1). Within the +20 to +60 intent forecast.
- **Smoke phase numbering** — the latency re-measure is placed at Phase 5 and the doctrine inspection at Phase 6 (the intent §7 ordering); the phase-header IDs are written to match the audit-lint normalized required IDs so CI recognizes them.

### Operator-deferred review surface (post-ship)

1. Confirm 7-family auto-trigger captures clean run rows for all 7 families in smoke Phase 2.
2. Confirm Phase 3 produces a deliberately-targeted Family G positive (preferably a verdict-adjacent key like `concedes_broader_point` for Phase 6 L5 coverage).
3. Confirm Phase 5 measured 7-family `wall_clock_background` p95 lands near ≈36.3s (PARTIAL band); if materially higher, decide whether to file the parallelization card earlier than the projected pre-I gate.
4. Confirm Phase 6 doctrine ban-list scan finds zero verdict tokens in persisted G `evidence_span` (the BINDING DOCTRINE FAIL gate; CI-mechanical for G).
5. Decide whether to amend the `familyRegistry.ts` header comment to reflect the post-G state (it describes the post-B/C state; prior cards left it; this card also leaves it because comment edits are out of scope for a 1-character source flip).
6. Confirm suite-completion authorizations (Family H authorized; H/I/J unsupported until their own suites).

---

## Summary line

This is the smallest possible production-mode flip and the terminal card of the FAMILY-G three-card suite: **1 boolean** at line 101 of `familyRegistry.ts` (`resolution_progress` productionEnabled false→true). The dispatcher (registry-derived → node-probe-confirmed 7 families A–G, no edit), the Edge subset filter (ALREADY PRESENT + mode-agnostic → production-mode G = 18 ai_classifier keys, no deterministic leak, SFG-6 9/9 PASS), and the audit-lint L5 enforcement (`resolution_progress`/`family_g`/`concedes_broader_point` already in `DOCTRINE_RISK_FAMILIES`) are all already prepared. Tests confirm 7-family production posture + the 18-key subset. Test forecast: **+20 typical (within +20 to +60 budget; HALT +90)**. Zero HALT triggers fire. **Third production-enable card under L3+L4+L5 mechanical CI enforcement; SECOND L5-BINDING card and the FIRST whose L5 BINDING is CI-mechanically enforced at ship.** The 8-phase smoke re-measures wall-clock latency live at 7 families (D8; ≈36.3s projection, PARTIAL band, under the 45s FAIL line) and inspects persisted `evidence_span` for doctrine cleanliness (L5 BINDING). Open questions: zero.
