/**
 * MCP-021A — Family B (disagreement_axis) definitions.
 *
 * 17 entries total (MCP-021A baseline 14 + MCP-BUILD2a +3).
 *  - 1 existing (ai_classifier #49 disputes_evidence_applicability;
 *    RETROACTIVE_VERBOSE_DEFINITIONS).
 *  - 13 MCP-021A: disagreement_present (umbrella; Timeline-eligible) +
 *    12 subtype keys (all Inspect-only per Decision 4).
 *  - 3 MCP-BUILD2a (Build-2 addendum §5; all Inspect-only): the
 *    disagreement-QUALITY booleans isolates_main_disagreement,
 *    distinguishes_fact_value_disagreement, preserves_face_while_disagreeing.
 *    NO schema-version bump (vocabulary expansion, not a wire change).
 *
 * Decision 4 (binding): `disagreement_present` is the Timeline-
 * eligible umbrella key; all subtypes are Inspect-only. This avoids
 * encoding a taste judgment about which kind of disagreement matters
 * more.
 *
 * Decision 5 (binding): brief candidate `disagreement_evidence_applicability`
 * COLLAPSES into existing #49 `disputes_evidence_applicability`. No
 * alias added.
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — disagreement is structural; never
 *     implies one side is 'right'.
 *   - cdiscourse-doctrine §1 — productive disagreement is core to
 *     debate; never a verdict.
 *   - timeline-grammar — Timeline renders one chip per axis (umbrella);
 *     Inspect surfaces sub-distinctions.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes.ts';

const SUBTYPE_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

export const FAMILY_B_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // RETROACTIVE #49 disputes_evidence_applicability (ai_classifier)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_evidence_applicability',
    rawKey: 'disputes_evidence_applicability',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Evidence applicability challenged',
    shortLabel: 'App. dispute',
    description: 'The applicability of evidence is challenged.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 44,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move challenge the APPLICABILITY of the evidence the parent (or a prior move) cited — arguing that the evidence does not actually bear on the claim?",
    positiveDefinition:
      "The move accepts that the cited evidence exists and is correct, but argues that it does not apply to the claim at hand — wrong population, wrong time period, wrong setting, wrong measurement, or wrong inferential step.",
    negativeDefinition:
      "The move challenges the evidence's factual accuracy (that is evidence_quality_questioned in Family D), the underlying claim directly (challenges_parent in Family A), or asks for evidence (asks_for_evidence in Family D).",
    positiveExamples: Object.freeze([
      "Parent cites: 'A 2020 Stanford study showed 13% productivity gain from remote work.' Move: 'That study was on knowledge workers in tech; it does not apply to assembly-line work.' (applicability dispute)",
      "Parent cites: 'EPA tailpipe data shows 40% emission reduction.' Move: 'Tailpipe data does not capture lifecycle emissions; the figure does not apply to the broader question.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'That study has been challenged on methodology.' (evidence_quality_questioned, not applicability)",
      "Move: 'I do not think remote work increases productivity.' (challenges underlying claim, not applicability)",
      "Move: 'What is your source?' (asks_for_evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for general skepticism toward the evidence without a specific applicability argument.',
      "Do NOT confuse with evidence_quality_questioned (Family D) — applicability accepts the evidence is correct but argues it does not fit the claim.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural; applicability challenge is a precise productive move.',
      'evidence-doctrine: applicability dispute opens a focused sub-axis; cleaner than blanket "this evidence is wrong" framing.',
      'Decision 5: brief candidate disagreement_evidence_applicability collapsed into this existing key — alias not added.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #1 disagreement_present (UMBRELLA — Timeline-eligible)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disagreement_present',
    rawKey: 'disagreement_present',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disagreement',
    shortLabel: 'Disagrees',
    description: 'This move expresses disagreement with its parent.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 120,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move express disagreement with any aspect of its parent (claim, scope, definition, causal link, evidence, value, etc.)?",
    positiveDefinition:
      'The move signals at least one disagreement axis with the parent: factual disagreement, scope challenge, definitional dispute, evidence-applicability challenge, causal disagreement, value disagreement, priority disagreement, or generalization challenge.',
    negativeDefinition:
      "The move supports, refines (narrows on the same side), extends to a different axis, acknowledges, summarizes, or is purely a clarification request. Pure agreement, pure question-for-clarification, or pure same-side extension is NOT disagreement.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce urban pollution.' Move: 'That is only true for tailpipe emissions; battery production has its own emissions footprint.' (evidence-applicability subtype)",
      "Parent: 'All cars should be electric by 2030.' Move: 'Rural areas without charging infrastructure could not comply.' (scope subtype)",
      "Parent: 'Library budgets matter.' Move: 'You are defining matters too broadly — most municipal services matter; that does not tell us priority.' (definition subtype)",
    ]),
    negativeExamples: Object.freeze([
      "Parent: 'EVs reduce urban pollution.' Move: 'Yes, and they are also quieter.' (extends, not disagrees)",
      "Parent: 'Library budgets matter.' Move: 'How are you defining matters?' (requests_clarification)",
      "Parent: 'Library budgets matter.' Move: 'Right — the Pittsburgh data confirms this.' (supports)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that merely ask 'how do you know?' — that is asks_for_evidence.",
      "Do NOT mark TRUE for moves that propose a DIFFERENT topic; that is introduces_new_issue.",
      "Do NOT mark TRUE for moves whose tone is heated but content is supporting; tone is not disagreement.",
      "Do NOT mark TRUE based on words like 'but', 'however', 'although' alone — pragmatic markers without substantive disagreement do not count.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: disagreement is a structural fact; never implies one side is "right".',
      'cdiscourse-doctrine §1: disagreement presence is not a verdict; productive disagreement is core to debate.',
      "Decision 4: disagreement_present is the umbrella; specific subtypes (disputes_definition, etc.) are Inspect-only to avoid encoding a taste judgment about which kind of disagreement matters more.",
      'timeline-grammar: Timeline renders only the umbrella chip; sub-distinctions surface in Inspect.',
    ]),
    confidenceEligibility: {
      timelineMinConfidence: 'medium' as const,
      selectedContextMinConfidence: 'medium' as const,
      inspectMinConfidence: 'low' as const,
    },
  }),

  // NEW #2 disputes_definition (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_definition',
    rawKey: 'disputes_definition',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes definition',
    shortLabel: 'Def. dispute',
    description: 'This move disputes how a term is defined.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 121,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute the parent's definition of a key term — arguing the term should be defined differently?",
    positiveDefinition:
      "The move targets a definition the parent assumed: 'when you say infrastructure, that includes/excludes X'; 'efficiency means Y, not Z'; 'the right unit is per-resident, not per-county'. Definitional disagreement is the move's main thrust.",
    negativeDefinition:
      'The move disputes facts within an accepted definition, asks for definitional clarification (Family C requests_clarification), or proposes a shared definition (Family C proposes_shared_definition — collaborative, not adversarial).',
    positiveExamples: Object.freeze([
      "Parent: 'Library funding should support infrastructure.' Move: 'You are defining infrastructure to exclude branch libraries — that definition prejudges the conclusion.'",
      "Parent: 'Carbon emissions per capita.' Move: 'Per capita is the wrong unit; territorial emissions are what the international framework uses.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What do you mean by infrastructure?' (requests_clarification)",
      "Move: 'Could we agree on per-capita as the unit?' (proposes_shared_definition)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that question facts framed in terms of a specific definition — that is challenges_parent on a fact, not a definition dispute.',
      "Do NOT mark TRUE based on the word 'definition' appearing — substantive definitional argument is required.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: definitional disagreement is a precise sub-axis; never implies the parent\'s definition is "wrong" in absolute terms.',
      "timeline-grammar: Inspect-only per Decision 4 — Timeline shows the umbrella disagreement_present; this sub-distinction stays inside Inspect.",
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #3 disputes_scope (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_scope',
    rawKey: 'disputes_scope',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes scope',
    shortLabel: 'Scope dispute',
    description: 'This move disputes the scope of the parent\'s claim.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 122,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute the SCOPE of the parent's claim — arguing the claim applies only to a narrower or different population, setting, or time window?",
    positiveDefinition:
      "The move argues the parent's claim does not generalize to the full scope the parent implied. The challenge identifies a specific exclusion: 'true for X but not Y'; 'works in the short term but not long term'; 'applies in dense cities but not rural'.",
    negativeDefinition:
      "The move challenges the claim within its accepted scope (challenges_parent), refines scope collaboratively (refines_parent), or asks about scope (questions_parent).",
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes reduce emissions.' Move: 'They reduce emissions in jurisdictions with stable enforcement; in places like Australia where the tax was repealed, the data is messier.'",
      "Parent: 'EVs reduce urban pollution.' Move: 'For dense cities, yes; for suburbs with mostly highway driving, the effect is small.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Specifically, carbon taxes work in BC and Sweden.' (refines_parent, same-side)",
      "Move: 'How wide is the scope you mean?' (questions_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that broaden the scope (that is a different rhetorical move).",
      "Do NOT mark TRUE for collaborative scope refinements (those are refines_parent).",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: scope dispute is a precise productive move; never a verdict on the parent\'s overall claim.',
      'point-standing-economy: a scope challenge invites the parent to either narrow the claim (recovery-positive) or defend the broader scope.',
      'timeline-grammar: Inspect-only per Decision 4.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #4 disputes_fact (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_fact',
    rawKey: 'disputes_fact',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes fact',
    shortLabel: 'Fact dispute',
    description: 'This move disputes a specific factual claim.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 123,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute a specific factual claim in the parent (a number, an event, an attribution, a measurement)?",
    positiveDefinition:
      "The move identifies a specific factual claim in the parent and offers a counter-claim ('the figure is X, not Y'; 'the event happened in 2019, not 2020'; 'that was the Jones paper, not Smith').",
    negativeDefinition:
      'The move offers a correction of a non-disputed detail (corrects_parent_detail in Family A — supportive correction), disputes scope/applicability/definition rather than fact, or asks for evidence.',
    positiveExamples: Object.freeze([
      "Parent: 'EV adoption is at 30% nationally.' Move: 'EV adoption is at 10% nationally; 30% is the new-sales figure, not the stock.'",
      "Parent: 'Carbon tax cut emissions in BC by 5%.' Move: 'The BC figure was 3%, not 5%; you may be thinking of Sweden.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Small correction — that was the 2020 paper, not 2019.' (corrects_parent_detail, supportive)",
      "Move: 'What is your source for the 30% figure?' (asks_for_evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT confuse with corrects_parent_detail (Family A) — corrects is supportive; disputes_fact is adversarial.",
      "Do NOT mark TRUE for disputes about how a fact applies — that is disputes_evidence_applicability.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: factual disagreement is a precise sub-axis; both sides may have evidence and the resolution is empirical.',
      "evidence-doctrine: factual dispute opens an evidence sub-axis — the move that posts evidence first earns evidence-standing.",
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #5 disputes_causal_link (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_causal_link',
    rawKey: 'disputes_causal_link',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes causal link',
    shortLabel: 'Causal dispute',
    description: 'This move disputes a causal claim in the parent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 124,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute that the parent's claimed cause actually causes the claimed effect (or that the direction of causation is right)?",
    positiveDefinition:
      "The move argues against the causal link: 'X does not cause Y'; 'correlation is not causation here'; 'the causation runs the other way'; 'the real cause is Z, not X'.",
    negativeDefinition:
      "The move accepts the causation and disputes the magnitude (disputes_fact), the applicability (disputes_evidence_applicability), or scope (disputes_scope). The move questions causation without asserting an alternative (more like questions_parent).",
    positiveExamples: Object.freeze([
      "Parent: 'Library funding rose, then literacy rose; funding caused the literacy gain.' Move: 'That is correlation; library funding tracks municipal budget growth, and growing municipalities also invest in schools, which is the actual cause.'",
      "Parent: 'EV adoption caused urban pollution drops.' Move: 'In Pittsburgh the pollution drop pre-dated EV adoption; the cause was the closing of the Edgar Thomson coal plant.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'How big was the effect?' (questions_parent on magnitude)",
      "Move: 'EVs only reduce tailpipe emissions, not lifecycle.' (disputes_evidence_applicability)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that question causation without asserting an alternative — that is questions_parent.",
      "Do NOT confuse with Family F causal_mechanism_missing — that is a critical question about HOW the cause works; this is a direct dispute.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: causal disagreement is a productive sub-axis; both sides may be partially right (multiple causes).',
      'Walton (1995): causal scheme — disputes_causal_link is the negative critical question against causal reasoning.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #6 disputes_value_weighting (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_value_weighting',
    rawKey: 'disputes_value_weighting',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes value weighting',
    shortLabel: 'Value dispute',
    description: 'This move disputes how the parent weights competing values.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 125,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute how the parent weights competing values — arguing a different value should take priority?",
    positiveDefinition:
      "The move accepts the empirical landscape and disputes how the parent weights values: 'efficiency matters but equity matters more here'; 'security and privacy are both real, but privacy should win'. The disagreement is normative.",
    negativeDefinition:
      "The move disputes facts, scope, definition, or evidence — not values. The move proposes a synthesis of values (Family G synthesis_proposed) without disputing the parent's weighting.",
    positiveExamples: Object.freeze([
      "Parent: 'Library funding should prioritize efficiency.' Move: 'Efficiency is a real value, but equity of access matters more here — the high-cost rural branches serve people who lack alternatives.'",
      "Parent: 'Privacy can yield to security.' Move: 'In some cases yes; in routine cases like this, privacy should win.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon emissions data shows X.' (facts, not values)",
      "Move: 'What if we balance both?' (synthesis_proposed)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Doctrine note: copy MUST NOT imply one value is 'right'. The disagreement is genuine; both values are real.",
      "Do NOT mark TRUE for moves that dispute facts framed in value-laden language.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: value disagreement is a fundamental sub-axis; NEVER implies one set of values is "correct".',
      'cdiscourse-doctrine §1: values play differently than facts in the point-standing economy; value disputes rarely produce a one-sided resolution.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #7 disputes_decision_criterion (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_decision_criterion',
    rawKey: 'disputes_decision_criterion',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes decision criterion',
    shortLabel: 'Crit. dispute',
    description: 'This move disputes the criterion being used to evaluate the decision.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 126,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute the CRITERION the parent uses to evaluate the decision — arguing a different criterion should govern?",
    positiveDefinition:
      "The parent applies a decision criterion (cost, effectiveness, fairness, feasibility, etc.). The move argues a different criterion should govern: 'cost is not the right test here — feasibility is'; 'effectiveness without equity is the wrong frame'.",
    negativeDefinition:
      "The move accepts the criterion and disputes facts or weight within it. The move proposes a synthesis of criteria. Pure value disagreement (disputes_value_weighting) is closely related but criterion is the evaluation procedure, value is the underlying good.",
    positiveExamples: Object.freeze([
      "Parent: 'Library funding should be evaluated by cost-per-visit.' Move: 'Cost-per-visit is the wrong criterion; access-equity matters more in this case.'",
      "Parent: 'Policy success means GDP growth.' Move: 'GDP growth is one criterion; well-being indices give a different picture and may be more apt.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Cost-per-visit is $X, not $Y.' (disputes_fact)",
      "Move: 'Could we balance cost-per-visit with access-equity?' (synthesis_proposed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that argue within the criterion.',
      "Do NOT confuse with disputes_value_weighting — criterion is the evaluation procedure, value is the underlying good. Often overlap; both can be tagged.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: criterion disagreement is a frame-level dispute; productive even when values agree.',
      'point-standing-economy: criterion-level disagreement is hard to resolve empirically; the response is often reframes_parent or synthesis_proposed.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #8 disputes_generalization (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_generalization',
    rawKey: 'disputes_generalization',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes generalization',
    shortLabel: 'Gen. dispute',
    description: 'This move disputes a generalization in the parent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 127,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute a generalization the parent made — arguing from a specific case to challenge a universal claim?",
    positiveDefinition:
      "The move offers one or more counter-examples to a parent generalization: 'you say X is always true; here is a case where X is false'. Often takes the form 'all/most X are Y → but here are X that are not Y'.",
    negativeDefinition:
      "The move disputes scope (which is the universal/particular dimension) rather than a generalization per se. The move offers a counter-example as a refinement (refines_parent) rather than as a generalization-challenge.",
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes always reduce emissions.' Move: 'In Australia, the tax was repealed before measurement; the generalization does not hold.'",
      "Parent: 'Library funding boosts literacy.' Move: 'Detroit increased library funding 2010-2018 with no literacy gain — the generalization is too strong.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'For dense cities, yes; for suburbs, no.' (disputes_scope)",
      "Move: 'You probably mean in jurisdictions with enforcement.' (refines_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that offer ONE counter-example without challenging the generalization itself.",
      "Do NOT mark TRUE for refinement (refines_parent) — generalization-dispute is adversarial.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: generalization-dispute is a structural sub-axis; never a verdict.',
      'evidence-doctrine: counter-examples are evidence; productive disputes-of-generalization narrow the claim toward a defensible universe.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #9 disputes_analogy (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_analogy',
    rawKey: 'disputes_analogy',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes analogy',
    shortLabel: 'Analogy disp.',
    description: 'This move disputes an analogy the parent used.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 128,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute an analogy the parent used — arguing that the source case does not map to the target case?",
    positiveDefinition:
      "The parent used an analogy (X is like Y; from Y we infer Z about X). The move challenges the mapping: 'X is not like Y in the relevant respect'; 'Y\\'s lesson does not transfer because of difference D'.",
    negativeDefinition:
      "The move offers a counter-analogy (introduces_new_issue with an analogy frame), accepts the analogy and challenges its inference, or extends the analogy (extends_parent).",
    positiveExamples: Object.freeze([
      "Parent: 'Misinformation is like spam — filter at the platform.' Move: 'The spam analogy fails: spam has clear technical markers, misinformation is contextual judgment.'",
      "Parent: 'Libraries are like roads.' Move: 'Libraries are not like roads — roads have measurable usage / wear / capacity; libraries do not.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'OK, taking the analogy seriously — at scale, technical filters work for both spam and misinfo.' (extends_parent)",
      "Move: 'Misinformation is more like financial fraud than spam.' (introduces_new_issue with counter-analogy)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that accept the analogy and refine it.",
      "Pairs with Family E analogy_reasoning_present — that is the positive structural fact; this is the dispute.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: analogy-dispute is a sub-axis; never implies the analogy is "wrong" universally — only that it fails in this mapping.',
      'Walton (1995): the critical question for analogy is "do the cases share relevant features?"; disputes_analogy is the negative answer.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #10 disputes_interpretation (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_interpretation',
    rawKey: 'disputes_interpretation',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes interpretation',
    shortLabel: 'Interp. disp.',
    description: 'This move disputes the parent\'s interpretation of evidence or text.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 129,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute the parent's interpretation of a shared piece of evidence, text, or event — arguing for a different reading?",
    positiveDefinition:
      "Both sides share a piece of evidence / text / event. The move argues the parent's interpretation is one reading but not the only one; offers an alternate reading and reasons for it.",
    negativeDefinition:
      "The move offers a new piece of evidence (provides_evidence, Family D), questions the applicability (disputes_evidence_applicability), or challenges the underlying fact (disputes_fact). The move offers an alternate interpretation collaboratively (Family C provides_alternate_interpretation).",
    positiveExamples: Object.freeze([
      "Parent: 'The 2020 employment data shows the policy worked.' Move: 'The same data shows the gains were concentrated in the top quintile; the policy worked for that group only.'",
      "Parent: 'The constitutional clause means X.' Move: 'The clause also bears the reading Y, and contextually Y is more supported.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Could the data also mean something else?' (questions_parent)",
      "Move: 'Or maybe the data means Y — what do you think?' (provides_alternate_interpretation, collaborative)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT confuse with provides_alternate_interpretation (Family C) — that is collaborative; this is adversarial.",
      "Do NOT mark TRUE for moves that question without offering an alternate reading.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: interpretation dispute is a structural sub-axis; both sides may have valid readings.',
      'point-standing-economy: interpretation disputes often resolve to shared-with-caveats common ground rather than one-side-wins.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #11 disputes_priority_order (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_priority_order',
    rawKey: 'disputes_priority_order',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes priority order',
    shortLabel: 'Prio dispute',
    description: 'This move disputes the order in which the parent prioritizes options.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 130,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute the priority order the parent assigned to options — arguing for a different sequencing?",
    positiveDefinition:
      "The parent ordered options (do X before Y, address A then B). The move argues for a different priority: 'Y before X'; 'address B first because of dependency D'.",
    negativeDefinition:
      'The move disputes that one of the options should be pursued at all (challenges_parent), disputes the criterion used to set priorities (disputes_decision_criterion), or proposes adding/removing an option from the list.',
    positiveExamples: Object.freeze([
      "Parent: 'Fund libraries first, then museums.' Move: 'Museums first — they have a 5-year capital deadline that libraries do not.'",
      "Parent: 'Address remote-work productivity before remote-work culture.' Move: 'Culture first — productivity tools only stick if culture supports them.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'We should not fund museums at all.' (challenges_parent on option)",
      "Move: 'Cost-effectiveness is the wrong priority criterion.' (disputes_decision_criterion)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that question whether to include an option at all.",
      "Do NOT confuse with disputes_decision_criterion — criterion is the rule for ordering; priority is the ordering itself.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: priority-order dispute is structural; sequencing decisions have empirical and value dimensions.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #12 disputes_remedy_or_solution (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_remedy_or_solution',
    rawKey: 'disputes_remedy_or_solution',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes remedy',
    shortLabel: 'Remedy disp.',
    description: 'This move disputes the proposed remedy or solution.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 131,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move accept the problem framing but dispute the proposed remedy / solution — arguing for a different fix?",
    positiveDefinition:
      "Parent diagnoses a problem and proposes a remedy. The move accepts the diagnosis but argues the proposed remedy will not work, has side effects, or is inferior to an alternative remedy.",
    negativeDefinition:
      "The move disputes the diagnosis itself (challenges_parent), accepts the remedy with refinements (refines_parent), or proposes an additive remedy (extends_parent).",
    positiveExamples: Object.freeze([
      "Parent: 'Misinformation spreads on platforms; remedy is platform-level filters.' Move: 'Diagnosis accepted; filters miss context and over-block; remedy should be media-literacy investment instead.'",
      "Parent: 'Carbon emissions; remedy is carbon tax.' Move: 'Tax is one option; cap-and-trade has better political durability.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Misinformation is not actually a problem on platforms.' (challenges diagnosis)",
      "Move: 'Filters are great, and we should add media literacy.' (extends_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that dispute the diagnosis along with the remedy.",
      "Do NOT mark TRUE for collaborative refinements of the remedy.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: remedy disputes are policy-level sub-axes; both sides may have evidence for different remedies.',
      'point-standing-economy: remedy disputes resolve via empirical case studies or value-weighting; rarely produce a one-sided resolution.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // NEW #13 disputes_relevance (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:disputes_relevance',
    rawKey: 'disputes_relevance',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disputes relevance',
    shortLabel: 'Relev. disp.',
    description: 'This move disputes that the parent\'s point is relevant.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 132,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move dispute that the parent's point is RELEVANT to the topic under discussion?",
    positiveDefinition:
      "The move accepts the parent's point may be true but argues it does not bear on the current question. 'That is interesting but tangential'; 'true but unrelated to whether X should happen'.",
    negativeDefinition:
      'The move accepts relevance and disputes facts/scope/etc. The move says the topic itself should change (introduces_new_issue / reframes_parent). Pure tangent flag without engagement is just dismissal.',
    positiveExamples: Object.freeze([
      "Topic: 'Should libraries be funded?' Parent: 'Library buildings emit carbon during construction.' Move: 'True, but irrelevant to whether they should be funded — that question is about value-of-service, not construction emissions.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The carbon footprint is small — maybe 0.1% of city emissions.' (disputes_fact, accepts relevance)",
      "Move: 'Should we be talking about climate impact more broadly?' (reframes_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for dismissive moves with no argument; relevance dispute requires a reason.',
      "Do NOT mark TRUE for moves that propose a different framing — that is reframes_parent.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: relevance dispute is structural; never implies the parent is "irrelevant" as a person or contributor.',
      'cdiscourse-doctrine §1: relevance disputes can be productive (narrow the topic) or non-productive (dismissive); the chip is structural not evaluative.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // ── MCP-BUILD2a (disagreement_axis expansion) ─────────────────────
  // Three Build-2a booleans per the Build-2 addendum §5. These describe
  // the QUALITY of the disagreement MOVE — how precisely it isolates the
  // point, whether it separates fact from value, and whether it disagrees
  // while preserving the other party's standing. All Inspect-only; none
  // are verdicts. preserves_face_while_disagreeing is verdict-adjacent and
  // is fenced with extra falsePositiveGuards (describes the MOVE, never the
  // author).

  // BUILD2a #1 isolates_main_disagreement (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:isolates_main_disagreement',
    rawKey: 'isolates_main_disagreement',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Isolates the disagreement',
    shortLabel: 'Isolates point',
    description: 'This move identifies the specific point of disagreement.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 133,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move identify the SPECIFIC point of disagreement with its parent (vs talking past it or disagreeing in general terms)?",
    positiveDefinition:
      "The move names the exact claim, premise, scope, or step it disagrees with — 'the part I disagree with is X', 'specifically, your second premise', 'where this breaks down is the move from A to B'. The disagreement is pinned to a locatable target in the parent.",
    negativeDefinition:
      "The move disagrees in broad or diffuse terms without locating the specific point ('I just don't buy this', 'this is all wrong'), or it raises a NEW topic rather than isolating a point in the parent (introduces_new_issue), or it is not a disagreement at all.",
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes reduce emissions and are politically durable.' Move: 'I accept the emissions effect; the specific point I disagree with is political durability — Australia repealed its tax within two years.'",
      "Parent: 'EVs cut urban pollution because they have no tailpipe.' Move: 'The exact step I disagree with is the inference from no-tailpipe to no-pollution; battery production shifts emissions elsewhere.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'This whole argument is off base.' (broad disagreement, no specific point isolated)",
      "Parent: 'Library funding boosts literacy.' Move: 'What about museum funding?' (introduces_new_issue, not isolating a point in the parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for blanket disagreement ('this is wrong') that names no specific target — generality is the negative case.",
      "Do NOT mark TRUE merely because the move quotes the parent; quoting without pinning the disagreement to that quoted point is quote_anchors_parent (Family A), not point isolation.",
      'Do NOT confuse with disputes_scope / disputes_fact — those name the TYPE of axis; this names whether the move locates a specific target at all. A move can isolate a point without the subtype being clear.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: isolating the disagreement is a structural property of the MOVE; it never implies the parent is wrong or the author is at fault.',
      'cdiscourse-doctrine §1: a precisely-located disagreement is not a verdict; it describes how legible the exchange is, not who is right.',
      'timeline-grammar: Inspect-only per the Family-B Inspect-by-default posture; Timeline shows the umbrella disagreement_present.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // BUILD2a #2 distinguishes_fact_value_disagreement (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:distinguishes_fact_value_disagreement',
    rawKey: 'distinguishes_fact_value_disagreement',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Separates fact vs value',
    shortLabel: 'Fact vs value',
    description: 'This move distinguishes a factual disagreement from a values one.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 134,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move distinguish a FACTUAL disagreement (what is the case) from a VALUES / normative one (what ought to be the case)?",
    positiveDefinition:
      "The move explicitly separates an empirical question from a normative one — 'we may agree on the data but disagree on what to prioritize', 'that is a factual claim; my objection is a values one', 'set aside whether it works — even if it does, should we?'. The fact/value boundary is named.",
    negativeDefinition:
      "The move disagrees on only one register without naming the distinction, treats a values question as if it were settled by data (or vice versa), or does not engage the fact/value boundary at all.",
    positiveExamples: Object.freeze([
      "Parent: 'Library funding should prioritize cost-per-visit because it is most efficient.' Move: 'Cost-per-visit may well be the efficient metric — that is the factual part. My disagreement is a values one: efficiency should not outrank equity of access here.'",
      "Parent: 'Surveillance cameras cut crime, so cities should install them.' Move: 'Even granting the crime-reduction figure, the question of whether the privacy trade-off is worth it is a separate, normative one.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Efficiency matters more than equity here.' (states a value position without distinguishing it from the factual layer — that is disputes_value_weighting)",
      "Move: 'The crime figure is wrong.' (factual dispute only; no fact/value separation drawn)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for a pure value disagreement that never acknowledges the factual layer — that is disputes_value_weighting, not a fact/value distinction.",
      "Do NOT mark TRUE for a pure factual dispute — drawing the boundary requires naming BOTH registers.",
      'Do NOT mark TRUE based on the words "fact" or "value" appearing; the move must actually separate the two, not just use the vocabulary.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: separating fact from value is a structural property of the MOVE; it never implies either side\'s facts or values are "correct".',
      'cdiscourse-doctrine §1: this is descriptive of the exchange\'s clarity, not a verdict; value disputes rarely resolve to one side.',
      'evidence-doctrine: naming the factual layer signals where evidence can settle the question and where it cannot.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),

  // BUILD2a #3 preserves_face_while_disagreeing (Inspect-only; VERDICT-ADJACENT)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:preserves_face_while_disagreeing',
    rawKey: 'preserves_face_while_disagreeing',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'disagreement_axis',
    label: 'Disagrees while preserving face',
    shortLabel: 'Face-preserving',
    description: 'This move disagrees while preserving the other party\'s standing.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 135,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move disagree while PRESERVING the other party's standing — engaging the argument without attacking the person?",
    positiveDefinition:
      "The move registers a substantive disagreement AND keeps the focus on the argument: it acknowledges what is reasonable in the parent, hedges its own certainty, or frames the disagreement collaboratively ('you make a fair point about X, but I read Y differently', 'I see why this is appealing, though I think it overreaches'). The disagreement is real; the framing keeps the other party's standing intact.",
    negativeDefinition:
      "The move either does not disagree at all, OR it disagrees in a flat / purely technical register with no face-preserving framing (which is not a negative judgement — neutral disagreement simply does not trip this observation). A move that attacks the person, questions their motives, or is dismissive is NOT face-preserving and must be FALSE.",
    positiveExamples: Object.freeze([
      "Parent: 'Remote work raises productivity across the board.' Move: 'You are right that it helps for focused knowledge work — that is a fair point. Where I'd push back is the across-the-board claim; collaborative roles seem to show the opposite.'",
      "Parent: 'Carbon taxes are the best climate policy.' Move: 'I can see the appeal, and the price signal is real. I think cap-and-trade has better political durability, though, so I'd weigh it differently.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'This is the kind of naive take I'd expect from someone who hasn't read the literature.' (attacks the person — FALSE; this is shifts_to_person_or_intent territory, never face-preserving)",
      "Move: 'Productivity gains are concentrated in knowledge work, not collaborative roles.' (substantive disagreement in a flat register — no face-preserving framing, so FALSE, but NOT an attack either)",
      "Parent: 'EVs reduce pollution.' Move: 'Agreed, and they're quieter too.' (no disagreement at all — FALSE)",
    ]),
    falsePositiveGuards: Object.freeze([
      'This observation describes the MOVE, never the author. It never says the author IS gracious or IS hostile; it only notes whether the move\'s framing kept the other party\'s standing intact while disagreeing.',
      'Do NOT mark TRUE for a move that disagrees AND attacks the person, questions motives, or is dismissive — any face-threat anywhere in the move makes this FALSE, even if part of the move is polite.',
      'Do NOT mark TRUE for pure agreement or pure politeness with no disagreement — a substantive disagreement MUST be present for this to apply.',
      'Do NOT treat the ABSENCE of this observation as a criticism: a neutral, flatly-worded disagreement is perfectly valid and simply does not trip this flag. Absence means "not observed", never "the author was rude".',
      'Do NOT mark TRUE based on surface politeness tokens alone ("respectfully", "no offense") if the substance is an attack; the framing must genuinely keep the argument, not the person, in focus.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: this is a MACHINE OBSERVATION about the MOVE\'s framing; it is display-only and never a moderation or verdict signal about the author.',
      'cdiscourse-doctrine §1: face-preservation is not a score of who is right; it describes how the disagreement was carried, not its merit.',
      'cdiscourse-doctrine §4: advisory only; the AI moderator never judges the person — pairs as the structural opposite of the composer-only shifts_to_person_or_intent observation.',
    ]),
    confidenceEligibility: SUBTYPE_INSPECT_ELIGIBILITY,
  }),
]);
