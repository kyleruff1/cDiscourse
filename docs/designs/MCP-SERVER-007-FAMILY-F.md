# MCP-SERVER-007-FAMILY-F — Critical-Question Boolean Observation Classifier (design)

**Status:** Design draft (Stage 2B: NOT REQUIRED — see §2 and §9)
**Epic:** MCP server family rollout (Family F of A-B-C-D-E-F sequence)
**Release:** Stage 6.x — Machine Observation classifiers
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/343
**Intent brief:** `docs/designs/MCP-SERVER-007-FAMILY-F-intent.md`
**Predecessors on main:** `423789c` (intent brief commit), built atop:
- `87a2784` audit(OPS-MCP-SMOKE-LINT-CI-WIRING): PASS (CI live)
- `b11f519` OPS-MCP-SMOKE-LINT-CI-WIRING ship (PR #342)
- `91a3664` OPS-MCP-SMOKE-DOCTRINE-HARDENING ship (PR #340)
- `bccb0c2` audit(MCP-SERVER-006-FAMILY-E): hosted completion PASS
- All Family A/B/C/D/E ships

**Branch:** `feat/MCP-SERVER-007-FAMILY-F`
**HEAD at design time:** `423789c`
**Card posture:** admin_validation-only (`productionEnabled=false`; production flip is Card 3 of the chain).

---

## 0. Goal (one paragraph)

Family F (`critical_question`) is the sixth boolean-observation family registered on the hosted MCP server, and the **critical-questions layer over Family E's Walton (1995, 2008) argumentation schemes**. It encodes 14 descriptive probes — `missing_warrant`, `unstated_assumption`, `authority_basis_missing`, `causal_mechanism_missing`, `analogy_mapping_missing`, `example_representativeness_unclear`, `consequence_probability_unclear`, `definition_boundary_unclear`, `criterion_weighting_unclear`, `alternative_explanation_available`, `counterexample_available`, `scope_limit_unstated`, `qualification_missing`, `comparison_baseline_missing`. The doctrine peril is **binary and existential**: right framing — "this argument has not yet answered the critical question X" (a descriptive flag on an absence/gap); wrong framing — "this argument is a fallacy because it failed to answer X" (a verdict on argument quality). This card extends the Family A→E pattern by adding the consumer-side mcp-server files (`familyFKeys.ts`, `familyFPrompt.ts`, `familyFAnthropic.ts`, `familyFBanListScan.ts`, `familyFFixtureProvider.ts`) plus ≥3 adversarial fixtures targeting the E↔F doctrine boundary, registers `critical_question` in the shared MCP family registry via a one-line addition to `familyRegistryInit.ts`, routes Family F requests through the dispatcher's provider table, and extends the hosted smoke script to 19 PASS checks. Per Phase 0 confirmation, the Edge Function family registry already has the Family F entry at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:95-97` (`productionEnabled: false, adminValidationEnabled: true`), so **no Edge `familyRegistry.ts` edit is required**. Stage 2B is **NOT REQUIRED** per Phase A.1: all 14 keys are uniform `source: 'ai_classifier'` via the shared `buildCritical(b)` factory (T1 disposed); no compound-key collision against A/B/C/D/E (T2 disposed); the doctrine-translation peril is BINDING but addressable via the same 5-layer defense Family E used for slippery_slope (T3 disposed); 14 keys × ~85 tokens fits MAX_TOKENS=1500 with ~80 token headroom (T4 disposed); Family F is structurally independent of E at the classifier level — F detects CQ absence in the current move, never reads E's output (T5 disposed). This card's smoke audit PR is the FIRST family-ship audit to reach the CI workflow with a non-empty in-scope set under the live audit-lint CI; Phase 7 enforcement-loop provenance subsection per D12 is BINDING.

Doctrine constraints that shape the design:

- **cdiscourse-doctrine §1, §4, §7, §10a** — every Family F observation is a critical-question probe (a descriptive flag on an absence/gap), never a verdict on argument quality; doctrine ban-list scan blocks model emission of banned tokens including Family F-specific verdict-framing extensions (D5 list); AI calls remain server-side Deno only.
- **cdiscourse-doctrine §6** — `ANTHROPIC_API_KEY` / `MCP_SERVER_BEARER_TOKEN` never logged.
- **evidence-doctrine** — critical-question detection is orthogonal to factual-standing assessment; flagging an unmet CQ does NOT lower the move's factual standing eligibility.
- **point-standing-economy** — Family F is descriptive structural observation; the unmet CQ is a productive inquiry probe (the operator can ASK the underlying question), never a fault attribution.
- **test-discipline** — every new public function ships with tests; test count strictly increases (forecast +95-130; HALT at +220 per intent §8).
- **supabase-edge-contract** — no Edge code change in this card; the Edge familyRegistry already has Family F `productionEnabled: false`.

---

## 1. Phase A.1 — Source verification (verbatim rawKey enumeration with sources + doctrine-risk grades)

Live read of `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` (file confirmed at commit `423789c`; HEAD).

### Family F source verification

**File header doctrine binding (lines 8-26 of `familyF.ts`):**
> "BINDING doctrine for every Family F entry … every entry carries a falsePositiveGuards clause warning against any 'this argument is wrong / weak / fallacious' framing in plain-language label / shortLabel / description. Family F flags a CRITICAL QUESTION the move's reasoning has not yet answered; it NEVER asserts the answer is unfavorable."

The shared `buildCritical(b)` factory (lines 52-76) pins every entry to:
- `kind: 'machine_observation' as const`
- `source: 'ai_classifier' as const`
- `family: 'critical_question' as const`
- `defaultSurface: 'inspect' as const`
- `disposition: 'future_source' as const`
- `visibleByDefault: false`

Every entry's `falsePositiveGuards` array ends with the shared `COMMON_DOCTRINE_GUARD` constant (line 79-80):
> "Do NOT mark TRUE as a verdict on argument quality; absence of an explicit X does not mean the argument is wrong. The critical question opens a productive inquiry, never a fault."

### Verbatim rawKey enumeration (14 entries; all `source: 'ai_classifier'`)

| # | rawKey (verbatim) | Line | source field | Walton/Toulmin/Peirce anchor | Doctrine-risk grade | F↔E partner |
| - | ----------------- | ---- | ------------ | ---------------------------- | ------------------- | ----------- |
| 1 | `missing_warrant` | 84 | `ai_classifier` | Toulmin (1958) — warrant licenses claim from grounds | **medium** | E's causal/principle/example schemes (warrant absence cuts across) |
| 2 | `unstated_assumption` | 118 | `ai_classifier` | Toulmin (1958) — backing | low | broadly across E schemes |
| 3 | `authority_basis_missing` | 148 | `ai_classifier` | Walton (1995) — expert-authority CQ | **medium** | E's `authority_reasoning_present` |
| 4 | `causal_mechanism_missing` | 178 | `ai_classifier` | Walton (1995) — causal CQ | **medium** | E's `causal_reasoning_present` |
| 5 | `analogy_mapping_missing` | 207 | `ai_classifier` | Walton (1995) — analogy CQ | **medium** | E's `analogy_reasoning_present` (E doctrine-risk #2) |
| 6 | `example_representativeness_unclear` | 236 | `ai_classifier` | Walton (1995) — example CQ | low | E's `example_reasoning_present` |
| 7 | `consequence_probability_unclear` | 265 | `ai_classifier` | Walton (1995) — consequence + **slippery-slope** CQ | **HIGH** | E's `slippery_slope_reasoning_present` (E doctrine-risk #1) AND `consequence_reasoning_present` |
| 8 | `definition_boundary_unclear` | 295 | `ai_classifier` | Walton (1995) — definition CQ | low | E's `definition_reasoning_present` |
| 9 | `criterion_weighting_unclear` | 324 | `ai_classifier` | Walton (1995) — classification + decision-criterion CQ | low | E's `classification_reasoning_present` |
| 10 | `alternative_explanation_available` | 354 | `ai_classifier` | Peirce — abductive CQ | **medium** | E's `abductive_explanation_present` (E doctrine-risk #3) |
| 11 | `counterexample_available` | 383 | `ai_classifier` | generalization CQ | low | broadly across E schemes |
| 12 | `scope_limit_unstated` | 411 | `ai_classifier` | Toulmin (1958) — qualifier | low | pairs with Family H claim_specificity_low (per source doctrineNotes) |
| 13 | `qualification_missing` | 439 | `ai_classifier` | Toulmin (1958) — qualifier | low | pairs with Family H modal_language_present (per source doctrineNotes) |
| 14 | `comparison_baseline_missing` | 468 | `ai_classifier` | structural CQ | low | (no specific E partner; broad applicability) |

**Total: 14 entries.** Verbatim match against intent brief §2 binding inventory. Verbatim match against the smoke audit MUST list per Phase 4b.

### Source-breakdown verification (Phase A.1 binding count)

- `auto_metadata`: **0 keys**
- `lifecycle`: **0 keys**
- `ai_classifier`: **14 keys** (all 14)

**Total: 14 = 0 + 0 + 14.** Uniform `ai_classifier`. **T1 DISPOSED** — no Subset filter required.

### Doctrine-risk grading (verdict-framing axis)

- **HIGH (1 key):** `consequence_probability_unclear` — partners with E's `slippery_slope_reasoning_present` (E's existential doctrine-risk key). If F's CQ output frames the probability gap as "the slippery-slope inference is therefore a fallacy", that crosses the E↔F doctrine boundary and reintroduces the exact failure mode Family E's 5-layer defense was built to prevent. This is the existential E↔F doctrine binding (D3) and the primary load-bearing key for Family F.
- **MEDIUM (4 keys):** `missing_warrant`, `authority_basis_missing`, `causal_mechanism_missing`, `analogy_mapping_missing`, `alternative_explanation_available` — each partners with an E scheme; verdict-framing risk is real but addressable via per-key `falsePositiveGuards` + the shared header doctrine block. (Note: this counts to 5; revising — `missing_warrant` is medium-risk because Toulmin's warrant absence is sometimes literature-framed as "argument failure"; the other four medium-risk keys explicitly pair with E doctrine-risk schemes per the table above.)
- **LOW (9 keys):** `unstated_assumption`, `example_representativeness_unclear`, `definition_boundary_unclear`, `criterion_weighting_unclear`, `counterexample_available`, `scope_limit_unstated`, `qualification_missing`, `comparison_baseline_missing` — descriptive structural probes; verdict-framing risk is low because these keys ask for an unstated element rather than judging an asserted one.

### Cross-family rawKey collision check (HALT trigger #2 evaluation)

Family A (16 keys, parent_relation), Family B (14 keys, disagreement_axis), Family C (17 keys, misunderstanding_repair), Family D (19 keys, evidence_source_chain Subset), Family E (16 keys, argument_scheme) vs Family F (14 keys, critical_question):

- Family A ∩ Family F = ∅ (Family A is structural parent-relations; Family F is CQ probes on the current move)
- Family B ∩ Family F = ∅ (Family B is disagreement axes; F is gap probes)
- Family C ∩ Family F = ∅ (Family C is repair/grounding)
- Family D ∩ Family F = ∅ (Family D is evidence-source-chain)
- Family E ∩ Family F = ∅ (E is scheme PATTERN detection; F is scheme CQ ABSENCE detection — distinct strings)

Highest-confusion candidates manually verified:
- `causal_mechanism_missing` (F) vs `causal_reasoning_present` (E) → distinct strings; F partners with E.
- `analogy_mapping_missing` (F) vs `analogy_reasoning_present` (E) → distinct strings; F partners with E.
- `consequence_probability_unclear` (F) vs `slippery_slope_reasoning_present` (E) vs `consequence_reasoning_present` (E) → distinct strings; F's CQ probes the probability/chain-step gap that E's scheme exhibits.
- `comparison_baseline_missing` (F) vs Family B's `disputes_definition` / Family D's `evidence_gap_present` → distinct strings.

Cross-mcp-server-lib grep (executed at design time, results in §1 of the report): no F rawKey appears as a string literal in any of `familyAKeys.ts` / `familyBKeys.ts` / `familyCKeys.ts` / `familyDKeys.ts` / `familyEKeys.ts`. The only matches are F rawKey REFERENCES from E's `falsePositiveGuards` strings — those are doctrine cross-references, NOT key registrations. The validator is unaffected.

**HALT trigger #2 NOT fired. T2 DISPOSED.** No cross-family compound-key collision; schema mirror needs no change.

### Per-trigger evaluation T1-T5

| Trigger | Description | Disposition |
| ------- | ----------- | ----------- |
| T1 | mixed source provenance | **NOT fires.** All 14 keys uniform `ai_classifier` (verified verbatim §1.A above). No Subset filter required. |
| T2 | compound rawKey collision (Family D pattern) | **NOT fires.** Cross-family collision matrix all-empty (§1.B above). Schema mirror response shape unchanged. |
| T3 | CQ keys imply correctness/fallacy if phrased poorly (E↔F doctrine boundary) | **NOT fires AS STAGE 2B TRIGGER**, but is BINDING DOCTRINE CONSTRAINT. Per intent §3, T3 is "ASSUMED-TRUE until A.1 explicitly proves false." This audit proves the translation is structurally tractable via the same 5-layer defense Family E built for `slippery_slope_reasoning_present`: (1) header doctrine block in the system prompt explicitly forbidding verdict framing for unmet CQs (§3 below); (2) per-key `falsePositiveGuards` on the 5 medium-risk + 1 high-risk keys carrying explicit verbatim doctrine guards (§3 below); (3) Family F-specific ban-list scan extending the shared `DOCTRINE_BAN_PATTERNS` with CQ-verdict tokens (§3 + D5 list); (4) 3+ adversarial fixtures targeting the E↔F doctrine boundary (§4); (5) Phase 4b live adversarial smoke verification on persisted `evidence_span` rows (§5 smoke plan). The pattern is identical to Family E's; the implementation steps are mechanical; no operator architectural input is required to pick the structure. T3 disposed as "structurally simple per the Family E precedent." This is not hand-waved — the precedent is 178 tests and a hosted-smoke PASS audit on `consequence_probability_unclear`-adjacent slippery-slope text. The Family F header doctrine block content (§3) is the binding structural specification; no further architecture is undetermined. |
| T4 | MAX_TOKENS bump beyond 1500 | **NOT fires.** Per Phase A.2 (§2 below): 14 keys × ~85 tokens ≈ 1190 output; envelope 1500; headroom ~310 tokens (~21%). Wider headroom than Family E (~60 tokens); structurally lighter load. MAX_TOKENS=1500 unchanged. |
| T5 | cross-family classifier dependency (F outputs depend on E outputs) | **NOT fires.** Family F is structurally independent at the classifier level. The Family F prompt classifies the CURRENT MOVE's text against 14 CQ probes; it does NOT read Family E's output. The F↔E coupling is at the DOCTRINE layer (the prompt's framing references "Walton's scheme has critical questions"), NOT at the data layer. The dispatcher routes F independently; the registry registers F independently; the response shape is independent. F never waits for E; E never waits for F. |

**Stage 2B determination: NOT REQUIRED.** All 5 triggers disposed with explicit per-trigger rationale grounded in either Phase A.1 source verification, Phase A.2 token budget projection, or the Family E precedent for E↔F doctrine translation.

If implementer Phase A surfaces ANY of:
- Compound-key collision in Family F
- A Family F key whose source is NOT `ai_classifier`
- A Family F key whose `defaultSurface` is NOT `inspect`
- Token budget exceeding 1500 with MAX_TOKENS=1500
- A schema mirror change requirement
- A migration requirement
- A Family A/B/C/D/E byte-equal violation

... that is a Stage 2B trigger AND a HALT. The implementer must surface to the operator before proceeding.

---

## 2. Phase A.2 — Token budget + latency projection

### Per-key token baseline

Family A: 16 keys × ~80 tokens = ~1280 output; envelope 1500; headroom ~220.
Family B: 14 keys × ~80 tokens = ~1120 output; envelope 1500; headroom ~380.
Family C: 17 keys × ~85 tokens = ~1445 output; envelope 1500; headroom ~55.
Family D: 19 keys × ~90 tokens = ~1710 output; envelope **1800**; headroom ~90 (Stage 2B bump).
Family E: 16 keys × ~85 tokens = ~1360 output; envelope 1500; headroom ~140.
**Family F: 14 keys × ~85 tokens = ~1190 output; envelope 1500; headroom ~310.**

The Family F per-key estimate (~85 tokens) reflects:
- CQ evidenceSpans are short by construction — they anchor an ABSENCE (the move that fails to state the warrant, the move that asserts cause without mechanism). The model anchors on the verbatim claim/grounds pair that triggered the CQ; mean span ~40-100 chars.
- Conservative-positives bias: most moves exhibit 0-2 CQ positives (intent brief §1; mirror of Family C/D/E heuristic).
- CQ probes are absence-oriented, so the evidenceSpan typically quotes ONE phrase (the unsupported claim or the bare ground), not a multi-step chain like Family E's slippery_slope.

### Family F budget summary

| Component | Estimate |
| --- | --- |
| Per-key output tokens | ~85 |
| 14 keys total | 14 × 85 = **1190** |
| JSON structure overhead | ~80 |
| **Output total** | **~1270** |

**MAX_TOKENS recommendation: 1500** (matches Family A/B/C/E; NO bump).

Headroom: 1500 - 1270 = **~230 tokens (~15%)**. Comfortably wider than Family E's ~60 / Family C's ~55. The 14-key Family F load is structurally lighter than Family E's 16 keys (no umbrella-cascade complexity, no slippery-slope multi-step anchoring, no abductive-vs-causal disambiguation requiring extra in-prompt framing).

**T4 DISPOSED. HALT trigger #16 NOT fired.** The design does not propose a MAX_TOKENS bump.

### Input-token budget

- System prompt: ~430 tokens (slightly shorter than Family E; one fewer doctrine-risk key needing explicit anchoring — F has 1 high-risk key vs E's 3-key explicit-anchor block)
- User-prompt scaffolding (instructions, JSON shape, doctrine anchors, conservative-positives reminder): ~660 tokens
- Definitions block (14 entries × ~110 tokens each): ~1540 tokens
- Move text + parent text (capped at 8000 chars each ≈ ~2000 tokens each at typical density): up to ~4000 tokens worst case
- Thread context (capped at 8000 chars ≈ ~2000 tokens worst case)

Worst-case input estimate ≈ ~8630 tokens. Well under Claude's 200K context budget; comfortably under the 6000-token deferred threshold from MCP-SERVER-002-SMOKE §11.3.3.

### Latency projection

Family E baseline (per intent §3): 16 keys × 3 args = 16.73s observed (hosted smoke + Phase 3 Edge).

Family F projection (linear scaling): 14 keys × 3 args ≈ **14.6s** (≈ 16.73s × 14/16). Conservative ceiling: 18s including TLS / cold-start variance on Deno Deploy.

The lighter token budget (~1190 output vs E's ~1360) suggests Family F may run slightly faster end-to-end. Phase 4 / Phase 7 observability will confirm; no operator action required pre-merge.

### Token budget verdict

**MAX_TOKENS=1500 sufficient: YES.** Per intent §4 D8: "T4 NOT fires (fits MAX_TOKENS=1500): unchanged."

---

## 3. Phase A.3 — E↔F doctrine binding design

### Family F system-prompt-level doctrine framing (verbatim header doctrine block)

Per intent §4 D3, the Family F system prompt MUST frame ALL 14 CQ probes as DESCRIPTIVE flags on ABSENCE, never as verdicts on argument quality. Designer-bound verbatim system prompt (`familyFPrompt.ts:FAMILY_F_SYSTEM_PROMPT`):

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

You classify whether an argument MOVE has not yet answered one or more of 14 CRITICAL
QUESTIONS that productive inquiry would raise about the move's reasoning. Each question is
a structural observation about an ABSENCE or GAP — a warrant left implicit, an assumption
left unstated, an authority cited without basis, a cause asserted without mechanism, an
analogy used without mapping, an example offered without representativeness, a consequence
predicted without probability, a definition applied without boundary check, a criterion
invoked without weighting, an effect inferred without alternative explanations addressed,
a generalization made where counterexamples exist, a claim made without scope limits, a
claim made without modal qualification, a comparison made without baseline.

CRITICAL DOCTRINE — critical questions are PRODUCTIVE PROBES, never verdicts:
- A critical question flags a GAP the move has not yet filled. The gap MAY be filled by a
  follow-up clarification, a parent move's context, or a future reply. The CQ does NOT
  assert the gap is fatal, the inference is fallacious, the argument is weak, the reasoning
  is wrong, or the claim is invalidated. The CQ opens a productive inquiry; it never closes
  one with a verdict.
- A critical question NEVER implies the argument scheme it probes is a fallacy. Family E
  detects argument schemes (causal, analogy, example, authority, consequence, slippery-slope,
  etc.); Family F probes the critical questions associated with those schemes. The two are
  complementary, descriptive, and structurally independent. An unmet CQ does NOT mean E's
  scheme is fallacious. Per Walton (1995, 2008), every scheme has critical questions that
  PROBE without REJECTING the scheme.
- consequence_probability_unclear is the highest-doctrine-risk CQ. It partners with Family E's
  slippery_slope_reasoning_present (which E treats descriptively, never as a fallacy). When
  this CQ flags TRUE on a move that exhibits slippery-slope reasoning, the model's output
  MUST NOT call the slippery-slope inference a fallacy, fallacious, weak, invalid, bad
  reasoning, flawed, wrong, proves wrong, refutes, invalidates, an unmet-means-fallacy, or
  any verdict on argument quality. The output anchors the PROBABILITY GAP (which step of the
  chain lacks a probability anchor), never the conclusion that the chain is bad reasoning.

A move can simultaneously have multiple unmet CQs (e.g., causal_mechanism_missing AND
counterexample_available AND scope_limit_unstated). CQ positives are usually sparse — most
moves have 0 to 2 unmet CQs; few have more than 4.

For each requested rawKey you answer true (the CQ is unmet by this move) or false (the CQ is
either met OR not applicable to this move). Provide a short confidence band and an optional
evidenceSpan from the move body anchoring the gap. Return ONLY the JSON object the user
prompt describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a CQ is genuinely unmet (rather than
addressed obliquely, addressed by the parent, or not applicable), answer false. CQ probes are
sparse — do NOT mark all rawKeys true. The CQ MUST be clearly absent or clearly inadequate
to answer true; partial answers count as answered.
```

The 7 absolute rules block (lines 4-12) is byte-equal to Family A/B/C/D/E — a stable contract enforced by `familyFPrompt.test.ts`.

### Per-key `falsePositiveGuards` for medium- and high-risk Family F keys (verbatim, BINDING regardless of Stage 2B)

The Family F `FAMILY_F_PROMPT_ENTRIES` entries for the 6 doctrine-risk keys MUST surface these per-key guards verbatim (Designer-bound):

#### `consequence_probability_unclear` (HIGH RISK; E partner: `slippery_slope_reasoning_present`)

```
falsePositiveGuards:
  "Do NOT mark TRUE for moves that hedge appropriately (probably, may, tends to). Do NOT mark TRUE for moves that are descriptive rather than predictive. DOCTRINE: this is a CRITICAL QUESTION about probability anchoring, never a verdict that the move's reasoning is a fallacy. This CQ partners with Family E's slippery_slope_reasoning_present, which Family E treats descriptively. When this CQ flags TRUE on a move with chain-of-consequences reasoning, the model's output evidenceSpan MUST be a verbatim quote from the move anchoring WHERE the probability gap appears (e.g., a specific transition step that lacks a probability anchor) — it MUST NOT contain words like 'fallacy', 'fallacious', 'slippery-slope fallacy', 'weak argument', 'invalid', 'invalid argument', 'flawed', 'flawed reasoning', 'wrong', 'bad reasoning', 'logical error', 'informal fallacy', 'proof of', 'unmet-means-fallacy', 'proves wrong', 'refutes', 'invalidates', or any quality judgment. If the move's text itself contains the word 'fallacy' (e.g., 'critics call this a fallacy, but…'), the model may still detect the unmet probability CQ if the gap is present, but the model's own output must NOT echo or assert the fallacy framing. The evidenceSpan must anchor the probability gap, not the fallacy framing. The CQ opens an inquiry; never closes one with a verdict."
```

#### `analogy_mapping_missing` (MEDIUM RISK; E partner: `analogy_reasoning_present`)

```
falsePositiveGuards:
  "Do NOT mark TRUE for moves that specify the mapping briefly. Do NOT mark TRUE for moves that do not use analogy. DOCTRINE: this is a CRITICAL QUESTION about analogy mapping, never a verdict that analogy reasoning is fallacious. The CQ partners with Family E's analogy_reasoning_present (Walton's analogy scheme). The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'bad reasoning', 'wrong', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the unstated mapping, not a judgment about the analogy's quality."
```

#### `alternative_explanation_available` (MEDIUM RISK; E partner: `abductive_explanation_present`)

```
falsePositiveGuards:
  "Do NOT mark TRUE for moves that address alternatives. Do NOT mark TRUE for moves using controlled comparison. DOCTRINE: this is a CRITICAL QUESTION on abductive reasoning (Peirce: inference to best explanation), never a verdict that abductive reasoning is fallacious. The CQ partners with Family E's abductive_explanation_present. The output MUST NOT contain words like 'fallacy', 'invalid', 'flawed', 'weak', 'wrong', 'bad reasoning', 'proves wrong', 'refutes'. The evidenceSpan must anchor the unaddressed alternative, not a judgment about the inference's quality."
```

#### `causal_mechanism_missing` (MEDIUM RISK; E partner: `causal_reasoning_present`)

```
falsePositiveGuards:
  "Do NOT mark TRUE for moves that propose any mechanism (even hedged ones). Do NOT mark TRUE for moves that note correlation without claiming causation. DOCTRINE: this is a CRITICAL QUESTION on causal scheme mechanism, never a verdict that the causal claim is fallacious or false. The CQ partners with Family E's causal_reasoning_present. The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'wrong', 'bad reasoning', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the unstated mechanism, not a judgment about the causal claim's validity."
```

#### `authority_basis_missing` (MEDIUM RISK; E partner: `authority_reasoning_present`)

```
falsePositiveGuards:
  "Do NOT mark TRUE for moves that name the authority and its expertise. Do NOT mark TRUE for moves that cite specific evidence alongside the authority. DOCTRINE: this is a CRITICAL QUESTION on Walton's expert-authority scheme, never a verdict that the authority appeal is fallacious. The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'wrong', 'bad reasoning', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the unsourced authority phrase, not a judgment about the appeal's validity."
```

#### `missing_warrant` (MEDIUM RISK; broad E coverage — pairs with causal/principle/example schemes)

```
falsePositiveGuards:
  "Do NOT mark TRUE just because the move is short; brevity is not absence-of-warrant. Do NOT mark TRUE for moves where the warrant is implicit-but-obvious (e.g., counting cases entails the count). Do NOT mark TRUE for value-claims that do not require an empirical warrant. DOCTRINE: this is a CRITICAL QUESTION on Toulmin's warrant structure, never a verdict that the argument is unwarranted, invalid, or wrong. Plain-language framing: 'what would warrant this claim?', NEVER 'this claim is unwarranted'. The output MUST NOT contain words like 'fallacy', 'unwarranted-as-verdict', 'invalid', 'flawed', 'wrong', 'bad reasoning', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the ground+claim pair where the warrant is absent, not a judgment about the argument's quality."
```

The 8 low-risk Family F keys (unstated_assumption, example_representativeness_unclear, definition_boundary_unclear, criterion_weighting_unclear, counterexample_available, scope_limit_unstated, qualification_missing, comparison_baseline_missing) carry the SHORTER falsePositiveGuards mirroring the source `familyF.ts` definitions plus the COMMON_DOCTRINE_GUARD: "DOCTRINE: this is a productive critical question; absence of an explicit X does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens."

### Family F-specific ban-list extensions (D5 BINDING)

`mcp-server/lib/familyFBanListScan.ts` is a NEW file mirroring `familyEBanListScan.ts`. It uses the shared `DOCTRINE_BAN_PATTERNS` (Family A/B/C/D/E's patterns) AND ADDS a Family F-only extension array.

**Designer-bound Family F-specific ban-list patterns (D5 list verbatim):**

```ts
// mcp-server/lib/familyFBanListScan.ts
export const FAMILY_F_BAN_PATTERNS: readonly RegExp[] = Object.freeze([
  // D5 BINDING token list — CQ-as-verdict framings unique to Family F.
  // The CQ-specific compound phrase "unmet-means-fallacy" captures the
  // exact failure mode the intent §6 trigger #17 enumerates.
  /(?:^|[^a-z0-9])unmet[\s_-]+means[\s_-]+fallacy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])proves[\s_-]+wrong(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalidates(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])refutes(?:[^a-z0-9]|$)/i,

  // Single-token verdict framings (Family E precedent set; replicated for
  // defense-in-depth at the F layer — Family E already scans these on its
  // OWN responses, but a cross-family request that misroutes through F
  // would bypass Family E's scanner. Per the Family E precedent §3 +
  // intent §4 D5: scan at Family F.).
  /(?:^|[^a-z0-9])fallacy(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])fallacious(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])weak[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])invalid[\s_-]+argument(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])bad[\s_-]+reasoning(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])flawed(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])wrong(?:[^a-z0-9]|$)/i,
  /(?:^|[^a-z0-9])proof[\s_-]*of(?:[^a-z0-9]|$)/i,
]);
```

Per intent §4 D5: "Ban-list scan extends shared `DOCTRINE_BAN_PATTERNS` with critical-question-specific verdict tokens: `unmet-means-fallacy`, `proves-wrong`, `invalidates`, `refutes` (used as verdict), `fallacy`, `fallacious`, `weak argument`, `invalid argument`, `bad reasoning`, `flawed`, `wrong`, `proof of`."

**Why Family-F-scoped and not shared:**
- `invalidates` and `refutes` may legitimately appear in Family B `disputes_validity` evidenceSpans ("the inference invalidates the parent's claim" — used descriptively, not as a CQ verdict). Promoting them to the shared list would break Family A/B/C/D outputs.
- The Family F doctrine binding is existential at the CQ-as-verdict axis. This scanner is the runtime enforcement for the F-specific failure mode.
- The shared `DOCTRINE_BAN_PATTERNS` in `doctrineBanList.ts` remains byte-equal preserved (HALT trigger #4-protection for Family E byte-equal AND intent §5 "Shared `DOCTRINE_BAN_PATTERNS` modification FORBIDDEN").

### Ban-list scan scope (D5 BINDING)

The Family F ban-list scan MUST cover these fields:

1. **`evidenceSpan` strings** — every Family F rawKey's evidenceSpan (14 max — one per rawKey). Scan against shared `DOCTRINE_BAN_PATTERNS` AND `FAMILY_F_BAN_PATTERNS`.
2. **`modelInfo.serverName`** — scan against both pattern lists.
3. **`modelInfo.classifierSetVersion`** — scan against both pattern lists.
4. **`content[text]` transitively** — per the dispatcher pattern (`classifyArgumentBooleanObservations.ts:446`), `content[text]` is `JSON.stringify(responseCheck.value)`. Because every nested string field is already scanned by `familyFBanListScan.ts` BEFORE the tool result is constructed (Step 5 happens before Step 6), the JSON-stringified `content[text]` cannot contain a banned token that did not first appear in `evidenceSpan` / `modelInfo.serverName` / `modelInfo.classifierSetVersion`.

NOT scanned: `nodeId`, `schemaVersion`, `checkedRawKeys` entries, `confidence` band values, `observations` boolean values — same exclusions as Family A/B/C/D/E. Per `mcpBooleanObservationSchemaMirror.ts`, these are constrained to non-prose symbol sets by the validator.

**HALT trigger #19 mitigation:** `familyFBanListScan.test.ts` includes explicit assertions that EVERY token from intent §4 D5 is scanned and rejected.

### What the model may detect vs what the model may NOT output

**Per intent §2:**
- The model MAY detect an unmet critical question when the move's reasoning has not addressed it.
- The model MAY anchor the detection with a verbatim quote from the move body in `evidenceSpan` showing the gap (the claim without the warrant, the cause without the mechanism, the chain step without the probability anchor).
- The model MUST NOT output any of the following tokens in its OWN strings: `fallacy`, `fallacious`, `weak argument`, `invalid argument`, `invalid`, `bad reasoning`, `flawed`, `wrong`, `proof of`, `unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`, `logical error`, `informal fallacy`.
- If the move's INPUT TEXT contains "fallacy" (the adversarial Fixture C case), the model MAY still set the relevant CQ to `true` if the gap is present; the model MUST NOT echo "fallacy" in its evidenceSpan or any other output field. The evidenceSpan must anchor the CQ gap (the missing probability anchor, the missing mapping, the missing mechanism), not the fallacy framing.

This is the existential doctrine constraint of this card.

### Cross-key doctrine constraint

All 14 critical-question outputs remain DESCRIPTIVE flags on absence/gap (per cdiscourse-doctrine §10a). Per-rawKey prompt-entry text MUST NOT contain the Family F ban-list tokens except when negating them ("MUST NOT call this a fallacy"; "never a verdict") — mirroring the system-prompt negation pattern and Family E precedent. The 14 source entries in `familyF.ts` already conform — the `doctrineNotes` arrays anchor on cdiscourse-doctrine §10a, Walton (1995), Peirce, Toulmin (1958), and MCP-020 §"Rejected labels"; the `doctrineNotes` never themselves contain bare banned tokens.

---

## 4. Phase A.4 — Adversarial fixture design (D4 BINDING)

Per intent §4 D4, this card ships ≥3 adversarial fixtures targeting the E↔F doctrine boundary. Designer-bound: **3 mandatory fixtures + 2 optional fixtures**. All fixtures follow the `mcp-server/fixtures/classify-argument-boolean-observations.family-e-canonical-request.json` shape — `{ tool, input }` wrapper.

### Fixture A — Scheme present, CQ unmet (mandatory; trigger #17 doctrine probe)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-f-cq-unmet-slippery-slope-request.json`

**Purpose:** A move exhibits E's `slippery_slope_reasoning_present` scheme; F's `consequence_probability_unclear` CQ is unmet (no probability anchors on chain steps). F must flag the unmet CQ; F output must NOT label E's scheme as a fallacy.

**Input move text + parent text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-f-cq-unmet-slippery-slope-node",
    "parentNodeId": "fixture-f-cq-unmet-slippery-slope-parent",
    "currentText": "[fixture] If we permit this regulation to pass, government agencies will start defining acceptable speech for one category. Once they do that, they will expand to a second category, then a third, then a fourth — until we have arrived at full-scope content suppression, with no clear stopping point along the way.",
    "parentText": "[fixture] A targeted regulation against fraudulent product claims has been proposed.",
    "threadContextExcerpt": "[fixture] Debate room: scope of platform content regulation.",
    "requestedFamilies": ["critical_question"],
    "requestedRawKeys": [
      "consequence_probability_unclear",
      "missing_warrant",
      "alternative_explanation_available"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `consequence_probability_unclear`: **true (high confidence)** — the move chains 4 steps from proposal to bad final state; no step carries a probability anchor or hedge.
- `missing_warrant`: may be true — the warrant linking "regulation in one category" to "full-scope suppression" is not made explicit.
- `alternative_explanation_available`: false (this CQ is for abductive inference, not chained consequence).

**Doctrine assertions (test):** the model's `evidenceSpan["consequence_probability_unclear"]` MUST:
- Anchor the PROBABILITY GAP (e.g., quote "they will expand to a second category, then a third, then a fourth" — showing the chain step that lacks probability framing).
- Contain ZERO of: `fallacy`, `fallacious`, `weak`, `invalid`, `flawed`, `bad reasoning`, `logical error`, `wrong`, `proof of`, `unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`.

**Rationale (per-fixture catch):** This is the existential E↔F doctrine boundary fixture. The slippery-slope text is the same text Family E's smoke run successfully classified WITHOUT fallacy framing (Family E hosted-completion PASS evidence on F2 + F3). This fixture proves Family F can flag the unmet probability CQ on the same text WITHOUT labeling E's scheme a fallacy. A FAIL here is the MCP-020 violation Card 3 of the prior chain prevented for E — recurring at F.

### Fixture B — Scheme present, CQ met (mandatory; doctrine-clean baseline)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-f-cq-met-baseline-request.json`

**Purpose:** A move exhibits E's `slippery_slope_reasoning_present` AND addresses the probability CQ via explicit anchors. F should produce 0 positives or different positives than Fixture A. Establishes a doctrine-clean negative baseline (CQ MET).

**Input move text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-f-cq-met-baseline-node",
    "parentNodeId": "fixture-f-cq-met-baseline-parent",
    "currentText": "[fixture] If we permit this regulation to pass — based on the 2018 EU intermediary-liability case data showing 12 of 15 jurisdictions expanded scope within 24 months — government agencies are likely (around a 70-80% rate, per the meta-analysis) to expand to a second category. From there, the empirical pattern shows about a 50% probability of further expansion, declining to ~30% at the third step. The expected outcome under enforcement-similar conditions is moderate-scope suppression within 5 years, not full-scope.",
    "parentText": "[fixture] A targeted regulation against fraudulent product claims has been proposed.",
    "threadContextExcerpt": "[fixture] Debate room: scope of platform content regulation; CQ-met baseline variant.",
    "requestedFamilies": ["critical_question"],
    "requestedRawKeys": [
      "consequence_probability_unclear",
      "missing_warrant",
      "comparison_baseline_missing"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `consequence_probability_unclear`: **false** — the move cites specific probabilities (70-80%, 50%, 30%) per chain step. The CQ is MET.
- `missing_warrant`: likely false — the warrant (the 2018 EU case data + meta-analysis) is named.
- `comparison_baseline_missing`: likely false — the baseline (enforcement-similar conditions) is stated.

**Doctrine assertion (test):** every Family F positive in this fixture (which should be 0 or near-0) must have a doctrine-clean evidenceSpan. The fixture establishes that F is NOT prone to false positives when the CQ is genuinely met.

**Rationale:** Doctrine-clean baseline. Proves Family F doesn't fire on moves that DO answer the critical questions. Without this fixture, Family F could "always fire" and the tests would still pass shallowly. Fixture B is the asymmetric proof that F's CQ probes are calibrated, not unconditional.

### Fixture C — Input contains "fallacy"; F output must NOT echo (mandatory; existential adversarial)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-f-cq-adversarial-fallacy-word-request.json`

**Purpose:** Adversarial — the user text itself contains the word "fallacy" (the existential doctrine constraint mirror of Family E Fixture #2 / amendment §2.2). F must still detect the unmet CQ WITHOUT echoing the fallacy framing.

**Input move text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-f-cq-adversarial-fallacy-word-node",
    "parentNodeId": "fixture-f-cq-adversarial-fallacy-word-parent",
    "currentText": "[fixture] Critics call this a slippery-slope fallacy when I lay out the chain, but the chain is real and the probabilities are not the point: once a single category gets restricted, the next category follows in the same legislative session, and from there to a third and fourth, ending in broad-scope content rules. Asking me for probability anchors is itself a fallacy of misplaced precision.",
    "parentText": "[fixture] A targeted regulation against fraudulent product claims has been proposed.",
    "threadContextExcerpt": "[fixture] Debate room: scope of platform content regulation. Move uses 'fallacy' TWICE in input as adversarial test.",
    "requestedFamilies": ["critical_question"],
    "requestedRawKeys": [
      "consequence_probability_unclear",
      "missing_warrant",
      "alternative_explanation_available"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `consequence_probability_unclear`: **true** — the move explicitly REJECTS providing probability anchors ("probabilities are not the point"; "misplaced precision"); the CQ is unmet by the move's own admission.
- `missing_warrant`: likely true — the warrant for "next category follows in the same legislative session" is asserted without backing.
- `alternative_explanation_available`: may be true.

**Doctrine assertion (test):** the model's `evidenceSpan` for EVERY positive must:
- Anchor the gap (the explicit refusal to provide probability anchors; the bare assertion without warrant).
- Contain ZERO of the F ban-list tokens — EVEN THOUGH the input contains "fallacy" twice. The model must NOT lift the fallacy framing from the input into its evidenceSpan.

**Rationale:** This is the existential adversarial test — the F-equivalent of Family E's amendment §2.2. Proving F can be presented with the word "fallacy" in the input and still produce doctrine-clean output is the binding adversarial proof against the MCP-020 failure mode at the CQ layer. A FAIL here is HALT and revert.

### Fixture D — Multi-CQ with mixed states (OPTIONAL; designer-recommended for breadth)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-f-multi-cq-mixed-request.json`

**Purpose:** Multi-CQ — a move where some CQs are met, some are unmet. Verifies the classifier doesn't unconditionally mark all rawKeys true or false; calibrates F's selectivity.

**Input move text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-f-multi-cq-mixed-node",
    "parentNodeId": "fixture-f-multi-cq-mixed-parent",
    "currentText": "[fixture] Library funding boosts literacy — Pittsburgh, Detroit, and Indianapolis all show measurable gains in the 5 years following sustained funding increases. The mechanism is expanded program hours plus more staff for tutoring. The Australia case is an outlier because of concurrent budget cuts.",
    "parentText": "[fixture] Should the city council approve sustained library funding?",
    "threadContextExcerpt": "[fixture] Debate room: library funding policy. Mixed-CQ-state fixture.",
    "requestedFamilies": ["critical_question"],
    "requestedRawKeys": [
      "causal_mechanism_missing",
      "example_representativeness_unclear",
      "counterexample_available",
      "missing_warrant",
      "scope_limit_unstated",
      "qualification_missing"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `causal_mechanism_missing`: **false** — the mechanism (expanded program hours, more staff) is stated.
- `example_representativeness_unclear`: **true** — 3 cities cited but representativeness not addressed.
- `counterexample_available`: **false** — Australia counterexample is addressed.
- `missing_warrant`: false — examples + mechanism provide warrant.
- `scope_limit_unstated`: **true** — "boosts literacy" claim has no scope qualifier (everywhere? always? all libraries?).
- `qualification_missing`: **true** — categorical assertion without modal qualifier.

**Doctrine assertion (test):** every positive's evidenceSpan must be doctrine-clean. The variety proves F's discrimination across the 14-key space.

**Rationale:** Calibration fixture. Without a mixed-CQ-state fixture, the implementation could plausibly emit "all 14 true" or "all 14 false" and still satisfy A/B/C. D is the precision proof.

### Fixture E — Adversarial verdict-baiting wording (OPTIONAL; defense-in-depth)

**File:** `mcp-server/fixtures/classify-argument-boolean-observations.family-f-adversarial-verdict-baiting-request.json`

**Purpose:** A move whose framing actively invites verdict-style critique (using words like "wrong", "flawed", "invalid" in NEGATED or quoted form). F must detect the underlying CQ patterns without lifting the verdict words into its output.

**Input move text:**
```json
{
  "tool": "classify_argument_boolean_observations",
  "input": {
    "schemaVersion": "mcp-021.machine-observations.boolean.v1",
    "nodeId": "fixture-f-adversarial-verdict-baiting-node",
    "parentNodeId": "fixture-f-adversarial-verdict-baiting-parent",
    "currentText": "[fixture] My opponent will say this argument is 'invalid' or 'flawed' or 'wrong' or a 'fallacy' — I anticipate the labels. But the substance stands: experts say carbon taxes work. The data is in. That's the proof.",
    "parentText": "[fixture] Should the city adopt a carbon tax?",
    "threadContextExcerpt": "[fixture] Debate room: carbon tax adoption. Move USES verdict words in input as bait.",
    "requestedFamilies": ["critical_question"],
    "requestedRawKeys": [
      "authority_basis_missing",
      "missing_warrant",
      "scope_limit_unstated"
    ],
    "definitions": {},
    "timeoutMs": 12000
  }
}
```

**Expected positives:**
- `authority_basis_missing`: **true** — "experts say" without naming the authority's basis.
- `missing_warrant`: likely true — "the data is in" without specifying what data licenses the conclusion.
- `scope_limit_unstated`: likely true — "carbon taxes work" without scope qualifiers.

**Doctrine assertion (test):** evidenceSpans MUST anchor structural gaps (the unsourced "experts say"; the unspecified data; the unqualified universal). MUST NOT lift "invalid" / "flawed" / "wrong" / "fallacy" / "proof of" from the input into the output (the F ban-list catches `proof of`, `wrong`, `flawed`, `invalid`, `fallacy`).

**Rationale:** Defense-in-depth. The input deliberately CONTAINS the bait words; F must demonstrate it can produce clean structural anchors that bypass the bait. Mirrors Family E Fixture C amendment §2.2 in spirit, applied to the CQ output.

### Fixture text design intent

**No real-world political figures.** No current events that age out. Designer-authored synthesized text drawn from realistic library / housing / regulation / EV / climate / carbon tax domains (consistent with Family B/C/D/E fixtures). The slippery-slope adversarial fixture A reuses the exact text Family E's `family-e-slippery-slope-clear-request.json` uses, ensuring E and F can be cross-tested on the same input.

### Additional canonical / shape response fixtures

| Fixture | Purpose | Positive rawKeys (illustrative) |
| --- | --- | --- |
| `family-f-canonical-response.json` | Full 14-key Family F response; canonical baseline; covers the Fixture A input | `consequence_probability_unclear` (true, high), `missing_warrant` (true, medium), others false |
| `family-f-malformed-response.json` | Invalid response shape (missing `confidence` for a key in `observations`) | rejected by `validateMcpBooleanObservationResponse` |
| `family-f-ban-list-response.json` | Response with a smuggled "fallacy" token in `evidenceSpan` for `consequence_probability_unclear` | rejected by `scanFamilyFBooleanResponseForBanList` with `path='evidenceSpan.consequence_probability_unclear'` |
| `family-f-canonical-request.json` | Canonical 14-key Family F request (covers Fixture B input) | (request fixture; no positives field) |
| `family-f-no-cq-unmet-request.json` | Adversarial — every CQ addressed; expected all-false output | NONE — all 14 false |

**Total request fixtures: 8** (5 mandatory + 3 supporting). **Total response fixtures: 3** (canonical, malformed, ban-list).

---

## 5. Phase A.5 — Test plan + smoke plan

### Test forecast: +95 to +130 new tests (midpoint ~112)

Family E shipped with 178 Deno tests (per intent §8 reference). Family F has 14 keys vs Family E's 16 keys (-12.5%), but ships the same depth of doctrine coverage (header doctrine block + 6 per-key guards + ban-list scan + adversarial test file + adversarial fixtures). Family C shipped with ~107 tests; Family D with 129; Family E with 178. Net forecast: **+95 to +130** (midpoint ~112), within intent §8 band of +90 to +180 and well below the +220 HALT ceiling.

**Test count tracking baseline:** Jest 18,153 / Deno 792 baseline (per launch state). Post-merge expected: Jest +8 (Edge familyRegistry test) ≈ 18,161; Deno +95-130 ≈ 887-922.

**HALT trigger forecast: +220 NOT FIRED.** The forecast intentionally tracks below the +180 intent upper band to leave room for natural variance during implementation.

Per-file forecast (mirror of Family E's structure plus E↔F doctrine boundary file):

| File | NEW / UPDATED | Test count (est) | Coverage |
| --- | --- | --- | --- |
| `mcp-server/tests/familyFKeys.test.ts` | NEW | 9-10 | `FAMILY_F_RAW_KEYS` has 14 entries; binding list matches `familyF.ts`; no extras; no dupes; `FAMILY_F_PROMPT_ENTRIES` has 14 entries; every entry has required verbose fields; per-key falsePositiveGuards on the 6 doctrine-risk keys contain verbatim doctrine guards; `FAMILY_F_CLASSIFIER_SET_VERSION === 'family-f-v1'`. Mirrors `familyEKeys.test.ts`. |
| `mcp-server/tests/familyFKeysParity.test.ts` | NEW | 8-9 | Server-side rawKey literals all appear in upstream `familyF.ts`; upstream file has exactly 14 rawKey declarations and all are in server-side constant; cross-family A∩F / B∩F / C∩F / D∩F / E∩F all empty (HALT #2 guard); uniform `ai_classifier` source (no Subset filter; HALT #15 guard). Mirrors `familyEKeysParity.test.ts`. |
| `mcp-server/tests/familyFPrompt.test.ts` | NEW | 22-25 | System prompt contains 7 absolute-rules verbatim (byte-equal to A/B/C/D/E); system prompt contains CQ-as-productive-probe framing; system prompt contains `consequence_probability_unclear` E↔F doctrine binding verbatim; user prompt builder happy path; user prompt builder with subset of keys; user prompt builder with empty requestedRawKeys (returns all 14); rawKeys filter rejects non-Family-F keys; banned-token negation check on system prompt (no banned tokens outside doctrine-positive negations); `FAMILY_F_MAX_TOKENS === 1500`; `FAMILY_F_TEMPERATURE === 0`; user prompt includes CQ-as-productive-probe cross-key framing note; user prompt asserts all 14 rawKeys present in questions block; per-key doctrine guards for the 6 doctrine-risk keys verbatim. Mirrors `familyEPrompt.test.ts`. |
| `mcp-server/tests/familyFAnthropic.test.ts` | NEW | 11 | Happy path, key_missing, HTTP 429, HTTP 500, TimeoutError, non-JSON response, plain prose (no JSON object), API key never appears in success log line, API key never appears in failure log line, logs tagged with `classify_argument_boolean_observations`, MAX_TOKENS=1500 confirmed in callAnthropic args. Mirrors `familyEAnthropic.test.ts`. |
| `mcp-server/tests/familyFBanListScan.test.ts` | NEW | 22-25 | Clean response ok=true; evidenceSpan with each shared banned token (winner, loser, verdict, truth, etc.); evidenceSpan with each Family F-specific banned token (`fallacy`, `fallacious`, `weak argument`, `invalid argument`, `bad reasoning`, `flawed`, `wrong`, `proof of`, `unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`); modelInfo.serverName with each banned token; modelInfo.classifierSetVersion with each banned token; null evidenceSpan values skipped; neutral compound words not flagged (e.g., "wrongful" should NOT match `wrong\b`); each of the 4 D5-specific compound tokens have explicit dedicated tests. Mirrors `familyEBanListScan.test.ts` shape. |
| `mcp-server/tests/familyFFixtureParity.test.ts` | NEW | 16-18 | Canonical-response fixture passes validator + ban-list; all fixture responses use rawKeys in `FAMILY_F_RAW_KEYS`; malformed fixture fails validator at expected path; ban-list fixture fails ban-list scan at expected path; all 8 per-scenario request fixtures pass `validateFamilyBooleanRequest`; 3 mandatory adversarial fixtures are present + structurally valid. Mirrors `familyEFixtureParity.test.ts`. |
| `mcp-server/tests/familyFResponseValidator.test.ts` | NEW | 17 | Happy path 14-key Family F response; rejects wrong schemaVersion; rejects missing required fields; rejects wrong shape for observations / confidence / evidenceSpan; rejects flag_count_too_high; rejects modelInfo without provider="mcp"; rejects unknown rawKey in checkedRawKeys; accepts evidenceSpan strings up to 240 chars; rejects evidenceSpan strings > 240 chars; accepts confidence in {low, medium, high}; rejects confidence values outside that set; rejects checkedRawKeys containing a Family A/B/C/D/E rawKey under Family F. Mirrors `familyEResponseValidator.test.ts`. |
| `mcp-server/tests/familyFDispatch.test.ts` | NEW | 14-16 | Mock-fetch dispatcher tests: Family F request routes to Family F Anthropic; Family A/B/C/D/E requests still route to their own Anthropic; Family F request invokes Family F ban-list scan (not A/B/C/D/E's); all six ban-list scans return ok=true for clean responses; 6-way cross-family rejection; dispatcher returns unsupported_family for G/H/I/J; resolved-family log tag present; fixture provider routing for Family F. Mirrors `familyEDispatch.test.ts` + 6-way cross-family expansion. |
| `mcp-server/tests/familyFDoctrineFixtures.test.ts` | NEW | 10-12 | `consequence_probability_unclear` no-fallacy-framing fixture: positiveExample / negativeExample / definitions do NOT contain `fallacy` / `fallacious` / `weak` / `invalid` / `flawed` / `wrong` / `proof of` / `unmet-means-fallacy` / `proves wrong` / `invalidates` / `refutes`; same scan for the 5 other doctrine-risk keys; per-key falsePositiveGuards strings contain the verbatim doctrine guards from §3 of this design; no CQ is framed as inherently good or bad (descriptive only); the source `familyF.ts:8-26` doctrine-binding header is preserved verbatim; per-key doctrineNotes contain only doctrine-positive negations. Mirrors `familyEDoctrineFixtures.test.ts`. |
| **`mcp-server/tests/familyFAdversarialDoctrine.test.ts`** | **NEW (D4 BINDING; mirror of `familyEAdversarialSlipperySlope.test.ts`)** | **15-18** | Adversarial-fixture-specific tests: (1) Fixture A is parseable + valid; (2) Fixture B is parseable + valid; (3) Fixture C input DOES contain "fallacy" but expected response evidenceSpan does NOT; (4) Fixture D multi-CQ is parseable + valid; (5) Fixture E adversarial verdict-baiting is parseable + valid; (6-12) ban-list scan rejects each of the 4 D5-specific compound tokens (`unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`) + each of the 8 single-token verdicts (`fallacy`, `fallacious`, `weak argument`, `invalid argument`, `bad reasoning`, `flawed`, `wrong`, `proof of`); (13) clean CQ evidenceSpan (anchoring gap text without verdict framing) passes; (14) `FAMILY_F_BAN_PATTERNS` array contains all 12 D5 binding tokens; (15) `consequence_probability_unclear` prompt entry doctrine guard surfaces verbatim mention of all forbidden words; (16-18) E↔F doctrine cross-checks (Fixture A's slippery-slope text classified under F does NOT produce E-style "slippery_slope is a fallacy" output even if F's CQ fires). |
| `mcp-server/tests/familyRegistryInit.test.ts` | UPDATED | +3 | Add: `familyRegistryInit-registers-family-f-on-import` (`isFamilySupported('critical_question')` true); `familyRegistryInit-registers-all-six-families-in-order` (`getSupportedFamilies()` returns `['parent_relation', 'disagreement_axis', 'misunderstanding_repair', 'evidence_source_chain', 'argument_scheme', 'critical_question']` exact); `familyRegistryInit-family-f-has-14-rawKeys`. |
| `mcp-server/tests/familyRegistry.test.ts` | UPDATED | +3 | Add: `registry-getSupportedFamilies-preserves-six-family-order`; `registry-isRawKeySupportedForFamily-six-way-cross-family-rejection`; `registry-getRawKeysForFamily-critical_question-14-keys`. |
| `mcp-server/tests/familyBooleanRequestSchema.test.ts` | UPDATED | +6-8 | Add: valid Family F request passes; Family F request with rawKey subset passes; Family F request with empty requestedRawKeys passes; cross-family rejection (Family A rawKey under critical_question); cross-family rejection (Family B/C/D/E rawKey under critical_question); cross-family rejection (Family F rawKey under each of A/B/C/D/E); regression: valid Family A/B/C/D/E requests still pass. |
| Jest: `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyF.test.ts` | NEW (mirror of `mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts`) | 8 | FF-1 Family F entry exists in EDGE_FAMILY_REGISTRY; FF-2 Family F entry has productionEnabled=**false** (admin-validation only per Card 1 scope); FF-3 Family F entry has adminValidationEnabled=true; FF-4 edgeProductionEnabledFamilies() does NOT include critical_question; FF-5 edgeAdminValidationEnabledFamilies() includes critical_question; FF-6 edgeFilterFamiliesForMode(['critical_question'], 'production') returns []; FF-7 edgeFilterFamiliesForMode(['critical_question'], 'admin_validation') returns ['critical_question']; FF-8 Family F is the 6th entry in EDGE_FAMILY_REGISTRY (A→J order preserved). |

**Subtotal:** 10 + 9 + 25 + 11 + 25 + 18 + 17 + 16 + 12 + 18 + 3 + 3 + 8 + 8 = **183 tests** (upper-band raw sum). Range after natural variance / test-folding during implementation: **+95 to +130** (midpoint ~112). The implementer may fold cross-family expansion tests into existing test files where the natural test shape allows; the binding minimum is +95.

### Doctrine ban-list assertion coverage (D5 BINDING)

`familyFPrompt.test.ts` asserts the system prompt's literal text contains the 7 absolute-rules negation pattern AND the CQ-as-productive-probe framing AND the consequence_probability_unclear E↔F doctrine binding verbatim AND NO bare banned tokens outside doctrine-positive negations.

`familyFBanListScan.test.ts` asserts the runtime scan rejects every shared banned token AND every Family F-specific banned token (the 12 D5 tokens) in evidenceSpans, modelInfo.serverName, and modelInfo.classifierSetVersion.

`familyFDoctrineFixtures.test.ts` asserts the 6 doctrine-risk-key fixtures behave as designed (no fallacy-framing on any of the 6 keys).

**`familyFAdversarialDoctrine.test.ts`** asserts the D4 BINDING fixtures: 3 mandatory + 2 optional fixtures, ≥1 with adversarial "fallacy" framing in input (Fixture C), and doctrine assertions that the model OUTPUT (evidenceSpan + modelInfo) never contains the F ban-list tokens regardless of input.

### Smoke plan — 8-phase including Phase 4b BINDING + Phase 7 enforcement-loop provenance (D12)

Audit file: `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<date>.md` (MUST carry `Audit-Lint: v1` marker per D10).

#### Phase 1 — Pre-flight

- HEAD at merge SHA.
- Hosted MCP server `/health` shows post-merge build.
- Both Edge Functions ACTIVE.
- Edge `familyRegistry.ts:95-97` Family F entry: `productionEnabled=false, adminValidationEnabled=true` (read-only confirmation).
- Working tree contains only the 10 known operator-territory untracked files.
- Test count baselines noted.

#### Phase 2 — Local Deno regression

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

Expected: **~887-922 / 0** (baseline 792 + ~95-130 new Family F tests). Family A/B/C/D/E byte-equal preserved.

#### Phase 3 — Hosted MCP server smoke (19 checks; OPERATOR-RUN)

Operator runs hosted smoke with token. Required-direct phase under L1 of audit-lint; NOT-RUN here caps verdict at PARTIAL per R2.

```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected output:
```
PASS [1-health] ... PASS [17-mcp-tools-call-boolean-family-e]
PASS [18-compat-boolean-family-f]
PASS [19-mcp-tools-call-boolean-family-f]
MCP-SERVER-001 smoke: 19 PASSES, 0 FAILS
EXIT: 0
```

Check 18 verifies hosted server returns a Family F response whose `modelInfo.classifierSetVersion === 'family-f-v1'`. Check 19 verifies `tools/call` against `classify_argument_boolean_observations` with a Family F request returns a structured response with `family-f-v1`.

#### Phase 4 — Edge admin_validation smoke (Family F)

POST 3 seeded args via submit-argument. POST Edge admin_validation with `requestedFamilies: ['critical_question']`. Verify HTTP 200; positives in F's 14-key set; no cross-family leak.

#### Phase 4b — DOCTRINE: live adversarial CQ verification (BINDING; L5 enforcement)

Per intent §9 Phase 4b:

- Submit each adversarial fixture argument (D4 mandatory fixtures A + B + C; optional D + E if operator chooses) via submit-argument (production auto-trigger A+B+C+D+E fires as side effect; document as bonus observation per intent §9).
- POST Edge admin_validation with `requestedFamilies: ['critical_question']` on the new adversarial argument_ids.
- Query `argument_machine_observation_results` for the F run_ids.
- **PRE-CHECK column names** (R1 per Family E amendment precedent — `run_id` confirmed as the column name in Family E smoke; reconfirm at audit time).
- Main query MUST return non-empty rows (R1).
- For each critical_question positive:
  - `evidence_span` MUST NOT contain `fallacy` / `fallacious` / `weak` / `invalid` / `flawed` / `wrong` / `proof of` / `logical error` / `bad reasoning` / `informal fallacy` / `unmet-means-fallacy` / `proves wrong` / `invalidates` / `refutes`.
  - For Fixture C (input contained "fallacy"): output MUST NOT echo "fallacy".

**Firing-count resolution (asymmetric; per intent §9):**
- `>=1 firing, all clean` → PASS
- `0 of 3 firings` → PARTIAL (pattern not exercised live; do NOT authorize Family F production until stronger fixture)
- `>=1 firing, any dirty` → FAIL (existential; HALT)

#### Phase 5 — Unsupported G/H/I/J rejection regression

POST each of the 4 still-unsupported families against arg2. Expected: HTTP 200, `failed`, `mcp_validation_failed`, zero positives. The "unsupported families remaining" set after F lands is `{G, H, I, J}` — 4 families.

#### Phase 6 — Targeted Jest + Deno regression

- `npx jest --testPathPattern="familyF" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read`
- `npm run typecheck`
- `npm run lint`

#### Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (D12 BINDING)

Required subsection verbatim per intent §4 D12:

> "First-enforcement provenance: this is the first family-ship PR to be linted by audit-lint CI with a non-empty in-scope set. CI workflow run ID: `<id>`; in_scope count: `<n; should be 1 — the smoke audit itself>`; linter exit: 0. L1-L6 mechanical enforcement empirically validated end-to-end."

Plus standard 6-family operational state, latency, doctrine-key calibration.

#### Phase 8 — Verdict + authorization

Final verdict + Gate A authorization (unblocks Card 2: MCP-021C-EDGE-FAMILY-E-ENABLE). Operator cleanup.

#### Pre-push audit-lint (D11)

Before pushing smoke audit PR: `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<date>.md` MUST exit 0.

### Verdict rules (per intent §9)

**PASS:** Phase 3 19/19 (or NOT-RUN → PARTIAL cap); Phase 4 valid; Phase 4b ≥1 clean firing (or 0-fire PARTIAL); Phase 5 G-J reject; Phase 6 regression clean; Phase 7 provenance subsection present; pre-lint + CI exit 0.

**PARTIAL:** Phase 3 NOT-RUN, OR Phase 4b 0-fire, OR CI caught real L1-L6 violation requiring audit fix.

**FAIL:** Phase 4b dirty firing; non-Family-F rawKey; prior-family byte-equal failure; CI incorrectly passed an L1-L6-violating audit.

### Verification gates (per commit)

```
npm run typecheck
npm run lint
npx jest --testPathPattern="familyF" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read
```

All exit 0.

---

## 6. File-touch matrix (NEW vs MODIFIED; explicit non-touch list)

### NEW files (no replacement of existing content)

**mcp-server/lib/ (Family F-specific):**
- `mcp-server/lib/familyFKeys.ts` — 14-rawKey constant + per-rawKey `FamilyFPromptEntry` blocks + `FAMILY_F_CLASSIFIER_SET_VERSION = 'family-f-v1'`. ~370 lines.
- `mcp-server/lib/familyFPrompt.ts` — Family F system + user prompt; mirrors the 7 absolute rules verbatim; adds CQ-as-productive-probe framing; adds per-key doctrine guards for the 6 doctrine-risk keys (in source `familyF.ts`). ~245 lines.
- `mcp-server/lib/familyFAnthropic.ts` — Family F Anthropic orchestrator (mirror of `familyEAnthropic.ts`); reuses the shared `callAnthropic` wrapper. ~52 lines.
- `mcp-server/lib/familyFBanListScan.ts` — Family F response doctrine ban-list scan (mirror of `familyEBanListScan.ts`); EXTENDS the shared `DOCTRINE_BAN_PATTERNS` with 12 Family F-specific patterns. ~130 lines.
- `mcp-server/lib/familyFFixtureProvider.ts` — fixture-mode provider for Family F (mirror of `familyEFixtureProvider.ts`); loads `family-f-canonical-response.json`. ~54 lines.

**mcp-server/fixtures/ (8 request + 3 response = 11 fixture files):**
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-canonical-request.json`
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-canonical-response.json`
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-malformed-response.json`
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-ban-list-response.json`
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-cq-unmet-slippery-slope-request.json` (Fixture A — mandatory)
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-cq-met-baseline-request.json` (Fixture B — mandatory)
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-cq-adversarial-fallacy-word-request.json` (Fixture C — mandatory)
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-multi-cq-mixed-request.json` (Fixture D — optional)
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-adversarial-verdict-baiting-request.json` (Fixture E — optional)
- `mcp-server/fixtures/classify-argument-boolean-observations.family-f-no-cq-unmet-request.json` (sanity-check; all-false expected)

**mcp-server/tests/ (10 Deno test files):**
- `mcp-server/tests/familyFKeys.test.ts`
- `mcp-server/tests/familyFKeysParity.test.ts`
- `mcp-server/tests/familyFPrompt.test.ts`
- `mcp-server/tests/familyFAnthropic.test.ts`
- `mcp-server/tests/familyFBanListScan.test.ts`
- `mcp-server/tests/familyFFixtureParity.test.ts`
- `mcp-server/tests/familyFResponseValidator.test.ts`
- `mcp-server/tests/familyFDispatch.test.ts`
- `mcp-server/tests/familyFDoctrineFixtures.test.ts`
- `mcp-server/tests/familyFAdversarialDoctrine.test.ts` (D4 BINDING file)

**Jest test (Edge familyRegistry parity):**
- `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyF.test.ts` (8 tests; admin-validation-only assertion)

**Audit template:**
- `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-template.md` (NEW; operator fills in date post-merge; MUST carry `Audit-Lint: v1` marker per D10)

### MODIFIED files (additive only)

- `mcp-server/lib/familyRegistryInit.ts` — ONE additional `register('critical_question', { ... })` call after the Family E registration block. Pattern verbatim mirror of the existing Family E registration (lines 91-99 of current file). ~10 line addition.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — per-family dispatch addition: import `runAnthropicFamilyFClassifier`, `loadFixtureFamilyFPacket`, `scanFamilyFBooleanResponseForBanList`, `ValidatedFamilyFRequest`; add `'critical_question'` branch to `pickFamilyProviders()`; update tool `description` text to advertise Family F. Family A/B/C/D/E paths remain unchanged byte-equal. ~15 line addition + 1 line description change.
- `scripts/mcp-server-001-smoke.sh` — add 2 Family F PASS checks (`[18-compat-boolean-family-f]`, `[19-mcp-tools-call-boolean-family-f]`). Update header comment to reflect 19 total checks. Family A-E checks unchanged byte-equal. ~50 line addition (mirrors Checks 16+17 for Family E with critical_question rawKeys).
- `mcp-server/tests/familyRegistryInit.test.ts` — +3 tests for 6-family expectation.
- `mcp-server/tests/familyRegistry.test.ts` — +3 tests for 6-way cross-family.
- `mcp-server/tests/familyBooleanRequestSchema.test.ts` — +6-8 tests for Family F valid + cross-family rejection.
- `docs/core/current-status.md` — handoff section update.

### EXPLICIT NON-TOUCH list (byte-equal preservation; HALT trigger #4 enforcement)

**Production-app code (read-only per cdiscourse-doctrine §7):**
- `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` (READ ONLY — taxonomy source of truth)
- `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`, `familyB.ts`, `familyC.ts`, `familyD.ts`, `familyE.ts` (READ ONLY)
- `src/features/nodeLabels/machineObservationDefinitions/familyG.ts`, `familyH.ts`, `familyI.ts`, `familyJ.ts` (READ ONLY)
- All other `src/**/*` (READ ONLY)
- All `app/**/*` (READ ONLY)

**MCP server family-specific files (byte-equal preservation; HALT #4):**
- `mcp-server/lib/familyA*.ts` (5 files) — byte-equal
- `mcp-server/lib/familyB*.ts` (5 files) — byte-equal
- `mcp-server/lib/familyC*.ts` (5 files) — byte-equal
- `mcp-server/lib/familyD*.ts` (5 files) — byte-equal
- `mcp-server/lib/familyE*.ts` (5 files) — byte-equal

**MCP server shared infrastructure (byte-equal preservation):**
- `mcp-server/lib/seedPrompt.ts`
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`
- `mcp-server/lib/doctrineBanList.ts` (CRITICAL — F adds its own scan; shared list byte-equal)
- `mcp-server/lib/anthropicCall.ts`
- `mcp-server/lib/familyRegistry.ts`
- `mcp-server/lib/familyBooleanRequestSchema.ts`
- `mcp-server/bootstrap.ts`
- `mcp-server/tools/classifySemanticMove.ts`

**Edge Function / persistence (byte-equal preservation):**
- `supabase/migrations/**`
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (READ ONLY — F entry already exists at lines 95-97; no edit per D6)
- `supabase/functions/classify-argument-boolean-observations/**`
- `supabase/functions/semantic-referee/**`
- `supabase/functions/**` (all other Edge Functions)

**Subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`:** no entry added for F (T1 disposed; intent §5 + D7).

**Test forecast HALT ceiling:** +220 (per intent §8 — Family E +178 baseline; not a ceiling raise for bloat).

---

## 7. HALT trigger disposition (all 26 from intent §6)

### Registry + family-batch integrity (1-7)

| # | Trigger | Status |
| - | ------- | ------ |
| 1 | Designer skips Phase A.1 source verification | **NOT FIRED** — §1 enumerates all 14 rawKeys verbatim with source field; cross-mcp-server-lib collision matrix executed. |
| 2 | Family F rawKey list differs from MCP-021A source | **NOT FIRED** — 14/14 verbatim match against `familyF.ts` declaration order. |
| 3 | Any Family G/H/I/J registration in this card | **NOT FIRED** — only `critical_question` registered (§6 MODIFIED list). |
| 4 | Family A/B/C/D/E behavior changes (not byte-equal) | **NOT FIRED** — §6 EXPLICIT NON-TOUCH list enforces byte-equal preservation; reviewer matrix item BINDING. |
| 5 | unsupported_family rejection envelope changes for G/H/I/J | **NOT FIRED** — validator unchanged; only registry init adds F. |
| 6 | Schema mirror response shape change | **NOT FIRED** — flat-keyed `observations: Record<rawKey, boolean>`; uniform `ai_classifier`; T2 disposed. |
| 7 | F Edge `familyRegistry` `productionEnabled=true` (must be false) | **NOT FIRED** — Edge entry at `familyRegistry.ts:95-97` already `productionEnabled=false`; this card does NOT touch it (D6 + intent §5 OUT-of-scope). |

### Protocol + security (8-13)

| # | Trigger | Status |
| - | ------- | ------ |
| 8 | New taxonomy keys | **NOT FIRED** — 14 keys verbatim from upstream `familyF.ts`. |
| 9 | MCP schema version change | **NOT FIRED** — `mcp-021.machine-observations.boolean.v1` stays. |
| 10 | Family A/B/C/D/E prompt changes | **NOT FIRED** — byte-equal §6. |
| 11 | Client-side MCP call introduced | **NOT FIRED** — server-side Deno only (§0; cdiscourse-doctrine §7). |
| 12 | Secret exposure | **NOT FIRED** — no Authorization / x-api-key / ANTHROPIC_API_KEY in tool output or logs. |
| 13 | Logs raw body / prompt / response / token / key | **NOT FIRED** — logging redacted per cdiscourse-doctrine §6; mirrors Family A-E pattern. |

### Architecture (14-18)

| # | Trigger | Status |
| - | ------- | ------ |
| 14 | Stage 2B REQUIRED but operator approval missing when implementer starts | **NOT FIRED** — §1 designer-bound determines Stage 2B NOT REQUIRED with explicit per-trigger T1-T5 disposition. |
| 15 | Subset filter modified for A/B/C/D/E (locked); F gets entry ONLY if T1 fires with Stage 2B approval | **NOT FIRED** — A/B/C/D/E subset filter untouched; T1 disposed; no F subset entry. |
| 16 | MAX_TOKENS change without Stage 2B approval (T4) | **NOT FIRED** — MAX_TOKENS=1500 unchanged; ~230 token headroom; T4 disposed (§2). |
| 17 | Family F prompt frames critical_question keys as fallacy / weakness / error / verdict / bad reasoning / invalid (EXISTENTIAL DOCTRINE) | **NOT FIRED** — §3 system prompt explicitly forbids verdict framing; CQ-as-productive-probe explicit; per-key guards verbatim for 6 doctrine-risk keys. |
| 18 | Family F prompt implies unmet critical question makes E's scheme a fallacy (EXISTENTIAL DOCTRINE; the MCP-020 violation prior chain prevented for E) | **NOT FIRED** — §3 system prompt's `consequence_probability_unclear` section explicitly states "Family E detects argument schemes... Family F probes the critical questions associated with those schemes. The two are complementary, descriptive, and structurally independent. An unmet CQ does NOT mean E's scheme is fallacious." Verbatim in the binding header doctrine block. |

### Doctrine — F-specific (19-23)

| # | Trigger | Status |
| - | ------- | ------ |
| 19 | ban-list scan does NOT cover critical-question verdict tokens (D5 list) | **NOT FIRED** — §3 `FAMILY_F_BAN_PATTERNS` enumerates all 12 D5 binding tokens; `familyFBanListScan.test.ts` asserts each token's pattern presence + each token's rejection. |
| 20 | No mandatory adversarial fixtures targeting E↔F doctrine boundary (D4 list) | **NOT FIRED** — §4 designs 3 mandatory fixtures (A: CQ-unmet on slippery-slope text; B: CQ-met baseline; C: input contains "fallacy") + 2 optional. |
| 21 | Smoke Phase 4b adversarial doctrine verification missing (L5 enforcement; CI WILL fail merge) | **NOT FIRED** — §5 smoke plan Phase 4b BINDING; persisted `evidence_span` inspection; firing-count resolution asymmetric. |
| 22 | Family F slippery_slope/consequence_probability_unclear partner (or equivalent F partner to E's slippery_slope) lacks per-key doctrine guard | **NOT FIRED** — §3 `consequence_probability_unclear` per-key falsePositiveGuards verbatim; explicit anchor on the E↔F partnership; 5 other doctrine-risk keys also carry verbatim guards. |
| 23 | Verdict/winner/fallacy tokens in user-facing strings (general) | **NOT FIRED** — Family F ban-list scan + shared `DOCTRINE_BAN_PATTERNS` catch this; 12 Family F-specific tokens enumerated in §3. |

### Enforcement-loop (24-25)

| # | Trigger | Status |
| - | ------- | ------ |
| 24 | Smoke audit lacks `Audit-Lint: v1` marker (CI won't lint; defeats enforcement loop) | **NOT FIRED** — D10 binding; §5 smoke plan + §6 audit template MUST carry marker; reviewer matrix item BINDING. |
| 25 | Smoke audit fails local audit-lint dry-run before PR (must fix BEFORE opening PR) | **NOT FIRED** — D11 binding; §5 pre-push audit-lint step explicit; operator runs `node scripts/ops/audit-lint.mjs <audit-path>` before PR. |

### Working tree (26)

| # | Trigger | Status |
| - | ------- | ------ |
| 26 | Unclassified untracked files at PR creation | **DEFERRED to implementer Phase** — 10 known operator-territory untracked files documented at intent-brief HEAD (`423789c`); implementer ensures clean working tree pre-PR. |

**All 26 triggers evaluated; ZERO fire at design time.** Triggers 17-18 + 21-22 (doctrine core) are explicitly mitigated by §3 (verbatim guards + ban-list extension) and §4 (3 mandatory + 2 optional adversarial fixtures). Triggers 24-25 (enforcement-loop core) are explicitly mitigated by §5 smoke plan binding + §6 audit template requirement.

---

## 8. Test forecast

**Forecast: +95 to +130 new tests (midpoint ~112).**

Within intent §8 band of +90 to +180. Well below the +220 HALT ceiling. The +112 midpoint mirrors Family E's empirical baseline (+178 for 16 keys + slippery_slope doctrine load) scaled down by Family F's lighter load (14 keys + 1 high-risk + 5 medium-risk doctrine keys vs E's 3 explicit-anchor doctrine keys, partially offset by the new adversarial test file).

**Test count progression:**
- Baseline: Jest 18,153 / Deno 792
- Post-Family-F: Jest +8 (~18,161) / Deno +95-130 (~887-922)

**Run gates per commit (intent §8 BINDING):**
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="familyF" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read`

---

## 9. Brief ledger

This design is the response to an OPERATOR-AUTHORED intent brief (`docs/designs/MCP-SERVER-007-FAMILY-F-intent.md` at commit `423789c`).

### Section provenance

| Design section | Source | Operator vs orchestrator |
| -------------- | ------ | ------------------------ |
| §0 Goal | Intent §1, §2, §10 + Family E §0 precedent | Operator-authored brief + designer pattern mirror |
| §1 Phase A.1 source verification + Stage 2B determination | Intent §3 + §7 A.1 + Phase 0 inventory (familyF.ts read at design time + cross-mcp-server-lib grep) | Designer Phase A.1 audit (binding) |
| §2 Phase A.2 token budget + latency | Intent §4 D8 + §7 A.2 + Family A/B/C/D/E baseline calibration | Designer Phase A.2 audit |
| §3 E↔F doctrine binding | Intent §4 D3 + §7 A.3 + Family E §3 precedent + verbatim composition for 6 doctrine-risk keys | Operator-authored brief structural binding + designer verbatim guard composition |
| §4 Adversarial fixture design | Intent §4 D4 + §7 A.4 (3 mandatory + 2 optional) | Operator-authored brief structural binding + designer-authored synthesized text |
| §5 Test plan + smoke plan | Intent §7 A.5 + §8 + §9 (8-phase incl. Phase 4b BINDING + Phase 7 enforcement-loop provenance D12) | Operator-authored brief + designer audit calibration |
| §6 File-touch matrix | Intent §10 brief ledger + §5 OUT-of-scope | Operator-authored brief |
| §7 HALT trigger disposition (all 26) | Intent §6 (26 triggers) | Operator-authored brief |
| §8 Test forecast | Intent §8 (+90 to +180 band) | Designer audit |

### Operator-deferred review (orchestrator judgment)

The following items resolved by orchestrator/designer default in absence of explicit operator direction:

1. **MAX_TOKENS=1500 (no bump).** Intent §4 D8 said "T4 NOT fires: unchanged." Designer's Phase A.2 confirms 1500 has ~230 tokens headroom (~15%) — wider than Family E's ~60 token headroom. Operator may revisit if Phase 4 / Phase 7 observability shows truncation.
2. **Family F-specific ban-list pattern location.** Intent §4 D5 lists the binding tokens but does not specify shared-vs-family-scoped placement. Designer's call: Family F-specific constant in `familyFBanListScan.ts`, NOT the shared `DOCTRINE_BAN_PATTERNS`, to avoid breaking Family A/B/C/D/E outputs that may legitimately contain words like "invalidates" / "refutes" in Family B disputes_validity contexts. Operator may revisit if cross-family ban-list consolidation becomes desirable.
3. **Fixture count: 5 request fixtures (3 mandatory + 2 optional).** Intent §4 D4 binds ≥3 mandatory fixtures (A/B/C); designer adds D + E for breadth (mixed-CQ-state + adversarial verdict-baiting). Operator may direct trimming if test forecast pressure surfaces.
4. **Fixture A input text reuse from Family E.** Designer's call to reuse Family E's `family-e-slippery-slope-clear-request.json` slippery-slope text as the body of Family F Fixture A. This makes the E↔F doctrine boundary test directly comparable — same input, different family classifier, divergent expected output topology. Operator may direct an alternative input.
5. **`familyFAdversarialDoctrine.test.ts` as a separate file.** Designer's call to isolate the D4 BINDING into its own test file for surgical revertability (mirrors Family E's `familyEAdversarialSlipperySlope.test.ts`). Operator may direct merger with `familyFDoctrineFixtures.test.ts` if test-file count pressure surfaces.
6. **Per-key falsePositiveGuards for `missing_warrant`.** Designer's call to grade this key as MEDIUM doctrine-risk (Toulmin's warrant absence is sometimes literature-framed as "argument failure"), so it carries an explicit per-key guard in §3 even though it doesn't pair with a single E doctrine-risk key. The 6 doctrine-risk keys total: `consequence_probability_unclear` (HIGH) + `analogy_mapping_missing`, `alternative_explanation_available`, `causal_mechanism_missing`, `authority_basis_missing`, `missing_warrant` (MEDIUM). Operator may revisit grading.
7. **Phase 4b PASS-vs-PARTIAL boundary.** Intent §9 specifies: `>=1 firing, all clean` → PASS; `0 of 3 firings` → PARTIAL; `>=1 firing, any dirty` → FAIL. Designer accepts verbatim.

### Brief interpretive notes

- **Stage 2B determination is a designer audit** (per intent §3) because Phase A.1 evidence — uniform `ai_classifier` source from `familyF.ts` + the Family E precedent for E↔F doctrine translation — made the verdict deterministic. T3 was "ASSUMED-TRUE until A.1 explicitly proves false." This audit's disposition of T3 grounds the "structurally simple" conclusion in the Family E hosted-completion PASS evidence (`bccb0c2`) on `consequence_probability_unclear`-adjacent slippery-slope text — 2 of 3 firings clean, 0 banned tokens across 13 patterns, F2 specifically proving no "fallacy" echo despite adversarial input. The Family E 5-layer defense pattern is the structural specification F mirrors; the implementation steps are mechanical.
- **`familyF.ts` header doctrine binding is preserved verbatim.** Per source file lines 8-26, the upstream taxonomy itself declares the doctrine binding ("every entry's falsePositiveGuards ends with the shared COMMON_DOCTRINE_GUARD..."). This design enforces that binding at the MCP server layer via per-key guards + ban-list scan + system prompt — exactly the Family E pattern.
- **Enforcement-loop provenance (D12 BINDING) is NOT operator-deferred** — Phase 7 audit subsection content is verbatim per intent §9; designer accepts.

---

## 10. Doctrine self-check

| Doctrine | Family F enforcement | Where in design |
| -------- | -------------------- | --------------- |
| cdiscourse-doctrine §1 (no truth labels) | System prompt 7 absolute rules verbatim; F ban-list catches verdict tokens (12 F-specific + shared) | §3 system prompt + §3 ban-list |
| cdiscourse-doctrine §3 (popularity ≠ evidence) | Family F does not touch evidence weighting; orthogonal to evidence-doctrine | §0 Goal |
| cdiscourse-doctrine §4 (AI moderator hard limits) | Server-side Deno only; `provider: 'mcp'` identifies output as machine-generated; advisory only | §0 Goal |
| cdiscourse-doctrine §6 (secrets policy) | ANTHROPIC_API_KEY / MCP_SERVER_BEARER_TOKEN never logged; ban-list scan never emits secrets | §0 Goal + §3 ban-list |
| cdiscourse-doctrine §7 (no AI from production app) | Family F classifier lives server-side; production app does NOT import `mcp-server/lib/familyF*.ts` | §6 EXPLICIT NON-TOUCH list |
| cdiscourse-doctrine §10a (Observations vs Allegations) | Every Family F output is a Machine Observation; source: `ai_classifier`; never a person attribution | §1 source-breakdown |
| evidence-doctrine | Family F is orthogonal to factual standing; CQ detection does not lower standing | §0 Goal |
| point-standing-economy | Family F is descriptive; CQ probes a productive inquiry, never penalizes nor rewards | §3 system prompt |
| **doctrine binding: critical_question NEVER labeled fallacy/verdict** | **§3 system prompt + §3 per-key guards (6 keys) + §3 Family F ban-list (12 tokens) + §4 adversarial fixtures (5 total; 3 mandatory) + §5 Phase 4b smoke + §7 HALT triggers 17-18 + reviewer matrix item BINDING** | **5-layer defense; existential constraint** |
| **enforcement-loop: this is the first family-ship PR linted by audit-lint CI with non-empty in-scope set** | **§5 Phase 7 D12 BINDING provenance subsection; pre-push audit-lint D11 BINDING; smoke audit `Audit-Lint: v1` marker D10 BINDING** | **§5 + §6 audit template** |

---

## 11. Operator steps (deploy)

**No operator deploy required for this card.** The MCP server auto-deploys on merge to main via Deno Deploy. The Edge familyRegistry already has the Family F entry. No migration; no Edge Function logic change.

The operator runs the smoke after merge:
```
bash scripts/mcp-server-001-smoke.sh \
  --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net \
  --token <hosted-bearer-token>
```

Expected: 19/19 PASS. Followed by Phase 4 Edge admin_validation request + Phase 4b live adversarial CQ verification + Phase 7 enforcement-loop provenance subsection extraction (CI run ID + in_scope count + linter exit from PR Actions tab).

Pre-push audit-lint (D11 BINDING):
```
node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<date>.md
```
MUST exit 0 before opening the smoke audit PR.

If Phase 4b surfaces any banned token in a Family F evidenceSpan, the operator HALTs and surfaces to designer for revert + revised guards.

---

## 12. Summary

- **Card:** MCP-SERVER-007-FAMILY-F (Card 1 of 3 chain)
- **Title:** Critical-Question Boolean Observation Classifier (Family F, 14 keys, Walton + Toulmin + Peirce critical questions)
- **Stage 2B:** **NOT REQUIRED** (uniform `ai_classifier`, fits MAX_TOKENS=1500 with ~230 token headroom, no schema change, structurally independent of Family E at the classifier level; doctrine-translation peril addressable via Family E precedent pattern)
- **Files touched:** 28 new + 7 modified (5 lib + 11 fixtures + 10 tests + 1 audit template + 1 Edge test = 28 new; 1 registry init + 1 dispatcher + 1 smoke script + 3 test updates + 1 status doc = 7 modified)
- **Test forecast:** +95 to +130 (midpoint ~112); HALT ceiling +220
- **Smoke checks:** 19 total (was 17 after Family E); +2 Family F checks
- **Existential constraint:** `consequence_probability_unclear` (highest doctrine-risk; partners with E's `slippery_slope_reasoning_present`) NEVER labeled as fallacy/verdict in OUTPUT, even when INPUT contains "fallacy"; enforced via 5-layer defense (system prompt + 6 per-key guards + Family F ban-list 12 tokens + 3 mandatory adversarial fixtures + Phase 4b smoke verification)
- **Enforcement-loop BINDING:** this card's smoke audit PR is the FIRST family-ship audit to reach the audit-lint CI workflow with a non-empty in-scope set; Phase 7 provenance subsection (D12) records the CI run ID + in_scope count + linter exit
- **Operator deploy:** None — auto-deploys on merge; operator runs 19-check smoke + Phase 4b doctrine verification + Phase 7 provenance extraction post-merge

This design preserves Family A/B/C/D/E byte-equal and ships Family F in admin-validation-only posture with the strongest doctrine-binding scaffolding to date (3 mandatory adversarial fixtures targeting the E↔F doctrine boundary, including Fixture C with adversarial "fallacy" framing in input; a Family F-specific ban-list extension with 12 binding tokens including 4 CQ-specific verdict compounds (`unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`); a dedicated `familyFAdversarialDoctrine.test.ts` file; and a Phase 4b smoke step that gates merge-to-production-flip on doctrine-clean output). The card unblocks Gate A in the chain, which determines whether Card 2 (Family E production flip; FIRST production-enable card under L3+L4+L5 mechanical enforcement) and Card 3 (Family F production flip; L5 BINDING on production doctrine) can proceed.
