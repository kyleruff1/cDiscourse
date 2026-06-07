/**
 * MCP-SERVER-010-FAMILY-I — Family I (thread_topology) 6-key ai_classifier
 * MIXED-source Subset constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family I registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyI.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyIKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * MIXED ai_classifier Subset path: per design §A.1.0/§A.1.1 + Stage 2B
 * binding (T1 only — mixed-source provenance; T3 NOT FIRED, doctrine-risk
 * LOW), the upstream `familyI.ts` taxonomy declares 21 rawKey entries with
 * MIXED source — 8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier`. The
 * MCP-server classifier handles the **6 `ai_classifier` keys ONLY** (the
 * text-derivable thread-graph relations). The 8 auto_metadata keys are
 * deterministically derivable from argument-tree structure
 * (threadTopologyAutoMetadata.ts; no-op stubs in MCP-021A) and the 7
 * lifecycle keys are cluster/temporal-derived; both are NOT LLM-classified
 * and are EXCLUDED here (the `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS`
 * constant; mirrors Family D + Family G mixed-source keys files). Requesting
 * any of the 15 excluded keys under requestedFamilies=['thread_topology']
 * returns unsupported_rawKey at the registry boundary (no silent-false).
 *
 * NO `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` ENTRY in THIS card: per the §D2
 * resolution the Edge `booleanObservationRequestBuilder.ts` entry is
 * DEFERRED to a separate Edge-subset follow-up card / Card 3 (mirror Family
 * G #354 → #355). This card is NOT Edge-bearing; HALT trigger #14 guards
 * the entry's absence.
 *
 * The 6 rawKeys are the binding contract per MCP-SERVER-010-FAMILY-I design
 * §A.1.1 + Stage 2B T1 operator decision. Verbatim, in declaration order
 * matching the upstream `ai_classifier`-source entries of `familyI.ts`:
 *
 *   1.  introduces_new_issue          (LOW — "introduces a new topic distinct from the parent" is structural topology; misreadable as "off-topic" — carries verbatim doctrine guard)
 *   2.  references_prior_agreement    (LOW — "cites a previously-agreed point" is structural recovery-positive; no verdict adjacency)
 *   3.  introduces_sub_axis           (LOW — "opens a more specific dimension of the parent's topic" is structural narrowing; no verdict adjacency)
 *   4.  returns_to_prior_issue        (LOW — "re-engages a parked topic" is structural; misreadable as "rehashing" — carries verbatim doctrine guard)
 *   5.  references_external_context   (LOW — "brings in a URL/document/event from outside the room" is structural reference; popularity ≠ evidence guard)
 *   6.  compares_options             (LOW — "weighs two+ options on stated criteria" is structural recovery-positive; never picks a winner)
 *
 * The upstream taxonomy already DROPPED the one verdict-adjacent candidate
 * `repeats_prior_point` (Trigger-10 doctrine-risk: "repeats reads as verdict
 * on contribution", familyI.ts:28-30), leaving a clean descriptive set. This
 * is the structural reason I's doctrine-risk is genuinely LOW where H's was
 * YES — the verdict-adjacent key was pruned upstream before this card. There
 * is no axis-partner / HIGHEST-risk key; the 2 keys with any misreading
 * surface (introduces_new_issue + returns_to_prior_issue) carry verbatim
 * proportional doctrine lines per design §A.3.2.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict about a person or intent. A
 *     thread-topology observation describes HOW A MOVE RELATES TO THE
 *     CONVERSATION GRAPH, not the move's merit.
 *   - cdiscourse-doctrine §1 — thread-topology relations are DESCRIPTIVE
 *     STRUCTURE, never verdicts. A new issue is not a derailment; returning
 *     to a prior issue is not repetition; comparing options is not picking
 *     a winner. The classifier NEVER labels a move "off-topic", "derailing",
 *     "evasive", "rehashing", "repetitive", "going in circles".
 *   - cdiscourse-doctrine §3 — popularity ≠ evidence. The
 *     references_external_context key records the structural fact of an
 *     external reference; it NEVER treats virality / engagement of an
 *     external source as granting factual standing.
 *   - point-standing-economy — Family I is descriptive; an
 *     introduces_new_issue / sub_axis / returns positive does NOT lower the
 *     move's factual standing eligibility. Topology relations are SHAPES,
 *     not standing penalties. I emits no standing delta. (The lifecycle keys
 *     that DO affect scoring eligibility — moved_on_by_* / ignored_by_* —
 *     are the EXCLUDED deterministic keys, out of scope for this card.)
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family
 * A/B/C/D/E/F/G/H pattern.
 */

/**
 * The 6 Family I ai_classifier rawKeys, frozen in declaration order
 * matching upstream. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in upstream
 *     `familyI.ts` as a string literal with source: 'ai_classifier' AND
 *     that upstream has exactly 8 auto_metadata + 7 lifecycle entries that
 *     are EXCLUDED here)
 */
export const FAMILY_I_RAW_KEYS: readonly string[] = Object.freeze([
  'introduces_new_issue',
  'references_prior_agreement',
  'introduces_sub_axis',
  'returns_to_prior_issue',
  'references_external_context',
  'compares_options',
]);

/**
 * The 15 deterministic Family I rawKeys EXCLUDED from this Subset per Stage
 * 2B operator decision (T1 mixed-source). Used by
 * `familyIKeysParity.test.ts` to assert these are intentionally absent from
 * FAMILY_I_RAW_KEYS and by `familyBooleanRequestSchema.test.ts` to assert
 * the registry boundary rejects them as unsupported_rawKey (mirror Family D
 * + Family G). 8 auto_metadata + 7 lifecycle = 15 unique rawKey strings.
 *
 * The 8 auto_metadata keys are deterministically derivable from argument-tree
 * structure (threadTopologyAutoMetadata.ts; no-op stubs in MCP-021A; real
 * derivers are future MCP-021C territory). The 7 lifecycle keys are
 * cluster/temporal-derived. Neither is LLM-classified; both are out of scope
 * for this card (D3). All 21 Family I strings are unique within the family
 * (no name-pair collision across sources, unlike Family G), so the included
 * + excluded sets are disjoint and union to 21.
 */
export const FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS: readonly string[] = Object.freeze([
  // auto_metadata source (8)
  'has_reply',
  'participant_skipped_node',
  'no_response_after_n_turns',
  'repeated_axis_pressure',
  'splits_thread',
  'merges_thread',
  'references_sibling_node',
  'references_ancestor_node',
  // lifecycle source (7)
  'open',
  'answered',
  'moved_on_by_affirmative',
  'moved_on_by_negative',
  'ignored_by_affirmative',
  'ignored_by_negative',
  'ignored_by_both',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_I_CLASSIFIER_SET_VERSION = 'family-i-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose slice
 * in the user prompt — definitions + 1 positive example + 1 negative example
 * + joined false-positive guards. Mirrored from upstream verbose definitions;
 * parity test enforces rawKey presence.
 *
 * Per design §A.3.2, because doctrine-risk = LOW and no key is HIGHEST-risk,
 * there is NO axis-partner key carrying a maximal verbatim guard. Each key
 * carries its upstream structural false-positive guard mirrored verbatim,
 * PLUS a short proportional doctrine line. The two keys closest to a
 * *misreadable* boundary carry a slightly stronger DOCTRINE line:
 *   - introduces_new_issue: the one key a careless reader could mis-frame as
 *     "off-topic" / "derailing" / "evasive".
 *   - returns_to_prior_issue: the one key a careless reader could mis-frame
 *     as "rehashing" / "repetitive" / "going in circles".
 */
export interface FamilyIPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_I_PROMPT_ENTRIES: readonly FamilyIPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'introduces_new_issue',
    label: 'Side issue',
    booleanQuestion:
      "Does this move introduce a new issue or topic distinct from the parent's subject?",
    positiveDefinition:
      "The move's substantive content is on a new topic / issue that is related to but distinct from the parent's subject. The move opens a topic the parent was not about — a structural branching event.",
    negativeDefinition:
      "The move stays on the parent's topic, returns to a prior issue (returns_to_prior_issue), opens a more specific dimension of the parent's topic (introduces_sub_axis), or extends to a closely-adjacent point.",
    positiveExample:
      "Parent on library funding. Move: 'Worth thinking about museum funding too — that's a different question, but the same budget pressures apply.' (new topic opened)",
    negativeExample:
      "Move staying on library funding — extends or refines the parent's topic, not a new issue.",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that extend on the same topic (extends_parent). Do NOT mark TRUE for moves that return to a prior issue (returns_to_prior_issue) or open a sub-axis within the parent's topic (introduces_sub_axis). DOCTRINE: introducing a new issue is a structural BRANCHING event (the move opens a topic distinct from the parent's). It is NEVER framed as \"off-topic\", \"derailing\", \"evasive\", or \"changing the subject to dodge\". The evidence_span MUST anchor the verbatim new-topic wording — NOT a judgment about whether opening it was appropriate. If the move's own text says \"I'm changing the subject\" or \"this is off-topic\", the model may still detect the new issue but its output MUST NOT echo \"off-topic\"/\"derailing\"/\"evasive\"/\"dodging\". The output MUST NOT contain: off-topic, derailing, evasive, dodging.",
  }),
  Object.freeze({
    rawKey: 'references_prior_agreement',
    label: 'Prior agreement referenced',
    booleanQuestion:
      'Does this move reference a prior agreement established earlier in the conversation?',
    positiveDefinition:
      'The move cites a point on which both sides had previously agreed: "as we agreed earlier"; "given the shared definition we settled on". It invokes established common ground, not a contested point.',
    negativeDefinition:
      'The move references a prior contested point, a new claim, or a parent without invoking shared agreement. A paraphrase ("You said earlier...") without invoking shared agreement is NOT this rawKey.',
    positiveExample:
      "Move: 'Given we agreed earlier that infrastructure means publicly-funded shared assets, libraries clearly qualify.' (cites the agreement)",
    negativeExample:
      "Move: 'You said earlier...' (paraphrase without invoking shared agreement)",
    falsePositiveGuards:
      "Do NOT mark TRUE without an actual prior agreement to reference. Do NOT confuse with a paraphrase of the other side's prior claim. DOCTRINE: referencing a prior agreement is a structural recovery-positive move (the move cites established common ground). It is NEVER framed as a verdict on either side. The evidence_span MUST anchor the verbatim cited agreement — NOT a judgment about whether invoking it was correct.",
  }),
  Object.freeze({
    rawKey: 'introduces_sub_axis',
    label: 'Sub-axis opened',
    booleanQuestion:
      "Does this move open a sub-axis within the parent's topic — a more specific dimension of the same dispute?",
    positiveDefinition:
      "The move identifies a more specific dimension of the parent's topic and opens it as a sub-axis: parent is \"library funding\"; move opens \"library STAFFING funding specifically\" as a sub-axis. It narrows WITHIN the topic rather than opening a new one.",
    negativeDefinition:
      "The move introduces a wholly new topic (introduces_new_issue) or stays on the parent's topic without sub-dividing.",
    positiveExample:
      "Parent: 'Library funding matters.' Move: 'On STAFFING specifically — the union contract changes are the structural issue.' (sub-axis within funding)",
    negativeExample:
      "Move: 'Museum funding also matters.' (introduces_new_issue, not a sub-axis)",
    falsePositiveGuards:
      "Do NOT confuse with introduces_new_issue (a wholly new topic) — a sub-axis stays WITHIN the parent's topic. DOCTRINE: opening a sub-axis is a structural narrowing-positive move (the move identifies a more specific dimension of the same dispute). It is NEVER framed as \"nitpicking\", \"deflecting\", or any verdict. The evidence_span MUST anchor the verbatim sub-axis wording — NOT a judgment about whether narrowing was appropriate.",
  }),
  Object.freeze({
    rawKey: 'returns_to_prior_issue',
    label: 'Returns to prior issue',
    booleanQuestion:
      'Does this move return to an issue that was raised earlier in the conversation and then set aside?',
    positiveDefinition:
      'The move re-engages with a topic discussed in an earlier cluster that had moved on. It re-opens a previously-parked issue, often bringing new evidence to a parked dispute.',
    negativeDefinition:
      'The move introduces a wholly new issue (introduces_new_issue), extends the current cluster, references a cited prior agreement (references_prior_agreement), or makes a fresh claim unrelated to prior issues.',
    positiveExample:
      "Earlier cluster: library staffing (parked). Currently: museum funding. Move: 'Coming back to the library staffing question — the new union-contract data does support X.' (re-engages the parked issue)",
    negativeExample:
      "Move staying on the current topic without re-opening a parked issue.",
    falsePositiveGuards:
      "Do NOT confuse with references_prior_agreement (which is about cited agreed-on points). Do NOT mark TRUE for moves that stay on the current topic. DOCTRINE: returning to a prior issue is a structural RE-ENGAGEMENT (the move re-opens an earlier-parked topic). It is NEVER framed as \"rehashing\", \"repetitive\", \"going in circles\", or \"beating a dead horse\" — re-engagement is often productive when it brings new evidence. The evidence_span MUST anchor the verbatim wording re-opening the prior topic (and any new evidence) — NOT a judgment that the return is unproductive. If the move's own text says \"I know I'm rehashing\" or \"going in circles\", the model may still detect the return but its output MUST NOT echo \"rehashing\"/\"repetitive\"/\"going in circles\". The output MUST NOT contain: rehashing, repetitive, \"going in circles\".",
  }),
  Object.freeze({
    rawKey: 'references_external_context',
    label: 'References external context',
    booleanQuestion:
      'Does this move reference external context — a URL, document, event, or other content not previously in the room?',
    positiveDefinition:
      'The move brings in content from outside the room: a URL, a quoted document, a current event, a referenced paper or article. It reaches beyond the in-room conversation.',
    negativeDefinition:
      'The move references only in-room content (parent, ancestor, sibling, prior agreement) or makes a claim without external reference.',
    positiveExample:
      "Move: 'Per yesterday's NYT article on library funding, the new program details are X and Y.' (external reference)",
    negativeExample:
      "Move responding only to in-room moves, no external reference.",
    falsePositiveGuards:
      "Do NOT mark TRUE for references to in-room content (parent, ancestor, sibling). DOCTRINE: referencing external context is a structural reference fact (the move reaches outside the room). It NEVER treats the external reference as automatically granting the claim factual standing — popularity / virality / engagement of an external source is NOT evidence (cdiscourse-doctrine §3). The evidence_span MUST anchor the verbatim external reference — NOT an endorsement of its weight or a verdict on the claim.",
  }),
  Object.freeze({
    rawKey: 'compares_options',
    label: 'Compares options',
    booleanQuestion:
      'Does this move compare two or more options and weigh them against each other?',
    positiveDefinition:
      'The move explicitly compares two or more options on stated criteria: "X gives us A but costs B; Y gives us A\' but costs B\'; on balance X for our context". It weighs alternatives, identifying trade-offs.',
    negativeDefinition:
      'The move advances one option without comparing, disputes a single option, or uses cost-benefit reasoning on a single option.',
    positiveExample:
      "Move: 'Carbon tax vs cap-and-trade — the tax is simpler and more predictable; cap-and-trade has better political durability.' (weighs two options on criteria)",
    negativeExample:
      "Move: 'Carbon tax is the right approach.' (no comparison)",
    falsePositiveGuards:
      "Do NOT mark TRUE for a move that advances a single option without weighing an alternative. DOCTRINE: comparing options is a structural recovery-positive move (the move weighs two or more options on stated criteria). It NEVER asserts which option is \"correct\", \"better\", or \"wins\" as a verdict — even when the move's own text concludes one option wins, the observation records the STRUCTURE of the comparison, not an adjudication. The evidence_span MUST anchor the compared options and stated criteria — NOT which option the move concludes for. The output MUST NOT contain: \"the right option\", \"the correct choice\", winner.",
  }),
]);
