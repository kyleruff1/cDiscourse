/**
 * MCP-021A + MCP-BUILD2e — Family E (argument_scheme) definitions.
 *
 * 19 entries total (MCP-021A baseline 16 + MCP-BUILD2e +3).
 *  - 16 MCP-021A: causal/analogy/example/authority/consequence/principle/
 *    definition/classification/precedent/means-end/tradeoff/abductive/
 *    exception/slippery-slope/cost-benefit/risk reasoning-present schemes.
 *  - 3 MCP-BUILD2e (Build-2 manifest §4; all Inspect-only): the
 *    argument-scheme structure observations linked_premise_structure,
 *    convergent_premise_structure, enthymeme_gap_detected. NO
 *    schema-version bump (vocabulary expansion, not a wire change).
 *
 * All defaultSurface 'inspect', disposition 'future_source',
 * source: 'ai_classifier'.
 *
 * Doctrine binding for every Family E entry (per design §3.5):
 * copy NEVER labels a scheme a "fallacy" even when its critical
 * question (Family F) is unmet. Schemes are descriptive shape facts.
 * The critical-question framing is what keeps Family E + F safe.
 *
 * The 3 MCP-BUILD2e booleans describe a structural feature of the move's
 * inference. The argumentation-theory terms `linked` / `convergent` /
 * `enthymeme` stay INTERNAL (rawKey + internal metadata + classifier prompt);
 * the user-facing plain-language label is the gameCopy-mapped string, never the
 * raw theory term (GATE-A §8.2 rule 4 — theory labels never surfaced raw).
 * enthymeme_gap_detected is verdict-adjacent and is fenced "gap-is-not-a-verdict"
 * with extra falsePositiveGuards (describes the MOVE's inference — relying on an
 * unstated step — never the author, never "this argument is weak/wrong"; a gap
 * is an invitation to state the premise, not a defeat — cdiscourse-doctrine §1).
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — scheme presence is structural fact only.
 *   - cdiscourse-doctrine §1 — an enthymeme gap is an invitation to state the
 *     premise, never a defeat / weakness verdict.
 *   - Walton (1995, 2008) — argumentation schemes; every scheme has
 *     a corresponding critical question (Family F counterpart).
 *   - MCP-020 audit §"Rejected labels" — slippery_slope and similar
 *     schemes carry doctrine risk because the literature frames them
 *     as fallacies. CDiscourse treats them as schemes with critical
 *     questions, NOT as faults.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes';

const SCHEME_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

interface SchemeBuilder {
  rawKey: string;
  label: string;
  shortLabel: string;
  description: string;
  priority: number;
  booleanQuestion: string;
  positiveDefinition: string;
  negativeDefinition: string;
  positiveExamples: ReadonlyArray<string>;
  negativeExamples: ReadonlyArray<string>;
  falsePositiveGuards: ReadonlyArray<string>;
  doctrineNotes: ReadonlyArray<string>;
}

function buildScheme(b: SchemeBuilder): MachineObservationDefinition {
  return Object.freeze({
    id: `registry:machine_observation:ai_classifier:${b.rawKey}`,
    rawKey: b.rawKey,
    kind: 'machine_observation' as const,
    source: 'ai_classifier' as const,
    family: 'argument_scheme' as const,
    label: b.label,
    shortLabel: b.shortLabel,
    description: b.description,
    defaultSurface: 'inspect' as const,
    disposition: 'future_source' as const,
    priority: b.priority,
    visibleByDefault: false,

    booleanQuestion: b.booleanQuestion,
    positiveDefinition: b.positiveDefinition,
    negativeDefinition: b.negativeDefinition,
    positiveExamples: b.positiveExamples,
    negativeExamples: b.negativeExamples,
    falsePositiveGuards: b.falsePositiveGuards,
    doctrineNotes: b.doctrineNotes,
    confidenceEligibility: SCHEME_INSPECT_ELIGIBILITY,
  });
}

export const FAMILY_E_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  buildScheme({
    rawKey: 'causal_reasoning_present',
    label: 'Causal reasoning',
    shortLabel: 'Causal',
    description: 'This move uses causal reasoning as its primary support.',
    priority: 200,
    booleanQuestion:
      'Does this move use cause-and-effect reasoning (X causes Y) as its primary support?',
    positiveDefinition:
      'The move argues from a cause to its effect, or from an effect to a likely cause. The causal claim is doing the inferential work, not merely incidental.',
    negativeDefinition:
      'The move uses correlation without claiming causation, evidence without inferential structure, or definitional / analogical / value reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'Carbon taxes work because they raise the price of carbon, which reduces consumption.'",
      "Move: 'Library funding caused literacy gains in Pittsburgh because dosed-program studies show direct effects.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes and emission drops correlate.' (correlation, no causal claim)",
      "Move: 'Libraries fall under public infrastructure.' (definitional)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that note correlation without claiming causation.',
      'Do NOT mark TRUE for moves that mention causes as background without using the causal claim as support.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: causal reasoning is a scheme; never labeled a fallacy.',
      'Walton (1995): causal scheme; critical question is causal_mechanism_missing (Family F).',
    ]),
  }),

  buildScheme({
    rawKey: 'analogy_reasoning_present',
    label: 'Analogy reasoning',
    shortLabel: 'Analogy',
    description: 'This move uses an analogy as its primary support.',
    priority: 201,
    booleanQuestion:
      'Does this move use an analogy (mapping the case under discussion to a different case) as its primary form of support?',
    positiveDefinition:
      'The move advances its position by drawing a comparison to a different case / domain / situation, with the implication that what is true of the comparison applies to the case at hand.',
    negativeDefinition:
      "The move uses direct evidence, examples-of-the-same-case, definitional argument, or causal reasoning. A passing comparison ('like a library') without inferential weight is NOT analogy reasoning.",
    positiveExamples: Object.freeze([
      "Move: 'Libraries are like roads — public goods that should be funded collectively.' (analogy: roads → libraries)",
      "Move: 'Imposing a carbon tax is like vaccinating against a contagion: the cost falls on individuals but the benefit is communal.'",
      "Move: 'Treating misinformation requires the same posture as treating spam: filter at the platform, not the individual.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Libraries are public goods, like roads and parks.' (passing comparison; inferential work from definition)",
      "Move: 'The Pittsburgh library outcome data shows...' (evidence-based, not analogical)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for passing similes; the analogy must bear inferential weight.',
      'Do NOT mark TRUE for examples-of-the-same-kind (those are example_reasoning_present).',
      'Do NOT mark TRUE based on the word "like" alone.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: analogy presence is a SCHEME fact, NEVER a verdict that the analogy is fallacious.',
      'Walton (1995): analogy scheme; critical question is analogy_mapping_missing (Family F).',
    ]),
  }),

  buildScheme({
    rawKey: 'example_reasoning_present',
    label: 'Example reasoning',
    shortLabel: 'Example',
    description: 'This move uses one or more examples as its primary support.',
    priority: 202,
    booleanQuestion:
      'Does this move use one or more concrete examples-of-the-same-kind as its primary support?',
    positiveDefinition:
      'The move advances a generalization or claim and supports it with specific examples from the same domain (not analogical mappings to a different domain).',
    negativeDefinition:
      'The move uses analogical mapping (analogy_reasoning_present), direct numerical evidence, or definitional / causal reasoning. A passing example without inferential weight is not example reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'Carbon taxes can work — BC, Sweden, and Ireland all show measurable reductions in their first 5 years.' (three examples-of-same-kind)",
      "Move: 'Library funding boosts literacy: Pittsburgh, Detroit (post-2020), and Indianapolis all show gains.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes are like vaccines.' (analogy, not example)",
      "Move: 'Carbon emissions dropped 5% in BC.' (single data point; less than example reasoning)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with analogy_reasoning_present — examples are same-kind; analogy maps across kinds.',
      'Do NOT mark TRUE for a single passing example without inferential weight.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: example reasoning is a structural scheme.',
      'Walton (1995): example scheme; critical question is example_representativeness_unclear (Family F).',
    ]),
  }),

  buildScheme({
    rawKey: 'authority_reasoning_present',
    label: 'Authority reasoning',
    shortLabel: 'Authority',
    description: 'This move appeals to an authority as its primary support.',
    priority: 203,
    booleanQuestion:
      'Does this move appeal to an authority (expert, institution, body of literature) as its primary support, where the inferential weight rests on the authority?',
    positiveDefinition:
      "The move cites an authority and the argument rests on the authority's credibility: 'the IPCC says X'; 'leading economists agree'; 'the medical consensus is'. The authority is the warrant, not just an attribution.",
    negativeDefinition:
      "The move cites an authority along with substantive evidence the authority used (mixed authority + evidence), or paraphrases an authority's reasoning without leaning on the authority's status.",
    positiveExamples: Object.freeze([
      "Move: 'The IPCC concludes that human emissions are the dominant cause of warming.'",
      "Move: 'Leading economists agree that carbon pricing is effective.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Per the IPCC, atmospheric CO2 has risen from 280 to 420 ppm.' (cites a number from authority, not appeal-to-authority)",
      "Move: 'The 2020 Stanford study showed 13%.' (specific evidence from a named source, not authority appeal)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that cite an authority for specific evidence (that is evidence reasoning).',
      "Do NOT mark TRUE based on a citation alone — the inferential weight must rest on the authority's status.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: authority reasoning is a scheme; appeals to expertise are normal in epistemic argument.',
      'Walton (1995): expert authority scheme; critical question is authority_basis_missing (Family F).',
    ]),
  }),

  buildScheme({
    rawKey: 'consequence_reasoning_present',
    label: 'Consequence reasoning',
    shortLabel: 'Consequence',
    description: 'This move argues from the consequences of an action.',
    priority: 204,
    booleanQuestion:
      'Does this move argue from the predicted consequences of an action or policy as its primary support?',
    positiveDefinition:
      "The move advocates for or against an option based on predicted consequences: 'X will lead to Y, and Y is good/bad'. The consequence prediction is doing the inferential work.",
    negativeDefinition:
      'The move appeals to principle, definition, or precedent rather than consequence; or notes consequences as side facts without basing the argument on them.',
    positiveExamples: Object.freeze([
      "Move: 'We should not pass that bill — it will create a regulatory regime that drives out small businesses.' (consequence-driven)",
      "Move: 'Library funding should be increased — the 5-year consequence is measurable literacy gain and reduced inequality.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'That bill violates the constitution.' (principle, not consequence)",
      "Move: 'Library funding is the right thing because libraries are public goods.' (principle)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that mention consequences as side facts.',
      'Do NOT mark TRUE for moves that argue from principle even if consequences are also mentioned.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: consequence reasoning is a structural scheme.',
      'Walton (1995): argument from consequences; critical question is consequence_probability_unclear (Family F).',
    ]),
  }),

  buildScheme({
    rawKey: 'principle_reasoning_present',
    label: 'Principle reasoning',
    shortLabel: 'Principle',
    description: 'This move argues from a principle or rule.',
    priority: 205,
    booleanQuestion:
      'Does this move argue from a stated principle or general rule, applying the principle to the case at hand?',
    positiveDefinition:
      "The move identifies a principle ('all people should be treated equally'; 'free speech requires content-neutral platforms') and argues the case follows from the principle.",
    negativeDefinition:
      'The move argues from consequences, evidence, or examples rather than a principle. Mention of principle as background without it being the warrant is not principle reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'Equal protection means library funding should not depend on neighborhood wealth — the case follows.'",
      "Move: 'Content-neutral platforms cannot censor lawful speech; the policy in question violates that principle.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Equal protection was the framing of Brown v. Board.' (background, not warrant)",
      "Move: 'Library funding is effective in Pittsburgh.' (evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that mention principles as background.',
      'Do NOT mark TRUE for moves that argue case-by-case without invoking a general rule.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: principle reasoning is a normative scheme; both sides of a disagreement may invoke different principles.',
    ]),
  }),

  buildScheme({
    rawKey: 'definition_reasoning_present',
    label: 'Definition reasoning',
    shortLabel: 'Definition',
    description: 'This move argues from a definition.',
    priority: 206,
    booleanQuestion:
      'Does this move argue from a definition (the case at hand falls under or out of a definition, and the conclusion follows)?',
    positiveDefinition:
      "The move applies a definition: 'X falls under the definition of Y, therefore X has Y\\'s properties / treatments'. The definitional fit is the warrant.",
    negativeDefinition:
      'The move uses evidence, principle, consequence, or example rather than definition. Mention of a definition as background is not definition reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'Libraries fall under the definition of public infrastructure, so they qualify for infrastructure funding.'",
      "Move: 'This action meets the legal definition of breach; the contractual remedies apply.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Libraries are public goods because the Pittsburgh data shows X.' (evidence, not definition)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that mention definitions as background.',
      'Do NOT confuse with disputes_definition (Family B) — that is challenging a definition; this is reasoning FROM one.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: definition reasoning is a structural scheme.',
      'Walton (1995): definition scheme; critical question is definition_boundary_unclear (Family F).',
    ]),
  }),

  buildScheme({
    rawKey: 'classification_reasoning_present',
    label: 'Classification reasoning',
    shortLabel: 'Classify',
    description: 'This move argues from a classification.',
    priority: 207,
    booleanQuestion:
      'Does this move argue by classifying the case into a category and applying category-level conclusions?',
    positiveDefinition:
      "The move classifies the case ('this is a federal jurisdiction matter'; 'this is a tort case, not a contract case') and applies the category's general treatment.",
    negativeDefinition:
      'The move applies a definition without classification (definition_reasoning_present), or uses evidence within an accepted category, or reasons by case-specific facts without categorization.',
    positiveExamples: Object.freeze([
      "Move: 'This dispute is a contract matter, not tort — the resolution path is breach analysis, not negligence analysis.'",
      "Move: 'Carbon emissions from agriculture fall in a different regulatory class than industrial emissions; the federal rule does not apply.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Libraries fall under the definition of infrastructure.' (definition, not classification)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with definition reasoning — classification places into a category; definition applies a label.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: classification is a structural scheme.',
      'Walton (1995): classification scheme; critical question is criterion_weighting_unclear (Family F).',
    ]),
  }),

  buildScheme({
    rawKey: 'precedent_reasoning_present',
    label: 'Precedent reasoning',
    shortLabel: 'Precedent',
    description: 'This move argues from precedent.',
    priority: 208,
    booleanQuestion:
      'Does this move argue from precedent (a prior decision or established practice that should govern the present case)?',
    positiveDefinition:
      "The move identifies a precedent and argues the present case should follow it: 'in case X, the court decided Y; the present case is similar, so Y should apply'. The precedent is the warrant.",
    negativeDefinition:
      'The move uses a precedent as background or comparison without claiming it should govern. The move argues from first principles or fresh evidence.',
    positiveExamples: Object.freeze([
      "Move: 'In the Citizens United case, the court decided X; the present case is analogous and should be decided the same way.'",
      "Move: 'Pittsburgh increased library funding 12% in 2020 and saw measurable literacy gains; this serves as precedent for the Detroit proposal.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Citizens United is one of many cases on the topic.' (background)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that compare to a precedent without claiming it should govern.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: precedent reasoning is a structural scheme.',
      'Walton (1995): precedent scheme; closely related to analogy and example.',
    ]),
  }),

  buildScheme({
    rawKey: 'means_end_reasoning_present',
    label: 'Means-end reasoning',
    shortLabel: 'Means-end',
    description: 'This move argues by means-end (practical) reasoning.',
    priority: 209,
    booleanQuestion:
      'Does this move use means-end (practical) reasoning — arguing that a specific action will achieve a stated end?',
    positiveDefinition:
      "The move identifies a goal and argues a specific action is the means to achieve it: 'we want X; doing Y will achieve X'. Walton's practical reasoning scheme.",
    negativeDefinition:
      'The move argues from consequences as good/bad (consequence_reasoning_present) rather than goal-instrument fit, or uses other schemes.',
    positiveExamples: Object.freeze([
      "Move: 'If the goal is reducing urban emissions, the most effective means is congestion pricing — directly targets the source.'",
      "Move: 'We want better literacy outcomes; investing in libraries is the means most directly tied to the outcome.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Congestion pricing will reduce emissions.' (consequence, not means-end)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with consequence reasoning — means-end is goal-instrument fit; consequence is good/bad outcome prediction.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: practical reasoning is a structural scheme.',
      'Walton (1995): practical reasoning scheme.',
    ]),
  }),

  buildScheme({
    rawKey: 'tradeoff_reasoning_present',
    label: 'Tradeoff reasoning',
    shortLabel: 'Tradeoff',
    description: 'This move uses tradeoff reasoning.',
    priority: 210,
    booleanQuestion:
      'Does this move argue by explicitly balancing tradeoffs between competing values, costs, or outcomes?',
    positiveDefinition:
      "The move identifies multiple competing considerations and argues for a position based on the balance: 'X gives us A but costs us B; on balance A outweighs B because...'.",
    negativeDefinition:
      'The move advances one consideration without balancing, dismisses the competing one, or uses cost-benefit specifically (cost_benefit_reasoning_present).',
    positiveExamples: Object.freeze([
      "Move: 'Library funding has opportunity cost vs museum funding; the literacy outcome data tips the balance toward libraries.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding is the right choice — period.' (no tradeoff balancing)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that mention tradeoffs without taking a balanced position.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: tradeoff reasoning is structural.',
      'point-standing-economy: tradeoff reasoning is recovery-positive — it acknowledges legitimate competing considerations.',
    ]),
  }),

  buildScheme({
    rawKey: 'abductive_explanation_present',
    label: 'Abductive explanation',
    shortLabel: 'Abductive',
    description: 'This move uses abductive (inference-to-best-explanation) reasoning.',
    priority: 211,
    booleanQuestion:
      'Does this move use abductive reasoning — inferring the best explanation for observed evidence?',
    positiveDefinition:
      "The move identifies an observation and infers a likely cause / explanation as the best account: 'we see X; the best explanation for X is Y'. Inference to best explanation.",
    negativeDefinition:
      'The move uses direct causal claim without explanatory framing (causal_reasoning_present), or uses observation as evidence for a hypothesized cause without claiming it is the BEST explanation.',
    positiveExamples: Object.freeze([
      "Move: 'Pittsburgh literacy rose alongside library funding; the best explanation is the funding caused the rise, given that no other major program changed in that window.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding caused literacy gains.' (direct causal, not abductive)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with causal reasoning — abductive infers cause from effect; causal asserts cause leads to effect.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: abductive reasoning is structural.',
      'Peirce: inference to best explanation; common in scientific argument.',
    ]),
  }),

  buildScheme({
    rawKey: 'exception_reasoning_present',
    label: 'Exception reasoning',
    shortLabel: 'Exception',
    description: 'This move argues by identifying an exception to a general rule.',
    priority: 212,
    booleanQuestion:
      'Does this move argue that the present case is an exception to a general rule the parent invoked?',
    positiveDefinition:
      "The parent invoked a general rule; the move argues the present case is an exception: 'usually X, but here the special circumstance Y makes X not apply'. Toulmin rebuttal scheme.",
    negativeDefinition:
      'The move challenges the general rule itself (challenges_parent), or extends the rule, or proposes a different rule.',
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes work in stable jurisdictions.' Move: 'The Australia case is the exception — political instability led to repeal before measurement.' (exception)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes do not work.' (challenges rule)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that challenge the rule itself.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: exception reasoning is structural.',
      'Toulmin (1958): rebuttal — exceptions are part of the warrant structure.',
    ]),
  }),

  buildScheme({
    rawKey: 'slippery_slope_reasoning_present',
    label: 'Slippery-slope reasoning',
    shortLabel: 'Slippery',
    description: 'This move argues via a chain of consequences (slippery slope).',
    priority: 213,
    booleanQuestion:
      'Does this move argue against a proposed action by claiming it will lead to a chain of further consequences, each leading to the next?',
    positiveDefinition:
      "The move argues 'if we do X, that will lead to X1, which will lead to X2, which will lead to a bad final state'. A multi-step consequence chain.",
    negativeDefinition:
      'The move argues from a single direct consequence (consequence_reasoning_present) or from independent multiple consequences not linked in a chain.',
    positiveExamples: Object.freeze([
      "Move: 'If we ban X, that will normalize content restriction, which will lead to banning Y, then Z, then mainstream censorship.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Banning X has the consequence of suppressing free speech.' (direct consequence, not chained)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that note multiple consequences without linking them in a chain.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: slippery-slope is a SCHEME; copy MUST NOT label it a fallacy.',
      'MCP-020 audit §Rejected labels: slippery_slope carries doctrine risk because the literature frames it as a fallacy. CDiscourse treats it as a scheme with critical questions; the corresponding Family F critical question is consequence_probability_unclear.',
      "Walton (1995): slippery-slope scheme; critical questions probe each step's probability.",
    ]),
  }),

  buildScheme({
    rawKey: 'cost_benefit_reasoning_present',
    label: 'Cost-benefit reasoning',
    shortLabel: 'Cost-benefit',
    description: 'This move uses cost-benefit reasoning.',
    priority: 214,
    booleanQuestion:
      'Does this move use explicit cost-benefit reasoning — quantifying costs and benefits and arguing the net is positive or negative?',
    positiveDefinition:
      'The move identifies measurable costs and measurable benefits and argues for or against based on the net. Common in policy and economic reasoning.',
    negativeDefinition:
      'The move uses qualitative tradeoff (tradeoff_reasoning_present) without quantifying, or argues from principle / consequence without cost-benefit framing.',
    positiveExamples: Object.freeze([
      "Move: 'Library funding costs $5M/year and yields measurable literacy gains worth $20M in lifetime earnings — net positive.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding is worth it on balance.' (tradeoff, not quantified)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that mention costs and benefits without quantifying.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: cost-benefit reasoning is a structural scheme.',
      'cdiscourse-doctrine §1: cost-benefit framing presupposes commensurability — value disagreements about what counts as cost / benefit are legitimate.',
    ]),
  }),

  buildScheme({
    rawKey: 'risk_reasoning_present',
    label: 'Risk reasoning',
    shortLabel: 'Risk',
    description: 'This move uses risk-based reasoning.',
    priority: 215,
    booleanQuestion:
      'Does this move argue by identifying a risk (probability × magnitude of harm) and using the risk as primary support?',
    positiveDefinition:
      "The move identifies a low-probability high-magnitude outcome (or vice versa) and argues from the risk: 'X has a 5% chance of catastrophic outcome Y; that risk justifies precaution'.",
    negativeDefinition:
      'The move argues from direct consequence prediction (consequence_reasoning_present) or expected value (cost_benefit_reasoning_present) without framing the argument around risk.',
    positiveExamples: Object.freeze([
      "Move: 'Even at low probability, catastrophic AI misuse warrants precaution.' (risk reasoning)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'AI will lead to mass unemployment.' (consequence, not risk)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with consequence reasoning — risk involves explicit probability + magnitude framing.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: risk reasoning is a structural scheme.',
      'evidence-doctrine: risk arguments rest on probability estimates; the estimate itself can be challenged via evidence.',
    ]),
  }),

  // ── MCP-BUILD2e (argument_scheme expansion) ───────────────────────────
  // Three Build-2e booleans per the Build-2 manifest §4. These describe the
  // STRUCTURE of the move's inference — whether its premises are linked (each
  // needed; they fail together), whether they are convergent (each
  // independently supports the conclusion), and whether the move relies on an
  // unstated load-bearing premise (an enthymeme gap). All Inspect-only; none
  // are verdicts. The argumentation-theory terms `linked` / `convergent` /
  // `enthymeme` stay INTERNAL (rawKey + classifier prompt); the user-facing
  // label / shortLabel / description carry only plain-language. The third,
  // enthymeme_gap_detected, is verdict-adjacent and is fenced
  // "gap-is-not-a-verdict": it describes a structural feature of the MOVE's
  // inference (relies on an unstated step), advisory, never "this argument is
  // weak/wrong" and never the author — a gap is an invitation to state the
  // premise, not a defeat (cdiscourse-doctrine §1).

  // BUILD2e #1 linked_premise_structure (Inspect-only)
  buildScheme({
    rawKey: 'linked_premise_structure',
    label: 'Premises that depend on each other',
    shortLabel: 'Dependent premises',
    description:
      'This move uses premises that each need the others, so they stand or fall together.',
    priority: 216,
    booleanQuestion:
      'Does this move use linked premises (each premise needed; they fail together)?',
    positiveDefinition:
      'The move advances its conclusion through premises that are INTERDEPENDENT — each premise is needed and they fail together. Remove any one and the inference collapses. ("Only if the tax is durable AND enforced does it cut emissions — both are required.")',
    negativeDefinition:
      'The move uses premises that each INDEPENDENTLY support the conclusion (that is the convergent structure, convergent_premise_structure), or it has a single premise, or no discernible premise structure.',
    positiveExamples: Object.freeze([
      "Move: 'Only if the tax is durable AND enforced does it cut emissions — both are required.'",
      "Move: 'It works because the population is large and the effect is per-capita; remove either and the case collapses.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'It works for three independent reasons: cost, equity, and feasibility.' (each reason stands alone — convergent_premise_structure)",
      "Move: 'It works.' (no premise structure)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Linked means the premises FAIL TOGETHER (interdependent); do NOT mark a list of independent reasons (that is convergent_premise_structure).',
      'Distinguish sharply from convergent_premise_structure — the two are mutually exclusive on the same inference, though both may appear in a multi-part move.',
      'This observation describes a structural feature of the MOVE, never the author; the presence or absence of a linked structure is not a quality verdict.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: a structural description of the inference shape (Walton / argumentation-scheme theory term), surfaced as plain-language; no quality verdict.',
      'GATE-A §8.2 rule 4: the theory term "linked" stays internal (rawKey + classifier prompt); the user-facing label is the plain-language gameCopy string, never the raw theory term.',
    ]),
  }),

  // BUILD2e #2 convergent_premise_structure (Inspect-only)
  buildScheme({
    rawKey: 'convergent_premise_structure',
    label: 'Premises that each stand alone',
    shortLabel: 'Independent premises',
    description:
      'This move uses premises that each independently support its conclusion.',
    priority: 217,
    booleanQuestion:
      'Does this move use convergent premises (each premise independently supports the conclusion)?',
    positiveDefinition:
      'The move advances its conclusion through premises that are INDEPENDENT — each one supports the conclusion on its own, so any single premise would suffice. ("Even if cost were not an issue, equity alone justifies it; and feasibility alone would too.")',
    negativeDefinition:
      'The move uses interdependent premises that fail together (that is the linked structure, linked_premise_structure), or it has a single premise, or no discernible premise structure.',
    positiveExamples: Object.freeze([
      "Move: 'Even if cost weren't an issue, equity alone justifies it; and feasibility alone would too.' (each premise stands on its own)",
      "Move: 'It's good on the merits AND independently good politically.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'You need both A and B for this to hold.' (interdependent — linked_premise_structure)",
      "Move: 'Because A.' (single premise)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Convergent means each premise INDEPENDENTLY supports the conclusion; do NOT mark interdependent premises (that is linked_premise_structure).',
      'linked_premise_structure and convergent_premise_structure are mutually exclusive on the same inference, though both may appear in a multi-part move.',
      'This observation describes a structural feature of the MOVE, never the author; convergent structure is not a quality verdict.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: a structural description of the inference shape (the mirror of the linked structure); no quality verdict.',
      'GATE-A §8.2 rule 4: the theory term "convergent" stays internal (rawKey + classifier prompt); the user-facing label is the plain-language gameCopy string, never the raw theory term.',
    ]),
  }),

  // BUILD2e #3 enthymeme_gap_detected (Inspect-only; VERDICT-ADJACENT)
  buildScheme({
    rawKey: 'enthymeme_gap_detected',
    label: 'Relies on an unstated step',
    shortLabel: 'Unstated step',
    description:
      "This move's conclusion relies on a load-bearing premise it does not state.",
    priority: 218,
    booleanQuestion:
      'Does this move rely on an unstated premise (an enthymeme gap)?',
    positiveDefinition:
      "The move's conclusion depends on a LOAD-BEARING premise that the move never states. (\"EVs are clean\" — unstated: the grid is clean. \"It's natural, therefore safe\" — unstated: natural implies safe.) The gap is a structural feature of THIS move's inference.",
    negativeDefinition:
      "The move states all the premises its conclusion depends on; or a critical-question move that ASKS about a missing premise in the parent (that is Family F's unstated_assumption / missing_warrant, a question about the parent, not a gap in this move).",
    positiveExamples: Object.freeze([
      "Move: 'He's an expert, so he's right.' (unstated load-bearing premise: experts in this domain are reliable here)",
      "Move: 'It's natural, therefore safe.' (unstated load-bearing premise: natural implies safe)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'He's an expert in climate policy, his peers concur, so this estimate is credible.' (the load-bearing premise is stated)",
      "Move: 'What's the unstated assumption here?' (a Family F critical question about the parent, not a gap in this move)",
    ]),
    falsePositiveGuards: Object.freeze([
      'This observation describes a structural feature of the MOVE\'s inference (it relies on an unstated step), never the author; it is NEVER a verdict that the argument is weak, wrong, flawed, or invalid. A gap is an invitation to state the premise, not a defeat.',
      'The gap must be a LOAD-BEARING unstated premise, not a stylistic omission; do NOT mark every compressed sentence.',
      'Distinguish enthymeme_gap_detected (THIS move HAS a gap — a structural fact about this move) from Family F\'s unstated_assumption (a critical QUESTION asking about a gap in the parent).',
      'Do NOT treat the PRESENCE of this observation as a criticism of the author and do NOT treat its ABSENCE as praise: it is "an unstated step was observed in this reply", never "this person reasons sloppily".',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: this is a MACHINE OBSERVATION about the MOVE\'s inference structure; display-only, never a verdict that the argument is weak or wrong.',
      'cdiscourse-doctrine §1: a gap is an invitation to state the premise, not a defeat. The label describes a structural feature of the move ("relies on an unstated step"), never "this argument is weak/wrong" and never the author.',
      'GATE-A §8.2 rule 4: the theory term "enthymeme" stays internal (rawKey + classifier prompt); the user-facing label is the plain-language gameCopy string, never the raw theory term.',
      'Family F counterpart: the critical question unstated_assumption / missing_warrant probes the parent; this family only detects the structural gap in the present move.',
    ]),
  }),
]);
