/**
 * MCP-SERVER-009-FAMILY-H — Test: Edge family registry Family H entry parity
 * (production + admin_validation; post MCP-021C-EDGE-FAMILY-H-ENABLE Card 3 flip).
 *
 * The Edge `familyRegistry.ts` entry for `claim_clarity` is at
 * `supabase/functions/_shared/booleanObservations/familyRegistry.ts:104-108`
 * with `productionEnabled: true, adminValidationEnabled: true` after the
 * MCP-021C-EDGE-FAMILY-H-ENABLE card (Card 3 of the FAMILY-H chain) flip.
 *
 * The 8 assertions below lock in the CURRENT (post-flip) shape:
 *   FH-1 entry exists, FH-2 productionEnabled=true (post Card 3 flip),
 *   FH-3 adminValidationEnabled=true, FH-4 production list DOES include H
 *   (post Card 3 flip), FH-5 admin_validation list does include H, FH-6/7
 *   mode filter behavior, FH-8 Family H is the 8th entry in
 *   EDGE_FAMILY_REGISTRY (A→J order; index 7).
 *
 * If a future card accidentally reverts the Family H production flag,
 * this file fails the build with a Family-H-specific error message.
 * (The pre-Card-3 docblock note that "FH-2/FH-4/FH-6 will need to flip
 * when Card 3 lands" was authored at Card 1 to forecast Card 3; that
 * forecast is now realized.)
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeLookupFamilyRegistryEntry,
  edgeProductionEnabledFamilies,
  edgeAdminValidationEnabledFamilies,
  edgeFilterFamiliesForMode,
} from './_helpers/booleanObservationEdgeDeno';

describe('MCP-SERVER-009-FAMILY-H — Edge familyRegistry Family H entry (production + admin_validation; post Card 3 flip)', () => {
  it('FH-1 — Family H entry exists in EDGE_FAMILY_REGISTRY', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.family).toBe('claim_clarity');
  });

  it('FH-2 — Family H entry has productionEnabled: true (post MCP-021C-EDGE-FAMILY-H-ENABLE flip)', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.productionEnabled).toBe(true);
  });

  it('FH-3 — Family H entry has adminValidationEnabled: true', () => {
    const entry = edgeLookupFamilyRegistryEntry('claim_clarity');
    expect(entry).not.toBeNull();
    expect(entry!.adminValidationEnabled).toBe(true);
  });

  it('FH-4 — edgeProductionEnabledFamilies() includes claim_clarity (post Card 3 flip)', () => {
    expect(edgeProductionEnabledFamilies()).toContain('claim_clarity');
  });

  it('FH-5 — edgeAdminValidationEnabledFamilies() includes claim_clarity', () => {
    expect(edgeAdminValidationEnabledFamilies()).toContain('claim_clarity');
  });

  it('FH-6 — edgeFilterFamiliesForMode([claim_clarity], production) returns [claim_clarity] (kept in production post Card 3 flip)', () => {
    expect(edgeFilterFamiliesForMode(['claim_clarity'], 'production')).toEqual(['claim_clarity']);
  });

  it('FH-7 — edgeFilterFamiliesForMode([claim_clarity], admin_validation) returns [claim_clarity]', () => {
    expect(edgeFilterFamiliesForMode(['claim_clarity'], 'admin_validation')).toEqual([
      'claim_clarity',
    ]);
  });

  it('FH-8 — Family H is the 8th entry in EDGE_FAMILY_REGISTRY (A→J order preserved; index 7)', () => {
    // The Edge registry lists all 10 families in MCP-021A A→J order.
    // Family H occupies index 7 (zero-indexed).
    expect(EDGE_FAMILY_REGISTRY[7].family).toBe('claim_clarity');
  });
});
