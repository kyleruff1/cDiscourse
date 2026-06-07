/**
 * MCP-021C-EDGE-FAMILY-E-ENABLE — Family E production-mode flip binding.
 *
 * This file is the dedicated card-scoped binding that locks in the
 * POST-flip state of `familyRegistry.ts`. It mirrors the FDE-* pattern
 * from `edgeFamilyDProductionEnable.test.ts` but for Family E
 * (`argument_scheme`): every assertion here asserts that Family E is
 * now production-enabled and that A/B/C/D remain production-enabled
 * while F-J remain admin-only.
 *
 * If a future card accidentally reverts the Family E production flag,
 * this file fails the build with a Family-E-specific error message.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1, §10a — Machine Observations are
 *     structural; production enablement is gameplay-routing, never a
 *     verdict on the family's quality.
 *   - cdiscourse-doctrine §7 — Pure TS; no Deno-specific runtime call.
 *
 * HALT trigger #7 (subset filter `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`
 * entry added for E) is guarded by FEE-14 + FEE-15 below.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeFilterFamiliesForMode,
  edgeBuildBooleanObservationRequestForArgument,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — Family E production-mode flip binding', () => {
  it('FEE-1 — Family E entry has productionEnabled: true (post Card 2 flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-2 — Family E entry has adminValidationEnabled: true (unchanged across the flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('argument_scheme');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FEE-3 — edgeProductionEnabledFamilies() includes argument_scheme', () => {
    expect(edgeProductionEnabledFamilies()).toContain('argument_scheme');
  });

  it('FEE-4 — edgeProductionEnabledFamilies() has length 7 (post MCP-021C-EDGE-FAMILY-G-ENABLE flip; E entry remains)', () => {
    expect(edgeProductionEnabledFamilies()).toHaveLength(7);
  });

  it('FEE-5 — edgeProductionEnabledFamilies() preserves registry A→G order (E remains at index 4)', () => {
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
    ]);
  });

  it('FEE-6 — edgeFilterFamiliesForMode([argument_scheme], production) keeps argument_scheme', () => {
    expect(edgeFilterFamiliesForMode(['argument_scheme'], 'production')).toEqual([
      'argument_scheme',
    ]);
  });
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — H–J remain admin-only (no widening past G)', () => {
  // Post Card 3 of FAMILY-G chain (MCP-021C-EDGE-FAMILY-G-ENABLE), G
  // (resolution_progress) is production-enabled; H–J remain admin-only.
  // This describe block's defensive guard updates from "G–J admin-only"
  // to "H–J admin-only" while preserving the catch-accidental-widening
  // property.
  const HJ_ADMIN_ONLY = [
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ] as const;

  for (const family of HJ_ADMIN_ONLY) {
    it(`FEE-7:${family} — productionEnabled is false (awaits its own card)`, () => {
      const entry = edgeLookupFamilyRegistryEntry(family);
      expect(entry).not.toBeNull();
      expect(entry!.productionEnabled).toBe(false);
    });
  }
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — Family E is the 5th entry; registry order preserved', () => {
  it('FEE-8 — Family E occupies index 4 in EDGE_FAMILY_REGISTRY (A→J order preserved)', () => {
    expect(EDGE_FAMILY_REGISTRY[4].family).toBe('argument_scheme');
    expect(EDGE_FAMILY_REGISTRY[4].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[4].adminValidationEnabled).toBe(true);
  });

  it('FEE-9 — Family A is still first (preserves Family A iteration #1 behavior)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — A/B/C/D production posture unchanged', () => {
  // HALT trigger #2: A/B/C/D productionEnabled flipped (already true; do not touch).
  // These assertions catch any accidental drift on A/B/C/D state during
  // the Family E flip.
  it('FEE-10 — Family A (parent_relation) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('parent_relation');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-11 — Family B (disagreement_axis) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('disagreement_axis');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-12 — Family C (misunderstanding_repair) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('misunderstanding_repair');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FEE-13 — Family D (evidence_source_chain) remains productionEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('evidence_source_chain');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILY-E-ENABLE — subset filter NOT applied to Family E (defensive guard for HALT trigger #7)', () => {
  it('FEE-14 — MCP_SERVER_SUPPORTED_FAMILY_SOURCES has NO entry for argument_scheme', () => {
    // Family E is uniform ai_classifier (all 19 keys post MCP-BUILD2e); a
    // subset filter entry would be a no-op at best and a doctrinal confusion
    // at worst.
    // The intent brief HALT trigger #7 binds this: "Subset filter
    // (MCP_SERVER_SUPPORTED_FAMILY_SOURCES) entry added for E (E is
    // uniform ai_classifier; should NOT need an entry)".
    const fs = require('fs');
    const path = require('path');
    const builderPath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
    );
    const builderText = fs.readFileSync(builderPath, 'utf8');
    // The constant block must not contain a key 'argument_scheme' (Family E
    // is uniform ai_classifier → no subset entry). The map now holds
    // 'evidence_source_chain' (Family D) + 'resolution_progress' (Family G,
    // added in MCP-SERVER-008A); the regex anchors to the `const` declaration
    // and matches the full Object.freeze block regardless of its size (the
    // prior 500-char cap broke once the Family G entry grew the block).
    const constantBlock = builderText.match(
      /const MCP_SERVER_SUPPORTED_FAMILY_SOURCES[\s\S]*?\n\}\);/,
    );
    expect(constantBlock).not.toBeNull();
    expect(constantBlock![0]).not.toContain('argument_scheme');
  });

  it('FEE-15 — production-mode Family E request contains all 19 ai_classifier rawKeys (no subset filter)', () => {
    // Defensive: confirms the production-mode builder returns the full
    // 19-key Family E set post MCP-BUILD2e (16 + 3 structure booleans),
    // identical to admin_validation-mode. The subset filter is absent for E →
    // full passthrough.
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-e-prod-1',
      parentArgumentId: 'arg-e-prod-0',
      currentText: 'a reply with possible scheme content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['argument_scheme'],
      mode: 'production',
    });
    expect(req.requestedRawKeys.length).toBe(19);
    // Byte-equal vs admin_validation-mode (mode-agnostic since no subset
    // filter):
    const reqAdmin = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-e-prod-1',
      parentArgumentId: 'arg-e-prod-0',
      currentText: 'a reply with possible scheme content',
      parentText: 'a parent claim',
      threadContextExcerpt: '',
      requestedFamilies: ['argument_scheme'],
      mode: 'admin_validation',
    });
    expect([...req.requestedRawKeys].sort()).toEqual([...reqAdmin.requestedRawKeys].sort());
  });
});
