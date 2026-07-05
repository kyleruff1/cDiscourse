/**
 * RESEED-001 — the 6 named pack specs (as data).
 *
 * Each pack is engine-valid BY CONSTRUCTION. Every `chain` step names an
 * argument type whose transition from the previous step is legal under
 * `constitution.v1` (verified against the transition matrix):
 *
 *   root                  -> thesis | claim
 *   thesis                -> claim | rebuttal | evidence | clarification_request
 *   claim                 -> evidence | rebuttal | clarification_request | concession
 *   rebuttal              -> counter_rebuttal | evidence | clarification_request | concession
 *   counter_rebuttal      -> rebuttal | evidence | clarification_request | concession
 *   evidence              -> clarification_request | rebuttal
 *   clarification_request -> claim | evidence
 *   concession            -> synthesis
 *   synthesis             -> claim | clarification_request
 *
 * The planner (`reseedPackPlanner.js`) reads these specs, fills bodies from
 * bank premises, attaches a verbatim targetExcerpt to every reply, attaches a
 * source to every evidence move, and runs the engine pre-check on every move
 * before emitting it.
 *
 * `spine` values are the maneuver-grammar names rotated per thread:
 *   objection -> evidence-pressure -> alternative-explanation ->
 *   concession/narrowing -> resolution-pressure
 *
 * CommonJS / pure (data only).
 */

// Spine identifiers (maneuver grammar).
const SPINES = {
  OBJECTION: 'objection',
  EVIDENCE_PRESSURE: 'evidence-pressure',
  ALTERNATIVE_EXPLANATION: 'alternative-explanation',
  CONCESSION_NARROWING: 'concession/narrowing',
  RESOLUTION_PRESSURE: 'resolution-pressure',
};

/**
 * Each pack:
 *   name, description, spineMix[]  — spines this pack rotates through.
 *   shape: 'chain' | 'wide' | 'cluster'
 *   For 'chain': linear[] — argument types after the root (root is 'thesis').
 *   For 'wide':  root='thesis', siblingType, siblingCount[min,max], childType.
 *   For 'cluster': root='thesis', siblingType, siblingCount[min,max],
 *                  nearVerbatimCount — how many siblings are near-verbatim.
 *   evidenceEverywhere: bool — attach a source to every evidence step.
 */
const RESEED_PACKS = {
  baseline: {
    name: 'baseline',
    description:
      'Reference pack. thesis -> 2-3 claims -> 1-2 rebuttals; depth <= 3. Broadest voice/spine rotation.',
    shape: 'wide',
    root: 'thesis',
    siblingType: 'claim',
    siblingCount: [2, 3],
    childType: 'rebuttal',
    childCount: [1, 2],
    spineMix: [SPINES.OBJECTION, SPINES.EVIDENCE_PRESSURE],
    maxDepth: 3,
  },
  'deep-thread': {
    name: 'deep-thread',
    description:
      'thesis -> claim -> rebuttal -> counter_rebuttal -> evidence -> clarification_request chain; depth 5-6. Exercises maxDepth. Every reply pulls a fresh targetExcerpt from its immediate parent.',
    shape: 'chain',
    root: 'thesis',
    linear: ['claim', 'rebuttal', 'counter_rebuttal', 'evidence', 'clarification_request'],
    spineMix: [SPINES.ALTERNATIVE_EXPLANATION, SPINES.RESOLUTION_PRESSURE],
    maxDepth: 8,
  },
  'wide-room': {
    name: 'wide-room',
    description:
      'thesis -> 6-10 sibling claims, each with 1 rebuttal; depth <= 2. Breadth-heavy; distinct premises keep sibling similarity below the 0.7 duplicate warn.',
    shape: 'wide',
    root: 'thesis',
    siblingType: 'claim',
    siblingCount: [6, 10],
    childType: 'rebuttal',
    childCount: [1, 1],
    spineMix: [SPINES.OBJECTION],
    maxDepth: 2,
  },
  'evidence-heavy': {
    name: 'evidence-heavy',
    description:
      'Every non-root move is evidence where the transition allows, else rebuttal + evidence child. Every evidence move attaches a source (C-EVIDENCE-001 satisfied).',
    shape: 'chain',
    // thesis -> evidence -> rebuttal -> evidence -> clarification_request
    // (thesis->evidence ok; evidence->rebuttal ok; rebuttal->evidence ok;
    //  evidence->clarification_request ok)
    root: 'thesis',
    linear: ['evidence', 'rebuttal', 'evidence', 'clarification_request'],
    evidenceEverywhere: true,
    spineMix: [SPINES.EVIDENCE_PRESSURE],
    maxDepth: 6,
  },
  'archive-cluster': {
    name: 'archive-cluster',
    description:
      'thesis -> N sibling claims where a subset is near-verbatim (Jaccard >= 0.60). Deliberately trips the samey-move / near-verbatim detector end-to-end.',
    shape: 'cluster',
    root: 'thesis',
    siblingType: 'claim',
    siblingCount: [6, 8],
    nearVerbatimCount: 3,
    spineMix: [SPINES.OBJECTION],
    maxDepth: 2,
  },
  'resolution-arc': {
    name: 'resolution-arc',
    description:
      'thesis -> claim -> rebuttal -> concession -> synthesis (full arc to a closed thread). Concession + synthesis carry markers; exercises the CON/SYN engine paths.',
    shape: 'chain',
    root: 'thesis',
    linear: ['claim', 'rebuttal', 'concession', 'synthesis'],
    spineMix: [SPINES.CONCESSION_NARROWING, SPINES.RESOLUTION_PRESSURE],
    maxDepth: 6,
  },
};

const RESEED_PACK_NAMES = Object.keys(RESEED_PACKS);

module.exports = {
  RESEED_PACKS,
  RESEED_PACK_NAMES,
  SPINES,
};
