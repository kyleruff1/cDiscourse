/**
 * MCP-SERVER-006-FAMILY-E + MCP-BUILD2e — Family E (argument_scheme)
 * 19-key constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family E registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyE.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyEKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * The 19 rawKeys are the binding contract (16 MCP-SERVER-006-FAMILY-E intent
 * brief §1 + 3 MCP-BUILD2e Build-2 manifest §4). Verbatim, in declaration
 * order:
 *
 *   1.  causal_reasoning_present (ai_classifier)
 *   2.  analogy_reasoning_present (ai_classifier; DOCTRINE RISK — not "fallacy")
 *   3.  example_reasoning_present (ai_classifier)
 *   4.  authority_reasoning_present (ai_classifier)
 *   5.  consequence_reasoning_present (ai_classifier)
 *   6.  principle_reasoning_present (ai_classifier)
 *   7.  definition_reasoning_present (ai_classifier)
 *   8.  classification_reasoning_present (ai_classifier)
 *   9.  precedent_reasoning_present (ai_classifier)
 *   10. means_end_reasoning_present (ai_classifier)
 *   11. tradeoff_reasoning_present (ai_classifier)
 *   12. abductive_explanation_present (ai_classifier; DOCTRINE RISK — not "fallacy")
 *   13. exception_reasoning_present (ai_classifier)
 *   14. slippery_slope_reasoning_present (ai_classifier; HIGHEST DOCTRINE RISK — not "fallacy")
 *   15. cost_benefit_reasoning_present (ai_classifier)
 *   16. risk_reasoning_present (ai_classifier)
 *   17. linked_premise_structure (MCP-BUILD2e; ai_classifier; theory term "linked" internal)
 *   18. convergent_premise_structure (MCP-BUILD2e; ai_classifier; theory term "convergent" internal)
 *   19. enthymeme_gap_detected (MCP-BUILD2e; ai_classifier; VERDICT-ADJACENT — gap-is-not-a-verdict; theory term "enthymeme" internal)
 *
 * Source breakdown: 19 ai_classifier / 0 auto_metadata / 0 lifecycle (uniform).
 * No Subset filter required (Stage 2B NOT REQUIRED per design §10). Post-add
 * classified-key count 19 ≤ MAX_FLAGS_PER_RESPONSE 20 (manifest §0.5 cap OK).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict. Schemes are DESCRIPTIVE inferential
 *     patterns, never adjudications.
 *   - cdiscourse-doctrine §1 — Family E NEVER labels any scheme a "fallacy",
 *     "weak argument", "invalid", "bad reasoning", "flawed", "wrong",
 *     "logical error", or any verdict. The critical-question family (F)
 *     handles whether a scheme's critical questions are met; Family E only
 *     detects the PATTERN.
 *   - Walton (1995, 2008) — argumentation schemes; every scheme has a
 *     corresponding critical question (Family F counterpart). Peirce —
 *     abductive inference to best explanation.
 *   - MCP-020 audit §Rejected labels — slippery_slope carries doctrine risk
 *     because the literature frames it as a fallacy. CDiscourse treats it
 *     as a scheme with critical questions, NOT as a fault.
 *   - point-standing-economy — Family E never penalizes nor rewards. Scheme
 *     detection does NOT lower factual standing eligibility.
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family A/B/C/D
 * pattern.
 */

/**
 * The 19 Family E rawKeys, frozen in declaration order. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in both source
 *     files as a string literal)
 */
export const FAMILY_E_RAW_KEYS: readonly string[] = Object.freeze([
  'causal_reasoning_present',
  'analogy_reasoning_present',
  'example_reasoning_present',
  'authority_reasoning_present',
  'consequence_reasoning_present',
  'principle_reasoning_present',
  'definition_reasoning_present',
  'classification_reasoning_present',
  'precedent_reasoning_present',
  'means_end_reasoning_present',
  'tradeoff_reasoning_present',
  'abductive_explanation_present',
  'exception_reasoning_present',
  'slippery_slope_reasoning_present',
  'cost_benefit_reasoning_present',
  'risk_reasoning_present',
  // MCP-BUILD2e (Build-2 manifest §4) — argument-scheme structure booleans.
  'linked_premise_structure',
  'convergent_premise_structure',
  'enthymeme_gap_detected',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_E_CLASSIFIER_SET_VERSION = 'family-e-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence.
 *
 * Per design §3, the per-key falsePositiveGuards for
 * `slippery_slope_reasoning_present`, `abductive_explanation_present`,
 * and `analogy_reasoning_present` carry the doctrine load —
 * verbatim guards forbidding the output from labeling the pattern as
 * a fallacy / weak / invalid / flawed / bad reasoning / wrong / proof
 * of / logical error.
 */
export interface FamilyEPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_E_PROMPT_ENTRIES: readonly FamilyEPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'causal_reasoning_present',
    label: 'Causal reasoning',
    booleanQuestion:
      'Does this move use cause-and-effect reasoning (X causes Y) as its primary support?',
    positiveDefinition:
      'The move argues from a cause to its effect, or from an effect to a likely cause. The causal claim is doing the inferential work, not merely incidental.',
    negativeDefinition:
      'The move uses correlation without claiming causation, evidence without inferential structure, or definitional / analogical / value reasoning.',
    positiveExample:
      "Move: 'Carbon taxes work because they raise the price of carbon, which reduces consumption.'",
    negativeExample:
      "Move: 'Carbon taxes and emission drops correlate.' (correlation, no causal claim)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that note correlation without claiming causation. Do NOT mark TRUE for moves that mention causes as background without using the causal claim as support. DOCTRINE: causal reasoning is a SCHEME, never labeled a fallacy. The corresponding Family F critical question is causal_mechanism_missing.',
  }),
  Object.freeze({
    rawKey: 'analogy_reasoning_present',
    label: 'Analogy reasoning',
    booleanQuestion:
      'Does this move use an analogy (mapping the case under discussion to a different case) as its primary form of support?',
    positiveDefinition:
      'The move advances its position by drawing a comparison to a different case / domain / situation, with the implication that what is true of the comparison applies to the case at hand.',
    negativeDefinition:
      "The move uses direct evidence, examples-of-the-same-case, definitional argument, or causal reasoning. A passing comparison ('like a library') without inferential weight is NOT analogy reasoning.",
    positiveExample:
      "Move: 'Libraries are like roads — public goods that should be funded collectively.' (analogy: roads → libraries)",
    negativeExample:
      "Move: 'Libraries are public goods, like roads and parks.' (passing comparison; inferential work from definition)",
    falsePositiveGuards:
      "Do NOT mark TRUE for passing similes; the analogy must bear inferential weight. Do NOT mark TRUE for examples-of-the-same-kind (those are example_reasoning_present). Do NOT mark TRUE based on the word 'like' alone. DOCTRINE: analogy is a SCHEME (Walton). It is not a fallacy. The corresponding Family F critical question (analogy_mapping_missing, Family F) is where the mapping is probed; this family only detects the PATTERN. The output MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'bad reasoning', 'wrong'.",
  }),
  Object.freeze({
    rawKey: 'example_reasoning_present',
    label: 'Example reasoning',
    booleanQuestion:
      'Does this move use one or more concrete examples-of-the-same-kind as its primary support?',
    positiveDefinition:
      'The move advances a generalization or claim and supports it with specific examples from the same domain (not analogical mappings to a different domain).',
    negativeDefinition:
      'The move uses analogical mapping (analogy_reasoning_present), direct numerical evidence, or definitional / causal reasoning. A passing example without inferential weight is not example reasoning.',
    positiveExample:
      "Move: 'Carbon taxes can work — BC, Sweden, and Ireland all show measurable reductions in their first 5 years.' (three examples-of-same-kind)",
    negativeExample:
      "Move: 'Carbon taxes are like vaccines.' (analogy, not example)",
    falsePositiveGuards:
      'Do NOT confuse with analogy_reasoning_present — examples are same-kind; analogy maps across kinds. Do NOT mark TRUE for a single passing example without inferential weight. DOCTRINE: example reasoning is a structural scheme; the corresponding Family F critical question is example_representativeness_unclear.',
  }),
  Object.freeze({
    rawKey: 'authority_reasoning_present',
    label: 'Authority reasoning',
    booleanQuestion:
      'Does this move appeal to an authority (expert, institution, body of literature) as its primary support, where the inferential weight rests on the authority?',
    positiveDefinition:
      "The move cites an authority and the argument rests on the authority's credibility: 'the IPCC says X'; 'leading economists agree'; 'the medical consensus is'. The authority is the warrant, not just an attribution.",
    negativeDefinition:
      "The move cites an authority along with substantive evidence the authority used (mixed authority + evidence), or paraphrases an authority's reasoning without leaning on the authority's status.",
    positiveExample:
      "Move: 'The IPCC concludes that human emissions are the dominant cause of warming.'",
    negativeExample:
      "Move: 'Per the IPCC, atmospheric CO2 has risen from 280 to 420 ppm.' (cites a number from authority, not appeal-to-authority)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that cite an authority for specific evidence (that is evidence reasoning). Do NOT mark TRUE based on a citation alone — the inferential weight must rest on the authority's status. DOCTRINE: authority reasoning is a SCHEME; appeals to expertise are normal in epistemic argument. The corresponding Family F critical question is authority_basis_missing.",
  }),
  Object.freeze({
    rawKey: 'consequence_reasoning_present',
    label: 'Consequence reasoning',
    booleanQuestion:
      'Does this move argue from the predicted consequences of an action or policy as its primary support?',
    positiveDefinition:
      "The move advocates for or against an option based on predicted consequences: 'X will lead to Y, and Y is good/bad'. The consequence prediction is doing the inferential work.",
    negativeDefinition:
      'The move appeals to principle, definition, or precedent rather than consequence; or notes consequences as side facts without basing the argument on them.',
    positiveExample:
      "Move: 'We should not pass that bill — it will create a regulatory regime that drives out small businesses.' (consequence-driven)",
    negativeExample:
      "Move: 'That bill violates the constitution.' (principle, not consequence)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that mention consequences as side facts. Do NOT mark TRUE for moves that argue from principle even if consequences are also mentioned. DOCTRINE: consequence reasoning is a structural scheme; the corresponding Family F critical question is consequence_probability_unclear.',
  }),
  Object.freeze({
    rawKey: 'principle_reasoning_present',
    label: 'Principle reasoning',
    booleanQuestion:
      'Does this move argue from a stated principle or general rule, applying the principle to the case at hand?',
    positiveDefinition:
      "The move identifies a principle ('all people should be treated equally'; 'free speech requires content-neutral platforms') and argues the case follows from the principle.",
    negativeDefinition:
      'The move argues from consequences, evidence, or examples rather than a principle. Mention of principle as background without it being the warrant is not principle reasoning.',
    positiveExample:
      "Move: 'Equal protection means library funding should not depend on neighborhood wealth — the case follows.'",
    negativeExample:
      "Move: 'Equal protection was the framing of Brown v. Board.' (background, not warrant)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that mention principles as background. Do NOT mark TRUE for moves that argue case-by-case without invoking a general rule. DOCTRINE: principle reasoning is a normative scheme; both sides of a disagreement may invoke different principles. Detecting the scheme is NOT a judgment that any side is right.',
  }),
  Object.freeze({
    rawKey: 'definition_reasoning_present',
    label: 'Definition reasoning',
    booleanQuestion:
      'Does this move argue from a definition (the case at hand falls under or out of a definition, and the conclusion follows)?',
    positiveDefinition:
      "The move applies a definition: 'X falls under the definition of Y, therefore X has Y\\'s properties / treatments'. The definitional fit is the warrant.",
    negativeDefinition:
      'The move uses evidence, principle, consequence, or example rather than definition. Mention of a definition as background is not definition reasoning.',
    positiveExample:
      "Move: 'Libraries fall under the definition of public infrastructure, so they qualify for infrastructure funding.'",
    negativeExample:
      "Move: 'Libraries are public goods because the Pittsburgh data shows X.' (evidence, not definition)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that mention definitions as background. Do NOT confuse with disputes_definition (Family B) — that is challenging a definition; this is reasoning FROM one. DOCTRINE: definition reasoning is a structural scheme; the corresponding Family F critical question is definition_boundary_unclear.',
  }),
  Object.freeze({
    rawKey: 'classification_reasoning_present',
    label: 'Classification reasoning',
    booleanQuestion:
      'Does this move argue by classifying the case into a category and applying category-level conclusions?',
    positiveDefinition:
      "The move classifies the case ('this is a federal jurisdiction matter'; 'this is a tort case, not a contract case') and applies the category's general treatment.",
    negativeDefinition:
      'The move applies a definition without classification (definition_reasoning_present), or uses evidence within an accepted category, or reasons by case-specific facts without categorization.',
    positiveExample:
      "Move: 'This dispute is a contract matter, not tort — the resolution path is breach analysis, not negligence analysis.'",
    negativeExample:
      "Move: 'Libraries fall under the definition of infrastructure.' (definition, not classification)",
    falsePositiveGuards:
      'Do NOT confuse with definition reasoning — classification places into a category; definition applies a label. DOCTRINE: classification is a structural scheme; the corresponding Family F critical question is criterion_weighting_unclear.',
  }),
  Object.freeze({
    rawKey: 'precedent_reasoning_present',
    label: 'Precedent reasoning',
    booleanQuestion:
      'Does this move argue from precedent (a prior decision or established practice that should govern the present case)?',
    positiveDefinition:
      "The move identifies a precedent and argues the present case should follow it: 'in case X, the court decided Y; the present case is similar, so Y should apply'. The precedent is the warrant.",
    negativeDefinition:
      'The move uses a precedent as background or comparison without claiming it should govern. The move argues from first principles or fresh evidence.',
    positiveExample:
      "Move: 'In the Citizens United case, the court decided X; the present case is analogous and should be decided the same way.'",
    negativeExample:
      "Move: 'Citizens United is one of many cases on the topic.' (background)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that compare to a precedent without claiming it should govern. DOCTRINE: precedent reasoning is a structural scheme; closely related to analogy and example.',
  }),
  Object.freeze({
    rawKey: 'means_end_reasoning_present',
    label: 'Means-end reasoning',
    booleanQuestion:
      'Does this move use means-end (practical) reasoning — arguing that a specific action will achieve a stated end?',
    positiveDefinition:
      "The move identifies a goal and argues a specific action is the means to achieve it: 'we want X; doing Y will achieve X'. Walton's practical reasoning scheme.",
    negativeDefinition:
      'The move argues from consequences as good/bad (consequence_reasoning_present) rather than goal-instrument fit, or uses other schemes.',
    positiveExample:
      "Move: 'If the goal is reducing urban emissions, the most effective means is congestion pricing — directly targets the source.'",
    negativeExample:
      "Move: 'Congestion pricing will reduce emissions.' (consequence, not means-end)",
    falsePositiveGuards:
      'Do NOT confuse with consequence reasoning — means-end is goal-instrument fit; consequence is good/bad outcome prediction. DOCTRINE: practical reasoning is a structural scheme.',
  }),
  Object.freeze({
    rawKey: 'tradeoff_reasoning_present',
    label: 'Tradeoff reasoning',
    booleanQuestion:
      'Does this move argue by explicitly balancing tradeoffs between competing values, costs, or outcomes?',
    positiveDefinition:
      "The move identifies multiple competing considerations and argues for a position based on the balance: 'X gives us A but costs us B; on balance A outweighs B because...'.",
    negativeDefinition:
      'The move advances one consideration without balancing, dismisses the competing one, or uses cost-benefit specifically (cost_benefit_reasoning_present).',
    positiveExample:
      "Move: 'Library funding has opportunity cost vs museum funding; the literacy outcome data tips the balance toward libraries.'",
    negativeExample:
      "Move: 'Library funding is the right choice — period.' (no tradeoff balancing)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that mention tradeoffs without taking a balanced position. DOCTRINE: tradeoff reasoning is structural and is recovery-positive — it acknowledges legitimate competing considerations.',
  }),
  Object.freeze({
    rawKey: 'abductive_explanation_present',
    label: 'Abductive explanation',
    booleanQuestion:
      'Does this move use abductive reasoning — inferring the best explanation for observed evidence?',
    positiveDefinition:
      "The move identifies an observation and infers a likely cause / explanation as the best account: 'we see X; the best explanation for X is Y'. Inference to best explanation.",
    negativeDefinition:
      'The move uses direct causal claim without explanatory framing (causal_reasoning_present), or uses observation as evidence for a hypothesized cause without claiming it is the BEST explanation.',
    positiveExample:
      "Move: 'Pittsburgh literacy rose alongside library funding; the best explanation is the funding caused the rise, given that no other major program changed in that window.'",
    negativeExample:
      "Move: 'Library funding caused literacy gains.' (direct causal, not abductive)",
    falsePositiveGuards:
      "Do NOT confuse with causal reasoning — abductive infers cause from effect; causal asserts cause leads to effect. DOCTRINE: abductive explanation (Peirce: inference to best explanation) is a SCHEME, not a fallacy. It is a normal pattern in scientific argument. Detecting it does NOT mean the inference is sound or unsound. The output MUST NOT contain words like 'fallacy', 'invalid', 'flawed', 'weak', 'wrong'.",
  }),
  Object.freeze({
    rawKey: 'exception_reasoning_present',
    label: 'Exception reasoning',
    booleanQuestion:
      'Does this move argue that the present case is an exception to a general rule the parent invoked?',
    positiveDefinition:
      "The parent invoked a general rule; the move argues the present case is an exception: 'usually X, but here the special circumstance Y makes X not apply'. Toulmin rebuttal scheme.",
    negativeDefinition:
      'The move challenges the general rule itself (challenges_parent), or extends the rule, or proposes a different rule.',
    positiveExample:
      "Parent: 'Carbon taxes work in stable jurisdictions.' Move: 'The Australia case is the exception — political instability led to repeal before measurement.' (exception)",
    negativeExample:
      "Move: 'Carbon taxes do not work.' (challenges rule)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that challenge the rule itself. DOCTRINE: exception reasoning is structural; per Toulmin (1958) exceptions are part of the warrant structure.',
  }),
  Object.freeze({
    rawKey: 'slippery_slope_reasoning_present',
    label: 'Slippery-slope reasoning',
    booleanQuestion:
      'Does this move argue against a proposed action by claiming it will lead to a chain of further consequences, each leading to the next?',
    positiveDefinition:
      "The move argues 'if we do X, that will lead to X1, which will lead to X2, which will lead to a bad final state'. A multi-step consequence chain.",
    negativeDefinition:
      'The move argues from a single direct consequence (consequence_reasoning_present) or from independent multiple consequences not linked in a chain.',
    positiveExample:
      "Move: 'If we ban X, that will normalize content restriction, which will lead to banning Y, then Z, then mainstream censorship.'",
    negativeExample:
      "Move: 'Banning X has the consequence of suppressing free speech.' (direct consequence, not chained)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that note multiple consequences without linking them in a chain. DOCTRINE: slippery-slope is a SCHEME, never a fallacy. The corresponding critical question (consequence_probability_unclear, Family F) is the place where chain-step probability is probed; this family only detects the PATTERN. The output evidenceSpan MUST be a verbatim quote from the move body anchoring the chain-of-consequences pattern; it MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'bad reasoning', 'flawed', 'wrong', 'proof of', 'logical error', or any quality judgment. If the move's text itself contains the word 'fallacy' (e.g., 'critics call this a fallacy, but...'), the model may still detect the slippery-slope PATTERN if present, but the model's own output must NOT echo or assert the fallacy framing. The evidenceSpan must anchor the chain pattern, not the fallacy framing.",
  }),
  Object.freeze({
    rawKey: 'cost_benefit_reasoning_present',
    label: 'Cost-benefit reasoning',
    booleanQuestion:
      'Does this move use explicit cost-benefit reasoning — quantifying costs and benefits and arguing the net is positive or negative?',
    positiveDefinition:
      'The move identifies measurable costs and measurable benefits and argues for or against based on the net. Common in policy and economic reasoning.',
    negativeDefinition:
      'The move uses qualitative tradeoff (tradeoff_reasoning_present) without quantifying, or argues from principle / consequence without cost-benefit framing.',
    positiveExample:
      "Move: 'Library funding costs $5M/year and yields measurable literacy gains worth $20M in lifetime earnings — net positive.'",
    negativeExample:
      "Move: 'Library funding is worth it on balance.' (tradeoff, not quantified)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that mention costs and benefits without quantifying. DOCTRINE: cost-benefit reasoning is a structural scheme; cost-benefit framing presupposes commensurability — value disagreements about what counts as cost / benefit are legitimate.',
  }),
  Object.freeze({
    rawKey: 'risk_reasoning_present',
    label: 'Risk reasoning',
    booleanQuestion:
      'Does this move argue by identifying a risk (probability × magnitude of harm) and using the risk as primary support?',
    positiveDefinition:
      "The move identifies a low-probability high-magnitude outcome (or vice versa) and argues from the risk: 'X has a 5% chance of catastrophic outcome Y; that risk justifies precaution'.",
    negativeDefinition:
      'The move argues from direct consequence prediction (consequence_reasoning_present) or expected value (cost_benefit_reasoning_present) without framing the argument around risk.',
    positiveExample:
      "Move: 'Even at low probability, catastrophic AI misuse warrants precaution.' (risk reasoning)",
    negativeExample:
      "Move: 'AI will lead to mass unemployment.' (consequence, not risk)",
    falsePositiveGuards:
      'Do NOT confuse with consequence reasoning — risk involves explicit probability + magnitude framing. DOCTRINE: risk reasoning is a structural scheme; risk arguments rest on probability estimates; the estimate itself can be challenged via evidence (orthogonal to scheme detection).',
  }),
  // ── MCP-BUILD2e (Build-2 manifest §4) — argument-scheme structure booleans. ──
  Object.freeze({
    rawKey: 'linked_premise_structure',
    label: 'Premises that depend on each other',
    booleanQuestion:
      'Does this move use linked premises (each premise needed; they fail together)?',
    positiveDefinition:
      'The move advances its conclusion through premises that are INTERDEPENDENT — each premise is needed and they fail together. Remove any one and the inference collapses.',
    negativeDefinition:
      'The move uses premises that each INDEPENDENTLY support the conclusion (that is convergent_premise_structure), or it has a single premise, or no discernible premise structure.',
    positiveExample:
      "Move: 'Only if the tax is durable AND enforced does it cut emissions — both are required.'",
    negativeExample:
      "Move: 'It works for three independent reasons: cost, equity, and feasibility.' (each reason stands alone — convergent_premise_structure)",
    falsePositiveGuards:
      'Linked means the premises FAIL TOGETHER (interdependent); do NOT mark a list of independent reasons (that is convergent_premise_structure). DOCTRINE: this is a structural description of the inference shape, never a quality verdict. The theory term "linked" is internal taxonomy; the output evidenceSpan must anchor the interdependent-premise pattern, never assert the argument is weak / invalid / flawed / wrong.',
  }),
  Object.freeze({
    rawKey: 'convergent_premise_structure',
    label: 'Premises that each stand alone',
    booleanQuestion:
      'Does this move use convergent premises (each premise independently supports the conclusion)?',
    positiveDefinition:
      'The move advances its conclusion through premises that are INDEPENDENT — each one supports the conclusion on its own, so any single premise would suffice.',
    negativeDefinition:
      'The move uses interdependent premises that fail together (that is linked_premise_structure), or it has a single premise, or no discernible premise structure.',
    positiveExample:
      "Move: 'Even if cost weren't an issue, equity alone justifies it; and feasibility alone would too.' (each premise stands on its own)",
    negativeExample:
      "Move: 'You need both A and B for this to hold.' (interdependent — linked_premise_structure)",
    falsePositiveGuards:
      'Convergent means each premise INDEPENDENTLY supports the conclusion; do NOT mark interdependent premises (that is linked_premise_structure). DOCTRINE: this is a structural description of the inference shape, never a quality verdict. The theory term "convergent" is internal taxonomy; the output must never assert the argument is weak / invalid / flawed / wrong.',
  }),
  Object.freeze({
    rawKey: 'enthymeme_gap_detected',
    label: 'Relies on an unstated step',
    booleanQuestion:
      'Does this move rely on an unstated premise (an enthymeme gap)?',
    positiveDefinition:
      "The move's conclusion depends on a LOAD-BEARING premise that the move never states (e.g. 'EVs are clean' — unstated: the grid is clean). The gap is a structural feature of THIS move's inference.",
    negativeDefinition:
      "The move states all the premises its conclusion depends on; or a critical-question move that ASKS about a missing premise in the parent (that is Family F's unstated_assumption / missing_warrant, not a gap in this move).",
    positiveExample:
      "Move: 'He's an expert, so he's right.' (unstated load-bearing premise: experts in this domain are reliable here)",
    negativeExample:
      "Move: 'He's an expert in climate policy, his peers concur, so this estimate is credible.' (the load-bearing premise is stated)",
    falsePositiveGuards:
      "The gap must be a LOAD-BEARING unstated premise, not a stylistic omission; do NOT mark every compressed sentence. Distinguish enthymeme_gap_detected (THIS move HAS a gap) from Family F's unstated_assumption (a critical QUESTION about a gap in the parent). DOCTRINE (VERDICT-ADJACENT — gap-is-not-a-verdict): detecting a gap is a STRUCTURAL observation about the move's inference, never a verdict that the argument is weak / wrong / flawed / invalid / bad reasoning / a logical error. A gap is an invitation to state the premise, not a defeat (cdiscourse-doctrine §1). The output describes THIS REPLY, never the author ('this person reasons sloppily' is forbidden). The theory term 'enthymeme' is internal taxonomy; the evidenceSpan must anchor the unstated-step pattern, not any quality judgment.",
  }),
]);
