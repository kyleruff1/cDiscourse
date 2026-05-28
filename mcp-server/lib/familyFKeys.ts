/**
 * MCP-SERVER-007-FAMILY-F — Family F (critical_question) 14-key constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family F registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyF.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyFKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * The 14 rawKeys are the binding contract per MCP-SERVER-007-FAMILY-F intent
 * brief §2 + design §1. Verbatim, in declaration order (all are NEW; 0 retroactive):
 *
 *   1.  missing_warrant (ai_classifier; MEDIUM doctrine risk — Toulmin warrant)
 *   2.  unstated_assumption (ai_classifier)
 *   3.  authority_basis_missing (ai_classifier; MEDIUM doctrine risk — Walton authority CQ)
 *   4.  causal_mechanism_missing (ai_classifier; MEDIUM doctrine risk — Walton causal CQ)
 *   5.  analogy_mapping_missing (ai_classifier; MEDIUM doctrine risk — Walton analogy CQ)
 *   6.  example_representativeness_unclear (ai_classifier)
 *   7.  consequence_probability_unclear (ai_classifier; HIGHEST DOCTRINE RISK — slippery-slope CQ)
 *   8.  definition_boundary_unclear (ai_classifier)
 *   9.  criterion_weighting_unclear (ai_classifier)
 *   10. alternative_explanation_available (ai_classifier; MEDIUM doctrine risk — abductive CQ)
 *   11. counterexample_available (ai_classifier)
 *   12. scope_limit_unstated (ai_classifier)
 *   13. qualification_missing (ai_classifier)
 *   14. comparison_baseline_missing (ai_classifier)
 *
 * Source breakdown: 14 ai_classifier / 0 auto_metadata / 0 lifecycle (uniform).
 * No Subset filter required (Stage 2B NOT REQUIRED per design §1).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict. Critical questions are PRODUCTIVE
 *     PROBES on ABSENCE/GAP, never adjudications of argument quality.
 *   - cdiscourse-doctrine §1 — Family F NEVER labels an unmet CQ a "fallacy",
 *     "weak argument", "invalid", "bad reasoning", "flawed", "wrong",
 *     "proves wrong", "invalidates", "refutes", "logical error", or any
 *     verdict. The CQ opens an inquiry; it never closes one with a verdict.
 *   - Walton (1995, 2008) — every argumentation scheme has corresponding
 *     critical questions; Family F probes the CQs, never asserts the scheme
 *     itself is fallacious. Toulmin (1958) — warrant + qualifier structure.
 *     Peirce — abductive reasoning.
 *   - MCP-020 audit §Rejected labels — `consequence_probability_unclear`
 *     carries the highest doctrine risk because the partner E scheme
 *     (slippery_slope_reasoning_present) is sometimes framed as a fallacy
 *     in the literature. CDiscourse treats the CQ as a probability-gap
 *     probe, NOT as a verdict that the chain inference is fallacious.
 *   - point-standing-economy — Family F is descriptive; flagging an unmet
 *     CQ does NOT lower the move's factual standing eligibility.
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family A/B/C/D/E
 * pattern.
 */

/**
 * The 14 Family F rawKeys, frozen in declaration order. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in both source
 *     files as a string literal)
 */
export const FAMILY_F_RAW_KEYS: readonly string[] = Object.freeze([
  'missing_warrant',
  'unstated_assumption',
  'authority_basis_missing',
  'causal_mechanism_missing',
  'analogy_mapping_missing',
  'example_representativeness_unclear',
  'consequence_probability_unclear',
  'definition_boundary_unclear',
  'criterion_weighting_unclear',
  'alternative_explanation_available',
  'counterexample_available',
  'scope_limit_unstated',
  'qualification_missing',
  'comparison_baseline_missing',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_F_CLASSIFIER_SET_VERSION = 'family-f-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence.
 *
 * Per design §3, the per-key falsePositiveGuards for the 6 doctrine-risk
 * keys carry verbatim guards forbidding the output from labeling the CQ
 * as a fallacy / weak / invalid / flawed / bad reasoning / wrong /
 * proves wrong / invalidates / refutes. The HIGHEST RISK key —
 * `consequence_probability_unclear` (partners with Family E's
 * slippery_slope_reasoning_present) — carries the strongest guard,
 * including the existential constraint that even when the input text
 * contains "fallacy", the output evidenceSpan must NOT echo it.
 */
export interface FamilyFPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_F_PROMPT_ENTRIES: readonly FamilyFPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'missing_warrant',
    label: 'Warrant not explicit',
    booleanQuestion:
      'Does this move present a claim + grounds without making the warrant (the rule licensing claim from grounds) explicit?',
    positiveDefinition:
      "The move provides grounds (data / evidence / examples) and a claim, but the reasoning link between them is implicit. A reader could reasonably ask 'WHY does that ground support that claim?'.",
    negativeDefinition:
      '(a) Grounds + explicit warrant present, OR (b) pure question / clarification / paraphrase, OR (c) claim trivially entailed by ground, OR (d) pure value claim without empirical ground.',
    positiveExample:
      "Move: 'Crime dropped 30% since 2010 (FBI UCR) — therefore policing reform works.' (ground = data; claim = causal; warrant = ?)",
    negativeExample:
      "Move: 'Crime dropped after policy X — and the timing matches the rollout in 12 of 12 measured cities, with no other major intervention overlapping.' (warrant: timing + scope matching)",
    falsePositiveGuards:
      "Do NOT mark TRUE just because the move is short; brevity is not absence-of-warrant. Do NOT mark TRUE for moves where the warrant is implicit-but-obvious (e.g., counting cases entails the count). Do NOT mark TRUE for value-claims that do not require an empirical warrant. DOCTRINE: this is a CRITICAL QUESTION on Toulmin's warrant structure, never a verdict that the argument is unwarranted, invalid, or wrong. Plain-language framing: 'what would warrant this claim?', NEVER 'this claim is unwarranted'. The output MUST NOT contain words like 'fallacy', 'unwarranted-as-verdict', 'invalid', 'flawed', 'wrong', 'bad reasoning', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the ground+claim pair where the warrant is absent, not a judgment about the argument's quality.",
  }),
  Object.freeze({
    rawKey: 'unstated_assumption',
    label: 'Unstated assumption',
    booleanQuestion:
      "Does this move's reasoning depend on an assumption that the move does not explicitly state?",
    positiveDefinition:
      "The move's reasoning requires a premise to hold, but the premise is not stated in the move. Identifying the assumption opens productive inquiry.",
    negativeDefinition:
      'The move states all premises explicitly, the move is a pure question / paraphrase, or the move uses a premise that is universally shared in the context.',
    positiveExample:
      "Move: 'EVs reduce pollution because they are electric.' (assumes the grid that powers them is cleaner)",
    negativeExample:
      "Move: 'EVs reduce pollution if charged on a grid with <500g CO2/kWh — which most US grids are.' (assumption made explicit)",
    falsePositiveGuards:
      "Do NOT mark TRUE for assumptions that are universally shared and need not be stated. Do NOT mark TRUE for moves whose assumption is in the parent move. DOCTRINE: this is a productive critical question; absence of an explicit assumption does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
  Object.freeze({
    rawKey: 'authority_basis_missing',
    label: 'Authority basis missing',
    booleanQuestion:
      "Does this move appeal to an authority without naming the authority's specific expertise or basis for the claim at hand?",
    positiveDefinition:
      "The move cites 'experts say' / 'scientists agree' / 'leading economists' without naming who or what backs the appeal. Walton's critical question for the authority scheme.",
    negativeDefinition:
      'The move names the specific authority and the relevant expertise, OR does not use authority reasoning at all, OR cites the authority alongside the specific evidence the authority used.',
    positiveExample:
      "Move: 'Experts agree that this policy works.' (which experts; what is their basis?)",
    negativeExample:
      "Move: 'The IPCC AR6 Working Group I (climate science) concludes that anthropogenic emissions are the dominant warming driver.' (specific authority + relevant expertise)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that name the authority and its expertise. Do NOT mark TRUE for moves that cite specific evidence alongside the authority. DOCTRINE: this is a CRITICAL QUESTION on Walton's expert-authority scheme, never a verdict that the authority appeal is fallacious. The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'wrong', 'bad reasoning', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the unsourced authority phrase, not a judgment about the appeal's validity.",
  }),
  Object.freeze({
    rawKey: 'causal_mechanism_missing',
    label: 'Causal mechanism missing',
    booleanQuestion:
      'Does this move claim cause-and-effect without proposing a mechanism that explains how the cause produces the effect?',
    positiveDefinition:
      'The move asserts X causes Y but does not propose HOW: through what process, what intermediate steps. Walton critical question for causal scheme.',
    negativeDefinition:
      'The move proposes a mechanism (X causes Y through the process P), OR notes correlation without claiming causation, OR uses non-causal reasoning.',
    positiveExample:
      "Move: 'Library funding causes literacy gains.' (no mechanism proposed)",
    negativeExample:
      "Move: 'Library funding causes literacy gains through expanded program hours, more staff for tutoring, and broader book access.' (mechanism proposed)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that propose any mechanism (even hedged ones). Do NOT mark TRUE for moves that note correlation without claiming causation. DOCTRINE: this is a CRITICAL QUESTION on causal scheme mechanism, never a verdict that the causal claim is fallacious or false. The CQ partners with Family E's causal_reasoning_present. The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'wrong', 'bad reasoning', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the unstated mechanism, not a judgment about the causal claim's validity.",
  }),
  Object.freeze({
    rawKey: 'analogy_mapping_missing',
    label: 'Analogy mapping missing',
    booleanQuestion:
      "Does this move use an analogy without specifying WHICH features of the source case map to the target case?",
    positiveDefinition:
      "The move draws an analogy (X is like Y) but does not specify what features of Y bear on X. Walton critical question for analogy scheme.",
    negativeDefinition:
      'The move specifies the mapping (X is like Y in respect R, which is relevant because...), OR does not use analogy at all.',
    positiveExample:
      "Move: 'Misinformation is like spam.' (no mapping specified — which features of spam?)",
    negativeExample:
      "Move: 'Misinformation is like spam in that both spread virally and respond to filtering at the platform layer; both have unclear cases at the margin.' (mapping specified)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that specify the mapping briefly. Do NOT mark TRUE for moves that do not use analogy. DOCTRINE: this is a CRITICAL QUESTION about analogy mapping, never a verdict that analogy reasoning is fallacious. The CQ partners with Family E's analogy_reasoning_present (Walton's analogy scheme). The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'bad reasoning', 'wrong', 'proves wrong', 'refutes', 'invalidates'. The evidenceSpan must anchor the unstated mapping, not a judgment about the analogy's quality.",
  }),
  Object.freeze({
    rawKey: 'example_representativeness_unclear',
    label: 'Example representativeness unclear',
    booleanQuestion:
      'Does this move use examples to support a generalization without showing the examples are representative of the relevant population?',
    positiveDefinition:
      "The move cites examples but does not address whether the examples generalize: 'Pittsburgh and Detroit show X' (do they?). Walton critical question for example scheme.",
    negativeDefinition:
      'The move addresses representativeness (cites that the examples are typical, or notes selection criteria), OR uses single-case reasoning, OR does not use example reasoning.',
    positiveExample:
      "Move: 'Pittsburgh, Detroit, and Indianapolis all show library funding boosts literacy.' (does this generalize?)",
    negativeExample:
      "Move: 'In 12 of 15 mid-size US cities with sustained funding increases, literacy rose; the 3 outliers had concurrent program changes.' (representativeness addressed)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that address selection criteria. Do NOT mark TRUE for moves that note their examples are illustrative not exhaustive. DOCTRINE: this is a productive critical question; absence of an explicit representativeness check does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
  Object.freeze({
    rawKey: 'consequence_probability_unclear',
    label: 'Consequence probability unclear',
    booleanQuestion:
      'Does this move predict consequences without addressing the probability that those consequences will occur?',
    positiveDefinition:
      "The move predicts an outcome ('X will lead to Y') without giving any sense of how likely Y is. Walton critical question for consequence + slippery-slope schemes.",
    negativeDefinition:
      'The move addresses probability (cites studies, gives base rates, hedges with modal language), OR is descriptive rather than predictive.',
    positiveExample:
      "Move: 'If we ban X, that will normalize censorship.' (slippery-slope; probability of each step unaddressed)",
    negativeExample:
      "Move: 'Carbon taxes have reduced emissions in 12 of 15 cases with stable enforcement, by 5-10% over 5 years.' (probability addressed)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that hedge appropriately (probably, may, tends to). Do NOT mark TRUE for moves that are descriptive rather than predictive. DOCTRINE: this is a CRITICAL QUESTION about probability anchoring, never a verdict that the move's reasoning is a fallacy. This CQ partners with Family E's slippery_slope_reasoning_present, which Family E treats descriptively. When this CQ flags TRUE on a move with chain-of-consequences reasoning, the model's output evidenceSpan MUST be a verbatim quote from the move anchoring WHERE the probability gap appears (e.g., a specific transition step that lacks a probability anchor) — it MUST NOT contain words like 'fallacy', 'fallacious', 'slippery-slope fallacy', 'weak argument', 'invalid', 'invalid argument', 'flawed', 'flawed reasoning', 'wrong', 'bad reasoning', 'logical error', 'informal fallacy', 'proof of', 'unmet-means-fallacy', 'proves wrong', 'refutes', 'invalidates', or any quality judgment. If the move's text itself contains the word 'fallacy' (e.g., 'critics call this a fallacy, but…'), the model may still detect the unmet probability CQ if the gap is present, but the model's own output must NOT echo or assert the fallacy framing. The evidenceSpan must anchor the probability gap, not the fallacy framing. The CQ opens an inquiry; never closes one with a verdict.",
  }),
  Object.freeze({
    rawKey: 'definition_boundary_unclear',
    label: 'Definition boundary unclear',
    booleanQuestion:
      "Does this move apply a definition to a case without showing the case clearly falls within the definition's boundaries?",
    positiveDefinition:
      "The move applies a definition but the boundary case is debatable: 'libraries are infrastructure' — is this case clearly within the definition? Walton critical question for definition scheme.",
    negativeDefinition:
      'The move addresses the boundary explicitly (cites why the case fits), OR uses a clear case, OR does not use definition reasoning.',
    positiveExample:
      "Move: 'AI hiring tools fall under employment discrimination law.' (boundary unclear — is this clearly within?)",
    negativeExample:
      "Move: 'AI hiring tools that produce disparate-impact outcomes fall under Title VII per the 1991 amendments and recent EEOC guidance, which explicitly contemplates this case.' (boundary addressed)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that address the boundary case. Do NOT mark TRUE for moves using clear cases at the definition's core. DOCTRINE: this is a productive critical question; absence of an explicit boundary check does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
  Object.freeze({
    rawKey: 'criterion_weighting_unclear',
    label: 'Criterion weighting unclear',
    booleanQuestion:
      'Does this move apply multiple decision criteria without showing how they are weighted against each other?',
    positiveDefinition:
      "The move invokes more than one criterion (cost AND effectiveness; equity AND efficiency) but does not say how to weight them when they conflict.",
    negativeDefinition:
      'The move addresses the weighting (provides a weighting rule), OR uses a single criterion, OR does not invoke decision criteria.',
    positiveExample:
      "Move: 'Library funding should be cost-effective AND equitable.' (how weighted when they conflict?)",
    negativeExample:
      "Move: 'Library funding should be cost-effective subject to a minimum equity floor of equal per-capita access in lowest-income quintiles.' (weighting rule given)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that address the weighting rule. Do NOT mark TRUE for moves using a single criterion. DOCTRINE: this is a productive critical question; absence of an explicit weighting rule does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
  Object.freeze({
    rawKey: 'alternative_explanation_available',
    label: 'Alternative explanation available',
    booleanQuestion:
      'Does this move infer a cause from observed effects without addressing plausible alternative explanations?',
    positiveDefinition:
      "The move infers cause from effect (abductive reasoning) but does not address alternatives that could account for the same effect. Standard critical question for abductive reasoning.",
    negativeDefinition:
      'The move addresses alternatives (rules them out, weighs them), OR does not use abductive reasoning, OR uses controlled comparison that addresses confounds.',
    positiveExample:
      "Move: 'Library funding rose, then literacy rose — funding caused the gain.' (what about concurrent school improvements? demographic shifts?)",
    negativeExample:
      "Move: 'Library funding rose, then literacy rose. The only other major change was budget growth, but that did not flow to schools in this period — the library effect is most parsimonious.' (alternatives addressed)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that address alternatives. Do NOT mark TRUE for moves using controlled comparison. DOCTRINE: this is a CRITICAL QUESTION on abductive reasoning (Peirce: inference to best explanation), never a verdict that abductive reasoning is fallacious. The CQ partners with Family E's abductive_explanation_present. The output MUST NOT contain words like 'fallacy', 'invalid', 'flawed', 'weak', 'wrong', 'bad reasoning', 'proves wrong', 'refutes'. The evidenceSpan must anchor the unaddressed alternative, not a judgment about the inference's quality.",
  }),
  Object.freeze({
    rawKey: 'counterexample_available',
    label: 'Counterexample available',
    booleanQuestion:
      'Does this move advance a generalization where there are known counterexamples not addressed in the move?',
    positiveDefinition:
      'The move makes a generalization (X is universally true, X always happens) but a counterexample exists in the public record. Standard critical question for generalization claims.',
    negativeDefinition:
      "The move addresses known counterexamples (rules them out, explains them as edge cases), OR avoids generalization, OR no known counterexamples exist.",
    positiveExample:
      "Move: 'Carbon taxes always reduce emissions.' (the Australia repeal case is a known counterexample)",
    negativeExample:
      "Move: 'Carbon taxes reduce emissions in jurisdictions where they remain in place; the Australia case shows the political-durability boundary.' (counterexample addressed)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that address counterexamples. Do NOT mark TRUE for moves that hedge appropriately. DOCTRINE: this is a productive critical question; existence of a counterexample does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
  Object.freeze({
    rawKey: 'scope_limit_unstated',
    label: 'Scope limit unstated',
    booleanQuestion:
      'Does this move make a claim without stating the population, time window, or setting limits within which the claim holds?',
    positiveDefinition:
      "The move states a claim without scope qualifiers: 'X is true' (everywhere? always? for all people?). Pairs with Family H claim_specificity_low.",
    negativeDefinition:
      "The move scopes the claim explicitly (in cities of >100K; over the 2015-2020 window; for non-emergency contexts), OR makes a universal claim that is genuinely intended as universal.",
    positiveExample:
      "Move: 'EVs reduce pollution.' (everywhere? always? all EVs? all pollution?)",
    negativeExample:
      "Move: 'EVs reduce urban tailpipe pollution in cities with EV share >20% over 2018-2023.' (scope stated)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves with explicit scope qualifiers. Do NOT mark TRUE for moves whose scope is implied by the topic. DOCTRINE: this is a productive critical question; absence of explicit scope qualifiers does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
  Object.freeze({
    rawKey: 'qualification_missing',
    label: 'Qualification missing',
    booleanQuestion:
      'Does this move state a claim without modal qualification ("usually", "often", "in most cases") in a context where the underlying evidence supports only qualified claims?',
    positiveDefinition:
      'The move asserts a claim categorically (X is Y) but the evidence base supports only qualified versions (X is usually Y; X is Y in most cases). Pairs with Family H modal_language_present (positive structural counterpart).',
    negativeDefinition:
      'The move uses modal language appropriately, OR the underlying claim is genuinely categorical (definitional, mathematical).',
    positiveExample:
      "Move: 'Library funding boosts literacy.' (the evidence supports 'usually' or 'in mid-size cities' — categorical assertion is over-confident)",
    negativeExample:
      "Move: 'Library funding usually boosts literacy in mid-size cities with sustained programs.' (appropriately qualified)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves with appropriate modal language. Do NOT mark TRUE for genuinely categorical claims (definitions, math). DOCTRINE: this is a productive critical question; absence of modal qualification does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
  Object.freeze({
    rawKey: 'comparison_baseline_missing',
    label: 'Comparison baseline missing',
    booleanQuestion:
      'Does this move use a comparison (better, more, larger, lower) without specifying the baseline of comparison?',
    positiveDefinition:
      "The move says 'X is better' / 'X is larger' / 'X is more effective' without naming what X is being compared to.",
    negativeDefinition:
      "The move specifies the baseline (X is more effective than Y; X is larger than the 2019 baseline), OR uses absolute claims that do not require comparison.",
    positiveExample:
      "Move: 'Carbon taxes are more effective.' (more than what?)",
    negativeExample:
      "Move: 'Carbon taxes are more effective than cap-and-trade in jurisdictions with weak enforcement capacity.' (baseline specified)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that specify the baseline. Do NOT mark TRUE for moves using absolute claims. DOCTRINE: this is a productive critical question; absence of an explicit baseline does not mean the argument is wrong, weak, fallacious, invalid, or flawed. The output MUST NOT contain those verdict tokens.",
  }),
]);
