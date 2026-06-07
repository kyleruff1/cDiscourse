'use strict';

/*
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — reconciliation analysis.
 *
 * One-off, optional analysis script. Parses the candidate CSV
 * (docs/designs/mcp-observation-mapping/...) and reports how many
 * `fits_existing_or_planned_boolean_answers` rows in the A-G production
 * families reference ONLY rawKeys that are GENUINELY returned by the
 * deployed classifier (the familyA-G definitions).
 *
 * Provenance / audit aid only. NOT read at runtime. Run with:
 *   node scripts/mcp-observation-mapping/analyzeReconciliation.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CSV_PATH = path.join(
  REPO_ROOT,
  'docs',
  'designs',
  'mcp-observation-mapping',
  'mcp_boolean_observation_mapping_expanded_1000plus.csv',
);

/** Minimal RFC-4180-ish CSV parser handling quoted fields + embedded commas. */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* The deployed A-G rawKeys, transcribed from
 * src/features/nodeLabels/machineObservationDefinitions/familyA.ts..familyG.ts.
 * (Kept literal here so this provenance script has no src/ import.) */
const DEPLOYED_AG_RAW_KEYS = new Set([
  // A parent_relation
  'has_rebuttal', 'has_counter_rebuttal', 'rebutted', 'quote_anchors_parent',
  'supports_parent', 'challenges_parent', 'refines_parent', 'extends_parent',
  'distinguishes_parent', 'reframes_parent', 'questions_parent',
  'summarizes_parent', 'acknowledges_parent', 'corrects_parent_detail',
  'contrasts_with_parent', 'answers_parent_question',
  // B disagreement_axis
  'disputes_evidence_applicability', 'disagreement_present', 'disputes_definition',
  'disputes_scope', 'disputes_fact', 'disputes_causal_link',
  'disputes_value_weighting', 'disputes_decision_criterion',
  'disputes_generalization', 'disputes_analogy', 'disputes_interpretation',
  'disputes_priority_order', 'disputes_remedy_or_solution', 'disputes_relevance',
  // C misunderstanding_repair
  'clarified', 'requests_clarification', 'answers_clarification',
  'provides_alternate_interpretation', 'offers_candidate_understanding',
  'confirms_understanding', 'rejects_candidate_understanding',
  'requests_restatement', 'self_initiates_self_repair', 'other_initiates_repair',
  'acknowledges_misread', 'flags_ambiguous_reference', 'flags_term_ambiguity',
  'proposes_shared_definition', 'confirms_shared_definition',
  'scope_mismatch_identified', 'question_answer_mismatch',
  // D evidence_source_chain
  'has_evidence', 'source_requested', 'quote_requested', 'source_attached',
  'quote_attached', 'sourced', 'asks_for_evidence', 'provides_evidence',
  'evidence_supports_claim', 'creates_source_chain_gap',
  'opens_evidence_debt_marker', 'closes_evidence_debt_marker',
  'supplies_corroborating_document', 'source_provided', 'quote_provided',
  'concrete_example_requested', 'concrete_example_provided',
  'evidence_claim_present', 'evidence_gap_present', 'source_chain_repair',
  'anecdote_used', 'statistic_used', 'external_authority_used',
  'evidence_quality_questioned', 'burden_request_present',
  // E argument_scheme
  'causal_reasoning_present', 'analogy_reasoning_present',
  'example_reasoning_present', 'authority_reasoning_present',
  'consequence_reasoning_present', 'principle_reasoning_present',
  'definition_reasoning_present', 'classification_reasoning_present',
  'precedent_reasoning_present', 'means_end_reasoning_present',
  'tradeoff_reasoning_present', 'abductive_explanation_present',
  'exception_reasoning_present', 'slippery_slope_reasoning_present',
  'cost_benefit_reasoning_present', 'risk_reasoning_present',
  // F critical_question
  'missing_warrant', 'unstated_assumption', 'authority_basis_missing',
  'causal_mechanism_missing', 'analogy_mapping_missing',
  'example_representativeness_unclear', 'consequence_probability_unclear',
  'definition_boundary_unclear', 'criterion_weighting_unclear',
  'alternative_explanation_available', 'counterexample_available',
  'scope_limit_unstated', 'qualification_missing', 'comparison_baseline_missing',
  // G resolution_progress
  'branch_suggested', 'branch_created', 'point_stalled', 'point_exhausted',
  'synthesis_candidate', 'narrowed', 'conceded', 'confirmed', 'synthesis_ready',
  'exhausted', 'branch_recommended', 'archived_or_resolved', 'narrows_claim',
  'concedes_narrow_point', 'ready_for_synthesis', 'suggests_side_branch',
  'suggests_diagonal_tangent', 'accepts_partial_with_caveat',
  'concedes_with_new_dispute', 'proposes_settlement_terms',
  'accepts_settlement_terms', 'concedes_broader_point',
  'common_ground_identified', 'unresolved_point_isolated', 'synthesis_proposed',
  'move_on_requested', 'issue_closed_by_participant', 'decision_criterion_proposed',
  'action_item_proposed', 'followup_question_proposed',
]);

const AG_FAMILIES = new Set([
  'parent_relation', 'disagreement_axis', 'misunderstanding_repair',
  'evidence_source_chain', 'argument_scheme', 'critical_question',
  'resolution_progress',
]);

function flagsOf(value) {
  return String(value || '').split('|').map((s) => s.trim()).filter(Boolean);
}

function main() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const data = rows.slice(1).filter((r) => r.length === header.length);

  let fitsTotal = 0;
  let fitsAG = 0;
  let fullyDeployed = 0;
  const fullyDeployedKinds = {};
  const unmatchedFlags = new Set();

  for (const r of data) {
    if (r[idx.schema_action] !== 'fits_existing_or_planned_boolean_answers') continue;
    fitsTotal += 1;
    if (!AG_FAMILIES.has(r[idx.family_key])) continue;
    fitsAG += 1;
    const allFlags = [
      ...flagsOf(r[idx.required_true_flags]),
      ...flagsOf(r[idx.required_false_flags]),
    ];
    const allDeployed = allFlags.length > 0 && allFlags.every((f) => DEPLOYED_AG_RAW_KEYS.has(f));
    if (allDeployed) {
      fullyDeployed += 1;
      const k = r[idx.rule_kind];
      fullyDeployedKinds[k] = (fullyDeployedKinds[k] || 0) + 1;
    } else {
      for (const f of allFlags) if (!DEPLOYED_AG_RAW_KEYS.has(f)) unmatchedFlags.add(f);
    }
  }

  console.log('fits_existing rows (all families):', fitsTotal);
  console.log('fits_existing rows in A-G families:', fitsAG);
  console.log('  ...of which every flag is a DEPLOYED A-G rawKey:', fullyDeployed);
  console.log('  fully-deployed by rule_kind:', JSON.stringify(fullyDeployedKinds));
  console.log('distinct planned-but-not-deployed flags referenced:', unmatchedFlags.size);
}

main();
