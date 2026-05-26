/**
 * MCP-021A — Test category 3: No duplicate semantic aliases.
 *
 * Per design §8.3. Verifies Decision 5 collapses are honored — brief
 * narrative names are NOT added as aliases. One-key-one-concept.
 */

import {
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
  _INTERNAL_ALL_DEFINITIONS,
} from '../src/features/nodeLabels/machineObservationDefinitions';

describe('MCP-021A — Decision 5 collapses (no semantic aliases added)', () => {
  it('disputes_evidence_applicability is the SOLE entry for that concept', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['disputes_evidence_applicability']).toBeDefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['disagreement_evidence_applicability']).toBeUndefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['evidence_applicability_questioned']).toBeUndefined();
  });

  it('requests_clarification is the SOLE entry for that concept', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['requests_clarification']).toBeDefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['requests_clarification_present']).toBeUndefined();
  });

  it('concedes_narrow_point is the SOLE entry for that concept', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['concedes_narrow_point']).toBeDefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['narrow_concession_present']).toBeUndefined();
  });

  it('creates_source_chain_gap is the SOLE entry for that concept', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['creates_source_chain_gap']).toBeDefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['source_chain_gap']).toBeUndefined();
  });

  it('branch_recommended is the SOLE entry (lifecycle version)', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['branch_recommended']).toBeDefined();
    // No alias key like `branch_recommendation_present` or `branch_proposed`.
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['branch_recommendation_present']).toBeUndefined();
  });

  it('introduces_new_issue is the SOLE entry (changes_subject is collapsed)', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['introduces_new_issue']).toBeDefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['changes_subject']).toBeUndefined();
  });

  it('source_requested + quote_requested allowed in BOTH auto_metadata and lifecycle (compound keys)', () => {
    // Both keys exist per existing UX-001.5A compound-key pattern.
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['source_requested']).toBeDefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['quote_requested']).toBeDefined();
    // The byRawKey map collapses to highest-priority entry; both compound
    // keys exist in the underlying definitions.
    const sourceRequestedEntries = _INTERNAL_ALL_DEFINITIONS.filter(
      (d) => d.rawKey === 'source_requested',
    );
    expect(sourceRequestedEntries.length).toBe(2); // auto_metadata + lifecycle
    const quoteRequestedEntries = _INTERNAL_ALL_DEFINITIONS.filter(
      (d) => d.rawKey === 'quote_requested',
    );
    expect(quoteRequestedEntries.length).toBe(2); // auto_metadata + lifecycle
  });

  it('ready_for_synthesis allowed in BOTH lifecycle and ai_classifier (compound keys)', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['ready_for_synthesis']).toBeDefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['synthesis_ready']).toBeDefined();
    // synthesis_ready (lifecycle) + ready_for_synthesis (ai_classifier) coexist.
  });

  it('repeats_prior_point was DROPPED (Trigger 10 doctrine-risk)', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['repeats_prior_point']).toBeUndefined();
  });

  it('Family J extras were DROPPED (Trigger 10)', () => {
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['hostile_generalization_present']).toBeUndefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['identity_group_reference_present']).toBeUndefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['sarcasm_or_mockery_present']).toBeUndefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['excessive_heat_present']).toBeUndefined();
    expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY['moderation_boundary_near']).toBeUndefined();
  });

  it('no two distinct rawKeys describe identical concepts (spot-check)', () => {
    // Spot-check pattern: certain semantic-alias risks like
    // "source_request" vs "source_requested" should never coexist.
    const rawKeys = Object.keys(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY);
    expect(rawKeys.includes('source_request') && rawKeys.includes('source_requested')).toBe(false);
    expect(rawKeys.includes('quote_request') && rawKeys.includes('quote_requested')).toBe(false);
  });
});
