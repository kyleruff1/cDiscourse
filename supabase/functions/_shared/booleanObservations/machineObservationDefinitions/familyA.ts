/**
 * MCP-021A — Family A (parent_relation) definitions.
 *
 * 19 entries total (MCP-021A baseline 16 + MCP-BUILD2b +3).
 *  - 4 existing assigned to Family A (RETROACTIVE_VERBOSE_DEFINITIONS):
 *    - #2 has_rebuttal (auto_metadata)
 *    - #3 has_counter_rebuttal (auto_metadata)
 *    - #19 rebutted (lifecycle)
 *    - #37 quote_anchors_parent (ai_classifier)
 *  - 12 MCP-021A: supports_parent, challenges_parent, refines_parent,
 *    extends_parent, distinguishes_parent, reframes_parent,
 *    questions_parent, summarizes_parent, acknowledges_parent,
 *    corrects_parent_detail, contrasts_with_parent, answers_parent_question.
 *  - 3 MCP-BUILD2b (Build-2 manifest §1; all Inspect-only): the
 *    parent-relation observations acknowledges_parent_strength,
 *    compares_parent_to_sibling_branch, identifies_parent_scope_limit.
 *    NO schema-version bump (vocabulary expansion, not a wire change).
 *
 * All MCP-021A new entries: source: 'ai_classifier', defaultSurface:
 * 'timeline_node', disposition: 'future_source'.
 * timelineMinConfidence: 'medium' (per family — Timeline tolerance).
 *
 * The 3 MCP-BUILD2b booleans are Inspect-only (defaultSurface: 'inspect'),
 * source: 'ai_classifier', disposition: 'future_source'; none are verdicts.
 * acknowledges_parent_strength is verdict-adjacent and is fenced with extra
 * falsePositiveGuards (describes the MOVE, never the author).
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — structural facts about the move's
 *     posture toward its parent; never a verdict.
 *   - cdiscourse-doctrine §1 — supports / challenges / refines are
 *     descriptive, not gameplay-resolving.
 *   - point-standing-economy — supports parent earns engagement credit;
 *     factual-standing change depends on attached evidence.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes.ts';

const NEW_FAMILY_A_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'medium',
  selectedContextMinConfidence: 'low',
  inspectMinConfidence: 'low',
};

// MCP-BUILD2b — Inspect-only eligibility for the 3 new parent-relation
// quality booleans. Mirrors Family B's SUBTYPE_INSPECT_ELIGIBILITY: these
// observations are surfaced on Inspect only (Timeline shows the established
// structural keys), so they need a higher Timeline confidence bar.
const BUILD2B_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

export const FAMILY_A_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // RETROACTIVE #2 has_rebuttal (auto_metadata)
  Object.freeze({
    id: 'registry:machine_observation:auto_metadata:has_rebuttal',
    rawKey: 'has_rebuttal',
    kind: 'machine_observation',
    source: 'auto_metadata',
    family: 'parent_relation',
    label: 'Challenged',
    shortLabel: 'Challenged',
    description: 'This move has a challenge.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 30,
    visibleByDefault: true,

    booleanQuestion:
      'Does this move have at least one child that is structurally a challenge / rebuttal?',
    positiveDefinition:
      "An auto-metadata fact derived from the argument tree: at least one of the move's children is typed as a challenge. Deterministic from the tree.",
    negativeDefinition:
      'The move has no children typed as challenges (it may have other children like clarifications, supports, or branches).',
    positiveExamples: Object.freeze([
      "Move M has child C that is typed challenge → has_rebuttal = TRUE for M.",
      "Move M has children [C_challenge, C_clarify] → has_rebuttal = TRUE.",
    ]),
    negativeExamples: Object.freeze([
      "Move M has no children → has_rebuttal = FALSE.",
      "Move M has only clarification children → has_rebuttal = FALSE.",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE based on tone of a child move — the type marker is what matters.",
      "Do NOT mark TRUE for descendants beyond direct children.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: auto-metadata fact; never implies the challenge "wins" or the parent is "wrong".',
      'cdiscourse-doctrine §1: presence of a challenge is structural; standing change depends on subsequent moves in the cluster.',
    ]),
    confidenceEligibility: {
      timelineMinConfidence: 'high' as const,
      selectedContextMinConfidence: 'high' as const,
      inspectMinConfidence: 'high' as const,
    },
  }),

  // RETROACTIVE #3 has_counter_rebuttal (auto_metadata)
  Object.freeze({
    id: 'registry:machine_observation:auto_metadata:has_counter_rebuttal',
    rawKey: 'has_counter_rebuttal',
    kind: 'machine_observation',
    source: 'auto_metadata',
    family: 'parent_relation',
    label: 'Counter',
    shortLabel: 'Counter',
    description: 'This move has a counter-challenge.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 32,
    visibleByDefault: true,

    booleanQuestion:
      'Does this move have at least one grandchild that is structurally a counter-rebuttal (challenge to its child challenge)?',
    positiveDefinition:
      "An auto-metadata fact derived from the argument tree: the move has a child challenge that itself has a challenge child. Deterministic.",
    negativeDefinition: 'No counter-rebuttal descends from this move (the challenge has no counter-challenge child).',
    positiveExamples: Object.freeze([
      "Tree: M → C_challenge → C2_counter → has_counter_rebuttal = TRUE for M.",
    ]),
    negativeExamples: Object.freeze([
      "Tree: M → C_challenge (no further children) → has_counter_rebuttal = FALSE.",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE based on grandchildren that are clarifications or supports.",
      "Do NOT mark TRUE for great-grandchildren — the check is depth 2 exactly.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: auto-metadata fact; counter-rebuttal presence is structural.',
      'cdiscourse-doctrine §1: never implies the parent or its challenge is "wrong"; this is a structural reflection of dialectical exchange.',
    ]),
    confidenceEligibility: {
      timelineMinConfidence: 'high' as const,
      selectedContextMinConfidence: 'high' as const,
      inspectMinConfidence: 'high' as const,
    },
  }),

  // RETROACTIVE #19 rebutted (lifecycle)
  Object.freeze({
    id: 'registry:machine_observation:lifecycle:rebutted',
    rawKey: 'rebutted',
    kind: 'machine_observation',
    source: 'lifecycle',
    family: 'parent_relation',
    label: 'Pressured',
    shortLabel: 'Pressured',
    description: 'This cluster is under pressure from a challenge.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 14,
    visibleByDefault: true,

    booleanQuestion:
      'Is this cluster in the "rebutted" lifecycle state — an open challenge has been posted and not yet answered?',
    positiveDefinition:
      "A lifecycle state derived from the cluster's response pattern: at least one challenge to the cluster's main claim is open (not closed by a clarification / sourcing / concession / synthesis).",
    negativeDefinition:
      'The cluster has no open challenge, or every challenge has been answered. The cluster moved to a different lifecycle state.',
    positiveExamples: Object.freeze([
      "Cluster with one challenge posted yesterday, no reply yet → rebutted = TRUE.",
    ]),
    negativeExamples: Object.freeze([
      "Cluster with challenge that received a clarifying reply, now in clarified state → rebutted = FALSE.",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for clusters where the challenge was withdrawn.",
      "Do NOT confuse 'rebutted' with 'has_rebuttal' — one is a cluster state, the other is a move-level structural fact.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: lifecycle state; 'rebutted' describes pressure, NOT defeat.",
      "cdiscourse-doctrine §1: the rebutted state does not say who is right; it says the cluster is currently under pressure waiting for response.",
      "point-standing-economy: rebutted clusters are scoring-active until the challenge is resolved (clarified / sourced / conceded / etc.).",
    ]),
    confidenceEligibility: {
      timelineMinConfidence: 'high' as const,
      selectedContextMinConfidence: 'high' as const,
      inspectMinConfidence: 'high' as const,
    },
  }),

  // RETROACTIVE #37 quote_anchors_parent (ai_classifier)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:quote_anchors_parent',
    rawKey: 'quote_anchors_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Anchored reply',
    shortLabel: 'Anchored',
    description: 'This reply is anchored to the parent by a quote.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 41,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move quote specific text from its parent and use that quote as the anchor for its response?",
    positiveDefinition:
      "The move contains a direct quotation of a portion of the parent's text and structures its response around that quote — addressing the quoted portion specifically rather than the parent's general thrust.",
    negativeDefinition:
      "The move paraphrases the parent without quoting, or references the parent without a quote, or quotes something that is not the parent (an external source). A passing quote without anchoring (the move's substantive response is elsewhere) is NOT this rawKey.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce urban pollution by 40%.' Move: 'You said \\'reduce urban pollution by 40%\\' — that figure comes from tailpipe-only studies; if you include manufacturing it drops to 12%.' (quote-anchored)",
    ]),
    negativeExamples: Object.freeze([
      "Move responds with a paraphrase of the parent's overall claim without quoting anything.",
      "Move quotes an external source and responds to that.",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that quote in passing without anchoring the response.",
      "Do NOT mark TRUE for moves that quote a third source rather than the parent.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural fact about the move; never a verdict on whether the quote-anchored response is "better".',
      "point-standing-economy: quote-anchoring is a recovery-positive move — earns engagement credit because it makes the disagreement axis precise.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #1 supports_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:supports_parent',
    rawKey: 'supports_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Supports parent',
    shortLabel: 'Supports',
    description: 'This move provides support for its parent argument.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 100,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move's substantive content support (rather than challenge, refine, or be neutral about) its parent's position?",
    positiveDefinition:
      "The move advances reasons, evidence, or examples that strengthen the parent's claim or position. The move may add new support, restate the parent's claim from a different angle, or provide a confirming example.",
    negativeDefinition:
      "The move challenges, qualifies, redirects, or is independent of the parent's position. A move that says 'yes, and ALSO...' for a DIFFERENT axis is NOT support — that is extends_parent.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce urban air pollution.' Move: 'A 2024 EPA study confirms tailpipe-emission reductions of 40% in EV-heavy cities.'",
      "Parent: 'Library funding matters.' Move: 'Yes — the Pittsburgh public-library outcome data shows direct literacy gains.'",
      "Parent: 'Remote work increases productivity.' Move: 'Right — the Stanford 2020 controlled trial showed a 13% productivity gain.'",
    ]),
    negativeExamples: Object.freeze([
      "Parent: 'EVs reduce urban air pollution.' Move: 'But manufacturing batteries produces emissions too.' (challenges, not supports)",
      "Parent: 'Library funding matters.' Move: 'Yes — and we should fund museums too.' (extends to different axis)",
      "Parent: 'Remote work increases productivity.' Move: 'What about industries where it does not apply?' (questions scope)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that merely express agreement ('I agree') without adding any support — that is acknowledges_parent.",
      "Do NOT mark TRUE for moves that extend the parent to a different axis — that is extends_parent.",
      "Do NOT mark TRUE for moves that quote the parent without adding substantive support — that is quote_anchors_parent.",
      "Do NOT mark TRUE based on tone, politeness, or surface-level affirmation; the move must add substantive support.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: structural fact only; never implies the parent is 'right' or the move is 'correct'.",
      "cdiscourse-doctrine §1: support presence is not a verdict; the parent's standing depends on the responder's narrowing / sourcing / synthesis moves.",
      "point-standing-economy: support of parent is engagement credit, not factual-standing credit until evidence is attached.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #2 challenges_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:challenges_parent',
    rawKey: 'challenges_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Challenges parent',
    shortLabel: 'Challenges',
    description: 'This move challenges its parent argument.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 101,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move's substantive content challenge (dispute, push back on, raise problems with) its parent's claim, scope, evidence, or reasoning?",
    positiveDefinition:
      "The move's substantive content pushes back on the parent in at least one of: factual challenge, scope challenge, evidence-applicability challenge, definition dispute, causal disagreement, value disagreement.",
    negativeDefinition:
      "The move agrees, refines on the same side, questions for clarification, summarizes, or acknowledges. Pure questions and pure paraphrases are NOT challenges.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce urban pollution.' Move: 'That ignores battery production emissions.' (challenges evidence applicability)",
      "Parent: 'All libraries should be funded equally.' Move: 'Rural and urban libraries have very different needs; equal isn\\'t the right metric.' (challenges definition)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'How are you measuring pollution?' (clarification, not challenge)",
      "Move: 'Yes, and EVs also reduce noise pollution.' (extends, not challenges)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT confuse with has_rebuttal (auto-metadata post-hoc fact) — this is move-intrinsic: 'is THIS move a challenge?'",
      "Do NOT mark TRUE for pragmatic-marker phrases ('but', 'however') without substantive disagreement.",
      "Do NOT mark TRUE for tone alone; substantive content is required.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural posture fact; challenges are normal in productive debate.',
      "cdiscourse-doctrine §1: a challenge is not a verdict that the parent is 'wrong'; it is a productive pressure invitation.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #3 refines_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:refines_parent',
    rawKey: 'refines_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Refines parent',
    shortLabel: 'Refines',
    description: 'This move refines or narrows the parent\'s claim.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 102,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move take the parent's claim and offer a refinement that narrows or sharpens it (same side, more precise)?",
    positiveDefinition:
      "The move accepts the parent's broad direction and proposes a more precise / narrower / better-scoped version. Move-intrinsic; distinct from lifecycle 'narrowed' (which is cluster-state after acceptance).",
    negativeDefinition:
      "The move challenges or disputes, extends to a different axis, or merely acknowledges. A refinement is supportive narrowing.",
    positiveExamples: Object.freeze([
      "Parent: 'Libraries are infrastructure.' Move: 'Yes — specifically public-good infrastructure that needs collective funding like roads, not optional infrastructure like ski resorts.'",
      "Parent: 'Carbon taxes work.' Move: 'Carbon taxes work IN jurisdictions with stable enforcement and a 5+ year horizon; outside those conditions the data is mixed.'",
    ]),
    negativeExamples: Object.freeze([
      "Parent: 'Carbon taxes work.' Move: 'No, they don't.' (challenge, not refinement)",
      "Parent: 'Libraries are infrastructure.' Move: 'And so are roads.' (extends to different example, not refines)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for restatements without narrowing.",
      "Do NOT mark TRUE for challenges framed politely; refinement is supportive.",
      "Do NOT confuse with narrows_claim (the cluster-level outcome) — this is the move-intrinsic act.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: structural same-side narrowing; never implies the parent was 'wrong'.",
      "point-standing-economy: refinement is a recovery-positive move that helps both sides; earns engagement credit; conversion of broad claim into a more defensible narrow claim can earn standing repair credit when the original broad claim was challenged.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #4 extends_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:extends_parent',
    rawKey: 'extends_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Extends parent',
    shortLabel: 'Extends',
    description: 'This move extends the parent to a related but distinct point.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 103,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move accept the parent's point and extend it to a related but distinct point on the same side?",
    positiveDefinition:
      "The move signals 'yes, AND also...' — accepting the parent and adding a related but distinct same-side point. The extension is not the same claim restated; it is an additional claim coalition-building with the parent.",
    negativeDefinition:
      "The move challenges, refines (narrows the same claim), or extends to a DIFFERENT axis. Pure agreement without extension is acknowledges_parent.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce tailpipe emissions.' Move: 'Yes, and they also reduce noise pollution in dense urban areas.' (extends same side to new axis)",
      "Parent: 'Public libraries matter.' Move: 'Yes — and so do museums; the broader public-cultural-infrastructure case is even stronger.' (coalition-building)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Yes.' (acknowledges, no extension)",
      "Move: 'Specifically, EVs reduce tailpipe emissions in cities with 30+% EV share.' (refines, not extends)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for restatements.",
      "Do NOT mark TRUE for extensions that are actually different topics (those are introduces_new_issue).",
      "Do NOT mark TRUE based on 'and' alone; substantive extension is required.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: extension is a same-side coalition move; structural only.",
      "point-standing-economy: extension is supportive engagement; does not directly change standing of the parent.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #5 distinguishes_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:distinguishes_parent',
    rawKey: 'distinguishes_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Distinguishes from parent',
    shortLabel: 'Distinguishes',
    description: 'This move draws a sub-distinction the parent did not.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 104,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move draw a sub-distinction within the parent\'s scope that the parent treated as unified?',
    positiveDefinition:
      "The move splits a category the parent treated as one ('libraries' → 'urban libraries vs rural libraries'; 'EVs' → 'passenger EVs vs commercial EVs'). The distinction matters for the parent's claim.",
    negativeDefinition:
      'The move accepts the parent\'s scope without subdividing, or proposes an entirely new axis (introduces_new_issue), or challenges the whole claim.',
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce pollution.' Move: 'Worth distinguishing passenger EVs (which clearly do) from commercial EVs (where the effect depends on duty cycle).'",
      "Parent: 'Carbon taxes work.' Move: 'Sectoral distinction matters — they work for power generation; the picture is messier for manufacturing.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs do not reduce pollution at all.' (challenges, not distinguishes)",
      "Move: 'EVs also save fuel costs.' (extends, not distinguishes)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for cosmetic distinctions that do not affect the parent's claim.",
      "Do NOT confuse with disputes_scope (Family B) — distinction is collaborative; scope dispute is adversarial.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: structural sub-distinction; collaborative refinement.",
      "point-standing-economy: drawing a useful distinction is a recovery-positive move; both sides benefit from sharper categories.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #6 reframes_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:reframes_parent',
    rawKey: 'reframes_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Reframes parent',
    shortLabel: 'Reframes',
    description: 'This move offers a different frame for the parent\'s topic.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 105,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move re-frame the topic, shifting the lens or the decision criterion the parent assumed?',
    positiveDefinition:
      "The move accepts the topic but proposes a different frame: 'this is really a question of fairness, not efficiency'; 'the right unit is per-resident, not per-county'; 'we should be asking who pays, not whether to pay'. Reframing changes the criterion.",
    negativeDefinition:
      'The move accepts the frame and challenges the claim within it, or extends, or refines, or introduces a new issue without reframing.',
    positiveExamples: Object.freeze([
      "Parent: 'Library funding should be efficient.' Move: 'Efficiency is the wrong lens; the question is equity of access.' (reframes criterion)",
      "Parent: 'EVs are about emissions.' Move: 'They are about supply-chain dependencies as much as emissions.' (reframes topic)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding is not efficient.' (challenges within same frame)",
      "Move: 'EVs reduce emissions by 40%.' (accepts frame, makes claim)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that merely add a new consideration; reframing changes the lens itself.",
      "Do NOT confuse with introduces_new_issue — that is a fresh topic; reframing is a different angle on the same topic.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: reframing is structural; valuable when productive, but never a verdict that the parent's frame was 'wrong'.",
      "point-standing-economy: a productive reframe can unstick a stalled dispute; reframes mid-discussion earn engagement credit.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #7 questions_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:questions_parent',
    rawKey: 'questions_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Questions parent',
    shortLabel: 'Questions',
    description: 'This move asks a substantive question about the parent.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 106,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move ask a substantive question about the parent's claim, evidence, or reasoning (not just a clarification)?",
    positiveDefinition:
      "The move poses a real question that probes the parent's basis: 'how do you square that with X?'; 'what would falsify this?'; 'have you considered Y?'. The question carries genuine engagement, not just clarification.",
    negativeDefinition:
      "The move is a pure clarification request (requests_clarification), a challenge framed as a question (challenges_parent), or rhetorical question with no engagement.",
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes work.' Move: 'How do you square that with the 2019 Australian repeal data?' (substantive question)",
      "Parent: 'Libraries boost literacy.' Move: 'Have you looked at the effect in zero-bookshop neighborhoods specifically?' (probing question)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What do you mean?' (clarification, not questioning)",
      "Move: 'Are you serious?' (rhetorical, not substantive)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT confuse with requests_clarification — questioning probes; clarification merely seeks restatement.",
      "Do NOT mark TRUE for rhetorical questions that carry implicit assertions.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: questioning is a structural engagement move; never a verdict.",
      "point-standing-economy: substantive questioning earns engagement credit; the responder gains the chance to defend or refine.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #8 summarizes_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:summarizes_parent',
    rawKey: 'summarizes_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Summarizes parent',
    shortLabel: 'Summary',
    description: 'This move summarizes the parent\'s position.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 107,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move summarize the parent's position in its own words?",
    positiveDefinition:
      "The move restates the parent's position in compressed form, preserving the parent's intent. May be in service of a follow-up move (challenge, support, refine) or stand on its own.",
    negativeDefinition:
      "The move quotes the parent verbatim (quote_anchors_parent), paraphrases inaccurately, or proceeds without restating.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce urban pollution because tailpipe emissions drop, especially in dense cities, and the grid is getting cleaner.' Move: 'So your claim is: EVs reduce urban pollution, with the effect stronger in cities and growing with grid mix.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'You said EVs reduce urban pollution because tailpipe emissions drop, especially in dense cities, and the grid is getting cleaner.' (verbatim quote)",
      "Move: 'EVs are bad for the grid.' (does not summarize parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for paraphrases that substantially change the parent's meaning (that is misrepresentation).",
      "Do NOT mark TRUE for verbatim quotes (use quote_anchors_parent).",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: structural fact; summarizing is repair-positive (it grounds shared understanding).",
      "Clark & Brennan grounding doctrine (B.5 in MCP-020 audit): summary establishes common ground before further moves.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #9 acknowledges_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:acknowledges_parent',
    rawKey: 'acknowledges_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Acknowledges parent',
    shortLabel: 'Ack',
    description: 'This move acknowledges the parent without disputing or adding.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 108,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move express acknowledgement of the parent ('OK', 'I see', 'fair point') without adding substantive content?",
    positiveDefinition:
      "The move signals agreement, understanding, or willingness to engage, but adds no substantive support, refinement, challenge, or extension.",
    negativeDefinition:
      "The move adds substantive content beyond acknowledgement (which would be supports_parent / extends_parent / refines_parent etc.).",
    positiveExamples: Object.freeze([
      "Move: 'Fair point.' (pure acknowledgement)",
      "Move: 'OK — I see what you mean.' (acknowledgement)",
      "Move: 'Yes, that is right.' (acknowledgement)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Yes — the Pittsburgh data confirms this.' (supports_parent, more than acknowledgement)",
      "Move: 'Yes, and we should also fund museums.' (extends_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves with substantive content beyond acknowledgement.",
      "Do NOT mark TRUE for moves that acknowledge sarcastically (those play differently in the point-standing economy).",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: structural; acknowledgement is engagement without substance.",
      "point-standing-economy: acknowledgement is a low-cost move; does not change standing but keeps the conversation engaged.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #10 corrects_parent_detail
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:corrects_parent_detail',
    rawKey: 'corrects_parent_detail',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Corrects parent detail',
    shortLabel: 'Corrects',
    description: 'This move corrects a specific factual detail in the parent.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 109,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move correct a specific factual detail in the parent (a number, name, date, attribution) without challenging the parent's overall claim?",
    positiveDefinition:
      "The move points out an error in a specific factual detail and offers the correct value, while leaving the parent's main claim intact. Narrower than challenges_parent.",
    negativeDefinition:
      "The move challenges the parent's overall claim, or quibbles with detail without offering a correction, or asks for clarification about the detail.",
    positiveExamples: Object.freeze([
      "Parent: 'EV adoption is at 30% nationally.' Move: 'The 30% number is for new sales, not stock; stock is closer to 5%.'",
      "Parent: 'The 2019 paper by Jones.' Move: 'Small correction — that is the 2020 paper; the Jones 2019 was on a different topic.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EV adoption claims are exaggerated.' (challenges the overall claim, not just a detail)",
      "Move: 'When you say 30%, what do you mean?' (clarification, not correction)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for substantive challenges packaged as 'corrections'.",
      "Do NOT mark TRUE for cosmetic corrections (spelling, formatting).",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: factual-detail correction is a repair-positive structural fact.",
      "point-standing-economy: a clean factual correction does not change standing of the broader claim; the responder may incorporate the correction and continue.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #11 contrasts_with_parent
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:contrasts_with_parent',
    rawKey: 'contrasts_with_parent',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Contrasts with parent',
    shortLabel: 'Contrasts',
    description: 'This move draws a contrast that highlights a tension with the parent.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 110,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move draw a contrast between two cases / examples / domains to highlight a tension with the parent\'s claim?',
    positiveDefinition:
      "The move presents a comparison ('whereas X, Y') in service of showing the parent's claim does not hold uniformly. The contrast is the move's main vehicle.",
    negativeDefinition:
      'The move offers a direct challenge, supports with a similar case, distinguishes within the parent\'s scope (distinguishes_parent), or extends.',
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes always work.' Move: 'BC's tax cut emissions; Australia's was repealed before measurement. Contrasts on these two suggest the policy needs durable enforcement to work.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes did not work in Australia.' (challenge, not contrast structure)",
      "Move: 'BC carbon tax cut emissions by 5%.' (supports the parent with a positive case)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that mention contrasts in passing without using the contrast as the central move.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: structural; contrast structure is descriptive.",
      "point-standing-economy: well-structured contrast invites the responder to refine scope; productive for both sides.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // NEW #12 answers_parent_question
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:answers_parent_question',
    rawKey: 'answers_parent_question',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Answers parent question',
    shortLabel: 'Answers',
    description: 'This move answers a question posed by the parent.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 111,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move answer a question that was posed in the parent move?",
    positiveDefinition:
      "The parent contained a question (request for evidence, clarification, or substantive question). The move provides a direct response to that question.",
    negativeDefinition:
      'The parent contained no question, or the move ignores the question and responds to something else, or the move is a counter-question without an answer.',
    positiveExamples: Object.freeze([
      "Parent: 'What is your source for the 40% figure?' Move: 'EPA 2024 urban-tailpipe summary report, table 3.'",
      "Parent: 'How do you square that with the BC data?' Move: 'BC is consistent because its tax remained in place long enough; the disagreement is about enforcement durability.'",
    ]),
    negativeExamples: Object.freeze([
      "Parent: 'What is your source?' Move: 'Why are you so focused on this?' (counter-question, no answer)",
      "Parent posed no question. Move responds with statement. (no question to answer)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for non-responsive moves that paraphrase the question without answering.",
      "Do NOT mark TRUE for counter-questions only; the move must answer.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: structural; answering parent questions is engagement-positive.",
      "point-standing-economy: answering closes the evidence-debt or clarification-debt the parent opened.",
    ]),
    confidenceEligibility: NEW_FAMILY_A_ELIGIBILITY,
  }),

  // ── MCP-BUILD2b (parent_relation expansion) ───────────────────────
  // Three Build-2b booleans per the Build-2 manifest §1. These describe
  // qualities of the parent-relation MOVE — whether it grants a strength
  // before disagreeing, whether it compares the parent to a sibling branch,
  // and whether it names a specific scope limit on the parent's claim. All
  // Inspect-only; none are verdicts. acknowledges_parent_strength is
  // verdict-adjacent and is fenced with extra falsePositiveGuards (describes
  // the MOVE, never the author). compares_parent_to_sibling_branch carries a
  // classifier-reliability carry-forward (see its doctrineNotes).

  // BUILD2b #1 acknowledges_parent_strength (Inspect-only; VERDICT-ADJACENT)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:acknowledges_parent_strength',
    rawKey: 'acknowledges_parent_strength',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Grants a point before disagreeing',
    shortLabel: 'Grants a point',
    description: 'This move grants a point of the parent before disagreeing with it.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 112,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move acknowledge a strength of the parent before disagreeing with it?',
    positiveDefinition:
      "The move explicitly grants that some substantive part of the parent holds — names a specific point it accepts — and THEN proceeds to disagree on another point. The acknowledgement names a real claim, premise, or piece of reasoning, and is followed by a substantive disagreement in the same move.",
    negativeDefinition:
      "The move disagrees with no acknowledgement (pure challenges_parent), or it only acknowledges with no following disagreement (that is the existing acknowledges_parent — agreement without a counter-move), or it is not a disagreement at all. Politeness or tone alone does not count.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs cut tailpipe emissions and lower running costs.' Move: 'Fair point on the tailpipe data — I accept that. Where I'd part ways is the running-cost case; battery replacement narrows the gap a lot.'",
      "Parent: 'Library funding should prioritize cost-per-visit and equity.' Move: 'Your strongest claim is the cost case; I take that as given, and still think the equity case has not been made out for rural branches.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'That's just off base.' (disagreement with no acknowledgement — challenges_parent, not this)",
      "Move: 'Good point.' (acknowledgement only, no following disagreement — that is acknowledges_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      'This observation describes the MOVE, never the author. It never says the parent IS strong or right; it only notes that the move grants a point before disagreeing. The acknowledged point is not endorsed as standing-bearing.',
      "Do NOT mark TRUE on politeness or tone alone; the acknowledgement must name a SUBSTANTIVE point of the parent AND be followed by a substantive disagreement in the same move.",
      'Do NOT mark TRUE for a bare acknowledgement with no following disagreement — that is acknowledges_parent. Do NOT mark TRUE for a move that fully supports the parent — that is supports_parent.',
      'Do NOT treat the ABSENCE of this observation as a criticism: a move that disagrees without granting a point first is perfectly valid and simply does not trip this flag. Absence means "not observed", never "the author was ungracious".',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: this is a MACHINE OBSERVATION about the MOVE\'s rhetorical structure; it is display-only and never a verdict that the parent point is correct or strong.',
      'cdiscourse-doctrine §1: granting a point before disagreeing is not a score of who is right; "strength" here names the move\'s framing, not the parent\'s standing. Ban "correct"/"true"/"wins" in label + diagnostic.',
      'cdiscourse-doctrine §4: advisory only; pairs with Family B\'s preserves_face_while_disagreeing as a mitigation observation — the structural opposite of the composer-only shifts_to_person_or_intent observation.',
    ]),
    confidenceEligibility: BUILD2B_INSPECT_ELIGIBILITY,
  }),

  // BUILD2b #2 compares_parent_to_sibling_branch (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:compares_parent_to_sibling_branch',
    rawKey: 'compares_parent_to_sibling_branch',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Compares to a sibling branch',
    shortLabel: 'Sibling compare',
    description: 'This move compares the parent with a sibling branch in the same thread.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 113,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move compare the parent move with a sibling branch in the same thread?',
    positiveDefinition:
      "The move references another branch in the same thread (a different child line under the same parent) and contrasts the parent move with it — 'unlike the enforcement branch, this one assumes durable institutions'. The comparison is to a SIBLING branch, not the parent itself or an ancestor.",
    negativeDefinition:
      "The move stays within the parent line with no sibling reference; references an ancestor ('earlier you said'); or invokes a generic 'elsewhere people argue' that points to no specific sibling branch in this thread.",
    positiveExamples: Object.freeze([
      "Move: 'The sibling thread already settled the cost question; this branch is really about equity.'",
      "Move: 'Compared to the other reply chain on enforcement, this one ignores the enforcement variable entirely.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'I disagree with the cost figure.' (no sibling reference)",
      "Move: 'Earlier you said X.' (ancestor reference, not a sibling branch)",
    ]),
    falsePositiveGuards: Object.freeze([
      "The comparison must be to a SIBLING branch (same parent, different child line) — not to the parent itself and not to an ancestor (ancestor topology is a Family I concern, out of scope here).",
      "Do NOT mark TRUE on a generic 'elsewhere people argue…' that names no specific sibling branch in this thread.",
      'Do NOT confuse with contrasts_with_parent — that contrasts two cases/examples; this references another BRANCH of the thread.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: purely structural / topological observation about the MOVE; never a verdict on which branch is right.',
      'RELIABILITY CARRY-FORWARD (GATE-A Open Question b): cross-branch reasoning is a harder classifier task. The Family-A card ships all 3 booleans; the OPERATOR must verify admin_validation precision for this key at audit and MAY DEFER trusting it on the production card surface if it proves noisy. Shipping the definition does not commit to trusting its output before the precision check.',
    ]),
    confidenceEligibility: BUILD2B_INSPECT_ELIGIBILITY,
  }),

  // BUILD2b #3 identifies_parent_scope_limit (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:identifies_parent_scope_limit',
    rawKey: 'identifies_parent_scope_limit',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'parent_relation',
    label: 'Names a scope limit',
    shortLabel: 'Scope limit',
    description: 'This move names a specific scope limit on the parent\'s claim.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 114,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move identify a specific scope limit on the parent's claim?",
    positiveDefinition:
      "The move names a SPECIFIC boundary — a named population, time horizon, or setting — where the parent's claim stops applying, without necessarily disputing it adversarially. 'This holds for passenger EVs; commercial duty cycles are a different case.' The scope-naming is collaborative: it sharpens where the claim does and does not reach.",
    negativeDefinition:
      "The move accepts the parent's scope wholesale; disputes scope adversarially (that framing is disputes_scope in Family B); or hedges vaguely ('it depends') without naming a specific boundary.",
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes cut emissions.' Move: 'True within cities with stable enforcement; the suburban case is open.'",
      "Parent: 'The trial shows a durable effect.' Move: 'It applies to the 5-year horizon you cited; beyond that the data thins out.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'That's just false.' (disputes the fact, names no scope limit)",
      "Move: 'Carbon taxes never work.' (no scope limit named)",
    ]),
    falsePositiveGuards: Object.freeze([
      "The scope limit must be SPECIFIC — a named population, time, or setting; do NOT mark on a vague 'it depends'.",
      'Distinguish the collaborative scope-naming here from the adversarial disputes_scope in Family B (both may co-fire; this is the structural fact that a boundary was named, Family B\'s is the dispute framing).',
      'Do NOT confuse with distinguishes_parent — that splits a category the parent treated as unified; this names a boundary where the parent\'s claim stops applying.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural feature of the MOVE; "scope limit" is a boundary observation, not a deficiency verdict on the parent.',
      'point-standing-economy: naming a scope limit is a recovery-positive move — it can convert a broad challenged claim into a more defensible narrow one; both sides benefit from a sharper boundary.',
    ]),
    confidenceEligibility: BUILD2B_INSPECT_ELIGIBILITY,
  }),
]);
