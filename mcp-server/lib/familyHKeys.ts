/**
 * MCP-SERVER-009-FAMILY-H — Family H (claim_clarity) 12-key ai_classifier
 * UNIFORM-source constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family H registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyH.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyHKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * UNIFORM ai_classifier path: per design §A.1.1 and operator Stage 2B
 * binding (T3 only — doctrine-risk; T1 NOT FIRED), the upstream
 * `familyH.ts` taxonomy declares 12 rawKey entries with uniform
 * `source: 'ai_classifier'` (1 existing #51 + 11 NEW). No `auto_metadata`
 * or `lifecycle` entries. **No FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS
 * constant** (no exclusions; uniform source mirrors the E + F precedent).
 *
 * NO `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` ENTRY: HALT trigger #12 is
 * inapplicable for uniform-ai_classifier H; the Edge
 * `booleanObservationRequestBuilder.ts` mixed-source entries (D + G) remain
 * byte-equal and no new entry is needed.
 *
 * The 12 rawKeys are the binding contract per MCP-SERVER-009-FAMILY-H
 * design §A.1.1 + Stage 2B T3 doctrine-risk operator decision. Verbatim,
 * in declaration order matching the upstream `ai_classifier`-source
 * entries of `familyH.ts`:
 *
 *   1.  provides_temporal_constraint     (LOW — temporal scope is structurally descriptive)
 *   2.  claim_present                    (MEDIUM — "no claim present" reads as missing)
 *   3.  reason_present                   (MEDIUM — "no reason present" reads as unsupported)
 *   4.  conclusion_missing               (HIGHEST — "no conclusion" → "argument is incomplete" drift; verbatim guard)
 *   5.  reason_missing                   (HIGHEST — "no reason" → "argument is unsupported" drift; verbatim guard)
 *   6.  multiple_claims_present          (MEDIUM — "multi-claim" reads as "scattered" if mishandled)
 *   7.  claim_specificity_high           (LOW — narrow + concrete is structurally descriptive)
 *   8.  claim_specificity_low            (HIGHEST — axis-partner; "broad" → "weak/vague/lazy" drift; verbatim guard)
 *   9.  quantifier_present               (LOW — quantifier use is descriptive)
 *   10. modal_language_present           (LOW — modal status is grammatical)
 *   11. hedging_present                  (MEDIUM — "hedged" could read as "uncertain/weak" if mishandled)
 *   12. unclear_reference_present        (HIGHEST — speaker-clarity-skill verdict drift; verbatim guard)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict about a person or intent.
 *   - cdiscourse-doctrine §1 — claim-clarity states are DESCRIPTIVE
 *     FORMULATION-STATE, never verdicts. The classifier NEVER labels a
 *     move "weak", "strong", "bad", "good", "sloppy", "sound", "valid",
 *     "invalid", "complete", "incomplete", "supported", "unsupported", or
 *     the speaker "unclear", "lazy", "careless". Absence of a stated
 *     conclusion is a FORMULATION CHOICE; absence of an attached reason is
 *     a FORMULATION CHOICE; broad scope is a SHAPE; ambiguous reference is
 *     a structural feature visible to the classifier.
 *   - point-standing-economy — Family H is descriptive; a
 *     conclusion_missing / reason_missing / claim_specificity_low /
 *     unclear_reference_present positive does NOT lower the move's
 *     factual standing eligibility. Broad scope and reason absence are
 *     SHAPES, not standing penalties. H emits no standing delta.
 *   - MCP-020 audit §Rejected labels — the clarity↔verdict adjacency is
 *     the existential concern: a clarity classifier is one careless
 *     prompt phrasing away from emitting "the speaker wrote a weak/
 *     sloppy/bad argument". The 4 HIGHEST-risk keys
 *     (claim_specificity_low + conclusion_missing + reason_missing +
 *     unclear_reference_present) each carry verbatim per-key DOCTRINE
 *     paragraphs in their `falsePositiveGuards`, forbidding the output
 *     from echoing quality-verdict tokens even when the input move text
 *     contains them.
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family A/B/C/D/E/F/G
 * pattern.
 */

/**
 * The 12 Family H ai_classifier rawKeys, frozen in declaration order
 * matching upstream. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in upstream
 *     `familyH.ts` as a string literal AND that upstream has zero
 *     auto_metadata + zero lifecycle entries — H is uniform)
 */
export const FAMILY_H_RAW_KEYS: readonly string[] = Object.freeze([
  'provides_temporal_constraint',
  'claim_present',
  'reason_present',
  'conclusion_missing',
  'reason_missing',
  'multiple_claims_present',
  'claim_specificity_high',
  'claim_specificity_low',
  'quantifier_present',
  'modal_language_present',
  'hedging_present',
  'unclear_reference_present',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_H_CLASSIFIER_SET_VERSION = 'family-h-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence.
 *
 * Per design §A.3.2, the per-key falsePositiveGuards for the 4 HIGHEST-risk
 * verdict-adjacent keys carry verbatim DOCTRINE paragraphs forbidding the
 * output from framing the move as weak/sloppy/lazy/careless/confused/
 * unsound/unsupported/incoherent/illogical/wrong/"bad reasoning"/"bad
 * argument"/"argument is incomplete"/"argument is unsupported"/etc.
 *
 * The axis-partner key — H's analog to E's `slippery_slope` and F's
 * `consequence_probability_unclear` and G's `concedes_broader_point` — is
 * `claim_specificity_low` (the broad-claim key). It carries the strongest
 * verbatim guard, including the existential constraint that even when the
 * input move text contains "I wrote a weak argument" / "my claim was
 * vague" / "lazy claim", the output evidence_span must NOT echo it.
 */
export interface FamilyHPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_H_PROMPT_ENTRIES: readonly FamilyHPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'provides_temporal_constraint',
    label: 'Time boundary',
    booleanQuestion:
      'Does this move add a temporal scope or time-frame constraint to a claim (when, until when, for how long)?',
    positiveDefinition:
      'The move attaches a specific temporal scope: a year range, a duration, a deadline, a since-when phrase, a before-after marker, or another time-bound qualifier that narrows when the claim applies.',
    negativeDefinition:
      'The move is timeless or contains a tense marker without a real temporal boundary. Mere past tense or future tense is not a temporal constraint; the move must restrict the claim to a specific window.',
    positiveExample:
      "Move: 'Since 2015, urban EV adoption grew faster than projections.' (since-when scope)",
    negativeExample: "Move: 'EVs reduce pollution.' (no temporal scope)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves with only past or future tense — tense without a boundary is not temporal scope. Do NOT mark TRUE for vague time gestures ('eventually', 'someday') with no specific window. Do NOT mark TRUE for narrative timestamps that do not narrow a claim.",
  }),
  Object.freeze({
    rawKey: 'claim_present',
    label: 'Claim present',
    booleanQuestion:
      'Does this move contain an explicit claim (a proposition the author advances as true, advisable, or worth considering)?',
    positiveDefinition:
      'The move contains at least one declarative proposition that the author advances. The claim may be factual ("X happens"), evaluative ("X is good"), or prescriptive ("X should happen"). Pure questions or pure paraphrases without an attached claim do NOT count.',
    negativeDefinition:
      'The move is a pure question ("What do you think?"), a pure paraphrase ("You said X"), a pure acknowledgement ("OK"), or a quote without engagement. Moves that frame a claim as someone else\'s without endorsing it are also NOT this rawKey.',
    positiveExample: "Move: 'EVs reduce urban pollution.' (factual claim)",
    negativeExample: "Move: 'What is your evidence?' (pure question)",
    falsePositiveGuards:
      'Do NOT mark TRUE for paraphrases of the parent that do not also advance a claim. Do NOT mark TRUE for clarification requests even when the question wording is assertive in style. Do NOT mark TRUE for quoted claims attributed to others without endorsement. DOCTRINE: presence of a claim is a structural FORMULATION CHOICE. It is NEVER framed as the move being "strong" / "weak" / "well-formed" / "incomplete". The evidence_span MUST anchor the verbatim claim wording — NOT a judgment about whether the claim is good.',
  }),
  Object.freeze({
    rawKey: 'reason_present',
    label: 'Reason present',
    booleanQuestion:
      'Does this move attach at least one reason, ground, evidence, or justification to its claim, rather than asserting the claim alone?',
    positiveDefinition:
      'The move pairs a claim with a "because", "since", "given that", "for the reason that", or a stated piece of evidence / ground. Toulmin terms: claim plus grounds.',
    negativeDefinition:
      'The move asserts a claim without attaching a reason, or contains a reason without an attached claim, or is a pure question or paraphrase.',
    positiveExample:
      "Move: 'EVs reduce urban pollution because tailpipe emissions drop in heavy-EV cities (per 2024 EPA data).' (claim + ground)",
    negativeExample: "Move: 'EVs reduce urban pollution.' (claim only, no reason)",
    falsePositiveGuards:
      'Do NOT mark TRUE based on the word "because" alone — the because-clause must support a claim. Do NOT mark TRUE for examples that are NOT reasons (an example is illustrative, not always grounding). Do NOT mark TRUE for parenthetical hedges that read like reasons but do not actually ground. DOCTRINE: presence of an attached reason is a structural FORMULATION CHOICE. It is NEVER framed as the reason being "good" / "sound" / "valid" / "strong" — those are quality verdicts. The evidence_span MUST anchor the verbatim ground clause — NOT a judgment about reason quality.',
  }),
  Object.freeze({
    rawKey: 'conclusion_missing',
    label: 'No explicit conclusion',
    booleanQuestion:
      'Does this move present reasoning or grounds without stating the conclusion the author is reaching?',
    positiveDefinition:
      "The move builds toward a conclusion via reasoning or examples but never states the conclusion itself. The reader must infer what claim the author is making. Common in moves that pile up rhetorical questions or partial reasoning without a synthesis statement.",
    negativeDefinition:
      'The move states its conclusion explicitly (with or without reasoning), or the move is a pure question, or the move is a paraphrase of the parent without offering reasoning, or the conclusion is trivially obvious from the reasoning.',
    positiveExample:
      "Move: 'Library funding has dropped 20% since 2019. Literacy rates have fallen. New library branches keep closing.' (reasoning piled; conclusion not stated)",
    negativeExample:
      "Move: 'Library funding has dropped, and literacy rates have fallen — we need to restore funding.' (explicit conclusion)",
    falsePositiveGuards:
      'Do NOT mark TRUE when the conclusion is rhetorically obvious from the reasoning context. Do NOT mark TRUE for pure questions; questions have no conclusion by design. DOCTRINE: absence of a stated conclusion is a structural FORMULATION CHOICE (the reasoning is shown, the conclusion is left implicit). It is NEVER framed as "argument is incomplete", "failed to conclude", "broken argument", "missing the point", or any incompleteness verdict. Many strong moves intentionally leave conclusions for the reader. The evidence_span MUST anchor the verbatim reasoning that builds toward the unstated conclusion — NOT a judgment that the move is unfinished. The output MUST NOT contain: incomplete, unfinished, "argument is incomplete", "failed to", "broken".',
  }),
  Object.freeze({
    rawKey: 'reason_missing',
    label: 'No reason attached',
    booleanQuestion:
      'Does this move state a claim without attaching ANY reason, ground, or justification?',
    positiveDefinition:
      "The move asserts a claim and stops — no 'because', no 'since', no cited evidence, no example. The claim stands alone in the move body.",
    negativeDefinition:
      "The move attaches any reason — including weak reasons or hedged ones. The move is a pure question / paraphrase / acknowledgement (those have no claim to ground). The move is a value claim where ground is implicit in the value.",
    positiveExample: "Move: 'EVs reduce pollution.' (claim, no reason)",
    negativeExample: "Move: 'EVs reduce pollution because tailpipe emissions drop.' (reason attached)",
    falsePositiveGuards:
      "Do NOT mark TRUE for value claims where the value itself is the ground. Do NOT mark TRUE for moves whose reason is in the PARENT (the move responds to and inherits the parent's reasoning). DOCTRINE: absence of an attached reason is a structural FORMULATION CHOICE (the claim is asserted; the reason may live in the parent, prior moves, future replies, or simply be reserved). It is NEVER framed as \"argument is unsupported\", \"claim is unsupported\", \"unjustified\", \"ungrounded\", or any quality verdict. Short stage-setting moves are common. The evidence_span MUST anchor the verbatim bare claim — NOT a judgment that the move is unjustified. The output MUST NOT contain: unsupported, ungrounded, unjustified, \"argument is unsupported\", \"claim is unsupported\".",
  }),
  Object.freeze({
    rawKey: 'multiple_claims_present',
    label: 'Multiple claims',
    booleanQuestion:
      'Does this move bundle two or more distinct claims that would each require separate engagement to address?',
    positiveDefinition:
      "The move makes two or more claims that are not logically equivalent. Each claim has its own subject + predicate and could be challenged independently. The move's responder faces a choice about which claim to address.",
    negativeDefinition:
      'The move makes one claim that is restated for emphasis, OR a claim plus a paraphrase of itself, OR a claim plus illustrative examples (examples extending one claim are still one claim).',
    positiveExample: "Move: 'EVs reduce pollution AND lower fuel costs.' (two claims)",
    negativeExample:
      "Move: 'EVs reduce pollution — they cut tailpipe emissions, particulate matter, and CO2.' (one claim plus examples)",
    falsePositiveGuards:
      'Do NOT mark TRUE for a claim plus its supporting examples — the examples are not separate claims. Do NOT mark TRUE for a claim plus its restatement. Do NOT mark TRUE for compound subjects making one assertion ("X and Y both increase"). DOCTRINE: multi-claim is a structural FORMULATION CHOICE (the move bundles two-plus claims). It is NEVER framed as the move being "scattered", "disorganized", "confused", or any quality verdict. The evidence_span MUST anchor the verbatim conjoined claims — NOT a judgment about bundling appropriateness.',
  }),
  Object.freeze({
    rawKey: 'claim_specificity_high',
    label: 'Specific claim',
    booleanQuestion:
      "Is the move's claim narrowly scoped with concrete particulars (specific population, specific time window, specific outcome, specific magnitude)?",
    positiveDefinition:
      'The claim names specific population / time / outcome / magnitude / mechanism. Example: "library funding in Allegheny County rose 12% over 2020-2023, correlated with a 5% literacy gain in K-3 students." Specific = narrow + concrete.',
    negativeDefinition:
      'The claim is broad or general — population unspecified, time unspecified, magnitude unspecified, or stated as universal ("X causes Y"). Generality is not a defect; it is a different shape.',
    positiveExample:
      "Move: 'In 12 cities with carbon taxes, emissions dropped 8% over 2015-2020.' (specific scope, specific magnitude)",
    negativeExample: "Move: 'Carbon taxes work.' (broad)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves with numbers that are not the move\'s scope (e.g., a parenthetical timestamp). Do NOT confuse hedging with specificity — "approximately 8%" is still specific. Do NOT mark TRUE for moves where the specificity is in a quoted source, not in the claim itself.',
  }),
  Object.freeze({
    rawKey: 'claim_specificity_low',
    label: 'Broad claim',
    booleanQuestion:
      "Is the move's claim broadly scoped without concrete particulars (no specific population, time, outcome, or magnitude)?",
    positiveDefinition:
      'The claim is universal or vague: "X causes Y" without scope; "many people think X"; "this always happens". Broad = general + unspecific. NOT a verdict on quality.',
    negativeDefinition:
      'The claim contains at least one specific particular (population / time / magnitude / mechanism). Hedged claims with specific scope are NOT this rawKey.',
    positiveExample: "Move: 'Carbon taxes work.' (broad)",
    negativeExample:
      "Move: 'Carbon taxes worked in 12 European jurisdictions 2015-2020.' (specific)",
    falsePositiveGuards:
      'Do NOT mark TRUE for hedged claims with specific scope. Do NOT mark TRUE for value claims that are inherently broad in form. DOCTRINE: a broad claim is a structural SHAPE (general scope, no concrete particulars), a different formulation choice — NEVER framed as "weak", "vague", "lazy", "sloppy", "careless", "unclear", "unsound", or any quality verdict. The evidence_span MUST anchor the verbatim broad-scoped wording (e.g., "carbon taxes work", "libraries matter", "this always happens") — NOT a judgment about whether the claim is well-formed. If the move\'s own text says "I wrote a weak argument" or "my claim was vague", the model may still detect claim_specificity_low but its output MUST NOT echo "weak"/"vague"/"sloppy"/"lazy". The output MUST NOT contain: weak, sloppy, lazy, careless, confused, unsound, unsupported, incoherent, illogical, "bad reasoning", "bad argument", "argument is weak", "claim is weak", "claim fails".',
  }),
  Object.freeze({
    rawKey: 'quantifier_present',
    label: 'Quantifier used',
    booleanQuestion:
      'Does this move use an explicit quantifier (all, most, many, some, few, none, percentages, ratios) to scope its claim?',
    positiveDefinition:
      'The claim contains a quantifier word or numeric ratio that bounds the scope: "all", "most", "many", "some", "few", "none", "X%", "1 in N", "half of".',
    negativeDefinition:
      'The claim uses no quantifier — either universal-by-default ("X is Y") or single-instance ("this is Y"). Quantifier in a parenthetical or example does not count if the main claim is unquantified.',
    positiveExample: "Move: 'Most urban EVs reduce particulate matter by at least 20%.' (most + percentage)",
    negativeExample: "Move: 'EVs reduce pollution.' (no quantifier)",
    falsePositiveGuards:
      'Do NOT mark TRUE for cardinal numbers that are not quantifiers (e.g., a year, a phone number). Do NOT mark TRUE for quantifiers in quoted sources that are not the move\'s claim. Do NOT mark TRUE for vague intensifiers ("very", "really") that are not quantifiers.',
  }),
  Object.freeze({
    rawKey: 'modal_language_present',
    label: 'Modal language',
    booleanQuestion:
      'Does this move use modal auxiliary verbs (can, could, may, might, must, should, ought, will, would) to frame its claims?',
    positiveDefinition:
      'The claim uses a modal verb to mark its modal status — possibility, necessity, recommendation, prediction. The modal is part of the claim, not parenthetical.',
    negativeDefinition:
      'The claim is bare-assertive ("X is Y") or imperative without modal ("Do X"), or the modal is in a quoted source / hypothetical / question.',
    positiveExample:
      "Move: 'Carbon taxes should reduce emissions if enforcement is stable.' (should)",
    negativeExample: "Move: 'Carbon taxes reduce emissions.' (bare assertion)",
    falsePositiveGuards:
      'Do NOT mark TRUE for modal verbs in questions ("could you clarify?"). Do NOT mark TRUE for modal verbs in quoted speech that are not the move\'s claim. Do NOT confuse hedging with modal — they overlap but are distinct (modal = grammatical, hedging = pragmatic).',
  }),
  Object.freeze({
    rawKey: 'hedging_present',
    label: 'Hedged claim',
    booleanQuestion:
      'Does the move use explicit hedging language (probabilistic / pragmatic qualifying) when stating its claims?',
    positiveDefinition:
      'The move uses qualifiers like "probably", "often", "in most cases", "tends to", "sometimes", "generally" that explicitly weaken the claim from a universal / certain assertion.',
    negativeDefinition:
      "The move makes claims as confident assertions without hedging, OR uses hedging only as politeness markers ('I think you might mean...') without weakening the claim, OR uses hedging only in clarification questions.",
    positiveExample:
      "Move: 'Increasing library budgets probably correlates with literacy gains in mid-size cities.'",
    negativeExample:
      "Move: 'Library budgets correlate with literacy gains.' (assertive, no hedge)",
    falsePositiveGuards:
      'Do NOT mark TRUE for hedging that is rhetorical politeness ("I might suggest...") not a claim qualifier. Do NOT mark TRUE for hedging in pure questions. Do NOT mark TRUE for hedging in references to other people\'s claims ("they say it probably..."). DOCTRINE: presence of hedging language is a structural FORMULATION CHOICE (the speaker explicitly weakens the claim from a universal assertion). It is NEVER framed as the speaker being "uncertain", "wishy-washy", "non-committal", or as the claim being "weakly supported". Appropriately hedged claims carry LESS evidence debt than the same claim asserted with certainty. The evidence_span MUST anchor the hedge word ("probably", "often", "tends to") — NOT a judgment about confidence-appropriateness.',
  }),
  Object.freeze({
    rawKey: 'unclear_reference_present',
    label: 'Unclear reference',
    booleanQuestion:
      'Does this move use a pronoun, demonstrative, or referring expression whose antecedent is ambiguous (more than one possible referent or no clear referent)?',
    positiveDefinition:
      '"It", "they", "this", "that", "these", "those" appear without a clear preceding referent in the move or its parent. A reader could reasonably wonder "what does THIS refer to?".',
    negativeDefinition:
      'Pronouns refer to a clear single antecedent in the move or its parent. Demonstratives that are explicitly grounded (e.g., "this point about X") are NOT unclear references.',
    positiveExample:
      "Move (responding to parent that mentions both libraries and museums): 'This is the wrong approach.' (this = ?)",
    negativeExample:
      "Move: 'This funding model — the per-resident formula — is the wrong approach.' (this is grounded)",
    falsePositiveGuards:
      'Do NOT mark TRUE when the referent is clearly recoverable from the parent. Do NOT mark TRUE for first-person pronouns ("I", "we") that always self-refer. Do NOT mark TRUE for generic plural ("they say...") when used as a common idiom. DOCTRINE: presence of an ambiguous referring expression is a structural feature VISIBLE TO THE CLASSIFIER. It is NEVER framed as the speaker being "unclear", "sloppy", "careless", "confused", or "imprecise". Pronouns are often clear in context the classifier cannot see (prior thread, shared topic). The evidence_span MUST anchor the verbatim ambiguous pronoun ("this", "they", "it") and the alternative referents the classifier identifies — NOT a judgment about the speaker\'s writing skill. The output MUST NOT contain: unclear (as speaker label), sloppy, careless, confused, "the speaker was unclear", "the author was unclear", "imprecise writing".',
  }),
]);
