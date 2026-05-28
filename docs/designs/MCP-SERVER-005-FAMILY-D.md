# MCP-SERVER-005-FAMILY-D — Evidence-Source-Chain Boolean Observation Classifier (design)

**Status:** Design draft
**Epic:** MCP server family rollout (Family D of B-C-D-E batch; Card 2 of combined launch)
**Release:** Stage 6.x — Machine Observation classifiers
**Issue:** binding source is `docs/designs/MCP-SERVER-005-FAMILY-D-intent.md` (operator-authored intent brief at `bd3dbdf`)
**Intent brief:** [`docs/designs/MCP-SERVER-005-FAMILY-D-intent.md`](./MCP-SERVER-005-FAMILY-D-intent.md)
**Predecessor on main:** `bd3dbdf` (intent brief commit), built atop:
- `ac66b2e` — MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE PASS (Card 1 of combined launch)
- `70b18f2` — MCP-SERVER-004-FAMILY-C-SMOKE PASS
- `05b42c3` — MCP-SERVER-003-FAMILY-B-SMOKE PASS

**Branch:** `feat/MCP-SERVER-005-FAMILY-D`

**Designer recommendation (binding pending Stage 2B operator-decision):** **Path A — Subset (19 ai_classifier-only keys).** Rationale in §6.

---

## 0. Goal (one paragraph)

Family D (`evidence_source_chain`) is the fourth boolean-observation
family registered on the hosted MCP server. Source taxonomy has 27
total entries (5 auto_metadata + 3 lifecycle + 19 ai_classifier);
the auto_metadata and lifecycle keys are deterministically computable
from tree / cluster state and do NOT add classifier value. The
designer recommends the **Subset path** — route only the 19
ai_classifier keys through the MCP server — to avoid: (a) a
compound-key schema-mirror response-shape change (HALT trigger #16),
(b) a MAX_TOKENS bump (HALT trigger #15), and (c) a latency
projection that approaches the Edge timeout. The 8 deterministic
keys (5 auto_metadata + 3 lifecycle) are deferred to a future Edge
adapter card that computes them from tree state without an
Anthropic call. This card adds Family-D-specific server-side files
(`familyDKeys.ts`, `familyDPrompt.ts`, `familyDAnthropic.ts`,
`familyDBanListScan.ts`, `familyDFixtureProvider.ts`) and 5
fixtures, registers `evidence_source_chain` in the shared
validator registry via a one-line addition to
`familyRegistryInit.ts`, routes Family D requests through the
dispatcher's provider table, and extends the hosted smoke script to
15 PASS checks. **The Edge Function family registry already has
the Family D entry** at
`supabase/functions/_shared/booleanObservations/familyRegistry.ts:84-88`
(`productionEnabled: false`, `adminValidationEnabled: true`), so
**no Edge `familyRegistry.ts` edit is required** (HALT trigger #17
respects this). The doctrine framing treats evidence presence /
gap / repair as **structural collaborative grounding**, with
verbatim guards for the 3 doctrine-risk keys (`anecdote_used`,
`burden_request_present`, `evidence_gap_present`).

Doctrine constraints that shape the design:

- **cdiscourse-doctrine §1, §3, §4, §7, §10a** — every Family D
  observation is a structural fact about the move, never a verdict
  about a person; the anti-amplification anchor (§3) prohibits
  treating popularity as evidence; doctrine ban-list scan blocks
  model emission of banned tokens; AI calls remain server-side
  Deno only.
- **cdiscourse-doctrine §6** — `ANTHROPIC_API_KEY` /
  `MCP_SERVER_BEARER_TOKEN` never logged.
- **evidence-doctrine** — evidence presence opens factual-standing
  eligibility but does not grant it; evidence quality challenge
  reduces standing weight; anecdote is legitimate evidence in some
  contexts (no copy implying weakness).
- **point-standing-economy** — evidence gap is a structural
  observation, not an automatic standing drop; standing changes
  when challenged AND the gap persists.
- **test-discipline** — every new public function ships with tests;
  test count strictly increases.
- **supabase-edge-contract** — no Edge code change in this card; the
  family registry is already in shape.

---

## 1. Scope reality (Phase A.1 — Family D source verification + 27-key inventory)

### Family D source verification

Source: `src/features/nodeLabels/machineObservationDefinitions/familyD.ts`.

Verified declaration order: **27 entries total** (15 retroactive + 12 new),
each is a `buildEvidence({ rawKey, source, ... })` block within the
top-level `FAMILY_D_DEFINITIONS` array.

| # | rawKey | Line | source | defaultSurface | priority |
| - | ------ | ---- | ------ | -------------- | -------- |
| 1 | `has_evidence` | 103 | `auto_metadata` | `timeline_node` | 20 |
| 2 | `source_requested` | 136 | `auto_metadata` | `timeline_node` | 15 |
| 3 | `quote_requested` | 163 | `auto_metadata` | `timeline_node` | 16 |
| 4 | `source_attached` | 190 | `auto_metadata` | `timeline_node` | 18 |
| 5 | `quote_attached` | 216 | `auto_metadata` | `timeline_node` | 19 |
| 6 | `sourced` | 242 | `lifecycle` | `timeline_node` | 17 |
| 7 | `quote_requested` | 268 | `lifecycle` | `timeline_node` | 16 |
| 8 | `source_requested` | 294 | `lifecycle` | `timeline_node` | 15 |
| 9 | `asks_for_evidence` | 320 | `ai_classifier` | `timeline_node` | 15 |
| 10 | `provides_evidence` | 353 | `ai_classifier` | `timeline_node` | 20 |
| 11 | `evidence_supports_claim` | 384 | `ai_classifier` | `inspect` | 50 |
| 12 | `creates_source_chain_gap` | 415 | `ai_classifier` | `timeline_node` | 12 |
| 13 | `opens_evidence_debt_marker` | 448 | `ai_classifier` | `timeline_node` | 13 |
| 14 | `closes_evidence_debt_marker` | 480 | `ai_classifier` | `timeline_node` | 14 |
| 15 | `supplies_corroborating_document` | 512 | `ai_classifier` | `timeline_node` | 19 |
| 16 | `source_provided` | 545 | `ai_classifier` | `timeline_node` | 150 |
| 17 | `quote_provided` | 577 | `ai_classifier` | `timeline_node` | 151 |
| 18 | `concrete_example_requested` | 608 | `ai_classifier` | `inspect` | 152 |
| 19 | `concrete_example_provided` | 638 | `ai_classifier` | `inspect` | 153 |
| 20 | `evidence_claim_present` | 668 | `ai_classifier` | `inspect` | 154 |
| 21 | `evidence_gap_present` | 698 | `ai_classifier` | `timeline_node` | 110 |
| 22 | `source_chain_repair` | 735 | `ai_classifier` | `timeline_node` | 155 |
| 23 | `anecdote_used` | 766 | `ai_classifier` | `inspect` | 156 |
| 24 | `statistic_used` | 797 | `ai_classifier` | `inspect` | 157 |
| 25 | `external_authority_used` | 827 | `ai_classifier` | `inspect` | 158 |
| 26 | `evidence_quality_questioned` | 857 | `ai_classifier` | `inspect` | 159 |
| 27 | `burden_request_present` | 887 | `ai_classifier` | `inspect` | 160 |

**Total: 27 entries.** Cross-check against intent brief §1
binding inventory: 27/27 verbatim match.

### Source-breakdown verification (Phase A.1 binding count)

- `auto_metadata`: **5 keys** (#1-5: has_evidence, source_requested,
  quote_requested, source_attached, quote_attached)
- `lifecycle`: **3 keys** (#6-8: sourced, quote_requested,
  source_requested)
- `ai_classifier`: **19 keys** (#9-27)

**Total: 27 = 5 + 3 + 19.** Confirms intent brief §1 + §3 binding
counts. The intent brief's earlier "~12 ai_classifier" estimate is
superseded by the 19-key count verified at Phase 0.

### Compound-key collision (Phase A.1 binding)

Two rawKeys appear under TWO source types each:

| rawKey | Sources | Lines | Compound disambiguator |
| ------ | ------- | ----- | ---------------------- |
| `source_requested` | `auto_metadata` (#2) + `lifecycle` (#8) | 136, 294 | `auto_metadata:source_requested` vs `lifecycle:source_requested` |
| `quote_requested` | `auto_metadata` (#3) + `lifecycle` (#7) | 163, 268 | `auto_metadata:quote_requested` vs `lifecycle:quote_requested` |

The upstream taxonomy disambiguates via `id`:
- `auto_metadata:source_requested` → `id: 'registry:machine_observation:auto_metadata:source_requested'`
- `lifecycle:source_requested` → `id: 'registry:machine_observation:lifecycle:source_requested'`

Both `falsePositiveGuards` arrays explicitly call out the
disambiguation:
- auto_metadata source_requested: "Do NOT confuse with
  asks_for_evidence (the AI-classifier signal); this is the
  structural metadata fact."
- lifecycle source_requested: "Compound key disambiguates from
  auto_metadata source_requested."

**Implication for Subset path:** ai_classifier-only set excludes
all 4 collision entries (none of source_requested or
quote_requested appear under `ai_classifier`). Collision
disappears by exclusion.

**Implication for Full-27 path:** the response-shape would need
compound-keyed `observations` map: `observations:
Record<'<source>:<rawKey>', boolean>` where the prefix
distinguishes the two source types. This is a schema-mirror
breaking change for Family D specifically (Family A/B/C remain
flat-keyed). See §3 below.

### Cross-family key collision check (HALT trigger #2 evaluation)

Family A (16 keys), Family B (14 keys), Family C (17 keys) vs Family D
ai_classifier subset (19 keys):

- Family A ∩ Family D-subset = ∅ (no collision; Family A keys are
  parent-relation structural patterns, Family D keys are
  evidence-source patterns)
- Family B ∩ Family D-subset = ∅ (no collision; Family B is
  disagreement axes)
- Family C ∩ Family D-subset = ∅ (no collision; Family C is
  repair/grounding)

**HALT trigger #2 NOT fired.** No cross-family compound-key
collision; the subset-path schema mirror needs no change.

### IN scope (Subset path; designer's recommended binding)

* `mcp-server/lib/familyDKeys.ts` — frozen **19**-rawKey constant
  (ai_classifier subset of Family D) + per-rawKey `FamilyDPromptEntry`
  blocks + `FAMILY_D_CLASSIFIER_SET_VERSION = 'family-d-v1'`.
* `mcp-server/lib/familyDPrompt.ts` — Family D system + user prompt;
  mirrors the 7 absolute rules verbatim from
  `familyAPrompt.ts:50-57` / `familyBPrompt.ts:65-72` /
  `familyCPrompt.ts:73-79`; adds evidence-source-chain doctrine
  framing including the anti-amplification anchor; adds per-key
  doctrine guards for `anecdote_used`,
  `burden_request_present`, `evidence_gap_present`.
* `mcp-server/lib/familyDAnthropic.ts` — Family D Anthropic
  orchestrator (mirror of `familyCAnthropic.ts`); reuses the shared
  `callAnthropic` wrapper.
* `mcp-server/lib/familyDBanListScan.ts` — Family D response
  doctrine ban-list scan (mirror of `familyCBanListScan.ts`); reuses
  the shared `DOCTRINE_BAN_PATTERNS` constant.
* `mcp-server/lib/familyDFixtureProvider.ts` — fixture-mode provider
  for Family D (mirror of `familyCFixtureProvider.ts`); loads
  `family-d-canonical-response.json`.
* `mcp-server/lib/familyRegistryInit.ts` — ONE-line addition that
  registers `evidence_source_chain` after the existing Family C
  registration.
* `mcp-server/tools/classifyArgumentBooleanObservations.ts` —
  per-family dispatch: route `evidence_source_chain` requests to
  the Family D provider table; Family A, B, C paths remain
  unchanged byte-equal. Tool `description` updated to advertise
  Family D alongside A, B, C.
* Family D fixtures under `mcp-server/fixtures/`:
  - 1 canonical response fixture
  - 1 malformed response fixture
  - 1 ban-list response fixture
  - 5 binding request fixtures (canonical / source-provided /
    evidence-gap / anecdote-used / no-evidence adversarial)
* `mcp-server/tests/familyDKeys.test.ts`,
  `familyDKeysParity.test.ts`, `familyDPrompt.test.ts`,
  `familyDAnthropic.test.ts`, `familyDBanListScan.test.ts`,
  `familyDFixtureParity.test.ts`,
  `familyDResponseValidator.test.ts`,
  `familyDDispatch.test.ts`,
  `familyDDoctrineFixtures.test.ts`.
* Test updates: `familyRegistryInit.test.ts` extends to expect all
  four registered families;
  `familyRegistry.test.ts` adds 4-family cross-rejection tests
  (each family's keys rejected under other families);
  `familyBooleanRequestSchema.test.ts` adds Family D valid-request
  + cross-family rejection tests.
* `scripts/mcp-server-001-smoke.sh` — add 2 Family D PASS checks
  (`[14-compat-boolean-family-d]`,
  `[15-mcp-tools-call-boolean-family-d]`). Tally becomes 15 PASS.
* `docs/core/current-status.md` handoff section update.
* `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md` (operator
  fills in date post-merge).

### OUT of scope

* Family E / F / G / H / I / J key registration.
  `familyRegistryInit.ts` after this card registers exactly
  `parent_relation` + `disagreement_axis` + `misunderstanding_repair` +
  `evidence_source_chain`.
* MCP-021A taxonomy edits (`src/features/nodeLabels/**`). The
  Family D rawKeys come verbatim from the source `familyD.ts`.
* MCP schema version change
  (`mcp-021.machine-observations.boolean.v1` stays).
* Family A, B, or C prompt, Anthropic adapter, ban-list scan,
  fixture provider, or key-mirror changes (`familyA*.ts`,
  `familyB*.ts`, `familyC*.ts` files untouched byte-equal).
* Family A, B, or C behavior changes of any kind — full byte-equal
  preservation per the OPS validator-refactor + Family C smoke
  baselines.
* **Auto_metadata + lifecycle keys (8 total) deferred.** The 5
  auto_metadata keys (#1-5) and 3 lifecycle keys (#6-8) are
  deterministically computable from tree / cluster state. They are
  excluded from MCP server routing in the Subset path. A future
  Edge Function card may compute them deterministically and skip
  the classifier call.
* Edge Function changes. **The Edge family registry already
  contains the Family D entry** at
  `supabase/functions/_shared/booleanObservations/familyRegistry.ts:84-88`
  (`productionEnabled: false, adminValidationEnabled: true`). Per
  intent brief §6 HALT #17, this card ships Family D
  admin_validation-only; production flip is a future card
  (`MCP-021C-EDGE-FAMILY-D-ENABLE`).
* Production auto-trigger for Family D. The dispatcher
  (`autoTriggerDispatcher.ts`) derives the production family list
  from `productionEnabledFamilies()`; Family D's
  `productionEnabled: false` automatically excludes it.
* Source 6 rendering changes. Source 6 reads
  `run_mode='production'` rows; Family D admin_validation rows are
  filtered out.
* Persistence schema changes.
* UI / display-cap / Source-6 rendering changes.
* Compound-keyed response shape (Subset path avoids this).
* MAX_TOKENS bump (Subset path avoids this; budget audit in §2).
* MCP schema mirror change.
* `mcp-server/bootstrap.ts` change.
* Any database migration. No DB shape change in this card.

---

## 2. Token budget analysis (Phase A.2 — both paths)

### Per-key token baseline

Family C: 17 keys × ~85 tokens = ~1445 output; 20.46s for 3 args
at the Edge admin_validation surface. Family A: 16 keys × ~80 = ~1280
output; ~17s. Family B: 14 keys × ~80 = ~1120 output; ~16-18s.

Family D considerations:
- Evidence-citation evidenceSpans tend to be slightly longer than
  Family C's repair-cycle spans (citations include "per the 2024
  EPA report" / "Jones 2024 Nature Climate doi:..." patterns; mean
  span ~5-10% longer than repair spans).
- However, the cap is 240 chars per evidenceSpan; the model
  generally stays well under that. Effective per-key estimate:
  **~90 tokens** for Family D (vs ~85 for Family C).

### Path A — Subset (19 ai_classifier keys)

| Component | Estimate |
| --- | --- |
| Per-key output tokens | ~90 |
| 19 keys total | 19 × 90 = **1710** |
| JSON structure overhead | ~80 |
| **Output total** | **~1790** |

**MAX_TOKENS recommendation: 1800.**

This requires a 300-token bump from the current 1500 envelope used
by Families A/B/C. The bump is necessary because 19 keys × 90 tokens
exceeds the 1500 envelope. **This intersects HALT trigger #15
(MAX_TOKENS bump proposed without operator approval at Stage 2B).**

Designer note: the Stage 2B operator-decision context is **exactly**
the MAX_TOKENS bump decision (along with Subset-vs-Full-27).
Operator approval at Stage 2B for the Subset path implicitly
approves the MAX_TOKENS=1800 bump. The designer surfaces this
explicitly here for operator visibility.

**Alternative if operator prefers no bump:** drop 2-3 of the lowest-
priority `inspect`-surface keys (`evidence_claim_present` priority
154; `evidence_quality_questioned` priority 159;
`burden_request_present` priority 160 — though this last is
doctrine-load-bearing and should NOT be dropped). With 17 keys at
90 tokens each = 1530 + 80 overhead = 1610 (still over 1500).
With 16 keys = 1520 (over). With 15 keys = 1430 + 80 = 1510 (over
by 10). With 14 keys = 1340 + 80 = 1420 (under 1500). Realistically
"no bump" requires dropping to 14 keys, which loses 5 of the 19
intended Subset keys — designer rejects this as exceeding scope
narrowing.

**Designer's binding recommendation:** Subset path with
**MAX_TOKENS=1800** (300-token bump from Family A/B/C baseline of
1500). This requires explicit Stage 2B operator approval.

### Path A latency projection (Subset; 19 keys)

Family C: 17 keys × 3 args = 20.46s end-to-end (Edge → MCP →
Anthropic → ban-list scan → persistence). Scaling:
- 19 keys × 3 args (+11.7% key count)
- Anthropic latency scales ~linearly with output tokens; estimate
  **+12-15%** end-to-end.

**Latency projection (Subset path): ~22.5-25s for 3 args.**

Edge timeout: 60s soft limit (Supabase default). Headroom: ~60s /
25s = 2.4× safety margin. Comfortable.

### Path B — Full-27 (all 27 entries)

| Component | Estimate |
| --- | --- |
| Per-key output tokens | ~90 |
| 27 entries total | 27 × 90 = **2430** |
| Compound-key prefix overhead | +5 tokens/key × 4 collision keys = +20 |
| JSON structure overhead | ~100 |
| **Output total** | **~2550** |

**MAX_TOKENS recommendation: 2800.**

A 1300-token bump from the 1500 envelope. **This intersects HALT
trigger #15 (MAX_TOKENS bump proposed without operator approval at
Stage 2B).** Larger bump than Subset path.

### Path B latency projection (Full-27)

19 keys → ~25s. 27 keys → 27/19 × 25s = **~35s for 3 args.**
Headroom: 60s / 35s = 1.7× safety margin. Tighter — approaches
Edge timeout threshold under load (e.g., cold-start Edge function
adding +2-3s on top).

### Input-token budget (both paths)

- System prompt: ~360 tokens (slightly longer than Family C; adds
  anti-amplification anchor)
- User-prompt scaffolding: ~650 tokens (Subset path) or ~720
  (Full-27 path with compound-key explanation)
- Definitions block: ~110 tokens/key × 19 = ~2090 (Subset) or
  × 27 = ~2970 (Full-27)
- Move/parent/thread text: up to ~6000 tokens worst case (existing
  cap per Family A/B/C MAX_BODY_FIELD_LEN=8000 chars)

Worst-case Subset input: ~9100 tokens. Worst-case Full-27 input:
~10050 tokens. Both well under Claude's 200K context budget.

### Token budget summary

| Path | Keys | MAX_TOKENS | Output budget | Input worst-case | Latency (3 args) | HALT #15 risk |
| --- | --- | --- | --- | --- | --- | --- |
| Subset | 19 | **1800** | ~1790 / 1800 (~99%) | ~9100 | ~22.5-25s | YES — requires Stage 2B approval |
| Full-27 | 27 | **2800** | ~2550 / 2800 (~91%) | ~10050 | ~30-35s | YES — requires Stage 2B approval (larger bump) |

Designer's binding judgment: **the MAX_TOKENS bump is unavoidable
for both paths.** Family D is the first family whose minimum-viable
key count (19 in Subset; 27 in Full-27) exceeds the headroom of the
existing 1500 envelope.

---

## 3. Compound-key collision design (Phase A.3 — both paths)

### Path A — Subset (filter approach)

The 4 collision entries (auto_metadata + lifecycle for
`source_requested` and `quote_requested`) are NOT in the
ai_classifier-only subset. The Subset's 19 keys are:

```
asks_for_evidence, provides_evidence, evidence_supports_claim,
creates_source_chain_gap, opens_evidence_debt_marker,
closes_evidence_debt_marker, supplies_corroborating_document,
source_provided, quote_provided, concrete_example_requested,
concrete_example_provided, evidence_claim_present,
evidence_gap_present, source_chain_repair, anecdote_used,
statistic_used, external_authority_used,
evidence_quality_questioned, burden_request_present
```

**Schema mirror response shape:** **unchanged.**
`observations: Record<rawKey, boolean>` flat-keyed exactly as
Family A / B / C. All 19 rawKeys are unique strings — no compound
prefix needed.

**Edge Function adapter response handling:** **unchanged.** The
Edge adapter receives the same flat-keyed `observations` map it
already handles for Family A/B/C.

**Edge Family Registry:** Family D entry stays
`productionEnabled: false, adminValidationEnabled: true` at line
84-88. The Edge familyRegistry entry is family-level, not
key-level; it doesn't care about source-type breakdown.

**Compatibility implications (Subset):**
- Backward-compatible with Family A/B/C response shape.
- No schema mirror version bump.
- HALT trigger #6 (schema mirror change without operator approval)
  NOT fired.
- HALT trigger #16 (compound-key response shape) NOT fired.
- Future Edge adapter card can compute the 8 deterministic keys
  separately (auto_metadata from `arguments.metadata.*` columns;
  lifecycle from cluster state) and merge them into the response
  envelope at the Edge layer, without ever asking the MCP server
  to classify them.

### Path B — Full-27 (compound-keyed response)

The response shape must distinguish `auto_metadata:source_requested`
from `lifecycle:source_requested`. Two strategies considered:

**Strategy B1 — Compound-key prefix (recommended for Path B if
chosen):**
```ts
observations: Record<string, boolean> = {
  'auto_metadata:source_requested': true,
  'lifecycle:source_requested': false,
  'auto_metadata:quote_requested': false,
  'lifecycle:quote_requested': false,
  // ... 23 other unique keys without prefix
  'asks_for_evidence': false,
  // ...
}
```

OR alternatively prefix ALL 27 entries (consistent shape):
```ts
observations: {
  'auto_metadata:has_evidence': true,
  'auto_metadata:source_requested': true,
  'lifecycle:source_requested': false,
  // ... all 27 with source prefix
}
```

The latter is cleaner (uniform shape; no special-case for
collisions). Designer's binding choice if Full-27 is approved:
**prefix all 27 keys with `<source>:` discriminator.**

**Strategy B2 — Nested `observations.bySource[source][rawKey]`:**
```ts
observations: {
  bySource: {
    auto_metadata: { has_evidence: true, source_requested: true, ... },
    lifecycle: { sourced: true, source_requested: false, ... },
    ai_classifier: { asks_for_evidence: true, ... }
  }
}
```

Cleaner separation but requires Family A/B/C to ALSO migrate to a
`bySource` envelope OR requires Family D to have a unique shape vs
the other families. Designer rejects B2 because it forces either:
- breaking Family A/B/C response shape (HALT trigger #4 — Family
  A/B/C byte-equal), or
- making Family D's response shape unique vs A/B/C (HALT trigger
  #6 — schema mirror response shape change).

**Compatibility implications (Full-27):**
- Schema mirror response shape changes for Family D ONLY (B1
  strategy with all-27-prefix), OR for all families (B2 strategy).
- HALT trigger #6 (schema mirror change) fires unless Stage 2B
  operator-approved.
- HALT trigger #16 (compound-key response shape) fires unless
  Stage 2B operator-approved.
- Edge Function adapter at
  `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts`
  needs compound-key parsing logic.
- Edge persistence layer
  (`argument_machine_observation_results` rows) — `raw_key` column
  needs either compound-key strings or a new `source` column.
  Designer judges this as out-of-scope for this card; would require
  a separate migration card.

### Compound-key design summary

| Aspect | Subset path | Full-27 path |
| --- | --- | --- |
| Schema mirror response shape | unchanged | **changes** (compound-key strings) |
| Edge adapter response shape | unchanged | **changes** (compound-key parsing) |
| Edge persistence schema | unchanged | **migration required** (raw_key compound OR new source column) |
| Family A/B/C byte-equal | preserved | preserved (their shape stays flat-keyed) |
| HALT #6 (schema mirror) | NOT fired | **FIRES** without operator approval |
| HALT #16 (compound-key) | NOT fired | **FIRES** without operator approval |
| Implementation complexity | low (Family C template) | high (new shape + Edge changes + migration) |

---

## 4. Doctrine load-bearing keys (Phase A.4 — verbatim guard text)

Three Family D keys carry specific doctrine framing risk per
intent brief §4. Each gets verbatim per-key guard text in the
prompt entry's `falsePositiveGuards` field plus a dedicated test
in `familyDDoctrineFixtures.test.ts`.

### 4.1 `anecdote_used` (anti-bias copy required)

**Source guard (familyD.ts:784-787):**
> "Doctrine note: anecdote is legitimate evidence in some
> contexts; copy must NOT imply weakness."
>
> "Do NOT confuse with example_reasoning_present (Family E scheme)."

**Designer-bound additional prompt framing:**
> "anecdote_used describes a structural feature of the move (the
> author cites a personal or single-case story as support). It is
> NOT a verdict on the move's value. Anecdote is legitimate
> evidence in some contexts — particularly for existence claims,
> mechanism examples, and lived-experience domains. Do NOT mark
> TRUE in a way that implies weakness or low quality. The
> evidenceSpan must contain only the quoted anecdote text, never
> a judgment about its value."

**Ban-list test assertion (familyDDoctrineFixtures.test.ts):**
- positive evidenceSpan for `anecdote_used` must NOT contain
  `weak`, `bad`, `inferior`, `lesser`, `unreliable`, `merely`

### 4.2 `burden_request_present` (descriptive, not verdict)

**Source guard (familyD.ts:905-906):**
> "Do NOT mark TRUE for moves that ask for evidence without
> framing as burden."

**Source doctrine notes (familyD.ts:908-911):**
> "cdiscourse-doctrine §10a: burden-of-proof framing is structural
> meta-evidence move."
>
> "evidence-doctrine: burden-of-proof framing is debated
> philosophical territory; CDiscourse treats it descriptively, not
> as a verdict on which side is 'right'."

**Designer-bound additional prompt framing:**
> "burden_request_present indicates a structural request for the
> other party to produce evidence. It does NOT determine which
> side actually bears the burden of proof in this discussion —
> that is a debated philosophical question CDiscourse does not
> adjudicate. The evidenceSpan must contain only the quoted
> burden-of-proof framing text, never a judgment about whether
> the parent is right or wrong to invoke it."

**Ban-list test assertion (familyDDoctrineFixtures.test.ts):**
- positive evidenceSpan for `burden_request_present` must NOT
  contain `right`, `wrong`, `correct`, `incorrect`, `justified`,
  `unjustified`

### 4.3 `evidence_gap_present` (anti-amplification)

**Source guard (familyD.ts:720-724):**
> "Do NOT mark TRUE for value / normative claims."
>
> "Do NOT mark TRUE for explicitly hedged claims."
>
> "Do NOT mark TRUE for claims with attached evidence even if the
> quality is contested (that is evidence_quality_questioned)."

**Source doctrine notes (familyD.ts:726-729):**
> "evidence-doctrine: evidence gap is a structural observation;
> the responder may ask for source, quote, or open evidence debt.
> Advisory, never blocking."
>
> "cdiscourse-doctrine §3: popularity / repetition / engagement is
> NOT evidence; this rawKey enforces the boundary."
>
> "point-standing-economy: an evidence gap does not automatically
> lower standing; standing changes when challenged and the gap
> persists."

**Designer-bound additional prompt framing:**
> "evidence_gap_present indicates a structural state of the move
> (a factual / empirical / statistical claim made without
> attached evidence). It does NOT imply the move is dishonest,
> low-quality, or manipulative. Popularity / repetition /
> engagement are NOT evidence (cdiscourse-doctrine §3): a
> commonly-asserted claim with no source is an evidence gap
> regardless of how often it has been said elsewhere. The
> responder may ask for source or quote; the gap itself is
> advisory, never blocking."

**Ban-list test assertion (familyDDoctrineFixtures.test.ts):**
- positive evidenceSpan for `evidence_gap_present` must NOT
  contain `dishonest`, `low_quality`, `weak`, `manipulative`,
  `false`, `lying`

### 4.4 Family-D-specific ban-list extensions

Per intent brief §4 ("Designer Phase A.4 verifies these 3 keys +
adds Family D-specific ban-list extensions to the shared
DOCTRINE_BAN_PATTERNS"):

**Designer's binding judgment: NO Family-D-specific ban-list
extensions to the shared `DOCTRINE_BAN_PATTERNS` in this card.**

Rationale:
- The shared `DOCTRINE_BAN_PATTERNS` already covers the core
  verdict tokens (`winner`, `loser`, `correct`, `incorrect`,
  `truth`, `liar`, `bad faith`, `extremist`, `propagandist`,
  `manipulative`).
- Family-D-specific risks (anecdote-as-weak, burden-as-verdict,
  evidence-gap-as-failure) are captured by the 3 per-key
  doctrine-risk assertions in `familyDDoctrineFixtures.test.ts`
  (§4.1-4.3 above), not by global ban patterns.
- Adding `weak` / `dishonest` / `manipulative` to the global
  ban list would risk false positives in OTHER families
  (e.g., Family B's `disputes_credibility` might legitimately
  contain `manipulative` in an evidenceSpan describing the
  parent's framing). Doctrine ban-list extensions must NOT
  break other families' valid outputs.

If real-corpus testing reveals Family D model outputs
contain anti-doctrine framing not caught by per-key tests, a
follow-on OPS observability card can add Family-D-specific
patterns scoped to the Family D ban-list scan only (not the
shared pattern set).

### Cross-key doctrine constraint

All 19 evidence-source-chain outputs (Subset path) remain
descriptive structural facts (per cdiscourse-doctrine §10a). Per-rawKey
prompt-entry text MUST NOT contain the words `winner`, `loser`,
`correct`, `wrong`, `truth`, `liar`, `fallacy`, `bad faith`,
`extremist`, `propagandist`, `manipulative`, `dishonest` except
when negating them (mirroring the system-prompt negation pattern
and Family A/B/C precedent).

The 19 source entries in `familyD.ts` already conform — the
`doctrineNotes` arrays each anchor on cdiscourse-doctrine §10a,
evidence-doctrine, or point-standing-economy, and use descriptive
language like "structural," "evidence presence," "recovery-positive,"
"opens factual-standing eligibility" — never a verdict on the move's
author.

---

## 5. Subset vs Full-27 comparison (Phase A.5 — full trade-off table)

| Dimension | Path A — Subset (19 keys) | Path B — Full-27 (27 keys) |
| --- | --- | --- |
| **Keys routed through MCP** | 19 (ai_classifier-only) | 27 (all sources) |
| **Compound-key collision** | avoided by exclusion | requires compound-key response shape |
| **Schema mirror change** | none | **required** (compound-key strings or new envelope) |
| **MAX_TOKENS bump** | 1500 → 1800 (+300; ~20%) | 1500 → 2800 (+1300; ~87%) |
| **Latency for 3 args** | ~22.5-25s (1.2× Family C) | ~30-35s (1.5× Family C) |
| **Edge timeout headroom** | 2.4× safety margin (60/25) | 1.7× safety margin (60/35) |
| **Edge adapter compound parsing** | none | **required** |
| **Edge persistence migration** | none | **required** (raw_key compound OR new source column) |
| **Family A/B/C byte-equal** | preserved | preserved (their shape stays flat-keyed) |
| **HALT #6 (schema mirror)** | NOT fired | **fires** without Stage 2B approval |
| **HALT #15 (MAX_TOKENS bump)** | fires (smaller bump; +300) | fires (larger bump; +1300) |
| **HALT #16 (compound-key shape)** | NOT fired | **fires** without Stage 2B approval |
| **Implementation complexity** | LOW — Family C template + 19 prompt entries | HIGH — new shape + Edge changes + migration |
| **Test forecast** | +80 to +120 | +150 to +250 |
| **8 deterministic keys treatment** | deferred to future Edge adapter card | included in MCP routing (despite being deterministic) |
| **Architectural precedent for E/F/G/H/I/J** | "filter ai_classifier subset" — clean pattern | "every family gets unique shape negotiation" — inconsistent |
| **Future Edge adapter card scope** | clean — adds 8 deterministic computations | conflicts with MCP routing |
| **Risk: classifier value of routing deterministic keys** | none (deterministic keys excluded) | low (classifier may produce inconsistent answers for deterministic facts) |
| **Risk: latency under load** | acceptable (~25s with 2.4× headroom) | borderline (~35s with 1.7× headroom; cold-start adds margin pressure) |
| **Risk: schema migration cost** | none | medium-high (compound keys touch every Family D consumer) |

---

## 6. Designer recommendation (binding pending Stage 2B operator-decision)

### Recommendation: **Path A — Subset (19 ai_classifier keys).**

**Rationale (binding):**

1. **Auto_metadata + lifecycle keys are deterministic.** The 5
   auto_metadata keys (`has_evidence`, `source_requested`,
   `quote_requested`, `source_attached`, `quote_attached`) are
   computable from `arguments.metadata` columns and attached
   artifacts. The 3 lifecycle keys (`sourced`,
   `quote_requested`, `source_requested`) are computable from
   cluster state. **The classifier cannot add value beyond what
   the deterministic state already encodes.** Routing them
   through Anthropic introduces variance for keys whose ground
   truth is structural.

2. **Schema mirror byte-equal preservation.** The Subset path
   keeps Family D response shape identical to Family A / B / C:
   `observations: Record<rawKey, boolean>`. No compound-key
   schema change. No Edge adapter parsing change. No persistence
   migration. HALT #6 and #16 NOT fired.

3. **Smaller MAX_TOKENS bump (+300 vs +1300).** Both paths require
   Stage 2B approval for the MAX_TOKENS bump (HALT #15), but the
   Subset path's +300 is more conservative than the Full-27
   path's +1300. Smaller bumps are easier to roll back if real-
   corpus latency exceeds projection.

4. **Latency headroom.** Subset path 2.4× safety margin (60s /
   25s) vs Full-27 path 1.7× (60s / 35s). The Edge timeout is
   60s; Edge cold-start can add 2-3s; under load the Full-27
   path's margin gets uncomfortable.

5. **Architectural precedent.** Family E, F, G, H, I, J likely
   have similar source-mix complexity (mixed auto_metadata /
   lifecycle / ai_classifier entries). The "filter ai_classifier
   subset" pattern is the clean, reusable template. The Full-27
   alternative ("every family negotiates its own response shape
   for compound keys") fragments the schema across families.

6. **Risk-adjusted value.** The 8 deterministic keys can be added
   later by an Edge adapter card without disturbing the MCP
   server. The Full-27 path bakes them into the MCP server now,
   making future deterministic-computation refactors harder.

7. **Test forecast in band.** Subset path forecast +80 to +120
   sits comfortably under the +300 HALT threshold (intent brief
   §6 trigger #24). Full-27 path forecast +150 to +250 also fits
   but consumes more headroom.

### Alternative considered + rejected

**Alternative: Full-27 path with compound-keyed response shape.**

Considered. Rejected because:
- Requires schema mirror response shape change (HALT #6) for a
  family-specific concern that doesn't affect the wire shape's
  primary correctness.
- Requires Edge adapter compound-key parsing logic — a
  Family-D-only special case that fragments the adapter.
- Requires Edge persistence migration to either store compound
  keys or add a `source` column to
  `argument_machine_observation_results` — a card-scope expansion
  with downstream implications for Source 6 rendering and
  observability queries.
- Larger MAX_TOKENS bump (+1300 vs +300) reduces the
  safety margin and complicates future-family budget planning.
- Latency margin (1.7×) is uncomfortably tight under cold-start
  conditions.

The Full-27 path would be appropriate if (a) the 8 deterministic
keys had classifier value the deterministic state couldn't
encode, OR (b) the operator chose to defer the auto_metadata +
lifecycle keys entirely (never compute them). Neither is the
current state; the Subset path preserves the option to add the 8
deterministic keys later via a clean Edge adapter card.

### Test forecast per chosen path

**Subset path forecast: +95 to +120 tests (midpoint ~107).**

Per-file forecast (mirroring Family C's structure):

| File | NEW / UPDATED | Test count (est) |
| --- | --- | --- |
| `mcp-server/tests/familyDKeys.test.ts` | NEW | 7-8 |
| `mcp-server/tests/familyDKeysParity.test.ts` | NEW | 3-4 (incl. ai_classifier-only assertion) |
| `mcp-server/tests/familyDPrompt.test.ts` | NEW | 19-21 (incl. 3 doctrine-risk verbatim assertions) |
| `mcp-server/tests/familyDAnthropic.test.ts` | NEW | 10 |
| `mcp-server/tests/familyDBanListScan.test.ts` | NEW | 15-16 |
| `mcp-server/tests/familyDFixtureParity.test.ts` | NEW | 13-14 |
| `mcp-server/tests/familyDResponseValidator.test.ts` | NEW | 16-18 |
| `mcp-server/tests/familyDDispatch.test.ts` | NEW | 11-12 (incl. 4-way cross-family rejection) |
| `mcp-server/tests/familyDDoctrineFixtures.test.ts` | NEW | 8-10 |
| `mcp-server/tests/familyRegistryInit.test.ts` | UPDATED | +3 |
| `mcp-server/tests/familyRegistry.test.ts` | UPDATED | +3 |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | UPDATED | +6-8 |
| Jest: small Edge Family Registry Family D test | NEW | 1-2 |

**Subtotal:** 8 + 4 + 21 + 10 + 16 + 14 + 18 + 12 + 10 + 3 + 3 + 8 + 2 = **129 new tests** (upper-band estimate).

Range: **+95 to +120** (with midpoint ~107 after natural test-count
variance). Intent brief §8 forecasts +80 to +120 for the Subset
path; designer's forecast lands at the upper band due to the
4-way cross-family rejection tests (added directional
combinations vs Family C's 3-way). HALT threshold (+300) clear.

### Code surface estimate

| File | Size (est) | Surface type |
| --- | --- | --- |
| `mcp-server/lib/familyDKeys.ts` | ~480 lines (19 entries × ~25 lines) | NEW; mirrors `familyCKeys.ts` (375 lines for 17 entries) |
| `mcp-server/lib/familyDPrompt.ts` | ~280 lines | NEW; mirrors `familyCPrompt.ts` (242 lines) |
| `mcp-server/lib/familyDAnthropic.ts` | ~50 lines | NEW; mirrors `familyCAnthropic.ts` (49 lines) |
| `mcp-server/lib/familyDBanListScan.ts` | ~70 lines | NEW; mirrors `familyCBanListScan.ts` (66 lines) |
| `mcp-server/lib/familyDFixtureProvider.ts` | ~55 lines | NEW; mirrors `familyCFixtureProvider.ts` (54 lines) |
| `mcp-server/lib/familyRegistryInit.ts` | +6 lines | UPDATED; one register() call + 2-line import |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | +15 lines | UPDATED; new provider table entry, updated tool description |
| `scripts/mcp-server-001-smoke.sh` | +50 lines | UPDATED; 2 new checks (Check 14, Check 15) |
| `mcp-server/fixtures/family-d-*.json` | ~8 files | NEW; mirror Family C fixtures |
| `mcp-server/tests/familyD*.test.ts` | ~9 files / ~2200 lines | NEW; mirror Family C tests |
| Test updates | ~4 files / ~150 lines | UPDATED |
| `docs/core/current-status.md` | +1 paragraph | UPDATED |

**Total new code surface: ~3200 lines.** Test code is ~2/3 of
total; production code (key constants, prompt, adapter,
ban-list scan, fixture provider, registry init, dispatcher) is
~900 lines.

### MAX_TOKENS per path

| Path | MAX_TOKENS | Bump from 1500 |
| --- | --- | --- |
| Subset (19 keys) | **1800** | +300 (+20%) |
| Full-27 (27 keys) | 2800 | +1300 (+87%) |

**Subset path requires Stage 2B operator approval for the
+300-token MAX_TOKENS bump (HALT trigger #15).** This is the
narrow approval ask if the operator chooses Subset.

### Latency projection per path

| Path | 3-arg latency | Headroom vs 60s Edge timeout |
| --- | --- | --- |
| Subset (19 keys) | **~22.5-25s** | 2.4× safety margin |
| Full-27 (27 keys) | ~30-35s | 1.7× safety margin |

---

## 7. Implementation file list per chosen path (Subset)

### New files (server-side)

| Path | Purpose | Size estimate |
| --- | --- | --- |
| `mcp-server/lib/familyDKeys.ts` | 19 rawKey constant + 19 prompt entries + `FAMILY_D_CLASSIFIER_SET_VERSION = 'family-d-v1'` | ~480 lines |
| `mcp-server/lib/familyDPrompt.ts` | system prompt + user prompt builder + MAX_TOKENS=1800 + TEMPERATURE=0 + MAX_BODY_FIELD_LEN=8000 | ~280 lines |
| `mcp-server/lib/familyDAnthropic.ts` | Family D Anthropic orchestrator | ~50 lines |
| `mcp-server/lib/familyDBanListScan.ts` | Family D ban-list scan | ~70 lines |
| `mcp-server/lib/familyDFixtureProvider.ts` | Family D fixture provider | ~55 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-canonical-response.json` | Canonical 19-key Family D response (multi-positive) | ~85 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-malformed-response.json` | Invalid response shape | ~30 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-ban-list-response.json` | Response with banned token in evidenceSpan for `anecdote_used` (or `evidence_gap_present`) | ~85 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-canonical-request.json` | Canonical request (move provides source URL + quote) | ~25 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-source-provided-request.json` | Move providing a primary source citation; expected positives `source_provided` + `provides_evidence` | ~25 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-evidence-gap-request.json` | Move making statistical claim with no source; expected positive `evidence_gap_present` + `creates_source_chain_gap` | ~25 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-anecdote-used-request.json` | Move citing single-case story; expected positive `anecdote_used` (doctrine-test fixture for "not weakness" framing) | ~25 lines |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-d-no-evidence-request.json` | Adversarial fixture: Family-C-style repair move (offers candidate understanding); Family D classifier MUST return all 19 keys false | ~25 lines |

### Updated files (server-side)

| Path | Edit |
| --- | --- |
| `mcp-server/lib/familyRegistryInit.ts` | +6 lines: import `FAMILY_D_RAW_KEYS` + `FAMILY_D_CLASSIFIER_SET_VERSION`; call `register('evidence_source_chain', { rawKeys, classifierSetVersion })` after Family C registration |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | +15 lines: import `runAnthropicFamilyDClassifier` + `loadFixtureFamilyDPacket` + `scanFamilyDBooleanResponseForBanList` + `ValidatedFamilyDRequest`; add `evidence_source_chain` branch to `pickFamilyProviders`; update tool `description` |
| `scripts/mcp-server-001-smoke.sh` | +50 lines: Check 14 (`[14-compat-boolean-family-d]`) + Check 15 (`[15-mcp-tools-call-boolean-family-d]`) |

### New test files (Deno; under `mcp-server/tests/`)

| Path | Coverage |
| --- | --- |
| `familyDKeys.test.ts` | `FAMILY_D_RAW_KEYS` has 19 entries; binding ai_classifier-only list match; no extras; no dupes; `FAMILY_D_PROMPT_ENTRIES` has 19; every entry has required fields; `FAMILY_D_CLASSIFIER_SET_VERSION === 'family-d-v1'` |
| `familyDKeysParity.test.ts` | Server-side rawKey literals all appear in upstream `familyD.ts`; upstream file has 27 rawKey declarations; server-side constant has exactly 19 ai_classifier-source rawKeys (excludes 5 auto_metadata + 3 lifecycle); cross-family ∅ checks (A∩D, B∩D, C∩D); compound-key collision documentation assertion (the 4 collision entries are NOT in the server constant) |
| `familyDPrompt.test.ts` | System prompt contains 7 absolute-rules verbatim (byte-equal to Family A/B/C); system prompt contains evidence-doctrine + anti-amplification anchor; user prompt builder happy path; user prompt builder with subset of keys; user prompt builder with empty requestedRawKeys (returns all 19); rawKeys filter rejects non-Family-D keys; banned-token negation check on system prompt; `FAMILY_D_MAX_TOKENS === 1800`; `FAMILY_D_TEMPERATURE === 0`; user prompt asserts all 19 rawKeys present in questions block; `anecdote_used` prompt entry surfaces doctrine guard verbatim; `burden_request_present` prompt entry surfaces doctrine guard verbatim; `evidence_gap_present` prompt entry surfaces doctrine guard verbatim; no anecdote-as-weak framing scan; no burden-as-verdict framing scan; no evidence-gap-as-failure framing scan; no popularity-as-evidence framing scan |
| `familyDAnthropic.test.ts` | Happy path, key_missing, HTTP 429, HTTP 500, TimeoutError, non-JSON response, plain prose, API key never appears in success log line, API key never appears in failure log line, logs tagged with `classify_argument_boolean_observations` |
| `familyDBanListScan.test.ts` | Clean response ok=true; evidenceSpan with each banned token; modelInfo.serverName / classifierSetVersion banned-token detection; null evidenceSpan values skipped; "proof of" two-word phrase detected; neutral compound words not flagged |
| `familyDFixtureParity.test.ts` | Canonical-response fixture passes validator + ban-list; all fixture responses use rawKeys in `FAMILY_D_RAW_KEYS`; malformed fixture fails validator at expected path; ban-list fixture fails ban-list scan at expected path; all 5 per-scenario request fixtures pass `validateFamilyBooleanRequest` |
| `familyDResponseValidator.test.ts` | Happy path 19-key Family D response; rejects wrong schemaVersion; rejects missing required fields; rejects wrong shape for observations / confidence / evidenceSpan; rejects flag_count_too_high (>20 — Family D max is 19 well under cap); rejects modelInfo without provider="mcp"; rejects unknown rawKey in checkedRawKeys; accepts evidenceSpan strings up to 240 chars; rejects > 240 chars; accepts confidence in {low, medium, high}; rejects values outside |
| `familyDDispatch.test.ts` | Mock-fetch dispatcher tests: Family D request routes to Family D Anthropic; Family A still routes to Family A; Family B to Family B; Family C to Family C; Family D ban-list scan invoked (not A/B/C); 4-way cross-family rejection (each family's keys rejected under other 3 families); dispatcher returns unsupported_family for unregistered family; resolved-family log tag present; fixture provider routing for Family D |
| `familyDDoctrineFixtures.test.ts` | `anecdote_used` no-weakness fixture: positive evidenceSpan must NOT contain `weak`, `bad`, `inferior`, `lesser`, `unreliable`, `merely`; `burden_request_present` no-verdict fixture: positive evidenceSpan must NOT contain `right`, `wrong`, `correct`, `incorrect`, `justified`, `unjustified`; `evidence_gap_present` no-failure fixture: positive evidenceSpan must NOT contain `dishonest`, `low_quality`, `weak`, `manipulative`, `false`, `lying`; no-evidence adversarial fixture: all 19 keys false (proves classifier discrimination from Family C content); source-provided fixture: `source_provided` + `provides_evidence` both positive; anti-amplification fixture: model output does NOT contain `popular`, `widely_believed`, `everyone_knows`, `viral` in any evidenceSpan |

### Updated test files (Deno)

| Path | Edit |
| --- | --- |
| `mcp-server/tests/familyRegistryInit.test.ts` | +3 tests: `familyRegistryInit-registers-family-d-on-import`; `familyRegistryInit-registers-all-four-families-in-order` (`getSupportedFamilies()` returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain']` exact); `familyRegistryInit-family-d-has-19-rawKeys` |
| `mcp-server/tests/familyRegistry.test.ts` | +3 tests: `registry-getSupportedFamilies-preserves-four-family-order`; `registry-isRawKeySupportedForFamily-four-way-cross-family-rejection` (each family's keys under each other family); `registry-getRawKeysForFamily-evidence_source_chain-19-keys` |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | +6-8 tests: valid Family D request passes; Family D request with rawKey subset passes; Family D request with empty requestedRawKeys passes; cross-family rejection (Family A rawKey under evidence_source_chain); cross-family rejection (Family B rawKey under evidence_source_chain); cross-family rejection (Family C rawKey under evidence_source_chain); cross-family rejection (Family D rawKey under parent_relation / disagreement_axis / misunderstanding_repair); regression: valid Family A/B/C requests still pass |

### New Jest test (under `__tests__/`)

| Path | Coverage |
| --- | --- |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyD.test.ts` (or 1 small test added to existing `mcpOneTwoOneCEdgeFamilyRegistry.test.ts`) | Assert `EDGE_FAMILY_REGISTRY` Family D entry has `productionEnabled: false` AND `adminValidationEnabled: true`; assert `edgeAdminValidationEnabledFamilies()` returns Family D in its position; assert `edgeProductionEnabledFamilies()` does NOT include Family D |

---

## 8. Test plan per chosen path (Subset)

### Test forecast: +95 to +120 new tests (midpoint ~107)

See §6 for per-file breakdown. Below is the testing structure
binding (mirrors Family C `__tests__` discipline):

### Doctrine ban-list assertion coverage

`familyDPrompt.test.ts` asserts the system prompt's literal text
contains the 7 absolute-rules negation pattern AND NO bare banned
tokens. Mirrors Family A/B/C precedent.

`familyDBanListScan.test.ts` asserts the runtime scan rejects every
banned-token shape in evidenceSpans, modelInfo.serverName, and
modelInfo.classifierSetVersion.

`familyDDoctrineFixtures.test.ts` asserts the 3 doctrine-risk
fixtures behave as designed:
- no weakness framing on `anecdote_used`
- no verdict framing on `burden_request_present`
- no failure framing on `evidence_gap_present`

### Anti-amplification doctrine assertion

A dedicated test in `familyDDoctrineFixtures.test.ts` asserts the
model output never frames popularity / repetition / engagement as
evidence. Specifically, the prompt's anti-amplification anchor
instructs the model to NOT mark `evidence_gap_present` FALSE
just because the claim is widely repeated; the test fixture
provides "many people say X" and asserts `evidence_gap_present`
is TRUE (popularity is not evidence).

### Verification gates (per intent brief §8)

```
npm run typecheck
npm run lint
cd mcp-server && deno test --allow-net --allow-env --allow-read
cd ..
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|uxOneOneFiveA|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage
npm test
```

All exit 0. The Jest sweep is a regression check that the
existing MCP-021B persistence + MCP-021C runtime spine + UX-001.5A
node-label primitive layer all continue to pass against the
post-Family-D tree. None of those test surfaces are directly
touched by Family D but they share the upstream taxonomy and the
Edge familyRegistry — the existing
`__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` already
enforces the Family D entry's `productionEnabled: false` posture
(FR-7 asserts every NON-A/B/C family is `productionEnabled:
false`).

### Local Deno expected output

Post-Family-D: **~547-587 / 0** (467 baseline from Family C smoke
+ ~80-120 new Family D tests). Family A, B, C all still pass.

---

## 9. Smoke plan (Phase A.6 — 8-phase)

Per intent brief §9, the smoke is operator-run after the PR merges
to `main` and Deno Deploy auto-deploys the post-merge build. Audit
file: `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-<date>.md`.

### Phase 1 — Pre-flight

* HEAD at merge SHA.
* Hosted MCP server `/health` shows post-merge build
  (`https://cdiscourse-mcp-server.civildiscourse.deno.net/health`).
* Both Edge Functions ACTIVE (`semantic-referee`,
  `classify-argument-boolean-observations`).
* DB `config` provider_mode=mcp, enabled=true.
* Working tree contains only the 10 known operator-territory
  untracked files (`docs/testing-runs/2026-05-25-*`,
  `mcp021c-edge-smoke-*`, `netlify-prod.git`,
  `phase5-mcpserver002-*`).

### Phase 2 — Local Deno regression

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

Expected: **~547-587 / 0** (467 baseline post-Family-C + ~80-120
new Family D tests). Family A, B, C all still pass.

### Phase 3 — Hosted MCP server smoke (15 checks; OPERATOR-RUN)

```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected output:

```
PASS [1-health]
PASS [2-compat-no-auth]
PASS [3-compat-bad-token]
PASS [4-compat-semantic-move]
PASS [5-compat-boolean-family-a]
PASS [6-mcp-initialize]
PASS [7-mcp-tools-list]
PASS [8-mcp-tools-call-semantic]
PASS [9-mcp-tools-call-boolean-family-a]
PASS [10-compat-boolean-family-b]
PASS [11-mcp-tools-call-boolean-family-b]
PASS [12-compat-boolean-family-c]
PASS [13-mcp-tools-call-boolean-family-c]
PASS [14-compat-boolean-family-d]
PASS [15-mcp-tools-call-boolean-family-d]

MCP-SERVER-001 smoke: 15 PASSES, 0 FAILS
EXIT: 0
```

The 2 new Family D checks specifically verify:

* Check 14: hosted server returns a Family D response whose
  `modelInfo.classifierSetVersion === 'family-d-v1'`.
* Check 15: `tools/call` against
  `classify_argument_boolean_observations` with a Family D
  request returns a structured response whose
  `modelInfo.classifierSetVersion === 'family-d-v1'`.

#### New check 14: `[14-compat-boolean-family-d]`

```bash
# ── Check 14: POST /mcp/adapter-compat with VALID bearer + boolean (Family D) ──
# MCP-SERVER-005-FAMILY-D promoted Family D from unsupported to real (ai_classifier subset).
# The request body uses Family D ai_classifier rawKeys (evidence_source_chain family).
# Response shape MUST be a real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (19 keys for Family D ai_classifier subset)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-d-v1'
CHECK_NAME="14-compat-boolean-family-d"
BOOLEAN_D_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-d-001","parentNodeId":"fixture-node-parent-d-001","currentText":"[fixture] Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions from 2020 to 2023.","parentText":"[fixture] EVs reduce emissions in cities.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["evidence_source_chain"],"requestedRawKeys":["source_provided","provides_evidence","statistic_used"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family D)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_D_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-d-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family D response shape. Got: $RESPONSE"
fi
```

#### New check 15: `[15-mcp-tools-call-boolean-family-d]`

```bash
# ── Check 15: POST /mcp tools/call classify_argument_boolean_observations (Family D) ──
# MCP-SERVER-005-FAMILY-D. Same body + same assertion pattern as Check 14, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="15-mcp-tools-call-boolean-family-d"
BOOLEAN_D_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-5","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-d-001","parentNodeId":"fixture-node-parent-d-001","currentText":"[fixture] Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions from 2020 to 2023.","parentText":"[fixture] EVs reduce emissions in cities.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["evidence_source_chain"],"requestedRawKeys":["source_provided","provides_evidence","statistic_used"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family D)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_D_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-d-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family D tool result. Got: $RESPONSE"
fi
```

OPERATOR HALT: Phase 3 requires operator action (token). After
operator pastes redacted PASS output, continue to Phase 4.

### Phase 4 — Edge `admin_validation` smoke (Family D)

Acquire admin JWT (env-backed, per prior smokes).

POST to Edge `classify-argument-boolean-observations`:

```json
{
  "argumentIds": [
    "f41b18b0-8ad6-4865-94c5-17a568f6a6ad",
    "781f8057-9e2a-4fa9-92a8-469676950ff7",
    "db0de3e0-24c6-40af-ba5f-2844acfa5bac"
  ],
  "requestedFamilies": ["evidence_source_chain"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

Expected:

* HTTP 200.
* `time_total` ~22.5-25s (per latency projection; Family C was
  20.46s at 17 keys; Family D at 19 keys scales linearly).
* 3 `perArgument` entries.
* All `status=success`.
* `positiveObservationCount >= 0` for each arg.
* `raw_keys ∈ Family D 19-key ai_classifier set` for any positive.
* No `mcp_validation_failed` envelope.
* No cross-family leakage (no Family A/B/C keys in
  rawKeysWithPositive).

**Decision 9 binding (per intent brief §9): 0 Family D positives
across all 3 seeded args is an acceptable PARTIAL outcome.** The
seeded args were designed for Family A; they may or may not
contain evidence-source signal. If positives are observed, they
must all be in the Family D 19-key ai_classifier set.

If 0 positives, the conservative-positives bias is doing its job —
the seeded args lack clean evidence-source structural signal. The
pipeline verification (HTTP 200 + valid response shape + correct
raw_keys universe) is the binding PASS gate. Pipeline:
Edge → MCP → Family D Anthropic → ban-list scan → persistence.

### Phase 5 — Unsupported E/F/G/H/I/J rejection regression

POST to `classify-argument-boolean-observations` with each of the
6 still-unsupported families against arg2:

| Family | Expected response |
| --- | --- |
| E — `argument_scheme` | HTTP 200; `status=failed`; `failureReason=mcp_validation_failed`; 0 positives; empty rawKeys |
| F — `critical_question` | same |
| G — `resolution_progress` | same |
| H — `claim_clarity` | same |
| I — `thread_topology` | same |
| J — `sensitive_composer` | same |

Each should reject at the MCP server's registry boundary.
No Family A, B, C, or D keys leaked.

### Phase 6 — Targeted regression suites

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|uxOneOneFiveA|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

Expected: all exit 0. Full Jest suite (per Card 1 baseline of
17,924) bumps by the Family D Jest test delta. mcp-server Deno
bumps from 467 → ~547-587.

### Phase 7 — OPS observations

* **4 families now operational on hosted MCP server:**
  - Family A (`parent_relation`): production + auto-trigger live.
  - Family B (`disagreement_axis`): production + auto-trigger live.
  - Family C (`misunderstanding_repair`): production + auto-trigger live.
  - Family D (`evidence_source_chain`): `admin_validation` only (NEW).

* **6 families still unsupported** (E, F, G, H, I, J). Registry
  rejection continues to enforce admin-validation-only semantics.

* **Latency observations:**
  - Phase 4 (Family D admin_validation, 3 args × 19 keys):
    expected ~22.5-25s.
  - Latency scales proportionally with key count + the +300
    MAX_TOKENS bump.
  - Phase 5 cold-start E + warm F-J should remain consistent with
    prior smokes.

* **`OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` priority:**
  RECOMMENDED. With 4 families operational (3 production + 1
  admin_validation), per-family telemetry now spans the full
  evidence-source-chain doctrine layer. Operator may opt to
  observe Family D real-corpus calibration before deciding on
  the `MCP-021C-EDGE-FAMILY-D-ENABLE` production-mode flip.

* **Doctrine-risk-key real-corpus calibration:** Phase 4 produces
  the first sample of `anecdote_used` / `burden_request_present` /
  `evidence_gap_present` positives in real arg text. Operator may
  spot-check the evidenceSpans for doctrine-risk framing
  (no weakness / no verdict / no failure).

* **Anti-amplification calibration:** Phase 4 produces the first
  sample of `evidence_gap_present` against real corpus. The
  conservative-positives bias should ensure value claims are NOT
  flagged as evidence gaps; statistical / causal claims without
  sources should be flagged.

* **Token budget observation:**
  - Family D is the first family with `MAX_TOKENS=1800`.
  - Phase 3 hosted MCP smoke should pass cleanly with no
    truncation reported in checks 14 + 15.
  - Phase 4 Edge `admin_validation` should produce full responses
    with valid `rawKeysWithPositive` arrays.
  - If truncation observed, designer's binding follow-up:
    investigate whether to split the 19-key call into 2 batches.

### Phase 8 — Verdict + authorization

* **PASS criteria** (all required):
  * Phase 1 pre-flight clean.
  * Phase 2 local Deno: ~547-587 / 0.
  * Phase 3 hosted MCP smoke: 15/15.
  * Phase 4 admin_validation: HTTP 200; valid Family D response
    shape; raw_keys ⊆ Family D 19-key ai_classifier set.
  * Phase 5 unsupported rejection: all 6 unsupported families
    (E-J) correctly rejected.
  * Phase 6 targeted regression: all exit 0.

* **PARTIAL:**
  * Phase 4 returns 0 positives across all 3 args (per Decision 9
    — acceptable; documented but doesn't fail smoke).
  * Phase 6 single-suite regression independent of Family D.

* **FAIL:**
  * Phase 3 < 15 checks pass.
  * Phase 4 returns non-Family-D raw_keys (taxonomy violation).
  * Phase 4 returns any of the 4 collision keys (`source_requested`
    or `quote_requested` either source) — those are NOT in the
    Subset scope.
  * Phase 5 any unsupported family accepted (security adjacent).
  * Phase 6 broad regression (Family A/B/C byte-equal failure).

* **Authorization after PASS:**
  * `MCP-SERVER-005-FAMILY-D-SMOKE: PASS`.
  * Family D `admin_validation` OPERATIONAL.
  * `MCP-021C-EDGE-FAMILY-D-ENABLE` AUTHORIZED to design
    (production-mode flip; Stage 2B for any compound-key
    deferred decision).
  * `MCP-SERVER-006-FAMILY-E` AUTHORIZED to begin (with Stage 2B
    for any structural-complexity Subset-vs-Full decisions
    Family E carries).
  * `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` (optional) for
    4-family state observability.

* **If PARTIAL:** File scoped fix card; do NOT begin Family E
  until smoke clean.

* **If FAIL:** File `MCP-SERVER-005-FAMILY-D-FIX`. Do NOT begin
  Family E until refactor stable. Consider revert if Family A/B/C
  regression detected.

---

## 10. Read-only boundary list (files this card DOES NOT touch)

Per intent brief §5 + designer audit:

* `mcp-server/lib/familyAPrompt.ts` / `familyAAnthropic.ts` /
  `familyABanListScan.ts` / `familyAFixtureProvider.ts` /
  `familyAKeys.ts`
* `mcp-server/lib/familyBPrompt.ts` / `familyBAnthropic.ts` /
  `familyBBanListScan.ts` / `familyBFixtureProvider.ts` /
  `familyBKeys.ts`
* `mcp-server/lib/familyCPrompt.ts` / `familyCAnthropic.ts` /
  `familyCBanListScan.ts` / `familyCFixtureProvider.ts` /
  `familyCKeys.ts`
* `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` (NO
  compound-key change; Subset path preserves schema mirror)
* `mcp-server/lib/seedPrompt.ts`
* `mcp-server/lib/familyRegistry.ts` (registry primitive — no
  shape change)
* `mcp-server/lib/anthropicCall.ts` (shared Anthropic wrapper —
  Family D reuses unchanged)
* `mcp-server/lib/doctrineBanList.ts` (shared pattern set —
  Family D reuses unchanged; no Family-D extensions added per
  §4.4)
* `mcp-server/lib/logging.ts` (logging primitive — Family D
  reuses unchanged)
* `mcp-server/lib/familyBooleanRequestSchema.ts` (shared
  validator — no shape change; Family D surfaces additively via
  the registry)
* `mcp-server/lib/toolDispatch.ts` / `toolRegistry.ts` /
  `bootstrap.ts`
* `mcp-server/scripts/validate-family-a-response.ts`,
  `validate-family-b-response.ts`,
  `validate-family-c-response.ts` (Family A/B/C validators
  unchanged; Family D may get its own optional script — designer
  recommends SKIP to keep diff minimal, mirroring Family C
  precedent)
* `mcp-server/tests/familyA*.test.ts` (existing Family A tests
  untouched)
* `mcp-server/tests/familyB*.test.ts` (existing Family B tests
  untouched)
* `mcp-server/tests/familyC*.test.ts` (existing Family C tests
  untouched)
* `mcp-server/tests/classifyArgumentBooleanObservations.test.ts`
  (the existing dispatcher integration test — designer's note:
  this MAY need a 1-line update if the test depends on the tool
  description text; recommends checking during implementation)
* `mcp-server/tests/adapterCompat.test.ts`,
  `mcp-server/tests/jsonRpc.test.ts`, etc.
* `src/features/nodeLabels/**` (upstream taxonomy; locked per
  intent brief §5; HALT trigger #2)
* **`supabase/functions/_shared/booleanObservations/familyRegistry.ts`**
  — already has the Family D entry at lines 84-88
  (`productionEnabled: false, adminValidationEnabled: true`);
  intent brief §6 HALT #17 forbids any Edge edit that flips
  `productionEnabled: true`. Locked.
* `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts`
  and all other Edge files — locked per intent brief §5.
* `supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`
  — locked (registry-derived; no edit needed because
  `productionEnabledFamilies()` excludes D automatically).
* `supabase/migrations/**` (no migration in this card)
* Any file under `app/`, `src/features/argumentScoring/`,
  `src/features/sourcing/`, etc. (UI / scoring / source-chain
  UI; unrelated to this server-side card)

---

## 11. HALT trigger table (all 24 from intent brief §6)

| # | Trigger | Assessment |
| - | ------- | ---------- |
| 1 | Card 1 (FAMILIES-B-C-ENABLE) smoke PASS audit missing from main | PASS — confirmed at `ac66b2e` (`docs/audits/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-2026-05-27.md`); verified via `git log` |
| 2 | Family D raw key list differs from MCP-021A source (`src/features/nodeLabels/machineObservationDefinitions/familyD.ts`) | PASS — Phase A.1 cross-check shows 27/27 verbatim match; Subset extracts 19 ai_classifier-only verbatim; `familyDKeysParity.test.ts` enforces |
| 3 | Any Family E/F/G/H/I/J registration in this card | PASS — design §1 IN-scope registers only `evidence_source_chain`; HALT triggered by reviewer if implementer adds E-J |
| 4 | Family A or Family B or Family C behavior changes (not byte-equal) | PASS — `familyA*.ts`, `familyB*.ts`, `familyC*.ts` listed in §10 lockout |
| 5 | unsupported_family rejection envelope changes for E/F/G/H/I/J | PASS — registry has only A+B+C+D after init; E-J remain unsupported; validator rejects at the registry layer |
| 6 | Schema mirror response shape change without operator approval at Stage 2B | **NOT fired (Subset path)** — Subset preserves flat-keyed `observations: Record<rawKey, boolean>`; no schema mirror change. **WOULD fire** if implementer accidentally switches to Full-27 path. |
| 7 | New taxonomy keys | PASS — design adds zero new keys; Family D mirrors MCP-021A's existing 19 ai_classifier rawKeys verbatim (5 auto_metadata + 3 lifecycle keys deferred but NOT added either) |
| 8 | MCP schema version change | PASS — `mcp-021.machine-observations.boolean.v1` constant stays; explicitly out-of-scope per §1 |
| 9 | Family A/B/C prompt changes | PASS — `familyAPrompt.ts`, `familyBPrompt.ts`, `familyCPrompt.ts` listed in §10 lockout |
| 10 | Client-side MCP call introduced | PASS — design is server-side only (`mcp-server/lib/**`); no `src/` or `app/` file touched |
| 11 | MCP bearer / Anthropic / service-role secret exposure | PASS — Family D Anthropic wrapper reuses the existing `callAnthropic` (proven safe by `anthropicNoLogging.test.ts`); no secret in any new file; `familyDAnthropic.test.ts` includes the same API-key-never-logged tests as Family A/B/C |
| 12 | Logs raw argument body, raw prompt, raw model response, bearer token, or API key | PASS — all log calls reuse the existing `log(...)` helper from `logging.ts` (which strips secrets); per-family `family: 'evidence_source_chain'` tag added at the 3 warn paths (no body / prompt / response logged) |
| 13 | Subset filter implementation differs from Stage 2B operator approval | NOT KNOWN AT DESIGN TIME — designer recommends Subset; operator approves at Stage 2B; implementer must match Stage 2B output |
| 14 | Full-27 implementation chosen without operator approval at Stage 2B | NOT KNOWN AT DESIGN TIME — design recommends Subset; HALT triggered if implementer ships Full-27 without operator approval |
| 15 | MAX_TOKENS bump proposed without operator approval at Stage 2B | **WILL FIRE without Stage 2B approval.** Subset path requires `MAX_TOKENS=1800` (+300 from 1500). Stage 2B operator approval for Subset implicitly approves this bump; designer surfaces this explicitly in §2 and §6 |
| 16 | Compound-key response shape proposed without operator approval at Stage 2B | **NOT fired (Subset path).** Compound-key shape avoided by exclusion. WOULD fire if Full-27 is approved instead. |
| 17 | Family D Edge familyRegistry entry: `productionEnabled` must be `false` | PASS — Edge familyRegistry already has Family D `productionEnabled: false` at lines 84-88; design §1 OUT-of-scope explicitly forbids any Edge edit. `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts:FR-7` asserts every NON-A/B/C family is `productionEnabled: false`; if implementer accidentally flips it, that test fails |
| 18 | Prompt frames evidence-source moves as judgmental (descriptive only per MCP-021A doctrine) | PASS — §2 system prompt mirrors Family A/B/C's 7 absolute rules verbatim; user prompt explicitly says "structural observation, not a judgement"; `familyDPrompt.test.ts` asserts |
| 19 | `anecdote_used` framed as weakness | PASS — §4.1 doctrine guard surfaces source guard verbatim ("anecdote is legitimate evidence in some contexts; copy must NOT imply weakness"); `familyDDoctrineFixtures.test.ts` asserts no `weak` / `bad` / `inferior` / `lesser` / `unreliable` / `merely` in `anecdote_used` evidenceSpans |
| 20 | `burden_request_present` framed as a verdict | PASS — §4.2 doctrine guard surfaces source guard verbatim ("burden-of-proof framing is debated philosophical territory; CDiscourse treats it descriptively, not as a verdict on which side is 'right'"); `familyDDoctrineFixtures.test.ts` asserts no `right` / `wrong` / `correct` / `incorrect` / `justified` / `unjustified` in `burden_request_present` evidenceSpans |
| 21 | `evidence_gap_present` framed as failure | PASS — §4.3 doctrine guard explicitly says "does NOT imply the move is dishonest, low-quality, or manipulative"; anti-amplification anchor in system prompt; `familyDDoctrineFixtures.test.ts` asserts no `dishonest` / `low_quality` / `weak` / `manipulative` / `false` / `lying` in `evidence_gap_present` evidenceSpans |
| 22 | Verdict / winner / fallacy tokens in user-facing strings | PASS — system prompt mirrors Family A/B/C's 7 absolute rules verbatim (negation form only); per-key entries are model-facing only (not user-facing); ban-list scan blocks model responses with verdict tokens |
| 23 | Unclassified untracked files at PR creation | NOT KNOWN AT DESIGN TIME — operator-territory exclusions are KNOWN per intent brief §6; implementer + reviewer enforce |
| 24 | Test forecast exceeds +300 | PASS — forecast +95 to +120 (midpoint ~107) with per-file breakdown in §6; well under HALT threshold |

**Active HALT risk at design time:** **Trigger #15 (MAX_TOKENS
bump) WILL fire unless operator approves at Stage 2B.** This is the
binding operator-decision ask for the Subset path. Designer's
binding recommendation is to approve the +300 bump along with the
Subset path; the bump is mathematically unavoidable for the
19-key ai_classifier subset. Operator may choose to (a) approve
Subset + 1800 MAX_TOKENS; (b) approve Full-27 + 2800 MAX_TOKENS;
or (c) override the designer recommendation and request a
sub-15-key narrower subset that fits in 1500 MAX_TOKENS — this
last option is feasible by dropping `evidence_supports_claim`,
`evidence_quality_questioned`, `evidence_claim_present`,
`opens_evidence_debt_marker`, `closes_evidence_debt_marker`
(the 5 lowest-priority `inspect`-surface keys) to reach 14 keys
× 90 tokens = 1260 + 80 overhead = 1340 (within 1500), but this
loses doctrinally-valuable keys and is the least-preferred path.

Triggers 13, 14, 23 are runtime-only and cannot fire at design
phase. All other 20 triggers (excluding 15, 13, 14, 23) PASS.

---

## 12. Brief ledger (orchestrator-authored brief context)

The intent brief at `bd3dbdf` is operator-authored (per Card 1's
"Card 2 of combined launch" framing and the inventory verified
at Phase 0). The intent brief carries explicit binding decisions:

| Section | Source | Binding |
| --- | --- | --- |
| §1 27-entry inventory | Operator Phase 0 live verification | binding |
| §2 Stage 2B operator-decision (Subset vs Full-27) | Operator-bound | binding pending Stage 2B |
| §3 Token budget projections | Operator-bound; superseded by designer Phase A.2 | designer-bound override |
| §4 3 doctrine load-bearing keys | Operator-bound | binding |
| §5 Out-of-scope list | Operator-bound | binding |
| §6 24 HALT triggers | Operator-bound | binding |
| §7 5 Phase A audits | Operator-bound | binding (this design satisfies all 5) |
| §8 Test forecast bands | Operator-bound | binding |
| §9 Smoke plan (8 phases) | Operator-bound | binding |
| §11 Execution order + Stage 2B | Operator-bound | binding |

### Decision provenance ledger (designer-authored)

Per the multi-card chain protocol, this design ledger flags
interpretive choices the designer made when the intent brief
gave latitude:

| Decision | Source | Resolution |
| --- | --- | --- |
| 1 — Subset vs Full-27 recommendation | Intent brief §2 default recommendation: Subset; §11 mandates designer pick one | Designer recommends **Subset**. Rationale per §6: deterministic-key value, schema preservation, smaller MAX_TOKENS bump, latency margin, architectural precedent, future-card hooks |
| 2 — Per-key token estimate | Family C baseline ~85; intent brief §3 notes "Family D may be higher due to evidence-citation verbosity" | Designer estimates **90 tokens/key** for Family D (vs 85 for Family C). Conservative; if real-corpus testing shows lower, MAX_TOKENS can be tightened later |
| 3 — MAX_TOKENS for Subset path | Intent brief §2 surfaces "(a) keep 1500 + tighter prompt; (b) bump to ~1800; (c) audit if 85-token-per-key estimate is conservative" | Designer recommends **1800** (option (b)). Tighter prompts (option (a)) risk truncating definitions blocks; auditing (option (c)) is a what-if that doesn't change the math — 19 × 90 = 1710 plus overhead exceeds 1500 |
| 4 — Family-D-specific ban-list extensions | Intent brief §4 says "Designer Phase A.4 verifies these 3 keys + adds Family D-specific ban-list extensions to the shared DOCTRINE_BAN_PATTERNS" | Designer recommends **NO global ban-list extensions**. Reasoning in §4.4: per-key doctrine assertions in `familyDDoctrineFixtures.test.ts` capture the Family-D-specific risks without forcing global patterns that could false-positive in other families |
| 5 — 5 binding request fixtures | Intent brief §7 Phase A.3 implies 5 fixtures (parallel to Family C) | Designer authored 5: canonical (source + statistic), source-provided, evidence-gap, anecdote-used (doctrine-test), no-evidence (adversarial Family-C-style). Mirrors Family C fixture pattern with Family-D-appropriate content |
| 6 — No-evidence adversarial fixture content | Intent brief §7 Phase A.3 doesn't bind the content of the adversarial fixture | Designer chose a Family-C-style repair move ("offers candidate understanding") because that's the predecessor family Family D must NOT misclassify; this is the cross-family discriminator proof |
| 7 — Decision NOT to add `validate-family-d-response.ts` script | Family A/B each have a one-off validator script; Family C designer's recommendation was SKIP | Designer follows Family C precedent: SKIP the optional script; the Deno test surface (`familyDResponseValidator.test.ts`) covers validation. Implementer may add it if requested |
| 8 — Test forecast upper-band | Intent brief §8 forecasts +80 to +120 for Subset; observed Family C upper band was 124 | Designer forecasts **+95 to +120** (upper-band ~120). The 4-way cross-family rejection tests add 6 combinations vs Family C's 4. Implementer may land slightly below if test files consolidate; +95 is the binding minimum |
| 9 — Anti-amplification fixture | Intent brief §4.3 anti-amplification anchor implies a fixture | Designer adds an anti-amplification assertion to `familyDDoctrineFixtures.test.ts`: a fixture with "many people say X" must produce `evidence_gap_present: true` (popularity is not evidence) |
| 10 — Hosted smoke check numbering | Family C added checks 12 + 13 | Designer adds checks 14 + 15. Smoke tally becomes 15 PASS |
| 11 — Edge familyRegistry small Jest test | Intent brief §7 Phase A.5 says designer adds small Jest parity tests | Designer adds 1-2 small assertions confirming Family D has `productionEnabled: false` AND `adminValidationEnabled: true`; existing FR-7 + FR-9 in `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` already pins this; the new test reinforces |

**Operator-deferred review** (post-ship items the operator may
revisit):

- Whether the Subset recommendation holds in the long run, or
  whether E/F/G/H/I/J's structural mix justifies revisiting Full-27
  for Family D retroactively.
- Whether to add `validate-family-d-response.ts` parallel to A/B
  validators (decision deferred to implementer / operator).
- Whether the +300 MAX_TOKENS bump produces measurable truncation
  in real corpus (telemetry from Phase 4 + future
  admin_validation calls informs).
- Whether the 8 deferred keys (5 auto_metadata + 3 lifecycle) need
  a near-term Edge adapter card to compute them deterministically,
  OR whether Source 6 / scoring downstream consumers can wait.
- Whether the `evidence_gap_present` anti-amplification anchor
  produces over-firing on legitimate value claims (should NOT
  per the prompt; real-corpus calibration confirms).
- Whether the doctrine-risk-key real-corpus calibration on
  `anecdote_used` / `burden_request_present` / `evidence_gap_present`
  produces any framing that should trigger Family-D-specific ban
  patterns (future OPS observability card).

### Open questions for the operator at Stage 2B

1. **Subset vs Full-27 path choice** (mandatory Stage 2B
   operator-decision). Designer recommends Subset.
2. **MAX_TOKENS bump approval** (HALT trigger #15). Designer
   recommends 1800 for Subset (300-token bump); 2800 for Full-27
   (1300-token bump). Approval of either path implicitly approves
   the corresponding bump.
3. **(Optional) deferred-key strategy.** If Subset is chosen, the
   8 deterministic keys (5 auto_metadata + 3 lifecycle) are
   deferred to a future Edge adapter card. Operator may confirm
   whether this future card is filed now (`MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS`)
   or deferred to post-Family-D-smoke OPS review.

---

## Operator steps (per intent brief §9; operator-run smoke)

After the implementer's PR merges to `main`:

1. Confirm Deno Deploy auto-deploy completed (hosted MCP server
   `/health` shows post-merge build).
2. Confirm Supabase Edge Function auto-deploy completed
   (`classify-argument-boolean-observations` version bumped).
3. Run hosted smoke:
   ```bash
   bash scripts/mcp-server-001-smoke.sh \
     --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
     --token <hosted-bearer-token>
   ```
   Expect `15 PASSES, 0 FAILS` / `EXIT: 0`.
4. Acquire admin JWT (same pattern as Family C smoke Phase 4).
5. POST to Edge `classify-argument-boolean-observations` with
   `requestedFamilies: ['evidence_source_chain']` + `mode:
   'admin_validation'` + the 3 seeded args.
6. (Optional, per Decision 9) SQL readback against
   `argument_machine_observation_results` if any positives observed.
7. POST 6 unsupported-family rejection regression requests (E, F,
   G, H, I, J).
8. Author audit doc at
   `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-<date>.md`.
9. Delete temp files: hosted token rotation, helper scripts,
   smoke artifacts.

**No database migration. No code deploy beyond the standard merge
→ Deno Deploy auto-deploy + Supabase Edge Function auto-deploy
chain.**

---

## Doctrine self-check

### cdiscourse-doctrine §1 (Score is gameplay, not truth)

* Family D prompt frames evidence presence / gap / repair as
  structural collaborative observations, never as who is right or
  wrong about evidence.
* 3 doctrine-risk guards (`anecdote_used`, `burden_request_present`,
  `evidence_gap_present`) each block verdict / weakness / failure
  framing.
* Ban-list scan blocks model-emitted verdict tokens at the response
  boundary.
* System prompt's 7 absolute rules mirror Family A/B/C verbatim.

### cdiscourse-doctrine §3 (Popularity is not evidence)

* `evidence_gap_present` prompt anchor explicitly encodes the
  anti-amplification rule: "popularity / repetition / engagement
  is NOT evidence; a commonly-asserted claim with no source is an
  evidence gap regardless of how often it has been said elsewhere."
* Anti-amplification fixture in `familyDDoctrineFixtures.test.ts`
  proves the model correctly identifies "many people say X" as
  `evidence_gap_present: true`.

### cdiscourse-doctrine §4 (AI moderator hard limits)

* No deletion / modification of user content.
* No truth assignment.
* AI advisory: every Family D observation flows through the same
  Edge persistence + Source 6 rendering pipeline (out of scope
  for this card; admin_validation rows filtered from production
  Source 6).
* AI calls are server-side Deno only (per the MCP server's
  architecture; this card adds zero client-side AI integration).

### cdiscourse-doctrine §6 (Secrets policy)

* `ANTHROPIC_API_KEY` reaches Anthropic via `callAnthropic`'s
  `x-api-key` header inside the Deno server; never logged.
* `MCP_SERVER_BEARER_TOKEN` is the hosted-server auth; smoke
  script redacts it as `[REDACTED]`.
* No new secret introduced.
* `familyDAnthropic.test.ts` includes the same API-key-never-logged
  assertions as Family A/B/C.

### cdiscourse-doctrine §7 (No AI calls from production app)

* Family D Anthropic call runs in the MCP server (Deno Deploy),
  not the production app.
* Zero `src/` or `app/` file touched.
* No new fetch / HTTP-client / SDK introduced.

### cdiscourse-doctrine §10a (Observations vs Allegations)

* Family D keys (19 in Subset) are all `kind: 'machine_observation'`
  per source taxonomy.
* `source: 'ai_classifier'` for all 19 Subset keys.
* No `user_allegation` Family D variant proposed.
* No verdictive labels emitted in any field.

### evidence-doctrine (engagement vs factual-standing separation)

* `provides_evidence`, `source_provided`, `quote_provided`,
  `source_chain_repair`, `closes_evidence_debt_marker`,
  `supplies_corroborating_document` are the productive
  evidence-positive grounding moves (engagement-positive; AND
  open factual-standing eligibility per source-chain doctrine).
* `evidence_gap_present` is the structural observation; per
  doctrine "an evidence gap does not automatically lower
  standing; standing changes when challenged and the gap
  persists" — the classifier flags the gap; downstream scoring
  (out of scope) acts on it.
* `anecdote_used`, `statistic_used`, `external_authority_used`
  are descriptive evidence-type observations; none of them
  ranks evidence quality (that's `evidence_quality_questioned`).
* Anti-amplification: `evidence_gap_present` enforces the
  cdiscourse-doctrine §3 boundary.
* No popularity / engagement signal influences Family D
  classification.
* Family D observations feed downstream point-standing economy
  but THAT integration is out of scope; this card returns the
  machine observations only.

### point-standing-economy

* `evidence_gap_present` does NOT automatically lower standing;
  standing changes when challenged AND the gap persists. The
  classifier flags the structural state; scoring is separate.
* `source_chain_repair` and `closes_evidence_debt_marker` are
  recovery-positive moves; the engagement credit is automatic;
  factual standing depends on whether the evidence reaches
  primary-source status (out of scope for this card).
* `burden_request_present` is descriptive — does NOT determine
  who actually bears the burden of proof.

### test-discipline (every public function has a test)

* Per §6 + §8: every new file has dedicated test coverage.
* New: `familyDKeys.test.ts`, `familyDKeysParity.test.ts`,
  `familyDPrompt.test.ts`, `familyDAnthropic.test.ts`,
  `familyDBanListScan.test.ts`, `familyDFixtureParity.test.ts`,
  `familyDResponseValidator.test.ts`, `familyDDispatch.test.ts`,
  `familyDDoctrineFixtures.test.ts`.
* Updated: `familyRegistryInit.test.ts` (+3),
  `familyRegistry.test.ts` (+3),
  `familyBooleanRequestSchema.test.ts` (+6-8); 1-2 Jest tests for
  Edge familyRegistry Family D entry confirmation.
* No `.skip` / `.only` introduced.
* Test count goes UP (forecast +95 to +120); no test removal.

### supabase-edge-contract

* No Edge Function code change.
* No new RLS rule.
* No new migration.
* Existing Edge family gate at
  `supabase/functions/_shared/booleanObservations/familyRegistry.ts:84-88`
  is the binding control on production-mode Family D — and it's
  off (`productionEnabled: false`), per the existing
  MCP-021C-EDGE-FAMILIES-B-C-ENABLE configuration.
* No service-role usage introduced.

---

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Implementer accidentally adds a Family E key to `familyDKeys.ts` | Low | Intent brief HALT #3 covers; reviewer reads `familyDKeys.ts` end-to-end during PR review; `familyDKeysParity.test.ts` enforces exact 19-key match against upstream ai_classifier subset |
| Implementer accidentally routes one of the 8 deterministic keys through the MCP server | Low-Medium | `familyDKeysParity.test.ts` asserts the 19-key constant excludes the 5 auto_metadata + 3 lifecycle keys; if implementer includes them, parity test fails the build |
| Family A/B/C test regression from dispatcher refactor | Medium | All Family A/B/C tests under `mcp-server/tests/family[ABC]*.test.ts` remain unchanged; dispatcher refactor reuses existing provider tables when `resolvedFamily` is A/B/C; Family C smoke pattern proved byte-equal preservation works for 3 families; the same approach extends to 4 |
| Model produces over-firing on subtle evidence signals on adversarial Family-C-style content | Medium | `family-d-no-evidence-request.json` fixture covers this; `familyDDoctrineFixtures.test.ts` asserts all 19 keys false on this fixture; admin_validation smoke surfaces real cases for operator review |
| Token budget too tight (19 keys × 90 = 1710 vs 1800 envelope) | Low | §2 token-budget audit confirms 1790 / 1800 (99%); risk surfaced as TELEMETRY-driven follow-on for OPS observability card; if real-corpus testing reveals truncation, follow-on can split the 19-key call into 2 batches OR bump MAX_TOKENS to 2000 |
| Edge `admin_validation` smoke returns 0 positives across all 3 seeded args | Medium-High (per Decision 9) | Documented as PARTIAL-acceptable; pipeline verification (HTTP 200 + valid response shape + correct raw_keys universe) is the binding PASS gate; fresh-room seeding for evidence-source signal quality belongs to a future OPS card |
| Hosted smoke fails because Deno Deploy build hasn't deployed | Low | Operator step 1 verifies hosted `/health` shows post-merge build |
| Implementer adds production-mode Family D by accidentally editing the Edge gate | Low | Intent brief §6 HALT #17 explicit lock-out; §10 of this design names the file as READ ONLY (and notes Edge entry already exists at lines 84-88); existing `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts:FR-7` asserts every NON-A/B/C family has `productionEnabled: false`, including Family D — any accidental flip fails that test |
| Implementer switches to Full-27 path without operator Stage 2B approval | Low-Medium | Intent brief §6 HALT #14 covers; design §6 makes Subset the recommended binding; reviewer enforces; Stage 2B operator-decision is mandatory before implementer begins |
| Smoke script `[14-…]` / `[15-…]` checks fail due to fixture pathway not yet wired | Low | Fixture provider serves the Family D canonical response; the smoke script's fixture-mode path is identical to Family A/B/C |
| Dispatcher's `pickFamilyProviders` table grows confusing past 4 families | Low for this card; Medium for E-J | 4 entries in a switch-style helper is still clear. If the table grows to 6+ entries, a follow-on refactor to a `Map<family, providers>` may be cleaner — defer to OPS observability or Family F+ |
| Latency exceeds 25s in admin_validation | Low-Medium | §2 latency projection projects 22.5-25s; cold-start Edge adds 2-3s; total worst-case ~28s (still well under 60s timeout); if real latency exceeds 30s, observability card investigates |
| Model produces false-positive on `evidence_gap_present` for value claims | Low | Source guard explicitly excludes value claims; prompt translates this verbatim; `familyDDoctrineFixtures.test.ts` includes a value-claim fixture asserting `evidence_gap_present: false` |
| Anti-amplification anchor confuses model on legitimately-repeated claims with primary sources | Low | The anchor is conditional on no source attached; the prompt clarifies "regardless of how often it has been said elsewhere" applies to the no-source case; fixture asserts |

---

## Dependencies

### Upstream dependencies (this card assumes complete)

* MCP-021A (taxonomy + parser; commit `d6648b4`) — provides
  `src/features/nodeLabels/machineObservationDefinitions/familyD.ts`
  source of truth.
* MCP-021B (persistence + Source 6 adapter; commit `eaa1aeb`) —
  provides `argument_machine_observation_runs` /
  `argument_machine_observation_results` tables; family-agnostic
  schema accepts Family D rows after registry registers.
* MCP-021C-EDGE (runtime spine; commit `9a4de95`) — provides the
  Edge Function adapter AND the Edge familyRegistry with Family D
  entry pre-configured (`productionEnabled: false`,
  `adminValidationEnabled: true`).
* MCP-021C-EDGE-FAMILIES-B-C-ENABLE (`ce84bb1`; Card 1) — flips
  Family B + C to production-mode; refactors auto-trigger
  dispatcher to be registry-derived; Family D remains
  admin_validation-only.
* MCP-SERVER-001 (server foundation; commit `8a1652c`) — provides
  the Deno Deploy hosted MCP server with bearer auth + JSON-RPC
  endpoint.
* MCP-SERVER-002 (Family A classifier; commit `27bb837`) — provides
  the Family A pattern files.
* MCP-SERVER-003-FAMILY-B (`ebbe389`) — Family B implementation.
* MCP-SERVER-004-FAMILY-C (`e12aeb5`) — Family C implementation;
  primary pattern template for this card.
* MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE (PASS at `ac66b2e`) —
  proves 3-family production + auto-trigger end-to-end.
* MCP-SERVER-004-FAMILY-C-SMOKE (PASS at `70b18f2`) — proves
  3-family registry works end-to-end through hosted MCP + Edge
  `admin_validation`.

### Downstream blockers (cards that this design enables / blocks)

* **AUTHORIZES (post-PASS):** `MCP-021C-EDGE-FAMILY-D-ENABLE` —
  production-mode flip for Family D (Stage 2B may be required if
  any compound-key deferred decision arises).
* **AUTHORIZES (post-PASS):** future `MCP-SERVER-006-FAMILY-E`
  (with Stage-2B for structural complexity if applicable).
* **AUTHORIZES (post-PASS):** future
  `MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS` — Edge adapter
  card that computes the 8 deferred keys (5 auto_metadata + 3
  lifecycle) deterministically from tree/cluster state without an
  Anthropic call.
* **STRONGLY RECOMMENDS (post-PASS):** `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE`
  (4-family state observability).
* **BLOCKS:** Family E start until Family D PASS; serial batch
  enforcement per intent brief §11.

---

## Out of scope (explicit list — reduces scope creep)

This card does NOT include any of:

* Family E (`argument_scheme`), Family F (`critical_question`),
  Family G (`resolution_progress`), Family H (`claim_clarity`),
  Family I (`thread_topology`), Family J (`sensitive_composer`)
  — each is a separate future card.
* Production-mode Family D enablement at the Edge Function. (Per
  intent brief §5 + HALT #17; Edge gate stays
  `productionEnabled: false`.)
* Production auto-trigger Family D.
* Compound-keyed response shape (Subset path avoids it; Full-27
  is the alternative the operator may approve at Stage 2B).
* Edge adapter card computing the 8 deferred keys deterministically
  (`MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS` is the future card
  authorized post-PASS).
* Edge persistence migration (raw_key compound or new source
  column — only needed if Full-27 is chosen).
* OPS observability dashboards / per-family metrics endpoints.
* RLS policy changes.
* UI surface for Family D observations (chips, tooltips, Inspect
  panel).
* Source 6 rendering changes.
* Plain-language label registry edits for Family D (the upstream
  `nodeAnnotationsRegistry` / `nodeLabelPlainLabelMap` already has
  the Family D keys per MCP-021A).
* Engagement-credit / factual-standing scoring integration for
  Family D observations.
* Bot fixture runner integration of Family D classifier outputs.
* X News / xAI pilot integration of Family D annotations.
* CSV / JSONL export of Family D run rows.
* `validate-family-d-response.ts` script (per §10 decision).
* Anti-amplification scoring integration (Family D observations
  inform anti-amplification; the scoring integration is a future
  card).
* Documentation overhauls in `docs/conversation-gallery-ux.md` or
  similar.

---

**Designer Stage 1 deliverable complete.** Stage 2B operator-decision
checkpoint follows.
