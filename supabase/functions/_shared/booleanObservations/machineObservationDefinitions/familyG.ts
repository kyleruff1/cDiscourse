/**
 * MCP-021A — Family G (resolution_progress) definitions.
 *
 * Per design §3.7: 29 entries total (largest family in MCP-021A).
 *  - 20 existing (RETROACTIVE_VERBOSE_DEFINITIONS):
 *      auto_metadata (5): branch_suggested, branch_created,
 *        point_stalled, point_exhausted, synthesis_candidate
 *      lifecycle (7): narrowed, conceded, confirmed, synthesis_ready,
 *        exhausted, branch_recommended, archived_or_resolved
 *      ai_classifier (8): narrows_claim, concedes_narrow_point,
 *        ready_for_synthesis, suggests_side_branch,
 *        suggests_diagonal_tangent, accepts_partial_with_caveat,
 *        concedes_with_new_dispute, proposes_settlement_terms,
 *        accepts_settlement_terms
 *  - 9 NEW: concedes_broader_point, common_ground_identified,
 *    unresolved_point_isolated, synthesis_proposed, move_on_requested,
 *    issue_closed_by_participant, decision_criterion_proposed,
 *    action_item_proposed, followup_question_proposed.
 *
 * Decision 5 (binding):
 *   - brief narrow_concession_present → existing #45 concedes_narrow_point
 *   - brief ready_for_synthesis → existing #46 + #27 (compound disambiguated)
 *   - brief branch_recommended → existing #34
 *   No aliases added.
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — resolution-progress facts are structural;
 *     concession is not defeat (point-standing-economy boundary).
 *   - cdiscourse-doctrine §1 — concession is a SCORING REPAIR, never a loss.
 *   - point-standing-economy — concession is repair-positive (mirrors
 *     gradeRepair() in src/features/pointStanding/concession economy).
 *   - timeline-grammar — resolution-progress events render on Timeline
 *     as high-signal nodes.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes.ts';

const RETRO_HIGH_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'high',
  inspectMinConfidence: 'high',
};

const NEW_TIMELINE_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'medium',
  selectedContextMinConfidence: 'low',
  inspectMinConfidence: 'low',
};

const NEW_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

interface ResolutionBuilder {
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

function buildResolution(b: ResolutionBuilder): MachineObservationDefinition {
  return Object.freeze({
    id: `registry:machine_observation:${b.source}:${b.rawKey}`,
    rawKey: b.rawKey,
    kind: 'machine_observation' as const,
    source: b.source,
    family: 'resolution_progress' as const,
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

export const FAMILY_G_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // ── 20 RETROACTIVE ──

  // #12 branch_suggested (auto_metadata)
  buildResolution({
    rawKey: 'branch_suggested',
    source: 'auto_metadata',
    label: 'Branch hint',
    shortLabel: 'Branch hint',
    description: 'A branch is suggested for this exchange.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 35,
    visibleByDefault: true,
    booleanQuestion: 'Has the system suggested branching from this point?',
    positiveDefinition: 'Auto-metadata: heuristic detected that the cluster would benefit from branching (multiple axes active).',
    negativeDefinition: 'No branch suggestion recorded.',
    positiveExamples: Object.freeze(['Cluster with 3+ active axes → branch_suggested.']),
    negativeExamples: Object.freeze(['Cluster with single axis → no suggestion.']),
    falsePositiveGuards: Object.freeze(['Do NOT confuse with branch_created (action taken) or lifecycle branch_recommended.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: structural suggestion; never required.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #13 branch_created (auto_metadata)
  buildResolution({
    rawKey: 'branch_created',
    source: 'auto_metadata',
    label: 'Branch here',
    shortLabel: 'Branch here',
    description: 'A new branch was created at this point.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 36,
    visibleByDefault: true,
    booleanQuestion: 'Was a new branch explicitly created at this point in the tree?',
    positiveDefinition: 'Auto-metadata: a participant took the branching action; a new sub-tree begins here.',
    negativeDefinition: 'No branching action taken at this point.',
    positiveExamples: Object.freeze(['Branch action posted → branch_created.']),
    negativeExamples: Object.freeze(['Linear continuation → no branch.']),
    falsePositiveGuards: Object.freeze(['Compare with auto-derived splits_thread (similar pattern via tree shape).']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: structural action recording.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #14 point_stalled (auto_metadata)
  buildResolution({
    rawKey: 'point_stalled',
    source: 'auto_metadata',
    label: 'Stalled',
    shortLabel: 'Stalled',
    description: 'The point has stalled — no recent activity.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 22,
    visibleByDefault: true,
    booleanQuestion: 'Has activity stalled in this cluster (no moves for the N-time window)?',
    positiveDefinition: 'Auto-metadata: no posts in the cluster for N hours / days (per system threshold).',
    negativeDefinition: 'Recent activity in the cluster.',
    positiveExamples: Object.freeze(['Cluster with no activity for 48h+ → stalled.']),
    negativeExamples: Object.freeze(['Cluster with activity in last 4h → active.']),
    falsePositiveGuards: Object.freeze(['Threshold is system-configured; not a verdict on engagement.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: structural inactivity fact.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #15 point_exhausted (auto_metadata)
  buildResolution({
    rawKey: 'point_exhausted',
    source: 'auto_metadata',
    label: 'Exhausted',
    shortLabel: 'Exhausted',
    description: 'This point appears to be out of fresh angles.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 24,
    visibleByDefault: true,
    booleanQuestion: 'Has this cluster been exhausted — sufficient turns with no new substantive angles?',
    positiveDefinition: 'Auto-metadata: cluster has N+ turns but repeats prior axes without new content.',
    negativeDefinition: 'Cluster has new content / angles per turn.',
    positiveExamples: Object.freeze(['Cluster cycling on same axes after 10+ turns.']),
    negativeExamples: Object.freeze(['Cluster with fresh axes per turn.']),
    falsePositiveGuards: Object.freeze(['Pairs with lifecycle exhausted (cluster-state version).']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: structural exhaustion fact.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #16 synthesis_candidate (auto_metadata)
  buildResolution({
    rawKey: 'synthesis_candidate',
    source: 'auto_metadata',
    label: 'Synthesis',
    shortLabel: 'Synthesis',
    description: 'This exchange is a candidate for synthesis.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 26,
    visibleByDefault: true,
    booleanQuestion: 'Has the system identified this cluster as a synthesis candidate?',
    positiveDefinition: 'Auto-metadata: heuristic detected common ground + remaining narrow differences; synthesis may be productive.',
    negativeDefinition: 'No synthesis candidate marker.',
    positiveExamples: Object.freeze(['Cluster with common_ground_identified + narrow remaining dispute.']),
    negativeExamples: Object.freeze(['Cluster with active broad disagreement.']),
    falsePositiveGuards: Object.freeze(['Decision 5: brief candidate ready_for_synthesis (Family G) collapses into existing #46.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: structural synthesis suggestion; never required.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #24 narrowed (lifecycle)
  buildResolution({
    rawKey: 'narrowed',
    source: 'lifecycle',
    label: 'Narrowed',
    shortLabel: 'Narrowed',
    description: 'The claim was narrowed.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 21,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the narrowed lifecycle state — the broad claim has been refined to a narrower defensible scope?',
    positiveDefinition: 'Lifecycle: the cluster\'s claim was narrowed in response to scope challenges; the new narrow form is now the active claim.',
    negativeDefinition: 'Claim remains in original broad form, or cluster moved to a different state.',
    positiveExamples: Object.freeze(['Cluster: broad claim → scope challenge → narrowed claim → narrowed state.']),
    negativeExamples: Object.freeze(['Cluster with no scope refinement.']),
    falsePositiveGuards: Object.freeze(['Distinct from move-intrinsic narrows_claim (#44).']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: narrowing is structural; preserves narrow standing.',
      'point-standing-economy: narrowing is recovery-positive — earns standing-repair credit while preserving the narrowed claim.',
    ]),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #25 conceded (lifecycle)
  buildResolution({
    rawKey: 'conceded',
    source: 'lifecycle',
    label: 'Conceded',
    shortLabel: 'Conceded',
    description: 'A concession was offered by the author.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 27,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the conceded lifecycle state — the author offered a concession?',
    positiveDefinition: 'Lifecycle: the author explicitly conceded the narrow or broader point in this cluster.',
    negativeDefinition: 'No concession offered.',
    positiveExamples: Object.freeze(['Cluster with author posting "you are right; conceding that narrow point" → conceded.']),
    negativeExamples: Object.freeze(['Cluster with ongoing dispute.']),
    falsePositiveGuards: Object.freeze([
      'DOCTRINE: concession is a SCORING REPAIR, not a loss. Copy never frames as "lost".',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: concession is structural; never implies the conceding side is "wrong".',
      'cdiscourse-doctrine §1: concession is a productive recovery move.',
      'point-standing-economy: an explicit narrow concession that preserves the broad point LIFTS broad standing (+0.25) and shrinks the narrow defect (-0.15) per CONCESSION_EFFECT_WEIGHTS.',
    ]),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #26 confirmed (lifecycle)
  buildResolution({
    rawKey: 'confirmed',
    source: 'lifecycle',
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    description: 'The other side confirmed this point.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 29,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the confirmed lifecycle state — the other side confirmed the parent claim?',
    positiveDefinition: 'Lifecycle: a participant from the other side posted explicit confirmation of the claim.',
    negativeDefinition: 'No confirmation, or confirmation only from same side (not cross-side).',
    positiveExamples: Object.freeze(['Cluster with cross-side confirmation move.']),
    negativeExamples: Object.freeze(['Cluster with only same-side support.']),
    falsePositiveGuards: Object.freeze(['Cross-side confirmation required; same-side agreement is supports_parent.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: cross-side confirmation is high-signal recovery move.',
      'point-standing-economy: cross-side confirmation increases factual standing.',
    ]),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #27 synthesis_ready (lifecycle)
  buildResolution({
    rawKey: 'synthesis_ready',
    source: 'lifecycle',
    label: 'Synthesis',
    shortLabel: 'Synthesis',
    description: 'This cluster is ready for synthesis.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 26,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the synthesis_ready lifecycle state?',
    positiveDefinition: 'Lifecycle: cluster has common ground + remaining narrow differences; synthesis may resolve productively.',
    negativeDefinition: 'No synthesis-ready signal.',
    positiveExamples: Object.freeze(['Cluster with established common ground + narrow remaining dispute.']),
    negativeExamples: Object.freeze(['Cluster with active broad disagreement.']),
    falsePositiveGuards: Object.freeze(['Decision 5: brief ready_for_synthesis collapses into this lifecycle state + ai_classifier #46.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: synthesis-ready is structural cluster state.',
      'point-standing-economy: synthesis is highest-value resolution-progress move.',
    ]),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #33 exhausted (lifecycle)
  buildResolution({
    rawKey: 'exhausted',
    source: 'lifecycle',
    label: 'Exhausted',
    shortLabel: 'Exhausted',
    description: 'This cluster is out of new angles.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 24,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the exhausted lifecycle state?',
    positiveDefinition: 'Lifecycle: cluster has been cycling on same axes without new content for N+ turns.',
    negativeDefinition: 'New content per turn.',
    positiveExamples: Object.freeze(['Cluster cycling >10 turns on same axes.']),
    negativeExamples: Object.freeze(['Active cluster with fresh axes.']),
    falsePositiveGuards: Object.freeze(['Pairs with auto_metadata point_exhausted (move-level version).']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: structural cluster state.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #34 branch_recommended (lifecycle)
  buildResolution({
    rawKey: 'branch_recommended',
    source: 'lifecycle',
    label: 'Branch hint',
    shortLabel: 'Branch hint',
    description: 'Branching is recommended for this exchange.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 35,
    visibleByDefault: true,
    booleanQuestion: 'Is this cluster in the branch_recommended lifecycle state?',
    positiveDefinition: 'Lifecycle: heuristic + cluster history suggests branching would be productive.',
    negativeDefinition: 'No branch recommendation.',
    positiveExamples: Object.freeze(['Cluster with multiple active axes recommended for branching.']),
    negativeExamples: Object.freeze(['Single-axis cluster.']),
    falsePositiveGuards: Object.freeze(['Decision 5: brief branch_recommended (Family G) collapses into this existing key. No alias added.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: structural recommendation; never required.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #35 archived_or_resolved (lifecycle)
  buildResolution({
    rawKey: 'archived_or_resolved',
    source: 'lifecycle',
    label: 'Resolved',
    shortLabel: 'Resolved',
    description: 'This cluster is archived or resolved.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 70,
    visibleByDefault: false,
    booleanQuestion: 'Is this cluster archived or marked resolved?',
    positiveDefinition: 'Lifecycle terminal state: cluster has been archived (by participant action) or resolved (by synthesis / concession / etc.).',
    negativeDefinition: 'Cluster active.',
    positiveExamples: Object.freeze(['Archived cluster.', 'Synthesized cluster.']),
    negativeExamples: Object.freeze(['Open cluster.']),
    falsePositiveGuards: Object.freeze(['Distinct from move-intrinsic issue_closed_by_participant (NEW Family G).']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: terminal cluster state.']),
    confidenceEligibility: RETRO_HIGH_ELIGIBILITY,
  }),

  // #44 narrows_claim (ai_classifier)
  buildResolution({
    rawKey: 'narrows_claim',
    source: 'ai_classifier',
    label: 'Claim narrowed',
    shortLabel: 'Narrowed',
    description: 'The claim was narrowed.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 21,
    visibleByDefault: false,
    booleanQuestion: 'Does this move narrow the parent\'s claim from a broader to narrower form?',
    positiveDefinition: 'The move\'s author proposes a narrower form of the parent\'s claim, preserving the narrow form as defensible.',
    negativeDefinition: 'The move challenges the claim, refines on the same scope (refines_parent), extends, or asks for clarification.',
    positiveExamples: Object.freeze([
      "Parent: 'Carbon taxes work.' Move: 'Narrowing my claim — they work IN jurisdictions with stable enforcement, over 5+ year horizons.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon taxes do not work.' (challenges)",
    ]),
    falsePositiveGuards: Object.freeze(['Distinct from lifecycle narrowed (cluster state).']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: narrowing is recovery-positive structural move.',
      'point-standing-economy: narrowing preserves the narrow defensible claim and lifts standing.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #45 concedes_narrow_point (ai_classifier)
  buildResolution({
    rawKey: 'concedes_narrow_point',
    source: 'ai_classifier',
    label: 'Narrow concession',
    shortLabel: 'Conceded',
    description: 'A narrow concession was offered.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 27,
    visibleByDefault: false,
    booleanQuestion: 'Does this move concede a narrow point while preserving the broader claim or position?',
    positiveDefinition: 'The move explicitly grants a specific narrow point that the parent or earlier move challenged, while maintaining the broader claim.',
    negativeDefinition: 'The move concedes the broader point (concedes_broader_point NEW), challenges, or evades.',
    positiveExamples: Object.freeze([
      "Move: 'You are right that the BC effect was 3% not 5% — granted; the broader point about carbon-tax effectiveness still holds.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'You are right — I withdraw my entire position.' (concedes_broader_point)",
    ]),
    falsePositiveGuards: Object.freeze([
      'DOCTRINE: narrow concession is REPAIR, never defeat.',
      'Decision 5: brief narrow_concession_present collapses into this. No alias.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §1: concession is scoring repair, not loss.',
      'cdiscourse-doctrine §10a: structural recovery-positive.',
      'point-standing-economy: narrow concession (+0.25 broad, -0.15 narrow) per CONCESSION_EFFECT_WEIGHTS.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #46 ready_for_synthesis (ai_classifier)
  buildResolution({
    rawKey: 'ready_for_synthesis',
    source: 'ai_classifier',
    label: 'Synthesis ready',
    shortLabel: 'Synthesis',
    description: 'This exchange is ready for synthesis.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 26,
    visibleByDefault: false,
    booleanQuestion: 'Does this move signal that the cluster is ready for synthesis (sufficient common ground established)?',
    positiveDefinition: 'The move\'s content indicates common ground + remaining narrow differences; synthesis would be productive.',
    negativeDefinition: 'Active broad disagreement, or move advances one side without synthesis-readiness signal.',
    positiveExamples: Object.freeze([
      "Move: 'I think we are mostly aligned; the remaining piece is the timing question.'",
    ]),
    negativeExamples: Object.freeze([
      "Move advancing broad disagreement.",
    ]),
    falsePositiveGuards: Object.freeze([
      'Compound key disambiguates from lifecycle synthesis_ready.',
      'Decision 5: brief ready_for_synthesis (Family G) collapses into this + lifecycle. No new key.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: synthesis-ready signal is structural.',
      'point-standing-economy: signal toward highest-value resolution move.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #47 suggests_side_branch (ai_classifier)
  buildResolution({
    rawKey: 'suggests_side_branch',
    source: 'ai_classifier',
    label: 'Side branch suggested',
    shortLabel: 'Side branch',
    description: 'A side branch is suggested.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 42,
    visibleByDefault: false,
    booleanQuestion: 'Does this move suggest opening a side branch from the current discussion?',
    positiveDefinition: 'The move proposes a related but separable point that could be productively explored in a side branch.',
    negativeDefinition: 'The move extends on the current topic, introduces a fully new topic, or stays on the same axis.',
    positiveExamples: Object.freeze([
      "Move: 'Worth pursuing the staffing question separately — it is a sub-axis of library funding but distinct from this thread.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Let me make a new claim.' (introduces_new_issue)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with introduces_sub_axis (Family I) — side branch is structural action; sub-axis is the discussion shape.',
    ]),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: side-branch suggestion is structural.']),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #48 suggests_diagonal_tangent (ai_classifier)
  buildResolution({
    rawKey: 'suggests_diagonal_tangent',
    source: 'ai_classifier',
    label: 'Tangent branch suggested',
    shortLabel: 'Tangent',
    description: 'A tangent branch is suggested.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 43,
    visibleByDefault: false,
    booleanQuestion: 'Does this move suggest a tangential branch — a related issue that is distinct enough to merit its own thread?',
    positiveDefinition: 'The move proposes a tangentially-related topic that would benefit from its own thread rather than crowding the current one.',
    negativeDefinition: 'The move stays on topic, introduces a fully new issue, or extends.',
    positiveExamples: Object.freeze([
      "Move: 'The museum funding question is tangentially related; might be worth a separate thread.'",
    ]),
    negativeExamples: Object.freeze(['Move staying on current topic.']),
    falsePositiveGuards: Object.freeze(['Tangent suggestion is structural, not a verdict on the tangent\'s relevance.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: tangent suggestion is structural action proposal.']),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #52 accepts_partial_with_caveat (ai_classifier)
  buildResolution({
    rawKey: 'accepts_partial_with_caveat',
    source: 'ai_classifier',
    label: 'Partial acceptance',
    shortLabel: 'Partial',
    description: 'A partial acceptance with a caveat was offered.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 47,
    visibleByDefault: false,
    booleanQuestion: 'Does this move partially accept the parent while attaching an explicit caveat or condition?',
    positiveDefinition: 'The move says "I accept X with caveat Y" — partial acceptance is the key signal.',
    negativeDefinition: 'Full acceptance (acknowledges_parent / supports_parent), full rejection (challenges_parent), or unrelated.',
    positiveExamples: Object.freeze([
      "Move: 'Agreed on the broad point — with the caveat that it only holds in jurisdictions with enforcement.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Yes, completely agree.' (full acceptance)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Distinct from concedes_with_new_dispute — partial-with-caveat is unilateral; concession+rebut creates new dispute.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: partial acceptance is recovery-positive structural move.',
      'point-standing-economy: partial acceptance opens narrowing path.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #58 concedes_with_new_dispute (ai_classifier)
  buildResolution({
    rawKey: 'concedes_with_new_dispute',
    source: 'ai_classifier',
    label: 'Concession plus new dispute',
    shortLabel: 'Concede+',
    description: 'A concession was offered alongside a new dispute.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 50,
    visibleByDefault: false,
    booleanQuestion: 'Does this move offer a concession on one point AND raise a new dispute on another?',
    positiveDefinition: 'Compound move: explicit concession on point A + explicit new challenge / dispute on point B.',
    negativeDefinition: 'Pure concession (concedes_narrow_point / concedes_broader_point), pure dispute, or unilateral partial acceptance.',
    positiveExamples: Object.freeze([
      "Move: 'You are right that BC was 3%, not 5% — but the broader carbon-tax effectiveness claim needs more evidence on the durability axis.'",
    ]),
    negativeExamples: Object.freeze(['Pure concession or pure challenge.']),
    falsePositiveGuards: Object.freeze(['Compound nature is essential — single-move both concession AND new challenge.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: compound move; structural.',
      'point-standing-economy: concession-with-rebut earns engagement credit on concession side AND opens new pressure axis.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #59 proposes_settlement_terms (ai_classifier)
  buildResolution({
    rawKey: 'proposes_settlement_terms',
    source: 'ai_classifier',
    label: 'Settlement proposed',
    shortLabel: 'Settle?',
    description: 'Settlement terms were proposed.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 51,
    visibleByDefault: false,
    booleanQuestion: 'Does this move propose specific settlement terms for resolving the dispute?',
    positiveDefinition: 'The move articulates concrete terms for ending the dispute: "I propose we agree on X, set aside Y, and commit to Z".',
    negativeDefinition: 'The move proposes synthesis without settlement framing, or proposes one-sided position, or asks about settlement.',
    positiveExamples: Object.freeze([
      "Move: 'I propose: we agree on the 12-city carbon tax data; set aside Australia as out-of-scope; both commit to revisiting in 2026 with the next 5-year sample.'",
    ]),
    negativeExamples: Object.freeze(['Move proposing synthesis without explicit settlement terms.']),
    falsePositiveGuards: Object.freeze(['Distinct from synthesis_proposed (NEW Family G) — settlement is more procedural; synthesis is more substantive.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: settlement proposal is structural resolution move.',
      'point-standing-economy: settlement closes engagement debt cleanly when accepted.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // #60 accepts_settlement_terms (ai_classifier)
  buildResolution({
    rawKey: 'accepts_settlement_terms',
    source: 'ai_classifier',
    label: 'Settlement accepted',
    shortLabel: 'Settle OK',
    description: 'Settlement terms were accepted.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 52,
    visibleByDefault: false,
    booleanQuestion: 'Does this move accept settlement terms that were proposed earlier?',
    positiveDefinition: 'The move explicitly accepts the proposed terms.',
    negativeDefinition: 'The move counter-proposes settlement, rejects, or ignores.',
    positiveExamples: Object.freeze([
      "Move: 'Accepted on all three terms. Let us move on.'",
    ]),
    negativeExamples: Object.freeze(['Move counter-proposing.', 'Move ignoring proposal.']),
    falsePositiveGuards: Object.freeze(['Requires prior proposes_settlement_terms in cluster.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: settlement acceptance closes the cluster cleanly.',
      'point-standing-economy: bilateral acceptance is high-signal resolution.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // ── 9 NEW ──

  // NEW concedes_broader_point
  buildResolution({
    rawKey: 'concedes_broader_point',
    source: 'ai_classifier',
    label: 'Broader concession',
    shortLabel: 'Broad concede',
    description: 'A broader position has been relinquished here.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 89,
    visibleByDefault: false,
    booleanQuestion: 'Does this move relinquish the broader position or main claim (not just a narrow sub-point)?',
    positiveDefinition: 'The author concedes the main broad claim of the cluster, not just a narrow sub-point. Distinct from concedes_narrow_point.',
    negativeDefinition: 'Narrow concession only (concedes_narrow_point), evasion, or non-concession.',
    positiveExamples: Object.freeze([
      "Move: 'Stepping back — on reflection, the broader carbon-tax effectiveness argument is weaker than I thought; I withdraw the broad claim and stand on the narrow scope only.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Narrow concession on the BC figure; broader claim stands.' (concedes_narrow_point)",
    ]),
    falsePositiveGuards: Object.freeze([
      'DOCTRINE: broad concession is RELINQUISHMENT of broader frame here, NEVER framed as "this side lost".',
      'Distinct from concedes_narrow_point — broad concession relinquishes the main claim, narrow preserves it.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §1: concession is scoring repair, not defeat — even broad concession.',
      'cdiscourse-doctrine §10a: structural relinquishment; never a verdict.',
      'point-standing-economy: broad concession is the highest-cost concession; the move preserves engagement credit and resets standing for future rebuilding.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // NEW common_ground_identified
  buildResolution({
    rawKey: 'common_ground_identified',
    source: 'ai_classifier',
    label: 'Common ground',
    shortLabel: 'Common',
    description: 'This move names common ground established between sides.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 88,
    visibleByDefault: false,
    booleanQuestion: 'Does this move explicitly name common ground that both sides have reached?',
    positiveDefinition: 'The move surfaces shared agreement: "we both agree on X"; "the common ground is Y"; "neither of us disputes Z".',
    negativeDefinition: 'The move proposes synthesis (synthesis_proposed) — synthesis goes beyond common ground; acknowledges_parent — same-side. Common-ground identification is cross-side shared.',
    positiveExamples: Object.freeze([
      "Move: 'I think we both agree on the BC and Sweden data showing carbon-tax effectiveness; we disagree on whether that generalizes.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What if we combine our points?' (synthesis_proposed)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Distinct from synthesis_proposed — common-ground is identification; synthesis is proposal.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: common-ground identification is recovery-positive structural move.',
      'point-standing-economy: identifying common ground often unsticks polarized disputes.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // NEW unresolved_point_isolated
  buildResolution({
    rawKey: 'unresolved_point_isolated',
    source: 'ai_classifier',
    label: 'Unresolved point isolated',
    shortLabel: 'Unresolved',
    description: 'This move isolates a specific unresolved point.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 91,
    visibleByDefault: false,
    booleanQuestion: 'Does this move isolate a specific unresolved point — naming what remains in dispute amid established common ground?',
    positiveDefinition: 'The move names the precise unresolved point with common-ground context: "we agree on A, B, C; the open question is D".',
    negativeDefinition: 'The move identifies common ground without isolating a remaining point, or makes a new claim, or extends.',
    positiveExamples: Object.freeze([
      "Move: 'Common ground: BC and Sweden carbon-tax data. Open question: whether Australia repeal is the exception or the warning.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'We agree on a lot of this.' (common_ground_identified only)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Requires both common-ground identification AND isolation of remaining point.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: isolation move is structural resolution-progress.',
      'point-standing-economy: isolating unresolved points enables productive next moves.',
    ]),
    confidenceEligibility: NEW_INSPECT_ELIGIBILITY,
  }),

  // NEW synthesis_proposed
  buildResolution({
    rawKey: 'synthesis_proposed',
    source: 'ai_classifier',
    label: 'Synthesis proposed',
    shortLabel: 'Synthesis',
    description: 'This move proposes a synthesis combining elements of both sides.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 90,
    visibleByDefault: false,
    booleanQuestion: 'Does this move propose a synthesis (a combined position) that draws from both sides of the current disagreement?',
    positiveDefinition: 'The move explicitly names elements from both sides and proposes a combined position. The synthesis may be compromise, scoping reconciliation, definitional clarification that dissolves a fake disagreement, or layered position.',
    negativeDefinition: 'The move advances one side only, concedes without offering a combined position, or merely identifies common ground without proposing synthesis.',
    positiveExamples: Object.freeze([
      "Move: 'Could we say: libraries-as-infrastructure for stable communities, libraries-as-discretionary for transient ones?' (synthesizing scope)",
      "Move: 'Maybe both: EVs reduce urban tailpipe pollution AND battery production needs cleaner grids. Both true; question is which dominates in 2030.'",
      "Move: 'What if the disagreement is really about HOW to fund, not WHETHER — and we both want funded libraries?' (synthesis dissolving)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'You are right; I concede.' (pure concession)",
      "Move: 'We agree libraries matter; we disagree on funding.' (common_ground_identified, not synthesis)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that name common ground without proposing a synthesis.',
      'Do NOT mark TRUE for pure concession — that is concedes_narrow_point / concedes_broader_point.',
      'Do NOT mark TRUE based on tone of conciliation; synthesis must be substantive.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §1: synthesis is a GAMEPLAY move, not a verdict about who "won". Both sides retain standing.',
      'point-standing-economy: synthesis is the highest-value resolution-progress move; both sides earn engagement credit and may earn standing repair credit.',
      'lifecycle: pairs with synthesis_ready cluster state — synthesis_proposed is the MOVE that produces a synthesis_ready cluster.',
    ]),
    confidenceEligibility: NEW_TIMELINE_ELIGIBILITY,
  }),

  // NEW move_on_requested
  buildResolution({
    rawKey: 'move_on_requested',
    source: 'ai_classifier',
    label: 'Move on requested',
    shortLabel: 'Move on?',
    description: 'This move requests setting aside the current point.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 92,
    visibleByDefault: false,
    booleanQuestion: 'Does this move request that the current point be set aside without explicit resolution, in favor of moving to a different topic?',
    positiveDefinition: 'The move says "let us set this aside" / "agree to disagree" / "move on" without resolving the point.',
    negativeDefinition: 'The move proposes synthesis / settlement, makes a new claim, or asks for branching.',
    positiveExamples: Object.freeze([
      "Move: 'Can we set this aside and come back to it later? I want to address the staffing question.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Let me propose synthesis.' (synthesis_proposed)",
    ]),
    falsePositiveGuards: Object.freeze(['Distinct from synthesis / settlement — move-on does not resolve.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: move-on request is structural; productive when used to prioritize.',
      'point-standing-economy: move-on leaves standing as-is on the unresolved point; debt persists.',
    ]),
    confidenceEligibility: NEW_INSPECT_ELIGIBILITY,
  }),

  // NEW issue_closed_by_participant
  buildResolution({
    rawKey: 'issue_closed_by_participant',
    source: 'ai_classifier',
    label: 'Issue closed',
    shortLabel: 'Closed',
    description: 'A participant explicitly closes an issue.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 93,
    visibleByDefault: false,
    booleanQuestion: 'Does this move explicitly close an issue (the participant declares the issue resolved or no longer active for them)?',
    positiveDefinition: 'The move declares the issue closed by participant action: "for me, this is settled"; "I am done on this point"; "moving on from this issue".',
    negativeDefinition: 'The move proposes synthesis, asks to move on (move_on_requested), or evades.',
    positiveExamples: Object.freeze([
      "Move: 'For me, the BC carbon-tax question is settled with the data we have. I am done with this thread.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Let us set this aside.' (move_on_requested)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Distinct from move_on_requested — closed is final for this participant.',
      'Distinct from archived_or_resolved (auto-derived terminal state).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: participant-intrinsic closure is structural.',
      'point-standing-economy: unilateral closure does not change cross-side standing; cluster may continue without this participant.',
    ]),
    confidenceEligibility: NEW_INSPECT_ELIGIBILITY,
  }),

  // NEW decision_criterion_proposed
  buildResolution({
    rawKey: 'decision_criterion_proposed',
    source: 'ai_classifier',
    label: 'Decision criterion proposed',
    shortLabel: 'Crit proposed',
    description: 'This move proposes a decision criterion for evaluating the question.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 94,
    visibleByDefault: false,
    booleanQuestion: 'Does this move propose a specific criterion or test for deciding the question under dispute?',
    positiveDefinition: 'The move says "the criterion should be X" — proposing how to evaluate which side\'s position is more defensible.',
    negativeDefinition: 'The move disputes an existing criterion (disputes_decision_criterion Family B), uses a criterion within an argument, or makes a substantive claim.',
    positiveExamples: Object.freeze([
      "Move: 'I propose: we evaluate carbon-tax effectiveness by sustained 5-year emission deltas in jurisdictions with stable enforcement. Excludes Australia, includes BC and Sweden.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Cost-per-visit is the wrong criterion.' (disputes_decision_criterion)",
    ]),
    falsePositiveGuards: Object.freeze(['Proposing distinct from disputing — propose is collaborative.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: criterion proposal is structural framing move.',
      'point-standing-economy: shared decision criterion accelerates resolution.',
    ]),
    confidenceEligibility: NEW_INSPECT_ELIGIBILITY,
  }),

  // NEW action_item_proposed
  buildResolution({
    rawKey: 'action_item_proposed',
    source: 'ai_classifier',
    label: 'Action item proposed',
    shortLabel: 'Action?',
    description: 'This move proposes an action item.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 95,
    visibleByDefault: false,
    booleanQuestion: 'Does this move propose a specific action item that one or both participants should take?',
    positiveDefinition: 'The move identifies an action: "let us look up the IPCC data"; "we should both review the Smith 2020 paper before continuing".',
    negativeDefinition: 'The move asks for evidence (asks_for_evidence), proposes synthesis, or makes a claim.',
    positiveExamples: Object.freeze([
      "Move: 'Let us both review the BC Ministry of Environment 2023 report before resuming the BC discussion.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'What is the BC source?' (asks_for_evidence)",
    ]),
    falsePositiveGuards: Object.freeze(['Action item is concrete (do X); not a vague suggestion.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: action proposal is structural resolution-progress.']),
    confidenceEligibility: NEW_INSPECT_ELIGIBILITY,
  }),

  // NEW followup_question_proposed
  buildResolution({
    rawKey: 'followup_question_proposed',
    source: 'ai_classifier',
    label: 'Follow-up question proposed',
    shortLabel: 'Followup?',
    description: 'This move proposes a follow-up question for future discussion.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 96,
    visibleByDefault: false,
    booleanQuestion: 'Does this move propose a follow-up question that should be addressed in a future discussion (not the current one)?',
    positiveDefinition: 'The move names a question for future exploration: "next thread we should tackle why Australia repealed".',
    negativeDefinition: 'The move asks a current question (questions_parent), proposes branching (suggests_side_branch), or makes a claim.',
    positiveExamples: Object.freeze([
      "Move: 'Worth exploring in a follow-up: why did the Australian carbon tax fail politically vs the BC one?'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Why did Australia repeal?' (questions_parent, current)",
    ]),
    falsePositiveGuards: Object.freeze(['Follow-up is for FUTURE discussion; current questions are different.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: future-question proposal is structural.']),
    confidenceEligibility: NEW_INSPECT_ELIGIBILITY,
  }),
]);
