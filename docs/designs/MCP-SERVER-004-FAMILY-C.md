# MCP-SERVER-004-FAMILY-C — Misunderstanding Repair Boolean Observation Classifier (design)

**Status:** Design draft
**Epic:** MCP server family rollout (Family C of B-C-D-E serial batch)
**Release:** Stage 6.x — Machine Observation classifiers
**Issue:** binding source is `docs/designs/MCP-SERVER-004-FAMILY-C-intent.md` (operator-authored intent brief at `fbf7c87`)
**Intent brief:** [`docs/designs/MCP-SERVER-004-FAMILY-C-intent.md`](./MCP-SERVER-004-FAMILY-C-intent.md)
**Predecessor on main:** `fbf7c87` (intent brief commit)
**Branch:** `feat/MCP-SERVER-004-FAMILY-C`

---

## 0. Goal (one paragraph)

Family C (`misunderstanding_repair`, 17 raw keys) is the third
boolean-observation family registered on the hosted MCP server.
This card adds Family-C-specific server-side files (`familyCKeys.ts`,
`familyCPrompt.ts`, `familyCAnthropic.ts`, `familyCBanListScan.ts`,
`familyCFixtureProvider.ts`) and 5 fixtures, registers
`misunderstanding_repair` in the shared validator registry via a
one-line addition to `familyRegistryInit.ts`, routes Family C
requests through the dispatcher's provider table, and extends the
hosted smoke script to 13 PASS checks. **The Edge Function family
registry already has the Family C entry** (per
`supabase/functions/_shared/booleanObservations/familyRegistry.ts:73-77`
— `productionEnabled: false`, `adminValidationEnabled: true` —
shipped in MCP-021C-EDGE; verified by
`__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts:46-100`), so
**no Edge `familyRegistry.ts` edit is required**. The doctrine framing
treats repair as **collaborative grounding** (Schegloff/Sacks repair
model + Clark & Brennan grounding doctrine), with verbatim guards
for the 4 doctrine-risk keys (`rejects_candidate_understanding`,
`acknowledges_misread`, `flags_term_ambiguity`, `clarified`) and the
tree-dependency caveat for `clarified` (lifecycle key — answer FALSE
with low confidence when only move text is visible, mirror of
Family A's `has_rebuttal` / `has_counter_rebuttal` / `rebutted`
treatment).

Doctrine constraints that shape the design:

- **cdiscourse-doctrine §1, §4, §7, §10a** — every Family C
  observation is a structural fact about the move, never a verdict
  about a person; doctrine ban-list scan blocks model emission of
  banned tokens; AI calls remain server-side Deno only.
- **cdiscourse-doctrine §6** — `ANTHROPIC_API_KEY` /
  `MCP_SERVER_BEARER_TOKEN` never logged.
- **evidence-doctrine** — repair moves can earn engagement credit
  but the structural-observation layer never converts engagement to
  factual standing.
- **test-discipline** — every new public function ships with tests;
  test count strictly increases.
- **supabase-edge-contract** — no Edge code change in this card; the
  family registry is already in shape.

---

## 1. Scope reality (Phase A.1)

### Family C source verification

Source: `src/features/nodeLabels/machineObservationDefinitions/familyC.ts`.

Verified declaration order: **17 entries** (4 retroactive + 13 new),
each is a single `Object.freeze({ id, rawKey, ... })` block within the
top-level `FAMILY_C_DEFINITIONS` array.

| # | rawKey | Line | source | defaultSurface | priority | confidenceEligibility |
| - | ------ | ---- | ------ | -------------- | -------- | --------------------- |
| 1 | `clarified` | 53 | `lifecycle` | `timeline_node` | 23 | high/high/high (override) |
| 2 | `requests_clarification` | 96 | `ai_classifier` | `timeline_node` | 38 | REPAIR_TIMELINE_ELIGIBILITY (medium/low/low) |
| 3 | `answers_clarification` | 137 | `ai_classifier` | `timeline_node` | 39 | REPAIR_TIMELINE_ELIGIBILITY |
| 4 | `provides_alternate_interpretation` | 176 | `ai_classifier` | `timeline_node` | 48 | REPAIR_TIMELINE_ELIGIBILITY |
| 5 | `offers_candidate_understanding` | 216 | `ai_classifier` | `timeline_node` | 130 | REPAIR_TIMELINE_ELIGIBILITY |
| 6 | `confirms_understanding` | 260 | `ai_classifier` | `timeline_node` | 131 | REPAIR_TIMELINE_ELIGIBILITY |
| 7 | `rejects_candidate_understanding` | 300 | `ai_classifier` | `timeline_node` | 132 | REPAIR_TIMELINE_ELIGIBILITY |
| 8 | `requests_restatement` | 339 | `ai_classifier` | `inspect` | 133 | REPAIR_INSPECT_ELIGIBILITY (high/medium/low) |
| 9 | `self_initiates_self_repair` | 379 | `ai_classifier` | `inspect` | 134 | REPAIR_INSPECT_ELIGIBILITY |
| 10 | `other_initiates_repair` | 418 | `ai_classifier` | `inspect` | 135 | REPAIR_INSPECT_ELIGIBILITY |
| 11 | `acknowledges_misread` | 457 | `ai_classifier` | `inspect` | 136 | REPAIR_INSPECT_ELIGIBILITY |
| 12 | `flags_ambiguous_reference` | 495 | `ai_classifier` | `inspect` | 137 | REPAIR_INSPECT_ELIGIBILITY |
| 13 | `flags_term_ambiguity` | 535 | `ai_classifier` | `inspect` | 138 | REPAIR_INSPECT_ELIGIBILITY |
| 14 | `proposes_shared_definition` | 574 | `ai_classifier` | `timeline_node` | 139 | REPAIR_TIMELINE_ELIGIBILITY |
| 15 | `confirms_shared_definition` | 613 | `ai_classifier` | `inspect` | 140 | REPAIR_INSPECT_ELIGIBILITY |
| 16 | `scope_mismatch_identified` | 652 | `ai_classifier` | `inspect` | 141 | REPAIR_INSPECT_ELIGIBILITY |
| 17 | `question_answer_mismatch` | 691 | `ai_classifier` | `inspect` | 142 | REPAIR_INSPECT_ELIGIBILITY |

**Cross-check against intent brief §3 binding list:** 17/17 verbatim
match. Declaration order matches the intent brief enumeration
exactly. 16 of 17 are `ai_classifier` source; 1 (`clarified`) is
`lifecycle` source and requires cluster context.

### Cross-family key collision check (HALT trigger #14 evaluation)

Comparing Family C's 17 keys against Family A's 16 keys
(`familyAKeys.ts`) and Family B's 14 keys (`familyBKeys.ts`):

- Family A ∩ Family C = ∅ (no collision)
- Family B ∩ Family C = ∅ (no collision)

**HALT trigger #14 NOT fired.** No compound-key collision; the
schema-mirror change deferred to Family D does not propagate to
Family C.

### IN scope

* `mcp-server/lib/familyCKeys.ts` — frozen 17-rawKey constant +
  per-rawKey `FamilyCPromptEntry` blocks +
  `FAMILY_C_CLASSIFIER_SET_VERSION = 'family-c-v1'`.
* `mcp-server/lib/familyCPrompt.ts` — Family C system + user prompt;
  mirrors the 7 absolute rules verbatim from
  `familyAPrompt.ts:50-57` and `familyBPrompt.ts:65-72`; adds
  collaborative-grounding doctrine framing; adds the `clarified`
  lifecycle tree-dependency guard mirroring
  `familyAPrompt.ts:169-175`.
* `mcp-server/lib/familyCAnthropic.ts` — Family C Anthropic
  orchestrator (mirror of `familyBAnthropic.ts`); reuses the shared
  `callAnthropic` wrapper.
* `mcp-server/lib/familyCBanListScan.ts` — Family C response
  doctrine ban-list scan (mirror of `familyBBanListScan.ts`); reuses
  the shared `DOCTRINE_BAN_PATTERNS` constant.
* `mcp-server/lib/familyCFixtureProvider.ts` — fixture-mode provider
  for Family C (mirror of `familyBFixtureProvider.ts`); loads
  `family-c-canonical-response.json`.
* `mcp-server/lib/familyRegistryInit.ts` — ONE-line addition that
  registers `misunderstanding_repair` after the existing Family B
  registration.
* `mcp-server/tools/classifyArgumentBooleanObservations.ts` —
  per-family dispatch: route `misunderstanding_repair` requests to
  the Family C provider table; Family A and Family B paths remain
  unchanged. Tool `description` updated to advertise Family C
  alongside A and B.
* Family C fixtures under `mcp-server/fixtures/` (see §3):
  - 1 canonical response fixture
  - 1 malformed response fixture
  - 1 ban-list response fixture
  - 5 binding request fixtures per intent brief §7 / Decision 3
* `mcp-server/tests/familyCKeys.test.ts`,
  `familyCKeysParity.test.ts`, `familyCPrompt.test.ts`,
  `familyCAnthropic.test.ts`, `familyCBanListScan.test.ts`,
  `familyCFixtureParity.test.ts`,
  `familyCResponseValidator.test.ts`,
  `familyCDispatch.test.ts`,
  `familyCDoctrineFixtures.test.ts`.
* Test updates: `familyRegistryInit.test.ts` extends to expect all
  three registered families;
  `familyRegistry.test.ts` adds 3-family cross-rejection tests
  (Family A key under C → false; Family B key under C → false;
  Family C key under A → false; Family C key under B → false);
  `familyBooleanRequestSchema.test.ts` adds Family C valid-request
  + cross-family rejection tests.
* `scripts/mcp-server-001-smoke.sh` — add 2 Family C PASS checks
  (`[12-compat-boolean-family-c]`,
  `[13-mcp-tools-call-boolean-family-c]`). Tally becomes 13 PASS.
* `docs/core/current-status.md` handoff section update.
* `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-template.md` (operator
  fills in date post-merge).

### OUT of scope

* Family D / E / F / G / H / I / J key registration.
  `familyRegistryInit.ts` after this card registers exactly
  `parent_relation` + `disagreement_axis` + `misunderstanding_repair`.
* MCP-021A taxonomy edits (`src/features/nodeLabels/**`). The 17
  Family C rawKeys come verbatim from the source `familyC.ts`.
* MCP schema version change
  (`mcp-021.machine-observations.boolean.v1` stays).
* Family A prompt, Anthropic adapter, ban-list scan, fixture
  provider, or key-mirror changes (`familyA*.ts` files untouched
  byte-equal).
* Family B prompt, Anthropic adapter, ban-list scan, fixture
  provider, or key-mirror changes (`familyB*.ts` files untouched
  byte-equal).
* Family A or Family B behavior changes of any kind — full byte-equal
  preservation per the OPS validator-refactor + Family B smoke
  baselines.
* Edge Function changes. **The Edge family registry already
  contains the Family C entry** (verified at
  `supabase/functions/_shared/booleanObservations/familyRegistry.ts:73-77`).
  No additive Edge edit needed — and per intent brief §5 ("Edge
  Function changes beyond test-only import-path updates" disallowed)
  no edit allowed either.
* Production auto-trigger for Family C. `MCP-021C-AUTO-TRIGGER`
  stays Family A only.
* Production-mode Family C enablement. Per Edge gate at
  `supabase/functions/_shared/booleanObservations/familyRegistry.ts:73-77`,
  `misunderstanding_repair` has `productionEnabled: false`.
  Flipping that flag is a separate card
  (`MCP-021C-EDGE-FAMILY-C-ENABLE` — referenced by intent brief
  §11).
* UI / display-cap / persistence-schema / Source-6 rendering
  changes.
* `mcp-server/bootstrap.ts` change — per OPS refactor design §8 (the
  init module is intentionally tool-layer-only).
* Any database migration. No DB shape change in this card.

---

## 2. Prompt architecture (Phase A.2)

### System prompt

Mirrors Family B's system prompt (`familyBPrompt.ts:61-92`) for the
7 absolute rules verbatim (lines 65-72), then adds Family C's
collaborative-grounding doctrine framing. Designer-bound template:

```
You are a CDiscourse argument-move structural classifier for a structured debate application.
Return strict JSON only.

Absolute rules:
- You do NOT decide who is right in a debate.
- You do NOT decide the winner of any debate.
- You do NOT assign a truth value to any claim.
- You do NOT treat popularity, engagement, or virality as evidence.
- You do NOT describe, judge, or label the person — only the move's structure.
- You do NOT recommend hiding, deleting, or modifying any content.
- You do NOT block an ordinary post — your output is advisory metadata only.

You classify whether an argument MOVE exhibits structural REPAIR or GROUNDING relationships
toward its PARENT move (or toward the cluster). Each question is a structural observation
about a repair or grounding signal, not a judgement about which side is unclear or wrong.
Repair is collaborative grounding work; both sides remain valid contributors to the
discussion. A request for clarification, a candidate-understanding offer, a corrected
paraphrase, an acknowledged misread, an ambiguity flag, a proposed shared definition —
each is a grounding move that opens or closes a shared-understanding cycle. None of these
is a verdict on either participant.

A move can simultaneously exhibit multiple repair/grounding signals (e.g., asking for
clarification AND flagging a term ambiguity); a move can ground without explicitly closing
a cycle. Repair moves are usually sparse — most moves exhibit 0 to 2 repair signals; few
exhibit more than 4.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a repair signal is present, answer
false. Repair moves are sparse; do NOT mark all rawKeys true. Tone alone is not repair;
substantive grounding content (a question, a paraphrase, a definition proposal, an
acknowledged misread, an ambiguity flag) is required for every positive.
```

**Doctrine ban-list scan on the literal system-prompt text:** the
banned tokens appear ONLY in negation form (lines 65-72), mirroring
Family A and Family B precedent. This is doctrine-positive per
`familyAPrompt.ts` and `familyBPrompt.ts` docstrings. The ban-list
scan runs against the model's RESPONSE, not the server-constructed
prompt.

### User prompt structure

Mirrors `buildFamilyBUserPrompt`
(`familyBPrompt.ts:130-222`) structure exactly, with these binding
adjustments:

1. **Questions block:** one line per requested Family C rawKey,
   formatted `- ${rawKey}: ${booleanQuestion}`.
2. **Definitions block:** one block per requested rawKey, with
   `rawKey` / `positiveDefinition` / `negativeDefinition` /
   `positive example` / `negative example` / `false-positive
   guards` fields.
3. **`clarified` lifecycle note** (new for Family C; mirror of
   Family A's `has_rebuttal` / `has_counter_rebuttal` / `rebutted`
   note at `familyAPrompt.ts:169-175`):

   ```
   Note about clarified: this rawKey is a cluster-level lifecycle state — a
   clarification request was answered with a clarifying response. When you receive only
   the move text and parent text — without the full cluster lifecycle — answer FALSE
   with low confidence unless the move text itself contains evidence of the closed
   clarification cycle. The Edge Function caller may compute this lifecycle key
   deterministically and skip your judgement.
   ```

4. **Repair-positive cross-key framing note** (new for Family C;
   anchors the doctrine §10a constraint):

   ```
   Note about repair as collaborative grounding: each Family C rawKey is a structural
   repair or grounding signal — a question, a paraphrase, an acknowledged misread, a
   definition proposal, an ambiguity flag, a scope-mismatch observation. None of these
   is a verdict on either participant. rejects_candidate_understanding is a normal
   grounding signal symmetric to confirms_understanding (the rejector is saying "that
   is not what I meant," not "you are wrong"). acknowledges_misread is the author's
   own constructive repair of a prior misread, not a failure. flags_term_ambiguity
   opens shared understanding; it does NOT imply the parent wrote ambiguously.
   scope_mismatch_identified is descriptive — both participants may be operating at
   different scopes, which is a structural fact, not a fault.
   ```

5. **Response-shape instruction:** verbatim JSON shape, with
   `classifierSetVersion: "family-c-v1"` in `modelInfo` (the only
   diff vs Family A's / Family B's JSON shape).
6. **Conservative-positives bias reminder:** "Repair moves are
   usually sparse — most moves exhibit 0 to 2 repair signals" (NOT
   Family A's "2 to 4 structural relationships"; NOT Family B's
   "0 to 3 disagreement sub-axes" — repair counts trend lower
   because most moves are not doing repair).
7. **Input:** move text + parent text + thread context (same shape
   as Family A and Family B).

### Prompt constants

| Constant | Value | Rationale |
| --- | --- | --- |
| `FAMILY_C_MAX_TOKENS` | `1500` | Mirrors Family A and Family B. 17 keys × ~85 tokens + overhead ≈ 1445; 1500 is the safe envelope. Token-budget audit below. |
| `FAMILY_C_TEMPERATURE` | `0` | Deterministic. Mirrors Family A/B. |
| `FAMILY_C_MAX_BODY_FIELD_LEN` | `8000` | Mirrors the validator's `MAX_BODY_LEN` and Family A/B. |

### Token budget audit (HALT trigger #15 evaluation)

Family A: 16 keys × ~80 output tokens = ~1280; envelope 1500;
headroom ~220.
Family B: 14 keys × ~80 output tokens = ~1120; envelope 1500;
headroom ~380.
Family C: 17 keys × ~85 output tokens = ~1445; envelope 1500;
headroom **~55**.

The Family C output-token estimate is the tightest fit yet — but
still fits inside MAX_TOKENS=1500 with ~3.7% headroom. The slightly
higher per-key estimate (~85 vs ~80) reflects:

- The umbrella/subtype + cycle-completion pattern adds ~1 token per
  repair pair (`offers_candidate_understanding` →
  `confirms_understanding` / `rejects_candidate_understanding`;
  `proposes_shared_definition` → `confirms_shared_definition`)
  beyond the simpler atomic-key pattern of Family A/B.
- `clarified` (lifecycle) and `requests_restatement` produce
  shorter evidence spans on average, partially compensating.

**HALT trigger #15 NOT fired** — the design does not propose a
MAX_TOKENS bump. Operator-visible risk: if real-corpus testing
reveals the model truncates the JSON response (final keys cut off)
under load, a follow-on observability card may need to investigate
splitting the 17-key call into 2 batches OR bumping MAX_TOKENS to
1800-2000. This is a TELEMETRY-driven decision to defer to
`OPS-MCP-OBSERVABILITY` per intent brief §9 Phase 7.

Input-token budget estimate (system + user prompt + move/parent
text):

- System prompt: ~340 tokens
- User-prompt scaffolding (instructions, JSON shape, lifecycle
  note, repair-positive note, reminder): ~600 tokens
- Definitions block (17 entries × ~110 tokens each): ~1870 tokens
- Move text + parent text (capped at 8000 chars each ≈ ~2000
  tokens each at typical density): up to ~4000 tokens worst case
- Thread context (capped at 8000 chars ≈ ~2000 tokens worst case)

Worst-case input estimate ≈ ~8800 tokens. Well under Claude's
200K-context budget; comfortably under the 6000-token deferred
threshold from MCP-SERVER-002-SMOKE §11.3.3.

### `classifierSetVersion` emit-line

`'family-c-v1'` — bound at top of `familyCKeys.ts` as
`export const FAMILY_C_CLASSIFIER_SET_VERSION = 'family-c-v1' as const;`.
Appears in:

* the registry registration (consumed by the validator for
  cross-family checks),
* the prompt's response-shape `modelInfo.classifierSetVersion` field,
* the canonical fixture JSON,
* the parity tests.

### Umbrella/subtype handling — designer's binding choice

Unlike Family B (which has an explicit umbrella key
`disagreement_present`), Family C has **no umbrella key**. The 17
repair signals are independent observations along the
Schegloff/Sacks repair model + Clark & Brennan grounding doctrine
dimensions:

- 4 retroactive keys: `clarified` (lifecycle), `requests_clarification`,
  `answers_clarification`, `provides_alternate_interpretation`.
- 13 new keys organized in 5 conceptual cycles:
  1. **Candidate understanding cycle:** `offers_candidate_understanding` →
     {`confirms_understanding`, `rejects_candidate_understanding`}.
  2. **Restatement cycle:** `requests_restatement`.
  3. **Self/other repair cycle:** `self_initiates_self_repair`,
     `other_initiates_repair`, `acknowledges_misread`.
  4. **Ambiguity-flagging cycle:** `flags_ambiguous_reference`,
     `flags_term_ambiguity`.
  5. **Shared-definition cycle:** `proposes_shared_definition` →
     `confirms_shared_definition`.
  6. **Structural-mismatch cycle:** `scope_mismatch_identified`,
     `question_answer_mismatch`.

The prompt explicitly tells the model the relationships exist (via
the repair-positive note) but instructs it to answer each rawKey
independently with conservative-positives bias. No
auto-derivation in code; no umbrella cascade.

Rationale (mirroring Family B's choice):
- The model is the better judge of whether each repair signal is
  present.
- Conservative-positives bias floors the false-positive rate.
- Auto-cascading repair-cycle pairs would mask miscalibration of
  individual signals.

---

## 3. Fixture design (Phase A.3)

### Canonical / shape fixtures (response-side)

| Fixture | Purpose | Positive rawKeys (illustrative) |
| --- | --- | --- |
| `classify-argument-boolean-observations.family-c-canonical-response.json` | Full 17-key Family C response; multi-positive baseline | `offers_candidate_understanding` (true), `confirms_understanding` (true), all 15 others false |
| `classify-argument-boolean-observations.family-c-malformed-response.json` | Invalid response shape (missing `confidence` for a key in `observations`) | rejected by `validateMcpBooleanObservationResponse` with `path='confidence.<key>'` |
| `classify-argument-boolean-observations.family-c-ban-list-response.json` | Response with a smuggled verdict token in an `evidenceSpan` for `rejects_candidate_understanding` (the doctrine-risk anchor) | rejected by `scanFamilyCBooleanResponseForBanList` with `path='evidenceSpan.rejects_candidate_understanding'` |

### Per-scenario request fixtures (per intent brief §7 / Decision 3)

Designer-authored realistic dialogue; no real-world political
figures, no current events that age out. Each fixture follows the
`mcp-server/fixtures/classify-argument-boolean-observations.family-b-canonical-request.json`
shape — `{ tool, input }` wrapper. Designer-bound move/parent text
crafted to be unambiguous repair (or unambiguous non-repair, for the
no-repair adversarial fixture).

| Fixture | Input move text + parent text | Expected positives |
| --- | --- | --- |
| `classify-argument-boolean-observations.family-c-canonical-request.json` | Parent: "Libraries are infrastructure." Move: "Are you saying libraries are public goods that should be funded like roads? — let me make sure I have you right." | `offers_candidate_understanding` (high confidence) |
| `classify-argument-boolean-observations.family-c-clarification-cycle-request.json` | Parent (move at depth 2): "I asked what you meant by infrastructure." Move (depth 3, replying): "I mean public goods funded collectively — roads, libraries, parks. Anything provided through tax-funded commons rather than a market." | `answers_clarification` (high); possibly `requests_clarification` false |
| `classify-argument-boolean-observations.family-c-candidate-understanding-request.json` | Parent: "Are you saying libraries should be funded like public schools — because individual market provision fails?" Move: "Not quite — I mean libraries are like roads: collectively funded because the value is the network of access, not the individual transaction." | `rejects_candidate_understanding` (high), also `offers_candidate_understanding` true (the move offers its own corrected candidate) |
| `classify-argument-boolean-observations.family-c-shared-definition-request.json` | Parent: "Could we agree to use infrastructure to mean publicly-funded shared physical assets, for purposes of this discussion?" Move: "Works for me. Let us proceed with that definition." | `confirms_shared_definition` (high) |
| `classify-argument-boolean-observations.family-c-no-repair-request.json` | Parent: "Carbon taxes always reduce emissions; the BC data proves it." Move: "Carbon taxes work where enforcement is durable; Australia's was repealed before measurement, so the generalization is too strong." | (NONE — this is a Family B disagreement move; Family C classifier MUST return all 17 keys false. Proves the classifier doesn't over-fire on adversarial Family-B-content.) |

**Fixture #5 design intent:** The "no-repair" fixture is the
adversarial proof that Family C classifier is not misfiring on
content that belongs in Family B's `disputes_generalization` /
`disputes_scope` taxonomy. This is the equivalent of Family B's
"doctrine-stress" fixture, repurposed for cross-family
discriminator validation.

**Per intent brief §3 lifecycle note for `clarified`:** Designer
deliberately does NOT include a fixture where `clarified` is the
expected positive, because `clarified` requires cluster-level
context the MCP server's per-move call does not have. The
classifier MUST answer FALSE with low confidence for `clarified`
on every fixture per the prompt's lifecycle guard. This is
verified in `familyCDoctrineFixtures.test.ts`.

**Real-text sources:** Per intent brief §7 ("Use real-text examples
from seeded debates if available"). Designer's binding
recommendation: use synthesized text drawn from realistic library /
EV / climate / carbon-tax topics (same domain pool as Family B
fixtures for consistency); avoid live AI seeded text in this card
to keep fixtures deterministic and reproducible. Real seeded text
can be optionally substituted by the implementer if the topic
maps cleanly to a fixture's expected positives — but the design's
binding move text is the synthesized text in the table above.

---

## 4. Doctrine scan (Phase A.4)

### Mechanical copy

`mcp-server/lib/familyCBanListScan.ts` mirrors `familyBBanListScan.ts`
field-for-field:
* every `evidenceSpan` string (17 max — one per Family C rawKey)
* `modelInfo.serverName`
* `modelInfo.classifierSetVersion`

NOT scanned: `nodeId`, `schemaVersion`, `checkedRawKeys` entries,
`confidence` band values, `observations` boolean values — same
exclusions as Family A and Family B.

The ban-list pattern set comes from the shared
`mcp-server/lib/doctrineBanList.ts` constant
`DOCTRINE_BAN_PATTERNS` (consumed by Family A and Family B; reused
unchanged for Family C). No new banned patterns added per intent
brief §7 / Phase A.4.

### Doctrine-risk keys + verbatim guards

Four Family C keys carry specific doctrine framing risk; each gets
verbatim per-key guard text in the prompt entry's
`falsePositiveGuards` field plus a dedicated test in
`familyCDoctrineFixtures.test.ts`.

#### 4.1 `rejects_candidate_understanding` (doctrine risk: not "wrong")

**Source guard (familyC.ts:325-328):**
> "Do NOT mark TRUE without a candidate understanding in the parent
> to reject."
>
> "Do NOT confuse with disputes_interpretation — rejecting
> candidate understanding is repair-positive; interpretation
> dispute is adversarial."

**Prompt translation:** the per-rawKey `falsePositiveGuards` field
surfaces both guards verbatim, plus designer-bound additional
framing: "A rejection of a candidate understanding is the rejector
saying 'that is not what I meant,' not 'you are wrong.' It is
symmetric to confirms_understanding."

#### 4.2 `acknowledges_misread` (doctrine risk: not author-fault)

**Source guard (familyC.ts:482-485):**
> "Do NOT mark TRUE for moves that acknowledge a different
> participant's misread — this is about the author's own."
>
> "Do NOT mark TRUE for moves that signal disagreement framed as
> 'I had you wrong'."

**Prompt translation:** verbatim, plus designer-bound additional
framing: "Acknowledging a misread is constructive repair work, not
a verdict on the original author. Per
point-standing-economy, acknowledging a misread is engagement-
positive for the acknowledger and never reflects negatively on the
original."

#### 4.3 `flags_term_ambiguity` (doctrine risk: not "lazy writing")

**Source guard (familyC.ts:560-563):**
> "Do NOT mark TRUE for general clarification without identifying
> the ambiguous term."
>
> "Do NOT confuse with disputes_definition — flagging is
> collaborative; disputing is adversarial."

**Prompt translation:** verbatim, plus designer-bound additional
framing: "Flagging an ambiguous term opens shared understanding;
it does NOT accuse the parent author of writing ambiguously or
imprecisely. Both participants benefit from the shared definition
that emerges."

#### 4.4 `clarified` (lifecycle; tree-dependency caveat)

**Source guard (familyC.ts:78-81):**
> "Do NOT mark TRUE based on cosmetic tone — the lifecycle
> transition requires an actual clarifying response."
>
> "Do NOT confuse with answers_clarification (the move-level fact)
> — clarified is the cluster-level state."

**Prompt translation:** verbatim, PLUS the designer-bound
lifecycle tree-dependency guard in the user prompt (§2 above —
mirror of Family A's `has_rebuttal` / `has_counter_rebuttal` /
`rebutted` treatment): the model answers FALSE with low confidence
when only move text is visible.

### Cross-key doctrine constraint

All 17 misunderstanding-repair outputs remain descriptive structural
facts (per cdiscourse-doctrine §10a). Per-rawKey prompt-entry text
MUST NOT contain the words `winner`, `loser`, `correct`, `wrong`,
`truth`, `liar`, `fallacy`, `bad faith`, `extremist`,
`propagandist` except when negating them (mirroring the system-prompt
negation pattern and Family A/B precedent).

The 17 source entries in `familyC.ts` already conform — the
`doctrineNotes` arrays each anchor on cdiscourse-doctrine §10a,
Schegloff/Sacks, or Clark & Brennan, and note "repair-positive" /
"engagement-positive" / "structural" — never a verdict on the move's
author.

### Family C-specific doctrine test assertions

Per intent brief §7 Phase A.4, the following assertions appear in
`familyCDoctrineFixtures.test.ts` and `familyCPromptDoctrine.test.ts`:

| Assertion | Where it lives |
| --- | --- |
| No repair-as-failure framing in any per-key prompt entry | `familyCPrompt.test.ts` (string scan over the rendered user prompt for tokens `fail`, `failure`, `failed_to`) |
| No error-correction framing in any per-key prompt entry | `familyCPrompt.test.ts` (string scan for `error`, `mistake`, `mistakes`, `errors` as standalone descriptive terms in definitions) |
| No candidate-understanding-rejection-as-wrong framing | `familyCDoctrineFixtures.test.ts` (specific fixture: `rejects_candidate_understanding` positive evidenceSpan must NOT contain `wrong`, `incorrect`, `not right`) |
| No misunderstanding-as-author-fault framing | `familyCDoctrineFixtures.test.ts` (specific fixture: `acknowledges_misread` positive evidenceSpan must NOT contain `you confused me`, `you were unclear`, `your fault`, `bad writing`) |

The ban-list scan covers `winner` / `loser` / `correct` / etc. via
the shared `DOCTRINE_BAN_PATTERNS`; the four Family C-specific
assertions cover the framing risks unique to repair semantics that
ban-list patterns don't capture.

### Future-card hook

If the operator wants to add Family-C-specific ban patterns (e.g.,
"failed to" / "your fault" as bare phrases; "lazy writing"; pejorative
shape labels), that lives in a follow-on observability card (referenced
by intent brief §9 Phase 7 as `OPS-MCP-OBSERVABILITY`), not here.

---

## 5. Test plan (Phase A.5)

### Test forecast: +95 to +115 new tests (midpoint ~105)

Family B forecast was +80 to +110 (observed +107 per Family B
smoke audit Phase 2). Family C has 17 keys vs Family B's 14 keys
(+21% more entries), so the proportional forecast lands at
roughly +95 to +115. HALT trigger #16 fires at +300; well clear.

**HALT trigger #16 NOT fired.**

Per-file forecast:

| File | NEW / UPDATED | Test count (est) | Coverage |
| --- | --- | --- | --- |
| `mcp-server/tests/familyCKeys.test.ts` | NEW | 7-8 | `FAMILY_C_RAW_KEYS` has 17 entries; binding list match; no extras; no dupes; `FAMILY_C_PROMPT_ENTRIES` has 17 entries; every entry has required verbose fields; `FAMILY_C_CLASSIFIER_SET_VERSION === 'family-c-v1'`. Mirrors `familyBKeys.test.ts` pattern. |
| `mcp-server/tests/familyCKeysParity.test.ts` | NEW | 2-3 | Server-side rawKey literals all appear in upstream `familyC.ts`; upstream file has exactly 17 rawKey declarations and all are in server-side constant; cross-family A∩C and B∩C are empty (HALT #14 guard). |
| `mcp-server/tests/familyCPrompt.test.ts` | NEW | 17-19 | System prompt contains 7 absolute-rules verbatim (byte-equal to Family A and Family B); system prompt contains repair-positive framing; user prompt builder happy path; user prompt builder with subset of keys; user prompt builder with empty requestedRawKeys (returns all 17); rawKeys filter rejects non-Family-C keys; banned-token negation check on system prompt (no banned tokens outside doctrine-positive negations); `FAMILY_C_MAX_TOKENS === 1500`; `FAMILY_C_TEMPERATURE === 0`; user prompt includes `clarified` lifecycle note; user prompt includes repair-positive cross-key framing note; user prompt asserts all 17 rawKeys present in questions block; `rejects_candidate_understanding` prompt entry surfaces doctrine guard verbatim; `acknowledges_misread` prompt entry surfaces doctrine guard verbatim; `flags_term_ambiguity` prompt entry surfaces doctrine guard verbatim; `clarified` prompt entry surfaces doctrine guard verbatim; no repair-as-failure framing scan; no error-correction framing scan. Mirrors `familyBPrompt.test.ts` (17 tests) + adds 4 doctrine-risk-specific assertions. |
| `mcp-server/tests/familyCAnthropic.test.ts` | NEW | 10 | Happy path, key_missing, HTTP 429, HTTP 500, TimeoutError, non-JSON response, plain prose (no JSON object), API key never appears in success log line, API key never appears in failure log line, logs tagged with `classify_argument_boolean_observations`. Mirrors `familyBAnthropic.test.ts` test-by-test. |
| `mcp-server/tests/familyCBanListScan.test.ts` | NEW | 15-16 | Clean response ok=true; evidenceSpan with each banned token (winner, loser, verdict, truth, liar, bad faith, extremist, manipulative, propagandist, correct, incorrect, dishonest); modelInfo.serverName with banned token; modelInfo.classifierSetVersion with banned token; null evidenceSpan values skipped; "proof of" two-word phrase detected; neutral compound words not flagged. Mirrors `familyBBanListScan.test.ts` test-by-test. |
| `mcp-server/tests/familyCFixtureParity.test.ts` | NEW | 13-14 | Canonical-response fixture passes validator + ban-list; all fixture responses use rawKeys in `FAMILY_C_RAW_KEYS`; malformed fixture fails validator at expected path; ban-list fixture fails ban-list scan at expected path; all 5 per-scenario request fixtures pass `validateFamilyBooleanRequest` (canonical / clarification-cycle / candidate-understanding / shared-definition / no-repair). Mirrors `familyBFixtureParity.test.ts`. |
| `mcp-server/tests/familyCResponseValidator.test.ts` | NEW | 16-18 | Happy path 17-key Family C response; rejects wrong schemaVersion; rejects missing required fields; rejects wrong shape for observations / confidence / evidenceSpan; rejects flag_count_too_high (>20); rejects modelInfo without provider="mcp"; rejects unknown rawKey in checkedRawKeys; accepts evidenceSpan strings up to 240 chars; rejects evidenceSpan strings > 240 chars; accepts confidence in {low, medium, high}; rejects confidence values outside that set. Mirrors `familyBResponseValidator.test.ts` (16 tests) for 17-key universe. |
| `mcp-server/tests/familyCDispatch.test.ts` | NEW | 10-11 | Mock-fetch dispatcher tests: Family C request routes to Family C Anthropic; Family A request still routes to Family A Anthropic; Family B request still routes to Family B Anthropic; Family C request invokes Family C ban-list scan (not A or B); all three ban-list scans return ok=true for clean responses; 3-way cross-family rejection (Family A key under misunderstanding_repair → reject; Family B key under misunderstanding_repair → reject; Family C key under parent_relation → reject; Family C key under disagreement_axis → reject); dispatcher returns unsupported_family for unregistered family; resolved-family log tag present; fixture provider routing for Family C. Mirrors `familyBDispatch.test.ts` + adds the 4 cross-family combinations. |
| `mcp-server/tests/familyCDoctrineFixtures.test.ts` | NEW | 8-10 | `rejects_candidate_understanding` no-wrong-framing fixture: positive does NOT contain `wrong` / `incorrect` / `not right` in evidenceSpan; `acknowledges_misread` no-author-fault fixture: positive does NOT contain `your fault` / `you were unclear` / `bad writing` in evidenceSpan; `flags_term_ambiguity` no-accusation fixture: positive does NOT contain `lazy` / `imprecise` / `careless` in evidenceSpan; `clarified` lifecycle constraint: every fixture except a designed cluster-context fixture returns false for `clarified` with low confidence; no-repair adversarial fixture: all 17 keys false (proves classifier discrimination); offers_candidate_understanding + confirms_understanding cycle fixture (both positive); offers + rejects fixture (both positive). |
| `mcp-server/tests/familyRegistryInit.test.ts` | UPDATED | +3 | Add: `familyRegistryInit-registers-family-c-on-import` (`isFamilySupported('misunderstanding_repair')` true); `familyRegistryInit-registers-all-three-families-in-order` (`getSupportedFamilies()` returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair']` exact); `familyRegistryInit-family-c-has-17-rawKeys`. |
| `mcp-server/tests/familyRegistry.test.ts` | UPDATED | +3 | Add: `registry-getSupportedFamilies-preserves-three-family-order`; `registry-isRawKeySupportedForFamily-three-way-cross-family-rejection` (A key under C reject; B key under C reject; C key under A reject; C key under B reject); `registry-getRawKeysForFamily-misunderstanding_repair-17-keys`. |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | UPDATED | +6-8 | Add: valid Family C request passes; Family C request with rawKey subset passes; Family C request with empty requestedRawKeys passes; Family C request with empty requestedFamilies + Family C rawKey REJECTS (byte-equal-preservation default routes to Family A which doesn't include Family C keys); cross-family rejection (Family A rawKey under misunderstanding_repair); cross-family rejection (Family B rawKey under misunderstanding_repair); cross-family rejection (Family C rawKey under disagreement_axis); regression: valid Family A and Family B requests still pass. |
| Jest: 1-2 small parity tests for the Edge `familyRegistry` Family C entry | NEW (one Jest test added to existing suite if applicable, OR new file under `__tests__/`) | 2 | Assert `EDGE_FAMILY_REGISTRY` Family C entry has `productionEnabled: false` AND `adminValidationEnabled: true`; assert `adminValidationEnabledFamilies()` returns Family C. **Note:** `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` (lines 36-100) already asserts this on a 10-family fixed list — the design will add 1-2 reinforcing tests near the existing assertions to underscore the Family C readiness state OR add an inline doc comment confirming the existing tests pin Family C; designer recommends 1 small test asserting `productionEnabled: false` specifically for `misunderstanding_repair`. |

**Subtotal:** 8 + 3 + 18 + 10 + 16 + 14 + 17 + 11 + 9 + 3 + 3 + 7 + 2 = **121 new tests** (upper-band estimate). Range: **+95 to +115** (with midpoint ~105 after accounting for natural test-count variance during implementation).

**Note on the upper band:** the forecast may settle slightly under the
+121 upper estimate if the implementer chooses to fold Family C
cross-family rejection tests into existing `familyRegistry.test.ts`
expectations rather than adding new tests, or if the dispatcher tests
are tightened. The HALT threshold (+300) is comfortably clear; the +95
lower bound is the binding minimum for "tests are part of done".

### Doctrine ban-list assertion coverage

`familyCPrompt.test.ts` asserts the system prompt's literal text
contains the 7 absolute-rules negation pattern and NO bare banned
tokens. Mirrors Family A/B precedent.

`familyCBanListScan.test.ts` asserts the runtime scan rejects every
banned-token shape in evidenceSpans, modelInfo.serverName, and
modelInfo.classifierSetVersion.

`familyCDoctrineFixtures.test.ts` asserts the 4 doctrine-risk fixtures
behave as designed (no wrong-framing on `rejects_candidate_understanding`;
no author-fault framing on `acknowledges_misread`; no accusation on
`flags_term_ambiguity`; `clarified` lifecycle returns false with low
confidence in the no-cluster-context fixtures).

### Verification gates (per intent brief §8)

```
npm run typecheck
npm run lint
cd mcp-server && deno test --allow-net --allow-env --allow-read
cd ..
npx jest __tests__/mcpOneTwoOneC __tests__/mcpOneTwoOneB __tests__/uxOneOneFiveA
npm test
```

All exit 0. The Jest sweep is a regression check that the existing
MCP-021B persistence + MCP-021C runtime spine + UX-001.5A
node-label primitive layer all continue to pass against the
post-Family-C tree. None of those test surfaces are directly
touched by Family C but they share the upstream taxonomy and the
Edge familyRegistry — the existing
`mcpOneTwoOneCEdgeFamilyRegistry.test.ts` already enforces the
Family C entry's expected shape, so any regression there is the
canary.

---

## 6. Smoke plan (Phase A.6)

### 8-phase smoke matching Family B's pattern

Per intent brief §9, the smoke is operator-run after the PR merges
to `main` and Deno Deploy auto-deploys the post-merge build. Audit
file: `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-<date>.md`.

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

Expected: **438-458 / 0** (343 baseline post-Family-B + ~95-115
new Family C tests). Family A still passes. Family B still passes.

### Phase 3 — Hosted MCP server smoke (13 checks; OPERATOR-RUN)

This phase requires `MCP_HOSTED_TOKEN` (operator-territory).
Standard pattern from prior smokes:

```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected output:

```
HOSTED SMOKE EXIT: 0
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]

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

MCP-SERVER-001 smoke: 13 PASSES, 0 FAILS
EXIT: 0
```

The 2 new Family C checks specifically verify:

* Check 12: hosted server returns a Family C response whose
  `modelInfo.classifierSetVersion === 'family-c-v1'`.
* Check 13: `tools/call` against `classify_argument_boolean_observations`
  with a Family C request returns a structured response whose
  `modelInfo.classifierSetVersion === 'family-c-v1'`.

#### New check 12: `[12-compat-boolean-family-c]`

```bash
# ── Check 12: POST /mcp/adapter-compat with VALID bearer + boolean (Family C) ──
# MCP-SERVER-004-FAMILY-C promoted Family C from unsupported to real. The request body
# uses Family C rawKeys (misunderstanding_repair family). Response shape MUST be a
# real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (17 keys for Family C canonical)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-c-v1'
CHECK_NAME="12-compat-boolean-family-c"
BOOLEAN_C_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-c-001","parentNodeId":"fixture-node-parent-c-001","currentText":"[fixture] Are you saying libraries are public goods that should be funded like roads? — let me make sure I have you right.","parentText":"[fixture] Libraries are infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["misunderstanding_repair"],"requestedRawKeys":["offers_candidate_understanding","confirms_understanding","rejects_candidate_understanding"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family C)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_C_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-c-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family C response shape. Got: $RESPONSE"
fi
```

#### New check 13: `[13-mcp-tools-call-boolean-family-c]`

```bash
# ── Check 13: POST /mcp tools/call classify_argument_boolean_observations (Family C) ──
# MCP-SERVER-004-FAMILY-C. Same body + same assertion pattern as Check 12, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="13-mcp-tools-call-boolean-family-c"
BOOLEAN_C_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-4","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-c-001","parentNodeId":"fixture-node-parent-c-001","currentText":"[fixture] Are you saying libraries are public goods that should be funded like roads? — let me make sure I have you right.","parentText":"[fixture] Libraries are infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["misunderstanding_repair"],"requestedRawKeys":["offers_candidate_understanding","confirms_understanding","rejects_candidate_understanding"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family C)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_C_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-c-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family C tool result. Got: $RESPONSE"
fi
```

OPERATOR HALT: Phase 3 requires operator action (token). After
operator pastes redacted PASS output, continue to Phase 4.

### Phase 4 — Edge `admin_validation` smoke (Family C)

Acquire bot JWT (env-backed, per prior smokes).

POST to Edge `classify-argument-boolean-observations`:

```json
{
  "argumentIds": [
    "f41b18b0-8ad6-4865-94c5-17a568f6a6ad",
    "781f8057-9e2a-4fa9-92a8-469676950ff7",
    "db0de3e0-24c6-40af-ba5f-2844acfa5bac"
  ],
  "requestedFamilies": ["misunderstanding_repair"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

Expected:

* HTTP 200.
* 3 `perArgument` entries.
* All `status=success`.
* `positiveObservationCount >= 0` for each arg.
* `raw_keys ∈ Family C 17-key set` for any positive.
* No `mcp_validation_failed` envelope.

**Per intent brief Decision 9 (binding):** **0 Family C positives
across all 3 seeded args is an acceptable PARTIAL outcome.** The
seeded args (`f41b18b0-…`, `781f8057-…`, `db0de3e0-…`) were
designed for Family A (`parent_relation`) and have demonstrated
Family B (`disagreement_axis`) positives on arg2 and arg3
(disputes_*). They were NOT designed for repair patterns.
Classifier silence on non-repair-targeted text is a valid PASS for
the pipeline (the chain Edge → MCP → Family C Anthropic →
ban-list scan → persistence is verified by HTTP 200 + valid
response shape).

If the operator wishes to verify positive Family C signal, they
may optionally seed a fresh debate room with explicit repair
patterns (e.g., a clarification request + an answers_clarification
response; an offers_candidate_understanding + confirms_understanding
cycle) — but designer's binding recommendation is to NOT seed
fresh args in this card. Fresh-room seeding for repair signal
quality belongs in a follow-on OPS observability card.

### Phase 5 — Unsupported D/E/F/G/H/I/J rejection regression

POST to `classify-argument-boolean-observations` with each of
the 7 unsupported families against arg2:

| Family | Expected response |
| --- | --- |
| D — `evidence_source_chain` | HTTP 200; status=`failed`; `failureReason=mcp_validation_failed`; 0 positives; empty rawKeys |
| E — `argument_scheme` | same |
| F — `critical_question` | same |
| G — `resolution_progress` | same |
| H — `claim_clarity` | same |
| I — `thread_topology` | same |
| J — `sensitive_composer` | same |

Each should reject at the MCP server's registry boundary (the
`unsupported_family` error envelope, which the Edge adapter maps to
`validation_failed` → persisted `failureReason: 'mcp_validation_failed'`).

No Family A, B, or C keys leaked.

### Phase 6 — Targeted regression suites

```
npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA)"
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

Expected: all exits 0.

### Phase 7 — OPS observations

* 3 families now operational on hosted MCP server.
  - Family A: production + auto-trigger live.
  - Family B: `admin_validation` only.
  - Family C: `admin_validation` only.
* `OPS-MCP-OBSERVABILITY` priority: STRONGLY RECOMMENDED as next
  OPS card (3 families is the threshold where ad-hoc SQL
  inspection becomes painful).

### Phase 8 — Verdict + authorization

* **PASS criteria:**
  * Phases 1-2 clean.
  * Phase 3 = 13/13.
  * Phase 4 = HTTP 200; valid Family C response shape; raw_keys ⊆
    Family C 17-key set.
  * Phase 5 = all 7 unsupported families correctly rejected.
  * Phase 6 = all regressions pass.

* **PARTIAL:**
  * Phase 4 returns 0 positives across all 3 args (per Decision 9
    — acceptable; documented but doesn't fail smoke).
  * Phase 6 single-suite regression independent of Family C.

* **FAIL:**
  * Phase 3 < 13 checks pass.
  * Phase 4 returns non-Family-C raw_keys (taxonomy violation).
  * Phase 5 any unsupported family accepted (security adjacent).
  * Phase 6 broad regression (Family A or B byte-equal failure).

* **Authorization after PASS:**
  * `MCP-SERVER-004-FAMILY-C-SMOKE: PASS`.
  * Family C `admin_validation` OPERATIONAL.
  * `MCP-SERVER-005-FAMILY-D` AUTHORIZED to begin — with
    mandatory Stage-2B operator-decision checkpoint for the
    ai_classifier subset filter decision (per inspection report;
    Family D is the design-heavy family with compound-key
    collision question).
  * `OPS-MCP-OBSERVABILITY` STRONGLY RECOMMENDED to ship before D
    (3 families operational; per-family telemetry now valuable).

* **If PARTIAL:** File scoped fix card. Do NOT begin Family D until
  smoke clean.

* **If FAIL:** File `MCP-SERVER-004-FAMILY-C-FIX`. Do NOT begin
  Family D until refactor stable. Consider revert if Family A or B
  regression detected.

---

## 7. Read-only boundaries (files this card DOES NOT touch)

Per intent brief §5 + §7.3, plus additions surfaced during Phase A:

* `mcp-server/lib/familyAPrompt.ts`
* `mcp-server/lib/familyAAnthropic.ts`
* `mcp-server/lib/familyABanListScan.ts`
* `mcp-server/lib/familyAFixtureProvider.ts`
* `mcp-server/lib/familyAKeys.ts`
* `mcp-server/lib/familyBPrompt.ts`
* `mcp-server/lib/familyBAnthropic.ts`
* `mcp-server/lib/familyBBanListScan.ts`
* `mcp-server/lib/familyBFixtureProvider.ts`
* `mcp-server/lib/familyBKeys.ts`
* `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`
* `mcp-server/lib/seedPrompt.ts`
* `mcp-server/lib/familyRegistry.ts` (the registry primitive — no shape change)
* `mcp-server/lib/anthropicCall.ts` (shared Anthropic wrapper — Family C reuses unchanged)
* `mcp-server/lib/doctrineBanList.ts` (shared pattern set — Family C reuses unchanged)
* `mcp-server/lib/logging.ts` (logging primitive — Family C reuses unchanged)
* `mcp-server/lib/familyBooleanRequestSchema.ts` (shared validator — no shape change; Family C surfaces additively via the registry)
* `mcp-server/lib/toolDispatch.ts` / `toolRegistry.ts` / `bootstrap.ts` (per OPS refactor §8 recommendation)
* `mcp-server/scripts/validate-family-a-response.ts`, `validate-family-b-response.ts` (Family A and B validators unchanged; Family C may get its own optional script — designer recommends NOT to add it this card to keep diff minimal)
* `mcp-server/tests/familyA*.test.ts` (existing Family A tests untouched)
* `mcp-server/tests/familyB*.test.ts` (existing Family B tests untouched)
* `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` (the existing dispatcher integration test — designer's note: this MAY need a 1-line update if the test depends on the tool description text; designer recommends checking during implementation but expects no logic change)
* `mcp-server/tests/classifyArgumentBooleanObservationsSourceScan.test.ts` (source-scan; should be unchanged)
* `mcp-server/tests/adapterCompat.test.ts`, `mcp-server/tests/jsonRpc.test.ts`, etc. — unchanged
* `src/features/nodeLabels/**` (upstream taxonomy; locked per intent brief §5)
* **`supabase/functions/_shared/booleanObservations/familyRegistry.ts`** — **already has the Family C entry** (lines 73-77 per MCP-021C-EDGE shipping); intent brief §5 explicitly forbids any Edge edit. Locked.
* `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` and all other Edge files — locked per intent brief §5.
* `supabase/migrations/**` (no migration in this card)
* Any file under `app/`, `src/features/argumentScoring/`,
  `src/features/sourcing/`, etc. (UI / scoring / source-chain;
  unrelated)

---

## 8. HALT trigger table (all 22 from intent brief §6)

| # | Trigger | Assessment |
| - | ------- | ---------- |
| 1 | `OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE` audit PASS missing from main | PASS — confirmed at `21f1b0b` per intent brief §1 sequencing chain; verified via `git log` |
| 2 | `MCP-SERVER-003-FAMILY-B-SMOKE` audit PASS missing from main | PASS — confirmed at `05b42c3`; audit at `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md` |
| 3 | Family C raw key list differs from MCP-021A source | PASS — Phase A.1 cross-check shows 17/17 verbatim match against `familyC.ts` declaration order; `familyCKeysParity.test.ts` enforces |
| 4 | Any Family D / E registration proposed in this card | PASS — design §1 IN-scope registers only `misunderstanding_repair`; HALT triggered by reviewer if implementer adds D-J |
| 5 | Family A or Family B behavior changes proposed (not byte-equal) | PASS — `familyA*.ts` and `familyB*.ts` listed in §7 lockout; registry usage already byte-equivalent per Family B smoke baseline |
| 6 | `unsupported_family` behavior for D-J changes | PASS — registry has only `parent_relation` + `disagreement_axis` + `misunderstanding_repair` after init; D-J remain unsupported; validator rejects at the registry layer |
| 7 | Proposes new taxonomy keys | PASS — design adds zero new keys; Family C mirrors MCP-021A's existing 17 keys verbatim |
| 8 | Proposes MCP schema version change | PASS — `mcp-021.machine-observations.boolean.v1` constant stays; explicitly out-of-scope per §1 |
| 9 | Proposes Family A or Family B prompt changes | PASS — `familyAPrompt.ts` and `familyBPrompt.ts` listed in §7 lockout |
| 10 | Proposes client-side MCP call (no `src/` changes) | PASS — design is server-side only (`mcp-server/lib/**`); no `src/` or `app/` file touched |
| 11 | Proposes exposing MCP bearer / Anthropic / service-role keys | PASS — Family C Anthropic wrapper reuses the existing `callAnthropic` (proven safe by `anthropicNoLogging.test.ts`); no secret in any new file; `familyCAnthropic.test.ts` includes the same API-key-never-logged tests as Family A/B |
| 12 | Logs raw argument body, raw prompt, raw model response, bearer token, or API key | PASS — all log calls reuse the existing `log(...)` helper from `logging.ts` (which strips secrets); per-family `family: 'misunderstanding_repair'` tag added at the 3 warn paths (no body / prompt / response logged) |
| 13 | Hosted smoke fails (runtime; re-evaluated post-implementer) | NOT KNOWN AT DESIGN TIME — design plans 2 new PASS checks (Check 12, Check 13); operator runs smoke post-merge; HALT triggered only if real smoke fails |
| 14 | Family C requires schema mirror change (compound-key collision) | PASS — Phase A.1 cross-family-key collision check confirms Family A ∩ Family C = ∅ and Family B ∩ Family C = ∅; no collision; compound-key problem deferred to Family D as intent brief §6 anticipated |
| 15 | Family C requires MAX_TOKENS bump | PASS — §2 token-budget audit shows 17 keys × ~85 output tokens = ~1445; fits in 1500 with ~3.7% headroom; no bump proposed; risk surfaced as a TELEMETRY-driven OPS observability follow-on |
| 16 | Test forecast exceeds +300 without rationale | PASS — forecast +95 to +115 (midpoint ~105) with per-file breakdown in §5; well under HALT threshold |
| 17 | Prompt frames repair as "correct" vs "incorrect" understanding | PASS — §2 system prompt explicitly says "Repair is collaborative grounding work; both sides remain valid contributors to the discussion"; per-key entries inherit descriptive framing from `familyC.ts`'s positiveDefinition/negativeDefinition/falsePositiveGuards arrays; `familyCPrompt.test.ts` asserts no `correct` / `incorrect` outside negation form |
| 18 | Prompt treats `rejects_candidate_understanding` as negative | PASS — §4.1 doctrine guard surfaces source guard verbatim; designer-bound additional framing explicitly says "the rejector is saying 'that is not what I meant,' not 'you are wrong.' It is symmetric to confirms_understanding"; `familyCDoctrineFixtures.test.ts` includes a fixture-level assertion |
| 19 | Verdict / winner / correctness / fallacy / bad-faith tokens in user-facing strings (except negation) | PASS — system prompt mirrors Family A/B's 7 absolute rules verbatim (negation form only); per-key entries are model-facing only (not user-facing); ban-list scan blocks model responses with verdict tokens; this document references the tokens in design discussion only, per CLAUDE.md doctrine-discussion exception |
| 20 | Raw keys appear in user-facing copy | PASS — server-side classifier returns rawKeys to Edge; no UI surface in this card; ban-list scan blocks rawKey leak into evidenceSpans (the only model-controlled string field) |
| 21 | Prompt implies misunderstanding is a failure on either side | PASS — §2 system prompt's "Repair is collaborative grounding work; both sides remain valid contributors" line and the §2 repair-positive cross-key note explicitly disclaim fault attribution; `familyCDoctrineFixtures.test.ts` asserts no `failure` / `failed` / `your fault` / `you confused me` framing on `acknowledges_misread` and related |
| 22 | Unclassified untracked files at PR creation | NOT KNOWN AT DESIGN TIME — operator-territory exclusions (`docs/testing-runs/`, `mcp021c-edge-smoke-*`, `netlify-prod.git`, `phase5-mcpserver002-*`) are KNOWN per intent brief §6; implementer + reviewer enforce |

**Active HALT risk:** none at design time. Triggers 13 and 22 are
runtime-only (Phase 3+ operator smoke) and cannot fire at design
phase. All other 20 triggers PASS.

---

## 9. Brief ledger

| File | Why it matters | In-scope / Out-of-scope |
| --- | --- | --- |
| `docs/designs/MCP-SERVER-004-FAMILY-C-intent.md` | Operator-authored binding spec; §3 17-key list, §4 doctrine framing, §5 scope, §6 22 HALTs, §7 Phase A audits | binding for this card |
| `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md` | Family B PASS smoke; pattern source for Family C smoke; demonstrates 2-family registry works | binding precedent |
| `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md` | Registry shared-validator preservation proof | binding precedent |
| `docs/designs/MCP-SERVER-003-FAMILY-B.md` | Family B design; pattern source for Family C design | reference template |
| `src/features/nodeLabels/machineObservationDefinitions/familyC.ts` | Source-of-truth for 17 rawKeys + doctrine guards | READ ONLY (locked per §5 of intent brief); mirrored byte-equally into `mcp-server/lib/familyCKeys.ts` |
| `src/features/nodeLabels/nodeLabelTypes.ts` | `MachineObservationFamily` union (confirms `'misunderstanding_repair'` is binding) | READ ONLY |
| `src/features/nodeLabels/mcpBooleanObservationSchema.ts` | Wire shape Family C must conform to; schemaVersion constant | READ ONLY |
| `mcp-server/lib/familyRegistry.ts` | Shared registry primitive; OPS refactor put it in place for additive registrations | READ ONLY (no shape change); USED in registration |
| `mcp-server/lib/familyRegistryInit.ts` | One-line addition site | EDIT (Family C register call) |
| `mcp-server/lib/familyAKeys.ts` | Pattern for Family-specific keys file | READ ONLY (pattern template); MIRROR for `familyCKeys.ts` |
| `mcp-server/lib/familyBKeys.ts` | Closer pattern reference (matches Family C's structure) | READ ONLY (pattern template); MIRROR for `familyCKeys.ts` |
| `mcp-server/lib/familyAPrompt.ts` | Pattern for prompt file; provides 7 absolute rules + lifecycle precedent | READ ONLY (pattern template); MIRROR for `familyCPrompt.ts` |
| `mcp-server/lib/familyBPrompt.ts` | Direct pattern reference | READ ONLY (pattern template); MIRROR for `familyCPrompt.ts` |
| `mcp-server/lib/familyBAnthropic.ts` | Direct pattern reference for Anthropic orchestrator | READ ONLY; MIRROR for `familyCAnthropic.ts` |
| `mcp-server/lib/familyBBanListScan.ts` | Direct pattern reference for ban-list scan | READ ONLY; MIRROR for `familyCBanListScan.ts` |
| `mcp-server/lib/familyBFixtureProvider.ts` | Direct pattern reference for fixture provider | READ ONLY; MIRROR for `familyCFixtureProvider.ts` |
| `mcp-server/lib/familyBooleanRequestSchema.ts` | Shared validator; already family-aware | READ ONLY (no shape change); behavior verified by Phase A and intent brief §7 |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | Tool dispatcher; needs per-family provider routing | EDIT (per §1 — extend `pickFamilyProviders` table; update tool description; add `imports`) |
| `scripts/mcp-server-001-smoke.sh` | Hosted smoke script; needs Family C checks | EDIT (per §6: 2 new checks; tally becomes 13) |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | Edge Function family enablement gate; **already contains Family C entry** at lines 73-77 (`productionEnabled: false, adminValidationEnabled: true`) | READ ONLY (no edit needed AND no edit allowed per intent brief §5) |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` | Edge familyRegistry Family C entry already asserted at FR-4 (line 47) and FR-9 (line 91) | READ ONLY (existing test coverage); design's Jest small test (§5) may add 1 reinforcing assertion |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Edge Function classifier core; consumes the family gate | READ ONLY |
| `mcp-server/tests/familyA*.test.ts` | Existing Family A tests; must continue to pass post-card | READ ONLY (regression coverage) |
| `mcp-server/tests/familyB*.test.ts` | Existing Family B tests; must continue to pass post-card | READ ONLY (regression coverage) |
| `mcp-server/tests/familyRegistry.test.ts` | Registry primitive tests | EDIT (+3 tests for real Family C registration + 3-way cross-family rejection) |
| `mcp-server/tests/familyRegistryInit.test.ts` | Init module tests | EDIT (+3 tests for Family C registration on import) |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | Shared validator tests | EDIT (+6-8 tests for Family C request shapes) |
| `docs/core/current-status.md` | Handoff section | EDIT (post-implementation; update test count) |

### Decision provenance ledger (orchestrator-authored brief context)

Per the multi-card chain protocol the parent agent operates under,
this design ledger flags interpretive choices the designer made
when the intent brief gave latitude:

| Decision | Source | Resolution |
| --- | --- | --- |
| 1 — fixture move-text content | Intent brief §7 Phase A.3 says "Use real-text examples from seeded debates if possible (parallel to Family B's approach)" | Designer chose synthesized library / EV / climate / carbon-tax text aligned with Family B's domain pool. Implementer may substitute real seeded text if available and preserves expected positives. |
| 2 — test forecast +121 upper bound vs intent's +60-100 | Intent brief §5 forecasts "+60 to +100" but Family B observed +107 and Family C has 17 keys (more than B's 14) | Designer forecasts +95 to +115 (midpoint ~105). HALT threshold (+300) clear. Implementer may land slightly below if test files consolidate; +95 is the binding minimum. |
| 3 — Edge familyRegistry small Jest test | Intent brief §7 Phase A.5 says "Jest side: 1-2 small parity tests for Edge familyRegistry Family C entry" | Designer recommends adding 1 small assertion-test confirming `misunderstanding_repair` has `productionEnabled: false` AND `adminValidationEnabled: true`, because the existing test `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts:FR-4/FR-9` asserts the registry array shape but doesn't independently anchor "Family C is admin_validation-only" as a freestanding assertion. If the implementer judges the existing FR-9 sufficient, this test can be omitted; the test count drops by 1-2 in that case. |
| 4 — repair-positive cross-key framing note in user prompt | Intent brief §4 specifies what the framing should accomplish but doesn't bind exact wording | Designer authored the specific 5-sentence note in §2; reflects "rejector ≠ wrong," "acknowledger ≠ failed," "flagger ≠ accusing," "scope mismatch ≠ fault." Implementer may revise wording but must preserve all 4 anchors. |
| 5 — `clarified` lifecycle guard wording | Intent brief §4.3 specifies the guard exists but not exact wording | Designer mirrored Family A's `has_rebuttal`/`has_counter_rebuttal`/`rebutted` guard wording verbatim adapted for the single-key `clarified` case. Implementer may tighten but must preserve "FALSE with low confidence" semantics. |
| 6 — fixture 5 (`no-repair`) move text source | Intent brief §7 Phase A.3 says proves classifier doesn't over-fire on adversarial Family B content | Designer reused the exact carbon-tax / generalization-dispute move from Family B's `family-b-multi-axis-request.json` fixture for cross-family discriminator clarity. |
| 7 — designer's decision NOT to add `validate-family-c-response.ts` | Family A and Family B each have a one-off validator script; the pattern suggests Family C might too | Designer chose NOT to add this script to keep diff minimal. The Deno test surface (`familyCResponseValidator.test.ts`) covers the validation; the script is a CLI convenience that hasn't been operator-required. Implementer may add it if requested. |

**Operator-deferred review** (post-ship items the operator may
choose to revisit):

- Whether the +95 lower-bound test forecast is met or exceeded
  (Phase 6 regression suite reports the count).
- Whether to add `validate-family-c-response.ts` parallel to A/B
  validators (decision deferred to implementer / operator).
- Whether the prompt's "0 to 2 repair signals" guidance produces
  reasonable signal density in real corpus (telemetry from
  Phase 4 + future admin_validation calls informs).
- Whether the `clarified` lifecycle-guard FALSE bias is too
  conservative (may require operator-seeded cluster fixtures to
  produce a positive `clarified` signal in future smokes).

---

## 10. Operator steps (if any)

Per intent brief §9 (smoke plan; operator-run):

After the implementer's PR merges to `main`:

1. Confirm Deno Deploy auto-deploy completed (hosted MCP server
   `/health` shows post-merge build).
2. Run hosted smoke:
   ```bash
   bash scripts/mcp-server-001-smoke.sh \
     --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
     --token <hosted-bearer-token>
   ```
   Expect `13 PASSES, 0 FAILS` / `EXIT: 0`.
3. Acquire admin JWT (same pattern as Family B smoke Phase 4):
   ```bash
   curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
     -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
     -d '{"email":"$CDISCOURSE_ADMIN_EMAIL","password":"$CDISCOURSE_ADMIN_PASSWORD"}'
   ```
4. POST to Edge `classify-argument-boolean-observations` with
   `requestedFamilies: ['misunderstanding_repair']` + `mode:
   'admin_validation'` + the 3 seeded args.
5. (Optional, per Decision 9) SQL readback against
   `argument_machine_observation_results` if any positives observed.
6. POST 7 unsupported-family rejection regression requests (D, E,
   F, G, H, I, J).
7. Author audit doc at
   `docs/audits/MCP-SERVER-004-FAMILY-C-SMOKE-<date>.md` per
   intent brief §9.
8. Delete temp files: `$HOME/mcp-hosted-token.current`,
   `%TEMP%/mcp-server-004-family-c-*.json`,
   `%TEMP%/family-c-smoke-admin-jwt.txt`.

**No database migration. No code deploy beyond the standard merge →
Deno Deploy auto-deploy + Supabase Edge Function auto-deploy chain
(per Stage 5 hosting setup in CLAUDE.md).**

---

## 11. Doctrine self-check

### cdiscourse-doctrine §1 (Score is gameplay, not truth)

* Family C prompt frames repair as structural collaborative-grounding,
  never as who is "correct" / "incorrect" about understanding.
* `rejects_candidate_understanding` doctrine guard ("not 'you are
  wrong'") blocks correctness encoding.
* `acknowledges_misread` doctrine guard ("not a failure of the
  original author") blocks fault attribution.
* `flags_term_ambiguity` doctrine guard ("does NOT imply lazy
  writing") blocks accusatory framing.
* `clarified` lifecycle key requires cluster context; defaults
  FALSE/low when only move text visible.
* Ban-list scan blocks model-emitted verdict tokens at the response
  boundary.
* System prompt's 7 absolute rules mirror Family A/B verbatim.

### cdiscourse-doctrine §4 (AI moderator hard limits)

* No deletion / modification of user content.
* No truth assignment.
* AI advisory: every Family C observation flows through the same
  Edge persistence + Source 6 rendering pipeline (out of scope for
  this card; the pipeline already enforces `future_source` /
  `rendered_now` disposition on the 17 Family C keys per the source
  taxonomy).
* AI calls are server-side Deno only (per the MCP server's
  architecture; this card adds zero client-side AI integration).

### cdiscourse-doctrine §6 (Secrets policy)

* `ANTHROPIC_API_KEY` reaches Anthropic via `callAnthropic`'s
  `x-api-key` header inside the Deno server; never logged.
* `MCP_SERVER_BEARER_TOKEN` is the hosted-server auth; smoke script
  redacts it as `[REDACTED]`.
* No new secret introduced.
* `familyCAnthropic.test.ts` includes the same API-key-never-logged
  assertions as Family A and Family B (per §5).

### cdiscourse-doctrine §7 (No AI calls from production app)

* Family C Anthropic call runs in the MCP server (Deno Deploy), not
  the production app.
* Zero `src/` or `app/` file touched.
* No new fetch / HTTP-client / SDK introduced.

### cdiscourse-doctrine §10a (Observations vs Allegations)

* Family C keys are all `kind: 'machine_observation'` per source
  taxonomy.
* `source: 'ai_classifier'` for 16 of 17 keys; `source: 'lifecycle'`
  for `clarified` only (lifecycle source means the system computes
  the cluster state, not the model — but for this card the MCP
  layer routes `clarified` through the classifier with the
  conservative FALSE-low default per §2 lifecycle guard).
* No `user_allegation` Family C variant proposed.
* No verdictive labels emitted in any field.

### evidence-doctrine (engagement vs factual-standing separation)

* `requests_clarification` and `answers_clarification` are the
  productive Q-A grounding pair (engagement-positive; factual
  standing requires evidence per source-chain doctrine — Family C
  observations don't grant factual standing).
* `offers_candidate_understanding` is the high-signal grounding move
  that converts engagement to "good-faith disagreement" potential
  per source `doctrineNotes` (point-standing-economy hook —
  out of scope for this card; integration deferred).
* No popularity / engagement signal influences Family C
  classification.
* Family C observations feed downstream point-standing economy (per
  source `doctrineNotes` arrays) but THAT integration is out of
  scope; this card returns the machine observations only.

### test-discipline (every public function has a test)

* Per §5: every new file has dedicated test coverage.
* New: `familyCKeys.test.ts`, `familyCKeysParity.test.ts`,
  `familyCPrompt.test.ts`, `familyCAnthropic.test.ts`,
  `familyCBanListScan.test.ts`, `familyCFixtureParity.test.ts`,
  `familyCResponseValidator.test.ts`, `familyCDispatch.test.ts`,
  `familyCDoctrineFixtures.test.ts`.
* Updated: `familyRegistryInit.test.ts` (+3), `familyRegistry.test.ts` (+3),
  `familyBooleanRequestSchema.test.ts` (+6-8); 1-2 Jest tests for
  Edge familyRegistry Family C entry confirmation.
* No `.skip` / `.only` introduced.
* Test count goes UP (forecast +95 to +115); no test removal.

### supabase-edge-contract

* No Edge Function code change.
* No new RLS rule.
* No new migration.
* Existing Edge family gate at
  `supabase/functions/_shared/booleanObservations/familyRegistry.ts:73-77`
  is the binding control on production-mode Family C — and it's
  off (`productionEnabled: false`), per the existing
  MCP-021C-EDGE configuration.
* No service-role usage introduced.

---

## 12. Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Implementer accidentally adds a Family D key to `familyCKeys.ts` | Low | Intent brief HALT #4 covers; reviewer reads `familyCKeys.ts` end-to-end during PR review; `familyCKeysParity.test.ts` enforces exact 17-key match |
| Family A or Family B test regression from dispatcher refactor | Medium | All Family A and B tests under `mcp-server/tests/family[AB]*.test.ts` remain unchanged; the dispatcher refactor reuses the existing provider tables for Family A and Family B when `resolvedFamily` is `parent_relation` or `disagreement_axis`; Family B smoke pattern proved byte-equal preservation works for 2 families; the same approach extends to 3 |
| `clarified` lifecycle key produces consistently FALSE-low without ever signaling | Medium | This is INTENDED design — the conservative default is correct when cluster context is missing; if operator wants `clarified` positive signal, a separate cluster-context input pipeline is required (Family D or later); design surfaces this as Phase 4 PARTIAL-acceptable per Decision 9 |
| Model produces over-firing on subtle repair signals on adversarial Family B-style content | Medium | Fixture #5 (`family-c-no-repair-request.json`) covers this; `familyCDoctrineFixtures.test.ts` asserts all 17 keys false on this fixture; admin_validation smoke surfaces real cases for operator review |
| Token budget too tight (17 keys × 85 = 1445 vs 1500 envelope) | Low-Medium | §2 token-budget audit confirms fit; risk surfaced as TELEMETRY-driven follow-on for OPS observability card; HALT #15 NOT fired; if real-corpus testing reveals truncation, follow-on can split the 17-key call into 2 batches OR bump MAX_TOKENS to 1800 |
| Edge `admin_validation` smoke returns 0 positives across all 3 seeded args | Likely (per Decision 9) | Documented as PARTIAL-acceptable; pipeline verification (HTTP 200 + valid response shape + correct raw_keys universe) is the binding PASS gate; fresh-room seeding for repair signal quality belongs to a future OPS card |
| Hosted smoke fails because Deno Deploy build hasn't deployed | Low | Operator step 1 verifies hosted `/health` shows post-merge build |
| Hosted smoke fixture provider doesn't return a valid Family C response | Low | `familyCFixtureParity.test.ts` runs locally + asserts the canonical fixture passes validator + ban-list scan; if the fixture file is broken, the parity test fails the build before merge |
| Implementer adds production-mode Family C by accidentally editing the Edge gate | Low | Intent brief §5 explicit lock-out; §7 of this design names the file as READ ONLY (and notes Edge entry already exists at lines 73-77); existing `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts:FR-7` asserts every NON-parent_relation family has `productionEnabled: false`, including Family C — any accidental flip fails that test |
| Implementer changes `mcp-server/bootstrap.ts` (designer recommended SKIP) | Low | Listed in §7 lock-outs; OPS refactor §8 already documented designer's reasoning |
| Implementer adds `validate-family-c-response.ts` script when designer recommended skip | Low | §9 brief ledger #7 documents the skip recommendation; reviewer enforces |
| Smoke script `[12-…]` / `[13-…]` checks fail due to fixture pathway not yet wired | Low | Fixture provider serves the Family C canonical response; the smoke script's fixture-mode path is identical to Family A/B (validated by MCP-SERVER-001/002/003 smokes); operator confirms `MCP_SERVER_USE_FIXTURE_PROVIDER` env state before running smoke |
| Dispatcher's `pickFamilyProviders` table grows confusing past 3 families | Low for this card; Medium for D-J | Designer's binding judgment: 3 entries in a switch-style helper is still clear. If the table grows to 5+ entries, a follow-on refactor to a Map<family, providers> may be cleaner — defer to OPS observability or Family D. No restructuring in this card |

---

## 13. Dependencies

### Upstream dependencies (this card assumes complete)

* MCP-021A (taxonomy + parser; commit `d6648b4`) — provides
  `src/features/nodeLabels/machineObservationDefinitions/familyC.ts`
  source of truth.
* MCP-021B (persistence + Source 6 adapter; commit `eaa1aeb`) —
  provides `argument_machine_observation_runs` /
  `argument_machine_observation_results` tables; family-agnostic
  schema accepts Family C rows after registry registers.
* MCP-021C-EDGE (runtime spine; commit `9a4de95`) — provides the
  Edge Function adapter AND the Edge familyRegistry with Family C
  entry pre-configured.
* MCP-021C-EDGE-RESPONSE-SUMMARY-FIX (`c5c6d9b`) — ensures Edge
  per-arg summary reflects persisted rows.
* MCP-SERVER-001 (server foundation; commit `8a1652c`) — provides
  the Deno Deploy hosted MCP server with bearer auth +
  JSON-RPC endpoint.
* MCP-SERVER-002 (Family A classifier; commit `27bb837`) — provides
  the Family A pattern files mirrored by this card.
* MCP-021C-EDGE-SMOKE (PASS at `ebf4482`) — proves the Edge → MCP
  pipeline end-to-end.
* MCP-021C-FAMILY-A-PROD-SMOKE (`67fcba5`) — proves Family A
  production mode + Source 6 production filter.
* MCP-021C-AUTO-TRIGGER-FAMILY-A (`e281753`) — proves production
  auto-trigger for Family A.
* OPS-MCP-FAMILY-VALIDATOR-REFACTOR (`75008f9`) — provides the
  shared `FamilyValidatorRegistry` + `familyRegistryInit.ts`.
* OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE (`21f1b0b`) — confirms
  Family A byte-equal preservation + unsupported-family rejection
  end-to-end.
* MCP-SERVER-003-FAMILY-B (`ebbe389`) — Family B implementation;
  pattern source for this card.
* MCP-SERVER-003-FAMILY-B-SMOKE (`05b42c3`) — proves 2-family
  registry works end-to-end through hosted MCP + Edge
  `admin_validation`.

### Downstream blockers (cards that this design enables / blocks)

* **AUTHORIZES (post-PASS):** `MCP-SERVER-005-FAMILY-D` per intent
  brief §11 — with mandatory Stage-2B operator-decision checkpoint
  for the ai_classifier subset filter decision.
* **AUTHORIZES (post-PASS):** future `MCP-021C-EDGE-FAMILY-C-ENABLE`
  card (production-mode manual flag flip; analogous to the deferred
  `MCP-021C-EDGE-FAMILY-B-ENABLE`).
* **AUTHORIZES (post-PASS):** future `MCP-021C-AUTO-TRIGGER-FAMILY-C`
  card (gated on production-mode enablement).
* **STRONGLY RECOMMENDS (post-PASS):** `OPS-MCP-OBSERVABILITY` card
  (3 families operational; per-family metrics now justified).
* **BLOCKS:** `MCP-SERVER-003-BATCH-C-D-E` Family D start until
  Family C PASS; serial batch enforcement per intent brief §11.

---

## 14. Open questions for the operator

None at design time. The intent brief is comprehensive; all
designer interpretive decisions are documented in §9 Brief ledger.

If the implementer encounters a Phase A-undocumented choice during
build (e.g., the repair-positive cross-key framing note wording
needs revision; the test forecast lands outside +95 to +115; the
fixture move text doesn't elicit clean positives in initial mock
testing), the implementer should surface as a HALT for operator
decision rather than deciding silently. The design's binding
choices (17 keys verbatim from source; no Edge familyRegistry edit
because entry exists; conservative repair-positive bias; the
`clarified` lifecycle guard; the 5 fixtures' move text) are
designer's interpretive judgments and are revisitable on implementer
evidence.

---

## 15. Out of scope (explicit list — reduces scope creep)

This card does NOT include any of:

* Family D (`evidence_source_chain`), Family E (`argument_scheme`),
  Family F (`critical_question`), Family G (`resolution_progress`),
  Family H (`claim_clarity`), Family I (`thread_topology`), Family J
  (`sensitive_composer`) — each is a separate future card.
* Production-mode Family C enablement at the Edge Function. (Per
  intent brief §5; Edge gate stays `productionEnabled: false`.)
* Production auto-trigger Family C (analogous to
  `MCP-021C-AUTO-TRIGGER-FAMILY-A`).
* OPS observability dashboards / per-family metrics endpoints.
* Persistence schema changes.
* RLS policy changes.
* UI surface for Family C observations (chips, tooltips, Inspect panel).
* Source 6 rendering changes (the existing rendering pipeline
  already handles Family C keys generically; each key has
  `source: 'ai_classifier'` or `source: 'lifecycle'`).
* Plain-language label registry edits for Family C (the upstream
  `nodeAnnotationsRegistry` / `nodeLabelPlainLabelMap` already has
  the 17 Family C keys per MCP-021A).
* Engagement-credit / factual-standing scoring integration for
  Family C observations.
* Bot fixture runner integration of Family C classifier outputs.
* X News / xAI pilot integration of Family C annotations.
* CSV / JSONL export of Family C run rows.
* `validate-family-c-response.ts` script (per §9 Brief ledger #7).
* Cluster-context input pipeline for `clarified` lifecycle positive
  signal (a Family D or later concern).
* Documentation overhauls in `docs/conversation-gallery-ux.md` or
  similar.
