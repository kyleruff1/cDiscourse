/**
 * MCP-021A — Family H (claim_clarity) definitions.
 *
 * Per design §3.8: 12 entries total.
 *  - 1 existing (ai_classifier #51 provides_temporal_constraint;
 *    RETROACTIVE_VERBOSE_DEFINITIONS).
 *  - 11 NEW (claim_present, reason_present, conclusion_missing,
 *    reason_missing, multiple_claims_present, claim_specificity_high,
 *    claim_specificity_low, quantifier_present, modal_language_present,
 *    hedging_present, unclear_reference_present).
 *
 * timeframe_present DUPLICATES existing #51 per Decision 5 (the
 * existing key wins; no alias added).
 *
 * Mostly defaultSurface: 'inspect' — structural claim-clarity facts
 * are more Inspect than Timeline (per design §3.8).
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — structural facts only; never verdict.
 *   - cdiscourse-doctrine §1 — low specificity / missing conclusion
 *     are NOT verdicts on quality.
 *   - Toulmin (1958) — modal language is the qualifier in Toulmin's
 *     warrant/qualifier/rebuttal model.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes.ts';

const INSPECT_DEFAULT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

export const FAMILY_H_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // Existing #51 — RETROACTIVE_VERBOSE_DEFINITIONS
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:provides_temporal_constraint',
    rawKey: 'provides_temporal_constraint',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Time boundary',
    shortLabel: 'Time bound',
    description: 'A time boundary is set.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 46,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move add a temporal scope or time-frame constraint to a claim (when, until when, for how long)?',
    positiveDefinition:
      'The move attaches a specific temporal scope: a year range, a duration, a deadline, a since-when phrase, a before-after marker, or another time-bound qualifier that narrows when the claim applies.',
    negativeDefinition:
      'The move is timeless or contains a tense marker without a real temporal boundary. Mere past tense or future tense is not a temporal constraint; the move must restrict the claim to a specific window.',
    positiveExamples: Object.freeze([
      "Move: 'Since 2015, urban EV adoption grew faster than projections.' (since-when scope)",
      "Move: 'During the 2020-2022 window, library funding outpaced inflation.' (year range)",
      "Move: 'Within the next 5 years, charging infrastructure must reach rural counties for this to hold.' (forward window)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce pollution.' (no temporal scope)",
      "Move: 'In the future, this might change.' (vague future, no boundary)",
      "Move: 'I will think about it.' (tense, no claim scope)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves with only past or future tense — tense without a boundary is not temporal scope.',
      "Do NOT mark TRUE for vague time gestures ('eventually', 'someday') with no specific window.",
      'Do NOT mark TRUE for narrative timestamps that do not narrow a claim.',
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: temporal constraint is a structural feature of the claim — never a verdict on whether the claim's time-scope is 'correct'.",
      'Toulmin (1958): qualifier — temporal scope is one form of the modal qualifier that bounds the claim.',
      'evidence-doctrine: temporal scope reduces evidence debt by narrowing the claim window.',
    ]),
    confidenceEligibility: {
      timelineMinConfidence: 'medium' as const,
      selectedContextMinConfidence: 'low' as const,
      inspectMinConfidence: 'low' as const,
    },
  }),

  // NEW #1 — claim_present
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:claim_present',
    rawKey: 'claim_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Claim present',
    shortLabel: 'Claim',
    description: 'This move contains an explicit claim.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 230,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move contain an explicit claim (a proposition the author advances as true, advisable, or worth considering)?',
    positiveDefinition:
      'The move contains at least one declarative proposition that the author advances. The claim may be factual ("X happens"), evaluative ("X is good"), or prescriptive ("X should happen"). Pure questions or pure paraphrases without an attached claim do NOT count.',
    negativeDefinition:
      'The move is a pure question ("What do you think?"), a pure paraphrase ("You said X"), a pure acknowledgement ("OK"), or a quote without engagement. Moves that frame a claim as someone else\'s without endorsing it are also NOT this rawKey.',
    positiveExamples: Object.freeze([
      "Move: 'EVs reduce urban pollution.' (factual claim)",
      "Move: 'Public libraries are worth funding.' (evaluative claim)",
      "Move: 'Cities should expand bike infrastructure.' (prescriptive claim)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What is your evidence?' (pure question)",
      "Move: 'You said libraries matter.' (paraphrase only)",
      "Move: 'I see.' (pure acknowledgement)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for paraphrases of the parent that do not also advance a claim.',
      'Do NOT mark TRUE for clarification requests even when the question wording is assertive in style.',
      'Do NOT mark TRUE for quoted claims attributed to others without endorsement.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural fact — the move contains a claim; never implies the claim is correct.',
      'point-standing-economy: a move with a claim opens a standing position; a move without a claim plays differently in the economy (e.g., requests_clarification has no standing of its own).',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #2 — reason_present
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:reason_present',
    rawKey: 'reason_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Reason present',
    shortLabel: 'Reason',
    description: 'This move attaches a reason or ground to its claim.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 231,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move attach at least one reason, ground, evidence, or justification to its claim, rather than asserting the claim alone?',
    positiveDefinition:
      'The move pairs a claim with a "because", "since", "given that", "for the reason that", or a stated piece of evidence / ground. Toulmin terms: claim plus grounds.',
    negativeDefinition:
      'The move asserts a claim without attaching a reason, or contains a reason without an attached claim, or is a pure question or paraphrase.',
    positiveExamples: Object.freeze([
      "Move: 'EVs reduce urban pollution because tailpipe emissions drop in heavy-EV cities (per 2024 EPA data).' (claim + ground)",
      "Move: 'Library funding matters since literacy outcomes track library access.' (claim + because)",
      "Move: 'This policy is risky given the failure rate in similar prior programs.' (claim + ground)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce urban pollution.' (claim only, no reason)",
      "Move: 'Because the study said so.' (reason without explicit claim)",
      "Move: 'Why do you say that?' (question)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE based on the word "because" alone — the because-clause must support a claim.',
      'Do NOT mark TRUE for examples that are NOT reasons (an example is illustrative, not always grounding).',
      'Do NOT mark TRUE for parenthetical hedges that read like reasons but do not actually ground.',
    ]),
    doctrineNotes: Object.freeze([
      'Toulmin (1958): grounds (data) + claim is the foundational pair; this rawKey marks moves that pair them.',
      "cdiscourse-doctrine §10a: structural fact only; never a verdict on whether the reason is 'good'.",
      'evidence-doctrine: a reason is not yet evidence; reason_present is a weaker signal than has_evidence or provides_evidence.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #3 — conclusion_missing
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:conclusion_missing',
    rawKey: 'conclusion_missing',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'No explicit conclusion',
    shortLabel: 'No concl.',
    description: 'This move provides reasoning but does not state its conclusion explicitly.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 232,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move present reasoning or grounds without stating the conclusion the author is reaching?",
    positiveDefinition:
      "The move builds toward a conclusion via reasoning or examples but never states the conclusion itself. The reader must infer what claim the author is making. Common in moves that pile up rhetorical questions or partial reasoning without a synthesis statement.",
    negativeDefinition:
      'The move states its conclusion explicitly (with or without reasoning), or the move is a pure question, or the move is a paraphrase of the parent without offering reasoning, or the conclusion is trivially obvious from the reasoning.',
    positiveExamples: Object.freeze([
      "Move: 'Library funding has dropped 20% since 2019. Literacy rates have fallen. New library branches keep closing.' (reasoning piled; conclusion not stated)",
      "Move: 'EV sales doubled. Tailpipe emissions in heavy-EV cities dropped 30%. Battery production capacity expanded.' (reasoning; no synthesis claim)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding has dropped, and literacy rates have fallen — we need to restore funding.' (explicit conclusion)",
      "Move: 'What do you think about library funding?' (pure question)",
      "Move: 'Yes, the data shows X.' (compact but conclusion-clear)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT frame as 'argument is incomplete' — many moves intentionally leave conclusions for the reader.",
      'Do NOT mark TRUE when the conclusion is rhetorically obvious from the reasoning context.',
      'Do NOT mark TRUE for pure questions; questions have no conclusion by design.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural observation. Copy frames as "no explicit conclusion stated", never "argument is incomplete".',
      "cdiscourse-doctrine §1: this is NOT a verdict on argument quality; some of the strongest moves leave the conclusion implicit.",
      'Toulmin (1958): claim is one of three pillars; missing claim is a structural feature, not a fault.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #4 — reason_missing
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:reason_missing',
    rawKey: 'reason_missing',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'No reason attached',
    shortLabel: 'No reason',
    description: 'This move states a claim without attaching a reason.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 233,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move state a claim without attaching ANY reason, ground, or justification?',
    positiveDefinition:
      "The move asserts a claim and stops — no 'because', no 'since', no cited evidence, no example. The claim stands alone in the move body.",
    negativeDefinition:
      "The move attaches any reason — including weak reasons or hedged ones. The move is a pure question / paraphrase / acknowledgement (those have no claim to ground). The move is a value claim where ground is implicit in the value.",
    positiveExamples: Object.freeze([
      "Move: 'EVs reduce pollution.' (claim, no reason)",
      "Move: 'This policy will work.' (assertion, no ground)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce pollution because tailpipe emissions drop.' (reason attached)",
      "Move: 'I think this policy might work; my hunch is from prior similar programs.' (hedged reason)",
      "Move: 'What is your evidence?' (question, no claim)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT frame as 'argument is unsupported' — many short moves are stage-setting.",
      'Do NOT mark TRUE for value claims where the value itself is the ground.',
      'Do NOT mark TRUE for moves whose reason is in the PARENT (the move responds to and inherits the parent\'s reasoning).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural observation; copy is "no reason attached", never "argument is unsupported".',
      "cdiscourse-doctrine §1: NOT a verdict on quality. A claim without reason invites the responder to ask 'why?'.",
      'point-standing-economy: claim_without_reason carries higher evidence-debt risk than reason_present; standing changes when challenged and the gap persists.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #5 — multiple_claims_present
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:multiple_claims_present',
    rawKey: 'multiple_claims_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Multiple claims',
    shortLabel: 'Multi-claim',
    description: 'This move bundles two or more distinct claims.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 234,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move bundle two or more distinct claims that would each require separate engagement to address?',
    positiveDefinition:
      "The move makes two or more claims that are not logically equivalent. Each claim has its own subject + predicate and could be challenged independently. The move's responder faces a choice about which claim to address.",
    negativeDefinition:
      'The move makes one claim that is restated for emphasis, OR a claim plus a paraphrase of itself, OR a claim plus illustrative examples (examples extending one claim are still one claim).',
    positiveExamples: Object.freeze([
      "Move: 'EVs reduce pollution AND lower fuel costs.' (two claims)",
      "Move: 'Libraries are infrastructure, and they boost literacy, and they reduce inequality.' (three claims)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce pollution — they cut tailpipe emissions, particulate matter, and CO2.' (one claim plus examples)",
      "Move: 'EVs reduce pollution, that is, EVs cut emissions.' (restatement; one claim)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for a claim plus its supporting examples — the examples are not separate claims.',
      'Do NOT mark TRUE for a claim plus its restatement.',
      'Do NOT mark TRUE for compound subjects making one assertion ("X and Y both increase").',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural fact; multi-claim moves are not "worse" or "better" — they just play differently.',
      'point-standing-economy: a multi-claim move creates multiple potential narrowing / concession axes; the responder may engage one or several.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #6 — claim_specificity_high
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:claim_specificity_high',
    rawKey: 'claim_specificity_high',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Specific claim',
    shortLabel: 'Specific',
    description: 'This move\'s claim is narrowly scoped with concrete particulars.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 235,
    visibleByDefault: false,

    booleanQuestion:
      "Is the move's claim narrowly scoped with concrete particulars (specific population, specific time window, specific outcome, specific magnitude)?",
    positiveDefinition:
      'The claim names specific population / time / outcome / magnitude / mechanism. Example: "library funding in Allegheny County rose 12% over 2020-2023, correlated with a 5% literacy gain in K-3 students." Specific = narrow + concrete.',
    negativeDefinition:
      'The claim is broad or general — population unspecified, time unspecified, magnitude unspecified, or stated as universal ("X causes Y"). Generality is not a defect; it is a different shape.',
    positiveExamples: Object.freeze([
      "Move: 'In 12 cities with carbon taxes, emissions dropped 8% over 2015-2020.' (specific scope, specific magnitude)",
      "Move: 'Pittsburgh's K-3 reading scores rose 5% from 2020 to 2023 after library funding increased 12%.' (specific population, time, magnitude)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes work.' (broad)",
      "Move: 'Libraries improve literacy.' (general)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves with numbers that are not the move\'s scope (e.g., a parenthetical timestamp).',
      'Do NOT confuse hedging with specificity — "approximately 8%" is still specific.',
      'Do NOT mark TRUE for moves where the specificity is in a quoted source, not in the claim itself.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural observation; specificity is descriptive, not evaluative.',
      'point-standing-economy: a more specific claim has lower evidence-debt because the narrow scope is easier to source.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #7 — claim_specificity_low
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:claim_specificity_low',
    rawKey: 'claim_specificity_low',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Broad claim',
    shortLabel: 'Broad',
    description: 'This move\'s claim is broadly scoped without concrete particulars.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 236,
    visibleByDefault: false,

    booleanQuestion:
      "Is the move's claim broadly scoped without concrete particulars (no specific population, time, outcome, or magnitude)?",
    positiveDefinition:
      'The claim is universal or vague: "X causes Y" without scope; "many people think X"; "this always happens". Broad = general + unspecific. NOT a verdict on quality.',
    negativeDefinition:
      'The claim contains at least one specific particular (population / time / magnitude / mechanism). Hedged claims with specific scope are NOT this rawKey.',
    positiveExamples: Object.freeze([
      "Move: 'Carbon taxes work.' (broad)",
      "Move: 'Many people support this.' (broad audience claim)",
      "Move: 'This always happens.' (universal)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes worked in 12 European jurisdictions 2015-2020.' (specific)",
      "Move: 'About 60% of polled residents in Allegheny County support this.' (specific scope)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT frame as a quality verdict — broad claims are not "weak".',
      'Do NOT mark TRUE for hedged claims with specific scope.',
      'Do NOT mark TRUE for value claims that are inherently broad in form.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: low specificity is NOT a verdict on quality.',
      'point-standing-economy: a broad claim has higher evidence-debt potential when challenged; narrowing the claim is a recovery move that earns standing repair credit.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #8 — quantifier_present
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:quantifier_present',
    rawKey: 'quantifier_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Quantifier used',
    shortLabel: 'Quantifier',
    description: 'This move uses an explicit quantifier (all, most, some, none, X%).',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 237,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move use an explicit quantifier (all, most, many, some, few, none, percentages, ratios) to scope its claim?',
    positiveDefinition:
      'The claim contains a quantifier word or numeric ratio that bounds the scope: "all", "most", "many", "some", "few", "none", "X%", "1 in N", "half of".',
    negativeDefinition:
      'The claim uses no quantifier — either universal-by-default ("X is Y") or single-instance ("this is Y"). Quantifier in a parenthetical or example does not count if the main claim is unquantified.',
    positiveExamples: Object.freeze([
      "Move: 'Most urban EVs reduce particulate matter by at least 20%.' (most + percentage)",
      "Move: '1 in 4 library branches closed since 2019.' (ratio)",
      "Move: 'Few of these programs run more than 5 years.' (few)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce pollution.' (no quantifier)",
      "Move: 'Libraries matter.' (no quantifier)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for cardinal numbers that are not quantifiers (e.g., a year, a phone number).',
      'Do NOT mark TRUE for quantifiers in quoted sources that are not the move\'s claim.',
      'Do NOT mark TRUE for vague intensifiers ("very", "really") that are not quantifiers.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural observation; quantifier use is descriptive.',
      'Toulmin (1958): quantifier is a qualifier; it modifies the claim modal status.',
      'evidence-doctrine: a quantified claim has clearer evidence requirements than an unquantified one.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #9 — modal_language_present
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:modal_language_present',
    rawKey: 'modal_language_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Modal language',
    shortLabel: 'Modal',
    description: 'This move uses modal language (can, must, should, may, might).',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 238,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move use modal auxiliary verbs (can, could, may, might, must, should, ought, will, would) to frame its claims?',
    positiveDefinition:
      'The claim uses a modal verb to mark its modal status — possibility, necessity, recommendation, prediction. The modal is part of the claim, not parenthetical.',
    negativeDefinition:
      'The claim is bare-assertive ("X is Y") or imperative without modal ("Do X"), or the modal is in a quoted source / hypothetical / question.',
    positiveExamples: Object.freeze([
      "Move: 'Carbon taxes should reduce emissions if enforcement is stable.' (should)",
      "Move: 'EVs could reach 60% of new sales by 2030.' (could)",
      "Move: 'Libraries must remain accessible to all income levels.' (must)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes reduce emissions.' (bare assertion)",
      "Move: 'Increase library funding.' (imperative, no modal)",
      "Move: 'Could you clarify?' (modal in question, not claim)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for modal verbs in questions ("could you clarify?").',
      'Do NOT mark TRUE for modal verbs in quoted speech that are not the move\'s claim.',
      'Do NOT confuse hedging with modal — they overlap but are distinct (modal = grammatical, hedging = pragmatic).',
    ]),
    doctrineNotes: Object.freeze([
      'Toulmin (1958): modal qualifier is the explicit modal status of the claim.',
      "cdiscourse-doctrine §10a: structural observation; modal-marked claims play differently than bare assertions but are not 'weaker'.",
      'evidence-doctrine: a modal claim ("X should reduce Y") has different evidence requirements than a bare claim ("X reduces Y").',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #10 — hedging_present
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:hedging_present',
    rawKey: 'hedging_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Hedged claim',
    shortLabel: 'Hedged',
    description: 'This move uses a probabilistic hedge ("probably", "in most cases", "tends to").',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 239,
    visibleByDefault: false,

    booleanQuestion:
      'Does the move use explicit hedging language (probabilistic / pragmatic qualifying) when stating its claims?',
    positiveDefinition:
      'The move uses qualifiers like "probably", "often", "in most cases", "tends to", "sometimes", "generally" that explicitly weaken the claim from a universal / certain assertion.',
    negativeDefinition:
      "The move makes claims as confident assertions without hedging, OR uses hedging only as politeness markers ('I think you might mean...') without weakening the claim, OR uses hedging only in clarification questions.",
    positiveExamples: Object.freeze([
      "Move: 'Increasing library budgets probably correlates with literacy gains in mid-size cities.'",
      "Move: 'Carbon taxes tend to reduce emissions over a 5-year window, in jurisdictions with stable enforcement.'",
      "Move: 'EVs generally lower urban air pollution; the effect size depends on grid mix.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library budgets correlate with literacy gains.' (assertive, no hedge)",
      "Move: 'I think you mean...' (hedging is politeness, not on the claim)",
      "Move: 'Probably the library data is in the Pittsburgh study?' (hedging in a clarification question)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for hedging that is rhetorical politeness ("I might suggest...") not a claim qualifier.',
      'Do NOT mark TRUE for hedging in pure questions.',
      'Do NOT mark TRUE for hedging in references to other people\'s claims ("they say it probably...").',
    ]),
    doctrineNotes: Object.freeze([
      'Toulmin (1958): hedging is a "qualifier" — it modifies the claim modal status.',
      'cdiscourse-doctrine §10a: hedging presence is a structural fact; never a verdict about confidence-appropriateness.',
      'evidence-doctrine: an appropriately hedged claim carries less evidence debt than the same claim asserted as certainty.',
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),

  // NEW #11 — unclear_reference_present
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:unclear_reference_present',
    rawKey: 'unclear_reference_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'claim_clarity',
    label: 'Unclear reference',
    shortLabel: 'Ref unclear',
    description: 'This move contains a pronoun or referring expression without a clear antecedent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 240,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move use a pronoun, demonstrative, or referring expression whose antecedent is ambiguous (more than one possible referent or no clear referent)?',
    positiveDefinition:
      '"It", "they", "this", "that", "these", "those" appear without a clear preceding referent in the move or its parent. A reader could reasonably wonder "what does THIS refer to?".',
    negativeDefinition:
      'Pronouns refer to a clear single antecedent in the move or its parent. Demonstratives that are explicitly grounded (e.g., "this point about X") are NOT unclear references.',
    positiveExamples: Object.freeze([
      "Move (responding to parent that mentions both libraries and museums): 'This is the wrong approach.' (this = ?)",
      "Move: 'They will fix it eventually.' (they = ?; it = ?)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'This funding model — the per-resident formula — is the wrong approach.' (this is grounded)",
      "Move: 'The city will fix the library funding eventually.' (no pronoun)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE when the referent is clearly recoverable from the parent.',
      'Do NOT mark TRUE for first-person pronouns ("I", "we") that always self-refer.',
      'Do NOT mark TRUE for generic plural ("they say...") when used as a common idiom.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural observation; pairs with Family C flags_ambiguous_reference (repair-positive counterpart).',
      "cdiscourse-doctrine §1: NEVER a verdict on the author's clarity skill; pronouns are often clear in context that the classifier cannot see.",
    ]),
    confidenceEligibility: INSPECT_DEFAULT_ELIGIBILITY,
  }),
]);
