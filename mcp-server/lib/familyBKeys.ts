/**
 * MCP-SERVER-003-FAMILY-B — Family B (disagreement_axis) 14-key constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family B registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyB.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyBKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * The 14 rawKeys are the binding contract per MCP-SERVER-003-FAMILY-B intent
 * brief §3. Verbatim, in declaration order:
 *
 *   1.  disputes_evidence_applicability
 *   2.  disagreement_present (UMBRELLA; Timeline-eligible)
 *   3.  disputes_definition
 *   4.  disputes_scope
 *   5.  disputes_fact
 *   6.  disputes_causal_link
 *   7.  disputes_value_weighting (DOCTRINE RISK)
 *   8.  disputes_decision_criterion
 *   9.  disputes_generalization
 *   10. disputes_analogy
 *   11. disputes_interpretation
 *   12. disputes_priority_order
 *   13. disputes_remedy_or_solution
 *   14. disputes_relevance (DOCTRINE RISK)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict.
 *   - cdiscourse-doctrine §1 — definitions / examples / false-positive
 *     guards never imply which side is "right". Disagreement is productive
 *     and structural; both sides remain valid contributions to the debate.
 *   - design doc §4 — entries mirror the verbose-definition slice the
 *     prompt iterates.
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family A pattern.
 */

/**
 * The 14 Family B rawKeys, frozen in declaration order. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in both source
 *     files as a string literal)
 */
export const FAMILY_B_RAW_KEYS: readonly string[] = Object.freeze([
  'disputes_evidence_applicability',
  'disagreement_present',
  'disputes_definition',
  'disputes_scope',
  'disputes_fact',
  'disputes_causal_link',
  'disputes_value_weighting',
  'disputes_decision_criterion',
  'disputes_generalization',
  'disputes_analogy',
  'disputes_interpretation',
  'disputes_priority_order',
  'disputes_remedy_or_solution',
  'disputes_relevance',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_B_CLASSIFIER_SET_VERSION = 'family-b-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence.
 */
export interface FamilyBPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_B_PROMPT_ENTRIES: readonly FamilyBPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'disputes_evidence_applicability',
    label: 'Evidence applicability challenged',
    booleanQuestion:
      "Does this move challenge the APPLICABILITY of the evidence the parent (or a prior move) cited — arguing that the evidence does not actually bear on the claim?",
    positiveDefinition:
      "The move accepts that the cited evidence exists and is accurate, but argues that it does not apply to the claim at hand — wrong population, wrong time period, wrong setting, wrong measurement, or wrong inferential step.",
    negativeDefinition:
      "The move challenges the evidence's factual accuracy (that is evidence_quality_questioned in Family D), the underlying claim directly (challenges_parent in Family A), or asks for evidence (asks_for_evidence in Family D).",
    positiveExample:
      "Parent cites: 'A 2020 Stanford study showed 13% productivity gain from remote work.' Move: 'That study was on knowledge workers in tech; it does not apply to assembly-line work.' (applicability dispute)",
    negativeExample:
      "Move: 'That study has been challenged on methodology.' (evidence_quality_questioned, not applicability)",
    falsePositiveGuards:
      "Do NOT mark TRUE for general skepticism toward the evidence without a specific applicability argument. Do NOT confuse with evidence_quality_questioned (Family D) — applicability accepts the evidence is accurate but argues it does not fit the claim.",
  }),
  Object.freeze({
    rawKey: 'disagreement_present',
    label: 'Disagreement',
    booleanQuestion:
      "Does this move express disagreement with any aspect of its parent (claim, scope, definition, causal link, evidence, value, etc.)?",
    positiveDefinition:
      "The move signals at least one disagreement axis with the parent: factual disagreement, scope challenge, definitional dispute, evidence-applicability challenge, causal disagreement, value disagreement, priority disagreement, or generalization challenge.",
    negativeDefinition:
      "The move supports, refines (narrows on the same side), extends to a different axis, acknowledges, summarizes, or is purely a clarification request. Pure agreement, pure question-for-clarification, or pure same-side extension is NOT disagreement.",
    positiveExample:
      "Parent: 'EVs reduce urban pollution.' Move: 'That is only the tailpipe story; battery production has its own emissions footprint.' (evidence-applicability subtype)",
    negativeExample:
      "Parent: 'EVs reduce urban pollution.' Move: 'Yes, and they are also quieter.' (extends, not disagrees)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that merely ask 'how do you know?' — that is asks_for_evidence. Do NOT mark TRUE for moves that propose a DIFFERENT topic; that is introduces_new_issue. Do NOT mark TRUE for moves whose tone is heated but content is supporting; tone is not disagreement. Do NOT mark TRUE based on words like 'but', 'however', 'although' alone — pragmatic markers without substantive disagreement do not count.",
  }),
  Object.freeze({
    rawKey: 'disputes_definition',
    label: 'Disputes definition',
    booleanQuestion:
      "Does this move dispute the parent's definition of a key term — arguing the term should be defined differently?",
    positiveDefinition:
      "The move targets a definition the parent assumed: 'when you say infrastructure, that includes/excludes X'; 'efficiency means Y, not Z'; 'the right unit is per-resident, not per-county'. Definitional disagreement is the move's main thrust.",
    negativeDefinition:
      "The move disputes facts within an accepted definition, asks for definitional clarification (Family C requests_clarification), or proposes a shared definition (Family C proposes_shared_definition — collaborative, not adversarial).",
    positiveExample:
      "Parent: 'Library funding should support infrastructure.' Move: 'You are defining infrastructure to exclude branch libraries — that definition prejudges the conclusion.'",
    negativeExample:
      "Move: 'What do you mean by infrastructure?' (requests_clarification)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that question facts framed in terms of a specific definition — that is challenges_parent on a fact, not a definition dispute. Do NOT mark TRUE based on the word 'definition' appearing — substantive definitional argument is required.",
  }),
  Object.freeze({
    rawKey: 'disputes_scope',
    label: 'Disputes scope',
    booleanQuestion:
      "Does this move dispute the SCOPE of the parent's claim — arguing the claim applies only to a narrower or different population, setting, or time window?",
    positiveDefinition:
      "The move argues the parent's claim does not generalize to the full scope the parent implied. The challenge identifies a specific exclusion: 'true for X but not Y'; 'works in the short term but not long term'; 'applies in dense cities but not rural'.",
    negativeDefinition:
      "The move challenges the claim within its accepted scope (challenges_parent), refines scope collaboratively (refines_parent), or asks about scope (questions_parent).",
    positiveExample:
      "Parent: 'Carbon taxes reduce emissions.' Move: 'They reduce emissions in jurisdictions with stable enforcement; in places like Australia where the tax was repealed, the data is messier.'",
    negativeExample:
      "Move: 'Specifically, carbon taxes work in BC and Sweden.' (refines_parent, same-side)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that broaden the scope (that is a different rhetorical move). Do NOT mark TRUE for collaborative scope refinements (those are refines_parent).",
  }),
  Object.freeze({
    rawKey: 'disputes_fact',
    label: 'Disputes fact',
    booleanQuestion:
      "Does this move dispute a specific factual claim in the parent (a number, an event, an attribution, a measurement)?",
    positiveDefinition:
      "The move identifies a specific factual claim in the parent and offers a counter-claim ('the figure is X, not Y'; 'the event happened in 2019, not 2020'; 'that was the Jones paper, not Smith').",
    negativeDefinition:
      "The move offers a correction of a non-disputed detail (corrects_parent_detail in Family A — supportive correction), disputes scope/applicability/definition rather than fact, or asks for evidence.",
    positiveExample:
      "Parent: 'EV adoption is at 30% nationally.' Move: 'EV adoption is at 10% nationally; 30% is the new-sales figure, not the stock.'",
    negativeExample:
      "Move: 'Small correction — that was the 2020 paper, not 2019.' (corrects_parent_detail, supportive)",
    falsePositiveGuards:
      "Do NOT confuse with corrects_parent_detail (Family A) — corrects is supportive; disputes_fact is adversarial. Do NOT mark TRUE for disputes about how a fact applies — that is disputes_evidence_applicability.",
  }),
  Object.freeze({
    rawKey: 'disputes_causal_link',
    label: 'Disputes causal link',
    booleanQuestion:
      "Does this move dispute that the parent's claimed cause actually causes the claimed effect (or that the direction of causation is right)?",
    positiveDefinition:
      "The move argues against the causal link: 'X does not cause Y'; 'correlation is not causation here'; 'the causation runs the other way'; 'the real cause is Z, not X'.",
    negativeDefinition:
      "The move accepts the causation and disputes the magnitude (disputes_fact), the applicability (disputes_evidence_applicability), or scope (disputes_scope). The move questions causation without asserting an alternative (more like questions_parent).",
    positiveExample:
      "Parent: 'Library funding rose, then literacy rose; funding caused the literacy gain.' Move: 'That is correlation; library funding tracks municipal budget growth, and growing municipalities also invest in schools, which is the actual cause.'",
    negativeExample:
      "Move: 'How big was the effect?' (questions_parent on magnitude)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that question causation without asserting an alternative — that is questions_parent. Do NOT confuse with Family F causal_mechanism_missing — that is a critical question about HOW the cause works; this is a direct dispute.",
  }),
  Object.freeze({
    rawKey: 'disputes_value_weighting',
    label: 'Disputes value weighting',
    booleanQuestion:
      "Does this move dispute how the parent weights competing values — arguing a different value should take priority?",
    positiveDefinition:
      "The move accepts the empirical landscape and disputes how the parent weights values: 'efficiency matters but equity matters more here'; 'security and privacy are both real, but privacy should win'. The disagreement is normative.",
    negativeDefinition:
      "The move disputes facts, scope, definition, or evidence — not values. The move proposes a synthesis of values (Family G synthesis_proposed) without disputing the parent's weighting.",
    positiveExample:
      "Parent: 'Library funding should prioritize efficiency.' Move: 'Efficiency is a real value, but equity of access matters more here — the high-cost rural branches serve people who lack alternatives.'",
    negativeExample:
      "Move: 'Carbon emissions data shows X.' (facts, not values)",
    falsePositiveGuards:
      "Doctrine note: copy MUST NOT imply one value is 'right'. The disagreement is genuine; both values are real. Do NOT mark TRUE for moves that dispute facts framed in value-laden language.",
  }),
  Object.freeze({
    rawKey: 'disputes_decision_criterion',
    label: 'Disputes decision criterion',
    booleanQuestion:
      "Does this move dispute the CRITERION the parent uses to evaluate the decision — arguing a different criterion should govern?",
    positiveDefinition:
      "The parent applies a decision criterion (cost, effectiveness, fairness, feasibility, etc.). The move argues a different criterion should govern: 'cost is not the right test here — feasibility is'; 'effectiveness without equity is the wrong frame'.",
    negativeDefinition:
      "The move accepts the criterion and disputes facts or weight within it. The move proposes a synthesis of criteria. Pure value disagreement (disputes_value_weighting) is closely related but criterion is the evaluation procedure, value is the underlying good.",
    positiveExample:
      "Parent: 'Library funding should be evaluated by cost-per-visit.' Move: 'Cost-per-visit is the wrong criterion; access-equity matters more in this case.'",
    negativeExample:
      "Move: 'Cost-per-visit is $X, not $Y.' (disputes_fact)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that argue within the criterion. Do NOT confuse with disputes_value_weighting — criterion is the evaluation procedure, value is the underlying good. Often overlap; both can be tagged.",
  }),
  Object.freeze({
    rawKey: 'disputes_generalization',
    label: 'Disputes generalization',
    booleanQuestion:
      "Does this move dispute a generalization the parent made — arguing from a specific case to challenge a universal claim?",
    positiveDefinition:
      "The move offers one or more counter-examples to a parent generalization: 'you say X is always true; here is a case where X is false'. Often takes the form 'all/most X are Y → but here are X that are not Y'.",
    negativeDefinition:
      "The move disputes scope (which is the universal/particular dimension) rather than a generalization per se. The move offers a counter-example as a refinement (refines_parent) rather than as a generalization-challenge.",
    positiveExample:
      "Parent: 'Carbon taxes always reduce emissions.' Move: 'In Australia, the tax was repealed before measurement; the generalization does not hold.'",
    negativeExample:
      "Move: 'For dense cities, yes; for suburbs, no.' (disputes_scope)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that offer ONE counter-example without challenging the generalization itself. Do NOT mark TRUE for refinement (refines_parent) — generalization-dispute is adversarial.",
  }),
  Object.freeze({
    rawKey: 'disputes_analogy',
    label: 'Disputes analogy',
    booleanQuestion:
      "Does this move dispute an analogy the parent used — arguing that the source case does not map to the target case?",
    positiveDefinition:
      "The parent used an analogy (X is like Y; from Y we infer Z about X). The move challenges the mapping: 'X is not like Y in the relevant respect'; 'Y\\'s lesson does not transfer because of difference D'.",
    negativeDefinition:
      "The move offers a counter-analogy (introduces_new_issue with an analogy frame), accepts the analogy and challenges its inference, or extends the analogy (extends_parent).",
    positiveExample:
      "Parent: 'Misinformation is like spam — filter at the platform.' Move: 'The spam analogy fails: spam has clear technical markers, misinformation is contextual judgment.'",
    negativeExample:
      "Move: 'OK, taking the analogy seriously — at scale, technical filters work for both spam and misinfo.' (extends_parent)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that accept the analogy and refine it. Pairs with Family E analogy_reasoning_present — that is the positive structural fact; this is the dispute.",
  }),
  Object.freeze({
    rawKey: 'disputes_interpretation',
    label: 'Disputes interpretation',
    booleanQuestion:
      "Does this move dispute the parent's interpretation of a shared piece of evidence, text, or event — arguing for a different reading?",
    positiveDefinition:
      "Both sides share a piece of evidence / text / event. The move argues the parent's interpretation is one reading but not the only one; offers an alternate reading and reasons for it.",
    negativeDefinition:
      "The move offers a new piece of evidence (provides_evidence, Family D), questions the applicability (disputes_evidence_applicability), or challenges the underlying fact (disputes_fact). The move offers an alternate interpretation collaboratively (Family C provides_alternate_interpretation).",
    positiveExample:
      "Parent: 'The 2020 employment data shows the policy worked.' Move: 'The same data shows the gains were concentrated in the top quintile; the policy worked for that group only.'",
    negativeExample:
      "Move: 'Could the data also mean something else?' (questions_parent)",
    falsePositiveGuards:
      "Do NOT confuse with provides_alternate_interpretation (Family C) — that is collaborative; this is adversarial. Do NOT mark TRUE for moves that question without offering an alternate reading.",
  }),
  Object.freeze({
    rawKey: 'disputes_priority_order',
    label: 'Disputes priority order',
    booleanQuestion:
      "Does this move dispute the priority order the parent assigned to options — arguing for a different sequencing?",
    positiveDefinition:
      "The parent ordered options (do X before Y, address A then B). The move argues for a different priority: 'Y before X'; 'address B first because of dependency D'.",
    negativeDefinition:
      "The move disputes that one of the options should be pursued at all (challenges_parent), disputes the criterion used to set priorities (disputes_decision_criterion), or proposes adding/removing an option from the list.",
    positiveExample:
      "Parent: 'Fund libraries first, then museums.' Move: 'Museums first — they have a 5-year capital deadline that libraries do not.'",
    negativeExample:
      "Move: 'We should not fund museums at all.' (challenges_parent on option)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that question whether to include an option at all. Do NOT confuse with disputes_decision_criterion — criterion is the rule for ordering; priority is the ordering itself.",
  }),
  Object.freeze({
    rawKey: 'disputes_remedy_or_solution',
    label: 'Disputes remedy',
    booleanQuestion:
      "Does this move accept the problem framing but dispute the proposed remedy / solution — arguing for a different fix?",
    positiveDefinition:
      "Parent diagnoses a problem and proposes a remedy. The move accepts the diagnosis but argues the proposed remedy will not work, has side effects, or is inferior to an alternative remedy.",
    negativeDefinition:
      "The move disputes the diagnosis itself (challenges_parent), accepts the remedy with refinements (refines_parent), or proposes an additive remedy (extends_parent).",
    positiveExample:
      "Parent: 'Misinformation spreads on platforms; remedy is platform-level filters.' Move: 'Diagnosis accepted; filters miss context and over-block; remedy should be media-literacy investment instead.'",
    negativeExample:
      "Move: 'Misinformation is not actually a problem on platforms.' (challenges diagnosis)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that dispute the diagnosis along with the remedy. Do NOT mark TRUE for collaborative refinements of the remedy.",
  }),
  Object.freeze({
    rawKey: 'disputes_relevance',
    label: 'Disputes relevance',
    booleanQuestion:
      "Does this move dispute that the parent's point is RELEVANT to the topic under discussion?",
    positiveDefinition:
      "The move accepts the parent's point may be accurate but argues it does not bear on the current question. 'That is interesting but tangential'; 'accurate but unrelated to whether X should happen'.",
    negativeDefinition:
      "The move accepts relevance and disputes facts/scope/etc. The move says the topic itself should change (introduces_new_issue / reframes_parent). Pure tangent flag without engagement is just dismissal.",
    positiveExample:
      "Topic: 'Should libraries be funded?' Parent: 'Library buildings emit carbon during construction.' Move: 'That is tangential to whether they should be funded — that question is about value-of-service, not construction emissions.'",
    negativeExample:
      "Move: 'The carbon footprint is small — maybe 0.1% of city emissions.' (disputes_fact, accepts relevance)",
    falsePositiveGuards:
      "Do NOT mark TRUE for dismissive moves with no argument; relevance dispute requires a reason. Do NOT mark TRUE for moves that propose a different framing — that is reframes_parent.",
  }),
]);
