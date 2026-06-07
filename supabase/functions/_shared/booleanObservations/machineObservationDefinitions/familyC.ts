/**
 * MCP-021A + MCP-BUILD2c — Family C (misunderstanding_repair) definitions.
 *
 * 20 entries total (MCP-021A baseline 17 + MCP-BUILD2c +3).
 *  - 4 existing assigned to Family C (RETROACTIVE_VERBOSE_DEFINITIONS):
 *    - #20 clarified (lifecycle)
 *    - #38 requests_clarification (ai_classifier)
 *    - #39 answers_clarification (ai_classifier)
 *    - #53 provides_alternate_interpretation (ai_classifier)
 *  - 13 MCP-021A: offers_candidate_understanding, confirms_understanding,
 *    rejects_candidate_understanding, requests_restatement,
 *    self_initiates_self_repair, other_initiates_repair,
 *    acknowledges_misread, flags_ambiguous_reference,
 *    flags_term_ambiguity, proposes_shared_definition,
 *    confirms_shared_definition, scope_mismatch_identified,
 *    question_answer_mismatch.
 *  - 3 MCP-BUILD2c (Build-2 manifest §2; all Inspect-only): the
 *    misunderstanding-repair observations offers_repair_path,
 *    names_ambiguity_source, accepts_correction. NO schema-version bump
 *    (vocabulary expansion, not a wire change).
 *
 * Decision 5 (binding): brief candidate `requests_clarification`
 * COLLAPSES into existing #38 `requests_clarification`. No alias added.
 *
 * Mostly defaultSurface 'timeline_node' for high-signal repair moves;
 * sub-distinctions Inspect-only.
 *
 * The 3 MCP-BUILD2c booleans are Inspect-only (defaultSurface: 'inspect'),
 * source: 'ai_classifier', disposition: 'future_source'; none are verdicts.
 * accepts_correction is verdict-adjacent and is fenced "repair-not-defeat"
 * with extra falsePositiveGuards (describes the repair MOVE — taking up a
 * point a prior move offered — never frames it as defeat/concession of the
 * whole, never labels the author). Its plain-language label contains the
 * substring "correct"; the verdict-free ban-list test MUST use word-boundary
 * / phrase matching, never bare-substring "correct".
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — repair is structural; never implies
 *     fault on parent's clarity.
 *   - cdiscourse-doctrine §1 — concession is a scoring REPAIR, not a
 *     defeat; accepts_correction describes the repair move, never a loss.
 *   - Schegloff/Sacks repair model — self-initiated vs other-initiated
 *     repair as the foundational pattern.
 *   - Clark & Brennan grounding doctrine — candidate-understanding +
 *     confirms are the high-signal grounding moves.
 *   - point-standing-economy — repair moves earn engagement credit
 *     and can convert future disagreement into productive narrowing.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes.ts';

const REPAIR_TIMELINE_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'medium',
  selectedContextMinConfidence: 'low',
  inspectMinConfidence: 'low',
};

const REPAIR_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

// MCP-BUILD2c — Inspect-only eligibility for the 3 new misunderstanding-repair
// quality booleans. Mirrors Family A's BUILD2B_INSPECT_ELIGIBILITY: these
// observations are surfaced on Inspect only (Timeline shows the established
// repair keys), so they need a higher Timeline confidence bar.
const BUILD2C_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

export const FAMILY_C_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // RETROACTIVE #20 clarified (lifecycle)
  Object.freeze({
    id: 'registry:machine_observation:lifecycle:clarified',
    rawKey: 'clarified',
    kind: 'machine_observation',
    source: 'lifecycle',
    family: 'misunderstanding_repair',
    label: 'Clarified',
    shortLabel: 'Clarified',
    description: 'A clarification was provided in this cluster.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 23,
    visibleByDefault: true,

    booleanQuestion:
      'Is this cluster in the "clarified" lifecycle state — a clarification request was answered with a clarifying response?',
    positiveDefinition:
      'A lifecycle state where the cluster contains a clarification request and at least one clarifying response (answers_clarification or equivalent repair move).',
    negativeDefinition:
      'The cluster has no clarification request, or the request is open with no answer, or the request was answered with a non-clarifying move.',
    positiveExamples: Object.freeze([
      "Cluster sequence: claim → clarification request → clarifying response → clarified state.",
    ]),
    negativeExamples: Object.freeze([
      "Cluster with no clarification request → never enters clarified.",
      "Cluster with open clarification request, no response → still in requested state.",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE based on cosmetic tone — the lifecycle transition requires an actual clarifying response.",
      "Do NOT confuse with answers_clarification (the move-level fact) — clarified is the cluster-level state.",
    ]),
    doctrineNotes: Object.freeze([
      "cdiscourse-doctrine §10a: lifecycle state; clarified describes the cluster's grounding progress.",
      'Clark & Brennan: clarification cycles are productive grounding moves.',
    ]),
    confidenceEligibility: {
      timelineMinConfidence: 'high' as const,
      selectedContextMinConfidence: 'high' as const,
      inspectMinConfidence: 'high' as const,
    },
  }),

  // RETROACTIVE #38 requests_clarification (ai_classifier)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:requests_clarification',
    rawKey: 'requests_clarification',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Clarification asked',
    shortLabel: 'Clarify?',
    description: 'A clarification is requested here.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 38,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move ask the parent's poster to clarify a term, claim, scope, or reasoning step?",
    positiveDefinition:
      "The move poses a question seeking a restatement, definition, scope, or elaboration. 'What do you mean by X?'; 'how broad is this claim?'; 'do you mean the 2020 or 2024 data?'. Pure clarification — no challenge attached.",
    negativeDefinition:
      "The move offers a candidate understanding (offers_candidate_understanding), challenges packaged as a question (challenges_parent), or asks for evidence (asks_for_evidence, Family D).",
    positiveExamples: Object.freeze([
      "Parent: 'Libraries are infrastructure.' Move: 'What do you mean by infrastructure here?'",
      "Parent: 'EVs reduce emissions.' Move: 'Tailpipe only, or lifecycle?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Do you mean libraries are public goods that should be funded like roads?' (offers_candidate_understanding)",
      "Move: 'What is your source?' (asks_for_evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT confuse with offers_candidate_understanding — clarification request poses a question; candidate understanding offers a paraphrase.",
      "Do NOT mark TRUE for rhetorical questions.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: clarification request is repair-positive; structural fact only.',
      'Decision 5: brief candidate requests_clarification_present collapsed into this existing key. No alias added.',
      'Clark & Brennan: clarification requests open grounding cycles.',
    ]),
    confidenceEligibility: REPAIR_TIMELINE_ELIGIBILITY,
  }),

  // RETROACTIVE #39 answers_clarification (ai_classifier)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:answers_clarification',
    rawKey: 'answers_clarification',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Clarification answered',
    shortLabel: 'Clarified',
    description: 'A clarification was answered here.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 39,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move provide a substantive answer to a clarification request from the parent?',
    positiveDefinition:
      'The move responds to a clarification request with a substantive answer: a definition, a scope, an elaboration, a restatement. Closes the clarification cycle.',
    negativeDefinition:
      'The move evades the question, offers a counter-question, or responds with new content unrelated to the clarification.',
    positiveExamples: Object.freeze([
      "Parent (asks): 'What do you mean by infrastructure?' Move: 'I mean public goods funded collectively — like roads, libraries, parks.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Why do you need that defined?' (counter-question, no answer)",
      "Move: 'Let me make a different point.' (changes topic)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for partial answers that evade the substance.',
      'Do NOT mark TRUE for counter-questions.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: clarification answer is repair-positive; structural.',
      'point-standing-economy: answering a clarification request closes a debt and earns engagement credit.',
    ]),
    confidenceEligibility: REPAIR_TIMELINE_ELIGIBILITY,
  }),

  // RETROACTIVE #53 provides_alternate_interpretation (ai_classifier)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:provides_alternate_interpretation',
    rawKey: 'provides_alternate_interpretation',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Alternate reading',
    shortLabel: 'Alt read',
    description: 'An alternate interpretation is offered.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 48,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move offer an alternate interpretation of the parent (or a prior move's) text or evidence, framed collaboratively rather than adversarially?",
    positiveDefinition:
      "The move offers a different reading of the parent's text / evidence, inviting consideration rather than disputing. 'Could it also mean Y?'; 'another reading is Z; what do you think?'. Collaborative.",
    negativeDefinition:
      "The move disputes the interpretation directly (disputes_interpretation, Family B), offers a counter-claim without inviting consideration, or asks a pure clarification.",
    positiveExamples: Object.freeze([
      "Parent: 'The 2020 employment data shows the policy worked.' Move: 'Could the data also mean the gains were concentrated in a specific group?'",
      "Parent: 'The constitutional clause means X.' Move: 'Another reading is Y; both seem plausible — what makes you favor X?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The same data shows the gains were concentrated in the top quintile — your reading is wrong.' (disputes_interpretation, adversarial)",
      "Move: 'What do you think the data shows?' (questions_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT confuse with disputes_interpretation (Family B) — collaborative vs adversarial framing distinguishes.",
      "Do NOT mark TRUE for moves that offer an alternative without inviting consideration.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: alternate-interpretation offer is repair-positive collaborative move.',
      'Clark & Brennan: offering alternates opens shared interpretation space.',
    ]),
    confidenceEligibility: REPAIR_TIMELINE_ELIGIBILITY,
  }),

  // NEW #1 offers_candidate_understanding
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:offers_candidate_understanding',
    rawKey: 'offers_candidate_understanding',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Offers candidate understanding',
    shortLabel: '"Do you mean..."',
    description: "This move offers a paraphrase of the parent's claim for confirmation.",
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 130,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move offer a paraphrase of the parent's claim and ask the parent's poster to confirm or correct that paraphrase?",
    positiveDefinition:
      "The move restates the parent's claim in its own words (a 'candidate understanding') AND signals openness to correction. The move signals 'do you mean X?' explicitly OR via paraphrase + invitation to correct.",
    negativeDefinition:
      "The move quotes the parent verbatim without paraphrasing, OR paraphrases without inviting correction, OR asks for clarification without offering a candidate. Pure question ('what do you mean?') is requests_clarification, not this.",
    positiveExamples: Object.freeze([
      "Parent: 'Libraries are infrastructure.' Move: 'Are you saying libraries are public goods that should be funded like roads?'",
      "Parent: 'Free trade hurt manufacturing.' Move: 'Do you mean the post-1995 manufacturing job losses are attributable to trade liberalization specifically?'",
      "Parent: 'AI is overhyped.' Move: 'Reading you as saying the current capabilities are oversold; is that right?'",
    ]),
    negativeExamples: Object.freeze([
      "Parent: 'Libraries are infrastructure.' Move: 'What do you mean?' (requests_clarification, no candidate)",
      "Parent: 'Libraries are infrastructure.' Move: 'Libraries are infrastructure.' (just quotes; no candidate)",
      "Parent: 'AI is overhyped.' Move: 'AI is not overhyped.' (disagrees; no candidate offered)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that paraphrase without an invitation to correct.',
      "Do NOT mark TRUE for moves whose paraphrase substantially changes the parent's meaning (that would be misrepresentation).",
      'Do NOT mark TRUE for follow-up moves that just restate without asking for correction.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural; candidate-understanding is the high-signal repair pattern that promotes good-faith disagreement.',
      'Clark & Brennan grounding doctrine (B.5 in MCP-020 audit): candidate understanding is the high-signal grounding move.',
      'point-standing-economy: offering a candidate understanding before disagreeing is a recovery-positive move — earns engagement credit for the responder and can convert future disagreement into productive narrowing.',
    ]),
    confidenceEligibility: REPAIR_TIMELINE_ELIGIBILITY,
  }),

  // NEW #2 confirms_understanding
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:confirms_understanding',
    rawKey: 'confirms_understanding',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Confirms candidate',
    shortLabel: 'Confirms',
    description: 'This move confirms a candidate understanding the parent offered.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 131,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move confirm a candidate understanding that the parent offered, sealing the grounding cycle?',
    positiveDefinition:
      "The parent offered a candidate understanding ('do you mean X?'). The move confirms: 'yes, that is right'; 'exactly'; 'you have it'. Closes the grounding cycle on the affirmative side.",
    negativeDefinition:
      'The parent offered no candidate understanding (so there is nothing to confirm), or the move corrects rather than confirms (rejects_candidate_understanding), or the move adds substantive new content.',
    positiveExamples: Object.freeze([
      "Parent: 'Do you mean libraries should be funded like roads?' Move: 'Yes, exactly.'",
      "Parent: 'Reading you as saying current AI capabilities are oversold?' Move: 'That is right.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'No, I mean...' (rejects_candidate_understanding)",
      "Move: 'Yes, and ALSO Y.' (extends_parent; goes beyond confirmation)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE without an actual candidate understanding in the parent.',
      'Do NOT mark TRUE for confirms-with-extension (those are extends_parent).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: confirmation closes a grounding cycle; repair-positive.',
      'Clark & Brennan: shared confirmation is the moment grounding is achieved.',
    ]),
    confidenceEligibility: REPAIR_TIMELINE_ELIGIBILITY,
  }),

  // NEW #3 rejects_candidate_understanding
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:rejects_candidate_understanding',
    rawKey: 'rejects_candidate_understanding',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Corrects candidate',
    shortLabel: 'Corrects',
    description: 'This move corrects the candidate understanding the parent offered.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 132,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move reject the candidate understanding offered by the parent and provide a corrected version?',
    positiveDefinition:
      "Parent offered candidate understanding ('do you mean X?'); the move rejects X and offers the correct paraphrase: 'no, I mean Y'. Symmetric counterpart to confirms_understanding.",
    negativeDefinition:
      'Parent offered no candidate understanding, the move confirms (confirms_understanding), or the move challenges substantively rather than correcting the paraphrase.',
    positiveExamples: Object.freeze([
      "Parent: 'Do you mean libraries are like roads?' Move: 'Not quite — I mean libraries are like public schools: collectively funded because individual market provision fails.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Yes, exactly.' (confirms_understanding)",
      "Move: 'I disagree with that whole framing.' (challenges_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE without a candidate understanding in the parent to reject.',
      'Do NOT confuse with disputes_interpretation — rejecting candidate understanding is repair-positive; interpretation dispute is adversarial.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: candidate-rejection-with-correction is repair-positive; symmetric to confirms_understanding.',
      'Clark & Brennan: rejection-plus-restatement opens a corrective grounding cycle.',
    ]),
    confidenceEligibility: REPAIR_TIMELINE_ELIGIBILITY,
  }),

  // NEW #4 requests_restatement
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:requests_restatement',
    rawKey: 'requests_restatement',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Asks for restatement',
    shortLabel: 'Restate?',
    description: 'This move asks the parent to restate their position.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 133,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move ask the parent's poster to restate their position (without asking for new content)?",
    positiveDefinition:
      "The move signals 'can you say that again?' / 'I lost the thread' / 'can you rephrase' — a request for restatement without substantive challenge or candidate understanding.",
    negativeDefinition:
      'The move asks for clarification (different — clarification is asking for definitional / scope precision; restatement is asking for rephrasing). The move offers a candidate understanding instead.',
    positiveExamples: Object.freeze([
      "Move: 'Could you say that again? I want to make sure I followed.'",
      "Move: 'Can you rephrase that?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What do you mean by infrastructure?' (requests_clarification on a specific term)",
      "Move: 'Are you saying libraries are like roads?' (offers_candidate_understanding)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for substantive clarification requests (those are requests_clarification).',
      'Do NOT mark TRUE for moves that paraphrase as part of the request.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: restatement request is a meta-level repair move; structural.',
      'Schegloff/Sacks: restatement request is one form of other-initiated repair.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #5 self_initiates_self_repair
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:self_initiates_self_repair',
    rawKey: 'self_initiates_self_repair',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Self-repair',
    shortLabel: 'Self-repair',
    description: 'The author self-initiates a correction or clarification of their own prior move.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 134,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move's author self-correct or self-clarify their own prior move, without being prompted to?",
    positiveDefinition:
      "The author posts a follow-up that corrects, clarifies, or refines their own earlier move. Schegloff/Sacks 'self-initiated self-repair'.",
    negativeDefinition:
      'The author is responding to a prompt (request for clarification / challenge / correction) from another participant — that is other-initiated repair (other_initiates_repair) or answers_clarification.',
    positiveExamples: Object.freeze([
      "Author posts: 'EVs reduce pollution 30%.' Then: 'Actually, correction — I meant 13% lifecycle; 30% was the tailpipe-only figure.'",
    ]),
    negativeExamples: Object.freeze([
      "Author posts claim. Responder asks 'what do you mean?'. Author clarifies. (answers_clarification, other-prompted)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE when the self-correction is prompted by a challenge or question — that is responsive, not self-initiated.',
      'Do NOT mark TRUE for elaboration without correction.',
    ]),
    doctrineNotes: Object.freeze([
      'Schegloff/Sacks: self-initiated self-repair is the preferred grounding pattern.',
      'cdiscourse-doctrine §10a: self-repair is engagement-positive; never a verdict on the original move.',
      'point-standing-economy: self-repair preserves engagement credit and proactively closes potential debt.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #6 other_initiates_repair
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:other_initiates_repair',
    rawKey: 'other_initiates_repair',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Other-initiated repair',
    shortLabel: 'Repair?',
    description: 'This move initiates repair of a prior move by a different participant.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 135,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move initiate repair on a prior move from a different participant (asking for clarification, correction, or restatement)?',
    positiveDefinition:
      "A participant other than the parent's author initiates repair: requests_clarification, requests_restatement, offers_candidate_understanding, flags_term_ambiguity, etc. Schegloff/Sacks 'other-initiated repair'.",
    negativeDefinition:
      'Self-initiated repair (self_initiates_self_repair) is the symmetric counterpart. Substantive disagreement is not repair (challenges_parent).',
    positiveExamples: Object.freeze([
      "Parent posted by A. Move by B: 'What do you mean by infrastructure?' (other-initiated repair)",
    ]),
    negativeExamples: Object.freeze([
      'Author A posts claim, then posts correction → self_initiates_self_repair.',
      "Move by B: 'I disagree with that whole claim.' → challenges_parent, not repair.",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for substantive disagreement.',
      'Do NOT mark TRUE for self-initiated repair (different participant required).',
    ]),
    doctrineNotes: Object.freeze([
      'Schegloff/Sacks: other-initiated repair is the default external prompt for self-clarification.',
      'cdiscourse-doctrine §10a: repair initiation is engagement-positive; never a verdict.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #7 acknowledges_misread
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:acknowledges_misread',
    rawKey: 'acknowledges_misread',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Acknowledges misread',
    shortLabel: 'Misread',
    description: 'This move acknowledges that the author misread the parent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 136,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move acknowledge that the author misread or misunderstood the parent (or a prior move), and offer a corrected reading?',
    positiveDefinition:
      "The move signals 'oh, I misread that' / 'I had you wrong' / 'sorry, I thought you meant X' and provides a corrected reading or revised response.",
    negativeDefinition:
      'The move continues responding to a misread without acknowledging, or challenges the parent on substance, or offers a candidate understanding without acknowledging prior misreading.',
    positiveExamples: Object.freeze([
      "Move: 'Oh — I read you as saying funding should be cut; you mean it should be restructured. Different question; let me think.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Funding should not be cut.' (responds to misread without acknowledging)",
      "Move: 'Are you saying funding should be cut?' (offers_candidate_understanding before checking)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that acknowledge a different participant's misread — this is about the author's own.",
      'Do NOT mark TRUE for moves that signal disagreement framed as "I had you wrong".',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: acknowledging misread is a high-signal grounding move; engagement-positive.',
      'Clark & Brennan: explicit acknowledgement of misread accelerates grounding.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #8 flags_ambiguous_reference
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:flags_ambiguous_reference',
    rawKey: 'flags_ambiguous_reference',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Flags ambiguous reference',
    shortLabel: 'Ref?',
    description: 'This move flags an ambiguous reference in the parent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 137,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move flag an ambiguous reference (pronoun, demonstrative, or referring expression) in the parent and ask which referent was meant?',
    positiveDefinition:
      "The parent contained an ambiguous reference ('this', 'they', 'it' with unclear antecedent). The move identifies the ambiguity and asks which referent the parent meant.",
    negativeDefinition:
      'The move asks for general clarification (requests_clarification), challenges the substance, or refers to a clearly-grounded antecedent.',
    positiveExamples: Object.freeze([
      "Parent (referring to libraries OR museums posted earlier): 'They will need additional funding.' Move: 'When you say they — libraries, museums, or both?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What do you mean?' (requests_clarification, not specifically reference)",
      "Move: 'Libraries do not need more funding.' (challenges substance)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for clearly-grounded references that one could argue about.',
      'Do NOT confuse with Family H unclear_reference_present — that is the structural fact in the parent; this is the move that flags it.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: reference-ambiguity flag is repair-positive structural move.',
      'Schegloff/Sacks: reference repair is a specific subtype of other-initiated repair.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #9 flags_term_ambiguity
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:flags_term_ambiguity',
    rawKey: 'flags_term_ambiguity',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Flags term ambiguity',
    shortLabel: 'Term?',
    description: 'This move flags an ambiguous term in the parent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 138,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move flag a specific term in the parent as ambiguous (more than one meaning) and ask which meaning was intended?',
    positiveDefinition:
      "The move identifies an ambiguous term ('infrastructure', 'efficiency', 'works') and notes the term could mean A, B, or C, then asks which the parent meant. More specific than requests_clarification.",
    negativeDefinition:
      "The move asks for general clarification, requests a definition without naming the ambiguity, or disputes the term's definition (disputes_definition).",
    positiveExamples: Object.freeze([
      "Parent: 'Libraries work for cities.' Move: 'Work could mean cost-effective, effective for outcomes, or politically popular — which do you mean?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What do you mean?' (requests_clarification, no term identified)",
      "Move: 'You should not define work that loosely.' (disputes_definition)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for general clarification without identifying the ambiguous term.',
      'Do NOT confuse with disputes_definition — flagging is collaborative; disputing is adversarial.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: term-ambiguity flagging is structural repair-positive.',
      'Clark & Brennan: lexical grounding is a sub-form of overall grounding.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #10 proposes_shared_definition
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:proposes_shared_definition',
    rawKey: 'proposes_shared_definition',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Proposes shared definition',
    shortLabel: 'Def?',
    description: 'This move proposes a shared definition for a term.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 139,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move propose a shared definition for a term in dispute, asking the parent to accept or modify the proposal?',
    positiveDefinition:
      "The move offers a specific definition with the framing 'could we use this definition?' or 'let me propose X means Y for purposes of this discussion'. Collaborative grounding move.",
    negativeDefinition:
      'The move asserts a definition without inviting acceptance (disputes_definition or challenges_parent), or asks for a definition (requests_clarification), or flags ambiguity without proposing (flags_term_ambiguity).',
    positiveExamples: Object.freeze([
      "Move: 'Could we agree to use infrastructure to mean publicly-funded shared physical assets — that would let us focus the disagreement on whether libraries fit?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Infrastructure means publicly funded shared assets. Full stop.' (asserts, does not propose)",
      "Move: 'What do you mean by infrastructure?' (requests_clarification)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that assert a definition without inviting modification.',
      "Do NOT confuse with refines_parent — refinement narrows the parent's claim; shared-definition proposal proposes a working definition for the discussion.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: shared-definition proposal is repair-positive collaborative grounding.',
      'Clark & Brennan: shared definitions accelerate grounding; especially valuable in cross-domain discussions.',
    ]),
    confidenceEligibility: REPAIR_TIMELINE_ELIGIBILITY,
  }),

  // NEW #11 confirms_shared_definition
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:confirms_shared_definition',
    rawKey: 'confirms_shared_definition',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Confirms shared definition',
    shortLabel: 'Def OK',
    description: 'This move accepts a shared definition proposed earlier.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 140,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move accept a shared definition that was proposed earlier, sealing the grounding agreement?',
    positiveDefinition:
      "Parent (or earlier move) proposed a shared definition. The move confirms the definition for purposes of the discussion: 'works for me'; 'I can work with that'; 'agreed'.",
    negativeDefinition:
      'The move accepts with modifications (proposes_shared_definition counterproposal), rejects, or ignores the definition proposal.',
    positiveExamples: Object.freeze([
      "Parent: 'Could we use infrastructure to mean publicly-funded shared assets?' Move: 'Works for me — let us proceed with that.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Close — could we tighten it to publicly-FUNDED and publicly-OWNED?' (counterproposal)",
      "Move: 'No, definition should include private-public partnerships.' (rejects)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that modify the definition (that is a counterproposal).',
      'Do NOT mark TRUE without an actual definition proposal in the parent or earlier move.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: shared-definition confirmation closes a grounding cycle.',
      'Clark & Brennan: shared agreement on terms is a foundational form of grounding.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #12 scope_mismatch_identified
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:scope_mismatch_identified',
    rawKey: 'scope_mismatch_identified',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Scope mismatch',
    shortLabel: 'Scope?',
    description: 'This move identifies a scope mismatch between participants.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 141,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move identify that the participants are talking about different scopes (e.g., 'I am talking about X cases; you are talking about Y cases') and propose resolving the mismatch?",
    positiveDefinition:
      "The move recognizes that the disagreement is partly a scope mismatch and surfaces the mismatch: 'I think we are talking about different time windows'; 'you are talking about urban; I am talking about national'. Repair-flavored, NOT adversarial.",
    negativeDefinition:
      'The move disputes scope adversarially (disputes_scope, Family B), refines scope on one side (refines_parent), or argues within a single scope.',
    positiveExamples: Object.freeze([
      "Move: 'I think we are at cross-purposes — I have been talking about urban EV emissions; you have been talking about lifecycle emissions. Both real, different scopes.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Tailpipe scope is not the right scope.' (disputes_scope, adversarial)",
      "Move: 'Specifically, urban tailpipe drops 40%.' (refines_parent on one scope)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with disputes_scope — mismatch identification is collaborative; scope dispute is adversarial.',
      'Do NOT mark TRUE for moves that argue within a single scope.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: scope-mismatch identification is repair-positive structural move.',
      'point-standing-economy: identifying a scope mismatch often unsticks stalled disputes; earns engagement credit for both sides.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // NEW #13 question_answer_mismatch
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:question_answer_mismatch',
    rawKey: 'question_answer_mismatch',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Q-A mismatch',
    shortLabel: 'Q-A?',
    description: "This move notes that the parent's response did not match the question asked.",
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 142,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move identify that a prior answer did not actually address the question that was asked, and ask for the question to be addressed?',
    positiveDefinition:
      "The move points out a Q-A mismatch: 'the question was X but your answer was about Y'; 'you addressed scope but I was asking about magnitude'. Repair-flavored, asks for the actual question to be answered.",
    negativeDefinition:
      "The move accepts the answer and asks a follow-up question, or challenges the answer's substance (challenges_parent), or asks a new question (questions_parent).",
    positiveExamples: Object.freeze([
      "Earlier exchange: 'How much did emissions drop?' Reply: 'Emissions dropped in many places.' Move: 'The question was how much — could you say what the magnitude was?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The 10% figure you cited is from one study; what about the others?' (follow-up question)",
      "Move: 'I disagree that emissions dropped at all.' (challenges_parent)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for follow-up questions on accepted answers.',
      "Do NOT mark TRUE for adversarial challenges framed as 'you did not answer'.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: Q-A mismatch surfacing is repair-positive.',
      'Schegloff/Sacks: Q-A mismatch is a specific repair pattern that prevents the conversation from drifting.',
    ]),
    confidenceEligibility: REPAIR_INSPECT_ELIGIBILITY,
  }),

  // ── MCP-BUILD2c (misunderstanding_repair expansion) ───────────────────
  // Three Build-2c booleans per the Build-2 manifest §2. These describe
  // qualities of the misunderstanding-repair MOVE — whether it proposes a
  // concrete resolution PATH (not just flags confusion), whether it names the
  // specific SOURCE of an ambiguity (which term/reference and why), and whether
  // it ACCEPTS a correction a prior move offered. All Inspect-only; none are
  // verdicts. accepts_correction is verdict-adjacent and is fenced
  // "repair-not-defeat" with extra falsePositiveGuards (describes the repair
  // MOVE, never the author, never a defeat/concession of the whole). Its label
  // contains the substring "correct"; the verdict-free ban-list test uses
  // word-boundary / phrase matching, never bare-substring "correct".

  // BUILD2c #1 offers_repair_path (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:offers_repair_path',
    rawKey: 'offers_repair_path',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Offers a way to resolve',
    shortLabel: 'Repair path',
    description: 'This move proposes a concrete way to resolve a misunderstanding.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 143,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move propose a concrete way to resolve a misunderstanding (a path, not just a flag)?',
    positiveDefinition:
      "The move proposes a CONCRETE resolution mechanism — sequencing the disagreement, separating two claims, tagging each use of a term, reframing where the participants actually differ — so the misunderstanding can be worked through. It goes beyond flagging that confusion exists; it offers a path forward.",
    negativeDefinition:
      "The move only flags confusion (requests_clarification), restates without proposing a resolution path, or merely expresses willingness to resolve without naming a concrete mechanism. Proposing a specific shared DEFINITION is the narrower proposes_shared_definition; offers_repair_path is broader (sequencing, separating, reframing the disagreement).",
    positiveExamples: Object.freeze([
      "Move: 'Let's separate the cost claim from the equity claim and take them one at a time.'",
      "Move: 'I think we're using \\'infrastructure\\' two ways — if we tag each use, we can see where we actually differ.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'I don't follow.' (requests_clarification, flags confusion only)",
      "Move: 'What did you mean?' (requests_clarification, no resolution path)",
    ]),
    falsePositiveGuards: Object.freeze([
      'The move must propose a CONCRETE resolution mechanism, not merely express willingness to resolve; do NOT mark on a bare "let us sort this out" with no mechanism named.',
      'Distinguish from proposes_shared_definition (definition-specific) — repair_path is broader: sequencing, separating, or reframing the disagreement.',
      'This observation describes the MOVE, never the author; the absence of a repair path is not a criticism of the author.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural / procedural observation about the MOVE; describes a constructive move shape, never a verdict.',
      'point-standing-economy: offering a repair path is a recovery-positive move that can convert a stalled disagreement into productive narrowing; earns engagement credit for both sides.',
    ]),
    confidenceEligibility: BUILD2C_INSPECT_ELIGIBILITY,
  }),

  // BUILD2c #2 names_ambiguity_source (Inspect-only)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:names_ambiguity_source',
    rawKey: 'names_ambiguity_source',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Names the ambiguity',
    shortLabel: 'Ambiguity source',
    description: 'This move names the specific source of an ambiguity and why it is unclear.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 144,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move name the specific source of an ambiguity (which term / reference is unclear and why)?',
    positiveDefinition:
      "The move identifies the SPECIFIC term or reference that is ambiguous AND why — typically by surfacing the two readings that are talking past each other. Sharper than flags_ambiguous_reference / flags_term_ambiguity (which flag THAT something is ambiguous); this names WHAT and WHY.",
    negativeDefinition:
      "The move flags ambiguity without identifying its source ('this is confusing'), asks for clarification, or restates. A bare 'ambiguous' flag with no named source is flags_term_ambiguity, not this.",
    positiveExamples: Object.freeze([
      "Move: 'The ambiguity is in \\'works\\' — you mean reduces emissions, I read it as politically durable.'",
      "Move: 'The word \\'fair\\' is doing two jobs here: procedural fairness and outcome fairness.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'This is ambiguous.' (flags_term_ambiguity, no source named)",
      "Move: 'Can you rephrase?' (requests_restatement)",
    ]),
    falsePositiveGuards: Object.freeze([
      'The move must NAME the specific term / reference AND why it is ambiguous; do NOT mark on a bare "ambiguous" flag with no named source.',
      'Both flags_term_ambiguity and names_ambiguity_source can co-fire (the flag + the naming); names_ambiguity_source is the sharper structural fact that the source was identified.',
      'This observation describes the text, not the author\'s competence; naming an ambiguity source never implies the author wrote carelessly.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: diagnostic-structural observation; "ambiguity source" describes the TEXT, not the author.',
      'Clark & Brennan: naming the source of an ambiguity is a high-signal grounding move that opens shared understanding.',
    ]),
    confidenceEligibility: BUILD2C_INSPECT_ELIGIBILITY,
  }),

  // BUILD2c #3 accepts_correction (Inspect-only; VERDICT-ADJACENT)
  Object.freeze({
    id: 'registry:machine_observation:ai_classifier:accepts_correction',
    rawKey: 'accepts_correction',
    kind: 'machine_observation',
    source: 'ai_classifier',
    family: 'misunderstanding_repair',
    label: 'Takes up an offered point',
    shortLabel: 'Takes up a point',
    description: 'This move takes up a point a prior move offered.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 145,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move accept a correction that a prior move offered?',
    positiveDefinition:
      "A prior move offered a correction (a substitute figure, date, attribution, source, or reading). This move TAKES UP that offered point and folds it into its own response — 'fair, I had the date wrong, it is 2020'; 'accepted, my source was secondary, yours is primary'. It is a repair move that adopts a point a prior move offered.",
    negativeDefinition:
      "The move rejects the offered point ('no, my number is right'), ignores it ('anyway, as I was saying…'), or there was no prior correction to take up. Generic agreement with the parent (acknowledges_parent) is NOT taking up an offered correction.",
    positiveExamples: Object.freeze([
      "Move: 'Fair — I had the date wrong, it is 2020.'",
      "Move: 'Accepted; my source was secondary, yours is primary — I will use yours.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'No, my number is right.' (rejects the offered point — does not take it up)",
      "Move: 'Anyway, as I was saying…' (ignores the offered point)",
    ]),
    falsePositiveGuards: Object.freeze([
      'This observation describes the repair MOVE, never the author; it describes taking up a point a prior move offered, and never frames it as defeat or concession of the whole. The author has not "lost"; a repair is a scoring repair, not a defeat.',
      'There must be an identifiable prior correction the move takes up; do NOT mark generic agreement (acknowledges_parent) as taking up a correction.',
      'Do NOT treat the ABSENCE of this observation as a criticism: a move that does not take up an offered point is perfectly valid and simply does not trip this flag. Absence means "not observed", never "the author was stubborn".',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: this is a MACHINE OBSERVATION about the MOVE; display-only, never a verdict that the author was wrong or conceded a loss.',
      'cdiscourse-doctrine §1: concession is a scoring REPAIR, not a defeat. Taking up an offered point lifts the exchange; the copy describes the repair move ("takes up a point a prior move offered"), never a defeat/concession-of-the-whole. The label contains the substring "correct" only via the rawKey; the user-facing label / diagnostic avoid the standalone verdict token "correct".',
      'point-standing-economy: a repair that takes up an offered point earns recovery credit for the responder AND pressure credit for the prior move; it is recovery-positive, never a loss.',
    ]),
    confidenceEligibility: BUILD2C_INSPECT_ELIGIBILITY,
  }),
]);
