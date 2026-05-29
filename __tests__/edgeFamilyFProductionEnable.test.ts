/**
 * MCP-021C-EDGE-FAMILY-F-ENABLE — Family F production-mode flip binding.
 *
 * This file is the dedicated card-scoped binding that locks in the
 * POST-flip state of `familyRegistry.ts`. It mirrors the FEE-* pattern
 * from `edgeFamilyEProductionEnable.test.ts` but for Family F
 * (`critical_question`): every assertion here asserts that Family F is
 * now production-enabled and that A/B/C/D/E remain production-enabled
 * while G-J remain admin-only.
 *
 * If a future card accidentally reverts the Family F production flag,
 * this file fails the build with a Family-F-specific error message.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1, §10a — Machine Observations are
 *     structural; production enablement is gameplay-routing, never a
 *     verdict on the family's quality.
 *   - cdiscourse-doctrine §7 — Pure TS; no Deno-specific runtime call.
 *
 * HALT trigger #7 (subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`
 * entry added for F) is guarded by FFE-15 + FFE-16 below.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — Family F production-mode flip binding', () => {
  it('FFE-1 — Family F entry has productionEnabled: true (post Card 3 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('critical_question');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-2 — Family F entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('critical_question');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FFE-3 — edgeProductionEnabledFamilies() includes critical_question', () => {
    expect(edgeProductionEnabledFamilies()).toContain('critical_question');
  });

  it('FFE-4 — edgeProductionEnabledFamilies() has length 6 (post Card 3 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(6);
  });

  it('FFE-5 — edgeProductionEnabledFamilies() preserves registry A→F order', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
    ]);
  });

  it('FFE-6 — edgeFilterFamiliesForMode([critical_question], production) keeps critical_question', () => {
    expect(edgeFilterFamiliesForMode(['critical_question'], 'production')).toEqual([
      'critical_question',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — G–J remain admin-only (no widening past F)', () => {
  const GJ_ADMIN_ONLY = [
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of GJ_ADMIN_ONLY) {
    it(`FFE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — Family F is the 6th entry; registry order preserved', () => {
  it('FFE-8 — Family F occupies index 5 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[5].family).toBe('critical_question');
    expect(EDGE_FAMILY_REGISTRY[5].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[5].adminValidationEnabled).toBe(true);
  });

  it('FFE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — A/B/C/D/E production posture unchanged', () => {
  // HALT trigger #2: A/B/C/D/E productionEnabled flipped (already true; do not touch).
  // These assertions catch any accidental drift on A/B/C/D/E state during
  // the Family F flip.
  it('FFE-10 — Family A (parent_relation) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-11 — Family B (disagreement_axis) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-12 — Family C (misunderstanding_repair) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-13 — Family D (evidence_source_chain) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FFE-14 — Family E (argument_scheme) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-F-ENABLE — subset filter NOT applied to Family F (defensive guard for HALT trigger #7)', () => {
  it('FFE-15 — MCP_SERVER_SUPPORTED_FAMILY_SOURCES has NO entry for critical_question', () => {
    // Family F is uniform ai_classifier (all 14 keys); a subset filter
    // entry would be a no-op at best and a doctrinal confusion at worst.
    // The intent brief HALT trigger #7 binds this: "Subset filter
    // present/absent for F mismatches Card 1's T1 outcome (T1 NOT FIRED
    // in Card 1 → NO entry for F should exist)".
    const fs = require('fs');
    const path = require('path');
    const builderPath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
    );
    const builderText = fs.readFileSync(builderPath, 'utf8');
    // The constant block must not contain a key 'critical_question' (Family F
    // is uniform ai_classifier → no subset entry). The map now holds
    // 'evidence_source_chain' (Family D) + 'resolution_progress' (Family G,
    // added in MCP-SERVER-008A); the regex anchors to the `const` declaration
    // and matches the full Object.freeze block regardless of its size (the
    // prior 500-char cap broke once the Family G entry grew the block).
    const constantBlock = builderText.match(
      /const MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]*?\n\}\);/,
    );
    expect(constantBlock).not.toBeNull();
    expect(constantBlock![0]).not.toContain('critical_question');
  });

  it('FFE-16 — production-mode Family F request contains all 14 ai_classifier rawKeys (no subset filter)', () => {
    // Defensive: confirms the production-mode builder returns the full
    // 14-key Family F set, identical to admin_validation-mode. The
    // subset filter is absent for F → full passthrough.
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-f-prod-1',
      parentArgumentId: 'arg-f-prod-0',
      currentText: 'a reply with possible critical-question content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['critical_question'],
      mode: 'production',
    });
    expect(req.requestedRawKeys.length).toBe(14);
    // Byte-equal vs admin_validation-mode (mode-agnostic since no subset
    // filter):
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-f-prod-1',
      parentArgumentId: 'arg-f-prod-0',
      currentText: 'a reply with possible critical-question content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['critical_question'],
      mode: 'admin_validation',
    });
    expect([...req.requestedRawKeys].sort()).toEqual([...reqAdmin.requestedRawKeys].sort());
  });
});
