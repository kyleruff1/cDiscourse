/**
 * MCP-021A — Family I (thread_topology) definitions.
 *
 * Per design §3.9: 21 entries total.
 *  - 14 existing assigned to Family I (RETROACTIVE_VERBOSE_DEFINITIONS):
 *      auto_metadata: has_reply (#1), participant_skipped_node (#9),
 *        no_response_after_n_turns (#10), repeated_axis_pressure (#11)
 *      lifecycle: open (#17), answered (#18),
 *        moved_on_by_affirmative (#28), moved_on_by_negative (#29),
 *        ignored_by_affirmative (#30), ignored_by_negative (#31),
 *        ignored_by_both (#32)
 *      ai_classifier: introduces_new_issue (#36),
 *        references_prior_agreement (#50), introduces_sub_axis (#57)
 *  - 7 NEW (Decision 7 source split):
 *      auto_metadata (4 — deterministically derivable from tree):
 *        splits_thread, merges_thread,
 *        references_sibling_node, references_ancestor_node
 *      ai_classifier (3 — require content classification):
 *        returns_to_prior_issue, references_external_context,
 *        compares_options
 *
 * Decision 7 (binding): per design §2.2.9, deterministically derivable
 * from tree structure → auto_metadata; requires content classification
 * → ai_classifier. The 4 auto_metadata new keys add registry slots; the
 * actual derivers live in threadTopologyAutoMetadata.ts (no-op stubs
 * in MCP-021A per Decision 7's "scope" rule).
 *
 * Brief candidate `repeats_prior_point` was DROPPED per Trigger 10
 * doctrine-risk (repeats reads as verdict on contribution). Brief
 * candidate `changes_subject` DUPLICATES existing introduces_new_issue.
 *
 * Doctrine anchors per entry:
 *   - cdiscourse-doctrine §10a — thread-topology observations are
 *     structural facts about argument-tree shape; never verdicts.
 *   - point-standing-economy — moves_on / ignored states affect
 *     scoring eligibility, not factual standing.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes';

const AUTO_META_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'high',
  inspectMinConfidence: 'high',
};

const TOPOLOGY_INSPECT_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'medium',
  inspectMinConfidence: 'low',
};

const TOPOLOGY_TIMELINE_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'medium',
  selectedContextMinConfidence: 'low',
  inspectMinConfidence: 'low',
};

interface TopologyBuilder {
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

function buildTopology(b: TopologyBuilder): MachineObservationDefinition {
  return Object.freeze({
    id: `registry:machine_observation:${b.source}:${b.rawKey}`,
    rawKey: b.rawKey,
    kind: 'machine_observation' as const,
    source: b.source,
    family: 'thread_topology' as const,
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

export const FAMILY_I_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // ── RETROACTIVE: 14 existing ──

  // #1 has_reply (auto_metadata)
  buildTopology({
    rawKey: 'has_reply',
    source: 'auto_metadata',
    label: 'Has reply',
    shortLabel: 'Has reply',
    description: 'A reply was posted on this move.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 80,
    visibleByDefault: false,
    booleanQuestion: 'Does this move have at least one child reply?',
    positiveDefinition: 'Auto-metadata: the move has ≥1 child in the argument tree.',
    negativeDefinition: 'No children.',
    positiveExamples: Object.freeze(['Move with ≥1 child → TRUE.']),
    negativeExamples: Object.freeze(['Leaf move → FALSE.']),
    falsePositiveGuards: Object.freeze(['Do NOT mark TRUE based on indirect descendants.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: auto-metadata structural fact.']),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #9 participant_skipped_node (auto_metadata)
  buildTopology({
    rawKey: 'participant_skipped_node',
    source: 'auto_metadata',
    label: 'Side skipped',
    shortLabel: 'Side skipped',
    description: 'The same side has posted past this move without responding to it.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 60,
    visibleByDefault: false,
    booleanQuestion: 'Has the same side posted later moves elsewhere in the tree without responding to this move?',
    positiveDefinition: 'Auto-metadata: the same side has subsequent moves in other clusters but no response to this move.',
    negativeDefinition: 'The same side responded, or no later moves by that side exist.',
    positiveExamples: Object.freeze(['Side A posted M1; side A then posted in cluster Y; no response to M1.']),
    negativeExamples: Object.freeze(['Side A posted M1; side A posted reply to M1.']),
    falsePositiveGuards: Object.freeze(['Do NOT confuse with no_response_after_n_turns.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural fact about engagement pattern.',
      'point-standing-economy: skipped-side may reduce engagement credit but does not change factual standing.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #10 no_response_after_n_turns (auto_metadata)
  buildTopology({
    rawKey: 'no_response_after_n_turns',
    source: 'auto_metadata',
    label: 'No follow-up',
    shortLabel: 'No follow-up',
    description: 'This move has no follow-up after several turns.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 25,
    visibleByDefault: true,
    booleanQuestion: 'Has this move received no reply after N turns elsewhere in the room?',
    positiveDefinition: 'Auto-metadata: N other moves have been posted in the room since this move; this move has zero replies.',
    negativeDefinition: 'The move has replies, or fewer than N other moves have been posted since.',
    positiveExamples: Object.freeze(['Move with 0 replies; 5 other moves elsewhere in room → TRUE (N=5).']),
    negativeExamples: Object.freeze(['Move with 1 reply → FALSE.']),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for fresh moves (insufficient time for follow-up).',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural engagement-pattern fact.',
      'point-standing-economy: lack of follow-up may indicate the point is unaddressed; advisory only.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #11 repeated_axis_pressure (auto_metadata)
  buildTopology({
    rawKey: 'repeated_axis_pressure',
    source: 'auto_metadata',
    label: 'Repeated',
    shortLabel: 'Repeated',
    description: 'The same axis has received repeated pressure.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 28,
    visibleByDefault: true,
    booleanQuestion: 'Has the same disagreement axis received repeated pressure from multiple challenge moves?',
    positiveDefinition: 'Auto-metadata: more than one challenge move targets the same axis of the same parent claim.',
    negativeDefinition: 'Single challenge or distinct axes from multiple challenges.',
    positiveExamples: Object.freeze([
      'Parent claim has 3 child challenges all targeting evidence-applicability axis → TRUE.',
    ]),
    negativeExamples: Object.freeze([
      'Single challenge → FALSE.',
      'Multiple challenges, different axes → FALSE.',
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for parallel challenges on different axes.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural engagement-pressure fact.',
      'point-standing-economy: repeated pressure may indicate need for parent\'s response; advisory only.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #17 open (lifecycle)
  buildTopology({
    rawKey: 'open',
    source: 'lifecycle',
    label: 'Open',
    shortLabel: 'Open',
    description: 'This cluster is open for response.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 75,
    visibleByDefault: false,
    booleanQuestion: 'Is this cluster in the open lifecycle state — no replies posted yet?',
    positiveDefinition: 'Lifecycle state: cluster has 0 replies; awaiting first response.',
    negativeDefinition: 'Cluster has ≥1 reply (moved to answered or further state).',
    positiveExamples: Object.freeze(['Fresh cluster with claim only → open.']),
    negativeExamples: Object.freeze(['Cluster with at least one reply → answered.']),
    falsePositiveGuards: Object.freeze(['Compound key disambiguates from any non-lifecycle "open" usage.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: lifecycle state; awaiting engagement.']),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #18 answered (lifecycle)
  buildTopology({
    rawKey: 'answered',
    source: 'lifecycle',
    label: 'Answered',
    shortLabel: 'Answered',
    description: 'This cluster has at least one reply.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 76,
    visibleByDefault: false,
    booleanQuestion: 'Is this cluster in the answered lifecycle state — at least one reply posted?',
    positiveDefinition: 'Lifecycle state: cluster has ≥1 reply.',
    negativeDefinition: 'Cluster has 0 replies (open) or has moved to another state.',
    positiveExamples: Object.freeze(['Cluster with 1+ replies → answered.']),
    negativeExamples: Object.freeze(['Cluster with no replies → open.']),
    falsePositiveGuards: Object.freeze(['Answered does not mean resolved; further lifecycle transitions may apply.']),
    doctrineNotes: Object.freeze(['cdiscourse-doctrine §10a: lifecycle state.']),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #28 moved_on_by_affirmative (lifecycle)
  buildTopology({
    rawKey: 'moved_on_by_affirmative',
    source: 'lifecycle',
    label: 'Moved on (Aff)',
    shortLabel: 'Moved on (Aff)',
    description: 'The affirmative side moved on from this point.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 65,
    visibleByDefault: false,
    booleanQuestion: 'Has the affirmative side posted past this cluster without resolving it?',
    positiveDefinition: 'Lifecycle: affirmative posted subsequent moves elsewhere; this cluster has unresolved obligations from the affirmative.',
    negativeDefinition: 'Affirmative still active in this cluster, or no subsequent affirmative moves elsewhere.',
    positiveExamples: Object.freeze(['Aff posted M1 in cluster X; Aff later posted in cluster Y; M1 has open challenge.']),
    negativeExamples: Object.freeze(['Aff still responding in cluster X.']),
    falsePositiveGuards: Object.freeze(['Cluster-on-side fact only.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: lifecycle / engagement pattern fact.',
      'point-standing-economy: moved-on without resolution may reduce engagement credit.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #29 moved_on_by_negative (lifecycle)
  buildTopology({
    rawKey: 'moved_on_by_negative',
    source: 'lifecycle',
    label: 'Moved on (Neg)',
    shortLabel: 'Moved on (Neg)',
    description: 'The negative side moved on from this point.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 66,
    visibleByDefault: false,
    booleanQuestion: 'Has the negative side posted past this cluster without resolving it?',
    positiveDefinition: 'Lifecycle: negative posted subsequent moves elsewhere; this cluster has unresolved obligations from the negative.',
    negativeDefinition: 'Negative still active in this cluster, or no subsequent negative moves.',
    positiveExamples: Object.freeze(['Neg posted M2; Neg later posted in cluster Y; M2 unresolved.']),
    negativeExamples: Object.freeze(['Neg still responding.']),
    falsePositiveGuards: Object.freeze(['Cluster-on-side fact only.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: lifecycle / engagement pattern fact.',
      'point-standing-economy: moved-on without resolution may reduce engagement credit.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #30 ignored_by_affirmative (lifecycle)
  buildTopology({
    rawKey: 'ignored_by_affirmative',
    source: 'lifecycle',
    label: 'Skipped (Aff)',
    shortLabel: 'Skipped (Aff)',
    description: 'The affirmative side did not respond to a request here.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 67,
    visibleByDefault: false,
    booleanQuestion: 'Did the affirmative side fail to respond to an explicit request (source / quote / clarification) in this cluster?',
    positiveDefinition: 'Lifecycle: an explicit request was posted asking the affirmative; affirmative posted subsequent moves elsewhere without answering.',
    negativeDefinition: 'No explicit request, or affirmative answered, or affirmative not yet given N-turn window.',
    positiveExamples: Object.freeze(['Aff received source request; posted elsewhere; never responded.']),
    negativeExamples: Object.freeze(['Aff answered the request.']),
    falsePositiveGuards: Object.freeze(['Requires an explicit request; not all silence is ignoring.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural fact; never a verdict.',
      'evidence-doctrine: ignored request indicates open evidence debt.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #31 ignored_by_negative (lifecycle)
  buildTopology({
    rawKey: 'ignored_by_negative',
    source: 'lifecycle',
    label: 'Skipped (Neg)',
    shortLabel: 'Skipped (Neg)',
    description: 'The negative side did not respond to a request here.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 68,
    visibleByDefault: false,
    booleanQuestion: 'Did the negative side fail to respond to an explicit request in this cluster?',
    positiveDefinition: 'Lifecycle: an explicit request was posted asking the negative; negative posted subsequent moves elsewhere without answering.',
    negativeDefinition: 'No request, or negative answered, or insufficient time.',
    positiveExamples: Object.freeze(['Neg received clarification request; posted elsewhere; no answer.']),
    negativeExamples: Object.freeze(['Neg answered the request.']),
    falsePositiveGuards: Object.freeze(['Requires an explicit request.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural fact.',
      'evidence-doctrine: ignored request indicates open evidence debt.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #32 ignored_by_both (lifecycle)
  buildTopology({
    rawKey: 'ignored_by_both',
    source: 'lifecycle',
    label: 'No follow-up',
    shortLabel: 'No follow-up',
    description: 'Nobody followed up on this point.',
    defaultSurface: 'timeline_node',
    disposition: 'rendered_now',
    priority: 33,
    visibleByDefault: true,
    booleanQuestion: 'Did neither side respond to this cluster after the N-turn window?',
    positiveDefinition: 'Lifecycle: both sides posted past this cluster without engaging.',
    negativeDefinition: 'At least one side engaged, or insufficient time.',
    positiveExamples: Object.freeze(['Cluster with no replies from either side; both sides active elsewhere.']),
    negativeExamples: Object.freeze(['Either side responded.']),
    falsePositiveGuards: Object.freeze(['Requires both-sides moved on; not the same as no_response_after_n_turns.']),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural fact about cluster-wide engagement.',
      'point-standing-economy: both-sides-ignored often indicates the cluster is exhausted or off-topic.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // #36 introduces_new_issue (ai_classifier)
  buildTopology({
    rawKey: 'introduces_new_issue',
    source: 'ai_classifier',
    label: 'Side issue',
    shortLabel: 'Side issue',
    description: 'This move introduces a new side issue.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 40,
    visibleByDefault: false,
    booleanQuestion: 'Does this move introduce a new issue or topic distinct from the parent\'s subject?',
    positiveDefinition: 'The move\'s substantive content is on a new topic / issue that is related to but distinct from the parent\'s subject. Requires semantic-equivalence judgment (Decision 7: stays ai_classifier).',
    negativeDefinition: 'The move stays on the parent\'s topic, returns to a prior issue, or extends to a closely-adjacent point.',
    positiveExamples: Object.freeze([
      "Parent on library funding. Move: 'Worth thinking about museum funding too — different question.'",
    ]),
    negativeExamples: Object.freeze([
      "Move staying on library funding — extends_parent or refines_parent, not introduces_new_issue.",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE for moves that extend on the same topic (extends_parent).',
      'Do NOT mark TRUE for moves that return to a prior issue (returns_to_prior_issue).',
      'Decision 5: brief candidate changes_subject DUPLICATES this. No alias added.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: new-issue introduction is structural; never a verdict on the move\'s quality.',
      'point-standing-economy: new-issue introduction creates a new cluster; standing tracks separately.',
    ]),
    confidenceEligibility: TOPOLOGY_TIMELINE_ELIGIBILITY,
  }),

  // #50 references_prior_agreement (ai_classifier)
  buildTopology({
    rawKey: 'references_prior_agreement',
    source: 'ai_classifier',
    label: 'Prior agreement referenced',
    shortLabel: 'Prior',
    description: 'A prior agreement is referenced.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 45,
    visibleByDefault: false,
    booleanQuestion: 'Does this move reference a prior agreement established earlier in the conversation?',
    positiveDefinition: 'The move cites a point on which both sides had previously agreed: "as we agreed earlier"; "given the shared definition we settled on". Requires content classification of cross-move reference (Decision 7: stays ai_classifier).',
    negativeDefinition: 'The move references a prior contested point, a new claim, or a parent without invoking shared agreement.',
    positiveExamples: Object.freeze([
      "Move: 'Given we agreed earlier that infrastructure means publicly-funded shared assets, libraries clearly qualify.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'You said earlier...' (paraphrase without invoking shared agreement)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE without an actual prior agreement to reference.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: agreement reference is structural recovery-positive move.',
      'point-standing-economy: invoking common ground often unsticks disputes.',
    ]),
    confidenceEligibility: TOPOLOGY_TIMELINE_ELIGIBILITY,
  }),

  // #57 introduces_sub_axis (ai_classifier)
  buildTopology({
    rawKey: 'introduces_sub_axis',
    source: 'ai_classifier',
    label: 'Sub-axis opened',
    shortLabel: 'Sub-axis',
    description: 'A sub-axis was opened.',
    defaultSurface: 'timeline_node',
    disposition: 'future_source',
    priority: 49,
    visibleByDefault: false,
    booleanQuestion: 'Does this move open a sub-axis within the parent\'s topic — a more specific dimension of the same dispute?',
    positiveDefinition: 'The move identifies a more specific dimension of the parent\'s topic and opens it as a sub-axis: parent is "library funding"; move opens "library STAFFING funding specifically" as a sub-axis.',
    negativeDefinition: 'The move introduces a wholly new topic (introduces_new_issue) or stays on the parent\'s topic without sub-dividing.',
    positiveExamples: Object.freeze([
      "Parent: 'Library funding matters.' Move: 'On STAFFING specifically — the union contract changes are the structural issue.' (sub-axis within funding)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Museum funding also matters.' (introduces_new_issue, not sub-axis)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with introduces_new_issue (new topic) — sub-axis stays within the topic.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: sub-axis opening is structural narrowing-positive move.',
      'point-standing-economy: sub-axis can narrow a stalled dispute productively.',
    ]),
    confidenceEligibility: TOPOLOGY_TIMELINE_ELIGIBILITY,
  }),

  // ── NEW 4 auto_metadata (Decision 7 — deterministically derivable) ──

  // NEW splits_thread
  buildTopology({
    rawKey: 'splits_thread',
    source: 'auto_metadata',
    label: 'Splits thread',
    shortLabel: 'Splits',
    description: 'This move creates a sibling branch under the same parent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 250,
    visibleByDefault: false,
    booleanQuestion: 'Does this move\'s parent already have other children, making this move a sibling that splits the thread?',
    positiveDefinition: 'The parent of this move has ≥2 children (this move is one of them), creating a branching point. Decision 7 outcome: deterministically derivable from argument tree structure.',
    negativeDefinition: 'The parent has only one child (this move) at the time of posting. The move is a linear continuation, not a thread split.',
    positiveExamples: Object.freeze([
      'Tree: A → [B, this_move]. (parent A has 2 children; this is a split)',
      'Tree: root → A → [B1, B2, this_move]. (parent A has 3 children)',
    ]),
    negativeExamples: Object.freeze([
      'Tree: A → this_move. (parent A has only this child; not a split)',
      'Tree: A → B → this_move. (parent B has only this child)',
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT mark TRUE based on cluster membership; the check is sibling-count on the immediate parent only.',
      'Do NOT mark TRUE for the first child of a multi-child parent at the moment of posting.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: thread-split observation is a STRUCTURAL fact about argument-tree shape; never implies the split is good or bad.',
      'Decision 7 (intent brief): deterministically derivable from tree structure → source: auto_metadata. The deriver lives in threadTopologyAutoMetadata.ts (no-op stub in MCP-021A; real implementation is MCP-021C territory).',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // NEW merges_thread
  buildTopology({
    rawKey: 'merges_thread',
    source: 'auto_metadata',
    label: 'Merges thread',
    shortLabel: 'Merges',
    description: 'This move merges two prior threads by referencing both.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 251,
    visibleByDefault: false,
    booleanQuestion: 'Does this move reference an ancestor node from a different branch and explicitly connect it back to the current branch?',
    positiveDefinition: 'The move references an ancestor in a different branch via cross-reference, creating a thread-merge pattern. Deterministically detectable from tree + reference structure.',
    negativeDefinition: 'The move stays within a single linear branch, or references only immediate parent / siblings, or introduces a new topic.',
    positiveExamples: Object.freeze([
      'Move in branch B references ancestor from branch A → merges_thread.',
    ]),
    negativeExamples: Object.freeze([
      'Move only references its parent → not a merge.',
    ]),
    falsePositiveGuards: Object.freeze([
      'Decision 7: detectable via references_ancestor_node + sibling-of-different-parent pattern; no content classification needed.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: thread-merge is structural.',
      'Decision 7: source: auto_metadata; deriver in threadTopologyAutoMetadata.ts (no-op MCP-021A).',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // NEW references_sibling_node
  buildTopology({
    rawKey: 'references_sibling_node',
    source: 'auto_metadata',
    label: 'References sibling',
    shortLabel: 'Sibling ref',
    description: 'This move references a sibling node in the argument tree.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 252,
    visibleByDefault: false,
    booleanQuestion: 'Does this move reference a sibling node (another child of the same parent) in the argument tree?',
    positiveDefinition: 'The move includes a structural reference to a sibling — a node at the same depth under the same parent. Deterministic from tree + reference structure.',
    negativeDefinition: 'The move references only its own parent / ancestor / descendants, or no other nodes.',
    positiveExamples: Object.freeze([
      'Parent has children [C1, C2, C3]; C3 says "@C1 makes a point that..." → references_sibling_node for C3.',
    ]),
    negativeExamples: Object.freeze([
      'Move references only the parent — not a sibling reference.',
    ]),
    falsePositiveGuards: Object.freeze([
      'Decision 7: structural reference detection; no content classification needed.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural cross-reference fact.',
      'Decision 7: source: auto_metadata.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // NEW references_ancestor_node
  buildTopology({
    rawKey: 'references_ancestor_node',
    source: 'auto_metadata',
    label: 'References ancestor',
    shortLabel: 'Ancestor ref',
    description: 'This move references an ancestor node beyond the immediate parent.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 253,
    visibleByDefault: false,
    booleanQuestion: 'Does this move reference an ancestor node (beyond the immediate parent) in the argument tree?',
    positiveDefinition: 'The move includes a structural reference to a grandparent or higher ancestor. Deterministic from tree + reference structure.',
    negativeDefinition: 'The move references only its own parent or siblings, or no other nodes.',
    positiveExamples: Object.freeze([
      'Move at depth 4 references the depth-1 root claim → references_ancestor_node.',
    ]),
    negativeExamples: Object.freeze([
      'Move references only its immediate parent.',
    ]),
    falsePositiveGuards: Object.freeze([
      'Decision 7: structural reference detection; no content classification needed.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: structural cross-reference fact.',
      'Decision 7: source: auto_metadata.',
    ]),
    confidenceEligibility: AUTO_META_ELIGIBILITY,
  }),

  // ── NEW 3 ai_classifier (Decision 7 — require content classification) ──

  // NEW returns_to_prior_issue
  buildTopology({
    rawKey: 'returns_to_prior_issue',
    source: 'ai_classifier',
    label: 'Returns to prior issue',
    shortLabel: 'Returns',
    description: 'This move returns to a previously-discussed issue.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 254,
    visibleByDefault: false,
    booleanQuestion: 'Does this move return to an issue that was raised earlier in the conversation and then set aside?',
    positiveDefinition: 'The move re-engages with a topic discussed in an earlier cluster that had moved on. Requires semantic-equivalence judgment to determine the issue is the "same" as the prior one (Decision 7: ai_classifier).',
    negativeDefinition: 'The move introduces a wholly new issue (introduces_new_issue), or extends the current cluster, or makes a fresh claim unrelated to prior issues.',
    positiveExamples: Object.freeze([
      "Earlier cluster: library staffing. Currently discussing: museum funding. Move: 'Coming back to the library staffing question — the union contract data does support X.'",
    ]),
    negativeExamples: Object.freeze([
      "Move staying on current topic.",
    ]),
    falsePositiveGuards: Object.freeze([
      'Do NOT confuse with references_prior_agreement (which is about cited agreed-on points).',
      'Decision 7: requires semantic-equivalence judgment that the issue is "same" → ai_classifier.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: return-to-issue is structural; productive when it brings new evidence to a parked dispute.',
    ]),
    confidenceEligibility: TOPOLOGY_INSPECT_ELIGIBILITY,
  }),

  // NEW references_external_context
  buildTopology({
    rawKey: 'references_external_context',
    source: 'ai_classifier',
    label: 'References external context',
    shortLabel: 'External',
    description: 'This move references external context (URL, quote, event outside the room).',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 255,
    visibleByDefault: false,
    booleanQuestion: 'Does this move reference external context — a URL, document, event, or other content not previously in the room?',
    positiveDefinition: 'The move brings in content from outside the room: a URL, a quoted document, a current event, a referenced paper. Requires content classification (Decision 7: ai_classifier).',
    negativeDefinition: 'The move references only in-room content (parent, ancestor, sibling, prior agreement) or makes a claim without external reference.',
    positiveExamples: Object.freeze([
      "Move: 'Per yesterday\\'s NYT article on library funding, the new program details are...' (external)",
    ]),
    negativeExamples: Object.freeze([
      "Move responding only to in-room moves.",
    ]),
    falsePositiveGuards: Object.freeze([
      'Decision 7: "external context" requires content classification of URL or quoted-document attribution → ai_classifier.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: external-reference is structural; can be evidence-positive (cited source) or scope-broadening.',
    ]),
    confidenceEligibility: TOPOLOGY_INSPECT_ELIGIBILITY,
  }),

  // NEW compares_options
  buildTopology({
    rawKey: 'compares_options',
    source: 'ai_classifier',
    label: 'Compares options',
    shortLabel: 'Compares',
    description: 'This move compares two or more options.',
    defaultSurface: 'inspect',
    disposition: 'future_source',
    priority: 256,
    visibleByDefault: false,
    booleanQuestion: 'Does this move compare two or more options and weigh them against each other?',
    positiveDefinition: 'The move explicitly compares options on stated criteria: "X gives us A but costs B; Y gives us A\' but costs B\'; on balance X wins because...". Requires content classification of the comparison structure (Decision 7: ai_classifier).',
    negativeDefinition: 'The move advances one option without comparing, disputes a single option, or uses cost-benefit reasoning on a single option.',
    positiveExamples: Object.freeze([
      "Move: 'Carbon tax vs cap-and-trade — tax is simpler and more predictable; cap-and-trade has better political durability. Tax wins for our context.'",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'Carbon tax is the right approach.' (no comparison)",
    ]),
    falsePositiveGuards: Object.freeze([
      'Decision 7: structured comparison requires content classification → ai_classifier.',
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: option comparison is structural recovery-positive.',
      'point-standing-economy: comparison moves often unstick polarized disputes by acknowledging trade-offs.',
    ]),
    confidenceEligibility: TOPOLOGY_INSPECT_ELIGIBILITY,
  }),
]);
