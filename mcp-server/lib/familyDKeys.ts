/**
 * MCP-SERVER-005-FAMILY-D — Family D (evidence_source_chain) 19-key Subset
 * constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family D registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyD.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyDKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * Per operator Stage 2B binding decision (recorded at the top of
 * `docs/designs/MCP-SERVER-005-FAMILY-D.md`): this constant is the
 * **Subset path** — exactly the 19 `ai_classifier`-source rawKeys from
 * upstream `familyD.ts`. The 8 deterministic Family D rawKeys (5
 * `auto_metadata` + 3 `lifecycle`) are intentionally EXCLUDED:
 *   - `auto_metadata`: has_evidence, source_requested, quote_requested,
 *     source_attached, quote_attached (5 keys)
 *   - `lifecycle`: sourced, quote_requested, source_requested (3 keys)
 *
 * Excluded keys are deferred to a future Edge/app-side
 * deterministic-computation card (`MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS`).
 * Requesting any of the 8 excluded rawKeys under requestedFamilies=
 * ['evidence_source_chain'] returns `unsupported_rawKey` per the registry
 * boundary (HALT trigger ensures no silent-false conversion).
 *
 * The 19 rawKeys are the binding contract per MCP-SERVER-005-FAMILY-D
 * design §1 and Stage 2B operator decision. Verbatim, in declaration order
 * matching the upstream `ai_classifier`-source entries of `familyD.ts`:
 *
 *   1.  asks_for_evidence
 *   2.  provides_evidence
 *   3.  evidence_supports_claim
 *   4.  creates_source_chain_gap
 *   5.  opens_evidence_debt_marker
 *   6.  closes_evidence_debt_marker
 *   7.  supplies_corroborating_document
 *   8.  source_provided
 *   9.  quote_provided
 *   10. concrete_example_requested
 *   11. concrete_example_provided
 *   12. evidence_claim_present
 *   13. evidence_gap_present (DOCTRINE RISK — anti-amplification)
 *   14. source_chain_repair
 *   15. anecdote_used (DOCTRINE RISK — not "weakness")
 *   16. statistic_used
 *   17. external_authority_used
 *   18. evidence_quality_questioned
 *   19. burden_request_present (DOCTRINE RISK — descriptive, not verdict)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict.
 *   - cdiscourse-doctrine §1 — definitions / examples / false-positive
 *     guards never imply that an evidence gap, anecdote, or burden
 *     invocation is a failure or fault on either side.
 *   - cdiscourse-doctrine §3 — popularity / repetition / engagement is
 *     NOT evidence; `evidence_gap_present` enforces this boundary.
 *   - evidence-doctrine — evidence presence opens factual-standing
 *     eligibility but does not grant it; evidence-quality challenge
 *     reduces standing weight; anecdote is legitimate evidence in some
 *     contexts.
 *   - point-standing-economy — `evidence_gap_present` is a structural
 *     observation, not an automatic standing drop; standing changes when
 *     challenged AND the gap persists.
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family A/B/C
 * pattern.
 */

/**
 * The 19 Family D ai_classifier-subset rawKeys, frozen in declaration
 * order matching upstream. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in upstream
 *     `familyD.ts` as a string literal AND that the 8 deterministic
 *     rawKeys are intentionally excluded)
 */
export const FAMILY_D_RAW_KEYS: readonly string[] = Object.freeze([
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'creates_source_chain_gap',
  'opens_evidence_debt_marker',
  'closes_evidence_debt_marker',
  'supplies_corroborating_document',
  'source_provided',
  'quote_provided',
  'concrete_example_requested',
  'concrete_example_provided',
  'evidence_claim_present',
  'evidence_gap_present',
  'source_chain_repair',
  'anecdote_used',
  'statistic_used',
  'external_authority_used',
  'evidence_quality_questioned',
  'burden_request_present',
]);

/**
 * The 8 deterministic Family D rawKeys EXCLUDED from this Subset per
 * Stage 2B operator decision. Used by `familyDKeysParity.test.ts` to
 * assert these are intentionally absent from FAMILY_D_RAW_KEYS and that
 * the registry boundary rejects them as unsupported_rawKey.
 *
 * NOTE: `source_requested` and `quote_requested` each appear twice in
 * the upstream taxonomy (under both `auto_metadata` and `lifecycle`).
 * This excluded list contains the unique rawKey strings; the duplicate
 * source-type disambiguation is irrelevant to the Subset path because
 * NEITHER source-type entry is included.
 */
export const FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS: readonly string[] = Object.freeze([
  // auto_metadata source (5 unique)
  'has_evidence',
  'source_requested',
  'quote_requested',
  'source_attached',
  'quote_attached',
  // lifecycle source (3, but 2 share rawKey strings with auto_metadata —
  // only 'sourced' is a unique string here)
  'sourced',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_D_CLASSIFIER_SET_VERSION = 'family-d-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence.
 */
export interface FamilyDPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_D_PROMPT_ENTRIES: readonly FamilyDPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'asks_for_evidence',
    label: 'Evidence requested',
    booleanQuestion:
      'Does this move ask the parent (or a prior move) to produce evidence for a claim?',
    positiveDefinition:
      "The move contains an explicit evidence request: 'what is your source?'; 'where does that number come from?'; 'can you cite something?'. Distinct from the auto-metadata source-request tag.",
    negativeDefinition:
      'The move asks for clarification of meaning (requests_clarification, Family C), challenges substantively (challenges_parent, Family A), or provides evidence itself.',
    positiveExample:
      "Move: 'What is your source for the 40% figure?'",
    negativeExample:
      "Move: 'What do you mean by infrastructure?' (clarification, not evidence ask)",
    falsePositiveGuards:
      'Do NOT confuse with requests_clarification (meaning vs evidence). Do NOT mark TRUE for rhetorical questions. An evidence request is a structural collaborative grounding move; it does NOT imply the parent failed or was dishonest.',
  }),
  Object.freeze({
    rawKey: 'provides_evidence',
    label: 'Evidence provided',
    booleanQuestion:
      'Does this move provide evidence (source, citation, quote, data) for a claim?',
    positiveDefinition:
      'The move attaches or references substantive evidence: a citation, a source URL, a quote, a data point with attribution.',
    negativeDefinition:
      'The move asserts a claim without evidence (evidence_gap_present), or makes a value claim that does not require evidence, or asks for evidence.',
    positiveExample:
      "Move: 'Per the 2024 EPA report, tailpipe emissions in EV-heavy cities dropped 40%.' (citation provided)",
    negativeExample:
      "Move: 'EVs reduce emissions.' (no evidence)",
    falsePositiveGuards:
      'Do NOT mark TRUE for assertions that mention sources without using them as evidence. Do NOT confuse with has_evidence (auto-metadata structural fact; excluded from Subset). Providing evidence is structural and recovery-positive.',
  }),
  Object.freeze({
    rawKey: 'evidence_supports_claim',
    label: 'Evidence matched to claim',
    booleanQuestion:
      'Does the evidence attached to this move actually support the specific claim being made?',
    positiveDefinition:
      'The evidence (source, quote, data) attached is relevant to the claim and is being used in a way consistent with what the source says.',
    negativeDefinition:
      'The evidence does not match the claim (wrong scope, wrong population, mischaracterized), OR no evidence is attached.',
    positiveExample:
      "Claim: 'BC carbon tax reduced emissions 5% in 5 years.' Evidence: BC government data showing 5% emission reduction 2008-2013.",
    negativeExample:
      "Claim: 'Carbon taxes always work.' Evidence: BC data only. (data does not support universal claim)",
    falsePositiveGuards:
      'Do NOT mark TRUE without inspecting whether the evidence actually says what the claim infers. Do NOT mark FALSE based on disputed interpretation — evidence-mismatch is structural.',
  }),
  Object.freeze({
    rawKey: 'creates_source_chain_gap',
    label: 'Source gap',
    booleanQuestion:
      'Does this move introduce a source-chain gap — a claim that depends on a source that is not provided or whose chain to the primary source is broken?',
    positiveDefinition:
      'The move makes a claim citing a secondary or tertiary source without linking back to the primary source (or fails to cite at all when the source is required).',
    negativeDefinition:
      'The move cites primary sources cleanly, OR repairs a prior gap (source_chain_repair), OR makes a claim that does not require sourcing.',
    positiveExample:
      "Move: 'A study showed X.' (no citation; gap in source chain)",
    negativeExample:
      "Move: 'The 2024 EPA report (Table 3.1) shows...' (cleanly sourced)",
    falsePositiveGuards:
      'Do NOT mark TRUE for value claims that do not require sources. Do NOT mark TRUE for hypothetical / scenario discussion. A source-chain gap is structural; it does NOT imply the author is dishonest or careless.',
  }),
  Object.freeze({
    rawKey: 'opens_evidence_debt_marker',
    label: 'Evidence debt opened',
    booleanQuestion:
      'Does this move open an evidence debt — a claim that has not yet been backed by evidence and is now visible as a pending obligation?',
    positiveDefinition:
      'The move makes a claim that requires evidence but provides none, AND the system marks the claim as creating an evidence-debt ledger entry.',
    negativeDefinition:
      'The move provides evidence, closes prior debt, or makes a non-evidence-requiring claim.',
    positiveExample:
      "Move: 'Library funding caused literacy gains.' (no evidence; opens debt)",
    negativeExample:
      "Move: 'Library funding caused literacy gains, per the 2024 Pittsburgh study.' (closes debt)",
    falsePositiveGuards:
      'Do NOT mark TRUE for value claims that do not require evidence. Do NOT confuse with creates_source_chain_gap; debt is the ledger marker, gap is the structural pattern. Opening evidence debt is structural; it does NOT lower standing automatically per point-standing-economy.',
  }),
  Object.freeze({
    rawKey: 'closes_evidence_debt_marker',
    label: 'Evidence debt answered',
    booleanQuestion:
      'Does this move close a prior open evidence debt by providing the required evidence?',
    positiveDefinition:
      'The move attaches evidence that closes an outstanding evidence-debt ledger entry from a prior move.',
    negativeDefinition:
      'The move opens new debt, provides evidence for a current claim without a prior open debt, or does not engage with evidence.',
    positiveExample:
      "Prior move opened debt on a literacy claim. Move: 'Per the 2024 Pittsburgh dosed-program study, K-3 literacy rose 5%.' (closes the debt)",
    negativeExample:
      "Move: 'Here is evidence for my new claim.' (provides evidence; no prior debt to close — provides_evidence)",
    falsePositiveGuards:
      'Do NOT mark TRUE without a corresponding open debt to close. Do NOT confuse with provides_evidence which is general evidence provision. Closing evidence debt is recovery-positive structural.',
  }),
  Object.freeze({
    rawKey: 'supplies_corroborating_document',
    label: 'Corroborating document',
    booleanQuestion:
      'Does this move supply a corroborating document — additional independent evidence supporting a claim that already had some evidence?',
    positiveDefinition:
      'The move supplies a SECOND or LATER piece of evidence for a claim, from an INDEPENDENT source.',
    negativeDefinition:
      'The move provides the first evidence (provides_evidence), supplies an additional source from the same provider, or restates existing evidence.',
    positiveExample:
      "Prior move cited EPA data. Move: 'The IEA 2024 report independently shows the same trend.' (corroborating)",
    negativeExample:
      "Prior move cited EPA. Move: 'Per the same EPA report, additional data shows X.' (same source, not corroborating)",
    falsePositiveGuards:
      'Do NOT mark TRUE for sources within the same publication. Do NOT mark TRUE for restatement. Corroboration is structural recovery-positive evidence.',
  }),
  Object.freeze({
    rawKey: 'source_provided',
    label: 'Source provided',
    booleanQuestion:
      'Does this move provide a source for a claim, either its own claim or one in the parent or prior move?',
    positiveDefinition:
      'The move names a source (citation / URL / DOI / institution) in service of a claim. Move-intrinsic act distinct from the auto-metadata source_attached fact (which is excluded from the Subset).',
    negativeDefinition:
      'The move asks for a source (asks_for_evidence), mentions a source without using it as backing, or makes a claim without sourcing.',
    positiveExample:
      "Move: 'You asked for a source — here it is: EPA 2024 Urban Air Quality Report, Table 3.1.'",
    negativeExample:
      "Move: 'I read this in a study somewhere.' (mentions source vaguely; not provides_source)",
    falsePositiveGuards:
      'Do NOT mark TRUE for vague source references without a citation. Do NOT confuse with source_attached (auto-metadata structural fact; excluded from Subset). Providing a source closes a source-request debt.',
  }),
  Object.freeze({
    rawKey: 'quote_provided',
    label: 'Quote provided',
    booleanQuestion:
      'Does this move provide a direct quote from a source in service of a claim?',
    positiveDefinition:
      'The move includes verbatim quoted text from a source (paper, statute, article, transcript) and uses it as backing for a claim.',
    negativeDefinition:
      'The move paraphrases without quoting, asks for a quote, or quotes the parent (quote_anchors_parent in Family A).',
    positiveExample:
      "Move: 'Per the EPA report: \"tailpipe emissions in EV-heavy cities dropped 40% from 2020 to 2023.\"' (verbatim)",
    negativeExample:
      "Move: 'The EPA reported a 40% drop.' (paraphrase, not quote)",
    falsePositiveGuards:
      'Do NOT mark TRUE for paraphrases formatted as quotes. Do NOT confuse with quote_anchors_parent (which is about the parent move, not external source). A direct quote is higher-grade evidence than paraphrase.',
  }),
  Object.freeze({
    rawKey: 'concrete_example_requested',
    label: 'Example asked',
    booleanQuestion:
      'Does this move ask the parent (or prior move) to provide a concrete example for an abstract claim?',
    positiveDefinition:
      "The move requests a concrete example: 'what is an example of that?'; 'can you point to a specific case?'; 'have you seen this work somewhere?'.",
    negativeDefinition:
      'The move asks for evidence in general (asks_for_evidence), asks for clarification (requests_clarification), or makes a substantive challenge.',
    positiveExample:
      "Move: 'Can you point to a specific city where this funding model worked?'",
    negativeExample:
      "Move: 'What is your source?' (asks_for_evidence, broader)",
    falsePositiveGuards:
      'Do NOT confuse with asks_for_evidence (broader category). An example request opens a narrower evidence sub-axis than a full source request.',
  }),
  Object.freeze({
    rawKey: 'concrete_example_provided',
    label: 'Example provided',
    booleanQuestion:
      'Does this move provide a concrete example for an abstract claim?',
    positiveDefinition:
      'The move names a specific case (city, year, person, document) that exemplifies an abstract claim, in service of supporting the claim.',
    negativeDefinition:
      'The move provides general evidence (provides_evidence), or asks for an example, or makes the abstract claim alone.',
    positiveExample:
      "Move: 'Pittsburgh 2020-2023 is a concrete case — funding rose, literacy followed.'",
    negativeExample:
      "Move: 'Library funding works.' (no example)",
    falsePositiveGuards:
      'Do NOT confuse with example_reasoning_present (Family E scheme) — example-provision is the move; example-reasoning is the inferential pattern. Providing an example is illustrative evidence.',
  }),
  Object.freeze({
    rawKey: 'evidence_claim_present',
    label: 'Evidence claim',
    booleanQuestion:
      'Does this move make a substantive claim ABOUT evidence — its existence, quality, applicability, or interpretation?',
    positiveDefinition:
      "The move's claim is about evidence itself: 'the evidence shows X'; 'no evidence supports Y'; 'the data is mixed'. Meta-evidence framing.",
    negativeDefinition:
      'The move uses evidence to support a substantive non-evidence claim, asks for evidence, or makes a claim without evidence reference.',
    positiveExample:
      "Move: 'The evidence on this question is genuinely mixed — three studies say X, two say not-X.'",
    negativeExample:
      "Move: 'X is the case.' (substantive claim about the world, not about evidence)",
    falsePositiveGuards:
      'Do NOT confuse with has_evidence (auto-metadata fact; excluded from Subset). Meta-evidence framing is structural; it does NOT determine which side bears the burden of proof.',
  }),
  Object.freeze({
    rawKey: 'evidence_gap_present',
    label: 'Evidence gap',
    booleanQuestion:
      'Does this move make a factual / empirical / statistical claim WITHOUT providing a source, quote, study citation, or other evidence?',
    positiveDefinition:
      "The move asserts a fact, a statistic, a causal claim, or a specific historical event without attaching evidence and without explicitly marking it as opinion / hypothesis / hedged.",
    negativeDefinition:
      "(a) source / quote / link attached, OR (b) explicitly hedged ('I think', 'probably'), OR (c) value claim, OR (d) pure question.",
    positiveExample:
      "Move: 'Crime rates have dropped 30% since 2010.' (statistical claim, no source)",
    negativeExample:
      "Move: 'I think crime rates have dropped a lot.' (explicitly hedged opinion)",
    falsePositiveGuards:
      'Do NOT mark TRUE for value / normative claims. Do NOT mark TRUE for explicitly hedged claims. Do NOT mark TRUE for claims with attached evidence even if the quality is contested (that is evidence_quality_questioned). Doctrine note: evidence_gap_present indicates a structural state of the move; it does NOT imply the move is dishonest, low-quality, or manipulative. Popularity / repetition / engagement are NOT evidence (cdiscourse-doctrine §3): a commonly-asserted claim with no source is an evidence gap regardless of how often it has been said elsewhere. The responder may ask for source or quote; the gap itself is advisory, never blocking.',
  }),
  Object.freeze({
    rawKey: 'source_chain_repair',
    label: 'Source chain repaired',
    booleanQuestion:
      'Does this move repair a prior source-chain gap by adding the primary source or filling the missing link?',
    positiveDefinition:
      'A prior move had creates_source_chain_gap. This move provides the primary source or fills the missing chain link.',
    negativeDefinition:
      'The move provides general evidence without addressing a prior gap, opens new debt, or makes a non-evidence claim.',
    positiveExample:
      "Prior move: 'A study showed X.' Move: 'The study is Jones 2024 in Nature Climate, doi:10.1038/...' (chain repaired)",
    negativeExample:
      "Move: 'Here is evidence for a new claim.' (no prior gap)",
    falsePositiveGuards:
      'Do NOT mark TRUE without a corresponding prior gap to repair. Source-chain repair is recovery-positive structural.',
  }),
  Object.freeze({
    rawKey: 'anecdote_used',
    label: 'Anecdote',
    booleanQuestion:
      'Does this move use a personal anecdote or single-case story as support for a claim?',
    positiveDefinition:
      "The move provides a single experiential case ('when I worked at X', 'I knew someone who', 'in my city') in support of a broader claim.",
    negativeDefinition:
      'The move provides systematic evidence, multiple cases, or makes a claim without an anecdote.',
    positiveExample:
      "Move: 'When I worked at the library, we saw firsthand how funding cuts hit programs.'",
    negativeExample:
      "Move: 'Per the 2024 systematic review, library funding cuts reduce program count.' (systematic evidence)",
    falsePositiveGuards:
      "Doctrine note: anecdote is legitimate evidence in some contexts — particularly for existence claims, mechanism examples, and lived-experience domains; copy must NOT imply weakness. anecdote_used describes a structural feature of the move (the author cites a personal or single-case story as support). It is NOT a verdict on the move's value. Do NOT confuse with example_reasoning_present (Family E scheme). The evidenceSpan must contain only the quoted anecdote text, never a judgment about its value.",
  }),
  Object.freeze({
    rawKey: 'statistic_used',
    label: 'Statistic',
    booleanQuestion:
      'Does this move use a statistic (percentage, ratio, rate, count, average) as support for a claim?',
    positiveDefinition:
      'The move cites a numerical statistic in support of a claim.',
    negativeDefinition:
      'The move makes a claim without statistics, OR mentions a number that is not statistical (a year, a phone number, an ID).',
    positiveExample:
      "Move: 'Library funding rose 12% from 2020-2023.' (statistic)",
    negativeExample:
      "Move: 'Libraries are important.' (no statistic)",
    falsePositiveGuards:
      'Do NOT mark TRUE for numbers that are not statistical (years, IDs). A statistic is a structural form of evidence; its source may be questioned (evidence_quality_questioned) but the statistic itself is descriptive.',
  }),
  Object.freeze({
    rawKey: 'external_authority_used',
    label: 'External authority',
    booleanQuestion:
      'Does this move appeal to an external authority (named expert, institution, body of work) as evidence for a claim?',
    positiveDefinition:
      'The move cites an external authority (the IPCC; the World Bank; a named expert) in support of a claim. Distinct from authority_reasoning_present (Family E scheme) — this is the evidence-act, not the scheme.',
    negativeDefinition:
      'The move provides primary data without authority appeal, OR uses authority reasoning without an external authority citation.',
    positiveExample:
      "Move: 'Per the IPCC AR6, anthropogenic emissions dominate warming.' (external authority cited)",
    negativeExample:
      "Move: 'Per my own measurements, X.' (no external authority)",
    falsePositiveGuards:
      "Do NOT confuse with authority_reasoning_present (Family E scheme). External authority use is a structural form of evidence; the authority's relevance is the operator-judgement layer, not the classifier's.",
  }),
  Object.freeze({
    rawKey: 'evidence_quality_questioned',
    label: 'Evidence quality questioned',
    booleanQuestion:
      'Does this move challenge the QUALITY of evidence the parent cited (methodology, sample size, source credibility)?',
    positiveDefinition:
      "The move targets the evidence itself: 'that study has methodological problems'; 'the sample size was small'; 'the source is partisan'. Distinct from disputes_evidence_applicability (which accepts quality but disputes fit).",
    negativeDefinition:
      'The move accepts the evidence quality and disputes applicability (disputes_evidence_applicability), or makes a substantive counter-claim, or accepts both quality and applicability.',
    positiveExample:
      "Parent cites: 'A 2020 study showed X.' Move: 'That study had a sample size of 30 — too small to generalize.' (questions quality)",
    negativeExample:
      "Move: 'The study is on knowledge workers; does not apply to my case.' (disputes_evidence_applicability)",
    falsePositiveGuards:
      'Do NOT confuse with disputes_evidence_applicability — quality is the methodological grade; applicability is the fit to the claim. Quality challenge is a structural sub-axis.',
  }),
  Object.freeze({
    rawKey: 'burden_request_present',
    label: 'Burden of proof',
    booleanQuestion:
      'Does this move invoke a burden-of-proof argument — claiming the parent has the burden to demonstrate a position and has not met it?',
    positiveDefinition:
      "'The burden of demonstration is on you'; 'until you show X, the default is Y'; 'extraordinary claims require extraordinary evidence'. Meta-evidence framing about who must produce evidence.",
    negativeDefinition:
      'The move asks for evidence directly (asks_for_evidence), provides evidence, or makes a substantive challenge.',
    positiveExample:
      "Move: 'The burden is on the policy advocate; absent showing X, the default is the status quo.'",
    negativeExample:
      "Move: 'What is your source?' (asks_for_evidence)",
    falsePositiveGuards:
      "Doctrine note: burden-of-demonstration framing is debated philosophical territory; CDiscourse treats it descriptively, not as a verdict on which side is right. burden_request_present indicates a structural request for the other party to produce evidence; it does NOT determine which side actually bears the burden in this discussion. Do NOT mark TRUE for moves that ask for evidence without framing as burden. The evidenceSpan must contain only the quoted burden framing text, never a judgment about whether the parent was right to invoke it.",
  }),
]);
