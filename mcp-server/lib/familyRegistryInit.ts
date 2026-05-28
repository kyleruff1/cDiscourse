/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — MCP-SERVER family registry initialization.
 *
 * This module is side-effect-imported from:
 *   - mcp-server/tools/classifyArgumentBooleanObservations.ts (production)
 *   - mcp-server/tests/familyAFixtureParity.test.ts (fixture parity test)
 *   - mcp-server/tests/familyAKeysParity.test.ts (parity test)
 *   - mcp-server/tests/familyRegistryInit.test.ts (init module tests)
 *
 * When a new family lands (Family B / C / D / E / F / G / H / I / J),
 * the diff is one additional register('<family>', { ... }) call in
 * `initializeFamilyRegistry()`. The init module is the diff readers look at.
 *
 * Design anchors:
 *   - design §5.1 (Option 3 — dedicated init module)
 *   - design §5.2 (file-contents sketch; idempotent guard)
 *   - design §5.3 (import wiring; tool layer owns initialization)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every family is a structural-observation
 *     grouping; no family encodes a verdict or judgment.
 *   - cdiscourse-doctrine §6 — no env reads, no logging, no secrets.
 */
import { register } from './familyRegistry.ts';
import {
  FAMILY_A_RAW_KEYS,
  FAMILY_A_CLASSIFIER_SET_VERSION,
} from './familyAKeys.ts';
import {
  FAMILY_B_RAW_KEYS,
  FAMILY_B_CLASSIFIER_SET_VERSION,
} from './familyBKeys.ts';
import {
  FAMILY_C_RAW_KEYS,
  FAMILY_C_CLASSIFIER_SET_VERSION,
} from './familyCKeys.ts';
import {
  FAMILY_D_RAW_KEYS,
  FAMILY_D_CLASSIFIER_SET_VERSION,
} from './familyDKeys.ts';
import {
  FAMILY_E_RAW_KEYS,
  FAMILY_E_CLASSIFIER_SET_VERSION,
} from './familyEKeys.ts';
import {
  FAMILY_F_RAW_KEYS,
  FAMILY_F_CLASSIFIER_SET_VERSION,
} from './familyFKeys.ts';

let initialized = false;

/**
 * Register every currently-supported family into the singleton registry.
 * Idempotent — safe to call from tests that want to assert the registry is
 * initialized without relying on module-load ordering.
 *
 * The top-of-file side effect below handles the production import path; the
 * explicit function form is for tests that want a stable entry point.
 *
 * Registration order is preserved by the underlying Map (per
 * familyRegistry.ts:82-84), so `getSupportedFamilies()` returns
 * ['parent_relation', 'disagreement_axis', 'misunderstanding_repair',
 * 'evidence_source_chain', 'argument_scheme', 'critical_question'] in
 * this exact order.
 */
export function initializeFamilyRegistry(): void {
  if (initialized) return;
  initialized = true;

  register('parent_relation', {
    rawKeys: new Set(FAMILY_A_RAW_KEYS),
    classifierSetVersion: FAMILY_A_CLASSIFIER_SET_VERSION,
  });

  register('disagreement_axis', {
    rawKeys: new Set(FAMILY_B_RAW_KEYS),
    classifierSetVersion: FAMILY_B_CLASSIFIER_SET_VERSION,
  });

  register('misunderstanding_repair', {
    rawKeys: new Set(FAMILY_C_RAW_KEYS),
    classifierSetVersion: FAMILY_C_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-005-FAMILY-D: register evidence_source_chain with the
  // 19-key ai_classifier Subset per Stage 2B operator binding decision.
  // The 8 deterministic Family D rawKeys (5 auto_metadata + 3 lifecycle)
  // are intentionally excluded; requesting any of them under
  // requestedFamilies=['evidence_source_chain'] returns unsupported_rawKey
  // at the registry boundary.
  register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-006-FAMILY-E: register argument_scheme with the 16-key
  // ai_classifier set per design §1 (uniform ai_classifier; Stage 2B NOT
  // REQUIRED). All 16 Walton (1995, 2008) argumentation schemes are
  // descriptive structural pattern facts; the doctrine binding lives in
  // familyEPrompt.ts + familyEBanListScan.ts.
  register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-007-FAMILY-F: register critical_question with the 14-key
  // ai_classifier set per design §1 (uniform ai_classifier; Stage 2B NOT
  // REQUIRED). The 14 Walton (1995, 2008) + Toulmin (1958) + Peirce
  // critical questions are descriptive structural probes on absence/gap;
  // the existential doctrine binding (the CQ NEVER labels the scheme it
  // probes a fallacy) lives in familyFPrompt.ts + familyFBanListScan.ts.
  // Card 1 of the three-card chain: admin_validation-only at the Edge
  // boundary (Edge familyRegistry already has Family F productionEnabled
  // = false at supabase/functions/_shared/booleanObservations/
  // familyRegistry.ts:95-97; no Edge edit in this card).
  register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });
}

// Top-of-file side effect: initialize on first import. Idempotent.
initializeFamilyRegistry();
