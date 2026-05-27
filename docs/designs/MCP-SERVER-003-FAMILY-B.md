# MCP-SERVER-003-FAMILY-B — Disagreement Axis Boolean Observation Classifier (design)

**Status:** Design draft
**Epic:** MCP server family rollout (Family B of B-C-D-E serial batch)
**Release:** Stage 6.x — Machine Observation classifiers
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/316
**Intent brief:** [`docs/designs/MCP-SERVER-003-FAMILY-B-intent.md`](./MCP-SERVER-003-FAMILY-B-intent.md)
**Predecessor on main:** `9ac9376` (intent brief commit)
**Branch:** `feat/MCP-SERVER-003-FAMILY-B`

---

## 1. Scope reality

### IN scope

* `mcp-server/lib/familyBKeys.ts` — frozen 14-rawKey constant +
  per-rawKey `FamilyBPromptEntry` blocks +
  `FAMILY_B_CLASSIFIER_SET_VERSION = 'family-b-v1'`.
* `mcp-server/lib/familyBPrompt.ts` — Family B system + user prompt;
  mirrors the 7 absolute rules verbatim from `familyAPrompt.ts:50-57`;
  adds disagreement-axis-specific descriptive framing.
* `mcp-server/lib/familyBAnthropic.ts` — Family B Anthropic
  orchestrator (mirror of `familyAAnthropic.ts`); reuses the shared
  `callAnthropic` wrapper.
* `mcp-server/lib/familyBBanListScan.ts` — Family B response
  doctrine ban-list scan (mirror of `familyABanListScan.ts`); reuses
  the shared `DOCTRINE_BAN_PATTERNS` constant.
* `mcp-server/lib/familyBFixtureProvider.ts` — fixture-mode provider
  for Family B (mirror of `familyAFixtureProvider.ts`).
* `mcp-server/lib/familyRegistryInit.ts` — ONE-line addition that
  registers `disagreement_axis` after the existing `parent_relation`
  registration.
* `mcp-server/tools/classifyArgumentBooleanObservations.ts` —
  per-family dispatch: route `disagreement_axis` requests to the
  Family B provider; Family A path remains unchanged.
* `mcp-server/scripts/validate-family-b-response.ts` — Phase 3
  validator script (mirror of `validate-family-a-response.ts`).
* Family B fixtures under `mcp-server/fixtures/` (see §6).
* `mcp-server/tests/familyBKeys.test.ts`,
  `familyBKeysParity.test.ts`, `familyBPrompt.test.ts`,
  `familyBAnthropic.test.ts`, `familyBBanListScan.test.ts`,
  `familyBFixtureParity.test.ts`,
  `familyBResponseValidator.test.ts`,
  `familyBDispatch.test.ts`,
  `familyBDoctrineFixtures.test.ts`.
* Test updates: `familyRegistryInit.test.ts` extends to expect both
  registered families;
  `familyRegistry.test.ts` add a 2-family insertion-order test that
  uses real Family A + real Family B (the OPS refactor's
  `fake_b` fake gets a real upgrade);
  `familyBooleanRequestSchema.test.ts` adds Family B valid-request +
  cross-family rejection tests.
* `scripts/mcp-server-001-smoke.sh` — add 2 Family B PASS checks
  (`[10-compat-boolean-family-b]`, `[11-mcp-tools-call-boolean-family-b]`).
* `docs/core/current-status.md` handoff section.

### OUT of scope

* Family C/D/E key registration. `familyRegistryInit.ts` after this
  card registers exactly `parent_relation` + `disagreement_axis`.
* MCP-021A taxonomy edits (`src/features/nodeLabels/**`). The 14 Family B
  rawKeys come verbatim from the source `familyB.ts`.
* MCP schema version change (`mcp-021.machine-observations.boolean.v1`
  stays).
* Family A prompt, Anthropic adapter, ban-list scan, fixture
  provider, or key-mirror changes (`familyA*.ts` files untouched).
* Family A behavior changes of any kind — full byte-equal
  preservation per the OPS refactor smoke baseline.
* Edge Function changes beyond test-only import-path updates. Edge
  invokes MCP via JSON-RPC; routing changes live in this card's MCP
  server only.
* Production auto-trigger for Family B. `MCP-021C-AUTO-TRIGGER` stays
  Family A only.
* Production-mode Family B enablement at the Edge layer. Per the
  Edge gate at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:69`,
  `disagreement_axis` has `productionEnabled: false`. Flipping that
  flag is a separate card (see §15 Decision I — Option A).
* UI / display-cap / persistence-schema / Source-6 rendering
  changes.
* `mcp-server/bootstrap.ts` change — per OPS refactor design §8 (the
  init module is intentionally tool-layer-only).
* Any migration. No DB shape change in this card.

---

## 2. Family B registry extraction (Phase A.1)

Source: `src/features/nodeLabels/machineObservationDefinitions/familyB.ts`.
Verified declaration order, line numbers, surface, disposition,
priority, source, and confidenceEligibility.

| # | rawKey | Line | defaultSurface | disposition | priority | source | confidenceEligibility |
| - | ------ | ---- | -------------- | ----------- | -------- | ------ | --------------------- |
| 1 | `disputes_evidence_applicability` | 40 | `timeline_node` | `future_source` | 44 | `ai_classifier` | SUBTYPE_INSPECT (timeline:high / selected:medium / inspect:low) |
| 2 | `disagreement_present` (UMBRELLA) | 82 | `timeline_node` | `future_source` | 120 | `ai_classifier` | **UMBRELLA** (timeline:medium / selected:medium / inspect:low) |
| 3 | `disputes_definition` | 132 | `inspect` | `future_source` | 121 | `ai_classifier` | SUBTYPE_INSPECT |
| 4 | `disputes_scope` | 172 | `inspect` | `future_source` | 122 | `ai_classifier` | SUBTYPE_INSPECT |
| 5 | `disputes_fact` | 213 | `inspect` | `future_source` | 123 | `ai_classifier` | SUBTYPE_INSPECT |
| 6 | `disputes_causal_link` | 253 | `inspect` | `future_source` | 124 | `ai_classifier` | SUBTYPE_INSPECT |
| 7 | `disputes_value_weighting` | 293 | `inspect` | `future_source` | 125 | `ai_classifier` | SUBTYPE_INSPECT |
| 8 | `disputes_decision_criterion` | 333 | `inspect` | `future_source` | 126 | `ai_classifier` | SUBTYPE_INSPECT |
| 9 | `disputes_generalization` | 373 | `inspect` | `future_source` | 127 | `ai_classifier` | SUBTYPE_INSPECT |
| 10 | `disputes_analogy` | 413 | `inspect` | `future_source` | 128 | `ai_classifier` | SUBTYPE_INSPECT |
| 11 | `disputes_interpretation` | 453 | `inspect` | `future_source` | 129 | `ai_classifier` | SUBTYPE_INSPECT |
| 12 | `disputes_priority_order` | 493 | `inspect` | `future_source` | 130 | `ai_classifier` | SUBTYPE_INSPECT |
| 13 | `disputes_remedy_or_solution` | 532 | `inspect` | `future_source` | 131 | `ai_classifier` | SUBTYPE_INSPECT |
| 14 | `disputes_relevance` | 572 | `inspect` | `future_source` | 132 | `ai_classifier` | SUBTYPE_INSPECT |

**Cross-check against intent brief §3 binding list:** 14/14 verbatim
match. Declaration order matches the intent brief enumeration
exactly. `disagreement_present` is the umbrella; the other 13 are
sub-axes.

**SUBTYPE_INSPECT** confidence eligibility (the 13 sub-axes share
this object, defined at `familyB.ts:30-34`):

```ts
{ timelineMinConfidence: 'high', selectedContextMinConfidence: 'medium', inspectMinConfidence: 'low' }
```

**Umbrella eligibility** (`disagreement_present` only, at
`familyB.ts:122-126`):

```ts
{ timelineMinConfidence: 'medium', selectedContextMinConfidence: 'medium', inspectMinConfidence: 'low' }
```

The umbrella floors lower because the umbrella is the load-bearing
Timeline chip; the subtype floors are higher because subtypes route
to Inspect-only.

The Family B keys file (`familyBKeys.ts`) does NOT carry the
`confidenceEligibility` field — those eligibilities live on the
upstream taxonomy and are applied by the Edge Function's sanitizer
(`sanitizeMcpBooleanObservationResponse`). The MCP server's keys
file mirrors only the rawKey + prompt-entry slice, matching the
Family A pattern (`familyAKeys.ts:78-87`).

---

## 3. Shared validator registration plan (Phase A.4)

### One-line addition to `familyRegistryInit.ts`

```ts
// After the existing Family A registration on line 44:
register('disagreement_axis', {
  rawKeys: new Set(FAMILY_B_RAW_KEYS),
  classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
});
```

Plus an import line at top:

```ts
import {
  FAMILY_B_RAW_KEYS,
  FAMILY_B_CLASSIFIER_SET_VERSION,
} from './familyBKeys.ts';
```

### Expected registry state after init

| Predicate | Expected value |
| --- | --- |
| `getSupportedFamilies()` | `['parent_relation', 'disagreement_axis']` (insertion order preserved per `familyRegistry.ts:82-84`) |
| `isFamilySupported('parent_relation')` | `true` |
| `isFamilySupported('disagreement_axis')` | `true` |
| `isFamilySupported('misunderstanding_repair')` | `false` |
| `isFamilySupported('evidence_source_chain')` | `false` |
| `getRawKeysForFamily('parent_relation').size` | `16` |
| `getRawKeysForFamily('disagreement_axis').size` | `14` |
| `isRawKeySupportedForFamily('disagreement_axis', 'disputes_definition')` | `true` |
| `isRawKeySupportedForFamily('disagreement_axis', 'disputes_evidence_applicability')` | `true` |
| `isRawKeySupportedForFamily('disagreement_axis', 'disagreement_present')` | `true` |
| `isRawKeySupportedForFamily('disagreement_axis', 'disputes_relevance')` | `true` |
| `isRawKeySupportedForFamily('disagreement_axis', 'supports_parent')` | `false` (Family A key under Family B → reject) |
| `isRawKeySupportedForFamily('parent_relation', 'disputes_definition')` | `false` (Family B key under Family A → reject) |
| `isRawKeySupportedForFamily('parent_relation', 'supports_parent')` | `true` (unchanged) |
| `getClassifierSetVersion('parent_relation')` | `'family-a-v1'` (unchanged) |
| `getClassifierSetVersion('disagreement_axis')` | `'family-b-v1'` |

The OPS refactor proved this registry pattern with `fake_b` in
`registry-getSupportedFamilies-preserves-insertion-order`
(`familyRegistry.test.ts:100-111`). This card upgrades that test to
use the real Family B registration.

### Idempotency

`familyRegistryInit.ts` already gates re-init with the
`initialized` boolean (line 30). The single function call in
`initializeFamilyRegistry()` becomes two; the gate continues to
protect both. No additional gating logic required.

---

## 4. Prompt design (Phase A.5)

### System prompt

Mirrors Family A's system prompt (`familyAPrompt.ts:46-71`)
verbatim for the 7 absolute rules (lines 50-57), then adds
disagreement-axis-specific descriptive framing. Designer-bound
template:

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

You classify whether an argument MOVE exhibits structural DISAGREEMENT relationships
toward its PARENT move. Each question is a structural observation about an axis of
disagreement, not a judgement about which side is right. Disagreement is productive and
structural; both sides remain valid contributions to the debate.

A move can simultaneously disagree on multiple sub-axes (e.g., factual + scope + analogy);
a move can express the umbrella disagreement (disagreement_present) without any specific
sub-axis being clearly positive. The umbrella key disagreement_present should be marked
true whenever ANY substantive disagreement is present; it is the binary "is there a
disagreement at all" structural fact.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a disagreement sub-axis is
present, answer false. Most moves exhibit 0 to 3 disagreement sub-axes; few exhibit more
than 5. Do NOT mark all rawKeys true. Tone alone is not disagreement; substantive
disagreement content is required for every positive.
```

**Doctrine ban-list scan on the literal system-prompt text:** the
banned tokens appear ONLY in negation form (lines 50-57), mirroring
the Family A precedent. This is doctrine-positive per
`familyAPrompt.ts` docstring lines 12-16. The ban-list scan runs
against the model's RESPONSE, not the server-constructed prompt.

### User prompt structure

Mirrors `buildFamilyAUserPrompt` (`familyAPrompt.ts:107-195`)
structure exactly, with these binding adjustments:

1. **Questions block:** one line per requested Family B rawKey,
   formatted `- ${rawKey}: ${booleanQuestion}`.
2. **Definitions block:** one block per requested rawKey, with
   `rawKey` / `positiveDefinition` / `negativeDefinition` /
   `positive example` / `negative example` / `false-positive
   guards` fields.
3. **Note about umbrella + subtypes** (new for Family B, replaces
   the Family A note about `has_rebuttal` / `has_counter_rebuttal` /
   `rebutted`):

   ```
   Note about disagreement_present and the 13 disagreement sub-axes:
   disagreement_present is the umbrella key for "does this move express ANY substantive
   disagreement with its parent". The 13 sub-axes (disputes_definition, disputes_scope,
   disputes_fact, disputes_causal_link, disputes_value_weighting,
   disputes_decision_criterion, disputes_generalization, disputes_analogy,
   disputes_interpretation, disputes_priority_order, disputes_remedy_or_solution,
   disputes_relevance, disputes_evidence_applicability) classify WHICH AXIS the
   disagreement targets. Mark disagreement_present true whenever ANY substantive
   disagreement is present; mark each sub-axis true ONLY when that specific axis is the
   move's disagreement vehicle. Answer each independently — do not auto-cascade.
   ```

4. **Response-shape instruction:** verbatim JSON shape, with
   `classifierSetVersion: "family-b-v1"` in `modelInfo` (the only
   diff vs Family A's JSON shape).
5. **Conservative-positives bias reminder:** "Most moves exhibit 0
   to 3 disagreement sub-axes" (NOT Family A's "2 to 4 structural
   relationships" — disagreement counts trend lower because most
   moves don't disagree).
6. **Input:** move text + parent text + thread context (same shape
   as Family A).

### Prompt constants

| Constant | Value | Rationale |
| --- | --- | --- |
| `FAMILY_B_MAX_TOKENS` | `1500` | Mirrors Family A. 14 keys × ~80 tokens + overhead ≈ 1200-1400; 1500 is the safe headroom. |
| `FAMILY_B_TEMPERATURE` | `0` | Deterministic. Mirrors Family A. |
| `FAMILY_B_MAX_BODY_FIELD_LEN` | `8000` | Mirrors the validator's `MAX_BODY_LEN` and Family A. |

### `classifierSetVersion` emit-line

`'family-b-v1'` — bound at top of `familyBKeys.ts` as
`export const FAMILY_B_CLASSIFIER_SET_VERSION = 'family-b-v1' as const;`.
Appears in:
* the registry registration (consumed by the validator for cross-family checks),
* the prompt's response-shape `modelInfo.classifierSetVersion` field,
* the canonical fixture JSON,
* the parity tests.

### Umbrella/subtype handling — designer's binding choice

Designer chooses: **prompt asks each rawKey independently**; the
system prompt + user-prompt umbrella note tell the model the
relationship (umbrella = OR-of-subtypes structurally), but the model
still answers each rawKey on its own merit with conservative-positives
bias. No auto-derivation in code; no umbrella-cascade in prompt
output validation.

Rationale:
* The model is the better judge of whether the umbrella signal is
  present even when no specific sub-axis is clearly positive (e.g.,
  general framing disagreement without a clean axis attribution).
* Conservative-positives bias on the umbrella floors the false-positive
  rate; the model defaults FALSE when unsure.
* Auto-cascading (subtypes → umbrella) could mask sub-axis miscalibration:
  if disputes_scope is mistakenly marked true, the umbrella would inherit
  the error. Keeping them independent surfaces such errors in tests
  and admin_validation.

The natural-OR behavior is achieved by the model's understanding
of the umbrella semantics, not by code-level cascade.

---

## 5. Doctrine / safety plan (Phase A.3)

### 5.1 `disputes_value_weighting` doctrine risk

**Binding `falsePositiveGuards` clause** from MCP-021A source
(`familyB.ts:319-322`):

> "Doctrine note: copy MUST NOT imply one value is 'right'. The
> disagreement is genuine; both values are real."
>
> "Do NOT mark TRUE for moves that dispute facts framed in
> value-laden language."

**Prompt translation:** the per-rawKey definitions block for
`disputes_value_weighting` MUST surface both guards verbatim in the
`false-positive guards` field. The user-prompt template already does
this by iterating the Family B prompt entries in the same
definitions-block format as Family A (`familyAPrompt.ts:121-132`).
No prompt-specific extension is required beyond ensuring the
`FamilyBPromptEntry` for `disputes_value_weighting` carries the
verbatim guard text.

**Designer-bound copy constraints** for this rawKey's
`positiveDefinition` and `negativeDefinition` in the prompt entry
(mirrors the source `familyB.ts:307-318` verbatim):

* `positiveDefinition`: "The move accepts the empirical landscape and
  disputes how the parent weights values: 'efficiency matters but
  equity matters more here'; 'security and privacy are both real,
  but privacy should win'. The disagreement is normative."
* `negativeDefinition`: "The move disputes facts, scope, definition,
  or evidence — not values. The move proposes a synthesis of values
  (Family G synthesis_proposed) without disputing the parent's
  weighting."

The `positive example` and `negative example` fields are
designer-shortened versions of the source `positiveExamples[0]` and
`negativeExamples[0]` (Family A precedent: one example each per
direction, not the full array).

**System-prompt level reinforcement:** the binding "both values are
real" framing comes through the descriptive system prompt's "both
sides remain valid contributions to the debate" line and the per-key
definitions block. No additional system-prompt edit needed.

### 5.2 `disputes_relevance` doctrine risk

**Binding `falsePositiveGuards` clause** from MCP-021A source
(`familyB.ts:597-600`):

> "Do NOT mark TRUE for dismissive moves with no argument; relevance
> dispute requires a reason."
>
> "Do NOT mark TRUE for moves that propose a different framing —
> that is reframes_parent."

**Prompt translation:** the per-rawKey definitions block for
`disputes_relevance` MUST surface both guards verbatim in the
`false-positive guards` field. The model is reminded that the
positive case requires a substantive reason ("That is interesting but
tangential because X"), not pure dismissal ("That is irrelevant").

**Designer's binding definition of "reason"** in this context: a
substantive engagement that explains WHY the parent's point does not
bear on the current question — e.g., topic mismatch ("the question
is about value-of-service, not construction emissions"), category
error claim ("you are answering an empirical question with a
normative answer"), or scope mismatch. Pure tonal dismissal
("irrelevant", "not interesting", "off-topic", "whatever") without a
substantive reason MUST return FALSE.

**Designer-bound copy constraints** for this rawKey's prompt
entries (mirrors source `familyB.ts:586-595`):

* `positiveDefinition`: "The move accepts the parent's point may be
  true but argues it does not bear on the current question. 'That is
  interesting but tangential'; 'true but unrelated to whether X
  should happen'."
* `negativeDefinition`: "The move accepts relevance and disputes
  facts/scope/etc. The move says the topic itself should change
  (introduces_new_issue / reframes_parent). Pure tangent flag
  without engagement is just dismissal."
* `positive example`: the source example at `familyB.ts:591` — "Topic:
  'Should libraries be funded?' Parent: 'Library buildings emit
  carbon during construction.' Move: 'True, but irrelevant to whether
  they should be funded — that question is about value-of-service,
  not construction emissions.'"
* `negative example`: the source example at `familyB.ts:594` — "Move:
  'The carbon footprint is small — maybe 0.1% of city emissions.'"

**Adversarial fixture coverage:** §6 names a
`family-b-doctrine-stress-request.json` fixture that includes a
pure-dismissal move text; the canonical Family B response must mark
`disputes_relevance` false for that input.

### 5.3 Cross-key doctrine constraint

All 14 disagreement outputs remain descriptive structural facts (per
cdiscourse-doctrine §10a). Per-rawKey prompt-entry text MUST NOT
contain the words `winner`, `loser`, `correct`, `wrong`, `truth`,
`liar`, `fallacy`, `bad faith`, `extremist`, `propagandist` except
when negating them (mirroring the system-prompt negation pattern).

The 14 source entries in `familyB.ts` already conform — the
`doctrineNotes` arrays each anchor on cdiscourse-doctrine §10a and
note "never implies one side is right" / "both sides may have
evidence" / "productive disagreement is core to debate" — never a
verdict on the move's author.

### 5.4 Ban-list scan response coverage

`scanFamilyBBooleanResponseForBanList` mirrors the Family A scan
(`familyABanListScan.ts:33-61`) field-for-field:
* every `evidenceSpan` string (14 max — one per rawKey)
* `modelInfo.serverName`
* `modelInfo.classifierSetVersion`

NOT scanned: `nodeId`, `schemaVersion`, `checkedRawKeys` entries,
`confidence` band values, `observations` boolean values — same
exclusions as Family A.

The ban-list pattern set comes from the shared
`mcp-server/lib/doctrineBanList.ts` constant
`DOCTRINE_BAN_PATTERNS` (consumed by Family A; reused unchanged).
No new banned patterns added; no Family-B-specific extensions.

**Future-card hook:** if the operator wants to add Family-B-specific
ban patterns (e.g., political-figure mentions; advocacy-language
patterns), that lives in a follow-on observability card, not here.

---

## 6. Fixture plan (Phase A.6)

### Canonical / shape fixtures (response-side)

| Fixture | Purpose | Positive rawKeys |
| --- | --- | --- |
| `classify-argument-boolean-observations.family-b-canonical-response.json` | Full 14-key Family B response; multi-axis positive case | `disagreement_present` (true), `disputes_fact` (true), `disputes_scope` (true), all 11 others false |
| `classify-argument-boolean-observations.family-b-malformed-response.json` | Invalid response shape (missing `confidence` for a key in `observations`) | rejected by `validateMcpBooleanObservationResponse` with `path='confidence.<key>'` |
| `classify-argument-boolean-observations.family-b-ban-list-response.json` | Response with a smuggled verdict token in an `evidenceSpan` | rejected by `scanFamilyBBooleanResponseForBanList` with `path='evidenceSpan.disputes_value_weighting'` |

### Per-axis request fixtures (request-side; for hosted smoke + tests)

Designer-authored realistic dialogue; no real-world political
figures, no current events that age out. Each fixture follows the
`mcp-server/fixtures/classify-argument-boolean-observations.family-a-challenge-request.json`
shape — `{ tool, input }` wrapper.

| Fixture | Input move text + parent text | Expected positives |
| --- | --- | --- |
| `classify-argument-boolean-observations.family-b-no-disagreement-request.json` | Parent: "EVs reduce urban tailpipe emissions in dense cities." Move: "Agreed — and the 2024 NYC data backs that up." | none (supports; not disagreement) |
| `classify-argument-boolean-observations.family-b-definition-dispute-request.json` | Parent: "Library funding should support infrastructure." Move: "You are defining infrastructure to exclude branch libraries — that definition prejudges the conclusion." | `disagreement_present`, `disputes_definition` |
| `classify-argument-boolean-observations.family-b-fact-vs-applicability-request.json` | Parent: "EV adoption is at 30% nationally; a Stanford study showed remote work boosts productivity 13%." Move: "EV adoption is at 10% nationally; 30% is the new-sales figure, not the stock. And that Stanford study was on knowledge workers in tech; it does not apply to assembly-line work." | `disagreement_present`, `disputes_fact`, `disputes_evidence_applicability` |
| `classify-argument-boolean-observations.family-b-value-weighting-request.json` | Parent: "Library funding should prioritize efficiency." Move: "Efficiency is a real value, but equity of access matters more here — the high-cost rural branches serve people who lack alternatives." | `disagreement_present`, `disputes_value_weighting` (no value labeled superior in any field) |
| `classify-argument-boolean-observations.family-b-relevance-with-reason-request.json` | Parent: "Library buildings emit carbon during construction." Move: "True, but irrelevant to whether libraries should be funded — that question is about value-of-service, not construction emissions." | `disagreement_present`, `disputes_relevance` (positive case: substantive reason given) |
| `classify-argument-boolean-observations.family-b-relevance-no-reason-request.json` | Parent: "Library buildings emit carbon during construction." Move: "Irrelevant." | none (false-positive guard: pure dismissal; no reason) |
| `classify-argument-boolean-observations.family-b-multi-axis-request.json` | Parent: "Carbon taxes always reduce emissions; the BC data proves it. Misinformation is like spam — filter at the platform." Move: "Carbon taxes work where enforcement is durable; Australia's was repealed before measurement, so the generalization is too strong. And the spam analogy fails: spam has technical markers, misinformation is contextual judgment." | `disagreement_present`, `disputes_generalization`, `disputes_scope`, `disputes_analogy` |
| `classify-argument-boolean-observations.family-b-doctrine-stress-request.json` | Parent: "Privacy matters more than security in routine surveillance cases." Move: "Security is the correct value, period. Anyone who says otherwise is a propagandist." | `disagreement_present` only — `disputes_value_weighting` MUST be FALSE because the move asserts one value is "correct" rather than disputing weighting structurally. Ban-list scan blocks "propagandist" if it leaks into any evidenceSpan. |

The doctrine-stress fixture is the deliberate trap. The classifier
should produce `disagreement_present: true` (the parent is clearly
being disagreed with) but should NOT produce
`disputes_value_weighting: true` because the move's content is itself
verdictive ("correct value, period") which fails the structural-dispute
test — the move asserts rather than weights. The expected behavior
flagging that the model should treat such moves as `disagreement_present`
without subtype attribution (the umbrella absorbs the disagreement
fact; sub-axes stay false because no clean structural axis is offered).

If the model DOES return `disputes_value_weighting: true` for this
fixture, the ban-list scan still catches "propagandist" in any
evidenceSpan; the test asserts that path. The fixture serves dual
purpose: doctrine-discipline canary + ban-list scan canary.

---

## 7. Tool dispatcher changes

### File: `mcp-server/tools/classifyArgumentBooleanObservations.ts`

The current dispatcher (lines 155-281) has a single linear flow:
validate → provider-select → validate-response → ban-list-scan →
return. Designer adds a per-family dispatch at Step 2 (provider
selection).

**Concrete diff sketch (~50-70 lines net):**

1. **Imports (top of file):** add Family B counterparts.
   ```ts
   import { runAnthropicFamilyBClassifier } from '../lib/familyBAnthropic.ts';
   import { loadFixtureFamilyBPacket } from '../lib/familyBFixtureProvider.ts';
   import { scanFamilyBBooleanResponseForBanList } from '../lib/familyBBanListScan.ts';
   ```

2. **Tool metadata (line 51-52):** update `description` text to
   reflect that Family B is now supported.
   * BEFORE: "Classifies an argument move against MCP-021A Family A
     (parent_relation) boolean Machine Observation taxonomy. Accepts
     McpBooleanObservationRequest with
     requestedFamilies=['parent_relation'] and returns ... Family B
     through J return an unsupported_family error envelope in this
     server build."
   * AFTER: "Classifies an argument move against MCP-021A Family A
     (parent_relation) OR Family B (disagreement_axis) boolean
     Machine Observation taxonomy. Accepts McpBooleanObservationRequest
     with requestedFamilies=['parent_relation'] or
     requestedFamilies=['disagreement_axis'] and returns
     McpBooleanObservationResponse per the schema in
     src/features/nodeLabels/mcpBooleanObservationSchema.ts. Family
     C through J return an unsupported_family error envelope in this
     server build."

3. **Per-family routing helper** (new internal function added
   between `errorResult` and `handleClassifyArgumentBooleanObservations`):

   ```ts
   type ProviderInvocation = {
     anthropic: (req: ValidatedFamilyARequest, reqId: string) => Promise<AnthropicCallResult>;
     fixture: () => Promise<FamilyFixtureResult>;
     banListScan: (resp: McpBooleanObservationValidatedResponse) => FamilyBanListScanResult;
   };

   function pickFamilyProviders(family: string): ProviderInvocation | null {
     if (family === 'parent_relation') {
       return {
         anthropic: runAnthropicFamilyAClassifier,
         fixture: loadFixtureFamilyAPacket,
         banListScan: scanFamilyABooleanResponseForBanList,
       };
     }
     if (family === 'disagreement_axis') {
       return {
         anthropic: runAnthropicFamilyBClassifier,
         fixture: loadFixtureFamilyBPacket,
         banListScan: scanFamilyBBooleanResponseForBanList,
       };
     }
     return null; // unreachable post-validation; defensive
   }
   ```

4. **Per-request family selection** (replace lines 220-242):
   Determine the single family this request targets. Per the
   validator, `requestedFamilies` is non-empty (it has at least
   one registered family) OR empty (defaults to `parent_relation`
   per `familyBooleanRequestSchema.ts:50`). Compute the resolved
   family:

   ```ts
   const resolvedFamily =
     request.requestedFamilies.length > 0
       ? request.requestedFamilies[0]
       : 'parent_relation';
   const providers = pickFamilyProviders(resolvedFamily);
   if (!providers) {
     // Defensive — validator already gated this; if we reach here,
     // a registered family is missing a provider table entry.
     return errorResult('unsupported_family', 'No provider for resolved family', {
       resolvedFamily,
     });
   }
   ```

   Then use `providers.anthropic` / `providers.fixture` /
   `providers.banListScan` in Steps 2, 4 — replacing the
   Family-A-only references at lines 222, 228, 260.

5. **Mixed-family rejection.** If `requestedFamilies.length > 1`
   AND contains families from different registries, the existing
   validator's per-rawKey check still applies (a Family A rawKey
   under a `requestedFamilies` set that doesn't include
   `parent_relation` rejects), but the per-family dispatch picks
   the FIRST family. Designer's binding rule for this card: when
   multiple families are requested, the dispatcher resolves to the
   first family and the validator's per-rawKey check (which iterates
   `familiesToCheck` per `familyBooleanRequestSchema.ts:243-250`)
   rejects any rawKey not in any requested family. This is sufficient
   for Family A + Family B both being requested with rawKeys split
   between them — the validator passes (each rawKey is supported
   somewhere); the dispatcher picks the first family for
   prompt-building. The post-validation response will include
   `checkedRawKeys` for the picked family only. The Edge Function
   adapter currently requests ONE family per call, so this matches
   the current call pattern.

   **OUT OF SCOPE for this card:** true multi-family-per-call (one
   MCP request producing both Family A + Family B observations in
   one round-trip). That requires a multi-prompt orchestration
   layer. The Edge Function does not request multi-family calls
   today, so the picking-first-family rule is sufficient.

6. **Log tagging** (Phase A.10 §11): each log call inside the
   dispatcher already includes `tool`. Add `family: resolvedFamily`
   to the log payload for the three warn paths (lines 170-209)
   AND for the success/failure logging in
   `runAnthropicFamilyAClassifier` /
   `runAnthropicFamilyBClassifier` (the per-family Anthropic
   wrappers can add `family` to their own log payloads via
   `callAnthropic`'s tag-spreader, but that's deferred — the
   minimum acceptable for this card is the dispatcher-side
   `family` tag at the 3 warn paths in the tool handler).

### File: `mcp-server/lib/familyBooleanRequestSchema.ts`

**No required change.** The validator already supports per-family
rawKey routing via `isRawKeySupportedForFamily(family, key)` for
each entry in `familiesToCheck`. After Family B registers,
`familiesToCheck` correctly includes `'disagreement_axis'` when
requested, and `isRawKeySupportedForFamily('disagreement_axis',
'<family-b-key>')` returns true. The `DEFAULT_FAMILY_FOR_RAWKEY_CHECK
= 'parent_relation'` constant (line 50) is the byte-equal
preservation anchor — it does NOT need to change. The behavior
when `requestedFamilies` is empty remains: rawKey checks default to
Family A's 16-key set, which is the original
pre-refactor semantics. Family B callers MUST explicitly pass
`requestedFamilies: ['disagreement_axis']` to opt in.

**Optional polish (out of scope for this card):** when Family C/D/E
register, the byte-equal default may need revisiting. The OPS
refactor docstring (lines 44-49) explicitly flags this. The
implementer should add a comment-update note to the validator's
docstring acknowledging Family B is now registered (mentioning that
the default still routes to Family A for empty `requestedFamilies`
is intentional pre-refactor preservation) but the constant value
should NOT change in this card.

---

## 8. Test plan

### Test forecast: +80 to +110 new tests

Lower bound estimate +80, upper bound +110, HALT at +300 per intent
brief §8. The +80-110 number is derived from:

* Family A test surface = 81 tests across 7 dedicated files (Phase
  A baseline grep).
* Family B mirrors all 7 patterns + adds 2 new categories
  (`familyBDispatch.test.ts`, `familyBDoctrineFixtures.test.ts`).
* Family B includes per-key-quantity differences (14 vs 16) and the
  doctrine-stress fixture; the doctrine-fixture tests add ~10
  cases.

Test forecast detailed by file:

| File | UPDATED vs NEW | Test count (est) | Coverage |
| --- | --- | --- | --- |
| `mcp-server/tests/familyBKeys.test.ts` | NEW | 7 | `FAMILY_B_RAW_KEYS` has 14 entries; binding list match; no extras; no dupes; `FAMILY_B_PROMPT_ENTRIES` has 14 entries; every entry has required verbose fields; `FAMILY_B_CLASSIFIER_SET_VERSION === 'family-b-v1'`. Mirrors `familyAKeys.test.ts` pattern. |
| `mcp-server/tests/familyBKeysParity.test.ts` | NEW | 2 | Server-side rawKey literals all appear in upstream `familyB.ts`; upstream file has exactly 14 rawKey declarations and all are in server-side constant. Mirrors `familyAKeysParity.test.ts`. |
| `mcp-server/tests/familyBPrompt.test.ts` | NEW | 12-14 | System prompt contains 7 absolute-rules verbatim; user prompt builder happy path; user prompt builder with subset of keys; user prompt builder with empty requestedRawKeys (returns all 14); rawKeys filter rejects non-Family-B keys; banned-token negation check on system prompt; `FAMILY_B_MAX_TOKENS === 1500`; `FAMILY_B_TEMPERATURE === 0`; user prompt includes umbrella/subtype note; user prompt asserts all 14 rawKeys present in questions block. Mirrors `familyAPrompt.test.ts` (14 tests). |
| `mcp-server/tests/familyBAnthropic.test.ts` | NEW | 10 | Happy path, key_missing, HTTP 429, HTTP 500, TimeoutError, non-JSON response, plain prose (no JSON object), API key never appears in success log line, API key never appears in failure log line, logs tagged with `classify_argument_boolean_observations`. Mirrors `familyAAnthropic.test.ts` test-by-test. |
| `mcp-server/tests/familyBBanListScan.test.ts` | NEW | 14 | Clean response ok=true; evidenceSpan with each banned token (winner, loser, verdict, truth, liar, bad faith, extremist, manipulative); modelInfo.serverName with banned token; modelInfo.classifierSetVersion with banned token; null evidenceSpan values skipped; "proof of" two-word phrase detected; neutral compound words not flagged. Mirrors `familyABanListScan.test.ts` test-by-test. |
| `mcp-server/tests/familyBFixtureParity.test.ts` | NEW | 12-14 | Canonical-response fixture passes validator + ban-list; multi-axis fixture passes validator + ban-list; all fixture responses use rawKeys in `FAMILY_B_RAW_KEYS`; malformed fixture fails validator; ban-list fixture fails ban-list scan; all 8 per-axis request fixtures pass `validateFamilyBooleanRequest`. Mirrors `familyAFixtureParity.test.ts`. |
| `mcp-server/tests/familyBResponseValidator.test.ts` | NEW | 16-18 | Happy path 14-key Family B response; rejects wrong schemaVersion; rejects missing required fields; rejects wrong shape for observations / confidence / evidenceSpan; rejects flag_count_too_high (>20); rejects modelInfo without provider="mcp"; rejects unknown rawKey in checkedRawKeys; accepts evidenceSpan strings up to 240 chars; rejects evidenceSpan strings > 240 chars; accepts confidence in {low, medium, high}; rejects confidence values outside that set. Mirrors `familyAResponseValidator.test.ts` (20 tests) trimmed for 14-key universe. |
| `mcp-server/tests/familyBDispatch.test.ts` | NEW | 8-10 | Mock-fetch dispatcher tests: Family B request routes to Family B Anthropic; Family A request routes to Family A Anthropic; Family B request invokes Family B ban-list scan (not Family A); both ban-list scans return ok=true for clean responses; cross-family rejection (Family A rawKey under disagreement_axis); dispatcher returns unsupported_family for unregistered family; resolved-family log tag present; fixture provider routing for Family B. Mirrors logic from `classifyArgumentBooleanObservations.test.ts`. |
| `mcp-server/tests/familyBDoctrineFixtures.test.ts` | NEW | 6-8 | Doctrine-stress fixture: response has no positive on `disputes_value_weighting`; doctrine-stress fixture's evidenceSpans pass ban-list scan; value-weighting positive fixture's evidenceSpans don't contain "right"/"correct"/"wrong"; relevance-with-reason fixture has `disputes_relevance: true`; relevance-no-reason fixture has `disputes_relevance: false`; no-disagreement fixture has all 14 keys false. |
| `mcp-server/tests/familyRegistryInit.test.ts` | UPDATED | +3 (existing 5 stay; 3 added) | Add: `familyRegistryInit-registers-family-b-on-import` (`isFamilySupported('disagreement_axis')` true); `familyRegistryInit-registers-both-families-in-order` (`getSupportedFamilies()` returns `['parent_relation', 'disagreement_axis']` exact); `familyRegistryInit-family-b-has-14-rawKeys`. The existing test `familyRegistryInit-registers-only-family-a` is REPLACED with the new "both families" test — net +3. |
| `mcp-server/tests/familyRegistry.test.ts` | UPDATED | +2 (existing 14 stay; 2 added) | Add: `registry-getSupportedFamilies-preserves-real-family-b-order` (upgrade the existing `fake_b` test to use real Family B); `registry-isRawKeySupportedForFamily-cross-family-rejection` (Family A key under disagreement_axis → false; Family B key under parent_relation → false). |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | UPDATED | +6 to +8 | Add: valid Family B request passes; Family B request with rawKey subset passes; Family B request with empty requestedRawKeys passes; Family B request with empty requestedFamilies + Family B rawKey REJECTS (byte-equal-preservation default routes to Family A which doesn't include Family B keys); cross-family rejection (Family A rawKey under disagreement_axis); cross-family rejection (Family B rawKey under parent_relation); valid Family A request still passes (regression). |

**Subtotal:** 7 + 2 + 12 + 10 + 14 + 12 + 16 + 8 + 6 + 3 + 2 + 6 = **98 new tests** (midpoint estimate; range 80-110 per the bands above).

### Doctrine ban-list assertion coverage

`familyBPrompt.test.ts` asserts the system prompt's literal text
contains the 7 absolute-rules negation pattern and NO bare banned
tokens. This mirrors Family A's pattern.

`familyBBanListScan.test.ts` asserts the runtime scan rejects every
banned-token shape in evidenceSpans, modelInfo.serverName, and
modelInfo.classifierSetVersion.

`familyBDoctrineFixtures.test.ts` asserts the doctrine-stress
fixture behaves as designed (no false `disputes_value_weighting`
positive on verdictive moves; pure-dismissal moves don't trigger
`disputes_relevance` positives).

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
post-Family-B tree. None of those test surfaces are directly touched
by Family B but they share the upstream taxonomy and could fail if
Family B accidentally shifts a constant.

---

## 9. Hosted smoke plan (Phase A.7)

### File: `scripts/mcp-server-001-smoke.sh`

Designer adds 2 new PASS checks after Check 9 (the current final
check). Checks numbered 10 and 11.

#### New check 10: `[10-compat-boolean-family-b]`

```bash
# ── Check 10: POST /mcp/adapter-compat with VALID bearer + boolean (Family B) ──
# MCP-SERVER-003-FAMILY-B promoted Family B from unsupported to real. The request body
# uses Family B rawKeys (disagreement_axis family). Response shape MUST be a real
# McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (14 keys for Family B)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-b-v1'
CHECK_NAME="10-compat-boolean-family-b"
BOOLEAN_B_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-b-001","parentNodeId":"fixture-node-parent-b-001","currentText":"[fixture] You are defining infrastructure to exclude branch libraries — that definition prejudges the conclusion.","parentText":"[fixture] Library funding should support infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["disagreement_axis"],"requestedRawKeys":["disagreement_present","disputes_definition","disputes_scope"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family B)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_B_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-b-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family B response shape. Got: $RESPONSE"
fi
```

#### New check 11: `[11-mcp-tools-call-boolean-family-b]`

```bash
# ── Check 11: POST /mcp tools/call classify_argument_boolean_observations (Family B) ──
# MCP-SERVER-003-FAMILY-B. Same body + same assertion pattern as Check 10, but via the
# official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="11-mcp-tools-call-boolean-family-b"
BOOLEAN_B_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-3","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-b-001","parentNodeId":"fixture-node-parent-b-001","currentText":"[fixture] You are defining infrastructure to exclude branch libraries — that definition prejudges the conclusion.","parentText":"[fixture] Library funding should support infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["disagreement_axis"],"requestedRawKeys":["disagreement_present","disputes_definition","disputes_scope"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family B)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_B_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-b-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family B tool result. Got: $RESPONSE"
fi
```

### No new script flags

Designer recommends always-included Family B coverage (no
`--family-b` opt-in flag). Family B is shipping; the smoke must
prove it. The post-card script signature stays:

```
bash scripts/mcp-server-001-smoke.sh --base-url <url> --token <bearer> [--verbose]
```

### Token redaction

Existing `Token: [REDACTED]` pattern stays. No additional secrets
introduced.

### Final tally after this card

`MCP-SERVER-001 smoke: 11 PASSES, 0 FAILS` (9 existing + 2 new).
Old check IDs 1-9 unchanged; new check IDs 10-11.

### Fixture provider compatibility

Family B fixture provider must return a valid Family B canonical
response when invoked. Checks 10/11 run under either
`MCP_SERVER_USE_FIXTURE_PROVIDER=true` (offline; fixture returns
canonical response per §6) OR `MCP_SERVER_USE_FIXTURE_PROVIDER`
unset + real Anthropic key (live; model classifies the fixture
input).

---

## 10. Edge smoke plan (Phase A.8)

### Edge `admin_validation` request shape

```json
POST {SUPABASE_URL}/functions/v1/classify-argument-boolean-observations
Authorization: Bearer {admin_user_jwt}
Content-Type: application/json

{
  "argumentIds": ["<arg-id-1>", "<arg-id-2>", "<arg-id-3>"],
  "requestedFamilies": ["disagreement_axis"],
  "mode": "admin_validation",
  "schemaVersion": "mcp-021.machine-observations.boolean.v1"
}
```

### Seeded args choice

Designer recommends **reusing the 3 AUTO-TRIGGER-FAMILY-A seeded
args** (`f41b18b0-…`, `781f8057-…`, `db0de3e0-…`) for continuity
with the OPS refactor smoke pattern (Phase 3 of
`OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE`).

Trade-off acknowledged: those 3 args were designed for Family A
exercise (parent_relation: support, challenge, counter-rebuttal). They
may produce 0 Family B positives for some args (e.g., arg1 is a
root with no parent → no disagreement to detect). That is acceptable
PASS-criteria-wise: the smoke is the proof-of-pipeline (Edge → MCP
→ Family B Anthropic → ban-list scan → persistence), not the
proof-of-prompt-quality (which is what fixture tests are for).

PASS criteria per intent brief §9 Phase 8 requires "at least ONE
real positive Family B row persisted." Arg2 (depth 1 challenge) is
the most likely candidate — the text "That ignores the role of user
education — some products require onboarding because the domain is
genuinely complex, not because the UI is bad" should at minimum
trigger `disagreement_present` true (with possibly `disputes_scope`
or `disputes_evidence_applicability`).

Operator may opt to seed a fresh debate room with explicit
disagreement-axis arguments if continuity is less important than
prompt-quality observability. Designer's binding recommendation:
**stay with the 3 seeded args** for this card; defer
fresh-room seeding to a follow-on OPS observability card.

### Expected response shape (designer-bound)

```
HTTP 200 (latency 15-30 s expected for 3 args; comparable to OPS smoke Phase 3 at 18.4 s)
mode: 'admin_validation'
schemaVersion: 'mcp-021.machine-observations.boolean.v1'
perArgument: [
  { index: 0, argumentId: 'f41b18b0-…', runId: '<uuid>', status: 'success',
    failureReason: 'none', positiveObservationCount: 0..1,
    rawKeysWithPositive: [] | ['disagreement_present'] },
  { index: 1, argumentId: '781f8057-…', runId: '<uuid>', status: 'success',
    failureReason: 'none', positiveObservationCount: 1..4,
    rawKeysWithPositive: includes 'disagreement_present' minimum,
    likely +1-3 sub-axes },
  { index: 2, argumentId: 'db0de3e0-…', runId: '<uuid>', status: 'success',
    failureReason: 'none', positiveObservationCount: 1..4,
    rawKeysWithPositive: similar to arg2 }
]
```

PASS gate: at least ONE `perArgument` entry has
`positiveObservationCount >= 1` AND `rawKeysWithPositive` contains
at least one Family B key.

### Doctrine check

Operator runs (after the Edge call completes):

```sql
-- Bypassed admin SQL to read back persisted Family B rows
SELECT
  run_id,
  raw_key,
  family,
  confidence,
  evidence_span,
  length(evidence_span) AS evidence_len
FROM argument_machine_observation_results
WHERE run_id IN (<3 run-IDs from the per-arg summary>)
ORDER BY run_id, raw_key;
```

Designer's doctrine assertions on the readback:

1. Every row has `family = 'disagreement_axis'`.
2. Every row has `confidence ∈ {low, medium, high}`.
3. Every row's `raw_key` is in the binding 14-key Family B set.
4. Every row's `evidence_span` length ≤ 240 chars.
5. No row's `evidence_span` contains any of the doctrine ban-list
   patterns (`winner`, `loser`, `verdict`, `truth`, `liar`, `bad
   faith`, `extremist`, `manipulative`, `propagandist`, `correct`,
   `wrong`, `fallacy`).
6. If any row is `disputes_value_weighting`, its `evidence_span`
   does NOT contain `'right'` or `'correct'` (per §5.1 binding rule:
   "MUST NOT imply one value is 'right'").
7. If any row is `disputes_relevance`, the move text contains
   evidence of a substantive reason (operator inspects the source
   `arguments.body` row for the argumentId).

The Edge `admin_validation` smoke is operator-run; the operator
records findings in `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md`
per intent brief §9.

### Run-row readback

Same SELECT pattern as the OPS smoke Phase 3 readback for
`argument_machine_observation_runs`. Expected:
* `run_mode = 'admin_validation'` for all 3 rows.
* `schema_version = 'mcp-021.machine-observations.boolean.v1'`.
* `requested_families = ['disagreement_axis']`.
* `provider_key = 'mcp:classify_argument_boolean_observations'`.
* `status = 'success'`.
* `failure_reason = null`.
* `completed_at` populated; `duration` 4-7 s per arg (Family B has
  fewer keys than Family A, so per-arg latency may trend slightly
  lower).

---

## 11. OPS observations (Phase A.10)

### Server-side logging tags added in this card

* `mcp-server/tools/classifyArgumentBooleanObservations.ts` — add
  `family: resolvedFamily` to the existing 3 warn-path `log(...)`
  calls (lines 170, 187, 202) AND to the success/failure response
  log if any exists. The Family A baseline already includes `tool`,
  `reason`, `status`, `httpStatus` per
  `classifyArgumentBooleanObservations.ts:170-208`. The `family`
  tag is the minimum diff that enables per-family observability
  without code-locked refactor.
* `mcp-server/lib/familyBAnthropic.ts` — internally wraps
  `callAnthropic` exactly like `familyAAnthropic.ts:32-48`. The
  per-call log tags via `toolNameForLogging:
  'classify_argument_boolean_observations'` stay. If
  `callAnthropic` supports an additional `family` tag in its log
  spreader, Family B passes `'disagreement_axis'`; if not, that is
  a follow-on observability refactor (out of scope here).

### Edge-side hooks deferred

Per intent brief §5 ("no Edge Function changes beyond test-only
import-path updates"), the Edge-side hooks (e.g., adding
`requestedFamilies` count + first element to the run-tracking row
metadata) are OUT OF SCOPE for this card. The Edge Function
already emits `requested_families` to the run-tracking row per
`classifyArgumentCore.ts:231` (the `persistRun` call), so the data
is already there for an OPS card to consume. Per-family
observability dashboards remain the scope of
`OPS-MCP-OBSERVABILITY` (planned post-Family-B PASS per intent
brief §11).

### What this card does NOT add

* Per-family latency histogram via a `tools/observability` route.
* Edge-side per-family logging tag adjustments.
* Server-side `tools/metrics` endpoint.
* Sentry-integrated error reporting.

All deferred to `OPS-MCP-OBSERVABILITY`.

---

## 12. Read-only boundaries (files this card DOES NOT touch)

Per intent brief §5 + §7.3, plus additions surfaced during Phase A:

* `mcp-server/lib/familyAPrompt.ts`
* `mcp-server/lib/familyAAnthropic.ts`
* `mcp-server/lib/familyABanListScan.ts`
* `mcp-server/lib/familyAFixtureProvider.ts`
* `mcp-server/lib/familyAKeys.ts`
* `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`
* `mcp-server/lib/seedPrompt.ts`
* `mcp-server/lib/familyRegistry.ts` (the registry primitive — no shape change)
* `mcp-server/lib/anthropicCall.ts` (shared Anthropic wrapper — Family B reuses unchanged)
* `mcp-server/lib/doctrineBanList.ts` (shared pattern set — Family B reuses unchanged)
* `mcp-server/lib/logging.ts` (logging primitive — Family B reuses unchanged)
* `mcp-server/lib/toolDispatch.ts` / `toolRegistry.ts` / `bootstrap.ts` (per OPS refactor §8 recommendation)
* `mcp-server/scripts/validate-family-a-response.ts` (Family A validator unchanged; Family B gets its own)
* `mcp-server/tests/familyA*.test.ts` (existing Family A tests untouched; they should continue to pass after Family B's registry addition since the validator + dispatcher still route Family A correctly)
* `mcp-server/tests/classifyArgumentBooleanObservations.test.ts` (the existing dispatcher integration test — designer's note: this MAY need a 1-line update if the test depends on the description text; designer recommends checking during implementation but expects no logic change)
* `mcp-server/tests/classifyArgumentBooleanObservationsSourceScan.test.ts` (source-scan; should be unchanged)
* `mcp-server/tests/adapterCompat.test.ts`, `mcp-server/tests/jsonRpc.test.ts`, etc. — unchanged
* `src/features/nodeLabels/**` (upstream taxonomy; locked per intent brief §5)
* `supabase/functions/**` (Edge Functions; locked per intent brief §5)
* `supabase/migrations/**` (no migration in this card)
* Any file under `app/`, `src/features/argumentScoring/`,
  `src/features/sourcing/`, etc. (UI / scoring / source-chain;
  unrelated)

---

## 13. HALT trigger table (all 21 from intent brief §6)

| # | Trigger | Assessment |
| - | ------- | ---------- |
| 1 | `OPS-MCP-FAMILY-VALIDATOR-REFACTOR` smoke PASS audit missing | PASS — confirmed at `21f1b0b` per intent brief §1 sequencing chain; verified via `git log` |
| 2 | Family B raw key list differs from MCP-021A source | PASS — Phase A.1 cross-check shows 14/14 verbatim match against `familyB.ts` declaration order; `familyBKeysParity.test.ts` enforces |
| 3 | Any Family C/D/E registration appears | PASS — design §3 registers only `disagreement_axis`; HALT triggered by reviewer if implementer adds C/D/E |
| 4 | Any taxonomy key added or renamed | PASS — design adds zero new keys; Family B mirrors MCP-021A's existing 14 keys |
| 5 | MCP schema version changes | PASS — `mcp-021.machine-observations.boolean.v1` constant stays; explicitly out-of-scope per §1 |
| 6 | Family A prompt changes | PASS — `familyAPrompt.ts` listed in §12 lockout |
| 7 | Family A key mirror changes except shared import/registry usage that tests prove byte-equivalent | PASS — `familyAKeys.ts` listed in §12 lockout; registry usage already byte-equivalent per OPS refactor smoke |
| 8 | `parent_relation` behavior changes | PASS — `pickFamilyProviders('parent_relation')` returns the identical Family A provider table (`runAnthropicFamilyAClassifier`, `loadFixtureFamilyAPacket`, `scanFamilyABooleanResponseForBanList`); the dispatcher change adds Family B routing without altering Family A's code path or constants |
| 9 | `unsupported_family` behavior for C/D/E changes | PASS — registry has only `parent_relation` + `disagreement_axis` after init; C/D/E remain unsupported; validator rejects them at the registry layer |
| 10 | Client-side MCP call introduced | PASS — design is server-side only (`mcp-server/lib/**`); no `src/` or `app/` file touched |
| 11 | MCP bearer / Anthropic / service-role secrets exposed | PASS — Family B Anthropic wrapper reuses the existing `callAnthropic` (proven safe by `anthropicNoLogging.test.ts`); no secret in any new file; `familyBAnthropic.test.ts` includes the same API-key-never-logged tests as Family A |
| 12 | UI or display-cap changes | PASS — no UI file touched |
| 13 | Raw keys appear in user-facing copy | PASS — server-side classifier returns rawKeys to Edge; no UI surface in this card; ban-list scan blocks rawKey leak into evidenceSpans (the only model-controlled string field) |
| 14 | Verdict / winner / correctness / fallacy / bad-faith language in model-facing or user-facing copy except doctrine-negation tests | PASS — system prompt mirrors Family A's 7 absolute rules verbatim (negation form only); per-key prompt entries inherit the descriptive framing from `familyB.ts`'s positiveDefinition/negativeDefinition/falsePositiveGuards arrays (which the §5 doctrine-risk audit confirms are verdict-token-free except in negation form); ban-list scan blocks model responses with verdict tokens |
| 15 | Family B prompt frames disagreement as who is right/wrong | PASS — system prompt explicitly says "Disagreement is productive and structural; both sides remain valid contributions to the debate"; per-key entries mirror source `doctrineNotes` arrays ("never implies one side is right" theme is universal); `familyBPrompt.test.ts` will assert the negation-pattern check |
| 16 | Family B prompt treats relevance disagreement as dismissal | PASS — `disputes_relevance` per-key entry surfaces the source guard "Do NOT mark TRUE for dismissive moves with no argument; relevance dispute requires a reason" verbatim; doctrine-stress fixture covers this case; §5.2 documents the binding "reason" definition |
| 17 | Family B prompt treats value weighting as a correctness judgment | PASS — `disputes_value_weighting` per-key entry surfaces the source guard "copy MUST NOT imply one value is 'right'. The disagreement is genuine; both values are real" verbatim; doctrine-stress fixture covers the verdictive-move trap |
| 18 | Hosted smoke fails | NOT KNOWN AT DESIGN TIME — design plans 2 new PASS checks (`[10-compat-boolean-family-b]`, `[11-mcp-tools-call-boolean-family-b]`); operator runs smoke post-merge; HALT triggered only if real smoke fails. Design includes contingencies (fixture-mode fallback; clear failure interpretation table parallel to MCP-SERVER-002-SMOKE Common failure_reason table) |
| 19 | Edge `admin_validation` smoke fails | NOT KNOWN AT DESIGN TIME — design plans Phase A.8 with 3-arg readback; HALT triggered only if real smoke fails. Design includes seeded-args reuse rationale and PASS gate ("at least ONE perArgument with positiveObservationCount >= 1") |
| 20 | Test forecast exceeds +300 without explicit rationale | PASS — forecast +80 to +110 with per-file breakdown in §8; well under HALT threshold |
| 21 | Working tree contains unclassified untracked files at PR creation | NOT KNOWN AT DESIGN TIME — operator-territory exclusions (`docs/testing-runs/`, `mcp021c-edge-smoke-*`, `netlify-prod.git`, `phase5-mcpserver002-*`) are KNOWN per intent brief §6; implementer + reviewer enforce |

**Active HALT risk:** none at design time. Triggers 18, 19, 21 are
runtime-only and cannot fire at design phase.

---

## 14. Brief ledger

| File | Why it matters | In-scope / Out-of-scope |
| --- | --- | --- |
| `docs/designs/MCP-SERVER-003-FAMILY-B-intent.md` | Operator-authored binding spec; §3 14-key list, §4 doctrine risks, §5 scope, §6 21 HALTs | binding for this card |
| `docs/audits/OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE-2026-05-27.md` | Byte-equal preservation proof + registry-pattern proof | binding precedent |
| `docs/audits/MCP-SERVER-002-SMOKE-2026-05-26.md` | Family A shipping smoke pattern | reference for smoke design |
| `docs/audits/MCP-021C-FAMILY-A-PROD-SMOKE-2026-05-26.md` | Family A production-mode PASS | reference; this card stays admin_validation only (Option A) |
| `src/features/nodeLabels/machineObservationDefinitions/familyB.ts` | Source-of-truth for 14 rawKeys + doctrine guards | READ ONLY (locked per §5 of intent brief); mirrored byte-equally into `mcp-server/lib/familyBKeys.ts` |
| `src/features/nodeLabels/nodeLabelTypes.ts` | `MachineObservationFamily` union (confirms `'disagreement_axis'` is binding) | READ ONLY |
| `src/features/nodeLabels/mcpBooleanObservationSchema.ts` | Wire shape Family B must conform to; schemaVersion constant | READ ONLY |
| `mcp-server/lib/familyRegistry.ts` | Shared registry primitive; the OPS refactor put this in place for additive registrations | READ ONLY (no shape change); USED in registration |
| `mcp-server/lib/familyRegistryInit.ts` | One-line addition site | EDIT (Family B register call) |
| `mcp-server/lib/familyAKeys.ts` | Pattern for Family-specific keys file | READ ONLY (pattern template); MIRROR for `familyBKeys.ts` |
| `mcp-server/lib/familyAPrompt.ts` | Pattern for Family-specific prompt file | READ ONLY (pattern template); MIRROR for `familyBPrompt.ts` |
| `mcp-server/lib/familyAAnthropic.ts` | Pattern for Family-specific Anthropic orchestrator | READ ONLY; MIRROR for `familyBAnthropic.ts` |
| `mcp-server/lib/familyABanListScan.ts` | Pattern for Family-specific ban-list scan | READ ONLY; MIRROR for `familyBBanListScan.ts` |
| `mcp-server/lib/familyAFixtureProvider.ts` | Pattern for Family-specific fixture provider | READ ONLY; MIRROR for `familyBFixtureProvider.ts` |
| `mcp-server/lib/familyBooleanRequestSchema.ts` | Shared validator; already family-aware after OPS refactor | READ ONLY (no shape change); behavior verified by Phase A.4 |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | Tool dispatcher; needs per-family provider routing | EDIT (per §7 diff) |
| `mcp-server/scripts/validate-family-a-response.ts` | Pattern for response-validator script | READ ONLY; MIRROR for `validate-family-b-response.ts` |
| `scripts/mcp-server-001-smoke.sh` | Hosted smoke script; needs Family B checks | EDIT (per §9: 2 new checks) |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | Edge Function's family enablement gate; line 69 has `productionEnabled: false` for `disagreement_axis` | READ ONLY (out of scope per intent brief §5 — locks Decision I to Option A) |
| `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` | Edge Function classifier core; consumes the family gate | READ ONLY |
| `mcp-server/tests/familyA*.test.ts` | Existing Family A tests; must continue to pass post-card | READ ONLY (regression coverage) |
| `mcp-server/tests/familyRegistry.test.ts` | Registry primitive tests | EDIT (+2 tests for real Family B registration) |
| `mcp-server/tests/familyRegistryInit.test.ts` | Init module tests | EDIT (+3 tests for Family B registration on import) |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | Shared validator tests | EDIT (+6-8 tests for Family B request shapes) |
| `docs/core/current-status.md` | Handoff section | EDIT (post-implementation) |

---

## 15. Decision I (Phase A.9) explicit conclusion

### Choice: **Option A (admin_validation-only)**

### Rationale

The operator's launch prompt §I asks the designer to choose between:
* **Option A:** Family B remains `admin_validation`-only for this card.
* **Option B:** Family B also supports production-mode MANUAL invocation
  (no auto-trigger), if the Edge gate already permits it.

The Edge Function's family-gating code at
`supabase/functions/_shared/booleanObservations/familyRegistry.ts:62-113`
defines `FAMILY_REGISTRY` as a frozen array. The relevant entry
(line 68-72):

```ts
{
  family: 'disagreement_axis',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

The Edge core (`classifyArgumentCore.ts:200-201`) calls
`filterFamiliesForMode(requestedFamilies, mode)`, which is the
deterministic gate per `familyRegistry.ts:135-150`:

```ts
if (mode === 'production' && entry.productionEnabled) {
  kept.push(family);
} else if (mode === 'admin_validation' && entry.adminValidationEnabled) {
  kept.push(family);
}
```

For `mode: 'production'` + `requestedFamilies: ['disagreement_axis']`,
`entry.productionEnabled === false`, so `kept` is empty. The
downstream pipeline still runs (it builds an MCP request with empty
`requestedFamilies`, which the validator routes to Family A via the
`DEFAULT_FAMILY_FOR_RAWKEY_CHECK` byte-equal anchor — see Phase A.4),
producing Family A observations rather than Family B. This would
SILENTLY substitute Family A for Family B in production-mode
manual calls, which is incorrect and confusing.

**To enable Option B safely**, the Edge `familyRegistry.ts:71` line
would need editing (`productionEnabled: false` → `true`). That edit
is OUT OF SCOPE per intent brief §5:
> "Edge Function changes beyond test-only import-path updates."

Therefore Option B is NOT achievable in this card without breaking
the intent-brief scope boundary. Designer chooses **Option A**.

Production-mode manual Family B (and downstream production
auto-trigger for Family B) live in a separate sequenced card —
likely `MCP-021C-EDGE-FAMILY-B-ENABLE` or similar — after
Family B's admin_validation output quality is validated by this
card's Phase 4 smoke.

### Implication for §10 Edge smoke

Edge smoke uses `mode: 'admin_validation'` exclusively. Production
mode is not exercised for Family B in this card.

### Implication for §13 HALT triggers

* Trigger #18 (hosted smoke fails) — unchanged; both Family B
  hosted checks (10, 11) run against the MCP server directly,
  independent of mode.
* Trigger #19 (Edge `admin_validation` smoke fails) — applies
  because Phase A.8 runs in admin_validation mode.
* Trigger NOT-EXISTING: there is no "production-mode smoke for
  Family B" gate in the intent brief, consistent with Option A.

### What this means for the next card

After this card's Family B PASS, the operator-authored sequence
options are:
1. **Production-mode manual enablement for Family B** — flip the
   Edge `productionEnabled` flag for `disagreement_axis` + add a
   guard test + Edge smoke. Small, surgical, separate card.
2. **Family C kickoff** — start `MCP-SERVER-004-FAMILY-C` per
   intent brief §11. Production enablement for Family B can
   sequence before, after, or in parallel.
3. **Production auto-trigger for Family B** — analogous to
   `MCP-021C-AUTO-TRIGGER-FAMILY-A`; gated on production-mode
   enablement.

The operator's POSTRUN-MCP-SERVER-003-FAMILY-B authorization
decision selects among these. Designer's recommendation: ship
Family B admin_validation, observe output quality in 1-2 weeks of
operator-initiated admin_validation calls, then flip production for
Family B and start Family C in parallel.

---

## 16. Operator steps (if any)

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
   Expect `11 PASSES, 0 FAILS` / `EXIT: 0`.
3. Acquire admin JWT (same pattern as OPS smoke Phase 3):
   ```bash
   curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
     -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
     -d '{"email":"$CDISCOURSE_ADMIN_EMAIL","password":"$CDISCOURSE_ADMIN_PASSWORD"}'
   ```
4. POST to Edge `classify-argument-boolean-observations` with
   `requestedFamilies: ['disagreement_axis']` + `mode: 'admin_validation'`
   + the 3 seeded args.
5. SQL readback against `argument_machine_observation_results` per
   §10 doctrine check.
6. Author audit doc at
   `docs/audits/MCP-SERVER-003-FAMILY-B-SMOKE-2026-05-27.md` per
   intent brief §9.
7. Delete temp files: `$HOME/mcp-hosted-token.current`,
   `%TEMP%/mcp-server-003-family-b-*.json`,
   `%TEMP%/mcp-server-003-family-b-admin-jwt.txt`.

No database migration. No code deploy beyond the standard merge →
Deno Deploy auto-deploy + Supabase Edge Function auto-deploy chain
(per Stage 5 hosting setup in CLAUDE.md).

---

## 17. Doctrine self-check

### cdiscourse-doctrine §1 (Score is gameplay, not truth)

* Family B prompt frames disagreement as structural-only, never as
  who is right.
* `disputes_value_weighting` doctrine guard ("both values are real")
  blocks correctness encoding.
* `disputes_relevance` doctrine guard ("requires a reason") blocks
  dismissal-as-relevance encoding.
* `disagreement_present` umbrella is structural ("is there
  disagreement at all"), not evaluative.
* Ban-list scan blocks model-emitted verdict tokens at the response
  boundary.
* System prompt's 7 absolute rules mirror Family A verbatim.

### cdiscourse-doctrine §4 (AI moderator hard limits)

* No deletion / modification of user content.
* No truth assignment.
* AI advisory: every Family B observation flows through the same
  Edge persistence + Source 6 rendering pipeline (out of scope for
  this card; the pipeline already enforces "future_source"
  disposition on the 14 Family B keys per the source taxonomy).
* AI calls are server-side Deno only (per the MCP server's
  architecture; this card adds zero client-side AI integration).

### cdiscourse-doctrine §6 (Secrets policy)

* `ANTHROPIC_API_KEY` reaches Anthropic via `callAnthropic`'s
  `x-api-key` header inside the Deno server; never logged.
* `MCP_SERVER_BEARER_TOKEN` is the hosted-server auth; smoke script
  redacts it as `[REDACTED]`.
* No new secret introduced.
* `familyBAnthropic.test.ts` includes the same API-key-never-logged
  assertions as Family A (per §8).

### cdiscourse-doctrine §7 (No AI calls from production app)

* Family B Anthropic call runs in the MCP server (Deno Deploy), not
  the production app.
* Zero `src/` or `app/` file touched.
* No new fetch / HTTP-client / SDK introduced.

### cdiscourse-doctrine §10a (Observations vs Allegations)

* Family B keys are all `kind: 'machine_observation'` per source
  taxonomy.
* `source: 'ai_classifier'` for all 14 keys.
* No `user_allegation` Family B variant proposed.
* The umbrella `disagreement_present` is the Timeline-eligible
  machine observation; the 13 sub-axes are Inspect-only.
* No verdictive labels emitted in any field.

### evidence-doctrine (engagement vs factual-standing separation)

* `disputes_evidence_applicability` (Family B retroactive #49) is
  the productive disagreement axis for evidence-applicability
  disputes; the source's `doctrineNotes` array already encodes
  "applicability dispute opens a focused sub-axis" — narrowing
  toward a defensible universe rather than blanket rejection.
* No popularity / engagement signal influences Family B
  classification.
* Family B observations feed downstream point-standing economy
  (per the source `doctrineNotes` arrays) but THAT integration is
  out of scope; this card returns the machine observations only.

### test-discipline (every public function has a test)

* Per §8: every new file has dedicated test coverage.
* New: `familyBKeys.test.ts`, `familyBKeysParity.test.ts`,
  `familyBPrompt.test.ts`, `familyBAnthropic.test.ts`,
  `familyBBanListScan.test.ts`, `familyBFixtureParity.test.ts`,
  `familyBResponseValidator.test.ts`, `familyBDispatch.test.ts`,
  `familyBDoctrineFixtures.test.ts`.
* Updated: `familyRegistryInit.test.ts` (+3), `familyRegistry.test.ts` (+2),
  `familyBooleanRequestSchema.test.ts` (+6-8).
* No `.skip` / `.only` introduced.
* Test count goes UP (forecast +80 to +110); no test removal.

### supabase-edge-contract

* No Edge Function code change.
* No new RLS rule.
* No new migration.
* Existing Edge family gate (`supabase/functions/_shared/booleanObservations/familyRegistry.ts`)
  is the binding control on production-mode Family B — and it's
  off, per Decision I Option A.
* No service-role usage introduced.

---

## 18. Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Implementer accidentally adds a Family C key | Low | Intent brief HALT #3 covers; reviewer reads `familyBKeys.ts` end-to-end during PR review; `familyBKeysParity.test.ts` enforces exact match |
| Family A test regression from dispatcher refactor | Medium | All Family A tests under `mcp-server/tests/familyA*.test.ts` remain unchanged; the dispatcher refactor reuses the Family A provider table when resolved family is `parent_relation`; OPS refactor smoke pattern proves byte-equal preservation works |
| Doctrine ban-list misses a Family-B-specific verdict shape | Medium | `familyBDoctrineFixtures.test.ts` includes the doctrine-stress fixture covering "propagandist" / "correct value" / "right" patterns; existing `DOCTRINE_BAN_PATTERNS` already covers these; new patterns deferred to a follow-on observability card |
| Model produces `disputes_value_weighting: true` for genuinely verdictive moves | Medium | §5.1 doctrine guard surfaces the source `falsePositiveGuards` clause verbatim in the prompt; `familyBDoctrineFixtures.test.ts` doctrine-stress fixture covers this; admin_validation smoke surfaces real cases for operator review |
| Edge `admin_validation` smoke fails because seeded args don't disagree | Low | Designer recommends staying with seeded args; the worst case is 0-1 positives across 3 args, which is still PASS per criteria "at least ONE positive"; operator may seed a fresh debate room if needed |
| Hosted smoke fails because Deno Deploy build hasn't deployed | Low | Operator step 1 verifies hosted `/health` shows post-merge build; if not, operator waits or triggers manual deploy |
| Hosted smoke fixture provider doesn't return a valid Family B response | Low | `familyBFixtureParity.test.ts` runs locally + asserts the canonical fixture passes validator + ban-list scan; if the fixture file is broken, the parity test fails the build before merge |
| Family B prompt token usage > 6000 input tokens | Low | 14 keys × ~80 tokens each = ~1,120; structural overhead ~500; total ~1,600 input tokens. Well under the 6,000 deferred-decision threshold from MCP-SERVER-002-SMOKE §11.3.3 |
| Implementer adds production-mode Family B by accidentally editing the Edge gate | Low | Intent brief §5 explicit lock-out; §12 of this design names the file as READ ONLY; HALT #18 covers if Edge `admin_validation` smoke detects production-mode side effects |
| Implementer changes `mcp-server/bootstrap.ts` (designer recommended SKIP) | Low | Listed in §12 lock-outs; OPS refactor §8 already documented designer's reasoning |
| Smoke script `[10-…]` / `[11-…]` checks fail due to fixture pathway not yet wired | Low | Fixture provider sees Family B canonical response; the smoke script's fixture-mode path is identical to Family A (validated by MCP-SERVER-001 + MCP-SERVER-002 smokes); operator confirms `MCP_SERVER_USE_FIXTURE_PROVIDER` env state before running smoke |

---

## 19. Out of scope (explicit list — reduces scope creep)

This card does NOT include any of:

* Family C (`misunderstanding_repair`), Family D (`evidence_source_chain`),
  Family E (`argument_scheme`), Family F (`critical_question`),
  Family G (`resolution_progress`), Family H (`claim_clarity`),
  Family I (`thread_topology`), Family J (`sensitive_composer`)
  — each is a separate future card.
* Production-mode Family B enablement at the Edge Function. (Per Decision I.)
* Production auto-trigger Family B (analogous to `MCP-021C-AUTO-TRIGGER-FAMILY-A`).
* OPS observability dashboards / per-family metrics endpoints.
* Persistence schema changes (e.g., new index on `family` column).
* RLS policy changes.
* UI surface for Family B observations (chips, tooltips, Inspect panel).
* Source 6 rendering changes (the existing rendering pipeline
  already handles Family B keys generically because each key has
  `source: 'ai_classifier'` and the Source 6 adapter is family-agnostic).
* Plain-language label registry edits for Family B (the upstream
  `nodeAnnotationsRegistry` / `nodeLabelPlainLabelMap` already has
  the 14 Family B keys per MCP-021A; no editing needed here).
* Engagement-credit / factual-standing scoring integration for
  Family B observations.
* Bot fixture runner integration of Family B classifier outputs.
* X News / xAI pilot integration of Family B annotations.
* CSV / JSONL export of Family B run rows.
* Documentation overhauls in `docs/conversation-gallery-ux.md` or
  similar (the Family B classifier is server-only; no doc
  reorganization needed).

---

## 20. Dependencies

### Upstream dependencies (this card assumes complete)

* MCP-021A (taxonomy + parser; commit `d6648b4`) — provides
  `src/features/nodeLabels/machineObservationDefinitions/familyB.ts`
  source of truth.
* MCP-021B (persistence + Source 6 adapter; commit `eaa1aeb`) —
  provides `argument_machine_observation_runs` /
  `argument_machine_observation_results` tables; family-agnostic
  schema accepts Family B rows after registry registers.
* MCP-021C-EDGE (runtime spine; commit `9a4de95`) — provides the
  Edge Function adapter that invokes MCP via JSON-RPC.
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

### Downstream blockers (cards that this design enables / blocks)

* **AUTHORIZES (post-PASS):** `MCP-SERVER-004-FAMILY-C` per intent
  brief §11.
* **AUTHORIZES (post-PASS):** future `MCP-021C-EDGE-FAMILY-B-ENABLE`
  card (production-mode manual flag flip).
* **AUTHORIZES (post-PASS):** future `MCP-021C-AUTO-TRIGGER-FAMILY-B`
  card.
* **AUTHORIZES (post-PASS):** future `OPS-MCP-OBSERVABILITY` card
  (2 families now justify per-family metrics).
* **BLOCKS:** `MCP-SERVER-003-BATCH-C-D-E` start until Family B
  PASS; serial batch enforcement per intent brief §11.

---

## 21. Open questions for the operator

None at design time. The Decision I selection (Option A —
admin_validation-only) is deterministic given the Edge family-gate
state. All other design choices fall within the intent brief's
explicit scope.

If the implementer encounters a Phase A-undocumented choice during
build (e.g., the umbrella/subtype prompt pattern doesn't yield
acceptable signal in initial mock testing; the per-family dispatch
table structure has an ergonomic alternative not captured in §7;
the test forecast lands outside +80 to +110), the implementer
should surface as a HALT for operator decision rather than
deciding silently. The design's binding choices (umbrella asks each
key independently; dispatcher uses provider-table pattern; test
forecast 98 midpoint) are designer's interpretive judgments and
are revisitable on implementer evidence.
