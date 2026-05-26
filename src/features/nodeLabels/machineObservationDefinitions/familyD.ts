/**
 * MCP-021A — Family D (evidence_source_chain) definitions.
 *
 * Per design §3.4: 27 entries total.
 *  - 15 existing (RETROACTIVE_VERBOSE_DEFINITIONS):
 *      auto_metadata #4-#8: has_evidence, source_requested,
 *        quote_requested, source_attached, quote_attached
 *      lifecycle #21-#23: sourced, quote_requested, source_requested
 *      ai_classifier #40-#43: asks_for_evidence, provides_evidence,
 *        evidence_supports_claim, creates_source_chain_gap
 *      ai_classifier #54-#56: opens_evidence_debt_marker,
 *        closes_evidence_debt_marker, supplies_corroborating_document
 *  - 12 NEW: source_provided, quote_provided, concrete_example_requested,
 *      concrete_example_provided, evidence_claim_present,
 *      evidence_gap_present, source_chain_repair, anecdote_used,
 *      statistic_used, external_authority_used,
 *      evidence_quality_questioned, burden_request_present.
 *
 * Decision 5 (binding): brief candidates source_requested,
 * quote_requested, source_chain_gap, evidence_applicability_questioned
 * COLLAPSE into existing keys. No aliases added.
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §3 — popularity / repetition / engagement
 *     is NOT evidence; anti-amplification anchor.
 *   - evidence-doctrine — evidence presence / gap / repair is structural;
 *     factual-standing change requires actual evidence attachment.
 *   - point-standing-economy — engagement credit and factual-standing
 *     are SEPARATE scores; evidence presence opens factual-standing
 *     eligibility.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes';

const NEW_EVIDENCE_TIMELINE_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'medium',
  selectedContextMinConfidence: 'low',
  inspectMinConfidence: 'low',
};

const NEW_EVIDENCE_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

const RETROACTIVE_HIGH_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'high',
  inspectMinConfidence: 'high',
};

interface EvidenceBuilder {
  rawKey: string;
  source: MachineObservationDefinition['source'];
  label: string;
  shortLabel: string;
  description: string;
  defaultSurface: MachineObservationDefinition['defaultSurface'];
  disposition: MachineObservationDefinition['disposition'];
  priority: number;
  visibleByDefault: boolean;
  booleanQuestion: string;
  positiveDefinition: string;
  negativeDefinition: string;
  positiveExamples: ReadonlyArray<string>;
  negativeExamples: ReadonlyArray<string>;
  falsePositiveGuards: ReadonlyArray<string>;
  doctrineNotes: ReadonlyArray<string>;
  confidenceEligibility: MachineObservationDefinition['confidenceEligibility'];
}

function buildEvidence(b: EvidenceBuilder): MachineObservationDefinition {
  return Object.freeze({
    id: `registry:machine_observation:${b.source}:${b.rawKey}`,
    rawKey: b.rawKey,
    kind: 'machine_observation' as const,
    source: b.source,
    family: 'evidence_source_chain' as const,
    label: b.label,
    shortLabel: b.shortLabel,
    description: b.description,
    defaultSurface: b.defaultSurface,
    disposition: b.disposition,
    priority: b.priority,
    visibleByDefault: b.visibleByDefault,
    booleanQuestion: b.booleanQuestion,
    positiveDefinition: b.positiveDefinition,
    negativeDefinition: b.negativeDefinition,
    positiveExamples: b.positiveExamples,
    negativeExamples: b.negativeExamples,
    falsePositiveGuards: b.falsePositiveGuards,
    doctrineNotes: b.doctrineNotes,
    confidenceEligibility: b.confidenceEligibility,
  });
}

export const FAMILY_D_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // ── RETROACTIVE: 15 existing entries ──

  // #4 has_evidence (auto_metadata)
  buildEvidence({
    rawKey: 'has_evidence',
    source: 'auto_metadata',
    label: 'Evidence',
    shortLabel: 'Evidence',
    description: 'Evidence is attached to this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 20,
    visibleByDefault: true,
    booleanQuestion: 'Does this move have at least one piece of evidence attached as auto-metadata?',
    positiveDefinition:
      'Auto-metadata fact: the move has evidence-typed attachments (source URL, quote, document, etc.) recorded in the move metadata.',
    negativeDefinition: 'No evidence-typed attachments are recorded for this move.',
    positiveExamples: Object.freeze([
      "Move with attached source URL → has_evidence = TRUE.",
      "Move with attached quote → has_evidence = TRUE.",
    ]),
    negativeExamples: Object.freeze([
      "Move with no attachments → has_evidence = FALSE.",
      "Move with only an internal note attachment (not evidence-typed) → has_evidence = FALSE.",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE based on tone of confidence; only attached evidence counts.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural auto-metadata fact.',
      'evidence-doctrine: has_evidence opens factual-standing eligibility for the claim.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #5 source_requested (auto_metadata)
  buildEvidence({
    rawKey: 'source_requested',
    source: 'auto_metadata',
    label: 'Source asked',
    shortLabel: 'Source asked',
    description: 'A source has been requested for this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 15,
    visibleByDefault: true,
    booleanQuestion: 'Does this move have a source request attached as auto-metadata?',
    positiveDefinition: 'Auto-metadata: a participant has explicitly tagged this move with a source-request action.',
    negativeDefinition: 'No source request is recorded.',
    positiveExamples: Object.freeze(['Move with source-request action attached → TRUE.']),
    negativeExamples: Object.freeze(['Move with no source-request → FALSE.']),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with asks_for_evidence (the AI-classifier signal); this is the structural metadata fact.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: auto-metadata structural fact.',
      'evidence-doctrine: source request opens evidence debt; closing requires actual evidence attachment.',
      'Decision 5: brief candidate source_requested collapses into this existing key. No alias added.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #6 quote_requested (auto_metadata)
  buildEvidence({
    rawKey: 'quote_requested',
    source: 'auto_metadata',
    label: 'Quote asked',
    shortLabel: 'Quote asked',
    description: 'A direct quote has been requested for this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 16,
    visibleByDefault: true,
    booleanQuestion: 'Does this move have a quote request attached as auto-metadata?',
    positiveDefinition: 'Auto-metadata: a participant has explicitly tagged this move with a quote-request action.',
    negativeDefinition: 'No quote request is recorded.',
    positiveExamples: Object.freeze(['Move with quote-request action attached → TRUE.']),
    negativeExamples: Object.freeze(['Move with no quote-request → FALSE.']),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for source-requests that are not quote-specific.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural auto-metadata fact.',
      'evidence-doctrine: quote request narrows the evidence ask to direct primary attribution.',
      'Decision 5: brief candidate quote_requested collapses into this existing key.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #7 source_attached (auto_metadata)
  buildEvidence({
    rawKey: 'source_attached',
    source: 'auto_metadata',
    label: 'Source',
    shortLabel: 'Source',
    description: 'A source is attached to this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 18,
    visibleByDefault: true,
    booleanQuestion: 'Does this move have a source URL or citation attached as auto-metadata?',
    positiveDefinition: 'Auto-metadata: at least one source URL or citation is attached to the move.',
    negativeDefinition: 'No source attachment exists.',
    positiveExamples: Object.freeze(['Move with attached URL or DOI → TRUE.']),
    negativeExamples: Object.freeze(['Move with only an internal note → FALSE.']),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for in-body links that are not formal attachments.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural auto-metadata fact.',
      'evidence-doctrine: source attachment opens factual-standing eligibility once relevance is established.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #8 quote_attached (auto_metadata)
  buildEvidence({
    rawKey: 'quote_attached',
    source: 'auto_metadata',
    label: 'Quote',
    shortLabel: 'Quote',
    description: 'A direct quote is attached to this move.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 19,
    visibleByDefault: true,
    booleanQuestion: 'Does this move have a direct quote attached as auto-metadata?',
    positiveDefinition: 'Auto-metadata: at least one quote is attached, identifying the source\'s direct words.',
    negativeDefinition: 'No quote attachment exists.',
    positiveExamples: Object.freeze(['Move with attached quote → TRUE.']),
    negativeExamples: Object.freeze(['Move with paraphrase only → FALSE.']),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with quoted text within the move body that is not formally attached.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural auto-metadata fact.',
      'evidence-doctrine: direct quote is higher-grade evidence than paraphrase.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #21 sourced (lifecycle)
  buildEvidence({
    rawKey: 'sourced',
    source: 'lifecycle',
    label: 'Sourced',
    shortLabel: 'Sourced',
    description: 'A source has been attached in this cluster.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 17,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the sourced lifecycle state — a source has been attached in response to a source request?',
    positiveDefinition: 'Lifecycle state: the cluster had a source request, and at least one source has been attached.',
    negativeDefinition: 'No source request, OR source request is open with no attachment.',
    positiveExamples: Object.freeze(['Cluster: claim → source request → source attached → sourced state.']),
    negativeExamples: Object.freeze(['Cluster with open source request, no attachment → still requested.']),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with source_attached (move-level fact).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: lifecycle state.',
      'evidence-doctrine: sourced closes a source-request debt.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #22 quote_requested (lifecycle)
  buildEvidence({
    rawKey: 'quote_requested',
    source: 'lifecycle',
    label: 'Quote asked',
    shortLabel: 'Quote asked',
    description: 'A direct quote has been requested.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 16,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the quote_requested lifecycle state — a quote request is open?',
    positiveDefinition: 'Lifecycle state: an open quote request exists in the cluster.',
    negativeDefinition: 'No quote request, or quote request is closed by attachment.',
    positiveExamples: Object.freeze(['Cluster with open quote request → TRUE.']),
    negativeExamples: Object.freeze(['Cluster with closed quote request → moved to sourced.']),
    falsePositiveGuards: Object.freeze([
      'Compound key disambiguates from auto_metadata quote_requested.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: lifecycle state.',
      'evidence-doctrine: open quote request is open evidence debt.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #23 source_requested (lifecycle)
  buildEvidence({
    rawKey: 'source_requested',
    source: 'lifecycle',
    label: 'Source asked',
    shortLabel: 'Source asked',
    description: 'A source has been requested.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 15,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the source_requested lifecycle state — a source request is open?',
    positiveDefinition: 'Lifecycle state: an open source request exists in the cluster.',
    negativeDefinition: 'No source request, or source request is closed by attachment.',
    positiveExamples: Object.freeze(['Cluster with open source request → TRUE.']),
    negativeExamples: Object.freeze(['Cluster moved to sourced state.']),
    falsePositiveGuards: Object.freeze([
      'Compound key disambiguates from auto_metadata source_requested.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: lifecycle state.',
      'evidence-doctrine: open source request is open evidence debt.',
    ]),
    confidenceEligibility: RETROACTIVE_HIGH_ELIGIBILITY,
  }),

  // #40 asks_for_evidence (ai_classifier)
  buildEvidence({
    rawKey: 'asks_for_evidence',
    source: 'ai_classifier',
    label: 'Evidence requested',
    shortLabel: 'Evidence?',
    description: 'Evidence is requested here.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 15,
    visibleByDefault: false,
    booleanQuestion: 'Does this move ask the parent (or a prior move) to produce evidence for a claim?',
    positiveDefinition: 'The move contains an explicit evidence request: "what is your source?"; "where does that number come from?"; "can you cite something?".',
    negativeDefinition: 'The move asks for clarification of meaning (requests_clarification, Family C), challenges substantively (challenges_parent), or provides evidence itself.',
    positiveExamples: Object.freeze([
      "Move: 'What is your source for the 40% figure?'",
      "Move: 'Can you cite the study you are drawing from?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What do you mean by infrastructure?' (clarification, not evidence ask)",
      "Move: 'I do not think that is right.' (challenges, not asks)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with requests_clarification (meaning vs evidence).',
      'Do NOT mark TRUE for rhetorical questions.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: evidence request is structural; opens a productive sub-axis.',
      'evidence-doctrine: evidence request opens debt; closing requires actual evidence.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // #41 provides_evidence (ai_classifier)
  buildEvidence({
    rawKey: 'provides_evidence',
    source: 'ai_classifier',
    label: 'Evidence provided',
    shortLabel: 'Evidence',
    description: 'Evidence is provided here.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 20,
    visibleByDefault: false,
    booleanQuestion: 'Does this move provide evidence (source, citation, quote, data) for a claim?',
    positiveDefinition: 'The move attaches or references substantive evidence: a citation, a source URL, a quote, a data point with attribution.',
    negativeDefinition: 'The move asserts a claim without evidence (evidence_gap_present), or makes a value claim that does not require evidence, or asks for evidence.',
    positiveExamples: Object.freeze([
      "Move: 'Per the 2024 EPA report, tailpipe emissions in EV-heavy cities dropped 40%.' (citation provided)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'EVs reduce emissions.' (no evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for assertions that mention sources without using them as evidence.',
      'Do NOT confuse with has_evidence (auto-metadata structural fact).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: evidence provision is structural and a recovery-positive move.',
      'evidence-doctrine: evidence provision closes evidence debt and opens factual-standing eligibility.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // #42 evidence_supports_claim (ai_classifier)
  buildEvidence({
    rawKey: 'evidence_supports_claim',
    source: 'ai_classifier',
    label: 'Evidence matched to claim',
    shortLabel: 'Matched',
    description: 'Evidence appears to match the claim.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 50,
    visibleByDefault: false,
    booleanQuestion: 'Does the evidence attached to this move actually support the specific claim being made?',
    positiveDefinition: 'The evidence (source, quote, data) attached is relevant to the claim and is being used in a way consistent with what the source says.',
    negativeDefinition: 'The evidence does not match the claim (wrong scope, wrong population, cherry-picked, mischaracterized), OR no evidence is attached.',
    positiveExamples: Object.freeze([
      "Claim: 'BC carbon tax reduced emissions 5% in 5 years.' Evidence: BC government data showing 5% emission reduction 2008-2013. → TRUE",
    ]),
    negativeExamples: Object.freeze([
      "Claim: 'Carbon taxes always work.' Evidence: BC data only. → FALSE (data does not support universal claim)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE without inspecting whether the evidence actually says what the claim infers.',
      'Do NOT mark FALSE based on disputed interpretation — evidence-mismatch is structural.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: evidence-claim match is structural.',
      'evidence-doctrine: high-signal evidence match is the foundation of factual standing.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // #43 creates_source_chain_gap (ai_classifier)
  buildEvidence({
    rawKey: 'creates_source_chain_gap',
    source: 'ai_classifier',
    label: 'Source gap',
    shortLabel: 'Source gap',
    description: 'A gap in the source chain has appeared.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 12,
    visibleByDefault: false,
    booleanQuestion: 'Does this move introduce a source-chain gap — a claim that depends on a source that is not provided or whose chain to the primary source is broken?',
    positiveDefinition: 'The move makes a claim citing a secondary or tertiary source without linking back to the primary source (or fails to cite at all when the source is required).',
    negativeDefinition: 'The move cites primary sources cleanly, OR repairs a prior gap (source_chain_repair), OR makes a claim that does not require sourcing.',
    positiveExamples: Object.freeze([
      "Move: 'A study showed X.' (no citation; gap in source chain)",
      "Move: 'It is widely reported that Y.' (secondhand without primary source)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The 2024 EPA report (Table 3.1) shows...' (cleanly sourced)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for value claims that do not require sources.',
      'Do NOT mark TRUE for hypothetical / scenario discussion.',
      'Decision 5: brief candidate source_chain_gap collapses into this existing key.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: source-chain gap is structural; opens evidence debt.',
      'evidence-doctrine: source-chain gap is the core of evidence-debt tracking.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // #54 opens_evidence_debt_marker (ai_classifier)
  buildEvidence({
    rawKey: 'opens_evidence_debt_marker',
    source: 'ai_classifier',
    label: 'Evidence debt opened',
    shortLabel: 'Debt open',
    description: 'An evidence debt was opened.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 13,
    visibleByDefault: false,
    booleanQuestion: 'Does this move open an evidence debt — a claim that has not yet been backed by evidence and is now visible as a pending obligation?',
    positiveDefinition: 'The move makes a claim that requires evidence but provides none, AND the system marks the claim as creating an evidence-debt ledger entry.',
    negativeDefinition: 'The move provides evidence, closes prior debt, or makes a non-evidence-requiring claim.',
    positiveExamples: Object.freeze([
      "Move: 'Library funding caused literacy gains.' (no evidence; opens debt)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding caused literacy gains, per the 2024 Pittsburgh study.' (closes debt)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for value claims that do not require evidence.',
      'Do NOT confuse with creates_source_chain_gap; debt is the ledger marker, gap is the structural pattern.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: evidence-debt opening is structural.',
      'evidence-doctrine: debt is the ledger primitive for tracking unbacked claims; closing requires evidence.',
      'point-standing-economy: open evidence debt suppresses factual-standing credit until closed.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // #55 closes_evidence_debt_marker (ai_classifier)
  buildEvidence({
    rawKey: 'closes_evidence_debt_marker',
    source: 'ai_classifier',
    label: 'Evidence debt answered',
    shortLabel: 'Debt closed',
    description: 'An evidence debt was answered.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 14,
    visibleByDefault: false,
    booleanQuestion: 'Does this move close a prior open evidence debt by providing the required evidence?',
    positiveDefinition: 'The move attaches evidence that closes an outstanding evidence-debt ledger entry from a prior move.',
    negativeDefinition: 'The move opens new debt, provides evidence for a current claim without a prior open debt, or does not engage with evidence.',
    positiveExamples: Object.freeze([
      "Prior move opened debt on a literacy claim. Move: 'Per the 2024 Pittsburgh dosed-program study, K-3 literacy rose 5%.' (closes the debt)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Here is evidence for my new claim.' (provides evidence; no prior debt to close → provides_evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE without a corresponding open debt to close.',
      'Do NOT confuse with provides_evidence which is general evidence provision.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: debt-close is recovery-positive structural fact.',
      'evidence-doctrine: closing debt restores factual-standing eligibility.',
      'point-standing-economy: closing debt earns standing-repair credit.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // #56 supplies_corroborating_document (ai_classifier)
  buildEvidence({
    rawKey: 'supplies_corroborating_document',
    source: 'ai_classifier',
    label: 'Corroborating document',
    shortLabel: 'Corroborated',
    description: 'A corroborating document was supplied.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 19,
    visibleByDefault: false,
    booleanQuestion: 'Does this move supply a corroborating document — additional independent evidence supporting a claim that already had some evidence?',
    positiveDefinition: 'The move supplies a SECOND or LATER piece of evidence for a claim, from an INDEPENDENT source.',
    negativeDefinition: 'The move provides the first evidence (provides_evidence), supplies an additional source from the same provider, or restates existing evidence.',
    positiveExamples: Object.freeze([
      "Prior move cited EPA data. Move: 'The IEA 2024 report independently shows the same trend.' (corroborating)",
    ]),
    negativeExamples: Object.freeze([
      "Prior move cited EPA. Move: 'Per the same EPA report, additional data shows X.' (same source, not corroborating)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for sources within the same publication.',
      'Do NOT mark TRUE for restatement.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: corroboration is structural recovery-positive.',
      'evidence-doctrine: independent corroboration is high-value factual-standing evidence.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // ── NEW: 12 entries ──

  // NEW #1 source_provided
  buildEvidence({
    rawKey: 'source_provided',
    source: 'ai_classifier',
    label: 'Source provided',
    shortLabel: 'Source +',
    description: 'This move provides a source.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 150,
    visibleByDefault: false,
    booleanQuestion: 'Does this move provide a source for a claim, either its own claim or one in the parent / prior move?',
    positiveDefinition: 'The move names a source (citation / URL / DOI / institution) in service of a claim. Move-intrinsic act distinct from source_attached (auto-metadata fact).',
    negativeDefinition: 'The move asks for a source (asks_for_evidence), mentions a source without using it as backing, or makes a claim without sourcing.',
    positiveExamples: Object.freeze([
      "Move: 'You asked for a source — here it is: EPA 2024 Urban Air Quality Report, Table 3.1.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What is your source?' (asks_for_evidence)",
      "Move: 'I read this in a study somewhere.' (mentions source vaguely; not provides_source)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for vague source references without a citation.',
      'Do NOT confuse with source_attached (auto-metadata structural fact).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: source provision is structural.',
      'evidence-doctrine: provides_source closes a source-request debt.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // NEW #2 quote_provided
  buildEvidence({
    rawKey: 'quote_provided',
    source: 'ai_classifier',
    label: 'Quote provided',
    shortLabel: 'Quote +',
    description: 'This move provides a direct quote.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 151,
    visibleByDefault: false,
    booleanQuestion: 'Does this move provide a direct quote from a source in service of a claim?',
    positiveDefinition: 'The move includes verbatim quoted text from a source (paper, statute, article, transcript) and uses it as backing for a claim.',
    negativeDefinition: 'The move paraphrases without quoting, asks for a quote (asks_for_evidence in quote form), or quotes the parent (quote_anchors_parent in Family A).',
    positiveExamples: Object.freeze([
      "Move: 'Per the EPA report: \"tailpipe emissions in EV-heavy cities dropped 40% from 2020 to 2023.\"' (verbatim)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The EPA reported a 40% drop.' (paraphrase, not quote)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for paraphrases formatted as quotes.',
      'Do NOT confuse with quote_anchors_parent (which is about the parent move, not external source).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: quote provision is structural higher-grade evidence.',
      'evidence-doctrine: direct quote is the highest-grade evidence; closes quote-request debt.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // NEW #3 concrete_example_requested
  buildEvidence({
    rawKey: 'concrete_example_requested',
    source: 'ai_classifier',
    label: 'Example asked',
    shortLabel: 'Example?',
    description: 'A concrete example is requested.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 152,
    visibleByDefault: false,
    booleanQuestion: 'Does this move ask the parent (or prior move) to provide a concrete example for an abstract claim?',
    positiveDefinition: 'The move requests a concrete example: "what is an example of that?"; "can you point to a specific case?"; "have you seen this work somewhere?".',
    negativeDefinition: 'The move asks for evidence in general (asks_for_evidence), asks for clarification (requests_clarification), or makes a substantive challenge.',
    positiveExamples: Object.freeze([
      "Move: 'Can you point to a specific city where this funding model worked?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What is your source?' (asks_for_evidence, broader)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with asks_for_evidence (broader category).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: example request is structural.',
      'evidence-doctrine: example request opens a narrower evidence sub-axis than full source request.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // NEW #4 concrete_example_provided
  buildEvidence({
    rawKey: 'concrete_example_provided',
    source: 'ai_classifier',
    label: 'Example provided',
    shortLabel: 'Example +',
    description: 'A concrete example is provided.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 153,
    visibleByDefault: false,
    booleanQuestion: 'Does this move provide a concrete example for an abstract claim?',
    positiveDefinition: 'The move names a specific case (city, year, person, document) that exemplifies an abstract claim, in service of supporting the claim.',
    negativeDefinition: 'The move provides general evidence (provides_evidence), or asks for an example, or makes the abstract claim alone.',
    positiveExamples: Object.freeze([
      "Move: 'Pittsburgh 2020-2023 is a concrete case — funding rose, literacy followed.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Library funding works.' (no example)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with example_reasoning_present (Family E scheme) — example-provision is the move; example-reasoning is the inferential pattern.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: example provision is recovery-positive structural fact.',
      'evidence-doctrine: example provision is illustrative evidence.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // NEW #5 evidence_claim_present
  buildEvidence({
    rawKey: 'evidence_claim_present',
    source: 'ai_classifier',
    label: 'Evidence claim',
    shortLabel: 'Evid claim',
    description: 'This move makes a claim about evidence.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 154,
    visibleByDefault: false,
    booleanQuestion: 'Does this move make a substantive claim ABOUT evidence — its existence, quality, applicability, or interpretation?',
    positiveDefinition: 'The move\'s claim is about evidence itself: "the evidence shows X"; "no evidence supports Y"; "the data is mixed". Meta-evidence framing.',
    negativeDefinition: 'The move uses evidence to support a substantive non-evidence claim, asks for evidence, or makes a claim without evidence reference.',
    positiveExamples: Object.freeze([
      "Move: 'The evidence on this question is genuinely mixed — three studies say X, two say not-X.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'X is true.' (substantive claim)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with has_evidence (auto-metadata fact).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: meta-evidence claims are structural.',
      'evidence-doctrine: evidence-about-evidence framing is common in meta-analysis discussions.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // NEW #6 evidence_gap_present
  buildEvidence({
    rawKey: 'evidence_gap_present',
    source: 'ai_classifier',
    label: 'Evidence gap',
    shortLabel: 'Evid gap',
    description: 'This move makes a claim that would normally require evidence but does not provide one.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 110,
    visibleByDefault: false,
    booleanQuestion: 'Does this move make a factual / empirical / statistical claim WITHOUT providing a source, quote, study citation, or other evidence?',
    positiveDefinition: 'The move asserts a fact, a statistic, a causal claim, or a specific historical event without attaching evidence and without explicitly marking it as opinion / hypothesis / hedged.',
    negativeDefinition: '(a) source / quote / link attached, OR (b) explicitly hedged ("I think", "probably"), OR (c) value claim, OR (d) pure question.',
    positiveExamples: Object.freeze([
      "Move: 'Crime rates have dropped 30% since 2010.' (statistical claim, no source)",
      "Move: 'Studies consistently show this.' (gestures at evidence without citing)",
      "Move: 'Everyone knows policy X caused outcome Y.' (causal claim, no evidence)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Crime rates have dropped 30% since 2010 (per FBI UCR 2010-2023).' (source attached)",
      "Move: 'I think crime rates have dropped a lot.' (explicitly hedged opinion)",
      "Move: 'Crime victim experiences matter morally.' (value claim)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for value / normative claims.',
      'Do NOT mark TRUE for explicitly hedged claims.',
      'Do NOT mark TRUE for claims with attached evidence even if the quality is contested (that is evidence_quality_questioned).',
    ]),
    doctrineNotes: Object.freeze([
      'evidence-doctrine: evidence gap is a structural observation; the responder may ask for source, quote, or open evidence debt. Advisory, never blocking.',
      'cdiscourse-doctrine §3: popularity / repetition / engagement is NOT evidence; this rawKey enforces the boundary.',
      'point-standing-economy: an evidence gap does not automatically lower standing; standing changes when challenged and the gap persists.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // NEW #7 source_chain_repair
  buildEvidence({
    rawKey: 'source_chain_repair',
    source: 'ai_classifier',
    label: 'Source chain repaired',
    shortLabel: 'Chain fix',
    description: 'This move repairs a prior source-chain gap by adding the primary source.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 155,
    visibleByDefault: false,
    booleanQuestion: 'Does this move repair a prior source-chain gap by adding the primary source or filling the missing link?',
    positiveDefinition: 'A prior move had creates_source_chain_gap. This move provides the primary source or fills the missing chain link.',
    negativeDefinition: 'The move provides general evidence without addressing a prior gap, opens new debt, or makes a non-evidence claim.',
    positiveExamples: Object.freeze([
      "Prior move: 'A study showed X.' Move: 'The study is Jones 2024 in Nature Climate, doi:10.1038/...' (chain repaired)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Here is evidence for a new claim.' (no prior gap)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE without a corresponding prior gap to repair.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: source-chain repair is recovery-positive structural fact.',
      'evidence-doctrine: chain repair restores factual-standing eligibility for the original claim.',
      'point-standing-economy: chain repair earns standing-repair credit.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_TIMELINE_ELIGIBILITY,
  }),

  // NEW #8 anecdote_used
  buildEvidence({
    rawKey: 'anecdote_used',
    source: 'ai_classifier',
    label: 'Anecdote',
    shortLabel: 'Anecdote',
    description: 'This move uses an anecdote as support.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 156,
    visibleByDefault: false,
    booleanQuestion: 'Does this move use a personal anecdote or single-case story as support for a claim?',
    positiveDefinition: 'The move provides a single experiential case ("when I worked at X", "I knew someone who", "in my city") in support of a broader claim.',
    negativeDefinition: 'The move provides systematic evidence, multiple cases, or makes a claim without an anecdote.',
    positiveExamples: Object.freeze([
      "Move: 'When I worked at the library, we saw firsthand how funding cuts hit programs.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Per the 2024 systematic review, library funding cuts reduce program count.' (systematic evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Doctrine note: anecdote is legitimate evidence in some contexts; copy must NOT imply weakness.',
      'Do NOT confuse with example_reasoning_present (Family E scheme).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: anecdote is a structural form of evidence; never a verdict on argument quality.',
      'evidence-doctrine: anecdote has lower factual-standing weight than systematic evidence but is not "no evidence".',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // NEW #9 statistic_used
  buildEvidence({
    rawKey: 'statistic_used',
    source: 'ai_classifier',
    label: 'Statistic',
    shortLabel: 'Statistic',
    description: 'This move uses a statistic as support.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 157,
    visibleByDefault: false,
    booleanQuestion: 'Does this move use a statistic (percentage, ratio, rate, count, average) as support for a claim?',
    positiveDefinition: 'The move cites a numerical statistic in support of a claim.',
    negativeDefinition: 'The move makes a claim without statistics, OR mentions a number that is not statistical (a year, a phone number, an ID).',
    positiveExamples: Object.freeze([
      "Move: 'Library funding rose 12% from 2020-2023.' (statistic)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Libraries are important.' (no statistic)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for numbers that are not statistical (years, IDs).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: statistic use is a structural form of evidence.',
      'cdiscourse-doctrine §3: a statistic is not automatically authoritative; its source can be questioned.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // NEW #10 external_authority_used
  buildEvidence({
    rawKey: 'external_authority_used',
    source: 'ai_classifier',
    label: 'External authority',
    shortLabel: 'Ext auth',
    description: 'This move appeals to an external authority as evidence.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 158,
    visibleByDefault: false,
    booleanQuestion: 'Does this move appeal to an external authority (named expert, institution, body of work) as evidence for a claim?',
    positiveDefinition: 'The move cites an external authority (the IPCC; the World Bank; a named expert) in support of a claim. Distinct from authority_reasoning_present (Family E scheme) — this is the evidence-act, not the scheme.',
    negativeDefinition: 'The move provides primary data without authority appeal, OR uses authority reasoning without an external authority citation.',
    positiveExamples: Object.freeze([
      "Move: 'Per the IPCC AR6, anthropogenic emissions dominate warming.' (external authority cited)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Per my own measurements, X.' (no external authority)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with authority_reasoning_present (Family E scheme).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: external authority use is structural form of evidence.',
      'evidence-doctrine: external authority is moderate-to-high grade evidence depending on the authority\'s relevance.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // NEW #11 evidence_quality_questioned
  buildEvidence({
    rawKey: 'evidence_quality_questioned',
    source: 'ai_classifier',
    label: 'Evidence quality questioned',
    shortLabel: 'Qual?',
    description: 'This move questions the quality of evidence the parent cited.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 159,
    visibleByDefault: false,
    booleanQuestion: 'Does this move challenge the QUALITY of evidence the parent cited (methodology, sample size, source credibility)?',
    positiveDefinition: 'The move targets the evidence itself: "that study has methodological problems"; "the sample size was small"; "the source is partisan". Distinct from disputes_evidence_applicability (which accepts quality but disputes fit).',
    negativeDefinition: 'The move accepts the evidence quality and disputes applicability (disputes_evidence_applicability), or makes a substantive counter-claim, or accepts both quality and applicability.',
    positiveExamples: Object.freeze([
      "Parent cites: 'A 2020 study showed X.' Move: 'That study had a sample size of 30 — too small to generalize.' (questions quality)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The study is on knowledge workers; does not apply to my case.' (disputes_evidence_applicability)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with disputes_evidence_applicability — quality is the methodological grade; applicability is the fit to the claim.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: quality challenge is structural sub-axis.',
      'evidence-doctrine: quality challenge can reduce factual-standing weight of cited evidence.',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),

  // NEW #12 burden_request_present
  buildEvidence({
    rawKey: 'burden_request_present',
    source: 'ai_classifier',
    label: 'Burden of proof',
    shortLabel: 'Burden?',
    description: 'This move invokes a burden-of-proof argument.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 160,
    visibleByDefault: false,
    booleanQuestion: 'Does this move invoke a burden-of-proof argument — claiming the parent has the burden to prove a position and has not met it?',
    positiveDefinition: '"The burden of proof is on you"; "until you show X, the default is Y"; "extraordinary claims require extraordinary evidence". Meta-evidence framing about who must produce evidence.',
    negativeDefinition: 'The move asks for evidence directly (asks_for_evidence), provides evidence, or makes a substantive challenge.',
    positiveExamples: Object.freeze([
      "Move: 'The burden of proof is on the policy advocate; absent showing X, the default is the status quo.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What is your source?' (asks_for_evidence)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that ask for evidence without framing as burden.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: burden-of-proof framing is structural meta-evidence move.',
      'evidence-doctrine: burden-of-proof framing is debated philosophical territory; CDiscourse treats it descriptively, not as a verdict on which side is "right".',
    ]),
    confidenceEligibility: NEW_EVIDENCE_INSPECT_ELIGIBILITY,
  }),
]);
