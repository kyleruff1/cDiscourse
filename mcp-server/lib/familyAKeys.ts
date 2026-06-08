/**
 * MCP-SERVER-002 + MCP-BUILD2b — Family A (parent_relation) 19-key constant +
 * prompt entries.
 *
 * Server-side MIRROR of the upstream Family A registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyAKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * The 19 rawKeys are the binding contract (16 MCP-SERVER-002 intent brief
 * Decision 1 + 3 MCP-BUILD2b Build-2 manifest §1). Verbatim, in declaration
 * order:
 *
 *   1.  supports_parent
 *   2.  challenges_parent
 *   3.  refines_parent
 *   4.  extends_parent
 *   5.  distinguishes_parent
 *   6.  reframes_parent
 *   7.  questions_parent
 *   8.  summarizes_parent
 *   9.  acknowledges_parent
 *   10. corrects_parent_detail
 *   11. contrasts_with_parent
 *   12. answers_parent_question
 *   13. has_rebuttal
 *   14. has_counter_rebuttal
 *   15. rebutted
 *   16. quote_anchors_parent
 *   17. acknowledges_parent_strength (MCP-BUILD2b; VERDICT-ADJACENT)
 *   18. compares_parent_to_sibling_branch (MCP-BUILD2b)
 *   19. identifies_parent_scope_limit (MCP-BUILD2b)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict.
 *   - cdiscourse-doctrine §1 — definitions / examples / false-positive
 *     guards never imply who is right.
 *   - design doc §3.2 — entries mirror the verbose-definition slice the
 *     prompt iterates.
 */

/**
 * The 19 Family A rawKeys, frozen in declaration order. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set)
 *   - the parity test (asserts every literal is present in both source
 *     files as a string literal)
 */
export const FAMILY_A_RAW_KEYS: readonly string[] = Object.freeze([
  'supports_parent',
  'challenges_parent',
  'refines_parent',
  'extends_parent',
  'distinguishes_parent',
  'reframes_parent',
  'questions_parent',
  'summarizes_parent',
  'acknowledges_parent',
  'corrects_parent_detail',
  'contrasts_with_parent',
  'answers_parent_question',
  'has_rebuttal',
  'has_counter_rebuttal',
  'rebutted',
  'quote_anchors_parent',
  // MCP-BUILD2b (Build-2 manifest §1) — parent-relation quality booleans.
  'acknowledges_parent_strength',
  'compares_parent_to_sibling_branch',
  'identifies_parent_scope_limit',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_A_CLASSIFIER_SET_VERSION = 'family-a-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence
 * + label match.
 */
export interface FamilyAPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_A_PROMPT_ENTRIES: readonly FamilyAPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'supports_parent',
    label: 'Supports parent',
    booleanQuestion:
      "Does this move's substantive content support (rather than challenge, refine, or be neutral about) its parent's position?",
    positiveDefinition:
      "The move advances reasons, evidence, or examples that strengthen the parent's claim or position. The move may add new support, restate the parent's claim from a different angle, or provide a confirming example.",
    negativeDefinition:
      "The move challenges, qualifies, redirects, or is independent of the parent's position. A move that says 'yes, and ALSO...' for a DIFFERENT axis is NOT support — that is extends_parent.",
    positiveExample:
      "Parent: 'EVs reduce urban air pollution.' Move: 'A 2024 EPA study confirms tailpipe-emission reductions of 40% in EV-heavy cities.'",
    negativeExample:
      "Parent: 'EVs reduce urban air pollution.' Move: 'But manufacturing batteries produces emissions too.' (challenges, not supports)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that merely express agreement ('I agree') without adding any support — that is acknowledges_parent. Do NOT mark TRUE for moves that extend the parent to a different axis — that is extends_parent. Do NOT mark TRUE based on tone, politeness, or surface-level affirmation; the move must add substantive support.",
  }),
  Object.freeze({
    rawKey: 'challenges_parent',
    label: 'Challenges parent',
    booleanQuestion:
      "Does this move's substantive content challenge (dispute, push back on, raise problems with) its parent's claim, scope, evidence, or reasoning?",
    positiveDefinition:
      "The move's substantive content pushes back on the parent in at least one of: factual challenge, scope challenge, evidence-applicability challenge, definition dispute, causal disagreement, value disagreement.",
    negativeDefinition:
      "The move agrees, refines on the same side, questions for clarification, summarizes, or acknowledges. Pure questions and pure paraphrases are NOT challenges.",
    positiveExample:
      "Parent: 'EVs reduce urban pollution.' Move: 'That ignores battery production emissions.' (challenges evidence applicability)",
    negativeExample:
      "Move: 'How are you measuring pollution?' (clarification, not challenge)",
    falsePositiveGuards:
      "Do NOT confuse with has_rebuttal (auto-metadata post-hoc fact) — this is move-intrinsic. Do NOT mark TRUE for pragmatic-marker phrases ('but', 'however') without substantive disagreement. Do NOT mark TRUE for tone alone; substantive content is required.",
  }),
  Object.freeze({
    rawKey: 'refines_parent',
    label: 'Refines parent',
    booleanQuestion:
      "Does this move take the parent's claim and offer a refinement that narrows or sharpens it (same side, more precise)?",
    positiveDefinition:
      "The move accepts the parent's broad direction and proposes a more precise / narrower / better-scoped version. Move-intrinsic; distinct from lifecycle 'narrowed' (which is cluster-state after acceptance).",
    negativeDefinition:
      "The move challenges or disputes, extends to a different axis, or merely acknowledges. A refinement is supportive narrowing.",
    positiveExample:
      "Parent: 'Libraries are infrastructure.' Move: 'Yes — specifically public-good infrastructure that needs collective funding like roads, not optional infrastructure like ski resorts.'",
    negativeExample:
      "Parent: 'Carbon taxes work.' Move: 'No, they do not.' (challenge, not refinement)",
    falsePositiveGuards:
      "Do NOT mark TRUE for restatements without narrowing. Do NOT mark TRUE for challenges framed politely; refinement is supportive. Do NOT confuse with narrows_claim (cluster-level) — this is move-intrinsic.",
  }),
  Object.freeze({
    rawKey: 'extends_parent',
    label: 'Extends parent',
    booleanQuestion:
      "Does this move accept the parent's point and extend it to a related but distinct point on the same side?",
    positiveDefinition:
      "The move signals 'yes, AND also...' — accepting the parent and adding a related but distinct same-side point. The extension is not the same claim restated; it is an additional claim coalition-building with the parent.",
    negativeDefinition:
      "The move challenges, refines (narrows the same claim), or extends to a DIFFERENT axis. Pure agreement without extension is acknowledges_parent.",
    positiveExample:
      "Parent: 'EVs reduce tailpipe emissions.' Move: 'Yes, and they also reduce noise pollution in dense urban areas.' (extends same side to new axis)",
    negativeExample:
      "Move: 'Yes.' (acknowledges, no extension)",
    falsePositiveGuards:
      "Do NOT mark TRUE for restatements. Do NOT mark TRUE for extensions that are actually different topics (those are introduces_new_issue). Do NOT mark TRUE based on 'and' alone; substantive extension is required.",
  }),
  Object.freeze({
    rawKey: 'distinguishes_parent',
    label: 'Distinguishes from parent',
    booleanQuestion:
      "Does this move draw a sub-distinction within the parent's scope that the parent treated as unified?",
    positiveDefinition:
      "The move splits a category the parent treated as one ('libraries' → 'urban libraries vs rural libraries'; 'EVs' → 'passenger EVs vs commercial EVs'). The distinction matters for the parent's claim.",
    negativeDefinition:
      "The move accepts the parent's scope without subdividing, or proposes an entirely new axis (introduces_new_issue), or challenges the whole claim.",
    positiveExample:
      "Parent: 'EVs reduce pollution.' Move: 'Worth distinguishing passenger EVs (which clearly do) from commercial EVs (where the effect depends on duty cycle).'",
    negativeExample:
      "Move: 'EVs do not reduce pollution at all.' (challenges, not distinguishes)",
    falsePositiveGuards:
      "Do NOT mark TRUE for cosmetic distinctions that do not affect the parent's claim. Do NOT confuse with disputes_scope (Family B) — distinction is collaborative; scope dispute is adversarial.",
  }),
  Object.freeze({
    rawKey: 'reframes_parent',
    label: 'Reframes parent',
    booleanQuestion:
      "Does this move re-frame the topic, shifting the lens or the decision criterion the parent assumed?",
    positiveDefinition:
      "The move accepts the topic but proposes a different frame: 'this is really a question of fairness, not efficiency'; 'the right unit is per-resident, not per-county'; 'we should be asking who pays, not whether to pay'. Reframing changes the criterion.",
    negativeDefinition:
      "The move accepts the frame and challenges the claim within it, or extends, or refines, or introduces a new issue without reframing.",
    positiveExample:
      "Parent: 'Library funding should be efficient.' Move: 'Efficiency is the wrong lens; the question is equity of access.' (reframes criterion)",
    negativeExample:
      "Move: 'Library funding is not efficient.' (challenges within same frame)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that merely add a new consideration; reframing changes the lens itself. Do NOT confuse with introduces_new_issue — that is a fresh topic; reframing is a different angle on the same topic.",
  }),
  Object.freeze({
    rawKey: 'questions_parent',
    label: 'Questions parent',
    booleanQuestion:
      "Does this move ask a substantive question about the parent's claim, evidence, or reasoning (not just a clarification)?",
    positiveDefinition:
      "The move poses a real question that probes the parent's basis: 'how do you square that with X?'; 'what would falsify this?'; 'have you considered Y?'. The question carries genuine engagement, not just clarification.",
    negativeDefinition:
      "The move is a pure clarification request (requests_clarification), a challenge framed as a question (challenges_parent), or rhetorical question with no engagement.",
    positiveExample:
      "Parent: 'Carbon taxes work.' Move: 'How do you square that with the 2019 Australian repeal data?' (substantive question)",
    negativeExample:
      "Move: 'What do you mean?' (clarification, not questioning)",
    falsePositiveGuards:
      "Do NOT confuse with requests_clarification — questioning probes; clarification merely seeks restatement. Do NOT mark TRUE for rhetorical questions that carry implicit assertions.",
  }),
  Object.freeze({
    rawKey: 'summarizes_parent',
    label: 'Summarizes parent',
    booleanQuestion:
      "Does this move summarize the parent's position in its own words?",
    positiveDefinition:
      "The move restates the parent's position in compressed form, preserving the parent's intent. May be in service of a follow-up move (challenge, support, refine) or stand on its own.",
    negativeDefinition:
      "The move quotes the parent verbatim (quote_anchors_parent), paraphrases inaccurately, or proceeds without restating.",
    positiveExample:
      "Parent: 'EVs reduce urban pollution because tailpipe emissions drop, especially in dense cities, and the grid is getting cleaner.' Move: 'So your claim is: EVs reduce urban pollution, with the effect stronger in cities and growing with grid mix.'",
    negativeExample:
      "Move: 'EVs are bad for the grid.' (does not summarize parent)",
    falsePositiveGuards:
      "Do NOT mark TRUE for paraphrases that substantially change the parent's meaning (that is misrepresentation). Do NOT mark TRUE for verbatim quotes (use quote_anchors_parent).",
  }),
  Object.freeze({
    rawKey: 'acknowledges_parent',
    label: 'Acknowledges parent',
    booleanQuestion:
      "Does this move express acknowledgement of the parent ('OK', 'I see', 'fair point') without adding substantive content?",
    positiveDefinition:
      "The move signals agreement, understanding, or willingness to engage, but adds no substantive support, refinement, challenge, or extension.",
    negativeDefinition:
      "The move adds substantive content beyond acknowledgement (which would be supports_parent / extends_parent / refines_parent etc.).",
    positiveExample:
      "Move: 'Fair point.' (pure acknowledgement)",
    negativeExample:
      "Move: 'Yes — the Pittsburgh data confirms this.' (supports_parent, more than acknowledgement)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves with substantive content beyond acknowledgement. Do NOT mark TRUE for moves that acknowledge sarcastically (those play differently in the point-standing economy).",
  }),
  Object.freeze({
    rawKey: 'corrects_parent_detail',
    label: 'Corrects parent detail',
    booleanQuestion:
      "Does this move correct a specific factual detail in the parent (a number, name, date, attribution) without challenging the parent's overall claim?",
    positiveDefinition:
      "The move points out an error in a specific factual detail and offers the substitute value, while leaving the parent's main claim intact. Narrower than challenges_parent.",
    negativeDefinition:
      "The move challenges the parent's overall claim, or quibbles with detail without offering a substitute, or asks for clarification about the detail.",
    positiveExample:
      "Parent: 'EV adoption is at 30% nationally.' Move: 'The 30% number is for new sales, not stock; stock is closer to 5%.'",
    negativeExample:
      "Move: 'EV adoption claims are exaggerated.' (challenges the overall claim, not just a detail)",
    falsePositiveGuards:
      "Do NOT mark TRUE for substantive challenges packaged as 'minor edits'. Do NOT mark TRUE for cosmetic edits (spelling, formatting).",
  }),
  Object.freeze({
    rawKey: 'contrasts_with_parent',
    label: 'Contrasts with parent',
    booleanQuestion:
      "Does this move draw a contrast between two cases / examples / domains to highlight a tension with the parent's claim?",
    positiveDefinition:
      "The move presents a comparison ('whereas X, Y') in service of showing the parent's claim does not hold uniformly. The contrast is the move's main vehicle.",
    negativeDefinition:
      "The move offers a direct challenge, supports with a similar case, distinguishes within the parent's scope (distinguishes_parent), or extends.",
    positiveExample:
      "Parent: 'Carbon taxes always work.' Move: 'BC's tax cut emissions; Australia's was repealed before measurement. Contrasts on these two suggest the policy needs durable enforcement to work.'",
    negativeExample:
      "Move: 'Carbon taxes did not work in Australia.' (challenge, not contrast structure)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that mention contrasts in passing without using the contrast as the central move structure.",
  }),
  Object.freeze({
    rawKey: 'answers_parent_question',
    label: 'Answers parent question',
    booleanQuestion:
      "Does this move answer a question that was posed in the parent move?",
    positiveDefinition:
      "The parent contained a question (request for evidence, clarification, or substantive question). The move provides a direct response to that question.",
    negativeDefinition:
      "The parent contained no question, or the move ignores the question and responds to something else, or the move is a counter-question without an answer.",
    positiveExample:
      "Parent: 'What is your source for the 40% figure?' Move: 'EPA 2024 urban-tailpipe summary report, table 3.'",
    negativeExample:
      "Parent: 'What is your source?' Move: 'Why are you so focused on this?' (counter-question, no answer)",
    falsePositiveGuards:
      "Do NOT mark TRUE for non-responsive moves that paraphrase the question without answering. Do NOT mark TRUE for counter-questions only; the move must answer.",
  }),
  Object.freeze({
    rawKey: 'has_rebuttal',
    label: 'Challenged',
    booleanQuestion:
      "Does this move have at least one child that is structurally a challenge / rebuttal?",
    positiveDefinition:
      "An auto-metadata fact derived from the argument tree: at least one of the move's children is typed as a challenge. Deterministic from the tree.",
    negativeDefinition:
      "The move has no children typed as challenges (it may have other children like clarifications, supports, or branches).",
    positiveExample:
      "Move M has child C that is typed challenge → has_rebuttal = TRUE for M.",
    negativeExample:
      "Move M has no children → has_rebuttal = FALSE.",
    falsePositiveGuards:
      "Do NOT mark TRUE based on tone of a child move — the type marker is what matters. Do NOT mark TRUE for descendants beyond direct children. When you only see the move text (not the tree), answer FALSE with low confidence.",
  }),
  Object.freeze({
    rawKey: 'has_counter_rebuttal',
    label: 'Counter',
    booleanQuestion:
      "Does this move have at least one grandchild that is structurally a counter-rebuttal (challenge to its child challenge)?",
    positiveDefinition:
      "An auto-metadata fact derived from the argument tree: the move has a child challenge that itself has a challenge child. Deterministic.",
    negativeDefinition:
      "No counter-rebuttal descends from this move (the challenge has no counter-challenge child).",
    positiveExample:
      "Tree: M → C_challenge → C2_counter → has_counter_rebuttal = TRUE for M.",
    negativeExample:
      "Tree: M → C_challenge (no further children) → has_counter_rebuttal = FALSE.",
    falsePositiveGuards:
      "Do NOT mark TRUE based on grandchildren that are clarifications or supports. Do NOT mark TRUE for great-grandchildren — the check is depth 2 exactly. When you only see the move text (not the tree), answer FALSE with low confidence.",
  }),
  Object.freeze({
    rawKey: 'rebutted',
    label: 'Pressured',
    booleanQuestion:
      "Is this cluster in the 'rebutted' lifecycle state — an open challenge has been posted and not yet answered?",
    positiveDefinition:
      "A lifecycle state derived from the cluster's response pattern: at least one challenge to the cluster's main claim is open (not closed by a clarification / sourcing / concession / synthesis).",
    negativeDefinition:
      "The cluster has no open challenge, or every challenge has been answered. The cluster moved to a different lifecycle state.",
    positiveExample:
      "Cluster with one challenge posted yesterday, no reply yet → rebutted = TRUE.",
    negativeExample:
      "Cluster with challenge that received a clarifying reply, now in clarified state → rebutted = FALSE.",
    falsePositiveGuards:
      "Do NOT mark TRUE for clusters where the challenge was withdrawn. Do NOT confuse 'rebutted' with 'has_rebuttal' — one is a cluster state, the other is a move-level structural fact. When you only see the move text (not the cluster state), answer FALSE with low confidence.",
  }),
  Object.freeze({
    rawKey: 'quote_anchors_parent',
    label: 'Anchored reply',
    booleanQuestion:
      "Does this move quote specific text from its parent and use that quote as the anchor for its response?",
    positiveDefinition:
      "The move contains a direct quotation of a portion of the parent's text and structures its response around that quote — addressing the quoted portion specifically rather than the parent's general thrust.",
    negativeDefinition:
      "The move paraphrases the parent without quoting, or references the parent without a quote, or quotes something that is not the parent (an external source). A passing quote without anchoring (the move's substantive response is elsewhere) is NOT this rawKey.",
    positiveExample:
      "Parent: 'EVs reduce urban pollution by 40%.' Move: 'You said \\'reduce urban pollution by 40%\\' — that figure comes from tailpipe-only studies; if you include manufacturing it drops to 12%.' (quote-anchored)",
    negativeExample:
      "Move responds with a paraphrase of the parent's overall claim without quoting anything.",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that quote in passing without anchoring the response. Do NOT mark TRUE for moves that quote a third source rather than the parent.",
  }),
  // ── MCP-BUILD2b (Build-2 manifest §1) — parent-relation quality booleans. ──
  Object.freeze({
    rawKey: 'acknowledges_parent_strength',
    label: 'Grants a point before disagreeing',
    booleanQuestion:
      'Does this move acknowledge a strength of the parent before disagreeing with it?',
    positiveDefinition:
      "The move explicitly grants that some substantive part of the parent holds — names a specific point it accepts — and THEN proceeds to disagree on another point. The acknowledgement names a real claim, premise, or piece of reasoning, and is followed by a substantive disagreement in the same move.",
    negativeDefinition:
      "The move disagrees with no acknowledgement (pure challenges_parent), or it only acknowledges with no following disagreement (that is the existing acknowledges_parent), or it is not a disagreement at all. Politeness or tone alone does not count.",
    positiveExample:
      "Parent: 'EVs cut tailpipe emissions and lower running costs.' Move: 'Fair point on the tailpipe data — I accept that. Where I'd part ways is the running-cost case; battery replacement narrows the gap a lot.'",
    negativeExample:
      "Move: 'Good point.' (acknowledgement only, no following disagreement — that is acknowledges_parent)",
    falsePositiveGuards:
      "This observation describes the MOVE, never the author; it never says the parent IS strong or right. Do NOT mark TRUE on politeness or tone alone; the acknowledgement must name a SUBSTANTIVE point AND be followed by a substantive disagreement in the same move. Do NOT mark TRUE for a bare acknowledgement with no following disagreement (acknowledges_parent) or a move that fully supports the parent (supports_parent). Do NOT treat the ABSENCE of this observation as a criticism: a move that disagrees without granting a point first is valid and simply does not trip this flag.",
  }),
  Object.freeze({
    rawKey: 'compares_parent_to_sibling_branch',
    label: 'Compares to a sibling branch',
    booleanQuestion:
      'Does this move compare the parent move with a sibling branch in the same thread?',
    positiveDefinition:
      "The move references another branch in the same thread (a different child line under the same parent) and contrasts the parent move with it. The comparison is to a SIBLING branch, not the parent itself or an ancestor.",
    negativeDefinition:
      "The move stays within the parent line with no sibling reference; references an ancestor ('earlier you said'); or invokes a generic 'elsewhere people argue' that points to no specific sibling branch in this thread.",
    positiveExample:
      "Move: 'Compared to the other reply chain on enforcement, this one ignores the enforcement variable entirely.'",
    negativeExample:
      "Move: 'Earlier you said X.' (ancestor reference, not a sibling branch)",
    falsePositiveGuards:
      "The comparison must be to a SIBLING branch (same parent, different child line) — not the parent itself and not an ancestor. Do NOT mark TRUE on a generic 'elsewhere people argue…' that names no specific sibling branch. Do NOT confuse with contrasts_with_parent (that contrasts two cases/examples; this references another BRANCH of the thread).",
  }),
  Object.freeze({
    rawKey: 'identifies_parent_scope_limit',
    label: 'Names a scope limit',
    booleanQuestion:
      "Does this move identify a specific scope limit on the parent's claim?",
    positiveDefinition:
      "The move names a SPECIFIC boundary — a named population, time horizon, or setting — where the parent's claim stops applying, without necessarily disputing it adversarially. The scope-naming is collaborative: it sharpens where the claim does and does not reach.",
    negativeDefinition:
      "The move accepts the parent's scope wholesale; disputes scope adversarially (that framing is disputes_scope in Family B); or hedges vaguely ('it depends') without naming a specific boundary.",
    positiveExample:
      "Parent: 'Carbon taxes cut emissions.' Move: 'True within cities with stable enforcement; the suburban case is open.'",
    negativeExample:
      "Move: 'Carbon taxes never work.' (no scope limit named)",
    falsePositiveGuards:
      "The scope limit must be SPECIFIC — a named population, time, or setting; do NOT mark on a vague 'it depends'. Distinguish the collaborative scope-naming here from the adversarial disputes_scope in Family B (both may co-fire). Do NOT confuse with distinguishes_parent (that splits a category the parent treated as unified).",
  }),
]);
