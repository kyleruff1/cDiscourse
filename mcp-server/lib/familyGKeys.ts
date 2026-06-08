/**
 * MCP-SERVER-008-FAMILY-G + MCP-BUILD2g — Family G (resolution_progress)
 * 21-key ai_classifier Subset constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family G registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyG.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyGKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * Per operator Stage 2B binding decision (recorded at the top of
 * `docs/designs/MCP-SERVER-008-FAMILY-G.md` §A.1.1): this constant is the
 * **ai_classifier-subset path** — the `ai_classifier`-source rawKeys from
 * upstream `familyG.ts`. MCP-BUILD2g (Build-2 manifest §6) adds 3 new
 * ai_classifier booleans, taking the Subset 18 → **21**. The 12 deterministic
 * Family G rawKeys (5 `auto_metadata` + 7 `lifecycle`) are intentionally
 * EXCLUDED:
 *   - `auto_metadata` (5): branch_suggested, branch_created, point_stalled,
 *     point_exhausted, synthesis_candidate
 *   - `lifecycle` (7): narrowed, conceded, confirmed, synthesis_ready,
 *     exhausted, branch_recommended, archived_or_resolved
 *
 * Excluded keys are deferred to a future Edge/app-side
 * deterministic-computation card (the `MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS`
 * precedent). Requesting any of the 12 excluded rawKeys under
 * requestedFamilies=['resolution_progress'] returns `unsupported_rawKey` at
 * the registry boundary (HALT trigger ensures no silent-false conversion;
 * mirror Family D).
 *
 * SOURCE COUNT CORRECTION (design §A.1.0): the upstream `familyG.ts`
 * file-header comment is STALE — it says "29 entries … ai_classifier (8)"
 * but the actual array has 33 frozen entries with 21 ai_classifier
 * declarations (8 existing + 9 NEW + accepts_settlement_terms = 18 baseline,
 * + 3 MCP-BUILD2g = 21). The binding contract for FAMILY_G_RAW_KEYS is the
 * actual `source: 'ai_classifier'` literals in the code (21), NOT the stale
 * header count. This card does NOT fix the upstream header (it is in `src/`,
 * out of scope); the parity test asserts exactly 21 ai_classifier declarations.
 *
 * The 21 rawKeys are the binding contract (18 MCP-SERVER-008-FAMILY-G design
 * §A.1.1 / Stage 2B operator decision + 3 MCP-BUILD2g Build-2 manifest §6).
 * Verbatim, in declaration order matching the upstream `ai_classifier`-source
 * entries of `familyG.ts`:
 *
 *   1.  narrows_claim (LOW — narrowing is recovery-positive)
 *   2.  concedes_narrow_point (MEDIUM — concession axis; REPAIR never defeat)
 *   3.  ready_for_synthesis (LOW — readiness signal, descriptive)
 *   4.  suggests_side_branch (LOW — structural action proposal)
 *   5.  suggests_diagonal_tangent (LOW — structural action proposal)
 *   6.  accepts_partial_with_caveat (LOW–MEDIUM — partial acceptance)
 *   7.  concedes_with_new_dispute (MEDIUM — compound concession)
 *   8.  proposes_settlement_terms (MEDIUM — settlement axis)
 *   9.  accepts_settlement_terms (MEDIUM — acceptance of settlement)
 *   10. concedes_broader_point (HIGHEST — broad relinquishment; axis-partner)
 *   11. common_ground_identified (LOW — descriptive cross-side agreement)
 *   12. unresolved_point_isolated (LOW — descriptive isolation)
 *   13. synthesis_proposed (MEDIUM — synthesis is gameplay, never a verdict)
 *   14. move_on_requested (LOW–MEDIUM — agree-to-disagree)
 *   15. issue_closed_by_participant (MEDIUM — closed/settled/done)
 *   16. decision_criterion_proposed (LOW — collaborative framing move)
 *   17. action_item_proposed (LOW — procedural proposal)
 *   18. followup_question_proposed (LOW — future-question proposal)
 *   19. records_remaining_disagreement (MCP-BUILD2g; LOW — records the open set)
 *   20. defines_next_evidence_needed (MCP-BUILD2g; LOW — names the next evidence; EVIDENCE-DOCTRINE FENCE)
 *   21. separates_normative_from_empirical (MCP-BUILD2g; LOW — values vs facts boundary)
 *
 * BATCHING (MCP-BUILD2g / MCP-BOOLEAN-BATCHING-INFRA-001): 21 > the per-
 * response cap MAX_FLAGS_PER_RESPONSE (20), so the Edge chunker splits the
 * 21-key set into 2 batches (16 + 5); the mcp-server serves each batch as a
 * normal <= 16-key single-family request and never sees the full 21-key
 * response. The merge into one 21-key family result happens at the Edge,
 * post-validation. EVIDENCE-DOCTRINE FENCE (defines_next_evidence_needed): the
 * key names a next evidence step and is advisory; it NEVER grants or denies
 * factual standing (anti-amplification module untouched). NO batching-infra
 * change — G consumes the unchanged chunker (BATCH_SIZE=16, threshold=20),
 * mirroring Family D.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict about a person or intent.
 *   - cdiscourse-doctrine §1 — resolution-progress states are DESCRIPTIVE
 *     CONVERGENCE-STATE, never verdicts. The classifier NEVER labels who is
 *     ahead, behind, won, lost, prevailed, capitulated, or that a dispute
 *     was settled IN ONE SIDE'S FAVOR. Concession is a SCORING REPAIR, not a
 *     defeat; synthesis is a GAMEPLAY move, not a verdict about who won.
 *   - point-standing-economy — Family G is descriptive; a concession /
 *     synthesis / settlement positive does NOT lower the move's factual
 *     standing eligibility. G emits no standing delta (per
 *     CONCESSION_EFFECT_WEIGHTS, concession is repair-positive — but that
 *     scoring lives elsewhere and is not wired to G in this card).
 *   - MCP-020 audit §Rejected labels — the concession / synthesis /
 *     settlement / closure axes sit one semantic step from "who won / lost /
 *     conceded-and-therefore-lost / settled-in-favor". The
 *     `concedes_broader_point` key carries the HIGHEST verdict-adjacency and
 *     the strongest per-key guard (the G analog of E's slippery_slope and
 *     F's consequence_probability_unclear).
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) lives on
 * the upstream taxonomy and is applied by the Edge Function's sanitizer
 * (sanitizeMcpBooleanObservationResponse). This server-side keys file
 * mirrors only the rawKey + prompt-entry slice, matching the Family A/B/C/D/E/F
 * pattern.
 */

/**
 * The 21 Family G ai_classifier-subset rawKeys (18 baseline + 3 MCP-BUILD2g),
 * frozen in declaration order matching upstream. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in upstream
 *     `familyG.ts` as a string literal AND that the 12 deterministic
 *     rawKeys are intentionally excluded)
 */
export const FAMILY_G_RAW_KEYS: readonly string[] = Object.freeze([
  'narrows_claim',
  'concedes_narrow_point',
  'ready_for_synthesis',
  'suggests_side_branch',
  'suggests_diagonal_tangent',
  'accepts_partial_with_caveat',
  'concedes_with_new_dispute',
  'proposes_settlement_terms',
  'accepts_settlement_terms',
  'concedes_broader_point',
  'common_ground_identified',
  'unresolved_point_isolated',
  'synthesis_proposed',
  'move_on_requested',
  'issue_closed_by_participant',
  'decision_criterion_proposed',
  'action_item_proposed',
  'followup_question_proposed',
  // MCP-BUILD2g (Build-2 manifest §6) — resolution-progress bookkeeping
  // booleans. Subset 18 → 21. 21 > the 20-key per-response cap, so the Edge
  // chunker serves G in 2 batches (16 + 5).
  'records_remaining_disagreement',
  'defines_next_evidence_needed',
  'separates_normative_from_empirical',
]);

/**
 * The 12 deterministic Family G rawKeys EXCLUDED from this Subset per
 * Stage 2B operator decision. Used by `familyGKeysParity.test.ts` to
 * assert these are intentionally absent from FAMILY_G_RAW_KEYS and that
 * the registry boundary rejects them as unsupported_rawKey (mirror
 * Family D). 5 auto_metadata + 7 lifecycle = 12 unique rawKey strings.
 *
 * Disambiguation footnote (upstream familyG.ts Decision 5): there are
 * intentional name-pairs across sources. `narrows_claim` (ai_classifier,
 * move-intrinsic) ≠ `narrowed` (lifecycle, cluster state).
 * `concedes_narrow_point` (ai_classifier) ≠ `conceded` (lifecycle).
 * `ready_for_synthesis` (ai_classifier, move) ≠ `synthesis_ready`
 * (lifecycle, cluster) ≠ `synthesis_candidate` (auto_metadata). The MCP
 * subset takes ONLY the ai_classifier member of each pair; the parity test
 * asserts the lifecycle/auto_metadata members are EXCLUDED by name.
 */
export const FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS: readonly string[] = Object.freeze([
  // auto_metadata source (5)
  'branch_suggested',
  'branch_created',
  'point_stalled',
  'point_exhausted',
  'synthesis_candidate',
  // lifecycle source (7)
  'narrowed',
  'conceded',
  'confirmed',
  'synthesis_ready',
  'exhausted',
  'branch_recommended',
  'archived_or_resolved',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_G_CLASSIFIER_SET_VERSION = 'family-g-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose
 * slice in the user prompt — definitions + 1 positive example + 1
 * negative example + joined false-positive guards. Mirrored from
 * upstream verbose definitions; parity test enforces rawKey presence.
 *
 * Per design §A.3.2, the per-key falsePositiveGuards for the verdict-adjacent
 * keys carry verbatim guards forbidding the output from framing the move as
 * won / lost / winner / loser / defeated / prevailed / capitulated / ahead /
 * behind / settled-in-favor. The HIGHEST RISK key — `concedes_broader_point`
 * (a broad relinquishment is the single key most likely to be mis-framed as
 * "this side lost") — carries the strongest guard, including the existential
 * constraint that even when the input move text contains "you win" / "I lost"
 * / "you beat me", the output evidence_span must NOT echo it.
 */
export interface FamilyGPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_G_PROMPT_ENTRIES: readonly FamilyGPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'narrows_claim',
    label: 'Claim narrowed',
    booleanQuestion:
      "Does this move narrow the parent's claim from a broader to a narrower form?",
    positiveDefinition:
      "The move's author proposes a narrower form of the parent's claim, preserving the narrow form as defensible. Narrowing is a recovery-positive structural move.",
    negativeDefinition:
      'The move challenges the claim, refines on the same scope, extends, or asks for clarification.',
    positiveExample:
      "Parent: 'Carbon taxes work.' Move: 'Narrowing my claim — they work IN jurisdictions with stable enforcement, over 5+ year horizons.'",
    negativeExample: "Move: 'Carbon taxes do not work.' (challenges)",
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that challenge or merely refine on the same scope. Distinct from the lifecycle cluster-state member (narrowed). DOCTRINE: narrowing is a recovery-positive structural move and a SCORING REPAIR — it preserves the narrowed defensible claim. It is NEVER a verdict that the author lost, was defeated, or that the other side won. The evidence_span anchors the narrowed scope, NEVER a judgment about who is ahead or behind.',
  }),
  Object.freeze({
    rawKey: 'concedes_narrow_point',
    label: 'Narrow concession',
    booleanQuestion:
      'Does this move concede a narrow point while preserving the broader claim or position?',
    positiveDefinition:
      'The move explicitly grants a specific narrow point that the parent or an earlier move challenged, while maintaining the broader claim.',
    negativeDefinition:
      'The move concedes the broader point (concedes_broader_point), challenges, or evades.',
    positiveExample:
      "Move: 'You are right that the BC effect was 3% not 5% — granted; the broader point about carbon-tax effectiveness still holds.'",
    negativeExample:
      "Move: 'You are right — I withdraw my entire position.' (concedes_broader_point)",
    falsePositiveGuards:
      'Do NOT mark TRUE when the broader claim is also relinquished — that is concedes_broader_point. DOCTRINE: a narrow concession is a SCORING REPAIR, never a defeat. The observation records the structural RELINQUISHMENT of the narrow point only. It NEVER frames the conceding participant as "wrong", "the loser", "defeated", or as having "lost the point". The output MUST NOT contain the words won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor". The evidence_span anchors the verbatim narrow concession, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'ready_for_synthesis',
    label: 'Synthesis ready',
    booleanQuestion:
      'Does this move signal that the cluster is ready for synthesis (sufficient common ground established)?',
    positiveDefinition:
      "The move's content indicates common ground plus remaining narrow differences; synthesis would be productive.",
    negativeDefinition:
      'Active broad disagreement, or the move advances one side without a synthesis-readiness signal.',
    positiveExample:
      "Move: 'I think we are mostly aligned; the remaining piece is the timing question.'",
    negativeExample: 'Move advancing broad disagreement.',
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that advance one side. Distinct from the lifecycle cluster-state member (synthesis_ready) and the auto_metadata member (synthesis_candidate). DOCTRINE: a synthesis-readiness signal is descriptive convergence-state — both sides retain standing. It NEVER implies one side prevailed or that the dispute was decided. The evidence_span anchors the readiness signal, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'suggests_side_branch',
    label: 'Side branch suggested',
    booleanQuestion: 'Does this move suggest opening a side branch from the current discussion?',
    positiveDefinition:
      'The move proposes a related but separable point that could be productively explored in a side branch.',
    negativeDefinition:
      'The move extends on the current topic, introduces a fully new topic, or stays on the same axis.',
    positiveExample:
      "Move: 'Worth pursuing the staffing question separately — it is a sub-axis of library funding but distinct from this thread.'",
    negativeExample: "Move: 'Let me make a new claim.' (introduces a new issue)",
    falsePositiveGuards:
      'Do NOT confuse with introducing a sub-axis (a different family) — a side branch is a structural action proposal. DOCTRINE: a side-branch suggestion is descriptive structure, never a verdict on the branch\'s relevance or on who is winning. The evidence_span anchors the proposed branch, never a judgment.',
  }),
  Object.freeze({
    rawKey: 'suggests_diagonal_tangent',
    label: 'Tangent branch suggested',
    booleanQuestion:
      'Does this move suggest a tangential branch — a related issue distinct enough to merit its own thread?',
    positiveDefinition:
      'The move proposes a tangentially-related topic that would benefit from its own thread rather than crowding the current one.',
    negativeDefinition: 'The move stays on topic, introduces a fully new issue, or extends.',
    positiveExample:
      "Move: 'The museum funding question is tangentially related; might be worth a separate thread.'",
    negativeExample: 'Move staying on current topic.',
    falsePositiveGuards:
      'Do NOT mark TRUE for moves that stay on the current topic. DOCTRINE: a tangent suggestion is a structural action proposal, never a verdict on the tangent\'s relevance or on argument quality. The evidence_span anchors the proposed tangent, never a judgment.',
  }),
  Object.freeze({
    rawKey: 'accepts_partial_with_caveat',
    label: 'Partial acceptance',
    booleanQuestion:
      'Does this move partially accept the parent while attaching an explicit caveat or condition?',
    positiveDefinition:
      'The move says "I accept X with caveat Y" — partial acceptance is the key signal.',
    negativeDefinition:
      'Full acceptance, full rejection, or a compound concession that creates a new dispute.',
    positiveExample:
      "Move: 'Agreed on the broad point — with the caveat that it only holds in jurisdictions with enforcement.'",
    negativeExample: "Move: 'Yes, completely agree.' (full acceptance)",
    falsePositiveGuards:
      'Do NOT mark TRUE for full acceptance or for a concession that creates a new dispute (concedes_with_new_dispute). DOCTRINE: partial acceptance is a recovery-positive structural move that opens a narrowing path. It is NEVER a verdict that the author lost or the other side won. The evidence_span anchors the caveat, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'concedes_with_new_dispute',
    label: 'Concession plus new dispute',
    booleanQuestion:
      'Does this move offer a concession on one point AND raise a new dispute on another?',
    positiveDefinition:
      'Compound move: explicit concession on point A plus an explicit new challenge / dispute on point B.',
    negativeDefinition:
      'Pure concession (concedes_narrow_point / concedes_broader_point), pure dispute, or unilateral partial acceptance.',
    positiveExample:
      "Move: 'You are right that BC was 3%, not 5% — but the broader carbon-tax effectiveness claim needs more evidence on the durability axis.'",
    negativeExample: 'Pure concession or pure challenge.',
    falsePositiveGuards:
      'The compound nature is essential — a single move with BOTH a concession AND a new challenge. DOCTRINE: the concession side is a SCORING REPAIR, never a defeat; the new-dispute side opens a fresh pressure axis. The observation NEVER frames the conceding participant as "wrong", "the loser", or "defeated", and NEVER frames the new dispute as one side being "ahead". The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor". The evidence_span anchors the concession + the new dispute, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'proposes_settlement_terms',
    label: 'Settlement proposed',
    booleanQuestion: 'Does this move propose specific settlement terms for resolving the dispute?',
    positiveDefinition:
      'The move articulates concrete terms for ending the dispute: "I propose we agree on X, set aside Y, and commit to Z".',
    negativeDefinition:
      'The move proposes synthesis without settlement framing, proposes a one-sided position, or asks about settlement.',
    positiveExample:
      "Move: 'I propose: we agree on the 12-city carbon tax data; set aside Australia as out-of-scope; both commit to revisiting in 2026 with the next 5-year sample.'",
    negativeExample: 'Move proposing synthesis without explicit settlement terms.',
    falsePositiveGuards:
      'Distinct from synthesis_proposed — settlement is more procedural; synthesis is more substantive. DOCTRINE: settlement / closure is PROCEDURAL, not adjudication. The observation records that participants are CLOSING engagement on a point. It NEVER implies the point was "decided", "settled in X\'s favor", or that one side is "ahead". The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor". The evidence_span anchors the proposed terms, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'accepts_settlement_terms',
    label: 'Settlement accepted',
    booleanQuestion: 'Does this move accept settlement terms that were proposed earlier?',
    positiveDefinition: 'The move explicitly accepts the proposed terms.',
    negativeDefinition: 'The move counter-proposes settlement, rejects, or ignores.',
    positiveExample: "Move: 'Accepted on all three terms. Let us move on.'",
    negativeExample: 'Move counter-proposing, or ignoring the proposal.',
    falsePositiveGuards:
      'Requires a prior settlement-terms proposal in the cluster. DOCTRINE: acceptance of terms is PROCEDURAL closure, NEVER capitulation or "settled in X\'s favor". Accepting settlement terms is a bilateral resolution move; it NEVER means the accepting participant lost, was defeated, capitulated, or that the dispute was decided in the other side\'s favor. The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor". The evidence_span anchors the accepted terms, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'concedes_broader_point',
    label: 'Broader concession',
    booleanQuestion:
      'Does this move relinquish the broader position or main claim (not just a narrow sub-point)?',
    positiveDefinition:
      'The author concedes the main broad claim of the cluster, not just a narrow sub-point. Distinct from concedes_narrow_point.',
    negativeDefinition:
      'Narrow concession only (concedes_narrow_point), evasion, or non-concession.',
    positiveExample:
      "Move: 'Stepping back — on reflection, the broader carbon-tax effectiveness argument is weaker than I thought; I withdraw the broad claim and stand on the narrow scope only.'",
    negativeExample:
      "Move: 'Narrow concession on the BC figure; broader claim stands.' (concedes_narrow_point)",
    falsePositiveGuards:
      'Distinct from concedes_narrow_point — a broad concession relinquishes the main claim, a narrow one preserves it. DOCTRINE: a broad concession is RELINQUISHMENT of the broader frame, a SCORING REPAIR that resets standing for future rebuilding — NEVER framed as "this side lost", "defeated", "the loser", "capitulated", "conceded the loss", or any verdict. The evidence_span MUST anchor the verbatim relinquishment ("I withdraw the broad claim", "the broader argument is weaker than I thought") — NOT a judgment about who won. If the move\'s own text says "you win" / "I lost" / "you beat me", the model may still detect concedes_broader_point but its output MUST NOT echo "win" / "lost" / "beat". The output MUST NOT contain: won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor".',
  }),
  Object.freeze({
    rawKey: 'common_ground_identified',
    label: 'Common ground',
    booleanQuestion: 'Does this move explicitly name common ground that both sides have reached?',
    positiveDefinition:
      'The move surfaces shared agreement: "we both agree on X"; "the common ground is Y"; "neither of us disputes Z".',
    negativeDefinition:
      'The move proposes synthesis (synthesis_proposed goes beyond common ground), or expresses same-side acknowledgement. Common-ground identification is cross-side shared.',
    positiveExample:
      "Move: 'I think we both agree on the BC and Sweden data showing carbon-tax effectiveness; we disagree on whether that generalizes.'",
    negativeExample: "Move: 'What if we combine our points?' (synthesis_proposed)",
    falsePositiveGuards:
      'Distinct from synthesis_proposed — common-ground is identification; synthesis is a proposal. DOCTRINE: naming common ground is descriptive convergence-state; it NEVER implies one side won or that the dispute is settled in anyone\'s favor. The evidence_span anchors the named common ground, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'unresolved_point_isolated',
    label: 'Unresolved point isolated',
    booleanQuestion:
      'Does this move isolate a specific unresolved point — naming what remains in dispute amid established common ground?',
    positiveDefinition:
      'The move names the precise unresolved point with common-ground context: "we agree on A, B, C; the open question is D".',
    negativeDefinition:
      'The move identifies common ground without isolating a remaining point, makes a new claim, or extends.',
    positiveExample:
      "Move: 'Common ground: BC and Sweden carbon-tax data. Open question: whether Australia repeal is the exception or the warning.'",
    negativeExample: "Move: 'We agree on a lot of this.' (common_ground_identified only)",
    falsePositiveGuards:
      'Requires BOTH common-ground identification AND isolation of a remaining point. DOCTRINE: isolating an unresolved point is descriptive structure that enables productive next moves; it NEVER implies one side is ahead, behind, or that the resolved parts were decided in anyone\'s favor. The evidence_span anchors the isolated point, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'synthesis_proposed',
    label: 'Synthesis proposed',
    booleanQuestion:
      'Does this move propose a synthesis (a combined position) that draws from both sides of the current disagreement?',
    positiveDefinition:
      'The move explicitly names elements from both sides and proposes a combined position. The synthesis may be a compromise, scoping reconciliation, definitional clarification that dissolves a fake disagreement, or layered position.',
    negativeDefinition:
      'The move advances one side only, concedes without offering a combined position, or merely identifies common ground without proposing synthesis.',
    positiveExample:
      "Move: 'Maybe both: EVs reduce urban tailpipe pollution AND battery production needs cleaner grids. Both true; the open question is which dominates by 2030.'",
    negativeExample: "Move: 'You are right; I concede.' (pure concession)",
    falsePositiveGuards:
      'Do NOT mark TRUE for naming common ground without proposing a synthesis, for pure concession, or based on conciliatory tone alone — the synthesis must be substantive. DOCTRINE: synthesis is a GAMEPLAY move, not a verdict about who won. When a move proposes a synthesis, the observation records that BOTH sides\' elements are being combined; BOTH sides retain their standing. It NEVER implies one side\'s position prevailed. The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor". The evidence_span anchors the proposed combined position, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'move_on_requested',
    label: 'Move on requested',
    booleanQuestion:
      'Does this move request that the current point be set aside without explicit resolution, in favor of moving to a different topic?',
    positiveDefinition:
      'The move says "let us set this aside" / "agree to disagree" / "move on" WITHOUT resolving the point.',
    negativeDefinition:
      'The move proposes synthesis / settlement, makes a new claim, asks for branching, or declares the issue closed for the participant.',
    positiveExample:
      "Move: 'Can we set this aside and come back to it later? I want to address the staffing question.'",
    negativeExample: "Move: 'For me, this is settled; I am done on this point.' (issue_closed_by_participant)",
    falsePositiveGuards:
      'Distinct from synthesis / settlement (which resolve) and from issue_closed_by_participant (which is final for the participant) — a move-on request sets the point aside WITHOUT resolving it. DOCTRINE: "agree to disagree" or "set this aside" is a descriptive structural request; it is NEVER a forfeit, a loss, or a verdict that one side won. The unresolved point\'s standing is left as-is. The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor". The evidence_span anchors the set-aside request, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'issue_closed_by_participant',
    label: 'Issue closed',
    booleanQuestion:
      'Does this move explicitly close an issue (the participant declares the issue resolved or no longer active for them)?',
    positiveDefinition:
      'The move declares the issue closed by participant action: "for me, this is settled"; "I am done on this point"; "moving on from this issue".',
    negativeDefinition:
      'The move proposes synthesis, asks to move on (move_on_requested), or evades.',
    positiveExample:
      "Move: 'For me, the BC carbon-tax question is settled with the data we have. I am done with this thread.'",
    negativeExample: "Move: 'Let us set this aside.' (move_on_requested)",
    falsePositiveGuards:
      'Distinct from move_on_requested (which does not resolve) and from the auto-derived terminal cluster state — issue_closed_by_participant is final FOR THIS PARTICIPANT. DOCTRINE: participant-intrinsic closure is PROCEDURAL, not adjudication. "Settled / done / closed" NEVER means the point was decided, settled in X\'s favor, or that one side won; unilateral closure does not change cross-side standing and the cluster may continue without this participant. The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor". The evidence_span anchors the closure statement, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'decision_criterion_proposed',
    label: 'Decision criterion proposed',
    booleanQuestion:
      'Does this move propose a specific criterion or test for deciding the question under dispute?',
    positiveDefinition:
      'The move says "the criterion should be X" — proposing how to evaluate which side\'s position is more defensible.',
    negativeDefinition:
      'The move disputes an existing criterion, uses a criterion within an argument, or makes a substantive claim.',
    positiveExample:
      "Move: 'I propose: we evaluate carbon-tax effectiveness by sustained 5-year emission deltas in jurisdictions with stable enforcement. Excludes Australia, includes BC and Sweden.'",
    negativeExample: "Move: 'Cost-per-visit is the wrong criterion.' (disputes a criterion)",
    falsePositiveGuards:
      'Proposing is distinct from disputing — a proposal is collaborative. DOCTRINE: proposing a decision criterion is a collaborative framing move that accelerates resolution; it NEVER decides the question or implies one side won. The evidence_span anchors the proposed criterion, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'action_item_proposed',
    label: 'Action item proposed',
    booleanQuestion:
      'Does this move propose a specific action item that one or both participants should take?',
    positiveDefinition:
      'The move identifies an action: "let us look up the IPCC data"; "we should both review the Smith 2020 paper before continuing".',
    negativeDefinition: 'The move asks for evidence, proposes synthesis, or makes a claim.',
    positiveExample:
      "Move: 'Let us both review the BC Ministry of Environment 2023 report before resuming the BC discussion.'",
    negativeExample: "Move: 'What is the BC source?' (asks for evidence)",
    falsePositiveGuards:
      'An action item is concrete (do X), not a vague suggestion. DOCTRINE: proposing an action item is a procedural structural move; it NEVER implies one side is ahead or that the dispute was decided. The evidence_span anchors the proposed action, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'followup_question_proposed',
    label: 'Follow-up question proposed',
    booleanQuestion:
      'Does this move propose a follow-up question that should be addressed in a future discussion (not the current one)?',
    positiveDefinition:
      'The move names a question for future exploration: "next thread we should tackle why Australia repealed".',
    negativeDefinition:
      'The move asks a current question, proposes branching, or makes a claim.',
    positiveExample:
      "Move: 'Worth exploring in a follow-up: why did the Australian carbon tax fail politically vs the BC one?'",
    negativeExample: "Move: 'Why did Australia repeal?' (a current question)",
    falsePositiveGuards:
      'A follow-up is for FUTURE discussion; current questions are different. DOCTRINE: proposing a follow-up question is a forward-looking structural move; it NEVER implies one side won or that the current dispute was decided. The evidence_span anchors the proposed question, never a verdict.',
  }),
  // ── MCP-BUILD2g (Build-2 manifest §6) — resolution-progress bookkeeping ──
  // booleans. Subset 18 → 21. None is verdict-adjacent (manifest §6 —
  // "lowest-risk family alongside D"); each carries the standard
  // describe-the-MOVE-not-the-author framing, and G2 carries the
  // EVIDENCE-DOCTRINE FENCE (names a next evidence step, advisory, never grants
  // or denies factual standing).
  Object.freeze({
    rawKey: 'records_remaining_disagreement',
    label: 'Records remaining disagreement',
    booleanQuestion:
      'Does this move explicitly record what remains in dispute (a roundup of the open set), distinct from isolating a single open point?',
    positiveDefinition:
      'The move records the SET of what is still in dispute — a roundup ("settled: the data; open: the value weighting and the timeline"). Distinct from unresolved_point_isolated, which names ONE open point; this records the remainder.',
    negativeDefinition:
      'The move declares the issue closed (issue_closed_by_participant), isolates a single open point without summarizing the remainder (unresolved_point_isolated), or makes a claim without recording the open set.',
    positiveExample:
      "Move: 'We agree on cost; what is still open is whether equity outweighs it and whether enforcement is feasible.'",
    negativeExample:
      "Move: 'This one point is unresolved.' (unresolved_point_isolated — a single point, not the set)",
    falsePositiveGuards:
      'The move must RECORD what remains (a roundup of the open set), not just flag one open point — distinguish from unresolved_point_isolated. Co-fires acceptably with common_ground_identified. DOCTRINE: recording the remaining-disagreement set is descriptive resolution bookkeeping about the MOVE; it NEVER implies one side is ahead, behind, won, or lost, and never judges the author. The evidence_span anchors the recorded open set, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'defines_next_evidence_needed',
    label: 'Defines next evidence needed',
    booleanQuestion:
      'Does this move define the specific evidence that would resolve the open point next (not a generic source request)?',
    positiveDefinition:
      'The move names the SPECIFIC evidence that would advance resolution of the open point ("a primary record of the enforcement dates", "a longitudinal study past year 5"). A forward-looking, actionable definition of the next evidence step.',
    negativeDefinition:
      'The move asks for evidence generically (asks_for_evidence, Family D), proposes a settlement without naming the evidence (proposes_settlement_terms), or asks to move on (move_on_requested).',
    positiveExample:
      "Move: 'To settle this, we would need a primary record of the enforcement dates — that is the next evidence.'",
    negativeExample:
      "Move: 'Got a source?' (asks_for_evidence — generic, not a defined next step)",
    falsePositiveGuards:
      'The move must DEFINE the specific evidence that would advance resolution; do NOT mark a generic source request (asks_for_evidence). EVIDENCE-DOCTRINE FENCE: this observation describes a forward-looking evidence step the MOVE names (a primary_record_needed / source_needed-style next step); it is advisory and NEVER grants or denies factual standing or truth to any claim, and never judges the author. The evidence_span anchors the defined next evidence step, never a verdict.',
  }),
  Object.freeze({
    rawKey: 'separates_normative_from_empirical',
    label: 'Separates normative from empirical',
    booleanQuestion:
      'Does this move separate a normative (values) dispute from an empirical (factual) one?',
    positiveDefinition:
      'The move explicitly marks the boundary between a values question and a factual question ("the \'does it work\' part is empirical and we can check it; the \'is it worth it\' part is normative and data will not settle it"). An epistemic-structural distinction between fact-questions and value-questions.',
    negativeDefinition:
      'The move conflates the two, disputes within one without separating, or makes a claim without drawing the normative/empirical boundary.',
    positiveExample:
      "Move: 'Two questions tangled here: an empirical one (the effect size) and a values one (whether the tradeoff is acceptable).'",
    negativeExample:
      "Move: 'I disagree on values.' (a value disagreement with no separation)",
    falsePositiveGuards:
      'The move must EXPLICITLY mark the normative/empirical boundary; do NOT mark on the word "values" alone. Related to separates_observation_from_inference (Family D) but distinct: this separates fact-questions from value-questions; D2 separates observed-data from inferred-conclusions. DOCTRINE: separating normative from empirical is an epistemic-structural observation about the MOVE; it NEVER implies one side is right, won, or lost, and never judges the author. The evidence_span anchors the boundary the move draws, never a verdict.',
  }),
]);
