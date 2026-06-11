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
import {
  FAMILY_G_RAW_KEYS,
  FAMILY_G_CLASSIFIER_SET_VERSION,
} from './familyGKeys.ts';
import {
  FAMILY_H_RAW_KEYS,
  FAMILY_H_CLASSIFIER_SET_VERSION,
} from './familyHKeys.ts';
import {
  FAMILY_I_RAW_KEYS,
  FAMILY_I_CLASSIFIER_SET_VERSION,
} from './familyIKeys.ts';
import {
  FAMILY_J_RAW_KEYS,
  FAMILY_J_CLASSIFIER_SET_VERSION,
} from './familyJKeys.ts';

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
 * 'evidence_source_chain', 'argument_scheme', 'critical_question',
 * 'resolution_progress', 'claim_clarity', 'thread_topology',
 * 'sensitive_composer'] in this exact order.
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

  // MCP-SERVER-005-FAMILY-D + MCP-BUILD2d: register evidence_source_chain
  // with the 22-key ai_classifier Subset (19 Stage 2B + 3 MCP-BUILD2d). The
  // 8 deterministic Family D rawKeys (5 auto_metadata + 3 lifecycle) remain
  // intentionally excluded; requesting any of them under
  // requestedFamilies=['evidence_source_chain'] returns unsupported_rawKey
  // at the registry boundary. 22 > the 20-key cap, so the Edge serves Family
  // D in 2 batches (16 + 6); the registry holds the full 22-key Subset.
  register('evidence_source_chain', {
    rawKeys: new Set(FAMILY_D_RAW_KEYS),
    classifierSetVersion: FAMILY_D_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-006-FAMILY-E + MCP-BUILD2e: register argument_scheme with the
  // 19-key ai_classifier set (16 Walton schemes + 3 MCP-BUILD2e
  // argument-structure booleans) per design §1 + Build-2 manifest §4 (uniform
  // ai_classifier; Stage 2B NOT REQUIRED). All entries are descriptive
  // structural pattern facts; the doctrine binding lives in familyEPrompt.ts +
  // familyEBanListScan.ts.
  register('argument_scheme', {
    rawKeys: new Set(FAMILY_E_RAW_KEYS),
    classifierSetVersion: FAMILY_E_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-007-FAMILY-F + MCP-BUILD2f: register critical_question with the
  // 17-key ai_classifier set (14 Walton/Toulmin/Peirce critical questions + 3
  // MCP-BUILD2f question-quality booleans) per design §1 + Build-2 manifest §5
  // (uniform ai_classifier; Stage 2B NOT REQUIRED). The 14 baseline CQs are
  // descriptive structural probes on absence/gap; the 3 new question_* keys
  // describe a POSITIVE structural feature of the question the move poses; the
  // existential doctrine binding (the CQ NEVER labels the scheme it probes a
  // fallacy; question_invites_revision NEVER asserts the parent NEEDS revision)
  // lives in familyFPrompt.ts + familyFBanListScan.ts. Family F is
  // productionEnabled = true at the Edge (flipped post-MCP-021C-EDGE-FAMILY-F-
  // ENABLE); MCP-BUILD2f makes no familyRegistry change.
  register('critical_question', {
    rawKeys: new Set(FAMILY_F_RAW_KEYS),
    classifierSetVersion: FAMILY_F_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-008-FAMILY-G: register resolution_progress with the 18-key
  // ai_classifier Subset per Stage 2B operator binding decision. The 12
  // deterministic Family G rawKeys (5 auto_metadata + 7 lifecycle) are
  // intentionally excluded; requesting any of them under
  // requestedFamilies=['resolution_progress'] returns unsupported_rawKey
  // at the registry boundary (mirror Family D). The 18 keys sit at the
  // resolution<->verdict boundary; the existential doctrine binding (a
  // resolution-progress state is DESCRIPTIVE CONVERGENCE-STATE, never a
  // verdict about who won) lives in familyGPrompt.ts + familyGBanListScan.ts.
  // Card 1 of the three-card chain: admin_validation-only at the Edge
  // boundary (Edge familyRegistry already has Family G productionEnabled
  // = false at supabase/functions/_shared/booleanObservations/
  // familyRegistry.ts:100-103; no Edge edit in this card; Card 3 flips it).
  register('resolution_progress', {
    rawKeys: new Set(FAMILY_G_RAW_KEYS),
    classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-009-FAMILY-H: register claim_clarity with the 12-key
  // ai_classifier UNIFORM set per design §A.1.1. The Family H taxonomy
  // is uniform source (1 existing + 11 NEW = 12 total ai_classifier
  // entries; zero auto_metadata; zero lifecycle). No subset filter; no
  // exclusion list. The 12 keys cover claim-clarity structural formulation
  // states (claim present, reason present, conclusion missing, reason
  // missing, multiple claims, claim specificity high/low, quantifier
  // present, modal language present, hedging present, unclear reference,
  // temporal constraint). Doctrine-risk YES via the 4 HIGHEST-risk
  // verdict-adjacent keys (claim_specificity_low + conclusion_missing +
  // reason_missing + unclear_reference_present); the existential doctrine
  // binding (a claim-clarity state is DESCRIPTIVE FORMULATION-STATE, never
  // a quality verdict on the move or speaker) lives in familyHPrompt.ts +
  // familyHBanListScan.ts. Card 1 of the three-card chain:
  // admin_validation-only at the Edge boundary (Edge familyRegistry already
  // has Family H productionEnabled = false at supabase/functions/_shared/
  // booleanObservations/familyRegistry.ts:104-108; no Edge edit in this
  // card; Card 3 flips it).
  register('claim_clarity', {
    rawKeys: new Set(FAMILY_H_RAW_KEYS),
    classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-010-FAMILY-I: register thread_topology with the 6-key
  // ai_classifier MIXED-source Subset per Stage 2B operator binding decision
  // (T1 mixed-source). The Family I taxonomy is MIXED source: 8 auto_metadata
  // + 7 lifecycle + 6 ai_classifier = 21 total. The MCP classifier handles
  // the 6 ai_classifier keys ONLY (introduces new issue, references prior
  // agreement, introduces sub-axis, returns to prior issue, references
  // external context, compares options). The 15 deterministic Family I
  // rawKeys (8 auto_metadata + 7 lifecycle) are intentionally excluded;
  // requesting any of them under requestedFamilies=['thread_topology']
  // returns unsupported_rawKey at the registry boundary (mirror Family D +
  // Family G). Doctrine-risk is LOW: the 6 keys are descriptive
  // thread-graph topology relations (a thread-topology state is DESCRIPTIVE
  // STRUCTURE, never a verdict on the move or speaker); the upstream taxonomy
  // already DROPPED the one verdict-adjacent candidate `repeats_prior_point`.
  // The doctrine binding (5-layer defense) lives in familyIPrompt.ts +
  // familyIBanListScan.ts. Card 1 of the chain: admin_validation-only at the
  // Edge boundary (Edge familyRegistry already has Family I productionEnabled
  // = false at supabase/functions/_shared/booleanObservations/
  // familyRegistry.ts:110-113; no Edge edit in this card; Card 3 flips it).
  register('thread_topology', {
    rawKeys: new Set(FAMILY_I_RAW_KEYS),
    classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION,
  });

  // MCP-SERVER-011-FAMILY-J: register sensitive_composer with the 5-key
  // semantic_referee SOURCE-UNIFORM set per design §1. The Family J taxonomy
  // is uniform source (5 existing UX-001.5A sensitive keys; zero
  // auto_metadata; zero lifecycle). No subset filter; no exclusion list
  // (mirrors the uniform-source E/F/H precedent, the inverse of the
  // mixed-source D/G/I families). The 5 keys cover sensitive-composer
  // structural features (person/intent shift, insult-only-no-claim,
  // pre-send pause, popularity-as-evidence, satire-as-evidence).
  // Doctrine-risk HIGH (the most sensitive prompt in the system): 4 of 5
  // keys are verdict-adjacent and 3 are person/intent-directed, with
  // shifts_to_person_or_intent the axis-partner carrying the maximal guard.
  // The existential doctrine binding (a sensitive-composer observation is a
  // STRUCTURAL FEATURE of the move's own text, never a characterization of
  // the author; cdiscourse-doctrine §10a) lives in familyJPrompt.ts +
  // familyJBanListScan.ts. ADMIN-VALIDATION-ONLY CEILING: the Edge
  // familyRegistry already has Family J productionEnabled = false at
  // supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-118;
  // this card changes NO Edge surface and there is NO Card-3 production flip
  // — a future production-enable requires a fresh cdiscourse-doctrine §10a
  // doctrine review (design §11 E4 ceiling).
  register('sensitive_composer', {
    rawKeys: new Set(FAMILY_J_RAW_KEYS),
    classifierSetVersion: FAMILY_J_CLASSIFIER_SET_VERSION,
  });
}

// Top-of-file side effect: initialize on first import. Idempotent.
initializeFamilyRegistry();
