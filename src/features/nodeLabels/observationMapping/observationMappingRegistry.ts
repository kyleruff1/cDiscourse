/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — the reviewed,
 * reconciled existing-boolean mapping registry (A-G families only).
 *
 * This is the checked-in declarative data the evaluator reads (design §8.1:
 * "seeded from a REVIEWED subset, stored as a checked-in declarative data
 * file ... NOT a wholesale import of the raw CSV"). Every rule here is:
 *
 *   - RECONCILED — every `requiredTrueFlags` / `requiredFalseFlags` rawKey is
 *     a rawKey GENUINELY returned by the deployed classifier (the
 *     familyA..familyG definitions). No rule references a planned-but-not-
 *     deployed flag, so every rule can actually fire.
 *   - A-G ONLY — `familyKey` is one of the seven production families (or a
 *     `${famA}+${famB}` cross-family of two of them). H/I/J are NEVER present
 *     (frozen / out of scope — design §3 invariant 5).
 *   - REVIEWED — `labelShort` / `labelNeutral` / `diagnosticSentence` are
 *     verdict-free and move-level; each carries a `safetyNote`. The
 *     review-gate test (observationMappingReviewGate.test.ts) re-scans every
 *     row.
 *
 * RECONCILIATION FINDING (recorded in OBSERVATION_MAPPING_ADOPTION_MANIFEST):
 *   The candidate CSV
 *   (docs/designs/mcp-observation-mapping/mcp_boolean_observation_mapping_expanded_1000plus.csv)
 *   has 957 `fits_existing_or_planned_boolean_answers` rows in the A-G
 *   families, but they are built on a PLANNED flag vocabulary (65 distinct
 *   flags such as `references_parent_claim`, `addresses_parent_reasoning`)
 *   that the deployed classifier does NOT return. Only 2 CSV A-G rows
 *   reference exclusively deployed rawKeys (the `provides_evidence`
 *   single_true + single_false). Those 2 are ADOPTED from the CSV directly
 *   (with their `familyKey` corrected from the CSV's `disagreement_axis` to
 *   the deployed family `evidence_source_chain`, since `provides_evidence` is
 *   a Family D rawKey). The other 955 are DEFERRED (planned vocabulary —
 *   they belong to Build 2/3 once the new booleans are deployed).
 *
 *   To deliver genuine combination-aware labels NOW (the prompt's "adopt the
 *   genuinely-fireable subset and make the registry extensible"), this file
 *   ALSO authors a CURATED set of genuinely-fireable rules DIRECTLY over the
 *   deployed A-G rawKeys, using the deployed definitions' own verdict-free
 *   labels + the artifact's verdict-free diagnostic register as the
 *   label-pattern guide. These curated rules exercise every rule kind
 *   (single / negative / pair / asymmetric / curated_triple / cross_family)
 *   against REAL deployed rawKeys.
 *
 * Doctrine anchors: design §3 invariants 1, 2, 5, 6, 8; cdiscourse-doctrine
 * §1, §9, §10a.
 *
 * Pure TS. No React, no Supabase, no network. JSON-serializable. Frozen.
 */

import type { ObservationMappingRule } from './observationMappingTypes';

const SAFETY_NOTE =
  'Display-only machine observation. Do not block, reject, suppress, route, or delay a post from this rule.';

// ── (1) Adopted directly from the candidate CSV (the 2 genuinely-fireable
//        A-G `fits_existing` rows). familyKey corrected to the deployed
//        family for `provides_evidence` (Family D). ────────────────────────

const ADOPTED_FROM_CSV: ReadonlyArray<ObservationMappingRule> = [
  {
    // CSV MBOM-00031 (familyKey corrected: provides_evidence is a Family D
    // deployed rawKey, not disagreement_axis).
    mappingId: 'MBOM-00031',
    familyKey: 'evidence_source_chain',
    ruleKind: 'single_true',
    requiredTrueFlags: ['provides_evidence'],
    requiredFalseFlags: [],
    observationCode: 'evidence_source_chain.single_true.provides_evidence',
    labelShort: 'Provides evidence observed',
    labelNeutral: 'Reasoned disagreement',
    diagnosticSentence:
      'This reply gives some reasoning and can support productive disagreement.',
    displayPriority: 84,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    // CSV MBOM-00032 (negative — fires when provides_evidence is ABSENT).
    mappingId: 'MBOM-00032',
    familyKey: 'evidence_source_chain',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['provides_evidence'],
    observationCode: 'evidence_source_chain.single_false.provides_evidence',
    labelShort: 'Provides evidence absent',
    labelNeutral: 'Unsupported or lightly supported disagreement',
    diagnosticSentence:
      'This reply states opposition but may need more reasons or evidence.',
    displayPriority: 102,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
];

// ── (2) Curated genuinely-fireable rules over deployed A-G rawKeys. ────────
//        Every flag below is a rawKey returned by familyA..familyG. Labels
//        are verdict-free, move-level. These exercise every rule kind.

const CURATED_RULES: ReadonlyArray<ObservationMappingRule> = [
  // ── single_true (one deployed positive) ──────────────────────────────
  {
    mappingId: 'parent_relation.single_true.challenges_parent',
    familyKey: 'parent_relation',
    ruleKind: 'single_true',
    requiredTrueFlags: ['challenges_parent'],
    requiredFalseFlags: [],
    observationCode: 'parent_relation.single_true.challenges_parent',
    labelShort: 'Challenges the parent',
    labelNeutral: 'Pushes back on the parent move',
    diagnosticSentence:
      'This reply pushes back on the parent move on at least one point.',
    displayPriority: 100,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'parent_relation.single_true.refines_parent',
    familyKey: 'parent_relation',
    ruleKind: 'single_true',
    requiredTrueFlags: ['refines_parent'],
    requiredFalseFlags: [],
    observationCode: 'parent_relation.single_true.refines_parent',
    labelShort: 'Refines the parent',
    labelNeutral: 'Narrows or sharpens the parent move',
    diagnosticSentence:
      'This reply keeps the parent direction and proposes a more precise version.',
    displayPriority: 102,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'resolution_progress.single_true.concedes_narrow_point',
    familyKey: 'resolution_progress',
    ruleKind: 'single_true',
    requiredTrueFlags: ['concedes_narrow_point'],
    requiredFalseFlags: [],
    observationCode: 'resolution_progress.single_true.concedes_narrow_point',
    labelShort: 'Narrow concession',
    labelNeutral: 'Concedes a narrow point',
    diagnosticSentence:
      'This reply concedes a narrow point while leaving the broader point in play.',
    displayPriority: 90,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },

  // ── single_false (deployed positive ABSENT — absence-as-not-observed) ──
  {
    mappingId: 'evidence_source_chain.single_false.has_evidence',
    familyKey: 'evidence_source_chain',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['has_evidence'],
    observationCode: 'evidence_source_chain.single_false.has_evidence',
    labelShort: 'No evidence observed yet',
    labelNeutral: 'No attached evidence observed on this move',
    diagnosticSentence:
      'No attached evidence was observed on this move; a later move can add a source.',
    displayPriority: 110,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },

  // ── pair_true_true (two deployed positives) ──────────────────────────
  {
    mappingId: 'parent_relation.pair_true_true.challenges_parent+quote_anchors_parent',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['challenges_parent', 'quote_anchors_parent'],
    requiredFalseFlags: [],
    observationCode:
      'parent_relation.pair_true_true.challenges_parent.quote_anchors_parent',
    labelShort: 'Anchored challenge',
    labelNeutral: 'Challenge anchored to a quoted part of the parent',
    diagnosticSentence:
      'This reply pushes back and anchors its response to a quoted part of the parent, making the disagreement precise.',
    displayPriority: 78,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'evidence_source_chain.pair_true_true.source_attached+quote_attached',
    familyKey: 'evidence_source_chain',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['source_attached', 'quote_attached'],
    requiredFalseFlags: [],
    observationCode:
      'evidence_source_chain.pair_true_true.source_attached.quote_attached',
    labelShort: 'Source and quote',
    labelNeutral: 'Both a source and a quote are attached',
    diagnosticSentence:
      'This reply attaches both a source and a quote, which makes the evidence chain easier to inspect.',
    displayPriority: 76,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'resolution_progress.pair_true_true.narrows_claim+concedes_narrow_point',
    familyKey: 'resolution_progress',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['narrows_claim', 'concedes_narrow_point'],
    requiredFalseFlags: [],
    observationCode:
      'resolution_progress.pair_true_true.narrows_claim.concedes_narrow_point',
    labelShort: 'Narrowing concession',
    labelNeutral: 'Narrows the claim while conceding a narrow point',
    diagnosticSentence:
      'This reply narrows the claim and concedes a narrow point, a common repair move.',
    displayPriority: 80,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },

  // ── pair_true_false (asymmetric: first present, second absent) ────────
  {
    mappingId: 'parent_relation.pair_true_false.challenges_parent+quote_anchors_parent',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['challenges_parent'],
    requiredFalseFlags: ['quote_anchors_parent'],
    observationCode:
      'parent_relation.pair_true_false.challenges_parent.no_quote_anchor',
    labelShort: 'Unanchored challenge',
    labelNeutral: 'Challenge without a quoted anchor',
    diagnosticSentence:
      'This reply pushes back but does not anchor to a quoted part of the parent; quoting the exact part can sharpen the exchange.',
    displayPriority: 104,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },

  // ── pair_false_true (asymmetric: first absent, second present) ────────
  {
    mappingId: 'evidence_source_chain.pair_false_true.has_evidence+asks_for_evidence',
    familyKey: 'evidence_source_chain',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['asks_for_evidence'],
    requiredFalseFlags: ['has_evidence'],
    observationCode:
      'evidence_source_chain.pair_false_true.asks_for_evidence.no_evidence',
    labelShort: 'Asks for evidence',
    labelNeutral: 'Asks for evidence without attaching its own',
    diagnosticSentence:
      'This reply asks for evidence and does not attach its own; the reply it targets can answer with a source.',
    displayPriority: 96,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },

  // ── curated_triple (three deployed positives — supersedes its singles) ─
  {
    mappingId:
      'parent_relation.curated_triple.challenges_parent+quote_anchors_parent+corrects_parent_detail',
    familyKey: 'parent_relation',
    ruleKind: 'curated_triple',
    requiredTrueFlags: [
      'challenges_parent',
      'quote_anchors_parent',
      'corrects_parent_detail',
    ],
    requiredFalseFlags: [],
    observationCode: 'parent_relation.curated_triple.anchored_detail_challenge',
    labelShort: 'Anchored detail challenge',
    labelNeutral: 'Anchored challenge that corrects a specific detail',
    diagnosticSentence:
      'This reply pushes back, anchors to a quoted part, and corrects a specific detail, engaging a precise point.',
    displayPriority: 70,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },

  // ── cross_family (two A-G families) ──────────────────────────────────
  {
    mappingId:
      'disagreement_axis+evidence_source_chain.cross_family.disputes_evidence_applicability+provides_evidence',
    familyKey: 'disagreement_axis+evidence_source_chain',
    ruleKind: 'cross_family',
    requiredTrueFlags: ['disputes_evidence_applicability', 'provides_evidence'],
    requiredFalseFlags: [],
    observationCode:
      'cross_family.disputes_evidence_applicability.provides_evidence',
    labelShort: 'Evidence challenge with evidence',
    labelNeutral:
      'Challenges how the evidence applies and provides evidence of its own',
    diagnosticSentence:
      'This reply challenges how the evidence applies and provides evidence of its own, which can deepen the exchange.',
    displayPriority: 72,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
];

// ── (3) MCP-BUILD2a — Family B disagreement-quality mapping rows. ──────────
//        Adopted from the candidate CSV's deferred `disagreement_axis` rows
//        whose required flags are EXACTLY the 3 new Build-2a booleans
//        (isolates_main_disagreement, distinguishes_fact_value_disagreement,
//        preserves_face_while_disagreeing). The CSV's truncated/internal
//        label_short + "When X=yes, show: ..." diagnostic prefix are
//        re-authored here into clean verdict-free, move-level strings per the
//        design's review pass (§8.2). Every flag is now a deployed A-G rawKey
//        (the 3 new defs land in familyB.ts this card), so each rule fires.
//        6 single rows (3 true + 3 false) + 9 pair rows (every two-flag
//        combination of the 3) = 15 rows, exercising single_true / single_false
//        / pair_true_true / pair_true_false / pair_false_true.

const FAMILY_B_BUILD2A_RULES: ReadonlyArray<ObservationMappingRule> = [
  // ── singles: isolates_main_disagreement ──
  {
    mappingId: 'MBOM-00047',
    familyKey: 'disagreement_axis',
    ruleKind: 'single_true',
    requiredTrueFlags: ['isolates_main_disagreement'],
    requiredFalseFlags: [],
    observationCode: 'disagreement_axis.single_true.isolates_main_disagreement',
    labelShort: 'Isolates the point',
    labelNeutral: 'Points to the specific disagreement',
    diagnosticSentence:
      'This reply points to the specific part it disagrees with, which keeps the exchange precise.',
    displayPriority: 74,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00048',
    familyKey: 'disagreement_axis',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['isolates_main_disagreement'],
    observationCode: 'disagreement_axis.single_false.isolates_main_disagreement',
    labelShort: 'Point not isolated',
    labelNeutral: 'Specific disagreement point not observed',
    diagnosticSentence:
      'This reply disagrees in general terms; naming the specific point can sharpen the exchange.',
    displayPriority: 102,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: distinguishes_fact_value_disagreement ──
  {
    mappingId: 'MBOM-00049',
    familyKey: 'disagreement_axis',
    ruleKind: 'single_true',
    requiredTrueFlags: ['distinguishes_fact_value_disagreement'],
    requiredFalseFlags: [],
    observationCode:
      'disagreement_axis.single_true.distinguishes_fact_value_disagreement',
    labelShort: 'Separates fact and value',
    labelNeutral: 'Separates a fact question from a value question',
    diagnosticSentence:
      'This reply separates a question of fact from a question of values, which can clarify the disagreement.',
    displayPriority: 88,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00050',
    familyKey: 'disagreement_axis',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['distinguishes_fact_value_disagreement'],
    observationCode:
      'disagreement_axis.single_false.distinguishes_fact_value_disagreement',
    labelShort: 'Fact and value not split',
    labelNeutral: 'Fact-versus-value distinction not observed',
    diagnosticSentence:
      'This reply does not separate fact from values; drawing that line can clarify the disagreement.',
    displayPriority: 103,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: preserves_face_while_disagreeing (verdict-adjacent) ──
  {
    mappingId: 'MBOM-00051',
    familyKey: 'disagreement_axis',
    ruleKind: 'single_true',
    requiredTrueFlags: ['preserves_face_while_disagreeing'],
    requiredFalseFlags: [],
    observationCode:
      'disagreement_axis.single_true.preserves_face_while_disagreeing',
    labelShort: 'Keeps focus on the argument',
    labelNeutral: 'Disagrees while keeping the focus on the argument',
    diagnosticSentence:
      'This reply disagrees while keeping the focus on the argument rather than the person.',
    displayPriority: 90,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00052',
    familyKey: 'disagreement_axis',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['preserves_face_while_disagreeing'],
    observationCode:
      'disagreement_axis.single_false.preserves_face_while_disagreeing',
    labelShort: 'Plain register',
    labelNeutral: 'Face-preserving framing not observed',
    diagnosticSentence:
      'This reply disagrees in a plain register; this is only an observation about phrasing, not a concern.',
    displayPriority: 112,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: isolates × distinguishes ──
  {
    mappingId: 'MBOM-00731',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: [
      'isolates_main_disagreement',
      'distinguishes_fact_value_disagreement',
    ],
    requiredFalseFlags: [],
    observationCode:
      'disagreement_axis.pair_true_true.isolates_main_disagreement.distinguishes_fact_value_disagreement',
    labelShort: 'Precise, fact-vs-value',
    labelNeutral: 'Pins the point and separates fact from value',
    diagnosticSentence:
      'This reply pins the specific point and separates fact from values, which keeps the exchange precise.',
    displayPriority: 70,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00732',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['isolates_main_disagreement'],
    requiredFalseFlags: ['distinguishes_fact_value_disagreement'],
    observationCode:
      'disagreement_axis.pair_true_false.isolates_main_disagreement.no_fact_value_split',
    labelShort: 'Precise, no fact-vs-value',
    labelNeutral: 'Pins the point without separating fact from value',
    diagnosticSentence:
      'This reply pins the specific point but does not separate fact from values; drawing that line can clarify it.',
    displayPriority: 86,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00733',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['distinguishes_fact_value_disagreement'],
    requiredFalseFlags: ['isolates_main_disagreement'],
    observationCode:
      'disagreement_axis.pair_false_true.distinguishes_fact_value_disagreement.no_point_isolated',
    labelShort: 'Fact-vs-value, not pinned',
    labelNeutral: 'Separates fact from value without pinning the point',
    diagnosticSentence:
      'This reply separates fact from values but disagrees in general terms; naming the point can sharpen it.',
    displayPriority: 100,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: isolates × preserves_face ──
  {
    mappingId: 'MBOM-00734',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: [
      'isolates_main_disagreement',
      'preserves_face_while_disagreeing',
    ],
    requiredFalseFlags: [],
    observationCode:
      'disagreement_axis.pair_true_true.isolates_main_disagreement.preserves_face_while_disagreeing',
    labelShort: 'Precise, focus on argument',
    labelNeutral: 'Pins the point and keeps focus on the argument',
    diagnosticSentence:
      'This reply pins the specific point and keeps the focus on the argument rather than the person.',
    displayPriority: 71,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00735',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['isolates_main_disagreement'],
    requiredFalseFlags: ['preserves_face_while_disagreeing'],
    observationCode:
      'disagreement_axis.pair_true_false.isolates_main_disagreement.no_face_preservation',
    labelShort: 'Precise, plain register',
    labelNeutral: 'Pins the point in a plain register',
    diagnosticSentence:
      'This reply pins the specific point in a plain register; this is only an observation about phrasing.',
    displayPriority: 87,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00736',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['preserves_face_while_disagreeing'],
    requiredFalseFlags: ['isolates_main_disagreement'],
    observationCode:
      'disagreement_axis.pair_false_true.preserves_face_while_disagreeing.no_point_isolated',
    labelShort: 'Focus on argument, not pinned',
    labelNeutral: 'Keeps focus on the argument without pinning the point',
    diagnosticSentence:
      'This reply keeps the focus on the argument but disagrees in general terms; naming the point can sharpen it.',
    displayPriority: 101,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: distinguishes × preserves_face ──
  {
    mappingId: 'MBOM-00737',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: [
      'distinguishes_fact_value_disagreement',
      'preserves_face_while_disagreeing',
    ],
    requiredFalseFlags: [],
    observationCode:
      'disagreement_axis.pair_true_true.distinguishes_fact_value_disagreement.preserves_face_while_disagreeing',
    labelShort: 'Fact-vs-value, focus on argument',
    labelNeutral: 'Separates fact from value and keeps focus on the argument',
    diagnosticSentence:
      'This reply separates fact from values and keeps the focus on the argument rather than the person.',
    displayPriority: 89,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00738',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['distinguishes_fact_value_disagreement'],
    requiredFalseFlags: ['preserves_face_while_disagreeing'],
    observationCode:
      'disagreement_axis.pair_true_false.distinguishes_fact_value_disagreement.no_face_preservation',
    labelShort: 'Fact-vs-value, plain register',
    labelNeutral: 'Separates fact from value in a plain register',
    diagnosticSentence:
      'This reply separates fact from values in a plain register; this is only an observation about phrasing.',
    displayPriority: 104,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00739',
    familyKey: 'disagreement_axis',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['preserves_face_while_disagreeing'],
    requiredFalseFlags: ['distinguishes_fact_value_disagreement'],
    observationCode:
      'disagreement_axis.pair_false_true.preserves_face_while_disagreeing.no_fact_value_split',
    labelShort: 'Focus on argument, no fact-vs-value',
    labelNeutral: 'Keeps focus on the argument without separating fact from value',
    diagnosticSentence:
      'This reply keeps the focus on the argument but does not separate fact from values; drawing that line can clarify it.',
    displayPriority: 105,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
];

// ── (4) MCP-BUILD2b — Family A parent-relation mapping rows. ───────────────
//        Adopted from the candidate CSV's deferred `parent_relation` rows
//        whose required flags are EXACTLY the 3 new Build-2b booleans
//        (acknowledges_parent_strength, compares_parent_to_sibling_branch,
//        identifies_parent_scope_limit). The CSV's truncated/internal
//        label_short ("…observed" / "…absent") and "When X=yes, show: …"
//        diagnostic prefix are re-authored here into clean verdict-free,
//        move-level strings per the design's review pass (§8.2 / manifest §1).
//        Every flag is now a deployed A-G rawKey (the 3 new defs land in
//        familyA.ts this card), so each rule fires. The CSV's intra-3 pair
//        rows (MBOM-00458..00466) pair the 3 new flags ONLY with each other;
//        the CSV's other 30 pair rows pair them with PLANNED partner flags
//        (references_parent_claim, quotes_parent_text, …) that are NOT
//        deployed → DEFERRED to Build 3. 6 single rows (3 true + 3 false) +
//        9 pair rows (every two-flag combination of the 3) = 15 rows.
//        acknowledges_parent_strength (A1) is VERDICT-ADJACENT: its rows are
//        fenced to describe the MOVE's structure (grants a point before
//        disagreeing), never asserting the parent point IS strong/correct;
//        "correct" / "true" / "wins" never appear in any A1 label/diagnostic.

const FAMILY_A_BUILD2B_RULES: ReadonlyArray<ObservationMappingRule> = [
  // ── singles: acknowledges_parent_strength (verdict-adjacent) ──
  {
    mappingId: 'MBOM-00019',
    familyKey: 'parent_relation',
    ruleKind: 'single_true',
    requiredTrueFlags: ['acknowledges_parent_strength'],
    requiredFalseFlags: [],
    observationCode: 'parent_relation.single_true.acknowledges_parent_strength',
    labelShort: 'Grants a point first',
    labelNeutral: 'Grants a point before disagreeing',
    diagnosticSentence:
      'This reply grants a point of the parent before disagreeing, which can keep the exchange constructive.',
    displayPriority: 74,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00020',
    familyKey: 'parent_relation',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['acknowledges_parent_strength'],
    observationCode: 'parent_relation.single_false.acknowledges_parent_strength',
    labelShort: 'No point granted first',
    labelNeutral: 'Granting a point before disagreeing not observed',
    diagnosticSentence:
      'This reply disagrees without granting a point first; this is only an observation about phrasing, not a concern.',
    displayPriority: 112,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: compares_parent_to_sibling_branch ──
  {
    mappingId: 'MBOM-00021',
    familyKey: 'parent_relation',
    ruleKind: 'single_true',
    requiredTrueFlags: ['compares_parent_to_sibling_branch'],
    requiredFalseFlags: [],
    observationCode:
      'parent_relation.single_true.compares_parent_to_sibling_branch',
    labelShort: 'Compares to a sibling branch',
    labelNeutral: 'Compares the parent to a sibling branch',
    diagnosticSentence:
      'This reply compares the parent move to a sibling branch in the same thread, which can place the disagreement in context.',
    displayPriority: 80,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00022',
    familyKey: 'parent_relation',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['compares_parent_to_sibling_branch'],
    observationCode:
      'parent_relation.single_false.compares_parent_to_sibling_branch',
    labelShort: 'No sibling comparison',
    labelNeutral: 'Comparison to a sibling branch not observed',
    diagnosticSentence:
      'This reply stays within the parent line without comparing to a sibling branch.',
    displayPriority: 103,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: identifies_parent_scope_limit ──
  {
    mappingId: 'MBOM-00023',
    familyKey: 'parent_relation',
    ruleKind: 'single_true',
    requiredTrueFlags: ['identifies_parent_scope_limit'],
    requiredFalseFlags: [],
    observationCode:
      'parent_relation.single_true.identifies_parent_scope_limit',
    labelShort: 'Names a scope limit',
    labelNeutral: 'Names a scope limit on the parent claim',
    diagnosticSentence:
      'This reply names a specific scope limit on the parent claim, which can sharpen where it applies.',
    displayPriority: 78,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00024',
    familyKey: 'parent_relation',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['identifies_parent_scope_limit'],
    observationCode:
      'parent_relation.single_false.identifies_parent_scope_limit',
    labelShort: 'No scope limit named',
    labelNeutral: 'A specific scope limit not observed',
    diagnosticSentence:
      'This reply does not name a specific scope limit; naming where the claim stops applying can sharpen the exchange.',
    displayPriority: 104,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: acknowledges_parent_strength × compares_parent_to_sibling_branch ──
  {
    mappingId: 'MBOM-00458',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: [
      'acknowledges_parent_strength',
      'compares_parent_to_sibling_branch',
    ],
    requiredFalseFlags: [],
    observationCode:
      'parent_relation.pair_true_true.acknowledges_parent_strength.compares_parent_to_sibling_branch',
    labelShort: 'Grants a point, compares branches',
    labelNeutral: 'Grants a point and compares to a sibling branch',
    diagnosticSentence:
      'This reply grants a point before disagreeing and compares the parent to a sibling branch, which can keep the exchange constructive and in context.',
    displayPriority: 70,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00459',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['acknowledges_parent_strength'],
    requiredFalseFlags: ['compares_parent_to_sibling_branch'],
    observationCode:
      'parent_relation.pair_true_false.acknowledges_parent_strength.no_sibling_comparison',
    labelShort: 'Grants a point, no compare',
    labelNeutral: 'Grants a point without comparing to a sibling branch',
    diagnosticSentence:
      'This reply grants a point before disagreeing but does not compare to a sibling branch.',
    displayPriority: 84,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00460',
    familyKey: 'parent_relation',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['compares_parent_to_sibling_branch'],
    requiredFalseFlags: ['acknowledges_parent_strength'],
    observationCode:
      'parent_relation.pair_false_true.compares_parent_to_sibling_branch.no_point_granted',
    labelShort: 'Compares branches, no point granted',
    labelNeutral: 'Compares to a sibling branch without granting a point first',
    diagnosticSentence:
      'This reply compares the parent to a sibling branch but does not grant a point before disagreeing.',
    displayPriority: 100,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: acknowledges_parent_strength × identifies_parent_scope_limit ──
  {
    mappingId: 'MBOM-00461',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: [
      'acknowledges_parent_strength',
      'identifies_parent_scope_limit',
    ],
    requiredFalseFlags: [],
    observationCode:
      'parent_relation.pair_true_true.acknowledges_parent_strength.identifies_parent_scope_limit',
    labelShort: 'Grants a point, names a limit',
    labelNeutral: 'Grants a point and names a scope limit',
    diagnosticSentence:
      'This reply grants a point before disagreeing and names a specific scope limit, which can sharpen where the claim applies.',
    displayPriority: 71,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00462',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['acknowledges_parent_strength'],
    requiredFalseFlags: ['identifies_parent_scope_limit'],
    observationCode:
      'parent_relation.pair_true_false.acknowledges_parent_strength.no_scope_limit',
    labelShort: 'Grants a point, no limit',
    labelNeutral: 'Grants a point without naming a scope limit',
    diagnosticSentence:
      'This reply grants a point before disagreeing but does not name a specific scope limit.',
    displayPriority: 85,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00463',
    familyKey: 'parent_relation',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['identifies_parent_scope_limit'],
    requiredFalseFlags: ['acknowledges_parent_strength'],
    observationCode:
      'parent_relation.pair_false_true.identifies_parent_scope_limit.no_point_granted',
    labelShort: 'Names a limit, no point granted',
    labelNeutral: 'Names a scope limit without granting a point first',
    diagnosticSentence:
      'This reply names a specific scope limit but does not grant a point before disagreeing.',
    displayPriority: 99,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: compares_parent_to_sibling_branch × identifies_parent_scope_limit ──
  {
    mappingId: 'MBOM-00464',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: [
      'compares_parent_to_sibling_branch',
      'identifies_parent_scope_limit',
    ],
    requiredFalseFlags: [],
    observationCode:
      'parent_relation.pair_true_true.compares_parent_to_sibling_branch.identifies_parent_scope_limit',
    labelShort: 'Compares branches, names a limit',
    labelNeutral: 'Compares to a sibling branch and names a scope limit',
    diagnosticSentence:
      'This reply compares the parent to a sibling branch and names a specific scope limit, which can place the disagreement in context.',
    displayPriority: 76,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00465',
    familyKey: 'parent_relation',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['compares_parent_to_sibling_branch'],
    requiredFalseFlags: ['identifies_parent_scope_limit'],
    observationCode:
      'parent_relation.pair_true_false.compares_parent_to_sibling_branch.no_scope_limit',
    labelShort: 'Compares branches, no limit',
    labelNeutral: 'Compares to a sibling branch without naming a scope limit',
    diagnosticSentence:
      'This reply compares the parent to a sibling branch but does not name a specific scope limit.',
    displayPriority: 90,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00466',
    familyKey: 'parent_relation',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['identifies_parent_scope_limit'],
    requiredFalseFlags: ['compares_parent_to_sibling_branch'],
    observationCode:
      'parent_relation.pair_false_true.identifies_parent_scope_limit.no_sibling_comparison',
    labelShort: 'Names a limit, no compare',
    labelNeutral: 'Names a scope limit without comparing to a sibling branch',
    diagnosticSentence:
      'This reply names a specific scope limit but does not compare to a sibling branch.',
    displayPriority: 101,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
];

// ── (5) MCP-BUILD2c — Family C misunderstanding-repair mapping rows. ───────
//        Adopted from the candidate CSV's deferred `misunderstanding_repair`
//        rows whose required flags are EXACTLY the 3 new Build-2c booleans
//        (offers_repair_path, names_ambiguity_source, accepts_correction).
//        The CSV's truncated/internal label_short ("…observed" / "…absent")
//        and "When X=yes, show: …" diagnostic prefix are re-authored here into
//        clean verdict-free, move-level strings per the design's review pass
//        (§8.2 / manifest §2). Every flag is now a deployed A-G rawKey (the 3
//        new defs land in familyC.ts this card), so each rule fires. The CSV's
//        intra-3 pair rows (MBOM-00929..00937) pair the 3 new flags ONLY with
//        each other; the CSV's other 30+ pair rows pair them with PLANNED
//        partner flags (signals_confusion, asks_for_clarification,
//        restates_other_position, …) that are NOT deployed → DEFERRED to
//        Build 3. 6 single rows (3 true + 3 false) + 9 pair rows (every two-
//        flag combination of the 3) = 15 rows.
//        accepts_correction (C3) is VERDICT-ADJACENT: its rows are fenced
//        "repair-not-defeat" to describe the MOVE's structure (takes up a point
//        a prior move offered), never framing it as defeat / concession of the
//        whole (cdiscourse-doctrine §1: concession is a scoring repair, not a
//        defeat). The standalone verdict token "correct" never appears in any
//        C3 label/diagnostic; the rawKey contains "correct" but the user-facing
//        strings are word-boundary clean.

const FAMILY_C_BUILD2C_RULES: ReadonlyArray<ObservationMappingRule> = [
  // ── singles: offers_repair_path ──
  {
    mappingId: 'MBOM-00071',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'single_true',
    requiredTrueFlags: ['offers_repair_path'],
    requiredFalseFlags: [],
    observationCode: 'misunderstanding_repair.single_true.offers_repair_path',
    labelShort: 'Offers a way to resolve',
    labelNeutral: 'Proposes a concrete way to resolve a misunderstanding',
    diagnosticSentence:
      'This reply proposes a concrete way to resolve a misunderstanding, which can move the exchange forward.',
    displayPriority: 74,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00072',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['offers_repair_path'],
    observationCode: 'misunderstanding_repair.single_false.offers_repair_path',
    labelShort: 'No resolution path offered',
    labelNeutral: 'A concrete resolution path not observed',
    diagnosticSentence:
      'This reply does not propose a concrete resolution path; this is only an observation about phrasing, not a concern.',
    displayPriority: 112,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: names_ambiguity_source ──
  {
    mappingId: 'MBOM-00073',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'single_true',
    requiredTrueFlags: ['names_ambiguity_source'],
    requiredFalseFlags: [],
    observationCode: 'misunderstanding_repair.single_true.names_ambiguity_source',
    labelShort: 'Names the ambiguity',
    labelNeutral: 'Names the specific source of an ambiguity',
    diagnosticSentence:
      'This reply names the specific term or reference that is ambiguous and why, which can sharpen the exchange.',
    displayPriority: 78,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00074',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['names_ambiguity_source'],
    observationCode: 'misunderstanding_repair.single_false.names_ambiguity_source',
    labelShort: 'Ambiguity source not named',
    labelNeutral: 'A named ambiguity source not observed',
    diagnosticSentence:
      'This reply does not name a specific ambiguity source; naming which term is unclear can sharpen the exchange.',
    displayPriority: 103,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: accepts_correction (verdict-adjacent; repair-not-defeat fence) ──
  {
    mappingId: 'MBOM-00075',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'single_true',
    requiredTrueFlags: ['accepts_correction'],
    requiredFalseFlags: [],
    observationCode: 'misunderstanding_repair.single_true.accepts_correction',
    labelShort: 'Takes up an offered point',
    labelNeutral: 'Takes up a point a prior move offered',
    diagnosticSentence:
      'This reply takes up a point a prior move offered, which can keep the exchange constructive; this is a repair, not a concession of the whole.',
    displayPriority: 76,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00076',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['accepts_correction'],
    observationCode: 'misunderstanding_repair.single_false.accepts_correction',
    labelShort: 'No offered point taken up',
    labelNeutral: 'Taking up an offered point not observed',
    diagnosticSentence:
      'This reply does not take up a point a prior move offered; this is only an observation about phrasing, not a concern.',
    displayPriority: 104,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: offers_repair_path × names_ambiguity_source ──
  {
    mappingId: 'MBOM-00929',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['offers_repair_path', 'names_ambiguity_source'],
    requiredFalseFlags: [],
    observationCode:
      'misunderstanding_repair.pair_true_true.offers_repair_path.names_ambiguity_source',
    labelShort: 'Names the ambiguity, offers a way to resolve',
    labelNeutral: 'Names an ambiguity source and proposes a way to resolve it',
    diagnosticSentence:
      'This reply names the specific ambiguity source and proposes a concrete way to resolve it, which can move the exchange forward.',
    displayPriority: 70,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00930',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['offers_repair_path'],
    requiredFalseFlags: ['names_ambiguity_source'],
    observationCode:
      'misunderstanding_repair.pair_true_false.offers_repair_path.no_ambiguity_source',
    labelShort: 'Offers a way to resolve, no ambiguity named',
    labelNeutral: 'Proposes a way to resolve without naming an ambiguity source',
    diagnosticSentence:
      'This reply proposes a concrete way to resolve a misunderstanding but does not name a specific ambiguity source.',
    displayPriority: 84,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00931',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['names_ambiguity_source'],
    requiredFalseFlags: ['offers_repair_path'],
    observationCode:
      'misunderstanding_repair.pair_false_true.names_ambiguity_source.no_repair_path',
    labelShort: 'Names the ambiguity, no path offered',
    labelNeutral: 'Names an ambiguity source without proposing a way to resolve it',
    diagnosticSentence:
      'This reply names the specific ambiguity source but does not propose a concrete way to resolve it.',
    displayPriority: 100,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: offers_repair_path × accepts_correction (C3 verdict-adjacent) ──
  {
    mappingId: 'MBOM-00932',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['offers_repair_path', 'accepts_correction'],
    requiredFalseFlags: [],
    observationCode:
      'misunderstanding_repair.pair_true_true.offers_repair_path.accepts_correction',
    labelShort: 'Takes up a point, offers a way to resolve',
    labelNeutral: 'Takes up an offered point and proposes a way to resolve',
    diagnosticSentence:
      'This reply takes up a point a prior move offered and proposes a concrete way to resolve the misunderstanding, which can keep the exchange constructive.',
    displayPriority: 71,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00933',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['offers_repair_path'],
    requiredFalseFlags: ['accepts_correction'],
    observationCode:
      'misunderstanding_repair.pair_true_false.offers_repair_path.no_point_taken_up',
    labelShort: 'Offers a way to resolve, no point taken up',
    labelNeutral: 'Proposes a way to resolve without taking up an offered point',
    diagnosticSentence:
      'This reply proposes a concrete way to resolve a misunderstanding but does not take up a point a prior move offered.',
    displayPriority: 85,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00934',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['accepts_correction'],
    requiredFalseFlags: ['offers_repair_path'],
    observationCode:
      'misunderstanding_repair.pair_false_true.accepts_correction.no_repair_path',
    labelShort: 'Takes up a point, no path offered',
    labelNeutral: 'Takes up an offered point without proposing a way to resolve',
    diagnosticSentence:
      'This reply takes up a point a prior move offered but does not propose a concrete way to resolve; this is a repair, not a concession of the whole.',
    displayPriority: 99,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: names_ambiguity_source × accepts_correction (C3 verdict-adjacent) ──
  {
    mappingId: 'MBOM-00935',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['names_ambiguity_source', 'accepts_correction'],
    requiredFalseFlags: [],
    observationCode:
      'misunderstanding_repair.pair_true_true.names_ambiguity_source.accepts_correction',
    labelShort: 'Names the ambiguity, takes up a point',
    labelNeutral: 'Names an ambiguity source and takes up an offered point',
    diagnosticSentence:
      'This reply names the specific ambiguity source and takes up a point a prior move offered, which can keep the exchange constructive.',
    displayPriority: 72,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00936',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['names_ambiguity_source'],
    requiredFalseFlags: ['accepts_correction'],
    observationCode:
      'misunderstanding_repair.pair_true_false.names_ambiguity_source.no_point_taken_up',
    labelShort: 'Names the ambiguity, no point taken up',
    labelNeutral: 'Names an ambiguity source without taking up an offered point',
    diagnosticSentence:
      'This reply names the specific ambiguity source but does not take up a point a prior move offered.',
    displayPriority: 90,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00937',
    familyKey: 'misunderstanding_repair',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['accepts_correction'],
    requiredFalseFlags: ['names_ambiguity_source'],
    observationCode:
      'misunderstanding_repair.pair_false_true.accepts_correction.no_ambiguity_source',
    labelShort: 'Takes up a point, no ambiguity named',
    labelNeutral: 'Takes up an offered point without naming an ambiguity source',
    diagnosticSentence:
      'This reply takes up a point a prior move offered but does not name a specific ambiguity source; this is a repair, not a concession of the whole.',
    displayPriority: 101,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
];

// ── (6) MCP-BUILD2e — Family E argument-scheme mapping rows. ──────────────
//        Adopted from the candidate CSV's deferred `argument_scheme` rows
//        whose required flags are EXACTLY the 3 new Build-2e booleans
//        (linked_premise_structure, convergent_premise_structure,
//        enthymeme_gap_detected). The CSV's truncated/internal label_short
//        ("…observed" / "…absent") and "When X=yes, show: …" diagnostic prefix
//        are re-authored here into clean verdict-free, move-level strings per
//        the design's review pass (§8.2 / manifest §4). Every flag is now a
//        deployed A-G rawKey (the 3 new defs land in familyE.ts this card), so
//        each rule fires. The CSV's intra-3 pair rows (MBOM-01325..01333) pair
//        the 3 new flags ONLY with each other; the CSV's other 60+ pair rows
//        pair them with PLANNED partner flags (has_premise_conclusion,
//        cause_effect_language, goal_action_reasoning, …) that are NOT deployed
//        → DEFERRED to Build 3. 6 single rows (3 true + 3 false) + 9 pair rows
//        (every two-flag combination of the 3) = 15 rows.
//        The argumentation-theory terms `linked` / `convergent` / `enthymeme`
//        appear ONLY in the internal rawKeys / observationCodes (routing keys);
//        every user-facing labelShort / labelNeutral / diagnosticSentence is
//        plain-language (GATE-A §8.2 rule 4 — theory labels never surfaced raw).
//        enthymeme_gap_detected (E3) is VERDICT-ADJACENT: its rows are fenced
//        "gap-is-not-a-verdict" — they describe relying on an unstated step
//        (a structural feature of the MOVE's inference, an invitation to state
//        the premise), never framing it as a weakness / defeat
//        (cdiscourse-doctrine §1). The standalone verdict tokens "weak" /
//        "wrong" / "flawed" / "invalid" never appear in any E3 label/diagnostic.

const FAMILY_E_BUILD2E_RULES: ReadonlyArray<ObservationMappingRule> = [
  // ── singles: linked_premise_structure ──
  {
    mappingId: 'MBOM-00119',
    familyKey: 'argument_scheme',
    ruleKind: 'single_true',
    requiredTrueFlags: ['linked_premise_structure'],
    requiredFalseFlags: [],
    observationCode: 'argument_scheme.single_true.linked_premise_structure',
    labelShort: 'Premises that depend on each other',
    labelNeutral: 'Uses premises that depend on each other',
    diagnosticSentence:
      'This reply uses premises that depend on each other, so they stand or fall together.',
    displayPriority: 74,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00120',
    familyKey: 'argument_scheme',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['linked_premise_structure'],
    observationCode: 'argument_scheme.single_false.linked_premise_structure',
    labelShort: 'No interdependent premises',
    labelNeutral: 'Premises that depend on each other not observed',
    diagnosticSentence:
      'This reply does not use premises that depend on each other; this is only an observation about its structure, not a concern.',
    displayPriority: 112,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: convergent_premise_structure ──
  {
    mappingId: 'MBOM-00121',
    familyKey: 'argument_scheme',
    ruleKind: 'single_true',
    requiredTrueFlags: ['convergent_premise_structure'],
    requiredFalseFlags: [],
    observationCode: 'argument_scheme.single_true.convergent_premise_structure',
    labelShort: 'Premises that each stand alone',
    labelNeutral: 'Uses premises that each stand on their own',
    diagnosticSentence:
      'This reply uses premises that each independently support its conclusion.',
    displayPriority: 78,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00122',
    familyKey: 'argument_scheme',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['convergent_premise_structure'],
    observationCode: 'argument_scheme.single_false.convergent_premise_structure',
    labelShort: 'No independently standing premises',
    labelNeutral: 'Premises that each stand on their own not observed',
    diagnosticSentence:
      'This reply does not use premises that each stand on their own; this is only an observation about its structure, not a concern.',
    displayPriority: 103,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── singles: enthymeme_gap_detected (verdict-adjacent; gap-is-not-a-verdict fence) ──
  {
    mappingId: 'MBOM-00123',
    familyKey: 'argument_scheme',
    ruleKind: 'single_true',
    requiredTrueFlags: ['enthymeme_gap_detected'],
    requiredFalseFlags: [],
    observationCode: 'argument_scheme.single_true.enthymeme_gap_detected',
    labelShort: 'Relies on an unstated step',
    labelNeutral: 'Relies on an unstated step',
    diagnosticSentence:
      'This reply relies on an unstated step; naming that step can make the reasoning easier to follow. This is an invitation to state it, not a concern about the reply.',
    displayPriority: 80,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-00124',
    familyKey: 'argument_scheme',
    ruleKind: 'single_false',
    requiredTrueFlags: [],
    requiredFalseFlags: ['enthymeme_gap_detected'],
    observationCode: 'argument_scheme.single_false.enthymeme_gap_detected',
    labelShort: 'No unstated step observed',
    labelNeutral: 'An unstated step not observed',
    diagnosticSentence:
      'This reply does not appear to rely on an unstated step; this is only an observation about its structure, not a concern.',
    displayPriority: 104,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: linked_premise_structure × convergent_premise_structure ──
  {
    mappingId: 'MBOM-01325',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['linked_premise_structure', 'convergent_premise_structure'],
    requiredFalseFlags: [],
    observationCode:
      'argument_scheme.pair_true_true.linked_premise_structure.convergent_premise_structure',
    labelShort: 'Both interdependent and standalone premises',
    labelNeutral: 'Uses both interdependent and independently standing premises',
    diagnosticSentence:
      'This reply uses both premises that depend on each other and premises that each stand on their own.',
    displayPriority: 70,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-01326',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['linked_premise_structure'],
    requiredFalseFlags: ['convergent_premise_structure'],
    observationCode:
      'argument_scheme.pair_true_false.linked_premise_structure.no_convergent',
    labelShort: 'Interdependent premises, not standalone',
    labelNeutral: 'Uses premises that depend on each other, not standalone ones',
    diagnosticSentence:
      'This reply uses premises that depend on each other rather than premises that each stand on their own.',
    displayPriority: 84,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-01327',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['convergent_premise_structure'],
    requiredFalseFlags: ['linked_premise_structure'],
    observationCode:
      'argument_scheme.pair_false_true.convergent_premise_structure.no_linked',
    labelShort: 'Standalone premises, not interdependent',
    labelNeutral: 'Uses premises that each stand on their own, not interdependent ones',
    diagnosticSentence:
      'This reply uses premises that each stand on their own rather than premises that depend on each other.',
    displayPriority: 100,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: linked_premise_structure × enthymeme_gap_detected (E3 verdict-adjacent) ──
  {
    mappingId: 'MBOM-01328',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['linked_premise_structure', 'enthymeme_gap_detected'],
    requiredFalseFlags: [],
    observationCode:
      'argument_scheme.pair_true_true.linked_premise_structure.enthymeme_gap_detected',
    labelShort: 'Interdependent premises, relies on an unstated step',
    labelNeutral: 'Uses interdependent premises and relies on an unstated step',
    diagnosticSentence:
      'This reply uses premises that depend on each other and relies on an unstated step; naming that step can make the reasoning easier to follow.',
    displayPriority: 71,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-01329',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['linked_premise_structure'],
    requiredFalseFlags: ['enthymeme_gap_detected'],
    observationCode:
      'argument_scheme.pair_true_false.linked_premise_structure.no_enthymeme_gap',
    labelShort: 'Interdependent premises, steps stated',
    labelNeutral: 'Uses interdependent premises and states the steps it needs',
    diagnosticSentence:
      'This reply uses premises that depend on each other and states the steps its conclusion needs.',
    displayPriority: 85,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-01330',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['enthymeme_gap_detected'],
    requiredFalseFlags: ['linked_premise_structure'],
    observationCode:
      'argument_scheme.pair_false_true.enthymeme_gap_detected.no_linked',
    labelShort: 'Relies on an unstated step, no interdependent premises',
    labelNeutral: 'Relies on an unstated step without interdependent premises',
    diagnosticSentence:
      'This reply relies on an unstated step without using premises that depend on each other; naming that step can make the reasoning easier to follow.',
    displayPriority: 99,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  // ── pairs: convergent_premise_structure × enthymeme_gap_detected (E3 verdict-adjacent) ──
  {
    mappingId: 'MBOM-01331',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_true_true',
    requiredTrueFlags: ['convergent_premise_structure', 'enthymeme_gap_detected'],
    requiredFalseFlags: [],
    observationCode:
      'argument_scheme.pair_true_true.convergent_premise_structure.enthymeme_gap_detected',
    labelShort: 'Standalone premises, relies on an unstated step',
    labelNeutral: 'Uses standalone premises and relies on an unstated step',
    diagnosticSentence:
      'This reply uses premises that each stand on their own and relies on an unstated step; naming that step can make the reasoning easier to follow.',
    displayPriority: 72,
    confidencePip: 'high',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-01332',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_true_false',
    requiredTrueFlags: ['convergent_premise_structure'],
    requiredFalseFlags: ['enthymeme_gap_detected'],
    observationCode:
      'argument_scheme.pair_true_false.convergent_premise_structure.no_enthymeme_gap',
    labelShort: 'Standalone premises, steps stated',
    labelNeutral: 'Uses standalone premises and states the steps it needs',
    diagnosticSentence:
      'This reply uses premises that each stand on their own and states the steps its conclusion needs.',
    displayPriority: 90,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
  {
    mappingId: 'MBOM-01333',
    familyKey: 'argument_scheme',
    ruleKind: 'pair_false_true',
    requiredTrueFlags: ['enthymeme_gap_detected'],
    requiredFalseFlags: ['convergent_premise_structure'],
    observationCode:
      'argument_scheme.pair_false_true.enthymeme_gap_detected.no_convergent',
    labelShort: 'Relies on an unstated step, no standalone premises',
    labelNeutral: 'Relies on an unstated step without standalone premises',
    diagnosticSentence:
      'This reply relies on an unstated step without using premises that each stand on their own; naming that step can make the reasoning easier to follow.',
    displayPriority: 101,
    confidencePip: 'low',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY_NOTE,
  },
];

/**
 * The reviewed, reconciled, frozen mapping registry the evaluator reads.
 * A-G only. Every flag is a deployed rawKey; every label is verdict-free.
 */
export const OBSERVATION_MAPPING_REGISTRY: ReadonlyArray<ObservationMappingRule> =
  Object.freeze(
    [
      ...ADOPTED_FROM_CSV,
      ...CURATED_RULES,
      ...FAMILY_B_BUILD2A_RULES,
      ...FAMILY_A_BUILD2B_RULES,
      ...FAMILY_C_BUILD2C_RULES,
      ...FAMILY_E_BUILD2E_RULES,
    ].map((r) =>
      Object.freeze({
        ...r,
        requiredTrueFlags: Object.freeze([...r.requiredTrueFlags]),
        requiredFalseFlags: Object.freeze([...r.requiredFalseFlags]),
      }),
    ),
  );

/**
 * Adoption / deferral manifest — the explicit reconciliation record the
 * prompt requires ("a manifest of adopted-vs-omitted"). All counts are
 * verifiable against the candidate CSV via
 * scripts/mcp-observation-mapping/analyzeReconciliation.js.
 */
export const OBSERVATION_MAPPING_ADOPTION_MANIFEST = Object.freeze({
  /** CSV `fits_existing_or_planned_boolean_answers` rows in A-G families. */
  csvFitsExistingAgRows: 957,
  /** Of those, rows referencing ONLY deployed A-G rawKeys (genuinely
   *  fireable as-is). Adopted directly from the CSV. */
  csvAgRowsFullyDeployedFlags: 2,
  /** CSV A-G rows deferred because they reference planned-but-not-deployed
   *  flags (belong to Build 2/3 once the new booleans deploy). */
  csvAgRowsDeferredPlannedVocab: 955,
  /** Distinct planned-but-not-deployed flags the deferred rows reference. */
  plannedNotDeployedDistinctFlags: 65,
  /** Rules adopted directly from the CSV (the 2 above). */
  adoptedFromCsv: ADOPTED_FROM_CSV.length,
  /** Curated genuinely-fireable rules authored over deployed rawKeys. */
  curatedFireableRules: CURATED_RULES.length,
  /**
   * MCP-BUILD2a — mapping rows adopted from the candidate CSV's deferred
   * `disagreement_axis` rows whose required flags are EXACTLY the 3 new
   * Build-2a booleans (now deployed in familyB.ts). These were part of the
   * 955 deferred-planned-vocab rows; deploying the 3 booleans converts them
   * from deferred to genuinely-fireable. 6 singles + 9 pairs = 15.
   */
  build2aFamilyBAdoptedRules: FAMILY_B_BUILD2A_RULES.length,
  /**
   * MCP-BUILD2b — mapping rows adopted from the candidate CSV's deferred
   * `parent_relation` rows whose required flags are EXACTLY the 3 new
   * Build-2b booleans (now deployed in familyA.ts): acknowledges_parent_strength,
   * compares_parent_to_sibling_branch, identifies_parent_scope_limit. These
   * were part of the 955 deferred-planned-vocab rows; deploying the 3 booleans
   * converts them from deferred to genuinely-fireable. 6 singles + 9 pairs = 15.
   * The CSV's other ~30 `parent_relation` pair rows that ALSO need a planned
   * partner flag (references_parent_claim, quotes_parent_text, …) remain
   * DEFERRED to Build 3.
   */
  build2bFamilyAAdoptedRules: FAMILY_A_BUILD2B_RULES.length,
  /**
   * MCP-BUILD2c — mapping rows adopted from the candidate CSV's deferred
   * `misunderstanding_repair` rows whose required flags are EXACTLY the 3 new
   * Build-2c booleans (now deployed in familyC.ts): offers_repair_path,
   * names_ambiguity_source, accepts_correction. These were part of the 955
   * deferred-planned-vocab rows; deploying the 3 booleans converts them from
   * deferred to genuinely-fireable. 6 singles + 9 pairs = 15. The CSV's other
   * 30+ `misunderstanding_repair` pair rows that ALSO need a planned partner
   * flag (signals_confusion, asks_for_clarification, restates_other_position,
   * …) remain DEFERRED to Build 3.
   */
  build2cFamilyCAdoptedRules: FAMILY_C_BUILD2C_RULES.length,
  /**
   * MCP-BUILD2e — mapping rows adopted from the candidate CSV's deferred
   * `argument_scheme` rows whose required flags are EXACTLY the 3 new Build-2e
   * booleans (now deployed in familyE.ts): linked_premise_structure,
   * convergent_premise_structure, enthymeme_gap_detected. These were part of
   * the 955 deferred-planned-vocab rows; deploying the 3 booleans converts them
   * from deferred to genuinely-fireable. 6 singles + 9 pairs = 15. The CSV's
   * other 60+ `argument_scheme` pair/triple rows that ALSO need a planned
   * partner flag (has_premise_conclusion, cause_effect_language,
   * goal_action_reasoning, …) remain DEFERRED to Build 3.
   */
  build2eFamilyEAdoptedRules: FAMILY_E_BUILD2E_RULES.length,
  /** Total rules in the active registry. */
  totalActiveRules:
    ADOPTED_FROM_CSV.length +
    CURATED_RULES.length +
    FAMILY_B_BUILD2A_RULES.length +
    FAMILY_A_BUILD2B_RULES.length +
    FAMILY_C_BUILD2C_RULES.length +
    FAMILY_E_BUILD2E_RULES.length,
  /** Families H/I/J adopted. ALWAYS 0 (frozen / out of scope). */
  frozenFamiliesAdopted: 0,
} as const);
