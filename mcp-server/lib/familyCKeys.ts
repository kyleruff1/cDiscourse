/**
 * MCP-SERVER-004-FAMILY-C — Family C (misunderstanding_repair) 17-key constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family C registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyC.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyCKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * The 17 rawKeys are the binding contract per MCP-SERVER-004-FAMILY-C intent
 * brief §3. Verbatim, in declaration order:
 *
 *   1.  clarified (RETROACTIVE; lifecycle source — tree-dependent)
 *   2.  requests_clarification (RETROACTIVE; ai_classifier)
 *   3.  answers_clarification (RETROACTIVE; ai_classifier)
 *   4.  provides_alternate_interpretation (RETROACTIVE; ai_classifier)
 *   5.  offers_candidate_understanding (NEW; ai_classifier; HIGH-SIGNAL Clark & Brennan)
 *   6.  confirms_understanding (NEW; ai_classifier)
 *   7.  rejects_candidate_understanding (NEW; ai_classifier; DOCTRINE RISK — not "wrong")
 *   8.  requests_restatement (NEW; ai_classifier)
 *   9.  self_initiates_self_repair (NEW; ai_classifier)
 *   10. other_initiates_repair (NEW; ai_classifier)
 *   11. acknowledges_misread (NEW; ai_classifier; DOCTRINE RISK — not author-fault)
 *   12. flags_ambiguous_reference (NEW; ai_classifier)
 *   13. flags_term_ambiguity (NEW; ai_classifier; DOCTRINE RISK — not "lazy writing")
 *   14. proposes_shared_definition (NEW; ai_classifier)
 *   15. confirms_shared_definition (NEW; ai_classifier)
 *   16. scope_mismatch_identified (NEW; ai_classifier)
 *   17. question_answer_mismatch (NEW; ai_classifier)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict.
 *   - cdiscourse-doctrine §1 — definitions / examples / false-positive
 *     guards never imply that misunderstanding is a failure on either side.
 *     Repair is collaborative grounding work; both sides remain valid
 *     contributors to the discussion.
 *   - Schegloff/Sacks repair model — self-initiated vs other-initiated
 *     repair as the foundational pattern.
 *   - Clark & Brennan grounding doctrine — candidate-understanding +
 *     confirms are the high-signal grounding moves.
 *   - point-standing-economy — repair moves earn engagement credit and
 *     can convert future disagreement into productive narrowing.
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family A/B pattern.
 */

/**
 * The 17 Family C rawKeys, frozen in declaration order. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in both source
 *     files as a string literal)
 */
export const FAMILY_C_RAW_KEYS: readonly string[] = Object.freeze([
  'clarified',
  'requests_clarification',
  'answers_clarification',
  'provides_alternate_interpretation',
  'offers_candidate_understanding',
  'confirms_understanding',
  'rejects_candidate_understanding',
  'requests_restatement',
  'self_initiates_self_repair',
  'other_initiates_repair',
  'acknowledges_misread',
  'flags_ambiguous_reference',
  'flags_term_ambiguity',
  'proposes_shared_definition',
  'confirms_shared_definition',
  'scope_mismatch_identified',
  'question_answer_mismatch',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_C_CLASSIFIER_SET_VERSION = 'family-c-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence.
 */
export interface FamilyCPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_C_PROMPT_ENTRIES: readonly FamilyCPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'clarified',
    label: 'Clarified',
    booleanQuestion:
      'Is this cluster in the "clarified" lifecycle state — a clarification request was answered with a clarifying response?',
    positiveDefinition:
      'A lifecycle state where the cluster contains a clarification request and at least one clarifying response (answers_clarification or equivalent repair move).',
    negativeDefinition:
      'The cluster has no clarification request, or the request is open with no answer, or the request was answered with a non-clarifying move.',
    positiveExample:
      'Cluster sequence: claim → clarification request → clarifying response → clarified state.',
    negativeExample:
      'Cluster with no clarification request → never enters clarified. Cluster with open clarification request, no response → still in requested state.',
    falsePositiveGuards:
      "Do NOT mark TRUE based on cosmetic tone — the lifecycle transition requires an actual clarifying response. Do NOT confuse with answers_clarification (the move-level fact) — clarified is the cluster-level state. Lifecycle key: when you only see the move text and not the full cluster, answer FALSE with low confidence.",
  }),
  Object.freeze({
    rawKey: 'requests_clarification',
    label: 'Clarification asked',
    booleanQuestion:
      "Does this move ask the parent's poster to clarify a term, claim, scope, or reasoning step?",
    positiveDefinition:
      "The move poses a question seeking a restatement, definition, scope, or elaboration. 'What do you mean by X?'; 'how broad is this claim?'; 'do you mean the 2020 or 2024 data?'. Pure clarification — no challenge attached.",
    negativeDefinition:
      "The move offers a candidate understanding (offers_candidate_understanding), challenges packaged as a question (challenges_parent), or asks for evidence (asks_for_evidence, Family D).",
    positiveExample:
      "Parent: 'Libraries are infrastructure.' Move: 'What do you mean by infrastructure here?'",
    negativeExample:
      "Move: 'Do you mean libraries are public goods that should be funded like roads?' (offers_candidate_understanding)",
    falsePositiveGuards:
      "Do NOT confuse with offers_candidate_understanding — clarification request poses a question; candidate understanding offers a paraphrase. Do NOT mark TRUE for rhetorical questions. A clarification request is repair-positive collaborative grounding work; it does NOT imply the parent was unclear or wrong.",
  }),
  Object.freeze({
    rawKey: 'answers_clarification',
    label: 'Clarification answered',
    booleanQuestion:
      'Does this move provide a substantive answer to a clarification request from the parent?',
    positiveDefinition:
      'The move responds to a clarification request with a substantive answer: a definition, a scope, an elaboration, a restatement. Closes the clarification cycle.',
    negativeDefinition:
      'The move evades the question, offers a counter-question, or responds with new content unrelated to the clarification.',
    positiveExample:
      "Parent (asks): 'What do you mean by infrastructure?' Move: 'I mean public goods funded collectively — like roads, libraries, parks.'",
    negativeExample:
      "Move: 'Why do you need that defined?' (counter-question, no answer)",
    falsePositiveGuards:
      'Do NOT mark TRUE for partial answers that evade the substance. Do NOT mark TRUE for counter-questions. Answering a clarification request is repair-positive and earns engagement credit for the responder.',
  }),
  Object.freeze({
    rawKey: 'provides_alternate_interpretation',
    label: 'Alternate reading',
    booleanQuestion:
      "Does this move offer an alternate interpretation of the parent (or a prior move's) text or evidence, framed collaboratively rather than adversarially?",
    positiveDefinition:
      "The move offers a different reading of the parent's text / evidence, inviting consideration rather than disputing. 'Could it also mean Y?'; 'another reading is Z; what do you think?'. Collaborative.",
    negativeDefinition:
      "The move disputes the interpretation directly (disputes_interpretation, Family B), offers a counter-claim without inviting consideration, or asks a pure clarification.",
    positiveExample:
      "Parent: 'The 2020 employment data shows the policy worked.' Move: 'Could the data also mean the gains were concentrated in a specific group?'",
    negativeExample:
      "Move: 'The same data shows the gains were concentrated in the top quintile — your reading is wrong.' (disputes_interpretation, adversarial)",
    falsePositiveGuards:
      "Do NOT confuse with disputes_interpretation (Family B) — collaborative vs adversarial framing distinguishes. Do NOT mark TRUE for moves that offer an alternative without inviting consideration. Offering an alternate reading opens shared interpretation space; it is structural collaborative work, not a verdict.",
  }),
  Object.freeze({
    rawKey: 'offers_candidate_understanding',
    label: 'Offers candidate understanding',
    booleanQuestion:
      "Does this move offer a paraphrase of the parent's claim and ask the parent's poster to confirm or correct that paraphrase?",
    positiveDefinition:
      "The move restates the parent's claim in its own words (a 'candidate understanding') AND signals openness to correction. The move signals 'do you mean X?' explicitly OR via paraphrase + invitation to correct.",
    negativeDefinition:
      "The move quotes the parent verbatim without paraphrasing, OR paraphrases without inviting correction, OR asks for clarification without offering a candidate. Pure question ('what do you mean?') is requests_clarification, not this.",
    positiveExample:
      "Parent: 'Libraries are infrastructure.' Move: 'Are you saying libraries are public goods that should be funded like roads?'",
    negativeExample:
      "Parent: 'AI is overhyped.' Move: 'AI is not overhyped.' (disagrees; no candidate offered)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that paraphrase without an invitation to correct. Do NOT mark TRUE for moves whose paraphrase substantially changes the parent's meaning (that would be misrepresentation). Offering a candidate understanding is the high-signal grounding move per Clark & Brennan; engagement-positive for the responder.",
  }),
  Object.freeze({
    rawKey: 'confirms_understanding',
    label: 'Confirms candidate',
    booleanQuestion:
      'Does this move confirm a candidate understanding that the parent offered, sealing the grounding cycle?',
    positiveDefinition:
      "The parent offered a candidate understanding ('do you mean X?'). The move confirms: 'yes, that is right'; 'exactly'; 'you have it'. Closes the grounding cycle on the affirmative side.",
    negativeDefinition:
      'The parent offered no candidate understanding (so there is nothing to confirm), or the move corrects rather than confirms (rejects_candidate_understanding), or the move adds substantive new content.',
    positiveExample:
      "Parent: 'Do you mean libraries should be funded like roads?' Move: 'Yes, exactly.'",
    negativeExample:
      "Move: 'No, I mean...' (rejects_candidate_understanding)",
    falsePositiveGuards:
      'Do NOT mark TRUE without an actual candidate understanding in the parent. Do NOT mark TRUE for confirms-with-extension (those are extends_parent). Confirmation closes a grounding cycle; repair-positive.',
  }),
  Object.freeze({
    rawKey: 'rejects_candidate_understanding',
    label: 'Corrects candidate',
    booleanQuestion:
      'Does this move reject the candidate understanding offered by the parent and provide a corrected version?',
    positiveDefinition:
      "Parent offered candidate understanding ('do you mean X?'); the move rejects X and offers the corrected paraphrase: 'no, I mean Y'. Symmetric counterpart to confirms_understanding.",
    negativeDefinition:
      'Parent offered no candidate understanding, the move confirms (confirms_understanding), or the move challenges substantively rather than correcting the paraphrase.',
    positiveExample:
      "Parent: 'Do you mean libraries are like roads?' Move: 'Not quite — I mean libraries are like public schools: collectively funded because individual market provision fails.'",
    negativeExample:
      "Move: 'Yes, exactly.' (confirms_understanding)",
    falsePositiveGuards:
      "Do NOT mark TRUE without a candidate understanding in the parent to reject. Do NOT confuse with disputes_interpretation — rejecting candidate understanding is repair-positive; interpretation dispute is adversarial. Doctrine note: a rejection of a candidate understanding is the rejector saying 'that is not what I meant,' not 'you are wrong.' It is symmetric to confirms_understanding.",
  }),
  Object.freeze({
    rawKey: 'requests_restatement',
    label: 'Asks for restatement',
    booleanQuestion:
      "Does this move ask the parent's poster to restate their position (without asking for new content)?",
    positiveDefinition:
      "The move signals 'can you say that again?' / 'I lost the thread' / 'can you rephrase' — a request for restatement without substantive challenge or candidate understanding.",
    negativeDefinition:
      'The move asks for clarification (different — clarification is asking for definitional / scope precision; restatement is asking for rephrasing). The move offers a candidate understanding instead.',
    positiveExample:
      "Move: 'Could you say that again? I want to make sure I followed.'",
    negativeExample:
      "Move: 'What do you mean by infrastructure?' (requests_clarification on a specific term)",
    falsePositiveGuards:
      'Do NOT mark TRUE for substantive clarification requests (those are requests_clarification). Do NOT mark TRUE for moves that paraphrase as part of the request. Restatement requests are repair-positive meta-level grounding moves.',
  }),
  Object.freeze({
    rawKey: 'self_initiates_self_repair',
    label: 'Self-repair',
    booleanQuestion:
      "Does this move's author self-correct or self-clarify their own prior move, without being prompted to?",
    positiveDefinition:
      "The author posts a follow-up that corrects, clarifies, or refines their own earlier move. Schegloff/Sacks 'self-initiated self-repair'.",
    negativeDefinition:
      'The author is responding to a prompt (request for clarification / challenge / correction) from another participant — that is other-initiated repair (other_initiates_repair) or answers_clarification.',
    positiveExample:
      "Author posts: 'EVs reduce pollution 30%.' Then: 'Actually, correction — I meant 13% lifecycle; 30% was the tailpipe-only figure.'",
    negativeExample:
      "Author posts claim. Responder asks 'what do you mean?'. Author clarifies. (answers_clarification, other-prompted)",
    falsePositiveGuards:
      'Do NOT mark TRUE when the self-correction is prompted by a challenge or question — that is responsive, not self-initiated. Do NOT mark TRUE for elaboration without correction. Self-repair is engagement-positive and preserves engagement credit by proactively closing potential debt.',
  }),
  Object.freeze({
    rawKey: 'other_initiates_repair',
    label: 'Other-initiated repair',
    booleanQuestion:
      'Does this move initiate repair on a prior move from a different participant (asking for clarification, correction, or restatement)?',
    positiveDefinition:
      "A participant other than the parent's author initiates repair: requests_clarification, requests_restatement, offers_candidate_understanding, flags_term_ambiguity, etc. Schegloff/Sacks 'other-initiated repair'.",
    negativeDefinition:
      'Self-initiated repair (self_initiates_self_repair) is the symmetric counterpart. Substantive disagreement is not repair (challenges_parent).',
    positiveExample:
      "Parent posted by A. Move by B: 'What do you mean by infrastructure?' (other-initiated repair)",
    negativeExample:
      'Author A posts claim, then posts correction → self_initiates_self_repair.',
    falsePositiveGuards:
      'Do NOT mark TRUE for substantive disagreement. Do NOT mark TRUE for self-initiated repair (different participant required). Repair initiation is engagement-positive collaborative grounding work; never a verdict on either participant.',
  }),
  Object.freeze({
    rawKey: 'acknowledges_misread',
    label: 'Acknowledges misread',
    booleanQuestion:
      'Does this move acknowledge that the author misread or misunderstood the parent (or a prior move), and offer a corrected reading?',
    positiveDefinition:
      "The move signals 'oh, I misread that' / 'I had you wrong' / 'sorry, I thought you meant X' and provides a corrected reading or revised response.",
    negativeDefinition:
      'The move continues responding to a misread without acknowledging, or challenges the parent on substance, or offers a candidate understanding without acknowledging prior misreading.',
    positiveExample:
      "Move: 'Oh — I read you as saying funding should be cut; you mean it should be restructured. Different question; let me think.'",
    negativeExample:
      "Move: 'Funding should not be cut.' (responds to misread without acknowledging)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that acknowledge a different participant's misread — this is about the author's own. Do NOT mark TRUE for moves that signal disagreement framed as 'I had you wrong'. Doctrine note: acknowledging a misread is constructive repair work, not a verdict on the original author. Per point-standing-economy, acknowledging a misread is engagement-positive for the acknowledger and never reflects negatively on the original author.",
  }),
  Object.freeze({
    rawKey: 'flags_ambiguous_reference',
    label: 'Flags ambiguous reference',
    booleanQuestion:
      'Does this move flag an ambiguous reference (pronoun, demonstrative, or referring expression) in the parent and ask which referent was meant?',
    positiveDefinition:
      "The parent contained an ambiguous reference ('this', 'they', 'it' with unclear antecedent). The move identifies the ambiguity and asks which referent the parent meant.",
    negativeDefinition:
      'The move asks for general clarification (requests_clarification), challenges the substance, or refers to a clearly-grounded antecedent.',
    positiveExample:
      "Parent (referring to libraries OR museums posted earlier): 'They will need additional funding.' Move: 'When you say they — libraries, museums, or both?'",
    negativeExample:
      "Move: 'What do you mean?' (requests_clarification, not specifically reference)",
    falsePositiveGuards:
      'Do NOT mark TRUE for clearly-grounded references that one could argue about. Do NOT confuse with Family H unclear_reference_present — that is the structural fact in the parent; this is the move that flags it. Reference-ambiguity flagging is repair-positive collaborative grounding work.',
  }),
  Object.freeze({
    rawKey: 'flags_term_ambiguity',
    label: 'Flags term ambiguity',
    booleanQuestion:
      'Does this move flag a specific term in the parent as ambiguous (more than one meaning) and ask which meaning was intended?',
    positiveDefinition:
      "The move identifies an ambiguous term ('infrastructure', 'efficiency', 'works') and notes the term could mean A, B, or C, then asks which the parent meant. More specific than requests_clarification.",
    negativeDefinition:
      "The move asks for general clarification, requests a definition without naming the ambiguity, or disputes the term's definition (disputes_definition).",
    positiveExample:
      "Parent: 'Libraries work for cities.' Move: 'Work could mean cost-effective, effective for outcomes, or politically popular — which do you mean?'",
    negativeExample:
      "Move: 'What do you mean?' (requests_clarification, no term identified)",
    falsePositiveGuards:
      "Do NOT mark TRUE for general clarification without identifying the ambiguous term. Do NOT confuse with disputes_definition — flagging is collaborative; disputing is adversarial. Doctrine note: flagging an ambiguous term opens shared understanding; it does NOT accuse the parent author of writing ambiguously or imprecisely. Both participants benefit from the shared definition that emerges.",
  }),
  Object.freeze({
    rawKey: 'proposes_shared_definition',
    label: 'Proposes shared definition',
    booleanQuestion:
      'Does this move propose a shared definition for a term in dispute, asking the parent to accept or modify the proposal?',
    positiveDefinition:
      "The move offers a specific definition with the framing 'could we use this definition?' or 'let me propose X means Y for purposes of this discussion'. Collaborative grounding move.",
    negativeDefinition:
      'The move asserts a definition without inviting acceptance (disputes_definition or challenges_parent), or asks for a definition (requests_clarification), or flags ambiguity without proposing (flags_term_ambiguity).',
    positiveExample:
      "Move: 'Could we agree to use infrastructure to mean publicly-funded shared physical assets — that would let us focus the disagreement on whether libraries fit?'",
    negativeExample:
      "Move: 'Infrastructure means publicly funded shared assets. Full stop.' (asserts, does not propose)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that assert a definition without inviting modification. Do NOT confuse with refines_parent — refinement narrows the parent's claim; shared-definition proposal proposes a working definition for the discussion. Shared-definition proposals are repair-positive collaborative grounding.",
  }),
  Object.freeze({
    rawKey: 'confirms_shared_definition',
    label: 'Confirms shared definition',
    booleanQuestion:
      'Does this move accept a shared definition that was proposed earlier, sealing the grounding agreement?',
    positiveDefinition:
      "Parent (or earlier move) proposed a shared definition. The move confirms the definition for purposes of the discussion: 'works for me'; 'I can work with that'; 'agreed'.",
    negativeDefinition:
      'The move accepts with modifications (proposes_shared_definition counterproposal), rejects, or ignores the definition proposal.',
    positiveExample:
      "Parent: 'Could we use infrastructure to mean publicly-funded shared assets?' Move: 'Works for me — let us proceed with that.'",
    negativeExample:
      "Move: 'Close — could we tighten it to publicly-FUNDED and publicly-OWNED?' (counterproposal)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that modify the definition (that is a counterproposal). Do NOT mark TRUE without an actual definition proposal in the parent or earlier move. Shared-definition confirmation closes a grounding cycle.',
  }),
  Object.freeze({
    rawKey: 'scope_mismatch_identified',
    label: 'Scope mismatch',
    booleanQuestion:
      "Does this move identify that the participants are talking about different scopes (e.g., 'I am talking about X cases; you are talking about Y cases') and propose resolving the mismatch?",
    positiveDefinition:
      "The move recognizes that the disagreement is partly a scope mismatch and surfaces the mismatch: 'I think we are talking about different time windows'; 'you are talking about urban; I am talking about national'. Repair-flavored, NOT adversarial.",
    negativeDefinition:
      'The move disputes scope adversarially (disputes_scope, Family B), refines scope on one side (refines_parent), or argues within a single scope.',
    positiveExample:
      "Move: 'I think we are at cross-purposes — I have been talking about urban EV emissions; you have been talking about lifecycle emissions. Both real, different scopes.'",
    negativeExample:
      "Move: 'Tailpipe scope is not the right scope.' (disputes_scope, adversarial)",
    falsePositiveGuards:
      'Do NOT confuse with disputes_scope — mismatch identification is collaborative; scope dispute is adversarial. Do NOT mark TRUE for moves that argue within a single scope. Scope-mismatch identification is descriptive — both participants may be operating at different scopes, which is a structural fact, not a fault on either side.',
  }),
  Object.freeze({
    rawKey: 'question_answer_mismatch',
    label: 'Q-A mismatch',
    booleanQuestion:
      'Does this move identify that a prior answer did not actually address the question that was asked, and ask for the question to be addressed?',
    positiveDefinition:
      "The move points out a Q-A mismatch: 'the question was X but your answer was about Y'; 'you addressed scope but I was asking about magnitude'. Repair-flavored, asks for the actual question to be answered.",
    negativeDefinition:
      "The move accepts the answer and asks a follow-up question, or challenges the answer's substance (challenges_parent), or asks a new question (questions_parent).",
    positiveExample:
      "Earlier exchange: 'How much did emissions drop?' Reply: 'Emissions dropped in many places.' Move: 'The question was how much — could you say what the magnitude was?'",
    negativeExample:
      "Move: 'The 10% figure you cited is from one study; what about the others?' (follow-up question)",
    falsePositiveGuards:
      "Do NOT mark TRUE for follow-up questions on accepted answers. Do NOT mark TRUE for adversarial challenges framed as 'you did not answer'. Q-A mismatch surfacing is repair-positive; prevents the conversation from drifting.",
  }),
]);
