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

/**
 * The reviewed, reconciled, frozen mapping registry the evaluator reads.
 * A-G only. Every flag is a deployed rawKey; every label is verdict-free.
 */
export const OBSERVATION_MAPPING_REGISTRY: ReadonlyArray<ObservationMappingRule> =
  Object.freeze([...ADOPTED_FROM_CSV, ...CURATED_RULES].map((r) => Object.freeze({
    ...r,
    requiredTrueFlags: Object.freeze([...r.requiredTrueFlags]),
    requiredFalseFlags: Object.freeze([...r.requiredFalseFlags]),
  })));

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
  /** Total rules in the active registry. */
  totalActiveRules: ADOPTED_FROM_CSV.length + CURATED_RULES.length,
  /** Families H/I/J adopted. ALWAYS 0 (frozen / out of scope). */
  frozenFamiliesAdopted: 0,
} as const);
